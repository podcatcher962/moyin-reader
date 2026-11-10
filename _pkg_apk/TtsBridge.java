package {PKG};

import android.app.Activity;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * 墨吟阅读器 · 安卓系统语音桥
 * ============================
 * Android System WebView 不提供 Web Speech API 的 speechSynthesis，
 * 页面原本的「系统朗读」在手机上根本走不通。这里把系统 TextToSpeech
 * 伪装成桌面版 VoicePack 的两个接口：
 *
 *   GET  /health  -> {"ok":true,"voices":{"android":true}, ...}
 *   POST /tts     -> {"text":"...","voice":"android","speed":1.0} => audio/wav
 *
 * 页面从 http://127.0.0.1:<port> 加载，而 localPort 被注入成同一个 port，
 * 所以两个请求都是同源，不需要任何 CORS。页面的 localSpeakChunk()
 * 一行都不用改：拿到 WAV 后用 <audio> 播放，高亮、暂停、预取全部照旧。
 *
 * 服务只在 127.0.0.1 监听；TTS 完全离线，用的是手机自带中文语音引擎。
 */
public class TtsBridge {
    private final Activity act;
    private TextToSpeech tts;
    private volatile boolean ready = false;
    private String engineName = "初始化中";

    /** 手机端离线神经语音（sherpa-onnx + AISHELL3，174 个声线）。
     *  后台线程慢慢加载，加载期间照旧用系统 TTS 兜底，不挡用户看书。 */
    private TtsEngine neuro;
    private volatile boolean neuroStarted = false;
    /** 神经语音加载失败的原因；空串表示没失败（还在加载或已经好了）。 */
    private volatile String neuroErr = "";

    /** 加载完的自检报告（GET /diag 原样返回给页面）。 */
    private volatile String probe = "";

    /** 等 WebView 把第一帧画完再加载 so，避开和 Chromium 抢 linker 锁。 */
    private static final long NEURO_DELAY_MS = 9000;

    private final Map<String, CountDownLatch> waits = new ConcurrentHashMap<String, CountDownLatch>();
    private final Map<String, Boolean> results = new ConcurrentHashMap<String, Boolean>();
    private final Map<String, byte[]> cache = new ConcurrentHashMap<String, byte[]>();
    private static final int CACHE_MAX = 48;

    public TtsBridge(Activity a) {
        this.act = a;
        try {
            tts = new TextToSpeech(a, new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status != TextToSpeech.SUCCESS || tts == null) {
                        engineName = "系统语音引擎不可用";
                        return;
                    }
                    try {
                        int r = tts.setLanguage(Locale.CHINA);
                        if (r == TextToSpeech.LANG_MISSING_DATA
                                || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                            // 有些 ROM 用 SIMPLIFIED_CHINESE 才认
                            r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                        }
                        ready = !(r == TextToSpeech.LANG_MISSING_DATA
                                || r == TextToSpeech.LANG_NOT_SUPPORTED);
                        engineName = ready ? "Android 系统中文语音" : "手机缺中文语音数据";
                        tts.setSpeechRate(1.0f);
                        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                            @Override public void onStart(String id) { }
                            @Override public void onDone(String id) { finish(id, true); }
                            @Override public void onError(String id) { finish(id, false); }
                        });
                    } catch (Throwable t) {
                        ready = false;
                        engineName = "语音引擎初始化失败";
                    }
                }
            });
        } catch (Throwable t) {
            ready = false;
            engineName = "语音引擎不可用";
        }
        startNeuroLater();
    }

    /**
     * 神经语音**必须等 WebView 站稳了再加载**。
     *
     * 以前这里是直接 startNeuro()：构造完立刻开线程 dlopen 30 MB 的
     * libonnxruntime + sherpa 三个 so，而主线程紧接着 new WebView(this)
     * —— Chromium 自己也要 dlopen libwebviewchromium.so。两个大 so 同时
     * 抢 linker 的全局锁，部分 ROM（实测 MIUI/HyperOS）直接 SIGSEGV 带走进程：
     * 表现就是点开图标一片窗口底色、系统把 Activity 反复拉起来，
     * 永远进不去界面（日志里连 Java 异常都没有，因为它死在 native）。
     *
     * 页面画出来之前一次都不碰它。朗读本来也要等页面就绪，晚几秒没人察觉。
     */
    private void startNeuroLater() {
        try {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(
                    new Runnable() {
                        public void run() { startNeuro(); }
                    }, NEURO_DELAY_MS);
        } catch (Throwable t) { }
    }

    /**
     * 神经语音要解压 32 MB 模型再喂给 onnxruntime，首次约 5–10 秒。
     * 放后台线程做，主线程只负责把 WebView 拉起来，用户不会看到白屏。
     */
    private void startNeuro() {
        if (neuroStarted) return;
        neuroStarted = true;
        Thread th = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    {DIAG_N1}
                    TtsEngine e = new TtsEngine();
                    {DIAG_N2}
                    long t0 = System.currentTimeMillis();
                    boolean ok = e.load(act);
                    {DIAG_N3}
                    android.util.Log.i("MoYin", "神经语音加载 " + (ok ? "成功" : "失败:" + e.lastError())
                            + " 用时 " + (System.currentTimeMillis() - t0) + "ms");
                    if (ok) {
                        neuro = e;
                        /* 加载完先自己合成三句短的：一是把推理会话热起来
                           （第一句本来就要现建，提前做掉用户就感觉不到），
                           二是把结果留给 /diag —— 真机上「没声音」时这是唯一能
                           看清是模型没出声还是根本没跑到合成的线索。 */
                        try { probe = e.selfTest(); }
                        catch (Throwable t) { probe = "自检异常 " + t.getClass().getSimpleName(); }
                        /* 187 人配角库第一次用要先把 51 MB 解到 files、再建 38 MB 会话，
                           中端手机半分钟起步——按需加载的话，用户点第一个配角声线就是
                           「等 45 秒然后超时，没声音」。所以这里趁他还在听女声旁白，
                           悄悄把它预热掉；延迟 3 秒是为了不跟第一句合成抢 CPU。 */
                        try {
                            Thread w = new Thread(new Runnable() {
                                @Override public void run() {
                                    try { Thread.sleep(3000); } catch (InterruptedException ignored) { }
                                    try { e.preloadLib(); } catch (Throwable ignored) { }
                                }
                            }, "moyin-lib-preload");
                            w.setDaemon(true);
                            w.setPriority(Thread.MIN_PRIORITY);
                            w.start();
                        } catch (Throwable ignored) { }
                    }
                    else { neuroErr = e.lastError(); e.close(); }
                } catch (Throwable t) {
                    neuroErr = t.getClass().getSimpleName() + ": " + t.getMessage();
                    android.util.Log.w("MoYin", "神经语音加载异常", t);
                }
            }
        }, "moyin-tts-load");
        th.setDaemon(true);
        th.setPriority(Thread.NORM_PRIORITY - 1);
        th.start();
    }

    {DIAG_NOTE_METHOD}

    /** 神经语音是否已经能合成。 */
    private boolean neuroReady() {
        TtsEngine e = neuro;
        return e != null && e.ready();
    }

    private void finish(String id, boolean ok) {
        if (id == null) return;
        results.put(id, ok);
        CountDownLatch l = waits.get(id);
        if (l != null) l.countDown();
    }

    public void stop() {
        try { if (tts != null) tts.shutdown(); } catch (Throwable t) { }
        TtsEngine e = neuro;
        if (e != null) { try { e.close(); } catch (Throwable t) { } }
    }

    /**
     * 页面初始化是异步的（IndexedDB 读完后才挂 window.MY），
     * 所以这里轮询等它出现，把端口写进配置再重新探测一次。
     *
     * 音色表不在这里硬塞：/health 会按当前真实可用的引擎返回
     * （神经语音 → 174 个声线；只有系统 TTS → 单个「系统语音」）。
     * 这样神经语音加载完之后页面自动切过去，加载期间也不耽误用系统语音听。
     *
     * 两个实测坑：
     *   1. 首次打开要建 IndexedDB、还可能自动导入书，MY 出现得比想象慢 ——
     *      原来只等 12 秒，慢一点就永远注入不上，用户看到的是「不支持朗读」。
     *      现在等满 60 秒。
     *   2. TextToSpeech 初始化是异步的，onInit 可能晚于页面探测。注入完立刻
     *      探一次，没就绪就每 1.5 秒再探，最多 22 秒，避免「刚装好就说没引擎」。
     */
    public void injectMoyin(WebView web, int port) {
        if (web == null || port <= 0) return;
        String js =
            "(function(){var P=" + port + ";var n=0;"
          + "var t=setInterval(function(){"
          + "  if(++n>600){clearInterval(t);return;}"
          + "  if(!window.MY||!MY.CFG||!MY.LOCAL||!MY.localProbe)return;"
          + "  clearInterval(t);"
          + "  try{"
          + "    MY.CFG.localPort=P;MY.CFG.localOn=1;"
          + "    MY.LOCAL.ready=false;MY.LOCAL.miss=0;MY.LOCAL.checking=false;"
          + "    MY.saveCfg();"
          + "    var k=0,go=function(){MY.localProbe(false).then(function(ok){"
          + "      if(!ok&&++k<24)setTimeout(go,1500);});};"
          + "    go();"
          + "  }catch(e){}"
          + "},100);})();";
        try { web.evaluateJavascript(js, null); } catch (Throwable t) { }
    }

    /**
     * 用户去系统设置装好中文语音后回来点「再试一次」，不应该要求重启应用。
     * 这里在还没就绪时重新 setLanguage 一次；就绪了就直接返回。
     */
    private void recheckLang() {
        if (ready || tts == null) return;
        try {
            int r = tts.setLanguage(Locale.CHINA);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                r = tts.setLanguage(Locale.SIMPLIFIED_CHINESE);
            }
            if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) {
                ready = true;
                engineName = "Android 系统中文语音";
            }
        } catch (Throwable t) { }
    }

    // ── GET /health ──────────────────────────────────────────────────
    public void handleHealth(Socket c, int port, String method) {
        if (!"GET".equals(method) && !"HEAD".equals(method)) {
            err(c, 405, "只收 GET");
            return;
        }
        try {
            // 神经语音就绪：直接报 174 个声线（和桌面端同一个模型、同一套分组）
            if (neuroReady()) {
                byte[] b = neuro.healthJson(true).getBytes("UTF-8");
                ok(c, "application/json; charset=utf-8", b);
                return;
            }
            recheckLang();
            JSONObject j = new JSONObject();
            j.put("ok", ready);
            // loading：模型确实还在后台解压 / 加载；加载失败时置 false 并把原因放进 detail
            j.put("loading", !neuroStarted || (neuro == null && neuroErr.length() == 0));
            j.put("detail", neuroErr);
            j.put("engine", ready ? "Android 系统中文语音" : engineName);
            j.put("version", 2);
            j.put("ready", ready);
            JSONObject v = new JSONObject();
            v.put("android", ready);
            j.put("voices", v);
            byte[] b = j.toString().getBytes("UTF-8");
            ok(c, "application/json; charset=utf-8", b);
        } catch (Throwable t) {
            err(c, 500, "状态读取失败");
        }
    }

    // ── POST /tts ─────────────────────────────────────────────────────
    public void handleTts(Socket c, InputStream in, String[] lines, String method) {
        if (!"POST".equals(method)) { err(c, 405, "只收 POST"); return; }
        boolean hasNeuro = neuroReady();
        if (!hasNeuro && (!ready || tts == null)) {
            err(c, 503, neuro == null ? "语音引擎正在加载模型，请稍等十几秒"
                                      : "手机中文语音未就绪，请在系统设置里安装中文 TTS 引擎");
            return;
        }
        int len;
        try {
            len = Integer.parseInt(String.valueOf(header(lines, "content-length")).trim());
        } catch (Exception e) {
            err(c, 411, "缺长度");
            return;
        }
        if (len <= 0 || len > 64 * 1024) { err(c, 413, "请求太大"); return; }
        byte[] body = new byte[len];
        try {
            int off = 0;
            while (off < len) {
                int n = in.read(body, off, len - off);
                if (n < 0) break;
                off += n;
            }
        } catch (Exception e) {
            err(c, 400, "读不到正文");
            return;
        }
        String text, voice = "";
        float rate = 1.0f;
        try {
            JSONObject j = new JSONObject(new String(body, 0, len, "UTF-8"));
            text = j.optString("text", "").trim();
            voice = j.optString("voice", "");
            rate = (float) j.optDouble("speed", 1.0);
        } catch (Throwable t) {
            err(c, 400, "正文不是 JSON");
            return;
        }
        if (text.isEmpty()) { err(c, 400, "没有文字"); return; }
        if (text.length() > 400) text = text.substring(0, 400);
        if (rate < 0.5f) rate = 0.5f;
        if (rate > 2.0f) rate = 2.0f;

        // 神经语音优先；合成失败（模型异常 / 内存不足）再把引擎给的原因带回去。
        // 这里不再悄悄退回系统语音：安卓壳里的系统语音是哑的，退过去只会更糊涂，
        // 而且把真实原因吞掉，页面只能弹一句没用的「再点一次」。
        if (hasNeuro) {
            /* 纯外文块（一个汉字都没有、只有英文字母）：中文模型念不出来，
               送进去必然「全段没出声」。这不是引擎故障，别让页面弹
               「语音没有出声」——回 415，页面会按语速留白跳过这一段。
               （桌面端装了英文模型就能念，见 VoicePack/tts_server.py。） */
            if (TtsEngine.foreignOnly(text) && !neuro.enReady()) {
                err(c, 415, "no_en_voice");
                return;
            }
            byte[] wav = neuro.synth(text, voice, rate);
            if (wav != null) { ok(c, "audio/wav", wav); return; }
            String why = neuro.lastError();
            err(c, 502, "神经语音没合成出这一段" + (why != null && why.length() > 0 ? "：" + why : "（引擎没给原因）"));
            return;
        }
        if (!ready || tts == null) { err(c, 503, "合成失败，请检查手机中文语音引擎"); return; }
        byte[] wav = synth(text, rate);
        if (wav == null) { err(c, 503, "合成失败，请检查手机中文语音引擎"); return; }
        ok(c, "audio/wav", wav);
    }

    /** GET /diag：语音引擎自检报告。页面在合成失败时拉一次，摆进对话框里让人截图。 */
    public void handleDiag(Socket c, String method) {
        if (!"GET".equals(method) && !"HEAD".equals(method)) { err(c, 405, "只收 GET"); return; }
        StringBuilder sb = new StringBuilder();
        try {
            sb.append("引擎=").append(neuro != null ? "已建" : "未建")
              .append(" 就绪=").append(neuroReady())
              .append(" 加载错误=").append(neuroErr.length() == 0 ? "无" : neuroErr)
              .append('\n');
            String p = probe;
            sb.append(p == null || p.length() == 0 ? "自检还没跑完\n" : p);
            TtsEngine e = neuro;
            if (e != null) {
                sb.append("最近一次合成错误=").append(e.lastError()).append('\n');
            }
            ok(c, "text/plain; charset=utf-8", sb.toString().getBytes("UTF-8"));
        } catch (Throwable t) {
            err(c, 500, "自检读取失败");
        }
    }

    // ── GET /warm?lib=1 ──────────────────────────────────────────────
    /** 后台预热配角库（分角色朗读用的 187 人模型）。
     *
     *  页面在「开始朗读」那一刻叫一次：那时正在播开头几句旁白，
     *  40 MB 的解压和建会话就被这几句盖过去了，第一个角色开口不用再干等。
     *  立刻返回，不占着连接——真去加载的是另一条线程。 */
    public void handleWarm(Socket c, String query, String method) {
        if (!"GET".equals(method) && !"HEAD".equals(method)) { err(c, 405, "只收 GET"); return; }
        boolean lib = query != null && query.indexOf("lib=1") >= 0;
        final TtsEngine e = neuro;
        if (lib && e != null && e.ready()) {
            try {
                Thread th = new Thread(new Runnable() {
                    public void run() { e.preloadLib(); }
                }, "moyin-warm-lib");
                th.setDaemon(true);
                th.setPriority(Thread.MIN_PRIORITY);
                th.start();
            } catch (Throwable ignored) { }
        }
        try {
            ok(c, "application/json; charset=utf-8",
               ("{\"ok\":true,\"lib\":" + (e != null && e.libReady()) + "}").getBytes("UTF-8"));
        } catch (Throwable t) {
            err(c, 500, "预热失败");
        }
    }

    private byte[] synth(String text, float rate) {
        String key = Integer.toHexString((text + "|" + rate).hashCode());
        byte[] hit = cache.get(key);
        if (hit != null) return hit;

        String id = "m" + System.nanoTime();
        CountDownLatch latch = new CountDownLatch(1);
        waits.put(id, latch);
        results.put(id, Boolean.FALSE);
        File f = new File(act.getCacheDir(), id + ".wav");
        try {
            tts.setSpeechRate(rate);
            Bundle p = new Bundle();
            p.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            int rc = tts.synthesizeToFile(text, p, f, id);
            if (rc != TextToSpeech.SUCCESS) return null;
            // 少数 ROM 的引擎不回调 onDone，所以不把回调当唯一条件：
            // 最多等 18 秒，然后一律看文件本身是不是有效 WAV。
            try { latch.await(18, TimeUnit.SECONDS); } catch (InterruptedException e) { }
            try { Thread.sleep(220); } catch (InterruptedException e) { }
            if (!f.exists() || f.length() < 1000) return null;
            byte[] wav = readAll(f);
            if (!isWav(wav)) return null;
            if (cache.size() > CACHE_MAX) cache.clear();
            cache.put(key, wav);
            return wav;
        } catch (Throwable t) {
            return null;
        } finally {
            waits.remove(id);
            results.remove(id);
            try { f.delete(); } catch (Throwable t) { }
        }
    }

    private static boolean isWav(byte[] b) {
        return b != null && b.length > 44
            && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'A' && b[10] == 'V' && b[11] == 'E';
    }

    private static byte[] readAll(File f) throws Exception {
        FileInputStream in = new FileInputStream(f);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        in.close();
        return bos.toByteArray();
    }

    // ── 极小的 HTTP 响应工具 ─────────────────────────────────────────
    private static String header(String[] lines, String key) {
        if (lines == null) return null;
        for (int i = 1; i < lines.length; i++) {
            String l = lines[i];
            int e = l.indexOf(':');
            if (e <= 0) continue;
            if (l.substring(0, e).trim().equalsIgnoreCase(key)) {
                return l.substring(e + 1).trim();
            }
        }
        return null;
    }

    private static void ok(Socket c, String mime, byte[] body) {
        try {
            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 200 OK\r\nContent-Type: " + mime +
                       "\r\nContent-Length: " + body.length +
                       "\r\nAccess-Control-Allow-Origin: *" +
                       "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n")
                      .getBytes("UTF-8"));
            out.write(body);
            out.flush();
            c.close();
        } catch (Exception e) {
            try { c.close(); } catch (Exception x) { }
        }
    }

    private static void err(Socket c, int code, String why) {
        try {
            byte[] b = String.valueOf(why).getBytes("UTF-8");
            OutputStream out = c.getOutputStream();
            out.write(("HTTP/1.1 " + code + " Error\r\n"
                     + "Content-Type: text/plain; charset=utf-8\r\n"
                     + "Access-Control-Allow-Origin: *\r\n"
                     + "Content-Length: " + b.length + "\r\nConnection: close\r\n\r\n")
                      .getBytes("UTF-8"));
            out.write(b);
            out.flush();
            c.close();
        } catch (Exception e) { }
    }
}

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
        startNeuro();
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
                    TtsEngine e = new TtsEngine();
                    long t0 = System.currentTimeMillis();
                    boolean ok = e.load(act);
                    android.util.Log.i("MoYin", "神经语音加载 " + (ok ? "成功" : "失败:" + e.lastError())
                            + " 用时 " + (System.currentTimeMillis() - t0) + "ms");
                    if (ok) neuro = e;
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

        // 神经语音优先；合成失败（模型异常 / 内存不足）再退回系统语音，不中断听书
        if (hasNeuro) {
            byte[] wav = neuro.synth(text, voice, rate);
            if (wav != null) { ok(c, "audio/wav", wav); return; }
        }
        if (!ready || tts == null) { err(c, 503, "合成失败，请检查手机中文语音引擎"); return; }
        byte[] wav = synth(text, rate);
        if (wav == null) { err(c, 503, "合成失败，请检查手机中文语音引擎"); return; }
        ok(c, "audio/wav", wav);
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

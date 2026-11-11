package com.lanlan.moyinreader;

import android.content.Context;
import android.content.res.AssetManager;

import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsKittenModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsMatchaModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsPocketModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsSupertonicModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsZipVoiceModelConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 墨吟 · 手机端离线神经语音
 *
 * 三套模型并存，与桌面端 VoicePack/tts_server.py 的编排一致：
 *   · 女主（默认，x0）：小雅，Piper 中文单说话人 VITS，22.05 kHz，官方 int8。
 *   · 男主（c0）：超文，同架构中文男声，22.05 kHz，官方 int8。与女主共用词表。
 *   · 配角库（s0…s186）：fanchen，16 kHz，187 个说话人共用一份 int8 模型（38 MB），
 *     靠 sid 切声线，体积不随音色数量增长。推理慢，只当配角用。
 *
 * 模型放在 apk 的 assets 里，首次启动解压到应用私有目录，之后直接用绝对路径，
 * onnxruntime 可以正常 mmap，不必每次把几十 MB 读进内存。
 */
public final class TtsEngine {

    // ── 诊断：native 崩溃时进程直接消失，Toast/异常都留不下，只能一步步写盘。 ──
    // 正式构建由 build_apk.py 把 {DIAG_ON} 换成 false，只剩一次布尔判断。
    static boolean DIAG = {DIAG_ON};
    private static Context diagCtx;

    static void mark(String m) {
        if (!DIAG || diagCtx == null) return;
        try {
            FileOutputStream o = new FileOutputStream(new File(diagCtx.getFilesDir(), "boot.txt"));
            o.write(m.getBytes("UTF-8"));
            o.flush();
            o.close();
        } catch (Throwable x) { }
    }

    /** 主角 · 女主（小雅）：Piper 中文单说话人 VITS，22.05 kHz，官方 int8 版。 */
    static final String GIRL_VOICE = "x0";
    static final String GIRL_LABEL = "墨吟 · 女声";
    static final int GIRL_F0 = 266;
    static final String GIRL_DIR = "tts/xiaoya";
    static final String GIRL_MODEL = "model.onnx";

    /** 主角 · 男主（超文）：同为 22.05 kHz 单说话人，官方 int8 版。 */
    static final String BOY_VOICE = "c0";
    static final String BOY_LABEL = "墨吟 · 男声";
    static final int BOY_F0 = 163;
    static final String BOY_DIR = "tts/chaowen";
    static final String BOY_MODEL = "model.onnx";

    /** 配角库（fanchen）：16 kHz 187 个说话人共用一份模型，音色 key s0…s186。 */
    static final String LIB_DIR = "tts/fanchen";
    static final String LIB_MODEL = "model.onnx";

    /* 小雅与超文共用同一套词表和数字规则（两者 lexicon/tokens/fst 逐字节相同），
       所以只在 xiaoya 目录解压一份，超文直接指过来。 */
    static final String[] WORD_FILES = {
            "lexicon.txt", "tokens.txt", "date.fst", "number.fst", "phone.fst"
    };
    static final String[] GIRL_ASSETS = {
            GIRL_MODEL, "lexicon.txt", "tokens.txt", "date.fst", "number.fst", "phone.fst"
    };
    static final String[] BOY_ASSETS = { BOY_MODEL };
    static final String[] LIB_ASSETS = {
            LIB_MODEL, "lexicon.txt", "tokens.txt",
            "dict/jieba.dict.utf8", "dict/hmm_model.utf8", "dict/idf.utf8",
            "dict/stop_words.utf8", "dict/user.dict.utf8"
    };

    /* 模型换代了就换版本号，老用户首次启动会重新解压，不会拿旧文件跑新代码。
       v4：配角库从「动态量化 int8」换成「静态量化 QDQ int8」——同一份权重，
       卷积走 QLinearConv 的优化内核，实测每句从 12.9 秒降到 0.24 秒。 */
    private static final int MODEL_VER = 7;

    /** sid → 中位基频（Hz），离线逐人实测。手机端与桌面共用同一份分组依据。 */
    static final int[] SID_F0 = {
            260, 278, 273, 251, 226, 286, 243, 224, 278, 234, 151, 238,
            243, 217, 299, 153, 254, 288, 252, 232, 265, 172, 257, 205,
            249, 152, 273, 218, 265, 201, 250, 276, 189, 303, 283, 252,
            204, 247, 219, 291, 139, 251, 314, 314, 313, 275, 153, 223,
            194, 276, 280, 249, 168, 290, 251, 247, 237, 219, 146, 220,
            146, 260, 244, 258, 270, 175, 303, 286, 269, 128, 275, 268,
            192, 279, 121, 181, 167, 246, 256, 244, 218, 240, 245, 194,
            239, 263, 299, 272, 224, 256, 247, 243, 293, 231, 220, 172,
            218, 295, 161, 272, 138, 257, 174, 262, 236, 316, 222, 164,
            268, 256, 169, 277, 248, 232, 234, 251, 300, 241, 287, 131,
            256, 298, 257, 256, 118, 278, 270, 283, 260, 249, 263, 226,
            249, 257, 288, 280, 134, 256, 236, 280, 219, 283, 254, 163,
            211, 273, 245, 236, 191, 220, 282, 176, 275, 153, 256, 260,
            160, 279, 244, 271, 257, 254, 220, 150, 251, 238, 272, 162,
            262, 213, 259, 176, 263, 277, 182, 154, 213, 198, 239, 280,
            256, 168, 291, 169, 248, 266, 229,
    };

    /** 用户逐条试听敲定的 21 个配角声线（与桌面端 curation 一致）。
     *  2026-11-11 按实测基频重排命名：「青年男」原来给了 4 个，实测只有 s32 够格，
     *  s110/s52/s102 分别只有 133/144/151 Hz，都是中年男的音高。改成中性名，sid 不动。 */
    static final int[] CURATED_SID = {
            124, 74, 58, 156, 167, 110, 52, 102, 32,
            36, 169, 13, 149, 106, 19, 165, 129, 120, 20, 41, 105
    };
    static final String[] CURATED_LABEL = {
            "老生 · 低沉 1", "老生 · 低沉 2",
            "中年男 1", "中年男 2", "中年男 3", "中年男 4",
            "男声 · 中音 1", "男声 · 中音 2", "青年男 1",
            "女声 · 低音 1", "沉稳女 2",
            "成年女 1", "成年女 2", "成年女 3", "成年女 4", "成年女 5",
            "青年女 1", "青年女 2", "青年女 3",
            "童声 1", "童声 2"
    };

    /** 与桌面 tts_server.py 的 band_of 完全一致，195 Hz 是男女分界。
     *  41 号（童声 1）中位基频 251 Hz 会落进「女声 · 青年」，试听后单独指定档位。
     *  52/110/102 的数据集标注基频（168/169/174）与实测（143/133/151）差得远，
     *  按表值会落进「男声 · 偏高」，和精选里叫「中音」对不上，按实测归中年组。 */
    static String bandOf(int hz, int sid) {
        if (sid == 41) return "女声 · 高音";
        if (sid == 52 || sid == 110 || sid == 102) return "男声 · 中年";
        if (hz < 140) return "男声 · 低沉";
        if (hz < 165) return "男声 · 中年";
        if (hz < 195) return "男声 · 偏高";
        if (hz < 215) return "女声 · 低音";
        if (hz < 240) return "女声 · 成年";
        if (hz < 270) return "女声 · 青年";
        return "女声 · 高音";
    }

    static String labelOf(int sid) {
        for (int i = 0; i < CURATED_SID.length; i++) {
            if (CURATED_SID[i] == sid) return CURATED_LABEL[i];
        }
        return "音色 " + sid;
    }

    /** 该音色是否走配角库（s0…s186）。 */
    static boolean isFanchen(String voice) {
        if (voice == null) return false;
        String v = voice.trim();
        return v.startsWith("s") || v.startsWith("S");
    }

    /** 该音色是否是男主。 */
    static boolean isBoy(String voice) {
        return voice != null && BOY_VOICE.equals(voice.trim());
    }

    /** 是否男声（决定要不要做降噪）。195 Hz 与 bandOf() 的男女分界一致。 */
    static boolean isMaleVoice(String voice) {
        if (voice == null) return false;
        if (isBoy(voice)) return true;
        if (isFanchen(voice)) {
            int sid = sidOf(voice);
            return sid >= 0 && sid < SID_F0.length && SID_F0[sid] < 195;
        }
        return false;                       // 女主模型，不动
    }

    /** 解析 "s124" / "124"，非法一律回落到第一个精选音色。 */
    static int sidOf(String voice) {
        if (voice == null) return CURATED_SID[0];
        String v = voice.trim();
        if (v.startsWith("s") || v.startsWith("S")) v = v.substring(1);
        try {
            int sid = Integer.parseInt(v);
            if (sid >= 0 && sid < SID_F0.length) return sid;
        } catch (Exception ignored) { }
        return CURATED_SID[0];
    }

    /** 纯外文（有拉丁字母、一个汉字都没有）。中文模型对这种块一个字也念不出来，
     *  送进去只会「全段没出声」，所以桥接层会回 415 让页面按语速留白跳过。 */
    public static boolean foreignOnly(String s) {
        if (s == null) return false;
        boolean latin = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)
                    || (c >= 0xf900 && c <= 0xfaff)) return false;
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) latin = true;
        }
        return latin;
    }

    /** 这台机器能不能念外文。
     *  当前 APK 里没有英文模型（中文三套模型都不认字母），所以恒 false；
     *  等哪天把 piper 英文模型打进 assets/tts/en 并接上语言切片，再改成真判断。
     *  在此之前纯英文块由页面按语速留白跳过，不弹错、不切系统语音。 */
    public boolean enReady() {
        return false;
    }

    /** /health 的音色表：女主 1 + 男主 1 + 配角库 187。 */
    String healthJson(boolean engineOk) {
        int n = SID_F0.length + 2;
        StringBuilder sb = new StringBuilder(18432);
        sb.append("{\"ok\":").append(engineOk).append(",");
        sb.append("\"engine\":\"").append(engineOk ? "sherpa-onnx 2.0.1 · 安卓" : "模型加载中").append("\",");
        sb.append("\"ready\":").append(engineOk).append(",");
        sb.append("\"count\":").append(n).append(",");
        sb.append("\"en\":false,");
        /* 配角库（187 人）是不是已经建好会话。页面靠它决定要不要提示
           「正在准备语音库」——库热了就一次都不该再弹，弹多了就是骚扰。 */
        sb.append("\"lib\":").append(lib != null).append(",");
        sb.append("\"version\":7,\"curated\":[\"").append(GIRL_VOICE).append("\",\"")
                .append(BOY_VOICE).append("\"");
        for (int i = 0; i < CURATED_SID.length; i++) {
            sb.append(",\"s").append(CURATED_SID[i]).append("\"");
        }
        sb.append("],\"voices\":{\"").append(GIRL_VOICE).append("\":").append(engineOk)
                .append(",\"").append(BOY_VOICE).append("\":").append(engineOk);
        for (int i = 0; i < SID_F0.length; i++) {
            sb.append(",\"s").append(i).append("\":").append(engineOk);
        }
        sb.append("},\"labels\":{\"").append(GIRL_VOICE).append("\":\"").append(GIRL_LABEL)
                .append("\",\"").append(BOY_VOICE).append("\":\"").append(BOY_LABEL).append("\"");
        for (int i = 0; i < SID_F0.length; i++) {
            sb.append(",\"s").append(i).append("\":\"").append(labelOf(i)).append("\"");
        }
        sb.append("},\"groups\":{\"").append(GIRL_VOICE).append("\":\"").append(bandOf(GIRL_F0, -1))
                .append("\",\"").append(BOY_VOICE).append("\":\"").append(bandOf(BOY_F0, -1)).append("\"");
        for (int i = 0; i < SID_F0.length; i++) {
            sb.append(",\"s").append(i).append("\":\"").append(bandOf(SID_F0[i], i)).append("\"");
        }
        sb.append("},\"f0\":{\"").append(GIRL_VOICE).append("\":").append(GIRL_F0)
                .append(",\"").append(BOY_VOICE).append("\":").append(BOY_F0);
        for (int i = 0; i < SID_F0.length; i++) {
            sb.append(",\"s").append(i).append("\":").append(SID_F0[i]);
        }
        sb.append("}}");
        return sb.toString();
    }

    /* 一把锁管「建/销毁引擎」，另外三把各管一套模型。
     *
     * 以前是一个 ReentrantLock 把合成也一起串起来：分角色朗读时旁白用女主
     * 22 kHz 模型、对白用 fanchen 16 kHz 模型，两句本来各算各的，却被同一把
     * 锁排成一条队——上一句旁白合完才轮到角色那句，听感就是「角色开口前干等」。
     * 三个模型是三份独立的 onnxruntime 会话，互不共享状态，可以真正并行。 */
    private final ReentrantLock loadLock = new ReentrantLock();
    private final ReentrantLock girlLock = new ReentrantLock();
    private final ReentrantLock boyLock = new ReentrantLock();
    private final ReentrantLock libLock = new ReentrantLock();
    private Context appCtx;
    private OfflineTts girl;          // 女主，默认音色
    private OfflineTts boy;           // 男主，按需加载
    private OfflineTts lib;           // 配角库，按需加载
    private int girlRate = 22050;
    private int boyRate = 22050;
    private int libRate = 16000;
    private String lastError = "";
    /** 配角库那次加载花了多久、失败时到底卡在哪一步——真机「选了声线没声音」全靠它定位。 */
    private long libMs = -1;
    private String libErr = "";

    /** 女主装好就算就绪——男主和配角库都是按需加载的，缺了不影响默认听书。 */
    public boolean ready() {
        return girl != null;
    }

    public int sampleRate() {
        if (girl != null) return girlRate;
        if (boy != null) return boyRate;
        if (lib != null) return libRate;
        return 22050;
    }

    public String lastError() {
        return lastError;
    }

    /** 语音自检：直接调 native 合成三句最短的话，把每一步的真实结果写成一段文字。
     *
     *  真机上「点了朗读没声音」，可能是模型没出声、峰值太低、采样率不对、
     *  或者 JNI 直接出错，页面那边只能看到一句「没合成出来」。这份报告能一次
     *  指到具体哪一环，用户截个图就够定位，不用连 adb。 */
    public String selfTest() {
        StringBuilder sb = new StringBuilder();
        sb.append("女主=").append(girl != null)
          .append(" 男主=").append(boy != null)
          .append(" 配角库=").append(lib != null);
        if (lib != null) {
            sb.append("（就绪，加载用 ").append(libMs >= 0 ? libMs + "ms" : "?").append("）");
        } else if (!libErr.isEmpty()) {
            sb.append("（加载失败：").append(libErr).append("）");
        } else {
            sb.append("（还没选过配角声线，未加载）");
        }
        sb.append('\n');
        if (girl == null) {
            return sb.append("女主引擎没建起来；lastError=").append(lastError).toString();
        }
        try {
            sb.append("采样率=").append(girl.sampleRate())
              .append(" 内置=").append(girlRate)
              .append(" 说话人数=").append(girl.numSpeakers())
              .append(" 语言=").append(girl.lang())
              .append('\n');
        } catch (Throwable e) {
            sb.append("读引擎信息就出错：").append(e.getClass().getSimpleName())
              .append(": ").append(e.getMessage()).append('\n');
        }
        probe(sb, "你好");
        probe(sb, "你好，世界。");
        probe(sb, "风起了。");
        return sb.toString();
    }

    private void probe(StringBuilder sb, String t) {
        long t0 = System.currentTimeMillis();
        try {
            GeneratedAudio a = girl.generate(t, 0, 1.0f);
            long ms = System.currentTimeMillis() - t0;
            if (a == null) {
                sb.append("「").append(t).append("」→ generate 返回 null（").append(ms).append("ms）\n");
                return;
            }
            float[] p = a.getSamples();
            sb.append("「").append(t).append("」→ 样本=").append(p == null ? -1 : p.length)
              .append(" 峰值=").append(String.format(java.util.Locale.US, "%.4f", p == null ? 0f : peak(p)))
              .append(" 采样率=").append(a.getSampleRate())
              .append(" 用时=").append(ms).append("ms\n");
        } catch (Throwable e) {
            sb.append("「").append(t).append("」→ 异常 ").append(e.getClass().getName())
              .append(": ").append(e.getMessage()).append('\n');
        }
    }

    public static String mainVoice() {
        return GIRL_VOICE;
    }

    /** 解压模型目录；同目录可以有多个 stamp（词表和模型分开解压，避免互相覆盖）。 */
    private String ensureAssets(Context ctx, String assetDir, String fileDir,
                                String[] files, String tag) throws IOException {
        File base = new File(ctx.getFilesDir(), fileDir);
        File stamp = new File(base, ".v" + MODEL_VER + "_" + tag);
        if (stamp.isFile()) return base.getAbsolutePath();
        if (!base.isDirectory() && !base.mkdirs()) {
            throw new IOException("mkdir failed: " + base);
        }
        AssetManager am = ctx.getAssets();
        for (String name : files) {
            mark("N2.3 解压 " + assetDir + "/" + name);
            File out = new File(base, name);
            File parent = out.getParentFile();
            if (parent != null && !parent.isDirectory()) parent.mkdirs();
            InputStream in = am.open(assetDir + "/" + name);
            FileOutputStream os = new FileOutputStream(out);
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
            os.getFD().sync();
            os.close();
            in.close();
        }
        FileOutputStream f = new FileOutputStream(stamp);
        f.write('1');
        f.close();
        return base.getAbsolutePath();
    }

    /** 建一套 VITS 引擎：modelPath 是模型绝对路径，wordDir 放词表，dictDir 可空，ruleDir 放 fst。 */
    private OfflineTts build(Context ctx, String modelPath, String wordDir,
                             String dictDir, String ruleDir) {
        // Kotlin data class 的 String 参数同样非空，传 null 会 NPE，统一收敛成空串。
        if (dictDir == null) dictDir = "";
        if (ruleDir == null) ruleDir = "";
        OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig(
                modelPath,                  // model
                wordDir + "/lexicon.txt",   // lexicon
                wordDir + "/tokens.txt",    // tokens
                "",                         // dataDir
                dictDir,                    // dictDir：配角库带 jieba 分词表
                0.667f,                     // noiseScale
                0.8f,                       // noiseScaleW
                1.0f);                      // lengthScale
        // sherpa-onnx 2.0.1 的 OfflineTtsModelConfig 是 Kotlin data class，
        // 7 个子配置全部声明为非空。传 null 会在运行期被 Kotlin 的空检查拦下：
        //   NullPointerException: Parameter specified as non-null is null ...
        //   OfflineTtsModelConfig.<init>, parameter matcha
        // 所以 VITS 以外的引擎必须传「空实例」——字段全空串/0，等于没配。
        OfflineTtsModelConfig mc = new OfflineTtsModelConfig(
                vits,
                new OfflineTtsMatchaModelConfig(),
                new OfflineTtsKokoroModelConfig(),
                new OfflineTtsZipVoiceModelConfig(),
                new OfflineTtsKittenModelConfig(),
                new OfflineTtsPocketModelConfig(),
                new OfflineTtsSupertonicModelConfig(),
                2,                          // numThreads
                false,                      // debug
                "cpu");                     // provider
        String fsts = ruleDir.isEmpty() ? ""
                : ruleDir + "/date.fst," + ruleDir + "/number.fst," + ruleDir + "/phone.fst";
        OfflineTtsConfig cfg = new OfflineTtsConfig(
                mc,
                fsts,
                "",
                1,                          // maxNumSentences
                // 片段内部压紧（0.35）。停顿不靠这个倍率——它会把字间空隙
                // 一起放大，逗号永远显不出来；标点之间的停顿改由 synth()
                // 按类型插入，与桌面端 tts_server.py 的 PAUSE 表一致。
                0.35f);                     // silenceScale
        // ⚠️ 第一参数必须传 null。OfflineTts 的构造是
        //     OfflineTts(assetManager: AssetManager? = null, config)
        // native 侧 allocate() 见到 assetManager 非空就走 newFromAsset，把 model / lexicon /
        // tokens 全当「assets 内的相对路径」去 AAssetManager_open。我们是在首次启动时把模型
        // 解压到 getFilesDir() 再用绝对路径喂进去的，走 asset 分支必然找不到文件——
        // 而且这条路径不会抛 Java 异常，是 native 里直接 crash（实测 MIUI 上就是
        // 「N2 写下了、N3 永远没有」的闪退）。传 null 才会走 newFromFile，用绝对路径。
        mark("N2.5 准备 new OfflineTts " + modelPath);
        OfflineTts t = new OfflineTts(null, cfg);
        mark("N2.6 OfflineTts 建好");
        return t;
    }

    /** 载入默认音色（女主）。可重复调用，已载入则直接返回。 */
    public boolean load(Context ctx) {
        appCtx = ctx.getApplicationContext();
        diagCtx = appCtx;
        mark("N2.0 load 开始");
        return ensureGirl();
    }

    /* 小雅与超文共用的词表：单独一个 stamp，只解压 5 个文件（约 2 MB）。 */
    private String ensureWordDir() throws IOException {
        return ensureAssets(appCtx, GIRL_DIR, GIRL_DIR, WORD_FILES, "word");
    }

    private boolean ensureGirl() {
        if (girl != null) return true;
        if (appCtx == null) return false;
        loadLock.lock();
        try {
            if (girl != null) return true;
            String d = ensureAssets(appCtx, GIRL_DIR, GIRL_DIR, GIRL_ASSETS, "girl");
            mark("N2.4 女主模型已就位 size=" + new File(d, GIRL_MODEL).length() + " " + d);
            OfflineTts t = build(appCtx, d + "/" + GIRL_MODEL, d, "", d);
            int sr = t.sampleRate();
            mark("N2.7 sampleRate=" + sr);
            if (sr <= 0) {
                t.free();
                lastError = "girl sampleRate=0";
                return false;
            }
            girlRate = sr;
            girl = t;
            return true;
        } catch (Throwable e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            girl = null;
            return false;
        } finally {
            loadLock.unlock();
        }
    }

    /** 按需载入男主（第一次选 c0 时）。 */
    private boolean ensureBoy() {
        if (boy != null) return true;
        if (appCtx == null) return false;
        loadLock.lock();
        try {
            if (boy != null) return true;
            String w = ensureWordDir();
            String d = ensureAssets(appCtx, BOY_DIR, BOY_DIR, BOY_ASSETS, "boy");
            OfflineTts t = build(appCtx, d + "/" + BOY_MODEL, w, "", w);
            int sr = t.sampleRate();
            if (sr <= 0) {
                t.free();
                lastError = "boy sampleRate=0";
                return false;
            }
            boyRate = sr;
            boy = t;
            return true;
        } catch (Throwable e) {
            lastError = "boy: " + e.getClass().getSimpleName() + ": " + e.getMessage();
            boy = null;
            return false;
        } finally {
            loadLock.unlock();
        }
    }

    /** 按需载入配角库（第一次选 s* 时）。187 人共用一份模型，解压约 40 MB。
     *
     *  这一步是真机上最容易「点了没声音」的地方：要先把 51 MB（模型 + 词表 +
     *  jieba 词典）从 assets 解到 files，再建 38 MB int8 会话，中端手机首跑
     *  能到半分钟以上。所以除了这里按需加载，TtsBridge 还会在启动后主动
     *  preloadLib()，用户点声线时通常已经就绪。 */
    private boolean ensureLib() {
        if (lib != null) return true;
        if (appCtx == null) return false;
        loadLock.lock();
        try {
            if (lib != null) return true;
            long t0 = System.currentTimeMillis();
            String d = ensureAssets(appCtx, LIB_DIR, LIB_DIR, LIB_ASSETS, "lib");
            long tUnzip = System.currentTimeMillis();
            OfflineTts t = build(appCtx, d + "/" + LIB_MODEL, d, d + "/dict", "");
            int sr = t.sampleRate();
            if (sr <= 0) {
                t.free();
                lastError = "lib sampleRate=0";
                libErr = "会话建起来但采样率=0（解压 " + (tUnzip - t0) + "ms）";
                return false;
            }
            libRate = sr;
            lib = t;
            libMs = System.currentTimeMillis() - t0;
            libErr = "";
            mark("N2.9 配角库就位 解压=" + (tUnzip - t0) + "ms 总=" + libMs + "ms sr=" + sr);
            return true;
        } catch (Throwable e) {
            lastError = "lib: " + e.getClass().getSimpleName() + ": " + e.getMessage();
            libErr = e.getClass().getSimpleName() + ": " + e.getMessage();
            lib = null;
            return false;
        } finally {
            loadLock.unlock();
        }
    }

    /** 后台预载配角库：分角色朗读注定要用它，第一次用要解压 40 MB 再建会话。
     *
     *  放在「开始朗读」那一刻做，被开头几句旁白盖过去——不然第一个角色开口前
     *  要干等十几秒，听感就是「换声卡住了」。失败不影响听书，下次用到时再试。 */
    public void preloadLib() {
        if (lib != null || appCtx == null) return;
        try { ensureLib(); } catch (Throwable ignored) { }
    }

    /** 配角库是否已经可以用。 */
    public boolean libReady() {
        return lib != null;
    }

    /** 合成一句，返回 16-bit 单声道 WAV 字节；失败返回 null。
     *
     *  停顿不再交给引擎的单一倍率（它会把字间空隙一起放大，逗号永远显不出来），
     *  而是按人念书的规律切分，标点之间按类型插不同长度的静音。
     *  与桌面端 VoicePack/tts_server.py 的 PAUSE 表保持一致。 */
    public byte[] synth(String text, String voice, float speed) {
        return synth(text, voice, speed, Denoise.OFF);
    }

    /**
     * @param dn 男声降噪档位：Denoise.OFF / HARD / DD。只对男声生效，
     *           女声原样返回（一个采样都不碰），与桌面端行为一致。
     */
    public byte[] synth(String text, String voice, float speed, int dn) {
        if (text == null) return null;
        boolean useLib = isFanchen(voice);
        boolean useBoy = isBoy(voice);
        if (useLib) {
            if (lib == null && !ensureLib()) return null;
        } else if (useBoy) {
            if (boy == null && !ensureBoy()) return null;
        } else {
            if (girl == null && !ensureGirl()) return null;
        }
        OfflineTts tts = useLib ? lib : (useBoy ? boy : girl);
        if (tts == null) return null;
        int sid = useLib ? sidOf(voice) : 0;
        String s = text.trim();
        if (s.length() == 0) return null;
        if (s.length() > 600) s = s.substring(0, 600);
        if (speed < 0.5f) speed = 0.5f;
        if (speed > 2.0f) speed = 2.0f;
        final OfflineTts eng = tts;
        // 按模型分别加锁：旁白（女主 22k）与对白（配角库 16k）是两份独立会话，
        // 允许同时出音，换声那一句不必排在旁白后面等。
        final ReentrantLock elock = useLib ? libLock : (useBoy ? boyLock : girlLock);
        elock.lock();
        try {
            java.util.List<Unit> units = mergeShort(prosodySplit(s));
            if (units.isEmpty()) return null;

            java.util.ArrayList<float[]> parts = new java.util.ArrayList<>();
            java.util.ArrayList<Float> gaps = new java.util.ArrayList<>();
            int sr = useLib ? libRate : (useBoy ? boyRate : girlRate);

            // 模型常驻内存，每段只要几十毫秒，串行就够了（这个类本来也靠 lock 串行）。
            // 某段没出声时把它的文本连标点一起带到下一段重念，书里就不会出现空白。
            String carry = "";
            int genNull = 0;
            int retried = 0;
            float topPeak = 0f;
            for (Unit u : units) {
                String t = carry + u.text;
                GeneratedAudio a = eng.generate(t, sid, speed);
                float[] pcm = (a == null) ? null : a.getSamples();
                float pk = peakOf(pcm);
                /* 量化模型偶尔会吐出一段极轻、几乎只剩噪声的波形（ARM 上的 int8
                   卷积比 x86 更容易出这种情况）。以前这里靠 boostQuiet 放大几百倍
                   播出去，听感就是「几个字囫囵吞枣、听不清」。现在先重试一次——
                   VITS 内部带随机采样，同一句第二次通常就正常了；两次都轻就把这段
                   的字带到下一段重念，宁可少这一小截，也不播一串怪音。 */
                if (pcm != null && pcm.length > 0 && pk < QUIET_PEAK) {
                    GeneratedAudio a2 = eng.generate(t, sid, speed);
                    float[] p2 = (a2 == null) ? null : a2.getSamples();
                    float pk2 = peakOf(p2);
                    retried++;
                    if (pk2 > pk) {
                        a = a2;
                        pcm = p2;
                        pk = pk2;
                        if (a != null && a.getSampleRate() > 0) sr = a.getSampleRate();
                    }
                }
                if (pcm == null || pcm.length == 0) genNull++;
                if (pk > topPeak) topPeak = pk;
                // 门槛压到 0.0008：int8 量化模型偶尔给得很轻，按旧的 0.01 丢
                // 会把整段听书变成「没出声」；真有波形就抬起来播（见 boostQuiet）。
                if (pcm != null && pcm.length > 0 && pk >= 0.0008f) {
                    if (a.getSampleRate() > 0) sr = a.getSampleRate();
                    parts.add(trimSilence(boostQuiet(pcm), sr));
                    gaps.add(u.gap);
                    carry = "";
                } else {
                    carry = t + (u.punct == 0 ? "，" : String.valueOf(u.punct));
                }
            }
            if (!carry.isEmpty()) {
                GeneratedAudio a = eng.generate(carry, sid, speed);
                float[] pcm = (a == null) ? null : a.getSamples();
                float pk = (pcm == null || pcm.length == 0) ? 0f : peak(pcm);
                if (pk > topPeak) topPeak = pk;
                if (pcm != null && pcm.length > 0 && pk >= 0.0008f) {
                    if (a.getSampleRate() > 0) sr = a.getSampleRate();
                    parts.add(trimSilence(boostQuiet(pcm), sr));
                    gaps.add(0f);
                }
            }
            if (parts.isEmpty()) {
                lastError = "全段没出声（段数=" + units.size() + " 空返回=" + genNull
                        + " 重试=" + retried
                        + " 最高峰值=" + String.format(java.util.Locale.US, "%.5f", topPeak)
                        + " 采样率=" + sr + " 声线=" + sid + "）";
                return null;
            }

            int total = 0;
            for (int i = 0; i < parts.size(); i++) {
                total += parts.get(i).length;
                if (i < parts.size() - 1) total += gapSamples(gaps.get(i), sr);
            }
            float[] all = new float[total];
            int p = 0;
            for (int i = 0; i < parts.size(); i++) {
                float[] a2 = parts.get(i);
                fade(a2, sr);
                System.arraycopy(a2, 0, all, p, a2.length);
                p += a2.length;
                if (i < parts.size() - 1) {
                    int g = gapSamples(gaps.get(i), sr);
                    for (int k = 0; k < g; k++) {
                        all[p++] = (float) ((Math.random() - 0.5) * 0.0016);
                    }
                }
            }
            // 男声降噪：整段拼好再处理一次，段间过渡也一起照顾到。
            // 女声直接跳过——它的浊音段没有那层「沙沙」，处理只会白改音色。
            if (dn != Denoise.OFF && isMaleVoice(voice)) {
                all = Denoise.process(all, dn);
            }
            return wav(all, sr);
        } catch (Throwable e) {
            lastError = "合成异常 " + e.getClass().getSimpleName() + ": " + e.getMessage();
            return null;
        } finally {
            elock.unlock();
        }
    }

    /* ---------------- 韵律：停顿按标点分层 ---------------- */

    private static final String PUNCT = "，,、；;：:。！？!?…—～~";

    /* 只在句末标点处断段，逗号/顿号/冒号留在段内交给引擎自己停。
       原来按所有标点切，一句话被拆成一串 3~6 字的小块逐块合成再拼：
       每块首尾都要淡入淡出，音节边缘被削；短输入本身也是模型最不稳的区间。
       现在一段 = 一整句（超过 MAX_SEG 字才在逗号处兜底断开），拼接点少、
       语调连贯。 */
    private static final String HARD_STOP = "。！？!?；;….";
    private static final String SOFT_STOP = "，,、：:—～~";
    private static final int MAX_SEG = 34;

    private static final class Unit {
        String text;
        float gap;
        char punct;

        Unit(String t, float g, char pu) {
            text = t;
            gap = g;
            punct = pu;
        }
    }

    private static float pauseOf(char c) {
        switch (c) {
            case '、': return 0.28f;
            case '，': return 0.38f;
            case ',': return 0.34f;
            case '；': return 0.48f;
            case ';': return 0.44f;
            case '：': return 0.46f;
            case ':': return 0.42f;
            case '。': return 0.75f;
            case '.': return 0.72f;
            case '！': return 0.80f;
            case '!': return 0.76f;
            case '？': return 0.78f;
            case '?': return 0.74f;
            case '…': return 0.92f;
            case '—': return 0.58f;
            case '～':
            case '~': return 0.26f;
            default: return 0f;
        }
    }

    private static java.util.List<Unit> prosodySplit(String text) {
        java.util.ArrayList<Unit> out = new java.util.ArrayList<>();
        StringBuilder buf = new StringBuilder();
        int n = text.length();
        int i = 0;
        while (i < n) {
            char ch = text.charAt(i);
            if (ch == '\n') {
                String seg = buf.toString().trim();
                if (seg.length() > 0) out.add(new Unit(seg, 1.10f, '。'));
                buf.setLength(0);
                i++;
                continue;
            }
            // 小数点与时间里的冒号不是标点（3.5、12:30）
            if ((ch == '.' || ch == ':') && i > 0 && i < n - 1
                    && Character.isDigit(text.charAt(i - 1))
                    && Character.isDigit(text.charAt(i + 1))) {
                buf.append(ch);
                i++;
                continue;
            }
            if (HARD_STOP.indexOf(ch) >= 0) {
                int j = i;
                float gap = 0f;
                while (j < n && PUNCT.indexOf(text.charAt(j)) >= 0) {
                    float g = pauseOf(text.charAt(j));
                    if (g > gap) gap = g;
                    j++;
                }
                String seg = buf.toString().trim();
                if (seg.length() > 0) out.add(new Unit(seg, gap, text.charAt(j - 1)));
                buf.setLength(0);
                i = j;
                continue;
            }
            buf.append(ch);
            i++;
            // 长句保护：一段超过 MAX_SEG 字就在最近的一个句内标点处兜底断开，
            // 否则一句能有两百字，引擎念到后半段容易飘。
            if (SOFT_STOP.indexOf(ch) >= 0 && cjkLen(buf) >= MAX_SEG) {
                String seg2 = buf.toString().trim();
                if (seg2.length() > 0) out.add(new Unit(seg2, pauseOf(ch), ch));
                buf.setLength(0);
            }
        }
        String seg = buf.toString().trim();
        if (seg.length() > 0) out.add(new Unit(seg, 0f, (char) 0));
        return out;
    }

    /** 数一段文本里的汉字与数字个数（标点、空格不算）。长句保护用它。 */
    private static int cjkLen(CharSequence s) {
        int k = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if ((c >= '\u4e00' && c <= '\u9fff') || Character.isDigit(c)) k++;
        }
        return k;
    }

    /** 少于两个字的片段并进前一段，保留原标点。孤立的一两个字常常合成成静音。 */
    private static java.util.List<Unit> mergeShort(java.util.List<Unit> in) {
        java.util.ArrayList<Unit> out = new java.util.ArrayList<>();
        for (Unit u : in) {
            if (!out.isEmpty() && u.text.length() < 2) {
                Unit prev = out.get(out.size() - 1);
                prev.text = prev.text + (prev.punct == 0 ? '，' : prev.punct) + u.text;
                prev.gap = u.gap;
                prev.punct = u.punct;
            } else {
                out.add(u);
            }
        }
        while (out.size() > 1 && out.get(0).text.length() < 2) {
            Unit a = out.get(0);
            Unit b = out.get(1);
            a.text = a.text + (a.punct == 0 ? '，' : a.punct) + b.text;
            a.gap = b.gap;
            a.punct = b.punct;
            out.remove(1);
        }
        return out;
    }

    private static float peak(float[] a) {
        float m = 0f;
        for (float v : a) {
            float x = Math.abs(v);
            if (x > m) m = x;
        }
        return m;
    }

    /** 峰值，容忍 null / 空数组。 */
    private static float peakOf(float[] a) {
        return (a == null || a.length == 0) ? 0f : peak(a);
    }

    /* 正常朗读的峰值在 0.1~0.5。低于这个数说明这一小段「没念清」——多半是
       量化模型在 ARM 上偶发的极轻输出，靠放大救回来只会变成一串噪声。 */
    private static final float QUIET_PEAK = 0.02f;

    /** 引擎偶尔给出很轻的波形（int8 量化模型的通病）。峰值低于 0.02 时
     *  直接丢掉会变成「整段都没出声」，这里把它抬到 0.7 再拼，听感正常也听得见；
     *  本来就是静音（峰值近乎 0）的原样返回，抬也没意义。 */
    private static float[] boostQuiet(float[] pcm) {
        float pk = peak(pcm);
        if (pk >= 0.02f || pk < 0.0008f) return pcm;
        float g = 0.7f / pk;
        /* 放大倍数封顶 4 倍。原来不封顶，峰值 0.001 的段落会被放大 700 倍——
           那段如果只剩噪声，等于把噪声顶到正常音量播出去，就是「几个字糊成一团」。
           真正很轻的好音频（少量）在 4 倍内也能听清；超过 4 倍说明这段本来就废。 */
        if (g > 4f) g = 4f;
        float[] out = new float[pcm.length];
        for (int i = 0; i < pcm.length; i++) {
            float v = pcm[i] * g;
            out[i] = v > 1f ? 1f : (v < -1f ? -1f : v);
        }
        return out;
    }

    private static float rms(float[] a, int from, int len) {
        double s = 0;
        for (int i = from; i < from + len; i++) s += (double) a[i] * a[i];
        return (float) Math.sqrt(s / len);
    }

    /** 裁掉引擎在片段首尾自带的静音（实测首 0.1~0.2 秒、尾 0.1~0.4 秒）。 */
    private static float[] trimSilence(float[] pcm, int rate) {
        int win = Math.max(1, rate / 100);
        int n = pcm.length;
        if (n <= win * 2) return pcm;
        int first = -1;
        for (int i = 0; i + win <= n; i += win) {
            if (rms(pcm, i, win) >= 0.009f) {
                first = i;
                break;
            }
        }
        if (first < 0) return pcm;
        int last = n;
        for (int i = (n - win) / win * win; i >= 0; i -= win) {
            if (rms(pcm, i, win) >= 0.009f) {
                last = i + win;
                break;
            }
        }
        int s = Math.max(0, first - (int) (rate * 0.015f));
        int e = Math.min(n, last + (int) (rate * 0.030f));
        if (e - s <= win) return pcm;
        float[] r = new float[e - s];
        System.arraycopy(pcm, s, r, 0, e - s);
        return r;
    }

    /** 首尾渐入渐出，硬拼两段波形会有「咔」的一声。 */
    private static void fade(float[] a, int rate) {
        int cap = Math.max(1, a.length / 3);
        int ni = Math.min(Math.max(1, (int) (rate * 0.006f)), cap);
        int no = Math.min(Math.max(1, (int) (rate * 0.013f)), cap);
        for (int i = 0; i < ni; i++) a[i] *= i / (float) ni;
        for (int i = 0; i < no; i++) a[a.length - 1 - i] *= i / (float) no;
    }

    private static int gapSamples(float gap, int rate) {
        float g = Math.max(0.02f, gap - 0.045f);
        return (int) (rate * g);
    }

    /** float[-1,1] → 44 字节头 + PCM16 LE。 */
    private static byte[] wav(float[] pcm, int rate) {
        int n = pcm.length, dataLen = n * 2;
        byte[] out = new byte[44 + dataLen];
        putI32(out, 0, 0x46464952);              // "RIFF"
        putI32(out, 4, 36 + dataLen);
        putI32(out, 8, 0x45564157);              // "WAVE"
        putI32(out, 12, 0x20746d66);             // "fmt "
        putI32(out, 16, 16);
        putI16(out, 20, 1);                      // PCM
        putI16(out, 22, 1);                      // mono
        putI32(out, 24, rate);
        putI32(out, 28, rate * 2);               // byteRate
        putI16(out, 32, 2);                      // blockAlign
        putI16(out, 34, 16);                     // bits
        putI32(out, 36, 0x61746164);             // "data"
        putI32(out, 40, dataLen);
        int p = 44;
        for (int i = 0; i < n; i++) {
            float v = pcm[i];
            if (v > 1f) v = 1f;
            else if (v < -1f) v = -1f;
            int iv = (int) (v * 32767f);
            out[p++] = (byte) (iv & 0xff);
            out[p++] = (byte) ((iv >> 8) & 0xff);
        }
        return out;
    }

    private static void putI32(byte[] b, int o, int v) {
        b[o] = (byte) (v & 0xff);
        b[o + 1] = (byte) ((v >> 8) & 0xff);
        b[o + 2] = (byte) ((v >> 16) & 0xff);
        b[o + 3] = (byte) ((v >> 24) & 0xff);
    }

    private static void putI16(byte[] b, int o, int v) {
        b[o] = (byte) (v & 0xff);
        b[o + 1] = (byte) ((v >> 8) & 0xff);
    }

    public void close() {
        // 释放前必须把三把合成锁也拿住：另一条线程正在 generate 时 free，
        // native 侧立刻就是野指针，进程连异常都不给。
        loadLock.lock();
        girlLock.lock();
        boyLock.lock();
        libLock.lock();
        try {
            if (girl != null) {
                try { girl.free(); } catch (Throwable ignored) { }
                girl = null;
            }
            if (boy != null) {
                try { boy.free(); } catch (Throwable ignored) { }
                boy = null;
            }
            if (lib != null) {
                try { lib.free(); } catch (Throwable ignored) { }
                lib = null;
            }
        } finally {
            libLock.unlock();
            boyLock.unlock();
            girlLock.unlock();
            loadLock.unlock();
        }
    }
}

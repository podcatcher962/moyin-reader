package com.lanlan.moyinreader;

import android.content.Context;
import android.content.res.AssetManager;

import com.k2fsa.sherpa.onnx.GeneratedAudio;
import com.k2fsa.sherpa.onnx.OfflineTts;
import com.k2fsa.sherpa.onnx.OfflineTtsConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig;
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig;

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

    /* 模型换代了就换版本号，老用户首次启动会重新解压，不会拿旧文件跑新代码。 */
    private static final int MODEL_VER = 3;

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

    /** 用户逐条试听敲定的 21 个配角声线（与桌面端 curation 一致）。 */
    static final int[] CURATED_SID = {
            124, 74, 58, 156, 167, 52, 110, 102, 32,
            36, 169, 13, 149, 106, 19, 165, 129, 120, 20, 41, 105
    };
    static final String[] CURATED_LABEL = {
            "老生 · 低沉 1", "老生 · 低沉 2",
            "中年男 1", "中年男 2", "中年男 3",
            "青年男 1", "青年男 2", "青年男 3", "青年男 4",
            "沉稳女 1", "沉稳女 2",
            "成年女 1", "成年女 2", "成年女 3", "成年女 4", "成年女 5",
            "青年女 1", "青年女 2", "青年女 3",
            "童声 1", "童声 2"
    };

    /** 与桌面 tts_server.py 的 band_of 完全一致，195 Hz 是男女分界。
     *  41 号（童声 1）中位基频 251 Hz 会落进「女声 · 青年」，试听后单独指定档位。 */
    static String bandOf(int hz, int sid) {
        if (sid == 41) return "女声 · 高音";
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

    /** /health 的音色表：女主 1 + 男主 1 + 配角库 187。 */
    String healthJson(boolean engineOk) {
        int n = SID_F0.length + 2;
        StringBuilder sb = new StringBuilder(18432);
        sb.append("{\"ok\":").append(engineOk).append(",");
        sb.append("\"engine\":\"").append(engineOk ? "sherpa-onnx 2.0.1 · 安卓" : "模型加载中").append("\",");
        sb.append("\"ready\":").append(engineOk).append(",");
        sb.append("\"count\":").append(n).append(",");
        sb.append("\"version\":6,\"curated\":[\"").append(GIRL_VOICE).append("\",\"")
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

    private final ReentrantLock lock = new ReentrantLock();
    private Context appCtx;
    private OfflineTts girl;          // 女主，默认音色
    private OfflineTts boy;           // 男主，按需加载
    private OfflineTts lib;           // 配角库，按需加载
    private int girlRate = 22050;
    private int boyRate = 22050;
    private int libRate = 16000;
    private String lastError = "";

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
        OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig(
                modelPath,                  // model
                wordDir + "/lexicon.txt",   // lexicon
                wordDir + "/tokens.txt",    // tokens
                "",                         // dataDir
                dictDir,                    // dictDir：配角库带 jieba 分词表
                0.667f,                     // noiseScale
                0.8f,                       // noiseScaleW
                1.0f);                      // lengthScale
        OfflineTtsModelConfig mc = new OfflineTtsModelConfig(
                vits, null, null, null, null, null, null,
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
        return new OfflineTts(ctx.getAssets(), cfg);
    }

    /** 载入默认音色（女主）。可重复调用，已载入则直接返回。 */
    public boolean load(Context ctx) {
        appCtx = ctx.getApplicationContext();
        return ensureGirl();
    }

    /* 小雅与超文共用的词表：单独一个 stamp，只解压 5 个文件（约 2 MB）。 */
    private String ensureWordDir() throws IOException {
        return ensureAssets(appCtx, GIRL_DIR, GIRL_DIR, WORD_FILES, "word");
    }

    private boolean ensureGirl() {
        if (girl != null) return true;
        if (appCtx == null) return false;
        lock.lock();
        try {
            if (girl != null) return true;
            String d = ensureAssets(appCtx, GIRL_DIR, GIRL_DIR, GIRL_ASSETS, "girl");
            OfflineTts t = build(appCtx, d + "/" + GIRL_MODEL, d, "", d);
            int sr = t.sampleRate();
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
            lock.unlock();
        }
    }

    /** 按需载入男主（第一次选 c0 时）。 */
    private boolean ensureBoy() {
        if (boy != null) return true;
        if (appCtx == null) return false;
        lock.lock();
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
            lock.unlock();
        }
    }

    /** 按需载入配角库（第一次选 s* 时）。187 人共用一份模型，解压约 40 MB。 */
    private boolean ensureLib() {
        if (lib != null) return true;
        if (appCtx == null) return false;
        lock.lock();
        try {
            if (lib != null) return true;
            String d = ensureAssets(appCtx, LIB_DIR, LIB_DIR, LIB_ASSETS, "lib");
            OfflineTts t = build(appCtx, d + "/" + LIB_MODEL, d, d + "/dict", "");
            int sr = t.sampleRate();
            if (sr <= 0) {
                t.free();
                lastError = "lib sampleRate=0";
                return false;
            }
            libRate = sr;
            lib = t;
            return true;
        } catch (Throwable e) {
            lastError = "lib: " + e.getClass().getSimpleName() + ": " + e.getMessage();
            lib = null;
            return false;
        } finally {
            lock.unlock();
        }
    }

    /** 合成一句，返回 16-bit 单声道 WAV 字节；失败返回 null。
     *
     *  停顿不再交给引擎的单一倍率（它会把字间空隙一起放大，逗号永远显不出来），
     *  而是按人念书的规律切分，标点之间按类型插不同长度的静音。
     *  与桌面端 VoicePack/tts_server.py 的 PAUSE 表保持一致。 */
    public byte[] synth(String text, String voice, float speed) {
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
        lock.lock();
        try {
            java.util.List<Unit> units = mergeShort(prosodySplit(s));
            if (units.isEmpty()) return null;

            java.util.ArrayList<float[]> parts = new java.util.ArrayList<>();
            java.util.ArrayList<Float> gaps = new java.util.ArrayList<>();
            int sr = useLib ? libRate : (useBoy ? boyRate : girlRate);

            // 模型常驻内存，每段只要几十毫秒，串行就够了（这个类本来也靠 lock 串行）。
            // 某段没出声时把它的文本连标点一起带到下一段重念，书里就不会出现空白。
            String carry = "";
            for (Unit u : units) {
                String t = carry + u.text;
                GeneratedAudio a = eng.generate(t, sid, speed);
                float[] pcm = (a == null) ? null : a.getSamples();
                if (pcm != null && pcm.length > 0 && peak(pcm) >= 0.01f) {
                    if (a.getSampleRate() > 0) sr = a.getSampleRate();
                    parts.add(trimSilence(pcm, sr));
                    gaps.add(u.gap);
                    carry = "";
                } else {
                    carry = t + (u.punct == 0 ? "，" : String.valueOf(u.punct));
                }
            }
            if (!carry.isEmpty()) {
                GeneratedAudio a = eng.generate(carry, sid, speed);
                float[] pcm = (a == null) ? null : a.getSamples();
                if (pcm != null && pcm.length > 0 && peak(pcm) >= 0.01f) {
                    if (a.getSampleRate() > 0) sr = a.getSampleRate();
                    parts.add(trimSilence(pcm, sr));
                    gaps.add(0f);
                }
            }
            if (parts.isEmpty()) return null;

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
            return wav(all, sr);
        } catch (Throwable e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            return null;
        } finally {
            lock.unlock();
        }
    }

    /* ---------------- 韵律：停顿按标点分层 ---------------- */

    private static final String PUNCT = "，,、；;：:。！？!?…—～~";

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
            if (PUNCT.indexOf(ch) >= 0) {
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
        }
        String seg = buf.toString().trim();
        if (seg.length() > 0) out.add(new Unit(seg, 0f, (char) 0));
        return out;
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
        lock.lock();
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
            lock.unlock();
        }
    }
}

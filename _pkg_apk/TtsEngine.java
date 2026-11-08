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
 * 两套模型并存，与桌面端 VoicePack/tts_server.py 的编排一致：
 *   · 小雅（默认，x0）：Piper 中文单说话人 VITS，22.05 kHz。只有一个女声，
 *     但采样率是 AISHELL3 的近三倍，齿音、气口、尾音收束都在。
 *   · AISHELL3 音色库（s0…s173）：174 个说话人共用一份 8 位量化模型（14 MB），
 *     靠 sid 切声线，体积不随音色数量增长。量化版推理慢，只当换口味用。
 *
 * 模型放在 apk 的 assets 里，首次启动解压到应用私有目录，之后直接用绝对路径，
 * onnxruntime 可以正常 mmap，不必每次把几十 MB 读进内存。
 */
public final class TtsEngine {

    /** 主模型（小雅）：音色 key 固定 x0，不分说话人。 */
    static final String MAIN_ASSET_DIR = "tts/xiaoya";
    static final String MAIN_FILE_DIR = "tts/xiaoya";
    static final String MAIN_MODEL = "zh_CN-xiao_ya-medium.onnx";
    static final String MAIN_VOICE = "x0";
    static final String MAIN_LABEL = "墨吟 · 中文女声";
    static final int MAIN_F0 = 259;
    static final String[] MAIN_ASSETS = {
            MAIN_MODEL, "lexicon.txt", "tokens.txt",
            "date.fst", "number.fst", "phone.fst"
    };

    /** 备用音色库（AISHELL3 量化版）：音色 key s0…s173。 */
    static final String LEGACY_ASSET_DIR = "tts/aishell3";
    static final String LEGACY_FILE_DIR = "tts/aishell3";
    static final String LEGACY_MODEL = "model.int8.onnx";
    static final String[] LEGACY_ASSETS = {
            LEGACY_MODEL, "lexicon.txt", "tokens.txt",
            "date.fst", "number.fst", "phone.fst"
    };

    private static final int MODEL_VER = 2;

    /** sid → 中位基频（Hz），离线逐人实测。手机端与桌面共用同一份分组依据。 */
    static final int[] SID_F0 = {
            250, 258, 235, 242, 211, 296, 242, 205, 258, 235, 143, 242,
            235, 200, 276, 154, 242, 258, 229, 222, 258, 143, 250, 205,
            222, 154, 250, 205, 258, 195, 222, 267, 174, 296, 258, 229,
            200, 235, 222, 296, 145, 242, 296, 258, 286, 286, 140, 205,
            186, 276, 267, 258, 154, 267, 250, 205, 229, 211, 138, 200,
            143, 229, 235, 250, 250, 182, 320, 258, 267, 127, 195, 235,
             91, 267, 108, 163, 148, 235, 276, 242, 195, 235, 200, 178,
            235, 258, 267, 242, 211, 267, 242, 258, 286, 229, 222, 148,
            211, 258, 140, 229, 138, 229, 170, 258, 229, 276, 235, 154,
            235, 258, 129, 276, 258, 205, 222, 296, 296, 258, 267, 119,
            258, 286, 250, 242, 113, 286, 242, 276, 267, 235, 250, 229,
            267, 235, 258, 222, 119, 267, 222, 250, 186, 235, 250, 174,
            200, 250, 250, 235, 186, 222, 258, 182, 267, 148, 267, 250,
            157, 267, 229, 250, 242, 276, 205, 136, 242, 235, 250, 154,
            267, 195, 258, 174, 258, 276,
    };

    /** 人工挑过、命名过的 11 个声线，列表里排最前（与桌面端 curation 一致）。 */
    static final int[] CURATED_SID = {12, 35, 140, 160, 170, 20, 3, 9, 6, 150, 110};
    static final String[] CURATED_LABEL = {
            "声线 12 · 温润", "声线 35 · 柔和", "声线 140 · 舒展", "声线 160 · 清亮",
            "声线 170 · 明快", "声线 20 · 爽朗", "声线 3 · 甜美", "声线 9 · 清脆",
            "声线 6 · 沉静", "声线 150 · 明亮", "声线 110 · 沉稳男声"
    };

    /** 与桌面 tts_server.py 的 band_of 完全一致，同一批音色在两端分档相同。 */
    static String bandOf(int hz) {
        if (hz < 120) return "男声 · 低沉";
        if (hz < 145) return "男声 · 中音";
        if (hz < 165) return "男声 · 偏亮";
        if (hz < 200) return "女声 · 偏沉";
        if (hz < 235) return "女声 · 中音";
        if (hz < 265) return "女声 · 清亮";
        return "女声 · 高音";
    }

    static String labelOf(int sid) {
        for (int i = 0; i < CURATED_SID.length; i++) {
            if (CURATED_SID[i] == sid) return CURATED_LABEL[i];
        }
        return sid + " 号";
    }

    /** 解析 "s12" / "12" / ""，非法一律回落到 s12。 */
    static int sidOf(String voice) {
        if (voice == null) return 12;
        String v = voice.trim();
        if (v.startsWith("s") || v.startsWith("S")) v = v.substring(1);
        try {
            int sid = Integer.parseInt(v);
            if (sid >= 0 && sid < SID_F0.length) return sid;
        } catch (Exception ignored) { }
        return 12;
    }

    /** 该音色是否走 AISHELL3 音色库（s0…s173）；其余一律走小雅。 */
    static boolean isLegacy(String voice) {
        if (voice == null) return false;
        String v = voice.trim();
        return v.startsWith("s") || v.startsWith("S");
    }

    /** /health 的音色表：小雅 1 个 + 音色库 174 个。 */
    String healthJson(boolean engineOk) {
        int n = SID_F0.length + 1;
        StringBuilder sb = new StringBuilder(18432);
        sb.append("{\"ok\":").append(engineOk).append(",");
        sb.append("\"engine\":\"").append(engineOk ? "sherpa-onnx 2.0.1 · 安卓" : "模型加载中").append("\",");
        sb.append("\"ready\":").append(engineOk).append(",");
        sb.append("\"count\":").append(n).append(",");
        sb.append("\"version\":4,\"curated\":[\"").append(MAIN_VOICE).append("\"");
        for (int i = 0; i < CURATED_SID.length; i++) {
            sb.append(",\"s").append(CURATED_SID[i]).append("\"");
        }
        sb.append("],\"voices\":{\"").append(MAIN_VOICE).append("\":").append(engineOk);
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":").append(engineOk);
        }
        sb.append("},\"labels\":{\"").append(MAIN_VOICE).append("\":\"").append(MAIN_LABEL).append("\",");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":\"").append(labelOf(i)).append("\"");
        }
        sb.append("},\"groups\":{\"").append(MAIN_VOICE).append("\":\"").append(bandOf(MAIN_F0)).append("\",");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":\"").append(bandOf(SID_F0[i])).append("\"");
        }
        sb.append("},\"f0\":{\"").append(MAIN_VOICE).append("\":").append(MAIN_F0).append(",");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":").append(SID_F0[i]);
        }
        sb.append("}}");
        return sb.toString();
    }

    private final ReentrantLock lock = new ReentrantLock();
    private Context appCtx;
    private OfflineTts main;          // 小雅，默认音色
    private OfflineTts legacy;        // AISHELL3 音色库，按需加载
    private int mainRate = 22050;
    private int legacyRate = 8000;
    private String lastError = "";

    /** 只要能合成就算就绪（主模型装好即可，音色库缺了不影响听书）。 */
    public boolean ready() {
        return main != null || legacy != null;
    }

    /** 默认音色的采样率，供 JS 侧初始化时用。 */
    public int sampleRate() {
        return main != null ? mainRate : legacyRate;
    }

    public String lastError() {
        return lastError;
    }

    public static String mainVoice() {
        return MAIN_VOICE;
    }

    /** 解压模型目录；已解压过且版本一致就直接返回。 */
    private String ensureAssets(Context ctx, String assetDir, String fileDir,
                                String[] files) throws IOException {
        File base = new File(ctx.getFilesDir(), fileDir);
        File stamp = new File(base, ".v" + MODEL_VER);
        if (stamp.isFile()) return base.getAbsolutePath();
        if (!base.isDirectory() && !base.mkdirs()) {
            throw new IOException("mkdir failed: " + base);
        }
        AssetManager am = ctx.getAssets();
        for (String name : files) {
            File out = new File(base, name);
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

    private OfflineTts build(Context ctx, String d, String model) {
        OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig(
                d + "/" + model,            // model
                d + "/lexicon.txt",         // lexicon
                d + "/tokens.txt",          // tokens
                "",                         // dataDir
                "",                         // dictDir
                0.667f,                     // noiseScale
                0.8f,                       // noiseScaleW
                1.0f);                      // lengthScale
        OfflineTtsModelConfig mc = new OfflineTtsModelConfig(
                vits, null, null, null, null, null, null,
                2,                          // numThreads
                false,                      // debug
                "cpu");                     // provider
        OfflineTtsConfig cfg = new OfflineTtsConfig(
                mc,
                d + "/date.fst," + d + "/number.fst," + d + "/phone.fst",
                "",
                1,                          // maxNumSentences
                // 片段内部压紧（0.35）。停顿不靠这个倍率——它会把字间空隙
                // 一起放大，逗号永远显不出来；标点之间的停顿改由 synth()
                // 按类型插入，与桌面端 tts_server.py 的 PAUSE 表一致。
                0.35f);                     // silenceScale
        return new OfflineTts(ctx.getAssets(), cfg);
    }

    /** 载入默认音色（小雅）。可重复调用，已载入则直接返回。 */
    public boolean load(Context ctx) {
        appCtx = ctx.getApplicationContext();
        if (main != null) return true;
        lock.lock();
        try {
            if (main != null) return true;
            String d = ensureAssets(ctx, MAIN_ASSET_DIR, MAIN_FILE_DIR, MAIN_ASSETS);
            OfflineTts t = build(ctx, d, MAIN_MODEL);
            int sr = t.sampleRate();
            if (sr <= 0) {
                t.free();
                lastError = "sampleRate=0";
                return false;
            }
            mainRate = sr;
            main = t;
            return true;
        } catch (Throwable e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            main = null;
            return false;
        } finally {
            lock.unlock();
        }
    }

    /** 按需载入音色库（第一次选 s* 时）。调用方可能已持有 lock，可重入。 */
    private boolean ensureLegacy() {
        if (legacy != null) return true;
        if (appCtx == null) return false;
        lock.lock();
        try {
            if (legacy != null) return true;
            String d = ensureAssets(appCtx, LEGACY_ASSET_DIR, LEGACY_FILE_DIR,
                    LEGACY_ASSETS);
            OfflineTts t = build(appCtx, d, LEGACY_MODEL);
            int sr = t.sampleRate();
            if (sr <= 0) {
                t.free();
                lastError = "legacy sampleRate=0";
                return false;
            }
            legacyRate = sr;
            legacy = t;
            return true;
        } catch (Throwable e) {
            lastError = "audio library: " + e.getClass().getSimpleName()
                    + ": " + e.getMessage();
            legacy = null;
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
        boolean lib = isLegacy(voice);
        OfflineTts tts = lib ? legacy : main;
        if (tts == null && lib && !ensureLegacy()) return null;
        tts = lib ? legacy : main;
        if (tts == null) return null;
        int sid = lib ? sidOf(voice) : 0;
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
            int sr = lib ? legacyRate : mainRate;

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
            if (main != null) {
                try { main.free(); } catch (Throwable ignored) { }
                main = null;
            }
            if (legacy != null) {
                try { legacy.free(); } catch (Throwable ignored) { }
                legacy = null;
            }
        } finally {
            lock.unlock();
        }
    }
}

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
 * 复用桌面端那套 sherpa-onnx + AISHELL3 中文多说话人 VITS 模型：
 * 同一份 30 MB 模型内含 174 个说话人，靠 sid 切声线，所以体积不随音色增长。
 *
 * 模型放在 apk 的 assets 里，首次启动解压到应用私有目录，之后直接用绝对路径，
 * onnxruntime 可以正常 mmap，不必每次把 30 MB 读进内存。
 */
public final class TtsEngine {

    public static final String[] ASSETS = {
            "model.onnx", "lexicon.txt", "tokens.txt",
            "date.fst", "number.fst", "phone.fst"
    };
    private static final String ASSET_DIR = "tts/aishell3";
    private static final int MODEL_VER = 1;

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

    /** /health 的音色表：174 个音色共用一份模型，所以全部报就绪。 */
    String healthJson(boolean engineOk) {
        StringBuilder sb = new StringBuilder(16384);
        sb.append("{\"ok\":").append(engineOk).append(",");
        sb.append("\"engine\":\"").append(engineOk ? "sherpa-onnx 2.0.1 · 安卓" : "模型加载中").append("\",");
        sb.append("\"ready\":").append(engineOk).append(",");
        sb.append("\"count\":").append(SID_F0.length).append(",");
        sb.append("\"version\":3,\"curated\":[");
        for (int i = 0; i < CURATED_SID.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(CURATED_SID[i]).append("\"");
        }
        sb.append("],\"voices\":{");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":").append(engineOk);
        }
        sb.append("},\"labels\":{");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":\"").append(labelOf(i)).append("\"");
        }
        sb.append("},\"groups\":{");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":\"").append(bandOf(SID_F0[i])).append("\"");
        }
        sb.append("},\"f0\":{");
        for (int i = 0; i < SID_F0.length; i++) {
            if (i > 0) sb.append(',');
            sb.append("\"s").append(i).append("\":").append(SID_F0[i]);
        }
        sb.append("}}");
        return sb.toString();
    }

    private final ReentrantLock lock = new ReentrantLock();
    private OfflineTts tts;
    private int rate = 22050;
    private String dir;
    private String lastError = "";

    /** 当前是否已经能合成。 */
    public boolean ready() {
        return tts != null;
    }

    public int sampleRate() {
        return rate;
    }

    public String lastError() {
        return lastError;
    }

    /** 解压模型目录；已解压过且版本一致就直接返回。 */
    private String ensureModel(Context ctx) throws IOException {
        File base = new File(ctx.getFilesDir(), "tts/aishell3");
        File stamp = new File(base, ".v" + MODEL_VER);
        if (stamp.isFile()) return base.getAbsolutePath();
        if (!base.isDirectory() && !base.mkdirs()) {
            throw new IOException("mkdir failed: " + base);
        }
        AssetManager am = ctx.getAssets();
        for (String name : ASSETS) {
            File out = new File(base, name);
            InputStream in = am.open(ASSET_DIR + "/" + name);
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

    /** 载入模型。可重复调用，已载入则直接返回。 */
    public boolean load(Context ctx) {
        if (tts != null) return true;
        lock.lock();
        try {
            if (tts != null) return true;
            dir = ensureModel(ctx);
            String d = dir;
            OfflineTtsVitsModelConfig vits = new OfflineTtsVitsModelConfig(
                    d + "/model.onnx",          // model
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
                    0.2f);                      // silenceScale
            OfflineTts t = new OfflineTts(ctx.getAssets(), cfg);
            rate = t.sampleRate();
            if (rate <= 0) {
                t.free();
                lastError = "sampleRate=0";
                return false;
            }
            tts = t;
            return true;
        } catch (Throwable e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            tts = null;
            return false;
        } finally {
            lock.unlock();
        }
    }

    /** 合成一句，返回 16-bit 单声道 WAV 字节；失败返回 null。 */
    public byte[] synth(String text, int sid, float speed) {
        if (tts == null || text == null) return null;
        String s = text.trim();
        if (s.length() == 0) return null;
        if (s.length() > 600) s = s.substring(0, 600);
        if (speed < 0.5f) speed = 0.5f;
        if (speed > 2.0f) speed = 2.0f;
        lock.lock();
        try {
            GeneratedAudio a = tts.generate(s, sid, speed);
            if (a == null) return null;
            float[] pcm = a.getSamples();
            if (pcm == null || pcm.length == 0) return null;
            return wav(pcm, a.getSampleRate());
        } catch (Throwable e) {
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            return null;
        } finally {
            lock.unlock();
        }
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
            if (tts != null) {
                try { tts.free(); } catch (Throwable ignored) { }
                tts = null;
            }
        } finally {
            lock.unlock();
        }
    }
}

package com.lanlan.moyinreader;

import java.util.Arrays;

/**
 * 墨吟 · 男声降噪（安卓端）
 *
 * 与桌面端 VoicePack/denoise.py 一一对应，参数、窗长、跳距全部照抄，
 * 目的是两端听感一致。两个模式：
 *
 *   HARD 经典谱减：过减 1.2、增益下限 0.12。无跨帧状态，纯函数，
 *        所以 Java 重写后能和 Python 逐采样对齐——这是默认选它的原因。
 *   DD   判决导向维纳：dd=0.98、下限 0.10。为保住字头（清辅音）设计，
 *        字更清楚但压得稍轻。带跨帧状态，首帧初始化必须与 Python 一致。
 *
 * 不要补高频。5~8 kHz 是齿音区，这个模型在那儿几乎没有语音成分，
 * 抬起来只会把残余噪声和齿音一起放大，听感是「擦擦擦」。（实测三档全废）
 *
 * 只在男声上调用；女声原样返回，一个采样都不碰。
 */
final class Denoise {

    static final int OFF = 0;
    static final int HARD = 1;
    static final int DD = 2;

    private static final int NFFT = 1024;
    private static final int HOP = 256;

    /** 周期 Hann 窗，等价于 numpy.hanning(1025)[:-1] */
    private static final float[] WIN = new float[NFFT];

    static {
        for (int i = 0; i < NFFT; i++) {
            WIN[i] = (float) (0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / NFFT)));
        }
    }

    private Denoise() {
    }

    /**
     * 处理一整段 PCM。
     *
     * @param x    单声道 float [-1,1]，会被原地修改后返回（长度不变）
     * @param mode OFF / HARD / DD
     */
    static float[] process(float[] x, int mode) {
        if (x == null || x.length < 1024 || mode == OFF) return x;
        try {
            float[] y = (mode == DD) ? wienerDd(x) : wienerHard(x);
            // 极少数片段处理后过冲：整体缩一点，不硬削
            float peak = 0f;
            for (float v : y) {
                float a = Math.abs(v);
                if (a > peak) peak = a;
            }
            if (peak > 1.0f) {
                float k = 1.0f / peak;
                for (int i = 0; i < y.length; i++) y[i] *= k;
            }
            return y;
        } catch (Throwable e) {
            return x;                 // 降噪出任何问题都不能影响朗读本身
        }
    }

    /* ---------------- 两种算法 ---------------- */

    private static float[] wienerHard(float[] x) {
        Frame f = stft(x);
        int frames = f.frames;
        int bins = NFFT / 2 + 1;

        // 噪声底：每频点取时间轴 12% 分位
        float[] noise = new float[bins];
        float[] col = new float[frames];
        for (int b = 0; b < bins; b++) {
            for (int t = 0; t < frames; t++) col[t] = f.re[t][b] * f.re[t][b] + f.im[t][b] * f.im[t][b];
            noise[b] = percentile(col, 0.12f);
        }

        float[][] gain = new float[frames][bins];
        for (int t = 0; t < frames; t++) {
            for (int b = 0; b < bins; b++) {
                float p = f.re[t][b] * f.re[t][b] + f.im[t][b] * f.im[t][b];
                float g = (p - 1.2f * noise[b]) / Math.max(p, 1e-12f);
                if (g < 0.12f) g = 0.12f;
                if (g > 1f) g = 1f;
                gain[t][b] = (float) Math.sqrt(g);
            }
        }
        smooth(gain);
        return istft(f, gain, x.length);
    }

    private static float[] wienerDd(float[] x) {
        final float dd = 0.98f, floor = 0.10f;
        Frame f = stft(x);
        int frames = f.frames;
        int bins = NFFT / 2 + 1;

        float[] noise = new float[bins];
        float[] col = new float[frames];
        for (int b = 0; b < bins; b++) {
            for (int t = 0; t < frames; t++) col[t] = f.re[t][b] * f.re[t][b] + f.im[t][b] * f.im[t][b];
            noise[b] = percentile(col, 0.12f);
        }

        float[][] gain = new float[frames][bins];
        float[] pg = new float[bins];
        float[] pgamma = new float[bins];
        Arrays.fill(pg, 1f);
        Arrays.fill(pgamma, 1f);
        float[] g = new float[bins];
        for (int t = 0; t < frames; t++) {
            for (int b = 0; b < bins; b++) {
                float p = f.re[t][b] * f.re[t][b] + f.im[t][b] * f.im[t][b];
                float gamma = p / Math.max(noise[b], 1e-12f);
                float xi = dd * pg[b] * pg[b] * pgamma[b] + (1f - dd) * Math.max(gamma - 1f, 0f);
                float v = xi / (1f + xi);
                if (v < floor) v = floor;
                if (v > 1f) v = 1f;
                g[b] = v;
                gain[t][b] = (float) Math.sqrt(v);
                pgamma[b] = gamma;
            }
            // 下一帧的 pg 用这一帧的增益（不取平方根，与 Python 的 G 一致）
            System.arraycopy(g, 0, pg, 0, bins);
        }
        smooth(gain);
        return istft(f, gain, x.length);
    }

    /* ---------------- STFT / iSTFT ---------------- */

    private static final class Frame {
        int frames;
        float[][] re;
        float[][] im;
    }

    private static Frame stft(float[] x) {
        int pad = NFFT;
        int len = x.length + pad * 3;             // 前 pad、后 2*pad，与 numpy 版一致
        float[] xp = new float[len];
        System.arraycopy(x, 0, xp, pad, x.length);
        int frames = 1 + (len - NFFT) / HOP;
        Frame f = new Frame();
        f.frames = frames;
        f.re = new float[frames][];
        f.im = new float[frames][];
        float[] buf = new float[NFFT];
        for (int t = 0; t < frames; t++) {
            int s = t * HOP;
            for (int i = 0; i < NFFT; i++) buf[i] = xp[s + i] * WIN[i];
            float[][] z = fft(buf);
            f.re[t] = z[0];
            f.im[t] = z[1];
        }
        return f;
    }

    private static float[] istft(Frame f, float[][] gain, int length) {
        int bins = NFFT / 2 + 1;
        int outLen = (f.frames - 1) * HOP + NFFT;
        float[] out = new float[outLen];
        float[] wsum = new float[outLen];
        float[] re = new float[bins];
        float[] im = new float[bins];
        for (int t = 0; t < f.frames; t++) {
            for (int b = 0; b < bins; b++) {
                float g = gain[t][b];
                re[b] = f.re[t][b] * g;
                im[b] = f.im[t][b] * g;
            }
            float[] seg = ifft(re, im);
            int s = t * HOP;
            for (int i = 0; i < NFFT; i++) {
                out[s + i] += seg[i] * WIN[i];
                wsum[s + i] += WIN[i] * WIN[i];
            }
        }
        // 与 numpy 版一致：取 [NFFT, NFFT+length)
        float[] y = new float[length];
        for (int i = 0; i < length; i++) {
            int k = i + NFFT;
            float w = wsum[k];
            y[i] = (w > 1e-8f) ? out[k] / w : 0f;
        }
        return y;
    }

    /** 沿频率轴 1-2-1 平滑，压掉谱减特有的「音乐噪声」尖刺。 */
    private static void smooth(float[][] g) {
        int bins = g[0].length;
        float[] tmp = new float[bins];
        for (float[] row : g) {
            System.arraycopy(row, 0, tmp, 0, bins);
            for (int b = 1; b < bins - 1; b++) {
                row[b] = (tmp[b - 1] + 2f * tmp[b] + tmp[b + 1]) / 4f;
            }
        }
    }

    /* ---------------- 数值工具 ---------------- */

    /** 线性插值分位数，对齐 numpy.percentile 默认行为。 */
    private static float percentile(float[] v, float q) {
        int n = v.length;
        if (n == 0) return 0f;
        float[] c = new float[n];
        System.arraycopy(v, 0, c, 0, n);
        Arrays.sort(c);
        float pos = q * (n - 1);
        int i = (int) Math.floor(pos);
        float frac = pos - i;
        if (i + 1 < n) return c[i] * (1f - frac) + c[i + 1] * frac;
        return c[i];
    }

    /** 迭代 radix-2 复数 FFT（原地位反转 + 蝶形）。返回 {re, im}。 */
    private static float[][] fft(float[] in) {
        int n = in.length;
        float[] re = new float[n];
        float[] im = new float[n];
        System.arraycopy(in, 0, re, 0, n);
        fftInPlace(re, im, false);
        return new float[][]{re, im};
    }

    /** 由半谱重建 n 点时域信号（实部对称填充）。 */
    private static float[] ifft(float[] reHalf, float[] imHalf) {
        int n = NFFT;
        float[] re = new float[n];
        float[] im = new float[n];
        int bins = n / 2 + 1;
        for (int i = 0; i < bins; i++) {
            re[i] = reHalf[i];
            im[i] = imHalf[i];
        }
        for (int i = 1; i < n / 2; i++) {
            re[n - i] = reHalf[i];
            im[n - i] = -imHalf[i];
        }
        fftInPlace(re, im, true);
        return re;
    }

    private static void fftInPlace(float[] re, float[] im, boolean inverse) {
        int n = re.length;
        for (int i = 1, j = 0; i < n; i++) {
            int bit = n >> 1;
            for (; (j & bit) != 0; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) {
                float tr = re[i]; re[i] = re[j]; re[j] = tr;
                float ti = im[i]; im[i] = im[j]; im[j] = ti;
            }
        }
        for (int len = 2; len <= n; len <<= 1) {
            double ang = 2 * Math.PI / len * (inverse ? 1 : -1);
            float wr = (float) Math.cos(ang), wi = (float) Math.sin(ang);
            for (int i = 0; i < n; i += len) {
                float cr = 1f, ci = 0f;
                for (int k = 0; k < len / 2; k++) {
                    int a = i + k, b = i + k + len / 2;
                    float xr = re[b] * cr - im[b] * ci;
                    float xi = re[b] * ci + im[b] * cr;
                    re[b] = re[a] - xr;
                    im[b] = im[a] - xi;
                    re[a] += xr;
                    im[a] += xi;
                    float ncr = cr * wr - ci * wi;
                    ci = cr * wi + ci * wr;
                    cr = ncr;
                }
            }
        }
        if (inverse) {
            float k = 1f / n;
            for (int i = 0; i < n; i++) {
                re[i] *= k;
                im[i] *= k;
            }
        }
    }
}

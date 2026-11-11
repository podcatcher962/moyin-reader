# -*- coding: utf-8 -*-
"""男声降噪：两个可选算法，参数与试听样本完全一致。

为什么要有这个东西
    男声主角模型（chaowen / 22.05 kHz）的浊音段自带约 3~4 dB 的噪声成分，
    表现为字与字之间的「沙沙」。女声模型没有这个问题，所以只对男声启用。
    客观指标 HNR 测不出改善（试过谱减、低通、提亮，HNR 都停在 4.5 dB），
    但人耳主观差异明显 —— 所以这里的参数是按试听定下来的，不是按指标算的。

两个模式（页面里可切，默认 A）
    A = hard   经典谱减：过减系数 1.2、增益下限 0.12，无跨帧状态。
               干净程度最好，代价是个别字偏糊、整体略闷。
    B = dd     判决导向（decision-directed）维纳：弱清音帧快跟、强语音帧平滑，
               为保字头设计。字更清楚，实现带跨帧状态。

工程上的取舍
    A 是无状态纯函数，安卓 Java 重写后能与桌面逐采样一致；
    B 带跨帧记忆，首帧初始化或帧边界稍有不一致就会在句首走偏。
    这也是默认选 A 的原因。

不要做的事
    不要再补高频。5~8 kHz 是齿音区，这个模型在那儿几乎没有语音成分，
    抬 4.5/6.5/8.5 dB 试过三档，听感全部变成「擦擦擦」。
    这个模型的「闷」补不出来，只能选干净或选不闷。
"""
import array
import io
import wave

import numpy as np

N_FFT = 1024
HOP = 256
WIN = np.hanning(N_FFT + 1)[:-1].astype(np.float32)

MODE_OFF = 0
MODE_HARD = 1
MODE_DD = 2

# 男声判定：基频低于这个值才处理。195 Hz 与 band_of() 的男女分界一致。
MALE_MAX_F0 = 195


def _stft(x):
    xp = np.pad(x, (N_FFT, N_FFT * 2))
    n = 1 + (len(xp) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n)[:, None]
    return np.fft.rfft(xp[idx] * WIN, axis=1)


def _istft(S, length):
    frames = np.fft.irfft(S, N_FFT, axis=1) * WIN
    n = len(frames)
    out = np.zeros((n - 1) * HOP + N_FFT, dtype=np.float32)
    wsum = np.zeros_like(out)
    for i in range(n):
        a = i * HOP
        out[a:a + N_FFT] += frames[i]
        wsum[a:a + N_FFT] += WIN ** 2
    out = out / np.maximum(wsum, 1e-8)
    return out[N_FFT:N_FFT + length]


def _smooth(g):
    """沿频率轴 1-2-1 平滑，压掉谱减特有的「音乐噪声」尖刺。"""
    out = g.copy()
    for i in range(1, g.shape[1] - 1):
        out[:, i] = (g[:, i - 1] + 2 * g[:, i] + g[:, i + 1]) / 4.0
    return out


def _noise_psd(P):
    """每频点取时间轴 12% 分位当噪声底。语音起伏大，这个分位基本落在低能量处。"""
    return np.percentile(P, 12, axis=0, keepdims=True)


def wiener_hard(x, alpha=1.2, floor=0.12):
    S = _stft(x)
    P = np.abs(S) ** 2
    g = np.maximum(floor, (P - alpha * _noise_psd(P)) / np.maximum(P, 1e-12))
    return _istft(S * _smooth(np.sqrt(np.clip(g, 0.0, 1.0))), len(x))


def wiener_dd(x, dd=0.98, floor=0.10):
    S = _stft(x)
    P = np.abs(S) ** 2
    gamma = P / np.maximum(_noise_psd(P), 1e-12)
    G = np.empty_like(P)
    pg = np.ones(P.shape[1], dtype=np.float32)
    pgamma = np.ones(P.shape[1], dtype=np.float32)
    for t in range(P.shape[0]):
        xi = dd * (pg ** 2) * pgamma + (1.0 - dd) * np.maximum(gamma[t] - 1.0, 0.0)
        g = np.maximum(xi / (1.0 + xi), floor)
        G[t] = g
        pg = g
        pgamma = gamma[t]
    return _istft(S * _smooth(np.sqrt(np.clip(G, 0.0, 1.0))), len(x))


def process_pcm(x, mode):
    """x: float32 [-1,1] 单声道。mode 非法或关闭时原样返回。"""
    if mode == MODE_HARD:
        return wiener_hard(x)
    if mode == MODE_DD:
        return wiener_dd(x)
    return x


def process_wav(data, mode):
    """整段 WAV(bytes) -> 处理后的 WAV(bytes)。mode=0 或解析失败时原样返回。"""
    if not mode:
        return data
    try:
        wi = wave.open(io.BytesIO(data), 'rb')
        nch, sw, sr, n = wi.getnchannels(), wi.getsampwidth(), wi.getframerate(), wi.getnframes()
        raw = wi.readframes(n)
        wi.close()
        if sw != 2 or nch != 1 or n < sr // 4:
            return data                      # 只处理 16bit 单声道、且不短于 0.25 秒
        x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
        y = process_pcm(x, mode)
        peak = float(np.abs(y).max())
        if peak > 1.0:                       # 极少数片段处理后过冲，整体缩一点而不是硬削
            y = y / peak
        buf = io.BytesIO()
        w = wave.open(buf, 'wb')
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(y, -1.0, 1.0) * 32767.0).astype('<i2').tobytes())
        w.close()
        return buf.getvalue()
    except Exception:
        return data                          # 降噪出任何问题都不能影响朗读本身


def is_male(voice_info):
    """voice_info: VOICES[k] 那条 dict。没有 f0 信息时按 band 判。"""
    if not voice_info:
        return False
    f0 = voice_info.get('f0')
    if f0:
        return float(f0) < MALE_MAX_F0
    return str(voice_info.get('band') or '').startswith('男声')

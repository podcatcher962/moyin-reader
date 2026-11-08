# -*- coding: utf-8 -*-
"""诊断：切分结果 / 裁剪前后的首尾静音 / 拼接后总长。"""
import array
import io
import os
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(os.path.join(HERE, 'VoicePack'))
sys.path.insert(0, os.getcwd())

import tts_server as T  # noqa: E402


def pack(a, sr):
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(a.tobytes())
    return buf.getvalue()


def edges(wav_bytes, thr=0.012, win_ms=20):
    """首/尾静音时长、总时长。"""
    with wave.open(io.BytesIO(wav_bytes)) as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
        total = w.getnframes()
    a = array.array('h')
    a.frombytes(raw)
    win = int(sr * win_ms / 1000.0)
    quiet = []
    for i in range(0, len(a) - win + 1, win):
        blk = a[i:i + win]
        quiet.append((sum(v * v for v in blk) / len(blk)) ** 0.5 / 32768.0 < thr)
    lead = 0
    for q in quiet:
        if q:
            lead += 1
        else:
            break
    trail = 0
    for q in reversed(quiet):
        if q:
            trail += 1
        else:
            break
    return lead * win / float(sr), trail * win / float(sr), total / float(sr)


TXT = '他合上书，屋里静下来。窗外的雨还在下，很细，落在瓦上没有声音。'
segs = T.prosody_split(TXT)
print('切分 %d 段:' % len(segs))
for i, (s, g) in enumerate(segs):
    print('  %d) %-12s 停顿 %.2fs  ls %.3f' % (i + 1, s, g, T.length_scale_of(s, g)))

print('\n裁剪效果:')
items = []
for i, (s, g) in enumerate(segs):
    d = T._synth_one(s, 's12', T.length_scale_of(s, g))
    with wave.open(io.BytesIO(d)) as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
    arr = array.array('h')
    arr.frombytes(raw)
    l0, t0, dur0 = edges(d)
    tr = T._trim(arr, sr)
    l1, t1, dur1 = edges(pack(tr, sr))
    items.append((d, g))
    print('  %d) %-12s 时长 %.2f→%.2f  首静音 %.2f→%.3f  尾静音 %.2f→%.3f'
          % (i + 1, s, dur0, dur1, l0, l1, t0, t1))

out = T._join(items)
with wave.open(io.BytesIO(out)) as w:
    print('\n拼接后总长 %.2fs  %d B' % (w.getnframes() / float(w.getframerate()), len(out)))

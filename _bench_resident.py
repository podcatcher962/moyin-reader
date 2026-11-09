# -*- coding: utf-8 -*-
"""测 sherpa_onnx 常驻引擎的加载与合成耗时，跟子进程方案对比。"""
import os
import sys
import time

import numpy as np
import sherpa_onnx as so

VP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'VoicePack')
M = os.path.join(VP, 'models')
SH = os.path.join(M, 'shared')


def cfg_single(d, threads=2, silence=0.35):
    v = so.OfflineTtsVitsModelConfig(
        model=os.path.join(M, d, 'model.onnx'),
        tokens=os.path.join(SH, 'tokens.txt'),
        lexicon=os.path.join(SH, 'lexicon.txt'),
    )
    m = so.OfflineTtsModelConfig(vits=v, num_threads=threads, debug=False, provider='cpu')
    c = so.OfflineTtsConfig(model=m)
    c.rule_fsts = ','.join(os.path.join(SH, x) for x in ('date.fst', 'number.fst', 'phone.fst'))
    c.silence_scale = silence
    c.max_num_sentences = 1
    return c


def cfg_fan(sid, threads=2, silence=0.35):
    d = os.path.join(M, 'fanchen')
    v = so.OfflineTtsVitsModelConfig(
        model=os.path.join(d, 'model.onnx'),
        tokens=os.path.join(d, 'tokens.txt'),
        lexicon=os.path.join(d, 'lexicon.txt'),
        dict_dir=os.path.join(d, 'dict'),
    )
    m = so.OfflineTtsModelConfig(vits=v, num_threads=threads, debug=False, provider='cpu')
    c = so.OfflineTtsConfig(model=m)
    c.silence_scale = silence
    c.max_num_sentences = 1
    return c


def load(label, cfg):
    a = time.time()
    t = so.OfflineTts(cfg)
    print('加载 %-12s %5.2fs  sr=%s speakers=%s' % (label, time.time() - a,
                                                t.sample_rate, t.num_speakers), flush=True)
    return t


def gen(t, text, sid=0, speed=1.0):
    a = time.time()
    au = t.generate(text, sid=sid, speed=speed)
    s = np.asarray(au.samples, dtype=np.float32)
    d = time.time() - a
    return d, s, au.sample_rate


TXT = ('你会困于梦魇，循环不休，便是因为梦中未尽之念没有完成。如果让你完成了它，便可超脱而出。')
SEGS = ['你会困于梦魇', '循环不休', '便是因为梦中未尽之念没有完成', '如果让你完成了它', '便可超脱而出']

x0 = load('xiaoya', cfg_single('xiaoya'))
d, s, sr = gen(x0, '预热。')
print('首次生成 %5.3fs (%.2f 秒音频, %d 点 @%d)' % (d, len(s) / sr, len(s), sr), flush=True)

for _ in range(2):
    d, s, sr = gen(x0, TXT)
    print('整句 20 字 %5.3fs -> %.2f 秒音频  峰值 %.3f' % (d, len(s) / sr, float(np.abs(s).max())), flush=True)

for seg in SEGS[:3]:
    d, s, sr = gen(x0, seg)
    print('  片段 %-16s %5.3fs -> %.2f 秒' % (seg, d, len(s) / sr), flush=True)

d, s, sr = gen(x0, '对。')
print('「对。」 %5.3fs -> %.2f 秒' % (d, len(s) / sr), flush=True)

c0 = load('chaowen', cfg_single('chaowen'))
d, s, sr = gen(c0, TXT)
print('男声整句 %5.3fs -> %.2f 秒  峰值 %.3f' % (d, len(s) / sr, float(np.abs(s).max())), flush=True)

fan = load('fanchen', cfg_fan(13))
d, s, sr = gen(fan, TXT, sid=13)
print('配角整句 %5.3fs -> %.2f 秒  sr=%d' % (d, len(s) / sr, sr), flush=True)
for sid in (13, 52, 169, 13):
    d, s, sr = gen(fan, '便是因为梦中未尽之念没有完成', sid=sid)
    print('  配角切 sid=%-3d %5.3fs -> %.2f 秒' % (sid, d, len(s) / sr), flush=True)

print('\n--- 串行 5 片段（同一实例）---')
a = time.time()
for seg in SEGS:
    gen(x0, seg)
print('合计 %.2fs' % (time.time() - a), flush=True)

print('\n--- 3 实例并行 15 片段 ---')
ts = [load('xiaoya#%d' % i, cfg_single('xiaoya')) for i in range(1, 3)]
pool = [x0] + ts
from concurrent.futures import ThreadPoolExecutor
segs15 = SEGS * 3
a = time.time()
with ThreadPoolExecutor(max_workers=3) as ex:
    list(ex.map(lambda p: gen(pool[p[0] % 3], p[1]), list(enumerate(segs15))))
print('15 片段 3 路并行 %.2fs' % (time.time() - a), flush=True)

# -*- coding: utf-8 -*-
"""测桌面端每段合成的实际耗时，定位「换人前干等 10 秒」。"""
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'VoicePack'))
import tts_server as T

TXT = ('你会困于梦魇，循环不休，便是因为梦中未尽之念没有完成。'
       '如果让你完成了它，便可超脱而出。”女子问道：“所以你想要达成的是什么结果？'
       '比如说……战胜某个对手？屠杀所有在场的人？或者仅仅脱离战局？'
       '甚至于称霸世界？无论难易，需要你真实的想法，否则无意义。')

short = '但你几次的梦却仅仅可以控制自己的行动，控制不了其他，每每事与愿违，是么？'


def t(label, fn, n=1):
    a = time.time()
    for _ in range(n):
        r = fn()
    d = time.time() - a
    print('%-34s %6.2fs%s' % (label, d / n, '' if r is None else '  -> %s' % r), flush=True)
    return d


units = T.merge_short(T.prosody_split(T.clean_text(TXT)))
print('长段切出片段数 = %d' % len(units))
print('片段字数 =', [len(u[0]) for u in units], flush=True)

print('\n--- 单次子进程（含载模型）---')
one = units[0][0]
t('同片段重复 1 次（冷）', lambda: T._synth_one(one, 'x0', 1.0, 0.35))
t('同片段重复（热缓存就秒回）', lambda: T._synth_one(one, 'x0', 1.0, 0.35))
T._seg_cache.clear()
t('清缓存后再来一次（文件缓存热）', lambda: T._synth_one(one, 'x0', 1.0, 0.35))

print('\n--- 整段（并行 %d）---' % T.PARALLEL)
T._cache.clear(); T._seg_cache.clear()
t('长段 x0 女声 首次', lambda: T.synth(TXT, 'x0', 1))
T._cache.clear()
t('长段 x0 女声 二次（片段缓存命中）', lambda: T.synth(TXT, 'x0', 1))

print('\n--- 配角库（16k，慢 10 倍）---')
T._cache.clear(); T._seg_cache.clear()
t('长段 s13 配角 首次', lambda: T.synth(TXT, 's13', 1))

print('\n--- 短句 ---')
T._cache.clear(); T._seg_cache.clear()
t('「对。」', lambda: T.synth('“对。”', 'x0', 1))
T._cache.clear(); T._seg_cache.clear()
t('旁白整句', lambda: T.synth(short, 'x0', 1))
print('\n并行度与 CPU：%d 线程' % (os.cpu_count() or 0))

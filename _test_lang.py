# -*- coding: utf-8 -*-
"""语言判定自测：中文模型不认字母，切片与「外文块」判定错一点就会
在书里留下空洞（英文词被吞）或者把整段中文误判成外文。"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'VoicePack'))
import tts_server as t   # noqa: E402

fails = 0


def ck(name, got, want):
    global fails
    if got == want:
        print('ok   ' + name)
    else:
        fails += 1
        print('FAIL %s → %r ≠ %r' % (name, got, want))


# ① 汉字 / 拉丁字母判定
ck('纯英文无汉字', (t.has_han('Hello'), t.has_latin('Hello')), (False, True))
ck('中文有汉字', (t.has_han('他说'), t.has_latin('他说')), (True, False))
ck('纯标点都不算', (t.has_han('？？？'), t.has_latin('？？？')), (False, False))
ck('数字都不算', (t.has_han('123'), t.has_latin('123')), (False, False))

# ② 按语言切片
ck('中文夹单词', t.lang_split('他打开 iPhone 看了一眼'),
   [('他打开 ', 'zh'), ('iPhone ', 'en'), ('看了一眼', 'zh')])
ck('纯英文一整片', t.lang_split('Hello world'), [('Hello world', 'en')])
ck('数字留给中文', t.lang_split('共 15 个'), [('共 15 个', 'zh')])
ck('纯标点空片被丢掉', t.lang_split('……'), [])

# ③ 无英文模型时：纯外文要抛 NoEnVoice（页面据此换系统英文语音），
#    混排必须照常出声（中文念得出来，英文词暂缺）
t.en_ready = lambda: False
try:
    t.synth('Hello world', 'f0', 1.0)
    print('FAIL 纯英文应该抛 NoEnVoice')
    fails += 1
except t.NoEnVoice:
    print('ok   纯英文抛 NoEnVoice（前端会用系统英文语音）')
except Exception as e:
    print('FAIL 纯英文抛了别的：%r' % (e,))
    fails += 1

try:
    d = t.synth('他打开 iPhone 15 看了一眼。', 'f0', 1.0)
    print('ok   中英混排照常出声（%d 字节）' % len(d))
except Exception as e:
    print('FAIL 中英混排出错了：%r' % (e,))
    fails += 1

print('全部通过' if not fails else '%d 项失败' % fails)
sys.exit(0 if not fails else 1)

# -*- coding: utf-8 -*-
"""停顿分层验证：起真实语音服务，合成一段话，逐个数停顿并对照标点。

判据（有声书演播标准，见 VoicePack/tts_server.py 顶部注释）：
  句号 / 叹号 / 问号 : 0.60 ~ 1.10 秒
  逗号               : 0.28 ~ 0.55 秒
  顿号               : 0.18 ~ 0.42 秒
  且句号必须明显长于逗号（比值 ≥ 1.4），否则听感上分不出来。
"""
import array
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = os.path.join(HERE, 'VoicePack')
PORT = int(os.environ.get('PROSODY_PORT', '8911'))


def find_gaps(wav_bytes, thr=0.006, min_ms=120):
    with wave.open(io.BytesIO(wav_bytes)) as w:
        sr, n = w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    a = array.array('h')
    a.frombytes(raw)
    win = int(sr * 0.02)
    gaps, cur = [], 0
    for i in range(0, len(a) - win, win):
        blk = a[i:i + win]
        rms = (sum(v * v for v in blk) / len(blk)) ** 0.5 / 32768.0
        if rms < thr:
            cur += win
        else:
            if cur >= sr * min_ms / 1000.0:
                gaps.append(cur / float(sr))
            cur = 0
    if cur >= sr * min_ms / 1000.0:
        gaps.append(cur / float(sr))
    return gaps, n / float(sr), sr


def main():
    p = subprocess.Popen([sys.executable, 'tts_server.py', str(PORT), '--no-open'],
                         cwd=VOICE, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    ok = []
    bad = []
    try:
        st = None
        for _ in range(90):
            try:
                st = json.load(urllib.request.urlopen(
                    'http://127.0.0.1:%d/health' % PORT, timeout=2))
                if st.get('ok'):
                    break
            except Exception:
                time.sleep(0.5)
        if not st or not st.get('ok'):
            print('FAIL 语音服务没起来')
            return 1
        print('引擎 %s，音色 %d 个' % (st['engine'], st['count']))

        cases = [
            # (名称, 文本, 期望(句号级处数, 逗号级处数))
            # 末尾标点之后不再补停顿（后面没有内容了），所以尾句不计处数。
            ('混合长短句',
             '他合上书，屋里静下来。窗外的雨还在下，很细，落在瓦上没有声音。'
             '他想起很多年前的一个傍晚，也是这样的雨。',
             (2, 4)),
            ('顿号并列',
             '大厅里摆着紫檀木的桌子、黄铜的灯、半旧的屏风，还有一架琴。',
             (0, 3)),
            ('问句与省略号',
             '你说什么？我没听清……再讲一遍吧。',
             (2, 0)),
        ]
        for name, txt, want in cases:
            t0 = time.time()
            req = urllib.request.Request(
                'http://127.0.0.1:%d/tts' % PORT,
                data=json.dumps({'text': txt, 'voice': 's12', 'speed': 1}).encode(),
                headers={'Content-Type': 'application/json'})
            wav = urllib.request.urlopen(req, timeout=180).read()
            el = time.time() - t0
            gaps, dur, sr = find_gaps(wav)
            long_g = [g for g in gaps if g >= 0.60]
            mid_g = [g for g in gaps if 0.24 <= g < 0.60]
            short_g = [g for g in gaps if g < 0.24]
            print('\n[%s] %d 字  合成 %.2fs  音频 %.2fs  采样率 %d' % (name, len(txt), el, dur, sr))
            print('  停顿 %d 处：句号级 %d %s | 逗号级 %d %s | 自然 %d'
                  % (len(gaps), len(long_g), ['%.2f' % x for x in long_g],
                     len(mid_g), ['%.2f' % x for x in mid_g], len(short_g)))
            wl, wm = want
            n_long, n_mid = len(long_g), len(mid_g)

            def chk(cond, msg):
                (ok if cond else bad).append(msg)
                print('   %s %s' % ('OK  ' if cond else 'FAIL', msg))

            chk(n_long >= wl, '句号级停顿 ≥ %d 处（实际 %d）' % (wl, n_long))
            if wm:
                chk(n_mid >= max(1, wm - 1), '逗号级停顿 ≥ %d 处（实际 %d）' % (max(1, wm - 1), n_mid))
            if long_g and mid_g:
                ratio = (sum(long_g) / len(long_g)) / (sum(mid_g) / len(mid_g))
                chk(ratio >= 1.4, '句号/逗号平均时长比 %.2f ≥ 1.4' % ratio)
            chk(min(mid_g) >= 0.24 if mid_g else True,
                '最短的逗号级停顿 ≥ 0.24 秒（实际 %s）'
                % ('%.2f' % min(mid_g) if mid_g else '无'))

        print('\n' + '=' * 46)
        print('通过 %d 项，失败 %d 项' % (len(ok), len(bad)))
        if bad:
            for b in bad:
                print('  未通过：' + b)
        return 0 if not bad else 1
    finally:
        p.terminate()
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()


if __name__ == '__main__':
    sys.exit(main())

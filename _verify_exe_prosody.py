# -*- coding: utf-8 -*-
"""从成品 EXE 里验证韵律：启动 exe，打它内嵌的语音服务，量停顿层次。

只验证「打包进去的确实是新逻辑」——源码测试绿不代表 exe 里是新代码，
这条是上次 deb 装旧页面、APK 装旧标点换来的教训。
"""
import array
import io
import json
import os
import subprocess
import time
import urllib.request
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
EXE = os.path.join(HERE, 'MoYinReader.exe')
PORT = int(os.environ.get('MOYIN_VOICE_PORT', '8177'))


def gaps_of(wav_bytes, thr=0.006, min_ms=120):
    with wave.open(io.BytesIO(wav_bytes)) as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
        total = w.getnframes()
    a = array.array('h')
    a.frombytes(raw)
    win = int(sr * 0.02)
    out, cur = [], 0
    for i in range(0, len(a) - win, win):
        blk = a[i:i + win]
        if (sum(v * v for v in blk) / len(blk)) ** 0.5 / 32768.0 < thr:
            cur += win
        else:
            if cur >= sr * min_ms / 1000.0:
                out.append(cur / float(sr))
            cur = 0
    if cur >= sr * min_ms / 1000.0:
        out.append(cur / float(sr))
    return out, total / float(sr)


def main():
    # 先清干净：残留的 onefile 实例会占住解压目录和端口，新实例就起不来
    subprocess.run(['taskkill', '/F', '/IM', 'MoYinReader.exe', '/T'],
                   capture_output=True)
    time.sleep(2.5)
    p = subprocess.Popen([EXE], cwd=HERE)
    ok, bad = [], []
    try:
        # 先等页面服务（它比语音服务先起，说明主进程已经活了）
        page_ok = False
        for _ in range(60):
            try:
                with urllib.request.urlopen('http://127.0.0.1:38975/__ping', timeout=2) as r:
                    if json.loads(r.read()).get('app') == 'MoYinReader':
                        page_ok = True
                        break
            except Exception:
                time.sleep(1)
        if not page_ok:
            print('FAIL 主进程没起来（页面服务不可访问）')
            return 1
        st = None
        last_err = ''
        for i in range(90):
            try:
                st = json.load(urllib.request.urlopen(
                    'http://127.0.0.1:%d/health' % PORT, timeout=3))
                if st.get('ok'):
                    break
                last_err = 'health ok=false: %s' % str(st)[:120]
            except Exception as e:
                last_err = '%s: %s' % (type(e).__name__, e)
            time.sleep(1)
        if not st or not st.get('ok'):
            print('FAIL EXE 内语音服务没起来（最后一次：%s）' % last_err)
            return 1
        V = (st.get('curated') or ['s12'])[0]
        print('EXE 语音服务就绪：%s，音色 %d 个，被测音色 %s（%s）'
              % (st['engine'], st['count'], V, st['labels'].get(V, '')))

        # 末尾标点之后不再补停顿，所以最后补一句，让句号是「句中的句号」
        txt = ('他合上书，屋里静下来。窗外的雨还在下，很细，落在瓦上没有声音。'
               '他起身去关窗。')
        t0 = time.time()
        req = urllib.request.Request(
            'http://127.0.0.1:%d/tts' % PORT,
            data=json.dumps({'text': txt, 'voice': V, 'speed': 1}).encode(),
            headers={'Content-Type': 'application/json'})
        wav = urllib.request.urlopen(req, timeout=180).read()
        el = time.time() - t0
        gaps, dur = gaps_of(wav)
        long_g = [g for g in gaps if g >= 0.60]
        mid_g = [g for g in gaps if 0.24 <= g < 0.60]
        print('合成 %.2fs  音频 %.2fs' % (el, dur))
        print('停顿：句号级 %d %s | 逗号级 %d %s'
              % (len(long_g), ['%.2f' % x for x in long_g],
                 len(mid_g), ['%.2f' % x for x in mid_g]))

        def chk(c, m):
            (ok if c else bad).append(m)
            print('  %s %s' % ('OK  ' if c else 'FAIL', m))

        # 文本：句号 2 处（末尾句号不再补停顿）、逗号 3 处
        chk(len(long_g) >= 2, '句号级停顿 ≥ 2 处（实际 %d）' % len(long_g))
        chk(len(mid_g) >= 3, '逗号级停顿 ≥ 3 处（实际 %d）' % len(mid_g))
        if long_g and mid_g:
            ratio = (sum(long_g) / len(long_g)) / (sum(mid_g) / len(mid_g))
            chk(ratio >= 1.4, '句号/逗号 平均时长比 %.2f ≥ 1.4' % ratio)
        chk(min(mid_g) >= 0.24 if mid_g else False,
            '最短逗号级停顿 ≥ 0.24 秒（实际 %s）'
            % ('%.2f' % min(mid_g) if mid_g else '无'))

        print('\n通过 %d 项，失败 %d 项' % (len(ok), len(bad)))
        return 0 if not bad else 1
    finally:
        subprocess.run(['taskkill', '/F', '/PID', str(p.pid), '/T'],
                       capture_output=True)


if __name__ == '__main__':
    raise SystemExit(main())

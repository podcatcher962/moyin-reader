# -*- coding: utf-8 -*-
"""端到端验证：启动真 EXE，走它自己的语音服务，确认降噪真的生效。

只看打包日志不算数——denoise.py 缺失时引擎会静默退回原声（synth 里是 try-import），
用户听不出差别，只会以为「这功能没做」。所以必须打真接口比字节。

判定：
  · /health 的 dn 为 true（模块加载成功）
  · 男声 dn=0 与 dn=1 返回的音频不同（降噪生效）
  · 男声 dn=1 与 dn=2 也不同（两档确实是两套算法）
  · 女声 dn=0 与 dn=1 完全相同（女声不处理）
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
EXE = os.path.join(HERE, 'MoYinReader.exe')
PORT = 8177
TXT = '那年冬天，老李拎着一篮梨从南方慢慢走来。他放下篮子，看了一眼远处的山。'

pass_n = fail_n = 0


def ok(c, label, extra=''):
    global pass_n, fail_n
    if c:
        pass_n += 1
        print('  PASS ' + label + (('  ' + str(extra)) if extra else ''))
    else:
        fail_n += 1
        print('  FAIL ' + label + '  ' + str(extra))


def post(path, obj, timeout=90):
    req = urllib.request.Request('http://127.0.0.1:%d%s' % (PORT, path),
                                 data=json.dumps(obj).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    before = set()
    out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq MoYinReader.exe', '/FO', 'CSV', '/NH'],
                         capture_output=True)
    txt = out.stdout.decode('gbk', 'ignore')
    for line in txt.splitlines():
        parts = [x.strip().strip('"') for x in line.split(',')]
        if len(parts) > 1 and parts[1].isdigit():
            before.add(int(parts[1]))

    p = subprocess.Popen([EXE])
    try:
        health = None
        for _ in range(40):
            try:
                with urllib.request.urlopen('http://127.0.0.1:%d/health' % PORT, timeout=3) as r:
                    health = json.loads(r.read().decode('utf-8'))
                if health.get('ok'):
                    break
            except Exception:
                time.sleep(1.5)
        if not health:
            print('  [!] 语音服务没起来')
            return 1
        ok(health.get('ok') is True, '引擎在线（%s）' % health.get('engine'))
        ok(health.get('dn') is True, '降噪模块加载成功（health.dn=true）', health.get('dn'))

        male = 'c0' if 'c0' in (health.get('voices') or {}) else None
        female = 'x0' if 'x0' in (health.get('voices') or {}) else None
        if not male:
            print('  [!] 没有可用男声')
            return 1

        a0 = post('/tts', {'text': TXT, 'voice': male, 'speed': 1, 'dn': 0})
        a1 = post('/tts', {'text': TXT, 'voice': male, 'speed': 1, 'dn': 1})
        a2 = post('/tts', {'text': TXT, 'voice': male, 'speed': 1, 'dn': 2})
        ok(len(a0) > 10000, '男声原声拿到音频', '%d 字节' % len(a0))
        ok(a0 != a1, '男声：原声 ≠ 更干净（降噪真的在跑）')
        ok(a1 != a2, '男声：更干净 ≠ 更清楚（两档是两套算法）')
        ok(abs(len(a0) - len(a1)) < 64 and abs(len(a1) - len(a2)) < 64,
           '三档输出长度一致（只改内容不改时长）', [len(a0), len(a1), len(a2)])

        if female:
            f0 = post('/tts', {'text': TXT, 'voice': female, 'speed': 1, 'dn': 0})
            f1 = post('/tts', {'text': TXT, 'voice': female, 'speed': 1, 'dn': 1})
            ok(f0 == f1, '女声：dn=0 与 dn=1 字节完全相同（女声一个采样都不碰）')

        bad = post('/tts', {'text': TXT, 'voice': male, 'speed': 1, 'dn': 99})
        ok(len(bad) > 10000, '非法档位 99 不报错，按原声返回', '%d 字节' % len(bad))
        ok(bad == a0, '非法档位的结果与原声完全一致')
    finally:
        out = subprocess.run(['tasklist', '/FI', 'IMAGENAME eq MoYinReader.exe', '/FO', 'CSV', '/NH'],
                             capture_output=True)
        txt = out.stdout.decode('gbk', 'ignore')
        now = set()
        for line in txt.splitlines():
            parts = [x.strip().strip('"') for x in line.split(',')]
            if len(parts) > 1 and parts[1].isdigit():
                now.add(int(parts[1]))
        for pid in sorted(now - before):
            subprocess.run(['taskkill', '/F', '/PID', str(pid), '/T'], capture_output=True)
        try:
            p.kill()
        except Exception:
            pass

    print('\n== %d 通过 / %d 失败 ==' % (pass_n, fail_n))
    return 1 if fail_n else 0


if __name__ == '__main__':
    sys.exit(main())

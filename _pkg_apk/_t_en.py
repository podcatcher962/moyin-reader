# -*- coding: utf-8 -*-
"""安卓英文朗读回归：确认「后台加载英文模型」不再冻死整个进程。

判据（上一轮失败的对话原文）：
    'Hello world.'        -> ('000', 40.05, '')   # 触发英文，把进程冻死
    '他打开手机看了一眼。' -> ('000', 40.04, '')   # 中文跟着死
现在要求：英文至少回 200（第一句允许先用中文顶），中文必须始终 200，/health 必须随时能应。
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request

ADB = r'D:\Workuddy\android-build\sdk\platform-tools\adb.exe'
PKG = 'com.lanlan.moyinreader'
PORT = 38973
BASE = 'http://127.0.0.1:%d' % PORT


def sh(*a, **kw):
    return subprocess.run(a, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', **kw)


def get(path, timeout):
    t0 = time.time()
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return r.status, r.read(), time.time() - t0
    except Exception as e:
        return '000', str(e).encode(), time.time() - t0


def tts(text, voice='', en=None, timeout=40):
    body = {'text': text, 'voice': voice, 'speed': 1.0}
    if en is not None:
        body['en'] = en
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + '/tts', data=data,
                                 headers={'Content-Type': 'application/json'})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            return r.status, time.time() - t0, len(b)
    except urllib.error.HTTPError as e:
        # 非 2xx 要看清是几号：503=引擎还在建，500=真炸了
        body = e.read()[:120].decode('utf-8', 'replace')
        return e.code, time.time() - t0, body
    except Exception as e:
        return '000', time.time() - t0, str(e)[:60]


def main():
    print('重启应用…')
    sh(ADB, 'shell', 'am', 'force-stop', PKG)
    time.sleep(1)
    sh(ADB, 'shell', 'am', 'start', '-n', PKG + '/.MainActivity')
    sh(ADB, 'forward', 'tcp:%d' % PORT, 'tcp:%d' % PORT)

    # 等 /health 起来（最多 60 秒）
    t0 = time.time()
    while time.time() - t0 < 60:
        s, b, _ = get('/health', 3)
        if s == 200:
            break
        time.sleep(1.5)
    else:
        print('FAIL /health 60 秒都没起来')
        return 1
    print('health 就绪 %.1fs' % (time.time() - t0))
    try:
        h = json.loads(b.decode())
        print('  voices:', json.dumps(h.get('voices'), ensure_ascii=False)[:200])
    except Exception:
        h = {}

    # 神经语音还要在后台解压 + 建引擎，先等它真就位；没就位时 /tts 一律回 503
    # 注意：/warm 才是开引擎的开关（页面在「打开一本书」时叫）。只查 health 会永远 loading。
    get('/warm', 8)
    print('已叫 /warm，等引擎…')
    t1 = time.time()
    while time.time() - t1 < 240:
        s, b, _ = get('/health', 5)
        try:
            h = json.loads(b.decode())
        except Exception:
            h = {}
        if s == 200 and h.get('ok'):
            break
        if s == 200 and h.get('detail'):
            print('  加载失败：detail=%s' % h.get('detail'))
            break
        time.sleep(2)
    else:
        print('FAIL 语音引擎 240 秒还没就位')
        return 1
    print('引擎就位 用时%.1fs  engine=%s  声线%d个  en模型=%s  lib=%s'
          % (time.time() - t1, h.get('engine'), h.get('count', 0), h.get('en'), h.get('lib')))

    fail = []

    # 1) 先来中文，建立基线
    s, dt, n = tts('他打开手机看了一眼。')
    print('中文基线           %-5s %6.2fs %s' % (s, dt, ('%d B' % n) if isinstance(n, int) else n))
    if s != 200:
        fail.append('中文基线就不出声')

    # 2) 英文：这就是上一轮冻死进程的那一句
    s, dt, n = tts('Hello world.')
    print('英文首句           %-5s %6.2fs %s' % (s, dt, ('%d B' % n) if isinstance(n, int) else n))
    if s != 200:
        fail.append('英文首句没回 200（冻住了？）')

    # 3) 英文紧接着连打三句，看看会不会中途挂
    for i in range(3):
        s, dt, n = tts('This is sentence number %d.' % i)
        print('英文连打 #%d        %-5s %6.2fs %s' % (i, s, dt, ('%d B' % n) if isinstance(n, int) else n))
        if s != 200:
            fail.append('英文连打 #%d 失败' % i)
        time.sleep(0.3)

    # 4) 中文必须还能念（上一轮这里 40 秒超时）
    s, dt, n = tts('他打开手机看了一眼。')
    print('英文之后中文       %-5s %6.2fs %s' % (s, dt, ('%d B' % n) if isinstance(n, int) else n))
    if s != 200:
        fail.append('英文之后中文不出声 —— 进程还是被拖住了')

    # 5) /health 必须还能应答
    s, b, dt = get('/health', 5)
    print('英文之后 health    %-5s %6.2fs' % (s, dt))
    if s != 200 or dt > 3:
        fail.append('/health 不应答或变慢 —— 主线程还冻着')

    # 6) 用户开关：en=0 之后英文请求应当立刻走中文顶，不再等模型
    s, dt, n = tts('Hello again.', en=0)
    print('en=0 关掉英文      %-5s %6.2fs %s' % (s, dt, ('%d B' % n) if isinstance(n, int) else n))
    if s not in (200, 415):
        fail.append('en=0 时英文请求既没回 200 也没回 415')

    # 7) 看看 logcat 里英文模型到底就位没有
    out = sh(ADB, 'logcat', '-d', '-s', 'MoYin:*').stdout
    hits = [l for l in out.splitlines() if 'N3.0' in l or '英文' in l]
    print('\nlogcat 英文相关：')
    for l in hits[-8:]:
        print('  ' + l[-140:])

    print()
    if fail:
        print('FAIL ' + '；'.join(fail))
        return 1
    print('PASS 英文不再冻死进程，中文始终可用')
    return 0


if __name__ == '__main__':
    sys.exit(main())

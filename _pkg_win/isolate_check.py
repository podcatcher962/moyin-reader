# -*- coding: utf-8 -*-
"""隔离验收：只把 MoYinReader.exe 拷进空目录，验证内置语音真的能独立跑起来。"""
import http.client
import io
import json
import os
import shutil
import subprocess
import time
import wave

PKG = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(PKG)
SRC = os.path.join(ROOT, 'MoYinReader.exe')
ISO = os.path.join(PKG, 'isolated')
CACHE = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'),
                     'MoYinReader', 'VoicePack')


def health():
    try:
        c = http.client.HTTPConnection('127.0.0.1', 8177, timeout=3)
        c.request('GET', '/health')
        r = c.getresponse()
        j = json.loads(r.read())
        c.close()
        return j
    except Exception:
        return None


def tts(voice):
    b = json.dumps({'text': '窗外的雨下得很细，他合上书。',
                    'voice': voice, 'speed': 1}, ensure_ascii=False).encode('utf-8')
    t = time.time()
    c = http.client.HTTPConnection('127.0.0.1', 8177, timeout=90)
    c.request('POST', '/tts', b, {'Content-Type': 'application/json'})
    r = c.getresponse()
    d = r.read()
    c.close()
    ok = r.status == 200 and d[:4] == b'RIFF' and len(d) > 20000
    dur = round(wave.open(io.BytesIO(d)).getnframes() / 22050, 2) if ok else 0
    return ok, len(d), dur, round(time.time() - t, 2)


def main():
    subprocess.run(['taskkill', '/F', '/IM', 'MoYinReader.exe', '/T'],
                   capture_output=True)
    time.sleep(1)
    if os.path.isdir(CACHE) and os.path.isfile(os.path.join(CACHE, '.moyin_owned')):
        shutil.rmtree(CACHE, ignore_errors=True)
    shutil.rmtree(ISO, ignore_errors=True)
    os.makedirs(ISO)
    exe = os.path.join(ISO, 'MoYinReader.exe')
    shutil.copy2(SRC, exe)
    print('隔离目录内容:', os.listdir(ISO))
    print('单文件体积: %.2f MB' % (os.path.getsize(exe) / 1048576))
    print('缓存目录已清空:', not os.path.isdir(CACHE))
    print('8177 初始状态:', 'UP' if health() else 'DOWN')

    # ① 首次运行：自己释放语音库并拉起服务（服务跑在进程内，所以让它常驻）
    p1 = os.path.join(ISO, 'probe1.txt')
    t = time.time()
    hold = subprocess.Popen([exe, '--voiceprobe=' + p1, '--hold=180'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(400):
        if os.path.isfile(p1):
            break
        if hold.poll() is not None:
            break
        time.sleep(0.5)
    print('\n--- 首次 voiceprobe (%.1f 秒) ---' % (time.time() - t))
    print(io.open(p1, encoding='utf-8', errors='replace').read()
          if os.path.isfile(p1) else 'NO RESULT')

    # ② 真实合成：抽 3 个声线（此刻服务仍在探针进程里活着）
    print('--- 真实 TTS ---')
    for v in ('s12', 's160', 's110'):
        ok, n, dur, sec = tts(v)
        print('  %-6s OK=%s %d B / %.2f 秒音频 / 耗时 %.2f 秒' % (v, ok, n, dur, sec))

    # ③ 窗口内 DOM：页面真的连上了语音服务
    p3 = os.path.join(ISO, 'domcheck.txt')
    subprocess.run([exe, '--domcheck=' + p3], timeout=150, capture_output=True)
    print('--- 窗口 DOM 自检 ---')
    print(io.open(p3, encoding='utf-8', errors='replace').read()
          if os.path.isfile(p3) else 'NO RESULT')

    # ④ 关掉探针进程，确认服务随进程退出（不留后台孤儿）
    # PyInstaller onefile 是「引导进程 + 应用进程」两层，必须连子进程一起结束
    subprocess.run(['taskkill', '/F', '/T', '/PID', str(hold.pid)],
                   capture_output=True)
    try:
        hold.wait(timeout=15)
    except subprocess.TimeoutExpired:
        hold.kill()
    down = False
    for _ in range(20):
        if not health():
            down = True
            break
        time.sleep(0.5)
    print('探针进程退出后服务已停:', down)

    # ⑤ 缓存命中：再次启动不应重新解压
    p2 = os.path.join(ISO, 'probe2.txt')
    t = time.time()
    subprocess.run([exe, '--voiceprobe=' + p2], timeout=120, capture_output=True)
    print('--- 缓存命中 voiceprobe (%.1f 秒) ---' % (time.time() - t))
    print(io.open(p2, encoding='utf-8', errors='replace').read()
          if os.path.isfile(p2) else 'NO RESULT')

    # ⑥ 缓存落地情况
    if os.path.isdir(CACHE):
        n = sum(len(f) for _d, _dn, f in os.walk(CACHE))
        sz = sum(os.path.getsize(os.path.join(dp, f))
                 for dp, _dn, fn in os.walk(CACHE) for f in fn)
        print('缓存目录: %d 个文件 / %.1f MB' % (n, sz / 1048576))
    subprocess.run(['taskkill', '/F', '/IM', 'MoYinReader.exe', '/T'],
                   capture_output=True)
    print('已清理测试进程')


if __name__ == '__main__':
    main()

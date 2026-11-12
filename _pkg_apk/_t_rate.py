# -*- coding: utf-8 -*-
"""量英文合成的真实速率：每句多久、和播放时长比是快是慢。
   如果合成时间 > 播放时间，串行预排永远追不上，听感就是「念一句停几秒」。"""
import json
import subprocess
import sys
import time
import urllib.request

ADB = "D:/Workuddy/android-build/sdk/platform-tools/adb.exe"
BASE = "http://127.0.0.1:38973"


def sh(*a):
    subprocess.run([ADB] + list(a), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def get(path, timeout=5):
    t0 = time.time()
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return r.status, r.read(), time.time() - t0
    except Exception as e:
        return '000', str(e).encode()[:120], time.time() - t0


def tts(text, en=1, timeout=120):
    body = json.dumps({"text": text, "voice": "", "en": en}).encode()
    req = urllib.request.Request(BASE + "/tts", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            return r.status, time.time() - t0, len(b), b
    except urllib.error.HTTPError as e:
        return e.code, time.time() - t0, 0, e.read()[:120]
    except Exception as e:
        return '000', time.time() - t0, 0, str(e).encode()[:120]


def wav_secs(b):
    """WAV 头里数播放时长：data 段长度 / 字节率。"""
    try:
        i = b.find(b'data')
        if i < 0 or len(b) < 44:
            return 0.0
        import struct
        byterate = struct.unpack('<I', b[28:32])[0]
        size = struct.unpack('<I', b[i + 4:i + 8])[0]
        return size / float(byterate) if byterate else 0.0
    except Exception:
        return 0.0


sh("forward", "tcp:38973", "tcp:38973")
sh("shell", "am", "force-stop", "com.lanlan.moyinreader")
time.sleep(1)
sh("shell", "am", "start", "-n", "com.lanlan.moyinreader/.MainActivity")
for _ in range(40):
    s, b, dt = get("/health")
    if s == 200:
        break
    time.sleep(1)
else:
    print("FAIL health 起不来")
    sys.exit(1)
get("/warm", 10)
for _ in range(60):
    s, b, _ = get("/health")
    try:
        h = json.loads(b.decode())
    except Exception:
        h = {}
    if h.get("ok"):
        print("引擎就绪 en=%s lib=%s" % (h.get("en"), h.get("lib")))
        break
    time.sleep(2)
else:
    print("FAIL 引擎没就绪")
    sys.exit(1)

# 真实书里被 splitSpeak 切出来的英文块，长度都在 28~32 字符
EN = [
    "The rain fell softly on",
    "the window, and the sound",
    "of it stayed in the room",
    "for a long while after",
    "he had closed the book.",
    "It is not an easy thing",
]
CN = ["窗外的雨下得很细，", "字落在纸上，", "像脚印落在雪里。"]

print("\n%-30s %-5s %8s %8s %7s" % ("句子", "码", "合成", "音频", "差"))
tot_en, tot_cn = 0.0, 0.0
for t in EN:
    s, dt, n, b = tts(t)
    sec = wav_secs(b)
    tot_en += dt
    print("%-30s %-5s %7.2fs %7.2fs %+7.2fs" % (t, s, dt, sec, dt - sec))
for t in CN:
    s, dt, n, b = tts(t)
    sec = wav_secs(b)
    tot_cn += dt
    print("%-30s %-5s %7.2fs %7.2fs %+7.2fs" % (t, s, dt, sec, dt - sec))
print("\n英文 6 句合计合成 %.1fs / 中文 3 句合计 %.1fs" % (tot_en, tot_cn))

# 再测一遍：模型完全热了之后
print("\n--- 第二轮（已热）---")
for t in EN[:3]:
    s, dt, n, b = tts(t)
    print("%-30s %-5s %7.2fs 音频 %5.2fs" % (t, s, dt, wav_secs(b)))

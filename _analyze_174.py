# -*- coding: utf-8 -*-
"""一次性离线分析 AISHELL3 全部 174 个说话人：测基频 / 过零率，写 voice_table.json。
运行完即可丢弃，产物是静态声线表，运行时零开销。"""
import json
import os
import queue
import subprocess
import threading
import wave
import array

ROOT = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(ROOT, 'VoicePack', 'models', 'aishell3')
EXE = os.path.join(ROOT, 'VoicePack', 'engine', 'bin', 'sherpa-onnx-offline-tts.exe')
TMP = os.path.join(ROOT, '_samples', '_an174')
TEXT = '雨点落在窗上，屋里很安静。'


def feat(path):
    w = wave.open(path)
    sr, n = w.getframerate(), w.getnframes()
    dur = n / float(sr)
    w.setpos(int(sr * 0.3))
    b = w.readframes(min(sr, n - int(sr * 0.3)))
    w.close()
    a = array.array('h')
    a.frombytes(b)
    if len(a) < 4096:
        return None
    zc = 0
    prev = 0
    for v in a[:12000]:
        if (v >= 0) != (prev >= 0):
            zc += 1
        prev = v
    f0s = []
    for st in range(0, min(len(a) - 4096, 12000), 1500):
        x = list(a[st:st + 2048])
        m = sum(x) / len(x)
        x = [v - m for v in x]
        e = sum(v * v for v in x)
        if e < 2e6:            # 静音段跳过
            continue
        best = (0, 0)
        for lag in range(int(sr / 340), int(sr / 65)):
            s2 = sum(x[i] * x[i + lag] for i in range(0, 2048 - lag, 4))
            if s2 > best[1]:
                best = (lag, s2)
        if best[0] and best[1] / (e + 1) > 0.12:
            f0s.append(sr / best[0])
    f0s.sort()
    f0 = f0s[len(f0s) // 2] if f0s else 0
    return {'f0': round(f0), 'zcr': round(zc / 12000.0 * 1000), 'dur': round(dur, 2)}


def one(sid, slot):
    # 每个工作线程固定复用一个文件名：全程不删文件，避免触发批量删除保护
    out = os.path.join(TMP, 'w%d.wav' % slot)
    args = [EXE,
            '--vits-model=' + os.path.join(D, 'model.onnx'),
            '--vits-tokens=' + os.path.join(D, 'tokens.txt'),
            '--vits-lexicon=' + os.path.join(D, 'lexicon.txt'),
            '--tts-rule-fsts=' + ','.join(os.path.join(D, f) for f in
                                          ('date.fst', 'number.fst', 'phone.fst')),
            '--sid=' + str(sid), '--num-threads=1',
            '--output-filename=' + out, TEXT]
    try:
        r = subprocess.run(args, capture_output=True, timeout=120,
                           creationflags=0x08000000)
    except subprocess.TimeoutExpired:
        return sid, None
    if r.returncode or not os.path.isfile(out) or os.path.getsize(out) < 8000:
        return sid, None
    try:
        f = feat(out)
    except Exception:
        f = None
    return sid, f


def main():
    os.makedirs(TMP, exist_ok=True)
    q = queue.Queue()
    for s in range(174):
        q.put(s)
    res = {}
    lock = threading.Lock()

    def worker():
        slot = threading.current_thread().slot
        while True:
            try:
                sid = q.get_nowait()
            except queue.Empty:
                return
            sid, f = one(sid, slot)
            with lock:
                if f:
                    res[sid] = f
                    print('sid %3d  f0=%3d  zcr=%3d  dur=%.1fs' % (sid, f['f0'], f['zcr'], f['dur']), flush=True)
                else:
                    print('sid %3d  FAIL' % sid, flush=True)

    ts = []
    for i in range(6):
        t = threading.Thread(target=worker)
        t.slot = i
        ts.append(t)
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    print('done', len(res), 'of 174', flush=True)
    with open(os.path.join(ROOT, 'VoicePack', 'voice_table.json'), 'w', encoding='utf-8') as fp:
        json.dump({str(k): res[k] for k in sorted(res)}, fp, ensure_ascii=False, indent=0)


if __name__ == '__main__':
    main()

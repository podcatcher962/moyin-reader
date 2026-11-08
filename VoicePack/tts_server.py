# -*- coding: utf-8 -*-
"""
墨吟阅读器 · 免费离线神经语音服务
=====================================
只依赖 Python 标准库，不联网、不收费、没有账号和 API Key。
在本机 127.0.0.1 监听，调用同目录下的 sherpa-onnx 引擎 + 开源中文模型合成 WAV。
内置 11 个音色（10 个中文女声 + 1 个男声），全部来自同一份
AISHELL3 中文多说话人 VITS 模型，靠 --sid 切换声线。

接口：
  GET  /health            -> 引擎/模型状态（JSON，含每个音色是否就绪）
  POST /tts               -> {"text":"...","voice":"s12","speed":1.0} => audio/wav
  OPTIONS *               -> CORS 预检（供 file:// 双击打开的页面调用）

关掉本窗口即停止服务。阅读器在没有服务时会自动用系统语音，不影响看书。
"""
import array
import io
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import wave
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# 源码运行时取脚本目录；PyInstaller 打成 MoYinVoice.exe 后取 exe 所在目录
# （engine/ 与 models/ 就在 exe 旁边，_MEIPASS 里没有这些大文件）。
def _here():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


HERE = os.environ.get('MOYIN_VOICE_ROOT') or _here()
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8177)

ENGINE_DIR = os.path.join(HERE, 'engine')
MODEL_DIR = os.path.join(HERE, 'models')

# 引擎是 C++ 程序，读不了含中文的路径参数。项目若被拷到中文目录，
# 就把必要文件镜像一份到纯 ASCII 的临时目录再调用（只做一次）。
if not HERE.isascii():
    _mirror = os.path.join(os.environ.get('SystemDrive', 'C:') + os.sep,
                           'ProgramData', 'MoYinTTS')
    if not _mirror.isascii():
        _mirror = os.path.join(tempfile.gettempdir(), 'MoYinTTS')
    try:
        for sub in ('engine', 'models'):
            src = os.path.join(HERE, sub)
            if not os.path.isdir(src):
                continue
            for root, _dirs, files in os.walk(src):
                rel = os.path.relpath(root, src)
                dst = os.path.join(_mirror, sub, '' if rel == '.' else rel)
                os.makedirs(dst, exist_ok=True)
                for f in files:
                    a, b = os.path.join(root, f), os.path.join(dst, f)
                    if not os.path.isfile(b) or os.path.getsize(a) != os.path.getsize(b):
                        shutil.copy2(a, b)
        if os.path.isdir(os.path.join(_mirror, 'engine')):
            ENGINE_DIR = os.path.join(_mirror, 'engine')
            MODEL_DIR = os.path.join(_mirror, 'models')
    except OSError:
        pass
# 声线全部来自同一份 29 MB 的 AISHELL3 中文多说话人 VITS 模型：模型内含 174 个
# 说话人，只靠 --sid 切换，所以放开到 174 个音色也完全不影响软件体积。
# 下面的基频表是离线逐人实测的中位 F0（Hz），用来按音高分组，运行时只查表。
AISHELL3_FSTS = ['date.fst', 'number.fst', 'phone.fst']

SID_F0 = {
      0: 250,
      1: 258,
      2: 235,
      3: 242,
      4: 211,
      5: 296,
      6: 242,
      7: 205,
      8: 258,
      9: 235,
     10: 143,
     11: 242,
     12: 235,
     13: 200,
     14: 276,
     15: 154,
     16: 242,
     17: 258,
     18: 229,
     19: 222,
     20: 258,
     21: 143,
     22: 250,
     23: 205,
     24: 222,
     25: 154,
     26: 250,
     27: 205,
     28: 258,
     29: 195,
     30: 222,
     31: 267,
     32: 174,
     33: 296,
     34: 258,
     35: 229,
     36: 200,
     37: 235,
     38: 222,
     39: 296,
     40: 145,
     41: 242,
     42: 296,
     43: 258,
     44: 286,
     45: 286,
     46: 140,
     47: 205,
     48: 186,
     49: 276,
     50: 267,
     51: 258,
     52: 154,
     53: 267,
     54: 250,
     55: 205,
     56: 229,
     57: 211,
     58: 138,
     59: 200,
     60: 143,
     61: 229,
     62: 235,
     63: 250,
     64: 250,
     65: 182,
     66: 320,
     67: 258,
     68: 267,
     69: 127,
     70: 195,
     71: 235,
     72:  91,
     73: 267,
     74: 108,
     75: 163,
     76: 148,
     77: 235,
     78: 276,
     79: 242,
     80: 195,
     81: 235,
     82: 200,
     83: 178,
     84: 235,
     85: 258,
     86: 267,
     87: 242,
     88: 211,
     89: 267,
     90: 242,
     91: 258,
     92: 286,
     93: 229,
     94: 222,
     95: 148,
     96: 211,
     97: 258,
     98: 140,
     99: 229,
    100: 138,
    101: 229,
    102: 170,
    103: 258,
    104: 229,
    105: 276,
    106: 235,
    107: 154,
    108: 235,
    109: 258,
    110: 129,
    111: 276,
    112: 258,
    113: 205,
    114: 222,
    115: 296,
    116: 296,
    117: 258,
    118: 267,
    119: 119,
    120: 258,
    121: 286,
    122: 250,
    123: 242,
    124: 113,
    125: 286,
    126: 242,
    127: 276,
    128: 267,
    129: 235,
    130: 250,
    131: 229,
    132: 267,
    133: 235,
    134: 258,
    135: 222,
    136: 119,
    137: 267,
    138: 222,
    139: 250,
    140: 186,
    141: 235,
    142: 250,
    143: 174,
    144: 200,
    145: 250,
    146: 250,
    147: 235,
    148: 186,
    149: 222,
    150: 258,
    151: 182,
    152: 267,
    153: 148,
    154: 267,
    155: 250,
    156: 157,
    157: 267,
    158: 229,
    159: 250,
    160: 242,
    161: 276,
    162: 205,
    163: 136,
    164: 242,
    165: 235,
    166: 250,
    167: 154,
    168: 267,
    169: 195,
    170: 258,
    171: 174,
    172: 258,
    173: 276
}

# 人工挑过、命名过的 11 个声线，列表里排在最前（试听对比以这批为准）
CURATED = {
    's12': '声线 12 · 温润',
    's35': '声线 35 · 柔和',
    's140': '声线 140 · 舒展',
    's160': '声线 160 · 清亮',
    's170': '声线 170 · 明快',
    's20': '声线 20 · 爽朗',
    's3': '声线 3 · 甜美',
    's9': '声线 9 · 清脆',
    's6': '声线 6 · 沉静',
    's150': '声线 150 · 明亮',
    's110': '声线 110 · 沉稳男声',
}

# 音高分档：<165 Hz 判为男声（AISHELL3 男女声分布天然分界明显）
BANDS = [
    ('男声 · 低沉', 0,   120),
    ('男声 · 中音', 120, 145),
    ('男声 · 偏亮', 145, 165),
    ('女声 · 偏沉', 165, 200),
    ('女声 · 中音', 200, 235),
    ('女声 · 清亮', 235, 265),
    ('女声 · 高音', 265, 999),
]


def band_of(hz):
    for name, lo, hi in BANDS:
        if lo <= hz < hi:
            return name
    return '女声 · 中音'


def _v(sid, label, hz):
    return {'kind': 'vits', 'dir': 'aishell3', 'model': 'model.onnx',
            'sid': sid, 'fsts': AISHELL3_FSTS, 'label': label,
            'band': band_of(hz), 'f0': hz}


VOICES = {}
for _sid in sorted(SID_F0):
    _hz = SID_F0[_sid]
    _key = 's%d' % _sid
    VOICES[_key] = _v(_sid, CURATED.get(_key) or ('%d 号' % _sid), _hz)


_sem = threading.Semaphore(6)          # 并行合成数：每次调用 2 线程，6 路正好吃满 12 核
PARALLEL = 6
_cache = OrderedDict()                 # 整段缓存：重听同一段直接命中
_seg_cache = OrderedDict()             # 片段缓存：同一短句在书里反复出现时省掉重复合成
_cache_lock = threading.Lock()
CACHE_MAX = 48
SEG_CACHE_MAX = 400
MAX_TEXT = 600                         # 单次最多 600 字，防止超长文本卡死

# ---------------- 停顿：按「人念书」的实际时长分层 ----------------
#
# 为什么不用引擎的 --tts-silence-scale 一把梭：
#   实测（2026-11-08）那个倍率会**同时**放大所有停顿，连无标点的词间空隙也一起放大
#   （无标点文本在 scale=1.6 时最长空隙 0.96 秒）。也就是说它只改变「整体留白量」，
#   不改变「逗号 : 句号」的比例，所以调到多大逗号都还是被词间空隙淹没。
#   用户听到的就是「逗号几乎没间隔」。
#
# 所以改成：让引擎把每一小节念紧凑（scale 压到 0.35），小节之间该停多久，
# 由下面这张表按标点类型自己插——这才是人朗读时的停顿层级。
# 数值取自有声书演播的通行标准（逗号约半个字到一个字长，句号约两个半到三个字长，
# 段落更长且要留出换气口），不是新闻播报那种更短的节奏。
PAUSE = {
    '、': 0.28,                       # 顿号：并列词之间，短促，不能用成逗号
    '，': 0.38, ',': 0.34,
    '；': 0.48, ';': 0.44,
    '：': 0.46, ':': 0.42,
    '。': 0.75, '.': 0.72,
    '！': 0.80, '!': 0.76,
    '？': 0.78, '?': 0.74,
    '…': 0.92,                        # 省略号：留白，要明显长于句号
    '—': 0.58,                        # 破折号：转折，一顿
    '～': 0.26, '~': 0.26,
}
PARA_PAUSE = 1.10                     # 段落之间：换气 + 让听众回过神
GAP_FLOOR = 0.02                      # 片段之间至少留 20ms，免得首尾相接糊成一个字
GAP_NOISE = 26                        # 停顿里铺的极轻底噪（约 -62 dBFS）
SENT_END_MIN = 0.70                   # 停顿达到这个长度就算「句末」，念得从容一点

# 片段内部的停顿倍率：压小，让引擎把每一小节念紧凑。
SILENCE_SCALE = 0.35


def find_exe():
    if not os.path.isdir(ENGINE_DIR):
        return None
    for root, _dirs, files in os.walk(ENGINE_DIR):
        if 'sherpa-onnx-offline-tts.exe' in files:
            return os.path.join(root, 'sherpa-onnx-offline-tts.exe')
    return None


def voice_files(voice):
    """返回 (模型目录, 该音色必需的全部文件路径)。"""
    s = VOICES[voice]
    d = os.path.join(MODEL_DIR, s['dir'])
    names = [s['model'], 'tokens.txt', 'lexicon.txt'] + list(s.get('fsts', []))
    return d, [os.path.join(d, n) for n in names]


_ready_cache = {}


def voice_ready(voice):
    """174 个音色共用同一份模型，按目录缓存一次，避免每次探测做上千次 stat。"""
    s = VOICES[voice]
    d = os.path.join(MODEL_DIR, s['dir'])
    ok = _ready_cache.get(d)
    if ok is None:
        names = [s['model'], 'tokens.txt', 'lexicon.txt'] + list(s.get('fsts', []))
        ok = all(os.path.isfile(os.path.join(d, n)) for n in names)
        _ready_cache[d] = ok
    return ok


def health():
    exe = find_exe()
    voices = {v: voice_ready(v) for v in VOICES}
    return {
        'ok': bool(exe) and any(voices.values()),
        'engine': 'sherpa-onnx 2.0.1' if exe else 'missing',
        'voices': voices,
        'labels': {v: VOICES[v]['label'] for v in VOICES},
        'groups': {v: VOICES[v]['band'] for v in VOICES},
        'f0': {v: VOICES[v]['f0'] for v in VOICES},
        'curated': [k for k in CURATED if k in VOICES],
        'count': len(VOICES),
        'version': 3,
    }


def build_args(voice, out, length_scale=1.0, silence_scale=None):
    """按音色拼出引擎命令行参数（VITS 模型 + 可选 sid / 中文规则）。"""
    s = VOICES[voice]
    _d, f = voice_files(voice)
    a = ['--vits-model=' + f[0], '--vits-tokens=' + f[1], '--vits-lexicon=' + f[2]]
    if s.get('sid') is not None:
        a.append('--sid=' + str(s['sid']))
    if s.get('fsts'):
        a.append('--tts-rule-fsts=' + ','.join(f[3:]))
    a.append('--tts-silence-scale=%s'
             % (SILENCE_SCALE if silence_scale is None else silence_scale))
    # 语速交给引擎（改音素时长、不动音高），而不是让浏览器变速——
    # 浏览器 playbackRate 变的是整体速率，念书的「长句从容、短句利落」出不来。
    if abs(length_scale - 1.0) > 1e-6:
        a.append('--vits-length-scale=%.4f' % length_scale)
    return a + ['--num-threads=2', '--output-filename=' + out]


def clean_text(s):
    """去掉控制字符、合并空白。保留换行——换行是段落边界，停顿要比句号更长。"""
    s = str(s or '').replace('\r\n', '\n').replace('\r', '\n').replace('\t', ' ')
    s = ''.join(ch for ch in s if ch == '\n' or (ord(ch) >= 32 and ord(ch) != 127))
    out = []
    for ch in s:
        if ch == ' ' and (not out or out[-1] in ' \n'):
            continue
        if ch == '\n' and (not out or out[-1] == '\n'):
            continue
        out.append(ch)
    return ''.join(out).strip()[:MAX_TEXT]


def prosody_split(text):
    """把文本切成 [(片段, 其后停顿秒数, 该停顿对应的标点)]，停顿按标点类型分层。

    切分原则跟人备稿一样：标点处断开，标点本身不喂给引擎（引擎读不了标点，
    喂进去只会被丢掉），停顿由调用方按秒数插。
    """
    out = []
    buf = []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch == '\n':
            seg = ''.join(buf).strip()
            if seg:
                out.append((seg, PARA_PAUSE, '。'))
            buf = []
            i += 1
            continue
        # 小数点与时间里的冒号不是标点（3.5、12:30），别在这里断
        if ch in '.:' and 0 < i < n - 1 and text[i - 1].isdigit() and text[i + 1].isdigit():
            buf.append(ch)
            i += 1
            continue
        if ch in PAUSE:
            # 连续标点（？！ …… ——）取最长的那个，不要再叠
            j, gap = i, 0.0
            while j < n and text[j] in PAUSE:
                gap = max(gap, PAUSE[text[j]])
                j += 1
            seg = ''.join(buf).strip()
            if seg:
                out.append((seg, gap, text[j - 1]))
            buf = []
            i = j
            continue
        buf.append(ch)
        i += 1
    seg = ''.join(buf).strip()
    if seg:
        out.append((seg, 0.0, ''))
    return out


MIN_SEG = 2                            # 少于这个字数的片段并进相邻片段
INNER_PUNCT = '，,、；;：:。！？!?…—～~'


def _inner_scale(text):
    """片段里还带着标点，说明是由短片段合并来的，得让引擎把内部停顿放出来；
    内部没有标点的片段照常念紧凑，停顿全部由我们自己按表插。"""
    return 1.0 if any(c in INNER_PUNCT for c in text) else SILENCE_SCALE


def merge_short(segs):
    """把过短的片段并进相邻片段，合并时保留原标点。

    实测（2026-11-08）：孤立的一两个字送给引擎经常合成成静音——「纸」峰值 3、
    「墨水」峰值 7，而「笔」是 1146。同一批字放进上下文就正常
    （「白纸」「他蘸了墨水」都没问题）。这类片段单独占一次引擎调用，
    听感上却白白多出一段空白，必须先并掉。
    """
    out = []
    for seg, gap, pun in segs:
        if out and len(seg) < MIN_SEG:
            p, _pg, pp = out[-1]
            out[-1] = (p + pp + seg, gap, pun)
        else:
            out.append((seg, gap, pun))
    # 开头就太短、前面没得并时，并进后一段
    while len(out) > 1 and len(out[0][0]) < MIN_SEG:
        a, _ag, ap = out[0]
        b, bg, bp = out[1]
        out[0:2] = [(a + ap + b, bg, bp)]
    return out


def _peak(wav_bytes):
    """片段峰值。用来判断这一次合成是不是等于没出声。"""
    try:
        _sr, a = _read_wav(wav_bytes)
    except Exception:
        return 0
    if not a:
        return 0
    return max(max(a), -min(a))


def _synth_units(units, voice):
    """并行合成，并保证每一段都真的出了声。

    无声的片段并进相邻片段重来——这是实测出来的必要一步，
    引擎对某些孤立词（「墨水」）会返回近乎全零的波形，不检查就会在书里留下一段空白。
    """
    jobs = list(units)
    workers = max(1, min(PARALLEL, len(jobs)))

    def run(js):
        with ThreadPoolExecutor(max_workers=workers) as ex:
            return list(ex.map(
                lambda x: _synth_one(x[0], voice, length_scale_of(x[0], x[1]), _inner_scale(x[0])),
                js))

    for _ in range(3):
        if not jobs:
            return []
        parts = run(jobs)
        bad = {i for i, d in enumerate(parts) if _peak(d) < 300}
        if not bad:
            return [(d, j[1]) for d, j in zip(parts, jobs)]
        jobs = _merge_bad(jobs, bad)

    parts = run(jobs) if jobs else []
    return [(d, j[1]) for d, j in zip(parts, jobs) if _peak(d) >= 300]


def _merge_bad(jobs, bad):
    """把没出声的片段并进前面那一段（开头没有前面的就并进后一段）。"""
    out = []
    n = len(jobs)
    i = 0
    while i < n:
        t, g, p = jobs[i]
        while i + 1 < n and (i + 1) in bad:
            t = t + p + jobs[i + 1][0]
            g, p = jobs[i + 1][1], jobs[i + 1][2]
            i += 1
        if i in bad and out:
            mt, mg, mp = out[-1]
            out[-1] = (mt + mp + t, g, p)
        else:
            out.append((t, g, p))
        i += 1
    return out


def length_scale_of(seg, gap):
    """按句子长短和所处位置微调语速，消掉「每句一个调、一样快」的机械感。

    幅度刻意做小（±3%）：人能察觉的是「有变化」，不是「变快了多少」。
    """
    n = len(seg)
    ls = 1.0
    if n <= 5:
        ls = 0.97          # 短句利落，不拖着念
    elif n >= 26:
        ls = 1.03          # 长句从容，一口气念不完的字别挤
    if gap >= SENT_END_MIN:
        ls += 0.04         # 句末收住，念完一句才落得下来
    return round(ls, 3)


def _read_wav(data):
    """返回 (采样率, array('h'))。引擎固定输出 16bit 单声道，双声道也能吃。"""
    with wave.open(io.BytesIO(data)) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw != 2:
        raise RuntimeError('不支持的位深：%s' % sw)
    a = array.array('h')
    a.frombytes(raw)
    if ch > 1:
        a = array.array('h', (a[k] for k in range(0, len(a), ch)))
    return sr, a


def _trim(a, sr, keep_lead=0.015, keep_trail=0.030, thr=0.009):
    """裁掉引擎在片段首尾自带的静音。

    实测（2026-11-08）：每段开头有 0.12~0.18 秒、结尾有 0.14~0.36 秒的空白。
    不裁掉的话，① 每个片段之间白多出三分之一秒，整段拖沓；
    ② 停顿实际长度完全不受控——逗号处会从 0.38 秒涨到 0.68 秒，跟句号糊成一级，
    听感上就还是「逗号没间隔」（这正是第一版没做对的原因）。
    """
    n = len(a)
    win = max(1, int(sr * 0.01))
    if n <= win * 2:
        return a
    first = None
    for i in range(0, n - win + 1, win):
        blk = a[i:i + win]
        if (sum(v * v for v in blk) / win) ** 0.5 / 32768.0 >= thr:
            first = i
            break
    if first is None:
        return a
    last = n
    for i in range((n - win) // win * win, -1, -win):
        blk = a[i:i + win]
        if (sum(v * v for v in blk) / win) ** 0.5 / 32768.0 >= thr:
            last = i + win
            break
    s = max(0, first - int(sr * keep_lead))
    e = min(n, last + int(sr * keep_trail))
    return a[s:e] if e - s > win else a


def _fallback_arg(gap, is_last):
    """片段之间铺的停顿：表值减去首尾各留的那点余量，保证听感时长就是表里的数。"""
    if is_last:
        return 0.0
    return max(GAP_FLOOR, gap - 0.045)


def _fade(a, sr, fin=0.006, fout=0.013):
    """首尾渐入渐出。硬拼两段波形会有「咔」的一声，实测最明显的地方就是这里。"""
    ni = min(int(sr * fin), max(1, len(a) // 3))
    no = min(int(sr * fout), max(1, len(a) // 3))
    for i in range(ni):
        a[i] = int(a[i] * (i / float(ni)))
    for i in range(no):
        k = len(a) - 1 - i
        a[k] = int(a[k] * (i / float(no)))
    return a


def _gap(sr, sec):
    """停顿音频。铺一层 -62 dBFS 的极轻底噪：绝对零会像录音断线，
    有这一点点底噪才像同一个房间里的自然留白，也顺带糊住拼接点。"""
    n = int(sr * sec)
    if n <= 0:
        return array.array('h')
    return array.array('h', (int(random.uniform(-GAP_NOISE, GAP_NOISE)) for _ in range(n)))


def _join(items):
    """[(wav 字节, 其后停顿秒数)] -> 一个 WAV 字节串。最后一段之后的停顿不铺。"""
    frames = array.array('h')
    sr = None
    last = len(items) - 1
    for idx, (data, gap) in enumerate(items):
        s, a = _read_wav(data)
        if sr is None:
            sr = s
        elif s != sr:
            raise RuntimeError('采样率不一致：%s vs %s' % (sr, s))
        frames.extend(_fade(_trim(a, sr), sr))
        g = _fallback_arg(gap, idx == last)
        if g > 0:
            frames.extend(_gap(sr, g))
    if sr is None:
        raise RuntimeError('nothing to join')
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(frames.tobytes())
    return buf.getvalue()


def _synth_one(text, voice, length_scale, silence_scale):
    """合成一个片段，带片段级缓存。"""
    key = (voice, text, length_scale, silence_scale)
    with _cache_lock:
        if key in _seg_cache:
            _seg_cache.move_to_end(key)
            return _seg_cache[key]

    exe = find_exe()
    if not exe:
        raise RuntimeError('engine missing: run 安装语音包.cmd first')
    _d, files = voice_files(voice)
    missing = [p for p in files if not os.path.isfile(p)]
    if missing:
        raise RuntimeError('model missing: ' + missing[0])

    with _sem:
        fd, out = tempfile.mkstemp(prefix='moyin_', suffix='.wav', dir=tempfile.gettempdir())
        os.close(fd)
        try:
            args = [exe] + build_args(voice, out, length_scale, silence_scale) + [text]
            kw = {}
            if os.name == 'nt':
                kw['creationflags'] = 0x08000000   # 不弹黑框
            r = subprocess.run(args, capture_output=True, timeout=90, **kw)
            if not os.path.isfile(out) or os.path.getsize(out) < 1000:
                err = (r.stderr or b'').decode('utf-8', 'ignore')[-300:]
                raise RuntimeError('synth failed rc=%s %s' % (r.returncode, err))
            with open(out, 'rb') as f:
                data = f.read()
        finally:
            try:
                os.remove(out)
            except OSError:
                pass

    with _cache_lock:
        _seg_cache[key] = data
        _seg_cache.move_to_end(key)
        while len(_seg_cache) > SEG_CACHE_MAX:
            _seg_cache.popitem(last=False)
    return data


def synth(text, voice, speed):
    """切分 -> 并行合成 -> 按标点插停顿 -> 拼成一整段。失败抛 RuntimeError。"""
    text = clean_text(text)
    if not text:
        raise RuntimeError('empty text')
    # 选了没装好的音色时，落到第一个可用音色，不打断听书
    if voice not in VOICES or not voice_ready(voice):
        voice = next((v for v in VOICES if voice_ready(v)), 's12')
    key = (voice, text)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]

    units = merge_short(prosody_split(text))
    if not units:
        raise RuntimeError('empty text')

    parts = _synth_units(units, voice)
    if not parts:
        raise RuntimeError('全部片段都没有出声')
    data = _join(parts)

    with _cache_lock:
        _cache[key] = data
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)
    return data


class Handler(BaseHTTPRequestHandler):
    server_version = 'MoYinTTS/1.0'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        # 不记录任何朗读文本，只打印方法，避免隐私泄漏
        # /health 每 12 秒探一次、OPTIONS 只是预检，都不刷屏
        try:
            path = getattr(self, 'path', '') or ''
            if self.command == 'OPTIONS' or path.startswith('/health'):
                return
            print('[%s] %s %s' % (time.strftime('%H:%M:%S'), self.command, path), flush=True)
        except Exception:
            pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self._cors()
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_GET(self):
        if self.path.split('?')[0].rstrip('/') in ('/health', ''):
            self._send(200, json.dumps(health(), ensure_ascii=False))
        else:
            self._send(404, json.dumps({'error': 'not found'}, ensure_ascii=False))

    def do_POST(self):
        path = self.path.split('?')[0].rstrip('/')
        if path != '/tts':
            self._send(404, json.dumps({'error': 'not found'}, ensure_ascii=False))
            return
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if n <= 0 or n > 20000:
                raise ValueError('bad length')
            req = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception as e:
            self._send(400, json.dumps({'error': 'bad request: %s' % e}, ensure_ascii=False))
            return
        try:
            wav = synth(req.get('text'), req.get('voice') or 's12', req.get('speed') or 1)
            self._send(200, wav, 'audio/wav')
        except subprocess.TimeoutExpired:
            self._send(503, json.dumps({'error': '合成超时'}, ensure_ascii=False))
        except Exception as e:
            self._send(500, json.dumps({'error': str(e)}, ensure_ascii=False))


def open_reader():
    """服务起来后自动用 Edge 打开阅读器；加 --no-open 可禁用。"""
    html = os.path.abspath(os.path.join(HERE, os.pardir, 'MoYinReader.html'))
    if not os.path.isfile(html):
        return
    cands = [
        os.path.join(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'),
                     'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'),
                     'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]
    for e in cands:
        if os.path.isfile(e):
            try:
                subprocess.Popen([e, html], creationflags=0x08000000 if os.name == 'nt' else 0)
                return
            except Exception:
                pass
    try:
        import webbrowser
        webbrowser.open('file:///' + html.replace('\\', '/'))
    except Exception:
        pass


def main():
    st = health()
    print('=' * 52, flush=True)
    print('  墨吟 · 免费离线神经语音引擎', flush=True)
    print('=' * 52, flush=True)
    print('  端口     : http://127.0.0.1:%d (仅本机)' % PORT, flush=True)
    print('  引擎     : %s' % st['engine'], flush=True)
    print('  音色     : %d 个就绪 / 共 %d 个' % (sum(st['voices'].values()), len(VOICES)), flush=True)
    for v, okk in st['voices'].items():
        print('    %-10s %-20s %s' % (v, VOICES[v]['label'], '就绪' if okk else '缺失'), flush=True)
    if not st['ok']:
        print('\n  [!] 引擎或模型缺失，请先双击「安装语音包.cmd」', flush=True)
    else:
        print('\n  已就绪。切回阅读器，绿色「● 免费神经语音」即已连上。', flush=True)
    print('  关掉本窗口即停止服务（阅读器会自动退回系统语音）。\n', flush=True)
    if '--no-open' not in sys.argv:
        threading.Timer(0.6, open_reader).start()
    try:
        srv = QuietServer(('127.0.0.1', PORT), Handler)
        srv.daemon_threads = True
        srv.serve_forever()
    except OSError as e:
        print('  [!] 端口启动失败：%s' % e, flush=True)
        print('  可能已被占用。可改用别的端口：python tts_server.py 8188', flush=True)
        print('  并在阅读器「阅读设置 → 免费神经语音 → 端口」填同样的数字。', flush=True)
        if sys.stdin is not None and sys.stdin.isatty():
            input('按回车退出…')
    except KeyboardInterrupt:
        print('\n  已停止。', flush=True)


class QuietServer(ThreadingHTTPServer):
    """浏览器切段 / 关页时会主动断开连接，这属于正常现象，不该刷一屏 Python 堆栈。"""
    daemon_threads = True

    def handle_error(self, request, client_address):
        e = sys.exc_info()[1]
        if isinstance(e, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
            return
        ThreadingHTTPServer.handle_error(self, request, client_address)


if __name__ == '__main__':
    # PyInstaller --windowed 下 sys.stdout/stderr 是 None，print 会直接抛异常
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')
    if os.name == 'nt':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    main()

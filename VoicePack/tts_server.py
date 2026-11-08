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
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from collections import OrderedDict
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


_sem = threading.Semaphore(2)          # 最多同时跑 2 个合成进程，避免老机器卡
_cache = OrderedDict()                 # 同句重复朗读直接复用，最多 48 条
_cache_lock = threading.Lock()
CACHE_MAX = 48
MAX_TEXT = 600                         # 单次最多 600 字，防止超长文本卡死
# 句间停顿倍率：1.0 = 引擎基准（句号约 0.5~0.9 秒）。详见 build_args 里的注释。
SILENCE_SCALE = 1.0


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


def build_args(voice, out):
    """按音色拼出引擎命令行参数（VITS 模型 + 可选 sid / 中文规则）。"""
    s = VOICES[voice]
    _d, f = voice_files(voice)
    a = ['--vits-model=' + f[0], '--vits-tokens=' + f[1], '--vits-lexicon=' + f[2]]
    if s.get('sid') is not None:
        a.append('--sid=' + str(s['sid']))
    if s.get('fsts'):
        a.append('--tts-rule-fsts=' + ','.join(f[3:]))
    # 句间停顿倍率。引擎默认 0.2 是把停顿压到 1/5，实测句号处只剩 0.1~0.25 秒，
    # 一整段念下来听不出分句（用户 2026-11-08 报的就是这个）。
    # 改成 1.0 即引擎的基准时长，句号处 0.5~0.9 秒，逗号仍很短，听起来才像念书。
    a.append('--tts-silence-scale=%s' % SILENCE_SCALE)
    return a + ['--num-threads=2', '--output-filename=' + out]


def clean_text(s):
    s = str(s or '').replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')
    s = ''.join(ch for ch in s if ord(ch) >= 32 and ord(ch) != 127)
    # 合并多余空白，模型不需要连续空格
    out = []
    for ch in s:
        if ch == ' ' and (not out or out[-1] == ' '):
            continue
        out.append(ch)
    return ''.join(out).strip()[:MAX_TEXT]


def synth(text, voice, speed):
    """调用本机引擎生成 wav 字节；失败抛 RuntimeError。"""
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
            args = [exe] + build_args(voice, out) + [text]
            # 用 CREATE_NO_WINDOW 避免每句都闪一个黑框
            kw = {}
            if os.name == 'nt':
                kw['creationflags'] = 0x08000000
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

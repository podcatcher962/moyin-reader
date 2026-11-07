# -*- coding: utf-8 -*-
"""
墨吟阅读器 · Windows 桌面版外壳
================================
把单文件 MoYinReader.html 内嵌进 exe，启动时在 127.0.0.1 起一个只读
loopback 服务，页面从 http://127.0.0.1:<port>/ 进来（正经安全上下文，
IndexedDB / 文件选择 / 下载 / fetch 本机语音服务都正常）。

与双击 HTML 的区别：这里的存储 origin 是 http://127.0.0.1:38975，
和 file:// 不是同一份 IndexedDB。旧书请用「备份导出 → 备份导入」搬过来。

用法：
  MoYinReader.exe                 正常开窗
  MoYinReader.exe --selftest      不开窗，自检内嵌页面与本地服务
  MoYinReader.exe --domcheck=F    开窗后在窗口进程里做 DOM 断言，结果写 F
  MoYinReader.exe --beacon        打开就绪信标（调试用）
"""
import hashlib
import io
import json
import os
import secrets
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APP = 'MoYinReader'
APP_CN = '墨吟阅读器'
VER = '1.7.0'
VOICE_PORT = 8177
PORTS = (38975, 38976, 0)
CREATE_NO_WINDOW = 0x08000000

# 完整版 EXE 把 VoicePack 压成 zip 追加在 PE 尾部（overlay），文件末尾
# 56 字节是索引 '<8sQQ32s'。轻量版没有这段，会自动回落到同目录 VoicePack。
BUNDLE_MAGIC = b'MOYINVP1'
BUNDLE_TAIL = 56
BUNDLE_NOTE = b''          # 首次释放语音库后，注入页面的一次性提示
VOICE_PROC = None          # 由本进程拉起的语音服务子进程，退出时一并停掉
VOICE_SRV = None           # 同进程内起的语音服务（线程方式），优先于子进程

TOKEN = secrets.token_hex(16)
PAGE_CACHE = None
SERVER = None
PORT = 0
BEACON = []


# ---------------------------------------------------------------- 路径
def res_dir():
    """PyInstaller onefile 解包目录优先；源码运行时取脚本同级。"""
    return getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))


def base_dir():
    """exe 所在目录（VoicePack 在它旁边）；源码运行时取项目父目录。"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def local_dir():
    d = os.path.join(os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), APP)
    os.makedirs(d, exist_ok=True)
    return d


def page_file():
    return os.path.join(res_dir(), 'MoYinReader.html')


# ---------------------------------------------------------------- 注入脚本
MARK = ('<script>window.__MOYIN_DESKTOP__={app:"%s",ver:"%s"}</script>'
        % (APP, VER)).encode('utf-8')

SAVE_JS = """<script>(function(){
if(window.__moyinSave)return;window.__moyinSave=1;
var TK='%s';
var say=function(m){try{var d=document.createElement('div');d.textContent=m;d.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;padding:12px 16px;background:#26303A;color:#F0E6CE;border-radius:8px;font-size:14px';document.body.appendChild(d);setTimeout(function(){d.remove();},6500);}catch(e){}};
var orig=HTMLAnchorElement.prototype.click;
function back(el,why){try{orig.apply(el,[]);}catch(e){}}
function push(el,h,nm){
  fetch(h).then(function(r){return r.blob();}).then(function(b){
    return fetch('/__save?token='+TK+'&name='+encodeURIComponent(nm),
      {method:'POST',body:b,headers:{'Content-Type':'application/octet-stream'}});
  }).then(function(r){return r.text().then(function(s){return {t:s||'',st:r.status};});})
  .then(function(o){
    if(o.t.indexOf('ok:')===0)say('已保存到：'+o.t.slice(3));
    else back(el,o.st+' '+o.t);
  }).catch(function(){back(el,'');});
}
HTMLAnchorElement.prototype.click=function(){
  try{var h=this.href||'';var nm=this.getAttribute('download');
    if(nm&&h.indexOf('blob:')===0){push(this,h,nm);return;}}catch(e){}
  return orig.apply(this,arguments);
};
})();</script>""" % TOKEN

BEACON_JS = """<script>(function(){
function p(t){try{
var d={tag:t,rs:document.readyState,title:document.title,
ready:(window.MY&&MY.CFG)?1:0,nodes:document.querySelectorAll('*').length,
body:document.body?document.body.childElementCount:0,st:Math.round(performance.now())};
fetch('/rdy?d='+encodeURIComponent(JSON.stringify(d)));}catch(e){}}
p('boot');document.addEventListener('DOMContentLoaded',function(){p('dcl');});
window.addEventListener('load',function(){p('load');});
setTimeout(function(){p('t3');},3000);})();</script>"""


def page_bytes(with_beacon=False):
    global PAGE_CACHE
    if PAGE_CACHE is None:
        with open(page_file(), 'rb') as f:
            b = f.read()
        inject = MARK + SAVE_JS.encode('utf-8')
        if with_beacon:
            inject += BEACON_JS.encode('utf-8')
        i = b.find(b'</head>')
        b = (b[:i] + inject + b[i:]) if i >= 0 else (inject + b)
        PAGE_CACHE = b
    return PAGE_CACHE


# ---------------------------------------------------------------- 本地 HTTP
class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False       # 必须为 False，否则端口被占时 bind 成功却收不到请求


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *a):
        pass

    def _send(self, code, mime, body, extra=''):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        if extra:
            self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path in ('/', '/index.html'):
            body = page_bytes(os.environ.get('PW_BEACON') == '1')
            if BUNDLE_NOTE:
                i = body.find(b'</head>')
                body = (body[:i] + BUNDLE_NOTE + body[i:]) if i >= 0 else BUNDLE_NOTE + body
            self._send(200, 'text/html; charset=utf-8', body)
        elif path == '/__ping':
            self._send(200, 'application/json; charset=utf-8',
                       json.dumps({'ok': True, 'app': APP, 'ver': VER, 'port': PORT}))
        elif path == '/rdy':
            q = self.path.split('?', 1)[-1]
            try:
                from urllib.parse import unquote
                BEACON.append(json.loads(unquote(q[2:])))
            except Exception:
                pass
            self._send(200, 'text/plain', 'ok')
        else:
            self._send(404, 'text/plain; charset=utf-8', '没有这个文件')

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        if path != '/__save':
            self._send(404, 'text/plain; charset=utf-8', '只读')
            return
        query = self.path.split('?', 1)[-1] if '?' in self.path else ''
        from urllib.parse import unquote
        q = {}
        for kv in query.split('&'):
            if '=' in kv:
                k, v = kv.split('=', 1)
                q[k] = unquote(v)
        if q.get('token') != TOKEN:
            self._send(403, 'text/plain; charset=utf-8', '令牌不对')
            return
        try:
            n = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            n = 0
        if n <= 0 or n > 200 * 1024 * 1024:
            self._send(411, 'text/plain; charset=utf-8', '长度不合法')
            return
        name = os.path.basename(str(q.get('name') or 'MoYin-backup.json')).strip()
        for ch in '\\/:*?"<>|':
            name = name.replace(ch, '-')
        name = name.lstrip('.')[:90] or 'MoYin-backup.json'
        if not name.lower().endswith(('.json', '.txt', '.epub')):
            self._send(400, 'text/plain; charset=utf-8', '只收 json/txt/epub 备份')
            return
        folder = os.path.join(os.path.expanduser('~'), 'Documents', '墨吟备份')
        try:
            os.makedirs(folder, exist_ok=True)
        except OSError:
            folder = local_dir()
        target = os.path.join(folder, name)
        i = 2
        while os.path.exists(target):
            root, ext = os.path.splitext(name)
            target = os.path.join(folder, '%s (%d)%s' % (root, i, ext))
            i += 1
        try:
            left = n
            with open(target, 'wb') as f:
                while left > 0:
                    chunk = self.rfile.read(min(65536, left))
                    if not chunk:
                        break
                    f.write(chunk)
                    left -= len(chunk)
        except OSError:
            self._send(500, 'text/plain; charset=utf-8', '写不进去')
            return
        self._send(200, 'text/plain; charset=utf-8', 'ok:' + target)


def start_server():
    global SERVER, PORT
    for p in PORTS:
        try:
            s = Server(('127.0.0.1', p), Handler)
            SERVER, PORT = s, s.server_address[1]
            break
        except OSError:
            continue
    if SERVER is None:
        raise RuntimeError('找不到可用端口')
    threading.Thread(target=SERVER.serve_forever, daemon=True).start()
    return PORT


def url():
    return 'http://127.0.0.1:%d/index.html' % PORT


# ---------------------------------------------------------------- 内置语音包
class _Slice(io.RawIOBase):
    """把 exe 里的 [off, off+size) 包装成独立文件对象交给 ZipFile。"""

    def __init__(self, f, off, size):
        self.f, self.off, self.size, self.pos = f, off, size, 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, pos, whence=0):
        if whence == 0:
            p = pos
        elif whence == 1:
            p = self.pos + pos
        elif whence == 2:
            p = self.size + pos
        else:
            raise ValueError('bad whence')
        self.pos = max(0, min(p, self.size))
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.size - self.pos
        n = min(n, self.size - self.pos)
        if n <= 0:
            return b''
        self.f.seek(self.off + self.pos)
        d = self.f.read(n)
        self.pos += len(d)
        return d

    def readinto(self, b):
        d = self.read(len(b))
        b[:len(d)] = d
        return len(d)


def bundle_info():
    """(exe 路径, zip 起点, zip 长度, sha256)；轻量版返回 None。"""
    if not getattr(sys, 'frozen', False):
        return None
    exe = sys.executable
    try:
        with open(exe, 'rb') as f:
            f.seek(0, 2)
            n = f.tell()
            if n < BUNDLE_TAIL + 4096:
                return None
            f.seek(n - BUNDLE_TAIL)
            tail = f.read(BUNDLE_TAIL)
        magic, off, size, sha = struct.unpack('<8sQQ32s', tail)
        if magic != BUNDLE_MAGIC or off + size + BUNDLE_TAIL != n or size < 4096:
            return None
        return (exe, off, size, sha.hex())
    except Exception:
        return None


def window_title():
    return '%s · %s%s' % (APP_CN, VER, '（内置语音）' if bundle_info() else '')


def cache_dir():
    base = os.environ.get('LOCALAPPDATA') or tempfile.gettempdir()
    return os.path.join(base, APP, 'VoicePack')


# 判断缓存是否完整：引擎 + 唯一的 AISHELL3 模型 + 服务脚本
BUNDLE_MUST = (
    'tts_server.py',
    'engine/bin/sherpa-onnx-offline-tts.exe',
    'models/aishell3/model.onnx',
    'models/aishell3/tokens.txt',
    'models/aishell3/lexicon.txt',
    'models/aishell3/date.fst',
    'models/aishell3/number.fst',
    'models/aishell3/phone.fst',
)


def bundle_ready(d, sha):
    try:
        with io.open(os.path.join(d, '.moyin_stamp'), encoding='ascii') as f:
            if f.read().strip() != sha:
                return False
        return all(os.path.isfile(os.path.join(d, x.replace('/', os.sep)))
                   for x in BUNDLE_MUST)
    except Exception:
        return False


def extract_bundle(info):
    """首次启动释放语音库到本机缓存；之后靠 stamp 直接复用。"""
    global BUNDLE_NOTE
    exe, off, size, sha = info
    dst = cache_dir()
    if bundle_ready(dst, sha):
        return dst
    t0 = time.time()
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    # 只清理由本程序自己建过的目录（带 .moyin_owned 标记），不碰用户文件
    if os.path.isdir(dst) and os.path.isfile(os.path.join(dst, '.moyin_owned')):
        shutil.rmtree(dst, ignore_errors=True)
    os.makedirs(dst, exist_ok=True)
    with open(exe, 'rb') as f:
        with zipfile.ZipFile(io.BufferedReader(_Slice(f, off, size))) as zf:
            for name in zf.namelist():
                rel = name.replace('\\', '/').lstrip('/')
                parts = [x for x in rel.split('/') if x not in ('', '.')]
                if not parts or '..' in parts or ':' in parts[0]:
                    raise RuntimeError('压缩包路径不合法: ' + name)
                if name.endswith('/'):
                    os.makedirs(os.path.join(dst, *parts), exist_ok=True)
                    continue
                target = os.path.join(dst, *parts)
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with zf.open(name) as r, open(target, 'wb') as w:
                    shutil.copyfileobj(r, w, 1024 * 1024)
    # stamp 最后写：中途失败下次启动会重新释放
    with io.open(os.path.join(dst, '.moyin_stamp'), 'w', encoding='ascii') as f:
        f.write(sha)
    with io.open(os.path.join(dst, '.moyin_owned'), 'w', encoding='ascii') as f:
        f.write('MoYinReader bundled voice pack\n')
    if not bundle_ready(dst, sha):
        raise RuntimeError('释放后关键文件不全')
    BUNDLE_NOTE = (
        '<script>(function(){setTimeout(function(){try{'
        'var d=document.createElement("div");'
        'd.textContent="内置神经语音已就绪：174 个中文说话人已释放到本机缓存，下次启动会更快。";'
        'd.style.cssText="position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;'
        'padding:12px 16px;background:#26303A;color:#F0E6CE;border-radius:8px;font-size:14px";'
        'document.body.appendChild(d);setTimeout(function(){d.remove();},8000);'
        '}catch(e){}},1500);})();</script>'
    ).encode('utf-8')
    print('语音库首次释放完成 %.1f 秒 -> %s' % (time.time() - t0, dst), flush=True)
    return dst


def prepare_voice_dir():
    """可用语音包目录：同目录 VoicePack 优先，其次 EXE 内置包。"""
    side = os.path.join(base_dir(), 'VoicePack')
    if os.path.isfile(os.path.join(side, 'models', 'aishell3', 'model.onnx')):
        return side
    info = bundle_info()
    if info:
        try:
            return extract_bundle(info)
        except Exception:
            return None
    return side


# ---------------------------------------------------------------- 语音引擎
def voice_health():
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/health' % VOICE_PORT,
                                    timeout=0.7) as r:
            return r.status == 200
    except Exception:
        return False


def stop_voice_proc():
    """关掉本进程自己拉起的服务；不是我们起的不动。"""
    global VOICE_PROC, VOICE_SRV
    p, VOICE_PROC = VOICE_PROC, None
    if p is not None:
        try:
            p.terminate()
        except Exception:
            pass
    srv, VOICE_SRV = VOICE_SRV, None
    if srv is not None:
        try:
            srv.shutdown()
            srv.server_close()
        except Exception:
            pass


def start_voice_inproc(vp):
    """在阅读器进程内起语音服务线程，不再复制一个 47 MB 的自己。

    旧做法是「同一个 exe 再启动一个实例」跑服务：父子共用同一个 PyInstaller
    解包目录，父进程退出时删不掉，会弹 “Failed to remove temporary directory”
    的警告框，子进程也被拖住不退。改成同进程线程后没有这个尾巴，
    首句合成也不用等第二个实例解包。
    """
    global VOICE_SRV
    if VOICE_SRV is not None:
        return True
    try:
        os.environ['MOYIN_VOICE_ROOT'] = vp
        if res_dir() not in sys.path:
            sys.path.insert(0, res_dir())
        import tts_server
        tts_server.PORT = VOICE_PORT
        srv = tts_server.QuietServer(('127.0.0.1', VOICE_PORT), tts_server.Handler)
        srv.daemon_threads = True
        threading.Thread(target=srv.serve_forever, name='moyin-voice',
                         daemon=True).start()
        VOICE_SRV = srv
        return True
    except Exception:
        VOICE_SRV = None
        return False


def ensure_voice():
    """服务没起就拉起：同进程线程 → 独立 MoYinVoice.exe → 系统 Python。"""
    global VOICE_PROC
    if voice_health():
        return 'running'
    vp = prepare_voice_dir()
    exe = os.path.join(vp, 'MoYinVoice.exe')
    script = os.path.join(vp, 'tts_server.py')
    bundled = os.path.normcase(vp) == os.path.normcase(cache_dir())
    try:
        env = dict(os.environ)
        env['MOYIN_VOICE_ROOT'] = vp
        if getattr(sys, 'frozen', False) and os.path.isfile(os.path.join(res_dir(), 'tts_server.py')):
            if start_voice_inproc(vp):
                return 'started-inproc' + ('-bundled' if bundled else '')
        if os.path.isfile(exe):
            VOICE_PROC = subprocess.Popen(
                [exe, str(VOICE_PORT), '--no-open'], cwd=vp, env=env,
                creationflags=CREATE_NO_WINDOW,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return 'started-exe' + ('-bundled' if bundled else '')
        py = shutil.which('python') or shutil.which('python3')
        if py and os.path.isfile(script):
            VOICE_PROC = subprocess.Popen(
                [py, script, str(VOICE_PORT), '--no-open'], cwd=vp, env=env,
                creationflags=CREATE_NO_WINDOW,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return 'started-python'
    except OSError:
        pass
    return 'unavailable'      # 静默回退系统语音，不打扰阅读


def run_tts_server(args):
    """第二实例入口：加载内嵌的 tts_server.py，在本机 127.0.0.1 提供合成服务。"""
    port = VOICE_PORT
    for a in args:
        if a.startswith('--ttsserver='):
            try:
                port = int(a.split('=', 1)[1])
            except ValueError:
                pass
    vp = prepare_voice_dir()
    if not vp or not os.path.isfile(os.path.join(vp, 'tts_server.py')):
        return 3
    os.environ['MOYIN_VOICE_ROOT'] = vp
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')
    try:
        sys.stdin = open(os.devnull, 'r')
    except Exception:
        pass
    sys.path.insert(0, res_dir())
    import tts_server
    tts_server.PORT = port
    tts_server.main()
    return 0


# ---------------------------------------------------------------- 单实例
def single_instance():
    import msvcrt
    f = open(os.path.join(local_dir(), 'app.lock'), 'a+')
    try:
        f.seek(0)
        f.write('x')
        f.flush()
        f.seek(0)
        msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
        return f                    # 必须持有引用，锁才不会随 GC 释放
    except OSError:
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(
                0, '墨吟阅读器已经在运行了。\n请看一下任务栏，或到托盘找找窗口。',
                APP_CN, 0x40)
        except Exception:
            pass
        return None


# ---------------------------------------------------------------- 自检
def selftest(out=None):
    lines = []

    def ck(cond, msg):
        lines.append(('PASS ' if cond else 'FAIL ') + msg)
        return bool(cond)

    ok = True
    p = page_file()
    ok &= ck(os.path.isfile(p), '内嵌页面存在: ' + p)
    raw = open(p, 'rb').read() if os.path.isfile(p) else b''
    ok &= ck(len(raw) > 80000, '页面体积 %d B' % len(raw))
    ok &= ck(b'<html' in raw.lower() and b'MoYin' in raw, '页面是墨吟阅读器 HTML')
    start_server()
    ok &= ck(PORT > 0, '本地服务绑定端口 %d' % PORT)
    try:
        req = urllib.request.Request(url())
        with urllib.request.urlopen(req, timeout=5) as r:
            body = r.read()
        ok &= ck(r.status == 200 and len(body) > len(raw), 'GET / 返回注入后的页面')
        ok &= ck(b'__MOYIN_DESKTOP__' in body and b'__moyinSave' in body, '桌面标记与备份通道已注入')
        inject = MARK + SAVE_JS.encode('utf-8')
        ok &= ck(body.replace(inject, b'', 1) == raw, '剥掉注入脚本后与源文件逐字节一致')
    except Exception as e:
        ok &= ck(False, 'GET / 失败: %s' % e)
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/__ping' % PORT, timeout=5) as r:
            j = json.loads(r.read())
        ok &= ck(j.get('app') == APP and j.get('ver') == VER, '/__ping 版本正确')
    except Exception as e:
        ok &= ck(False, '/__ping 失败: %s' % e)
    try:
        urllib.request.urlopen('http://127.0.0.1:%d/nope' % PORT, timeout=5)
        ok &= ck(False, '陌生路径应 404')
    except urllib.error.HTTPError as e:
        ok &= ck(e.code == 404, '陌生路径返回 404')
    except Exception as e:
        ok &= ck(False, '404 检查异常: %s' % e)
    # POST /__save 走一遍（含令牌门）
    try:
        import http.client
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=8)
        c.request('POST', '/__save?token=' + TOKEN + '&name=_selftest.json',
                  b'{"hello":"moyin"}', {'Content-Type': 'application/octet-stream'})
        r = c.getresponse()
        txt = r.read().decode('utf-8', 'replace')
        c.close()
        ok &= ck(r.status == 200 and txt.startswith('ok:'), '备份落盘通道可用')
        if txt.startswith('ok:') and os.path.isfile(txt[3:]):
            os.remove(txt[3:])
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=8)
        c.request('POST', '/__save?token=bad&name=x.json', b'x')
        r = c.getresponse(); r.read(); c.close()
        ok &= ck(r.status == 403, '错误令牌被拒绝')
    except Exception as e:
        ok &= ck(False, '/__save 异常: %s' % e)
    # 完整版：不解压，只静态核对尾部语音包索引与压缩包清单
    bi = bundle_info()
    if bi:
        exe, off, size, sha = bi
        ok &= ck(size > 10 * 1024 * 1024, 'EXE 尾部有语音包 %d MB' % (size // 1048576))
        try:
            with open(exe, 'rb') as f:
                with zipfile.ZipFile(io.BufferedReader(_Slice(f, off, size))) as zf:
                    names = zf.namelist()
            ok &= ck(all(x in names for x in BUNDLE_MUST), '压缩包含引擎与全部音色模型')
            ok &= ck(all(not n.startswith('/') and '..' not in n.split('/') for n in names),
                     '压缩包无路径穿越 (%d 个条目)' % len(names))
        except Exception as e:
            ok &= ck(False, '语音包不可读: %s' % e)
    text = '\n'.join(lines) + '\n' + ('ALL PASS' if ok else 'HAS FAIL')
    print(text)
    if out:
        with io.open(out, 'w', encoding='utf-8') as f:
            f.write(text + '\n')
    return 0 if ok else 1


def voiceprobe(out=None):
    """验收用：真的释放内置语音包、拉起服务、合成一句 WAV。"""
    lines = []

    def ck(c, m):
        lines.append(('PASS ' if c else 'FAIL ') + m)
        return bool(c)

    ok = True
    bi = bundle_info()
    ok &= ck(bi is not None, 'EXE 内含语音包')
    if bi:
        ok &= ck(bi[2] > 10 * 1024 * 1024, '语音包 %d MB' % (bi[2] // 1048576))
        t0 = time.time()
        d = prepare_voice_dir()
        ok &= ck(bool(d) and bundle_ready(d, bi[3]), '语音库已释放且关键文件齐全')
        print('释放耗时 %.1f 秒 -> %s' % (time.time() - t0, d), flush=True)
    state = ensure_voice()
    ok &= ck(state.startswith('started') or state == 'running', '语音服务状态: ' + state)
    j = None
    for _ in range(60):
        try:
            with urllib.request.urlopen('http://127.0.0.1:%d/health' % VOICE_PORT,
                                        timeout=1) as r:
                j = json.loads(r.read())
            if j.get('ok'):
                break
        except Exception:
            pass
        time.sleep(0.5)
    ok &= ck(bool(j and j.get('ok')), 'health 正常')
    if j:
        vs = j.get('voices') or {}
        ok &= ck(len(vs) == 174 and all(vs.values()), '174 个说话人全部就绪')
    try:
        import http.client
        b = json.dumps({'text': '窗外的雨下得很细，他合上书。',
                        'voice': 's12', 'speed': 1},
                       ensure_ascii=False).encode('utf-8')
        t = time.time()
        c = http.client.HTTPConnection('127.0.0.1', VOICE_PORT, timeout=90)
        c.request('POST', '/tts', b, {'Content-Type': 'application/json'})
        r = c.getresponse()
        wav = r.read()
        c.close()
        ok &= ck(r.status == 200 and wav[:4] == b'RIFF' and len(wav) > 20000,
                 '真实合成 WAV %d B / %.1f 秒' % (len(wav), time.time() - t))
    except Exception as e:
        ok &= ck(False, 'TTS 异常: %s' % e)
    text = '\n'.join(lines) + '\n' + ('ALL PASS' if ok else 'HAS FAIL')
    print(text)
    if out:
        with io.open(out, 'w', encoding='utf-8') as f:
            f.write(text + '\n')
    # 验收时可让进程多活一会儿：服务是同进程线程，进程一走服务就停
    hold = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--hold=')), None)
    if hold:
        try:
            left = float(hold)
        except ValueError:
            left = 0
        while left > 0:
            time.sleep(1)
            left -= 1
    return 0 if ok else 1


# ---------------------------------------------------------------- 窗口 DOM 自检
def domcheck(path):
    import webview
    result = {'lines': []}

    def guard():
        time.sleep(90)
        try:
            with io.open(path, 'w', encoding='utf-8') as f:
                f.write('FAIL domcheck 超过 90 秒未完成\n')
        except Exception:
            pass
        os._exit(9)

    threading.Thread(target=guard, daemon=True).start()

    def after_start(win):
        def run():
            out = []

            def ck(c, m):
                out.append(('PASS ' if c else 'FAIL ') + m)

            probe = ("JSON.stringify({my:!!(window.MY&&MY.CFG),rs:document.readyState,"
                     "nodes:document.querySelectorAll('*').length,"
                     "body:document.body?document.body.childElementCount:0,"
                     "shelf:!!document.getElementById('shelf'),"
                     "btnImport:!!document.getElementById('btnImport'),"
                     "spTry:!!document.getElementById('spTry'),"
                     "voices:window.MY&&MY.LOCAL_VOICES?MY.LOCAL_VOICES.length:0,"
                     "total:(window.MY&&MY.voiceStat)?MY.voiceStat().total:0,"
                     "local:!!(window.MY&&MY.LOCAL&&MY.LOCAL.ready),"
                     "db:typeof indexedDB})")
            snap = {}
            for _ in range(60):
                try:
                    raw = win.evaluate_js(probe)
                    if raw:
                        snap = json.loads(raw)
                        # localProbe() 是异步的，等它真正连上本机语音引擎再收快照
                        if snap.get('my') and snap.get('local'):
                            break
                except Exception:
                    pass
                time.sleep(0.5)
            out.append('SNAP ' + json.dumps(snap, ensure_ascii=False))
            try:
                ck(win.evaluate_js('document.readyState') == 'complete', 'readyState complete')
                ck(win.evaluate_js('!!window.__MOYIN_DESKTOP__'), '桌面标记已注入')
                ck(win.evaluate_js("location.protocol==='http:'"), '走 http 而非 file://')
                ck(snap.get('my') is True, '应用已初始化(window.MY)')
                ck(snap.get('shelf') is True, '书架节点存在')
                ck((snap.get('nodes') or 0) >= 80, 'DOM 规模正常(空书架约 103 节点)')
                ck((snap.get('body') or 0) >= 2, 'body 有内容')
                ck(snap.get('btnImport') is True and snap.get('spTry') is True,
                   '导入按钮与朗读按钮都在')
                ck((snap.get('voices') or 0) >= 11, '内置声线表已加载（精选 11 个兜底）')
                ck(snap.get('total') == 174, '页面拿到全部 174 个说话人')
                ck(snap.get('local') is True, '已连上本机免费神经语音(8177)')
                ck(snap.get('db') == 'object', 'IndexedDB 可用')
                ck(win.evaluate_js('!!window.__moyinSave'), '备份通道已挂载')
            except Exception as e:
                ck(False, 'evaluate_js 异常: %s' % e)
            with io.open(path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(out) + '\n')
            try:
                win.destroy()
            except Exception:
                pass

        threading.Thread(target=run, daemon=True).start()

    w = webview.create_window(window_title(), url(), width=1180, height=800)
    webview.start(after_start, (w,), private_mode=False,
                  storage_path=os.path.join(local_dir(), 'webview'), debug=False)
    return 0


# ---------------------------------------------------------------- 主入口
def main():
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')
    args = sys.argv[1:]
    if any(a.startswith('--ttsserver') for a in args):
        return run_tts_server(args)
    if any(a.startswith('--voiceprobe') for a in args):
        out = next((a.split('=', 1)[1] for a in args if a.startswith('--voiceprobe=')), None)
        return voiceprobe(out)
    if any(a.startswith('--selftest') for a in args):
        out = next((a.split('=', 1)[1] for a in args if a.startswith('--selftest=')), None)
        return selftest(out)
    if any(a.startswith('--domcheck') for a in args):
        start_server()
        ensure_voice()          # 与正常启动同构：没起服务就自动拉起 MoYinVoice.exe
        out = next((a.split('=', 1)[1] for a in args if a.startswith('--domcheck=')), None)
        if not out:
            print('需要 --domcheck=文件')
            return 2
        rc = domcheck(out)
        stop_voice_proc()
        return rc
    if '--beacon' in args:
        os.environ['PW_BEACON'] = '1'

    lock = single_instance()
    if lock is None:
        return 0
    start_server()
    voice = ensure_voice()
    if voice.startswith('started'):
        # 给引擎一点初始化时间，页面自己的 localProbe 会重试
        pass

    import webview
    webview.settings['ALLOW_DOWNLOADS'] = True
    storage = os.path.join(local_dir(), 'webview')
    os.makedirs(storage, exist_ok=True)
    w = webview.create_window(window_title(), url(),
                              width=1180, height=800, min_size=(760, 520),
                              background_color='#F5F2EA')
    try:
        webview.start(private_mode=False, storage_path=storage, debug=False)
    finally:
        try:
            SERVER.shutdown()
        except Exception:
            pass
        stop_voice_proc()
    return 0


if __name__ == '__main__':
    sys.exit(main())

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
import urllib.parse
import urllib.request
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APP = 'MoYinReader'
APP_CN = '墨吟阅读器'
VER = '1.10.1'
VOICE_PORT = 8177
PORTS = (38975, 38976, 0)
CREATE_NO_WINDOW = 0x08000000
IS_WIN = os.name == 'nt'
IS_MAC = sys.platform == 'darwin'
IS_LINUX = (not IS_WIN) and (not IS_MAC)

# 完整版 EXE 把 VoicePack 压成 zip 追加在 PE 尾部（overlay），文件末尾
# 56 字节是索引 '<8sQQ32s'。轻量版没有这段，会自动回落到同目录 VoicePack。
BUNDLE_MAGIC = b'MOYINVP1'
BUNDLE_TAIL = 56
BUNDLE_NOTE = b''          # 首次释放语音库后，注入页面的一次性提示
VOICE_PROC = None          # 由本进程拉起的语音服务子进程，退出时一并停掉
VOICE_SRV = None           # 同进程内起的语音服务（线程方式），优先于子进程

TOKEN = secrets.token_hex(16)
NET_PROBE_SEC = 12          # 探测网络位置的最长等待（主机不在线时不必干等系统的 SMB 超时）
PAGE_CACHE = None
SERVER = None
PORT = 0
BEACON = []
PICK = {'sid': '', 'files': [], 'ts': 0}      # 上一次「选择文件夹」的授权名单


# ---------------------------------------------------------------- 选择文件夹
NOISE_DIRS = {'.git', '.svn', '.hg', 'node_modules', '__pycache__', 'venv', '.venv', 'env',
              'dist', 'build', 'site-packages', '.idea', '.vscode', 'voicepack', 'voicepack_lite'}


def is_net_path(p):
    """UNC 共享（\\\\主机\\共享）或映射到网络的盘符，都算「网络位置」。"""
    if not p:
        return False
    if p.startswith('\\\\'):
        return True
    try:
        if os.name == 'nt' and len(p) >= 2 and p[1] == ':':
            import ctypes
            drive = p[:2] + '\\'
            if ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(drive)) == 4:  # DRIVE_REMOTE
                return True
    except Exception:
        pass
    return False


def norm_net_path(raw):
    """把用户手输的路径收拾成 Windows 认的样子。

    接受 `\\\\192.168.1.10\\Books`、`//192.168.1.10/Books`、`192.168.1.10/Books`、
    `Z:\\Books`、`Z:/Books`，以及资源管理器「复制路径」带出来的双引号。
    """
    p = str(raw or '').replace('\u3000', ' ').strip()
    p = p.strip('"').strip("'").strip()
    if not p:
        return ''
    if not IS_WIN:
        # Linux / macOS 上「网络位置」就是挂载点（/mnt/nas、~/books、smb:// 之类），
        # 路径必须原样保留：早先无条件把 / 换成 \，会把 /tmp/x 变成「\\tmp\x」，整条路径失效。
        if p.startswith('\\\\') or p.startswith('//') or p.startswith('smb://'):
            return p
        q = os.path.expanduser(p)
        while len(q) > 1 and q.endswith('/'):
            q = q[:-1]                    # /mnt/nas/books/ → /mnt/nas/books
        return q
    p = p.replace('/', '\\')
    if p.startswith('\\\\?\\'):
        p = p[4:]
        if p[:4].upper() == 'UNC\\':
            p = '\\\\' + p[4:]            # \\?\UNC\nas\books → \\nas\books
    if p.startswith('\\') and not p.startswith('\\\\'):
        p = '\\' + p                      # 只写了一个反斜杠，补成 UNC
    elif not p.startswith('\\') and not (len(p) >= 2 and p[1] == ':'):
        p = '\\\\' + p                    # 192.168.1.10\Books → \\192.168.1.10\Books
    while len(p) > 2 and p.endswith('\\'):
        p = p[:-1]
    return p


def scan_dir(root, limit=500, min_size=1024, max_size=300 * 1024 * 1024):
    """只收像样的 txt / epub；太小的是 LICENSE 之类的杂物，跳过并计数。

    返回 (files, skipped, truncated)。上限默认 500 本，超出只取前 500 并置 truncated。
    """
    files, skipped, truncated = [], 0, False
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('.') and d.lower() not in NOISE_DIRS]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() not in ('.txt', '.epub'):
                continue
            full = os.path.join(dirpath, fn)
            try:
                st = os.stat(full)
            except OSError:
                continue
            if st.st_size < min_size or st.st_size > max_size:
                skipped += 1
                continue
            if len(files) >= limit:
                return files, skipped, True
            files.append({'name': fn, 'size': st.st_size, 'path': full})
    return files, skipped, truncated


def ask_folder(title):
    """原生「选择文件夹」对话框，绕开 WebView2 那个「选择要上传的文件夹」的浏览器选择器。"""
    if IS_MAC:
        return ask_folder_mac(title)
    if IS_LINUX:
        return ask_folder_linux(title)
    if not IS_WIN:
        return ''
    import ctypes
    from ctypes import wintypes
    ole32 = ctypes.windll.ole32
    shell32 = ctypes.windll.shell32
    user32 = ctypes.windll.user32

    class BROWSEINFOW(ctypes.Structure):
        _fields_ = [('hwndOwner', wintypes.HWND), ('pidlRoot', ctypes.c_void_p),
                    ('pszDisplayName', wintypes.LPWSTR), ('lpszTitle', wintypes.LPCWSTR),
                    ('ulFlags', wintypes.UINT), ('lpfn', ctypes.c_void_p),
                    ('lParam', wintypes.LPARAM), ('iImage', ctypes.c_int)]

    try:
        ole32.CoInitializeEx(None, 0x2)      # STA，BIF_NEWDIALOGSTYLE 需要
    except Exception:
        pass
    try:
        buf = ctypes.create_unicode_buffer(260)
        bi = BROWSEINFOW()
        bi.hwndOwner = user32.GetForegroundWindow()
        bi.pszDisplayName = ctypes.cast(buf, wintypes.LPWSTR)
        bi.lpszTitle = title
        bi.ulFlags = 0x0001 | 0x0010 | 0x0040     # 仅文件系统目录 + 可输入路径 + 新样式
        shell32.SHBrowseForFolderW.argtypes = [ctypes.POINTER(BROWSEINFOW)]
        shell32.SHBrowseForFolderW.restype = ctypes.c_void_p
        pidl = shell32.SHBrowseForFolderW(ctypes.byref(bi))
        if not pidl:
            return ''
        path = ctypes.create_unicode_buffer(1024)
        shell32.SHGetPathFromIDListW.argtypes = [ctypes.c_void_p, wintypes.LPWSTR]
        shell32.SHGetPathFromIDListW.restype = wintypes.BOOL
        ok = shell32.SHGetPathFromIDListW(ctypes.c_void_p(pidl), path)
        ole32.CoTaskMemFree(ctypes.c_void_p(pidl))
        return path.value if ok else ''
    finally:
        try:
            ole32.CoUninitialize()
        except Exception:
            pass


def ask_folder_mac(title):
    """macOS：用 AppleScript 调系统原生选文件夹面板。"""
    try:
        script = ('POSIX path of (choose folder with prompt "%s")'
                  % str(title).replace('"', "'"))
        r = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            return ''                      # 用户取消
        return (r.stdout or '').strip().rstrip('/') or ''
    except Exception:
        return ''


def ask_folder_linux(title):
    """Linux / 信创系统：zenity → kdialog → tkinter，谁在就用谁。

    信创机器常常装不了额外依赖，所以三级兜底；tkinter 是 python3 自带的
    （部分发行版拆到 python3-tk 包里），最后还有一层保底：返回空，让用户
    改从「网络位置」手填路径。
    """
    for cmd in (
        ['zenity', '--file-selection', '--directory', '--title=' + str(title)],
        ['kdialog', '--getexistingdirectory', os.path.expanduser('~'), '--title', str(title)],
    ):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            if r.returncode != 0:
                if r.returncode in (1, 255):      # 取消
                    return ''
                continue
            out = (r.stdout or '').strip()
            if out:
                return out
        except FileNotFoundError:
            continue
        except Exception:
            continue
    try:
        import tkinter
        from tkinter import filedialog
        root = tkinter.Tk()
        root.withdraw()
        d = filedialog.askdirectory(title=str(title))
        root.destroy()
        return d or ''
    except Exception:
        return ''


# ---------------------------------------------------------------- 路径
def res_dir():
    """PyInstaller onefile 解包目录优先；源码运行时取脚本同级。"""
    return getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))


def base_dir():
    """exe 所在目录（VoicePack 在它旁边）；源码运行时取项目父目录。"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def data_home():
    '''各平台的「应用数据」根目录。'''
    if IS_WIN:
        return os.environ.get('LOCALAPPDATA') or os.path.join(os.path.expanduser('~'), 'AppData', 'Local')
    if IS_MAC:
        return os.path.join(os.path.expanduser('~'), 'Library', 'Application Support')
    return os.environ.get('XDG_DATA_HOME') or os.path.join(os.path.expanduser('~'), '.local', 'share')


def local_dir():
    d = os.path.join(data_home(), APP)
    os.makedirs(d, exist_ok=True)
    return d


def page_file():
    return os.path.join(res_dir(), 'MoYinReader.html')


def geo_file():
    return os.path.join(local_dir(), 'window.json')


def load_geo():
    # 记住上次的窗口大小与位置；读不到就用默认值
    try:
        with open(geo_file(), 'r', encoding='utf-8') as f:
            d = json.load(f)
        out = {}
        for k in ('w', 'h', 'x', 'y'):
            v = d.get(k)
            if isinstance(v, (int, float)) and abs(v) < 30000:
                out[k] = int(v)
        # 宽高太小/太大说明上次异常，丢掉
        if out.get('w', 0) < 700 or out.get('h', 0) < 480:
            out.pop('w', None)
            out.pop('h', None)
        # 屏幕外的坐标也丢掉，免得窗口跑到看不见的地方
        if out.get('x', 0) < -4000:
            out.pop('x', None)
            out.pop('y', None)
        if out.get('y', 0) < -4000:
            out.pop('x', None)
            out.pop('y', None)
        return out
    except Exception:
        return {}


def save_geo(win):
    # 退出时记下窗口大小与位置（pywebview 各平台属性支持不一，能读多少读多少）
    d = {}
    try:
        d['w'] = int(win.width)
        d['h'] = int(win.height)
    except Exception:
        pass
    for k in ('x', 'y'):
        try:
            v = getattr(win, k)
            if isinstance(v, (int, float)):
                d[k] = int(v)
        except Exception:
            pass
    if not d:
        return
    try:
        with open(geo_file(), 'w', encoding='utf-8') as f:
            json.dump(d, f)
    except Exception:
        pass


# ---------------------------------------------------------------- 注入脚本
MARK = ('<script>window.__MOYIN_DESKTOP__={app:"%s",ver:"%s",pickDir:1}</script>'
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

# 桌面版专用：走 Python 的原生「选择文件夹」对话框，绕开 WebView2 那个
# 「选择要上传的文件夹 → 上传」的浏览器选择器（看着像要往网上传东西）
PICK_JS = """<script>(function(){
if(window.__moyinPickDir)return;
var TK='%s';
function grab(j){
  if(!j.ok) throw new Error(j.error||'选择文件夹失败');
  if(j.cancel) return {cancel:true,files:[],dir:''};
  var fs=j.files||[],out=[],i=0;
  function step(){
    if(i>=fs.length) return Promise.resolve({files:out,dir:j.dir,sid:j.sid,
      skipped:j.skipped||0,truncated:!!j.truncated,net:!!j.net,ms:j.ms||0});
    var f=fs[i++];
    return fetch('/__dirfile?sid='+j.sid+'&i='+f.i).then(function(r){
      if(!r.ok) throw new Error('读不到 '+f.name);
      return r.arrayBuffer();
    }).then(function(b){
      out.push({name:f.name,size:f.size,arrayBuffer:function(){return Promise.resolve(b);}});
      return step();
    });
  }
  return step();
}
window.__moyinPickDir=function(){
  return fetch('/__pickdir?token='+TK+'&lang='+((document.documentElement.lang||'zh').slice(0,2)),{method:'POST'})
    .then(function(r){return r.json();}).then(grab);
};
/* 网络位置 / 任意路径：SMB 共享（\\\\\\\\主机\\\\共享）、映射盘、本地绝对路径 */
window.__moyinScanDir=function(p){
  return fetch('/__scandir?token='+TK+'&path='+encodeURIComponent(p),{method:'POST'})
    .then(function(r){return r.json();}).then(grab);
};
})();</script>""" % TOKEN

BEACON_JS = """<script>(function(){function p(t){try{
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
        inject = MARK + SAVE_JS.encode('utf-8') + PICK_JS.encode('utf-8')
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

    def _q(self):
        from urllib.parse import unquote
        query = self.path.split('?', 1)[-1] if '?' in self.path else ''
        q = {}
        for kv in query.split('&'):
            if '=' in kv:
                k, v = kv.split('=', 1)
                q[k] = unquote(v)
        return q

    def _json(self, obj):
        self._send(200, 'application/json; charset=utf-8', json.dumps(obj, ensure_ascii=False))

    def _pickdir(self):
        en = self._q().get('lang') == 'en'
        try:
            d = ask_folder('Choose a folder to import (TXT / EPUB only)' if en
                           else '选择要导入的文件夹（只收 TXT / EPUB）')
        except Exception as e:
            self._json({'ok': False, 'error': '打开对话框失败：%s' % e})
            return
        if not d:
            self._json({'ok': True, 'cancel': True})
            return
        self._send_dir(d)

    def _scandir(self):
        """按路径扫描目录：SMB 共享（\\\\主机\\共享）、映射盘（Z:\\）、本地绝对路径都走这里。"""
        raw = str(self._q().get('path') or '')
        d = norm_net_path(raw)
        if not d:
            self._json({'ok': False, 'error': '路径是空的'})
            return
        if len(d) > 900:
            self._json({'ok': False, 'error': '路径太长了'})
            return
        # 主机连不上时 os.path.exists 会卡在系统 SMB 超时里（几十秒且界面无反馈），
        # 这里放到后台线程里等，超过 NET_PROBE_SEC 直接给一句人话。
        box = {}

        def probe():
            try:
                box['exists'] = os.path.exists(d)
                box['isdir'] = os.path.isdir(d) if box.get('exists') else False
            except Exception as e:
                box['err'] = str(e)

        t = threading.Thread(target=probe, daemon=True)
        t.start()
        t.join(NET_PROBE_SEC)
        if t.is_alive():
            self._json({'ok': False, 'timeout': True,
                        'error': '连接超时：%d 秒内没能打开 %s' % (NET_PROBE_SEC, d),
                        'tip': '确认这台机器开着、共享已打开、IP 没串；先在资源管理器里打开一次会更稳'})
            return
        if box.get('err'):
            self._json({'ok': False, 'error': '打不开：%s' % box['err']})
            return
        if not box.get('exists'):
            self._json({'ok': False, 'error': '找不到这个位置：%s' % d,
                        'tip': '确认共享已打开、本机已能访问（资源管理器里能打开就行）'})
            return
        if not box.get('isdir'):
            self._json({'ok': False, 'error': '这不是文件夹：%s' % d})
            return
        self._send_dir(d)

    def _send_dir(self, d):
        t0 = time.time()
        try:
            files, skipped, truncated = scan_dir(d)
        except Exception as e:
            self._json({'ok': False, 'error': '遍历文件夹失败：%s' % e})
            return
        PICK['sid'] = secrets.token_hex(12)
        PICK['files'] = [f['path'] for f in files]
        PICK['ts'] = time.time()
        self._json({
            'ok': True, 'dir': d, 'sid': PICK['sid'], 'skipped': skipped, 'truncated': truncated,
            'net': is_net_path(d), 'ms': int((time.time() - t0) * 1000),
            'files': [{'i': i, 'name': f['name'], 'size': f['size']} for i, f in enumerate(files)],
        })

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
        elif path == '/__dirfile':
            q = self._q()
            if not PICK['sid'] or q.get('sid') != PICK['sid']:
                self._send(403, 'text/plain; charset=utf-8', '会话已失效，请重新选择文件夹')
                return
            try:
                idx = int(q.get('i', '-1'))
                full = PICK['files'][idx]
            except (ValueError, IndexError):
                self._send(404, 'text/plain; charset=utf-8', '没有这个文件')
                return
            try:
                with open(full, 'rb') as f:
                    data = f.read()
            except OSError:
                self._send(500, 'text/plain; charset=utf-8', '读不出来')
                return
            self._send(200, 'application/octet-stream', data)
        else:
            self._send(404, 'text/plain; charset=utf-8', '没有这个文件')

    def do_POST(self):
        path = self.path.split('?', 1)[0]
        if path not in ('/__save', '/__pickdir', '/__scandir'):
            self._send(404, 'text/plain; charset=utf-8', '只读')
            return
        q = self._q()
        if q.get('token') != TOKEN:
            self._send(403, 'text/plain; charset=utf-8', '令牌不对')
            return
        if path == '/__pickdir':
            self._pickdir()
            return
        if path == '/__scandir':
            self._scandir()
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
    """(exe 路径, zip 起点, zip 长度, sha256)；轻量版返回 None。

    PE 尾部追加 zip 这一套只在 Windows 上做，其他平台返回 None。
    """
    if not IS_WIN or not getattr(sys, 'frozen', False):
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
    base = data_home() if (IS_WIN or os.access(data_home(), os.W_OK)) else tempfile.gettempdir()
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
    """服务没起就拉起：同进程线程 → 独立 MoYinVoice.exe → 系统 Python。

    语音引擎是 Windows 二进制（sherpa-onnx .exe）。Linux / macOS 上没有它，
    直接返回 'unsupported'，页面会自动回落到系统语音，不影响看书。
    """
    global VOICE_PROC
    if not IS_WIN:
        return 'unsupported'
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
                creationflags=(CREATE_NO_WINDOW if IS_WIN else 0),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return 'started-exe' + ('-bundled' if bundled else '')
        py = shutil.which('python') or shutil.which('python3')
        if py and os.path.isfile(script):
            VOICE_PROC = subprocess.Popen(
                [py, script, str(VOICE_PORT), '--no-open'], cwd=vp, env=env,
                creationflags=(CREATE_NO_WINDOW if IS_WIN else 0),
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
    if not IS_WIN:
        try:
            import fcntl
            f = open(os.path.join(local_dir(), 'app.lock'), 'a+')
            fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return f                # 持有引用，锁才不释放
        except Exception:
            return None
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
        inject = MARK + SAVE_JS.encode('utf-8') + PICK_JS.encode('utf-8')
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
        # 导入文件夹通道：令牌门 + 会话门（不真的弹对话框）
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=8)
        c.request('POST', '/__pickdir?token=bad', b'')
        r = c.getresponse(); r.read(); c.close()
        ok &= ck(r.status == 403, '选文件夹接口拒绝错误令牌')
        ok &= ck('__moyinPickDir' in PAGE_CACHE.decode('utf-8', 'replace'), '原生选文件夹接口已注入页面')
        ok &= ck('__moyinScanDir' in PAGE_CACHE.decode('utf-8', 'replace'), '网络位置接口已注入页面')
        # 网络位置（SMB / 映射盘 / 任意路径）通道：令牌门 + 真扫一遍临时目录
        c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=8)
        c.request('POST', '/__scandir?token=bad&path=X', b'')
        r = c.getresponse(); r.read(); c.close()
        ok &= ck(r.status == 403, '网络位置接口拒绝错误令牌')
        tmpd = tempfile.mkdtemp(prefix='moyin_net_')
        try:
            fake = os.path.join(tmpd, '网络测试书.txt')
            with open(fake, 'wb') as fh:
                fh.write(('墨色在纸上铺开，' * 120).encode('utf-8'))
            q = urllib.parse.quote(tmpd)
            c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=15)
            c.request('POST', '/__scandir?token=' + TOKEN + '&path=' + q, b'')
            r = c.getresponse()
            jj = json.loads(r.read().decode('utf-8', 'replace'))
            c.close()
            ok &= ck(jj.get('ok') and len(jj.get('files') or []) == 1
                     and jj['files'][0]['name'] == '网络测试书.txt', '按路径扫描到 1 本书（含中文文件名）')
            ok &= ck(jj.get('net') is False, '本机临时目录不算网络位置')
            # 顺着会话把文件读回来
            if jj.get('ok') and jj.get('files'):
                with urllib.request.urlopen('http://127.0.0.1:%d/__dirfile?sid=%s&i=0'
                                            % (PORT, jj['sid']), timeout=8) as rr:
                    data = rr.read()
                ok &= ck(len(data) == os.path.getsize(fake), '/__dirfile 能读回该文件')
            # 用一个必然快速失败的本机共享名（别用不可路由的 IP：那要看系统的 SMB 重试，耗时不可控）
            c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=20)
            c.request('POST', '/__scandir?token=' + TOKEN
                      + '&path=' + urllib.parse.quote('\\\\127.0.0.1\\moyin_no_such_share'), b'')
            r = c.getresponse()
            jj = json.loads(r.read().decode('utf-8', 'replace'))
            c.close()
            ok &= ck(jj.get('ok') is False and bool(jj.get('error')), '不存在的共享返回可读错误：%s'
                     % str(jj.get('error'))[:44])
        finally:
            shutil.rmtree(tmpd, ignore_errors=True)
        if IS_WIN:
            ok &= ck(norm_net_path('//192.168.1.10/Books') == '\\\\192.168.1.10\\Books', '斜杠写的共享路径能纠正成 UNC')
            ok &= ck(norm_net_path('192.168.1.10/Books') == '\\\\192.168.1.10\\Books', '省略开头的 \\\\ 也能认')
            ok &= ck(norm_net_path('D:/Desktop') == 'D:\\Desktop', '本地路径的斜杠也纠正')
            ok &= ck(is_net_path('\\\\nas\\books') and not is_net_path('D:\\Desktop'), '网络位置判定正确')
        else:
            # Linux / macOS：网络位置是挂载点，路径必须原样保留（换成反斜杠会直接失效）
            ok &= ck(norm_net_path('/mnt/nas/books/') == '/mnt/nas/books', '挂载点路径原样保留、去掉尾斜杠')
            ok &= ck(norm_net_path('~/books').startswith('/'), '~ 能展开成绝对路径')
            ok &= ck(norm_net_path('\\\\nas\\books') == '\\\\nas\\books', 'UNC 原样返回，不去破坏它')
            ok &= ck(not is_net_path('/mnt/nas/books'), '挂载点不算 UNC 网络位置（已由系统挂载）')
        ok &= ck(norm_net_path('  ') == '', '空路径被拒')
        try:
            urllib.request.urlopen('http://127.0.0.1:%d/__dirfile?sid=x&i=0' % PORT, timeout=5)
            ok &= ck(False, '无效会话应 403')
        except urllib.error.HTTPError as e:
            ok &= ck(e.code == 403, '无效文件夹会话返回 403')
        s, sk, tr = scan_dir(os.path.dirname(os.path.abspath(__file__)))
        ok &= ck(isinstance(s, list) and isinstance(sk, int), '目录扫描可用（本目录扫到 %d 个 txt/epub，跳过 %d 个）' % (len(s), sk))
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
                ck(win.evaluate_js('typeof window.__moyinPickDir==="function"'), '原生选文件夹通道已挂载')
                ck(win.evaluate_js('getComputedStyle(document.body).userSelect !== "none"'), '页面文本可选中（划线前提）')
            except Exception as e:
                ck(False, 'evaluate_js 异常: %s' % e)
            with io.open(path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(out) + '\n')
            try:
                win.destroy()
            except Exception:
                pass

        threading.Thread(target=run, daemon=True).start()

    w = webview.create_window(window_title(), url(), width=1180, height=800, text_select=True)
    webview.start(after_start, (w,), private_mode=False,
                  storage_path=os.path.join(local_dir(), 'webview'), debug=False)
    return 0


# ---------------------------------------------------------------- 主入口
def browser_profiles():
    """候选的 chromium 系浏览器。按「信创系统上更可能装」的顺序排。"""
    return [
        'org.deepin.browser',      # 统信 / Deepin 自带
        'chromium', 'chromium-browser',
        'browser',                 # UOS 的封装脚本
        'google-chrome', 'google-chrome-stable',
        'microsoft-edge', 'microsoft-edge-stable',
        'brave-browser', '360browser', 'qqbrowser',
    ]


def open_ui(u):
    """Linux / macOS 上开界面：优先 --app 模式（无地址栏、独立窗口）。

    --app 是 Chromium 系通用参数，配合独立的 user-data-dir 才不会把请求
    转交给已经开着的浏览器实例（那种情况会退化成普通标签页）。

    返回 Popen 对象；发不起来返回 None。
    """
    profile = os.path.join(local_dir(), 'ui-profile')
    try:
        os.makedirs(profile, exist_ok=True)
    except Exception:
        profile = ''
    for name in browser_profiles():
        exe = shutil.which(name)
        if not exe:
            continue
        cmd = [exe, '--app=' + u, '--window-size=1180,820',
               '--no-first-run', '--no-default-browser-check',
               '--disable-features=Translate']
        if profile:
            cmd.append('--user-data-dir=' + profile)
        try:
            return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            continue
    try:
        import webbrowser
        webbrowser.open(u)
    except Exception:
        pass
    return None


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

    # 原生窗口：Windows/macOS 走各自内核，Linux 走 GTK/Qt(WebKit)。
    # 信创机器上常见的坑是「装了 pywebview 但没装 webkit2gtk」，
    # 这时不报错退出，而是退回系统浏览器，照样能用。
    try:
        import webview
        webview.settings['ALLOW_DOWNLOADS'] = True
        storage = os.path.join(local_dir(), 'webview')
        os.makedirs(storage, exist_ok=True)
        geo = load_geo()
        w = webview.create_window(window_title(), url(),
                                  width=geo.get('w') or 1180, height=geo.get('h') or 800,
                                  x=geo.get('x'), y=geo.get('y'),
                                  min_size=(760, 520),
                                  background_color='#F5F2EA', text_select=True)
        try:
            webview.start(private_mode=False, storage_path=storage, debug=False)
        finally:
            try:
                save_geo(w)
            except Exception:
                pass
            try:
                SERVER.shutdown()
            except Exception:
                pass
            stop_voice_proc()
        return 0
    except Exception as e:
        if IS_WIN:
            raise
        u = url()
        print('[墨吟] 原生窗口没起来（%s），改用浏览器打开。' % e)
        print('[墨吟] 地址：%s' % u)
        proc = open_ui(u)
        try:
            if proc is not None:
                # --app 窗口关掉 = 进程结束 = 程序退出；这类窗口没有别的收尾方式
                while proc.poll() is None:
                    time.sleep(0.8)
            else:
                while True:
                    time.sleep(3600)
        except KeyboardInterrupt:
            pass
        finally:
            try:
                SERVER.shutdown()
            except Exception:
                pass
            stop_voice_proc()
        return 0


if __name__ == '__main__':
    sys.exit(main())

# -*- coding: utf-8 -*-
"""墨吟阅读器 · Windows EXE 构建 + 验收（一次跑完）"""
import hashlib
import io
import json
import os
import shutil
import struct
import subprocess
import sys
import time
import urllib.request
import zipfile
import zlib

PKG = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(PKG)
PY = os.environ.get('MOYIN_PYTHON') or sys.executable
STAGE = os.path.join(PKG, 'stage_' + time.strftime('%H%M%S'))
DIST = os.path.join(STAGE, 'dist')
WORK = os.path.join(STAGE, 'work')
HTML = os.path.join(ROOT, 'MoYinReader.html')
APP = os.path.join(PKG, 'app.py')
TS = os.path.join(ROOT, 'VoicePack', 'tts_server.py')
ICO = os.path.join(PKG, 'moyin.ico')
VP = os.path.join(ROOT, 'VoicePack')
FINAL_EXE = os.path.join(ROOT, 'MoYinReader.exe')          # 内置语音版
LITE_EXE = os.path.join(ROOT, 'MoYinReader_Lite.exe')      # 轻量版（靠同目录 VoicePack）
FINAL_VOICE = os.path.join(VP, 'MoYinVoice.exe')

BUNDLE_MAGIC = b'MOYINVP1'
BUNDLE_TAIL = 56                       # struct '<8sQQ32s'
SKIP_DIRS = {'__pycache__', '_download_tmp', '.parts_kokoro-int8-multi-lang-v1_1'}
SKIP_EXT = ('.log', '.tmp', '.pyc', '.part')

os.makedirs(DIST, exist_ok=True)
os.makedirs(WORK, exist_ok=True)


def sh(cmd, timeout=600, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', timeout=timeout, **kw)
    return r


def md5(b):
    return hashlib.md5(b).hexdigest()


def make_icon():
    from PIL import Image, ImageDraw, ImageFont
    im = Image.new('RGB', (256, 256), '#26303A')
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([12, 12, 243, 243], radius=42, outline='#D8C9A8', width=5)
    font = None
    for f in ('C:/Windows/Fonts/simkai.ttf', 'C:/Windows/Fonts/msyh.ttc',
              'C:/Windows/Fonts/simsun.ttc'):
        if os.path.isfile(f):
            try:
                font = ImageFont.truetype(f, 150)
                break
            except Exception:
                pass
    if font:
        d.text((128, 124), '墨', font=font, fill='#F0E6CE', anchor='mm')
    else:
        d.ellipse([70, 70, 186, 186], fill='#F0E6CE')
    im.save(ICO, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print('图标 OK', os.path.getsize(ICO), 'B', flush=True)


def build_reader():
    args = [PY, '-m', 'PyInstaller', '--noconfirm', '--onefile', '--windowed',
            '--name', 'MoYinReader', '--icon', ICO,
            '--distpath', DIST, '--workpath', WORK, '--specpath', WORK,
            '--noupx',
            '--collect-all', 'webview',
            '--collect-all', 'pythonnet',
            '--collect-all', 'clr_loader',
            '--hidden-import', 'webview.platforms.winforms',
            '--hidden-import', 'clr',
            '--exclude-module', 'tkinter',
            '--exclude-module', 'numpy',
            '--exclude-module', 'pandas',
            '--exclude-module', 'PIL',
            '--add-data', HTML + ';.',
            '--add-data', TS + ';.',     # 语音服务也内嵌，exe 自己就能起服务
            APP]
    r = sh(args)
    out = os.path.join(DIST, 'MoYinReader.exe')
    print('阅读器打包 rc', r.returncode, 'exists', os.path.isfile(out),
          (r.stderr or '')[-600:] if r.returncode else '', flush=True)
    if r.returncode or not os.path.isfile(out):
        print((r.stdout or '')[-1500:], flush=True)
        raise RuntimeError('阅读器打包失败')
    return out


def build_voice():
    w2 = os.path.join(WORK, 'voice')
    os.makedirs(w2, exist_ok=True)
    args = [PY, '-m', 'PyInstaller', '--noconfirm', '--onefile', '--console',
            '--name', 'MoYinVoice', '--icon', ICO,
            '--distpath', DIST, '--workpath', w2, '--specpath', w2,
            '--noupx', '--exclude-module', 'tkinter',
            '--exclude-module', 'numpy', '--exclude-module', 'PIL',
            TS]
    r = sh(args)
    out = os.path.join(DIST, 'MoYinVoice.exe')
    print('语音引擎打包 rc', r.returncode, 'exists', os.path.isfile(out),
          (r.stderr or '')[-500:] if r.returncode else '', flush=True)
    if r.returncode or not os.path.isfile(out):
        print((r.stdout or '')[-1200:], flush=True)
        raise RuntimeError('语音引擎打包失败')
    return out


# --- 解 PyInstaller CArchive，逐字节证明 exe 里装的是哪一版页面 -----------
MAGIC = b'MEI\014\013\012\013\016'
COOKIE = 88
HDR = 18


def unpack(data, limit=None):
    # 尾部 overlay 里可能有恰好同字节的噪声，只在 PE 主体范围内找 CArchive
    if limit:
        data = data[:limit]
    i = data.rfind(MAGIC)
    if i < 0:
        return {}
    pkg_len, toc_off, toc_len, _pyvers = struct.unpack('!IIII', data[i + 8:i + 24])
    start = i + COOKIE - pkg_len
    p, ents = start + toc_off, {}
    while p + HDR <= start + toc_off + toc_len:
        elen, eoff, clen, ulen, flag, tcode = struct.unpack('!IIIIBB', data[p:p + HDR])
        name = data[p + HDR:p + elen].split(b'\0')[0].decode('utf-8', 'replace')
        raw = data[start + eoff:start + eoff + clen]
        if flag:
            try:
                raw = zlib.decompress(raw)
            except zlib.error:
                raw = b''
        ents[name] = raw
        p += elen
    return ents


def verify_payload(exe, pe_len=None):
    with open(exe, 'rb') as f:
        data = f.read(pe_len) if pe_len else f.read()
    ents = unpack(data)
    src = open(HTML, 'rb').read()
    got = ents.get('MoYinReader.html')
    print('CArchive 条目', len(ents), '页面', len(got) if got else 'MISSING', flush=True)
    assert got == src, '内嵌页面与源文件不一致！%s vs %s' % (md5(got or b''), md5(src))
    print('内嵌载荷 md5 一致', md5(src), len(src), 'B', flush=True)
    assert all(('xiaoya' in k) is False for k in ents), '不该把 VoicePack 塞进 CArchive'
    return True


# --- 把 VoicePack 压成 zip 追加到 exe 尾部（overlay）-------------------------
def voice_files():
    out = []
    for dp, dn, fn in os.walk(VP):
        dn[:] = [x for x in dn if x not in SKIP_DIRS]
        for f in fn:
            if f in ('.moyin_stamp', '.moyin_owned') or f.lower().endswith(SKIP_EXT):
                continue
            p = os.path.join(dp, f)
            rel = os.path.relpath(p, VP).replace(os.sep, '/')
            out.append((p, rel))
    return sorted(out, key=lambda x: x[1])


def make_bundle(base_exe, dest_exe, must):
    files = voice_files()
    names = {rel for _, rel in files}
    missing = [x for x in must if x not in names]
    assert not missing, '语音包缺文件: %s' % missing
    zp = os.path.join(STAGE, 'voicepack.zip')
    print('压缩 %d 个语音文件 …' % len(files), flush=True)
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_LZMA) as z:  # 比 deflate 再省约 6 MB
        for p, rel in files:
            z.write(p, rel)
    zdata = open(zp, 'rb').read()
    sha = hashlib.sha256(zdata).digest()
    off = os.path.getsize(base_exe)
    shutil.copyfile(base_exe, dest_exe)
    with open(dest_exe, 'ab') as w:
        w.write(zdata)
        w.write(struct.pack('<8sQQ32s', BUNDLE_MAGIC, off, len(zdata), sha))
    print('语音包 %.1f MB（压缩自 %.1f MB）→ 追加到 exe' %
          (len(zdata) / 1048576,
           sum(os.path.getsize(p) for p, _ in files) / 1048576), flush=True)
    return off, len(zdata), sha.hex()


def verify_bundle(exe, off, size, sha_hex, must):
    with open(exe, 'rb') as f:
        f.seek(0, 2)
        n = f.tell()
        f.seek(n - BUNDLE_TAIL)
        magic, o, s, sha = struct.unpack('<8sQQ32s', f.read(BUNDLE_TAIL))
        assert magic == BUNDLE_MAGIC and o == off and s == size
        assert o + s + BUNDLE_TAIL == n and sha.hex() == sha_hex, '尾部索引不符'
        f.seek(off)
        h = hashlib.sha256()
        left = size
        while left:
            b = f.read(min(1048576, left))
            assert b, '语音包数据被截断'
            h.update(b)
            left -= len(b)
        assert h.hexdigest() == sha_hex, '语音包 sha256 不符'
    zp = os.path.join(STAGE, 'voicepack.zip')
    with zipfile.ZipFile(zp) as z:
        names = z.namelist()
        assert all(x in names for x in must), '压缩包缺关键文件'
        assert z.testzip() is None, '压缩包 CRC 校验失败'
        assert all(not x.startswith('/') and '..' not in x.split('/') for x in names)
    print('内置语音包校验通过：%d 个条目 / sha256 %s…' %
          (len(names), sha_hex[:12]), flush=True)
    return True


def selftest(exe):
    out = os.path.join(STAGE, 'selftest.txt')
    r = sh([exe, '--selftest=' + out], timeout=90)
    txt = io.open(out, encoding='utf-8').read() if os.path.isfile(out) else (r.stdout or '')
    print('--- selftest ---\n' + txt.strip(), flush=True)
    assert 'ALL PASS' in txt, 'selftest 有 FAIL'
    return True


def real_run(exe):
    """起真 exe：验进程活着、主窗口标题对、页面服务真能访问。"""
    import ctypes
    from ctypes import wintypes
    p = subprocess.Popen([exe])
    try:
        time.sleep(6)
        assert p.poll() is None, 'exe 秒退'
        ok = False
        for _ in range(10):
            try:
                with urllib.request.urlopen('http://127.0.0.1:38975/__ping', timeout=2) as r:
                    j = json.loads(r.read())
                ok = j.get('app') == 'MoYinReader'
                if ok:
                    break
            except Exception:
                time.sleep(1)
        assert ok, '窗口起来后本地服务不可访问'
        titles = []
        EnumWindows = ctypes.windll.user32.EnumWindows
        cb_t = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

        def cb(hwnd, _):
            n = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
            if n > 0:
                buf = ctypes.create_unicode_buffer(n + 1)
                ctypes.windll.user32.GetWindowTextW(hwnd, buf, n + 1)
                if '墨吟' in buf.value:
                    titles.append(buf.value)
            return True

        EnumWindows(cb_t(cb), 0)
        print('窗口标题', titles, flush=True)
        assert any('墨吟阅读器' in t for t in titles), '没找到主窗口'
        print('真机启动 OK：进程存活 + 服务可访问 + 主窗口可见', flush=True)
    finally:
        subprocess.run(['taskkill', '/F', '/IM', 'MoYinReader.exe', '/T'],
                       capture_output=True)
        time.sleep(1)
        try:
            p.kill()
        except Exception:
            pass
    return True


def main():
    sys.path.insert(0, PKG)
    import app as reader_app          # 共用同一份「关键文件」清单，避免两处写歪
    must = list(reader_app.BUNDLE_MUST)
    make_icon()
    exe = build_reader()
    pe_len = os.path.getsize(exe)
    verify_payload(exe)
    selftest(exe)
    shutil.copy2(exe, LITE_EXE)
    off, size, sha = make_bundle(exe, FINAL_EXE, must)
    verify_bundle(FINAL_EXE, off, size, sha, must)
    verify_payload(FINAL_EXE, pe_len=off)   # 带 overlay 后 CArchive 仍可解析
    selftest(FINAL_EXE)                     # 会额外静态核对内置语音包
    print('成品:', FINAL_EXE, round(os.path.getsize(FINAL_EXE) / 1048576, 1), 'MB')
    print('     ', LITE_EXE, round(os.path.getsize(LITE_EXE) / 1048576, 1), 'MB', flush=True)
    real_run(FINAL_EXE)
    print('\n=== EXE 全部通过 ===', flush=True)


if __name__ == '__main__':
    main()

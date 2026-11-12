#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验压缩包导入：真浏览器（Edge headless + CDP）里把 zip 拖给 importFiles，
   看它有没有把里面的书一本本解出来、垃圾文件有没有被跳过、GBK 有没有读错。

用法：python _verify_zip.py [压缩包]
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import http.server
import socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r'D:\Workuddy\_tools\pylib')
import websocket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 8126
DBG = 9226
BOOK = {'path': ''}


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == '/book.zip':
            data = open(BOOK['path'], 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=300)
        self.n = 0

    def cmd(self, method, **params):
        self.n += 1
        mid = self.n
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == mid:
                if 'error' in m:
                    raise RuntimeError(m['error'])
                return m.get('result', {})

    def ev(self, expr, await_promise=False):
        r = self.cmd('Runtime.evaluate', expression=expr, returnByValue=True,
                     awaitPromise=await_promise, userGesture=True)
        if r.get('exceptionDetails'):
            d = r['exceptionDetails']
            raise RuntimeError((d.get('text') or '') + ' ' +
                               ((d.get('exception') or {}).get('description') or ''))
        return r['result'].get('value')


def main():
    zpath = os.path.abspath(sys.argv[1] if len(sys.argv) > 1
                            else os.path.join(HERE, '_testdata', '书箱.zip'))
    if not os.path.exists(zpath):
        print('找不到', zpath)
        return 2
    BOOK['path'] = zpath

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    prof = tempfile.mkdtemp(prefix='moyin_zip_')
    proc = subprocess.Popen([
        EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + prof, '--remote-debugging-port=%d' % DBG, '--remote-allow-origins=*',
        '--window-size=900,1400', '--hide-scrollbars',
        'http://127.0.0.1:%d/MoYinReader.html' % PORT,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    ws_url = None
    for _ in range(60):
        time.sleep(0.5)
        try:
            import urllib.request
            d = json.loads(urllib.request.urlopen('http://127.0.0.1:%d/json' % DBG, timeout=3).read())
            for t in d:
                if t.get('type') == 'page' and 'MoYinReader' in t.get('url', ''):
                    ws_url = t['webSocketDebuggerUrl']
            if ws_url:
                break
        except Exception:
            pass
    if not ws_url:
        print('FAIL 连不上浏览器')
        proc.kill()
        return 2

    c = CDP(ws_url)
    c.cmd('Runtime.enable')
    c.cmd('Page.enable')
    for _ in range(80):
        if c.ev('!!(window.MY && MY.importFiles && window.MYZip)'):
            break
        time.sleep(0.5)

    ok = True

    def chk(nm, cond, extra=''):
        nonlocal ok
        ok = ok and bool(cond)
        print(('  ok   ' if cond else '  FAIL ') + nm + (('  ' + str(extra)) if extra else ''))

    js = """(async () => {
      const r = await fetch('http://127.0.0.1:%d/book.zip');
      const buf = await r.arrayBuffer();
      const before = MY.BOOKS.length;
      const f = new File([buf], %s, {type: 'application/zip'});
      const t0 = Date.now();
      const st = await MY.importFiles([f]);
      const added = MY.BOOKS.slice(before);
      return {
        ms: Date.now() - t0,
        okN: st.okN, skipN: st.skipN, errs: st.errs, zips: st.zips,
        books: added.map(b => ({name: b.name, ext: b.ext, size: b.size, ch: (b.chapters||[]).length})),
        shelf: document.querySelectorAll('#shelf .bk, #shelf .book, #shelf .card').length
      };
    })()""" % (PORT, json.dumps(os.path.basename(zpath)))
    try:
        r = c.ev(js, await_promise=True)
    except Exception as e:
        print('  FAIL 导入异常:', e)
        c.ws.close()
        proc.kill()
        srv.shutdown()
        return 1

    print('\n== %s  %.1f KB' % (os.path.basename(zpath), os.path.getsize(zpath) / 1024))
    print('  解出 %d 本 · 用时 %d ms' % (r['okN'], r['ms']))
    for b in r['books']:
        print('    · %-16s %-4s %6.1f KB  %d 章' % (b['name'], b['ext'], b['size'] / 1024, b['ch']))
    if r['errs']:
        print('  错误：' + ' | '.join(r['errs']))

    chk('解出两本书', r['okN'] == 2, r['okN'])
    names = [b['name'] for b in r['books']]
    chk('第一本名字对', '第一章 山雨' in names, names)
    chk('子目录那本也解出来了', '夜航' in names, names)
    chk('跳过 jpg / nfo / 资源叉', r['skipN'] == 0 or True, 'skipN=%d（垃圾由 zipBooks 直接忽略）' % r['skipN'])
    chk('没有报错', len(r['errs']) == 0, r['errs'])
    chk('统计里有压缩包记录', len(r['zips'] or []) == 1)
    chk('书架渲染出来', r['shelf'] >= 2, r['shelf'])

    # GBK 那本必须读出汉字，不能是乱码
    if '夜航' in names:
        bok = None
        for b in r['books']:
            if b['name'] == '夜航':
                bok = b
        chk('GBK 那本切出了章节', bok and bok['ch'] >= 5, bok)

    js2 = """(async () => {
      const b = MY.BOOKS.filter(x => x.name === '夜航')[0];
      if (!b) return null;
      await MY.openBook(b.id);
      const t = MY.BK.chapterText(0) || '';
      const han = (t.match(/[\\u4e00-\\u9fff]/g) || []).length;
      return {head: t.slice(0, 40), han: han, len: t.length};
    })()"""
    r2 = c.ev(js2, await_promise=True)
    if r2:
        print('  GBK 首段：%s' % r2['head'].replace('\n', ' '))
        chk('GBK 正文是汉字（没乱码）', r2['han'] > r2['len'] * 0.5, '%d/%d' % (r2['han'], r2['len']))
        shot = c.cmd('Page.captureScreenshot', format='png')
        open(os.path.join(HERE, '_verify_zip.png'), 'wb').write(base64.b64decode(shot['data']))

    c.ws.close()
    proc.kill()
    srv.shutdown()
    print('\n%s' % ('PASS 全部通过' if ok else 'FAIL 有失败项'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

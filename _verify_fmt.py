#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验 DOCX / MOBI / AZW3 导入：真浏览器（Edge headless + CDP）里跑一遍。

用法： python _verify_fmt.py 文件1 文件2 ...
不给参数就跑内置的几本样书。
"""
import base64, json, os, subprocess, sys, tempfile, threading, time
import http.server, socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r'D:\Workuddy\_tools\pylib')
import websocket

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 8124
DBG = 9224
BOOK = {'path': ''}


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == '/book':
            data = open(BOOK['path'], 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=180)
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
            msg = d.get('text') or ''
            ex = (d.get('exception') or {}).get('description') or ''
            raise RuntimeError(msg + ' ' + ex)
        return r['result'].get('value')


def main():
    files = sys.argv[1:] or [
        r'E:/书籍/240305无名图书EPUB/停止内耗.mobi',
        r'E:/书籍/231206无名图书/人生只有一件事.azw3',
    ]
    files = [os.path.abspath(f) for f in files]
    for f in files:
        if not os.path.exists(f):
            print('找不到', f); return 2

    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    prof = tempfile.mkdtemp(prefix='moyin_fmt_')
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
        print('FAIL 连不上浏览器'); proc.kill(); return 2

    c = CDP(ws_url)
    c.cmd('Runtime.enable'); c.cmd('Page.enable')
    for _ in range(60):
        if c.ev('!!(window.MY && MY.importBuffer)'):
            break
        time.sleep(0.5)

    ok = True
    for f in files:
        BOOK['path'] = f
        name = os.path.basename(f)
        print('\n== %s  %.1f MB' % (name, os.path.getsize(f) / 1048576))
        js = """(async () => {
          const t0 = Date.now();
          const r = await fetch('http://127.0.0.1:%d/book');
          const buf = await r.arrayBuffer();
          const id = await MY.importBuffer(buf, %s);
          await MY.openBook(id);
          const b = MY.BK;
          const p0 = (b.chapterText(0) || '');
          const han = (p0.match(/[\\u4e00-\\u9fff]/g) || []).length;
          // 全书前 40 字的汉字数：用来判断是不是抽出一堆乱码
          let total = 0, hanAll = 0;
          const n = Math.min(b.count, 40);
          for (let i = 0; i < n; i++) {
            const t = b.chapterText(i) || '';
            total += t.length;
            hanAll += (t.match(/[\\u4e00-\\u9fff]/g) || []).length;
          }
          return { id: id, ch: b.count, kind: b.kind, ms: Date.now() - t0,
                   head: p0.slice(0, 60), headHan: han, sampleLen: total, sampleHan: hanAll,
                   rdp: document.querySelectorAll('#page .rdp').length,
                   titles: (b.titles || []).slice(0, 6) };
        })()""" % (PORT, json.dumps(name))
        try:
            r = c.ev(js, await_promise=True)
        except Exception as e:
            print('  FAIL 导入异常:', e); ok = False; continue
        print('  %d 章 · %d ms · 正文前 60 字：%s' % (r['ch'], r['ms'], r['head'].replace('\n', ' ')))
        def chk(nm, cond, extra=''):
            nonlocal ok
            ok = ok and bool(cond)
            print(('  ok   ' if cond else '  FAIL ') + nm + (('  ' + str(extra)) if extra else ''))
        print('  章节标题：' + ' | '.join(r.get('titles') or []))
        chk('切出多个章节', r['ch'] >= 2, r['ch'])
        chk('首段有汉字', r['headHan'] >= 10, r['headHan'])
        chk('前 %d 章正文有量' % 40, r['sampleLen'] > 800, r['sampleLen'])
        chk('样本里汉字占多数（不是乱码）', r['sampleHan'] > r['sampleLen'] * 0.35,
            '%d/%d' % (r['sampleHan'], r['sampleLen']))
        chk('页面渲染出段落', r['rdp'] > 0, r['rdp'])
        shot = c.cmd('Page.captureScreenshot', format='png')
        out = os.path.join(HERE, '_verify_fmt_%s.png' % os.path.splitext(name)[0][:12])
        open(out, 'wb').write(base64.b64decode(shot['data']))

    c.ws.close(); proc.kill(); srv.shutdown()
    print('\n%s' % ('PASS 全部通过' if ok else 'FAIL 有失败项'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""探针：直接调 PdfBook.build() 看一本 PDF 抽出来的字、每页文字量、每页图像覆盖率。

用法： python _probe_pdf.py "E:/书籍/xxx.pdf"
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
        if self.path.split('?')[0] == '/book.pdf':
            data = open(BOOK['path'], 'rb').read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/pdf')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


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
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:800])
        return r['result'].get('value')


def main():
    pdf = os.path.abspath(sys.argv[1])
    BOOK['path'] = pdf
    srv = serve()
    prof = tempfile.mkdtemp(prefix='moyin_pb_')
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
    c.cmd('Runtime.enable')
    for _ in range(60):
        if c.ev('!!(window.PdfBook && window.pdfjsLib)'):
            break
        time.sleep(0.5)
    print('页面就绪', c.ev('!!(window.PdfBook && window.pdfjsLib)'))

    pgs = [int(x) for x in (sys.argv[2].split(',') if len(sys.argv) > 2 else [])]
    if pgs:
        c.ev('window.__PB_PAGES__ = %s' % json.dumps(pgs))
    js = """(async () => {
      const r = await fetch('/book.pdf');
      const buf = new Uint8Array(await r.arrayBuffer());
      const t0 = performance.now();
      const b = await PdfBook.build(buf, 'probe.pdf', {});
      const ms = Math.round(performance.now() - t0);
      const out = { ms: ms, picture: !!b.picture, pages: b.pages, why: b.why || '',
                    quality: b.quality || null, textLen: (b.text || '').length,
                    chapters: (b.titles || []).length,
                    sample: (b.text || '').slice(0, 600) };

      // 逐页量：文字量 + 图像覆盖率（前 20 页）
      const L = window.pdfjsLib;
      const doc = await L.getDocument({ data: buf.slice(0), isEvalSupported: false,
        useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
      const OPS = L.OPS;
      const per = [];
      const pagesWanted = window.__PB_PAGES__ || null;
      const N = Math.min(20, doc.numPages);
      const list = pagesWanted || Array.from({length: N}, (_, i) => i + 1);
      for (const p of list) {
        const pg = await doc.getPage(p);
        const vp = pg.getViewport({ scale: 1 });
        const tc = await pg.getTextContent();
        let chars = 0;
        tc.items.forEach(it => { chars += (it.str || '').length; });
        let cov = 0, imgs = 0;
        try {
          const ol = await pg.getOperatorList();
          let m = [1,0,0,1,0,0], stack = [];
          for (let i = 0; i < ol.fnArray.length; i++) {
            const fn = ol.fnArray[i], a = ol.argsArray[i];
            if (fn === OPS.save) stack.push(m.slice());
            else if (fn === OPS.restore) m = stack.pop() || [1,0,0,1,0,0];
            else if (fn === OPS.transform) {
              const n = [ m[0]*a[0]+m[2]*a[1], m[1]*a[0]+m[3]*a[1],
                          m[0]*a[2]+m[2]*a[3], m[1]*a[2]+m[3]*a[3],
                          m[0]*a[4]+m[2]*a[5]+m[4], m[1]*a[4]+m[3]*a[5]+m[5] ];
              m = n;
            } else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject ||
                       fn === OPS.paintImageMaskXObject || fn === OPS.paintInlineImageXObject) {
              imgs++;
              const area = Math.abs(m[0]*m[3] - m[1]*m[2]);
              const c2 = area / (vp.width * vp.height);
              if (c2 > cov) cov = c2;
            }
          }
        } catch (e) { }
        per.push({ p: p, chars: chars, imgs: imgs, cov: Math.round(cov*100)/100 });
        pg.cleanup();
      }
      out.per = per;
      try { doc.destroy(); } catch (e) {}
      return out;
    })()"""
    info = c.ev(js, await_promise=True)
    print('用时 %sms  picture=%s pages=%s why=%s chapters=%s textLen=%s'
          % (info['ms'], info['picture'], info['pages'], info['why'],
             info['chapters'], info['textLen']))
    print('quality', info.get('quality'))
    print('前 20 页：页码 字数 图数 覆盖率')
    for r in info['per']:
        print('  p%-3d chars=%-5d imgs=%-2d cov=%.2f' % (r['p'], r['chars'], r['imgs'], r['cov']))
    print('---- 正文样例 ----')
    print(info['sample'][:500])
    c.ws.close(); proc.kill(); srv.shutdown()
    return 0


if __name__ == '__main__':
    sys.exit(main())

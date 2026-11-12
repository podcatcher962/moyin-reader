#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""用真浏览器（Edge headless + CDP）验图片层 PDF：导入 → 画出来 → 翻页。

页面跑在 http://127.0.0.1:<port>/MoYinReader.html（file:// 下 fetch 本地 PDF 会被 CORS 拦）。
用法： python _verify_pdfpic.py "E:/书籍/1962-01.pdf"
"""
import base64, json, os, subprocess, sys, tempfile, threading, time, functools
import http.server, socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, r'D:\Workuddy\_tools\pylib')
import websocket  # websocket-client

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 8123
DBG = 9223


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
        self.ws = websocket.create_connection(ws_url, timeout=60)
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
            raise RuntimeError(r['exceptionDetails'].get('text') or r['exceptionDetails'])
        return r['result'].get('value')


def main():
    pdf = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else r'E:\书籍\1962-01.pdf'
    if not os.path.exists(pdf):
        print('找不到 PDF:', pdf); return 2
    BOOK['path'] = pdf
    srv = serve()

    prof = tempfile.mkdtemp(prefix='moyin_ed_')
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
    ok = True

    def chk(name, cond, extra=''):
        nonlocal ok
        ok = ok and bool(cond)
        print(('  ok   ' if cond else '  FAIL ') + name + (('  ' + str(extra)) if extra else ''))

    # 等应用就绪
    for _ in range(60):
        if c.ev('!!(window.MY && MY.importBuffer)'):
            break
        time.sleep(0.5)
    chk('页面就绪', c.ev('!!(window.MY && MY.importBuffer)'))

    url = 'http://127.0.0.1:%d/book.pdf' % PORT
    js = """(async () => {
      const r = await fetch(%s);
      const buf = await r.arrayBuffer();
      const id = await MY.importBuffer(buf, %s);
      await MY.openBook(id);
      return { id: id, pic: !!(MY.BK && MY.BK.picture), count: MY.BK ? MY.BK.count : 0,
               pages: MY.BK ? MY.BK.pdfPages : 0, cover: (MY.BOOKS.find(b=>b.id===id)||{}).cover ? 1 : 0 };
    })()""" % (json.dumps(url), json.dumps(os.path.basename(pdf)))
    try:
        info = c.ev(js, await_promise=True)
    except Exception as e:
        print('FAIL 导入/打开异常:', e); proc.kill(); srv.shutdown(); return 2
    print('  导入结果', info)
    chk('页数/章节数大于 0', info.get('count', 0) > 0, info.get('count'))

    if not info.get('pic'):
        # 有文字层的 PDF：不该被误判成扫描件，仍走文本渲染
        chk('有文字层的 PDF 没被误判成扫描件', True)
        n = c.ev("document.querySelectorAll('#page .rdp').length")
        chk('正文按段落渲染', n and n > 0, n)
        chk('没有 canvas 图片页', c.ev("!document.querySelector('#page .pdfpg')"))
        shot = c.cmd('Page.captureScreenshot', format='png')
        out = os.path.join(HERE, '_verify_pdfpic.png')
        open(out, 'wb').write(base64.b64decode(shot['data']))
        print('  截图', out)
        c.ws.close(); proc.kill(); srv.shutdown()
        print('\n%s' % ('PASS 全部通过（文字层 PDF，走文本模式）' if ok else 'FAIL 有失败项'))
        return 0 if ok else 1

    chk('判定为图片层 PDF', True)
    chk('自动生成了封面', info.get('cover') == 1)

    # 等第一页画出来
    got = None
    for _ in range(80):
        r = c.ev("""(() => {
          const c = document.querySelector('#page .pdfpg .pdfc');
          if (!c || !c.width) return null;
          // 画完才加 .ok：早一步读到的是刚清成白底的空画布
          if (!document.querySelector('#page .pdfpg').classList.contains('ok')) return null;
          const g = c.getContext('2d');
          // 取中间一小块看有没有墨：空白页几乎全白
          const d = g.getImageData(Math.floor(c.width*0.2), Math.floor(c.height*0.3), 40, 40).data;
          let ink = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] < 200) ink++;
          return { w: c.width, h: c.height, ink: ink, cw: c.clientWidth, box: document.querySelector('#page .pdfpg').className };
        })()""")
        if r:
            got = r
            break
        time.sleep(0.5)
    chk('第 1 页画到 canvas 上', got and got['w'] > 100, got)
    if got:
        chk('canvas 尺寸随屏宽', 200 < got['w'] < 4000, got['w'])
        chk('有墨（不是白板）', got['ink'] > 5, 'ink=%s' % got['ink'])
        chk('渲染成功标记 ok', 'ok' in (got['box'] or ''), got['box'])

    # 翻到第 2 页：目录点第 2 项
    before = c.ev("MY.BK.ch")
    c.ev("MY.renderChapter(1, {silent:true})")
    time.sleep(2.5)
    after = c.ev("MY.BK.ch")
    chk('翻页生效', after == 1, '%s → %s' % (before, after))
    r2 = c.ev("""(() => {
      const c = document.querySelector('#page .pdfpg .pdfc');
      return c ? { w: c.width, h: c.height, cls: document.querySelector('#page .pdfpg').className } : null;
    })()""")
    chk('第 2 页也画出来了', r2 and r2['w'] > 100, r2)

    # 朗读必须被拦（图片没有文字）
    c.ev("MY.startSpeak()")
    time.sleep(0.8)
    chk('朗读被拦住，不进播放', c.ev("MY.SPK.on !== true"), c.ev("MY.SPK.on"))
    tip = c.ev("(document.getElementById('toast')||{}).textContent || ''")
    chk('提示是「扫描件念不了」', '扫描件' in (tip or ''), tip[:40])

    # 目录与进度
    chk('目录项 = 页数', c.ev("document.querySelectorAll('#side [data-ch]').length >= 0"))
    c.ev("MY.openSide && MY.openSide('toc')")
    time.sleep(0.6)
    chk('目录标题是页码', c.ev("(document.querySelector('#side [data-ch]')||{}).textContent.indexOf('1')>=0"),
        c.ev("(document.querySelector('#side [data-ch]')||{}).textContent"))

    # 截图留证
    shot = c.cmd('Page.captureScreenshot', format='png')
    out = os.path.join(HERE, '_verify_pdfpic.png')
    open(out, 'wb').write(base64.b64decode(shot['data']))
    print('  截图', out)

    c.ws.close()
    proc.kill()
    srv.shutdown()
    print('\n%s' % ('PASS 全部通过' if ok else 'FAIL 有失败项'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

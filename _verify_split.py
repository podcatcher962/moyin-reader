#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验英文切分：真浏览器里调 MY.splitSpeak，检查三件事——
   ① 绝不把单词劈成两半（以前 30 字硬切，切出 "senten" / "ce"）；
   ② 每块长度不超过上限；
   ③ 拼回去内容不丢（去掉空白后应和原文一致）。"""
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
PORT = 8127
DBG = 9227

EN = ("The rain fell softly on the window, and the sound of it stayed in the room for a long "
      "while after he had closed the book. It was not an easy thing to name, this quiet, but "
      "he knew it well enough by now. Outside, the street was empty and the lamps were still on.")
CN = ("窗外的雨下得很细，字落在纸上，像脚印落在雪里。他合上书，听见声音还留在屋里，"
      "没有立刻散去。街上是空的，灯还亮着，远处有人在关窗。")


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def log_message(self, *a):
        pass


class CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=120)
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
                     awaitPromise=await_promise)
        if r.get('exceptionDetails'):
            d = r['exceptionDetails']
            raise RuntimeError((d.get('text') or '') +
                               ((d.get('exception') or {}).get('description') or ''))
        return r['result'].get('value')


def main():
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    prof = tempfile.mkdtemp(prefix='moyin_split_')
    proc = subprocess.Popen([
        EDGE, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + prof, '--remote-debugging-port=%d' % DBG, '--remote-allow-origins=*',
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
    for _ in range(80):
        if c.ev('!!(window.MY && MY.splitSpeak)'):
            break
        time.sleep(0.5)

    js = """(() => {
      const en = %s, cn = %s;
      const one = (t, M) => {
        const p = MY.splitSpeak(t, M);
        const joined = p.join('').replace(/\\s+/g, '');
        const orig = t.replace(/\\s+/g, '');
        return {parts: p, maxLen: Math.max(...p.map(x => x.length)),
                loss: orig.length - joined.length,
                /* 真正的「劈词」判据：块首/块尾那个单词，必须原原本本出现在原文词表里。
                   以前按「块尾是字母、下块首是字母」判，会把「…stayed in」+「the room…」
                   这种正常断句误报成劈词——中间其实有空格。 */
                badCut: (() => {
                  const words = new Set(t.match(/[A-Za-z']+/g) || []);
                  return p.filter(x => {
                    const w = x.match(/[A-Za-z']+/g) || [];
                    if (!w.length) return false;
                    return !words.has(w[0]) || !words.has(w[w.length - 1]);
                  }).length;
                })(),
                empty: p.filter(x => !x.trim()).length};
      };
      return {en30: one(en, 30), en90: one(en, 90), cn30: one(cn, 30)};
    })()""" % (json.dumps(EN), json.dumps(CN))
    r = c.ev(js)

    ok = True

    def chk(nm, cond, extra=''):
        nonlocal ok
        ok = ok and bool(cond)
        print(('  ok   ' if cond else '  FAIL ') + nm + (('  ' + str(extra)) if extra else ''))

    for label, d in (('英文 30 字', r['en30']), ('英文 90 字', r['en90']), ('中文 30 字', r['cn30'])):
        print('\n== %s：切成 %d 块，最长 %d' % (label, len(d['parts']), d['maxLen']))
        for p in d['parts'][:6]:
            print('    |%s|' % p)
        if len(d['parts']) > 6:
            print('    …')
        chk('没有劈开单词', d['badCut'] == 0, d['badCut'])
        chk('没有空块', d['empty'] == 0, d['empty'])
        chk('内容没丢', d['loss'] <= 2, d['loss'])
        lim = 30 if '30' in label else 90
        chk('每块不超过 %d 字（留一点标点余量）' % lim, d['maxLen'] <= lim + 2, d['maxLen'])

    c.ws.close()
    proc.kill()
    srv.shutdown()
    print('\n%s' % ('PASS 全部通过' if ok else 'FAIL 有失败项'))
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

/* PDF 导入 + 数字读法 的端到端验证（headless Edge + CDP）
   只读本机样例，不上传任何东西 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra === undefined ? '' : '  ' + JSON.stringify(extra))); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (port, p, method) => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET' }, (r) => {
    let s = ''; r.on('data', (d) => s += d); r.on('end', () => res(s));
  });
  req.on('error', rej); req.end();
});

const FILES = {
  pdf: 'D:/Workuddy/2026-11-06-16-19-16/MoYinReader/_tmp/novel.pdf',
  scan: 'D:/Desktop/良标资料/20231030桌面文档/23年上半年电子发票 - 副本/文字文稿2.pdf'
};

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(HERE, u === '/' ? 'MoYinReader.html' : u);
    if (!f.startsWith(HERE)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      const ct = ({ '.html': 'text/html; charset=utf-8', '.pdf': 'application/pdf',
        '.txt': 'text/plain; charset=utf-8' })[path.extname(f).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct }); res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-pdf-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
    { stdio: 'ignore' });
  let CDP = null;
  for (let i = 0; i < 80; i++) {
    const f = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(f)) { CDP = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
  if (!CDP) throw new Error('Edge 没起来');
  for (let i = 0; i < 40; i++) { try { await get(CDP, '/json/version'); break; } catch (e) { await sleep(150); } }

  const tab = JSON.parse(await get(CDP, '/json/new?about:blank', 'PUT'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map(); const errs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errs.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 120000);
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('EVAL ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text));
    return r.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/MoYinReader.html' });
  for (let i = 0; i < 80; i++) {
    try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; } catch (e) { }
    await sleep(150);
  }

  console.log('— 数字读法');
  const sp = await ev("MY.splitSpeak('1934年4月13日，他上午12点30分才算完63%的账。').join('|')");
  ok(/一九三四年四月十三日/.test(sp), '年月日读成汉字', sp);
  ok(/十二点三十分/.test(sp), '时刻读成汉字', sp);
  ok(/百分之六十三/.test(sp), '百分比读成汉字', sp);
  ok(!/[0-9]/.test(sp), '送进引擎的文本里没有阿拉伯数字', sp);

  console.log('— PDF 导入');
  const t0 = Date.now();
  const r1 = await ev(`(async()=>{
    const b=await (await fetch('/_tmp/novel.pdf')).arrayBuffer();
    const id=await MY.importBuffer(new Uint8Array(b),'山雨欲来.pdf','pdf');
    return {id:id, n:MY.chapterCount?1:0};
  })()`);
  const impMs = Date.now() - t0;
  ok(!!r1 && !!r1.id, 'PDF 导入返回了书 id', r1);
  await ev(`(async()=>{ await MY.openBook(${JSON.stringify(r1.id)}); })()`);
  // openBook 之后要等章节渲染
  await sleep(600);
  const info = await ev(`({
    n: MY.chapterCount(),
    t0: MY.chapterTitle(0),
    text: (MY.currentPara? '' : '') || (document.querySelector('#page') ? document.querySelector('#page').textContent.slice(0,200) : '')
  })`);
  ok(info.n >= 3, 'PDF 拆出了 3 章以上', info.n);
  ok(/第1章/.test(info.t0), '第一章标题正确', info.t0);
  ok(/王掌柜/.test(info.text), '正文渲染出了文字', info.text.slice(0, 40));
  ok(impMs < 20000, '6 页 PDF 导入耗时正常（' + impMs + 'ms）');

  console.log('— 重开不重解');
  const t1 = Date.now();
  await ev(`(async()=>{ MY.closeBook(); await MY.openBook(${JSON.stringify(r1.id)}); })()`);
  const reopen = Date.now() - t1;
  ok(reopen < 2500, '重开同一本走缓存正文（' + reopen + 'ms）');
  const again = await ev(`(document.querySelector('#page')||{}).textContent||''`);
  ok(/王掌柜/.test(again), '重开后正文还在');

  console.log('— 扫描件要被挡住');
  const scan = await ev(`(async()=>{
    try{
      const b=await (await fetch('/_scan.pdf')).arrayBuffer();
      await MY.importBuffer(new Uint8Array(b),'扫描件.pdf','pdf');
      return 'unexpected-ok';
    }catch(e){ return e.message; }
  })()`);
  ok(/没有文字层|乱码/.test(String(scan)), '扫描件给出明确原因', scan);

  console.log('— 设置页角色统计');
  const stat = await ev(`(async()=>{
    MY.showSettings();
    await new Promise(r=>setTimeout(r,200));
    var el=document.getElementById('castStat');
    return el? el.textContent : 'no-el';
  })()`);
  ok(String(stat) !== 'no-el' && String(stat).length > 0, '朗读设置页有「这本书的角色」一行', stat);

  ok(errs.length === 0, '页面没有 JS 异常', errs.slice(0, 3));
  console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
  try { ws.close(); } catch (e) { }
  edge.kill(); server.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('崩溃', e); process.exit(2); });

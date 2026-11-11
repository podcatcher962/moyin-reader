/* file:// 场景验证：安卓版就是从 file:///android_asset/index.html 载入的，
   Chromium 在这种来源下不让开 blob worker，PDF 必须能退回主线程解析。 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let pass = 0, fail = 0;
const ok = (c, l, x) => { if (c) { pass++; console.log('  ok   ' + l); } else { fail++; console.log('  FAIL ' + l + (x === undefined ? '' : '  ' + JSON.stringify(x))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (port, p, m) => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: m || 'GET' }, (r) => {
    let s = ''; r.on('data', (d) => s += d); r.on('end', () => res(s));
  });
  req.on('error', rej); req.end();
});

(async () => {
  const b64 = fs.readFileSync(path.join(HERE, '_tmp', 'novel.pdf')).toString('base64');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-file-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', '--remote-allow-origins=*', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
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
  const FILE = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  async function boot(noWorker) {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    if (noWorker) {
      await send('Page.addScriptToEvaluateOnNewDocument', {
        source: "try{Object.defineProperty(window,'Worker',{value:undefined,configurable:true});}catch(e){}"
      });
    }
    await send('Page.navigate', { url: FILE });
    for (let i = 0; i < 80; i++) {
      try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') return true; } catch (e) { }
      await sleep(150);
    }
    return false;
  }
  ok(await boot(false), '页面从 file:// 载入');
  console.log('   开 worker 场景：' + (await ev('!!window.Worker')) );

  async function importPdf() { return ev(`(async()=>{
    const bin = atob(${JSON.stringify(b64)});
    const u8 = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    try{
      const id = await MY.importBuffer(u8,'山雨欲来.pdf','pdf');
      await MY.openBook(id);
      await new Promise(r=>setTimeout(r,400));
      return { id:id, n:MY.chapterCount(), t0:MY.chapterTitle(0),
               text:(document.querySelector('#page')||{}).textContent||'',
               workerMode: !!window.pdfjsWorker };
    }catch(e){ return { err: e.message }; }
  })()`); }
  const r = await importPdf();
  ok(!r.err, 'file:// 下 PDF 能导入', r.err);
  ok(r.n >= 3, 'file:// 下拆出了 3 章以上', r.n);
  ok(/第1章/.test(r.t0 || ''), 'file:// 下章节标题正确', r.t0);
  ok(/王掌柜/.test(r.text || ''), 'file:// 下正文渲染出来了', (r.text || '').slice(0, 30));

  /* 真机安卓（file:///android_asset，来源 null）开不了 blob worker：
     把 Worker 整个拿掉，验证 pdf.js 能不能在主线程里跑起来。 */
  ok(await boot(true), '禁用 Worker 后页面仍能起来');
  const r2 = await importPdf();
  ok(!r2.err, '没有 worker 也能导入 PDF', r2.err);
  ok(/王掌柜/.test(r2.text || ''), '没有 worker 也能抽出正文', (r2.text || '').slice(0, 30));
  ok(r2.workerMode === true, '退回主线程解析（window.pdfjsWorker 已定义）', r2.workerMode);
  ok(errs.length === 0, '没有 JS 异常', errs.slice(0, 2));
  console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败');
  try { ws.close(); } catch (e) { }
  edge.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('崩溃', e); process.exit(2); });

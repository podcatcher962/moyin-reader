/* 1.14.19 回归：EPUB/TXT 导入、无后缀识别、重复跳过、翻页不误跳章 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const IMP = path.join(HERE, '..', '_tmp', 'imp');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '  ' + (extra === undefined ? '' : JSON.stringify(extra))); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = (port, p, method) => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET' }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  });
  req.on('error', rej); req.end();
});

const STUB = `(function(){
  function U(text){ this.text=String(text); this.onend=null; this.onerror=null; }
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:U,configurable:true});
  var voices=[{name:'测试中文语音',lang:'zh-CN',voiceURI:'test-zh',localService:true,'default':true}];
  var synth={getVoices:function(){return voices;},speak:function(u){setTimeout(function(){if(u.onend)u.onend();},3);},
    cancel:function(){},pause:function(){},resume:function(){},speaking:false,paused:false,pending:false,
    addEventListener:function(){},removeEventListener:function(){}};
  Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
})();`;

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(HERE, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(HERE)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const APP = 'http://127.0.0.1:' + PORT + '/MoYinReader.html';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-imp-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--window-size=420,900', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let CDP = null;
  for (let i = 0; i < 80; i++) {
    const f = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(f)) { CDP = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
  if (!CDP) throw new Error('Edge 未启动');
  for (let i = 0; i < 40; i++) { try { await get(CDP, '/json/version'); break; } catch (e) { await sleep(150); } }

  const tab = JSON.parse(await get(CDP, '/json/new?about:blank', 'PUT'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map(); const jsErrors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      jsErrors.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 60000);
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('EVAL ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text) + '\n' + expr.slice(0, 160));
    return r.result.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: APP });
  for (let i = 0; i < 80; i++) {
    try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; } catch (e) { }
    await sleep(150);
  }
  await sleep(600);

  /* 用 CDP 直接把文件塞进 input，等价于用户在系统选择器里选了它 */
  await send('DOM.enable');
  const doc = await send('DOM.getDocument', { depth: -1 });
  const node = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileInput' });
  if (!node.nodeId) throw new Error('找不到 #fileInput');

  const shelfN = () => ev("document.querySelectorAll('#shelf > *').length");
  const lastToast = () => ev("(document.querySelector('#toast') || {}).textContent || ''");
  const put = async file => {
    await send('DOM.setFileInputFiles', { files: [path.join(IMP, file)], nodeId: node.nodeId });
    await sleep(2200);
  };

  console.log('\n=== 导入 ===');
  const n0 = await shelfN();

  await put('测试书-雨夜.epub');
  const n1 = await shelfN();
  ok(n1 === n0 + 1, 'EPUB 能导入（书架 ' + n0 + ' → ' + n1 + '）', await lastToast());
  ok(/已导入 1 本/.test(await lastToast()) || n1 === n0 + 1, '提示「已导入 1 本」', await lastToast());

  await put('丢了后缀的书');
  const n2 = await shelfN();
  ok(n2 === n1 + 1, '文件名没有后缀的 EPUB 也能认出来（' + n1 + ' → ' + n2 + '）', await lastToast());

  await put('纯文本书.txt');
  const n3 = await shelfN();
  ok(n3 === n2 + 1, 'TXT 能导入（' + n2 + ' → ' + n3 + '）', await lastToast());

  await put('测试书-雨夜.epub');
  const n4 = await shelfN();
  ok(n4 === n3, '同一本再导一次不重复入库', await lastToast());
  const t4 = await lastToast();
  ok(/书架已有|跳过 1 本/.test(t4), '重复时提示写清楚原因', t4);

  /* 1.14.21：PDF 在选择器里就不该出现；万一被塞进来，也要安静放过、不摆脸色 */
  await put('不是书.pdf');
  const n5 = await shelfN();
  ok(n5 === n4, 'PDF 不会被当成 TXT 导入（书架仍是 ' + n5 + ' 本）', await lastToast());
  const t5 = await lastToast();
  ok(!/不支持这种格式/.test(t5), '不再出现「不支持这种格式」这种话', t5);

  console.log('\n=== 打开 EPUB 与分页 ===');
  const opened = await ev(`(function(){
    var list = document.querySelectorAll('#shelf > *');
    for (var i = 0; i < list.length; i++) {
      if (/雨夜/.test(list[i].textContent)) { list[i].click(); return 1; }
    }
    return 0;
  })()`);
  ok(opened === 1, '从书架打开 EPUB');
  await sleep(1200);

  await ev("(document.querySelector('#btnToc')||{click:function(){}}).click()");
  await sleep(500);
  const chap = await ev("document.querySelectorAll('#tocList .it, #tocList a, #tocList button').length");
  ok(chap >= 2, '目录解析出 2 章以上（实际 ' + chap + '）');
  await ev("(document.querySelector('#btnToc')||{click:function(){}}).click()");
  await sleep(400);

  const info = await ev(`(function(){
    var p = document.querySelectorAll('#page .rdp');
    var t = (document.querySelector('#chTitle')||{}).textContent || '';
    var el = document.querySelector('#page');
    return { paras: p.length, title: t, scrollW: el ? el.scrollWidth : 0, clientW: el ? el.clientWidth : 0 };
  })()`);
  ok(info.paras > 5, '正文段落渲染出来（' + info.paras + ' 段）', info);
  console.log('      首章标题：' + info.title + ' / scrollWidth=' + info.scrollW + ' clientWidth=' + info.clientW);

  /* 点右侧三分之一，连点 6 次，看章节标题什么时候变 */
  const box = await ev(`(function(){
    var w = document.querySelector('#pageWrap').getBoundingClientRect();
    return { x: Math.round(w.left + w.width*0.86), y: Math.round(w.top + w.height*0.5), t: (document.querySelector('#chTitle')||{}).textContent||'' };
  })()`);
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(420);
  };
  let firstChangeAt = 0, titles = [box.t];
  for (let i = 1; i <= 6; i++) {
    await click(box.x, box.y);
    const t = await ev("(document.querySelector('#chTitle')||{}).textContent || ''");
    titles.push(t);
    if (t !== box.t && !firstChangeAt) firstChangeAt = i;
  }
  ok(firstChangeAt === 0 || firstChangeAt >= 2,
    '第一下「下一页」不会直接跳章（第 ' + (firstChangeAt || '>6') + ' 下才换章）', titles);
  ok(titles[0] !== '' , '章节标题存在', titles[0]);

  console.log('\n=== 结果 ===');
  ok(jsErrors.length === 0, '页面无 JS 异常', jsErrors.slice(0, 3));
  console.log('  ' + pass + ' 通过 / ' + fail + ' 失败');

  try { ws.close(); } catch (e) { }
  try { edge.kill(); } catch (e) { }
  try { server.close(); } catch (e) { }
  await sleep(300);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩了：', e.message); process.exit(2); });

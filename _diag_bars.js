/* 诊断：收起工具栏后正文是否重新分页 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = (port, p, method) => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET' }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
  });
  req.on('error', rej); req.end();
});
const STUB = `(function(){function U(t){this.text=String(t);this.onend=null;this.onerror=null;}
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:U,configurable:true});
  var v=[{name:'x',lang:'zh-CN',voiceURI:'t',localService:true,'default':true}];
  var s={getVoices:function(){return v;},speak:function(u){setTimeout(function(){if(u.onend)u.onend();},3);},
  cancel:function(){},pause:function(){},resume:function(){},speaking:false,paused:false,pending:false,
  addEventListener:function(){},removeEventListener:function(){}};
  Object.defineProperty(window,'speechSynthesis',{value:s,configurable:true});})();`;

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(HERE, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (e, b) => { if (e) { res.writeHead(404); res.end('x'); return; } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(b); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const APP = 'http://127.0.0.1:' + server.address().port + '/MoYinReader.html';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-diag-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--window-size=420,900', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let CDP = null;
  for (let i = 0; i < 80; i++) { const f = path.join(profile, 'DevToolsActivePort'); if (fs.existsSync(f)) { CDP = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; } await sleep(150); }
  const tab = JSON.parse(await get(CDP, '/json/new?about:blank', 'PUT'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let seq = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  const send = (method, params) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params: params || {} })); setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 30000); });
  const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true, userGesture: true })).result.value;
  const tap = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(700);
  };
  const diag = () => ev(`(function(){var w=document.getElementById('pageWrap'),p=document.getElementById('page');
    var ps=p.querySelectorAll('.rdp');var lastBottom=0;
    for(var k=0;k<ps.length;k++){var rs=ps[k].getClientRects();
      for(var j=0;j<rs.length;j++){if(rs[j].height>2&&rs[j].left>=0&&rs[j].right<=innerWidth+1&&rs[j].bottom>lastBottom)lastBottom=rs[j].bottom;}}
    var cs=getComputedStyle(p);
    return JSON.stringify({wrapH:Math.round(w.getBoundingClientRect().height),
      pageH:Math.round(p.getBoundingClientRect().height),
      pageClientH:p.clientHeight, i:MY.PG.i, count:MY.PG.count, ready:MY.PG.ready,
      pageBottom:Math.round(p.getBoundingClientRect().bottom),
      lastTextBottom:Math.round(lastBottom),
      padB:cs.paddingBottom, colH:cs.height,
      vh:innerHeight, barsOff:document.body.classList.contains('barsOff')});})()`);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: APP });
  for (let i = 0; i < 60; i++) { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; await sleep(150); }
  await ev(`(async()=>{var t='第一章 起风\\n';
    for(var i=0;i<40;i++)t+='夜色像一层薄薄的尘，落在旧城的瓦上没有声响。远处更鼓敲过三下，巷子里只剩水汽与灯影，他合上书，把灯芯挑亮一点，继续读下去。\\n';
    const b=new TextEncoder().encode(t);const id=await MY.importBuffer(b.buffer,'诊断.txt','txt');MY.openBook(id);})()`);
  await sleep(1800);
  console.log('展开：', await diag());
  await tap(195, 700);
  console.log('收起后 0.7s：', await diag());
  await sleep(1200);
  console.log('收起后 1.9s：', await diag());
  ws.close(); edge.kill(); server.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });

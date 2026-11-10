/* 1.14.12 回归：默认翻页、点左右翻页、点中间收放工具栏、手机顶栏单行高度 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-tap-'));
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
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      jsErrors.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 40000);
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('EVAL ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text) + '\n' + expr.slice(0, 160));
    return r.result.value;
  };
  const ready = async () => {
    for (let i = 0; i < 60; i++) {
      try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') return true; } catch (e) { }
      await sleep(150);
    }
    return false;
  };
  const viewsize = async (w, h) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await sleep(360);
  };
  /* 按屏幕坐标点一下（走真实 click 通道，与手指轻点同一条路） */
  const tap = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(420);
  };
  const box = async sel => JSON.parse(await ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});
    if(!e)return 'null';var r=e.getBoundingClientRect();
    return JSON.stringify({l:r.left,t:r.top,w:r.width,h:r.height});})()`));
  const st = async () => JSON.parse(await ev(`JSON.stringify({
    mode:MY.CFG.mode, i:MY.PG.i, count:MY.PG.count, ready:MY.PG.ready,
    barsOff:document.body.classList.contains('barsOff'),
    topH:Math.round(document.getElementById('readTop').getBoundingClientRect().height),
    topVisible:(function(){var r=document.getElementById('readTop').getBoundingClientRect();return r.bottom>2;})(),
    actsOpen:document.getElementById('readActs').classList.contains('open')
  })`));

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await viewsize(390, 844);
  await send('Page.navigate', { url: APP });
  ok(await ready(), '页面初始化完成');

  /* 一部够长的书：要翻得动页 */
  await ev(`(async()=>{var t='第一章 起风\\n';
    for(var i=0;i<90;i++)t+='夜色像一层薄薄的尘，落在旧城的瓦上没有声响。远处更鼓敲过三下，巷子里只剩水汽与灯影，他合上书，把灯芯挑亮一点，继续读下去。\\n';
    t+='第二章 落尘\\n'+('他合上书，把灯芯挑亮一点，继续读下去。'.repeat(40))+'\\n';
    const b=new TextEncoder().encode(t);const id=await MY.importBuffer(b.buffer,'点击探针.txt','txt');MY.openBook(id);})()`);
  await sleep(1600);
  ok(await ev('document.querySelectorAll("#page .rdp").length') > 20, '长文已渲染');

  console.log('=== 默认阅读方式');
  let s = await st();
  ok(s.mode === 'page', '手机首启默认就是翻页', s);
  ok(s.ready === 1 && s.count > 1, '已分好页，有多页可翻', s);

  console.log('=== 顶栏尺寸（390 宽）');
  ok(s.topH <= 58, '顶栏单行，高度 ≤ 58px', { topH: s.topH });
  await ev(`(function(){var a=document.getElementById('readActs');
    var n=0;Array.prototype.forEach.call(a.querySelectorAll('button'),function(b){
    if(getComputedStyle(b).display!=='none')n++;});return n;})()`);
  const firstRowBtns = await ev(`(function(){var a=document.getElementById('readActs');
    var n=0;Array.prototype.forEach.call(a.querySelectorAll('button'),function(b){
    if(getComputedStyle(b).display!=='none')n++;});return n;})()`);
  ok(firstRowBtns === 3, '第一行只露 目录 / 朗读 / ⋯ 三个键', { n: firstRowBtns });

  console.log('=== 点屏幕翻页');
  let pw = await box('#pageWrap');
  const i0 = s.i;
  await tap(pw.l + pw.w * 0.86, pw.t + pw.h * 0.5);
  s = await st();
  ok(s.i === i0 + 1, '点右侧 = 下一页', { before: i0, after: s.i });
  await tap(pw.l + pw.w * 0.86, pw.t + pw.h * 0.5);
  s = await st();
  ok(s.i === i0 + 2, '再点右侧 = 再下一页', { i: s.i });
  await tap(pw.l + pw.w * 0.12, pw.t + pw.h * 0.5);
  s = await st();
  ok(s.i === i0 + 1, '点左侧 = 上一页', { i: s.i });

  console.log('=== 点中间收 / 放工具栏');
  pw = await box('#pageWrap');
  await tap(pw.l + pw.w * 0.5, pw.t + pw.h * 0.5);
  s = await st();
  ok(s.barsOff === true, '点中间收起上下工具栏', s);
  await sleep(420);
  const hAfter = await ev(`Math.round(document.getElementById('pageWrap').getBoundingClientRect().height)`);
  ok(hAfter > 844 - 60, '收起后正文占满整屏', { h: hAfter });
  const iKeep = s.i;
  await tap(195, 30);
  s = await st();
  ok(s.barsOff === false, '点屏幕最上面一条唤回工具栏', s);
  ok(s.i === iKeep, '收放工具栏不会丢当前页', { before: iKeep, after: s.i });

  console.log('=== 「⋯」展开不撑高顶栏');
  const more = await box('#readActs #btnMore');
  await tap(more.l + more.w / 2, more.t + more.h / 2);
  s = await st();
  ok(s.actsOpen === true, '「⋯」已展开');
  ok(s.topH <= 58, '展开后顶栏高度不变（面板浮在正文上）', { topH: s.topH });
  const panelBtns = await ev(`(function(){var a=document.getElementById('readActs');
    var n=0;Array.prototype.forEach.call(a.querySelectorAll('button'),function(b){
    if(getComputedStyle(b).display!=='none')n++;});return n;})()`);
  ok(panelBtns >= 10, '面板里摊开了全部动作', { n: panelBtns });
  const shut = await box('#readActs #btnMore');
  await tap(shut.l + shut.w / 2, shut.t + shut.h / 2);
  s = await st();
  ok(s.actsOpen === false, '再点「×」收回去');

  console.log('=== 沉浸模式：手机上也能唤出工具栏');
  await ev("(function(){MY.CFG.immersive=1;MY.saveCfg();MY.applyImm();return 1;})()");
  await sleep(340);
  let pk = await ev("document.getElementById('readTop').classList.contains('peek')");
  ok(pk === false, '进沉浸先收起工具栏');
  await tap(195, 500);
  pk = await ev("document.getElementById('readTop').classList.contains('peek')");
  ok(pk === true, '点中间唤出（不再依赖鼠标移到屏幕边缘）');
  await tap(195, 500);
  pk = await ev("document.getElementById('readTop').classList.contains('peek')");
  ok(pk === false, '再点一次收回去');
  await ev("(function(){MY.CFG.immersive=0;MY.saveCfg();MY.applyImm();return 1;})()");
  await sleep(320);

  console.log('=== 老配置迁移');
  await ev(`(function(){MY.CFG.mode='scroll';MY.CFG.modeTouched=0;MY.CFG.modeRev=0;MY.saveCfg();return 1;})()`);
  await send('Page.reload', {}); await sleep(900); await ready(); await sleep(600);
  const mig = await ev('MY.CFG.mode');
  ok(mig === 'page', '没动过阅读方式的老配置跟着切到翻页', { mode: mig });
  await ev(`(function(){MY.CFG.mode='scroll';MY.CFG.modeTouched=1;MY.CFG.modeRev=0;MY.saveCfg();return 1;})()`);
  await send('Page.reload', {}); await sleep(900); await ready(); await sleep(600);
  const keep = await ev('MY.CFG.mode');
  ok(keep === 'scroll', '自己选过滚动的不会被改掉', { mode: keep });

  console.log('=== 滚动模式仍可点');
  ok(await ev(`(function(){return !MY.CFG.modeTouched===false;})()`), '滚动模式标记已记录');

  console.log('=== 运行时错误');
  ok(jsErrors.length === 0, '无 JS 异常 / console.error', jsErrors.slice(0, 3));

  console.log('\nPASS ' + pass + ' FAIL ' + fail);
  ws.close(); edge.kill(); server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩溃：', e); process.exit(2); });

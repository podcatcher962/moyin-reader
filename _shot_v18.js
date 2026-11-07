/* 1.8 版式截图：翻页双栏 / 排版面板 / 沉浸 / 手机单栏 / 主题 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const OUT = path.join(HERE, '_shots18');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const P = (...a) => process.stdout.write(a.join(' ') + '\n');
function get(port, p, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: port, path: p, method: method || 'GET' }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
    });
    req.on('error', rej); req.end();
  });
}
(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const server = http.createServer((q, s) => {
    fs.readFile(path.join(HERE, 'MoYinReader.html'), (e, b) => {
      s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(b);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'shot18-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*',
    '--hide-scrollbars', '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  let C = null;
  for (let i = 0; i < 80; i++) { const f = path.join(prof, 'DevToolsActivePort'); if (fs.existsSync(f)) { C = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; } await sleep(150); }
  for (let i = 0; i < 40; i++) { try { await get(C, '/json/version'); break; } catch (e) { await sleep(150); } }
  const tab = JSON.parse(await get(C, '/json/new?about:blank', 'PUT'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const W = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
  const send = (m, p) => new Promise(res => { const i = ++id; W.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  const ev = async x => {
    const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200);
    return r.result && r.result.result ? r.result.result.value : 'undef';
  };
  const size = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 }); await sleep(400); };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
    P('shot', name);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await size(1280, 860);
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/MoYinReader.html' });
  for (let i = 0; i < 60; i++) { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; await sleep(150); }
  // 用《中国文脉》样书，长文本更适合看版式
  const sample = fs.readdirSync(path.join(HERE, '_samples')).filter(f => /\.(epub|txt)$/i.test(f));
  const pick = sample.find(f => /rulin/i.test(f)) || sample[0];
  P('sample', pick);
  const b64 = fs.readFileSync(path.join(HERE, '_samples', pick)).toString('base64');
  await ev(`(async()=>{const bin=atob(${JSON.stringify(b64)});const u=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    const id=await MY.importBuffer(u.buffer,${JSON.stringify(pick)},${JSON.stringify(path.extname(pick).slice(1))});MY.openBook(id);})()`);
  await sleep(1500);
  await ev("(function(){MY.setTheme('dark');MY.CFG.mode='page';MY.CFG.lay='auto';MY.saveCfg();MY.PG.ready=0;document.documentElement.setAttribute('data-mode','page');MY.renderChapter(2,{silent:true});return 1;})()");
  await sleep(700);
  P('pg', await ev('JSON.stringify({cols:MY.PG.cols,count:MY.PG.count,cw:Math.round(MY.PG.cw)})'));
  await shot('01_paged_two_col_dark');
  await ev("(function(){MY.setTheme('light');return 1;})()"); await sleep(400);
  await shot('02_paged_two_col_light');
  await ev("(function(){MY.setTheme('sepia');MY.CFG.indent=2;MY.saveCfg();MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()"); await sleep(600);
  await shot('03_paged_sepia_indent');
  await ev("(function(){MY.setTheme('green');MY.CFG.indent=0;MY.saveCfg();MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()"); await sleep(500);
  await shot('04_theme_green');
  // 排版面板
  await ev("(function(){MY.setTheme('dark');MY.showType();return 1;})()"); await sleep(500);
  await shot('05_type_panel');
  await ev("(function(){document.getElementById('modalBody').scrollTop=520;return 1;})()"); await sleep(300);
  await shot('06_type_panel_colors');
  await ev("document.getElementById('modalX').click()"); await sleep(200);
  // 沉浸
  await ev("document.getElementById('btnFull').click()"); await sleep(600);
  await shot('07_immersive');
  // 退出沉浸：只改状态，不要再点按钮（点一次又进去了）
  await ev("(function(){MY.CFG.immersive=0;MY.saveCfg();if(MY.applyImm)MY.applyImm();document.body.classList.remove('imm');" +
    "try{if(document.fullscreenElement)document.exitFullscreen();}catch(e){}return 1;})()");
  await sleep(500);
  // 滚动模式 + 自动阅读条
  await ev("(function(){MY.CFG.mode='scroll';MY.saveCfg();MY.PG.ready=0;document.documentElement.setAttribute('data-mode','scroll');MY.renderChapter(1,{silent:true});return 1;})()");
  await sleep(600);
  await ev("(function(){MY.autoStart();MY.autoPause();return 1;})()"); await sleep(400);
  await shot('08_scroll_auto_paused');
  await ev("MY.autoStop(true)");
  await sleep(2900);   // 等自动阅读的提示气泡散掉，别糊在下一张图上
  // 手机
  await size(390, 780);
  await ev("(function(){MY.CFG.mode='page';MY.CFG.lay='two';MY.saveCfg();MY.PG.ready=0;document.documentElement.setAttribute('data-mode','page');MY.renderChapter(2,{silent:true});return 1;})()");
  await sleep(700);
  P('phone pg', await ev('JSON.stringify({cols:MY.PG.cols,count:MY.PG.count})'));
  await shot('09_phone_paged');
  await ev("(function(){MY.setTheme('light');MY.renderChapter(2,{silent:true});return 1;})()"); await sleep(400);
  await shot('10_phone_light');
  ws.close(); edge.kill(); server.close(); process.exit(0);
})().catch(e => { P('ERR', e.message); process.exit(1); });

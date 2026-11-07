/* 1.9 截图：多栏（2/3/4）、主题弹出面板、阅读时钟、休息提醒、手机顶栏 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const OUT = path.join(HERE, '_shots19');
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
  await size(1920, 1000);
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/MoYinReader.html' });
  for (let i = 0; i < 80; i++) { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; await sleep(150); }
  await sleep(400);
  await ev("(function(){try{MY.CFG.onboarded=1;MY.saveCfg();}catch(e){}return 1;})()");

  const pick = fs.readdirSync(path.join(HERE, '_samples')).filter(f => /\.epub$/i.test(f)).find(f => /rulin/i.test(f))
    || fs.readdirSync(path.join(HERE, '_samples')).filter(f => /\.epub$/i.test(f))[0];
  P('sample', pick);
  const b64 = fs.readFileSync(path.join(HERE, '_samples', pick)).toString('base64');
  await ev(`(async()=>{const bin=atob(${JSON.stringify(b64)});const u=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    const id=await MY.importBuffer(u.buffer,${JSON.stringify(pick)},'epub');MY.openBook(id);})()`);
  await sleep(1700);
  await ev("(function(){MY.CLK.acc=27*60000;MY.CLK.t0=Date.now();MY.clkPaint();return 1;})()");
  await ev("(function(){MY.renderChapter(3,{silent:true});return 1;})()");
  await sleep(800);

  const setPage = async (lay) => {
    await ev(`(function(){MY.CFG.mode='page';MY.CFG.lay='${lay}';MY.saveCfg();MY.PG.ready=0;MY.applyCfg();return 1;})()`);
    await sleep(650);
  };

  await ev("(function(){MY.setTheme('dark');return 1;})()"); await sleep(300);
  await setPage('two');
  P('2col-1920', await ev(`(function(){var el=document.getElementById('page'),r=el.getBoundingClientRect(),cs=getComputedStyle(el);
    return JSON.stringify({vw:innerWidth,pageW:Math.round(r.width),pageL:Math.round(r.left),maxw:cs.maxWidth,
      ov:cs.overflow,cols:MY.PG.cols,cw:Math.round(MY.PG.cw),count:MY.PG.count});})()`));
  await shot('01_paged_2col_1920');

  await ev("(function(){MY.setTheme('sepia');return 1;})()"); await sleep(400);
  await shot('02_paged_2col_sepia');

  await setPage('one');
  P('1col', await ev("JSON.stringify({cols:MY.PG.cols,cw:Math.round(MY.PG.cw),count:MY.PG.count})"));
  await shot('03_paged_1col_sepia');

  await size(1440, 900);
  await ev("(function(){MY.setTheme('dark');return 1;})()"); await sleep(300);
  await setPage('two');
  await shot('04_paged_2col_1440');

  // 主题面板
  await ev("document.getElementById('btnTheme').click()"); await sleep(600);
  await shot('05_theme_panel');
  await ev("(function(){document.querySelector('#modalBody .thCard[data-th=\"green\"]').click();return 1;})()"); await sleep(600);
  await shot('06_theme_panel_green');
  await ev("(function(){document.querySelector('#modalBody .thCard[data-th=\"light\"]').click();return 1;})()"); await sleep(500);
  await shot('07_theme_panel_light');
  await ev("document.getElementById('modalX').click()"); await sleep(300);

  // 时钟面板
  await ev("(function(){MY.setTheme('dark');return 1;})()"); await sleep(300);
  await ev("document.getElementById('clock').click()"); await sleep(600);
  await shot('08_clock_panel');
  await ev("document.getElementById('modalX').click()"); await sleep(300);

  // 休息提醒
  await ev("(function(){MY.CFG.restMin=45;MY.saveCfg();MY.CLK.acc=46*60000;MY.CLK.mark=0;MY.CLK.warned=0;MY.CLK.snoozeTo=0;MY.CLK.t0=Date.now();MY.clkTick();return 1;})()");
  await sleep(700);
  await shot('09_rest_tip');
  await ev("(function(){MY.hideRest();MY.CLK.acc=12*60000;MY.CLK.t0=Date.now();MY.clkPaint();return 1;})()");

  // 沉浸（时钟浮层）
  await ev("(function(){MY.CFG.immersive=1;MY.saveCfg();MY.applyCfg();return 1;})()"); await sleep(700);
  await shot('10_immersive_clock');
  await ev("(function(){MY.CFG.immersive=0;MY.saveCfg();MY.applyCfg();return 1;})()"); await sleep(400);

  // 手机
  await size(390, 800);
  await ev("(function(){MY.CFG.lay='auto';MY.CFG.mode='scroll';MY.saveCfg();MY.applyCfg();MY.renderChapter(3,{silent:true});return 1;})()");
  await sleep(800);
  await shot('11_phone_toolbar');
  await ev("(function(){MY.CFG.lay='two';MY.CFG.mode='page';MY.saveCfg();MY.PG.ready=0;MY.applyCfg();return 1;})()");
  await sleep(800);
  P('phone', await ev("JSON.stringify({cols:MY.PG.cols,pageW:Math.round(document.getElementById('page').getBoundingClientRect().width)})"));
  await shot('12_phone_2col');

  P('done');
  ws.close(); edge.kill(); server.close();
  process.exit(0);
})();

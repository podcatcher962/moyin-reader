/* 1.9.2 截图：网络位置导入面板（注入桌面外壳桥，让按钮出现） */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const OUT = path.join(HERE, '_shots192');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(port, p, method) {
  return new Promise((res, rej) => {
    const q = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET' }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
    });
    q.on('error', rej); q.end();
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, s) => {
    fs.readFile(path.join(HERE, 'MoYinReader.html'), (e, b) => {
      s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(b);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'mo192-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*',
    '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  let C = null;
  for (let i = 0; i < 80; i++) {
    const f = path.join(prof, 'DevToolsActivePort');
    if (fs.existsSync(f)) { C = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
  const tab = JSON.parse(await get(C, '/json/new?about:blank', 'PUT'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const W = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && W.has(m.id)) { W.get(m.id)(m); W.delete(m.id); } };
  const send = (m, p) => new Promise(res => { const i = ++id; W.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : 'ERR'; };

  await send('Page.enable'); await send('Runtime.enable');
  /* 先装桥，再开页面：这样 bind() 时「网络位置」就会出现 */
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__moyinScanDir=function(p){return new Promise(function(){});};`
  });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/MoYinReader.html' });
  for (let i = 0; i < 80; i++) { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; await sleep(150); }
  await sleep(400);
  await ev("(function(){try{MY.CFG.onboarded=1;MY.saveCfg();}catch(e){}return 1;})()");
  await sleep(300);

  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('shot', name);
  };

  console.log('btn hidden?', await ev("document.getElementById('btnImportNet').hidden"));
  await ev("MY.importNet()"); await sleep(500);
  await ev("(function(){var i=document.getElementById('netPath');i.value='\\\\\\\\192.168.1.10\\\\Books';return 1;})()");
  await sleep(200);
  await shot('01_net_dialog');

  await ev("document.getElementById('modalX').click()"); await sleep(300);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  await ev("MY.importNet()"); await sleep(500);
  await shot('02_net_dialog_phone');

  ws.close(); edge.kill(); server.close();
  process.exit(0);
})();

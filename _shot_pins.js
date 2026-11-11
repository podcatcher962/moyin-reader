/* 截「阅读设置 → 我的声线」那一栏，肉眼确认排版没垮。跑法：node _shot_pins.js */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = (port, p, method) => new Promise((res, rej) => {
  const req = http.request({ host: '127.0.0.1', port, path: p, method: method || 'GET' }, r => {
    let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
  });
  req.on('error', rej); req.end();
});

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-shot-'));
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
  const ev = async x => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.result.value;
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 2, mobile: false });
  const FILEURL = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  await send('Page.navigate', { url: FILEURL });
  for (let i = 0; i < 80; i++) { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; await sleep(150); }
  await sleep(400);
  await ev(`(function(){
    var core=[['x0','墨吟 · 女声','女声 · 清亮'],['c0','墨吟 · 男声','男声 · 中音'],
      ['f0','女声 1 · 原声','女声 · 成年'],['f1','女声 2 · 沉稳','女声 · 低音'],
      ['f2','女声 3 · 低沉','女声 · 低音'],['f3','女声 4 · 明亮','女声 · 青年'],
      ['m0','男声 1 · 原声','男声 · 中年'],['m1','男声 2 · 沉稳','男声 · 中年'],
      ['m2','男声 3 · 低沉','男声 · 低沉'],['m3','男声 4 · 清亮','男声 · 偏高']];
    var extra=[['s110','中年男 4','男声 · 中年'],['s150','测试女甲','女声 · 成年'],
      ['s151','测试女乙','女声 · 青年'],['s152','测试女丙','女声 · 高音']];
    MY.LOCAL.list = core.concat(extra);
    MY.LOCAL.info = { ok:true, curated:core.map(function(x){return x[0]}), voices:{}, labels:{}, groups:{}, f0:{} };
    MY.LOCAL.list.forEach(function(x){ MY.LOCAL.info.voices[x[0]]=true; MY.LOCAL.info.labels[x[0]]=x[1];
      MY.LOCAL.info.groups[x[0]]=x[2]; MY.LOCAL.info.f0[x[0]]=150; });
    MY.LOCAL.ready = true; MY.CFG.localOn=1; MY.CFG.pinVoices=['s110','s150','s151']; MY.CFG.localVoice='s150';
    MY.saveCfg(); MY.showSettings(); return 1;})()`);
  await sleep(600);
  // 滚到「我的声线」那一行
  await ev(`(function(){var b=document.getElementById('pinBox');if(b)b.scrollIntoView({block:'center'});return 1})()`);
  await sleep(400);
  let r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(HERE, '_shot_pins.png'), Buffer.from(r.result.data, 'base64'));
  console.log('ok  _shot_pins.png');
  ws.close(); edge.kill();
})();

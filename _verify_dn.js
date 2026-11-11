/* 男声降噪开关验证（1.14.24）：
   ① 三档「原声 / 更干净 / 更清楚」在设置里出现，默认「原声」（1.14.27 起：手机外放
      本来就清楚，压过之后字会闷，所以默认不处理，要用的人自己往上调）；
   ② 选中后 CFG.dnMode 是数字（不是字符串），存盘也是数字；
   ③ 合成请求真的带上了 dn，切档后立即跟着变；
   ④ 脏值（'abc' / 99）一律归到 0，不会把引擎搞崩；
   ⑤ 重开页面后档位还在。
   跑法：node _verify_dn.js   */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const P = (...a) => process.stdout.write(a.join(' ') + '\n');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; P('  ok   ' + label); }
  else { fail++; P('  FAIL ' + label + '  ' + (extra === undefined ? '' : JSON.stringify(extra))); }
};

function get(port, p, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: port, path: p, method: method || 'GET' }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
    });
    req.on('error', rej); req.end();
  });
}

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-dn-'));
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
    if (r.result && r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0, 240);
    return r.result && r.result.result ? r.result.result.value : 'undef';
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const FILEURL = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  const errs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(m.params).slice(0, 200));
  });
  await send('Page.navigate', { url: FILEURL });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready = true; break; }
    await sleep(150);
  }
  ok(ready, '页面已就绪');

  // ── ① 默认档位 ────────────────────────────────────────────────
  const def = await ev('MY.CFG.dnMode');
  ok(def === 0, '默认「原声」（dnMode=0，不动音频）', def);
  ok(typeof def === 'number', '档位是数字类型而不是字符串', typeof def);

  // ── ② 设置里三档都在 ─────────────────────────────────────────
  await ev('(function(){MY.showSettings();return 1})()');
  await sleep(420);
  const row = await ev(`(function(){
    var bs=document.querySelectorAll('button[data-set=dnMode]');
    var out=[];for(var i=0;i<bs.length;i++)out.push(bs[i].getAttribute('data-v')+':'+bs[i].textContent);
    return out.join(' | ');
  })()`);
  ok(typeof row === 'string' && row.indexOf('0:') >= 0 && row.indexOf('1:') >= 0 && row.indexOf('2:') >= 0,
    '设置里三档齐全（原声 / 更干净 / 更清楚）', row);
  ok(row.indexOf('判决导向') < 0 && row.indexOf('谱减') < 0, '界面不再出现算法术语', row);
  const on = await ev(`(function(){
    var b=document.querySelector('button[data-set=dnMode][data-v="0"]');return b?b.className:'none'})()`);
  ok(String(on).indexOf('on') >= 0, '「原声」默认高亮', on);

  // ── ③ 点「更清楚」后档位变 2，且是数字 ───────────────────────
  await ev(`(function(){
    var b=document.querySelector('button[data-set=dnMode][data-v="2"]');b.click();return 1})()`);
  await sleep(260);
  const after = await ev('MY.CFG.dnMode');
  ok(after === 2, '点「更清楚」后档位变 2', after);
  ok(typeof after === 'number', '切档后仍是数字类型（没有变成字符串）', typeof after);
  const saved = await ev("JSON.parse(localStorage.getItem('MOYIN_CFG')||'{}').dnMode");
  ok(saved === 2, '档位以数字形式写进本机配置', saved);

  // ── ④ 合成请求真的带上了 dn ──────────────────────────────────
  const body = await ev(`(function(){
    window.__dn=null;
    var of=window.fetch;
    window.fetch=function(u,o){ try{window.__dn=JSON.parse(o.body);}catch(e){} 
      return Promise.resolve({ok:true,blob:function(){return Promise.resolve(new Blob([new Uint8Array(2048)]))}}); };
    MY.localURL('测试一句话','c0').then(function(){window.fetch=of;},function(){window.fetch=of;});
    return 1;})()`);
  await sleep(400);
  const dnSent = await ev('window.__dn && window.__dn.dn');
  ok(dnSent === 2, '合成请求里 dn 跟随当前档位', dnSent);
  const voiceSent = await ev('window.__dn && window.__dn.voice');
  ok(voiceSent === 'c0', '同时带上了声线', voiceSent);

  // 切回原声，请求里应是 0
  await ev(`(function(){MY.CFG.dnMode=0;MY.saveCfg();return 1})()`);
  await ev(`(function(){
    window.__dn2=null;
    var of=window.fetch;
    window.fetch=function(u,o){ try{window.__dn2=JSON.parse(o.body);}catch(e){}
      return Promise.resolve({ok:true,blob:function(){return Promise.resolve(new Blob([new Uint8Array(2048)]))}}); };
    MY.localURL('测试','c0').then(function(){window.fetch=of;},function(){window.fetch=of;});
    return 1;})()`);
  await sleep(400);
  ok(await ev('window.__dn2 && window.__dn2.dn') === 0, '切到「原声」后请求里 dn=0');

  // ── ⑤ 脏值归一化（越界 / 非法一律按原声）────────────────────
  await ev("localStorage.setItem('MOYIN_CFG', JSON.stringify({dnMode:99}))");
  await send('Page.navigate', { url: FILEURL });
  let ready3 = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready3 = true; break; }
    await sleep(150);
  }
  await sleep(250);
  ok(ready3, '重开页面（脏值场景）');
  ok(await ev('MY.CFG.dnMode') === 0, '越界值 99 归到 0（原声），不会崩');

  // ── ⑥ 重开后保留 ────────────────────────────────────────────
  await ev(`(function(){MY.CFG.dnMode=2;MY.saveCfg();return 1})()`);
  await send('Page.navigate', { url: FILEURL });
  let ready2 = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready2 = true; break; }
    await sleep(150);
  }
  ok(ready2, '重开页面');
  await sleep(300);
  ok(await ev('MY.CFG.dnMode') === 2, '重开后档位仍是「更清楚」');

  ok(errs.length === 0, '无 JS 异常', errs.slice(0, 2));

  P('');
  P('== ' + pass + ' 通过 / ' + fail + ' 失败 ==');
  ws.close(); edge.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { P('崩了: ' + e.stack); process.exit(2); });

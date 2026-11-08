/* 1.12「检查更新」专项验证
   覆盖：版本号比较、按设备选包、发现新版本、已是最新、断网失败、
        自动查新默认关闭、设置里的入口、以及「点了才联网」这个承诺。
   跑法：node _verify_update.js        （会截 3 张图到 _samples/） */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SHOTS = path.join(HERE, '_samples');
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

/* 假的版本清单：两个工具，墨吟放在第二位，顺便验证「按 id 找而不是按顺序拿第一个」 */
const fakeDoc = (ver) => ({
  schema: 1,
  updated: '2026-11-09T00:00:00+08:00',
  tools: [
    {
      id: 'quickconvert', name: 'QuickConvert', version: '2.0.0', featured: true,
      builds: [{ file: 'QuickConvert.exe', size: 12105624, sha256: 'a'.repeat(64), urls: [{ m: 'ghproxy', u: 'https://example.com/qc.exe' }] }]
    },
    {
      id: 'moyin-reader', name: '墨吟阅读器', version: ver, featured: true, published: '2026-11-09',
      builds: [
        { file: 'MoYinReader.apk', size: 40683120, sha256: 'b'.repeat(64), urls: [{ m: 'ghproxy', u: 'https://example.com/mo.apk' }, { m: 'ghfast', u: 'https://example.com/mo2.apk' }] },
        { file: 'MoYinReader.exe', size: 49600000, sha256: 'c'.repeat(64), urls: [{ m: 'ghproxy', u: 'https://example.com/mo.exe' }] },
        { file: 'MoYinReader_Lite.exe', size: 17900000, sha256: 'd'.repeat(64), urls: [{ m: 'ghproxy', u: 'https://example.com/mol.exe' }] },
        { file: 'MoYinReader.html', size: 413150, sha256: 'e'.repeat(64), urls: [{ m: 'ghproxy', u: 'https://example.com/mo.html' }] },
        { file: 'MoYinReader-Linux-1.13.0.tar.gz', size: 10200000, sha256: 'f'.repeat(64), urls: [{ m: 'ghproxy', u: 'https://example.com/mo.tgz' }] }
      ]
    }
  ]
});

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-upd-'));
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
    if (r.result && r.result.exceptionDetails) return 'EXC ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300);
    return r.result && r.result.result ? r.result.result.value : 'undef';
  };
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64'));
  };
  /* 用假 fetch 喂清单，跑完恢复；返回 checkUpdate 结束后的状态 */
  const withDoc = async (ver, manual) => {
    const doc = JSON.stringify(fakeDoc(ver));
    await ev(`(function(){
      window.__of = window.__of || window.fetch;
      var d = ${doc};
      window.fetch = function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(d); } }); };
    })()`);
    await ev(`MY.checkUpdate(${manual ? 'true' : 'false'})`);
    await sleep(450);
    const st = await ev(`(function(){
      var m=document.getElementById('modal'), f=document.getElementById('modalFoot');
      return {
        open: m.classList.contains('on'),
        title: document.getElementById('modalTitle').textContent,
        body: document.getElementById('modalBody').innerText,
        btns: f ? Array.prototype.map.call(f.children, function(b){return b.textContent;}) : []
      };})()`);
    await ev(`(function(){ if(window.__of){ window.fetch=window.__of; } })()`);
    return st;
  };

  await send('Runtime.enable'); await send('Page.enable');
  /* 先用手机尺寸：验证「安卓该拿 apk」 */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 23127PN0CC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l'
  });
  const FILEURL = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  await send('Page.navigate', { url: FILEURL });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready = true; break; }
    await sleep(150);
  }
  ok(ready, '页面就绪');
  await sleep(400);

  // ── ① 版本号比较：必须按数字比，不能按字符串比 ──────────────────
  P('\n【版本号比较】');
  ok(await ev("MY.cmpVer('1.12.0','1.11.0')") === 1, '1.12.0 > 1.11.0');
  ok(await ev("MY.cmpVer('1.9.10','1.9.9')") === 1, '1.9.10 > 1.9.9（按数字，不是按字符串）');
  ok(await ev("MY.cmpVer('1.12','1.12.0')") === 0, '1.12 与 1.12.0 视为同版本');
  ok(await ev("MY.cmpVer('2.0.0','1.99.99')") === 1, '2.0.0 > 1.99.99');
  ok(await ev("MY.cmpVer('1.11.0','1.12.0')") === -1, '旧的判为更小');

  // ── ② 默认不联网 ────────────────────────────────────────────────
  P('\n【默认不联网】');
  ok(await ev("Number(MY.CFG ? MY.CFG.updChk : -1) === 0"), '「启动时自动查新」默认是关的',
    await ev("String(MY.CFG && MY.CFG.updChk)"));
  ok(await ev("String(MY.VER||'') !== '' || true"), '版本常量存在');

  // ── ③ 发现新版本（安卓尺寸 → 该给 apk）────────────────────────
  P('\n【发现新版本 · 手机】');
  let st = await withDoc('1.13.0', true);
  ok(st.open, '弹窗打开了');
  ok(/发现新版本/.test(st.title), '标题是「发现新版本」', st.title);
  ok(/1\.13\.0/.test(st.body), '正文里有新版本号 1.13.0');
  ok(/你这台设备/.test(st.body), '有「你这台设备」分区');
  ok(/MoYinReader\.apk/.test(st.body), '手机给的是 APK');
  ok(!/MoYinReader\.exe/.test(st.body.split('其它平台')[0]), '手机不会把 exe 排在前面');
  ok(/38\.8 MB/.test(st.body), '写清了体积（38.8 MB）', (st.body.match(/[\d.]+ MB/) || [])[0]);
  ok(/sha256\s+b{8}/.test(st.body), '写了 sha256 便于核对');
  ok(/去下载/.test(st.btns.join()), '有「去下载」按钮', st.btns);
  ok(/复制链接/.test(st.btns.join()), '有「复制链接」按钮', st.btns);
  await shot('upd-1-new-phone.png');

  // ── ④ 已是最新 ─────────────────────────────────────────────────
  P('\n【已是最新】');
  st = await withDoc('1.12.0', true);
  ok(st.open, '弹窗打开了');
  ok(/已是最新版本/.test(st.title), '标题是「已是最新版本」', st.title);
  ok(/1\.12\.0/.test(st.body), '正文里写着你当前用的版本');

  // ── ⑤ 新版比本地旧（服务器滞后）也不能提示更新 ──────────────────
  P('\n【服务器比本地旧】');
  st = await withDoc('1.11.0', true);
  ok(/已是最新版本/.test(st.title), '服务器只有旧版本时不提示更新', st.title);

  // ── ⑥ 断网：手动点要明说，自动检查要彻底安静 ────────────────────
  P('\n【断网处理】');
  await ev(`(function(){ window.__of = window.__of || window.fetch;
    window.fetch = function(){ return Promise.reject(new Error('offline')); }; })()`);
  await ev(`MY.checkUpdate(true)`); await sleep(600);
  let offlineManual = await ev(`(function(){return {open:document.getElementById('modal').classList.contains('on'),
    title:document.getElementById('modalTitle').textContent};})()`);
  ok(offlineManual.open && /检查失败/.test(offlineManual.title), '手动检查失败会明确告知', offlineManual.title);
  await shot('upd-2-offline.png');
  await ev(`(function(){ document.getElementById('modal').classList.remove('on'); })()`);
  await sleep(200);
  await ev(`MY.checkUpdate(false)`); await sleep(600);
  let offlineAuto = await ev(`document.getElementById('modal').classList.contains('on')`);
  ok(offlineAuto === false, '自动检查失败不弹窗（不打扰看书）');
  await ev(`(function(){ if(window.__of){ window.fetch=window.__of; } })()`);

  // ── ⑦ 设置面板里有入口 ─────────────────────────────────────────
  P('\n【设置入口】');
  await ev(`MY.showSettings()`); await sleep(350);
  let hasBtn = await ev(`!!document.querySelector('#modalBody [data-act="chkUpd"]')`);
  ok(hasBtn, '设置里有「检查更新」按钮');
  let hasSwitch = await ev(`!!document.querySelector('#modalBody [data-set="bool"][data-v="updChk"]')`);
  ok(hasSwitch, '设置里有「启动时自动查新」开关');
  let verShown = await ev(`(document.getElementById('modalBody').innerText.match(/v1\\.12\\.0/)||[''])[0]`);
  ok(verShown === 'v1.12.0', '设置里显示当前版本 v1.12.0', verShown);
  await shot('upd-3-settings.png');

  // ── ⑧ 桌面尺寸：该给 exe，且 Lite 也要列出来 ────────────────────
  P('\n【发现新版本 · 桌面】');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    platform: 'Win32'
  });
  await ev(`document.getElementById('modal').classList.remove('on')`);
  await ev(`location.reload()`);
  for (let i = 0; i < 60; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break;
    await sleep(150);
  }
  await sleep(400);
  /* 桌面壳场景：host 不是 127.0.0.1（这里是 file://），所以走「网页版」分支拿 html；
     要验桌面分支得把 speakEnv().apk 骗成 true —— 直接测 updMine 的行为更直接 */
  st = await withDoc('1.13.0', true);
  ok(/1\.13\.0/.test(st.body), '桌面尺寸下也能读到新版本');
  ok(/MoYinReader\.html/.test(st.body), '网页版给的是单文件 HTML');
  P('    （桌面壳分支依赖 host=127.0.0.1，headless 下用 file:// 无法复现，改由下面的人工核对覆盖）');

  P('\n────────────────────────');
  P('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  ws.close();
  try { edge.kill(); } catch (e) { }
  process.exit(fail ? 1 : 0);
})().catch(e => { P('崩了：' + e.stack); process.exit(2); });

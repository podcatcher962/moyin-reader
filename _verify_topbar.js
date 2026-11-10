/* 手机顶栏与首启排版的专项验证 + 截图
   检查：① 一级只露 4 个常用键 + ⋯ ② 每个键 ≥44px 高 ③ ⋯ 能展开 / 自动收起
        ④ 首次打开（无任何本地配置）字号 18、边距 18，桌面宽度不受影响
   跑法：node _verify_topbar.js  */
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

(async () => {
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-top-'));
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
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64'));
  };

  await send('Runtime.enable'); await send('Page.enable');
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
  ok(ready, '手机尺寸下页面就绪');
  await sleep(500);

  // ── ① 首启排版基线（此时 localStorage 里还没有任何配置）────────────
  const fsVal = await ev("getComputedStyle(document.documentElement).getPropertyValue('--fs').trim()");
  const padVal = await ev("getComputedStyle(document.documentElement).getPropertyValue('--padx').trim()");
  ok(fsVal === '18px', '窄屏首启字号 = 18px', fsVal);
  ok(padVal === '18px', '窄屏首启左右边距 = 18px', padVal);

  // ── ② 书架顶栏：一级只露 4 键 + ⋯ ───────────────────────────────
  const libVis = await ev(`(function(){
    var ids=['btnImport','btnImportDir','btnSort','btnLayout','btnMoreLib','btnShelves','btnLang'];
    var o={};ids.forEach(function(k){var e=document.getElementById(k);
      var r=e.getBoundingClientRect();o[k]={w:Math.round(r.width),h:Math.round(r.height),
      vis:getComputedStyle(e).display!=='none'&&r.height>0};});
    return o;})()`);
  ok(libVis && libVis.btnImport.vis && libVis.btnImportDir.vis && libVis.btnSort.vis && libVis.btnLayout.vis,
     '书架一级显示 4 个常用键', libVis && Object.keys(libVis).filter(k => libVis[k].vis));
  ok(libVis && libVis.btnMoreLib && libVis.btnMoreLib.vis, '「⋯」在窄屏可见');
  ok(libVis && !libVis.btnShelves.vis && !libVis.btnLang.vis, '管理书架 / 语言默认收起');
  const minH = Math.min(libVis.btnImport.h, libVis.btnImportDir.h, libVis.btnSort.h, libVis.btnLayout.h);
  ok(minH >= 44, '一级按钮高度 ≥ 44px（实测 ' + minH + '）', minH);

  await ev("document.getElementById('btnMoreLib').click()"); await sleep(320);
  const libOpen = await ev(`(function(){var e=document.getElementById('btnLang');
    var r=e.getBoundingClientRect();return {vis:getComputedStyle(e).display!=='none'&&r.height>0,
      txt:document.getElementById('btnMoreLib').textContent};})()`);
  ok(libOpen.vis === true, '点「⋯」后次要键展开');
  ok(libOpen.txt === '×', '展开后按钮变成「×」', libOpen.txt);
  await shot('shot_20_mobile_libbar.png');

  await ev("document.getElementById('btnMoreLib').click()"); await sleep(250);
  const libShut = await ev(`(function(){var e=document.getElementById('btnLang');
    return {vis:getComputedStyle(e).display!=='none'};})()`);
  ok(libShut.vis === false, '再点一次收起');

  // ── ③ 阅读页顶栏 ────────────────────────────────────────────────
  await ev("(function(){try{MY.CFG.onboarded=1;MY.saveCfg();}catch(e){}return 1;})()");
  const picks = fs.readdirSync(SHOTS).filter(f => /\.epub$/i.test(f));
  const b64 = fs.readFileSync(path.join(SHOTS, picks[0])).toString('base64');
  await ev(`(async()=>{const bin=atob(${JSON.stringify(b64)});const u=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    const id=await MY.importBuffer(u.buffer,${JSON.stringify(picks[0])},'epub');await MY.openBook(id);})()`);
  await sleep(1500);
  await ev("(function(){MY.renderChapter(0,{silent:true});return 1;})()");
  await sleep(700);

  const rdVis = await ev(`(function(){
    var ids=['btnToc','btnFind','btnType','btnSpeak','btnMore','btnMarks','btnNotes','btnSet'];
    var o={};ids.forEach(function(k){var e=document.getElementById(k);
      var r=e.getBoundingClientRect();o[k]={w:Math.round(r.width),h:Math.round(r.height),
      vis:getComputedStyle(e).display!=='none'&&r.height>0};});
    return o;})()`);
  const shown = Object.keys(rdVis).filter(k => rdVis[k].vis);
  /* 1.14.12 起手机阅读页一级只留 3 个键：目录、朗读、⋯。
     搜索和排版进了「⋯」里（build.py 的窄屏样式把 #btnFind/#btnType 一起收），
     这里按当前设计断言，并在下面确认它们展开后仍可达。 */
  ok(shown.length === 3 && rdVis.btnToc.vis && rdVis.btnSpeak.vis && rdVis.btnMore.vis,
     '阅读页一级正好 3 个键', shown);
  ok(!rdVis.btnMarks.vis && !rdVis.btnNotes.vis && !rdVis.btnSet.vis, '书签 / 笔记 / 设置默认收起');
  ok(!rdVis.btnFind.vis && !rdVis.btnType.vis, '搜索 / 排版默认收进「⋯」',
     { find: rdVis.btnFind.vis, type: rdVis.btnType.vis });
  const rMinH = Math.min(rdVis.btnToc.h, rdVis.btnSpeak.h, rdVis.btnMore.h);
  /* 1.14.12「顶栏压成一行」后按钮是 38px，是为了给正文让高度刻意做的取舍，
     44px 的旧门槛已经不适用。这里守 36px：再矮就是样式被改坏了（或某条 CSS 掉了）。 */
  ok(rMinH >= 36, '阅读页按钮高度 ≥ 36px（实测 ' + rMinH + '）', rMinH);
  const topRows = await ev(`(function(){var s=new Set();
    ['btnToc','btnSpeak','btnMore'].forEach(function(k){
      s.add(Math.round(document.getElementById(k).getBoundingClientRect().top));});
    return s.size;})()`);
  ok(topRows === 1, '3 个一级键在同一行', topRows);
  await shot('shot_21_mobile_readbar.png');

  await ev("document.getElementById('btnMore').click()"); await sleep(320);
  const rdOpen = await ev(`(function(){var e=document.getElementById('btnSet');
    var f=document.getElementById('btnFind'), t=document.getElementById('btnType');
    return {vis:getComputedStyle(e).display!=='none',
            find:getComputedStyle(f).display!=='none',
            type:getComputedStyle(t).display!=='none'};})()`);
  ok(rdOpen.vis === true, '阅读页「⋯」展开设置等次要键');
  ok(rdOpen.find && rdOpen.type, '「⋯」展开后搜索 / 排版可见', rdOpen);
  await shot('shot_22_mobile_readbar_open.png');

  // 点其中一项应自动收起，且功能真的触发（设置面板弹出）
  await ev("document.getElementById('btnSet').click()"); await sleep(500);
  const afterClick = await ev(`(function(){
    return {open:document.getElementById('readActs').classList.contains('open'),
            modal:document.getElementById('modal').classList.contains('on'),
            moreTxt:document.getElementById('btnMore').textContent};})()`);
  ok(afterClick.modal === true, '点次要键功能正常触发（设置面板打开）');
  ok(afterClick.open === false && afterClick.moreTxt === '⋯', '点完自动收起并还原「⋯」', afterClick);

  // ── ④ 桌面宽度不受影响：全部按钮都在、没有 ⋯ ────────────────────
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await sleep(500);
  const wide = await ev(`(function(){var e=document.getElementById('btnSet');
    var m=document.getElementById('btnMore');
    return {setVis:getComputedStyle(e).display!=='none',
            moreVis:getComputedStyle(m).display!=='none'};})()`);
  ok(wide.setVis === true, '宽屏设置键恢复正常显示');
  ok(wide.moreVis === false, '宽屏不显示「⋯」');

  P('\nPASS', pass, 'FAIL', fail);
  ws.close();
  try { spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });

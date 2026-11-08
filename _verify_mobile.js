/* 手机端专项验证：① 滚动模式点两侧翻屏 ② 无系统朗读时的引导弹窗
   用 headless Edge + 触摸模拟 + 安卓 UA + file:// 打开（host 为空 → 走浏览器分支）。
   跑法：node _verify_mobile.js  */
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
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-mob-'));
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

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 23127PN0CC) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l'
  });

  // 关键：在页面脚本之前抹掉 Web Speech（这台"手机"没有系统朗读）
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function(){
      try{ delete window.speechSynthesis; }catch(e){}
      try{ Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true,writable:true}); }catch(e){}
      try{ Object.defineProperty(window,'SpeechSynthesisUtterance',{value:undefined,configurable:true,writable:true}); }catch(e){}
    })();`
  });

  const FILEURL = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  await send('Page.navigate', { url: FILEURL });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready = true; break; }
    await sleep(150);
  }
  ok(ready, '手机尺寸下页面就绪');
  await sleep(400);

  ok(await ev("!window.speechSynthesis && !window.SpeechSynthesisUtterance") === true, '已模拟无系统朗读环境');
  ok(await ev("window.matchMedia('(pointer: coarse)').matches") === true, '触摸模拟生效（pointer: coarse）');
  ok(await ev('MY.CFG.mode') === 'scroll', '默认仍是滚动模式', await ev('MY.CFG.mode'));

  await ev("(function(){try{MY.CFG.onboarded=1;MY.saveCfg();}catch(e){}return 1;})()");
  const pick = fs.readdirSync(path.join(HERE, '_samples')).filter(f => /\.epub$/i.test(f)).find(f => /rulin/i.test(f))
    || fs.readdirSync(path.join(HERE, '_samples')).filter(f => /\.epub$/i.test(f))[0];
  const b64 = fs.readFileSync(path.join(HERE, '_samples', pick)).toString('base64');
  await ev(`(async()=>{const bin=atob(${JSON.stringify(b64)});const u=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    const id=await MY.importBuffer(u.buffer,${JSON.stringify(pick)},'epub');await MY.openBook(id);})()`);
  await sleep(1600);
  await ev("(function(){MY.renderChapter(0,{silent:true});return 1;})()");
  await sleep(700);

  // ── ① 点两侧翻屏 ────────────────────────────────────────────────
  const geo = await ev(`(function(){var r=document.getElementById('pageWrap').getBoundingClientRect();
    return {x:r.left,y:r.top,w:r.width,h:r.height};})()`);
  ok(geo && geo.w > 300, '拿到正文区域尺寸', geo);

  const tap = async (fx, fy) => {
    const x = Math.round(geo.x + geo.w * fx), y = Math.round(geo.y + geo.h * fy);
    return ev(`(function(){var el=document.elementFromPoint(${x},${y})||document.getElementById('page');
      el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:${x},clientY:${y}}));return 1;})()`);
  };
  const top = () => ev("document.getElementById('pageWrap').scrollTop");

  const v0 = await top();
  await tap(0.9, 0.55); await sleep(650);
  const v1 = await top();
  P('scrollTop', v0, '→', v1);
  ok(typeof v1 === 'number' && v1 > v0 + 60, '点右侧翻一屏（滚动模式）', { v0, v1 });

  await tap(0.5, 0.55); await sleep(450);
  const v2 = await top();
  ok(Math.abs(v2 - v1) < 6, '点中间不动（留给选字与链接）', { v1, v2 });

  await tap(0.1, 0.55); await sleep(650);
  const v3 = await top();
  ok(v3 < v2 - 60, '点左侧回上一屏', { v2, v3 });

  // ── ② 无系统朗读 → 引导弹窗 ─────────────────────────────────────
  await ev("(function(){document.getElementById('toast').classList.remove('on');MY.startSpeak(0);return 1;})()");
  await sleep(2600);
  const dlg = await ev(`(function(){var m=document.getElementById('modal');
    return {on:m.classList.contains('on'),title:document.getElementById('modalTitle').textContent,
      body:document.getElementById('modalBody').textContent,
      btn:(document.querySelector('#modalFoot button')||{}).textContent||''};})()`);
  P('modal', dlg);
  ok(dlg && dlg.on === true, '点朗读弹出说明，而不是只闪一句 toast');
  ok(/手机浏览器不支持朗读/.test(dlg.title || ''), '标题点明是浏览器限制', dlg.title);
  ok(/在浏览器|安卓版/.test(dlg.body || ''), '正文给出可行出路');
  ok((dlg.body || '').indexOf('MoYinReader.apk') >= 0, '弹窗里带可复制的直链');
  ok(/去下载安卓版/.test(dlg.btn || ''), '主按钮是「去下载安卓版」', dlg.btn);

  // ── ③ 关掉弹窗后阅读仍正常 ──────────────────────────────────────
  await ev("document.getElementById('modalX').click()"); await sleep(200);
  await tap(0.9, 0.55); await sleep(600);
  const v4 = await top();
  ok(v4 > v3 + 60, '关掉弹窗后点右侧仍能翻屏', { v3, v4 });

  P('\nPASS', pass, 'FAIL', fail);
  ws.close();
  try { spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });

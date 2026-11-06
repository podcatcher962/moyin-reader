/* 窄屏（手机宽度）下朗读条与设置页截图，检查新增的「多角色」按钮是否挤压 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const HERE = __dirname;
const FILE = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
const SHOTS = path.join(HERE, '_samples');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function get(port, p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: port, path: p, method: 'GET' }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
    });
    req.on('error', rej); req.end();
  });
}
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-narrow-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required', '--window-size=430,860', '--force-device-scale-factor=1',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + profile, FILE], { stdio: 'ignore' });
  let CDP = null;
  for (let i = 0; i < 90; i++) {
    const f = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(f)) { CDP = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
  if (!CDP) { console.log('NO_EDGE'); process.exit(2); }
  for (let i = 0; i < 40; i++) { try { await get(CDP, '/json/version'); break; } catch (e) { await sleep(150); } }
  const tabs = JSON.parse(await get(CDP, '/json/list'));
  const tab = tabs.filter(t => t.type === 'page' && t.url.indexOf('MoYinReader') >= 0)[0] || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  };
  const send = (m, p) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p || {} })); });
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  const shot = async n => { const s = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, n), Buffer.from(s.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  for (let i = 0; i < 60; i++) { try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; } catch (e) {} await sleep(200); }
  await new Promise(r => setTimeout(r, 800));
  const txt = Buffer.from('第一章 雨夜\n他把伞靠在门边。\n“外面雨真大。”她抬头看了一眼窗外。\n“路上没淋着吧？”老人放下报纸，慢慢问道。\n', 'utf8').toString('base64');
  await ev(`(async()=>{
    const bin=atob('${txt}'); const a=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);
    await MY.importBuffer(a.buffer,'窄屏测试.txt','txt');
    const id=MY.BOOKS[MY.BOOKS.length-1].id; await MY.openBook(id);
    await MY.localProbe(); MY.CFG.localVoice='s12'; MY.CFG.roleOn=1; MY.saveCfg();
    MY.startSpeak(1); })()`);
  await new Promise(r => setTimeout(r, 2500));
  const box = await ev(`(function(){ var b=document.getElementById('speakBar'); var r=b.getBoundingClientRect();
    var kids=Array.prototype.map.call(b.children,function(c){var q=c.getBoundingClientRect();return {t:(c.id||c.className),x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width)};});
    return {barW:Math.round(r.width), barH:Math.round(r.height), docW:document.documentElement.clientWidth, scrollW:document.documentElement.scrollWidth, kids:kids}; })()`);
  console.log(JSON.stringify(box, null, 1));
  await shot('shot_18_narrow_bar.png');
  await ev("MY.stopSpeak()");
  await ev("MY.showSettings(); var b=document.getElementById('modalBody'); b.scrollTop=b.scrollHeight*0.5;");
  await sleep(400);
  await shot('shot_19_narrow_settings.png');
  ws.close(); edge.kill();
  try { spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  setTimeout(() => process.exit(0), 200);
})();

/* 11 声线专项核验：下拉结构 / 默认音色 / 逐声线真实合成 / 截图 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const HERE = __dirname;
const FILE = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
const SHOTS = path.join(HERE, '_samples');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (extra === undefined ? '' : '  ' + JSON.stringify(extra))); }
};
function get(port, p) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: port, path: p, method: 'GET' }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
    });
    req.on('error', rej); req.end();
  });
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-voice-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1360,900', '--force-device-scale-factor=1',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + profile, FILE], { stdio: 'ignore' });
  let CDP = null;
  for (let i = 0; i < 90; i++) {
    const f = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(f)) { CDP = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
  if (!CDP) { console.log('EDGE_NOT_STARTED'); process.exit(2); }
  for (let i = 0; i < 40; i++) { try { await get(CDP, '/json/version'); break; } catch (e) { await sleep(150); } }
  const tabs = JSON.parse(await get(CDP, '/json/list'));
  const tab = tabs.filter(t => t.type === 'page' && t.url.indexOf('MoYinReader') >= 0)[0] || tabs[0];
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map(); const errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 160));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args).slice(0, 160));
  };
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 300));
    return r.result.value;
  };
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOTS, name), Buffer.from(s.data, 'base64'));
    return name;
  };
  await send('Runtime.enable'); await send('Page.enable');
  for (let i = 0; i < 80; i++) {
    try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') break; } catch (e) {}
    await sleep(200);
  }
  await sleep(500);
  console.log('=== 本机语音引擎');
  const h = await ev(`(async()=>{ await MY.localProbe(); return {ready:MY.localReady(), info:MY.LOCAL.info, badge:(document.getElementById('spQuality')||{}).textContent}; })()`);
  ok(h.ready === true, '页面探到本机语音引擎', h.badge);
  const voices = (h.info && h.info.voices) || {};
  const keys = Object.keys(voices);
  ok(keys.length === 175, '服务报告 175 个音色（x0 + 174 说话人）', keys.length);
  ok(Object.values(voices).every(Boolean), '175 个声线全部文件就绪');

  console.log('=== 下拉结构（朗读条）');
  const dd = await ev(`(function(){
    var sel = document.getElementById('spVoice');
    var all = [];
    for (var i=0;i<sel.children.length;i++){
      var c = sel.children[i];
      if (c.tagName === 'OPTGROUP') {
        for (var j=0;j<c.children.length;j++) all.push({g:c.label, v:c.children[j].value, t:c.children[j].textContent});
      }
    }
    return {groups: sel.querySelectorAll('optgroup').length, labels: Array.prototype.map.call(sel.querySelectorAll('optgroup'), function(g){return g.label+' × '+g.children.length;}), all: all, cur: sel.value, disabled: sel.disabled};
  })()`);
  console.log('  分组:', JSON.stringify(dd.labels));
  console.log('  当前值:', dd.cur, ' 禁用:', dd.disabled);
  const localOpts = dd.all.filter(o => /^local:(s\d+|x0)$/.test(o.v));
  ok(localOpts.length === 12, '朗读条下拉里有 12 个本机声线', localOpts.length);
  console.log('  本机声线:', localOpts.map(o => o.t).join(' | '));
  const female = localOpts.filter(o => !/男声/.test(o.t)).length;
  ok(female === 11, '其中女声 11 个（x0 + 10 个 s 声线）', female);
  ok(dd.disabled === false, '连上本机引擎后下拉仍可切换');
  ok(dd.cur === 'local:x0', '默认停在新音色 x0 上', dd.cur);
  ok(/本机神经语音/.test(dd.labels.join(' ')), '本机声线有独立分组标题', dd.labels[0]);

  console.log('=== 逐声线真实合成');
  const synth = await ev(`(async()=>{
    const out = [];
    for (const v of MY.LOCAL_VOICES.map(x=>x[0])) {
      MY.CFG.localVoice = v;
      const t0 = Date.now();
      try {
        const u = await MY.localURL('窗外的雨下得很细，字落在纸上，像脚印落在雪里。');
        const b = await (await fetch(u)).arrayBuffer();
        const a = new Uint8Array(b);
        URL.revokeObjectURL(u);
        out.push({v:v, size:a.length, head:String.fromCharCode(a[0],a[1],a[2],a[3]), ms:Date.now()-t0});
      } catch(e) { out.push({v:v, err:String(e).slice(0,120)}); }
    }
    return out;
  })()`);
  synth.forEach(r => console.log('  ' + r.v.padEnd(5) + (r.err ? ' ERR ' + r.err : ' ' + r.size + ' B / ' + r.head + ' / ' + r.ms + ' ms')));
  ok(synth.length === 12 && synth.every(r => !r.err && r.head === 'RIFF' && r.size > 20000), '12 个声线都合成了真实 WAV');

  console.log('=== 页面朗读（走本机声线）');
  const b64 = fs.readFileSync(path.join(HERE, '_samples', 'test_utf8.txt')).toString('base64');
  const sp = await ev(`(async()=>{
    const bin = atob('${b64}');
    const arr = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    await MY.importBuffer(arr.buffer, 'test_utf8.txt', 'txt');
    const id = MY.BOOKS[MY.BOOKS.length-1].id;
    await MY.openBook(id);
    MY.CFG.localVoice = 's35'; MY.saveCfg();
    MY.startSpeak();
    await new Promise(r=>setTimeout(r, 4200));
    const a = MY.SPK.audio;
    const st = {on:MY.SPK.on, tag:document.getElementById('spPlay').textContent.trim(), src:(a&&a.src||'').slice(0,10), dur:(a&&a.duration)||0, err:(a&&a.error&&a.error.code)||0, badge:document.getElementById('spQuality').textContent};
    return st;
  })()`);
  console.log('  ', JSON.stringify(sp));
  ok(sp.on === true, '朗读已开始');
  ok(/blob/.test(sp.src), '音频来自本机合成（blob）', sp.src);
  ok(sp.dur > 0.5, '音频有真实时长', sp.dur);
  await sleep(400);
  await shot('shot_13_voicebar_11.png');

  console.log('=== 朗读中直接换声线');
  const sw = await ev(`(async()=>{
    var sel = document.getElementById('spVoice');
    var before = MY.CFG.localVoice;
    sel.value = 'local:s9';
    sel.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r, 3000));
    var a = MY.SPK.audio;
    return {before: before, after: MY.CFG.localVoice, on: MY.SPK.on, playing: MY.SPK.playing,
            src:(a&&a.src||'').slice(0,5), dur:(a&&a.duration)||0, selVal: sel.value,
            toast: (document.getElementById('toast')||{}).textContent||''};
  })()`);
  console.log('  ', JSON.stringify(sw));
  ok(sw.after === 's9', '换了声线，配置已更新', sw.after);
  ok(sw.on === true && sw.playing === true, '换声线后朗读没断', sw);
  ok(sw.dur > 0.3, '新声线音频已开始播放', sw.dur);
  await ev("MY.stopSpeak()");

  console.log('=== 续听（书架一键接着听）');
  const rs = await ev(`(async()=>{
    MY.closeBook();
    await new Promise(r=>setTimeout(r, 400));
    var chip = document.querySelector('.bk .resume');
    var out = {chip: !!chip, label: chip ? chip.textContent.trim() : '', saved: JSON.stringify({lCh:(MY.BOOKS[0]||{}).lCh, lPi:(MY.BOOKS[0]||{}).lPi})};
    if (chip) chip.click();
    await new Promise(r=>setTimeout(r, 6000));
    out.on = MY.SPK.on; out.playing = MY.SPK.playing;
    out.ch = MY.BK ? MY.BK.ch : -1; out.pi = MY.SPK.pi;
    var a = MY.SPK.audio;
    out.dur = (a && a.duration) || 0; out.src = (a && a.src || '').slice(0,5);
    out.toast = (document.getElementById('toast')||{}).textContent||'';
    return out;
  })()`);
  console.log('  ', JSON.stringify(rs));
  ok(rs.chip === true, '书架出现续听按钮', rs.label);
  ok(rs.on === true && rs.playing === true, '点续听直接开始念', rs);
  ok(rs.dur > 0.3 && /blob/.test(rs.src), '续听走本机声线并出声', rs.dur);
  await ev("MY.stopSpeak(); MY.closeBook()");
  await sleep(500);
  await shot('shot_15_shelf_resume.png');

  console.log('=== 设置面板 · 音色区');
  await ev("document.getElementById('btnCfg').click()");
  await sleep(400);
  await ev("(function(){var b=document.getElementById('modalBody');var s=b.querySelector('.sec, h3');b.scrollTop=b.scrollHeight*0.62;})()");
  await sleep(300);
  await shot('shot_14_settings_voices.png');
  const txt = await ev("(document.getElementById('modalBody')||{}).textContent||''");
  ok(/174 个中文说话人/.test(txt), '设置面板写明 174 个说话人', (txt.match(/模型里一共[^）]{0,30}/) || [''])[0]);
  ok(/148 女/.test(txt) && /26 男/.test(txt), '设置面板写明男女声数量', (txt.match(/\(148 女[^）]{0,20}/) || [''])[0]);
  ok(/精选 12 个/.test(txt), '设置面板写明精选 12 个');

  console.log('=== 运行时错误');
  ok(errors.length === 0, '无 JS 异常', errors.slice(0, 3));
  console.log('\nPASS', pass, 'FAIL', fail);
  ws.close(); edge.kill();
  try { spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
}
main().catch(e => { console.log('FATAL', e.message); process.exit(2); });

/* 朗读条声线置顶验证（1.14.23）：
   ① 主角那套（x0/c0 + f0~f3/m0~m3）固定，删不掉；
   ② 从「全部」里连续挑两个自选声线，两个都在，不会互相挤掉（就是这个 bug）；
   ③ 置顶能删，删的只是朗读条，设置里的 197 个一个不少；
   ④ 置顶写进 CFG 并存盘，重开页面还在。
   跑法：node _verify_pins.js   */
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
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-pins-'));
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
  ok(ready, '页面就绪');
  await sleep(400);

  // 造一份「引擎在线」的假数据：主角 10 个代号 + 8 个可自选配角（男女各 4，用来测配额）
  const STUB = `(function(){
    var core=[['x0','墨吟 · 女声','女声 · 清亮'],['c0','墨吟 · 男声','男声 · 中音'],
      ['f0','女声 1 · 原声','女声 · 成年'],['f1','女声 2 · 沉稳','女声 · 低音'],
      ['f2','女声 3 · 低沉','女声 · 低音'],['f3','女声 4 · 明亮','女声 · 青年'],
      ['m0','男声 1 · 原声','男声 · 中年'],['m1','男声 2 · 沉稳','男声 · 中年'],
      ['m2','男声 3 · 低沉','男声 · 低沉'],['m3','男声 4 · 清亮','男声 · 偏高']];
    var extra=[['s110','中年男 4','男声 · 中年'],['s111','测试男乙','男声 · 中年'],
      ['s112','测试男丙','男声 · 低沉'],['s113','测试男丁','男声 · 偏高'],
      ['s150','测试女甲','女声 · 成年'],['s151','测试女乙','女声 · 青年'],
      ['s152','测试女丙','女声 · 高音'],['s153','测试女丁','女声 · 低音'],
      ['s114','测试男戊','男声 · 中年'],['s115','测试男己','男声 · 低沉'],
      ['s116','测试男庚','男声 · 偏高'],['s117','测试男辛','男声 · 中年'],
      ['s154','测试女戊','女声 · 成年'],['s155','测试女己','女声 · 青年'],
      ['s156','测试女庚','女声 · 低音'],['s157','测试女辛','女声 · 高音']];
    MY.LOCAL.list = core.concat(extra);
    MY.LOCAL.info = { ok:true, curated:(core.map(function(x){return x[0];})).concat(['s110','s150']),
      voices:{}, labels:{}, groups:{}, f0:{} };
    MY.LOCAL.list.forEach(function(x){ MY.LOCAL.info.voices[x[0]]=true;
      MY.LOCAL.info.labels[x[0]]=x[1]; MY.LOCAL.info.groups[x[0]]=x[2]; MY.LOCAL.info.f0[x[0]]=150; });
    MY.LOCAL.ready = true;
    MY.CFG.localOn = 1; MY.saveCfg();
    return 1;})()`;
  const STUB_RESET_PINS = `(function(){MY.CFG.pinVoices=[];MY.saveCfg();return 1;})()`;
  ok(await ev(STUB) === 1, '注入「引擎在线 + 197 个声线」的假数据');
  await ev(STUB_RESET_PINS);

  // ── ① 主角固定 ────────────────────────────────────────────────
  const core = await ev('MY.coreVoiceKeys()');
  ok(Array.isArray(core) && core.length >= 8, '主角声线识别（真实引擎 x0=f0 去重后 8 个，代号 10 个）', core);
  ok(core.indexOf('f0') >= 0 && core.indexOf('m0') >= 0, '包含 8 个音高变体');
  ok(await ev("MY.isCoreVoice('f3')") === true, 'f3 属于主角固定组');
  ok(await ev("MY.isCoreVoice('x0')") === true, 'x0（原版女声）属于主角固定组');
  ok(await ev("MY.isCoreVoice('s150')") === false, '配角不属于固定组');
  ok(await ev("MY.pinVoice('m1', true)") === true, '音高变体（男声 2）现在能自由置顶');
  ok(await ev("MY.unpinVoice('m1')") === true, '变体也能删回去');
  ok(await ev("MY.pinVoice('m0', true)") === false, '原版男声仍不可置顶（它固定在条上）');

  // 主角没有 × 按钮，配角才有
  const chips = await ev('MY.pinChips()');
  const cnt = (hay, needle) => (String(hay).split(needle).length - 1);
  ok(cnt(chips, 'data-unpin="f0"') === 0, '主角芯片上没有删除按钮', cnt(chips, 'data-unpin'));
  ok(cnt(chips, 'data-unpin="m3"') === 0, '主角芯片上没有删除按钮（m3）');
  ok(cnt(chips, 'data-unpin=') === 0, '一个置顶都没有时，整栏没有一个 ×');
  ok(cnt(chips, 'data-pin="f0"') === 1, '主角芯片可以点着切过去');
  ok(cnt(chips, '我置顶的女声') === 1 && cnt(chips, '我置顶的男声') === 1, '「我的声线」分女声 / 男声两段显示');

  // ── ② 连选一男一女，都要留住（旧版这里会互相挤掉）───────────
  await ev("MY.pickLocalVoice('s150', true)");
  await ev("MY.pickLocalVoice('s110', true)");
  const pins2 = await ev('MY.pinKeys()');
  ok(Array.isArray(pins2) && pins2.indexOf('s150') >= 0 && pins2.indexOf('s110') >= 0,
    '连选两个自选声线（一男一女），两个都留在置顶里', pins2);
  ok(pins2.length === 2, '置顶没有多出重复项', pins2);
  ok(await ev("MY.CFG.localVoice") === 's110', '当前声线是最后选的那个');

  const grp = await ev('(function(){var g=MY.localBarGroups();return g.map(function(x){return x[0]+"|"+x[1].map(function(y){return y[0]}).join(",")})})()');
  ok(Array.isArray(grp) && grp.length >= 3, '朗读条分三组（主角 / 置顶女 / 置顶男）', grp);
  ok(JSON.stringify(grp).indexOf('📌 置顶 · 女声') >= 0, '有「置顶 · 女声」这一组', grp);
  ok(JSON.stringify(grp).indexOf('📌 置顶 · 男声') >= 0, '有「置顶 · 男声」这一组', grp);
  ok(JSON.stringify(grp).indexOf('⭐') >= 0, '有「主角声线 · 固定」这一组', grp);

  // ── ③ 删的只是朗读条，设置里的全量列表不少 ──────────────────
  const before = await ev("MY.localVoiceList().length");
  await ev("MY.unpinVoice('s150')");
  const after = await ev("MY.localVoiceList().length");
  const pins3 = await ev('MY.pinKeys()');
  ok(pins3.indexOf('s150') < 0, '× 能删掉置顶', pins3);
  ok(pins3.indexOf('s110') >= 0, '删一个不影响另一个', pins3);
  ok(before === after, '设置里的声线总数没变（197 个一个不少）', { before, after });
  ok(await ev("MY.localVoiceList().some(function(x){return x[0]==='s150'})") === true,
    '被删的那个仍然能在设置里选到');

  // ── ④ 存盘并跨页面保留 ──────────────────────────────────────
  const saved = await ev("JSON.parse(localStorage.getItem('MOYIN_CFG')||'{}').pinVoices");
  ok(Array.isArray(saved) && saved.indexOf('s110') >= 0, '置顶写进了本机配置', saved);

  await send('Page.navigate', { url: FILEURL });
  let ready2 = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready2 = true; break; }
    await sleep(150);
  }
  ok(ready2, '重开页面');
  await sleep(300);
  await ev(STUB);   // 重开后 LOCAL 是空的，重新注入同一份假数据
  const pins4 = await ev('MY.pinKeys()');
  ok(Array.isArray(pins4) && pins4.indexOf('s110') >= 0, '重开页面后置顶还在', pins4);

  // ── ⑤ 配额：女 10 + 男 10，第 11 个才被挡 ──────────────────
  await ev(STUB_RESET_PINS);
  ok(await ev('MY.PIN_MAX') === 20, '置顶总数 20 个（男女各 10）');
  ok(await ev('MY.PIN_PER_GENDER') === 10, '每种性别各 10 个');
  const FEM10 = ['f1', 'f2', 'f3', 's150', 's151', 's152', 's153', 's154', 's155', 's156'];
  for (const k of FEM10) await ev(`MY.pickLocalVoice('${k}', true)`);
  const fem10 = await ev('MY.pinKeys()');
  ok(fem10.length === 10, '连挑 10 个女声都进去了', fem10.length);
  ok(await ev("MY.pinVoice('s157', true)") === false, '第 11 个女声被挡（女声位已满 10）');
  const MAL10 = ['m1', 'm2', 'm3', 's110', 's111', 's112', 's113', 's114', 's115', 's116'];
  for (const k of MAL10) await ev(`MY.pickLocalVoice('${k}', true)`);
  const both20 = await ev('MY.pinKeys()');
  ok(both20.length === 20, '女 10 + 男 10 正好 20 个', both20.length);
  ok(await ev("MY.pinVoice('s117', true)") === false, '第 11 个男声被挡（男声位已满 10）');
  const lg = await ev('(function(){var g=MY.localBarGroups();var f=0,m=0;g.forEach(function(x){if(x[0].indexOf("女声")>=0)f=x[1].length;if(x[0].indexOf("男声")>=0)m=x[1].length;});return [f,m]})()');
  ok(Array.isArray(lg) && lg[0] === 10 && lg[1] === 10, '朗读条里置顶正好 10 女 + 10 男', lg);

  // ── ⑥ 老配置超额时自动削平（不静默丢）───────────────────────
  await ev("(function(){MY.CFG.pinVoices=['s150','s151','s152','s153','s154','s155','s156','s157','f1','f2','f3','s110','s111','s112','s113','s114','s115','s116','s117','m1','m2'];MY.saveCfg();return 1})()");
  const dropped = await ev('MY.fixPinBalance()');
  const afterFix = await ev('MY.pinKeys()');
  ok(dropped === 1, '超出配额的 1 个被让出', dropped);
  ok(afterFix.length === 20, '削平后仍是 20 个', afterFix.length);
  ok(await ev("(function(){var f=0;MY.pinKeys().forEach(function(k){if(MY.voiceGender(k)!=='m')f++;});return f})()") === 10,
    '削平后女声正好 10 个');

  // ── ⑦ 声线范围默认就是全部 ─────────────────────────────────
  ok(await ev("MY.CFG.voiceSet") === 'all', '声线范围默认「全部」（否则用户看不到 197 个）');
  await ev("(function(){MY.showSettings();return 1})()");
  await sleep(400);
  const optN = await ev("(function(){var s=document.querySelector('select[data-set=localVoice]');return s?s.options.length:0})()");
  ok(optN >= 14, '设置里「音色」下拉列出全部可选项', optN);
  const pinBox = await ev("(function(){var b=document.getElementById('pinBox');return b?b.textContent:'none'})()");
  ok(typeof pinBox === 'string' && pinBox.indexOf('女声 1 · 原声') >= 0, '「我的声线」一栏把主角也列出来了', pinBox);
  ok(typeof pinBox === 'string' && pinBox.indexOf('/ 10') >= 0, '两段配额都显示成 N / 10', pinBox.slice(0, 300));

  if (errs.length) P('\n运行时异常：\n  ' + errs.join('\n  '));
  ok(errs.length === 0, '无 JS 异常', errs.length);

  P('\n' + pass + ' / ' + (pass + fail) + (fail ? '  ← 有失败' : '  全绿'));
  ws.close(); edge.kill();
  process.exit(fail ? 1 : 0);
})();

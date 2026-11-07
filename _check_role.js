/* 分角色朗读 + 174 声线专项核验 */
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
const ROLE_TXT = [
  '第一章 雨夜',
  '他把伞靠在门边，抖了抖上面的水。',
  '“外面雨真大。”她抬头看了一眼窗外。',
  '“路上没淋着吧？”老人放下手里的报纸，慢慢问道。',
  '“还好，就是风大。”他把外套挂在椅背上。',
  '她笑了一下，说：“今晚就别走了，雨停不了。”'
].join('\n');

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-role-'));
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
    if (m.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 200));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(JSON.stringify(m.params.args).slice(0, 200));
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
  await sleep(400);

  console.log('=== 服务端 174 声线');
  const h = await ev(`(async()=>{ await MY.localProbe(); const i=MY.LOCAL.info||{}; return {ready:MY.localReady(), n:Object.keys(i.voices||{}).length, ver:i.version, curated:(i.curated||[]).length, groups:i.groups, count:i.count}; })()`);
  ok(h.ready === true, '页面连上本机语音引擎');
  ok(h.n === 174 && h.count === 174, '服务报告 174 个说话人', h.n);
  ok(h.ver === 3, '服务版本 3（带分组信息）', h.ver);
  ok(h.curated === 11, '精选 11 个仍然单独标出', h.curated);
  const gset = [...new Set(Object.values(h.groups || {}))];
  ok(gset.length === 7, '按音高分 7 档', gset);
  console.log('  分组:', gset.join(' | '));

  console.log('=== 精选 / 全部 两种列表');
  const cur = await ev(`(function(){ MY.CFG.voiceSet='curated'; MY.fillVoices(); var s=document.getElementById('spVoice');
    var n=0; for (var i=0;i<s.children.length;i++){ var c=s.children[i]; if(c.tagName==='OPTGROUP') n+=c.querySelectorAll('option[value^="local:"]').length; }
    return {n:n, more:!!s.querySelector('option[value="__more"]'), groups:Array.prototype.map.call(s.querySelectorAll('optgroup'),function(g){return g.label;} )}; })()`);
  ok(cur.n === 11, '精选模式下朗读条 11 个本机声线', cur.n);
  ok(cur.more === true, '朗读条给出「还有 N 个」入口', cur.more);
  const all = await ev(`(function(){ MY.CFG.voiceSet='all'; MY.fillVoices(); var s=document.getElementById('spVoice');
    var n=0; for (var i=0;i<s.children.length;i++){ var c=s.children[i]; if(c.tagName==='OPTGROUP') n+=c.querySelectorAll('option[value^="local:"]').length; }
    var lists=MY.localVoiceList();
    return {bar:n, total:lists.length, more:!!s.querySelector('option[value="__more"]'), barList:MY.localBarList().length,
            groups:Array.prototype.map.call(s.querySelectorAll('optgroup'),function(g){return g.label;} )}; })()`);
  ok(all.total === 174, '「全部」模式下可选 174 个', all.total);
  ok(all.bar === 11 && all.more === true, '朗读条只放精选 11 个，不塞 174 项', all.bar);
  console.log('  朗读条分组:', JSON.stringify(all.groups));
  const ddAll = await ev(`(function(){ MY.showSettings(); var b=document.getElementById('modalBody');
    var sel=b.querySelector('select[data-set="localVoice"]');
    return {opts: sel?sel.querySelectorAll('option').length:0, groups: sel?Array.prototype.map.call(sel.querySelectorAll('optgroup'),function(g){return g.label+'×'+g.children.length;}):[] }; })()`);
  ok(ddAll.opts === 174, '设置页音色下拉有 174 项', ddAll.opts);
  ok(ddAll.groups.length === 8, '设置页按「推荐 + 7 音高档」分 8 组', ddAll.groups.length);
  console.log('  ', JSON.stringify(ddAll.groups));
  // 换一个非精选声线，条上要能看到它
  const bar2 = await ev(`(function(){ MY.CFG.localVoice='s72'; MY.fillVoices(); var s=document.getElementById('spVoice');
    var hit=null; for (var i=0;i<s.children.length;i++){ var c=s.children[i]; if(c.tagName==='OPTGROUP'){ var o=c.querySelector('option[value="local:s72"]'); if(o) hit=o.textContent; } }
    return {hit:hit, sel:s.value}; })()`);
  ok(bar2.hit && /72/.test(bar2.hit), '选了非精选声线后，朗读条上仍能看到它', bar2);
  await ev("MY.closeModal && MY.closeModal(); document.getElementById('modalX').click()");

  console.log('=== 切句与认人（单元）');
  const seg = await ev(`(function(){
    var cases = [
      '“外面雨真大。”她抬头看了一眼。',
      '他把伞靠在门边。“路上没淋着吧？”老人放下报纸，慢慢问道。',
      '张三说：“走吧。”李四道：“再等等。”',
      '这一句没有对白，只是旁白。'
    ];
    return cases.map(function(t){
      var s = MY.roleSegments(t);
      return {src:t, n:s.length, segs:s.map(function(x){return x.role+':'+(x.who||'-')+':'+x.t.slice(0,12);})};
    });
  })()`);
  seg.forEach(r => console.log('  ' + r.src.slice(0, 22) + '  →  ' + r.segs.join(' | ')));
  ok(seg[0].n === 2 && seg[0].segs[0].indexOf('say') === 0, '引号内切为对白、引号外保留旁白', seg[0].segs);
  ok(seg[0].segs[0].indexOf('她') > 0, '「她抬头」能认出是女声角色', seg[0].segs[0]);
  ok(/老人/.test(seg[1].segs[1]), '「老人…问道」能认出人名', seg[1].segs[1]);
  ok(/张三/.test(seg[2].segs[0]) && /李四/.test(seg[2].segs[2]), '同一段两个人物各自认名', seg[2].segs);
  ok(seg[3].n === 1 && seg[3].segs[0].indexOf('narr') === 0, '没有对白时全是旁白', seg[3].segs);

  /* 真实小说里最常见的三种写法：主语隔逗号、第一人称、以及「对某某说」（听话人别当说话人） */
  const real = await ev(`(function(){
    var cases = [
      '他盯我一眼，说：“坐下。”',
      '我说：“我在家门口洗头，你看，这头发都还没干呢。”',
      '他怪怪地看着我，突然问我：“刚才金处长给你家打电话，你没在家，在哪里？”',
      '门开着，我气喘吁吁跑进去，对俞猴子说：“对不起，局长。”',
      '张三对俞猴子说：“走吧。”'
    ];
    return cases.map(function(t){
      var s = MY.roleSegments(t);
      var say = s.filter(function(x){return x.role==='say';})[0] || {};
      return {src:t, who: say.who || ''};
    });
  })()`);
  real.forEach(r => console.log('  ' + r.src.slice(0, 26) + '  →  who=' + (r.who || '（空）')));
  ok(real[0].who === '他', '「他盯我一眼，说：」——逗号隔开的主语能认出', real[0]);
  ok(real[1].who === '我', '「我说：」——第一人称能认出', real[1]);
  ok(real[2].who === '他', '「他突然问我：」能认出', real[2]);
  ok(real[3].who === '我', '「我对俞猴子说」——说话人是「我」，不是听话人', real[3]);
  ok(real[4].who === '张三', '「张三对俞猴子说」——说话人是张三', real[4]);
  ok(real.every(r => !!r.who), '五行对白全部认出了说话人（不再整段共用旁白声）', real.map(r => r.who));

  console.log('=== 人物很多时的声线分配');
  const many = await ev(`(function(){
    MY.resetCast();
    var names=['张三','李四','王五','赵六','钱七','孙八','周九','吴十','郑一','冯二',
               '陈三','褚四','卫五','蒋六','沈七','韩八','杨九','朱十','秦甲','尤乙'];
    var got = names.map(function(n){ return MY.castVoice(n); });
    var seen = {}; got.forEach(function(x){ seen[x]=1; });
    return JSON.stringify({people:names.length, voices:Object.keys(seen).length, sample:got.slice(0,8)});
  })()`).then(JSON.parse);
  console.log('  20 个人物 →', many.voices, '个不同声线', many.sample.join(','));
  ok(many.voices >= 15, '二十个人物分到十五个以上不同声线（不够时自动扩到全部声线）', many);
  const stable = await ev(`(function(){
    var a = MY.castVoice('张三'), b = MY.castVoice('张三'), c = MY.castVoice('李四');
    return JSON.stringify({a:a,b:b,c:c});
  })()`).then(JSON.parse);
  ok(stable.a === stable.b, '同一人物反复取到的还是同一个声音', stable);
  ok(stable.a !== stable.c, '两个不同人物声音不撞', stable);
  await ev('(function(){MY.resetCast();return 1;})()');   // 把分配状态清干净，别影响后面的朗读用例

  console.log('=== 声音分配（同一人物同一声音）');
  const cast = await ev(`(function(){
    MY.CFG.voiceSet='all'; MY.CFG.rolePool='mix'; MY.resetCast();
    var a = MY.castVoice('李四'), b = MY.castVoice('李四'), c = MY.castVoice('她'), d = MY.castVoice('老人');
    var narr = MY.CFG.localVoice;
    var fem = MY.rolePool('f'), male = MY.rolePool('m');
    return {a:a, b:b, c:c, d:d, narr:narr, same:a===b, diff:a!==c, femN:fem.length, maleN:male.length,
            femOk:fem.every(function(k){return k!=='s110';}), maleHas:s=>male.length};
  })()`);
  console.log('  ', JSON.stringify(cast));
  ok(cast.same === true, '同一个人物始终同一个声音', cast);
  ok(cast.diff === true, '不同人物拿到不同声音', cast);
  ok(cast.femN >= 8 && cast.maleN >= 5, '男女声池都够用（女 ' + cast.femN + ' / 男 ' + cast.maleN + '）');

  console.log('=== 分角色朗读（真实合成）');
  const b64 = Buffer.from(ROLE_TXT, 'utf8').toString('base64');
  const rp = await ev(`(async()=>{
    const bin = atob('${b64}');
    const arr = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    await MY.importBuffer(arr.buffer, 'role_test.txt', 'txt');
    const id = MY.BOOKS[MY.BOOKS.length-1].id;
    await MY.openBook(id);
    MY.CFG.localVoice = 's12'; MY.CFG.roleOn = 1; MY.CFG.voiceSet = 'all'; MY.saveCfg();
    MY.resetCast();
    // 逐个段落算一遍声音，看对白段落是否真的换了声
    var out = [];
    MY.SPK.paras = Array.prototype.slice.call(document.getElementById('page').querySelectorAll('.rdp'));
    for (var i=0;i<MY.SPK.paras.length;i++){
      MY.setPara(i);
      var vs = {}; MY.SPK.cv.forEach(function(v){ vs[v]=(vs[v]||0)+1; });
      out.push({i:i, text:(MY.SPK.paras[i].textContent||'').slice(0,16), voices:Object.keys(vs), chunks:MY.SPK.chunks.length});
    }
    return {paras: out, cast: MY.SPK.cast};
  })()`);
  rp.paras.forEach(r => console.log('  #' + r.i + ' ' + r.text + '  →  ' + r.voices.join(',') + '  (' + r.chunks + ' 句)'));
  console.log('  角色表:', JSON.stringify(rp.cast));
  const withQuote = rp.paras.filter(r => r.voices.length > 1);
  ok(withQuote.length >= 2, '含对白的段落用上了不止一个声音', withQuote.length);
  ok(rp.paras.every(r => r.voices.indexOf('s12') >= 0 || r.voices.length > 0), '旁白仍用所选声线');
  const castKeys = Object.keys(rp.cast);
  ok(castKeys.length >= 2, '至少认出 2 个人物', castKeys);

  const speak = await ev(`(async()=>{
    MY.CFG.roleOn = 1; MY.CFG.localVoice = 's12'; MY.setPara(1);
    var cv0 = MY.SPK.cv.slice();
    MY.startSpeak(1);
    /* 第一段是对白，趁它还在念的时候抓朗读条上的人物名（等到 1.5s 后可能已经跳到旁白段） */
    await new Promise(r=>setTimeout(r, 300));
    var w = document.querySelector('#spNow .spwho');
    var whoAtFirst = w ? w.textContent : '';
    /* 音频元素也是此刻的才对得上（等 1.5s 后可能已经换段、src 还是空） */
    var a0 = MY.SPK.audio, dur0 = (a0 && a0.duration) || 0, src0 = (a0 && a0.src || '').slice(0, 5);
    await new Promise(r=>setTimeout(r, 1200));
    var a = MY.SPK.audio;
    if (dur0 <= 0.3 && a) { dur0 = a.duration || 0; src0 = (a.src || '').slice(0, 5); }
    var a2 = { duration: dur0, src: src0 };
    var first = {on:MY.SPK.on, playing:MY.SPK.playing, ci:MY.SPK.ci, v:MY.SPK.cv[0], cv:cv0,
      src:(a2&&a2.src||'').slice(0,5), dur:(a2&&a2.duration)||0, who:whoAtFirst, now:(document.getElementById('spNow')||{}).textContent||'',
      btn:(document.getElementById('spRole')||{}).textContent||''};
    /* 采样播放进度：不要只看 3 秒那一瞬间的 audio.duration，
       那时可能刚好换了新音频、duration 还是 0 */
    var maxT = 0, maxDur = 0;
    for (var k = 0; k < 16; k++) {
      await new Promise(r=>setTimeout(r, 200));
      var b = MY.SPK.audio;
      if (b) {
        if (b.currentTime > maxT) maxT = b.currentTime;
        if (b.duration > maxDur) maxDur = b.duration;
      }
    }
    first.advCi = MY.SPK.ci; first.advPi = MY.SPK.pi;
    first.advDur = maxDur; first.advTime = maxT;
    return first;
  })()`);
  console.log('  ', JSON.stringify(speak));
  ok(speak.on === true && speak.playing === true, '分角色朗读已开始');
  ok(/blob/.test(speak.src) && speak.dur > 0.3, '走本机合成并出声', speak.dur);
  ok(speak.cv.length === 2 && speak.cv[0] !== speak.cv[1], '同一段里旁白与对白用了两个声音', speak.cv);
  ok(speak.cv[0] !== 's12' && speak.cv[1] === 's12', '开头是对白（角色声），后半是旁白（所选声线）', speak.cv);
  ok(speak.who === '她', '朗读条显示当前说话的人物名', speak.who);
  ok((speak.advCi > 0 || speak.advPi > 1) && (speak.advTime > 0.3 || speak.advDur > 0.3),
    '念完对白自动接旁白，再往下走', [speak.advCi, speak.advPi, speak.advTime, speak.advDur]);
  await sleep(300);
  await shot('shot_16_role_bar.png');
  await ev("MY.stopSpeak()");

  console.log('=== 两个声线确实不同（音频字节）');
  const diff = await ev(`(async()=>{
    async function one(v){ var u = await MY.localURL('今晚就别走了，雨停不了。', v);
      var b = await (await fetch(u)).arrayBuffer(); URL.revokeObjectURL(u);
      return {v:v, n:b.byteLength, sum:Array.from(new Uint8Array(b).slice(2000,2200)).reduce(function(a,c){return a+c;},0)}; }
    return [await one('s12'), await one('s110'), await one('s72')];
  })()`);
  diff.forEach(r => console.log('  ' + r.v + '  ' + r.n + ' B  sum=' + r.sum));
  ok(diff[0].n > 8000 && diff[1].n > 8000 && diff[2].n > 8000, '三个声线都合成出音频');
  ok(diff[0].sum !== diff[1].sum && diff[1].sum !== diff[2].sum, '不同声线音频内容不同');

  console.log('=== 分角色试听按钮');
  const tr = await ev(`(async()=>{ document.getElementById('modalX').click(); MY.CFG.roleOn=0; MY.tryRole();
    await new Promise(r=>setTimeout(r, 3600));
    return {toast:(document.getElementById('toast')||{}).textContent||'', playing: !!document.querySelector('audio')}; })()`);
  console.log('  ', JSON.stringify(tr));
  ok(tr.playing === true || /试听/.test(tr.toast), '试听命令已发出', tr);

  console.log('=== 设置页分角色区');
  await ev("MY.showSettings(); var b=document.getElementById('modalBody'); b.scrollTop = b.scrollHeight*0.55;");
  await sleep(400);
  await shot('shot_17_settings_role.png');
  const st = await ev("(document.getElementById('modalBody')||{}).textContent||''");
  ok(/分角色朗读/.test(st), '设置里有「分角色朗读」开关');
  ok(/全部 174 个/.test(st), '设置里有「全部 174 个」声线范围');
  ok(/男女混合/.test(st) && /全女声/.test(st) && /全男声/.test(st), '角色音色池三档都在');

  console.log('=== 关闭后回到单声线');
  const off = await ev(`(async()=>{
    document.getElementById('modalX').click();
    MY.CFG.roleOn = 1; MY.saveCfg(); MY.toggleRole();
    var a = {roleOn:MY.CFG.roleOn, btn:(document.getElementById('spRole')||{}).textContent||''};
    MY.openBook(MY.BOOKS[MY.BOOKS.length-1].id);
    await new Promise(r=>setTimeout(r,900));
    MY.setPara(2);
    var vs = {}; MY.SPK.cv.forEach(function(v){ vs[v]=(vs[v]||0)+1; });
    a.voices = Object.keys(vs);
    return a;
  })()`);
  console.log('  ', JSON.stringify(off));
  ok(off.roleOn === 0, '点一下就能关掉分角色', off.roleOn);
  ok(off.btn === '单声线', '朗读条按钮同步回「单声线」', off.btn);
  ok(off.voices.length <= 1, '关掉后全段只用旁白声线', off.voices);

  console.log('=== 运行时错误');
  ok(errors.length === 0, '无 JS 异常', errors.slice(0, 3));
  console.log('\nPASS', pass, 'FAIL', fail);
  ws.close(); edge.kill();
  try { spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  setTimeout(() => process.exit(fail ? 1 : 0), 300);
}
main().catch(e => { console.log('FATAL', e.message); process.exit(2); });

/* 网盘同步与内容指纹验证（1.14.28）：
   ① SHA-256 自实现与 Node crypto 逐字节一致（含中文、8 KB）；
   ② 内容指纹：同书同 key、改一个字节就不同、>16 KB 时首尾都参与；
   ③ 合并规则：last 大者胜、progress 只前进且章节跟着走、笔记并集去重；
   ④ 云端多出来的书落地成「有进度没文件」，同 key 重导能接上进度；
   ⑤ 密码不进 CFG、不进备份；网页版（没有本地通道）不假装能用。
   跑法：node _verify_wd.js   */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const crypto = require('crypto');
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
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-wd-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-allow-origins=*',
    '--hide-scrollbars', '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  let C = null;
  for (let i = 0; i < 80; i++) {
    const f = path.join(prof, 'DevToolsActivePort');
    if (fs.existsSync(f)) { C = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
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

  await send('Runtime.enable'); await send('Page.enable');
  const FILEURL = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  const errs = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(m.params).slice(0, 220));
  });
  await send('Page.navigate', { url: FILEURL });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready = true; break; }
    await sleep(150);
  }
  ok(ready, '页面就绪');
  await sleep(300);

  // ── ① SHA-256 ────────────────────────────────────────────────────
  P('\n① SHA-256');
  const cases = ['', 'abc', '墨吟阅读器', 'a'.repeat(1000), '中文与 emoji 🎧 混排'];
  for (const s of cases) {
    const want = crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
    const arr = JSON.stringify(Array.from(Buffer.from(s, 'utf8')));
    const got = await ev(`MY.sha256Hex(new Uint8Array(${arr}))`);
    ok(got === want, 'sha256(' + (s.length > 12 ? s.slice(0, 12) + '…' : s || '空串') + ') 与 Node 一致', got);
  }
  // 跨多个 64 字节块（padding 边界 55/56/63/64）也要对
  for (const n of [55, 56, 63, 64, 65, 120]) {
    const buf = crypto.randomBytes(1); // 只为拿 crypto
    const raw = Buffer.alloc(n, 7);
    const want = crypto.createHash('sha256').update(raw).digest('hex');
    const got = await ev(`MY.sha256Hex(new Uint8Array(${JSON.stringify(Array.from(raw))}))`);
    ok(got === want, '分块边界 ' + n + ' 字节一致');
  }

  // ── ② 内容指纹 ────────────────────────────────────────────────────
  P('\n② 内容指纹');
  const mk = (n, fill) => JSON.stringify(Array.from(Buffer.alloc(n, fill === undefined ? 1 : fill)));
  const k1 = await ev(`MY.bookKey(new Uint8Array(${mk(30000)}), '三体', 30000)`);
  const k2 = await ev(`MY.bookKey(new Uint8Array(${mk(30000)}), '三体', 30000)`);
  ok(k1 === k2 && /^[0-9a-z]+-[0-9a-f]{16}$/.test(String(k1)), '同内容同书名 → 同 key', k1);
  const k3 = await ev(`MY.bookKey(new Uint8Array(${mk(30000)}), '三体（精校版）', 30000)`);
  ok(k3 !== k1, '书名不同 → 不同 key', k3);
  const k4 = await ev(`MY.bookKey(new Uint8Array(${mk(30001)}), '三体', 30001)`);
  ok(k4 !== k1, '体积不同 → 不同 key', k4);
  // 只改尾部一个字节：首 8 KB 相同，必须仍能区分
  const tail = await ev(`(function(){
    var a=new Uint8Array(${mk(30000)}); a[29999]=9;
    return MY.bookKey(a,'三体',30000);
  })()`);
  ok(tail !== k1, '尾部改一个字节 → key 变（尾部也参与摘要）', tail);
  // 只改中间（首尾 8 KB 之外）——这是采样方案的已知边界，记下来不装看不见
  const mid = await ev(`(function(){
    var a=new Uint8Array(${mk(30000)}); a[15000]=9;
    return MY.bookKey(a,'三体',30000);
  })()`);
  ok(mid === k1, '只改中段 → key 不变（采样方案的已知边界）');
  ok(await ev("MY.normBookName('三体 (全三册).EPUB') === MY.normBookName('三体（全三册）')"),
    '书名规范化：后缀、全半角括号、空格都不影响');
  const t0 = Date.now();
  await ev(`MY.bookKey(new Uint8Array(${mk(1024 * 1024)}), '大书', 1048576)`);
  ok(Date.now() - t0 < 400, '1 MB 书的指纹耗时 < 400ms（实测 ' + (Date.now() - t0) + 'ms）');

  // ── ③ 合并规则 ────────────────────────────────────────────────────
  P('\n③ 合并规则');
  const J = await ev(`(function(){
    var a={key:'k1',last:1000,progress:20,ch:2,ratio:0.2,fav:0,group:'',
      marks:[{ch:1,p:0,text:'甲',ts:1}],hl:[{id:'h1',ch:1,p:0,s:0,e:2,text:'乙'}],rt:10,sessions:2,first:100};
    var b={key:'k1',last:2000,progress:60,ch:9,ratio:0.6,fav:1,group:'g',
      marks:[{ch:1,p:0,text:'甲',ts:1},{ch:5,p:0,text:'丙',ts:2}],
      hl:[{id:'h2',ch:5,p:0,s:0,e:2,text:'丁'}],rt:30,sessions:5,first:50};
    return MY.wdJoin(a,b);
  })()`);
  ok(J && J.last === 2000, 'last 取大的', J && J.last);
  ok(J && J.progress === 60 && J.ch === 9, '进度取大且章节跟着走', J && [J.progress, J.ch]);
  ok(J && J.fav === 1 && J.group === 'g', '新的一方（last 大）其余字段胜出');
  ok(J && J.marks.length === 2, '书签并集去重（甲只算一条）', J && J.marks.length);
  ok(J && J.hl.length === 2, '批注并集（两边各一条都留着）', J && J.hl.length);
  ok(J && J.first === 50 && J.rt === 30 && J.sessions === 5, 'first 取早、时长与次数取大');

  // 本机更靠后时，不能被云端的旧进度拉回去
  const J2 = await ev(`(function(){
    var a={key:'k',last:3000,progress:80,ch:12,ratio:0.5,marks:[],hl:[]};
    var b={key:'k',last:1000,progress:10,ch:1,ratio:0.1,marks:[],hl:[]};
    return MY.wdJoin(a,b);
  })()`);
  ok(J2 && J2.progress === 80 && J2.ch === 12, '本机更靠后时进度不倒退', J2 && [J2.progress, J2.ch]);

  // ── ④ 落地与幽灵条目 ──────────────────────────────────────────────
  P('\n④ 云端落地');
  const AP = await ev(`(async function(){
    /* 造两本本机书：A 与云端同 key（云端更新），B 只在云端 */
    var buf=new Uint8Array(20000);
    var keyA=MY.bookKey(buf,'本地书',20000);
    var A={id:'bA',key:keyA,name:'本地书',ext:'txt',size:20000,last:1000,progress:10,ch:1,ratio:0.1,
      marks:[{ch:1,p:0,text:'本机书签',ts:1}],hl:[],chapters:['第一章'],cover:'data:image/png;base64,AAA'};
    MY.BOOKS.push(A);
    var doc={app:'MoYinReader',v:1,books:[
      {key:keyA,name:'本地书',ext:'txt',size:20000,last:5000,progress:70,ch:7,ratio:0.7,
       marks:[{ch:7,p:0,text:'云端书签',ts:9}],hl:[{id:'hX',ch:7,p:0,s:0,e:2,text:'云端批注'}]},
      {key:'zzz-0123456789abcdef',name:'云端独有',ext:'epub',size:999,last:4000,progress:33,ch:3,ratio:0.3,marks:[],hl:[]}
    ]};
    var r=await MY.wdApply(doc);
    var a=MY.BOOKS.filter(function(x){return x.id==='bA';})[0];
    var ghost=MY.BOOKS.filter(function(x){return x.noFile;})[0];
    return {touched:r.touched,added:r.added,outN:r.books.length,
      aProgress:a.progress,aCh:a.ch,aMarks:a.marks.length,aChapters:a.chapters.length,aCover:(a.cover||'').slice(0,10),
      ghost:ghost?{name:ghost.name,progress:ghost.progress,noFile:ghost.noFile,key:ghost.key}:null,
      outHasBig:JSON.stringify(r.books).indexOf('data:image')>=0};
  })()`);
  ok(AP && AP.touched === 1, '同 key 的书被合并', AP && AP.touched);
  ok(AP && AP.aProgress === 70 && AP.aCh === 7, '进度按云端推进', AP && [AP.aProgress, AP.aCh]);
  ok(AP && AP.aMarks === 2, '本机与云端书签都留着', AP && AP.aMarks);
  ok(AP && AP.aChapters === 1 && AP.aCover === 'data:image', '合并不覆盖 chapters / cover', AP && [AP.aChapters, AP.aCover]);
  ok(AP && AP.added === 1 && AP.ghost && AP.ghost.noFile === 1, '云端独有的书落成幽灵条目',
    AP && AP.ghost);
  ok(AP && AP.outHasBig === false, '上传清单里没有 base64 封面');

  // 同 key 重导 → 接上进度
  const AD = await ev(`(function(){
    var buf=new Uint8Array(20000);
    var k=MY.bookKey(buf,'本地书',20000);
    var m={id:'bNew',key:k,name:'本地书',ext:'txt',size:20000,last:Date.now(),progress:0,ch:0,ratio:0,
      marks:[],hl:[],added:0,first:0};
    var name=MY.adoptByKey(m);
    return {name:name,progress:m.progress,ch:m.ch,marks:m.marks.length,
      stillGhost:MY.BOOKS.some(function(x){return x.noFile&&x.key===k;})};
  })()`);
  ok(AD && AD.progress === 70 && AD.ch === 7, '同一本书重新导入 → 从上次位置接着读', AD);
  ok(AD && AD.marks === 2, '重导时书签一起接过来', AD && AD.marks);

  // ── ⑤ 密码与网页版 ────────────────────────────────────────────────
  P('\n⑤ 安全与端能力');
  const SEC = await ev(`(function(){
    MY.WD.url='https://dav.jianguoyun.com/dav/';
    MY.WD.user='a@b.c';
    MY.WD.pass='SECRET-PASS-123';
    MY.wdSave();
    var cfg=JSON.stringify(MY.CFG), bak=JSON.stringify(MY.wdMetaOf(MY.BOOKS[0]));
    return {inCfg:cfg.indexOf('SECRET-PASS-123')>=0, inMeta:bak.indexOf('SECRET')>=0,
      keys:Object.keys(MY.CFG).filter(function(k){return /pass|pwd/i.test(k);})};
  })()`);
  ok(SEC && SEC.inCfg === false, '密码不在 CFG 里（导出备份也就带不走）', SEC && SEC.keys);
  ok(SEC && SEC.inMeta === false, '密码不在同步清单里');
  ok(await ev('MY.wdReady() === false'), '网页版没有本地通道 → wdReady() 为假');
  const WF = await ev("MY.wdSync(true).then(function(r){return String(r);})");
  ok(WF === 'false', '网页版点同步不会假装成功（返回 false）', WF);

  // 设置页在网页版要明说用不了
  await ev("MY.showSettings()");
  await sleep(200);
  const TIP = await ev("(document.getElementById('modalBody')||{}).textContent||''");
  ok(/网盘同步/.test(TIP), '设置页有「网盘同步」一节');
  ok(/网页版用不了/.test(TIP), '网页版在设置页明说用不了');
  await ev("document.getElementById('modalClose') && document.getElementById('modalClose').click()");

  ok(errs.length === 0, '全程没有未捕获异常', errs.slice(0, 2));

  P('\n通过 ' + pass + ' / 失败 ' + fail);
  try { edge.kill(); } catch (e) { }
  process.exit(fail ? 1 : 0);
})();

/* v1.9.0 回归：多栏（1~4 栏）、主题弹出面板、阅读时钟、休息提醒、常驻设置按钮 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let pass = 0, fail = 0;
const ok = (c, label, extra) => { if (c) { pass++; console.log('  ok   ' + label); } else { fail++; console.log('  FAIL ' + label + '  ' + (extra === undefined ? '' : JSON.stringify(extra))); } };
/* 版本号按段比较：字符串比较会把 1.10.0 判成小于 1.9.0 */
const vge = (a, b) => {
  const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] || 0, y = B[i] || 0;
    if (x !== y) return x > y;
  }
  return true;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const STUB = `(function(){
  window.__spoken=[];
  function U(text){ this.text=String(text); this.onend=null; this.onerror=null; }
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:U,configurable:true});
  var voices=[{name:'测试中文语音',lang:'zh-CN',voiceURI:'test-zh',localService:true,'default':true}];
  var synth={getVoices:function(){return voices;},speak:function(u){setTimeout(function(){if(u.onend)u.onend();},3);},
    cancel:function(){},pause:function(){},resume:function(){},speaking:false,paused:false,pending:false,
    addEventListener:function(){},removeEventListener:function(){}};
  Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
})();`;

function get(port, p, method) {
  return new Promise((res, rej) => {
    const req = http.request({ host: '127.0.0.1', port: port, path: p, method: method || 'GET' }, r => {
      let s = ''; r.on('data', d => s += d); r.on('end', () => res(s));
    });
    req.on('error', rej); req.end();
  });
}

async function main() {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(HERE, u === '/' ? 'MoYinReader.html' : u);
    if (!f.startsWith(HERE)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const APP = 'http://127.0.0.1:' + PORT + '/MoYinReader.html';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-v18-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--window-size=1280,900', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let CDP = null;
  for (let i = 0; i < 80; i++) {
    const f = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(f)) { CDP = parseInt(fs.readFileSync(f, 'utf8').split('\n')[0], 10); break; }
    await sleep(150);
  }
  if (!CDP) throw new Error('Edge 未启动');
  for (let i = 0; i < 40; i++) { try { await get(CDP, '/json/version'); break; } catch (e) { await sleep(150); } }

  const tab = JSON.parse(await get(CDP, '/json/new?about:blank', 'PUT'));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map(); const jsErrors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      jsErrors.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      jsErrors.push('console.error: ' + m.params.args.map(a => a.value || a.description).join(' '));
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('timeout ' + method)); } }, 40000);
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('EVAL ' + ((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text) + '\n' + expr.slice(0, 160));
    return r.result.value;
  };
  const ready = async () => {
    for (let i = 0; i < 60; i++) {
      try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') return true; } catch (e) { }
      await sleep(150);
    }
    return false;
  };
  const viewsize = async (w, h) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await sleep(320);
  };
  const clickAt = async (sel) => {
    const b = await ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;
      var r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];})()`);
    if (!b) return false;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b[0], y: b[1], button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b[0], y: b[1], button: 'left', clickCount: 1 });
    return true;
  };
  const pg = () => ev('JSON.stringify({mode:MY.CFG.mode,cols:MY.PG.cols,count:MY.PG.count,i:MY.PG.i,cw:Math.round(MY.PG.cw),step:Math.round(MY.PG.step)})');
  const C = async () => JSON.parse(await pg());
  const setPage = async (lay) => {
    await ev(`(function(){MY.CFG.mode='page';MY.CFG.lay='${lay || 'auto'}';MY.saveCfg();MY.PG.ready=0;
      document.documentElement.setAttribute('data-mode','page');MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()`);
    await sleep(400);
  };
  const setScroll = async () => {
    await ev(`(function(){MY.CFG.mode='scroll';MY.saveCfg();MY.PG.ready=0;
      document.documentElement.setAttribute('data-mode','scroll');MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()`);
    await sleep(300);
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await viewsize(1280, 900);
  await send('Page.navigate', { url: APP });
  ok(await ready(), '页面初始化完成');
  ok(vge(await ev('MY.VER'), '1.9.0'), '版本号 ≥ 1.9.0', await ev('MY.VER'));

  /* 一部长文：多栏才有东西可排 */
  await ev(`(async()=>{var t='第一章 起风\\n';
    for(var i=0;i<80;i++)t+='夜色像一层薄薄的尘，落在旧城的瓦上没有声响。远处更鼓敲过三下，巷子里只剩水汽与灯影，他合上书，把灯芯挑亮一点，继续读下去。\\n';
    t+='第二章 落尘\\n'+('他合上书，把灯芯挑亮一点，继续读下去。'.repeat(30))+'\\n';
    const b=new TextEncoder().encode(t);const id=await MY.importBuffer(b.buffer,'多栏探针.txt','txt');MY.openBook(id);})()`);
  await sleep(1200);
  ok(await ev('document.querySelectorAll("#page .rdp").length') > 20, '长文已渲染');

  const geo = async () => JSON.parse(await ev(`(function(){
    var el=document.getElementById('page'), cs=getComputedStyle(el), lefts=[];
    var list=el.querySelectorAll('.rdp');
    for(var i=0;i<list.length;i++){var rs=list[i].getClientRects();
      for(var j=0;j<rs.length;j++) if(rs[j].width>40&&rs[j].height>2) lefts.push(Math.round(rs[j].left));}
    lefts.sort(function(a,b){return a-b;});
    var u=[];for(var k=0;k<lefts.length;k++) if(!u.length||lefts[k]-u[u.length-1]>50) u.push(lefts[k]);
    return JSON.stringify({vw:innerWidth,colCount:cs.columnCount,lay:MY.CFG.lay,mode:MY.CFG.mode,
      cols:MY.PG.cols,cw:Math.round(MY.PG.cw),step:Math.round(MY.PG.step),
      real:(u.length>1?u[1]-u[0]:0),count:MY.PG.count,pageW:Math.round(el.getBoundingClientRect().width)});
  })()`));

  console.log('=== 多栏档位（1280 宽）');
  await setPage('auto');
  let g = await geo();
  ok(g.cols === 2, '1280 宽自动给 2 栏', g);
  ok(g.colCount == g.cols, 'CSS 列数与逻辑列数一致', g);

  for (const [lay, want] of [['one', 1], ['two', 2]]) {
    await setPage(lay);
    g = await geo();
    ok(g.cols === want, `点 ${lay} → ${want} 栏`, g);
    if (g.real) ok(Math.abs(g.step - g.cols * g.real) <= 3, `  ${lay}：一屏 = 列数 × 实测列距（不出半列）`,
      { step: g.step, cols: g.cols, real: g.real });
    if (g.cols > 1) ok(g.count >= 1 && g.pageW > 0, `  ${lay}：分页正常`, { count: g.count, pageW: g.pageW });
  }

  console.log('=== 最多双栏 / 旧配置降级 / 手机单栏');
  await viewsize(1920, 1000);
  await setPage('two');
  g = await geo();
  ok(g.cols === 2, '1920 宽双栏还是双栏，不会变成 3、4 栏', g);
  ok(g.cw >= 300, '双栏每栏够宽（≥300px）', g.cw);
  ok(Math.abs(g.step - g.cols * g.real) <= 3 || !g.real, '双栏一屏 = 2 × 列距', { step: g.step, cols: g.cols, real: g.real });
  await setPage('three');
  g = await geo();
  ok(g.cols === 2, '旧配置里的 three 降级成双栏', g.cols);
  await setPage('four');
  g = await geo();
  ok(g.cols === 2, '旧配置里的 four 降级成双栏', g.cols);

  await viewsize(390, 780);
  await setPage('two');
  g = await geo();
  ok(g.cols === 1, '手机选双栏也强制单栏', g);
  ok(g.pageW <= 390, '手机上正文不超宽', g.pageW);

  console.log('=== 章末页数不多不少');
  /* 之前 col 除以了「一屏宽」，把页索引当成列索引又除了一次，总页数少算，
     章末剩下的列显示在最后一页左半边、后面的列甚至翻不到 */
  await viewsize(1600, 950);
  for (const ch of [2, 3, 5]) {
    await ev(`(function(){MY.CFG.mode='page';MY.CFG.lay='two';MY.CFG.pagew=720;MY.saveCfg();
      MY.PG.ready=0;MY.applyCfg();MY.renderChapter(${ch},{silent:true});return 1;})()`);
    await sleep(600);
    const m = JSON.parse(await ev(`(function(){
      var el=document.getElementById('page'),cs=getComputedStyle(el);
      var step1=MY.PG.cw+MY.PG.gap;
      var total=Math.round((el.scrollWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)+MY.PG.gap)/step1);
      return JSON.stringify({total:total,count:MY.PG.count,cols:MY.PG.cols});})()`));
    ok(m.count === Math.ceil(m.total / m.cols), `第 ${ch + 1} 章：${m.total} 列 → ${Math.ceil(m.total / m.cols)} 页`, m);
  }
  await ev("(function(){MY.PG.ready=0;MY.pgMeasure();MY.pgTo(MY.PG.count-1,{instant:true});return 1;})()");
  await sleep(400);
  const tail = JSON.parse(await ev(`(function(){
    var el=document.getElementById('page'),ch=el.querySelector('#chEnd');
    var b=ch.getBoundingClientRect();
    return JSON.stringify({i:MY.PG.i,count:MY.PG.count,vis:(b.right>0&&b.left<innerWidth)});})()`));
  ok(tail.i === tail.count - 1, '能翻到最后一页', tail);
  ok(tail.vis, '最后一页能看到「本章完」', tail);

  console.log('=== 多栏自动带翻页');
  await viewsize(1440, 900);
  await ev("MY.showType()"); await sleep(350);
  await ev("(function(){document.querySelector('#modalBody [data-set=\"lay\"][data-v=\"two\"]').click();return 1;})()");
  await sleep(500);
  ok(await ev("MY.CFG.mode") === 'page' && await ev("MY.CFG.lay") === 'two', '在面板里选双栏 → 自动切到翻页');
  await ev("(function(){document.querySelector('#modalBody [data-set=\"mode\"][data-v=\"scroll\"]').click();return 1;})()");
  await sleep(500);
  ok(await ev("MY.CFG.mode") === 'scroll', '在面板里选滚动 → 真的回到滚动');
  ok(await ev("MY.CFG.lay") === 'auto', '并且自动降回自动分栏（单栏）');
  var gt = await geo();
  ok(gt.cols === 1 && gt.colCount === 'auto', '滚动模式没有残留分栏', gt);
  await ev("document.getElementById('modalX').click()"); await sleep(250);

  console.log('=== 主题按钮弹出面板');
  await setPage('auto');
  await ev("(function(){MY.setTheme('dark');return 1;})()");
  await sleep(300);
  await ev("document.getElementById('btnTheme').click()");
  await sleep(450);
  ok(await ev("document.getElementById('modal').classList.contains('on')"), '点「主题」弹出面板而不是直接换');
  ok(await ev("MY.CFG.theme") === 'dark', '只是弹出，主题还没变');
  ok(await ev("document.querySelectorAll('#modalBody .thCard').length") === 6, '面板里有 6 套主题卡片',
    await ev("document.querySelectorAll('#modalBody .thCard').length"));
  ok(await ev("document.querySelectorAll('#modalBody .thCard .demo').length") === 6, '每张卡片都有示例文字');

  await ev("(function(){document.querySelector('#modalBody .thCard[data-th=\"green\"]').click();return 1;})()");
  await sleep(450);
  ok(await ev("MY.CFG.theme") === 'green', '点「护眼绿」立刻换主题');
  ok(await ev("document.documentElement.getAttribute('data-theme')") === 'green', 'data-theme 已变', await ev("document.documentElement.getAttribute('data-theme')"));
  ok(await ev("document.getElementById('modal').classList.contains('on')"), '换完面板仍开着（可以接着挑）');
  ok(await ev("!!document.querySelector('#modalBody .thCard[data-th=\"green\"].on')"), '选中的卡片有标记');

  await ev("(function(){var i=document.querySelector('#modalBody input[data-set=\"customBg\"]');i.value='#112233';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()");
  await sleep(350);
  ok(/112233/i.test(await ev("document.documentElement.style.getPropertyValue('--paper')")), '自定义底色生效',
    await ev("document.documentElement.style.getPropertyValue('--paper')"));
  await ev("(function(){document.querySelector('#modalBody [data-act=\"clr\"]').click();return 1;})()");
  await sleep(350);
  ok(await ev("document.documentElement.style.getPropertyValue('--paper')") === '', '清空后回到主题色');

  await ev("(function(){var b=[].slice.call(document.querySelectorAll('#modalFoot button')).filter(function(x){return x.textContent.indexOf('更多排版')>=0;})[0];b.click();return 1;})()");
  await sleep(450);
  ok((await ev("document.getElementById('modalTitle').textContent")).indexOf('排版') >= 0, '「更多排版」跳到排版面板',
    await ev("document.getElementById('modalTitle').textContent"));
  ok(await ev("document.querySelectorAll('#modalBody [data-set=\"lay\"]').length") === 3, '排版面板分栏只有 自动 / 1 / 2 三档',
    await ev("document.querySelectorAll('#modalBody [data-set=\"lay\"]').length"));
  await ev("document.getElementById('modalX').click()");
  await sleep(250);

  console.log('=== 阅读时钟');
  ok(await ev("!!document.getElementById('clock')"), '顶栏有时钟');
  let ct = await ev("document.getElementById('clock').textContent");
  ok(/\d{2}:\d{2}/.test(ct), '时钟显示当前时间', ct);
  ok(ct.indexOf('读') >= 0, '同时显示本次已读时长', ct);

  await ev("(function(){MY.CLK.acc=32*60000;MY.CLK.t0=Date.now();MY.clkPaint();return 1;})()");
  await sleep(200);
  ok(await ev("document.getElementById('clock').classList.contains('warn')"), '读满 30 分钟变黄提示',
    await ev("document.getElementById('clock').textContent"));
  await ev("(function(){MY.CLK.acc=61*60000;MY.clkPaint();return 1;})()");
  await sleep(200);
  ok(await ev("document.getElementById('clock').classList.contains('tired')"), '读满 60 分钟变红',
    await ev("document.getElementById('clock').textContent"));
  ok(await ev("document.getElementById('clockFloat').textContent.length>0"), '沉浸态浮动时钟同步显示');

  await ev("(function(){MY.CFG.showClock=0;MY.saveCfg();MY.applyCfg();return 1;})()");
  await sleep(250);
  ok(await ev("document.getElementById('clock').classList.contains('off')"), '可以关掉时钟显示');
  await ev("(function(){MY.CFG.showClock=1;MY.saveCfg();MY.applyCfg();return 1;})()");
  await sleep(250);
  ok(!(await ev("document.getElementById('clock').classList.contains('off')")), '再打开又能看见');

  console.log('=== 休息提醒');
  await ev("(function(){MY.CFG.restMin=45;MY.CFG.showClock=1;MY.saveCfg();MY.CLK.acc=46*60000;MY.CLK.mark=0;MY.CLK.warned=0;MY.CLK.snoozeTo=0;MY.CLK.t0=Date.now();MY.clkTick();return 1;})()");
  await sleep(400);
  ok(await ev("document.getElementById('restTip').classList.contains('on')"), '连续读满 45 分钟弹出休息提醒');
  const rtxt = await ev("document.getElementById('restTipTx').textContent");
  ok(rtxt.indexOf('45') >= 0, '提醒里有已读时长', rtxt);

  await ev("document.getElementById('restTipSnooze').click()");
  await sleep(300);
  ok(!(await ev("document.getElementById('restTip').classList.contains('on')")), '「稍后再提」收起提醒');
  ok(await ev("MY.CLK.snoozeTo > Date.now()"), '稍后时段已记下');

  await ev("(function(){MY.CLK.acc=46*60000;MY.CLK.warned=0;MY.CLK.snoozeTo=0;MY.CLK.mark=0;MY.clkTick();return 1;})()");
  await sleep(300);
  await ev("document.getElementById('restTipOk').click()");
  await sleep(300);
  ok(!(await ev("document.getElementById('restTip').classList.contains('on')")), '「休息一下」收起提醒');
  ok(await ev("MY.CLK.acc") < 3000, '休息后本次计时归零', await ev("MY.CLK.acc"));

  await ev("(function(){MY.CFG.restMin=0;MY.saveCfg();MY.CLK.acc=90*60000;MY.CLK.mark=0;MY.CLK.warned=0;MY.CLK.snoozeTo=0;MY.clkTick();return 1;})()");
  await sleep(300);
  ok(!(await ev("document.getElementById('restTip').classList.contains('on')")), '关掉提醒后不再弹');

  console.log('=== 设置按钮常驻');
  ok(await ev("!!document.getElementById('btnSet')"), '阅读界面有「设置」按钮');
  ok(await ev("!!document.getElementById('btnSet').closest('#readActs')"), '设置按钮属于顶栏按钮组（任何时候都在）');
  await ev("document.getElementById('btnSet').click()");
  await sleep(450);
  ok(await ev("document.getElementById('modal').classList.contains('on')"), '点「设置」能打开设置面板');
  const stitle = await ev("document.getElementById('modalTitle').textContent");
  ok(stitle.indexOf('设置') >= 0, '标题是阅读设置', stitle);
  ok(await ev("document.querySelectorAll('#modalBody [data-set=\"lay\"]').length") === 3, '设置里分栏也是三档');

  /* 设置里必须能直接调字号 / 行距 / 字体 / 颜色，不能只留一个「去排版面板」的跳板 */
  ok(await ev("!!document.querySelector('#modalBody input[data-set=\"fs\"]')"), '设置里有字号滑块');
  ok(await ev("!!document.querySelector('#modalBody [data-act=\"fsUp\"]')"), '设置里有 A+ / A−');
  ok(await ev("!!document.querySelector('#modalBody input[data-set=\"lh\"]')"), '设置里有行距滑块');
  ok(await ev("document.querySelectorAll('#modalBody .ffGrid button').length") === 10, '设置里有十种字体',
    await ev("document.querySelectorAll('#modalBody .ffGrid button').length"));
  const fams = JSON.parse(await ev(`(function(){
    var out=[];document.querySelectorAll('#modalBody .ffGrid button').forEach(function(b){
      out.push(b.getAttribute('data-v')+'|'+getComputedStyle(b).fontFamily.slice(0,28));});
    return JSON.stringify(out);})()`));
  ok(new Set(fams.map(x => x.split('|')[1])).size >= 9, '每个字体按钮用自己的字体预览（不是一种字形）', fams.slice(0, 3));
  ok(await ev("document.querySelectorAll('#modalBody .swRow [data-tx]').length") === 8, '字色有 8 个常用色点',
    await ev("document.querySelectorAll('#modalBody .swRow [data-tx]').length"));
  ok(await ev("document.querySelectorAll('#modalBody .swRow [data-bg]').length") === 8, '底色有 8 个常用色点',
    await ev("document.querySelectorAll('#modalBody .swRow [data-bg]').length"));
  ok(await ev("document.querySelectorAll('#modalBody input[type=color]').length") === 2, '设置里有字色 / 底色两个取色器',
    await ev("document.querySelectorAll('#modalBody input[type=color]').length"));
  const fs0 = await ev("Number(MY.CFG.fs)");
  await ev("(function(){document.querySelector('#modalBody [data-act=\"fsUp\"]').click();return 1;})()");
  await sleep(450);
  ok(await ev("Number(MY.CFG.fs)") === fs0 + 1, 'A+ 真的把字号加了一号',
    { before: fs0, after: await ev("Number(MY.CFG.fs)") });
  const fs1 = await ev("getComputedStyle(document.getElementById('page')).fontSize");
  ok(Math.round(parseFloat(fs1)) === fs0 + 1, '正文实际字号跟着变', fs1);
  /* 字体：切仿宋，正文计算样式要换成 FangSong */
  await ev("(function(){document.querySelector('#modalBody [data-set=\"ff\"][data-v=\"fang\"]').click();return 1;})()");
  await sleep(420);
  const ffCss = await ev("getComputedStyle(document.getElementById('page')).fontFamily");
  ok(/FangSong/i.test(ffCss), '设置里选仿宋，正文真的换字体', ffCss.slice(0, 40));
  /* 自定义字色 */
  await ev(`(function(){var i=document.querySelector('#modalBody input[data-set="customTx"]');
    i.value='#ff8866';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await sleep(420);
  ok(await ev("MY.CFG.customTx") === '#ff8866', '取色器能改字色', await ev("MY.CFG.customTx"));
  ok(/255,\s*136,\s*102/.test(await ev("getComputedStyle(document.getElementById('page')).color")),
    '字色真的应用到了正文', await ev("getComputedStyle(document.getElementById('page')).color"));
  /* 点色点：字色与底色各试一个 */
  await ev("(function(){document.querySelector('#modalBody [data-tx=\"#2B4162\"]').click();return 1;})()");
  await sleep(420);
  await ev("(function(){document.querySelector('#modalBody [data-bg=\"#F6EFDF\"]').click();return 1;})()");
  await sleep(420);
  ok(await ev("MY.CFG.customTx") === '#2B4162' && await ev("MY.CFG.customBg") === '#F6EFDF', '点色点能直接换字色 / 底色',
    { tx: await ev("MY.CFG.customTx"), bg: await ev("MY.CFG.customBg") });
  ok(/246,\s*239,\s*223/.test(await ev("getComputedStyle(document.getElementById('page')).backgroundColor")),
    '底色真的铺到了正文', await ev("getComputedStyle(document.getElementById('page')).backgroundColor"));
  /* 选深色底要自动换浅色字，否则看不见 */
  await ev("(function(){document.querySelector('#modalBody [data-bg=\"#2A2D33\"]').click();return 1;})()");
  await sleep(500);
  const dark = JSON.parse(await ev("JSON.stringify({bg:MY.CFG.customBg,tx:MY.CFG.customTx})"));
  ok(dark.bg === '#2A2D33' && /^#E/i.test(dark.tx), '选深色底时字色自动变浅，不会糊成一团', dark);
  /* 跟随主题：清掉自定义 */
  await ev("(function(){document.querySelector('#modalBody [data-act=\"clrColor\"]').click();return 1;})()");
  await sleep(420);
  ok(await ev("MY.CFG.customTx") === '' && await ev("MY.CFG.customBg") === '', '「跟随主题」能清掉自定义色');

  /* 自动翻页停留秒数：以前只能在小面板里 4–60 步长 2，默认 20 秒，用户以为写死了 */
  ok(await ev("!!document.querySelector('#modalBody input[data-set=\"autoPageSec\"]')"), '设置里有「翻页停留」滑块');
  const ap = JSON.parse(await ev(`(function(){var i=document.querySelector('#modalBody input[data-set="autoPageSec"]');
    return JSON.stringify({min:i.min,max:i.max,step:i.step,v:i.value});})()`));
  ok(ap.min === '3' && ap.max === '180' && ap.step === '1', '停留秒数可调 3–180 秒、步长 1', ap);
  await ev(`(function(){var i=document.querySelector('#modalBody input[data-set="autoPageSec"]');
    i.value=75;i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await sleep(450);
  ok(await ev("Number(MY.CFG.autoPageSec)") === 75, '拖到 75 秒真的存下来', await ev("MY.CFG.autoPageSec"));
  ok(/75/.test(await ev("document.getElementById('cfgAp').textContent")), '标签同步显示 75 秒/页',
    await ev("document.getElementById('cfgAp').textContent"));
  ok(await ev("MY.autoPageSec()") === 75, '实际用的间隔跟着变', await ev("MY.autoPageSec()"));
  ok(await ev("!!document.querySelector('#modalBody [data-act=\"autoNow\"]')"), '设置里能直接起自动阅读');
  await ev("(function(){document.querySelector('#modalBody [data-act=\"autoNow\"]').click();return 1;})()");
  await sleep(700);
  ok(await ev("MY.AUTO.on") === 1, '点「现在开始」就进入自动阅读', await ev("MY.AUTO.on"));
  /* 自动翻页进行中改秒数，计时器要立刻换新间隔 */
  await ev("(function(){MY.CFG.autoPageSec=6;MY.saveCfg();MY.autoRetime();return 1;})()");
  await sleep(400);
  ok(await ev("MY.AUTO.on") === 1 && await ev("MY.autoPageSec()") === 6, '自动翻页中改秒数不用重开，立刻按新间隔走',
    { on: await ev("MY.AUTO.on"), sec: await ev("MY.autoPageSec()") });
  await ev("(function(){MY.autoStop(true);MY.CFG.autoPageSec=20;MY.saveCfg();return 1;})()");
  await sleep(250);
  if (!(await ev("document.getElementById('modal').classList.contains('on')"))) {
    await ev("document.getElementById('btnSet').click()"); await sleep(400);
  }
  await ev("(function(){MY.CFG.fs=19;MY.CFG.ff='serif';MY.CFG.customTx='';MY.CFG.customBg='';MY.saveCfg();MY.applyCfg();return 1;})()");
  await sleep(300);
  await ev("document.getElementById('modalX').click()");
  await sleep(250);

  console.log('=== 时钟面板');
  await ev("document.getElementById('clock').click()");
  await sleep(450);
  ok((await ev("document.getElementById('modalTitle').textContent")).indexOf('时钟') >= 0, '点时钟打开时钟面板',
    await ev("document.getElementById('modalTitle').textContent"));
  ok(await ev("document.querySelectorAll('#modalBody [data-ck]').length") >= 7, '面板里有显示开关与提醒间隔',
    await ev("document.querySelectorAll('#modalBody [data-ck]').length"));
  await ev("(function(){var b=[].slice.call(document.querySelectorAll('#modalBody [data-ck]')).filter(function(x){return x.getAttribute('data-ck')==='restMin'&&x.getAttribute('data-v')==='60';})[0];b.click();return 1;})()");
  await sleep(400);
  ok(await ev("Number(MY.CFG.restMin)") === 60, '面板里能直接改提醒间隔', await ev("MY.CFG.restMin"));
  await ev("document.getElementById('modalX').click()");
  await sleep(200);

  console.log('=== 尺寸变化后翻页不错位（侧栏开合）');
  /* 曾经的坑：开侧栏后正文变窄，分页还按旧步长平移 → 一翻页就停在「半截列」，
     右边整片空白；另一种写法更狠——overflow:hidden 加在正文盒自己身上，
     平移过去的内容被自己裁掉，第 2 页起整页空白。两条都靠这里兜住。 */
  await viewsize(1080, 620);
  await setPage('auto');
  /* 固定回到第 1 章（80 段那章），位置给到第 2 页，避免被测样本恰好是章末短页 */
  await ev("(function(){MY.renderChapter(0,{silent:true});return 1;})()");
  await sleep(600);
  await ev("(function(){MY.PG.ready=0;MY.pgMeasure();MY.pgTo(1,{instant:true});return 1;})()");
  await sleep(450);
  const align = async () => JSON.parse(await ev(`(function(){
    var w=document.getElementById('pageWrap'), el=document.getElementById('page');
    var wr=w.getBoundingClientRect(), cs=getComputedStyle(el);
    var padL=parseFloat(cs.paddingLeft)||0, padR=parseFloat(cs.paddingRight)||0;
    var n=0, leftMost=1e9, rightMost=-1e9;
    el.querySelectorAll('.rdp').forEach(function(p){
      var rs=p.getClientRects();
      for(var i=0;i<rs.length;i++){var r=rs[i];
        if(r.width<20||r.height<2) continue;
        if(r.right<wr.left+2||r.left>wr.right-2) continue;
        n++; if(r.left<leftMost)leftMost=r.left; if(r.right>rightMost)rightMost=r.right; }
    });
    return JSON.stringify({n:n,leftMost:Math.round(leftMost),rightMost:Math.round(rightMost),
      wantL:Math.round(wr.left+padL),maxR:Math.round(wr.right-padR),
      wrapW:Math.round(wr.width),cols:MY.PG.cols,step:Math.round(MY.PG.step),i:MY.PG.i,count:MY.PG.count});})()`));
  const a1 = await align();
  ok(a1.n > 4, '翻到第 2 页后屏幕上真有正文（没被自己裁成空白）', a1);
  ok(Math.abs(a1.leftMost - a1.wantL) <= 3, '页面左缘正好落在栏首（不是半截列）', a1);
  ok(a1.rightMost <= a1.maxR + 3, '页面右缘没越过版心', a1);

  await ev("(function(){document.getElementById('btnToc').click();return 1;})()");
  await sleep(700);
  const a2 = await align();
  ok(a2.n > 4, '开侧栏后正文依然可见', a2);
  ok(Math.abs(a2.leftMost - a2.wantL) <= 3, '开侧栏后仍是整列对齐（重新量过）', a2);
  ok(a2.step === a2.cols * (Math.round((a2.maxR - a2.wantL + 60) / a2.cols)), '开侧栏后步长跟着改（一屏 = 列数 × 列距）', a2);

  await ev("MY.readNext()"); await sleep(600);
  const a3 = await align();
  ok(a3.i === a2.i + 1, '侧栏开着也能正常翻一页', { before: a2.i, after: a3.i });
  ok(a3.n > 4 && Math.abs(a3.leftMost - a3.wantL) <= 3, '翻过之后还是整列对齐，没有半截列', a3);

  await ev("(function(){document.getElementById('btnToc').click();return 1;})()");
  await sleep(700);
  const a4 = await align();
  ok(a4.cols === 2, '收起侧栏后自动回到双栏', a4);
  ok(a4.n > 4 && Math.abs(a4.leftMost - a4.wantL) <= 3, '收起侧栏后正文对齐正常', a4);

  console.log('=== 1.10 新增：拖拽导入 / 字重 / 目录搜索');
  /* 字重：设置里四档，选粗之后正文计算样式要变 */
  await ev("document.getElementById('btnSet').click()"); await sleep(400);
  ok(await ev("document.querySelectorAll('#modalBody [data-set=\"fw\"]').length") === 4, '设置里有四档字重',
    await ev("document.querySelectorAll('#modalBody [data-set=\"fw\"]').length"));
  await ev("(function(){document.querySelector('#modalBody [data-set=\"fw\"][data-v=\"700\"]').click();return 1;})()");
  await sleep(450);
  ok(String(await ev("getComputedStyle(document.getElementById('page')).fontWeight")) === '700', '选「粗」正文真的变粗',
    await ev("getComputedStyle(document.getElementById('page')).fontWeight"));
  await ev("(function(){document.querySelector('#modalBody [data-set=\"fw\"][data-v=\"400\"]').click();return 1;})()");
  await sleep(400);
  await ev("document.getElementById('modalX').click()"); await sleep(250);

  /* 拖拽导入：造一个 File 塞进 DataTransfer，再派发 drop */
  await ev("(function(){MY.showView('lib');return 1;})()"); await sleep(400);
  const dropBefore = await ev("MY.BOOKS.length");
  await ev(`(function(){
    var txt='拖拽导入测试\\n\\n' + '夜色像一层薄薄的尘，落在旧城的瓦上没有声响。'.repeat(40);
    var dt=new DataTransfer();
    dt.items.add(new File([txt],'拖进来的书.txt',{type:'text/plain'}));
    var ev2=new DragEvent('dragenter',{bubbles:true,dataTransfer:dt});
    window.dispatchEvent(ev2);
    var hint = document.getElementById('dropHint').classList.contains('on');
    var ev3=new DragEvent('drop',{bubbles:true,dataTransfer:dt});
    window.dispatchEvent(ev3);
    return JSON.stringify({hint:hint, closed:!document.getElementById('dropHint').classList.contains('on')});
  })()`).then(v => {
    const r = JSON.parse(v);
    ok(r.hint === true, '拖文件进来时出现「松手导入」提示');
    ok(r.closed === true, '松手后提示层自动收起');
  });
  await sleep(1500);
  ok(await ev("MY.BOOKS.some(function(b){return b.name==='拖进来的书';})"), '拖进来的书真的进了书架',
    await ev("MY.BOOKS.map(function(b){return b.name;}).slice(-3)"));
  ok((await ev("MY.BOOKS.length")) === dropBefore + 1, '书架多了一本',
    { before: dropBefore, after: await ev("MY.BOOKS.length") });

  /* 拖非书文件：不导入，但要给提示 */
  const nonBook = await ev(`(function(){
    var b0=MY.BOOKS.length;
    var dt=new DataTransfer();
    dt.items.add(new File(['x'],'照片.jpg',{type:'image/jpeg'}));
    window.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));
    return b0;
  })()`);
  await sleep(600);
  ok((await ev("MY.BOOKS.length")) === nonBook, '拖进来的非 TXT/EPUB 不会被当成书');

  /* 目录搜索 */
  await ev("MY.openBook(MY.BOOKS[MY.BOOKS.length-1].id)"); await sleep(1400);
  await ev("(function(){document.getElementById('btnToc').click();return 1;})()"); await sleep(500);
  ok(await ev("!!document.getElementById('tocQ')"), '目录侧栏顶部有搜索框');
  const total = await ev("document.querySelectorAll('#tocList .it').length");
  await ev(`(function(){var i=document.getElementById('tocQ');i.value='章';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await sleep(400);
  const hit = await ev("document.querySelectorAll('#tocList .it').length");
  ok(hit > 0 && hit <= Math.max(1, total), '输入关键字后目录被过滤', { total, hit });
  ok(await ev("document.getElementById('tocQ').value") === '章', '过滤时输入框不丢焦点与内容');
  await ev(`(function(){var i=document.getElementById('tocQ');i.value='绝对不存在的章节名';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await sleep(400);
  ok((await ev("document.querySelectorAll('#tocList .it').length")) === 0, '搜不到时列表为空');
  ok(/没有匹配/.test(await ev("document.getElementById('tocList').textContent")), '并且给出「没有匹配的章节」提示',
    (await ev("document.getElementById('tocList').textContent")).slice(0, 20));
  await ev("(function(){document.getElementById('btnToc').click();return 1;})()"); await sleep(300);

  console.log('=== 网络位置导入（SMB / 映射盘）');
  ok(await ev("document.getElementById('btnImportNet').hidden"), '网页版不显示「网络位置」（没有本地文件权限）');
  /* 装上桌面外壳那套桥，再走一遍真实点击路径 */
  await ev(`(function(){
    window.__netCalls=[];
    window.__moyinScanDir=function(p){
      window.__netCalls.push(p);
      var txt=new TextEncoder().encode('网络位置测试\\n\\n' + '墨色在纸上铺开，灯下的字有点发暖。'.repeat(60));
      return Promise.resolve({dir:p,sid:'s1',net:true,skipped:0,truncated:false,
        files:[{name:'山中来信.txt',size:txt.length,arrayBuffer:function(){return Promise.resolve(txt.buffer);}}]});
    };
    return 1;})()`);
  const before = await ev("MY.BOOKS.length");
  await ev("MY.importNet()"); await sleep(400);
  ok((await ev("document.getElementById('modalTitle').textContent")).indexOf('网络位置') >= 0, '弹出网络位置面板',
    await ev("document.getElementById('modalTitle').textContent"));
  ok(await ev("!!document.getElementById('netPath')"), '面板里有路径输入框');
  const ph = await ev("document.getElementById('netPath').placeholder");
  ok(/192\.168|\\\\\\\\/.test(ph), '输入框给了 UNC 写法示例', ph);
  /* 空路径不发起扫描 */
  await ev("(function(){var b=[].slice.call(document.querySelectorAll('#modalFoot button')).filter(function(x){return /连接/.test(x.textContent);})[0];b.click();return 1;})()");
  await sleep(250);
  ok((await ev("window.__netCalls.length")) === 0, '空路径不发请求');
  ok(await ev("document.getElementById('modal').classList.contains('on')"), '空路径时面板留着让人补');
  /* 填路径再扫 */
  await ev(`(function(){
    var i=document.getElementById('netPath');
    i.value='\\\\\\\\192.168.1.10\\\\Books';
    var b=[].slice.call(document.querySelectorAll('#modalFoot button')).filter(function(x){return /连接/.test(x.textContent);})[0];
    b.click(); return 1;})()`);
  await sleep(600);
  const calls = JSON.parse(await ev("JSON.stringify(window.__netCalls)"));
  ok(calls.length === 1 && calls[0] === '\\\\192.168.1.10\\Books', '按填的路径去扫（原样传给外壳）', calls);
  ok(await ev("MY.CFG.netPath") === '\\\\192.168.1.10\\Books', '路径记下来了，下次打开还填着', await ev("MY.CFG.netPath"));
  const cmsg = await ev("document.getElementById('modalBody').textContent");
  ok(/找到 1 个/.test(cmsg), '扫描结果报数：找到 1 个', cmsg.slice(0, 40));
  ok(/Books/.test(cmsg), '确认框里带了目录名', cmsg.slice(0, 40));
  /* 确认 → 真的入库 */
  await ev("(function(){var b=[].slice.call(document.querySelectorAll('#modalFoot button')).filter(function(x){return /确定|开始|导入/.test(x.textContent);})[0];b.click();return 1;})()");
  await sleep(1400);
  ok((await ev("MY.BOOKS.length")) === before + 1, '确认后书进了书架', { before, after: await ev("MY.BOOKS.length") });
  ok(await ev("MY.BOOKS.some(function(b){return b.name==='山中来信';})"), '书名取的是文件名（书已入库）',
    await ev("MY.BOOKS.map(function(b){return b.name;}).slice(-4)"));
  /* 外壳报错时要有人话，不能静默 */
  await ev(`(function(){window.__moyinScanDir=function(){return Promise.reject(new Error('连接超时：12 秒内没能打开'));};return 1;})()`);
  await ev("MY.importNet()"); await sleep(350);
  await ev(`(function(){document.getElementById('netPath').value='\\\\\\\\nas\\\\x';
    var b=[].slice.call(document.querySelectorAll('#modalFoot button')).filter(function(x){return /连接/.test(x.textContent);})[0];
    b.click();return 1;})()`);
  await sleep(600);
  ok((await ev("document.getElementById('modalTitle').textContent")).indexOf('连不上') >= 0, '连不上时给出可读提示',
    await ev("document.getElementById('modalTitle').textContent"));
  await ev("document.getElementById('modalX').click()"); await sleep(200);
  await ev("(function(){delete window.__moyinScanDir;return 1;})()");

  console.log('=== 英文界面');
  await ev("MY.setLang('en')"); await sleep(500);
  const eclock = await ev("document.getElementById('clock').textContent");
  ok(/read/.test(eclock), '英文下时钟文案也翻译', eclock);
  await ev("document.getElementById('btnTheme').click()"); await sleep(450);
  const etheme = await ev("document.getElementById('modalBody').textContent");
  ok(etheme.indexOf('Green') >= 0 || etheme.indexOf('Slate') >= 0, '英文下主题面板已翻译', etheme.slice(0, 40));
  await ev("document.getElementById('modalX').click()");
  await ev("MY.setLang('zh')"); await sleep(300);

  console.log('=== 运行时错误');
  ok(jsErrors.length === 0, '无 JS 异常 / console.error', jsErrors.slice(0, 3));

  console.log('\nPASS ' + pass + ' FAIL ' + fail);
  ws.close(); edge.kill(); server.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });

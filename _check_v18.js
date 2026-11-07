/* v1.8.0 回归：排版（滚动/翻页/分栏）、字体字号行距段距、主题与自定义色、
   自动阅读（滚动 / 翻页）、全屏与沉浸、快捷键 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let pass = 0, fail = 0;
const ok = (c, label, extra) => { if (c) { pass++; console.log('  ok   ' + label); } else { fail++; console.log('  FAIL ' + label + '  ' + (extra === undefined ? '' : JSON.stringify(extra))); } };
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
  ok((await ev('MY.VER')) >= '1.8.1', '版本号 ≥ 1.8.1', await ev('MY.VER'));

  console.log('=== 默认是滚动模式');
  ok(await ev("document.documentElement.getAttribute('data-mode')") === 'scroll', '默认滚动模式');
  ok(await ev("document.getElementById('page').style.columnCount") === '', '滚动模式没有残留分栏');

  await ev(`(async()=>{var t='第一章 起风\\n';
    for(var i=0;i<60;i++)t+='夜色像一层薄薄的尘，落在旧城的瓦上没有声响。远处更鼓敲过三下，巷子里只剩水汽与灯影。\\n';
    t+='第二章 落尘\\n'+('他合上书，把灯芯挑亮一点，继续读下去。'.repeat(40))+'\\n';
    const b=new TextEncoder().encode(t);const id=await MY.importBuffer(b.buffer,'版式探针.txt','txt');MY.openBook(id);})()`);
  await sleep(1000);
  ok(await ev('document.querySelectorAll("#page p.rdp").length') > 20, '测试用书已打开');

  console.log('=== 排版面板');
  await ev("document.getElementById('btnType').click()"); await sleep(200);
  const panel = await ev(`(function(){var b=document.getElementById('modalBody');
    var keys=['mode','lay','pageAnim','fs','lh','ps','ls','indent','padw','pagew','ff','align','dim','autoScrollSpeed','autoPageSec'];
    var have={};keys.forEach(function(k){have[k]=!!b.querySelector('[data-set="'+k+'"]');});
    return {have:have,fsBtn:!!b.querySelector('[data-font="fs+"]'),sw:b.querySelectorAll('[data-th]').length,
      title:document.getElementById('modalTitle').textContent};})()`);
  ok(panel.title === '排版与外观', '标题是「排版与外观」', panel.title);
  ok(Object.values(panel.have).every(Boolean), '面板含全部排版控件', panel.have);
  ok(panel.fsBtn, '保留 A+ / A− 快捷键按钮');
  ok(panel.sw === 6, '六套主题色块', panel.sw);
  await ev("document.getElementById('modalX').click()");

  console.log('=== 翻页 + 双栏');
  await ev("document.getElementById('btnType').click()"); await sleep(150);
  await ev("document.querySelector('#modalBody [data-set=\"mode\"][data-v=\"page\"]').click()"); await sleep(400);
  ok(await ev("document.documentElement.getAttribute('data-mode')") === 'page', '点「翻页」切到翻页模式');
  let m = await C();
  ok(m.cols === 2, '1280 宽自动双栏', m);
  ok(m.count >= 3, '一章分成多页', m.count);
  ok(m.step > m.cw, '翻页步长 = 两列 + 栏距', m);
  ok((await ev("document.getElementById('progTx').textContent")).indexOf('页') > 0, '进度显示页码', await ev("document.getElementById('progTx').textContent"));
  await ev("document.getElementById('modalX').click()");

  const t0 = await ev("document.getElementById('page').style.transform");
  await ev('MY.readNext()'); await sleep(350);
  let m2 = await C();
  ok(m2.i === 1, '下一页 i+1', m2);
  const t1 = await ev("document.getElementById('page').style.transform");
  ok(t0 !== t1 && /translateX\(-\d+px\)/.test(t1), '整页横向平移', t1);
  await ev('MY.readPrev()'); await sleep(300);
  ok((await C()).i === 0, '上一页回到 i=0');

  console.log('=== 翻页交互：点击 / 滚轮 / 键盘');
  const box = await ev(`(function(){var r=document.getElementById('pageWrap').getBoundingClientRect();
    return [r.left,r.top,r.width,r.height];})()`);
  const rx = box[0] + box[2] - 40, ry = box[1] + box[3] / 2;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
  await sleep(320);
  ok((await C()).i === 1, '点右侧翻到下一页');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box[0] + 30, y: ry, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box[0] + 30, y: ry, button: 'left', clickCount: 1 });
  await sleep(320);
  ok((await C()).i === 0, '点左侧翻回上一页');
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: rx - 80, y: ry, deltaX: 0, deltaY: 240 });
  await sleep(350);
  ok((await C()).i === 1, '滚轮向下翻页');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))");
  await sleep(300);
  ok((await C()).i === 0, '← 键翻回上一页');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
  await sleep(300);
  ok((await C()).i === 1, '→ 键翻下一页');

  console.log('=== 章末跨章');
  await ev('(function(){var n=MY.PG.count;MY.pgTo(n-1,{instant:true});return n;})()');
  await sleep(200);
  const lastI = (await C()).i;
  await ev('MY.readNext()'); await sleep(500);
  const afterCh = await ev('JSON.stringify({ch:MY.BK.ch,i:MY.PG.i,count:MY.PG.count})').then(JSON.parse);
  ok(afterCh.ch === 1 && afterCh.i === 0, '最后一页再翻 → 下一章第一页', afterCh);
  await ev('MY.readPrev()'); await sleep(500);
  const backCh = await ev('JSON.stringify({ch:MY.BK.ch,i:MY.PG.i,count:MY.PG.count,last:' + (lastI) + '})').then(JSON.parse);
  ok(backCh.ch === 0 && backCh.i === backCh.count - 1, '第一页再回翻 → 上一章最后一页', backCh);

  console.log('=== 改字号后重新分页');
  await ev('(function(){MY.pgTo(0,{instant:true});MY.CFG.fs=30;MY.saveCfg();document.documentElement.style.setProperty("--fs","30px");MY.pgReflow();return 1;})()');
  await sleep(400);
  const bigger = await C();
  ok(bigger.count > m.count, '字号变大页数变多', { before: m.count, after: bigger.count });
  ok(await ev('MY.BK.ch') === 0, '重新分页不跳章');
  await ev('(function(){MY.CFG.fs=19;MY.saveCfg();document.documentElement.style.setProperty("--fs","19px");MY.pgReflow();return 1;})()');
  await sleep(300);

  console.log('=== 单栏 / 窄屏');
  await setPage('one');
  ok((await C()).cols === 1, '单栏模式只一列');
  await setPage('two');
  ok((await C()).cols === 2, '双栏模式两列');
  await viewsize(390, 780);
  await setPage('two');
  const phone = await C();
  ok(phone.cols === 1, '手机上强制单列（即使选了双栏）', phone);
  ok((await ev('document.documentElement.scrollWidth')) <= 392, '窄屏无横向溢出', await ev('document.documentElement.scrollWidth'));
  await viewsize(1280, 900);
  await setPage('auto');

  console.log('=== 切回滚动');
  await setScroll();
  const sc = await ev(`JSON.stringify({tf:document.getElementById('page').style.transform,
    cc:document.getElementById('page').style.columnCount,
    sh:document.getElementById('pageWrap').scrollHeight,ch:document.getElementById('pageWrap').clientHeight})`).then(JSON.parse);
  ok(sc.tf === '' && sc.cc === '', '滚动模式清掉平移与分栏', sc);
  ok(sc.sh > sc.ch, '正文可纵向滚动');
  await ev("(function(){var w=document.getElementById('pageWrap');w.scrollTop=w.scrollHeight*0.5;w.dispatchEvent(new Event('scroll'));return 1;})()");
  await sleep(800);
  ok(await ev('MY.BK.ratio') > 0.2, '滚动进度仍按位置计算', await ev('MY.BK.ratio'));

  console.log('=== 双栏联动（滚动下点双栏要自动进翻页，真排成两列）');
  await setScroll();
  await ev("(function(){MY.CFG.lay='auto';MY.saveCfg();MY.applyCfg();return 1;})()");
  await sleep(400);
  ok(await ev("document.documentElement.getAttribute('data-mode')") === 'scroll', '起点是滚动模式');
  const anchorTx = await ev(`(function(){var p=MY.scrollTopPara();return p?p.textContent.slice(0,24):'';})()`);
  await ev("(function(){MY.showType();return 1;})()"); await sleep(320);
  await ev(`(function(){var b=document.querySelector('[data-set="lay"][data-v="two"]');b.click();return 1;})()`);
  await sleep(900);
  const link = await ev(`JSON.stringify({mode:MY.CFG.mode,lay:MY.CFG.lay,
    dm:document.documentElement.getAttribute('data-mode'),
    cc:getComputedStyle(document.getElementById('page')).columnCount,
    cols:MY.PG.cols,cw:Math.round(MY.PG.cw),
    gap:getComputedStyle(document.getElementById('page')).columnGap})`).then(JSON.parse);
  ok(link.mode === 'page' && link.dm === 'page', '点双栏自动切到翻页模式', link);
  ok(link.cc === '2' && link.cols === 2, '双栏真的排成两列', link);
  ok(parseFloat(link.gap) >= 20, '两列之间有栏间距', link.gap);
  // 位置别跳：切过去后原来那段应该还在屏上
  const still = await ev(`(function(){var t=${JSON.stringify(anchorTx)};if(!t)return 'no-anchor';
    var ps=[].slice.call(document.getElementById('page').querySelectorAll('.rdp'));
    for(var i=0;i<ps.length;i++){var r=ps[i].getBoundingClientRect();
      if(ps[i].textContent.indexOf(t)===0) return (r.left>=-40&&r.left<window.innerWidth+40)?'onscreen':'offscreen';}
    return 'lost';})()`);
  ok(still === 'onscreen' || still === 'no-anchor', '切到翻页后仍停在原来那段', still);

  // 切回滚动 → 自动回单栏，不留分栏残留
  await ev(`(function(){var b=document.querySelector('[data-set="mode"][data-v="scroll"]');b.click();return 1;})()`);
  await sleep(800);
  const back = await ev(`JSON.stringify({mode:MY.CFG.mode,lay:MY.CFG.lay,
    dm:document.documentElement.getAttribute('data-mode'),
    cc:getComputedStyle(document.getElementById('page')).columnCount,
    tf:document.getElementById('page').style.transform})`).then(JSON.parse);
  ok(back.mode === 'scroll' && back.lay !== 'two', '切回滚动自动回到单栏', back);
  ok(back.cc === 'auto' && back.tf === '', '滚动模式没有分栏/平移残留', back);
  await ev("(function(){var m=document.querySelector('#modal');if(m){m.classList.remove('on','show');}return 1;})()");
  await sleep(200);

  console.log('=== TXT 也能双栏 / 单栏');
  const longTxt = Array.from({ length: 12 }, (_, c) =>
    '第' + (c + 1) + '章 长文\n\n' + Array.from({ length: 30 }, (_, i) =>
      '这是第' + (c + 1) + '章第' + (i + 1) + '段。墨色在纸上慢慢晕开，像一场没有雷声的雨。他坐在窗前，把每一句都读得很慢。').join('\n\n')
  ).join('\n\n');
  await ev(`(async function(){var b=new TextEncoder().encode(${JSON.stringify(longTxt)});
    var id=await MY.importBuffer(b.buffer,'双栏TXT.txt','txt');MY.openBook(id);return 1;})()`);
  await sleep(1400);
  await ev("(function(){MY.CFG.lay='two';MY.saveCfg();MY.applyCfg();MY.renderChapter(1,{silent:true});return 1;})()");
  await sleep(900);
  const txtTwo = await ev(`JSON.stringify({isTxt:(document.getElementById('page').textContent||'').indexOf('墨色在纸上')>=0,
    sample:(document.getElementById('page').textContent||'').slice(0,10),cols:MY.PG.cols,count:MY.PG.count,
    cc:getComputedStyle(document.getElementById('page')).columnCount,cw:Math.round(MY.PG.cw)})`).then(JSON.parse);
  ok(txtTwo.isTxt, '当前书是长文 TXT', txtTwo.sample);
  ok(txtTwo.cols === 2 && txtTwo.cc === '2' && txtTwo.count > 1, 'TXT 双栏生效且分页正常', txtTwo);
  await ev("(function(){MY.CFG.lay='one';MY.saveCfg();MY.applyCfg();MY.renderChapter(1,{silent:true});return 1;})()");
  await sleep(800);
  const txtOne = await ev(`JSON.stringify({cols:MY.PG.cols,cc:getComputedStyle(document.getElementById('page')).columnCount})`).then(JSON.parse);
  ok(txtOne.cols === 1 && txtOne.cc === '1', 'TXT 单栏也正常', txtOne);
  /* 收尾回到单栏滚动，别把状态漏给后面的用例 */
  await ev("(function(){MY.CFG.lay='auto';MY.CFG.mode='scroll';MY.saveCfg();MY.applyCfg();return 1;})()");
  await sleep(500);

  console.log('=== 主题与自定义颜色');
  /* 1.9 起主题按钮改为弹出面板选择，不再按一下换一档 */
  await ev("document.getElementById('btnTheme').click()"); await sleep(250);
  ok(await ev("document.getElementById('modal').classList.contains('on')"), '主题按钮弹出选择面板');
  ok(await ev("document.querySelectorAll('#modalBody .thCard').length") === 6, '六套主题都在面板里',
    await ev("document.querySelectorAll('#modalBody .thCard').length"));
  const all = [];
  for (const k of ['light', 'sepia', 'green', 'gray', 'black', 'dark']) {
    await ev(`(function(){document.querySelector('#modalBody .thCard[data-th="${k}"]').click();return 1;})()`);
    await sleep(130);
    all.push(await ev("document.documentElement.getAttribute('data-theme')"));
  }
  ok(all.join() === 'light,sepia,green,gray,black,dark', '六套主题都能点选', all);
  await ev("document.getElementById('modalX').click()"); await sleep(200);
  await ev("MY.setTheme('green')"); await sleep(120);
  ok((await ev("getComputedStyle(document.documentElement).getPropertyValue('--paper')")).trim().toLowerCase() === '#f3f8ec', '护眼绿主题生效');
  await ev("MY.setTheme('dark')"); await sleep(120);

  await ev("(function(){MY.CFG.customBg='#123456';MY.CFG.customTx='#ffee00';MY.saveCfg();MY.loadCfg?0:0;MY.showType();document.getElementById('modalX').click();return 1;})()");
  await ev("(function(){MY.CFG.customBg='#123456';MY.CFG.customTx='#ffee00';MY.saveCfg();MY.showType&&0;MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()");
  await sleep(300);
  const cust = await ev(`JSON.stringify({bg:getComputedStyle(document.getElementById('page')).backgroundColor,
    fg:getComputedStyle(document.getElementById('page')).color})`).then(JSON.parse);
  ok(cust.bg === 'rgb(18, 52, 86)', '自定义底色应用到正文', cust.bg);
  ok(cust.fg === 'rgb(255, 238, 0)', '自定义字色应用到正文', cust.fg);
  await ev("(function(){MY.CFG.customBg='';MY.CFG.customTx='';MY.saveCfg();MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()");
  await sleep(250);
  ok((await ev("getComputedStyle(document.getElementById('page')).backgroundColor")) !== 'rgb(18, 52, 86)', '清空自定义后跟随主题');

  console.log('=== 亮度 / 段距 / 缩进 / 字距 / 字体 / 页边距');
  await ev("(function(){MY.CFG.dim=0.3;MY.saveCfg();MY.showType();document.getElementById('modalX').click();MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()");
  await sleep(250);
  ok(Number(await ev("getComputedStyle(document.getElementById('dim')).opacity")) === 0.3, '亮度暗化生效', await ev("getComputedStyle(document.getElementById('dim')).opacity"));
  await ev("(function(){MY.CFG.dim=0;MY.saveCfg();MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()"); await sleep(200);

  const typo = await ev(`(function(){MY.CFG.ps=1.6;MY.CFG.indent=2;MY.CFG.ls=0.1;MY.CFG.ff='fang';MY.CFG.padw=60;
    MY.saveCfg();MY.renderChapter(MY.BK.ch,{silent:true});
    var p=document.querySelector('#page p.rdp'),cs=getComputedStyle(p),pg=getComputedStyle(document.getElementById('page'));
    return JSON.stringify({mb:cs.marginBottom,ti:cs.textIndent,ls:pg.letterSpacing,ff:cs.fontFamily,pad:pg.paddingLeft});})()`).then(JSON.parse);
  ok(parseFloat(typo.mb) > 20, '段间距可调（1.6em）', typo.mb);
  ok(typo.ti === '38px' || parseFloat(typo.ti) > 30, '首行缩进 2 字', typo.ti);
  ok(parseFloat(typo.ls) > 1, '字间距可调', typo.ls);
  ok(/FangSong/i.test(typo.ff), '仿宋字体生效', typo.ff);
  ok(typo.pad === '60px', '页边距可调', typo.pad);
  await ev("(function(){MY.CFG.ps=0.85;MY.CFG.indent=0;MY.CFG.ls=0.02;MY.CFG.ff='serif';MY.CFG.padw=32;MY.saveCfg();MY.renderChapter(MY.BK.ch,{silent:true});return 1;})()");
  await sleep(250);

  console.log('=== 自动阅读（滚动）');
  await ev('(function(){MY.CFG.mode="scroll";MY.CFG.lay="auto";MY.saveCfg();MY.applyCfg();var w=document.getElementById("pageWrap");w.scrollTop=0;MY.CFG.autoScrollSpeed=6;MY.saveCfg();MY.autoStart();return 1;})()');
  await sleep(900);
  const a1 = await ev("document.getElementById('pageWrap').scrollTop");
  ok(a1 > 4, '自动滚动确实在走', a1);
  ok(await ev('MY.AUTO.on') === 1 && await ev('MY.AUTO.paused') === 0, '自动阅读处于运行态');
  ok(await ev("document.getElementById('btnAuto').classList.contains('on')") === true, '顶栏按钮显示开启状态');
  await ev('MY.autoPause()'); await sleep(150);
  ok(await ev('MY.AUTO.paused') === 1, '用户操作可暂停');
  ok(await ev("document.getElementById('autoPill').classList.contains('on')") === true, '暂停后出现「继续 / 退出」提示条');
  const p1 = await ev("document.getElementById('pageWrap').scrollTop");
  await sleep(500);
  ok((await ev("document.getElementById('pageWrap').scrollTop")) === p1, '暂停后不再滚动');
  await ev("document.getElementById('autoPillGo').click()"); await sleep(600);
  ok(await ev('MY.AUTO.paused') === 0, '点「继续」恢复');
  await ev("document.getElementById('autoPillX').click()"); await sleep(150);
  ok(await ev('MY.AUTO.on') === 0, '点「退出」关闭自动阅读');

  console.log('=== 自动阅读（翻页）');
  await setPage('auto');
  await ev('(function(){document.getElementById("autoPill").classList.remove("on");MY.CFG.autoPageSec=4;MY.saveCfg();MY.pgTo(0,{instant:true});MY.autoStart();return 1;})()');
  await sleep(4600);
  const ap = await C();
  ok(ap.i >= 1, '自动翻页按停留秒数前进', ap);
  await ev('MY.autoStop(true)');
  ok(await ev('MY.AUTO.on') === 0, '自动翻页可停止');

  console.log('=== 全屏 / 沉浸');
  await ev("document.getElementById('btnFull').click()"); await sleep(400);
  ok(await ev("document.body.classList.contains('imm')") === true, '进入沉浸全屏阅读');
  ok(await ev("document.getElementById('btnFull').textContent") === '退出', '按钮文字变为「退出」');
  ok(await ev("getComputedStyle(document.getElementById('readTop')).position") === 'absolute', '顶栏脱离文档流（正文占满）');
  const hh = await ev("document.getElementById('readMain').getBoundingClientRect().height");
  ok(hh > 700, '正文区域变高', hh);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 2 });
  await sleep(200);
  ok(await ev("document.getElementById('readTop').classList.contains('peek')") === true, '鼠标移到顶部唤出工具栏');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"); await sleep(300);
  ok(await ev("document.body.classList.contains('imm')") === false, 'Esc 退出沉浸模式');

  console.log('=== 快捷键');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'T',bubbles:true}))"); await sleep(300);
  ok(await ev("document.getElementById('modal').classList.contains('on')"), 'T 键打开主题面板');
  await ev("document.getElementById('modalX').click()"); await sleep(200);
  ok(!(await ev("document.getElementById('modal').classList.contains('on')")), '关掉面板后继续用快捷键');
  const fs0 = await ev('MY.CFG.fs');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'=',ctrlKey:true,bubbles:true}))"); await sleep(150);
  ok(await ev('MY.CFG.fs') === fs0 + 1, 'Ctrl + = 放大字号');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'-',ctrlKey:true,bubbles:true}))"); await sleep(150);
  ok(await ev('MY.CFG.fs') === fs0, 'Ctrl + - 缩小字号');
  await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}))"); await sleep(200);
  ok(await ev('MY.AUTO.on') === 1, 'A 键开自动阅读');
  await ev('MY.autoStop(true)');

  console.log('=== 翻页模式下的划线仍然可用');
  await setPage('auto');
  await ev(`(function(){var p=document.querySelector('#page p.rdp');var tn=p.firstChild;
    var r=document.createRange();r.setStart(tn,0);r.setEnd(tn,8);var s=getSelection();s.removeAllRanges();s.addRange(r);
    p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1;})()`);
  await sleep(250);
  ok(await ev("document.getElementById('selTools').classList.contains('on')") === true, '翻页模式下选中正文弹出工具条');
  await ev("document.querySelector('#selTools [data-hl=\"y\"]').click()"); await sleep(400);
  const hln = await ev('(MY.BK.meta.hl||[]).length');
  ok(hln === 1, '翻页模式下能加高亮', hln);
  ok(await ev("document.querySelectorAll('#page mark[data-hlid]').length") === 1, '高亮已还原到正文');
  ok(await ev('MY.PG.count') >= 1, '加高亮后分页仍然有效');

  console.log('=== 书自带样式不能污染版心');
  await setPage('auto');
  // 模拟 EPUB 里的 body{margin:5%}：会被 rewriteCss 映射到 #page 上，注入得比我们更晚
  await ev(`(function(){var s=document.createElement('style');s.id='fakeBookCss';
    s.textContent='#page{margin:5%;padding:40px 60px}';document.head.appendChild(s);return 1;})()`);
  await sleep(300);
  const gbox = JSON.parse(await ev(`(function(){var el=document.getElementById('page'),w=document.getElementById('pageWrap');
    return JSON.stringify({ml:getComputedStyle(el).marginLeft,pl:getComputedStyle(el).paddingLeft,
      pw:Math.round(el.getBoundingClientRect().width),ww:Math.round(w.getBoundingClientRect().width)});})()`));
  ok(gbox.ml === '0px', '书里的 margin 挤不动正文容器', gbox);
  ok(Math.abs(gbox.pw - gbox.ww) <= 2, '正文容器仍与视口同宽', gbox);
  ok(gbox.pl !== '60px', '书里的 padding 也没生效', gbox.pl);
  await ev("(function(){var s=document.getElementById('fakeBookCss');if(s)s.remove();return 1;})()");
  await setPage('auto');

  console.log('=== 分栏几何与真实排版一致');
  const geo = JSON.parse(await ev(`(function(){
    var ps=[].slice.call(document.querySelectorAll('#page .rdp')).filter(function(p){return p.getBoundingClientRect().width>1;});
    var ls=[]; ps.forEach(function(p){var v=Math.round(p.getBoundingClientRect().left); if(ls.indexOf(v)<0)ls.push(v);});
    ls.sort(function(a,b){return a-b;});
    return JSON.stringify({lefts:ls.slice(0,6),cw:Math.round(MY.PG.cw),gap:MY.PG.gap,cols:MY.PG.cols,step:Math.round(MY.PG.step)});})()`));
  ok(geo.cols === 2, '宽屏双栏', geo);
  ok(geo.lefts.length >= 2 && Math.abs((geo.lefts[1] - geo.lefts[0]) - (geo.cw + geo.gap)) <= 3,
    '真实列距 = 列宽 + 栏间距', geo);
  ok(geo.step === geo.cols * (geo.cw + geo.gap), '翻页步长 = 列数 × 列距', geo);
  const cut = JSON.parse(await ev(`(function(){var vw=innerWidth, bad=[];
    [].slice.call(document.querySelectorAll('#page .rdp')).forEach(function(p){
      var r=p.getBoundingClientRect(); if(r.width<2) return;
      // 起点在屏幕内的段落，必须整段在屏幕内（否则就是右栏被切）
      if(r.left >= -1 && r.left < vw - 4 && r.right > vw + 2) bad.push(Math.round(r.right));
    });
    return JSON.stringify({bad:bad.slice(0,4),n:bad.length,vw:vw});})()`));
  ok(cut.n === 0, '屏幕内的正文列没有被右侧裁切', cut);

  console.log('=== 章节标题不重复');
  const dup = await ev(`(function(){
    var t=document.getElementById('chTitle');
    var norm=function(s){return String(s||'').replace(/[\\s\\u3000·・.,，。:：、!！?？"'“”‘’（）()《》〈〉【】\\[\\]\\-—_~～]/g,'');};
    var want=norm(t.textContent); if(want.length<2) return 'skip';
    var el=t.nextElementSibling,n=0;
    while(el&&n++<8){ if(el.id==='chEnd')break;
      if(norm(el.textContent)===want && getComputedStyle(el).display!=='none') return 'dup-visible';
      el=el.nextElementSibling; }
    return 'ok';})()`);
  ok(dup === 'ok' || dup === 'skip', '正文里不重复显示章节标题', dup);

  console.log('=== 持久化');
  await ev("(function(){MY.CFG.mode='page';MY.CFG.lay='two';MY.CFG.theme='sepia';MY.saveCfg();return 1;})()");
  await send('Page.reload');
  await sleep(1200);
  ok(await ready(), '刷新后重新初始化');
  const saved = await ev("JSON.stringify({mode:MY.CFG.mode,lay:MY.CFG.lay,theme:MY.CFG.theme,attr:document.documentElement.getAttribute('data-mode')})").then(JSON.parse);
  ok(saved.mode === 'page' && saved.lay === 'two' && saved.theme === 'sepia', '排版设置被记住', saved);
  ok(saved.attr === 'page', '刷新后仍是翻页模式');

  console.log('=== 英文界面');
  await ev("MY.setLang('en')"); await sleep(300);
  await ev("MY.showType()"); await sleep(250);
  const en = await ev("document.getElementById('modalBody').textContent");
  ok(en.indexOf('Columns') > 0 && en.indexOf('Auto read') > 0, '英文下排版面板已翻译', en.slice(0, 60));
  const cjk = (en.match(/[\u4e00-\u9fa5]/g) || []).length;
  ok(cjk <= 6, '英文面板几乎没有中文残留', cjk);
  await ev("document.getElementById('modalX').click()");
  await ev("MY.setLang('zh')"); await sleep(200);

  console.log('=== 运行时错误');
  ok(jsErrors.length === 0, '无 JS 异常 / console.error', jsErrors.slice(0, 3));

  console.log('\nPASS ' + pass + ' FAIL ' + fail);
  ws.close(); edge.kill(); server.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });

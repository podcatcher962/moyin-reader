/* v1.7 新功能回归：双语、划线批注、导出、分享、阅读总结、书架分组/收藏/批量、文件夹导入 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname, SAMPLES = path.join(HERE, '_samples');
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
      const ext = path.extname(f).toLowerCase();
      const ct = ({ '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
        '.epub': 'application/epub+zip' })[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct }); res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const APP = 'http://127.0.0.1:' + PORT + '/MoYinReader.html';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-v17-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'],
    { stdio: 'ignore' });
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
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SAMPLES, 'v17_' + name + '.png'), Buffer.from(r.data, 'base64'));
  };
  const ready = async () => {
    for (let i = 0; i < 60; i++) {
      try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') return true; } catch (e) { }
      await sleep(150);
    }
    return false;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });

  console.log('=== 启动与版本');
  await send('Page.navigate', { url: APP });
  ok(await ready(), '页面初始化完成');
  ok(await ev('MY.VER') === '1.7.1', '版本号 1.7.1', await ev('MY.VER'));
  ok(await ev("!!document.getElementById('btnLang')"), '首页有语言开关');

  console.log('=== 双语');
  let zhBtn = await ev("document.getElementById('btnImport').textContent.trim()");
  ok(zhBtn.indexOf('导入') >= 0, '默认中文界面', zhBtn);
  await ev("document.getElementById('btnLang').click()");
  await sleep(250);
  let en = await ev(`({sort:document.getElementById('btnSort').textContent.trim(),
    imp:document.getElementById('btnImport').textContent.trim(),
    ph:document.getElementById('libSearch').placeholder,
    lang:document.documentElement.getAttribute('lang'),
    btn:document.getElementById('btnLang').textContent.trim()})`);
  ok(en.sort === 'Sort' && en.imp.indexOf('Import') >= 0, '工具栏已切换英文', en);
  ok(en.ph === 'Search titles…', '搜索框占位符英文', en.ph);
  ok(en.lang === 'en' && en.btn === '中', '<html lang> 与按钮同步', en);
  await ev("MY.showSettings()");
  await sleep(200);
  let setTx = await ev("document.getElementById('modalBody').innerText");
  ok(setTx.indexOf('Appearance') >= 0 && setTx.indexOf('Language') >= 0, '设置页英文');
  ok(setTx.indexOf('阅读设置') < 0 && setTx.indexOf('字号') < 0, '设置页无残留中文');
  await ev("MY.closeModal && MY.closeModal(); document.getElementById('modalX').click()");
  await shot('01_shelf_en');
  await ev("MY.showDoc('about')");
  await sleep(200);
  let aboutEn = await ev("document.getElementById('modalBody').innerText");
  ok(aboutEn.indexOf('What is new in 1.7') >= 0, '关于页英文（含 1.7 更新）');
  ok(aboutEn.length > 900, '英文文档非占位符', aboutEn.length);
  await ev("document.getElementById('modalX').click()");
  for (const k of ['help', 'voice', 'local', 'faq', 'open', 'disclaimer']) {
    await ev("MY.showDoc('" + k + "')");
    await sleep(80);
    const t = await ev("document.getElementById('modalBody').innerText.length");
    ok(t > 700, '英文文档 ' + k + ' 完整', t);
    await ev("document.getElementById('modalX').click()");
  }
  await ev("MY.setLang('zh')");
  await sleep(200);
  ok(await ev("document.getElementById('btnSort').textContent.trim()") === '排序', '切回中文');

  console.log('=== 导入与划线');
  await ev("(async()=>{const b=await (await fetch('/_samples/test_utf8.txt')).arrayBuffer();window.__b1=await MY.importBuffer(b,'test_utf8.txt','txt');return 1;})()");
  ok(await ev('MY.BOOKS.length') >= 1, '书已入架');
  await ev("(async()=>{await MY.openBook(window.__b1);MY.renderChapter(1);return 1;})()");
  await sleep(200);
  let selInfo = await ev(`(function(){
    var p=document.querySelectorAll('#page .rdp')[1]||document.querySelectorAll('#page .rdp')[0];
    var n=p.firstChild, len=Math.min(16,n.length);
    var r=document.createRange(); r.setStart(n,0); r.setEnd(n,len);
    var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    return {text:r.toString(), len:len};
  })()`);
  await sleep(220);
  ok(await ev("document.getElementById('selTools').classList.contains('on')"), '选中文字弹出工具条', selInfo);
  await ev("document.querySelector('#selTools [data-hl=\"y\"]').click()");
  await sleep(220);
  let hl1 = await ev("({marks:document.querySelectorAll('#page mark').length, hl:MY.BK.meta.hl.length, cls:(document.querySelector('#page mark')||{}).className||''})");
  ok(hl1.hl === 1 && hl1.marks === 1, '高亮已写入并渲染', hl1);
  ok(String(hl1.cls).indexOf('hl-y') >= 0, '默认黄色', hl1.cls);

  // 第二条：换绿色
  await ev(`(function(){
    var p=document.querySelectorAll('#page .rdp')[2]||document.querySelectorAll('#page .rdp')[0];
    var n=p.firstChild, len=Math.min(12,n.length);
    var r=document.createRange(); r.setStart(n,0); r.setEnd(n,len);
    var s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
    p.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    return 1;
  })()`);
  await sleep(200);
  await ev("document.querySelector('#selTools [data-hl=\"g\"]').click()");
  await sleep(200);
  ok(await ev('MY.BK.meta.hl.length') === 2, '第二条高亮');

  console.log('=== 批注与侧栏');
  await ev("MY.noteEditor(MY.hlList(MY.BK.meta)[0])");
  await sleep(200);
  ok(await ev("!!document.getElementById('noteTx')"), '笔记编辑框已打开');
  await ev("document.getElementById('noteTx').value='这句写得真好，记一下。';" +
    "document.getElementById('modalFoot').querySelectorAll('button')[2].click()");
  await sleep(250);
  ok(await ev("MY.hlList(MY.BK.meta)[0].note") === '这句写得真好，记一下。', '笔记已保存');
  ok(await ev("document.querySelectorAll('#page mark.hasNote').length") >= 1, '有笔记的高亮有下划线标记');
  await ev("MY.openSide ? MY.openSide('note') : document.querySelector('[data-tab=note]').click()");
  await sleep(200);
  let sideTx = await ev("document.getElementById('sideBody').innerText");
  ok(sideTx.indexOf('这句写得真好') >= 0, '侧栏笔记页列出批注');
  ok(sideTx.indexOf('全部批注') >= 0 || sideTx.indexOf('导出笔记') >= 0, '笔记页有筛选与导出入口');
  await shot('02_notes');

  console.log('=== 导出与阅读总结');
  let md = await ev("MY.notesMarkdown(MY.BK.meta)");
  ok(md.indexOf('这句写得真好') >= 0 && md.indexOf('# ') === 0, 'Markdown 笔记含批注与标题');
  ok(md.indexOf('## ') > 0, 'Markdown 按章节分组');
  ok(await ev("(function(){var n=0;MY.hlList(MY.BK.meta).forEach(function(h){if(h.text)n++});return n})()") === 2, '两条高亮都带原文');
  await ev("MY.showSummary()");
  await sleep(250);
  let sum = await ev("document.getElementById('modalBody').innerText");
  ok(sum.indexOf('累计阅读') >= 0 && sum.indexOf('本书摘录') >= 0, '阅读总结含概况与摘录');
  ok((await ev("document.querySelectorAll('.sumGrid .c').length")) >= 8, '总结统计卡齐全');
  ok(sum.indexOf('这句写得真好') >= 0, '总结列出批注内容');
  await shot('03_summary');
  await ev("document.getElementById('modalX').click()");

  console.log('=== 分享卡片');
  let share = await ev("(function(){try{MY.shareHighlight(MY.hlList(MY.BK.meta)[0]);return 'ok'}catch(e){return 'ERR '+e.message}})()");
  ok(share === 'ok', '分享卡片生成不报错', share);
  let cvOk = await ev(`(function(){
    var c=document.createElement('canvas');c.width=1080;c.height=600;var g=c.getContext('2d');
    g.fillStyle='#FAF7F0';g.fillRect(0,0,1080,600);
    g.font='46px "Microsoft YaHei"';g.fillStyle='#2C2620';g.fillText('测试',100,200);
    return c.toDataURL('image/png').length>2000;
  })()`);
  ok(cvOk, 'canvas 可输出 PNG');

  console.log('=== 书架：收藏 / 分组 / 批量');
  await ev("MY.closeBook()");
  await sleep(200);
  await ev("MY.toggleFav(MY.BOOKS[0].id)");
  await sleep(150);
  ok(await ev("MY.BOOKS[0].fav") === 1, '收藏已记录');
  ok(await ev("document.querySelectorAll('#shelf .bk .fav.on').length") === 1, '卡片显示实心星');
  await ev("document.getElementById('btnShelves').click()");
  await sleep(200);
  await ev("document.getElementById('shNew').value='小说';document.querySelector('[data-sh=\"add\"]').click()");
  await sleep(200);
  ok((await ev("MY.CFG.shelves||[]")).indexOf('小说') >= 0, '新建书架成功');
  await ev("document.getElementById('modalX').click()");
  await sleep(100);
  // 卡片菜单 → 移动到「小说」
  await ev("MY.openBookMenu(MY.BOOKS[0].id)");
  await sleep(200);
  await ev("document.getElementById('bkGroup').value='小说';document.getElementById('modalFoot').querySelectorAll('button')[1].click()");
  await sleep(250);
  ok(await ev("MY.BOOKS[0].group") === '小说', '书已移入书架');
  ok(await ev("document.querySelectorAll('#shelfBar .chip').length") >= 3, '分组条含全部/收藏/自定义');
  await ev("document.querySelector('#shelfBar [data-sv=\"g:小说\"]').click()");
  await sleep(200);
  ok(await ev("document.querySelectorAll('#shelf .bk').length") === 1, '按书架筛选生效');
  await shot('04_shelf_groups');
  await ev("document.querySelector('#shelfBar [data-sv=\"all\"]').click()");
  await sleep(150);
  ok(await ev("document.querySelectorAll('#shelf .bk').length") >= 1, '回到全部');

  console.log('=== 批量选择');
  await ev("MY.enterSelMode(true)");
  await sleep(200);
  ok(await ev("document.body.classList.contains('selmode')"), '进入批量模式');
  ok(await ev("!document.getElementById('selBar').hidden"), '批量条出现');
  await ev("document.querySelector('#shelf .bk').click()");
  await sleep(150);
  let selTx = await ev("document.getElementById('selCount').textContent");
  ok(/1/.test(selTx), '已选 1 本', selTx);
  await ev("MY.enterSelMode(false)");
  await sleep(150);
  ok(await ev("!document.body.classList.contains('selmode')"), '退出批量模式');

  console.log('=== 文件夹导入');
  let dirN = await ev(`(async()=>{
    var before=MY.BOOKS.length;
    var txt='第一章 起点\\n这是从文件夹导入的第一段文字。\\n第二章 继续\\n第二段文字在这里。\\n';
    var dt=new DataTransfer();
    dt.items.add(new File([txt],'folder_book.txt',{type:'text/plain'}));
    dt.items.add(new File(['not a book'],'readme.md',{type:'text/markdown'}));
    await MY.importFiles(Array.from(dt.files));
    return {before:before, after:MY.BOOKS.length};
  })()`);
  ok(dirN.after === dirN.before + 1, '文件夹导入只收 txt，跳过其它文件', dirN);
  ok(await ev("MY.BOOKS.some(function(b){return b.name==='folder_book'})"), '导入的书名正确');
  // 重复导入应跳过
  let dup = await ev(`(async()=>{
    var before=MY.BOOKS.length;
    var txt='第一章 起点\\n这是从文件夹导入的第一段文字。\\n第二章 继续\\n第二段文字在这里。\\n';
    var dt=new DataTransfer();
    dt.items.add(new File([txt],'folder_book.txt',{type:'text/plain'}));
    await MY.importFiles(Array.from(dt.files));
    return {before:before, after:MY.BOOKS.length};
  })()`);
  ok(dup.after === dup.before, '重复文件不会重复入架', dup);

  console.log('=== 持久化');
  await ev("(async()=>{await MY.openBook(window.__b1);MY.renderChapter(1);MY.persistBook();return 1;})()");
  await send('Page.navigate', { url: APP });
  ok(await ready(), '刷新后重新初始化');
  await sleep(300);
  let kept = await ev(`(async()=>{
    var b=MY.BOOKS.filter(function(x){return x.name==='test_utf8'})[0];
    await MY.openBook(b.id); MY.renderChapter(1);
    return {hl:MY.BK.meta.hl.length, marks:document.querySelectorAll('#page mark').length,
            note:(MY.BK.meta.hl[0]||{}).note||'', fav:b.fav, group:b.group};
  })()`);
  ok(kept.hl === 2, '刷新后高亮仍在', kept.hl);
  ok(kept.marks === 2, '刷新后正文高亮还原', kept.marks);
  ok(kept.note.indexOf('这句写得真好') >= 0, '刷新后笔记仍在');
  ok(kept.fav === 1 && kept.group === '小说', '收藏与分组持久化', kept);
  await shot('05_restored');

  console.log('=== 阅读计时');
  let rt = await ev(`(async()=>{
    MY.STATS.days={}; MY.STATS.total=0;
    MY.rtFlush();
    document.getElementById('btnBack').click();
    await new Promise(function(r){setTimeout(r,150)});
    var b=MY.BOOKS.filter(function(x){return x.name==='test_utf8'})[0];
    await MY.openBook(b.id);
    await new Promise(function(r){setTimeout(r,50)});
    MY.BK.meta.last=Date.now();
    return {total:MY.STATS.total, days:Object.keys(MY.STATS.days).length};
  })()`);
  ok(rt.days <= 1, '统计结构可用', rt);

  console.log('=== 运行时错误');
  ok(jsErrors.length === 0, '无 JS 异常 / console.error', jsErrors.slice(0, 3));

  console.log('\nPASS ' + pass + ' FAIL ' + fail);
  ws.close(); server.close();
  try { edge.kill(); } catch (e) { }
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });

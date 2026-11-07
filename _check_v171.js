/* v1.7.1 修复回归：正文可选中、侧栏可退出、桌面版原生选文件夹桥接 */
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
  if (!fs.existsSync(SAMPLES)) fs.mkdirSync(SAMPLES, { recursive: true });
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-v171-'));
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
  const ready = async () => {
    for (let i = 0; i < 60; i++) {
      try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') return true; } catch (e) { }
      await sleep(150);
    }
    return false;
  };
  const sideOn = () => ev("document.getElementById('side').classList.contains('on')");
  const clickAt = async (sel) => {
    const b = await ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;
      var r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];})()`);
    if (!b) return false;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b[0], y: b[1], button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b[0], y: b[1], button: 'left', clickCount: 1 });
    return true;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Page.navigate', { url: APP });
  ok(await ready(), '页面初始化完成');
  ok(await ev('MY.VER') === '1.7.1', '版本号 1.7.1', await ev('MY.VER'));

  console.log('=== 正文可选中（划线前提）');
  await ev(`(async()=>{const txt='第一章 起风\\n'+('夜色像一层薄薄的尘，落在旧城的瓦上没有声响。'.repeat(6));
    const buf=new TextEncoder().encode(txt);const id=await MY.importBuffer(buf.buffer,'选择测试.txt','txt');MY.openBook(id);})()`);
  await sleep(1200);
  const us = await ev(`(function(){var p=document.querySelector('#page p.rdp');var c=getComputedStyle(p);
    return {p:c.userSelect, body:getComputedStyle(document.body).userSelect, hasP:!!p};})()`);
  ok(us.hasP, '正文已渲染');
  ok(us.p === 'text', '段落 user-select 为 text', us);

  console.log('=== 左侧导航能退出');
  await ev("MY.openSide('toc')"); await sleep(200);
  ok(await sideOn(), '目录可以打开');
  ok(await clickAt('#sideClose'), '侧栏有关闭按钮');
  await sleep(200);
  ok(!(await sideOn()), '点 × 能关掉侧栏');

  await ev("MY.openSide('toc')"); await sleep(150);
  await ev("document.getElementById('btnToc').click()"); await sleep(200);
  ok(!(await sideOn()), '再点同一个按钮能收起');

  await ev("MY.openSide('toc')"); await sleep(150);
  const px = await ev(`(function(){var p=document.querySelector('#page p.rdp');var r=p.getBoundingClientRect();
    return [r.left+r.width-30, r.top+r.height/2];})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: px[0], y: px[1], button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: px[0], y: px[1], button: 'left', clickCount: 1 });
  await sleep(250);
  ok(!(await sideOn()), '点正文空白处能收起侧栏');

  // 有选区时点正文不该收（避免重排把手选位置抖掉）
  await ev("MY.openSide('toc')"); await sleep(150);
  await ev(`(function(){var p=document.querySelector('#page p.rdp');var t=p.firstChild;
    var r=document.createRange();r.setStart(t,0);r.setEnd(t,8);var s=getSelection();s.removeAllRanges();s.addRange(r);})()`);
  await sleep(80);
  const px2 = await ev(`(function(){var p=document.querySelector('#page p.rdp');var r=p.getBoundingClientRect();
    return [r.left+r.width-30, r.top+r.height/2];})()`);
  await ev("document.getElementById('pageWrap').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
  await sleep(200);
  ok(await sideOn(), '有选区时点正文不收起侧栏');
  await ev("window.getSelection().removeAllRanges();MY.closeSide();");

  console.log('=== 桌面版原生选文件夹');
  const bridged = await ev(`(async()=>{
    const txt='第一章 桥接\\n'+('这一段是在桌面版里从文件夹导入的。'.repeat(5));
    window.__moyinPickDir=async()=>({dir:'D:\\\\书籍\\\\测试目录',skipped:0,truncated:false,files:[
      {name:'桥接一号.txt',size:new TextEncoder().encode(txt).length,arrayBuffer:async()=>new TextEncoder().encode(txt).buffer}]});
    const before=MY.BOOKS.length;
    await MY.importFolder();
    await new Promise(r=>setTimeout(r,200));
    const modalText=document.getElementById('modal').classList.contains('on')
      ? document.getElementById('modalBody').textContent : '';
    const btns=document.querySelectorAll('#modalFoot button');
    if(btns.length>1) btns[btns.length-1].click();     // 确定
    for(let i=0;i<40;i++){ if(MY.BOOKS.length>before) break; await new Promise(r=>setTimeout(r,100)); }
    return {before, after:MY.BOOKS.length, modalText,
      last:(MY.BOOKS.filter(b=>b.name==='桥接一号')[0]||{}).name};
  })()`);
  ok(bridged.modalText.indexOf('找到 1 个') >= 0, '导入前先确认（显示找到几本）', bridged.modalText);
  ok(bridged.after > bridged.before, '原生桥接返回的文件能导入', bridged);
  ok(bridged.last === '桥接一号', '桥接导入的书名正确', bridged.last);

  const empty = await ev(`(async()=>{
    window.__moyinPickDir=async()=>({files:[],skipped:0,dir:'D:\\\\空目录'});
    const before=MY.BOOKS.length; await MY.importFolder(); await new Promise(r=>setTimeout(r,200));
    return {same:MY.BOOKS.length===before,
      toast:(document.getElementById('toast')||{}).textContent};
  })()`);
  ok(empty.same, '空文件夹不报错也不加书', empty);
  ok((empty.toast || '').indexOf('没有找到') >= 0, '空文件夹给出提示', empty.toast);

  const fallback = await ev(`(async()=>{
    delete window.__moyinPickDir;
    let clicked=0; const inp=document.getElementById('dirInput');
    const orig=inp.click; inp.click=function(){clicked++;};
    await MY.importFolder(); inp.click=orig;
    return {clicked, hasDirInput:!!document.getElementById('dirInput'),
      webkit:!!document.getElementById('dirInput').webkitdirectory};
  })()`);
  ok(fallback.clicked === 1, '网页版仍回落到 input[webkitdirectory]', fallback);

  console.log('=== 运行时错误');
  ok(jsErrors.length === 0, '无 JS 异常 / console.error', jsErrors.slice(0, 3));

  console.log('\nPASS ' + pass + ' FAIL ' + fail);
  try { ws.close(); } catch (e) { }
  try { edge.kill(); } catch (e) { }
  server.close();
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('崩了:', e); process.exit(2); });

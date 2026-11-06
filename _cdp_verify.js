/* CDP 端到端验证：headless Edge 打开成品，导入真实 TXT/EPUB，验证阅读/朗读/备份/响应式 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const HERE = __dirname, SAMPLES = path.join(HERE, '_samples');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let pass = 0, fail = 0;
const ok = (c, label, extra) => { if (c) { pass++; console.log('  ok   ' + label); } else { fail++; console.log('  FAIL ' + label + '  ' + (extra === undefined ? '' : JSON.stringify(extra))); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STUB = `(function(){
  window.__spoken=[]; window.__maxSpoken=10000;
  function U(text){ this.text=String(text); this.onend=null; this.onerror=null; }
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:U,configurable:true});
  var voices=[{name:'测试中文语音',lang:'zh-CN',voiceURI:'test-zh',localService:true,'default':true},
              {name:'English Test',lang:'en-US',voiceURI:'test-en',localService:true,'default':false},
              {name:'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)',lang:'zh-CN',voiceURI:'nat-zh',localService:false,'default':false},
              {name:'Microsoft Huihui - Chinese (Simplified, PRC)',lang:'zh-CN',voiceURI:'local-zh',localService:true,'default':false}];
  var synth={ getVoices:function(){return voices;},
    speak:function(u){ window.__spoken.push(u.text); if(window.__spoken.length>=window.__maxSpoken) return;
      setTimeout(function(){ if(u.onend) u.onend(); },3); },
    cancel:function(){}, pause:function(){}, resume:function(){},
    speaking:true, paused:false, pending:false, addEventListener:function(){}, removeEventListener:function(){} };
  Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
  window.__localReq=[]; window.__audio=[]; window.__localFail=false; window.__localOn=false;
  (function(){
    const origFetch = window.fetch.bind(window);
    window.fetch = function(url, opt){
      const u = String(url), o = opt || {};
      // 模拟本机免费神经语音服务（真实服务另用 curl 端到端验证）
      if (u.indexOf('127.0.0.1') >= 0 && (u.indexOf('/health') >= 0 || u.indexOf('/tts') >= 0)) {
        if (u.indexOf('/health') >= 0)
          return Promise.resolve({ok:true,status:200,
            json:()=>Promise.resolve({ok:window.__localOn,engine:'sherpa-onnx 2.0.1',
                                     voices:{s12:true,s35:true,s140:true,s160:true,s170:true,s20:true,s3:true,s9:true,s6:true,s150:true,s110:true},version:1})});
        window.__localReq.push({url:u, body:JSON.parse(o.body||'{}')});
        if (window.__localFail) return Promise.resolve({ok:false,status:500,
          text:()=>Promise.resolve(JSON.stringify({error:'mock offline'}))});
        const b = new Uint8Array(2400); b[0]=82;b[1]=73;b[2]=70;b[3]=70;
        return Promise.resolve({ok:true,status:200,
          blob:()=>Promise.resolve(new Blob([b],{type:'audio/wav'}))});
      }
      return origFetch(url, opt);
    };
    window.Audio = function(){
      this.src=''; this.playbackRate=1; this.onended=null; this.onerror=null;
      this.pause=function(){};
      this.play=function(){ window.__audio.push(this.src);
        setTimeout(()=>{ if(this.onended) this.onended(); }, 6); return Promise.resolve(); };
    };
  })();
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
  // 回归用样本：工作区里没留大副本时，从本机原始书库临时补一份
  const SRC = {
    'zhongguo.epub': 'D:\\C geng\\书籍下载\\2021年1月余秋雨书籍\\中国文脉.epub',
    'rulin.epub': 'D:\\C geng\\书籍下载\\好读\\吳敬梓 儒林外史.epub',
    'bigbook.epub': 'D:\\C geng\\书籍下载\\侯卫东官场笔记（1-8册 巴国侯氏）.epub'
  };
  Object.keys(SRC).forEach(n => {
    const d = path.join(SAMPLES, n);
    if (!fs.existsSync(d) && fs.existsSync(SRC[n])) fs.copyFileSync(SRC[n], d);
  });
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = path.join(HERE, u === '/' ? 'MoYinReader.html' : u);
    if (!f.startsWith(HERE)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); res.end('404'); return; }
      const ext = path.extname(f).toLowerCase();
      const ct = ({ '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
        '.epub': 'application/epub+zip', '.json': 'application/json; charset=utf-8' })[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': ct }); res.end(buf);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const PORT = server.address().port;
  const APP = 'http://127.0.0.1:' + PORT + '/MoYinReader.html';
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-edge-'));
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
      jsErrors.push(m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text);
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
    if (r.exceptionDetails) throw new Error('EVAL ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text) + '\n' + expr.slice(0, 200));
    return r.result.value;
  };
  const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SAMPLES, 'shot_' + name + '.png'), Buffer.from(r.data, 'base64'));
  };

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Page.navigate', { url: APP });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if (await ev("document.documentElement.getAttribute('data-ready')") === '1') { ready = true; break; } } catch (e) {}
    await sleep(150);
  }
  console.log('=== 加载');
  ok(ready, '页面初始化完成 (data-ready=1)');
  ok(await ev("!!window.MY && !!window.MYZip") === true, '内核与主程序均已注入');
  ok(await ev("document.querySelectorAll('#libActs button').length") >= 6, '书架工具栏按钮齐全');
  ok(await ev("document.getElementById('emptyLib').style.display") === '', '空书架引导可见');
  await shot('01_shelf_empty');

  console.log('=== TXT 导入与编码');
  await ev("(async()=>{const b=await (await fetch('/_samples/test_utf8.txt')).arrayBuffer(); window.__t1=await MY.importBuffer(b,'test_utf8.txt','txt'); return 1;})()");
  ok(await ev('MY.BOOKS.length') === 1, 'UTF-8 TXT 已入架');
  let t1 = await ev("(async()=>{await MY.openBook(window.__t1);MY.renderChapter(1);return {n:MY.chapterCount(),t:MY.chapterTitle(1),txt:document.getElementById('page').innerText,paras:document.querySelectorAll('#page .rdp').length,enc:MY.BK.enc};})()");
  ok(t1.n >= 3, 'TXT 章节识别', t1.n);
  ok(t1.t === '第一章 起源', '章节标题正确', t1.t);
  ok(t1.txt.indexOf('很久以前') >= 0, '正文渲染正常');
  ok(t1.paras >= 2, '朗读段落已标记', t1.paras);
  ok(String(t1.enc).indexOf('UTF-8') === 0, '编码识别为 UTF-8', t1.enc);
  await shot('02_read_txt_dark');

  await ev("(async()=>{const b=await (await fetch('/_samples/test_gbk.txt')).arrayBuffer(); window.__t2=await MY.importBuffer(b,'test_gbk.txt','txt'); return 1;})()");
  let t2 = await ev("(async()=>{await MY.openBook(window.__t2);MY.renderChapter(1);return {enc:MY.BK.enc,txt:document.getElementById('page').innerText.slice(0,120)};})()");
  ok(String(t2.enc).indexOf('GB18030') >= 0, 'GBK TXT 自动回退 GB18030', t2.enc);
  ok(t2.txt.indexOf('很久以前') >= 0, 'GBK 正文无乱码', t2.txt.slice(0, 40));

  console.log('=== EPUB 解析（真实书）');
  for (const [file, label, minCh] of [['zhongguo.epub', '中国文脉', 20], ['rulin.epub', '儒林外史', 40], ['bigbook.epub', '8.7MB 大书', 300]]) {
    const r = await ev("(async()=>{const t0=performance.now();const b=await (await fetch('/_samples/" + file + "')).arrayBuffer();" +
      "const id=await MY.importBuffer(b,'" + file + "','epub');await MY.openBook(id);" +
      "const n=MY.chapterCount(),toc=MY.BK.toc.length,title=MY.BK.title,author=MY.BK.author," +
      "cover=(MY.BOOKS.filter(x=>x.id===id)[0].cover||'').length,toc1=MY.BK.toc.slice(0,2).map(x=>x.label);" +
      "let best={len:0,ch:0,txt:'',paras:0,html:0,maxPara:0};" +
      "for(let i=0;i<Math.min(15,n);i++){MY.renderChapter(i);const t=document.getElementById('page').innerText;" +
      "const ps=Array.from(document.querySelectorAll('#page .rdp'));const lens=ps.map(e=>e.textContent.length);" +
      "if(t.length>best.len)best={len:t.length,ch:i,txt:t.slice(0,120),paras:ps.length," +
      "html:document.getElementById('page').innerHTML.length,maxPara:Math.max.apply(null,[0].concat(lens))};}" +
      "MY.renderChapter(best.ch);" +
      "return {ms:Math.round(performance.now()-t0),n:n,toc:toc,title:title,author:author,body:best.txt," +
      "paras:best.paras,cover:cover,toc1:toc1,html:best.html,ch:best.ch,maxPara:best.maxPara};})()");
    console.log('  ' + label + ':', JSON.stringify({ ms: r.ms, n: r.n, toc: r.toc, paras: r.paras, maxPara: r.maxPara, cover: r.cover, body: r.body.slice(0, 40) }));
    ok(r.n >= minCh, label + ' spine 章节数', r.n);
    ok(r.toc > 0, label + ' 目录解析', r.toc);
    ok(r.body.replace(/\s/g, '').length > 20, label + ' 正文可读', r.body.slice(0, 60));
    ok(r.paras > 0, label + ' 朗读段落', r.paras);
    ok(r.maxPara < 4000, label + ' 朗读单元粒度合理', r.maxPara);
    ok(r.html > 500, label + ' 章节 HTML 已生成', r.html);
    if (file === 'bigbook.epub') ok(r.cover > 1000, '大书封面已生成缩略图', r.cover);
  }
  await shot('03_read_epub_dark');

  console.log('=== EPUB 插图');
  const imgCheck = await ev("(async()=>{await MY.openBook(MY.BOOKS.filter(x=>x.name==='bigbook')[0].id);" +
    "for(let i=0;i<12;i++){MY.renderChapter(i);const im=document.querySelector('#page img');" +
    "if(im){await new Promise(r=>setTimeout(r,250));return {found:true,ch:i,src:im.src.slice(0,5),w:im.naturalWidth};}}" +
    "return {found:false};})()");
  console.log('  image:', JSON.stringify(imgCheck));
  ok(imgCheck.found && imgCheck.src === 'blob:', 'EPUB 插图已转成本地 blob URL', imgCheck);
  ok(imgCheck.w > 0, '插图可正常解码显示', imgCheck);

  console.log('=== 阅读交互');
  await ev("(async()=>{const id=MY.BOOKS.filter(x=>x.name==='zhongguo')[0].id||MY.BOOKS.filter(x=>x.ext==='epub')[0].id;await MY.openBook(id);return 1;})()");
  let nav = await ev("(async()=>{document.getElementById('btnToc').click();MY.renderChapter(4);" +
    "const side=document.querySelectorAll('#side .it[data-ch]').length;" +
    "document.getElementById('btnNextCh').click();return {ch:MY.BK.ch,side:side,title:MY.chapterTitle(MY.BK.ch)};})()");
  ok(nav.ch === 5, '章节切换', nav.ch);
  ok(nav.side > 5, '目录侧栏有条目', nav.side);
  const tocClick = await ev("(function(){const b=document.querySelector('#side .it[data-ch=\"2\"]');if(b)b.click();return MY.BK.ch;})()");
  ok(tocClick === 2, '点击目录跳章', tocClick);
  const scroll = await ev("(async()=>{const w=document.getElementById('pageWrap');w.scrollTop=w.scrollHeight*0.5;" +
    "w.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,120));return {r:MY.BK.ratio,tx:document.getElementById('progTx').textContent};})()");
  ok(scroll.r > 0 && scroll.r < 1, '章内滚动进度', scroll.r);
  ok(scroll.tx.indexOf('%') > 0, '进度文字', scroll.tx);
  await ev('MY.addMark()');
  ok(await ev('MY.BK.meta.marks.length') === 1, '书签添加');
  await ev("document.getElementById('btnFind').click()");
  const find = await ev("(async()=>{await MY.doFind('文化');return document.querySelectorAll('#findRes .it').length;})()");
  ok(find > 0, '全书搜索命中', find);
  await ev("document.getElementById('btnTheme').click()");
  ok(await ev("document.documentElement.getAttribute('data-theme')") === 'light', '主题切换到明亮');
  await shot('04_read_light');
  await ev("document.getElementById('btnFont').click()");
  const fs0 = await ev('MY.CFG.fs');
  await ev("document.querySelector('#modalBody [data-font=\"fs+\"]').click()");
  ok(await ev('MY.CFG.fs') === fs0 + 1, '字号 +1 即时生效');
  ok(await ev("getComputedStyle(document.getElementById('page')).fontSize") === (fs0 + 1) + 'px', 'CSS 变量已应用');
  await ev("document.getElementById('modalX').click()");
  await ev("document.getElementById('btnCfg').click()");
  ok(await ev("!!document.querySelector('#modalBody [data-set=\"txtEnc\"]')") === true, '设置面板含 TXT 编码选项');
  await ev("document.getElementById('modalX').click()");
  ok(await ev("JSON.parse(localStorage.getItem('MOYIN_CFG')).theme") === 'light', '设置已持久化');

  console.log('=== 语音质量与韵律');
  const vq = await ev("(function(){const s=document.getElementById('spVoice');" +
    "return {groups:s.querySelectorAll('optgroup').length,opts:s.options.length,value:s.value," +
    "badge:document.getElementById('spQuality').textContent,cls:document.getElementById('spQuality').className," +
    "label0:s.options[0].textContent,cfg:MY.CFG.voiceURI,tryBtn:!!document.getElementById('spTry')};})()");
  console.log('  voice:', JSON.stringify(vq));
  ok(vq.groups >= 2, '语音下拉按质量分组', vq.groups);
  ok(vq.opts >= 4, '全部语音均列出', vq.opts);
  ok(vq.value === 'nat-zh' && vq.cfg === 'nat-zh', '默认自动选神经语音', vq);
  ok(vq.badge.indexOf('自然语音') >= 0 && vq.cls.indexOf('good') >= 0, '朗读条标注自然语音', vq.badge);
  ok(vq.label0.indexOf('晓晓') >= 0, '自然语音显示中文友好名', vq.label0);
  ok(vq.tryBtn, '试听按钮存在');
  ok(await ev("MY.voiceTier({name:'Microsoft Xiaoxiao Online (Natural)',lang:'zh-CN',localService:false})") === 0, '神经中文语音分级为 0');
  ok(await ev("MY.voiceTier({name:'Microsoft Huihui',lang:'zh-CN',localService:true})") === 2, '本地中文语音分级为 2');
  const upg = await ev("(function(){MY.CFG.voiceURI='local-zh';MY.CFG.voiceAuto=1;MY.fillVoices();" +
    "return {v:document.getElementById('spVoice').value,badge:document.getElementById('spQuality').textContent};})()");
  ok(upg.v === 'nat-zh', '旧机械语音配置自动升级为自然语音', upg);
  const man = await ev("(function(){MY.CFG.voiceURI='test-zh';MY.CFG.voiceAuto=0;MY.fillVoices();" +
    "return document.getElementById('spVoice').value;})()");
  ok(man === 'test-zh', '用户手动选语音后不再被自动覆盖', man);
  const pros = await ev("(function(){return {a:MY.splitSpeak('窗外下着雨。他合上书。',90)," +
    "b:MY.splitSpeak('很久以前，书案上放着一方旧砚。它不说话，也不发光，只等有人来磨墨。',90)," +
    "c:MY.normSpeak('窗 外　下 雨。。。'),d:MY.splitSpeak('第一句。第二句。第三句。',30)};})()");
  ok(pros.a.length === 1 && pros.a[0] === '窗外下着雨。他合上书。', '整句合并不硬切', pros.a);
  ok(pros.b.every(x => x.length <= 90), '朗读块不超长', pros.b);
  ok(pros.c === '窗外下雨。', '汉字间空格与重复标点已清理', pros.c);
  ok(pros.d.length >= 1, '短句模式仍可用', pros.d);
  const tr = await ev("(async()=>{window.__spoken=[];document.getElementById('spTry').click();" +
    "await new Promise(r=>setTimeout(r,30));return {last:window.__spoken[window.__spoken.length-1],playing:MY.SPK.playing};})()");
  ok(String(tr.last).indexOf('窗外的雨下得很细') === 0, '试听发出示例句且不推进书本', tr);
  ok(tr.playing === false, '试听不影响书本朗读状态', tr.playing);
  await ev("(function(){MY.showDoc('voice');return 1;})()");
  ok(await ev("document.getElementById('modalBody').textContent.indexOf('神经网络语音')") >= 0, '语音说明含原理与隐私提示');
  await ev("document.getElementById('modalX').click()");
  await ev("document.getElementById('btnCfg').click()");
  ok(await ev("!!document.querySelector('#modalBody [data-set=\"pause\"]')") === true, '设置含句间停顿');
  ok(await ev("!!document.querySelector('#modalBody [data-v=\"whole\"]')") === true, '设置含整句朗读开关');
  await ev("document.getElementById('modalX').click()");

  console.log('=== 朗读');
  await ev('MY.CFG.pause=0');
  const sp = await ev("(async()=>{MY.renderChapter(0);window.__spoken=[];MY.startSpeak(0);await new Promise(r=>setTimeout(r,160));" +
    "return {n:window.__spoken.length,playing:MY.SPK.playing,hi:document.querySelectorAll('#page .rdp.speaking').length," +
    "now:document.getElementById('spNow').textContent,voice:document.getElementById('spVoice').options.length," +
    "first:window.__spoken[0]};})()");
  console.log('  speak:', JSON.stringify(sp));
  ok(sp.n > 0, '朗读已开始（utterance 已发出）');
  ok(sp.playing === true, '播放状态正确');
  ok(sp.hi === 1, '当前段落高亮', sp.hi);
  ok(sp.now.length > 2, '朗读条显示当前文字', sp.now);
  ok(sp.voice >= 2, '语音列表已填充', sp.voice);
  ok(String(sp.first).indexOf('　') < 0, '朗读文本已规范化', sp.first);
  await shot('07_speaking');
  await ev('MY.toggleSpeak()');
  ok(await ev('MY.SPK.playing') === false, '暂停生效');
  await ev('MY.toggleSpeak()');
  ok(await ev('MY.SPK.playing') === true, '恢复播放生效');
  const jump = await ev("(async()=>{MY.toggleSpeak();const p=MY.SPK.pi;document.getElementById('spNext').click();" +
    "await new Promise(r=>setTimeout(r,40));return {a:p,b:MY.SPK.pi,playing:MY.SPK.playing};})()");
  ok(jump.b === jump.a + 1, '下一段', jump);
  const auto = await ev("(async()=>{MY.CFG.autoNext=1;window.__spoken=[];MY.renderChapter(0);" +
    "const ps=Array.from(document.querySelectorAll('#page .rdp'));ps.slice(1).forEach(e=>e.remove());" +
    "if(ps[0])ps[0].textContent='短句测试。';MY.startSpeak(0);await new Promise(r=>setTimeout(r,260));return {ch:MY.BK.ch,n:window.__spoken.length};})()");
  ok(auto.ch >= 1, '念完自动翻下一章', auto);
  await ev('MY.stopSpeak(false)');
  ok(await ev('MY.SPK.playing') === false, '停止朗读');
  ok(await ev("document.querySelectorAll('#page .rdp.speaking').length") === 0, '高亮已清除');
  const tm = await ev("(function(){const s=document.getElementById('spTimer');s.value='10';s.dispatchEvent(new Event('change'));" +
    "return {d:MY.SPK.deadline,tx:document.getElementById('spLeft').textContent};})()");
  ok(tm.d > Date.now(), '定时停止已设置');
  ok(tm.tx.indexOf('剩') === 0, '倒计时显示', tm.tx);
  await ev('MY.stopSpeak(true)');

  console.log('=== 免费离线神经语音（本机引擎）');
  const lc = await ev("(async()=>{window.__localReq=[];window.__audio=[];window.__localFail=false;window.__localOn=true;" +
    "MY.CFG.localOn=1;MY.CFG.localVoice='s12';MY.CFG.pause=0;" +
    "await MY.localProbe();const ready=MY.localReady();" +
    "MY.renderChapter(0);MY.startSpeak(0);await new Promise(r=>setTimeout(r,240));" +
    "MY.stopSpeak(false);" +
    "return {ready:ready,req:window.__localReq.length,audio:window.__audio.length," +
    "port:window.__localReq[0]&&window.__localReq[0].url," +
    "voice:window.__localReq[0]&&window.__localReq[0].body.voice," +
    "text:window.__localReq[0]&&window.__localReq[0].body.text," +
    "badge:document.getElementById('spQuality').textContent," +
    "blob:window.__audio[0]?String(window.__audio[0]).indexOf('blob:'):-1};})()");
  console.log('  local:', JSON.stringify({ready:lc.ready,req:lc.req,audio:lc.audio,voice:lc.voice,badge:lc.badge}));
  ok(lc.ready === true, '本机引擎探测成功', lc.ready);
  ok(lc.req >= 1, '已向本机服务发起合成请求', lc.req);
  ok(String(lc.port).indexOf('127.0.0.1:8177/tts') >= 0, '只请求 127.0.0.1 本机', lc.port);
  ok(lc.voice === 's12', '音色参数正确', lc.voice);
  ok(lc.audio >= 1, '本机音频已播放', lc.audio);
  ok(lc.blob === 0, '音频为本地 blob，无外部链接', lc.blob);
  ok(lc.badge.indexOf('免费神经语音') >= 0, '标签显示免费神经语音', lc.badge);
  ok(String(lc.text).length > 0 && String(lc.text).length <= 600, '朗读文本在长度限制内', String(lc.text).length);
  ok(lc.req >= 2, '下一段已预取', lc.req);
  const lcp = await ev("(async()=>{window.__localFail=false;await MY.localProbe();" +
    "MY.renderChapter(0);MY.startSpeak(0);await new Promise(r=>setTimeout(r,80));" +
    "MY.toggleSpeak();const paused=MY.SPK.playing;const n=window.__audio.length;" +
    "await new Promise(r=>setTimeout(r,60));const still=window.__audio.length;" +
    "MY.toggleSpeak();await new Promise(r=>setTimeout(r,60));MY.stopSpeak(false);" +
    "return {paused:paused,still:still,n:n,resumed:MY.SPK.playing};})()");
  ok(lcp.paused === false && lcp.still === lcp.n, '本机音频暂停后不再播放', lcp);
  const lcf = await ev("(async()=>{window.__localFail=true;window.__spoken=[];MY.stopSpeak(false);" +
    "await MY.localProbe();MY.renderChapter(0);MY.startSpeak(0);await new Promise(r=>setTimeout(r,260));" +
    "MY.stopSpeak(false);" +
    "return {ready:MY.LOCAL.ready,spoken:window.__spoken.length,badge:document.getElementById('spQuality').textContent};})()");
  console.log('  local fallback:', JSON.stringify(lcf));
  ok(lcf.ready === false, '服务不可用后断开本机引擎', lcf);
  ok(lcf.spoken > 0, '已自动回退到系统语音继续朗读', lcf);
  ok(lcf.badge.indexOf('免费神经语音') < 0, '标签恢复为系统语音', lcf.badge);
  await ev("document.getElementById('btnCfg').click()");
  await shot('11_free_voice_settings');
  ok(await ev("!!document.querySelector('#modalBody [data-act=\"probe\"]')") === true, '设置含引擎重新检测');
  ok(await ev("(function(){const s=document.querySelector('#modalBody [data-set=\"localVoice\"]');return s?s.options.length:0;})()") === 11, '设置含 11 个精选免费音色');
  ok(await ev("(function(){return document.querySelectorAll('#modalBody [data-set=\"localVoice\"] optgroup').length;})()") === 1, '服务未连接时用内置精选声线（单组）');
  ok(await ev("(function(){return document.querySelector('#modalBody [data-set=\"localVoice\"]').textContent.indexOf('声线 12') >= 0;})()") === true, '下拉含 AISHELL3 多声线女声');
  ok(await ev("!!document.querySelector('#modalBody [data-set=\"localPort\"]')") === true, '设置含本机端口');
  ok(await ev("(function(){return document.querySelectorAll('#modalBody input[type=password]').length;})()") === 0, '设置中已无 API Key 输入框');
  await ev("document.getElementById('modalX').click()");
  const lv = await ev("(async()=>{window.__localFail=false;window.__localOn=true;window.__localReq=[];" +
    "MY.CFG.localOn=1;MY.CFG.pause=0;MY.CFG.localVoice='s20';await MY.localProbe();" +
    "MY.renderChapter(0);MY.startSpeak(0);await new Promise(r=>setTimeout(r,200));MY.stopSpeak(false);" +
    "return {v:window.__localReq[0]&&window.__localReq[0].body.voice,n:window.__localReq.length};})()");
  ok(lv.v === 's20' && lv.n >= 1, '切换到其它女声后按新音色合成', lv);
  const hv = await ev("(function(){MY.LOCAL.info={ok:true,voices:{s35:false,s140:false,s160:false,s170:false,s20:false,s3:false,s9:false,s6:false,s150:false}};" +
    "MY.CFG.localVoice='s20';MY.fixLocalVoice();const v=MY.CFG.localVoice;MY.showSettings();" +
    "const n=document.querySelector('#modalBody [data-set=\"localVoice\"]').options.length;" +
    "document.getElementById('modalX').click();MY.LOCAL.info=null;MY.CFG.localVoice='s12';MY.saveCfg();return {v:v,n:n};})()");
  ok(hv.v === 's12' && hv.n === 2, '缺模型的音色自动隐藏并回退到可用音色', hv);
  await ev("(function(){MY.showDoc('local');return 1;})()");
  ok(await ev("document.getElementById('modalBody').textContent.indexOf('174 个中文说话人')") >= 0, '免费语音说明已列出全部说话人');
  ok(await ev("document.getElementById('modalBody').textContent.indexOf('分角色朗读')") >= 0, '免费语音说明已写明分角色朗读');
  await ev("document.getElementById('modalX').click()");
  await ev("(function(){window.__localFail=false;window.__localOn=false;MY.CFG.localOn=0;MY.CFG.pause=120;MY.stopSpeak(true);return 1;})()");

  console.log('=== 备份 / 还原');
  const bak = await ev("(async()=>{window.__dl=[];const orig=URL.createObjectURL.bind(URL);" +
    "URL.createObjectURL=function(b){window.__dl.push(b);return orig(b);};" +
    "HTMLAnchorElement.prototype.click=function(){};" +
    "await MY.exportBak(false);const light=JSON.parse(await window.__dl[0].text());" +
    "await MY.exportBak(true);const full=JSON.parse(await window.__dl[1].text());" +
    "return {app:light.app,books:light.books.length,cfg:light.cfg.theme,secret:Object.keys(light.cfg).filter(k=>/key|token|secret/i.test(k)).join(','),keys:Object.keys(full.blobs).length," +
    "size:window.__dl[1].size};})()");
  console.log('  backup:', JSON.stringify(bak));
  ok(bak.app === 'MoYinReader', '备份文件标识');
  ok(bak.books >= 5, '备份含全部书籍元数据', bak.books);
  ok(bak.cfg === 'light', '备份含设置');
  ok(bak.secret === '', '设置中不含任何密钥字段', bak.secret);
  ok(bak.keys >= 5, '完整备份含书籍二进制', bak.keys);
  const imp = await ev("(async()=>{const j=JSON.parse(await window.__dl[1].text());" +
    "const f=new File([JSON.stringify(j)],'bak.json',{type:'application/json'});await MY.importBak(f);" +
    "return {n:MY.BOOKS.length,blobs:(await MY.dbAll('blobs')).length,books:(await MY.dbAll('books')).length};})()");
  console.log('  restore:', JSON.stringify(imp));
  ok(imp.n >= 5 && imp.blobs >= 5, '导入备份后元数据与二进制分离存储', imp);
  ok(imp.books === imp.blobs, '元数据/二进制数量一致（未覆盖）', imp);

  console.log('=== 窄屏 / 版式');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await ev('MY.closeBook()');
  await sleep(150);
  const narrow = await ev("({w:document.documentElement.scrollWidth,c:document.documentElement.clientWidth," +
    "disp:getComputedStyle(document.getElementById('libActs')).display,cols:getComputedStyle(document.getElementById('libActs')).gridTemplateColumns})");
  console.log('  narrow:', JSON.stringify(narrow));
  ok(narrow.w <= narrow.c + 2, '书架窄屏无横向溢出', narrow);
  ok(narrow.disp === 'grid', '按钮自动切换网格', narrow.disp);
  await shot('05_phone_shelf');
  await ev("(async()=>{await MY.openBook(MY.BOOKS.filter(x=>x.name==='zhongguo')[0].id);return 1;})()");
  const narrow2 = await ev("({w:document.documentElement.scrollWidth,c:document.documentElement.clientWidth,page:document.getElementById('page').getBoundingClientRect().width})");
  ok(narrow2.w <= narrow2.c + 2, '阅读器窄屏无横向溢出', narrow2);
  await ev("(function(){document.getElementById('toast').classList.remove('on');MY.startSpeak(0);return 1;})()");
  await sleep(120);
  await shot('08_phone_speaking');
  ok(await ev("document.getElementById('speakBar').classList.contains('on')") === true, '窄屏朗读条可见');
  await ev('MY.stopSpeak(true)');
  await shot('06_phone_read');
  await ev("(function(){const b=document.getElementById('btnLayout');b.click();return 1;})()");
  ok(['p', 'l'].indexOf(await ev('MY.CFG.lay')) >= 0, '版式手动切换');

  console.log('=== file:// 双击场景');
  const tab2 = JSON.parse(await get(CDP, '/json/new?about:blank', 'PUT'));
  const ws2 = new WebSocket(tab2.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws2.onopen = res; ws2.onerror = rej; });
  let s2 = 0; const p2 = new Map();
  ws2.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p2.has(m.id)) { const p = p2.get(m.id); p2.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
  const send2 = (method, params) => new Promise((res, rej) => { const id = ++s2; p2.set(id, { res, rej }); ws2.send(JSON.stringify({ id, method, params: params || {} })); });
  await send2('Page.enable');
  const FILEURL = 'file:///' + path.join(HERE, 'MoYinReader.html').replace(/\\/g, '/');
  await send2('Page.navigate', { url: FILEURL });
  let fileOK = false;
  for (let i = 0; i < 50; i++) {
    const r = await send2('Runtime.evaluate', { expression: "document.documentElement.getAttribute('data-ready')+'|'+(!!window.MY)", returnByValue: true });
    if (r.result && r.result.value === '1|true') { fileOK = true; break; }
    await sleep(150);
  }
  ok(fileOK, 'file:// 直接双击可运行（含 IndexedDB）', FILEURL);

  console.log('=== 运行时错误');
  ok(jsErrors.length === 0, '无 JS 异常 / console.error', jsErrors.slice(0, 4));

  console.log('\nPASS', pass, 'FAIL', fail);
  ws.close(); ws2.close();
  try { spawn('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  server.close();
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(2); });

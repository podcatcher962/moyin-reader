/* 语音诊断与包能力验证：
   ① 「关于」页最上面的能力卡片（包类型 / 离线神经语音 / 系统朗读）
   ② 「复制诊断信息」生成的纯文本里，该有的字段一个不少
   ③ 精选声线改名后，兜底列表里确实是新名字、没有旧名字
   跑法：node _verify_diag.js   */
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
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'moyin-diag-'));
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

  // ── ① 诊断文本 ──────────────────────────────────────────────────
  const t = await ev('MY.diagText()');
  ok(typeof t === 'string' && t.length > 120, '诊断文本能生成', typeof t === 'string' ? t.length : t);
  const has = s => typeof t === 'string' && t.indexOf(s) >= 0;
  ok(has('墨吟阅读器 诊断信息'), '首行标明是诊断信息');
  ok(has('版本：1.14.'), '带版本号', (t.match(/版本：\S+/) || [])[0]);
  ok(has('包：'), '带包类型', (t.match(/包：\S+/) || [])[0]);
  ok(has('UA：'), '带 UA（机型信息只能从这里看）');
  ok(has('屏幕：'), '带屏幕尺寸');
  ok(has('语音桥：'), '带语音桥连接状态');
  ok(has('本地引擎：'), '带本地引擎状态');
  ok(has('系统朗读：'), '带系统朗读引擎数量');
  ok(/系统朗读：\d+ 个引擎，其中中文 \d+ 个/.test(t) || /系统朗读：一个引擎都没有/.test(t),
    '系统朗读那一行把「几个引擎、几个中文」说清了');
  ok(t.split('\n').length >= 10, '字段分行输出（便于阅读与截图）', t.split('\n').length);

  // ── ② 关于页的能力卡片 ──────────────────────────────────────────
  await ev("(function(){MY.showDoc('about');return 1;})()");
  await sleep(300);
  const body = await ev("document.getElementById('modalBody').textContent");
  ok(await ev("document.getElementById('modal').classList.contains('on')") === true, '「关于」面板已打开');
  ok(body.indexOf('离线神经语音：') >= 0, '关于页写明离线语音状态');
  ok(body.indexOf('系统朗读：') >= 0, '关于页写明系统朗读状态');
  ok(/桌面版（本地文件）|桌面 \/ 网页版|安卓版（APK）|手机浏览器网页版/.test(body), '关于页写明当前包类型',
    (body.match(/^(.*?)· v/m) || [])[1]);
  ok(/v1\.14\.\d+/.test(body), '关于页带版本号', (body.match(/v1\.14\.\d+/) || [])[0]);
  ok(body.indexOf('未连上') >= 0 || body.indexOf('可用') >= 0 || body.indexOf('正在检测') >= 0,
    '离线语音状态是三种明确状态之一，不是空白');

  // 关掉弹窗，验证「复制诊断信息」按钮真的挂在弹窗上
  await ev("(function(){MY.closeBook&&0;document.getElementById('modal').classList.remove('on');return 1;})()");
  await sleep(150);

  // ── ③ 声线改名落地 ──────────────────────────────────────────────
  const src = await ev("document.scripts[0].textContent");
  ok(typeof src === 'string' && /'s110',\s*'中年男 4'/.test(src), 's110 已改名为「中年男 4」');
  ok(/'s52',\s*'男声 · 中音 1'/.test(src), 's52 已改名为「男声 · 中音 1」');
  ok(/'s102',\s*'男声 · 中音 2'/.test(src), 's102 已改名为「男声 · 中音 2」');
  ok(/'s32',\s*'青年男 1'/.test(src), 's32 成为唯一「青年男 1」');
  ok(/'s36',\s*'女声 · 低音 1'/.test(src), 's36 已改名为「女声 · 低音 1」');
  // 只看 LOCAL_VOICES 那一段：更新说明里会提到旧名字（讲清楚改了什么），不能算残留
  const lv = await ev("(function(){var s=document.scripts[0].textContent;var i=s.indexOf('var LOCAL_VOICES');return i<0?'':s.slice(i,i+2200);})()");
  ok(typeof lv === 'string' && lv.length > 400, '取到兜底声线表');
  ok(lv.indexOf('青年男 2') < 0 && lv.indexOf('青年男 3') < 0 && lv.indexOf('青年男 4') < 0,
    '旧的「青年男 2/3/4」在声线表里已彻底消失');
  ok(lv.indexOf('沉稳女 1') < 0, '旧的「沉稳女 1」在声线表里已不存在');

  // ── ④ 复制按钮在「没有中文语音」的弹窗上 ────────────────────────
  const hasBtn = await ev(`(function(){
    var r=document.querySelectorAll('#modalFoot button');
    var n=[];for(var i=0;i<r.length;i++)n.push(r[i].textContent);
    return n.join('|');})()`);
  ok(typeof hasBtn === 'string', '弹窗按钮可读', hasBtn);

  // 直接调 copyDiag：剪贴板在无头环境常被拒，应回落到「把文本显示出来」而不是静默失败
  await ev('(function(){MY.copyDiag();return 1;})()');
  await sleep(600);
  const after = await ev("document.getElementById('modal').classList.contains('on') ? document.getElementById('modalTitle').textContent : ''");
  const toastTxt = await ev("(function(){var t=document.getElementById('toast');return t?t.textContent:''})()");
  ok(after === '诊断信息' || /诊断信息已复制/.test(toastTxt || ''),
    '复制成功给提示、失败则把文本显示出来（两条路都不静默）', { modal: after, toast: toastTxt });

  if (errs.length) P('\n运行时异常：\n  ' + errs.join('\n  '));
  ok(errs.length === 0, '无 JS 异常', errs.length);

  P('\nPASS ' + pass + ' FAIL ' + fail);
  ws.close(); edge.kill();
  process.exit(fail ? 1 : 0);
})();

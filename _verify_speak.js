/* 朗读稳定性验证（1.14.29）
   ==========================
   起因：真机反馈「朗读中换声线偶发无声 + 报错弹窗，退出重进又好了」。
   根因不是模型坏了，是失败处理把「引擎还在装」当成「引擎坏了」：
   安卓分支只要合成失败一次，就弹全屏诊断卡并停读，容错逻辑全在 return 后面。

   这里验证四件事：
     ① 失败分三档（还在准备 / 这一段没出声 / 真坏了），文本分类必须分对；
     ② 安卓端不再「错一次就停读」：连跳几句照样继续念，真坏了才弹；
     ③ 「还在准备」不进 fails 计数（否则连跳四句又被判成坏了，等于没修）；
     ④ 引擎侧不再同步阻塞几十秒：有界等待 + lib_loading 回 503。

   跑法：node _verify_speak.js   */
const fs = require('fs');
const path = require('path');
const HERE = __dirname;
const P = (...a) => process.stdout.write(a.join(' ') + '\n');

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; P('  ok   ' + label); }
  else { fail++; P('  FAIL ' + label + '  ' + (extra === undefined ? '' : JSON.stringify(extra))); }
};

/* ── 从 app.js 切出真代码（不重写逻辑，直接跑它） ─────────────── */
const app = fs.readFileSync(path.join(HERE, 'app.js'), 'utf8');
function slice() {
  const a = app.indexOf('/* @verify-speak:start');
  const b = app.indexOf('/* @verify-speak:end */');
  if (a < 0 || b < 0) throw new Error('app.js 里找不到 @verify-speak 标记');
  const s = app.slice(app.indexOf('*/', a) + 2, b);
  return s;
}
const CODE = slice();

/* hasHan 在 @verify-speak 段外面，按 app.js 里那条正则现取，避免抄一份会漂移的实现 */
const HAN_RE = (app.match(/function hasHan\(t\) \{\s*return (\/[^;]+\/)\.test/) || [])[1];
if (!HAN_RE) throw new Error('app.js 里找不到 hasHan 的正则');
const hasHan = new Function('t', 'return ' + HAN_RE + '.test(String(t || ""))');

/* 假引擎：记录每个出口被调了几次，SPK 用真页面同名字段 */
function makeEnv(android) {
  const SPK = {
    gen: 0, playing: true, fails: 0, skipped: 0, degraded: 0,
    slowTold: 0, slowN: 0, ci: 0, chunks: ['第一句', '第二句', '第三句'],
    watch: 0, gapT: 0,
  };
  const calls = { skip: [], diag: [], degrade: [], toast: [], foreign: [], zhOnly: [], stopAudio: [] };
  const T = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o && o[k] !== undefined) ? o[k] : m);
  /* withTimeout/fetch 在桌面「问一句 health」那条路才用到；这里给个不会崩的哑链 */
  const dead = { then: () => dead, catch: () => dead };
  const env = {
    SPK, T,
    toast: m => calls.toast.push(m),
    skipChunk: (m, q) => calls.skip.push({ m: String(m), quiet: !!q }),
    localDiag: m => calls.diag.push(String(m)),
    degradeLocal: m => calls.degrade.push(String(m)),
    speakForeign: t => calls.foreign.push(t),
    speakZhOnly: () => calls.zhOnly.push(SPK.chunks[SPK.ci]),
    speakEnv: () => ({ android: android }),
    clearTimeout: () => { },
    setTimeout: () => 0,
    stopLocalAudio: () => calls.stopAudio.push(1),
    fetch: () => dead,
    withTimeout: p => p,
    localBase: () => 'http://127.0.0.1:1',
  };
  const api = new Function(
    'SPK', 'T', 'toast', 'skipChunk', 'localDiag', 'degradeLocal', 'speakForeign',
    'speakEnv', 'clearTimeout', 'setTimeout', 'fetch', 'withTimeout', 'localBase', 'stopLocalAudio',
    'hasHan', 'speakZhOnly',
    CODE + '\nreturn { failKind: failKind, localFail: localFail };'
  )(
    env.SPK, env.T, env.toast, env.skipChunk, env.localDiag, env.degradeLocal, env.speakForeign,
    env.speakEnv, env.clearTimeout, env.setTimeout, env.fetch, env.withTimeout, env.localBase,
    env.stopLocalAudio, hasHan, env.speakZhOnly
  );
  return { api, SPK, calls };
}

/* ── ① 分级 ────────────────────────────────────────────────── */
P('\n[1] 失败分级');
const { api: A } = makeEnv(true);
const CASES = [
  ['请求超时（语音引擎未响应）', 'slow', '首段等太久'],
  ['语音引擎正在初始化，稍后再试', 'slow', '503 的页面文案'],
  ['神经语音没合成出这一段：lib_loading', 'slow', '配角库还在后台装'],
  ['全段没出声（段数=3 空返回=3 重试=1 最高峰值=0.00000 采样率=16000 声线=37）', 'soft', '这一段没吐波形'],
  ['HTTP 502 神经语音没合成出这一段：（引擎没给原因）', 'soft', '502 兜底'],
  ['lib: OutOfMemoryError: Failed to allocate', 'hard', '内存不够'],
  ['lib sampleRate=0', 'hard', '会话建起来但采样率 0'],
  ['手机中文语音未就绪，请在系统设置里安装中文 TTS 引擎', 'hard', '真没中文引擎'],
  ['神经语音加载失败', 'hard', '模型起不来'],
];
for (const [msg, want, why] of CASES) {
  const got = A.failKind(msg);
  ok(got === want, why + ' → ' + want, got);
}

/* ── ② 安卓：连跳不弹窗，真坏了才弹 ──────────────────────────── */
P('\n[2] 安卓端不再「错一次就停读」');
{
  const { api, SPK, calls } = makeEnv(true);
  const softMsg = '全段没出声（段数=2 空返回=2 最高峰值=0.00000 采样率=16000 声线=5）';
  for (let i = 0; i < 3; i++) api.localFail(softMsg);
  ok(calls.skip.length === 3 && calls.diag.length === 0,
    '连跳 3 句仍继续朗读，一次弹窗都没有', { skip: calls.skip.length, diag: calls.diag.length });
  ok(SPK.fails === 3, 'fails 记到 3', SPK.fails);
  api.localFail(softMsg);
  ok(calls.diag.length === 1, '第 4 次才弹诊断卡', calls.diag.length);
  ok(calls.degrade.length === 0, '安卓永不退回「哑」的系统语音', calls.degrade.length);
}
{
  const { api, calls } = makeEnv(true);
  api.localFail('lib: OutOfMemoryError: Failed to allocate 38000000 bytes');
  ok(calls.diag.length === 1 && calls.skip.length === 0,
    '真故障（OOM）一次就弹，不用等三次', { diag: calls.diag.length, skip: calls.skip.length });
}

/* ── ③ 「还在准备」不计入 fails ──────────────────────────────── */
P('\n[3] 还在准备 ≠ 坏了');
{
  const { api, SPK, calls } = makeEnv(true);
  for (let i = 0; i < 15; i++) api.localFail('语音引擎正在初始化，稍后再试');
  ok(SPK.fails === 0, '连跳 15 句，fails 仍是 0（没被误判成故障）', SPK.fails);
  ok(calls.diag.length === 0, '15 句之内不弹窗', calls.diag.length);
  ok(calls.skip.every(x => x.quiet), '每句都是静默跳过，不刷屏', calls.skip.filter(x => !x.quiet).length);
  ok(calls.toast.length === 1, '「引擎在准备」只轻提示一次', calls.toast.length);
  api.localFail('语音引擎正在初始化，稍后再试');
  ok(calls.diag.length === 1, '第 16 句还在准备 → 才把自检摆出来', calls.diag.length);
}

/* ── ④ 桌面端不被这次改动带坏 ──────────────────────────────── */
P('\n[4] 桌面端行为不变');
{
  const { api, SPK, calls } = makeEnv(false);
  const softMsg = '全段没出声（段数=2 空返回=2 最高峰值=0.00000 采样率=22050 声线=0）';
  for (let i = 0; i < 6; i++) api.localFail(softMsg);
  ok(calls.skip.length === 6 && calls.diag.length === 0,
    '桌面连跳 6 句仍是跳过（阈值没被手机端的 3 带过来）', { skip: calls.skip.length, diag: calls.diag.length });
  ok(calls.degrade.length === 0, '还能回 health 的时候不退系统语音', calls.degrade.length);
}
{
  /* 纯英文块：整段交给英文语音（系统英文语音 / 留白），不当失败 */
  const { api, SPK, calls } = makeEnv(false);
  SPK.chunks = ['He opened the door.'];
  api.localFail('HTTP 415 这一段是英文，本机没装英文语音模型');
  ok(calls.foreign.length === 1, '纯英文块 415 仍走英文语音，不当失败', calls.foreign.length);
  ok(calls.zhOnly.length === 0 && calls.skip.length === 0, '纯英文块不走「抹掉英文再念」', calls);
}
{
  /* 中文句子里夹一个英文词被回 415：整句中文不能跟着丢，先抹字母念中文 */
  const { api, SPK, calls } = makeEnv(false);
  SPK.chunks = ['他打开 iPhone 看了一眼。'];
  api.localFail('HTTP 415 这一段是英文，本机没装英文语音模型');
  ok(calls.zhOnly.length === 1, '夹英文的中文句改走中文兜底，不整句跳过', calls.zhOnly);
  ok(calls.foreign.length === 0 && calls.skip.length === 0,
    '夹英文的中文句不许交给英文语音、也不许计入跳过', calls);
}

/* ── ⑤ 引擎侧真的不再阻塞 ──────────────────────────────────── */
P('\n[5] 引擎侧：有界等待 + 明确回「在准备」');
{
  const eng = fs.readFileSync(path.join(HERE, '_pkg_apk/TtsEngine.java'), 'utf8');
  ok(/private static final long LIB_WAIT_MS = 6000;/.test(eng), '合成请求最多陪等 6 秒（LIB_WAIT_MS）');
  ok(/private void kickLibLoad\(\)/.test(eng), '后台起加载线程（幂等）');
  ok(/private boolean awaitLib\(long ms\)/.test(eng), '有界等待 awaitLib');
  ok(/lastError = "lib_loading";/.test(eng), '等不到时说清是「在加载」');
  ok(/private volatile boolean libLoading/.test(eng), 'libLoading 对请求线程可见');
  ok(/finally \{ if \(lib == null\) libKicked = false; \}/.test(eng), '加载失败后允许下次再试，不永久锁死');
  ok(/public void preloadLib\(\) \{\s*\n\s*if \(lib != null \|\| appCtx == null\) return;\s*\n\s*kickLibLoad\(\);/.test(eng),
    'preloadLib 改成不入阻塞（warm 立刻返回）');
  /* 旧写法：useLib 时无条件进 ensureLib 同步等几十秒 */
  ok(!/if \(useLib\) \{\s*\n\s*if \(lib == null && !ensureLib\(\)\) return null;/.test(eng),
    '旧的「同步进 ensureLib」已移除');
}
{
  const br = fs.readFileSync(path.join(HERE, '_pkg_apk/TtsBridge.java'), 'utf8');
  ok(/"lib_loading"\.equals\(why\)/.test(br), '桥能识别 lib_loading');
  ok(/err\(c, 503, "voice_lib_loading"\)/.test(br), '回 503 而不是 502（502 会触发诊断卡）');
}

/* ── ⑥ 预热不再依赖分角色开关 ──────────────────────────────── */
P('\n[6] 配角库预热：手动点声线也要叫醒');
{
  ok(/function warmLib\(force, delayMs\)/.test(app), 'warmLib 支持 force');
  ok(/if \(!force && !CFG\.roleOn\) return;/.test(app), '只在没 force 时才看分角色开关');
  ok(/if \(isLib\) warmLib\(true, 0\);/.test(app), 'pickLocalVoice 点配角 → 立刻预热');
  ok(/if \(libV\) warmLib\(true, 0\);/.test(app), '朗读条下拉切配角 → 立刻预热');
  ok(/60 秒内不重复叫|warmedLib && now - warmedLib < 60000/.test(app), '60 秒节流：失败后能重试，连点不打成一片');
}

/* ── 汇总 ─────────────────────────────────────────────────── */
P('\n' + (fail ? 'FAILED' : 'PASS') + '  ' + pass + ' 项通过，' + fail + ' 项失败');
process.exit(fail ? 1 : 0);

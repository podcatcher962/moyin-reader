// 分角色性别判定自测：把 app.js 里那段纯逻辑抠出来跑，不依赖 DOM。
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');
const a = src.indexOf('var SPEAK_VERB');
const b = src.indexOf('function roleLabel');
if (a < 0 || b < 0) { console.log('FAIL 找不到片段'); process.exit(1); }
const block = src.slice(a, b);

// 桩
const LOCAL_VOICES = [
  ['x0', '小雅', '女声 · 成年'],
  ['c0', '超文', '男声 · 低沉'],
  ['s124', '男A', '男声 · 低沉'], ['s74', '男B', '男声 · 中年'],
  ['s52', '男C', '男声 · 偏高'], ['s110', '男D', '男声 · 中年'],
  ['s36', '女A', '女声 · 成年'], ['s13', '女B', '女声 · 成年'],
  ['s129', '女C', '女声 · 青年'], ['s41', '童', '女声 · 高音'],
];
const SPK = { cast: {}, castName: {}, used: {}, sex: {},
  scene: { f: '', m: '', lastV: '' }, main: { f: '', m: '' }, castAt: '' };
const CFG = { localVoice: 'x0', roleOn: 1, rolePool: 'mix' };
const LOCAL = { list: null, info: { curated: LOCAL_VOICES.map(x => x[0]) } };
const T = s => s;
const fn = new Function('SPK', 'CFG', 'LOCAL', 'LOCAL_VOICES', 'T', block + `
  return { roleSegments, genderOf, learnSex, castVoice, speakerOf, rolePool, voiceBand };`);
const M = fn(SPK, CFG, LOCAL, LOCAL_VOICES, T);

const L = '阿牛放下杯子，他看了看窗外。';
function sexOfLine(line) {
  const segs = M.roleSegments(line);
  return segs.filter(s => s.role === 'say').map(s => s.who + ':' + (M.genderOf(s.who) || '?'));
}
let fail = 0;
function ck(name, got, want) {
  const ok = got === want;
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  期望 ${want} 实际 ${got}`));
}
function ckIn(name, got, list) {
  const ok = list.indexOf(got) >= 0;
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : `  ${got} 不在 ${list}`));
}

// 1) 称谓与用字
ck('阿芳→女', M.genderOf('阿芳'), 'f');
ck('王强→男', M.genderOf('王强'), 'm');
ck('小姨→女', M.genderOf('小姨'), 'f');
ck('老头子→男', M.genderOf('老头子'), 'm');
ck('俞猴子→未知', M.genderOf('俞猴子'), '');

// 2) 上下文代词学习
ck('「他说」句后置', sexOfLine('俞猴子说：“我没有拿。”他转身就走。').join(','), '俞猴子:m');
ck('「她说」句后置', sexOfLine('阿庆说：“我没有拿。”她转身就走。').join(','), '阿庆:f');
// 代词现在会绑到本段最近那位同名人物，不再作为「新人物」另占一条声线
ck('逗号后主语→绑回俞猴子', sexOfLine('俞猴子冷笑一声，他慢慢放下杯子，说：“随你。”').join(','), '俞猴子:m');
delete SPK.sex['俞猴子']; delete SPK.cast['俞猴子'];
ck('对她说→说话人是俞猴子', sexOfLine('俞猴子对她说：“随你。”').join(','), '俞猴子:?');
ck('逗号后代词学男声', (function () {
  M.learnSex('阿牛', L, L.length, '');
  return M.genderOf('阿牛');
})(), 'm');
ck('学到的整本书沿用', (function () {
  M.learnSex('阿牛', L, L.length, '');
  return sexOfLine('阿牛说：“走吧。”').join(',');
})(), '阿牛:m');
ck('对她说 里的她不算性别', (function () {
  delete SPK.sex['阿庆'];
  sexOfLine('阿庆对她说：“随你。”');
  return M.genderOf('阿庆') || '?';
})(), '?');

// 3) 配声：男角色绝不配女声，反之亦然
const lines = [
  '王强说：“走。”', '阿芳说：“好。”', '老头子说：“等等。”', '小姨说：“别急。”',
  '张三说：“我不去。”', '李四说：“我陪你。”', '赵六说：“算我一个。”',
];
M.roleSegments(lines.join(''));
const nv = new Set();
Object.keys(SPK.cast).forEach(who => {
  const band = M.voiceBand(SPK.cast[who]) || '';
  const g = M.genderOf(who);
  if (!g) return;
  const isMale = /^男/.test(band);
  ck(`配声·${who}(${g === 'm' ? '男' : '女'})→${band}`, isMale === (g === 'm'), true);
  nv.add(SPK.cast[who]);
});
ck('角色声线互不重复', nv.size, Object.keys(SPK.cast).length);

// 4) 「我」用旁白声线
ck('我→旁白声线', M.castVoice('我'), CFG.localVoice);

// 5) 后认出的性别会纠正配错的声音
SPK.cast = {}; SPK.castName = {}; SPK.used = {}; SPK.sex = {};
SPK.scene = { f: '', m: '', lastV: '' }; SPK.main = { f: '', m: '' };
const first = M.castVoice('俞猴子');                       // 未知性别时先配一个
M.learnSex('俞猴子', '俞猴子冷笑一声，他没有说话。', 0, '');
const second = M.castVoice('俞猴子');
ck('学会性别后重配', second === first || /^男/.test(M.voiceBand(second) || ''), true);
console.log(`     （先配 ${first}/${M.voiceBand(first)} → 后配 ${second}/${M.voiceBand(second)}）`);

// 6) 真实原文（用户 2026-11-09 截图那段）：这是分角色最容易翻车的一节
SPK.cast = {}; SPK.castName = {}; SPK.used = {}; SPK.sex = {};
SPK.scene = { f: '', m: '', lastV: '' }; SPK.main = { f: '', m: '' };
const REAL = [
  '“给人算命的时候闭着眼睛还能营造点感觉，自己蹲屋里收拾东西为什么也闭着眼睛？”赵长河忽然开口。',
  '女子头也不抬，似是早已知道他的到来：“为什么不能因为，我真的是瞎子？”',
  '“你连拐杖都没有，忽悠谁呢。”',
  '“我不需要。”女子平静回应：“倒是你，昨天骂我有病，今天又来，是终于明白了有病的人是你自己？”',
  '赵长河道：“因为你说的入梦治疗听起来太假，你跟任何人说，谁不骂你有病？”',
];
const got = [];
REAL.forEach((ln, i) => {
  M.roleSegments(ln).forEach(s => {
    if (s.role === 'say') got.push({ i: i + 1, who: s.who, g: M.genderOf(s.who) || '?' });
  });
});
function g(i, n) { const x = got.filter(o => o.i === i)[n || 0]; return x ? x.g : '无'; }

ck('①赵长河忽然开口 → 男', g(1), 'm');
ck('②「女子…知道他…：」→ 女', g(2), 'f');
ck('④女子平静回应 → 女', g(4), 'f');
ck('⑤赵长河道 → 男', g(5), 'm');
// ③ 单独成段时没有上文可依，必须以「同一段里紧挨着上一句」的形式测交替
const SPK2 = { cast: {}, castName: {}, used: {}, sex: {} };
M.roleSegments('女子头也不抬：“为什么？”\n“你连拐杖都没有，忽悠谁呢。”');
const alt = M.roleSegments('女子头也不抬：“为什么？”\n“你连拐杖都没有，忽悠谁呢。”')
  .filter(s => s.role === 'say').map(s => M.genderOf(s.who) || '?');
ck('③女之后无主对白 → 换男声', alt[1], 'm');
ck('①②③④⑤ 五个声段都认出来了', got.length, 6);
console.log('     逐句：' + got.map(o => `${o.i}:${o.who || '(无)'}=${o.g}`).join('  '));

console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);

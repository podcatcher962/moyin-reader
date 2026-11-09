// 声线稳定性自测：同一个人物在整本书里只能有一个声音；
// 认不出说话人时应当沿用上一位，而不是从池子里换一个新声音；
// 开口之前人物表要先定好（buildCast），播到哪儿都不许临时改嗓子。
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');
const a = src.indexOf('var SPEAK_VERB');
const b = src.indexOf('function roleLabel');
const block = src.slice(a, b);

const LOCAL_VOICES = [
  ['x0', '小雅', '女声 · 成年'],
  ['c0', '超文', '男声 · 低沉'],
  ['s124', '男A', '男声 · 低沉'], ['s74', '男B', '男声 · 中年'],
  ['s52', '男C', '男声 · 偏高'], ['s110', '男D', '男声 · 中年'],
  ['s36', '女A', '女声 · 成年'], ['s13', '女B', '女声 · 成年'],
  ['s129', '女C', '女声 · 青年'], ['s41', '童', '女声 · 高音'],
];
const SPK = {
  cast: {}, castName: {}, used: {}, sex: {},
  scene: { f: '', m: '', lastWho: '', lastV: '' }, main: { f: '', m: '' }, castAt: '', pre: {},
};
const CFG = { localVoice: 'x0', roleOn: 1, rolePool: 'mix' };
const LOCAL = { list: null, info: { curated: LOCAL_VOICES.map(x => x[0]) } };
const T = s => s;
const BOOK_CHAPTERS = [
  ['“给人算命的时候闭着眼睛还能营造点感觉，自己蹲屋里收拾东西为什么也闭着眼睛？”赵长河忽然开口。',
    '女子头也不抬，似是早已知道他的到来：“为什么不能因为，我真的是瞎子？”',
    '“你连拐杖都没有，忽悠谁呢。”',
    '“我不需要。”女子平静回应：“倒是你，昨天骂我有病，今天又来，是终于明白了有病的人是你自己？”',
    '赵长河道：“因为你说的入梦治疗听起来太假，你跟任何人说，谁不骂你有病？”'].join('\n'),
  ['“你昨天不是说，入梦能治吗？”',
    '“那是以前。”她合上账本，“现在我自己都不信了。”',
    '赵长河沉默了一会儿，忽然问：“那你打算怎么办？”',
    '女子把算盘推到一边：“先把你自己的梦说清楚。”'].join('\n'),
];
const BK = { ch: 0, meta: {}, chapterText: i => BOOK_CHAPTERS[i] || '' };
const localReady = () => true;
const chapterCount = () => BOOK_CHAPTERS.length;
let savedCount = 0;
const savePos = () => { savedCount++; };

const fn = new Function('SPK', 'CFG', 'LOCAL', 'LOCAL_VOICES', 'T',
  'BK', 'localReady', 'chapterCount', 'savePos', block + `
  return { roleSegments, genderOf, learnSex, castVoice, speakerOf, rolePool, voiceBand, resetCast, buildCast, castNames };`);
const M = fn(SPK, CFG, LOCAL, LOCAL_VOICES, T, BK, localReady, chapterCount, savePos);

const BOOK = BOOK_CHAPTERS[0].split('\n').concat(BOOK_CHAPTERS[1].split('\n'));

// 和 prefPara 完全同样的口径：旁白若有归属人（「女子平静回应：」）用那个人的声音
function para(pi, text) {
  const rows = [];
  M.roleSegments(text).forEach(s => {
    const v = s.role === 'say' ? M.castVoice(s.who)
      : (s.vWho ? M.castVoice(s.vWho) : CFG.localVoice);
    rows.push({ role: s.role, who: s.who || s.vWho || '', v: v, t: s.t.slice(0, 20) });
  });
  return rows;
}

let fail = 0;
function ck(name, ok, extra) {
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + (extra || '')));
}

// 1) 开口之前先把人物表定好
M.buildCast(0);
const table = Object.assign({}, SPK.cast);
console.log('人物表：' + Object.keys(table).map(k => `${k}=${table[k]}`).join('  '));
ck('主要人物都配了声线', Object.keys(table).length >= 2, JSON.stringify(table));
ck('人物表写进书里', !!BK.meta.cast && Object.keys(BK.meta.cast).length === Object.keys(table).length, JSON.stringify(BK.meta.cast));

// 2) 读一遍，同一个人只能一个声音
let all = [];
BOOK.forEach((t, i) => { all = all.concat(para(i, t).map(r => Object.assign({ pi: i }, r))); });
all.forEach(r => {
  console.log(`${r.pi + 1} ${r.role === 'narr' ? '旁白' : '对白'}  ${(r.who || '-').padEnd(8)} ${String(r.v).padEnd(6)} ${r.t}`);
});
const seen = {};
all.filter(r => r.role === 'say' && r.who).forEach(r => {
  if (seen[r.who] && seen[r.who] !== r.v) {
    fail++; console.log(`FAIL 同名不同声：${r.who} 用过 ${seen[r.who]}，第 ${r.pi + 1} 段变成 ${r.v}`);
  }
  seen[r.who] = r.v;
});

// 3) 无人认领的对白必须沿用上一位，不许自己换声
let lastV = null;
all.forEach(r => {
  if (r.role !== 'say') return;
  if (!r.who) {
    if (lastV && r.v !== lastV) { fail++; console.log(`FAIL 无主对白换声：第 ${r.pi + 1} 段 ${lastV} → ${r.v}`); }
  } else lastV = r.v;
});

// 4) 男声女声不许配错
all.filter(r => r.role === 'say' && r.who && M.genderOf(r.who)).forEach(r => {
  const isMale = /^男/.test(M.voiceBand(r.v) || '');
  if (isMale !== (M.genderOf(r.who) === 'm')) {
    fail++; console.log(`FAIL 性别配错：${r.who}(${M.genderOf(r.who)}) → ${r.v}/${M.voiceBand(r.v)}`);
  }
});

// 5) 用户那段原文的关键判断
const line = (i, n) => { const x = all.filter(o => o.pi === i); return x[n || 0]; };
ck('①赵长河忽然开口 = 赵长河(男)', !!line(0) && line(0).who === '赵长河' && M.genderOf(line(0).who) === 'm', line(0) && line(0).who);
ck('②女子 = 女', !!line(1, 1) && M.genderOf(line(1, 1).who) === 'f', line(1, 1) && line(1, 1).who);
ck('③无主对白 = 男（不是新嗓子）', !!line(2) && M.genderOf(line(2).who) === 'm', line(2) && line(2).who);
ck('④女子平静回应 = 女子', !!line(3, 2) && line(3, 2).who === '女子', line(3, 2) && line(3, 2).who);
ck('⑤赵长河道 = 赵长河', !!line(4, 1) && line(4, 1).who === '赵长河', line(4, 1) && line(4, 1).who);
ck('⑥「她」绑到女子，不另起一个女声', !!line(6, 1) && line(6, 1).who === '女子', line(6, 1) && line(6, 1).who);
ck('⑦「女子平静回应：」用她自己的声音', !!line(3, 1) && line(3, 1).v === SPK.cast['女子'], line(3, 1) && line(3, 1).v);

// 6) 换章补人物：老人物的声线一个都不许变
const before = Object.assign({}, SPK.cast);
M.buildCast(1);
Object.keys(before).forEach(k => ck(`换章后 ${k} 声线不变`, SPK.cast[k] === before[k], `${before[k]} → ${SPK.cast[k]}`));

console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);

// 纯标点自测：符号块既不能送去合成（引擎会回 empty text），
// 也不能被当成「引擎坏了」切回系统语音；它只该按长度留一段空白。
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');
const a = src.indexOf('function sayable');
const b = src.indexOf('/* ---------------- 分角色朗读');
if (a < 0 || b < 0) { console.log('抽取失败：找不到 sayable / 分角色分隔注释'); process.exit(1); }
const block = src.slice(a, b);
const M = new Function(block + '\nreturn { sayable, punctPause, normSpeak, splitSpeak };')();

let fail = 0;
function ck(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log('FAIL ' + name + ' → ' + JSON.stringify(got) + ' ≠ ' + JSON.stringify(want)); }
  else console.log('ok   ' + name);
}

// ① 纯符号块认得出「没有字可念」
ck('“？”不可念', M.sayable('？'), false);
ck('“……”不可念', M.sayable('……'), false);
ck('“——！”不可念', M.sayable('——！'), false);
ck('空白不可念', M.sayable(' 　'), false);
ck('普通句子可念', M.sayable('你连拐杖都没有。'), true);
ck('数字可念', M.sayable('3.5'), true);
ck('英文可念', M.sayable('OK'), true);

// ② 停顿随符号长度增长，但有上限
const p1 = M.punctPause('？'), p3 = M.punctPause('？？？'), p8 = M.punctPause('？？？？？？？？');
ck('单个问号约 0.34 秒', p1, 340);
ck('三个问号约 0.66 秒', p3, 660);
ck('超长符号封顶 0.82 秒', p8, 820);
ck('越多越长', p3 > p1 && p8 >= p3, true);

// ③ 整段只有符号时，切出来的块一个可念的字都没有（→ 播放时按长度留白，不送合成）
const only = M.splitSpeak('？？？……', 30);
ck('整段符号切成的块不可念', only.map(M.sayable), [false]);
ck('整段符号没有可念块', only.filter(M.sayable).length, 0);

// ④ 符号夹在句子中间时，仍跟句子一起成块：服务端按标点自己给停顿，
//    不需要我们提前拆开（拆开反而会多一次合成请求）
const sen = M.splitSpeak('“我不需要。”“？？？”“你走吧。”', 30);
ck('短句合成一块', sen.length, 1);
ck('夹着符号的句子照常可念', M.sayable(sen[0]), true);

console.log(fail ? `\n${fail} 项失败` : '\n全部通过');
process.exit(fail ? 1 : 0);

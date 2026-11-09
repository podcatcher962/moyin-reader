// 英文/外文块自测：中文模型一个英文字母都不认识，纯外文块必须能被认出来，
// 好交给系统英文语音；中英混排、纯标点、纯数字都不能被误判成外文。
const fs = require('fs');
const src = fs.readFileSync('app.js', 'utf8');
const a = src.indexOf('function sayable');
const b = src.indexOf('/* ---------------- 分角色朗读');
if (a < 0 || b < 0) { console.log('抽取失败'); process.exit(1); }
const M = new Function(src.slice(a, b) + '\nreturn { hasHan, hasLatin, foreignOnly, sayable };')();

let fail = 0;
function ck(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log('FAIL ' + name + ' → ' + JSON.stringify(got) + ' ≠ ' + JSON.stringify(want)); }
  else console.log('ok   ' + name);
}

// ① 认得出纯外文
ck('Hello world 是外文', M.foreignOnly('Hello world'), true);
ck('OK 是外文', M.foreignOnly('OK'), true);
ck('iPhone 15 Pro Max 是外文', M.foreignOnly('iPhone 15 Pro Max'), true);

// ② 中文、混排、标点、数字都不是外文
ck('中文不是外文', M.foreignOnly('他打开手机'), false);
ck('中英混排不是外文', M.foreignOnly('他打开 iPhone 看了一眼'), false);
ck('纯标点不是外文', M.foreignOnly('？？？'), false);
ck('纯数字不是外文', M.foreignOnly('12345678'), false);
ck('空串不是外文', M.foreignOnly(''), false);

// ③ 汉字识别
ck('含汉字', M.hasHan('第 3 章 Hello'), true);
ck('不含汉字', M.hasHan('Hello world'), false);
ck('扩展区汉字算汉字', M.hasHan('\u3400'), true);

// ④ 外语块与「可念」不冲突：字母是可念的（走英文语音），标点不是
ck('外文块 sayable 为真', M.sayable('Hello'), true);
ck('外文块同时是外文', M.foreignOnly('Hello'), true);

console.log(fail === 0 ? '全部通过' : fail + ' 项失败');
process.exit(fail === 0 ? 0 : 1);

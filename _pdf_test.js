/* 用真实 PDF 跑 pdfbook.js（Node 里直接跑，不走浏览器） */
const fs = require('fs');
const pdfjs = require('./_vendor/pdfjs/pdf.min.js');
const PB = require('./pdfbook.js');

const file = process.argv[2];
const data = new Uint8Array(fs.readFileSync(file));
const t0 = Date.now();
PB.build(data, '测试书', { lib: pdfjs, T: (s) => s })
  .then((r) => {
    console.log('页数', r.pages, '章节', r.titles.length, '字数', r.text.length, '耗时', Date.now() - t0, 'ms');
    console.log('质量', r.quality, 'en?', r.en);
    r.titles.forEach((t, i) => {
      console.log('  [' + i + '] ' + t + '  段数=' + r.body[i].length);
    });
    console.log('--- 第 1 章前 6 段');
    r.body[0].slice(0, 6).forEach((l) => console.log('  |' + l));
  })
  .catch((e) => { console.log('拒绝：' + e.code + ' ' + e.message); });

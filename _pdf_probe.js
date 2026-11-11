/* 试跑：用 PDF.js 从真实 PDF 里抽文字，看中文/英文行能不能拿全。
   只在开发机上跑，不进任何发行包。 */
const fs = require('fs');
const path = require('path');
const pdfjs = require('./_vendor/pdfjs/pdf.min.js');

(async () => {
  const file = process.argv[2];
  const data = new Uint8Array(fs.readFileSync(file));
  const t0 = Date.now();
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false, isEvalSupported: false }).promise;
  console.log('pages', doc.numPages, 'load ms', Date.now() - t0);
  const pages = Math.min(doc.numPages, Number(process.argv[3] || 3));
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = {};
    let n = 0;
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] / 2) * 2;
      (lines[y] = lines[y] || []).push([it.transform[4], it.str]);
      n++;
    }
    const ys = Object.keys(lines).map(Number).sort((a, b) => b - a);
    console.log('--- page', p, 'items', n, 'lines', ys.length);
    ys.slice(0, 12).forEach((y) => {
      const row = lines[y].sort((a, b) => a[0] - b[0]).map((x) => x[1]).join('');
      console.log('  |' + row.slice(0, 90));
    });
  }
})().catch((e) => { console.error('ERR', e && e.stack || e); process.exit(1); });

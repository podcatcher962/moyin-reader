/* Node 单测：ZIP 全量条目 + DEFLATE 与 zlib 对照 + 路径解析 */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const HERE = __dirname;
const Z = new Function(fs.readFileSync(path.join(HERE, 'zipcore.js'), 'utf8') + '\nreturn MYZip;')();
const sha = b => crypto.createHash('sha256').update(Buffer.from(b)).digest('hex');
const expect = JSON.parse(fs.readFileSync(path.join(HERE, '_samples', 'expect.json'), 'utf8'));

let pass = 0, fail = 0;
function ok(cond, label, extra) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', label, extra || ''); } }

for (const book of expect) {
  const buf = fs.readFileSync(book.path);
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const zip = Z.makeZip(u8);
  console.log('===', book.book, 'entries:', zip.names.length);
  // ZIP 里可能带目录条目，期望值只统计文件
  ok(zip.names.filter(n => !n.endsWith('/')).length === book.allsha.length, '条目数', zip.names.length + ' vs ' + book.allsha.length);
  for (const e of book.allsha) {
    let got;
    try { got = zip.read(e.n); } catch (err) { fail++; console.log('  FAIL read', e.n, err.message); continue; }
    if (got === null) { fail++; console.log('  FAIL missing', e.n); continue; }
    ok(got.length === e.u && sha(got) === e.s, 'read ' + e.n, got.length + '/' + e.u + ' ' + sha(got).slice(0, 12));
  }
  for (const p of book.picks) {
    if (p.m !== 8 || !p.deflate) continue;
    const d = new Uint8Array(Buffer.from(p.deflate, 'base64'));
    const mine = Z.inflateRaw(d, p.ulen);
    const node = zlib.inflateRawSync(Buffer.from(d));
    ok(mine.length === node.length, 'inflate len ' + p.name, mine.length + '/' + node.length);
    ok(sha(mine) === sha(node), 'inflate == zlib ' + p.name, sha(mine).slice(0, 12));
    ok(sha(mine) === p.sha, 'inflate == expect ' + p.name);
  }
  console.log('  container:', (zip.text('META-INF/container.xml') || '').match(/full-path="([^"]+)"/)?.[1]);
}

// 路径解析
const rp = Z.resolvePath;
ok(rp('OEBPS/Text', '../Images/a.jpg') === 'OEBPS/Images/a.jpg', 'resolve ..');
ok(rp('OEBPS/Text', '/OPS/ch1.xhtml') === 'OPS/ch1.xhtml', 'resolve absolute');
ok(rp('OEBPS/Text', 'ch1.xhtml#p3') === 'OEBPS/Text/ch1.xhtml', 'resolve anchor');
ok(rp('OEBPS/Text', 'a%20b%2Ec.jpg') === 'OEBPS/Text/a b.c.jpg', 'resolve uri');
ok(rp('', 'META-INF/container.xml') === 'META-INF/container.xml', 'resolve root');

// TXT 编码
const utf8 = Buffer.from('第一章 试读\n这是中文内容。', 'utf8');
ok(Z.decodeTxt(utf8).text.includes('第一章'), 'txt utf8');
ok(Z.decodeTxt(utf8).enc.indexOf('UTF-8') === 0, 'txt utf8 enc', Z.decodeTxt(utf8).enc);
const gbk = Buffer.from([0xb5, 0xda, 0xd2, 0xbb, 0xd5, 0xc2, 0x20, 0xca, 0xd4, 0xb6, 0xc1]); // 第一章 试读 GBK
ok(Z.decodeTxt(gbk).text.includes('第一章'), 'txt gbk fallback', JSON.stringify(Z.decodeTxt(gbk).text));
const bom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), utf8]);
ok(!Z.decodeTxt(bom).text.startsWith('\uFEFF'), 'txt BOM stripped');

console.log('\nPASS', pass, 'FAIL', fail);
process.exit(fail ? 1 : 0);

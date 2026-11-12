/* ============================================================
   DOCX / MOBI / AZW3 正文抽取
   ------------------------------------------------------------
   这三种格式都是「容器 + 标记」的结构，真正要的只是里面的字：

     DOCX   = ZIP 里的一份 word/document.xml（OOXML）
     MOBI   = Palm PDB 容器 + 若干条 PalmDOC 压缩的 HTML 记录
     AZW3   = MOBI 的 KF8 变体，容器与压缩方式相同，只是排版引擎换了

   所以这里的活很单一：把正文抠出来变成纯文本，交回给阅读器当 TXT 用——
   章节识别、朗读、划词、笔记、进度全部沿用现成那一套，不为格式分叉。

   明确不做的：DOCX 的复杂表格排版、MOBI 的插图、AZW3 的 KF8 样式。
   那些属于「排版还原」，不是阅读器该替用户决定的事；字在、顺序对，就够了。
   ============================================================ */
(function (root) {
  'use strict';

  function u16(dv, o) { return dv.getUint16(o, false); }
  function u32(dv, o) { return dv.getUint32(o, false); }

  /* ---------------- DOCX ---------------- */

  /** 段落里的字：w:t 是文本，w:tab 是制表符，w:br 是软换行，w:delText 是修订删除（跳过）。 */
  function paraText(p) {
    var s = '';
    (function walk(n) {
      var kids = n.childNodes || [];
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c.nodeType !== 1) continue;
        var ln = c.localName || String(c.nodeName || '').replace(/^.*:/, '');
        if (ln === 't') s += c.textContent || '';
        else if (ln === 'tab') s += '\t';
        else if (ln === 'br' || ln === 'cr') s += '\n';
        else if (ln === 'delText' || ln === 'instrText') continue;
        else walk(c);
      }
    })(p);
    return s.replace(/[ \t]+$/gm, '').trim();
  }

  function cut(o, max) {
    o = String(o || '');
    return o.length > max ? o.slice(0, max) : o;
  }

  function docxToText(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var perr = doc && doc.getElementsByTagName ? doc.getElementsByTagName('parsererror') : null;
    if (!doc || !doc.documentElement || (perr && perr.length)) {
      throw new Error('这个 .docx 的正文不是合法 XML，可能文件损坏');
    }
    /* 前缀一般是 w:，但也有用别的命名空间的（WPS 导出的见过），两种都试 */
    var ps = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS('*', 'p') : null;
    if (!ps || !ps.length) ps = doc.getElementsByTagName('w:p');
    var out = [], i;
    for (i = 0; i < ps.length; i++) {
      var t = paraText(ps[i]);
      if (t) out.push(t);
      else if (out.length && out[out.length - 1] !== '') out.push('');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function docx(buf, env) {
    var Z = env.Z;
    if (!Z || !Z.makeZip) throw new Error('ZIP 组件没加载，读不了 DOCX');
    var zip = Z.makeZip(new Uint8Array(buf));
    var names = zip.names || [];
    var n = names.filter(function (x) { return /^word\/document\.xml$/i.test(x); })[0]
      || names.filter(function (x) { return /(^|\/)document\.xml$/i.test(x); })[0];
    /* 老 .doc（97-2003 二进制）没有 ZIP 结构，打开会在这里露馅 */
    if (!n) throw new Error('这个文件里没有 word/document.xml —— 多半是老版 .doc 改了扩展名，请用 Word / WPS 另存为 .docx');
    var xml = zip.text(n);
    if (!xml) throw new Error('解压 DOCX 正文失败');
    var text = docxToText(xml);
    if (!text || text.replace(/\s/g, '').length < 2) throw new Error('这本 DOCX 里没有文字——整篇是图片或扫描件，读不了');
    var title = '';
    try {
      var core = zip.text(names.filter(function (x) { return /docProps\/core\.xml$/i.test(x); })[0]);
      if (core) { var m = core.match(/<dc:title>([\s\S]*?)<\/dc:title>/i); if (m) title = m[1].trim(); }
    } catch (e) { }
    return { text: text, kind: 'docx', title: title, enc: '' };
  }

  /* ---------------- PalmDOC 解压 ---------------- */

  /** Kindle 用的 LZ77 变体：0x00 原样、0x01-0x08 复制 n 字节、0x09-0x7F 直接输出、
   *  0x80-0xBF 是「距离 + 长度」回指、0xC0-0xFF 是「空格 + 一个字节」。 */
  function palmdoc(data) {
    var out = [], i = 0, n = data.length, b, b2, v, dist, len, st, k;
    while (i < n) {
      b = data[i++];
      if (b === 0) { out.push(0); }
      else if (b <= 8) { for (k = 0; k < b; k++) out.push(data[i++]); }
      else if (b <= 0x7f) { out.push(b); }
      else if (b <= 0xbf) {
        b2 = data[i++] || 0;
        v = (b << 8) | b2;
        dist = (v >> 3) & 0x7ff;
        len = (v & 7) + 3;
        if (dist === 0) { out.push(32); continue; }
        st = out.length - dist;
        if (st < 0) { /* 越界：数据坏了，跳过这一段 */ }
        else for (k = 0; k < len; k++) out.push(out[st + k]);
      } else { out.push(32); out.push(b ^ 0x80); }
    }
    return new Uint8Array(out);
  }

  /* ---------------- MOBI / AZW3 ---------------- */

  function decodeEnt(s) {
    var map = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…', middot: '·', times: '×', ensp: ' ', emsp: ' ' };
    return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (m, k) {
      if (k.charAt(0) === '#') {
        var cp = k.charAt(1) === 'x' || k.charAt(1) === 'X'
          ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        return (cp > 0 && cp < 0x110000) ? String.fromCodePoint(cp) : '';
      }
      var v = map[k.toLowerCase()];
      return v === undefined ? m : v;
    });
  }

  /** MOBI 里的正文是 HTML 片段，按块级标签断行后去掉所有标签。
   *  插图、filepos 跳转、字体样式都不需要——这里只要句子。 */
  function htmlToText(h) {
    h = h.replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ');
    h = h.replace(/<\s*mbp:pagebreak\b[^>]*>/gi, '\n');
    h = h.replace(/<\s*\/?\s*(p|div|br|hr|h[1-6]|li|tr|section|article|blockquote|figcaption|dd|dt)\b[^>]*>/gi, '\n');
    h = h.replace(/<[^>]*>/g, '');
    h = decodeEnt(h);
    h = h.replace(/\r\n?/g, '\n');
    h = h.replace(/[ \t\u00a0\u3000]+/g, ' ');
    h = h.replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
    return h.trim();
  }

  function mobi(buf, env) {
    var u8 = new Uint8Array(buf), len = u8.length;
    if (len < 100) throw new Error('这个文件太小，不是完整的 MOBI');
    var dv = new DataView(buf);
    var numRec = u16(dv, 76);
    if (!numRec || 78 + numRec * 8 > len) throw new Error('MOBI 的记录表不完整，可能文件被截断');

    /* 记录偏移表：每条 8 字节，前 4 字节是偏移，后 4 字节是属性 */
    var offs = [], i;
    for (i = 0; i < numRec; i++) offs.push(u32(dv, 78 + i * 8));
    function rec(i) {
      var a = offs[i], b = (i + 1 < numRec) ? offs[i + 1] : len;
      if (a >= len || b > len || b < a) return new Uint8Array(0);
      return u8.subarray(a, b);
    }

    var r0 = rec(0);
    if (r0.length < 24) throw new Error('MOBI 头不完整，读不了这本');
    var d0 = new DataView(r0.buffer, r0.byteOffset, r0.length);
    var compression = u16(d0, 0);
    var textLen = u32(d0, 4);
    var textRecs = u16(d0, 8);
    var encryption = u16(d0, 12);
    var tag = String.fromCharCode(r0[16], r0[17], r0[18], r0[19]);

    if (encryption) throw new Error('这本有 DRM 版权保护（加密），去掉 DRM 之后才能读');
    if (tag !== 'MOBI') throw new Error('这个 Kindle 文件头不是 MOBI（可能是 TOPAZ 格式），读不了');
    if (!textRecs) throw new Error('这本 MOBI 没有正文记录');

    var encoding = 65001;
    try { encoding = u16(d0, 28) || 65001; } catch (e) { }
    var version = 0;
    try { version = u32(d0, 36); } catch (e) { }

    if (compression === 17480) {
      throw new Error('这本用了 Kindle 私有压缩（HUFF/CDIC），暂时还读不了——可以先在 Calibre 里转成 EPUB');
    }
    if (compression !== 1 && compression !== 2) {
      throw new Error('不认识的压缩方式（' + compression + '），读不了这本');
    }

    /* 正文记录：1 .. textRecs。KF8（AZW3）同样在这里，只是记录里是分节的 XHTML。 */
    var chunks = [], total = 0, r;
    for (i = 1; i <= textRecs && i < numRec; i++) {
      r = rec(i);
      if (!r.length) continue;
      var piece = (compression === 2) ? palmdoc(r) : r;
      if (compression === 1) piece = r;
      chunks.push(piece);
      total += piece.length;
      if (total > 64 * 1024 * 1024) break;      // 防呆：超大文件别把内存吃穿
    }
    var all = new Uint8Array(total), k = 0;
    for (i = 0; i < chunks.length; i++) { all.set(chunks[i], k); k += chunks[i].length; }

    var text;
    try {
      text = new TextDecoder(encoding === 1252 ? 'windows-1252' : 'utf-8').decode(all);
    } catch (e) {
      text = new TextDecoder('utf-8').decode(all);
    }
    /* 头部偶尔带个 BOM 或空字符 */
    text = text.replace(/^\uFEFF/, '').replace(/\u0000/g, '');

    var body = htmlToText(text);
    if (!body || body.replace(/\s/g, '').length < 2) throw new Error('这本 MOBI 里抽不出正文，可能文件不完整');
    return { text: body, kind: 'mobi', title: '', enc: '', version: version };
  }

  var api = {
    docx: docx,
    mobi: mobi,
    /* 给测试用：单独暴露解压与去标签，方便比对 */
    palmdoc: function (u8) { return palmdoc(u8); },
    htmlToText: htmlToText,
    docxToText: docxToText
  };
  root.DocFmt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

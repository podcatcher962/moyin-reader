/* MoYin Reader - 零依赖 ZIP / DEFLATE / 文本编码内核 */
var MYZip = (function () {
  'use strict';
  var LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LEXT  = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var DEXT  = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var CLORD = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  var FIXL = null, FIXD = null;

  function huff(lens) {
    var cnt = new Uint16Array(16), i;
    for (i = 0; i < lens.length; i++) if (lens[i]) cnt[lens[i]]++;
    var offs = new Uint16Array(16), left = 1;
    for (i = 1; i <= 15; i++) { left = (left << 1) - cnt[i]; if (left < 0) throw new Error('Huffman 表溢出'); }
    offs[1] = 0;
    for (i = 1; i < 15; i++) offs[i + 1] = offs[i] + cnt[i];
    var sym = new Uint16Array(lens.length);
    for (i = 0; i < lens.length; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
    return { cnt: cnt, sym: sym };
  }
  function fixed() {
    if (FIXL) return;
    var l = new Uint8Array(288), i;
    for (i = 0; i < 144; i++) l[i] = 8;
    for (; i < 256; i++) l[i] = 9;
    for (; i < 280; i++) l[i] = 7;
    for (; i < 288; i++) l[i] = 8;
    var d = new Uint8Array(32);
    for (i = 0; i < 32; i++) d[i] = 5;
    FIXL = huff(l); FIXD = huff(d);
  }

  /* 纯 JS raw-DEFLATE 解压：不依赖 DecompressionStream，老浏览器/安卓 WebView 也能开 EPUB */
  function inflateRaw(src, expected) {
    var u8 = src, pos = 0, bb = 0, bc = 0, n = 0;
    var out = new Uint8Array(expected > 0 ? expected : Math.max(1024, u8.length * 3));
    function bits(k) {
      while (bc < k) { bb += (u8[pos++] || 0) * (1 << bc); bc += 8; }
      var v = bb & ((1 << k) - 1);
      bb = Math.floor(bb / (1 << k)); bc -= k;
      return v;
    }
    function grow(add) {
      if (n + add <= out.length) return;
      var sz = out.length;
      while (sz < n + add) sz *= 2;
      var o = new Uint8Array(sz); o.set(out); out = o;
    }
    function dec(h) {
      var code = 0, first = 0, index = 0, len, c;
      for (len = 1; len <= 15; len++) {
        code |= bits(1); c = h.cnt[len];
        if (code - first < c) return h.sym[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error('DEFLATE 码流损坏');
    }
    var last = 0;
    do {
      last = bits(1);
      var type = bits(2), LT, DT;
      if (type === 0) {
        bb = 0; bc = 0;
        var len = (u8[pos] | (u8[pos + 1] << 8)) >>> 0;
        pos += 4;
        grow(len);
        out.set(u8.subarray(pos, pos + len), n); n += len; pos += len;
      } else {
        if (type === 1) { fixed(); LT = FIXL; DT = FIXD; }
        else if (type === 2) {
          var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4, i;
          var cl = new Uint8Array(19);
          for (i = 0; i < hclen; i++) cl[CLORD[i]] = bits(3);
          var CLT = huff(cl), lens = new Uint8Array(hlit + hdist), p = 0;
          while (p < lens.length) {
            var sy = dec(CLT), rep = 0, val = 0;
            if (sy < 16) { lens[p++] = sy; continue; }
            if (sy === 16) { if (!p) throw new Error('DEFLATE 重复码非法'); val = lens[p - 1]; rep = 3 + bits(2); }
            else if (sy === 17) { rep = 3 + bits(3); }
            else { rep = 11 + bits(7); }
            while (rep-- > 0 && p < lens.length) lens[p++] = val;
          }
          LT = huff(lens.subarray(0, hlit)); DT = huff(lens.subarray(hlit));
        } else throw new Error('DEFLATE 保留块类型');
        for (;;) {
          var s = dec(LT);
          if (s < 256) { grow(1); out[n++] = s; continue; }
          if (s === 256) break;
          var li = s - 257;
          if (li >= LBASE.length) throw new Error('DEFLATE 长度码非法');
          var length = LBASE[li] + bits(LEXT[li]);
          var di = dec(DT);
          if (di >= DBASE.length) throw new Error('DEFLATE 距离码非法');
          var dist = DBASE[di] + bits(DEXT[di]);
          if (dist > n) throw new Error('DEFLATE 距离越界');
          grow(length);
          var from = n - dist;
          for (var k = 0; k < length; k++) out[n++] = out[from++];
        }
      }
    } while (!last);
    return out.subarray(0, n);
  }

  function makeZip(u8) {
    if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), e = -1, i;
    for (i = u8.length - 22; i >= Math.max(0, u8.length - 65558); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
    }
    if (e < 0) throw new Error('不是有效的 EPUB / ZIP 文件');
    var cnt = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true);
    var files = Object.create(null), lower = Object.create(null);
    var utf8 = new TextDecoder('utf-8');
    for (i = 0; i < cnt; i++) {
      if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) break;
      var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true),
          usize = dv.getUint32(off + 24, true), nl = dv.getUint16(off + 28, true),
          xl = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true),
          lo = dv.getUint32(off + 42, true);
      var name = utf8.decode(u8.subarray(off + 46, off + 46 + nl));
      var start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      files[name] = { name: name, method: method, csize: csize, usize: usize, start: start };
      lower[name.replace(/\\/g, '/').toLowerCase()] = name;
      off += 46 + nl + xl + cl;
    }
    var api = {
      files: files, names: Object.keys(files),
      find: function (p) {
        var q = String(p || '').replace(/\\/g, '/');
        if (files[q]) return q;
        var q2; try { q2 = decodeURIComponent(q); } catch (err) { q2 = q; }
        if (files[q2]) return q2;
        var a = q.toLowerCase(); if (lower[a]) return lower[a];
        a = q2.toLowerCase(); if (lower[a]) return lower[a];
        var bn = q.split('/').pop().toLowerCase(), k;
        for (k in lower) if (k.split('/').pop() === bn) return lower[k];
        return null;
      },
      read: function (p) {
        var real = api.find(p); if (!real) return null;
        var f = files[real], data = u8.subarray(f.start, f.start + f.csize);
        if (f.method === 0) return data.slice();
        if (f.method === 8) return inflateRaw(data, f.usize);
        throw new Error('不支持的 ZIP 压缩方式：' + f.method);
      },
      text: function (p) {
        var b = api.read(p); return b === null ? null : decodeAny(b).text;
      }
    };
    return api;
  }

  function decodeAny(b, enc) {
    if (enc) return { text: new TextDecoder(enc).decode(b), enc: enc };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(b), enc: 'UTF-8' }; }
    catch (e) { /* 部分老书正文是 GBK */ }
    try { return { text: new TextDecoder('gb18030').decode(b), enc: 'GB18030' }; }
    catch (e2) { return { text: new TextDecoder('utf-8').decode(b), enc: 'UTF-8(容错)' }; }
  }

  /* TXT 编码识别：BOM → UTF-16 启发 → 严格 UTF-8 → GB18030 */
  function decodeTxt(buf, force) {
    var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf), i;
    if (u.length >= 3 && u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF)
      return { text: new TextDecoder('utf-8').decode(u.subarray(3)), enc: 'UTF-8 BOM' };
    if (u.length >= 2 && u[0] === 0xFF && u[1] === 0xFE)
      return { text: new TextDecoder('utf-16le').decode(u.subarray(2)), enc: 'UTF-16LE BOM' };
    if (u.length >= 2 && u[0] === 0xFE && u[1] === 0xFF)
      return { text: new TextDecoder('utf-16be').decode(u.subarray(2)), enc: 'UTF-16BE BOM' };
    if (force && force !== 'auto') return { text: new TextDecoder(force).decode(u), enc: force };
    var zeros = 0, lim = Math.min(400, u.length - 1);
    for (i = 0; i < lim; i += 2) if (u[i + 1] === 0 && u[i] !== 0) zeros++;
    if (lim > 60 && zeros / (lim / 2) > 0.35)
      return { text: new TextDecoder('utf-16le').decode(u), enc: 'UTF-16LE(推测)' };
    var r = decodeAny(u);
    return r;
  }

  function resolvePath(baseDir, href) {
    var h = String(href || '').split('#')[0].split('?')[0];
    try { h = decodeURIComponent(h); } catch (e) { /* 原样 */ }
    if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return h;
    h = h.replace(/\\/g, '/');
    var parts = h.charAt(0) === '/' ? h.slice(1).split('/')
                                    : (baseDir ? baseDir.split('/') : []).concat(h.split('/'));
    var out = [], i;
    for (i = 0; i < parts.length; i++) {
      var s = parts[i];
      if (!s || s === '.') continue;
      if (s === '..') { if (out.length) out.pop(); } else out.push(s);
    }
    return out.join('/');
  }

  return { inflateRaw: inflateRaw, makeZip: makeZip, decodeTxt: decodeTxt,
           decodeAny: decodeAny, resolvePath: resolvePath };
})();
if (typeof window !== 'undefined') window.MYZip = MYZip;

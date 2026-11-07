/* MoYin Reader · 墨吟 —— 单文件 TXT/EPUB 阅读 + 朗读 */
(function () {
  'use strict';
  var Z = window.MYZip, $ = function (id) { return document.getElementById(id); };
  var DBNAME = 'MoYinReader', CFGKEY = 'MOYIN_CFG', GEN = 1;
  var FONTS = {
    serif: '"Noto Serif CJK SC","Songti SC","SimSun",Georgia,serif',
    sans: '"Microsoft YaHei","PingFang SC",system-ui,sans-serif',
    kai: '"Kaiti SC","KaiTi","STKaiti",serif',
    mono: '"Cascadia Mono","Consolas","Courier New",monospace'
  };
  var DEF = {
    theme: 'dark', lay: 'auto', motion: 0, fs: 19, lh: 1.85, pagew: 720,
    ff: 'serif', align: 'justify', sort: 'last', txtEnc: 'auto',
    rate: 1, pitch: 1, volume: 1, voiceURI: '', voiceAuto: 1, pause: 120, whole: 1,
    autoNext: 1, follow: 1,
    localOn: 1, localPort: 8177, localVoice: 's12',
    voiceSet: 'curated', roleOn: 0, rolePool: 'mix'
  };
  var CFG = Object.assign({}, DEF), BOOKS = [], BK = null, URLCACHE = {}, ACTIVE_ZIP = null, ZIPSEQ = 0;
  var SIDE = 'toc', SEARCHTOK = 0;
  var SYN = window.speechSynthesis || null, UTT = window.SpeechSynthesisUtterance || null;
  var DB = null;

  /* ---------------- 小工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function fmtDate(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  var toastT = null;
  function toast(msg, ms) {
    var e = $('toast'); e.textContent = msg; e.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { e.classList.remove('on'); }, ms || 2600);
  }
  function download(name, text, mime) {
    var u = URL.createObjectURL(new Blob([text], { type: mime || 'application/json;charset=utf-8' }));
    var a = document.createElement('a'); a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
  }
  function b64(buf) {
    var u = new Uint8Array(buf), s = '', CH = 0x8000, i;
    for (i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- IndexedDB：元数据与书籍二进制分库 ---------------- */
  function openDB() {
    if (DB) return Promise.resolve(DB);
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DBNAME, 1);
      r.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' });
      };
      r.onsuccess = function (e) { DB = e.target.result; res(DB); };
      r.onerror = function (e) { rej(e.target.error); };
    });
  }
  function tx(store, mode, fn) {
    return openDB().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), q = fn(s);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function dbPut(s, v) { return tx(s, 'readwrite', function (o) { return o.put(v); }); }
  function dbGet(s, k) { return tx(s, 'readonly', function (o) { return o.get(k); }); }
  function dbAll(s) { return tx(s, 'readonly', function (o) { return o.getAll(); }); }
  function dbDel(s, k) { return tx(s, 'readwrite', function (o) { return o.delete(k); }); }

  /* ---------------- 配置 ---------------- */
  function loadCfg() {
    try { var o = JSON.parse(localStorage.getItem(CFGKEY) || '{}'); Object.keys(DEF).forEach(function (k) { if (o[k] !== undefined) CFG[k] = o[k]; }); }
    catch (e) { /* 用默认值 */ }
    applyCfg();
  }
  function saveCfg() { try { localStorage.setItem(CFGKEY, JSON.stringify(CFG)); } catch (e) { /* 隐私模式 */ } }
  function applyCfg() {
    var h = document.documentElement, s = h.style;
    h.setAttribute('data-theme', CFG.theme); h.setAttribute('data-lay', CFG.lay);
    h.setAttribute('data-motion', CFG.motion ? 'low' : '');
    s.setProperty('--fs', CFG.fs + 'px'); s.setProperty('--lh', CFG.lh);
    s.setProperty('--pagew', CFG.pagew + 'px'); s.setProperty('--ff', FONTS[CFG.ff] || FONTS.serif);
    $('page').style.textAlign = CFG.align;
    var i = $('spRate'); if (i) { i.value = CFG.rate; $('spRateTx').textContent = Number(CFG.rate).toFixed(1) + '×'; }
  }
  function cycleTheme() { var a = ['dark', 'light', 'sepia']; CFG.theme = a[(a.indexOf(CFG.theme) + 1) % 3]; saveCfg(); applyCfg(); toast('主题：' + ({ dark: '夜间', light: '明亮', sepia: '羊皮纸' })[CFG.theme]); }
  function cycleLayout() { var a = ['auto', 'p', 'l']; CFG.lay = a[(a.indexOf(CFG.lay) + 1) % 3]; saveCfg(); applyCfg(); toast('版式：' + ({ auto: '自动', p: '手机版', l: '电脑版' })[CFG.lay]); }

  /* ---------------- TXT / EPUB 解析 ---------------- */
  function isChapterTitle(t) {
    if (!t || t.length > 42) return false;
    var num = '0-9零〇一二三四五六七八九十百千两廿卅';
    if (new RegExp('^第\\s*[' + num + ']{1,12}\\s*[章节回卷部篇集话折出幕][\\s　:：、.．\\-—]*\\S{0,30}$').test(t)) return true;
    if (/^(Chapter|CHAPTER|chapter)\s+[0-9IVXLC]+[\s.:：\-—]*\S{0,30}$/.test(t)) return true;
    if (/^(卷|Volume|Part|PART|Book|BOOK)\s*[0-9零〇一二三四五六七八九十百千IVXLC]+[\s.:：\-—]*\S{0,30}$/.test(t)) return true;
    if (/^(序章|序言|自序|楔子|引子|前言|后记|尾声|番外|附录|目录|Contents|Epilogue|Prologue)[\s　:：.\-—]*\S{0,20}$/.test(t)) return true;
    if (new RegExp('^[【\\[]?第\\s*[' + num + ']{1,12}[章节回][】\\]]?').test(t) && t.length <= 36) return true;
    return false;
  }
  function splitLong(line, max) {
    var out = [], s = line;
    while (s.length > max) {
      var cut = max, i, punct = '。！？；!?;，,、';
      for (i = max; i > max * 0.55; i--) if (punct.indexOf(s.charAt(i)) >= 0) { cut = i + 1; break; }
      out.push(s.slice(0, cut)); s = s.slice(cut);
    }
    if (s.trim()) out.push(s);
    return out;
  }
  function buildTxt(buf, name) {
    var d = Z.decodeTxt(buf, CFG.txtEnc);
    var text = d.text.replace(/\r\n?/g, '\n').replace(/\uFEFF/g, '').replace(/\u3000/g, ' ');
    var lines = text.split('\n'), chapters = [], cur = { title: '开篇', lines: [] }, found = 0;
    lines.forEach(function (raw) {
      var t = raw.trim();
      if (isChapterTitle(t)) {
        found++;
        if (cur.lines.length || chapters.length) chapters.push(cur);
        cur = { title: t, lines: [] };
      } else if (t) cur.lines.push(t);
    });
    if (cur.lines.length || !chapters.length) chapters.push(cur);
    // 没有章节标题的书：按字数分卷；超大章节再切，保证渲染与朗读流畅
    var out = [];
    chapters.forEach(function (c) {
      if (!c.lines.length && out.length) return;
      var block = [], size = 0, part = 1;
      c.lines.forEach(function (ln) {
        splitLong(ln, 300).forEach(function (seg) {
          if (size + seg.length > (found ? 9000 : 6000) && block.length) {
            out.push({ title: c.title + (part > 1 ? '（' + part + '）' : ''), lines: block });
            part++; block = []; size = 0;
          }
          block.push(seg); size += seg.length;
        });
      });
      if (block.length) out.push({ title: c.title + (part > 1 ? '（' + part + '）' : ''), lines: block });
    });
    if (!out.length) out = [{ title: name, lines: ['（空文件）'] }];
    var titles = out.map(function (c) { return c.title; });
    return {
      kind: 'txt', enc: d.enc, count: out.length, titles: titles, cover: null,
      title: name, author: '', toc: titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; }),
      chapterHtml: function (i) {
        return out[i].lines.map(function (l) { return '<p class="rdp">' + esc(l) + '</p>'; }).join('\n');
      },
      chapterText: function (i) { return out[i].lines.join('\n'); }
    };
  }

  function els(doc, name) {
    var a = doc.getElementsByTagNameNS ? doc.getElementsByTagNameNS('*', name) : [];
    if (a && a.length) return a;
    return doc.getElementsByTagName(name);
  }
  function xmlText(doc, tag) {
    var a = els(doc, tag);
    return a.length ? (a[0].textContent || '').trim() : '';
  }
  function pathDir(p) { var a = String(p).split('/'); a.pop(); return a.join('/'); }
  function guessMime(p) {
    var e = (p.split('.').pop() || '').toLowerCase();
    return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', otf: 'font/otf', ttf: 'font/ttf',
      woff: 'font/woff', woff2: 'font/woff2', css: 'text/css' })[e] || 'application/octet-stream';
  }
  function assetURL(p, zip) {
    var z = zip || ACTIVE_ZIP || (BK && BK.zip);
    if (!z) return null;
    var real = z.find(p); if (!real) return null;
    if (!z.__myid) z.__myid = ++ZIPSEQ;
    var key = z.__myid + '|' + real;
    if (URLCACHE[key]) return URLCACHE[key];
    var b = z.read(real); if (!b) return null;
    var u = URL.createObjectURL(new Blob([b], { type: guessMime(real) }));
    URLCACHE[key] = u; return u;
  }
  function clearAssets() {
    Object.keys(URLCACHE).forEach(function (k) { try { URL.revokeObjectURL(URLCACHE[k]); } catch (e) {} });
    URLCACHE = {};
  }
  function rewriteCss(css, baseFile, zip) {
    var dir = pathDir(baseFile || '');
    css = css.replace(/@import[^;]*;/gi, '');
    css = css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, function (all, u) {
      if (/^(https?:|data:|blob:)/i.test(u)) return 'url()';
      var p = Z.resolvePath(dir, u), a = assetURL(p, zip);
      return a ? 'url("' + a + '")' : 'url()';
    });
    // 把 EPUB 样式限定在正文区，避免污染工具栏；字号/行距/颜色等一律交给用户设置
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, function (all, sel, body) {
      if (/^\s*@/.test(sel)) return all;
      var clean = body.replace(/(^|;)\s*(font-size|font-family|line-height|color|background|background-color|text-align)\s*:[^;]*/gi, '$1');
      var s2 = sel.split(',').map(function (x) {
        x = x.trim();
        if (!x || x.indexOf('#page') === 0) return x;
        if (/^(html|body|:root)\b/i.test(x)) return '#page';
        return '#page ' + x;
      }).join(',');
      return s2 + '{' + clean + '}';
    });
  }
  function byTag(node, name) {
    var a = node.getElementsByTagNameNS ? node.getElementsByTagNameNS('*', name) : null;
    if (a && a.length) return a;
    return node.getElementsByTagName(name);
  }
  function parseNavXhtml(txt, path2ch, base) {
    var doc = new DOMParser().parseFromString(txt, 'text/html'), out = [], nav = null;
    try { nav = doc.querySelector('nav[epub\\:type="toc"]'); } catch (e) {}
    nav = nav || doc.querySelector('nav') || doc.body;
    var lis = nav.querySelectorAll('li'), i;
    for (i = 0; i < lis.length; i++) {
      var a = lis[i].querySelector('a');
      if (!a) continue;
      var href = a.getAttribute('href') || '', lab = (a.textContent || '').trim().replace(/\s+/g, ' ');
      if (!lab) continue;
      var anchor = href.split('#')[1] || '', p = Z.resolvePath(pathDir(base), href);
      var lvl = 0, q = lis[i].parentElement;
      while (q && q !== nav) { if (q.tagName === 'OL' || q.tagName === 'UL') lvl++; q = q.parentElement; }
      out.push({ label: lab, ch: path2ch[p] === undefined ? -1 : path2ch[p], level: Math.max(0, lvl - 1), anchor: anchor });
    }
    return out;
  }
  function parseNcx(txt, path2ch, base) {
    var doc = new DOMParser().parseFromString(txt, 'application/xml');
    var pts = byTag(doc, 'navPoint'), out = [], i;
    if (!pts.length) { doc = new DOMParser().parseFromString(txt, 'text/html'); pts = byTag(doc, 'navPoint'); }
    for (i = 0; i < pts.length; i++) {
      var np = pts[i], lab = '', src = '';
      var nl = byTag(np, 'navLabel')[0]; if (nl) lab = (nl.textContent || '').trim().replace(/\s+/g, ' ');
      var ct = byTag(np, 'content')[0]; if (ct) src = ct.getAttribute('src') || '';
      if (!lab) continue;
      var lvl = 0, q = np.parentNode;
      while (q) { if ((q.nodeName || '').toLowerCase().indexOf('navpoint') >= 0) { lvl++; q = q.parentNode; } else break; }
      var p = Z.resolvePath(pathDir(base), src);
      out.push({ label: lab, ch: path2ch[p] === undefined ? -1 : path2ch[p], level: lvl, anchor: src.split('#')[1] || '' });
    }
    return out;
  }

  function buildEpub(buf, name) {
    var u8 = new Uint8Array(buf), zip = Z.makeZip(u8);
    ACTIVE_ZIP = zip;
    var cont = zip.text('META-INF/container.xml') || '';
    var mm = cont.match(/full-path\s*=\s*["']([^"']+)["']/i);
    var opfPath = mm ? mm[1] : (zip.names.filter(function (n) { return /\.opf$/i.test(n); })[0]);
    var real = opfPath && zip.find(opfPath);
    if (!real) throw new Error('找不到 OPF 描述文件，可能不是标准 EPUB');
    var opf = zip.text(real), doc = new DOMParser().parseFromString(opf, 'application/xml');
    var items = els(doc, 'item'), refs = els(doc, 'itemref'), i;
    var id2 = {}, props = {}, ncxPath = null, navPath = null, coverPath = null;
    if (!items.length) { // 容错：XML 解析失败时退正则
      var re = /<item\b([^>]*)>/gi, m2;
      while ((m2 = re.exec(opf))) {
        var at = {}; m2[1].replace(/([:\w-]+)\s*=\s*["']([^"']*)["']/g, function (a, k, v) { at[k] = v; return a; });
        if (at.id) id2[at.id] = { href: at.href || '', type: at['media-type'] || '', prop: at.properties || '' };
      }
    } else {
      for (i = 0; i < items.length; i++) {
        var it = items[i], id = it.getAttribute('id');
        if (!id) continue;
        id2[id] = { href: it.getAttribute('href') || '', type: it.getAttribute('media-type') || '', prop: it.getAttribute('properties') || '' };
      }
    }
    var spine = [], hrefs = [];
    if (!refs.length) {
      var re2 = /<itemref\b([^>]*)>/gi, m3;
      while ((m3 = re2.exec(opf))) { var idr = (m3[1].match(/idref\s*=\s*["']([^"']+)["']/i) || [])[1]; if (idr && id2[idr]) spine.push(idr); }
    } else {
      for (i = 0; i < refs.length; i++) { var ir = refs[i].getAttribute('idref'); if (ir && id2[ir]) spine.push(ir); }
    }
    var opfDir = pathDir(real);
    spine.forEach(function (id) { hrefs.push(zip.find(Z.resolvePath(opfDir, id2[id].href)) || Z.resolvePath(opfDir, id2[id].href)); });
    var path2ch = {}; hrefs.forEach(function (p, i) { if (path2ch[p] === undefined) path2ch[p] = i; });
    Object.keys(id2).forEach(function (id) {
      var it = id2[id], p = zip.find(Z.resolvePath(opfDir, it.href)) || Z.resolvePath(opfDir, it.href);
      if (/ncx$/.test(it.type) || /\.ncx$/i.test(it.href)) ncxPath = p;
      if (/nav/.test(it.prop)) navPath = p;
      if (/cover-image/.test(it.prop) || /^cover\.(jpg|jpeg|png|webp|gif)$/i.test((it.href || '').split('/').pop() || '')) {
        if (!coverPath) coverPath = p;
      }
    });
    if (!ncxPath) { var n = zip.names.filter(function (x) { return /\.ncx$/i.test(x); })[0]; if (n) ncxPath = zip.find(n); }
    if (!navPath) { var n2 = zip.names.filter(function (x) { return /nav\.xhtml$/i.test(x); })[0]; if (n2) navPath = zip.find(n2); }
    var coverMeta = (opf.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    if (coverMeta && id2[coverMeta]) coverPath = zip.find(Z.resolvePath(opfDir, id2[coverMeta].href)) || coverPath;
    // 目录
    var toc = [];
    if (navPath) { var nt = zip.text(navPath); if (nt) toc = parseNavXhtml(nt, path2ch, navPath); }
    if (!toc.length && ncxPath) { var ct = zip.text(ncxPath); if (ct) toc = parseNcx(ct, path2ch, ncxPath); }
    toc = toc.filter(function (t) { return t.ch >= 0; });
    // 标题：目录优先，缺省用序号
    var titleMap = {};
    toc.forEach(function (t) { if (titleMap[t.ch] === undefined) titleMap[t.ch] = t.label; });
    var titles = hrefs.map(function (p, i) {
      if (titleMap[i]) return titleMap[i];
      var base = (p.split('/').pop() || '').replace(/\.[^.]+$/, '');
      return /^(chapter|part|section|page|text|ch)?[\d_-]+$/i.test(base) ? '第 ' + (i + 1) + ' 节' : (base || '第 ' + (i + 1) + ' 节');
    });
    var title = xmlText(doc, 'title') || name, author = xmlText(doc, 'creator') || '';
    var css = '';
    Object.keys(id2).forEach(function (id) {
      if (/css$/.test(id2[id].type) || /\.css$/i.test(id2[id].href)) {
        var p = zip.find(Z.resolvePath(opfDir, id2[id].href));
        var t = p && zip.text(p); if (t) css += rewriteCss(t, p, zip) + '\n';
      }
    });
    return {
      kind: 'epub', zip: zip, css: css, count: hrefs.length, titles: titles, toc: toc,
      title: title, author: author, coverPath: coverPath, cover: null, opfDir: opfDir,
      _hrefs: hrefs, _p2c: path2ch, spineHrefs: hrefs, path2ch: path2ch,
      chapterHtml: function (idx) { return epubChapter(idx); },
      chapterText: function (idx) { return stripTags(epubChapter(idx)); }
    };
  }

  function stripTags(html) {
    var d = document.createElement('div'); d.innerHTML = html;
    d.querySelectorAll('style,script').forEach(function (e) { e.remove(); });
    return (d.textContent || '').replace(/\s+/g, ' ');
  }
  /* 把 EPUB 正文重建为扁平的朗读段落：兼容 <p> 分段、<div> 嵌套、纯 <br> 分段的老书，
     保留内联标签（链接/加粗/图片），避免整章落成一个超大朗读单元。 */
  function buildParagraphs(body) {
    var out = [], cur = '', head = false;
    var BLOCK = /^(p|div|h[1-6]|li|blockquote|pre|section|article|tr|td|ul|ol|table|dl|dt|dd|center|address)$/;
    function flush() {
      var plain = cur.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').trim();
      var hasMedia = /<(img|image)\b/i.test(cur);   // 封面 / 插图页没有文字，也要保留
      if (plain || hasMedia) out.push('<p class="rdp' + (head ? ' rdh' : '') + '">' + cur + '</p>');
      cur = ''; head = false;
    }
    function walk(node) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { cur += esc(n.nodeValue); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toLowerCase();
        if (/^(script|style|noscript|br)$/.test(tag)) { if (tag === 'br') flush(); return; }
        if (BLOCK.test(tag)) {
          flush(); head = /^h[1-6]$/.test(tag);
          walk(n); flush(); return;
        }
        cur += n.outerHTML;   // 内联元素已清理过危险属性，可直接保留
      });
    }
    walk(body); flush();
    return out.join('\n');
  }
  function epubChapter(idx) {
    var href = BK.spineHrefs[idx];
    var raw = BK.zip.read(href);
    if (!raw) return '<p class="rdp">（本章文件缺失）</p>';
    var txt = Z.decodeAny(raw).text, dir = pathDir(href);
    var d = new DOMParser().parseFromString(txt, 'text/html'), body = d.body;
    var css = [BK.css || ''];
    body.querySelectorAll('link[rel~="stylesheet"]').forEach(function (l) {
      var p = Z.resolvePath(dir, l.getAttribute('href') || ''), t = BK.zip.text(p);
      if (t) css.push(rewriteCss(t, p, BK.zip));
      l.remove();
    });
    body.querySelectorAll('style').forEach(function (s) { css.push(rewriteCss(s.textContent || '', href, BK.zip)); s.remove(); });
    body.querySelectorAll('script,iframe,object,embed,form,input,button,select,textarea,audio,video,meta,base,link').forEach(function (e) { e.remove(); });
    body.querySelectorAll('*').forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (n.indexOf('on') === 0 || n === 'srcdoc' || /^\s*(javascript|vbscript):/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    body.querySelectorAll('img').forEach(function (im) {
      var src = im.getAttribute('src') || im.getAttribute('data-src') || '';
      if (!src) return;
      var u = assetURL(Z.resolvePath(dir, src), BK.zip);
      if (u) im.setAttribute('src', u); else im.removeAttribute('src');
      im.removeAttribute('srcset');
    });
    body.querySelectorAll('image').forEach(function (im) {
      var h = im.getAttribute('xlink:href') || im.getAttribute('href') || im.getAttribute('src') || '';
      if (!h) return;
      var u = assetURL(Z.resolvePath(dir, h), BK.zip);
      if (u) { im.setAttribute('xlink:href', u); im.setAttribute('href', u); }
    });
    body.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href') || '';
      if (/^(https?:|mailto:)/i.test(h)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); return; }
      var anchor = h.split('#')[1] || '', p = Z.resolvePath(dir, h), ch = BK.path2ch[p];
      if (ch !== undefined) { a.setAttribute('href', 'javascript:void(0)'); a.setAttribute('data-ch', ch); a.setAttribute('data-anchor', anchor); }
      else a.removeAttribute('href');
    });
    var inner = buildParagraphs(body);
    return '<style>' + css.join('\n') + '</style>' + inner;
  }

  function parseBook(buf, name, ext) {
    var b = ext === 'epub' ? buildEpub(buf, name) : buildTxt(buf, name);
    return makeCover(b);
  }
  function makeCover(b) {
    if (b.kind !== 'epub' || !b.coverPath) return Promise.resolve(b);
    return new Promise(function (res) {
      var url = assetURL(b.coverPath, b.zip);
      if (!url) return res(b);
      var im = new Image();
      im.onload = function () {
        try {
          var c = document.createElement('canvas'), W = 120, H = 160;
          c.width = W; c.height = H;
          var g = c.getContext('2d'), r = Math.max(W / im.width, H / im.height);
          g.drawImage(im, (W - im.width * r) / 2, (H - im.height * r) / 2, im.width * r, im.height * r);
          b.cover = c.toDataURL('image/jpeg', 0.72);
        } catch (e) {}
        res(b);
      };
      im.onerror = function () { res(b); };
      im.src = url;
      setTimeout(function () { res(b); }, 2500);
    });
  }

  /* ---------------- 书架 ---------------- */
  function sortBooks() {
    var f = ({ last: function (a, b) { return b.last - a.last; },
      name: function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh'); },
      added: function (a, b) { return b.added - a.added; },
      progress: function (a, b) { return b.progress - a.progress; } })[CFG.sort] || function (a, b) { return b.last - a.last; };
    BOOKS.sort(f);
  }
  function renderShelf() {
    sortBooks();
    var q = ($('libSearch').value || '').trim().toLowerCase(), box = $('shelf');
    var list = BOOKS.filter(function (b) { return !q || (b.name || '').toLowerCase().indexOf(q) >= 0 || (b.author || '').toLowerCase().indexOf(q) >= 0; });
    box.innerHTML = list.map(function (b) {
      var cv = b.cover ? '<img src="' + b.cover + '" alt="">'
        : '<div class="ph">' + esc((b.name || '书').slice(0, 4)) + '</div>';
      return '<div class="bk" data-id="' + b.id + '"><div class="cv">' + cv + '</div>' +
        '<button class="del" data-del="' + b.id + '" title="从书架移除">×</button>' +
        '<div class="meta"><div class="nm">' + esc(b.name) + '</div>' +
        '<div class="sub"><span class="tag">' + esc(b.ext.toUpperCase()) + '</span>' + fmtSize(b.size) +
        (b.author ? ' · ' + esc(b.author.slice(0, 8)) : '') + '</div>' +
        '<div class="bar"><i style="width:' + Math.min(100, b.progress || 0) + '%"></i></div>' +
        '<div class="sub">' + (b.progress > 0 ? '读到 ' + (b.progress).toFixed(1) + '%' : '未读') + ' · ' + fmtDate(b.last) + '</div>' +
        (b.lCh != null && b.lPi != null
          ? '<button class="resume" data-listen="' + b.id + '" title="从上次听到的地方继续听">▶ 续听 · 第 ' + ((b.lCh | 0) + 1) + ' 章</button>'
          : '') +
        '</div></div>';
    }).join('');
    $('emptyLib').style.display = BOOKS.length ? 'none' : '';
    $('libStat').textContent = '书架 ' + BOOKS.length + ' 本' + (q ? '（筛出 ' + list.length + ' 本）' : '');
  }
  function readExt(name) { var e = (name.split('.').pop() || '').toLowerCase(); return e === 'epub' ? 'epub' : 'txt'; }
  async function importFiles(files) {
    var okN = 0, errs = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], ext = readExt(f.name);
      try {
        var buf = await f.arrayBuffer();
        var b = await parseBook(buf, f.name.replace(/\.[^.]+$/, ''), ext);
        var id = 'b' + Date.now() + Math.random().toString(36).slice(2, 7);
        await dbPut('blobs', { id: id, buf: buf });
        var meta = {
          id: id, name: f.name.replace(/\.[^.]+$/, ''), ext: ext, size: f.size,
          added: Date.now(), last: Date.now(), ch: 0, ratio: 0, progress: 0,
          cover: b.cover || '', title: b.title, author: b.author || '', marks: [],
          chapters: b.titles.slice(0, 1000), tocCount: b.toc.length, enc: b.enc || ''
        };
        await dbPut('books', meta); BOOKS.push(meta); okN++;
        if (b.enc && b.enc !== 'UTF-8' && b.enc !== 'UTF-8 BOM') toast('《' + meta.name + '》按 ' + b.enc + ' 解码', 3200);
      } catch (e) { errs.push(f.name + '：' + e.message); }
    }
    renderShelf();
    if (okN) toast('已导入 ' + okN + ' 本' + (errs.length ? '，' + errs.length + ' 本失败' : ''));
    if (errs.length) showModal('部分文件未能导入', '<p>' + errs.map(esc).join('</p><p>') + '</p>', [{ label: '知道了' }]);
  }

  /* ---------------- 阅读 ---------------- */
  function chapterTitle(i) { return (BK.titles && BK.titles[i]) || '第 ' + (i + 1) + ' 节'; }
  function chapterCount() { return BK ? BK.count : 0; }
  function showView(v) {
    $('viewLib').classList.toggle('on', v === 'lib');
    $('viewRead').classList.toggle('on', v === 'read');
    if (v === 'lib') renderShelf();
  }
  async function openBook(id) {
    var rec = await dbGet('blobs', id);
    if (!rec) { toast('这本书的文件已丢失，请重新导入'); return; }
    var meta = BOOKS.filter(function (b) { return b.id === id; })[0] || await dbGet('books', id);
    stopSpeak(true);
    resetCast();
    clearAssets();
    try {
      BK = await parseBook(rec.buf, meta.name, meta.ext);
    } catch (e) { toast('打开失败：' + e.message, 4000); return; }
    BK.id = id; BK.meta = meta;
    $('readTitle').textContent = meta.name;
    $('readTitle').title = meta.name + (meta.author ? ' · ' + meta.author : '');
    showView('read');
    renderChapter(meta.ch || 0, { ratio: meta.ratio || 0, silent: true });
    renderSide();
  }
  /* 从书架「续听」：打开书 → 跳到上次听到的那一章那段 → 直接开念 */
  async function resumeListen(id) {
    var b = BOOKS.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    await openBook(id);
    if (!BK) return;
    var ch = Math.min(Math.max(0, b.lCh | 0), Math.max(0, chapterCount() - 1));
    if (ch !== BK.ch) renderChapter(ch, { silent: true });
    await new Promise(function (r) { setTimeout(r, 80); });
    var pi = Math.min(Math.max(0, b.lPi | 0), Math.max(0, SPK.paras.length - 1));
    startSpeak(pi);
    toast('从上次听到的地方继续（第 ' + (ch + 1) + ' 章）', 2800);
  }
  function closeBook() {
    stopSpeak(true); savePos(); BK = null; showView('lib');
    $('side').classList.remove('on'); $('speakBar').classList.remove('on');
    clearAssets(); renderShelf();
  }
  function renderChapter(i, opt) {
    if (!BK) return;
    opt = opt || {};
    i = Math.max(0, Math.min(chapterCount() - 1, i | 0));
    BK.ch = i;
    var html;
    try { html = BK.chapterHtml(i); } catch (e) { html = '<p class="rdp">本章读取失败：' + esc(e.message) + '</p>'; }
    $('page').innerHTML = '<div id="chTitle">' + esc(chapterTitle(i)) + '</div>' + html +
      '<div id="chEnd">— 本章完 —<br><button data-act="next">下一章 →</button></div>';
    $('pageWrap').scrollTop = 0;
    SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
    applyCfg();
    if (opt.ratio) setTimeout(function () {
      var w = $('pageWrap'); w.scrollTop = (w.scrollHeight - w.clientHeight) * opt.ratio;
    }, 60);
    if (opt.anchor) setTimeout(function () {
      var list = $('page').querySelectorAll('[id],[name]'), j, an = String(opt.anchor);
      for (j = 0; j < list.length; j++) {
        if (list[j].id === an || list[j].getAttribute('name') === an) { list[j].scrollIntoView({ block: 'center' }); break; }
      }
    }, 80);
    updateProgress();
    if (!opt.silent) savePos();
    renderSide();
    if (SPK.on && SPK.playing && opt.fromSpeak !== true) { /* 朗读跨章由朗读器接管 */ }
  }
  var saveT = null;
  function updateProgress() {
    if (!BK) return;
    var w = $('pageWrap'), max = Math.max(1, w.scrollHeight - w.clientHeight);
    var r = Math.max(0, Math.min(1, w.scrollTop / max));
    BK.ratio = r;
    var p = (BK.ch + r) / chapterCount() * 100;
    $('progRange').value = Math.round(p / 100 * 1000);
    $('progTx').textContent = p.toFixed(1) + '% · ' + (BK.ch + 1) + '/' + chapterCount();
  }
  function savePos() {
    if (!BK || !BK.meta) return;
    // 先把这一刻的值抓出来：延迟写入时用户可能已经关书（BK 置空），不能再读 BK
    var m = BK.meta, ch = BK.ch, ratio = BK.ratio || 0, n = Math.max(1, chapterCount());
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      m.ch = ch; m.ratio = ratio; m.progress = (ch + ratio) / n * 100;
      m.last = Date.now();
      dbPut('books', m).catch(function () {});
      var x = BOOKS.filter(function (b) { return b.id === m.id; })[0]; if (x) Object.assign(x, m);
    }, 400);
  }
  function nextCh(d) { if (BK) renderChapter(BK.ch + d); }
  function currentPara() {
    var w = $('pageWrap'), top = w.getBoundingClientRect().top, best = 0, bd = 1e9;
    SPK.paras.forEach(function (p, i) { var dd = Math.abs(p.getBoundingClientRect().top - top - 90); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }

  /* ---------------- 侧栏：目录 / 书签 / 搜索 ---------------- */
  function openSide(tab) {
    SIDE = tab || SIDE; $('side').classList.add('on');
    $('side').querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === SIDE); });
    renderSide();
  }
  function renderSide() {
    if (!BK || !$('side').classList.contains('on')) return;
    var b = $('sideBody'), html = '';
    if (SIDE === 'toc') {
      var toc = BK.toc && BK.toc.length ? BK.toc : BK.titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; });
      html = toc.slice(0, 2000).map(function (t) {
        return '<button class="it' + (t.ch === BK.ch ? ' cur' : '') + (t.level ? ' lv' + Math.min(2, t.level) : '') +
          '" data-ch="' + t.ch + '" data-anchor="' + esc(t.anchor || '') + '">' + esc(t.label) + '</button>';
      }).join('');
      if (!html) html = '<div class="hint">这本书没有目录</div>';
    } else if (SIDE === 'mark') {
      var ms = (BK.meta.marks || []).slice().sort(function (a, c) { return c.ts - a.ts; });
      html = '<div class="row" style="margin:0 0 8px"><button id="sideAddMark">＋ 在当前位置加书签</button></div>' +
        (ms.length ? ms.map(function (m, i) {
          return '<div class="it" style="display:flex;gap:6px;align-items:flex-start"><button class="it" style="flex:1;text-align:left;padding:4px" data-mark="' + i + '">' +
            esc(m.text.slice(0, 40)) + '<br><span class="hint">' + fmtDate(m.ts) + ' · ' + (m.ch + 1) + ' 章</span></button>' +
            '<button class="ghost danger" data-delmark="' + m.ts + '" title="删除">×</button></div>';
        }).join('') : '<div class="hint">还没有书签。读到哪儿，点「＋书签」记一下。</div>');
    } else {
      html = '<div style="display:flex;gap:6px;margin-bottom:9px"><input class="q" type="search" id="findQ" placeholder="全书搜索关键词"><button id="findGo">搜</button></div>' +
        '<div id="findStat" class="hint">支持当前 EPUB / TXT 全文，最多显示 200 条</div><div id="findRes"></div>';
    }
    b.innerHTML = html;
    if (SIDE === 'find') {
      var q = $('findQ');
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') doFind(q.value); });
      $('findGo').addEventListener('click', function () { doFind(q.value); });
      q.focus();
    }
  }
  async function doFind(query) {
    var q = (query || '').trim(); if (!q || !BK) return;
    var tok = ++SEARCHTOK, res = [], low = q.toLowerCase(), stat = $('findStat');
    stat.textContent = '搜索中… 0/' + chapterCount();
    for (var i = 0; i < chapterCount(); i++) {
      var t; try { t = BK.chapterText(i); } catch (e) { continue; }
      var idx = t.toLowerCase().indexOf(low);
      while (idx >= 0 && res.length < 200) {
        res.push({ ch: i, label: chapterTitle(i), text: t.slice(Math.max(0, idx - 22), idx + q.length + 34) });
        idx = t.toLowerCase().indexOf(low, idx + q.length);
        if (res.length >= 200) break;
      }
      if (i % 8 === 0) { stat.textContent = '搜索中… ' + (i + 1) + '/' + chapterCount() + '，命中 ' + res.length; await sleep(0); }
      if (tok !== SEARCHTOK || res.length >= 200) break;
    }
    if (tok !== SEARCHTOK) return;
    stat.textContent = res.length ? '共 ' + res.length + ' 处' + (res.length >= 200 ? '（已截断）' : '') : '没找到「' + q + '」';
    $('findRes').innerHTML = res.map(function (r) {
      return '<button class="it" data-ch="' + r.ch + '" data-q="' + esc(q) + '"><b>' + esc(r.label) + '</b><br><span class="hint">…' + esc(r.text) + '…</span></button>';
    }).join('');
  }
  function addMark() {
    if (!BK) return;
    var p = currentPara(), t = (SPK.paras[p] ? SPK.paras[p].textContent : '').trim().slice(0, 80) || chapterTitle(BK.ch);
    BK.meta.marks = BK.meta.marks || [];
    BK.meta.marks.push({ ch: BK.ch, p: p, text: t, ts: Date.now() });
    savePos(); toast('已加书签'); if (SIDE === 'mark') renderSide();
  }

  /* ---------------- 朗读 ---------------- */
  var SPK = { on: false, playing: false, pi: 0, ci: 0, chunks: [], cv: [], paras: [], gen: 0,
    cast: {}, castName: {}, used: {},
    watch: null, deadline: 0, timer: null, gapT: null, fb: 0, seenEnd: false, trying: false,
    audio: null, prefetch: null };
  /* 免费离线神经语音：本机 sherpa-onnx + 一份 AISHELL3 中文多说话人 VITS 模型。
     模型内含 174 个说话人，靠 --sid 切换，所以放开到 174 个音色也不增加体积。
     每项：[音色 key, 显示名, 音高分档]；服务在线时用 /health 返回的全量表，
     服务没起来时用下面这份精选 11 个兜底（缺文件的音色会自动隐藏）。 */
  var LOCAL_VOICES = [
    ['s12',  '声线 12 · 温润',   '女声 · 清亮'],
    ['s35',  '声线 35 · 柔和',   '女声 · 中音'],
    ['s140', '声线 140 · 舒展',  '女声 · 偏沉'],
    ['s160', '声线 160 · 清亮',  '女声 · 清亮'],
    ['s170', '声线 170 · 明快',  '女声 · 清亮'],
    ['s20',  '声线 20 · 爽朗',   '女声 · 清亮'],
    ['s3',   '声线 03 · 甜美',   '女声 · 清亮'],
    ['s9',   '声线 09 · 清脆',   '女声 · 清亮'],
    ['s6',   '声线 06 · 沉静',   '女声 · 清亮'],
    ['s150', '声线 150 · 明亮',  '女声 · 清亮'],
    ['s110', '声线 110 · 沉稳男声', '男声 · 中音']
  ];
  /* 用 /health 的结果构造全量列表：精选排最前，其余按基频从低到高，
     正好自然落进「男低 → 男中 → 男亮 → 女沉 → 女中 → 女清亮 → 女高」7 个档。 */
  function buildVoiceList(info) {
    if (!info || !info.labels) return null;
    var lb = info.labels, g = info.groups || {}, f0 = info.f0 || {}, cur = info.curated || [], out = [];
    cur.forEach(function (k) { if (lb[k]) out.push([k, lb[k], g[k] || '']); });
    Object.keys(lb).filter(function (k) { return cur.indexOf(k) < 0; })
      .sort(function (a, b) { return (f0[a] || 0) - (f0[b] || 0); })
      .forEach(function (k) { out.push([k, lb[k], g[k] || '']); });
    return out;
  }
  function localVoiceName(k) {
    var x = (LOCAL.list || LOCAL_VOICES).filter(function (a) { return a[0] === k; })[0];
    if (!x) return k;
    return (/号$/.test(x[1]) && x[2]) ? x[1] + '（' + x[2] + '）' : x[1];
  }
  /* 精选 / 全部：精选只列人工命名过的 11 个；全部则按音高分 7 组列出 174 个 */
  function localVoiceList() {
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var all = LOCAL.list || LOCAL_VOICES;
    if (av) all = all.filter(function (x) { return av[x[0]] !== false; });
    if (!LOCAL.list || CFG.voiceSet === 'all') return all;
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    var only = all.filter(function (x) { return cur.indexOf(x[0]) >= 0; });
    return only.length ? only : all;
  }
  function voiceGroup(x) {
    var cur = (LOCAL.info && LOCAL.info.curated) || null;
    if (cur && cur.indexOf(x[0]) >= 0) return '⭐ 推荐音色';
    if (CFG.voiceSet === 'all' && LOCAL.list) return x[2] || '其他音色';
    return '⭐ 推荐音色';
  }
  function localVoiceOptions() {
    var list = localVoiceList(), html = '', last = null;
    list.forEach(function (x) {
      var g = voiceGroup(x);
      if (g !== last) {
        if (last !== null) html += '</optgroup>';
        html += '<optgroup label="' + esc(g) + '">'; last = g;
      }
      html += '<option value="' + x[0] + '"' + (CFG.localVoice === x[0] ? ' selected' : '') + '>' + esc(x[1]) + '</option>';
    });
    return html + (last !== null ? '</optgroup>' : '');
  }
  /* 旧配置指向已删除 / 未安装的音色时，自动落到第一个可用音色 */
  function fixLocalVoice() {
    var av = (LOCAL.info && LOCAL.info.voices) || null;
    var pool = (LOCAL.list || LOCAL_VOICES).filter(function (x) { return !av || av[x[0]] !== false; });
    if (!pool.length) return;
    if (!pool.some(function (x) { return x[0] === CFG.localVoice; })) {
      CFG.localVoice = pool[0][0]; saveCfg();
    }
  }
  var LOCAL = { ready: false, checking: false, info: null, list: null, miss: 0 };
  function localBase() { return 'http://127.0.0.1:' + (Number(CFG.localPort) || 8177); }
  function localReady() { return !!(CFG.localOn && LOCAL.ready); }
  function localErrText(status, txt) {
    if (status === 404) return '服务路径不匹配，请更新语音包';
    if (status === 503) return '语音引擎正在初始化，稍后再试';
    return 'HTTP ' + status + (txt ? '：' + String(txt).slice(0, 80) : '');
  }
  /* 探测本机语音引擎；服务未启动时静默回退系统语音，不打扰阅读 */
  function localProbe(force) {
    if (LOCAL.checking) return Promise.resolve(LOCAL.ready);
    if (!CFG.localOn) { LOCAL.ready = false; return Promise.resolve(false); }
    LOCAL.checking = true;
    return withTimeout(fetch(localBase() + '/health', { method: 'GET', cache: 'no-store' }), 2200)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        LOCAL.ready = !!(j && j.ok); LOCAL.info = j || null; LOCAL.checking = false;
        LOCAL.list = buildVoiceList(j);
        LOCAL.miss = LOCAL.ready ? 0 : LOCAL.miss + 1;
        if (LOCAL.ready) fixLocalVoice();
        fillVoices(); if (force && LOCAL.ready) toast('已连接免费离线神经语音（' + localVoiceList().length + ' 个声线可用）', 2600);
        return LOCAL.ready;
      })
      .catch(function () {
        LOCAL.ready = false; LOCAL.info = null; LOCAL.list = null; LOCAL.checking = false; LOCAL.miss++;
        fillVoices(); if (force) toast('没找到本地语音引擎，请先双击「VoicePack/启动语音引擎.cmd」', 5200);
        return false;
      });
  }
  function localURL(text, voice) {
    return fetch(localBase() + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, voice: voice || CFG.localVoice, speed: Number(CFG.rate) || 1 })
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(localErrText(r.status, t)); });
      return r.blob();
    }).then(function (b) {
      if (!b || b.size < 1000) throw new Error('服务返回的音频为空');
      return URL.createObjectURL(b);
    });
  }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; rej(new Error('请求超时（语音引擎未响应）')); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); res(v); } },
        function (e) { if (!done) { done = true; clearTimeout(t); rej(e); } });
    });
  }
  function revokeURL(u) { if (u && String(u).indexOf('blob:') === 0) { try { URL.revokeObjectURL(u); } catch (e) {} } }
  function stopLocalAudio() {
    if (SPK.audio) {
      try {
        SPK.audio.pause(); SPK.audio.onended = null; SPK.audio.onerror = null;
        revokeURL(SPK.audio.src); SPK.audio.src = '';
      } catch (e) {}
      SPK.audio = null;
    }
    if (SPK.prefetch && SPK.prefetch.p) { SPK.prefetch.p.then(function (u) { revokeURL(u); }, function () {}); }
    SPK.prefetch = null;
  }
  function localFail(msg) {
    toast('本地语音引擎不可用：' + msg + '。已切回系统朗读（双击「VoicePack/启动语音引擎.cmd」可恢复）', 7000);
    LOCAL.ready = false; fillVoices();
    SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio();
    if (SPK.playing) speakChunk(0);
  }
  function localPrefetch() {
    var t = SPK.chunks[SPK.ci + 1];
    if (!t || !localReady()) return;
    var v = SPK.cv[SPK.ci + 1] || CFG.localVoice;
    var p = localURL(t, v);
    SPK.prefetch = { ch: BK ? BK.ch : -1, text: t, v: v, p: p };
    p.catch(function () {});
  }
  function localSpeakChunk() {
    var txt = SPK.chunks[SPK.ci];
    if (txt === undefined) { speakNext(true); return; }
    var g = ++SPK.gen;
    stopLocalAudio();
    highlight();
    var v = SPK.cv[SPK.ci] || CFG.localVoice;
    var pf = SPK.prefetch;
    var p = (pf && pf.text === txt && pf.v === v && pf.ch === (BK ? BK.ch : -1)) ? pf.p : localURL(txt, v);
    SPK.prefetch = null;
    withTimeout(p, 30000).then(function (u) {
      if (g !== SPK.gen || !SPK.playing) { revokeURL(u); return; }
      var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
      SPK.audio = a;
      a.onended = function () { if (g === SPK.gen && SPK.playing) speakNext(false); };
      a.onerror = function () { if (g === SPK.gen) localFail('音频加载失败'); };
      try {
        var q = a.play();
        if (q && q.catch) q.catch(function () { if (g === SPK.gen) localFail('浏览器阻止了播放，请点一下页面'); });
      } catch (e) { localFail(e.message); return; }
      localPrefetch();
    }).catch(function (e) {
      if (g === SPK.gen) localFail(e.message || '请求失败');
    });
  }
  /* 语音分级：Natural / Neural = 神经网络语音（接近真人）；localService=false = 在线合成 */
  var VOICE_CN = {
    xiaoxiao: '晓晓 · 女声', xiaoyi: '晓伊 · 女声', yunyang: '云扬 · 男声(播报)',
    yunxi: '云希 · 男声', yunjian: '云健 · 男声', yunxia: '云夏 · 男声',
    huihui: '慧慧', kangkang: '康康', yaoyao: '瑶瑶', hanhan: '涵涵', tracy: 'Tracy'
  };
  function isNatural(v) { return /natural|neural/i.test((v && v.name) || ''); }
  function isZh(v) { return /^zh/i.test((v && v.lang) || ''); }
  function voiceKey(v) { return (v && (v.voiceURI || v.name)) || ''; }
  function voiceTier(v) {
    var n = isNatural(v), z = isZh(v), online = v && v.localService === false;
    if (z && n) return 0;
    if (z && online) return 1;
    if (z) return 2;
    if (n) return 3;
    return 4;
  }
  function voiceLabel(v) {
    var nm = (v && v.name) || '', short = '';
    Object.keys(VOICE_CN).forEach(function (k) {
      if (!short && nm.toLowerCase().indexOf(k) >= 0) short = VOICE_CN[k];
    });
    if (!short) short = nm.replace(/\s*Online.*$/i, '').replace(/^Microsoft\s*/i, '').replace(/\s*-\s*.*$/, '').trim() || nm;
    var tag = isNatural(v) ? '自然' : (v.localService === false ? '在线' : '本地');
    return short + ' · ' + tag + ' · ' + (v.lang || '');
  }
  function bestVoice(vs) {
    var a = vs.slice().sort(function (x, y) {
      var d = voiceTier(x) - voiceTier(y); if (d) return d;
      var ax = /xiaoxiao/i.test(x.name || '') ? 0 : 1, bx = /xiaoxiao/i.test(y.name || '') ? 0 : 1;
      return ax - bx || (x.name || '').localeCompare(y.name || '');
    });
    return a[0] || null;
  }
  function voiceBadge(v) {
    var b = $('spQuality'); if (!b) return;
    if (localReady()) {
      b.textContent = '● 免费神经语音'; b.className = 'vq good';
      b.title = '本机 sherpa-onnx 神经语音：完全离线、免费、无需账号。当前音色：' + localVoiceName(CFG.localVoice) + '。左侧下拉可随时换音色，点这里看说明';
      var s = $('spVoice');
      if (s) {
        // 连上本机引擎后下拉不再禁用：精选声线就在这里换，听书时可边听边比
        s.disabled = false;
        s.title = '本机 ' + localVoiceList().length + ' 个离线声线，选中即生效（当前：' + localVoiceName(CFG.localVoice) + '）';
        var lv = 'local:' + CFG.localVoice;
        if (s.value !== lv && s.querySelector('option[value="' + lv + '"]')) s.value = lv;
      }
      return;
    }
    if ($('spVoice')) { $('spVoice').disabled = false; $('spVoice').title = '朗读语音'; }
    if (!v) { b.textContent = '无语音'; b.className = 'vq bad'; return; }
    var n = isNatural(v), on = v.localService === false;
    b.textContent = n ? '● 自然语音' : (on ? '● 在线语音' : '● 本地语音（较机械）');
    b.className = 'vq ' + (n ? 'good' : (on ? 'mid' : 'bad'));
    b.title = n ? '神经网络语音：语调接近真人；需联网，朗读文字会发送给语音服务合成。点击看说明'
      : (on ? '在线合成，需联网。点击看说明' : '系统本地语音，离线可用但音质较机械。点击看说明');
  }
  /* 朗读条只放精选声线 + 当前选中的那个（真正在用的必须在条上可见），
     其余声线进设置页挑，避免条上下拉长到 174 项 */
  function localBarList() {
    var all = localVoiceList();
    if (CFG.voiceSet !== 'all') return all;
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    var out = all.filter(function (x) { return cur.indexOf(x[0]) >= 0; });
    if (CFG.localVoice && !out.some(function (x) { return x[0] === CFG.localVoice; })) {
      var me = all.filter(function (x) { return x[0] === CFG.localVoice; })[0];
      if (me) out = [me].concat(out);
    }
    return out;
  }
  function fillVoices() {
    var sel = $('spVoice'), vs = SYN ? (SYN.getVoices() || []) : [];
    var loc = localReady(), html = '';
    // 本机声线直接进朗读条：听书时一键换，不用跳设置页
    if (loc) {
      var lv = localBarList(), total = voiceStat().total;
      html += '<optgroup label="⭐ 本机神经语音 · 免费离线（' + lv.length + ' 个声线）">' + lv.map(function (x) {
        return '<option value="local:' + x[0] + '"' + (x[0] === CFG.localVoice ? ' selected' : '') + '>' +
          esc(x[1]) + '</option>';
      }).join('');
      if (total > lv.length) {
        html += '<option value="__more">⋯ 还有 ' + (total - lv.length) + ' 个声线，去设置里挑</option>';
      }
      html += '</optgroup>';
    }
    if (!vs.length) {
      sel.innerHTML = html || '<option value="">（系统暂无语音）</option>';
      if (loc) sel.value = 'local:' + CFG.localVoice;
      voiceBadge(null); return;
    }
    var groups = [
      [0, '⭐ 自然语音 · 接近真人（需联网）'], [1, '在线语音（需联网）'],
      [2, '本地语音 · 较机械（离线可用）'], [3, '其他语言 · 自然语音'], [4, '其他语言']
    ];
    groups.forEach(function (g) {
      var arr = vs.filter(function (v) { return voiceTier(v) === g[0]; });
      if (!arr.length) return;
      arr.sort(function (a, b) {
        var ax = /xiaoxiao/i.test(a.name || '') ? 0 : 1, bx = /xiaoxiao/i.test(b.name || '') ? 0 : 1;
        return ax - bx || (a.name || '').localeCompare(b.name || '');
      });
      html += '<optgroup label="' + esc(g[1]) + '">' + arr.map(function (v) {
        return '<option value="' + esc(voiceKey(v)) + '">' + esc(voiceLabel(v)) + '</option>';
      }).join('') + '</optgroup>';
    });
    sel.innerHTML = html;
    // 本机引擎可用时，默认就停在本机声线上；系统语音仍保留在下拉里备选
    if (loc) { sel.value = 'local:' + CFG.localVoice; voiceBadge(null); return; }
    var cur = vs.filter(function (v) { return voiceKey(v) === CFG.voiceURI; })[0] || null;
    // 旧配置停在机械语音时，自动升级到神经语音（用户手动选过则不再干预）
    if (CFG.voiceAuto && cur && isZh(cur) && !isNatural(cur)) {
      var best = bestVoice(vs);
      if (best && isNatural(best) && isZh(best)) {
        cur = best; CFG.voiceURI = voiceKey(best); saveCfg();
        setTimeout(function () { toast('已自动切换到更自然的语音：' + voiceLabel(best).split(' · ')[0] + '（朗读条可随时更换）', 4600); }, 1000);
      }
    }
    if (!cur) { cur = bestVoice(vs); if (cur) { CFG.voiceURI = voiceKey(cur); saveCfg(); } }
    if (cur) sel.value = voiceKey(cur);
    voiceBadge(cur);
  }
  function curVoice() {
    var vs = SYN ? (SYN.getVoices() || []) : [];
    var uri = $('spVoice') ? $('spVoice').value : CFG.voiceURI;
    return vs.filter(function (v) { return voiceKey(v) === uri; })[0] || null;
  }
  /* 文本规范化：去掉零宽符、汉字间排版空格、重复标点；保留引号破折号供语音自行处理停顿 */
  function normSpeak(text) {
    var s = String(text || '');
    s = s.replace(/[\u200b-\u200f\ufeff\u00ad]/g, '');
    s = s.replace(/[\t\r\n\u3000]+/g, ' ');
    s = s.replace(/([\u4e00-\u9fff\u3400-\u4dbf])\s+(?=[\u4e00-\u9fff\u3400-\u4dbf])/g, '$1');
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/([。！？!?；;，,、：:…])\1+/g, '$1');
    s = s.replace(/[*#_~`^|]/g, '');
    return s.trim();
  }
  /* 按完整句子切分后再合并成不超过 maxLen 的朗读块，避免从句中间硬切破坏语调 */
  function splitSpeak(text, maxLen) {
    var M = Math.max(14, maxLen || 60), s = normSpeak(text), out = [], parts = [], buf = '';
    if (!s) return out;
    var sen = s.match(/[^。！？!?；;…]+[。！？!?；;…]*|[。！？!?；;…]+/g) || [s];
    sen.forEach(function (x) {
      if (!x) return;
      if (x.length <= M) { parts.push(x); return; }
      var sub = x.match(/[^，,、：:]+[，,、：:]?/g) || [x], b2 = '';
      sub.forEach(function (y) {
        if (b2.length + y.length > M && b2) { parts.push(b2); b2 = ''; }
        while (y.length > M) { if (b2) { parts.push(b2); b2 = ''; } parts.push(y.slice(0, M)); y = y.slice(M); }
        b2 += y;
      });
      if (b2) parts.push(b2);
    });
    parts.forEach(function (p) {
      p = p.trim(); if (!p) return;
      if (buf && buf.length + p.length > M) { out.push(buf); buf = ''; }
      buf += p;
    });
    if (buf) out.push(buf);
    return out;
  }
  /* ---------------- 分角色朗读 ----------------
     把一段正文切成「旁白」与「引号里的对白」两种片段：旁白用用户选的声线，
     对白按人物固定分配不同声线——同一个人物整本书都是同一个声音。
     认人靠中文小说最常见的「某某说道：」句式；认不出人名时按出场顺序轮换，
     所以即使全都认不出，对话也不会和旁白混成一个声音。 */
  var SPEAK_VERB = '说|道|问|答|喊|叫|笑|骂|吼|嚷|嘟囔|喃喃|低语|低声|轻声|冷笑|回答|反问|开口|自语';
  var NAME_STOP = /^(?:他|她|它|我|你|大家|众人|两人|二人|一人|有人|对方|那人|这人|此时|这时|于是|接着|然后|突然|忽然|连忙|急忙|赶紧|立刻|随后|最后|终于|不禁|忍不住|一面|一边|这话|说完|说完话|听了|闻言|见状|心想|心中|心里)$/;
  var FEMALE_HINT = /女|妈|姐妹|奶|婆|姑|姨|嫂|婶|娘|妇|太太|夫人|姑娘|小姐|丫头/;
  var MALE_HINT = /男|爸|哥|弟|爷|叔|伯|舅|兄|先生|老爷|少爷|公子|老头|汉子|他/;
  /* 对白音色池里额外补的男声：精选 11 个里只有 1 个男声，对话需要更多男声 */
  var EXTRA_MALE = ['s72', 's124', 's69', 's58', 's21', 's52'];

  function speakerOf(full, at, after) {
    var pre = full.slice(Math.max(0, at - 22), at).replace(/[\s\n]+/g, '');
    // ① 引号前：「某某说道：」
    var m = pre.match(new RegExp('([\\u4e00-\\u9fa5]{2,4})(?:' + SPEAK_VERB + ')(?:道|说)?[：:，,]?$'));
    if (m && !NAME_STOP.test(m[1])) return m[1].slice(-3);
    // ② 引号前是「他/她 + 动作 + 说」
    if (new RegExp('(^|[^他])他[^，。！？]{0,8}(?:' + SPEAK_VERB + ')').test(pre)) return '他';
    if (new RegExp('(^|[^她])她[^，。！？]{0,8}(?:' + SPEAK_VERB + ')').test(pre)) return '她';
    // ③ 引号后紧跟「她/他」：中文小说里最常见的主语后置
    var post = String(after || '').replace(/^[\s\u3000]+/, '').slice(0, 24);
    var pm = post.match(/^([他她])(?![们])/);
    if (pm) return pm[1];
    // ④ 引号后是「某某放下报纸，慢慢问道」：名字锚在开头，动词可隔几个字
    //    3 字只在「名字紧贴动词」时采用，避免把「老人放下」当成名字
    var cand = [];
    [2, 3].forEach(function (L) {
      var nm = post.slice(0, L);
      if (nm.length < L || /[^\u4e00-\u9fa5]/.test(nm) || NAME_STOP.test(nm)) return;
      var rest = post.slice(L, L + 14);
      var vm = rest.match(new RegExp('^[^。！？]{0,12}?(?:' + SPEAK_VERB + ')'));
      if (vm) cand.push({ nm: nm, gap: vm[0].length, len: L });
    });
    if (!cand.length) return '';
    var three = cand.filter(function (x) { return x.len === 3 && x.gap <= 1; })[0];
    return (three || cand.filter(function (x) { return x.len === 2; })[0] || cand[0]).nm;
  }
  /* 把一段切成 [{t: 文本, role: 'narr'|'say', who: 人名}] */
  function roleSegments(text) {
    var out = [], last = 0, m;
    var re = /「([^」]{0,400})」|『([^』]{0,400})』|“([^”]{0,400})”|"([^"]{0,400})"/g;
    while ((m = re.exec(text))) {
      var inner = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
      var before = text.slice(last, m.index);
      if (before.trim()) out.push({ t: before, role: 'narr' });
      if (inner && inner.trim()) {
        out.push({ t: inner, role: 'say', who: speakerOf(text, m.index, text.slice(m.index + m[0].length)) });
      }
      last = m.index + m[0].length;
    }
    var tail = text.slice(last);
    if (tail.trim() || !out.length) out.push({ t: tail || text, role: 'narr' });
    return out;
  }
  function genderOf(who) {
    if (!who) return '';
    if (who === '他') return 'm';
    if (who === '她') return 'f';
    if (FEMALE_HINT.test(who)) return 'f';
    if (MALE_HINT.test(who)) return 'm';
    return '';
  }
  /* 候选声线：精选 11 个 + 补充男声；按「男女混合 / 全女声 / 全男声」过滤 */
  function rolePool(gender) {
    var all = LOCAL.list || LOCAL_VOICES, band = {};
    all.forEach(function (x) { band[x[0]] = x[2] || ''; });
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    var keys = cur.length ? cur.slice() : all.map(function (x) { return x[0]; });
    EXTRA_MALE.forEach(function (k) { if (band[k] !== undefined && keys.indexOf(k) < 0) keys.push(k); });
    var want = CFG.rolePool || 'mix';
    if (want === 'mix') want = (gender === 'm' ? 'male' : gender === 'f' ? 'female' : 'mix');
    return keys.filter(function (k) {
      if (k === CFG.localVoice) return false;
      var male = String(band[k] || '').indexOf('男声') === 0;
      if (want === 'male') return male;
      if (want === 'female') return !male;
      return true;
    });
  }
  /* 给一个人物挑声音：先按性别过滤，再挑「被用得最少」的那个，保证几个人物声音不撞 */
  function castVoice(who) {
    var pool = rolePool(genderOf(who));
    if (!pool.length) return CFG.localVoice;
    if (who && SPK.cast[who]) return SPK.cast[who];
    var pick = pool[0], best = 1e9;
    pool.forEach(function (k) { var c = SPK.used[k] || 0; if (c < best) { best = c; pick = k; } });
    if (who) { SPK.cast[who] = pick; SPK.castName[pick] = who; }
    SPK.used[pick] = (SPK.used[pick] || 0) + 1;
    return pick;
  }
  function resetCast() { SPK.cast = {}; SPK.used = {}; SPK.castName = {}; }
  function roleLabel() {
    if (!CFG.roleOn) return '';
    if (!localReady()) return '';
    return '多角色';
  }

  function onlineFallback() {
    if (SPK.fb) return false;
    var vs = SYN ? (SYN.getVoices() || []) : [];
    var local = vs.filter(function (v) { return isZh(v) && v.localService !== false; })[0];
    if (!local) return false;
    SPK.fb = 1; CFG.voiceURI = voiceKey(local); CFG.voiceAuto = 0; saveCfg();
    if ($('spVoice')) $('spVoice').value = CFG.voiceURI;
    voiceBadge(local);
    toast('在线自然语音连接失败，已自动切回本地语音（联网恢复后可在语音下拉里重新选）', 5200);
    SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    try { SYN.cancel(); } catch (e) {}
    if (SPK.playing) speakChunk(0);
    return true;
  }
  function highlight() {
    $('page').querySelectorAll('.rdp.speaking').forEach(function (e) { e.classList.remove('speaking'); });
    var p = SPK.paras[SPK.pi];
    if (p) {
      p.classList.add('speaking');
      if (CFG.follow) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    var t = (SPK.chunks[SPK.ci] || '').slice(0, 46);
    var who = '';
    if (CFG.roleOn && localReady() && SPK.cv[SPK.ci] && SPK.cv[SPK.ci] !== CFG.localVoice) {
      var nm = SPK.castName[SPK.cv[SPK.ci]] || '对白';
      who = '<b class="spwho">' + esc(nm) + '</b>';
    }
    $('spNow').innerHTML = '<span class="spdot"></span>' + who + esc(t);
  }
  function speakChunk(delay) {
    if (!SPK.playing) return;
    // 句间 / 段间留白：神经网络语音靠完整句子产生语调，句与句之间留一点静默更接近真人
    if (delay > 0) {
      clearTimeout(SPK.gapT);
      SPK.gapT = setTimeout(function () { if (SPK.playing) speakChunk(0); }, delay);
      return;
    }
    if (localReady()) return localSpeakChunk();
    if (!SYN || !UTT) return;
    var txt = SPK.chunks[SPK.ci];
    if (txt === undefined) { speakNext(true); return; }
    var g = ++SPK.gen;
    var u = new UTT(txt), v = curVoice(), online = v && v.localService === false;
    if (v) { u.voice = v; u.lang = v.lang; }
    else u.lang = 'zh-CN';
    u.rate = Number(CFG.rate); u.pitch = Number(CFG.pitch); u.volume = Number(CFG.volume);
    u.onend = function () { if (g !== SPK.gen) return; SPK.seenEnd = true; clearTimeout(SPK.watch); speakNext(false); };
    u.onerror = function () {
      if (g !== SPK.gen) return; clearTimeout(SPK.watch);
      if (online && onlineFallback()) return;
      speakNext(false);
    };
    highlight();
    try { SYN.speak(u); } catch (e) { toast('朗读启动失败：' + e.message); stopSpeak(false); return; }
    // 长文本静默停止看门狗：按字数 + 语速动态估算，在线语音额外预留合成时间
    clearTimeout(SPK.watch);
    var est = Math.max(7000, Math.min(34000,
      txt.length * 340 / (Number(CFG.rate) || 1) + (online ? 5500 : 2500)));
    SPK.watch = setTimeout(function () {
      if (g !== SPK.gen || !SPK.playing) return;
      try { SYN.cancel(); } catch (e) {}
      if (online && !SPK.seenEnd && onlineFallback()) return;
      speakNext(false);
    }, est);
  }
  function speakNext(auto) {
    if (!SPK.playing) return;
    SPK.ci++;
    if (SPK.ci < SPK.chunks.length) { speakChunk(Number(CFG.pause) || 0); return; }
    SPK.pi++;
    if (SPK.pi >= SPK.paras.length) {
      if (CFG.autoNext && BK && BK.ch < chapterCount() - 1) {
        renderChapter(BK.ch + 1, { fromSpeak: true });
        SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
        SPK.pi = 0; setPara(0); speakChunk(0); return;
      }
      stopSpeak(false); toast('朗读结束'); return;
    }
    setPara(SPK.pi); speakChunk(Math.min(900, (Number(CFG.pause) || 0) * 2));
  }
  function setPara(i) {
    SPK.pi = Math.max(0, Math.min(SPK.paras.length - 1, i));
    // 自然语音喂整句才有连贯韵律；本地老引擎用短句规避长文本静默停止
    var natural = localReady() || isNatural(curVoice());
    var M = CFG.whole ? (natural ? 90 : 42) : 30;
    M = Math.round(M * Math.min(1, Number(CFG.rate) || 1));
    var text = (SPK.paras[SPK.pi] || {}).textContent || '';
    SPK.chunks = []; SPK.cv = [];
    if (CFG.roleOn && localReady()) {
      // 分角色：旁白用所选声线，引号里的对白按人物换声（同一人物全书同一个声音）
      roleSegments(text).forEach(function (seg) {
        var v = seg.role === 'say' ? castVoice(seg.who) : CFG.localVoice;
        splitSpeak(seg.t, Math.max(16, M)).forEach(function (t) {
          SPK.chunks.push(t); SPK.cv.push(v);
        });
      });
    }
    if (!SPK.chunks.length) SPK.chunks = splitSpeak(text, Math.max(16, M));
    SPK.ci = 0;
    // 记住「听到哪」，下次可从书架一键续听（与「读到哪」分开记，互不打扰）
    if (BK && BK.meta && SPK.on) {
      BK.meta.lCh = BK.ch; BK.meta.lPi = SPK.pi; savePos();
    }
  }
  var TRY_TEXT = '窗外的雨下得很细，字落在纸上，像脚印落在雪里。他合上书，听见声音还留在屋里，没有立刻散去。';
  /* 模型里到底有多少声音、男女各多少：设置页文案直接用它，别写死数字 */
  function voiceStat() {
    var all = LOCAL.list || LOCAL_VOICES;
    var cur = (LOCAL.info && LOCAL.info.curated) || [];
    var male = all.filter(function (x) { return String(x[2] || '').indexOf('男声') === 0; }).length;
    return { total: all.length, female: all.length - male, male: male,
             curated: cur.length || LOCAL_VOICES.length };
  }
  function syncRoleBtn() {
    var b = $('spRole'); if (!b) return;
    b.classList.toggle('on', !!CFG.roleOn);
    b.textContent = CFG.roleOn ? '多角色' : '单声线';
    b.title = CFG.roleOn
      ? '分角色朗读已开启：旁白用当前声线，引号里的对白按人物换声。点击关闭'
      : '分角色朗读：对话自动换声（旁白保持当前声线）。点击开启';
  }
  function toggleRole() {
    if (!CFG.roleOn && !localReady()) {
      toast('分角色朗读需要本机神经语音（系统语音只能出一个声音）：先双击「VoicePack/启动语音引擎.cmd」', 6200);
      return;
    }
    CFG.roleOn = CFG.roleOn ? 0 : 1; saveCfg(); syncRoleBtn(); resetCast();
    if (SPK.playing) speakJump(0);
    else if (SPK.on) setPara(SPK.pi);
    toast(CFG.roleOn ? '分角色朗读已开启：旁白照旧，对白按人物换声' : '已回到单一声音', 3000);
  }
  var ROLE_TRY = '他把伞靠在门边，抖了抖上面的水。“外面雨真大。”她抬头看了一眼，又说：“今晚就别走了。”';
  /* 试听分角色：旁白 + 两句不同人物对白，挨个念一遍，听完就知道效果 */
  function tryRole() {
    if (!localReady()) { toast('分角色试听需要本机神经语音：先双击「VoicePack/启动语音引擎.cmd」', 5600); return; }
    if (SPK.playing) stopSpeak(false);
    var keepCast = SPK.cast, keepUsed = SPK.used;
    SPK.cast = {}; SPK.used = {};
    var jobs = [];
    roleSegments(ROLE_TRY).forEach(function (s) {
      jobs.push({ t: s.t, v: s.role === 'say' ? castVoice(s.who) : CFG.localVoice });
    });
    SPK.cast = keepCast; SPK.used = keepUsed;
    toast('分角色试听：旁白 + ' + Math.max(0, jobs.length - 1) + ' 句对白，声音各不相同', 3400);
    var i = 0;
    (function next() {
      if (i >= jobs.length) return;
      var j = jobs[i++];
      withTimeout(localURL(j.t, j.v), 30000).then(function (u) {
        var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
        a.onended = a.onerror = function () { revokeURL(u); next(); };
        try { var q = a.play(); if (q && q.catch) q.catch(function () { revokeURL(u); }); }
        catch (e) { revokeURL(u); }
      }).catch(function (e) { toast('试听失败：' + e.message, 5200); });
    })();
  }
  function tryVoice() {
    if (SPK.playing) { stopSpeak(false); toast('已暂停书本朗读，开始试听'); }
    if (localReady()) {
      toast('正在试听免费离线音色：' + localVoiceName(CFG.localVoice) + ' …', 3200);
      withTimeout(localURL(TRY_TEXT), 30000).then(function (u) {
        var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
        try {
          var q = a.play(); if (q && q.catch) q.catch(function () {});
          a.onended = a.onerror = function () { revokeURL(u); };
        } catch (e) { revokeURL(u); }
      }).catch(function (e) { toast('试听失败：' + e.message, 5600); });
      return;
    }
    if (!SYN || !UTT) { toast('当前浏览器不支持朗读，请用新版 Edge'); return; }
    var v = curVoice();
    try { SYN.cancel(); } catch (e) {}
    var u = new UTT(TRY_TEXT);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'zh-CN';
    u.rate = Number(CFG.rate); u.pitch = Number(CFG.pitch); u.volume = Number(CFG.volume);
    SPK.trying = true;
    toast('正在试听：' + (v ? voiceLabel(v).split(' · ')[0] : '默认语音') + '（不影响书本进度）', 3200);
    u.onend = u.onerror = function () { SPK.trying = false; };
    try { SYN.speak(u); } catch (e) { SPK.trying = false; toast('试听失败：' + e.message); }
  }
  function startSpeak(fromPi) {
    if ((!SYN || !UTT) && !localReady()) { toast('当前浏览器不支持朗读，请用新版 Edge / Chrome'); return; }
    if (!BK) return;
    SPK.on = true; SPK.fb = 0; SPK.seenEnd = false;
    SPK.prefetch = null; stopLocalAudio(); voiceBadge(curVoice());
    $('speakBar').classList.add('on'); syncRoleBtn();
    if (!$('spVoice').options.length || $('spVoice').options[0].value === '') fillVoices();
    SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
    if (!SPK.paras.length) {
      // 封面页 / 纯图片页：自动往后找有文字的章节
      var tries = 0;
      while (!SPK.paras.length && BK.ch < chapterCount() - 1 && tries < 5) {
        renderChapter(BK.ch + 1, { fromSpeak: true });
        SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
        tries++;
      }
      if (!SPK.paras.length) { toast('这几章都没有可朗读的文字'); return; }
    }
    setPara(fromPi === undefined ? currentPara() : fromPi);
    SPK.playing = true;
    try { SYN.cancel(); } catch (e) {}
    speakChunk(0); $('spPlay').textContent = '❚❚';
    if (!$('spVoice').options.length || $('spVoice').options[0].value === '') fillVoices();
    var cv = curVoice();
    if (SYN && !(SYN.getVoices() || []).length) toast('系统未检测到朗读语音；Windows 可在「设置→时间和语言→语音」添加中文语音', 5200);
    else if (SYN && !localReady() && cv && !isNatural(cv)) toast('当前是机械语音；装一次免费语音包即可离线听接近真人的中文，详见「免费神经语音」', 5600);
  }
  function toggleSpeak() {
    if (!SPK.on) { startSpeak(); return; }
    if (SPK.playing) {
      SPK.playing = false; clearTimeout(SPK.gapT);
      if (SPK.audio) { try { SPK.audio.pause(); } catch (e) {} }
      else { SPK.gen++; clearTimeout(SPK.watch); try { SYN.pause(); } catch (e) {} }
      $('spPlay').textContent = '▶'; $('spNow').textContent = '已暂停';
    } else {
      SPK.playing = true; clearTimeout(SPK.gapT);
      $('spPlay').textContent = '❚❚';
      if (SPK.audio) { try { SPK.audio.play(); } catch (e) {} return; }
      SPK.gen++;
      try { SYN.cancel(); } catch (e) {}
      if (SPK.chunks.length) speakChunk(0); else startSpeak(currentPara());
    }
  }
  function stopSpeak(hide) {
    SPK.playing = false; SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio(); SPK.prefetch = null;
    clearInterval(SPK.timer); SPK.deadline = 0; $('spLeft').textContent = '';
    try { if (SYN) SYN.cancel(); } catch (e) {}
    $('page').querySelectorAll('.rdp.speaking').forEach(function (e) { e.classList.remove('speaking'); });
    $('spPlay').textContent = '▶'; $('spNow').textContent = '';
    if (hide) { SPK.on = false; $('speakBar').classList.remove('on'); }
  }
  function speakJump(d) {
    if (!SPK.paras.length) return;
    var wasPlaying = SPK.playing;
    SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT);
    stopLocalAudio(); SPK.prefetch = null;
    try { SYN.cancel(); } catch (e) {}
    SPK.playing = false;
    setPara(Math.max(0, Math.min(SPK.paras.length - 1, SPK.pi + d)));
    highlight();
    if (wasPlaying) { SPK.playing = true; speakChunk(0); }
  }
  function speakTimer(min) {
    clearInterval(SPK.timer); SPK.deadline = min ? Date.now() + min * 60000 : 0;
    if (!min) { $('spLeft').textContent = ''; return; }
    SPK.timer = setInterval(function () {
      var left = SPK.deadline - Date.now();
      if (left <= 0) { clearInterval(SPK.timer); SPK.deadline = 0; $('spLeft').textContent = ''; stopSpeak(false); toast('朗读定时到，已停止'); return; }
      $('spLeft').textContent = '剩 ' + Math.ceil(left / 60000) + ' 分';
    }, 1000);
    $('spLeft').textContent = '剩 ' + min + ' 分';
  }

  /* ---------------- 弹层 / 文档 ---------------- */
  function showModal(title, body, buttons) {
    $('modalTitle').textContent = title;
    var mb = $('modalBody');
    mb.oninput = mb.onchange = mb.onclick = null;   // 防止多次打开时监听器叠加
    mb.innerHTML = body;
    var f = $('modalFoot'); f.innerHTML = '';
    (buttons || [{ label: '关闭' }]).forEach(function (b) {
      var el = document.createElement('button');
      el.textContent = b.label; if (b.cls) el.className = b.cls;
      el.onclick = function () { if (b.fn) b.fn(); else closeModal(); };
      f.appendChild(el);
    });
    $('modal').classList.add('on');
  }
  function closeModal() { $('modal').classList.remove('on'); }
  function confirmModal(msg, yes) {
    showModal('请确认', '<p>' + esc(msg) + '</p>', [
      { label: '取消' },
      { label: '确定', cls: 'pri', fn: function () { closeModal(); yes(); } }
    ]);
  }
  var DOCS = {
    help: ['使用说明', '<h3>导入</h3><p>书架点「＋ 导入书籍」，可选多本 <code>.txt</code> / <code>.epub</code>。文件只保存在这台设备的浏览器数据库里，导入过程不上传、不联网。</p>' +
      '<h3>阅读</h3><ul><li>顶部「目录」跳章，「搜索」全文找词，「＋书签」记位置。</li><li>底部进度条可拖到全书任意章节；← → 键翻章，空格向下翻页。</li><li>快捷键：← / → 翻章，空格 下翻一屏（朗读中则暂停 / 继续），Ctrl + F 搜索，Esc 退回书架或关掉弹窗。</li><li>「字体」调字号、行距、页宽、字体；「主题」在夜间 / 明亮 / 羊皮纸间切换。</li><li>阅读位置自动保存，下次打开接着读。</li></ul>' +
      '<h3>朗读</h3><p>点「朗读」从当前屏幕位置开始念。底部条可选语音、语速、上一段 / 下一段、定时停止；正在念的段落会高亮并自动跟随滚动，念完一章自动接下一章。</p>' +
      '<p><b>续听</b>：听到哪会单独记住（与「读到哪」分开记，互不干扰）。回到书架，书本卡片下方会出现「▶ 续听 · 第 N 章」，点一下就从上次听的那一段接着念；想按看书的位置念，点开书再点「朗读」即可。朗读条最左边的下拉可随时换声线，正在念时会用新声线把当前这段重念一遍。</p>' +
      '<p>不装任何东西也能直接朗读（用系统自带语音）。想要接近真人的中文，可看「阅读设置 → 免费神经语音」：随成品附带的开源语音库已经装好（约 53 MB，内含 174 个中文说话人），之后<b>永久离线、免费、无需账号</b>。不用它时，语音下拉按「自然语音 / 在线 / 本地」分组，默认优先选最好的那个。</p>' +
      '<h3>备份</h3><p>书架底部「导出备份」保存进度、书签、设置；勾选「含书籍文件」可把原书一起带走。换设备时用「导入备份」还原。</p>'],
    voice: ['语音与朗读', '<h3>为什么会觉得「机械」</h3>' +
      '<p class="kv">只想尽快听到自然的中文？看「阅读设置 → 免费神经语音」：一次下载开源语音库，之后完全离线、不花一分钱。</p>' +
      '<p>浏览器朗读用的是系统语音引擎。Windows 自带的「慧慧 / 康康 / 瑶瑶」是老式拼接合成，语调平、断句硬，听起来像机器人；名称里带 <code>Online (Natural)</code> 的是神经网络语音，会自己处理语调、重音与句末降调，接近真人朗读。</p>' +
      '<h3>三条路怎么选</h3><ul>' +
      '<li><b>⭐ 免费离线神经语音（推荐）</b>：本机跑开源的 sherpa-onnx + AISHELL3 中文多说话人 VITS 模型，语调接近真人，<b>不联网、不收费、不需要账号、不需要 Key</b>。语音库已随成品装好，模型里共 174 个中文说话人（148 女 + 26 男），精选 11 个直接可选，还能按人物分角色朗读；听书前双击一下启动器。详见「免费神经语音」。</li>' +
      '<li><b>⭐ 自然语音</b>：名称含 <code>Natural</code> / <code>Neural</code>，由 Microsoft Edge 提供，音质好但<b>需要联网</b>，国内网络常常连不上微软语音服务。</li>' +
      '<li><b>本地语音</b>：完全离线、响应快，但机械感明显。断网或临时凑合时用它。</li></ul>' +
      '<p>语音下拉已按这几类分组，旁边的标签会显示当前是「● 免费神经语音」还是「● 本地语音（较机械）」；点「试听」可直接对比不同声音，不影响阅读进度。</p>' +
      '<h3>列表里没有自然语音？</h3><ol>' +
      '<li><b>用 Microsoft Edge 打开本文件</b>（右键 → 打开方式 → Microsoft Edge）。Chrome 的中文在线语音依赖 Google 服务，国内多数网络下取不到。</li>' +
      '<li>Edge「设置 → 语言」确认已添加「中文（简体）」；Windows「设置 → 时间和语言 → 语言和区域 → 中文(简体) → 语言选项 → 语音 → 下载」安装语音包，然后重启 Edge。</li>' +
      '<li>也可以不走这条路，直接装免费离线语音包，不依赖任何在线服务。</li></ol>' +
      '<h3>让朗读更自然的三个旋钮</h3><ul>' +
      '<li><b>整句朗读</b>（默认开）：按完整句子切分，不从句中间硬切，神经语音才有连贯语调。</li>' +
      '<li><b>句间停顿</b>（默认 120 毫秒）：句子之间留一点静默，段落间自动加倍；在「阅读设置 → 朗读」可调 0~600 毫秒。</li>' +
      '<li><b>语速 0.9~1.1×</b>：中文听书最舒服的区间，过快会吃掉语气，过慢显得拖沓。</li></ul>' +
      '<h3>隐私说明</h3><p>用免费离线语音包或系统本地语音时，朗读完全在本机完成，<b>不产生任何对外网络请求</b>，书里的一个字都不会离开这台电脑。只有主动选 <code>Online (Natural)</code> 语音时，浏览器才会把正在念的那段文字发给微软合成——这是浏览器语音引擎的行为，本工具不额外上传书籍、进度或设置。</p>' +
      '<p>在线语音连不上时会自动回退到本地语音并提示，不会卡住不动。朗读引擎与音色因设备、系统语言包而异，本工具不保证与真人朗读一致。</p>' +
      '<h3>试听没声音 / 自动切回本地语音？</h3>' +
      '<p>在线神经语音需要连接 <code>speech.platform.bing.com</code>。该域名在国内部分网络下会被阻断或限流（中国区还额外要求短期令牌），表现为点「试听」没声。这不是书籍或本工具的问题，装免费离线语音包即可彻底绕开。</p><ul>' +
      '<li>让 <code>speech.platform.bing.com</code> 走可用的代理 / 加速器（全局模式），然后点「试听」验证；成功后在语音下拉里重新选回「⭐ 自然语音」。</li>' +
      '<li>换网络（例如手机热点）或换个时段再试。</li>' +
      '<li>不想折腾网络：直接看「免费神经语音」，一次下载后永久离线可用。</li></ul>'],
    local: ['免费离线神经语音', '<h3>这是什么</h3>' +
      '<p>一个<b>完全免费、完全离线</b>的中文神经网络语音方案：开源引擎 <code>sherpa-onnx</code>（Apache-2.0）＋ 一份开源中文多说话人 VITS 模型 <code>AISHELL3</code>。语调、停顿、重音接近真人，和 Windows 自带的慧慧 / 康康不是一个量级。</p>' +
      '<p>语音合成在<b>你自己的电脑</b>上完成：不需要注册账号、不需要 API Key、不联网、不按字数收费，书里的文字一个字节都不会发出去。</p>' +
      '<h3>两步开始听（本机已经装好）</h3><ol>' +
      '<li>打开随成品附带的 <code>VoicePack</code> 文件夹，双击 <code>启动语音引擎.cmd</code>。它会开一个小窗口跑本机服务，并自动用 Edge 打开阅读器。<b>不用下载、不用安装、不用填任何东西。</b>（同目录的 <code>START.cmd</code> 是同一个脚本的英文名，随便点哪个都行。）</li>' +
      '<li>阅读器右下角标签变成绿色「● 免费神经语音」即已连上；点「试听音色」确认出声。关掉那个小窗口即停止服务，之后会自动退回系统语音，不影响看书。</li></ol>' +
      '<p class="kv">换一台电脑时：把整个 <code>VoicePack</code> 文件夹拷过去（含已装好的引擎与模型，约 53 MB）即可直接用；若只想拷脚本，在新电脑双击 <code>安装语音包.cmd</code> 重新下载（约 53 MB，走国内加速源，自动分段并发）。Windows 版语音库，拷到别的系统不能直接用。<br><b>Windows 桌面完整版 EXE 已把语音库打包进 exe 内</b>：只拷一个 exe 过去就能听（整个软件约 47 MB），首次启动自动释放到本机缓存，不需要 VoicePack 文件夹。</p>' +
      '<h3>内置音色 · 174 个中文说话人（148 女 + 26 男）</h3>' +
      '<p>同一份模型里就有 174 个不同的中文说话人。下拉默认只列人工挑选命名过的 <b>精选 11 个</b>；想听更多，到「阅读设置 → 免费神经语音 → 声线范围」点「全部 174 个」，下拉会按音高分 7 档列出（男声低沉 / 中音 / 偏亮，女声偏沉 / 中音 / 清亮 / 高音）。点「试听音色」逐个对比，也可以直接在朗读条最左边的下拉里换（正在朗读时会用新音色重念当前这段），语速用朗读条滑块控制。全部是离线神经语音，普通电脑 CPU 就能实时合成。</p>' +
      '<p><b>为什么 174 个声音却不占体积</b>：它们全部来自同一份 29 MB 的 AISHELL3 中文多说话人模型，切换只是换一个 <code>--sid</code> 编号，所以放开到 174 个也是<b>零体积成本</b>。官方只给编号没有花名，「男声低沉 / 女声清亮」是按每个说话人实测的中位基频（F0）分档的，描述词只便于分辨，<b>建议点「试听音色」挑自己最喜欢的那一个</b>。</p>' +
      '<p class="kv">长篇小说先试默认的「声线 12」（温润偏低），想换亮一点的试「声线 160」或「声线 150」，要男声试「声线 110」。合成很快（一句 4~7 秒音频约 1 秒生成）。下拉只列出本机已装好的音色，缺模型文件会自动隐藏。</p>' +
      '<h3>分角色朗读（多人对话自动换声）</h3>' +
      '<p>点朗读条上的「多角色」按钮，或到「阅读设置 → 分角色朗读」开启：<b>旁白还是用你选的声线，引号里的对白按人物自动换成不同的声音</b>。同一个人物整本书都是同一个声音，不同人物不会串；认不出人名时按出场顺序轮换，也不会和旁白混成一个声音。</p>' +
      '<p>角色音色池可选「男女混合 / 全女声 / 全男声」。设置里的「试听效果」会念一小段带对白的示例，直接听差别。正在念的时候开或关都立刻生效，并从当前这一段重新开始念。</p>' +
      '<p class="kv">只在「免费神经语音」下生效——系统语音一次只能出一个声音，做不到分角色。旁白声线就是你在音色里选的那个；想换最常出现的那个角色声音，直接换旁白声线（角色池会自动避开它）。</p>' +
      '<h3>工作原理</h3>' +
      '<p>启动器在本机 <code>127.0.0.1</code> 开一个只监听本机的 HTTP 服务（Python 标准库，零第三方依赖）。阅读器把<b>正在念的那一句</b>发给它，它调用引擎生成 WAV 再回传播放，并自动预取下一句，听起来基本无等待。服务不监听外网、不写日志、不收集任何数据。</p>' +
      '<p><code>VoicePack</code> 文件夹是独立的：<code>tts_server.py</code> 只用 Python 标准库，<code>安装语音包.cmd</code> 只在你主动运行时从官方发布页下载开源文件。它不写注册表、不装系统组件、不开机自启；整个删掉也不影响阅读器本身。</p>' +
      '<h3>连不上 / 没声音</h3><ul>' +
      '<li>标签一直是「● 本地语音」：说明引擎没启动。双击 <code>启动语音引擎.cmd</code>，再到「阅读设置 → 免费神经语音」点「重新检测」。</li>' +
      '<li>提示端口被占用：在设置里改「端口」，启动器与阅读器保持一致即可。</li>' +
      '<li>提示模型缺失：重跑一次 <code>安装语音包.cmd</code>，等它显示下载完成。</li>' +
      '<li>第一次点朗读有 1~2 秒延迟是引擎在加载模型，之后会快很多；老机器可把「句间停顿」调小一点。</li>' +
      '<li>任何失败都会自动切回系统语音，不会卡住，也不会丢阅读进度。</li></ul>' +
      '<h3>许可</h3><p>引擎 <code>sherpa-onnx</code>（Apache-2.0）与 <code>AISHELL3</code> 中文多说话人 VITS 模型均为开源项目，按各自许可证使用；这些开源文件随成品一起放在 VoicePack 文件夹里，只为方便本机调用，可随时整个删除；本阅读器不修改它们、不写系统组件、不联网分发。</p>'],
    faq: ['常见问题', '<h3>朗读声音像机器人？</h3><p>直接用随成品装好的免费离线语音包：双击 <code>VoicePack/启动语音引擎.cmd</code> 即可，不用下载任何东西。完全离线、免费、无需账号，详见「免费神经语音」。不想下载也可以用 Microsoft Edge 打开本文件，在语音下拉选「⭐ 自然语音」分组里的晓晓或云扬。</p>' +
      '<h3>要钱吗？要注册吗？</h3><p>都不要。阅读器本身、离线语音引擎与中文模型全部免费开源，没有账号、没有 Key、没有按量计费，也不上传任何文字。只有 Windows / Edge 自带的在线语音是微软的服务，与收费无关但国内常常连不上。</p>' +
      '<h3>TXT 打开是乱码？</h3><p>默认自动识别 UTF-8 / GB18030 / UTF-16。若仍乱码，到「阅读设置 → TXT 编码」手动指定（GB18030 / Big5 / UTF-16LE），再重新打开这本书。</p>' +
      '<h3>朗读没声音 / 中文念得像英文？</h3><p>Windows：设置 → 时间和语言 → 语音 → 添加中文（简体）语音包；然后重启浏览器。朗读条里的语音下拉要选 <code>zh-CN</code> 开头的项。部分安卓 WebView 没有语音引擎，需装系统 TTS。</p>' +
      '<h3>EPUB 打开失败？</h3><p>支持标准 EPUB2 / EPUB3（ZIP + OPF + spine）。带 DRM 加密、或 Amazon 专用 AZW3 / MOBI 不在支持范围。极端老书的内部路径不规范时，解析器会做大小写与编码容错。</p>' +
      '<h3>清了浏览器缓存，书没了？</h3><p>数据存在浏览器 IndexedDB，清理站点数据会一并删除。重要书籍请先「导出备份」，同时保留原始文件。</p>' +
      '<h3>换电脑 / 手机怎么带过去？</h3><p>导出备份 JSON（勾「含书籍文件」），把 JSON 和这个 HTML 一起拷过去，在新设备点「导入备份」即可。也可只拷 HTML + 原书重新导入。离线语音库是 Windows 版，把 VoicePack 文件夹一起拷过去即可用。</p>' +
      '<h3>书架上的「续听」是什么？</h3><p>听到哪会被单独记住，和「读到哪」互不干扰。听完回到书架，书本卡片下方就有「▶ 续听 · 第 N 章」，点一下从上次听的那一段接着念。想按看书的位置念，点开书再点「朗读」即可。没听过这本书时不会出现这个按钮。</p>' +
      '<h3>念到一半想换个声音？</h3><p>直接点朗读条最左边的下拉，里面是本机精选 11 个声线；设置里「声线范围」可放开到全部 174 个。想把对话也换成不同声音，点旁边的「多角色」。换完会用新声线把当前这一段重念一遍，不用停也不用回书架。想先试听再决定，去「阅读设置 → 免费神经语音 → 试听音色」。</p>' +
      '<h3>手机上按钮挤？</h3><p>书架「版式」可切到手机版 / 电脑版，默认按屏幕宽度自动排。</p>' +
      '<p class="kv">还有问题？读一下「关于」里的实现说明，或到发行包 README 里找反馈入口。</p>'],
    open: ['开源与许可', '<h3>许可证</h3>' +
      '<p><b>墨吟 · MoYin Reader</b> 以 <b>MIT 许可证</b>发布，版权归 <b>© 2026 永远的兰兰（Lanlan Eternal）</b>所有。</p>' +
      '<p>你被允许：自由使用、复制、修改、合并、发布、再授权、甚至商业使用；唯一义务是保留上述版权声明与本许可声明。软件按「现状」提供，不含任何担保。</p>' +
      '<p class="kv">完整英文条款随发行包以 <code>LICENSE</code> 文件提供（MIT，标准全文）。仓库根目录同放一份，转载或二次分发时请一并保留。</p>' +
      '<h3>第三方组件</h3><ul>' +
      '<li><code>sherpa-onnx</code> 语音引擎 —— Apache-2.0，作者 k2-fsa 社区，本项目仅在本机以子进程方式调用。</li>' +
      '<li><code>AISHELL3</code> 中文多说话人 VITS 模型 —— 由开源语料 AISHELL-3 训练，模型与语料按其发布页的 Apache-2.0 条款使用。</li>' +
      '<li><code>pywebview</code> + <code>pythonnet</code> —— BSD-3-Clause / MIT，仅 Windows 桌面壳使用，用于把内置页面装进系统窗口。</li>' +
      '<li><code>PyInstaller</code> —— GPL-2.0 附 bootloader 例外条款，只用于把脚本打成单文件 exe，不影响本项目的 MIT 授权。</li>' +
      '<li>Microsoft Edge WebView2 运行时 —— 微软随系统分发的运行环境，本项目不打包、不修改，仅调用系统已安装的版本。</li></ul>' +
      '<p>上述组件的著作权归各自作者，本项目不改动其源码，也不为其功能、安全或后续维护作担保。语音模型文件单独放在 <code>VoicePack</code> 目录（完整版 exe 内嵌在尾部），可按需删除而不影响阅读功能。</p>' +
      '<h3>本项目自有的部分</h3>' +
      '<p>页面、样式、<code>zipcore.js</code>（自行实现的 ZIP / DEFLATE / 字符编码解码内核）、EPUB 解析、朗读调度、单文件打包与自检脚本均为原创实现，同样以 MIT 授权。其中 DEFLATE 解码按 RFC 1951 规范独立编写，未抄录 zlib 源码。</p>' +
      '<h3>再分发时请注意</h3>' +
      '<p>本软件不附带任何书籍内容。把软件连同语音模型一起转发时，请一并保留 <code>LICENSE</code> 与本文档；不要移除界面里的作者署名，也不要暗示原作者为你的修改版背书。</p>'],
    disclaimer: ['免责声明', '<p>本工具仅供个人阅读自己合法持有的电子书使用，不提供、不获取、不破解任何受版权保护的内容，不绕过任何数字版权管理（DRM）。使用者需自行确保对所导入文件拥有合法使用权，因使用本工具产生的版权纠纷由使用者自行承担。</p>' +
      '<p>导入的书籍、书签与阅读进度全部保存在本机浏览器数据库中，不会上传到任何服务器；作者与本页面均无法访问你的文件内容。<b>唯一例外</b>：当用户主动选择名称含 <code>Online (Natural)</code> 的在线语音时，浏览器会把当前朗读的文字发送给其语音服务进行合成，该行为由浏览器语音引擎发起，与本工具的书籍存储无关。请自行做好原始文件与备份的保管，因浏览器清理、设备故障、文件损坏造成的数据丢失，本工具不承担责任。</p>' +
      '<p>「免费神经语音」用到的 sherpa-onnx 引擎与 AISHELL3 中文多说话人模型是第三方开源软件，由用户自行下载、自行决定是否运行，各自遵守其原始许可证；本工具只是本机调用，不分发、不修改、不为其可用性或安全性作担保。相关脚本只在本机 127.0.0.1 监听，不对外提供服务，请在可信网络环境下使用。</p>' +
      '<p>朗读依赖操作系统 / 浏览器提供的语音引擎，音色、可用性、断句效果因设备而异，不保证与人工朗读一致。驾车、操作机械等需要注意力的场合请勿收听。</p>' +
      '<p>本软件按「现状」提供，不附带任何明示或默示担保。在法律允许的最大范围内，作者不对使用或无法使用本软件造成的任何直接或间接损失（含数据丢失、设备损坏、时间或收入损失）承担责任。</p>' +
      '<p>「墨吟」的名称、界面与文档著作权归作者所有；文中提及的其他产品、公司、语音服务名称可能是其各自所有者的商标，仅用于说明用途，不表示任何关联、赞助或背书。</p>' +
      '<p>若你是权利人，认为本工具或其随附内容侵犯了你的权益，请通过发行包内 README 所示方式联系作者，核实后会及时处理。</p>'],
    about: ['关于', '<p style="font-size:1.2em"><b>墨吟 · MoYin Reader</b></p>' +
      '<p>一个单文件、默认离线的 TXT / EPUB 阅读器，带朗读。双击 HTML 就能用，Windows / Linux / 安卓 / iOS 浏览器均可。</p>' +
      '<p>「墨吟」取「以墨为文、吟而出声」：把纸上的字念出来。中文名与英文名均为本项目自用，与任何同名公司、配音平台、有声主播<b>没有关联</b>，也不代表任何商业背书。</p>' +
      '<p>书架 + 阅读器的布局与朗读机制参考了本机 Koodo Reader 的交互思路，代码为零依赖重写：EPUB 的 ZIP 解压、OPF / NCX / Nav 目录、正文与插图解析全部内置，不加载任何外部脚本或 CDN。</p>' +
      '<p class="kv">朗读可接免费的开源离线神经语音（sherpa-onnx + AISHELL3 多说话人 VITS 模型）：不联网、不收费、无需账号，模型内含 174 个中文说话人（148 女 + 26 男），精选 11 个常用声线，还支持按人物分角色朗读；语音库随成品放在 VoicePack 文件夹里，Windows 桌面完整版 EXE 已把它打包进 exe 内，只拷一个 exe 就能听。</p>' +
      '<p>本软件以 <b>MIT 许可证</b>开源：可自由使用、修改、再分发（含商用），保留版权与许可声明即可。完整条款见「开源与许可」。</p>' +
      '<h3>这一版新加了什么</h3><ul>' +
      '<li><b>174 个声线全放开</b>：模型里的 174 个中文说话人都能用（148 女 + 26 男），按实测音高分 7 档；切换只换 <code>--sid</code>，一分钱体积都不多占。默认仍只列精选 11 个，设置里点「全部 174 个」就展开。</li>' +
      '<li><b>分角色朗读</b>：旁白照旧，引号里的对白按人物自动换声，同一人物全书同一个声音；朗读条上「多角色」一键开关，设置里可限定男女混合 / 全女声 / 全男声，还能一键试听效果。</li>' +
      '<li><b>朗读条直接换声线</b>：离线声线全部放进播放器下拉，正在念时换声线会用新声音重念当前这段。</li>' +
      '<li><b>书架续听</b>：听到哪单独记，「▶ 续听 · 第 N 章」一键接上，不用再找位置。</li>' +
      '<li><b>语音引擎更安静</b>：语音服务改为在阅读器进程内运行，不再复制一个自己，也不会再弹出「Failed to remove temporary directory」的警告；浏览器正常断开连接不再刷报错，健康探测不再刷日志。</li>' +
      '<li><b>许可与署名写全</b>：MIT 正文、第三方组件清单、免责与作者署名都放进了软件内，离线可查。</li></ul>' +
      '<p class="kv">版本 1.6 · 单文件 · 默认零联网 · 数据仅存本机<br>作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）<br>问题反馈与源码：随发行包附带的 README 里有仓库地址</p>']
  };
  function showDoc(k) {
    var d = DOCS[k] || DOCS.help;
    var nav = '<div class="docnav">' + Object.keys(DOCS).map(function (x) {
      return '<button data-doc="' + x + '"' + (x === k ? ' class="on"' : '') + '>' + esc(DOCS[x][0]) + '</button>';
    }).join('') + '</div>';
    showModal(d[0], nav + d[1], [{ label: '关闭' }]);
  }
  function showSettings() {
    localProbe();
    var encOpts = [['auto', '自动识别'], ['utf-8', 'UTF-8'], ['gb18030', 'GB18030 / GBK'], ['big5', 'Big5 繁体'], ['utf-16le', 'UTF-16LE']];
    var h = '<h3>外观</h3><div class="row"><label>主题</label><div class="seg">' +
      [['dark', '夜间'], ['light', '明亮'], ['sepia', '羊皮纸']].map(function (x) {
        return '<button data-set="theme" data-v="' + x[0] + '"' + (CFG.theme === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row"><label>字号</label><input type="range" data-set="fs" min="13" max="34" step="1" value="' + CFG.fs + '"><span id="cfgFs">' + CFG.fs + 'px</span></div>' +
      '<div class="row"><label>行距</label><input type="range" data-set="lh" min="1.3" max="2.6" step="0.05" value="' + CFG.lh + '"><span id="cfgLh">' + CFG.lh + '</span></div>' +
      '<div class="row"><label>页宽</label><input type="range" data-set="pagew" min="420" max="1100" step="20" value="' + CFG.pagew + '"><span id="cfgPw">' + CFG.pagew + 'px</span></div>' +
      '<div class="row"><label>字体</label><div class="seg">' +
      [['serif', '宋体'], ['sans', '黑体'], ['kai', '楷体'], ['mono', '等宽']].map(function (x) {
        return '<button data-set="ff" data-v="' + x[0] + '"' + (CFG.ff === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row"><label>对齐</label><div class="seg">' +
      [['justify', '两端'], ['left', '左对齐']].map(function (x) {
        return '<button data-set="align" data-v="' + x[0] + '"' + (CFG.align === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<h3>朗读</h3><div class="row"><label>默认语速</label><input type="range" data-set="rate" min="0.5" max="2" step="0.1" value="' + CFG.rate + '"><span id="cfgRate">' + Number(CFG.rate).toFixed(1) + '×</span></div>' +
      '<div class="row"><label>句间停顿</label><input type="range" data-set="pause" min="0" max="600" step="20" value="' + CFG.pause + '"><span id="cfgPause">' + CFG.pause + 'ms</span></div>' +
      '<div class="row"><label>选项</label><div class="seg">' +
      [['autoNext', '念完自动下一章'], ['follow', '高亮跟随滚动'], ['whole', '整句朗读（更自然）'],
        ['voiceAuto', '优先自然语音'], ['motion', '减少动效']].map(function (x) {
        return '<button data-set="bool" data-v="' + x[0] + '"' + (CFG[x[0]] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<div class="row"><label>语音</label><button data-doc="voice">语音与朗读说明</button><span class="kv">当前：' +
      esc(voiceLabel(curVoice() || { name: '系统默认', lang: 'zh-CN', localService: true })) + '</span></div>' +
      '<h3>免费神经语音 · 离线开源</h3>' +
      '<p class="kv">本机跑 sherpa-onnx + 开源中文模型（AISHELL3 多说话人 VITS）：接近真人的中文语调，<b>不收费、不联网、不用账号、不用 Key</b>。语音库已随成品装好，听书前双击「VoicePack/启动语音引擎.cmd」即可。</p>' +
      '<div class="row"><label>引擎状态</label><div class="seg">' +
      '<span class="kv" style="align-self:center">' + (localReady() ? '● 已连接（免费神经语音）' : '○ 未检测到（当前用系统语音）') + '</span>' +
      '<button data-act="probe">重新检测</button>' +
      '<button data-set="bool" data-v="localOn"' + (CFG.localOn ? ' class="on"' : '') + '>' + (CFG.localOn ? '自动连接：开' : '自动连接：关') + '</button>' +
      '<button data-doc="local">安装与使用说明</button></div></div>' +
      '<div class="row"><label>音色</label><select data-set="localVoice">' + localVoiceOptions() +
      '</select><button data-act="tryvoice">试听音色</button></div>' +
      '<div class="row"><label>声线范围</label><div class="seg">' +
      [['curated', '精选 ' + voiceStat().curated + ' 个'], ['all', '全部 ' + voiceStat().total + ' 个']].map(function (x) {
        return '<button data-set="voiceSet" data-v="' + x[0] + '"' + (CFG.voiceSet === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<p class="kv">模型里一共 ' + voiceStat().total + ' 个中文说话人（' + voiceStat().female + ' 女 + ' +
      voiceStat().male + ' 男），全部共用同一份模型，<b>放开多少个都不增加体积</b>。「精选」是人工挑过、命名过的 ' +
      voiceStat().curated + ' 个；「全部」按音高分 7 档列出，男低 → 女高任你挑。朗读条最左边的下拉里直接就能换，正在朗读时会从当前这段用新音色重念；也可以在这里选好再点「试听音色」对比。缺模型文件的音色会自动隐藏。</p>' +
      '<div class="row"><label>分角色朗读</label><div class="seg">' +
      '<button data-set="bool" data-v="roleOn"' + (CFG.roleOn ? ' class="on"' : '') + '>' + (CFG.roleOn ? '分角色：开' : '分角色：关') + '</button>' +
      [['mix', '男女混合'], ['female', '全女声'], ['male', '全男声']].map(function (x) {
        return '<button data-set="rolePool" data-v="' + x[0] + '"' + (CFG.rolePool === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '<button data-act="tryrole">试听效果</button></div></div>' +
      '<p class="kv">开启后，<b>旁白用你选的声线，引号里的对白按人物自动换声</b>——「张三说」和「李四道」是两个不同的声音，同一个人物整本书都是同一个声音。认不出人名时按出场顺序轮换，不会和旁白混成一个声音。只在「免费神经语音」下生效；系统语音不支持分角色。</p>' +
      '<div class="row"><label>端口</label><input type="number" data-set="localPort" min="1024" max="65535" step="1" value="' + (Number(CFG.localPort) || 8177) + '" style="width:96px"><span class="kv">默认 8177，需与启动器一致</span></div>' +
      '<p class="kv">朗读文字只发给本机的 127.0.0.1 合成，不产生对外网络请求；引擎没启动时自动用系统语音，不影响看书。</p>' +
      '<h3>文件与界面</h3><div class="row"><label>TXT 编码</label><select data-set="txtEnc">' +
      encOpts.map(function (x) { return '<option value="' + x[0] + '"' + (CFG.txtEnc === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
      '</select><span class="kv">改完重新打开书生效</span></div>' +
      '<div class="row"><label>版式</label><div class="seg">' +
      [['auto', '自动'], ['p', '手机版'], ['l', '电脑版']].map(function (x) {
        return '<button data-set="lay" data-v="' + x[0] + '"' + (CFG.lay === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<p class="kv">设置即时生效并保存在本机。</p>';
    showModal('阅读设置', h, [{ label: '恢复默认', fn: function () { Object.assign(CFG, DEF); saveCfg(); applyCfg(); fillVoices(); showSettings(); toast('已恢复默认'); } }, { label: '完成', cls: 'pri' }]);
    $('modalBody').oninput = function (e) {
      var k = e.target.getAttribute('data-set'); if (!k) return;
      CFG[k] = (k === 'fs' || k === 'pagew' || k === 'pause' || k === 'localPort') ? parseInt(e.target.value, 10)
        : (k === 'lh' || k === 'rate') ? parseFloat(e.target.value) : e.target.value;
      var lab = { fs: 'cfgFs', lh: 'cfgLh', pagew: 'cfgPw', rate: 'cfgRate', pause: 'cfgPause' }[k];
      if (lab) $(lab).textContent = e.target.value + ({ fs: 'px', pagew: 'px', rate: '×', pause: 'ms' }[k] || '');
      saveCfg(); applyCfg();
    };
    $('modalBody').onchange = function (e) {
      var k = e.target.getAttribute('data-set');
      if (k === 'txtEnc') { CFG.txtEnc = e.target.value; saveCfg(); toast('TXT 编码已设为 ' + e.target.value + '，重新打开书生效'); }
      else if (k === 'localVoice') {
        CFG.localVoice = e.target.value; saveCfg(); resetCast(); voiceBadge(curVoice());
        if (SPK.playing) speakJump(0);
        toast('已切换到 ' + localVoiceName(CFG.localVoice) + '，点「试听音色」听听看', 3000);
      }
    };
    $('modalBody').onclick = function (e) {
      var b = e.target.closest('button[data-set],button[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'tryvoice') { tryVoice(); return; }
      if (act === 'tryrole') { tryRole(); return; }
      if (act === 'probe') { LOCAL.miss = 0; localProbe(true).then(function () { showSettings(); }); return; }
      var k = b.getAttribute('data-set'), v = b.getAttribute('data-v');
      if (k === 'bool') CFG[v] = CFG[v] ? 0 : 1; else CFG[k] = v;
      saveCfg(); applyCfg();
      if (v === 'voiceAuto' && CFG.voiceAuto) fillVoices();
      if (v === 'localOn') { LOCAL.ready = false; if (CFG.localOn) localProbe(); voiceBadge(curVoice()); }
      if (v === 'voiceSet') fillVoices();
      if (v === 'voiceSet' || v === 'roleOn' || k === 'rolePool') { if (SPK.playing) speakJump(0); }
      showSettings();
    };
  }
  function showFont() {
    var h = '<div class="row"><label>字号</label><button data-font="fs-">A−</button><span id="fFs">' + CFG.fs + 'px</span><button data-font="fs+">A＋</button>' +
      '<input type="range" data-set="fs" min="13" max="34" step="1" value="' + CFG.fs + '" style="flex:1;min-width:120px"></div>' +
      '<div class="row"><label>行距</label><input type="range" data-set="lh" min="1.3" max="2.6" step="0.05" value="' + CFG.lh + '" style="flex:1"><span id="fLh">' + CFG.lh + '</span></div>' +
      '<div class="row"><label>页宽</label><input type="range" data-set="pagew" min="420" max="1100" step="20" value="' + CFG.pagew + '" style="flex:1"><span id="fPw">' + CFG.pagew + '</span></div>' +
      '<div class="row"><label>字体</label><div class="seg">' +
      [['serif', '宋体'], ['sans', '黑体'], ['kai', '楷体'], ['mono', '等宽']].map(function (x) {
        return '<button data-set="ff" data-v="' + x[0] + '"' + (CFG.ff === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div></div>' +
      '<p class="kv">点选即时生效，自动保存。</p>';
    showModal('字体与版心', h, [{ label: '完成', cls: 'pri' }]);
    $('modalBody').oninput = function (e) {
      var k = e.target.getAttribute('data-set'); if (!k) return;
      CFG[k] = (k === 'fs' || k === 'pagew') ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
      var lab = { fs: 'fFs', lh: 'fLh', pagew: 'fPw' }[k];
      if (lab) $(lab).textContent = e.target.value + ({ fs: 'px', pagew: 'px' }[k] || '');
      saveCfg(); applyCfg();
    };
    $('modalBody').onclick = function (e) {
      var b = e.target.closest('button[data-set],button[data-font]'); if (!b) return;
      var f = b.getAttribute('data-font');
      if (f) { CFG.fs = Math.max(13, Math.min(34, CFG.fs + (f === 'fs+' ? 1 : -1))); saveCfg(); applyCfg(); showFont(); return; }
      CFG[b.getAttribute('data-set')] = b.getAttribute('data-v'); saveCfg(); applyCfg(); showFont();
    };
  }

  /* ---------------- 备份 ---------------- */
  async function exportBak(withFiles) {
    var safeCfg = Object.assign({}, CFG); // 设置里没有任何密钥，可完整备份
    var books = await dbAll('books'), data = {
      app: 'MoYinReader', v: 1, exported: new Date().toISOString(),
      cfg: safeCfg, books: books, blobs: {}
    };
    if (withFiles) {
      var bl = await dbAll('blobs') || [];
      bl.forEach(function (r) { data.blobs[r.id] = b64(r.buf); });
    }
    var n = new Date(), d = n.getFullYear() + String(n.getMonth() + 1).padStart(2, '0') + String(n.getDate()).padStart(2, '0');
    download('MoYin-backup-' + d + '.json', JSON.stringify(data));
    toast('备份已导出' + (withFiles ? '（含 ' + Object.keys(data.blobs).length + ' 本书文件）' : '（仅进度与设置）'));
  }
  function askExport() {
    showModal('导出备份', '<p>把进度、书签、设置导出成一个 JSON 文件。</p>' +
      '<p><label><input type="checkbox" id="bakFull"> 同时包含书籍原文件（体积较大，可在新设备直接还原整架书）</label></p>' +
      '<p class="kv">不勾选则只导出元数据，换设备后需要重新导入 TXT / EPUB 原文件。</p>',
      [{ label: '取消' }, { label: '导出', cls: 'pri', fn: function () { var f = $('bakFull') && $('bakFull').checked; closeModal(); exportBak(!!f); } }]);
  }
  async function importBak(file) {
    try {
      var d = JSON.parse(await file.text());
      if (d.app !== 'MoYinReader' || !Array.isArray(d.books)) throw new Error('不是墨吟的备份文件');
      if (d.cfg) { Object.keys(DEF).forEach(function (k) { if (d.cfg[k] !== undefined) CFG[k] = d.cfg[k]; }); saveCfg(); applyCfg(); }
      var added = 0;
      for (var i = 0; i < d.books.length; i++) {
        var m = d.books[i];
        if (!m || !m.id) continue;
        await dbPut('books', m);
        var idx = BOOKS.findIndex(function (b) { return b.id === m.id; });
        if (idx >= 0) BOOKS[idx] = m; else BOOKS.push(m);
        added++;
      }
      var blobs = d.blobs || {}, keys = Object.keys(blobs);
      for (var j = 0; j < keys.length; j++) await dbPut('blobs', { id: keys[j], buf: unb64(blobs[keys[j]]) });
      renderShelf();
      toast('已还原 ' + added + ' 条记录' + (keys.length ? '、' + keys.length + ' 本书文件' : '（未含书文件，请重新导入原书）'), 4200);
    } catch (e) { showModal('导入失败', '<p>' + esc(e.message) + '</p>', [{ label: '关闭' }]); }
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('btnImport').onclick = function () { $('fileInput').click(); };
    $('fileInput').onchange = function (e) { if (e.target.files.length) importFiles(Array.prototype.slice.call(e.target.files)); e.target.value = ''; };
    $('libSearch').oninput = renderShelf;
    $('btnSort').onclick = function () {
      var a = ['last', 'name', 'added', 'progress'];
      CFG.sort = a[(a.indexOf(CFG.sort) + 1) % a.length]; saveCfg(); renderShelf();
      toast('排序：' + ({ last: '最近阅读', name: '书名', added: '加入时间', progress: '阅读进度' })[CFG.sort]);
    };
    $('btnLayout').onclick = cycleLayout;
    $('btnCfg').onclick = showSettings;
    $('btnTheme').onclick = cycleTheme;
    $('btnFont').onclick = showFont;
    $('btnExport').onclick = askExport;
    $('btnImportBak').onclick = function () { $('bakInput').click(); };
    $('bakInput').onchange = function (e) { if (e.target.files[0]) importBak(e.target.files[0]); e.target.value = ''; };
    $('shelf').onclick = function (e) {
      var d = e.target.closest('[data-del]');
      if (d) {
        var id = d.getAttribute('data-del'), b = BOOKS.filter(function (x) { return x.id === id; })[0];
        confirmModal('把《' + (b ? b.name : '') + '》从书架移除？原文件不会从电脑删除。', async function () {
          await dbDel('books', id); await dbDel('blobs', id);
          BOOKS = BOOKS.filter(function (x) { return x.id !== id; }); renderShelf(); toast('已移除');
        });
        return;
      }
      var c = e.target.closest('[data-listen]');
      if (c) { resumeListen(c.getAttribute('data-listen')); return; }
      var c2 = e.target.closest('.bk'); if (c2) openBook(c2.getAttribute('data-id'));
    };
    $('btnBack').onclick = closeBook;
    $('btnSign').onclick = function () { showDoc('about'); };
    $('btnPrevCh').onclick = function () { nextCh(-1); };
    $('btnNextCh').onclick = function () { nextCh(1); };
    $('progRange').oninput = function () {
      if (!BK) return;
      var i = Math.floor(this.value / 1000 * chapterCount());
      renderChapter(Math.min(chapterCount() - 1, i));
    };
    $('btnToc').onclick = function () { openSide('toc'); };
    $('btnMarks').onclick = function () { openSide('mark'); };
    $('btnFind').onclick = function () { openSide('find'); };
    $('btnMarkAdd').onclick = addMark;
    $('btnSpeak').onclick = function () {
      if (!SPK.on || !$('speakBar').classList.contains('on')) startSpeak(currentPara());
      else toggleSpeak();
    };
    $('side').querySelectorAll('.tabs button').forEach(function (b) {
      b.onclick = function () { openSide(b.getAttribute('data-tab')); };
    });
    $('sideBody').onclick = function (e) {
      var dm = e.target.closest('[data-delmark]');
      if (dm) {
        var ts = Number(dm.getAttribute('data-delmark'));
        BK.meta.marks = (BK.meta.marks || []).filter(function (m) { return m.ts !== ts; });
        savePos(); renderSide(); return;
      }
      if (e.target.closest('#sideAddMark')) { addMark(); return; }
      var m = e.target.closest('[data-mark]');
      if (m) {
        var mk = BK.meta.marks.slice().sort(function (a, c) { return c.ts - a.ts; })[Number(m.getAttribute('data-mark'))];
        if (mk) { renderChapter(mk.ch, { silent: true }); setTimeout(function () { var p = SPK.paras[mk.p]; if (p) p.scrollIntoView({ block: 'center' }); }, 90); }
        return;
      }
      var t = e.target.closest('[data-ch]');
      if (t) { renderChapter(Number(t.getAttribute('data-ch')), { anchor: t.getAttribute('data-anchor') }); }
    };
    $('page').onclick = function (e) {
      var nx = e.target.closest('[data-act="next"]'); if (nx) { nextCh(1); return; }
      var a = e.target.closest('a[data-ch]');
      if (a) { e.preventDefault(); renderChapter(Number(a.getAttribute('data-ch')), { anchor: a.getAttribute('data-anchor') }); return; }
      var p = e.target.closest('.rdp');
      if (p && SPK.on) {
        var i = SPK.paras.indexOf(p);
        if (i >= 0) { SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT); stopLocalAudio(); SPK.prefetch = null; try { SYN.cancel(); } catch (er) {} setPara(i); highlight(); if (SPK.playing) speakChunk(0); }
      }
    };
    $('pageWrap').onscroll = function () { updateProgress(); savePos(); };
    $('spPlay').onclick = toggleSpeak;
    $('spStop').onclick = function () { stopSpeak(false); toast('已停止朗读'); };
    $('spPrev').onclick = function () { speakJump(-1); };
    $('spNext').onclick = function () { speakJump(1); };
    $('spClose').onclick = function () { stopSpeak(true); };
    $('spVoice').onchange = function () {
      var v = this.value;
      if (v === '__more') {                     // 「还有 N 个声线」：直接打开设置页挑
        this.value = 'local:' + CFG.localVoice; showSettings(); return;
      }
      if (v.indexOf('local:') === 0) {          // 本机声线：换完立刻用新音色重念当前段
        CFG.localVoice = v.slice(6); CFG.voiceAuto = 0; saveCfg();
        resetCast();                            // 旁白换了，角色池要重新避开新声线
        voiceBadge(null);
        if (SPK.playing) { speakJump(0); }
        else { toast('音色已切到 ' + localVoiceName(CFG.localVoice) + '（本机离线合成）', 2600); }
        return;
      }
      CFG.voiceURI = v; CFG.voiceAuto = 0; SPK.fb = 0; SPK.seenEnd = false;
      saveCfg(); voiceBadge(curVoice());
      if (SPK.playing) { speakJump(0); }
    };
    $('spRole').onclick = function () { toggleRole(); };
    $('spTry').onclick = tryVoice;
    $('spQuality').onclick = function () { showDoc(localReady() ? 'local' : 'voice'); };
    $('spRate').oninput = function () {
      CFG.rate = parseFloat(this.value); $('spRateTx').textContent = CFG.rate.toFixed(1) + '×'; saveCfg();
      if (SPK.audio) SPK.audio.playbackRate = CFG.rate;
    };
    $('spTimer').onchange = function () { speakTimer(Number(this.value)); };
    $('modalX').onclick = closeModal;
    $('modal').onclick = function (e) { if (e.target === $('modal')) closeModal(); };
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-doc]'); if (d) { showDoc(d.getAttribute('data-doc')); }
    });
    document.addEventListener('keydown', function (e) {
      if ($('modal').classList.contains('on')) { if (e.key === 'Escape') closeModal(); return; }
      if (e.key === 'Escape') { if ($('side').classList.contains('on')) $('side').classList.remove('on'); else if ($('viewRead').classList.contains('on')) closeBook(); return; }
      if (!$('viewRead').classList.contains('on')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') { nextCh(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { nextCh(1); e.preventDefault(); }
      else if (e.key === ' ') {
        if (SPK.on) { toggleSpeak(); e.preventDefault(); }
        else { $('pageWrap').scrollTop += $('pageWrap').clientHeight * 0.85; e.preventDefault(); }
      }
      else if (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey)) { openSide('find'); e.preventDefault(); }
    });
    if (SYN && SYN.addEventListener) SYN.addEventListener('voiceschanged', fillVoices);
    if (SYN && 'onvoiceschanged' in SYN) SYN.onvoiceschanged = fillVoices;
    window.addEventListener('beforeunload', function () { try { savePos(); } catch (e) {} });
  }

  async function init() {
    loadCfg(); bind(); fillVoices(); syncRoleBtn();
    // 自动探测本机免费神经语音引擎；没启动时静默用系统语音，不打扰
    localProbe();
    setInterval(function () {
      if (CFG.localOn && !LOCAL.ready && LOCAL.miss < 5 && document.visibilityState === 'visible') localProbe();
    }, 12000);
    // 非 Edge 浏览器通常拿不到中文在线自然语音，给一次不打扰的引导
    if (SYN) setTimeout(function () {
      var vs = SYN.getVoices() || [];
      if (!vs.some(function (v) { return isNatural(v) && isZh(v); }) && !/Edg\//.test(navigator.userAgent) && !localReady())
        toast('当前浏览器没有中文自然语音；装一次免费离线语音包即可听到接近真人的朗读', 6500);
    }, 2400);
    try { BOOKS = (await dbAll('books')) || []; } catch (e) { BOOKS = []; toast('本机存储不可用，书籍将无法保存', 5000); }
    renderShelf();
    window.MY = {
      Z: Z, CFG: CFG, get BK() { return BK; }, get SPK() { return SPK; }, get BOOKS() { return BOOKS; },
      parseBook: parseBook, openBook: openBook, renderChapter: renderChapter, importFiles: importFiles,
      importBuffer: async function (buf, name, ext) {
        var b = await parseBook(buf, name, ext || readExt(name));
        var id = 'b' + Date.now() + Math.random().toString(36).slice(2, 7);
        await dbPut('blobs', { id: id, buf: buf });
        var m = { id: id, name: name.replace(/\.[^.]+$/, ''), ext: ext || readExt(name), size: buf.byteLength,
          added: Date.now(), last: Date.now(), ch: 0, ratio: 0, progress: 0, cover: b.cover || '',
          title: b.title, author: b.author || '', marks: [], chapters: b.titles.slice(0, 1000), tocCount: b.toc.length, enc: b.enc || '' };
        await dbPut('books', m); BOOKS.push(m); renderShelf(); return id;
      },
      exportBak: exportBak, importBak: importBak, dbGet: dbGet, dbAll: dbAll,
      startSpeak: startSpeak, stopSpeak: stopSpeak, toggleSpeak: toggleSpeak,
      doFind: doFind, addMark: addMark, showDoc: showDoc, closeBook: closeBook,
      fillVoices: fillVoices, splitSpeak: splitSpeak, normSpeak: normSpeak,
      voiceLabel: voiceLabel, voiceTier: voiceTier, isNatural: isNatural,
      tryVoice: tryVoice, showSettings: showSettings,
      localURL: localURL, localReady: localReady, localProbe: localProbe, LOCAL: LOCAL,
      fixLocalVoice: fixLocalVoice, localVoiceList: localVoiceList, LOCAL_VOICES: LOCAL_VOICES, saveCfg: saveCfg,
      stopLocalAudio: stopLocalAudio,
      chapterCount: chapterCount, chapterTitle: chapterTitle, currentPara: currentPara,
      resumeListen: resumeListen, renderShelf: renderShelf,
      roleSegments: roleSegments, castVoice: castVoice, rolePool: rolePool, resetCast: resetCast,
      tryRole: tryRole, toggleRole: toggleRole, localBarList: localBarList, voiceStat: voiceStat,
      buildVoiceList: buildVoiceList, setPara: setPara, speakerOf: speakerOf
    };
    document.documentElement.setAttribute('data-ready', '1');
    webEditionTip();
  }

  /* 在线版（GitHub Pages）提示：网页里只有系统语音，别让人以为声线坏了 */
  function webEditionTip() {
    if (!/\.github\.io$/i.test(location.hostname)) return;
    var tip = document.getElementById('webTip');
    if (!tip) return;
    var off = false;
    try { off = localStorage.getItem('moyin.webTip') === 'off'; } catch (e) { }
    if (off) return;
    tip.hidden = false;
    var x = document.getElementById('webTipX');
    if (x) x.onclick = function () {
      tip.hidden = true;
      try { localStorage.setItem('moyin.webTip', 'off'); } catch (e) { }
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ============================================================
   PDF 文字层抽取
   ------------------------------------------------------------
   只做「把 PDF 里的字读出来」，不做渲染：书是拿来听的，版面用排版引擎自己排。
   解析交给随包内置的 PDF.js（Apache-2.0，见 THIRD-PARTY-NOTICES.md），
   它自己会处理对象流 / 交叉引用流 / 字体 CMap / 增量更新这些结构问题——
   这些手写解析器最容易翻车的地方，也正是 PDF 打不开的原因。
   
   流程：PDF.js 逐页取文字块 → 按 y 聚成行、按 x 排序成一行字 → 去掉页眉页脚
   （跨页重复的行）→ 按行距并成段落 → 认章节标题 → 交给阅读器当 TXT 用。
   
   明确不行的两种 PDF：
     · 扫描件（整页是图片，没有文字层）—— 那要 OCR，不在离线阅读器里做；
     · 字体没带 Unicode 表的（多见于某些国产开票 / 排版软件导出）—— 抽出来是乱码，
       宁可如实说读不了，也不要把一屏乱码塞进书架。
   ============================================================ */
(function (root) {
  'use strict';

  function getLib(opt) {
    var L = (opt && opt.lib) || root.pdfjsLib;
    if (!L) return null;
    if (!root.__pdfWorkerHooked && !(opt && opt.lib)) {
      root.__pdfWorkerHooked = 1;
      /* 单文件离线：worker 源码由构建脚本注入成 PDF_WORKER_SRC 字符串，
         这里转成 Blob URL 交给 PDF.js——大册子抽字时不至于把界面卡住。 */
      var src = root.PDF_WORKER_SRC, useWorker = false;
      if (src && root.Blob && root.URL && root.Worker) {
        try {
          var probe = root.URL.createObjectURL(new root.Blob(['self.onmessage=function(){}'],
            { type: 'text/javascript' }));
          var w = new root.Worker(probe);
          w.terminate();
          root.URL.revokeObjectURL(probe);
          useWorker = true;
        } catch (e) { useWorker = false; }
      }
      if (useWorker) {
        try {
          L.GlobalWorkerOptions.workerSrc =
            root.URL.createObjectURL(new root.Blob([src], { type: 'text/javascript' }));
        } catch (e) { useWorker = false; }
      }
      if (!useWorker && src) {
        /* 安卓版是从 file:///android_asset/index.html 载入的（来源是 null），
           Chromium 不让它开 blob worker。这时把 worker 源码直接在同线程里跑一遍：
           PDF.js 见到 globalThis.pdfjsWorker 就不再建 worker，改走主线程。
           代价是大册子抽字时会一阵一阵地忙，但至少 PDF 能读。 */
        try { (0, eval)(src); } catch (e) { /* 连这个都不行就只能报错了 */ }
      }
    }
    return L;
  }

  function cjk(c) {
    var v = typeof c === 'string' ? c.charCodeAt(0) : c;
    return (v >= 0x3400 && v <= 0x9fff) || (v >= 0xf900 && v <= 0xfaff);
  }
  function wordish(c) { return /[0-9A-Za-z]/.test(c); }

  /* 一页的文字块 → 若干行。PDF 里的文字块本来就没顺序，只给了坐标：
     y 相同的算一行（容差 3 pt，抗住上下标和基线抖动），行内按 x 排。 */
  function linesOf(items) {
    var rows = [], map = {}, i, it, key, txt;
    for (i = 0; i < items.length; i++) {
      it = items[i];
      if (!it || !it.str) continue;
      txt = it.str;
      if (!txt) continue;
      var tr = it.transform || [1, 0, 0, 1, 0, 0];
      key = Math.round(tr[5] / 3);
      var row = map[key];
      if (!row) { row = map[key] = { y: tr[5], h: Math.abs(tr[3]) || 0, seg: [] }; rows.push(row); }
      row.seg.push({ x: tr[4], s: txt, w: it.width || 0 });
      if ((Math.abs(tr[3]) || 0) > row.h) row.h = Math.abs(tr[3]);
    }
    rows.sort(function (a, b) { return b.y - a.y; });
    var out = [];
    rows.forEach(function (r) {
      r.seg.sort(function (a, b) { return a.x - b.x; });
      var s = '', prevEnd = null;
      r.seg.forEach(function (g) {
        var t = String(g.s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
        if (!t) return;
        if (prevEnd !== null && s) {
          var a = s.charAt(s.length - 1), b = t.charAt(0);
          /* 中文块之间不插空格；外文块之间空一格。用「有没有真空隙」判，
             比按语言猜稳：PDF 里英文词之间本来就是一个空格的距离。 */
          if (wordish(a) && wordish(b) && g.x - prevEnd > 0.8) s += ' ';
          else if (!cjk(a) && !cjk(b) && wordish(a) === false && wordish(b) === false && g.x - prevEnd > 3) s += ' ';
        }
        s += t;
        prevEnd = g.x + (g.w || 0);
      });
      s = s.replace(/\s+/g, ' ').trim();
      if (s) out.push({ y: r.y, h: r.h, t: s, x: r.seg[0].x });
    });
    return out;
  }

  /* 页眉页脚：同一行字在很多页的顶部 / 底部反复出现（书名、章节名、页码）。
     统计「出现过这一行的页数」，超过四成页数的就删掉；页码单列一条正则。 */
  function dropFurniture(pages) {
    var n = pages.length;
    /* 页码、页脚这类「短、且几乎每页都有」的行才删。曾经只按出现页数判，
       正文里重复出现的句子（诗句、表格抬头）会连正文一起被吃掉。 */
    var seen = {}, uniqPage = {};
    if (n >= 4) {
      pages.forEach(function (ln, pi) {
        var head = ln.slice(0, 2), tail = ln.slice(-2), uniq = {};
        head.concat(tail).forEach(function (l) {
          if (!l.t || l.t.length > 30) return;              // 长行不可能是页眉页脚
          var k = l.t.replace(/\d+/g, '#');
          if (k.length < 2 || uniq[k]) return;
          uniq[k] = 1;
          seen[k] = (seen[k] || 0) + 1;
          (uniqPage[k] = uniqPage[k] || {})[pi] = 1;
        });
      });
    }
    var limit = Math.max(4, Math.round(n * 0.5)), hit = 0, all = 0;
    var kept = pages.map(function (ln) {
      return ln.filter(function (l) {
        all++;
        if (/^[\s\-–—_·.()\[\]（）第页0-9\/]+$/.test(l.t)) { hit++; return false; }   // 纯页码 / 分隔线
        var k = l.t.replace(/\d+/g, '#');
        if (n >= 4 && seen[k] >= limit) { hit++; return false; }
        return true;
      });
    });
    // 兜底：删过头（>30%）说明判错了，宁可留着页眉也别把正文删空
    return (all && hit > all * 0.3) ? pages : kept;
  }

  function median(arr) {
    if (!arr.length) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    return a[Math.floor(a.length / 2)];
  }

  /* 行 → 段落。PDF 每行都是硬换行，直接一行一段会让朗读一顿一顿的：
     行距恢复正常（没超出行距中位数 1.9 倍）就续在同一段里。 */
  function paragraphsOf(pages) {
    pages = dropFurniture(pages);
    var out = [], gaps = [];
    pages.forEach(function (lines) {
      for (var i = 1; i < lines.length; i++) gaps.push(lines[i - 1].y - lines[i].y);
    });
    var med = median(gaps.filter(function (g) { return g > 0; }));
    if (!med) med = 14;
    var hs = [];
    pages.forEach(function (lines) { lines.forEach(function (l) { if (l.h) hs.push(l.h); }); });
    var medH = median(hs) || 10;

    pages.forEach(function (lines) {
      var cur = '';
      /* 段首缩进：中文书几乎都缩两格，这是 PDF 里唯一可靠的「另起一段」信号
         （行距是均匀的，光看间距会把整章并成一段）。 */
      var minX = 1e9;
      lines.forEach(function (l) { if (l.x < minX) minX = l.x; });
      var ind = (lines[0] ? lines[0].h : medH) * 1.2 || 12;
      function flush() {
        if (cur.trim()) out.push({ t: cur.trim(), h: 0 });
        cur = '';
      }
      lines.forEach(function (l, i) {
        var big = l.h > medH * 1.22 && l.t.length <= 40;      // 大字号短行 = 标题
        var gap = i > 0 ? lines[i - 1].y - l.y : 0;
        var indent = i > 0 && l.x > minX + ind;              // 这一行往右缩了 → 新段落
        var brk = !cur || big || indent || gap > med * 1.9 ||
                  (l.h > medH * 1.22 && cur.length > 60);
        if (brk) {
          flush();
          if (big) { out.push({ t: l.t, h: 1 }); return; }
          cur = l.t;
          return;
        }
        var a = cur.charAt(cur.length - 1), b = l.t.charAt(0);
        /* 中文折行不该补空格；英文折行在行尾是连字符时接上，否则补一格 */
        if (a === '-' && /[A-Za-z]/.test(b)) cur = cur.slice(0, -1) + l.t;
        else if (cjk(a) || cjk(b)) cur += l.t;
        else if (/[，。、；：！？）】」』"'…]/.test(a)) cur += l.t;
        else cur += ' ' + l.t;
      });
      flush();
    });
    return out;
  }

  /* 段落 → 章节。优先用字号判出来的标题；没有字号信息时（重开书走纯文本）就靠书名式正则。 */
  function chapterize(paras, name, env) {
    var T = (env && env.T) || function (s) { return s; };
    var isTitle = (env && env.isTitle) || function () { return false; };
    var chapters = [], cur = { title: T('开篇'), body: [] }, size = 0, part = 1;
    function push() {
      if (!cur.body.length) return;
      if (size > 9000) {                       // 超长章节再切一刀，渲染与朗读都轻一点
        var half = Math.ceil(cur.body.length / 2);
        chapters.push({ title: cur.title + '（1）', body: cur.body.slice(0, half) });
        chapters.push({ title: cur.title + '（2）', body: cur.body.slice(half) });
      } else chapters.push(cur);
    }
    paras.forEach(function (p) {
      var t = p.t.trim();
      if (!t) return;
      var looksTitle = p.h || (t.length <= 40 && isTitle(t));
      if (looksTitle) {
        // 书一开头就是「第一章」：那它就是第一章的标题，不该当成「开篇」的正文
        if (!cur.body.length) { cur.title = t.slice(0, 40); return; }
        if (size > 600) { push(); cur = { title: t.slice(0, 40), body: [] }; size = 0; return; }
      }
      cur.body.push(t);
      size += t.length;
    });
    push();
    if (!chapters.length) chapters = [{ title: name || T('正文'), body: [T('（这一册 PDF 里没有抽到文字）')] }];
    return chapters;
  }

  /* 抽完先体检：宁可说「读不了」，也不要把一屏乱码塞进书架。 */
  function inspect(text) {
    var c = 0, lat = 0, dig = 0, sym = 0, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      if (cjk(ch)) c++;
      else if (/[A-Za-z]/.test(ch)) lat++;
      else if (/[0-9]/.test(ch)) dig++;
      else if (!/\s/.test(ch) && !/[\u3000-\u303f\uff00-\uffef，。、；：！？（）【】「」『』…—·""'']/.test(ch)) sym++;
    }
    return { cjk: c, lat: lat, dig: dig, sym: sym, len: text.length };
  }

  function build(buf, name, opt) {
    opt = opt || {};
    var T = opt.T || function (s) { return s; };
    var L = getLib(opt);
    if (!L) return Promise.reject(new Error(T('PDF 组件没加载起来，请用完整版打开')));
    /* PDF.js 会把这块内存 transfer 给 worker，原件随即失效。书架还要把原 PDF
       存进 IndexedDB（换设备导备份、以后重新抽字都要它），所以先复制一份。 */
    var data = buf instanceof Uint8Array
      ? new Uint8Array(buf)
      : new Uint8Array(buf.slice(0));
    var doc = null, pages = [], total = 0;
    return L.getDocument({
      data: data, isEvalSupported: false, useSystemFonts: false,
      disableFontFace: true, verbosity: 0
    }).promise.then(function (d) {
      doc = d; total = d.numPages;
      var limit = Math.min(total, 3000), p = 1;
      function step() {                       // 一页一让出，界面别僵住
        if (p > limit) return Promise.resolve();
        return doc.getPage(p).then(function (pg) {
          return pg.getTextContent().then(function (tc) {
            pages.push(linesOf(tc.items));
            try { pg.cleanup(); } catch (e) { }
            if (opt.onProgress) { try { opt.onProgress(p, total); } catch (e) { } }
            p++;
            return step();
          });
        });
      }
      return step().then(function () { return doc.destroy(); });
    }).then(function () {
      var paras = paragraphsOf(pages);
      var text = paras.map(function (p) { return p.t; }).join('\n');
      var q = inspect(text);
      if (q.cjk + q.lat + q.dig < 120) {
        var e = new Error(q.dig > 20
          ? T('这本 PDF 的文字层里只有数字和符号，汉字全丢了（字体没带 Unicode 映射），读不了')
          : T('这本 PDF 没有文字层（整页是扫描出来的图片），要读得先做一遍 OCR'));
        e.code = q.dig > 20 ? 'pdf-garbled' : 'pdf-notext';
        throw e;
      }
      /* 有文字块、却一个汉字都抽不出来：字体没带 Unicode 表（国产开票 / 排版软件常见），
         抽出来只有符号和数字，念不出句子。纯英文书不算这一类。 */
      if (q.cjk === 0 && q.lat < q.dig * 0.5) {
        var e2 = new Error(T('这本 PDF 的字体没带 Unicode 映射，抽出来是乱码，读不了'));
        e2.code = 'pdf-garbled';
        throw e2;
      }
      var chapters = chapterize(paras, name, opt);
      return {
        pages: total, quality: q, text: text,
        titles: chapters.map(function (c) { return c.title; }),
        body: chapters.map(function (c) { return c.body; }),
        en: q.cjk < q.lat * 0.3
      };
    });
  }

  /* 重开同一本书时不再解一遍 PDF：抽出来的纯文本随书存着，这里按段落还原章节。 */
  function fromText(text, name, opt) {
    opt = opt || {};
    var paras = String(text || '').split('\n').map(function (t) { return { t: t, h: 0 }; });
    var chapters = chapterize(paras, name, opt);
    return {
      text: String(text || ''),
      titles: chapters.map(function (c) { return c.title; }),
      body: chapters.map(function (c) { return c.body; })
    };
  }

  var api = { build: build, fromText: fromText, linesOf: linesOf, paragraphsOf: paragraphsOf, inspect: inspect };
  root.PdfBook = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

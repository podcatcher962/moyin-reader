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

  /* 一页上「最大的那张图」占多少面积（0~1）。整页扫描件是 1.00。
     图片是按单位正方形经当前变换矩阵贴上去的，所以面积 = |det(CTM)|，
     除以页面面积就是覆盖率。用它来识破「扫描图 + 一层水印文字」的假文字书：
     那种书每页只有一句「关注公众号」之类的水印，却因为总量过了门槛被当成
     正文书打开，用户看到的是一页页水印，书本身一个字都没有。 */
  function imgCoverage(pg, L, vw, vh) {
    if (!L || !L.OPS || !pg.getOperatorList) return Promise.resolve(0);
    var OPS = L.OPS;
    return pg.getOperatorList().then(function (ol) {
      var m = [1, 0, 0, 1, 0, 0], stack = [], best = 0;
      var n = ol.fnArray.length;
      for (var i = 0; i < n; i++) {
        var fn = ol.fnArray[i], a = ol.argsArray[i];
        if (fn === OPS.save) { stack.push(m.slice()); continue; }
        if (fn === OPS.restore) { m = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
        if (fn === OPS.transform && a) {
          m = [m[0] * a[0] + m[2] * a[1], m[1] * a[0] + m[3] * a[1],
               m[0] * a[2] + m[2] * a[3], m[1] * a[2] + m[3] * a[3],
               m[0] * a[4] + m[2] * a[5] + m[4], m[1] * a[4] + m[3] * a[5] + m[5]];
          continue;
        }
        if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject ||
            fn === OPS.paintImageMaskXObject || fn === OPS.paintInlineImageXObject) {
          if (!(vw > 0 && vh > 0)) continue;
          var c = Math.abs(m[0] * m[3] - m[1] * m[2]) / (vw * vh);
          if (c > best) best = c;
        }
      }
      return best > 1 ? 1 : best;
    }, function () { return 0; });          // 算不出来就当没图，宁可走原来那条路
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
    var doc = null, pages = [], total = 0, covers = [];
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
      /* 先探前 12 页。扫描件一页字都没有，没必要把 3000 页全抽一遍再宣布「没文字」——
         589 页的册子那样要白等一分多钟。抽到字才继续抽全书。
         顺手量一下每页图像覆盖率：扫描件整页是一张图（≈1.00），真文字书里的插图
         通常只占一小块。这一项用来识破「整页扫描 + 一层水印文字」的假文字书。 */
      var probeEnd = Math.min(12, limit);
      /* 再从全书不同位置抽 4 页对账。只看开头有个坑：不少书前十几页是封面、
         版权页、彩插、盗版广告，整页都是图；正文在后面。光看开头会把人家的
         文字书判成扫描件。抽样页只用来判类型，不进 pages（免得打乱章节顺序）。 */
      var samplePages = [], sampleChars = [];
      if (total > 40) {
        [0.25, 0.5, 0.75, 0.92].forEach(function (f) {
          var q = Math.max(probeEnd + 1, Math.min(total, Math.round(total * f)));
          if (samplePages.indexOf(q) < 0) samplePages.push(q);
        });
      }
      function sample() {
        if (!samplePages.length) return Promise.resolve();
        var q = samplePages.shift();
        return doc.getPage(q).then(function (pg) {
          var vp = pg.getViewport({ scale: 1 });
          return Promise.all([
            pg.getTextContent(),
            imgCoverage(pg, L, vp.width, vp.height)
          ]).then(function (r) {
            var c = 0;
            (r[0].items || []).forEach(function (it) { c += (it.str || '').length; });
            sampleChars.push(c);
            covers.push(r[1] || 0);
            try { pg.cleanup(); } catch (e) { }
            return sample();
          });
        });
      }
      function probe() {
        if (p > probeEnd) return Promise.resolve();
        return doc.getPage(p).then(function (pg) {
          var vp = pg.getViewport({ scale: 1 });
          return Promise.all([
            pg.getTextContent(),
            imgCoverage(pg, L, vp.width, vp.height)
          ]).then(function (r) {
            pages.push(linesOf(r[0].items));
            covers.push(r[1] || 0);
            try { pg.cleanup(); } catch (e) { }
            if (opt.onProgress) { try { opt.onProgress(p, total); } catch (e) { } }
            p++;
            return probe();
          });
        });
      }
      return probe().then(function () { return sample(); }).then(function () {
        var got = 0;
        pages.forEach(function (lns) { lns.forEach(function (l) { got += (l.t || '').length; }); });
        if (got < 12) {
          try { doc.destroy(); } catch (e) { }
          return { picture: true, pages: total, why: 'scan' };
        }
        /* 整页都是图的页占多数，而且每页文字少得可怜（只有水印、页眉）——
           这本来就是一本扫描书，只是被人塞了层水印文字。按扫描件打开。
           真做了 OCR 的扫描书每页几百字，不会被这条拦住，仍走文字模式。 */
        var full = 0;
        for (var i = 0; i < covers.length; i++) if (covers[i] >= 0.7) full++;
        var ratio = covers.length ? full / covers.length : 0;
        var perPage = pages.length ? got / pages.length : got;
        /* 抽样页里只要有一页是「像样的正文」，就不许判扫描件——
           有些书前十几页全是封面、版权、广告图，正文在后面。 */
        var realText = false;
        for (var k = 0; k < sampleChars.length; k++) if (sampleChars[k] >= 150) realText = true;
        if (ratio >= 0.6 && perPage < 120 && !realText) {
          try { doc.destroy(); } catch (e) { }
          return { picture: true, pages: total, why: 'scanwm', watermark: true };
        }
        return step().then(function () { return doc.destroy(); });
      });
    }).then(function (early) {
      if (early && early.picture) return early;     // 扫描件：前面已经判完，直接交差
      var paras = paragraphsOf(pages);
      var text = paras.map(function (p) { return p.t; }).join('\n');
      var q = inspect(text);
      /* 抽不到字：扫描件、或者字体没带 Unicode 表（抽出来只有数字符号）。
         这两种都不再拒收——按页渲染成图片照样能「看」，只是念不出来。
         主流阅读器也只能做到这一步，用户要的正是这个。 */
      if (q.cjk + q.lat + q.dig < 120) {
        return {
          picture: true, pages: total, quality: q, text: '',
          why: q.dig > 20 ? 'garbled' : 'scan',
          titles: [], body: []
        };
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

  /* ---------------- 按页渲染（图片层 PDF） ----------------
     扫描件没有文字层，唯一能做的就是把它画出来。PDF.js 自带渲染器，
     这里只负责「把第 n 页画进一块 canvas」，其余交给浏览器。
     文档对象缓存一份：翻页时反复 getDocument 会重新解析整本，几百页要几十秒。 */

  var DOC = { key: null, p: null };

  function docOf(buf, opt) {
    var L = getLib(opt);
    if (!L) return Promise.reject(new Error('PDF 组件没加载起来，请用完整版打开'));
    if (DOC.key === buf && DOC.p) return DOC.p;
    /* 同一份内存只交出去一次：PDF.js 会把它 transfer 给 worker，之后原件是空的。
       DOC 里留着已经建好的文档，所以「再打开一次」用的是缓存，不需要原件。 */
    var data = buf instanceof Uint8Array ? new Uint8Array(buf) : new Uint8Array(buf.slice(0));
    var p = L.getDocument({
      data: data, isEvalSupported: false, useSystemFonts: false,
      disableFontFace: true, verbosity: 0
    }).promise;
    DOC = { key: buf, p: p };
    return p;
  }

  /** 第 num 页（从 1 起）画进 canvas。width 是 CSS 像素宽，dpr 用来出高分屏的像素。 */
  function renderPage(buf, num, canvas, opt) {
    opt = opt || {};
    return docOf(buf, opt).then(function (doc) {
      var n = num | 0;
      if (n < 1 || n > doc.numPages) throw new Error('页码不存在');
      return doc.getPage(n).then(function (pg) {
        var base = pg.getViewport({ scale: 1 });
        var cssW = Math.max(240, Math.round(opt.width || 760));
        var dpr = Math.min(Math.max(1, opt.dpr || 1), 3);
        /* 超宽页（横向 A3、地图）按高度也压一下，免得一张图长到几十屏 */
        var scale = cssW / base.width;
        if (opt.maxH) {
          var maxS = opt.maxH / base.height;
          if (maxS < scale) scale = maxS;
        }
        var vp = pg.getViewport({ scale: scale * dpr });
        canvas.width = Math.max(1, Math.ceil(vp.width));
        canvas.height = Math.max(1, Math.ceil(vp.height));
        var g = canvas.getContext('2d');
        g.save();
        g.fillStyle = '#fff';
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.restore();
        return pg.render({ canvasContext: g, viewport: vp }).promise.then(function () {
          try { pg.cleanup(); } catch (e) { }
          return { w: canvas.width, h: canvas.height, pages: doc.numPages, canvas: canvas };
        });
      });
    });
  }

  /** 换书时把上一本的文档放掉：几百页的册子解析完占着几十 MB。 */
  function closeDoc() {
    var old = DOC.p;
    DOC = { key: null, p: null };
    if (old) { try { old.then(function (d) { try { d.destroy(); } catch (e) { } }); } catch (e) { } }
  }

  /** 只问页数（老版本存的条目没记页数时用）。 */
  function pageCount(buf, opt) {
    return docOf(buf, opt).then(function (doc) { return doc.numPages; });
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

  var api = { build: build, fromText: fromText, renderPage: renderPage, pageCount: pageCount, closeDoc: closeDoc,
    linesOf: linesOf, paragraphsOf: paragraphsOf, inspect: inspect };
  root.PdfBook = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

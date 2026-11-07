/* MoYin Reader · 墨吟 —— 单文件 TXT/EPUB 阅读 + 朗读 */
(function () {
  'use strict';
  var Z = window.MYZip, $ = function (id) { return document.getElementById(id); };
  var I18N = window.MYI18N || null;
  /* 所有界面文案过一遍 T()：中文原样返回，英文查 i18n.js 的词典 */
  function T(s, a) { return I18N ? I18N.t(s, a) : s; }
  var DBNAME = 'MoYinReader', CFGKEY = 'MOYIN_CFG', GEN = 1;
  var VER = '1.9.0';
  var HL_COLORS = ['y', 'g', 'b', 'p'];
  var FONTS = {
    serif: '"Noto Serif CJK SC","Songti SC","SimSun",Georgia,serif',
    sans: '"Microsoft YaHei","PingFang SC",system-ui,sans-serif',
    kai: '"Kaiti SC","KaiTi","STKaiti",serif',
    fang: '"FangSong","STFangsong","FangSong_GB2312",serif',
    mono: '"Cascadia Mono","Consolas","Courier New",monospace'
  };
  var THEMES = ['dark', 'light', 'sepia', 'green', 'gray', 'black'];
  /* 分栏档位：auto 自动，其余是每屏固定几栏 */
  var LAYN = { one: 1, two: 2, three: 3, four: 4 };
  var DEF = {
    theme: 'dark', lay: 'auto', motion: 0, fs: 19, lh: 1.85, pagew: 720,
    ff: 'serif', align: 'justify', sort: 'last', txtEnc: 'auto',
    /* --- 1.8 排版与阅读方式 --- */
    mode: 'scroll',        // scroll 滚动 / page 翻页
    ps: 0.85,              // 段间距（em）
    ls: 0.02,              // 字间距（em）
    indent: 0,             // 首行缩进（em）
    padw: 32,              // 左右页边距（px）
    pageAnim: 'slide',     // slide / fade / none
    dim: 0,                // 亮度暗化 0~0.55
    customBg: '', customTx: '',
    autoScrollSpeed: 3,    // 自动滚动速度 1~10
    autoPageSec: 20,       // 自动翻页停留秒数
    immersive: 0,
    showClock: 1,          // 顶栏显示时间与本次阅读时长
    restMin: 45,           // 连续阅读多久提醒休息（0 = 不提醒）
    rate: 1, pitch: 1, volume: 1, voiceURI: '', voiceAuto: 1, pause: 120, whole: 1,
    autoNext: 1, follow: 1,
    localOn: 1, localPort: 8177, localVoice: 's12',
    voiceSet: 'curated', roleOn: 0, rolePool: 'mix',
    lang: 'zh', noteFilter: 'all'
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
    // 1.7 及以前：lay 是「界面密度」(auto/p/l)，1.8 起改成「分栏」(auto/one/two)
    if (CFG.lay === 'p' || CFG.lay === 'l') CFG.lay = 'auto';
    if (I18N) I18N.set(CFG.lang);
    applyCfg();
  }
  function saveCfg() { try { localStorage.setItem(CFGKEY, JSON.stringify(CFG)); } catch (e) { /* 隐私模式 */ } }
  function applyCfg() {
    var h = document.documentElement, s = h.style;
    /* 双栏必须靠翻页成立：一屏高度固定，超出的内容才会向右排成新列。
       滚动模式没有固定屏高，column-count 摆出来是两列同步滚动，读起来会串行，所以强制走翻页。 */
    if ((LAYN[CFG.lay] || 0) > 1 && CFG.mode !== 'page') CFG.mode = 'page';
    var nowPage = CFG.mode === 'page', wasPage = h.getAttribute('data-mode') === 'page';
    /* 切换阅读方式时先抓住眼前那段，切完再定位回去，别让人丢位置 */
    var keep = BK ? (wasPage ? pgTopPara() : scrollTopPara()) : null;
    h.setAttribute('data-theme', CFG.theme);
    h.setAttribute('data-lay', CFG.lay);
    h.setAttribute('data-mode', nowPage ? 'page' : 'scroll');
    h.setAttribute('data-motion', CFG.motion ? 'low' : '');
    s.setProperty('--fs', Number(CFG.fs) + 'px');
    s.setProperty('--lh', CFG.lh);
    s.setProperty('--pagew', Number(CFG.pagew) + 'px');
    s.setProperty('--ff', FONTS[CFG.ff] || FONTS.serif);
    s.setProperty('--ps', Number(CFG.ps) + 'em');
    s.setProperty('--ls', Number(CFG.ls) + 'em');
    s.setProperty('--ind', Number(CFG.indent) + 'em');
    s.setProperty('--padx', Number(CFG.padw) + 'px');
    // 自定义底色 / 字色：空 = 跟随主题
    var paper = String(CFG.customBg || '').trim(), tx = String(CFG.customTx || '').trim();
    if (paper) s.setProperty('--paper', paper); else s.removeProperty('--paper');
    if (tx) { s.setProperty('--paperTx', tx); s.setProperty('--tx', tx); }
    else { s.removeProperty('--paperTx'); s.removeProperty('--tx'); }
    $('page').style.textAlign = CFG.align;
    if ($('dim')) $('dim').style.opacity = Math.max(0, Math.min(0.6, Number(CFG.dim) || 0));
    var i = $('spRate'); if (i) { i.value = CFG.rate; $('spRateTx').textContent = Number(CFG.rate).toFixed(1) + '×'; }
    syncAutoBtn(); syncFullBtn(); clkPaint(); applyImm();
    // 排版变化后：翻页模式重新分页（尽量停在原来那段），滚动模式清掉分页残留
    if (!pgEnabled()) {
      pgReset();
      if (BK && nowPage !== wasPage && keep) {
        try { keep.scrollIntoView({ block: 'start' }); } catch (e) { }
      }
    } else if (BK) {
      PG.ready = 0; pgMeasure();
      pgTo(keep ? paraPage(keep) : PG.i, { instant: true });
    }
  }
  /* ---------------- 语言 ---------------- */
  function syncLangBtn() {
    var b = $('btnLang'); if (!b) return;
    b.textContent = CFG.lang === 'en' ? '中' : 'EN';
    b.title = T('切换界面语言');
    b.setAttribute('aria-label', b.title);
  }
  function syncTypeBtn() {
    var b = $('btnType'); if (!b) return;
    b.textContent = T('排版');
    b.title = T('排版：滚动 / 翻页、分栏、字号、行距、段距、字体、颜色');
    b.setAttribute('aria-label', b.title);
  }
  function setLang(l) {
    CFG.lang = (l === 'en' ? 'en' : 'zh');
    if (I18N) I18N.set(CFG.lang);
    saveCfg();
    if (I18N) I18N.apply();
    syncLangBtn();
    document.documentElement.setAttribute('lang', CFG.lang === 'en' ? 'en' : 'zh-CN');
    // 动态生成的部分重新渲染一遍，静态部分由 I18N.apply() 刷
    renderShelf();
    if (BK) { renderChapter(BK.ch, { silent: true }); renderSide(); }
    fillVoices(); syncRoleBtn(); voiceBadge(localReady() ? null : curVoice());
    hideSelTools();
    toast(T('界面语言已切换为 {n}', { n: CFG.lang === 'en' ? 'English' : '中文' }), 1800);
  }
  var THEME_NAME = { dark: '夜间', light: '明亮', sepia: '羊皮纸', green: '护眼绿', gray: '雾蓝', black: '纯黑' };
  function cycleTheme() {
    CFG.theme = THEMES[(THEMES.indexOf(CFG.theme) + 1) % THEMES.length]; saveCfg(); applyCfg();
    toast(T('主题：{n}', { n: T(THEME_NAME[CFG.theme] || CFG.theme) }));
  }
  function setTheme(k) {
    if (THEMES.indexOf(k) < 0) return;
    CFG.theme = k; saveCfg(); applyCfg();
    toast(T('主题：{n}', { n: T(THEME_NAME[k]) }), 1400);
  }
  /* 每套主题的「纸色 / 字色 / 主色」，只给主题面板画预览用 */
  var TH_PAL = {
    dark: { bg: '#1F2125', tx: '#E6E4E1', ac: '#4A9EFF' },
    light: { bg: '#FFFFFF', tx: '#22252B', ac: '#1668C4' },
    sepia: { bg: '#FAF3E3', tx: '#3B3226', ac: '#9A5B2C' },
    green: { bg: '#F3F8EC', tx: '#26301D', ac: '#3E7C4C' },
    gray: { bg: '#252D37', tx: '#DEE5EE', ac: '#69A8F5' },
    black: { bg: '#000000', tx: '#C4C4C8', ac: '#5AA9FF' }
  };
  /* 主题面板：先看后点、选定即生效 —— 不再「按一次换一档」 */
  function showTheme() {
    var cards = THEMES.map(function (k) {
      var p = TH_PAL[k] || TH_PAL.dark;
      return '<button class="thCard' + (CFG.theme === k ? ' on' : '') + '" data-th="' + k + '"' +
        ' style="background:' + p.bg + ';color:' + p.tx + ';border-color:' + p.ac + '">' +
        '<i class="dot" style="background:' + p.ac + '"></i>' +
        '<b>' + esc(T(THEME_NAME[k])) + '</b>' +
        '<span class="demo">春眠不觉晓</span>' +
        '<span class="tick">✓</span></button>';
    }).join('');
    var cbg = hex6(CFG.customBg, hex6(curVar('--paper'), '#1F2125'));
    var ctx = hex6(CFG.customTx, hex6(curVar('--paperTx'), '#E6E4E1'));
    var h = '<div class="thGrid">' + cards + '</div>' +
      '<div class="row clrRow"><label>' + T('自定义颜色') + '</label>' +
      '<span class="kv">' + T('底色') + '</span><input type="color" data-set="customBg" value="' + cbg + '">' +
      '<span class="kv">' + T('字色') + '</span><input type="color" data-set="customTx" value="' + ctx + '">' +
      '<button data-act="clr">' + T('清空') + '</button><span class="kv">' + T('清空后跟随主题') + '</span></div>' +
      '<div class="row"><label>' + T('亮度') + '</label><input type="range" data-set="dim" min="0" max="0.55" step="0.05" value="' +
      (Number(CFG.dim) || 0) + '" style="flex:1"><span id="fDim">' + Math.round((Number(CFG.dim) || 0) * 100) + '%</span></div>' +
      '<p class="kv">' + T('点一下立刻换上，自动记住。字号 / 行距 / 分栏在「更多排版」里。') + '</p>';
    showModal(T('主题'), h, [
      { label: T('更多排版…'), fn: function () { showType(); } },
      { label: T('完成'), cls: 'pri' }]);
    var mb = $('modalBody');
    mb.onclick = function (e) {
      var th = e.target.closest('[data-th]');
      if (th) { setTheme(th.getAttribute('data-th')); showTheme(); return; }
      if (e.target.closest('[data-act="clr"]')) {
        CFG.customBg = ''; CFG.customTx = ''; saveCfg(); applyCfg(); showTheme();
        toast(T('已跟随主题配色'), 1500);
      }
    };
    mb.oninput = function (e) {
      var k = e.target.getAttribute('data-set'); if (!k) return;
      if (k === 'dim') {
        CFG.dim = parseFloat(e.target.value) || 0;
        if ($('fDim')) $('fDim').textContent = Math.round(CFG.dim * 100) + '%';
      } else CFG[k] = e.target.value;
      saveCfg(); applyCfg();
    };
  }
  function cycleLayout() {
    var a = ['auto', 'one', 'two', 'three', 'four'];
    CFG.lay = a[(a.indexOf(CFG.lay) + 1) % a.length]; saveCfg(); applyCfg();
    syncTypeBtn();
    toast(T('分栏：{n}', { n: T({ auto: '自动', one: '1 栏', two: '2 栏', three: '3 栏', four: '4 栏' }[CFG.lay]) }));
  }

  /* 点顶栏时钟：看时长、开关显示、调休息提醒间隔 */
  function showClockPanel() {
    var now = new Date();
    var hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var b = function (key, v, label, on) {
      return '<button data-ck="' + key + '" data-v="' + v + '"' + (on ? ' class="on"' : '') + '>' + label + '</button>';
    };
    var h = '<div class="clkBig"><b>' + hm + '</b><span>' + T('本次已读 {n}', { n: fmtRead(clkTotal()) }) + '</span></div>' +
      '<div class="row"><label>' + T('顶栏时钟') + '</label><div class="seg">' +
      b('showClock', 1, T('显示'), !!Number(CFG.showClock)) +
      b('showClock', 0, T('隐藏'), !Number(CFG.showClock)) + '</div></div>' +
      '<div class="row"><label>' + T('休息提醒') + '</label><div class="seg">' +
      b('restMin', 0, T('关闭'), !Number(CFG.restMin)) +
      [30, 45, 60, 90].map(function (n) {
        return b('restMin', n, T('{n} 分钟', { n: n }), Number(CFG.restMin) === n);
      }).join('') + '</div></div>' +
      '<p class="kv">' + T('时长只算真正在读的时间：回书架、切走窗口都会停表。连续读满设定时长会提醒你休息。') + '</p>';
    showModal(T('阅读时钟'), h, [
      { label: T('重新计时'), fn: function () { restTake(); showClockPanel(); } },
      { label: T('完成'), cls: 'pri' }]);
    $('modalBody').onclick = function (e) {
      var x = e.target.closest('[data-ck]'); if (!x) return;
      var k = x.getAttribute('data-ck'), v = parseInt(x.getAttribute('data-v'), 10) || 0;
      CFG[k] = v; saveCfg(); applyCfg();
      if (k === 'restMin') { CLK.mark = clkTotal(); CLK.warned = 0; CLK.snoozeTo = 0; }
      showClockPanel();
    };
  }

  /* ================= 分页引擎（翻页模式） =================
     用 CSS 多栏 + translateX 平移：column-fill:auto 会把超出高度的内容
     继续往右排成新列，#pageWrap 负责裁掉，翻页只是横向平移。 */
  var PG = { i: 0, count: 1, cols: 1, cw: 0, gap: 0, padL: 0, step: 0, ready: 0 };

  function pgEnabled() { return CFG.mode === 'page'; }
  /* 每屏几栏：auto 按可用宽度推（最多 3），手动 1~4；手机一律单栏 */
  function pgCols() {
    if (!pgEnabled()) return 1;
    var w = ($('pageWrap') && $('pageWrap').clientWidth) || 800;
    if (w < 620) return 1;                        // 手机一律单栏
    var pad = Math.max(10, Number(CFG.padw) || 32);
    var usable = w - pad * 2 + 60;                // 加上最后一个栏距，便于整除
    var want = LAYN[CFG.lay] || 0;
    if (!want) want = Math.max(1, Math.min(3, Math.floor(usable / 520)));   // 自动：每栏够 520 才加一栏
    var maxFit = Math.max(1, Math.floor(usable / 360));                     // 每栏至少 300px，再多就挤了
    return Math.max(1, Math.min(want, maxFit, 4));
  }
  function pgGeo() {
    var el = $('page'), cs = getComputedStyle(el);
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var gap = parseFloat(cs.columnGap) || 0;
    var cols = pgCols();
    var contentW = Math.max(140, el.clientWidth - padL - padR);
    var cw = Math.max(60, (contentW - gap * (cols - 1)) / cols);
    return { padL: padL, padR: padR, gap: gap, cols: cols, cw: cw, step: cols * (cw + gap) };
  }
  /* 量一次：算出每列宽、总列数、总页数（用最后一块所在的列反推，最可靠） */
  function pgReset() {
    var el = $('page'); if (!el) return;
    el.style.columnCount = ''; el.style.transform = ''; el.style.removeProperty('--pcols');
    el.classList.remove('pg-slide', 'pg-fade');
    PG.cols = 1; PG.count = 1; PG.i = 0; PG.ready = 0;
  }
  /* 实测列距：把段落矩形的左缘聚类，相邻簇中位数之差就是「列宽 + 栏距」。
     比拿容器宽自己除更可靠——浏览器若因取整排出了半列，这里能立刻纠正步长。 */
  function pgRealStep() {
    var el = $('page'); if (!el) return 0;
    var list = el.querySelectorAll('.rdp'), n = Math.min(list.length, 160), lefts = [];
    for (var i = 0; i < n; i++) {
      var rs = list[i].getClientRects();
      for (var j = 0; j < rs.length; j++) if (rs[j].width > 40 && rs[j].height > 2) lefts.push(Math.round(rs[j].left));
    }
    if (lefts.length < 2) return 0;
    lefts.sort(function (a, b) { return a - b; });
    var groups = [[lefts[0]]];
    for (var k = 1; k < lefts.length; k++) {
      var g = groups[groups.length - 1];
      if (lefts[k] - g[g.length - 1] > 46) groups.push([lefts[k]]); else g.push(lefts[k]);
    }
    if (groups.length < 2) return 0;
    var med = function (a) { return a[a.length >> 1]; }, d = [];
    for (var m = 1; m < groups.length; m++) d.push(med(groups[m]) - med(groups[m - 1]));
    d.sort(function (a, b) { return a - b; });
    return d[d.length >> 1];
  }
  function pgMeasure() {
    var el = $('page');
    if (!el) return PG;
    if (!pgEnabled()) { pgReset(); return PG; }
    var cols = pgCols();
    el.style.setProperty('--pcols', cols);
    el.style.columnCount = cols;
    el.style.transform = 'translateX(0px)';
    var m = pgGeo();
    var real = pgRealStep();                    // 实测「列宽 + 栏距」
    if (real > 80) { m.cw = Math.max(60, real - m.gap); m.step = m.cols * real; }
    var base = el.getBoundingClientRect().left + m.padL;
    var last = el.querySelector('#chEnd') || el.lastElementChild;
    var col = 0;
    if (last) {
      var rs = last.getClientRects();
      var r = rs.length ? rs[rs.length - 1] : last.getBoundingClientRect();
      col = Math.max(0, Math.round((r.left - base) / m.step));
    }
    PG.cols = m.cols; PG.cw = m.cw; PG.gap = m.gap; PG.padL = m.padL; PG.step = m.step;
    PG.count = Math.max(1, Math.ceil((col + 1) / m.cols));
    if (PG.i > PG.count - 1) PG.i = PG.count - 1;
    PG.ready = 1;
    return PG;
  }
  function pgTo(i, opt) {
    opt = opt || {};
    if (!pgEnabled()) return;
    var el = $('page');
    if (!PG.ready) pgMeasure();
    PG.i = Math.max(0, Math.min(PG.count - 1, i | 0));
    var anim = !opt.instant && !CFG.motion && CFG.pageAnim !== 'none';
    var slide = anim && CFG.pageAnim === 'slide';
    el.classList.toggle('pg-slide', slide);
    el.style.transform = 'translateX(' + (-PG.i * PG.step) + 'px)';
    if (anim && CFG.pageAnim === 'fade') {
      el.classList.remove('pg-fade');
      void el.offsetWidth;
      el.classList.add('pg-fade');
    }
    updateProgress(); savePos();
  }
  /* 某个元素落在第几页 */
  function paraPage(p) {
    var el = $('page');
    if (!el || !p) return 0;
    var padL = PG.padL || 0;
    var base = el.getBoundingClientRect().left + padL;
    var r = p.getBoundingClientRect();
    var col = Math.round((r.left - base) / ((PG.cw || 1) + (PG.gap || 0)));
    col = Math.max(0, col);
    return Math.max(0, Math.min(PG.count - 1, Math.floor(col / (PG.cols || 1))));
  }
  /* 当前页第一个段落 */
  function pgTopPara() {
    var list = $('page') ? $('page').querySelectorAll('.rdp') : [];
    for (var i = 0; i < list.length; i++) if (paraPage(list[i]) === PG.i) return list[i];
    return null;
  }
  /* 滚动模式下：视口里第一个露头的段落（从滚动切到翻页时拿它当锚点） */
  function scrollTopPara() {
    var list = $('page') ? $('page').querySelectorAll('.rdp') : [];
    if (!list.length) return null;
    var box = $('pageWrap').getBoundingClientRect();
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.height && r.bottom > box.top + 6) return list[i];
    }
    return null;
  }
  /* 改字号 / 换屏宽后：重新分页，尽量停在原来那段 */
  function pgReflow(anchor) {
    if (!BK || !pgEnabled()) return;
    if (!anchor) anchor = pgTopPara();
    pgMeasure();
    pgTo(anchor ? paraPage(anchor) : PG.i, { instant: true });
  }
  /* 把某段滚（翻）到眼前 */
  function revealPara(p, smooth) {
    if (!p) return;
    if (pgEnabled()) {
      var want = paraPage(p);
      if (want !== PG.i) pgTo(want, { instant: true });
      return;
    }
    try { p.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' }); }
    catch (e) { p.scrollIntoView(); }
  }
  /* 下一页 / 下一屏（到末尾自动接下一章） */
  function readNext() {
    if (!BK) return;
    if (pgEnabled()) {
      if (PG.i < PG.count - 1) { pgTo(PG.i + 1); return; }
      if (CFG.autoNext !== 0 && BK.ch < chapterCount() - 1) { renderChapter(BK.ch + 1); return; }
      toast(T('已经是最后一页'), 1500); return;
    }
    var w = $('pageWrap');
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 4) {
      if (CFG.autoNext !== 0 && BK.ch < chapterCount() - 1) renderChapter(BK.ch + 1);
      return;
    }
    w.scrollTop += w.clientHeight * 0.9;
  }
  function readPrev() {
    if (!BK) return;
    if (pgEnabled()) {
      if (PG.i > 0) { pgTo(PG.i - 1); return; }
      if (BK.ch > 0) renderChapter(BK.ch - 1, { pg: 'last' });
      return;
    }
    var w = $('pageWrap');
    if (w.scrollTop <= 2) { if (BK.ch > 0) renderChapter(BK.ch - 1); return; }
    w.scrollTop -= w.clientHeight * 0.9;
  }

  /* ================= 自动阅读 ================= */
  var AUTO = { on: 0, paused: 0, raf: 0, timer: 0, t0: 0, y: 0 };
  function autoSpeedPx() { return Math.max(1, Number(CFG.autoScrollSpeed) || 3) * 7; }
  function autoPageSec() { return Math.max(4, Number(CFG.autoPageSec) || 20); }
  function syncAutoBtn() {
    var b = $('btnAuto'); if (!b) return;
    b.classList.toggle('on', !!AUTO.on && !AUTO.paused);
    b.textContent = T('自动');
    b.title = AUTO.on ? T('自动阅读：开（再点关闭）') : T('自动阅读：自动滚动 / 自动翻页');
    b.setAttribute('aria-label', b.title);
  }
  function autoStopTimers() { if (AUTO.raf) cancelAnimationFrame(AUTO.raf); if (AUTO.timer) clearInterval(AUTO.timer); AUTO.raf = 0; AUTO.timer = 0; }
  function autoStart() {
    if (!BK) return;
    autoStopTimers();
    AUTO.on = 1; AUTO.paused = 0; AUTO.t0 = 0;
    if (pgEnabled()) {
      AUTO.timer = setInterval(autoStepPage, autoPageSec() * 1000);
      toast(T('自动翻页：每 {n} 秒一页', { n: autoPageSec() }), 2600);
    } else {
      document.body.classList.add('autoscroll');
      AUTO.y = $('pageWrap').scrollTop || 0;      // 用浮点累加，避免每帧被取整吃掉
      AUTO.raf = requestAnimationFrame(autoStepScroll);
      AUTO.t0 = performance.now();
      var sec = Math.round((($('pageWrap') || {}).clientHeight || 600) / autoSpeedPx());
      toast(T('自动滚动：约 {n} 秒一屏', { n: sec }), 2600);
    }
    hidePill(); syncAutoBtn();
  }
  function autoStop(silent) {
    var was = AUTO.on;
    AUTO.on = 0; AUTO.paused = 0; autoStopTimers(); hidePill(); syncAutoBtn();
    document.body.classList.remove('autoscroll');
    if (!silent && was) toast(T('自动阅读：关'), 1600);
  }
  function autoPause() {
    if (!AUTO.on || AUTO.paused) return;
    AUTO.paused = 1; showPill(); syncAutoBtn();
  }
  function autoResume() {
    if (!AUTO.on) return;
    AUTO.paused = 0; AUTO.t0 = performance.now();
    AUTO.y = $('pageWrap').scrollTop || 0;
    hidePill(); syncAutoBtn();
  }
  function autoToggle() {
    if (!BK) { toast(T('先打开一本书')); return; }
    if (!AUTO.on) { autoStart(); return; }
    if (AUTO.paused) autoResume(); else autoPause();
  }
  function showPill() {
    var p = $('autoPill'); if (!p) return;
    if ($('autoPillTx')) $('autoPillTx').textContent = T('自动阅读已暂停');
    p.classList.add('on');
  }
  function hidePill() { var p = $('autoPill'); if (p) p.classList.remove('on'); }

  /* ================= 阅读时钟 / 本次时长 / 休息提醒 =================
     时长按「真正在读」累计：离开阅读界面、页面被切到后台都停表，
     回来接着算；隔了 10 分钟以上没读则重新起算。 */
  var CLK = { t0: 0, acc: 0, mark: 0, last: 0, timer: 0, snoozeTo: 0, warned: 0 };
  function clkTotal() { return CLK.acc + (CLK.t0 ? Date.now() - CLK.t0 : 0); }
  function fmtRead(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 60) return T('{n} 分钟', { n: m });
    return T('{a} 小时 {b} 分', { a: Math.floor(m / 60), b: m % 60 });
  }
  function clkPaint() {
    var el = $('clock'); if (!el) return;
    if (!Number(CFG.showClock)) { el.classList.add('off'); return; }
    el.classList.remove('off');
    var d = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var ms = clkTotal(), m = Math.floor(ms / 60000);
    // 窄屏标题要让位，时长用短写法
    var narrow = (window.innerWidth || 0) < 900;
    el.textContent = hm + ' · ' + (narrow ? T('{n} 分', { n: m }) : T('已读 {n}', { n: fmtRead(ms) }));
    el.title = T('当前时间 {t} · 本次已读 {n}', { t: hm, n: fmtRead(ms) });
    el.classList.toggle('warn', m >= 30 && m < 60);
    el.classList.toggle('tired', m >= 60);
    var fl = $('clockFloat');
    if (fl) { fl.textContent = hm + ' · ' + T('已读 {n}', { n: fmtRead(ms) }); fl.style.opacity = ''; }
  }
  function clkTick() {
    clkPaint();
    var rest = Number(CFG.restMin) || 0;
    if (!rest || !CLK.t0 || CLK.warned) return;
    if (Date.now() < CLK.snoozeTo) return;
    if (clkTotal() - CLK.mark < rest * 60000) return;
    CLK.warned = 1;
    showRest(rest);
  }
  function clkStart() {
    if (CLK.t0) return;
    // 上次读得太久以前（>10 分钟），这次重新起算
    if (CLK.last && Date.now() - CLK.last > 600000) { CLK.acc = 0; CLK.mark = 0; }
    CLK.t0 = Date.now();
    if (!CLK.timer) CLK.timer = setInterval(clkTick, 20000);
    clkPaint();
  }
  function clkStop(save) {
    if (CLK.t0) { CLK.acc += Date.now() - CLK.t0; CLK.t0 = 0; }
    CLK.last = Date.now();
    if (save !== false) clkPaint();
  }
  function clkReset() {
    CLK.acc = 0; CLK.mark = 0; CLK.snoozeTo = 0; CLK.warned = 0;
    hideRest(); clkPaint();
  }
  function showRest(min) {
    var t = $('restTip'); if (!t) return;
    if ($('restTipTx')) $('restTipTx').innerHTML = '<span class="ic">☕</span>' +
      esc(T('已连续阅读 {n}，抬头看看远处，喝口水吧。', { n: fmtRead(min * 60000) }));
    t.classList.add('on');
  }
  function hideRest() { var t = $('restTip'); if (t) t.classList.remove('on'); }
  function restTake() {
    autoStop(true); hideRest();
    CLK.warned = 0; CLK.mark = 0; CLK.acc = 0; CLK.snoozeTo = 0; CLK.last = 0;
    if (CLK.t0) CLK.t0 = Date.now();
    clkPaint();
    toast(T('已重新计时，读累了就歇会儿'), 2600);
  }
  function restSnooze() {
    hideRest();
    CLK.warned = 0; CLK.snoozeTo = Date.now() + 10 * 60000;
    CLK.mark = clkTotal();
    toast(T('10 分钟后再提醒'), 1800);
  }
  function autoStepPage() {
    if (!AUTO.on || AUTO.paused || document.hidden) return;
    if ($('modal').classList.contains('on') || $('side').classList.contains('on')) return;
    autoTurn();
  }
  function autoStepScroll(t) {
    if (!AUTO.on) return;
    if (AUTO.paused || document.hidden || $('modal').classList.contains('on')) {
      AUTO.t0 = t; AUTO.raf = requestAnimationFrame(autoStepScroll); return;
    }
    document.body.classList.add('autoscroll');
    var w = $('pageWrap');
    if (!w || !BK) { autoStop(true); return; }
    var dt = Math.min(220, t - (AUTO.t0 || t)); AUTO.t0 = t;
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 2) autoTurn();
    else { AUTO.y += autoSpeedPx() * dt / 1000; w.scrollTop = AUTO.y; }
    if (AUTO.on) AUTO.raf = requestAnimationFrame(autoStepScroll);
  }
  function autoTurn() {
    if (!BK) return;
    var lastCh = BK.ch >= chapterCount() - 1;
    if (pgEnabled()) {
      if (PG.i < PG.count - 1) { pgTo(PG.i + 1); return; }
      if (CFG.autoNext !== 0 && !lastCh) { renderChapter(BK.ch + 1, { silent: true }); return; }
      autoStop(true); toast(T('已到本章末尾，自动阅读已停止'), 2600); return;
    }
    var w = $('pageWrap');
    if (w.scrollTop + w.clientHeight >= w.scrollHeight - 2) {
      if (CFG.autoNext !== 0 && !lastCh) { renderChapter(BK.ch + 1, { silent: true }); return; }
      autoStop(true); toast(T('已到本章末尾，自动阅读已停止'), 2600); return;
    }
    w.scrollTop += w.clientHeight * 0.9;
  }

  /* ================= 全屏 / 沉浸 ================= */
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function inImm() { return document.body.classList.contains('imm'); }
  function syncFullBtn() {
    var b = $('btnFull'); if (!b) return;
    b.classList.toggle('on', inImm() || isFull());
    b.textContent = T((inImm() || isFull()) ? '退出' : '全屏');
    b.title = T('全屏 / 沉浸阅读');
    b.setAttribute('aria-label', b.title);
  }
  function applyImm() {
    var on = !!CFG.immersive && $('viewRead').classList.contains('on');
    document.body.classList.toggle('imm', on);
    if (!on) {
      $('readTop').classList.remove('peek'); $('readFoot').classList.remove('peek');
    }
    syncFullBtn();
  }
  function toggleFull() {
    var next = !(inImm() || isFull());
    CFG.immersive = next ? 1 : 0; saveCfg(); applyImm();
    try {
      if (next) {
        var e = document.documentElement, fn = e.requestFullscreen || e.webkitRequestFullscreen;
        if (fn) { var r = fn.call(e); if (r && r.catch) r.catch(function () { }); }
      } else if (isFull()) {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { var r2 = ex.call(document); if (r2 && r2.catch) r2.catch(function () { }); }
      }
    } catch (e) { /* 部分环境不支持全屏，沉浸照样生效 */ }
    setTimeout(function () { if (BK && pgEnabled()) pgReflow(); }, 220);
    toast(next ? T('全屏阅读：开（鼠标移到上下边缘唤出工具栏，Esc 退出）') : T('全屏阅读：关'), 2800);
  }


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
    var lines = text.split('\n'), chapters = [], cur = { title: T('开篇'), lines: [] }, found = 0;
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
    if (!out.length) out = [{ title: name, lines: [T('（空文件）')] }];
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
    // 把 EPUB 样式限定在正文区，避免污染工具栏；字号/行距/颜色等一律交给用户设置。
    // 关键：书里的 body{...} 会落到 #page 这个「和阅读器同一个元素」上，
    // 如果放行 margin / padding / width，就会把阅读器的版心挤歪（曾导致双栏右栏被裁）。
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, function (all, sel, body) {
      if (/^\s*@/.test(sel)) return all;
      // 用户设置说了算的排版属性 + 书的盒模型，一律剥掉
      var clean = body.replace(/(^|;)\s*(font-size|font-family|line-height|color|background|background-color|text-align|text-indent|column-count|column-width|column-gap|column-fill|columns)\s*:[^;]*/gi, '$1');
      var s2 = sel.split(',').map(bookSel).join(',');
      // 直接命中正文容器本身（书里的 html/body/:root）→ 只留无害属性
      if (s2 === '#page') {
        clean = clean.replace(/(^|;)\s*(margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|width|max-width|min-width|height|max-height|float|position|inset|top|right|bottom|left|overflow)\s*:[^;]*/gi, '$1');
        if (!/[a-z-]+\s*:/i.test(clean)) return '';
      }
      return s2 + '{' + clean + '}';
    });
  }
  /* 把书里的选择器映射进正文区：body → #page，body p → #page p */
  function bookSel(x) {
    x = x.trim();
    if (!x) return x;
    if (x.indexOf('#page') === 0) return x;
    // 吃掉开头连续的 html / body / :root，只留层级后半段
    var rest = x, guard = 0;
    while (guard++ < 4) {
      var m = rest.match(/^(?::root|html|body)(?:\s*([>+~])\s*|\s+|(?=$))/i);
      if (!m) break;
      rest = rest.slice(m[0].length);
      if (m[1]) { rest = m[1] + rest; break; }
    }
    if (rest === '' ) return '#page';
    if (rest === x) return '#page ' + x;       // 没匹配到 body 层级，直接加前缀
    if (/^[>+~]/.test(rest)) return '#page ' + rest;
    return '#page ' + rest;
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
    if (!real) throw new Error(T('找不到 OPF 描述文件，可能不是标准 EPUB'));
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
      return /^(chapter|part|section|page|text|ch)?[\d_-]+$/i.test(base) ? T('第 {n} 节', { n: i + 1 }) : (base || T('第 {n} 节', { n: i + 1 }));
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
    if (!raw) return '<p class="rdp">' + T('（本章文件缺失）') + '</p>';
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

  /* ---------------- 阅读统计（本机） ---------------- */
  var STATS = { days: {}, total: 0 };
  function loadStats() {
    try { var o = JSON.parse(localStorage.getItem('MOYIN_STATS') || '{}'); if (o && typeof o === 'object') STATS = o; } catch (e) { }
    STATS.days = STATS.days || {}; STATS.total = Number(STATS.total) || 0;
  }
  function saveStats() { try { localStorage.setItem('MOYIN_STATS', JSON.stringify(STATS)); } catch (e) { } }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function statAdd(sec) {
    if (!sec || sec <= 0) return;
    STATS.total += sec;
    var k = dayKey(); STATS.days[k] = (STATS.days[k] || 0) + sec;
    saveStats();
  }
  function statStreak() {
    var n = 0, d = new Date();
    // 今天还没读时，连击从昨天算起，不把「今天没读」当成断签
    if (!STATS.days[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (STATS.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function statDays() { return Object.keys(STATS.days).length; }
  /* 时长文案：小于 1 分钟说秒，1 小时内说分，超过说时分 */
  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    if (sec < 60) return T('{s} 秒', { s: sec });
    var m = Math.round(sec / 60);
    if (m < 60) return T('{m} 分', { m: m });
    var h = Math.floor(m / 60), mm = m % 60;
    return mm ? T('小时 {h} 分', { h: h, m: mm }) : h + ' ' + T('小时');
  }
  /* 单次阅读计时：打开书开始，关书 / 切后台 / 关页面结算 */
  var RT = { t0: 0, id: null };
  function rtStart(id) { rtFlush(); RT.t0 = Date.now(); RT.id = id; }
  function rtFlush() {
    if (!RT.t0 || !RT.id) { RT.t0 = 0; RT.id = null; return; }
    var sec = Math.round((Date.now() - RT.t0) / 1000), id = RT.id;
    RT.t0 = 0; RT.id = null;
    if (sec < 3) return;                       // 翻两下就走的不记账
    if (sec > 3 * 3600) sec = 3 * 3600;        // 挂机保护：单次最多记 3 小时
    statAdd(sec);
    var b = bookOf(id);
    if (b) {
      b.rt = (b.rt || 0) + sec;
      b.sessions = (b.sessions || 0) + 1;
      b.first = b.first || Date.now();
      dbPut('books', b).catch(function () { });
    }
  }

  /* ---------------- 书架 ---------------- */
  function bookOf(id) { return BOOKS.filter(function (b) { return b.id === id; })[0]; }
  function shelves() { if (!Array.isArray(CFG.shelves)) CFG.shelves = []; return CFG.shelves; }
  function hlList(b) { return (b && b.hl) || []; }
  function noteCount(b) { return hlList(b).filter(function (h) { return h.note; }).length; }
  function sortBooks() {
    var f = ({ last: function (a, b) { return b.last - a.last; },
      name: function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh'); },
      added: function (a, b) { return b.added - a.added; },
      progress: function (a, b) { return b.progress - a.progress; } })[CFG.sort] || function (a, b) { return b.last - a.last; };
    // 收藏的书永远排在前面，内部再按当前排序规则
    BOOKS.sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || f(a, b); });
  }
  function shelfView() { return CFG.shelfView || 'all'; }
  function matchShelf(b, v) {
    if (v === 'fav') return !!b.fav;
    if (v === 'none') return !b.group || shelves().indexOf(b.group) < 0;
    if (v.indexOf('g:') === 0) return b.group === v.slice(2);
    return true;
  }
  function renderShelfBar() {
    var box = $('shelfBar'); if (!box) return;
    var v = shelfView(), items = [];
    items.push({ k: 'all', label: T('全部书籍'), n: BOOKS.length });
    items.push({ k: 'fav', label: T('★ 收藏'), n: BOOKS.filter(function (b) { return b.fav; }).length });
    shelves().forEach(function (nm) {
      items.push({ k: 'g:' + nm, label: nm, n: BOOKS.filter(function (b) { return b.group === nm; }).length });
    });
    var noneN = BOOKS.filter(function (b) { return !b.group || shelves().indexOf(b.group) < 0; }).length;
    if (shelves().length && noneN) items.push({ k: 'none', label: T('未分组'), n: noneN });
    box.innerHTML = items.map(function (x) {
      return '<button class="chip' + (v === x.k ? ' on' : '') + '" data-sv="' + esc(x.k) + '">' +
        esc(x.label) + '<span class="n">' + x.n + '</span></button>';
    }).join('') + '<button class="chip add" data-sv="__new">＋ ' + esc(T('新建书架')) + '</button>';
  }
  function shelfList() {
    var q = ($('libSearch').value || '').trim().toLowerCase(), v = shelfView();
    return BOOKS.filter(function (b) {
      if (!matchShelf(b, v)) return false;
      return !q || (b.name || '').toLowerCase().indexOf(q) >= 0 || (b.author || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderShelf() {
    sortBooks();
    renderShelfBar();
    var q = ($('libSearch').value || '').trim().toLowerCase(), box = $('shelf'), v = shelfView();
    var list = shelfList();
    box.innerHTML = list.map(function (b) {
      var cv = b.cover ? '<img src="' + b.cover + '" alt="">'
        : '<div class="ph">' + esc((b.name || T('书')).slice(0, 4)) + '</div>';
      var nc = noteCount(b);
      return '<div class="bk' + (SELS[b.id] ? ' sel' : '') + '" data-id="' + b.id + '">' +
        '<div class="cv">' + cv + (nc ? '<span class="kn">✎ ' + nc + '</span>' : '') + '</div>' +
        '<div class="chk">✓</div>' +
        '<button class="fav' + (b.fav ? ' on' : '') + '" data-fav="' + b.id + '" title="' +
        esc(b.fav ? T('取消收藏') : T('收藏')) + '">' + (b.fav ? '★' : '☆') + '</button>' +
        '<button class="more" data-more="' + b.id + '" title="' + esc(T('更多')) + '">⋯</button>' +
        '<div class="meta"><div class="nm">' + esc(b.name) + '</div>' +
        '<div class="sub"><span class="tag">' + esc(b.ext.toUpperCase()) + '</span>' + fmtSize(b.size) +
        (b.author ? ' · ' + esc(b.author.slice(0, 8)) : '') + '</div>' +
        '<div class="bar"><i style="width:' + Math.min(100, b.progress || 0) + '%"></i></div>' +
        '<div class="sub">' + (b.progress > 0 ? T('读到 {p}%', { p: (b.progress).toFixed(1) }) : T('未读')) + ' · ' + fmtDate(b.last) + '</div>' +
        (b.lCh != null && b.lPi != null
          ? '<button class="resume" data-listen="' + b.id + '" title="' + esc(T('从上次听到的地方继续听')) + '">' +
            esc(T('▶ 续听 · 第 {n} 章', { n: (b.lCh | 0) + 1 })) + '</button>'
          : '') +
        '</div></div>';
    }).join('');
    $('emptyLib').style.display = BOOKS.length ? 'none' : '';
    $('libStat').textContent = T('书架 {n} 本', { n: BOOKS.length }) +
      (q || v !== 'all' ? T('（筛出 {n} 本）', { n: list.length }) : '');
    var st = $('libStats');
    if (st) {
      var bits = [];
      if (STATS.total >= 60) bits.push(T('累计阅读 {t}', { t: fmtDur(STATS.total) }));
      if (statDays()) bits.push(T('共 {n} 天，最长连续 {d} 天', { n: statDays(), d: statStreak() }));
      st.textContent = bits.join(' · ');
    }
    renderSelBar();
  }
  /* ------- 批量选择 ------- */
  var SELS = {};
  function selCount() { return Object.keys(SELS).filter(function (k) { return SELS[k]; }).length; }
  function enterSelMode(on) {
    document.body.classList.toggle('selmode', !!on);
    if (!on) SELS = {};
    $('selBar').hidden = !on;
    renderShelf();
  }
  function renderSelBar() {
    if (document.body.classList.contains('selmode')) $('selCount').textContent = T('已选 {n} 本', { n: selCount() });
  }
  function toggleSel(id) { SELS[id] = !SELS[id]; renderShelf(); }
  function askBatchMove() {
    var ids = Object.keys(SELS).filter(function (k) { return SELS[k]; });
    if (!ids.length) { toast(T('先从书架选择书籍')); return; }
    var opts = shelves().map(function (nm) { return '<option value="' + esc(nm) + '">' + esc(nm) + '</option>'; }).join('');
    showModal(T('移动到书架'),
      '<div class="row"><label>' + esc(T('移动到')) + '</label><select id="mvTo">' +
      '<option value="">' + esc(T('未分组')) + '</option>' + opts + '</select>' +
      '<input type="text" id="mvNew" placeholder="' + esc(T('或新建书架')) + '" style="width:150px"></div>',
      [{ label: T('取消') }, { label: T('确定'), cls: 'pri', fn: function () {
        var v = $('mvNew').value.trim() || $('mvTo').value;
        if (v && shelves().indexOf(v) < 0) { shelves().push(v); saveCfg(); }
        ids.forEach(function (id) { var b = bookOf(id); if (b) { b.group = v; dbPut('books', b).catch(function () { }); } });
        closeModal(); exitSel(); toast(T('已移动 {n} 本', { n: ids.length }));
      } }]);
  }
  function batchFav() {
    var ids = Object.keys(SELS).filter(function (k) { return SELS[k]; });
    if (!ids.length) { toast(T('先从书架选择书籍')); return; }
    ids.forEach(function (id) { var b = bookOf(id); if (b) { b.fav = 1; dbPut('books', b).catch(function () { }); } });
    toast(T('已收藏 {n} 本', { n: ids.length })); renderShelf();
  }
  function batchDel() {
    var ids = Object.keys(SELS).filter(function (k) { return SELS[k]; });
    if (!ids.length) { toast(T('先从书架选择书籍')); return; }
    confirmModal(T('把选中的 {n} 本从书架移除？原文件不会从电脑删除。', { n: ids.length }), async function () {
      for (var i = 0; i < ids.length; i++) { await dbDel('books', ids[i]); await dbDel('blobs', ids[i]); }
      BOOKS = BOOKS.filter(function (b) { return ids.indexOf(b.id) < 0; });
      exitSel();
    });
  }
  function exitSel() { enterSelMode(false); }

  /* ------- 单本菜单：收藏 / 编辑信息 / 移动 / 移除 ------- */
  function openBookMenu(id) {
    var b = bookOf(id); if (!b) return;
    var opts = '<option value="">' + esc(T('未分组')) + '</option>' +
      shelves().map(function (nm) { return '<option value="' + esc(nm) + '"' + (b.group === nm ? ' selected' : '') + '>' + esc(nm) + '</option>'; }).join('') +
      (b.group && shelves().indexOf(b.group) < 0 ? '<option value="' + esc(b.group) + '" selected>' + esc(b.group) + '</option>' : '');
    showModal(b.name,
      '<div class="row"><label>' + esc(T('书名')) + '</label><input type="text" id="bkName" value="' + esc(b.name) + '" style="flex:1"></div>' +
      '<div class="row"><label>' + esc(T('作者')) + '</label><input type="text" id="bkAuthor" value="' + esc(b.author || '') + '" style="flex:1"></div>' +
      '<div class="row"><label>' + esc(T('移动到')) + '</label><select id="bkGroup" style="flex:1">' + opts + '</select></div>' +
      '<div class="row"><label></label><div class="seg">' +
      '<button data-bkact="fav">' + esc(b.fav ? T('取消收藏') : T('收藏')) + '</button>' +
      '<button data-bkact="select">' + esc(T('批量管理')) + '</button>' +
      '<button data-bkact="del" class="danger">' + esc(T('从书架移除')) + '</button></div></div>' +
      '<p class="kv">' + esc(T('改名只影响书架显示，不会改动原文件。')) + '</p>',
      [{ label: T('取消') }, { label: T('保存'), cls: 'pri', fn: function () {
        var nm = $('bkName').value.trim(), au = $('bkAuthor').value.trim(), g = $('bkGroup').value;
        if (nm) b.name = nm;
        b.author = au; b.group = g;
        dbPut('books', b).catch(function () { }); closeModal(); renderShelf(); toast(T('已保存'));
      } }]);
    $('modalBody').onclick = function (e) {
      var a = e.target.closest('[data-bkact]'); if (!a) return;
      var act = a.getAttribute('data-bkact');
      if (act === 'fav') { b.fav = b.fav ? 0 : 1; dbPut('books', b).catch(function () { }); closeModal(); renderShelf(); }
      else if (act === 'select') {
        closeModal();
        if (!document.body.classList.contains('selmode')) enterSelMode(true);
        SELS[id] = true; renderShelf();
      } else if (act === 'del') {
        closeModal();
        confirmModal(T('把《{n}》从书架移除？原文件不会从电脑删除。', { n: b.name }), async function () {
          await dbDel('books', id); await dbDel('blobs', id);
          BOOKS = BOOKS.filter(function (x) { return x.id !== id; }); renderShelf(); toast(T('已移除'));
        });
      }
    };
  }
  function toggleFav(id) {
    var b = bookOf(id); if (!b) return;
    b.fav = b.fav ? 0 : 1;
    dbPut('books', b).catch(function () { });
    renderShelf();
    toast(b.fav ? T('已收藏') : T('已取消收藏'), 1500);
  }

  /* ------- 书架的增删改 ------- */
  function showShelves() {
    var list = shelves();
    var rows = list.map(function (nm, i) {
      var n = BOOKS.filter(function (b) { return b.group === nm; }).length;
      return '<div class="row"><label style="min-width:0;flex:1">' + esc(nm) + '<span class="kv"> · ' + T('共 {n} 本', { n: n }) + '</span></label>' +
        '<button data-sh="ren" data-i="' + i + '">' + esc(T('重命名')) + '</button>' +
        '<button data-sh="del" data-i="' + i + '" class="danger">' + esc(T('解散书架')) + '</button></div>';
    }).join('') || '<p class="kv">' + esc(T('还没有自定义书架。新建一个，把书分类放进去。')) + '</p>';
    showModal(T('管理书架'),
      '<div class="row"><label>' + esc(T('新建书架')) + '</label>' +
      '<input type="text" id="shNew" placeholder="' + esc(T('书架名')) + '" style="flex:1;min-width:120px">' +
      '<button class="pri" data-sh="add">' + esc(T('新建')) + '</button></div>' + rows +
      '<p class="kv">' + esc(T('解散书架不会删书，里面的书会回到「未分组」。')) + '</p>',
      [{ label: T('关闭') }]);
    $('modalBody').onclick = function (e) {
      var b = e.target.closest('[data-sh]'); if (!b) return;
      var act = b.getAttribute('data-sh'), i = Number(b.getAttribute('data-i'));
      if (act === 'add') {
        var nm = ($('shNew').value || '').trim();
        if (!nm) { toast(T('请先填写书架名')); return; }
        if (shelves().indexOf(nm) >= 0) { toast(T('已经有同名书架')); return; }
        shelves().push(nm); saveCfg(); showShelves(); renderShelf(); toast(T('书架已建好'));
      } else if (act === 'ren') {
        var old = shelves()[i];
        showModal(T('重命名'), '<input type="text" id="shRen" value="' + esc(old) + '" style="width:100%">',
          [{ label: T('取消') }, { label: T('保存'), cls: 'pri', fn: function () {
            var nm2 = ($('shRen').value || '').trim();
            if (!nm2 || nm2 === old) { closeModal(); return; }
            shelves()[i] = nm2; saveCfg();
            BOOKS.forEach(function (x) { if (x.group === old) { x.group = nm2; dbPut('books', x).catch(function () { }); } });
            if (shelfView() === 'g:' + old) CFG.shelfView = 'g:' + nm2;
            saveCfg(); closeModal(); renderShelf(); toast(T('书架已重命名'));
          } }]);
      } else if (act === 'del') {
        var nm3 = shelves()[i];
        confirmModal(T('解散书架「{n}」？书不会被删除。', { n: nm3 }), function () {
          shelves().splice(i, 1);
          BOOKS.forEach(function (x) { if (x.group === nm3) { x.group = ''; dbPut('books', x).catch(function () { }); } });
          if (shelfView() === 'g:' + nm3) CFG.shelfView = 'all';
          saveCfg(); closeModal(); renderShelf(); toast(T('已解散书架「{n}」，书都还在「全部书籍」里', { n: nm3 }), 3600);
        });
      }
    };
  }
  function readExt(name) {
    var e = (name.split('.').pop() || '').toLowerCase();
    if (e === 'epub') return 'epub';
    if (e === 'txt' || e === 'text') return 'txt';
    return '';
  }
  async function importFolder() {
    // 桌面版：用 Python 的原生「选择文件夹」，不走浏览器那个「选择要上传的文件夹」
    if (typeof window.__moyinPickDir === 'function') {
      var r;
      try {
        r = await window.__moyinPickDir();
      } catch (e) {
        showModal(T('打开文件夹失败'), '<p>' + esc(e.message || String(e)) + '</p>', [{ label: T('关闭') }]);
        return;
      }
      if (!r || r.cancel) return;
      if (!r.files || !r.files.length) {
        toast(r.skipped ? T('这个文件夹里只找到 {k} 个很小的 txt，看着不像书，没有导入', { k: r.skipped })
                        : T('这个文件夹里没有找到 TXT / EPUB'), 4200);
        return;
      }
      var dn = (r.dir || '').split(/[\\/]/).filter(Boolean).pop() || r.dir;
      var msg = T('在「{d}」里找到 {n} 个 TXT / EPUB', { d: dn, n: r.files.length });
      if (r.skipped) msg += '，' + T('跳过 {k} 个太小的文件', { k: r.skipped });
      if (r.truncated) msg += '，' + T('超过上限，只取前 {n} 个', { n: r.files.length });
      confirmModal(msg + T('。开始导入？'), function () { importFiles(r.files); });
      return;
    }
    $('dirInput').click();
  }
  async function importFiles(files) {
    var okN = 0, skipN = 0, errs = [], total = files.length;
    for (var i = 0; i < files.length; i++) {
      var f = files[i], ext = readExt(f.name);
      if (!ext) { skipN++; continue; }
      var bname = f.name.replace(/\.[^.]+$/, '');
      if (BOOKS.some(function (b) { return b.name === bname && b.size === f.size; })) { skipN++; continue; }
      try {
        if (total > 3) toast(T('导入中… {a}/{b}', { a: i + 1, b: total }), 1500);
        var buf = await f.arrayBuffer();
        var b = await parseBook(buf, bname, ext);
        var id = 'b' + Date.now() + Math.random().toString(36).slice(2, 7);
        await dbPut('blobs', { id: id, buf: buf });
        var meta = {
          id: id, name: bname, ext: ext, size: f.size,
          added: Date.now(), last: Date.now(), ch: 0, ratio: 0, progress: 0,
          cover: b.cover || '', title: b.title, author: b.author || '', marks: [], hl: [],
          chapters: b.titles.slice(0, 1000), tocCount: b.toc.length, enc: b.enc || '',
          group: shelfView().indexOf('g:') === 0 ? shelfView().slice(2) : '',
          fav: 0, rt: 0, sessions: 0, first: 0
        };
        await dbPut('books', meta); BOOKS.push(meta); okN++;
        if (b.enc && b.enc !== 'UTF-8' && b.enc !== 'UTF-8 BOM') toast(T('《{n}》按 {e} 解码', { n: meta.name, e: b.enc }), 3200);
      } catch (e) { errs.push(f.name + '：' + e.message); }
    }
    renderShelf();
    var msg = T('已导入 {n} 本', { n: okN });
    if (skipN) msg += ' · ' + T('跳过 {n} 本（重复或不支持）', { n: skipN });
    if (errs.length) msg += T('，{n} 本失败', { n: errs.length });
    if (okN || skipN || errs.length) toast(msg, 3000);
    if (errs.length) showModal(T('部分文件未能导入'), '<p>' + errs.map(esc).join('</p><p>') + '</p>', [{ label: T('知道了') }]);
  }

  /* ---------------- 阅读 ---------------- */
  function chapterTitle(i) { return (BK.titles && BK.titles[i]) || T('第 {n} 节', { n: i + 1 }); }
  function chapterCount() { return BK ? BK.count : 0; }
  function showView(v) {
    $('viewLib').classList.toggle('on', v === 'lib');
    $('viewRead').classList.toggle('on', v === 'read');
    if (v === 'lib') { autoStop(true); hideRest(); clkStop(); renderShelf(); }
    else clkStart();
    applyImm();
  }
  async function openBook(id) {
    var rec = await dbGet('blobs', id);
    if (!rec) { toast(T('这本书的文件已丢失，请重新导入')); return; }
    var meta = BOOKS.filter(function (b) { return b.id === id; })[0] || await dbGet('books', id);
    stopSpeak(true);
    autoStop(true);
    resetCast();
    clearAssets();
    try {
      BK = await parseBook(rec.buf, meta.name, meta.ext);
    } catch (e) { toast(T('打开失败：') + e.message, 4000); return; }
    BK.id = id; BK.meta = meta;
    if (!Array.isArray(meta.hl)) meta.hl = [];
    if (!meta.first) meta.first = Date.now();
    meta.last = Date.now();
    $('readTitle').textContent = meta.name;
    $('readTitle').title = meta.name + (meta.author ? ' · ' + meta.author : '');
    showView('read');
    hideSelTools();
    renderChapter(meta.ch || 0, { ratio: meta.ratio || 0, silent: true });
    renderSide();
    rtStart(id);
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
    toast(T('从上次听到的地方继续（第 {n} 章）', { n: ch + 1 }), 2800);
  }
  function closeBook() {
    rtFlush();
    stopSpeak(true); savePos(); BK = null;
    CFG.immersive = 0; saveCfg(); clkStop();               // 回书架时退出全屏阅读，计时停表
    try { if (isFull()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { var r = ex.call(document); if (r && r.catch) r.catch(function () { }); } } } catch (e) { }
    showView('lib');
    $('side').classList.remove('on'); $('speakBar').classList.remove('on');
    hideSelTools();
    clearAssets(); renderShelf();
  }
  /* 书里正文常自带一个章节标题，和顶部 #chTitle 重复 —— 去重，只留一个 */
  function dedupeHead() {
    var t = $('chTitle'); if (!t) return;
    var norm = function (s) {
      return String(s || '').toLowerCase()
        .replace(/[\s\u3000·・.,，。:：、!！?？"'“”‘’（）()《》〈〉【】\[\]\-—_~～]/g, '');
    };
    var want = norm(t.textContent);
    if (want.length < 2) return;
    var n = 0, el = t.nextElementSibling;
    while (el && n++ < 8) {
      if (el.id === 'chEnd') break;
      var tag = el.tagName;
      if (/^H[1-6]$/.test(tag) || el.classList.contains('rdh') || tag === 'P' || tag === 'DIV') {
        // 整段文字和标题完全一样：不管它是 h2 还是普通段落，都是重复的标题
        var got = norm(el.textContent);
        if (!got) { el = el.nextElementSibling; continue; }
        if (got === want) { el.classList.add('dupH'); return; }
        // 真标题才允许「包含」式匹配（书里常带副标题或多一个「第 x 章」前缀）
        if (/^H[1-6]$/.test(tag) || el.classList.contains('rdh')) {
          if (got.length > 3 && (want.indexOf(got) === 0 || got.indexOf(want) === 0)) {
            el.classList.add('dupH');
            return;
          }
        }
      }
      el = el.nextElementSibling;
    }
  }
  function renderChapter(i, opt) {
    if (!BK) return;
    opt = opt || {};
    i = Math.max(0, Math.min(chapterCount() - 1, i | 0));
    BK.ch = i;
    var html;
    try { html = BK.chapterHtml(i); } catch (e) { html = '<p class="rdp">' + esc(T('本章读取失败：') + e.message) + '</p>'; }
    PG.ready = 0;                                     // 换章了，旧的页数作废
    $('page').innerHTML = '<div id="chTitle">' + esc(chapterTitle(i)) + '</div>' + html +
      '<div id="chEnd">' + esc(T('— 本章完 —')) + '<br><button data-act="next">' + esc(T('下一章 →')) + '</button></div>';
    dedupeHead();
    $('pageWrap').scrollTop = 0;
    applyHighlights();
    SPK.paras = Array.prototype.slice.call($('page').querySelectorAll('.rdp'));
    // 翻页模式：量好列数页数后定位；滚动模式：按比例还原
    if (pgEnabled()) {
      pgMeasure();
      var tp = opt.pg === 'last' ? PG.count - 1 : (opt.ratio ? Math.round((PG.count - 1) * opt.ratio) : 0);
      pgTo(tp, { instant: true });
    }
    applyCfg();
    if (!pgEnabled() && opt.ratio) setTimeout(function () {
      var w = $('pageWrap'); w.scrollTop = (w.scrollHeight - w.clientHeight) * opt.ratio;
    }, 60);
    if (opt.anchor) setTimeout(function () {
      var list = $('page').querySelectorAll('[id],[name]'), j, an = String(opt.anchor);
      for (j = 0; j < list.length; j++) {
        if (list[j].id === an || list[j].getAttribute('name') === an) {
          if (pgEnabled()) { var pg = paraPage(list[j]); if (pg !== PG.i) pgTo(pg, { instant: true }); }
          else list[j].scrollIntoView({ block: 'center' });
          break;
        }
      }
    }, 80);
    updateProgress();
    if (!opt.silent) savePos();
    renderSide();
    if (SPK.on && SPK.playing && opt.fromSpeak !== true) { /* 朗读跨章由朗读器接管 */ }
  }
  var saveT = null;
  /* 改高亮 / 笔记后重绘本章，位置保持不动（翻页模式停在原页） */
  function renderKeep(opt) {
    if (!BK) return;
    opt = opt || { silent: true };
    if (pgEnabled()) {
      var was = PG.i;
      renderChapter(BK.ch, opt);
      if (was) pgTo(Math.min(was, PG.count - 1), { instant: true });
    } else {
      var st = $('pageWrap').scrollTop;
      renderChapter(BK.ch, opt);
      $('pageWrap').scrollTop = st;
    }
  }
  function updateProgress() {
    if (!BK) return;
    var n = chapterCount(), r, p, tail = '';
    if (pgEnabled()) {
      r = PG.count > 1 ? PG.i / (PG.count - 1) : 0;
      p = (BK.ch + r) / n * 100;
      tail = ' · ' + T('{a}/{b} 页', { a: PG.i + 1, b: PG.count });
    } else {
      var w = $('pageWrap'), max = Math.max(1, w.scrollHeight - w.clientHeight);
      r = Math.max(0, Math.min(1, w.scrollTop / max));
      p = (BK.ch + r) / n * 100;
    }
    BK.ratio = r;
    $('progRange').value = Math.round(p / 100 * 1000);
    $('progTx').textContent = p.toFixed(1) + '% · ' + (BK.ch + 1) + '/' + n + tail;
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
    if (pgEnabled()) {
      var t = pgTopPara();
      if (t) return Math.max(0, SPK.paras.indexOf(t));
      // 本页没有段落（例如只剩「本章完」）：取离当前页最近的一段
      var best = 0, bd = 1e9;
      SPK.paras.forEach(function (p, i) {
        var d = Math.abs(paraPage(p) - PG.i);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }
    var w = $('pageWrap'), top = w.getBoundingClientRect().top, b0 = 0, bd0 = 1e9;
    SPK.paras.forEach(function (p, i) { var dd = Math.abs(p.getBoundingClientRect().top - top - 90); if (dd < bd0) { bd0 = dd; b0 = i; } });
    return b0;
  }

  /* ---------------- 侧栏：目录 / 书签 / 笔记 / 搜索 ---------------- */
  function openSide(tab) {
    var same = tab && tab === SIDE && $('side').classList.contains('on');
    if (same) { closeSide(); return; }        // 再点同一个按钮 = 收起
    SIDE = tab || SIDE; $('side').classList.add('on');
    $('side').querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === SIDE); });
    renderSide();
  }
  function closeSide() {
    if (!$('side').classList.contains('on')) return;
    $('side').classList.remove('on');
    hideSelTools();
  }
  function hlChapterLabel(h) { return T('第 {n} 章', { n: (h.ch | 0) + 1 }) + ' · ' + chapterTitle(h.ch); }
  function renderSide() {
    if (!BK || !$('side').classList.contains('on')) return;
    var b = $('sideBody'), html = '';
    if (SIDE === 'toc') {
      var toc = BK.toc && BK.toc.length ? BK.toc : BK.titles.map(function (t, i) { return { label: t, ch: i, level: 0 }; });
      html = toc.slice(0, 2000).map(function (t) {
        return '<button class="it' + (t.ch === BK.ch ? ' cur' : '') + (t.level ? ' lv' + Math.min(2, t.level) : '') +
          '" data-ch="' + t.ch + '" data-anchor="' + esc(t.anchor || '') + '">' + esc(t.label) + '</button>';
      }).join('');
      if (!html) html = '<div class="hint">' + esc(T('这本书没有目录')) + '</div>';
    } else if (SIDE === 'mark') {
      var ms = (BK.meta.marks || []).slice().sort(function (a, c) { return c.ts - a.ts; });
      html = '<div class="row" style="margin:0 0 8px"><button id="sideAddMark">' + esc(T('＋ 在当前位置加书签')) + '</button></div>' +
        (ms.length ? ms.map(function (m, i) {
          return '<div class="it" style="display:flex;gap:6px;align-items:flex-start"><button class="it" style="flex:1;text-align:left;padding:4px" data-mark="' + i + '">' +
            esc(m.text.slice(0, 40)) + '<br><span class="hint">' + fmtDate(m.ts) + ' · ' + esc(T('第 {n} 章', { n: (m.ch | 0) + 1 })) + '</span></button>' +
            '<button class="ghost danger" data-delmark="' + m.ts + '" title="' + esc(T('删除')) + '">×</button></div>';
        }).join('') : '<div class="hint">' + esc(T('还没有书签。读到哪儿，点「＋书签」记一下。')) + '</div>');
    } else if (SIDE === 'note') {
      var hs = hlList(BK.meta).slice().sort(function (a, c) { return (a.ch - c.ch) || (a.p - c.p); });
      var notes = hs.filter(function (h) { return h.note; });
      var onlyNote = CFG.noteFilter === 'note', show = onlyNote ? notes : hs;
      html = '<div style="display:flex;gap:5px;margin-bottom:9px;flex-wrap:wrap">' +
        '<button data-nf="all" class="' + (onlyNote ? '' : 'on') + '" style="font-size:.82em">' + esc(T('全部批注')) + ' ' + hs.length + '</button>' +
        '<button data-nf="note" class="' + (onlyNote ? 'on' : '') + '" style="font-size:.82em">' + esc(T('仅看有笔记的')) + ' ' + notes.length + '</button>' +
        '</div>' +
        (show.length ? show.map(function (h, i) {
          return '<div class="noteIt" data-hlgo="' + esc(h.id) + '">' +
            '<div class="q"><span class="dot noteclr-' + (h.c || 'y') + '" style="margin-right:5px"></span>' + esc(h.text.slice(0, 180)) + '</div>' +
            (h.note ? '<div class="cm">' + esc(h.note.slice(0, 240)) + '</div>' : '') +
            '<div class="ft"><span>' + esc(hlChapterLabel(h)) + '</span><span class="spacer"></span>' +
            '<button data-hledit="' + esc(h.id) + '" title="' + esc(T('编辑笔记')) + '">✎</button>' +
            '<button data-hlshare="' + esc(h.id) + '" title="' + esc(T('分享划线')) + '">↗</button>' +
            '<button data-hldel="' + esc(h.id) + '" class="danger" title="' + esc(T('删除')) + '">×</button></div></div>';
        }).join('') : '<div class="hint" style="line-height:1.9">' + esc(T('还没有笔记。选中正文里的句子，就能高亮、写批注。')) + '</div>') +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">' +
        '<button id="noteExp">' + esc(T('导出笔记')) + '</button>' +
        '<button id="noteSum">' + esc(T('阅读总结')) + '</button></div>';
    } else {
      html = '<div style="display:flex;gap:6px;margin-bottom:9px"><input class="q" type="search" id="findQ" placeholder="' +
        esc(T('全书搜索关键词')) + '"><button id="findGo">' + esc(T('搜')) + '</button></div>' +
        '<div id="findStat" class="hint">' + esc(T('支持当前 EPUB / TXT 全文，最多显示 200 条')) + '</div><div id="findRes"></div>';
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
    stat.textContent = T('搜索中… {a}/{b}', { a: 0, b: chapterCount() });
    for (var i = 0; i < chapterCount(); i++) {
      var t; try { t = BK.chapterText(i); } catch (e) { continue; }
      var idx = t.toLowerCase().indexOf(low);
      while (idx >= 0 && res.length < 200) {
        res.push({ ch: i, label: chapterTitle(i), text: t.slice(Math.max(0, idx - 22), idx + q.length + 34) });
        idx = t.toLowerCase().indexOf(low, idx + q.length);
        if (res.length >= 200) break;
      }
      if (i % 8 === 0) { stat.textContent = T('搜索中… {a}/{b}', { a: i + 1, b: chapterCount() }) + ' · ' + T('命中 {n}', { n: res.length }); await sleep(0); }
      if (tok !== SEARCHTOK || res.length >= 200) break;
    }
    if (tok !== SEARCHTOK) return;
    stat.textContent = res.length ? T('共 {n} 处', { n: res.length }) + (res.length >= 200 ? T('（已截断）') : '') : T('没找到「{q}」', { q: q });
    $('findRes').innerHTML = res.map(function (r) {
      return '<button class="it" data-ch="' + r.ch + '" data-q="' + esc(q) + '"><b>' + esc(r.label) + '</b><br><span class="hint">…' + esc(r.text) + '…</span></button>';
    }).join('');
  }
  function addMark() {
    if (!BK) return;
    var p = currentPara(), t = (SPK.paras[p] ? SPK.paras[p].textContent : '').trim().slice(0, 80) || chapterTitle(BK.ch);
    BK.meta.marks = BK.meta.marks || [];
    BK.meta.marks.push({ ch: BK.ch, p: p, text: t, ts: Date.now() });
    savePos(); toast(T('已加书签')); if (SIDE === 'mark') renderSide();
  }

  /* ---------------- 划线高亮与批注 ----------------
     选区只在段落内部定位：段落序号 + 段内字符区间。渲染章节后按区间重新包 <mark>，
     EPUB 的内联标签由 TreeWalker 按纯文本长度算，跨节点也能量准。 */
  var SEL = { text: '', ch: 0, p: 0, s: 0, e: 0, rect: null };
  function persistBook() {
    if (!BK || !BK.meta) return;
    dbPut('books', BK.meta).catch(function () { });
    var x = bookOf(BK.meta.id); if (x) Object.assign(x, BK.meta);
  }
  function closestPara(node) {
    var e = node && node.nodeType === 1 ? node : (node ? node.parentElement : null);
    if (!e) return null;
    if (e.closest) return e.closest('.rdp');
    return null;
  }
  function textOffsetIn(para, node, offset) {
    var w = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null), n, acc = 0;
    while ((n = w.nextNode())) {
      if (n === node) return acc + offset;
      acc += n.nodeValue.length;
    }
    return -1;
  }
  function rangeAt(para, s, e) {
    var w = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null), n, acc = 0, a = null, b = null;
    while ((n = w.nextNode())) {
      var len = n.nodeValue.length;
      if (a === null && s <= acc + len) a = { n: n, o: Math.max(0, s - acc) };
      if (e <= acc + len) { b = { n: n, o: Math.max(0, e - acc) }; break; }
      acc += len;
    }
    if (!a || !b) return null;
    var r = document.createRange();
    try {
      r.setStart(a.n, Math.min(a.o, a.n.nodeValue.length));
      r.setEnd(b.n, Math.min(b.o, b.n.nodeValue.length));
    } catch (err) { return null; }
    return r.collapsed ? null : r;
  }
  function wrapRange(range, cls) {
    var frag;
    try { frag = range.extractContents(); } catch (e) { return null; }
    var m = document.createElement('mark');
    if (cls) m.className = cls;
    m.appendChild(frag);
    try { range.insertNode(m); } catch (e) { return null; }
    return m;
  }
  /* 章节渲染完成后还原本章的所有高亮 */
  function applyHighlights() {
    var page = $('page');
    if (!page || !BK || !BK.meta) return;
    var list = hlList(BK.meta).filter(function (h) { return h.ch === BK.ch; });
    if (!list.length) return;
    var paras = page.querySelectorAll('.rdp');
    list.forEach(function (h) {
      var p = paras[h.p]; if (!p) return;
      var r = rangeAt(p, h.s, h.e);
      // 段落内容变动（换字号不会，换编码/重排会）：退化为按原文查找
      if (!r || p.textContent.substr(h.s, h.e - h.s) !== h.text) {
        var i = p.textContent.indexOf(h.text);
        if (i < 0) return;
        r = rangeAt(p, i, i + h.text.length);
      }
      if (!r) return;
      var m = wrapRange(r, 'hl-' + (h.c || 'y') + (h.note ? ' hasNote' : ''));
      if (!m) return;
      m.setAttribute('data-hlid', h.id);
      if (h.note) m.title = h.note;
    });
  }
  /* ---- 选区工具条 ---- */
  function readSelection() {
    var s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return null;
    var range = s.getRangeAt(0), page = $('page');
    if (!page || !page.contains(range.startContainer) || !page.contains(range.endContainer)) return null;
    var p0 = closestPara(range.startContainer), p1 = closestPara(range.endContainer);
    if (!p0) return null;
    if (p1 && p1 !== p0) {                      // 跨段选区：只取第一段内的部分
      range = range.cloneRange();
      try { range.setEnd(p0, p0.childNodes.length); } catch (e) { }
    }
    var txt = String(range.toString() || '').replace(/\s+/g, ' ').trim();
    if (!txt || txt.length > 1000) return null;
    var paras = Array.prototype.slice.call(page.querySelectorAll('.rdp'));
    var idx = paras.indexOf(p0);
    if (idx < 0) return null;
    var s0 = textOffsetIn(p0, range.startContainer, range.startOffset);
    var s1 = textOffsetIn(p0, range.endContainer, range.endOffset);
    if (s0 < 0 || s1 <= s0) return null;
    return { text: txt, ch: BK ? BK.ch : 0, p: idx, s: s0, e: s1, rect: range.getBoundingClientRect() };
  }
  function showSelTools(sel) {
    var box = $('selTools');
    SEL = sel;
    box.classList.add('on');
    var bw = box.offsetWidth || 260, bh = box.offsetHeight || 36;
    var r = sel.rect || { left: 0, top: 0, width: 0, bottom: 0 };
    var x = r.left + r.width / 2 - bw / 2, y = r.top - bh - 10;
    if (y < 6) y = r.bottom + 10;
    x = Math.max(6, Math.min(window.innerWidth - bw - 6, x));
    box.style.left = x + 'px'; box.style.top = y + 'px';
  }
  function hideSelTools() { var b = $('selTools'); if (b) b.classList.remove('on'); }
  function onSelUp() {
    if (!$('viewRead').classList.contains('on')) return;
    setTimeout(function () {
      var sel = readSelection();
      if (sel) showSelTools(sel); else hideSelTools();
    }, 10);
  }
  function addHighlight(color, note) {
    if (!SEL.text || !BK) return;
    var hl = {
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ch: SEL.ch, p: SEL.p, s: SEL.s, e: SEL.e, text: SEL.text,
      note: note || '', c: color || 'y', ts: Date.now()
    };
    BK.meta.hl = BK.meta.hl || [];
    BK.meta.hl.push(hl);
    persistBook();
    renderKeep();
    hideSelTools();
    try { window.getSelection().removeAllRanges(); } catch (e) { }
    if (!note) toast(T('已高亮'), 1400);
    if (SIDE === 'note') renderSide();
    return hl;
  }
  function hlById(id) { return hlList(BK && BK.meta).filter(function (h) { return h.id === id; })[0]; }
  function removeHighlight(id) {
    if (!BK) return;
    BK.meta.hl = hlList(BK.meta).filter(function (h) { return h.id !== id; });
    persistBook();
    renderKeep();
    if (SIDE === 'note') renderSide();
    toast(T('已删除批注'), 1600);
  }
  function noteEditor(hl) {
    if (!hl) return;
    showModal(T('编辑笔记'),
      '<div class="kv" style="margin-bottom:10px;line-height:1.7">' + esc(hl.text.slice(0, 220)) +
      (hl.text.length > 220 ? '…' : '') + '</div>' +
      '<textarea id="noteTx" rows="5" placeholder="' + esc(T('写下你的想法…')) +
      '" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:10px;color:var(--tx);font-size:inherit;line-height:1.7;resize:vertical">' +
      esc(hl.note || '') + '</textarea>',
      [{ label: T('删除'), cls: 'danger', fn: function () { closeModal(); removeHighlight(hl.id); } },
        { label: T('取消') },
        { label: T('保存'), cls: 'pri', fn: function () {
          hl.note = ($('noteTx').value || '').trim();
          persistBook(); closeModal();
          renderKeep();
          if (SIDE === 'note') renderSide();
          toast(T('已保存'), 1400);
        } }]);
    setTimeout(function () { var x = $('noteTx'); if (x) x.focus(); }, 60);
  }
  /* 点已有高亮：菜单（换色 / 编辑笔记 / 分享 / 删除） */
  function hlMenu(id) {
    var h = hlById(id); if (!h) return;
    var colors = HL_COLORS.map(function (c) {
      return '<button data-hc="' + c + '" style="width:30px;height:30px;min-height:30px;padding:0;border-radius:50%;background:' +
        ({ y: '#FFD666', g: '#7AD68C', b: '#7AB2FF', p: '#FF96C4' })[c] + ';border:2px solid ' +
        (h.c === c ? 'var(--acc)' : 'transparent') + '" title="' + esc(T('高亮颜色')) + '"></button>';
    }).join('');
    showModal(T('批注'),
      '<div class="kv" style="line-height:1.8;margin-bottom:10px">' + esc(h.text) + '</div>' +
      (h.note ? '<p style="margin-bottom:10px">' + esc(h.note) + '</p>' : '') +
      '<div class="row"><label>' + esc(T('高亮颜色')) + '</label><div class="seg">' + colors + '</div></div>',
      [{ label: T('取消高亮'), cls: 'danger', fn: function () { closeModal(); removeHighlight(h.id); } },
        { label: T('分享划线'), fn: function () { closeModal(); shareHighlight(h); } },
        { label: T('编辑笔记'), cls: 'pri', fn: function () { closeModal(); noteEditor(h); } }]);
    $('modalBody').onclick = function (e) {
      var c = e.target.closest('[data-hc]'); if (!c) return;
      h.c = c.getAttribute('data-hc');
      persistBook(); closeModal();
      renderKeep();
      if (SIDE === 'note') renderSide();
    };
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return legacyCopy(txt); });
    }
    return Promise.resolve(legacyCopy(txt));
  }
  function legacyCopy(txt) {
    try {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      return true;
    } catch (e) { return false; }
  }
  /* ---- 分享卡片：canvas 画一张 1080 宽的图文 ---- */
  function wrapLines(g, text, maxW) {
    var lines = [], cur = '';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      if (g.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function shareHighlight(hl) {
    if (!hl) return;
    var W = 1080, pad = 92, fs = 46, lh = 1.72;
    var cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = fs + 'px "Noto Serif CJK SC","Songti SC",serif';
    var body = hl.text.length > 340 ? hl.text.slice(0, 340) + '…' : hl.text;
    var lines = wrapLines(g, body, W - pad * 2).slice(0, 14);
    var H = pad + 92 + lines.length * fs * lh + 150 + pad;
    cv.width = W; cv.height = H;
    g = cv.getContext('2d');
    g.fillStyle = '#FAF7F0'; g.fillRect(0, 0, W, H);
    // 左侧装饰竖线
    g.fillStyle = '#B08A5A'; g.fillRect(pad, pad + 88, 6, lines.length * fs * lh - 8);
    // 书名与章节
    g.fillStyle = '#8A7A63'; g.font = '30px "Microsoft YaHei",system-ui,sans-serif';
    var meta = (BK ? BK.meta.name : '') + (hl.ch != null && BK ? ' · ' + chapterTitle(hl.ch) : '');
    g.fillText(meta.length > 26 ? meta.slice(0, 26) + '…' : meta, pad + 26, pad + 44);
    // 正文
    g.fillStyle = '#2C2620'; g.font = fs + 'px "Noto Serif CJK SC","Songti SC",serif';
    lines.forEach(function (ln, i) { g.fillText(ln, pad + 30, pad + 88 + fs * 0.95 + i * fs * lh); });
    // 脚注
    var by = H - pad - 46;
    g.fillStyle = '#B08A5A'; g.fillRect(pad, by - 40, W - pad * 2, 2);
    g.fillStyle = '#8A7A63'; g.font = '28px "Microsoft YaHei",system-ui,sans-serif';
    g.fillText(T('墨吟 · 阅读与朗读'), pad, by + 4);
    var mark = '© 永远的兰兰';
    g.textAlign = 'right'; g.fillText(mark, W - pad, by + 4); g.textAlign = 'left';
    var name = (BK ? BK.meta.name : 'highlight').replace(/[\\/:*?"<>|]/g, '_').slice(0, 24);
    try {
      var url = cv.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url; a.download = name + '-划线.png';
      document.body.appendChild(a); a.click(); a.remove();
      toast(T('分享图已保存'), 2600);
    } catch (e) {
      toast(T('生成分享图失败：') + e.message, 3600);
    }
  }

  /* ---------------- 导出笔记 / 阅读总结 ---------------- */
  function fmtDateTime(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function fmtShort(ts) {
    var d = new Date(ts || Date.now());
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function notesMarkdown(b) {
    b = b || (BK && BK.meta);
    if (!b) return '';
    var hs = hlList(b).slice().sort(function (x, y) { return (x.ch - y.ch) || (x.p - y.p); });
    var out = '# ' + (b.name || '') + '\n\n';
    if (b.author) out += '> ' + b.author + '\n\n';
    out += '-' + T('导出时间：') + fmtDateTime() + '\n';
    out += '- ' + T('批注数：') + hs.length + '（' + T('其中带笔记 ') + hs.filter(function (h) { return h.note; }).length + '）\n\n';
    var lastCh = -1;
    hs.forEach(function (h) {
      if (h.ch !== lastCh) {
        lastCh = h.ch;
        out += '\n## ' + T('第 {n} 章', { n: (h.ch | 0) + 1 }) + ' · ' + chapterTitle(h.ch) + '\n\n';
      }
      out += '> ' + String(h.text).replace(/\n/g, ' ') + '\n\n';
      if (h.note) out += T('笔记：') + h.note + '\n\n';
    });
    return out;
  }
  function exportNotes() {
    if (!BK || !BK.meta) return;
    var hs = hlList(BK.meta);
    if (!hs.length) { toast(T('还没有划线或批注')); return; }
    var name = (BK.meta.name || 'notes').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    download(name + '-笔记.md', notesMarkdown(BK.meta), 'text/markdown;charset=utf-8');
    toast(T('笔记已导出'), 2400);
  }
  function gotoHighlight(h) {
    if (!h) return;
    if (h.ch !== BK.ch) renderChapter(h.ch, { silent: true });
    setTimeout(function () {
      var m = $('page').querySelector('mark[data-hlid="' + h.id + '"]');
      if (m) revealPara(m, true);
      else { var p = SPK.paras[h.p]; if (p) revealPara(p); }
    }, 90);
  }
  function showSummary() {
    if (!BK || !BK.meta) return;
    var b = BK.meta, hs = hlList(b).slice().sort(function (x, y) { return (x.ch - y.ch) || (x.p - y.p); });
    var notes = hs.filter(function (h) { return h.note; });
    var n = Math.max(1, chapterCount());
    var prog = ((b.ch || 0) + (b.ratio || 0)) / n * 100;
    var days = b.first ? Math.max(1, Math.ceil((Date.now() - b.first) / 86400000)) : 1;
    var avg = b.sessions ? Math.round((b.rt || 0) / b.sessions) : 0;
    var cells = [
      [T('累计阅读'), b.rt ? fmtDur(b.rt) : '—'],
      [T('阅读进度'), prog.toFixed(1) + '%'],
      [T('章节'), (b.ch || 0) + 1 + ' / ' + chapterCount()],
      [T('批注数'), String(hs.length)],
      [T('其中笔记'), String(notes.length)],
      [T('书签数'), String((b.marks || []).length)],
      [T('阅读天数'), T('{n} 天', { n: days })],
      [T('平均每次'), avg ? fmtDur(avg) : '—'],
      [T('上次阅读'), b.last ? fmtShort(b.last) : '—']
    ];
    var ex = hs.map(function (h) {
      return '<div class="e"><div class="t">' + esc(h.text) + '</div>' +
        (h.note ? '<div class="n">' + esc(h.note) + '</div>' : '') +
        '<div class="h">' + esc(T('第 {n} 章', { n: (h.ch | 0) + 1 })) + ' · ' + fmtDateTime(h.ts) + '</div></div>';
    }).join('') || '<div class="hint" style="padding:8px">' + esc(T('还没有划线或批注')) + '</div>';
    showModal(T('阅读总结') + ' · ' + b.name,
      '<div class="sumGrid">' + cells.map(function (c) {
        return '<div class="c"><b>' + esc(String(c[1])) + '</b><span>' + esc(c[0]) + '</span></div>';
      }).join('') + '</div>' +
      '<h3>' + esc(T('本书摘录')) + ' <span class="kv" style="font-weight:400">' + hs.length + '</span></h3>' +
      '<p class="kv">' + esc(T('按章节顺序汇总你划过的高亮与批注，可导出成 Markdown 笔记。')) + '</p>' +
      '<div class="sumEx">' + ex + '</div>',
      [{ label: T('导出笔记'), fn: exportNotes },
        { label: T('复制全部'), fn: function () { copyText(notesMarkdown(b)).then(function (ok) { toast(ok ? T('已复制') : T('复制失败，请手动选择文本')); }); } },
        { label: T('关闭'), cls: 'pri' }]);
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
    if (cur && cur.indexOf(x[0]) >= 0) return T('⭐ 推荐音色');
    if (CFG.voiceSet === 'all' && LOCAL.list) return T(x[2] || '其他音色');
    return T('⭐ 推荐音色');
  }
  function localVoiceOptions() {
    var list = localVoiceList(), html = '', last = null;
    list.forEach(function (x) {
      var g = voiceGroup(x);
      if (g !== last) {
        if (last !== null) html += '</optgroup>';
        html += '<optgroup label="' + esc(g) + '">'; last = g;
      }
      html += '<option value="' + x[0] + '"' + (CFG.localVoice === x[0] ? ' selected' : '') + '>' + esc(T(x[1])) + '</option>';
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
    if (status === 404) return T('服务路径不匹配，请更新语音包');
    if (status === 503) return T('语音引擎正在初始化，稍后再试');
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
        fillVoices(); if (force && LOCAL.ready) toast(T('已连接免费离线神经语音（{n} 个声线可用）', { n: localVoiceList().length }), 2600);
        return LOCAL.ready;
      })
      .catch(function () {
        LOCAL.ready = false; LOCAL.info = null; LOCAL.list = null; LOCAL.checking = false; LOCAL.miss++;
        fillVoices(); if (force) toast(T('没找到本地语音引擎，请先双击「VoicePack/启动语音引擎.cmd」'), 5200);
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
      if (!b || b.size < 1000) throw new Error(T('服务返回的音频为空'));
      return URL.createObjectURL(b);
    });
  }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; rej(new Error(T('请求超时（语音引擎未响应）'))); } }, ms);
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
    toast(T('本地语音引擎不可用：{m}。已切回系统朗读（双击「VoicePack/启动语音引擎.cmd」可恢复）', { m: msg }), 7000);
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
      a.onerror = function () { if (g === SPK.gen) localFail(T('音频加载失败')); };
      try {
        var q = a.play();
        if (q && q.catch) q.catch(function () { if (g === SPK.gen) localFail(T('浏览器阻止了播放，请点一下页面')); });
      } catch (e) { localFail(e.message); return; }
      localPrefetch();
    }).catch(function (e) {
      if (g === SPK.gen) localFail(e.message || T('请求失败'));
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
    var tag = isNatural(v) ? T('自然') : (v.localService === false ? T('在线') : T('本地'));
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
      b.textContent = T('● 免费神经语音'); b.className = 'vq good';
      b.title = T('本机 sherpa-onnx 神经语音：完全离线、免费、无需账号。当前音色：{v}。左侧下拉可随时换音色，点这里看说明', { v: localVoiceName(CFG.localVoice) });
      var s = $('spVoice');
      if (s) {
        // 连上本机引擎后下拉不再禁用：精选声线就在这里换，听书时可边听边比
        s.disabled = false;
        s.title = T('本机 {n} 个离线声线，选中即生效（当前：{v}）', { n: localVoiceList().length, v: localVoiceName(CFG.localVoice) });
        var lv = 'local:' + CFG.localVoice;
        if (s.value !== lv && s.querySelector('option[value="' + lv + '"]')) s.value = lv;
      }
      return;
    }
    if ($('spVoice')) { $('spVoice').disabled = false; $('spVoice').title = T('朗读语音'); }
    if (!v) { b.textContent = T('无语音'); b.className = 'vq bad'; return; }
    var n = isNatural(v), on = v.localService === false;
    b.textContent = n ? T('● 自然语音') : (on ? T('● 在线语音') : T('● 本地语音（较机械）'));
    b.className = 'vq ' + (n ? 'good' : (on ? 'mid' : 'bad'));
    b.title = n ? T('神经网络语音：语调接近真人；需联网，朗读文字会发送给语音服务合成。点击看说明')
      : (on ? T('在线合成，需联网。点击看说明') : T('系统本地语音，离线可用但音质较机械。点击看说明'));
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
      html += '<optgroup label="' + esc(T('⭐ 本机神经语音 · 免费离线（{n} 个声线）', { n: lv.length })) + '">' + lv.map(function (x) {
        return '<option value="local:' + x[0] + '"' + (x[0] === CFG.localVoice ? ' selected' : '') + '>' +
          esc(T(x[1])) + '</option>';
      }).join('');
      if (total > lv.length) {
        html += '<option value="__more">' + esc(T('⋯ 还有 {n} 个声线，去设置里挑', { n: total - lv.length })) + '</option>';
      }
      html += '</optgroup>';
    }
    if (!vs.length) {
      sel.innerHTML = html || '<option value="">' + esc(T('（系统暂无语音）')) + '</option>';
      if (loc) sel.value = 'local:' + CFG.localVoice;
      voiceBadge(null); return;
    }
    var groups = [
      [0, T('⭐ 自然语音 · 接近真人（需联网）')], [1, T('在线语音（需联网）')],
      [2, T('本地语音 · 较机械（离线可用）')], [3, T('其他语言 · 自然语音')], [4, T('其他语言')]
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
        setTimeout(function () { toast(T('已自动切换到更自然的语音：{v}（朗读条可随时更换）', { v: voiceLabel(best).split(' · ')[0] }), 4600); }, 1000);
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
    return T('多角色');
  }

  function onlineFallback() {
    if (SPK.fb) return false;
    var vs = SYN ? (SYN.getVoices() || []) : [];
    var local = vs.filter(function (v) { return isZh(v) && v.localService !== false; })[0];
    if (!local) return false;
    SPK.fb = 1; CFG.voiceURI = voiceKey(local); CFG.voiceAuto = 0; saveCfg();
    if ($('spVoice')) $('spVoice').value = CFG.voiceURI;
    voiceBadge(local);
    toast(T('在线自然语音连接失败，已自动切回本地语音（联网恢复后可在语音下拉里重新选）'), 5200);
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
      if (CFG.follow) revealPara(p, true);
    }
    var t = (SPK.chunks[SPK.ci] || '').slice(0, 46);
    var who = '';
    if (CFG.roleOn && localReady() && SPK.cv[SPK.ci] && SPK.cv[SPK.ci] !== CFG.localVoice) {
      var nm = SPK.castName[SPK.cv[SPK.ci]] || T('对白');
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
    try { SYN.speak(u); } catch (e) { toast(T('朗读启动失败：') + e.message); stopSpeak(false); return; }
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
      stopSpeak(false); toast(T('朗读结束')); return;
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
    b.textContent = CFG.roleOn ? T('多角色') : T('单声线');
    b.title = CFG.roleOn
      ? T('分角色朗读已开启：旁白用当前声线，引号里的对白按人物换声。点击关闭')
      : T('分角色朗读：对话自动换声（旁白保持当前声线）。点击开启');
  }
  function toggleRole() {
    if (!CFG.roleOn && !localReady()) {
      toast(T('分角色朗读需要本机神经语音（系统语音只能出一个声音）：先双击「VoicePack/启动语音引擎.cmd」'), 6200);
      return;
    }
    CFG.roleOn = CFG.roleOn ? 0 : 1; saveCfg(); syncRoleBtn(); resetCast();
    if (SPK.playing) speakJump(0);
    else if (SPK.on) setPara(SPK.pi);
    toast(CFG.roleOn ? T('分角色朗读已开启：旁白照旧，对白按人物换声') : T('已回到单一声音'), 3000);
  }
  var ROLE_TRY = '他把伞靠在门边，抖了抖上面的水。“外面雨真大。”她抬头看了一眼，又说：“今晚就别走了。”';
  /* 试听分角色：旁白 + 两句不同人物对白，挨个念一遍，听完就知道效果 */
  function tryRole() {
    if (!localReady()) { toast(T('分角色试听需要本机神经语音：先双击「VoicePack/启动语音引擎.cmd」'), 5600); return; }
    if (SPK.playing) stopSpeak(false);
    var keepCast = SPK.cast, keepUsed = SPK.used;
    SPK.cast = {}; SPK.used = {};
    var jobs = [];
    roleSegments(ROLE_TRY).forEach(function (s) {
      jobs.push({ t: s.t, v: s.role === 'say' ? castVoice(s.who) : CFG.localVoice });
    });
    SPK.cast = keepCast; SPK.used = keepUsed;
    toast(T('分角色试听：旁白 + {n} 句对白，声音各不相同', { n: Math.max(0, jobs.length - 1) }), 3400);
    var i = 0;
    (function next() {
      if (i >= jobs.length) return;
      var j = jobs[i++];
      withTimeout(localURL(j.t, j.v), 30000).then(function (u) {
        var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
        a.onended = a.onerror = function () { revokeURL(u); next(); };
        try { var q = a.play(); if (q && q.catch) q.catch(function () { revokeURL(u); }); }
        catch (e) { revokeURL(u); }
      }).catch(function (e) { toast(T('试听失败：') + e.message, 5200); });
    })();
  }
  function tryVoice() {
    if (SPK.playing) { stopSpeak(false); toast(T('已暂停书本朗读，开始试听')); }
    if (localReady()) {
      toast(T('正在试听免费离线音色：') + localVoiceName(CFG.localVoice) + ' …', 3200);
      withTimeout(localURL(TRY_TEXT), 30000).then(function (u) {
        var a = new Audio(); a.src = u; a.playbackRate = Number(CFG.rate) || 1;
        try {
          var q = a.play(); if (q && q.catch) q.catch(function () {});
          a.onended = a.onerror = function () { revokeURL(u); };
        } catch (e) { revokeURL(u); }
      }).catch(function (e) { toast(T('试听失败：') + e.message, 5600); });
      return;
    }
    if (!SYN || !UTT) { toast(T('当前浏览器不支持朗读，请用新版 Edge')); return; }
    var v = curVoice();
    try { SYN.cancel(); } catch (e) {}
    var u = new UTT(TRY_TEXT);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'zh-CN';
    u.rate = Number(CFG.rate); u.pitch = Number(CFG.pitch); u.volume = Number(CFG.volume);
    SPK.trying = true;
    toast(T('正在试听：{v}（不影响书本进度）', { v: v ? voiceLabel(v).split(' · ')[0] : T('默认语音') }), 3200);
    u.onend = u.onerror = function () { SPK.trying = false; };
    try { SYN.speak(u); } catch (e) { SPK.trying = false; toast(T('试听失败：') + e.message); }
  }
  function startSpeak(fromPi) {
    if ((!SYN || !UTT) && !localReady()) { toast(T('当前浏览器不支持朗读，请用新版 Edge / Chrome')); return; }
    if (!BK) return;
    autoStop(true);                     // 朗读和自动阅读会互相抢滚动，先停自动
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
      if (!SPK.paras.length) { toast(T('这几章都没有可朗读的文字')); return; }
    }
    setPara(fromPi === undefined ? currentPara() : fromPi);
    SPK.playing = true;
    try { SYN.cancel(); } catch (e) {}
    speakChunk(0); $('spPlay').textContent = '❚❚';
    if (!$('spVoice').options.length || $('spVoice').options[0].value === '') fillVoices();
    var cv = curVoice();
    if (SYN && !(SYN.getVoices() || []).length) toast(T('系统未检测到朗读语音；Windows 可在「设置→时间和语言→语音」添加中文语音'), 5200);
    else if (SYN && !localReady() && cv && !isNatural(cv)) toast(T('当前是机械语音；装一次免费语音包即可离线听接近真人的中文，详见「免费神经语音」'), 5600);
  }
  function toggleSpeak() {
    if (!SPK.on) { startSpeak(); return; }
    if (SPK.playing) {
      SPK.playing = false; clearTimeout(SPK.gapT);
      if (SPK.audio) { try { SPK.audio.pause(); } catch (e) {} }
      else { SPK.gen++; clearTimeout(SPK.watch); try { SYN.pause(); } catch (e) {} }
      $('spPlay').textContent = '▶'; $('spNow').textContent = T('已暂停');
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
      if (left <= 0) { clearInterval(SPK.timer); SPK.deadline = 0; $('spLeft').textContent = ''; stopSpeak(false); toast(T('朗读定时到，已停止')); return; }
      $('spLeft').textContent = T('剩 {n} 分', { n: Math.ceil(left / 60000) });
    }, 1000);
    $('spLeft').textContent = T('剩 {n} 分', { n: min });
  }

  /* ---------------- 弹层 / 文档 ---------------- */
  function showModal(title, body, buttons) {
    $('modalTitle').textContent = title;
    var mb = $('modalBody');
    mb.oninput = mb.onchange = mb.onclick = null;   // 防止多次打开时监听器叠加
    mb.innerHTML = body;
    var f = $('modalFoot'); f.innerHTML = '';
    (buttons || [{ label: T('关闭') }]).forEach(function (b) {
      var el = document.createElement('button');
      el.textContent = b.label; if (b.cls) el.className = b.cls;
      el.onclick = function () { if (b.fn) b.fn(); else closeModal(); };
      f.appendChild(el);
    });
    $('modal').classList.add('on');
  }
  function closeModal() { $('modal').classList.remove('on'); }
  function confirmModal(msg, yes) {
    showModal(T('请确认'), '<p>' + esc(msg) + '</p>', [
      { label: T('取消') },
      { label: T('确定'), cls: 'pri', fn: function () { closeModal(); yes(); } }
    ]);
  }
  var DOCS = {
    help: ['使用说明', '<h3>导入</h3><p>书架点「＋ 导入书籍」，可选多本 <code>.txt</code> / <code>.epub</code>。文件只保存在这台设备的浏览器数据库里，导入过程不上传、不联网。</p>' +
      '<h3>阅读</h3><ul><li>顶部「目录」跳章，「搜索」全文找词，「＋书签」记位置。</li><li>底部进度条可拖到全书任意章节；滚动模式下 ← → 键翻章，空格向下翻一屏。</li><li>快捷方式：← / → 翻章（翻页模式下是翻页），空格 下翻一屏（朗读中则暂停 / 继续），Ctrl + F 搜索，Esc 退回书架或关掉弹窗。</li><li>「排版」一处调完：阅读方式（滚动 / 翻页）、分栏、翻页动画、字号、行距、段间距、字间距、首行缩进、字体、对齐、版心宽度、页边距、六套主题与自定义底色字色、亮度、自动阅读速度。</li><li>「主题」按顺序切六套配色；「自动」开关自动阅读；「全屏」进入沉浸模式。</li><li>阅读位置自动保存，下次打开接着读；翻页模式还会记住翻到第几页。</li></ul>' +
      '<h3>划线、批注与分享</h3>' +
      '<p>在正文里选中任意一句，会浮出一个小工具条：四色高亮、写笔记、复制、生成分享图。高亮和批注随书保存，右侧「笔记」页会按章节列出全部批注，点一条就能跳回去；在那里还能按「仅看有笔记的」筛选、改色、编辑或删除，并一键<b>导出成 Markdown</b> 或打开<b>阅读总结</b>（累计时长、进度、批注数、逐章摘录，可复制或导出）。</p>' +
      '<h3>书架与收藏</h3>' +
      '<p>书架上方一排标签是书架本身：「全部书籍」「★ 收藏」和你自建的书架。点「管理书架」可新建、重命名或解散书架（解散不会删书，书回到「未分组」）。每本书封面右上角的 ☆ 是收藏、⋯ 是菜单（改书名作者、移动书架、批量管理、移除）。批量管理可一次移动或移除多本。</p>' +
      '<p>「导入文件夹」会把整个目录里的 TXT / EPUB 一次收进来，重复文件自动跳过。</p>' +
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
      '<h3>手机上按钮挤？</h3><p>按钮会按屏幕宽度自动换成多行网格，不用手动切。手机上的正文一律单栏，横屏也不会硬分两栏。</p>' +
      '<h3>怎么弄成两栏？</h3><p>点阅读器顶栏的「排版」→「阅读方式」：切到「翻页」，分栏选「自动分栏」在宽屏上就是左右两栏，选「双栏」可以强制（窗口够宽时）；窗口太窄或手机上会自动退回单栏，不会把字挤成一条。<br>顺带一提，翻页模式翻的是整屏而不是滚动：点屏幕左右两侧、滚轮、空格或 ← → 都能翻，手机可以左右滑。</p>' +
      '<h3>自动阅读怎么用？</h3><p>点顶栏「自动」，滚动模式下会匀速往下滚，翻页模式下按你设的秒数自动翻页；再点一次暂停，暂停时会留一个胶囊提示，可以继续或退出。到本章末尾会自动接下一章。朗读和自动阅读不会同时抢滚动。</p>' +
      '<h3>想看得更沉浸？</h3><p>点「全屏」，或用全屏快捷键：上下工具栏会收起，鼠标移到屏幕上边或下边再唤出来。想更暗一点，在「排版 → 配色 → 亮度」往下拉，正文会压暗一层夜里不刺眼。</p>' +
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
      '<h3>1.9 新加了什么</h3><ul>' +
      '<li><b>分栏可选 1~4 栏</b>：大屏不再只有两栏。排版面板里「分栏」现在有「自动 / 1 / 2 / 3 / 4」，自动按屏宽定（最多 3 栏），也可以自己指定；每栏不少于 300px，放不下会自动降档，手机上永远单栏。选 2 栏以上会自动切到翻页。</li>' +
      '<li><b>主题按钮改成弹面板</b>：以前按一下换一档，得来回点好几次；现在点「主题」直接列出六套配色，每张卡片就是那套主题的底色和字色，选好即生效，面板不关，可以一张张比。</li>' +
      '<li><b>「设置」常驻顶栏</b>：阅读界面的按钮组最后多了「设置」，任何时候都能打开完整设置；手机上按钮排成两行，不会被挤掉。</li>' +
      '<li><b>阅读时钟</b>：顶栏显示当前时间与本次已读时长，读满 30 分钟转黄、60 分钟转红；沉浸模式下右上角留一个淡时钟。点一下可以开关、也可以重新计时。</li>' +
      '<li><b>休息提醒</b>：连续读满设定时长（默认 45 分钟，可设 30 / 45 / 60 / 90 或关闭）会浮出一条提示，选「休息一下」重新计时，或「稍后再提」十分钟后再来。时长只算真正在读的时间，回书架、切走窗口都会停表。</li>' +
      '<li><b>翻页不再出「半列」</b>：一屏的步长改成按实测列距计算，浏览器万一多排了半列也会被立刻纠正。</li></ul>' +
      '<h3>1.8 新加了什么：把版式做到能和成熟阅读软件掰手腕</h3><ul>' +
      '<li><b>翻页阅读</b>：除了一直有的滚动，新增整屏翻页。宽屏 / 平板自动左右<b>双栏</b>，手机<b>单栏</b>；点屏幕左右两侧、滚轮、空格、← → 、手机上左右滑都能翻，翻页动画可选滑动 / 淡入 / 无。</li>' +
      '<li><b>排版面板</b>：顶栏「排版」一处集中管理——字号（A− / A+ / 滑块）、行距、段间距、字间距、首行缩进、五种字体（宋体 / 黑体 / 楷体 / 仿宋 / 等宽）、两端或左对齐、版心宽度与左右页边距，底部一键恢复默认。</li>' +
      '<li><b>六套主题</b>：夜间、明亮、羊皮纸，新增<b>护眼绿、雾蓝、纯黑</b>；还能自己挑底色与字色，选完不合适当场清空回主题。夜间另有一层「亮度」压暗，黑灯下不刺眼。</li>' +
      '<li><b>自动阅读</b>：滚动模式匀速下滚，翻页模式按秒自动翻页；一键暂停 / 继续，暂停时留个小胶囊，到章末自动接下一章。</li>' +
      '<li><b>沉浸全屏</b>：一键收起上下工具栏，鼠标移到屏幕上缘或下缘再唤出；F11 或顶栏「全屏」都行，Esc 依次退出工具栏 / 自动阅读 / 全屏。</li>' +
      '<li><b>顺带修掉的老毛病</b>：书里自带的 <code>body{margin:5%}</code> 之类的样式会窜进正文、把版心挤歪（双栏因此右栏被切），现在书只能管自己段落里的样式，版心与字号一律听你的；正文里那行和顶栏重复的章节标题也去掉了。</li></ul>' +
      '<h3>1.8.1 修了什么</h3><ul>' +
      '<li><b>「双栏」现在一点就生效</b>：以前得先切到「翻页」再选双栏，在滚动模式下点双栏毫无反应（看着像坏了）。现在点「双栏」会自动切到翻页并排成两列，切回滚动则自动回到单栏，两个方向都会给一句提示。TXT 和 EPUB 一样。</li>' +
      '<li><b>切换阅读方式不丢位置</b>：滚动翻到一半再切翻页（或反过来），会停在你正看的那一段，不再跳回章首。</li>' +
      '<li><b>每页底部留白加宽</b>：翻页时最后一行不再紧贴底部工具栏。</li></ul>' +
      '<h3>1.7 新加了什么</h3><ul>' +
      '<li><b>全窗口中英双语</b>：书架顶栏一个开关，界面、设置、弹窗、提示与全部说明文档在中文 / 英文之间切换，选择会被记住。</li>' +
      '<li><b>划线高亮与批注</b>：选中正文四色高亮、随手写笔记；「笔记」页按章节汇总，可跳转、改色、编辑、删除。</li>' +
      '<li><b>导出与分享</b>：笔记一键导出 Markdown；划线可生成带书名与署名的分享图（PNG），也能只复制文字。</li>' +
      '<li><b>阅读总结</b>：本书累计时长、进度、批注数、书签数与逐章摘录一页看完，可复制或导出成笔记。</li>' +
      '<li><b>真正的书架</b>：自建书架、收藏、批量移动 / 移除、改书名作者、整目录导入。</li>' +
      '<li><b>阅读计时</b>：每次阅读自动记时长，按书与总计累计，全部留在本机。</li></ul>' +
      '<p class="kv">1.6 起还包含：174 个离线声线全放开、分角色朗读、朗读条直接换声线、书架续听、进程内语音引擎、完整 MIT 许可与署名。</p>' +
      '<h3>1.7.1 修了什么</h3><ul>' +
      '<li><b>桌面版终于能划线了</b>：桌面外壳默认把网页的文字选择关掉了，导致选中正文没反应、浮动色块也不出来。已放开，Windows 版的划线与批注和其他版本一样。</li>' +
      '<li><b>导入文件夹不再像在上传</b>：桌面版改用系统的「选择文件夹」对话框，不再是浏览器那个「选择要上传的文件夹 … 上传」的选择器。</li>' +
      '<li><b>左侧导航能退出了</b>：标签栏右侧加了 ×，再点同一个按钮也能收起，点正文空白处自动收起（有选区时不收，免得把手选的位置抖掉）。</li></ul>' +
      '<p class="kv">版本 1.9.0 · 单文件 · 默认零联网 · 数据仅存本机<br>作者 / 版权 © 2026 永远的兰兰（Lanlan Eternal）<br>问题反馈与源码：随发行包附带的 README 里有仓库地址</p>']
  };
  function showDoc(k) {
    var d = DOCS[k] || DOCS.help;
    var body = (CFG.lang === 'en' && window.MYDOCS_EN && window.MYDOCS_EN[k]) || d[1];
    var nav = '<div class="docnav">' + Object.keys(DOCS).map(function (x) {
      return '<button data-doc="' + x + '"' + (x === k ? ' class="on"' : '') + '>' + esc(T(DOCS[x][0])) + '</button>';
    }).join('') + '</div>';
    showModal(T(d[0]), nav + body, [{ label: T('关闭') }]);
  }
  function showSettings() {
    localProbe();
    var seg = function (key, opts) {
      return '<div class="seg">' + opts.map(function (x) {
        return '<button data-set="' + key + '" data-v="' + x[0] + '"' +
          (String(CFG[key]) === String(x[0]) ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    };
    var boolSeg = function (opts) {
      return '<div class="seg">' + opts.map(function (x) {
        return '<button data-set="bool" data-v="' + x[0] + '"' + (CFG[x[0]] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    };
    var encOpts = [['auto', T('自动识别')], ['utf-8', 'UTF-8'], ['gb18030', 'GB18030 / GBK'], ['big5', T('Big5 繁体')], ['utf-16le', 'UTF-16LE']];
    var h = '<h3>' + T('界面语言') + '</h3><div class="row"><label>' + T('界面语言') + '</label><div class="seg">' +
      [['zh', '中文'], ['en', 'English']].map(function (x) {
        return '<button data-lang="' + x[0] + '"' + (CFG.lang === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div><span class="kv">v' + VER + '</span></div>' +
      '<h3>' + T('外观与版式') + '</h3>' +
      '<div class="row"><label>' + T('主题') + '</label>' + seg('theme', THEMES.map(function (k) { return [k, T(THEME_NAME[k])]; })) + '</div>' +
      '<div class="row"><label>' + T('排版') + '</label><button data-act="type">' + T('打开排版面板') + '</button>' +
      '<span class="kv">' + T('字号 / 行距 / 段距 / 分栏 / 翻页 / 配色 / 自动阅读 / 快捷键') + '</span></div>' +
      '<h3>' + T('朗读') + '</h3>' +
      '<div class="row"><label>' + T('默认语速') + '</label><input type="range" data-set="rate" min="0.5" max="2" step="0.1" value="' + CFG.rate + '"><span id="cfgRate">' + Number(CFG.rate).toFixed(1) + '×</span></div>' +
      '<div class="row"><label>' + T('句间停顿') + '</label><input type="range" data-set="pause" min="0" max="600" step="20" value="' + CFG.pause + '"><span id="cfgPause">' + CFG.pause + 'ms</span></div>' +
      '<div class="row"><label>' + T('选项') + '</label>' + boolSeg([
        ['autoNext', T('念完自动下一章')], ['follow', T('高亮跟随滚动')], ['whole', T('整句朗读（更自然）')],
        ['voiceAuto', T('优先自然语音')], ['motion', T('减少动效')]]) + '</div>' +
      '<div class="row"><label>' + T('语音') + '</label><button data-doc="voice">' + T('语音与朗读说明') + '</button><span class="kv">' + T('当前：') +
      esc(voiceLabel(curVoice() || { name: T('系统默认'), lang: 'zh-CN', localService: true })) + '</span></div>' +
      '<h3>' + T('免费神经语音 · 离线开源') + '</h3>' +
      '<p class="kv">' + T('本机跑 sherpa-onnx + 开源中文模型（AISHELL3 多说话人 VITS）：接近真人的中文语调，不收费、不联网、不用账号、不用 Key。语音库已随成品装好，听书前双击「VoicePack/启动语音引擎.cmd」即可。') + '</p>' +
      '<div class="row"><label>' + T('引擎状态') + '</label><div class="seg">' +
      '<span class="kv" style="align-self:center">' + (localReady() ? T('● 已连接（免费神经语音）') : T('○ 未检测到（当前用系统语音）')) + '</span>' +
      '<button data-act="probe">' + T('重新检测') + '</button>' +
      '<button data-set="bool" data-v="localOn"' + (CFG.localOn ? ' class="on"' : '') + '>' + (CFG.localOn ? T('自动连接：开') : T('自动连接：关')) + '</button>' +
      '<button data-doc="local">' + T('安装与使用说明') + '</button></div></div>' +
      '<div class="row"><label>' + T('音色') + '</label><select data-set="localVoice">' + localVoiceOptions() +
      '</select><button data-act="tryvoice">' + T('试听音色') + '</button></div>' +
      '<div class="row"><label>' + T('声线范围') + '</label>' + seg('voiceSet', [['curated', T('精选 {n} 个', { n: voiceStat().curated })], ['all', T('全部 {n} 个', { n: voiceStat().total })]]) + '</div>' +
      '<p class="kv">' + T('模型里一共 {n} 个中文说话人（{f} 女 + {m} 男），全部共用同一份模型，放开多少个都不增加体积。「精选」是人工挑过、命名过的 {c} 个；「全部」按音高分 7 档列出，男低 → 女高任你挑。朗读条最左边的下拉里直接就能换，正在朗读时会从当前这段用新音色重念；也可以在这里选好再点「试听音色」对比。缺模型文件的音色会自动隐藏。',
        { n: voiceStat().total, f: voiceStat().female, m: voiceStat().male, c: voiceStat().curated }) + '</p>' +
      '<div class="row"><label>' + T('分角色朗读') + '</label><div class="seg">' +
      '<button data-set="bool" data-v="roleOn"' + (CFG.roleOn ? ' class="on"' : '') + '>' + (CFG.roleOn ? T('分角色：开') : T('分角色：关')) + '</button>' +
      [['mix', T('男女混合')], ['female', T('全女声')], ['male', T('全男声')]].map(function (x) {
        return '<button data-set="rolePool" data-v="' + x[0] + '"' + (CFG.rolePool === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '<button data-act="tryrole">' + T('试听效果') + '</button></div></div>' +
      '<p class="kv">' + T('开启后，旁白用你选的声线，引号里的对白按人物自动换声——「张三说」和「李四道」是两个不同的声音，同一个人物整本书都是同一个声音。认不出人名时按出场顺序轮换，不会和旁白混成一个声音。只在「免费神经语音」下生效；系统语音不支持分角色。') + '</p>' +
      '<div class="row"><label>' + T('端口') + '</label><input type="number" data-set="localPort" min="1024" max="65535" step="1" value="' + (Number(CFG.localPort) || 8177) + '" style="width:96px"><span class="kv">' + T('默认 8177，需与启动器一致') + '</span></div>' +
      '<p class="kv">' + T('朗读文字只发给本机的 127.0.0.1 合成，不产生对外网络请求；引擎没启动时自动用系统语音，不影响看书。') + '</p>' +
      '<h3>' + T('文件与界面') + '</h3><div class="row"><label>' + T('TXT 编码') + '</label><select data-set="txtEnc">' +
      encOpts.map(function (x) { return '<option value="' + x[0] + '"' + (CFG.txtEnc === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') +
      '</select><span class="kv">' + T('改完重新打开书生效') + '</span></div>' +
      '<div class="row"><label>' + T('分栏') + '</label>' + seg('lay', [['auto', T('自动')], ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4']]) +
      '<span class="kv">' + T('自动按屏宽定，也可手动 1~4 栏（手机始终单栏）') + '</span></div>' +
      '<div class="row"><label>' + T('阅读模式') + '</label>' + seg('mode', [['scroll', T('滚动')], ['page', T('翻页')]]) + '</div>' +
      '<p class="kv">' + T('设置即时生效并保存在本机。') + '</p>';
    showModal(T('阅读设置'), h, [{ label: T('恢复默认'), fn: function () { Object.assign(CFG, DEF); saveCfg(); applyCfg(); fillVoices(); showSettings(); toast(T('已恢复默认')); } }, { label: T('完成'), cls: 'pri' }]);
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
      if (k === 'txtEnc') { CFG.txtEnc = e.target.value; saveCfg(); toast(T('TXT 编码已设为 ') + e.target.value + T('，重新打开书生效')); }
      else if (k === 'localVoice') {
        CFG.localVoice = e.target.value; saveCfg(); resetCast(); voiceBadge(curVoice());
        if (SPK.playing) speakJump(0);
        toast(T('已切换到 ') + localVoiceName(CFG.localVoice) + T('，点「试听音色」听听看'), 3000);
      }
    };
    $('modalBody').onclick = function (e) {
      var lang = e.target.closest('[data-lang]');
      if (lang) { setLang(lang.getAttribute('data-lang')); showSettings(); return; }
      var b = e.target.closest('button[data-set],button[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'type') { showType(); return; }
      if (act === 'tryvoice') { tryVoice(); return; }
      if (act === 'tryrole') { tryRole(); return; }
      if (act === 'probe') { LOCAL.miss = 0; localProbe(true).then(function () { showSettings(); }); return; }
      var k = b.getAttribute('data-set'), v = b.getAttribute('data-v');
      if (k === 'bool') CFG[v] = CFG[v] ? 0 : 1; else CFG[k] = v;
      /* 多栏与翻页联动，两个入口（设置 / 排版面板）行为保持一致 */
      if (k === 'lay' && (LAYN[v] || 0) > 1) CFG.mode = 'page';
      if (k === 'mode' && v === 'scroll' && (LAYN[CFG.lay] || 0) > 1) CFG.lay = 'auto';
      if (k === 'mode') PG.ready = 0;
      saveCfg(); applyCfg();
      if (v === 'voiceAuto' && CFG.voiceAuto) fillVoices();
      if (v === 'localOn') { LOCAL.ready = false; if (CFG.localOn) localProbe(); voiceBadge(curVoice()); }
      if (v === 'voiceSet') fillVoices();
      if (v === 'voiceSet' || v === 'roleOn' || k === 'rolePool') { if (SPK.playing) speakJump(0); }
      showSettings();
    };
  }
  /* ---------------- 排版面板（1.8） ---------------- */
  var TYPE_KEYS = ['theme', 'mode', 'lay', 'pageAnim', 'fs', 'lh', 'ps', 'ls', 'indent', 'padw', 'pagew', 'ff', 'align', 'dim', 'customBg', 'customTx', 'autoScrollSpeed', 'autoPageSec', 'showClock', 'restMin'];
  var TYPE_NUM = { fs: 'int', pagew: 'int', padw: 'int', autoScrollSpeed: 'int', autoPageSec: 'int', lh: 'float', ps: 'float', ls: 'float', dim: 'float' };
  var TH_SW = { dark: '#1F2125', light: '#FFFFFF', sepia: '#FAF3E3', green: '#F3F8EC', gray: '#252D37', black: '#000000' };
  function hex6(v, alt) { v = String(v || '').trim(); return /^#[0-9a-fA-F]{6}$/.test(v) ? v : alt; }
  function curVar(n) { return (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim(); }
  function typeLabels() {
    var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };
    set('fFs', Number(CFG.fs) + 'px');
    set('fLh', Number(CFG.lh).toFixed(2));
    set('fPs', Number(CFG.ps).toFixed(2) + 'em');
    set('fLs', Number(CFG.ls).toFixed(2) + 'em');
    set('fPw', Number(CFG.pagew) + 'px');
    set('fPd', Number(CFG.padw) + 'px');
    set('fDim', Math.round(Number(CFG.dim) * 100) + '%');
    set('fAs', String(Number(CFG.autoScrollSpeed)));
    set('fAp', T('{n} 秒/页', { n: Math.round(Number(CFG.autoPageSec)) }));
    set('fAsHint', T('约 {n} 秒一屏', { n: Math.round((($('pageWrap') || {}).clientHeight || 600) / autoSpeedPx()) }));
  }
  function showType(keep) {
    var st = keep && $('modalBody') ? $('modalBody').scrollTop : 0;
    var seg = function (key, opts) {
      return '<div class="seg">' + opts.map(function (x) {
        return '<button data-set="' + key + '" data-v="' + x[0] + '"' +
          (String(CFG[key]) === String(x[0]) ? ' class="on"' : '') + '>' + x[1] + '</button>';
      }).join('') + '</div>';
    };
    var cell = function (lb, inner) { return '<div class="cell"><span class="lb">' + T(lb) + '</span>' + inner + '</div>'; };
    var rng = function (key, min, max, step, style) {
      return '<input type="range" data-set="' + key + '" min="' + min + '" max="' + max + '" step="' + step +
        '" value="' + CFG[key] + '"' + (style ? ' style="' + style + '"' : '') + '>';
    };
    var th = '<div class="sw-grid">' + THEMES.map(function (k) {
      return '<button class="th' + (CFG.theme === k ? ' on' : '') + '" data-th="' + k + '">' +
        '<span class="sw" style="background:' + TH_SW[k] + '"></span>' + esc(T(THEME_NAME[k])) + '</button>';
    }).join('') + '</div>';
    var cbg = hex6(CFG.customBg, hex6(curVar('--paper'), '#1F2125'));
    var ctx = hex6(CFG.customTx, hex6(curVar('--paperTx'), '#E6E4E1'));
    var h = '';
    h += '<h3>' + T('阅读方式') + '</h3><div class="tpGrid">' +
      cell('模式', seg('mode', [['scroll', T('滚动')], ['page', T('翻页')]])) +
      cell('分栏', seg('lay', [['auto', T('自动')], ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4']])) +
      cell('翻页动画', seg('pageAnim', [['slide', T('滑动')], ['fade', T('淡入')], ['none', T('无')]])) +
      '</div><p class="kv">' + T('「翻页」是一页一页左右翻。多栏靠翻页成立：自动按屏宽定，也可手动选 1~4 栏（手机始终单栏）；点 2 栏以上会自动切到翻页。') + '</p>';
    h += '<h3>' + T('文字') + '</h3>' +
      '<div class="row"><label>' + T('字号') + '</label><button data-font="fs-">A−</button><span id="fFs">' + CFG.fs + 'px</span><button data-font="fs+">A＋</button>' +
      rng('fs', 13, 34, 1, 'flex:1;min-width:110px') + '</div>' +
      '<div class="row"><label>' + T('行距') + '</label>' + rng('lh', 1.2, 2.6, 0.05, 'flex:1') + '<span id="fLh">' + CFG.lh + '</span></div>' +
      '<div class="row"><label>' + T('段间距') + '</label>' + rng('ps', 0, 2, 0.05, 'flex:1') + '<span id="fPs">' + CFG.ps + '</span></div>' +
      '<div class="row"><label>' + T('字间距') + '</label>' + rng('ls', -0.02, 0.16, 0.01, 'flex:1') + '<span id="fLs">' + CFG.ls + '</span></div>' +
      '<div class="row"><label>' + T('首行缩进') + '</label>' + seg('indent', [[0, T('无缩进')], [2, T('缩进 2 字')]]) + '</div>' +
      '<div class="row"><label>' + T('字体') + '</label>' + seg('ff', [['serif', T('宋体')], ['sans', T('黑体')], ['kai', T('楷体')], ['fang', T('仿宋')], ['mono', T('等宽')]]) + '</div>' +
      '<div class="row"><label>' + T('对齐') + '</label>' + seg('align', [['justify', T('两端')], ['left', T('左对齐')]]) + '</div>';
    h += '<h3>' + T('版心') + '</h3>' +
      '<div class="row"><label>' + T('页宽') + '</label>' + rng('pagew', 380, 1100, 20, 'flex:1') + '<span id="fPw">' + CFG.pagew + 'px</span></div>' +
      '<div class="row"><label>' + T('页边距') + '</label>' + rng('padw', 10, 96, 2, 'flex:1') + '<span id="fPd">' + CFG.padw + 'px</span></div>';
    h += '<h3>' + T('配色') + '</h3>' + th +
      '<div class="row clrRow"><label>' + T('自定义颜色') + '</label>' +
      '<span class="kv">' + T('底色') + '</span><input type="color" data-set="customBg" value="' + cbg + '">' +
      '<span class="kv">' + T('字色') + '</span><input type="color" data-set="customTx" value="' + ctx + '">' +
      '<button data-act="clr">' + T('清空') + '</button><span class="kv">' + T('清空后跟随主题') + '</span></div>' +
      '<div class="row"><label>' + T('亮度') + '</label>' + rng('dim', 0, 0.55, 0.05, 'flex:1') + '<span id="fDim">0%</span></div>';
    h += '<h3>' + T('自动阅读') + '</h3>' +
      '<div class="row"><label>' + T('滚动速度') + '</label>' + rng('autoScrollSpeed', 1, 10, 1, 'flex:1') + '<span id="fAs">3</span><span class="kv" id="fAsHint"></span></div>' +
      '<div class="row"><label>' + T('翻页停留') + '</label>' + rng('autoPageSec', 4, 60, 2, 'flex:1') + '<span id="fAp">20s</span></div>' +
      '<div class="row"><label>' + T('开始 / 停止') + '</label><button data-act="auto">' + T('自动阅读：开 / 关') + '</button>' +
      '<span class="kv">' + T('空格也能暂停 / 继续；翻页模式下用停留秒数，滚动模式下用滚动速度') + '</span></div>';
    h += '<h3>' + T('阅读时钟') + '</h3>' +
      '<div class="row"><label>' + T('顶栏时钟') + '</label>' + seg('showClock', [[1, T('显示')], [0, T('隐藏')]]) +
      '<span class="kv">' + T('显示当前时间与本次已读时长，点顶栏那个时间块也能改') + '</span></div>' +
      '<div class="row"><label>' + T('休息提醒') + '</label>' + seg('restMin',
        [[0, T('关闭')], [30, '30'], [45, '45'], [60, '60'], [90, '90']]) +
      '<span class="kv">' + T('连续读到设定时长提醒休息，可稍后再提') + '</span></div>';
    h += '<h3>' + T('快捷键') + '</h3><p class="kv kbdline">' +
      '<span class="kbd">←</span> <span class="kbd">→</span> ' + T('翻页 / 翻屏') + ' · ' +
      '<span class="kbd">空格</span> ' + T('下一屏（朗读中为暂停）') + ' · ' +
      '<span class="kbd">F11</span> ' + T('全屏') + ' · ' +
      '<span class="kbd">Esc</span> ' + T('退出全屏 / 关闭侧栏') + ' · ' +
      '<span class="kbd">T</span> ' + T('换主题') + ' · ' +
      '<span class="kbd">A</span> ' + T('自动阅读') + ' · ' +
      '<span class="kbd">Ctrl</span>+<span class="kbd">+</span>/<span class="kbd">−</span> ' + T('字号') + '</p>';
    h += '<p class="kv">' + T('点选即时生效，自动保存。') + '</p>';
    showModal(T('排版与外观'), h, [
      { label: T('恢复默认'), fn: function () {
        TYPE_KEYS.forEach(function (k) { CFG[k] = DEF[k]; });
        saveCfg(); PG.ready = 0; applyCfg(); showType(true); toast(T('排版已恢复默认'));
      } },
      { label: T('完成'), cls: 'pri' }]);
    var mb = $('modalBody');
    mb.oninput = function (e) {
      var el = e.target, k = el.getAttribute('data-set'); if (!k) return;
      var v = el.value;
      if (TYPE_NUM[k] === 'int') v = parseInt(v, 10) || 0;
      else if (TYPE_NUM[k] === 'float') v = parseFloat(v) || 0;
      CFG[k] = v; saveCfg(); applyCfg(); typeLabels();
    };
    mb.onclick = function (e) {
      var thb = e.target.closest('[data-th]');
      if (thb) { setTheme(thb.getAttribute('data-th')); showType(true); return; }
      var f = e.target.closest('[data-font]');
      if (f) {
        var d = f.getAttribute('data-font') === 'fs+' ? 1 : -1;
        CFG.fs = Math.max(13, Math.min(34, Number(CFG.fs) + d));
        saveCfg(); applyCfg(); showType(true); return;
      }
      var act = e.target.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'clr') { CFG.customBg = ''; CFG.customTx = ''; saveCfg(); applyCfg(); showType(true); return; }
        if (a === 'auto') { closeModal(); autoToggle(); return; }
        return;
      }
      var b = e.target.closest('button[data-set]'); if (!b) return;
      var k2 = b.getAttribute('data-set'), v2 = b.getAttribute('data-v');
      var tip = '';
      if (k2 === 'lay' && (LAYN[v2] || 0) > 1 && CFG.mode !== 'page') {
        /* 多栏要配合翻页才有意义，点了就直接带过去，别让人以为没反应 */
        CFG.mode = 'page'; tip = T('多栏需配合翻页，已切到翻页模式');
      } else if (k2 === 'mode' && v2 === 'scroll' && (LAYN[CFG.lay] || 0) > 1) {
        CFG.lay = 'auto'; tip = T('滚动模式只有单栏，多栏请留在翻页');
      }
      CFG[k2] = v2;
      saveCfg(); applyCfg(); showType(true);
      if (tip) toast(tip, 2400);
    };
    if (st) mb.scrollTop = st;
    typeLabels();
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
    toast(T('备份已导出') + (withFiles ? T('（含 {n} 本书文件）', { n: Object.keys(data.blobs).length }) : T('（仅进度与设置）')));
  }
  function askExport() {
    showModal(T('导出备份'), '<p>' + T('把进度、书签、设置导出成一个 JSON 文件。') + '</p>' +
      '<p><label><input type="checkbox" id="bakFull"> ' + T('同时包含书籍原文件（体积较大，可在新设备直接还原整架书）') + '</label></p>' +
      '<p class="kv">' + T('不勾选则只导出元数据，换设备后需要重新导入 TXT / EPUB 原文件。') + '</p>',
      [{ label: T('取消') }, { label: T('导出'), cls: 'pri', fn: function () { var f = $('bakFull') && $('bakFull').checked; closeModal(); exportBak(!!f); } }]);
  }
  async function importBak(file) {
    try {
      var d = JSON.parse(await file.text());
      if (d.app !== 'MoYinReader' || !Array.isArray(d.books)) throw new Error(T('不是墨吟的备份文件'));
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
      toast(T('已还原 {n} 条记录', { n: added }) + (keys.length ? T('、{n} 本书文件', { n: keys.length }) : T('（未含书文件，请重新导入原书）')), 4200);
    } catch (e) { showModal(T('导入失败'), '<p>' + esc(e.message) + '</p>', [{ label: T('关闭') }]); }
  }

  /* ---------------- 事件 ---------------- */
  function bind() {
    $('btnImport').onclick = function () { $('fileInput').click(); };
    $('fileInput').onchange = function (e) { if (e.target.files.length) importFiles(Array.prototype.slice.call(e.target.files)); e.target.value = ''; };
    $('btnImportDir').onclick = importFolder;
    $('dirInput').onchange = function (e) {
      var fs = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (fs.length) importFiles(fs);
    };
    $('btnLang').onclick = function () { setLang(CFG.lang === 'en' ? 'zh' : 'en'); };
    $('btnShelves').onclick = showShelves;
    $('btnNotes').onclick = function () { openSide('note'); };
    $('shelfBar').onclick = function (e) {
      var b = e.target.closest('[data-sv]'); if (!b) return;
      var v = b.getAttribute('data-sv');
      if (v === '__new') { showShelves(); return; }
      CFG.shelfView = v; saveCfg(); renderShelf();
    };
    $('selExit').onclick = exitSel;
    $('selAll').onclick = function () {
      var list = shelfList(), all = list.length && list.every(function (b) { return SELS[b.id]; });
      list.forEach(function (b) { SELS[b.id] = !all; });
      renderShelf();
    };
    $('selMove').onclick = askBatchMove;
    $('selFav').onclick = batchFav;
    $('selDel').onclick = batchDel;
    $('libSearch').oninput = renderShelf;
    $('btnSort').onclick = function () {
      var a = ['last', 'name', 'added', 'progress'];
      CFG.sort = a[(a.indexOf(CFG.sort) + 1) % a.length]; saveCfg(); renderShelf();
      toast(T('排序：' + ({ last: '最近阅读', name: '书名', added: '加入时间', progress: '阅读进度' })[CFG.sort]));
    };
    $('btnLayout').onclick = function () { showType(); };
    $('btnCfg').onclick = showSettings;
    $('btnTheme').onclick = function () { showTheme(); };
    $('btnExport').onclick = askExport;
    $('btnImportBak').onclick = function () { $('bakInput').click(); };
    $('bakInput').onchange = function (e) { if (e.target.files[0]) importBak(e.target.files[0]); e.target.value = ''; };
    $('shelf').onclick = function (e) {
      var fav = e.target.closest('[data-fav]');
      if (fav) { toggleFav(fav.getAttribute('data-fav')); return; }
      var more = e.target.closest('[data-more]');
      if (more) { openBookMenu(more.getAttribute('data-more')); return; }
      var li = e.target.closest('[data-listen]');
      if (li) { resumeListen(li.getAttribute('data-listen')); return; }
      var card = e.target.closest('.bk');
      if (card) {
        var id = card.getAttribute('data-id');
        if (document.body.classList.contains('selmode')) { toggleSel(id); return; }
        openBook(id);
      }
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
    $('btnType').onclick = function () { showType(); };
    $('btnAuto').onclick = function () { autoToggle(); };
    $('btnFull').onclick = toggleFull;
    $('btnSet').onclick = function () { showSettings(); };
    $('clock').onclick = function () { showClockPanel(); };
    $('restTipOk').onclick = restTake;
    $('restTipSnooze').onclick = restSnooze;
    $('autoPillGo').onclick = function () { autoResume(); };
    $('autoPillX').onclick = function () { autoStop(); };
    document.addEventListener('fullscreenchange', function () { syncFullBtn(); if (BK && pgEnabled()) setTimeout(pgReflow, 120); });
    document.addEventListener('webkitfullscreenchange', function () { syncFullBtn(); });
    $('btnSpeak').onclick = function () {
      if (!SPK.on || !$('speakBar').classList.contains('on')) startSpeak(currentPara());
      else toggleSpeak();
    };
    $('side').querySelectorAll('.tabs button[data-tab]').forEach(function (b) {
      b.onclick = function () { openSide(b.getAttribute('data-tab')); };
    });
    $('sideClose').onclick = closeSide;
    $('sideBody').onclick = function (e) {
      var dm = e.target.closest('[data-delmark]');
      if (dm) {
        var ts = Number(dm.getAttribute('data-delmark'));
        BK.meta.marks = (BK.meta.marks || []).filter(function (m) { return m.ts !== ts; });
        savePos(); renderSide(); return;
      }
      if (e.target.closest('#sideAddMark')) { addMark(); return; }
      var nf = e.target.closest('[data-nf]');
      if (nf) { CFG.noteFilter = nf.getAttribute('data-nf'); saveCfg(); renderSide(); return; }
      if (e.target.closest('#noteExp')) { exportNotes(); return; }
      if (e.target.closest('#noteSum')) { showSummary(); return; }
      var he = e.target.closest('[data-hledit]');
      if (he) { noteEditor(hlById(he.getAttribute('data-hledit'))); return; }
      var hs = e.target.closest('[data-hlshare]');
      if (hs) { shareHighlight(hlById(hs.getAttribute('data-hlshare'))); return; }
      var hd = e.target.closest('[data-hldel]');
      if (hd) { removeHighlight(hd.getAttribute('data-hldel')); return; }
      var hg = e.target.closest('[data-hlgo]');
      if (hg) { gotoHighlight(hlById(hg.getAttribute('data-hlgo'))); return; }
      var m = e.target.closest('[data-mark]');
      if (m) {
        var mk = BK.meta.marks.slice().sort(function (a, c) { return c.ts - a.ts; })[Number(m.getAttribute('data-mark'))];
        if (mk) { renderChapter(mk.ch, { silent: true }); setTimeout(function () { var p = SPK.paras[mk.p]; if (p) revealPara(p); }, 90); }
        return;
      }
      var t = e.target.closest('[data-ch]');
      if (t) { renderChapter(Number(t.getAttribute('data-ch')), { anchor: t.getAttribute('data-anchor') }); }
    };
    $('page').onclick = function (e) {
      var nx = e.target.closest('[data-act="next"]'); if (nx) { nextCh(1); return; }
      var mk = e.target.closest('mark[data-hlid]');
      if (mk) { hideSelTools(); hlMenu(mk.getAttribute('data-hlid')); return; }
      var a = e.target.closest('a[data-ch]');
      if (a) { e.preventDefault(); renderChapter(Number(a.getAttribute('data-ch')), { anchor: a.getAttribute('data-anchor') }); return; }
      var p = e.target.closest('.rdp');
      if (p && SPK.on) {
        var i = SPK.paras.indexOf(p);
        if (i >= 0) { SPK.gen++; clearTimeout(SPK.watch); clearTimeout(SPK.gapT); stopLocalAudio(); SPK.prefetch = null; try { SYN.cancel(); } catch (er) {} setPara(i); highlight(); if (SPK.playing) speakChunk(0); }
      }
    };
    /* 选中文字 → 浮动工具条（桌面上 mouseup，触屏上 touchend） */
    $('page').addEventListener('mouseup', onSelUp);
    $('page').addEventListener('touchend', function () { setTimeout(onSelUp, 60); });
    /* 点正文：先收侧栏；翻页模式下左右两侧点一下翻页（有选区时不动） */
    $('pageWrap').addEventListener('click', function (e) {
      if (e.target.closest('#selTools')) return;
      var s = window.getSelection();
      var hasSel = !!(s && !s.isCollapsed);
      if ($('side').classList.contains('on')) { if (!hasSel) closeSide(); return; }
      if (!pgEnabled() || hasSel) return;
      if (e.target.closest('a,button,mark,[data-act]')) return;
      if (SPK.on && e.target.closest('.rdp')) return;          // 朗读中点段落 = 从这里念
      var box = $('pageWrap').getBoundingClientRect(), x = e.clientX - box.left;
      if (x < box.width * 0.22) readPrev();
      else if (x > box.width * 0.78) readNext();
    });
    /* 滚轮翻页（翻页模式） */
    var wheelT = 0;
    $('pageWrap').addEventListener('wheel', function (e) {
      autoPause();
      if (!pgEnabled()) return;
      var now = Date.now();
      if (now - wheelT < 240) { e.preventDefault(); return; }
      if (Math.abs(e.deltaY) < 6) return;
      wheelT = now; e.preventDefault();
      if (e.deltaY > 0) readNext(); else readPrev();
    }, { passive: false });
    /* 左右滑动翻页（触屏） */
    var tx0 = 0, ty0 = 0, tt0 = 0;
    $('pageWrap').addEventListener('touchstart', function (e) {
      autoPause();
      var t = e.touches[0]; if (!t) return;
      tx0 = t.clientX; ty0 = t.clientY; tt0 = Date.now();
    }, { passive: true });
    $('pageWrap').addEventListener('touchend', function (e) {
      if (!pgEnabled()) return;
      var t = (e.changedTouches && e.changedTouches[0]) || null; if (!t) return;
      var dx = t.clientX - tx0, dy = t.clientY - ty0;
      if (Date.now() - tt0 > 900) return;
      if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      var s = window.getSelection(); if (s && !s.isCollapsed) return;
      if (dx < 0) readNext(); else readPrev();
    }, { passive: true });
    $('pageWrap').addEventListener('scroll', hideSelTools);
    $('selTools').addEventListener('mousedown', function (e) { e.preventDefault(); });
    $('selTools').onclick = function (e) {
      var sw = e.target.closest('[data-hl]'), act = e.target.closest('[data-sel]');
      if (sw) { addHighlight(sw.getAttribute('data-hl')); return; }
      if (!act) return;
      var a = act.getAttribute('data-sel');
      if (a === 'note') { var hl = addHighlight('y'); if (hl) noteEditor(hl); return; }
      if (a === 'copy') { copyText(SEL.text).then(function (ok) { toast(ok ? T('已复制') : T('复制失败，请手动选择文本')); }); hideSelTools(); return; }
      if (a === 'share') { shareHighlight({ text: SEL.text, ch: SEL.ch }); hideSelTools(); return; }
    };
    $('pageWrap').onscroll = function () { updateProgress(); savePos(); };
    $('spPlay').onclick = toggleSpeak;
    $('spStop').onclick = function () { stopSpeak(false); toast(T('已停止朗读')); };
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
        else { toast(T('音色已切到 ') + localVoiceName(CFG.localVoice) + T('（本机离线合成）'), 2600); }
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
      if (e.key === 'Escape') {
        if ($('selTools').classList.contains('on')) { hideSelTools(); return; }
        if (AUTO.on) { autoStop(); return; }
        if (inImm() || isFull()) {
          CFG.immersive = 0; saveCfg(); applyImm();
          try { if (isFull()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { var r = ex.call(document); if (r && r.catch) r.catch(function () { }); } } } catch (er) { }
          return;
        }
        if ($('side').classList.contains('on')) $('side').classList.remove('on');
        else if ($('viewRead').classList.contains('on')) closeBook();
        return;
      }
      if (!$('viewRead').classList.contains('on')) return;
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'F11') { toggleFull(); e.preventDefault(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { autoPause(); readPrev(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') { autoPause(); readNext(); e.preventDefault(); }
      else if (e.key === ' ') {
        if (SPK.on) { toggleSpeak(); e.preventDefault(); }
        else if (AUTO.on) { autoToggle(); e.preventDefault(); }
        else { autoPause(); readNext(); e.preventDefault(); }
      }
      else if (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey)) { openSide('find'); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '_')) {
        var up = (e.key === '=' || e.key === '+');
        CFG.fs = Math.max(13, Math.min(34, Number(CFG.fs) + (up ? 1 : -1)));
        saveCfg(); applyCfg(); toast(T('字号') + ' ' + CFG.fs + 'px', 1200); e.preventDefault();
      }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 't') { showTheme(); e.preventDefault(); }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'a') { autoToggle(); e.preventDefault(); }
    });
    /* 沉浸模式：鼠标移到上下边缘唤出工具栏 */
    document.addEventListener('mousemove', function (e) {
      if (!document.body.classList.contains('imm')) return;
      var t = $('readTop').offsetHeight || 48, b = $('readFoot').offsetHeight || 44;
      $('readTop').classList.toggle('peek', e.clientY <= t + 6);
      $('readFoot').classList.toggle('peek', e.clientY >= window.innerHeight - b - 6);
    });
    /* 窗口尺寸变化：翻页模式重新分页 */
    var rzT = null;
    window.addEventListener('resize', function () {
      clearTimeout(rzT);
      rzT = setTimeout(function () {
        if (!BK) return;
        if (pgEnabled()) pgReflow(); else updateProgress();
      }, 180);
    });
    if (SYN && SYN.addEventListener) SYN.addEventListener('voiceschanged', fillVoices);
    if (SYN && 'onvoiceschanged' in SYN) SYN.onvoiceschanged = fillVoices;
    window.addEventListener('beforeunload', function () { try { savePos(); rtFlush(); } catch (e) { } });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { try { rtFlush(); savePos(); } catch (e) { } clkStop(); }
      else if (BK) { rtStart(BK.id); if ($('viewRead').classList.contains('on')) clkStart(); }
    });
  }

  async function init() {
    loadCfg(); loadStats(); bind(); fillVoices(); syncRoleBtn(); syncLangBtn(); syncTypeBtn(); syncAutoBtn(); syncFullBtn();
    if (I18N) I18N.apply();
    // 自动探测本机免费神经语音引擎；没启动时静默用系统语音，不打扰
    localProbe();
    setInterval(function () {
      if (CFG.localOn && !LOCAL.ready && LOCAL.miss < 5 && document.visibilityState === 'visible') localProbe();
    }, 12000);
    // 非 Edge 浏览器通常拿不到中文在线自然语音，给一次不打扰的引导
    if (SYN) setTimeout(function () {
      var vs = SYN.getVoices() || [];
      if (!vs.some(function (v) { return isNatural(v) && isZh(v); }) && !/Edg\//.test(navigator.userAgent) && !localReady())
        toast(T('当前浏览器没有中文自然语音；装一次免费离线语音包即可听到接近真人的朗读'), 6500);
    }, 2400);
    try { BOOKS = (await dbAll('books')) || []; } catch (e) { BOOKS = []; toast(T('本机存储不可用，书籍将无法保存'), 5000); }
    renderShelf();
    window.MY = {
      Z: Z, CFG: CFG, get BK() { return BK; }, get SPK() { return SPK; }, get BOOKS() { return BOOKS; },
      parseBook: parseBook, openBook: openBook, renderChapter: renderChapter, importFiles: importFiles,
      importFolder: importFolder, openSide: openSide, closeSide: closeSide,
      importBuffer: async function (buf, name, ext) {
        var b = await parseBook(buf, name, ext || readExt(name));
        var id = 'b' + Date.now() + Math.random().toString(36).slice(2, 7);
        await dbPut('blobs', { id: id, buf: buf });
        var m = { id: id, name: name.replace(/\.[^.]+$/, ''), ext: ext || readExt(name), size: buf.byteLength,
          added: Date.now(), last: Date.now(), ch: 0, ratio: 0, progress: 0, cover: b.cover || '',
          title: b.title, author: b.author || '', marks: [], hl: [], chapters: b.titles.slice(0, 1000),
          tocCount: b.toc.length, enc: b.enc || '', group: '', fav: 0, rt: 0, sessions: 0, first: 0 };
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
      buildVoiceList: buildVoiceList, setPara: setPara, speakerOf: speakerOf,
      VER: VER, setLang: setLang, STATS: STATS, loadStats: loadStats, fmtDur: fmtDur, statStreak: statStreak,
      noteEditor: noteEditor, hlMenu: hlMenu, removeHighlight: removeHighlight, hlList: hlList,
      notesMarkdown: notesMarkdown, exportNotes: exportNotes, showSummary: showSummary,
      shareHighlight: shareHighlight, applyHighlights: applyHighlights, persistBook: persistBook,
      showShelves: showShelves, toggleFav: toggleFav, shelfList: shelfList, enterSelMode: enterSelMode,
      openBookMenu: openBookMenu, copyText: copyText, rtFlush: rtFlush, saveStats: saveStats,
      /* 1.8：排版 / 分页 / 自动阅读 / 全屏 */
      showType: showType, showTheme: showTheme, showClockPanel: showClockPanel,
      CLK: CLK, clkStart: clkStart, clkStop: clkStop, clkPaint: clkPaint, clkTick: clkTick,
      showRest: showRest, hideRest: hideRest, LAYN: LAYN,
      clkReset: clkReset, restTake: restTake, restSnooze: restSnooze, fmtRead: fmtRead, PG: PG, pgEnabled: pgEnabled, pgCols: pgCols, pgMeasure: pgMeasure,
      applyCfg: applyCfg, scrollTopPara: scrollTopPara,
      pgTo: pgTo, pgReflow: pgReflow, paraPage: paraPage, readNext: readNext, readPrev: readPrev,
      autoToggle: autoToggle, autoStart: autoStart, autoStop: autoStop, autoPause: autoPause,
      autoResume: autoResume, AUTO: AUTO, toggleFull: toggleFull, setTheme: setTheme,
      THEMES: THEMES, revealPara: revealPara, renderKeep: renderKeep
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

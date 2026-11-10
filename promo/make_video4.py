# -*- coding: utf-8 -*-
"""「墨吟」升级汇报 · 1.14.14 → 1.14.21（2026-11-10 白天这一轮）。

在 make_video3.py 的骨架上改的：同一套背景、进场、音轨，只是换了分镜与文案。
讲的是昨晚那条进度汇报之后，今天收到的四条真实反馈与对应的修。

    python promo/make_video4.py             # 出有声版 + 静音版
    python promo/make_video4.py --no-audio  # 只出静音版
"""

import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHOT = os.path.join(ROOT, 'docs', 'screenshots')
FFMPEG = os.path.join(os.path.dirname(ROOT), '_tools', 'ffmpeg.exe')
if not os.path.isfile(FFMPEG):
    FFMPEG = 'ffmpeg'

W, H = 1080, 1920
FPS = 30
SR = 44100

BG = (13, 15, 20)
TX = (238, 236, 232)
TX2 = (152, 158, 170)
DIM = (104, 110, 122)
ACC = (92, 164, 255)
GOLD = (224, 186, 114)
RED = (176, 58, 46)

FONT_BD = 'C:/Windows/Fonts/msyhbd.ttc'
FONT_RG = 'C:/Windows/Fonts/msyh.ttc'
_fonts = {}


def F(size, bold=True):
    key = (size, bold)
    f = _fonts.get(key)
    if f is None:
        f = ImageFont.truetype(FONT_BD if bold else FONT_RG, size, index=0)
        _fonts[key] = f
    return f


# ---------------------------------------------------------------- 背景

PAD = 120
GW, GH = W + PAD * 2, H + PAD * 2


def build_glow():
    yy, xx = np.mgrid[0:GH, 0:GW].astype(np.float32)
    cx, cy = GW * 0.5, GH * 0.33
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (GH * 0.72)
    g = np.clip(1.0 - d, 0, 1) ** 2.1
    g2 = np.clip(1.0 - np.sqrt((xx - GW * 0.5) ** 2 + (yy - GH * 0.82) ** 2) / (GH * 0.55), 0, 1) ** 2.6
    out = np.zeros((GH, GW, 3), np.float32)
    out[..., 0] = BG[0] + g * 22 + g2 * 10
    out[..., 1] = BG[1] + g * 27 + g2 * 11
    out[..., 2] = BG[2] + g * 40 + g2 * 18
    rng = np.random.default_rng(20261107)
    out += rng.normal(0.0, 1.5, (GH, GW, 3))
    return np.clip(out, 0, 255)


GLOW = build_glow()

VIG = None


def build_vig():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx = (xx - W / 2) / (W / 2)
    ny = (yy - H / 2) / (H / 2)
    r = np.sqrt(nx ** 2 * 0.85 + ny ** 2)
    v = 1.0 - np.clip((r - 0.55) / 1.0, 0, 1) ** 1.7 * 0.55
    return v[..., None].astype(np.float32)


VIG = build_vig()

_rng = np.random.default_rng(7)
DUST = [(float(_rng.uniform(0, W)), float(_rng.uniform(0, H)),
         float(_rng.uniform(1.2, 3.4)), float(_rng.uniform(0.05, 0.20)),
         float(_rng.uniform(3, 13)), float(_rng.uniform(0, 6.28)))
        for _ in range(64)]


def bg_frame(t):
    ox = int(PAD + 30 * math.sin(t * 0.62))
    oy = int(PAD + 22 * math.sin(t * 0.47 + 1.1))
    c = GLOW[oy:oy + H, ox:ox + W].copy()
    for (px, py, pr, pa, pv, ph) in DUST:
        y = (py - t * pv) % (H + 40) - 20
        x = px + 9 * math.sin(t * 0.55 + ph)
        ix, iy = int(x), int(y)
        if 2 <= ix < W - 2 and 2 <= iy < H - 2:
            a = pa * (0.55 + 0.45 * math.sin(t * 1.3 + ph))
            k = int(pr) + 1
            c[iy - k:iy + k + 1, ix - k:ix + k + 1] += a * 46 * np.array([0.85, 0.92, 1.0], np.float32)
    c *= VIG
    return c


# ---------------------------------------------------------------- 缓动

def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


def eo_expo(t):
    t = clamp01(t)
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


def ei_cubic(t):
    t = clamp01(t)
    return t ** 3


def eio_cubic(t):
    t = clamp01(t)
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def eo_back(t, s=1.55):
    t = clamp01(t) - 1
    return 1 + (s + 1) * t ** 3 + s * t ** 2


# ---------------------------------------------------------------- 元素

def to_el(im):
    """PIL RGBA -> (rgb float32, alpha float32)"""
    a = np.asarray(im, dtype=np.float32)
    return a[:, :, :3].copy(), a[:, :, 3].copy() / 255.0


_LA = None          # 当前帧的图层不透明度（预乘合成用），由 render() 设置


def blend(cv, el, x, y, a=1.0):
    if a <= 0.004:
        return
    rgb, al = el
    h, w = al.shape
    x0, y0 = int(round(x)), int(round(y))
    cx0, cy0 = max(0, x0), max(0, y0)
    cx1, cy1 = min(W, x0 + w), min(H, y0 + h)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    sx, sy = cx0 - x0, cy0 - y0
    sub_al = al[sy:sy + (cy1 - cy0), sx:sx + (cx1 - cx0)] * a
    aa = sub_al[..., None]
    sub_rgb = rgb[sy:sy + (cy1 - cy0), sx:sx + (cx1 - cx0)]
    reg = cv[cy0:cy1, cx0:cx1]
    cv[cy0:cy1, cx0:cx1] = reg * (1 - aa) + sub_rgb * aa
    if _LA is not None:
        la_reg = _LA[cy0:cy1, cx0:cx1]
        _LA[cy0:cy1, cx0:cx1] = la_reg * (1 - sub_al) + sub_al


def text_el(runs, size, bold=True, gap=0):
    """runs: [(str, color), ...] 同一行。返回居中用的元素。"""
    f = F(size, bold)
    tmp = Image.new('RGBA', (10, 10))
    d = ImageDraw.Draw(tmp)
    widths = [d.textlength(s, font=f) for s, _ in runs]
    asc, desc = f.getmetrics()
    tw = int(sum(widths)) + gap * (len(runs) - 1)
    im = Image.new('RGBA', (max(1, tw + 8), asc + desc + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 4
    for (s, c), wd in zip(runs, widths):
        d.text((x, 4), s, font=f, fill=c)
        x += wd + gap
    return to_el(im), im.width


def pill_el(label, size=30, fg=ACC, bg=(38, 44, 56), bd=(70, 78, 92)):
    f = F(size, False)
    tmp = Image.new('RGBA', (10, 10))
    tw = int(ImageDraw.Draw(tmp).textlength(label, font=f))
    asc, desc = f.getmetrics()
    h = asc + desc + 24
    im = Image.new('RGBA', (tw + 52, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, im.width - 1, h - 1], h // 2, fill=bg + (255,), outline=bd + (255,), width=1)
    d.text((26, 12), label, font=f, fill=fg)
    return to_el(im)


def underline_el(w, color=GOLD, th=5):
    im = Image.new('RGBA', (int(w), th + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 3, max(3, int(w) - 1), th + 2], (th + 2) // 2, fill=color + (255,))
    return to_el(im)


def bullet_el(txt, size=35, color=TX):
    f = F(size, False)
    asc, desc = f.getmetrics()
    tmp = Image.new('RGBA', (10, 10))
    tw = int(ImageDraw.Draw(tmp).textlength(txt, font=f))
    im = Image.new('RGBA', (tw + 62, asc + desc + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([4, 10, 16, 22], fill=GOLD + (255,))
    d.text((34, 2), txt, font=f, fill=color)
    return to_el(im), im.width


def card_el(path, target_w, corner=20, crop=None, lift=1.06):
    """返回 (RGBA 图, 宽, 高)。
    crop 用相对比例 (l, t, r, b) 裁掉窗口外的无关区域，让面板文字更大更清楚。
    注意：软件窗口一律静止，不做推近/漂移（窗口在画面里滑动会显得很假）。"""
    im = Image.open(path).convert('RGB')
    if crop:
        W0, H0 = im.size
        im = im.crop((int(crop[0] * W0), int(crop[1] * H0),
                      int(crop[2] * W0), int(crop[3] * H0)))
    if lift and lift != 1.0:
        im = ImageEnhance.Brightness(im).enhance(lift)
    bw = int(target_w)
    bh = int(im.height * bw / im.width)
    im = im.resize((bw, bh), Image.LANCZOS)
    r = corner
    mask = Image.new('L', (bw, bh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw - 1, bh - 1], r, fill=255)
    base = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    base.paste(im, (0, 0), mask)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([0, 0, bw - 1, bh - 1], r, outline=(112, 120, 136, 235), width=2)
    th = int(target_w * im.height / im.width)
    return base, target_w, th


def shadow_for(w, h, corner=20, pad=40):
    im = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad + 14, pad + w, pad + h + 14], corner, fill=(0, 0, 0, 190))
    im = im.filter(ImageFilter.GaussianBlur(26))
    return to_el(im)


def halo_for(w, h, corner=20, pad=46):
    im = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], corner, fill=(80, 146, 240, 40))
    im = im.filter(ImageFilter.GaussianBlur(58))
    return to_el(im)


def seal_el():
    s = 200
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 4, s - 5, s - 5], 16, fill=RED + (234,))
    d.rounded_rectangle([15, 15, s - 16, s - 16], 10, outline=(255, 242, 238, 240), width=3)
    f = F(64)
    grid = [('永', 0, 0), ('远', 1, 0), ('兰', 0, 1), ('兰', 1, 1)]
    for ch, cx, cy in grid:
        bb = d.textbbox((0, 0), ch, font=f)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        x = 26 + cx * 78 + (70 - w) / 2 - bb[0]
        y = 30 + cy * 76 + (72 - h) / 2 - bb[1]
        d.text((x, y), ch, font=f, fill=(255, 248, 244))
    im = im.rotate(-7, resample=Image.BICUBIC, expand=False)
    return to_el(im)


SEAL = seal_el()


# ---------------------------------------------------------------- 场景

SCENES = [
    dict(k='hook', dur=5.2),
    dict(k='card', dur=6.4, tag='反馈 ①   包太大',
         t1=[('安装包', TX), ('小了一半', GOLD)],
         t2=[('158 MB  →  101 MB', GOLD)],
         shot='d-size.png', shot_w=960,
         bullets=['8 位量化：底噪滋滋 + 每句乱读', '半精度：体积减半，字错率不变']),
    dict(k='card', dur=6.2, tag='反馈 ②   看不到 epub',
         t1=[('epub', TX)],
         t2=[('终于能导入了', GOLD)],
         shot='d-import.png', shot_w=960,
         bullets=['国产系统没登记 epub 类型', '白名单 + 文件头：没后缀也认']),
    dict(k='card', dur=5.8, tag='反馈 ③   导入文件夹',
         t1=[('选一次目录', TX)],
         t2=[('整批进来', GOLD)],
         shot='d-folder.png', shot_w=960,
         bullets=['系统目录选择器，递归扫描', '不再进目录一本一本地点']),
    dict(k='card', dur=6.2, tag='反馈 ④   点下一页跳章',
         t1=[('一章被算成 1 页', TX), ('就跳过去了', GOLD)],
         shot='d-page.png', shot_w=960,
         bullets=['插图没加载完就量页数', '交叉校验 / 补量 / 末页复核']),
    dict(k='card', dur=6.0, tag='这一版',
         t1=[('没有新功能', TX)],
         t2=[('全在修能不能用', GOLD)],
         shot='d-thanks.png', shot_w=960,
         bullets=['九位读者把现象说清楚了', '每一条都能对上今天的改动']),
    dict(k='outro', dur=7.2),
]

TOTAL = sum(int(s['dur'] * FPS) for s in SCENES)
N_SCENE = len(SCENES)


# ---------------------------------------------------------------- 静态部分预渲染

_txt_cache = {}


def T(runs, size, bold=True):
    key = (tuple((s, c) for s, c in runs), size, bold)
    if key not in _txt_cache:
        _txt_cache[key] = text_el(runs, size, bold)
    return _txt_cache[key]


def scene_pre(sc, idx):
    """预先渲染该屏不随时间变化的元素。"""
    p = dict(idx=idx)
    if sc['k'] == 'hook':
        return p
    if sc['k'] == 'outro':
        return p
    p['pill'] = pill_el(sc['tag'])
    ysize = 62
    p['t1'] = T(sc['t1'], ysize) if sc.get('t1') else None
    p['t2'] = T(sc['t2'], ysize) if sc.get('t2') else None
    p['bul'] = [bullet_el(b) for b in sc.get('bullets', [])]
    if sc.get('shot'):
        if sc['k'] == 'phone':
            cw = 430
        else:
            cw = sc.get('shot_w', 900)
        path = sc['shot']
        if not os.path.isfile(os.path.join(SHOT, path)):
            path = os.path.join(HERE, path)
        else:
            path = os.path.join(SHOT, path)
        base, tw, th = card_el(path, cw, crop=sc.get('crop'), lift=sc.get('lift', 1.06))
        p['card'] = (base, tw, th)
        p['shadow'] = shadow_for(tw, th)
        p['halo'] = halo_for(tw, th)
    return p


_peek_cache = []


def _peek():
    """开场底部露出半张阅读界面，上边缘渐隐。"""
    if _peek_cache:
        return _peek_cache[0]
    p = os.path.join(SHOT, 'read-paged-dark.png')
    if not os.path.isfile(p):
        _peek_cache.append(None)
        return None
    im = Image.open(p).convert('RGB')
    W0, H0 = im.size
    im = im.crop((0, 0, W0, int(H0 * 0.62)))
    im = ImageEnhance.Brightness(im).enhance(1.05)
    tw = int(W * 0.86)
    th = int(im.height * tw / im.width)
    im = im.resize((tw, th), Image.LANCZOS)
    r = 22
    mask = Image.new('L', (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], r, fill=255)
    base = Image.new('RGBA', (tw, th), (0, 0, 0, 0))
    base.paste(im, (0, 0), mask)
    ImageDraw.Draw(base).rounded_rectangle([0, 0, tw - 1, th - 1], r, outline=(110, 118, 132, 220), width=2)
    rgb, al = to_el(base)
    g = np.clip(np.arange(th, dtype=np.float32) / (th * 0.30), 0, 1)[:, None]
    _peek_cache.append((rgb, al * g, tw, th))
    return _peek_cache[0]


def scene_h(cur, sc, t, p):
    """把这一屏的所有元素按时间轴叠到 cur 上。"""
    dur = sc['dur']
    idx = p['idx']

    # ---- 开场
    if sc['k'] == 'hook':
        a = eo_expo(t / 0.55)
        lw = int(240 * eo_expo((t - 0.15) / 0.75))
        if lw > 4:
            el = underline_el(lw, GOLD, 4)
            blend(cur, el, W / 2 - lw / 2, 466, 1.0)

        s = 180 * (0.86 + 0.14 * eo_back((t - 0.28) / 0.85))
        f = F(int(s))
        d = Image.new('RGBA', (int(s * 2.6), int(s * 1.5)), (0, 0, 0, 0))
        dr = ImageDraw.Draw(d)
        bb = dr.textbbox((0, 0), '墨吟', font=f)
        dr.text((d.width / 2 - (bb[2] - bb[0]) / 2 - bb[0], d.height / 2 - (bb[3] - bb[1]) / 2 - bb[1]),
                '墨吟', font=f, fill=TX + (255,))
        el = to_el(d)
        blend(cur, el, W / 2 - d.width / 2, 508, a)

        # 标题上的光泽扫过
        sh = clamp01((t - 1.05) / 0.9)
        if 0 < sh < 1:
            x = -300 + sh * (W + 600)
            band = np.zeros((H, W), np.float32)
            xs = np.arange(W, dtype=np.float32)[None, :]
            band += np.exp(-((xs - x) ** 2) / (2 * 46.0 ** 2)) * 30
            band *= np.exp(-((np.arange(H, dtype=np.float32)[:, None] - 600) ** 2) / (2 * 190.0 ** 2))
            cur += band[..., None] * np.array([1.0, 0.97, 0.9], np.float32)

        a2 = eo_expo((t - 0.75) / 0.7)
        el, tw = T([('MoYin Reader · 又改了八版', GOLD)], 52, False)
        blend(cur, el, W / 2 - tw / 2, 748 + (1 - a2) * 18, a2)
        el, tw = T([('昨晚发完视频，又收到四条反馈', TX2)], 42, False)
        blend(cur, el, W / 2 - tw / 2, 842 + (1 - a2) * 18, a2)
        el, tw = T([('包小了 57 MB · 导入能用 · 翻页不跳章', TX2)], 34, False)
        blend(cur, el, W / 2 - tw / 2, 924 + (1 - a2) * 18, a2)
        a3 = eo_expo((t - 1.5) / 0.7)
        el, tw = T([('v1.14.21   ·   2026-11-10', DIM)], 30, False)
        blend(cur, el, W / 2 - tw / 2, 1004, a3)

        # 底部露出半张阅读界面（有景深，别让下半屏空着）——原地淡入，不滑动
        pk = _peek()
        if pk:
            rgb, al, pw, ph = pk
            pa = clamp01((t - 1.05) / 0.85)
            blend(cur, (rgb, al), (W - pw) / 2, 1176, 0.95 * pa)
        return

    # ---- 结尾
    if sc['k'] == 'outro':
        a = eo_expo(t / 0.6)
        lw = int(240 * eo_expo((t - 0.1) / 0.7))
        if lw > 4:
            blend(cur, underline_el(lw, GOLD, 4), W / 2 - lw / 2, 522, 1.0)
        el, tw = T([('装上试试', TX)], 76)
        blend(cur, el, W / 2 - tw / 2, 570 + (1 - a) * 26, a)
        el, tw = T([('下载 · Windows / 安卓 / 信创 Linux / macOS', TX2)], 31, False)
        blend(cur, el, W / 2 - tw / 2, 704, eo_expo((t - 0.45) / 0.6))

        # 地址逐字打出
        a1 = 'github.com/podcatcher962/moyin-reader'
        a2s = 'podcatcher962.github.io/moyin-reader'
        n1 = int(len(a1) * clamp01((t - 0.9) / 1.3))
        n2 = int(len(a2s) * clamp01((t - 2.3) / 1.1))
        if n1:
            el, tw = T([(a1[:n1], ACC)], 33)
            blend(cur, el, W / 2 - tw / 2, 762, 1.0)
        if n2:
            el, tw = T([(a2s[:n2], ACC)], 33)
            blend(cur, el, W / 2 - tw / 2, 908, 1.0)
        if n2 >= len(a2s):
            cur[900:902, W // 2 - 330:W // 2 + 330] *= 0

        yy = 1010
        cur[yy:yy + 1, 150:W - 150] = np.array([54, 60, 72], np.float32)
        for i, (s, c, sz) in enumerate([('单文件 · 零联网 · 数据只在本机', TX, 34),
                                       ('MIT 开源 · 永久免费', GOLD, 32)]):
            aa = eo_expo((t - 2.9 - i * 0.35) / 0.6)
            el, tw = T([(s, c)], sz, False)
            blend(cur, el, W / 2 - tw / 2, 1046 + i * 66, aa)

        # 印章落下
        sp = (t - 4.1) / 0.55
        if sp > 0:
            q = eo_back(sp, 2.2)
            al = clamp01(sp * 2.4)
            blend(cur, SEAL, W / 2 - 100, 1236 - (1 - q) * 46, al)
        el, tw = T([('© 永远的兰兰  ·  Lanlan Eternal', DIM)], 26, False)
        blend(cur, el, W / 2 - tw / 2, 1620, eo_expo((t - 5.2) / 0.7))
        return

    # ---- 通用功能屏
    dur_in = 0.42
    # 标签
    p1 = eo_back((t - 0.00) / 0.5)
    el = p['pill']
    blend(cur, el, W / 2 - el[1].shape[1] / 2, 148 - (1 - p1) * 26, clamp01(t / 0.25))

    y = 238
    # 标题第一行（支持计数）
    if p.get('t1'):
        el, tw = p['t1']
        a = eo_expo((t - 0.16) / 0.55)
        dy = (1 - a) * 30
        if sc.get('counter'):
            n = int(sc['counter'] * clamp01((t - 0.2) / 0.95))
            el2, tw2 = T([('%d 个离线声线' % n, TX)], 62)
            blend(cur, el2, W / 2 - tw2 / 2, y + dy, a)
        else:
            blend(cur, el, W / 2 - tw / 2, y + dy, a)
        y += 88

    # 第二行 + 金色下划线
    if p.get('t2'):
        el, tw = p['t2']
        a = eo_expo((t - 0.42) / 0.55)
        blend(cur, el, W / 2 - tw / 2, y + (1 - a) * 30, a)
        uw = int(tw * 0.55 * eo_expo((t - 0.95) / 0.7))
        if uw > 6:
            blend(cur, underline_el(uw, GOLD, 6), W / 2 - uw / 2, y + 84, clamp01((t - 0.95) / 0.3))
        y += 92
    y += 18

    # 截图卡：位置与尺寸全程固定，只做淡入（窗口绝对不能自己晃）
    if p.get('card'):
        base, tw, th = p['card']
        cur_w, cur_h = base.width, base.height
        ca = clamp01((t - 0.26) / 0.50)

        cx = (W - cur_w) / 2
        top, bot = 612, 1420
        if cur_h >= bot - top:
            cy = top
        else:
            cy = top + (bot - top - cur_h) // 2
        cy = max(cy, y + 14)

        if ca > 0.02:
            hw, hh = p['halo'][1].shape[1], p['halo'][1].shape[0]
            blend(cur, p['halo'], cx - (hw - cur_w) / 2, cy - (hh - cur_h) / 2, ca * 0.85)
            sw, shh = p['shadow'][1].shape[1], p['shadow'][1].shape[0]
            blend(cur, p['shadow'], cx - (sw - cur_w) / 2, cy - (shh - cur_h) / 2, ca)
            blend(cur, to_el(base), cx, cy, ca)
        card_bottom = cy + cur_h
    else:
        card_bottom = 0

    # 要点（跟着卡片走，卡片矮就贴着卡片下方，不留空洞）
    for i, (el, tw) in enumerate(p.get('bul', [])):
        a = eo_expo((t - 0.72 - i * 0.16) / 0.55)
        base_y = (card_bottom + 58) if card_bottom else 1452
        by = min(base_y, H - 150 - len(p.get('bul', [])) * 66) + i * 66
        blend(cur, el, 118 - (1 - a) * 26, by, a)

    # 页码
    pg = '%02d / %02d' % (idx + 1, N_SCENE)
    el, tw = T([(pg, (92, 98, 110))], 24, False)
    blend(cur, el, W - tw - 52, H - 74, clamp01((t - 0.3) / 0.5))


# ---------------------------------------------------------------- 音频

def make_audio(path, duration):
    from scipy.io import wavfile
    from scipy.signal import fftconvolve

    n = int(SR * duration)
    t = np.arange(n, dtype=np.float32) / SR
    pad = np.zeros((n, 2), np.float32)
    arp = np.zeros((n, 2), np.float32)
    bass = np.zeros((n, 2), np.float32)
    perc = np.zeros((n, 2), np.float32)

    bpm = 96.0
    beat = 60.0 / bpm
    bar = beat * 4

    # Am - F - C - G（频率取低八度，柔和）
    chords = [
        [220.0, 261.63, 329.63],
        [174.61, 220.0, 261.63],
        [261.63, 329.63, 392.0],
        [196.0, 246.94, 293.66],
    ]
    roots = [110.0, 87.31, 130.81, 98.0]

    for b in range(int(duration / bar) + 1):
        t0 = b * bar
        if t0 > duration:
            break
        ch = chords[b % 4]
        rt = roots[b % 4]
        i0 = int(t0 * SR)
        i1 = min(n, int((t0 + bar * 1.9) * SR))
        if i1 <= i0:
            continue
        tt = np.arange(i1 - i0, dtype=np.float32) / SR
        env = np.minimum(1.0, tt / 1.1) * np.exp(-np.maximum(0, tt - bar * 1.0) / 0.9)
        seg = np.zeros(i1 - i0, np.float32)
        for f in ch:
            seg += np.sin(2 * np.pi * f * tt) * 0.5 + np.sin(2 * np.pi * f * 2 * tt) * 0.14
        seg = seg * env / len(ch)
        pad[i0:i1, 0] += seg * 0.9
        pad[i0:i1, 1] += np.roll(seg, 220) * 0.9

        # 低音
        bl = np.sin(2 * np.pi * rt * tt) * np.exp(-tt / 1.5) * 0.9
        bass[i0:i1, 0] += bl
        bass[i0:i1, 1] += bl

        # 琶音：每 1/8 拍一个音
        step = beat / 2
        k = 0
        while t0 + k * step < min(duration, t0 + bar * 1.9):
            ts = t0 + k * step
            ii0 = int(ts * SR)
            ln = int(0.34 * SR)
            ii1 = min(n, ii0 + ln)
            if ii1 > ii0:
                tv = np.arange(ii1 - ii0, dtype=np.float32) / SR
                f = ch[k % 3] * 2 * (2 if (k % 6 == 5) else 1)
                v = np.sin(2 * np.pi * f * tv) * np.exp(-tv / 0.13) * (0.55 if k % 2 else 0.85)
                pan = 0.35 if k % 2 else 0.65
                arp[ii0:ii1, 0] += v * pan
                arp[ii0:ii1, 1] += v * (1 - pan) * 1.4
            k += 1

    # 极轻的节拍点（只在 2、4 拍）
    for b in range(int(duration / beat) + 1):
        ts = b * beat
        if (b % 4) not in (1, 3):
            continue
        ii0 = int(ts * SR)
        ln = int(0.05 * SR)
        ii1 = min(n, ii0 + ln)
        if ii1 > ii0:
            tv = np.arange(ii1 - ii0, dtype=np.float32) / SR
            v = np.random.default_rng(b).normal(0, 1, ii1 - ii0).astype(np.float32)
            v = v * np.exp(-tv / 0.012)
            perc[ii0:ii1, 0] += v * 0.16
            perc[ii0:ii1, 1] += v * 0.16

    mix = pad * 0.55 + arp * 0.30 + bass * 0.55 + perc * 0.5

    # 简单混响
    ir_len = int(1.1 * SR)
    ir = np.random.default_rng(3).normal(0, 1, ir_len).astype(np.float32)
    ir *= np.exp(-np.arange(ir_len, dtype=np.float32) / (0.32 * SR))
    ir /= np.abs(ir).sum() / 9
    for c in range(2):
        wet = fftconvolve(mix[:, c], ir, mode='same').astype(np.float32)
        mix[:, c] = mix[:, c] * 0.82 + wet * 0.30

    # 转场 whoosh
    acc = 0
    for s in SCENES[:-1]:
        acc += s['dur']
        ts = acc - 0.18
        ii0 = int(ts * SR)
        ln = int(0.75 * SR)
        ii1 = min(n, ii0 + ln)
        if ii1 <= ii0:
            continue
        tv = np.arange(ii1 - ii0, dtype=np.float32) / SR
        nz = np.random.default_rng(int(ts)).normal(0, 1, ii1 - ii0).astype(np.float32)
        # 一阶低通做出"风"感
        for _ in range(2):
            nz = np.convolve(nz, np.ones(9, np.float32) / 9, mode='same')
        env = np.exp(-((tv - 0.28) ** 2) / (2 * 0.16 ** 2))
        mix[ii0:ii1, 0] += nz * env * 0.10
        mix[ii0:ii1, 1] += nz * env * 0.10

    # 淡入淡出
    fi = int(0.6 * SR)
    fo = int(2.2 * SR)
    mix[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    mix[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None] ** 1.4

    peak = float(np.abs(mix).max()) or 1.0
    mix = mix / peak * 0.72
    wavfile.write(path, SR, (mix * 32767).astype(np.int16))
    return path


# ---------------------------------------------------------------- 渲染

def content_dy(sc, t):
    """整屏只做淡入淡出，不做位移——位移会让软件窗口在画面里滑动，看着像"乱动"。
    灵动感交给元素逐个进场、背景游走和进度条。"""
    dur = sc['dur']
    if t < 0.28:
        return 0.0, eo_expo(t / 0.28)
    if t > dur - 0.20:
        p = clamp01((t - (dur - 0.20)) / 0.20)
        return 0.0, 1 - p
    return 0.0, 1.0


def render(out_path, with_audio, audio_path):
    global _LA
    cmd = [FFMPEG, '-y', '-hide_banner', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H),
           '-r', str(FPS), '-i', '-']
    if with_audio:
        cmd += ['-i', audio_path]
    cmd += ['-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
            '-maxrate', '2400k', '-bufsize', '4800k',
            '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
            '-movflags', '+faststart']
    if with_audio:
        cmd += ['-c:a', 'aac', '-b:a', '112k', '-shortest']
    cmd += [out_path]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    gtime = 0.0
    done = 0
    for i, sc in enumerate(SCENES):
        pre = scene_pre(sc, i)
        nf = int(sc['dur'] * FPS)
        for f in range(nf):
            t = f / FPS
            cur = bg_frame(gtime + t)
            layer = np.zeros((H, W, 3), np.float32)
            lalpha = np.zeros((H, W), np.float32)
            _LA = lalpha
            scene_h(layer, sc, t, pre)
            _LA = None
            dy, ga = content_dy(sc, t)
            if dy:
                layer = np.roll(layer, int(dy), axis=0)
                lalpha = np.roll(lalpha, int(dy), axis=0)
                if dy > 0:
                    layer[:int(dy)] = 0
                    lalpha[:int(dy)] = 0
                else:
                    layer[int(dy):] = 0
                    lalpha[int(dy):] = 0
            # 标准 over 合成：窗口完全不透明，背景的光晕和粒子透不进来
            la = lalpha[..., None] * ga
            cur = cur * (1 - la) + layer * ga

            # 顶部进度条
            done += 1
            bw = int(W * done / TOTAL)
            if bw > 0:
                cur[0:4, :bw] = np.array(GOLD, np.float32)
                hx = max(6, min(W - 6, bw))
                cur[0:4, hx - 6:hx] = np.array([255, 236, 200], np.float32)

            frame = np.clip(cur, 0, 255).astype(np.uint8)
            proc.stdin.write(frame.tobytes())
        print('  场景 %02d/%02d  %-5s 渲染完成' % (i + 1, N_SCENE, sc['k']), flush=True)
        gtime += sc['dur']

    proc.stdin.close()
    rc = proc.wait()
    return rc


def main():
    no_audio = '--no-audio' in sys.argv
    dur = TOTAL / FPS
    print('总帧数 %d ／ %.1f 秒 ／ %d fps' % (TOTAL, dur, FPS), flush=True)

    audio = os.path.join(HERE, '_bed.wav')
    if not no_audio:
        print('合成音轨…', flush=True)
        make_audio(audio, dur)

    outs = []
    if not no_audio:
        p1 = os.path.join(HERE, '墨吟升级汇报-1.14.21.mp4')
        print('编码有声版 →', p1, flush=True)
        rc = render(p1, True, audio)
        if rc == 0:
            outs.append(p1)
    p2 = os.path.join(HERE, '墨吟升级汇报-1.14.21-静音版.mp4')
    print('编码静音版 →', p2, flush=True)
    rc = render(p2, False, None)
    if rc == 0:
        outs.append(p2)

    for p in outs:
        print('  完成 %s  %.2f MB' % (os.path.basename(p), os.path.getsize(p) / 1048576))
    return 0


if __name__ == '__main__':
    sys.exit(main())

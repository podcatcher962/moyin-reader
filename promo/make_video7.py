# -*- coding: utf-8 -*-
"""「墨吟」日报 · 1.14.35（2026-11-12）· 轻纸感 · 七版合辑

沿用 1.14.28 那套轻纸感（米白纸纹、荧光笔、图示自己长出来），
这次讲「能读什么」，以及一个做错了两次的 bug。

  · 七种格式一屏排开，新加的打勾
  · 压缩包：一个包裂成几本书飞出来
  · 英文切分：上面那行被剪子剪断（senten / ce），下面那行整整齐齐
  · 死循环：圈起来的箭头 + 那把锁
  · 实测：40 秒超时 → 5.3 秒出音
  · 扫描件：满屏水印的页 vs 真的那一页
  · 体积：把 150 MB 拆开给你看，然后说「不改了」

    python promo/make_video7.py              # 有声 + 静音两版
    python promo/make_video7.py --no-audio   # 只出静音版
"""

import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FFMPEG = os.path.join(os.path.dirname(ROOT), '_tools', 'ffmpeg.exe')
if not os.path.isfile(FFMPEG):
    FFMPEG = 'ffmpeg'

W, H = 1080, 1920
FPS = 30
SR = 44100

PAPER = (250, 246, 237)
PAPER2 = (242, 236, 224)
INK = (33, 36, 45)
INK2 = (110, 114, 126)
INK3 = (156, 158, 168)
CORAL = (223, 84, 58)
TEAL = (18, 136, 118)
YEL = (255, 211, 92)
BLUE = (52, 104, 190)
SOFT = (232, 226, 214)
NOISE = (196, 202, 214)

URL_MAIN = 'github.com/podcatcher962/moyin-reader'

FONT_VF = 'C:/Windows/Fonts/NotoSansSC-VF.ttf'
FONT_RG = 'C:/Windows/Fonts/msyh.ttc'
_fonts = {}


def F(size, weight='Black'):
    key = (size, weight)
    f = _fonts.get(key)
    if f is None:
        try:
            f = ImageFont.truetype(FONT_VF, size)
            f.set_variation_by_name(weight)
        except Exception:
            f = ImageFont.truetype(FONT_RG, size)
        _fonts[key] = f
    return f


# ---------------------------------------------------------------- 纸背景

PAD = 90
GW, GH = W + PAD * 2, H + PAD * 2


def build_paper():
    yy, xx = np.mgrid[0:GH, 0:GW].astype(np.float32)
    gx, gy = xx / GW, yy / GH
    warm = np.clip(1.0 - (gx * 0.55 + gy * 0.75), 0, 1) ** 1.2
    out = np.zeros((GH, GW, 3), np.float32)
    for i in range(3):
        out[..., i] = PAPER[i] + (PAPER2[i] - PAPER[i]) * (1 - warm) * 0.55

    rng = np.random.default_rng(20261111)
    out += rng.normal(0.0, 1.9, (GH, GW, 3))

    dots = np.zeros((GH, GW), np.float32)
    step = 44
    for y0 in range(0, GH, step):
        for x0 in range(0, GW, step):
            dots[y0:y0 + 4, x0:x0 + 4] += 1.0
    dots = np.asarray(Image.fromarray((dots * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(1.1)), np.float32) / 255.0
    out -= dots[..., None] * np.array([13, 14, 16], np.float32)

    nx = (xx - GW / 2) / (GW / 2)
    ny = (yy - GH / 2) / (GH / 2)
    r = np.sqrt(nx ** 2 * 0.8 + ny ** 2)
    v = 1.0 - np.clip((r - 0.62) / 0.9, 0, 1) ** 1.5 * 0.10
    out *= v[..., None]
    return np.clip(out, 0, 255)


PAPER_IMG = build_paper()


def bg_frame(t):
    ox = int(PAD + 16 * math.sin(t * 0.33))
    oy = int(PAD + 12 * math.sin(t * 0.27 + 0.8))
    return PAPER_IMG[oy:oy + H, ox:ox + W].copy()


# ---------------------------------------------------------------- 缓动

def clamp01(x):
    return 0.0 if x < 0 else (1.0 if x > 1 else x)


def eo_expo(t):
    t = clamp01(t)
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


def eo_quart(t):
    t = clamp01(t)
    return 1 - (1 - t) ** 4


def eo_back(t, s=1.9):
    t = clamp01(t) - 1
    return 1 + (s + 1) * t ** 3 + s * t ** 2


# ---------------------------------------------------------------- 合成

_LA = None


def to_el(im):
    a = np.asarray(im, dtype=np.float32)
    return a[:, :, :3].copy(), a[:, :, 3].copy() / 255.0


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
    reg = cv[cy0:cy1, cx0:cx1]
    cv[cy0:cy1, cx0:cx1] = reg * (1 - aa) + rgb[sy:sy + (cy1 - cy0), sx:sx + (cx1 - cx0)] * aa
    if _LA is not None:
        la = _LA[cy0:cy1, cx0:cx1]
        _LA[cy0:cy1, cx0:cx1] = la * (1 - sub_al) + sub_al


# ---------------------------------------------------------------- 文字与部件

_txt = {}


def text_el(runs, size, weight='Regular', gap=0):
    f = F(size, weight)
    tmp = Image.new('RGBA', (10, 10))
    d = ImageDraw.Draw(tmp)
    widths = [d.textlength(s, font=f) for s, _ in runs]
    asc, desc = f.getmetrics()
    tw = int(sum(widths)) + gap * (len(runs) - 1)
    im = Image.new('RGBA', (max(1, tw + 10), asc + desc + 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x = 5
    for (s, c), wd in zip(runs, widths):
        d.text((x, 6), s, font=f, fill=c)
        x += wd + gap
    return to_el(im), im.width


def T(runs, size, weight='Regular', gap=0):
    key = (tuple(runs), size, weight, gap)
    if key not in _txt:
        _txt[key] = text_el(runs, size, weight, gap)
    return _txt[key]


def pill_el(label, size=28, fg=INK, bg=(255, 255, 255), bd=SOFT, pad_x=26, pad_y=14):
    f = F(size, 'Bold')
    tmp = Image.new('RGBA', (10, 10))
    tw = int(ImageDraw.Draw(tmp).textlength(label, font=f))
    asc, desc = f.getmetrics()
    h = asc + desc + pad_y
    im = Image.new('RGBA', (tw + pad_x * 2, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, im.width - 1, h - 1], h // 2, fill=bg + (255,), outline=bd + (255,), width=2)
    d.text((pad_x, pad_y // 2 - 1), label, font=f, fill=fg)
    return to_el(im)


_hl = {}


def hl_el(w, h=64, color=YEL, alpha=205):
    key = (int(w), h, color, alpha)
    if key in _hl:
        return _hl[key]
    k = 2
    im = Image.new('L', (max(2, int(w)) * k, h * k), 0)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, int(4 * k), im.width - 1, im.height - int(4 * k)], int(h * 0.28 * k), fill=255)
    im = im.filter(ImageFilter.GaussianBlur(1.6 * k)).resize((max(2, int(w)), h), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255.0 * (alpha / 255.0)
    xs = np.arange(max(2, int(w)), dtype=np.float32) / max(1, int(w))
    a *= (0.86 + 0.14 * np.sin(xs * 9.0 + 0.7))[None, :]
    rgb = np.zeros((h, max(2, int(w)), 3), np.float32)
    rgb[:] = color
    el = (rgb, a)
    _hl[key] = el
    return el


_card_cache = {}


def round_card(w, h, fill=(255, 255, 255), bd=SOFT, radius=26, shadow=14):
    key = (w, h, fill, bd, radius, shadow)
    if key in _card_cache:
        return _card_cache[key]
    pad = shadow * 3
    im = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad + shadow * 0.55, pad + w, pad + h + shadow * 0.55],
                        radius, fill=(60, 52, 40, 26))
    im = im.filter(ImageFilter.GaussianBlur(shadow))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius, fill=fill + (255,), outline=bd + (255,), width=2)
    el = (to_el(im), pad, w, h)
    _card_cache[key] = el
    return el


def put_card(cur, w, h, x, y, a=1.0, fill=(255, 255, 255), bd=SOFT, radius=26, shadow=14):
    el, pad, cw, ch = round_card(w, h, fill, bd, radius, shadow)
    blend(cur, el, x - pad, y - pad, a)


# ---------------------------------------------------------------- 图示：梳齿

COMB_W, COMB_H = 960, 720
COMB_BASE = 640
COMB_MAX = 530


def comb_img(t, f0, decay, noise_h, kind, noise_db):
    im = Image.new('RGBA', (COMB_W, COMB_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, x1 = 56, 902
    base = COMB_BASE

    def fx(hz):
        return x0 + (x1 - x0) * hz / 5000.0

    # 2–4 kHz：耳朵最敏感
    ba = clamp01((t - 0.15) / 0.5)
    if ba > 0:
        band = Image.new('RGBA', (COMB_W, COMB_H), (0, 0, 0, 0))
        ImageDraw.Draw(band).rectangle([fx(2000), 24, fx(4000), base], fill=(255, 211, 92, int(52 * ba)))
        im.alpha_composite(band)
        d.text((fx(2000) + 12, 30), '2–4 kHz', font=F(23, 'Bold'), fill=(184, 142, 40))
        d.text((fx(2000) + 12, 60), '耳朵最敏感', font=F(21, 'Medium'), fill=(196, 174, 116))

    # 底噪
    na = clamp01((t - 0.55) / 0.55)
    label = None
    if na > 0:
        rng = np.random.default_rng(5)
        top = [(x, base - noise_h * na + float(rng.normal(0, 1.8)))
               for x in range(int(x0), int(x1) + 1, 6)]
        d.polygon([(x0, base)] + top + [(x1, base)], fill=NOISE + (int(196 * na),))
        d.line(top, fill=(172, 178, 194, int(235 * na)), width=2)
        # 噪声电平标注留到最后画（柱子会压在它上面）
        lx = x1 - 4
        f_ = F(21, 'Bold')
        s = '%s dBFS' % noise_db
        label = (lx, base - noise_h - 34, s, d.textlength(s, font=f_))

    # 谐波
    k = 1
    bars = []
    while True:
        f = f0 * k
        if f > 5000:
            break
        amp = math.exp(-f / decay) * COMB_MAX
        if amp < 8:
            break
        g = eo_back((t - 0.20 - k * 0.012) / 0.42, 1.5)
        hh = amp * g
        if hh > 1.5:
            x = fx(f)
            w = 10 if kind == 'm' else 8
            c = CORAL if kind == 'm' else TEAL
            d.rounded_rectangle([x - w / 2, base - hh, x + w / 2, base], w / 2, fill=c + (255,))
            bars.append((x, hh))
        k += 1

    # 齿缝漏出的噪声
    if kind == 'm':
        ga = clamp01((t - 1.15) / 0.45)
        if ga > 0:
            pts = []
            for i in range(len(bars) - 1):
                xm = (bars[i][0] + bars[i + 1][0]) / 2
                hz = (xm - x0) / (x1 - x0) * 5000
                if 2250 <= hz <= 3900:
                    pts.append(xm)
            y = base - noise_h - 6
            for xm in pts:
                d.ellipse([xm - 5, y - 5 - 26 * ga, xm + 5, y + 5 - 26 * ga], fill=CORAL + (int(255 * ga),))

    d.line([(x0, base), (x1, base)], fill=(194, 188, 176, 255), width=2)
    for hz in (0, 1000, 2000, 3000, 4000, 5000):
        x = fx(hz)
        d.line([(x, base), (x, base + 7)], fill=(200, 194, 182, 255), width=2)
        s = '0' if hz == 0 else '%dk' % (hz // 1000)
        f_ = F(21, 'Medium')
        tw = d.textlength(s, font=f_)
        d.text((x - tw / 2, base + 14), s, font=f_, fill=INK3)

    # 噪声标注画在谐波柱之上，否则女声那屏会被最后一根柱子切掉半个字
    if label:
        lx, ty, s, tw = label
        d.rounded_rectangle([lx - tw - 9, ty - 5, lx + 9, ty + 27],
                            radius=8, fill=(252, 249, 242, 232))
        d.text((lx - tw, ty), s, font=F(21, 'Bold'), fill=(140, 146, 162))
    return im


# ---------------------------------------------------------------- 图示：电平表

def meters_img(t):
    cw, chh = 960, 520
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    track_x, track_w = 156, 620
    for i, (lab, a_t, val, col) in enumerate([('女声', 0.655, 48.9, TEAL),
                                              ('男声', 0.250, 57.0, CORAL)]):
        y = 74 + i * 150
        p = eo_quart((t - 0.15 - i * 0.18) / 0.7)
        d.text((4, y - 10), lab, font=F(36, 'Bold'), fill=INK)
        d.rounded_rectangle([track_x, y, track_x + track_w, y + 54], 27, fill=(240, 236, 227, 255))
        w = int(track_w * a_t * p)
        if w > 26:
            d.rounded_rectangle([track_x, y, track_x + w, y + 54], 27, fill=col + (255,))
        n = p * val
        d.text((track_x + track_w + 24, y + 4), '-%.1f' % n, font=F(36, 'Bold'), fill=INK2)
    d.text((4, 386), '字与字之间的底噪', font=F(24, 'Medium'), fill=INK3)
    d.text((4, 424), '单位 dBFS  ·  条越长越吵', font=F(24, 'Medium'), fill=INK3)
    # 差值括号
    pa = clamp01((t - 1.0) / 0.5)
    if pa > 0:
        x = track_x + int(track_w * 0.25) + 6
        d.line([(x, 128), (x, 300)], fill=CORAL + (int(210 * pa),), width=2)
        f_ = F(24, 'Bold')
        s = '差 8.1 dB'
        tw = d.textlength(s, font=f_)
        d.text((x + 10, 196), s, font=f_, fill=CORAL)
    return im


# ---------------------------------------------------------------- 图示：可闻阈

def thresh_img(t):
    cw, chh = 960, 440
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, x1 = 40, 900
    y = 210
    span = 3.6

    def fx(v):
        return x0 + (x1 - x0) * v / span

    p = eo_quart((t - 0.1) / 0.8)
    d.rounded_rectangle([x0, y - 20, x1, y + 20], 20, fill=(242, 238, 229, 255))
    w = fx(0.1 * p) - x0
    if w > 3:
        d.rounded_rectangle([x0, y - 20, x0 + max(w, 12), y + 20], 20, fill=CORAL + (255,))
    ta = clamp01((t - 0.75) / 0.4)
    if ta > 0:
        tx = fx(3.0)
        for yy in range(140, 296, 18):
            d.line([(tx, yy), (tx, min(yy + 10, 296))], fill=TEAL + (int(235 * ta),), width=3)
        f_ = F(26, 'Bold')
        s = '可闻阈 3 dB'
        tw = d.textlength(s, font=f_)
        d.text((tx - tw / 2, 104), s, font=f_, fill=TEAL)
    for v in (0, 1, 2, 3):
        x = fx(v)
        d.line([(x, y + 24), (x, y + 34)], fill=(200, 194, 182, 255), width=2)
        d.text((x - 7, y + 42), '%d' % v, font=F(21, 'Medium'), fill=INK3)
    d.text((x0, 96), '我们 0.1 dB', font=F(34, 'Black'), fill=CORAL)
    d.text((x0, y + 92), '降噪实测抑制量（dB）', font=F(22, 'Medium'), fill=INK3)
    return im


# ---------------------------------------------------------------- 图示：降噪三档

def dn_img(t):
    cw, chh = 960, 320
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, th = 24, 66, 108
    seg_w = (cw - x0 * 2 - 16) / 3
    labels = [('原声', '默认'), ('更干净', ''), ('更清楚', '')]
    d.rounded_rectangle([x0, y0, cw - x0, y0 + th], 54, fill=(240, 235, 225, 255))
    for i, (lab, tag) in enumerate(labels):
        sx = x0 + i * (seg_w + 8)
        on = i == 0
        pa = eo_back((t - 0.10 - i * 0.12) / 0.45, 1.8)
        if pa <= 0.01:
            continue
        if on:
            d.rounded_rectangle([sx + 4, y0 + 4, sx + seg_w - 4, y0 + th - 4], 50,
                                fill=CORAL + (int(255 * min(1.0, pa)),))
            fg = (255, 250, 246, 255)
        else:
            fg = INK2 + (255,)
        f_ = F(34, 'Bold' if on else 'Medium')
        tw = d.textlength(lab, font=f_)
        d.text((sx + seg_w / 2 - tw / 2, y0 + 34), lab, font=f_, fill=fg)
        if tag:
            tf = F(22, 'Bold')
            ttw = d.textlength(tag, font=tf)
            d.rounded_rectangle([sx + seg_w / 2 - ttw / 2 - 14, y0 - 34,
                                 sx + seg_w / 2 + ttw / 2 + 14, y0 - 2],
                                16, fill=INK + (235,))
            d.text((sx + seg_w / 2 - ttw / 2, y0 - 30), tag, font=tf, fill=(255, 250, 244))
    d.text((x0 + 6, y0 + th + 28), '在朗读页随时可调，接音箱嫌吵就往上推', font=F(23, 'Medium'), fill=INK3)
    return im


# ---------------------------------------------------------------- 图示：三条路

def _g_music(d, cx, cy, col):
    pts = []
    for i in range(64):
        x = cx - 66 + 132 * i / 63
        pts.append((x, cy - 38 * math.sin(i / 63 * math.pi * 3.4) * (1 - i / 74)))
    d.line(pts, fill=col + (255,), width=5, joint='curve')


def _g_sun(d, cx, cy, col):
    d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=col + (255,))
    for i in range(8):
        an = i * math.pi / 4
        d.line([(cx + math.cos(an) * 36, cy + math.sin(an) * 36),
                (cx + math.cos(an) * 54, cy + math.sin(an) * 54)], fill=col + (255,), width=5)


def _g_squeeze(d, cx, cy, col):
    for i in range(7):
        x = cx - 54 + i * 18
        hh = 52 if i % 2 == 0 else 28
        d.rounded_rectangle([x - 5, cy - hh / 2, x + 5, cy + hh / 2], 5, fill=col + (255,))
    d.line([(cx, cy - 58), (cx, cy - 38)], fill=CORAL + (255,), width=4)
    d.line([(cx, cy + 38), (cx, cy + 58)], fill=CORAL + (255,), width=4)


def roads_img(t):
    cw, chh = 960, 460
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    items = [('谱减', '字变闷', _g_music, BLUE),
             ('提亮', '噪声也亮', _g_sun, (198, 148, 38)),
             ('狠压', '吃掉字头', _g_squeeze, (122, 100, 172))]
    for i, (name, cap, glyph, col) in enumerate(items):
        x = 6 + i * 318
        pa = eo_back((t - 0.08 - i * 0.13) / 0.5, 2.1)
        if pa <= 0.01:
            continue
        yy = 20 + (1 - pa) * 30
        d.rounded_rectangle([x, yy, x + 292, yy + 300], 24, fill=(255, 255, 255, 255),
                            outline=(236, 230, 219, 255), width=2)
        glyph(d, x + 146, yy + 110, col)
        f_ = F(38, 'Bold')
        tw = d.textlength(name, font=f_)
        d.text((x + 146 - tw / 2, yy + 176), name, font=f_, fill=INK)
        f2 = F(26, 'Medium')
        tw2 = d.textlength(cap, font=f2)
        d.text((x + 146 - tw2 / 2, yy + 232), cap, font=f2, fill=INK2)
        xa = clamp01((t - 0.75 - i * 0.14) / 0.28)
        if xa > 0:
            s = 24 * eo_back(xa, 2.4)
            cx, cy = x + 250, yy + 46
            d.line([(cx - s, cy - s), (cx + s, cy + s)], fill=CORAL + (255,), width=7)
            d.line([(cx + s, cy - s), (cx - s, cy + s)], fill=CORAL + (255,), width=7)
    return im


# ---------------------------------------------------------------- 图示：对话气泡

def _bubble(im, x, y, w, h, fill, tail, a=1.0):
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    al = int(255 * a)
    d.rounded_rectangle([x, y, x + w, y + h], 28, fill=fill + (al,))
    tx = x + (28 if tail == 'l' else w - 28)
    d.polygon([(tx, y + h - 28), (tx + (-22 if tail == 'l' else 22), y + h + 18),
               (tx + (22 if tail == 'l' else -22), y + h - 28)], fill=fill + (al,))
    im.alpha_composite(lay)


def bubbles_img(t):
    cw, chh = 960, 560
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    rows = [('l', '关掉警告，我也装了', (236, 232, 223), 26),
            ('r', '谢谢你，这条我记下了', (206, 238, 230), 152),
            ('l', '男声有点沙，像有风', (236, 232, 223), 278),
            ('r', '在查了，今天给你结果', (255, 224, 212), 404)]
    met = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
    for i, (side, txt, col, y) in enumerate(rows):
        a = clamp01((t - 0.10 - i * 0.26) / 0.40)
        if a <= 0.01:
            continue
        f_ = F(31, 'Medium')
        tw = met.textlength(txt, font=f_)
        bw = int(tw) + 64
        x = 16 if side == 'l' else cw - bw - 16
        dy = (1 - eo_back(a, 1.6)) * 22
        _bubble(im, x, y + dy, bw, 80, col, side, a)
        ImageDraw.Draw(im).text((x + 32, y + dy + 22), txt, font=f_, fill=INK)
    return im


# ---------------------------------------------------------------- 图示：187 个声音

VOICE_W, VOICE_H = 960, 620


def _wave(d, x, y, w, h, seed, col, lw=3):
    rng = np.random.default_rng(seed)
    n = 26
    amps = np.abs(rng.normal(0.55, 0.22, n)).clip(0.15, 1.0)
    for i in range(n):
        xx = x + w * i / (n - 1)
        hh = h * amps[i] / 2
        d.line([(xx, y + h / 2 - hh), (xx, y + h / 2 + hh)], fill=col + (255,), width=lw)


def _heart(d, cx, cy, s, col, a=1.0):
    al = int(255 * a)
    r = s * 0.32
    d.ellipse([cx - s * 0.5, cy - s * 0.34, cx - s * 0.5 + 2 * r, cy - s * 0.34 + 2 * r], fill=col + (al,))
    d.ellipse([cx + s * 0.5 - 2 * r, cy - s * 0.34, cx + s * 0.5, cy - s * 0.34 + 2 * r], fill=col + (al,))
    d.polygon([(cx - s * 0.5, cy - s * 0.06), (cx + s * 0.5, cy - s * 0.06), (cx, cy + s * 0.62)],
              fill=col + (al,))


def voices_img(t):
    """6 × 4 个声线小卡：先依次亮起，再删掉两个，其中一个被圈成心头好。"""
    im = Image.new('RGBA', (VOICE_W, VOICE_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cols, rows = 6, 4
    tw, th, gap = 140, 96, 14
    ox = (VOICE_W - (cols * tw + (cols - 1) * gap)) / 2
    oy = 44
    heart_i = 9
    del_idx = (3, 16)
    for r in range(rows):
        for c in range(cols):
            i = r * cols + c
            a = clamp01((t - 0.06 - i * 0.016) / 0.34)
            if a <= 0.01:
                continue
            x = ox + c * (tw + gap)
            y = oy + r * (th + gap)
            sc = eo_back(a, 1.7)
            ww, hh = tw * (0.82 + 0.18 * sc), th * (0.82 + 0.18 * sc)
            x += (tw - ww) / 2
            y += (th - hh) / 2
            gone = 1.0
            if i in del_idx:
                gone = 1.0 - clamp01((t - 2.05) / 0.42)
                if gone <= 0.02:
                    continue
            fill = (255, 255, 255) if i != heart_i else (255, 248, 244)
            d.rounded_rectangle([x, y, x + ww, y + hh], 18, fill=fill + (int(255 * gone),),
                                outline=(233, 226, 213, int(255 * gone)), width=2)
            col = (CORAL if i % 5 == 0 else (TEAL if i % 3 == 0 else (152, 148, 140)))
            _wave(d, x + 18, y + 26, ww - 36, hh - 46, seed=i + 3, col=col, lw=2)
            if i in del_idx:
                xa = clamp01((t - 2.05) / 0.3)
                if xa > 0:
                    d.line([(x + 18, y + hh / 2), (x + ww - 18, y + hh / 2)],
                           fill=(190, 76, 56, int(230 * xa)), width=3)
            if i == heart_i:
                ha = clamp01((t - 2.55) / 0.4)
                if ha > 0:
                    hs = 34 * eo_back(ha, 2.2)
                    _heart(d, x + ww - 30, y + 26, hs, CORAL, ha)
                    pl = (math.sin(min(1.0, clamp01((t - 2.9) / 0.7)) * math.pi)) * 18
                    d.rounded_rectangle([x - 3 - pl * 0.2, y - 3 - pl * 0.2,
                                         x + ww + 3 + pl * 0.2, y + hh + 3 + pl * 0.2],
                                        20, outline=CORAL + (int(150 * ha),), width=3)

    la = clamp01((t - 2.9) / 0.45)
    if la > 0:
        f_ = F(23, 'Medium')
        d.text((60, 500), '划掉的两个：不合耳，直接删', font=f_, fill=(176, 172, 162, int(255 * la)))
        d.text((60, 540), '除男女主原版固定，其余名单你自己定', font=f_, fill=(176, 172, 162, int(255 * la)))
    return im


# ---------------------------------------------------------------- 图示：七种格式
FMT_ITEMS = [('TXT', 0), ('EPUB', 0), ('PDF', 0), ('DOCX', 1),
             ('MOBI', 1), ('AZW3', 1), ('ZIP', 1)]
FMT_H = 336


def fmt_img(t):
    cw, chh = 960, FMT_H
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    bw, bh, gap = 214, 96, 22
    for i, (name, new) in enumerate(FMT_ITEMS):
        col, row = i % 4, i // 4
        x = 16 + col * (bw + gap)
        y = 42 + row * (bh + 34)
        a = clamp01((t - 0.10 - i * 0.075) / 0.34)
        if a <= 0.01:
            continue
        dy = (1 - a) * 16
        if new:
            fill = (233, 246, 242, int(255 * a))
            bd = TEAL + (int(255 * a),)
        else:
            fill = (255, 255, 255, int(246 * a))
            bd = (228, 221, 209, int(255 * a))
        d.rounded_rectangle([x, y + dy, x + bw, y + dy + bh], 22, fill=fill, outline=bd, width=3)
        f_ = F(36, 'Black' if new else 'Bold')
        col_t = TEAL if new else INK2
        tw = d.textlength(name, font=f_)
        d.text((x + 26, y + dy + 30), name, font=f_, fill=col_t + (int(255 * a),))
        if new:
            # 右上角打勾
            cx, cy = x + bw - 34, y + dy + 30
            d.ellipse([cx - 17, cy - 17, cx + 17, cy + 17], fill=TEAL + (int(240 * a),))
            d.line([(cx - 8, cy + 1), (cx - 2, cy + 8), (cx + 9, cy - 7)],
                   fill=(255, 255, 255, int(255 * a)), width=4, joint='curve')
    if t > 0.72:
        a = clamp01((t - 0.72) / 0.4)
        d.text((18, chh - 46), '绿勾的是这回新加的四种', font=F(23, 'Medium'),
               fill=INK3 + (int(230 * a),))
    return im


# ---------------------------------------------------------------- 图示：压缩包

def zipbox_img(t):
    cw, chh = 960, 424
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 左边的压缩包
    a0 = clamp01((t - 0.05) / 0.36)
    if a0 > 0.01:
        bx, by, bwd, bhh = 112, 86, 236, 214
        d.rounded_rectangle([bx, by, bx + bwd, by + bhh], 20,
                            fill=(255, 252, 246, int(250 * a0)), outline=(214, 205, 190, int(255 * a0)), width=3)
        zx = bx + bwd / 2 - 16
        d.rounded_rectangle([zx, by + 18, zx + 32, by + bhh - 18], 8,
                            fill=(247, 240, 226, int(255 * a0)))
        for k in range(7):
            yy = by + 30 + k * 25
            d.rectangle([zx + 5, yy, zx + 27, yy + 12], fill=(196, 186, 168, int(255 * a0)))
        d.text((bx + 20, by + bhh - 60), '.zip', font=F(40, 'Black'), fill=INK + (int(255 * a0),))
        d.text((bx + 20, by + 20), '一包书', font=F(25, 'Bold'), fill=CORAL + (int(255 * a0),))
    # 中间的箭头
    aa = clamp01((t - 0.30) / 0.30)
    if aa > 0.01:
        d.line([(382, 192), (452, 192)], fill=TEAL + (int(220 * aa),), width=4)
        d.polygon([(458, 192), (438, 180), (438, 204)], fill=TEAL + (int(230 * aa),))
    # 右边飞出去的几本
    outs = [(492, 44, '合集 01'), (492, 158, '合集 02'), (492, 272, '合集 03')]
    for i, (tx, ty, lab) in enumerate(outs):
        a = clamp01((t - 0.42 - i * 0.13) / 0.40)
        if a <= 0.01:
            continue
        x = 480 + 18 * eo_quart(a)
        y = 192 + (ty + 12 - 192) * eo_quart(a)
        d.rounded_rectangle([x, y, x + 316, y + 88], 14,
                            fill=(255, 255, 255, int(250 * a)), outline=(226, 219, 205, int(255 * a)), width=2)
        d.rounded_rectangle([x, y, x + 12, y + 88], 6, fill=TEAL + (int(235 * a),))
        d.text((x + 30, y + 13), lab, font=F(26, 'Bold'), fill=INK + (int(255 * a),))
        d.text((x + 30, y + 50), '第 %d 本 · 自动进书架' % (i + 1), font=F(21, 'Medium'),
               fill=INK3 + (int(240 * a),))
    if t > 1.05:
        a = clamp01((t - 1.05) / 0.4)
        d.text((18, chh - 40), '内存里解开，不往你的文件夹写一个字节', font=F(23, 'Medium'),
               fill=INK3 + (int(235 * a),))
    return im


# ---------------------------------------------------------------- 图示：英文被剪断

SPLIT_H = 430


def split_img(t):
    cw, chh = 960, SPLIT_H
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 上半：被剪断
    a1 = clamp01((t - 0.06) / 0.34)
    if a1 > 0.01:
        d.rounded_rectangle([16, 18, cw - 16, 196], 22,
                            fill=(253, 244, 242, int(245 * a1)), outline=(226, 190, 182, int(255 * a1)), width=2)
        d.text((42, 34), '以前 · 按字数硬切', font=F(24, 'Bold'), fill=CORAL + (int(255 * a1),))
        f_ = F(40, 'Bold')
        d.text((42, 82), 'This is a senten', font=f_, fill=INK + (int(255 * a1),))
        # 剪断处
        cut = 42 + d.textlength('This is a senten', font=f_)
        pa = clamp01((t - 0.34) / 0.3)
        if pa > 0:
            d.line([(cut + 6, 76 - 30 * (1 - pa)), (cut + 6, 76 + 54 + 30 * (1 - pa))],
                   fill=CORAL + (int(255 * pa),), width=4)
        d.text((cut + 16, 82), 'ce that goes on', font=f_, fill=(196, 74, 52, int(255 * a1)))
        if t > 0.52:
            a = clamp01((t - 0.52) / 0.3)
            d.text((42, 142), '半个词 → 模型吐静音 → 连着两次就熔断，后面全跳',
                   font=F(24, 'Medium'), fill=CORAL + (int(240 * a),))
    # 下半：整整齐齐
    a2 = clamp01((t - 0.46) / 0.36)
    if a2 > 0.01:
        d.rounded_rectangle([16, 220, cw - 16, 372], 22,
                            fill=(240, 249, 246, int(245 * a2)), outline=(176, 214, 202, int(255 * a2)), width=2)
        d.text((42, 236), '现在 · 按 . ! ? 分句，按空格累加', font=F(24, 'Bold'), fill=TEAL + (int(255 * a2),))
        f_ = F(40, 'Bold')
        d.text((42, 282), 'This is a sentence that goes on.', font=f_, fill=INK + (int(255 * a2),))
        if t > 0.86:
            a = clamp01((t - 0.86) / 0.35)
            d.text((42, 330), '一个词都不切', font=F(24, 'Bold'), fill=TEAL + (int(245 * a),))
    if t > 1.2:
        a = clamp01((t - 1.2) / 0.4)
        d.text((18, chh - 30), '硬切点也只在长度的 0.4 倍之后，宁可留长也不切在词里',
               font=F(22, 'Medium'), fill=INK3 + (int(225 * a),))
    return im


# ---------------------------------------------------------------- 图示：死循环 + 锁

def loop_img(t):
    cw, chh = 960, 380
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    a0 = clamp01((t - 0.05) / 0.4)
    if a0 <= 0.01:
        return im
    cx, cy, r = 250, 190, 108
    # 打转的箭头
    for k in range(46):
        ang = -math.pi / 2 + k * (2 * math.pi / 46)
        prog = clamp01((t - 0.15 - k * 0.018) / 0.2)
        if prog <= 0:
            continue
        rr = r
        x0 = cx + math.cos(ang) * rr
        y0 = cy + math.sin(ang) * rr
        d.ellipse([x0 - 5, y0 - 5, x0 + 5, y0 + 5],
                  fill=CORAL + (int(200 * prog * a0),))
    # 箭头头部
    ha = clamp01((t - 0.9) / 0.3)
    if ha > 0:
        ang = -math.pi / 2 - 0.24
        hx, hy = cx + math.cos(ang) * r, cy + math.sin(ang) * r
        d.polygon([(hx + 20, hy + 6), (hx - 4, hy - 18), (hx - 10, hy + 14)],
                  fill=CORAL + (int(245 * ha),))
    d.text((cx - 42, cy - 26), 'i = j', font=F(44, 'Black'), fill=INK + (int(255 * a0),))
    d.text((cx - 74, cy + 40), '原地不动', font=F(24, 'Bold'), fill=CORAL + (int(255 * a0),))

    # 右边的锁
    a1 = clamp01((t - 0.5) / 0.38)
    if a1 > 0.01:
        lx, ly = 640, 96
        d.arc([lx + 34, ly - 4, lx + 116, ly + 78], 180, 360, fill=INK2 + (int(255 * a1),), width=10)
        d.rounded_rectangle([lx, ly + 52, lx + 150, ly + 176], 18,
                            fill=(255, 255, 255, int(250 * a1)), outline=INK2 + (int(255 * a1),), width=3)
        d.ellipse([lx + 64, ly + 86, lx + 86, ly + 108], fill=INK2 + (int(255 * a1),))
        d.rectangle([lx + 71, ly + 104, lx + 79, ly + 132], fill=INK2 + (int(255 * a1),))
        d.text((lx - 6, ly + 190), '旁白那把锁', font=F(25, 'Bold'), fill=INK + (int(255 * a1),))
    if t > 0.95:
        a2 = clamp01((t - 0.95) / 0.4)
        d.text((596, 322), '一句英文，拖死后头所有中文', font=F(22, 'Medium'),
               fill=CORAL + (int(240 * a2),))
    return im


# ---------------------------------------------------------------- 图示：耗时对比

def bars_img(t):
    cw, chh = 960, 344
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, maxw = 264, 480
    rows = [('以前 · 一句英文', 40.0, CORAL, '40 秒超时', 1, 'Bold'),
            ('现在 · 英文句', 5.3, TEAL, '5.3 秒', 0, 'Bold'),
            ('接着念中文', 1.4, BLUE, '1.4 秒', 0, 'Medium')]
    for i, (lab, val, col, tag, over, wt) in enumerate(rows):
        y = 46 + i * 92
        a = clamp01((t - 0.10 - i * 0.20) / 0.42)
        if a <= 0.01:
            continue
        d.text((18, y + 4), lab, font=F(23, wt), fill=(INK if wt == 'Bold' else INK2) + (int(255 * a),))
        wv = maxw * min(1.0, val / 8.0) * eo_quart(a)
        hh = 38
        d.rounded_rectangle([x0, y, x0 + max(8, int(wv)), y + hh], 11, fill=col + (int(238 * a),))
        if over:
            for k in range(5):
                xx = x0 + int(wv) - 52 + k * 10
                d.rectangle([xx, y + 6, xx + 5, y + hh - 6], fill=(255, 252, 248, int(230 * a)))
        # 数字一律右对齐，绝不越过画面右边
        f_ = F(30, 'Black')
        tw = d.textlength(tag, font=f_)
        d.text((936 - tw, y + 1), tag, font=f_, fill=col + (int(255 * a),))
    if t > 0.95:
        a = clamp01((t - 0.95) / 0.4)
        d.text((18, chh - 44), '安卓模拟器 x86 实测，真机数字还要看你的手机',
               font=F(22, 'Medium'), fill=INK3 + (int(230 * a),))
    return im


# ---------------------------------------------------------------- 图示：扫描件

def scan_img(t):
    cw, chh = 960, 440
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 左：只有水印
    a0 = clamp01((t - 0.06) / 0.36)
    if a0 > 0.01:
        px, py, pw, ph = 96, 30, 230, 320
        d.rectangle([px, py, px + pw, py + ph], fill=(255, 255, 255, int(250 * a0)),
                    outline=(222, 214, 200, int(255 * a0)), width=2)
        for r in range(8):
            for c in range(2):
                d.text((px + 12 + c * 114, py + 18 + r * 37), '加微信领书',
                       font=F(16, 'Bold'), fill=(214, 200, 182, int(210 * a0)))
        d.text((px + 96, py + ph - 26), '— 1 —', font=F(16, 'Medium'), fill=(206, 198, 184, int(220 * a0)))
        d.text((px + 30, py + ph + 18), '屏幕上只有这个', font=F(23, 'Bold'), fill=CORAL + (int(245 * a0),))
    # 箭头
    aa = clamp01((t - 0.42) / 0.32)
    if aa > 0.01:
        d.line([(368, 190), (438, 190)], fill=INK3 + (int(230 * aa),), width=4)
        d.polygon([(438, 190), (418, 178), (418, 202)], fill=INK3 + (int(230 * aa),))
    # 右：真实那一页
    a1 = clamp01((t - 0.58) / 0.4)
    if a1 > 0.01:
        px, py, pw, ph = 500, 30, 250, 320
        d.rectangle([px, py, px + pw, py + ph], fill=(252, 250, 246, int(252 * a1)),
                    outline=(206, 198, 184, int(255 * a1)), width=2)
        # 一页"扫描图"：灰底 + 几行深浅不一的墨迹
        rng = np.random.default_rng(7)
        lay = Image.new('RGBA', (pw - 14, ph - 14), (250, 248, 243, 255))
        dd = ImageDraw.Draw(lay)
        for r in range(18):
            yy = 8 + r * 16
            ww = int((pw - 56) * (0.52 + 0.44 * rng.random()))
            dd.rectangle([8, yy, 8 + ww, yy + 6], fill=(104, 100, 94, 110 + int(70 * rng.random())))
        lay = lay.rotate(-1.1, resample=Image.BICUBIC, expand=False)
        im.paste(lay, (px + 7, py + 7), lay)
        d.text((px + 14, py + ph - 24), '— 137 —', font=F(15, 'Medium'), fill=(150, 144, 132, int(230 * a1)))
        d.text((px + 14, py + ph + 18), '给你看真的那一页', font=F(23, 'Bold'), fill=TEAL + (int(245 * a1),))
    return im


# ---------------------------------------------------------------- 图示：体积构成

def size_img(t):
    cw, chh = 960, 330
    im = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    segs = [('187 人声库', 58.6, CORAL), ('英文模型', 35.7, TEAL),
            ('主角 · 女', 17.8, BLUE), ('主角 · 男', 17.8, (120, 92, 178)),
            ('推理引擎', 21.2, (150, 142, 128))]
    total = sum(s[1] for s in segs)
    x0, barw, y0, hh = 20, 916, 46, 72
    acc = 0.0
    for i, (lab, mb, col) in enumerate(segs):
        a = clamp01((t - 0.10 - i * 0.14) / 0.40)
        if a <= 0.01:
            continue
        wv = barw * (mb / total) * eo_quart(a)
        xx = x0 + barw * (acc / total)
        d.rounded_rectangle([xx + 2, y0, xx + max(4, int(wv)) - 2, y0 + hh], 8, fill=col + (int(240 * a),))
        acc += mb
    if t > 0.35:
        a = clamp01((t - 0.35) / 0.4)
        d.text((x0 + 6, y0 + hh + 22), '合计约 %.0f MB' % total, font=F(28, 'Black'),
               fill=INK + (int(255 * a),))
    # 图例两列
    for i, (lab, mb, col) in enumerate(segs):
        a = clamp01((t - 0.5 - i * 0.10) / 0.34)
        if a <= 0.01:
            continue
        col_i, row_i = i % 2, i // 2
        lx = x0 + col_i * 470
        ly = 196 + row_i * 44
        d.ellipse([lx, ly + 6, lx + 18, ly + 24], fill=col + (int(240 * a),))
        d.text((lx + 30, ly), '%s  %.1f MB' % (lab, mb), font=F(23, 'Medium'),
               fill=INK2 + (int(250 * a),))
    return im


# ---------------------------------------------------------------- 分镜

SCENES = [
    dict(k='hook', dur=4.4),
    dict(k='card', dur=5.4, tab='这回能读什么',
         head=['七种格式', '拖进来就行'],
         dia='fmt', cap='TXT · EPUB · PDF 一直在',
         note='DOCX / MOBI / AZW3 / ZIP 是这回补的', note_coral=1),
    dict(k='card', dur=5.2, tab='压缩包',
         head=['一包 txt', '整包丢进来'],
         dia='zipbox', cap='只认书：图片、说明、Mac 资源叉自动跳过',
         note='单本 300 MB 上限，一次最多 300 本'),
    dict(k='card', dur=5.8, tab='安卓念英文 · 错在哪',
         head=['每一刀', '都切在单词中间'],
         dia='split', cap='整段英文被当成一个巨型句子，按字数硬切',
         note='模型遇到半个词吐静音，连两次就熔断', note_coral=1),
    dict(k='card', dur=5.2, tab='第一次判断，错了',
         head=['真正的死因', '是个死循环'],
         dia='loop', cap='句末标点表里有句点，跳过标点的表里没有',
         note='上一版加的互斥，白加了'),
    dict(k='card', dur=4.8, tab='修好之后',
         head=['英文 5.3 秒', '中文接着念'],
         dia='bars', cap='以前是一句英文 40 秒超时', note='模拟器实测，真机看你的手机'),
    dict(k='card', dur=5.4, tab='扫描件 PDF',
         head=['满屏水印', '一页正文都没有'],
         dia='scan', cap='整页是图、字又少 → 按扫描件打开',
         note='会明说：这层字只有水印，要听书得先 OCR'),
    dict(k='pills', dur=5.0, tab='顺手做的',
         head=['冷启动 · 换声线'],
         pills=[('翻开书才建引擎', '打开软件不再干等十几秒', TEAL),
                ('换声线不再停读', '没出声就只丢这一句', CORAL),
                ('英文词单独念', 'C-P-U 也能一个个念出来', BLUE)]),
    dict(k='card', dur=5.4, tab='试过、也放弃了',
         head=['安装包太大', '我不改了'],
         dia='size', cap='16k / 22k 的多人轻量库都试过，音质不能用',
         note='砍到只留男女主，就撑不起「187 个里挑一个」', note_coral=1),
    dict(k='outro', dur=6.2),
]

TOTAL = sum(int(s['dur'] * FPS) for s in SCENES)
N_SCENE = len(SCENES)

MARGIN = 76
HEAD_LH = 96
HEAD_SIZE = 78

DIA_H = dict(meters=520, comb_m=COMB_H, comb_f=COMB_H, thresh=440, roads=460,
             bubbles=560, voices=VOICE_H, dn=320,
             fmt=FMT_H, zipbox=424, split=SPLIT_H, loop=380, bars=344,
             scan=440, size=330)


# ---------------------------------------------------------------- 预渲染

def scene_pre(sc, idx):
    p = dict(idx=idx)
    if sc['k'] in ('hook', 'outro'):
        return p
    p['tab'] = pill_el(sc['tab'], 27, INK, (255, 255, 255), (233, 226, 214))
    p['head'] = [(line, T([(line, INK)], HEAD_SIZE, 'Black')) for line in sc.get('head', [])]
    if sc.get('cap'):
        p['cap'] = T([(sc['cap'], INK if sc.get('cap_ink') else INK2)], 33,
                     'Bold' if sc.get('cap_ink') else 'Medium')
    if sc.get('note'):
        p['note'] = T([(sc['note'], CORAL if sc.get('note_coral') else INK3)], 27,
                      'Bold' if sc.get('note_coral') else 'Medium')
    if sc.get('big'):
        p['big'] = T([(sc['big'], CORAL)], 196, 'Black')
        p['big_hl'] = hl_el(int(p['big'][1]) + 26, 118, YEL, 200)
    if sc.get('chips'):
        p['chips'] = [pill_el(c, 31, INK, (255, 255, 255), (230, 223, 211), 30, 18) for c in sc['chips']]
    if sc.get('pills'):
        p['pills'] = [(pill_el(n, 34, INK, (255, 255, 255), (230, 223, 211), 30, 18), sub, col)
                      for n, sub, col in sc['pills']]

    # 竖向节律：整块内容居中，底部留出地址栏
    h = p['tab'][1].shape[0] + 40
    h += HEAD_LH * len(p['head'])
    if sc['k'] == 'word':
        h += 36 + 200 + 44
    if p.get('cap'):
        h += 56
    if sc.get('dia'):
        h += 40 + DIA_H[sc['dia']]
    if p.get('chips'):
        h += 46 + 92
    if p.get('pills'):
        h += 44 + 3 * 168
    if sc.get('note'):
        h += 44
    p['top'] = max(300, int((H - h) / 2) - 26)
    return p


_WM = {}


def seal_el(size=180):
    """朱红小印：纸面上的落款。"""
    s = size
    im = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 4, s - 5, s - 5], int(s * 0.08), fill=(198, 62, 46, 236))
    d.rounded_rectangle([int(s * 0.075), int(s * 0.075), s - int(s * 0.08), s - int(s * 0.08)],
                        int(s * 0.05), outline=(255, 246, 240, 238), width=max(2, int(s * 0.015)))
    f = F(int(s * 0.32), 'Black')
    grid = [('永', 0, 0), ('远', 1, 0), ('兰', 0, 1), ('兰', 1, 1)]
    for ch, cx, cy in grid:
        bb = d.textbbox((0, 0), ch, font=f)
        w, h = bb[2] - bb[0], bb[3] - bb[1]
        x = s * 0.13 + cx * s * 0.39 + (s * 0.35 - w) / 2 - bb[0]
        y = s * 0.15 + cy * s * 0.38 + (s * 0.36 - h) / 2 - bb[1]
        d.text((x, y), ch, font=f, fill=(255, 248, 244))
    im = im.rotate(-7, resample=Image.BICUBIC, expand=False)
    return to_el(im)


SEAL = seal_el(180)


def watermark_el(n):
    """右下角的大号章节数字，极淡，像印刷页码。"""
    if n in _WM:
        return _WM[n]
    s = n if isinstance(n, str) else '%02d' % n
    size = 300 if not isinstance(n, str) else 260
    f = F(size, 'Black')
    tmp = Image.new('RGBA', (10, 10))
    asc, desc = f.getmetrics()
    tw = int(ImageDraw.Draw(tmp).textlength(s, font=f))
    im = Image.new('RGBA', (tw + 20, asc + desc + 10), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10, 0), s, font=f, fill=INK + (26,))
    el = to_el(im)
    _WM[n] = el
    return el


_txt_corner = None


def corner_el():
    global _txt_corner
    if _txt_corner is None:
        _txt_corner = T([('墨吟  ', INK2), ('v1.14.35', CORAL)], 24, 'Bold')
    return _txt_corner


# ---------------------------------------------------------------- 绘制

def _draw_dia(cur, kind, t, x, y, a):
    if kind == 'meters':
        img = meters_img(t)
    elif kind == 'comb_m':
        img = comb_img(t, 130, 1800, 104, 'm', '-54.0')
    elif kind == 'comb_f':
        img = comb_img(t, 210, 3900, 130, 'f', '-50.7')
    elif kind == 'thresh':
        img = thresh_img(t)
    elif kind == 'roads':
        img = roads_img(t)
    elif kind == 'bubbles':
        img = bubbles_img(t)
    elif kind == 'voices':
        img = voices_img(t)
    elif kind == 'dn':
        img = dn_img(t)
    elif kind == 'fmt':
        img = fmt_img(t)
    elif kind == 'zipbox':
        img = zipbox_img(t)
    elif kind == 'split':
        img = split_img(t)
    elif kind == 'loop':
        img = loop_img(t)
    elif kind == 'bars':
        img = bars_img(t)
    elif kind == 'scan':
        img = scan_img(t)
    elif kind == 'size':
        img = size_img(t)
    else:
        return 0
    blend(cur, to_el(img), x, y, a)
    return img.height


def scene_h(cur, sc, t, p):
    idx = p['idx']

    # ---- 开场
    if sc['k'] == 'hook':
        el, tw = T([('又见面了 · 这七天', INK2)], 34, 'Medium')
        a0 = eo_expo(t / 0.4)
        blend(cur, el, MARGIN, 536 + (1 - a0) * 16, a0)

        l1 = T([('七版连在一起，', INK)], 92, 'Black')
        l2 = T([('只干了一件事', INK)], 92, 'Black')

        hp = eo_quart((t - 0.35) / 0.55)
        if hp > 0:
            w1 = int(l1[1] * hp)
            if w1 > 8:
                blend(cur, hl_el(w1, 64, YEL, 200), MARGIN - 10, 628, 1.0)
        a1 = eo_expo((t - 0.15) / 0.5)
        blend(cur, l1[0], MARGIN, 614 + (1 - a1) * 24, a1)

        hp2 = eo_quart((t - 0.95) / 0.6)
        if hp2 > 0:
            w2 = int(l2[1] * hp2)
            if w2 > 8:
                blend(cur, hl_el(w2, 64, YEL, 200), MARGIN - 10, 748, 1.0)
        a2 = eo_expo((t - 0.72) / 0.5)
        blend(cur, l2[0], MARGIN, 734 + (1 - a2) * 24, a2)

        a3 = eo_expo((t - 1.45) / 0.55)
        el, tw = T([('让它能读的书，真的变多', INK2)], 34, 'Medium')
        blend(cur, el, MARGIN, 878 + (1 - a3) * 14, a3)

        a4 = eo_expo((t - 1.85) / 0.5)
        el, tw = T([('顺手把一个做错两次的 bug 修了', INK3)], 30, 'Medium')
        blend(cur, el, MARGIN, 942, a4)

        # 一张全宽卡片：上次 3 种 → 这次 7 种
        sq = clamp01((t - 1.0) / 0.7)
        if sq > 0:
            cw, chh = 928, 372
            lay = Image.new('RGBA', (cw, chh), (0, 0, 0, 0))
            d = ImageDraw.Draw(lay)
            d.text((34, 30), '上次能开的', font=F(23, 'Medium'), fill=INK2)
            d.text((34, 200), '这次能开的', font=F(23, 'Medium'), fill=INK2)
            for i, name in enumerate(['TXT', 'EPUB', 'PDF']):
                x, y = 34 + i * 108, 74
                d.rounded_rectangle([x, y, x + 96, y + 60], 14, fill=(244, 240, 230, 255),
                                    outline=(226, 218, 204, 255), width=2)
                d.text((x + 16, y + 14), name, font=F(26, 'Bold'), fill=INK3)
            for i, name in enumerate(['TXT', 'EPUB', 'PDF', 'DOCX', 'MOBI', 'AZW3', 'ZIP']):
                x, y = 34 + (i % 4) * 108, 244 + (i // 4) * 74
                new = i >= 3
                d.rounded_rectangle([x, y, x + 96, y + 60], 14,
                                    fill=(234, 246, 242, 255) if new else (244, 240, 230, 255),
                                    outline=TEAL + (255,) if new else (226, 218, 204, 255), width=2)
                d.text((x + 16, y + 14), name, font=F(26, 'Bold'), fill=TEAL if new else INK3)
            d.line([(500, 104), (500, 300)], fill=(226, 218, 204, 255), width=2)
            d.text((560, 150), '3 → 7', font=F(84, 'Black'), fill=CORAL)
            d.text((560, 246), '新加四种，全在绿框里', font=F(24, 'Medium'), fill=INK2)
            put_card(cur, cw, chh, MARGIN - 6, 1024, sq * 0.97, (255, 255, 255), (232, 225, 213), 26, 16)
            blend(cur, to_el(lay), MARGIN - 6, 1024, sq * 0.97)
        return

    # ---- 结尾
    if sc['k'] == 'outro':
        a = eo_expo(t / 0.5)
        el, tw = T([('更新地址', INK2)], 30, 'Medium')
        blend(cur, el, MARGIN, 292, a)

        n = int(len(URL_MAIN) * clamp01((t - 0.25) / 0.9))
        if n:
            el2, _ = T([(URL_MAIN[:n], INK)], 41, 'Bold')
            blend(cur, el2, MARGIN, 344, 1.0)
        full, tw = T([(URL_MAIN, INK)], 41, 'Bold')
        uw = int(min(tw + 14, 892) * clamp01((t - 0.15) / 0.7))
        if uw > 6:
            blend(cur, hl_el(uw, 54, YEL, 195), MARGIN - 8, 358, 1.0)

        a1 = clamp01((t - 0.85) / 0.4)
        if a1 > 0:
            cur[470:472, MARGIN:MARGIN + int(928 * a1)] = np.array(SOFT, np.float32)

        el, tw = T([('Windows  ·  安卓  ·  单文件网页版（浏览器直接开）', INK2)], 30, 'Medium')
        blend(cur, el, MARGIN, 512, eo_expo((t - 1.0) / 0.5))

        for i, (s, c) in enumerate([('单文件 · 零联网 · 数据只在本机', INK),
                                    ('MIT 开源 · 永久免费', TEAL)]):
            aa = eo_expo((t - 1.35 - i * 0.22) / 0.5)
            el, tw = T([(s, c)], 38, 'Black')
            blend(cur, el, MARGIN, 580 + i * 60, aa)

        el, tw = T([('1.14.35 已经发出去了', CORAL)], 44, 'Black')
        blend(cur, el, MARGIN, 736, eo_expo((t - 2.0) / 0.55))

        el, tw = T([('明天再想想：没什么要动的，就换下一个软件。', INK3)], 30, 'Medium')
        blend(cur, el, MARGIN, 812, eo_expo((t - 2.3) / 0.55))

        # 极淡的 07，回扣「七版七天」
        ga = clamp01((t - 2.45) / 0.6)
        if ga > 0:
            gwm = watermark_el('07')
            blend(cur, gwm, W - gwm[1].shape[1] - 24, 856, ga)
            el, tw = T([('七版，七天，一件事', INK3)], 27, 'Medium')
            blend(cur, el, W - 44 - tw, 1176, clamp01((t - 2.7) / 0.5))

        # 落款：红印 + 两行小字（不放二维码，避免被平台判成导流）
        sa = clamp01((t - 2.6) / 0.5)
        if sa > 0:
            q = eo_back(sa, 2.0)
            blend(cur, SEAL, MARGIN, 1330 - (1 - q) * 30, clamp01(sa * 1.6))
            el, tw = T([('永远的兰兰', INK)], 38, 'Black')
            blend(cur, el, MARGIN + 220, 1366, clamp01(sa * 1.4))
            el, tw = T([('一个人的项目  ·  MIT 开源', INK3)], 28, 'Medium')
            blend(cur, el, MARGIN + 220, 1424, clamp01(sa * 1.4))

        el, tw = T([('© 永远的兰兰  ·  Lanlan Eternal', INK3)], 26, 'Medium')
        blend(cur, el, MARGIN, H - 210, eo_expo((t - 3.0) / 0.6))
        return

    # ---- 通用屏
    y = p['top']

    pa = eo_back((t + 0.06) / 0.34, 1.7)
    el = p['tab']
    blend(cur, el, MARGIN - 6 - (1 - pa) * 20, y, clamp01((t + 0.04) / 0.12))
    y += el[1].shape[0] + 40

    # 标题左对齐
    for i, (line, tel) in enumerate(p['head']):
        a = eo_expo((t + 0.02 - i * 0.09) / 0.36)
        if i == 0 and sc['k'] == 'card' and (not sc.get('dia') or sc.get('dia') == 'dn'):
            hp = eo_quart((t - 0.26) / 0.5)
            if hp > 0:
                w = int(tel[1] * hp)
                if w > 8:
                    blend(cur, hl_el(w, 60, YEL, 195), MARGIN - 8, y + 12, 1.0)
        blend(cur, tel[0], MARGIN - (1 - a) * 26, y + (1 - a) * 20, a)
        y += HEAD_LH

    # 掩蔽：大字（与标题同一条左基线）
    if sc['k'] == 'word':
        y += 30
        ab = eo_back((t - 0.62) / 0.55, 2.0)
        if ab > 0.01:
            hlp = eo_quart((t - 0.78) / 0.5)
            if hlp > 0:
                hs, _hsa = p['big_hl']
                hwv = int(_hsa.shape[1] * hlp)
                if hwv > 8:
                    blend(cur, (hs[:, :hwv], _hsa[:, :hwv]), MARGIN - 16, y + 26, 1.0)
            el, tw = p['big']
            blend(cur, el, MARGIN, y - 26 + (1 - ab) * 30, clamp01(ab))
        y += 200
        if p.get('cap'):
            el, tw = p['cap']
            blend(cur, el, MARGIN, y + 24, eo_expo((t - 1.25) / 0.5))
        return

    if p.get('cap') and sc.get('dia'):
        y += 0

    # 图示
    if sc.get('dia'):
        y += 40
        da = clamp01((t - 0.10) / 0.42)
        hgt = _draw_dia(cur, sc['dia'], t, MARGIN - 4, y, da)
        y += hgt
        if p.get('cap'):
            y += 44
            el, tw = p['cap']
            blend(cur, el, MARGIN, y, eo_expo((t - 0.62) / 0.44))
            y += 56
        if p.get('note'):
            el, tw = p['note']
            blend(cur, el, MARGIN, y + 8, eo_expo((t - 0.84) / 0.44))
        return

    # 药丸组
    if p.get('chips'):
        y += 46
        x = MARGIN - 6
        row_y = y
        for i, el in enumerate(p['chips']):
            a = eo_back((t - 0.24 - i * 0.09) / 0.40, 1.9)
            if a <= 0.01:
                continue
            w = el[1].shape[1]
            if x + w > W - MARGIN:
                x = MARGIN - 6
                row_y += 84
            blend(cur, el, x, row_y + (1 - a) * 14, clamp01(a))
            x += w + 16
        y = row_y + 74

    if p.get('pills'):
        y += 44
        for i, (el, sub, col) in enumerate(p['pills']):
            a = eo_back((t - 0.18 - i * 0.13) / 0.44, 1.85)
            if a <= 0.01:
                continue
            yy = int(y + i * 168 + (1 - a) * 22)
            put_card(cur, 916, 140, MARGIN - 6, yy, clamp01(a) * 0.97, (255, 255, 255), (234, 227, 215), 24, 14)
            blend(cur, el, MARGIN + 28, yy + 20, clamp01(a))
            els, tw = T([(sub, INK2)], 28, 'Medium')
            blend(cur, els, MARGIN + 28, yy + 86, clamp01(a))
            if a > 0.5:
                cur[yy + 28:yy + 112, MARGIN - 3:MARGIN] = np.array(col, np.float32)
        y += 3 * 168

    if p.get('cap'):
        el, tw = p['cap']
        blend(cur, el, MARGIN, y + 30, eo_expo((t - 0.62) / 0.44))
        y += 86
    if p.get('note'):
        el, tw = p['note']
        blend(cur, el, MARGIN, y + 6, eo_expo((t - 0.84) / 0.44))


_QR = None
_QR_TRIED = False


def _qr():
    global _QR, _QR_TRIED
    if _QR_TRIED:
        return _QR
    _QR_TRIED = True
    p = os.path.join(HERE, 'qr-url.png')
    if not os.path.isfile(p):
        return None
    im = Image.open(p).convert('L').resize((248, 248), Image.NEAREST)
    a = np.asarray(im, np.float32)
    al = (255.0 - a) / 255.0
    rgb = np.zeros((248, 248, 3), np.float32)
    rgb[:] = INK
    _QR = (rgb, al * 0.97)
    return _QR


# ---------------------------------------------------------------- 音轨

def make_audio(path, duration):
    from scipy.io import wavfile
    from scipy.signal import fftconvolve

    n = int(SR * duration)
    mix = np.zeros((n, 2), np.float32)

    bpm = 112.0
    beat = 60.0 / bpm
    bar = beat * 4

    chords = [[261.63, 329.63, 392.0],
              [196.0, 246.94, 293.66],
              [220.0, 261.63, 329.63],
              [174.61, 220.0, 261.63]]
    roots = [65.41, 49.0, 55.0, 43.65]

    def marimba(f, t0, amp, dur_=0.45, pan=0.5):
        i0 = int(t0 * SR)
        ln = int(dur_ * SR)
        i1 = min(n, i0 + ln)
        if i1 <= i0:
            return
        tv = np.arange(i1 - i0, dtype=np.float32) / SR
        v = (np.sin(2 * np.pi * f * tv) * np.exp(-tv / 0.16)
             + 0.30 * np.sin(2 * np.pi * f * 2.0 * tv) * np.exp(-tv / 0.075)
             + 0.12 * np.sin(2 * np.pi * f * 3.01 * tv) * np.exp(-tv / 0.05))
        v = v.astype(np.float32) * amp
        mix[i0:i1, 0] += v * (1 - pan * 0.6)
        mix[i0:i1, 1] += v * (0.4 + pan * 0.6)

    for b in range(int(duration / bar) + 2):
        t0 = b * bar
        if t0 > duration:
            break
        ch = chords[b % 4]
        rt = roots[b % 4]
        i0 = int(t0 * SR)
        i1 = min(n, int((t0 + beat * 2.2) * SR))
        if i1 > i0:
            tv = np.arange(i1 - i0, dtype=np.float32) / SR
            v = np.sin(2 * np.pi * rt * tv) * np.exp(-tv / 0.85) * 0.50
            mix[i0:i1, 0] += v
            mix[i0:i1, 1] += v
        step = beat / 2
        k = 0
        while t0 + k * step < min(duration, t0 + bar):
            f = ch[k % 3] * (2 if (k % 5 == 4) else 1)
            marimba(f, t0 + k * step, 0.40 if k % 2 == 0 else 0.25,
                    pan=0.30 if k % 2 else 0.72)
            k += 1

    for b in range(int(duration / (beat / 2)) + 1):
        ts = b * beat / 2
        i0 = int(ts * SR)
        ln = int(0.07 * SR)
        i1 = min(n, i0 + ln)
        if i1 <= i0 or ts > duration:
            continue
        tv = np.arange(i1 - i0, dtype=np.float32) / SR
        nz = np.random.default_rng(b).normal(0, 1, i1 - i0).astype(np.float32)
        nz = np.convolve(nz, np.ones(4, np.float32) / 4, mode='same')
        env = np.exp(-tv / 0.018) * (0.09 if b % 2 else 0.15)
        mix[i0:i1, 0] += nz * env
        mix[i0:i1, 1] += nz * env * 0.9

    acc = 0
    for s in SCENES[:-1]:
        acc += s['dur']
        i0 = int((acc - 0.10) * SR)
        ln = int(0.26 * SR)
        i1 = min(n, i0 + ln)
        if i1 <= i0:
            continue
        tv = np.arange(i1 - i0, dtype=np.float32) / SR
        nz = np.random.default_rng(int(acc * 100)).normal(0, 1, i1 - i0).astype(np.float32)
        nz = np.convolve(nz, np.ones(6, np.float32) / 6, mode='same')
        env = np.exp(-tv / 0.05)
        mix[i0:i1, 0] += nz * env * 0.07
        mix[i0:i1, 1] += nz * env * 0.07

    ir_len = int(0.85 * SR)
    ir = np.random.default_rng(9).normal(0, 1, ir_len).astype(np.float32)
    ir *= np.exp(-np.arange(ir_len, dtype=np.float32) / (0.24 * SR))
    ir /= np.abs(ir).sum() / 10
    for c in range(2):
        wet = fftconvolve(mix[:, c], ir, mode='same').astype(np.float32)
        mix[:, c] = mix[:, c] * 0.88 + wet * 0.20

    fi = int(0.5 * SR)
    fo = int(1.6 * SR)
    mix[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)[:, None]
    mix[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None] ** 1.3

    peak = float(np.abs(mix).max()) or 1.0
    mix = mix / peak * 0.70
    wavfile.write(path, SR, (mix * 32767).astype(np.int16))
    return path


# ---------------------------------------------------------------- 渲染

def content_alpha(sc, t):
    """切屏要干脆：入 0.08 秒、出 0.06 秒。
    以前出入各 0.15 秒，中间会漏出约 0.3 秒的空白纸，快节奏下像卡顿。"""
    dur = sc['dur']
    if t < 0.08:
        return eo_expo(t / 0.08)
    if t > dur - 0.06:
        return 1 - clamp01((t - (dur - 0.06)) / 0.06)
    return 1.0


def render(out_path, with_audio, audio_path):
    global _LA
    cmd = [FFMPEG, '-y', '-hide_banner', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H),
           '-r', str(FPS), '-i', '-']
    if with_audio:
        cmd += ['-i', audio_path]
    cmd += ['-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
            '-maxrate', '1900k', '-bufsize', '3800k',
            '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
            '-x264-params', 'keyint=60:min-keyint=30',
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
            if sc['k'] in ('card', 'chips', 'pills', 'word'):
                wm = watermark_el(i + 1)
                blend(cur, wm, W - wm[1].shape[1] - 30, H - 470, 1.0)
            layer = np.zeros((H, W, 3), np.float32)
            lalpha = np.zeros((H, W), np.float32)
            _LA = lalpha
            scene_h(layer, sc, t, pre)
            _LA = None
            ga = content_alpha(sc, t)
            la = lalpha[..., None] * ga
            cur = cur * (1 - la) + layer * ga

            ce, cw = corner_el()
            blend(cur, ce, MARGIN, 104, 0.88)

            done += 1
            bw = int((W - MARGIN * 2) * done / TOTAL)
            if bw > 0:
                cur[H - 58:H - 53, MARGIN:MARGIN + bw] = np.array(CORAL, np.float32)
            ue, uw = T([(URL_MAIN, INK3)], 22, 'Medium')
            blend(cur, ue, MARGIN, H - 46, 0.95)

            frame = np.clip(cur, 0, 255).astype(np.uint8)
            proc.stdin.write(frame.tobytes())
        print('  场景 %02d/%02d  %-7s 完成' % (i + 1, N_SCENE, sc['k']), flush=True)
        gtime += sc['dur']

    proc.stdin.close()
    return proc.wait()


def main():
    no_audio = '--no-audio' in sys.argv
    dur = TOTAL / FPS
    print('总帧数 %d ／ %.1f 秒 ／ %d fps' % (TOTAL, dur, FPS), flush=True)

    audio = os.path.join(HERE, '_bed7.wav')
    if not no_audio:
        print('合成音轨…', flush=True)
        make_audio(audio, dur)

    outs = []
    if not no_audio:
        p1 = os.path.join(HERE, '墨吟日报-1.14.35-七版.mp4')
        print('编码有声版 →', p1, flush=True)
        if render(p1, True, audio) == 0:
            outs.append(p1)
    p2 = os.path.join(HERE, '墨吟日报-1.14.35-七版-静音.mp4')
    print('编码静音版 →', p2, flush=True)
    if render(p2, False, None) == 0:
        outs.append(p2)

    for p in outs:
        print('  完成 %s  %.2f MB' % (os.path.basename(p), os.path.getsize(p) / 1048576))
    return 0


if __name__ == '__main__':
    sys.exit(main())

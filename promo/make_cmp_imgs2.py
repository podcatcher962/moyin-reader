# -*- coding: utf-8 -*-
"""给 1.14.14–1.14.21 的进度汇报画四张对比图。

和 make_cmp_imgs.py 同一套规格：1400×560、圆角、底色贴近视频背景，
当 card 场景的截图卡用（显示宽度 950 时高约 380）。
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1400, 560
BG = (18, 20, 25)
TX = (235, 233, 229)
TX2 = (150, 156, 168)
DIM = (108, 114, 126)
ACC = (86, 160, 255)
GOLD = (216, 178, 106)
RED = (232, 108, 104)
GREEN = (110, 190, 140)
LINE = (48, 54, 66)

FBD = 'C:/Windows/Fonts/msyhbd.ttc'
FRG = 'C:/Windows/Fonts/msyh.ttc'

_f = {}


def F(size, bold=False):
    k = (size, bold)
    if k not in _f:
        _f[k] = ImageFont.truetype(FBD if bold else FRG, size, index=0)
    return _f[k]


def canvas():
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, H - 1], 26, outline=LINE, width=2)
    return im, d


def title(d, s, y=44, size=44):
    d.text((72, y), s, font=F(size, True), fill=TX)


def sub(d, s, y, color=TX2, size=30):
    d.text((72, y), s, font=F(size), fill=color)


def chip(d, x, y, s, color, size=30):
    f = F(size, True)
    bb = d.textbbox((0, 0), s, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.rounded_rectangle([x, y, x + w + 34, y + h + 22], 12,
                        fill=(color[0] // 5 + 16, color[1] // 5 + 16, color[2] // 5 + 18))
    d.text((x + 17 - bb[0], y + 11 - bb[1]), s, font=f, fill=color)
    return x + w + 34


# ---------------------------------------------------------------- ① 体积

def shot_size(path):
    im, d = canvas()
    title(d, '安装包小了 57 MB，声音反而更干净')
    y = 168
    bar_max = 720
    rows = [('8 位整数', '158 MB', 1.0, RED, '底噪滋滋 · 每句乱读几个字'),
            ('半精度 16 位', '101 MB', 101 / 158, GOLD, '字错率 11.6% · 1.0 秒/句')]
    for label, val, ratio, color, note in rows:
        d.text((72, y + 8), label, font=F(32, True), fill=TX2)
        bx = 300
        d.rounded_rectangle([bx, y, bx + int(bar_max * ratio), y + 62], 14, fill=color)
        d.text((bx + bar_max * ratio + 26, y + 2), val, font=F(42, True), fill=color)
        d.text((72, y + 76), note, font=F(27), fill=DIM)
        y += 168
    im.save(path)


# ---------------------------------------------------------------- ② 选书列表

def _row(d, x, y, name, kind, ok, w=380):
    h = 74
    d.rounded_rectangle([x, y, x + w, y + h], 14,
                        fill=(26, 29, 36), outline=(56, 62, 76) if ok else (44, 48, 56), width=2)
    col = TX if ok else (86, 90, 100)
    d.text((x + 22, y + 20), name, font=F(29, True), fill=col)
    d.text((x + w - 96, y + 24), kind, font=F(23), fill=DIM if ok else (70, 74, 84))
    m = '√' if ok else '×'
    d.text((x + w - 42, y + 16), m, font=F(32, True), fill=GREEN if ok else (140, 88, 88))
    return y + h + 12


def shot_import(path):
    im, d = canvas()
    title(d, '手机选书：「明明有 epub，就是看不见」')
    d.text((72, 148), '以前', font=F(30, True), fill=RED)
    d.text((772, 148), '现在', font=F(30, True), fill=GOLD)
    lx, rx = 72, 772
    y1 = 200
    for name, kind in (('凡人修仙传.epub', 'EPUB'), ('三体.pdf', 'PDF'), ('合集.zip', 'ZIP')):
        y1 = _row(d, lx, y1, name, kind, False)
    y2 = 200
    for name, kind in (('凡人修仙传.epub', 'EPUB'), ('凡人修仙传.txt', 'TXT')):
        y2 = _row(d, rx, y2, name, kind, True)
    d.text((lx, 470), '不认 epub 这个类型 → 一个都不显示', font=F(26), fill=DIM)
    d.text((rx, 470), '白名单 + 文件头 → 没后缀也认得出', font=F(26), fill=DIM)
    im.save(path)


# ---------------------------------------------------------------- ③ 文件夹

def _book(d, x, y, w=150, h=196, tone=GOLD):
    d.rounded_rectangle([x, y, x + w, y + h], 12, fill=(30, 33, 41), outline=(58, 64, 78), width=2)
    d.rectangle([x + 18, y + 26, x + w - 18, y + 34], fill=tone)
    for i in range(4):
        d.rectangle([x + 18, y + 56 + i * 22, x + w - 30 - (i % 2) * 24, y + 62 + i * 22],
                    fill=(58, 63, 74))


def shot_folder(path):
    im, d = canvas()
    title(d, '「导入文件夹」现在真的是导入文件夹')
    # 文件夹图标
    fx, fy = 96, 196
    d.rounded_rectangle([fx, fy + 18, fx + 190, fy + 168], 12, fill=(40, 46, 58))
    d.rounded_rectangle([fx + 8, fy, fx + 96, fy + 34], 8, fill=(52, 59, 74))
    d.text((fx + 40, fy + 74), '我的书', font=F(28, True), fill=TX2)

    # 箭头
    ax, ay = fx + 214, fy + 84
    d.line([ax, ay, ax + 62, ay], fill=DIM, width=3)
    d.polygon([(ax + 62, ay - 9), (ax + 80, ay), (ax + 62, ay + 9)], fill=DIM)
    d.text((ax + 4, ay + 22), '选一次', font=F(23), fill=DIM)

    # 书架结果
    bx = fx + 320
    for i in range(3):
        _book(d, bx + i * 168, fy, tone=GOLD if i == 0 else ACC)
    d.text((bx, fy + 208), '12 本书 · 一次全进来', font=F(28, True), fill=GOLD)
    d.text((96, fy + 208), '以前：进目录一本本点', font=F(24), fill=DIM)
    im.save(path)


# ---------------------------------------------------------------- ④ 跳章

def _mimi(d, x, y, w=260, h=96, text='', color=TX, note=''):
    d.rounded_rectangle([x, y, x + w, y + h], 12, fill=(28, 31, 39), outline=(58, 64, 78), width=2)
    d.text((x + 22, y + 16), text, font=F(28, True), fill=color)
    if note:
        d.text((x + 22, y + 56), note, font=F(22), fill=DIM)


def _arrow(d, x, y, color=DIM):
    d.line([x, y, x + 40, y], fill=color, width=3)
    d.polygon([(x + 40, y - 8), (x + 56, y), (x + 40, y + 8)], fill=color)


def shot_page(path):
    im, d = canvas()
    title(d, '一章被算成 1 页，点一下就跳章')
    # 上：坏掉的
    d.text((72, 152), '以前', font=F(28, True), fill=RED)
    _mimi(d, 160, 140, 230, 88, '第 4 章', TX, '插图还没加载完')
    _arrow(d, 404, 184)
    _mimi(d, 470, 140, 200, 88, '第 1 / 1 页', RED)
    _arrow(d, 684, 184)
    _mimi(d, 750, 140, 300, 88, '点「下一页」→ 第 5 章', RED, '整章跳过去')
    # 下：修好的
    d.text((72, 322), '现在', font=F(28, True), fill=GOLD)
    _mimi(d, 160, 310, 230, 88, '第 4 章', TX, '插图加载后补量')
    _arrow(d, 404, 354)
    _mimi(d, 470, 310, 200, 88, '第 1 / 3 页', GOLD)
    _arrow(d, 684, 354)
    _mimi(d, 750, 310, 300, 88, '点「下一页」→ 第 2 页', GOLD, '该翻页就翻页')
    im.save(path)


# ---------------------------------------------------------------- ⑤ 鸣谢

def shot_thanks(path):
    im, d = canvas()
    title(d, '这一版，谢谢这九个人', size=42)
    names = ['@momo', '@点赞提醒你开了仅限好友评论区', '@终端虫虫',
             '@“青青子衿，悠悠我心”', '@常清静矣', '@小红薯',
             '@生活吖', '@Apple', '@如月隐']
    x0, y0 = 72, 150
    cw, ch, gap = 408, 96, 16
    for i, n in enumerate(names):
        r, c = divmod(i, 3)
        x = x0 + c * (cw + gap)
        y = y0 + r * (ch + gap)
        d.rounded_rectangle([x, y, x + cw, y + ch], 12, fill=(27, 30, 38), outline=(56, 62, 76), width=2)
        size = 26 if len(n) <= 12 else 22
        d.text((x + 20, y + (ch - size * 1.5) / 2), n, font=F(size, True), fill=GOLD if i == 0 else TX)
    im.save(path)


if __name__ == '__main__':
    out = [('d-size.png', shot_size), ('d-import.png', shot_import),
           ('d-folder.png', shot_folder), ('d-page.png', shot_page),
           ('d-thanks.png', shot_thanks)]
    for name, fn in out:
        p = os.path.join(HERE, name)
        fn(p)
        print('%-16s %6.1f KB' % (name, os.path.getsize(p) / 1024))

# -*- coding: utf-8 -*-
"""给进度汇报视频画四张对比图：旧做法 / 新做法。

这些图会被当成 card 场景的截图卡塞进视频，所以底色要贴近视频背景
（#121419），四角做圆角，长宽比按 1400×640 出，显示宽度 950 时高约 434。
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
LINE = (48, 54, 66)

FBD = 'C:/Windows/Fonts/msyhbd.ttc'
FRG = 'C:/Windows/Fonts/msyh.ttc'


def F(size, bold=False):
    return ImageFont.truetype(FBD if bold else FRG, size, index=0)


def canvas():
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, W - 1, H - 1], 26, outline=LINE, width=2)
    return im, d


def title(d, s, y=46):
    d.text((72, y), s, font=F(44, True), fill=TX)


def tag(d, x, y, s, color, bg, pad_x=22, pad_y=12):
    f = F(32, True)
    bb = d.textbbox((0, 0), s, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.rounded_rectangle([x, y, x + w + pad_x * 2, y + h + pad_y * 2], 12, fill=bg)
    d.text((x + pad_x - bb[0], y + pad_y - bb[1]), s, font=f, fill=color)
    return x + w + pad_x * 2 + 32


def arrow(d, x, y, w=44, color=DIM):
    d.line([x, y, x + w - 12, y], fill=color, width=3)
    d.polygon([(x + w - 12, y - 8), (x + w, y), (x + w - 12, y + 8)], fill=color)


def shot_flow(path):
    """旧做法：每念一句都要重新起一次引擎。"""
    im, d = canvas()
    title(d, '以前：每念一句，重新起一次引擎')
    boxes = ['第 1 句', '第 2 句', '第 3 句']
    x, y, bw, bh = 72, 200, 340, 200
    for i, name in enumerate(boxes):
        d.rounded_rectangle([x, y, x + bw, y + bh], 18, outline=RED, width=3)
        d.text((x + 28, y + 30), name, font=F(34, True), fill=TX)
        d.text((x + 28, y + 92), '起引擎 1.9 秒', font=F(34, True), fill=RED)
        d.text((x + 28, y + 142), '念 0.3 秒', font=F(30), fill=TX2)
        if i < 2:
            arrow(d, x + bw + 8, y + bh // 2, 38)
            d.text((x + bw + 4, y + bh // 2 + 22), '1.9s', font=F(26, True), fill=DIM)
        x += bw + 80
    im.save(path)


def shot_latency(path):
    """一段对白的总等待：9.9 秒 → 2.7 秒。"""
    im, d = canvas()
    title(d, '一段对白的总等待')
    y = 220
    bar_max = 860
    for label, sec, ratio, color in (('以前', '9.9 秒', 1.0, RED), ('现在', '2.7 秒', 2.7 / 9.9, GOLD)):
        d.text((72, y + 12), label, font=F(36, True), fill=TX2)
        bx = 200
        d.rounded_rectangle([bx, y, bx + int(bar_max * ratio), y + 76], 16, fill=color)
        d.text((bx + bar_max * ratio + 46, y + 14), sec, font=F(46, True), fill=color)
        y += 168
    im.save(path)


def shot_punct(path):
    """念到「？？？」：以前报错切机械音，现在只是停顿。"""
    im, d = canvas()
    title(d, '念到「？？？」的时候')
    rows = [('以前', RED, 'HTTP 500  empty text', '已切回系统朗读'),
            ('现在', GOLD, '停顿 0.74 秒', '接着念下一句')]
    y = 200
    for label, color, tagtxt, tail in rows:
        d.text((72, y + 16), label, font=F(34, True), fill=TX2)
        d.text((188, y), '「？？？」', font=F(44, True), fill=TX)
        x = tag(d, 400, y + 4, tagtxt, color, (color[0] // 4 + 16, color[1] // 4 + 16, color[2] // 4 + 18))
        d.text((x, y + 16), tail, font=F(34), fill=color if label == '现在' else DIM)
        y += 160
    im.save(path)


def shot_en(path):
    """一整段英文：以前整段报错，现在交给英文嗓子。"""
    im, d = canvas()
    title(d, '一整段英文')
    rows = [('以前', RED, '全部片段没出声', '整场切回机械音'),
            ('现在', GOLD, '系统英文嗓子念', '中文夹的单词照念')]
    y = 200
    for label, color, tagtxt, tail in rows:
        d.text((72, y + 16), label, font=F(34, True), fill=TX2)
        d.text((188, y), 'Hello world…', font=F(40, True), fill=TX)
        x = tag(d, 470, y + 4, tagtxt, color, (color[0] // 4 + 16, color[1] // 4 + 16, color[2] // 4 + 18))
        d.text((x, y + 16), tail, font=F(32), fill=color if label == '现在' else DIM)
        y += 160
    im.save(path)


if __name__ == '__main__':
    out = [
        ('cmp-flow.png', shot_flow),
        ('cmp-latency.png', shot_latency),
        ('cmp-punct.png', shot_punct),
        ('cmp-en.png', shot_en),
    ]
    for name, fn in out:
        p = os.path.join(HERE, name)
        fn(p)
        print('%-18s %6.1f KB' % (name, os.path.getsize(p) / 1024))

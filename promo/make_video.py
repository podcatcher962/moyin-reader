# -*- coding: utf-8 -*-
"""合成「墨吟」介绍视频：竖屏 1080x1920，H.264。

每一屏先用 PIL 画成一张 RGBA 大图（截图卡片 + 文字 + 柔光），再用 numpy
做淡入淡出与轻微上滑，逐帧写进 OpenCV 的中间文件；最后由虚拟机里的
ffmpeg 转成 H.264（本机没有可用的 H.264 编码器）。

    python promo/make_video.py
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHOT = os.path.join(ROOT, 'docs', 'screenshots')
OUT_MID = os.path.join(HERE, '_mid.mp4')

W, H = 1080, 1920
FPS = 24
BG = (18, 20, 25)
TX = (235, 233, 229)
TX2 = (146, 152, 163)
ACC = (86, 160, 255)
GOLD = (216, 178, 106)

FONT_BD = 'C:/Windows/Fonts/msyhbd.ttc'
FONT_RG = 'C:/Windows/Fonts/msyh.ttc'


def F(size, bold=True):
    return ImageFont.truetype(FONT_BD if bold else FONT_RG, size, index=0)


def make_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W * 0.5, H * 0.34
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (H * 0.78)
    glow = np.clip(1.0 - dist, 0, 1) ** 2
    base = np.zeros((H, W, 3), np.float32)
    base[..., 0] = BG[0] + glow * 24
    base[..., 1] = BG[1] + glow * 28
    base[..., 2] = BG[2] + glow * 38
    # 渐变在 8bit yuv420p 下会出色带，撒一点点噪声把它打散（Dither）。
    # 顺带让画面不那么「死板的大色块」。
    rng = np.random.default_rng(20261107)
    base += rng.normal(0.0, 1.7, (H, W, 3))
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), 'RGB')


BGIMG = make_bg().convert('RGBA')


def tw(draw, s, f):
    return draw.textbbox((0, 0), s, font=f)[2]


def ctext(draw, y, s, f, fill):
    draw.text(((W - tw(draw, s, f)) / 2, y), s, font=f, fill=fill)


def shot_path(name):
    p = os.path.join(HERE, name)
    if os.path.isfile(p):
        return p
    return os.path.join(SHOT, name)


def shot_card(path, width):
    im = Image.open(path).convert('RGB')
    h = int(im.height * width / im.width)
    im = im.resize((width, h), Image.LANCZOS)
    r = 18
    mask = Image.new('L', (width, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, width - 1, h - 1], r, fill=255)

    pad = 34
    canvas = Image.new('RGBA', (width + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 12, pad + width, pad + h + 12], r,
                                         fill=(0, 0, 0, 200))
    canvas = Image.alpha_composite(canvas, sh.filter(ImageFilter.GaussianBlur(24)))

    body = Image.new('RGBA', (width, h), (0, 0, 0, 0))
    body.paste(im, (0, 0), mask)
    ImageDraw.Draw(body).rounded_rectangle([0, 0, width - 1, h - 1], r,
                                           outline=(112, 118, 132, 255), width=2)
    canvas.paste(body, (pad, pad), body)
    return canvas


def scene_frame(scene, idx, total):
    img = BGIMG.copy()
    d = ImageDraw.Draw(img)
    kind = scene['kind']

    if kind == 'intro':
        d.rounded_rectangle([W / 2 - 120, 596, W / 2 + 120, 602], 3, fill=GOLD)
        ctext(d, 648, '墨吟', F(158), TX)
        ctext(d, 844, 'MoYin Reader', F(54, False), GOLD)
        ctext(d, 974, '全离线 · 全平台 · 中文阅读器', F(42, False), TX2)
        ctext(d, 1074, '174 个离线声线 · 分角色朗读 · 免安装', F(34, False), TX2)
        ctext(d, 1178, 'v1.10.2  ·  2026', F(30, False), (104, 110, 122))
        ctext(d, 1722, 'MIT 开源 · © 永远的兰兰', F(28, False), (108, 114, 126))
        return img

    if kind == 'outro':
        d.rounded_rectangle([W / 2 - 120, 528, W / 2 + 120, 534], 3, fill=GOLD)
        ctext(d, 576, '现在就试试', F(78), TX)
        ctext(d, 722, '下载 · Windows / 安卓 / 信创 Linux / macOS', F(31, False), TX2)
        ctext(d, 780, 'github.com/podcatcher962/moyin-reader', F(33), ACC)
        ctext(d, 864, '在线版 · 什么都不用装', F(31, False), TX2)
        ctext(d, 922, 'podcatcher962.github.io/moyin-reader', F(33), ACC)
        d.line([(150, 1028), (W - 150, 1028)], fill=(54, 60, 72), width=1)
        ctext(d, 1068, '单文件 · 零联网 · 数据只在本机', F(34, False), TX)
        ctext(d, 1138, 'MIT 开源 · 永久免费', F(32, False), GOLD)
        ctext(d, 1730, '© 永远的兰兰  ·  Lanlan Eternal', F(28, False), (108, 114, 126))
        return img

    if kind == 'text':
        tag = scene.get('tag', '')
        if tag:
            f_tag = F(30, False)
            w = tw(d, tag, f_tag)
            d.rounded_rectangle([W / 2 - w / 2 - 26, 560, W / 2 + w / 2 + 26, 616], 28,
                                fill=(38, 44, 56), outline=(70, 78, 92), width=1)
            d.text(((W - w) / 2, 574), tag, font=f_tag, fill=ACC)
        y = 690
        for line in scene['title'].split('\n'):
            ctext(d, y, line, F(72), TX)
            y += 104
        y += 44
        for b in scene.get('bullets') or []:
            ctext(d, y, b, F(36, False), TX2)
            y += 78
        return img

    # ---- 普通功能页 ----
    tag = scene.get('tag', '')
    if tag:
        f_tag = F(30, False)
        w = tw(d, tag, f_tag)
        d.rounded_rectangle([W / 2 - w / 2 - 26, 150, W / 2 + w / 2 + 26, 206], 28,
                            fill=(38, 44, 56), outline=(70, 78, 92), width=1)
        d.text(((W - w) / 2, 164), tag, font=f_tag, fill=ACC)

    y = 240
    for line in scene['title'].split('\n'):
        ctext(d, y, line, F(scene.get('title_size', 62)), TX)
        y += int(scene.get('title_size', 62) * 1.42)

    if scene.get('sub'):
        ctext(d, y + 8, scene['sub'], F(33, False), TX2)
        y += 64

    shot = scene.get('shot')
    if shot:
        card = shot_card(shot_path(shot), scene.get('shot_w', 900))
        cx = (W - card.width) // 2
        cy = max(y + 34, 640)
        if cy + card.height > 1420:
            cy = max(y + 16, 1420 - card.height)
        halo = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(halo).rounded_rectangle(
            [cx - 24, cy - 24, cx + card.width + 24, cy + card.height + 24],
            46, fill=(86, 150, 240, 42))
        img = Image.alpha_composite(img, halo.filter(ImageFilter.GaussianBlur(62)))
        img.paste(card, (cx, cy), card)
        d = ImageDraw.Draw(img)      # alpha_composite 会产生新对象，句柄必须重建

    bullets = scene.get('bullets') or []
    if bullets:
        by = scene.get('bullet_y', 1470)
        f_b = F(35, False)
        for i, b in enumerate(bullets):
            yy = by + i * 72
            d.ellipse([118, yy + 13, 130, yy + 25], fill=GOLD)
            d.text((158, yy), b, font=f_b, fill=TX)

    pg = '%02d / %02d' % (idx + 1, total)
    f_p = F(24, False)
    d.text((W - tw(d, pg, f_p) - 52, H - 70), pg, font=f_p, fill=(92, 98, 110))
    return img


SCENES = [
    dict(kind='intro', dur=4.0),

    dict(kind='card', dur=9.4, tag='听书',
         title='174 个离线声线\n对白按人物自动换声',
         shot='role-bar.png', shot_w=880,
         bullets=['「张三说」「李四道」是两个嗓子',
                  '同一个人物整本书同一个声音',
                  '本地合成，不联网、不上传'],
         bullet_y=1460),

    dict(kind='card', dur=8.6, tag='阅读',
         title='翻页 / 滚动\n宽屏自动双栏，手机单栏',
         shot='read-2col-wide.png', shot_w=920,
         bullets=['点两侧、滚轮、空格、← → 都能翻',
                  '十种字体 · 六套主题 · 十六色板',
                  '行距、字距、首行缩进、页边距全可调'],
         bullet_y=1440),

    dict(kind='card', dur=7.4, tag='排版',
         title='字体每款自带预览\n点一下就知道差别',
         shot='settings-fonts.png', shot_w=890,
         bullets=['宋体 / 雅黑 / 楷体 / 仿宋 / 隶书 / 幼圆…',
                  '深色底自动配浅色字，不会糊成一团'],
         bullet_y=1470),

    dict(kind='card', dur=7.0, tag='主题',
         title='六套配色 + 十六色板\n点卡片即时生效',
         shot='theme-panel.png', shot_w=880,
         bullets=['夜间 / 明亮 / 羊皮纸 / 护眼绿 / 雾蓝 / 纯黑',
                  '还能自己取色，亮度也能压暗'],
         bullet_y=1490),

    dict(kind='card', dur=7.8, tag='批注',
         title='划线、批注、笔记\n还能导出和总结',
         shot='notes-panel.png', shot_w=880,
         bullets=['四色高亮 + 批注，按章节汇总',
                  '一键导出 Markdown / 阅读总结',
                  '长按选中就能复制、分享成图'],
         bullet_y=1460),

    dict(kind='card', dur=8.6, tag='繁简',
         title='繁体书一键显示成简体\n只看不改，随时还原',
         shot='demo_hans.png', shot_w=900,
         bullets=['台版书、古籍不用再一个个猜字',
                  '只改显示，书里的原文一个字不动',
                  '划线、笔记、朗读位置都不会错位'],
         bullet_y=1440),

    dict(kind='text', dur=6.4, tag='手机',
         title='手机上一样好用',
         bullets=['单栏阅读 · 双指捏合调字号',
                  '左右滑动翻页 · 点两侧也能翻',
                  '长按选中就能划线批注']),

    dict(kind='card', dur=6.8, tag='离线',
         title='全离线，零联网\n数据只留在本机',
         shot='clock-panel.png', shot_w=840,
         bullets=['没有账号、没有登录、没有同步',
                  '自动阅读 + 阅读时钟 + 休息提醒',
                  '书 / 笔记 / 进度 / 语音全在本地'],
         bullet_y=1480),

    dict(kind='card', dur=8.8, tag='全平台',
         title='Windows · 安卓 · 网页\n信创 Linux · macOS',
         shot='linux-uos.png', shot_w=900,
         bullets=['Windows 一个 exe，安卓一个 apk',
                  '信创 Linux（统信 / 麒麟）有 deb 安装包',
                  '浏览器双击 HTML 就能用，免安装'],
         bullet_y=1430),

    dict(kind='card', dur=7.2, tag='共享',
         title='NAS 上的书直接读\n不用先拷过来',
         shot='net-import.png', shot_w=860,
         bullets=['支持 SMB 局域网共享与挂载路径',
                  '拖拽导入，整个文件夹一次收进来',
                  '还有在线版：打开网页就能用'],
         bullet_y=1470),

    dict(kind='outro', dur=6.2),
]


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def main():
    import cv2

    n_scene = len(SCENES)
    frames = []
    for i, sc in enumerate(SCENES):
        frames.append((sc, np.array(scene_frame(sc, i, n_scene).convert('RGB'))))
        print('  渲染 %-6s %5.1fs  %s' % (sc['kind'], sc['dur'], sc.get('tag', '')))

    total = sum(int(sc['dur'] * FPS) for sc, _ in frames)
    print('总帧数 %d（%.1f 秒）' % (total, total / FPS))

    vw = cv2.VideoWriter(OUT_MID, cv2.VideoWriter_fourcc(*'mp4v'), FPS, (W, H))
    try:
        vw.set(cv2.VIDEOWRITER_PROP_QUALITY, 100)
    except Exception:
        pass
    if not vw.isOpened():
        print('OpenCV 打不开 VideoWriter')
        return 2

    bg = np.array(BGIMG.convert('RGB'), dtype=np.float32)
    fade = max(4, int(0.40 * FPS))
    gold = np.array(GOLD, dtype=np.uint8)
    done = 0

    for sc, arr in frames:
        n = int(sc['dur'] * FPS)
        a_arr = arr.astype(np.float32)
        for i in range(n):
            if i < fade:
                a = ease(i / fade)
            elif i > n - fade - 1:
                a = ease((n - 1 - i) / fade)
            else:
                a = 1.0
            slide = int(24 * (1 - ease(i / 12.0))) if i < 12 else 0
            if a >= 0.999 and slide == 0:
                frame = arr.copy()
            else:
                src = a_arr
                if slide:
                    src = np.roll(a_arr, slide, axis=0)
                    src[:slide] = bg[:slide]
                frame = np.clip(bg * (1 - a) + src * a, 0, 255).astype(np.uint8)
            done += 1
            bw = int(W * done / total)
            if bw > 0:
                frame[0:5, :bw] = gold
            vw.write(frame[:, :, ::-1])
    vw.release()

    print('中间文件：%s  %.1f MB' % (OUT_MID, os.path.getsize(OUT_MID) / 1048576))
    return 0


if __name__ == '__main__':
    sys.exit(main())

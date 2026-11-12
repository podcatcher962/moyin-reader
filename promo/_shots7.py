# -*- coding: utf-8 -*-
"""把 make_video7 的每一屏各截一张静帧，拼成一张联系表，先看版式再渲染。"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_video7 as V  # noqa: E402

SHOT = os.path.join(V.HERE, '_shots7')
os.makedirs(SHOT, exist_ok=True)

thumbs = []
for i, sc in enumerate(V.SCENES):
    pre = V.scene_pre(sc, i)
    t = min(sc['dur'] * 0.82, sc['dur'] - 0.12)
    cur = V.bg_frame(0.0)
    layer = np.zeros((V.H, V.W, 3), np.float32)
    lalpha = np.zeros((V.H, V.W), np.float32)
    V._LA = lalpha
    V.scene_h(layer, sc, t, pre)
    V._LA = None
    ga = V.content_alpha(sc, t)
    la = lalpha[..., None] * ga
    cur = cur * (1 - la) + layer * ga
    ce, cw = V.corner_el()
    V.blend(cur, ce, V.MARGIN, 104, 0.88)
    ue, uw = V.T([(V.URL_MAIN, V.INK3)], 22, 'Medium')
    V.blend(cur, ue, V.MARGIN, V.H - 46, 0.95)
    p = os.path.join(SHOT, '%02d_%s.png' % (i, sc['k']))
    Image.fromarray(np.clip(cur, 0, 255).astype(np.uint8)).save(p)
    thumbs.append(p)
    print('shot', p, flush=True)

# 联系表：4 列
cols = 4
tw, th = 270, 480
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 12) + 12, rows * (th + 12) + 12), (60, 60, 60))
for k, p in enumerate(thumbs):
    im = Image.open(p).resize((tw, th), Image.LANCZOS)
    r, c = divmod(k, cols)
    sheet.paste(im, (12 + c * (tw + 12), 12 + r * (th + 12)))
out = os.path.join(SHOT, '_sheet.png')
sheet.save(out)
print('sheet', out)

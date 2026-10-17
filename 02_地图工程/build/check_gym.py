# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw
import math
BASE = "/home/user/Doubao/chats/38447367988429826/digital-campus"
m = Image.open(BASE + "/01_资料与参考/official_map.jpg").convert("RGB")
d = ImageDraw.Draw(m)
# GYM ellipse (cx,cy,rx,ry), rot
cx, cy, rx, ry, rot = 300, 756, 40, 18, -0.785
pts = []
for k in range(73):
    a = 2 * math.pi * k / 72
    ex = rx * math.cos(a)
    ey = ry * math.sin(a)
    x = cx + ex * math.cos(rot) - ey * math.sin(rot)
    y = cy + ex * math.sin(rot) + ey * math.cos(rot)
    pts.append((x, y))
d.line(pts + [pts[0]], fill=(255, 0, 0), width=3)
d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(255, 0, 0))
# 裁出 GYM 附近放大
pad = 70
crop = m.crop((cx - pad, cy - pad, cx + pad, cy + pad))
crop = crop.resize((crop.width * 4, crop.height * 4), Image.LANCZOS)
crop.save("/tmp/gym_plan.png")
print("center", cx, cy)

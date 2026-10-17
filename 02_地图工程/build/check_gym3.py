# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw
import math, sys
sys.path.insert(0, "/home/user/Doubao/chats/38447367988429826/digital-campus/02_地图工程/build")
import render_iso as R
import campus_data as C
BASE = "/home/user/Doubao/chats/38447367988429826/digital-campus"
m = Image.open(BASE + "/01_资料与参考/official_map.jpg").convert("RGB")
d = ImageDraw.Draw(m)
cx, cy, rx, ry, rot = 300, 756, 40, 18, -0.785
def planpt(a, bb):
    return (cx + a * math.cos(rot) - bb * math.sin(rot),
            cy + a * math.sin(rot) + bb * math.cos(rot))
pNE = planpt(rx, 0)   # a=+rx 东北
pSW = planpt(-rx, 0)  # a=-rx 西南
d.ellipse([pNE[0]-7, pNE[1]-7, pNE[0]+7, pNE[1]+7], fill=(255, 0, 0))
d.ellipse([pSW[0]-7, pSW[1]-7, pSW[0]+7, pSW[1]+7], fill=(0, 60, 255))
d.text((pNE[0]+10, pNE[1]), "NE(a=+rx)", fill=(255, 0, 0))
d.text((pSW[0]-90, pSW[1]-14), "SW(a=-rx)", fill=(0, 60, 255))
# 等距屏幕坐标
minx, miny, _, _ = R.iso_bounds()
OX, OY = -minx + 280, -miny + 210
def Tp(gx, gy):
    x, y = R.iso(gx, gy); return (x + OX, y + OY)
def spt(a, bb):
    px = cx + a * math.cos(rot) - bb * math.sin(rot)
    py = cy + a * math.sin(rot) + bb * math.cos(rot)
    return Tp(C.px2gx(px), C.px2gy(py))
print("NE screen", tuple(round(v) for v in spt(rx, 0)))
print("SW screen", tuple(round(v) for v in spt(-rx, 0)))
crop = m.crop((cx - 78, cy - 78, cx + 78, cy + 78))
crop = crop.resize((crop.width * 5, crop.height * 5), Image.LANCZOS)
crop.save("/tmp/gym_plan2.png")

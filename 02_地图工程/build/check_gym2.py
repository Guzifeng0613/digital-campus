# -*- coding: utf-8 -*-
import sys, math
sys.path.insert(0, "/home/user/Doubao/chats/38447367988429826/digital-campus/02_地图工程/build")
import render_iso as R
import campus_data as C
minx, miny, _, _ = R.iso_bounds()
OX, OY = -minx + 280, -miny + 210
def Tp(gx, gy):
    x, y = R.iso(gx, gy); return (x + OX, y + OY)
pcx, pcy, prx, pry = 300, 756, 40, 18
rot = -0.785
rx, ry = prx, pry
def spt(a, bb):
    px = pcx + a * math.cos(rot) - bb * math.sin(rot)
    py = pcy + a * math.sin(rot) + bb * math.cos(rot)
    return Tp(C.px2gx(px), C.px2gy(py))
for name, a in [("a=+rx (px东北)", rx), ("a=-rx (px西南)", -rx)]:
    mp = spt(a, 0)
    p_plus = spt(a, ry)   # bb=+ry
    p_minus = spt(a, -ry)  # bb=-ry
    ex = p_plus[0] - p_minus[0]
    ey = p_plus[1] - p_minus[1]
    print(name, "mid=(%.0f,%.0f)" % mp,
          "端弧bb:-ry->+ry  ex=%.1f ey=%.1f" % (ex, ey),
          "ex<0朝相机?" , ex < -0.5)

# -*- coding: utf-8 -*-
"""为浏览器等距预览器导出：干净地面底图 + 16 建筑放置参数(data.js) + 复制透明 sprite。
坐标系：裁剪后的底图像素（与 catalog/总体排布资产图.png 完全一致，不含建筑与编号）。
JS 端：屏幕(裁剪坐标) = ((gx-gy)*22 + ox, (gx+gy)*11 + oy)，z=1 时 1:1。
"""
import os, json, shutil, importlib
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
ENG = os.path.join(HERE, "..")
WEB = os.path.abspath(os.path.join(ENG, "..", "03_地图预览器"))
import sys; sys.path.insert(0, HERE)
import campus_data as C

# ---- 1) 渲染干净地面底图（不含建筑、标签、树冠、POI），与 compose.py 一致 ----
nat = [n for n in C.build_nature() if n["cat"] != "mountain"]
C.numbered_buildings = lambda: []
C.build_nature = lambda: nat
import render_iso as R
importlib.reload(R)
R.LANDMARK = {}; R.DRAW_LABELS = False
R.DRAW_CANOPY = False; R.DRAW_POI = False
R.render()
full = Image.open(os.path.join(ENG, "check", "iso_framework.png")).convert("RGBA")

_minx, _miny, _maxx, _maxy = R.iso_bounds()
OX, OY = -_minx + 280, -_miny + 210
L, T = 150, 110
Rt = int((_maxx - _minx) + 280 + 130)
B = int((_maxy - _miny) + 210 + 170)
ground = full.crop((L, T, Rt, B)).convert("RGBA")
GW, GH = ground.size

# 地面菱形四个顶点（裁剪坐标），菱形外抠成透明
def Tp_full(gx, gy):
    x, y = R.iso(gx, gy)
    return (x + OX, y + OY)
corners = [Tp_full(C.GX0, C.GY0), Tp_full(C.GX1, C.GY0),
           Tp_full(C.GX1, C.GY1), Tp_full(C.GX0, C.GY1)]
corners = [(x - L, y - T) for x, y in corners]
from PIL import ImageDraw
mask = Image.new("L", (GW, GH), 0)
ImageDraw.Draw(mask).polygon(corners, fill=255)
ground.putalpha(mask)
os.makedirs(os.path.join(WEB, "img"), exist_ok=True)
ground.save(os.path.join(WEB, "img", "ground.png"))
xs = [p[0] for p in corners]; ys = [p[1] for p in corners]
diamond = [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]
print("地面底图", ground.size, "菱形bounds", diamond)

# 网格原点(0,0)在裁剪图中的像素
ox = OX - L
oy = OY - T
SX, SY = R.TW / 2.0, R.TH / 2.0   # 22, 11

def P(gx, gy):
    x, y = R.iso(gx, gy)
    return (x + OX - L, y + OY - T)

# ---- 2) 建筑放置参数 + 复制 sprite ----
manifest = json.load(open(os.path.join(ENG, "assets", "manifest.json"), encoding="utf-8"))
map_data = json.load(open(os.path.join(ENG, "map_data.json"), encoding="utf-8"))
desc_by_id = {b["id"]: b for b in map_data.get("buildings", [])}

SIDE = 0.07
buildings = []
for m in manifest["items"]:
    g = m["grid"]; gx, gy, gw, gh = g["gx"], g["gy"], g["gw"], g["gh"]
    src = os.path.join(ENG, m["file"])
    sp = Image.open(src).convert("RGBA")
    arr = np.array(sp); a = arr[:, :, 3]
    ys, xs = np.where(a > 10); x0, x1 = xs.min(), xs.max(); y0, y1 = ys.min(), ys.max()
    bw, bh = x1 - x0, y1 - y0
    cx, cy = P(gx + gw / 2, gy + gh / 2)
    fx, fy = P(gx + gw, gy + gh)
    Wd = (gw + gh) * SX
    s = Wd / bw
    nw, nh = int(bw * s), int(bh * s)
    paste_x = cx - nw / 2
    paste_y = fy - nh
    # 复制 sprite（按 id 命名，避免分组目录）
    dst = f"img/sprites/{m['id']}.png"
    shutil.copy(src, os.path.join(WEB, dst))
    info = desc_by_id.get(m["id"], {})
    # 分组由 file 路径推出
    grp = m["file"].split("/")[2]
    buildings.append({
        "id": m["id"], "no": m["no"], "name": m["name"], "group": grp,
        "cat": m.get("category", ""), "img": dst,
        "grid": [round(gx, 2), round(gy, 2), round(gw, 2), round(gh, 2)],
        "bbox": [int(x0), int(y0), int(bw), int(bh)],
        "scale": round(s, 6),
        "paste": [round(paste_x, 1), round(paste_y, 1)],
        "dw": nw, "dh": nh,
        "foot": [round(cx, 1), round(cy, 1)],
        "depth": round(gx + gw / 2 + gy + gh / 2, 2),
        "walkable": m.get("category", "") in ("field", "mountain"),
        "desc": info.get("desc", ""),
    })

# 地块碰撞盒（供角色行走）：不可穿行的建筑，单位网格
for b in buildings:
    gx, gy, gw, gh = b["grid"]
    b["collider"] = [round(gx, 1), round(gy, 1), round(gw, 1), round(gh, 1)]

data = {
    "meta": {
        "project": "北京化工大学昌平校区 · 等距像素数字校园",
        "ground": "img/ground.png",
        "groundSize": [GW, GH],
        "diamond": diamond,
        "origin": [round(ox, 3), round(oy, 3)],
        "tile": [SX, SY],          # 等距每格半宽/半高
        "gridRange": [C.GX0, C.GY0, C.GX1, C.GY1],
        "count": len(buildings),
    },
    "buildings": buildings,
}
os.makedirs(os.path.join(WEB, "js"), exist_ok=True)
with open(os.path.join(WEB, "js", "data.js"), "w", encoding="utf-8") as f:
    f.write("// 自动生成：等距地图数据（地面底图 + 建筑放置/投影/信息）。勿手改。\n")
    f.write("window.CAMPUS_DATA = ")
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write(";\n")
print("建筑", len(buildings), "| 数据 js/data.js | origin", round(ox,1), round(oy,1))

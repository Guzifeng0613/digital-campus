#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
#73 校园整体放大：围绕中心 (CX,CY) 把所有"位置坐标"放大 S 倍（拉开楼间距）。
- 建筑 footprint/碰撞/装饰/水系/山体的"形状与尺寸"不变，只整体平移（质心随放大移动）。
- 道路/运河折线"逐点放大"，让道路在摊开的建筑间保持连接（道路宽度不变）。
- 建筑 sprite 视觉大小不变（仍饱满），只彼此远离 → 屏幕 AABB 间隙。
- gridRange 按所有元素新边界 + padding 重算。
"""
import json, os, sys, re, math, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_visual_pack import ROOT, SPR, ANCHOR_AY, ANCHOR_AX, ISO_K, load_buildings, entity_bbox
from PIL import Image

S = float(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else 1.55
CX, CY = 80.0, 135.0
def sx(x): return CX + (x - CX) * S
def sy(y): return CY + (y - CY) * S
def poly_shift(poly):
    """多边形整体平移：质心跟随 sx/sy，形状不变。"""
    cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
    return sx(cx) - cx, sy(cy) - cy

# ---------- 读数据 ----------
data_js = os.path.join(ROOT, "js", "data.js")
td_js = os.path.join(ROOT, "js", "topdown_data.js")
def load_obj(path, var):
    txt = open(path, encoding="utf-8").read()
    m = re.search(var + r"\s*=\s*(\{.*\});?\s*$", txt, re.S)
    return txt, json.loads(m.group(1))
dtxt, D = load_obj(data_js, r"window\.CAMPUS_DATA")
ttxt, TD = load_obj(td_js, r"window\.TOPDOWN_DATA")

# ---------- data.js：建筑 ----------
new_grid = {}
for b in D["buildings"]:
    gx, gy, w, h = b["grid"]
    ngx, ngy = sx(gx), sy(gy)
    new_grid[b["id"]] = (ngx, ngy, w, h)
    dx, dy = ngx - gx, ngy - gy
    if "colliders" in b:
        b["colliders"] = [[c[0] + dx, c[1] + dy, c[2], c[3]] for c in b["colliders"]]
    if "collider" in b:
        c = b["collider"]; b["collider"] = [c[0] + dx, c[1] + dy, c[2], c[3]]
    if "entry" in b:
        b["entry"] = [b["entry"][0] + dx, b["entry"][1] + dy]
    b["grid"] = [round(ngx, 2), round(ngy, 2), w, h]

# ---------- topdown_data.js：道路/运河逐点缩放；自然地块整体平移 ----------
for r in TD["roads"]:
    r["gpts"] = [[round(sx(p[0]), 2), round(sy(p[1]), 2)] for p in r["gpts"]]
if TD.get("canal"):
    TD["canal"] = [[round(sx(p[0]), 2), round(sy(p[1]), 2)] for p in TD["canal"]]
for n in TD["nature"]:
    if n.get("gpoly"):
        dx, dy = poly_shift(n["gpoly"])
        n["gpoly"] = [[round(p[0] + dx, 2), round(p[1] + dy, 2)] for p in n["gpoly"]]
    if n.get("grid"):
        x, y, w, h = n["grid"]
        n["grid"] = [round(x + dx, 2), round(y + dy, 2), w, h]

# ---------- gridRange：取所有元素新边界 + padding ----------
x0, y0, x1, y1 = 1e9, 1e9, -1e9, -1e9
def bump(x, y):
    global x0, y0, x1, y1
    x0, y0 = min(x0, x), min(y0, y); x1, y1 = max(x1, x), max(y1, y)
for b in D["buildings"]:
    gx, gy, w, h = b["grid"]; bump(gx, gy); bump(gx + w, gy + h)
for n in TD["nature"]:
    for p in n.get("gpoly", []): bump(p[0], p[1])
    if n.get("grid"):
        x, y, w, h = n["grid"]; bump(x, y); bump(x + w, y + h)
PAD = 8
new_range = [math.floor(x0 - PAD), math.floor(y0 - PAD), math.ceil(x1 + PAD), math.ceil(y1 + PAD)]
D["meta"]["gridRange"] = new_range

# ---------- 屏幕 AABB 间隙校验（缩放后） ----------
TW = 64
DIMS = {}; EBS = {}
for b in D["buildings"]:
    im = Image.open(os.path.join(SPR, b["id"] + ".png")); DIMS[b["id"]] = im.size; EBS[b["id"]] = entity_bbox(im)
def gap_req(a, b):
    ids = {a, b}
    if "MOUNT-YUPING" in ids: return 0
    if any(x.startswith("GATE") for x in ids): return 40 if any(x.startswith("FIELD") for x in ids) else 55
    if any(x.startswith("FIELD") for x in ids): return 45
    return 72
def geom(b):
    rid = b["id"]; gx, gy, fw, fh = b["grid"]; k = ISO_K.get(rid, 1.1); rw, rh = DIMS[rid]
    sc = (fw + fh) * TW / 2 * k / rw; pxW, pxH = rw * sc, rh * sc
    X = (gx + fw - gy - fh) * 32; Y = (gx + fw + gy + fh) * 16
    ax = ANCHOR_AX.get(rid, .5); ay = ANCHOR_AY.get(rid, .95)
    X0, Y0 = X - ax * pxW, Y - ay * pxH; u0, v0, u1, v1 = EBS[rid]
    return dict(xL=X0+u0*pxW, yT=Y0+v0*pxH, xR=X0+u1*pxW, yB=Y0+v1*pxH)
bs = D["buildings"]
def all_bad():
    out = []
    for i in range(len(bs)):
        for j in range(i+1, len(bs)):
            ai, aj = bs[i]["id"], bs[j]["id"]; G = gap_req(ai, aj)
            if G <= 0: continue
            A, B = geom(bs[i]), geom(bs[j])
            gx = max(A["xL"]-B["xR"], B["xL"]-A["xR"]); gy = max(A["yT"]-B["yB"], B["yT"]-A["yB"])
            if gx < G and gy < G: out.append((i, j, gx, gy))
    return out

# 局部微调：仅缩放后仍不满足的对，弱弹簧拉回收缩位置，位移上限 6 格
ANCH = {"MOUNT-YUPING", "FIELD-N", "FIELD-W", "GATE-S", "GATE-E", "GATE-W"}
scaled_pos = {b["id"]: [b["grid"][0], b["grid"][1]] for b in bs}
def inv(x, y): return (x/32 + y/16)/2, (y/16 - x/32)/2
def move(rid, dx, dy):
    if rid not in ANCH:
        b = next(z for z in bs if z["id"] == rid)
        b["grid"][0] += dx; b["grid"][1] += dy
for _ in range(1500):
    if _ % 2 == 0:
        for b in bs:
            if b["id"] in ANCH: continue
            b["grid"][0] += (scaled_pos[b["id"]][0] - b["grid"][0]) * 0.05
            b["grid"][1] += (scaled_pos[b["id"]][1] - b["grid"][1]) * 0.05
    for (i, j, gx0, gy0) in all_bad():
        ai, aj = bs[i]["id"], bs[j]["id"]; G = gap_req(ai, aj)
        A, B = geom(bs[i]), geom(bs[j])
        gx = max(A["xL"]-B["xR"], B["xL"]-A["xR"]); gy = max(A["yT"]-B["yB"], B["yT"]-A["yB"])
        if G-gx <= G-gy:
            nx = G-gx; (sa, sb) = (nx, -nx) if A["xL"]-B["xR"] > B["xL"]-A["xR"] else (-nx, nx); ta = tb = 0
        else:
            ny = G-gy; (ta, tb) = (ny, -ny) if A["yT"]-B["yB"] > B["yT"]-A["yB"] else (-ny, ny); sa = sb = 0
        aA = 0 if ai in ANCH else (1 if aj in ANCH else .5); aB = 0 if aj in ANCH else (1 if ai in ANCH else .5)
        dA = inv(sa*aA*2, ta*aA*2); dB = inv(sb*aB*2, tb*aB*2)
        move(ai, *dA); move(aj, *dB)
    # 位移上限 6 格
    for b in bs:
        if b["id"] in ANCH: continue
        dx = b["grid"][0]-scaled_pos[b["id"]][0]; dy = b["grid"][1]-scaled_pos[b["id"]][1]
        d = math.hypot(dx, dy)
        if d > 6:
            b["grid"][0] = scaled_pos[b["id"]][0] + dx*6/d; b["grid"][1] = scaled_pos[b["id"]][1] + dy*6/d

bad = []
for i in range(len(bs)):
    for j in range(i+1, len(bs)):
        ai, aj = bs[i]["id"], bs[j]["id"]; G = gap_req(ai, aj)
        if G <= 0: continue
        A, B = geom(bs[i]), geom(bs[j])
        gx = max(A["xL"]-B["xR"], B["xL"]-A["xR"]); gy = max(A["yT"]-B["yB"], B["yT"]-A["yB"])
        if gx < G and gy < G: bad.append((ai, aj, round(gx), round(gy), round(G-max(gx, gy))))
print("新 gridRange:", new_range)
print(f"缩放+局部微调后仍不满足 {len(bad)} 对:")
for x in sorted(bad, key=lambda t:-t[4]): print("  ", x)
print("局部微调位移:")
for b in bs:
    if b["id"] in ANCH: continue
    d = math.hypot(b["grid"][0]-scaled_pos[b["id"]][0], b["grid"][1]-scaled_pos[b["id"]][1])
    if d > 0.3: print("  ", b["id"], round(d, 1), "格 ->", round(b["grid"][0], 1), round(b["grid"][1], 1))
# 微调后 colliders/entry 已在缩放阶段按整体平移写入；此处微调位移对 colliders 再补平移
for b in bs:
    if b["id"] in ANCH: continue
    ddx = b["grid"][0]-scaled_pos[b["id"]][0]; ddy = b["grid"][1]-scaled_pos[b["id"]][1]
    if abs(ddx) > 0.01 or abs(ddy) > 0.01:
        if "colliders" in b: b["colliders"] = [[c[0]+ddx, c[1]+ddy, c[2], c[3]] for c in b["colliders"]]
        if "collider" in b: b["collider"][0] += ddx; b["collider"][1] += ddy
        if "entry" in b: b["entry"][0] += ddx; b["entry"][1] += ddy
    b["grid"][0] = round(b["grid"][0], 2); b["grid"][1] = round(b["grid"][1], 2)

# ---------- 写回 ----------
if "--write" in sys.argv:
    shutil.copy(data_js, data_js + ".bakscale"); shutil.copy(td_js, td_js + ".bakscale")
    def dump(obj): return json.dumps(obj, ensure_ascii=False, indent=1)
    open(data_js, "w", encoding="utf-8").write("window.CAMPUS_DATA = " + dump(D) + ";\n")
    open(td_js, "w", encoding="utf-8").write("window.TOPDOWN_DATA = " + dump(TD) + ";\n")
    print("已写回 data.js / topdown_data.js（备份 .bakscale）")
else:
    print("（仅预测；--write 写回）")

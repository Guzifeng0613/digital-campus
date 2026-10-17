# -*- coding: utf-8 -*-
"""单栋等距立绘渲染：只渲染目标建筑（去掉道路/水系/山/其他建筑），
裁出"建筑+草地底座"的干净等距图，作为像素风 I2I 的外形锚点。
用法: python3 render_single.py TEACH-1 LIB GYM ...
"""
import sys, os, importlib
HERE = os.path.dirname(__file__)
sys.path.insert(0, HERE)
import campus_data as C
import render_iso as R

OUTDIR = os.path.join(HERE, "..", "check", "single")
os.makedirs(OUTDIR, exist_ok=True)

all_recs = C.build_records()

def render_one(bid):
    rec = [r for r in all_recs if r["id"] == bid]
    if not rec:
        print("missing", bid); return
    def only():
        rs = [dict(r) for r in rec]
        rs.sort(key=lambda r: (round(r["grid"][1], 1), round(r["grid"][0], 1)))
        for i, r in enumerate(rs, 1):
            r["no"] = i
        return rs
    C.numbered_buildings = only
    C.build_nature = lambda: []
    C.build_roads = lambda: []
    C.CANAL = [(130, 40), (130, 40)]   # 零长度点，落在所有目标建筑裁剪框外
    if hasattr(C, "build_pois"):
        C.build_pois = lambda: []
    importlib.reload(R)
    R.LANDMARK = {}          # 去掉建筑名标签
    R.DRAW_LABELS = False    # 去掉编号徽章
    R.render()               # 用干净设置重渲一次
    img = Image_open_framework()
    b = rec[0]
    gx, gy, gw, gh = b["grid"]
    floors = R.STYLE.get(bid, {}).get("floors", 4)
    h = R.FLOOR_H * floors
    # 异形建筑额外留量（弧形/椭圆/小横杠超出 grid）
    extra = {"TEACH-1": 260, "GYM": 220, "FIELD-N": 200, "FIELD-W": 200,
             "LIB": 180, "ACT": 180, "ENG-TRAIN": 180}.get(bid, 150)
    minx, miny, _, _ = R.iso_bounds()
    OX, OY = -minx + 280, -miny + 210
    def P(wx, wy):
        x, y = R.iso(wx, wy); return (x + OX, y + OY)
    cs = [P(gx, gy), P(gx+gw, gy), P(gx+gw, gy+gh), P(gx, gy+gh)]
    x0 = min(p[0] for p in cs); x1 = max(p[0] for p in cs)
    y0 = min(p[1] for p in cs) - h; y1 = max(p[1] for p in cs)
    pad = extra
    box = (int(x0-pad), int(y0-pad), int(x1+pad), int(y1+pad))
    crop = img.crop(box)
    out = os.path.join(OUTDIR, f"{bid}.png")
    crop.save(out)
    print(bid, crop.size, "->", out)

def Image_open_framework():
    from PIL import Image
    return Image.open(os.path.join(HERE, "..", "check", "iso_framework.png")).convert("RGB")

if __name__ == "__main__":
    targets = sys.argv[1:] or ["TEACH-1", "TEACH-2", "LIB", "GYM"]
    for bid in targets:
        render_one(bid)

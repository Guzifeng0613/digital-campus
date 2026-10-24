# -*- coding: utf-8 -*-
"""v2 切帧：在 v1 抠像基础上，逐帧按"躯干核心中线"对齐裁剪框，
消除 AI 精灵表人物在格内逐帧横移导致的左右摇晃/摇头晃脑；
垂直仍按方向统一地面基线（着地帧），腾空帧自然悬空（腾空抬升由运行时 lift 提供）。"""
import numpy as np, os
from PIL import Image
from scipy import ndimage

RAW = "tools/player_raw"; OUT = "img/topdown/player"
CELL_W, CELL_H = 418, 627
DIRS = ["down", "up", "left", "right"]
OUT_W, OUT_H = 48, 64
RECT_H, RECT_W = 520, 390
GROUND_RUN = [0, 1, 3]

def cell_rgba(im, ri, ci):
    c = im.crop((ci * CELL_W, ri * CELL_H, (ci + 1) * CELL_W, (ri + 1) * CELL_H))
    return c.convert("RGBA")

def keyed(c):
    """返回抠像后的 RGBA（品红底/暗品红投影置透明）与最大连通域 mask。"""
    a = np.array(c)
    r, g, b = a[..., 0].astype(np.int16), a[..., 1].astype(np.int16), a[..., 2].astype(np.int16)
    bg = (r > 180) & (g < 120) & (b > 180)
    sh = (r > 110) & (g < 55) & (b > 90) & (r > g + 80) & (b > g + 40)
    a[bg | sh, 3] = 0
    fg = ~(bg | sh)
    lab, n = ndimage.label(fg)
    if n == 0:
        return a, None
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    m = lab == (np.argmax(sizes) + 1)
    return a, m

def core_center(m, lo_frac=0.28, hi_frac=0.60):
    """躯干核心水平中线：取身体高度 28%~60% 段（头下/胸/躯干，避开摆臂与抬腿），
    用该段像素的水平中位数——对单侧摆臂/抬腿的离群像素稳健。"""
    ys, xs = np.where(m)
    t, bt = ys.min(), ys.max(); H = bt - t
    lo = t + int(lo_frac * H); hi = t + int(hi_frac * H)
    seg = (ys >= lo) & (ys <= hi)
    return float(np.median(xs[seg]))

def bounds(m):
    ys, xs = np.where(m)
    return ys.min(), ys.max(), xs.min(), xs.max()

def cut(a, ground, xc):
    """以 (xc, ground) 为底中心固定矩形裁剪，输出 OUT_W x OUT_H（底对齐，NEAREST）。"""
    x0 = int(round(xc - RECT_W / 2)); x1 = x0 + RECT_W
    y1 = int(round(ground)); y0 = y1 - RECT_H
    crop = Image.fromarray(a).crop((max(0, x0), max(0, y0), min(CELL_W, x1), min(CELL_H, y1)))
    fixed = Image.new("RGBA", (RECT_W, RECT_H), (0, 0, 0, 0))
    fixed.paste(crop, (max(0, x0) - x0, max(0, y0) - y0), crop)
    return fixed.resize((OUT_W, OUT_H), Image.NEAREST)

def process(im):
    """返回 {dir: {'ground':g, 'frames':[(ci, xc, rgba),...4]}}。"""
    out = {}
    for ri, d in enumerate(DIRS):
        frames = []
        for ci in range(4):
            a, m = keyed(cell_rgba(im, ri, ci))
            xc = core_center(m)
            frames.append((ci, xc, a, m))
        grounds = [bounds(f[3])[1] for f in frames]
        out[d] = dict(frames=frames, grounds=grounds)
    return out

def main():
    walk = Image.open(os.path.join(RAW, "walk_sheet_v1.png")).convert("RGB")
    run = Image.open(os.path.join(RAW, "run_sheet_v1.png")).convert("RGB")
    W, R = process(walk), process(run)
    os.makedirs(OUT, exist_ok=True)
    for d in DIRS:
        w_ground = max(W[d]['grounds'])                      # walk 全部着地
        r_ground = max(R[d]['grounds'][i] for i in GROUND_RUN)  # run 着地帧
        for ci, xc, a, _ in W[d]['frames']:
            cut(a, w_ground, xc).save(os.path.join(OUT, f"{d}_walk_{ci}.png"))
        cut(W[d]['frames'][0][2], w_ground, W[d]['frames'][0][1]).save(os.path.join(OUT, f"{d}_idle.png"))
        for ci, xc, a, _ in R[d]['frames']:
            cut(a, r_ground, xc).save(os.path.join(OUT, f"{d}_run_{ci}.png"))
        print(f"{d}: walk_ground={w_ground} run_ground={r_ground} "
              f"walk_cx={[round(x[1]) for x in W[d]['frames']]} run_cx={[round(x[1]) for x in R[d]['frames']]}")
    print("v2 对齐完成 ->", OUT)

if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""从 4x4 角色精灵表切帧：品红+暗品红阴影抠像 → 每方向固定裁剪框(脚底对齐/保留腾空) → 缩放到 48x64。"""
import numpy as np, os
from PIL import Image
from scipy import ndimage

RAW = "tools/player_raw"; OUT = "img/topdown/player"
CELL_W, CELL_H = 418, 627
DIRS = ["down", "up", "left", "right"]
OUT_W, OUT_H = 48, 64
RECT_H, RECT_W = 520, 390          # 裁剪框(格内像素)，3:4 与输出一致
GROUND_RUN = [0, 1, 3]             # run 着地帧(用于定地面)，2 为腾空帧

def body_mask(cell):
    arr = np.array(cell).astype(np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bg = (r > 180) & (g < 120) & (b > 180)           # 亮品红底
    shadow = (r > 110) & (g < 55) & (b > 90) & (r > g + 80) & (b > g + 40)  # 暗品红投影
    fg = ~(bg | shadow)
    lab, n = ndimage.label(fg)
    if n == 0: return None
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    return lab == (np.argmax(sizes) + 1), arr

def frame_body(im, ri, ci):
    c = im.crop((ci * CELL_W, ri * CELL_H, (ci + 1) * CELL_W, (ri + 1) * CELL_H))
    m, arr = body_mask(c)
    ys, xs = np.where(m)
    return c, m, (ys.min(), ys.max(), xs.min(), xs.max())

def cut_aligned(im, ri, ci, ground, xc):
    """固定矩形裁剪并输出 OUT_W x OUT_H；矩形底边=ground，中心=xc。"""
    c = im.crop((ci * CELL_W, ri * CELL_H, (ci + 1) * CELL_W, (ri + 1) * CELL_H))
    rgba = c.convert("RGBA")
    a = np.array(rgba)
    r, g, b = a[..., 0].astype(np.int16), a[..., 1].astype(np.int16), a[..., 2].astype(np.int16)
    bg = (r > 180) & (g < 120) & (b > 180)
    shadow = (r > 110) & (g < 55) & (b > 90) & (r > g + 80) & (b > g + 40)
    a[bg | shadow, 3] = 0
    # 裁剪框（clamp 到格内）
    x0 = int(round(xc - RECT_W / 2)); x1 = x0 + RECT_W
    y1 = int(round(ground)); y0 = y1 - RECT_H
    crop = Image.fromarray(a).crop((max(0, x0), max(0, y0), min(CELL_W, x1), min(CELL_H, y1)))
    # 若 clamp 改变尺寸，贴到固定大小透明画布(保持底对齐)
    fixed = Image.new("RGBA", (RECT_W, RECT_H), (0, 0, 0, 0))
    fixed.paste(crop, (max(0, x0) - x0, max(0, y0) - y0), crop)
    return fixed.resize((OUT_W, OUT_H), Image.NEAREST)

def main():
    walk = Image.open(os.path.join(RAW, "walk_sheet_v1.png")).convert("RGB")
    run = Image.open(os.path.join(RAW, "run_sheet_v1.png")).convert("RGB")
    os.makedirs(OUT, exist_ok=True)
    for ri, dr in enumerate(DIRS):
        # 收集 walk / run 身体 bbox
        wb = [frame_body(walk, ri, ci)[2] for ci in range(4)]
        rb = [frame_body(run, ri, ci)[2] for ci in range(4)]
        w_ground = max(b[1] for b in wb)                 # walk 全部着地
        r_ground = max(rb[i][1] for i in GROUND_RUN)     # run 着地帧
        allx = [b[2] for b in wb] + [b[3] for b in wb] + [b[2] for b in rb] + [b[3] for b in rb]
        xc = (min(b[2] for b in wb + rb) + max(b[3] for b in wb + rb)) / 2
        # walk 帧（用 walk 框）
        for ci in range(4):
            cut_aligned(walk, ri, ci, w_ground, xc).save(os.path.join(OUT, f"{dr}_walk_{ci}.png"))
        # run 帧（用 run 框，腾空帧 2 因固定矩形而自然悬空）
        for ci in range(4):
            cut_aligned(run, ri, ci, r_ground, xc).save(os.path.join(OUT, f"{dr}_run_{ci}.png"))
        # idle = walk 第0帧（正面站立）
        cut_aligned(walk, ri, 0, w_ground, xc).save(os.path.join(OUT, f"{dr}_idle.png"))
        print(f"{dr}: walk_ground={w_ground} run_ground={r_ground} xc={xc:.0f}")
    print("36 帧输出完成 ->", OUT)

if __name__ == "__main__":
    main()

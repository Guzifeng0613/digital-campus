#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
#74 把 image_edit 产出的黑底/白底新 sprite 抠成透明底，并按"屋顶顶部对齐 + 水平居中"
对齐到原 sprite 画布，保证建筑主体 footprint/南角锚点不漂移，南门台阶自然向下延伸。
用法: python3 tools/edit_door.py <新图(黑/白底).png> <原sprite(透明).png> <输出.png>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.ndimage import binary_dilation

WHITE_MIN = 228      # 候选白底: 三通道都 >= 该值
WHITE_RANGE = 20     # 且 max-min <= 该值（低饱和近白/浅灰）
BLACK_MAX = 38       # 候选黑底: 三通道都 <= 该值
BLACK_RANGE = 32     # 且 max-min <= 该值（中性黑；深绿投影 range 大不会被抠）


def detect_bg(im):
    a = np.array(im.convert("RGBA"))
    H, W = a.shape[:2]
    px = np.concatenate([a[0:6, 0:6].reshape(-1, 4), a[H-6:H, W-6:W].reshape(-1, 4)])
    lum = px[:, :3].mean()
    return "black" if lum < 100 else "white"


def cut_bg(im):
    """边缘连通填充抠黑底/白底，保留建筑内部同色区域。"""
    a = np.array(im.convert("RGBA"))
    r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    rng = mx - mn
    mode = detect_bg(im)
    if mode == "black":
        cand = (mx <= BLACK_MAX) & (rng <= BLACK_RANGE)
    else:
        cand = (mn >= WHITE_MIN) & (rng <= WHITE_RANGE)
    lab, n = ndimage.label(cand)
    H, W = cand.shape
    edge = set()
    for x in range(W):
        if lab[0, x]: edge.add(lab[0, x])
        if lab[H - 1, x]: edge.add(lab[H - 1, x])
    for y in range(H):
        if lab[y, 0]: edge.add(lab[y, 0])
        if lab[y, W - 1]: edge.add(lab[y, W - 1])
    bg = np.isin(lab, list(edge))
    alpha = np.full((H, W), 255, dtype=np.uint8)
    alpha[bg] = 0
    # 1px 羽化：紧邻背景的边缘像素给半透明，轮廓不生硬
    ring = binary_dilation(bg, iterations=1) & ~bg
    if mode == "white":
        soft = ring & (mn >= 200)
        alpha[soft] = np.clip((mn[soft] - 180) * 255.0 / (WHITE_MIN - 180), 120, 255).astype(np.uint8)
    else:
        soft = ring & (mx <= 70)
        alpha[soft] = np.clip((100 - mx[soft]) * 255.0 / (100 - BLACK_MAX), 120, 255).astype(np.uint8)
    out = a.copy()
    out[:, :, 3] = alpha
    print(f"  bg={mode} bg_removed={bg.mean():.3f}")
    return Image.fromarray(out, "RGBA")


def dense_bbox(im, alpha_th=110, dens=0.012):
    a = np.array(im.convert("RGBA"))[:, :, 3]
    H, W = a.shape
    m = a > alpha_th
    col = m.sum(axis=0) >= max(4, H * dens)
    row = m.sum(axis=1) >= max(4, W * dens)
    xs = np.where(col)[0]; ys = np.where(row)[0]
    if len(xs) == 0: return (0, 0, W, H)
    return (xs[0], ys[0], xs[-1] + 1, ys[-1] + 1)


def main():
    new_p, orig_p, out_p = sys.argv[1], sys.argv[2], sys.argv[3]
    orig = Image.open(orig_p).convert("RGBA")
    OW, OH = orig.size
    new = Image.open(new_p).convert("RGBA")
    cut = cut_bg(new)
    nb = dense_bbox(cut)
    ob = dense_bbox(orig)
    ent = cut.crop(nb)
    ew, eh = ent.size
    ow, oh = ob[2] - ob[0], ob[3] - ob[1]
    s = ow / ew
    nw, nh = max(1, round(ew * s)), max(1, round(eh * s))
    ent = ent.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (OW, OH), (0, 0, 0, 0))
    cx = (ob[0] + ob[2]) // 2
    px = int(cx - nw / 2)
    py = ob[1]
    canvas.alpha_composite(ent, (px, py))
    canvas.save(out_p)
    print(f"saved {out_p}  orig_bbox={ob} new_aligned=({px},{py},{px+nw},{py+nh})")


if __name__ == "__main__":
    main()

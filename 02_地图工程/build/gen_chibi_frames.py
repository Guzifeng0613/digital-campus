# -*- coding: utf-8 -*-
"""将 seedream 生成的 chibi 像素女孩精灵图（raw_chibi_sheet.png, 2048x2048, 白底绿格）
切割/抠绿/对齐，输出 4 方向 x 4 走路帧 = 16 张统一 64x80 透明底 PNG 到 Cocos resources/player。"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(__file__)
SRC = os.path.join(HERE, "raw_chibi_sheet.png")
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "04_Cocos工程", "assets", "resources", "player"))
SHEET_OUT = os.path.abspath(os.path.join(HERE, "..", "assets", "catalog", "像素角色序列帧_chibi_4x4.png"))
os.makedirs(OUT, exist_ok=True)

COLS = [(48, 501), (547, 1001), (1046, 1500), (1547, 1999)]
ROWS = [(51, 506), (550, 1004), (1048, 1502), (1547, 1999)]
OUT_W, OUT_H, TARGET_H = 64, 80, 76

FRAMES = {
    "down": [(0, 0), (0, 1), (0, 2), (0, 3)],
    "up":   [(1, 0), (1, 1), (1, 2), (1, 3)],
    "left": [(2, 0), (3, 0), (2, 1), (3, 1)],
}


def cell(r, c):
    x0, x1 = COLS[c]; y0, y1 = ROWS[r]
    return Image.open(SRC).convert("RGB").crop((x0, y0, x1, y1))


def green_to_alpha(img):
    a = np.array(img).astype(float) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    diff = mx - mn
    h = np.zeros_like(mx)
    md = diff > 1e-6
    h = np.where((mx == g) & md, (2.0 + (b - r) / (diff + 1e-9)) / 6.0, h)
    h = np.where((mx == r) & md, (((g - b) / (diff + 1e-9)) % 6.0) / 6.0, h)
    h = np.where((mx == b) & md, (4.0 + (r - g) / (diff + 1e-9)) / 6.0, h)
    s = np.where(mx > 0, diff / (mx + 1e-9), 0)
    v = mx
    green = (h > 0.18) & (h < 0.42) & (s > 0.18) & (v > 0.55)
    alpha = np.where(green, 0, 255).astype(np.uint8)

    # 与透明边缘相邻、且偏绿的像素（绿边渗透）也清掉
    opaque = alpha > 0
    near = ndimage.binary_dilation(~opaque, iterations=2) & opaque
    r8, g8, b8 = a[..., 0] * 255, a[..., 1] * 255, a[..., 2] * 255
    greenish = (g8 > r8 + 18) & (g8 > b8 + 18)
    alpha[near & greenish] = 0

    out = np.dstack([np.array(img), alpha]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def normalize(img):
    img = green_to_alpha(img)
    bbox = img.getbbox()
    if not bbox:
        return img
    crop = img.crop(bbox)
    cw, ch = crop.size
    scale = TARGET_H / ch
    nw = max(1, round(cw * scale))
    crop = crop.resize((nw, TARGET_H), Image.NEAREST)
    canvas = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 0))
    canvas.paste(crop, ((OUT_W - nw) // 2, OUT_H - TARGET_H), crop)
    return canvas


def main():
    sheet = Image.new("RGBA", (OUT_W * 4, OUT_H * 4), (0, 0, 0, 0))
    for di, direction in enumerate(["down", "up", "left", "right"]):
        for fi in range(4):
            r, c = FRAMES["left"][fi] if direction == "right" else FRAMES[direction][fi]
            img = normalize(cell(r, c))
            if direction == "right":
                img = img.transpose(Image.FLIP_LEFT_RIGHT)
            img.save(os.path.join(OUT, f"player_{direction}_{fi}.png"))
            sheet.paste(img, (fi * OUT_W, di * OUT_H), img)
    sheet.save(SHEET_OUT)
    print("chibi 16 帧 ->", OUT)
    print("精灵图 ->", SHEET_OUT)


if __name__ == "__main__":
    main()

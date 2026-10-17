#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
像素化后处理：把 seedream 生成的高清等距建筑图统一转为等距像素风资产。
流程：LANCZOS 降采样到逻辑分辨率 -> 有限色板量化（无抖动）-> NEAREST 放大。
统一 target_w/colors 可保证全校园所有建筑的像素密度与色板一致，便于拼回地图。
用法：python3 pixelate.py <src.png> <dst.png> [target_w=400] [colors=32] [scale=4]
"""
import sys
from PIL import Image


def pixelate(src, dst, target_w=400, colors=32, scale=4):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    th = max(1, round(h * target_w / w))
    small = im.resize((target_w, th), Image.LANCZOS)
    if colors and colors > 0:
        small = small.quantize(colors=colors, method=Image.MEDIANCUT,
                               dither=Image.NONE).convert("RGB")
    out = small.resize((target_w * scale, th * scale), Image.NEAREST)
    out.save(dst)
    print(f"{src} -> {dst} 逻辑{target_w}x{th} {colors}色 输出{out.size}")


if __name__ == "__main__":
    a = sys.argv
    tw = int(a[3]) if len(a) > 3 else 400
    col = int(a[4]) if len(a) > 4 else 32
    sc = int(a[5]) if len(a) > 5 else 4
    pixelate(a[1], a[2], tw, col, sc)

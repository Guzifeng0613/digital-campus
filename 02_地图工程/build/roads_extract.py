# -*- coding: utf-8 -*-
"""
从官方平面图（official_map.jpg）提取真实道路网。
- 官方图：上北下南，像素坐标，校园主体范围见 campus_data.PX_*。
- 道路=三通道都高的浅色（白/浅灰）；绿地 R 低、建筑粉 G 低，据此区分。
- 校园东/北侧大片浅色空地为“面状”，用大核腐蚀分离；道路为“线状”，保留。
- 输出：路面 mask + 路肩 mask（路肩=路面微膨胀），供等距渲染按网格采样。
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(__file__)
OFFICIAL = os.path.join(HERE, "..", "..", "01_资料与参考", "official_map.jpg")

_cache = {}


def _extract():
    if "road" in _cache:
        return _cache["road"], _cache["shoulder"]
    im = Image.open(OFFICIAL).convert("RGB")
    a = np.array(im).astype(int)
    H, W = a.shape[:2]
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    white = (R > 180) & (G > 170) & (B > 165)
    # 校园主体 ROI（排除左侧标题栏、右上文字说明框、右下标注框）
    roi = np.zeros((H, W), bool)
    roi[34:896, 128:562] = True
    yy, xx = np.mgrid[0:H, 0:W]
    roi &= ~((xx > 433) & (yy < 315))
    roi &= ~((xx > 440) & (yy > 872))   # 右下“主校门”文字框（南缘由校园多边形收紧）
    roi &= ~((xx > 132) & (xx < 215) & (yy > 782) & (yy < 892))  # 左下指北针罗盘+制图文注
    m = white & roi
    # 大核腐蚀：仅大块空地内部存活；线状道路（<~8px）被腐蚀殆尽
    core = ndi.binary_erosion(m, iterations=7)
    big = ndi.binary_dilation(core, iterations=6)
    road = m & ~big
    road = ndi.binary_closing(road, iterations=2)   # 连接文字/图标造成的断裂（不做 opening，避免断窄连接）
    # 校园轮廓多边形（上北下南），剔除地图外/边缘残留
    campus = [(103,40),(160,34),(230,28),(300,23),(370,21),(420,27),(435,34),(443,55),
              (458,130),(478,205),(498,290),(520,345),(528,430),(529,520),(522,560),
              (530,600),(505,690),(472,760),(430,798),(415,822),(408,848),(396,864),
              (365,872),(335,868),(290,866),(250,862),(210,872),(180,880),(152,864),
              (138,800),(122,700),(108,600),(103,460),(103,300),(103,150),(103,40)]
    from PIL import ImageDraw
    pm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(pm).polygon(campus, fill=1)
    road = road & (np.array(pm) > 0)
    # 面状道路（不骨架化）：骨架化会在交叉口/宽窄变化处把路网剪成碎片。
    # 顺序——先腐蚀去窄（剔除细铺装/步行小径，保留车行道与主步行路），
    # 再闭运算把宽路在建筑/文字处的断口连起来，最后只留大连通域与硬化广场。
    # 由 ground_layer 整面 warpAffine 平滑到等距地面，保留真实路宽与走向。
    # 面状道路（不骨架化）：先腐蚀得到“宽路骨架”（剔除细铺装/步行小径），
    # 但腐蚀会切断跨河窄桥（中央景观河/柳湖/南湖上宽仅2-3px的东西向桥），
    # 把东半部路网孤立。改用“窄通道重建”：从宽路骨架的大域出发，只沿
    # 宽度<4px的窄通道（桥、窄路口）恢复连通，绝不进入大面积铺装（避免龟裂纹）。
    base = road
    e1 = ndi.binary_erosion(base, iterations=1)
    _l1, _n1 = ndi.label(e1)
    _s1 = np.bincount(_l1.ravel())
    _seeds = np.isin(_l1, np.setdiff1d(np.where(_s1 > 120)[0], [0]))
    _dt = ndi.distance_transform_edt(base)
    _narrow = base & (_dt < 2.0)
    road = ndi.binary_propagation(_seeds, mask=(_seeds | _narrow))
    lab, n = ndi.label(road)
    sizes = np.bincount(lab.ravel())
    road = np.isin(lab, np.setdiff1d(np.where(sizes > 100)[0], 0))
    # 平滑路缘：高斯阈值磨掉官方图路缘的锯齿/毛刺，再闭运算填小孔。
    # 注意：窄通道重建恢复的跨河桥仅 1-2px 宽，直接高斯 σ1.1 会把它阈值化
    # 殆尽而断开主网；先 dilate1 护住窄桥，高斯后再 erode1 还原宽度。
    road = ndi.binary_dilation(road, iterations=1)
    road = ndi.gaussian_filter(road.astype(np.float32), 1.1) > 0.5
    road = ndi.binary_erosion(road, iterations=1)
    road = ndi.binary_closing(road, iterations=2)
    lab, n = ndi.label(road)
    sizes = np.bincount(lab.ravel())
    road = np.isin(lab, np.setdiff1d(np.where(sizes > 120)[0], 0))
    shoulder = ndi.binary_dilation(road, iterations=1)
    _cache["road"], _cache["shoulder"] = road, shoulder
    return road, shoulder


def masks():
    return _extract()


def ground_layer(K=8, face=(208, 204, 192), edge=(150, 148, 138)):
    """生成正交网格地面上的道路层（RGBA，K 像素/grid）。
    非道路透明；道路=深色路肩 + 浅色路面，边缘做平滑。供 render_iso 一次
    仿射变换到等距平面（双线性插值，避免逐瓦片块状边缘）。"""
    import cv2
    import campus_data as C
    road, _ = _extract()
    x0, y0, x1, y1 = int(C.PX_X0), int(C.PX_Y0), int(C.PX_X1), int(C.PX_Y1)
    Wg = int(round((C.GX1 - C.GX0) * K))
    Hg = int(round((C.GY1 - C.GY0) * K))
    roi = road[y0:y1, x0:x1].astype(np.float32)
    g = cv2.resize(roi, (Wg, Hg), interpolation=cv2.INTER_LINEAR)
    gface = (g > 0.5).astype(np.float32)
    ke = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    gedge = cv2.dilate(gface, ke, iterations=1)
    # 边缘羽化，配合 warpAffine 双线性，路面与路肩过渡平滑
    gfa = cv2.GaussianBlur(gface, (5, 5), 1.3)
    gea = cv2.GaussianBlur(gedge, (5, 5), 1.3)
    rgba = np.zeros((Hg, Wg, 4), np.float32)
    rgba[:, :, 0] = edge[0] * gea
    rgba[:, :, 1] = edge[1] * gea
    rgba[:, :, 2] = edge[2] * gea
    rgba[:, :, 3] = gea * 255
    af = gfa[:, :, None]
    rgba[:, :, :3] = rgba[:, :, :3] * (1 - af) + np.array(face)[None, None, :] * af
    rgba[:, :, 3] = np.maximum(rgba[:, :, 3], gfa * 255)
    rgba = np.clip(rgba, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def is_road_gxgy(gx, gy, which="road"):
    """网格坐标点是否落在道路（road）/路肩（shoulder）。"""
    import campus_data as C
    x = int(round((gx - C.GX0) / C._SCALE + C.PX_X0))
    y = int(round((gy - C.GY0) / C._SCALE + C.PX_Y0))
    road, shoulder = _extract()
    arr = shoulder if which == "shoulder" else road
    if y < 0 or y >= arr.shape[0] or x < 0 or x >= arr.shape[1]:
        return False
    return bool(arr[y, x])

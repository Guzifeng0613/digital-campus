# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont
import os
BASE = "/home/user/Doubao/chats/38447367988429826/digital-campus"
SINGLE = os.path.join(BASE, "02_地图工程/check/single")
PHOTO = os.path.join(BASE, "01_资料与参考/官方照片")
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
f_name = ImageFont.truetype(FONT, 38)
f_tag = ImageFont.truetype(FONT, 28)
f_note = ImageFont.truetype(FONT, 25)

rows = [
    ("TEACH-2", "第二教学楼", "TEACH-2.png", "TEACH-2/ref01_roof_complex.jpg",
     "红砖多体块围合院落群：双内院（一绿一铺地）+ 南缘入口凹口"),
    ("LIB", "图书馆", "LIB.png", "LIB/ref01_roof_aerial.jpg",
     "连续折线单一体量（东侧连体不分离）+ 中央三角形玻璃采光中庭"),
    ("ACT", "大学生活动中心", "ACT.png", "ACT/ref02_roof_aerial.jpg",
     "单一白色菱形穿孔体量（两翼南连）+ 3 矩形天窗 + 南缘波浪檐口"),
    ("WENLI", "文理楼", "WENLI.png", "WENLI/ref01_lawn_view.jpg",
     "红砖墙（非蓝色）C 形围合院落，朝西开口，4 层"),
    ("CAN-YULAN", "玉兰食堂", "CAN-YULAN.png", "CAN-YULAN/ref01_full_view.jpg",
     "红砖双盒体交错层叠（高3层+矮2层）+ 南侧室外大台阶 + 顶层蓝玻带"),
    ("LAB", "实验楼群", "LAB.png", "LAB-H/ref03_courtyard_gridcanopy.jpg",
     "6 栋贯通为两进合院环 + 西翼 Π 形玻璃门厅 + 两内院白色钢网格遮阳棚"),
]

H = 440
LABELW = 330
COLGAP = 24
ROWGAP = 34
PAD = 34


def fit(im, w, h):
    im = im.convert("RGB")
    s = min(w / im.width, h / im.height)
    nw, nh = max(1, int(im.width * s)), max(1, int(im.height * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGB", (w, h), (245, 246, 240))
    canvas.paste(im, ((w - nw) // 2, (h - nh) // 2))
    return canvas


colw = 720
totalW = PAD * 2 + LABELW + colw * 2 + COLGAP * 2
totalH = PAD * 2 + len(rows) * H + (len(rows) - 1) * ROWGAP + 70
canvas = Image.new("RGB", (totalW, totalH), (232, 236, 228))
d = ImageDraw.Draw(canvas)
d.text((PAD, 18), "A组几何重写 · 新2.5D框架 vs 真实照片（外形校准后）", font=f_name, fill=(40, 46, 52))

for i, (bid, name, fp, ph, note) in enumerate(rows):
    y = PAD + 70 + i * (H + ROWGAP)
    fw = Image.open(os.path.join(SINGLE, fp))
    pp = Image.open(os.path.join(PHOTO, ph))
    imf = fit(fw, colw, H)
    imp = fit(pp, colw, H)
    d.text((PAD + 10, y + 80), name, font=f_name, fill=(28, 40, 58))
    line = ""
    yy = y + 145
    for ch in note:
        line += ch
        if len(line) >= 12:
            d.text((PAD + 12, yy), line, font=f_note, fill=(74, 84, 94))
            yy += 36
            line = ""
    if line:
        d.text((PAD + 12, yy), line, font=f_note, fill=(74, 84, 94))
    x1 = PAD + LABELW
    canvas.paste(imf, (x1, y))
    canvas.paste(imp, (x1 + colw + COLGAP, y))
    d.rectangle([x1 + 8, y + 8, x1 + 210, y + 46], fill=(150, 72, 54))
    d.text((x1 + 20, y + 10), "新 2.5D 框架", font=f_tag, fill=(255, 255, 255))
    x2 = x1 + colw + COLGAP
    d.rectangle([x2 + 8, y + 8, x2 + 150, y + 46], fill=(52, 92, 128))
    d.text((x2 + 20, y + 10), "真实照片", font=f_tag, fill=(255, 255, 255))
    d.rectangle([x1, y, x1 + colw * 2 + COLGAP, y + H], outline=(170, 178, 168), width=2)

out = os.path.join(BASE, "02_地图工程/check/A组几何对比_框架vs照片.png")
canvas.save(out)
print(out, canvas.size)

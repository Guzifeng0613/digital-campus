# -*- coding: utf-8 -*-
"""程序化生成像素角色序列帧：4 方向(down/up/left/right) × 4 走路帧 = 16 张 64x64 PNG。
风格与网页预览器代码小人一致（红上衣/深蓝裤/黑发/肤色），帧精确、可复现。"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "04_Cocos工程", "assets", "resources", "player"))
os.makedirs(OUT, exist_ok=True)

GRID = 16          # 像素网格 16x16
SCALE = 4          # 放大到 64x64

# 配色（与网页版 Graphics 小人一致）
SKIN = (242, 199, 155, 255)
HAIR = (58, 42, 28, 255)
SHIRT = (217, 79, 58, 255)
SHIRT_D = (184, 60, 43, 255)
PANTS = (43, 52, 80, 255)
SHOES = (26, 33, 56, 255)
EYE = (39, 32, 50, 255)


def new_canvas():
    return Image.new("RGBA", (GRID * SCALE, GRID * SCALE), (0, 0, 0, 0))


def px(draw, x, y, c):
    if 0 <= x < GRID and 0 <= y < GRID:
        draw.rectangle([x * SCALE, y * SCALE, (x + 1) * SCALE - 1, (y + 1) * SCALE - 1], fill=c)


def draw_frame(direction: str, frame: int) -> Image.Image:
    img = new_canvas()
    d = ImageDraw.Draw(img)
    side = direction in ("left", "right")
    face_x = range(5, 10) if side else range(5, 11)
    body_x = range(5, 10) if side else range(5, 11)

    # 头发
    for x in range(6, 10): px(d, x, 1, HAIR)
    for x in range(5, 11): px(d, x, 2, HAIR)
    # 脸
    for y in (3, 4):
        for x in face_x: px(d, x, y, SKIN)
    if direction == "down":
        px(d, 6, 3, EYE); px(d, 8, 3, EYE)
    elif direction == "up":
        for x in face_x: px(d, x, 3, HAIR)   # 后脑勺
    elif side:
        px(d, 7, 3, EYE)
    # 身体 + 领口
    for y in range(5, 10):
        for x in body_x: px(d, x, y, SHIRT)
    for x in body_x: px(d, x, 5, SHIRT_D)
    # 手臂摆动（frame1 左臂前，frame3 右臂前）
    arm_l = -1 if frame == 1 else 0
    arm_r = -1 if frame == 3 else 0
    if not side:
        for y in range(6, 10):
            px(d, 4 + arm_l, y, SHIRT)
            px(d, 11 - arm_r, y, SHIRT)
    else:
        for y in range(6, 10):
            px(d, 4 + arm_l, y, SHIRT)
    # 腿（frame1 左腿前迈，frame3 右腿前迈）
    leg_l = -1 if frame == 1 else 0
    leg_r = -1 if frame == 3 else 0
    if not side:
        lx0, lx1 = 5 + leg_l, 7 + leg_l
        rx0, rx1 = 9 + leg_r, 11 + leg_r
    else:
        lx0, lx1 = 5 + leg_l, 7 + leg_l
        rx0, rx1 = 8 + leg_r, 10 + leg_r
    for y in range(10, 12):
        for x in range(lx0, lx1): px(d, x, y, PANTS)
        for x in range(rx0, rx1): px(d, x, y, PANTS)
    for x in range(lx0, lx1): px(d, x, 12, SHOES)
    for x in range(rx0, rx1): px(d, x, 12, SHOES)

    if direction == "right":
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img


def main():
    directions = ["down", "up", "left", "right"]
    sheet = Image.new("RGBA", (GRID * SCALE * 4, GRID * SCALE * 4), (0, 0, 0, 0))
    for di, direction in enumerate(directions):
        for frame in range(4):
            img = draw_frame(direction, frame)
            name = f"player_{direction}_{frame}.png"
            img.save(os.path.join(OUT, name))
            sheet.paste(img, (frame * GRID * SCALE, di * GRID * SCALE))
    sheet_path = os.path.join(OUT, "..", "player_sheet.png")
    sheet.save(sheet_path)
    print("生成 16 帧 →", OUT)
    print("精灵图预览 →", sheet_path)


if __name__ == "__main__":
    main()

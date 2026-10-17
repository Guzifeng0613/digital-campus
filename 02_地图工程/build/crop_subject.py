# -*- coding: utf-8 -*-
from PIL import Image
import os
S="../check/single"; O="../check/pixel"; os.makedirs(O,exist_ok=True)
def is_bg(p):
    r,g,b=p[:3]
    return g>168 and r>180 and b>158   # 棋盘格浅绿背景
for ID in ["GYM","FIELD-W","FIELD-N","ENG-TRAIN"]:
    im=Image.open(f"{S}/{ID}.png").convert("RGB")
    w,h=im.size; px=im.load()
    xs=[]; ys=[]
    # 步长采样加速
    for y in range(0,h,3):
        for x in range(0,w,3):
            if not is_bg(px[x,y]):
                xs.append(x); ys.append(y)
    if not xs:
        print(ID,"no subject"); continue
    x0,x1=max(0,min(xs)-8),min(w,max(xs)+8)
    y0,y1=max(0,min(ys)-8),min(h,max(ys)+8)
    cw,ch=x1-x0,y1-y0
    m=int(max(cw,ch)*0.10)+10
    # 正方形留边（偏下方给草地底座）
    side=max(cw,ch)+2*m
    cx=(x0+x1)//2; cy=(y0+y1)//2
    l=max(0,cx-side//2); t=max(0,cy-side//2)
    l=min(l,max(0,w-side)); t=min(t,max(0,h-side))
    crop=im.crop((l,t,l+min(side,w-l),t+min(side,h-t)))
    crop.save(f"{O}/pre_{ID}.png")
    print(ID,im.size,"->",crop.size)

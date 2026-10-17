# -*- coding: utf-8 -*-
from PIL import Image
import os
S="../check/single"; O="../check/pixel"; os.makedirs(O,exist_ok=True)
def is_bg(p):
    r,g,b=p[:3]
    return g>168 and r>180 and b>158
IDS=["GATE-S","GATE-W","GATE-E","CAN-ZIZHU","TEACH-2","LIB","WENLI","ACT","CAN-YULAN","LAB-TECH","MOUNT-YUPING"]
for ID in IDS:
    f=f"{S}/{ID}.png"
    if not os.path.exists(f): print(ID,"missing"); continue
    im=Image.open(f).convert("RGB"); w,h=im.size; px=im.load()
    xs=[];ys=[]
    for y in range(0,h,3):
        for x in range(0,w,3):
            if not is_bg(px[x,y]): xs.append(x);ys.append(y)
    if not xs: print(ID,"no subject"); continue
    x0,x1=max(0,min(xs)-8),min(w,max(xs)+8); y0,y1=max(0,min(ys)-8),min(h,max(ys)+8)
    cw,ch=x1-x0,y1-y0; m=int(max(cw,ch)*0.10)+12
    side=max(cw,ch)+2*m; cx=(x0+x1)//2; cy=(y0+y1)//2
    l=max(0,min(cx-side//2,w-side)); t=max(0,min(cy-side//2,h-side))
    side=min(side,w-l,h-t)
    crop=im.crop((l,t,l+side,t+side)); crop.save(f"{O}/pre_{ID}.png")
    print(ID,im.size,"->",crop.size)

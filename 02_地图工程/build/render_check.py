# -*- coding: utf-8 -*-
"""阶段A核对：渲染正交俯视网格图 + 官方图叠加核对图。"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import campus_data as C

OUT = os.path.join(os.path.dirname(__file__), "..", "check")
os.makedirs(OUT, exist_ok=True)
REF = os.path.join(os.path.dirname(__file__), "..", "..", "01_资料与参考", "official_map.jpg")

def hex2rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
              "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

# ============ 1) 正交俯视网格图 ============
S = 14  # 每瓦片像素
M = 60
W = (C.GW)*S + M*2; H = (C.GH)*S + M*2
img = Image.new("RGB",(W,H),(226,236,220))
d = ImageDraw.Draw(img)
fb = font(15); fs = font(11)

def g2px(gx,gy):
    return (M+gx*S, M+gy*S)

# 网格底
for x in range(0,C.GW+1,5):
    X0,_=g2px(x,0); X1,_=g2px(x,C.GH)
    d.line([(X0,M),(X0,M+C.GH*S)],fill=(210,222,205),width=1)
for y in range(0,C.GH+1,5):
    _,Y0=g2px(0,y); _,Y1=g2px(C.GW,y)
    d.line([(M,Y0),(M+C.GW*S,Y0)],fill=(210,222,205),width=1)

# 自然
for n in C.build_nature():
    col = hex2rgb(C.CATEGORIES[n["cat"]][1])
    if n["shape"]=="poly":
        pts=[g2px(x,y) for x,y in n["gpoly"]]
        d.polygon(pts,fill=col,outline=(40,110,40))
    else:
        gx,gy,gw,gh=n["grid"]
        x0,y0=g2px(gx,gy); x1,y1=g2px(gx+gw,gy+gh)
        d.rectangle([x0,y0,x1,y1],fill=col,outline=(40,110,40))

# 道路（粗白线）
for r in C.build_roads():
    pts=[g2px(x,y) for x,y in r["gpts"]]
    d.line(pts,fill=(235,235,230),width=max(2,int(r["w"]*S/10)),joint="curve")

# 建筑
recs=C.build_records()
for b in recs:
    gx,gy,gw,gh=b["grid"]
    col=hex2rgb(C.CATEGORIES[b["cat"]][1])
    x0,y0=g2px(gx,gy); x1,y1=g2px(gx+gw,gy+gh)
    alpha=160 if b["status"]=="building" else 255
    fill=tuple(int(255-(255-c)*alpha/255) for c in col)+(255,)
    if b["shape"]=="ellipse":
        d.ellipse([x0,y0,x1,y1],fill=col,outline=(60,40,30),width=2)
    else:
        d.rectangle([x0,y0,x1,y1],fill=col,outline=(60,40,30),width=2)
        if b["status"]=="building":
            d.line([x0,y1,x1,y0],fill=(255,255,255),width=2)
    # 标签（ID短号）
    sid=b["id"].split("-")[-1]
    cx,cy=(x0+x1)//2,(y0+y1)//2
    d.text((cx-16,cy-7),sid,fill=(255,255,255),font=fb)

# POI
for p in C.build_pois():
    x,y=g2px(*p["grid"]); d.ellipse([x-4,y-4,x+4,y+4],fill=(241,196,15),outline=(120,80,0))

# 标题/图例
d.text((20,16),"BUCT Changping Campus - Orthographic Framework (for review)",fill=(30,40,30),font=font(20))
lx,ly=20,H-360
d.text((lx,ly-26),"Legend",fill=(20,20,20),font=fb)
for i,(k,(zh,hex_)) in enumerate(C.CATEGORIES.items()):
    yy=ly+i*22
    d.rectangle([lx,yy,lx+18,yy+16],fill=hex2rgb(hex_),outline=(50,50,50))
    d.text((lx+24,yy+1),zh,fill=(20,20,20),font=fs)
img.save(os.path.join(OUT,"ortho_overview.png"))
print("saved ortho_overview.png", img.size)

# ============ 2) 官方图叠加核对 ============
ref=Image.open(REF).convert("RGBA")
ov=Image.new("RGBA",ref.size,(0,0,0,0))
od=ImageDraw.Draw(ov)
def g2ref(gx,gy):
    px=(gx-C.GX0)/(C.GX1-C.GX0)*(C.PX_X1-C.PX_X0)+C.PX_X0
    py=(gy-C.GY0)/(C.GY1-C.GY0)*(C.PX_Y1-C.PX_Y0)+C.PX_Y0
    return (px,py)
for n in C.build_nature():
    gx,gy,gw,gh=n["grid"]
    if n["shape"]=="poly":
        pts=[g2ref(x,y) for x,y in n["gpoly"]]
        od.polygon(pts,fill=(0,180,0,60),outline=(0,120,0,255))
for b in recs:
    gx,gy,gw,gh=b["grid"]
    x0,y0=g2ref(gx,gy); x1,y1=g2ref(gx+gw,gy+gh)
    col=hex2rgb(C.CATEGORIES[b["cat"]][1])
    if b["shape"]=="ellipse":
        od.ellipse([x0,y0,x1,y1],outline=(255,0,0,255),width=2)
        od.ellipse([x0,y0,x1,y1],fill=col+(70,))
    else:
        od.rectangle([x0,y0,x1,y1],fill=col+(70,),outline=(255,0,0,255),width=2)
    sid=b["id"].split("-")[-1]
    od.text((x0+1,y0-12),sid,fill=(200,0,0,255),font=font(11))
merged=Image.alpha_composite(ref,ov).convert("RGB")
merged.save(os.path.join(OUT,"overlay_check.png"))
print("saved overlay_check.png", merged.size)

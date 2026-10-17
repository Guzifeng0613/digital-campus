# -*- coding: utf-8 -*-
"""把16个透明底像素资产按等距坐标贴回干净底图，生成总体排布资产图。"""
import os, json, importlib
HERE=os.path.dirname(__file__); import sys; sys.path.insert(0,HERE)
import campus_data as C
from PIL import Image
import numpy as np
# 干净底图（与 render_base 同设置）
nat=[n for n in C.build_nature() if n["cat"]!="mountain"]
C.numbered_buildings=lambda:[]
C.build_nature=lambda:nat
import render_iso as R
importlib.reload(R)
R.LANDMARK={}; R.DRAW_LABELS=False
R.DRAW_CANOPY=False; R.DRAW_POI=False
R.render()
img=Image.open(os.path.join(HERE,"..","check","iso_framework.png")).convert("RGBA")
_minx,_miny,_maxx,_maxy=R.iso_bounds()
OX,OY=-_minx+280,-_miny+210
def P(gx,gy):
    x,y=R.iso(gx,gy); return (x+OX,y+OY)

manifest=json.load(open(os.path.join(HERE,"..","assets","manifest.json"),encoding="utf-8"))
items=manifest["items"]
SIDE=0.07   # 地块侧面厚度占菱形宽比例（经验值）
placed=[]
for m in items:
    g=m["grid"]; gx,gy,gw,gh=g["gx"],g["gy"],g["gw"],g["gh"]
    sp=Image.open(os.path.join(HERE,"..",m["file"])).convert("RGBA")
    arr=np.array(sp); a=arr[:,:,3]
    ys,xs=np.where(a>10); x0,x1=xs.min(),xs.max(); y0,y1=ys.min(),ys.max()
    bw=x1-x0; bh=y1-y0
    cx,cy=P(gx+gw/2,gy+gh/2)
    fx,fy=P(gx+gw,gy+gh)
    Wd=(gw+gh)*R.TW/2.0
    s=Wd/bw
    nw,nh=int(bw*s),int(bh*s)
    sp2=sp.resize((nw,nh),Image.LANCZOS)
    # 地块菱形水平中心=cx；顶面前顶点(bbox底-侧面)=fy
    side=SIDE*Wd
    paste_x=int(cx-nw/2)
    paste_y=int(fy - nh)  # bbox底≈fy（侧面压在前顶点，先近似）
    placed.append((gx+gy,paste_x,paste_y,sp2,m["id"]))
# 按深度（后到前）
placed.sort(key=lambda t:t[0])
for depth,px,py,sp2,id in placed:
    img.alpha_composite(sp2,(px,py))
# 编号徽章（最高层，地块中心）
from PIL import ImageDraw, ImageFont
_pil=ImageDraw.Draw(img)
try:
    _f=ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",34)
except Exception:
    _f=ImageFont.load_default()
for depth,px,py,sp2,id in placed:
    m=[x for x in items if x["id"]==id][0]
    g=m["grid"]; gx,gy,gw,gh=g["gx"],g["gy"],g["gw"],g["gh"]
    cx,cy=P(gx+gw/2,gy+gh/2)
    # 放到地块后缘中点正上方（建筑北侧草地，避开楼体）
    bx,by=P(gx+gw/2,gy); by-=24
    rr=30
    _pil.ellipse([bx-rr,by-rr,bx+rr,by+rr],fill=(255,255,255,235),outline=(40,60,80,255),width=4)
    t=str(m["no"]); tw=_pil.textlength(t,font=_f)
    _pil.text((bx-tw/2,by-22),t,fill=(30,45,65,255),font=_f)

# 裁剪到地图菱形（去掉标题/图例/指北针）；画布坐标=iso-min+边距
_minx,_miny,_maxx,_maxy=R.iso_bounds()
L=150; T=110; Rt=int((_maxx-_minx)+280+130); B=int((_maxy-_miny)+210+170)
crop=img.crop((L,T,Rt,B)).convert("RGB")
crop.save(os.path.join(HERE,"..","assets","catalog","总体排布资产图.png"))
print("总图",crop.size)

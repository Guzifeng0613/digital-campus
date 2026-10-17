# -*- coding: utf-8 -*-
"""单栋等距立绘：玉屏山（双峰山体）自然地标。"""
import sys, os, importlib
HERE=os.path.dirname(__file__); sys.path.insert(0,HERE)
import campus_data as C
import render_iso as R
OUT=os.path.join(HERE,"..","check","single"); os.makedirs(OUT,exist_ok=True)
nat=[n for n in C.build_nature() if n["id"]=="N-MOUNT-YUPING"]
C.numbered_buildings=lambda:[]
C.build_nature=lambda:nat
C.build_roads=lambda:[]
C.CANAL=[(130,40),(130,40)]
if hasattr(C,"build_pois"): C.build_pois=lambda:[]
importlib.reload(R)
R.LANDMARK={}; R.DRAW_LABELS=False
R.render()
from PIL import Image
img=Image.open(os.path.join(HERE,"..","check","iso_framework.png")).convert("RGB")
gx,gy,gw,gh=nat[0]["grid"]
h=R.FLOOR_H*3
minx,miny,_,_=R.iso_bounds(); OX,OY=-minx+280,-miny+210
def P(wx,wy):
    x,y=R.iso(wx,wy); return (x+OX,y+OY)
cs=[P(gx,gy),P(gx+gw,gy),P(gx+gw,gy+gh),P(gx,gy+gh)]
x0=min(p[0] for p in cs);x1=max(p[0] for p in cs);y0=min(p[1] for p in cs)-h;y1=max(p[1] for p in cs)
pad=150
crop=img.crop((int(x0-pad),int(y0-pad),int(x1+pad),int(y1+pad)))
crop.save(os.path.join(OUT,"MOUNT-YUPING.png")); print("MOUNT",crop.size)

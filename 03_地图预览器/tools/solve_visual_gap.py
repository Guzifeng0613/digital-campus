#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
#73 等距屏幕 AABB 约束求解 v2：保持真实相对方位（偏序）+ 位移上限的最小推离。
- 锚定：山体/两操场/三校门。
- 偏序约束：任意两栋的屏幕 U=gx-gy（左右）、V=gx+gy（上下）相对顺序不翻转。
- 位移上限：可移动栋距原位 ≤ MAXD 格，避免飞楼；超出会报告无解对。
- 间隙约束：屏幕实体 AABB 任一方向分离 ≥ GAP。
"""
import json, subprocess, os, sys, shutil, math, re
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite_visual_pack import (ROOT, SPR, ANCHOR_AY, ANCHOR_AX, ISO_K,
                                load_buildings, entity_bbox)
TW=64
ANCHORS={"MOUNT-YUPING","FIELD-N","FIELD-W","GATE-S","GATE-E","GATE-W"}
MAXD=14.0
GAP_MAIN=72
def gap_required(a,b):
    ids={a,b}
    if "MOUNT-YUPING" in ids: return 0
    if any(x.startswith("GATE") for x in ids):
        return 40 if any(x.startswith("FIELD") for x in ids) else 55
    if any(x.startswith("FIELD") for x in ids): return 45
    return GAP_MAIN

def geom(b,gx,gy,ebs):
    rid=b["id"]; fw,fh=b["grid"][2],b["grid"][3]
    k=ISO_K.get(rid,1.1); rw,rh=DIMS[rid]
    sc=(fw+fh)*TW/2*k/rw; pxW,pxH=rw*sc,rh*sc
    sx=(gx+fw-gy-fh)*32; sy=(gx+fw+gy+fh)*16
    ax=ANCHOR_AX.get(rid,0.5); ay=ANCHOR_AY.get(rid,0.95)
    X0,Y0=sx-ax*pxW,sy-ay*pxH
    u0,v0,u1,v1=ebs[rid]
    return dict(xL=X0+u0*pxW,yT=Y0+v0*pxH,xR=X0+u1*pxW,yB=Y0+v1*pxH)
def center(b,gx,gy):
    return dict(U=(gx-gy)+(b["grid"][2]-b["grid"][3])/2,
                V=(gx+gy)+(b["grid"][2]+b["grid"][3])/2)
def inv_iso(sx,sy):
    return (sx/32+sy/16)/2,(sy/16-sx/32)/2

def solve(bs,iters=2000,spring=0.05):
    pos={b["id"]:[b["grid"][0],b["grid"][1]] for b in bs}
    orig={b["id"]:[b["grid"][0],b["grid"][1]] for b in bs}
    # 原始偏序
    C={b["id"]:center(b,b["grid"][0],b["grid"][1]) for b in bs}
    order={}
    for i in range(len(bs)):
        for j in range(i+1,len(bs)):
            ai,aj=bs[i]["id"],bs[j]["id"]
            order[(ai,aj)]=(1 if C[ai]["U"]<C[aj]["U"] else -1,
                            1 if C[ai]["V"]<C[aj]["V"] else -1)
    def move(rid,dgx,dgy):
        if rid in ANCHORS: return
        pos[rid][0]+=dgx; pos[rid][1]+=dgy
    for it in range(iters):
        if it%2==0:
            for b in bs:
                rid=b["id"]
                if rid in ANCHORS: continue
                pos[rid][0]+=(orig[rid][0]-pos[rid][0])*spring
                pos[rid][1]+=(orig[rid][1]-pos[rid][1])*spring
        # 偏序约束（不翻转）
        for i in range(len(bs)):
            for j in range(i+1,len(bs)):
                ai,aj=bs[i]["id"],bs[j]["id"]
                su,sv=order[(ai,aj)]
                ci=center(bs[i],*pos[ai]); cj=center(bs[j],*pos[aj])
                if su*(ci["U"]-cj["U"])<0:
                    # 沿 U 恢复，需移动屏幕 32*|dU|，转回
                    du=-(ci["U"]-cj["U"])*0.5
                    dgA,dgA2=inv_iso(32*du*2,0)
                    if ai not in ANCHORS and aj not in ANCHORS:
                        move(ai,dgA/2,dgA2/2); move(aj,-dgA/2,-dgA2/2)
                    elif aj in ANCHORS: move(ai,dgA,dgA2)
                    else: move(aj,-dgA,-dgA2)
                ci=center(bs[i],*pos[ai]); cj=center(bs[j],*pos[aj])
                if sv*(ci["V"]-cj["V"])<0:
                    dv=-(ci["V"]-cj["V"])*0.5
                    dgA,dgA2=inv_iso(0,16*dv*2)
                    if ai not in ANCHORS and aj not in ANCHORS:
                        move(ai,dgA/2,dgA2/2); move(aj,-dgA/2,-dgA2/2)
                    elif aj in ANCHORS: move(ai,dgA,dgA2)
                    else: move(aj,-dgA,-dgA2)
        # AABB 间隙
        for i in range(len(bs)):
            for j in range(i+1,len(bs)):
                ai,aj=bs[i]["id"],bs[j]["id"]; G=gap_required(ai,aj)
                if G<=0: continue
                A=geom(bs[i],*pos[ai],EBS); B=geom(bs[j],*pos[aj],EBS)
                gx=max(A["xL"]-B["xR"],B["xL"]-A["xR"])
                gy=max(A["yT"]-B["yB"],B["yT"]-A["yB"])
                if gx>=G or gy>=G: continue
                nx,ny=G-gx,G-gy
                if nx<=ny:
                    if A["xL"]-B["xR"]>B["xL"]-A["xR"]: sxA,sxB=nx,-nx
                    else: sxA,sxB=-nx,nx
                    syA=syB=0
                else:
                    if A["yT"]-B["yB"]>B["yT"]-A["yB"]: syA,syB=ny,-ny
                    else: syA,syB=-ny,ny
                    sxA=sxB=0
                aA=0.0 if ai in ANCHORS else (1.0 if aj in ANCHORS else 0.5)
                aB=0.0 if aj in ANCHORS else (1.0 if ai in ANCHORS else 0.5)
                dA=inv_iso(sxA*aA*2,syA*aA*2); dB=inv_iso(sxB*aB*2,syB*aB*2)
                move(ai,*dA); move(aj,*dB)
        # 位移上限（投影到原位半径 MAXD 圆）
        for b in bs:
            rid=b["id"]
            if rid in ANCHORS: continue
            dx=pos[rid][0]-orig[rid][0]; dy=pos[rid][1]-orig[rid][1]
            d=math.hypot(dx,dy)
            if d>MAXD:
                pos[rid][0]=orig[rid][0]+dx*MAXD/d
                pos[rid][1]=orig[rid][1]+dy*MAXD/d
    return pos

def verify(bs,pos):
    bad=[]
    for i in range(len(bs)):
        for j in range(i+1,len(bs)):
            ai,aj=bs[i]["id"],bs[j]["id"]; G=gap_required(ai,aj)
            if G<=0: continue
            A=geom(bs[i],*pos[ai],EBS); B=geom(bs[j],*pos[aj],EBS)
            gx=max(A["xL"]-B["xR"],B["xL"]-A["xR"])
            gy=max(A["yT"]-B["yB"],B["yT"]-A["yB"])
            if gx<G and gy<G: bad.append((ai,aj,round(gx),round(gy),round(G-max(gx,gy))))
    return bad

def write_back(bs,pos):
    p=os.path.join(ROOT,"js","data.js"); shutil.copy(p,p+".bak73")
    txt=open(p,encoding="utf-8").read()
    for b in bs:
        gx,gy=pos[b["id"]]; w,h=b["grid"][2],b["grid"][3]
        m=re.search(r'"id":\s*"'+re.escape(b["id"])+r'".*?"grid":\s*\[\s*[\d.\-]+,\s*[\d.\-]+,\s*[\d.\-]+,\s*[\d.\-]+\s*\]', txt, re.S)
        assert m,b["id"]
        newblk=re.sub(r'"grid":\s*\[\s*[\d.\-]+,\s*[\d.\-]+,\s*[\d.\-]+,\s*[\d.\-]+\s*\]',
                      f'"grid": [\n    {round(gx,1)},\n    {round(gy,1)},\n    {w},\n    {h}\n   ]', m.group(0), count=1)
        txt=txt[:m.start()]+newblk+txt[m.end():]
    open(p,"w",encoding="utf-8").write(txt)
    print("已写回 data.js")

bs=load_buildings()
DIMS={}; EBS={}
for b in bs:
    im=Image.open(os.path.join(SPR,b["id"]+".png"))
    DIMS[b["id"]]=im.size; EBS[b["id"]]=entity_bbox(im)
pos=solve(bs)
print("== 位移 ==")
for b in bs:
    rid=b["id"]; o=[b["grid"][0],b["grid"][1]]; n=pos[rid]; d=math.hypot(n[0]-o[0],n[1]-o[1])
    print(f'{rid:13s} ({o[0]:6.1f},{o[1]:6.1f}) -> ({n[0]:6.1f},{n[1]:6.1f}) {"锚定" if rid in ANCHORS else f"{d:.1f}格"}')
bad=verify(bs,pos)
print(f"\n== 仍不满足 {len(bad)} 对 ==")
for x in sorted(bad,key=lambda t:-t[4]): print(f"  {x[0]}<>{x[1]} gx={x[2]} gy={x[3]} 差{x[4]}px")
if "--write" in sys.argv: write_back(bs,pos)
else: print("\n（仅预测；--write 写回）")

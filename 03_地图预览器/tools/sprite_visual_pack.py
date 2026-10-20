#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
#73 量化每栋 3/4 立体 sprite 的真实屏幕实体占地，检测建筑间视觉叠压/紧贴。
复现 main.js 的 isoX/isoY、spriteIsoScale、spriteAnchor 投影。
实体 bbox：用 alpha 阈值 + 行列密度阈值排除落地投影与细装饰。
"""
import json, subprocess, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "img", "topdown", "sprites")

# ---- 与 main.js 保持一致的常量 ----
TW, TH = 64, 32
ANCHOR_AY = {"FIELD-W":0.704,"GYM":0.99,"TEACH-1":0.99,"LAB-TECH":0.98,"GATE-S":0.97,
  "GATE-E":0.92,"LIB":0.99,"WENLI":0.95,"TEACH-2":0.97,"ACT":0.85,"CAN-YULAN":1.0,
  "CAN-ZIZHU":0.94,"ENG-TRAIN":0.96,"FIELD-N":1.053,"MOUNT-YUPING":1.0,"GATE-W":0.81}
ANCHOR_AX = {"FIELD-W":0.335,"GYM":0.50,"TEACH-1":0.75,"LAB-TECH":0.51,"GATE-S":0.71,
  "GATE-E":0.35,"LIB":0.57,"WENLI":0.47,"TEACH-2":0.53,"ACT":0.60,"CAN-YULAN":0.46,
  "CAN-ZIZHU":0.41,"ENG-TRAIN":0.48,"FIELD-N":0.372,"MOUNT-YUPING":0.64,"GATE-W":0.33}
ISO_K = {"MOUNT-YUPING":0.95,"FIELD-W":0.87,"FIELD-N":0.741,"TEACH-1":1.0,"LAB-TECH":1.0,
  "GYM":1.0,"ACT":1.0,"ENG-TRAIN":1.0,"LIB":1.0,"WENLI":1.0,"TEACH-2":1.0,"CAN-YULAN":1.0,
  "CAN-ZIZHU":1.0,"GATE-S":1.05,"GATE-E":1.05,"GATE-W":1.05}

def load_buildings():
    out = subprocess.run(["node","-e","global.window={};require('./js/data.js');console.log(JSON.stringify(window.CAMPUS_DATA.buildings));"],
                         cwd=ROOT, capture_output=True, text=True)
    return json.loads(out.stdout)

def entity_bbox(im, alpha_th=120, dens=0.015):
    """返回归一化实体框 (u0,v0,u1,v1)，密度阈值剔除边缘投影/细线。"""
    a = np.array(im.convert("RGBA"))[:,:,3]
    H, W = a.shape
    m = a > alpha_th
    colcnt = m.sum(axis=0); rowcnt = m.sum(axis=1)
    cn = colcnt >= max(4, H*dens); rn = rowcnt >= max(4, W*dens)
    xs = np.where(cn)[0]; ys = np.where(rn)[0]
    if len(xs)==0 or len(ys)==0:
        return (0.0,0.0,1.0,1.0)
    return (xs[0]/W, ys[0]/H, (xs[-1]+1)/W, (ys[-1]+1)/H)

def screen_box(b, eb):
    gx,gy,fw,fh = b["grid"]
    rid = b["id"]; k = ISO_K.get(rid,1.1)
    im = Image.open(os.path.join(SPR, rid+".png"))
    rw, rh = im.size
    sc = (fw+fh)*TW/2*k/rw
    pxW, pxH = rw*sc, rh*sc
    sx = (gx+fw-gy-fh)*32; sy = (gx+fw+gy+fh)*16
    ax = ANCHOR_AX.get(rid,0.5); ay = ANCHOR_AY.get(rid,0.95)
    X0, Y0 = sx-ax*pxW, sy-ay*pxH
    u0,v0,u1,v1 = eb
    return dict(xL=X0+u0*pxW, yT=Y0+v0*pxH, xR=X0+u1*pxW, yB=Y0+v1*pxH,
                pxW=pxW, pxH=pxH, sc=sc, rw=rw, rh=rh, eb=eb)

def gap(a,b):
    """两 AABB 间隙：返回 (gx_gap, gy_gap)；负值=重叠量。"""
    gx = max(a["xL"]-b["xR"], b["xL"]-a["xR"])
    gy = max(a["yT"]-b["yB"], b["yT"]-a["yB"])
    return gx, gy

def main():
    bs = load_buildings()
    boxes = {}
    ebs = {}
    for b in bs:
        im = Image.open(os.path.join(SPR, b["id"]+".png"))
        eb = entity_bbox(im); ebs[b["id"]] = eb
        boxes[b["id"]] = screen_box(b, eb)
    print("== 实体归一化框 / 屏幕占地(世界px) ==")
    for b in bs:
        bx=boxes[b["id"]]; eb=ebs[b["id"]]
        print(f'{b["id"]:13s} eb=({eb[0]:.2f},{eb[1]:.2f},{eb[2]:.2f},{eb[3]:.2f}) '
              f'W={bx["pxW"]:5.0f} H={bx["pxH"]:5.0f} yT={bx["yT"]:7.0f} yB={bx["yB"]:7.0f}')
    # 重叠/紧贴检测（校门、山、操场单独标注但仍列出）
    SKIP = set()  # 先全部参与
    print("\n== 屏幕 AABB 重叠或间隙 < 阈值 ==")
    GAP = 60
    pairs=[]
    for i in range(len(bs)):
        for j in range(i+1,len(bs)):
            ai,aj = bs[i]["id"], bs[j]["id"]
            if ai in SKIP or aj in SKIP: continue
            gx,gy = gap(boxes[ai],boxes[aj])
            if gx < GAP and gy < GAP:
                pairs.append((ai,aj,round(gx),round(gy)))
    pairs.sort(key=lambda p:min(p[2],p[3]))
    for ai,aj,gx,gy in pairs:
        tag = "重叠" if (gx<0 or gy<0) else "紧贴"
        print(f'{tag} {ai:13s} <> {aj:13s} x间隙={gx:5d} y间隙={gy:5d}')
    print(f"\n共 {len(pairs)} 对需要处理（GAP={GAP}px）")

if __name__ == "__main__":
    main()

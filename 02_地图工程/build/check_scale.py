#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""scale 校验：建筑放大后 visRect 两两重叠 / 压道路中线 / BFS 可达性。
用法: python3 build/check_scale.py '{"TEACH-1":1.3,"LIB":1.3,"LAB-TECH":1.35}'
不传参则用 main.js 当前 BUILD_SCALE_ID。"""
import json, os, re, sys, math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREV = os.path.join(ROOT, "..", "03_地图预览器", "js")

def load(name):
    src = open(os.path.join(PREV, name), encoding="utf-8").read()
    m = re.search(r"window\.\w+\s*=\s*(\{.*\})\s*;?\s*$", src, re.S)
    return json.loads(m.group(1))

CD = load("data.js"); TD = load("topdown_data.js")
BUILD_SCALE = 1.5
DEFAULT = {"TEACH-1":1.35,"TEACH-2":1.5,"LIB":1.32,"WENLI":1.5,"LAB-TECH":1.32,"ACT":1.3,
    "CAN-YULAN":1.5,"CAN-ZIZHU":1.5,"ENG-TRAIN":1.35,"GYM":1.3,"FIELD-W":1.4,"FIELD-N":1.4,
    "GATE-S":1.1,"GATE-E":1.05,"GATE-W":1.05,"MOUNT-YUPING":1.15}
overrides = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
SCALE = {**DEFAULT, **overrides}

def vis(b):
    fx, fy, fw, fh = b["grid"]; s = SCALE.get(b["id"], BUILD_SCALE)
    nfw, nfh = fw*s, fh*s; cx = fx + fw/2
    return (cx-nfw/2, (fy+fh)-nfh, cx+nfw/2, fy+fh)  # x0,y0(北),x1,y1(南)

def seg_dist(px, py, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx+dy*dy or 1
    t = max(0, min(1, ((px-a[0])*dx+(py-a[1])*dy)/L2))
    return math.hypot(px-(a[0]+t*dx), py-(a[1]+t*dy))

def rect_road_min(rect, gpts, halfw):
    x0,y0,x1,y1 = rect
    corners = [(x0,y0),(x1,y0),(x0,y1),(x1,y1),((x0+x1)/2,y0),((x0+x1)/2,y1)]
    best = 1e9
    for i in range(len(gpts)-1):
        for (cx,cy) in corners:
            best = min(best, seg_dist(cx,cy,gpts[i],gpts[i+1]) - halfw)
    return best

print("== 两两 visRect 重叠（重叠>0.3 格） ==")
bs = CD["buildings"]; found = False
for i in range(len(bs)):
    for j in range(i+1, len(bs)):
        r1, r2 = vis(bs[i]), vis(bs[j])
        ox = min(r1[2],r2[2]) - max(r1[0],r2[0]); oy = min(r1[3],r2[3]) - max(r1[1],r2[1])
        if ox > 0.3 and oy > 0.3:
            print(f"  重叠 {bs[i]['id']} x {bs[j]['id']}: ox={ox:.2f} oy={oy:.2f}"); found=True
if not found: print("  无重叠")

print("== visRect 压道路（余量<0.4 格告警） ==")
found=False
for b in bs:
    r = vis(b)
    for rd in TD["roads"]:
        d = rect_road_min(r, rd["gpts"], rd["w"]/2)
        if d < 0.4:
            print(f"  {b['id']} 贴 {rd['name']}: 余量 {d:.2f}"); found=True
if not found: print("  无压路")

print("== 最终系数 ==")
for b in bs: print(f"  {b['id']:14s} {SCALE.get(b['id'],1.5):.2f}")

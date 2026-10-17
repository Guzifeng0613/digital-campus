# -*- coding: utf-8 -*-
"""总图底图：草地棋盘格 + 道路 + 公园绿地 + 水系（无建筑、无玉屏山、无钢棚/环岛/POI）。"""
import os, importlib
HERE=os.path.dirname(__file__); import sys; sys.path.insert(0,HERE)
import campus_data as C
nat=[n for n in C.build_nature() if n["cat"]!="mountain"]
C.numbered_buildings=lambda:[]
C.build_nature=lambda:nat
import render_iso as R
importlib.reload(R)
R.LANDMARK={}; R.DRAW_LABELS=False
R.DRAW_CANOPY=False; R.DRAW_POI=False
R.render()
print("base ok")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Top-down（星露谷式正俯视方形瓦片）预览器数据生成器。

从 02_地图工程/map_data.json 提取与投影解耦的「逻辑网格」数据：
  - roads  : 8 条道路折线（gpts 网格坐标 + 宽度 w 网格单位）
  - canal  : 运河折线
  - nature : 山体/林地/草坪/湖泊的网格多边形（gpoly / grid bbox）
输出到 03_地图预览器/js/topdown_data.js（window.TOPDOWN_DATA）。

data.js（等距渲染数据）保持不动；本脚本是阶段2 top-down 正式导出的雏形，
后续扩展建筑 sprite 元数据（画布尺寸/锚点/footprint/depth）也从这里补充。
用法：python3 build/gen_topdown_data.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 02_地图工程/
MAP = os.path.join(ROOT, "map_data.json")
DATA_JS = os.path.join(ROOT, "..", "03_地图预览器", "js", "data.js")
OUT = os.path.join(ROOT, "..", "03_地图预览器", "js", "topdown_data.js")

TILE = 48
GRAIN = 4
RISE = {  # 立面/屋顶向北延伸高度（世界 px），见 docs/topdown-spec.md 2.2
    "teaching": 144, "lab": 144, "library": 144, "college": 144,
    "service": 144, "activity": 144, "canteen": 120, "gym": 96,
    "gate": 72, "field": 0, "nature": 200,
}
# 接线期微调：sprite 相对锚点的 y 偏移（世界 px，正值=整体下移=偏南）
DY_HINT = {
    # TD-4 美术轮后实测底边透明边距×缩放系数；其余 8 栋沿用
    "TEACH-1": 0, "TEACH-2": 0, "ACT": 0, "CAN-YULAN": 0,
    "GYM": 0, "CAN-ZIZHU": 0, "LAB-TECH": 0,
    "MOUNT-YUPING": 60,   # 底边距 52×1.15
    "ENG-TRAIN": 48,
}


def build_sprite_registry():
    """从 data.js（16 栋渲染建筑）推导每栋 sprite 元数据。"""
    src = open(DATA_JS, encoding="utf-8").read()
    m = re.search(r"window\.CAMPUS_DATA\s*=\s*(\{.*\})\s*;?\s*$", src, re.S)
    campus = json.loads(m.group(1))
    reg = {}
    for b in campus["buildings"]:
        fx, fy, fw, fh = b["grid"]
        w = round(fw * TILE / GRAIN) * GRAIN
        h = round(fh * TILE / GRAIN) * GRAIN + RISE.get(b["cat"], 120)
        reg[b["id"]] = {
            "file": "img/topdown/sprites/%s.png" % b["id"],
            "w": w, "h": h,
            "kind": b["cat"],
            "dy": DY_HINT.get(b["id"], 0),
        }
    return reg


def main():
    D = json.load(open(MAP, encoding="utf-8"))

    roads = []
    for r in D["roads"]:
        roads.append({
            "name": r["name"],
            "w": r["w"],
            "paved": r["w"] >= 7,          # ≥7 网格单位=车行硬铺装，否则=步行泥土路
            "gpts": r["gpts"],
        })

    nature = []
    for n in D["nature"]:
        nature.append({
            "id": n["id"], "name": n["name"], "cat": n.get("cat"),
            "shape": n.get("shape"),       # poly / rect
            "gpoly": n.get("gpoly", []),
            "grid": n.get("grid"),         # [fx, fy, fw, fh]
        })

    out = {
        "roads": roads,
        "canal": D.get("canal", []),
        "nature": nature,
        "sprites": build_sprite_registry(),
    }

    header = ("// 自动生成：top-down 正俯视渲染所需的网格数据（道路/运河/自然地块）。\n"
              "// 由 02_地图工程/build/gen_topdown_data.py 从 map_data.json 导出。勿手改。\n"
              "// 逻辑网格 gx,gy 与投影解耦：gx=东向, gy=南向（屏幕右下即世界右下）。\n")
    body = json.dumps(out, ensure_ascii=False, indent=1)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(header + "window.TOPDOWN_DATA = " + body + ";\n")
    print("written:", os.path.abspath(OUT), "roads:", len(roads), "nature:", len(nature))


if __name__ == "__main__":
    main()

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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 02_地图工程/
MAP = os.path.join(ROOT, "map_data.json")
OUT = os.path.join(ROOT, "..", "03_地图预览器", "js", "topdown_data.js")


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

# -*- coding: utf-8 -*-
"""为 Cocos Creator 3.8 接入工程生成资源与 TS 数据（data.js → assets/resources + CampusData.ts）。"""
import os, json, shutil

HERE = os.path.dirname(__file__)
ENG = os.path.join(HERE, "..")
WEB = os.path.abspath(os.path.join(ENG, "..", "03_地图预览器"))
COC = os.path.abspath(os.path.join(ENG, "..", "04_Cocos工程"))
RES = os.path.join(COC, "assets", "resources")
SCR = os.path.join(COC, "assets", "scripts")

# 读 web 导出的数据
txt = open(os.path.join(WEB, "js", "data.js"), encoding="utf-8").read()
D = json.loads(txt.split("=", 1)[1].strip().rstrip(";").strip())

# 1) 复制资源到 resources（ground 放根，sprites 放子目录）
os.makedirs(os.path.join(RES, "sprites"), exist_ok=True)
os.makedirs(SCR, exist_ok=True)
shutil.copy(os.path.join(WEB, "img", "ground.png"), os.path.join(RES, "ground.png"))
for b in D["buildings"]:
    shutil.copy(os.path.join(WEB, b["img"]), os.path.join(RES, "sprites", b["id"] + ".png"))

# 2) 生成 CampusData.ts
M = D["meta"]
brows = []
for b in D["buildings"]:
    brows.append({
        "id": b["id"], "no": b["no"], "name": b["name"], "group": b["group"],
        "res": "sprites/" + b["id"],
        "grid": b["grid"], "bbox": b["bbox"], "scale": b["scale"],
        "paste": b["paste"], "foot": b["foot"], "depth": b["depth"],
        "walkable": b["walkable"], "collider": b["collider"],
        "desc": b["desc"],
    })

def arr(x):
    return json.dumps(x, ensure_ascii=False)

lines = []
lines.append("// 自动生成：Cocos Creator 3.8 等距校园数据（由 build/gen_cocos.py 从权威数据模型导出）。勿手改。")
lines.append("export interface CampusMeta {")
lines.append("  project: string; ground: string; groundSize: number[]; diamond: number[];")
lines.append("  origin: number[]; tile: number[]; gridRange: number[]; count: number;")
lines.append("}")
lines.append("export interface CampusBuilding {")
lines.append("  id: string; no: number; name: string; group: string; res: string;")
lines.append("  grid: number[]; bbox: number[]; scale: number; paste: number[];")
lines.append("  foot: number[]; depth: number; walkable: boolean; collider: number[]; desc: string;")
lines.append("}")
lines.append("export const META: CampusMeta = {")
lines.append("  project: %s," % json.dumps(M["project"], ensure_ascii=False))
lines.append("  ground: 'ground',")
lines.append("  groundSize: %s, diamond: %s, origin: %s, tile: %s, gridRange: %s,"
           % (arr(M["groundSize"]), arr(M["diamond"]), arr(M["origin"]), arr(M["tile"]), arr(M["gridRange"])))
lines.append("  count: %d" % M["count"])
lines.append("};")
lines.append("export const BUILDINGS: CampusBuilding[] = " + json.dumps(brows, ensure_ascii=False, indent=2) + ";")
lines.append("")
lines.append("export const GROUP_CN: Record<string, string> = {")
lines.append("  teaching: '教学科研', public: '公共服务', sports: '体育',")
lines.append("  dining: '餐饮', gate: '校门', nature: '自然地标'")
lines.append("};")
open(os.path.join(SCR, "CampusData.ts"), "w", encoding="utf-8").write("\n".join(lines))

print("Cocos 资源：ground +", len(brows), "sprites；CampusData.ts 已生成 →", COC)

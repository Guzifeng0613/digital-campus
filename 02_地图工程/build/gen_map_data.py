# -*- coding: utf-8 -*-
"""从权威数据模型导出引擎解耦数据 map_data.json（HTML/Cocos/Tiled 共用）。"""
import os, json
import campus_data as C

data = C.build_all()
out = os.path.join(os.path.dirname(__file__), "..", "map_data.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("saved", out)
print("建筑数:", data["meta"]["count_buildings"],
      "| 自然:", len(data["nature"]), "| 道路:", len(data["roads"]),
      "| POI:", len(data["pois"]))

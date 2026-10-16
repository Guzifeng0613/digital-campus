# -*- coding: utf-8 -*-
"""
北京化工大学昌平校区 数字校园 —— 权威布局数据模型（单一数据源）
=================================================================
- 源坐标：官方平面图（北校区工作办公室 2021.8 制）像素坐标，近似上北下南。
- 网格：等距逻辑网格 GW x GH（gridX 向东，gridY 向南），1 瓦片≈6m。
- 所有建筑/区域先用像素 bbox 定义，再经 PIX2GRID 映射到网格。
- 渲染器、Tiled 工程、Cocos 数据、HTML 预览均从本文件生成。
"""

# ---------- 网格与映射 ----------
TILE_W, TILE_H = 64, 32          # 等距瓦片像素（逻辑）
GW, GH = 150, 264               # 工作网格尺寸（东西 x 南北）
# 官方图像素 -> 网格（校园主体范围）。等距瓦片物理为正方形，
# 故东西/南北采用同一“格/像素”尺度，避免南北被压缩、椭圆变扁。
PX_X0, PX_X1 = 126.0, 562.0     # 西 -> 东
PX_Y0, PX_Y1 = 34.0, 830.0      # 北 -> 南
GX0, GX1 = 6.0, 144.0           # 网格西->东（东西跨度锚定）
GY0 = 6.0
_SCALE = (GX1 - GX0) / (PX_X1 - PX_X0)   # 统一 格/像素
GY1 = round(GY0 + (PX_Y1 - PX_Y0) * _SCALE, 1)  # 南边界（随统一尺度派生）

def px2gx(x):
    return (x - PX_X0) * _SCALE + GX0

def px2gy(y):
    return (y - PX_Y0) * _SCALE + GY0

def box(px):
    """像素 bbox=(x,y,w,h) -> 网格 (gx,gy,gw,gh)，gx,gy 为西北角。"""
    x, y, w, h = px
    gx, gy = px2gx(x), px2gy(y)
    gw = px2gx(x + w) - px2gx(x)
    gh = px2gy(y + h) - px2gy(y)
    return (round(gx, 2), round(gy, 2), round(gw, 2), round(gh, 2))

# ---------- 分类配色（占位，与像素手册共用色板） ----------
CATEGORIES = {
    "gate":     ("校门",       "#C0392B"),
    "teaching": ("教学楼",     "#C0392B"),
    "library":  ("图书馆",     "#A93226"),
    "lab":      ("实验/科研楼", "#B9772B"),
    "college":  ("学院楼",     "#B35035"),
    "museum":   ("校史馆/展馆", "#9E4A30"),
    "activity": ("活动/报告厅", "#D35400"),
    "dorm":     ("学生公寓",   "#7D6B91"),
    "canteen":  ("食堂",       "#CB4335"),
    "service":  ("服务配套",   "#5D6D7E"),
    "gym":      ("体育馆",     "#922B21"),
    "field":    ("室外运动场", "#2E86C1"),
    "court":    ("室外球场",   "#5DADE2"),
    "mountain": ("山体",       "#2E7D32"),
    "water":    ("水体",       "#4FA8D0"),
    "park":     ("绿地园林",   "#7CB342"),
    "plaza":    ("广场",       "#C9C2B2"),
    "parking":  ("停车场",     "#95A5A6"),
}

# ---------- 自然/区域（多边形用像素点，矩形用 bbox） ----------
# 每个元素: dict(kind, 矩形用 bbox；椭圆用 ellipse=(cx,cy,rx,ry)；多边形用 poly=[(x,y)...])
NATURE = [
    # 玉屏山（北部山体；墨蓝手绘双峰 M 形山脊，宽底；东缘止于 x368，不压东田径场）
    {"id": "N-MOUNT-YUPING", "name": "玉屏山", "cat": "mountain",
     "poly": [(238,138),(250,116),(262,96),(282,74),(300,92),(312,94),(332,64),
              (352,78),(362,92),(372,108),(376,126),(368,140),(320,142),(272,142)],
     "domes": [
       {"cx":282,"cy":104,"rx":52,"ry":30,"h":30},
       {"cx":344,"cy":98,"rx":50,"ry":29,"h":37}
     ]},
    {"id": "N-FOREST-HUAYU", "name": "化育林", "cat": "park",
     "poly": [(130,150),(135,55),(195,45),(235,55),(245,120),(230,160),(170,165)]},
    {"id": "N-GARDEN", "name": "花园", "cat": "park",
     "poly": [(132,165),(150,120),(210,120),(225,160),(200,175),(150,178)]},
    # 柳湖（中部不规则湖面，湖心亭）—— 东缘止于 x352（不压图书馆）
    {"id": "N-LAKE-LIU", "name": "柳湖", "cat": "water",
     "poly": [(285,450),(298,442),(318,438),(335,442),(348,452),(352,464),
              (348,478),(340,490),(322,498),(298,498),(280,492),(272,478),(274,462),(280,452)]},
    # 南湖（体育馆北侧、柳湖以南小水面）
    {"id": "N-LAKE-NAN", "name": "南湖", "cat": "water",
     "poly": [(258,668),(278,660),(298,666),(308,680),(300,698),(280,706),(262,698),(254,682)]},
    # 中央礼仪大草坪（南门 -> 第一教学楼 -> 柳湖 中轴）
    {"id": "N-LAWN-AXIS", "name": "中轴礼仪草坪", "cat": "park",
     "bbox": (318,660,78,160)},
    # 樱花苑周边绿地（西侧）
    {"id": "N-GREEN-WEST", "name": "西园绿地", "cat": "park",
     "bbox": (232,500,40,120)},
]

# ---------- 建筑（像素 bbox + 属性） ----------
# floors: 层数（视觉高度）；status: built 已建 / building 在建
# 每条: id, name, cat, px=(x,y,w,h), floors, status, desc
BUILDINGS = [
    # ===== 校门（数字校园入口，保留东/西/南3个） =====
    {"id": "GATE-S", "name": "主校门（南门）", "cat": "gate", "px": (350,818,40,16), "floors": 1,
     "desc": "学校正门、行人主出入口，校名石与『南涧路29号』标识，中轴礼仪序列起点。"},
    {"id": "GATE-E", "name": "东门", "cat": "gate", "px": (470,538,12,22), "floors": 1,
     "desc": "校园东侧出入口，车辆主出入口，紧邻机动车环岛。"},
    {"id": "GATE-W", "name": "西门", "cat": "gate", "px": (120,440,12,24), "floors": 1,
     "desc": "校园西侧出入口，邻后勤服务楼与地面停车场，樱花苑生活片区主要人行入口。"},

    # ===== 教学 / 图书馆 / 活动 / 餐饮（平面轮廓按墨蓝手绘+官方图） =====
    {"id": "TEACH-1", "name": "第一教学楼", "cat": "teaching", "px": (286,636,138,64), "floors": 5,
     "shape": "crescent", "desc": "弯月形（凸面朝南）主教学楼，中央为通透大拱门、左右两座弧形翼（A座东/B座西），顶部连廊相接；红褐色竖向格栅+白色平顶，130间智慧教室。"},
    {"id": "TEACH-2", "name": "第二教学楼", "cat": "teaching", "floors": 5,
     "shape": "poly",
     "poly": [(300,357),(386,357),(386,410),(365,410),(365,422),(343,422),(343,410),
              (321,410),(321,422),(300,422)],
     "desc": "柳湖东北侧大型教学楼（大矩形+南缘锯齿/退台），承担本科课堂教学。"},
    {"id": "LIB", "name": "图书馆", "cat": "library", "floors": 6,
     "shape": "libL",
     "poly": [(355,432),(398,432),(398,420),(414,420),(414,470),(400,470),(400,486),(355,486)],
     "desc": "约5万㎡，国家优质工程；主体大方块+东侧竖向百叶塔楼（北半部相连，L形），红褐色横百叶+玻璃幕墙，临柳湖，含自习/研讨/创客/视听空间。"},
    {"id": "WENLI", "name": "文理楼（文科楼）", "cat": "college", "floors": 5,
     "status": "building", "shape": "poly",
     "poly": [(420,440),(478,440),(478,510),(420,510),(420,492),(460,492),(460,484),
              (420,484),(420,466),(460,466),(460,458),(420,458)],
     "desc": "东门内北侧，官方平面图名『文科楼（在建）』，三条西向横档+东侧竖档的3字（E）形竖长楼，文理学科教学用房。"},
    {"id": "ACT", "name": "大学生活动中心", "cat": "activity", "px": (222,382,80,53), "floors": 3,
     "shape": "wave",
     "desc": "柳湖西北白色参数化建筑：西侧一座小三角楔块+东侧大不规则主体（官方图两体块），起伏曲面+穿孔表皮，学生社团与活动场所。"},
    {"id": "CAN-YULAN", "name": "玉兰食堂（玉兰餐厅）", "cat": "canteen", "floors": 3,
     "status": "building", "shape": "poly",
     "poly": [(236,348),(250,348),(250,338),(268,338),(268,348),(278,348),
              (278,380),(236,380)],
     "desc": "大学生活动中心北侧、景观渠西侧，官方图标注（在建）的玉兰餐厅，主体方块+北缘小凸体，含玉兰二食堂。"},

    # ===== 实验楼群（东南片区，两组 U 形四合院；东西翼贯通） =====
    {"id": "LAB-H", "name": "实验楼H", "cat": "lab", "px": (378,512,67,22), "floors": 5,
     "desc": "北院北横档（北实验楼）。"},
    {"id": "LAB-F", "name": "实验楼F", "cat": "lab", "px": (390,552,48,22), "floors": 5,
     "desc": "北院南横档。"},
    {"id": "LAB-E", "name": "实验楼E", "cat": "lab", "px": (378,576,67,22), "floors": 5,
     "desc": "南院北横档。"},
    {"id": "LAB-C", "name": "实验楼C", "cat": "lab", "px": (390,606,48,20), "floors": 5,
     "desc": "南院南横档。"},
    {"id": "LAB-TECH", "name": "科技创新楼", "cat": "lab", "px": (378,512,15,114), "floors": 5,
     "desc": "实验群西翼（南北贯通），或为科技创新研究院。"},
    {"id": "LAB-G", "name": "实验楼G", "cat": "lab", "px": (438,512,17,124), "floors": 5,
     "desc": "实验群东翼（南北贯通，临东门）。"},

    # ===== 工程训练中心（泰瑞楼，泰瑞机器冠名） =====
    {"id": "ENG-TRAIN", "name": "工程训练中心（泰瑞楼）", "cat": "service", "floors": 4,
     "shape": "poly", "poly": [(400,250),(466,244),(470,312),(406,320)],
     "desc": "东北侧工程训练中心『泰瑞楼』（泰瑞机器冠名捐赠），工程实践教学场地。"},

    # ===== 餐饮 =====
    {"id": "CAN-ZIZHU", "name": "紫竹食堂（紫竹餐厅）", "cat": "canteen", "floors": 3,
     "shape": "poly",
     "poly": [(170,438),(184,438),(184,448),(188,448),(188,438),(200,438),
              (200,510),(170,510)],
     "desc": "樱花苑3号楼北侧，竖长楼体（北缘双凸），含紫竹一~四食堂及民族食堂，约3900座；红砖立面+竖向长条窗。"},

    # ===== 体育 =====
    {"id": "GYM", "name": "体育馆", "cat": "gym", "floors": 4, "shape": "gymbox",
     "ellipse": (300,756,40,18), "rot": -0.785,
     "desc": "主校门西北侧跑道形（圆角矩形）大跨综合体育馆，长轴东偏北约45°，灰色大挑檐平顶+红砖方柱+朝东南蓝玻璃幕墙，含篮球/羽毛球/游泳等14个训练馆。"},
    {"id": "FIELD-N", "name": "北操场（东田径场）", "cat": "field", "ellipse": (427,167,23,47), "floors": 0,
     "shape": "ellipse", "field": "track",
     "desc": "校园东北侧东田径场（用户标注『北操场』），标准足球场+环形跑道（跑道形，南北长轴），北邻游泳馆/篮球馆。"},
    {"id": "FIELD-W", "name": "风雨操场（西田径场）", "cat": "field", "ellipse": (172,665,26,46), "floors": 0,
     "shape": "ellipse", "field": "blue",
     "desc": "校园西南侧西田径场（用户标注『风雨操场』），跑道形足球场+环形跑道（南北长轴），东侧篮球场/游泳馆，东邻南湖，东南邻体育馆。"},
]

# ---------- 道路中心线（像素坐标折线），供渲染与路径用 ----------
ROADS = [
    # 外环东路
    {"name": "东环车行路", "w": 6, "pts": [(470,120),(500,200),(520,320),(550,430),(550,560),(520,700),(430,800)]},
    # 外环西路（樱花大道）
    {"name": "樱花大道", "w": 6, "pts": [(245,150),(230,300),(225,450),(215,600),(210,720),(250,800)]},
    # 宏德大道（南北主轴，沿景观渠）
    {"name": "宏德大道", "w": 7, "pts": [(300,120),(320,260),(330,400),(335,540),(325,680),(300,780)]},
    # 北侧东西路（仁道路）
    {"name": "北侧路", "w": 6, "pts": [(150,230),(280,225),(420,200),(470,140)]},
    # 汇川路（柳湖北侧东西向）
    {"name": "汇川路", "w": 6, "pts": [(240,380),(340,400),(430,420),(520,430)]},
    # 樱花道（柳湖南侧东西向）
    {"name": "樱花道", "w": 6, "pts": [(140,500),(250,510),(340,520),(420,540),(500,560)]},
    # 南涧大道（南侧东西向）
    {"name": "南涧大道", "w": 7, "pts": [(250,800),(350,790),(440,760),(520,700)]},
    # 第一教学楼北环路
    {"name": "一教环路", "w": 5, "pts": [(250,640),(330,625),(430,640),(520,600)]},
]

# 景观水系（西侧蓝绿景观渠，沿宏德大道）
CANAL = [(248,140),(268,280),(285,420),(300,560),(285,700),(260,790)]

# ---------- POI 兴趣点（图标，像素点） ----------
POIS = [
    {"id": "POI-ATM", "name": "ATM", "type": "atm", "px": (395,485)},
    {"id": "POI-BUS", "name": "班车站点", "type": "bus", "px": (360,250)},
    {"id": "POI-PAVILION", "name": "湖心亭", "type": "sight", "px": (360,500)},
    {"id": "POI-YANHE", "name": "燕贺亭", "type": "sight", "px": (388,62)},
    {"id": "POI-FLAG", "name": "国旗广场", "type": "sight", "px": (356,560)},
]

# ---------- 派生：统一网格数据 ----------
def build_records():
    recs = []
    for b in BUILDINGS:
        if "ellipse" in b:
            cx, cy, rx, ry = b["ellipse"]
            rot = b.get("rot", 0.0)
            if rot:   # 旋转椭圆的外接矩形（像素）
                import math as _m
                bx = _m.sqrt((rx*_m.cos(rot))**2 + (ry*_m.sin(rot))**2)
                by = _m.sqrt((rx*_m.sin(rot))**2 + (ry*_m.cos(rot))**2)
            else:
                bx, by = rx, ry
            g = (px2gx(cx-bx), px2gy(cy-by), px2gx(cx+bx)-px2gx(cx-bx), px2gy(cy+by)-px2gy(cy-by))
            shape = "ellipse"
        elif "poly" in b:
            xs = [p[0] for p in b["poly"]]; ys = [p[1] for p in b["poly"]]
            g = (px2gx(min(xs)), px2gy(min(ys)), px2gx(max(xs))-px2gx(min(xs)), px2gy(max(ys))-px2gy(min(ys)))
            shape = "poly"
            gpoly = [[round(px2gx(x),2), round(px2gy(y),2)] for x,y in b["poly"]]
        else:
            g = box(b["px"]); shape = "rect"
            gpoly = None
        if b.get("shape"):
            shape = b["shape"]
        rec = {**b, "grid": [round(v,2) for v in g], "shape": shape,
               "status": b.get("status", "built")}
        if gpoly: rec["gpoly"] = gpoly
        recs.append(rec)
    return recs

def build_nature():
    out = []
    for n in NATURE:
        if "poly" in n:
            gx = [px2gx(p[0]) for p in n["poly"]]; gy = [px2gy(p[1]) for p in n["poly"]]
            out.append({**n, "shape": "poly",
                        "gpoly": [[round(px2gx(x),2), round(px2gy(y),2)] for x,y in n["poly"]],
                        "grid": [round(min(gx),2),round(min(gy),2),round(max(gx)-min(gx),2),round(max(gy)-min(gy),2)]})
        else:
            g = box(n["bbox"]); out.append({**n, "shape": "rect", "grid": [round(v,2) for v in g]})
    return out

def build_roads():
    out = []
    for r in ROADS:
        out.append({"name": r["name"], "w": r["w"],
                    "gpts": [[round(px2gx(x),2), round(px2gy(y),2)] for x,y in r["pts"]]})
    return out

def build_pois():
    return [{"id": p["id"], "name": p["name"], "type": p["type"],
             "grid": [round(px2gx(p["px"][0]),2), round(px2gy(p["px"][1]),2)]} for p in POIS]

def numbered_buildings():
    """按北→南、西→东排序并分配稳定序号（01..NN），供图纸与台账统一引用。"""
    recs = build_records()
    recs.sort(key=lambda r: (round(r["grid"][1],1), round(r["grid"][0],1)))
    for i, r in enumerate(recs, 1):
        r["no"] = i
    return recs

def build_all():
    recs = numbered_buildings()
    return {
        "meta": {
            "name": "北京化工大学昌平校区",
            "address": "北京市昌平区南口镇南涧路29号",
            "tile": {"w": TILE_W, "h": TILE_H, "meters": 6},
            "grid": {"w": GW, "h": GH},
            "view": "isometric",
            "count_buildings": len(recs),
        },
        "categories": {k: v[0] for k, v in CATEGORIES.items()},
        "colors": {k: v[1] for k, v in CATEGORIES.items()},
        "nature": build_nature(),
        "roads": build_roads(),
        "canal": [[round(px2gx(x),2), round(px2gy(y),2)] for x, y in CANAL],
        "buildings": recs,
        "pois": build_pois(),
    }

if __name__ == "__main__":
    recs = build_records()
    print("建筑/场地对象数:", len(recs))
    for r in recs:
        print(f"{r['id']:14s} {r['name']:18s} {r['cat']:9s} grid={r['grid']}")

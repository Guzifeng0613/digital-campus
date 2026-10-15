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
GW, GH = 150, 185               # 工作网格尺寸（东西 x 南北）
# 官方图像素 -> 网格（校园主体范围）
PX_X0, PX_X1 = 126.0, 562.0     # 西 -> 东
PX_Y0, PX_Y1 = 34.0, 830.0      # 北 -> 南
GX0, GX1 = 6.0, 144.0           # 网格西->东
GY0, GY1 = 6.0, 178.0           # 网格北->南

def px2gx(x):
    return (x - PX_X0) / (PX_X1 - PX_X0) * (GX1 - GX0) + GX0

def px2gy(y):
    return (y - PX_Y0) / (PX_Y1 - PX_Y0) * (GY1 - GY0) + GY0

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
    # 玉屏山（北部山体，含双山峰）
    {"id": "N-MOUNT-YUPING", "name": "玉屏山", "cat": "mountain",
     "poly": [(255,150),(275,95),(320,60),(370,50),(420,62),(455,90),(470,120),
              (455,150),(430,168),(380,172),(320,170),(280,168)]},
    {"id": "N-FOREST-HUAYU", "name": "化育林", "cat": "park",
     "poly": [(130,150),(135,55),(195,45),(235,55),(245,120),(230,160),(170,165)]},
    {"id": "N-GARDEN", "name": "花园", "cat": "park",
     "poly": [(132,165),(150,120),(210,120),(225,160),(200,175),(150,178)]},
    # 柳湖（中部不规则湖面，湖心亭）
    {"id": "N-LAKE-LIU", "name": "柳湖", "cat": "water",
     "poly": [(300,470),(315,450),(345,445),(365,452),(385,447),(410,455),(428,470),
              (430,495),(415,515),(385,522),(360,520),(340,515),(315,515),(300,500),(293,485)]},
    # 南湖（西南不规则小水面）
    {"id": "N-LAKE-NAN", "name": "南湖", "cat": "water",
     "poly": [(275,640),(295,625),(320,628),(335,645),(333,670),(315,685),(290,682),(273,668)]},
    # 中央礼仪大草坪（图书馆南 -> 第一教学楼 -> 南门 中轴）
    {"id": "N-LAWN-AXIS", "name": "中轴礼仪草坪", "cat": "park",
     "bbox": (312,492,86,150)},
    # 樱花苑周边绿地（西侧）
    {"id": "N-GREEN-WEST", "name": "西园绿地", "cat": "park",
     "bbox": (232,500,55,130)},
]

# ---------- 建筑（像素 bbox + 属性） ----------
# floors: 层数（视觉高度）；status: built 已建 / building 在建
# 每条: id, name, cat, px=(x,y,w,h), floors, status, desc
BUILDINGS = [
    # ===== 校门（数字校园入口，保留东/西/南3个） =====
    {"id": "GATE-S", "name": "主校门（南门）", "cat": "gate", "px": (330,812,46,16), "floors": 1,
     "desc": "学校正门、行人主出入口，校名石与『南涧路29号』标识，中轴礼仪序列起点。"},
    {"id": "GATE-E", "name": "东门", "cat": "gate", "px": (552,418,12,30), "floors": 1,
     "desc": "校园东侧出入口，车辆主出入口，紧邻机动车环岛。"},
    {"id": "GATE-W", "name": "西门", "cat": "gate", "px": (124,448,14,28), "floors": 1,
     "desc": "校园西侧出入口，邻后勤服务楼与地面停车场，樱花苑生活片区主要人行入口。"},

    # ===== 教学 / 图书馆 / 校史馆 / 活动 =====
    {"id": "TEACH-1", "name": "第一教学楼", "cat": "teaching", "px": (300,645,122,50), "floors": 5,
     "shape": "arc", "desc": "弧形围合主教学楼，130间智慧教室，中央架空门廊；分A座(东)、B座(西)。"},
    {"id": "TEACH-2", "name": "第二教学楼", "cat": "teaching", "px": (300,358,78,72), "floors": 5,
     "desc": "柳湖东北侧大型教学楼，承担本科课堂教学。"},
    {"id": "MUSEUM-HISTORY", "name": "校史馆", "cat": "museum", "ellipse": (256,465,23,22), "floors": 3,
     "shape": "ellipse", "status": "built",
     "desc": "柳湖沿畔圆形红棕展馆（2025年11月竣工，约2700㎡），与大学生活动中心相邻、临柳湖；校史陈列、研究与展览的校园文化空间。"},
    {"id": "LIB", "name": "图书馆", "cat": "library", "px": (353,418,58,72), "floors": 6,
     "desc": "约5万㎡，红色层叠盒体+玻璃幕墙，临柳湖，含自习区/研讨室/创客空间/视听室。"},
    {"id": "ACT", "name": "大学生活动中心", "cat": "activity", "px": (228,390,82,52), "floors": 3,
     "desc": "柳湖西北异形建筑，学生社团与活动场所，与校史馆相邻。"},

    # ===== 实验 / 科研楼群（东南片区，7栋） =====
    {"id": "LAB-H", "name": "实验楼H", "cat": "lab", "px": (368,525,116,15), "floors": 5,
     "desc": "东南科研实验群北排（编号按2021官方图，待与现状核对）。"},
    {"id": "LAB-F", "name": "实验楼F", "cat": "lab", "px": (388,550,68,15), "floors": 5,
     "desc": "东南科研实验群。"},
    {"id": "LAB-E", "name": "实验楼E", "cat": "lab", "px": (388,583,68,15), "floors": 5,
     "desc": "东南科研实验群。"},
    {"id": "LAB-C", "name": "实验楼C", "cat": "lab", "px": (388,616,62,15), "floors": 5,
     "desc": "东南科研实验群。"},
    {"id": "LAB-G", "name": "实验楼G", "cat": "lab", "px": (456,540,28,56), "floors": 5,
     "desc": "东南科研实验群东翼（编号待核对）。"},
    {"id": "LAB-D", "name": "实验楼D", "cat": "lab", "px": (450,595,32,40), "floors": 5,
     "desc": "科研实验群东南翼（编号待核对）。"},
    {"id": "LAB-TECH", "name": "科技创新楼", "cat": "lab", "px": (368,545,20,86), "floors": 5,
     "desc": "实验群西翼竖楼（名称待核对，或为科技创新研究院）。"},

    # ===== 泰瑞楼（工程训练中心，泰瑞机器冠名） =====
    {"id": "ENG-TRAIN", "name": "泰瑞楼（工程训练中心）", "cat": "service", "px": (402,266,58,60), "floors": 4,
     "desc": "东北侧工程训练中心『泰瑞楼』（泰瑞机器冠名捐赠），工程实践教学场地。"},

    # ===== 餐饮 =====
    {"id": "CAN-ZIZHU", "name": "紫竹餐厅（食堂）", "cat": "canteen", "px": (178,444,36,52), "floors": 3,
     "desc": "樱花苑3号楼北侧，含紫竹一~四食堂及民族食堂，约3900座。"},

    # ===== 服务配套 =====
    {"id": "SVC-LOGI", "name": "后勤服务楼", "cat": "service", "px": (136,400,66,38), "floors": 4,
     "desc": "后勤服务、配套办公，邻地面停车场。"},

    # ===== 体育 =====
    {"id": "GYM", "name": "体育馆", "cat": "gym", "ellipse": (298,752,46,40), "floors": 3,
     "shape": "ellipse", "desc": "椭圆船形综合体育馆，含篮球/羽毛球/网球/乒乓球等14个训练馆。"},
    {"id": "FIELD-SW", "name": "操场（西南田径场）", "cat": "field", "ellipse": (188,718,58,72), "floors": 0,
     "shape": "ellipse", "desc": "樱花苑南侧、体育馆西侧，标准足球场+环形跑道（风雨操场）。"},
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
            g = (px2gx(cx-rx), px2gy(cy-ry), px2gx(cx+rx)-px2gx(cx-rx), px2gy(cy+ry)-px2gy(cy-ry))
            shape = "ellipse"
        elif "poly" in b:
            xs = [p[0] for p in b["poly"]]; ys = [p[1] for p in b["poly"]]
            g = (px2gx(min(xs)), px2gy(min(ys)), px2gx(max(xs))-px2gx(min(xs)), px2gy(max(ys))-px2gy(min(ys)))
            shape = "poly"
        else:
            g = box(b["px"]); shape = "rect"
        if b.get("shape"):
            shape = b["shape"]
        recs.append({**b, "grid": [round(v,2) for v in g], "shape": shape,
                     "status": b.get("status", "built")})
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

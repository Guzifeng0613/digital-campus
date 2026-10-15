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
    # ===== 校门 =====
    {"id": "GATE-S", "name": "主校门（南门）", "cat": "gate", "px": (330,812,46,16), "floors": 1,
     "desc": "学校正门、行人主出入口，校名石与『南涧路29号』标识，中轴礼仪序列起点。"},
    {"id": "GATE-E", "name": "东门", "cat": "gate", "px": (552,418,12,30), "floors": 1,
     "desc": "校园东侧出入口，车辆主出入口，紧邻机动车环岛。"},

    # ===== 教学 / 图书馆 / 活动 =====
    {"id": "TEACH-1", "name": "第一教学楼", "cat": "teaching", "px": (300,645,122,50), "floors": 5,
     "shape": "arc", "desc": "弧形围合主教学楼，130间智慧教室，中央架空门廊；分A座(东)、B座(西)。"},
    {"id": "TEACH-2", "name": "第二教学楼", "cat": "teaching", "px": (300,358,78,72), "floors": 5,
     "desc": "柳湖东北侧大型教学楼，承担本科课堂教学。"},
    {"id": "TEACH-PUB", "name": "公共教学楼（报告厅）", "cat": "teaching", "px": (288,450,46,56), "floors": 4,
     "status": "building", "desc": "柳湖西岸公共教学楼，含报告厅（图中示为在建）。"},
    {"id": "LIB", "name": "图书馆", "cat": "library", "px": (353,418,58,72), "floors": 6,
     "desc": "约5万㎡，红色层叠盒体+玻璃幕墙，临柳湖，含自习区/研讨室/创客空间/视听室。"},
    {"id": "ACT", "name": "大学生活动中心", "cat": "activity", "px": (228,390,82,52), "floors": 3,
     "desc": "柳湖西北异形建筑，学生社团与活动场所。"},
    {"id": "HALL-MUSIC", "name": "音乐厅", "cat": "activity", "px": (252,322,58,68), "floors": 3,
     "status": "building", "desc": "研究生宿舍东侧（图中示为在建）。"},
    {"id": "LIUHU-SHUYUAN", "name": "柳湖书院", "cat": "activity", "px": (258,506,52,34), "floors": 2,
     "desc": "柳湖西南侧小型书院/文化空间。"},

    # ===== 学院 / 实验 / 科研（东南片区及中部） =====
    {"id": "COL-WENLI", "name": "文理楼", "cat": "college", "px": (412,452,64,64), "floors": 4,
     "status": "building", "desc": "2023年建成，经管/数理/文法/马院教学科研楼，约2万㎡（图中示为在建）。"},
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
    {"id": "ENG-TRAIN", "name": "工程训练中心", "cat": "service", "px": (402,266,58,60), "floors": 4,
     "desc": "东北侧工程训练中心，含工程实践教学场地与配套停车场。"},

    # ===== 学生公寓（樱花苑1-7 / 玉兰苑 / 研究生宿舍） =====
    # 樱花苑：校园西侧，由北到南三组围合；南为风雨操场，北为紫竹餐厅，东为宏德大道
    {"id": "DORM-YH2", "name": "樱花苑2号楼", "cat": "dorm", "px": (138,328,46,60), "floors": 7,
     "desc": "本科四人间，上床下桌、空调、独立卫浴；内设烛光超市。"},
    {"id": "DORM-YH4", "name": "樱花苑4号楼", "cat": "dorm", "px": (186,328,46,60), "floors": 7,
     "desc": "本科四人间，楼下设水果超市。"},
    {"id": "DORM-YH1", "name": "樱花苑1号楼", "cat": "dorm", "px": (138,398,46,64), "floors": 7,
     "desc": "本科四人间，设烛光超市。"},
    {"id": "DORM-YH3", "name": "樱花苑3号楼", "cat": "dorm", "px": (186,398,46,64), "floors": 7,
     "desc": "本科四人间，北侧即紫竹餐厅。"},
    {"id": "DORM-YH6", "name": "樱花苑6号楼", "cat": "dorm", "px": (132,500,52,60), "floors": 7,
     "desc": "本科四人间（编号位置以官方图为准，待核对）。"},
    {"id": "DORM-YH5", "name": "樱花苑5号楼", "cat": "dorm", "px": (184,500,50,60), "floors": 7,
     "desc": "本科四人间，内设1958咖啡厅。"},
    {"id": "DORM-YH7", "name": "樱花苑7号楼", "cat": "dorm", "px": (132,566,100,52), "floors": 7,
     "desc": "本科四人间，设烛光超市。"},
    # 玉兰苑（中南部，柳湖西南、宏德大道西）
    {"id": "DORM-YL", "name": "玉兰苑1-2号楼", "cat": "dorm", "px": (250,520,64,96), "floors": 6,
     "desc": "学生公寓（1/2号楼），含超市配套。"},
    # 研究生宿舍（西北，图中示为在建）
    {"id": "DORM-PG", "name": "研究生宿舍", "cat": "dorm", "px": (138,282,96,46), "floors": 6,
     "status": "building", "desc": "西北侧研究生公寓（图中示为在建）。"},

    # ===== 餐饮 =====
    {"id": "CAN-ZIZHU", "name": "紫竹餐厅", "cat": "canteen", "px": (178,444,36,52), "floors": 3,
     "desc": "樱花苑3号楼北侧，含紫竹一~四食堂及民族食堂，约3900座。"},

    # ===== 服务配套 =====
    {"id": "SVC-LOGI", "name": "后勤服务楼", "cat": "service", "px": (136,400,66,38), "floors": 4,
     "desc": "后勤服务、配套办公，邻地面停车场。"},
    {"id": "SVC-N1", "name": "北区服务楼A", "cat": "service", "px": (132,168,62,20), "floors": 3,
     "desc": "西北侧服务/配套楼（名称待核对，邻菜鸟驿站）。"},
    {"id": "SVC-N2", "name": "北区服务楼B", "cat": "service", "px": (132,200,62,20), "floors": 3,
     "desc": "西北侧服务/配套楼（名称待核对）。"},
    {"id": "SVC-N3", "name": "北区服务楼C", "cat": "service", "px": (196,168,48,20), "floors": 3,
     "desc": "西北侧服务/配套楼（名称待核对）。"},
    {"id": "SVC-N4", "name": "北区服务楼D", "cat": "service", "px": (196,200,54,20), "floors": 3,
     "desc": "西北侧服务/配套楼（名称待核对）。"},
    {"id": "SVC-NORTH", "name": "北区综合服务楼", "cat": "service", "px": (268,158,58,82), "floors": 5,
     "desc": "北部中轴西侧综合服务楼（名称待核对，含停车场）。"},
    {"id": "SVC-SW", "name": "西南附属用房", "cat": "service", "px": (244,688,46,30), "floors": 2,
     "desc": "田径场东南、南湖西侧附属设备用房（名称待核对）。"},

    # ===== 体育（室内） =====
    {"id": "GYM", "name": "体育馆", "cat": "gym", "ellipse": (298,752,46,40), "floors": 3,
     "desc": "椭圆船形综合体育馆，含篮球/羽毛球/网球/乒乓球等14个训练馆。"},
    {"id": "GYM-BASKET", "name": "篮球馆", "cat": "gym", "px": (232,624,28,44), "floors": 2,
     "desc": "西南田径场东侧室内球类馆。"},
    {"id": "GYM-SWIM", "name": "游泳馆", "cat": "gym", "px": (232,668,28,44), "floors": 2,
     "desc": "西南田径场东侧室内游泳馆（名称待核对）。"},
    {"id": "GYM-TENNIS", "name": "网球馆", "cat": "gym", "px": (262,624,30,44), "floors": 2,
     "desc": "西南田径场东侧室内网球馆（名称待核对）。"},
    {"id": "GYM-EXTRA", "name": "球类训练馆", "cat": "gym", "px": (262,668,30,52), "floors": 2,
     "desc": "西南田径场东侧排球/训练馆（名称待核对）。"},

    # ===== 室外体育场地 =====
    {"id": "FIELD-NE", "name": "东北田径场", "cat": "field", "ellipse": (508,185,46,62),
     "floors": 0, "desc": "标准足球场+环形跑道+看台，位于校园东北角。"},
    {"id": "FIELD-SW", "name": "西南田径场（风雨操场）", "cat": "field", "ellipse": (188,718,58,72),
     "floors": 0, "desc": "樱花苑南侧，标准足球场+环形跑道。"},
    # 东北室外球场群
    {"id": "COURT-N-1", "name": "北侧篮球场群", "cat": "court", "px": (480,42,52,44), "floors": 0,
     "desc": "田径场北侧室外篮球场（多片）。"},
    {"id": "COURT-N-2", "name": "北侧网球场群", "cat": "court", "px": (480,86,52,40), "floors": 0,
     "desc": "田径场北侧室外网球场（多片）。"},
    {"id": "COURT-ENG", "name": "工程训练中心球场", "cat": "court", "px": (425,218,82,52), "floors": 0,
     "desc": "工程训练中心西侧篮球场/网球场（黄色块）。"},
    {"id": "COURT-MID", "name": "中部篮球场", "cat": "court", "px": (250,288,82,60), "floors": 0,
     "desc": "研究生宿舍东侧、音乐厅北侧篮球场（黄色块）。"},

    # ===== 停车 =====
    {"id": "PARK-E", "name": "东侧停车场", "cat": "parking", "px": (500,600,56,92), "floors": 0,
     "desc": "东南大型地面停车场。"},
    {"id": "PLAZA-HONGDE", "name": "宏德广场", "cat": "plaza", "px": (318,500,50,38), "floors": 0,
     "desc": "图书馆西南、柳湖东侧礼仪广场。"},
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
    {"id": "POI-CAINIAO", "name": "菜鸟驿站", "type": "express", "px": (140,180)},
    {"id": "POI-MARKET", "name": "烛光超市", "type": "market", "px": (200,505)},
    {"id": "POI-COFFEE", "name": "1958咖啡厅", "type": "coffee", "px": (205,540)},
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

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
    {"id": "TEACH-1", "name": "第一教学楼", "cat": "teaching", "px": (285,640,140,66), "floors": 5,
     "shape": "crescent", "desc": "开口朝南的马蹄形（U形）主教学楼：北侧中央为南北向玻璃主楼，东西两座弧形翼（A座西/B座东）由北连廊相接并向南围合出庭院；红褐色竖向格栅+白色平顶，130间智慧教室。"},
    {"id": "TEACH-2", "name": "第二教学楼", "cat": "teaching", "floors": 5,
     "shape": "poly",
     # 大矩形围合院群：东翼（右）最长向南突出，南缘中央入口凹口
     "poly": [(308,380),(356,368),(362,374),(360,392),(369,395),(368,418),
              (360,423),(350,421),(347,414),(338,414),(334,423),(312,423),
              (306,396)],
     "courtyards": [
        [(322,386),(346,381),(353,393),(330,398)],
        [(322,403),(347,400),(348,413),(324,417)]],
     "courtyard_green": [True, False],
     "roofgreen": True,
     "desc": "柳湖东北侧红砖多体块围合院落群（约5-6体块、2-3内院+连廊，局部绿色屋顶，南门廊），承担本科课堂教学。"},
    {"id": "LIB", "name": "图书馆", "cat": "library", "floors": 6,
     "shape": "poly",
     # 连续折线单一体量：主体矩形+东侧百叶带连体，东南角弧形切角
     "poly": [(362,434),(368,432),(397,430),(413,431),(414,457),(404,459),
              (400,453),(393,456),(392,472),(358,473),(358,445)],
     "roof": (158,92,66),
     "atrium": [(372,441),(397,439),(394,457),(377,461)],
     "desc": "约5万㎡，国家优质工程；连续折线单一体量（东侧百叶带与主体连体）+中央三角形玻璃采光中庭+弧形转角，红褐色横百叶+玻璃幕墙，临柳湖。"},
    {"id": "WENLI", "name": "文理楼（文科楼）", "cat": "college", "floors": 4,
     "shape": "poly",
     "poly": [(438,464),(471,462),(474,503),(439,501),(441,490),(460,488),
              (460,476),(439,475)],
     "roof": (170,90,68),
     "desc": "周恺设计红砖围合院落（C形，朝西开口内院）4层，水平条窗+局部镂空砖格栅、东北退台，文理学科教学用房。"},
    {"id": "ACT", "name": "大学生活动中心", "cat": "activity", "floors": 3,
     "shape": "act",
     "poly": [(277,396),(261,400),(256,410),(229,402),(238,429),(274,431),(282,421)],
     "desc": "单一白色菱形穿孔表皮体量（两翼南连、北缘V形凹口），南檐口波浪下凹，白平顶+矩形天窗，含剧场/社团/展厅。"},
    {"id": "CAN-YULAN", "name": "玉兰食堂（玉兰餐厅）", "cat": "canteen", "floors": 3,
     "shape": "yulan",
     # 双红砖盒体交错：北盒高（3层）、南盒矮（2层），中间架空；南侧大台阶
     "boxes": [(240,356,22,15,3),(238,371,24,13,2)],
     "steps_side": "s",
     "desc": "红砖盒形交错层叠食堂，室外大台阶直通二层、二层架空挑檐白柱、上层一条蓝玻带，含玉兰一/二食堂。"},

    # ===== 实验楼群（东南片区，一个大矩形合院环：东西翼南北贯通 + 四横档围两进内院） =====
    {"id": "LAB-H", "name": "实验楼H", "cat": "lab", "px": (394,526,53,12), "floors": 5,
     "desc": "北院北横档（北实验楼），红褐陶土+浅灰板带。"},
    {"id": "LAB-F", "name": "实验楼F", "cat": "lab", "px": (394,558,53,16), "floors": 5,
     "desc": "北院南横档（与南院北横档E紧贴分隔两院）。"},
    {"id": "LAB-E", "name": "实验楼E", "cat": "lab", "px": (394,584,53,14), "floors": 5,
     "desc": "南院北横档。"},
    {"id": "LAB-C", "name": "实验楼C", "cat": "lab", "px": (394,616,53,12), "floors": 5,
     "desc": "南院南横档。"},
    {"id": "LAB-TECH", "name": "实验楼A（西翼）", "cat": "lab", "px": (380,520,14,106), "floors": 5,
     "entrance": True,
     "desc": "实验群西翼（南北贯通两进院），红褐陶土下部+浅灰板带上部、密排竖窗，中段内凹Π形玻璃门厅，实景标牌『实验楼A』。"},
    {"id": "LAB-G", "name": "实验楼G（东翼）", "cat": "lab", "px": (447,520,11,108), "floors": 5,
     "desc": "实验群东翼（南北贯通、比西翼更长，临东门环岛）。"},

    # ===== 工程训练中心（泰瑞楼，泰瑞机器冠名） =====
    {"id": "ENG-TRAIN", "name": "工程训练中心（泰瑞楼）", "cat": "service", "floors": 4,
     "shape": "poly", "poly": [(400,250),(466,244),(470,312),(406,320)],
     "stripwin": True, "roof": (166,164,156),
     "corner_entry": True,
     "desc": "东北侧工程训练中心『泰瑞楼』（泰瑞机器冠名捐赠），红棕+浅灰板立面、横向条窗，转角内凹二层高玻璃入口，工程实践教学场地。"},

    # ===== 餐饮 =====
    {"id": "CAN-ZIZHU", "name": "紫竹食堂（紫竹餐厅）", "cat": "canteen", "floors": 3,
     "shape": "poly",
     "poly": [(183,447),(183,485),(209,485),(209,447),(202,447),
              (196,454),(190,447)],
     "desc": "西门内粉色竖长楼体，北缘双塔楼（两凸体间凹口），含紫竹一~四食堂及民族食堂，约3900座；红砖立面+竖向长条窗。"},

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
        elif "boxes" in b:
            # 多盒体（像素 bbox=(x,y,w,h,floors)）：grid 取并集外包络
            bx0=min(z[0] for z in b["boxes"]); by0=min(z[1] for z in b["boxes"])
            bx1=max(z[0]+z[2] for z in b["boxes"]); by1=max(z[1]+z[3] for z in b["boxes"])
            g = (px2gx(bx0), px2gy(by0), px2gx(bx1)-px2gx(bx0), px2gy(by1)-px2gy(by0))
            shape = "poly"; gpoly = None
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

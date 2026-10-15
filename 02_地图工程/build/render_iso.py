# -*- coding: utf-8 -*-
"""
等距(2.5D)真实感楼宇渲染器 —— 审批稿 v2
================================================================
在 v1 彩色方块基础上升级：
- 清晰深色轮廓描边（建筑外轮廓/檐口/竖棱）
- 顶面·南立面·东立面 三调明暗，左上固定光源
- 立面按楼层/开间排布窗格
- 真实外形：平屋顶+女儿墙+屋面设备、图书馆层叠退台、
  第一教学楼 U 形马蹄、校史馆圆形穹顶、体育馆椭圆船形弧顶、
  田径场跑道标线、校门门廊
- 建筑底部接触阴影、绿化树木点缀
数据源仍为 campus_data.py。
"""
import os, math
from PIL import Image, ImageDraw, ImageFont
import campus_data as C

OUT = os.path.join(os.path.dirname(__file__), "..", "check")
os.makedirs(OUT, exist_ok=True)

TW, TH = 44, 22
FLOOR_H = 14
BG = (234, 239, 244)
INK = (40, 50, 60)          # 主轮廓
INK2 = (66, 78, 88)         # 次轮廓

# ---------- 材质色板 ----------
ROOF = (104, 98, 90)        # 平屋顶
GLASS = (120, 160, 180)
GLASS_L = (150, 186, 202)
GLASS_DK = (74, 104, 124)
def hex2rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def shade(c, k): return tuple(max(0,min(255,int(v*k))) for v in c)
def add(c, d): return tuple(max(0,min(255,v+d)) for v in c)

# 各建筑材质（墙体主色）与形态
STYLE = {
    "TEACH-1":        dict(kind="u",      wall=(181,86,61),  floors=5),
    "TEACH-2":        dict(kind="block",  wall=(181,86,61),  floors=5),
    "LIB":            dict(kind="stack",  wall=(172,62,50),  floors=6),
    "ACT":            dict(kind="wedge",  wall=(212,126,62), floors=3),
    "MUSEUM-HISTORY": dict(kind="cupola", wall=(168,82,56),  floors=3),
    "GYM":            dict(kind="hall",   wall=(128,136,146),floors=2),
    "FIELD-SW":       dict(kind="field"),
    "CAN-ZIZHU":      dict(kind="block",  wall=(203,110,66), floors=3),
    "SVC-LOGI":       dict(kind="block",  wall=(114,126,138),floors=4),
    "ENG-TRAIN":      dict(kind="block",  wall=(108,120,132),floors=4),
    "GATE-S":         dict(kind="gate",   axis="h"),
    "GATE-E":         dict(kind="gate",   axis="v"),
    "GATE-W":         dict(kind="gate",   axis="v"),
}
LAB_WALL = (210, 202, 186)     # 实验楼群 米白
GATE_WALL = (170, 70, 52)

def font(sz):
    for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

LANDMARK = {
    "LIB": "图书馆", "TEACH-1": "第一教学楼", "TEACH-2": "第二教学楼",
    "MUSEUM-HISTORY": "校史馆", "ACT": "大学生活动中心",
    "GYM": "体育馆", "FIELD-SW": "操场",
    "CAN-ZIZHU": "紫竹餐厅", "SVC-LOGI": "后勤服务楼",
    "ENG-TRAIN": "泰瑞楼", "GATE-S": "南门(正门)", "GATE-E": "东门",
    "GATE-W": "西门",
}

def iso(gx, gy): return ((gx-gy)*TW/2.0, (gx+gy)*TH/2.0)

def style_of(b):
    st = STYLE.get(b["id"])
    if st: return st
    if b["cat"] == "lab":
        return dict(kind="block", wall=LAB_WALL, floors=b.get("floors",5))
    col = hex2rgb(C.CATEGORIES.get(b["cat"],("","#888888"))[1])
    return dict(kind="block", wall=col, floors=b.get("floors",3))

def iso_bounds():
    xs=[]; ys=[]
    for gx in [C.GX0, C.GX1]:
        for gy in [C.GY0, C.GY1]:
            x,y=iso(gx,gy); xs.append(x); ys.append(y)
    return min(xs),min(ys),max(xs),max(ys)

def render():
    minx,miny,maxx,maxy = iso_bounds()
    M_L, M_R, M_T, M_B = 280, 120, 210, 150
    W = int((maxx-minx)+M_L+M_R); H=int((maxy-miny)+M_T+M_B)
    OX, OY = -minx+M_L, -miny+M_T
    img = Image.new("RGB",(W,H),BG)
    layer = Image.new("RGBA",(W,H),(0,0,0,0))
    d = ImageDraw.Draw(layer)
    def T(x,y): return (x+OX, y+OY)
    def Tp(gx,gy): return T(*iso(gx,gy))

    # 向量工具（屏幕坐标）
    def vadd(a,b): return (a[0]+b[0], a[1]+b[1])
    def vsub(a,b): return (a[0]-b[0], a[1]-b[1])
    def vsc(a,k): return (a[0]*k, a[1]*k)
    def vlr(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)

    # ---------- 校园底盘 ----------
    ground = [Tp(C.GX0,C.GY0), Tp(C.GX1,C.GY0), Tp(C.GX1,C.GY1), Tp(C.GX0,C.GY1)]
    d.polygon(ground, fill=(204,222,184))
    for gx in range(int(C.GX0), int(C.GX1), 2):
        for gy in range(int(C.GY0), int(C.GY1), 2):
            if (gx+gy)%4==0:
                c=[Tp(gx,gy),Tp(gx+2,gy),Tp(gx+2,gy+2),Tp(gx,gy+2)]
                d.polygon(c, fill=(197,217,176))

    # ---------- 自然 ----------
    for n in C.build_nature():
        col = hex2rgb(C.CATEGORIES[n["cat"]][1])
        if n["shape"]=="poly":
            pts=[Tp(x,y) for x,y in n["gpoly"]]
        else:
            gx,gy,gw,gh=n["grid"]
            pts=[Tp(gx,gy),Tp(gx+gw,gy),Tp(gx+gw,gy+gh),Tp(gx,gy+gh)]
        if n["cat"]=="water":
            d.polygon(pts, fill=col, outline=shade(col,0.72))
            d.polygon([(x+1.5,y-3) for x,y in pts], fill=add(col,26))
            # 水面高光
            cxx=sum(p[0] for p in pts)/len(pts); cyy=sum(p[1] for p in pts)/len(pts)
            d.arc([cxx-26,cyy-10,cxx+26,cyy+18],200,330,fill=add(col,40),width=2)
        elif n["cat"]=="mountain":
            d.polygon(pts, fill=col, outline=shade(col,0.7))
            up=[(x,y-52) for x,y in pts]; d.polygon(up, fill=shade(col,1.08))
            d.line(up+[up[0]], fill=shade(col,0.7), width=2)
        else:
            d.polygon(pts, fill=col, outline=shade(col,0.82))

    # ---------- 景观渠 ----------
    canal=[Tp(C.px2gx(x),C.px2gy(y)) for x,y in C.CANAL]
    d.line(canal, fill=(90,166,116), width=12, joint="curve")
    d.line(canal, fill=(124,194,222), width=6, joint="curve")

    # ---------- 道路 ----------
    for r in C.build_roads():
        pts=[Tp(x,y) for x,y in r["gpts"]]
        w=max(6, int(r["w"]*TH/2.4))
        d.line(pts, fill=(176,172,161), width=w+6, joint="curve")
        d.line(pts, fill=(236,233,224), width=w, joint="curve")
        d.line(pts, fill=(226,202,126), width=2, joint="curve")

    recs = C.numbered_buildings()

    # ---------- 通用：接触阴影（平面多边形）----------
    def ground_shadow(pts2, alpha=58):
        sh=Image.new("RGBA",(W,H),(0,0,0,0)); sd=ImageDraw.Draw(sh)
        cx=sum(p[0] for p in pts2)/len(pts2); cy=sum(p[1] for p in pts2)/len(pts2)
        g=[(cx+(x-cx)*1.0+8, cy+(y-cy)*1.0+12) for x,y in pts2]
        sd.polygon(g, fill=(30,40,40,alpha))
        layer.alpha_composite(sh)

    def ground_shadow_ellipse(cx,cy,rx,ry,alpha=56,grow=1.08):
        sh=Image.new("RGBA",(W,H),(0,0,0,0)); sd=ImageDraw.Draw(sh)
        sd.ellipse([cx-rx*grow+8,cy-ry*grow+14,cx+rx*grow+8,cy+ry*grow+14],
                   fill=(30,40,40,alpha))
        layer.alpha_composite(sh)

    # ---------- 等距椭圆（正确变换：网格椭圆 -> 屏幕旋转椭圆）----------
    def epts(cxg,cyg,a,b,fa=1.0,fb=1.0,N=120,t0=0.0,t1=2*math.pi):
        aa=a*fa; bb=b*fb; pts=[]
        for i in range(N+1):
            t=t0+(t1-t0)*i/N
            pts.append(Tp(cxg+aa*math.cos(t), cyg+bb*math.sin(t)))
        return pts

    def efront_lohi(a,b):
        """屏幕朝向观察者的半弧参数角范围（θ: 东0→南π/2→西π）。"""
        phi=math.atan2(b,a)
        return phi-math.pi/2, phi+math.pi/2

    def ground_shadow_ell(cxg,cyg,a,b,fa=1.05,fb=1.05,alpha=52):
        sh=Image.new("RGBA",(W,H),(0,0,0,0)); sd=ImageDraw.Draw(sh)
        sd.polygon([(x+8,y+14) for x,y in epts(cxg,cyg,a,b,fa,fb,N=72)],
                   fill=(30,40,40,alpha))
        layer.alpha_composite(sh)

    def ell_wall(cxg,cyg,a,b,h,face,edge,N=48,frames=(0.42,0.74)):
        """椭圆建筑朝相机半弧挤出的墙身；返回檐口弧（屏幕点，右→左）。"""
        lo,hi=efront_lohi(a,b)
        arc=[]
        for i in range(N+1):
            t=lo+(hi-lo)*i/N
            arc.append(Tp(cxg+a*math.cos(t),cyg+b*math.sin(t)))
        d.polygon(list(arc)+[(x,y-h) for x,y in reversed(arc)],fill=face,outline=edge)
        d.line([arc[0],(arc[0][0],arc[0][1]-h)],fill=edge,width=2)
        d.line([arc[-1],(arc[-1][0],arc[-1][1]-h)],fill=edge,width=2)
        for fy in frames:
            d.line([(x,y-h*fy) for x,y in arc],fill=(58,68,78),width=2)
        return arc

    # ---------- 通用：立面窗格 ----------
    def facade_windows(dr, A, B, h, floors, units, glass=GLASS):
        if floors<=0 or units<=0: return
        def P(u,v):
            return (A[0]+(B[0]-A[0])*u, A[1]+(B[1]-A[1])*u - v*h)
        ww=0.56; vh=0.50
        for f in range(floors):
            v0=(f+0.26)/floors; v1=(f+0.26+vh)/floors
            # 层间腰线（深色细线，在窗上方）
            lf=(f+1.0)/floors
            dr.line([P(0,lf),P(1,lf)], fill=(60,60,64), width=1)
            for i in range(units):
                u0=(i+(1-ww)/2)/units; u1=(i+1-(1-ww)/2)/units
                quad=[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)]
                dr.polygon(quad, fill=glass, outline=shade(glass,0.66))
                # 窗中竖框
                dr.line([P((u0+u1)/2,v0),P((u0+u1)/2,v1)], fill=add(glass,18), width=1)

    # ---------- 通用：挤出平面多边形（顺时针屏幕点）----------
    def extrude_poly(dr, pts2, h, wall, floors=0, edge_units=None,
                     roof=ROOF, glass=GLASS, edge=INK, parapet=True,
                     roof_facilities=True, lw=3, z_base=0):
        n=len(pts2)
        if z_base==0:
            ground_shadow(pts2)
        def Z(p): return (p[0], p[1]-z_base)
        if edge_units is None: edge_units=[1]*n
        for i in range(n):
            A=Z(pts2[i]); B=Z(pts2[(i+1)%n])
            ex=B[0]-A[0]
            if ex < -0.5:   # 朝向相机的墙
                ey=B[1]-A[1]
                face = shade(wall,0.62) if ey>0 else shade(wall,0.84)  # 东墙暗/南墙亮
                tA=(A[0],A[1]-h); tB=(B[0],B[1]-h)
                dr.polygon([A,B,tB,tA], fill=face, outline=edge)
                facade_windows(dr, A, B, h, floors, edge_units[i], glass)
                dr.line([A,tA], fill=edge, width=2)     # 竖棱
        # 屋顶
        top=[(x,y-z_base-h) for x,y in pts2]
        if parapet:
            dr.polygon(top, fill=add(wall,14), outline=edge)   # 女儿墙顶
            cx=sum(p[0] for p in top)/n; cy=sum(p[1] for p in top)/n
            inner=[(cx+(x-cx)*0.85, cy+(y-cy)*0.85) for x,y in top]
            dr.polygon(inner, fill=roof, outline=shade(roof,0.8))
            # 屋面分格线
            a=vlr(inner[0],inner[1],0.5); b=vlr(inner[3],inner[2],0.5)
            dr.line([a,b], fill=shade(roof,0.72), width=1)
            a2=vlr(inner[0],inner[3],0.5); b2=vlr(inner[1],inner[2],0.5)
            dr.line([a2,b2], fill=shade(roof,0.78), width=1)
            if roof_facilities and floors>=3:
                # 玻璃采光天窗（平铺小菱形，不扭曲）
                k=0.30
                sk=[(cx+(x-cx)*k, cy+(y-cy)*k) for x,y in inner]
                sk=[vlr(sk[0],sk[1],0.18),vlr(sk[1],sk[2],0.3),
                    vlr(sk[2],sk[3],0.22),vlr(sk[3],sk[0],0.28)]
                dr.polygon(sk, fill=GLASS_DK, outline=shade(GLASS_DK,0.65))
        else:
            dr.polygon(top, fill=add(wall,12), outline=edge)
        dr.line(top+[top[0]], fill=edge, width=lw)   # 檐口轮廓
        return top

    def box_pts(gx,gy,gw,gh):
        return [Tp(gx,gy),Tp(gx+gw,gy),Tp(gx+gw,gy+gh),Tp(gx,gy+gh)]

    def units_for(gw,gh):
        return [max(1,round(gw/2.5)), max(1,round(gh/2.5)),
                max(1,round(gw/2.5)), max(1,round(gh/2.5))]

    # ---------- 标准盒体 ----------
    def draw_block(b, st, ovs=None):
        gx,gy,gw,gh=b["grid"]
        if ovs:
            gx,gy,gw,gh=ovs
        h=FLOOR_H*st["floors"]
        pts=box_pts(gx,gy,gw,gh)
        extrude_poly(d, pts, h, st["wall"], floors=st["floors"],
                     edge_units=units_for(gw,gh), glass=GLASS)
        return roof_center(gx,gy,gw,gh,h)

    def roof_center(gx,gy,gw,gh,h):
        c=iso(gx+gw/2,gy+gh/2)
        return (c[0]+OX, c[1]+OY-h)

    # ---------- 图书馆：层叠退台 ----------
    def draw_stack(b, st):
        gx,gy,gw,gh=b["grid"]; total=FLOOR_H*st["floors"]
        # (缩进, 高度占比, 层数)
        tiers=[(0.0, 0.36, 2), (4.6, 0.32, 2), (9.2, 0.32, 2)]
        z=0.0
        for ti,(ins,frac,fl) in enumerate(tiers):
            hh=total*frac
            x=gx+ins*0.66; y=gy+ins*0.66; w=gw-ins*1.32; dd=gh-ins*1.32
            pts=box_pts(x,y,w,dd)
            extrude_poly(d, pts, hh, st["wall"], floors=fl,
                         edge_units=units_for(w,dd), glass=GLASS_L,
                         z_base=z, roof_facilities=(ti==len(tiers)-1))
            z+=hh
        return roof_center(gx,gy,gw,gh,total)

    # ---------- 一教：U 形马蹄 ----------
    def draw_u(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        wingW=max(4.0, gw*0.17)
        bodyD=max(4.0, gh*0.40)
        # 先画内院铺地（楼体随后压在其上）
        yard=[Tp(gx+wingW,gy+0.6),Tp(gx+gw-wingW,gy+0.6),
              Tp(gx+gw-wingW,gy+gh-bodyD-0.4),Tp(gx+wingW,gy+gh-bodyD-0.4)]
        d.polygon(yard, fill=(198,188,168), outline=(172,162,142))
        # 内院中央绿地
        yd=[Tp(gx+wingW+1.4,gy+1.8),Tp(gx+gw-wingW-1.4,gy+1.8),
            Tp(gx+gw-wingW-1.4,gy+gh-bodyD-1.6),Tp(gx+wingW+1.4,gy+gh-bodyD-1.6)]
        d.polygon(yd, fill=(112,160,86), outline=(96,140,72))
        parts=[
            (gx, gy, wingW, gh, units_for(wingW,gh)),                 # 西翼
            (gx+gw-wingW, gy, wingW, gh, units_for(wingW,gh)),        # 东翼
            (gx, gy+gh-bodyD, gw, bodyD, units_for(gw,bodyD)),        # 南主楼
        ]
        for x,y,w,dd,uu in parts:
            pts=box_pts(x,y,w,dd)
            extrude_poly(d, pts, h, st["wall"], floors=st["floors"],
                         edge_units=uu, glass=GLASS)
        return roof_center(gx,gy,gw,gh,h)

    # ---------- 活动中心：斜楔异形 ----------
    def draw_wedge(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        # 主块 + 一个斜切角（近似官方图两楔）
        pts=[Tp(gx,gy+gh*0.18),Tp(gx+gw*0.62,gy),Tp(gx+gw,gy+gh*0.34),
             Tp(gx+gw,gy+gh),Tp(gx+gw*0.2,gy+gh)]
        uu=[max(1,round(gw*0.6/2.5)),max(1,round(gh*0.5/2.5)),
            max(1,round(gw*0.8/2.5)),max(1,round(gh*0.8/2.5)),
            max(1,round(gw*0.2/2.5))]
        extrude_poly(d, pts, h, st["wall"], floors=st["floors"],
                     edge_units=uu, glass=GLASS)
        c=iso(gx+gw/2,gy+gh/2)
        return (c[0]+OX,c[1]+OY-h)

    # ---------- 校史馆：圆形鼓座 + 圆锥坡顶 ----------
    def draw_cupola(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        cxg,cyg=gx+gw/2,gy+gh/2; a,b=gw/2,gh/2
        wall=st["wall"]
        ground_shadow_ell(cxg,cyg,a,b,1.16,1.16)
        # 台基（两圈石阶）
        d.polygon(epts(cxg,cyg,a,b,1.18,1.18,90),fill=shade(wall,0.6))
        d.line(epts(cxg,cyg,a,b,1.18,1.18,90),fill=INK,width=2)
        d.polygon(epts(cxg,cyg,a,b,1.08,1.08,90),fill=shade(wall,0.72))
        d.line(epts(cxg,cyg,a,b,1.08,1.08,90),fill=INK,width=1)
        # 圆柱鼓座墙（南半弧挤出）
        ell_wall(cxg,cyg,a,b,h,shade(wall,0.82),INK,frames=(0.34,0.68))
        # 环廊拱形窗（沿南半弧分布）
        lo,hi=efront_lohi(a,b)
        for i in range(1,10):
            t=lo+(hi-lo)*i/10
            p=Tp(cxg+a*math.cos(t),cyg+b*math.sin(t))
            ww=max(6,(a*TW/2)*0.10)
            d.rounded_rectangle([p[0]-ww/2,p[1]-h*0.66,p[0]+ww/2,p[1]-h*0.12],
                                radius=ww*0.5,fill=(228,230,232),outline=shade(wall,0.5))
        # 檐口南半弧（抬高 h，即坡顶底沿）
        N=30
        eave=[]
        for i in range(N+1):
            t=lo+(hi-lo)*i/N
            p=Tp(cxg+a*math.cos(t),cyg+b*math.sin(t))
            eave.append((p[0],p[1]-h))
        rise=a*TW/2*0.6
        apex=(Tp(cxg,cyg)[0], Tp(cxg,cyg)[1]-h-rise)
        for i in range(N):
            col=shade(wall,1.14) if i<N/2 else shade(wall,0.92)
            d.polygon([apex,eave[i],eave[i+1]],fill=col)
        # 瓦棱（母线）
        for aa in (0.20,0.40,0.60,0.80):
            t=lo+(hi-lo)*aa
            p=Tp(cxg+a*math.cos(t),cyg+b*math.sin(t))
            d.line([apex,(p[0],p[1]-h)],fill=shade(wall,0.82),width=1)
        # 坡顶左右轮廓线（apex 到檐口最左/最右）
        d.line([apex,eave[0]],fill=INK,width=2)
        d.line([apex,eave[-1]],fill=INK,width=2)
        d.line(eave,fill=INK,width=2)
        # 西坡高光
        th=lo+(hi-lo)*0.26
        ph=Tp(cxg+a*math.cos(th),cyg+b*math.sin(th))
        d.line([apex,(ph[0],ph[1]-h)],fill=add(wall,48),width=2)
        # 宝顶
        tx,ty=apex
        d.ellipse([tx-5,ty-5,tx+5,ty+5],fill=(226,190,96),outline=INK)
        d.polygon([(tx,ty-14),(tx-4,ty-4),(tx+4,ty-4)],fill=(226,190,96),outline=INK)
        # 徽章定位点：鼓座南墙（最前点）
        phi=math.atan2(b,a)
        f=Tp(cxg+a*math.cos(phi),cyg+b*math.sin(phi))
        return (f[0],f[1]-h*0.42)

    # ---------- 体育馆：椭圆大跨半椭球壳顶 ----------
    def draw_hall(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        cxg,cyg=gx+gw/2,gy+gh/2; a,b=gw/2,gh/2
        wall=st["wall"]
        ground_shadow_ell(cxg,cyg,a,b,1.12,1.12)
        # 基座（地面椭圆）
        d.polygon(epts(cxg,cyg,a,b,1,1,90),fill=shade(wall,0.5))
        d.line(epts(cxg,cyg,a,b,1,1,90),fill=INK,width=2)
        # 玻璃幕墙墙身（南半弧挤出）
        ell_wall(cxg,cyg,a,b,h,GLASS_DK,INK,frames=(0.4,0.72))
        # 半椭球壳顶（纬度环带：从檐口 u=0 到脊 u=1）
        lo,hi=efront_lohi(a,b); phi=math.atan2(b,a)
        rise=b*TH/2*0.82
        M=34; U=15
        def hpt(u,t):
            s=math.sqrt(max(0.0,1-u*u))
            p=Tp(cxg+a*s*math.cos(t),cyg+b*s*math.sin(t))
            return (p[0],p[1]-h-rise*u)
        for iu in range(U):
            u0=iu/U; u1=(iu+1)/U
            for it in range(M):
                t0=lo+(hi-lo)*it/M; t1=lo+(hi-lo)*(it+1)/M
                lit=(t0<phi)
                # 越靠脊越亮（受光面），西坡更亮
                base=shade(wall,1.05) if lit else shade(wall,0.86)
                k=0.08*u0
                col=add(base,int(20*k)) if lit else shade(base,0.98)
                d.polygon([hpt(u0,t0),hpt(u0,t1),hpt(u1,t1),hpt(u1,t0)],fill=col)
        # 檐口轮廓（整圈）
        eave=[(x,y-h) for x,y in epts(cxg,cyg,a,b,1,1,110)]
        d.line(eave,fill=INK,width=3,joint="curve")
        # 脊线高光（西坡，沿 u 方向的一条弧）
        hl=[]
        for iu in range(U+1):
            hl.append(hpt(iu/U, lo+(hi-lo)*0.30))
        d.line(hl,fill=add(wall,60),width=4)
        # 正门（最前点门廊）
        phi=math.atan2(b,a)
        f0=Tp(cxg+a*math.cos(phi),cyg+b*math.sin(phi))
        ww=30
        d.rectangle([f0[0]-ww/2,f0[1]-h*0.92,f0[0]+ww/2,f0[1]+4],fill=(46,54,62),outline=INK)
        d.rectangle([f0[0]-ww*0.32,f0[1]-h*0.85,f0[0]+ww*0.32,f0[1]+4],fill=(60,72,86))
        d.line([(f0[0]-ww/2,f0[1]-h*0.92),(f0[0],f0[1]-h*1.12),
                (f0[0]+ww/2,f0[1]-h*0.92)],fill=INK,width=3)
        return hpt(1,phi)

    # ---------- 田径场 ----------
    def draw_field(b, st):
        gx,gy,gw,gh=b["grid"]
        cxg,cyg=gx+gw/2,gy+gh/2
        a,b=gw/2,gh/2
        cx,cy=Tp(cxg,cyg)
        ground_shadow_ell(cxg,cyg,a,b)
        def efill(fa,fb,fill,outline=None,ow=2,N=110):
            pts=epts(cxg,cyg,a,b,fa,fb,N)
            d.polygon(pts,fill=fill)
            if outline:
                d.line(pts,fill=outline,width=ow,joint="curve")
        # 基底（塑胶深底）
        efill(1.0,1.0,(150,108,60))
        # 外圈白沿线
        efill(0.975,0.975,(246,244,236))
        # 跑道（由外向内逐圈，露出色环）
        for k,(fa,col) in enumerate([(0.965,(206,128,56)),(0.915,(210,136,64)),
                                     (0.865,(214,144,72)),(0.815,(216,150,80)),
                                     (0.765,(218,156,88))]):
            efill(fa,fa,col)
        # 内沿白圈
        efill(0.745,0.745,(246,244,236))
        # 内场草地
        efill(0.735,0.735,(96,156,78))
        # 足球场（网格空间内接草地椭圆）
        ag=0.735*a; bg=0.735*b
        hw_g=ag*0.60; hl_g=bg*0.74
        def fp(ugx,ugy):
            p=iso(cxg+ugx,cyg+ugy); return (p[0]+OX,p[1]+OY)
        cA,cB,cC,cD=fp(-hw_g,-hl_g),fp(hw_g,-hl_g),fp(hw_g,hl_g),fp(-hw_g,hl_g)
        d.line([cA,cB,cC,cD,cA],fill=(252,252,247),width=2)
        d.line([fp(-hw_g,0),fp(hw_g,0)],fill=(252,252,247),width=2)
        # 中圈（网格圆，正确投影）
        r=hw_g*0.44
        d.line(epts(cxg,cyg,r,r,1,1,90),fill=(252,252,247),width=2,joint="curve")
        d.ellipse([cx-3,cy-3,cx+3,cy+3],fill=(252,252,247))
        # 大禁区
        pb=hl_g*0.30; pw_g=hw_g*0.60
        for s in (-1,1):
            d.line([fp(-pw_g,s*hl_g),fp(pw_g,s*hl_g),
                    fp(pw_g,s*(hl_g-pb)),fp(-pw_g,s*(hl_g-pb)),
                    fp(-pw_g,s*hl_g)],fill=(252,252,247),width=2)
        # 小禁区
        pb2=hl_g*0.15; pw2=hw_g*0.32
        for s in (-1,1):
            d.line([fp(-pw2,s*hl_g),fp(pw2,s*hl_g),
                    fp(pw2,s*(hl_g-pb2)),fp(-pw2,s*(hl_g-pb2))],
                   fill=(252,252,247),width=1)
        return (cx,cy)

    # ---------- 校门 ----------
    def draw_gate(b, st):
        gx,gy,gw,gh=b["grid"]
        h=FLOOR_H*2.4
        if st["axis"]=="h":   # 南门：东西向
            pts=box_pts(gx,gy,gw,gh)
            # 门廊横梁
            extrude_poly(d, pts, h, GATE_WALL, floors=2,
                         edge_units=[1,1,1,1], glass=GLASS,
                         roof_facilities=False, lw=3)
            cx=gx+gw/2
            # 中央通道（门洞用深色）
            mid=Tp(cx,gy); mid2=Tp(cx,gy+gh)
            d.line([(mid[0],mid[1]-h),(mid2[0],mid2[1]-h)],fill=(20,26,32),width=8)
        else:                  # 东西门：南北向
            pts=box_pts(gx,gy,gw,gh)
            extrude_poly(d, pts, h, GATE_WALL, floors=2,
                         edge_units=[1,1,1,1], glass=GLASS,
                         roof_facilities=False, lw=3)
        c=iso(gx+gw/2,gy+gh/2)
        return (c[0]+OX,c[1]+OY-h)

    # ---------- 树木（在建筑之前画，建筑压树）----------
    def tree(gx,gy,s=1.0,col=(72,130,64)):
        x,y=Tp(gx,gy)
        d.ellipse([x-9*s,y-4*s,x+9*s,y+10*s],fill=(0,0,0,40))
        d.rectangle([x-2*s,y-2*s,x+2*s,y+6*s],fill=(110,84,54))
        d.ellipse([x-13*s,y-20*s,x+13*s,y+6*s],fill=shade(col,0.9),outline=shade(col,0.7))
        d.ellipse([x-16*s,y-14*s,x+4*s,y+8*s],fill=col,outline=shade(col,0.75))
        d.ellipse([x-9*s,y-26*s,x+9*s,y-4*s],fill=add(col,18),outline=shade(col,0.85))

    # 绿地内撒树（确定性，避开建筑/水体）
    def in_nature(gx,gy,wants=("park",)):
        for n in C.build_nature():
            if n["cat"] not in wants: continue
            if n["shape"]=="poly":
                poly=n["gpoly"]
                inside=False; j=len(poly)-1
                for i in range(len(poly)):
                    xi,yi=poly[i]; xj,yj=poly[j]
                    if ((yi>gy)!=(yj>gy)) and (gx<(xj-xi)*(gy-yi)/(yj-yi)+xi):
                        inside=not inside
                    j=i
                if inside: return True
            else:
                x,y,w,h=n["grid"]
                if x<=gx<=x+w and y<=gy<=y+h: return True
        return False
    def in_building(gx,gy):
        for b in recs:
            x,y,w,h=b["grid"]
            if x-2<=gx<=x+w+2 and y-2<=gy<=y+h+2: return True
        return False
    tree_seed=0
    for gx in range(int(C.GX0)+2,int(C.GX1)-2,4):
        for gy in range(int(C.GY0)+2,int(C.GY1)-2,4):
            tree_seed=(tree_seed*1103515245+12345)&0x7fffffff
            if (tree_seed%100)>26: continue
            if in_nature(gx,gy) and not in_building(gx,gy):
                s=0.8+(tree_seed%5)/10.0
                col=(70,126,60) if (tree_seed%2)==0 else (92,150,74)
                tree(gx,gy,s,col)

    # ---------- 建筑（按深度后→前）----------
    def depth(b):
        gx,gy,gw,gh=b["grid"]; return (gx+gy+gh)
    centers={}
    for b in sorted(recs,key=depth):
        st=style_of(b)
        kind=st["kind"]
        if kind=="field":
            ctr=draw_field(b,st)
        elif kind=="u":
            ctr=draw_u(b,st)
        elif kind=="stack":
            ctr=draw_stack(b,st)
        elif kind=="wedge":
            ctr=draw_wedge(b,st)
        elif kind=="cupola":
            ctr=draw_cupola(b,st)
        elif kind=="hall":
            ctr=draw_hall(b,st)
        elif kind=="gate":
            ctr=draw_gate(b,st)
        else:
            ctr=draw_block(b,st)
        centers[b["id"]]=(ctr,b)

    # ---------- 编号 + 名称（在建筑之上）----------
    for bid,(ctr,b) in centers.items():
        cxs,cys=ctr
        if style_of(b)["kind"] in ("field","hall","cupola"):
            cys=cys-6
        num="%02d"%b["no"]; fn=font(16)
        tw=d.textlength(num,font=fn); bh=24
        bw=max(32,tw+16)
        d.rounded_rectangle([cxs-bw/2,cys-bh/2,cxs+bw/2,cys+bh/2],radius=7,
                            fill=(255,255,255,242),outline=INK,width=2)
        d.text((cxs-tw/2,cys-11),num,fill=(35,42,52),font=fn)
        if bid in LANDMARK:
            nm=LANDMARK[bid]; f2=font(17)
            tw2=d.textlength(nm,font=f2)
            d.rounded_rectangle([cxs-tw2/2-7,cys+bh/2+3,cxs+tw2/2+7,cys+bh/2+27],
                                radius=5,fill=(28,38,48,190))
            d.text((cxs-tw2/2,cys+bh/2+5),nm,fill=(255,255,255),font=f2)

    # ---------- POI ----------
    for p in C.build_pois():
        x,y=Tp(*p["grid"]); y-=10
        d.ellipse([x-6,y-6,x+6,y+6],fill=(242,198,18),outline=(130,84,0),width=2)

    img=Image.alpha_composite(img.convert("RGBA"),layer)
    dl=ImageDraw.Draw(img)
    ftitle=font(36); fsub=font(20); fleg=font(19); flegb=font(21)
    dl.text((40,30),"北京化工大学昌平校区 · 2.5D等距数字校园 · 楼宇建模（审批稿）",fill=(28,42,52),font=ftitle)
    dl.text((42,82),"按编号对照《建筑点位台账》核对；当前为程序化建模（含真实轮廓/立面/屋顶），后续各建筑替换为像素风插图。共 %d 个建筑/场地对象。"%len(recs),
            fill=(88,98,108),font=fsub)

    _name_pos={n["name"]:(n["grid"][0]+n["grid"][2]/2, n["grid"][1]+n["grid"][3]/2)
               for n in C.build_nature()}
    for nm,col in [("玉屏山",(240,255,240)),("柳湖",(255,255,255)),("南湖",(255,255,255))]:
        if nm not in _name_pos: continue
        ngx,ngy=_name_pos[nm]
        x,y=Tp(ngx,ngy)
        f=font(20); tw=dl.textlength(nm,font=f)
        dl.rounded_rectangle([x-tw/2-8,y-15,x+tw/2+8,y+13],radius=6,fill=(20,40,30,150))
        dl.text((x-tw/2,y-13),nm,fill=col,font=f)

    # 图例（仅实际使用类别）
    used=set(b["cat"] for b in recs) | set(n["cat"] for n in C.build_nature())
    legend=[(k,v) for k,v in C.CATEGORIES.items() if k in used]
    lx,ly=40,H-40-len(legend)*24
    dl.rounded_rectangle([lx-14,ly-34,lx+250,ly+len(legend)*24+14],radius=12,
                         fill=(255,255,255,240),outline=(198,204,210))
    dl.text((lx,ly-22),"图例 / 分类",fill=(24,34,44),font=flegb)
    for i,(k,(zh,hex_)) in enumerate(legend):
        yy=ly+18+i*24
        dl.rectangle([lx,yy,lx+24,yy+19],fill=hex2rgb(hex_),outline=(80,80,80))
        dl.text((lx+32,yy),zh,fill=(28,28,28),font=fleg)

    # 指北针
    nx,ny=W-170,150
    angN=math.atan2(-TH,TW)
    dl.ellipse([nx-46,ny-46,nx+46,ny+46],fill=(255,255,255),outline=(178,184,190),width=2)
    for lab,ang,col in [("N",angN,(192,57,43)),("E",-angN,(90,100,110)),
                        ("S",angN+math.pi,(90,100,110)),("W",math.pi-angN,(90,100,110))]:
        ux=nx+math.cos(ang)*30; uy=ny+math.sin(ang)*30
        if lab=="N":
            tip=(nx+math.cos(ang)*40, ny+math.sin(ang)*40)
            b1=(nx+math.cos(ang+2.4)*12, ny+math.sin(ang+2.4)*12)
            b2=(nx+math.cos(ang-2.4)*12, ny+math.sin(ang-2.4)*12)
            dl.polygon([tip,b1,b2],fill=col)
        dl.text((ux-6,uy-10),lab,fill=(40,50,60),font=flegb)

    img.convert("RGB").save(os.path.join(OUT,"iso_framework.png"),quality=94)
    im=img.convert("RGB"); im.thumbnail((2200,2200)); im.save(os.path.join(OUT,"iso_framework_small.png"),quality=90)
    print("saved iso_framework.png", img.size)

render()

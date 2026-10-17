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
    "TEACH-1":        dict(kind="crescent", wall=(176,78,58),  floors=5),
    "TEACH-2":        dict(kind="polyblock", wall=(176,78,58),  floors=5),
    "LIB":            dict(kind="polyblock",   wall=(172,74,54),  floors=6),
    "WENLI":          dict(kind="polyblock", wall=(112,142,168),floors=5),   # 文科楼（在建，官方图蓝）
    "ACT":            dict(kind="act",   wall=(226,224,216),floors=3),
    "CAN-YULAN":      dict(kind="polyblock", wall=(138,158,176),floors=3),   # 玉兰食堂（在建，蓝）
    "GYM":            dict(kind="gymbox",wall=(156,66,50),floors=4),
    "FIELD-N":        dict(kind="field"),
    "FIELD-W":        dict(kind="field"),
    "CAN-ZIZHU":      dict(kind="polyblock", wall=(182,84,62),  floors=3),
    "ENG-TRAIN":      dict(kind="polyblock", wall=(176,92,68),floors=4),
    "GATE-S":         dict(kind="gate",   axis="h"),
    "GATE-E":         dict(kind="gate",   axis="v"),
    "GATE-W":         dict(kind="gate",   axis="v"),
}
LAB_WALL = (188, 122, 96)      # 实验楼群 砖红（与教学楼同色系、略灰）
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
    "WENLI": "文理楼", "ACT": "大学生活动中心", "CAN-YULAN": "玉兰食堂",
    "GYM": "体育馆", "FIELD-N": "北操场", "FIELD-W": "风雨操场",
    "CAN-ZIZHU": "紫竹食堂",
    "ENG-TRAIN": "工程训练中心", "GATE-S": "南门(正门)", "GATE-E": "东门",
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
            # 玉屏山：平坦绿色基座 + 两座圆润重叠的山丘（半椭球穹顶，平滑无棱）
            gpk=n["gpoly"]  # 山基由各圆丘底椭圆自然拼合（圆润无尖角）
            def draw_dome(dom,hv=1.0):
                dcx=C.px2gx(dom["cx"]); dcy=C.px2gy(dom["cy"])
                drx=dom["rx"]*C._SCALE; dry=dom["ry"]*C._SCALE
                hh=math.sqrt(drx*drx+dry*dry)*11.0*1.08*hv   # 屏幕像素
                NT=88; NP=52
                mcol=(78,148,72)                            # 玉屏山丘绿（明亮）
                V=(0.50,0.60,0.62)                          # 相机方向（东,南,上）
                L=(0.72,0.52,0.42)                          # 东南侧光（水平主导，消同心环）
                ground=[Tp(dcx+drx*math.cos(2*math.pi*j/NT),
                         dcy+dry*math.sin(2*math.pi*j/NT)) for j in range(NT+1)]
                d.polygon(ground,fill=shade(mcol,0.94),outline=shade(mcol,0.80))
                def rpt(theta,t):
                    rr=math.cos(theta); z=hh*math.sin(theta)
                    x,y=Tp(dcx+drx*rr*math.cos(t), dcy+dry*rr*math.sin(t))
                    return (x,y-z)
                for i in range(NP):
                    th0=math.pi/2*i/NP; th1=math.pi/2*(i+1)/NP
                    thm=(th0+th1)/2
                    for j in range(NT):
                        t0=2*math.pi*j/NT; t1=2*math.pi*(j+1)/NT
                        tm=(t0+t1)/2
                        nx=math.cos(thm)*math.cos(tm); ny=math.cos(thm)*math.sin(tm); nz=math.sin(thm)
                        vis=nx*V[0]+ny*V[1]+nz*V[2]
                        if vis<=0.02:
                            continue
                        li=nx*L[0]+ny*L[1]+nz*L[2]
                        cf=shade(mcol, 0.86+0.26*max(0.0,li))
                        d.polygon([rpt(th0,t0),rpt(th0,t1),rpt(th1,t1),rpt(th1,t0)],fill=cf)
                # 环山步道（南半坡白色等高线，官方图登山道，t∈[0,π] 连续弧）
                thw=0.50
                seg=[]
                for j in range(NT//2+1):
                    t=math.pi*j/(NT//2)
                    seg.append(rpt(thw,t))
                d.line(seg,fill=(242,242,232),width=3,joint="curve")
                wE=seg[0]; wW=seg[-1]
                tx,ty=Tp(dcx,dcy)
                return (tx,ty-hh),hh,dcx,dcy,drx,dry,wE,wW
            domes=n.get("domes",[])
            domes=sorted(domes,key=lambda dm:(C.px2gx(dm["cx"])+C.px2gy(dm["cy"])))
            tops=[]
            for i,dm in enumerate(domes):
                tops.append(draw_dome(dm, 1.0 if i==0 else 1.16))
            # 东峰『高镜亭』（红色小亭，落在东丘顶）
            if tops:
                (sx,sy)=tops[-1][0]; sy-=2
                d.polygon([(sx-6,sy),(sx+6,sy),(sx+4,sy-6),(sx-4,sy-6)],
                          fill=(150,54,44),outline=(110,40,34))
                d.polygon([(sx-9,sy-6),(sx+9,sy-6),(sx,sy-17)],
                          fill=(186,70,54),outline=(120,44,36))
                d.rectangle([sx-1,sy-22,sx+1,sy-17],fill=(96,40,32))
            # 山顶稀疏树丛
            import random as _rnd
            _rnd.seed(7)
            for tip in tops:
                (cx_,cy_),hh,dcx,dcy,drx,dry,_wE,_wW=tip
                for k in range(6):
                    a=_rnd.uniform(0,2*math.pi); rr=_rnd.uniform(0.08,0.55)
                    ux=drx*rr*math.cos(a); uy=dry*rr*math.sin(a)
                    theta=math.acos(rr); z=hh*math.sin(theta)
                    sx_,sy_=Tp(dcx+ux,dcy+uy); sy_-=z
                    tc=(70,118,58) if k%2 else (88,136,68)
                    d.ellipse([sx_-7,sy_-11,sx_+7,sy_+3],fill=tc,outline=shade(tc,0.7))
                    d.ellipse([sx_-4,sy_-17,sx_+4,sy_-5],fill=add(tc,14))
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
                if glass is not None:
                    facade_windows(dr, A, B, h, floors, edge_units[i], glass)
                dr.line([A,tA], fill=edge, width=2)     # 竖棱
        # 屋顶
        top=[(x,y-z_base-h) for x,y in pts2]
        cx=sum(p[0] for p in top)/n; cy=sum(p[1] for p in top)/n
        if parapet and n==4:
            dr.polygon(top, fill=add(wall,14), outline=edge)   # 女儿墙顶
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
        elif parapet:
            # 凹多边形：屋顶平铺，保留女儿墙红边，不画内圈/X分格（避免跨凹口伪影）
            dr.polygon(top, fill=add(wall,14), outline=edge)
            shrink=[(cx+(x-cx)*0.955, cy+(y-cy)*0.955) for x,y in top]
            dr.polygon(shrink, fill=roof, outline=shade(roof,0.82))
        else:
            dr.polygon(top, fill=add(wall,12), outline=edge)
        dr.line(top+[top[0]], fill=edge, width=lw)   # 檐口轮廓
        return top

    def box_pts(gx,gy,gw,gh):
        return [Tp(gx,gy),Tp(gx+gw,gy),Tp(gx+gw,gy+gh),Tp(gx,gy+gh)]

    def units_for(gw,gh):
        return [max(1,round(gw/2.5)), max(1,round(gh/2.5)),
                max(1,round(gw/2.5)), max(1,round(gh/2.5))]

    # 屏幕多边形环绕方向规范化（标准方块为正面积，负面积反转），供所有异形挤出复用
    def signed_area(qq):
        m=len(qq)
        return sum(qq[i][0]*qq[(i+1)%m][1]-qq[(i+1)%m][0]*qq[i][1] for i in range(m))
    def as_cw(qq):
        return qq[::-1] if signed_area(qq)<0 else qq
    def edge_units_of(qq, k=16):
        m=len(qq)
        return [max(1,round(math.hypot(qq[(i+1)%m][0]-qq[i][0],
                qq[(i+1)%m][1]-qq[i][1])/k)) for i in range(m)]

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

    # ---------- 一教 / 后勤：U 形马蹄（开口朝北）----------
    def draw_u(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        arc = st.get("arc_",False); porch = st.get("porch",False)
        wingW=max(4.0, gw*0.16)
        bodyD=max(4.0, gh*0.42)
        curv = gh*0.30 if arc else 0.0
        ins = wingW*0.55 if arc else 0.0   # 翼端向内收（月牙）
        # 内院（北凹）
        d.polygon([Tp(gx+ins+wingW,gy+0.3),Tp(gx+gw-ins-wingW,gy+0.3),
                   Tp(gx+gw-wingW,gy+gh-bodyD),Tp(gx+wingW,gy+gh-bodyD)],
                  fill=(198,188,168), outline=(172,162,142))
        d.polygon([Tp(gx+ins+wingW+1.5,gy+6),Tp(gx+gw-ins-wingW-1.5,gy+6),
                   Tp(gx+gw-wingW-1.5,gy+gh-bodyD-2),Tp(gx+wingW+1.5,gy+gh-bodyD-2)],
                  fill=(112,160,86), outline=(96,140,72))
        # 顺时针马蹄形（开口朝北，翼端内收）
        gp=[(gx+ins,gy),(gx+ins+wingW,gy),(gx+wingW,gy+gh-bodyD),
            (gx+gw-wingW,gy+gh-bodyD),(gx+gw-ins-wingW,gy),(gx+gw-ins,gy),
            (gx+gw,gy+gh)]
        uu=[0,0,0,0,0,0, max(1,round(gh/2.5))]
        n=14
        for i in range(1,n+1):
            t=1-i/n
            gp.append((gx+gw*t, gy+gh+curv*math.sin(math.pi*t)))
            uu.append((max(1,round(gw/2.5/n))+1) if arc else 2)
        uu.append(0)  # 闭合边 SW→NW
        pts=[Tp(*p) for p in gp]
        extrude_poly(d, pts, h, st["wall"], floors=st["floors"],
                     edge_units=uu, glass=GLASS)
        # 中央高门廊（南弧中央，南北通透）
        if porch:
            pw=gw*0.22
            ppts=box_pts(gx+gw/2-pw/2, gy+gh-bodyD-0.4, pw, bodyD+curv+1.2)
            h2=FLOOR_H*(st["floors"]+1)
            extrude_poly(d, ppts, h2, (208,206,198), floors=st["floors"]+1,
                         edge_units=[1,1,1,1], glass=GLASS_L, parapet=False, lw=3)
        return roof_center(gx,gy,gw,gh,h)

    # ---------- 图书馆：红褐色横向百叶大方块 ----------
    def draw_lib(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        pts=box_pts(gx,gy,gw,gh)
        ground_shadow(pts)
        top=extrude_poly(d, pts, h, st["wall"], floors=st["floors"],
                         edge_units=units_for(gw,gh), glass=GLASS,
                         roof_facilities=False, parapet=False)
        SE=pts[2]; SW=pts[3]; NE=pts[1]
        for f in range(st["floors"]):
            v=(f+0.5)/st["floors"]
            d.line([(SE[0],SE[1]-h*v),(SW[0],SW[1]-h*v)], fill=(206,152,120), width=2)
            d.line([(NE[0],NE[1]-h*v),(SE[0],SE[1]-h*v)], fill=(192,140,112), width=2)
        d.polygon(top, fill=add(st["wall"],18), outline=INK)
        cx=sum(p[0] for p in top)/4; cy=sum(p[1] for p in top)/4
        inner=[(cx+(x-cx)*0.86,cy+(y-cy)*0.86) for x,y in top]
        d.polygon(inner, fill=(150,146,138), outline=shade((150,146,138),0.8))
        return roof_center(gx,gy,gw,gh,h)

    # ---------- 图书馆（L形：主体大方块 + 东侧竖向百叶塔楼）----------
    def draw_libL(b, st):
        gp=b["gpoly"]; h=FLOOR_H*st["floors"]
        # 主体大方块 + 东侧竖向塔楼（北半部相连，L 形）
        main_g=[(gp[0][0],gp[0][1]),(gp[6][0],gp[0][1]),
                (gp[6][0],gp[7][1]),(gp[0][0],gp[7][1])]
        tower_g=[(gp[1][0],gp[2][1]),(gp[3][0],gp[3][1]),
                 (gp[4][0],gp[4][1]),(gp[1][0],gp[4][1])]
        main=[Tp(x,y) for x,y in main_g]
        tower=[Tp(x,y) for x,y in tower_g]
        def uun(pts):
            return [max(1,round(math.hypot(B[0]-A[0],B[1]-A[1])/16))
                    for A,B in zip(pts,pts[1:]+[pts[0]])]
        # ---- 主体 ----
        ground_shadow(main)
        top=extrude_poly(d, main, h, st["wall"], floors=st["floors"],
                         edge_units=uun(main), glass=GLASS,
                         roof_facilities=False, parapet=False)
        # 水平陶土百叶条带（每层一条明线）
        for i in range(len(main)):
            A=main[i]; B=main[(i+1)%len(main)]
            if B[0]-A[0] < -0.5:
                for f in range(1,st["floors"]):
                    v=f/st["floors"]
                    d.line([(A[0],A[1]-h*v),(B[0],B[1]-h*v)], fill=(216,152,118), width=2)
        d.polygon(top, fill=add(st["wall"],18), outline=INK)
        cx=sum(p[0] for p in top)/len(top); cy=sum(p[1] for p in top)/len(top)
        inner=[(cx+(x-cx)*0.86,cy+(y-cy)*0.86) for x,y in top]
        d.polygon(inner, fill=(150,146,138), outline=shade((150,146,138),0.82))
        # ---- 东侧塔楼（高出约 1.6 层，深色玻璃 + 竖向百叶）----
        ht=h+FLOOR_H*1.6
        topT=extrude_poly(d, tower, ht, add(st["wall"],8), floors=st["floors"]+1,
                          edge_units=uun(tower), glass=GLASS_DK,
                          roof_facilities=False, parapet=True)
        for i in range(len(tower)):
            A=tower[i]; B=tower[(i+1)%len(tower)]
            if B[0]-A[0] < -0.5:
                steps=max(3,round(math.hypot(B[0]-A[0],B[1]-A[1])/9))
                for k in range(1,steps):
                    u=k/steps
                    P=(A[0]+(B[0]-A[0])*u, A[1]+(B[1]-A[1])*u)
                    d.line([(P[0],P[1]-ht*0.06),(P[0],P[1]-ht*0.94)],
                           fill=add(st["wall"],34), width=1)
        return (cx,cy-h)

    # ---------- 一教：弯月双弧翼 + 中央通透大拱门（凸朝南）----------
    def draw_crescent(b, st):
        # 一教（据官网航拍/廊桥照片+官方平面）：凸面朝南的弯月，中央南北向通道
        # 把它切成 A(西)、B(东) 两座弧形翼；通道上方由两个一字型廊桥连接——
        # 北端为架空玻璃连廊（X桁架），南端为高出的门形廊桥（白顶盖+格栅+玻璃层）。
        # 几何用官方平面 px（x=东 y=南）。
        h=FLOOR_H*st["floors"]
        def P(x,y): return Tp(C.px2gx(x), C.px2gy(y))
        # 中央缺口通道：x354-369（南北向，南开口）
        GAP_L,GAP_R=354,369
        # A座（西弧翼）、B座（东弧翼），外轮廓取自官方平面颜色分割
        W_A=[(354,648),(318,647),(306,658),(308,664),(321,678),(326,679),(333,685),(354,690)]
        W_B=[(369,648),(409,652),(416,661),(424,661),(424,672),(416,672),(409,679),
             (395,687),(378,691),(369,690)]
        # 两翼内院（弯月楼带围合的内庭院，轮廓取自颜色分割）
        Y_A=[(318,656),(319,663),(331,673),(339,677),(347,676),(346,657)]
        Y_B=[(377,678),(387,679),(393,677),(405,669),(407,661),(380,660),(377,670)]
        # 中央通道 + 两翼内院地面铺装（先于楼体画在地面，浅色庭院）
        d.polygon([P(353,646),P(370,646),P(370,696),P(353,696)],
                  fill=(206,196,176), outline=(178,168,148))
        for ypts in (Y_A,Y_B):
            d.polygon([P(x,y) for x,y in ypts], fill=(200,194,178), outline=(182,174,156))
        # 挤出 A/B 两座弧翼
        for pts in (W_A,W_B):
            q=as_cw([P(x,y) for x,y in pts])
            extrude_poly(d, q, h, st["wall"], floors=st["floors"],
                         edge_units=edge_units_of(q), glass=GLASS, roof_facilities=False)
        # 屋顶上画出内院（浅白采光/庭院下沉区 + 深色内侧墙），形成环形楼带
        for ypts in (Y_A,Y_B):
            q=[P(x,y) for x,y in ypts]
            top=[(x,y-h) for x,y in q]
            d.polygon(top, fill=(216,216,208), outline=(112,108,100))
        # 北廊桥：架空玻璃连廊（缺口北端，X桁架通透，下部架空）
        nbr=[P(354,646),P(369,646),P(369,659),P(354,659)]
        extrude_poly(d,nbr,h*0.44,(150,186,202),floors=2,edge_units=[1,1,1,1],
                     glass=GLASS_L,parapet=False,lw=2,z_base=h*0.40,
                     roof=(186,210,220),roof_facilities=False)
        # 南廊桥：高大门楼（南开口）——通透玻璃层 + 高出两翼的白色实体顶盖
        sbr=[P(352,678),P(371,678),P(371,691),P(352,691)]
        # 下部玻璃层（约3-4层，门洞上方通透）
        extrude_poly(d,sbr,h*0.32,(150,186,202),floors=1,edge_units=[1,1,1,1],
                     glass=GLASS_L,parapet=False,lw=2,z_base=h*0.54,
                     roof=(186,210,220),roof_facilities=False)
        # 白色实体顶盖（格栅门楼，明显高出两翼屋顶）
        extrude_poly(d,sbr,h*0.28,(226,224,218),floors=1,edge_units=[1,1,1,1],
                     glass=None,parapet=True,lw=3,z_base=h*0.90,
                     roof=(228,228,222),roof_facilities=False)
        # 北环路南侧、一教北缘外的低矮小横杠（官方图黑箭头所指的小矩形附楼）
        bx0,by0,bwp,bdp=347,618,26,16
        bar=[P(bx0,by0),P(bx0+bwp,by0),P(bx0+bwp,by0+bdp),P(bx0,by0+bdp)]
        ground_shadow(bar)
        bh=h*0.52
        extrude_poly(d, bar, bh, add(st["wall"],12), floors=3,
                     edge_units=[2,2,2,2], glass=GLASS, parapet=True, lw=2,
                     roof_facilities=False)
        d.polygon([(x,y-bh) for x,y in bar], fill=(188,214,232),outline=GLASS_DK)
        c=iso(C.px2gx(365), C.px2gy(668))
        return (c[0]+OX,c[1]+OY-h)

    # ---------- 体育馆：旋转胶囊（圆角矩形大跨）+ 平顶红墙 ----------
    def draw_capsule(b, st):
        # 直接在屏幕坐标构造竖直长胶囊（补偿 2:1 等距畸变），长轴沿东南=屏幕竖直
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        c=iso(gx+gw/2,gy+gh/2); ccx=c[0]+OX; ccy=c[1]+OY
        sA=(gw+gh)*4.8          # 长半轴（屏幕竖直）
        sB=sA*0.50              # 短半轴（屏幕水平）
        rotS=-0.06              # 屏幕旋转（长轴略偏，对应官方 35° 斜向）
        N=64
        Lv=(sA*math.sin(rotS), sA*math.cos(rotS))           # 长轴（屏幕下）
        Sv=(sB*math.cos(rotS), -sB*math.sin(rotS))          # 短轴（屏幕右）
        def cpts(scale=1.0,up=0.0):
            la=(Lv[0]*scale,Lv[1]*scale); sa=(Sv[0]*scale,Sv[1]*scale)
            return [(ccx+math.cos(t)*la[0]+math.sin(t)*sa[0],
                     ccy+math.cos(t)*la[1]+math.sin(t)*sa[1]-up)
                    for t in [2*math.pi*i/N for i in range(N+1)]]
        base=cpts(1.0)
        ground_shadow(base)
        # 南半弧红墙：t 从 π/2（最东）经 0（最南）到 -π/2（最西），屏幕 x 递减
        ts=[math.pi/2-math.pi*i/N for i in range(N+1)]
        def pt(t,scale=1.0,up=0.0):
            la=(Lv[0]*scale,Lv[1]*scale); sa=(Sv[0]*scale,Sv[1]*scale)
            return (ccx+math.cos(t)*la[0]+math.sin(t)*sa[0],
                    ccy+math.cos(t)*la[1]+math.sin(t)*sa[1]-up)
        for i in range(N):
            A=pt(ts[i]); B=pt(ts[i+1])
            ey=B[1]-A[1]
            face=shade((156,66,50),0.60) if ey>0 else shade((156,66,50),0.86)
            d.polygon([A,B,(B[0],B[1]-h),(A[0],A[1]-h)],fill=face,outline=INK)
        # 南弧正面蓝色玻璃大立面（t∈[-0.95,0.95]，最南弧宽段）
        gb=[pt(t) for t in [0.95-1.9*i/28 for i in range(29)]]
        gt=[(x,y-h*0.86) for x,y in gb]
        gb2=[(x,y-h*0.08) for x,y in gb]
        d.polygon(gb2+gt[::-1],fill=(92,148,182),outline=GLASS_DK)
        for i in range(2,28,3):
            x,y=gb[i]; d.line([(x,y-h*0.08),(x,y-h*0.86)],fill=add(GLASS_L,14),width=2)
        d.line([(gb[0][0],gb[0][1]-h*0.86),(gb[-1][0],gb[-1][1]-h*0.86)],fill=GLASS_DK,width=2)
        # 灰色大挑檐平顶（微外扩）+ 内圈
        roof=cpts(1.05,h)
        d.polygon(roof,fill=(158,164,172),outline=INK)
        rin=cpts(0.78,h)
        d.polygon(rin,fill=(120,128,138),outline=shade((120,128,138),0.8))
        # 屋面采光带（沿长轴）
        pN=pt(math.pi,1.0,h); pS=pt(0,1.0,h)
        d.line([pN,pS],fill=(92,100,110),width=4)
        return (ccx,ccy-h)

    # ---------- 体育馆：扁圆角矩形大跨（世界坐标斜椭圆，长轴东偏北）----------
    def draw_gymbox(b, st):
        # 跑道形（圆角矩形）大跨体育馆：红砖方柱 + 朝东南蓝玻璃大立面 + 灰大挑檐
        pcx,pcy,prx,pry=b["ellipse"]; rot=b.get("rot",0.0)
        rx=prx; ry=pry
        rect=rx-ry
        NS=18; NC=14
        def spt(a,bb,up=0.0):
            px=pcx+a*math.cos(rot)-bb*math.sin(rot)
            py=pcy+a*math.sin(rot)+bb*math.cos(rot)
            x,y=Tp(C.px2gx(px),C.px2gy(py))
            return (x,y-up)
        RC=8   # 四角圆角半径（像素）
        def stadium(scale=1.0,up=0.0):
            Rxx=rx*scale; Ryy=ry*scale; rc=RC*scale
            pts=[]
            for i in range(NS+1):                                   # 西北长边
                aa=-Rxx+rc+2*(Rxx-rc)*i/NS; pts.append(spt(aa,-Ryy,up))
            for i in range(1,NC+1):                                # 东北角
                th=-math.pi/2+math.pi/2*i/NC
                pts.append(spt(Rxx-rc+rc*math.cos(th), -Ryy+rc+rc*math.sin(th),up))
            for i in range(1,NS+1):                                # 东南短边（端）
                bb=-Ryy+rc+2*(Ryy-rc)*i/NS; pts.append(spt(Rxx,bb,up))
            for i in range(1,NC+1):                                # 东南角
                th=math.pi/2*i/NC
                pts.append(spt(Rxx-rc+rc*math.cos(th), Ryy-rc+rc*math.sin(th),up))
            for i in range(1,NS+1):                                # 东南长边
                aa=Rxx-rc-2*(Rxx-rc)*i/NS; pts.append(spt(aa,Ryy,up))
            for i in range(1,NC+1):                                # 西南角
                th=math.pi/2+math.pi/2*i/NC
                pts.append(spt(-Rxx+rc+rc*math.cos(th), Ryy-rc+rc*math.sin(th),up))
            for i in range(1,NS+1):                                # 西北短边（端）
                bb=Ryy-rc-2*(Ryy-rc)*i/NS; pts.append(spt(-Rxx,bb,up))
            for i in range(1,NC+1):                                # 西北角
                th=math.pi+math.pi/2*i/NC
                pts.append(spt(-Rxx+rc+rc*math.cos(th), -Ryy+rc+rc*math.sin(th),up))
            return pts
        base=stadium(1.0)
        ground_shadow(base)
        h=FLOOR_H*7.0; wall=st["wall"]
        n=len(base)
        # 红砖墙（所有可见立面，端部圆角+西北长边）
        for i in range(n):
            A=base[i]; B=base[(i+1)%n]
            if B[0]-A[0] < -0.5:
                ey=B[1]-A[1]
                face=shade(wall,0.60) if ey>0 else shade(wall,0.84)
                d.polygon([A,B,(B[0],B[1]-h),(A[0],A[1]-h)],fill=face,outline=INK)
                d.line([A,(A[0],A[1]-h)],fill=INK,width=2)
        # 朝东南长边：整面蓝玻璃幕墙（大跨）
        hl=rx-RC
        glb=[spt(hl-2*hl*i/NS, ry) for i in range(NS+1)]
        gb=[(x,y-h*0.03) for x,y in glb]
        gt=[(x,y-h*0.94) for x,y in glb]
        d.polygon(gb+gt[::-1],fill=(92,148,184),outline=GLASS_DK)
        for i in range(1,len(glb),2):
            x,y=glb[i]; d.line([(x,y-h*0.03),(x,y-h*0.94)],fill=add(GLASS_L,10),width=2)
        d.line(gt,fill=GLASS_DK,width=2)
        # 灰大挑檐平顶（外扩一圈）
        roof=stadium(1.15,h)
        d.polygon(roof,fill=(150,156,164),outline=INK)
        inner=stadium(0.84,h+2)
        d.polygon(inner,fill=(188,192,198),outline=(126,132,140))
        p1=spt(hl*0.74,0,h+3); p2=spt(-hl*0.74,0,h+3)
        d.line([p1,p2],fill=(108,116,126),width=6)
        d.line([p1,p2],fill=(198,202,207),width=2)
        d.line(roof+[roof[0]],fill=INK,width=3)
        c=iso(C.px2gx(pcx),C.px2gy(pcy))
        return (c[0]+OX,c[1]+OY-h)

    # ---------- 大学生活动中心：白色波浪曲面 ----------
    def draw_wave(b, st):
        gx,gy,gw,gh=b["grid"]; h=FLOOR_H*st["floors"]
        h0=h*0.80
        x0=gx+gw*0.30                # 大主体西界；西侧 30% 为独立小三角楔块
        gw2=gw*0.70
        # --- 西侧小三角楔块（官方图『左小三角+右大主体』之小楔）---
        tri=[Tp(gx,gy+gh*0.30),Tp(x0,gy+gh*0.06),Tp(x0,gy+gh*0.82),
             Tp(gx+gw*0.02,gy+gh*0.66)]
        ground_shadow(tri)
        htri=h*0.70
        extrude_poly(d, tri, htri, shade(st["wall"],0.98), floors=st["floors"],
                     edge_units=[2,3,3,2], glass=GLASS, roof_facilities=False)
        d.polygon([tri[0],tri[1],tri[2]], fill=(182,208,224), outline=GLASS_DK)
        # --- 东侧大主体（不规则楔 + 波浪屋顶）---
        base=[Tp(x0,gy+gh*0.12),Tp(x0+gw2*0.6,gy),Tp(x0+gw2,gy+gh*0.30),
              Tp(x0+gw2,gy+gh),Tp(x0+gw2*0.16,gy+gh)]
        ground_shadow(base)
        # 波浪幅度（沿长轴，约2个波峰，非负）
        def At(t): return h*0.66*math.sin(math.pi*1.9*t)**2
        def X(t): return x0+gw2*t
        def roof_pt(t,s):
            x=X(t); y=gy+gh*(0.10+0.90*s)
            p=Tp(x,y); z=h0+At(t)*(0.60+0.40*s)
            return (p[0],p[1]-z)
        steps=30
        # 山墙（东西两端封口）
        for t in (0.0,1.0):
            p0=Tp(X(t),gy+gh*0.10); p1=Tp(X(t),gy+gh)
            d.polygon([p0,p1,roof_pt(t,1),roof_pt(t,0)], fill=shade(st["wall"],0.78), outline=INK)
        # 南墙：波浪顶
        def sg(t): return Tp(X(t),gy+gh)
        south=[roof_pt(i/steps,1) for i in range(steps+1)]
        south_g=[sg(i/steps) for i in range(steps+1)]
        d.polygon(list(south_g)+list(reversed(south)), fill=shade(st["wall"],0.90), outline=INK)
        # 南墙玻璃入口（中央，波浪顶）
        tg0,tg1=0.34,0.66
        ib=[k for k in range(steps+1) if tg0<=k/steps<=tg1]
        gl_g=[sg(k/steps) for k in ib]
        gl_t=[]
        for k in ib:
            t=k/steps; gg=sg(t); rr=roof_pt(t,1)
            gl_t.append((gg[0],gg[1]+(rr[1]-gg[1])*0.62))
        d.polygon(gl_g+list(reversed(gl_t)), fill=(112,154,180), outline=GLASS_DK)
        for k in ib[1::2]:
            gg=sg(k/steps); rr=roof_pt(k/steps,1)
            d.line([(gg[0],gg[1]),(gg[0],gg[1]+(rr[1]-gg[1])*0.62)], fill=add(GLASS_L,10), width=2)
        # 南墙穿孔竖纹（入口两侧）
        for i in range(1,steps):
            t=i/steps
            if tg0<t<tg1: continue
            pg=sg(t); pr=roof_pt(t,1)
            d.line([(pg[0],pg[1]-h0*0.08),(pr[0],pr[1]+2)], fill=(186,184,176), width=1)
        # 屋面分条（按波峰高度连续明暗）
        cval,cpeak=(204,202,196),(253,251,246)
        for i in range(steps):
            t0=i/steps; t1=(i+1)/steps
            quad=[roof_pt(t0,0),roof_pt(t1,0),roof_pt(t1,1),roof_pt(t0,1)]
            ratio=max(0.0,min(1.0,(At(t0)+At(t1))/2/(h*0.58)))
            col=tuple(int(cval[k]+(cpeak[k]-cval[k])*ratio) for k in range(3))
            d.polygon(quad, fill=col, outline=shade(col,0.92))
        # 波峰脊线（亮白）
        for k in range(2):
            tcr=0.0+(k+1)/1.9
            pts=[]
            for s in range(11):
                pts.append(roof_pt(tcr,s/10))
            d.line(pts, fill=(255,255,252), width=3)
        # 南缘、北缘波浪轮廓
        for s in (0.0,1.0):
            line=[roof_pt(i/steps,s) for i in range(steps+1)]
            d.line(line, fill=INK, width=2)
        c=iso(gx+gw*0.62,gy+gh/2)
        return (c[0]+OX,c[1]+OY-h0-h*0.5)

    # ---------- 体育馆：矩形大跨（红墙+蓝玻璃+大挑檐平顶）----------
    def draw_gym(b, st):
        gp=b["gpoly"]; h=FLOOR_H*st["floors"]
        pts=[Tp(x,y) for x,y in gp]
        ground_shadow(pts)
        n=len(pts)
        # 1) 红褐色墙身
        for i in range(n):
            A=pts[i]; B=pts[(i+1)%n]
            if B[0]-A[0] < -0.5:
                d.polygon([A,B,(B[0],B[1]-h),(A[0],A[1]-h)],
                          fill=(156,66,50), outline=INK)
        cx=sum(p[0] for p in pts)/n; cy=sum(p[1] for p in pts)/n
        # 2) 蓝色玻璃大立面（南/东可见墙中央，两侧与上部留红墙）
        for i in range(n):
            A=pts[i]; B=pts[(i+1)%n]
            if B[0]-A[0] < -0.5:
                def P(u,v): return (A[0]+(B[0]-A[0])*u, A[1]+(B[1]-A[1])*u-v*h)
                d.polygon([P(0.12,0.20),P(0.88,0.20),P(0.88,0.68),P(0.12,0.68)],
                          fill=(92,146,180), outline=shade(GLASS_DK,0.8))
                for k in (1,2,3):
                    d.line([P(0.12+0.76*k/4,0.20),P(0.12+0.76*k/4,0.68)],
                           fill=add(GLASS_L,12), width=2)
                d.line([P(0.12,0.44),P(0.88,0.44)], fill=add(GLASS_L,6), width=1)
        # 3) 灰色大挑檐平屋顶（轻微外扩）
        roof=[(cx+(x-cx)*1.035, cy+(y-cy)*1.035-h) for x,y in pts]
        d.polygon(roof, fill=(156,162,170), outline=INK)
        rin=[(cx+(x-cx)*0.82, cy+(y-cy)*0.82) for x,y in roof]
        d.polygon(rin, fill=(122,130,140), outline=shade((122,130,140),0.8))
        # 屋面分格
        d.line([rin[0],rin[2]], fill=shade((122,130,140),0.7), width=1)
        d.line([rin[1],rin[3]], fill=shade((122,130,140),0.78), width=1)
        d.line(roof+[roof[0]], fill=(96,102,110), width=2)
        return (cx,cy-h)

    # ---------- 通用：倾斜矩形（泰瑞楼，poly 平面）----------
    def draw_polyblock(b, st):
        gp=b["gpoly"]; h=FLOOR_H*st["floors"]
        pts=as_cw([Tp(x,y) for x,y in gp])
        n=len(pts); uu=edge_units_of(pts)
        extrude_poly(d, pts, h, st["wall"], floors=st["floors"],
                     edge_units=uu, glass=GLASS, roof_facilities=False)
        # 东侧竖向百叶附楼（图书馆），略高、深色玻璃
        if b.get("annex"):
            ap_=as_cw([Tp(C.px2gx(x),C.px2gy(y)) for x,y in b["annex"]])
            m=len(ap_); uu2=edge_units_of(ap_)
            extrude_poly(d, ap_, h*1.03, add(st["wall"],-16), floors=st["floors"],
                         edge_units=uu2, glass=GLASS_DK, roof_facilities=False)
        # 屋顶玻璃天井/内院
        if b.get("patio"):
            pp=[Tp(C.px2gx(x),C.px2gy(y)) for x,y in b["patio"]]
            d.polygon([(x,y-h) for x,y in pp], fill=(150,178,188), outline=GLASS_DK)
        cx=sum(p[0] for p in pts)/n; cy=sum(p[1] for p in pts)/n
        return (cx,cy-h)

    # ---------- 大学生活动中心：西三角楔块 + 东不规则主体 ----------
    def draw_act(b, st):
        h=FLOOR_H*st["floors"]
        def P(x,y): return Tp(C.px2gx(x),C.px2gy(y))
        W_TRI=[(229,404),(249,404),(254,410),(241,431)]
        W_MAIN=[(254,410),(259,407),(261,401),(279,396),(284,422),(277,431),(252,427)]
        for pts in (W_TRI,W_MAIN):
            q=[P(x,y) for x,y in pts]
            m=len(q)
            uu=[max(1,round(math.hypot(q[(i+1)%m][0]-q[i][0],
                q[(i+1)%m][1]-q[i][1])/16)) for i in range(m)]
            extrude_poly(d,q,h,st["wall"],floors=st["floors"],
                         edge_units=uu,glass=GLASS_L,roof_facilities=False)
        c=iso(C.px2gx(257),C.px2gy(416))
        return (c[0]+OX,c[1]+OY-h)

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
        bld=b
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
        blue = bld.get("field") == "blue"
        if blue:
            # 风雨操场（西田径场）：暖橙跑道 + 北/西侧蓝色看台
            efill(1.0,1.0,(108,82,40))
            efill(0.975,0.975,(246,244,236))
            for fa,col in [(0.965,(216,152,70)),(0.915,(222,160,76)),
                           (0.865,(228,168,82)),(0.815,(232,174,88)),(0.765,(236,180,94))]:
                efill(fa,fa,col)
            efill(0.745,0.745,(246,244,236))
        else:
            # 北操场（东田径场）：红色塑胶跑道
            efill(1.0,1.0,(118,50,42))
            efill(0.975,0.975,(246,244,236))
            for fa,col in [(0.965,(190,74,50)),(0.915,(196,80,54)),
                           (0.865,(200,86,58)),(0.815,(204,92,62)),(0.765,(208,98,66))]:
                efill(fa,fa,col)
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
        # 风雨操场：东侧篮球场（蓝方块 2×3）+ 排球场（黄方块 1×4）
        if blue:
            pcx,pcy,prx,pry=bld["ellipse"]
            def court(bx,by,cw,ch,fill,ec):
                gx0=C.px2gx(bx); gy0=C.px2gy(by)
                gx1=C.px2gx(bx+cw); gy1=C.px2gy(by+ch)
                d.polygon([Tp(gx0,gy0),Tp(gx1,gy0),Tp(gx1,gy1),Tp(gx0,gy1)],
                          fill=fill,outline=ec)
            # 篮球场：2列×4行（蓝）
            bcw,bch,bg=8,13,2.5; bx0=pcx+44; by0=pcy-28
            for col in range(2):
                for row in range(4):
                    court(bx0+col*(bcw+bg), by0+row*(bch+bg), bcw,bch,
                          (86,158,202),(46,92,126))
            # 排球场：1列×5行（黄）
            vcw,vch,vg=16,13,3; vx0=pcx+70; vy0=pcy-30
            for row in range(5):
                court(vx0, vy0+row*(vch+vg), vcw,vch,
                      (234,186,102),(180,132,64))
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
        elif kind=="crescent":
            ctr=draw_crescent(b,st)
        elif kind=="capsule":
            ctr=draw_capsule(b,st)
        elif kind=="gymbox":
            ctr=draw_gymbox(b,st)
        elif kind=="libL":
            ctr=draw_libL(b,st)
        elif kind=="u":
            ctr=draw_u(b,st)
        elif kind=="lib":
            ctr=draw_lib(b,st)
        elif kind=="wave":
            ctr=draw_wave(b,st)
        elif kind=="act":
            ctr=draw_act(b,st)
        elif kind=="gym":
            ctr=draw_gym(b,st)
        elif kind=="polyblock":
            ctr=draw_polyblock(b,st)
        elif kind=="cupola":
            ctr=draw_cupola(b,st)
        elif kind=="gate":
            ctr=draw_gate(b,st)
        else:
            ctr=draw_block(b,st)
        centers[b["id"]]=(ctr,b)

    # ---------- 编号 + 名称（在建筑之上）----------
    for bid,(ctr,b) in centers.items() if globals().get("DRAW_LABELS", True) else ():
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
    dl.text((40,30),"北京化工大学昌平校区 · 2.5D等距数字校园 · 楼宇框架（v3.8 手绘确认轮廓·审批稿）",fill=(28,42,52),font=ftitle)
    dl.text((42,82),"按官方平面图与墨蓝手绘轮廓及官网实景照片校准（一教弯月双弧拱门+北侧小横杠·体育馆跑道形大跨灰挑檐·两操场椭圆田径场·玉屏双峰高镜亭+环山步道·文理楼E形·图书馆L形·二教锯齿·紫竹竖长·活动中心两块）；共 %d 个建筑/场地对象，后续各建筑替换为像素风插图。"%len(recs),
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

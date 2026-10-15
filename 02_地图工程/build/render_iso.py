# -*- coding: utf-8 -*-
"""
等距(2.5D)楼宇框架渲染器 —— 审批用
读取 campus_data，渲染等距视角全校布局：地形/水系/山体/道路/场地/立体建筑/编号/图例。
"""
import os, math
from PIL import Image, ImageDraw, ImageFont
import campus_data as C

OUT = os.path.join(os.path.dirname(__file__), "..", "check")
os.makedirs(OUT, exist_ok=True)

TW, TH = 44, 22
FLOOR_H = 13
BG = (236, 240, 244)

def hex2rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def shade(c, k): return tuple(max(0,min(255,int(v*k))) for v in c)
def add(c, d): return tuple(max(0,min(255,v+d)) for v in c)

def font(sz):
    for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

LANDMARK = {  # 直接标注中文名称的主要地标
    "LIB": "图书馆", "TEACH-1": "第一教学楼", "TEACH-2": "第二教学楼",
    "MUSEUM-HISTORY": "校史馆", "ACT": "大学生活动中心",
    "GYM": "体育馆", "FIELD-SW": "操场",
    "CAN-ZIZHU": "紫竹餐厅", "SVC-LOGI": "后勤服务楼",
    "ENG-TRAIN": "泰瑞楼", "GATE-S": "南门(正门)", "GATE-E": "东门",
    "GATE-W": "西门",
}

def iso(gx, gy): return ((gx-gy)*TW/2.0, (gx+gy)*TH/2.0)

def iso_bounds():
    xs=[]; ys=[]
    for gx in [C.GX0, C.GX1]:
        for gy in [C.GY0, C.GY1]:
            x,y=iso(gx,gy); xs.append(x); ys.append(y)
    return min(xs),min(ys),max(xs),max(ys)

def box_corners(gx,gy,w,d):
    return [iso(gx,gy),iso(gx+w,gy),iso(gx+w,gy+d),iso(gx,gy+d)]

def render():
    minx,miny,maxx,maxy = iso_bounds()
    M_L, M_R, M_T, M_B = 280, 120, 210, 150
    W = int((maxx-minx)+M_L+M_R); H=int((maxy-miny)+M_T+M_B)
    OX, OY = -minx+M_L, -miny+M_T
    img = Image.new("RGB",(W,H),BG)
    layer = Image.new("RGBA",(W,H),(0,0,0,0))
    d = ImageDraw.Draw(layer)
    def T(x,y): return (x+OX, y+OY)

    # 校园底盘
    ground = [T(*iso(C.GX0,C.GY0)), T(*iso(C.GX1,C.GY0)),
              T(*iso(C.GX1,C.GY1)), T(*iso(C.GX0,C.GY1))]
    d.polygon(ground, fill=(206,224,186))
    for gx in range(int(C.GX0), int(C.GX1), 2):
        for gy in range(int(C.GY0), int(C.GY1), 2):
            if (gx+gy)%4==0:
                c=box_corners(gx,gy,2,2); d.polygon([T(*p) for p in c], fill=(199,219,178))

    # 自然
    for n in C.build_nature():
        col = hex2rgb(C.CATEGORIES[n["cat"]][1])
        if n["shape"]=="poly":
            pts=[T(*iso(x,y)) for x,y in n["gpoly"]]
        else:
            gx,gy,gw,gh=n["grid"]; pts=[T(*p) for p in box_corners(gx,gy,gw,gh)]
        if n["cat"]=="water":
            d.polygon(pts, fill=col, outline=shade(col,0.75))
            d.polygon([(x+1.5,y-3) for x,y in pts], fill=add(col,24))
        elif n["cat"]=="mountain":
            d.polygon(pts, fill=col, outline=shade(col,0.7))
            up=[(x,y-48) for x,y in pts]; d.polygon(up, fill=shade(col,1.08))
            d.line(up+[up[0]], fill=shade(col,0.7), width=2)
        else:
            d.polygon(pts, fill=col, outline=shade(col,0.82))

    # 景观渠
    canal=[T(*iso(C.px2gx(x),C.px2gy(y))) for x,y in C.CANAL]
    d.line(canal, fill=(95,170,120), width=11, joint="curve")
    d.line(canal, fill=(120,190,220), width=5, joint="curve")

    # 道路
    for r in C.build_roads():
        pts=[T(*iso(x,y)) for x,y in r["gpts"]]
        w=max(6, int(r["w"]*TH/2.4))
        d.line(pts, fill=(180,176,165), width=w+6, joint="curve")
        d.line(pts, fill=(236,233,224), width=w, joint="curve")
        d.line(pts, fill=(225,200,120), width=1, joint="curve")

    recs = C.numbered_buildings()

    # 场地
    for b in recs:
        if b["cat"] not in ("field","court","parking","plaza"): continue
        gx,gy,gw,gh=b["grid"]
        if b["shape"]=="ellipse":
            cx,cy=iso(gx+gw/2,gy+gh/2); rx=gw*TW/2/2; ry=gh*TH/2/2
            x0,y0=T(cx-rx,cy-ry); x1,y1=T(cx+rx,cy+ry)
            if b["cat"]=="field":
                d.ellipse([x0,y0,x1,y1],fill=(214,150,70))
                d.ellipse([T(cx-rx*0.82,cy-ry*0.82)[0],T(cx-rx*0.82,cy-ry*0.82)[1],
                           T(cx+rx*0.82,cy+ry*0.82)[0],T(cx+rx*0.82,cy+ry*0.82)[1]],fill=(90,150,72))
            else:
                d.ellipse([x0,y0,x1,y1],fill=hex2rgb(C.CATEGORIES[b["cat"]][1]),outline=(80,80,80),width=2)
            cxs,cys=cx+OX,cy+OY
        else:
            base=box_corners(gx,gy,gw,gh)
            col=hex2rgb(C.CATEGORIES[b["cat"]][1])
            d.polygon([T(*p) for p in base], fill=col, outline=shade(col,0.7))
            if b["cat"]=="court":
                for i in range(1,4):
                    t=i/4; a=iso(gx+gw*t,gy); bb=iso(gx+gw*t,gy+gh)
                    d.line([T(*a),T(*bb)],fill=(255,255,255),width=1)
            cxs=sum(p[0]+OX for p in base)/4; cys=sum(p[1]+OY for p in base)/4
        # 编号徽章
        num="%02d"%b["no"]; fn=font(15)
        tw=d.textlength(num,font=fn); bh=22
        bw=max(30,tw+14)
        d.rounded_rectangle([cxs-bw/2,cys-bh/2,cxs+bw/2,cys+bh/2],radius=6,
                            fill=(255,255,255,238),outline=(50,55,60),width=2)
        d.text((cxs-tw/2,cys-10),num,fill=(40,45,55),font=fn)
        if b["id"] in LANDMARK:
            nm=LANDMARK[b["id"]]; f2=font(16)
            tw2=d.textlength(nm,font=f2)
            d.rounded_rectangle([cxs-tw2/2-6,cys+bh/2+2,cxs+tw2/2+6,cys+bh/2+24],
                                radius=4,fill=(30,40,50,180))
            d.text((cxs-tw2/2,cys+bh/2+4),nm,fill=(255,255,255),font=f2)

    # 建筑（立体）
    def depth(b):
        gx,gy,gw,gh=b["grid"]; return (gx+gy+gh)
    blocks=[b for b in recs if b["cat"] not in ("field","court","parking","plaza")]
    for b in sorted(blocks,key=depth):
        gx,gy,gw,gh=b["grid"]
        col=hex2rgb(C.CATEGORIES[b["cat"]][1])
        h=FLOOR_H*max(1,b.get("floors",1))
        top=box_corners(gx,gy,gw,gh); Tp=[(x,y-h) for x,y in top]
        if b["shape"]=="ellipse":
            cx,cy=iso(gx+gw/2,gy+gh/2); rx=gw*TW/2/2; ry=gh*TH/2/2
            tx0,ty0=T(cx-rx,cy-h-ry); tx1,ty1=T(cx+rx,cy-h+ry)
            bx0,by0=T(cx-rx,cy-ry);   bx1,by1=T(cx+rx,cy+ry)
            mx0,my0=T(cx-rx,cy-h);    mx1,my1=T(cx+rx,cy)
            d.rectangle([mx0,my0,mx1,my1],fill=shade(col,0.8))
            d.ellipse([bx0,by0,bx1,by1],fill=shade(col,0.85),outline=shade(col,0.6),width=2)
            d.ellipse([tx0,ty0,tx1,ty1],fill=col,outline=shade(col,0.6),width=2)
            cxs,cys=cx+OX,cy-h+OY
        else:
            left=[T(*top[2]),T(*top[3]),T(*Tp[3]),T(*Tp[2])]
            right=[T(*top[1]),T(*top[2]),T(*Tp[2]),T(*Tp[1])]
            d.polygon(left,fill=shade(col,0.66),outline=shade(col,0.5))
            d.polygon(right,fill=shade(col,0.84),outline=shade(col,0.5))
            d.polygon([T(*p) for p in Tp],fill=add(col,12),outline=shade(col,0.55))
            imgpts=[T(*p) for p in Tp]
            cxs=sum(p[0] for p in imgpts)/4; cys=sum(p[1] for p in imgpts)/4
        if b["status"]=="building":
            d.line([T(*Tp[0]),T(*Tp[2])],fill=(255,255,255),width=3)
        # 编号徽章
        num="%02d"%b["no"]; fn=font(15)
        tw=d.textlength(num,font=fn); th=18
        bw=max(30,tw+14); bh=22
        d.rounded_rectangle([cxs-bw/2,cys-bh/2,cxs+bw/2,cys+bh/2],radius=6,
                            fill=(255,255,255,238),outline=(50,55,60),width=2)
        d.text((cxs-tw/2,cys-10),num,fill=(40,45,55),font=fn)
        # 主要地标中文名
        if b["id"] in LANDMARK:
            nm=LANDMARK[b["id"]]; f2=font(16)
            tw2=d.textlength(nm,font=f2)
            d.rounded_rectangle([cxs-tw2/2-6,cys+bh/2+2,cxs+tw2/2+6,cys+bh/2+24],
                                radius=4,fill=(30,40,50,180))
            d.text((cxs-tw2/2,cys+bh/2+4),nm,fill=(255,255,255),font=f2)

    # POI
    for p in C.build_pois():
        x,y=T(*iso(*p["grid"])); y-=10
        d.ellipse([x-5,y-5,x+5,y+5],fill=(241,196,15),outline=(140,90,0),width=2)

    img=Image.alpha_composite(img.convert("RGBA"),layer)
    dl=ImageDraw.Draw(img)
    ftitle=font(36); fsub=font(20); fleg=font(19); flegb=font(21)
    dl.text((40,30),"北京化工大学昌平校区 · 2.5D等距数字校园 · 楼宇框架（审批稿）",fill=(30,45,55),font=ftitle)
    dl.text((42,82),"色块为占位，按编号对照《建筑点位台账》核对名称/位置；后续将替换为像素风插图。共 %d 个建筑/场地对象。"%len(recs),
            fill=(90,100,110),font=fsub)

    # 自然地标名称（玉屏山 / 柳湖 / 南湖）
    for nm,(ngx,ngy,col) in {"玉屏山":(78,20,(240,255,240)),"柳湖":(70,100,(255,255,255)),
                             "南湖":(57,143,(255,255,255))}.items():
        x,y=T(*iso(ngx,ngy))
        f=font(20); tw=dl.textlength(nm,font=f)
        dl.rounded_rectangle([x-tw/2-8,y-15,x+tw/2+8,y+13],radius=6,fill=(20,40,30,150))
        dl.text((x-tw/2,y-13),nm,fill=col,font=f)

    # 图例
    lx,ly=40,H-480
    dl.rounded_rectangle([lx-14,ly-32,lx+250,ly+446],radius=12,fill=(255,255,255,238),outline=(200,205,210))
    dl.text((lx,ly-20),"图例 / 分类",fill=(25,35,45),font=flegb)
    items=[(k,zh,hex_) for k,(zh,hex_) in C.CATEGORIES.items()]
    for i,(k,zh,hex_) in enumerate(items):
        yy=ly+20+i*24
        dl.rectangle([lx,yy,lx+24,yy+19],fill=hex2rgb(hex_),outline=(80,80,80))
        dl.text((lx+32,yy),zh,fill=(30,30,30),font=fleg)
    yy=ly+20+len(items)*24+6
    dl.line([(lx,yy),(lx+232,yy)],fill=(220,220,220),width=2)
    dl.text((lx,yy+8),"白斜杠=在建；黄点=兴趣点",fill=(90,90,90),font=font(16))

    # 等距指北针（北指向屏幕右上）
    nx,ny=W-170,150
    angN=math.atan2(-TH,TW)
    dl.ellipse([nx-46,ny-46,nx+46,ny+46],fill=(255,255,255),outline=(180,185,190),width=2)
    for lab,ang,col in [("N",angN,(192,57,43)),("E",-angN,(90,100,110)),
                        ("S",angN+math.pi,(90,100,110)),("W",math.pi-angN,(90,100,110))]:
        ux=nx+math.cos(ang)*30; uy=ny+math.sin(ang)*30
        if lab=="N":
            tip=(nx+math.cos(ang)*40, ny+math.sin(ang)*40)
            b1=(nx+math.cos(ang+2.4)*12, ny+math.sin(ang+2.4)*12)
            b2=(nx+math.cos(ang-2.4)*12, ny+math.sin(ang-2.4)*12)
            dl.polygon([tip,b1,b2],fill=col)
        dl.text((ux-6,uy-10),lab,fill=(40,50,60),font=flegb)

    img.convert("RGB").save(os.path.join(OUT,"iso_framework.png"),quality=93)
    im=img.convert("RGB"); im.thumbnail((2200,2200)); im.save(os.path.join(OUT,"iso_framework_small.png"),quality=90)
    print("saved iso_framework.png", img.size)

render()

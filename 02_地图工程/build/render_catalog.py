# -*- coding: utf-8 -*-
"""阶段A交付：正交俯视编号图 + 官方图叠加编号图 + 建筑台账CSV。"""
import os, csv
from PIL import Image, ImageDraw, ImageFont
import campus_data as C

OUT = os.path.join(os.path.dirname(__file__), "..", "check")
os.makedirs(OUT, exist_ok=True)
MAPDIR = os.path.join(os.path.dirname(__file__), "..", "..", "01_资料与参考")
REF = os.path.join(MAPDIR, "official_map.jpg")

def hex2rgb(h):
    h=h.lstrip("#"); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def font(sz):
    for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p,sz)
            except Exception: pass
    return ImageFont.load_default()

recs=C.numbered_buildings()

# ===== 正交俯视编号图 =====
S=16; M=70
W=C.GW*S+M*2; H=C.GH*S+M*2
img=Image.new("RGB",(W,H),(226,236,220)); d=ImageDraw.Draw(img)
def g2px(gx,gy): return (M+gx*S, M+gy*S)
for x in range(0,C.GW+1,5):
    X0,_=g2px(x,0); d.line([(X0,M),(X0,M+C.GH*S)],fill=(210,222,205))
for y in range(0,C.GH+1,5):
    _,Y0=g2px(0,y); d.line([(M,Y0),(M+C.GW*S,Y0)],fill=(210,222,205))
# 自然
for n in C.build_nature():
    col=hex2rgb(C.CATEGORIES[n["cat"]][1])
    if n["shape"]=="poly":
        d.polygon([g2px(x,y) for x,y in n["gpoly"]],fill=col,outline=shade(col,0.7) if (shade:=lambda c,k:tuple(int(v*k) for v in c)) else None)
    else:
        gx,gy,gw,gh=n["grid"]; x0,y0=g2px(gx,gy); x1,y1=g2px(gx+gw,gy+gh)
        d.rectangle([x0,y0,x1,y1],fill=col,outline=(60,120,60))
# 道路
for r in C.build_roads():
    pts=[g2px(x,y) for x,y in r["gpts"]]
    d.line(pts,fill=(236,233,224),width=max(3,int(r["w"]*S/5)),joint="curve")
# 建筑
def badge(cx,cy,no,col):
    num="%02d"%no; fn=font(15); tw=d.textlength(num,font=fn)
    bw=max(30,tw+12); bh=22
    d.rounded_rectangle([cx-bw/2,cy-bh/2,cx+bw/2,cy+bh/2],radius=5,fill=(255,255,255),outline=(40,45,50),width=1)
    d.text((cx-tw/2,cy-9),num,fill=(35,40,45),font=fn)
for b in recs:
    gx,gy,gw,gh=b["grid"]; col=hex2rgb(C.CATEGORIES[b["cat"]][1])
    x0,y0=g2px(gx,gy); x1,y1=g2px(gx+gw,gy+gh)
    if b["shape"]=="ellipse":
        if b["cat"]=="field":
            # 田径场：橙色跑道 + 绿色草地
            d.ellipse([x0,y0,x1,y1],fill=(214,150,70),outline=(50,40,30),width=2)
            mxx,myy=(x1-x0)*0.10,(y1-y0)*0.10
            d.ellipse([x0+mxx,y0+myy,x1-mxx,y1-myy],fill=(90,150,72))
        else:
            d.ellipse([x0,y0,x1,y1],fill=col,outline=(50,40,30),width=2)
    else:
        d.rectangle([x0,y0,x1,y1],fill=col,outline=(50,40,30),width=2)
        if b["status"]=="building":
            d.line([x0,y1,x1,y0],fill=(255,255,255),width=2)
    badge((x0+x1)/2,(y0+y1)/2,b["no"],col)
# POI
for p in C.build_pois():
    x,y=g2px(*p["grid"]); d.ellipse([x-4,y-4,x+4,y+4],fill=(241,196,15),outline=(120,80,0))
d.text((20,18),"BUCT 昌平校区 · 正交俯视编号图（上北下南，用于核对布局）",fill=(30,40,30),font=font(22))
# 图例
lx,ly=20,H-400
d.text((lx,ly-26),"图例",fill=(20,20,20),font=font(20))
# 图例（仅显示当前数据实际使用的类别）
used=set(b["cat"] for b in recs) | set(n["cat"] for n in C.build_nature())
legend_items=[(k,v) for k,v in C.CATEGORIES.items() if k in used]
for i,(k,(zh,hex_)) in enumerate(legend_items):
    yy=ly+i*22; d.rectangle([lx,yy,lx+20,yy+17],fill=hex2rgb(hex_),outline=(50,50,50)); d.text((lx+26,yy+1),zh,fill=(20,20,20),font=font(16))
img.save(os.path.join(OUT,"ortho_numbered.png"))
im=img.copy(); im.thumbnail((1500,1900)); im.save(os.path.join(OUT,"ortho_numbered_small.png"))
print("saved ortho_numbered.png",img.size)

# ===== 官方图叠加编号 =====
ref=Image.open(REF).convert("RGBA"); ov=Image.new("RGBA",ref.size,(0,0,0,0)); od=ImageDraw.Draw(ov)
def g2ref(gx,gy):
    px=(gx-C.GX0)/(C.GX1-C.GX0)*(C.PX_X1-C.PX_X0)+C.PX_X0
    py=(gy-C.GY0)/(C.GY1-C.GY0)*(C.PX_Y1-C.PX_Y0)+C.PX_Y0
    return (px,py)
for n in C.build_nature():
    if n["shape"]=="poly":
        col=hex2rgb(C.CATEGORIES[n["cat"]][1])
        od.polygon([g2ref(x,y) for x,y in n["gpoly"]],fill=col+(60,),outline=col+(220,))
for b in recs:
    gx,gy,gw,gh=b["grid"]; col=hex2rgb(C.CATEGORIES[b["cat"]][1])
    x0,y0=g2ref(gx,gy); x1,y1=g2ref(gx+gw,gy+gh)
    if b["shape"]=="ellipse":
        fillcol=(214,150,70) if b["cat"]=="field" else col
        od.ellipse([x0,y0,x1,y1],fill=fillcol+(70,),outline=(255,0,0,255),width=2)
    else:
        od.rectangle([x0,y0,x1,y1],fill=col+(70,),outline=(255,0,0,255),width=2)
    num="%02d"%b["no"]; cx,cy=(x0+x1)/2,(y0+y1)/2
    fn=font(11); tw=od.textlength(num,font=fn)
    od.rounded_rectangle([cx-tw/2-3,cy-8,cx+tw/2+3,cy+8],radius=3,fill=(255,255,255,240),outline=(200,0,0))
    od.text((cx-tw/2,cy-7),num,fill=(200,0,0,255),font=fn)
Image.alpha_composite(ref,ov).convert("RGB").save(os.path.join(OUT,"overlay_numbered.png"))
print("saved overlay_numbered.png")

# ===== 台账 CSV =====
cat_zh={k:v[0] for k,v in C.CATEGORIES.items()}
csv_path=os.path.join(OUT,"建筑点位台账.csv")
with open(csv_path,"w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f)
    w.writerow(["编号","ID","建筑名称","类别","状态","网格X","网格Y","宽(瓦片)","深(瓦片)","层数","形状","功能说明"])
    for b in recs:
        gx,gy,gw,gh=b["grid"]
        w.writerow(["%02d"%b["no"],b["id"],b["name"],cat_zh[b["cat"]],
                    {"built":"已建","building":"在建"}.get(b["status"],b["status"]),
                    gx,gy,gw,gh,b.get("floors",0),b["shape"],b["desc"]])
print("saved",csv_path)
# 自然与POI台账
with open(os.path.join(OUT,"自然与点位台账.csv"),"w",newline="",encoding="utf-8-sig") as f:
    w=csv.writer(f); w.writerow(["类型","名称","类别","网格X","网格Y"])
    for n in C.build_nature():
        gx,gy,*_=n["grid"]; w.writerow(["自然/区域",n["name"],cat_zh[n["cat"]],gx,gy])
    for p in C.build_pois():
        w.writerow(["兴趣点",p["name"],p["type"],p["grid"][0],p["grid"][1]])
print("saved nature/poi csv")

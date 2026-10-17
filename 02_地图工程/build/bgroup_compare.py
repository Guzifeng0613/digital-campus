# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont
import os
BASE="/home/user/Doubao/chats/38447367988429826/digital-campus"
S=BASE+"/02_地图工程/check/single"; P=BASE+"/01_资料与参考/官方照片"
def font(sz):
    for p in ["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"]:
        if os.path.exists(p):
            from PIL import ImageFont; return ImageFont.truetype(p,sz)
    return ImageFont.load_default()
rows=[
 ("GYM 体育馆（端部大玻璃+大台阶+长立面红柱蓝玻）", S+"/GYM.png", P+"/GYM/ref01_aerialoblique_iarch.jpg"),
 ("FIELD-W 风雨操场/西田径场（蓝跑道+双侧蓝看台+高杆灯）", S+"/FIELD-W.png", P+"/FIELD-W/ref02_oval_sohu.jpg"),
 ("FIELD-N 北操场/东田径场（跑道形+红跑道+高杆灯）", S+"/FIELD-N.png", P+"/FIELD-N/ref01_eastaerial_weixin.jpg"),
 ("ENG-TRAIN 泰瑞楼（红陶板实墙+中央通高玻璃中庭+横窗带）", S+"/ENG-TRAIN.png", P+"/ENG-TRAIN/ref02_render_weixin.jpg"),
]
def fit(im,w):
    return im.resize((w,int(im.height*w/im.width)), Image.LANCZOS)
W=820; pad=14; lab=46
cols=[]
for title,m,p in rows:
    im=fit(Image.open(m).convert("RGB"),W); ph=fit(Image.open(p).convert("RGB"),W)
    row=Image.new("RGB",(W*2+pad*3, im.height+ph.height+lab+pad*2),(245,246,242))
    dd=ImageDraw.Draw(row)
    dd.text((pad,8),title,fill=(20,28,40),font=font(30))
    row.paste(im,(pad,lab)); row.paste(ph,(W+pad*2,lab))
    dd.text((pad+6,lab+im.height-40),"新 2.5D 框架",fill=(255,255,255),font=font(26))
    dd.text((W+pad*2+6,lab+ph.height-40),"真实照片",fill=(255,255,255),font=font(26))
    cols.append(row)
TW=cols[0].width; TH=sum(c.height for c in cols)+pad
out=Image.new("RGB",(TW,TH),(228,230,224)); y=pad
for c in cols:
    out.paste(c,(0,y)); y+=c.height
out.save(BASE+"/02_地图工程/check/B组几何对比_框架vs照片.png")
print("saved",out.size)

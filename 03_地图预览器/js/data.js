// 自动生成：等距地图数据（地面底图 + 建筑放置/投影/信息）。按高德卫星图重标定（2026-10-19）。勿手改。
window.CAMPUS_DATA = {
 "meta": {
  "project": "北京化工大学昌平校区 · 等距像素数字校园",
  "ground": "img/ground.png",
  "groundSize": [
   9130,
   4705
  ],
  "diamond": [
   130.0,
   100.0,
   9000.4,
   4535.2
  ],
  "origin": [
   5964.4,
   -32.0
  ],
  "tile": [
   22.0,
   11.0
  ],
  "gridRange": [
   0.0,
   4.0,
   160.0,
   266.0
  ],
  "count": 16
 },
 "buildings": [
  {
   "id": "FIELD-W",
   "no": 1,
   "name": "风雨操场",
   "group": "sports",
   "cat": "field",
   "img": "img/sprites/FIELD-W.png",
   "grid": [
    12.6,
    201.3,
    28.0,
    28.0
   ],
   "bbox": [
    0,
    232,
    1599,
    1219
   ],
   "scale": 0.627117,
   "paste": [
    1389.9,
    1943.8
   ],
   "dw": 1002,
   "dh": 764,
   "foot": [
    1890.9,
    2457.1
   ],
   "depth": 226.28,
   "walkable": true,
   "desc": "校园西南侧西田径场（用户标注『风雨操场』），跑道形足球场+环形跑道（南北长轴），东侧篮球场/游泳馆，东邻南湖，东南邻体育馆。",
   "collider": [
    12.3,
    191.2,
    16.5,
    29.1
   ]
  },
  {
   "id": "GYM",
   "no": 2,
   "name": "体育馆",
   "group": "sports",
   "cat": "gym",
   "img": "img/sprites/GYM.png",
   "grid": [
    56.7,
    230.3,
    23.8,
    22.4
   ],
   "bbox": [
    44,
    248,
    1519,
    1119
   ],
   "scale": 0.568756,
   "paste": [
    1716.9,
    2799.5
   ],
   "dw": 863,
   "dh": 636,
   "foot": [
    2148.4,
    3219.5
   ],
   "depth": 295.6,
   "walkable": false,
   "desc": "主校门西北侧跑道形（圆角矩形）大跨综合体育馆，长轴东偏北约45°，灰色大挑檐平顶+红砖方柱+朝东南蓝玻璃幕墙，含篮球/羽毛球/游泳等14个训练馆。",
   "collider": [
    51.2,
    224.7,
    19.6,
    19.6
   ]
  },
  {
   "id": "TEACH-1",
   "no": 3,
   "name": "第一教学楼",
   "group": "teaching",
   "cat": "teaching",
   "img": "img/sprites/TEACH-1.png",
   "grid": [
    76.3,
    182.7,
    43.4,
    35.0
   ],
   "bbox": [
    20,
    192,
    1579,
    839
   ],
   "scale": 0.908423,
   "paste": [
    2392.5,
    2718.7
   ],
   "dw": 1434,
   "dh": 762,
   "foot": [
    3109.5,
    3122.1
   ],
   "depth": 286.74,
   "walkable": false,
   "desc": "开口朝南的马蹄形（U形）主教学楼：北侧中央为南北向玻璃主楼，东西两座弧形翼（A座西/B座东）由北连廊相接并向南围合出庭院；红褐色竖向格栅+白色平顶，130间智慧教室。",
   "collider": [
    56.3,
    197.8,
    44.3,
    20.9
   ]
  },
  {
   "id": "LAB-TECH",
   "no": 4,
   "name": "实验楼群",
   "group": "teaching",
   "cat": "lab",
   "img": "img/sprites/LAB-TECH.png",
   "grid": [
    95.9,
    168.7,
    33.6,
    29.4
   ],
   "bbox": [
    0,
    240,
    1599,
    1227
   ],
   "scale": 0.809969,
   "paste": [
    3596.8,
    2331.0
   ],
   "dw": 1295,
   "dh": 993,
   "foot": [
    4244.3,
    3000.2
   ],
   "depth": 275.65,
   "walkable": false,
   "desc": "实验群西翼（南北贯通两进院），红褐陶土下部+浅灰板带上部、密排竖窗，中段内凹Π形玻璃门厅，实景标牌『实验楼A』。",
   "collider": [
    86.4,
    159.8,
    24.7,
    34.2
   ]
  },
  {
   "id": "GATE-S",
   "no": 5,
   "name": "南门(主校门)",
   "group": "gate",
   "cat": "gate",
   "img": "img/sprites/GATE-S.png",
   "grid": [
    79.1,
    252.0,
    11.2,
    8.4
   ],
   "bbox": [
    64,
    536,
    1535,
    831
   ],
   "scale": 0.253967,
   "paste": [
    1814.3,
    3663.3
   ],
   "dw": 389,
   "dh": 211,
   "foot": [
    2008.8,
    3776.9
   ],
   "depth": 346.26,
   "walkable": false,
   "desc": "学校正门、敞开式无门楼，横卧校名石（红字）+石后旗杆+两侧灰色矮岗亭，中轴礼仪序列起点。",
   "collider": [
    76.9,
    260.5,
    12.7,
    5.1
   ]
  },
  {
   "id": "GATE-E",
   "no": 6,
   "name": "东门",
   "group": "gate",
   "cat": "gate",
   "img": "img/sprites/GATE-E.png",
   "grid": [
    149.8,
    154.7,
    6.3,
    7.7
   ],
   "bbox": [
    56,
    528,
    1491,
    859
   ],
   "scale": 0.158766,
   "paste": [
    4697.6,
    3034.8
   ],
   "dw": 236,
   "dh": 136,
   "foot": [
    4815.6,
    3111.6
   ],
   "depth": 285.78,
   "walkable": false,
   "desc": "校园东侧出入口，车辆主出入口，1层简易道闸门房，门内西侧机动车环岛。",
   "collider": [
    114.9,
    165.5,
    3.8,
    7.0
   ]
  },
  {
   "id": "LIB",
   "no": 7,
   "name": "图书馆",
   "group": "public",
   "cat": "library",
   "img": "img/sprites/LIB.png",
   "grid": [
    79.1,
    132.3,
    17.5,
    17.5
   ],
   "bbox": [
    0,
    272,
    1599,
    1275
   ],
   "scale": 0.431057,
   "paste": [
    4523.1,
    2082.1
   ],
   "dw": 689,
   "dh": 549,
   "foot": [
    4867.6,
    2458.8
   ],
   "depth": 226.44,
   "walkable": false,
   "desc": "约5万㎡，国家优质工程；连续折线单一体量（东侧百叶带与主体连体）+中央三角形玻璃采光中庭+弧形转角，红褐色横百叶+玻璃幕墙，临柳湖。",
   "collider": [
    79.4,
    131.3,
    17.7,
    13.6
   ]
  },
  {
   "id": "WENLI",
   "no": 8,
   "name": "文理楼",
   "group": "teaching",
   "cat": "college",
   "img": "img/sprites/WENLI.png",
   "grid": [
    111.3,
    137.9,
    20.3,
    14.7
   ],
   "bbox": [
    88,
    412,
    1423,
    927
   ],
   "scale": 0.376767,
   "paste": [
    4871.1,
    2595.5
   ],
   "dw": 536,
   "dh": 349,
   "foot": [
    5139.1,
    2810.5
   ],
   "depth": 258.4,
   "walkable": false,
   "desc": "周恺设计红砖围合院落（C形，朝西开口内院）4层，水平条窗+局部镂空砖格栅、东北退台，文理学科教学用房。",
   "collider": [
    104.8,
    141.5,
    11.4,
    13.0
   ]
  },
  {
   "id": "TEACH-2",
   "no": 9,
   "name": "第二教学楼",
   "group": "teaching",
   "cat": "teaching",
   "img": "img/sprites/TEACH-2.png",
   "grid": [
    65.1,
    106.4,
    25.2,
    19.6
   ],
   "bbox": [
    8,
    404,
    1591,
    995
   ],
   "scale": 0.516468,
   "paste": [
    4509.2,
    1787.4
   ],
   "dw": 821,
   "dh": 513,
   "foot": [
    4919.7,
    2095.0
   ],
   "depth": 193.37,
   "walkable": false,
   "desc": "柳湖东北侧红砖多体块围合院落群（约5-6体块、2-3内院+连廊，局部绿色屋顶，南门廊），承担本科课堂教学。",
   "collider": [
    63.0,
    111.7,
    19.9,
    17.4
   ]
  },
  {
   "id": "ACT",
   "no": 10,
   "name": "大学生活动中心",
   "group": "public",
   "cat": "activity",
   "img": "img/sprites/ACT.png",
   "grid": [
    38.5,
    114.1,
    30.1,
    18.2
   ],
   "bbox": [
    48,
    412,
    1519,
    967
   ],
   "scale": 0.403502,
   "paste": [
    3917.5,
    1635.4
   ],
   "dw": 612,
   "dh": 390,
   "foot": [
    4223.5,
    1872.2
   ],
   "depth": 173.11,
   "walkable": false,
   "desc": "单一白色菱形穿孔表皮体量（两翼南连、北缘V形凹口），南檐口波浪下凹，白平顶+矩形天窗，含剧场/社团/展厅。",
   "collider": [
    38.6,
    120.6,
    16.8,
    11.1
   ]
  },
  {
   "id": "CAN-YULAN",
   "no": 11,
   "name": "玉兰食堂",
   "group": "dining",
   "cat": "canteen",
   "img": "img/sprites/CAN-YULAN.png",
   "grid": [
    38.5,
    98.0,
    21.0,
    13.3
   ],
   "bbox": [
    116,
    384,
    1367,
    871
   ],
   "scale": 0.264901,
   "paste": [
    4307.2,
    1562.1
   ],
   "dw": 362,
   "dh": 230,
   "foot": [
    4488.2,
    1701.6
   ],
   "depth": 157.6,
   "walkable": false,
   "desc": "红砖盒形交错层叠食堂，室外大台阶直通二层、二层架空挑檐白柱、上层一条蓝玻带，含玉兰一/二食堂。",
   "collider": [
    41.5,
    107.9,
    7.6,
    8.9
   ]
  },
  {
   "id": "CAN-ZIZHU",
   "no": 12,
   "name": "紫竹食堂",
   "group": "dining",
   "cat": "canteen",
   "img": "img/sprites/CAN-ZIZHU.png",
   "grid": [
    34.3,
    135.1,
    16.1,
    13.3
   ],
   "bbox": [
    0,
    300,
    1599,
    1215
   ],
   "scale": 0.278749,
   "paste": [
    3221.1,
    1621.2
   ],
   "dw": 445,
   "dh": 338,
   "foot": [
    3443.6,
    1847.8
   ],
   "depth": 170.89,
   "walkable": false,
   "desc": "西门内粉色竖长楼体，北缘双塔楼（两凸体间凹口），含紫竹一~四食堂及民族食堂，约3900座；红砖立面+竖向长条窗。",
   "collider": [
    24.0,
    136.7,
    8.2,
    12.0
   ]
  },
  {
   "id": "ENG-TRAIN",
   "no": 13,
   "name": "泰瑞楼(工程训练中心)",
   "group": "teaching",
   "cat": "service",
   "img": "img/sprites/ENG-TRAIN.png",
   "grid": [
    100.1,
    69.3,
    16.8,
    19.6
   ],
   "bbox": [
    44,
    416,
    1511,
    947
   ],
   "scale": 0.672958,
   "paste": [
    5881.0,
    1656.5
   ],
   "dw": 1016,
   "dh": 637,
   "foot": [
    6389.0,
    2039.3
   ],
   "depth": 188.3,
   "walkable": false,
   "desc": "东北侧工程训练中心『泰瑞楼』（泰瑞机器冠名捐赠），红棕+浅灰板立面、横向条窗，转角内凹二层高玻璃入口，工程实践教学场地。",
   "collider": [
    92.7,
    72.5,
    22.2,
    24.1
   ]
  },
  {
   "id": "FIELD-N",
   "no": 14,
   "name": "北操场",
   "group": "sports",
   "cat": "field",
   "img": "img/sprites/FIELD-N.png",
   "grid": [
    91.4,
    25.0,
    30.0,
    30.0
   ],
   "bbox": [
    56,
    396,
    1491,
    971
   ],
   "scale": 0.653803,
   "paste": [
    6647.2,
    1220.7
   ],
   "dw": 974,
   "dh": 634,
   "foot": [
    7134.2,
    1611.0
   ],
   "depth": 149.37,
   "walkable": true,
   "desc": "校园东北侧东田径场（用户标注『北操场』），标准足球场+环形跑道（跑道形，南北长轴），北邻游泳馆/篮球馆。",
   "collider": [
    94.0,
    33.2,
    14.6,
    29.8
   ]
  },
  {
   "id": "MOUNT-YUPING",
   "no": 15,
   "name": "玉屏山",
   "group": "nature",
   "cat": "nature",
   "img": "img/sprites/MOUNT-YUPING.png",
   "grid": [
    11.9,
    6.3,
    67.2,
    46.2
   ],
   "bbox": [
    0,
    208,
    1583,
    839
   ],
   "scale": 0.950183,
   "paste": [
    5992.2,
    549.5
   ],
   "dw": 1504,
   "dh": 797,
   "foot": [
    6744.2,
    970.5
   ],
   "depth": 91.14,
   "walkable": false,
   "desc": "",
   "collider": [
    41.5,
    15.5,
    43.7,
    24.7
   ]
  },
  {
   "id": "GATE-W",
   "no": 16,
   "name": "西门",
   "group": "gate",
   "cat": "gate",
   "img": "img/sprites/GATE-W.png",
   "grid": [
    2.1,
    137.9,
    5.6,
    8.4
   ],
   "bbox": [
    48,
    328,
    1479,
    1127
   ],
   "scale": 0.169574,
   "paste": [
    2928.8,
    1427.0
   ],
   "dw": 250,
   "dh": 191,
   "foot": [
    3053.8,
    1555.3
   ],
   "depth": 144.3,
   "walkable": false,
   "desc": "深灰青砖马头墙三退台高门柱（圆形校徽+竖排校名+中式瓦檐）+矮灰砖玻璃岗亭+黑色电动伸缩门。",
   "collider": [
    4.1,
    134.5,
    3.8,
    7.6
   ]
  }
 ]
};

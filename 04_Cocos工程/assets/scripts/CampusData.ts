// 自动生成：Cocos Creator 3.8 等距校园数据（由 gen_cocos_data.js 从权威 data.js 导出）。勿手改。
export interface CampusMeta {
  project: string; ground: string; groundSize: number[]; diamond: number[];
  origin: number[]; tile: number[]; gridRange: number[]; count: number;
}
export interface CampusBuilding {
  id: string; no: number; name: string; group: string; cat: string; res: string;
  grid: number[]; bbox: number[]; scale: number; paste: number[];
  dw: number; dh: number; foot: number[]; depth: number; walkable: boolean;
  desc: string; collider: number[] | null; colliders: number[][] | null; entry: number[] | null;
}
export interface CampusRoad {
  w: number; paved: boolean; through: boolean; gpts: number[][];
}
export const META: CampusMeta = {
  project: "北京化工大学昌平校区 · 等距像素数字校园",
  ground: 'ground',
  groundSize: [19904, 9952], diamond: [0, 0, 19904, 9952], origin: [11712, 1664], tile: [32, 16], gridRange: [-44, -60, 196, 322],
  count: 16
};
export const BUILDINGS: CampusBuilding[] = [
  {
    "id": "FIELD-W",
    "no": 1,
    "name": "风雨操场",
    "group": "sports",
    "cat": "field",
    "res": "sprites/FIELD-W",
    "grid": [-22.95, 223.45, 24, 34],
    "bbox": [0, 232, 1599, 1219],
    "scale": 0.627,
    "paste": [1389.9, 1943.8],
    "dw": 1002,
    "dh": 764,
    "foot": [1890.9, 2457.1],
    "depth": 226.28,
    "walkable": true,
    "desc": "校园西南侧西田径场（用户标注『风雨操场』），跑道形足球场+环形跑道（南北长轴），东侧篮球场/游泳馆，东邻南湖，东南邻体育馆。",
    "collider": [-19.65, 218.65, 16.5, 29.1],
    "colliders": null,
    "entry": null
  },
  {
    "id": "GYM",
    "no": 2,
    "name": "体育馆",
    "group": "sports",
    "cat": "gym",
    "res": "sprites/GYM",
    "grid": [46.22, 273.19, 23.8, 22.4],
    "bbox": [44, 248, 1519, 1119],
    "scale": 0.569,
    "paste": [1716.9, 2799.5],
    "dw": 863,
    "dh": 636,
    "foot": [2148.4, 3219.5],
    "depth": 295.6,
    "walkable": false,
    "desc": "主校门西北侧跑道形（圆角矩形）大跨综合体育馆，长轴东偏北约45°，灰色大挑檐平顶+红砖方柱+朝东南蓝玻璃幕墙，含篮球/羽毛球/游泳等14个训练馆。",
    "collider": [46.22, 273.19, 23.8, 22.4],
    "colliders": null,
    "entry": [72.4, 295.6]
  },
  {
    "id": "TEACH-1",
    "no": 3,
    "name": "第一教学楼",
    "group": "teaching",
    "cat": "teaching",
    "res": "sprites/TEACH-1",
    "grid": [62.46, 232.59, 50.4, 16.8],
    "bbox": [20, 192, 1579, 839],
    "scale": 0.908,
    "paste": [2392.5, 2718.7],
    "dw": 1434,
    "dh": 762,
    "foot": [3109.5, 3122.1],
    "depth": 286.74,
    "walkable": false,
    "desc": "开口朝南的马蹄形（U形）主教学楼：北侧中央为南北向玻璃主楼，东西两座弧形翼（A座西/B座东）由北连廊相接并向南围合出庭院；红褐色竖向格栅+白色平顶，130间智慧教室。中间庭院（空中连廊下方）无碰撞，可从南门大拱门走入。",
    "collider": null,
    "colliders": [
    [50.855, 228.085, 11.7, 12],
    [112.86, 232.59, 4.6, 10],
    [62, 232, 20, 23],
    [92, 232, 25, 21]
  ],
    "entry": [87, 253]
  },
  {
    "id": "LAB-TECH",
    "no": 4,
    "name": "实验楼群",
    "group": "teaching",
    "cat": "lab",
    "res": "sprites/LAB-TECH",
    "grid": [101.03, 179.81, 31.5, 28.7],
    "bbox": [0, 240, 1599, 1227],
    "scale": 0.81,
    "paste": [3596.8, 2331],
    "dw": 1295,
    "dh": 993,
    "foot": [4244.3, 3000.2],
    "depth": 275.65,
    "walkable": false,
    "desc": "实验群西翼（南北贯通两进院），红褐陶土下部+浅灰板带上部、密排竖窗，中段内凹Π形玻璃门厅，实景标牌『实验楼A』。",
    "collider": null,
    "colliders": [
    [101.03, 179.81, 11, 10.5],
    [115, 179.81, 17.5, 10.5],
    [101.03, 196, 11, 12.5],
    [115, 196, 17.5, 12.5]
  ],
    "entry": [113, 207]
  },
  {
    "id": "GATE-S",
    "no": 5,
    "name": "南门(主校门)",
    "group": "gate",
    "cat": "gate",
    "res": "sprites/GATE-S",
    "grid": [81.74, 304.65, 9.1, 8.4],
    "bbox": [64, 536, 1535, 831],
    "scale": 0.254,
    "paste": [1814.3, 3663.3],
    "dw": 389,
    "dh": 211,
    "foot": [2008.8, 3776.9],
    "depth": 346.26,
    "walkable": false,
    "desc": "学校正门、敞开式无门楼，横卧校名石（红字）+石后旗杆+两侧灰色矮岗亭，中轴礼仪序列起点。",
    "collider": [77.44, 313.15, 12.7, 5.1],
    "colliders": null,
    "entry": null
  },
  {
    "id": "GATE-E",
    "no": 6,
    "name": "东门",
    "group": "gate",
    "cat": "gate",
    "res": "sprites/GATE-E",
    "grid": [181.21, 163.56, 6.3, 7.7],
    "bbox": [56, 528, 1491, 859],
    "scale": 0.159,
    "paste": [4697.6, 3034.8],
    "dw": 236,
    "dh": 136,
    "foot": [4815.6, 3111.6],
    "depth": 285.78,
    "walkable": false,
    "desc": "校园东侧出入口，车辆主出入口，1层简易道闸门房，门内西侧机动车环岛。",
    "collider": [146.31, 174.365, 3.8, 7],
    "colliders": null,
    "entry": null
  },
  {
    "id": "LIB",
    "no": 7,
    "name": "图书馆",
    "group": "public",
    "cat": "library",
    "res": "sprites/LIB",
    "grid": [80.91, 133.31, 17.5, 17.5],
    "bbox": [0, 272, 1599, 1275],
    "scale": 0.431,
    "paste": [4523.1, 2082.1],
    "dw": 689,
    "dh": 549,
    "foot": [4867.6, 2458.8],
    "depth": 226.44,
    "walkable": false,
    "desc": "约5万㎡，国家优质工程；连续折线单一体量（东侧百叶带与主体连体）+中央三角形玻璃采光中庭+弧形转角，红褐色横百叶+玻璃幕墙，临柳湖。",
    "collider": [80.91, 133.31, 17.5, 17.5],
    "colliders": null,
    "entry": [100.8, 150.8]
  },
  {
    "id": "WENLI",
    "no": 8,
    "name": "文理楼",
    "group": "teaching",
    "cat": "college",
    "res": "sprites/WENLI",
    "grid": [125.38, 139.21, 20.3, 14.7],
    "bbox": [88, 412, 1423, 927],
    "scale": 0.377,
    "paste": [4871.1, 2595.5],
    "dw": 536,
    "dh": 349,
    "foot": [5139.1, 2810.5],
    "depth": 258.4,
    "walkable": false,
    "desc": "周恺设计红砖围合院落（C形，朝西开口内院）4层，水平条窗+局部镂空砖格栅、东北退台，文理学科教学用房。",
    "collider": [125.38, 139.21, 20.3, 14.7],
    "colliders": null,
    "entry": [145.7, 156.3]
  },
  {
    "id": "TEACH-2",
    "no": 9,
    "name": "第二教学楼",
    "group": "teaching",
    "cat": "teaching",
    "res": "sprites/TEACH-2",
    "grid": [61.73, 88.82, 21, 25.2],
    "bbox": [8, 404, 1591, 995],
    "scale": 0.516,
    "paste": [4509.2, 1787.4],
    "dw": 821,
    "dh": 513,
    "foot": [4919.7, 2095],
    "depth": 193.37,
    "walkable": false,
    "desc": "柳湖东北侧红砖多体块围合院落群（约5-6体块、2-3内院+连廊，局部绿色屋顶，南门廊），承担本科课堂教学。",
    "collider": [61.73, 88.82, 21, 25.2],
    "colliders": null,
    "entry": [85.1, 114]
  },
  {
    "id": "ACT",
    "no": 10,
    "name": "大学生活动中心",
    "group": "public",
    "cat": "activity",
    "res": "sprites/ACT",
    "grid": [19.32, 105.78, 28, 18.2],
    "bbox": [48, 412, 1519, 967],
    "scale": 0.404,
    "paste": [3917.5, 1635.4],
    "dw": 612,
    "dh": 390,
    "foot": [4223.5, 1872.2],
    "depth": 173.11,
    "walkable": false,
    "desc": "单一白色菱形穿孔表皮体量（两翼南连、北缘V形凹口），南檐口波浪下凹，白平顶+矩形天窗，含剧场/社团/展厅。",
    "collider": [19.32, 105.78, 28, 18.2],
    "colliders": null,
    "entry": [47.3, 126.4]
  },
  {
    "id": "CAN-YULAN",
    "no": 11,
    "name": "玉兰食堂",
    "group": "dining",
    "cat": "canteen",
    "res": "sprites/CAN-YULAN",
    "grid": [17.51, 82.08, 15.4, 12.6],
    "bbox": [116, 384, 1367, 871],
    "scale": 0.265,
    "paste": [4307.2, 1562.1],
    "dw": 362,
    "dh": 230,
    "foot": [4488.2, 1701.6],
    "depth": 157.6,
    "walkable": false,
    "desc": "红砖盒形交错层叠食堂，室外大台阶直通二层、二层架空挑檐白柱、上层一条蓝玻带，含玉兰一/二食堂。",
    "collider": [17.51, 82.08, 15.4, 12.6],
    "colliders": null,
    "entry": [32.9, 97.1]
  },
  {
    "id": "CAN-ZIZHU",
    "no": 12,
    "name": "紫竹食堂",
    "group": "dining",
    "cat": "canteen",
    "res": "sprites/CAN-ZIZHU",
    "grid": [11.02, 137.85, 16.1, 13.3],
    "bbox": [0, 300, 1599, 1215],
    "scale": 0.279,
    "paste": [3221.1, 1621.2],
    "dw": 445,
    "dh": 338,
    "foot": [3443.6, 1847.8],
    "depth": 170.89,
    "walkable": false,
    "desc": "西门内粉色竖长楼体，北缘双塔楼（两凸体间凹口），含紫竹一~四食堂及民族食堂，约3900座；红砖立面+竖向长条窗。",
    "collider": [11.02, 137.85, 16.1, 13.3],
    "colliders": null,
    "entry": [27.1, 153.6]
  },
  {
    "id": "ENG-TRAIN",
    "no": 13,
    "name": "泰瑞楼(工程训练中心)",
    "group": "teaching",
    "cat": "service",
    "res": "sprites/ENG-TRAIN",
    "grid": [109.14, 39.73, 16.8, 19.6],
    "bbox": [44, 416, 1511, 947],
    "scale": 0.673,
    "paste": [5881, 1656.5],
    "dw": 1016,
    "dh": 637,
    "foot": [6389, 2039.3],
    "depth": 188.3,
    "walkable": false,
    "desc": "东北侧工程训练中心『泰瑞楼』（泰瑞机器冠名捐赠），红棕+浅灰板立面、横向条窗，转角内凹二层高玻璃入口，工程实践教学场地。",
    "collider": [109.14, 39.73, 16.8, 19.6],
    "colliders": null,
    "entry": [125.9, 61.7]
  },
  {
    "id": "FIELD-N",
    "no": 14,
    "name": "北操场",
    "group": "sports",
    "cat": "field",
    "res": "sprites/FIELD-N",
    "grid": [100.3, -33.2, 22, 32],
    "bbox": [56, 396, 1491, 971],
    "scale": 0.654,
    "paste": [6647.2, 1220.7],
    "dw": 974,
    "dh": 634,
    "foot": [7134.2, 1611],
    "depth": 149.37,
    "walkable": true,
    "desc": "校园东北侧东田径场（用户标注『北操场』），标准足球场+环形跑道（跑道形，南北长轴），北邻游泳馆/篮球馆。",
    "collider": [100.3, -19, 14.6, 29.8],
    "colliders": null,
    "entry": null
  },
  {
    "id": "MOUNT-YUPING",
    "no": 15,
    "name": "玉屏山",
    "group": "nature",
    "cat": "nature",
    "res": "sprites/MOUNT-YUPING",
    "grid": [-18.74, -51.61, 67.2, 46.2],
    "bbox": [0, 208, 1583, 839],
    "scale": 0.95,
    "paste": [5992.2, 549.5],
    "dw": 1504,
    "dh": 797,
    "foot": [6744.2, 970.5],
    "depth": 91.14,
    "walkable": false,
    "desc": "",
    "collider": [-18.74, -51.61, 67.2, 46.2],
    "colliders": null,
    "entry": null
  },
  {
    "id": "GATE-W",
    "no": 16,
    "name": "西门",
    "group": "gate",
    "cat": "gate",
    "res": "sprites/GATE-W",
    "grid": [-32.95, 139.21, 5.6, 8.4],
    "bbox": [48, 328, 1479, 1127],
    "scale": 0.17,
    "paste": [2928.8, 1427],
    "dw": 250,
    "dh": 191,
    "foot": [3053.8, 1555.3],
    "depth": 144.3,
    "walkable": false,
    "desc": "深灰青砖马头墙三退台高门柱（圆形校徽+竖排校名+中式瓦檐）+矮灰砖玻璃岗亭+黑色电动伸缩门。",
    "collider": [-30.955, 135.805, 3.8, 7.6],
    "colliders": null,
    "entry": null
  }
];

export const ROADS: CampusRoad[] = [
  {
    "w": 7, "paved": true, "through": false,
    "gpts": [
    [-30.92, -19.13],
    [-30.92, -4.92],
    [-31.94, 31.62],
    [-31.94, 82.37],
    [-30.92, 133.11],
    [-30.92, 173.71],
    [-30.92, 214.31],
    [-27.88, 244.76],
    [-21.79, 263.04],
    [-16.72, 275.21]
  ]
  },
  {
    "w": 7, "paved": true, "through": false,
    "gpts": [
    [-30.92, -4.92],
    [-6.56, -5.94],
    [13.73, -8.98],
    [34.03, -11.01],
    [54.33, -14.06],
    [74.63, -19.13],
    [86.81, -27.25],
    [94.94, -37.41],
    [107.12, -45.53],
    [119.29, -47.56],
    [135.53, -45.53]
  ]
  },
  {
    "w": 7, "paved": true, "through": false,
    "gpts": [
    [135.53, -45.53],
    [137.56, -19.13],
    [137.56, 11.32],
    [135.53, 25.53],
    [143.66, 39.73],
    [155.84, 51.92],
    [172.07, 62.07],
    [182.22, 72.22],
    [184.25, 112.81],
    [183.24, 153.41],
    [182.22, 194.01],
    [183.24, 234.61],
    [181.21, 265.06],
    [176.14, 279.27],
    [182.22, 275.21]
  ]
  },
  {
    "w": 7, "paved": true, "through": false,
    "gpts": [
    [-18.74, 278.26],
    [3.58, 282.32],
    [29.98, 290.44],
    [54.33, 299.57],
    [70.58, 306.68],
    [85.8, 309.73],
    [101.03, 305.66],
    [115.23, 297.54],
    [135.53, 289.42],
    [155.84, 284.35],
    [176.14, 281.31],
    [182.22, 275.21]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [85.8, 309.73],
    [85.8, 291.46],
    [86.41, 275.21],
    [88.84, 261],
    [92.1, 253]
  ]
  },
  {
    "w": 12, "paved": true, "through": true,
    "gpts": [
    [84, 253],
    [84, 245],
    [82, 237],
    [80, 234],
    [80, 230],
    [106.1, 230.56]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [125, 242],
    [126.5, 236],
    [122, 231.5],
    [114, 230],
    [106.1, 230.56],
    [106.1, 210.25],
    [105.08, 183.86],
    [104.07, 153.41],
    [102.04, 122.97],
    [97.98, 102.67],
    [94.94, 92.52],
    [90.88, 76.28],
    [82.76, 51.92],
    [74.63, 27.56],
    [62.46, 7.26],
    [42.16, -4.92]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [135.53, 25.53],
    [135.53, 47.86],
    [135.53, 64.09],
    [129.44, 82.37],
    [121.32, 108.76],
    [116.25, 133.11],
    [115.23, 153.41],
    [115.23, 165.59]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [135.53, 64.09],
    [155.84, 68.16],
    [172.07, 70.19],
    [182.22, 72.22]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [-30.92, 108.76],
    [3.58, 107.74],
    [23.88, 104.8],
    [44.18, 104],
    [50.5, 101.5],
    [55.5, 94.5],
    [62, 90.5],
    [74, 89.8],
    [84.78, 94.54],
    [105.08, 88.46],
    [125.38, 81.35],
    [145.69, 75.26],
    [165.99, 72.22],
    [182.22, 72.22]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [-30.92, 163.56],
    [3.58, 165.59],
    [23.88, 161.54],
    [44.18, 165.59],
    [64.48, 173.71],
    [84.78, 169.66],
    [105.08, 163.56],
    [125.38, 163.56],
    [151.77, 165.59],
    [182.22, 165.59]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [29.98, 254.91],
    [54.33, 254.91],
    [86.81, 258],
    [99.7, 259.1],
    [112, 255],
    [125.38, 246],
    [145.69, 234.61],
    [165.99, 234.61],
    [182.22, 230.56]
  ]
  },
  {
    "w": 6, "paved": true, "through": false,
    "gpts": [
    [109.14, 182.85],
    [123.36, 177.78],
    [137.56, 173.71],
    [153.81, 169.66],
    [172.07, 166.61],
    [182.22, 165.59]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [17.8, 55.98],
    [17.8, 82.37],
    [17.8, 112.81],
    [18.81, 143.26],
    [19.83, 173.71],
    [21.85, 204.16],
    [23.88, 226.5]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [98.99, -17.1],
    [98.59, 3.19],
    [96.97, 19.44],
    [98.99, 27.56],
    [105.08, 37.71]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-30.92, 11.32],
    [13.73, 11.32]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-30.92, 25.53],
    [13.73, 25.53]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-30.92, 39.73],
    [13.73, 39.73]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-30.92, 145.29],
    [-10.62, 145.29],
    [17.8, 145.29]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-30.92, 181.84],
    [-2.5, 181.84],
    [23.88, 185.89]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-0.47, 254.91],
    [19.83, 254.91],
    [38.1, 254.91]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [-16.72, 275.21],
    [13.73, 279.27],
    [34.03, 287.39],
    [46.22, 295.51]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [109.14, 70.19],
    [123.36, 64.09],
    [135.53, 64.09]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [105.08, 155.44],
    [125.38, 151.39],
    [141.62, 143.26]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [74.63, 173.71],
    [78.69, 204.16],
    [82.76, 234.61]
  ]
  },
  {
    "w": 4, "paved": false, "through": false,
    "gpts": [
    [13.73, -4.92],
    [19.83, 21.47],
    [23.88, 51.92],
    [27.95, 76.28]
  ]
  },
  {
    "w": 3.5, "paved": true, "through": false,
    "gpts": [
    [72.4, 295.6],
    [66.4, 301.6]
  ]
  },
  {
    "w": 4.5, "paved": true, "through": false,
    "gpts": [
    [113, 207],
    [113, 209.5],
    [111.5, 212],
    [108, 214]
  ]
  },
  {
    "w": 3.5, "paved": true, "through": false,
    "gpts": [
    [145.7, 156.3],
    [147.2, 161.8]
  ]
  },
  {
    "w": 3.5, "paved": true, "through": false,
    "gpts": [
    [85.1, 114],
    [95.6, 103.5]
  ]
  },
  {
    "w": 4, "paved": true, "through": false,
    "gpts": [
    [47.3, 126.4],
    [50, 124],
    [50.5, 101.5]
  ]
  },
  {
    "w": 3.5, "paved": true, "through": false,
    "gpts": [
    [32.9, 97.1],
    [33.4, 100.6]
  ]
  },
  {
    "w": 3.5, "paved": true, "through": false,
    "gpts": [
    [27.1, 153.6],
    [22.1, 158.6]
  ]
  },
  {
    "w": 4, "paved": true, "through": false,
    "gpts": [
    [117.5, -2.4],
    [122, 1],
    [130, 2],
    [137, 0]
  ]
  }
];

export const GROUP_CN: Record<string, string> = {
  teaching: '教学科研', public: '公共服务', sports: '体育',
  dining: '餐饮', gate: '校门', nature: '自然地标'
};
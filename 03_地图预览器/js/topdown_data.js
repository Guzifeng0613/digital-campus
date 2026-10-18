// 自动生成：top-down 正俯视渲染所需的网格数据（道路/运河/自然地块）。
// 由 02_地图工程/build/gen_topdown_data.py 从 map_data.json 导出。勿手改。
// 逻辑网格 gx,gy 与投影解耦：gx=东向, gy=南向（屏幕右下即世界右下）。
window.TOPDOWN_DATA = {
 "roads": [
  {
   "name": "东环车行路",
   "w": 6,
   "paved": false,
   "gpts": [
    [
     114.88,
     33.22
    ],
    [
     124.38,
     58.54
    ],
    [
     130.71,
     96.52
    ],
    [
     140.2,
     131.34
    ],
    [
     140.2,
     172.49
    ],
    [
     130.71,
     216.8
    ],
    [
     102.22,
     248.45
    ]
   ]
  },
  {
   "name": "樱花大道",
   "w": 6,
   "paved": false,
   "gpts": [
    [
     43.67,
     42.72
    ],
    [
     38.92,
     90.19
    ],
    [
     37.33,
     137.67
    ],
    [
     34.17,
     185.15
    ],
    [
     32.59,
     223.13
    ],
    [
     45.25,
     248.45
    ]
   ]
  },
  {
   "name": "宏德大道",
   "w": 7,
   "paved": true,
   "gpts": [
    [
     61.07,
     33.22
    ],
    [
     67.4,
     77.53
    ],
    [
     70.57,
     121.84
    ],
    [
     72.15,
     166.16
    ],
    [
     68.99,
     210.47
    ],
    [
     61.07,
     242.12
    ]
   ]
  },
  {
   "name": "北侧路",
   "w": 6,
   "paved": false,
   "gpts": [
    [
     13.6,
     68.04
    ],
    [
     54.74,
     66.45
    ],
    [
     99.06,
     65.5
    ],
    [
     115.5,
     38.5
    ]
   ]
  },
  {
   "name": "汇川路",
   "w": 6,
   "paved": false,
   "gpts": [
    [
     42.08,
     115.51
    ],
    [
     73.73,
     121.84
    ],
    [
     102.22,
     128.17
    ],
    [
     130.71,
     131.34
    ]
   ]
  },
  {
   "name": "樱花道",
   "w": 6,
   "paved": false,
   "gpts": [
    [
     10.43,
     153.5
    ],
    [
     45.25,
     156.66
    ],
    [
     73.73,
     159.83
    ],
    [
     99.06,
     166.16
    ],
    [
     124.38,
     172.49
    ],
    [
     140.2,
     172.49
    ]
   ]
  },
  {
   "name": "南涧大道",
   "w": 7,
   "paved": true,
   "gpts": [
    [
     45.25,
     248.45
    ],
    [
     76.9,
     245.28
    ],
    [
     105.39,
     235.79
    ],
    [
     130.71,
     216.8
    ]
   ]
  },
  {
   "name": "一教环路",
   "w": 5,
   "paved": false,
   "gpts": [
    [
     45.25,
     197.81
    ],
    [
     70.57,
     193.06
    ],
    [
     102.22,
     197.81
    ],
    [
     130.71,
     185.15
    ]
   ]
  },
  {
   "name": "南门轴路",
   "w": 5,
   "paved": false,
   "gpts": [
    [
     83.23,
     263.0
    ],
    [
     83.23,
     242.8
    ]
   ]
  },
  {
   "name": "西门支路",
   "w": 4,
   "paved": false,
   "gpts": [
    [
     6.0,
     138.3
    ],
    [
     8.6,
     146.5
    ],
    [
     10.43,
     153.5
    ]
   ]
  },
  {
   "name": "风雨操场支路",
   "w": 4,
   "paved": false,
   "gpts": [
    [
     28.79,
     205.72
    ],
    [
     33.3,
     205.72
    ]
   ]
  }
 ],
 "canal": [
  [
   44.61,
   39.55
  ],
  [
   50.94,
   83.86
  ],
  [
   56.33,
   128.17
  ],
  [
   61.07,
   172.49
  ],
  [
   56.33,
   216.8
  ],
  [
   48.41,
   245.28
  ]
 ],
 "nature": [
  {
   "id": "N-MOUNT-YUPING",
   "name": "玉屏山",
   "cat": "mountain",
   "shape": "poly",
   "gpoly": [
    [
     41.45,
     38.92
    ],
    [
     45.25,
     31.95
    ],
    [
     49.05,
     25.62
    ],
    [
     55.38,
     18.66
    ],
    [
     61.07,
     24.36
    ],
    [
     64.87,
     24.99
    ],
    [
     71.2,
     15.5
    ],
    [
     77.53,
     19.93
    ],
    [
     80.7,
     24.36
    ],
    [
     83.86,
     29.42
    ],
    [
     85.13,
     35.12
    ],
    [
     82.6,
     39.55
    ],
    [
     67.4,
     40.18
    ],
    [
     52.21,
     40.18
    ]
   ],
   "grid": [
    41.45,
    15.5,
    43.68,
    24.69
   ]
  },
  {
   "id": "N-FOREST-HUAYU",
   "name": "化育林",
   "cat": "park",
   "shape": "poly",
   "gpoly": [
    [
     7.27,
     42.72
    ],
    [
     8.85,
     12.65
    ],
    [
     27.84,
     9.48
    ],
    [
     40.5,
     12.65
    ],
    [
     43.67,
     33.22
    ],
    [
     38.92,
     45.88
    ],
    [
     19.93,
     47.46
    ]
   ],
   "grid": [
    7.27,
    9.48,
    36.4,
    37.98
   ]
  },
  {
   "id": "N-GARDEN",
   "name": "花园",
   "cat": "park",
   "shape": "poly",
   "gpoly": [
    [
     7.9,
     47.46
    ],
    [
     13.6,
     33.22
    ],
    [
     32.59,
     33.22
    ],
    [
     37.33,
     45.88
    ],
    [
     29.42,
     50.63
    ],
    [
     13.6,
     51.58
    ]
   ],
   "grid": [
    7.9,
    33.22,
    29.44,
    18.36
   ]
  },
  {
   "id": "N-LAKE-LIU",
   "name": "柳湖",
   "cat": "water",
   "shape": "poly",
   "gpoly": [
    [
     56.33,
     137.67
    ],
    [
     60.44,
     135.14
    ],
    [
     66.77,
     133.87
    ],
    [
     72.15,
     135.14
    ],
    [
     76.27,
     138.3
    ],
    [
     77.53,
     142.1
    ],
    [
     76.27,
     146.53
    ],
    [
     73.73,
     150.33
    ],
    [
     68.04,
     152.86
    ],
    [
     60.44,
     152.86
    ],
    [
     54.74,
     150.96
    ],
    [
     52.21,
     146.53
    ],
    [
     52.84,
     141.47
    ],
    [
     54.74,
     138.3
    ]
   ],
   "grid": [
    52.21,
    133.87,
    25.32,
    18.99
   ]
  },
  {
   "id": "N-LAKE-NAN",
   "name": "南湖",
   "cat": "water",
   "shape": "poly",
   "gpoly": [
    [
     47.78,
     206.67
    ],
    [
     54.11,
     204.14
    ],
    [
     60.44,
     206.04
    ],
    [
     63.61,
     210.47
    ],
    [
     61.07,
     216.17
    ],
    [
     54.74,
     218.7
    ],
    [
     49.05,
     216.17
    ],
    [
     46.51,
     211.1
    ]
   ],
   "grid": [
    46.51,
    204.14,
    17.09,
    14.56
   ]
  },
  {
   "id": "N-LAWN-AXIS",
   "name": "中轴礼仪草坪",
   "cat": "park",
   "shape": "rect",
   "gpoly": [],
   "grid": [
    66.77,
    204.14,
    24.69,
    50.64
   ]
  },
  {
   "id": "N-GREEN-WEST",
   "name": "西园绿地",
   "cat": "park",
   "shape": "rect",
   "gpoly": [],
   "grid": [
    39.55,
    153.5,
    12.66,
    37.98
   ]
  }
 ],
 "sprites": {
  "FIELD-W": {
   "file": "img/topdown/sprites/FIELD-W.png",
   "w": 792,
   "h": 1396,
   "kind": "field",
   "dy": 0
  },
  "GYM": {
   "file": "img/topdown/sprites/GYM.png",
   "w": 944,
   "h": 1040,
   "kind": "gym",
   "dy": 21
  },
  "TEACH-1": {
   "file": "img/topdown/sprites/TEACH-1.png",
   "w": 2128,
   "h": 1148,
   "kind": "teaching",
   "dy": 22
  },
  "LAB-TECH": {
   "file": "img/topdown/sprites/LAB-TECH.png",
   "w": 1184,
   "h": 1784,
   "kind": "lab",
   "dy": 391
  },
  "GATE-S": {
   "file": "img/topdown/sprites/GATE-S.png",
   "w": 608,
   "h": 316,
   "kind": "gate",
   "dy": 0
  },
  "GATE-E": {
   "file": "img/topdown/sprites/GATE-E.png",
   "w": 184,
   "h": 408,
   "kind": "gate",
   "dy": 0
  },
  "LIB": {
   "file": "img/topdown/sprites/LIB.png",
   "w": 852,
   "h": 796,
   "kind": "library",
   "dy": 0
  },
  "WENLI": {
   "file": "img/topdown/sprites/WENLI.png",
   "w": 548,
   "h": 768,
   "kind": "college",
   "dy": 0
  },
  "TEACH-2": {
   "file": "img/topdown/sprites/TEACH-2.png",
   "w": 956,
   "h": 980,
   "kind": "teaching",
   "dy": 228
  },
  "ACT": {
   "file": "img/topdown/sprites/ACT.png",
   "w": 804,
   "h": 676,
   "kind": "activity",
   "dy": 0
  },
  "CAN-YULAN": {
   "file": "img/topdown/sprites/CAN-YULAN.png",
   "w": 364,
   "h": 544,
   "kind": "canteen",
   "dy": 132
  },
  "CAN-ZIZHU": {
   "file": "img/topdown/sprites/CAN-ZIZHU.png",
   "w": 396,
   "h": 696,
   "kind": "canteen",
   "dy": 18
  },
  "ENG-TRAIN": {
   "file": "img/topdown/sprites/ENG-TRAIN.png",
   "w": 1064,
   "h": 1300,
   "kind": "service",
   "dy": 48
  },
  "FIELD-N": {
   "file": "img/topdown/sprites/FIELD-N.png",
   "w": 700,
   "h": 1428,
   "kind": "field",
   "dy": 0
  },
  "MOUNT-YUPING": {
   "file": "img/topdown/sprites/MOUNT-YUPING.png",
   "w": 2096,
   "h": 1384,
   "kind": "nature",
   "dy": 9
  },
  "GATE-W": {
   "file": "img/topdown/sprites/GATE-W.png",
   "w": 184,
   "h": 436,
   "kind": "gate",
   "dy": 0
  }
 }
};

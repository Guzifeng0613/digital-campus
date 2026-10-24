# 北化数字校园 · Top-down 正俯视（星露谷式）渲染规范 v1

> 本文件是阶段 TD-0 的**唯一契约**。后续 4 个并行资产批次（A/B/C/D）只读本文件即可开工；
> 除本文件外，风格、尺寸、命名、光向、调色板均以 `03_地图预览器/img/topdown/sprites/TEACH-1.png`
> 等样板资产为最终事实来源。任何歧义以样板像素为准。
>
- 投影已从「等距菱形 iso 2.5D」整体切换为「正俯视 top-down 方形瓦片」。
- **逻辑网格 gx,gy 不变**（`js/data.js` 的 grid / collider / 道路 gpts 全部与投影解耦），只改世界投影。
- 旧 iso 资产（`img/ground.png`、`img/sprites/*.png`）保留在原位不删、不引用；新资产统一进 `img/topdown/`。

---

## 1. 网格与投影（已锁定，禁止批次改动）

| 项 | 值 | 说明 |
|---|---|---|
| `TILE` | **48 px** | 1 个逻辑网格单位 = 48 世界像素。实测区间 40–64，取 48：草地 tile=48px 时艺术像素 12×12 刚好出干净颗粒；64px 建筑画布过大，40px 角色/道路显小。 |
| `GRAIN`（艺术像素） | **4 世界 px** | 所有 sprite 内部 1 个「逻辑像素」= 4 世界 px = 1/12 tile。生图后用 Pillow 压到「画布/GRAIN」再 NEAREST×GRAIN 放大。 |
| gx 范围 | 6 … 144 | 东向为 +x（屏幕右） |
| gy 范围 | 6 … 271.2 | 南向为 +y（屏幕下）；gy 小=北=屏幕上方 |
| 世界尺寸 | 6624 × 12730.5 px | (144−6)×48 × (271.2−6)×48 |
| 世界原点偏移 `ox,oy` | **0, 0** | gridToWorld 直接 = (gx×TILE, gy×TILE)，无平移 |

### 1.1 投影公式（废除旧菱形投影）

```
世界坐标 world(gx, gy) = ( gx * 48 + 0,  gy * 48 + 0 )
屏幕坐标 = world * zoom + viewOffset   （viewOffset 为相机平移）
逆变换 gx = screenX / zoom - viewOffsetX / zoom ；gy 同理
```

**旧公式 `world = ((gx-gy)*22 + 5964.4, (gx+gy)*11 - 32)` 永久废除**，新管线任何地方不得再出现 `(gx-gy, gx+gy)` 旋转坐标。

### 1.2 相机居中

- 校园世界包围盒：x ∈ [6×48, 144×48] = [288, 6912]，y ∈ [6×48, 271.2×48] = [288, 13017.6]
- 校园中心 `C = (3600, 6652.8)`
- `fitZoom = min(winW/6624, winH/12730) × 0.96`
- 初始相机：viewOffset 使 C 落在屏幕中心（偏上 0.62 处，同旧版跟随偏移）。

### 1.3 深度排序

```
depth = gy * 1000 + gx     （K=1000 > gx 跨度 138，保证先按 gy 排序，再按 gx）
```

- gy 越大（越南）越靠前绘制。角色、建筑 sprite、围栏、门、装饰全部参与同一 drawList 排序。
- 角色 depth 用其所在网格点 `(gx,gy)`。

---

## 2. 建筑 sprite 锚点与画布尺寸

### 2.1 锚点约定（精确）

每栋建筑 footprint 由 data.js `grid = [fx, fy, fw, fh]`（网格单位）给出：

```
footprint 世界矩形: x ∈ [fx*48, (fx+fw)*48],  y ∈ [fy*48, (fy+fh)*48]
sprite 锚点 A = footprint 南缘中点 = ( (fx+fw/2)*48, (fy+fh)*48 )
绘制: drawImage(img, A.x - img.width/2,  A.y - img.height)
```

- **图像底边中点 = 锚点**。sprite 内部：底部 `fh_px` 高的区域就是 footprint 占地（贴地），
  向上（画面上方=北）延伸 `rise_px` 高的屋顶/立面。
- 屋顶/立面朝北（屏幕上方）延伸；**南立面（门窗入口）画在图像底部边缘**，随投影自然朝向玩家。
- sprite 不画地面阴影贴图以外的地面颜色；footprint 范围之外（图像上半的屋顶悬挑、北侧台阶）可自由出框。

### 2.2 画布尺寸公式

```
fw_px = round(fw*48 / 4) * 4      # 宽，对齐 GRAIN=4 的倍数
fh_px = round(fh*48 / 4) * 4      # footprint 高
W = fw_px
H = fh_px + rise_px
```

`rise_px`（立面/屋顶向北延伸高度）按类别：

| cat | rise_px | 说明 |
|---|---|---|
| teaching / lab / library / college / service / activity | 144 | 3 层教学楼，可见南立面门窗 |
| canteen | 120 | 2–3 层食堂 |
| gym | 96 | 大跨单层，低屋顶 |
| gate | 72 | 门楼/校名石+柱廊 |
| field | 0 | 平地运动场，sprite = footprint 满铺椭圆跑道（无立面） |
| nature（山体） | 200 | 玉屏山为缓坡绿山，向北隆起 |

### 2.3 16 栋资产画布尺寸表（阶段2 接线时直接照抄）

| id | grid [fx,fy,fw,fh] | W×H (px) | 锚点世界坐标 (A.x, A.y) |
|---|---|---|---|
| TEACH-1 | 56.33,197.81,44.31,20.89 | 2128×1148 | (3767.3, 10497.6) |
| TEACH-2 | 62.97,111.72,19.94,17.41 | 956×980 | (3501.1, 6198.2) |
| LIB | 79.43,131.34,17.72,13.61 | 852×796 | (4237.9, 6957.6) |
| WENLI | 104.75,141.47,11.39,12.98 | 548×768 | (5301.4, 7413.6) |
| LAB-TECH | 86.39,159.83,24.69,34.18 | 1184×1784 | (4739.3, 9312.5) |
| CAN-YULAN | 41.45,107.92,7.6,8.86 | 364×544 | (2172.0, 5605.4) |
| CAN-ZIZHU | 24.04,136.72,8.23,12.03 | 396×696 | (1351.4, 7140.0) |
| ENG-TRAIN | 92.72,72.47,22.16,24.06 | 1064×1300 | (4982.4, 4633.4) |
| ACT | 38.6,120.58,16.78,11.08 | 804×676 | (2255.5, 6319.7) |
| GYM | 51.25,224.71,19.64,19.63 | 944×1040 | (2931.4, 11728.3) |
| FIELD-N | 93.99,33.22,14.56,29.75 | 700×1428 | (4861.0, 3022.6) |
| FIELD-W | 12.33,191.16,16.46,29.12 | 792×1396 | (986.9, 10573.4) |
| GATE-S | 76.9,260.5,12.66,5.06 | 608×316 | (3995.0, 12746.9) |
| GATE-E | 114.88,165.52,3.8,6.96 | 184×408 | (5605.4, 8279.0) |
| GATE-W | 4.1,134.5,3.8,7.6 | 184×436 | (288.0, 6820.8) |
| MOUNT-YUPING | 41.45,15.5,43.68,24.69 | 2096×1384 | (3037.9, 1929.1) |

### 2.4 sprite 通用规范

- **透明底 PNG**（RGBA，alpha=0 区域不得有杂边色）。
- **描边**：外轮廓深暖棕 `#2e2418`，宽度 1–2 个艺术像素（即 4–8 世界 px）。
- **像素密度**：内部为 GRAIN=4 世界 px 的硬边像素；放大用 NEAREST，禁止平滑模糊。
- **光照**：顶光偏南（光源来自屏幕下方偏上约 60° 俯角）→ 南立面（图像底部）受光偏暖亮，
  屋顶向北渐暗；投影投向**画面上方偏左**，偏移约 (-2,-3) 艺术像素，柔边、`rgba(40,50,30,0.25)`。
- **禁止**：任何文字、水印、天空、云朵、网格线、照片级写实；不画地面草地（sprite 只画建筑本体+贴地 footprint 边缘）。

---

## 3. 统一调色板（星露谷暖调，已锁定）

| 用途 | 主色 | 暗部 | 亮部 |
|---|---|---|---|
| 草地 base | `#8fbc5a` | `#79a848` | `#a8cf6a` |
| 草地花斑/晒斑 | `#c2e07f`（浅黄绿草斑） | `#668f3d`（深绿阴影草） | — |
| 泥土路 | `#d9b36c` | `#c09a52` | `#eccf90` |
| 硬铺装路 | `#cbb59a` | `#b39c7e` | `#ddc9ad` |
| 湖水/运河 | `#5a9ec4` | `#3f7fa8` | `#8fc4e0` |
| 红瓦屋顶 | `#b84a38` | `#93352a` | `#d2634d` |
| 灰白墙 | `#9aa0a8` | `#7c828b` | `#b9bec6` |
| 白色平屋顶（一教） | `#e9e7e0` | `#c6c3b9` | `#f5f3ec` |
| 红色竖柱 | `#a83c30` | `#822c22` | `#c25240` |
| 木栅栏/木构件 | `#8a6238` | `#6b4a28` | `#a67c4c` |
| 跑道红（田径场） | `#c2503c` | `#a03c2c` | `#d96a52` |
| 足球场绿 | `#5f9e4a` | `#4a7f38` | `#7ab85e` |
| 场线白 | `#ece4d2` | — | — |
| 灯笼柱/点缀 | `#ffd27a` | `#e0a848` | — |
| 统一描边 | `#2e2418` | — | — |

调色板 swatch 图：`03_地图预览器/img/topdown/palette_swatch.png`（TD-0 已产出，批次可对照取色）。

---

## 4. 地面 tile 规范

所有地面 tile 为 **48×48 世界 px 正方形**，可无限平铺，接缝处图案必须连续。

| 文件 | 用途 | 内容 |
|---|---|---|
| `tiles/grass_a.png` | 草地主 tile | base `#8fbc5a`，随机 3–5 格暗 `#79a848` / 亮 `#a8cf6a` 斑点 |
| `tiles/grass_b.png` | 草地变体 | 混入 `#c2e07f` 浅斑，与 grass_a 交替使用避免重复感 |
| `tiles/dirt.png` | 步行泥土路 | `#d9b36c` 底 + `#c09a52` 斑点 |
| `tiles/pave.png` | 车行硬铺装 | `#cbb59a` 底 + 淡淡的 `#b39c7e` 板缝 |
| `tiles/jct.png` | 路口/转弯混合 | 两向路纹渐变混合（可由 dirt/pave 叠加生成） |

**道路铺设规则**（内核已实现，批次无需关心）：
- 数据：`js/topdown_data.js`（由 `02_地图工程/build/gen_topdown_data.py` 从 map_data.json 导出）。
- 每条道路 = gpts 折线 + 宽度 w（网格单位）。对每个整数网格格点，计算到最近路段距离：
  - `< w/2` → 该格为路面；`w ≥ 7` 用 pave tile，否则用 dirt tile；
  - 两条不同道路重叠的格点 → jct tile（路口）。
- 水面（运河 `canal` 折线 + nature 湖泊 gpoly）在草地下方先铺水色，再叠加道路。

---

## 5. 特殊类目处理规范（本阶段只落地 FIELD-N，其余写规范）

- **FIELD-N（北操场）**：top-down 椭圆红色跑道 + 中央足球场，南北长轴（与 footprint 长边一致）；
  透明底，椭圆四角外透明（露出草地）。已在 TD-0 落地为样板。
- **FIELD-W（风雨操场）**：蓝跑道 `#4a7fb8` + 东侧看台（灰色长条 rise=48 即可），内部篮球场；其余同 FIELD-N。
- **GYM（体育馆）**：圆角矩形灰色大屋顶 rise=96，朝南开入口雨棚。
- **GATE-S（南门）**：开放式入口，无门楼——红色大字巨石（校名石）+ 两侧花坛 + 国旗杆 + 红灯笼柱，
  footprint 内全部矮构件，rise=48；开口朝北（校园内），不做封闭门。
- **GATE-E / GATE-W（东/西门）**：车行伸缩门——门柱 + 可收拢的银色栅栏门（内核做开合动画），rise=72。
- **MOUNT-YUPING（玉屏山）**：top-down 缓坡绿色山体，等高线式深浅绿过渡 + 山顶 dome + 散布树冠；
  轮廓沿 nature.gpoly，不画建筑描边，与草地自然过渡。
- **ACT / 食堂 / 实验楼 / 文理楼 / 图书馆 / 二教 / 工程训练**：统一教学楼类规则（第 2 节），
  按航拍参考 f_01..f_08 的红柱灰墙/白屋顶特征绘制。

---

## 6. 目录与命名约定（新资产唯一落点）

```
03_地图预览器/img/topdown/
  sprites/   <建筑 id>.png          例：TEACH-1.png、FIELD-N.png、GATE-S.png
  tiles/     grass_a.png grass_b.png dirt.png pave.png jct.png
  decor/     tree_oak.png fence_h.png fence_v.png gate_panel.png（命名可扩展，但须小写+下划线）
  player/    top-down 角色帧（阶段2 新绘，命名 player_<dir>_<f>.png）
  palette_swatch.png                调色板色卡（已存在，勿覆盖）
```

- 旧 `img/ground.png`、`img/sprites/`、`img/player/` **保留不删**，内核 top-down 不引用。
- 批次交付 = 只在 `img/topdown/` 对应子目录新增 PNG。

---

## 7. 统一生图 prompt 模板（批次直接套用）

### 7.1 建筑类

```
Top-down 2.5D pixel art game sprite, Stardew Valley Harvest Moon style, isolated on solid flat [背景色] background, no ground, no shadow on background.
Subject: 【替换：建筑外形，如 "a long H-shaped university teaching building, red vertical columns and grey walls, flat white roof with rooftop HVAC units, central glass atrium corridor with two green courtyards, grand south entrance plaza with red columns"】
View: straight top-down orthographic, slightly tilted toward the south so the south facade (bottom edge) clearly shows doors and windows; roof occupies most of the frame; building footprint centered.
Palette: warm cartoon colors — red roof #b84a38, grey wall #9aa0a8, off-white roof #e9e7e0, red columns #a83c30, wood #8a6238.
Outline: dark warm-brown outline #2e2418, chunky clean pixels, 1-2px black-brown contour, soft shadow cast toward top-left.
No text, no watermark, no sky, no clouds, no grass, no grid lines.
```

后处理（Pillow，批次必做）：
1. LANCZOS 缩到「画布尺寸/GRAIN」= 逻辑像素分辨率；
2. 按第 3 节调色板量化（MEDIANCUT，colors≈32，无抖动）；
3. 抠背景（四角背景色容差 → alpha=0）；
4. NEAREST×GRAIN 放大到第 2.3 节画布尺寸；
5. 底边中点对齐锚点（2.1）。

### 7.2 地面 tile 类

直接用 Pillow 程序化绘制即可（第 4 节），不必 AI 生图。

### 7.3 装饰类（树/栅栏）

```
Top-down 2.5D pixel art game sprite, Stardew Valley style, isolated on solid flat background, no ground shadow on background.
Subject: 【"a round leafy deciduous tree, lush green canopy #8fbc5a with darker inner leaves, short brown trunk, soft shadow toward top-left"】
Chunku clean pixels, dark warm-brown outline #2e2418, warm palette, no text.
```

---

## 8. 给并行批次（A/B/C/D）的交接

### 8.1 批次分工与允许新增的文件白名单

| 批次 | 负责内容 | 只允许新增（不得改动其他文件） |
|---|---|---|
| **A** | 教学科研建筑 sprite：TEACH-1（已样板，勿重做）、TEACH-2、LIB、WENLI、LAB-TECH、CAN-YULAN、CAN-ZIZHU、ENG-TRAIN、ACT | `img/topdown/sprites/{TEACH-2,LIB,WENLI,LAB-TECH,CAN-YULAN,CAN-ZIZHU,ENG-TRAIN,ACT}.png` |
| **B** | 体育/校门/自然 sprite：FIELD-W、GYM、GATE-S、GATE-E、GATE-W、MOUNT-YUPING（FIELD-N 已样板） | `img/topdown/sprites/{FIELD-W,GYM,GATE-S,GATE-E,GATE-W,MOUNT-YUPING}.png` |
| **C** | 地面 tile + 装饰：tiles/ 全套、decor/ 树木/栅栏/灌木/路灯/花坛 | `img/topdown/tiles/*.png`、`img/topdown/decor/*.png` |
| **D** | 角色帧：top-down chibi 四方向×4 帧 + 跑步帧 | `img/topdown/player/*.png` |

### 8.2 红线（所有批次）

- **禁止修改**：`js/main.js`、`js/data.js`、`js/topdown_data.js`、`index.html`、`server.py`、
  `02_地图工程/build/`、本 `docs/topdown-spec.md`、任何已有文件。
- sprite 与内核的「登记/接线」（把文件名、锚点、footprint 写进 main.js 的建筑表）在**阶段 2 由集成方统一做**，
  批次只管按第 2.3 节尺寸表产出正确命名的 PNG 到白名单路径。
- 若批次认为必须改管线（投影/调色板/tile 规范），先把改动合入本分支 `feat/topdown-stardew` 并 rebase 后再开工。
- 尺寸/风格有疑问时，以 `img/topdown/sprites/TEACH-1.png`、`FIELD-N.png`、`decor/tree_oak.png` 三个样板为基准对齐。

### 8.3 阶段 2 导出方式（集成方参考）

- 建筑 sprite 元数据（文件名/画布/锚点/footprint/depth）由扩展
  `02_地图工程/build/gen_topdown_data.py` 自动产出进 `js/topdown_data.js`；
- `js/data.js` 保持 iso 同源不动；top-down 渲染器读取 `window.TOPDOWN_DATA` + data.js 的 grid/collider/desc。

---

## 9. 内核现状（TD-0 已实现，占位 vs 真实）

已真实可用：方形投影/相机缩放平移触屏、程序化草地 tilemap、按 roads gpts 铺泥土路/硬铺装/路口、
16 栋占位方块（footprint+南立面+深度排序）、方格 BFS 寻路（4+对角不穿墙角）+ AABB 轴分离滑墙、
四方向角色行走/跑步/呼吸 bob/扬尘粒子、FIELD-N 围栏围合+唯一缺口门开合+进入横幅、
建筑名标签、方形小地图、点击信息卡、移动端虚拟摇杆+跑步按钮。

样板资产已落地：`sprites/TEACH-1.png`、`sprites/FIELD-N.png`、`decor/tree_oak.png`、`decor/fence_*.png`。
其余 14 栋为占位方块，待批次 A/B 产出后由阶段 2 替换。

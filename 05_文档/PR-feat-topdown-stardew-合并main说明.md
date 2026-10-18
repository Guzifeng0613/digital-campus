# PR：feat/topdown-stardew 合并 main 说明

## 改了什么

把网页预览器从「等距菱形 iso」整体改造为「星露谷式正俯视 top-down 方形瓦片」像素风数字校园。

### 渲染内核（03_地图预览器/js/main.js）
- **投影废除旧菱形**：world = (gx×48, gy×48)，TILE=48px/网格单位，GRAIN=4px 艺术像素；
- **深度排序**：depth = gy×1000 + gx，建筑 sprite 锚点 = footprint 南缘中点、图像底边对齐；
- **程序化 tilemap 地面**：按 map_data.json roads 真实 gpts 铺泥土路/硬铺装/路口，运河湖泊水面；
- **方格 BFS 寻路**：4+对角（对角不穿墙角）、AABB 轴分离滑墙、卡住检测；
- **角色**：四方向走/跑/idle 帧（D 批 48×64）、走路 bob、跑步前倾、扬尘粒子；
- **场地逻辑**：FIELD-N / FIELD-W 围栏围合 + 唯一入口缺口 + 像素门开合 + 进入横幅；GATE-S 敞开式通行；GATE-E/W 车行伸缩门接近收拢、离开闭合；
- 建筑名标签、方形小地图、点击信息卡（含 top-down 配图）、拖拽/缩放/触屏虚拟摇杆 + 跑步按钮。

### 资产（img/topdown/）
- 16 栋建筑真实 sprite（按 docs/topdown-spec.md 2.3 画布尺寸表）；
- 10 个 48×48 无缝地面 tile、17 个环境 decor、36 帧主角动画；
- 23 色星露谷暖调色板（palette_swatch.png）。

### 数据与规范
- `docs/topdown-spec.md`：并行批次契约（投影/锚点/深度/调色板/命名/prompt 模板/批次白名单）；
- `02_地图工程/build/gen_topdown_data.py`：从 map_data.json + data.js 导出 js/topdown_data.js（道路/运河/自然地块 + 每栋 sprite 元数据）。

## 二轮迭代（路网 + 尺度）
- **路网精修**：按官方图校正为 11 条道路（新增南门轴路/西门支路/风雨操场支路，修正北侧路/樱花道），三门两操场全连通；道路改矢量折线渲染（round join/cap、土路晕边+dirt 纹理、w≥7 硬铺缘石+白虚线）。对比截图 `screenshots_td/roads_beforeafter/`。
- **建筑尺度**：全局 1.5、按 id 覆盖；集成方再把中央楼群 TEACH-1 提至 1.35、LIB/LAB-TECH 提至 1.32（几何 visRect 残留 2–5.5 格重叠在 sprite 透明余量内，目视无立面裁切）；ENG-TRAIN 让至 1.2 以让出 FIELD-N 门通道。对比截图 `screenshots_td/scale_beforeafter/`。
- 最终系数表见下「附：缩放系数表」。

### 附：最终缩放系数表
| 栋 | 系数 | 栋 | 系数 |
|---|---|---|---|
| TEACH-1 | 1.35 | GYM | 1.30 |
| LIB | 1.32 | ENG-TRAIN | 1.20 |
| LAB-TECH | 1.32 | FIELD-N/W | 1.40 |
| TEACH-2/CAN-*/WENLI | 1.50 | GATE-S/E/W | 1.10/1.05/1.05 |
| ACT | 1.30 | MOUNT-YUPING | 1.15 |

## 如何预览

```bash
cd 03_地图预览器
python3 server.py        # 默认 http://127.0.0.1:8090/
```
macOS/Linux 双击 `启动网页端.sh`，Windows 双击 `启动网页端.bat`。开箱 zip：仓库根 `北化数字校园_topdown网页端.zip`（零依赖）。

## 验收点（已 playwright 实测）
- console 无 JS 错误（仅 favicon 404）；
- 16 栋真实 sprite 逐栋渲染、位置/朝向正确；
- 两个操场唯一入口进门横幅、东西伸缩门开合、南门敞开；
- 自动寻路、建筑标签、小地图、信息卡、移动端竖屏摇杆均可用；
- 截图见 `03_地图预览器/screenshots_td/final_*.png`。

## 风险与回滚
- **风险**：小地图在高 DPR 下底色偏白（仅观感，不影响功能）；GATE-W/E 位于校园网格边界外侧，视角扫到边界时会看到界外深色（世界坐标系如此，非 bug）；
- **回滚**：main 分支未变，直接留在 main 即可；本分支所有改动集中在 `03_地图预览器/` 与 `02_地图工程/build/gen_topdown_data.py`，等距旧图 `img/sprites/`、`img/ground.png` 保留未删。

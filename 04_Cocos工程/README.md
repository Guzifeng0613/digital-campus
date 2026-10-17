# 北京化工大学昌平校区 · 等距像素数字校园（Cocos Creator 3.8）

把等距像素校园地图、16 个建筑点位与可行走角色，用**一个引导脚本 `CampusBootstrap`** 在运行时自动生成。
无需在编辑器里逐个拖节点、摆坐标，**只需挂一个脚本**。

## 一、导入工程（二选一）

### 方法 A：直接打开本工程（推荐）
1. 打开 **Cocos Dashboard** → 项目 → **添加** → 选择本文件夹 `04_Cocos工程/`。
2. 选择 Cocos Creator **3.8.x** 打开（首次打开会自动导入资源并生成 `.meta`）。
3. 若提示版本号不完全一致（package.json 写的是 3.8.0），选择“仍要打开”即可，3.8 各小版本兼容。

### 方法 B：拷进你自己的空 2D 项目（兜底，100% 可行）
1. Dashboard 新建一个 **Empty（2D）** 项目。
2. 把本工程 `assets/` 下的三个条目整体拷进新项目的 `assets/`：
   - `assets/resources/`（ground.png + sprites/16 张）
   - `assets/scripts/`（CampusData.ts、IsoMath.ts、CampusBootstrap.ts）
3. 打开新项目自带的 `assets/scenes/main.scene`（没有就 **文件 → 新建场景 Scene**，保存为 `assets/scenes/main.scene`）。

## 二、挂载引导脚本（只做一次）

1. 在 **层级管理器（Hierarchy）** 里右键 **创建 → 空节点（Empty Node）**，命名为 `Campus`。
2. 在 **资源管理器（Assets）** 找到 `assets/scripts/CampusBootstrap.ts`，把它**拖到 `Campus` 节点上**（或在该节点的属性检查器里“添加组件 → 自定义脚本 → CampusBootstrap”）。
3. 保存场景（Ctrl/Cmd + S）。

> 场景里有没有 Canvas 都可以：`CampusBootstrap` 启动时会自动检测并创建 Canvas、正交相机、背景色与地图。
> 若你使用的是 2D 模板自带的 Canvas/Camera，脚本会自动复用。

## 三、运行预览

点击编辑器顶部 **▶ 预览（浏览器）**，即可看到整校园全貌居中，功能与网页预览器一致：

- **地图浏览**：鼠标/触屏拖拽平移；滚轮缩放（以鼠标位置为中心）。
- **点位信息**：点击任意建筑，弹出点位编号 / 名称 / 分类 / 简介。
- **角色行走**：`W A S D` 或方向键控制像素小人（从南门进校）；教学楼、实验楼、体育馆、食堂、校门为实体碰撞（可贴墙），操场、玉屏山可进入；移动时相机自动跟随。
- **按钮**：右上角“跟随角色 / 重置视角”。

## 四、目录结构

```
04_Cocos工程/
├── package.json / tsconfig.json
└── assets/
    ├── resources/                 # 运行时按路径加载（不依赖 .meta UUID）
    │   ├── ground.png             # 透明菱形真实路网底图（9130×4705）
    │   └── sprites/               # 16 个点位透明底建筑图
    └── scripts/
        ├── CampusData.ts          # 【自动生成】地面/投影/16 建筑网格、包围盒、深度、介绍
        ├── IsoMath.ts             # 等距投影、坐标换算、碰撞、初始缩放
        └── CampusBootstrap.ts     # 唯一入口：Canvas/相机/地图/角色/输入/信息UI
```

## 五、数据与坐标

- 数据由 `02_地图工程/build/gen_cocos.py` 从权威数据模型一键导出（`CampusData.ts`、`resources/`）。
- 若后续调整了坐标或资产，在 `02_地图工程/build/` 下依次重跑：
  `gen_map_data.py` → `export_web_assets.py` → `gen_cocos.py`，回到编辑器刷新即可。
- 投影：网格 `(gx,gy)` → 屏幕 `((gx-gy)*22+OX, (gx+gy)*SY+OY)`，单位/常量见 `CampusData.ts` 的 `META`。

## 六、常见问题

- **画面全黑/只有背景**：确认 `resources` 文件夹名字必须是小写 `resources`（Cocos 约定），且资源在 `assets/resources/` 下；打开浏览器控制台看是否有 `resources.load` 404。
- **建筑位置不对**：确认三张图都在 `assets/resources/`、数据是同一次 `gen_cocos.py` 生成。
- **中文显示为方块**：Label 默认用系统字体；在编辑器菜单 **项目 → 项目设置 → 引擎功能管理/字体** 中确认系统字体可用，或在 Bootstrap 的 Label 上指定中文字体。
- **像素放大后发糊**：建筑纹理已设置“放大最近邻、缩小双线性”，无需改动；若想全图锐利，可在 `CampusBootstrap.buildMap` 中把地面的过滤器也改成 `Texture2D.Filter.POINT`。

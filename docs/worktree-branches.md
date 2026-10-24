# Worktree / 分支拓扑（top-down 改造期）

## 工作区与分支

| 路径 | 分支 | HEAD | 角色 |
|---|---|---|---|
| `digital-campus/`（主工作区，只读参考） | `main` | 98b1145 | 等距菱形 iso 线上版 |
| `worktrees/core/` | `feat/topdown-stardew` | e645bcd | **本任务主干**：TD-0 内核 + 4 批次 + TD-5 + 路网/尺度 + 三轮轮廓重画集成 |
| `worktrees/a/` | `feat/td/assets-a` | 739e1b3 | 批次 A：教学/生活 6 栋 sprite |
| `worktrees/b/` | `feat/td/assets-b` | a31378e | 批次 B：体育/山体/实验 5 栋 |
| `worktrees/c/` | `feat/td/assets-c` | e7d654f | 批次 C：3 校门 + 10 地面 tile + decor |
| `worktrees/d/` | `feat/td/assets-d` | a4f202d | 批次 D：主角 36 帧 |
| `worktrees/roads/` | `feat/td/roads` | 9491162 | 二轮：路网按官方图校正（8→11 条）+ 矢量折线渲染 |
| `worktrees/scale/` | `feat/td/scale` | 6584afa | 二轮：建筑全局放大 1.15–1.5 + 全链路碰撞/交互校准 |
| `worktrees/shapes-south/` | `feat/td/shapes-south` | 740a6de | 三轮：南/山体 5 栋轮廓按官方图重画（双遍质检） |
| `worktrees/shapes-central/` | `feat/td/shapes-central` | c57c7a1 | 三轮：中央群 5 栋轮廓按官方图重画（双遍质检） |

## 合并状态（core 分支内，未 push、未合 main）

```
9c0d391  merge(td): 合入资产批次 a
85215a7  merge(td): 合入资产批次 b
96f88bc  merge(td): 合入资产批次 c
c54056a  merge(td): 合入资产批次 d
b334081  merge(td): 合入道路精修（feat/td/roads）
14d57fe  merge(td): 合入建筑放大（feat/td/scale）
a59b7d5  merge(td): 合入轮廓重画-南/山体（feat/td/shapes-south）
ba3c55f  merge(td): 合入轮廓重画-中央群（feat/td/shapes-central）
```

## 关键提交（main..HEAD）

- `e09fc0a` TD-0 正俯视渲染规范 + 网格数据导出脚本（docs/topdown-spec.md）
- `d2927ba` 方形投影渲染内核（占位空壳全功能）
- `cdced34` 3 类样板资产（TEACH-1/FIELD-N/树+围栏）+ 调色板
- `ad2487e` 装饰树深度排序渲染修复 + 抠图粉边清除
- `a4f202d/739e1b3/a31378e/e7d654f` 四批次资产本体
- `23c7ae3` 数据导出扩展每栋 sprite 元数据
- `aaba2e2` TD-5：接入 A/B/C/D 全部资产（16 栋 sprite/美术 tile/装饰/场地逻辑/D 批角色帧）
- `d26db1a` 分支拓扑 + PR 说明 + CHANGELOG + 开箱 zip 打包
- `f6907a3` TD-5 浏览器回归实测 final 截图（12 张，无 JS 错误）
- `b334081/14d57fe` 二轮合入路网精修 + 建筑放大
- `b012eab` 中央楼群尺度再提升（TEACH-1 1.35 / LIB·LAB-TECH 1.32）+ check_scale.py
- `acb1b1f` ENG-TRAIN 降到 1.2 让出 FIELD-N 门通道 + final2/scale 对比截图
- `a59b7d5/ba3c55f` 三轮合入轮廓重画 10 栋（双遍质检）
- `e645bcd` 轮廓重画后 sprite 画布内偏移 dy 校正 + shape 对比 10 组 + final3 16 张
- `1bbe492` 整栋 fit-zoom 重拍（官方局部↔实景对比）
- TD-4 美术轮：8 栋 sprite AI 美术做满+轮廓精修（双盲评 PASS），dy 重算 + 全量回归 + final4 截图

## 红线执行情况

- 未 git push、未合并 main、未部署；
- 未动 `04_Cocos工程`、未碰其他 worktree 与主工作区；
- 网页端保持零依赖（原生 JS + python3 标准库 server.py）。

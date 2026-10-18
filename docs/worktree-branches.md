# Worktree / 分支拓扑（top-down 改造期）

## 工作区与分支

| 路径 | 分支 | HEAD | 角色 |
|---|---|---|---|
| `digital-campus/`（主工作区，只读参考） | `main` | 98b1145 | 等距菱形 iso 线上版 |
| `worktrees/core/` | `feat/topdown-stardew` | f6907a3 | **本任务主干**：TD-0 内核 + 4 批次合入 + TD-5 集成 + 文档/打包 |
| `worktrees/a/` | `feat/td/assets-a` | 739e1b3 | 批次 A：教学/生活 6 栋 sprite（TEACH-2/LIB/WENLI/ACT/CAN-YULAN/CAN-ZIZHU；TEACH-1 为 TD-0 样板未动） |
| `worktrees/b/` | `feat/td/assets-b` | a31378e | 批次 B：体育/山体/实验 5 栋（FIELD-W/GYM/MOUNT-YUPING/LAB-TECH/ENG-TRAIN；FIELD-N 为 TD-0 样板） |
| `worktrees/c/` | `feat/td/assets-c` | e7d654f | 批次 C：3 校门（GATE-S/E/W）+ 10 地面 tile + 13 新增 decor（decor 目录共 17 件含 TD-0 样板） |
| `worktrees/d/` | `feat/td/assets-d` | a4f202d | 批次 D：主角 36 帧（48×64 走/跑/idle） |

## 合并状态（core 分支内，未 push、未合 main）

`feat/topdown-stardew` 已依次 merge 四个资产分支：

```
9c0d391  merge(td): 合入资产批次 a
85215a7  merge(td): 合入资产批次 b
96f88bc  merge(td): 合入资产批次 c
c54056a  merge(td): 合入资产批次 d
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

## 红线执行情况

- 未 git push、未合并 main、未部署；
- 未动 `04_Cocos工程`、未碰其他 worktree 与主工作区；
- 网页端保持零依赖（原生 JS + python3 标准库 server.py）。

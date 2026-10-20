/* 北化昌平校区 · 星露谷式正俯视（top-down 方形瓦片）数字校园 — 浏览器预览器
   方形投影 + 程序化 tilemap 地面 + 深度排序 + 方格 BFS 寻路 + 围栏唯一入口。
   逻辑网格 gx,gy 与投影解耦：world(gx,gy) = (gx*TILE, gy*TILE)。 */
(function () {
  "use strict";
  const D = window.CAMPUS_DATA;
  const TD = window.TOPDOWN_DATA;
  const [GX0, GY0, GX1, GY1] = D.meta.gridRange;

  // ---------- 等距投影（2:1 菱形，星露谷式）：逻辑网格与投影解耦 ----------
  // 逻辑网格 gx(东)/gy(南) 为整数；等距世界坐标：
  //   isoX=(gx-gy)*TW/2（东→右下、南→左下），isoY=(gx+gy)*TH/2（南角在画面最下）。
  const TILE = 48;   // 逻辑参考边长（方形小地图/数据兼容）
  const GRAIN = 4;
  const TW = 64, TH = 32;                 // 等距菱形 tile：宽 64 高 32（2:1）
  const isoX = (gx, gy) => (gx - gy) * TW / 2;
  const isoY = (gx, gy) => (gx + gy) * TH / 2;
  // 世界菱形包围盒（4 个网格角点投影后）
  const _corners = [[GX0, GY0], [GX1, GY0], [GX0, GY1], [GX1, GY1]]
    .map(p => [isoX(p[0], p[1]), isoY(p[0], p[1])]);
  const WORLD_MINX = Math.min(..._corners.map(p => p[0]));
  const WORLD_MAXX = Math.max(..._corners.map(p => p[0]));
  const WORLD_MINY = Math.min(..._corners.map(p => p[1]));
  const WORLD_MAXY = Math.max(..._corners.map(p => p[1]));
  const WORLD_W = WORLD_MAXX - WORLD_MINX;   // 菱形包围盒宽
  const WORLD_H = WORLD_MAXY - WORLD_MINY;   // 菱形包围盒高
  const WORLD_CX = (WORLD_MINX + WORLD_MAXX) / 2;
  const WORLD_CY = (WORLD_MINY + WORLD_MAXY) / 2;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const mmCanvas = document.getElementById("minimap");
  const mmCtx = mmCanvas.getContext("2d");
  const MM_W = mmCanvas.width, MM_H = mmCanvas.height;
  const GROUP_COLOR = {
    teaching: "#e8766b", public: "#f0b24c", sports: "#5fb4d6",
    dining: "#7bd18a", gate: "#c9a0dc", nature: "#8fbf7f"
  };

  // ---------- 视图状态 ----------
  const view = { x: 0, y: 0, zoom: 0.065 };
  let follow = false;
  function fitZoom() {
    // 建筑放大后向北(上)扩展，多留一点纵向留白避免边缘被裁
    return Math.min(window.innerWidth * 0.92 / WORLD_W, window.innerHeight * 0.90 / WORLD_H);
  }
  function centerView() {
    view.zoom = fitZoom();
    view.x = window.innerWidth / 2 - WORLD_CX * view.zoom;
    // 竖屏（手机）等距菱形按宽铺满后上下留白，垂直居中；横屏/桌面偏下 0.62 视觉居中
    const portrait = window.innerHeight > window.innerWidth;
    view.y = window.innerHeight * (portrait ? 0.5 : 0.62) - WORLD_CY * view.zoom;
  }
  const w2sX = wx => wx * view.zoom + view.x;
  const w2sY = wy => wy * view.zoom + view.y;
  const s2wX = sx => (sx - view.x) / view.zoom;
  const s2wY = sy => (sy - view.y) / view.zoom;
  const gridToWorld = (gx, gy) => ({ x: isoX(gx, gy), y: isoY(gx, gy) });
  const worldToGrid = (wx, wy) => {
    const A = 2 * wx / TW, B = 2 * wy / TH;   // A=gx-gy, B=gx+gy
    return { gx: (A + B) / 2, gy: (B - A) / 2 };
  };
  // 网格 footprint 矩形 -> 等距菱形 4 角（西北/东北/南/西南）
  function isoDiamond(fx, fy, fw, fh) {
    return [
      { x: isoX(fx, fy), y: isoY(fx, fy) },                       // 西北（最上）
      { x: isoX(fx + fw, fy), y: isoY(fx + fw, fy) },             // 东北（右）
      { x: isoX(fx + fw, fy + fh), y: isoY(fx + fw, fy + fh) },   // 南（最下）
      { x: isoX(fx, fy + fh), y: isoY(fx, fy + fh) }              // 西南（左）
    ];
  }

  // ---------- 逻辑 footprint（碰撞/寻路/围栏/小地图）：等距下贴合真实地块 ----------
  const LOGIC_SCALE_ID = {}; // 可逐栋微调，默认 1
  function buildingScale(b) {
    return LOGIC_SCALE_ID[b.id] != null ? LOGIC_SCALE_ID[b.id] : 1;
  }
  // 逻辑视觉 footprint（网格单位）：南缘 y=fy+fh 不变，向北扩展
  function visRect(b) {
    const s = buildingScale(b);
    const [fx, fy, fw, fh] = b.grid;
    const nfw = fw * s, nfh = fh * s;
    const cx = fx + fw / 2;
    return { x: cx - nfw / 2, y: (fy + fh) - nfh, w: nfw, h: nfh, s };
  }
  // 点击命中盒：用逻辑 footprint 网格矩形（等距逆变换后判断）
  function clickRect(b) { return visRect(b); }
  // 碰撞矩形集合：主 footprint + 可选的 b.colliders（网格绝对坐标矩形数组）。
  // colliders 用于补足 3/4 立体 sprite 的高墙立面在屏幕向下延伸、单矩形覆盖不到的区域（如异形弯月两翼南墙）。
  function blockRects(b) {
    const rects = [visRect(b)];
    if (b.colliders) for (const c of b.colliders) rects.push({ x: c[0], y: c[1], w: c[2], h: c[3] });
    return rects;
  }
  function hitRect(gx, gy, r, pad) {
    return gx > r.x - pad && gx < r.x + r.w + pad && gy > r.y - pad && gy < r.y + r.h + pad;
  }
  function blockBounds(b) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of blockRects(b)) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ---------- 等距 sprite 视觉几何（图像→等距世界） ----------
  // 每栋南角在图像中的归一化锚点：ax=水平中心（南角），ay=主体南墙根所在高度（避开南伸台阶）。
  // ay = 南墙根/场地南缘（地面接地点）在图像高度的归一化位置，锚到 footprint 南角。
  const ANCHOR_AY = {
    "FIELD-W": 0.704, "GYM": 0.99, "TEACH-1": 0.99, "LAB-TECH": 0.98, "GATE-S": 0.97,
    "GATE-E": 0.92, "LIB": 0.99, "WENLI": 0.95, "TEACH-2": 0.97, "ACT": 0.85,
    "CAN-YULAN": 1.0, "CAN-ZIZHU": 0.94, "ENG-TRAIN": 0.96, "FIELD-N": 1.053,
    "MOUNT-YUPING": 1.0, "GATE-W": 0.81
  };
  // ax = 南角（最近角，南墙↔东墙交汇）在图像宽度的归一化位置；标准等距矩形=fw/(fw+fh)，异形/台阶楼目视微调
  const ANCHOR_AX = {
    "FIELD-W": 0.335, "GYM": 0.50, "TEACH-1": 0.75, "LAB-TECH": 0.51, "GATE-S": 0.71,
    "GATE-E": 0.35, "LIB": 0.57, "WENLI": 0.47, "TEACH-2": 0.53, "ACT": 0.60,
    "CAN-YULAN": 0.46, "CAN-ZIZHU": 0.41, "ENG-TRAIN": 0.48, "FIELD-N": 0.372,
    "MOUNT-YUPING": 0.64, "GATE-W": 0.33
  };
  const ISO_K = {
    "MOUNT-YUPING": 0.95, "FIELD-W": 0.87, "FIELD-N": 0.741,
    "TEACH-1": 1.0, "LAB-TECH": 1.0, "GYM": 1.0, "ACT": 1.0, "ENG-TRAIN": 1.0,
    "LIB": 1.0, "WENLI": 1.0, "TEACH-2": 1.0, "CAN-YULAN": 1.0, "CAN-ZIZHU": 1.0,
    "GATE-S": 1.05, "GATE-E": 1.05, "GATE-W": 1.05
  }; // 重标定：sprite 贴合官方真实 footprint，保留建筑间相对距离
  function spriteIsoScale(b, real) {
    const [, , fw, fh] = b.grid;
    const ov = window.__anchorOverride && window.__anchorOverride[b.id];
    const k = ov && ov.k != null ? ov.k : (ISO_K[b.id] != null ? ISO_K[b.id] : 1.1);
    return (fw + fh) * TW / 2 * k / real.width;
  }
  // 返回南角世界坐标、归一化锚点、图像缩放后的世界宽高
  function spriteAnchor(b, real) {
    const [fx, fy, fw, fh] = b.grid;
    const sc = spriteIsoScale(b, real);
    const south = isoDiamond(fx, fy, fw, fh)[2];
    const ov = window.__anchorOverride && window.__anchorOverride[b.id];
    const ax = ov && ov.ax != null ? ov.ax : (ANCHOR_AX[b.id] != null ? ANCHOR_AX[b.id] : 0.5);
    const ay = ov && ov.ay != null ? ov.ay : (ANCHOR_AY[b.id] != null ? ANCHOR_AY[b.id] : 0.95);
    return { x: south.x, y: south.y, ax, ay, pxW: real.width * sc, pxH: real.height * sc, sc };
  }

  // ---------- 地面 tile（C 批次美术 tile，48×48 无缝 PNG，BOOT 时加载） ----------
  // 0 grass_a, 1 grass_b, 2 dirt, 3 pave, 4 jct, 5 water
  const TILE_ORDER = ["grass_a", "grass_b", "dirt", "pave", "jct", "water"];
  const TILES = {};
  function tileImg(t) { return TILES[t] || TILES.grass_a; }

  // ---------- 格点分类（整数网格 -> tile 类型） ----------
  // 0 grass_a, 1 grass_b, 2 dirt, 3 pave, 4 jct, 5 water
  const ix0 = Math.floor(GX0), iy0 = Math.floor(GY0);
  const ix1 = Math.ceil(GX1), iy1 = Math.ceil(GY1);
  const cw = ix1 - ix0 + 1, ch = iy1 - iy0 + 1;
  const cellType = new Uint8Array(cw * ch);
  function ci(gx, gy) { return (gy - iy0) * cw + (gx - ix0); }
  function stampPoly(poly, type) {
    // 射线法填充格点
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const minX = Math.max(ix0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(ix1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(iy0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(iy1, Math.ceil(Math.max(...ys)));
    for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > gy + 0.5) !== (yj > gy + 0.5) && gx + 0.5 < (xj - xi) * (gy + 0.5 - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) cellType[ci(gx, gy)] = type;
    }
  }
  function stampRect(r, type) {
    const [fx, fy, fw, fh] = r;
    for (let gx = Math.max(ix0, Math.floor(fx)); gx <= Math.min(ix1, Math.ceil(fx + fw)); gx++)
      for (let gy = Math.max(iy0, Math.floor(fy)); gy <= Math.min(iy1, Math.ceil(fy + fh)); gy++)
        cellType[ci(gx, gy)] = type;
  }
  // 直线带状填充（运河），直接写 type，不计入道路
  function distToSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    let t = ((px - a[0]) * dx + (py - a[1]) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function stampBand(points, halfW, type) {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1];
      const minX = Math.max(ix0, Math.floor(Math.min(a[0], b[0]) - halfW));
      const maxX = Math.min(ix1, Math.ceil(Math.max(a[0], b[0]) + halfW));
      const minY = Math.max(iy0, Math.floor(Math.min(a[1], b[1]) - halfW));
      const maxY = Math.min(iy1, Math.ceil(Math.max(a[1], b[1]) + halfW));
      for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
        if (distToSeg(gx + 0.5, gy + 0.5, a, b) <= halfW) cellType[ci(gx, gy)] = type;
      }
    }
  }
  (function buildCells() {
    // 基底草地（按 hash 交替 a/b）
    for (let gx = ix0; gx <= ix1; gx++) for (let gy = iy0; gy <= iy1; gy++)
      cellType[ci(gx, gy)] = ((gx * 7 + gy * 13) % 5 === 0) ? 1 : 0;
    // 自然地块：湖泊/运河=水，礼仪草坪/绿带=浅草
    for (const n of TD.nature) {
      if (n.cat === "water" || n.id.indexOf("LAKE") >= 0) {
        if (n.shape === "poly" && n.gpoly.length) stampPoly(n.gpoly, 5);
        else if (n.grid) stampRect(n.grid, 5);
      } else if (n.shape === "rect" && n.grid) {
        stampRect(n.grid, 0);   // 草坪保持草色
      }
    }
    if (TD.canal && TD.canal.length) stampBand(TD.canal, 1.8, 5);  // 运河=水面
    // 道路不再盖进格点：由 paintRoadLayer 矢量绘制（先水后路，与 buildPre/近景同一套）
  })();

  // ---------- 方形世界尺寸（仅供小地图俯视） ----------
  const SQ_W = (GX1 - GX0) * TILE;
  const SQ_H = (GY1 - GY0) * TILE;

  // ---------- 道路：等距折线（主地面）与方形折线（小地图）两套 ----------
  function traceRoadIso(g, gpts) {
    g.beginPath();
    for (let i = 0; i < gpts.length; i++) {
      const x = isoX(gpts[i][0], gpts[i][1]), y = isoY(gpts[i][0], gpts[i][1]);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
  }
  function traceRoadSq(g, gpts) {
    g.beginPath();
    for (let i = 0; i < gpts.length; i++) {
      const x = gpts[i][0] * TILE, y = gpts[i][1] * TILE;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
  }
  function paintRoadsIso(g) {
    g.lineJoin = "round"; g.lineCap = "round";
    for (const r of TD.roads) {
      if (r.paved) continue;
      const w = r.w * TH * 1.05;
      traceRoadIso(g, r.gpts); g.strokeStyle = "rgba(124,96,56,0.22)"; g.lineWidth = w + 14; g.stroke();
      traceRoadIso(g, r.gpts); g.strokeStyle = "rgba(150,119,74,0.40)"; g.lineWidth = w + 7; g.stroke();
      traceRoadIso(g, r.gpts); g.strokeStyle = "#c8ac78"; g.lineWidth = w; g.stroke();
      traceRoadIso(g, r.gpts); g.strokeStyle = "rgba(216,194,148,0.55)"; g.lineWidth = w * 0.42; g.stroke();
    }
    for (const r of TD.roads) {
      if (!r.paved) continue;
      const w = r.w * TH * 1.05;
      traceRoadIso(g, r.gpts); g.strokeStyle = "#9a9990"; g.lineWidth = w + 9; g.stroke();
      traceRoadIso(g, r.gpts); g.strokeStyle = "#cdccc4"; g.lineWidth = w; g.stroke();
      traceRoadIso(g, r.gpts); g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = Math.max(1.5, 0.22 * TH);
      g.setLineDash([TH * 1.2, TH * 1.6]); g.stroke(); g.setLineDash([]);
    }
  }
  function paintRoadsSq(g) {
    g.lineJoin = "round"; g.lineCap = "round";
    for (const r of TD.roads) {
      if (r.paved) continue;
      const w = r.w * TILE;
      traceRoadSq(g, r.gpts); g.strokeStyle = "rgba(146,116,72,0.25)"; g.lineWidth = w + 2 * TILE; g.stroke();
      traceRoadSq(g, r.gpts); g.strokeStyle = "#b08d57"; g.lineWidth = w; g.stroke();
    }
    for (const r of TD.roads) {
      if (!r.paved) continue;
      const w = r.w * TILE;
      traceRoadSq(g, r.gpts); g.strokeStyle = "#a8a79d"; g.lineWidth = w + 0.9 * TILE; g.stroke();
      traceRoadSq(g, r.gpts); g.strokeStyle = "#c8c7bd"; g.lineWidth = w; g.stroke();
    }
  }

  // ---------- 等距主地面（一次性预渲染：菱形草 + 水 + 等距道路） ----------
  const ISOPRE = 0.55;
  const isoGround = document.createElement("canvas");
  isoGround.width = Math.ceil(WORLD_W * ISOPRE);
  isoGround.height = Math.ceil(WORLD_H * ISOPRE);
  function diamondPath(g, gx, gy, cw, ch) {
    g.beginPath();
    g.moveTo(isoX(gx, gy) - WORLD_MINX, isoY(gx, gy) - WORLD_MINY);
    g.lineTo(isoX(gx + cw, gy) - WORLD_MINX, isoY(gx + cw, gy) - WORLD_MINY);
    g.lineTo(isoX(gx + cw, gy + ch) - WORLD_MINX, isoY(gx + cw, gy + ch) - WORLD_MINY);
    g.lineTo(isoX(gx, gy + ch) - WORLD_MINX, isoY(gx, gy + ch) - WORLD_MINY);
    g.closePath();
  }
  function buildIsoGround() {
    const g = isoGround.getContext("2d");
    g.setTransform(ISOPRE, 0, 0, ISOPRE, 0, 0);
    for (let gx = ix0; gx < ix1; gx++) for (let gy = iy0; gy < iy1; gy++) {
      const t = cellType[ci(gx, gy)];
      if (t === 5) {
        const d = (gx * 3 + gy * 7) % 4;
        g.fillStyle = ["#579bd6", "#5fa0da", "#5597d2", "#63a6dc"][d];
      } else {
        const d = (gx * 7 + gy * 13) % 9;
        g.fillStyle = d === 0 ? "#8ab858" : d === 1 ? "#86b252" : d === 2 ? "#92c05e" : "#88b554";
      }
      diamondPath(g, gx, gy, 1, 1); g.fill();
    }
    // 等距道路（世界坐标）
    g.setTransform(ISOPRE, 0, 0, ISOPRE, -WORLD_MINX * ISOPRE, -WORLD_MINY * ISOPRE);
    paintRoadsIso(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- 方形小地图地面（俯视，低分辨率） ----------
  const MMPRE = 0.16;
  const mmGround = document.createElement("canvas");
  mmGround.width = Math.ceil(SQ_W * MMPRE);
  mmGround.height = Math.ceil(SQ_H * MMPRE);
  function buildMmGround() {
    const g = mmGround.getContext("2d");
    g.fillStyle = "#8fbc5a"; g.fillRect(0, 0, mmGround.width, mmGround.height);
    const tw = TILE * MMPRE;
    for (let gx = ix0; gx <= ix1; gx++) for (let gy = iy0; gy <= iy1; gy++) {
      const t = cellType[ci(gx, gy)];
      if (t === 5) g.fillStyle = "#5aa0d6";
      else g.fillStyle = ((gx * 7 + gy * 13) % 5 === 0) ? "#88b454" : "#8fbc5a";
      g.fillRect((gx - GX0) * tw, (gy - GY0) * tw, tw + 1, tw + 1);
    }
    g.setTransform(MMPRE, 0, 0, MMPRE, -GX0 * TILE * MMPRE, -GY0 * TILE * MMPRE);
    paintRoadsSq(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- 资产加载（16 栋 sprite / C 批 tiles+decor / D 批角色帧） ----------
  const TOTAL_ASSETS = 16 + 10 + 14 + 4 * 9;   // sprite + tiles + decor + 角色帧
  let loadedN = 0;
  function tick() {
    loadedN++;
    const pct = Math.min(100, Math.round(loadedN / TOTAL_ASSETS * 100));
    const pe = document.getElementById("pct");
    const pf = document.getElementById("pfill");
    if (pe) pe.textContent = pct + "%";
    if (pf) pf.style.width = pct + "%";
  }
  // 带重试的图片加载：线上 CDN 偶发慢/超时会导致建筑永久缺失，失败后递增延时重试
  function loadImageRetry(src, tries) {
    tries = tries || 3;
    return new Promise(res => {
      let n = 0;
      const attempt = () => {
        const im = new Image();
        im.onload = () => { tick(); res(im); };
        im.onerror = () => {
          n++;
          if (n < tries) setTimeout(attempt, 500 * n);
          else { tick(); res(null); }
        };
        im.src = src + (n ? (src.indexOf("?") >= 0 ? "&r=" : "?r=") + n : "");
      };
      attempt();
    });
  }
  function loadImg(src) { return loadImageRetry(src); }
  const spriteImgs = {};
  const SPRITE_IDS = ["TEACH-1", "TEACH-2", "LIB", "WENLI", "LAB-TECH", "ACT",
    "CAN-YULAN", "CAN-ZIZHU", "ENG-TRAIN", "GYM", "FIELD-W", "FIELD-N",
    "MOUNT-YUPING", "GATE-S", "GATE-E", "GATE-W"];
  const DECOR_IDS = ["tree_pine", "tree_oak", "tree_oak_b", "tree_bush", "fence_corner",
    "lamp", "lantern_post", "flagpole", "bollard", "bench", "flowerbed",
    "flowerbed_corner", "shrub_a", "shrub_b"];
  const TILE_IDS = ["grass_a", "grass_b", "dirt", "pave", "water", "jct",
    "jct_cross", "jct_t", "grass_dirt_edge", "grass_pave_edge"];
  const BOOT = Promise.all([
    ...SPRITE_IDS.map(id => loadImg("img/topdown/sprites/" + id + ".png").then(im => spriteImgs[id] = im)),
    ...TILE_IDS.map(t => loadImg("img/topdown/tiles/" + t + ".png").then(im => TILES[t] = im)),
    ...DECOR_IDS.map(t => loadImg("img/topdown/decor/" + t + ".png").then(im => spriteImgs[t] = im))
  ]).then(() => { buildIsoGround(); buildMmGround(); buildFences(); buildSpriteTops(); });

  // ---------- D 批角色帧：48×64，锚点脚底中心 (24,64) ----------
  const FRAME_W = 48, FRAME_H = 64;
  const PLAYER_SCALE = 1.7;   // 等距下人物再放大一点（星露谷饱满比例）
  const PLAYER_DIRS = ["down", "up", "left", "right"];
  const frames = {};   // frames[dir][kind] = [img...]  kind: walk/run/idle
  function loadFrame(dir, kind, f) {
    return loadImageRetry("img/topdown/player/" + dir + "_" + kind + (f === null ? "" : "_" + f) + ".png");
  }
  const playerLoad = Promise.all(PLAYER_DIRS.map(dir =>
    Promise.all([
      Promise.all([0, 1, 2, 3].map(f => loadFrame(dir, "walk", f))),
      Promise.all([0, 1, 2, 3].map(f => loadFrame(dir, "run", f))),
      loadFrame(dir, "idle", null)
    ]).then(([w, r, idl]) => { frames[dir] = { walk: w, run: r, idle: [idl] }; })
  ));

  // ---------- 角色（内部坐标用逻辑网格 gx,gy，绘制时投影等距） ----------
  const GATE_S = D.buildings.find(b => b.id === "GATE-S");
  const start = { x: GATE_S.grid[0] + GATE_S.grid[2] / 2, y: GATE_S.grid[1] - 6 };
  const WALK_SPEED = 7.2, JOG_SPEED = 10.8, RUN_SPEED = 14.0;   // 格/秒
  const playerScreen = () => ({ sx: w2sX(isoX(player.wx, player.wy)), sy: w2sY(isoY(player.wx, player.wy)) });
  const player = {
    wx: start.x, wy: start.y, phase: 0, idleT: 0, moving: false,
    running: false, runLock: false, facing: "down", dustT: 0,
    navPath: null, navName: "", mvx: 0, mvy: 1
  };
  const dust = [];
  function spawnDust() {
    dust.push({
      x: player.wx - player.mvx * 0.28 + (Math.random() - 0.5) * 0.18,
      y: player.wy - player.mvy * 0.28 + (Math.random() - 0.5) * 0.18,
      vx: -player.mvx * 0.6 + (Math.random() - 0.5) * 0.4,
      vy: -player.mvy * 0.6 + (Math.random() - 0.5) * 0.4,
      life: 0.5, max: 0.5, s: 2 + Math.random() * 2
    });
  }
  function updateDust(dt) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i]; p.life -= dt;
      if (p.life <= 0) { dust.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
    }
  }
  const keys = {};
  const stick = { x: 0, y: 0, mag: 0 };
  const PAD = 1.0;

  // ---------- 场地围栏 + 唯一入口（网格坐标，与投影无关） ----------
  const FENCE_WALL = 1.0, GATE_HALF = 3.3;
  const FIELDS = [
    { id: "FIELD-N", gateSide: "gymax", gateT: 0.52, zone: "北操场", sRx: 610, sRy: 282, sAng: -0.346, gatePhi: 2.795 },
    { id: "FIELD-W", gateSide: "gymax", gateT: 0.5, zone: "风雨操场", sRx: 525, sRy: 250, sAng: -0.353, gatePhi: 2.789 }
  ];
  const GATE_ANG = { gxmax: 0, gymax: Math.PI / 2, gxmin: Math.PI, gymin: -Math.PI / 2 };
  const fences = [];   // 图片加载后由 buildFences() 填充（椭圆半径需乘 sprite 缩放）
  function buildFences() {
  const built = FIELDS.map(cfg => {
    const b = D.buildings.find(x => x.id === cfg.id);
    const r = visRect(b);            // 围栏随放大后场地
    const fx = r.x, fy = r.y, fw = r.w, fh = r.h;
    const ccx = fx + fw / 2 + (cfg.fdx || 0), ccy = fy + fh / 2 + (cfg.fdy || 0);
    const R = (cfg.fR || Math.min(fw, fh) / 2);    // 逻辑圆半径（回退/碰撞）
    const ang = GATE_ANG[cfg.gateSide];
    const useScreen = cfg.sRx && cfg.sRy;
    const sAng = cfg.sAng || 0;
    // 椭圆 sRx/sRy 按图像像素标定，绘制/碰撞在世界像素 → 乘 sprite 缩放 sc
    const fReal = spriteImgs[cfg.id];
    const fsc = fReal ? spriteIsoScale(b, fReal) : 1;
    const sRx = cfg.sRx ? cfg.sRx * fsc : null;
    const sRy = cfg.sRy ? cfg.sRy * fsc : null;
    // 门方向：屏幕椭圆用世界屏幕角（等距变换，可由 gatePhi 精确覆盖）；逻辑圆用网格角
    let phi;
    if (cfg.gatePhi != null) phi = cfg.gatePhi;
    else if (useScreen) phi = Math.atan2(16 * Math.cos(ang) + 16 * Math.sin(ang), 32 * Math.cos(ang) - 32 * Math.sin(ang));
    else phi = ang;
    let gcx, gcy, gapHalf;
    if (useScreen) {
      const aG = phi - sAng, cosA = Math.cos(sAng), sinA = Math.sin(sAng);
      const ex = sRx * Math.cos(aG), ey = sRy * Math.sin(aG);
      const csx = (ccx - ccy) * 32, csy = (ccx + ccy) * 16;
      const msx = csx + ex * cosA - ey * sinA, msy = csy + ex * sinA + ey * cosA;
      gcx = (msx / 32 + msy / 16) / 2; gcy = (msy / 16 - msx / 32) / 2;
      const gR = Math.hypot(ex, ey);
      gapHalf = Math.max(0.16, (GATE_HALF * 22) / gR);
    } else {
      gcx = ccx + R * Math.cos(ang); gcy = ccy + R * Math.sin(ang);
      gapHalf = Math.asin(Math.min(0.98, GATE_HALF / R));
    }
    return { id: cfg.id, b, rect: [fx, fy, fw, fh], ccx, ccy, R, zone: cfg.zone,
      sRx, sRy, sAng, phi, gapHalf,
      g: { side: cfg.gateSide, ang, cx: gcx, cy: gcy, dx: Math.cos(ang), dy: Math.sin(ang) }, open: 0, inside: false };
  });
  fences.length = 0; fences.push(...built);
  }
  // 各 sprite 实体顶行（排除透明留白与灯杆/旗杆等细高装饰），用于标签贴实体顶部
  const spriteTop = {};
  function buildSpriteTops() {
    for (const id of SPRITE_IDS) {
      const real = spriteImgs[id]; if (!real) continue;
      const c = document.createElement("canvas"); c.width = real.width; c.height = real.height;
      const g = c.getContext("2d"); g.drawImage(real, 0, 0);
      const d = g.getImageData(0, 0, real.width, real.height).data, W = real.width, H = real.height;
      const rowCnt = y => { let n = 0; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) n++; return n; };
      const need = Math.max(6, Math.round(W * 0.02));
      let row = -1;
      for (let y = 0; y < H; y++) {
        if (rowCnt(y) >= need && (y + 1 >= H || rowCnt(y + 1) >= need)) { row = y; break; }
      }
      if (row < 0) { spriteTop[id] = { row: 0, cx: W / 2 }; continue; }
      let sumx = 0, cnt = 0;
      for (let y = row; y < Math.min(H, row + 10); y++)
        for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { cnt++; sumx += x; }
      spriteTop[id] = { row, cx: cnt ? sumx / cnt : W / 2 };
    }
  }
  // 屏幕椭圆归一化：返回 d（边界=1）与椭圆参数角 alpha
  function ellNorm(F, gx, gy) {
    const sAng = F.sAng || 0, cosA = Math.cos(sAng), sinA = Math.sin(sAng);
    const dx = (gx - gy) * 32 - (F.ccx - F.ccy) * 32, dy = (gx + gy) * 16 - (F.ccx + F.ccy) * 16;
    const lx = dx * cosA + dy * sinA, ly = -dx * sinA + dy * cosA;
    return { d: Math.hypot(lx / F.sRx, ly / F.sRy), alpha: Math.atan2(ly / F.sRy, lx / F.sRx) };
  }
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  function inGap(gx, gy, F) {
    return Math.hypot(gx - F.g.cx, gy - F.g.cy) < GATE_HALF + 0.6;
  }
  function fenceBlocked(gx, gy, F) {
    if (F.sRx && F.sRy) {
      const { d, alpha } = ellNorm(F, gx, gy);
      if (d > 1.07 || d < 0.93) return false;
      if (Math.abs(angDiff(alpha, F.phi - F.sAng)) < F.gapHalf) return false;
      return true;
    }
    const w = FENCE_WALL;
    const d = Math.hypot(gx - F.ccx, gy - F.ccy);
    if (d > F.R + w || d < F.R - w) return false;
    return !inGap(gx, gy, F);
  }
  function insideField(gx, gy, F) {
    if (F.sRx && F.sRy) return ellNorm(F, gx, gy).d < 0.92;
    return Math.hypot(gx - F.ccx, gy - F.ccy) < F.R - 0.6;
  }
  // ---------- 东西校门伸缩门（闭合阻挡 / 接近收拢放行） ----------
  const campusGates = ["GATE-E", "GATE-W"].map(id => {
    const b = D.buildings.find(x => x.id === id);
    const r = visRect(b);
    return { id, b, open: 0, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  });
  function blockedAt(gx, gy, pad) {
    if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
    for (const b of D.buildings) {
      if (b.walkable) continue;
      if (b.id === "GATE-E" || b.id === "GATE-W") continue;   // 校门由伸缩门逻辑控制
      for (const r of blockRects(b)) if (hitRect(gx, gy, r, pad)) return true;
    }
    for (const F of fences) if (fenceBlocked(gx, gy, F)) return true;
    for (const g of campusGates) {
      // 校门闭合时阻挡放大后视觉 footprint；收拢 open 后放行
      if (g.open > 0.5) continue;
      const r = visRect(g.b);
      if (gx > r.x - pad && gx < r.x + r.w + pad && gy > r.y - pad && gy < r.y + r.h + pad) return true;
    }
    return false;
  }

  // ---------- 方格 BFS 寻路（4+对角，对角不穿墙角） ----------
  const NAV_PAD = 1.2;
  const MOVES = [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2]];
  function navBlocked(gx, gy) { return blockedAt(gx, gy, NAV_PAD); }
  function bfs(sg, tg) {
    const U0 = Math.round(sg.gx / 2) * 2, V0 = Math.round(sg.gy / 2) * 2;
    const U1 = Math.round(tg.gx / 2) * 2, V1 = Math.round(tg.gy / 2) * 2;
    if (navBlocked(U1, V1)) return null;
    const k = (u, v) => u + "," + v;
    const queue = [[U0, V0]]; let head = 0;
    const prev = new Map([[k(U0, V0), null]]);
    let found = false;
    while (head < queue.length) {
      const [u, v] = queue[head++];
      if (u === U1 && v === V1) { found = true; break; }
      for (const [du, dv] of MOVES) {
        const nu = u + du, nv = v + dv;
        if (navBlocked(nu, nv)) continue;
        if (du && dv && (navBlocked(u + du, v) || navBlocked(u, v + dv))) continue; // 不穿墙角
        if (prev.has(k(nu, nv))) continue;
        prev.set(k(nu, nv), [u, v]);
        queue.push([nu, nv]);
      }
    }
    if (!found) return null;
    const path = []; let cur = [U1, V1];
    while (cur) { path.push([cur[0], cur[1]]); cur = prev.get(k(cur[0], cur[1])); }
    path.reverse();
    return path;
  }
  function fieldContaining(gx, gy) {
    for (const F of fences) if (insideField(gx, gy, F)) return F;
    return null;
  }
  // 穿门寻路：起点/终点若在围栏场地内，强制路径经过精确门点（避免偶数网格从缺口旁擦过）
  function bfsToTarget(sg, tg) {
    const sF = fieldContaining(sg.gx, sg.gy), tF = fieldContaining(tg.gx, tg.gy);
    if (!sF && !tF) return bfs(sg, tg);
    const F = tF || sF, g = F.g;
    const dgx = g.cx - F.ccx, dgy = g.cy - F.ccy, gl = Math.hypot(dgx, dgy) || 1;
    const ux = dgx / gl, uy = dgy / gl, off = 2.6;
    const outE = { gx: Math.round((g.cx + ux * off) / 2) * 2, gy: Math.round((g.cy + uy * off) / 2) * 2 };
    const innE = { gx: Math.round((g.cx - ux * off) / 2) * 2, gy: Math.round((g.cy - uy * off) / 2) * 2 };
    const gate = [g.cx, g.cy];
    if (tF) {
      const p1 = bfs(sg, outE), p2 = bfs(innE, tg);
      if (!p1 || !p2) return null;
      return [...p1, gate, ...p2.slice(1)];
    } else {
      const p1 = bfs(sg, innE), p2 = bfs(outE, tg);
      if (!p1 || !p2) return null;
      return [...p1, gate, ...p2.slice(1)];
    }
  }
  function nearestOpen(gx, gy) {
    const pg = { gx: player.wx, gy: player.wy };
    if (!navBlocked(gx, gy)) return { gx, gy };
    for (let ring = 1; ring <= 12; ring++) {
      let best = null, bd = Infinity;
      for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = gx + dx * 2, y = gy + dy * 2;
        if (navBlocked(x, y)) continue;
        const d = Math.hypot(x - pg.gx, y - pg.gy);
        if (d < bd) { bd = d; best = { gx: x, gy: y }; }
      }
      if (best) return best;
    }
    return null;
  }
  function openSpotsAround(b) {
    const bb = blockBounds(b);
    const gx = bb.x, gy = bb.y, gw = bb.w, gh = bb.h;
    const m = 2.6, step = 2, pts = [];
    for (let x = gx - m; x <= gx + gw + m; x += step) {
      pts.push({ gx: x, gy: gy - m }); pts.push({ gx: x, gy: gy + gh + m });
    }
    for (let y = gy - m; y <= gy + gh + m; y += step) {
      pts.push({ gx: gx - m, gy: y }); pts.push({ gx: gx + gw + m, gy: y });
    }
    // 自定义碰撞矩形（南墙立面补块）的南缘正前方各加一个候选点，保证台阶凹处也有停靠点
    if (b.colliders) for (const c of b.colliders) pts.push({ gx: c[0] + c[2] / 2, gy: c[1] + c[3] + m });
    const pg = { gx: player.wx, gy: player.wy };
    return pts.filter(p => !navBlocked(p.gx, p.gy))
      .sort((a, c) => Math.hypot(a.gx - pg.gx, a.gy - pg.gy) - Math.hypot(c.gx - pg.gx, c.gy - pg.gy));
  }
  const navTipEl = document.getElementById("navTip");
  let navTipTimer = null, navStuck = 0;
  function setNavTip(text, autoHide) {
    navTipEl.textContent = text; navTipEl.classList.add("show");
    clearTimeout(navTipTimer);
    if (autoHide) navTipTimer = setTimeout(() => navTipEl.classList.remove("show"), 1800);
  }
  function startNav(gridPath, name) {
    if (!gridPath || gridPath.length < 2) {
      setNavTip(gridPath ? "已在目标附近" : "找不到可达路径", true);
      return;
    }
    player.navPath = gridPath.map(([gxx, gyy]) => ({ x: gxx, y: gyy }));
    player.navName = name || "";
    navStuck = 0; follow = true; updateFollowBtn();
    setNavTip(name ? "正在前往：" + name : "自动寻路中", false);
  }
  function navigateToPoint(gx, gy) {
    const t = nearestOpen(gx, gy);
    if (!t) { setNavTip("无法到达那里", true); return; }
    startNav(bfsToTarget({ gx: player.wx, gy: player.wy }, t));
  }
  function navigateToBuilding(b) {
    const pg = ({ gx: player.wx, gy: player.wy });
    // 有围栏的场地：BFS 从唯一门缺口进入，目标设为门内点（场内），走近时门自动开合
    const F = fences.find(f => f.id === b.id);
    if (F) {
      const g = F.g, D = 6;
      let tx = g.cx, ty = g.cy;
      if (g.side === "gymax") ty -= D;
      else if (g.side === "gymin") ty += D;
      else if (g.side === "gxmax") tx -= D;
      else if (g.side === "gxmin") tx += D;
      const t = nearestOpen(tx, ty);
      const p = t ? bfsToTarget(pg, t) : null;
      if (p) { startNav(p, b.name); return; }
    }
    // 自定义入口点（如主楼南大门正前方）：优先停靠在主入口，避免被高墙立面 collider 带到侧翼
    if (b.entry) {
      const te = nearestOpen(b.entry[0], b.entry[1]);
      const pe = te ? bfsToTarget(pg, te) : null;
      if (pe) { startNav(pe, b.name); return; }
    }
    const spots = openSpotsAround(b).slice(0, 12);
    let best = null, bestLen = Infinity;
    for (const s of spots) {
      const p = bfs(pg, s);
      if (p && p.length < bestLen) { bestLen = p.length; best = p; }
    }
    startNav(best, b.name);
  }
  // 轴分离移动
  function moveBy(ux, uy, v) {
    const ox = player.wx, oy = player.wy;
    const nx = player.wx + ux * v, ny = player.wy + uy * v;
    if (!blockedAt(nx, ny, PAD)) { player.wx = nx; player.wy = ny; }
    else {
      if (!blockedAt(nx, player.wy, PAD)) player.wx = nx;
      if (!blockedAt(player.wx, ny, PAD)) player.wy = ny;
    }
    return Math.hypot(player.wx - ox, player.wy - oy);
  }
  function updatePlayer(dt) {
    // 调试钩子：window.__anim={moving,run,dir,phase} 时冻结角色姿态用于逐帧检查
    if (window.__anim) {
      player.moving = !!window.__anim.moving;
      player.running = !!window.__anim.run;
      player.facing = window.__anim.dir || player.facing;
      player.phase = window.__anim.phase || 0;
      updateDust(dt);
      return;
    }
    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if (stick.x !== 0 || stick.y !== 0) { dx += stick.x; dy += stick.y; }
    const manual = (dx !== 0 || dy !== 0);
    if (manual && player.navPath) { player.navPath = null; player.navName = ""; navTipEl.classList.remove("show"); }
    const wantRun = !!(keys["shift"] || player.runLock || stick.mag > 0.85);
    if (manual) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      player.mvx = dx; player.mvy = dy;
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
      else player.facing = dy > 0 ? "down" : "up";
      player.running = wantRun; player.moving = true;
      moveBy(dx, dy, (wantRun ? RUN_SPEED : WALK_SPEED) * dt);
      player.phase += dt * (wantRun ? 14.5 : 9);
      player.idleT = 0;
      if (wantRun) { player.dustT += dt; if (player.dustT > 0.12) { player.dustT = 0; spawnDust(); } }
      follow = true; updateFollowBtn();
    } else if (player.navPath && player.navPath.length) {
      const fast = !!player.runLock;
      const speed = fast ? RUN_SPEED : JOG_SPEED;
      const tgt = player.navPath[0];
      const ddx = tgt.x - player.wx, ddy = tgt.y - player.wy;
      const dist = Math.hypot(ddx, ddy);
      if (dist < 0.29) {
        player.navPath.shift(); navStuck = 0;
        if (!player.navPath.length) {
          player.navPath = null; player.moving = false; player.running = false;
          setNavTip(player.navName ? "已到达：" + player.navName : "已到达", true);
          player.navName = "";
        }
      } else {
        const ux = ddx / dist, uy = ddy / dist;
        player.mvx = ux; player.mvy = uy;
        if (Math.abs(ux) > Math.abs(uy)) player.facing = ux > 0 ? "right" : "left";
        else player.facing = uy > 0 ? "down" : "up";
        player.running = true; player.moving = true;
        const v = Math.min(speed * dt, dist);
        const moved = moveBy(ux, uy, v);
        if (moved < v * 0.25) { navStuck++; if (navStuck > 10) { player.navPath.shift(); navStuck = 0; } }
        else navStuck = 0;
        player.phase += dt * (fast ? 14.5 : 11.5);
        player.idleT = 0;
        player.dustT += dt; if (player.dustT > 0.14) { player.dustT = 0; spawnDust(); }
        follow = true; updateFollowBtn();
      }
    } else {
      player.moving = false; player.running = false; player.idleT += dt; navStuck = 0;
    }
    updateDust(dt);
  }

  // ---------- 门开合 + 进入场地 ----------
  const enterBanner = document.getElementById("enterBanner");
  let bannerTimer = null;
  function showZone(text, sub) {
    document.getElementById("ebTitle").textContent = text;
    document.getElementById("ebSub").textContent = sub || "";
    enterBanner.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => enterBanner.classList.remove("show"), 1900);
  }
  function updateGates(dt) {
    const pg = ({ gx: player.wx, gy: player.wy });
    const k = Math.min(1, dt * 5);
    for (const F of fences) {
      const g = F.g;
      const dist = Math.hypot(pg.gx - g.cx, pg.gy - g.cy);
      F.open += ((dist < GATE_HALF + 5.5 ? 1 : 0) - F.open) * k;
      const nowIn = insideField(pg.gx, pg.gy, F);
      if (nowIn && !F.inside) showZone("进入 · " + F.zone, "由入口门进入，场内可自由行走");
      F.inside = nowIn;
    }
    // 东西伸缩门：接近门中线 ~5 格内收拢放行
    for (const g of campusGates) {
      const dist = Math.hypot(pg.gx - g.cx, pg.gy - g.cy);
      g.open += ((dist < 5.5 ? 1 : 0) - g.open) * k;
    }
  }

  // ---------- 输入 ----------
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  });
  window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
  const isTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    "ontouchstart" in window ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  if (isTouch) document.body.classList.add("touch");

  const joyZone = document.getElementById("joyZone");
  const joyBase = document.getElementById("joyBase");
  const joyKnob = document.getElementById("joyKnob");
  let joyId = null, joyCX = 0, joyCY = 0, joyR = 30;
  function setJoy(e) {
    let dx = e.clientX - joyCX, dy = e.clientY - joyCY;
    const d = Math.hypot(dx, dy);
    const mag = Math.min(1, d / joyR);
    if (d > joyR) { dx = dx / d * joyR; dy = dy / d * joyR; }
    joyKnob.style.transform = "translate(" + dx + "px," + dy + "px)";
    if (d > 8) { stick.x = dx / joyR; stick.y = dy / joyR; stick.mag = mag; }
    else { stick.x = 0; stick.y = 0; stick.mag = 0; }
    joyKnob.classList.toggle("run", mag > 0.85);
  }
  function resetJoy() {
    joyId = null; stick.x = 0; stick.y = 0; stick.mag = 0;
    joyKnob.classList.remove("run");
    joyKnob.style.transform = "translate(0px,0px)";
  }
  joyZone.addEventListener("pointerdown", e => {
    e.preventDefault(); joyZone.setPointerCapture(e.pointerId);
    joyId = e.pointerId;
    const r = joyBase.getBoundingClientRect();
    joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
    joyR = r.width / 2 - 24; setJoy(e);
  });
  joyZone.addEventListener("pointermove", e => { if (e.pointerId === joyId) setJoy(e); });
  joyZone.addEventListener("pointerup", resetJoy);
  joyZone.addEventListener("pointercancel", resetJoy);

  const pointers = new Map();
  let dragging = false, moved = false;
  let pinch = null, multiTouch = false;
  const ptDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true; moved = false; multiTouch = false;
      canvas.classList.add("dragging");
    } else if (pointers.size === 2) {
      dragging = false; canvas.classList.remove("dragging");
      const p = [...pointers.values()];
      pinch = { dist: ptDist(p[0], p[1]), cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 };
      moved = true; multiTouch = true;
    }
  });
  canvas.addEventListener("pointermove", e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2 && pinch) {
      const p = [...pointers.values()];
      const dist = ptDist(p[0], p[1]);
      const cx = (p[0].x + p[1].x) / 2, cy = (p[0].y + p[1].y) / 2;
      if (dist > 0 && pinch.dist > 0) zoomAt(cx, cy, dist / pinch.dist);
      view.x += cx - pinch.cx; view.y += cy - pinch.cy;
      pinch = { dist, cx, cy }; follow = false; updateFollowBtn();
    } else if (dragging && pointers.size === 1) {
      const ddx = cur.x - prev.x, ddy = cur.y - prev.y;
      if (Math.abs(ddx) + Math.abs(ddy) > 4) { moved = true; follow = false; updateFollowBtn(); }
      view.x += ddx; view.y += ddy;
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      const doClick = !moved && !multiTouch;
      dragging = false; pinch = null; multiTouch = false;
      canvas.classList.remove("dragging");
      if (doClick) handleClick(e.clientX, e.clientY);
    } else if (pointers.size === 1) {
      const p = [...pointers.values()][0];
      pinch = null; dragging = true; moved = true;
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  function zoomAt(cx, cy, f) {
    const nz = Math.min(4, Math.max(0.03, view.zoom * f));
    const wx = s2wX(cx), wy = s2wY(cy);
    view.zoom = nz;
    view.x = cx - wx * nz; view.y = cy - wy * nz;
  }
  function handleClick(cx, cy) {
    const g = worldToGrid(s2wX(cx), s2wY(cy));
    let hit = null, hitSouth = -Infinity;
    for (const b of D.buildings) {
      const r = clickRect(b);
      if (g.gx >= r.x && g.gx <= r.x + r.w && g.gy >= r.y && g.gy <= r.y + r.h) {
        const south = r.y + r.h;   // 前后遮挡：南边(靠屏幕下方)的最上层优先
        if (south > hitSouth) { hitSouth = south; hit = b; }
      }
    }
    if (hit) { showInfo(hit); return; }
    navigateToPoint(g.gx, g.gy);
  }

  // ---------- 信息卡 ----------
  const GROUP_CN = {
    teaching: "教学科研", public: "公共服务", sports: "体育",
    dining: "餐饮", gate: "校门", nature: "自然地标"
  };
  let currentBuilding = null;
  function showInfo(b) {
    currentBuilding = b;
    document.getElementById("iNo").textContent = "点位 " + String(b.no).padStart(2, "0") + " · " + b.id;
    document.getElementById("iName").textContent = b.name;
    document.getElementById("iTag").textContent = GROUP_CN[b.group] || b.group;
    document.getElementById("iDesc").textContent = b.desc || "（暂无介绍）";
    const img = document.getElementById("iImg");
    const meta = TD.sprites && TD.sprites[b.id];
    img.src = meta ? meta.file : "";
    img.style.visibility = meta ? "visible" : "hidden";
    document.getElementById("info").classList.add("show");
  }
  document.getElementById("infoClose").onclick = () =>
    document.getElementById("info").classList.remove("show");
  document.getElementById("btnGoto").onclick = () => { if (currentBuilding) navigateToBuilding(currentBuilding); };

  // ---------- 按钮 ----------
  const btnFollow = document.getElementById("btnFollow");
  function updateFollowBtn() { btnFollow.classList.toggle("active", follow); }
  btnFollow.onclick = () => { follow = true; updateFollowBtn(); };
  const btnRun = document.getElementById("btnRun");
  function updateRunBtn() {
    btnRun.textContent = "跑步：" + (player.runLock ? "开" : "关");
    btnRun.classList.toggle("run-active", player.runLock);
  }
  btnRun.onclick = () => { player.runLock = !player.runLock; updateRunBtn(); };
  document.getElementById("btnReset").onclick = () => {
    follow = false; centerView(); updateFollowBtn();
  };
  window.__map = {
    view, player, buildings: D.buildings,
    worldToScreen: (wx, wy) => ({ x: w2sX(wx), y: w2sY(wy) }),
    select: b => showInfo(b),
    gotoBuilding: id => { const b = D.buildings.find(x => x.id === id); if (b) navigateToBuilding(b); },
    gotoPoint: (gx, gy) => navigateToPoint(gx, gy),
    dbg: {
      blockedAt, bfs, nearestOpen, openSpotsAround, fences, buildingScale, visRect, clickRect,
      spriteGeometry(id, px, py) {
        const b = D.buildings.find(x => x.id === id);
        const real = spriteImgs[id];
        const a = spriteAnchor(b, real);
        const z = view.zoom;
        const W = a.pxW * z, H = a.pxH * z;
        const dx = w2sX(a.x) - a.ax * W, dy = w2sY(a.y) - a.ay * H;
        const d = isoDiamond(b.grid[0], b.grid[1], b.grid[2], b.grid[3]);
        const S = q => ({ x: +w2sX(q.x).toFixed(1), y: +w2sY(q.y).toFixed(1) });
        const out = {
          imgSize: [real.width, real.height], sc: +a.sc.toFixed(4),
          anchor: { ax: a.ax, ay: a.ay, k: (window.__anchorOverride && window.__anchorOverride[id] && window.__anchorOverride[id].k) || ISO_K[id] || 1.1 },
          screenSouth: S(isoDiamond(b.grid[0], b.grid[1], b.grid[2], b.grid[3])[2]),
          P0: S(d[0]), P1: S(d[1]), P2: S(d[2]), P3: S(d[3]),
          spriteTL: { x: +dx.toFixed(1), y: +dy.toFixed(1) },
          spriteSize: { w: +W.toFixed(1), h: +H.toFixed(1) }
        };
        if (px != null && py != null) {
          out.pxPoint = { x: +(dx + px / real.width * W).toFixed(1), y: +(dy + py / real.height * H).toFixed(1) };
        }
        return out;
      }
    }
  };

  // ---------- 绘制：等距地面 ----------
  function drawGround() {
    const gw = WORLD_W * view.zoom, gh = WORLD_H * view.zoom;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(isoGround, w2sX(WORLD_MINX), w2sY(WORLD_MINY), gw, gh);
    ctx.imageSmoothingEnabled = false;
  }
  function drawPath() {
    if (!player.navPath || !player.navPath.length) return;
    const z = view.zoom;
    const pts = [{ x: player.wx, y: player.wy }, ...player.navPath];
    ctx.save();
    ctx.strokeStyle = "rgba(91,155,255,.75)";
    ctx.lineWidth = Math.max(2, 4 * z);
    ctx.setLineDash([Math.max(4, 12 * z), Math.max(4, 9 * z)]);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = w2sX(isoX(p.x, p.y)), y = w2sY(isoY(p.x, p.y));
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const end = pts[pts.length - 1];
    ctx.fillStyle = "rgba(45,108,223,.95)";
    ctx.beginPath(); ctx.arc(w2sX(isoX(end.x, end.y)), w2sY(isoY(end.x, end.y)), Math.max(4, 8 * z), 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawDust() {
    const z = view.zoom;
    if (z < 0.12 || !dust.length) return;
    for (const p of dust) {
      const a = Math.max(0, p.life / p.max);
      const r = p.s * z * (1.7 - a * 0.7);
      ctx.fillStyle = "rgba(214,198,160," + (0.55 * a).toFixed(3) + ")";
      ctx.fillRect(w2sX(isoX(p.x, p.y)) - r / 2, w2sY(isoY(p.x, p.y)) - r / 2, r, r);
    }
  }

  // ---------- 绘制：建筑（等距 sprite / 占位等距方块） ----------
  const RISE = { teaching: 96, lab: 96, library: 96, college: 96, service: 96, activity: 96,
    canteen: 84, gym: 72, gate: 48, field: 0, nature: 120 };
  function anchorOf(b) {
    const [fx, fy, fw, fh] = b.grid;
    return { x: isoX(fx + fw, fy + fh), y: isoY(fx + fw, fy + fh) };  // 南角
  }
  function drawBuilding(b) {
    const z = view.zoom;
    const real = spriteImgs[b.id];
    if (real) {
      const [fx, fy, fw, fh] = b.grid;
      const a = spriteAnchor(b, real);
      const W = a.pxW * z, H = a.pxH * z;
      const dx = w2sX(a.x) - a.ax * W;
      const dy = w2sY(a.y) - a.ay * H;
      ctx.imageSmoothingEnabled = false;   // NEAREST 硬像素
      ctx.drawImage(real, dx, dy, W, H);
      ctx.imageSmoothingEnabled = true;
      if (window.__dbgAnchor === b.id) {
        const d = isoDiamond(fx, fy, fw, fh);
        ctx.strokeStyle = "#ff2a2a"; ctx.lineWidth = 3;
        ctx.beginPath();
        d.forEach((q, i) => { const sx = w2sX(q.x), sy = w2sY(q.y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
        ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = "#22ff66"; ctx.lineWidth = 2; ctx.strokeRect(dx, dy, W, H);
        ctx.fillStyle = "#ff2a2a"; ctx.beginPath();
        ctx.arc(w2sX(a.x), w2sY(a.y), 7, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }
    // 占位等距方块：顶面菱形 + 南墙/东墙立面
    const r = visRect(b);
    const d = isoDiamond(r.x, r.y, r.w, r.h);
    const P = q => ({ x: w2sX(q.x), y: w2sY(q.y) });
    const p0 = P(d[0]), p1 = P(d[1]), p2 = P(d[2]), p3 = P(d[3]);
    const rise = b.walkable ? 0 : (RISE[b.cat] || 96) * z;
    const col = b.walkable ? "#5f9e4a" : (GROUP_COLOR[b.group] || "#9fb4d8");
    if (rise > 0) {
      ctx.fillStyle = "rgba(35,34,46,.65)";
      ctx.beginPath(); ctx.moveTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p3.x, p3.y + rise); ctx.lineTo(p2.x, p2.y + rise); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(20,20,30,.75)";
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p2.x, p2.y + rise); ctx.lineTo(p1.x, p1.y + rise); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#2e2418"; ctx.lineWidth = Math.max(1, 2 * z);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
    ctx.closePath(); ctx.stroke();
  }

  // ---------- 绘制：等距菱形围栏 + 唯一入口滑门 ----------
function drawFences(F) {
    const z = view.zoom;
    if (z < 0.1) return;
    const th = Math.max(2, 6 * z);
    const S = (gx, gy) => ({ x: w2sX(isoX(gx, gy)), y: w2sY(isoY(gx, gy)) });
    const C = S(F.ccx, F.ccy);
    const sAng = F.sAng || 0;
    const useScreen = F.sRx && F.sRy;
    const cosA = Math.cos(sAng), sinA = Math.sin(sAng);
    const phi = F.phi;
    const ellPt = (a) => {
      if (useScreen) {
        // 标准旋转椭圆：局部参数 a-sAng → 旋转 sAng；长轴世界角 = sAng（与 ellNorm/门点一致）
        const la = a - sAng;
        const ex = F.sRx * Math.cos(la), ey = F.sRy * Math.sin(la);
        return { x: C.x + (ex * cosA - ey * sinA) * z, y: C.y + (ex * sinA + ey * cosA) * z };
      }
      return S(F.ccx + F.R * Math.cos(a), F.ccy + F.R * Math.sin(a));
    };
    const N = 90;
    const strokeArc = (a0, a1) => {
      for (const [lw, col] of [[th, "#9c6f3f"], [Math.max(1, th * 0.35), "#5f4326"]]) {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const a = a0 + (a1 - a0) * (i / N), q = ellPt(a);
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }
    };
    const gapHalf = F.gapHalf;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    strokeArc(phi + gapHalf, phi - gapHalf + 2 * Math.PI);
    const PA = ellPt(phi - gapHalf), PB = ellPt(phi + gapHalf), G = ellPt(phi);
    const post = (Q) => { ctx.fillStyle = "#6b4a28"; ctx.fillRect(Q.x - th * 0.9, Q.y - th * 0.9, th * 1.8, th * 1.8); };
    post(PA); post(PB);
    const open = F.open;
    const doorLen = GATE_HALF * 30 * z;
    const leaf = (hinge) => {
      const dx = C.x - hinge.x, dy = C.y - hinge.y;
      const dl = Math.hypot(dx, dy) || 1;
      const openT = { x: hinge.x + dx / dl * doorLen, y: hinge.y + dy / dl * doorLen };
      const tip = { x: G.x + (openT.x - G.x) * open, y: G.y + (openT.y - G.y) * open };
      ctx.strokeStyle = "#cfa366"; ctx.lineWidth = th * 0.9;
      ctx.beginPath(); ctx.moveTo(hinge.x, hinge.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    };
    leaf(PA); leaf(PB);
  }

  // ---------- 绘制：环境装饰（底边中点锚点，逐项参与深度排序） ----------
  // 按 map_data.json 布局手布：山脚松林、两操场外围树阵、主路路灯、楼前花坛/长椅/灌木
  const DECOR = [];
  function addDeco(id, gx, gy) { DECOR.push({ id, gx, gy }); }
  // 玉屏山南麓松林（gy≈41，gx 44..80）
  for (let gx = 45; gx <= 80; gx += 4) addDeco("tree_pine", gx, 41.5 + (gx % 3));
  // FIELD-N 外围四角树
  addDeco("tree_oak", 92.5, 31.5); addDeco("tree_oak", 110.0, 31.5);
  addDeco("tree_oak", 92.5, 64.5); addDeco("tree_oak_b", 110.5, 64.5);
  addDeco("tree_bush", 101.0, 31.0); addDeco("tree_bush", 101.0, 65.0);
  // FIELD-W 外围四角树
  addDeco("tree_oak", 11.0, 189.0); addDeco("tree_oak", 30.5, 189.0);
  addDeco("tree_oak_b", 11.0, 222.5); addDeco("tree_oak", 30.5, 222.5);
  // 主路两侧路灯（南北向主路 gx≈62 与 gx≈96）
  for (let gy = 80; gy <= 250; gy += 16) { addDeco("lamp", 60.0, gy); addDeco("lamp", 98.0, gy + 6); }
  // TEACH-1 双D中轴门洞内的绿地/铺装已在 sprite 内绘制，不再外挂花坛，避免网格错位
  // LIB 门前长椅+灌木
  addDeco("bench", 84.0, 146.5); addDeco("bench", 90.0, 146.5);
  addDeco("shrub_a", 78.0, 146.0); addDeco("shrub_b", 99.0, 146.0);
  // 食堂/文理楼周边矮灌
  addDeco("tree_bush", 42.0, 118.0); addDeco("tree_bush", 30.0, 150.0);
  addDeco("shrub_a", 111.0, 155.0); addDeco("shrub_b", 38.0, 133.0);
  function drawDecor(d) {
    const z = view.zoom;
    const im = spriteImgs[d.id];
    if (!im) return;
    const an = gridToWorld(d.gx, d.gy);
    const w = im.width * z, h = im.height * z;
    ctx.imageSmoothingEnabled = z < 0.85;
    ctx.drawImage(im, an.x * z + view.x - w / 2, an.y * z + view.y - h, w, h);
    ctx.imageSmoothingEnabled = true;
  }

  // ---------- 绘制：角色 ----------
  function drawPlayer() {
    const g = ({ gx: player.wx, gy: player.wy });
    const sx = w2sX(isoX(player.wx, player.wy)), sy = w2sY(isoY(player.wx, player.wy));
    const z = view.zoom;
    if (z < 0.12) {
      ctx.fillStyle = player.running ? "#ffd25a" : "#5b4a6b";
      ctx.beginPath(); ctx.arc(sx, sy, player.running ? 4.5 : 3.5, 0, 7); ctx.fill();
      return g.gy * 1000 + g.gx;
    }
    const fw = FRAME_W * z * PLAYER_SCALE, fh = FRAME_H * z * PLAYER_SCALE;
    const fset = frames[player.facing] || frames.down;
    const seq = player.moving ? (player.running ? fset.run : fset.walk) : fset.idle;
    const fi = player.moving ? (Math.floor(player.phase) % seq.length) : 0;
    const pimg = seq && seq[fi];
    let bob = 0;
    if (player.moving) {
      if (player.running) {
        // 跑步：第2帧为腾空最高点，按 4 帧节奏给出明显抬升（跑感）
        const lift = [0, 1.6, 5.2, 1.6][Math.floor(player.phase) % 4];
        bob = -lift * z * PLAYER_SCALE;
      } else {
        // 走路：轻微起伏
        bob = -Math.abs(Math.sin(player.phase * Math.PI / 2)) * 1.6 * z;
      }
    } else bob = -Math.sin(player.idleT * 1.8) * 1.0 * z;
    // 影子（腾空时影子略变淡变小）
    const airborne = player.moving && player.running && (Math.floor(player.phase) % 4 === 2);
    ctx.fillStyle = airborne ? "rgba(20,30,40,.16)" : "rgba(20,30,40,.3)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, (airborne ? 7 : 9) * z * PLAYER_SCALE, (airborne ? 2.8 : 3.6) * z * PLAYER_SCALE, 0, 0, 7);
    ctx.fill();
    if (pimg) {
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.drawImage(pimg, -fw / 2, -fh, fw, fh);
      ctx.restore();
    }
    return g.gy * 1000 + g.gx;
  }

  // ---------- 建筑名标签 ----------
  const LABEL_MIN_ZOOM = 0.3;
  function drawLabels() {
    const z = view.zoom;
    if (z < LABEL_MIN_ZOOM) return;
    const fs = Math.min(15, Math.max(11, 12 * z / 0.35));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "600 " + fs + "px 'PingFang SC','Microsoft YaHei',sans-serif";
    const h = fs + 9, padX = 8;
    for (const b of D.buildings) {
      const real = spriteImgs[b.id];
      let lx, ly;
      if (real) {
        const a = spriteAnchor(b, real);
        const W = a.pxW * z, H = a.pxH * z;
        const tly = w2sY(a.y) - a.ay * H;
        // 标签 x 用 footprint 逻辑中心（最稳，不随顶行设备偏移）；y 用实体顶行（避开透明留白）
        const r = visRect(b);
        lx = w2sX(isoX(r.x + r.w / 2, r.y + r.h / 2));
        const top = spriteTop[b.id];
        ly = top ? tly + top.row * a.sc * z - 8 : tly - 8;
      } else {
        const r = visRect(b);
        const cx = r.x + r.w / 2, cy = r.y;
        lx = w2sX(isoX(cx, cy));
        ly = w2sY(isoY(cx, cy)) - 12;
      }
      if (lx < -80 || lx > window.innerWidth + 80 || ly < -30 || ly > window.innerHeight + 30) continue;
      const tw = ctx.measureText(b.name).width;
      ctx.fillStyle = "rgba(15,22,34,.72)";
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - padX, ly - h / 2, tw + padX * 2, h, 6);
      ctx.fill();
      ctx.fillStyle = "#eaf2ff";
      ctx.fillText(b.name, lx, ly + 0.5);
    }
  }

  // ---------- 小地图（方形俯视，独立于等距主视图） ----------
  function mmTransform() {
    const pad = 4;
    const s = Math.min((MM_W - 2 * pad) / SQ_W, (MM_H - 2 * pad) / SQ_H);
    return { s, ox: (MM_W - SQ_W * s) / 2, oy: (MM_H - SQ_H * s) / 2 };
  }
  function drawMinimap() {
    const { s, ox, oy } = mmTransform();
    mmCtx.clearRect(0, 0, MM_W, MM_H);
    mmCtx.drawImage(mmGround, ox, oy, SQ_W * s, SQ_H * s);
    const w2m = (gx, gy) => ({ x: ox + (gx - GX0) * TILE * s, y: oy + (gy - GY0) * TILE * s });
    if (player.navPath && player.navPath.length) {
      const pts = [{ x: player.wx, y: player.wy }, ...player.navPath];
      mmCtx.strokeStyle = "rgba(120,178,255,.95)"; mmCtx.lineWidth = 1.3;
      mmCtx.beginPath();
      pts.forEach((p, i) => {
        const m = w2m(p.x, p.y);
        if (i) mmCtx.lineTo(m.x, m.y); else mmCtx.moveTo(m.x, m.y);
      });
      mmCtx.stroke();
    }
    for (const b of D.buildings) {
      if (b.cat === "field") continue; // 操场单独画椭圆
      const r = visRect(b);
      mmCtx.fillStyle = GROUP_COLOR[b.group] || "#9fb4d8";
      const p0 = w2m(r.x, r.y), p1 = w2m(r.x + r.w, r.y + r.h);
      mmCtx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    }
    // 操场：方形俯视椭圆，南北长轴；北操场红跑道、风雨操场蓝跑道
    for (const b of D.buildings) {
      if (b.cat !== "field") continue;
      const [gx, gy, gw, gh] = b.grid;
      const p = w2m(gx + gw / 2, gy + gh / 2);
      const rx = (gw / 2) * TILE * s, ry = (gh / 2) * TILE * s;
      const isN = b.id === "FIELD-N";
      mmCtx.fillStyle = "#7fbf5c";
      mmCtx.beginPath(); mmCtx.ellipse(p.x, p.y, rx * 0.82, ry * 0.82, 0, 0, 7); mmCtx.fill();
      mmCtx.strokeStyle = isN ? "#d8634f" : "#5fb4d6"; mmCtx.lineWidth = 2.4;
      mmCtx.beginPath(); mmCtx.ellipse(p.x, p.y, rx, ry, 0, 0, 7); mmCtx.stroke();
    }
    // 视野框：屏幕四角 → 等距世界 → 网格 → 方形小地图包围矩形
    let gxmin = 1e9, gymin = 1e9, gxmax = -1e9, gymax = -1e9;
    for (const [cx, cy] of [[0, 0], [window.innerWidth, 0], [0, window.innerHeight], [window.innerWidth, window.innerHeight]]) {
      const g = worldToGrid(s2wX(cx), s2wY(cy));
      gxmin = Math.min(gxmin, g.gx); gxmax = Math.max(gxmax, g.gx);
      gymin = Math.min(gymin, g.gy); gymax = Math.max(gymax, g.gy);
    }
    const c0 = w2m(gxmin, gymin), c1 = w2m(gxmax, gymax);
    mmCtx.fillStyle = "rgba(255,255,255,.08)";
    mmCtx.fillRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    mmCtx.strokeStyle = "rgba(255,255,255,.8)"; mmCtx.lineWidth = 1;
    mmCtx.strokeRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    const pm = w2m(player.wx, player.wy);
    mmCtx.fillStyle = "#ffd25a";
    mmCtx.beginPath(); mmCtx.arc(pm.x, pm.y, 3, 0, 7); mmCtx.fill();
    mmCtx.strokeStyle = "#fff"; mmCtx.lineWidth = 1;
    mmCtx.beginPath(); mmCtx.arc(pm.x, pm.y, 3, 0, 7); mmCtx.stroke();
  }
  mmCanvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    const rect = mmCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MM_W / rect.width);
    const my = (e.clientY - rect.top) * (MM_H / rect.height);
    const { s, ox, oy } = mmTransform();
    const gx = GX0 + (mx - ox) / s / TILE, gy = GY0 + (my - oy) / s / TILE;
    follow = false; updateFollowBtn();
    view.x = window.innerWidth / 2 - isoX(gx, gy) * view.zoom;
    view.y = window.innerHeight / 2 - isoY(gx, gy) * view.zoom;
  });

  // ---------- 主渲染 ----------
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawGround();
    drawPath();
    drawDust();
    // 深度排序 drawList
    const drawList = [];
    for (const b of D.buildings) {
      // 场地类（操场）sprite 主体是平面跑道/草地，按地面层（北角）深度：玩家在跑道/草坪任意位置都可见；立体看台在边缘不影响
      let depth;
      if (b.cat === "field") depth = (b.grid[1] - 2) * 1000 + (b.grid[0] + b.grid[2] / 2);
      else depth = (b.grid[1] + b.grid[3]) * 1000 + (b.grid[0] + b.grid[2]);
      drawList.push({ kind: "b", depth, b });
    }
    for (const F of fences) drawList.push({ kind: "f", depth: (F.ccy + F.R) * 1000 + (F.ccx + F.R) + 1, F });
    for (const d of DECOR) drawList.push({ kind: "d", depth: d.gy * 1000 + d.gx, d });
    const pg = ({ gx: player.wx, gy: player.wy });
    drawList.push({ kind: "p", depth: pg.gy * 1000 + pg.gx });
    drawList.sort((a, b) => a.depth - b.depth);
    for (const it of drawList) {
      if (it.kind === "b") drawBuilding(it.b);
      else if (it.kind === "f") drawFences(it.F);
      else if (it.kind === "d") drawDecor(it.d);
      else if (it.kind === "p") drawPlayer();
    }
    drawLabels();
    if (DEBUG_ISO) drawDebug();
    drawMinimap();
  }
  // 调试覆盖层：?debug=1 画 footprint 菱形/南角/sprite锚点/道路中线
  const DEBUG_ISO = new URLSearchParams(location.search).get("debug") === "1";
  function drawDebug() {
    for (const b of D.buildings) {
      const r = visRect(b);
      const d = isoDiamond(r.x, r.y, r.w, r.h);
      const P = q => ({ x: w2sX(q.x), y: w2sY(q.y) });
      const p0 = P(d[0]), p1 = P(d[1]), p2 = P(d[2]), p3 = P(d[3]);
      ctx.strokeStyle = b.walkable ? "rgba(0,180,255,.9)" : "rgba(255,40,40,.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y);
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = "#ffe21a"; ctx.beginPath(); ctx.arc(p2.x, p2.y, 3, 0, 7); ctx.fill();
      if (spriteImgs[b.id]) {
        const a = spriteAnchor(b, spriteImgs[b.id]);
        const ax = w2sX(a.x), ayy = w2sY(a.y), Ww = a.pxW * view.zoom;
        ctx.fillStyle = "#25f0ff"; ctx.beginPath();
        ctx.arc(ax, ayy, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(37,240,255,.75)"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax - Ww / 2, ayy); ctx.lineTo(ax + Ww / 2, ayy); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.strokeStyle = "rgba(30,60,255,.7)"; ctx.lineWidth = 1.2;
    for (const r of TD.roads) {
      ctx.beginPath();
      r.gpts.forEach((p, i) => {
        const x = w2sX(isoX(p[0], p[1])), y = w2sY(isoY(p[0], p[1]));
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    updatePlayer(dt);
    updateGates(dt);
    if (follow) {
      view.x += window.innerWidth * 0.5 - w2sX(isoX(player.wx, player.wy));
      view.y += window.innerHeight * 0.62 - w2sY(isoY(player.wx, player.wy));
    }
    render();
    requestAnimationFrame(frame);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }
  window.addEventListener("resize", resize);

  // ---------- 启动 ----------
  resize();
  centerView();
  updateFollowBtn(); updateRunBtn();
  Promise.all([BOOT, playerLoad]).then(() => {
    loadedN = TOTAL_ASSETS;
    const pe = document.getElementById("pct"), pf = document.getElementById("pfill");
    if (pe) pe.textContent = "100%";
    if (pf) pf.style.width = "100%";
    const ld = document.getElementById("loading");
    if (ld) ld.style.opacity = "0";
    setTimeout(() => { if (ld) ld.style.display = "none"; }, 320);
    requestAnimationFrame(frame);
  });
})();

/* 北化昌平校区 · 星露谷式正俯视（top-down 方形瓦片）数字校园 — 浏览器预览器
   方形投影 + 程序化 tilemap 地面 + 深度排序 + 方格 BFS 寻路 + 围栏唯一入口。
   逻辑网格 gx,gy 与投影解耦：world(gx,gy) = (gx*TILE, gy*TILE)。 */
(function () {
  "use strict";
  const D = window.CAMPUS_DATA;
  const TD = window.TOPDOWN_DATA;
  const [GX0, GY0, GX1, GY1] = D.meta.gridRange;

  // ---------- 投影常量（见 docs/topdown-spec.md） ----------
  const TILE = 48;
  const GRAIN = 4;
  const WORLD_W = (GX1 - GX0) * TILE;      // 6624
  const WORLD_H = (GY1 - GY0) * TILE;      // 12730.5
  const WORLD_CX = (GX0 + GX1) / 2 * TILE;  // 3600
  const WORLD_CY = (GY0 + GY1) / 2 * TILE;   // 6652.8

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
    return Math.min(window.innerWidth * 0.96 / WORLD_W, window.innerHeight * 0.96 / WORLD_H);
  }
  function centerView() {
    view.zoom = fitZoom();
    view.x = window.innerWidth / 2 - WORLD_CX * view.zoom;
    view.y = window.innerHeight * 0.62 - WORLD_CY * view.zoom;
  }
  const w2sX = wx => wx * view.zoom + view.x;
  const w2sY = wy => wy * view.zoom + view.y;
  const s2wX = sx => (sx - view.x) / view.zoom;
  const s2wY = sy => (sy - view.y) / view.zoom;
  const gridToWorld = (gx, gy) => ({ x: gx * TILE, y: gy * TILE });
  const worldToGrid = (wx, wy) => ({ gx: wx / TILE, gy: wy / TILE });

  // ---------- 程序化地面 tile（48×48 offscreen） ----------
  function makeTile(base, speck) {
    const c = document.createElement("canvas"); c.width = TILE; c.height = TILE;
    const g = c.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
    // 确定性伪随机斑点（避开边缘±3，保证平铺无缝）
    let s = base.length * 131 + base.charCodeAt(1);
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < speck.n; i++) {
      g.fillStyle = speck.colors[i % speck.colors.length];
      const x = 3 + rnd() * (TILE - 9), y = 3 + rnd() * (TILE - 9);
      g.fillRect(x | 0, y | 0, 3 + (rnd() * 4 | 0), 3 + (rnd() * 4 | 0));
    }
    return c;
  }
  const TILES = {
    grass_a: makeTile("#8fbc5a", { n: 6, colors: ["#79a848", "#a8cf6a", "#79a848"] }),
    grass_b: makeTile("#8fbc5a", { n: 6, colors: ["#c2e07f", "#a8cf6a", "#668f3d"] }),
    dirt: makeTile("#d9b36c", { n: 8, colors: ["#c09a52", "#eccf90", "#c09a52"] }),
    pave: makeTile("#cbb59a", { n: 5, colors: ["#b39c7e", "#ddc9ad"] }),
    water: makeTile("#5a9ec4", { n: 5, colors: ["#3f7fa8", "#8fc4e0"] })
  };
  // 路口 tile = dirt 与 pave 斜纹混合
  TILES.jct = (() => {
    const c = document.createElement("canvas"); c.width = TILE; c.height = TILE;
    const g = c.getContext("2d");
    g.drawImage(TILES.pave, 0, 0);
    g.fillStyle = "rgba(217,179,108,.55)"; g.fillRect(0, 0, TILE, TILE);
    return c;
  })();

  // ---------- 格点分类（整数网格 -> tile 类型） ----------
  // 0 grass_a, 1 grass_b, 2 dirt, 3 pave, 4 jct, 5 water
  const ix0 = Math.floor(GX0), iy0 = Math.floor(GY0);
  const ix1 = Math.ceil(GX1), iy1 = Math.ceil(GY1);
  const cw = ix1 - ix0 + 1, ch = iy1 - iy0 + 1;
  const cellType = new Uint8Array(cw * ch);
  const roadCount = new Uint16Array(cw * ch);
  const roadPaved = new Uint8Array(cw * ch);
  function ci(gx, gy) { return (gy - iy0) * cw + (gx - ix0); }
  function distToSeg(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    let t = ((px - a[0]) * dx + (py - a[1]) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const cx = a[0] + t * dx, cy = a[1] + t * dy;
    return Math.hypot(px - cx, py - cy);
  }
  function stampRoad(points, halfW, paved) {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1];
      const minX = Math.max(ix0, Math.floor(Math.min(a[0], b[0]) - halfW));
      const maxX = Math.min(ix1, Math.ceil(Math.max(a[0], b[0]) + halfW));
      const minY = Math.max(iy0, Math.floor(Math.min(a[1], b[1]) - halfW));
      const maxY = Math.min(iy1, Math.ceil(Math.max(a[1], b[1]) + halfW));
      for (let gx = minX; gx <= maxX; gx++) for (let gy = minY; gy <= maxY; gy++) {
        if (distToSeg(gx + 0.5, gy + 0.5, a, b) <= halfW) {
          const k = ci(gx, gy);
          roadCount[k]++;
          if (paved) roadPaved[k] = 1;
        }
      }
    }
  }
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
    // 道路
    for (const r of TD.roads) stampRoad(r.gpts, r.w / 2, r.paved);
    // 道路覆盖水/草，路口标记
    for (let k = 0; k < cellType.length; k++) {
      if (roadCount[k] >= 2) cellType[k] = 4;
      else if (roadCount[k] === 1) cellType[k] = roadPaved[k] ? 3 : 2;
    }
  })();

  // ---------- 低分辨率整体地面预渲染（缩放概览用） ----------
  const PRE = 0.15;
  const groundPre = document.createElement("canvas");
  groundPre.width = Math.ceil(WORLD_W * PRE);
  groundPre.height = Math.ceil(WORLD_H * PRE);
  (function buildPre() {
    const g = groundPre.getContext("2d");
    // 草地底
    g.fillStyle = "#8fbc5a"; g.fillRect(0, 0, groundPre.width, groundPre.height);
    const tw = TILE * PRE;
    for (let gx = ix0; gx <= ix1; gx++) for (let gy = iy0; gy <= iy1; gy++) {
      const t = cellType[ci(gx, gy)];
      g.drawImage([TILES.grass_a, TILES.grass_b, TILES.dirt, TILES.pave, TILES.jct, TILES.water][t],
        (gx - GX0) * tw, (gy - GY0) * tw, tw + 1, tw + 1);
    }
  })();

  // ---------- 建筑 sprite 加载（样板资产；缺失时用占位方块） ----------
  function loadImg(src) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
  }
  const spriteImgs = {};
  const BOOT = Promise.all([
    loadImg("img/topdown/sprites/TEACH-1.png").then(im => spriteImgs["TEACH-1"] = im),
    loadImg("img/topdown/sprites/FIELD-N.png").then(im => spriteImgs["FIELD-N"] = im),
    loadImg("img/topdown/decor/tree_oak.png").then(im => spriteImgs["tree"] = im),
    loadImg("img/topdown/decor/fence_h.png").then(im => spriteImgs["fence_h"] = im),
    loadImg("img/topdown/decor/fence_v.png").then(im => spriteImgs["fence_v"] = im)
  ]);
  // 角色帧（沿用现有 iso chibi 四方向×4 走路帧）
  const FRAME_W = 56, FRAME_H = 70;
  const walkFrames = {};
  function loadFrame(dir, f) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = () => res(null);
      im.src = "img/player/player_" + dir + "_" + f + ".png";
    });
  }
  const PLAYER_DIRS = ["down", "up", "left", "right"];
  const playerLoad = Promise.all(PLAYER_DIRS.map(dir =>
    Promise.all([0, 1, 2, 3].map(f => loadFrame(dir, f))).then(arr => walkFrames[dir] = arr)
  ));

  // ---------- 角色 ----------
  const GATE_S = D.buildings.find(b => b.id === "GATE-S");
  const start = gridToWorld(GATE_S.grid[0] + GATE_S.grid[2] / 2, GATE_S.grid[1] - 6);
  const WALK_SPEED = 260, JOG_SPEED = 400, RUN_SPEED = 520;
  const player = {
    wx: start.x, wy: start.y, phase: 0, idleT: 0, moving: false,
    running: false, runLock: false, facing: "down", dustT: 0,
    navPath: null, navName: "", mvx: 0, mvy: 1
  };
  const dust = [];
  function spawnDust() {
    dust.push({
      x: player.wx - player.mvx * 12 + (Math.random() - 0.5) * 8,
      y: player.wy - player.mvy * 12 + (Math.random() - 0.5) * 8,
      vx: -player.mvx * 24 + (Math.random() - 0.5) * 16,
      vy: -player.mvy * 24 + (Math.random() - 0.5) * 16,
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
    { id: "FIELD-N", gateSide: "gymax", gateT: 0.52, zone: "北操场" },
    { id: "FIELD-W", gateSide: "gxmax", gateT: 0.5, zone: "风雨操场" }
  ];
  const fences = FIELDS.map(cfg => {
    const b = D.buildings.find(x => x.id === cfg.id);
    const [fx, fy, fw, fh] = b.grid;
    let cx, cy;
    if (cfg.gateSide === "gxmin" || cfg.gateSide === "gxmax") {
      cx = cfg.gateSide === "gxmin" ? fx : fx + fw; cy = fy + fh * cfg.gateT;
    } else {
      cx = fx + fw * cfg.gateT; cy = cfg.gateSide === "gymin" ? fy : fy + fh;
    }
    return { id: cfg.id, b, rect: b.grid, zone: cfg.zone, g: { side: cfg.gateSide, cx, cy }, open: 0, inside: false };
  });
  function inGap(cx, cy, g) {
    if (g.side === "gxmin" || g.side === "gxmax")
      return Math.abs(cx - g.cx) < FENCE_WALL + 0.5 && cy > g.cy - GATE_HALF && cy < g.cy + GATE_HALF;
    return Math.abs(cy - g.cy) < FENCE_WALL + 0.5 && cx > g.cx - GATE_HALF && cx < g.cx + GATE_HALF;
  }
  function fenceBlocked(gx, gy, F) {
    const [fx, fy, fw, fh] = F.rect, w = FENCE_WALL;
    if (gx < fx - w || gx > fx + fw + w || gy < fy - w || gy > fy + fh + w) return false;
    if (gx > fx + w && gx < fx + fw - w && gy > fy + w && gy < fy + fh - w) return false;
    let on = false;
    if (Math.abs(gx - fx) < w && gy > fy && gy < fy + fh) on = true;
    if (Math.abs(gx - (fx + fw)) < w && gy > fy && gy < fy + fh) on = true;
    if (Math.abs(gy - fy) < w && gx > fx && gx < fx + fw) on = true;
    if (Math.abs(gy - (fy + fh)) < w && gx > fx && gx < fx + fw) on = true;
    return on && !inGap(gx, gy, F.g);
  }
  function insideField(gx, gy, F) {
    const [fx, fy, fw, fh] = F.rect;
    return gx > fx && gx < fx + fw && gy > fy && gy < fy + fh;
  }
  function blockedAt(gx, gy, pad) {
    if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
    for (const b of D.buildings) {
      if (b.walkable) continue;
      const [x, y, w, h] = b.collider;
      if (gx > x - pad && gx < x + w + pad && gy > y - pad && gy < y + h + pad) return true;
    }
    for (const F of fences) if (fenceBlocked(gx, gy, F)) return true;
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
  function nearestOpen(gx, gy) {
    const pg = worldToGrid(player.wx, player.wy);
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
    const [gx, gy, gw, gh] = b.grid;
    const m = 2.4, step = 2, pts = [];
    for (let x = gx - m; x <= gx + gw + m; x += step) {
      pts.push({ gx: x, gy: gy - m }); pts.push({ gx: x, gy: gy + gh + m });
    }
    for (let y = gy - m; y <= gy + gh + m; y += step) {
      pts.push({ gx: gx - m, gy: y }); pts.push({ gx: gx + gw + m, gy: y });
    }
    const pg = worldToGrid(player.wx, player.wy);
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
    player.navPath = gridPath.map(([gxx, gyy]) => gridToWorld(gxx, gyy));
    player.navName = name || "";
    navStuck = 0; follow = true; updateFollowBtn();
    setNavTip(name ? "正在前往：" + name : "自动寻路中", false);
  }
  function navigateToPoint(gx, gy) {
    const t = nearestOpen(gx, gy);
    if (!t) { setNavTip("无法到达那里", true); return; }
    startNav(bfs(worldToGrid(player.wx, player.wy), t));
  }
  function navigateToBuilding(b) {
    const pg = worldToGrid(player.wx, player.wy);
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
    const gAll = worldToGrid(nx, ny);
    if (!blockedAt(gAll.gx, gAll.gy, PAD)) { player.wx = nx; player.wy = ny; }
    else {
      const gx = worldToGrid(nx, player.wy);
      if (!blockedAt(gx.gx, gx.gy, PAD)) player.wx = nx;
      const gy = worldToGrid(player.wx, ny);
      if (!blockedAt(gy.gx, gy.gy, PAD)) player.wy = ny;
    }
    return Math.hypot(player.wx - ox, player.wy - oy);
  }
  function updatePlayer(dt) {
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
      if (dist < 14) {
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
    const pg = worldToGrid(player.wx, player.wy);
    const k = Math.min(1, dt * 5);
    for (const F of fences) {
      const g = F.g;
      const dist = Math.hypot(pg.gx - g.cx, pg.gy - g.cy);
      F.open += ((dist < GATE_HALF + 5.5 ? 1 : 0) - F.open) * k;
      const nowIn = insideField(pg.gx, pg.gy, F);
      if (nowIn && !F.inside) showZone("进入 · " + F.zone, "由入口门进入，场内可自由行走");
      F.inside = nowIn;
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
    for (const b of D.buildings) {
      const [gx, gy, gw, gh] = b.grid;
      if (g.gx >= gx && g.gx <= gx + gw && g.gy >= gy && g.gy <= gy + gh) { showInfo(b); return; }
    }
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
    dbg: { blockedAt, bfs, nearestOpen, openSpotsAround, fences }
  };

  // ---------- 绘制：地面 ----------
  function drawGround() {
    // 概览：整幅低分辨率预渲染
    const gw = WORLD_W * view.zoom, gh = WORLD_H * view.zoom;
    const gx0 = w2sX(GX0 * TILE), gy0 = w2sY(GY0 * TILE);
    ctx.imageSmoothingEnabled = view.zoom < 0.5;
    ctx.drawImage(groundPre, gx0, gy0, gw, gh);
    // 近景：叠清晰 tile
    if (view.zoom >= 0.4) {
      const x0 = s2wX(0), y0 = s2wY(0), x1 = s2wX(window.innerWidth), y1 = s2wY(window.innerHeight);
      const g0x = Math.floor(x0 / TILE), g1x = Math.ceil(x1 / TILE);
      const g0y = Math.floor(y0 / TILE), g1y = Math.ceil(y1 / TILE);
      for (let gx = g0x; gx <= g1x; gx++) for (let gy = g0y; gy <= g1y; gy++) {
        if (gx < ix0 || gx > ix1 || gy < iy0 || gy > iy1) continue;
        const t = cellType[ci(gx, gy)];
        const tw = TILE * view.zoom;
        ctx.drawImage([TILES.grass_a, TILES.grass_b, TILES.dirt, TILES.pave, TILES.jct, TILES.water][t],
          w2sX(gx * TILE), w2sY(gy * TILE), tw + 1, tw + 1);
      }
    }
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
      const x = w2sX(p.x), y = w2sY(p.y);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const end = pts[pts.length - 1];
    ctx.fillStyle = "rgba(45,108,223,.95)";
    ctx.beginPath(); ctx.arc(w2sX(end.x), w2sY(end.y), Math.max(4, 8 * z), 0, 7); ctx.fill();
    ctx.restore();
  }
  function drawDust() {
    const z = view.zoom;
    if (z < 0.12 || !dust.length) return;
    for (const p of dust) {
      const a = Math.max(0, p.life / p.max);
      const r = p.s * z * (1.7 - a * 0.7);
      ctx.fillStyle = "rgba(214,198,160," + (0.55 * a).toFixed(3) + ")";
      ctx.fillRect(w2sX(p.x) - r / 2, w2sY(p.y) - r / 2, r, r);
    }
  }

  // ---------- 绘制：建筑（占位方块 / 真实 sprite） ----------
  const RISE = { teaching: 144, lab: 144, library: 144, college: 144, service: 144, activity: 144,
    canteen: 120, gym: 96, gate: 72, field: 0, nature: 200 };
  function anchorOf(b) {
    const [fx, fy, fw, fh] = b.grid;
    return { x: (fx + fw / 2) * TILE, y: (fy + fh) * TILE };
  }
  function drawBuilding(b) {
    const z = view.zoom;
    const [fx, fy, fw, fh] = b.grid;
    const an = anchorOf(b);
    const real = spriteImgs[b.id];
    if (real) {
      const w = real.width * z, h = real.height * z;
      ctx.imageSmoothingEnabled = z < 0.85;
      ctx.drawImage(real, an.x * z + view.x - w / 2, an.y * z + view.y - h, w, h);
      ctx.imageSmoothingEnabled = true;
      return;
    }
    // 占位方块：footprint + 南立面
    const x0 = w2sX(fx * TILE), y0 = w2sY(fy * TILE);
    const wpx = fw * TILE * z, hpx = fh * TILE * z;
    const rise = (RISE[b.cat] || 120) * z;
    const col = b.walkable ? "#5f9e4a" : (GROUP_COLOR[b.group] || "#9fb4d8");
    ctx.fillStyle = col;
    ctx.fillRect(x0, y0, wpx, hpx);
    // 南立面（底部 rise 高的暗带）；walkable 场地为平地，不画
    if (!b.walkable) {
      ctx.fillStyle = "rgba(40,40,50,.45)";
      ctx.fillRect(x0, y0 + hpx - rise, wpx, rise);
    }
    ctx.strokeStyle = "#2e2418"; ctx.lineWidth = Math.max(1, 2 * z);
    ctx.strokeRect(x0, y0, wpx, hpx);
  }

  // ---------- 绘制：围栏 + 像素门（top-down 俯视木栏） ----------
  function drawFences(F) {
    const z = view.zoom;
    if (z < 0.1) return;
    const [fx, fy, fw, fh] = F.rect;
    const th = Math.max(3, 6 * z);          // 围栏条带厚度
    ctx.fillStyle = "#8a6238";
    ctx.strokeStyle = "#6b4a28"; ctx.lineWidth = Math.max(1, 1.5 * z);
    const seg = (x0, y0, x1, y1) => {
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    };
    const X = gx => w2sX(gx * TILE), Y = gy => w2sY(gy * TILE);
    // 四边围栏（缺口在门侧，留 GATE_HALF 宽缺口）
    const gapL = (side) => {
      if (side === "gymax") return { a: F.g.cx - GATE_HALF, b: F.g.cx + GATE_HALF };
      if (side === "gymin") return { a: fx + fw * 0.5 - GATE_HALF, b: fx + fw * 0.5 + GATE_HALF };
      if (side === "gxmax") return { a: F.g.cy - GATE_HALF, b: F.g.cy + GATE_HALF };
      return { a: fy + fh * 0.5 - GATE_HALF, b: fy + fh * 0.5 + GATE_HALF };
    };
    const gA = gapL(F.g.side);
    // 北缘
    seg(X(fx), Y(fy) - th / 2, X(fx + fw), Y(fy) + th / 2);
    // 南缘（门在这侧）
    if (F.g.side === "gymax") {
      seg(X(fx), Y(fy + fh) - th / 2, X(gA.a), Y(fy + fh) + th / 2);
      seg(X(gA.b), Y(fy + fh) - th / 2, X(fx + fw), Y(fy + fh) + th / 2);
    } else {
      seg(X(fx), Y(fy + fh) - th / 2, X(fx + fw), Y(fy + fh) + th / 2);
    }
    // 西缘
    if (F.g.side === "gxmin") {
      seg(X(fx) - th / 2, Y(fy), X(fx) + th / 2, Y(gA.a));
      seg(X(fx) - th / 2, Y(gA.b), X(fx) + th / 2, Y(fy + fh));
    } else {
      seg(X(fx) - th / 2, Y(fy), X(fx) + th / 2, Y(fy + fh));
    }
    // 东缘
    if (F.g.side === "gxmax") {
      seg(X(fx + fw) - th / 2, Y(fy), X(fx + fw) + th / 2, Y(gA.a));
      seg(X(fx + fw) - th / 2, Y(gA.b), X(fx + fw) + th / 2, Y(fy + fh));
    } else {
      seg(X(fx + fw) - th / 2, Y(fy), X(fx + fw) + th / 2, Y(fy + fh));
    }
    // 门柱 + 滑动门板
    const open = F.open;
    const py = Y(F.g.cy);
    const pw = GATE_HALF * TILE * z;
    ctx.fillStyle = "#6b4a28";
    ctx.fillRect(X(F.g.cx - GATE_HALF) - th, py - th * 1.4, th * 2, th * 2.8);
    ctx.fillRect(X(F.g.cx + GATE_HALF) - th, py - th * 1.4, th * 2, th * 2.8);
    // 两扇门页沿缝隙轴滑开
    if (F.g.side === "gymax" || F.g.side === "gymin") {
      const yy = py - th / 2;
      ctx.fillStyle = "#a67c4c";
      ctx.fillRect(X(F.g.cx - GATE_HALF) + open * pw, yy, pw, th);
      ctx.fillRect(X(F.g.cx + GATE_HALF) - open * pw - pw, yy, pw, th);
    } else {
      ctx.fillStyle = "#a67c4c";
      ctx.fillRect(X(F.g.cx) - th / 2, Y(F.g.cy - GATE_HALF) + open * pw, th, pw);
      ctx.fillRect(X(F.g.cx) - th / 2, Y(F.g.cy + GATE_HALF) - open * pw - pw, th, pw);
    }
  }

  // ---------- 绘制：装饰树 ----------
  const DECOR = [
    { id: "tree", gx: 95.5, gy: 31.5 },   // FIELD-N 西北角
    { id: "tree", gx: 107.5, gy: 31.5 },  // FIELD-N 东北侧外
    { id: "tree", gx: 92.0, gy: 40.0 }    // 西侧
  ];
  function drawDecor() {
    const z = view.zoom;
    for (const d of DECOR) {
      const im = spriteImgs[d.id];
      if (!im) continue;
      const an = gridToWorld(d.gx, d.gy);
      const w = im.width * z, h = im.height * z;
      ctx.imageSmoothingEnabled = z < 0.85;
      ctx.drawImage(im, an.x * z + view.x - w / 2, an.y * z + view.y - h, w, h);
      ctx.imageSmoothingEnabled = true;
    }
  }

  // ---------- 绘制：角色 ----------
  function drawPlayer() {
    const g = worldToGrid(player.wx, player.wy);
    const sx = w2sX(player.wx), sy = w2sY(player.wy);
    const z = view.zoom;
    if (z < 0.12) {
      ctx.fillStyle = player.running ? "#ffd25a" : "#5b4a6b";
      ctx.beginPath(); ctx.arc(sx, sy, player.running ? 4.5 : 3.5, 0, 7); ctx.fill();
      return g.gy * 1000 + g.gx;
    }
    const fw = FRAME_W * z, fh = FRAME_H * z;
    const frames = walkFrames[player.facing];
    const fi = player.moving ? (Math.floor(player.phase) % 4) : 0;
    const pimg = frames && frames[fi];
    let bob = 0;
    if (player.moving) {
      const amp = player.running ? 3.6 : 1.8;
      bob = -Math.abs(Math.sin(player.phase * Math.PI / 2)) * amp * z;
    } else bob = -Math.sin(player.idleT * 1.8) * 1.0 * z;
    // 影子
    ctx.fillStyle = "rgba(20,30,40,.3)";
    ctx.beginPath(); ctx.ellipse(sx, sy, 9 * z, 3.6 * z, 0, 0, 7); ctx.fill();
    if (pimg) {
      ctx.imageSmoothingEnabled = z < 0.85;
      ctx.save();
      ctx.translate(sx, sy + bob);
      if (player.running) {
        if (player.facing === "right") ctx.rotate(0.14);
        else if (player.facing === "left") ctx.rotate(-0.14);
        else if (player.facing === "down") ctx.scale(1.05, 0.92);
        else ctx.scale(1.03, 0.97);
      }
      ctx.drawImage(pimg, -fw / 2, -fh, fw, fh);
      ctx.restore();
      ctx.imageSmoothingEnabled = true;
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
      const an = anchorOf(b);
      const lx = w2sX(an.x), ly = w2sY(an.y) - (RISE[b.cat] || 120) * z - 8;
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

  // ---------- 小地图（方形 top-down） ----------
  function mmTransform() {
    const pad = 4;
    const s = Math.min((MM_W - 2 * pad) / WORLD_W, (MM_H - 2 * pad) / WORLD_H);
    return { s, ox: (MM_W - WORLD_W * s) / 2, oy: (MM_H - WORLD_H * s) / 2 };
  }
  function drawMinimap() {
    const { s, ox, oy } = mmTransform();
    mmCtx.clearRect(0, 0, MM_W, MM_H);
    mmCtx.drawImage(groundPre, ox, oy, WORLD_W * s, WORLD_H * s);
    const w2m = (wx, wy) => ({ x: ox + wx * s, y: oy + wy * s });
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
      const m = w2m(anchorOf(b).x, anchorOf(b).y);
      mmCtx.fillStyle = GROUP_COLOR[b.group] || "#9fb4d8";
      mmCtx.fillRect(m.x - 1.6, m.y - 1.6, 3.2, 3.2);
    }
    const c0 = w2m(s2wX(0), s2wY(0)), c1 = w2m(s2wX(window.innerWidth), s2wY(window.innerHeight));
    mmCtx.fillStyle = "rgba(255,255,255,.07)";
    mmCtx.fillRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    mmCtx.strokeStyle = "rgba(255,255,255,.75)"; mmCtx.lineWidth = 1;
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
    const wx = (mx - ox) / s, wy = (my - oy) / s;
    follow = false; updateFollowBtn();
    view.x = window.innerWidth / 2 - wx * view.zoom;
    view.y = window.innerHeight / 2 - wy * view.zoom;
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
      const an = anchorOf(b);
      drawList.push({ kind: "b", depth: an.y / TILE * 1000 + an.x / TILE, b });
    }
    for (const F of fences) drawList.push({ kind: "f", depth: F.g.cy * 1000 + F.g.cx, F });
    for (const d of DECOR) drawList.push({ kind: "d", depth: d.gy * 1000 + d.gx });
    const pg = worldToGrid(player.wx, player.wy);
    drawList.push({ kind: "p", depth: pg.gy * 1000 + pg.gx });
    drawList.sort((a, b) => a.depth - b.depth);
    for (const it of drawList) {
      if (it.kind === "b") drawBuilding(it.b);
      else if (it.kind === "f") drawFences(it.F);
      else if (it.kind === "p") drawPlayer();
    }
    drawLabels();
    drawMinimap();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    updatePlayer(dt);
    updateGates(dt);
    if (follow) {
      view.x += window.innerWidth * 0.5 - w2sX(player.wx);
      view.y += window.innerHeight * 0.62 - w2sY(player.wy);
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
    document.getElementById("loading").style.display = "none";
    requestAnimationFrame(frame);
  });
})();

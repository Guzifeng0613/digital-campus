/* 北化昌平校区 · 等距像素数字校园 — 浏览器预览器
   地面底图 + 16 透明建筑 sprite（等距坐标 + 深度排序）+ 角色行走（碰撞/遮挡）。 */
(function () {
  "use strict";
  const D = window.CAMPUS_DATA;
  const M = D.meta;
  const [OX, OY] = M.origin;
  const [SX, SY] = M.tile;                 // 22, 11
  const [GX0, GY0, GX1, GY1] = M.gridRange;
  const [GW, GH] = M.groundSize;

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
  const view = { x: 0, y: 0, zoom: 0.1 };
  let follow = false;
  function fitZoom() {
    const [x0, y0, x1, y1] = M.diamond;
    return Math.min(
      (window.innerWidth * 0.96) / (x1 - x0),
      (window.innerHeight * 0.96) / (y1 - y0)
    );
  }
  function centerView() {
    view.zoom = fitZoom();
    const [x0, y0, x1, y1] = M.diamond;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    view.x = window.innerWidth / 2 - cx * view.zoom;
    view.y = window.innerHeight / 2 - cy * view.zoom;
  }
  function w2sX(wx) { return wx * view.zoom + view.x; }
  function w2sY(wy) { return wy * view.zoom + view.y; }
  function s2wX(sx) { return (sx - view.x) / view.zoom; }
  function s2wY(sy) { return (sy - view.y) / view.zoom; }
  function gridToWorld(gx, gy) { return { x: (gx - gy) * SX + OX, y: (gx + gy) * SY + OY }; }
  function worldToGrid(wx, wy) {
    const u = (wx - OX) / SX, v = (wy - OY) / SY;
    return { gx: (u + v) / 2, gy: (v - u) / 2 };
  }

  // ---------- 加载图片 ----------
  const images = {};
  function loadAll() {
    const list = [M.ground, ...D.buildings.map(b => b.img)];
    const pct = document.getElementById("pct");
    let n = 0;
    return Promise.all(list.map(src => new Promise(res => {
      const img = new Image();
      img.onload = () => { images[src] = img; n++; pct.textContent = Math.round(n / list.length * 100) + "%"; res(); };
      img.onerror = () => { n++; pct.textContent = Math.round(n / list.length * 100) + "%"; res(); };
      img.src = src;
    })));
  }

  // ---------- chibi 像素角色帧（4方向×4帧，走路 / 跑步各一套） ----------
  // 走路帧为现有 player_<dir>_<f>.png；跑步帧为可选的 player_run_<dir>_<f>.png，
  // 若缺失则在渲染时用走路帧 + 前倾 / 急促起伏 / 扬尘程序化表现跑步。
  const FRAME_W = 88, FRAME_H = 110;   // 角色帧绘制尺寸（原 64×80，整体放大约 1.37 倍）
  const walkFrames = {};
  const runFrames = {};
  function loadFrameSet(dir, f, prefix) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = "img/player/" + prefix + dir + "_" + f + ".png";
    });
  }
  function loadPlayerFrames() {
    const dirs = ["down", "up", "left", "right"];
    return Promise.all(dirs.map(dir =>
      Promise.all([0, 1, 2, 3].map(f => loadFrameSet(dir, f, "player_")))
        .then(arr => { walkFrames[dir] = arr; })
        .then(() => Promise.all([0, 1, 2, 3].map(f => loadFrameSet(dir, f, "player_run_"))))
        .then(arr => { runFrames[dir] = arr; })
    ));
  }

  // ---------- 角色 ----------
  const GATE_S = D.buildings.find(b => b.id === "GATE-S");
  // 起点：南门内侧
  const start = gridToWorld(GATE_S.grid[0] + 6, GATE_S.grid[1] - 6);
  const WALK_SPEED = 300;      // 走路速度（世界像素/秒）
  const JOG_SPEED = 460;       // 自动寻路默认慢跑速度
  const RUN_SPEED = 540;       // 跑步速度
  const player = {
    wx: start.x, wy: start.y,
    phase: 0,              // 步态相位（连续累加，驱动帧索引与起伏）
    idleT: 0,              // 站立呼吸计时
    moving: false,
    running: false,        // 当前是否为跑步姿态（前倾/快步/扬尘）
    runLock: false,        // 跑步开关（按钮 / Shift 切换）
    facing: "down",        // up/down/left/right
    dustT: 0,              // 扬尘粒子生成计时
    navPath: null,         // 自动寻路：世界坐标点数组（含当前点）
    navName: "",           // 目标名（提示用）
  };
  // 扬尘粒子（跑步时脚后扬起的小土点，世界坐标）
  const dust = [];
  function spawnDust(backUx, backUy) {
    dust.push({
      x: player.wx + backUx * 14 + (Math.random() - 0.5) * 8,
      y: player.wy + backUy * 14 + (Math.random() - 0.5) * 6,
      vx: backUx * 26 + (Math.random() - 0.5) * 18,
      vy: backUy * 26 + (Math.random() - 0.5) * 18 - 6,
      life: 0.55, max: 0.55, s: 2.2 + Math.random() * 2.2
    });
  }
  function updateDust(dt) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.life -= dt;
      if (p.life <= 0) { dust.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.9; p.vy *= 0.9;
    }
  }
  const keys = {};
  const stick = { x: 0, y: 0, mag: 0 };  // 移动端虚拟摇杆方向（屏幕坐标，右 x+ / 下 y+）+ 力度
  const PAD = 1.0;         // 角色碰撞半径（网格单位）

  // ---------- 场地围栏 + 唯一入口（只能从门进） ----------
  // 操场 walkable，但用一圈围栏围住，仅在靠道路一侧留一个门缺口；
  // 场内可自由行走，场外无法穿过围栏，寻路会自动绕到门。
  const FENCE_WALL = 1.0;    // 围栏碰撞厚度（网格）
  const GATE_HALF = 3.3;     // 门缺口半宽（网格）
  const FIELDS = [
    { id: "FIELD-N", gateSide: "gymax", gateT: 0.52, zone: "北操场（东田径场）" },
    { id: "FIELD-W", gateSide: "gxmax", gateT: 0.5,  zone: "风雨操场（西田径场）" }
  ];
  const fences = FIELDS.map(cfg => {
    const b = D.buildings.find(x => x.id === cfg.id);
    const [fx, fy, fw, fh] = b.grid;
    const g = { side: cfg.gateSide };
    if (cfg.gateSide === "gxmin" || cfg.gateSide === "gxmax") {
      g.cx = cfg.gateSide === "gxmin" ? fx : fx + fw;
      g.cy = fy + fh * cfg.gateT;
    } else {
      g.cx = fx + fw * cfg.gateT;
      g.cy = cfg.gateSide === "gymin" ? fy : fy + fh;
    }
    const w = gridToWorld(g.cx, g.cy);
    if (cfg.gateSide === "gxmin" || cfg.gateSide === "gxmax") {
      g.along = { gx: 0, gy: 1 };
      g.out = { gx: cfg.gateSide === "gxmax" ? 1 : -1, gy: 0 };
    } else {
      g.along = { gx: 1, gy: 0 };
      g.out = { gx: 0, gy: cfg.gateSide === "gymax" ? 1 : -1 };
    }
    g.wx = w.x; g.wy = w.y;
    return { id: cfg.id, b, rect: b.grid, zone: cfg.zone, g, open: 0, inside: false };
  });

  // 校门（校园边缘的门，只做开合动画 + 欢迎语，不真正走出校园）
  const CAMPUS_GATES = [
    { id: "GATE-S", side: "gymin", t: 0.5, label: "南门（主校门）" },
    { id: "GATE-E", side: "gxmin", t: 0.5, label: "东门（车行出入口）" },
    { id: "GATE-W", side: "gxmax", t: 0.5, label: "西门" }
  ].map(cfg => {
    const b = D.buildings.find(x => x.id === cfg.id);
    const [fx, fy, fw, fh] = b.grid;
    let cx, cy, along, out;
    if (cfg.side === "gxmin" || cfg.side === "gxmax") {
      cx = cfg.side === "gxmin" ? fx : fx + fw; cy = fy + fh * cfg.t;
      along = { gx: 0, gy: 1 }; out = { gx: cfg.side === "gxmax" ? 1 : -1, gy: 0 };
    } else {
      cx = fx + fw * cfg.t; cy = cfg.side === "gymin" ? fy : fy + fh;
      along = { gx: 1, gy: 0 }; out = { gx: 0, gy: cfg.side === "gymax" ? 1 : -1 };
    }
    const w = gridToWorld(cx, cy);
    return { id: cfg.id, b, label: cfg.label, cx, cy, along, out, wx: w.x, wy: w.y, open: 0, greeted: false };
  });

  function inGap(cx, cy, g) {
    if (g.side === "gxmin" || g.side === "gxmax") {
      return Math.abs(cx - g.cx) < FENCE_WALL + 0.5 && cy > g.cy - GATE_HALF && cy < g.cy + GATE_HALF;
    }
    return Math.abs(cy - g.cy) < FENCE_WALL + 0.5 && cx > g.cx - GATE_HALF && cx < g.cx + GATE_HALF;
  }
  function fenceBlocked(gx, gy, F) {
    const [fx, fy, fw, fh] = F.rect;
    const w = FENCE_WALL;
    if (gx < fx - w || gx > fx + fw + w || gy < fy - w || gy > fy + fh + w) return false;
    if (gx > fx + w && gx < fx + fw - w && gy > fy + w && gy < fy + fh - w) return false;
    let on = false;
    if (Math.abs(gx - fx) < w && gy > fy && gy < fy + fh) on = true;
    if (Math.abs(gx - (fx + fw)) < w && gy > fy && gy < fy + fh) on = true;
    if (Math.abs(gy - fy) < w && gx > fx && gx < fx + fw) on = true;
    if (Math.abs(gy - (fy + fh)) < w && gx > fx && gx < fx + fw) on = true;
    if (!on) return false;
    return !inGap(gx, gy, F.g);
  }
  function insideField(gx, gy, F) {
    const [fx, fy, fw, fh] = F.rect;
    return gx > fx && gx < fx + fw && gy > fy && gy < fy + fh;
  }

  function blocked(gx, gy) {
    if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
    for (const b of D.buildings) {
      if (b.walkable) continue;
      const [x, y, w, h] = b.collider;
      if (gx > x - PAD && gx < x + w + PAD && gy > y - PAD && gy < y + h + PAD) return true;
    }
    for (const F of fences) if (fenceBlocked(gx, gy, F)) return true;
    return false;
  }

  // ---------- 自动寻路（旋转坐标 BFS，8 方向） ----------
  // 道路沿屏幕上下左右（即等距网格 gx,gy 的对角方向），故在旋转坐标
  //   u = gx + gy（屏幕向下）、v = gx - gy（屏幕向右）
  // 上做 BFS，使正交步沿道路走，避免网格对角避障误判贴墙道路。
  const NAV_STEP = 2;          // 最近可达点搜索步长（网格单位）
  const NAV_PAD = 1.0;         // 寻路半径（≥手动 PAD，保证路径可行）
  const MOVES = [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2]];

  function navBlocked(gx, gy) {
    if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
    for (const b of D.buildings) {
      if (b.walkable) continue;
      const [x, y, w, h] = b.collider;
      if (gx > x - NAV_PAD && gx < x + w + NAV_PAD && gy > y - NAV_PAD && gy < y + h + NAV_PAD) return true;
    }
    for (const F of fences) if (fenceBlocked(gx, gy, F)) return true;
    return false;
  }
  const uvBlocked = (u, v) => navBlocked((u + v) / 2, (u - v) / 2);
  function bfs(sg, tg) {
    const U0 = Math.round((sg.gx + sg.gy) / 2) * 2, V0 = Math.round((sg.gx - sg.gy) / 2) * 2;
    const U1 = Math.round((tg.gx + tg.gy) / 2) * 2, V1 = Math.round((tg.gx - tg.gy) / 2) * 2;
    if (uvBlocked(U1, V1)) return null;
    const k = (u, v) => u + "," + v;
    const queue = [[U0, V0]]; let head = 0;
    const prev = new Map([[k(U0, V0), null]]);
    let found = false;
    while (head < queue.length) {
      const [u, v] = queue[head++];
      if (u === U1 && v === V1) { found = true; break; }
      for (const [du, dv] of MOVES) {
        const nu = u + du, nv = v + dv;
        if (uvBlocked(nu, nv)) continue;
        if (du && dv && (uvBlocked(u + du, v) || uvBlocked(u, v + dv))) continue; // 不穿墙角
        if (prev.has(k(nu, nv))) continue;
        prev.set(k(nu, nv), [u, v]);
        queue.push([nu, nv]);
      }
    }
    if (!found) return null;
    const path = []; let cur = [U1, V1];
    while (cur) { path.push([(cur[0] + cur[1]) / 2, (cur[0] - cur[1]) / 2]); cur = prev.get(k(cur[0], cur[1])); }
    path.reverse();
    return path;
  }
  function nearestOpen(gx, gy) {
    const pg = worldToGrid(player.wx, player.wy);
    if (!navBlocked(gx, gy)) return { gx, gy };
    for (let ring = 1; ring <= 10; ring++) {
      let best = null, bd = Infinity;
      for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = gx + dx * NAV_STEP, y = gy + dy * NAV_STEP;
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
    navStuck = 0;
    follow = true; updateFollowBtn();
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

  // 轴分离移动（碰撞检测），返回实际是否发生位移
  function moveBy(ux, uy, v) {
    const ox = player.wx, oy = player.wy;
    const nx = player.wx + ux * v, ny = player.wy + uy * v;
    const gAll = worldToGrid(nx, ny);
    if (!blocked(gAll.gx, gAll.gy)) { player.wx = nx; player.wy = ny; }
    else {
      const gx = worldToGrid(nx, player.wy);
      if (!blocked(gx.gx, gx.gy)) player.wx = nx;
      const gy = worldToGrid(player.wx, ny);
      if (!blocked(gy.gx, gy.gy)) player.wy = ny;
    }
    return Math.hypot(player.wx - ox, player.wy - oy);
  }
  // 跑步时脚后扬尘
  function emitDust(dt, fast) {
    player.dustT += dt;
    const interval = fast ? 0.1 : 0.2;
    if (player.dustT >= interval) {
      player.dustT = 0;
      spawnDust(-player.mvx, -player.mvy);
      if (fast) spawnDust(-player.mvx, -player.mvy);
    }
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
      player.running = wantRun;
      player.moving = true;
      const speed = wantRun ? RUN_SPEED : WALK_SPEED;
      moveBy(dx, dy, speed * dt);
      player.phase += dt * (wantRun ? 14.5 : 9);
      player.idleT = 0;
      if (wantRun) emitDust(dt, true);
      follow = true; updateFollowBtn();
    } else if (player.navPath && player.navPath.length) {
      // 自动沿路径点移动：默认慢跑（距离远），跑步开关开启时快跑
      const fast = !!player.runLock;
      const speed = fast ? RUN_SPEED : JOG_SPEED;
      const tgt = player.navPath[0];
      const ddx = tgt.x - player.wx, ddy = tgt.y - player.wy;
      const dist = Math.hypot(ddx, ddy);
      const R = 12;
      if (dist < R) {
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
        player.running = true;          // 寻路为慢跑/快跑姿态
        player.moving = true;
        const v = Math.min(speed * dt, dist);
        const moved = moveBy(ux, uy, v);
        if (moved < v * 0.25) {
          navStuck++;
          if (navStuck > 10) { player.navPath.shift(); navStuck = 0; }
        } else navStuck = 0;
        player.phase += dt * (fast ? 14.5 : 11.5);
        player.idleT = 0;
        emitDust(dt, fast);
        follow = true; updateFollowBtn();
      }
    } else {
      player.moving = false;
      player.running = false;
      player.idleT += dt;
      navStuck = 0;
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
      const target = dist < GATE_HALF + 5.5 ? 1 : 0;
      F.open += (target - F.open) * k;
      const nowIn = insideField(pg.gx, pg.gy, F);
      if (nowIn && !F.inside) showZone("进入 · " + F.zone, "由入口进入，操场内可自由行走");
      F.inside = nowIn;
    }
    for (const gt of CAMPUS_GATES) {
      const d = Math.hypot(pg.gx - gt.cx, pg.gy - gt.cy);
      const target = d < 7 ? 1 : 0;
      gt.open += (target - gt.open) * k;
      if (target && !gt.greeted) {
        gt.greeted = true;
        setNavTip("已到达" + gt.label + "，校园外部暂未开放", true);
      } else if (!target && d > 9.5) {
        gt.greeted = false;
      }
    }
  }

  // ---------- 输入 ----------
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

  // 触摸设备标记（显示虚拟摇杆 / 移动提示）
  const isTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
                  "ontouchstart" in window ||
                  (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  if (isTouch) document.body.classList.add("touch");

  // ---------- 虚拟摇杆（移动端控制角色） ----------
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
    e.preventDefault();
    joyZone.setPointerCapture(e.pointerId);
    joyId = e.pointerId;
    const r = joyBase.getBoundingClientRect();
    joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
    joyR = r.width / 2 - 24;
    setJoy(e);
  });
  joyZone.addEventListener("pointermove", e => { if (e.pointerId === joyId) setJoy(e); });
  joyZone.addEventListener("pointerup", resetJoy);
  joyZone.addEventListener("pointercancel", resetJoy);

  // 多指针：鼠标/单指拖拽与点击，双指捏合缩放 + 中点平移
  const pointers = new Map();
  let dragging = false, moved = false, lastX = 0, lastY = 0;
  let pinch = null;                                   // {dist, cx, cy}
  let multiTouch = false;                             // 本次手势进入过双指，最终不触发点击
  const ptDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true; moved = false; multiTouch = false;
      lastX = e.clientX; lastY = e.clientY;
      canvas.classList.add("dragging");
    } else if (pointers.size === 2) {
      dragging = false; canvas.classList.remove("dragging");
      const p = [...pointers.values()];
      pinch = { dist: ptDist(p[0], p[1]), cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 };
      moved = true; multiTouch = true;               // 双指操作不当作点击
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
      pinch = { dist, cx, cy };
      follow = false; updateFollowBtn();
    } else if (dragging && pointers.size === 1) {
      const ddx = cur.x - prev.x, ddy = cur.y - prev.y;
      if (Math.abs(ddx) + Math.abs(ddy) > 4) { moved = true; follow = false; updateFollowBtn(); }
      view.x += ddx; view.y += ddy;
      lastX = cur.x; lastY = cur.y;
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
      // 双指抬起一指后切回单指：重置拖拽起点，且不触发点击
      const p = [...pointers.values()][0];
      pinch = null; dragging = true; moved = true; lastX = p.x; lastY = p.y;
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(e.clientX, e.clientY, f);
  }, { passive: false });

  function zoomAt(cx, cy, f) {
    const nz = Math.min(4, Math.max(0.04, view.zoom * f));
    const wx = s2wX(cx), wy = s2wY(cy);
    view.zoom = nz;
    view.x = cx - wx * nz; view.y = cy - wy * nz;
  }

  // 点击建筑命中：屏幕点逆变换到网格，判定落在哪个地块菱形内（地块不重叠）
  function handleClick(cx, cy) {
    const g = worldToGrid(s2wX(cx), s2wY(cy));
    for (const b of D.buildings) {
      const [gx, gy, gw, gh] = b.grid;
      if (g.gx >= gx && g.gx <= gx + gw && g.gy >= gy && g.gy <= gy + gh) { showInfo(b); return; }
    }
    // 点空地：自动寻路过去
    navigateToPoint(g.gx, g.gy);
  }
  // 调试/测试钩子
  window.__map = {
    view,
    worldToScreen: (wx, wy) => ({ x: w2sX(wx), y: w2sY(wy) }),
    buildings: D.buildings, player,
    select: b => showInfo(b),
    gridToWorld, worldToGrid,
    gotoBuilding: id => { const b = D.buildings.find(x => x.id === id); if (b) navigateToBuilding(b); },
    gotoPoint: (gx, gy) => navigateToPoint(gx, gy),
    _pointerCount: () => pointers.size
  };

  // ---------- 信息卡 ----------
  const GROUP_CN = {
    teaching: "教学科研", public: "公共服务", sports: "体育",
    dining: "餐饮", gate: "校门", nature: "自然地标"
  };
  let currentBuilding = null;
  function showInfo(b) {
    currentBuilding = b;
    const iImg = document.getElementById("iImg");
    iImg.src = b.img;
    iImg.alt = b.name;
    document.getElementById("iNo").textContent = "点位 " + String(b.no).padStart(2, "0") + " · " + b.id;
    document.getElementById("iName").textContent = b.name;
    document.getElementById("iTag").textContent = GROUP_CN[b.group] || b.group;
    document.getElementById("iDesc").textContent = b.desc || "（暂无介绍）";
    document.getElementById("info").classList.add("show");
  }
  document.getElementById("infoClose").onclick = () =>
    document.getElementById("info").classList.remove("show");
  document.getElementById("btnGoto").onclick = () => {
    if (currentBuilding) navigateToBuilding(currentBuilding);
  };

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

  // ---------- 扬尘（地面层，跑步脚后） ----------
  function drawDust() {
    const z = view.zoom;
    if (z < 0.12 || !dust.length) return;
    for (const p of dust) {
      const a = Math.max(0, p.life / p.max);
      const x = w2sX(p.x), y = w2sY(p.y);
      const r = p.s * z * (1.7 - a * 0.7);
      ctx.fillStyle = "rgba(214,198,160," + (0.55 * a).toFixed(3) + ")";
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }

  // ---------- chibi 像素角色（放大 + 步态起伏 / 呼吸 / 跑步前倾） ----------
  function drawPlayer() {
    const g = worldToGrid(player.wx, player.wy);
    const sx = w2sX(player.wx), sy = w2sY(player.wy);
    const z = view.zoom;
    if (z < 0.12) {                           // 远景只画点
      ctx.fillStyle = player.running ? "#ffd25a" : "#5b4a6b";
      ctx.beginPath(); ctx.arc(sx, sy, player.running ? 4.5 : 3.5, 0, 7); ctx.fill();
      return { depth: g.gx + g.gy };
    }
    const fw = FRAME_W * z, fh = FRAME_H * z; // 放大后的帧尺寸
    const useRun = player.running && runFrames[player.facing] && runFrames[player.facing][0];
    const frames = (useRun ? runFrames : walkFrames)[player.facing];
    const fi = player.moving ? (Math.floor(player.phase) % 4) : 0;
    const pimg = frames && frames[fi] ? frames[fi] : (frames && frames[0]);

    // 步态起伏（抬腿帧身体抬高）/ 站立呼吸
    let bob = 0;
    if (player.moving) {
      const amp = player.running ? 4.4 : 2.2;
      bob = -Math.abs(Math.sin(player.phase * Math.PI / 2)) * amp * z;
    } else {
      bob = -Math.sin(player.idleT * 1.8) * 1.0 * z;
    }
    const lift = player.moving ? Math.abs(Math.sin(player.phase * Math.PI / 2)) : 0;

    // 影子（抬腿离地时变小、变淡）
    const base = (useRun ? 20 : 18) * z;
    const sr = base * (1 - lift * 0.16);
    ctx.fillStyle = "rgba(20,30,40," + (0.3 * (1 - lift * 0.28)).toFixed(3) + ")";
    ctx.beginPath(); ctx.ellipse(sx, sy + 3 * z, sr, sr * 0.36, 0, 0, 7); ctx.fill();

    if (pimg) {
      const oldSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = z < 0.85;     // 放大走像素硬边
      ctx.save();
      ctx.translate(sx, sy + bob);             // 脚点为变换原点
      if (player.running) {
        // 跑步前倾：左右方向绕脚点旋转，上下方向纵向压扁
        if (player.facing === "right") ctx.rotate(0.16);
        else if (player.facing === "left") ctx.rotate(-0.16);
        else if (player.facing === "down") ctx.scale(1.05, 0.92);
        else ctx.scale(1.03, 0.97);
      }
      ctx.drawImage(pimg, -fw / 2, -fh, fw, fh);
      ctx.restore();
      ctx.imageSmoothingEnabled = oldSmooth;
    }
    return { depth: g.gx + g.gy };
  }

  // ---------- 门（操场栅栏门绕轴开 + 校门伸缩门收拢） ----------
  function gScreen(cgx, cgy) {
    const w = gridToWorld(cgx, cgy);
    return { x: w2sX(w.x), y: w2sY(w.y) };
  }
  // 一块竖立栅栏板（地面基线 a→b，向上高度 H）
  function drawFencePanel(a, b, H, z, panel, bar) {
    const h = H * z;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x, b.y - h); ctx.lineTo(a.x, a.y - h); ctx.closePath();
    ctx.fillStyle = panel; ctx.fill();
    ctx.strokeStyle = bar; ctx.lineWidth = Math.max(1, 1.6 * z); ctx.lineCap = "round";
    const N = 5;
    for (let i = 0; i <= N; i++) {
      const tt = i / N, px = a.x + (b.x - a.x) * tt, py = a.y + (b.y - a.y) * tt;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - h); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(a.x, a.y - h); ctx.lineTo(b.x, b.y - h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y - h * 0.55); ctx.lineTo(b.x, b.y - h * 0.55); ctx.stroke();
  }
  function drawPost(p, H, z) {
    const h = H * z;
    ctx.fillStyle = "#2f6b3d";
    ctx.fillRect(p.x - 2.6 * z, p.y - h, 5.2 * z, h);
    ctx.fillStyle = "#3f8a52";
    ctx.fillRect(p.x - 2.6 * z, p.y - h, 1.8 * z, h);
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(p.x - 2.2 * z, p.y - h - 4.5 * z, 4.4 * z, 4.5 * z);
  }
  function drawFieldGate(F) {
    const z = view.zoom;
    if (z < 0.1) return;
    const g = F.g;
    const theta = F.open * Math.PI / 2, c = Math.cos(theta), s = Math.sin(theta);
    const p1 = { gx: g.cx - GATE_HALF * g.along.gx, gy: g.cy - GATE_HALF * g.along.gy };
    const p2 = { gx: g.cx + GATE_HALF * g.along.gx, gy: g.cy + GATE_HALF * g.along.gy };
    const e1 = { gx: p1.gx + GATE_HALF * (g.along.gx * c + g.out.gx * s),
                 gy: p1.gy + GATE_HALF * (g.along.gy * c + g.out.gy * s) };
    const e2 = { gx: p2.gx + GATE_HALF * (-g.along.gx * c + g.out.gx * s),
                 gy: p2.gy + GATE_HALF * (-g.along.gy * c + g.out.gy * s) };
    const H = 38;
    const A1 = gScreen(p1.gx, p1.gy), A2 = gScreen(p2.gx, p2.gy);
    const B1 = gScreen(e1.gx, e1.gy), B2 = gScreen(e2.gx, e2.gy);
    // 入口门洞（缺口处深色提示）
    const midP = gScreen(g.cx, g.cy);
    ctx.fillStyle = "rgba(40,60,45,.22)";
    ctx.beginPath(); ctx.ellipse(midP.x, midP.y, GATE_HALF * 1.55 * z, GATE_HALF * 0.62 * z, 0, 0, 7); ctx.fill();
    // 两扇门页
    drawFencePanel(A1, B1, H, z, "rgba(74,140,90,.30)", "#357a48");
    drawFencePanel(A2, B2, H, z, "rgba(74,140,90,.30)", "#357a48");
    // 门柱
    drawPost(A1, H + 10, z);
    drawPost(A2, H + 10, z);
    // 门楣
    const top = (H + 10) * z;
    ctx.strokeStyle = "#2f6b3d"; ctx.lineWidth = Math.max(2, 4 * z); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(A1.x, A1.y - top); ctx.lineTo(A2.x, A2.y - top); ctx.stroke();
  }
  // 校门伸缩门（竖杆向一侧收拢）
  function drawCampusGate(gt) {
    const z = view.zoom;
    if (z < 0.1) return;
    const W = 5.2, H = 30, N = 8, t = gt.open;
    const ocx = gt.cx - gt.out.gx * 0.8, ocy = gt.cy - gt.out.gy * 0.8;
    const span = W * (1 - 0.8 * t), start = -W / 2;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const off = start + span * i / N;
      pts.push(gScreen(ocx + off * gt.along.gx, ocy + off * gt.along.gy));
    }
    const h = H * z;
    ctx.strokeStyle = "#c8ced8"; ctx.lineWidth = Math.max(1, 1.4 * z);
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y - h); ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i + 1].x, pts[i + 1].y - h);
      ctx.stroke();
    }
    ctx.fillStyle = "#9aa3b2";
    for (const p of pts) ctx.fillRect(p.x - 1.3 * z, p.y - h, 2.6 * z, h);
    const pole = gScreen(ocx + start * gt.along.gx, ocy + start * gt.along.gy);
    ctx.fillStyle = "#5a6473";
    ctx.fillRect(pole.x - 2.4 * z, pole.y - h - 6 * z, 4.8 * z, h + 6 * z);
  }

  // ---------- 主循环 ----------
  // 自动寻路路径（地面层，建筑会遮挡）
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
    const end = pts[pts.length - 1];
    const ex = w2sX(end.x), ey = w2sY(end.y);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(45,108,223,.95)";
    ctx.beginPath(); ctx.arc(ex, ey, Math.max(4, 8 * z), 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ex, ey, Math.max(4, 8 * z), 0, 7); ctx.stroke();
    ctx.restore();
  }

  // 建筑名标签（放大到阈值后显示，UI 最上层）
  const LABEL_MIN_ZOOM = 0.3;
  function drawLabels() {
    const z = view.zoom;
    if (z < LABEL_MIN_ZOOM) return;
    const fs = Math.min(16, Math.max(11, 12 * z / 0.35));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "600 " + fs + "px 'PingFang SC','Microsoft YaHei',sans-serif";
    const h = fs + 9, padX = 8;
    for (const b of D.buildings) {
      const [x0, y0, bw, bh] = b.bbox;
      const lx = b.paste[0] * z + view.x + bw * b.scale * z / 2;
      const ly = b.paste[1] * z + view.y - 8 * z;
      if (lx < -80 || lx > window.innerWidth + 80 || ly < -30 || ly > window.innerHeight + 30) continue;
      const tw = ctx.measureText(b.name).width;
      ctx.fillStyle = "rgba(15,22,34,.72)";
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - padX, ly - h / 2, tw + padX * 2, h, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,170,255,.35)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#eaf2ff";
      ctx.fillText(b.name, lx, ly + 0.5);
    }
  }

  // ---------- 小地图导航 ----------
  function mmTransform() {
    const pad = 4;
    const s = Math.min((MM_W - 2 * pad) / GW, (MM_H - 2 * pad) / GH);
    return { s, ox: (MM_W - GW * s) / 2, oy: (MM_H - GH * s) / 2 };
  }
  function drawMinimap() {
    const { s, ox, oy } = mmTransform();
    mmCtx.clearRect(0, 0, MM_W, MM_H);
    const ground = images[M.ground];
    if (ground) {
      mmCtx.imageSmoothingEnabled = true;
      mmCtx.drawImage(ground, ox, oy, GW * s, GH * s);
    } else {
      mmCtx.fillStyle = "#0e1a24"; mmCtx.fillRect(ox, oy, GW * s, GH * s);
    }
    const w2m = (wx, wy) => ({ x: ox + wx * s, y: oy + wy * s });
    // 寻路路线
    if (player.navPath && player.navPath.length) {
      const pts = [{ x: player.wx, y: player.wy }, ...player.navPath];
      mmCtx.strokeStyle = "rgba(120,178,255,.95)"; mmCtx.lineWidth = 1.3;
      mmCtx.beginPath();
      pts.forEach((p, i) => { const m = w2m(p.x, p.y); if (i) mmCtx.lineTo(m.x, m.y); else mmCtx.moveTo(m.x, m.y); });
      mmCtx.stroke();
    }
    // 建筑点（按分组着色）
    for (const b of D.buildings) {
      const w = gridToWorld(b.grid[0] + b.grid[2] / 2, b.grid[1] + b.grid[3] / 2);
      const m = w2m(w.x, w.y);
      mmCtx.fillStyle = GROUP_COLOR[b.group] || "#9fb4d8";
      mmCtx.fillRect(m.x - 1.6, m.y - 1.6, 3.2, 3.2);
    }
    // 当前视野框
    const c0 = w2m(s2wX(0), s2wY(0));
    const c1 = w2m(s2wX(window.innerWidth), s2wY(window.innerHeight));
    mmCtx.fillStyle = "rgba(255,255,255,.07)";
    mmCtx.fillRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    mmCtx.strokeStyle = "rgba(255,255,255,.75)"; mmCtx.lineWidth = 1;
    mmCtx.strokeRect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    // 角色点（脉冲）
    const pm = w2m(player.wx, player.wy);
    const pulse = 1 + 0.25 * Math.sin(performance.now() / 200);
    mmCtx.fillStyle = "rgba(255,210,90,.25)";
    mmCtx.beginPath(); mmCtx.arc(pm.x, pm.y, 5 * pulse, 0, 7); mmCtx.fill();
    mmCtx.fillStyle = "#ffd25a";
    mmCtx.beginPath(); mmCtx.arc(pm.x, pm.y, 3, 0, 7); mmCtx.fill();
    mmCtx.strokeStyle = "#ffffff"; mmCtx.lineWidth = 1;
    mmCtx.beginPath(); mmCtx.arc(pm.x, pm.y, 3, 0, 7); mmCtx.stroke();
  }
  mmCanvas.addEventListener("pointerdown", e => {
    e.preventDefault();
    const rect = mmCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (MM_W / rect.width);
    const my = (e.clientY - rect.top) * (MM_H / rect.height);
    const { s, ox, oy } = mmTransform();
    const wx = (mx - ox) / s, wy = (my - oy) / s;
    const [dx0, dy0, dx1, dy1] = M.diamond;
    const dcx = (dx0 + dx1) / 2, dcy = (dy0 + dy1) / 2;
    const inDiamond = Math.abs(wx - dcx) / ((dx1 - dx0) / 2) + Math.abs(wy - dcy) / ((dy1 - dy0) / 2) <= 1;
    if (!inDiamond) return;  // 忽略菱形校园外的留白
    follow = false; updateFollowBtn();
    view.x = window.innerWidth / 2 - wx * view.zoom;
    view.y = window.innerHeight / 2 - wy * view.zoom;
  });

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // 不画底色，透明菱形外显示 body 的深色径向渐变

    // 地面（缩小用平滑；放大用像素硬边）
    ctx.imageSmoothingEnabled = view.zoom < 0.85;
    const ground = images[M.ground];
    if (ground) {
      ctx.drawImage(ground, view.x, view.y, GW * view.zoom, GH * view.zoom);
    }

    drawPath();   // 寻路路径（地面层）
    drawDust();   // 跑步扬尘（地面层）

    // 深度排序：建筑 + 门 + 角色
    const drawList = D.buildings.map(b => ({ kind: "b", depth: b.depth, b }));
    for (const F of fences) drawList.push({ kind: "fg", depth: F.g.cx + F.g.cy, F });
    for (const gt of CAMPUS_GATES) {
      const ocx = gt.cx - gt.out.gx * 0.8, ocy = gt.cy - gt.out.gy * 0.8;
      drawList.push({ kind: "cg", depth: ocx + ocy, gt });
    }
    const pg = worldToGrid(player.wx, player.wy);
    drawList.push({ kind: "p", depth: pg.gx + pg.gy });
    drawList.sort((a, b) => a.depth - b.depth);

    for (const it of drawList) {
      if (it.kind === "b") {
        const b = it.b;
        const img = images[b.img];
        if (!img) continue;
        const [x0, y0, bw, bh] = b.bbox;
        const z = view.zoom;
        const dx = b.paste[0] * z + view.x;
        const dy = b.paste[1] * z + view.y;
        ctx.drawImage(img, x0, y0, bw, bh, dx, dy, bw * b.scale * z, bh * b.scale * z);
      } else if (it.kind === "fg") {
        drawFieldGate(it.F);
      } else if (it.kind === "cg") {
        drawCampusGate(it.gt);
      } else {
        drawPlayer();
      }
    }
    drawLabels();   // 建筑名标签（UI 最上层）
    drawMinimap();  // 左下角小地图
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    updatePlayer(dt);
    updateGates(dt);
    if (follow) {
      const sx = w2sX(player.wx), sy = w2sY(player.wy);
      view.x += (window.innerWidth * 0.5 - sx);
      view.y += (window.innerHeight * 0.62 - sy);
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
  updateFollowBtn();
  loadAll().then(loadPlayerFrames).then(() => {
    document.getElementById("loading").style.display = "none";
    requestAnimationFrame(frame);
  });
})();

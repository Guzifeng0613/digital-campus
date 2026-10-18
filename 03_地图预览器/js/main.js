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

  // ---------- chibi 像素角色帧（4方向×4帧） ----------
  const playerFrames = {};
  function loadPlayerFrames() {
    const dirs = ["down", "up", "left", "right"];
    return Promise.all(dirs.map(dir => Promise.all([0, 1, 2, 3].map(f => new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = "img/player/player_" + dir + "_" + f + ".png";
    }))).then(arr => { playerFrames[dir] = arr; })));
  }

  // ---------- 角色 ----------
  const GATE_S = D.buildings.find(b => b.id === "GATE-S");
  // 起点：南门内侧
  const start = gridToWorld(GATE_S.grid[0] + 6, GATE_S.grid[1] - 6);
  const player = {
    wx: start.x, wy: start.y,
    speed: 300,            // 世界像素/秒
    phase: 0,              // 走路相位
    moving: false,
    facing: "down",        // up/down/left/right
    navPath: null,         // 自动寻路：世界坐标点数组（含当前点）
    navName: "",           // 目标名（提示用）
  };
  const keys = {};
  const stick = { x: 0, y: 0 };  // 移动端虚拟摇杆方向（屏幕坐标，右 x+ / 下 y+）
  const PAD = 0.9;         // 角色碰撞半径（网格单位）

  function blocked(gx, gy) {
    if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
    for (const b of D.buildings) {
      if (b.walkable) continue;
      const [x, y, w, h] = b.collider;
      if (gx > x - PAD && gx < x + w + PAD && gy > y - PAD && gy < y + h + PAD) return true;
    }
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

  function updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if (stick.x !== 0 || stick.y !== 0) { dx += stick.x; dy += stick.y; }
    const manual = (dx !== 0 || dy !== 0);
    if (manual && player.navPath) { player.navPath = null; player.navName = ""; navTipEl.classList.remove("show"); }

    if (manual) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
      else player.facing = dy > 0 ? "down" : "up";
      player.moving = true;
      const v = player.speed * dt;
      let nx = player.wx + dx * v, ny = player.wy + dy * v;
      let gN = worldToGrid(nx, player.wy);
      if (!blocked(gN.gx, gN.gy)) player.wx = nx;
      gN = worldToGrid(player.wx, ny);
      if (!blocked(gN.gx, gN.gy)) player.wy = ny;
      player.phase += dt * 9;
      follow = true; updateFollowBtn();
    } else if (player.navPath && player.navPath.length) {
      // 自动沿路径点移动
      const tgt = player.navPath[0];
      const ddx = tgt.x - player.wx, ddy = tgt.y - player.wy;
      const dist = Math.hypot(ddx, ddy);
      const R = 12;                      // 到达半径（世界像素，小于避障墙距）
      if (dist < R) {
        player.navPath.shift(); navStuck = 0;
        if (!player.navPath.length) {
          player.navPath = null; player.moving = false;
          setNavTip(player.navName ? "已到达：" + player.navName : "已到达", true);
          player.navName = "";
        }
        return;
      }
      player.moving = true;
      const ux = ddx / dist, uy = ddy / dist;
      if (Math.abs(ux) > Math.abs(uy)) player.facing = ux > 0 ? "right" : "left";
      else player.facing = uy > 0 ? "down" : "up";
      const v = Math.min(player.speed * dt, dist);
      const ox = player.wx, oy = player.wy;
      const nx = player.wx + ux * v, ny = player.wy + uy * v;
      const gAll = worldToGrid(nx, ny);
      if (!blocked(gAll.gx, gAll.gy)) { player.wx = nx; player.wy = ny; }
      else {
        // 轴分离贴墙
        const gx = worldToGrid(nx, player.wy);
        if (!blocked(gx.gx, gx.gy)) player.wx = nx;
        const gy = worldToGrid(player.wx, ny);
        if (!blocked(gy.gx, gy.gy)) player.wy = ny;
      }
      // 卡住检测：几乎没位移则放弃当前点，避免死等
      if (Math.hypot(player.wx - ox, player.wy - oy) < v * 0.25) {
        navStuck++;
        if (navStuck > 10) { player.navPath.shift(); navStuck = 0; }
      } else navStuck = 0;
      player.phase += dt * 9;
      follow = true; updateFollowBtn();
    } else {
      player.moving = false;
      navStuck = 0;
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
    if (d > joyR) { dx = dx / d * joyR; dy = dy / d * joyR; }
    joyKnob.style.transform = "translate(" + dx + "px," + dy + "px)";
    if (d > 8) { stick.x = dx / joyR; stick.y = dy / joyR; }
    else { stick.x = 0; stick.y = 0; }
  }
  function resetJoy() {
    joyId = null; stick.x = 0; stick.y = 0;
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
  document.getElementById("btnReset").onclick = () => {
    follow = false; centerView(); updateFollowBtn();
  };

  // ---------- chibi 像素角色帧 ----------
  function drawPlayer() {
    const g = worldToGrid(player.wx, player.wy);
    const sx = w2sX(player.wx), sy = w2sY(player.wy);
    const z = view.zoom;
    if (z < 0.12) {                           // 远景只画点
      ctx.fillStyle = "#5b4a6b";
      ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 7); ctx.fill();
      return { depth: g.gx + g.gy };
    }
    const fw = 64 * z, fh = 80 * z;           // 帧图世界尺寸 64×80
    const frames = playerFrames[player.facing];
    const fi = player.moving ? (Math.floor(player.phase) % 4) : 0;
    const pimg = frames && frames[fi] ? frames[fi] : null;
    const oldSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = z < 0.85;     // 放大走像素硬边
    // 影子
    ctx.fillStyle = "rgba(20,30,40,.28)";
    ctx.beginPath(); ctx.ellipse(sx, sy + 2 * z, 14 * z, 5 * z, 0, 0, 7); ctx.fill();
    if (pimg) {
      ctx.drawImage(pimg, sx - fw / 2, sy - fh, fw, fh);  // 底部对齐脚点
    }
    ctx.imageSmoothingEnabled = oldSmooth;
    return { depth: g.gx + g.gy };
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

    // 深度排序：建筑 + 角色
    const drawList = D.buildings.map(b => ({ kind: "b", depth: b.depth, b }));
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

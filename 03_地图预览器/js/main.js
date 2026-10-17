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
  };
  const keys = {};
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

  function updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    player.moving = (dx !== 0 || dy !== 0);
    if (player.moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      // 朝向（屏幕四方向）
      if (Math.abs(dx) > Math.abs(dy)) player.facing = dx > 0 ? "right" : "left";
      else player.facing = dy > 0 ? "down" : "up";
      const v = player.speed * dt;
      // 轴分离，实现贴墙滑动
      let nx = player.wx + dx * v, ny = player.wy + dy * v;
      let gN = worldToGrid(nx, player.wy);
      if (!blocked(gN.gx, gN.gy)) player.wx = nx;
      gN = worldToGrid(player.wx, ny);
      if (!blocked(gN.gx, gN.gy)) player.wy = ny;
      player.phase += dt * 9;
      follow = true; updateFollowBtn();
    }
  }

  // ---------- 输入 ----------
  window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  });
  window.addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

  let dragging = false, moved = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", e => {
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
    canvas.classList.add("dragging");
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!dragging) return;
    const ddx = e.clientX - lastX, ddy = e.clientY - lastY;
    if (Math.abs(ddx) + Math.abs(ddy) > 4) { moved = true; follow = false; updateFollowBtn(); }
    view.x += ddx; view.y += ddy;
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", e => {
    dragging = false; canvas.classList.remove("dragging");
    if (!moved) handleClick(e.clientX, e.clientY);
  });

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
  }
  // 调试/测试钩子
  window.__map = { view, worldToScreen: (wx, wy) => ({ x: w2sX(wx), y: w2sY(wy) }),
    buildings: D.buildings, select: b => showInfo(b) };

  // ---------- 信息卡 ----------
  const GROUP_CN = {
    teaching: "教学科研", public: "公共服务", sports: "体育",
    dining: "餐饮", gate: "校门", nature: "自然地标"
  };
  function showInfo(b) {
    document.getElementById("iNo").textContent = "点位 " + String(b.no).padStart(2, "0") + " · " + b.id;
    document.getElementById("iName").textContent = b.name;
    document.getElementById("iTag").textContent = GROUP_CN[b.group] || b.group;
    document.getElementById("iDesc").textContent = b.desc || "（暂无介绍）";
    document.getElementById("info").classList.add("show");
  }
  document.getElementById("infoClose").onclick = () =>
    document.getElementById("info").classList.remove("show");

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

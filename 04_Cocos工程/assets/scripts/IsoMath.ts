// 等距坐标数学：网格 <-> 图像世界 <-> Cocos 本地坐标；碰撞检测（含多部件/校门开合）；sprite 几何。
import { META, CampusBuilding } from './CampusData';
import { Vec2 } from 'cc';

const OX = META.origin[0], OY = META.origin[1];
const SX = META.tile[0], SY = META.tile[1];
const GW = META.groundSize[0], GH = META.groundSize[1];
const [GX0, GY0, GX1, GY1] = META.gridRange;
const COLLIDE_PAD = 0.9;
const GATE_IDS = ["GATE-E", "GATE-W"];

// 网格 -> 图像世界坐标（地面底图像素，左上原点、y 向下）
export function gridToImage(gx: number, gy: number): Vec2 {
  return new Vec2((gx - gy) * SX + OX, (gx + gy) * SY + OY);
}
// 图像世界 -> 网格
export function imageToGrid(wx: number, wy: number): { gx: number; gy: number } {
  const u = (wx - OX) / SX, v = (wy - OY) / SY;
  return { gx: (u + v) / 2, gy: (v - u) / 2 };
}
// 图像世界 -> content 本地坐标（content 中心为原点，y 向上）
export function imageToLocal(wx: number, wy: number): Vec2 {
  return new Vec2(wx - GW / 2, GH / 2 - wy);
}
// content 本地 -> 图像世界
export function localToImage(lx: number, ly: number): Vec2 {
  return new Vec2(lx + GW / 2, GH / 2 - ly);
}
// 网格 -> content 本地
export function gridToLocal(gx: number, gy: number): Vec2 {
  const p = gridToImage(gx, gy);
  return imageToLocal(p.x, p.y);
}

// ---------- 碰撞（多部件 collider/colliders + 校门开合） ----------
export type GateOpen = Record<string, number>;
export function isGate(id: string): boolean { return GATE_IDS.indexOf(id) >= 0; }
function rectHit(gx: number, gy: number, r: number[], pad: number): boolean {
  return gx > r[0] - pad && gx < r[0] + r[2] + pad &&
         gy > r[1] - pad && gy < r[1] + r[3] + pad;
}
function buildingBlocks(b: CampusBuilding, gx: number, gy: number, pad: number, gateOpen: GateOpen | null): boolean {
  if (b.walkable) return false;
  // 校门打开时放行
  if (isGate(b.id) && gateOpen && (gateOpen[b.id] || 0) > 0.5) return false;
  if (b.collider && rectHit(gx, gy, b.collider, pad)) return true;
  if (b.colliders) {
    for (const c of b.colliders) if (rectHit(gx, gy, c, pad)) return true;
  }
  return false;
}
// 某网格点是否被实体建筑阻挡（操场/山体可进入）
export function isBlocked(gx: number, gy: number, buildings: CampusBuilding[],
                         gateOpen: GateOpen | null = null): boolean {
  if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
  for (const b of buildings) if (buildingBlocks(b, gx, gy, COLLIDE_PAD, gateOpen)) return true;
  return false;
}
// 让整校园菱形适配视图（viewW/viewH 为可视像素），返回缩放
export function fitZoom(viewW: number, viewH: number): number {
  const [x0, y0, x1, y1] = META.diamond;
  return Math.min(viewW * 0.96 / (x1 - x0), viewH * 0.96 / (y1 - y0));
}
// 菱形中心（图像坐标）
export function diamondCenter(): Vec2 {
  const [x0, y0, x1, y1] = META.diamond;
  return new Vec2((x0 + x1) / 2, (y0 + y1) / 2);
}
export const GROUND_W = GW;
export const GROUND_H = GH;

// ---------- sprite 视觉几何（与 web main.js 一致） ----------
const TW = 64;
export const ANCHOR_AY: Record<string, number> = {
  "FIELD-W": 0.704, "GYM": 0.99, "TEACH-1": 0.99, "LAB-TECH": 0.98, "GATE-S": 0.97,
  "GATE-E": 0.92, "LIB": 0.99, "WENLI": 0.95, "TEACH-2": 0.97, "ACT": 0.85,
  "CAN-YULAN": 1.0, "CAN-ZIZHU": 0.94, "ENG-TRAIN": 0.96, "FIELD-N": 1.053,
  "MOUNT-YUPING": 1.0, "GATE-W": 0.81
};
export const ANCHOR_AX: Record<string, number> = {
  "FIELD-W": 0.335, "GYM": 0.50, "TEACH-1": 0.75, "LAB-TECH": 0.51, "GATE-S": 0.71,
  "GATE-E": 0.35, "LIB": 0.57, "WENLI": 0.47, "TEACH-2": 0.53, "ACT": 0.60,
  "CAN-YULAN": 0.46, "CAN-ZIZHU": 0.41, "ENG-TRAIN": 0.48, "FIELD-N": 0.372,
  "MOUNT-YUPING": 0.64, "GATE-W": 0.33
};
export const ISO_K: Record<string, number> = {
  "MOUNT-YUPING": 0.95, "FIELD-W": 0.87, "FIELD-N": 0.741,
  "TEACH-1": 1.0, "LAB-TECH": 1.0, "GYM": 1.0, "ACT": 1.0, "ENG-TRAIN": 1.0,
  "LIB": 1.0, "WENLI": 1.0, "TEACH-2": 1.0, "CAN-YULAN": 1.0, "CAN-ZIZHU": 1.0,
  "GATE-S": 1.05, "GATE-E": 1.05, "GATE-W": 1.05
};
// 校门伸缩门开合几何
export const GATE_GEOM: Record<string, { fx: number; fy: number; ux: number; uy: number }> = {
  "GATE-W": { fx: 430, fy: 650, ux: 0.91, uy: -0.42 },
  "GATE-E": { fx: 380, fy: 600, ux: 0.84, uy: -0.54 }
};
export interface SpriteGeometry {
  W: number; H: number;          // 缩放后世界宽高
  lx: number; ly: number;        // 节点（左上锚点）在 content 的本地坐标
}
export function spriteGeometry(b: CampusBuilding, realW: number, realH: number): SpriteGeometry {
  const [fx, fy, fw, fh] = b.grid;
  const k = ISO_K[b.id] != null ? ISO_K[b.id] : 1.1;
  const sc = (fw + fh) * TW / 2 * k / realW;
  const W = realW * sc, H = realH * sc;
  const ax = ANCHOR_AX[b.id] != null ? ANCHOR_AX[b.id] : 0.5;
  const ay = ANCHOR_AY[b.id] != null ? ANCHOR_AY[b.id] : 0.95;
  // 南角（地面像素）
  const south = gridToImage(fx + fw, fy + fh);
  const topLeftX = south.x - ax * W, topLeftY = south.y - ay * H;
  const local = imageToLocal(topLeftX, topLeftY);
  return { W, H, lx: local.x, ly: local.y };
}

// ---------- 自动寻路（旋转坐标 BFS，8 方向） ----------
const NAV_PAD = 1.0;
const NAV_STEP = 2;
const MOVES = [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2]];
function round2(n: number): number { return Math.round(n / 2) * 2; }

export function navBlocked(gx: number, gy: number, buildings: CampusBuilding[],
                           gateOpen: GateOpen | null = null): boolean {
  if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
  for (const b of buildings) if (buildingBlocks(b, gx, gy, NAV_PAD, gateOpen)) return true;
  return false;
}
function uvBlocked(u: number, v: number, buildings: CampusBuilding[], gateOpen: GateOpen | null): boolean {
  return navBlocked((u + v) / 2, (u - v) / 2, buildings, gateOpen);
}
// BFS：起点/终点为网格坐标，返回网格路径（含终点），不可达返回 null
export function findPath(sg: {gx:number;gy:number}, tg: {gx:number;gy:number},
                         buildings: CampusBuilding[], gateOpen: GateOpen | null = null): {gx:number;gy:number}[] | null {
  const U0 = round2(sg.gx + sg.gy), V0 = round2(sg.gx - sg.gy);
  const U1 = round2(tg.gx + tg.gy), V1 = round2(tg.gx - tg.gy);
  if (uvBlocked(U1, V1, buildings, gateOpen)) return null;
  const key = (u: number, v: number) => u + "," + v;
  const queue: number[][] = [[U0, V0]]; let head = 0;
  const prev = new Map<string, number[]>();
  prev.set(key(U0, V0), null);
  let found = false;
  while (head < queue.length) {
    const [u, v] = queue[head++];
    if (u === U1 && v === V1) { found = true; break; }
    for (const [du, dv] of MOVES) {
      const nu = u + du, nv = v + dv;
      if (uvBlocked(nu, nv, buildings, gateOpen)) continue;
      if (du && dv && (uvBlocked(u + du, v, buildings, gateOpen) || uvBlocked(u, v + dv, buildings, gateOpen))) continue;
      const kk = key(nu, nv);
      if (prev.has(kk)) continue;
      prev.set(kk, [u, v]);
      queue.push([nu, nv]);
    }
  }
  if (!found) return null;
  const path: {gx:number;gy:number}[] = [];
  let cur: number[] = [U1, V1];
  while (cur) {
    path.push({ gx: (cur[0] + cur[1]) / 2, gy: (cur[0] - cur[1]) / 2 });
    cur = prev.get(key(cur[0], cur[1]));
  }
  path.reverse();
  return path;
}
// 目标点若被挡，在其周围环形找最近可达点
export function nearestOpenGrid(gx: number, gy: number, fx: number, fy: number,
                                buildings: CampusBuilding[], gateOpen: GateOpen | null = null): {gx:number;gy:number} | null {
  if (!navBlocked(gx, gy, buildings, gateOpen)) return { gx, gy };
  for (let ring = 1; ring <= 10; ring++) {
    let best: {gx:number;gy:number} = null, bd = Infinity;
    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const x = gx + dx * NAV_STEP, y = gy + dy * NAV_STEP;
      if (navBlocked(x, y, buildings, gateOpen)) continue;
      const d = Math.hypot(x - fx, y - fy);
      if (d < bd) { bd = d; best = { gx: x, gy: y }; }
    }
    if (best) return best;
  }
  return null;
}
function openSpotsAround(b: CampusBuilding, fx: number, fy: number,
                         buildings: CampusBuilding[], gateOpen: GateOpen | null): {gx:number;gy:number}[] {
  const [gx, gy, gw, gh] = b.grid;
  const m = 2.4, step = 2, pts: {gx:number;gy:number}[] = [];
  for (let x = gx - m; x <= gx + gw + m; x += step) {
    pts.push({ gx: x, gy: gy - m }); pts.push({ gx: x, gy: gy + gh + m });
  }
  for (let y = gy - m; y <= gy + gh + m; y += step) {
    pts.push({ gx: gx - m, gy: y }); pts.push({ gx: gx + gw + m, gy: y });
  }
  return pts.filter(p => !navBlocked(p.gx, p.gy, buildings, gateOpen))
    .sort((a, c) => Math.hypot(a.gx - fx, a.gy - fy) - Math.hypot(c.gx - fx, c.gy));
}
// 寻路到建筑边缘最近可达点（返回网格路径或 null）
export function pathToBuilding(b: CampusBuilding, fx: number, fy: number,
                               buildings: CampusBuilding[], gateOpen: GateOpen | null = null): {gx:number;gy:number}[] | null {
  const spots = openSpotsAround(b, fx, fy, buildings, gateOpen).slice(0, 12);
  let best: {gx:number;gy:number}[] = null, bestLen = Infinity;
  for (const s of spots) {
    const p = findPath({ gx: fx, gy: fy }, s, buildings, gateOpen);
    if (p && p.length < bestLen) { bestLen = p.length; best = p; }
  }
  return best;
}

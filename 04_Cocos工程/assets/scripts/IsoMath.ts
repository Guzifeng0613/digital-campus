// 等距坐标数学：网格 <-> 图像世界 <-> Cocos 本地坐标；碰撞检测；初始缩放。
import { META, CampusBuilding } from './CampusData';
import { Vec2 } from 'cc';

const OX = META.origin[0], OY = META.origin[1];
const SX = META.tile[0], SY = META.tile[1];
const GW = META.groundSize[0], GH = META.groundSize[1];
const [GX0, GY0, GX1, GY1] = META.gridRange;
const COLLIDE_PAD = 0.9;

// 网格 -> 图像世界坐标（裁剪图坐标，左上原点、y 向下）
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
// 某网格点是否被实体建筑阻挡（操场/山体可进入）
export function isBlocked(gx: number, gy: number, buildings: CampusBuilding[]): boolean {
  if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
  for (const b of buildings) {
    if (b.walkable) continue;
    const [x, y, w, h] = b.collider;
    if (gx > x - COLLIDE_PAD && gx < x + w + COLLIDE_PAD &&
        gy > y - COLLIDE_PAD && gy < y + h + COLLIDE_PAD) return true;
  }
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

// ---------- 自动寻路（旋转坐标 BFS，8 方向） ----------
// 道路沿屏幕上下左右（网格 gx,gy 的对角方向），故在旋转坐标 u=gx+gy、v=gx-gy 上 BFS。
const NAV_PAD = 1.0;
const NAV_STEP = 2;
const MOVES = [[2,0],[-2,0],[0,2],[0,-2],[2,2],[2,-2],[-2,2],[-2,-2]];
function round2(n: number): number { return Math.round(n / 2) * 2; }

export function navBlocked(gx: number, gy: number, buildings: CampusBuilding[]): boolean {
  if (gx < GX0 || gx > GX1 || gy < GY0 || gy > GY1) return true;
  for (const b of buildings) {
    if (b.walkable) continue;
    const [x, y, w, h] = b.collider;
    if (gx > x - NAV_PAD && gx < x + w + NAV_PAD && gy > y - NAV_PAD && gy < y + h + NAV_PAD) return true;
  }
  return false;
}
function uvBlocked(u: number, v: number, buildings: CampusBuilding[]): boolean {
  return navBlocked((u + v) / 2, (u - v) / 2, buildings);
}
// BFS：起点/终点为网格坐标，返回网格路径（含终点），不可达返回 null
export function findPath(sg: {gx:number;gy:number}, tg: {gx:number;gy:number},
                         buildings: CampusBuilding[]): {gx:number;gy:number}[] | null {
  const U0 = round2(sg.gx + sg.gy), V0 = round2(sg.gx - sg.gy);
  const U1 = round2(tg.gx + tg.gy), V1 = round2(tg.gx - tg.gy);
  if (uvBlocked(U1, V1, buildings)) return null;
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
      if (uvBlocked(nu, nv, buildings)) continue;
      if (du && dv && (uvBlocked(u + du, v, buildings) || uvBlocked(u, v + dv, buildings))) continue; // 不穿墙角
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
                                buildings: CampusBuilding[]): {gx:number;gy:number} | null {
  if (!navBlocked(gx, gy, buildings)) return { gx, gy };
  for (let ring = 1; ring <= 10; ring++) {
    let best: {gx:number;gy:number} = null, bd = Infinity;
    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
      const x = gx + dx * NAV_STEP, y = gy + dy * NAV_STEP;
      if (navBlocked(x, y, buildings)) continue;
      const d = Math.hypot(x - fx, y - fy);
      if (d < bd) { bd = d; best = { gx: x, gy: y }; }
    }
    if (best) return best;
  }
  return null;
}
function openSpotsAround(b: CampusBuilding, fx: number, fy: number,
                         buildings: CampusBuilding[]): {gx:number;gy:number}[] {
  const [gx, gy, gw, gh] = b.grid;
  const m = 2.4, step = 2, pts: {gx:number;gy:number}[] = [];
  for (let x = gx - m; x <= gx + gw + m; x += step) {
    pts.push({ gx: x, gy: gy - m }); pts.push({ gx: x, gy: gy + gh + m });
  }
  for (let y = gy - m; y <= gy + gh + m; y += step) {
    pts.push({ gx: gx - m, gy: y }); pts.push({ gx: gx + gw + m, gy: y });
  }
  return pts.filter(p => !navBlocked(p.gx, p.gy, buildings))
    .sort((a, c) => Math.hypot(a.gx - fx, a.gy - fy) - Math.hypot(c.gx - fx, c.gy - fy));
}
// 寻路到建筑边缘最近可达点（返回网格路径或 null）
export function pathToBuilding(b: CampusBuilding, fx: number, fy: number,
                               buildings: CampusBuilding[]): {gx:number;gy:number}[] | null {
  const spots = openSpotsAround(b, fx, fy, buildings).slice(0, 12);
  let best: {gx:number;gy:number}[] = null, bestLen = Infinity;
  for (const s of spots) {
    const p = findPath({ gx: fx, gy: fy }, s, buildings);
    if (p && p.length < bestLen) { bestLen = p.length; best = p; }
  }
  return best;
}

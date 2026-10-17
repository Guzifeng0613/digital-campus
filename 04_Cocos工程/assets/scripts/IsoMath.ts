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

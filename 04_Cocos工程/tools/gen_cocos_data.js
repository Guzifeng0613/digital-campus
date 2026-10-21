const fs = require('fs');
const path = require('path');
// worktree 根（tools/ 的上两级），web 预览器与 Cocos 工程均在其下
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, '03_地图预览器');
const OUT = path.join(__dirname, '..', 'assets', 'scripts', 'CampusData.ts');

global.window = {};
eval(fs.readFileSync(SRC + "/js/data.js", "utf8"));
eval(fs.readFileSync(SRC + "/js/topdown_data.js", "utf8"));
const D = window.CAMPUS_DATA;
const TD = window.TOPDOWN_DATA;

// 新坐标体系（web iso world）
const gr = D.meta.gridRange;
const [GX0, GY0, GX1, GY1] = gr;
const ix = (gx, gy) => (gx - gy) * 32;
const iy = (gx, gy) => (gx + gy) * 16;
const corners = [[GX0, GY0], [GX1, GY0], [GX1, GY1], [GX0, GY1]];
const xs = corners.map(c => ix(c[0], c[1])), ys = corners.map(c => iy(c[0], c[1]));
const WMINX = Math.min(...xs), WMAXX = Math.max(...xs);
const WMINY = Math.min(...ys), WMAXY = Math.max(...ys);
const WW = WMAXX - WMINX, WH = WMAXY - WMINY;
const OX = -WMINX, OY = -WMINY;

function r(n) {
  if (n === undefined || n === null) return n;
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
}
function arr(a) { return a ? a.map(x => r(x)) : a; }
function num(a) {
  if (!a) return "null";
  return "[" + a.map(x => (typeof x === "number" ? r(x) : x)).join(", ") + "]";
}
function matrix(a) {
  if (!a || !a.length) return "null";
  return "[\n" + a.map(x => "    " + num(x)).join(",\n") + "\n  ]";
}

const lines = [];
lines.push("// 自动生成：Cocos Creator 3.8 等距校园数据（由 gen_cocos_data.js 从权威 data.js 导出）。勿手改。");
lines.push("export interface CampusMeta {");
lines.push("  project: string; ground: string; groundSize: number[]; diamond: number[];");
lines.push("  origin: number[]; tile: number[]; gridRange: number[]; count: number;");
lines.push("}");
lines.push("export interface CampusBuilding {");
lines.push("  id: string; no: number; name: string; group: string; cat: string; res: string;");
lines.push("  grid: number[]; bbox: number[]; scale: number; paste: number[];");
lines.push("  dw: number; dh: number; foot: number[]; depth: number; walkable: boolean;");
lines.push("  desc: string; collider: number[] | null; colliders: number[][] | null; entry: number[] | null;");
lines.push("}");
lines.push("export interface CampusRoad {");
lines.push("  w: number; paved: boolean; through: boolean; gpts: number[][];");
lines.push("}");
lines.push("export const META: CampusMeta = {");
lines.push('  project: "北京化工大学昌平校区 · 等距像素数字校园",');
lines.push("  ground: 'ground',");
lines.push(`  groundSize: [${r(WW)}, ${r(WH)}], diamond: [0, 0, ${r(WW)}, ${r(WH)}], origin: [${r(OX)}, ${r(OY)}], tile: [32, 16], gridRange: [${GX0}, ${GY0}, ${GX1}, ${GY1}],`);
lines.push("  count: 16");
lines.push("};");
lines.push("export const BUILDINGS: CampusBuilding[] = [");

D.buildings.forEach((b, i) => {
  lines.push("  {");
  lines.push(`    "id": "${b.id}",`);
  lines.push(`    "no": ${b.no},`);
  lines.push(`    "name": ${JSON.stringify(b.name)},`);
  lines.push(`    "group": ${JSON.stringify(b.group)},`);
  lines.push(`    "cat": ${JSON.stringify(b.cat || "")},`);
  lines.push(`    "res": "sprites/${b.id}",`);
  lines.push(`    "grid": ${num(arr(b.grid))},`);
  lines.push(`    "bbox": ${num(arr(b.bbox))},`);
  lines.push(`    "scale": ${r(b.scale)},`);
  lines.push(`    "paste": ${num(arr(b.paste))},`);
  lines.push(`    "dw": ${r(b.dw)},`);
  lines.push(`    "dh": ${r(b.dh)},`);
  lines.push(`    "foot": ${num(arr(b.foot))},`);
  lines.push(`    "depth": ${r(b.depth)},`);
  lines.push(`    "walkable": ${b.walkable},`);
  lines.push(`    "desc": ${JSON.stringify(b.desc || "")},`);
  lines.push(`    "collider": ${b.collider ? num(arr(b.collider)) : "null"},`);
  lines.push(`    "colliders": ${b.colliders ? matrix(b.colliders.map(c => arr(c))) : "null"},`);
  lines.push(`    "entry": ${b.entry ? num(arr(b.entry)) : "null"}`);
  lines.push("  }" + (i === D.buildings.length - 1 ? "" : ","));
});

lines.push("];");
lines.push("");
// 道路（用于 BFS 自动寻路的道路限制：只在道路上走）
lines.push("export const ROADS: CampusRoad[] = [");
TD.roads.forEach((rd, i) => {
  lines.push("  {");
  lines.push(`    "w": ${r(rd.w)}, "paved": ${rd.paved ? true : false}, "through": ${rd.through ? true : false},`);
  lines.push(`    "gpts": ${matrix(rd.gpts.map(p => arr(p.slice())))}`);
  lines.push("  }" + (i === TD.roads.length - 1 ? "" : ","));
});
lines.push("];");
lines.push("");
lines.push("export const GROUP_CN: Record<string, string> = {");
lines.push("  teaching: '教学科研', public: '公共服务', sports: '体育',");
lines.push("  dining: '餐饮', gate: '校门', nature: '自然地标'");
lines.push("};");

fs.writeFileSync(OUT, lines.join("\n"));
console.log("wrote", OUT);
console.log("world bounds:", r(WW), r(WH), "origin:", r(OX), r(OY));

/* 室内场景（进门黑屏切换，出门返回）
   与网页端 main.js 的 interior 模块一致：按建筑类型差异化的房间 + 角色 + 淡入淡出。
   Cocos UI 为居中坐标系（y 向上），室内绘制用“局部 y 向下”的辅助函数，与网页端偏移一致。 */
import {
  Node, Graphics, Label, Sprite, UITransform, Color, Layers, Vec3, SpriteFrame,
  screen
} from 'cc';
import { Sfx } from './Sfx';
import { CampusBuilding } from './CampusData';

const UI = Layers.Enum.UI_2D;
export type PlayerFrames = Record<string, {
  idle: (SpriteFrame | null)[];
  walk: (SpriteFrame | null)[];
  run: (SpriteFrame | null)[];
}>;

interface Furn { x: number; y: number; w: number; h: number; type: string }
interface Layout {
  floor: string;
  rug?: { x: number; y: number; w: number; h: number };
  marks?: { x: number; y: number; w: number; h: number; type: string }[];
  furn: Furn[];
}

const IROOM = { w: 22, h: 15, wall: 1.2, doorHalf: 1.6 };
const LAYOUTS: Record<string, Layout> = {
  library: {
    floor: 'wood',
    rug: { x: 4, y: 5.5, w: 14, h: 6.5 },
    furn: [
      { x: 8, y: 2.0, w: 6, h: 1.6, type: 'counter' },
      { x: 1.8, y: 2.5, w: 1.4, h: 7.5, type: 'shelf' },
      { x: 18.8, y: 2.5, w: 1.4, h: 7.5, type: 'shelf' },
      { x: 4.5, y: 6, w: 4, h: 2, type: 'readtable' },
      { x: 13.5, y: 6, w: 4, h: 2, type: 'readtable' },
      { x: 4.5, y: 9.5, w: 4, h: 2, type: 'readtable' },
      { x: 13.5, y: 9.5, w: 4, h: 2, type: 'readtable' }
    ]
  },
  canteen: {
    floor: 'tile',
    furn: [
      { x: 5, y: 2.0, w: 12, h: 1.8, type: 'counter' },
      ...[4.6, 7.4, 10.2].flatMap(ry =>
        [3.3, 7.3, 13.3, 17.3].map(rx => ({ x: rx, y: ry, w: 2.4, h: 2.4, type: 'dining' } as Furn)))
    ]
  },
  gym: {
    floor: 'court',
    marks: [{ x: 3.5, y: 2.5, w: 15, h: 10, type: 'court' }],
    furn: [
      { x: 1.8, y: 5, w: 1, h: 5, type: 'bench' },
      { x: 19.2, y: 5, w: 1, h: 5, type: 'bench' }
    ]
  },
  teaching: {
    floor: 'tile',
    furn: [
      { x: 6, y: 2.0, w: 10, h: 1.2, type: 'board' },
      ...[4.5, 7.5, 10.5].flatMap(ry =>
        [3, 6, 13, 16].map(rx => ({ x: rx, y: ry, w: 2.4, h: 1.4, type: 'schooldesk' } as Furn)))
    ]
  },
  college: {
    floor: 'wood',
    rug: { x: 6, y: 5, w: 10, h: 5.5 },
    furn: [
      { x: 6, y: 2, w: 10, h: 1.4, type: 'lowshelf' },
      ...[4.5, 7.5, 10.5].flatMap(ry => [
        { x: 2, y: ry, w: 3.5, h: 1.8, type: 'desk' } as Furn,
        { x: 16.5, y: ry, w: 3.5, h: 1.8, type: 'desk' } as Furn
      ])
    ]
  },
  activity: {
    floor: 'wood',
    rug: { x: 5, y: 5, w: 12, h: 5 },
    furn: [
      { x: 7, y: 2, w: 8, h: 1.6, type: 'stage' },
      { x: 3, y: 6, w: 1.6, h: 3.5, type: 'sofa' },
      { x: 17.4, y: 6, w: 1.6, h: 3.5, type: 'sofa' },
      { x: 8, y: 6.5, w: 6, h: 2.5, type: 'coffeetable' }
    ]
  },
  lab: {
    floor: 'tile',
    furn: [
      { x: 5, y: 2, w: 12, h: 1.4, type: 'counter' },
      ...[4.5, 7.5, 10.5].flatMap(ry => [
        { x: 3, y: ry, w: 7, h: 1.6, type: 'labbench' } as Furn,
        { x: 12, y: ry, w: 7, h: 1.6, type: 'labbench' } as Furn
      ])
    ]
  }
};

function layoutFor(id: string): Layout {
  if (id === 'LIB') return LAYOUTS.library;
  if (id === 'CAN-YULAN' || id === 'CAN-ZIZHU') return LAYOUTS.canteen;
  if (id === 'GYM') return LAYOUTS.gym;
  if (id === 'TEACH-2') return LAYOUTS.teaching;
  if (id === 'WENLI') return LAYOUTS.college;
  if (id === 'ACT') return LAYOUTS.activity;
  if (id === 'LAB-TECH' || id === 'ENG-TRAIN') return LAYOUTS.lab;
  return LAYOUTS.college;
}

export class Interior {
  private root: Node;
  private roomGfx: Graphics;
  private player: Node;
  private playerSprite: Sprite;
  private fade: Node;
  private fadeGfx: Graphics;
  private hud: Node;
  private nameLabel: Label;
  private frames: PlayerFrames;
  private sfx: Sfx;
  private runLockRef: () => boolean;

  active = false;
  private trans = false;
  private ix = 0;
  private iy = 0;
  private phase = 0;
  private facing = 'down';
  private moving = false;
  private stepT = 0;
  private scale = 30;
  private ox = 0;
  private oy = 0;
  private current: Layout = LAYOUTS.college;
  private tl = new Vec3();   // 当前家具的局部原点（屏幕左上）

  private onEnterDone: (() => void) | null = null;
  private onExitToOuter: (() => void) | null = null;
  private pendingB: CampusBuilding | null = null;
  private fadeAlpha = 0;
  private fadeTarget = 0;
  private phase2 = '';

  constructor(canvas: Node, frames: PlayerFrames, sfx: Sfx, runLock: () => boolean) {
    this.frames = frames;
    this.sfx = sfx;
    this.runLockRef = runLock;

    this.root = new Node('Interior');
    this.root.layer = UI;
    this.root.addComponent(UITransform);
    this.root.active = false;
    canvas.addChild(this.root);

    const rn = new Node('Room');
    rn.layer = UI;
    rn.addComponent(UITransform);
    this.roomGfx = rn.addComponent(Graphics);
    this.root.addChild(rn);

    this.player = new Node('IPlayer');
    this.player.layer = UI;
    this.player.addComponent(UITransform);
    this.playerSprite = this.player.addComponent(Sprite);
    this.root.addChild(this.player);

    this.fade = new Node('Fade');
    this.fade.layer = UI;
    this.fade.addComponent(UITransform);
    this.fadeGfx = this.fade.addComponent(Graphics);
    this.root.addChild(this.fade);

    this.hud = new Node('IHud');
    this.hud.layer = UI;
    this.hud.addComponent(UITransform);
    const hg = this.hud.addComponent(Graphics);
    hg.fillColor = new Color(12, 18, 16, 170);
    const vs = screen.windowSize;
    hg.fillRect(-vs.width / 2, vs.height / 2 - 70, vs.width, 70);
    this.nameLabel = this.mkLabel('IName', 22, true);
    this.nameLabel.node.setPosition(0, vs.height / 2 - 30, 0);
    const tip = this.mkLabel('ITip', 13, false);
    tip.string = '走到下方门口即可离开';
    tip.node.setPosition(0, vs.height / 2 - 54, 0);
    this.hud.addChild(this.nameLabel.node);
    this.hud.addChild(tip.node);
    this.root.addChild(this.hud);

    this.resize();
  }

  private mkLabel(name: string, size: number, bold: boolean): Label {
    const n = new Node(name);
    n.layer = UI;
    n.addComponent(UITransform);
    const l = n.addComponent(Label);
    l.fontSize = size;
    l.lineHeight = size + 4;
    l.color = new Color(255, 255, 255);
    l.isBold = bold;
    return l;
  }

  resize() {
    const vs = screen.windowSize;
    this.scale = Math.min((vs.width - 80) / IROOM.w, (vs.height - 130) / IROOM.h);
    this.ox = (vs.width - IROOM.w * this.scale) / 2;
    this.oy = (vs.height - IROOM.h * this.scale) / 2 - 10;
    const g = this.fadeGfx;
    g.clear();
    g.fillColor = new Color(0, 0, 0, 255);
    g.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
    this.fade.active = false;
    if (this.active) this.drawRoom();
  }

  // 房间坐标 → 屏幕（居中，y 向上）
  private r2s(rx: number, ry: number): Vec3 {
    return new Vec3(-this.ox - IROOM.w * this.scale / 2 + rx * this.scale,
      this.oy + IROOM.h * this.scale / 2 - ry * this.scale, 0);
  }
  // 局部 y 向下（与网页一致）：(lx,ly) 为相对家具左上的偏移
  private setFurn(f: Furn) { this.tl = this.r2s(f.x, f.y); }
  private X(lx: number) { return this.tl.x + lx; }
  private Y(ly: number) { return this.tl.y - ly; }
  private fRect(lx: number, ly: number, lw: number, lh: number) {
    this.roomGfx.rect(this.tl.x + lx, this.tl.y - ly - lh, lw, lh);
  }
  private fFill(lx: number, ly: number, lw: number, lh: number) {
    this.roomGfx.fillRect(this.tl.x + lx, this.tl.y - ly - lh, lw, lh);
  }
  private fCircle(lx: number, ly: number, r: number) {
    this.roomGfx.circle(this.tl.x + lx, this.tl.y - ly, r);
  }

  private roomBlocked(rx: number, ry: number): boolean {
    const w = IROOM.wall;
    const doorC = IROOM.w / 2;
    const inDoor = Math.abs(rx - doorC) < IROOM.doorHalf && ry > IROOM.h - w - 0.4;
    if (ry < w || rx < w || rx > IROOM.w - w) return true;
    if (ry > IROOM.h - w && !inDoor) return true;
    for (const f of this.current.furn) {
      if (rx > f.x - 0.2 && rx < f.x + f.w + 0.2 && ry > f.y - 0.2 && ry < f.y + f.h + 0.2) return true;
    }
    return false;
  }

  enter(b: CampusBuilding, onDone: () => void) {
    if (this.trans || this.active) return;
    this.trans = true;
    this.onEnterDone = onDone;
    this.fade.active = true;
    this.fadeAlpha = 0;
    this.fadeTarget = 1;
    this.phase2 = 'enter';
    this.pendingB = b;
    this.paintFade();
  }

  exit(onDone: () => void) {
    if (this.trans) return;
    this.trans = true;
    this.fade.active = true;
    this.fadeAlpha = 0;
    this.fadeTarget = 1;
    this.phase2 = 'exit';
    this.paintFade();
  }
  setExitHandler(cb: () => void) { this.onExitToOuter = cb; }

  private finishEnter() {
    const b = this.pendingB!;
    this.current = layoutFor(b.id);
    this.active = true;
    this.root.active = true;
    this.ix = IROOM.w / 2;
    this.iy = IROOM.h - IROOM.wall - 1.8;
    this.facing = 'down';
    this.phase = 0;
    this.stepT = 0;
    this.nameLabel.string = b.name;
    this.resize();
    this.drawRoom();
    this.fadeTarget = 0;
    this.phase2 = 'fadein';
  }

  private finishExit() {
    this.active = false;
    this.root.active = false;
    this.fade.active = false;
    this.trans = false;
    this.phase2 = '';
    if (this.onExitToOuter) this.onExitToOuter();
  }

  private paintFade() {
    const g = this.fadeGfx;
    g.clear();
    const vs = screen.windowSize;
    g.fillColor = new Color(0, 0, 0, Math.round(this.fadeAlpha * 255));
    g.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
  }

  private updateFade(dt: number) {
    const speed = 2.2;
    if (this.fadeAlpha < this.fadeTarget) this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + dt * speed);
    if (this.phase2 === 'enter' && this.fadeAlpha >= 1) { this.finishEnter(); this.paintFade(); return; }
    if (this.phase2 === 'exit' && this.fadeAlpha >= 1) { this.finishExit(); return; }
    if (this.phase2 === 'fadein') {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * speed);
      if (this.fadeAlpha <= 0.01) {
        this.fade.active = false;
        this.phase2 = '';
        this.trans = false;
        if (this.onEnterDone) this.onEnterDone();
        this.onEnterDone = null;
        return;
      }
    }
    this.paintFade();
  }

  update(dt: number, dx: number, dy: number) {
    if (this.phase2) { this.updateFade(dt); return; }
    if (!this.active) return;
    const run = this.runLockRef();
    const moving = (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05);
    this.moving = moving;
    if (moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
      const speed = run ? 5.2 : 3.4;
      const nx = this.ix + dx * speed * dt;
      const ny = this.iy + dy * speed * dt;
      if (!this.roomBlocked(nx, this.iy)) this.ix = nx;
      if (!this.roomBlocked(this.ix, ny)) this.iy = ny;
      this.phase += dt * (run ? 14.5 : 9);
      this.stepT += dt;
      const interval = run ? 0.23 : 0.34;
      if (this.stepT >= interval) {
        this.stepT = 0;
        this.sfx.step(run);
      }
    }
    const doorC = IROOM.w / 2;
    if (Math.abs(this.ix - doorC) < IROOM.doorHalf && this.iy > IROOM.h - IROOM.wall - 0.2) {
      this.exit(() => { });
    }
    this.updatePlayerVisual();
  }

  private updatePlayerVisual() {
    const set = this.frames[this.facing];
    if (!set) return;
    const run = this.runLockRef();
    const seq = this.moving ? (run ? set.run : set.walk) : set.idle;
    const fi = this.moving ? (Math.floor(this.phase) % seq.length) : 0;
    const sf = seq && seq[fi];
    let bob = 0;
    if (this.moving) {
      if (run) {
        const lift = [0, 1.6, 5.2, 1.6][Math.floor(this.phase) % 4];
        bob = -lift * (this.scale / 26) * 1.7;
      } else {
        bob = -Math.abs(Math.sin(this.phase * Math.PI / 2)) * 1.6 * (this.scale / 26);
      }
    }
    const p = this.r2s(this.ix, this.iy);
    const fw = 48 * (this.scale / 26) * 1.7, fh = 64 * (this.scale / 26) * 1.7;
    this.player.getComponent(UITransform)!.setContentSize(fw, fh);
    if (sf) {
      this.playerSprite.spriteFrame = sf;
      this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }
    this.player.setPosition(p.x, p.y + bob, 0);
  }

  private drawRoom() {
    const g = this.roomGfx;
    g.clear();
    const vs = screen.windowSize;
    g.fillColor = new Color(26, 33, 28, 255);
    g.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
    const s = this.scale;
    const w = IROOM.wall;
    const fbl = this.r2s(w, IROOM.h - w);
    const fw = (IROOM.w - 2 * w) * s;
    const fh = (IROOM.h - 2 * w) * s;
    if (this.current.floor === 'wood' || this.current.floor === 'court') {
      g.fillColor = new Color(this.current.floor === 'court' ? 207 : 201,
        this.current.floor === 'court' ? 166 : 160, this.current.floor === 'court' ? 104 : 107, 255);
      g.rect(fbl.x, fbl.y, fw, fh); g.fill();
      g.strokeColor = new Color(120, 82, 40, 70);
      g.lineWidth = 1;
      for (let i = 1; i < IROOM.w - 2 * w; i += 1) {
        const x = fbl.x + i * s;
        g.moveTo(x, fbl.y); g.lineTo(x, fbl.y + fh);
      }
      g.stroke();
    } else {
      g.fillColor = new Color(216, 210, 196, 255);
      g.rect(fbl.x, fbl.y, fw, fh); g.fill();
      g.strokeColor = new Color(150, 140, 120, 115);
      g.lineWidth = 1;
      const ts = 1.4;
      for (let i = ts; i < IROOM.w - 2 * w; i += ts) {
        const x = fbl.x + i * s;
        g.moveTo(x, fbl.y); g.lineTo(x, fbl.y + fh);
      }
      for (let j = ts; j < IROOM.h - 2 * w; j += ts) {
        const y = fbl.y + j * s;
        g.moveTo(fbl.x, y); g.lineTo(fbl.x + fw, y);
      }
      g.stroke();
    }
    // 球场标线
    if (this.current.marks) for (const m of this.current.marks) this.drawCourtMarks(m);
    // 地毯
    if (this.current.rug) {
      const r = this.current.rug;
      const rbl = this.r2s(r.x, r.y + r.h);
      g.fillColor = new Color(122, 90, 156, 255);
      g.rect(rbl.x, rbl.y, r.w * s, r.h * s); g.fill();
      g.strokeColor = new Color(224, 201, 240, 255);
      g.lineWidth = 3;
      g.rect(rbl.x + 4, rbl.y + 4, r.w * s - 8, r.h * s - 8); g.stroke();
    }
    // 家具
    for (const f of this.current.furn) this.drawFurniture(f);
    this.drawWalls();
    this.drawDoorGap();
  }

  private drawCourtMarks(m: { x: number; y: number; w: number; h: number }) {
    const g = this.roomGfx;
    const s = this.scale;
    const bl = this.r2s(m.x, m.y + m.h);
    const w = m.w * s, h = m.h * s;
    g.strokeColor = new Color(255, 255, 255, 217);
    g.lineWidth = 3;
    g.rect(bl.x, bl.y, w, h); g.stroke();
    g.moveTo(bl.x, bl.y + h / 2); g.lineTo(bl.x + w, bl.y + h / 2); g.stroke();
    g.circle(bl.x + w / 2, bl.y + h / 2, 1.3 * s); g.stroke();
    g.rect(bl.x, bl.y + h / 2 - 2.2 * s, 3 * s, 4.4 * s); g.stroke();
    g.rect(bl.x + w - 3 * s, bl.y + h / 2 - 2.2 * s, 3 * s, 4.4 * s); g.stroke();
    g.fillColor = new Color(232, 120, 60, 230);
    g.circle(bl.x + 1.5 * s, bl.y + h / 2, 0.5 * s); g.fill();
    g.circle(bl.x + w - 1.5 * s, bl.y + h / 2, 0.5 * s); g.fill();
  }

  private drawFurniture(f: Furn) {
    const g = this.roomGfx;
    this.setFurn(f);
    const w = f.w * this.scale, h = f.h * this.scale;
    const t = f.type;
    const C = (r: number, gg: number, b: number, a = 255) => new Color(r, gg, b, a);

    if (t === 'readtable' || t === 'coffeetable') {
      g.fillColor = t === 'readtable' ? C(138, 90, 50) : C(122, 74, 42);
      this.fRect(0, 0, w, h); g.fill();
      g.fillColor = t === 'readtable' ? C(168, 116, 72) : C(154, 98, 56);
      this.fRect(4, 4, w - 8, h - 8); g.fill();
      if (t === 'readtable') {
        g.fillColor = C(217, 201, 160); this.fCircle(w * 0.3, h * 0.5, 5); g.fill();
        g.fillColor = C(90, 138, 90); this.fCircle(w * 0.7, h * 0.5, 6); g.fill();
      } else {
        g.fillColor = C(217, 201, 160); this.fCircle(w * 0.5, h * 0.5, 7); g.fill();
      }
    } else if (t === 'desk' || t === 'schooldesk') {
      g.fillColor = t === 'desk' ? C(154, 106, 60) : C(154, 106, 60);
      this.fRect(0, 0, w, h); g.fill();
      g.fillColor = t === 'desk' ? C(192, 138, 82) : C(192, 138, 82);
      this.fRect(2, 2, w - 4, h - 4); g.fill();
      if (t === 'schooldesk') {
        g.fillColor = C(90, 138, 196); this.fFill(3, 3, w * 0.32, h * 0.4);
        g.fillColor = C(196, 90, 90); this.fFill(w * 0.5, 3, w * 0.32, h * 0.4);
      }
    } else if (t === 'shelf') {
      g.fillColor = C(122, 78, 40); this.fRect(0, 0, w, h); g.fill();
      g.strokeColor = C(90, 56, 24); g.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const yy = (h / 4) * i;
        g.moveTo(this.X(0), this.Y(yy)); g.lineTo(this.X(w), this.Y(yy));
      }
      g.stroke();
      const cols = [[196, 90, 90], [90, 138, 196], [196, 168, 90], [90, 196, 138]];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const cc = cols[(r + c) % 4];
          g.fillColor = C(cc[0], cc[1], cc[2]);
          this.fFill(2 + c * (w / 3.4), 2 + r * (h / 4), w / 5, h / 6);
        }
      }
    } else if (t === 'lowshelf') {
      g.fillColor = C(122, 78, 40); this.fRect(0, 0, w, h); g.fill();
      g.strokeColor = C(90, 56, 24); g.lineWidth = 2;
      g.moveTo(this.X(0), this.Y(h / 2)); g.lineTo(this.X(w), this.Y(h / 2)); g.stroke();
      const cols = [[196, 90, 90], [90, 138, 196], [196, 168, 90], [90, 196, 138], [160, 90, 196]];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 10; c++) {
          const cc = cols[(r + c) % 5];
          g.fillColor = C(cc[0], cc[1], cc[2]);
          this.fFill(3 + c * (w / 10.5), 2 + r * (h / 2), w / 14, h / 3);
        }
      }
    } else if (t === 'counter') {
      g.fillColor = C(106, 70, 38); this.fRect(0, 0, w, h); g.fill();
      g.fillColor = C(232, 224, 208); this.fFill(3, 3, w - 6, h * 0.4);
      const trayCols = [[196, 90, 90], [90, 138, 196], [196, 168, 90], [90, 196, 138], [160, 90, 196]];
      const n = Math.floor(w / (this.scale * 1.3));
      for (let i = 0; i < n; i++) {
        const cc = trayCols[i % 5];
        g.fillColor = C(cc[0], cc[1], cc[2]);
        this.fFill(6 + i * this.scale * 1.3, h * 0.55, this.scale * 0.9, h * 0.32);
      }
    } else if (t === 'dining') {
      const cx = w / 2, cy = h / 2;
      g.fillColor = C(106, 70, 38);
      this.fFill(cx - 5, 2, 10, 6);
      this.fFill(cx - 5, h - 8, 10, 6);
      this.fFill(2, cy - 5, 6, 10);
      this.fFill(w - 8, cy - 5, 6, 10);
      g.fillColor = C(138, 90, 50); this.fCircle(cx, cy, w * 0.34); g.fill();
      g.fillColor = C(176, 122, 72); this.fCircle(cx, cy, w * 0.25); g.fill();
      g.fillColor = C(232, 224, 208); this.fCircle(cx - w * 0.12, cy - h * 0.1, 3); g.fill();
      g.fillColor = C(196, 90, 90); this.fCircle(cx + w * 0.12, cy + h * 0.1, 3); g.fill();
    } else if (t === 'labbench') {
      g.fillColor = C(74, 90, 102); this.fRect(0, 0, w, h); g.fill();
      g.fillColor = C(106, 122, 134); this.fFill(2, 2, w - 4, h * 0.5);
      g.fillColor = C(58, 74, 86);
      for (let i = 0; i < Math.floor(w / (this.scale * 2)); i++) {
        this.fFill(6 + i * this.scale * 2, h * 0.55, this.scale * 1.2, h * 0.35);
      }
      g.fillColor = C(196, 90, 90); this.fFill(w - 12, 3, 4, h * 0.4);
      g.fillColor = C(90, 196, 138); this.fFill(w - 7, 3, 4, h * 0.4);
    } else if (t === 'bench') {
      g.fillColor = C(106, 70, 38); this.fRect(0, 0, w, h); g.fill();
      g.fillColor = C(160, 112, 64); this.fFill(1, 2, w - 2, h * 0.3);
    } else if (t === 'board') {
      g.fillColor = C(42, 58, 50); this.fRect(0, 0, w, h); g.fill();
      g.strokeColor = C(138, 106, 58); g.lineWidth = 3;
      this.fRect(0, 0, w, h); g.stroke();
      g.fillColor = C(255, 255, 255, 178);
      this.fFill(8, 3, w * 0.3, 2);
      this.fFill(8, 8, w * 0.2, 2);
    } else if (t === 'sofa') {
      g.fillColor = C(122, 90, 138); this.fRect(0, 0, w, h); g.fill();
      g.fillColor = C(154, 122, 170); this.fFill(2, 2, w - 4, h - 4);
      g.strokeColor = C(106, 74, 122); g.lineWidth = 2;
      for (let i = 1; i < 3; i++) {
        const yy = (h / 3) * i;
        g.moveTo(this.X(2), this.Y(yy)); g.lineTo(this.X(w - 2), this.Y(yy));
      }
      g.stroke();
    } else if (t === 'stage') {
      g.fillColor = C(122, 74, 42); this.fRect(0, 0, w, h); g.fill();
      g.fillColor = C(154, 98, 56); this.fFill(3, 3, w - 6, h - 6);
      g.fillColor = C(160, 58, 58); this.fFill(3, 3, w - 6, h * 0.4);
    }
  }

  private drawWalls() {
    const g = this.roomGfx;
    const s = this.scale, w = IROOM.wall;
    const col = new Color(232, 224, 208, 255);
    const edge = new Color(184, 173, 148, 255);
    // 上墙
    let tl = this.r2s(0, 0);
    g.fillColor = col; g.fillRect(tl.x, tl.y - w * s, IROOM.w * s, w * s);
    g.fillColor = edge; g.fillRect(tl.x, tl.y - w * s, IROOM.w * s, 4);
    // 左墙
    g.fillColor = col; g.fillRect(tl.x, tl.y - IROOM.h * s, w * s, IROOM.h * s);
    g.fillColor = edge; g.fillRect(tl.x + w * s - 4, tl.y - IROOM.h * s, 4, IROOM.h * s);
    // 右墙
    const tr = this.r2s(IROOM.w, 0);
    g.fillColor = col; g.fillRect(tr.x - w * s, tr.y - IROOM.h * s, w * s, IROOM.h * s);
    g.fillColor = edge; g.fillRect(tr.x - w * s, tr.y - IROOM.h * s, 4, IROOM.h * s);
    // 底墙（门缺口两侧）
    const doorC = IROOM.w / 2;
    const bl = this.r2s(0, IROOM.h);
    g.fillColor = col;
    g.fillRect(bl.x, bl.y, (doorC - IROOM.doorHalf) * s, w * s);
    g.fillRect(bl.x + (doorC + IROOM.doorHalf) * s, bl.y,
      (IROOM.w - doorC - IROOM.doorHalf) * s, w * s);
    g.fillColor = edge;
    g.fillRect(bl.x, bl.y, (doorC - IROOM.doorHalf) * s, 4);
    g.fillRect(bl.x + (doorC + IROOM.doorHalf) * s, bl.y,
      (IROOM.w - doorC - IROOM.doorHalf) * s, 4);
  }

  private drawDoorGap() {
    const g = this.roomGfx;
    const s = this.scale, doorC = IROOM.w / 2;
    const bl = this.r2s(doorC - IROOM.doorHalf, IROOM.h);
    g.fillColor = new Color(90, 74, 56, 255);
    g.fillRect(bl.x, bl.y, IROOM.doorHalf * 2 * s, IROOM.wall * s);
    g.strokeColor = new Color(138, 122, 90, 255); g.lineWidth = 2;
    g.rect(bl.x, bl.y, IROOM.doorHalf * 2 * s, IROOM.wall * s); g.stroke();
  }
}

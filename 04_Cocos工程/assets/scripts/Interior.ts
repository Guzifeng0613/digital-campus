/* 室内场景（进门黑屏切换，出门返回）
   与网页端 main.js 的 interior 模块一致：简单房间 + 角色 + 淡入淡出。 */
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

const IROOM = { w: 22, h: 15, wall: 1.2, doorHalf: 1.6 };
const IFURN = [
  { x: 8.2, y: 4.5, w: 5.6, h: 3.2, type: 'table' },
  { x: 3.2, y: 3.2, w: 3.4, h: 1.6, type: 'desk' },
  { x: 15.4, y: 3.2, w: 3.4, h: 1.6, type: 'desk' },
  { x: 2.6, y: 8.4, w: 1.8, h: 3.6, type: 'shelf' },
  { x: 17.6, y: 8.4, w: 1.8, h: 3.6, type: 'shelf' }
];

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

  active = false;
  private trans = false;
  private ix = 0;
  private iy = 0;
  private phase = 0;
  private facing = 'down';
  private moving = false;
  private runLock = false;
  private stepT = 0;
  private scale = 30;
  private ox = 0;
  private oy = 0;

  constructor(canvas: Node, frames: PlayerFrames, sfx: Sfx, runLock: () => boolean) {
    this.frames = frames;
    this.sfx = sfx;
    this.runLockRef = runLock;

    // 根节点（全屏）
    this.root = new Node('Interior');
    this.root.layer = UI;
    this.root.addComponent(UITransform);
    this.root.active = false;
    canvas.addChild(this.root);

    // 房间背景 Graphics
    const rn = new Node('Room');
    rn.layer = UI;
    rn.addComponent(UITransform);
    this.roomGfx = rn.addComponent(Graphics);
    this.root.addChild(rn);

    // 角色
    this.player = new Node('IPlayer');
    this.player.layer = UI;
    this.player.addComponent(UITransform);
    this.playerSprite = this.player.addComponent(Sprite);
    this.root.addChild(this.player);

    // 黑屏淡入淡出
    this.fade = new Node('Fade');
    this.fade.layer = UI;
    this.fade.addComponent(UITransform);
    this.fadeGfx = this.fade.addComponent(Graphics);
    this.root.addChild(this.fade);

    // 顶部 HUD
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
    (tip as Label).string = '走到下方门口即可离开';
    tip.node.setPosition(0, vs.height / 2 - 54, 0);
    this.hud.addChild(this.nameLabel.node);
    this.hud.addChild(tip.node);
    this.root.addChild(this.hud);

    this.resize();
  }
  private runLockRef: () => boolean;

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
    // 黑屏
    const g = this.fadeGfx;
    g.clear();
    g.fillColor = new Color(0, 0, 0, 255);
    g.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
    this.fade.active = false;
    if (this.active) this.drawRoom();
  }

  private r2s(rx: number, ry: number): Vec3 {
    return new Vec3(-this.ox - IROOM.w * this.scale / 2 + rx * this.scale,
      this.oy + IROOM.h * this.scale / 2 - ry * this.scale, 0);
  }

  private roomBlocked(rx: number, ry: number): boolean {
    const w = IROOM.wall;
    const doorC = IROOM.w / 2;
    const inDoor = Math.abs(rx - doorC) < IROOM.doorHalf && ry > IROOM.h - w - 0.4;
    if (ry < w || rx < w || rx > IROOM.w - w) return true;
    if (ry > IROOM.h - w && !inDoor) return true;
    for (const f of IFURN) {
      if (rx > f.x - 0.2 && rx < f.x + f.w + 0.2 && ry > f.y - 0.2 && ry < f.y + f.h + 0.2) return true;
    }
    return false;
  }

  private onEnterDone: (() => void) | null = null;
  private onExitDone: (() => void) | null = null;

  enter(b: CampusBuilding, onDone: () => void) {
    if (this.trans || this.active) return;
    this.trans = true;
    this.onEnterDone = onDone;
    this.fade.active = true;
    this.fadeGfx.fillColor = new Color(0, 0, 0, 255);
    const vs = screen.windowSize;
    this.fadeGfx.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
    // 用一个简单的 tween：直接在 update 里推进 alpha
    this.fadeAlpha = 0;
    this.fadeTarget = 1;
    this.phase2 = 'enter';
    this.pendingB = b;
  }
  private pendingB: CampusBuilding | null = null;
  private fadeAlpha = 0;
  private fadeTarget = 0;
  private phase2 = '';
  private holdT = 0;

  exit(onDone: () => void) {
    if (this.trans) return;
    this.trans = true;
    this.onExitDone = onDone;
    this.fade.active = true;
    this.fadeAlpha = 0;
    this.fadeTarget = 1;
    this.phase2 = 'exit';
  }

  private finishEnter() {
    const b = this.pendingB!;
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
    // 淡出
    this.fadeTarget = 0;
    this.phase2 = 'fadein';
    this.holdT = 0;
  }

  private finishExit() {
    this.active = false;
    this.root.active = false;
    this.fade.active = false;
    this.trans = false;
    this.phase2 = '';
    if (this.onExitDone) this.onExitDone();
    this.onExitDone = null;
  }

  private updateFade(dt: number) {
    if (!this.phase2) return;
    const speed = 2.2;
    if (this.fadeAlpha < this.fadeTarget) this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + dt * speed);
    if (this.phase2 === 'enter' && this.fadeAlpha >= 1) {
      this.finishEnter();
      return;
    }
    if (this.phase2 === 'exit' && this.fadeAlpha >= 1) {
      this.finishExit();
      return;
    }
    if (this.phase2 === 'fadein' && this.fadeAlpha <= 0.01) {
      this.fade.active = false;
      this.phase2 = '';
      this.trans = false;
      if (this.onEnterDone) this.onEnterDone();
      this.onEnterDone = null;
      return;
    }
    if (this.phase2 === 'fadein') this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * speed);
    const g = this.fadeGfx;
    g.clear();
    const vs = screen.windowSize;
    g.fillColor = new Color(0, 0, 0, Math.round(this.fadeAlpha * 255));
    g.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
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
    // 走到门缺口
    const doorC = IROOM.w / 2;
    if (Math.abs(this.ix - doorC) < IROOM.doorHalf && this.iy > IROOM.h - IROOM.wall - 0.2) {
      this.exit(() => { if (this.onExitToOuter) this.onExitToOuter(); });
    }
    this.updatePlayerVisual();
  }
  private onExitToOuter: (() => void) | null = null;
  setExitHandler(cb: () => void) { this.onExitToOuter = cb; }

  private updatePlayerVisual() {
    const set = this.frames[this.facing];
    if (!set) return;
    const seq = this.moving ? (this.runLockRef() ? set.run : set.walk) : set.idle;
    const fi = this.moving ? (Math.floor(this.phase) % seq.length) : 0;
    const sf = seq && seq[fi];
    const run = this.runLockRef();
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
    const ut = this.player.getComponent(UITransform)!;
    ut.setContentSize(fw, fh);
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
    // 背景
    g.fillColor = new Color(26, 33, 28, 255);
    g.fillRect(-vs.width / 2, -vs.height / 2, vs.width, vs.height);
    const s = this.scale;
    // 地板
    const fp = this.r2s(IROOM.wall, IROOM.h - IROOM.wall);
    const fw = (IROOM.w - 2 * IROOM.wall) * s;
    const fh = (IROOM.h - 2 * IROOM.wall) * s;
    g.fillColor = new Color(201, 160, 107, 255);
    g.rect(fp.x, fp.y, fw, fh); g.fill();
    // 木地板竖纹
    g.strokeColor = new Color(120, 82, 40, 70);
    g.lineWidth = 1;
    for (let i = 1; i < IROOM.w - 2 * IROOM.wall; i += 1) {
      const x = fp.x + i * s;
      g.moveTo(x, fp.y); g.lineTo(x, fp.y + fh);
    }
    g.stroke();
    // 地毯
    const rp = this.r2s(6.5, 10);
    g.fillColor = new Color(122, 90, 156, 255);
    g.rect(rp.x, rp.y - 4.5 * s, 9 * s, 4.5 * s); g.fill();
    g.strokeColor = new Color(224, 201, 240, 255);
    g.lineWidth = 3;
    g.rect(rp.x + 4, rp.y - 4.5 * s + 4, 9 * s - 8, 4.5 * s - 8); g.stroke();
    // 家具
    for (const f of IFURN) this.drawFurniture(f);
    // 墙
    this.drawWalls();
    this.drawDoorGap();
  }

  private drawFurniture(f: { x: number; y: number; w: number; h: number; type: string }) {
    const g = this.roomGfx;
    const s = this.scale;
    const p = this.r2s(f.x, f.y + f.h);
    const w = f.w * s, h = f.h * s;
    if (f.type === 'table') {
      g.fillColor = new Color(138, 90, 50, 255); g.rect(p.x, p.y, w, h); g.fill();
      g.fillColor = new Color(168, 116, 72, 255); g.rect(p.x + 4, p.y + 4, w - 8, h - 8); g.fill();
      g.fillColor = new Color(217, 201, 160, 255); g.circle(p.x + w * 0.3, p.y + h * 0.5, 6); g.fill();
      g.fillColor = new Color(90, 138, 90, 255); g.circle(p.x + w * 0.7, p.y + h * 0.5, 7); g.fill();
    } else if (f.type === 'desk') {
      g.fillColor = new Color(154, 106, 60, 255); g.rect(p.x, p.y, w, h); g.fill();
      g.fillColor = new Color(192, 138, 82, 255); g.rect(p.x + 3, p.y + 3, w - 6, h - 6); g.fill();
    } else if (f.type === 'shelf') {
      g.fillColor = new Color(122, 78, 40, 255); g.rect(p.x, p.y, w, h); g.fill();
      g.strokeColor = new Color(90, 56, 24, 255); g.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        g.moveTo(p.x, p.y + (h / 4) * i); g.lineTo(p.x + w, p.y + (h / 4) * i);
      }
      g.stroke();
      const cols = [[196, 90, 90], [90, 138, 196], [196, 168, 90], [90, 196, 138]];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const cc = cols[(r + c) % 4];
          g.fillColor = new Color(cc[0], cc[1], cc[2], 255);
          g.rect(p.x + 3 + c * (w / 3.2), p.y + 3 + r * (h / 4), w / 5, h / 6); g.fill();
        }
      }
    }
  }

  private drawWalls() {
    const g = this.roomGfx;
    const s = this.scale, w = IROOM.wall;
    const col = new Color(232, 224, 208, 255);
    const edge = new Color(184, 173, 148, 255);
    // 上墙
    let p = this.r2s(0, IROOM.h);
    g.fillColor = col; g.rect(p.x, p.y - w * s, IROOM.w * s, w * s); g.fill();
    g.fillColor = edge; g.rect(p.x, p.y - w * s, IROOM.w * s, 4); g.fill();
    // 左墙
    p = this.r2s(0, IROOM.h);
    g.fillColor = col; g.rect(p.x, p.y - IROOM.h * s, w * s, IROOM.h * s); g.fill();
    g.fillColor = edge; g.rect(p.x + w * s - 4, p.y - IROOM.h * s, 4, IROOM.h * s); g.fill();
    // 右墙
    p = this.r2s(IROOM.w, IROOM.h);
    g.fillColor = col; g.rect(p.x - w * s, p.y - IROOM.h * s, w * s, IROOM.h * s); g.fill();
    g.fillColor = edge; g.rect(p.x - w * s, p.y - IROOM.h * s, 4, IROOM.h * s); g.fill();
    // 底墙（门缺口两侧）
    const doorC = IROOM.w / 2;
    p = this.r2s(0, w);
    g.fillColor = col;
    g.rect(p.x, p.y, (doorC - IROOM.doorHalf) * s, w * s); g.fill();
    g.rect(p.x + (doorC + IROOM.doorHalf) * s, p.y,
      (IROOM.w - doorC - IROOM.doorHalf) * s, w * s); g.fill();
  }

  private drawDoorGap() {
    const g = this.roomGfx;
    const s = this.scale, doorC = IROOM.w / 2;
    const p = this.r2s(doorC - IROOM.doorHalf, IROOM.wall);
    g.fillColor = new Color(90, 74, 56, 255);
    g.rect(p.x, p.y, IROOM.doorHalf * 2 * s, IROOM.wall * s); g.fill();
    g.strokeColor = new Color(138, 122, 90, 255); g.lineWidth = 2;
    g.rect(p.x, p.y, IROOM.doorHalf * 2 * s, IROOM.wall * s); g.stroke();
  }
}

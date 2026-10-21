import {
  _decorator, Component, Node, director, Canvas, Camera, UITransform, Sprite, SpriteFrame,
  Graphics, Label, Button, resources, Layers, Color, Vec3, Vec2, Rect, Texture2D,
  input, Input, EventTouch, EventKeyboard, KeyCode, EventMouse, screen
} from 'cc';
import { META, BUILDINGS, GROUP_CN, CampusBuilding } from './CampusData';
import {
  GROUND_W, GROUND_H, gridToLocal, gridToImage, imageToLocal, localToImage, imageToGrid,
  isBlocked, fitZoom, spriteGeometry, GATE_GEOM, buildingDoorCenter, DOOR_W,
  findPath, nearestOpenGrid, pathToBuilding, GateOpen
} from './IsoMath';

const { ccclass } = _decorator;
const UI = Layers.Enum.UI_2D;
const MM_COLOR: Record<string, [number, number, number]> = {
  teaching: [232, 118, 107], public: [240, 178, 76], sports: [95, 180, 214],
  dining: [123, 209, 138], gate: [201, 160, 220], nature: [143, 191, 127]
};
const FRAME_W = 48, FRAME_H = 64, PLAYER_SCALE = 1.7;

/** 唯一入口：挂到场景任意节点即可（无 Canvas 时会自动创建）。运行时自动生成整张等距地图。 */
@ccclass('CampusBootstrap')
export class CampusBootstrap extends Component {
  private canvas!: Node;
  private camera!: Camera;
  private content!: Node;
  private groundNode!: Node;
  private player!: Node;
  private pg!: Graphics;                       // 代码绘制小人（帧加载失败时的兜底）
  private playerSprite: Sprite | null = null; // 像素角色序列帧
  private playerFrames: Record<string,
    { idle: (SpriteFrame | null)[]; walk: (SpriteFrame | null)[]; run: (SpriteFrame | null)[] }> = {};
  private panel!: Node;
  private photoSprite: Sprite | null = null;

  private zoom = 0.1;
  private follow = false;
  private readonly keys = new Set<number>();
  private playerImg = new Vec2();          // 角色脚点（图像世界坐标）
  private phase = 0;
  private facing = 'down';
  private moving = false;
  private running = false;
  private runLock = false;
  private buildingNodes: { b: CampusBuilding; node: Node }[] = [];
  // TEACH-1 深度拆分部件（独立排序节点）：WINGS / FLOOR / CORR / ARCH
  private partNodes: { depth: number; node: Node }[] = [];

  // 校门开合
  private gateOpen: GateOpen = {};
  private gateBars: { id: string; pivot: Node }[] = [];
  // 建筑门开合
  private doorOpen: GateOpen = {};
  private doorGfx: { id: string; g: Graphics; cx: number; cy: number }[] = [];
  private btnRun!: Node;

  // 自动寻路
  private navPath: Vec2[] | null = null;          // 图像世界坐标路径点
  private navName = '';
  private navStuck = 0;
  private elapsed = 0;
  private navTipUntil = -1;
  private currentBuilding: CampusBuilding | null = null;
  private pathGfx: Graphics | null = null;
  private navTip: Label | null = null;

  // 小地图
  private groundSF: SpriteFrame | null = null;
  private mmGfx: Graphics | null = null;
  private mmDrawW = 216;
  private mmDrawH = 111;
  private mmCY = -8;

  // 建筑名标签
  private labelNodes: { b: CampusBuilding; root: Node; label: Label }[] = [];
  private readonly LABEL_MIN_ZOOM = 0.3;

  // 触摸拖拽
  private dragging = false;
  private moved = false;
  private lastTouch = new Vec2();
  private touchStart = new Vec2();

  async start() {
    try {
      console.log('%c[数字校园] 开始初始化…', 'color:#2d6cdf');
      const ui = this.ensureCanvas();
      this.canvas = ui.canvas; this.camera = ui.camera;
      console.log('[数字校园] Canvas/相机就绪');
      this.buildContent();
      this.buildHUD();
      await this.buildMap();
      await this.loadPlayerFrames();
      this.buildPlayer();
      this.centerView();
      this.bindInput();
      console.log('%c[数字校园] 构建完成：共 ' + this.buildingNodes.length +
        ' 栋建筑。WASD 移动 / 滚轮缩放 / 拖拽平移 / 点击建筑查看信息', 'color:#2ecc71');
    } catch (err) {
      console.error('[数字校园] 初始化失败：', err);
      this.showError(err);
    }
  }

  private showError(err: any) {
    try {
      if (!this.canvas) return;
      const n = new Node('ErrorTip'); n.layer = UI;
      n.addComponent(UITransform).setContentSize(700, 90);
      const l = n.addComponent(Label);
      l.string = '数字校园初始化失败，请按 F12 查看控制台：\n' +
        (err && err.message ? err.message : String(err));
      l.fontSize = 22; l.lineHeight = 30; l.color = new Color(255, 130, 130);
      l.overflow = Label.Overflow.SHRINK;
      n.setPosition(0, 0, 0);
      this.canvas.addChild(n);
    } catch (e) { /* 忽略 */ }
  }

  // ---------- 场景与相机 ----------
  private ensureCanvas(): { canvas: Node; camera: Camera } {
    let canvasNode = director.getScene()!.getChildByName('Canvas');
    if (!canvasNode) {
      canvasNode = new Node('Canvas');
      canvasNode.layer = UI;
      const canvas = canvasNode.addComponent(Canvas);
      const ut = canvasNode.addComponent(UITransform);
      const size = screen.windowSize;
      ut.setContentSize(size.width, size.height);
      const camNode = new Node('UICamera');
      camNode.layer = UI;
      camNode.setPosition(0, 0, 1000);
      canvasNode.addChild(camNode);
      const cam = camNode.addComponent(Camera);
      cam.projection = Camera.ProjectionType.ORTHO;
      cam.visibility = UI;
      cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
      cam.clearColor = new Color(15, 20, 27, 255);
      cam.orthoHeight = size.height / 2;
      cam.near = 0;
      cam.far = 2000;
      cam.priority = 1024;
      canvas.cameraComponent = cam;
      director.getScene()!.addChild(canvasNode);
    }
    const cam = canvasNode.getComponentInChildren(Camera)!;
    return { canvas: canvasNode, camera: cam };
  }

  private buildContent() {
    this.content = new Node('CampusContent');
    this.content.layer = UI;
    this.content.addComponent(UITransform);
    this.canvas.addChild(this.content);
  }

  // ---------- 资源加载与地图 ----------
  private loadSF(res: string): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
      resources.load(res + '/spriteFrame', SpriteFrame, (err, sf) => {
        if (err) { reject(err); return; }
        resolve(sf);
      });
    });
  }

  private async buildMap() {
    // 地面
    console.log('[数字校园] 加载地面底图…');
    const gsf = await this.loadSF(META.ground);
    gsf.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    this.groundSF = gsf;
    const gNode = this.makeSpriteNode(gsf, 'Ground');
    gNode.getComponent(UITransform)!.setContentSize(GROUND_W, GROUND_H);
    gNode.setPosition(0, 0, 0);
    gNode.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
    this.content.addChild(gNode);
    this.groundNode = gNode;

    // 寻路路径层（地面之上；建筑/角色按深度排序时会盖在其上）
    const pathNode = new Node('NavPath');
    pathNode.layer = UI;
    pathNode.addComponent(UITransform);
    this.pathGfx = pathNode.addComponent(Graphics);
    this.content.addChild(pathNode);

    // 建筑（并行加载，单个失败不阻断；校门用固定门楼 _towers）
    console.log('[数字校园] 加载 ' + BUILDINGS.length + ' 栋建筑资源…');
    const sfs = await Promise.all(BUILDINGS.map(b => {
      const res = GATE_GEOM[b.id] ? b.res + '_towers' : b.res;
      return this.loadSF(res).catch((err) => {
        console.error('[数字校园] 资源加载失败：' + res + '（' + b.name + '）', err);
        return null;
      });
    }));
    BUILDINGS.forEach((b, i) => {
      const src = sfs[i];
      if (!src) return;
      src.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.POINT);
      const realW = src.texture.width, realH = src.texture.height;
      const geom = spriteGeometry(b, realW, realH);
      // 整图（不裁剪 bbox）
      const sf = new SpriteFrame();
      sf.texture = src.texture;
      sf.rect = new Rect(0, 0, realW, realH);
      const node = this.makeSpriteNode(sf, b.id);
      const ut = node.getComponent(UITransform)!;
      ut.setContentSize(geom.W, geom.H);
      ut.setAnchorPoint(0, 1);                       // 左上角
      node.setPosition(geom.lx, geom.ly, 0);
      node.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
      this.content.addChild(node);
      this.buildingNodes.push({ b, node });
      // TEACH-1 深度拆分：整图节点隐藏（仅留作信息卡配图），改用 4 个独立排序部件
      if (b.id === 'TEACH-1') {
        node.active = false;
        this.buildTeachParts(b, geom);
      }
      // 建筑门（门扇绕外侧门轴向内打开）
      if (DOOR_W[b.id] != null) {
        const c = buildingDoorCenter(b, realW, realH);
        const g = new Node('BuildingDoor_' + b.id);
        g.layer = UI;
        g.addComponent(UITransform);
        const gg = g.addComponent(Graphics);
        g.setPosition(gridToLocal(c.gx, c.gy));
        this.content.addChild(g);
        this.doorGfx.push({ id: b.id, g: gg, cx: c.gx, cy: c.gy });
        this.doorOpen[b.id] = 0;
      }
      // 校门伸缩门（异步加载，动画开合）
      if (GATE_GEOM[b.id]) {
        this.loadSF(b.res + '_bars').then(bsf => {
          bsf.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.POINT);
          this.buildGateBars(b, node, geom, bsf);
        }).catch(() => null);
      }
    });
    if (this.buildingNodes.length < BUILDINGS.length) {
      console.warn('[数字校园] 仅加载 ' + this.buildingNodes.length + '/' + BUILDINGS.length +
        ' 栋，请检查 assets/resources/sprites 下图片是否齐全、文件夹名是否为小写 resources');
    }
    this.buildLabels();
    this.buildMinimap();
    this.sortSprites();
  }

  // ---------- 校门伸缩门：固定端枢轴 + 旋转对齐门洞 + 沿门洞压缩 ----------
  private buildGateBars(b: CampusBuilding, frameNode: Node,
                        geom: { W: number; H: number }, bsf: SpriteFrame) {
    const gm = GATE_GEOM[b.id];
    const realW = bsf.texture.width, realH = bsf.texture.height;
    const sx = geom.W / realW, sy = geom.H / realH;
    // 枢轴节点：固定端（门柱）位置，旋转使门洞方向对齐 x 轴
    const pivot = new Node('GatePivot');
    pivot.layer = UI;
    pivot.addComponent(UITransform);
    pivot.setPosition(gm.fx * sx, -gm.fy * sy, 0);
    pivot.angle = Math.atan2(gm.uy, gm.ux) * 180 / Math.PI;
    // 伸缩门（整图）：偏移使固定端落在枢轴原点
    const bars = new Node('GateBars');
    bars.layer = UI;
    const ut = bars.addComponent(UITransform);
    ut.setContentSize(geom.W, geom.H);
    ut.setAnchorPoint(0, 1);
    const sp = bars.addComponent(Sprite);
    sp.spriteFrame = bsf;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    bars.setPosition(-gm.fx * sx, gm.fy * sy, 0);
    pivot.addChild(bars);
    frameNode.addChild(pivot);
    this.gateBars.push({ id: b.id, pivot });
    this.gateOpen[b.id] = 0;
  }
  // ---------- TEACH-1 深度拆分：WINGS / FLOOR / CORR / ARCH，与整图同尺寸同位置，按部件深度排序 ----------
  private buildTeachParts(b: CampusBuilding, geom: { W: number; H: number; lx: number; ly: number }) {
    // 部件（part, 深度=gx+gy 对角）：FLOOR 庭院铺装在脚下、CORR 空中连廊在北、ARCH 大拱门在南、WINGS 双D翼
    const parts: [string, number][] = [
      ['WINGS', 328.65], ['FLOOR', 327.5], ['CORR', 328.2], ['ARCH', 345.2]
    ];
    parts.forEach(([p, depth]) => {
      this.loadSF(b.res + '_' + p).then(tsf => {
        tsf.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.POINT);
        const sf = new SpriteFrame();
        sf.texture = tsf.texture;
        sf.rect = new Rect(0, 0, tsf.texture.width, tsf.texture.height);
        const node = this.makeSpriteNode(sf, 'TEACH-1_' + p);
        const ut = node.getComponent(UITransform)!;
        ut.setContentSize(geom.W, geom.H);
        ut.setAnchorPoint(0, 1);
        node.setPosition(geom.lx, geom.ly, 0);
        node.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
        this.content.addChild(node);
        this.partNodes.push({ depth, node });
        this.sortSprites();
      }).catch((err) => console.error('[数字校园] 一教部件加载失败：' + p, err));
    });
  }

  // 角色靠近校门时开合（靠近目标点则 open→1，否则→0）
  private updateGates(dt: number) {
    const pg = imageToGrid(this.playerImg.x, this.playerImg.y);
    for (const x of this.gateBars) {
      const b = BUILDINGS.find(z => z.id === x.id)!;
      const [gx, gy, w, h] = b.grid;
      const cx = gx + w / 2, cy = gy + h / 2;
      const d = Math.hypot(pg.gx - cx, pg.gy - cy);
      const target = d < 7.5 ? 1 : 0;
      const cur = this.gateOpen[x.id] || 0;
      const open = cur + (target - cur) * Math.min(1, dt * 5);
      this.gateOpen[x.id] = open;
      const s = 1 - 0.85 * open;
      x.pivot.setScale(s, 1, 1);
    }
  }

  // ---------- 建筑门：角色靠近时门扇绕外侧门轴向内转 90° ----------
  private updateDoors(dt: number) {
    const pg = imageToGrid(this.playerImg.x, this.playerImg.y);
    for (const x of this.doorGfx) {
      const d = Math.hypot(pg.gx - x.cx, pg.gy - x.cy);
      const target = d < 5.5 ? 1 : 0;
      const cur = this.doorOpen[x.id] || 0;
      const open = cur + (target - cur) * Math.min(1, dt * 5);
      this.doorOpen[x.id] = open;
      this.drawDoor(x.g, x.id, open);
    }
  }
  // 门扇绘制（节点本地坐标，原点为门中心）
  private drawDoor(g: Graphics, id: string, open: number) {
    const w = DOOR_W[id], half = w / 2;
    const thick = 0.35;
    const ang = open * Math.PI / 2;
    // 网格偏移 -> 本地坐标
    const L = (dx: number, dy: number): Vec2 =>
      new Vec2((dx - dy) * 32, -(dx + dy) * 16);
    const poly = (pts: Vec2[], fill: Color, stroke: Color | null) => {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.close();
      if (fill) { g.fillColor = fill; g.fill(); }
      if (stroke) { g.strokeColor = stroke; g.lineWidth = 1.5; g.stroke(); }
    };
    g.clear();
    // 门洞（开启后露出的室内暗部）
    if (open > 0.02) {
      const a = Math.min(1, open * 1.4);
      const dark = new Color(32, 36, 44, Math.round(255 * a));
      poly([
        L(-half, 0), L(half, 0), L(half, -thick), L(-half, -thick)
      ], dark, null);
    }
    // 左门扇（门轴在左，自由端向内）
    const lc = half * Math.cos(ang), ls = half * Math.sin(ang);
    poly([
      L(-half, 0), L(-half + lc, -ls), L(-half + lc, -ls - thick), L(-half, -thick)
    ], new Color(122, 158, 196, 235), new Color(28, 35, 48, 255));
    // 右门扇（门轴在右，自由端向内）
    poly([
      L(half, 0), L(half - lc, -ls), L(half - lc, -ls - thick), L(half, -thick)
    ], new Color(134, 168, 204, 235), new Color(28, 35, 48, 255));
  }

  // ---------- 建筑名标签（canvas 层，字号恒定；放大到阈值后显示） ----------
  private buildLabels() {
    for (const b of BUILDINGS) {
      const root = new Node('Label_' + b.id);
      root.layer = UI;
      const w = b.name.length * 17 + 20;
      root.addComponent(UITransform).setContentSize(w, 26);
      const bg = root.addComponent(Graphics);
      bg.fillColor = new Color(15, 22, 34, 184);
      bg.roundRect(-w / 2, -13, w, 26, 6); bg.fill();
      bg.strokeColor = new Color(120, 170, 255, 90); bg.lineWidth = 1; bg.stroke();
      const ln = new Node('T');
      ln.layer = UI;
      ln.addComponent(UITransform).setContentSize(w, 26);
      const l = ln.addComponent(Label);
      l.string = b.name; l.fontSize = 16; l.lineHeight = 20;
      l.color = new Color(234, 242, 255);
      l.horizontalAlign = Label.HorizontalAlign.CENTER;
      l.verticalAlign = Label.VerticalAlign.CENTER;
      root.addChild(ln);
      root.active = false;
      this.canvas.addChild(root);
      this.labelNodes.push({ b, root, label: l });
    }
  }
  private updateLabels() {
    const show = this.zoom >= this.LABEL_MIN_ZOOM;
    const cp = this.content.position;
    const vs = this.viewSize();
    for (const { b, root } of this.labelNodes) {
      if (!show) { if (root.active) root.active = false; continue; }
      const entry = this.buildingNodes.find(x => x.b === b);
      if (!entry) { if (root.active) root.active = false; continue; }
      const ut = entry.node.getComponent(UITransform)!;
      // 节点（锚点 0,1）顶部中心
      const cx = entry.node.position.x + ut.contentSize.width / 2;
      const cy = entry.node.position.y;
      const ux = cx * this.zoom + cp.x;
      const uy = cy * this.zoom + cp.y + 14;
      if (ux < -vs.x / 2 - 80 || ux > vs.x / 2 + 80 ||
          uy < -vs.y / 2 - 30 || uy > vs.y / 2 + 30) { root.active = false; continue; }
      root.active = true;
      root.setPosition(ux, uy, 0);
    }
  }

  // ---------- 小地图导航 ----------
  private buildMinimap() {
    const s = Math.min(216 / GROUND_W, 111 / GROUND_H);
    this.mmDrawW = GROUND_W * s;
    this.mmDrawH = GROUND_H * s;
    const W = 236, H = 150;
    const root = new Node('Minimap');
    root.layer = UI;
    root.addComponent(UITransform).setContentSize(W, H);
    const bg = root.addComponent(Graphics);
    bg.fillColor = new Color(18, 26, 38, 224);
    bg.roundRect(-W / 2, -H / 2, W, H, 12); bg.fill();
    bg.strokeColor = new Color(120, 170, 255, 90); bg.lineWidth = 1; bg.stroke();
    // 标题
    const tn = new Node('Title'); tn.layer = UI;
    tn.addComponent(UITransform).setContentSize(W - 24, 20);
    const tl = tn.addComponent(Label);
    tl.string = '校园导览 · 点击定位视角'; tl.fontSize = 13; tl.lineHeight = 16;
    tl.color = new Color(156, 196, 255);
    tl.horizontalAlign = Label.HorizontalAlign.LEFT;
    tn.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    tn.setPosition(-W / 2 + 12, H / 2 - 17, 0);
    root.addChild(tn);
    // 地面缩略
    if (this.groundSF) {
      const gn = new Node('MMGround'); gn.layer = UI;
      gn.addComponent(UITransform).setContentSize(this.mmDrawW, this.mmDrawH);
      const gs = gn.addComponent(Sprite);
      gs.spriteFrame = this.groundSF; gs.sizeMode = Sprite.SizeMode.CUSTOM;
      gn.setPosition(0, this.mmCY, 0);
      root.addChild(gn);
    }
    // 覆盖层（路线 / 建筑点 / 视野框 / 角色点）
    const ov = new Node('MMOverlay'); ov.layer = UI;
    ov.addComponent(UITransform).setContentSize(W, H);
    this.mmGfx = ov.addComponent(Graphics);
    root.addChild(ov);
    // 位置：左下角
    const vs = this.viewSize();
    root.setPosition(-vs.x / 2 + 18 + W / 2, -vs.y / 2 + 16 + H / 2, 0);
    // 点击：主视角飞到该点
    root.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
      const ui = e.getUILocation();
      const loc = root.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));
      const wx = (loc.x / this.mmDrawW + 0.5) * GROUND_W;
      const wy = (0.5 - (loc.y - this.mmCY) / this.mmDrawH) * GROUND_H;
      const [dx0, dy0, dx1, dy1] = META.diamond;
      const inDiamond = Math.abs(wx - (dx0 + dx1) / 2) / ((dx1 - dx0) / 2)
        + Math.abs(wy - (dy0 + dy1) / 2) / ((dy1 - dy0) / 2) <= 1;
      if (!inDiamond) return;   // 忽略菱形校园外的留白
      this.follow = false; this.updateFollowBtn();
      const lp = imageToLocal(wx, wy);
      this.content.setPosition(-lp.x * this.zoom, -lp.y * this.zoom, 0);
    }, this);
    this.canvas.addChild(root);
  }
  private updateMinimap() {
    const g = this.mmGfx;
    if (!g) return;
    g.clear();
    const toMM = (wx: number, wy: number) => new Vec2(
      (wx / GROUND_W - 0.5) * this.mmDrawW,
      (0.5 - wy / GROUND_H) * this.mmDrawH + this.mmCY
    );
    // 寻路路线
    if (this.navPath && this.navPath.length) {
      const pts = [new Vec2(this.playerImg.x, this.playerImg.y), ...this.navPath];
      g.strokeColor = new Color(120, 178, 255, 240); g.lineWidth = 1.3;
      pts.forEach((p, i) => { const m = toMM(p.x, p.y); if (i) g.lineTo(m.x, m.y); else g.moveTo(m.x, m.y); });
      g.stroke();
    }
    // 建筑点
    for (const b of BUILDINGS) {
      const c = gridToImage(b.grid[0] + b.grid[2] / 2, b.grid[1] + b.grid[3] / 2);
      const m = toMM(c.x, c.y);
      const col = MM_COLOR[b.group] || [159, 180, 216];
      g.fillColor = new Color(col[0], col[1], col[2], 255);
      g.rect(m.x - 1.6, m.y - 1.6, 3.2, 3.2); g.fill();
    }
    // 视野框
    const vs = this.viewSize();
    const cp = this.content.position;
    const ui2img = (sx: number, sy: number) => {
      const ux = sx - vs.x / 2, uy = sy - vs.y / 2;
      return localToImage((ux - cp.x) / this.zoom, (uy - cp.y) / this.zoom);
    };
    const corners = [ui2img(0, 0), ui2img(vs.x, 0), ui2img(0, vs.y), ui2img(vs.x, vs.y)];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    corners.forEach(c => {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    });
    const pTop = toMM(minX, minY), pBot = toMM(maxX, maxY);
    const rx = Math.min(pTop.x, pBot.x), ry = Math.min(pTop.y, pBot.y);
    const rw = Math.abs(pBot.x - pTop.x), rh = Math.abs(pBot.y - pTop.y);
    g.fillColor = new Color(255, 255, 255, 18); g.rect(rx, ry, rw, rh); g.fill();
    g.strokeColor = new Color(255, 255, 255, 190); g.lineWidth = 1; g.rect(rx, ry, rw, rh); g.stroke();
    // 角色点
    const pm = toMM(this.playerImg.x, this.playerImg.y);
    g.fillColor = new Color(255, 210, 90, 70); g.circle(pm.x, pm.y, 5); g.fill();
    g.fillColor = new Color(255, 210, 90, 255); g.circle(pm.x, pm.y, 3); g.fill();
    g.strokeColor = new Color(255, 255, 255, 255); g.lineWidth = 1; g.circle(pm.x, pm.y, 3); g.stroke();
  }

  private makeSpriteNode(sf: SpriteFrame, name: string): Node {
    const n = new Node(name);
    n.layer = UI;
    n.addComponent(UITransform);
    const sp = n.addComponent(Sprite);
    sp.spriteFrame = sf;
    sp.type = Sprite.Type.SIMPLE;
    return n;
  }

  // ---------- 角色（像素序列帧 idle/walk/run，加载失败时回退 Graphics 绘制） ----------
  private async loadPlayerFrames() {
    const dirs = ['down', 'up', 'left', 'right'];
    for (const dir of dirs) {
      const idle = await this.loadSF('player/' + dir + '_idle').catch(() => null);
      const walk: (SpriteFrame | null)[] = [];
      const run: (SpriteFrame | null)[] = [];
      for (let f = 0; f < 4; f++) {
        walk.push(await this.loadSF('player/' + dir + '_walk_' + f).catch(() => null));
        run.push(await this.loadSF('player/' + dir + '_run_' + f).catch(() => null));
      }
      [idle, ...walk, ...run].forEach(sf => {
        if (sf) sf.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.POINT);
      });
      this.playerFrames[dir] = { idle: [idle], walk, run };
    }
    const ok = dirs.filter(d => this.playerFrames[d].idle[0]).length;
    console.log('[数字校园] 角色帧：' + (ok === 4 ? '4 方向（idle/walk/run）就绪' : ok + '/4 方向，将回退代码绘制'));
  }

  private buildPlayer() {
    // 起点：南门内侧
    const gate = BUILDINGS.find(b => b.id === 'GATE-S')!;
    const [gx, gy] = [gate.grid[0] + 6, gate.grid[1] - 6];
    const p = gridToLocal(gx, gy);
    const img = localToImage(p.x, p.y);
    this.playerImg.set(img.x, img.y);

    this.player = new Node('Player');
    this.player.layer = UI;
    const ut = this.player.addComponent(UITransform);
    ut.setContentSize(FRAME_W * PLAYER_SCALE, FRAME_H * PLAYER_SCALE);
    ut.setAnchorPoint(0.5, 0);             // 锚点在鞋底（帧图底部对齐脚点）
    this.playerSprite = this.player.addComponent(Sprite);
    this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.pg = this.player.addComponent(Graphics);  // 帧加载失败时的兜底绘制
    this.content.addChild(this.player);
    this.updatePlayerFrame();
  }

  private updatePlayerFrame() {
    const set = this.playerFrames[this.facing];
    const hasFrame = !!(set && set.idle[0] && this.playerSprite);
    if (hasFrame) {
      let sf: SpriteFrame | null;
      if (this.moving) {
        const seq = this.running ? set.run : set.walk;
        sf = seq[Math.floor(this.phase) % 4] || set.idle[0];
      } else {
        sf = set.idle[0];
      }
      this.playerSprite!.spriteFrame = sf;
      this.playerSprite!.node.getComponent(UITransform)!
        .setContentSize(FRAME_W * PLAYER_SCALE, FRAME_H * PLAYER_SCALE);
      if (this.pg) this.pg.clear();
      this.player.setScale(1, 1, 1);
    } else {
      this.drawPlayer();
    }
  }

  private drawPlayer() {
    const g = this.pg;
    g.clear();
    const H = 64, u = H / 24;
    const swing = this.moving ? Math.sin(this.phase) : 0;
    const legS = swing * 2.2 * u;
    const mirror = this.facing === 'left';
    // 影子
    g.fillColor = new Color(20, 30, 40, 80);
    g.ellipse(0, -1.5 * u, 6 * u, 2.6 * u); g.fill();
    // 腿（向上为正，y 0..6）
    g.fillColor = new Color(43, 52, 80);
    g.rect(-3 * u - 1, 0, 3 * u, 6 * u - legS); g.fill();
    g.rect(0.4 * u, 0, 3 * u, 6 * u + legS); g.fill();
    // 鞋
    g.fillColor = new Color(26, 33, 56);
    g.rect(-3.4 * u - 1, 0, 3.6 * u, 1.7 * u); g.fill();
    g.rect(0.4 * u, 0, 3.6 * u, 1.7 * u); g.fill();
    // 身体
    g.fillColor = new Color(217, 79, 58);
    g.rect(-3.6 * u, 7 * u, 7.2 * u, 8.4 * u); g.fill();
    g.fillColor = new Color(184, 60, 43);
    g.rect(-3.6 * u, 7 * u, 7.2 * u, 1.4 * u); g.fill();
    if (this.facing !== 'up') { g.fillColor = new Color(242, 199, 155); g.rect(-1.2 * u, 7 * u, 2.4 * u, 8 * u); g.fill(); }
    // 手臂
    const armS = swing * 1.6 * u;
    g.fillColor = new Color(200, 67, 47);
    g.rect(-4.7 * u, 7.6 * u + armS, 1.8 * u, 7 * u); g.fill();
    g.rect(3 * u, 7.6 * u - armS, 1.8 * u, 7 * u); g.fill();
    // 头
    g.fillColor = new Color(242, 199, 155);
    g.rect(-2.8 * u, 15 * u, 5.6 * u, 6 * u); g.fill();
    // 头发
    g.fillColor = new Color(58, 42, 28);
    g.rect(-3 * u, 19.6 * u, 6 * u, 2.4 * u); g.fill();
    g.rect(-3 * u, 18 * u, 1 * u, 1.6 * u); g.fill();
    g.rect(2 * u, 18 * u, 1 * u, 1.6 * u); g.fill();
    if (this.facing !== 'up') {
      g.fillColor = new Color(39, 32, 50);
      if (this.facing === 'right' || mirror) {
        g.rect(mirror ? -2.3 * u : 1.2 * u, 17.4 * u, 1.1 * u, 1.1 * u); g.fill();
      } else {
        g.rect(-1.8 * u, 17.4 * u, 1.1 * u, 1.1 * u); g.fill();
        g.rect(0.8 * u, 17.4 * u, 1.1 * u, 1.1 * u); g.fill();
      }
    }
    this.player.setScale(mirror ? -1 : 1, 1, 1);
  }

  // ---------- 深度排序（地面→路径→建筑/角色） ----------
  private sortSprites() {
    const arr = this.buildingNodes
      .filter(x => x.node.active)
      .map(x => ({ depth: x.b.depth, node: x.node }));
    // TEACH-1 深度拆分部件
    for (const p of this.partNodes) arr.push({ depth: p.depth, node: p.node });
    if (this.player) {
      const gi = imageToGrid(this.playerImg.x, this.playerImg.y);
      arr.push({ depth: gi.gx + gi.gy, node: this.player });
    }
    arr.sort((a, b) => a.depth - b.depth);
    const ordered: Node[] = arr.map(x => x.node);
    const layers = [this.groundNode, this.pathGfx ? this.pathGfx.node : null, ...ordered].filter(Boolean) as Node[];
    // 从最大索引往 0 设置，避免前序插入影响后续位置
    for (let i = layers.length - 1; i >= 0; i--) layers[i].setSiblingIndex(i);
  }

  // ---------- 视图 ----------
  private viewSize(): Vec2 {
    return new Vec2(this.canvas.getComponent(UITransform)!.width, this.canvas.getComponent(UITransform)!.height);
  }
  private centerView() {
    const vs = this.viewSize();
    this.zoom = fitZoom(vs.x, vs.y);
    const [dx0, dy0, dx1, dy1] = META.diamond;
    const dc = imageToLocal((dx0 + dx1) / 2, (dy0 + dy1) / 2);
    this.content.setScale(this.zoom, this.zoom, 1);
    this.content.setPosition(-dc.x * this.zoom, -dc.y * this.zoom, 0);
  }

  // ---------- 输入 ----------
  private bindInput() {
    input.on(Input.EventType.KEY_DOWN, (e: EventKeyboard) => {
      this.keys.add(e.keyCode);
      if (e.keyCode === KeyCode.KEY_W || e.keyCode === KeyCode.ARROW_UP ||
          e.keyCode === KeyCode.KEY_S || e.keyCode === KeyCode.ARROW_DOWN ||
          e.keyCode === KeyCode.KEY_A || e.keyCode === KeyCode.ARROW_LEFT ||
          e.keyCode === KeyCode.KEY_D || e.keyCode === KeyCode.ARROW_RIGHT) e.propagationStopped = true;
    }, this);
    input.on(Input.EventType.KEY_UP, (e: EventKeyboard) => this.keys.delete(e.keyCode), this);

    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.MOUSE_WHEEL, this.onWheel, this);
  }

  private onTouchStart(e: EventTouch) {
    const p = e.getUILocation();
    this.dragging = true; this.moved = false;
    this.lastTouch.set(p.x, p.y); this.touchStart.set(p.x, p.y);
  }
  private onTouchMove(e: EventTouch) {
    if (!this.dragging) return;
    const p = e.getUILocation();
    const dx = p.x - this.lastTouch.x, dy = p.y - this.lastTouch.y;
    if (Math.abs(p.x - this.touchStart.x) + Math.abs(p.y - this.touchStart.y) > 6) {
      this.moved = true; this.follow = false; this.updateFollowBtn();
    }
    const pos = this.content.position;
    this.content.setPosition(pos.x + dx, pos.y + dy, 0);
    this.lastTouch.set(p.x, p.y);
  }
  private onTouchEnd(e: EventTouch) {
    this.dragging = false;
    if (!this.moved) {
      const p = e.getUILocation();
      this.handlePick(p.x, p.y);
    }
  }
  private onWheel(e: EventMouse) {
    const p = e.getUILocation();
    const f = e.getScrollY() > 0 ? 1.12 : 1 / 1.12;
    this.zoomAt(p.x, p.y, f);
  }

  private zoomAt(uiX: number, uiY: number, factor: number) {
    const nz = Math.min(4, Math.max(0.04, this.zoom * factor));
    const vs = this.viewSize();
    const sx = uiX - vs.x / 2, sy = uiY - vs.y / 2;
    const pos = this.content.position;
    const lx = (sx - pos.x) / this.zoom, ly = (sy - pos.y) / this.zoom;
    this.zoom = nz;
    this.content.setScale(nz, nz, 1);
    this.content.setPosition(sx - lx * nz, sy - ly * nz, 0);
  }

  private handlePick(uiX: number, uiY: number) {
    const ut = this.content.getComponent(UITransform)!;
    const local = ut.convertToNodeSpaceAR(new Vec3(uiX, uiY, 0));
    const img = localToImage(local.x, local.y);
    const g = imageToGrid(img.x, img.y);
    for (const b of BUILDINGS) {
      const [gx, gy, gw, gh] = b.grid;
      if (g.gx >= gx && g.gx <= gx + gw && g.gy >= gy && g.gy <= gy + gh) { this.showInfo(b); return; }
    }
    // 点空地：自动寻路
    this.navigateToPoint(g.gx, g.gy);
  }

  // ---------- 自动寻路 ----------
  private setNavTip(text: string, autoHide: boolean) {
    if (!this.navTip) return;
    this.navTip.string = text;
    this.navTip.node.active = true;
    this.navTipUntil = autoHide ? this.elapsed + 1.8 : -1;
  }
  private setNavPath(gridPath: {gx:number;gy:number}[] | null, name: string | null) {
    if (!gridPath || gridPath.length < 2) {
      this.setNavTip(gridPath ? '已在目标附近' : '找不到可达路径', true);
      return;
    }
    this.navPath = gridPath.map(g => {
      const p = gridToImage(g.gx, g.gy);
      return new Vec2(p.x, p.y);
    });
    this.navName = name || '';
    this.navStuck = 0;
    this.follow = true; this.updateFollowBtn();
    this.setNavTip(name ? '正在前往：' + name : '自动寻路中', false);
  }
  private navigateToPoint(gx: number, gy: number) {
    const pg = imageToGrid(this.playerImg.x, this.playerImg.y);
    const t = nearestOpenGrid(gx, gy, pg.gx, pg.gy, BUILDINGS, this.gateOpen);
    if (!t) { this.setNavTip('无法到达那里', true); return; }
    this.setNavPath(findPath(pg, t, BUILDINGS, this.gateOpen), null);
  }
  private navigateToBuilding(b: CampusBuilding) {
    const pg = imageToGrid(this.playerImg.x, this.playerImg.y);
    this.setNavPath(pathToBuilding(b, pg.gx, pg.gy, BUILDINGS, this.gateOpen), b.name);
  }

  private drawPath() {
    const g = this.pathGfx;
    if (!g) return;
    g.clear();
    if (!this.navPath || !this.navPath.length) return;
    const pts = [new Vec2(this.playerImg.x, this.playerImg.y), ...this.navPath];
    const loc = pts.map(p => imageToLocal(p.x, p.y));
    const lw = 4 / Math.max(this.zoom, 0.05);
    g.strokeColor = new Color(91, 155, 255, 200);
    g.lineWidth = lw;
    g.lineJoin = Graphics.LineJoin.ROUND;
    // 虚线：交替短划
    for (let i = 0; i < loc.length - 1; i++) {
      if (i % 2 === 0) {
        g.moveTo(loc[i].x, loc[i].y);
        g.lineTo(loc[i + 1].x, loc[i + 1].y);
      }
    }
    g.stroke();
    const end = loc[loc.length - 1];
    const r = 8 / Math.max(this.zoom, 0.05);
    g.fillColor = new Color(45, 108, 223, 240);
    g.circle(end.x, end.y, r); g.fill();
    g.strokeColor = new Color(255, 255, 255, 230); g.lineWidth = Math.max(1, 2 / Math.max(this.zoom, 0.05));
    g.circle(end.x, end.y, r); g.stroke();
  }

  // ---------- 玩家移动 ----------
  update(dt: number) {
    if (!this.player) return;
    this.elapsed += dt;
    let dx = 0, dy = 0;
    if (this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) dy -= 1;
    if (this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)) dy += 1;
    if (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)) dx -= 1;
    if (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) dx += 1;
    const manual = dx !== 0 || dy !== 0;
    if (manual && this.navPath) { this.navPath = null; this.navName = ''; if (this.navTip) this.navTip.node.active = false; }

    if (manual) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
      this.moving = true;
      this.running = this.runLock;
      const v = (this.runLock ? 520 : 300) * dt;
      let nx = this.playerImg.x + dx * v;
      let ng = imageToGrid(nx, this.playerImg.y);
      if (!isBlocked(ng.gx, ng.gy, BUILDINGS, this.gateOpen)) this.playerImg.x = nx;
      let ny = this.playerImg.y + dy * v;
      ng = imageToGrid(this.playerImg.x, ny);
      if (!isBlocked(ng.gx, ng.gy, BUILDINGS, this.gateOpen)) this.playerImg.y = ny;
      this.phase += dt * (this.runLock ? 13 : 9);
      this.follow = true; this.updateFollowBtn();
    } else if (this.navPath && this.navPath.length) {
      const tgt = this.navPath[0];
      const ddx = tgt.x - this.playerImg.x, ddy = tgt.y - this.playerImg.y;
      const dist = Math.hypot(ddx, ddy);
      const R = 12;
      if (dist < R) {
        this.navPath.shift(); this.navStuck = 0;
        if (!this.navPath.length) {
          this.navPath = null; this.moving = false; this.running = false;
          this.setNavTip(this.navName ? '已到达：' + this.navName : '已到达', true);
          this.navName = '';
        }
      } else {
        this.moving = true;
        this.running = this.runLock;
        const ux = ddx / dist, uy = ddy / dist;
        if (Math.abs(ux) > Math.abs(uy)) this.facing = ux > 0 ? 'right' : 'left';
        else this.facing = uy > 0 ? 'down' : 'up';
        const speed = this.runLock ? 520 : 300;
        const v = Math.min(speed * dt, dist);
        const ox = this.playerImg.x, oy = this.playerImg.y;
        const nx = this.playerImg.x + ux * v, ny = this.playerImg.y + uy * v;
        const gAll = imageToGrid(nx, ny);
        if (!isBlocked(gAll.gx, gAll.gy, BUILDINGS, this.gateOpen)) { this.playerImg.x = nx; this.playerImg.y = ny; }
        else {
          const gx = imageToGrid(nx, this.playerImg.y);
          if (!isBlocked(gx.gx, gx.gy, BUILDINGS, this.gateOpen)) this.playerImg.x = nx;
          const gy = imageToGrid(this.playerImg.x, ny);
          if (!isBlocked(gy.gx, gy.gy, BUILDINGS, this.gateOpen)) this.playerImg.y = ny;
        }
        if (Math.hypot(this.playerImg.x - ox, this.playerImg.y - oy) < v * 0.25) {
          this.navStuck++;
          if (this.navStuck > 10) { this.navPath.shift(); this.navStuck = 0; }
        } else this.navStuck = 0;
        this.phase += dt * (this.runLock ? 13 : 9);
        this.follow = true; this.updateFollowBtn();
      }
    } else {
      this.moving = false;
      this.running = false;
      this.navStuck = 0;
    }

    this.updateGates(dt);
    this.updateDoors(dt);
    const lp = imageToLocal(this.playerImg.x, this.playerImg.y);
    this.player.setPosition(lp.x, lp.y, 0);
    this.updatePlayerFrame();
    this.drawPath();
    this.updateLabels();
    this.updateMinimap();
    this.sortSprites();
    if (this.navTip && this.navTipUntil > 0 && this.elapsed > this.navTipUntil) {
      this.navTip.node.active = false; this.navTipUntil = -1;
    }
    if (this.follow) {
      const vs = this.viewSize();
      this.content.setPosition(-lp.x * this.zoom, -lp.y * this.zoom - 0.12 * vs.y, 0);
    }
  }

  // ---------- HUD ----------
  private btnFollow!: Node;
  private fillRound(node: Node, w: number, h: number, color: Color, r: number): Graphics {
    let g = node.getComponent(Graphics);
    if (!g) g = node.addComponent(Graphics);
    g.clear();
    g.fillColor = color;
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
    return g;
  }
  private buildHUD() {
    const vs = this.viewSize();
    const mk = (text: string, px: number, py: number, cb: () => void): Node => {
      const n = new Node(text);
      n.layer = UI; n.addComponent(UITransform).setContentSize(120, 40);
      this.fillRound(n, 120, 40, new Color(40, 58, 88, 240), 8);
      const lb = new Node('Label'); lb.layer = UI; lb.addComponent(UITransform);
      const l = lb.addComponent(Label); l.string = text; l.fontSize = 20; l.lineHeight = 24;
      l.color = new Color(233, 240, 255);
      lb.setPosition(0, 0, 0);
      n.addChild(lb);
      n.addComponent(Button);
      n.on(Button.EventType.CLICK, cb, this);
      n.setPosition(px, py, 0);
      this.canvas.addChild(n);
      return n;
    };
    this.btnFollow = mk('跟随角色', vs.x / 2 - 220, vs.y / 2 - 40, () => { this.follow = true; this.updateFollowBtn(); });
    mk('重置视角', vs.x / 2 - 90, vs.y / 2 - 40, () => { this.follow = false; this.centerView(); this.updateFollowBtn(); });
    // 跑步开关
    this.btnRun = mk('跑步：关', vs.x / 2 - 350, vs.y / 2 - 40, () => {
      this.runLock = !this.runLock;
      this.btnRun.getComponentInChildren(Label)!.string = '跑步：' + (this.runLock ? '开' : '关');
      this.fillRound(this.btnRun, 120, 40,
        this.runLock ? new Color(45, 108, 223, 255) : new Color(40, 58, 88, 240), 8);
    });

    // 信息面板（默认隐藏，中心锚点）
    const panel = new Node('InfoPanel');
    panel.layer = UI;
    panel.addComponent(UITransform).setContentSize(320, 460);
    this.fillRound(panel, 320, 460, new Color(18, 26, 38, 240), 12);
    panel.setPosition(vs.x / 2 - 176, vs.y / 2 - 250, 0);
    panel.active = false;
    this.canvas.addChild(panel);
    this.panel = panel;
    this.panelUIs = {};
    const addLb = (nm: string, y: number, size: number, color: Color, w = 288): Label => {
      const ln = new Node(nm); ln.layer = UI; ln.addComponent(UITransform).setContentSize(w, 0);
      const l = ln.addComponent(Label); l.fontSize = size; l.lineHeight = size + 6;
      l.color = color; l.overflow = Label.Overflow.RESIZE_HEIGHT;
      l.horizontalAlign = Label.HorizontalAlign.LEFT;
      l.getComponent(UITransform)!.setAnchorPoint(0, 1);
      ln.setPosition(-150, y, 0);
      panel.addChild(ln);
      return l;
    };
    this.panelUIs.no = addLb('No', 210, 16, new Color(150, 190, 255));
    this.panelUIs.name = addLb('Name', 182, 24, new Color(255, 255, 255));
    // 配图区（浅色展台背景 + 建筑 Sprite）
    const photoBg = new Node('PhotoBg'); photoBg.layer = UI;
    photoBg.addComponent(UITransform).setContentSize(288, 148);
    const pbg = photoBg.addComponent(Graphics);
    pbg.fillColor = new Color(224, 234, 244, 255);
    pbg.roundRect(-144, -74, 288, 148, 10); pbg.fill();
    pbg.strokeColor = new Color(120, 170, 255, 60); pbg.lineWidth = 1; pbg.stroke();
    photoBg.setPosition(0, 90, 0);
    panel.addChild(photoBg);
    const photoNode = new Node('Photo'); photoNode.layer = UI;
    photoNode.addComponent(UITransform).setContentSize(280, 142);
    const photoSprite = photoNode.addComponent(Sprite);
    photoSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    photoNode.setPosition(0, 90, 0);
    panel.addChild(photoNode);
    this.photoSprite = photoSprite;
    this.panelUIs.tag = addLb('Tag', -6, 15, new Color(120, 180, 255));
    this.panelUIs.desc = addLb('Desc', -36, 16, new Color(205, 217, 238));
    // 关闭
    const close = new Node('Close'); close.layer = UI;
    close.addComponent(UITransform).setContentSize(40, 40);
    const cl = close.addComponent(Label); cl.string = '×'; cl.fontSize = 28; cl.color = new Color(255, 255, 255);
    close.setPosition(140, 212, 0);
    close.addComponent(Button);
    close.on(Button.EventType.CLICK, () => { this.panel.active = false; }, this);
    panel.addChild(close);
    // 前往这里
    const gotoBtn = new Node('GotoBtn'); gotoBtn.layer = UI;
    gotoBtn.addComponent(UITransform).setContentSize(200, 38);
    this.fillRound(gotoBtn, 200, 38, new Color(45, 108, 223, 255), 8);
    const gln = new Node('L'); gln.layer = UI; gln.addComponent(UITransform);
    const gl = gln.addComponent(Label); gl.string = '前往这里'; gl.fontSize = 18; gl.lineHeight = 22;
    gl.color = new Color(255, 255, 255);
    gotoBtn.addChild(gln);
    gotoBtn.addComponent(Button);
    gotoBtn.on(Button.EventType.CLICK, () => {
      if (this.currentBuilding) this.navigateToBuilding(this.currentBuilding);
    }, this);
    gotoBtn.setPosition(0, -195, 0);
    panel.addChild(gotoBtn);

    // 寻路提示（底部居中）
    const tip = new Node('NavTip'); tip.layer = UI;
    tip.addComponent(UITransform).setContentSize(320, 40);
    const tbg = tip.addComponent(Graphics);
    tbg.fillColor = new Color(18, 26, 38, 235);
    tbg.roundRect(-160, -20, 320, 40, 20); tbg.fill();
    tbg.strokeColor = new Color(120, 170, 255, 80); tbg.lineWidth = 1; tbg.stroke();
    const tln = new Node('T'); tln.layer = UI; tln.addComponent(UITransform).setContentSize(320, 40);
    const tl = tln.addComponent(Label); tl.fontSize = 18; tl.lineHeight = 22;
    tl.color = new Color(220, 232, 255);
    tl.horizontalAlign = Label.HorizontalAlign.CENTER;
    tl.verticalAlign = Label.VerticalAlign.CENTER;
    tip.addChild(tln);
    tip.setPosition(0, -vs.y / 2 + 56, 0);
    tip.active = false;
    this.canvas.addChild(tip);
    this.navTip = tl;
  }
  private panelUIs: { no?: Label; name?: Label; tag?: Label; desc?: Label } = {};
  private updateFollowBtn() {
    if (!this.btnFollow) return;
    this.fillRound(this.btnFollow, 120, 40,
      this.follow ? new Color(45, 108, 223, 255) : new Color(40, 58, 88, 240), 8);
  }
  private showInfo(b: CampusBuilding) {
    this.currentBuilding = b;
    this.panel.active = true;
    this.panelUIs.no!.string = '点位 ' + String(b.no).padStart(2, '0') + ' · ' + b.id;
    this.panelUIs.name!.string = b.name;
    this.panelUIs.tag!.string = GROUP_CN[b.group] || b.group;
    this.panelUIs.desc!.string = b.desc || '';
    // 配图：复用地图上已加载的同栋 SpriteFrame，contain 到 280×142
    const entry = this.buildingNodes.find(x => x.b === b);
    const sf = entry ? entry.node.getComponent(Sprite)!.spriteFrame : null;
    if (this.photoSprite && sf) {
      this.photoSprite.spriteFrame = sf;
      const sc = Math.min(280 / sf.width, 142 / sf.height);
      this.photoSprite.node.getComponent(UITransform)!.setContentSize(sf.width * sc, sf.height * sc);
    }
  }
}

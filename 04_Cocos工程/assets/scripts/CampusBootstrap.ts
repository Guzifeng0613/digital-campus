import {
  _decorator, Component, Node, director, Canvas, Camera, UITransform, Sprite, SpriteFrame,
  Graphics, Label, Button, resources, Layers, Color, Vec3, Vec2, Rect, Texture2D,
  input, Input, EventTouch, EventKeyboard, KeyCode, EventMouse, screen
} from 'cc';
import { META, BUILDINGS, GROUP_CN, CampusBuilding } from './CampusData';
import {
  GROUND_W, GROUND_H, gridToLocal, imageToLocal, localToImage, imageToGrid,
  isBlocked, fitZoom, diamondCenter
} from './IsoMath';

const { ccclass } = _decorator;
const UI = Layers.Enum.UI_2D;

/** 唯一入口：挂到场景任意节点即可（无 Canvas 时会自动创建）。运行时自动生成整张等距地图。 */
@ccclass('CampusBootstrap')
export class CampusBootstrap extends Component {
  private canvas!: Node;
  private camera!: Camera;
  private content!: Node;
  private player!: Node;
  private pg!: Graphics;                       // 代码绘制小人（帧加载失败时的兜底）
  private playerSprite: Sprite | null = null; // 像素角色序列帧
  private playerFrames: Record<string, (SpriteFrame | null)[]> = {};
  private panel!: Node;

  private zoom = 0.1;
  private follow = false;
  private readonly keys = new Set<number>();
  private playerImg = new Vec2();          // 角色脚点（图像世界坐标）
  private phase = 0;
  private facing = 'down';
  private moving = false;
  private buildingNodes: { b: CampusBuilding; node: Node }[] = [];

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
    const gNode = this.makeSpriteNode(gsf, 'Ground');
    gNode.getComponent(UITransform)!.setContentSize(GROUND_W, GROUND_H);
    gNode.setPosition(0, 0, 0);
    gNode.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
    this.content.addChild(gNode);

    // 建筑（并行加载，单个失败不阻断）
    console.log('[数字校园] 加载 ' + BUILDINGS.length + ' 栋建筑资源…');
    const sfs = await Promise.all(BUILDINGS.map(b => this.loadSF(b.res).catch((err) => {
      console.error('[数字校园] 资源加载失败：' + b.res + '（' + b.name + '）', err);
      return null;
    })));
    BUILDINGS.forEach((b, i) => {
      const src = sfs[i];
      if (!src) return;
      src.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.POINT);
      const [x0, y0, bw, bh] = b.bbox;
      // 裁剪到非透明 bbox
      const sf = new SpriteFrame();
      sf.texture = src.texture;
      sf.rect = new Rect(x0, y0, bw, bh);
      const node = this.makeSpriteNode(sf, b.id);
      const ut = node.getComponent(UITransform)!;
      ut.setContentSize(bw * b.scale, bh * b.scale);
      ut.setAnchorPoint(0, 1);                       // 左上角
      const local = imageToLocal(b.paste[0], b.paste[1]);
      node.setPosition(local.x, local.y, 0);
      node.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
      this.content.addChild(node);
      this.buildingNodes.push({ b, node });
    });
    if (this.buildingNodes.length < BUILDINGS.length) {
      console.warn('[数字校园] 仅加载 ' + this.buildingNodes.length + '/' + BUILDINGS.length +
        ' 栋，请检查 assets/resources/sprites 下图片是否齐全、文件夹名是否为小写 resources');
    }
    this.sortSprites();
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

  // ---------- 角色（像素序列帧，加载失败时回退 Graphics 绘制） ----------
  private async loadPlayerFrames() {
    const dirs = ['down', 'up', 'left', 'right'];
    const tasks: Promise<SpriteFrame | null>[] = [];
    for (const dir of dirs) for (let f = 0; f < 4; f++) {
      tasks.push(this.loadSF('player/player_' + dir + '_' + f).catch(() => null));
    }
    const sfs = await Promise.all(tasks);
    let i = 0;
    for (const dir of dirs) {
      this.playerFrames[dir] = [];
      for (let f = 0; f < 4; f++) {
        const sf = sfs[i];
        if (sf) sf.texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.POINT);
        this.playerFrames[dir].push(sf);
        i++;
      }
    }
    const ok = Object.values(this.playerFrames).filter(arr => arr[0]).length;
    console.log('[数字校园] 角色帧：' + (ok === 4 ? '4 方向 × 4 帧就绪' : ok + '/4 方向，将回退代码绘制'));
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
    ut.setContentSize(64, 80);
    ut.setAnchorPoint(0.5, 0);             // 锚点在鞋底（帧图底部对齐脚点）
    this.playerSprite = this.player.addComponent(Sprite);
    this.playerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.pg = this.player.addComponent(Graphics);  // 帧加载失败时的兜底绘制
    this.content.addChild(this.player);
    this.updatePlayerFrame();
  }

  private updatePlayerFrame() {
    const frames = this.playerFrames[this.facing];
    const hasFrame = !!(frames && frames[0] && this.playerSprite);
    if (hasFrame) {
      const f = this.moving ? (Math.floor(this.phase) % 4) : 0;
      this.playerSprite!.spriteFrame = frames[f]!;
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

  // ---------- 深度排序（地面在最底） ----------
  private sortSprites() {
    const arr = this.buildingNodes.map(x => ({ depth: x.b.depth, node: x.node }));
    if (this.player) {
      const gi = imageToGrid(this.playerImg.x, this.playerImg.y);
      arr.push({ depth: gi.gx + gi.gy, node: this.player });
    }
    arr.sort((a, b) => a.depth - b.depth);
    arr.forEach((it, i) => it.node.setSiblingIndex(i + 1));
  }

  // ---------- 视图 ----------
  private viewSize(): Vec2 {
    return new Vec2(this.canvas.getComponent(UITransform)!.width, this.canvas.getComponent(UITransform)!.height);
  }
  private centerView() {
    const vs = this.viewSize();
    this.zoom = fitZoom(vs.x, vs.y);
    const dc = imageToLocal(diamondCenter().x, diamondCenter().y);
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
  }

  // ---------- 玩家移动 ----------
  update(dt: number) {
    if (!this.player) return;
    let dx = 0, dy = 0;
    if (this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) dy -= 1;
    if (this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)) dy += 1;
    if (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)) dx -= 1;
    if (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) dx += 1;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
      const v = 300 * dt;
      let nx = this.playerImg.x + dx * v;
      let ng = imageToGrid(nx, this.playerImg.y);
      if (!isBlocked(ng.gx, ng.gy, BUILDINGS)) this.playerImg.x = nx;
      let ny = this.playerImg.y + dy * v;
      ng = imageToGrid(this.playerImg.x, ny);
      if (!isBlocked(ng.gx, ng.gy, BUILDINGS)) this.playerImg.y = ny;
      this.phase += dt * 9;
      this.follow = true; this.updateFollowBtn();
    }
    const lp = imageToLocal(this.playerImg.x, this.playerImg.y);
    this.player.setPosition(lp.x, lp.y, 0);
    this.updatePlayerFrame();
    this.sortSprites();
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

    // 信息面板（默认隐藏，中心锚点）
    const panel = new Node('InfoPanel');
    panel.layer = UI;
    panel.addComponent(UITransform).setContentSize(320, 300);
    this.fillRound(panel, 320, 300, new Color(18, 26, 38, 240), 12);
    panel.setPosition(vs.x / 2 - 176, vs.y / 2 - 220, 0);
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
    this.panelUIs.no = addLb('No', 128, 16, new Color(150, 190, 255));
    this.panelUIs.name = addLb('Name', 96, 24, new Color(255, 255, 255));
    this.panelUIs.tag = addLb('Tag', 56, 15, new Color(120, 180, 255));
    this.panelUIs.desc = addLb('Desc', 26, 16, new Color(205, 217, 238));
    // 关闭
    const close = new Node('Close'); close.layer = UI;
    close.addComponent(UITransform).setContentSize(40, 40);
    const cl = close.addComponent(Label); cl.string = '×'; cl.fontSize = 28; cl.color = new Color(255, 255, 255);
    close.setPosition(140, 120, 0);
    close.addComponent(Button);
    close.on(Button.EventType.CLICK, () => { this.panel.active = false; }, this);
    panel.addChild(close);
  }
  private panelUIs: { no?: Label; name?: Label; tag?: Label; desc?: Label } = {};
  private updateFollowBtn() {
    if (!this.btnFollow) return;
    this.fillRound(this.btnFollow, 120, 40,
      this.follow ? new Color(45, 108, 223, 255) : new Color(40, 58, 88, 240), 8);
  }
  private showInfo(b: CampusBuilding) {
    this.panel.active = true;
    this.panelUIs.no!.string = '点位 ' + String(b.no).padStart(2, '0') + ' · ' + b.id;
    this.panelUIs.name!.string = b.name;
    this.panelUIs.tag!.string = GROUP_CN[b.group] || b.group;
    this.panelUIs.desc!.string = b.desc || '';
  }
}

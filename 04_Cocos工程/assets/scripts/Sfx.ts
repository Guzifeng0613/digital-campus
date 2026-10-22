/* 音效（Web Audio 合成，零外部文件；首次交互后启动，兼容移动端）
   与网页端 main.js 的 SFX 模块逻辑一致。 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientOn = false;
  private _muted = false;

  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC() as AudioContext;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private noiseBuf(seconds: number): AudioBuffer {
    const c = this.ctx!;
    const len = Math.floor(c.sampleRate * seconds);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  step(run: boolean) {
    const c = this.ensure(); if (!c || this._muted) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf(0.08);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = run ? 480 : 320;
    const g = c.createGain();
    const vol = run ? 0.22 : 0.14;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start(t); src.stop(t + 0.09);
  }

  door() {
    const c = this.ensure(); if (!c || this._muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.5);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(f); f.connect(g); g.connect(this.master!);
    o.start(t); o.stop(t + 0.65);
  }

  gate() {
    const c = this.ensure(); if (!c || this._muted) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf(0.7);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start(t); src.stop(t + 0.72);
  }

  ui() {
    const c = this.ensure(); if (!c || this._muted) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(660, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.05);
    const g = c.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(this.master!);
    o.start(t); o.stop(t + 0.09);
  }

  arrive() {
    const c = this.ensure(); if (!c || this._muted) return;
    const t = c.currentTime;
    [523, 659, 784].forEach((fr, i) => {
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.value = fr;
      const g = c.createGain();
      const st = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.12, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.25);
      o.connect(g); g.connect(this.master!);
      o.start(st); o.stop(st + 0.27);
    });
  }

  startAmbient() {
    const c = this.ensure(); if (!c || this.ambientOn) return;
    this.ambientOn = true;
    // 微风
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf(2); src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 240;
    const g = c.createGain(); g.gain.value = 0.05;
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start();
    // 鸟鸣
    const bird = () => {
      if (!this.ambientOn) return;
      if (!this._muted && this.ctx) {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(1800 + Math.random() * 600, t);
        o.frequency.exponentialRampToValueAtTime(2600, t + 0.08);
        o.frequency.exponentialRampToValueAtTime(2000, t + 0.16);
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, t);
        bg.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(bg); bg.connect(this.master!);
        o.start(t); o.stop(t + 0.22);
      }
      setTimeout(bird, 3000 + Math.random() * 6000);
    };
    setTimeout(bird, 2000);
  }

  unlock() { this.ensure(); this.startAmbient(); }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.master) this.master.gain.value = this._muted ? 0 : 0.5;
    return this._muted;
  }

  get muted(): boolean { return this._muted; }
}

import { H, W } from './constants';
import { ctx2d, makeCanvas } from './sprite';
import { rng } from './math';

type Resolver = () => void;

/** Global screen effects: fades, flashes, shakes, glitches, vignette and film grain. */
export class Fx {
  fadeAlpha = 0;
  fadeColor = '#000000';
  private fadeFrom = 0;
  private fadeTo = 0;
  private fadeT = 0;
  private fadeDur = 0;
  private fadeDone: Resolver | null = null;

  flashAlpha = 0;
  flashColor = '#ffffff';
  private flashDecay = 0;

  private shakeMag = 0;
  private shakeTime = 0;
  shakeX = 0;
  shakeY = 0;
  shakeEnabled = true;
  reduceFlashes = false;

  /** Continuous glitch level 0..1. */
  glitch = 0;
  private glitchPulse = 0;
  /** Vignette strength 0..1. */
  vignette = 0;
  /** Film grain strength 0..1. */
  grain = 0;
  /** Desaturation 0..1 (applied as an overlay blend). */
  gray = 0;
  /** Tint overlay color & alpha. */
  tint: { color: string; alpha: number } | null = null;
  /** Letterbox bars for cinematics (0..1). */
  bars = 0;
  private barsTarget = 0;

  private scratch = makeCanvas(W, H);
  private sg = ctx2d(this.scratch);
  private chan = [makeCanvas(W, H), makeCanvas(W, H), makeCanvas(W, H)];
  private vignetteCanvas: HTMLCanvasElement | null = null;
  private grainFrames: HTMLCanvasElement[] = [];
  private frame = 0;

  fade(to: number, frames: number, color = '#000000'): Promise<void> {
    this.fadeDone?.();
    this.fadeColor = color;
    this.fadeFrom = this.fadeAlpha;
    this.fadeTo = to;
    this.fadeT = 0;
    this.fadeDur = Math.max(1, frames);
    return new Promise((res) => {
      this.fadeDone = res;
    });
  }

  fadeOut(frames = 30, color = '#000000'): Promise<void> {
    return this.fade(1, frames, color);
  }

  fadeIn(frames = 30): Promise<void> {
    return this.fade(0, frames, this.fadeColor);
  }

  setFade(alpha: number, color = '#000000'): void {
    this.fadeDone?.();
    this.fadeDone = null;
    this.fadeAlpha = alpha;
    this.fadeTo = alpha;
    this.fadeDur = 0;
    this.fadeColor = color;
  }

  flash(color = '#ffffff', frames = 12, alpha = 1): void {
    this.flashColor = color;
    this.flashAlpha = this.reduceFlashes ? Math.min(alpha, 0.25) : alpha;
    this.flashDecay = this.flashAlpha / Math.max(1, frames);
  }

  shake(mag = 3, frames = 15): void {
    if (!this.shakeEnabled) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, frames);
  }

  pulseGlitch(frames = 20): void {
    this.glitchPulse = Math.max(this.glitchPulse, frames);
  }

  setBars(on: boolean): void {
    this.barsTarget = on ? 1 : 0;
  }

  update(): void {
    this.frame++;
    if (this.fadeDur > 0 && this.fadeT < this.fadeDur) {
      this.fadeT++;
      const t = this.fadeT / this.fadeDur;
      this.fadeAlpha = this.fadeFrom + (this.fadeTo - this.fadeFrom) * t;
      if (this.fadeT >= this.fadeDur) {
        this.fadeAlpha = this.fadeTo;
        const done = this.fadeDone;
        this.fadeDone = null;
        done?.();
      }
    }
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - this.flashDecay);
    if (this.shakeTime > 0) {
      this.shakeTime--;
      const m = this.shakeMag * Math.min(1, this.shakeTime / 10);
      this.shakeX = Math.round((Math.random() * 2 - 1) * m);
      this.shakeY = Math.round((Math.random() * 2 - 1) * m);
      if (this.shakeTime === 0) this.shakeMag = 0;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    if (this.glitchPulse > 0) this.glitchPulse--;
    this.bars += (this.barsTarget - this.bars) * 0.12;
    if (Math.abs(this.bars - this.barsTarget) < 0.01) this.bars = this.barsTarget;
  }

  get glitchLevel(): number {
    return Math.min(1, this.glitch + (this.glitchPulse > 0 ? 0.6 : 0));
  }

  private buildVignette(): HTMLCanvasElement {
    const c = makeCanvas(W, H);
    const g = ctx2d(c);
    const grad = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(5,2,10,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    return c;
  }

  private buildGrain(): void {
    for (let f = 0; f < 4; f++) {
      const c = makeCanvas(W, H);
      const g = ctx2d(c);
      const img = g.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const v = Math.random() < 0.5 ? 0 : 255;
        img.data[i * 4] = v;
        img.data[i * 4 + 1] = v;
        img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = Math.random() < 0.25 ? 40 : 0;
      }
      g.putImageData(img, 0, 0);
      this.grainFrames.push(c);
    }
  }

  /** Post-processing applied to the final frame. */
  post(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    const gl = this.glitchLevel;
    if (gl > 0.01) this.applyGlitch(g, canvas, gl);
    if (this.gray > 0) {
      g.save();
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = this.gray;
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (this.tint && this.tint.alpha > 0) {
      g.save();
      g.globalAlpha = this.tint.alpha;
      g.fillStyle = this.tint.color;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (this.grain > 0) {
      if (!this.grainFrames.length) this.buildGrain();
      g.save();
      g.globalAlpha = this.grain;
      g.drawImage(this.grainFrames[Math.floor(this.frame / 3) % 4]!, 0, 0);
      g.restore();
    }
    if (this.vignette > 0) {
      this.vignetteCanvas ??= this.buildVignette();
      g.save();
      g.globalAlpha = this.vignette;
      g.drawImage(this.vignetteCanvas, 0, 0);
      g.restore();
    }
    if (this.bars > 0.01) {
      const bh = Math.round(this.bars * 18);
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, bh);
      g.fillRect(0, H - bh, W, bh);
    }
    if (this.flashAlpha > 0) {
      g.save();
      g.globalAlpha = this.flashAlpha;
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (this.fadeAlpha > 0) {
      g.save();
      g.globalAlpha = Math.min(1, this.fadeAlpha);
      g.fillStyle = this.fadeColor;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  }

  private applyGlitch(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, level: number): void {
    this.sg.clearRect(0, 0, W, H);
    this.sg.drawImage(canvas, 0, 0);
    // Chromatic aberration.
    const off = Math.round(1 + level * 3);
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
    this.chan.forEach((c, i) => {
      const cg = ctx2d(c);
      cg.globalCompositeOperation = 'source-over';
      cg.clearRect(0, 0, W, H);
      cg.drawImage(this.scratch, 0, 0);
      cg.globalCompositeOperation = 'multiply';
      cg.fillStyle = colors[i]!;
      cg.fillRect(0, 0, W, H);
      cg.globalCompositeOperation = 'destination-in';
      cg.drawImage(this.scratch, 0, 0);
    });
    g.save();
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(this.chan[0]!, -off, 0);
    g.drawImage(this.chan[1]!, 0, 0);
    g.drawImage(this.chan[2]!, off, 0);
    g.restore();
    // Horizontal tearing.
    const slices = Math.floor(level * 8);
    if (slices > 0) {
      this.sg.clearRect(0, 0, W, H);
      this.sg.drawImage(canvas, 0, 0);
      for (let i = 0; i < slices; i++) {
        if (!rng.chance(0.5 + level * 0.5)) continue;
        const y = rng.int(0, H - 4);
        const h = rng.int(1, 4 + Math.floor(level * 12));
        const dx = rng.int(-12, 12) * level;
        g.drawImage(this.scratch, 0, y, W, h, Math.round(dx), y, W, h);
      }
    }
  }
}

export const fx = new Fx();

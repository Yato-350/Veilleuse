import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { spr } from '../assets';

/*
 * A jumpscare (2.2): a sprite at the player's face, a scream, black. One image, once — never a strobe. With
 * « Réduire les flashs » the face comes in a short fade (no hard cut, no shake) and goes the same way.
 */
export class JumpScene implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;
  private readonly calm = fx.reduceFlashes;

  constructor(
    private readonly sprite: string,
    /** How many frames the face stays. */
    private readonly hold = 34,
  ) {}

  /** Plays it; resolves on black (the caller fades back in). */
  static play(sprite: string, hold?: number): Promise<void> {
    const s = new JumpScene(sprite, hold);
    game.push(s);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  get length(): number {
    return (this.calm ? 12 : 0) + this.hold + 40;
  }

  update(): void {
    const t = this.t++;
    if (t === 0) {
      audio.sfx('scream', { vol: this.calm ? 0.7 : 1 });
      if (!this.calm) fx.shake(8, 26);
    }
    if (this.t >= this.length) {
      fx.setFade(1);
      game.remove(this);
      const r = this.resolve;
      this.resolve = null;
      r?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const t = this.t;
    const fadeIn = this.calm ? 12 : 0;
    if (t >= fadeIn + this.hold) return;
    const s = spr(this.sprite);
    // Close, too close: the face fills the screen's height and keeps coming a little.
    const k = (H * 1.05) / s.h + Math.min(t, 40) * 0.006;
    const w = s.w * k;
    const h = s.h * k;
    g.imageSmoothingEnabled = false;
    g.globalAlpha = this.calm ? Math.min(1, t / fadeIn) * Math.min(1, (fadeIn + this.hold - t) / 10) : 1;
    g.drawImage(s.img, Math.round((W - w) / 2), Math.round((H - h) / 2 + 6), Math.round(w), Math.round(h));
    g.globalAlpha = 1;
  }
}

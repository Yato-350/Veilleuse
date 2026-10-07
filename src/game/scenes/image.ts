import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { ILLUSTRATIONS } from '../../data/illustrations';
import { dialogue, type SayOptions } from '../ui/dialogue';

/** Full-screen illustration with captions (souvenirs, Mina's drawings, the sketchbook). */
export class ImageScene implements Scene {
  private t = 0;
  private alpha = 0;
  private closing = false;
  private resolve: (() => void) | null = null;
  private captionsDone = false;

  constructor(
    private key: string,
    private captions: string[],
    private opts: { style?: SayOptions['style'] },
  ) {}

  static show(key: string, captions: string[] = [], opts: { style?: SayOptions['style'] } = {}): Promise<void> {
    const s = new ImageScene(key, captions, opts);
    game.push(s);
    return new Promise((resolve) => {
      s.resolve = resolve;
      void s.play();
    });
  }

  private async play(): Promise<void> {
    audio.sfx('whoosh', { pitch: 1.4, vol: 0.4 });
    await game.until(() => this.alpha >= 1);
    if (this.captions.length) await dialogue.say(this.captions, { style: this.opts.style ?? 'paper' });
    else await game.until(() => input.pressed('a') || input.pressed('b'));
    this.captionsDone = true;
    this.closing = true;
    await game.until(() => this.alpha <= 0);
    game.remove(this);
    this.resolve?.();
  }

  update(): void {
    this.t++;
    if (this.closing) this.alpha = Math.max(0, this.alpha - 0.08);
    else this.alpha = Math.min(1, this.alpha + 0.06);
    void this.captionsDone;
  }

  draw(g: CanvasRenderingContext2D): void {
    g.save();
    g.globalAlpha = this.alpha;
    g.fillStyle = '#0b0710';
    g.fillRect(0, 0, W, H);
    const draw = ILLUSTRATIONS[this.key];
    if (draw) draw(g, this.t);
    g.restore();
  }
}

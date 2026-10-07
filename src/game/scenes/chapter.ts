import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';

/** "Chapitre 1 — Le Pays de Coton" title card. */
export class ChapterCard implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;

  constructor(
    private num: string,
    private title: string,
    private subtitle: string,
  ) {}

  static show(num: string, title: string, subtitle = ''): Promise<void> {
    const c = new ChapterCard(num, title, subtitle);
    game.push(c);
    audio.sfx('chime', { pitch: 0.75, vol: 0.6 });
    return new Promise((resolve) => {
      c.resolve = resolve;
    });
  }

  update(): void {
    this.t++;
    const skip = this.t > 60 && (input.pressed('a') || input.pressed('b'));
    if (this.t > 260 || skip) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = this.t;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const a = t < 40 ? t / 40 : t > 220 ? Math.max(0, (260 - t) / 40) : 1;
    g.save();
    g.globalAlpha = a;
    drawText(g, this.num, W / 2, 58, { color: '#8a7f96', align: 'center' });
    g.fillStyle = '#4a3270';
    const lw = Math.min(160, t * 3);
    g.fillRect(Math.round(W / 2 - lw / 2), 74, Math.round(lw), 1);
    drawText(g, this.title, W / 2, 82, { color: '#fffaf2', align: 'center', scale: 2, shadow: '#2a1a48' });
    if (this.subtitle) drawText(g, this.subtitle, W / 2, 114, { color: '#b7aab8', align: 'center' });
    g.restore();
  }
}

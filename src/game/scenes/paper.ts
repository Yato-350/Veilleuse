import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { nextArrow } from '../ui/draw';
import { tr, trLine } from '../../i18n';

/** A full notebook page with handwritten lines (poems, letters, notes). Lines appear one by one. */
export class PaperScene implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;

  constructor(
    private lines: string[],
    private title: string,
  ) {}

  static show(lines: string[], title = ''): Promise<void> {
    const s = new PaperScene(lines, title);
    game.push(s);
    audio.sfx('pop', { pitch: 0.7 });
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  private get shown(): number {
    return Math.min(this.lines.length, Math.floor(this.t / 40));
  }

  update(): void {
    this.t++;
    if (this.t % 40 === 0 && this.shown <= this.lines.length && this.lines[this.shown - 1]) audio.sfx('write', { pitch: 0.9 });
    const done = this.shown >= this.lines.length;
    if (!done && (input.pressed('a') || input.pressed('b') || input.tap)) this.t = this.lines.length * 40;
    else if (done && this.t > this.lines.length * 40 + 20 && (input.pressed('a') || input.tap)) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#2a1e18';
    g.fillRect(0, 0, W, H);
    const x = 50;
    const y = 6;
    const w = W - 100;
    const h = H - 12;
    g.fillStyle = '#4e3528';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#fff6e0';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#d7e6f7';
    for (let ly = y + 20; ly < y + h - 2; ly += 12) g.fillRect(x + 2, ly, w - 4, 1);
    g.fillStyle = '#f08a9a';
    g.fillRect(x + 16, y, 1, h);
    if (this.title) drawText(g, tr(this.title), W / 2, y + 6, { align: 'center', color: '#a8324a' });
    const startY = y + (this.title ? 21 : 9);
    this.lines.slice(0, this.shown).forEach((line, i) => {
      drawText(g, trLine(line), x + 24, startY + i * 12 - 1, { color: '#2b2a5c' });
    });
    if (this.shown >= this.lines.length) nextArrow(g, x + w - 12, y + h - 9, this.t, '#2b2a5c');
  }
}

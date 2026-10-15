import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { tr } from '../../i18n';

/**
 * "Chapitre 1 — Le Pays de Coton" title card. The cards of chapters 1 to 3 are written in crayon on a page of Mina's
 * notebook (lined paper, a red margin, waxy letters): the first three countries are hers. Chapters 4 to 6 draw their
 * own cards, in ballpoint (story/chapter4.ts, chapter5.ts, chapter6.ts).
 */
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

  /** The source key (« Chapitre 1 » to « Chapitre 3 »): Mina's notebook. */
  private get crayon(): boolean {
    return /^Chapitre [1-3]$/.test(this.num);
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = this.t;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const a = t < 40 ? t / 40 : t > 220 ? Math.max(0, (260 - t) / 40) : 1;
    if (this.crayon) {
      this.drawCrayon(g, a);
      return;
    }
    g.save();
    g.globalAlpha = a;
    drawText(g, tr(this.num), W / 2, 58, { color: '#8a7f96', align: 'center' });
    g.fillStyle = '#4a3270';
    const lw = Math.min(160, t * 3);
    g.fillRect(Math.round(W / 2 - lw / 2), 74, Math.round(lw), 1);
    drawText(g, tr(this.title), W / 2, 82, { color: '#fffaf2', align: 'center', scale: 2, shadow: '#2a1a48' });
    if (this.subtitle) drawText(g, tr(this.subtitle), W / 2, 114, { color: '#b7aab8', align: 'center' });
    g.restore();
  }

  /** A page of Mina's notebook, the title in orange crayon (the paper shows through the wax), a wobbly underline. */
  private drawCrayon(g: CanvasRenderingContext2D, a: number): void {
    const t = this.t;
    g.save();
    g.globalAlpha = a;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e6eaf4';
    for (let y = 12; y < H; y += 12) g.fillRect(0, y, W, 1);
    g.fillStyle = '#f0b4b4';
    g.fillRect(44, 0, 1, H);
    g.fillStyle = '#d8ccb4';
    for (let y = 10; y < H; y += 18) g.fillRect(14, y, 6, 6);
    drawText(g, tr(this.num), W / 2, 56, { color: '#9a7bd0', align: 'center' });
    const title = tr(this.title);
    const tw = measure(title) * 2;
    const x0 = Math.round(W / 2 - tw / 2);
    drawText(g, title, x0 + 1, 77, { color: '#f6c08a', scale: 2 });
    drawText(g, title, x0, 76, { color: '#e0834f', scale: 2 });
    // Wax: the grain of the paper shows through the strokes.
    g.fillStyle = PAPER;
    for (let y = 76; y < 92; y++) {
      for (let x = x0; x < x0 + tw + 1; x++) if (((x * 7 + y * 13) ^ (x * y)) % 7 === 0) g.fillRect(x, y, 1, 1);
    }
    // The underline, pressed hard, one stroke from left to right.
    const lw = Math.min(tw + 12, t * 4);
    g.fillStyle = '#e07ba5';
    for (let i = 0; i < lw; i++) g.fillRect(x0 - 6 + i, 99 + Math.round(Math.sin(i * 0.11) * 1.4), 1, 2);
    if (this.subtitle) drawText(g, tr(this.subtitle), W / 2, 114, { color: '#5b7fc4', align: 'center' });
    g.restore();
  }
}

/** Mina's notebook paper (the same as the crossed-out « FIN » of the false dawn). */
const PAPER = '#fff6e0';

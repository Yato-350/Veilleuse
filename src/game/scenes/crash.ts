import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { tr } from '../../i18n';

/** A fake crash / error screen (fourth wall). Waits `frames` then for a key press. */
export class CrashScene implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;

  constructor(
    private lines: string[],
    private minFrames: number,
    private style: 'black' | 'blue',
  ) {}

  static show(lines: string[], minFrames = 180, style: 'black' | 'blue' = 'black'): Promise<void> {
    const s = new CrashScene(lines, minFrames, style);
    audio.stopMusic(0.01);
    audio.setAmbience('none');
    audio.sfx('glitch');
    fx.setFade(0);
    game.push(s);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  update(): void {
    this.t++;
    if (this.t > this.minFrames && (input.pressed('a') || input.pressed('b') || input.tap)) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = this.style === 'blue' ? '#0a1a6a' : '#000000';
    g.fillRect(0, 0, W, H);
    this.lines.forEach((l, i) => {
      if (this.t < 20 + i * 12) return;
      drawText(g, tr(l), 10, 10 + i * 13, { color: i === 0 ? '#ff4a5a' : '#d8d8d8' });
    });
    if (Math.floor(this.t / 30) % 2 === 0) drawText(g, '_', 10, 10 + this.lines.length * 13, { color: '#d8d8d8' });
  }
}

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { rng } from '../../engine/math';
import { flow } from '../flow';
import { G, hasSave, writeMeta } from '../state';
import { heart } from '../ui/draw';

const LINES = [
  'Noa a perdu tout espoir…',
  'Le noir était trop épais.',
  'Ton cœur s\'est éteint comme une veilleuse.',
  'Les mots n\'ont pas suffi, cette fois.',
];

const DODO_LINES = [
  'Tu pourrais simplement… rester endormi.',
  'Chut. Ce n\'est rien. Dors.',
  'Tu vois ? C\'est plus doux, ici, dans le noir.',
  '{player}, tu n\'es pas obligé de le réveiller.',
];

type Choice = 'retry' | 'load' | 'title';

/** Game over: broken heart, Dodo whispers, retry / load / title. */
export class GameOverScene implements Scene {
  private t = 0;
  private idx = 0;
  private resolve: ((c: Choice) => void) | null = null;
  private line = rng.pick(LINES);
  private dodo = rng.pick(DODO_LINES).replace('{player}', G.state.playerName || '…');
  private choices: Array<[string, Choice]>;

  constructor() {
    this.choices = [['Réessayer', 'retry']];
    if (hasSave()) this.choices.push(['Charger', 'load']);
    this.choices.push(['Titre', 'title']);
  }

  static show(_snapshot: string): Promise<Choice> {
    G.meta.deaths++;
    writeMeta(G.meta);
    const s = new GameOverScene();
    fx.setFade(0);
    game.push(s);
    audio.stopMusic(0.3);
    audio.sfx('shatter');
    return new Promise((resolve) => {
      s.resolve = resolve;
    });
  }

  update(): void {
    this.t++;
    if (this.t === 120) audio.playMusic('gameover', { fadeIn: 2 });
    if (this.t < 200) return;
    const n = this.choices.length;
    if (input.repeat('left') || input.repeat('up')) {
      this.idx = (this.idx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('right') || input.repeat('down')) {
      this.idx = (this.idx + 1) % n;
      audio.sfx('move');
    }
    if (input.pressed('a')) {
      audio.sfx('select');
      const c = this.choices[this.idx]![1];
      void this.choose(c);
    }
  }

  private async choose(c: Choice): Promise<void> {
    this.t = -9999;
    await fx.fadeOut(30);
    game.remove(this);
    const r = this.resolve;
    this.resolve = null;
    if (c === 'retry') {
      fx.setFade(0);
      r?.('retry');
      return;
    }
    if (c === 'load') await flow.continueGame();
    else await flow.toTitle();
    r?.(c);
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = Math.max(0, this.t);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const cx = W / 2 - 3;
    const cy = 60;
    if (t < 40) {
      heart(g, cx - 4, cy - 3, '#ff4a5a', 2);
    } else if (t < 80) {
      // Cracked: two halves drifting apart.
      const d = Math.floor((t - 40) / 10);
      g.save();
      g.beginPath();
      g.rect(0, 0, cx + 3, H);
      g.clip();
      heart(g, cx - 4 - d, cy - 3, '#ff4a5a', 2);
      g.restore();
      g.save();
      g.beginPath();
      g.rect(cx + 3, 0, W, H);
      g.clip();
      heart(g, cx - 4 + d, cy - 3, '#ff4a5a', 2);
      g.restore();
    } else {
      // Shards falling
      g.fillStyle = '#ff4a5a';
      for (let i = 0; i < 8; i++) {
        const tt = t - 80;
        const x = cx + Math.cos(i * 0.8) * tt * 0.6 + (i - 4) * 2;
        const y = cy + tt * tt * 0.004 * (1 + (i % 3)) - 4 + i;
        if (y < H) g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
    if (t > 110) {
      const a = Math.min(1, (t - 110) / 40);
      g.globalAlpha = a;
      drawText(g, this.line, W / 2, 96, { color: '#fffaf2', align: 'center' });
      g.globalAlpha = 1;
    }
    if (t > 160) {
      const a = Math.min(1, (t - 160) / 60);
      g.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 0.05));
      drawText(g, this.dodo, W / 2, 116, { color: '#9a7bd0', align: 'center' });
      g.globalAlpha = 1;
    }
    if (t >= 200 || this.t < 0) {
      const total = this.choices.length;
      this.choices.forEach(([label], i) => {
        const x = W / 2 + (i - (total - 1) / 2) * 80;
        const sel = i === this.idx;
        if (sel) heart(g, Math.round(x - 30), 147, '#ff4a5a');
        drawText(g, label, Math.round(x), 144, { color: sel ? '#ffd84a' : '#8a7f96', align: 'center' });
      });
    }
  }
}

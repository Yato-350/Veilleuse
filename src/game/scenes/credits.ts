import { audio } from '../../engine/audio';
import { H, VERSION, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { G } from '../state';

const LINES: Array<[string, string?]> = [
  ['VEILLEUSE', '#ffe991'],
  [''],
  ['Fais de beaux rêves.', '#d4b8f0'],
  [''],
  ['— Histoire, design & code —', '#8a7f96'],
  ['Yasin'],
  [''],
  ['— Inspirations —', '#8a7f96'],
  ['Undertale · OMORI · Doki Doki Literature Club'],
  [''],
  ['— Pixel art, musique & sons —', '#8a7f96'],
  ['Entièrement générés par le code'],
  ['(aucun fichier image ou audio)'],
  [''],
  ['— Remerciements —', '#8a7f96'],
  ['À tous les grands frères et grandes sœurs.'],
  ['À celles et ceux qui gardent une veilleuse allumée.'],
  [''],
  [''],
  ['Si tu traverses un moment difficile,', '#fffaf2'],
  ['tu n\'es pas seul·e. Parles-en.', '#fffaf2'],
  ['France : 3114 (24h/24, gratuit)', '#a7c7f0'],
  ['Belgique : 0800 32 123 · Suisse : 143', '#a7c7f0'],
  ['Canada : 988', '#a7c7f0'],
  [''],
  [''],
  ['Merci d\'avoir joué, {player}.', '#ffe991'],
];

/** Scrolling credits. `ending` = after an ending (no skip for the first seconds). */
export class CreditsScene implements Scene {
  private y = H + 10;
  private t = 0;
  private resolve: (() => void) | null = null;

  constructor(private ending: boolean) {}

  static play(): Promise<void> {
    const c = new CreditsScene(true);
    game.push(c);
    return new Promise((r) => {
      c.resolve = r;
    });
  }

  enter(): void {
    if (this.ending) audio.playMusic('ending', { fadeIn: 2 });
    void fx.fadeIn(30);
  }

  update(): void {
    this.t++;
    const endY = H / 2 - 20 - (LINES.length - 1) * 14;
    const finished = this.y <= endY;
    if (!finished) this.y = Math.max(endY, this.y - (input.down('a') ? 1.4 : 0.35));
    const close = (!this.ending && (input.pressed('b') || input.pressed('menu'))) || (finished && (input.pressed('a') || input.tap));
    if (close) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, W, H);
    LINES.forEach(([text, color], i) => {
      const y = Math.round(this.y + i * 14);
      if (y < -14 || y > H) return;
      const txt = text.replace('{player}', G.state.playerName || G.meta.names[G.meta.names.length - 1] || 'toi');
      drawText(g, txt, W / 2, y, { align: 'center', color: color ?? '#fffaf2', scale: i === 0 ? 2 : 1 });
    });
    drawText(g, `v${VERSION}`, W - 4, H - 11, { color: '#2a2238', align: 'right' });
  }
}

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { rng } from '../../engine/math';
import { EMOTION_COLOR, type Emotion } from '../../engine/palette';
import { POEM_WORDS } from '../../data/words';
import type { WordDef } from '../battle/types';
import { tr } from '../../i18n';

const PICKS = 6;
const COLS = 3;
/** The extra line: frames before its first letter, frames per letter, letters' worth of frames held at the end. */
const GHOST_DELAY = 70;
const GHOST_SPEED = 9;
const GHOST_HOLD = 9;

/** Ink of the line that writes itself (the blue pen of the white world, chapter 5). */
const GHOST_INK = '#3b5bd0';

export interface PoemOptions {
  /**
   * A line nobody picks (Aube blanche, docs/HISTOIRE.md § 5: « j'étais là »): once the six words are written, it
   * writes itself under them, letter by letter, and is returned as a seventh word (emotion 'neutre').
   */
  extra?: string;
}

/** DDLC-style poem: pick words one by one on a notebook page. Resolves with the chosen words. */
export class PoemScene implements Scene {
  private words: WordDef[];
  private chosen: WordDef[] = [];
  private idx = 0;
  private t = 0;
  private resolve: ((w: WordDef[]) => void) | null = null;
  private hop = 0;
  /** Frames since the six words were picked, while the extra line writes itself (-1 = not yet). */
  private ghostT = -1;

  constructor(
    private title: string,
    private opts: PoemOptions = {},
  ) {
    this.words = rng.shuffle([...POEM_WORDS]).slice(0, 15);
  }

  static write(title: string, opts: PoemOptions = {}): Promise<WordDef[]> {
    const s = new PoemScene(title, opts);
    game.push(s);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  /** Letters of the extra line written so far. */
  private ghostShown(): number {
    return this.ghostT < GHOST_DELAY ? 0 : Math.floor((this.ghostT - GHOST_DELAY) / GHOST_SPEED);
  }

  private updateGhost(): void {
    const text = [...tr(this.opts.extra ?? '')];
    const before = this.ghostShown();
    this.ghostT++;
    const now = this.ghostShown();
    if (now > before && now <= text.length && text[now - 1] !== ' ') audio.sfx('write', { pitch: 0.7 });
    if (now >= text.length + GHOST_HOLD) {
      game.remove(this);
      input.consume();
      this.resolve?.([...this.chosen, { text: this.opts.extra!, emotion: 'neutre' }]);
    }
  }

  update(): void {
    this.t++;
    if (this.hop > 0) this.hop--;
    if (this.ghostT >= 0) {
      this.updateGhost();
      return;
    }
    const n = this.words.length;
    if (input.repeat('left')) {
      this.idx = (this.idx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('right')) {
      this.idx = (this.idx + 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('up')) {
      this.idx = (this.idx - COLS + n) % n;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.idx = (this.idx + COLS) % n;
      audio.sfx('move');
    }
    // Direct touch / mouse: hovering highlights a word, a tap writes it at once.
    const hit = hits.pick(this);
    if (typeof hit?.id === 'number') {
      if (hit.id !== this.idx && !hit.tap) audio.sfx('move');
      this.idx = hit.id;
    }
    if (input.pressed('a') || (hit?.tap && typeof hit.id === 'number')) {
      const w = this.words[this.idx]!;
      if (this.chosen.includes(w)) return;
      this.chosen.push(w);
      this.hop = 12;
      audio.sfx('write', { pitch: 0.9 });
      if (this.chosen.length >= PICKS) {
        if (this.opts.extra) {
          this.ghostT = 0;
          return;
        }
        game.remove(this);
        input.consume();
        this.resolve?.(this.chosen);
        return;
      }
      // Move the cursor to the next word not used yet.
      for (let k = 1; k < n; k++) {
        const j = (this.idx + k) % n;
        if (!this.chosen.includes(this.words[j]!)) {
          this.idx = j;
          break;
        }
      }
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const { x, y, w, h } = drawPoemPage(g);
    drawText(g, tr(this.title), W / 2, y + 7, { align: 'center', color: '#2b2a5c' });
    // The extra line counts too: « 7/6 ».
    const ghost = this.ghostT >= 0 ? [...tr(this.opts.extra ?? '')].slice(0, this.ghostShown()).join('') : '';
    drawText(g, `${this.chosen.length + (ghost ? 1 : 0)}/${PICKS}`, x + w - 8, y + 7, { align: 'right', color: ghost ? GHOST_INK : '#8a7f96' });
    this.words.forEach((wd, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const wx = x + 44 + col * 84;
      const wy = y + 30 + row * 18;
      const sel = i === this.idx;
      hits.add(this, i, wx - 14, wy - 5, 84, 18);
      const used = this.chosen.includes(wd);
      const color = used ? '#c8bfa8' : sel ? emoColor(wd.emotion) : '#2b2a5c';
      const dy = sel && this.hop > 0 ? -Math.round(Math.sin((this.hop / 12) * Math.PI) * 3) : 0;
      if (sel) {
        g.fillStyle = '#f5c04f';
        g.fillRect(wx - 12, wy + 4 + dy, 7, 3);
        g.fillStyle = '#2b2a5c';
        g.fillRect(wx - 5, wy + 5 + dy, 1, 1);
      }
      drawText(g, tr(wd.text), wx, wy + dy, { color });
    });
    // Chosen words preview along the bottom
    const preview = this.chosen.map((c) => tr(c.text)).join(', ');
    drawText(g, preview, W / 2, y + h - 14, { align: 'center', color: '#6e4a3a' });
    // The line nobody picked, in blue pen, just above.
    if (ghost) drawText(g, ghost, W / 2, y + h - 30, { align: 'center', color: GHOST_INK });
  }
}

/** The poem's page: the dark desk, a sheet of lined paper, its red margin. Returns the sheet's rectangle. */
export const POEM_PAGE = { x: 30, y: 10, w: W - 60, h: H - 20 };
export function drawPoemPage(g: CanvasRenderingContext2D, desk = '#2a1e18'): typeof POEM_PAGE {
  const { x, y, w, h } = POEM_PAGE;
  g.fillStyle = desk;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff6e0';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#d7e6f7';
  for (let ly = y + 26; ly < y + h - 4; ly += 18) g.fillRect(x + 2, ly, w - 4, 1);
  g.fillStyle = '#f08a9a';
  g.fillRect(x + 22, y, 1, h);
  return POEM_PAGE;
}

function emoColor(e: Emotion): string {
  return e === 'neutre' ? '#c46a2e' : EMOTION_COLOR[e];
}

/** Builds the final poem text from chosen words. */
export function composePoem(words: WordDef[]): string[] {
  const count = (e: Emotion) => words.filter((w) => w.emotion === e).length;
  const ending =
    count('joie') > count('tristesse')
      ? ['Je laisse la lumière allumée.', 'Pour toi. Pour moi.']
      : count('tristesse') > count('joie')
        ? ['Tu me manques.', 'Je vais apprendre à porter ça.']
        : ['Je n\'ai plus peur du noir.', 'Enfin, un peu moins.'];
  return ['Pour Mina.', '', ...words.map((w, i) => `${w.text}${i === words.length - 1 ? '.' : ','}`), '', ...ending, '— Noa'];
}

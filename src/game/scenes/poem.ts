import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { rng } from '../../engine/math';
import { EMOTION_COLOR, type Emotion } from '../../engine/palette';
import { POEM_WORDS } from '../../data/words';
import type { WordDef } from '../battle/types';

const PICKS = 6;
const COLS = 3;

/** DDLC-style poem: pick words one by one on a notebook page. Resolves with the chosen words. */
export class PoemScene implements Scene {
  private words: WordDef[];
  private chosen: WordDef[] = [];
  private idx = 0;
  private t = 0;
  private resolve: ((w: WordDef[]) => void) | null = null;
  private hop = 0;

  constructor(private title: string) {
    this.words = rng.shuffle([...POEM_WORDS]).slice(0, 15);
  }

  static write(title: string): Promise<WordDef[]> {
    const s = new PoemScene(title);
    game.push(s);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  update(): void {
    this.t++;
    if (this.hop > 0) this.hop--;
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
    g.fillStyle = '#2a1e18';
    g.fillRect(0, 0, W, H);
    const x = 30;
    const y = 10;
    const w = W - 60;
    const h = H - 20;
    g.fillStyle = '#fff6e0';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#d7e6f7';
    for (let ly = y + 26; ly < y + h - 4; ly += 18) g.fillRect(x + 2, ly, w - 4, 1);
    g.fillStyle = '#f08a9a';
    g.fillRect(x + 22, y, 1, h);
    drawText(g, this.title, W / 2, y + 7, { align: 'center', color: '#2b2a5c' });
    drawText(g, `${this.chosen.length}/${PICKS}`, x + w - 8, y + 7, { align: 'right', color: '#8a7f96' });
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
      drawText(g, wd.text, wx, wy + dy, { color });
    });
    // Chosen words preview along the bottom
    const preview = this.chosen.map((c) => c.text).join(', ');
    drawText(g, preview, W / 2, y + h - 14, { align: 'center', color: '#6e4a3a' });
  }
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

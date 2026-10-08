import { audio, VOICES } from '../../engine/audio';
import { drawChar, drawText, LINE_HEIGHT, measure } from '../../engine/font';
import { H, W } from '../../engine/constants';
import { game } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { drawSprite } from '../../engine/sprite';
import { SPEAKERS, type Speaker } from '../../data/speakers';
import { hasSpr, spr } from '../assets';
import { G, TEXT_SPEEDS } from '../state';
import { box, heart, nextArrow, type BoxStyle } from './draw';
import { layoutRich, parseRich, type RichChar } from './richtext';

export interface SayOptions {
  /** Speaker id, optionally with expression: 'mina:happy'. */
  who?: string;
  style?: BoxStyle;
  pos?: 'bottom' | 'top' | 'center';
  /** Auto-advance after N frames once fully revealed (cutscenes). */
  auto?: number;
  /** Disallow skipping with B. */
  noSkip?: boolean;
  /** Override text color. */
  color?: string;
  /** Override voice. */
  voice?: string;
  /** Text speed multiplier. */
  speed?: number;
  /** Center text (narration). */
  center?: boolean;
}

const MAX_LINES = 3;

interface Page {
  lines: RichChar[][];
  total: number;
}

const GLITCH_CHARS = '#%&@$*?!<>/\\█▓░ΞΔ§¤';

/** Global dialogue box. Scripts call `await dialogue.say(...)`. */
export class Dialogue {
  open = false;
  private pages: Page[] = [];
  private pageIdx = 0;
  private shown = 0;
  private wait = 0;
  private opts: SayOptions = {};
  private speaker: Speaker = SPEAKERS.narrator!;
  private portrait: string | null = null;
  private resolve: (() => void) | null = null;
  private t = 0;
  private autoT = 0;
  private openFrame = 0;
  private openAnim = 0;
  // Choice state
  private choices: string[] | null = null;
  private choiceIdx = 0;
  private choiceCancel = -1;
  /** Touch: the highlighted choice was picked by a tap, so tapping it again confirms (story choices need 2 taps). */
  private choiceArmed = false;
  private pendingChoices: { choices: string[]; cancel: number } | null = null;
  private lastChoice = 0;
  private blipCount = 0;

  get busy(): boolean {
    return this.open || this.choices !== null;
  }

  private get textX(): number {
    return this.portrait ? 50 : 14;
  }

  private get textW(): number {
    return W - 12 - this.textX - 4;
  }

  private vars(): Record<string, string> {
    const now = new Date();
    return {
      player: G.state.playerName || '…',
      PLAYER: (G.state.playerName || '…').toUpperCase(),
      time: `${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`,
      hour: String(now.getHours()),
    };
  }

  private buildPages(text: string): Page[] {
    const chars = parseRich(text, this.vars());
    const lines = layoutRich(chars, this.opts.center ? W - 40 : this.textW);
    const pages: Page[] = [];
    for (let i = 0; i < lines.length; i += MAX_LINES) {
      const pl = lines.slice(i, i + MAX_LINES);
      pages.push({ lines: pl, total: pl.reduce((a, l) => a + l.length, 0) });
    }
    return pages;
  }

  /** Shows one or more text boxes and resolves when the player closes the last one. */
  async say(text: string | string[], opts: SayOptions = {}): Promise<void> {
    const list = Array.isArray(text) ? text : [text];
    for (const t of list) await this.sayOne(t, opts);
  }

  private sayOne(text: string, opts: SayOptions): Promise<void> {
    this.opts = opts;
    const [who, expr] = (opts.who ?? 'narrator').split(':') as [string, string | undefined];
    this.speaker = SPEAKERS[who] ?? { name: who, voice: 'default' };
    const pKey = this.speaker.portrait ? `face_${this.speaker.portrait}_${expr ?? 'neutral'}` : null;
    this.portrait = pKey && hasSpr(pKey) ? pKey : null;
    this.pages = this.buildPages(text);
    this.pageIdx = 0;
    this.shown = 0;
    this.wait = 0;
    this.autoT = 0;
    if (!this.open) this.openAnim = 0;
    this.open = true;
    this.openFrame = game.frame;
    input.consume();
    return new Promise((res) => {
      this.resolve = res;
    });
  }

  /** Shows a question with choices. Resolves with the chosen index (or `cancelIndex` on B, if >= 0). */
  async ask(text: string, choices: string[], opts: SayOptions & { cancelIndex?: number } = {}): Promise<number> {
    this.pendingChoices = { choices, cancel: opts.cancelIndex ?? -1 };
    await this.sayOne(text, { ...opts, auto: 0 });
    return this.lastChoice;
  }

  private get page(): Page | undefined {
    return this.pages[this.pageIdx];
  }

  private get fullyShown(): boolean {
    const p = this.page;
    return !p || this.shown >= p.total;
  }

  close(): void {
    this.open = false;
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  private charAt(i: number): RichChar | undefined {
    const p = this.page;
    if (!p) return undefined;
    let n = i;
    for (const line of p.lines) {
      if (n < line.length) return line[n];
      n -= line.length;
    }
    return undefined;
  }

  update(): void {
    this.t++;
    if (this.openAnim < 1) this.openAnim = Math.min(1, this.openAnim + 0.2);
    if (this.choices) {
      this.updateChoices();
      return;
    }
    if (!this.open) return;
    const p = this.page;
    if (!p) {
      this.close();
      return;
    }
    const skipFrame = game.frame === this.openFrame;
    if (!this.fullyShown) {
      if (this.wait > 0) {
        this.wait--;
      } else {
        const base = TEXT_SPEEDS[G.settings.textSpeed]! * (this.opts.speed ?? 1);
        let budget = base * (this.charAt(Math.floor(this.shown))?.speed ?? 1);
        while (budget > 0 && !this.fullyShown) {
          const before = Math.floor(this.shown);
          const step = Math.min(budget, 1);
          this.shown += step;
          budget -= step;
          const after = Math.floor(this.shown);
          if (after > before) {
            const rc = this.charAt(after - 1);
            if (rc) {
              if (rc.ch && rc.ch !== ' ' && !/[.,!?…;:]/.test(rc.ch)) {
                if (this.blipCount++ % 2 === 0) {
                  const v = VOICES[this.opts.voice ?? this.speaker.voice] ?? VOICES.default!;
                  audio.voice(v);
                }
              }
              if (rc.pause > 0 && G.settings.textSpeed < 3) {
                this.wait = rc.pause;
                break;
              }
            }
          }
        }
      }
      if (!skipFrame && !this.opts.noSkip && (input.pressed('a') || input.pressed('b') || input.tap)) {
        this.shown = p.total;
        this.wait = 0;
      }
      return;
    }
    // Fully shown.
    if (this.pendingChoices && this.pageIdx >= this.pages.length - 1) {
      this.choices = this.pendingChoices.choices;
      this.choiceCancel = this.pendingChoices.cancel;
      this.choiceIdx = 0;
      this.choiceArmed = false;
      this.pendingChoices = null;
      return;
    }
    if (this.opts.auto) {
      this.autoT++;
      if (this.autoT >= this.opts.auto) this.advance();
      return;
    }
    if (!skipFrame && (input.pressed('a') || input.tap)) this.advance();
  }

  private advance(): void {
    this.autoT = 0;
    if (this.pageIdx < this.pages.length - 1) {
      this.pageIdx++;
      this.shown = 0;
      this.wait = 0;
      audio.sfx('blip', { pitch: 0.8, vol: 0.4 });
    } else {
      this.close();
    }
  }

  private updateChoices(): void {
    const n = this.choices!.length;
    // Direct touch / mouse: hover or a first tap highlights a choice, tapping the highlighted one confirms it.
    const hit = hits.pick(this, 250);
    if (hit && typeof hit.id === 'number') {
      const i = hit.id;
      if (hit.tap && i === this.choiceIdx && this.choiceArmed) {
        audio.sfx('select');
        this.pickChoice(i);
        return;
      }
      if (i !== this.choiceIdx) audio.sfx('move');
      this.choiceIdx = i;
      this.choiceArmed = true;
    }
    if (input.repeat('up') || input.repeat('left')) {
      this.choiceIdx = (this.choiceIdx + n - 1) % n;
      this.choiceArmed = false;
      audio.sfx('move');
    }
    if (input.repeat('down') || input.repeat('right')) {
      this.choiceIdx = (this.choiceIdx + 1) % n;
      this.choiceArmed = false;
      audio.sfx('move');
    }
    if (input.pressed('a')) {
      audio.sfx('select');
      this.pickChoice(this.choiceIdx);
    } else if (input.pressed('b') && this.choiceCancel >= 0) {
      audio.sfx('cancel');
      this.pickChoice(this.choiceCancel);
    }
  }

  private pickChoice(i: number): void {
    this.lastChoice = i;
    this.choices = null;
    input.consume();
    this.close();
  }

  private boxRect(): { x: number; y: number; w: number; h: number } {
    const h = 50;
    const pos = this.opts.pos ?? 'bottom';
    const y = pos === 'top' ? 6 : pos === 'center' ? Math.floor((H - h) / 2) : H - h - 6;
    return { x: 6, y, w: W - 12, h };
  }

  draw(g: CanvasRenderingContext2D): void {
    if (!this.open) return;
    const style = this.opts.style ?? (G.state.flags.world === 'real' ? 'real' : 'dream');
    const r = this.boxRect();
    const anim = this.openAnim;
    const hh = Math.round(r.h * anim);
    box(g, r.x, r.y + Math.round((r.h - hh) / 2), r.w, hh, style);
    if (anim >= 1) this.drawContent(g, r, style);
    if (this.choices) this.drawChoices(g, r, style);
  }

  private drawContent(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, style: BoxStyle): void {
    // Name tag
    if (this.speaker.name && style !== 'none') {
      const name = this.speaker.name;
      const nw = measure(name) + 10;
      const ny = r.y - 11;
      box(g, r.x + 4, ny, nw, 13, style);
      drawText(g, name, r.x + 9, ny, { color: this.speaker.color ?? '#fffaf2' });
    }
    if (this.portrait) {
      const p = spr(this.portrait);
      g.fillStyle = style === 'paper' ? '#ecd3a0' : '#0b0710';
      g.fillRect(r.x + 6, r.y + 7, 36, 36);
      drawSprite(g, p, r.x + 24, r.y + 43);
    }
    const p = this.page;
    if (!p) return;
    const baseColor = this.opts.color ?? (style === 'paper' ? '#2b2a5c' : style === 'real' ? '#dfe2f0' : '#fffaf2');
    let count = 0;
    const shown = Math.floor(this.shown);
    const lineH = LINE_HEIGHT;
    const top = r.y + 5 + Math.floor((MAX_LINES - p.lines.length) * (this.opts.center ? lineH / 2 : 0));
    p.lines.forEach((line, li) => {
      let x = this.opts.center ? Math.round(W / 2 - measureLine(line) / 2) : r.x + this.textX - 6;
      const y = top + li * lineH;
      for (let ci = 0; ci < line.length; ci++) {
        if (count >= shown) return;
        count++;
        const rc = line[ci]!;
        if (!rc.ch) continue;
        let dx = 0;
        let dy = 0;
        let ch = rc.ch;
        if (rc.fx === 'wave') dy = Math.round(Math.sin(this.t * 0.15 + ci * 0.6) * 1.5);
        else if (rc.fx === 'shake') {
          dx = Math.round(Math.random() * 2 - 1);
          dy = Math.round(Math.random() * 2 - 1);
        } else if (rc.fx === 'glitch' && Math.random() < 0.15) {
          ch = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]!;
        }
        const color = rc.color ?? baseColor;
        if (style !== 'paper') drawChar(g, ch, x + dx + 1, y + dy + 1, '#0b0710');
        x += drawChar(g, ch, x + dx, y + dy, color);
      }
    });
    if (this.fullyShown && !this.choices && !this.pendingChoices && !this.opts.auto) {
      nextArrow(g, r.x + r.w - 12, r.y + r.h - 9, this.t, style === 'paper' ? '#2b2a5c' : '#fffaf2');
    }
  }

  private drawChoices(g: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, style: BoxStyle): void {
    const choices = this.choices!;
    const w = Math.max(...choices.map((c) => measure(c))) + 26;
    const h = choices.length * 13 + 8;
    const x = r.x + r.w - w - 2;
    const y = (this.opts.pos ?? 'bottom') === 'top' ? r.y + r.h + 4 : r.y - h - 4;
    box(g, x, y, w, h, style === 'none' ? 'dream' : style);
    choices.forEach((c, i) => {
      const cy = y + 4 + i * 13;
      const sel = i === this.choiceIdx;
      hits.add(this, i, x + 2, cy - 2, w - 4, 13);
      if (sel) heart(g, x + 6, cy + 4, '#ff4a5a');
      drawText(g, c, x + 17, cy, { color: sel ? '#ffd84a' : style === 'paper' ? '#2b2a5c' : '#fffaf2' });
    });
  }
}

function measureLine(line: RichChar[]): number {
  return measure(line.map((c) => c.ch).join(''));
}

export const dialogue = new Dialogue();

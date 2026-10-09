import { audio } from '../../engine/audio';
import { H, VERSION, W } from '../../engine/constants';
import { drawText, drawWrapped, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { G } from '../state';
import { box, heart } from '../ui/draw';
import { tr } from '../../i18n';

/** A credits line: French text (translated when drawn; `{player}` is the player's name) and an optional colour. */
export type CreditLine = [string, string?];

/** The real credits. The last line is the signature (see CreditsOptions.signature). */
export const CREDIT_LINES: CreditLine[] = [
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

/** The help card shown after the darker endings (docs/HISTOIRE.md §6.4). */
export const HELP_CARD = 'Si tu as des idées noires, tu peux appeler le 3114 (gratuit, 24 h/24). Tu n\'es pas seul·e.';

export interface CreditsOptions {
  /** Lines to scroll (default: the real credits). */
  lines?: CreditLine[];
  /** Replaces the last line (« Merci d'avoir joué, {player}. »), e.g. « Merci d'avoir joué ! — Dodo ». */
  signature?: string;
  /** Music (default 'ending'; null = silence). */
  music?: string | null;
  /** After the last line, a card with the help line (3114) that waits for A. */
  helpCard?: boolean;
}

const LINE_H = 14;
/** Where a line stops when the scroll is stopped on it (`stopAt`). */
const STOP_Y = Math.round(H / 2 - 12);

/** 'hold': a choice was made on a stopped line; the credits wait for rewind() or resume(). */
type Phase = 'scroll' | 'stopped' | 'hold' | 'rewind' | 'end' | 'help';

/**
 * Scrolling credits. `ending` = after an ending (no skip). v2 scripts can drive them (the fake credits of the false
 * dawn, §3.9):
 *
 *   const c = CreditsScene.open({ lines, signature });
 *   const i = await c.stopAt('Mina ……… introuvable', ['Laisser défiler', 'Regarder']); // music holds, line blinks
 *   if (i === 1) { await c.rewind(); c.close(); }      // scrolls back up, names un-write, music plays backwards
 *   else await c.resume();                              // to the end (and the help card), then the scene leaves
 */
export class CreditsScene implements Scene {
  private y = H + 10;
  private t = 0;
  private resolve: (() => void) | null = null;
  private lines: CreditLine[];
  private phase: Phase = 'scroll';
  /** Scroll target when stopping on a line, and its index. */
  private stopLine = -1;
  private resolveStop: ((i: number) => void) | null = null;
  private choices: string[] = [];
  private choiceIdx = 0;
  private stopT = 0;
  private rewindT = 0;
  private resolveRewind: (() => void) | null = null;
  private helpT = 0;
  /** Run once the scroll has stopped, before the choice appears (e.g. a whisper in a dialogue box). */
  private beforeChoice: (() => Promise<void>) | null = null;
  private introBusy = false;

  constructor(
    private ending: boolean,
    private opts: CreditsOptions = {},
  ) {
    this.lines = [...(opts.lines ?? CREDIT_LINES)];
    if (opts.signature !== undefined && this.lines.length) {
      const last = this.lines[this.lines.length - 1]!;
      this.lines[this.lines.length - 1] = [opts.signature, last[1]];
    }
  }

  /** Plays the credits to the end (after an ending), then leaves. */
  static play(opts: CreditsOptions = {}): Promise<void> {
    return CreditsScene.open(opts).resume();
  }

  /** Pushes the credits and starts scrolling; drive them with stopAt / rewind / resume. */
  static open(opts: CreditsOptions = {}): CreditsScene {
    const c = new CreditsScene(true, opts);
    game.push(c);
    return c;
  }

  enter(): void {
    if (this.ending) audio.playMusic(this.opts.music === undefined ? 'ending' : this.opts.music, { fadeIn: 2 });
    void fx.fadeIn(30);
  }

  private get endY(): number {
    return H / 2 - 20 - (this.lines.length - 1) * LINE_H;
  }

  /**
   * Scrolls until `line` (index or exact French text) reaches the middle of the screen, then stops: the music holds
   * its note, the line blinks, and the player picks one of `choices`. Resolves with the index.
   */
  stopAt(line: number | string, choices: string[], beforeChoice?: () => Promise<void>): Promise<number> {
    this.stopLine = typeof line === 'number' ? line : this.lines.findIndex(([t]) => t === line);
    if (this.stopLine < 0) this.stopLine = Math.floor(this.lines.length / 2);
    this.choices = choices;
    this.choiceIdx = 0;
    this.stopT = 0;
    this.beforeChoice = beforeChoice ?? null;
    return new Promise((r) => {
      this.resolveStop = r;
    });
  }

  /** Changes a line (e.g. one more « introuvable » on the next pass). */
  setLine(i: number, text: string, color?: string): void {
    if (this.lines[i]) this.lines[i] = [text, color ?? this.lines[i]![1]];
  }

  /** Scrolls back to the top: the music plays backwards and the names un-write themselves. */
  rewind(): Promise<void> {
    this.phase = 'rewind';
    this.rewindT = 0;
    audio.hold(false);
    audio.reverse = true;
    return new Promise((r) => {
      this.resolveRewind = r;
    });
  }

  /** Lets the credits roll on to the end (help card if asked), waits for A, then leaves. */
  resume(): Promise<void> {
    audio.hold(false);
    this.phase = 'scroll';
    this.stopLine = -1;
    return new Promise((r) => {
      this.resolve = r;
    });
  }

  /** Removes the scene now (after a rewind). */
  close(): void {
    audio.reverse = false;
    audio.hold(false);
    game.remove(this);
    input.consume();
  }

  update(): void {
    this.t++;
    switch (this.phase) {
      case 'scroll':
        return this.updateScroll();
      case 'stopped':
        return this.updateChoice();
      case 'rewind':
        return this.updateRewind();
      case 'hold':
        return;
      case 'end':
        if (input.pressed('a') || input.tap) {
          input.consume();
          if (this.opts.helpCard) {
            this.phase = 'help';
            this.helpT = 0;
          } else this.finish();
        }
        return;
      case 'help':
        this.helpT++;
        if (this.helpT > 60 && (input.pressed('a') || input.tap)) this.finish();
        return;
    }
  }

  private updateScroll(): void {
    const speed = input.down('a') ? 1.4 : 0.35;
    if (this.stopLine >= 0 && this.resolveStop) {
      // Scrolling toward the line we stop on (never faster than normal: the player must not skip past it).
      const target = STOP_Y - this.stopLine * LINE_H;
      this.y = Math.max(target, this.y - 0.35);
      if (this.y <= target) {
        this.phase = 'stopped';
        this.stopT = 0;
        audio.hold(true);
        const intro = this.beforeChoice;
        this.beforeChoice = null;
        if (intro) {
          this.introBusy = true;
          void intro().then(() => {
            this.introBusy = false;
          });
        }
      }
      return;
    }
    const finished = this.y <= this.endY;
    if (!finished) this.y = Math.max(this.endY, this.y - speed);
    const leave = !this.ending && (input.pressed('b') || input.pressed('menu'));
    if (leave) return this.finish();
    if (finished && this.resolve) {
      // Story credits: wait for A on the last line (handled in 'end').
      this.phase = 'end';
      return;
    }
    if (finished && !this.resolve && (input.pressed('a') || input.tap)) this.finish();
  }

  private updateChoice(): void {
    this.stopT++;
    if (this.stopT < 70 || this.introBusy) return;
    const n = this.choices.length;
    const hit = hits.pick(this);
    if (hit && typeof hit.id === 'number') {
      if (hit.id !== this.choiceIdx) audio.sfx('move');
      this.choiceIdx = hit.id;
    }
    if (n > 1 && (input.repeat('left') || input.repeat('up'))) {
      this.choiceIdx = (this.choiceIdx + n - 1) % n;
      audio.sfx('move');
    } else if (n > 1 && (input.repeat('right') || input.repeat('down'))) {
      this.choiceIdx = (this.choiceIdx + 1) % n;
      audio.sfx('move');
    }
    if (input.pressed('a') || (hit?.tap && typeof hit.id === 'number')) {
      audio.sfx('select');
      input.consume();
      const r = this.resolveStop;
      this.resolveStop = null;
      this.phase = 'hold';
      r?.(this.choiceIdx);
    }
  }

  private updateRewind(): void {
    this.rewindT++;
    // Back up, a little faster than they came; small tears in the picture (unless flashes are reduced).
    this.y = Math.min(H + 10, this.y + 0.9);
    if (!G.settings.reduceFlashes && this.rewindT % 70 === 0) fx.pulseGlitch(6);
    if (this.y >= H + 10 && this.resolveRewind) {
      const r = this.resolveRewind;
      this.resolveRewind = null;
      r();
    }
  }

  private finish(): void {
    audio.reverse = false;
    audio.hold(false);
    game.remove(this);
    input.consume();
    this.resolve?.();
    this.resolve = null;
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, W, H);
    const player = G.state.playerName || G.meta.names[G.meta.names.length - 1] || tr('toi');
    this.lines.forEach(([text, color], i) => {
      const y = Math.round(this.y + i * LINE_H);
      if (y < -LINE_H || y > H) return;
      let txt = tr(text).replace('{player}', player);
      if (this.phase === 'rewind') {
        // The names un-write themselves, the lines nearest the stop first.
        const delay = Math.abs(i - Math.max(0, this.stopLine < 0 ? this.lines.length / 2 : this.stopLine)) * 9;
        const gone = Math.max(0, Math.floor((this.rewindT - 20 - delay) / 6));
        const chars = [...txt];
        txt = chars.slice(0, Math.max(0, chars.length - gone)).join('');
      }
      let alpha = 1;
      // While the credits are stuck, everything else fades a little.
      if ((this.phase === 'stopped' || this.phase === 'hold' || this.phase === 'rewind') && i !== this.stopLine) alpha = Math.max(0.3, 1 - this.stopT / 120);
      if (this.phase === 'stopped' && i === this.stopLine) {
        // The stuck line blinks (a slow pulse when flashes are reduced).
        alpha = G.settings.reduceFlashes ? 0.55 + 0.45 * Math.cos(this.stopT * 0.08) : Math.floor(this.stopT / 22) % 2 ? 0.25 : 1;
      }
      drawText(g, txt, W / 2, y, { align: 'center', color: color ?? '#fffaf2', scale: i === 0 ? 2 : 1, alpha });
    });
    drawText(g, `v${VERSION}`, W - 4, H - 11, { color: '#2a2238', align: 'right' });
    if (this.phase === 'stopped' && this.stopT >= 70 && !this.introBusy) this.drawChoices(g);
    if (this.phase === 'help') this.drawHelp(g);
  }

  private drawChoices(g: CanvasRenderingContext2D): void {
    const labels = this.choices.map((c) => tr(c));
    const gap = 24;
    const widths = labels.map((l) => measure(l) + 14);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
    let x = Math.round((W - total) / 2);
    const y = H - 30;
    // A dark band to the bottom of the screen: the lines still below the stop do not run through the choice.
    g.fillStyle = 'rgba(5,3,10,0.94)';
    g.fillRect(0, y - 6, W, H - y + 6);
    labels.forEach((l, i) => {
      const sel = i === this.choiceIdx;
      hits.add(this, i, x - 2, y - 3, widths[i]! + 4, 16);
      if (sel) heart(g, x + 3, y + 4, '#ff4a5a');
      drawText(g, l, x + 12, y, { color: sel ? '#ffd84a' : '#8a7f96' });
      x += widths[i]! + gap;
    });
  }

  private drawHelp(g: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.helpT / 30);
    g.fillStyle = `rgba(5,3,10,${(0.85 * a).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
    if (a < 1) return;
    const bw = 220;
    const bx = Math.round((W - bw) / 2);
    box(g, bx, 50, bw, 72, 'dream');
    drawWrapped(g, tr(HELP_CARD), bx + 10, 56, bw - 20, { align: 'center', color: '#fffaf2' });
    if (this.helpT > 60) drawText(g, '▶', bx + bw - 12, 111, { color: '#8a7f96' });
  }
}

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure, wrap } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { EMOTION_COLOR, EMOTION_DARK, type Emotion } from '../../engine/palette';
import { drawEmoIcon } from '../battle/emoshape';
import { G } from '../state';
import { heart, nextArrow } from '../ui/draw';

/*
 * Noa's phone: the conversation with « Maman », seen full screen. Scripts drive it step by step
 * (open → add messages → let the player pick a reply in a little notebook → show Maman typing → close).
 * Only the 'choose' and 'wait' steps read input, so dialogue boxes can be shown over the phone meanwhile.
 */

export interface PhoneMessage {
  /** 'them' = Maman (left), 'me' = Noa (right), 'info' = centered grey chip (dates, « 14 messages non lus »). */
  from: 'them' | 'me' | 'info';
  text: string;
  /** Small grey line under a sent message (« Distribué », « Lu »). */
  status?: string;
}

export interface PhoneReply {
  text: string;
  /** Emotion of the reply (colour hint, shape when the accessibility option is on). None = « Ne rien répondre ». */
  emotion?: Emotion;
}

const PHONE = { x: 40, y: 3, w: 120, h: 174 };
const SCREEN = { x: PHONE.x + 6, y: PHONE.y + 12, w: PHONE.w - 12, h: PHONE.h - 26 };
/** Messages area (below the contact header, above the text field). */
const AREA = { x: SCREEN.x, y: SCREEN.y + 22, w: SCREEN.w, h: SCREEN.h - 22 - 16 };
const LINE = 10;
const BUBBLE_W = 84;
const CARD = { x: 166, w: 148 };
const OPT_H = 15;

const COL = {
  body: '#15151d',
  bodyHi: '#2c2c3a',
  screen: '#121624',
  header: '#1a2034',
  them: '#2e3650',
  themText: '#e6e8f2',
  me: '#3f6fcf',
  meText: '#ffffff',
  info: '#7a8098',
  field: '#232a40',
};

type Mode = 'idle' | 'choose' | 'wait';

export class PhoneScene implements Scene {
  transparent = true;
  private t = 0;
  private slide = 0;
  private closing = false;
  private msgs: Array<PhoneMessage & { born: number }> = [];
  private typingOn = false;
  private scroll = 0;
  private mode: Mode = 'idle';
  private replies: PhoneReply[] = [];
  private idx = 0;
  private prompt = '';
  private resolveChoice: ((i: number) => void) | null = null;
  private resolveWait: (() => void) | null = null;
  private resolveClose: (() => void) | null = null;
  /** The screen fades to black (phone put down, face against the desk). */
  private dim = 0;
  private dimTarget = 0;
  /** Slide of the reply notebook (0 hidden … 1 shown). */
  private card = 0;

  constructor(
    private contact: string,
    private clock: string,
    messages: PhoneMessage[],
  ) {
    this.msgs = messages.map((m) => ({ ...m, born: -100 }));
    this.scroll = Math.max(0, this.contentHeight() - AREA.h);
  }

  /** Opens the phone with an existing thread (no animation for these messages). */
  static open(contact: string, clock: string, messages: PhoneMessage[]): PhoneScene {
    const s = new PhoneScene(contact, clock, messages);
    game.push(s);
    audio.sfx('pop', { pitch: 1.3 });
    return s;
  }

  /** Adds a message at the bottom of the thread (with a little pop). */
  add(m: PhoneMessage): void {
    this.typingOn = false;
    this.msgs.push({ ...m, born: this.t });
    if (m.from === 'me') audio.sfx('whoosh', { pitch: 2.2, vol: 0.5 });
    else if (m.from === 'them') audio.sfx('beep', { pitch: 1.4 });
  }

  /** Sets the status line of the last sent message. */
  status(text: string): void {
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      if (this.msgs[i]!.from === 'me') {
        this.msgs[i]!.status = text;
        return;
      }
    }
  }

  /** Shows (or hides) the « Maman is typing… » bubble. */
  typing(on: boolean): void {
    this.typingOn = on;
  }

  /** Darkens the screen (the phone is put down). */
  sleep(): void {
    this.dimTarget = 1;
  }

  /** The player picks a reply in the little notebook next to the phone. Resolves with its index. */
  choose(prompt: string, replies: PhoneReply[]): Promise<number> {
    this.prompt = prompt;
    this.replies = replies;
    this.idx = 0;
    this.mode = 'choose';
    input.consume();
    return new Promise((r) => {
      this.resolveChoice = r;
    });
  }

  /** Waits for A / tap (a small arrow blinks under the phone). */
  waitKey(): Promise<void> {
    this.mode = 'wait';
    input.consume();
    return new Promise((r) => {
      this.resolveWait = r;
    });
  }

  close(): Promise<void> {
    this.closing = true;
    this.mode = 'idle';
    audio.sfx('pop', { pitch: 0.9 });
    return new Promise((r) => {
      this.resolveClose = r;
    });
  }

  // ---------------------------------------------------------------------------

  private bubbleLines(m: PhoneMessage): string[] {
    // French punctuation never starts a line: « ? », « ! », « : » and « » » stick to the previous word.
    const glued = m.text.replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
    return wrap(glued, BUBBLE_W - 8).map((l) => l.replace(/\u00a0/g, ' '));
  }

  private msgHeight(m: PhoneMessage): number {
    if (m.from === 'info') return 12;
    const h = this.bubbleLines(m).length * LINE + 5;
    return h + (m.status ? 10 : 0) + 4;
  }

  private contentHeight(): number {
    let h = 4;
    for (const m of this.msgs) h += this.msgHeight(m);
    if (this.typingOn) h += LINE + 9;
    return h;
  }

  update(): void {
    this.t++;
    if (this.closing) {
      this.slide = Math.max(0, this.slide - 0.09);
      if (this.slide <= 0) {
        game.remove(this);
        input.consume();
        this.resolveClose?.();
      }
      return;
    }
    this.slide = Math.min(1, this.slide + 0.08);
    this.dim += (this.dimTarget - this.dim) * 0.05;
    this.card = this.mode === 'choose' ? Math.min(1, this.card + 0.1) : Math.max(0, this.card - 0.12);
    const target = Math.max(0, this.contentHeight() - AREA.h);
    this.scroll += (target - this.scroll) * 0.2;
    if (Math.abs(target - this.scroll) < 0.5) this.scroll = target;

    if (this.mode === 'choose') {
      const n = this.replies.length;
      if (input.repeat('up')) {
        this.idx = (this.idx + n - 1) % n;
        audio.sfx('move');
      }
      if (input.repeat('down')) {
        this.idx = (this.idx + 1) % n;
        audio.sfx('move');
      }
      if (input.pressed('b') && this.idx !== n - 1) {
        // B points at the last option (« Ne rien répondre ») instead of picking it straight away.
        this.idx = n - 1;
        audio.sfx('move');
      } else if (input.pressed('a') && this.card >= 1) {
        audio.sfx('write', { pitch: 1.1 });
        this.mode = 'idle';
        input.consume();
        this.resolveChoice?.(this.idx);
      }
    } else if (this.mode === 'wait') {
      if ((input.pressed('a') || input.tap) && this.slide >= 1) {
        this.mode = 'idle';
        input.consume();
        this.resolveWait?.();
      }
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const k = easeOut(this.slide);
    g.fillStyle = `rgba(5,6,12,${(0.72 * k).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
    const dy = Math.round((1 - k) * (H + 10));
    g.save();
    g.translate(0, dy);
    this.drawPhone(g);
    g.restore();
    if (this.card > 0 && this.replies.length) this.drawCard(g, easeOut(this.card) * k);
    if (this.mode === 'wait' && this.slide >= 1) nextArrow(g, PHONE.x + PHONE.w / 2 - 2, H - 7, this.t, '#8a8fb0');
  }

  private drawPhone(g: CanvasRenderingContext2D): void {
    const { x, y, w, h } = PHONE;
    // Body with rounded corners
    g.fillStyle = '#05060a';
    g.fillRect(x + 2, y - 1, w - 4, h + 2);
    g.fillRect(x - 1, y + 2, w + 2, h - 4);
    g.fillStyle = COL.body;
    g.fillRect(x + 2, y, w - 4, h);
    g.fillRect(x, y + 2, w, h - 4);
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = COL.bodyHi;
    g.fillRect(x + 3, y + 1, w - 6, 1);
    g.fillRect(x + 1, y + 3, 1, h - 6);
    // Speaker & home bar
    g.fillStyle = '#2a2a38';
    g.fillRect(x + w / 2 - 9, y + 5, 18, 2);
    g.fillRect(x + w / 2 - 12, y + h - 8, 24, 2);
    // Screen
    const s = SCREEN;
    g.fillStyle = COL.screen;
    g.fillRect(s.x, s.y, s.w, s.h);
    // Status bar
    drawText(g, this.clock, s.x + 3, s.y + 0, { color: '#c8cce0' });
    g.fillStyle = '#c8cce0';
    g.fillRect(s.x + s.w - 14, s.y + 4, 10, 5);
    g.fillRect(s.x + s.w - 4, s.y + 5, 1, 3);
    g.fillStyle = COL.screen;
    g.fillRect(s.x + s.w - 13, s.y + 5, 8, 3);
    g.fillStyle = '#e2404c';
    g.fillRect(s.x + s.w - 13, s.y + 5, 2, 3);
    // Contact header
    g.fillStyle = COL.header;
    g.fillRect(s.x, s.y + 10, s.w, 12);
    g.fillStyle = '#c86a8a';
    g.fillRect(s.x + 4, s.y + 12, 8, 8);
    g.fillStyle = COL.header;
    g.fillRect(s.x + 4, s.y + 12, 1, 1);
    g.fillRect(s.x + 11, s.y + 12, 1, 1);
    g.fillRect(s.x + 4, s.y + 19, 1, 1);
    g.fillRect(s.x + 11, s.y + 19, 1, 1);
    drawText(g, this.contact[0] ?? '', s.x + 8, s.y + 9, { color: '#fff3f6', align: 'center' });
    drawText(g, this.contact, s.x + 16, s.y + 9, { color: '#ffffff' });
    g.fillStyle = '#2a3150';
    g.fillRect(s.x, s.y + 22, s.w, 1);
    // Messages (clipped)
    g.save();
    g.beginPath();
    g.rect(AREA.x, AREA.y, AREA.w, AREA.h);
    g.clip();
    let cy = AREA.y + 4 - Math.round(this.scroll);
    for (const m of this.msgs) {
      const mh = this.msgHeight(m);
      const age = this.t - m.born;
      const pop = age < 8 ? Math.round((8 - age) * 0.8) : 0;
      if (cy + mh > AREA.y - 4 && cy < AREA.y + AREA.h + 4) this.drawMessage(g, m, cy + pop, age < 8 ? age / 8 : 1);
      cy += mh;
    }
    if (this.typingOn) {
      const bw = 22;
      g.fillStyle = COL.them;
      roundRect(g, AREA.x + 4, cy, bw, LINE + 4);
      for (let i = 0; i < 3; i++) {
        const up = Math.floor(this.t / 8 + i * 2) % 6 === 0 ? 1 : 0;
        g.fillStyle = '#aab0c8';
        g.fillRect(AREA.x + 9 + i * 5, cy + 6 - up, 2, 2);
      }
    }
    g.restore();
    // Text field
    const fy = s.y + s.h - 14;
    g.fillStyle = COL.field;
    roundRect(g, s.x + 3, fy, s.w - 6, 11);
    const typing = this.mode === 'choose';
    drawText(g, typing ? (Math.floor(this.t / 30) % 2 ? '|' : '') : 'Message…', s.x + 7, fy - 1, { color: '#6a7090' });
    g.fillStyle = typing ? COL.me : '#3a4260';
    g.fillRect(s.x + s.w - 13, fy + 2, 7, 7);
    g.fillStyle = '#ffffff';
    g.fillRect(s.x + s.w - 10, fy + 3, 1, 5);
    g.fillRect(s.x + s.w - 11, fy + 4, 3, 1);
    // Screen off
    if (this.dim > 0.01) {
      g.fillStyle = `rgba(0,0,0,${Math.min(1, this.dim).toFixed(3)})`;
      g.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  private drawMessage(g: CanvasRenderingContext2D, m: PhoneMessage, y: number, alpha: number): void {
    if (m.from === 'info') {
      drawText(g, m.text, AREA.x + AREA.w / 2, y - 1, { color: COL.info, align: 'center', alpha });
      return;
    }
    const lines = this.bubbleLines(m);
    const tw = Math.max(...lines.map((l) => measure(l)));
    const bw = tw + 8;
    const bh = lines.length * LINE + 5;
    const me = m.from === 'me';
    const bx = me ? AREA.x + AREA.w - 4 - bw : AREA.x + 4;
    const prev = g.globalAlpha;
    g.globalAlpha = prev * alpha;
    g.fillStyle = me ? COL.me : COL.them;
    roundRect(g, bx, y, bw, bh);
    // little tail
    g.fillRect(me ? bx + bw - 2 : bx, y + bh - 2, 2, 2);
    g.fillRect(me ? bx + bw : bx - 1, y + bh - 1, 1, 1);
    g.globalAlpha = prev;
    lines.forEach((l, i) => drawText(g, l, bx + 4, y + i * LINE - 1, { color: me ? COL.meText : COL.themText, alpha }));
    if (m.status) drawText(g, m.status, bx + bw, y + bh, { color: COL.info, align: 'right', alpha });
  }

  /** The little notebook page with the possible replies. */
  private drawCard(g: CanvasRenderingContext2D, k: number): void {
    const n = this.replies.length;
    const h = 24 + n * OPT_H + 4;
    const x = CARD.x + Math.round((1 - k) * 160);
    const y = Math.round((H - h) / 2);
    const w = CARD.w;
    g.fillStyle = '#4e3528';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#fff6e0';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#d7e6f7';
    for (let ly = y + 20; ly < y + h - 2; ly += OPT_H) g.fillRect(x + 2, ly, w - 4, 1);
    g.fillStyle = '#f08a9a';
    g.fillRect(x + 14, y, 1, h);
    // spiral holes
    g.fillStyle = '#4e3528';
    for (let sy = y + 6; sy < y + h - 4; sy += 10) g.fillRect(x + 4, sy, 3, 3);
    drawText(g, this.prompt, x + 20, y + 4, { color: '#a8324a' });
    const shapes = G.settings.emotionShapes;
    this.replies.forEach((r, i) => {
      const ry = y + 22 + i * OPT_H;
      const sel = i === this.idx;
      const emo = r.emotion;
      const textColor = !emo ? '#8a7f96' : sel ? (emo === 'neutre' ? '#4a4060' : EMOTION_DARK[emo]) : '#2b2a5c';
      const tx = x + 34;
      if (emo) {
        if (shapes) drawEmoIcon(g, emo, x + 25, ry + 4, emo === 'neutre' ? '#fffaf2' : EMOTION_COLOR[emo], '#2b2a5c');
        else {
          g.fillStyle = '#2b2a5c';
          g.fillRect(x + 25, ry + 4, 5, 5);
          g.fillStyle = emo === 'neutre' ? '#fffaf2' : EMOTION_COLOR[emo];
          g.fillRect(x + 26, ry + 5, 3, 3);
        }
      }
      if (sel) {
        g.fillStyle = '#f5c04f';
        g.fillRect(tx - 2, ry + 9, Math.min(w - tx + x - 2, measure(r.text) + 4), 3);
        heart(g, x + 17, ry + 4, '#e2404c');
      }
      drawText(g, r.text, tx, ry, { color: textColor });
    });
  }
}

function easeOut(v: number): number {
  return 1 - (1 - v) * (1 - v);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

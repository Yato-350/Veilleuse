import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure, wrap } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { EMOTION_COLOR, EMOTION_DARK, type Emotion } from '../../engine/palette';
import { drawEmoIcon } from '../battle/emoshape';
import { G } from '../state';
import { heart, nextArrow } from '../ui/draw';
import { lang, tf, tr } from '../../i18n';

/*
 * Noa's phone: the conversation with « Maman », seen full screen. Scripts drive it step by step
 * (open → add messages → let the player pick a reply in a little notebook → show Maman typing → close).
 * Only the 'choose', 'wait' and 'browse' steps read input, so dialogue boxes can be shown over the phone meanwhile.
 *
 * v2 adds the whole phone (`PhoneScene.home`): a list of contacts (a pinned thread on top, which can be locked),
 * threads with a year of history (date chips, see `dateLabel`), a « Journal d'appels » tab, and an incoming call
 * that cannot be answered (`ring`). The player browses freely; `browse()` resolves on each event the story may
 * want to react to (a thread opened, a locked thread tapped, the call log shown, the phone put down).
 */

export interface PhoneMessage {
  /** 'them' = Maman (left), 'me' = Noa (right), 'info' = centered grey chip (dates, « 14 messages non lus »). */
  from: 'them' | 'me' | 'info';
  text: string;
  /** Small grey line under a sent message (« Distribué », « Lu »). */
  status?: string;
}

/** A conversation of the v2 phone. */
export interface PhoneContact {
  id: string;
  /** Display name (French, translated when drawn), e.g. « Maman », « Mina 🐑 ». */
  name: string;
  /** Avatar colour. */
  color?: string;
  /** Avatar letter or emoji (default: the first letter of the name). */
  avatar?: string;
  messages: PhoneMessage[];
  /** Pinned at the top of the list. */
  pinned?: boolean;
  /** A padlock: opening it is refused and reported to the script (`browse()` → 'locked'). */
  locked?: boolean;
  /** Time or date of the last message, shown in the list (« 23:52 », « Hier », « 8 oct. 2025 »). */
  when?: string;
  /** Unread messages (blue badge). */
  unread?: number;
  /** List preview (default: the last message). */
  preview?: string;
}

/** A line of the call log. */
export interface PhoneCall {
  /** Contact name as displayed (translated when drawn). */
  name: string;
  dir: 'in' | 'out' | 'missed';
  /** « 3:14 » */
  time: string;
  /** « 0:41 » (none for a missed call). */
  duration?: string;
  /** Date group (« Aujourd'hui », « 8 oct. 2025 »…): consecutive calls of the same date share a header. */
  date: string;
}

export type PhoneTab = 'messages' | 'calls';

/** What happened while browsing (see `PhoneScene.browse`). */
export type PhoneEvent =
  | { kind: 'open'; id: string }
  | { kind: 'locked'; id: string }
  | { kind: 'tab'; tab: PhoneTab }
  | { kind: 'call'; index: number }
  | { kind: 'close' };

// Month abbreviations, picked by language in dateLabel (not catalog entries).
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']; // i18n-ignore
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // i18n-ignore

/**
 * Date chip for a message or call `daysAgo` days before `now` (real time: the anniversary is today):
 * « Aujourd'hui », « Hier », then « 8 oct. 2025 » (English: "Oct 8, 2025"). Already final (not translated again).
 */
export function dateLabel(daysAgo: number, now: Date = new Date()): string {
  if (daysAgo <= 0) return tr('Aujourd\'hui');
  if (daysAgo === 1) return tr('Hier');
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return lang() === 'en' ? `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
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

type Mode = 'idle' | 'choose' | 'wait' | 'browse';
type View = 'thread' | 'list' | 'calls';
type Msg = PhoneMessage & { born: number; lines?: string[] };
/** List rows and call rows (pixels). */
const ROW_H = 22;
const CALL_H = 20;
const TABS_H = 13;

export class PhoneScene implements Scene {
  transparent = true;
  private t = 0;
  private slide = 0;
  private closing = false;
  private msgs: Msg[] = [];
  /** v2 home: contacts and their threads, the call log, the current view. */
  private contacts: PhoneContact[] = [];
  private threads = new Map<string, Msg[]>();
  private calls: PhoneCall[] = [];
  private view: View = 'thread';
  private current: PhoneContact | null = null;
  /** The phone has a list to go back to (home mode). */
  private home = false;
  private sel = 0;
  private listScroll = 0;
  /** The player scrolled the thread by hand: stop following the bottom. */
  private manual = false;
  private resolveBrowse: ((e: PhoneEvent) => void) | null = null;
  /** Row shaking after a refused (locked) tap. */
  private refuseT = 0;
  /** Incoming call overlay: who, and frames left. */
  private ringing: { name: string; t: number; left: number; resolve: () => void } | null = null;
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
    this.contact = tr(contact);
    this.clock = tr(clock);
    this.msgs = messages.map((m) => ({ ...trMessage(m), born: -100 }));
    this.scroll = Math.max(0, this.contentHeight() - AREA.h);
  }

  /**
   * v2: opens the whole phone on its contact list (or the call log). Pinned contacts come first. Nothing reads
   * input until the script calls `browse()` (or `choose()` / `waitKey()` on a thread it opened with `showThread`).
   */
  static home(opts: { clock: string; contacts: PhoneContact[]; calls?: PhoneCall[]; tab?: PhoneTab }): PhoneScene {
    const s = new PhoneScene('', opts.clock, []);
    s.home = true;
    s.contacts = [...opts.contacts.filter((c) => c.pinned), ...opts.contacts.filter((c) => !c.pinned)];
    for (const c of s.contacts) s.threads.set(c.id, c.messages.map((m) => ({ ...trMessage(m), born: -100 })));
    s.calls = opts.calls ?? [];
    s.view = opts.tab === 'calls' ? 'calls' : 'list';
    game.push(s);
    audio.sfx('pop', { pitch: 1.3 });
    return s;
  }

  /** The call log is on screen. */
  get isOnCalls(): boolean {
    return this.view === 'calls';
  }

  /** Lets the player browse (list, threads, call log) until something happens. */
  browse(): Promise<PhoneEvent> {
    this.mode = 'browse';
    input.consume();
    return new Promise((r) => {
      this.resolveBrowse = r;
    });
  }

  /** Shows a contact's thread (scrolled to the most recent message). */
  showThread(id: string): void {
    const c = this.contacts.find((x) => x.id === id);
    if (!c) return;
    this.current = c;
    this.contact = tr(c.name);
    this.msgs = this.threads.get(id) ?? [];
    this.view = 'thread';
    this.manual = false;
    this.typingOn = false;
    this.scroll = Math.max(0, this.contentHeight() - AREA.h);
    c.unread = 0;
  }

  showList(): void {
    this.view = 'list';
    this.current = null;
  }

  showCalls(): void {
    this.view = 'calls';
    this.current = null;
    this.sel = Math.min(this.sel, Math.max(0, this.calls.length - 1));
  }

  /** Shows the call log with line `index` selected and scrolled to the top (the story points at one call). */
  focusCall(index: number): void {
    this.showCalls();
    this.sel = Math.max(0, Math.min(index, this.calls.length - 1));
    this.listScroll = Number.MAX_SAFE_INTEGER;
  }

  /** Locks or unlocks a contact (the padlock in the list). */
  setLocked(id: string, locked: boolean): void {
    const c = this.contacts.find((x) => x.id === id);
    if (c) c.locked = locked;
  }

  /** Adds a line to the call log (top). */
  addCall(call: PhoneCall): void {
    this.calls.unshift(call);
  }

  /**
   * An incoming call that cannot be answered: the phone vibrates for `frames`, then it becomes a missed call in the
   * log. (Meta: « Mina 🐑 — appel entrant », docs/HISTOIRE.md §5.)
   */
  ring(name: string, time: string, frames = 300): Promise<void> {
    return new Promise((resolve) => {
      this.ringing = { name: tr(name), t: 0, left: frames, resolve };
      this.addCall({ name, dir: 'missed', time, date: tr('Aujourd\'hui') });
    });
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
    this.manual = false;
    this.msgs.push({ ...trMessage(m), born: this.t });
    if (m.from === 'me') audio.sfx('whoosh', { pitch: 2.2, vol: 0.5 });
    else if (m.from === 'them') audio.sfx('beep', { pitch: 1.4 });
  }

  /** Sets the status line of the last sent message (French, translated here: « Distribué », « Lu »…). */
  status(text: string): void {
    for (let i = this.msgs.length - 1; i >= 0; i--) {
      if (this.msgs[i]!.from === 'me') {
        this.msgs[i]!.status = tr(text);
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
    this.prompt = tr(prompt);
    this.replies = replies.map((r) => ({ ...r, text: tr(r.text) }));
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

  private bubbleLines(m: Msg): string[] {
    if (m.lines) return m.lines;
    // French punctuation never starts a line: « ? », « ! », « : » and « » » stick to the previous word.
    const glued = m.text.replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
    m.lines = wrap(glued, BUBBLE_W - 8).map((l) => l.replace(/\u00a0/g, ' '));
    return m.lines;
  }

  private msgHeight(m: Msg): number {
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
    if (this.refuseT > 0) this.refuseT--;
    this.card = this.mode === 'choose' ? Math.min(1, this.card + 0.1) : Math.max(0, this.card - 0.12);
    if (this.view === 'thread') {
      const target = Math.max(0, this.contentHeight() - AREA.h);
      if (!this.manual) {
        this.scroll += (target - this.scroll) * 0.2;
        if (Math.abs(target - this.scroll) < 0.5) this.scroll = target;
      } else this.scroll = Math.max(0, Math.min(target, this.scroll));
    }
    if (this.ringing) {
      const r = this.ringing;
      r.t++;
      if (r.t % 60 === 1) audio.sfx('buzz', { vol: 0.9 });
      if (r.t >= r.left) {
        this.ringing = null;
        r.resolve();
      }
      return;
    }
    if (this.mode === 'browse') {
      this.updateBrowse();
      return;
    }

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

  private emit(e: PhoneEvent): void {
    this.mode = 'idle';
    input.consume();
    const r = this.resolveBrowse;
    this.resolveBrowse = null;
    r?.(e);
  }

  private switchTab(tab: PhoneTab): void {
    audio.sfx('move');
    this.sel = 0;
    this.listScroll = 0;
    if (tab === 'calls') this.showCalls();
    else this.showList();
    this.emit({ kind: 'tab', tab });
  }

  private updateBrowse(): void {
    if (this.slide < 1) return;
    const hit = hits.pick(this);
    const tapId = hit?.tap ? String(hit.id) : null;
    if (tapId === 'tab:messages' && this.view !== 'list') return this.switchTab('messages');
    if (tapId === 'tab:calls' && this.view !== 'calls') return this.switchTab('calls');
    if (this.view === 'thread') {
      if (input.down('up')) {
        this.manual = true;
        this.scroll -= 3;
      } else if (input.down('down')) {
        this.manual = true;
        this.scroll += 3;
      }
      if (hit && !hit.tap && typeof hit.id === 'string' && hit.id.startsWith('scroll')) {
        this.manual = true;
        this.scroll += hit.id === 'scroll:up' ? -2 : 2;
      }
      if (input.pressed('b') || input.repeat('left') || tapId === 'back') {
        audio.sfx('cancel');
        if (this.home) this.showList();
        else this.emit({ kind: 'close' });
      }
      return;
    }
    const n = this.view === 'list' ? this.contacts.length : this.calls.length;
    if (hit && typeof hit.id === 'number') {
      if (hit.id !== this.sel) audio.sfx('move');
      this.sel = hit.id;
    }
    if (n > 0 && input.repeat('up')) {
      this.sel = (this.sel + n - 1) % n;
      audio.sfx('move');
    } else if (n > 0 && input.repeat('down')) {
      this.sel = (this.sel + 1) % n;
      audio.sfx('move');
    } else if (input.repeat('left') || input.repeat('right')) {
      return this.switchTab(this.view === 'list' ? 'calls' : 'messages');
    }
    const confirm = input.pressed('a') || (!!hit?.tap && typeof hit.id === 'number');
    if (confirm && n > 0) {
      if (this.view === 'calls') {
        audio.sfx('select');
        return this.emit({ kind: 'call', index: this.sel });
      }
      const c = this.contacts[this.sel]!;
      if (c.locked) {
        audio.sfx('cancel');
        this.refuseT = 16;
        return this.emit({ kind: 'locked', id: c.id });
      }
      audio.sfx('select');
      this.showThread(c.id);
      return this.emit({ kind: 'open', id: c.id });
    }
    if (input.pressed('b') || input.pressed('menu') || tapId === 'close') {
      audio.sfx('cancel');
      this.emit({ kind: 'close' });
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
    if (this.mode === 'browse' && this.slide >= 1) {
      // Outside the phone: tap to put it down.
      hits.add(this, 'close', 0, 0, PHONE.x - 2, H);
      hits.add(this, 'close', PHONE.x + PHONE.w + 2, 0, W - PHONE.x - PHONE.w - 2, H);
      const help = this.view === 'thread' ? (this.home ? '↑↓ · B : retour' : '↑↓ · B : poser') : '↑↓ · ←→ · B : poser';
      drawText(g, tr(help), PHONE.x + PHONE.w + 8, H - 14, { color: '#5c6080' });
    }
  }

  private drawPhone(g: CanvasRenderingContext2D): void {
    const { y, w, h } = PHONE;
    const x = PHONE.x + (this.ringing && this.ringing.t % 60 < 40 && G.settings.shake ? (this.t % 4 < 2 ? 1 : -1) : 0);
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
    if (this.view === 'list') this.drawList(g);
    else if (this.view === 'calls') this.drawCalls(g);
    else this.drawThread(g);
    if (this.ringing) this.drawRinging(g);
    // Screen off
    if (this.dim > 0.01) {
      g.fillStyle = `rgba(0,0,0,${Math.min(1, this.dim).toFixed(3)})`;
      g.fillRect(s.x, s.y, s.w, s.h);
    }
  }

  private drawThread(g: CanvasRenderingContext2D): void {
    const s = SCREEN;
    // Contact header
    g.fillStyle = COL.header;
    g.fillRect(s.x, s.y + 10, s.w, 12);
    g.fillStyle = this.current?.color ?? '#c86a8a';
    g.fillRect(s.x + 4, s.y + 12, 8, 8);
    g.fillStyle = COL.header;
    g.fillRect(s.x + 4, s.y + 12, 1, 1);
    g.fillRect(s.x + 11, s.y + 12, 1, 1);
    g.fillRect(s.x + 4, s.y + 19, 1, 1);
    g.fillRect(s.x + 11, s.y + 19, 1, 1);
    const avatar = this.current?.avatar ?? [...this.contact][0] ?? '';
    if (this.current?.color) {
      g.fillStyle = this.current.color;
      g.fillRect(s.x + 5, s.y + 12, 6, 8);
      g.fillRect(s.x + 4, s.y + 13, 8, 6);
    }
    drawText(g, avatar, s.x + 8, s.y + 9, { color: '#fff3f6', align: 'center' });
    drawText(g, this.contact, s.x + 16, s.y + 9, { color: '#ffffff' });
    if (this.home && this.mode === 'browse') {
      // Back arrow (touch: tap it).
      hits.add(this, 'back', s.x + s.w - 16, s.y + 10, 16, 12);
      drawText(g, '←', s.x + s.w - 9, s.y + 9, { color: '#8a8fb0' });
      hits.add(this, 'scroll:up', AREA.x, AREA.y, AREA.w, AREA.h / 2);
      hits.add(this, 'scroll:down', AREA.x, AREA.y + AREA.h / 2, AREA.w, AREA.h / 2);
    }
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
    drawText(g, typing ? (Math.floor(this.t / 30) % 2 ? '|' : '') : tr('Message…'), s.x + 7, fy - 1, { color: '#6a7090' });
    g.fillStyle = typing ? COL.me : '#3a4260';
    g.fillRect(s.x + s.w - 13, fy + 2, 7, 7);
    g.fillStyle = '#ffffff';
    g.fillRect(s.x + s.w - 10, fy + 3, 1, 5);
    g.fillRect(s.x + s.w - 11, fy + 4, 3, 1);
  }

  /** Contact list (« Messages »): pinned first, padlock, unread badge, last message preview. */
  private drawList(g: CanvasRenderingContext2D): void {
    const s = SCREEN;
    this.header(g, tr('Messages'));
    const top = s.y + 23;
    const bottom = s.y + s.h - TABS_H;
    const visible = Math.floor((bottom - top) / ROW_H);
    if (this.sel < this.listScroll) this.listScroll = this.sel;
    if (this.sel >= this.listScroll + visible) this.listScroll = this.sel - visible + 1;
    g.save();
    g.beginPath();
    g.rect(s.x, top, s.w, bottom - top);
    g.clip();
    this.contacts.forEach((c, i) => {
      const row = i - this.listScroll;
      if (row < 0 || row >= visible + 1) return;
      const y = top + row * ROW_H;
      const sel = i === this.sel && this.mode === 'browse';
      const shake = sel && this.refuseT > 0 ? (this.refuseT % 4 < 2 ? 1 : -1) : 0;
      if (this.mode === 'browse') hits.add(this, i, s.x, y, s.w, ROW_H);
      if (sel) {
        g.fillStyle = '#232c48';
        g.fillRect(s.x, y, s.w, ROW_H);
      }
      const x = s.x + shake;
      // Avatar
      g.fillStyle = c.color ?? '#5c6080';
      g.fillRect(x + 4, y + 4, 12, 14);
      g.fillRect(x + 3, y + 5, 14, 12);
      drawText(g, c.avatar ?? [...tr(c.name)][0] ?? '', x + 10, y + 5, { color: '#ffffff', align: 'center' });
      // Name, pin / padlock, time
      const name = tr(c.name);
      drawText(g, name, x + 21, y + 1, { color: '#ffffff' });
      let ix = x + 21 + measure(name) + 3;
      if (c.pinned) {
        this.pinIcon(g, ix, y + 4);
        ix += 6;
      }
      if (c.locked) this.lockIcon(g, ix, y + 4);
      if (c.when) drawText(g, tr(c.when), s.x + s.w - 3, y + 1, { color: COL.info, align: 'right' });
      // Preview (one line, cut with « … »)
      const last = [...(this.threads.get(c.id) ?? [])].reverse().find((m) => m.from !== 'info');
      const preview = c.preview !== undefined ? tr(c.preview) : last ? (last.from === 'me' ? tf('Toi : {0}', last.text) : last.text) : '';
      drawText(g, ellipsize(preview, s.w - 30 - (c.unread ? 8 : 0)), x + 21, y + 10, { color: c.unread ? '#c8cce0' : '#7a8098' });
      if (c.unread) {
        g.fillStyle = COL.me;
        g.fillRect(s.x + s.w - 7, y + 13, 4, 4);
      }
      g.fillStyle = '#1e2438';
      g.fillRect(s.x + 21, y + ROW_H - 1, s.w - 21, 1);
    });
    g.restore();
    this.tabs(g);
  }

  /** « Journal d'appels »: calls grouped under their date. */
  private drawCalls(g: CanvasRenderingContext2D): void {
    const s = SCREEN;
    this.header(g, tr('Journal d\'appels'));
    const top = s.y + 23;
    const bottom = s.y + s.h - TABS_H;
    // Layout: a date chip (10 px) before each new date, then 20 px per call.
    const ys: number[] = [];
    let y = 0;
    let prevDate = '';
    for (const c of this.calls) {
      if (c.date !== prevDate) {
        y += 11;
        prevDate = c.date;
      }
      ys.push(y);
      y += CALL_H;
    }
    const selY = ys[this.sel] ?? 0;
    const viewH = bottom - top;
    if (selY - this.listScroll < 11) this.listScroll = Math.max(0, selY - 11);
    if (selY + CALL_H - this.listScroll > viewH) this.listScroll = selY + CALL_H - viewH;
    g.save();
    g.beginPath();
    g.rect(s.x, top, s.w, viewH);
    g.clip();
    prevDate = '';
    this.calls.forEach((c, i) => {
      const cy = top + ys[i]! - this.listScroll;
      if (c.date !== prevDate) {
        prevDate = c.date;
        drawText(g, tr(c.date), s.x + s.w / 2, cy - 12, { color: COL.info, align: 'center' });
      }
      if (cy > bottom || cy + CALL_H < top) return;
      const sel = i === this.sel && this.mode === 'browse';
      if (this.mode === 'browse') hits.add(this, i, s.x, cy, s.w, CALL_H);
      if (sel) {
        g.fillStyle = '#232c48';
        g.fillRect(s.x, cy, s.w, CALL_H);
      }
      const missed = c.dir === 'missed';
      drawText(g, tr(c.name), s.x + 4, cy, { color: missed ? '#e2404c' : '#ffffff' });
      drawText(g, c.time, s.x + s.w - 3, cy, { color: COL.info, align: 'right' });
      const arrow = c.dir === 'out' ? '↗' : '↙';
      const label = tr(c.dir === 'in' ? 'entrant' : c.dir === 'out' ? 'sortant' : 'manqué');
      drawText(g, arrow, s.x + 4, cy + 9, { color: missed ? '#e2404c' : c.dir === 'in' ? '#7ee08a' : '#a7c7f0' });
      drawText(g, c.duration ? `${label} · ${c.duration}` : label, s.x + 12, cy + 9, { color: '#7a8098' });
      g.fillStyle = '#1e2438';
      g.fillRect(s.x + 4, cy + CALL_H - 1, s.w - 4, 1);
    });
    if (!this.calls.length) drawText(g, tr('Aucun appel'), s.x + s.w / 2, top + 30, { color: COL.info, align: 'center' });
    g.restore();
    this.tabs(g);
  }

  private header(g: CanvasRenderingContext2D, title: string): void {
    const s = SCREEN;
    g.fillStyle = COL.header;
    g.fillRect(s.x, s.y + 10, s.w, 12);
    drawText(g, title, s.x + 4, s.y + 9, { color: '#ffffff' });
    g.fillStyle = '#2a3150';
    g.fillRect(s.x, s.y + 22, s.w, 1);
  }

  /** Bottom tab bar: Messages · Appels. */
  private tabs(g: CanvasRenderingContext2D): void {
    const s = SCREEN;
    const y = s.y + s.h - TABS_H;
    g.fillStyle = COL.header;
    g.fillRect(s.x, y, s.w, TABS_H);
    g.fillStyle = '#2a3150';
    g.fillRect(s.x, y, s.w, 1);
    const tabs: Array<[PhoneTab, string, View]> = [
      ['messages', 'Messages', 'list'],
      ['calls', 'Appels', 'calls'],
    ];
    tabs.forEach(([id, label, view], i) => {
      const tx = s.x + (i * s.w) / 2;
      const on = this.view === view;
      if (this.mode === 'browse') hits.add(this, `tab:${id}`, tx, y, s.w / 2, TABS_H);
      drawText(g, tr(label), tx + s.w / 4, y + 1, { color: on ? '#ffffff' : '#5c6080', align: 'center' });
      if (on) {
        g.fillStyle = COL.me;
        g.fillRect(tx + 10, y + TABS_H - 2, s.w / 2 - 20, 1);
      }
    });
  }

  private pinIcon(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.fillStyle = '#c8cce0';
    g.fillRect(x + 1, y, 3, 1);
    g.fillRect(x, y + 1, 5, 2);
    g.fillRect(x + 2, y + 3, 1, 3);
  }

  private lockIcon(g: CanvasRenderingContext2D, x: number, y: number): void {
    g.fillStyle = '#e8c070';
    g.fillRect(x + 1, y, 3, 1);
    g.fillRect(x, y + 1, 1, 2);
    g.fillRect(x + 4, y + 1, 1, 2);
    g.fillRect(x, y + 3, 5, 3);
    g.fillStyle = COL.screen;
    g.fillRect(x + 2, y + 4, 1, 1);
  }

  /** Incoming call: full screen, the name, a green button that does nothing, the phone shaking. */
  private drawRinging(g: CanvasRenderingContext2D): void {
    const r = this.ringing!;
    const s = SCREEN;
    g.fillStyle = '#0a0d18';
    g.fillRect(s.x, s.y + 10, s.w, s.h - 10);
    drawText(g, tr('Appel entrant'), s.x + s.w / 2, s.y + 26, { color: COL.info, align: 'center' });
    const pulse = 13 + Math.round(Math.sin(r.t * 0.2) * 2);
    g.fillStyle = '#3a2a40';
    g.fillRect(s.x + s.w / 2 - pulse, s.y + 60 - pulse, pulse * 2, pulse * 2);
    g.fillStyle = '#e0834f';
    g.fillRect(s.x + s.w / 2 - 10, s.y + 50, 20, 20);
    drawText(g, [...r.name].find((ch) => ch.codePointAt(0)! > 0x2000) ?? r.name[0] ?? '', s.x + s.w / 2, s.y + 55, { color: '#ffffff', align: 'center' });
    drawText(g, r.name, s.x + s.w / 2, s.y + 82, { color: '#ffffff', align: 'center' });
    // Decline / answer buttons; the green one never works.
    g.fillStyle = '#c0303c';
    g.fillRect(s.x + 20, s.y + s.h - 34, 16, 16);
    g.fillStyle = r.t % 30 < 15 ? '#3a8a4a' : '#2a6a38';
    g.fillRect(s.x + s.w - 36, s.y + s.h - 34, 16, 16);
  }

  private drawMessage(g: CanvasRenderingContext2D, m: Msg, y: number, alpha: number): void {
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
    // A long reply widens the page (it may then overlap the edge of the phone a little).
    const w = Math.min(W - 6, Math.max(CARD.w, ...this.replies.map((r) => measure(r.text) + 40)));
    const x = Math.min(CARD.x, W - 3 - w) + Math.round((1 - k) * 160);
    const y = Math.round((H - h) / 2);
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

/** Translated copy of a message (text and status). */
function trMessage(m: PhoneMessage): PhoneMessage {
  return { ...m, text: tr(m.text), status: m.status === undefined ? undefined : tr(m.status) };
}

/** Cuts a line to `maxW` pixels with « … ». */
function ellipsize(text: string, maxW: number): string {
  if (measure(text) <= maxW) return text;
  let out = '';
  for (const ch of text) {
    if (measure(out + ch + '…') > maxW) break;
    out += ch;
  }
  return out.trimEnd() + '…';
}

function easeOut(v: number): number {
  return 1 - (1 - v) * (1 - v);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

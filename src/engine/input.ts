export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'menu';
export const BUTTONS: Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'menu'];
export type Device = 'keyboard' | 'gamepad' | 'touch';

/** Physical key codes (layout independent: WASD == ZQSD on AZERTY). */
const KEYMAP: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'a',
  NumpadEnter: 'a',
  Space: 'a',
  KeyZ: 'a',
  KeyJ: 'a',
  KeyE: 'a',
  Escape: 'b',
  Backspace: 'b',
  KeyX: 'b',
  KeyK: 'b',
  ShiftLeft: 'b',
  ShiftRight: 'b',
  KeyC: 'menu',
  Tab: 'menu',
  KeyM: 'menu',
};

const REPEAT_DELAY = 18;
const REPEAT_RATE = 5;

/**
 * Unified input. Sources (keyboard, gamepad, touch) write into separate layers that are merged each frame,
 * so releasing a key never cancels a touch press and vice versa.
 */
export class Input {
  private keys = new Set<Button>();
  private touch = new Set<Button>();
  private pad = new Set<Button>();
  private cur = new Set<Button>();
  private prev = new Set<Button>();
  private held = new Map<Button, number>();
  /** Pressed this frame by an event that may already be released (fast taps). */
  private tapped = new Set<Button>();
  lastDevice: Device = 'keyboard';
  /** True when the last interaction was a tap / click on the screen or a virtual button (show tap affordances). */
  pointerUsed = false;
  /** Text typed this frame (for name entry). */
  typed: string[] = [];
  /** Relative pointer drag accumulated during the frame (used to move the soul by dragging). */
  drag = { dx: 0, dy: 0, active: false };
  /** True for one frame after a short tap on the game screen (touch / mouse). */
  tap = false;
  private tapNext = false;
  /** Where this frame's tap landed, in game pixels (set together with `tap`). */
  tapAt: { x: number; y: number } | null = null;
  private tapAtNext: { x: number; y: number } | null = null;
  /** Mouse position in game pixels when it moved this frame (hover highlight), else null. */
  hoverAt: { x: number; y: number } | null = null;
  private hoverNext: { x: number; y: number } | null = null;
  private toGame: (cx: number, cy: number) => { x: number; y: number } = (x, y) => ({ x, y });
  private dragLast: { x: number; y: number; id: number } | null = null;
  private dragStart: { x: number; y: number; t: number } | null = null;
  onDeviceChange: ((d: Device) => void) | null = null;
  /** Called on every user gesture (used to unlock audio). */
  onGesture: (() => void) | null = null;
  private dragTarget: HTMLElement | null = null;
  private scaleFn: () => number = () => 1;

  attach(target: Window = window): void {
    target.addEventListener('keydown', (e) => {
      const b = KEYMAP[e.code];
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) this.typed.push(e.key);
      else if (e.key === 'Backspace') this.typed.push('\b');
      else if (e.key === 'Enter') this.typed.push('\n');
      if (b) {
        if (!this.keys.has(b)) this.tapped.add(b);
        this.keys.add(b);
        e.preventDefault();
      }
      this.setDevice('keyboard');
      this.pointerUsed = false;
      this.onGesture?.();
    });
    target.addEventListener('keyup', (e) => {
      const b = KEYMAP[e.code];
      if (b) this.keys.delete(b);
    });
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.touch.clear();
    });
    target.addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
  }

  /**
   * Enables drag-to-move and taps on an element (the game canvas). `toGame` converts client (CSS) coordinates to
   * game pixels so taps can hit the regions scenes register (see `hits`).
   */
  attachDrag(
    el: HTMLElement,
    cssPixelsPerGamePixel: () => number,
    toGame?: (clientX: number, clientY: number) => { x: number; y: number },
  ): void {
    this.dragTarget = el;
    this.scaleFn = cssPixelsPerGamePixel;
    if (toGame) this.toGame = toGame;
    el.addEventListener('pointerdown', (e) => {
      this.dragLast = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.dragStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.drag.active = true;
      this.pointerUsed = true;
      if (e.pointerType === 'touch') this.setDevice('touch');
      this.onGesture?.();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') this.hoverNext = this.toGame(e.clientX, e.clientY);
      if (!this.dragLast || e.pointerId !== this.dragLast.id) return;
      const k = this.scaleFn() || 1;
      this.drag.dx += (e.clientX - this.dragLast.x) / k;
      this.drag.dy += (e.clientY - this.dragLast.y) / k;
      this.dragLast = { x: e.clientX, y: e.clientY, id: e.pointerId };
    });
    const end = (e: PointerEvent) => {
      if (this.dragLast && e.pointerId === this.dragLast.id) {
        this.dragLast = null;
        this.drag.active = false;
        const st = this.dragStart;
        if (e.type === 'pointerup' && st && performance.now() - st.t < 500 && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 14) {
          this.tapNext = true;
          this.tapAtNext = this.toGame(st.x, st.y);
        }
        this.dragStart = null;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  get dragElement(): HTMLElement | null {
    return this.dragTarget;
  }

  setTouch(b: Button, down: boolean): void {
    if (down) {
      if (!this.touch.has(b)) this.tapped.add(b);
      this.touch.add(b);
      this.pointerUsed = true;
      this.setDevice('touch');
      this.onGesture?.();
    } else {
      this.touch.delete(b);
    }
  }

  private setDevice(d: Device): void {
    if (this.lastDevice !== d) {
      this.lastDevice = d;
      this.onDeviceChange?.(d);
    }
  }

  private pollGamepad(): void {
    this.pad.clear();
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const btn = (i: number) => !!p.buttons[i]?.pressed;
      const ax = p.axes[0] ?? 0;
      const ay = p.axes[1] ?? 0;
      if (btn(12) || ay < -0.5) this.pad.add('up');
      if (btn(13) || ay > 0.5) this.pad.add('down');
      if (btn(14) || ax < -0.5) this.pad.add('left');
      if (btn(15) || ax > 0.5) this.pad.add('right');
      if (btn(0)) this.pad.add('a');
      if (btn(1)) this.pad.add('b');
      if (btn(9) || btn(3) || btn(8)) this.pad.add('menu');
      if (this.pad.size) {
        this.setDevice('gamepad');
        this.pointerUsed = false;
      }
    }
  }

  /** Call once at the start of each fixed update. */
  update(): void {
    this.tap = this.tapNext;
    this.tapAt = this.tapNext ? this.tapAtNext : null;
    this.tapNext = false;
    this.hoverAt = this.hoverNext;
    this.hoverNext = null;
    this.pollGamepad();
    this.prev = this.cur;
    this.cur = new Set<Button>([...this.keys, ...this.touch, ...this.pad, ...this.tapped]);
    for (const b of BUTTONS) {
      if (this.cur.has(b)) this.held.set(b, (this.held.get(b) ?? 0) + 1);
      else this.held.delete(b);
    }
  }

  /** Call at the end of each fixed update. */
  endFrame(): void {
    this.tapped.clear();
    this.typed = [];
    this.drag.dx = 0;
    this.drag.dy = 0;
  }

  down(b: Button): boolean {
    return this.cur.has(b);
  }

  pressed(b: Button): boolean {
    return this.cur.has(b) && !this.prev.has(b);
  }

  released(b: Button): boolean {
    return !this.cur.has(b) && this.prev.has(b);
  }

  /** Pressed, or held long enough to auto-repeat (menu navigation). */
  repeat(b: Button): boolean {
    if (this.pressed(b)) return true;
    const t = this.held.get(b) ?? 0;
    return t > REPEAT_DELAY && (t - REPEAT_DELAY) % REPEAT_RATE === 0;
  }

  heldFrames(b: Button): number {
    return this.held.get(b) ?? 0;
  }

  /** Movement vector from directional buttons (not normalized). */
  axis(): { x: number; y: number } {
    return {
      x: (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0),
      y: (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0),
    };
  }

  /** Clears all pressed state (used after scene transitions so a press isn't consumed twice). */
  consume(): void {
    this.prev = new Set(this.cur);
    this.tapped.clear();
    this.tap = false;
    this.tapAt = null;
  }

  releaseAll(): void {
    this.keys.clear();
    this.touch.clear();
    this.tapped.clear();
  }
}

export const input = new Input();

export type HitId = number | string;
interface HitRegion {
  owner: object;
  id: HitId;
  x: number;
  y: number;
  w: number;
  h: number;
  /** performance.now() when the region first appeared (taps on brand-new regions are ignored). */
  born: number;
}

/**
 * Clickable rectangles for direct touch / mouse. Scenes register them *while drawing* (game pixels, like everything
 * they draw) under an owner (usually the scene itself); their update then asks which of its regions this frame's tap
 * hit. Regions are double-buffered: the ones drawn during a render become active when it ends (`flip`, called once
 * per render after every layer is drawn), so a tap is always tested against what was on screen, and regions of a
 * scene that is not drawn any more simply vanish.
 */
export class HitRegions {
  private cur: HitRegion[] = [];
  private next: HitRegion[] = [];

  /** Registers a clickable rectangle for `owner` (call it from `draw`). */
  add(owner: object, id: HitId, x: number, y: number, w: number, h: number): void {
    this.next.push({ owner, id, x, y, w, h, born: 0 });
  }

  /** Publishes the regions drawn during this render (keeps the age of those already on screen). */
  flip(): void {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    for (const r of this.next) {
      const old = this.cur.find((o) => o.owner === r.owner && o.id === r.id);
      r.born = old ? old.born : now;
    }
    this.cur = this.next;
    this.next = [];
  }

  /** Topmost region of `owner` containing the point. */
  at(owner: object, x: number, y: number): HitRegion | null {
    for (let i = this.cur.length - 1; i >= 0; i--) {
      const r = this.cur[i]!;
      if (r.owner === owner && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    }
    return null;
  }

  /**
   * Id of the `owner` region under this frame's tap, or null. A tap on a region is consumed (`input.tap` turns
   * false so it does not also advance text). Regions visible for less than `minAge` ms ignore taps: a menu that just
   * popped up under a finger tapping through dialogue is not activated by accident.
   */
  tap(owner: object, minAge = 180): HitId | null {
    const p = input.tapAt;
    if (!input.tap || !p) return null;
    const r = this.at(owner, p.x, p.y);
    if (!r) return null;
    input.tap = false;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    return now - r.born < minAge ? null : r.id;
  }

  /** Id of the `owner` region under the mouse when it moved this frame (hover highlight), or null. */
  hover(owner: object): HitId | null {
    const p = input.hoverAt;
    return p ? (this.at(owner, p.x, p.y)?.id ?? null) : null;
  }

  /** Hover or tap on one of `owner`'s regions: `{ id, tap }` (tap = activate), or null. */
  pick(owner: object, minAge?: number): { id: HitId; tap: boolean } | null {
    const t = this.tap(owner, minAge);
    if (t !== null) return { id: t, tap: true };
    const h = this.hover(owner);
    return h !== null ? { id: h, tap: false } : null;
  }

  /** Drops every region (tests). */
  clear(): void {
    this.cur = [];
    this.next = [];
  }
}

export const hits = new HitRegions();

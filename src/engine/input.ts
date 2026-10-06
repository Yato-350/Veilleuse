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
  /** Text typed this frame (for name entry). */
  typed: string[] = [];
  /** Relative pointer drag accumulated during the frame (used to move the soul by dragging). */
  drag = { dx: 0, dy: 0, active: false };
  private dragLast: { x: number; y: number; id: number } | null = null;
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

  /** Enables drag-to-move on an element (the game canvas). */
  attachDrag(el: HTMLElement, cssPixelsPerGamePixel: () => number): void {
    this.dragTarget = el;
    this.scaleFn = cssPixelsPerGamePixel;
    el.addEventListener('pointerdown', (e) => {
      this.dragLast = { x: e.clientX, y: e.clientY, id: e.pointerId };
      this.drag.active = true;
      if (e.pointerType === 'touch') this.setDevice('touch');
      this.onGesture?.();
    });
    el.addEventListener('pointermove', (e) => {
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
      if (this.pad.size) this.setDevice('gamepad');
    }
  }

  /** Call once at the start of each fixed update. */
  update(): void {
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
  }

  releaseAll(): void {
    this.keys.clear();
    this.touch.clear();
    this.tapped.clear();
  }
}

export const input = new Input();

import { H, W } from './constants';
import { input, type Button } from './input';

/**
 * Handles canvas sizing (integer scaling when possible), the CRT overlay and on-screen touch controls.
 */
export class Screen {
  stage!: HTMLElement;
  canvas!: HTMLCanvasElement;
  touchRoot!: HTMLElement;
  /** CSS pixels per game pixel. */
  scale = 1;
  touchMode: 'auto' | 'on' | 'off' = 'auto';
  private touchVisible = false;

  init(): void {
    this.stage = document.getElementById('stage')!;
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.touchRoot = document.getElementById('touch')!;
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 150));
    window.visualViewport?.addEventListener('resize', onResize);
    this.bindTouch();
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.setTouchVisible(hasTouch);
    input.onDeviceChange = (d) => {
      if (this.touchMode !== 'auto') return;
      if (d === 'touch') this.setTouchVisible(true);
      else if (d === 'keyboard' || d === 'gamepad') this.setTouchVisible(false);
    };
    input.attachDrag(
      this.canvas,
      () => this.scale,
      (cx, cy) => this.toGame(cx, cy),
    );
    this.resize();
  }

  setTouchMode(mode: 'auto' | 'on' | 'off'): void {
    this.touchMode = mode;
    if (mode === 'on') this.setTouchVisible(true);
    else if (mode === 'off') this.setTouchVisible(false);
    else this.setTouchVisible('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  setTouchVisible(v: boolean): void {
    if (this.touchVisible === v && this.touchRoot.classList.contains('hidden') === !v) return;
    this.touchVisible = v;
    this.touchRoot.classList.toggle('hidden', !v);
    this.resize();
  }

  setTouchStyle(opacity: number, size: number): void {
    const root = document.documentElement.style;
    root.setProperty('--touch-opacity', String(opacity));
    root.setProperty('--touch-scale', String(size));
    this.resize();
  }

  setCrt(on: boolean): void {
    document.getElementById('crt')?.classList.toggle('on', on);
  }

  /** Converts a client (CSS pixel) position to game pixels (0..W × 0..H inside the canvas). */
  toGame(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) * W) / (r.width || W), y: ((clientY - r.top) * H) / (r.height || H) };
  }

  get isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  resize(): void {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const portrait = vh > vw;
    const controlsH = this.touchVisible && portrait ? Math.min(Math.max(vh * 0.42, 230), vh - (vw * H) / W - 10) : 0;
    document.documentElement.style.setProperty('--controls-h', `${Math.max(0, controlsH)}px`);
    // Landscape + touch: keep the controls beside the screen when that still leaves a comfortable scale,
    // otherwise overlay them (small phones).
    let availW = vw;
    if (this.touchVisible && !portrait) {
      const side = 150 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--touch-scale')) || 1);
      const withSides = Math.min((vw - side * 2) / W, vh / H);
      if (withSides >= 1.6) availW = vw - side * 2;
    }
    const availH = vh - Math.max(0, controlsH);
    const dpr = window.devicePixelRatio || 1;
    // Largest integer scale in device pixels that fits.
    const maxFit = Math.min(availW / W, availH / H);
    const intDevice = Math.floor(Math.min((availW * dpr) / W, (availH * dpr) / H));
    let cssScale = intDevice >= 1 ? intDevice / dpr : maxFit;
    // If integer scaling wastes too much space, use the fractional fit (pixelated rendering keeps it sharp enough).
    if (cssScale < maxFit * 0.86) cssScale = maxFit;
    this.scale = cssScale;
    const w = Math.floor(W * cssScale);
    const h = Math.floor(H * cssScale);
    const s = this.stage.style;
    s.width = `${w}px`;
    s.height = `${h}px`;
    s.left = `${Math.floor((vw - w) / 2)}px`;
    s.top = portrait && controlsH > 0 ? `${Math.max(0, Math.floor((availH - h) / 2))}px` : `${Math.floor((vh - h) / 2)}px`;
  }

  private bindTouch(): void {
    const dpad = document.getElementById('dpad')!;
    const arms: Record<string, HTMLElement> = {
      up: dpad.querySelector('.dpad-up')!,
      down: dpad.querySelector('.dpad-down')!,
      left: dpad.querySelector('.dpad-left')!,
      right: dpad.querySelector('.dpad-right')!,
    };
    const active = new Set<Button>();
    const setDirs = (dirs: Button[]) => {
      for (const d of ['up', 'down', 'left', 'right'] as Button[]) {
        const on = dirs.includes(d);
        if (on !== active.has(d)) {
          input.setTouch(d, on);
          if (on) active.add(d);
          else active.delete(d);
          arms[d]!.classList.toggle('active', on);
        }
      }
    };
    let dpadPointer: number | null = null;
    const fromPoint = (e: PointerEvent) => {
      const r = dpad.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dead = r.width * 0.12;
      if (Math.hypot(dx, dy) < dead) return setDirs([]);
      const ang = Math.atan2(dy, dx);
      const dirs: Button[] = [];
      // 8-way with generous diagonals.
      const sector = Math.round(ang / (Math.PI / 4));
      switch ((sector + 8) % 8) {
        case 0:
          dirs.push('right');
          break;
        case 1:
          dirs.push('right', 'down');
          break;
        case 2:
          dirs.push('down');
          break;
        case 3:
          dirs.push('down', 'left');
          break;
        case 4:
          dirs.push('left');
          break;
        case 5:
          dirs.push('left', 'up');
          break;
        case 6:
          dirs.push('up');
          break;
        case 7:
          dirs.push('up', 'right');
          break;
      }
      setDirs(dirs);
    };
    dpad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dpadPointer = e.pointerId;
      dpad.setPointerCapture(e.pointerId);
      fromPoint(e);
    });
    dpad.addEventListener('pointermove', (e) => {
      if (e.pointerId === dpadPointer) fromPoint(e);
    });
    const endDpad = (e: PointerEvent) => {
      if (e.pointerId !== dpadPointer) return;
      dpadPointer = null;
      setDirs([]);
    };
    dpad.addEventListener('pointerup', endDpad);
    dpad.addEventListener('pointercancel', endDpad);
    dpad.addEventListener('lostpointercapture', endDpad);

    const bindBtn = (id: string, b: Button) => {
      const el = document.getElementById(id)!;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.classList.add('active');
        input.setTouch(b, true);
        if (navigator.vibrate && vibrationEnabled) navigator.vibrate(8);
      };
      const up = () => {
        el.classList.remove('active');
        input.setTouch(b, false);
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bindBtn('btn-a', 'a');
    bindBtn('btn-b', 'b');
    bindBtn('btn-menu', 'menu');
  }
}

let vibrationEnabled = true;
export function setVibration(on: boolean): void {
  vibrationEnabled = on;
}
export function vibrate(pattern: number | number[]): void {
  if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern);
}

export const screen = new Screen();

import { H, STEP, W } from './constants';
import { fx } from './fx';
import { input } from './input';
import { ctx2d } from './sprite';

export interface Scene {
  /** Fixed-timestep update (60 Hz). */
  update(): void;
  draw(g: CanvasRenderingContext2D): void;
  enter?(): void;
  exit?(): void;
  /** Draw the scene below this one first (overlays, menus). */
  transparent?: boolean;
  /** Keep updating the scene below (rare). */
  passthrough?: boolean;
}

type Waiter = { done: () => boolean; resolve: () => void };

/**
 * Core loop: fixed 60 Hz updates with an accumulator, a scene stack and a tiny promise scheduler used by scripts
 * (`await game.wait(30)` / `await game.until(() => cond)`).
 */
export class Game {
  canvas!: HTMLCanvasElement;
  g!: CanvasRenderingContext2D;
  scenes: Scene[] = [];
  frame = 0;
  private acc = 0;
  private last = 0;
  private waiters: Waiter[] = [];
  private running = false;
  paused = false;
  /** Hooks called every frame after scenes update (UI managers, timers). */
  hooks: Array<() => void> = [];
  /** Draw hooks rendered above all scenes but below post effects (global UI such as dialogue). */
  overlays: Array<(g: CanvasRenderingContext2D) => void> = [];
  /** Topmost overlays rendered after post effects (debug, toasts). */
  topOverlays: Array<(g: CanvasRenderingContext2D) => void> = [];

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.width = W;
    canvas.height = H;
    this.g = ctx2d(canvas);
  }

  get top(): Scene | undefined {
    return this.scenes[this.scenes.length - 1];
  }

  push(s: Scene): void {
    this.scenes.push(s);
    s.enter?.();
    input.consume();
  }

  pop(): Scene | undefined {
    const s = this.scenes.pop();
    s?.exit?.();
    input.consume();
    return s;
  }

  replace(s: Scene): void {
    while (this.scenes.length) this.scenes.pop()!.exit?.();
    this.push(s);
  }

  remove(s: Scene): void {
    const i = this.scenes.indexOf(s);
    if (i >= 0) {
      this.scenes.splice(i, 1);
      s.exit?.();
    }
  }

  /** Resolves after `frames` updates. */
  wait(frames: number): Promise<void> {
    const target = this.frame + Math.max(0, Math.round(frames));
    return this.until(() => this.frame >= target);
  }

  /** Resolves once `cond` returns true (checked every update). */
  until(cond: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      if (cond()) resolve();
      else this.waiters.push({ done: cond, resolve });
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      let dt = now - this.last;
      this.last = now;
      if (dt > 250) dt = 250;
      if (!this.paused) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= STEP && steps < 5) {
          this.step();
          this.acc -= STEP;
          steps++;
        }
        if (steps >= 5) this.acc = 0;
      }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** One fixed update (exposed for tests / headless stepping). */
  step(): void {
    input.update();
    this.frame++;
    const top = this.top;
    if (top) {
      if (top.passthrough) {
        const below = this.scenes[this.scenes.length - 2];
        below?.update();
      }
      top.update();
    }
    for (const h of this.hooks) h();
    fx.update();
    if (this.waiters.length) {
      const ready = this.waiters.filter((w) => w.done());
      if (ready.length) {
        this.waiters = this.waiters.filter((w) => !ready.includes(w));
        for (const w of ready) w.resolve();
      }
    }
    input.endFrame();
  }

  render(): void {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(fx.shakeX, fx.shakeY);
    // Find the lowest scene that must be drawn.
    let start = this.scenes.length - 1;
    while (start > 0 && this.scenes[start]!.transparent) start--;
    for (let i = Math.max(0, start); i < this.scenes.length; i++) this.scenes[i]!.draw(g);
    g.restore();
    for (const o of this.overlays) o(g);
    fx.post(g, this.canvas);
    for (const o of this.topOverlays) o(g);
  }
}

export const game = new Game();

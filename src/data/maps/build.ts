import { hash2 } from '../../engine/math';

/**
 * Tiny map-building kit for outdoor maps: start from a filled grid, carve paths and clearings, add organic borders,
 * scatter details, then `toString()` into a MapDef `tiles` string. Deterministic (seeded by position).
 */
export class Grid {
  readonly w: number;
  readonly h: number;
  private c: string[][];

  constructor(w: number, h: number, fill: string) {
    this.w = w;
    this.h = h;
    this.c = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }

  get(x: number, y: number): string | undefined {
    return this.c[y]?.[x];
  }

  set(x: number, y: number, ch: string): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y]![x] = ch;
    return this;
  }

  /** Fills a rectangle (optionally only over cells currently equal to `only`). */
  rect(x: number, y: number, w: number, h: number, ch: string, only?: string): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!only || this.get(xx, yy) === only) this.set(xx, yy, ch);
    return this;
  }

  /** Filled ellipse with a slightly wobbly edge. */
  blob(cx: number, cy: number, rx: number, ry: number, ch: string, seed = 1, only?: string): this {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        const wob = (hash2(x, y, seed) - 0.5) * 0.35;
        if (d <= 1 + wob && (!only || this.get(x, y) === only)) this.set(x, y, ch);
      }
    }
    return this;
  }

  /** Path through waypoints (axis-aligned segments), `thick` cells wide. */
  path(points: Array<[number, number]>, ch: string, thick = 2): this {
    for (let i = 0; i + 1 < points.length; i++) {
      const [x0, y0] = points[i]!;
      const [x1, y1] = points[i + 1]!;
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      let x = x0;
      let y = y0;
      for (;;) {
        this.rect(x, y, thick, thick, ch);
        if (x === x1 && y === y1) break;
        if (x !== x1) x += dx;
        else y += dy;
      }
    }
    return this;
  }

  /** Solid border of `ch`, `depth` thick, with an irregular inner edge. */
  border(ch: string, depth = 1, seed = 3, jag = 1): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        const extra = Math.floor(hash2(Math.floor(x / 2), Math.floor(y / 2), seed) * (jag + 1));
        if (d < depth + extra) this.set(x, y, ch);
      }
    }
    return this;
  }

  /** Randomly replaces cells equal to `only` with `ch`. */
  scatter(ch: string, density: number, seed: number, only: string): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) === only && hash2(x, y, seed) < density) this.set(x, y, ch);
    return this;
  }

  /** Opens a gap in the border (for exits). */
  open(x: number, y: number, w: number, h: number, ch: string): this {
    return this.rect(x, y, w, h, ch);
  }

  toString(): string {
    return this.c.map((r) => r.join('')).join('\n');
  }
}

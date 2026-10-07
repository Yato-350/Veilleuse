import type { SpriteDef } from '../../game/assets';
import { corrupt } from '../../engine/palette';

// Enemy sprites: battle (`b_<id>`, `b_<id>_2`) and overworld (`ow_<id>`, `ow_<id>_2`). See docs/CONTENT_CONTRACT.md § 5.
// Big bodies are built procedurally (shaded balls, polygons) then detailed by hand-drawn overlays, so that every
// silhouette stays clean and the light always comes from the top-left.

// ---------------------------------------------------------------------------------------------------------------------
// Pixel toolkit
// ---------------------------------------------------------------------------------------------------------------------

/** Splits template art into rows (strips blank edges and common indentation, like the engine). */
function rows(src: string): string[] {
  const lines = src.replace(/\r/g, '').split('\n');
  while (lines.length && lines[0]!.trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
  return lines.map((l) => l.slice(indent).trimEnd());
}

/** Light direction (top-left, towards the viewer), normalised. */
const LIGHT = (() => {
  const v = [-0.55, -0.7, 0.6];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / n) as [number, number, number];
})();

/** Colour ramp: [highlight, base, shade, deep shade]. */
type Ramp = [string, string, string, string];

/** A mutable character grid with a few drawing primitives. */
class Pix {
  readonly w: number;
  readonly h: number;
  private g: string[][];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  }

  static of(art: string): Pix {
    const r = rows(art);
    const p = new Pix(Math.max(...r.map((l) => l.length)), r.length);
    r.forEach((l, y) => [...l].forEach((c, x) => p.set(x, y, c)));
    return p;
  }

  clone(): Pix {
    const p = new Pix(this.w, this.h);
    p.g = this.g.map((r) => [...r]);
    return p;
  }

  get(x: number, y: number): string {
    return this.g[y]?.[x] ?? '.';
  }

  solid(x: number, y: number): boolean {
    const c = this.get(x, y);
    return c !== '.' && c !== ' ';
  }

  set(x: number, y: number, c: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h && c !== ' ') this.g[y]![x] = c;
    return this;
  }

  /** Sets a pixel only where something is already drawn. */
  paint(x: number, y: number, c: string): this {
    if (this.solid(Math.round(x), Math.round(y))) this.set(x, y, c);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
    return this;
  }

  /**
   * Shaded ellipse lit from the top-left. `sep` draws the part of its border that overlaps already-drawn pixels
   * (separates puffs of clouds and wool). `cut` thresholds can be tuned per material.
   */
  ball(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    ramp: Ramp,
    sep?: string,
    cut: [number, number, number] = [0.8, 0.3, -0.15],
    seamBelow = 0.35,
  ): this {
    const pts: Array<[number, number, string, boolean]> = [];
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d));
        const i = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        const c = i > cut[0] ? ramp[0] : i > cut[1] ? ramp[1] : i > cut[2] ? ramp[2] : ramp[3];
        // Border pixel: one of its 4-neighbours lies outside the ellipse.
        const out = (ox: number, oy: number) => {
          const ax = (x + ox + 0.5 - cx) / rx;
          const ay = (y + oy + 0.5 - cy) / ry;
          return ax * ax + ay * ay > 1;
        };
        const border = out(1, 0) || out(-1, 0) || out(0, 1) || out(0, -1);
        pts.push([x, y, c, border && ny < seamBelow]);
      }
    for (const [x, y, c, border] of pts) {
      if (sep && border && this.solid(x, y) && this.get(x, y) !== sep) this.set(x, y, sep);
      else this.set(x, y, c);
    }
    return this;
  }

  /**
   * Union of circles shaded as one volume (global ellipse normal mixed with each bump's own normal): fluffy wool,
   * clouds and cotton without visible seams.
   */
  blob(
    circles: Array<[number, number, number]>,
    ramp: Ramp,
    g: [number, number, number, number],
    local = 0.45,
    cut: [number, number, number] = [0.78, 0.32, -0.1],
  ): this {
    const [gx, gy, grx, gry] = g;
    const xs = circles.flatMap(([x, , r]) => [x - r, x + r]);
    const ys = circles.flatMap(([, y, r]) => [y - r, y + r]);
    for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.max(...ys) + 1; y++)
      for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.max(...xs) + 1; x++) {
        let best = -1;
        let ln: [number, number] = [0, 0];
        for (const [cx, cy, r] of circles) {
          const dx = (x + 0.5 - cx) / r;
          const dy = (y + 0.5 - cy) / r;
          const d = dx * dx + dy * dy;
          if (d <= 1 && 1 - d > best) {
            best = 1 - d;
            ln = [dx, dy];
          }
        }
        if (best < 0) continue;
        let nx = (x + 0.5 - gx) / grx;
        let ny = (y + 0.5 - gy) / gry;
        const gl = Math.hypot(nx, ny);
        if (gl > 1) {
          nx /= gl;
          ny /= gl;
        }
        nx = nx * (1 - local) + ln[0] * local;
        ny = ny * (1 - local) + ln[1] * local;
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
        const i = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        this.set(x, y, i > cut[0] ? ramp[0] : i > cut[1] ? ramp[1] : i > cut[2] ? ramp[2] : ramp[3]);
      }
    return this;
  }

  /** Small curl marks on a woolly surface: lit side gets `light`, shaded side gets `dark`. */
  curls(seed: number, n: number, x0: number, y0: number, x1: number, y1: number, map: Record<string, string>): this {
    const rnd = seeded(seed);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(x0 + rnd() * (x1 - x0));
      const y = Math.floor(y0 + rnd() * (y1 - y0));
      const base = this.get(x, y);
      const c = map[base];
      if (!c || this.get(x + 1, y) !== base || this.get(x, y + 1) !== base) continue;
      // A tiny "ɔ" curl.
      this.set(x, y, c).set(x + 1, y, c).set(x + 2, y + 1, c).set(x + 1, y + 2, c);
    }
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Filled polygon (even-odd, pixel centres). */
  poly(pts: Array<[number, number]>, c: string): this {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const py = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i]!;
        const [bx, by] = pts[(i + 1) % pts.length]!;
        if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(ax + ((py - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.ceil(xs[k]! - 0.5); x <= Math.floor(xs[k + 1]! - 0.5); x++) this.set(x, y, c);
    }
    return this;
  }

  /** Draws hand-made art on top: '.' keeps what is below, '~' erases. */
  stamp(art: string, ox = 0, oy = 0): this {
    rows(art).forEach((l, y) =>
      [...l].forEach((c, x) => {
        if (c === '.' || c === ' ') return;
        if (c === '~') this.g[oy + y] && this.g[oy + y]![ox + x] !== undefined && (this.g[oy + y]![ox + x] = '.');
        else this.set(ox + x, oy + y, c);
      }),
    );
    return this;
  }

  /** Pastes another grid ('.' pixels are skipped). */
  blit(p: Pix, ox = 0, oy = 0): this {
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.solid(x, y)) this.set(ox + x, oy + y, p.get(x, y));
    return this;
  }

  /** Every `from` pixel within `depth` steps of the outside in direction (dx, dy) becomes `to`. */
  rim(from: string, to: string, dx: number, dy: number, depth = 1, stop = '.'): this {
    const src = this.clone();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src.get(x, y) !== from) continue;
        for (let i = 1; i <= depth; i++) {
          const n = src.get(x + dx * i, y + dy * i);
          if (n === '.' || n === 'k' || stop.includes(n)) {
            this.g[y]![x] = to;
            break;
          }
        }
      }
    return this;
  }

  /** Drawn pixels touching the outside (4-neighbours) become `c` (an inner contour). */
  contour(c = 'k'): this {
    const src = this.clone();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (src.solid(x, y) && (!src.solid(x - 1, y) || !src.solid(x + 1, y) || !src.solid(x, y - 1) || !src.solid(x, y + 1)))
          this.g[y]![x] = c;
    return this;
  }

  /** Replaces colours (optionally in a rectangle). */
  recolor(map: Record<string, string>, x0 = 0, y0 = 0, x1 = 1e9, y1 = 1e9): this {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
        const c = map[this.g[y]![x]!];
        if (c !== undefined) this.g[y]![x] = c;
      }
    return this;
  }

  /** Copies the left half onto the right half, mirrored (symmetric sprites). */
  mirror(): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w >> 1; x++) this.g[y]![this.w - 1 - x] = this.g[y]![x]!;
    return this;
  }

  flip(): Pix {
    const p = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.g[y]![x] = this.g[y]![this.w - 1 - x]!;
    return p;
  }

  /** Moves a rectangular block by (dx, dy) (what it leaves behind becomes transparent). */
  move(x0: number, y0: number, w: number, h: number, dx: number, dy: number): this {
    const src = this.clone();
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.g[y] && this.g[y]![x] !== undefined && (this.g[y]![x] = '.');
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (src.solid(x, y)) this.set(x + dx, y + dy, src.get(x, y));
    return this;
  }

  toString(): string {
    return this.g.map((r) => r.join('')).join('\n');
  }
}

/** Small deterministic random generator (scribbles, wool curls…). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Chapitre 1 — Le Pays de Coton
// ---------------------------------------------------------------------------------------------------------------------

// Nuage Triste (48x40) — gros nuage gris-bleu qui pleure et pleut. Local ramp 6-9 (gris-bleu).
const NUAGE_COLORS = { '6': '#d5def0', '7': '#a9b6d6', '8': '#8090bb', '9': '#5f6a98' };
function nuage(f: number): string {
  const p = new Pix(48, 40);
  const R: Ramp = ['6', '7', '8', '9'];
  const squash = f ? 1 : 0;
  // Back puffs, then front puffs (each one separated by a darker seam).
  p.ball(15, 13 + squash, 9, 9, R, '8', undefined, -0.2);
  p.ball(26, 10 + squash, 11, 10 - squash, R, '8', undefined, -0.2);
  p.ball(37, 14 + squash, 8, 8, R, '8', undefined, -0.2);
  p.ball(8, 22, 7, 7, R, '8', undefined, -0.2);
  p.ball(19, 21, 10, 9, R, '8', undefined, -0.2);
  p.ball(31, 21, 10, 9, R, '8', undefined, -0.2);
  p.ball(41, 22, 6, 6, R, '8', undefined, -0.2);
  // Flat-ish underside.
  p.rect(5, 26, 40, 3, '8').rect(7, 29, 36, 1, '9');
  for (let x = 4; x < 46; x++) if (p.get(x, 28) === '8') p.set(x, 28, '9');
  // Face: sad brows, teary eyes, wobbly frown.
  p.stamp(
    `
    .kk............kk.
    ...kk........kk...
    ..................
    ..kkkk......kkkk..
    .k9999k....k9999k.
    .kfiiik....kfiiik.
    .kiiiik....kiiiik.
    ..kkkkb....bkkkk..
    .....b......b.....
    .....B..kk..B.....
    .......k..k.......
    `,
    15,
    12 + squash,
  );
  // Rain under the cloud.
  const drops: Array<[number, number]> = f
    ? [[9, 33], [17, 36], [25, 32], [33, 35], [40, 31]]
    : [[9, 31], [17, 34], [25, 37], [33, 32], [40, 35]];
  for (const [x, y] of drops) p.set(x, y, 'b').set(x, y + 1, 'b').set(x, y + 2, 'B');
  return p.toString();
}

/** Mirrors hand-made art horizontally. */
const flipArt = (art: string): string =>
  rows(art)
    .map((r) => [...r].reverse().join(''))
    .join('\n');

// Gribouille (36x32) — pelote de gribouillis à l'encre, deux grands yeux ronds. _2 = les traits « bouillonnent ».
function gribouille(f: number): string {
  const p = new Pix(36, 32);
  const cx = 18;
  const cy = 17;
  p.ellipse(cx, cy, 12, 11, 'i');
  // One continuous pen stroke going round and round (a child's scribble), drifting a little at each turn.
  const ph = f ? 1.3 : 0;
  for (let t = 0; t < Math.PI * 2 * 6; t += 0.02) {
    const k = t / (Math.PI * 12);
    const r = 12 - k * 7 + Math.sin(t * 2.5 + ph) * 1.2;
    const ox = cx + Math.sin(t * 0.37 + ph) * 2.2 * k;
    const oy = cy + Math.cos(t * 0.29 + ph) * 2 * k;
    const x = ox + Math.cos(t) * r;
    const y = oy + Math.sin(t) * r * 0.92;
    const l = (x - cx) * 0.6 + (y - cy) * 0.8;
    p.set(Math.floor(x), Math.floor(y), l < -6 ? 'g' : l < 3 ? 'G' : 'd');
  }
  // Pen strokes escaping the ball (messy silhouette), and two tiny feet.
  p.stamp(f ? 'g...\n.g..\n.g..\n..gg' : '.g..\n..g.\n..g.\n...g', 3, 3);
  p.stamp(f ? '...d\n..d.\ndd..' : '..d.\n...d\ndd..', 30, 4);
  p.stamp(f ? 'dd..\n..d.\n...d' : '.dd.\n...d\n...d', 31, 22);
  p.stamp(f ? '..G\nGG.' : 'G..\n.GG', 1, 21);
  p.stamp('kKk.....kKk\n.k.......k.', 12, 29);
  // Eyes and a tiny "o" mouth.
  const eye = `
    ..kkkk..
    .kwwwwk.
    kwwwwwwk
    kwwiiwwk
    kwwifwwk
    kwwiiwwk
    .kwWWwk.
    ..kkkk..
  `;
  p.stamp(eye, 8, 10).stamp(eye, 20, 10);
  p.stamp(
    `
    .kk.
    kiik
    .kk.
    `,
    16,
    20,
  );
  return p.toString();
}

// Mouton Noir (46x40) — mouton noir grognon : laine anthracite, visage noir, cornes rouges enroulées, naseaux qui fument.
/** A curled ram horn (spiral) drawn with a tapering brush, shaded, with its own contour. dir = 1 curls on the left. */
function horn(dir: number): Pix {
  const h = new Pix(13, 13);
  const cx = 6.5;
  const cy = 6.5;
  for (let t = 0; t <= 1; t += 0.004) {
    // Starts at the top-right (where it grows from the head), sweeps outward, down and curls back inside.
    const th = -Math.PI / 2 + 0.9 - t * Math.PI * 1.75;
    const r = 4.6 - 2.6 * t;
    const br = 2.1 - 1.1 * t;
    const x = cx + Math.cos(th) * r * dir;
    const y = cy + Math.sin(th) * r;
    h.ellipse(x, y, br, br, 'r');
  }
  h.rim('r', 'p', -dir, -1, 1).rim('r', 'R', dir, 1, 1).rim('r', 'R', 0, 1, 1);
  return h.contour('k');
}

function moutonNoir(f: number): string {
  const p = new Pix(46, 40);
  const b = f ? 1 : 0;
  const WOOL: Ramp = ['G', 'd', 'd', 'K'];
  const puffs: Array<[number, number, number]> = [
    [10, 21, 7], [17, 16, 8], [29, 16, 8], [36, 21, 7], [9, 28, 6], [37, 28, 6], [16, 29, 8], [30, 29, 8], [23, 26, 10],
    [5, 24, 4], [41, 24, 4], [11, 33, 4], [23, 34, 4], [35, 33, 4], [23, 12, 6],
  ];
  p.blob(puffs.map(([x, y, r]) => [x, y + b, r]), WOOL, [23, 24 + b, 19, 14]);
  p.curls(f ? 5 : 3, 30, 4, 10, 42, 36, { G: 'g', d: 'G', K: 'd' });
  // Legs (hooves); on frame 2 one front leg stamps.
  const leg = 'kKKk\nkKKk\nkiik';
  p.stamp(leg, 12, 36).stamp(leg, 30, 36);
  if (f) p.stamp('~~~~\n' + leg, 12, 34).stamp('.kk.', 12, 39);
  // Head: dark face with its own contour, wool tuft, horns.
  const hx = 23;
  const hy = 17 + b;
  const head = new Pix(46, 40);
  head.ball(hx - 9, hy - 1, 4, 2.5, ['G', 'd', 'd', 'K']);
  head.ball(hx + 9, hy - 1, 4, 2.5, ['G', 'd', 'd', 'K']);
  head.ball(hx, hy + 1, 8, 9, ['K', 'i', 'i', 'i']);
  head.ball(hx, hy + 6, 6, 4, ['d', 'K', 'K', 'i']);
  p.blit(head.contour('k'));
  p.blob([[hx - 4, hy - 8, 3.5], [hx + 4, hy - 8, 3.5], [hx, hy - 9, 4]], ['g', 'G', 'd', 'K'], [hx, hy - 8, 8, 4]);
  p.blit(horn(1), hx - 18, hy - 12).blit(horn(-1), hx + 5, hy - 12);
  // Furious eyes, brows and snout.
  p.stamp(
    `
    ii.........ii
    .iii.....iii.
    .kwwi...iwwk.
    .kwrr...rrwk.
    ..kkk...kkk..
    `,
    hx - 6,
    hy - 3,
  );
  p.stamp(
    `
    .kdk.kdk.
    ..k...k..
    ...kkk...
    `,
    hx - 4,
    hy + 5,
  );
  // Fuming: little puffs of steam rising from the head.
  if (f) p.stamp('.ww.\nwwWw\n.WW.', hx - 10, 0).stamp('.ww.\nwWww\n.WW.', hx + 6, 1);
  else p.stamp('.w.\nwWw', hx - 8, 3).stamp('.w.\nwWw', hx + 5, 3);
  return p.toString();
}

// Pissenlit (36x50) — « dent-de-lion » rieur : crinière de pétales jaunes, fou rire, feuilles dentelées qui s'agitent.
function pissenlit(f: number): string {
  const p = new Pix(36, 50);
  // Stem (slightly curved) and a grass tuft.
  for (let y = 24; y < 47; y++) {
    const x = 17 + Math.round(Math.sin((y - 24) * 0.12) * 1.5);
    p.set(x - 1, y, 'l').set(x, y, 'L').set(x + 1, y, 'e');
  }
  // Toothed leaves (arms), each with its own contour; frame 2 swaps which one is raised.
  const leaf = (pts: Array<[number, number]>) => {
    const l = new Pix(36, 50).poly(pts, 'L');
    l.rim('L', 'l', -1, -1, 1).rim('L', 'e', 1, 1, 1).rim('L', 'e', 0, 1, 1);
    p.blit(l.contour('k'));
  };
  const up = f === 0;
  leaf(up
    ? [[16, 36], [10, 34], [11, 32], [6, 31], [7, 28], [2, 27], [4, 24], [0, 20], [6, 20], [8, 23], [10, 21], [12, 25], [14, 24], [17, 31]]
    : [[16, 37], [10, 38], [11, 35], [6, 37], [6, 34], [1, 35], [3, 32], [0, 29], [5, 29], [8, 31], [10, 29], [12, 32], [14, 31], [17, 33]]);
  leaf(up
    ? [[19, 39], [25, 40], [24, 37], [29, 39], [29, 36], [34, 37], [32, 34], [35, 31], [30, 31], [27, 33], [25, 31], [23, 34], [21, 33], [18, 35]]
    : [[19, 38], [25, 36], [24, 33], [29, 33], [28, 30], [33, 28], [31, 25], [35, 21], [29, 23], [27, 26], [25, 24], [23, 28], [21, 28], [18, 34]]);
  // Flower head: scalloped petal mane shaded as a ball, radial petal lines, rounder centre.
  const cx = 18;
  const cy = 14 + (f ? 1 : 0);
  const head = new Pix(36, 50);
  for (let y = 0; y < 30; y++)
    for (let x = 2; x < 34; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx) + (f ? 0.11 : 0);
      const d = Math.hypot(dx, dy);
      const edge = 12.2 + 1.3 * Math.cos(a * 16);
      if (d > edge) continue;
      const nx = dx / 13;
      const ny = dy / 13;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      let c = i > 0.78 ? 'q' : i > 0.3 ? 'y' : i > -0.1 ? 'Y' : 'o';
      if (d > 7.5 && Math.cos(a * 16) < -0.75) c = i > 0.3 ? 'Y' : 'o';
      if (d > 6.6 && d <= 7.6) c = i > 0.3 ? 'Y' : 'o';
      head.set(x, y, c);
    }
  p.blit(head.contour('k'));
  // Laughing face.
  p.stamp(
    `
    ..k.....k..
    .k.k...k.k.
    k...k.k...k
    ...........
    oo..kkk..oo
    o..kRRRk..o
    ...kRppk...
    ....kkk....
    `,
    cx - 5,
    cy - 4,
  );
  // Floating seeds (white parachutes).
  const seed = 'w.w\n.w.\nwfw\n.g.\n..g';
  if (f) p.stamp(seed, 30, 1).stamp(seed, 2, 6).stamp(seed, 32, 14);
  else p.stamp(seed, 31, 4).stamp(seed, 1, 2).stamp(seed, 31, 17);
  // Grass tuft at the foot.
  p.stamp(
    `
    ..e...e..l..
    .eL..eL.lL..
    eLLeeLLeLLe.
    `,
    12,
    46,
  );
  return p.toString();
}

// Chaussette Perdue (32x40) — chaussette bleue à pois, la jumelle de la marchande (même nœud rouge, mais défait).
const CHAUSSETTE_COLORS = { '6': '#d3e3fb' };
function chaussette(f: number): string {
  const p = new Pix(32, 40);
  const d = f ? 1 : 0;
  const s = new Pix(32, 40);
  // L-shaped sock: leg, heel, foot and toe.
  s.rect(6, 7, 14, 24, 'b');
  s.ellipse(12.5, 30, 7, 6, 'b');
  s.rect(12, 25, 14, 12, 'b');
  s.ellipse(25, 31, 5.5, 5.5, 'b');
  if (d) s.move(6, 7, 14, 14, 1, 0);
  s.rim('b', 'B', 1, 0, 2).rim('b', 'B', 0, 1, 2).rim('b', '6', -1, 0, 1).rim('b', '6', 0, -1, 1);
  s.rim('B', 'n', 1, 0, 1).rim('B', 'n', 0, 1, 1);
  // Darker heel and toe patches.
  for (let y = 24; y < 40; y++)
    for (let x = 0; x < 32; x++) {
      const inHeel = Math.hypot((x + 0.5 - 11) / 6, (y + 0.5 - 32) / 5) < 1 && x < 15;
      const inToe = Math.hypot((x + 0.5 - 26) / 5, (y + 0.5 - 31) / 5.5) < 1 && x > 22;
      if (inHeel || inToe) s.recolor({ '6': 'b', b: 'B', B: 'n' }, x, y, x, y);
    }
  // Polka dots.
  for (let y = 9; y < 38; y += 5)
    for (let x = 7 + ((y - 9) / 5 % 2) * 3; x < 30; x += 6) {
      const c = s.get(x, y);
      if (c !== 'b' && c !== '6') continue;
      if (s.get(x + 1, y) !== c || s.get(x, y + 1) === '.' || s.get(x + 1, y + 1) === '.') continue;
      s.set(x, y, 'w').set(x + 1, y, 'w').set(x, y + 1, 'w').set(x + 1, y + 1, 'W');
    }
  p.blit(s.contour('k'));
  // Ribbed cuff with the dark opening.
  p.stamp(
    `
    .kkkkkkkkkkkkkk.
    knnnnnnnnnnnnnnk
    kkkkkkkkkkkkkkkk
    kwbwbwbwbwbwbwBk
    kwbwbwbwbwbwbwBk
    kwbwbwbwbwbwbwBk
    kWBWBWBWBWBWBWnk
    kkkkkkkkkkkkkkkk
    `,
    5 + d,
    1,
  );
  // Button eyes (one droops), a tear, a trembling mouth.
  p.stamp(
    `
    ..k........k.
    .k..........k
    .kkk.....kkk.
    knnnk...knnnk
    knfnk...knfnk
    knnnk...knnnk
    .kkk.....kkk.
    ..a..........
    ..b...kkk....
    ..a..k...k...
    `,
    6 + d,
    10,
  );
  // The red bow on the cuff, half untied: one ribbon hangs loose.
  p.stamp(
    `
    .kk...kk.
    krrk.krrk
    krRrkrRrk
    krRrrrRrk
    krrkRkrrk
    .kkkRk.kk
    ..kRk....
    ..kRk....
    ...k.....
    `,
    16 + d,
    0,
  );
  if (f) p.stamp('~~~\n~~~\n~~~', 18, 6).stamp('kRk.\n.kRk\n..k.', 18, 6);
  return p.toString();
}

// Monstre du Placard (64x64, boss) — vieille armoire sombre entrouverte : deux yeux jaunes et un sourire de dents dans
// la fente, des crochets de cintres qui agrippent les portes de l'intérieur, une manche de sweat qui pend comme une
// langue. Liseré violet (lumière froide de la nuit) sur la droite.
function placard(f: number): string {
  const p = new Pix(64, 64);
  const gap = f ? 14 : 12;
  const L = 32 - gap / 2;
  const R = 32 + gap / 2;
  // Carcass.
  p.rect(3, 11, 58, 46, 'K');
  p.rect(3, 11, 1, 46, 'x');
  p.rect(60, 11, 1, 46, 'u');
  // Pediment with a carved crescent moon.
  p.poly([[14, 8], [22, 2], [42, 2], [50, 8]], 'x');
  p.rect(22, 2, 20, 1, 'C').line(14, 7, 21, 2, 'C').line(42, 2, 49, 7, 'K').line(43, 2, 50, 7, 'u');
  p.stamp(
    `
    ..QQ.
    .Q...
    .Q...
    ..QQ.
    `,
    29,
    3,
  );
  // Cornice.
  p.rect(0, 8, 64, 4, 'x').rect(0, 8, 64, 1, 'C').rect(0, 11, 64, 1, 'K').rect(63, 8, 1, 4, 'u').rect(1, 9, 1, 2, 'C');
  p.rect(2, 12, 60, 1, 'i');
  // Darkness between the doors.
  p.rect(L, 13, gap, 43, 'i');
  // Doors: lit left edge, shaded right edge, two inset panels each, door thickness visible at the gap.
  const door = (x0: number, x1: number, left: boolean) => {
    p.rect(x0, 13, x1 - x0, 43, 'x');
    p.rect(x0, 13, 1, 43, 'C').rect(x1 - 1, 13, 1, 43, 'K');
    for (const [y0, y1] of [[16, 32], [36, 52]] as Array<[number, number]>) {
      const a = x0 + 3;
      const b = x1 - 4;
      p.rect(a, y0, b - a + 1, 1, 'K').rect(a, y0, 1, y1 - y0 + 1, 'K');
      p.rect(a, y1, b - a + 1, 1, 'C').rect(b, y0, 1, y1 - y0 + 1, 'C');
      p.rect(a + 1, y0 + 1, 1, y1 - y0 - 1, 'C');
    }
    if (left) p.rect(x1, 13, 2, 43, 'K');
    else p.rect(x0 - 2, 13, 2, 43, 'i');
    const kx = left ? x1 - 3 : x0 + 1;
    p.stamp('.YY.\nYyyY\nYYYO\n.OO.', kx - 1, 32);
  };
  door(6, L - 2, true);
  door(R + 2, 58, false);
  p.rect(57, 13, 1, 43, 'u');
  // Eyes in the dark (frame 2: they narrow), and a jagged grin.
  const eye = f
    ? `
    .yyy.
    yyykk
    yyfkk
    .YYY.
    `
    : `
    .yyy.
    yykyy
    yfkyy
    .YYY.
    `;
  p.stamp(eye, L, 21).stamp(eye, R - 5, 21);
  p.stamp(
    f
      ? `
    ...........
    w.w.w.w.w.w
    .W.W.W.W.W.
    `
      : `
    w.w.w.w.w.w
    .W.W.W.W.W.
    ...........
    `,
    L + (gap - 11) / 2,
    29,
  );
  // Hanger hooks gripping the door edges from inside.
  const claw = `
    .gWWg..
    g....g.
    W....g.
    .g...g.
    .....G.
    .....G.
  `;
  const dy = f ? 1 : 0;
  for (const y of [15, 38]) p.stamp(claw, L - 6, y + dy);
  for (const y of [26, 44]) p.stamp(flipArt(claw), R - 1, y - dy);
  // Noa's lavender sleeve hanging out like a tongue.
  const sx = 30 + (f ? 1 : 0);
  for (let y = 40; y < 58; y++) {
    const x = sx + Math.round(Math.sin((y - 40) * 0.35 + f) * 1.2);
    p.set(x - 1, y, 'k').set(x, y, 'v').set(x + 1, y, 'v').set(x + 2, y, 'V').set(x + 3, y, 'u').set(x + 4, y, 'k');
  }
  // Plinth and carved feet.
  p.rect(1, 56, 62, 4, 'x').rect(1, 56, 62, 1, 'C').rect(1, 59, 62, 1, 'i').rect(62, 56, 1, 4, 'u');
  const foot = `
    kxxxxk
    kxKKxk
    .kxKk.
    ..kk..
  `;
  p.stamp(foot, 3, 60).stamp(foot, 55, 60);
  // Sleeve over the plinth, with its ribbed cuff.
  const ex = sx + Math.round(Math.sin(18 * 0.35 + f) * 1.2);
  p.stamp('kvvVuk\nkvvVuk\nkwWWWk\nkWgWgk\n.kkkk.', ex - 1, 56);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Chapitre 2 — La Forêt de Crayons
// ---------------------------------------------------------------------------------------------------------------------

// Taille-Crayon (40x36) — taille-crayon rouge furieux : le trou est une bouche aux dents de métal, copeaux en spirale.
const TAILLE_COLORS = { '6': '#f48a92' };
function tailleCrayon(f: number): string {
  const p = new Pix(40, 36);
  // Body: front face, top face, right side (3/4 view).
  p.rect(5, 9, 27, 22, 'r');
  p.poly([[5, 9], [10, 4], [37, 4], [32, 9]], '6');
  p.poly([[32, 9], [37, 4], [37, 26], [32, 31]], 'R');
  p.rect(5, 9, 27, 1, 'p').rect(5, 9, 1, 22, '6').rect(5, 30, 27, 1, 'R');
  p.line(32, 9, 37, 4, 'k').line(5, 9, 31, 9, 'k').line(32, 9, 32, 30, 'k');
  // Metal blade plate and its screw on the top face.
  p.poly([[19, 8], [22, 5], [33, 5], [30, 8]], 'g');
  p.line(19, 8, 29, 8, 'G').line(22, 5, 32, 5, 'W');
  p.stamp('.dd.\ndGWd\n.dd.', 24, 5);
  // Mouth: conical hole with metal teeth (frame 2 bites: the teeth close in).
  const cx = 18;
  const cy = 22;
  p.ellipse(cx, cy, 8, 7, 'k');
  p.ellipse(cx, cy, 7, 6, 'G');
  p.ellipse(cx, cy, 5.5, 4.5, 'd');
  p.ellipse(cx, cy, 4, 3, 'K');
  p.ellipse(cx, cy, 2, 1.5, 'i');
  const bite = f ? 1 : 0;
  p.stamp(
    `
    w.w.w.w.w
    .W.W.W.W.
    `,
    cx - 4,
    cy - 5 + bite,
  );
  p.stamp(
    `
    .w.w.w.w.
    W.W.W.W.W
    `,
    cx - 4,
    cy + 3 - bite,
  );
  // Furious eyes and brows.
  p.stamp(
    `
    kk..............kk
    .kkk..........kkk.
    ..kwwk......kwwk..
    ..kwkk......kkwk..
    ...kk........kk...
    `,
    cx - 9,
    10,
  );
  // Stubby feet.
  p.stamp('kKKk.............kKKk\nkkkk.............kkkk', 8, 31);
  // Pencil shavings: ruffled wood curls with a coloured rim.
  const shaving = (x: number, y: number, rim: string) =>
    p.stamp(
      `
      .${rim}.${rim}${rim}.
      ${rim}cc${rim}c${rim}
      ${rim}cCCc.
      .cCxCc${rim}
      ${rim}cCCc.
      .${rim}c${rim}${rim}.
      `,
      x,
      y,
    );
  if (f) {
    shaving(0, 24, 'y');
    shaving(33, 27, 'B');
    shaving(33, 0, 'L');
  } else {
    shaving(0, 27, 'y');
    shaving(34, 29, 'B');
    shaving(0, 0, 'L');
  }
  return p.toString();
}

// Avion en papier (46x34) — avion plié dans une feuille de cahier (lignes bleues, marge rose), farceur : clin d'œil.
function avion(f: number): string {
  const p = new Pix(46, 34);
  const t = f ? -2 : 0;
  // Far wing (shadow), keel, near wing (lit, lined paper).
  p.poly([[1, 21 + t], [43, 5], [41, 24]], 'g');
  p.poly([[1, 21 + t], [37, 21], [41, 32]], 'W');
  p.line(1, 21 + t, 41, 32, 'G');
  const wing = new Pix(46, 34).poly([[1, 21 + t], [45, 1], [36, 21]], 'w');
  for (const y of [5, 8, 11, 14, 17]) for (let x = 31; x < 46; x++) wing.paint(x, y, 'b');
  for (let y = 0; y < 34; y++) wing.paint(37, y, 'p');
  wing.rim('w', 'f', 0, -1, 1);
  p.blit(wing);
  p.line(1, 21 + t, 36, 21, 'G').line(36, 21, 45, 1, 'g');
  // Cheeky face on the near wing: a wink, a bright eye, a grin.
  p.stamp(
    f
      ? `
    ............
    .kkk....kkk.
    k...k..kffik
    .......kfiik
    ........kkk.
    ..k......k..
    ...kkkkkk...
    ....kRRk....
    `
      : `
    ............
    ........kkk.
    .kkkk..kffik
    k....k.kfiik
    ........kkk.
    ..k......k..
    ...kkkkkk...
    ....kRRk....
    `,
    15,
    9 + (f ? -1 : 0),
  );
  // Speed lines.
  p.stamp(f ? 'W.WW\n....\n.WWW' : 'WW.W\n....\nWW..', 42, 26 + t);
  return p.toString();
}

// Luciole Éteinte (36x36) — luciole dont la lanterne ne s'allume plus. Ailes transparentes, yeux mouillés.
// Frame 2 : une minuscule braise essaie de se rallumer.
const LUCIOLE_COLORS = { '6': '#c9e9f2', '7': '#8fbfd0' };
function luciole(f: number): string {
  const p = new Pix(36, 36);
  const d = f ? 1 : 0;
  // Wings (behind).
  const wing = new Pix(36, 36);
  // Long, thin wings angled up and out (lower pair smaller); frame 2 they droop.
  const up = d * 2;
  wing.poly([[15, 13], [6, 0 + up], [2, 1 + up], [0, 5 + up], [3, 9 + up], [12, 16]], '6');
  wing.poly([[21, 13], [30, 0 + up], [34, 1 + up], [36, 5 + up], [33, 9 + up], [24, 16]], '6');
  wing.poly([[13, 16], [5, 15 + d], [2, 18 + d], [4, 21 + d], [12, 19]], '6');
  wing.poly([[23, 16], [31, 15 + d], [34, 18 + d], [32, 21 + d], [24, 19]], '6');
  wing.line(13, 13, 4, 3 + up, 'w').line(23, 13, 32, 3 + up, 'w');
  wing.rim('6', '7', 0, 1, 1).rim('6', 'w', 0, -1, 1);
  p.blit(wing.contour('k'));
  // Lantern abdomen (dim), thorax, head.
  const body = new Pix(36, 36);
  body.ball(18, 26.5, 6.5, 8.5, ['q', 'g', 'G', 'd']);
  for (const y of [22, 26, 30]) for (let x = 0; x < 36; x++) if (body.get(x, y) !== '.' && body.get(x, y - 1) !== '.') body.set(x, y, body.get(x, y) === 'q' || body.get(x, y) === 'g' ? 'G' : 'd');
  body.ball(18, 18, 4, 3, ['V', 'u', 'u', 'K']);
  body.ball(18, 11, 7, 6.5, ['V', 'u', 'd', 'K']);
  p.blit(body.contour('k'));
  if (f) p.stamp('.Y.\nYyY\n.Y.', 17, 26);
  else p.set(18, 27, 'Q');
  // Sad, glossy eyes (heavy lids), small mouth.
  p.stamp(
    `
    .kkk...kkk.
    kuuuk.kuuuk
    kfiik.kiifk
    kiiik.kiiik
    .kkk...kkk.
    ..a.....a..
    ....kkk....
    `,
    13,
    8,
  );
  // Drooping antennae with dead bulbs.
  p.stamp(
    `
    .kk......kk.
    kGdk....kdGk
    .kk.k..k.kk.
    .....k.k....
    ......k.k...
    `,
    12 - 0,
    0,
  );
  // Little legs hugging the lantern.
  p.stamp('k.......k\n.k.....k.', 14, 21);
  return p.toString();
}

// Gomme (56x48, boss) — gomme rose géante dans son étui de carton bleu, usée, furieuse ; miettes et traces de mine.
const GOMME_COLORS = { '6': '#fcd6e3', '7': '#d3e3fb' };
function gomme(f: number): string {
  const p = new Pix(56, 48);
  const o = f ? 1 : 0;
  const sq = f ? 1 : 0;
  const top = 6 + sq;
  // Pink rubber block (front, top, worn left end).
  p.poly([[3, top + 10], [12, top], [54, top], [45, top + 10]], '6');
  p.rect(3 + o, top + 10, 42, 30 - sq, 'p');
  p.poly([[45, top + 10], [54, top], [54, top + 30 - sq], [45, top + 40 - sq]], 'P');
  // Worn corner: rounded, smudged with graphite.
  p.stamp(
    `
    ~~~
    ~~.
    ~..
    `,
    3 + o,
    top + 10,
  );
  p.stamp(
    `
    ~..
    ~~.
    ~~~
    `,
    3 + o,
    top + 37 - sq,
  );
  p.rect(3 + o, top + 38 - sq, 42, 2, 'P').rect(3 + o, top + 11, 1, 28 - sq, '6');
  // Graphite streaks: what it erased.
  for (const [x, y, n] of [[4, 19, 5], [4, 27, 4], [5, 34, 6], [12, 41, 4]] as Array<[number, number, number]>)
    for (let i = 0; i < n; i++) p.set(x + i + o, y + sq + (i >> 1), i % 3 === 2 ? 'd' : 'G');
  p.rect(4 + o, top + 10, 41, 1, 'f');
  // Blue cardboard sleeve on the right part.
  const sx = 25 + o;
  p.poly([[sx, top + 10], [sx + 9, top], [55, top], [46, top + 10]], '7');
  p.rect(sx, top + 10, 46 - sx, 30 - sq, 'b');
  p.poly([[46, top + 10], [55, top], [55, top + 30 - sq], [46, top + 40 - sq]], 'B');
  p.rect(sx, top + 13, 46 - sx, 2, 'w').rect(sx, top + 34 - sq, 46 - sx, 2, 'w');
  p.line(46, top + 13, 55, top + 3, 'W').line(46, top + 14, 55, top + 4, 'W');
  p.line(46, top + 34 - sq, 55, top + 24 - sq, 'g').line(46, top + 35 - sq, 55, top + 25 - sq, 'g');
  p.rect(sx, top + 10, 1, 30 - sq, 'n').line(sx, top + 10, sx + 9, top, 'n');
  // Star logo on the sleeve.
  p.stamp('..y..\n.yYy.\nyYYYy\n.y.y.', sx + 7, top + 20 - sq);
  // Edges.
  p.line(3 + o, top + 10, 45, top + 10, 'k').line(45, top + 10, 54, top, 'k').line(45, top + 10, 45, top + 39 - sq, 'k');
  // Furious face on the pink part.
  p.stamp(
    `
    kkk..........kkk
    .kkkk......kkkk.
    ...kkk....kkk...
    ..kwwwk..kwwwk..
    ..kwkwk..kwkwk..
    ...kkk....kkk...
    ................
    ..kkkkkkkkkkkk..
    .kwkwkwkwkwkwwk.
    .kwkwkwkwkwkwwk.
    ..kkkkkkkkkkkk..
    `,
    5 + o,
    top + 14,
  );
  p.stamp('PP\nP.', 7 + o, top + 22).stamp('PP\n.P', 16 + o, top + 22);
  // Crumbs.
  const crumbs: Array<[number, number]> = f ? [[1, 44], [6, 46], [12, 45], [49, 45], [3, 40]] : [[2, 45], [8, 44], [14, 46], [50, 44], [1, 38]];
  for (const [x, y] of crumbs) p.stamp('pP\nPP', x, y);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Chapitre 3 — L'Hôpital de Papier
// ---------------------------------------------------------------------------------------------------------------------

// Bip (40x50) — moniteur cardiaque vivant : écran vert où flottent deux yeux et une ligne de pouls, voyant d'alarme,
// câbles d'électrodes en guise de pattes. Frame 2 : le pic avance, l'alarme s'allume.
const BIP_COLORS = { '6': '#7cf5b0', '7': '#2f8f6a', '8': '#d6dbe0', '9': '#a9b0bb' };
function bip(f: number): string {
  const p = new Pix(40, 50);
  // Cables (behind), ending in round electrode pads.
  const cable = (x0: number, c: string, sway: number, x1: number) => {
    for (let y = 30; y < 45; y++) {
      const x = x0 + Math.round(Math.sin((y - 30) * 0.4 + sway) * 1.5) + Math.round(((x1 - x0) * (y - 30)) / 15);
      p.set(x, y, c).set(x + 1, y, 'k');
    }
    const ex = x1 + Math.round(Math.sin(15 * 0.4 + sway) * 1.5);
    p.stamp('.kkk.\nkwWgk\nkWggk\n.kkk.', ex - 2, 45);
  };
  cable(11, 'w', f ? 1 : 0, 6);
  cable(19, 'r', f ? 2.5 : 1.5, 19);
  cable(27, 'e', f ? 0 : 1, 32);
  // Casing with rounded corners, light from the top-left.
  const box = new Pix(40, 50);
  box.rect(3, 6, 34, 26, '8');
  box.stamp('~~\n~.', 3, 6).stamp('~~\n.~', 35, 6).stamp('~.\n~~', 3, 30).stamp('.~\n~~', 35, 30);
  box.rim('8', 'w', 0, -1, 1).rim('8', 'w', -1, 0, 1).rim('8', '9', 1, 0, 2).rim('8', '9', 0, 1, 2);
  p.blit(box.contour('k'));
  // Alarm dome on top.
  p.stamp(f ? '.kkkk.\nkoyyok\nkrrrrk\nkkkkkk' : '.kkkk.\nkRppRk\nkRRRRk\nkkkkkk', 17, 2);
  if (f) p.stamp('y......y\n.y....y.', 14, 0);
  // Screen.
  p.rect(7, 9, 26, 17, 'k').rect(8, 10, 24, 15, 'Z');
  for (let y = 11; y < 25; y += 2) p.rect(8, y, 24, 1, 'z');
  // Wide, frightened eyes.
  p.stamp(
    `
    6666....6666
    6..6....6..6
    6.76....6.76
    6666....6666
    `,
    14,
    12,
  );
  // Pulse line (the mouth), with the spike moving along.
  const spike = f ? 23 : 15;
  for (let x = 9; x < 31; x++) {
    let y = 21;
    if (x === spike) y = 18;
    if (x === spike + 1) y = 23;
    if (x === spike - 1) y = 20;
    p.set(x, y, x < spike - 1 ? '7' : '6');
    if (x === spike) p.set(x, 19, '6').set(x, 20, '6');
    if (x === spike + 1) p.set(x, 22, '6');
  }
  // Buttons under the screen.
  p.stamp('kk.kk....9d9.9d9', 8, 27);
  p.set(9, 27, f ? 'r' : 'R').set(12, 27, 'L');
  return p.toString();
}

// Perfusion (32x60) — pied à perfusion : la poche est sa tête (yeux tristes, gommette en cœur), la tubulure s'enroule
// autour du pied, un bracelet d'hôpital noué comme un ruban. Frame 2 : la goutte tombe.
const PERF_COLORS = { '6': '#dff8f3', '7': '#8fd6cc' };
function perfusion(f: number): string {
  const p = new Pix(32, 60);
  const sw = f ? 1 : 0;
  // Pole, T-bar with curled hooks, star base on wheels.
  p.rect(15, 8, 2, 46, 'g').rect(15, 8, 1, 46, 'W').rect(16, 8, 1, 46, 'G');
  p.rect(6, 6, 20, 1, 'g').rect(6, 7, 20, 1, 'G');
  p.stamp('.g\ng.\ng.\n.g', 4, 4).stamp('g.\n.g\n.g\ng.', 26, 4);
  p.stamp(
    `
    ......kGGk......
    ....kGGkkGGk....
    ..kGGk....kGGk..
    kGGk........kGGk
    kddk........kddk
    .kk..........kk.
    `,
    8,
    53,
  );
  // Tubing spiralling around the pole.
  for (let y = 36; y < 52; y++) {
    const x = 16 + Math.round(Math.sin((y - 36) * 0.55 + sw * 0.8) * 4);
    p.set(x, y, '7');
  }
  // Hospital bracelet tied around the pole like a ribbon.
  p.stamp('kwwwk\nkwpwk\n.kk..\n.k.k.', 13, 42);
  // The bag (her head): translucent, partly empty, sad face, Mina's heart sticker.
  const bag = new Pix(32, 60);
  bag.rect(7 + sw, 10, 18, 20, 'a');
  bag.ellipse(16 + sw, 29, 9, 3, 'a');
  bag.stamp('~~\n~.', 7 + sw, 10).stamp('~~\n.~', 23 + sw, 10);
  bag.rect(8 + sw, 11, 16, 6, '6');
  bag.rim('a', 'A', 1, 0, 1).rim('a', 'A', 0, 1, 1).rim('6', 'w', -1, 0, 1).rim('a', 'w', -1, 0, 1);
  p.blit(bag.contour('k'));
  p.stamp('.kk.\nk..k', 14 + sw, 6);
  p.stamp(
    `
    ..kk..kk..
    kk......kk
    .kkk..kkk.
    .kik..kik.
    .A......A.
    .A..kk....
    ...k..k...
    `,
    11 + sw,
    16,
  );
  // Label and heart sticker.
  p.stamp('kkkkkk\nkwGGwk\nkwwwwk\nkkkkkk', 9 + sw, 24);
  p.stamp('pp.pp\nPpppP\n.PpP.\n..P..', 18 + sw, 23);
  // Drip chamber and the falling drop.
  p.stamp('.kk.\nkwak\nkaak\nkaak\n.kk.', 14 + sw, 31);
  p.set(15 + sw, f ? 34 : 32, 'B');
  p.set(15 + sw, 36, '7').set(15 + sw, 37, '7');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Dodo — le mouton en peluche de Mina, immense (même dessin que npc_dodo). Puis sa forme corrompue (phase 2).
// ---------------------------------------------------------------------------------------------------------------------

function dodo(f: number, dark: boolean): string {
  // The corrupted form is bigger ("il grandit"): 72x72 instead of 64x64.
  const S = dark ? 72 : 64;
  const o = (S - 64) / 2;
  const p = new Pix(S, S);
  const b = f ? 1 : 0;
  const cx = S / 2;
  const cy = 35 + o * 2;
  const fy = 31 + o * 2 + b; // face centre
  const X = (x: number) => x + o;
  // Grey stubby feet (like the plush).
  const feet = dark ? 'kddk\nkKKk\n.kk.' : 'kGGk\nkddk\n.kk.';
  p.stamp(feet, X(20), S - 5).stamp(feet, X(40), S - 5);
  // Wool: a big ball with a scalloped edge, shaded as one volume.
  const rx = 27 + o + b;
  const ry = 23 + o - b;
  const bumps: Array<[number, number, number]> = [[cx, cy, 22 + o]];
  for (let a = 0; a < 360; a += dark ? 20 : 24) {
    const t = (a * Math.PI) / 180;
    bumps.push([cx + Math.cos(t) * (rx - 6), cy + Math.sin(t) * (ry - 5), 7]);
    // Matted tufts sticking out of the corrupted wool.
    if (dark && (a / 20) % 2 === 1) bumps.push([cx + Math.cos(t) * (rx - 1), cy + Math.sin(t) * (ry + 1), 2.5]);
  }
  const WOOL: Ramp = dark ? ['G', 'd', 'K', 'K'] : ['f', 'w', 'W', 'g'];
  const wool = new Pix(S, S).blob(bumps, WOOL, [cx, cy, rx, ry], 0.5, [0.82, 0.25, -0.3]);
  wool.curls(dark ? 9 : 4, 70, 6, 14, S - 6, S - 6, dark ? { G: 'g', d: 'G', K: 'd' } : { w: 'W', W: 'g' });
  if (dark) {
    // Cold purple rim light from the void, below-right.
    wool.rim('K', 'u', 1, 1, 1).rim('d', 'V', 1, 1, 1);
    // Ink stains soaking the wool.
    const rnd = seeded(77);
    for (let i = 0; i < 9; i++) {
      const x = 8 + rnd() * (S - 16);
      const y = 18 + rnd() * (S - 26);
      const r = 1.5 + rnd() * 2.5;
      for (let yy = -4; yy <= 4; yy++)
        for (let xx = -4; xx <= 4; xx++) if (xx * xx + yy * yy * 1.4 <= r * r) wool.paint(x + xx, y + yy, rnd() < 0.85 ? 'i' : 'u');
    }
  }
  p.blit(wool.contour('k'));
  // Ears (sticking out sideways).
  const ear = dark
    ? `
    ...kkkk.
    ..kRRRRk
    .kRiiRRk
    kRRRRRk.
    .kkkkk..
    `
    : `
    ....kkkk.
    ..kkppppk
    .kpPPPppk
    kppPPpppk
    kpppppkk.
    .kkkkk...
    `;
  p.stamp(ear, X(1), fy - 4).stamp(flipArt(ear), X(54), fy - 4);
  // Face: grey oval with its own outline; a fringe of wool on the forehead casts a soft shadow.
  const skin = dark ? 'd' : 'g';
  const skinShade = dark ? 'K' : 'G';
  const face = new Pix(S, S);
  face.ellipse(cx, fy, 15, 12, skin);
  face.rim(skin, skinShade, 1, 1, 2);
  p.blit(face.contour('k'));
  const fringe = new Pix(S, S).blob(
    [[cx - 9, fy - 11, 4], [cx - 4, fy - 12, 4.5], [cx + 2, fy - 12, 4.5], [cx + 8, fy - 11, 4]],
    WOOL,
    [cx, fy - 13, 14, 5],
    0.6,
  );
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) if (fringe.solid(x, y) && !fringe.solid(x, y + 1) && (p.get(x, y + 1) === skin || p.get(x, y + 1) === skinShade)) p.set(x, y + 1, skinShade);
  p.blit(fringe);
  if (!dark) {
    // Button eyes, pink cheeks, a little stitched smile.
    const eye = `
      .kkkk.
      kKKKKk
      kKfKKk
      kKKKKk
      kKKKKk
      .kkkk.
    `;
    p.stamp(eye, cx - 10, fy - 5).stamp(eye, cx + 4, fy - 5);
    p.stamp('pPp\npPp', cx - 13, fy + 3).stamp('pPp\npPp', cx + 10, fy + 3);
    p.stamp('G...G\n.G.G.\n..G..', cx - 2, fy + 3);
  } else {
    // Empty white eyes crying ink, a stitched smile far too wide.
    const eye = `
      ..kkk..
      .kwwwk.
      kwwffwk
      kwwwwwk
      kwwwwwk
      .kwwwk.
      ..kkk..
    `;
    p.stamp(eye, cx - 11, fy - 6).stamp(eye, cx + 4, fy - 6);
    p.stamp(f ? 'ii\n.i\n.i\n.i\n.i' : 'ii\n.i\n.i\n.i', cx - 9, fy).stamp(f ? 'ii\ni.\ni.\ni.' : 'ii\ni.\ni.\ni.\ni.', cx + 7, fy);
    p.stamp(
      `
      k...................k
      kk.................kk
      .kk...............kk.
      ..kkkkkkkkkkkkkkkkk..
      ..kwRwwRwwRwwRwwRwk..
      ...kkkkkkkkkkkkkkk...
      `,
      cx - 10,
      fy + 1,
    );
  }
  // Bow on the right ear.
  p.stamp(
    dark
      ? `
    .kkkk...kkkk.
    kRRRRk.kRrRRk
    kRiiRRkRRiiRk
    kRRRRRiRRRRRk
    kRRRRkikRRRRk
    .kkkk.i.kkkk.
    ......i......
    `
      : `
    .kkkk...kkkk.
    kppppk.kppppk
    kpPPppkppPPpk
    kpPpppPpppPpk
    kppppkPkppppk
    .kkkk.k.kkkk.
    `,
    X(43),
    fy - 21,
  );
  if (!dark) {
    // Plush tag with a heart on the side, belly seam.
    p.stamp('kkkk\nkwwk\nkwrk\nkwwk\nkkkk', 56, 44 - b);
    for (let y = 46; y < 56; y += 2) p.set(cx, y - b, 'W');
  } else {
    // Torn seam on the side: stuffing and darkness spill out.
    p.stamp(
      `
      ..k.k.k..
      .kWkWkWk.
      kWiiiiiWk
      kiiiiiiik
      kWiiiiiWk
      .kWkWkWk.
      ..k.k.k..
      `,
      X(46),
      X(44) - b,
    );
    // Ink drips under the body (rounded drops).
    const drips: Array<[number, number]> = f ? [[16, 5], [25, 3], [34, 7], [44, 4], [52, 2]] : [[16, 3], [25, 6], [34, 4], [44, 7], [52, 5]];
    for (const [x0, n] of drips) {
      const x = X(x0);
      let y = S - 6;
      while (y > 0 && !p.solid(x, y)) y--;
      for (let i = 1; i <= n; i++) p.set(x, y + i, 'i').set(x + 1, y + i, i < n ? 'i' : '.');
      p.set(x, y + n + 1, 'i').set(x - 1, y + n, 'i');
    }
    // Glitch: a few rows slide sideways.
    const shifts: Array<[number, number, number]> = f ? [[20, 3, 2], [47, 2, -2]] : [[29, 2, -2], [53, 2, 3]];
    for (const [y, h, dx] of shifts) p.move(0, y, S, h, dx, 0);
  }
  return p.toString();
}

// Moutons-projectiles de Dodo (on les compte en sautant la barrière).
const SHEEP = `
  ....kkkk....
  ..kkwwwwk.k.
  .kwwwwwwwkdk
  kwwwwwwwkddk
  kwwwwwwwkdwk
  kWwwwwwWkddk
  .kWWWWWgkkk.
  kdkkkkkkdk..
  kk......kdk.
  ..........k.
`;
const SHEEP_BIG = `
  .....kkkkk......
  ...kkwwwwwk.kk..
  ..kwwwwwwwwkpdk.
  .kwwwwwwwwwkddk.
  kwwwwwwwwwkdddk.
  kwwwwwwwwwkdwdk.
  kWwwwwwwwWkdddk.
  kWWwwwwwWWWkkk..
  .kWWWWWWWWgk....
  ..kggggggggk....
  .kdkkkkkkkdk....
  kdk.......kdk...
  kk.........kdk..
  .............k..
`;

// ---------------------------------------------------------------------------------------------------------------------
// Overworld (≈16x16 with the outline): small, readable, cute but a little menacing. _2 = idle frame.
// ---------------------------------------------------------------------------------------------------------------------

function owGribouille(f: number): string {
  const p = new Pix(13, 12);
  p.ellipse(6.5, 6.5, 6, 5.5, 'i');
  const ph = f ? 1.5 : 0;
  for (let t = 0; t < Math.PI * 6; t += 0.05) {
    const r = 5.5 - t * 0.18 + Math.sin(t * 2 + ph) * 0.6;
    const x = 6.5 + Math.cos(t) * r;
    const y = 6.5 + Math.sin(t) * r * 0.9;
    p.set(Math.floor(x), Math.floor(y), (x - 6.5) + (y - 6.5) < -3 ? 'g' : 'G');
  }
  p.stamp('www.www\nwkw.wkw\nwww.www', 3, 3);
  p.set(f ? 9 : 3, 0, 'G').set(f ? 10 : 2, 0, 'G');
  return p.toString();
}

function owNuage(f: number): string {
  const p = new Pix(15, 13);
  p.blob([[4, 6, 3.5], [8, 4.5, 4.2], [11.5, 6.5, 3], [6, 8, 3.2], [10, 8, 3]], ['6', '7', '8', '9'], [7.5, 6.5, 7, 4.5], 0.4);
  p.stamp('k...k\nk...k\nb....', 5, 5);
  p.stamp('.kk.', 6, 8);
  const drops = f ? [[3, 11], [7, 12], [11, 11]] : [[4, 12], [8, 11], [12, 12]];
  for (const [x, y] of drops) p.set(x!, y!, 'b');
  return p.toString();
}

function owMoutonNoir(f: number): string {
  const p = new Pix(14, 14);
  p.blob([[4, 7, 3.5], [7, 5.5, 4], [10, 7, 3.5], [5, 9.5, 3.5], [9, 9.5, 3.5]], ['G', 'd', 'K', 'K'], [7, 8, 6.5, 5], 0.4);
  p.stamp(
    `
    rr.......rr
    r.rkkkkkr.r
    rRkKKKKKkRr
    .kKwKKKwKk.
    .kKrKKKrKk.
    ..kKdddKk..
    ...kkkkk...
    `,
    1 + 0,
    3,
  );
  const legs = f ? '.K....K.\n.i....i.' : 'K......K\ni......i';
  p.stamp(legs, 3, 12);
  if (f) p.set(0, 2, 'w').set(13, 2, 'w');
  return p.toString();
}

function owPissenlit(f: number): string {
  const p = new Pix(13, 18);
  const cy = 5 + (f ? 1 : 0);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 13; x++) {
      const dx = x + 0.5 - 6.5;
      const dy = y + 0.5 - cy;
      const a = Math.atan2(dy, dx) + (f ? 0.2 : 0);
      if (Math.hypot(dx, dy) > 5.2 + 0.9 * Math.cos(a * 8)) continue;
      const l = dx * 0.6 + dy * 0.8;
      p.set(x, y, l < -2.5 ? 'q' : l < 1.5 ? 'y' : 'Y');
    }
  p.stamp('k...k\n.....\n.kRk.', 4, cy - 1);
  p.rect(6, 11, 1, 6, 'L').rect(7, 11, 1, 6, 'e');
  p.stamp(f ? 'L.....L\nLL...LL\n.LL.LL.' : '.......\nLL...LL\n.LLeLL.', 3, 12);
  p.stamp('.eLLe.', 4, 17);
  return p.toString();
}

const OW_CHAUSSETTE = `
  wbwbwbw.kk.
  WBWBWBWkrrk
  6bbbbbB.kRk
  6bwbbbB..k.
  6kbbbkB....
  6bbbbbB....
  6bbkbbB....
  6bbbbbbbB..
  6bwbbbbwbB.
  6bbbbbbbbBB
  .BBBBBBBBB.
`;

const OW_PLACARD = `
  ...xCCCCx...
  CCCCCCCCCCCC
  xxxxxxxxxxxx
  KCxxxiixxxCK
  KCxxyiiyxxCK
  KCxxxiixxxCK
  KCxxxiixxxCK
  KCxYxiixYxCK
  KCxxxiixxxCK
  KCxxgiigxxCK
  KCxxxiixxxCK
  KCxxxiixxxCK
  xxxxxxxxxxxx
  CCCCCCCCCCCC
  .x........x.
`;

const OW_TAILLE = `
  ..666666666.
  .66gggg666RR
  rrrrrrrrrrRR
  rkkrrrrrkkRR
  rrwkrrrkwrRR
  rrrkGGGkrrRR
  rrkGiiiGkrRR
  rrkwiiiwkrR.
  rrrkGGGkrrR.
  RRRRRRRRRRR.
  .kk.....kk..
`;

const OW_AVION = `
  ..............ww
  ...........wwwfw
  ........wwwwbbw.
  .....wwwkwwbbw..
  ..wwwwkwwwwwwG..
  wwwwwwwwwwwwG...
  .WWWWkkkWWGW....
  ...WWWWWWWWg....
  .......WWWgg....
  ...........g....
`;

function owLuciole(f: number): string {
  const p = new Pix(13, 13);
  const d = f ? 1 : 0;
  p.ellipse(2.5, 3 + d, 2.5, 3, '6').ellipse(10.5, 3 + d, 2.5, 3, '6');
  p.ball(6.5, 9, 3.5, 3.5, ['q', 'g', 'G', 'd']);
  p.ball(6.5, 4, 3, 3, ['V', 'u', 'u', 'K']);
  p.stamp('k.k\nf.f', 5, 3);
  p.set(6, 9, f ? 'y' : 'Q');
  if (f) p.set(5, 9, 'Y').set(7, 9, 'Y').set(6, 8, 'Y').set(6, 10, 'Y');
  p.stamp('k...k\n.k.k.', 4, 0);
  return p.toString();
}

const OW_GOMME = `
  ...6666666777777
  ..66666666777777B
  .pppppppppbbbbbBB
  .pkkppkkppwwwwwBB
  .pkwppwkppbbbbbBB
  .ppppppppbbbyybBB
  .ppkkkkkppbbbbbBB
  .ppkwkwkppwwwwwBB
  .PPPPPPPPbbbbbbB.
  ..PPPPPPPBBBBBB..
`;

const OW_BIP = `
  ....rr....
  .88888888.
  8wwwwwwww9
  8wkkkkkkw9
  8wZ6ZZ6Zw9
  8wZZZZZZw9
  8w6667666w9
  8wkkkkkkw9
  8999999999
  .w..r..e..
  .w..r...e.
  w...r...e.
  W...W...W.
`;

const OW_PERFUSION = `
  g.......g.
  ggggggggg.
  ....g.....
  ..666666..
  ..666666A.
  ..aaaaaaA.
  ..akaaakA.
  ..aaaaaaA.
  ..aappaaA.
  ...aaaaA..
  .....a....
  ....ga....
  ....g7....
  ....g.7...
  ....g7....
  ....g.....
  ..GGgGG...
  .d.....d..
`;

// Dodo on the map: the same plush as npc_dodo, with a glint in its button eyes.
const OW_DODO = `
  ..........kk.kk.
  ....kk.kk.kpPpk.
  ...kwwkwwkwkPkk.
  ..kwwwwwwwwwkk..
  .kwwwwwwwwwwWWk.
  kpkwwGGGGGGwWkpk
  kppkGggggggGkppk
  .kkwGfkggfkGWkk.
  ..kwGkkggkkGWk..
  ..kwGpggggpGWk..
  .kwwwGgkkgGWWWk.
  .kwwwwGGGGWWWWk.
  .kwwwwwwwwwWWWk.
  ..kWwwwwwwWWgk..
  ...kkWWWWWggk...
  .....kkkkkkk....
`;
const OW_DODO_2 = `
  ................
  ..........kk.kk.
  ....kk.kk.kpPpk.
  ..kkwwkwwkwkPkk.
  .kwwwwwwwwwwkWk.
  kpkwwGGGGGGwWkpk
  kppkGggggggGkppk
  .kkwGkkggkkGWkk.
  .kwwGkfggkfGWWk.
  kwwwGpggggpGWWWk
  kwwwwGgkkgGWWWgk
  .kwwwwGGGGWWWWk.
  .kwwwwwwwwwWWWk.
  ..kWwwwwwwWWgk..
  ...kkWWWWWggk...
  .....kkkkkkk....
`;

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  b_nuage: { art: nuage(0), outline: 'k', colors: NUAGE_COLORS },
  b_nuage_2: { art: nuage(1), outline: 'k', colors: NUAGE_COLORS },
  b_gribouille: { art: gribouille(0), outline: 'k' },
  b_gribouille_2: { art: gribouille(1), outline: 'k' },
  b_mouton_noir: { art: moutonNoir(0), outline: 'k' },
  b_mouton_noir_2: { art: moutonNoir(1), outline: 'k' },
  b_pissenlit: { art: pissenlit(0), outline: 'k' },
  b_pissenlit_2: { art: pissenlit(1), outline: 'k' },
  b_chaussette_perdue: { art: chaussette(0), outline: 'k', colors: CHAUSSETTE_COLORS },
  b_chaussette_perdue_2: { art: chaussette(1), outline: 'k', colors: CHAUSSETTE_COLORS },
  b_placard: { art: placard(0), outline: 'k' },
  b_placard_2: { art: placard(1), outline: 'k' },
  b_taille_crayon: { art: tailleCrayon(0), outline: 'k', colors: TAILLE_COLORS },
  b_taille_crayon_2: { art: tailleCrayon(1), outline: 'k', colors: TAILLE_COLORS },
  b_avion: { art: avion(0), outline: 'k' },
  b_avion_2: { art: avion(1), outline: 'k' },
  b_luciole: { art: luciole(0), outline: 'k', colors: LUCIOLE_COLORS },
  b_luciole_2: { art: luciole(1), outline: 'k', colors: LUCIOLE_COLORS },
  b_gomme: { art: gomme(0), outline: 'k', colors: GOMME_COLORS },
  b_gomme_2: { art: gomme(1), outline: 'k', colors: GOMME_COLORS },
  b_bip: { art: bip(0), outline: 'k', colors: BIP_COLORS },
  b_bip_2: { art: bip(1), outline: 'k', colors: BIP_COLORS },
  b_perfusion: { art: perfusion(0), outline: 'k', colors: PERF_COLORS },
  b_perfusion_2: { art: perfusion(1), outline: 'k', colors: PERF_COLORS },
  b_dodo: { art: dodo(0, false), outline: 'k' },
  b_dodo_2: { art: dodo(1, false), outline: 'k' },
  b_dodo_dark: { art: dodo(0, true), outline: 'k' },
  b_dodo_dark_2: { art: dodo(1, true), outline: 'k' },
  b_sheep: SHEEP,
  b_sheep_big: SHEEP_BIG,

  ow_gribouille: { art: owGribouille(0), outline: 'k' },
  ow_gribouille_2: { art: owGribouille(1), outline: 'k' },
  ow_nuage: { art: owNuage(0), outline: 'k', colors: NUAGE_COLORS },
  ow_nuage_2: { art: owNuage(1), outline: 'k', colors: NUAGE_COLORS },
  ow_mouton_noir: { art: owMoutonNoir(0), outline: 'k' },
  ow_mouton_noir_2: { art: owMoutonNoir(1), outline: 'k' },
  ow_pissenlit: { art: owPissenlit(0), outline: 'k' },
  ow_pissenlit_2: { art: owPissenlit(1), outline: 'k' },
  ow_chaussette_perdue: { art: OW_CHAUSSETTE, outline: 'k', colors: CHAUSSETTE_COLORS },
  ow_chaussette_perdue_2: { art: Pix.of(OW_CHAUSSETTE).move(0, 0, 8, 7, 1, 0).toString(), outline: 'k', colors: CHAUSSETTE_COLORS },
  ow_placard: { art: OW_PLACARD, outline: 'k' },
  ow_placard_2: { art: Pix.of(OW_PLACARD).recolor({ y: 'Y' }).stamp('.....iiii', 0, 4).stamp('....yiiy', 0, 5).toString(), outline: 'k' },
  ow_taille_crayon: { art: OW_TAILLE, outline: 'k', colors: TAILLE_COLORS },
  ow_taille_crayon_2: { art: Pix.of(OW_TAILLE).stamp('...w.w.', 2, 6).stamp('...w.w.', 2, 8).toString(), outline: 'k', colors: TAILLE_COLORS },
  ow_avion: { art: OW_AVION, outline: 'k' },
  ow_avion_2: { art: Pix.of(OW_AVION).set(8, 3, 'G').toString(), outline: 'k', ay: 11 },
  ow_luciole: { art: owLuciole(0), outline: 'k', colors: LUCIOLE_COLORS },
  ow_luciole_2: { art: owLuciole(1), outline: 'k', colors: LUCIOLE_COLORS },
  ow_gomme: { art: OW_GOMME, outline: 'k', colors: GOMME_COLORS },
  ow_gomme_2: { art: Pix.of(OW_GOMME).recolor({ w: 'k' }, 3, 4, 7, 4).stamp('pP.....Pp', 0, 9).toString(), outline: 'k', colors: GOMME_COLORS },
  ow_bip: { art: OW_BIP, outline: 'k', colors: BIP_COLORS },
  ow_bip_2: { art: Pix.of(OW_BIP).stamp('ry', 4, 0).stamp('6667', 2, 6).stamp('.e...', 5, 9).toString(), outline: 'k', colors: BIP_COLORS },
  ow_perfusion: { art: OW_PERFUSION, outline: 'k', colors: PERF_COLORS },
  ow_perfusion_2: { art: Pix.of(OW_PERFUSION).move(2, 3, 7, 7, 1, 0).set(5, 11, 'b').toString(), outline: 'k', colors: PERF_COLORS },
  ow_dodo: OW_DODO,
  ow_dodo_2: OW_DODO_2,
};

// Corrupted overworld versions for the ink world (chapter 3 ruins: chapter 1–2 enemies soaked in ink). Battle sprites
// are never variant-swapped, and the chapter 3 enemies (and Dodo) are already drawn for that world.
for (const k of Object.keys(ART)) {
  if (!k.startsWith('ow_') || /^ow_(bip|perfusion|dodo)/.test(k)) continue;
  const def = ART[k]!;
  ART[`${k}@ink`] = typeof def === 'string' ? { art: def, transform: corrupt } : { ...def, transform: corrupt };
}

export const VARIANTS: string[] = [];

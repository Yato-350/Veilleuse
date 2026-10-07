/**
 * Full-screen illustrations drawn with canvas code (320x180).
 *
 * Everything is painted with integer `fillRect` calls (one per pixel or per horizontal run). Each illustration is
 * split into a static layer (rendered once, cached in an offscreen canvas) and a few cheap animated overlays driven
 * by the frame counter `t` (rain, flicker, scanlines, twinkling…). All randomness comes from a local hash so the
 * drawings are identical from frame to frame and from one session to the next.
 *
 * Two families:
 *  - Mina's drawings (carnet_*, souvenir_dessin): an 8-year-old's crayon drawings on paper — wobbly outlines,
 *    scribbled fills that spill over the lines, waxy grain, bright colours, childlike handwriting.
 *  - Real memories and endings: quiet, dark pixel scenes (dithered gradients, few light sources).
 */
import { drawText, measure } from '../engine/font';
import { PAL } from '../engine/palette';
import { ctx2d, makeCanvas, parseRows } from '../engine/sprite';

export type Illustration = (g: CanvasRenderingContext2D, t: number) => void;

type Ctx = CanvasRenderingContext2D;
/** Shape predicate, evaluated at pixel centres. */
type Pred = (x: number, y: number) => boolean;
/** Bounding box [x0, y0, x1, y1] (x1/y1 exclusive). */
type BBox = [number, number, number, number];

const SW = 320;
const SH = 180;

// ---------------------------------------------------------------------------------------------------------------
// Deterministic noise
// ---------------------------------------------------------------------------------------------------------------

/** Integer hash → [0, 1). */
function hash(x: number, y = 0, seed = 0): number {
  let h = Math.imul((x | 0) ^ 0x3c6ef372, 0x85ebca6b) ^ Math.imul((y | 0) + 0x632be5ab, 0xc2b2ae35);
  h = (h + Math.imul(seed | 0, 0x27d4eb2f)) | 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. */
function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash(i, 0, seed) * (1 - u) + hash(i + 1, 0, seed) * u) * 2 - 1;
}

/** Smooth 2D value noise in [0, 1]. */
function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// 4x4 ordered dithering.
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;

/** Picks a colour along a ramp (v in [0, 1]) with ordered dithering between neighbouring steps. */
function ramp(cols: readonly string[], v: number, x: number, y: number): string {
  const p = clamp01(v) * (cols.length - 1);
  const i = Math.floor(p);
  const f = p - i;
  return f > bayer(x, y) ? cols[Math.min(i + 1, cols.length - 1)]! : cols[i]!;
}

// ---------------------------------------------------------------------------------------------------------------
// Pixel primitives
// ---------------------------------------------------------------------------------------------------------------

function rect(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function px(g: Ctx, x: number, y: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Paints a region pixel by pixel; horizontal runs of the same colour become a single fillRect. */
function field(g: Ctx, x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => string | null): void {
  for (let y = y0; y < y0 + h; y++) {
    let runC: string | null = null;
    let runX = x0;
    for (let x = x0; x <= x0 + w; x++) {
      const c = x < x0 + w ? fn(x, y) : null;
      if (c !== runC) {
        if (runC) {
          g.fillStyle = runC;
          g.fillRect(runX, y, x - runX, 1);
        }
        runC = c;
        runX = x;
      }
    }
  }
}

/** Bresenham line. */
function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, c: string): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = c;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
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
}

/** Draws a pixel-art block authored as text rows (palette characters, '.' = transparent). */
function art(g: Ctx, x: number, y: number, src: string, colors: Record<string, string> = {}): void {
  const rows = parseRows(src);
  rows.forEach((row, ry) => {
    let runC: string | null = null;
    let runX = 0;
    for (let rx = 0; rx <= row.length; rx++) {
      const ch = row[rx];
      const c = ch === undefined || ch === '.' || ch === ' ' ? null : (colors[ch] ?? PAL[ch] ?? null);
      if (c !== runC) {
        if (runC) {
          g.fillStyle = runC;
          g.fillRect(x + runX, y + ry, rx - runX, 1);
        }
        runC = c;
        runX = rx;
      }
    }
  });
}

/** Runs `fn` with the global alpha multiplied by `a` (keeps the scene's fade working). */
function withAlpha(g: Ctx, a: number, fn: () => void): void {
  const prev = g.globalAlpha;
  g.globalAlpha = prev * clamp01(a);
  fn();
  g.globalAlpha = prev;
}

// Static layers are rendered once and cached.
const layers = new Map<string, HTMLCanvasElement>();
function layer(key: string, paint: (g: Ctx) => void, w = SW, h = SH): HTMLCanvasElement {
  let c = layers.get(key);
  if (!c) {
    c = makeCanvas(w, h);
    paint(ctx2d(c));
    layers.set(key, c);
  }
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------------------------------

const ell =
  (cx: number, cy: number, rx: number, ry: number): Pred =>
  (x, y) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const boxP =
  (x0: number, y0: number, w: number, h: number): Pred =>
  (x, y) =>
    x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
/** Polygon (flat list of coordinates), even-odd rule. */
function poly(pts: readonly number[]): Pred {
  return (x, y) => {
    let inside = false;
    const n = pts.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i * 2]!;
      const yi = pts[i * 2 + 1]!;
      const xj = pts[j * 2]!;
      const yj = pts[j * 2 + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
const union =
  (...ps: Pred[]): Pred =>
  (x, y) =>
    ps.some((p) => p(x, y));
const minus =
  (a: Pred, b: Pred): Pred =>
  (x, y) =>
    a(x, y) && !b(x, y);
const inter =
  (a: Pred, b: Pred): Pred =>
  (x, y) =>
    a(x, y) && b(x, y);
/** Displaces a shape with low-frequency noise: hand-drawn wobble. */
function wob(p: Pred, amp: number, seed: number, freq = 0.12): Pred {
  return (x, y) =>
    p(
      x + (noise2(x * freq, y * freq, seed) - 0.5) * 2 * amp,
      y + (noise2(x * freq, y * freq, seed + 77) - 0.5) * 2 * amp,
    );
}

/** Rasterises a predicate over a bbox (+margin) into a lookup grid. */
function grid(p: Pred, bb: BBox, m = 3): (x: number, y: number) => boolean {
  const x0 = Math.floor(bb[0]) - m;
  const y0 = Math.floor(bb[1]) - m;
  const w = Math.ceil(bb[2]) + m - x0;
  const h = Math.ceil(bb[3]) + m - y0;
  const cells = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells[y * w + x] = p(x0 + x + 0.5, y0 + y + 0.5) ? 1 : 0;
  return (x, y) => {
    const gx = x - x0;
    const gy = y - y0;
    return gx >= 0 && gy >= 0 && gx < w && gy < h && cells[gy * w + gx] === 1;
  };
}

/** Solid fill of a shape. */
function fillP(g: Ctx, p: Pred, bb: BBox, c: string | ((x: number, y: number) => string | null)): void {
  const x0 = Math.floor(bb[0]);
  const y0 = Math.floor(bb[1]);
  field(g, x0, y0, Math.ceil(bb[2]) - x0, Math.ceil(bb[3]) - y0, (x, y) =>
    p(x + 0.5, y + 0.5) ? (typeof c === 'string' ? c : c(x, y)) : null,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Crayon kit (Mina's drawings)
// ---------------------------------------------------------------------------------------------------------------

const PAPER = '#fbf4e2';
const PAPER2 = '#f2e7cd';
const PAPER3 = '#e4d4b4';

/** Crayon colours: bright, waxy, a little off the game palette. */
const CR = {
  red: '#e2404c',
  redD: '#b52a3c',
  orange: '#f28a2e',
  orangeD: '#c9611f',
  yellow: '#f9cf3a',
  yellowD: '#e0a42a',
  green: '#4fae4f',
  greenL: '#97d466',
  greenD: '#2f8046',
  sky: '#7cb6f2',
  blue: '#3e78d6',
  navy: '#2c3f8f',
  purple: '#8a5bc9',
  lilac: '#bb98ea',
  pink: '#f37bb0',
  pinkL: '#f9b2cf',
  brown: '#9a5a34',
  brownL: '#d39a62',
  skin: '#f8c6a0',
  black: '#3b3346',
  gray: '#9b93a6',
  white: '#fffdf6',
} as const;

interface Pen {
  c: string;
  /** Stroke width (1–3). */
  w?: number;
  /** Wobble amplitude in px. */
  wob?: number;
  seed?: number;
  /** Probability that a pixel is skipped (waxy grain). */
  grain?: number;
}

function dot(g: Ctx, x: number, y: number, o: Pen): void {
  const w = o.w ?? 1;
  const xi = Math.round(x - (w - 1) / 2);
  const yi = Math.round(y - (w - 1) / 2);
  const grain = o.grain ?? 0.08;
  const seed = (o.seed ?? 1) + 501;
  g.fillStyle = o.c;
  for (let dy = 0; dy < w; dy++)
    for (let dx = 0; dx < w; dx++) {
      if (w > 2 && (dx === 0 || dx === w - 1) && (dy === 0 || dy === w - 1)) continue;
      if (hash(xi + dx, yi + dy, seed) >= grain) g.fillRect(xi + dx, yi + dy, 1, 1);
    }
}

/** Crayon polyline through a flat list of points, with a wobble that flows along the stroke. */
function pen(g: Ctx, pts: readonly number[], o: Pen): void {
  const seed = o.seed ?? 1;
  const amp = o.wob ?? 0.6;
  let dist = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i]!;
    const ay = pts[i + 1]!;
    const bx = pts[i + 2]!;
    const by = pts[i + 3]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const n = Math.ceil(len * 2);
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    for (let s = i === 0 ? 0 : 1; s <= n; s++) {
      const f = s / n;
      const off = amp * noise1((dist + len * f) * 0.16, seed);
      dot(g, ax + (bx - ax) * f + nx * off, ay + (by - ay) * f + ny * off, o);
    }
    dist += len;
  }
}

/** Crayon ellipse that does not quite close (the stroke overshoots, like a child's circle). */
function penEllipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, o: Pen & { over?: number; start?: number }): void {
  const seed = o.seed ?? 1;
  const over = o.over ?? 0.45;
  const a0 = o.start ?? -2.2;
  const steps = Math.max(12, Math.ceil((rx + ry) * 1.6));
  const total = Math.PI * 2 + over;
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = a0 + total * f;
    const r = 1 + 0.07 * noise1(f * 5, seed + 9) + 0.04 * f;
    pts.push(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r);
  }
  pen(g, pts, { ...o, wob: o.wob ?? 0.3 });
}

/** Outline of a shape drawn as a crayon line (1 or 2 px). */
function outline(g: Ctx, p: Pred, bb: BBox, c: string, o: { seed?: number; w?: number; grain?: number } = {}): void {
  const inside = grid(p, bb);
  const seed = (o.seed ?? 1) + 31;
  const w = o.w ?? 1;
  const grain = o.grain ?? 0.07;
  const x0 = Math.floor(bb[0]) - 1;
  const y0 = Math.floor(bb[1]) - 1;
  field(g, x0, y0, Math.ceil(bb[2]) + 1 - x0, Math.ceil(bb[3]) + 1 - y0, (x, y) => {
    if (!inside(x, y)) return null;
    let edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    if (!edge && w > 1) edge = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2) || !inside(x + 1, y + 1) || !inside(x - 1, y - 1);
    return edge && hash(x, y, seed) >= grain ? c : null;
  });
}

interface Scrib {
  seed?: number;
  /** Stroke direction (radians). */
  angle?: number;
  /** Stroke period (px) and colored part of it. */
  gap?: number;
  on?: number;
  /** How far the colour escapes the lines (px). */
  spill?: number;
  /** Probability that a pixel inside a stroke is skipped. */
  grain?: number;
  /** Probability that a pixel between strokes is coloured anyway. */
  fill?: number;
  /** Optional second colour for some pixels (pressure / layering). */
  c2?: string;
  /** Fraction of pixels using c2. */
  mix?: number;
  /** Large patches where the child pressed lightly (0 = none). */
  light?: number;
}

/** Scribbled crayon fill: wavy parallel strokes, grain, colour that spills over the outline. */
function scribble(g: Ctx, p: Pred, bb: BBox, c: string, o: Scrib = {}): void {
  const seed = o.seed ?? 1;
  const ang = o.angle ?? -0.75;
  const gap = o.gap ?? 3;
  const on = o.on ?? 2;
  const grain = o.grain ?? 0.12;
  const fillP2 = o.fill ?? 0.22;
  const light = o.light ?? 0.25;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const sp = o.spill === 0 ? p : wob(p, o.spill ?? 1.4, seed + 5, 0.22);
  const x0 = Math.floor(bb[0]) - 2;
  const y0 = Math.floor(bb[1]) - 2;
  field(g, x0, y0, Math.ceil(bb[2]) + 2 - x0, Math.ceil(bb[3]) + 2 - y0, (x, y) => {
    if (!sp(x + 0.5, y + 0.5)) return null;
    const u = x * sa - y * ca;
    const v = x * ca + y * sa;
    const ph = u + noise1(v * 0.13, seed) * 1.3;
    const m = ((ph % gap) + gap) % gap;
    const h = hash(x, y, seed + 13);
    const press = noise2(x * 0.09, y * 0.09, seed + 3) < light ? 0.35 : 0;
    const col = o.c2 && hash(x, y, seed + 17) < (o.mix ?? 0.2) ? o.c2 : c;
    if (m < on) return h < grain + press ? null : col;
    return h < fillP2 - press * 0.5 ? col : null;
  });
}

/** Childlike handwriting with the game font: letters bob up and down, spacing is uneven, strokes are thick. */
function scrawl(
  g: Ctx | null,
  text: string,
  x: number,
  y: number,
  c: string,
  o: { seed?: number; jit?: number; bold?: boolean; scale?: number; tilt?: number } = {},
): number {
  const seed = o.seed ?? 3;
  const jit = o.jit ?? 1;
  const s = o.scale ?? 1;
  let cx = x;
  let i = 0;
  for (const ch of text) {
    const dy = Math.round(noise1(i * 0.9, seed) * jit + (o.tilt ?? 0) * (cx - x));
    if (g && ch !== ' ') {
      drawText(g, ch, cx, y + dy, { color: c, shadow: null, scale: s });
      if (o.bold) drawText(g, ch, cx + 1, y + dy, { color: c, shadow: null, scale: s });
    }
    cx += (measure(ch) + 1) * s + (o.bold ? 1 : 0) + (hash(i, 7, seed) < 0.3 ? 1 : 0);
    i++;
  }
  return cx - x;
}

/** Sketchbook page on a dark desk: paper grain, spiral binding on the left, dog-eared corner. */
function sketchbook(g: Ctx, seed: number): void {
  // desk
  field(g, 0, 0, SW, SH, (x, y) => {
    const n = noise2(x * 0.02, y * 0.35, 4);
    return n < 0.35 ? '#1a1220' : n > 0.7 ? '#271b2c' : '#21172a';
  });
  // drop shadow
  rect(g, 12, 9, 304, 168, '#120c16');
  // page
  const px0 = 9;
  const py0 = 5;
  const pw = 304;
  const ph = 169;
  field(g, px0, py0, pw, ph, (x, y) => {
    // folded corner bottom-right
    const fx = x - (px0 + pw - 14);
    const fy = y - (py0 + ph - 14);
    if (fx + fy > 13) return null;
    if (fx > 0 && fy > 0 && fx + fy > 11) return PAPER3;
    const h = hash(x, y, seed);
    const n = noise2(x * 0.05, y * 0.05, seed + 1);
    if (h < 0.035 + n * 0.03) return PAPER2;
    if (h > 0.996) return PAPER3;
    // soft vignette on the edges
    const e = Math.min(x - px0, y - py0, px0 + pw - 1 - x, py0 + ph - 1 - y);
    if (e < 2 && bayer(x, y) < 0.5) return PAPER2;
    return PAPER;
  });
  // spiral binding
  for (let y = py0 + 7; y < py0 + ph - 6; y += 10) {
    rect(g, px0 + 4, y, 3, 3, '#3a2f40');
    px(g, px0 + 4, y, '#251c2b');
    // wire loop
    rect(g, px0 - 3, y - 1, 8, 1, '#9b96a8');
    rect(g, px0 - 4, y, 1, 2, '#6d6880');
    rect(g, px0 - 3, y + 2, 4, 1, '#5d5870');
    px(g, px0 - 2, y - 1, '#d8d4e2');
  }
}

/** Dust motes floating in lamp light over a page (cheap animated overlay). */
function motes(g: Ctx, t: number, n: number, seed: number, area: BBox, c = '#fff3cf'): void {
  const [x0, y0, x1, y1] = area;
  for (let i = 0; i < n; i++) {
    const sp = 0.05 + hash(i, 1, seed) * 0.08;
    const x = x0 + ((hash(i, 2, seed) * (x1 - x0) + Math.sin(t * 0.01 + i) * 6 + t * sp * 0.4) % (x1 - x0));
    const y = y0 + (((hash(i, 3, seed) * (y1 - y0) - t * sp) % (y1 - y0)) + (y1 - y0)) % (y1 - y0);
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.05 + i * 1.7));
    withAlpha(g, a, () => px(g, x, y, c));
  }
}

/** Four-point sparkle. */
function sparkle(g: Ctx, x: number, y: number, r: number, c: string): void {
  x = Math.round(x);
  y = Math.round(y);
  rect(g, x - r, y, r * 2 + 1, 1, c);
  rect(g, x, y - r, 1, r * 2 + 1, c);
}

// ---------------------------------------------------------------------------------------------------------------
// Crayon figures
// ---------------------------------------------------------------------------------------------------------------

interface KidOpts {
  /** Scale factor (1 = Mina ~52 px, Noa ~66 px tall). */
  s?: number;
  /** false = outlines only (unfinished drawing). */
  colored?: boolean;
  sword?: boolean;
  /** Arm polylines relative to the feet, in unscaled units. */
  armL?: number[];
  armR?: number[];
}

/** Maps relative (unscaled) coordinates around an origin. */
function rel(ox: number, oy: number, s: number): (...d: number[]) => number[] {
  return (...d) => d.map((v, i) => (i % 2 ? oy + v * s : ox + v * s));
}
function bbOf(pts: number[], m = 2): BBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]!);
    x1 = Math.max(x1, pts[i]!);
    y0 = Math.min(y0, pts[i + 1]!);
    y1 = Math.max(y1, pts[i + 1]!);
  }
  return [x0 - m, y0 - m, x1 + m, y1 + m];
}
/** Scribble + outline of a polygon in one call. */
function crayonPoly(g: Ctx, pts: number[], fill: string | null, ol: string | null, seed: number, o: Scrib & { wob?: number; w?: number } = {}): void {
  const p = wob(poly(pts), o.wob ?? 0.8, seed);
  const bb = bbOf(pts, 3);
  if (fill) scribble(g, p, bb, fill, { seed, ...o });
  if (ol) outline(g, p, bb, ol, { seed, w: o.w });
}
function crayonEll(g: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string | null, ol: string | null, seed: number, o: Scrib & { wob?: number; w?: number } = {}): void {
  const p = wob(ell(cx, cy, rx, ry), o.wob ?? 0.6, seed);
  const bb: BBox = [cx - rx - 3, cy - ry - 3, cx + rx + 3, cy + ry + 3];
  if (fill) scribble(g, p, bb, fill, { seed, ...o });
  if (ol) outline(g, p, bb, ol, { seed, w: o.w });
}
function hand(g: Ctx, x: number, y: number, s: number, seed: number, colored: boolean): void {
  if (colored) scribble(g, ell(x, y, 2 * s, 2 * s), [x - 4 * s, y - 4 * s, x + 4 * s, y + 4 * s], CR.skin, { seed, fill: 0.9, spill: 0 });
  penEllipse(g, x, y, 2 * s, 2 * s, { c: CR.black, seed: seed + 1, over: 0.2 });
}

/** Mina as she draws herself: pigtails, paper crown, red cape, white dress. Feet at (x, y). */
function kidMina(g: Ctx, x: number, y: number, seed: number, o: KidOpts = {}): void {
  const s = o.s ?? 1;
  const colored = o.colored ?? true;
  const F = rel(x, y, s);
  const hx = x;
  const hy = y - 38 * s;
  const Hd = rel(hx, hy, s);
  const ol = CR.black;
  const lw = s >= 1.3 ? 2 : 1;
  // cape (behind)
  crayonPoly(g, F(-6, -28, 6, -28, 15, -6, -15, -6), colored ? CR.red : null, CR.redD, seed, { angle: -1.1, c2: CR.redD, mix: 0.15 });
  // dress
  crayonPoly(g, F(-5, -28, 5, -28, 9, -9, -9, -9), colored ? CR.white : null, CR.pink, seed + 1, { fill: 0.5, spill: 0.5 });
  if (colored) pen(g, F(-7, -13, -3, -12, 0, -13, 4, -12, 7, -13), { c: CR.pink, seed: seed + 30, wob: 0.3 });
  // legs and shoes
  pen(g, F(-3, -9, -3, -2), { c: ol, seed: seed + 2, wob: 0.3, w: lw });
  pen(g, F(3, -9, 3, -2), { c: ol, seed: seed + 3, wob: 0.3, w: lw });
  for (const sx of [-4, 4]) crayonEll(g, x + sx * s, y - s, 3 * s, 1.7 * s, colored ? CR.red : null, CR.redD, seed + 4 + sx, { fill: 0.8, spill: 0.3 });
  // arms
  const armL = F(...(o.armL ?? [-5, -25, -12, -17]));
  const armR = F(...(o.armR ?? (o.sword ? [5, -25, 12, -33] : [5, -25, 12, -17])));
  pen(g, armL, { c: ol, seed: seed + 5, w: lw });
  pen(g, armR, { c: ol, seed: seed + 6, w: lw });
  hand(g, armL[armL.length - 2]!, armL[armL.length - 1]!, s, seed + 7, colored);
  if (o.sword) {
    // pencil-sword held up
    const sx = armR[armR.length - 2]!;
    const sy = armR[armR.length - 1]!;
    const P = rel(sx, sy, s);
    crayonPoly(g, P(-1, 0, 2, -1, 9, -15, 6, -16), colored ? CR.yellow : null, CR.orangeD, seed + 9, { fill: 0.7, spill: 0.3, wob: 0.4 });
    crayonPoly(g, P(6, -16, 9, -15, 9, -22), colored ? CR.brownL : null, CR.brown, seed + 10, { fill: 0.8, spill: 0.2, wob: 0.2 });
    const tip = P(9, -22);
    rect(g, tip[0]! - 1, tip[1]!, 2, 2, CR.black);
    pen(g, P(-4, 1, 4, -3), { c: CR.brown, seed: seed + 11, w: 2, wob: 0.2 });
  }
  hand(g, armR[armR.length - 2]!, armR[armR.length - 1]!, s, seed + 8, colored);
  // pigtails with ribbons
  for (const sd of [-1, 1]) {
    crayonEll(g, hx + sd * 12 * s, hy + 3 * s, 4.5 * s, 6 * s, colored ? CR.orange : null, CR.orangeD, seed + 12 + sd, { angle: 1.2, c2: CR.orangeD, mix: 0.2 });
    pen(g, Hd(sd * 8.5, -4, sd * 10, -1), { c: CR.pink, w: 2, seed: seed + 15 });
  }
  // head
  crayonEll(g, hx, hy, 9.5 * s, 9 * s, colored ? CR.skin : null, CR.brown, seed + 16, { fill: 0.55, spill: 0.4, grain: 0.05 });
  // hair cap + fringe
  const hair = inter(wob(ell(hx, hy - 1 * s, 10.5 * s, 10 * s), 0.6, seed + 18), (xx, yy) => yy < hy - (4 - Math.abs(Math.sin(((xx - hx) / s) * 0.9)) * 2.5) * s);
  const hb: BBox = [hx - 12 * s, hy - 12 * s, hx + 12 * s, hy];
  if (colored) scribble(g, hair, hb, CR.orange, { seed: seed + 19, angle: 0.4, c2: CR.orangeD, mix: 0.25, fill: 0.45 });
  outline(g, hair, hb, CR.orangeD, { seed: seed + 19, grain: 0.3 });
  // paper crown
  crayonPoly(g, Hd(-8, -7, -9, -17, -4, -12, 0, -19, 4, -12, 9, -17, 8, -7), colored ? CR.yellow : null, CR.yellowD, seed + 20, { fill: 0.6, spill: 0.6, wob: 0.5 });
  if (colored) {
    const gems: Array<[number, number, string]> = [
      [0, -11, CR.red],
      [-5.5, -10, CR.blue],
      [5.5, -10, CR.green],
    ];
    for (const [gx, gy, gc] of gems) rect(g, hx + gx * s, hy + gy * s, Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), gc);
  }
  // face
  const e = Math.max(2, Math.round(2 * s));
  rect(g, hx - 4 * s - 1, hy, e, e, CR.black);
  rect(g, hx + 3 * s, hy, e, e, CR.black);
  px(g, hx - 4 * s - 1, hy, '#ffffff');
  px(g, hx + 3 * s, hy, '#ffffff');
  pen(g, Hd(-3, 4, 0, 6, 3, 4), { c: CR.red, seed: seed + 21, wob: 0.1, w: lw });
  if (colored) {
    rect(g, hx - 8 * s, hy + 3 * s, 2 * s, 1 * s, CR.pink);
    rect(g, hx + 6 * s, hy + 3 * s, 2 * s, 1 * s, CR.pink);
  }
  px(g, hx - 6 * s, hy + 2 * s, CR.orangeD);
  px(g, hx - 7 * s, hy + 1 * s, CR.orangeD);
  px(g, hx + 6 * s, hy + 2 * s, CR.orangeD);
  px(g, hx + 7 * s, hy + 1 * s, CR.orangeD);
}

/** Noa as Mina draws him: tall, messy indigo hair over the eyes, big lavender sweater. Feet at (x, y). */
function kidNoa(g: Ctx, x: number, y: number, seed: number, o: KidOpts = {}): void {
  const s = o.s ?? 1;
  const colored = o.colored ?? true;
  const F = rel(x, y, s);
  const hx = x;
  const hy = y - 50 * s;
  const Hd = rel(hx, hy, s);
  const ol = CR.black;
  const lw = s >= 1.3 ? 2 : 1;
  // legs + shoes
  pen(g, F(-4, -14, -4, -2), { c: ol, seed: seed + 2, wob: 0.3, w: lw });
  pen(g, F(4, -14, 4, -2), { c: ol, seed: seed + 3, wob: 0.3, w: lw });
  for (const sx of [-5, 5]) crayonEll(g, x + sx * s, y - s, 3.5 * s, 1.8 * s, colored ? CR.black : null, CR.black, seed + 4 + sx, { fill: 0.8, spill: 0.3 });
  // shorts
  crayonPoly(g, F(-9, -22, 9, -22, 10, -13, 1, -13, 0, -17, -1, -13, -10, -13), colored ? CR.navy : null, CR.navy, seed + 5, { fill: 0.5, wob: 0.6 });
  // arms (under the sleeves)
  const armL = F(...(o.armL ?? [-11, -34, -15, -19]));
  const armR = F(...(o.armR ?? [11, -34, 15, -19]));
  pen(g, armL, { c: ol, seed: seed + 6, w: lw });
  pen(g, armR, { c: ol, seed: seed + 7, w: lw });
  hand(g, armL[armL.length - 2]!, armL[armL.length - 1]!, s, seed + 8, colored);
  hand(g, armR[armR.length - 2]!, armR[armR.length - 1]!, s, seed + 9, colored);
  // big sweater with long sleeves
  crayonPoly(
    g,
    F(-8, -40, 8, -40, 12, -37, 15, -27, 11, -26, 10, -21, -10, -21, -11, -26, -15, -27, -12, -37),
    colored ? CR.lilac : null,
    CR.purple,
    seed + 10,
    { c2: CR.purple, mix: 0.18, fill: 0.35 },
  );
  pen(g, F(-2, -39, -2, -33), { c: colored ? CR.white : CR.purple, seed: seed + 11, wob: 0.2 });
  pen(g, F(2, -39, 2, -33), { c: colored ? CR.white : CR.purple, seed: seed + 12, wob: 0.2 });
  // head
  crayonEll(g, hx, hy, 10.5 * s, 10 * s, colored ? CR.skin : null, CR.brown, seed + 13, { fill: 0.55, spill: 0.4, grain: 0.05 });
  // messy hair: spikes + fringe over the eyes
  crayonPoly(
    g,
    Hd(-13, 2, -12, -6, -15, -9, -9, -11, -10, -16, -4, -13, -1, -18, 3, -13, 9, -16, 9, -10, 15, -9, 12, -5, 13, 2, 9, -3, 6, 1, 3, -3, 0, 1, -3, -3, -6, 1, -9, -3),
    colored ? CR.navy : null,
    '#24305f',
    seed + 15,
    { angle: 1.1, c2: CR.purple, mix: 0.15, fill: 0.4, wob: 0.6 },
  );
  // face: eyes peeking under the fringe, small smile
  const ew = Math.max(2, Math.round(2 * s));
  rect(g, hx - 5 * s, hy + 3 * s, ew, 1, CR.black);
  rect(g, hx + 4 * s - 1, hy + 3 * s, ew, 1, CR.black);
  pen(g, Hd(-2, 7, 0, 8, 2, 7), { c: CR.red, seed: seed + 17, wob: 0.1 });
  if (colored) {
    rect(g, hx - 8 * s, hy + 5 * s, 2 * s, 1, CR.pink);
    rect(g, hx + 6 * s, hy + 5 * s, 2 * s, 1, CR.pink);
  }
}
/** Cloud-like sheep with stick legs. (x, y) = feet line centre. */
function kidSheep(
  g: Ctx,
  x: number,
  y: number,
  seed: number,
  o: { s?: number; dir?: 1 | -1; wool?: string; face?: string; bow?: string; legs?: boolean; ol?: string } = {},
): void {
  const s = o.s ?? 1;
  const dir = o.dir ?? 1;
  const bw = 11 * s;
  const bh = 7 * s;
  const cy = y - 4 * s - bh;
  const face = o.face ?? CR.black;
  // legs
  if (o.legs !== false)
    for (const lx of [-0.6, -0.2, 0.25, 0.6]) pen(g, [x + lx * bw, cy + bh * 0.6, x + lx * bw + dir * 0.5, y], { c: CR.black, seed: seed + lx * 10, wob: 0.2, w: s > 1.4 ? 2 : 1 });
  // woolly body: union of circles
  const puffs: Pred[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i, 0, seed) * 0.4;
    puffs.push(ell(x + Math.cos(a) * bw * 0.8, cy + Math.sin(a) * bh * 0.72, (3.8 + hash(i, 1, seed) * 1.2) * s, (3.8 + hash(i, 2, seed)) * s));
  }
  puffs.push(ell(x, cy, bw * 0.85, bh * 0.85));
  const body = wob(union(...puffs), 0.5, seed);
  const bb: BBox = [x - bw - 6 * s, cy - bh - 6 * s, x + bw + 6 * s, cy + bh + 6 * s];
  scribble(g, body, bb, o.wool ?? CR.white, { seed: seed + 1, fill: 0.6, spill: 0.2, c2: o.wool ? undefined : '#e8e2f0', mix: 0.25 });
  outline(g, body, bb, o.ol ?? CR.gray, { seed: seed + 2 });
  // head
  const hx = x + dir * bw * 0.95;
  const hy = cy - bh * 0.25;
  const head = wob(ell(hx, hy, 3.8 * s, 4.4 * s), 0.3, seed + 3);
  const hb: BBox = [hx - 5 * s, hy - 6 * s, hx + 5 * s, hy + 6 * s];
  scribble(g, head, hb, face, { seed: seed + 4, fill: 0.85, spill: 0.2, grain: 0.04 });
  if (face !== CR.black) outline(g, head, hb, CR.gray, { seed: seed + 4 });
  const eye = face === CR.black ? '#ffffff' : CR.black;
  px(g, hx + dir * 1 * s, hy - 1 * s, eye);
  if (face !== CR.black) {
    px(g, hx - dir * 1.5 * s, hy - 1 * s, eye);
    px(g, hx, hy + 2 * s, CR.pink);
  }
  pen(g, [hx - dir * 3 * s, hy - 3 * s, hx - dir * 6 * s, hy - 1 * s], { c: face === CR.black ? CR.black : CR.gray, seed: seed + 5, w: 2, wob: 0.1 });
  if (o.bow) {
    const bx = hx - dir * 4 * s;
    const by = hy + 4 * s;
    rect(g, bx - 3, by - 1, 2, 3, o.bow);
    rect(g, bx + 2, by - 1, 2, 3, o.bow);
    rect(g, bx - 1, by, 3, 1, o.bow);
  }
}

/** Five-point star drawn in one go, the way children do. */
function kidStar(g: Ctx, x: number, y: number, r: number, c: string, seed: number, fill?: string): void {
  const pts: number[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + ((i * 2) % 5) * ((Math.PI * 2) / 5);
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  if (fill) {
    const sp: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      sp.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    scribble(g, poly(sp), [x - r - 1, y - r - 1, x + r + 1, y + r + 1], fill, { seed, fill: 0.7, spill: 0.4 });
  }
  pen(g, pts, { c, seed, wob: 0.25 });
}

/** Little crayon flower. */
function kidFlower(g: Ctx, x: number, y: number, c: string, seed: number, h = 6): void {
  pen(g, [x, y, x + noise1(seed, 4), y - h], { c: CR.greenD, seed, wob: 0.3 });
  const fy = y - h - 1;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const)
    rect(g, x + dx * 2 - 1, fy + dy * 2 - 1, 2, 2, c);
  px(g, x, fy, CR.yellow);
  px(g, x - 1, fy, CR.yellow);
}

// ---------------------------------------------------------------------------------------------------------------
// Carnet page 1 — the meadow, Noa and Mina
// ---------------------------------------------------------------------------------------------------------------

function paintPage1(g: Ctx): void {
  sketchbook(g, 11);
  // sky band
  const sky = wob((x, y) => x > 20 && x < 306 && y > 10 && y < 27 + Math.sin(x * 0.05) * 3, 1.2, 5);
  scribble(g, sky, [20, 9, 307, 32], CR.sky, { seed: 6, angle: -0.15, gap: 3, on: 2, fill: 0.2, light: 0.3 });
  // sun with a face (top right)
  crayonEll(g, 284, 28, 13, 13, CR.yellow, null, 7, { angle: 0.6, c2: CR.orange, mix: 0.12, fill: 0.5 });
  penEllipse(g, 284, 28, 13, 13, { c: CR.orange, seed: 9 });
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.55 + (i / 8) * Math.PI * 1.0;
    pen(g, [284 + Math.cos(a) * 17, 28 + Math.sin(a) * 17, 284 + Math.cos(a) * 24, 28 + Math.sin(a) * 24], { c: CR.orange, seed: 10 + i, w: 2, wob: 0.3 });
  }
  rect(g, 279, 25, 2, 2, CR.black);
  rect(g, 287, 25, 2, 2, CR.black);
  pen(g, [278, 31, 284, 35, 290, 31], { c: CR.red, seed: 12, wob: 0.15 });
  // cotton clouds
  const clouds: Array<[number, number, number]> = [
    [56, 22, 1],
    [146, 18, 1.2],
    [222, 26, 0.8],
  ];
  for (const [cx, cy, s] of clouds) {
    const cl = wob(union(ell(cx - 8 * s, cy, 7 * s, 5 * s), ell(cx, cy - 3 * s, 8 * s, 7 * s), ell(cx + 9 * s, cy, 7 * s, 5 * s)), 0.6, cx);
    scribble(g, cl, [cx - 18 * s, cy - 12 * s, cx + 18 * s, cy + 7 * s], CR.white, { seed: cx + 1, fill: 0.8, spill: 0 });
    outline(g, cl, [cx - 18 * s, cy - 12 * s, cx + 18 * s, cy + 7 * s], CR.blue, { seed: cx + 2 });
  }
  // falling cotton
  const balls = [
    [34, 44],
    [102, 40],
    [124, 70],
    [236, 82],
    [258, 56],
    [286, 74],
    [30, 76],
    [300, 50],
    [112, 98],
    [244, 38],
  ];
  balls.forEach(([bx, by], i) => kidPuff(g, bx!, by!, 30 + i));
  // hills
  const hillBack = wob((x, y) => x > 18 && x < 308 && y > 92 - Math.sin(x * 0.022 + 1) * 12 && y < 170, 1, 13);
  scribble(g, hillBack, [18, 76, 308, 170], CR.greenL, { seed: 14, angle: -0.2, fill: 0.3, light: 0.2 });
  const hillFront = wob((x, y) => x > 18 && x < 308 && y > 116 - Math.sin(x * 0.03 + 3.2) * 6 && y < 170, 1, 15);
  scribble(g, hillFront, [18, 106, 308, 170], CR.green, { seed: 16, angle: -0.35, c2: CR.greenD, mix: 0.15, fill: 0.3 });
  pen(
    g,
    Array.from({ length: 30 }, (_, i) => [20 + i * 10, 92 - Math.sin((20 + i * 10) * 0.022 + 1) * 12]).flat(),
    { c: CR.greenD, seed: 17, wob: 0.5 },
  );
  for (let i = 0; i < 26; i++) {
    const gx = 24 + i * 11 + Math.round(hash(i, 0, 18) * 6);
    const gy = 128 + Math.round(hash(i, 1, 18) * 30);
    pen(g, [gx - 2, gy, gx - 1, gy - 3, gx, gy, gx + 1, gy - 4, gx + 2, gy], { c: CR.greenD, seed: 19 + i, wob: 0.1 });
  }
  // the bed in the middle of the meadow
  const bx = 34;
  const by = 114;
  crayonPoly(g, [bx, by - 12, bx + 54, by - 12, bx + 54, by, bx, by], CR.brownL, CR.brown, 21, { fill: 0.5, wob: 0.5 });
  crayonPoly(g, [bx + 14, by - 22, bx + 54, by - 22, bx + 55, by - 8, bx + 13, by - 8], CR.lilac, CR.purple, 23, { c2: CR.pink, mix: 0.3, wob: 0.6 });
  for (let i = 0; i < 4; i++) pen(g, [bx + 20 + i * 9, by - 21, bx + 20 + i * 9, by - 9], { c: CR.pink, seed: 120 + i, wob: 0.4 });
  crayonEll(g, bx + 8, by - 18, 7, 5, CR.white, CR.sky, 25, { fill: 0.9, spill: 0 });
  pen(g, [bx, by - 28, bx, by + 6], { c: CR.brown, w: 2, seed: 26, wob: 0.2 });
  pen(g, [bx + 54, by - 15, bx + 54, by + 6], { c: CR.brown, w: 2, seed: 27, wob: 0.2 });
  pen(g, [bx, by - 28, bx + 4, by - 30, bx + 8, by - 27], { c: CR.brown, w: 2, seed: 28, wob: 0.2 });
  // Dodo floating above the bed
  kidSheep(g, 70, 74, 28, { s: 0.95, dir: 1, face: '#dcd6e4', bow: CR.pink, legs: false });
  pen(g, [52, 78, 56, 76, 60, 78], { c: CR.sky, seed: 29, wob: 0.1 });
  pen(g, [80, 80, 84, 78, 88, 80], { c: CR.sky, seed: 29, wob: 0.1 });
  // a sheep on the far hill
  kidSheep(g, 272, 104, 31, { s: 0.8, dir: -1 });
  // Noa and Mina holding hands
  kidNoa(g, 166, 127, 50, { s: 1.3, armR: [11, -34, 19, -22] });
  kidMina(g, 206, 127, 70, { s: 1.3, sword: true, armL: [-5, -25, -12, -22], armR: [5, -25, 11, -34] });
  // heart between them
  const heart = union(ell(186, 40, 3.2, 3), ell(192, 40, 3.2, 3), poly([182.5, 41, 195.5, 41, 189, 48]));
  scribble(g, heart, [181, 36, 197, 49], CR.red, { seed: 85, fill: 0.7, spill: 0.4 });
  outline(g, wob(heart, 0.4, 86), [181, 36, 197, 49], CR.redD, { seed: 86 });
  // labels with arrows
  scrawl(g, 'NOA', 118, 40, CR.navy, { seed: 2, bold: true });
  pen(g, [134, 52, 146, 58], { c: CR.navy, seed: 81, wob: 0.2 });
  pen(g, [142, 59, 146, 58, 144, 55], { c: CR.navy, seed: 82, wob: 0.1 });
  scrawl(g, 'MOI', 236, 46, CR.red, { seed: 4, bold: true });
  pen(g, [238, 58, 230, 64], { c: CR.red, seed: 83, wob: 0.2 });
  pen(g, [230, 61, 230, 64, 233, 65], { c: CR.red, seed: 84, wob: 0.1 });
  // flowers
  const flowers: Array<[number, number, string]> = [
    [30, 132, CR.red],
    [48, 142, CR.pink],
    [104, 128, CR.yellow],
    [126, 146, CR.red],
    [246, 130, CR.pink],
    [262, 142, CR.yellow],
    [286, 126, CR.red],
    [296, 148, CR.purple],
    [86, 150, CR.purple],
    [232, 152, CR.red],
    [142, 122, CR.purple],
    [118, 112, CR.pink],
  ];
  flowers.forEach(([fx, fy, c], i) => kidFlower(g, fx, fy, c, 90 + i));
  // title at the bottom
  kidStar(g, 78, 160, 5, CR.yellowD, 95, CR.yellow);
  scrawl(g, 'Moi et Noa au Pays de Coton', 88, 156, CR.purple, { seed: 9, bold: true, jit: 1.2 });
}

/** Small cotton puff. */
function kidPuff(g: Ctx, x: number, y: number, seed: number, ol: string = CR.sky): void {
  const p = union(ell(x - 1.5, y, 2.2, 2), ell(x + 1.5, y, 2.2, 2), ell(x, y - 1.5, 2, 2));
  scribble(g, p, [x - 5, y - 5, x + 5, y + 4], CR.white, { seed, fill: 1, spill: 0, grain: 0 });
  outline(g, wob(p, 0.3, seed), [x - 5, y - 5, x + 5, y + 4], ol, { seed: seed + 1, grain: 0.15 });
}

/** Crescent moon (opening up-right), optionally sleeping face and nightcap (Madame Lune). */
function kidMoon(g: Ctx, cx: number, cy: number, r: number, seed: number, o: { cap?: boolean; face?: boolean; colored?: boolean } = {}): void {
  const cres = wob(minus(ell(cx, cy, r, r), ell(cx + r * 0.52, cy - r * 0.28, r * 0.8, r * 0.8)), 0.6, seed);
  const bb: BBox = [cx - r - 3, cy - r - 3, cx + r + 3, cy + r + 3];
  if (o.colored !== false) scribble(g, cres, bb, CR.yellow, { seed, c2: CR.yellowD, mix: 0.15, fill: 0.5, angle: 0.5 });
  outline(g, cres, bb, CR.yellowD, { seed, w: r > 20 ? 2 : 1 });
  if (o.face !== false) {
    const ex = cx - r * 0.52;
    const ey = cy - r * 0.02;
    pen(g, [ex - r * 0.12, ey, ex, ey + r * 0.08, ex + r * 0.12, ey], { c: CR.black, seed: seed + 1, wob: 0.1, w: r > 20 ? 2 : 1 });
    pen(g, [ex - r * 0.02, ey + r * 0.3, ex + r * 0.1, ey + r * 0.36, ex + r * 0.22, ey + r * 0.3], { c: CR.red, seed: seed + 2, wob: 0.1 });
    rect(g, ex - r * 0.25, ey + r * 0.16, Math.max(2, r * 0.12), Math.max(1, r * 0.06), CR.pink);
  }
  if (o.cap) {
    const P = rel(cx, cy, r);
    crayonPoly(g, P(-0.55, -0.72, 0.15, -1.02, 0.95, -1.25, 1.1, -0.95, 0.35, -0.78), CR.blue, CR.navy, seed + 3, { fill: 0.5, wob: 0.6 });
    crayonPoly(g, P(-0.6, -0.78, 0.2, -1.05, 0.25, -0.9, -0.5, -0.62), CR.white, CR.gray, seed + 4, { fill: 0.8, wob: 0.4 });
    const pp = P(1.12, -1.0);
    crayonEll(g, pp[0]!, pp[1]!, r * 0.12 + 1, r * 0.12 + 1, CR.white, CR.gray, seed + 5, { fill: 1, spill: 0 });
  }
}

/** Crayon heart. */
function kidHeart(g: Ctx, x: number, y: number, r: number, c: string, cD: string, seed: number): void {
  const p = union(ell(x - r * 0.55, y, r * 0.62, r * 0.6), ell(x + r * 0.55, y, r * 0.62, r * 0.6), poly([x - r * 1.12, y + r * 0.2, x + r * 1.12, y + r * 0.2, x, y + r * 1.4]));
  const bb: BBox = [x - r * 1.3, y - r, x + r * 1.3, y + r * 1.5];
  scribble(g, p, bb, c, { seed, fill: 0.7, spill: 0.4 });
  outline(g, wob(p, 0.4, seed + 1), bb, cD, { seed: seed + 1 });
}

/** Coloured pencil standing tip up (the Pencil Forest). */
function kidPencil(g: Ctx, x: number, top: number, bottom: number, w: number, c: string, cD: string, seed: number): void {
  const cone = w * 1.3;
  const by = top + cone;
  crayonPoly(g, [x, by, x + w, by, x + w, bottom, x, bottom], c, cD, seed, { angle: 1.52, c2: cD, mix: 0.22, fill: 0.4, wob: 0.6 });
  pen(g, [x + w * 0.66, by + 1, x + w * 0.66, bottom - 1], { c: cD, seed: seed + 1, wob: 0.5 });
  pen(g, [x + w * 0.33, by + 1, x + w * 0.33, bottom - 1], { c: CR.white, seed: seed + 2, wob: 0.5, grain: 0.5 });
  crayonPoly(g, [x, by, x + w, by, x + w / 2, top], '#f6d8ad', CR.brown, seed + 3, { fill: 0.6, wob: 0.4 });
  const tw = (w / 2) * 0.38;
  crayonPoly(g, [x + w / 2 - tw, top + cone * 0.38, x + w / 2 + tw, top + cone * 0.38, x + w / 2, top], c, cD, seed + 4, { fill: 0.9, spill: 0.2, wob: 0.2 });
  // scalloped wood edge
  pen(g, [x, by, x + w * 0.25, by - 1.5, x + w * 0.5, by, x + w * 0.75, by - 1.5, x + w, by], { c: CR.brown, seed: seed + 5, wob: 0.2 });
}

/** Firefly as a child draws it: a yellow dot with little light strokes. */
function kidFirefly(g: Ctx, x: number, y: number): void {
  rect(g, x - 1, y - 1, 3, 3, CR.yellow);
  px(g, x, y, '#fff6c0');
  for (const [dx, dy] of [
    [-3, 0],
    [3, 0],
    [0, -3],
    [0, 3],
  ] as const)
    px(g, x + dx, y + dy, CR.yellowD);
}

/** Moon night-light as drawn by Mina: crescent on a little base, light strokes around. */
function kidVeilleuse(g: Ctx, x: number, y: number, s: number, seed: number): void {
  const P = rel(x, y, s);
  // light strokes
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 1.02 + (i / 10) * Math.PI * 0.96;
    const r0 = 15 * s;
    const r1 = (20 + (i % 2) * 4) * s;
    pen(g, [x + Math.cos(a) * r0, y - 12 * s + Math.sin(a) * r0, x + Math.cos(a) * r1, y - 12 * s + Math.sin(a) * r1], { c: CR.yellowD, seed: seed + i, wob: 0.2, w: 2 });
  }
  // base
  crayonPoly(g, P(-7, -2, 7, -2, 8, 4, -8, 4), CR.white, CR.gray, seed + 20, { fill: 0.7, wob: 0.4 });
  pen(g, P(-4, 1, 4, 1), { c: CR.sky, seed: seed + 21, wob: 0.1 });
  // moon
  kidMoon(g, x - 1 * s, y - 12 * s, 10 * s, seed + 22, { face: true });
  // cord with plug
  pen(g, P(8, 2, 13, 3, 16, 6, 20, 5, 23, 7), { c: CR.gray, seed: seed + 23, wob: 0.3 });
  const pl = P(23, 7);
  rect(g, pl[0]!, pl[1]! - 1, 3, 3, CR.gray);
  px(g, pl[0]! + 3, pl[1]! - 1, CR.gray);
  px(g, pl[0]! + 3, pl[1]! + 1, CR.gray);
}

// ---------------------------------------------------------------------------------------------------------------
// Carnet — cover
// ---------------------------------------------------------------------------------------------------------------

const COVER = { x: 46, y: 8, w: 236, h: 164 };

function paintCover(g: Ctx): void {
  // Mina's desk (warm wood, a little dusty)
  field(g, 0, 0, SW, SH, (x, y) => {
    const n = noise2(x * 0.015, y * 0.4, 21) * 0.7 + noise2(x * 0.06, y * 1.3, 22) * 0.3;
    const plank = y % 46 === 0;
    if (plank) return '#2e1d18';
    return n < 0.36 ? '#4a2f25' : n > 0.66 ? '#6b4636' : '#5a3a2c';
  });
  // crayons scattered on the desk
  const crayon = (x: number, y: number, len: number, c: string, cD: string, dir: number): void => {
    for (let i = 0; i < len; i++) {
      const yy = y + Math.round(i * dir);
      rect(g, x + i, yy, 1, 4, i < 3 ? '#f6d8ad' : c);
      px(g, x + i, yy + 3, i < 3 ? '#c9a27a' : cD);
      if (i > 6 && i < len - 4) px(g, x + i, yy + 1, i % 9 < 4 ? '#ffffff' : c);
    }
    px(g, x, y + 1, cD);
    px(g, x, y + 2, cD);
  };
  crayon(290, 32, 24, CR.red, CR.redD, 0.35);
  crayon(288, 120, 22, CR.yellow, CR.yellowD, -0.25);
  crayon(6, 140, 26, CR.blue, CR.navy, -0.3);
  crayon(10, 60, 22, CR.green, CR.greenD, 0.2);
  // notebook shadow
  rect(g, COVER.x + 4, COVER.y + 5, COVER.w, COVER.h, '#24150f');
  // pages edge (thickness)
  rect(g, COVER.x + 2, COVER.y + 2, COVER.w, COVER.h, PAPER2);
  rect(g, COVER.x + 2, COVER.y + COVER.h + 1, COVER.w, 1, PAPER3);
  // navy cardboard cover
  field(g, COVER.x, COVER.y, COVER.w, COVER.h, (x, y) => {
    const e = Math.min(x - COVER.x, y - COVER.y, COVER.x + COVER.w - 1 - x, COVER.y + COVER.h - 1 - y);
    // rounded corners
    const cx = Math.min(x - COVER.x, COVER.x + COVER.w - 1 - x);
    const cy = Math.min(y - COVER.y, COVER.y + COVER.h - 1 - y);
    if (cx + cy < 2) return null;
    if (e === 0) return '#26306a';
    const h = hash(x, y, 23);
    const n = noise2(x * 0.08, y * 0.08, 24);
    if (e < 3 && h < 0.4) return '#3a4890'; // worn edges
    if (h < 0.08 + n * 0.06) return '#34428a';
    if (h > 0.985) return '#56649f';
    return n > 0.62 ? '#33418a' : '#2f3c80';
  });
  // spiral binding
  for (let y = COVER.y + 6; y < COVER.y + COVER.h - 4; y += 9) {
    rect(g, COVER.x + 5, y, 3, 3, '#141a3c');
    rect(g, COVER.x - 3, y - 1, 9, 1, '#a9a4b8');
    rect(g, COVER.x - 4, y, 1, 2, '#6d6880');
    rect(g, COVER.x - 3, y + 2, 4, 1, '#5d5870');
    px(g, COVER.x - 1, y - 1, '#e6e2ef');
  }
  // white crayon doodles on the cardboard: stars, a moon, a sheep
  const doodles: Array<[number, number, number]> = [
    [76, 22, 4],
    [262, 30, 5],
    [70, 124, 3],
    [258, 118, 4],
    [212, 150, 3],
    [96, 154, 4],
    [244, 74, 3],
  ];
  doodles.forEach(([dx, dy, r], i) => kidStar(g, dx, dy, r, i % 2 ? CR.yellow : '#e8e6f4', 200 + i));
  kidMoon(g, 70, 70, 9, 210, { face: true });
  kidSheep(g, 250, 166, 211, { s: 0.7, dir: -1, ol: '#cfd2ea' });
  // label sticker (slightly crooked: drawn with a wobble, one corner peeling)
  const lx = 92;
  const ly = 30;
  const lw = 146;
  const lh = 82;
  rect(g, lx + 2, ly + 2, lw, lh, '#1d2558');
  field(g, lx, ly, lw, lh, (x, y) => {
    const cx = Math.min(x - lx, lx + lw - 1 - x);
    const cy = Math.min(y - ly, ly + lh - 1 - y);
    if (cx + cy < 3) return null;
    // peeling corner (top right)
    const px2 = x - (lx + lw - 12);
    const py2 = ly + 12 - y;
    if (px2 > 0 && py2 > 0 && px2 + py2 > 13) return null;
    if (px2 > 0 && py2 > 0 && px2 + py2 > 10) return '#d9d2c4';
    const h = hash(x, y, 25);
    if (Math.min(cx, cy) === 0) return '#ded8cc';
    return h < 0.04 ? '#efe9dc' : '#fbf8f0';
  });
  // decorative border drawn on the sticker
  pen(g, [lx + 5, ly + 5, lx + lw - 14, ly + 5], { c: CR.pink, seed: 26, wob: 0.6 });
  pen(g, [lx + 5, ly + lh - 6, lx + lw - 6, ly + lh - 6], { c: CR.pink, seed: 27, wob: 0.6 });
  // title
  scrawl(g, 'Le Pays', lx + 30, ly + 9, CR.purple, { seed: 31, scale: 2, jit: 2 });
  scrawl(g, 'de Coton', lx + 22, ly + 33, CR.blue, { seed: 32, scale: 2, jit: 2 });
  scrawl(g, 'pour Noa', lx + 40, ly + 60, CR.red, { seed: 33, bold: true });
  kidHeart(g, lx + 106, ly + 66, 4, CR.red, CR.redD, 34);
  // gommettes (round stickers) and gold star stickers
  const gommette = (x: number, y: number, r: number, c: string, hi: string): void => {
    fillP(g, ell(x, y, r, r), [x - r - 1, y - r - 1, x + r + 1, y + r + 1], c);
    px(g, x - Math.ceil(r / 2), y - Math.ceil(r / 2), hi);
    px(g, x - Math.ceil(r / 2) + 1, y - Math.ceil(r / 2), hi);
  };
  gommette(110, 124, 4.5, '#e2404c', '#ff9aa2');
  gommette(124, 132, 4.5, '#f9cf3a', '#fff3b0');
  gommette(138, 124, 4.5, '#4fae4f', '#b9f0a0');
  gommette(152, 132, 4.5, '#3e78d6', '#a9cdfa');
  gommette(166, 124, 4.5, '#f37bb0', '#ffd0e4');
  const starSticker = (x: number, y: number, r: number): void => {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.48;
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    fillP(g, poly(pts), [x - r - 1, y - r - 1, x + r + 1, y + r + 1], (xx, yy) => (xx + yy < x + y - 1 ? '#ffe991' : xx + yy > x + y + 2 ? '#c99a2e' : '#f5c04f'));
  };
  STAR_STICKERS.forEach(([sx, sy, r]) => starSticker(sx, sy, r));
  // signature
  scrawl(g, 'MINA', 200, 140, CR.yellow, { seed: 35, bold: true });
  scrawl(g, '8 ans', 204, 152, '#e8e6f4', { seed: 36 });
  // dust
  field(g, COVER.x, COVER.y, COVER.w, COVER.h, (x, y) => (hash(x, y, 37) < 0.012 ? '#6a73a8' : null));
}

const STAR_STICKERS: Array<[number, number, number]> = [
  [84, 40, 7],
  [252, 52, 6],
  [86, 100, 5],
  [190, 148, 6],
  [262, 96, 5],
];

// ---------------------------------------------------------------------------------------------------------------
// Carnet page 2 — the sheep village and Chaussette
// ---------------------------------------------------------------------------------------------------------------

function paintPage2(g: Ctx): void {
  sketchbook(g, 12);
  // rainbow
  const rb = [CR.red, CR.orange, CR.yellow, CR.green, CR.blue, CR.purple];
  rb.forEach((c, i) => {
    const r1 = 92 - i * 5;
    const r0 = r1 - 5;
    const p = wob((x, y) => {
      const d = Math.hypot(x - 118, (y - 104) * 1.1);
      return d >= r0 && d < r1 && y < 100;
    }, 0.8, 40 + i);
    scribble(g, p, [20, 4, 216, 100], c, { seed: 50 + i, angle: 0.9 + i * 0.1, fill: 0.35, spill: 0.6 });
  });
  // Madame Lune asleep in the corner
  kidMoon(g, 268, 26, 15, 60, { cap: true });
  scrawl(g, 'z', 238, 22, CR.blue, { seed: 61 });
  scrawl(g, 'z', 230, 14, CR.blue, { seed: 62 });
  scrawl(g, 'Z', 220, 6, CR.blue, { seed: 63, bold: true });
  // ground (stops above the title, like a child's grass strip)
  const ground = wob((x, y) => x > 18 && x < 308 && y > 104 + Math.sin(x * 0.04) * 2 && y < 146 + Math.sin(x * 0.09) * 2, 1, 64);
  scribble(g, ground, [18, 98, 308, 150], CR.greenL, { seed: 65, angle: -0.25, c2: CR.green, mix: 0.25, fill: 0.3 });
  for (let i = 0; i < 20; i++) {
    const gx = 26 + i * 14 + Math.round(hash(i, 0, 69) * 6);
    const gy = 136 + Math.round(hash(i, 1, 69) * 8);
    pen(g, [gx - 2, gy, gx - 1, gy - 3, gx, gy, gx + 1, gy - 4, gx + 2, gy], { c: CR.green, seed: 69 + i, wob: 0.1 });
  }
  // house 1: red roof, pink walls
  crayonPoly(g, [26, 66, 76, 66, 76, 106, 26, 106], CR.pinkL, CR.pink, 70, { fill: 0.3 });
  crayonPoly(g, [20, 68, 51, 38, 82, 68], CR.red, CR.redD, 71, { angle: 0.3 });
  crayonPoly(g, [62, 46, 70, 46, 70, 58, 62, 58], CR.brownL, CR.brown, 72, { fill: 0.6 });
  pen(g, [66, 42, 62, 38, 68, 34, 64, 30, 70, 26, 66, 22], { c: CR.gray, seed: 73, wob: 0.6 });
  crayonPoly(g, [44, 84, 58, 84, 58, 106, 44, 106], CR.brown, CR.black, 74, { fill: 0.6 });
  px(g, 55, 95, CR.yellow);
  crayonPoly(g, [30, 74, 40, 74, 40, 84, 30, 84], CR.sky, CR.blue, 75, { fill: 0.4 });
  pen(g, [35, 74, 35, 84], { c: CR.blue, seed: 76, wob: 0.1 });
  pen(g, [30, 79, 40, 79], { c: CR.blue, seed: 77, wob: 0.1 });
  // house 2: yellow walls, cotton roof
  crayonPoly(g, [90, 74, 130, 74, 130, 106, 90, 106], CR.yellow, CR.yellowD, 80, { fill: 0.3 });
  const roof = wob(union(ell(92, 72, 8, 6), ell(104, 66, 10, 8), ell(118, 66, 10, 8), ell(129, 72, 8, 6), ell(110, 60, 9, 7)), 0.5, 81);
  scribble(g, roof, [80, 50, 140, 80], CR.white, { seed: 82, fill: 0.8, spill: 0 });
  outline(g, roof, [80, 50, 140, 80], CR.gray, { seed: 82 });
  crayonPoly(g, [104, 88, 116, 88, 116, 106, 104, 106], CR.blue, CR.navy, 83, { fill: 0.6 });
  crayonEll(g, 96, 86, 4, 4, CR.sky, CR.blue, 84, { fill: 0.4 });
  crayonEll(g, 124, 86, 4, 4, CR.sky, CR.blue, 85, { fill: 0.4 });
  // tree with the red balloon stuck in it
  const tx = 166;
  pen(g, [tx, 110, tx, 80], { c: CR.brown, seed: 86, w: 3, wob: 0.4 });
  pen(g, [tx, 90, tx + 8, 82], { c: CR.brown, seed: 87, w: 2, wob: 0.3 });
  crayonEll(g, tx, 66, 16, 15, CR.green, CR.greenD, 88, { c2: CR.greenD, mix: 0.2, angle: 0.4 });
  crayonEll(g, tx + 12, 50, 6, 7, CR.red, CR.redD, 89, { fill: 0.6 });
  px(g, tx + 10, 47, '#ffffff');
  px(g, tx + 10, 48, '#ffffff');
  pen(g, [tx + 12, 57, tx + 10, 62, tx + 13, 67, tx + 11, 72], { c: CR.black, seed: 90, wob: 0.3 });
  // the little lamb looking up at it
  kidSheep(g, 186, 124, 91, { s: 0.65, dir: -1 });
  px(g, 177, 113, CR.sky);
  px(g, 177, 115, CR.sky);
  scrawl(g, '?', 182, 96, CR.black, { seed: 92, bold: true });
  // Chaussette's shop
  const sx = 220;
  crayonPoly(g, [sx, 72, sx + 66, 72, sx + 66, 104, sx, 104], CR.brownL, CR.brown, 93, { fill: 0.4 });
  // Chaussette behind the counter
  const cx = sx + 33;
  crayonPoly(g, [cx - 9, 92, cx - 9, 64, cx - 6, 58, cx + 6, 58, cx + 9, 64, cx + 9, 92], CR.blue, CR.navy, 94, { fill: 0.45 });
  for (const [dx, dy] of [
    [-5, 66],
    [5, 64],
    [-3, 84],
    [5, 82],
  ] as const)
    crayonEll(g, cx + dx, dy, 1.6, 1.6, CR.white, null, 95 + dx, { fill: 1, spill: 0, grain: 0 });
  for (const sd of [-1, 1]) {
    const ex = cx + sd * 4;
    crayonEll(g, ex, 73, 3, 3, CR.white, CR.black, 96 + sd, { fill: 1, spill: 0 });
    pen(g, [ex - 1, 72, ex + 1, 74], { c: CR.black, seed: 98, wob: 0 });
    pen(g, [ex + 1, 72, ex - 1, 74], { c: CR.black, seed: 98, wob: 0 });
  }
  pen(g, [cx - 3, 79, cx, 81, cx + 3, 79], { c: CR.red, seed: 100, wob: 0.1 });
  crayonPoly(g, [cx - 7, 54, cx, 58, cx - 7, 62], CR.red, CR.redD, 101, { fill: 0.8, wob: 0.3 });
  crayonPoly(g, [cx + 7, 54, cx, 58, cx + 7, 62], CR.red, CR.redD, 102, { fill: 0.8, wob: 0.3 });
  // counter in front
  crayonPoly(g, [sx - 2, 88, sx + 68, 88, sx + 68, 108, sx - 2, 108], CR.brownL, CR.brown, 103, { fill: 0.45, angle: 0 });
  // striped awning + sign
  for (let i = 0; i < 6; i++) {
    const ax = sx - 2 + i * 11.4;
    crayonPoly(g, [ax, 44, ax + 11.4, 44, ax + 11.4, 53, ax + 5.7, 57, ax, 53], i % 2 ? CR.white : CR.red, CR.redD, 104 + i, { fill: 0.5, wob: 0.4 });
  }
  pen(g, [sx, 56, sx, 88], { c: CR.brown, seed: 112, w: 2, wob: 0.2 });
  pen(g, [sx + 66, 56, sx + 66, 88], { c: CR.brown, seed: 113, w: 2, wob: 0.2 });
  scrawl(g, 'BOUTIQUE', sx + 4, 30, CR.purple, { seed: 114, bold: true });
  // socks for sale on the counter
  crayonPoly(g, [sx + 6, 90, sx + 10, 90, sx + 10, 97, sx + 14, 97, sx + 14, 101, sx + 6, 101], CR.pink, CR.pinkL, 115, { fill: 0.6, wob: 0.3 });
  crayonPoly(g, [sx + 52, 90, sx + 56, 90, sx + 56, 97, sx + 60, 97, sx + 60, 101, sx + 52, 101], CR.green, CR.greenD, 116, { fill: 0.6, wob: 0.3 });
  scrawl(g, 'Chaussette', sx - 2, 114, CR.navy, { seed: 117, bold: true });
  pen(g, [sx + 30, 113, sx + 32, 108], { c: CR.navy, seed: 118, wob: 0.1 });
  // villagers
  kidSheep(g, 50, 124, 120, { s: 1, dir: 1 });
  kidSheep(g, 92, 132, 121, { s: 0.9, dir: -1, wool: '#f9b8d3' });
  kidSheep(g, 134, 122, 122, { s: 0.85, dir: 1, wool: '#b4d4f8' });
  kidSheep(g, 292, 134, 123, { s: 0.75, dir: -1, wool: '#fbe48a' });
  scrawl(g, '1, 2, 3...', 26, 98, CR.black, { seed: 124 });
  const fl: Array<[number, number, string]> = [
    [160, 132, CR.red],
    [204, 138, CR.pink],
    [246, 132, CR.purple],
    [116, 142, CR.yellow],
    [30, 140, CR.red],
  ];
  fl.forEach(([fx, fy, c], i) => kidFlower(g, fx, fy, c, 126 + i));
  // title
  scrawl(g, 'Le vilage des moutons', 96, 156, CR.red, { seed: 125, bold: true, jit: 1.2 });
}

// ---------------------------------------------------------------------------------------------------------------
// Carnet page 3 — the Pencil Forest and the owl
// ---------------------------------------------------------------------------------------------------------------

const P3_FIREFLIES: Array<[number, number]> = [
  [124, 44],
  [128, 86],
  [214, 40],
  [230, 88],
  [100, 100],
  [262, 62],
  [70, 52],
  [218, 112],
  [112, 24],
];

function paintPage3(g: Ctx): void {
  sketchbook(g, 13);
  // night sky
  const sky = wob((x, y) => x > 18 && x < 308 && y > 9 && y < 92 + Math.sin(x * 0.07) * 3, 1.2, 130);
  scribble(g, sky, [18, 8, 308, 98], CR.navy, { seed: 131, angle: -0.3, c2: CR.blue, mix: 0.2, fill: 0.35, light: 0.15 });
  kidMoon(g, 44, 34, 15, 132, { face: true });
  const stars: Array<[number, number, number]> = [
    [86, 18, 3],
    [150, 30, 4],
    [184, 16, 3],
    [300, 22, 3],
    [250, 36, 4],
    [110, 66, 3],
  ];
  stars.forEach(([x, y, r], i) => kidStar(g, x, y, r, CR.yellow, 133 + i));
  // ground
  const ground = wob((x, y) => x > 18 && x < 308 && y > 120 + Math.sin(x * 0.05) * 2 && y < 148 + Math.sin(x * 0.08) * 2, 1, 140);
  scribble(g, ground, [18, 114, 308, 152], CR.green, { seed: 141, angle: -0.25, c2: CR.greenD, mix: 0.3, fill: 0.3 });
  // pencil trees
  const pencils: Array<[number, number, number, string, string]> = [
    [22, 30, 16, CR.red, CR.redD],
    [44, 58, 14, CR.green, CR.greenD],
    [62, 22, 15, CR.blue, CR.navy],
    [84, 48, 14, CR.yellow, CR.yellowD],
    [236, 34, 15, CR.purple, '#5d3a96'],
    [256, 56, 14, CR.orange, CR.orangeD],
    [274, 20, 16, CR.pink, '#c2507f'],
    [294, 46, 14, CR.greenL, CR.green],
  ];
  pencils.forEach(([x, top, w, c, cD], i) => kidPencil(g, x, top, 126 + (i % 3) * 3, w, c, cD, 150 + i * 7));
  // stack of books
  crayonPoly(g, [138, 112, 206, 112, 206, 126, 138, 126], CR.red, CR.redD, 170, { fill: 0.45, angle: 0 });
  pen(g, [142, 119, 202, 119], { c: CR.yellow, seed: 171, wob: 0.3 });
  crayonPoly(g, [144, 100, 200, 100, 200, 112, 144, 112], CR.blue, CR.navy, 172, { fill: 0.45, angle: 0 });
  crayonPoly(g, [140, 88, 196, 88, 196, 100, 140, 100], CR.green, CR.greenD, 173, { fill: 0.45, angle: 0 });
  pen(g, [150, 94, 186, 94], { c: CR.white, seed: 174, wob: 0.2 });
  // the owl
  const ox = 170;
  const oy = 64;
  crayonPoly(g, [ox - 15, oy - 18, ox - 11, oy - 30, ox - 5, oy - 20], CR.brownL, CR.brown, 175, { fill: 0.7, wob: 0.3 });
  crayonPoly(g, [ox + 15, oy - 18, ox + 11, oy - 30, ox + 5, oy - 20], CR.brownL, CR.brown, 176, { fill: 0.7, wob: 0.3 });
  crayonEll(g, ox, oy, 17, 23, CR.brownL, CR.brown, 177, { c2: CR.orange, mix: 0.15, angle: 1.2 });
  crayonEll(g, ox, oy + 9, 10, 12, '#fbe6c2', CR.brownL, 178, { fill: 0.6, spill: 0.3 });
  for (const [vx, vy] of [
    [-4, 4],
    [3, 6],
    [-2, 11],
    [5, 13],
    [0, 17],
  ] as const)
    pen(g, [ox + vx - 2, oy + vy, ox + vx, oy + vy + 2, ox + vx + 2, oy + vy], { c: CR.brown, seed: 179 + vx, wob: 0.1 });
  // wings
  crayonPoly(g, [ox - 16, oy - 6, ox - 21, oy + 8, ox - 14, oy + 20], CR.brown, CR.brown, 185, { fill: 0.5, wob: 0.4 });
  crayonPoly(g, [ox + 16, oy - 6, ox + 21, oy + 8, ox + 14, oy + 20], CR.brown, CR.brown, 186, { fill: 0.5, wob: 0.4 });
  // big eyes behind round glasses
  for (const sd of [-1, 1]) {
    crayonEll(g, ox + sd * 7, oy - 9, 6, 6, CR.white, null, 187 + sd, { fill: 1, spill: 0, grain: 0 });
    rect(g, ox + sd * 7 - 1, oy - 10, 3, 3, CR.black);
    px(g, ox + sd * 7 - 1, oy - 10, '#ffffff');
    penEllipse(g, ox + sd * 7, oy - 9, 7, 7, { c: CR.black, seed: 189 + sd, over: 0.3 });
  }
  pen(g, [ox - 1, oy - 10, ox + 1, oy - 10], { c: CR.black, seed: 191, wob: 0 });
  crayonPoly(g, [ox - 3, oy - 3, ox + 3, oy - 3, ox, oy + 2], CR.orange, CR.orangeD, 192, { fill: 1, spill: 0, wob: 0.1 });
  // feet
  pen(g, [ox - 6, oy + 22, ox - 6, oy + 25], { c: CR.orange, seed: 193, w: 2, wob: 0 });
  pen(g, [ox + 6, oy + 22, ox + 6, oy + 25], { c: CR.orange, seed: 194, w: 2, wob: 0 });
  // speech bubble
  crayonEll(g, 220, 28, 25, 10, CR.white, CR.black, 195, { fill: 1, spill: 0, grain: 0 });
  pen(g, [206, 36, 194, 46, 212, 37], { c: CR.black, seed: 196, wob: 0.2 });
  scrawl(g, 'Hou hou !', 198, 21, CR.black, { seed: 197 });
  // fireflies (static part; they also twinkle)
  P3_FIREFLIES.forEach(([x, y]) => kidFirefly(g, x, y));
  // mushrooms
  crayonEll(g, 116, 132, 6, 4, CR.red, CR.redD, 198, { fill: 0.7 });
  pen(g, [116, 135, 116, 140], { c: CR.white, seed: 199, w: 3, wob: 0 });
  crayonEll(g, 222, 136, 5, 3, CR.red, CR.redD, 200, { fill: 0.7 });
  pen(g, [222, 138, 222, 143], { c: CR.white, seed: 201, w: 3, wob: 0 });
  // label + title
  scrawl(g, 'le hibou', 104, 60, CR.yellow, { seed: 202, bold: true });
  scrawl(g, 'il sait tout', 100, 71, CR.yellow, { seed: 203, bold: true });
  pen(g, [148, 70, 154, 66], { c: CR.yellow, seed: 205, wob: 0.1 });
  scrawl(g, 'La forêt des crayons', 92, 156, CR.purple, { seed: 204, bold: true, jit: 1.2 });
}

// ---------------------------------------------------------------------------------------------------------------
// Carnet page 4 — the last page
// ---------------------------------------------------------------------------------------------------------------

const P4_LINES = ['Si tu as peur du noir,', 'regarde la lune.', 'Moi je serai', 'ta veilleuse.'];

function paintPage4(g: Ctx): void {
  sketchbook(g, 14);
  // big moon with a sleepy smile, Mina waving from it
  kidMoon(g, 72, 62, 40, 210, { face: true });
  kidMina(g, 104, 92, 211, { s: 0.62, armR: [5, -25, 12, -34], armL: [-5, -25, -11, -18] });
  const stars: Array<[number, number, number]> = [
    [24, 22, 4],
    [130, 18, 3],
    [28, 112, 3],
    [122, 120, 4],
    [304, 24, 3],
    [150, 112, 2],
  ];
  stars.forEach(([x, y, r], i) => kidStar(g, x, y, r, CR.yellowD, 212 + i, CR.yellow));
  // the message
  const x0 = 140;
  P4_LINES.forEach((l, i) => scrawl(g, l, x0 + (i === 1 ? 8 : i === 3 ? 30 : i === 2 ? 22 : 0), 22 + i * 16, CR.navy, { seed: 220 + i, bold: true, jit: 1 }));
  scrawl(g, '— Mina', 232, 90, CR.red, { seed: 225, bold: true });
  kidHeart(g, 281, 95, 4, CR.red, CR.redD, 226);
  // the night-light under the text, with Noa asleep next to it
  kidVeilleuse(g, 232, 146, 1.1, 230);
  // Noa sleeping in bed
  crayonPoly(g, [116, 140, 196, 140, 196, 152, 116, 152], CR.brownL, CR.brown, 240, { fill: 0.5 });
  crayonPoly(g, [132, 130, 196, 130, 197, 144, 131, 144], CR.lilac, CR.purple, 241, { c2: CR.sky, mix: 0.2 });
  crayonEll(g, 124, 134, 7, 5, CR.white, CR.sky, 242, { fill: 0.9, spill: 0 });
  crayonEll(g, 128, 128, 6, 6, CR.skin, CR.brown, 243, { fill: 0.6 });
  crayonPoly(g, [121, 126, 124, 120, 130, 119, 135, 122, 134, 127, 130, 124, 126, 127], CR.navy, '#24305f', 244, { fill: 0.6, wob: 0.3 });
  pen(g, [126, 130, 128, 131], { c: CR.black, seed: 245, wob: 0 });
  pen(g, [116, 136, 116, 156], { c: CR.brown, seed: 246, w: 2, wob: 0.2 });
  pen(g, [196, 140, 196, 156], { c: CR.brown, seed: 247, w: 2, wob: 0.2 });
  scrawl(g, 'z', 140, 112, CR.blue, { seed: 248 });
  scrawl(g, 'z', 148, 104, CR.blue, { seed: 249 });
  // the light reaches him: dotted rays from the moon
  pen(g, [98, 102, 112, 112], { c: CR.yellowD, seed: 250, wob: 0.2, grain: 0.5 });
}

// ---------------------------------------------------------------------------------------------------------------
// Souvenir — the unfinished drawing
// ---------------------------------------------------------------------------------------------------------------

function paintDessin(g: Ctx): void {
  // hospital tray table (pale laminate in the dark)
  field(g, 0, 0, SW, SH, (x, y) => {
    const n = noise2(x * 0.03, y * 0.03, 300);
    return n < 0.4 ? '#4c5a66' : n > 0.7 ? '#5a6a74' : '#52606c';
  });
  rect(g, 0, 172, SW, 8, '#3a4550');
  rect(g, 0, 171, SW, 1, '#6d7f88');
  // the sheet (slightly offset shadow)
  const sx = 26;
  const sy = 8;
  const sw = 268;
  const sh = 158;
  rect(g, sx + 3, sy + 3, sw, sh, '#2e3842');
  field(g, sx, sy, sw, sh, (x, y) => {
    const h = hash(x, y, 301);
    if (h < 0.04) return PAPER2;
    const e = Math.min(x - sx, y - sy, sx + sw - 1 - x, sy + sh - 1 - y);
    if (e === 0) return PAPER3;
    return PAPER;
  });
  // night sky, coloured only on the left — it stops
  const limit = (y: number): number => 132 + noise1(y * 0.09, 302) * 10 + (y > 60 ? -18 : 0);
  const sky = wob((x, y) => x > sx + 6 && y > sy + 6 && y < 96 && x < limit(y), 1.5, 303);
  scribble(g, sky, [sx + 4, sy + 4, 170, 98], CR.navy, { seed: 304, angle: -0.5, c2: CR.blue, mix: 0.25, fill: 0.3 });
  // the strokes trail off
  for (let i = 0; i < 7; i++) {
    const y = 18 + i * 11;
    const x = limit(y) - 6;
    pen(g, [x, y, x + 10 + hash(i, 0, 305) * 12, y - 6], { c: CR.navy, seed: 306 + i, wob: 0.5, grain: 0.3 });
  }
  // big moon: half coloured
  const mx = 206;
  const my = 54;
  const mr = 34;
  const moon = wob(ell(mx, my, mr, mr), 0.8, 310);
  scribble(g, inter(moon, (x) => x < mx - 4 + noise1(my, 3) * 3), [mx - mr - 3, my - mr - 3, mx + 2, my + mr + 3], CR.yellow, { seed: 311, angle: 0.7, c2: CR.yellowD, mix: 0.12 });
  for (let i = 0; i < 5; i++) {
    const y = my - 24 + i * 12;
    pen(g, [mx - 6, y, mx + 4 + hash(i, 1, 312) * 6, y - 5], { c: CR.yellow, seed: 313 + i, w: 2, wob: 0.4, grain: 0.3 });
  }
  outline(g, moon, [mx - mr - 3, my - mr - 3, mx + mr + 3, my + mr + 3], CR.yellowD, { seed: 314, w: 2 });
  // moon face
  pen(g, [mx - 14, my - 6, mx - 10, my - 3, mx - 6, my - 6], { c: CR.black, seed: 315, wob: 0.1 });
  pen(g, [mx + 6, my - 6, mx + 10, my - 3, mx + 14, my - 6], { c: CR.black, seed: 316, wob: 0.1 });
  pen(g, [mx - 8, my + 10, mx, my + 15, mx + 8, my + 10], { c: CR.red, seed: 317, wob: 0.1 });
  // outlined stars only on the right
  const st: Array<[number, number, number]> = [
    [256, 26, 5],
    [270, 86, 4],
    [160, 22, 4],
    [282, 116, 3],
  ];
  st.forEach(([x, y, r], i) => kidStar(g, x, y, r, CR.yellowD, 320 + i));
  kidStar(g, 60, 26, 5, CR.yellowD, 325, CR.yellow);
  kidStar(g, 100, 44, 4, CR.yellowD, 326, CR.yellow);
  // ground line: green on the left, outline only after
  const hill = (x: number): number => 112 + Math.sin(x * 0.03) * 4;
  const gr = wob((x, y) => x > sx + 6 && x < 150 + noise1(y * 0.2, 9) * 8 && y > hill(x) && y < sy + sh - 6, 1, 327);
  scribble(g, gr, [sx + 4, 100, 162, sy + sh - 4], CR.green, { seed: 328, angle: -0.3, c2: CR.greenD, mix: 0.2, fill: 0.3 });
  pen(g, Array.from({ length: 27 }, (_, i) => [sx + 6 + i * 10, hill(sx + 6 + i * 10)]).flat(), { c: CR.greenD, seed: 329, wob: 0.6 });
  // the two children holding hands — Noa coloured, Mina only outlined
  kidNoa(g, 120, 118, 330, { s: 1.1, armR: [11, -34, 18, -23] });
  kidMina(g, 158, 118, 340, { s: 1.1, colored: false, armL: [-5, -25, -12, -22] });
  // title in pencil, in the blank part
  scrawl(g, 'Noa et moi', 222, 98, CR.black, { seed: 350 });
  // the yellow crayon, left where it stopped
  waxCrayon(g, 236, 132, 40, -0.42, CR.yellow, CR.yellowD, '#fff0a0');
  // night: the whole sheet sits in the dark, a little light from the window
  withAlpha(g, 0.3, () => rect(g, 0, 0, SW, SH, '#101830'));
  for (let k = 0; k < 6; k++) {
    const rx = 196 - k * 11;
    const ry = 122 - k * 8;
    withAlpha(g, 0.11, () => fillP(g, (x, y) => ((x - 150) / rx) ** 2 + ((y - 78) / ry) ** 2 > 1, [0, 0, SW, SH], '#070b18'));
  }
}

/** A wax crayon lying on the table, seen from above (diagonal, 5 px thick, paper wrapper). */
function waxCrayon(g: Ctx, x: number, y: number, len: number, slope: number, c: string, cD: string, cL: string): void {
  const n = Math.hypot(1, slope);
  const ux = 1 / n;
  const uy = slope / n;
  // shadow first
  for (let i = 2; i <= len; i += 0.5) for (let o = -1; o <= 3; o++) px(g, x + ux * i - uy * o + 1, y + uy * i + ux * o + 2, '#00000033');
  for (let i = 0; i <= len; i += 0.5) {
    const tipW = i < 5 ? Math.floor(i / 2) : 2;
    for (let o = -tipW; o <= tipW; o += 0.5) {
      const wrap = i > 10 && i < len - 5;
      let col = o < -1 ? cL : o > 1 ? cD : c;
      if (wrap) col = o < -1 ? '#fff8d8' : o > 1 ? '#d9c88a' : '#f3e7b0';
      if (wrap && (Math.floor(i) === 14 || Math.floor(i) === len - 9)) col = cD;
      if (i > len - 1) col = cD;
      px(g, x + ux * i - uy * o, y + uy * i + ux * o, col);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------

export const ILLUSTRATIONS: Record<string, Illustration> = {
  carnet_couverture: (g, t) => {
    g.drawImage(layer('carnet_couverture', paintCover), 0, 0);
    // star stickers catch the light one after another
    const i = Math.floor(t / 50) % STAR_STICKERS.length;
    const [sx, sy, r] = STAR_STICKERS[i]!;
    const ph = (t % 50) / 50;
    withAlpha(g, Math.sin(ph * Math.PI), () => sparkle(g, sx - r * 0.3, sy - r * 0.4, 2 + Math.round(ph * 2), '#fffaf2'));
    motes(g, t, 14, 2, [0, 0, 320, 180]);
  },
  carnet_page1: (g, t) => {
    g.drawImage(layer('carnet_page1', paintPage1), 0, 0);
    motes(g, t, 10, 1, [20, 10, 300, 170]);
  },
  carnet_page2: (g, t) => {
    g.drawImage(layer('carnet_page2', paintPage2), 0, 0);
    motes(g, t, 10, 3, [20, 10, 300, 170]);
  },
  carnet_page3: (g, t) => {
    g.drawImage(layer('carnet_page3', paintPage3), 0, 0);
    // fireflies glow softly, each on its own rhythm
    P3_FIREFLIES.forEach(([x, y], i) => {
      const a = 0.5 + 0.5 * Math.sin(t * 0.06 + i * 2.1);
      withAlpha(g, a * 0.55, () => {
        rect(g, x - 2, y - 1, 5, 3, '#fff3a0');
        rect(g, x - 1, y - 2, 3, 5, '#fff3a0');
      });
      withAlpha(g, a, () => px(g, x, y, '#ffffff'));
    });
    motes(g, t, 8, 4, [20, 10, 300, 170]);
  },
  carnet_page4: (g, t) => {
    g.drawImage(layer('carnet_page4', paintPage4), 0, 0);
    // the drawn night-light seems to glow
    const a = 0.18 + 0.1 * Math.sin(t * 0.03);
    withAlpha(g, a, () => {
      fillP(g, ell(231, 134, 22, 18), [208, 115, 255, 153], (x, y) => (bayer(x, y) < 0.5 ? '#fff0a0' : null));
    });
    motes(g, t, 10, 5, [20, 10, 300, 170]);
  },
  souvenir_dessin: (g, t) => {
    g.drawImage(layer('souvenir_dessin', paintDessin), 0, 0);
    motes(g, t, 8, 6, [40, 10, 280, 160], '#c8d4f0');
  },
};

export interface Souvenir {
  title: string;
  image: string;
  captions: string[];
}

export const SOUVENIRS: Record<string, Souvenir> = {};

void rect;
void line;
void art;
void sparkle;
void minus;
void ramp;
void fillP;

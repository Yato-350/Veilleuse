import type { CharDef, SpriteDef } from '../../game/assets';
import { parseRows } from '../../engine/sprite';
import { mix, PAL, realify } from '../../engine/palette';
import { CHARS as CHARACTER_CHARS } from './characters';
import { ART as PROP_ART } from './props';

/*
 * VEILLEUSE — sprites of the bonus chapter « Les rêves des autres » (Maman's dream).
 *
 * - Le Réveil (the alarm clock Maman set for 5:00 on the last night, and that never rang): a little hopping clock on
 *   the map (`npc_reveil`), its portraits (`face_reveil_*`), and the boss in three moods (`b_reveil` ticking,
 *   `b_reveil_sonne` ringing, `b_reveil_fele` cracked and sleepy).
 * - Regular enemies: Sonnette (a care-home call button), Café Serré (the fourth coffee of the night), Le Panier
 *   (the laundry basket with Mina's star pyjamas at the bottom). Battle `b_*` and map `ow_*` sprites, two frames each.
 * - People of the night shift (Sabine, M. Albert in his wheelchair, Nadia the night nurse) and Maman's poses (seated
 *   on a bench, asleep in the parents' armchair).
 * - Props: the parents' armchair, lockers, coffee machine, vending machine, care cart, call lights above doors.
 *
 * VARIANTS = ['real']: the apartment of the bonus chapter is a real-world map. Maman gets a real-world look there too
 * (`maman@real`, built from her walking frames).
 */

// ---------------------------------------------------------------------------
// Toolkit
// ---------------------------------------------------------------------------

/** Light direction (top-left, towards the viewer), normalised. */
const LIGHT = (() => {
  const v = [-0.55, -0.7, 0.6];
  const n = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / n) as [number, number, number];
})();

/** Colour ramp: [highlight, base, shade, deep shade]. */
type Ramp = [string, string, string, string];

/** A tiny pixel canvas working on palette characters ('.' = transparent). */
class Px {
  g: string[][];
  constructor(w: number, h: number) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  static of(src: string): Px {
    const rows = parseRows(src);
    const p = new Px(Math.max(...rows.map((r) => r.length)), rows.length);
    rows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && c !== ' ' && p.px(x, y, c)));
    return p;
  }
  get w(): number {
    return this.g[0]?.length ?? 0;
  }
  get h(): number {
    return this.g.length;
  }
  get(x: number, y: number): string {
    return this.g[Math.round(y)]?.[Math.round(x)] ?? '.';
  }
  solid(x: number, y: number): boolean {
    return this.get(x, y) !== '.';
  }
  px(x: number, y: number, c: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.g[y]![x] = c;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  hl(x: number, y: number, len: number, c: string): this {
    return this.rect(x, y, len, 1, c);
  }
  vl(x: number, y: number, len: number, c: string): this {
    return this.rect(x, y, 1, len, c);
  }
  oval(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c);
    return this;
  }
  /** Shaded ellipse lit from the top-left. */
  ball(cx: number, cy: number, rx: number, ry: number, ramp: Ramp, cut: [number, number, number] = [0.8, 0.3, -0.15]): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d));
        const i = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
        this.px(x, y, i > cut[0] ? ramp[0] : i > cut[1] ? ramp[1] : i > cut[2] ? ramp[2] : ramp[3]);
      }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    return this;
  }
  /** Filled polygon (pixel centres inside). */
  poly(pts: Array<[number, number]>, c: string): this {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]!;
          const [xj, yj] = pts[j]!;
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.px(x, y, c);
      }
    return this;
  }
  /** Overlays art ('.' keeps what is below, '~' erases). */
  stamp(src: string, x: number, y: number): this {
    parseRows(src).forEach((row, j) =>
      [...row].forEach((ch, i) => {
        if (ch === '.' || ch === ' ') return;
        this.px(x + i, y + j, ch === '~' ? '.' : ch);
      }),
    );
    return this;
  }
  /** Pastes another canvas ('.' skipped). */
  blit(p: Px, ox = 0, oy = 0): this {
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.solid(x, y)) this.px(ox + x, oy + y, p.get(x, y));
    return this;
  }
  /** Replaces colours (optionally only in rows y0..y1). */
  swap(map: Record<string, string>, y0 = 0, y1 = 1e9): this {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let x = 0; x < this.w; x++) {
        const c = map[this.g[y]![x]!];
        if (c !== undefined) this.g[y]![x] = c;
      }
    return this;
  }
  /** Every `from` pixel within `depth` steps of the outside in direction (dx, dy) becomes `to`. */
  rim(from: string, to: string, dx: number, dy: number, depth = 1): this {
    const src = this.g.map((r) => [...r]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (src[y]![x] !== from) continue;
        for (let i = 1; i <= depth; i++) {
          const n = src[y + dy * i]?.[x + dx * i] ?? '.';
          if (n === '.' || n === 'k') {
            this.g[y]![x] = to;
            break;
          }
        }
      }
    return this;
  }
  /** Drawn pixels touching the outside (4-neighbours) become `c` (an inner contour). */
  edge(c = 'k'): this {
    const src = this.g.map((r) => [...r]);
    const s = (x: number, y: number) => (src[y]?.[x] ?? '.') !== '.';
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (s(x, y) && (!s(x - 1, y) || !s(x + 1, y) || !s(x, y - 1) || !s(x, y + 1))) this.g[y]![x] = c;
    return this;
  }
  /** Moves everything by (dx, dy). */
  shift(dx: number, dy: number): Px {
    const p = new Px(this.w, this.h);
    return p.blit(this, dx, dy);
  }
  toString(): string {
    return this.g.map((r) => r.join('')).join('\n');
  }
}

const RED: Ramp = ['p', 'r', 'R', 'u'];
const RED_DARK: Ramp = ['r', 'R', 'u', 'K'];
const BRASS: Ramp = ['y', 'Y', 'O', 'x'];
const FACE: Ramp = ['f', 'q', 'q', 'Q'];
const WHITE: Ramp = ['f', 'w', 'W', 'g'];
/** Pale institutional green and its shade (hospital vinyl), as in the paper hospital props. */
const MINT = { '6': mix(PAL.a!, PAL.g!, 0.45), '7': mix(PAL.A!, PAL.G!, 0.5) };

// ---------------------------------------------------------------------------
// Le Réveil
// ---------------------------------------------------------------------------

type Mood = 'calme' | 'sonne' | 'fele';

/** Clock hand from (cx, cy) towards a clock position (minutes 0..60), `len` pixels long. */
function hand(p: Px, cx: number, cy: number, minutes: number, len: number, c: string): void {
  const a = (minutes / 60) * Math.PI * 2;
  p.line(cx, cy, cx + Math.sin(a) * len, cy - Math.cos(a) * len, c);
}

/** Boss (56x64): twin brass bells, red body, cream face. 'calme' ticks at 3:33, 'sonne' rings, 'fele' is cracked. */
function reveil(mood: Mood, f: 0 | 1): string {
  const p = new Px(56, 64);
  const ring = mood === 'sonne';
  const sx = ring ? (f ? 1 : -1) : 0;
  // Feet.
  for (const x of [14, 36]) {
    p.rect(x + 1, 53, 5, 7, 'O').vl(x + 1, 53, 7, 'Y');
    p.ball(x + 3.5, 60.5, 4, 2, BRASS);
  }
  // Bells (behind the body), with knobs.
  const bell = (cx: number, cy: number) => {
    p.ball(cx, cy, 9, 8, BRASS).ball(cx, cy - 8, 2, 2, BRASS);
    p.hl(cx - 8, cy + 6, 17, 'O');
  };
  bell(11 + sx, 14 + (mood === 'fele' ? 2 : 0));
  bell(45 - sx, 14);
  // Handle (an arch over the top) and hammer.
  for (let a = Math.PI; a <= Math.PI * 2; a += 0.03) {
    p.px(28 + Math.cos(a) * 9.5, 12 + Math.sin(a) * 7, 'O');
    p.px(28 + Math.cos(a) * 8.5, 12 + Math.sin(a) * 6, a < Math.PI * 1.5 ? 'y' : 'Y');
  }
  const hx = ring ? (f ? 31 : 25) : 28;
  p.line(28, 16, hx, 11, 'd').ball(hx, 10, 2.2, 2.2, ['W', 'g', 'G', 'd']);
  // Body.
  p.ball(28, 36, 21, 20, mood === 'fele' ? RED_DARK : RED);
  // Bezel and face.
  p.oval(28, 37, 16.6, 16.6, 'W');
  for (let a = Math.PI * 0.9; a <= Math.PI * 1.6; a += 0.04) p.px(28 + Math.cos(a) * 16.2, 37 + Math.sin(a) * 16.2, 'f');
  for (let a = -0.2; a <= Math.PI * 0.6; a += 0.04) p.px(28 + Math.cos(a) * 16.2, 37 + Math.sin(a) * 16.2, 'g');
  p.ball(28, 37, 15, 15, FACE);
  // Hour marks.
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2;
    const big = h % 3 === 0;
    const r = big ? 12.5 : 13;
    p.px(28 + Math.sin(a) * r, 37 - Math.cos(a) * r, big ? 'd' : 'G');
    if (big) p.px(28 + Math.sin(a) * (r - 1), 37 - Math.cos(a) * (r - 1), 'd');
  }
  // Face.
  if (mood === 'calme') {
    p.oval(22, 32, 2, 3, 'k').oval(34, 32, 2, 3, 'k').px(21, 30, 'f').px(33, 30, 'f');
    p.px(18, 37, 'p').px(19, 37, 'p').px(37, 37, 'p').px(38, 37, 'p');
    hand(p, 28, 40, 15, 8, 'k');
    hand(p, 28, 40, f ? 34 : 33, 11, 'k');
    p.rect(27, 39, 3, 3, 'R').px(28, 40, 'k');
  } else if (mood === 'sonne') {
    p.line(18, 28, 24, 31, 'k').line(38, 28, 32, 31, 'k');
    p.oval(22, 33, 1.6, 2, 'k').oval(34, 33, 1.6, 2, 'k');
    // Both hands straight up: the alarm time.
    p.line(28, 40, 28, 28, 'k').line(27, 40, 27, 31, 'K');
    p.oval(28, 46, 5, 3.6, 'K').oval(28, 47, 3, 1.8, 'R');
    p.rect(27, 39, 3, 3, 'R').px(28, 40, 'k');
    // Shaking lines around the bells.
    const o = f ? 1 : 0;
    p.line(1 + o, 6, 3 + o, 9, 'y').line(0, 14 + o, 2, 14 + o, 'y').line(53 - o, 6, 51 - o, 9, 'y').line(55, 14 + o, 53, 14 + o, 'y');
    p.line(4, 22 + o, 6, 24 + o, 'y').line(51, 22 + o, 49, 24 + o, 'y');
  } else {
    // Cracked glass, sleepy closed eyes, hands stopped at 3:33.
    p.hl(20, 33, 5, 'k').px(19, 32, 'k').px(25, 32, 'k');
    p.hl(32, 33, 5, 'k').px(31, 32, 'k').px(37, 32, 'k');
    hand(p, 28, 40, 15, 8, 'G');
    hand(p, 28, 40, 33, 11, 'G');
    p.rect(27, 39, 3, 3, 'R').px(28, 40, 'k');
    const crack: Array<[number, number]> = [[16, 26], [20, 30], [19, 34], [24, 38], [22, 43], [26, 48]];
    for (let i = 0; i + 1 < crack.length; i++) p.line(crack[i]![0], crack[i]![1], crack[i + 1]![0], crack[i + 1]![1], 'G');
    p.line(20, 30, 15, 33, 'G').line(24, 38, 30, 36, 'g');
    for (const [x, y] of crack) p.px(x + 1, y, 'f');
    if (f) p.stamp('kkkk\n..k.\n.k..\nkkkk', 50, 0);
    else p.stamp('kkk\n..k\nkkk', 51, 1);
  }
  return p.toString();
}

/** Small hopping clock for the map (16x18 before outline). */
function reveilSmall(f: 0 | 1, dark: boolean): string {
  const p = new Px(16, 18);
  p.ball(3.5, 4.5, 3.2, 3, BRASS).ball(12.5, 4.5, 3.2, 3, BRASS);
  p.hl(6, 1, 4, 'O').px(8, 2, 'd').px(8, 3, 'd');
  p.ball(8, 10.5, 6.6, 6.4, dark ? RED_DARK : RED);
  p.ball(8, 11, 4.6, 4.6, FACE);
  if (dark) {
    p.px(5, 9, 'k').px(6, 10, 'k').px(11, 9, 'k').px(10, 10, 'k');
  } else {
    p.vl(6, 9, 2, 'k').vl(10, 9, 2, 'k');
  }
  p.px(8, 12, 'k').px(9, 12, 'k').px(10, 12, 'k');
  if (f) p.px(8, 13, 'k').px(8, 14, 'k');
  else p.px(7, 13, 'k').px(7, 14, 'k');
  p.hl(3, 17, 3, 'O').hl(10, 17, 3, 'O');
  return p.toString();
}

/** Portrait (32x32). */
function reveilFace(expr: 'neutral' | 'happy' | 'angry' | 'sad'): string {
  const p = new Px(32, 32);
  const angry = expr === 'angry';
  p.ball(6.5, 8, 6, 5.5, BRASS).ball(25.5, 8, 6, 5.5, BRASS).ball(6.5, 2.5, 1.5, 1.5, BRASS).ball(25.5, 2.5, 1.5, 1.5, BRASS);
  p.ball(16, 20, 13, 12.5, angry ? RED_DARK : RED);
  p.oval(16, 20.5, 10.6, 10.6, 'W');
  p.ball(16, 20.5, 9.6, 9.6, FACE);
  for (let h = 0; h < 12; h += 3) {
    const a = (h / 12) * Math.PI * 2;
    p.px(16 + Math.sin(a) * 8.4, 20.5 - Math.cos(a) * 8.4, 'G');
  }
  if (expr === 'neutral') {
    p.oval(12.5, 17.5, 1.4, 2, 'k').oval(19.5, 17.5, 1.4, 2, 'k').px(12, 16, 'f').px(19, 16, 'f');
    hand(p, 16, 22, 15, 4, 'k');
    hand(p, 16, 22, 33, 6, 'k');
  } else if (expr === 'happy') {
    p.stamp('.kk.\nk..k', 10, 16).stamp('.kk.\nk..k', 17, 16);
    p.px(9, 20, 'p').px(10, 20, 'p').px(21, 20, 'p').px(22, 20, 'p');
    p.stamp('k....k\n.kkkk.', 13, 23);
  } else if (expr === 'angry') {
    p.line(9, 14, 13, 16, 'k').line(23, 14, 19, 16, 'k');
    p.px(12, 18, 'k').px(12, 19, 'k').px(20, 18, 'k').px(20, 19, 'k');
    p.vl(16, 13, 9, 'k');
    p.oval(16, 25, 3, 2, 'K').hl(15, 26, 3, 'R');
  } else {
    p.hl(10, 18, 4, 'k').hl(18, 18, 4, 'k').px(10, 19, 'k').px(21, 19, 'k');
    p.px(11, 21, 'b').px(11, 22, 'b');
    hand(p, 16, 22, 30, 6, 'G');
    hand(p, 16, 22, 33, 4, 'G');
  }
  p.px(16, 22, 'R');
  return p.toString();
}

// ---------------------------------------------------------------------------
// Sonnette — a call button from the care home, with its little red light
// ---------------------------------------------------------------------------

function sonnette(f: 0 | 1): string {
  const p = new Px(40, 46);
  // Curly cord, behind.
  for (let y = 33; y < 46; y++) {
    const x = 19 - (y - 33) * 0.9 + Math.sin(y * 1.1) * 2.2;
    p.px(x, y, 'G').px(x + 1, y, 'd');
  }
  // Light on its little post.
  p.rect(18, 9, 5, 4, 'G').hl(18, 9, 5, 'g');
  p.ball(20.5, 7, 6, 5, f ? ['f', 'y', 'o', 'r'] : ['p', 'P', 'R', 'u']).hl(15, 11, 12, 'd');
  if (f) {
    p.line(11, 3, 9, 1, 'y').line(30, 3, 32, 1, 'y').line(20, 0, 20, 0, 'y').line(8, 8, 6, 8, 'y').line(33, 8, 35, 8, 'y');
  }
  // Casing (rounded white box), lit from the top-left.
  const box = new Px(40, 46);
  box.rect(6, 13, 29, 21, 'w');
  box.px(6, 13, '.').px(34, 13, '.').px(6, 33, '.').px(34, 33, '.');
  box.rim('w', 'f', -1, 0, 1).rim('w', 'f', 0, -1, 1).rim('w', 'W', 1, 0, 2).rim('w', 'W', 0, 1, 2);
  p.blit(box.edge('k'));
  // The big red button: the face.
  p.oval(20.5, 23.5, 9.6, 9.2, 'k');
  p.ball(20.5, 23.5, 8.6, 8.2, RED);
  p.oval(17, 21.5, 2.4, 2.8, 'w').oval(24, 21.5, 2.4, 2.8, 'w');
  p.px(f ? 18 : 17, 22, 'k').px(f ? 18 : 17, 21, 'k').px(f ? 23 : 24, 22, 'k').px(f ? 23 : 24, 21, 'k');
  if (f) p.oval(20.5, 28, 2.4, 2, 'K').hl(20, 29, 2, 'R');
  else p.oval(20.5, 28, 1.6, 1.4, 'K');
  // A label on the casing.
  p.rect(26, 30, 6, 2, 'b').hl(27, 30, 3, 'B');
  return p.toString();
}

const OW_SONNETTE = (f: 0 | 1): string => {
  const p = new Px(12, 15);
  p.ball(6, 2.5, 3, 2.4, f ? ['f', 'y', 'o', 'r'] : ['p', 'P', 'R', 'u']);
  p.rect(5, 4, 2, 1, 'G');
  p.rect(1, 5, 10, 8, 'w').hl(1, 5, 10, 'f').vl(10, 5, 8, 'W').hl(1, 12, 10, 'W');
  p.ball(6, 8.5, 3.2, 3, RED).px(5, 8, 'w').px(7, 8, 'w');
  p.px(6, 13, 'G').px(5, 14, 'G').px(4, 14, 'd');
  return p.toString();
};

// ---------------------------------------------------------------------------
// Café Serré — the fourth coffee of the night
// ---------------------------------------------------------------------------

function cafe(f: 0 | 1): string {
  const p = new Px(40, 48);
  const j = f ? 1 : 0;
  // Saucer.
  p.ball(20, 43, 17, 3.6, WHITE).hl(4, 44, 33, 'g');
  // Sugar cube.
  p.rect(31, 38, 4, 4, 'f').vl(34, 38, 4, 'W').hl(31, 41, 4, 'W');
  // Handle (behind the mug's right side).
  p.oval(32 + j, 28, 5.5, 6.5, 'k').oval(32 + j, 28, 4.5, 5.5, 'w').oval(32 + j, 28, 2.4, 3.4, 'k').oval(32 + j, 28, 1.5, 2.5, '.');
  // Mug: a shaded cylinder.
  const mug = new Px(40, 48);
  for (let x = 8; x <= 31; x++) {
    const u = (x - 8) / 23;
    const c = u < 0.12 ? 'w' : u < 0.22 ? 'f' : u < 0.7 ? 'w' : u < 0.88 ? 'W' : 'g';
    mug.vl(x + j, 17, 23, c);
  }
  mug.oval(19.5 + j, 39.5, 11.9, 2.5, 'W').oval(19.5 + j, 39, 11, 2, 'w');
  p.blit(mug.edge('k'));
  // Rim and coffee.
  p.oval(19.5 + j, 17, 12.4, 3.4, 'k').oval(19.5 + j, 17, 11.4, 2.6, 'W').oval(19.5 + j, 17.4, 10, 1.9, 'x').hl(13 + j, 17, 4, 'C');
  // Face: wide jittery eyes, raised brows, a tight grin.
  p.oval(14.5 + j, 25, 2.6, 3.2, 'k').oval(24.5 + j, 25, 2.6, 3.2, 'k');
  p.px(14 + j, 24, 'f').px(24 + j, 24, 'f').px(15 + j, 26, 'w').px(25 + j, 26, 'w');
  p.line(11 + j, 20 + j, 16 + j, 20, 'k').line(28 + j, 20 + j, 23 + j, 20, 'k');
  p.rect(14 + j, 31, 12, 3, 'k');
  for (let x = 15; x < 25; x += 2) p.px(x + j, 31, 'w').px(x + 1 + j, 33, 'w');
  p.px(11 + j, 29, 'p').px(28 + j, 29, 'p');
  // Steam.
  for (let t = 0; t < 11; t++) {
    p.px(14 + Math.sin(t * 0.8 + f * 1.6) * 2, 13 - t, t > 7 ? 'g' : 'W');
    p.px(24 + Math.sin(t * 0.8 + 2 + f * 1.6) * 2, 14 - t, t > 8 ? 'g' : 'W');
  }
  if (f) p.px(6, 14, 'x').px(5, 12, 'x').px(34, 12, 'x').px(36, 15, 'x');
  return p.toString();
}

const OW_CAFE = (f: 0 | 1): string => {
  const p = new Px(14, 15);
  for (let t = 0; t < 4; t++) p.px(5 + Math.sin(t + f * 1.7), 3 - t, 'W').px(9 + Math.sin(t + 2 + f * 1.7), 3 - t, 'W');
  p.rect(2, 5, 9, 8, 'w').vl(2, 5, 8, 'f').vl(9, 5, 8, 'W').vl(10, 5, 8, 'g');
  p.hl(3, 5, 7, 'x');
  p.oval(11.5, 8.5, 2, 2.5, 'w').oval(11.5, 8.5, 0.9, 1.4, '.');
  p.px(4, 8, 'k').px(7, 8, 'k').hl(4, 10, 4, 'k');
  p.hl(0, 13, 13, 'W').hl(1, 14, 11, 'g');
  return p.toString();
};

// ---------------------------------------------------------------------------
// Le Panier — the laundry basket left in front of Mina's door
// ---------------------------------------------------------------------------

function panier(f: 0 | 1): string {
  const p = new Px(46, 46);
  const d = f ? 1 : 0;
  // Clothes overflowing: the star pyjamas, a sock, a sleeve.
  p.ball(18, 14 + d, 11, 6.5, ['b', 'B', 'n', 'z']);
  p.ball(31, 13 + d, 7, 5, ['l', 'L', 'e', 'E']);
  for (const [x, y] of [[11, 12], [16, 10], [22, 13], [14, 16], [25, 10], [20, 17]] as Array<[number, number]>)
    p.px(x, y + d, 'y').px(x + 1, y + d, 'y').px(x, y + 1 + d, 'Y');
  // Sock: white with pink stripes, hanging over the right rim.
  p.poly([[33, 12 + d], [38, 12 + d], [41, 24], [37, 26], [35, 22]], 'w');
  p.hl(34, 15 + d, 5, 'p').hl(35, 19, 4, 'p').hl(37, 23, 3, 'P');
  // The little red cape, over the left rim.
  p.poly([[4, 13 + d], [12, 15 + d], [10, 28 - d], [3, 26 - d]], 'r');
  p.line(4, 14 + d, 3, 25 - d, 'p').line(10, 17, 9, 27 - d, 'R');
  p.px(7, 20, 'y').px(6, 21, 'y').px(8, 21, 'y').px(7, 22, 'y');
  // Wicker basket: trapezoid, woven, shaded on the right.
  const b = new Px(46, 46);
  b.poly([[6, 19 + d], [39, 19 + d], [36, 44], [9, 44]], 'c');
  for (let y = 20 + d; y < 44; y++)
    for (let x = 0; x < 46; x++) {
      if (!b.solid(x, y)) continue;
      const weave = (x + Math.floor(y / 2) * 2) % 5 < 2;
      const right = x > 30 - (y - 19) * 0.12;
      b.px(x, y, (y - d) % 4 === 0 ? 'x' : weave ? (right ? 'x' : 'C') : right ? 'C' : 'c');
    }
  b.rect(5, 17 + d, 36, 3, 'C').hl(5, 17 + d, 36, 'q').hl(5, 19 + d, 36, 'x');
  p.blit(b.edge('k'));
  // Handles.
  p.rect(7, 25, 4, 2, 'x').rect(35, 25, 4, 2, 'x');
  // A towel draped over the front: the face is on it (tired closed eyes, a tear, a small wobbly mouth).
  const t = new Px(46, 46);
  t.poly([[12, 18 + d], [34, 18 + d], [33, 35], [29, 37], [24, 35], [19, 37], [13, 35]], 'w');
  t.rim('w', 'f', -1, 0, 1).rim('w', 'W', 1, 0, 2).rim('w', 'W', 0, 1, 1);
  t.hl(13, 32, 20, 'p').hl(13, 33, 20, 'P');
  p.blit(t.edge('k'));
  p.stamp('k...k\n.kkk.', 15, 24 + d).stamp('k...k\n.kkk.', 26, 24 + d);
  p.px(16, 27 + d, 'b').px(16, 28 + d, 'B');
  p.stamp('.kk.k\nk..k.', 21, 29 + d);
  return p.toString();
}

const OW_PANIER = (f: 0 | 1): string => {
  const p = new Px(16, 15);
  const d = f ? 1 : 0;
  p.ball(7, 4 + d, 5, 3, ['a', 'b', 'B', 'n']).px(5, 3 + d, 'y').px(8, 4 + d, 'y');
  p.ball(11, 4 + d, 3, 2.4, ['f', 'w', 'W', 'g']);
  p.poly([[1, 4 + d], [4, 5 + d], [3, 10], [1, 9]], 'r');
  p.poly([[2, 6 + d], [14, 6 + d], [13, 14], [3, 14]], 'c');
  for (let y = 7 + d; y < 14; y += 2) p.hl(3, y, 10, 'C');
  p.hl(2, 6 + d, 13, 'C').vl(12, 7 + d, 7, 'x');
  return p.toString();
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const MAMAN_STAND = CHARACTER_CHARS.maman!.down[0]!;

/**
 * Another adult of the night, from Maman's silhouette: hair and clothes recoloured (rows 0–13 are the head).
 * `hair` = [base, shade], `cloth` = [base, shade].
 */
function adult(hair: [string, string], cloth: [string, string], extra?: (p: Px) => void): string {
  const p = Px.of(MAMAN_STAND);
  p.swap({ x: hair[0], C: hair[1], K: hair[1] }, 0, 12);
  p.swap({ c: cloth[0], C: cloth[1] }, 13, 99);
  extra?.(p);
  return p.toString();
}

/** Sabine, the night colleague: dark hair, blue scrubs, a badge, a pen in the pocket. */
const SABINE = adult(['K', 'd'], ['b', 'B'], (p) => {
  p.px(5, 17, 'w').px(6, 17, 'w').px(5, 18, 'B');
  p.px(10, 16, 'r').px(10, 17, 'G');
  // Short hair: no bun.
  p.stamp('~~~~~~~~~~~~~~~~\n~~~~~~~~~~~~~~~~\n~~~~~~~~~~~~~~~~\n~~~~~~~~~~~~~~~~', 0, 0);
  p.stamp('.....kkkkkk.....', 0, 2);
  p.stamp('...kkKdKKKKkk...', 0, 3);
});

/** Nadia, the night nurse of the pediatric ward: auburn ponytail, aqua scrubs, a little torch. */
const NADIA = adult(['O', 'x'], ['a', 'A'], (p) => {
  p.px(5, 17, 'w').px(6, 17, 'w');
  p.px(3, 21, 'y').px(3, 22, 'G');
  p.px(14, 6, 'O').px(14, 7, 'O').px(15, 8, 'x').px(15, 9, 'k').px(14, 9, 'k');
});

/** M. Albert, in his wheelchair: white hair, glasses, brown cardigan, a plaid blanket on his knees. */
const ALBERT = (() => {
  const chair = Px.of(String(PROP_ART.prop_h_wheelchair));
  const p = new Px(16, 24);
  p.blit(chair, 0, 8);
  const man = new Px(16, 24);
  // Head: bald on top, a crown of white hair, round glasses, a white moustache.
  man.oval(8, 5.5, 4, 4.6, 's').px(6, 2, 'f').px(7, 2, 'f').px(11, 7, 'S').px(11, 8, 'S');
  man.vl(4, 4, 4, 'w').vl(12, 4, 4, 'W').px(5, 3, 'w').px(11, 3, 'W').px(4, 8, 'W');
  man.stamp('GGG.GGG\nGkG.GkG\nGGGGGGG', 5, 4);
  man.hl(6, 8, 5, 'w').px(8, 9, 't');
  // Cardigan and arms.
  man.rect(4, 10, 8, 6, 'C').vl(4, 10, 6, 'c').vl(11, 10, 6, 'x').px(7, 10, 'w').px(8, 10, 'w');
  man.px(3, 14, 's').px(12, 14, 's');
  // Blanket over the knees.
  man.rect(3, 15, 10, 4, 'e').hl(3, 15, 10, 'L').vl(6, 15, 4, 'E').vl(10, 15, 4, 'E').hl(3, 17, 10, 'E');
  p.blit(man.edge('k'));
  return p.toString();
})();

/** Maman seated, eyes closed (on a bench). 16x24. */
const MAMAN_SIT = (() => {
  const src = Px.of(MAMAN_STAND);
  const p = new Px(16, 24);
  // Head and shoulders (rows 0..18 of the standing frame).
  for (let y = 0; y <= 18; y++) for (let x = 0; x < 16; x++) if (src.solid(x, y)) p.px(x, y, src.get(x, y));
  // Closed eyes: the eye pixels become skin, the lower lids a dark line.
  p.swap({ k: 's' }, 9, 9).px(1, 9, 'k').px(14, 9, 'k');
  p.hl(4, 10, 2, 'k').hl(11, 10, 2, 'k');
  // Lap, hands, knees and shoes.
  p.rect(2, 19, 12, 3, 'c').hl(2, 21, 12, 'C').rect(6, 18, 4, 2, 's').hl(6, 19, 4, 'S');
  p.rect(4, 22, 3, 2, 'K').rect(9, 22, 3, 2, 'K');
  p.vl(1, 13, 9, 'k').vl(14, 13, 9, 'k').hl(1, 22, 3, 'k').hl(12, 22, 3, 'k');
  return p.toString();
})();

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** The parents' armchair of the hospital: mint vinyl, it unfolds into a bed (more or less). 20x22. */
function fauteuil(): Px {
  const p = new Px(20, 22);
  p.rect(3, 0, 14, 13, '6').hl(4, 0, 12, 'w').vl(3, 1, 11, 'w').vl(16, 1, 12, '7');
  for (const y of [4, 8]) p.hl(5, y, 10, '7');
  p.rect(0, 9, 4, 8, '6').hl(0, 9, 4, 'w').vl(3, 10, 7, '7');
  p.rect(16, 9, 4, 8, '6').hl(16, 9, 4, 'w').vl(19, 10, 7, '7');
  p.rect(4, 12, 12, 5, '6').hl(4, 12, 12, 'w').hl(4, 16, 12, '7');
  p.rect(1, 17, 18, 2, 'G').hl(1, 17, 18, 'g');
  p.vl(2, 19, 3, 'd').vl(17, 19, 3, 'd');
  return p.edge('k');
}

/** Maman asleep in the armchair, under a hospital blanket. 20x22. */
const MAMAN_FAUTEUIL = (() => {
  const p = fauteuil();
  const head = Px.of(MAMAN_STAND);
  const m = new Px(20, 22);
  // Her head, tilted against the backrest (rows 0..13 of the standing frame, shifted).
  for (let y = 0; y <= 13; y++) for (let x = 0; x < 16; x++) if (head.solid(x, y)) m.px(x + 3, y - 1, head.get(x, y));
  m.swap({ k: 's' }, 8, 8);
  m.hl(7, 9, 2, 'k').hl(14, 9, 2, 'k').px(4, 8, 'k').px(17, 8, 'k');
  p.blit(m);
  // Blanket from the shoulders down, over the armrests.
  const b = new Px(20, 22);
  b.poly([[2, 11], [18, 11], [20, 19], [0, 19]], 'b');
  b.hl(2, 12, 16, 'a').hl(1, 17, 18, 'B').vl(18, 12, 6, 'B');
  for (const x of [6, 11, 15]) b.vl(x, 13, 4, 'B');
  p.blit(b.edge('k'));
  return p.toString();
})();

/** Lockers of the break room (vestiaire): three doors, one with a photo and a heart sticker. 32x30. */
const CASIERS = (() => {
  const p = new Px(32, 30);
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 10;
    p.rect(x, 0, 10, 29, '3').vl(x, 0, 29, '4').vl(x + 9, 0, 29, '1').hl(x, 28, 10, '2');
    for (const y of [3, 5, 7]) p.hl(x + 2, y, 6, '1');
    p.rect(x + 7, 13, 1, 4, 'g').px(x + 7, 13, 'f');
    p.hl(x + 2, 1, 6, 'w');
  }
  // Photo and heart sticker on the middle door.
  p.rect(13, 18, 6, 5, 'w').rect(14, 19, 4, 3, 'b').px(15, 20, 'm').px(16, 20, 'h');
  p.px(18, 10, 'r').px(19, 10, 'r').px(18, 11, 'r').px(19, 11, 'R');
  return p.edge('k').toString();
})();

/** Coffee machine of the break room. 16x30. */
const MACHINE_CAFE = (f: 0 | 1): string => {
  const p = new Px(16, 30);
  p.rect(1, 0, 14, 29, 'd').vl(1, 0, 29, 'G').vl(14, 0, 29, 'K').hl(1, 28, 14, 'K');
  p.rect(3, 3, 10, 6, f ? 'y' : 'Y').hl(3, 3, 10, 'q').rect(4, 5, 8, 1, 'O').rect(4, 7, 5, 1, 'O');
  for (let i = 0; i < 4; i++) p.rect(3 + (i % 2) * 6, 11 + Math.floor(i / 2) * 3, 4, 2, i === 1 ? 'r' : 'g');
  p.rect(4, 18, 8, 7, 'K').rect(6, 21, 4, 4, 'w').hl(6, 21, 4, 'x');
  return p.edge('k').toString();
};

/** Vending machine of the ward (B4: hot chocolate, « le chocolat du robot »). 30x32. */
const DISTRIBUTEUR = (() => {
  const p = new Px(30, 32);
  p.rect(0, 0, 30, 31, 'B').vl(0, 0, 31, 'b').vl(29, 0, 31, 'n').hl(0, 30, 30, 'n');
  p.rect(2, 2, 19, 22, 'z');
  const snack = ['r', 'y', 'L', 'o', 'p', 'b', 'v', 'Y', 'r', 'o', 'l', 'p'];
  for (let row = 0; row < 4; row++) {
    p.hl(2, 7 + row * 5, 19, 'G');
    for (let i = 0; i < 4; i++) p.rect(3 + i * 5, 3 + row * 5, 3, 4, snack[(row * 4 + i) % snack.length]!);
  }
  p.line(4, 3, 9, 8, 'f').line(5, 3, 13, 11, 'J');
  p.rect(23, 3, 5, 3, 'L').hl(23, 3, 5, 'l');
  for (let i = 0; i < 6; i++) p.rect(23 + (i % 2) * 3, 8 + Math.floor(i / 2) * 3, 2, 2, 'w');
  p.rect(24, 18, 3, 4, 'K').rect(3, 26, 17, 3, 'K');
  return p.edge('k').toString();
})();

/** Care cart: towels, bottles, a box of gloves. 18x18. */
const CHARIOT = (() => {
  const p = new Px(18, 18);
  p.rect(1, 5, 16, 2, 'g').hl(1, 5, 16, 'w').rect(1, 11, 16, 2, 'g').hl(1, 11, 16, 'w');
  p.vl(1, 5, 11, 'G').vl(16, 5, 11, 'G');
  p.rect(2, 1, 6, 4, 'w').hl(2, 1, 6, 'f').hl(2, 3, 6, 'b');
  p.rect(9, 0, 2, 5, 'b').rect(12, 2, 4, 3, 'p').hl(12, 2, 4, 'P');
  p.rect(3, 8, 5, 3, 'a').rect(10, 7, 5, 4, 'w').hl(10, 9, 5, 'W');
  p.px(2, 16, 'd').px(15, 16, 'd').px(2, 17, 'K').px(15, 17, 'K');
  return p.edge('k').toString();
})();

/** Call light above a door: off (grey) or on (red, with a glint). 8x5. */
const APPEL = (on: boolean): string => {
  const p = new Px(8, 5);
  p.rect(0, 0, 8, 2, 'G').hl(0, 0, 8, 'g');
  p.rect(1, 2, 6, 3, on ? 'r' : 'W').hl(1, 2, 6, on ? 'p' : 'f').hl(1, 4, 6, on ? 'R' : 'g');
  if (on) p.px(2, 2, 'f');
  return p.toString();
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  // Le Réveil
  b_reveil: { art: reveil('calme', 0), outline: 'k' },
  b_reveil_2: { art: reveil('calme', 1), outline: 'k' },
  b_reveil_sonne: { art: reveil('sonne', 0), outline: 'k' },
  b_reveil_sonne_2: { art: reveil('sonne', 1), outline: 'k' },
  b_reveil_fele: { art: reveil('fele', 0), outline: 'k' },
  b_reveil_fele_2: { art: reveil('fele', 1), outline: 'k' },
  npc_reveil: { art: reveilSmall(0, false), outline: 'k' },
  npc_reveil_2: { art: reveilSmall(1, false), outline: 'k' },
  npc_reveil_dark: { art: reveilSmall(0, true), outline: 'k' },
  npc_reveil_dark_2: { art: reveilSmall(1, true), outline: 'k' },
  face_reveil_neutral: { art: reveilFace('neutral'), outline: 'k' },
  face_reveil_happy: { art: reveilFace('happy'), outline: 'k' },
  face_reveil_angry: { art: reveilFace('angry'), outline: 'k' },
  face_reveil_sad: { art: reveilFace('sad'), outline: 'k' },

  // Regular enemies
  b_sonnette: { art: sonnette(0), outline: 'k' },
  b_sonnette_2: { art: sonnette(1), outline: 'k' },
  ow_sonnette: { art: OW_SONNETTE(0), outline: 'k' },
  ow_sonnette_2: { art: OW_SONNETTE(1), outline: 'k' },
  b_cafe: { art: cafe(0), outline: 'k' },
  b_cafe_2: { art: cafe(1), outline: 'k' },
  ow_cafe: { art: OW_CAFE(0), outline: 'k' },
  ow_cafe_2: { art: OW_CAFE(1), outline: 'k' },
  b_panier: { art: panier(0), outline: 'k' },
  b_panier_2: { art: panier(1), outline: 'k' },
  ow_panier: { art: OW_PANIER(0), outline: 'k' },
  ow_panier_2: { art: OW_PANIER(1), outline: 'k' },

  // People
  npc_sabine: SABINE,
  npc_nadia: NADIA,
  npc_albert: ALBERT,
  pose_maman_sit: MAMAN_SIT,
  pose_maman_fauteuil: { art: MAMAN_FAUTEUIL, colors: MINT },

  // Props
  prop_fauteuil: { art: fauteuil().toString(), colors: MINT },
  prop_casiers: CASIERS,
  prop_machine_cafe: MACHINE_CAFE(0),
  prop_machine_cafe_2: MACHINE_CAFE(1),
  prop_distributeur: DISTRIBUTEUR,
  prop_chariot: CHARIOT,
  prop_appel: APPEL(false),
  prop_appel_on: APPEL(true),
};

/** Maman's real-world look (the apartment of the bonus chapter is a real-world map). */
export const CHARS: Record<string, CharDef> = {
  'maman@real': { ...CHARACTER_CHARS.maman!, opts: { transform: realify } },
};

export const VARIANTS: string[] = ['real'];

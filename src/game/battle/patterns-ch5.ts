import { audio } from '../../engine/audio';
import { drawChar } from '../../engine/font';
import { fx } from '../../engine/fx';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import { tr } from '../../i18n';
import { G } from '../state';
import type { Bullet, BulletWorld } from './bullets';
import type { Pattern, PatternCtx } from './patterns';

/*
 * Attack patterns of chapter 5 « La Marée Blanche » (docs/HISTOIRE.md § 3.13): the hospital bracelet's pincers and its
 * clasp, the gull diving and the letters of the words it stole, the mask's pleats and elastics, the stinging droplets
 * of hand gel and the snowflakes that fall in figures (white: they always hurt), the thermometer's digits, its mercury
 * and its scream at 40, the black scribbles that split in two, and La Vitre: the fog of Noa's breath (wiped only where
 * the heart passes), the condensation running down, the cracks.
 */

const pickEmo = (main: Emotion, whiteChance: number): Emotion => (rng.chance(whiteChance) ? 'neutre' : main);

/**
 * Shared with the chapter 5 enemies (src/data/enemies-ch5.ts): the words La Mouette stole (French text, shown
 * translated), the Thermomètre's current reading.
 */
export const CH5 = {
  stolen: [] as string[],
  temp: 37.2,
};

// ---------------------------------------------------------------------------------------------------------------------
// Custom-drawn projectiles (fill color = the emotion's color)
// ---------------------------------------------------------------------------------------------------------------------

/** A crab's pincer along its arc: two jaws that open and snap. */
function drawPincer(g: CanvasRenderingContext2D, b: Bullet, _color: string, t: number): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const open = Math.floor(t / 6 + (b.data.ph ?? 0)) % 2 ? 2 : 0;
  const dir = b.data.dir ?? 1;
  // The palm of the claw, then two curved jaws.
  g.fillRect(x - 5 * dir - (dir < 0 ? 4 : 0), y - 2, 5, 5);
  g.fillRect(x - 4 * dir - (dir < 0 ? 2 : 0), y - 3, 3, 7);
  for (let i = 0; i < 7; i++) {
    const bend = i < 2 ? 0 : i < 5 ? 1 : 2;
    g.fillRect(x + i * dir, y - 2 - open - (i < 5 ? 1 : 0) + bend, 1, 2);
    g.fillRect(x + i * dir, y + 1 + open + (i < 5 ? 1 : 0) - bend, 1, 2);
  }
  const a = g.globalAlpha;
  g.globalAlpha = a * 0.5;
  g.fillStyle = '#0b0710';
  g.fillRect(x - 4 * dir - (dir < 0 ? 1 : 0), y, 2, 1);
  g.globalAlpha = a;
}

/** A gull in flight, white, wings beating; a scrap of paper in its beak. */
function drawGull(g: CanvasRenderingContext2D, b: Bullet, color: string, t: number): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const dir = b.vx >= 0 ? 1 : -1;
  const up = Math.floor(t / 5) % 2;
  // Wings (grey, black tips), beating.
  for (let i = 1; i <= 9; i++) {
    const wy = y - 1 - (up ? Math.min(i, 5) : Math.max(-1, 4 - i));
    g.fillStyle = i > 7 ? '#2d2238' : '#b7aab8';
    g.fillRect(x - i - 1, wy, 1, 2);
    g.fillRect(x + i, wy, 1, 2);
  }
  // Body, head, the round eye.
  g.fillStyle = '#fffaf2';
  g.fillRect(x - 5, y - 1, 11, 4);
  g.fillRect(x - 4, y - 2, 8, 1);
  g.fillRect(x + 3 * dir - 1, y - 3, 3, 2);
  g.fillStyle = '#0b0710';
  g.fillRect(x + 4 * dir, y - 2, 1, 1);
  // Beak, and what it carries.
  g.fillStyle = '#ffd84a';
  g.fillRect(x + 6 * dir - (dir < 0 ? 2 : 0), y, 3, 1);
  g.fillStyle = color;
  g.fillRect(x + 9 * dir - (dir < 0 ? 3 : 0), y, 4, 3);
}

/** A falling feather: a short quill, tilted. */
function drawFeather(g: CanvasRenderingContext2D, b: Bullet): void {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  for (let i = -3; i <= 3; i++) g.fillRect(Math.round(b.x + c * i), Math.round(b.y + s * i), 1, 1);
  g.fillRect(Math.round(b.x - s), Math.round(b.y + c), 1, 1);
  g.fillRect(Math.round(b.x + c * 2 + s), Math.round(b.y + s * 2 - c), 1, 1);
}

/** A stolen letter, bold (drawn twice). */
function drawLetter(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const ch = String.fromCharCode(b.data.ch ?? 77);
  const x = Math.round(b.x) - 3;
  const y = Math.round(b.y) - 4;
  drawChar(g, ch, x, y, color);
  drawChar(g, ch, x + 1, y, color);
}

/** A drop of hand gel: clear, a highlight, a darker rim. Stuck to the heart, it shrinks as it stings. */
function drawGel(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const small = b.data.stuck ? (b.data.stings ?? 0) : -1;
  if (small >= 1) {
    g.fillRect(x - 1, y - 1, 2 + (small < 2 ? 1 : 0), 2);
    return;
  }
  g.fillRect(x, y - 3, 1, 1);
  g.fillRect(x - 1, y - 2, 3, 1);
  g.fillRect(x - 2, y - 1, 5, 3);
  g.fillRect(x - 1, y + 2, 3, 1);
  const a = g.globalAlpha;
  g.globalAlpha = a * 0.9;
  g.fillStyle = '#ffffff';
  g.fillRect(x - 1, y - 1, 1, 1);
  g.globalAlpha = a;
}

/** A snowflake: a six-branched star. */
function drawFlake(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillRect(x, y - 3, 1, 7);
  g.fillRect(x - 2, y - 2, 1, 1);
  g.fillRect(x + 2, y - 2, 1, 1);
  g.fillRect(x - 2, y + 2, 1, 1);
  g.fillRect(x + 2, y + 2, 1, 1);
  g.fillRect(x - 1, y - 1, 3, 3);
  g.fillRect(x - 3, y, 7, 1);
}

/** A tangle of black scribble: visible only by its pale rim. */
function drawScribbleBall(g: CanvasRenderingContext2D, b: Bullet, _color: string, t: number): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const r = b.r;
  const ph = (b.data.ph ?? 0) + t * 0.2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 14; i++) {
    const a = ph + i * 2.39;
    const rr = r * (0.35 + ((i * 7) % 5) / 7);
    pts.push([x + Math.round(Math.cos(a) * rr), y + Math.round(Math.sin(a * 1.3) * rr)]);
  }
  g.fillStyle = '#000000';
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let k = 0; k <= n; k++) g.fillRect(Math.round(ax + ((bx - ax) * k) / Math.max(1, n)), Math.round(ay + ((by - ay) * k) / Math.max(1, n)), 2, 2);
  }
  // Two blank eyes in the middle of the tangle.
  g.fillStyle = '#fffaf2';
  g.fillRect(x - 2, y - 1, 1, 1);
  g.fillRect(x + 1, y - 1, 1, 1);
}

/** A drop of condensation: grows on the edge, then runs; `size` 1–3. */
function drawCondensation(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const s = Math.round(b.data.size ?? 1);
  g.fillRect(x - s + 1, y - s, Math.max(1, s * 2 - 1), 1);
  g.fillRect(x - s, y - s + 1, s * 2 + 1, s * 2 - 1);
  g.fillRect(x - s + 1, y + s, Math.max(1, s * 2 - 1), 1);
  g.fillRect(x, y - s - 1 - Math.min(2, s), 1, Math.min(2, s) + 1);
  const a = g.globalAlpha;
  g.globalAlpha = a * 0.8;
  g.fillStyle = '#ffffff';
  g.fillRect(x - s + 1, y - s + 1, 1, 1);
  g.globalAlpha = a;
}

// ---------------------------------------------------------------------------------------------------------------------
// Seven-segment digits (the thermometer's display)
// ---------------------------------------------------------------------------------------------------------------------

/** Segments a–g of each digit, as in a pocket thermometer's LCD. */
const SEG: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/** Rect projectiles drawing `text` (digits and a comma) in seven segments, moving at (vx, vy). */
function segDigits(w: BulletWorld, text: string, x: number, y: number, vx: number, vy: number, emo: Emotion, dmg: number, warn = 0): void {
  const L = 6;
  const T = 2;
  let cx = x;
  for (const ch of text) {
    if (ch === ',' || ch === '.') {
      w.spawn({ x: cx, y: y + L * 2 + 1, w: T, h: T + 1, shape: 'rect', vx, vy, emo, dmg, warn, clip: false, maxLife: 700 });
      cx += 5;
      continue;
    }
    const segs = SEG[ch] ?? '';
    const parts: Record<string, [number, number, number, number]> = {
      a: [cx + T, y, L, T],
      b: [cx + T + L, y + T, T, L],
      c: [cx + T + L, y + T * 2 + L, T, L],
      d: [cx + T, y + T * 2 + L * 2, L, T],
      e: [cx, y + T * 2 + L, T, L],
      f: [cx, y + T, T, L],
      g: [cx + T, y + T + L, L, T],
    };
    for (const sgm of segs) {
      const [sx, sy, sw, sh] = parts[sgm]!;
      w.spawn({ x: sx, y: sy, w: sw, h: sh, shape: 'rect', vx, vy, emo, dmg, warn, clip: false, maxLife: 700 });
    }
    cx += L + T * 2 + 4;
  }
}

/** « 38,4 » — the reading, with a French comma (the display of a French thermometer). */
export const tempLabel = (v: number): string => v.toFixed(1).replace('.', ',');

// ---------------------------------------------------------------------------------------------------------------------
// La Vitre: the fog of breath
// ---------------------------------------------------------------------------------------------------------------------

const FOG_CELL = 3;

/** Fog cells over the box (0 = clear glass, 1 = fully fogged), wiped where the heart passes. */
interface Fog {
  cols: number;
  rows: number;
  v: Float32Array;
  /** Handprints of the other side: cells kept clear in the shape of small hands. */
  prints: Array<[number, number]>;
}

let fog: Fog | null = null;

/** A small open hand (5 fingers, palm), in fog cells, around (cx, cy). */
const HAND: Array<[number, number]> = [
  [-2, -3], [-1, -4], [0, -4], [1, -4], [2, -3],
  [-2, -2], [-1, -3], [0, -3], [1, -3], [2, -2],
  [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, 0],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-1, 1], [0, 1], [1, 1],
];

function fogStart(w: BulletWorld, c: PatternCtx): void {
  const b = w.box;
  const cols = Math.ceil(b.w / FOG_CELL);
  const rows = Math.ceil(b.h / FOG_CELL);
  fog = { cols, rows, v: new Float32Array(cols * rows).fill(0.35), prints: [] };
  const n = Math.min(4, 1 + Math.floor(c.turn / 2));
  for (let i = 0; i < n; i++) fog.prints.push([rng.int(4, cols - 6), rng.int(6, rows - 4)]);
  w.dark = true;
  w.post = (g, bw) => {
    const f = fog;
    if (!f) return;
    const bx = bw.box.x;
    const by = bw.box.y;
    for (let r = 0; r < f.rows; r++)
      for (let q = 0; q < f.cols; q++) {
        const v = f.v[r * f.cols + q]!;
        if (v < 0.06) continue;
        // Thin fog is a stipple of droplets; thick fog closes up.
        const x = bx + q * FOG_CELL;
        const y = by + r * FOG_CELL;
        g.globalAlpha = Math.min(0.95, 0.35 + v * 0.65);
        g.fillStyle = (q * 5 + r * 3) % 7 ? '#e3eaf0' : '#f6f9fb';
        if (v > 0.55) g.fillRect(x, y, FOG_CELL, FOG_CELL);
        else if (v > 0.3) {
          g.fillRect(x, y, 2, 2);
          g.fillRect(x + 2, y + 2, 1, 1);
        } else g.fillRect(x + ((q + r) % 2), y + 1, 1, 1);
      }
    g.globalAlpha = 1;
    // Her handprints, from the other side of the glass: they appear clear where the fog is thick.
    for (const [px, py] of f.prints) {
      for (const [hx, hy] of HAND) {
        const q = px + hx;
        const r = py + hy;
        if (q < 0 || r < 0 || q >= f.cols || r >= f.rows) continue;
        const v = f.v[r * f.cols + q]!;
        if (v < 0.35) continue;
        g.globalAlpha = Math.min(0.8, v);
        g.fillStyle = '#8396ad';
        g.fillRect(bx + q * FOG_CELL, by + r * FOG_CELL, FOG_CELL, FOG_CELL);
      }
    }
    g.globalAlpha = 1;
    // The heart keeps a faint glow: you can always see yourself.
    const s = bw.soul;
    g.fillStyle = '#fffaf2';
    g.globalAlpha = 0.18;
    g.fillRect(Math.round(s.x) - 4, Math.round(s.y) - 4, 9, 9);
    g.globalAlpha = 1;
  };
}

/** Breath: the fog thickens in pulses (one breath every ~2 s); the heart wipes a clear trail. */
function fogTick(w: BulletWorld, t: number, rate: number): void {
  const f = fog;
  if (!f) return;
  const b = w.box;
  const breath = Math.max(0, Math.sin(t * 0.05)) ** 2;
  const add = rate * (0.15 + breath);
  const s = w.soul;
  const sq = (s.x - b.x) / FOG_CELL;
  const sr = (s.y - b.y) / FOG_CELL;
  for (let r = 0; r < f.rows; r++)
    for (let q = 0; q < f.cols; q++) {
      const i = r * f.cols + q;
      const d = Math.hypot(q + 0.5 - sq, r + 0.5 - sr);
      let v = f.v[i]! + add * (0.7 + ((q * 7 + r * 3) % 5) * 0.1);
      // The heart wipes the glass like a fingertip: a round clear patch that stays a while behind it.
      if (d < 3.6) v -= 0.22 * Math.min(1, 3.6 - d);
      f.v[i] = Math.max(0, Math.min(1, v));
    }
  if (t % 80 === 1 && breath > 0.1) audio.sfx('whoosh', { pitch: 0.45, vol: 0.18 });
}

// ---------------------------------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------------------------------

/** A pincer launched from one side, sweeping a half circle through the box and back, after a dotted warning. */
function pincerArc(w: BulletWorld, left: boolean, py: number, R: number, emo: Emotion, speed: number): void {
  const b = w.box;
  const px = left ? b.x - 6 : b.x + b.w + 6;
  const dir = left ? 1 : -1;
  const warn = 34;
  // The arc's path, dotted for a moment.
  for (let k = 0; k <= 10; k++) {
    const a = -Math.PI / 2 + (k / 10) * Math.PI;
    w.spawn({ x: px + dir * Math.cos(a) * R, y: py + Math.sin(a) * R, shape: 'dot', r: 1, dmg: 0, emo, alpha: 0.35, maxLife: warn, clip: true });
  }
  w.spawn({
    x: px,
    y: py - R,
    shape: 'custom',
    draw: drawPincer,
    r: 4,
    dmg: 4,
    emo,
    warn,
    clip: false,
    maxLife: 400,
    data: { a: -Math.PI / 2, dir, ph: rng.int(0, 5), hw: 5, hh: 4 },
    update: (bl, bw) => {
      bl.data.a! += speed;
      const a = bl.data.a!;
      bl.x = px + dir * Math.cos(a) * R;
      bl.y = py + Math.sin(a) * R;
      bl.data.dir = Math.sin(a) < 0 ? dir : -dir;
      if (a > Math.PI / 2 + 0.2) bl.dead = true;
      // Sand thrown up by the claw.
      if (bl.life % 14 === 0 && bl.x > bw.box.x && bl.x < bw.box.x + bw.box.w) {
        bw.spawn({ x: bl.x, y: bl.y, vx: rng.range(-0.4, 0.4), vy: -0.6, ay: 0.03, shape: 'dot', r: 1, dmg: 2, emo: 'neutre', maxLife: 90 });
      }
    },
  });
}

/** A gull diving through the box toward (tx, ty), feathers falling behind it. */
function gullDive(w: BulletWorld, fromLeft: boolean, ty: number, emo: Emotion, speed: number): void {
  const b = w.box;
  const x0 = fromLeft ? b.x - 10 : b.x + b.w + 10;
  const x1 = fromLeft ? b.x + b.w + 14 : b.x - 14;
  const y0 = b.y - 6;
  const warn = 26;
  // A faint line of the dive: down to ty in the middle, back up.
  for (let k = 1; k < 12; k++) {
    const p = k / 12;
    w.spawn({ x: x0 + (x1 - x0) * p, y: y0 + (ty - y0) * Math.sin(p * Math.PI), shape: 'dot', r: 1, dmg: 0, emo, alpha: 0.3, maxLife: warn });
  }
  w.spawn({
    x: x0,
    y: y0,
    vx: (fromLeft ? 1 : -1) * 0.01,
    shape: 'custom',
    draw: drawGull,
    r: 4,
    dmg: 4,
    emo,
    warn,
    clip: false,
    maxLife: 600,
    data: { p: 0, hw: 6, hh: 3 },
    update: (bl, bw) => {
      bl.data.p! += speed;
      const p = bl.data.p!;
      bl.x = x0 + (x1 - x0) * p;
      bl.y = y0 + (ty - y0) * Math.sin(Math.min(1, p) * Math.PI);
      if (p >= 1) bl.dead = true;
      if (bl.life === 1) audio.sfx('chime', { pitch: 2.4, vol: 0.12 });
      if (bl.life % 10 === 5 && p > 0.1 && p < 0.9) {
        bw.spawn({
          x: bl.x,
          y: bl.y,
          vy: 0.35,
          vx: rng.range(-0.2, 0.2),
          shape: 'custom',
          draw: drawFeather,
          r: 2,
          dmg: 3,
          emo: pickEmo('joie', 0.5),
          angle: rng.range(0, 3),
          spin: 0.05,
          maxLife: 240,
          update: (f) => {
            f.vx = Math.sin(f.life * 0.07) * 0.4;
          },
        });
      }
    },
  });
}

/** One snowflake of a figure: kept at its place around the figure's center while the figure falls and turns. */
function flakeIn(w: BulletWorld, cx: number, cy: number, ox: number, oy: number, vy: number, spin: number, warn: number): void {
  const d = Math.hypot(ox, oy);
  const a0 = Math.atan2(oy, ox);
  w.spawn({
    x: cx + ox,
    y: cy + oy,
    shape: 'custom',
    draw: drawFlake,
    r: 2,
    dmg: 3,
    emo: 'neutre',
    warn,
    clip: true,
    maxLife: 500,
    data: { cy, a: a0 },
    update: (bl) => {
      bl.data.cy! += vy;
      bl.data.a! += spin;
      bl.x = cx + Math.cos(bl.data.a!) * d;
      bl.y = bl.data.cy! + Math.sin(bl.data.a!) * d;
    },
  });
}

/** A crack in the glass: a few straight segments from (x, y), one branch, red after a fast-running warning. */
function crack(w: BulletWorld, x: number, y: number, a: number, emo: Emotion, depth = 0): void {
  let cx = x;
  let cy = y;
  let ang = a;
  let delay = 0;
  const segs = 3 + rng.int(0, 2);
  for (let s = 0; s < segs; s++) {
    const len = rng.range(12, 22);
    const nx = cx + Math.cos(ang) * len;
    const ny = cy + Math.sin(ang) * len;
    const n = Math.ceil(len / 2);
    for (let k = 0; k < n; k++) {
      const px = cx + ((nx - cx) * k) / n;
      const py = cy + ((ny - cy) * k) / n;
      w.spawn({
        x: px - 1,
        y: py - 1,
        w: 2,
        h: 2,
        shape: 'rect',
        dmg: 4,
        emo,
        warn: 30 + delay + k,
        maxLife: 110,
        update: (bl) => {
          if (bl.life > 80) bl.alpha = Math.max(0, 1 - (bl.life - 80) / 30);
          if (bl.life > 100) bl.dmg = 0;
        },
      });
    }
    delay += n;
    if (s === 1 && depth === 0) crack(w, nx, ny, ang + (rng.chance(0.5) ? 0.9 : -0.9), emo, 1);
    cx = nx;
    cy = ny;
    ang += rng.range(-0.6, 0.6);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------------------------------------------------

export const CH5_PATTERNS: Record<string, Pattern> = {
  // --- Crabe-Bracelet ------------------------------------------------------------------------------------------------
  pincer_arcs: {
    box: { w: 130, h: 62 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(44, 64 - c.power * 7);
      if (t % every === 2 && t < 300) {
        const left = (c.mem.side = ((c.mem.side ?? rng.int(0, 1)) + 1) % 2) === 0;
        const R = rng.range(26, 44);
        pincerArc(w, left, b.y + b.h / 2 + rng.range(-6, 6), R, pickEmo('colere', 0.35), 0.035 + c.power * 0.004);
      }
      if (t % 40 === 13 && t < 320) w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 4, vy: 0.8, shape: 'dot', r: 1, dmg: 2, emo: 'neutre' });
    },
  },
  bracelet_clasp: {
    box: { w: 112, h: 62 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      if (t === 2 || t === 200) {
        const s = w.soul;
        const cx = Math.max(b.x + 20, Math.min(b.x + b.w - 20, s.x));
        const cy = Math.max(b.y + 18, Math.min(b.y + b.h - 18, s.y));
        const emo = pickEmo('colere', 0.5);
        const r0 = 46;
        const ring = w.spawn({
          x: cx,
          y: cy,
          r: r0,
          shape: 'ring',
          dmg: 4,
          emo,
          clip: true,
          maxLife: 999,
          data: { gapA: rng.range(0, Math.PI * 2), gapW: 1.2 },
          update: (bl) => {
            if (bl.data.snapped) {
              if (bl.life > bl.data.snapped + 24) bl.dead = true;
              return;
            }
            bl.r = Math.max(3, bl.r - (0.2 + c.power * 0.03));
            bl.data.gapA! += 0.012;
            bl.data.gapW = Math.max(0, 1.2 * ((bl.r - 8) / (r0 - 8)));
            if (bl.r <= 3.01) {
              bl.data.snapped = bl.life;
              delete bl.data.gapA;
              audio.sfx('stitch', { pitch: 0.5, vol: 0.9 });
              fx.shake(1, 5);
            }
          },
        });
        // The printed band, letters crowding as the clasp closes: « MINA — PÉD. 3 — 304 ».
        const label = 'MINA-PED.3-304';
        w.spawn({
          x: cx,
          y: cy,
          shape: 'custom',
          dmg: 0,
          emo,
          clip: true,
          maxLife: 999,
          draw: (g, bl) => {
            if (ring.dead || ring.r < 14) return;
            const step = Math.min(0.2, 7 / ring.r);
            for (let i = 0; i < label.length; i++) {
              const a = (ring.data.gapA ?? 0) + Math.PI + (i - label.length / 2) * step;
              drawChar(g, label[i]!, Math.round(bl.x + Math.cos(a) * (ring.r - 7)) - 2, Math.round(bl.y + Math.sin(a) * (ring.r - 7)) - 3, '#9a93a6');
            }
          },
          update: (bl) => {
            if (ring.dead) bl.dead = true;
          },
        });
      }
      if (t % 30 === 15 && t < 360) w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 4, vy: 0.7, shape: 'dot', r: 1, dmg: 2, emo: 'neutre' });
    },
  },

  // --- Mouette -------------------------------------------------------------------------------------------------------
  gull_dive: {
    box: { w: 140, h: 60 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(58, 84 - c.power * 8);
      if (t % every === 2 && t < 300) {
        const left = (c.mem.side = ((c.mem.side ?? rng.int(0, 1)) + 1) % 2) === 0;
        gullDive(w, left, Math.min(b.y + b.h - 6, w.soul.y + rng.range(-4, 6)), pickEmo('joie', 0.4), 0.011 + c.power * 0.0015);
      }
    },
  },
  word_theft: {
    box: { w: 140, h: 62 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      const words = CH5.stolen.length ? CH5.stolen.slice(-3).map((s) => tr(s)) : ['MINE', 'MINE', 'MINE'];
      const per = Math.max(6, 8 - c.power);
      const total = words.reduce((a, s) => a + s.length + 3, 0);
      const k = Math.floor((t - 2) / per) % total;
      if (t >= 2 && (t - 2) % per === 0 && t < 300) {
        // Which letter of which word.
        let i = k;
        let wi = 0;
        while (wi < words.length && i >= words[wi]!.length + 3) {
          i -= words[wi]!.length + 3;
          wi++;
        }
        const word = words[wi];
        if (word && i < word.length && word[i] !== ' ') {
          const span = Math.min(b.w - 16, word.length * 9);
          const x = b.x + (b.w - span) / 2 + (span * i) / Math.max(1, word.length - 1) + (wi % 2 ? -6 : 6);
          w.spawn({
            x,
            y: b.y - 6,
            vy: 0.55 + c.power * 0.08,
            shape: 'custom',
            draw: drawLetter,
            r: 3,
            dmg: 3,
            emo: pickEmo('joie', 0.45),
            data: { ch: word.charCodeAt(i), x0: x, ph: rng.range(0, 6) },
            update: (bl) => {
              bl.x = bl.data.x0! + Math.sin(bl.life * 0.06 + bl.data.ph!) * 3;
            },
          });
        }
      }
      // The gull comes back for what is left.
      if (t === 300) gullDive(w, rng.chance(0.5), b.y + b.h - 10, 'neutre', 0.016);
    },
  },

  // --- Masque --------------------------------------------------------------------------------------------------------
  mask_pleats: {
    box: { w: 130, h: 62 },
    duration: 400,
    start(w) {
      w.liveBox = true;
    },
    tick(w, t, c) {
      const b = w.box;
      const cy = 113;
      // The box breathes in folds: it narrows to a slit and opens again, three times.
      const fold = Math.max(0, Math.sin((t / 400) * Math.PI * 3 - 0.4));
      const h = Math.round(62 - fold * (30 + c.power * 2));
      b.h = h;
      b.y = Math.round(cy - h / 2);
      // Pleats: horizontal lines across the mask, each with the one gap you can breathe through.
      const every = Math.max(30, 46 - c.power * 5);
      if (t % every === 4 && t < 340) {
        const fromTop = rng.chance(0.5);
        const gap = rng.range(b.x + 14, b.x + b.w - 26);
        const emo = pickEmo('peur', 0.4);
        for (let x = b.x; x < b.x + b.w; x += 6) {
          if (x > gap && x < gap + 16) continue;
          w.spawn({ x, y: fromTop ? b.y - 2 : b.y + b.h, w: 5, h: 2, shape: 'rect', vy: (fromTop ? 1 : -1) * (0.55 + c.power * 0.08), dmg: 3, emo, warn: 16, clip: true, maxLife: 200 });
        }
      }
    },
  },
  mask_elastics: {
    box: { w: 124, h: 60 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const period = Math.max(70, 96 - c.power * 8);
      if (t % period === 2 && t < 310) {
        // An ear loop: an elastic ring outside the box, stretched toward the heart, then let go.
        const left = (c.mem.side = ((c.mem.side ?? rng.int(0, 1)) + 1) % 2) === 0;
        const cx = left ? b.x - 22 : b.x + b.w + 22;
        const cy = b.y + b.h / 2 + rng.range(-10, 10);
        const emo = pickEmo('peur', 0.45);
        const reach = Math.abs(w.soul.x - cx) + rng.range(4, 14);
        w.spawn({
          x: cx,
          y: cy,
          r: 18,
          shape: 'ring',
          dmg: 4,
          emo,
          clip: true,
          warn: 18,
          maxLife: 200,
          data: { gapA: left ? Math.PI : 0, gapW: 2.2 },
          update: (bl) => {
            const p = bl.life / 90;
            // Stretch slowly, snap back fast.
            bl.r = p < 0.7 ? 18 + (reach - 18) * (p / 0.7) : 18 + (reach - 18) * Math.max(0, 1 - (p - 0.7) / 0.15);
            if (bl.life === 64) audio.sfx('thread', { pitch: 1.6, vol: 0.4 });
            if (p > 1) bl.dead = true;
          },
        });
      }
      // Little puffs of breath through the cloth.
      if (t % 18 === 9 && t < 340) {
        const x = b.x + b.w / 2 + rng.range(-20, 20);
        w.spawn({ x, y: b.y - 3, vx: rng.range(-0.5, 0.5), vy: 0.6, shape: 'dot', r: 1, dmg: 2, emo: pickEmo('peur', 0.5), maxLife: 160 });
      }
    },
  },

  // --- Gel -----------------------------------------------------------------------------------------------------------
  gel_drops: {
    box: { w: 120, h: 62 },
    duration: 380,
    start(w) {
      // The pump at the top of the box, sliding to where it will press next.
      w.pre = (g, bw) => {
        const px = Math.round(bw.box.x + (pump.x - bw.box.x));
        g.fillStyle = '#b7aab8';
        g.fillRect(px - 3, bw.box.y, 7, 2);
        g.fillRect(px - 1, bw.box.y + 2, 3, 3 - pump.press);
        g.fillStyle = '#7d6f86';
        g.fillRect(px, bw.box.y + 5 - pump.press, 1, 2);
      };
      pump.x = w.box.x + w.box.w / 2;
      pump.press = 0;
    },
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(16, 26 - c.power * 3);
      if (t % 60 === 0) pump.target = rng.range(b.x + 10, b.x + b.w - 10);
      pump.x += (pump.target - pump.x) * 0.06;
      pump.press = t % every < 4 ? 2 : 0;
      if (t % every === 0 && t < 320) {
        if (t % (every * 3) === 0) audio.sfx('whoosh', { pitch: 2.2, vol: 0.12 });
        const emo = pickEmo('colere', 0.55);
        w.spawn({
          x: pump.x + rng.range(-2, 2),
          y: b.y + 7,
          vx: rng.range(-0.25, 0.25),
          vy: 0.4,
          ay: 0.012,
          shape: 'custom',
          draw: drawGel,
          r: 3,
          dmg: 0,
          emo,
          clip: true,
          maxLife: 600,
          update: (bl, bw) => {
            const s = bw.soul;
            if (bl.data.stuck) {
              // Stuck on the heart: it follows, and stings three times.
              bl.x = s.x + bl.data.ox!;
              bl.y = s.y + bl.data.oy!;
              if ((bl.life - bl.data.stuck) % 40 === 39) {
                bl.data.stings = (bl.data.stings ?? 0) + 1;
                bw.onSting?.(1);
                if (bl.data.stings >= 3) bl.dead = true;
              }
              return;
            }
            if (Math.hypot(s.x - bl.x, s.y - bl.y) < 4 && !bw.passes(bl.emo) && bw.bullets.filter((o) => o.data.stuck).length < 3) {
              bl.data.stuck = bl.life;
              bl.data.ox = Math.max(-3, Math.min(3, bl.x - s.x));
              bl.data.oy = Math.max(-3, Math.min(3, bl.y - s.y));
              bl.vx = bl.vy = bl.ay = 0;
              audio.sfx('pop', { pitch: 1.6, vol: 0.4 });
              return;
            }
            // On the floor of the box: it splashes into two tiny droplets.
            if (bl.y > bw.box.y + bw.box.h - 3) {
              bl.dead = true;
              for (const d of [-1, 1]) bw.spawn({ x: bl.x, y: bl.y - 1, vx: d * rng.range(0.6, 1.1), vy: -0.9, ay: 0.05, shape: 'dot', r: 1, dmg: 2, emo: 'neutre', maxLife: 50 });
            }
          },
        });
      }
    },
  },
  snowflakes: {
    box: { w: 132, h: 64 },
    duration: 420,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(64, 92 - c.power * 9);
      if (t % every === 2 && t < 330) {
        const kind = (c.mem.fig = ((c.mem.fig ?? -1) + 1) % 3);
        const vy = 0.32 + c.power * 0.05;
        const warn = 14;
        if (kind === 0) {
          // A hexagon of flakes, turning as it falls.
          const cx = rng.range(b.x + 22, b.x + b.w - 22);
          for (let i = 0; i < 6; i++) flakeIn(w, cx, b.y - 14, Math.cos((i / 6) * Math.PI * 2) * 13, Math.sin((i / 6) * Math.PI * 2) * 13, vy, 0.02, warn);
        } else if (kind === 1) {
          // A row with one gap.
          const gap = rng.int(1, 8);
          for (let i = 0; i < 11; i++) if (i !== gap && i !== gap + 1) flakeIn(w, b.x + 6 + i * 12, b.y - 6, 0, 0, vy * 1.2, 0, warn);
        } else {
          // A V, pointing down at the heart.
          const cx = Math.max(b.x + 30, Math.min(b.x + b.w - 30, w.soul.x));
          for (let i = -3; i <= 3; i++) flakeIn(w, cx + i * 9, b.y - 8 - Math.abs(i) * 7, 0, 0, vy * 1.1, 0, warn);
        }
      }
      // Loose flakes in between.
      if (t % 22 === 11 && t < 360) w.spawn({ x: rng.range(b.x + 3, b.x + b.w - 3), y: b.y - 4, vy: 0.45, shape: 'custom', draw: drawFlake, r: 2, dmg: 3, emo: 'neutre' });
    },
  },

  // --- Thermomètre ---------------------------------------------------------------------------------------------------
  thermo_digits: {
    box: { w: 124, h: 60 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(70, 96 - c.power * 8);
      if (t % every === 2 && t < 300) {
        const fever = CH5.temp >= 38;
        const emo = pickEmo(fever ? 'colere' : 'peur', 0.35);
        const fromRight = rng.chance(0.6);
        const y = rng.range(b.y + 4, b.y + b.h - 22);
        const text = tempLabel(CH5.temp + rng.range(-0.3, 0.3));
        segDigits(w, text, fromRight ? b.x + b.w + 4 : b.x - 50, y, (fromRight ? -1 : 1) * (0.7 + c.power * 0.12), 0, emo, 4, 12);
        audio.sfx('beep', { pitch: 1.6, vol: 0.25 });
      }
      if (t % 24 === 12 && t < 340) w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 4, vy: 0.7, shape: 'drop', r: 2, dmg: 2, emo: pickEmo('peur', 0.5) });
    },
  },
  thermo_mercury: {
    box: { w: 132, h: 62 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      const period = Math.max(64, 86 - c.power * 7);
      if (t % period === 2 && t < 330) {
        // A fever chart: columns of mercury rise from the floor along a wave, leave, and drop.
        const n = 10;
        const phase = rng.range(0, Math.PI * 2);
        const top = (CH5.temp - 36) / 5;
        for (let i = 0; i < n; i++) {
          const x = b.x + 4 + i * 13;
          const target = Math.round(b.h * (0.25 + 0.4 * Math.max(0, Math.min(1, top)) + 0.22 * Math.sin(phase + i * 0.9)));
          w.spawn({
            x,
            y: b.y + b.h,
            w: 6,
            h: 0,
            shape: 'rect',
            dmg: 4,
            emo: pickEmo('colere', 0.3),
            warn: 22,
            clip: true,
            maxLife: 110,
            update: (bl) => {
              const p = bl.life;
              const hgt = p < 30 ? (target * p) / 30 : p < 70 ? target : Math.max(0, target * (1 - (p - 70) / 30));
              bl.h = hgt;
              bl.y = b.y + b.h - hgt;
            },
          });
          // The empty glass tube, for the warning.
          w.spawn({ x: x + 3, y: b.y + b.h - target, shape: 'dot', r: 1, dmg: 0, emo: 'colere', alpha: 0.5, maxLife: 22 });
        }
        audio.sfx('beep', { pitch: 1.2, vol: 0.2 });
      }
    },
  },
  thermo_scream: {
    box: { w: 300, h: 62 },
    duration: 330,
    start() {
      fx.shake(3, 40);
      if (!G.settings.reduceFlashes) fx.flash('#ff4a5a', 10, 0.35);
    },
    tick(w, t, c) {
      const b = w.box;
      // The shrill beeping of a thermometer that has finished, and finished, and finished.
      if (t % 8 === 0 && t < 60) audio.sfx('beep', { pitch: 2.4, vol: 0.5 });
      if (t === 60) audio.sfx('glitch', { vol: 0.5 });
      // Rings of mercury from the top, each with a gap.
      if (t % 46 === 20 && t < 280) {
        const cx = rng.range(b.x + 60, b.x + b.w - 60);
        w.spawn({
          x: cx,
          y: b.y - 6,
          r: 4,
          shape: 'ring',
          dmg: 4,
          emo: pickEmo('colere', 0.3),
          clip: true,
          maxLife: 180,
          data: { gapA: Math.PI / 2 + rng.range(-1, 1), gapW: 0.9 },
          update: (bl) => {
            bl.r += 0.75 + c.power * 0.08;
          },
        });
      }
      // « 40,0 », everywhere, scrolling both ways.
      if (t % 70 === 40 && t < 260) {
        const fromRight = (t / 70) % 2 < 1;
        segDigits(w, '40,0', fromRight ? b.x + b.w + 4 : b.x - 52, b.y + (fromRight ? 4 : b.h - 26), (fromRight ? -1 : 1) * 1.3, 0, 'colere', 4, 10);
      }
      if (t % 10 === 5 && t < 300) w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 4, vy: 1.1, shape: 'dot', r: 1, dmg: 3, emo: pickEmo('colere', 0.5) });
    },
  },

  // --- Gribouille Noire ----------------------------------------------------------------------------------------------
  black_scribbles: {
    box: { w: 124, h: 60 },
    duration: 380,
    start(w) {
      // A grey page (white, in the dark), so that black can be seen on it.
      w.pre = (g, bw) => {
        g.fillStyle = '#7a7486';
        g.fillRect(bw.box.x, bw.box.y, bw.box.w, bw.box.h);
        g.fillStyle = '#857f92';
        for (let y = bw.box.y + 6; y < bw.box.y + bw.box.h; y += 9) g.fillRect(bw.box.x, y, bw.box.w, 1);
        g.fillStyle = '#a8324a';
        g.fillRect(bw.box.x + 12, bw.box.y, 1, bw.box.h);
      };
    },
    tick(w, t, c) {
      const b = w.box;
      const spawn = (x: number, y: number, vx: number, vy: number, gen: number) =>
        w.spawn({
          x,
          y,
          vx,
          vy,
          shape: 'custom',
          draw: drawScribbleBall,
          r: Math.max(3, 7 - gen * 2),
          dmg: 3,
          emo: 'neutre',
          bounce: 4,
          clip: true,
          maxLife: 330,
          data: { gen, ph: rng.range(0, 6) },
          update: (bl, bw) => {
            // It splits in two every time it hits a wall (while there is room for more fear).
            const sx = Math.sign(bl.vx);
            const sy = Math.sign(bl.vy);
            if ((sx !== (bl.data.sx ?? sx) || sy !== (bl.data.sy ?? sy)) && bl.data.gen! < 2 && bw.bullets.length < 26) {
              audio.sfx('scratch', { pitch: 1.4 + bl.data.gen! * 0.3, vol: 0.35 });
              bl.data.gen! += 1;
              bl.r = Math.max(3, 7 - bl.data.gen! * 2);
              spawn(bl.x, bl.y, -bl.vy * 0.9 || 0.6, bl.vx * 0.9 || 0.6, bl.data.gen!);
            }
            bl.data.sx = sx;
            bl.data.sy = sy;
          },
        });
      if (t % Math.max(60, 90 - c.power * 10) === 2 && t < 280) {
        const a = rng.range(0.4, 1.2) * (rng.chance(0.5) ? 1 : -1) + Math.PI / 2;
        spawn(rng.range(b.x + 20, b.x + b.w - 20), b.y + 6, Math.cos(a) * (0.8 + c.power * 0.1), Math.abs(Math.sin(a)) * 0.8, 0);
      }
    },
  },

  // --- La Vitre ------------------------------------------------------------------------------------------------------
  vitre_buee: {
    box: { w: 132, h: 64 },
    duration: 420,
    start(w, c) {
      fogStart(w, c);
    },
    tick(w, t, c) {
      const b = w.box;
      fogTick(w, t, 0.0045 + c.power * 0.0008);
      // Violet beads of breath drift in the fog: you see them only where you have wiped.
      if (t % Math.max(9, 14 - c.power * 2) === 0 && t < 370) {
        const left = rng.chance(0.5);
        w.spawn({
          x: left ? b.x - 4 : b.x + b.w + 4,
          y: rng.range(b.y + 4, b.y + b.h - 4),
          vx: (left ? 1 : -1) * rng.range(0.45, 0.8),
          shape: 'drop',
          r: 2,
          dmg: 3,
          emo: pickEmo('peur', 0.35),
          clip: true,
          data: { ph: rng.range(0, 6) },
          update: (bl) => {
            bl.vy = Math.sin(bl.life * 0.05 + bl.data.ph!) * 0.3;
          },
        });
      }
    },
  },
  vitre_condensation: {
    box: { w: 120, h: 64 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(12, 20 - c.power * 3);
      if (t % every === 0 && t < 330) {
        w.spawn({
          x: rng.range(b.x + 4, b.x + b.w - 4),
          y: b.y + 2,
          shape: 'custom',
          draw: drawCondensation,
          r: 2,
          dmg: 3,
          emo: pickEmo('tristesse', 0.25),
          warn: 0,
          clip: true,
          maxLife: 500,
          data: { size: 1, grow: rng.int(30, 60), ph: rng.range(0, 6) },
          update: (bl, bw) => {
            // It swells on the edge of the glass, then runs down, wandering, and swallows the drops it meets.
            if (bl.life < bl.data.grow!) {
              bl.data.size = 1 + (bl.life / bl.data.grow!) * 0.6;
              bl.dmg = 0;
              return;
            }
            bl.dmg = 3;
            bl.vy = Math.min(1.6, 0.25 + bl.data.size! * 0.25 + (bl.life - bl.data.grow!) * 0.004);
            bl.vx = Math.sin(bl.life * 0.09 + bl.data.ph!) * 0.25;
            for (const o of bw.bullets) {
              if (o === bl || o.dead || !o.data.size || o.life < (o.data.grow ?? 0)) continue;
              if (Math.abs(o.x - bl.x) < 4 && Math.abs(o.y - bl.y) < 4) {
                o.dead = true;
                bl.data.size = Math.min(3, bl.data.size! + 0.7);
                bl.r = 1 + bl.data.size!;
              }
            }
          },
        });
      }
    },
  },
  vitre_fissures: {
    box: { w: 132, h: 64 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(46, 70 - c.power * 7);
      if (t % every === 2 && t < 320) {
        // An impact on the edge of the glass, toward the heart.
        const side = rng.int(0, 3);
        const x = side === 0 ? b.x + 2 : side === 1 ? b.x + b.w - 2 : rng.range(b.x + 10, b.x + b.w - 10);
        const y = side === 2 ? b.y + 2 : side === 3 ? b.y + b.h - 2 : rng.range(b.y + 8, b.y + b.h - 8);
        const a = Math.atan2(w.soul.y - y, w.soul.x - x) + rng.range(-0.35, 0.35);
        crack(w, x, y, a, pickEmo('colere', 0.25));
        audio.sfx('shatter', { pitch: 1.8, vol: 0.25 });
        fx.shake(1, 6);
      }
      // Splinters of glass.
      if (t % 26 === 13 && t < 350) w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 4, vy: 0.9, spin: 0.2, shape: 'shaving', r: 2, dmg: 2, emo: 'neutre' });
    },
  },
};

/** The hand-gel pump's position (gel_drops). */
const pump = { x: 0, target: 0, press: 0 };

/** Used by the enemies' overlays: a crack drawn on the glass itself (not a projectile). */
export function crackPath(seed: number, x: number, y: number, len: number): Array<[number, number]> {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const pts: Array<[number, number]> = [[x, y]];
  let a = rnd() * Math.PI * 2;
  let cx = x;
  let cy = y;
  for (let i = 0; i < len; i++) {
    a += (rnd() - 0.5) * 1.2;
    cx += Math.cos(a) * (4 + rnd() * 5);
    cy += Math.sin(a) * (3 + rnd() * 4);
    pts.push([Math.round(cx), Math.round(cy)]);
  }
  return pts;
}

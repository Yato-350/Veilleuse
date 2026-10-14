import { ctx2d, makeCanvas } from '../engine/sprite';

/*
 * Illustrations of chapter 5 « La Marée Blanche »: the fifth memory (docs/HISTOIRE.md § 3.13, step 10).
 *   souvenir_vitre         the window of the airlock of room 304, from the corridor side, at night. Fog on the glass.
 *                          Behind it, backlit by a small lamp, the shape of a knitted hat with two sheep ears and
 *                          nothing else (the fog keeps the rest). A small hand pressed flat on the glass, and over it,
 *                          on this side, a boy's hand (navy sleeve, a blue ink stain at the cuff). Taped to the glass
 *                          on her side, facing out, a small drawing: two children under a big moon.
 *   souvenir_vitre_brisee  the same window after La Vitre was broken: one hand only, hers, and nobody behind it; the
 *                          bed is flat. The glass is cracked from top to bottom, and ink runs down the cracks.
 * Only the window, the fog, a hat and hands (§ 6.1). Same family as the real-world memories: flat shapes, dithered
 * gradients, one light source. Key art stays above y 120 (captions cover the bottom). Static layers are cached; the
 * fog breathes (his breath, low on the glass) and the ink keeps running.
 */

type Ctx = CanvasRenderingContext2D;

const SW = 320;
const SH = 180;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Dithered pick in a colour ramp (v in 0..1). */
function ramp(cols: readonly string[], v: number, x: number, y: number): string {
  const p = clamp01(v) * (cols.length - 1);
  const i = Math.floor(p);
  return p - i > bayer(x, y) ? cols[Math.min(i + 1, cols.length - 1)]! : cols[i]!;
}

function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in 0..1 (cell size `s`). */
function noise(x: number, y: number, s: number, seed: number): number {
  const gx = x / s;
  const gy = y / s;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function rect(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Paints a region pixel by pixel; horizontal runs of one colour become a single fillRect. */
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

const layers = new Map<string, HTMLCanvasElement>();
function layer(name: string, paint: (g: Ctx) => void): HTMLCanvasElement {
  let c = layers.get(name);
  if (!c) {
    c = makeCanvas(SW, SH);
    paint(ctx2d(c));
    layers.set(name, c);
  }
  return c;
}

/** Distance from (x, y) to the segment (ax, ay)–(bx, by). */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

// ---------------------------------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------------------------------

/** The window frame and the pane inside it. */
const FRAME = { x0: 56, x1: 264, y0: 8, y1: 121 };
const PANE = { x0: 62, x1: 258, y0: 14, y1: 115 };
const inPane = (x: number, y: number): boolean => x >= PANE.x0 && x < PANE.x1 && y >= PANE.y0 && y < PANE.y1;

/** The small lamp of the room, high on the right, behind the glass. */
const LAMP = { x: 222, y: 30 };
/** Her hand (palm centre) and his, bigger, a little lower on this side: palm to palm through the glass. */
const HER = { x: 166, y: 58, s: 1.12 };
const HIS = { x: 159, y: 77, s: 1.42 };
/** The hat behind the glass. */
const HAT = { x: 126, y: 44 };
/** Where the glass broke. */
const IMPACT = { x: 186, y: 50 };

/**
 * A hand pressed flat, fingers up and a little apart, the thumb out to the right (palm centre cx, cy; scale s).
 * Returns 1 inside the hand, 0 outside.
 */
function inHand(x: number, y: number, cx: number, cy: number, s: number): number {
  const w = 4.6 * s;
  const top = cy - 4.5 * s;
  const bot = cy + 5 * s;
  if (Math.abs(x - cx) <= w && y >= top && y <= bot) {
    // Rounded heel of the hand.
    const rx = Math.max(0, Math.abs(x - cx) - w + 2.2 * s);
    const ry = Math.max(0, y - bot + 2.2 * s);
    if (Math.hypot(rx, ry) <= 2.2 * s) return 1;
  }
  const fingers: Array<[number, number, number, number, number]> = [
    [-3.4, -3.8, -6.2, -11.5, 1.25],
    [-1.1, -4.4, -2.0, -14.0, 1.35],
    [1.3, -4.4, 1.9, -13.4, 1.35],
    [3.5, -3.6, 5.9, -10.2, 1.2],
    // The thumb.
    [4.2, 1.8, 9.6, -2.6, 1.5],
  ];
  for (const [ax, ay, bx, by, r] of fingers) if (segDist(x, y, cx + ax * s, cy + ay * s, cx + bx * s, cy + by * s) <= r * s) return 1;
  return 0;
}

/** Distance (approx., in pixels) from a point to the nearest hand on the glass; 0 inside. */
function nearHand(x: number, y: number, his: boolean): number {
  let best = 99;
  for (let r = 0; r <= 6; r++) {
    // Cheap ring test: is any hand pixel within r?
    for (const [dx, dy] of [
      [0, 0],
      [r, 0],
      [-r, 0],
      [0, r],
      [0, -r],
      [r * 0.7, r * 0.7],
      [-r * 0.7, r * 0.7],
      [r * 0.7, -r * 0.7],
      [-r * 0.7, -r * 0.7],
    ] as const) {
      if (inHand(x + dx, y + dy, HER.x, HER.y, HER.s) || (his && inHand(x + dx, y + dy, HIS.x, HIS.y, HIS.s))) return r;
    }
    if (r >= best) break;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------------------------------------------------

/** The corridor on this side: cold, dim. */
const WALL = ['#0d1017', '#121620', '#171c28', '#1d2331', '#242b3b'];
/** The room behind the glass, from dark to the warm lamp. */
const ROOM = ['#101722', '#15202c', '#1c2934', '#2a3238', '#3f3b36', '#5e4d3c', '#8a6a45', '#c09453', '#efc77a'];
const FRAME_C = { hi: '#9aa3b4', mid: '#737d8f', lo: '#4c5465', deep: '#2c3240' };
const SKIN_HER = { edge: '#b98f87', mid: '#dcb9ad', hi: '#f1d9cd' };
const SKIN_HIS = { edge: '#5a443d', mid: '#7d6157', hi: '#9b7c6f' };
const SLEEVE = ['#0c0d1a', '#14162b', '#1d2142', '#2e2f55'];
const INK = ['#141a44', '#1f2a6b', '#2c3c96'];

// ---------------------------------------------------------------------------------------------------------------------
// Static layers
// ---------------------------------------------------------------------------------------------------------------------

/** How bright the room is at (x, y): the lamp, high on the right. */
function roomLight(x: number, y: number): number {
  const d = Math.hypot((x - LAMP.x) * 0.8, (y - LAMP.y) * 1.1);
  return clamp01(1 - d / 150) ** 1.6;
}

/** Inside a rotated ellipse centred (cx, cy), radii (a, b), angle `ang` (radians). */
function inEllipse(x: number, y: number, cx: number, cy: number, a: number, b: number, ang: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return ((dx * c + dy * s) / a) ** 2 + ((-dx * s + dy * c) / b) ** 2 <= 1;
}

function inHat(x: number, y: number): number {
  // The dome of the knitted hat, its folded brim, and two sheep ears hanging down on the sides.
  const dome = ((x - HAT.x) / 15) ** 2 + ((y - (HAT.y + 2)) / 16) ** 2 <= 1 && y <= HAT.y + 4;
  const brim = Math.abs(x - HAT.x) <= 15.5 - Math.max(0, y - HAT.y - 8) && y > HAT.y + 1 && y <= HAT.y + 9;
  const earL = inEllipse(x, y, HAT.x - 17, HAT.y + 9, 4, 8.5, 0.5);
  const earR = inEllipse(x, y, HAT.x + 17, HAT.y + 9, 4, 8.5, -0.5);
  if (dome || brim || earL || earR) return 1;
  // Under the brim, nothing but a darker shape that dissolves into the fog (shoulders, maybe).
  const sh = ((x - HAT.x) / 30) ** 2 + ((y - (HAT.y + 44)) / 32) ** 2;
  if (y > HAT.y + 9 && sh <= 1) return clamp01(0.95 - (y - HAT.y - 9) / 52);
  return 0;
}

/** The room behind the glass (and the bed). `empty`: nobody, the bed flat. */
function paintRoom(g: Ctx, empty: boolean): void {
  field(g, PANE.x0, PANE.y0, PANE.x1 - PANE.x0, PANE.y1 - PANE.y0, (x, y) => {
    let v = 0.08 + roomLight(x, y) * 0.92;
    // The bed, on the right: a long low shape with its rail; the sheet lighter, flat.
    const bedTop = 86 + Math.round((x - 180) * 0.04);
    if (x > 176 && x < 252 && y >= bedTop && y < bedTop + 15) {
      v = y < bedTop + 2 ? v * 1.1 + 0.32 : v * 0.95 + 0.22;
      // The pillow, at the head of the bed.
      if (x > 232 && x < 248 && y < bedTop + 6) v += 0.12;
      if (y === bedTop + 5 && x % 9 < 2) v *= 0.6;
    }
    if (x > 176 && x < 252 && y >= bedTop + 15) v *= 0.55;
    // A drip stand, left of the bed.
    if (x === 172 && y > 34 && y < 100) v = v * 0.5;
    if (x >= 168 && x <= 176 && y >= 34 && y <= 44 && Math.hypot(x - 172, y - 39) < 4.2) v = v * 0.65 + 0.05;
    let c = ramp(ROOM, v, x, y);
    if (!empty) {
      const h = inHat(x, y);
      if (h >= 1) {
        // Pale wool, lit from the lamp on the right; knitted rows; the ears a little pinker inside.
        const lit = clamp01((x - HAT.x + 18) / 40);
        const row = (y - HAT.y + 40) % 3 === 0 ? -0.08 : 0;
        const ear = Math.abs(x - HAT.x) > 15.5 || y > HAT.y + 9;
        const shade = y > HAT.y + 1 && !ear ? -0.14 : 0;
        c = ear
          ? ramp(['#6a5e5c', '#8e7c78', '#b09a92', '#cdb8ac'], 0.25 + lit * 0.6, x, y)
          : ramp(['#57534f', '#7c766d', '#a29a8c', '#c6bcaa', '#ddd3c0'], 0.2 + lit * 0.7 + row + shade, x, y);
      } else if (h > 0) {
        if (bayer(x, y) < h) c = ramp(['#141b24', '#1d2530', '#26303a'], 0.4, x, y);
      }
    }
    return c;
  });
  // Taped on her side, facing out: a small drawing (two children under a big moon).
  const P = { x: 76, y: 72, w: 30, h: 26 };
  field(g, P.x, P.y, P.w, P.h, (x, y) => {
    const tape = (y < P.y + 3 && (Math.abs(x - P.x - 6) < 4 || Math.abs(x - P.x - P.w + 6) < 4)) ? '#a8a28c' : null;
    if (tape) return tape;
    return ramp(['#6e6a62', '#8f897d', '#b4ab98'], 0.35 + roomLight(x, y) * 0.8, x, y);
  });
  // The moon (yellow crayon) and the two figures (blue, red), small and smudged.
  field(g, P.x, P.y, P.w, P.h, (x, y) => {
    const m = Math.hypot(x - (P.x + 15), y - (P.y + 9));
    if (m < 5.5) return bayer(x, y) < 0.75 ? '#c9a640' : null;
    const boy = (Math.abs(x - (P.x + 10)) <= 1 && y >= P.y + 17 && y <= P.y + 23) || Math.hypot(x - (P.x + 10), y - (P.y + 16)) < 2;
    const girl = (Math.abs(x - (P.x + 20)) <= 1 && y >= P.y + 17 && y <= P.y + 23) || Math.hypot(x - (P.x + 20), y - (P.y + 16)) < 2;
    if (boy) return '#3f5bb0';
    if (girl) return '#b04848';
    if (y === P.y + 19 && x > P.x + 11 && x < P.x + 19) return '#7d6a5a';
    return null;
  });
}

/** This side: the corridor wall, the frame, the sill. Drawn over the room (the pane is left as a hole). */
function paintWall(g: Ctx): void {
  field(g, 0, 0, SW, SH, (x, y) => {
    if (inPane(x, y)) return null;
    // Frame.
    if (x >= FRAME.x0 && x < FRAME.x1 && y >= FRAME.y0 && y < FRAME.y1) {
      const ix = Math.min(x - FRAME.x0, FRAME.x1 - 1 - x);
      const iy = Math.min(y - FRAME.y0, FRAME.y1 - 1 - y);
      const i = Math.min(ix, iy);
      if (i === 0) return FRAME_C.deep;
      if (i === 5) return FRAME_C.deep;
      // Lit from the room: the inner bevel on the left and bottom catches a little warm light.
      if (y - FRAME.y0 === i) return i < 3 ? FRAME_C.hi : FRAME_C.mid;
      if (x - FRAME.x0 === i) return i < 3 ? FRAME_C.mid : FRAME_C.lo;
      return i < 3 ? FRAME_C.lo : FRAME_C.mid;
    }
    // The sill below the window.
    if (y >= FRAME.y1 && y < FRAME.y1 + 4 && x >= FRAME.x0 - 4 && x < FRAME.x1 + 4) return y === FRAME.y1 ? '#8a93a3' : '#5a6272';
    if (y === FRAME.y1 + 4 && x >= FRAME.x0 - 4 && x < FRAME.x1 + 4) return '#0a0c12';
    // The wall: darker away from the window, a faint warm spill under it.
    const spill = clamp01(1 - Math.hypot((x - 160) / 150, (y - 120) / 50)) * 0.5;
    const v = 0.25 + spill * 0.9 - Math.abs(x - 160) / 600 + noise(x, y, 9, 3) * 0.12;
    // Panel seams, a handrail low on the wall.
    if (y > 150 && y < 154) return y === 150 + 1 ? '#3a4152' : '#232937';
    if ((x === 20 || x === 300) && y < 150) return WALL[0]!;
    return ramp(WALL, v, x, y);
  });
  // A small round sign beside the window (no text: a crossed-out cough cloud, a thermometer).
  field(g, 270, 30, 28, 28, (x, y) => {
    const d = Math.hypot(x - 284, y - 44);
    if (d > 12.5) return null;
    if (d > 11) return '#7a2b34';
    const bar = Math.abs(x - 284 - (y - 44)) < 1.3 && d < 10;
    if (bar) return '#9c3540';
    const cloud = Math.hypot(x - 281, y - 45) < 4 || Math.hypot(x - 287, y - 44) < 3.5 || Math.hypot(x - 284, y - 41) < 3.5;
    if (cloud) return '#8d96a6';
    return '#c7ccd3';
  });
}

/** A translucent fog colour (alpha quantised so that runs of pixels still merge). */
const fogC = (a: number): string | null => {
  const q = Math.round(clamp01(a) * 20) / 20;
  return q <= 0 ? null : `rgba(214,224,234,${q})`;
};

/** The fog on the glass, with the cleared halos around the hands and a few condensation trails. */
function paintFog(g: Ctx, his: boolean): void {
  field(g, PANE.x0, PANE.y0, PANE.x1 - PANE.x0, PANE.y1 - PANE.y0, (x, y) => {
    let k = 0.1 + noise(x, y, 22, 41) * 0.2 + noise(x, y, 7, 42) * 0.06 + clamp01((y - 50) / 70) * 0.16;
    // Thicker along the cold frame.
    k += clamp01(1 - Math.min(x - PANE.x0, PANE.x1 - x, y - PANE.y0, PANE.y1 - y) / 9) * 0.14;
    // On her side, her own breath fogs the glass under the hat: nothing shows there.
    if (his) k += clamp01(1 - Math.hypot((x - HAT.x) / 1.3, y - (HAT.y + 20)) / 18) * 0.42;
    const near = nearHand(x, y, his);
    if (near <= 2) return null;
    if (near <= 6) k *= (near - 2) / 5;
    // Condensation trails: clear lines running down, a bead at the end.
    const col = Math.floor((x - PANE.x0) / 23);
    const tx = PANE.x0 + col * 23 + Math.floor(hash(col, 0, 51) * 18) + 3;
    const ty = PANE.y0 + 10 + Math.floor(hash(col, 1, 51) * 40);
    const tl = 20 + Math.floor(hash(col, 2, 51) * 30);
    const trail = hash(col, 3, 51) < 0.55 && (!his || inHat(x, y) === 0);
    if (trail && x === tx && y > ty && y < ty + tl) return null;
    if (trail && x === tx && y === ty + tl) return 'rgba(236,242,248,0.7)';
    // A little grain, so that it reads as droplets and not as paint.
    k += (hash(x, y, 43) - 0.5) * 0.08;
    return fogC(k);
  });
}

function paintHerHand(g: Ctx): void {
  const { x: cx, y: cy, s } = HER;
  field(g, cx - 14, cy - 18, 30, 30, (x, y) => {
    if (!inHand(x + 0.5, y + 0.5, cx, cy, s)) return null;
    const edge = !inHand(x - 0.5, y + 0.5, cx, cy, s) || !inHand(x + 1.5, y + 0.5, cx, cy, s) || !inHand(x + 0.5, y - 0.5, cx, cy, s) || !inHand(x + 0.5, y + 1.5, cx, cy, s);
    if (edge) return SKIN_HER.edge;
    // Pressed flat: paler where it presses (the palm, the fingertips).
    const press = Math.hypot(x - cx, y - cy) < 3.2 * s || y < cy - 10 * s;
    return press ? SKIN_HER.hi : bayer(x, y) < 0.3 ? SKIN_HER.hi : SKIN_HER.mid;
  });
}

/** The boy's sleeve, from his wrist down to the bottom left (0 outside, else the distance ratio from its axis). */
function inSleeve(x: number, y: number): number {
  const { x: cx, y: cy, s } = HIS;
  if (y < cy + 6 * s) return 0;
  const d = segDist(x, y, cx - 1, cy + 7 * s, cx - 40, SH + 20);
  const w = 6.5 + (y - cy) * 0.06;
  return d > w ? 0 : Math.max(0.01, d / w);
}

function paintHisHand(g: Ctx): void {
  const { x: cx, y: cy, s } = HIS;
  // The sleeve, from the wrist down to the bottom left (it leaves the key-art band below y 120). In shadow: the light
  // comes from the room, so only its upper ridge catches a little of it.
  field(g, 60, cy, 140, SH - cy, (x, y) => {
    if (!inSleeve(x, y)) return null;
    const along = (y - cy) / (SH - cy);
    const right = inSleeve(x + 2, y) === 0;
    // The cuff: a ribbed band.
    if (y < cy + 6 * s + 5) return (x + y) % 3 === 0 ? SLEEVE[0]! : SLEEVE[1]!;
    // A blue ink stain at the cuff, where he coughed.
    if (Math.hypot(x - (cx - 9), y - (cy + 19)) < 3.2 + noise(x, y, 2, 77) * 1.6) return Math.hypot(x - (cx - 9), y - (cy + 19)) < 2 ? INK[2]! : INK[1]!;
    const fold = Math.abs(((y - cy) % 23) - 11) < 1 ? -0.3 : 0;
    return ramp(SLEEVE, (right ? 0.75 : 0.32) - along * 0.3 + fold, x, y);
  });
  field(g, cx - 20, cy - 24, 42, 36, (x, y) => {
    if (!inHand(x + 0.5, y + 0.5, cx, cy, s)) return null;
    if (y > cy + 6 * s) return null;
    const edge = !inHand(x - 0.5, y + 0.5, cx, cy, s) || !inHand(x + 1.5, y + 0.5, cx, cy, s) || !inHand(x + 0.5, y - 0.5, cx, cy, s);
    if (edge) return SKIN_HIS.edge;
    // The back of the hand, lit a little from the room through the glass (from above): knuckles, tendons.
    const knuckle = Math.abs(y - (cy - 4.2 * s)) < 1 && Math.abs(x - cx) < 4 * s && (x - cx + 10) % 3 === 0;
    if (knuckle) return SKIN_HIS.hi;
    const lit = clamp01((cy + 6 * s - y) / (20 * s));
    return ramp([SKIN_HIS.edge, SKIN_HIS.mid, SKIN_HIS.hi], 0.25 + lit * 0.6, x, y);
  });
}

/** The cracks of the broken glass, as polylines from the impact point (computed once). */
const CRACKS: Array<Array<[number, number]>> = (() => {
  const out: Array<Array<[number, number]>> = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(i, 0, 91) * 0.5;
    const len = 50 + hash(i, 1, 91) * 110;
    const pts: Array<[number, number]> = [[IMPACT.x, IMPACT.y]];
    let x = IMPACT.x;
    let y = IMPACT.y;
    let ang = a;
    for (let s = 0; s < len; s += 7) {
      ang += (hash(i, s, 92) - 0.5) * 0.6;
      x += Math.cos(ang) * 7;
      y += Math.sin(ang) * 7;
      if (!inPane(Math.round(x), Math.round(y))) break;
      pts.push([x, y]);
    }
    out.push(pts);
  }
  // A ring around the impact.
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = 9 + hash(i, 5, 93) * 4;
    ring.push([IMPACT.x + Math.cos(a) * r, IMPACT.y + Math.sin(a) * r]);
  }
  out.push(ring);
  return out;
})();

function paintCracks(g: Ctx): void {
  for (const pts of CRACKS) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(ax + ((bx - ax) * s) / steps);
        const y = Math.round(ay + ((by - ay) * s) / steps);
        if (!inPane(x, y)) continue;
        rect(g, x + 1, y, 1, 1, '#e6edf3');
        rect(g, x, y, 1, 1, '#0b0e18');
      }
    }
  }
}

/** Where ink runs down from the cracks: [x, y, max length]. */
const DRIPS: Array<[number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  CRACKS.slice(0, -1).forEach((pts, i) => {
    for (let j = 1; j < pts.length; j += 2) {
      if (hash(i, j, 95) < 0.62) continue;
      const [x, y] = pts[j]!;
      out.push([Math.round(x), Math.round(y), 10 + Math.floor(hash(i, j, 96) * 34)]);
    }
  });
  return out;
})();

// ---------------------------------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------------------------------

function paintVitre(g: Ctx): void {
  paintRoom(g, false);
  paintFog(g, true);
  paintHerHand(g);
  paintWall(g);
  paintHisHand(g);
}

function paintVitreBrisee(g: Ctx): void {
  paintRoom(g, true);
  paintFog(g, false);
  paintHerHand(g);
  paintCracks(g);
  paintWall(g);
}

/** His breath, low on the glass: a patch of fog that grows and shrinks. */
function breath(g: Ctx, t: number, his: boolean): void {
  const k = 0.5 + 0.5 * Math.sin(t * 0.028);
  const cx = 150;
  const cy = 106;
  const r = 24 + k * 12;
  field(g, cx - 44, cy - 30, 88, PANE.y1 - (cy - 30), (x, y) => {
    if (!inPane(x, y)) return null;
    const d = Math.hypot((x - cx) / 1.5, y - cy);
    if (d > r) return null;
    if (his && (inHand(x, y, HIS.x, HIS.y, HIS.s) || inSleeve(x, y))) return null;
    return fogC((1 - d / r) ** 0.8 * (0.12 + k * 0.3));
  });
}

export const CH5_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  souvenir_vitre: (g, t) => {
    g.drawImage(layer('souvenir_vitre', paintVitre), 0, 0);
    breath(g, t, true);
    // The hands stay; the fog around them lifts a little, very slowly.
    const lift = Math.min(1, t / 700);
    if (lift > 0) {
      g.save();
      g.globalAlpha = 0.18 * lift;
      g.fillStyle = '#efc77a';
      field(g, HER.x - 22, HER.y - 26, 46, 44, (x, y) => (Math.hypot(x - HER.x, y - HER.y + 4) < 20 * lift && bayer(x, y) < 0.5 && !inHand(x, y, HIS.x, HIS.y, HIS.s) ? '#efc77a' : null));
      g.restore();
    }
  },
  souvenir_vitre_brisee: (g, t) => {
    g.drawImage(layer('souvenir_vitre_brisee', paintVitreBrisee), 0, 0);
    breath(g, t, false);
    // Ink runs down the cracks, slowly, and keeps running.
    for (const [i, [x, y, max]] of DRIPS.entries()) {
      const len = Math.min(max, Math.floor(t * (0.025 + hash(i, 7, 97) * 0.045)) + 2);
      const wide = hash(i, 8, 97) < 0.4;
      for (let k = 0; k < len; k++) {
        const yy = y + k;
        if (!inPane(x, yy)) break;
        // Thick where it leaves the crack, a thread further down.
        rect(g, x, yy, 1, 1, k < len * 0.3 ? INK[0]! : INK[1]!);
        if (wide && k < len * 0.5) rect(g, x + 1, yy, 1, 1, INK[0]!);
      }
      // Some runs end in a heavier drop.
      const end = y + len;
      if (hash(i, 9, 97) < 0.5 && inPane(x, end)) {
        rect(g, x, end, wide ? 2 : 1, 2, INK[1]!);
        rect(g, x, end, 1, 1, INK[2]!);
      }
    }
  },
};

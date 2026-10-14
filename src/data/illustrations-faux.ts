import { ctx2d, makeCanvas } from '../engine/sprite';

/*
 * Illustrations of the false dawn (docs/HISTOIRE.md § 3.9, § 4 « Fausse aube »):
 *   faux_aube        the hug, in close-up. Morning light far too warm, the butter wallpaper with its coral dots out of
 *                    focus, the crayon sun in the window behind. Maman smiles with her eyes shut, her cheeks pink, her
 *                    hand in Noa's hair (the back of his head, bottom left). Her lips are closed in the smile and sewn
 *                    shut with red thread: six neat cross-stitches, like the mouth of a rag doll — no wound, no blood,
 *                    only thread. A loose end hangs from the corner and sways.
 *   faux_aube_encre  the same picture on the route of the ink: where her face should be, a blot of ink, glossy, that
 *                    runs down her neck in slow drips. Her hair, her hand, the light: all the rest is the same.
 * Key art stays above y 120: the captions cover the bottom.
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

function rect(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Paints a region pixel by pixel (null = leave); horizontal runs become one fillRect. */
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

const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): number => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;

/** A thick line (round brush of radius `r`). */
function brush(g: Ctx, x0: number, y0: number, x1: number, y1: number, r: number, c: string): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    rect(g, x - r, y - r, r * 2 + 1, r * 2 + 1, c);
  }
}

// --- Layout ---------------------------------------------------------------------------------------------------------

/** Her face. */
const FX = 186;
const FY = 62;
const FRX = 32;
const FRY = 40;
/** The corners of her mouth (closed, curved up in the smile). */
const MX0 = 170;
const MX1 = 202;
const MY = 90;
/** The mouth line: y at x (a shallow smile). */
const mouthY = (x: number): number => MY - 3 * (((x - (MX0 + MX1) / 2) / ((MX1 - MX0) / 2)) ** 2) + 1;

const SKIN = ['#fff0e0', '#ffd9c0', '#f6b89c', '#e0917a', '#b86a5a'];
const HAIR = ['#b0704a', '#8a5236', '#6a3a28', '#4a2618', '#2e1610'];
const CARDIGAN = ['#ffd6e2', '#f7aac0', '#e07ba5', '#b05a80'];
const NOA_HAIR = ['#7a78c8', '#5a58a8', '#3f3d83', '#2b2956', '#1a1838'];
const THREAD = '#d8203c';
const THREAD_LIGHT = '#ff7080';
const THREAD_DARK = '#8a1028';

// --- Background ------------------------------------------------------------------------------------------------------

function paintRoom(g: Ctx): void {
  // Butter wallpaper, warmer and brighter toward the window (top left), its coral dots blurred into soft discs.
  field(g, 0, 0, SW, SH, (x, y) => {
    const light = clamp01(1 - Math.hypot(x - 30, y - 10) / 330);
    const base = ramp(['#f2c27a', '#f7d48e', '#fbe2a6', '#fff0c8'], light + hash(x >> 2, y >> 2, 3) * 0.05, x, y);
    // Dots on a lattice, out of focus (big, soft, two tones).
    const lx = ((x + (Math.floor(y / 26) % 2) * 13) % 26) - 13;
    const ly = (y % 26) - 13;
    const d = Math.hypot(lx, ly);
    if (d < 4.5) return ramp(['#f6b8a0', '#f7c8a8'], d / 4.5, x, y);
    if (d < 6 && bayer(x, y) < 0.4) return '#f8d0a4';
    return base;
  });
  // The window, left: the frame, a blinding sky, the crayon sun (its rays drawn in quick strokes).
  field(g, 0, 0, 92, 120, (x, y) => (x > 86 || y > 112 ? null : ramp(['#bfe8ff', '#fff4d8', '#ffe2b8', '#ffc8b8'], y / 112 + hash(x >> 3, y >> 3, 9) * 0.04, x, y)));
  rect(g, 86, 0, 8, 120, '#fffaf2');
  rect(g, 92, 0, 2, 120, '#ead9bd');
  rect(g, 0, 112, 94, 8, '#fffaf2');
  rect(g, 0, 118, 94, 2, '#ead9bd');
  rect(g, 0, 52, 86, 4, '#fffaf2');
  rect(g, 40, 0, 4, 112, '#fffaf2');
  // The sun, in wax crayon: a ring pressed hard, filled with gaps, uneven rays (one far too long).
  const SX = 64;
  const SY = 26;
  field(g, SX - 14, SY - 14, 29, 29, (x, y) => {
    const d = Math.hypot(x - SX, y - SY);
    if (d > 12.5) return null;
    if (d > 10.5) return '#f2b51e';
    return hash(x, y + (x % 3), 4) > 0.25 ? ((x * 2 + y) % 7 === 0 ? '#f6c33a' : '#ffe36b') : null;
  });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2;
    const len = 18 + Math.round(hash(i, 1, 6) * 6) + (i === 6 ? 9 : 0);
    brush(g, SX + Math.cos(a) * 15, SY + Math.sin(a) * 15, SX + Math.cos(a) * len, SY + Math.sin(a) * len, 0, i % 2 ? '#e8823a' : '#f2a43a');
  }
  // Two crayon birds.
  for (const [bx, by] of [
    [14, 70],
    [24, 76],
  ] as const) {
    brush(g, bx, by, bx + 3, by + 3, 0, '#5a6fb8');
    brush(g, bx + 3, by + 3, bx + 6, by, 0, '#5a6fb8');
  }
}

// --- Maman ----------------------------------------------------------------------------------------------------------

/** Top of her shoulders at x (an arc under the head). */
const shoulderY = (x: number): number => 118 + ((x - FX) / 100) ** 2 * 34;
/** Outer edge of the hair at height y: the crown, then two long curtains that widen a little and wave. */
const hairHalfWidth = (y: number): number => {
  if (y < FY - 8) return Math.sqrt(Math.max(0, 1 - ((y - (FY - 8)) / 50) ** 2)) * 44;
  return 44 + (y - FY + 8) * 0.12 + Math.sin(y * 0.18) * 2;
};
/** Bottom of the hair (wavy ends, longer on the sides). */
const hairBottom = (x: number): number => 136 + Math.abs(x - FX) * 0.1 + Math.sin(x * 0.4) * 3;

/** Hair behind the face (long, falling over the shoulders), the neck, and the shoulders in a pink cardigan. */
function paintBody(g: Ctx): void {
  // Shoulders and cardigan (under everything else), lit from the left; a ribbed knit.
  field(g, 70, 100, 250, 80, (x, y) => {
    if (y < shoulderY(x)) return null;
    const rib = (x + Math.floor(y / 2)) % 4 === 0 ? 0.12 : 0;
    return ramp(CARDIGAN, 0.15 + (x - 100) / 300 + (y - 110) / 140 + rib, x, y);
  });
  // Hair behind the face: crown and curtains.
  field(g, FX - 60, FY - 60, 120, 150, (x, y) => {
    const hw = hairHalfWidth(y);
    if (Math.abs(x - FX) > hw || y > hairBottom(x)) return null;
    const strand = Math.sin((x - FX) * 0.5 + Math.sin(y * 0.06) * 2.5) * 0.1;
    const edge = Math.abs(x - FX) > hw - 3 ? 0.18 : 0;
    return ramp(HAIR, 0.22 + (x - FX + 40) / 170 + (y - FY + 50) / 320 + strand + edge, x, y);
  });
  // Neck, in the shadow of the chin.
  field(g, FX - 14, FY + 30, 30, 30, (x, y) => {
    if (Math.abs(x - FX - 1) > 12 || y > shoulderY(x) + 4) return null;
    return ramp(SKIN, 0.55 + (x - FX) / 50 + (FY + 40 - y) / 80, x, y);
  });
  // A rounded collar opening (the cardigan's neckline) and three pearl buttons.
  field(g, FX - 26, FY + 44, 54, 28, (x, y) => {
    const v = ell(x, y, FX + 1, FY + 44, 18, 14);
    if (v > 1 && v < 1.45 && y > shoulderY(x)) return ramp(CARDIGAN, 0.05 + (y - FY - 44) / 90, x, y);
    return null;
  });
  for (let i = 0; i < 3; i++) {
    rect(g, FX, FY + 62 + i * 9, 3, 3, '#fff4f8');
    rect(g, FX + 2, FY + 64 + i * 9, 1, 1, '#d890a8');
  }
}

/** The face (skin, blush, closed eyes, nose) and the side-swept fringe over it. */
function paintFace(g: Ctx): void {
  const chin = (y: number): number => (y > FY + 10 ? FRX - (y - FY - 10) * 0.3 : FRX);
  field(g, FX - FRX - 1, FY - FRY - 1, FRX * 2 + 3, FRY * 2 + 3, (x, y) => {
    const rx = Math.max(4, chin(y));
    if (ell(x, y, FX, FY, rx, FRY) > 1) return null;
    const v = 0.18 + (x - FX + FRX) / 190 + (y - FY + FRY) / 260 + (ell(x, y, FX, FY, rx, FRY) > 0.84 ? 0.14 : 0);
    // Blush: two soft pink discs.
    for (const cx of [FX - 17, FX + 17]) {
      const d = ell(x, y, cx, FY + 11, 9, 5);
      if (d < 1 && bayer(x, y) < 1 - d) return d < 0.45 ? '#f6a0a0' : '#f8b4a8';
    }
    return ramp(SKIN, v, x, y);
  });
  paintFringe(g, 16);
  // Eyebrows: soft arches.
  for (const cx of [FX - 14, FX + 14]) for (let i = -6; i <= 6; i++) rect(g, cx + i, FY - 13 + Math.round((i * i) / 14), 1, 2, '#7a4630');
  // Eyes shut in a smile: two crescents (upturned arcs), lashes at the outer corners.
  for (const [cx, side] of [
    [FX - 14, -1],
    [FX + 14, 1],
  ] as const) {
    for (let i = -7; i <= 7; i++) {
      const y = FY + 2 - Math.round(4 - (i * i) / 12);
      rect(g, cx + i, y, 1, 2, '#3a1e16');
    }
    rect(g, cx + side * 8, FY - 1, 2, 1, '#3a1e16');
    rect(g, cx + side * 9, FY - 2, 1, 1, '#3a1e16');
    // The fold under the closed eye, lighter.
    for (let i = -5; i <= 5; i++) rect(g, cx + i, FY + 4 - Math.round(3 - (i * i) / 14), 1, 1, '#f0b090');
  }
  // Nose: a little shadow on the right and the nostrils.
  for (let i = 0; i < 11; i++) rect(g, FX + 3, FY + 4 + i, 1, 1, i > 7 ? '#d88c74' : '#eeb39b');
  rect(g, FX - 3, FY + 16, 3, 1, '#c87a68');
  rect(g, FX + 2, FY + 16, 3, 1, '#c87a68');
}

/** The fringe, swept from a parting on the left across the forehead, in locks with rounded tips. */
function paintFringe(g: Ctx, depth: number): void {
  const part = FX - 12;
  const top = FY - FRY - 2;
  field(g, FX - FRX - 6, top - 4, FRX * 2 + 12, depth + 18, (x, y) => {
    if (ell(x, y, FX, FY - 6, FRX + 6, FRY + 6) > 1) return null;
    let edge: number;
    if (x >= part) {
      // The big lock sweeping right: longer toward the temple, scalloped by its strands.
      const k = (x - part) / (FX + FRX - part);
      edge = top + 6 + depth * (0.35 + 0.55 * k) + Math.abs(Math.sin((x - part) * 0.28)) * 3;
    } else {
      // A short lock on the left of the parting, curling down to the cheek.
      const k = (part - x) / (part - FX + FRX);
      edge = top + 6 + depth * (0.25 + 0.9 * k * k) + Math.abs(Math.sin((x - part) * 0.35)) * 2;
    }
    if (y > edge) return null;
    const strand = Math.sin((x - part) * 0.45 - y * 0.2) * 0.12;
    return ramp(HAIR, 0.08 + (x - FX + 30) / 200 + (y - top) / 90 + strand, x, y);
  });
  // The parting.
  for (let y = top - 2; y < top + 6; y++) rect(g, part + (y - top) * 0.2, y, 1, 1, '#4a2618');
}

/** The closed lips, in a smile, sewn shut: six cross-stitches of red thread, and a loose end. */
function paintMouth(g: Ctx): void {
  // Lips: a pink band either side of the closed line.
  for (let x = MX0; x <= MX1; x++) {
    const y = Math.round(mouthY(x));
    const t = 1 - Math.abs(x - (MX0 + MX1) / 2) / ((MX1 - MX0) / 2 + 1);
    const up = Math.round(1 + t * 2);
    const down = Math.round(1 + t * 3);
    rect(g, x, y - up, 1, up, '#e08a84');
    rect(g, x, y + 1, 1, down, '#ea9c94');
    rect(g, x, y, 1, 1, '#8a3a36');
    if (t > 0.3) rect(g, x, y + down, 1, 1, '#f4b4a4');
  }
  // The smile's dimples.
  rect(g, MX0 - 2, Math.round(mouthY(MX0)) - 2, 1, 2, '#c87a68');
  rect(g, MX1 + 2, Math.round(mouthY(MX1)) - 2, 1, 2, '#c87a68');
  // Cross-stitches: each an X over the line, the thread going in and out of tiny pricks.
  for (let i = 0; i < 6; i++) {
    const cx = MX0 + 3 + i * 5.2;
    const cy = mouthY(cx);
    const h = 4;
    brush(g, cx - 2, cy - h, cx + 2, cy + h, 0, THREAD);
    brush(g, cx + 2, cy - h, cx - 2, cy + h, 0, THREAD_DARK);
    rect(g, cx - 2, cy - h - 1, 1, 1, '#9a5048');
    rect(g, cx + 2, cy - h - 1, 1, 1, '#9a5048');
    rect(g, cx - 2, cy + h + 1, 1, 1, '#9a5048');
    rect(g, cx + 2, cy + h + 1, 1, 1, '#9a5048');
    rect(g, cx - 1, cy - h + 1, 1, 1, THREAD_LIGHT);
  }
}

/** The loose end of the thread, from the right corner of her mouth (sways with t). */
function looseThread(g: Ctx, t: number): void {
  let x = MX1 + 1;
  let y = mouthY(MX1) + 1;
  for (let i = 0; i < 22; i++) {
    const sway = Math.sin(t * 0.04 + i * 0.25) * (i / 22) * 2.2;
    const nx = MX1 + 2 + i * 0.35 + sway;
    const ny = y + 1;
    rect(g, nx, ny, 1, 1, i % 5 === 0 ? THREAD_DARK : THREAD);
    x = nx;
    y = ny;
  }
  rect(g, x, y + 1, 1, 1, THREAD_DARK);
}

/** Noa, from behind, his head against her shoulder (bottom left), her arm around him. */
function paintNoa(g: Ctx): void {
  const NX = 140;
  const NY = 158;
  field(g, NX - 50, NY - 46, 100, 70, (x, y) => {
    if (ell(x, y, NX, NY, 46, 42) > 1) return null;
    // Messy tufts along the crown: spikes of hair against the light.
    const a = Math.atan2(y - NY, x - NX);
    const spike = Math.max(0, Math.sin(a * 9 + 0.6)) ** 3 * 0.18;
    if (ell(x, y, NX, NY, 46, 42) > 0.86 - spike && y < NY) return null;
    const strand = Math.sin((x - NX) * 0.38 + (y - NY) * 0.2) * 0.1;
    return ramp(NOA_HAIR, 0.15 + (y - NY + 42) / 90 + (x - NX + 46) / 280 + strand, x, y);
  });
  // A rim of morning light on the top of his hair.
  for (let i = -34; i <= 24; i++) {
    const y = NY - Math.round(Math.sqrt(Math.max(0, 1 - (i / 46) ** 2)) * 42) + 3;
    if (hash(i, 7, 3) > 0.25) rect(g, NX + i, y, 1, 1, '#a8a6ec');
  }
  // His ear, peeking out on the right.
  field(g, NX - 46, NY - 4, 9, 14, (x, y) => (ell(x, y, NX - 42, NY + 3, 4, 7) <= 1 ? ramp(SKIN, 0.3 + (y - NY) / 30, x, y) : null));
  // Her hand on his back, under the captions: a sleeve of the cardigan across the bottom.
  field(g, 60, 168, 200, 12, (x, y) => (y > 172 - (x - 60) * 0.04 ? ramp(CARDIGAN, 0.2 + (x - 60) / 300 + (y - 168) / 20, x, y) : null));
}

/** The ink route: her face is a blot of ink, glossy, running down her neck. */
function paintInkFace(g: Ctx): void {
  field(g, FX - FRX - 8, FY - FRY - 6, FRX * 2 + 16, FRY * 2 + 16, (x, y) => {
    const wob = Math.sin(Math.atan2(y - FY, x - FX) * 5) * 0.08 + hash(x >> 2, y >> 2, 21) * 0.06;
    const d = ell(x, y, FX, FY + 2, FRX + 4, FRY + 4);
    if (d > 1 + wob) return null;
    // Glossy: a cold sheen on the upper left.
    const sheen = ell(x, y, FX - 14, FY - 18, 10, 6);
    if (sheen < 1 && bayer(x, y) < 1 - sheen) return sheen < 0.4 ? '#4a4a7a' : '#262642';
    return d > 0.9 ? '#1c1424' : '#0b0710';
  });
  // The fringe still falls over it.
  paintFringe(g, 12);
}

/** Ink drips running down her neck (the blot keeps running: t moves them). */
function inkDrips(g: Ctx, t: number): void {
  const drips = [
    [FX - 16, 0.6, 18],
    [FX - 4, 0.9, 30],
    [FX + 9, 0.5, 22],
    [FX + 21, 0.75, 14],
  ] as const;
  for (const [x, speed, max] of drips) {
    const len = 6 + ((t * speed * 0.2) % max);
    const top = FY + FRY - 2;
    rect(g, x - 1, top, 3, len, '#0b0710');
    rect(g, x - 2, top + len - 2, 5, 3, '#0b0710');
    rect(g, x - 1, top + 2, 1, len - 4, '#262642');
  }
}

// --- Registry --------------------------------------------------------------------------------------------------------

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

/** Warm motes drifting in the light (far too much light). */
function motes(g: Ctx, t: number): void {
  for (let i = 0; i < 30; i++) {
    const x = Math.round((hash(i, 1, 2) * SW + t * (0.04 + hash(i, 3, 2) * 0.06)) % SW);
    const y = Math.round((hash(i, 2, 2) * 120 + Math.sin(t * 0.02 + i) * 3) % 120);
    g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 0.05 + i * 1.3);
    rect(g, x, y, 1, 1, '#fffaf0');
  }
  g.globalAlpha = 1;
}

export const FAUX_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  faux_aube: (g, t) => {
    g.drawImage(
      layer('faux_aube', (c) => {
        paintRoom(c);
        paintBody(c);
        paintFace(c);
        paintMouth(c);
        paintNoa(c);
      }),
      0,
      0,
    );
    looseThread(g, t);
    motes(g, t);
  },
  faux_aube_encre: (g, t) => {
    g.drawImage(
      layer('faux_aube_encre', (c) => {
        paintRoom(c);
        paintBody(c);
        paintInkFace(c);
      }),
      0,
      0,
    );
    inkDrips(g, t);
    g.drawImage(layer('faux_aube_noa', (c) => paintNoa(c)), 0, 0);
    motes(g, t);
  },
};

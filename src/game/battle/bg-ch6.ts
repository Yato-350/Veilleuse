import { W } from '../../engine/constants';
import { ctx2d, makeCanvas } from '../../engine/sprite';

/*
 * Battle backgrounds of chapter 6 « Le Ventre de Dodo » (docs/HISTOIRE.md § 3.14), drawn above the ground line (y 83):
 *   ventre  inside the plush: damp, yellowed cotton bulging from the walls and the roof, sewing pins hanging like
 *           stalactites, bridges of Mina's red thread sagging between them. The cotton swells a little on each
 *           heartbeat (muffled, slow), and now and then a drop of damp falls.
 *   voix    the arena of the final battle: the voice module, as big as a cathedral — a slab of beige plastic, its round
 *           speaker grille behind Dodo, the REC and PLAY buttons, a red LED that blinks. Its battery leaks a white
 *           crust that spreads like rot from the corners: `CH6_BG.rot` (0..1) is set by the final battle and grows.
 * Static layers are cached (the crust by steps of rot).
 */

/** Shared with the final battle: how far the battery's crust has spread (0..1), and a heartbeat pulse (0..1). */
export const CH6_BG = { rot: 0.15 };

const TOP = 84;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;

function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

function ramp(cols: readonly string[], v: number, x: number, y: number): string {
  const p = Math.max(0, Math.min(1, v)) * (cols.length - 1);
  const i = Math.floor(p);
  return p - i > bayer(x, y) ? cols[Math.min(i + 1, cols.length - 1)]! : cols[i]!;
}

/** Paints a region pixel by pixel (horizontal runs of one colour become one fillRect). */
function field(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => string | null): void {
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

const cache = new Map<string, HTMLCanvasElement>();
function layer(key: string, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(W, TOP);
    paint(ctx2d(c));
    cache.set(key, c);
  }
  return c;
}

// ---------------------------------------------------------------------------------------------------------------------
// ventre — inside the plush
// ---------------------------------------------------------------------------------------------------------------------

const COTTON = ['#1d1410', '#2e2119', '#4a3a2b', '#6b5640', '#8e7a58', '#b29f78', '#cfc09a', '#e2d6b4'];

/** How much cotton fills (x, y): thick on the walls and the roof, a dark hollow in the middle. */
function cottonAt(x: number, y: number): number {
  const cx = (x - W / 2) / (W / 2);
  const cy = (y - 52) / 52;
  const hollow = 1 - Math.min(1, Math.hypot(cx * 0.92, cy * 1.25));
  const lumps = noise(x, y, 14, 3) * 0.6 + noise(x, y, 6, 4) * 0.4;
  return lumps - hollow * 1.15 + 0.12;
}

function paintVentre(g: CanvasRenderingContext2D): void {
  field(g, 0, 0, W, TOP, (x, y) => {
    const v = cottonAt(x, y);
    if (v < 0.05) {
      // The hollow: almost black, a faint warm glow low in the middle.
      const glow = Math.max(0, 1 - Math.hypot((x - W / 2) / 120, (y - 70) / 40));
      return ramp(['#0e0907', '#160f0c', '#1f1510'], glow * 0.9, x, y);
    }
    // Lit from the hollow: the edges of the lumps catch the light, the rest is damp and dark.
    const edge = Math.min(1, v * 3);
    const light = (1 - edge) * 0.75 + noise(x, y, 3, 9) * 0.25;
    return ramp(COTTON, 0.18 + light * 0.72, x, y);
  });
  // Mildew: greenish-grey stains soaking into the cotton.
  field(g, 0, 0, W, TOP, (x, y) => {
    if (cottonAt(x, y) < 0.12) return null;
    const m = noise(x, y, 9, 21);
    return m > 0.72 && hash(x, y, 5) < (m - 0.72) * 4 ? ramp(['#3d3a28', '#55513a'], hash(x, y, 6), x, y) : null;
  });
  // Pins hanging from the roof like stalactites: a coloured head, a long grey shaft, a point.
  const heads = ['#e8505b', '#f5c04f', '#6d8fd6', '#fffaf2', '#8fd28a'];
  for (let i = 0; i < 17; i++) {
    const x = 8 + Math.floor(hash(i, 1, 31) * (W - 16));
    let top = 0;
    while (top < 40 && cottonAt(x, top) > 0.05) top++;
    const len = 8 + Math.floor(hash(i, 2, 31) * 22);
    const y0 = Math.max(0, top - 3);
    g.fillStyle = '#7d6f86';
    g.fillRect(x, y0, 1, len);
    g.fillStyle = '#b7aab8';
    g.fillRect(x, y0, 1, Math.floor(len * 0.6));
    g.fillStyle = '#ece2df';
    g.fillRect(x, y0 + len, 1, 1);
    const hc = heads[i % heads.length]!;
    g.fillStyle = '#1c1424';
    g.fillRect(x - 2, y0 - 2, 5, 4);
    g.fillStyle = hc;
    g.fillRect(x - 1, y0 - 2, 3, 3);
    g.fillStyle = '#fffaf2';
    g.fillRect(x - 1, y0 - 2, 1, 1);
  }
  // Mina's red thread: sagging bridges with big stitches, from one wall to the other.
  const bridges: Array<[number, number, number, number, number]> = [
    [0, 30, 150, 22, 9],
    [120, 18, W, 34, 12],
    [40, 56, 230, 50, 7],
  ];
  for (const [x0, y0, x1, y1, sag] of bridges) {
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) / (x1 - x0);
      const y = Math.round(y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag);
      g.fillStyle = '#4a1420';
      g.fillRect(x, y + 1, 1, 1);
      g.fillStyle = (x >> 2) % 3 === 0 ? '#e8505b' : '#a8324a';
      g.fillRect(x, y, 1, 1);
      // Big stitches: a short tick through the thread every few pixels.
      if (x % 9 === 0) {
        g.fillStyle = '#a8324a';
        g.fillRect(x, y - 2, 1, 2);
        g.fillRect(x + 1, y + 1, 1, 2);
      }
    }
  }
}

function drawVentre(g: CanvasRenderingContext2D, t: number): void {
  g.fillStyle = '#0e0907';
  g.fillRect(0, 0, W, 180);
  // The heartbeat, muffled: two swells, then a long rest.
  const beat = t % 84;
  const swell = beat < 8 ? Math.sin((beat / 8) * Math.PI) : beat > 14 && beat < 22 ? 0.6 * Math.sin(((beat - 14) / 8) * Math.PI) : 0;
  const k = 1 + swell * 0.012;
  const img = layer('ventre', paintVentre);
  g.drawImage(img, Math.round((W - W * k) / 2), Math.round((TOP - TOP * k) / 2), Math.round(W * k), Math.round(TOP * k));
  if (swell > 0) {
    g.globalAlpha = swell * 0.08;
    g.fillStyle = '#e8505b';
    g.fillRect(0, 0, W, TOP);
    g.globalAlpha = 1;
  }
  // Drops of damp falling from the cotton.
  for (let i = 0; i < 4; i++) {
    const period = 150 + i * 37;
    const ph = (t + i * 61) % period;
    const x = 30 + ((i * 83) % 260);
    if (ph < 50) {
      g.fillStyle = '#8e7a58';
      g.fillRect(x, 12 + Math.floor(ph * ph * 0.025), 1, 2);
    }
  }
  g.fillStyle = '#2a1d16';
  g.fillRect(0, 83, W, 1);
}

// ---------------------------------------------------------------------------------------------------------------------
// voix — the voice module, the battery that leaks
// ---------------------------------------------------------------------------------------------------------------------

const PLASTIC = ['#141112', '#1f1a1a', '#2c2524', '#3b322f', '#4c423c', '#5f5449', '#76695a'];
const GRILLE = { x: W / 2, y: 40, r: 34 };

function paintVoix(g: CanvasRenderingContext2D): void {
  // The plastic slab, lit from below (the arena), with mould seams and screws.
  field(g, 0, 0, W, TOP, (x, y) => {
    const v = 0.15 + (y / TOP) * 0.35 + noise(x, y, 18, 41) * 0.15 - Math.abs(x - W / 2) / W * 0.25;
    return ramp(PLASTIC, v, x, y);
  });
  g.fillStyle = '#0c0a0b';
  for (const x of [52, 268]) g.fillRect(x, 0, 1, TOP);
  g.fillRect(0, 9, W, 1);
  for (const [x, y] of [[44, 18], [276, 18], [44, 70], [276, 70]] as const) {
    g.fillStyle = '#0c0a0b';
    g.fillRect(x - 3, y - 3, 7, 7);
    g.fillStyle = '#5f5449';
    g.fillRect(x - 2, y - 2, 5, 5);
    g.fillStyle = '#0c0a0b';
    g.fillRect(x - 2, y, 5, 1);
  }
  // The speaker grille: a recessed disc full of holes, behind Dodo.
  field(g, GRILLE.x - GRILLE.r - 3, GRILLE.y - GRILLE.r - 3, GRILLE.r * 2 + 6, GRILLE.r * 2 + 6, (x, y) => {
    const d = Math.hypot(x + 0.5 - GRILLE.x, y + 0.5 - GRILLE.y);
    if (d > GRILLE.r + 2) return null;
    if (d > GRILLE.r) return '#5f5449';
    if (d > GRILLE.r - 2) return '#0c0a0b';
    const hole = (x - GRILLE.x + 200) % 5 < 2 && (y - GRILLE.y + 200) % 5 < 2;
    return hole ? '#070506' : ramp(['#1f1a1a', '#2c2524', '#3b322f'], 0.3 + (y - GRILLE.y) / 90, x, y);
  });
  // REC and PLAY: two big round buttons, engraved.
  const button = (cx: number, cy: number, face: string, label: 'REC' | 'PLAY'): void => {
    field(g, cx - 14, cy - 14, 29, 29, (x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 13) return null;
      if (d > 11.5) return '#0c0a0b';
      return ramp([face, '#4c423c', '#76695a'], 0.4 - (y - cy) / 30 + (x - cx) / 60, x, y);
    });
    g.fillStyle = '#0c0a0b';
    if (label === 'REC') {
      // A round dot (record).
      g.fillRect(cx - 3, cy - 2, 7, 5);
      g.fillRect(cx - 2, cy - 3, 5, 7);
      g.fillStyle = '#a8324a';
      g.fillRect(cx - 2, cy - 2, 5, 5);
    } else {
      // A triangle (play).
      for (let i = 0; i < 6; i++) g.fillRect(cx - 2 + i, cy - 5 + i, 1, 11 - i * 2);
    }
  };
  button(22, 44, '#3b322f', 'REC');
  button(W - 22, 44, '#3b322f', 'PLAY');
  // Wires: red and black, hanging in loops from the top.
  for (const [x0, x1, sag, c] of [[64, 120, 18, '#a8324a'], [70, 112, 24, '#1c1424'], [208, 258, 20, '#a8324a'], [214, 250, 14, '#1c1424']] as const) {
    for (let x = x0; x <= x1; x++) {
      const k = (x - x0) / (x1 - x0);
      g.fillStyle = c;
      g.fillRect(x, Math.round(2 + Math.sin(k * Math.PI) * sag), 1, 2);
    }
  }
}

/**
 * The battery's crust: grey-white crystals eating the plastic from the bottom corners and along the floor (amount
 * `rot`, 0..1). A darker rim where it advances, a few bright crystals inside.
 */
function paintCrust(g: CanvasRenderingContext2D, rot: number): void {
  field(g, 0, 0, W, TOP, (x, y) => {
    const fromL = Math.hypot(x / W, ((TOP - y) / TOP) * 0.9);
    const fromR = Math.hypot((W - x) / W, ((TOP - y) / TOP) * 0.9);
    const floor = ((TOP - y) / TOP) * 1.6 + 0.12;
    const d = Math.min(fromL, fromR, floor) - noise(x, y, 6, 77) * 0.1 - noise(x, y, 2, 78) * 0.04;
    const reach = rot * 0.42;
    if (d > reach) return null;
    const depth = (reach - d) / Math.max(0.04, reach);
    if (depth < 0.07) return '#3a3530';
    if (depth < 0.14) return hash(x, y, 79) < 0.6 ? '#5f594d' : '#3a3530';
    const sparkle = hash(x, y, 81) < 0.04 ? 0.35 : 0;
    return ramp(['#5f594d', '#7c7667', '#9a9584', '#b7b2a0', '#d4d0c0'], depth * 0.7 + hash(x, y, 80) * 0.18 + sparkle, x, y);
  });
}

function drawVoix(g: CanvasRenderingContext2D, t: number): void {
  g.fillStyle = '#0c0a0b';
  g.fillRect(0, 0, W, 180);
  g.drawImage(layer('voix', paintVoix), 0, 0);
  const step = Math.round(Math.max(0, Math.min(1, CH6_BG.rot)) * 16);
  if (step > 0) g.drawImage(layer(`crust${step}`, (c) => paintCrust(c, step / 16)), 0, 0);
  // The REC light: red, blinking, as if something was still being recorded.
  const on = Math.floor(t / 40) % 2 === 0;
  g.fillStyle = on ? '#ff4a5a' : '#4a1420';
  g.fillRect(20, 26, 4, 3);
  if (on) {
    g.globalAlpha = 0.25;
    g.fillRect(18, 24, 8, 7);
    g.globalAlpha = 1;
  }
  g.fillStyle = '#1a1516';
  g.fillRect(0, 83, W, 1);
}

export function drawCh6Background(g: CanvasRenderingContext2D, kind: 'ventre' | 'voix', t: number): void {
  if (kind === 'ventre') drawVentre(g, t);
  else drawVoix(g, t);
}

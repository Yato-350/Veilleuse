import { ctx2d, makeCanvas } from '../engine/sprite';

/*
 * Illustration of the bonus chapter « Les rêves des autres »: `maman_aube` — dawn in the break room of the care home.
 * Maman asleep in the armchair under a blanket someone put on her shoulders, the alarm clock face down on the table,
 * her phone lit (« Je rentre. »), the sky turning pale behind the city. Same family as the real-world memories:
 * flat shapes, dithered gradients, few light sources. Static layer cached; dust in the light and the phone animated.
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

/** A clock hand from (cx, cy) at angle `a` (0 = noon, clockwise). */
function hand(g: Ctx, cx: number, cy: number, a: number, len: number, c: string): void {
  for (let i = 0; i <= len; i++) rect(g, cx + Math.sin(a) * i, cy - Math.cos(a) * i, 1, 1, c);
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

const inEll = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** Filled ellipse with a simple top-left light (3 tones). */
function ball(g: Ctx, cx: number, cy: number, rx: number, ry: number, cols: [string, string, string]): void {
  field(g, Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(rx * 2 + 3), Math.ceil(ry * 2 + 3), (x, y) => {
    if (!inEll(x, y, cx, cy, rx, ry)) return null;
    const v = ((x - cx) / rx + (y - cy) / ry) * 0.5 + 0.5;
    return ramp(cols, v, x, y);
  });
}

/** Filled polygon (even-odd). */
function poly(g: Ctx, pts: number[], fn: (x: number, y: number) => string | null): void {
  const xs = pts.filter((_, i) => i % 2 === 0);
  const ys = pts.filter((_, i) => i % 2 === 1);
  const x0 = Math.floor(Math.min(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const n = pts.length / 2;
  field(g, x0, y0, Math.ceil(Math.max(...xs)) - x0 + 1, Math.ceil(Math.max(...ys)) - y0 + 1, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i * 2]!;
      const yi = pts[i * 2 + 1]!;
      const xj = pts[j * 2]!;
      const yj = pts[j * 2 + 1]!;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside ? fn(x, y) : null;
  });
}

// Window and the dawn light that comes through it.
const WIN = { x: 200, y: 16, w: 100, h: 92 };
/** Inside the beam of dawn light (a slanted band from the window down to the left). */
const inBeam = (x: number, y: number): boolean => {
  const k = (y - WIN.y) * 0.9;
  return y > WIN.y + 6 && x > WIN.x - 40 - k && x < WIN.x + WIN.w - 30 - k;
};

function paintAube(g: Ctx): void {
  // Wall: night purple, warmer where the dawn reaches.
  field(g, 0, 0, SW, 128, (x, y) => {
    const base = ramp(['#1e1a2c', '#262038', '#2e2742'], y / 128 + hash(x >> 3, y >> 3, 1) * 0.08, x, y);
    return inBeam(x, y) ? ramp(['#3a3050', '#4a3a5a', '#5a4560'], (y - WIN.y) / 120, x, y) : base;
  });
  // Skirting board and floor.
  rect(g, 0, 124, SW, 4, '#3a3148');
  field(g, 0, 128, SW, SH - 128, (x, y) => {
    const base = ramp(['#2a2236', '#221c2e', '#1a1624'], (y - 128) / 52, x, y);
    return inBeam(x, y) ? ramp(['#4a3a50', '#3e3248', '#33293e'], (y - 128) / 52, x, y) : base;
  });
  // The window: dawn sky, the city, the frame.
  field(g, WIN.x, WIN.y, WIN.w, WIN.h, (x, y) => ramp(['#2c3466', '#4a4e8a', '#8a6fb0', '#e08aa8', '#f8c09a', '#ffe0a8'], (y - WIN.y) / WIN.h, x, y));
  // The sun is not up yet: a glow on the horizon.
  field(g, WIN.x, WIN.y + 50, WIN.w, 42, (x, y) => (inEll(x, y, 262, 106, 34, 18) ? ramp(['#ffe0a8', '#fff3cf'], 1 - ((x - 262) ** 2 / 1156 + (y - 106) ** 2 / 324), x, y) : null));
  const roofs = [0, 74, 12, 66, 22, 80, 30, 58, 44, 70, 56, 62, 68, 76, 78, 54, 90, 72, 100, 72];
  for (let i = 0; i + 3 < roofs.length; i += 2) {
    const x = WIN.x + roofs[i]!;
    const top = WIN.y + roofs[i + 1]!;
    const w = roofs[i + 2]! - roofs[i]!;
    rect(g, x, top, w, WIN.y + WIN.h - top, '#3a2e4c');
    for (let wy = top + 4; wy < WIN.y + WIN.h - 4; wy += 5)
      for (let wx = x + 2; wx < x + w - 2; wx += 4) if (hash(wx, wy, 7) < 0.16) rect(g, wx, wy, 2, 2, '#ffe991');
  }
  // Frame and cross bars.
  g.fillStyle = '#d8d0c8';
  g.fillRect(WIN.x - 4, WIN.y - 4, WIN.w + 8, 4);
  g.fillRect(WIN.x - 4, WIN.y + WIN.h, WIN.w + 8, 5);
  g.fillRect(WIN.x - 4, WIN.y, 4, WIN.h);
  g.fillRect(WIN.x + WIN.w, WIN.y, 4, WIN.h);
  g.fillRect(WIN.x + WIN.w / 2 - 1, WIN.y, 3, WIN.h);
  g.fillRect(WIN.x, WIN.y + 40, WIN.w, 2);
  rect(g, WIN.x - 4, WIN.y + WIN.h + 4, WIN.w + 8, 1, '#8a8090');
  // Lockers on the left, a photo inside the half-open one.
  for (let i = 0; i < 3; i++) {
    const x = 8 + i * 22;
    field(g, x, 30, 21, 96, (px, py) => ramp(['#5c6080', '#4a4e70', '#3e4160'], (px - x) / 21 + (py - 30) / 400, px, py));
    rect(g, x, 30, 21, 2, '#6d7398');
    rect(g, x + 20, 30, 1, 96, '#2a2c44');
    for (let v = 0; v < 3; v++) rect(g, x + 5, 38 + v * 4, 11, 1, '#2e3150');
    rect(g, x + 16, 74, 2, 8, '#8a8fb0');
  }
  rect(g, 33, 92, 9, 7, '#e8e2dc');
  rect(g, 34, 93, 7, 5, '#7a9ac8');
  rect(g, 35, 95, 2, 3, '#e0834f');
  rect(g, 38, 95, 2, 3, '#3f3d63');
  // A clock on the wall: 5:50.
  ball(g, 160, 30, 10, 10, ['#e8e2dc', '#c8c0bc', '#9a92a0']);
  hand(g, 160, 30, (50 / 60) * Math.PI * 2, 8, '#2a2236');
  hand(g, 160, 30, (5.83 / 12) * Math.PI * 2, 5, '#2a2236');
  rect(g, 159, 29, 2, 2, '#a8324a');

  // The armchair (hospital green vinyl), Maman asleep in it under a blue blanket.
  const AX = 74;
  const AY = 64;
  field(g, AX + 6, AY, 78, 54, (x, y) => {
    const cx = AX + 45;
    if (y < AY + 6 && Math.abs(x - cx) > 30 + (y - AY) * 1.2) return null;
    return ramp(['#9ad0c4', '#7ab4a8', '#5a9488', '#46786e'], (x - AX) / 110 + (y - AY) / 140, x, y);
  });
  for (const ax of [AX - 2, AX + 82]) field(g, ax, AY + 40, 14, 36, (x, y) => ramp(['#8ac4b8', '#6aa498', '#4e8478'], (x - ax) / 16 + (y - AY - 40) / 60, x, y));
  field(g, AX + 6, AY + 52, 80, 22, (x, y) => ramp(['#7ab4a8', '#5a9488', '#46786e'], (y - AY - 52) / 22 + (x - AX) / 300, x, y));
  rect(g, AX, AY + 76, 94, 4, '#3a3148');
  rect(g, AX + 6, AY + 80, 3, 8, '#2a2236');
  rect(g, AX + 84, AY + 80, 3, 8, '#2a2236');
  // Her head, tilted against the backrest: brown hair with a loose bun, a sleeping face.
  ball(g, AX + 40, AY + 22, 13, 14, ['#8a5a40', '#6e4a3a', '#4a3028']);
  ball(g, AX + 30, AY + 10, 6, 6, ['#8a5a40', '#6e4a3a', '#4a3028']);
  field(g, AX + 33, AY + 20, 20, 18, (x, y) => (inEll(x, y, AX + 44, AY + 28, 9, 10) ? ramp(['#fbd7c0', '#eeb39b', '#c98572'], (x - AX - 36) / 26 + (y - AY - 20) / 40, x, y) : null));
  rect(g, AX + 38, AY + 18, 15, 5, '#6e4a3a');
  // Closed eyes, a tired smile.
  rect(g, AX + 39, AY + 27, 4, 1, '#4a3028');
  rect(g, AX + 46, AY + 27, 4, 1, '#4a3028');
  rect(g, AX + 39, AY + 29, 4, 1, '#d89a88');
  rect(g, AX + 46, AY + 29, 4, 1, '#d89a88');
  rect(g, AX + 43, AY + 33, 3, 1, '#a8604a');
  // The blanket, from the shoulders down over the armrests, with folds.
  poly(g, [AX + 14, AY + 36, AX + 70, AY + 34, AX + 92, AY + 58, AX + 96, AY + 82, AX - 2, AY + 84, AX + 2, AY + 58], (x, y) => {
    const fold = Math.sin((x - AX) * 0.22 + (y - AY) * 0.05) > 0.75;
    const v = (x - AX) / 140 + (y - AY - 34) / 90 + (fold ? 0.25 : 0);
    return ramp(['#a7c7f0', '#8aa8e0', '#6d8fd6', '#5470b0'], v, x, y);
  });
  rect(g, AX + 14, AY + 36, 56, 1, '#c8dcf8');
  // Her hand on the blanket.
  ball(g, AX + 58, AY + 52, 5, 3, ['#fbd7c0', '#eeb39b', '#c98572']);

  // The table in front, on the right: cold coffee, the phone, the alarm clock face down.
  const TY = 136;
  field(g, 168, TY, 146, 8, (x, y) => ramp(['#8a7a6a', '#6e6058', '#5a4e48'], (y - TY) / 8 + (x - 168) / 600, x, y));
  rect(g, 168, TY, 146, 1, '#a8988a');
  rect(g, 168, TY + 8, 146, 3, '#3a3030');
  rect(g, 176, TY + 11, 4, 30, '#2e2626');
  rect(g, 302, TY + 11, 4, 30, '#2e2626');
  // Cup.
  field(g, 184, TY - 14, 13, 15, (x, y) => ramp(['#fffaf2', '#ece2df', '#b7aab8'], (x - 184) / 13, x, y));
  field(g, 196, TY - 11, 5, 8, (x, y) => (inEll(x, y, 197, TY - 7, 4, 4) && !inEll(x, y, 197, TY - 7, 2, 2) ? '#ece2df' : null));
  rect(g, 185, TY - 14, 11, 2, '#4a3028');
  // The alarm clock, lying face down: its flat red back, the bells on their sides, two little feet in the air, the key.
  ball(g, 251, TY - 5, 5, 4, ['#ffe991', '#f5c04f', '#c46a2e']);
  ball(g, 285, TY - 5, 5, 4, ['#ffe991', '#f5c04f', '#c46a2e']);
  ball(g, 268, TY - 5, 16, 5, ['#e8505b', '#a8324a', '#63489a']);
  rect(g, 255, TY - 1, 26, 1, '#5a2a3a');
  rect(g, 260, TY - 14, 2, 6, '#c46a2e');
  rect(g, 275, TY - 14, 2, 6, '#c46a2e');
  rect(g, 259, TY - 15, 4, 2, '#f5c04f');
  rect(g, 274, TY - 15, 4, 2, '#f5c04f');
  rect(g, 267, TY - 13, 3, 4, '#c46a2e');
  rect(g, 264, TY - 15, 9, 2, '#f5c04f');
  // Phone (screen painted by the animation).
  rect(g, 216, TY - 4, 26, 4, '#15151d');
}

/** Dust motes drifting in the beam of dawn light. */
function motes(g: Ctx, t: number): void {
  for (let i = 0; i < 26; i++) {
    const sx = hash(i, 1, 5) * SW;
    const sy = hash(i, 2, 5) * 140;
    const x = Math.round((sx + t * (0.05 + hash(i, 3, 5) * 0.08)) % SW);
    const y = Math.round((sy + Math.sin(t * 0.02 + i) * 4 + t * 0.03) % 140);
    if (!inBeam(x, y)) continue;
    g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 0.05 + i * 1.7);
    rect(g, x, y, 1, 1, '#fff3cf');
  }
  g.globalAlpha = 1;
}

let cache: HTMLCanvasElement | null = null;

export const BONUS_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  maman_aube: (g, t) => {
    if (!cache) {
      cache = makeCanvas(SW, SH);
      paintAube(ctx2d(cache));
    }
    g.drawImage(cache, 0, 0);
    // The phone screen: « Je rentre. » — then « Lu ».
    const lit = 0.75 + 0.25 * Math.sin(t * 0.05);
    const prev = g.globalAlpha;
    g.globalAlpha = prev * lit;
    rect(g, 217, 133, 24, 2, '#a7c7f0');
    rect(g, 230, 133, 9, 1, '#3f6fcf');
    g.globalAlpha = prev * lit * 0.3;
    rect(g, 215, 131, 28, 1, '#a7c7f0');
    g.globalAlpha = prev;
    motes(g, t);
  },
};

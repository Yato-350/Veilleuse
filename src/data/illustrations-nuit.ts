import { drawText, measure } from '../engine/font';
import { ctx2d, makeCanvas } from '../engine/sprite';
import { lang, tr } from '../i18n';

/*
 * Illustrations of the night interludes (docs/HISTOIRE.md § 3.10, § 3.12):
 *   polaroid_dodo  T2, Interlude III — a polaroid found at the bottom of the hospital bag, on its navy lining: Dodo on
 *                  a hospital pillow, a boy's hand resting on him (lavender sleeve), the flash too bright in the middle.
 *                  Under it, Maman's blue ballpoint: « Noa prête Dodo à Mina. "Il veillera sur toi." »
 *   dessin_chut    T5, Interlude IV — a crayon drawing taped in the corner of Maman's mirror: a little girl in a
 *                  knitted hat with sheep ears, one finger on her lips, and « MAMAN TU DIS PAS A NOA. PROMIS. »
 *                  Around the paper, the dark glass; far in it, a dark shape that could be Noa's reflection.
 * (`photo_decoupee` is drawn next to `photo_famille`, in illustrations.ts: it is the same photo.)
 * Key art stays above y 120: the captions cover the bottom. Static layers are cached per language (handwriting).
 */

type Ctx = CanvasRenderingContext2D;

const SW = 320;
const SH = 180;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

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

function px(g: Ctx, x: number, y: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
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

/** Filled ellipse, coloured by `fn` (or one colour). */
function oval(g: Ctx, cx: number, cy: number, rx: number, ry: number, c: string | ((x: number, y: number, d: number) => string | null)): void {
  field(g, Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, (x, y) => {
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
    if (d > 1) return null;
    return typeof c === 'string' ? c : c(x, y, d);
  });
}

/** A crayon stroke: a wobbly line, `w` pixels thick, a little grainy. */
function stroke(g: Ctx, pts: readonly number[], c: string, w = 2, seed = 1): void {
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const [x0, y0, x1, y1] = [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n + (hash(k, i, seed) - 0.5) * 0.8;
      const y = y0 + ((y1 - y0) * k) / n + (hash(i, k, seed) - 0.5) * 0.8;
      for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) if (hash(Math.round(x) + a, Math.round(y) + b, seed + 3) > 0.15) px(g, x + a, y + b, c);
    }
  }
}

/** Uneven handwriting (bitmap font, each letter a little up or down). */
function scrawl(g: Ctx, text: string, x: number, y: number, c: string, o: { seed?: number; jit?: number; bold?: boolean; scale?: number } = {}): number {
  const s = o.scale ?? 1;
  let cx = x;
  let i = 0;
  for (const ch of text) {
    const dy = Math.round((hash(i, 3, o.seed ?? 5) - 0.5) * 2 * (o.jit ?? 1));
    if (ch !== ' ') {
      drawText(g, ch, cx, y + dy, { color: c, scale: s });
      if (o.bold) drawText(g, ch, cx + 1, y + dy, { color: c, scale: s });
    }
    cx += (measure(ch) + 1) * s + (o.bold ? 1 : 0);
    i++;
  }
  return cx - x;
}

/** Width of a scrawled text (same spacing as `scrawl`). */
function scrawlWidth(text: string, o: { bold?: boolean; scale?: number } = {}): number {
  let w = 0;
  for (const ch of text) w += (measure(ch) + 1) * (o.scale ?? 1) + (o.bold ? 1 : 0);
  return w;
}

const layers = new Map<string, HTMLCanvasElement>();
function layer(name: string, paint: (g: Ctx) => void): HTMLCanvasElement {
  const key = `${name}:${lang()}`;
  let c = layers.get(key);
  if (!c) {
    c = makeCanvas(SW, SH);
    paint(ctx2d(c));
    layers.set(key, c);
  }
  return c;
}

function motes(g: Ctx, t: number, n: number, seed: number, area: [number, number, number, number], c: string): void {
  const [x0, y0, x1, y1] = area;
  for (let i = 0; i < n; i++) {
    const sp = 0.05 + hash(i, 1, seed) * 0.08;
    const x = x0 + ((hash(i, 2, seed) * (x1 - x0) + Math.sin(t * 0.01 + i) * 6) % (x1 - x0));
    const y = y1 - ((hash(i, 3, seed) * (y1 - y0) + t * sp) % (y1 - y0));
    g.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.02 + i * 1.7));
    px(g, x, y, c);
  }
  g.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// polaroid_dodo
// ---------------------------------------------------------------------------------------------------------------------

const PX = 96;
const PY = 6;
const PW = 128;
const PH = 117;
/** The picture inside the white frame. */
const IX = PX + 8;
const IY = PY + 7;
const IW = PW - 16;
const IH = 82;

/** One woolly lobe of the plush, lit from the top-left (flash). */
function wool(g: Ctx, cx: number, cy: number, r: number): void {
  oval(g, cx, cy, r, r * 0.9, (x, y) => {
    const l = (-(x + 0.5 - cx) * 0.6 - (y + 0.5 - cy) * 0.8) / r;
    return l > 0.35 ? '#fffdf8' : l > -0.35 ? ramp(['#f6f1e8', '#ebe4d8'], 0.5 - l, x, y) : '#d9d0c2';
  });
}

function paintPolaroid(g: Ctx): void {
  // The navy lining of the sports bag, a diagonal weave, darker towards the edges.
  field(g, 0, 0, SW, SH, (x, y) => {
    const d = Math.hypot((x - 160) / 190, (y - 70) / 120);
    const weave = (x + y) % 4 === 0 ? 0.08 : (x - y + 400) % 6 === 0 ? -0.05 : 0;
    return ramp(['#090b18', '#0f1326', '#151b36', '#1c2446'], 1 - d + weave, x, y);
  });
  // a seam of the lining and the zipper tape along the top
  for (let x = 0; x < SW; x += 3) px(g, x, 4, '#252e57');
  rect(g, 0, 0, SW, 3, '#0a0c16');
  for (let x = 1; x < SW; x += 4) rect(g, x, 1, 2, 2, '#4a4e78');
  // Shadow of the polaroid
  rect(g, PX + 4, PY + 5, PW, PH, '#05060d');
  // The white frame, yellowed, with a little grain
  field(g, PX, PY, PW, PH, (x, y) => (hash(x, y, 9) < 0.08 ? '#e2dac6' : y < PY + 1 ? '#faf6ec' : '#efe8d8'));
  rect(g, PX + PW - 1, PY + 1, 1, PH - 1, '#d4cab3');
  rect(g, PX + 1, PY + PH - 1, PW - 1, 1, '#d4cab3');
  // --- The picture ------------------------------------------------------------------------------------------------
  // Behind: the pale green wall of the room, the flash fading to the edges
  const flash = (x: number, y: number): number => 1 - Math.hypot((x - (IX + IW * 0.45)) / (IW * 0.75), (y - (IY + IH * 0.55)) / (IH * 0.9));
  field(g, IX, IY, IW, 22, (x, y) => ramp(['#4e6560', '#6f8a82', '#93ada3', '#b4cbbf'], flash(x, y), x, y));
  // A bed rail in the top right corner
  rect(g, IX + IW - 30, IY + 6, 30, 3, '#c9d4d4');
  rect(g, IX + IW - 30, IY + 9, 30, 1, '#7d8f90');
  // The pillow: very white in the middle, a seam with stitches along its top edge
  field(g, IX, IY + 18, IW, IH - 18, (x, y) => {
    const v = flash(x, y);
    const fold = Math.sin((x - IX) * 0.11 + (y - IY) * 0.05) > 0.92 ? -0.12 : 0;
    return ramp(['#8ea3a6', '#b9c9c9', '#dce6e2', '#f2f6f1', '#fbfcf8'], v + fold, x, y);
  });
  for (let x = IX + 2; x < IX + IW - 2; x += 3) px(g, x, IY + 20, '#9fb0b0');
  rect(g, IX, IY + 18, IW, 1, '#7c9092');
  // Dodo: the woolly body, the grey face, pink ears, button eyes
  const bx = IX + 58;
  const by = IY + 50;
  oval(g, bx + 2, by + 15, 34, 6, '#a7b6b4');
  // little grey legs, then the wool: many small lobes, back to front
  for (const lx of [-18, -6, 12, 22]) rect(g, bx + lx, by + 9, 4, 6, '#9a8c9e');
  oval(g, bx + 2, by + 3, 30, 12, '#e4ddd0');
  const lobes: Array<[number, number, number]> = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const lx = -24 + col * 7 + (row % 2) * 3 + (hash(col, row, 5) - 0.5) * 3;
      const ly = -8 + row * 6 + (hash(row, col, 6) - 0.5) * 2;
      if ((lx / 30) ** 2 + (ly / 13) ** 2 > 1.05) continue;
      lobes.push([bx + lx, by + ly, 5 + hash(col, row, 7) * 2.5]);
    }
  }
  for (const [lx, ly, r] of lobes) wool(g, lx, ly, r);
  // the tag on his side: « DODO — à Noa », too small to read
  rect(g, bx + 24, by + 13, 6, 4, '#fffdf6');
  rect(g, bx + 25, by + 14, 4, 1, '#5a6a9a');
  rect(g, bx + 25, by + 16, 3, 1, '#5a6a9a');
  // head
  const hx = bx - 26;
  const hy = by - 2;
  oval(g, hx - 6, hy - 9, 5, 3, '#c98fa8');
  oval(g, hx - 6, hy - 9, 3, 2, '#f3b4c9');
  oval(g, hx + 8, hy - 10, 5, 3, '#c98fa8');
  oval(g, hx + 8, hy - 10, 3, 2, '#f3b4c9');
  wool(g, hx + 1, hy - 9, 7);
  oval(g, hx, hy, 10, 9, (x, y) => ramp(['#cfc4cf', '#b7aab8', '#9a8c9e'], ((x - hx) * 0.4 + (y - hy) * 0.8) / 10 + 0.4, x, y));
  for (const ex of [hx - 4, hx + 4]) {
    oval(g, ex, hy - 1, 2, 2, '#16121c');
    px(g, ex - 1, hy - 2, '#ffffff');
  }
  rect(g, hx - 1, hy + 3, 3, 2, '#e07ba5');
  px(g, hx - 2, hy + 6, '#5a4a5e');
  px(g, hx + 2, hy + 6, '#5a4a5e');
  rect(g, hx - 1, hy + 7, 3, 1, '#5a4a5e');
  // The boy's hand, from the right edge: lavender sleeve, fingers spread on Dodo's back
  field(g, bx + 26, by - 12, IX + IW - (bx + 26), 13, (x, y) => {
    const top = by - 12 + (x - (bx + 26)) * 0.12;
    if (y < top || y > top + 11) return null;
    return y < top + 2 ? '#dccbf2' : y > top + 8 ? '#9f86c0' : '#c4abe2';
  });
  rect(g, bx + 25, by - 12, 2, 12, '#b49bd6');
  const skin = (x: number, y: number, d: number): string => (d > 0.6 ? '#d9a98c' : (x + y) % 7 === 0 ? '#f6d4bc' : '#f2c9ad');
  oval(g, bx + 18, by - 7, 9, 6, skin);
  for (const [fx, fy] of [
    [bx + 5, by - 11],
    [bx + 3, by - 7],
    [bx + 4, by - 3],
    [bx + 7, by + 1],
  ] as const) {
    oval(g, fx + 5, fy, 6, 1.8, skin);
    px(g, fx, fy, '#e3b498');
  }
  oval(g, bx + 16, by - 1, 5, 2, skin);
  // Old photo: a warm cast, the corners darker
  field(g, IX, IY, IW, IH, (x, y) => {
    const d = Math.max(Math.abs(x - IX - IW / 2) / (IW / 2), Math.abs(y - IY - IH / 2) / (IH / 2));
    return d > 0.86 && bayer(x, y) < (d - 0.86) * 4 ? '#5c5040' : null;
  });
  g.globalAlpha = 0.1;
  rect(g, IX, IY, IW, IH, '#ffcf8a');
  g.globalAlpha = 1;
  rect(g, IX, IY, IW, 1, '#c9bfa8');
  rect(g, IX, IY, 1, IH, '#c9bfa8');
  // --- Maman's handwriting, blue ballpoint ---------------------------------------------------------------------
  const ink = '#2b3a8c';
  const l1 = tr('Noa prête Dodo à Mina.');
  const l2 = tr('"Il veillera sur toi."');
  scrawl(g, l1, Math.round(160 - scrawlWidth(l1) / 2), IY + IH + 4, ink, { seed: 4 });
  scrawl(g, l2, Math.round(160 - scrawlWidth(l2) / 2), IY + IH + 14, ink, { seed: 8 });
}

// ---------------------------------------------------------------------------------------------------------------------
// dessin_chut
// ---------------------------------------------------------------------------------------------------------------------

const DX = 34;
const DY = 14;
const DW = 168;
const DH = 104;
const CR = { red: '#e2404c', blue: '#3e78d6', sky: '#7cb6f2', pink: '#f37bb0', purple: '#8a5bc9', green: '#4fae4f', brown: '#9a5a34', skin: '#f8c6a0', yellow: '#f9cf3a', black: '#3b3346' };

function paintChut(g: Ctx): void {
  // The mirror: dark glass, a slanted band of light, the room behind Noa almost black.
  field(g, 0, 0, SW, SH, (x, y) => {
    const band = Math.abs(x - 0.55 * y - 210) < 26 ? 0.18 : Math.abs(x - 0.55 * y - 252) < 8 ? 0.1 : 0;
    return ramp(['#0b0d15', '#11151f', '#181e2b', '#212938', '#2c3546'], 0.35 - y / 600 + band + (hash(x, y, 3) - 0.5) * 0.05, x, y);
  });
  // a dark shape in the glass, far away: a head and shoulders (Noa's reflection, or the room)
  oval(g, 262, 74, 22, 25, (x, y) => (bayer(x, y) < 0.7 ? '#0c0f17' : null));
  field(g, 226, 96, 74, 84, (x, y) => (Math.abs(x - 262) < 22 + (y - 96) * 0.8 && bayer(x, y) < 0.7 ? '#0c0f17' : null));
  // the wooden frame of the mirror, top and left
  rect(g, 0, 0, SW, 7, '#4a3328');
  rect(g, 0, 0, 8, SH, '#4a3328');
  rect(g, 0, 6, SW, 1, '#2a1e18');
  rect(g, 7, 6, 1, SH, '#2a1e18');
  rect(g, 0, 0, SW, 1, '#6e4a3a');
  rect(g, 0, 0, 1, SH, '#6e4a3a');
  // The paper, a little crooked shadow, grain, a dog-ear
  rect(g, DX + 3, DY + 4, DW, DH, '#06070c');
  field(g, DX, DY, DW, DH, (x, y) => {
    if (x - DX + (DY + DH - y) < 0) return null;
    if (DX + DW - x + (DY + DH - y) < 12) return null;
    return hash(x, y, 2) < 0.07 ? '#f2e7cd' : '#fbf4e2';
  });
  field(g, DX + DW - 12, DY + DH - 12, 12, 12, (x, y) => (DX + DW - x + (DY + DH - y) < 12 && DX + DW - x + (DY + DH - y) >= 0 && x - (DX + DW - 12) <= DY + DH - 1 - y ? '#e4d4b4' : null));
  // tape on the two top corners
  for (const tx of [DX - 6, DX + DW - 14]) {
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = 0.7;
      rect(g, tx + i, DY - 3 + i, 18, 1, '#e8e0b8');
      g.globalAlpha = 1;
    }
  }
  // --- The child's drawing --------------------------------------------------------------------------------------
  // Words, in purple crayon, big letters that climb a little
  const w1 = tr('MAMAN');
  const w1b = tr('TU DIS PAS');
  const w2 = tr('A NOA.');
  const w3 = tr('PROMIS.');
  const ww1 = scrawl(g, w1, DX + 10, DY + 8, CR.purple, { seed: 11, jit: 1.4, bold: true });
  scrawl(g, w1b, DX + 10 + ww1 + 6, DY + 8, CR.purple, { seed: 14, jit: 1.4, bold: true });
  const x2 = DX + 10;
  const ww2 = scrawl(g, w2, x2, DY + 20, CR.purple, { seed: 12, jit: 1.4, bold: true });
  const x3 = x2 + ww2 + 8;
  const ww3 = scrawl(g, w3, x3, DY + 20, CR.red, { seed: 13, jit: 1.2, bold: true });
  stroke(g, [x3, DY + 30, x3 + ww3 - 2, DY + 29], CR.red, 1, 4);
  stroke(g, [x3 + 2, DY + 32, x3 + ww3, DY + 32], CR.red, 1, 5);
  // a moon in the corner, yellow crayon
  oval(g, DX + DW - 22, DY + 18, 9, 9, (x, y) => (hash(x, y, 7) < 0.75 ? CR.yellow : null));
  oval(g, DX + DW - 18, DY + 15, 8, 8, (x, y) => (hash(x, y, 8) < 0.9 ? '#fbf4e2' : null));
  // ground
  stroke(g, [DX + 8, DY + 96, DX + 60, DY + 95, DX + 120, DY + 97, DX + DW - 16, DY + 95], CR.green, 2, 6);
  // The little girl: a dress, a round face, the knitted hat with two sheep ears, a finger on her lips
  const gx = DX + 84;
  const gy = DY + 58;
  // dress (red, scribbled), arms, legs
  field(g, gx - 16, gy + 12, 33, 24, (x, y) => {
    const half = 5 + (y - gy - 12) * 0.5;
    if (Math.abs(x - gx) > half) return null;
    return hash(x, y, 21) < 0.72 ? CR.red : null;
  });
  stroke(g, [gx - 16, gy + 36, gx - 4, gy + 12, gx + 4, gy + 12, gx + 16, gy + 36, gx - 16, gy + 36], '#b02838', 1, 22);
  stroke(g, [gx - 5, gy + 36, gx - 6, gy + 46], CR.black, 1, 23);
  stroke(g, [gx + 5, gy + 36, gx + 6, gy + 46], CR.black, 1, 24);
  rect(g, gx - 9, gy + 45, 5, 2, CR.blue);
  rect(g, gx + 4, gy + 45, 5, 2, CR.blue);
  // left arm down; right arm up to the face
  stroke(g, [gx - 6, gy + 16, gx - 18, gy + 28], CR.skin, 2, 25);
  stroke(g, [gx + 6, gy + 16, gx + 10, gy + 12], CR.skin, 2, 26);
  // face
  oval(g, gx, gy - 2, 12, 11, (x, y) => (hash(x, y, 28) < 0.85 ? CR.skin : null));
  stroke(g, [gx - 12, gy - 2, gx - 9, gy + 6, gx, gy + 9, gx + 9, gy + 6, gx + 12, gy - 2], CR.brown, 1, 29);
  rect(g, gx - 5, gy - 2, 2, 2, CR.black);
  rect(g, gx + 4, gy - 2, 2, 2, CR.black);
  rect(g, gx - 4, gy + 3, 3, 1, '#c05050');
  rect(g, gx + 2, gy + 3, 3, 1, '#c05050');
  // the hand in front of the chin, one finger standing up across the lips: « chut »
  oval(g, gx + 1, gy + 12, 3.5, 2.5, CR.skin);
  stroke(g, [gx - 3, gy + 11, gx - 2, gy + 14, gx + 3, gy + 14, gx + 5, gy + 11], CR.brown, 1, 36);
  rect(g, gx, gy + 1, 2, 10, CR.skin);
  rect(g, gx - 1, gy + 1, 1, 9, CR.brown);
  rect(g, gx + 2, gy + 1, 1, 9, CR.brown);
  rect(g, gx, gy, 2, 1, CR.brown);
  // pink cheeks
  px(g, gx - 8, gy + 2, CR.pink);
  px(g, gx + 8, gy + 2, CR.pink);
  // the hat: blue wool over the top of the head, two white sheep ears, a pompom
  field(g, gx - 14, gy - 15, 29, 11, (x, y) => {
    const d = ((x + 0.5 - gx) / 14) ** 2 + ((y + 0.5 - (gy - 4)) / 11) ** 2;
    if (d > 1 || y > gy - 5) return null;
    return (x + y) % 3 === 0 ? '#2f63c0' : CR.sky;
  });
  stroke(g, [gx - 14, gy - 5, gx + 14, gy - 5], CR.blue, 1, 30);
  for (const s of [-1, 1]) {
    oval(g, gx + s * 15, gy - 12, 5, 4, (x, y) => (hash(x, y, 31) < 0.9 ? '#ffffff' : null));
    stroke(g, [gx + s * 15 - 5, gy - 12, gx + s * 15, gy - 16, gx + s * 15 + 5, gy - 12, gx + s * 15, gy - 8, gx + s * 15 - 5, gy - 12], '#9b93a6', 1, 32 + s);
    oval(g, gx + s * 15, gy - 12, 2, 1.5, CR.pink);
  }
  oval(g, gx, gy - 17, 3, 3, CR.yellow);
  // « chut » lines around the finger
  stroke(g, [gx + 14, gy - 2, gx + 18, gy - 4], CR.black, 1, 34);
  stroke(g, [gx + 14, gy + 2, gx + 19, gy + 2], CR.black, 1, 35);
  // a heart, in pink, on the right
  for (const [hx, hy] of [
    [DX + 140, DY + 64],
    [DX + 146, DY + 64],
  ] as const)
    oval(g, hx, hy, 4, 4, (x, y) => (hash(x, y, 40) < 0.8 ? CR.pink : null));
  field(g, DX + 135, DY + 65, 16, 9, (x, y) => (Math.abs(x - (DX + 143)) < 8 - (y - DY - 65) && hash(x, y, 41) < 0.8 ? CR.pink : null));
}

export const NUIT_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  polaroid_dodo: (g, t) => {
    g.drawImage(layer('polaroid_dodo', paintPolaroid), 0, 0);
    motes(g, t, 10, 4, [20, 10, 300, 118], '#8a8fb0');
  },
  dessin_chut: (g, t) => {
    g.drawImage(layer('dessin_chut', paintChut), 0, 0);
    // the light band in the glass breathes; once in a while the dark shape in the mirror is a little closer
    g.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.03);
    rect(g, 214, 0, 30, SH, '#a7c7f0');
    g.globalAlpha = 1;
    if (t % 420 > 400) {
      g.globalAlpha = 0.5;
      oval(g, 262, 75, 23, 26, (x, y) => (bayer(x, y) < 0.35 ? '#07090f' : null));
      g.globalAlpha = 1;
    }
  },
};

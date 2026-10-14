import { ctx2d, makeCanvas } from '../engine/sprite';

/*
 * Illustration of chapter 6 « Le Ventre de Dodo »: `bonnet_visage` (docs/HISTOIRE.md § 2.10, T9). The little girl in
 * the knitted hat, from the chest up, in the dark at the bottom of the plush. Her hat with two sheep ears and her
 * cardigan are wool, as they always were; her face is a blank of paper, and a pencil draws it while you look: the
 * outline, the brows, two tired eyes under heavy lids, a small nose, a smile, a little colour on the cheeks. No
 * pigtails. This is the only time her real face is shown (§ 1.5, rule 2): tired, and smiling.
 *
 * The strokes come one after another (about two seconds and a half), then the drawing stays. At t = 0 (the gallery's
 * thumbnail) the face is still blank. Key art above y 120 (captions cover the bottom). Static layers are cached.
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

// ---------------------------------------------------------------------------------------------------------------------
// Colours and geometry
// ---------------------------------------------------------------------------------------------------------------------

const OUT = '#1c1424';
const DARK = ['#0d080a', '#150e10', '#21161a', '#2e1f1f', '#3d2a25', '#4b3329'];
const COTTON = ['#2a2220', '#3a2f2a', '#4d4036'];
const WOOL = ['#f3ead2', '#e4d7b6', '#cbbb96', '#a8977a', '#7a6b56'];
const KNIT = ['#ece2df', '#cfc4cb', '#b7aab8', '#94879a', '#6c6076'];
const PAPER = ['#f6eedd', '#efe5d0', '#e4d8bf', '#d3c5a8'];
/** Graphite, from a hard press to a whisper. */
const LEAD = ['#3a3540', '#55505c', '#787180', '#9d95a2', '#bdb4b8'];
const BLUSH = '#e48c96';

/** Centre and radii of the face (the paper): a child's face, round, the cheeks widest. */
const F = { x: 160, y: 78, rx: 29, ry: 28 };
/** Bottom of the hat's band (the face starts under it). */
const BAND = 64;

/** Inside the face: round, the widest at the cheeks, a soft round chin. */
function inFace(x: number, y: number): boolean {
  const ny = (y + 0.5 - F.y) / F.ry;
  if (Math.abs(ny) > 1) return false;
  const k = ny > 0.25 ? 1 - 0.32 * ((ny - 0.25) / 0.75) ** 2 : 1;
  const nx = (x + 0.5 - F.x) / (F.rx * k);
  return nx * nx + ny * ny <= 1;
}

/** The lower edge of the hat at this column: it wraps the head, lower over the temples. */
const bandBottom = (x: number): number => BAND + 10 * ((x + 0.5 - 160) / 37) ** 2;

/** The hat: a round knitted dome pulled down to the brows, and its ribbed band (wrapping the head). */
function inHat(x: number, y: number): 0 | 1 | 2 {
  const dx = (x + 0.5 - 160) / 37.5;
  if (Math.abs(dx) > 1) return 0;
  const bot = bandBottom(x);
  if (y > bot) return 0;
  if (y >= bot - 8) return 2;
  const top = 57 - 37 * Math.sqrt(1 - dx * dx) ** 0.8;
  return y + 0.5 >= top ? 1 : 0;
}

/** A floppy sheep ear on each side of the hat, pointing out and a little down. */
function inEar(x: number, y: number): number {
  for (const side of [-1, 1] as const) {
    const ox = x + 0.5 - (160 + side * 41);
    const oy = y + 0.5 - 61;
    const a = side * 0.8;
    const u = ox * Math.cos(a) + oy * Math.sin(a);
    const v = -ox * Math.sin(a) + oy * Math.cos(a);
    // A leaf: rounder at the tip, pinched where it joins the hat.
    const pinch = side * u < 0 ? 1.35 : 1;
    const d = (u / 13) ** 2 + ((v * pinch) / 6.5) ** 2;
    if (d <= 1) return d;
  }
  return -1;
}

/** The top of the cardigan at this column (a child's narrow, sloping shoulders), or Infinity outside. */
function shoulderTop(x: number): number {
  const dx = Math.abs(x + 0.5 - 160);
  if (dx > 58) return Infinity;
  if (dx <= 12) return 108;
  // Sloping shoulders, then the sleeves falling down, rounded at the top.
  const slope = 108 + ((dx - 12) / 30) ** 1.6 * 12;
  return dx < 46 ? slope : Math.max(slope, 108 + 12 * 1.9 + ((dx - 46) / 12) ** 2 * 10);
}
const inCardigan = (x: number, y: number): boolean => y >= shoulderTop(x);
const inNeck = (x: number, y: number): boolean => y >= 98 && y < 112 && Math.abs(x + 0.5 - 160) <= 8.5;

// ---------------------------------------------------------------------------------------------------------------------
// The still picture: the dark, the halo, cotton at the edges, the wool, the blank paper of the face
// ---------------------------------------------------------------------------------------------------------------------

function paintBase(g: Ctx): void {
  // The dark at the bottom of the plush, warmer behind her head.
  field(g, 0, 0, SW, SH, (x, y) => {
    const d = Math.hypot((x - 160) / 1.25, y - 62) / 112;
    const c = noise(x, y, 18, 3) * 0.6 + noise(x, y, 6, 4) * 0.4;
    // Damp cotton crowding the edges of the picture.
    const edge = Math.max(0, Math.abs(x - 160) / 160 - 0.62) * 2.4 + Math.max(0, y / SH - 0.8);
    if (c * 0.7 + edge > 0.78) return ramp(COTTON, (c - 0.3) * 1.6 + (bayer(x, y) - 0.5) * 0.2, x, y);
    return ramp(DARK, 1 - d * 1.1 + (c - 0.5) * 0.25, x, y);
  });
  // The cardigan (worn, too big): rounded shoulders, a ribbed neckline, the front opening and its buttons.
  field(g, 70, 100, 180, 80, (x, y) => {
    if (!inCardigan(x, y)) return null;
    const top = shoulderTop(x);
    if (y === Math.ceil(top) || !inCardigan(x - 1, y) || !inCardigan(x + 1, y)) return OUT;
    const dx = x + 0.5 - 160;
    // The neckline rib, a darker band hugging the neck.
    if (y - top < 3 && Math.abs(dx) < 30) return ramp(KNIT, 0.55 + ((x & 1) ? 0.1 : 0), x, y);
    // The front opening, a little to the left, and two buttons.
    if (Math.abs(dx + 2) < 0.6 && y > 112) return OUT;
    for (const by of [118, 132]) if (Math.hypot(dx - 2.5, y + 0.5 - by) < 2) return Math.hypot(dx - 2, y - by) < 0.8 ? '#cbbb96' : '#7a6b56';
    // Where the sleeves meet the body.
    if (Math.abs(Math.abs(dx) - 40) < 0.6 && y > top + 6) return ramp(KNIT, 0.75, x, y);
    // Knitted ribs; folds where the sleeves hang; light from the left.
    const fold = Math.sin(dx / 6 + (y - 110) / 14) * 0.08;
    const shade = dx / 120 + (y - 110) / 140 + fold + (Math.abs(dx) > 50 ? 0.12 : 0);
    const rib = (x & 1) === 0 && (y + (x >> 1)) % 3 === 0 ? 0.1 : 0;
    return ramp(KNIT, 0.12 + shade + rib, x, y);
  });
  // The neck: paper, like the face (the pencil shades it).
  field(g, 148, 94, 24, 20, (x, y) => (inNeck(x, y) && !inFace(x, y) && !inCardigan(x, y) ? ramp(PAPER, 0.25 + (y - 98) / 30, x, y) : null));
  // The face: blank paper, with its grain, a little darker toward the edge.
  field(g, F.x - F.rx - 2, BAND - 2, F.rx * 2 + 4, F.ry * 2, (x, y) => {
    if (!inFace(x, y)) return null;
    const ny = (y - F.y) / F.ry;
    const nx = (x - F.x) / F.rx;
    const v = 0.1 + Math.max(0, nx * nx + ny * ny - 0.55) * 0.9 + (noise(x, y, 3, 9) - 0.5) * 0.18;
    return ramp(PAPER, v, x, y);
  });
  // The ears, then the hat over everything above the band.
  field(g, 100, 36, 120, 44, (x, y) => {
    const d = inEar(x, y);
    if (d < 0 || inHat(x, y)) return null;
    if (d > 0.78) return OUT;
    // The inside of the ear, a little pink.
    if (d < 0.32) return ramp(['#efd2c4', '#dcb7a8'], d * 2 + (bayer(x, y) - 0.5) * 0.3, x, y);
    const curl = noise(x, y, 2.2, 21);
    return ramp(WOOL, 0.25 + d * 0.5 + (x > 160 ? 0.15 : 0) + (curl - 0.5) * 0.5, x, y);
  });
  field(g, 118, 14, 84, 62, (x, y) => {
    const h = inHat(x, y);
    if (!h) return null;
    if (!inHat(x - 1, y) || !inHat(x + 1, y) || !inHat(x, y - 1) || !inHat(x, y + 1)) return OUT;
    const lx = (x - 160) / 37;
    if (h === 2) {
      // The ribbed band: knit stitches in rows.
      const by = y - (bandBottom(x) - 8);
      if (by < 1) return ramp(WOOL, 0.8, x, y);
      const v = 0.3 + lx * 0.5 + ((x + (y % 2)) % 2 ? 0.12 : 0) + (by > 6.5 ? 0.35 : 0);
      return ramp(WOOL, v, x, y);
    }
    const ly = (y - 34) / 32;
    // Ribs of the dome, curving toward the top.
    const col = Math.round((x - 160) / Math.max(0.4, Math.cos(Math.asin(clamp01(Math.abs(lx))) * 0.9)) / 3);
    const rib = col % 2 === 0 ? 0 : 0.14;
    return ramp(WOOL, 0.12 + lx * 0.45 + ly * 0.25 + rib + (noise(x, y, 2, 31) - 0.5) * 0.2, x, y);
  });
  // The pompom.
  field(g, 148, 6, 24, 22, (x, y) => {
    const d = Math.hypot(x + 0.5 - 160, (y + 0.5 - 19) * 1.1);
    const fuzz = noise(x, y, 1.6, 41) * 2.2;
    if (d > 7.5 + fuzz || inHat(x, y)) return null;
    if (d > 6.6 + fuzz) return OUT;
    return ramp(WOOL, 0.15 + (x - 156) / 14 + (y - 13) / 18 + (noise(x, y, 1.4, 42) - 0.5) * 0.5, x, y);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The pencil
// ---------------------------------------------------------------------------------------------------------------------

/** One pixel of graphite, in drawing order. */
type Mark = [x: number, y: number, c: string];

/** Quadratic Bézier sampled every half pixel, with a slight wobble of the hand. `press`: 0 (hard) to 4 (whisper). */
function curve(out: Mark[], x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, press: number, seed: number): void {
  const len = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const n = Math.max(2, Math.ceil(len * 2));
  let last = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    const wob = (noise(i * 0.7, seed, 4, seed) - 0.5) * 0.9;
    const px = Math.round(x + wob * 0.4);
    const py = Math.round(y + wob * 0.4);
    const key = `${px},${py}`;
    if (key === last) continue;
    last = key;
    // The lead lifts a little at both ends of the stroke.
    const ends = Math.min(t, 1 - t) < 0.12 ? 1 : 0;
    const p = Math.min(LEAD.length - 1, press + ends + (hash(px, py, seed) < 0.18 ? 1 : 0));
    out.push([px, py, LEAD[p]!]);
  }
}

/** Parallel diagonal strokes inside `inside`, `gap` pixels apart (light shading). */
function hatch(out: Mark[], x0: number, y0: number, x1: number, y1: number, gap: number, press: number, inside: (x: number, y: number) => boolean, seed: number, slope = 1): void {
  for (let k = x0 - (y1 - y0); k <= x1; k += gap) {
    for (let y = y0; y <= y1; y++) {
      const x = Math.round(k + (y - y0) * slope);
      if (x < x0 || x > x1 || !inside(x, y)) continue;
      if (hash(x, y, seed) < 0.2) continue;
      out.push([x, y, LEAD[Math.min(LEAD.length - 1, press + (hash(y, x, seed) < 0.3 ? 1 : 0))]!]);
    }
  }
}

/** The face, stroke after stroke, in the order the pencil draws it. */
function faceMarks(): Mark[] {
  const m: Mark[] = [];
  const onFace = (x: number, y: number): boolean => inFace(x, y) && y > BAND + 1;
  // The outline: round cheeks, a small round chin; a second, lighter pass, as a hand that looks for the line.
  curve(m, 132, 70, 128, 90, 146, 101, 2, 1);
  curve(m, 188, 70, 192, 90, 174, 101, 2, 2);
  curve(m, 146, 101, 160, 108, 174, 101, 2, 3);
  curve(m, 133, 74, 130, 92, 147, 102, 4, 4);
  curve(m, 187, 74, 190, 93, 173, 102, 4, 5);
  // Brows: short and soft, the inner ends a little raised (tired, kind).
  curve(m, 141, 70.5, 146, 68.5, 152, 69.5, 3, 7);
  curve(m, 179, 70.5, 174, 68.5, 168, 69.5, 3, 8);
  // Eyes, big (she is eight), looking at you: round irises, the lids a little low, a light in each.
  for (const [ex, side, seed] of [
    [147, -1, 10],
    [173, 1, 20],
  ] as const) {
    const ey = 79;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 11) continue;
        // The lid hides the very top of the iris.
        if (dy === -3) continue;
        const light = (dx === -1 && (dy === -1 || dy === -2)) || (dx === -2 && dy === -1) || (dx === 2 && dy === 2);
        m.push([ex + dx, ey + dy, light ? PAPER[0]! : LEAD[Math.abs(dx) === 3 || Math.abs(dy) === 3 ? 1 : 0]!]);
      }
    // The upper lid: a soft arc, drooping a little at the outer corner; lashes there.
    curve(m, ex - 6, ey, ex - side, ey - 5, ex + 6, ey + 0.5, 0, seed);
    curve(m, ex + side * 6, ey + 0.5, ex + side * 7.5, ey + 0.5, ex + side * 8.5, ey - 0.5, 1, seed + 2);
    // The lower lid, pushed up a little by the smile; a faint shadow under it (she is tired).
    curve(m, ex - 4, ey + 4.5, ex, ey + 5.5, ex + 4, ey + 4.5, 3, seed + 4);
    curve(m, ex - 4, ey + 7.5, ex, ey + 8.5, ex + 3, ey + 7.5, 4, seed + 5);
  }
  // The nose: a small curl.
  curve(m, 161, 85, 162.5, 89, 159, 90, 3, 30);
  // The smile: closed, small, the corners up.
  curve(m, 153, 95, 160, 100, 167, 95, 1, 32);
  curve(m, 152, 94, 152.5, 94.5, 153, 95, 2, 33);
  curve(m, 167, 95, 167.5, 94.5, 168, 94, 2, 34);
  curve(m, 158, 102, 160, 102.5, 162, 102, 4, 35);
  // A little shade: the cheek away from the light, under the chin on the neck.
  hatch(m, 180, 84, 190, 100, 3, 4, (x, y) => onFace(x, y) && (x - F.x) / F.rx > 0.72, 40);
  hatch(m, 152, 101, 168, 106, 2, 3, (x, y) => inNeck(x, y) && !inFace(x, y), 41);
  curve(m, 152, 101, 151.5, 105, 151.5, 109, 3, 42);
  curve(m, 168, 101, 168.5, 105, 168.5, 109, 3, 43);
  // Colour on the cheeks: someone had a pink crayon.
  for (const [cx, seed] of [
    [139, 50],
    [181, 60],
  ] as const) {
    for (let i = -2; i <= 2; i++)
      for (let j = -3; j <= 3; j++) {
        const x = cx + i * 2 + (j > 0 ? 1 : 0) + Math.round(j * 0.5);
        const y = 89 + j;
        if ((x - cx) ** 2 / 30 + (y - 89) ** 2 / 9 <= 1 && hash(x, y, seed) > 0.25) m.push([x, y, BLUSH]);
      }
  }
  return m;
}

let MARKS: Mark[] | null = null;
/** Frames the pencil takes to draw the whole face. */
const DRAW_FRAMES = 150;

function paintMarks(g: Ctx, n: number): void {
  for (let i = 0; i < n; i++) {
    const [x, y, c] = MARKS![i]!;
    if (inHat(x, y) || inEar(x, y) >= 0) continue;
    g.fillStyle = c;
    g.fillRect(x, y, 1, 1);
  }
}

export const CH6_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  bonnet_visage: (g, t) => {
    MARKS ??= faceMarks();
    const n = Math.min(MARKS.length, Math.floor((t / DRAW_FRAMES) * MARKS.length));
    if (n >= MARKS.length) g.drawImage(layer('bonnet_visage_fini', (c) => (c.drawImage(layer('bonnet_visage', paintBase), 0, 0), paintMarks(c, MARKS!.length))), 0, 0);
    else {
      g.drawImage(layer('bonnet_visage', paintBase), 0, 0);
      paintMarks(g, n);
      // The point of the pencil, where it is drawing.
      const last = MARKS[Math.max(0, n - 1)];
      if (last && n > 0) {
        g.fillStyle = LEAD[0]!;
        g.fillRect(last[0] + 1, last[1] - 2, 1, 2);
        g.fillStyle = '#c99a5b';
        g.fillRect(last[0] + 2, last[1] - 4, 1, 2);
      }
    }
  },
};

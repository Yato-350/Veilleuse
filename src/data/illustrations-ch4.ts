import { ctx2d, makeCanvas } from '../engine/sprite';

/*
 * Illustration of chapter 4 « La Maison Cousue »: `souvenir_lumiere`, the fourth memory (docs/HISTOIRE.md § 3.11,
 * T4). The corridor of the apartment at night, seen from a few steps away: at the far end a closed door, a thin
 * line of warm light under it spreading a fan of light on the parquet, and on the door the shadow of a hand laid
 * flat, its forearm fading into the dark. The old radiator on the left wall (the other source of the knocks), a
 * half-torn sticker at a child's height. Same family as the real-world memories: flat shapes, dithered gradients,
 * one light source. Static layer cached; the light breathes a little and dust drifts in it.
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

function withAlpha(g: Ctx, a: number, fn: () => void): void {
  const prev = g.globalAlpha;
  g.globalAlpha = prev * clamp01(a);
  fn();
  g.globalAlpha = prev;
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
// The corridor in one-point perspective
// ---------------------------------------------------------------------------------------------------------------------

/** The far wall (x0..x1, y0..y1); the door in it; the light gap at the bottom of the door. */
const BACK = { x0: 116, x1: 204, y0: 30, y1: 140 };
const DOOR = { x0: 139, x1: 181, y0: 46, y1: 139 };
/** Floor and ceiling edges of the side walls, as functions of x (left wall: x < BACK.x0). */
const floorL = (x: number): number => BACK.y1 + (BACK.x0 - x) * 1.21;
const ceilL = (x: number): number => BACK.y0 - (BACK.x0 - x) * 1.25;
const floorR = (x: number): number => BACK.y1 + (x - BACK.x1) * 1.21;
const ceilR = (x: number): number => BACK.y0 - (x - BACK.x1) * 1.25;

const WALL = ['#05060a', '#080a10', '#0c0f17', '#11151f', '#171c28'];
const WOOD = ['#070504', '#0d0907', '#140e0a', '#1d140e', '#291c12'];
const LIGHT = ['#291c12', '#3d2a19', '#5c3f22', '#87602f', '#b8873f', '#e6b55a', '#fbdc8e', '#fff4cf'];
const DOOR_C = ['#0b0a0f', '#100e15', '#16131c', '#1d1923'];

/** How much of the light from under the door reaches the floor at (x, y). */
function floorLight(x: number, y: number): number {
  const dy = y - BACK.y1;
  if (dy < 0) return 0;
  const half = (DOOR.x1 - DOOR.x0) / 2 + dy * 0.95;
  const cx = (DOOR.x0 + DOOR.x1) / 2;
  const across = 1 - Math.abs(x - cx) / half;
  if (across <= 0) return 0;
  return Math.pow(across, 0.7) * Math.pow(Math.max(0, 1 - dy / 46), 1.6);
}

function paintLumiere(g: Ctx): void {
  // Ceiling, side walls, far wall: all darkness, a little less dark towards the far end.
  field(g, 0, 0, SW, SH, (x, y) => {
    const leftWall = x < BACK.x0 && y > ceilL(x) && y < floorL(x);
    const rightWall = x >= BACK.x1 && y > ceilR(x) && y < floorR(x);
    const back = x >= BACK.x0 && x < BACK.x1 && y >= BACK.y0 && y < BACK.y1;
    const ceiling = y <= BACK.y0 && (x < BACK.x0 ? y <= ceilL(x) : x >= BACK.x1 ? y <= ceilR(x) : true);
    if (back) return ramp(WALL, 0.55 + floorLight(x, BACK.y1 + 1) * 0.0 + (y - BACK.y0) / 400, x, y);
    if (leftWall || rightWall) {
      // A faint warm bounce near the floor of the far end.
      const fx = leftWall ? floorL(x) : floorR(x);
      const near = Math.max(0, 1 - Math.abs(x - 160) / 90) * Math.max(0, 1 - (fx - y) / 40);
      const d = Math.abs(x - 160) / 160;
      return near > 0.35 && bayer(x, y) < near * 0.5 ? '#1c140f' : ramp(WALL, 0.42 - d * 0.42, x, y);
    }
    if (ceiling) return ramp(WALL, 0.25 - Math.abs(x - 160) / 700 - (BACK.y0 - y) / 160, x, y);
    // The floor: parquet boards running towards the door, lit by the fan of light.
    const k = floorLight(x, y);
    if (k > 0.05) return ramp(LIGHT, k * 1.05 + (hash(x >> 2, y, 3) - 0.5) * 0.05, x, y);
    const board = Math.floor((x - 160) / Math.max(2, (y - 86) * 0.16));
    const seam = Math.abs(((x - 160) / Math.max(2, (y - 86) * 0.16)) - board) < 0.08;
    return seam ? WOOD[0]! : ramp(WOOD, 0.35 + hash(board, 0, 9) * 0.35 - Math.abs(x - 160) / 600, x, y);
  });
  // Skirting boards along the side walls.
  for (let x = 0; x < BACK.x0; x++) rect(g, x, floorL(x) - Math.max(1, (BACK.x0 - x) * 0.05 + 2), 1, Math.max(1, (BACK.x0 - x) * 0.05 + 2), '#0e1018');
  for (let x = BACK.x1; x < SW; x++) rect(g, x, floorR(x) - Math.max(1, (x - BACK.x1) * 0.05 + 2), 1, Math.max(1, (x - BACK.x1) * 0.05 + 2), '#0e1018');
  rect(g, BACK.x0, BACK.y1 - 2, BACK.x1 - BACK.x0, 2, '#0e1018');

  // The radiator on the left wall: fins in perspective, just above the skirting board.
  for (let x = 64; x < 100; x++) {
    const fy = floorL(x);
    const h = fy - ceilL(x);
    const top = fy - h * 0.3;
    const bot = fy - h * 0.1;
    const spacing = Math.max(1.5, h / 60);
    const fin = Math.floor((x - 64) / spacing) % 2 === 0;
    rect(g, x, top, 1, bot - top, fin ? '#141822' : '#0b0d14');
    if (fin) rect(g, x, top, 1, 1, '#1d2230');
  }
  // Its pipe, going down into the floor.
  for (let x = 96; x < 100; x++) rect(g, x, floorL(x) - (floorL(x) - ceilL(x)) * 0.1, 1, (floorL(x) - ceilL(x)) * 0.1, '#10131b');

  // A door on the right wall (Mina's room), closed, in perspective.
  for (let x = 222; x < 262; x++) {
    const fy = floorR(x);
    const h = fy - ceilR(x);
    const top = fy - h * 0.78;
    const edge = x === 222 || x === 261;
    rect(g, x, top, 1, fy - top - 1, edge ? '#05060a' : ramp(['#0a0b11', '#0d0f16'], (x - 222) / 40, x, Math.round(top)));
    if (x > 224 && x < 260) rect(g, x, top, 1, 1, '#151924');
  }
  // Its handle, barely there.
  rect(g, 252, floorR(252) - (floorR(252) - ceilR(252)) * 0.4, 3, 2, '#1a1e2a');

  // The door at the end: frame, slab with two panels, handle.
  rect(g, DOOR.x0 - 4, DOOR.y0 - 4, DOOR.x1 - DOOR.x0 + 8, DOOR.y1 - DOOR.y0 + 4, '#14131b');
  rect(g, DOOR.x0 - 4, DOOR.y0 - 4, DOOR.x1 - DOOR.x0 + 8, 1, '#1d1b26');
  field(g, DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0 - 1, (x, y) => {
    // A faint warm glow at the very bottom (the light bouncing off the floor).
    const low = Math.max(0, 1 - (DOOR.y1 - 1 - y) / 14);
    if (low > 0 && bayer(x, y) < low * 0.45) return '#2a1d14';
    return ramp(DOOR_C, 0.6 - (y - DOOR.y0) / 300 + (x - DOOR.x0) / 400, x, y);
  });
  const panel = (x0: number, y0: number, w: number, h: number): void => {
    rect(g, x0, y0, w, 1, '#08070b');
    rect(g, x0, y0, 1, h, '#08070b');
    rect(g, x0, y0 + h - 1, w, 1, '#221e2a');
    rect(g, x0 + w - 1, y0, 1, h, '#221e2a');
  };
  panel(DOOR.x0 + 6, DOOR.y0 + 6, DOOR.x1 - DOOR.x0 - 12, 34);
  panel(DOOR.x0 + 6, DOOR.y0 + 48, DOOR.x1 - DOOR.x0 - 12, 36);
  // The lever handle, with a glint of warm light on its underside.
  rect(g, DOOR.x1 - 9, 93, 7, 2, '#26222e');
  rect(g, DOOR.x1 - 9, 95, 7, 1, '#5c3f22');
  rect(g, DOOR.x1 - 4, 92, 2, 5, '#1a1720');
  // A half-torn sticker at a child's height: half a star, and the white of the torn paper.
  const sx = DOOR.x0 + 13;
  const sy = 116;
  const star = ['..#..', '.###.', '#####', '.###.', '##.##'];
  star.forEach((row, ry) =>
    [...row].forEach((ch, rx) => {
      if (ch !== '#') return;
      rect(g, sx + rx, sy + ry, 1, 1, rx < 3 ? '#4a4232' : hash(rx, ry, 4) < 0.5 ? '#2c2a30' : '#26242c');
    }),
  );

  // The line of light under the door.
  rect(g, DOOR.x0, DOOR.y1 - 1, DOOR.x1 - DOOR.x0, 1, '#fbdc8e');
  rect(g, DOOR.x0 + 2, DOOR.y1, DOOR.x1 - DOOR.x0 - 4, 1, '#fff4cf');
  rect(g, DOOR.x0 - 1, DOOR.y1, 1, 1, '#b8873f');
  rect(g, DOOR.x1, DOOR.y1, 1, 1, '#b8873f');

  // The shadow of a hand laid flat on the door; the forearm fades into the dark, down to the left.
  paintHand(g, 158, 82);
}

/** Distance from (x, y) to the segment (ax, ay)–(bx, by). */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
}

/**
 * Palm centre (cx, cy): a hand pressed flat, fingers up and a little apart, the thumb out to the left, the forearm
 * fading into the dark towards the lower left. A cast shadow, a bit bigger than a hand: dithered, soft edges.
 */
function paintHand(g: Ctx, cx: number, cy: number): void {
  // Finger capsules: base (x, y), tip (x, y), radius.
  const caps: Array<[number, number, number, number, number]> = [
    [cx - 5, cy - 5, cx - 8, cy - 16, 1.7],
    [cx - 1.5, cy - 6, cx - 2.5, cy - 20, 1.8],
    [cx + 2, cy - 6, cx + 3, cy - 19, 1.8],
    [cx + 5.5, cy - 4, cx + 8.5, cy - 14, 1.6],
    // The thumb.
    [cx - 6, cy + 3, cx - 13, cy - 4, 2],
  ];
  const inHand = (x: number, y: number): number => {
    // Palm: a rounded square, slightly wider at the knuckles.
    const w = 6.5 + (cy + 6 - y) * 0.06;
    if (Math.abs(x - cx) <= w && y >= cy - 6 && y <= cy + 7 && Math.hypot(Math.max(0, Math.abs(x - cx) - w + 2.5), Math.max(0, y - cy - 4.5)) < 2.5)
      return 1;
    for (const [ax, ay, bx, by, r] of caps) if (segDist(x, y, ax, ay, bx, by) <= r) return 1;
    // Wrist and forearm, down to the lower left, wider and fading.
    const d = segDist(x, y, cx, cy + 6, cx - 34, cy + 66);
    const along = clamp01((y - cy - 6) / 60);
    if (y > cy + 2 && d <= 5 + along * 4) return 1 - along * 0.85;
    return 0;
  };
  field(g, cx - 60, cy - 26, 90, 110, (x, y) => {
    const v = inHand(x + 0.5, y + 0.5);
    if (v <= 0) return null;
    // Softer at the borders: a shadow, not a cut-out.
    const inner = inHand(x - 0.5, y + 0.5) > 0 && inHand(x + 1.5, y + 0.5) > 0 && inHand(x + 0.5, y - 0.5) > 0 && inHand(x + 0.5, y + 1.5) > 0;
    const k = v * (inner ? 1 : 0.6);
    return bayer(x, y) < k ? (k > 0.8 ? '#030305' : '#07070b') : null;
  });
}

export const CH4_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  souvenir_lumiere: (g, t) => {
    g.drawImage(layer('souvenir_lumiere', paintLumiere), 0, 0);
    // The nightlight on the other side does not flicker; it breathes, very slowly.
    const k = 0.1 + 0.05 * Math.sin(t * 0.021);
    withAlpha(g, k, () =>
      field(g, DOOR.x0 - 30, BACK.y1 - 6, DOOR.x1 - DOOR.x0 + 60, 30, (x, y) => (bayer(x, y) < floorLight(x, y + 2) * 1.4 ? '#ffe9a8' : null)),
    );
    // Dust in the light, drifting up.
    for (let i = 0; i < 14; i++) {
      const sp = 0.05 + hash(i, 2, 7) * 0.08;
      const x = DOOR.x0 - 10 + Math.floor(hash(i, 1, 7) * (DOOR.x1 - DOOR.x0 + 20) + Math.sin(t * 0.01 + i) * 3);
      const y = Math.floor(SH - 4 - ((hash(i, 3, 7) * 40 + t * sp) % 40));
      const a = floorLight(x, y) * 0.9 + 0.1;
      withAlpha(g, a, () => rect(g, x, y, 1, 1, '#fff4cf'));
    }
  },
};

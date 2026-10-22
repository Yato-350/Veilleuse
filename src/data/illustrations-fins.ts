import { drawText, measure } from '../engine/font';
import { ctx2d, makeCanvas } from '../engine/sprite';
import { tr } from '../i18n';

/*
 * Illustrations of the endings, version 2 (docs/HISTOIRE.md § 5; story/endings.ts). Same family as the real-world
 * memories (flat shapes, dithered gradients, one light source). Key art stays above y 120 (captions cover the bottom).
 * Static layers are cached; the overlays only move what lives.
 *
 *   fin_beaux_reves  Beaux rêves: Noa's room at night, a few years later. He is sixteen: taller, hair over his eyes,
 *                    headphones, sitting up in bed against the wall with Dodo in his arms — awake, alive (he blinks,
 *                    he breathes). The nightlight is on. On the door frame, three pencil marks: 14, 15, 16. He is
 *                    not dead and he is not asleep: he stays (§ 6.1).
 *   fin_silence      Silence: Mina's door on a bright school morning. A card taped on it, « DÉBARRAS », in fat marker;
 *                    above it, where letter stickers were peeled off, four paler marks (the name, barely). No line of
 *                    light under the door. Low on the wall, an empty coat hook. Dust in the sun.
 *   fin_veilleuse    Veilleuse: Mina's room at dawn. The moon nightlight plugged in by her bed (its cord runs down to the
 *                    socket), the beanie on the pillow, Dodo sitting against it, sewn back with big crooked blue
 *                    stitches; above the bed, taped to the wall, the finished drawing (lune_finie).
 */

type Ctx = CanvasRenderingContext2D;

const SW = 320;
const SH = 180;

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Dithered pick in a colour ramp (v in 0..1). */
function ramp(cols: readonly string[], v: number, x: number, y: number): string {
  const p = clamp01(v) * (cols.length - 1);
  const i = Math.floor(p);
  return p - i > bayer(x, y) ? cols[Math.min(i + 1, cols.length - 1)]! : cols[i]!;
}

function rect(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function px(g: Ctx, x: number, y: number, c: string): void {
  rect(g, x, y, 1, 1, c);
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

/** Filled ellipse (pixel centres inside). */
function oval(g: Ctx, cx: number, cy: number, rx: number, ry: number, c: string | ((x: number, y: number) => string | null)): void {
  field(g, Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 ? (typeof c === 'string' ? c : c(x, y)) : null,
  );
}

/** A one-pixel line. */
function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, c: string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) px(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
}

function withAlpha(g: Ctx, a: number, fn: () => void): void {
  const prev = g.globalAlpha;
  g.globalAlpha = prev * a;
  fn();
  g.globalAlpha = prev;
}

/** Vertical gradient in bands. */
function vgrad(g: Ctx, x: number, y: number, w: number, h: number, cols: readonly string[]): void {
  field(g, x, y, w, h, (xx, yy) => ramp(cols, (yy - y) / Math.max(1, h - 1), xx, yy));
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

/** Soft dithered glow (radius r) — for lights drawn in the overlays. */
function glow(g: Ctx, cx: number, cy: number, r: number, c: string, a: number): void {
  withAlpha(g, a, () => field(g, Math.floor(cx - r), Math.floor(cy - r), r * 2 + 1, r * 2 + 1, (x, y) => (Math.hypot(x - cx, y - cy) / r < bayer(x, y) ? c : null)));
}

/** Dust in a beam of light (cheap animated overlay). */
function motes(g: Ctx, t: number, n: number, seed: number, x0: number, y0: number, x1: number, y1: number, c: string): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((hash(i, 1, seed) * (x1 - x0) + t * (0.04 + hash(i, 2, seed) * 0.06)) % (x1 - x0));
    const y = y0 + ((hash(i, 3, seed) * (y1 - y0) + Math.sin(t * 0.015 + i) * 4 + t * 0.02) % (y1 - y0));
    withAlpha(g, 0.35 + 0.35 * Math.sin(t * 0.03 + i * 1.7), () => px(g, x, y, c));
  }
}

/** The moon nightlight (a crescent on a small base); `on` paints its halo too. */
function moonLamp(g: Ctx, x: number, y: number, on: boolean): void {
  if (on) glow(g, x, y - 6, 26, '#ffe991', 0.18);
  rect(g, x - 5, y, 11, 3, '#c8c0d0');
  rect(g, x - 5, y + 2, 11, 1, '#8a8098');
  field(g, x - 7, y - 15, 15, 15, (xx, yy) => {
    const a = Math.hypot(xx + 0.5 - x, yy + 0.5 - (y - 7)) <= 7;
    const b = Math.hypot(xx + 0.5 - (x + 3), yy + 0.5 - (y - 9)) <= 6;
    return a && !b ? (on ? '#fff3a0' : '#c8c0a0') : null;
  });
  px(g, x - 4, y - 10, '#ffffff');
}

// ---------------------------------------------------------------------------------------------------------------------
// Beaux rêves — sixteen
// ---------------------------------------------------------------------------------------------------------------------

/** Noa, sitting up: where his head and his eyes are (the overlay blinks them). */
const NOA = { x: 136, y: 52 };

function paintBeauxReves(g: Ctx): void {
  // The room at night: a deep blue that never changes.
  field(g, 0, 0, SW, 112, (x, y) => ramp(['#121836', '#161e40', '#1a2348', '#1e2850'], y / 140 + hash(x >> 3, y >> 3, 3) * 0.08, x, y));
  // Floorboards.
  field(g, 0, 112, SW, SH - 112, (x, y) => ((x + (y >> 2) * 37) % 44 === 0 ? '#0a0e22' : ramp(['#10152e', '#0e1228', '#0c1024'], (y - 112) / 68, x, y)));
  rect(g, 0, 111, SW, 1, '#262e58');
  // The window: night, a few stars, the moon.
  const wx = 22;
  const wy = 16;
  vgrad(g, wx, wy, 58, 48, ['#05081a', '#0a1028', '#0e1634']);
  for (let i = 0; i < 16; i++) px(g, wx + 2 + Math.floor(hash(i, 1, 90) * 54), wy + 2 + Math.floor(hash(i, 2, 90) * 44), i % 3 ? '#6a78b0' : '#c8d0f0');
  oval(g, wx + 42, wy + 14, 6, 6, '#e8e0b8');
  oval(g, wx + 45, wy + 12, 5, 5, '#0a1028');
  rect(g, wx - 3, wy - 3, 64, 3, '#2a3466');
  rect(g, wx - 3, wy + 48, 64, 4, '#2a3466');
  rect(g, wx - 3, wy, 3, 48, '#2a3466');
  rect(g, wx + 58, wy, 3, 48, '#2a3466');
  rect(g, wx + 28, wy, 2, 48, '#2a3466');
  // The curtain, half drawn.
  field(g, wx + 30, wy - 4, 30, 58, (x, y) => (x - wx - 30 < 18 + Math.sin(y * 0.3) * 2 ? ramp(['#3a2a5a', '#2e2250', '#241a44'], ((x - wx) % 6) / 6, x, y) : null));
  // The door (right), shut. On its frame, three pencil marks and their numbers: 14, 15, 16.
  const dx = 264;
  rect(g, dx - 6, 18, 6, 94, '#2a3260');
  rect(g, dx, 18, 46, 94, '#232a54');
  rect(g, dx + 4, 24, 38, 38, '#1e2448');
  rect(g, dx + 4, 66, 38, 40, '#1e2448');
  rect(g, dx + 36, 64, 4, 3, '#8a8fb0');
  const marks: Array<[number, string]> = [
    [48, '14'],
    [38, '15'],
    [28, '16'],
  ];
  for (const [my, label] of marks) {
    rect(g, dx - 6, my, 5, 1, '#a8b0d8');
    drawText(g, label, dx - 9 - measure(label), my - 4, { color: '#8a94c4', shadow: null });
  }
  // The headboard, the bed along the wall.
  rect(g, 92, 50, 8, 62, '#2a2a5a');
  rect(g, 92, 50, 8, 2, '#3a3a72');
  rect(g, 100, 84, 150, 26, '#34347a');
  rect(g, 100, 82, 150, 4, '#40408a');
  rect(g, 100, 108, 150, 6, '#22224e');
  for (let i = 0; i < 6; i++) line(g, 170 + i * 13, 86, 164 + i * 13, 106, '#2c2c6a');
  // The pillow behind his back.
  oval(g, 116, 72, 14, 10, '#c8cce4');
  oval(g, 116, 70, 12, 7, '#d8dcf0');
  // Noa, sixteen: sitting up against the wall, knees drawn up under the blanket.
  const nx = NOA.x;
  const ny = NOA.y;
  // knees under the blanket, drawn up to his chest
  oval(g, nx + 14, 78, 15, 10, '#3c3c86');
  oval(g, nx + 14, 75, 11, 6, '#48489a');
  // the sweater (wide shoulders now)
  field(g, nx - 13, ny + 8, 28, 30, (x, y) => {
    const half = 10 + Math.min(4, (y - ny - 8) * 0.35);
    return Math.abs(x + 0.5 - nx) <= half ? ramp(['#6a5a9a', '#5a4c88', '#4a3e74'], (x - nx + 12) / 26, x, y) : null;
  });
  // neck, head
  rect(g, nx - 2, ny + 5, 5, 4, '#c8a8a0');
  oval(g, nx, ny, 7, 8, '#d8b8ac');
  // long hair over the forehead and the ears
  field(g, nx - 9, ny - 10, 19, 15, (x, y) => {
    const top = Math.hypot((x + 0.5 - nx) / 8.5, (y + 0.5 - ny + 1) / 9) <= 1;
    const fringe = y < ny - 1 + Math.abs(Math.sin((x - nx) * 0.9)) * 2.5 || Math.abs(x + 0.5 - nx) > 5.5;
    return top && fringe ? ramp(['#2b2946', '#3f3d63'], hash(x, y, 7) * 0.6, x, y) : null;
  });
  // headphones: the band over the hair, a cup on each ear, the cord down to a pocket
  field(g, nx - 9, ny - 10, 19, 6, (x, y) => (Math.abs(Math.hypot((x + 0.5 - nx) / 9, (y + 0.5 - ny + 1) / 9.5) - 1) < 0.1 ? '#0e1022' : null));
  rect(g, nx - 10, ny - 2, 4, 6, '#14162e');
  rect(g, nx + 7, ny - 2, 4, 6, '#14162e');
  px(g, nx - 9, ny - 1, '#3a3e66');
  px(g, nx + 8, ny - 1, '#3a3e66');
  line(g, nx + 9, ny + 4, nx + 12, ny + 18, '#0e1022');
  line(g, nx + 12, ny + 18, nx + 8, ny + 30, '#0e1022');
  // eyes open (the overlay closes them now and then), a straight mouth
  rect(g, nx - 4, ny + 1, 2, 1, '#10101c');
  rect(g, nx + 2, ny + 1, 2, 1, '#10101c');
  rect(g, nx - 1, ny + 5, 3, 1, '#a07a74');
  // arms around Dodo
  rect(g, nx - 12, ny + 20, 6, 8, '#5a4c88');
  rect(g, nx + 9, ny + 20, 6, 8, '#4a3e74');
  // Dodo, on his knees: worn grey cotton, an ear flat, button eyes
  const ddx = nx + 3;
  const ddy = ny + 26;
  oval(g, ddx, ddy, 9, 7, (x, y) => (hash(x, y, 4) < 0.18 ? '#a8a4bc' : '#c4c0d6'));
  oval(g, ddx, ddy - 6, 6, 5, (x, y) => (hash(x, y, 5) < 0.18 ? '#a8a4bc' : '#c4c0d6'));
  oval(g, ddx, ddy - 5, 4, 3, '#7a7490');
  px(g, ddx - 2, ddy - 6, '#0b0710');
  px(g, ddx + 2, ddy - 6, '#0b0710');
  rect(g, ddx - 8, ddy - 9, 4, 2, '#9a96b0');
  rect(g, ddx + 5, ddy - 9, 3, 2, '#b8b4cc');
  // hands over him
  rect(g, nx - 7, ny + 26, 4, 3, '#d8b8ac');
  rect(g, nx + 9, ny + 25, 4, 3, '#d8b8ac');
  // The nightstand and the nightlight (on, always).
  rect(g, 250, 88, 10, 24, '#2a2448');
  rect(g, 250, 88, 10, 2, '#3a3460');
  rect(g, 228, 90, 26, 22, '#2a2448');
  rect(g, 228, 90, 26, 3, '#3a3460');
  moonLamp(g, 240, 87, true);
}

// ---------------------------------------------------------------------------------------------------------------------
// Silence — the storeroom
// ---------------------------------------------------------------------------------------------------------------------

function paintSilence(g: Ctx): void {
  // The hallway, a bright school morning: pale wall, sun on the floor.
  field(g, 0, 0, SW, 116, (x, y) => ramp(['#efebe3', '#e7e2d8', '#ddd7cb'], y / 130 + (x < 120 ? 0.1 : 0), x, y));
  field(g, 0, 116, SW, SH - 116, (x, y) => ((x + (y >> 2) * 29) % 40 === 0 ? '#a8987e' : ramp(['#c8b89c', '#bcab8e'], (y - 116) / 64, x, y)));
  rect(g, 0, 114, SW, 2, '#b8b0a2');
  // Sun through a window out of frame (left): a slanted patch on the wall and the floor.
  field(g, 0, 0, SW, SH, (x, y) => {
    const u = x - (y - 116) * 0.6;
    return y < 116 && x > 10 && x < 92 && y > 30 && u > 20 && u < 86 && bayer(x, y) < 0.18 ? '#f6f2e8' : y >= 116 && u > 16 && u < 110 && bayer(x, y) < 0.3 ? '#dccca8' : null;
  });
  // The door frame and the door.
  const x0 = 124;
  const y0 = 12;
  const w = 72;
  const h = 102;
  rect(g, x0 - 6, y0 - 6, w + 12, h + 6, '#cfc8ba');
  rect(g, x0 - 6, y0 - 6, w + 12, 2, '#e0dacd');
  rect(g, x0, y0, w, h, '#e3ded3');
  rect(g, x0 + 6, y0 + 6, w - 12, 40, '#dad4c8');
  rect(g, x0 + 6, y0 + 52, w - 12, 44, '#dad4c8');
  rect(g, x0 + 6, y0 + 6, w - 12, 1, '#cfc8ba');
  rect(g, x0 + 6, y0 + 52, w - 12, 1, '#cfc8ba');
  // The handle, the keyhole.
  rect(g, x0 + w - 13, y0 + 54, 8, 3, '#9a9488');
  rect(g, x0 + w - 13, y0 + 54, 8, 1, '#c8c2b6');
  rect(g, x0 + w - 10, y0 + 60, 2, 3, '#4a4640');
  // Where letter stickers were peeled off: four paler marks (the glue kept their shape), a scrap of a gold crown.
  const name = 'MINA'; // i18n-ignore (a name: the shapes of the peeled-off stickers)
  const nw = measure(name) * 2;
  withAlpha(g, 0.55, () => drawText(g, name, x0 + w / 2 - nw / 2, y0 + 10, { color: '#ece8df', scale: 2, shadow: null }));
  rect(g, x0 + 9, y0 + 9, 3, 2, '#d8b860');
  px(g, x0 + 10, y0 + 8, '#d8b860');
  // The card, taped crooked over the lower half of the name: « DÉBARRAS », fat black marker.
  const label = tr('DÉBARRAS');
  const lw = measure(label) + 12;
  const cx = Math.round(x0 + w / 2 - lw / 2) + 2;
  const cy = y0 + 22;
  rect(g, cx + 2, cy + 2, lw, 18, '#c8c0b0');
  rect(g, cx, cy, lw, 18, '#fbfaf6');
  rect(g, cx, cy + 17, lw, 1, '#e8e4dc');
  drawText(g, label, cx + 6, cy + 4, { color: '#1c1424', shadow: null });
  drawText(g, label, cx + 7, cy + 4, { color: '#1c1424', shadow: null });
  rect(g, cx - 3, cy - 2, 8, 4, 'rgba(200,200,190,0.8)');
  rect(g, cx + lw - 5, cy - 1, 8, 4, 'rgba(200,200,190,0.8)');
  // Under the door, nothing: no line of light.
  rect(g, x0, y0 + h - 2, w, 2, '#3a3630');
  // Low on the wall, left of the door, an empty coat hook (child height).
  rect(g, 88, 70, 6, 2, '#8a8478');
  rect(g, 92, 66, 2, 6, '#8a8478');
  px(g, 92, 65, '#b8b2a6');
  // On the right, the edge of the next door (Noa's room) and the light switch.
  rect(g, 286, 6, 34, 108, '#d6d0c4');
  rect(g, 286, 6, 2, 108, '#c4bdb0');
  rect(g, 262, 58, 7, 10, '#f4f2ec');
  rect(g, 264, 61, 3, 4, '#d8d4cc');
}

// ---------------------------------------------------------------------------------------------------------------------
// Veilleuse — the nightlight plugged in by her bed
// ---------------------------------------------------------------------------------------------------------------------

const VL = { x: 140, y: 85 };

function paintVeilleuse(g: Ctx): void {
  // Mina's room at dawn: her wallpaper with faded stars, warm light from the window.
  field(g, 0, 0, SW, 112, (x, y) => ramp(['#4e3e60', '#5e4868', '#74546c', '#8e6270'], (x / SW) * 0.7 + (y / 112) * 0.25, x, y));
  for (let i = 0; i < 24; i++) {
    const sx = 8 + Math.floor(hash(i, 1, 33) * 190);
    const sy = 6 + Math.floor(hash(i, 2, 33) * 96);
    withAlpha(g, 0.35, () => {
      px(g, sx, sy, '#c8a8d8');
      px(g, sx - 1, sy, '#a888b8');
      px(g, sx + 1, sy, '#a888b8');
      px(g, sx, sy - 1, '#a888b8');
      px(g, sx, sy + 1, '#a888b8');
    });
  }
  // Floor.
  field(g, 0, 112, SW, SH - 112, (x, y) => ramp(['#6a4a5a', '#5a3e4e', '#4a3442'], (y - 112) / 68, x, y));
  rect(g, 0, 111, SW, 1, '#8a6a7a');
  // The window (right), dawn.
  const wx = 214;
  const wy = 14;
  const ww = 86;
  const wh = 70;
  vgrad(g, wx, wy, ww, wh, ['#5a5a9a', '#9a7aaa', '#e09a9a', '#f8b888', '#ffe0a0']);
  oval(g, wx + 52, wy + wh - 5, 13, 13, (x, y) => ramp(['#fff8d8', '#ffe8a0'], Math.hypot(x - wx - 52, y - wy - wh + 5) / 13, x, y));
  field(g, wx, wy + wh - 14, ww, 14, (x, y) => (y > wy + wh - 5 - Math.floor(hash(Math.floor((x - wx) / 10), 0, 8) * 10) ? '#5a3a52' : null));
  rect(g, wx - 4, wy - 4, ww + 8, 4, '#e8d0c0');
  rect(g, wx - 4, wy + wh, ww + 8, 6, '#d8b8a8');
  rect(g, wx - 4, wy, 4, wh, '#e8d0c0');
  rect(g, wx + ww, wy, 4, wh, '#c8a898');
  rect(g, wx + ww / 2 - 2, wy, 4, wh, '#e8d0c0');
  // Light from the window across the floor.
  field(g, 0, 0, SW, SH, (x, y) => {
    const u = x + y * 0.8;
    return y > 112 && u > 230 && u < 300 && x < wx && bayer(x, y) < 0.12 ? '#c8908a' : null;
  });
  // Above the bed, taped to the wall: the finished drawing.
  const px0 = 34;
  const py0 = 16;
  rect(g, px0 + 2, py0 + 2, 56, 40, '#3e2e48');
  rect(g, px0, py0, 56, 40, '#fbf4e2');
  vgrad(g, px0 + 2, py0 + 2, 52, 24, ['#2c3f8f', '#3e78d6']);
  oval(g, px0 + 40, py0 + 11, 7, 7, '#f9cf3a');
  for (const [sx, sy] of [
    [px0 + 8, py0 + 6],
    [px0 + 20, py0 + 12],
    [px0 + 28, py0 + 5],
  ])
    px(g, sx!, sy!, '#f9cf3a');
  rect(g, px0 + 2, py0 + 26, 52, 12, '#4fae4f');
  // the two children, holding hands
  rect(g, px0 + 18, py0 + 20, 4, 8, '#bb98ea');
  oval(g, px0 + 20, py0 + 18, 2.5, 2.5, '#f8c6a0');
  rect(g, px0 + 17, py0 + 15, 6, 2, '#2c3f8f');
  rect(g, px0 + 26, py0 + 22, 4, 6, '#fffdf6');
  rect(g, px0 + 25, py0 + 21, 1, 6, '#e2404c');
  oval(g, px0 + 28, py0 + 20, 2.5, 2.5, '#f8c6a0');
  rect(g, px0 + 26, py0 + 16, 5, 2, '#f9cf3a');
  rect(g, px0 + 22, py0 + 23, 4, 1, '#3b3346');
  rect(g, px0 + 4, py0 + 30, 10, 1, '#e2404c');
  rect(g, px0 + 4, py0 + 32, 6, 1, '#e2404c');
  rect(g, px0 + 22, py0 - 2, 12, 4, 'rgba(220,220,210,0.8)');
  // Her bed (left): pink blanket, the pillow, the beanie with its sheep ears on it.
  rect(g, 10, 60, 8, 52, '#c86a8a');
  rect(g, 10, 60, 8, 2, '#e07ba5');
  rect(g, 18, 82, 104, 26, '#e07ba5');
  rect(g, 18, 80, 104, 4, '#f8b6cf');
  rect(g, 18, 106, 104, 6, '#b05a7a');
  for (let i = 0; i < 5; i++) line(g, 60 + i * 13, 84, 56 + i * 13, 104, '#c8689a');
  oval(g, 36, 76, 16, 8, '#f4ecf0');
  oval(g, 36, 74, 14, 6, '#fffaf2');
  // the beanie: knitted cream, two little sheep ears
  oval(g, 34, 70, 9, 6, (x, y) => ((x + y) % 3 === 0 ? '#e0d4c0' : '#ece2d0'));
  rect(g, 25, 70, 18, 3, '#d8ccb6');
  oval(g, 25, 66, 3, 2, '#ece2d0');
  oval(g, 43, 66, 3, 2, '#ece2d0');
  px(g, 25, 66, '#f8b6cf');
  px(g, 43, 66, '#f8b6cf');
  // Dodo, sitting against the pillow: the belly sewn back with crooked blue stitches.
  const dx = 70;
  const dy = 82;
  oval(g, dx, dy, 11, 9, (x, y) => (hash(x, y, 4) < 0.16 ? '#e4e0ec' : '#f4f0f8'));
  oval(g, dx - 8, dy - 9, 5, 5, '#f4f0f8');
  oval(g, dx + 8, dy - 9, 5, 5, '#f4f0f8');
  oval(g, dx, dy - 12, 8, 6, '#f4f0f8');
  oval(g, dx, dy - 9, 6, 4, '#9a94b0');
  px(g, dx - 3, dy - 10, '#0b0710');
  px(g, dx + 3, dy - 10, '#0b0710');
  rect(g, dx - 1, dy - 7, 2, 1, '#f8b6cf');
  // the seam: a zigzag of big blue stitches, not straight
  const seam: Array<[number, number]> = [
    [dx - 7, dy + 1],
    [dx - 4, dy - 1],
    [dx - 2, dy + 3],
    [dx + 1, dy],
    [dx + 3, dy + 4],
    [dx + 6, dy + 1],
    [dx + 8, dy + 4],
  ];
  for (let i = 0; i < seam.length - 1; i++) line(g, seam[i]![0], seam[i]![1], seam[i + 1]![0], seam[i + 1]![1], '#3b5bd0');
  for (const [sx, sy] of seam) px(g, sx, sy, '#2a3e9a');
  line(g, dx + 8, dy + 4, dx + 12, dy + 9, '#3b5bd0');
  // The nightstand and the nightlight, plugged in: its cord down the wall to the socket.
  rect(g, 126, 88, 28, 24, '#a8774f');
  rect(g, 126, 88, 28, 3, '#dcb488');
  rect(g, 126, 108, 28, 4, '#6e4a3a');
  rect(g, 132, 96, 16, 1, '#6e4a3a');
  moonLamp(g, VL.x, VL.y, true);
  line(g, VL.x + 6, VL.y + 2, VL.x + 18, VL.y + 4, '#e8e2f0');
  line(g, VL.x + 18, VL.y + 4, VL.x + 18, VL.y + 16, '#e8e2f0');
  rect(g, VL.x + 15, VL.y + 15, 8, 7, '#f4f0f6');
  rect(g, VL.x + 17, VL.y + 17, 1, 3, '#8a8098');
  rect(g, VL.x + 20, VL.y + 17, 1, 3, '#8a8098');
}

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const FINS_ILLUSTRATIONS: Record<string, (g: Ctx, t: number) => void> = {
  fin_beaux_reves: (g, t) => {
    g.drawImage(layer('fin_beaux_reves', paintBeauxReves), 0, 0);
    // The nightlight, perfectly steady.
    glow(g, 240, 80, 30, '#ffe991', 0.16);
    // He is awake: he blinks now and then, and breathes.
    if (t % 190 > 182) {
      rect(g, NOA.x - 4, NOA.y + 1, 2, 1, '#d8b8ac');
      rect(g, NOA.x + 2, NOA.y + 1, 2, 1, '#d8b8ac');
      rect(g, NOA.x - 4, NOA.y + 2, 2, 1, '#10101c');
      rect(g, NOA.x + 2, NOA.y + 2, 2, 1, '#10101c');
    }
    if (Math.sin(t * 0.04) > 0.3) {
      rect(g, NOA.x - 12, NOA.y + 8, 3, 1, '#6a5a9a');
      rect(g, NOA.x + 10, NOA.y + 8, 3, 1, '#4a3e74');
    }
    if (Math.floor(t / 50) % 4 === 0) px(g, 30, 22, '#ffffff');
  },
  fin_silence: (g, t) => {
    g.drawImage(layer('fin_silence', paintSilence), 0, 0);
    motes(g, t, 18, 21, 14, 30, 110, 150, '#ffffff');
  },
  fin_veilleuse: (g, t) => {
    g.drawImage(layer('fin_veilleuse', paintVeilleuse), 0, 0);
    glow(g, VL.x, VL.y - 7, 22 + Math.sin(t * 0.03) * 2, '#fff3a0', 0.2);
    motes(g, t, 14, 22, 150, 20, 300, 110, '#ffe8c0');
  },
};

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { ctx2d, drawSprite, makeCanvas } from '../../engine/sprite';
import { ILLUSTRATIONS } from '../../data/illustrations';
import { tr } from '../../i18n';
import { hasSpr, spr } from '../assets';
import { G } from '../state';
import { drawPoemPage, POEM_PAGE } from './poem';

/*
 * « Dessiner à deux » — the drawing game of chapter 5 (docs/HISTOIRE.md § 2.7 and § 3.13), on the poem's paper page.
 *
 * Two uses, one scene that stays on the stack while the story talks over it (dialogue is a global overlay):
 *
 * 1. The visit (`open('visite')`): « deux enfants sous une grande lune ». Noa's hand holds a blue ballpoint, a small
 *    hand holds a red crayon. Noa traces his strokes: holding A (or a finger on the screen) moves the pen along the
 *    dotted guide; the arrows (or the finger) pull it off the line — his own shaky drawing. She draws hers by herself.
 *      await dt.stroke('lune')           the moon; she colours it at the same time and the two pens cross on it
 *      await dt.watch('elle')          she draws herself, with a paper crown, holding out her hand
 *      const r = await dt.stroke('lui', { cough: 0.55 })
 *                                      Noa draws himself; at 55 % he coughs: the screen shakes, the pen skids, blue ink
 *                                      splashes the page and runs down it; the stroke stops there (r.coughed)
 *      await dt.shadow()               the nurse's shadow falls across the page (the story says her line over it)
 *      await dt.reveal()               the page dissolves into the chapter 2 souvenir (souvenir_dessin): the drawing
 *                                      stops exactly where chapter 2 found it
 *      dt.close()
 *
 * 2. The drawings to correct (`open('corriger', id)`, « Corriger les dessins »): one of the five drawings taped to the
 *    plastic sheets of the frozen lake — 'maman', 'nadia', 'mina', 'chaise' (the empty chair marked NOA), 'plage'.
 *      const done = await dt.correct()  Noa traces himself into it: a black ballpoint figure, too tall, with no face;
 *                                      a warm sound and stars when it is done. false if he puts the pen down (B) before
 *                                      the first line. The story counts them (c5_corrige) and gives the Étoiles.
 *
 * `result` keeps what happened: crossed (the pens met on the moon), coughed, corrected, wobble (how far Noa's hand
 * strayed from the guide, 0..1). Story mode (accessibility) lets the pen draw faster and stay closer to the line.
 */

export type DrawMode = 'visite' | 'corriger';
export type DrawingId = 'maman' | 'nadia' | 'mina' | 'chaise' | 'plage';
export type StrokeId = 'lune' | 'lui' | 'elle';

export interface DrawResult {
  crossed: boolean;
  coughed: boolean;
  corrected: boolean;
  wobble: number;
}

/** A polyline; `null` lifts the pen (it jumps to the next point without drawing). */
type Path = Array<[number, number] | null>;

const PEN_BLUE = '#2f3f9e';
const PEN_BLACK = '#14121c';
const CRAYON_RED = '#d8434e';
const INK = '#1d2470';

// ---------------------------------------------------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------------------------------------------------

function circle(cx: number, cy: number, r: number, a0 = -Math.PI / 2, turns = 1.04, n = 48): Path {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2 * turns;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number];
  });
}

/** A child figure (stick body): head, body, arms, legs. `tall` stretches it; `reach` is where the far hand goes. */
function figure(x: number, foot: number, size: number, reach?: [number, number]): Path {
  const head = size * 0.22;
  const hy = foot - size + head;
  const neck = hy + head;
  const hip = foot - size * 0.38;
  const sh = neck + size * 0.06;
  return [
    ...circle(x, hy, head, Math.PI / 2, 1.02, 22),
    null,
    [x, neck],
    [x, hip],
    null,
    [x, hip],
    [x - size * 0.13, foot],
    null,
    [x, hip],
    [x + size * 0.13, foot],
    null,
    [x, sh],
    [x - size * 0.2, sh + size * 0.18],
    null,
    [x, sh],
    reach ?? [x + size * 0.2, sh + size * 0.18],
  ];
}

/** A tall figure without a face, too tall for the drawing: long arms hanging to the knees. */
function tallFigure(x: number, foot: number, size: number): Path {
  const head = size * 0.12;
  const hy = foot - size + head;
  const sh = hy + head + size * 0.05;
  const hip = foot - size * 0.42;
  return [
    ...circle(x, hy, head, Math.PI / 2, 1.02, 22),
    null,
    [x, hy + head],
    [x, sh],
    [x - size * 0.13, sh + size * 0.02],
    [x - size * 0.13, hip],
    [x - size * 0.08, foot],
    null,
    [x, sh],
    [x + size * 0.13, sh + size * 0.02],
    [x + size * 0.13, hip],
    [x + size * 0.08, foot],
    null,
    [x - size * 0.13, sh + size * 0.02],
    [x - size * 0.2, hip + size * 0.12],
    null,
    [x + size * 0.13, sh + size * 0.02],
    [x + size * 0.2, hip + size * 0.12],
  ];
}

/** Zigzag hatching across a disc, from right to left (a child colouring a moon). */
function hatchDisc(cx: number, cy: number, r: number, x0: number, x1: number, step = 4): Path {
  const out: Path = [];
  let up = true;
  for (let x = x0; x >= x1; x -= step) {
    const dy = Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx))) * 0.9;
    out.push(up ? [x, cy - dy] : [x, cy + dy]);
    up = !up;
  }
  return out;
}

/** A small five-pointed star, as a closed polyline. */
function star(cx: number, cy: number, r: number): Path {
  return Array.from({ length: 11 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI * 4) / 5;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number];
  });
}

/** Points along a path, `step` px apart, with the pen lifts kept. */
interface Track {
  pts: Array<{ x: number; y: number; lift: boolean }>;
}
function track(path: Path, step = 1): Track {
  const pts: Track['pts'] = [];
  let prev: [number, number] | null = null;
  let lift = true;
  for (const p of path) {
    if (!p) {
      lift = true;
      continue;
    }
    if (!prev || lift) {
      pts.push({ x: p[0], y: p[1], lift: true });
    } else {
      const n = Math.max(1, Math.round(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / step));
      for (let i = 1; i <= n; i++) pts.push({ x: prev[0] + ((p[0] - prev[0]) * i) / n, y: prev[1] + ((p[1] - prev[1]) * i) / n, lift: false });
    }
    prev = p;
    lift = false;
  }
  return { pts };
}

// ---------------------------------------------------------------------------------------------------------------------
// Ink and crayon
// ---------------------------------------------------------------------------------------------------------------------

/** Small integer hash in [0, 1) (crayon grain, jitter). */
function hash(x: number, y: number, s = 0): number {
  let h = Math.imul((x | 0) ^ 0x3c6ef372, 0x85ebca6b) ^ Math.imul((y | 0) + 0x632be5ab + s * 977, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function penDot(g: CanvasRenderingContext2D, x: number, y: number, color: string, heavy = false): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
  if (heavy) g.fillRect(Math.round(x) + 1, Math.round(y), 1, 1);
}

function crayonDot(g: CanvasRenderingContext2D, x: number, y: number, color: string, seed = 0): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  g.fillStyle = color;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (hash(rx + dx, ry + dy, seed) > 0.22) g.fillRect(rx + dx, ry + dy, 1, 1);
}

/** Draws a whole path at once (the drawings already on the page). */
function crayonPath(g: CanvasRenderingContext2D, path: Path, color: string, seed = 0): void {
  for (const p of track(path).pts) crayonDot(g, p.x + (hash(p.x | 0, p.y | 0, seed) - 0.5) * 0.8, p.y, color, seed);
}

/** Scribbled fill inside a predicate (a child colouring past the lines a little). */
function crayonFill(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, inside: (x: number, y: number) => boolean, color: string, seed = 0): void {
  g.fillStyle = color;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (!inside(x, y)) continue;
      // Diagonal strokes with gaps.
      const band = (x + y * 2 + Math.round(hash(y, 0, seed) * 3)) % 4;
      if (band === 3 || hash(x, y, seed) < 0.18) continue;
      g.fillRect(x, y, 1, 1);
    }
}

/** A child's capitals: each letter a little off its line. */
function crayonText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, seed = 0): void {
  let cx = x;
  [...text].forEach((ch, i) => {
    const dy = Math.round((hash(i, 0, seed) - 0.5) * 3);
    drawText(g, ch, cx, y + dy, { color });
    drawText(g, ch, cx + 1, y + dy, { color });
    cx += measure(ch) + 2;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The five drawings of the frozen lake (Mina's, in crayon). Each leaves room for Noa.
// ---------------------------------------------------------------------------------------------------------------------

interface Drawing {
  /** Foot of Noa's tall figure (x, y). */
  slot: [number, number];
  paint: (g: CanvasRenderingContext2D) => void;
}

const DRAWINGS: Record<DrawingId, Drawing> = {
  // Maman asleep in the parents' armchair, « Z z z ».
  maman: {
    slot: [232, 156],
    paint(g) {
      crayonFill(g, 104, 96, 196, 146, (x, y) => (x < 116 || x > 184 || y > 124) && y < 146, '#a8774f', 1);
      crayonPath(g, [[104, 96], [104, 146], [196, 146], [196, 96], [184, 96], [184, 124], [116, 124], [116, 96], [104, 96]], '#6e4a3a', 2);
      crayonFill(g, 132, 92, 170, 126, (x, y) => (x - 151) ** 2 / 340 + (y - 110) ** 2 / 260 < 1, '#6d8fd6', 3);
      crayonPath(g, circle(150, 82, 10), '#c98572', 4);
      crayonFill(g, 140, 70, 162, 98, (x, y) => (x - 150) ** 2 + (y - 80) ** 2 < 110 && (y < 78 || x < 143 || x > 157), '#3f3d63', 5);
      crayonPath(g, [[145, 84], [148, 84], null, [152, 84], [155, 84], null, [147, 89], [153, 89]], '#3f3d63', 6);
      crayonText(g, 'z', 168, 66, '#7d6f86', 7);
      crayonText(g, 'Z', 176, 56, '#7d6f86', 8);
      crayonText(g, 'Z', 186, 44, '#7d6f86', 9);
      crayonText(g, tr('MAMAN'), 58, 26, CRAYON_RED, 10);
    },
  },
  // Nadia, the night nurse: her cap with a red cross, a little lamp, a star.
  nadia: {
    slot: [222, 156],
    paint(g) {
      crayonFill(g, 96, 84, 140, 150, (x, y) => Math.abs(x - 118) < 8 + (y - 84) * 0.22 && y > 84, '#a7c7f0', 11);
      crayonPath(g, [[110, 84], [96, 150], [140, 150], [126, 84]], '#6d8fd6', 12);
      crayonPath(g, circle(118, 74, 10), '#c98572', 13);
      crayonPath(g, [[108, 64], [128, 64], [126, 58], [110, 58], [108, 64]], '#b7aab8', 14);
      crayonPath(g, [[118, 59], [118, 63], null, [116, 61], [120, 61]], CRAYON_RED, 15);
      crayonPath(g, [[114, 76], [116, 76], null, [120, 76], [122, 76], null, [114, 80], [118, 82], [122, 80]], '#3f3d63', 16);
      crayonPath(g, [[126, 96], [150, 104]], '#c98572', 17);
      crayonFill(g, 146, 98, 160, 112, (x, y) => (x - 153) ** 2 + (y - 105) ** 2 < 36, '#ffd84a', 18);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        crayonPath(g, [[153 + Math.cos(a) * 9, 105 + Math.sin(a) * 9], [153 + Math.cos(a) * 14, 105 + Math.sin(a) * 14]], '#f5c04f', 19 + k);
      }
      crayonPath(g, star(78, 44, 8), '#f5c04f', 26);
      crayonText(g, 'NADIA', 58, 26, CRAYON_RED, 27);
    },
  },
  // Mina in her bed, the hat with sheep ears, Dodo beside her.
  mina: {
    slot: [236, 156],
    paint(g) {
      crayonFill(g, 70, 112, 200, 140, (_x, y) => y > 112 && y < 140, '#a7c7f0', 31);
      crayonPath(g, [[66, 104], [66, 150], null, [204, 116], [204, 150], null, [66, 140], [204, 140]], '#7d6f86', 32);
      crayonPath(g, circle(92, 104, 10), '#c98572', 33);
      crayonFill(g, 80, 88, 104, 102, (x, y) => (x - 92) ** 2 + (y - 100) ** 2 < 120 && y < 100, '#ece2df', 34);
      crayonPath(g, circle(81, 92, 4, 0, 1, 12), '#b7aab8', 35);
      crayonPath(g, circle(103, 92, 4, 0, 1, 12), '#b7aab8', 36);
      crayonPath(g, [[88, 106], [90, 106], null, [94, 106], [96, 106], null, [89, 110], [92, 112], [95, 110]], '#3f3d63', 37);
      crayonFill(g, 130, 92, 168, 116, (x, y) => (x - 149) ** 2 / 300 + (y - 104) ** 2 / 110 < 1, '#fffaf2', 38);
      crayonPath(g, circle(149, 104, 15, 0, 1, 30), '#b7aab8', 39);
      crayonFill(g, 158, 96, 172, 110, (x, y) => (x - 165) ** 2 + (y - 103) ** 2 < 36, '#3f3d63', 40);
      crayonText(g, tr('MOI ET DODO'), 58, 26, CRAYON_RED, 41);
    },
  },
  // An empty chair. Above it, an arrow and NOA.
  chaise: {
    slot: [160, 156],
    paint(g) {
      crayonPath(g, [[144, 150], [144, 112], [176, 112], [176, 150], null, [144, 124], [176, 124], null, [176, 112], [176, 80], null, [144, 112], [144, 80], null, [144, 86], [176, 86]], '#a8774f', 51);
      crayonFill(g, 145, 113, 176, 124, (_x, y) => y > 112 && y < 124, '#c98572', 52);
      crayonText(g, 'NOA', 148, 46, CRAYON_RED, 53);
      crayonPath(g, [[160, 58], [160, 74], null, [155, 69], [160, 75], [165, 69]], CRAYON_RED, 54);
      for (const [hx, hy] of [[110, 70], [212, 64], [204, 120]] as const) crayonPath(g, [[hx, hy + 3], [hx - 4, hy - 1], [hx - 2, hy - 3], [hx, hy - 1], [hx + 2, hy - 3], [hx + 4, hy - 1], [hx, hy + 3]], '#e07ba5', hx);
    },
  },
  // The beach of before: the sun, the sea, a castle, Mina with her bucket. A space in the sand.
  plage: {
    slot: [226, 156],
    paint(g) {
      crayonFill(g, 33, 112, 288, 168, (x, y) => y > 112 + Math.sin(x * 0.05) * 2, '#f5c04f', 61);
      crayonPath(g, Array.from({ length: 27 }, (_, i) => [34 + i * 10, 104 + Math.sin(i) * 2] as [number, number]), '#5aa8ff', 62);
      crayonFill(g, 250, 22, 280, 52, (x, y) => (x - 265) ** 2 + (y - 37) ** 2 < 140, '#ffd84a', 63);
      crayonPath(g, [[86, 140], [86, 120], [92, 120], [92, 116], [98, 116], [98, 120], [104, 120], [104, 140], [86, 140]], '#c46a2e', 64);
      crayonPath(g, figure(140, 150, 40), '#e0834f', 65);
      crayonPath(g, [[150, 132], [156, 132], [155, 140], [151, 140], [150, 132]], CRAYON_RED, 66);
      crayonText(g, tr('LA PLAGE'), 58, 26, CRAYON_RED, 67);
    },
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Strokes of the visit
// ---------------------------------------------------------------------------------------------------------------------

const MOON: [number, number, number] = [206, 54, 30];

const STROKES: Record<StrokeId, { path: Path; who: 'noa' | 'elle'; speed: number }> = {
  lune: { path: circle(MOON[0], MOON[1], MOON[2], -Math.PI / 2, 1.04, 56), who: 'noa', speed: 0.85 },
  lui: { path: figure(120, 140, 48, [148, 114]), who: 'noa', speed: 0.8 },
  elle: {
    path: [
      // Herself, with a paper crown, holding out her hand toward where his will be.
      ...figure(160, 140, 42, [142, 114]),
      null,
      [151, 98],
      [153, 91],
      [156, 96],
      [160, 90],
      [164, 96],
      [167, 91],
      [169, 98],
      // Three stars round the moon.
      null,
      ...star(158, 30, 6),
      null,
      ...star(258, 24, 5),
      null,
      ...star(262, 92, 5),
    ],
    who: 'elle',
    speed: 1.1,
  },
};

/** While Noa draws the moon, she colours it from the right; their pens meet on its right half. */
const MOON_COLOURING: Path = hatchDisc(MOON[0], MOON[1], MOON[2] - 2, MOON[0] + MOON[2] - 4, MOON[0] - 2, 3);

// ---------------------------------------------------------------------------------------------------------------------
// The nurse's shadow
// ---------------------------------------------------------------------------------------------------------------------

let shadowCanvas: HTMLCanvasElement | null = null;
function nurseShadow(): HTMLCanvasElement {
  if (shadowCanvas) return shadowCanvas;
  const c = makeCanvas(W, H);
  const g = ctx2d(c);
  g.fillStyle = '#0b0710';
  const inside = (x: number, y: number): boolean => {
    const head = ((x - 236) / 21) ** 2 + ((y - 72) / 25) ** 2 < 1;
    const cap = y > 38 && y < 52 && x > 218 - (y - 38) * 0.3 && x < 254 + (y - 38) * 0.3;
    const neck = y > 90 && y < 108 && Math.abs(x - 236) < 10;
    const body = ((x - 240) / 78) ** 2 + ((y - 196) / 92) ** 2 < 1;
    return head || cap || neck || body;
  };
  for (let y = 0; y < H; y++)
    for (let x = 120; x < W; x++) {
      if (!inside(x, y)) continue;
      // A soft, dithered edge.
      const edge = !inside(x - 3, y) || !inside(x + 3, y) || !inside(x, y - 3) || !inside(x, y + 3);
      if (edge && (x + y) % 2) continue;
      g.fillRect(x, y, 1, 1);
    }
  shadowCanvas = c;
  return c;
}

// ---------------------------------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------------------------------

interface Drip {
  x: number;
  y: number;
  len: number;
  max: number;
  speed: number;
}

interface Tracing {
  tr: Track;
  /** Index of the next point to reach. */
  i: number;
  who: 'noa' | 'elle';
  color: string;
  heavy: boolean;
  speed: number;
  auto: boolean;
  /** Progress (0..1) at which Noa coughs, if any. */
  cough: number;
  resolve: () => void;
  /** Off-the-line pull of Noa's hand. */
  ox: number;
  oy: number;
  stray: number;
  steps: number;
  started: boolean;
  cancellable: boolean;
  cancelled: boolean;
  /** The A press that closed the last line does not start drawing: the pen waits for A to be let go first. */
  armed: boolean;
}

export class DrawTogetherScene implements Scene {
  private t = 0;
  private readonly ink: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private tracing: Tracing | null = null;
  /** Her crayon colouring the moon while Noa draws it. */
  private colouring: { tr: Track; i: number } | null = null;
  private penNoa: { x: number; y: number } | null = null;
  private penElle: { x: number; y: number } | null = null;
  private drips: Drip[] = [];
  private sparks: Array<{ x: number; y: number; vy: number; life: number; color: string; heart: boolean }> = [];
  private stain = false;
  private shadowT = -1;
  private shadowOn = false;
  private revealT = -1;
  private revealImg: HTMLCanvasElement | null = null;
  private closing = false;
  readonly result: DrawResult = { crossed: false, coughed: false, corrected: false, wobble: 0 };

  private constructor(
    readonly mode: DrawMode,
    readonly drawing: DrawingId | null,
  ) {
    this.ink = makeCanvas(W, H);
    this.g = ctx2d(this.ink);
    if (drawing) DRAWINGS[drawing].paint(this.g);
  }

  /** Pushes the page (blank for the visit; one of the drawings to correct) and returns the scene. */
  static open(mode: DrawMode, drawing: DrawingId = 'maman'): DrawTogetherScene {
    const s = new DrawTogetherScene(mode, mode === 'corriger' ? drawing : null);
    game.push(s);
    audio.sfx('pop', { pitch: 0.7 });
    return s;
  }

  /** The five drawings of the lake, in the order they hang along the shore. */
  static readonly DRAWINGS: DrawingId[] = ['maman', 'nadia', 'mina', 'chaise', 'plage'];

  close(): void {
    this.closing = true;
    game.remove(this);
    input.consume();
  }

  /** Noa traces one of his strokes ('lune' or 'lui'). `cough`: progress (0..1) at which he coughs and stops. */
  stroke(id: 'lune' | 'lui', opts: { cough?: number } = {}): Promise<DrawResult> {
    if (id === 'lune') this.colouring = { tr: track(MOON_COLOURING), i: 0 };
    return this.runTrace(STROKES[id].path, { who: 'noa', color: PEN_BLUE, speed: STROKES[id].speed, cough: opts.cough ?? 2 }).then(() => this.result);
  }

  /** She draws her stroke by herself ('elle'); Noa watches. */
  watch(id: 'elle' = 'elle'): Promise<void> {
    return this.runTrace(STROKES[id].path, { who: 'elle', color: CRAYON_RED, speed: STROKES[id].speed, auto: true });
  }

  /** « Corriger » mode: Noa draws himself into the drawing. Resolves false if he puts the pen down (B) first. */
  async correct(): Promise<boolean> {
    const [x, foot] = DRAWINGS[this.drawing ?? 'maman'].slot;
    await this.runTrace(tallFigure(x, foot, 84), { who: 'noa', color: PEN_BLACK, heavy: true, speed: 1, cancellable: true });
    if (this.lastCancelled) return false;
    this.result.corrected = true;
    // He lifts his hand: the figure is there, in the drawing, for good.
    this.penNoa = null;
    audio.sfx('chime', { pitch: 1.1, vol: 0.6 });
    window.setTimeout(() => audio.sfx('heal', { vol: 0.5 }), 160);
    for (let k = 0; k < 10; k++) this.sparks.push({ x: x + (k - 5) * 5, y: foot - 40 - (k % 3) * 10, vy: -0.4 - (k % 4) * 0.1, life: 70 + k * 3, color: '#ffd84a', heart: false });
    await game.wait(50);
    return true;
  }

  /** The nurse's shadow falls over the page (or lifts again with `on = false`). */
  async shadow(on = true): Promise<void> {
    this.shadowOn = on;
    if (on && this.shadowT < 0) this.shadowT = 0;
    if (on) {
      audio.sfx('door', { pitch: 0.8, vol: 0.4 });
      await game.until(() => this.shadowT >= 70);
    } else await game.until(() => this.shadowT <= 0);
  }

  /** The page dissolves into an illustration (by default the chapter 2 souvenir of the unfinished drawing). */
  async reveal(key = 'souvenir_dessin'): Promise<void> {
    const illus = ILLUSTRATIONS[key];
    if (!illus) return;
    const c = makeCanvas(W, H);
    illus(ctx2d(c), 0);
    this.revealImg = c;
    this.revealT = 0;
    await game.until(() => this.revealT >= 90);
  }

  private lastCancelled = false;

  private runTrace(
    path: Path,
    o: { who: 'noa' | 'elle'; color: string; speed: number; heavy?: boolean; auto?: boolean; cough?: number; cancellable?: boolean },
  ): Promise<void> {
    this.lastCancelled = false;
    return new Promise((resolve) => {
      const tr0 = track(path);
      const first = tr0.pts[0]!;
      if (o.who === 'noa') this.penNoa = { x: first.x, y: first.y };
      else this.penElle = { x: first.x, y: first.y };
      this.tracing = {
        tr: tr0,
        i: 0,
        who: o.who,
        color: o.color,
        heavy: !!o.heavy,
        speed: o.speed,
        auto: !!o.auto,
        cough: o.cough ?? 2,
        resolve,
        ox: 0,
        oy: 0,
        stray: 0,
        steps: 0,
        started: false,
        cancellable: !!o.cancellable,
        cancelled: false,
        armed: !!o.auto || !this.pressing,
      };
    });
  }

  /** Noa's hand is drawing: A held, or a finger on the screen. */
  private get pressing(): boolean {
    return input.down('a') || input.drag.active;
  }

  update(): void {
    if (this.closing) return;
    this.t++;
    const tc = this.tracing;
    if (tc) this.updateTrace(tc);
    if (this.colouring && tc && tc.who === 'noa') this.updateColouring(tc);
    this.updateDrips();
    for (const s of this.sparks) {
      s.y += s.vy;
      s.life--;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    if (this.shadowT >= 0) this.shadowT = Math.max(0, Math.min(70, this.shadowT + (this.shadowOn ? 1 : -2)));
    if (this.revealT >= 0 && this.revealT < 90) this.revealT++;
  }

  private updateTrace(tc: Tracing): void {
    const pts = tc.tr.pts;
    if (tc.cancellable && !tc.started && input.pressed('b')) {
      tc.cancelled = true;
      this.lastCancelled = true;
      this.tracing = null;
      audio.sfx('cancel');
      tc.resolve();
      return;
    }
    if (!tc.armed) {
      if (this.pressing) return;
      tc.armed = true;
    }
    const drawing = tc.auto || this.pressing;
    const pen = tc.who === 'noa' ? this.penNoa! : this.penElle!;
    if (!drawing) {
      // Lifted: the hand rests where it is (the pull of the arrows relaxes).
      tc.ox *= 0.9;
      tc.oy *= 0.9;
      return;
    }
    tc.started = true;
    // Noa's hand: the arrows (or the finger) pull it off the line; it trembles a little; it comes back slowly.
    if (tc.who === 'noa') {
      const ax = input.axis();
      const pull = G.settings.storyMode ? 0.25 : 0.5;
      tc.ox = (tc.ox + ax.x * pull + input.drag.dx * pull * 0.8) * 0.94;
      tc.oy = (tc.oy + ax.y * pull + input.drag.dy * pull * 0.8) * 0.94;
      tc.ox = Math.max(-9, Math.min(9, tc.ox));
      tc.oy = Math.max(-9, Math.min(9, tc.oy));
    }
    // Story mode (accessibility): the pen goes faster.
    let budget = tc.speed * (G.settings.storyMode && !tc.auto ? 1.5 : 1);
    while (budget > 0 && tc.i < pts.length) {
      const p = pts[tc.i]!;
      const tremble = tc.who === 'noa' ? Math.sin(this.t * 0.7 + tc.i) * 0.45 : 0;
      const tx = p.x + tc.ox + tremble;
      const ty = p.y + tc.oy;
      if (p.lift) {
        pen.x = tx;
        pen.y = ty;
        tc.i++;
        continue;
      }
      const d = Math.hypot(tx - pen.x, ty - pen.y);
      const step = Math.min(d, budget);
      const nx = d > 0 ? pen.x + ((tx - pen.x) * step) / d : tx;
      const ny = d > 0 ? pen.y + ((ty - pen.y) * step) / d : ty;
      this.lay(pen.x, pen.y, nx, ny, tc);
      pen.x = nx;
      pen.y = ny;
      budget -= Math.max(step, 0.05);
      if (step >= d) tc.i++;
    }
    tc.stray += Math.hypot(tc.ox, tc.oy);
    tc.steps++;
    if (this.t % 7 === 0) audio.sfx('write', { pitch: tc.who === 'noa' ? 0.75 : 1.3, vol: 0.35 });
    const progress = tc.i / pts.length;
    if (tc.who === 'noa' && progress >= tc.cough) {
      this.cough(tc);
      return;
    }
    if (tc.i >= pts.length) this.finishTrace(tc);
  }

  private lay(x0: number, y0: number, x1: number, y1: number, tc: Tracing): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      if (tc.who === 'elle') crayonDot(this.g, x, y, tc.color, 7);
      else penDot(this.g, x, y, tc.color, tc.heavy);
    }
  }

  private finishTrace(tc: Tracing): void {
    if (tc.who === 'noa') this.result.wobble = Math.min(1, tc.stray / Math.max(1, tc.steps) / 9);
    this.tracing = null;
    this.colouring = null;
    tc.resolve();
  }

  /** Her crayon colours the moon, ahead of his pen; when they meet, a small chime and a heart. */
  private updateColouring(tc: Tracing): void {
    const c = this.colouring!;
    const progress = tc.i / tc.tr.pts.length;
    const target = Math.floor(Math.max(0, Math.min(1, (progress - 0.06) / 0.5)) * c.tr.pts.length);
    if (!this.penElle) this.penElle = { x: c.tr.pts[0]!.x, y: c.tr.pts[0]!.y };
    let moved = 0;
    while (c.i < target && moved < 3) {
      const p = c.tr.pts[c.i]!;
      if (!p.lift) {
        this.lay(this.penElle.x, this.penElle.y, p.x, p.y, { ...tc, who: 'elle', color: CRAYON_RED, heavy: false });
        moved++;
      }
      this.penElle.x = p.x;
      this.penElle.y = p.y;
      c.i++;
    }
    const n = this.penNoa;
    if (n && !this.result.crossed && Math.hypot(n.x - this.penElle.x, n.y - this.penElle.y) < 9) {
      this.result.crossed = true;
      audio.sfx('chime', { pitch: 1.5, vol: 0.5 });
      this.sparks.push({ x: (n.x + this.penElle.x) / 2, y: (n.y + this.penElle.y) / 2 - 4, vy: -0.35, life: 80, color: '#f8b6cf', heart: true });
    }
  }

  /** Noa coughs: the screen shakes, the pen skids, ink splashes the page and runs down it. The stroke stops. */
  private cough(tc: Tracing): void {
    this.result.coughed = true;
    this.tracing = null;
    this.stain = true;
    audio.sfx('cough');
    window.setTimeout(() => audio.sfx('cough', { pitch: 0.9, vol: 0.8 }), 420);
    fx.shake(4, 26);
    const pen = this.penNoa!;
    // The skid: a long jagged line where the hand jumped.
    let x = pen.x;
    let y = pen.y;
    for (let k = 0; k < 34; k++) {
      const nx = x + 1.1 + Math.sin(k * 1.7) * 0.8;
      const ny = y + 0.9 + Math.cos(k * 2.3) * 0.7;
      this.lay(x, y, nx, ny, { ...tc, heavy: true });
      x = nx;
      y = ny;
    }
    // Blots and spray, then drips that run.
    const g = this.g;
    const blots: Array<[number, number, number]> = [
      [pen.x + 6, pen.y + 4, 6],
      [pen.x + 22, pen.y - 6, 4],
      [pen.x - 10, pen.y + 14, 3],
      [pen.x + 30, pen.y + 22, 5],
    ];
    for (const [bx, by, r] of blots) {
      g.fillStyle = INK;
      for (let yy = -r - 1; yy <= r + 1; yy++)
        for (let xx = -r - 1; xx <= r + 1; xx++) {
          const d = Math.hypot(xx, yy);
          if (d < r - 0.5 || (d < r + 1 && hash(bx + xx, by + yy, 3) > 0.5)) g.fillRect(Math.round(bx + xx), Math.round(by + yy), 1, 1);
        }
      for (let k = 0; k < r * 4; k++) {
        const a = hash(k, bx | 0, 4) * Math.PI * 2;
        const d = r + 2 + hash(k, by | 0, 5) * r * 2.2;
        g.fillRect(Math.round(bx + Math.cos(a) * d), Math.round(by + Math.sin(a) * d), 1, 1);
      }
      this.drips.push({ x: Math.round(bx + (hash(bx | 0, 1, 6) - 0.5) * r), y: Math.round(by + r - 1), len: 0, max: 10 + Math.round(hash(by | 0, 2, 7) * 34), speed: 0.25 + hash(r, 3, 8) * 0.3 });
    }
    window.setTimeout(() => tc.resolve(), 900);
  }

  private updateDrips(): void {
    for (const d of this.drips) {
      if (d.len >= d.max) continue;
      const before = Math.floor(d.len);
      d.len = Math.min(d.max, d.len + d.speed);
      this.g.fillStyle = INK;
      for (let k = before; k <= Math.floor(d.len); k++) this.g.fillRect(d.x + (k > 18 && k % 9 === 0 ? 1 : 0), d.y + k, 1, 1);
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    drawPoemPage(g);
    g.drawImage(this.ink, 0, 0);
    const tc = this.tracing;
    // The dotted guide of the stroke being drawn (only what is left to draw).
    if (tc && tc.who === 'noa') {
      g.fillStyle = tc.color === PEN_BLACK ? '#8a7f96' : '#a7b4e0';
      const pts = tc.tr.pts;
      for (let k = tc.i; k < pts.length; k += 3) if (!pts[k]!.lift && Math.floor(this.t / 20 + k / 9) % 4 !== 0) g.fillRect(Math.round(pts[k]!.x), Math.round(pts[k]!.y), 1, 1);
      if (!tc.started) {
        const hint = input.lastDevice === 'touch' ? 'Garde le doigt posé pour dessiner.' : 'Maintiens A pour dessiner.';
        drawText(g, tr(hint), W / 2, POEM_PAGE.y + POEM_PAGE.h - 12, { align: 'center', color: '#8a7f96' });
      }
    }
    for (const s of this.sparks) {
      g.globalAlpha = Math.min(1, s.life / 30);
      g.fillStyle = s.color;
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      if (s.heart) {
        g.fillRect(x - 2, y - 1, 2, 2);
        g.fillRect(x + 1, y - 1, 2, 2);
        g.fillRect(x - 2, y, 5, 2);
        g.fillRect(x - 1, y + 2, 3, 1);
        g.fillRect(x, y + 3, 1, 1);
      } else {
        g.fillRect(x, y - 1, 1, 3);
        g.fillRect(x - 1, y, 3, 1);
      }
    }
    g.globalAlpha = 1;
    // The hands: hers with the red crayon, his with the pen (an ink stain on the sleeve after the cough).
    // (Sprites drawn twice their size; the tip of the pen / crayon sits on the line being drawn.)
    const big = { scaleX: 2, scaleY: 2 };
    if (this.penElle && hasSpr('dt_main_petite') && (this.colouring || tc?.who === 'elle')) drawSprite(g, spr('dt_main_petite'), this.penElle.x - 4, this.penElle.y + 16, big);
    if (this.penNoa && hasSpr('dt_main_noa') && this.revealT < 0) {
      const nx = this.penNoa.x - 6;
      const ny = this.penNoa.y + 22;
      drawSprite(g, spr('dt_main_noa'), nx, ny, big);
      if (this.stain) {
        // The cough left ink on his sleeve. Only there.
        g.fillStyle = INK;
        g.fillRect(nx - 8, ny - 16, 7, 5);
        g.fillRect(nx - 6, ny - 18, 3, 9);
        g.fillRect(nx - 2, ny - 12, 2, 2);
      }
    }
    if (this.shadowT > 0) {
      const k = this.shadowT / 70;
      g.globalAlpha = 0.62 * k;
      g.drawImage(nurseShadow(), Math.round((1 - k) * 90), 0);
      g.globalAlpha = 1;
    }
    if (this.revealImg && this.revealT >= 0) {
      g.globalAlpha = Math.min(1, this.revealT / 90);
      g.drawImage(this.revealImg, 0, 0);
      g.globalAlpha = 1;
    }
  }
}

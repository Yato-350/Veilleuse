import type { SpriteDef } from '../../game/assets';
import { PAL, mix } from '../../engine/palette';
import { parseRows } from '../../engine/sprite';

/*
 * VEILLEUSE — tile art (16×16). Keys: `t_<id>` (+ `_1`, `_2`… variants / animation frames).
 *
 * Conventions
 * - Light comes from the top-left. Every texture tiles seamlessly: patches either wrap around the tile or
 *   stay inside it, and features that cross a tile border are shared by all variants of that tile.
 * - Wall system (OMORI-like, seen from the front):
 *     `*_wall_top`  very dark, no direction, so it also works for side and bottom borders;
 *     `*_wall`      upper face — its first rows carry the light rim of the wall top;
 *     `*_wall_base` lower face with the baseboard; the floor starts below.
 *   Doors (`*_door_top` in the wall row, `*_door` in the base row) and windows (wall row) are wall-neutral:
 *   their frames cover the whole width, so they fit any wallpaper of the same world.
 *   The dream wall `wall_d` has no base tile: it carries a small baseboard that reads as a chair rail when
 *   two rows are stacked (the round door `door_d_top`/`door_d` needs two rows).
 * - Real-world tiles are authored dark and desaturated (they are NOT realified); a few dimmed pastels are
 *   derived from the palette with `dim()`.
 * - The `@ink` variant of every tile is generated automatically (chapter 3).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const N = 16;
type Grid = string[][];
type Patch = [patch: string, x: number, y: number];

const grid = (src: string): Grid => parseRows(src).map((r) => [...r]);
const art = (g: Grid): string => g.map((r) => r.join('')).join('\n');
const flat = (c: string): string => Array.from({ length: N }, () => c.repeat(N)).join('\n');
const wrap = (v: number): number => ((v % N) + N) % N;

/** Draws patches onto a copy of `base`. '.' is transparent; coordinates wrap around so textures stay seamless. */
function stamp(base: string, ...items: Patch[]): string {
  const g = grid(base);
  for (const [patch, x, y] of items) {
    parseRows(patch).forEach((row, py) => {
      [...row].forEach((ch, px) => {
        if (ch !== '.') g[wrap(y + py)]![wrap(x + px)] = ch;
      });
    });
  }
  return art(g);
}

/** Replaces characters (recolouring). */
const swap = (src: string, map: Record<string, string>): string => [...src].map((ch) => map[ch] ?? ch).join('');

/** Builds a tile from a per-pixel function. */
const paint = (fn: (x: number, y: number) => string): string =>
  Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => fn(x, y)).join('')).join('\n');

/** Deterministic per-pixel noise in [0, 1). */
const noise = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Darkens a palette colour towards the night (used for real-world pastels). */
const NIGHT = '#22243a';
const dim = (c: string, t: number): string => mix(PAL[c]!, NIGHT, t);

/**
 * Floorboards. `size` = board thickness (its last row/col is the seam). One butt joint per board
 * (-1 = none in this tile), optional highlight on the 3 px after the joint, grain dashes `[x, y, len]`.
 */
function boards(o: {
  size: number;
  joints: number[];
  body: string[];
  seam: string;
  light?: string;
  grain?: Array<[number, number, number]>;
  grainColor: string;
  vertical?: boolean;
}): string {
  const g = paint((x, y) => {
    const [u, v] = o.vertical ? [y, x] : [x, y]; // u = along the board, v = across
    const b = Math.floor(v / o.size);
    const r = v % o.size;
    const j = o.joints[b % o.joints.length]!;
    if (r === o.size - 1 || u === j) return o.seam;
    if (o.light && j >= 0 && r === 0 && u > j && u <= j + 3) return o.light;
    return o.body[b % o.body.length]!;
  });
  const dash = (len: number) => (o.vertical ? Array(len).fill(o.grainColor).join('\n') : o.grainColor.repeat(len));
  return stamp(g, ...(o.grain ?? []).map(([x, y, len]): Patch => [dash(len), x, y]));
}

// ---------------------------------------------------------------------------
// Local colours
// ---------------------------------------------------------------------------

/** Mina's room in the real world: tarnished pastels. */
const MINA_COLORS = {
  '6': dim('p', 0.6), // wallpaper
  '7': dim('p', 0.7), // wallpaper shade / stains
  '8': dim('y', 0.45), // star
  '9': dim('q', 0.42), // pale star, sign paper
  D: dim('v', 0.6), // carpet
  F: dim('v', 0.7), // carpet shade
  X: dim('v', 0.5), // carpet loops
  I: dim('B', 0.3), // crayon blue
  N: dim('e', 0.25), // crayon green
  T: dim('P', 0.25), // crayon pink
  U: dim('p', 0.3), // sticker pink
};

/** Paper hospital: pale green-grey lino and mint paint. */
const HOSP_COLORS = {
  '6': '#b5c4b1', // lino
  '7': '#98aa98', // lino shade
  '8': '#76897c', // seams, metal
  '9': '#d6dece', // light paint
  D: '#8fb19b', // wainscot
  F: '#6f927d', // wainscot shade
  I: '#4f6d5c', // baseboard
};

const VOID_BLACK = { '6': '#0a0b12' }; // = real-world background, so the void merges with the screen

const withColors = (a: string, colors: Record<string, string>): SpriteDef => ({ art: a, colors });

// ---------------------------------------------------------------------------
// Real world — floors
// ---------------------------------------------------------------------------

/** Dark parquet: boards running away from the viewer (like the houses of OMORI), soft grain. */
const rFloor = (joints: number[], body: string[], grain: Array<[number, number, number]>) =>
  boards({ size: 4, joints, body, seam: 'z', light: 'J', grain, grainColor: '5', vertical: true });

const R_FLOOR_1 = rFloor([5, -1, 12, -1], ['j'], [[1, 9, 3], [5, 2, 2], [9, 7, 3], [13, 12, 2]]);
const R_FLOOR_2 = rFloor([-1, 10, -1, 2], ['j', 'j', '5', 'j'], [[2, 1, 3], [6, 12, 2], [13, 7, 3]]);
const R_FLOOR_3 = rFloor([13, -1, 6, -1], ['j', '5', 'j', 'j'], [[1, 3, 2], [9, 11, 3], [14, 1, 2]]);

/** Woven carpet loops: a regular dot lattice shifted every two rows, a few darker specks. */
const carpet = (base: string, loop: string, dark: string, specks: Array<[number, number]>) =>
  stamp(
    paint((x, y) => ((x + (Math.floor(y / 2) % 2) * 2) % 4 === 0 && y % 2 === 0 ? loop : base)),
    ...specks.map(([x, y]): Patch => [dark, x, y]),
  );

const R_CARPET_1 = carpet('2', 'J', 'j', [[3, 3], [10, 7], [6, 12], [14, 14]]);
const R_CARPET_2 = carpet('2', 'J', 'j', [[12, 1], [1, 7], [8, 10], [5, 15]]);

/** Kitchen / bathroom checker (8×8 tiles with bevel and grout), kept low-contrast for the night. */
const R_TILE = paint((x, y) => {
  const lx = x % 8;
  const ly = y % 8;
  const light = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
  if (lx === 7 || ly === 7) return 'z';
  if (lx === 0 || ly === 0) return light ? '3' : '2';
  return light ? '1' : 'j';
});
const R_TILE_2 = stamp(R_TILE, ['5.\n.5\n.5', 11, 2]);

const R_FLOOR_MINA_1 = carpet('D', 'X', 'F', [[2, 5], [11, 2], [7, 13]]);
const R_FLOOR_MINA_2 = carpet('D', 'X', 'F', [[13, 9], [4, 1], [9, 6]]);

// ---------------------------------------------------------------------------
// Real world — walls
// ---------------------------------------------------------------------------

/** Discreet wallpaper of the flat: a staggered lattice of tiny motifs. `y` counts from the top of the face. */
const rPaper = (x: number, y: number): string => {
  const lx = x % 8;
  const ly = y % 8;
  if ((lx === 2 && ly === 2) || (lx === 6 && ly === 6)) return '1';
  if ((lx === 2 && (ly === 1 || ly === 3)) || (lx === 6 && (ly === 5 || ly === 7))) return 'J';
  return '2';
};
/** Rim of the wall top + crown shadow (rows 0–2 of every real-world upper face). */
const RIM: Record<number, string> = { 0: '4', 1: '1', 2: 'j' };
const BASEBOARD: Record<number, string> = { 12: '4', 13: '3', 14: '3', 15: '1' };

const R_WALL = paint((x, y) => RIM[y] ?? rPaper(x, y));
const R_WALL_BASE = paint((x, y) => BASEBOARD[y] ?? rPaper(x, y + 16));
const R_WALL_TOP_1 = stamp(flat('Z'), ['5', 4, 5], ['5', 12, 12]);
const R_WALL_TOP_2 = stamp(flat('Z'), ['5', 9, 2], ['5', 2, 13]);
const R_VOID = flat('6');

/** Mina's tarnished star wallpaper. */
const minaPaper = (x: number, y: number): string => {
  const sy = y % 16;
  const star = (cx: number, cy: number) => Math.abs(x - cx) + Math.abs(sy - cy) <= 1;
  if (star(4, 6) || star(12, 14)) return '8';
  if ((x === 9 && sy === 3) || (x === 1 && sy === 11)) return '9';
  return '6';
};
const R_WALL_MINA = stamp(paint((x, y) => RIM[y] ?? minaPaper(x, y)), ['77', 13, 9], ['7', 2, 13]);
const R_WALL_MINA_BASE = stamp(
  paint((x, y) => BASEBOARD[y] ?? minaPaper(x, y + 16)),
  ['7\n7', 8, 9],
);

// ---------------------------------------------------------------------------
// Real world — doors and window
// ---------------------------------------------------------------------------

/** Door casing columns: left light, right shadow. Slab = columns 2–13. */
const CASING: Record<number, string> = { 0: '4', 1: '3', 14: '1', 15: 'j' };
const casing = (x: number): string | null => CASING[x] ?? null;

/** Upper half of a door: wall rim, head casing, slab. */
const doorTop = (slab: (x: number, y: number) => string): string =>
  paint((x, y) => {
    if (y <= 2) return RIM[y]!;
    if (y === 3) return x === 15 ? '1' : '4';
    if (y === 4) return x === 0 ? '4' : x === 15 ? 'j' : '3';
    return casing(x) ?? slab(x, y);
  });
const doorBottom = (slab: (x: number, y: number) => string): string => paint((x, y) => casing(x) ?? slab(x, y));

/** Recessed panel (shadow on the top/left inner edge, light on the bottom/right). */
const panel = (x: number, y: number, x0: number, y0: number, x1: number, y1: number): string | null => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return null;
  if (y === y0 || x === x0) return 'K';
  if (y === y1 || x === x1) return 'G';
  return 'd';
};
const slabTop = (x: number, y: number): string => (y === 5 || x === 2 ? 'K' : (panel(x, y, 4, 7, 11, 14) ?? 'd'));
const slabBottom = (x: number, y: number): string => {
  if (x === 2 || y === 15) return 'K';
  if (x === 12 && y === 1) return 'g';
  if (x === 12 && y === 2) return 'G';
  return panel(x, y, 4, 3, 11, 12) ?? 'd';
};

const R_DOOR_TOP = doorTop(slabTop);
const R_DOOR = doorBottom(slabBottom);

// Mina's door: a crayon sign « MINA » (each letter a different colour) and star stickers.
const MINA_SIGN = `
  9999999999999999
  T999T9898I99I9N9
  TT9TT9898II9IN9N
  T9T9T9898I9IIN9N
  T999T9898I99INNN
  T999T9898I99IN9N
  9999999999999999
  KKKKKKKKKKKKKKKK
`;
const R_DOOR_MINA_TOP = stamp(doorTop(slabTop), [MINA_SIGN, 0, 6]);
const STAR_STICKER = `
  .8.
  888
  .8.
`;
const R_DOOR_MINA = stamp(
  doorBottom(slabBottom),
  [STAR_STICKER, 5, 4],
  [swap(STAR_STICKER, { '8': 'U' }), 8, 8],
  [swap(STAR_STICKER, { '8': '9' }), 5, 10],
  ['8', 10, 5],
);

// Open doorway: same casing, darkness inside, the door slab seen edge-on on the left.
const openInside = (top: boolean) => (x: number, y: number): string => {
  if (x === 2) return top && y === 5 ? 'K' : 'G';
  if (x === 3) return 'd';
  if (x === 4) return 'K';
  if (top) return y === 5 ? 'i' : 'Z';
  if (y >= 13) return y === 15 ? 'j' : 'z';
  return 'Z';
};
const R_DOOR_OPEN_TOP = doorTop(openInside(true));
const R_DOOR_OPEN = doorBottom(openInside(false));

/** Night window with rain (3 frames): rim, casing, cross bars, a moon behind clouds, sill. */
const R_WINDOW_FRAME = `
  4444444444444444
  1111111111111111
  jjjjjjjjjjjjjjjj
  4444444444444441
  433333333333331j
  43jjjjj31jjjjj1j
  43zzzzz31zzJzz1j
  43zzzzz31zJ1Jz1j
  4333333331333J1j
  43jjjjj31jjjjj1j
  43zzzzz31zzzzz1j
  43zzzzz31zzzzz1j
  43zzzzz31zzzzz1j
  4444444444444444
  3333333333333331
  jjjjjjjjjjjjjjjj
`;
function rWindow(frame: number): string {
  const drops: Array<[number, number]> = [
    [3, 0],
    [5, 5],
    [10, 2],
    [12, 7],
    [4, 6],
    [9, 4],
    [13, 1],
  ];
  const g = grid(R_WINDOW_FRAME);
  for (const [x, y0] of drops) {
    const y = 4 + ((y0 + frame * 3) % 9);
    for (const [dy, c] of [
      [0, '1'],
      [-1, 'j'],
    ] as const) {
      const row = g[y + dy];
      if (row && (row[x] === 'z' || row[x] === 'j')) row[x] = c;
    }
  }
  return art(g);
}

// ---------------------------------------------------------------------------
// Dream — meadow
// ---------------------------------------------------------------------------

const TUFT = `
  l.l
  e.e
  .e.
`;
const TUFT_SMALL = `
  l..
  e.l
  .e.
`;
const flower = (petal: string, heart: string) => `
  .${petal}.
  ${petal}${heart}${petal}
  .e.
`;
const FLOWER_W = flower('w', 'y');
const FLOWER_P = flower('p', 'q');
const FLOWER_Y = flower('y', 'Y');
const FLOWER_B = flower('b', 'w');
const FLOWER_V = flower('v', 'q');

const GRASS = flat('L');
const GRASS_1 = stamp(GRASS, [TUFT, 2, 2], [TUFT_SMALL, 10, 7], [TUFT, 5, 11], ['l', 13, 13], ['l', 9, 1]);
const GRASS_2 = stamp(GRASS, [TUFT_SMALL, 11, 2], [TUFT, 3, 6], [TUFT_SMALL, 12, 12], ['l', 1, 13], [FLOWER_W, 7, 11]);
const GRASS_3 = stamp(GRASS, [TUFT, 10, 3], [TUFT_SMALL, 2, 10], [TUFT, 9, 12], ['l', 4, 2]);
const GRASS_4 = stamp(GRASS, [TUFT_SMALL, 6, 2], [FLOWER_P, 2, 8], [TUFT, 11, 9], ['l', 13, 3], ['l', 6, 14]);

const GRASS_FLOWERS_1 = stamp(
  GRASS,
  [FLOWER_P, 1, 1],
  [FLOWER_W, 7, 3],
  [FLOWER_Y, 12, 1],
  [FLOWER_B, 3, 8],
  [FLOWER_P, 10, 8],
  [FLOWER_V, 6, 12],
  [FLOWER_W, 12, 13],
  [TUFT_SMALL, 0, 12],
);
const GRASS_FLOWERS_2 = stamp(
  GRASS,
  [FLOWER_W, 2, 2],
  [FLOWER_V, 9, 1],
  [FLOWER_P, 5, 7],
  [FLOWER_Y, 12, 6],
  [FLOWER_B, 1, 12],
  [FLOWER_P, 9, 12],
  [TUFT_SMALL, 13, 11],
);
const GRASS_FLOWERS_3 = stamp(
  GRASS,
  [FLOWER_Y, 3, 1],
  [FLOWER_P, 11, 3],
  [FLOWER_W, 6, 6],
  [FLOWER_V, 1, 10],
  [FLOWER_W, 12, 10],
  [FLOWER_B, 7, 13],
  [TUFT, 2, 5],
);

/** Sand-cotton path: soft cream bumps, pebbles. */
const PEBBLE = `
  cc
  CC
`;
const PEBBLE_SMALL = `
  c
  C
`;
const FLUFF = `
  qq.
  qqq
`;
const PATH = flat('Q');
const PATH_1 = stamp(PATH, [FLUFF, 2, 2], [PEBBLE, 10, 4], [FLUFF, 9, 11], [PEBBLE_SMALL, 4, 12], ['c', 13, 1], ['c', 6, 7]);
const PATH_2 = stamp(PATH, [FLUFF, 11, 1], [PEBBLE_SMALL, 3, 4], [FLUFF, 4, 9], [PEBBLE, 12, 12], ['c', 8, 6], ['q', 1, 14]);
const PATH_3 = stamp(PATH, [FLUFF, 6, 5], [PEBBLE_SMALL, 12, 3], [PEBBLE_SMALL, 2, 10], ['qq', 11, 13], ['c', 7, 13], ['c', 1, 1]);

/** Cotton cloud ground: white with the soft lavender undersides of puffs. */
const PUFF = `
  .ff..
  W...W
  .WvW.
`;
const PUFF_SMALL = `
  f..
  .WW
`;
const COTTON = flat('w');
const COTTON_1 = stamp(COTTON, [PUFF, 1, 2], [PUFF_SMALL, 10, 3], [PUFF, 9, 9], [PUFF_SMALL, 3, 12]);
const COTTON_2 = stamp(COTTON, [PUFF_SMALL, 2, 1], [PUFF, 7, 4], [PUFF_SMALL, 13, 9], [PUFF, 2, 11]);
const COTTON_3 = stamp(COTTON, [PUFF, 10, 1], [PUFF_SMALL, 4, 6], [PUFF, 8, 11], ['W', 2, 3]);

/** Water: light glints that swell and fade over 3 frames (each ripple has its own phase). */
function water(frame: number, base: string, light: string, mid: string, spark: string): string {
  const ripples: Array<[number, number, number]> = [
    [2, 3, 0],
    [9, 7, 1],
    [3, 12, 2],
    [11, 13, 0],
  ];
  const phases = [
    `.${light}${light}.\n....`,
    `${light}${spark}${light}${light}\n.${mid}${mid}.`,
    `${light}...\n...${light}`,
  ];
  let t = flat(base);
  for (const [x, y, o] of ripples) t = stamp(t, [phases[(frame + o) % 3]!, x, y]);
  return t;
}

/** Bridge planks: dark top/bottom edges (outline over the water, or gaps when stacked vertically). */
const BRIDGE = `
  xxxxxxxxxxxxxxxx
  qqqqcccccqqqqccc
  cxccccccccccccxc
  CCCCCCCCCCCCCCCC
  xxxxxxxxxxxxxxxx
  QQQQQQqqqqQQQQQQ
  QxQQQQQQQQQQQxQQ
  CCCCCCCCCCCCCCCC
  xxxxxxxxxxxxxxxx
  ccccccxqqqqccccc
  cxccccxcccccccxc
  CCCCCCxCCCCCCCCC
  xxxxxxxxxxxxxxxx
  qqqcccccccccqqqc
  CxCCCCCCCCCCCxCC
  xxxxxxxxxxxxxxxx
`;
const BRIDGE_2 = `
  xxxxxxxxxxxxxxxx
  ccccccccqqqqcccc
  cxcccccccccccxcc
  CCCCCCCCCCCCCCCC
  xxxxxxxxxxxxxxxx
  qqqqccccccccxqqq
  cxccccccccccxcxc
  CCCCCCCCCCCCxCCC
  xxxxxxxxxxxxxxxx
  QQQQQQQQqqqqQQQQ
  QxQQQQQQQQQQQQxQ
  CCCCCCCCCCCCCCCC
  xxxxxxxxxxxxxxxx
  ccccqqqqcccccccc
  CxCCCCCCCCCCCCxC
  xxxxxxxxxxxxxxxx
`;

/** Hedge: overlapping leaf balls (balls crossing the border are shared by both variants). */
const LEAF_BALL = `
  ..eeee..
  .eLLLLe.
  eLlLLLee
  eLLLLeeE
  eeLLeeeE
  .eeeeEE.
  ..EEEE..
`;
const HEDGE_SHARED: Patch[] = [
  [LEAF_BALL, -3, -2],
  [LEAF_BALL, 9, 4],
  [LEAF_BALL, 3, 9],
  [LEAF_BALL, 12, 12],
];
const HEDGE_1 = stamp(flat('E'), ...HEDGE_SHARED, [LEAF_BALL, 4, 1], ['l', 6, 3], ['l', 11, 6]);
const HEDGE_2 = stamp(flat('E'), ...HEDGE_SHARED, [LEAF_BALL, 3, 2], [LEAF_BALL, 8, 0], ['l', 10, 2], ['l', 5, 11]);

/** Wall of cotton clouds: staggered round puffs (white tops, lavender undersides, thin violet crevices). */
const CLOUD_PUFF = `
  ..wwww..
  .wffwww.
  wfwwwwwW
  wwwwwwWv
  wwwwwWvv
  .WWWvvv.
  ..vvvv..
`;
const CLOUD_PUFF_SMALL = `
  .ww.
  wfwW
  wwWv
  .vv.
`;
const CLOUD_GRID: Patch[] = [
  [CLOUD_PUFF, 0, 0],
  [CLOUD_PUFF, 8, 0],
  [CLOUD_PUFF, 4, 8],
  [CLOUD_PUFF, 12, 8],
];
const COTTON_WALL_1 = stamp(flat('V'), ...CLOUD_GRID);
const COTTON_WALL_2 = stamp(flat('V'), ...CLOUD_GRID, [CLOUD_PUFF_SMALL, 6, 5]);

/** Wooden fence (drawn over grass with `under`). Rails run left–right, one post in the middle. */
const FENCE = `
  ................
  ......xxxx......
  .....xccccx.....
  .....xcqcCx.....
  xxxxxxcccCxxxxxx
  ccccqxcccCxccccc
  CCCCCxcccCxCCCCC
  xxxxxxcccCxxxxxx
  eeeeexcccCxeeeee
  xxxxxxcccCxxxxxx
  qcccccxcccCxcccc
  CCCCCxcccCxCCCCC
  xxxxxxcccCxxxxxx
  eeeeexCCCCxeeeee
  .....xxxxxxe....
  ......eeeeee....
`;

// ---------------------------------------------------------------------------
// Dream — interiors and the Blanket Hill
// ---------------------------------------------------------------------------

const plank = (joints: number[], body: string[], grain: Array<[number, number, number]>) =>
  boards({ size: 4, joints, body, light: 'q', seam: 'C', grain, grainColor: 'Q', vertical: true });
const PLANK_1 = plank([4, -1, 11, -1], ['c'], [[2, 9, 2], [13, 13, 2]]);
const PLANK_2 = plank([-1, 6, -1, 13], ['c', 'Q', 'c', 'c'], [[10, 10, 2], [1, 3, 2]]);
const PLANK_3 = plank([9, -1, -1, 2], ['c', 'c', 'c', 'Q'], [[5, 2, 2], [14, 6, 2]]);

/** Braided rag rug: four braided bands (pink, cream, lavender, blue). */
const BRAID: Array<[string, string]> = [
  ['p', 'P'],
  ['q', 'Q'],
  ['v', 'V'],
  ['b', 'B'],
];
const rug = () =>
  paint((x, y) => {
    const band = BRAID[Math.floor(y / 4) % 4]!;
    const r = y % 4;
    if (r === 3) return band[1];
    return (x + r) % 4 < 2 ? band[0] : band[1];
  });
const RUG_1 = rug();
const RUG_2 = stamp(rug(), ['w', 5, 4], ['w', 13, 12]);

/** Pastel interior wall: candy-stripe wallpaper and a small baseboard (a chair rail when stacked). */
const dPaper = (x: number, y: number): string => {
  if (y === 14) return 'c';
  if (y === 15) return 'C';
  if (x % 8 === 3 || x % 8 === 4) return y % 4 === 1 && x % 8 === 3 ? 'w' : 'p';
  if (x % 8 === 0) return 'Q';
  return 'q';
};
const WALL_D = paint(dPaper);
const WALL_D_TOP_1 = stamp(flat('K'), ['k', 3, 4], ['k', 11, 11]);
const WALL_D_TOP_2 = stamp(flat('K'), ['k', 12, 3], ['k', 5, 12]);

/** Round-topped wooden door with a porthole (two rows of `wall_d`). */
const DOOR_D_TOP = stamp(
  WALL_D,
  [
    `
    ................
    ................
    .....xxxxxx.....
    ...xxCCCCCCxx...
    ..xCCccccccCCx..
    .xCcccbbbbcccCx.
    .xCccbwbbBbccCx.
    xCcccbbbbBBcccCx
    xCcCcbbbBBBcCcCx
    xCcCccbBBBccCcCx
    xCcCcccccccCcCcx
    xCcCcCcccCcCcCcx
    xCcCcCcccCcCcCcx
    xCcCcCcccCcCcCcx
    xCcCcCcccCcCcCcx
    xCcCcCcccCcCcCcx
    `,
    0,
    0,
  ],
);
const DOOR_D = `
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCYyCCcx
  xCcCcCcccCYYCCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCcCcCcccCcCcCcx
  xCxCxCxxxCxCxCcx
  xCCCCCCCCCCCCCCx
  xxxxxxxxxxxxxxxx
  CCCCCCCCCCCCCCCC
`;

/**
 * Quilted blanket squares: one padded square per tile (light rim top-left, shade bottom-right), seams with
 * running stitches. quilt_a = pink, quilt_b = lavender-blue; variants add a little embroidered motif.
 */
const quilt = (o: { body: string; light: string; shade: string; seam: string; stitch: string }) =>
  paint((x, y) => {
    if (x === 15 || y === 15) return (x === 15 ? y : x) % 4 < 2 ? o.stitch : o.seam;
    if (x === 14 || y === 14) return o.shade;
    if ((y === 0 && x < 13) || (x === 0 && y < 13)) return o.light;
    return o.body;
  });
const MOTIF_HEART = `
  P.P
  PPP
  .P.
`;
const MOTIF_FLOWER = `
  .w.
  wyw
  .w.
`;
const QUILT_A = quilt({ body: 'p', light: 'w', shade: 'P', seam: 'P', stitch: 'w' });
const QUILT_B = quilt({ body: 'v', light: 'w', shade: 'V', seam: 'V', stitch: 'w' });
const QUILT_A_1 = QUILT_A;
const QUILT_A_2 = stamp(QUILT_A, [MOTIF_HEART, 6, 6]);
const QUILT_B_1 = QUILT_B;
const QUILT_B_2 = stamp(QUILT_B, [MOTIF_FLOWER, 6, 6]);

/** Big pillow obstacle: pinched corners, tufted button, outlined like an object. */
const PILLOW = `
  .kk..........kk.
  kwwkkkkkkkkkkwvk
  kwwwwwwwwwwwwwvk
  .kwfwwwwwwwwwvk.
  .kwwwwwwwwwwwvk.
  .kwwwwwwwwwwwvk.
  .kwwwwwvwwwwwvk.
  .kwwwwvPvwwwwvk.
  .kwwwwwvwwwwwvk.
  .kwwwwwwwwwwwvk.
  .kwwwwwwwwwwvVk.
  .kwwwwwwwwwvvVk.
  .kvvvvvvvvvvvVk.
  kwvvvvvvvvvvVVvk
  kvvkkkkkkkkkkVVk
  .kk..........kk.
`;

// ---------------------------------------------------------------------------
// Pencil forest
// ---------------------------------------------------------------------------

/** Lined school paper (lines every 8 px). */
const PAPER = paint((_x, y) => (y % 8 === 3 ? 'b' : 'q'));
const PAPER_1 = stamp(PAPER, ['W', 5, 6], ['W', 12, 13]);
const PAPER_2 = stamp(PAPER, ['gW', 10, 6], ['W', 3, 14]);
const PAPER_3 = stamp(PAPER, ['W\n.W', 2, 8], ['W', 13, 1]);

const SCRIBBLE_LOOPS = `
  ..GGG.....GG..
  .G...G..GG..G.
  G..GG.GG...G.G
  G.G..G..G.G..G
  .G.GG.GG.G..G.
  ..G....GG.GG..
`;
const SCRIBBLE_ZIGZAG = `
  B...B...B.....
  .B.B.B.B.B..P.
  ..B...B...BP.P
  ..........PP.P
  .........P..P.
`;
const PAPER_SCRIBBLE_1 = stamp(PAPER, [SCRIBBLE_LOOPS, 1, 5]);
const PAPER_SCRIBBLE_2 = stamp(PAPER, [SCRIBBLE_ZIGZAG, 1, 6]);
const PAPER_SCRIBBLE_3 = stamp(PAPER, [swap(SCRIBBLE_LOOPS, { G: 'R' }), 1, 8], ['V.V\n.V.', 10, 1]);

/** Grass drawn with a wax crayon: diagonal hatching, paper showing through. */
const crayonGrass = (seed: number) =>
  paint((x, y) => {
    const d = (x + y + seed) % 4;
    if (noise(x, y, seed) < 0.045) return 'q';
    return d === 0 ? 'e' : d === 2 && (x + seed) % 3 === 0 ? 'l' : 'L';
  });
const CRAYON_GRASS_1 = crayonGrass(1);
const CRAYON_GRASS_2 = crayonGrass(2);
const CRAYON_GRASS_3 = stamp(crayonGrass(3), ['E', 4, 5], ['E', 11, 12]);

/** A dense forest of giant pencils standing tip up: two 8-px pencils per tile, dark depth behind. */
const PENCILS: Record<string, [hi: string, mid: string, lo: string]> = {
  r: ['p', 'r', 'R'],
  b: ['b', 'B', 'n'],
  y: ['y', 'Y', 'O'],
  g: ['l', 'L', 'e'],
  v: ['v', 'V', 'u'],
  o: ['y', 'o', 'O'],
};
const PENCIL_TIP = [
  '...3....',
  '...32...',
  '..qc3...',
  '.qccC...',
  '.qcccC..',
  'q1c2c3C.',
];
function pencils(a: [keyof typeof PENCILS, number], b: [keyof typeof PENCILS, number]): string {
  return paint((x, y) => {
    const [kind, tip] = x < 8 ? a : b;
    const [hi, mid, lo] = PENCILS[kind]!;
    const lx = x % 8;
    const ry = y - tip;
    if (lx === 7) return ry >= 6 ? 'K' : 'k';
    if (ry < 0) return 'k';
    if (ry < PENCIL_TIP.length) {
      const ch = PENCIL_TIP[ry]![lx]!;
      return ch === '.' ? 'k' : ch === '1' ? hi : ch === '2' ? mid : ch === '3' ? lo : ch;
    }
    if (lx <= 1) return hi;
    if (lx >= 5) return lo;
    return lx === 2 && ry % 5 === 2 ? hi : mid;
  });
}
const PENCIL_WALL_1 = pencils(['r', 1], ['b', 6]);
const PENCIL_WALL_2 = pencils(['y', 5], ['g', 0]);
const PENCIL_WALL_3 = pencils(['v', 3], ['o', 7]);

/** Blue ink pond. */
const inkWater = (f: number) => water(f, 'n', 'B', 'u', 'b');

/** Erased area: blank white, remains of the ruled lines, eraser streaks, a ghost contour. */
const ERASED_1 = stamp(
  flat('f'),
  ['WW...W..', 0, 3],
  ['..W....W', 8, 11],
  ['...W\n..W.\n.W..\nW...', 9, 4],
  ['g', 4, 13],
  ['W', 5, 13],
);
const ERASED_2 = stamp(
  flat('f'),
  ['W.....WW', 8, 3],
  ['.W......', 0, 11],
  ['.WW.\nW..W\n....', 3, 6],
  ['W', 12, 13],
  ['g', 13, 8],
);

/** Workshop floor: one big desk top with smooth wavy grain (period 16 → seamless). */
const deskWood = (sign: number, knot?: [number, number]) => {
  const t = paint((x, y) => {
    for (const [base, phase] of [
      [4, 0],
      [11, 2],
    ] as const) {
      const gy = base + Math.round(1.4 * sign * Math.sin((2 * Math.PI * x) / N + phase));
      if (y === gy) return 'x';
      if (y === gy + 1 && (x + base) % 7 < 3) return 'c';
    }
    return noise(x, y, sign + 5) < 0.04 ? 'x' : 'C';
  });
  return knot ? stamp(t, ['.xx.\nxccx\n.xx.', knot[0], knot[1]]) : t;
};
const DESK_WOOD_1 = deskWood(1);
const DESK_WOOD_2 = deskWood(-1, [9, 8]);

// ---------------------------------------------------------------------------
// Paper hospital
// ---------------------------------------------------------------------------

const lino = (seed: number) =>
  paint((x, y) => {
    if (x === 15 || y === 15) return '7';
    const n = noise(x, y, seed);
    return n < 0.05 ? '9' : n > 0.96 ? '7' : '6';
  });
const H_FLOOR_1 = lino(1);
const H_FLOOR_2 = lino(2);
const H_FLOOR_3 = stamp(lino(3), ['.77\n7..', 5, 6]);

const H_RIM: Record<number, string> = { 0: 'w', 1: '9', 2: '7' };
const hPaint = (x: number, y: number): string => (noise(x, y % 16, 9) < 0.04 ? '6' : '9');
const H_WALL = paint((x, y) => H_RIM[y] ?? hPaint(x, y));
const H_WALL_BASE = paint((x, y) => {
  if (y <= 2) return hPaint(x, y + 16);
  if (y === 3) return 'w';
  if (y === 4) return 'g';
  if (y === 5) return 'G';
  if (y === 6) return 'F';
  if (y <= 12) return x % 8 === 7 ? 'F' : 'D';
  if (y === 13) return 'F';
  return 'I';
});
const H_WALL_TOP_1 = stamp(flat('5'), ['z', 5, 4], ['z', 12, 11]);
const H_WALL_TOP_2 = stamp(flat('5'), ['z', 10, 2], ['z', 3, 12]);

/** Hospital door: grey metal frame, mint slab. */
const H_CASING: Record<number, string> = { 0: 'g', 1: 'G', 14: 'G', 15: 'd' };
const hCasing = (x: number): string | null => H_CASING[x] ?? null;
const hDoorTop = (slab: (x: number, y: number) => string): string =>
  paint((x, y) => {
    if (y <= 2) return H_RIM[y]!;
    if (y === 3) return x === 15 ? 'G' : 'g';
    if (y === 4) return x === 0 ? 'g' : x === 15 ? 'd' : 'G';
    return hCasing(x) ?? slab(x, y);
  });
const hDoorBottom = (slab: (x: number, y: number) => string): string => paint((x, y) => hCasing(x) ?? slab(x, y));
const hSlab = (x: number, y: number): string => (x === 2 || y === 5 ? 'F' : 'D');
const PORTHOLE = `
  .GGGG.
  GzzzjG
  GzzjjG
  GzjjjG
  GjjjwG
  .GGGG.
`;
const H_DOOR_TOP = stamp(hDoorTop(hSlab), [PORTHOLE, 5, 8], ['FFFF', 6, 14]);
const hSlabBottom = (x: number, y: number): string => {
  if (y === 15) return 'd';
  if (y >= 11) return y === 11 ? 'W' : y === 14 ? 'G' : 'g';
  if (x === 11 && y >= 1 && y <= 5) return y === 5 ? 'G' : 'g';
  return x === 2 ? 'F' : 'D';
};
const H_DOOR = hDoorBottom(hSlabBottom);

const PLATE_304 = `
  GGGGGGGGGGGGG
  GwwwwwwwwwwwG
  GkkkwkkkwkwkG
  GwwkwkwkwkwkG
  GwkkwkwkwkkkG
  GwwkwkwkwwwkG
  GkkkwkkkwwwkG
  GwwwwwwwwwwwG
  FFFFFFFFFFFFF
`;
// Room 304 (Mina's room): number plate, and one of her drawings taped to the door.
const H_DOOR_304_TOP = stamp(hDoorTop(hSlab), [PLATE_304, 2, 6]);
const H_DOOR_304 = stamp(hDoorBottom(hSlabBottom), ['qqqq\nqrrq\nqqrq', 4, 3], ['y', 4, 2], ['y', 7, 2]);

/** Window with green curtains on a rod, night sky with a crescent moon. */
const H_WINDOW = `
  wwwwwwwwwwwwwwww
  9999999999999999
  7777777777777777
  9gGGGGGGGGGGGGg9
  9LeEwwwwwwwwLeE9
  9LeEwjjjjjj7LeE9
  9LeEwzzzzqz7LeE9
  9LeEwzzzzzq7LeE9
  9LeEwzzzzqz7LeE9
  9LQEwzzzzzz7LQE9
  9LeEwzyzzzz7LeE9
  9LeEwzzzzzz7LeE9
  9LeE77777777LeE9
  9LeEwwwwwwwwLeE9
  9LeE77777777LeE9
  9eEE99999999eEE9
`;

// ---------------------------------------------------------------------------
// Ink
// ---------------------------------------------------------------------------

/** Glossy black ink: curved reflections, a glint, purple sheen. */
const GLOSS = `
  .Kd
  Kdf
  K..
`;
const GLOSS_SMALL = `
  .K
  Kd
`;
const INK_PUDDLE_1 = stamp(flat('i'), [GLOSS, 3, 3], ['KK', 10, 11], [GLOSS_SMALL, 11, 4], ['u', 6, 13]);
const INK_PUDDLE_2 = stamp(flat('i'), [GLOSS_SMALL, 9, 8], ['KK', 2, 4], ['u', 3, 12], ['.K\nK.', 12, 13], ['u', 13, 1]);

/** Running ink wall: glossy drips slide down 5 px per frame (wrapping, 15 px cycle). */
function inkWall(frame: number): string {
  const drips: Array<[number, number, number]> = [
    [2, 0, 4],
    [7, 9, 3],
    [11, 4, 5],
  ];
  let t = stamp(flat('i'), ['K\nK', 5, 3], ['K\nK\nK', 14, 10], ['u', 9, 14]);
  for (const [x, y, len] of drips) {
    const y0 = y + frame * 5;
    const streak = Array.from({ length: len }, () => 'dK').join('\n') + '\nKu\n.K';
    t = stamp(t, [streak, x, y0]);
  }
  return t;
}

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

const V_FLOOR_1 = stamp(flat('i'), ['u', 3, 4], ['K', 12, 2], ['K', 9, 10], ['u', 13, 13]);
const V_FLOOR_2 = stamp(flat('i'), ['K', 11, 5], ['u', 4, 10], ['K', 14, 14]);
const V_FLOOR_3 = stamp(flat('i'), ['K', 6, 2], ['.K.\nKuK\n.K.', 9, 8], ['K', 2, 13]);
const V_EDGE = flat('0');
const V_WHITE_1 = stamp(flat('f'), ['q', 4, 5], ['w', 11, 2], ['q', 12, 12], ['w', 2, 13]);
const V_WHITE_2 = stamp(flat('f'), ['w', 7, 8], ['q', 13, 4], ['q', 3, 1]);

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  // Real world
  t_r_floor_1: R_FLOOR_1,
  t_r_floor_2: R_FLOOR_2,
  t_r_floor_3: R_FLOOR_3,
  t_r_carpet_1: R_CARPET_1,
  t_r_carpet_2: R_CARPET_2,
  t_r_tile_1: R_TILE,
  t_r_tile_2: R_TILE_2,
  t_r_wall: R_WALL,
  t_r_wall_base: R_WALL_BASE,
  t_r_wall_top_1: R_WALL_TOP_1,
  t_r_wall_top_2: R_WALL_TOP_2,
  t_r_void: withColors(R_VOID, VOID_BLACK),
  t_r_window_1: rWindow(0),
  t_r_window_2: rWindow(1),
  t_r_window_3: rWindow(2),
  t_r_door_top: R_DOOR_TOP,
  t_r_door: R_DOOR,
  t_r_door_mina_top: withColors(R_DOOR_MINA_TOP, MINA_COLORS),
  t_r_door_mina: withColors(R_DOOR_MINA, MINA_COLORS),
  t_r_door_open_top: R_DOOR_OPEN_TOP,
  t_r_door_open: R_DOOR_OPEN,
  t_r_wall_mina: withColors(R_WALL_MINA, MINA_COLORS),
  t_r_wall_mina_base: withColors(R_WALL_MINA_BASE, MINA_COLORS),
  t_r_floor_mina_1: withColors(R_FLOOR_MINA_1, MINA_COLORS),
  t_r_floor_mina_2: withColors(R_FLOOR_MINA_2, MINA_COLORS),

  // Dream — meadow
  t_grass_1: GRASS_1,
  t_grass_2: GRASS_2,
  t_grass_3: GRASS_3,
  t_grass_4: GRASS_4,
  t_grass_flowers_1: GRASS_FLOWERS_1,
  t_grass_flowers_2: GRASS_FLOWERS_2,
  t_grass_flowers_3: GRASS_FLOWERS_3,
  t_path_1: PATH_1,
  t_path_2: PATH_2,
  t_path_3: PATH_3,
  t_cotton_1: COTTON_1,
  t_cotton_2: COTTON_2,
  t_cotton_3: COTTON_3,
  t_water_1: water(0, 'b', 'a', 'B', 'w'),
  t_water_2: water(1, 'b', 'a', 'B', 'w'),
  t_water_3: water(2, 'b', 'a', 'B', 'w'),
  t_bridge_1: BRIDGE,
  t_bridge_2: BRIDGE_2,
  t_hedge_1: HEDGE_1,
  t_hedge_2: HEDGE_2,
  t_cotton_wall_1: COTTON_WALL_1,
  t_cotton_wall_2: COTTON_WALL_2,
  t_fence: FENCE,

  // Dream — interiors and the Blanket Hill
  t_plank_1: PLANK_1,
  t_plank_2: PLANK_2,
  t_plank_3: PLANK_3,
  t_rug_1: RUG_1,
  t_rug_2: RUG_2,
  t_wall_d: WALL_D,
  t_wall_d_top_1: WALL_D_TOP_1,
  t_wall_d_top_2: WALL_D_TOP_2,
  t_door_d_top: DOOR_D_TOP,
  t_door_d: DOOR_D,
  t_quilt_a_1: QUILT_A_1,
  t_quilt_a_2: QUILT_A_2,
  t_quilt_b_1: QUILT_B_1,
  t_quilt_b_2: QUILT_B_2,
  t_pillow: PILLOW,

  // Pencil forest
  t_paper_1: PAPER_1,
  t_paper_2: PAPER_2,
  t_paper_3: PAPER_3,
  t_paper_scribble_1: PAPER_SCRIBBLE_1,
  t_paper_scribble_2: PAPER_SCRIBBLE_2,
  t_paper_scribble_3: PAPER_SCRIBBLE_3,
  t_crayon_grass_1: CRAYON_GRASS_1,
  t_crayon_grass_2: CRAYON_GRASS_2,
  t_crayon_grass_3: CRAYON_GRASS_3,
  t_pencil_wall_1: PENCIL_WALL_1,
  t_pencil_wall_2: PENCIL_WALL_2,
  t_pencil_wall_3: PENCIL_WALL_3,
  t_ink_water_1: inkWater(0),
  t_ink_water_2: inkWater(1),
  t_ink_water_3: inkWater(2),
  t_erased_1: ERASED_1,
  t_erased_2: ERASED_2,
  t_desk_wood_1: DESK_WOOD_1,
  t_desk_wood_2: DESK_WOOD_2,

  // Paper hospital
  t_h_floor_1: withColors(H_FLOOR_1, HOSP_COLORS),
  t_h_floor_2: withColors(H_FLOOR_2, HOSP_COLORS),
  t_h_floor_3: withColors(H_FLOOR_3, HOSP_COLORS),
  t_h_wall: withColors(H_WALL, HOSP_COLORS),
  t_h_wall_base: withColors(H_WALL_BASE, HOSP_COLORS),
  t_h_wall_top_1: H_WALL_TOP_1,
  t_h_wall_top_2: H_WALL_TOP_2,
  t_h_door_top: withColors(H_DOOR_TOP, HOSP_COLORS),
  t_h_door: withColors(H_DOOR, HOSP_COLORS),
  t_h_door_304_top: withColors(H_DOOR_304_TOP, HOSP_COLORS),
  t_h_door_304: withColors(H_DOOR_304, HOSP_COLORS),
  t_h_window: withColors(H_WINDOW, HOSP_COLORS),

  // Ink
  t_ink_puddle_1: INK_PUDDLE_1,
  t_ink_puddle_2: INK_PUDDLE_2,
  t_ink_wall_1: inkWall(0),
  t_ink_wall_2: inkWall(1),
  t_ink_wall_3: inkWall(2),

  // Void
  t_v_floor_1: V_FLOOR_1,
  t_v_floor_2: V_FLOOR_2,
  t_v_floor_3: V_FLOOR_3,
  t_v_edge: V_EDGE,
  t_v_white_1: V_WHITE_1,
  t_v_white_2: V_WHITE_2,
};

/** Chapter 3 reuses the dream tiles in their corrupted form (`t_xxx@ink`). */
export const VARIANTS: string[] = ['ink'];

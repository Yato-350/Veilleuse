import type { SpriteDef } from '../../game/assets';
import { parseRows } from '../../engine/sprite';
import { mix, realify } from '../../engine/palette';
import { ART as TILE_ART } from './tiles';

/*
 * VEILLEUSE — sprites of the epilogue (route « aube »): the little shop where Noa and Maman buy a new nightlight,
 * and the garden where Mina rests. Daytime in the real world.
 *
 * - Every prop here is only used in real-world maps, so each definition carries its own colour transform: `realify`
 *   (the muted, bluish look of the real world) for ordinary objects, and a much lighter one (`glow`) for the
 *   nightlights on sale — the only things in the shop that keep their colours. No automatic variants (VARIANTS = []).
 * - The garden reuses the dream outdoor tiles (grass, path, hedge, fence). Their real-world look is provided here
 *   as `t_<key>@real` sprites: the tilemap picks `<key>@<world>` when it exists, exactly like the `@ink` tiles of
 *   chapter 3. Same transform as the organic tile edges (`realify`), so borders blend in.
 */

// ---------------------------------------------------------------------------
// Toolkit
// ---------------------------------------------------------------------------

/** A tiny pixel canvas working on palette characters ('.' = transparent). */
class Px {
  g: string[][];
  constructor(w: number, h: number) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  get w(): number {
    return this.g[0]?.length ?? 0;
  }
  get h(): number {
    return this.g.length;
  }
  get(x: number, y: number): string {
    return this.g[y]?.[x] ?? '.';
  }
  px(x: number, y: number, c: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.g[y]![x] = c;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  hl(x: number, y: number, len: number, c: string): this {
    return this.rect(x, y, len, 1, c);
  }
  vl(x: number, y: number, len: number, c: string): this {
    return this.rect(x, y, 1, len, c);
  }
  oval(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c);
    return this;
  }
  /** Filled polygon (pixel centres inside). */
  poly(pts: Array<[number, number]>, c: string): this {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]!;
          const [xj, yj] = pts[j]!;
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.px(x, y, c);
      }
    return this;
  }
  /** Overlays art ('.' transparent). */
  stamp(src: string, x: number, y: number): this {
    parseRows(src).forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && this.px(x + i, y + j, ch)));
    return this;
  }
  /** Replaces colours (whole canvas). */
  swap(map: Record<string, string>): this {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = map[this.get(x, y)];
        if (c !== undefined) this.px(x, y, c);
      }
    return this;
  }
  /** 1-px contour of `c` on transparent pixels touching opaque ones. */
  contour(c = 'k'): this {
    const src = this.g.map((r) => [...r]);
    const solid = (x: number, y: number) => {
      const ch = src[y]?.[x];
      return ch !== undefined && ch !== '.';
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) this.g[y]![x] = c;
    return this;
  }
  toString(): string {
    return this.g.map((r) => r.join('')).join('\n');
  }
}

const px = (w: number, h: number) => new Px(w, h);

/** Deterministic hash → [0, 1). */
function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(seed + 31, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The nightlights on sale keep most of their colour in the grey real world. */
const glow = (hex: string): string => mix(hex, realify(hex), 0.3);

const real = (art: string): SpriteDef => ({ art, transform: realify });
const lit = (art: string): SpriteDef => ({ art, transform: glow });

// ---------------------------------------------------------------------------
// Garden tiles in daylight (real-world versions of the dream outdoor tiles)
// ---------------------------------------------------------------------------

const DAY_TILES = [
  't_grass_1',
  't_grass_2',
  't_grass_3',
  't_grass_4',
  't_grass_flowers_1',
  't_grass_flowers_2',
  't_grass_flowers_3',
  't_path_1',
  't_path_2',
  't_path_3',
  't_hedge_1',
  't_hedge_2',
  't_fence',
];

const REAL_TILES: Record<string, SpriteDef> = {};
for (const k of DAY_TILES) {
  const def = TILE_ART[k];
  if (!def) continue;
  REAL_TILES[`${k}@real`] = typeof def === 'string' ? { art: def, transform: realify } : { ...def, transform: realify };
}

// ---------------------------------------------------------------------------
// The nightlights on sale (each ~12×12, sitting on the display table)
// ---------------------------------------------------------------------------

/** Moon: the very same model as Mina's. */
const VL_LUNE = `
  ....kkk...
  ...kqyk...
  ..kqyk....
  ..kyyk....
  ..kyyk..k.
  ..kyyykyk.
  ...kYyyYk.
  ....kkkk..
  ...kWWWgk.
  ...kkkkkk.
`;

const VL_ETOILE = (() => {
  const p = px(13, 13);
  const s: Array<[number, number]> = [
    [6.5, 0.5],
    [8.3, 4.4],
    [12.5, 4.7],
    [9.4, 7.6],
    [10.4, 11.5],
    [6.5, 9.4],
    [2.6, 11.5],
    [3.6, 7.6],
    [0.5, 4.7],
    [4.7, 4.4],
  ];
  p.poly(s, 'y');
  p.poly(
    s.map(([x, y]) => [6.5 + (x - 6.5) * 0.55, 6.2 + (y - 6.2) * 0.55] as [number, number]),
    'q',
  );
  p.px(5, 4, 'f').px(4, 5, 'q');
  p.px(9, 8, 'Y').px(10, 9, 'Y').px(8, 9, 'Y').px(3, 9, 'Y');
  p.contour();
  return p.toString();
})();

const VL_MOUTON = (() => {
  const p = px(15, 12);
  // little legs
  p.vl(4, 9, 2, 'G').vl(9, 9, 2, 'G');
  // woolly body: a few puffs
  for (const [x, y, r] of [
    [4, 5, 3],
    [7, 4, 3.4],
    [9.5, 5.5, 3],
    [6, 7, 3],
  ] as const)
    p.oval(x, y, r, r, 'q');
  p.px(4, 3, 'f').px(5, 2, 'y').px(7, 2, 'y').px(3, 4, 'y');
  p.hl(4, 9, 6, 'Q');
  // face
  p.oval(12, 5, 2, 2.4, 'G');
  p.px(13, 4, 'k').px(11, 3, 'g');
  p.px(11, 6, 'p');
  p.contour();
  return p.toString();
})();

const VL_NUAGE = (() => {
  const p = px(15, 11);
  p.oval(4, 6, 3.2, 3, 'q').oval(7.5, 4.5, 4, 3.6, 'q').oval(11, 6, 3, 2.8, 'q');
  p.rect(2, 6, 11, 3, 'q');
  p.hl(2, 8, 11, 'Q').px(6, 2, 'f').px(5, 3, 'w').px(8, 2, 'w');
  // stars it projects
  p.px(5, 6, 'y').px(8, 5, 'y').px(10, 7, 'y');
  p.contour();
  // base
  p.rect(4, 10, 7, 1, 'k');
  p.hl(5, 10, 5, 'W');
  return p.toString();
})();

const VL_COURONNE = (() => {
  const p = px(14, 11);
  p.poly(
    [
      [1, 9],
      [1, 2],
      [4, 5.5],
      [7, 0.5],
      [10, 5.5],
      [13, 2],
      [13, 9],
    ],
    'y',
  );
  p.hl(1, 7, 12, 'Y').hl(1, 8, 12, 'Y').hl(1, 6, 12, 'q');
  p.px(7, 3, 'r').px(2, 4, 'b').px(12, 4, 'b').px(4, 7, 'p').px(10, 7, 'p').px(7, 7, 'r');
  p.px(6, 2, 'f');
  p.contour();
  p.hl(3, 10, 8, 'k');
  return p.toString();
})();

// ---------------------------------------------------------------------------
// The shop
// ---------------------------------------------------------------------------

/** Long display table (5 tiles) with a lace runner: the nightlights sit on it. */
const DISPLAY_TABLE = (() => {
  const W = 80;
  const p = px(W, 22);
  // top (runner over wood)
  p.rect(1, 1, W - 2, 8, 'c').hl(1, 1, W - 2, 'Q');
  p.rect(1, 3, W - 2, 5, 'q').hl(1, 3, W - 2, 'w').hl(1, 7, W - 2, 'Q');
  // lace scallops hanging over the front
  p.rect(1, 9, W - 2, 6, 'C').hl(1, 9, W - 2, 'c');
  for (let x = 1; x < W - 1; x++) {
    const k = x % 6;
    p.px(x, 8, 'q');
    if (k > 0 && k < 5) p.px(x, 9, 'q');
    if (k > 1 && k < 4) p.px(x, 10, 'W');
  }
  p.hl(1, 14, W - 2, 'x');
  // legs
  for (const x of [3, W - 6]) p.rect(x, 15, 3, 6, 'C').vl(x + 2, 15, 6, 'x');
  p.contour();
  return p.toString();
})();

/** Shop window seen from inside (wall), daylight and the street. */
const VITRINE = (() => {
  const p = px(34, 24);
  p.rect(1, 1, 32, 22, 'C');
  // glass: pale sky, a building across the street, the pavement
  p.rect(3, 3, 13, 17, 'b').rect(18, 3, 13, 17, 'b');
  p.hl(3, 3, 13, 'a').hl(18, 3, 13, 'a');
  p.rect(3, 9, 13, 8, 'g').rect(18, 9, 13, 8, 'g');
  for (const x of [5, 9, 13, 20, 24, 28]) p.rect(x, 11, 2, 3, 'B');
  p.rect(3, 17, 13, 3, 'G').rect(18, 17, 13, 3, 'G');
  // reflections
  p.px(5, 5, 'w').px(6, 4, 'w').px(20, 5, 'w').px(21, 4, 'w');
  // mullions and sill
  p.rect(16, 1, 2, 22, 'c').hl(1, 1, 32, 'c');
  p.rect(1, 20, 32, 3, 'c').hl(1, 22, 32, 'x');
  // hanging sign « ouvert »
  p.rect(22, 6, 7, 4, 'r').hl(23, 7, 5, 'w').hl(23, 8, 3, 'w');
  p.px(24, 4, 'd').px(27, 4, 'd').px(23, 5, 'd').px(28, 5, 'd');
  p.contour();
  return p.toString();
})();

/** Rotating rack of postcards. */
const CARTES = (() => {
  const p = px(16, 28);
  p.vl(7, 2, 23, 'G').vl(8, 2, 23, 'd');
  p.rect(4, 24, 8, 2, 'd').hl(4, 24, 8, 'G');
  const cards = ['b', 'p', 'l', 'y', 'v', 'B', 'o', 'a'];
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 2; i++) {
      const x = i ? 9 : 2;
      const y = 3 + row * 7;
      const c = cards[(row * 2 + i) % cards.length]!;
      p.rect(x, y, 5, 6, 'w').rect(x + 1, y + 1, 3, 3, c).hl(x + 1, y + 4, 3, 'g');
    }
  p.contour();
  return p.toString();
})();

/** Umbrella stand. */
const PARAPLUIES = (() => {
  const p = px(14, 22);
  // handles
  p.vl(4, 2, 10, 'd').px(3, 1, 'd').px(2, 2, 'd');
  p.vl(7, 0, 12, 'x').px(8, 0, 'x').px(9, 1, 'x');
  p.vl(10, 3, 9, 'd').px(11, 2, 'd');
  // folded canopies
  p.poly([[3, 6], [6, 6], [5.5, 13], [3.5, 13]], 'r');
  p.poly([[6, 5], [9, 5], [8.5, 13], [6.5, 13]], 'B');
  p.poly([[9, 7], [12, 7], [11.5, 13], [9.5, 13]], 'e');
  // bucket
  p.rect(2, 12, 10, 9, 'G').hl(2, 12, 10, 'g').vl(11, 12, 9, 'd').hl(2, 16, 10, 'd');
  p.contour();
  return p.toString();
})();

/** Jar of strawberry sweets (on the counter). */
const BOCAL = `
  ..kkkk..
  .kRRRRk.
  .kkkkkk.
  kWbbbbWk
  kWrpbrfk
  kbprrprk
  kbrrprWk
  kWpbrrWk
  .kWWWWk.
  ..kkkk..
`;

const CAISSE = `
  ......kkk.....
  .....kwwwk....
  .kkkkkwgwkkkk.
  kGggggwwwgggGk
  kgdddddddddgGk
  kgdbdbdbdbdgGk
  kgdddddddddgGk
  kGGGGGGGGGGGGk
  kgggggggggggGk
  kGGGGGGGGGGGdk
  .kkkkkkkkkkkk.
`;

/** Snow globe with a tiny sheep inside. */
const BOULE_NEIGE = `
  ..kkkk..
  .kbbfbk.
  kbwbbbbk
  kbbwwwbk
  kbwwGwwk
  kWWWWWWk
  .kCCCCk.
  kCcccCCk
  .kkkkkk.
`;

/** Strawberry sweet in its wrapper. */
const BONBON = `
  .k.kkk.k.
  kpkrfrkpk
  .k.krrk.k
  ....kk...
`;

// ---------------------------------------------------------------------------
// The shopkeeper (static, behind the counter) — an older lady with a grey bun and glasses.
// ---------------------------------------------------------------------------

const VENDEUSE = `
  ......kkkk......
  .....kWggGk.....
  ....kkgggGkk....
  ..kkgWggggggkk..
  .kgWggggggggGGk.
  .kgggsssssssgGk.
  .kgGssssssssSGk.
  .kgddddsddddSGk.
  .kgdkfdsdkfdSGk.
  .kGsSSssssSSsGk.
  ..kGsssttsssGk..
  ..kkkSssssSkkk..
  ...kkkSSSSkkk...
  ..keekqqqqkeek..
  .keeeekqqkeeeek.
  .keEeeekkeeeEek.
  .keEeeeeeeeeEek.
  .keEeeeYeeeeEek.
  .keEeeeeeeeeEek.
  .kssEeeeYeeeEssk
  .kkkEeeeeeeeEkkk
  ...keeeeeeeeEk..
  ...kdddddddddk..
  ...kkkkkkkkkkk..
`;

// ---------------------------------------------------------------------------
// The garden
// ---------------------------------------------------------------------------

/** A headstone. `kind`: 0 rounded, 1 pointed, 2 old and leaning, covered with ivy. */
function tombe(kind: 0 | 1 | 2): string {
  const p = px(18, 24);
  // slab at the bottom
  p.rect(1, 18, 16, 5, 'g').hl(1, 18, 16, 'W').hl(1, 22, 16, 'G').vl(16, 18, 5, 'G');
  // stone
  const top = kind === 1 ? 4 : 3;
  p.rect(3, top + 2, 12, 17 - top - 2, 'g');
  if (kind === 1)
    p.poly(
      [
        [3, 7],
        [9, 1],
        [15, 7],
      ],
      'g',
    );
  else p.oval(9, top + 3, 6, 3.6, 'g');
  // light from the top-left, shade on the right
  p.vl(3, top + 3, 13, 'W').vl(14, top + 3, 14, 'G').vl(13, top + 5, 12, 'G');
  p.px(5, top + 1, 'W').px(4, top + 2, 'W');
  // engraved lines (names nobody can read from here)
  p.hl(6, 9, 6, 'G').hl(7, 11, 4, 'G').hl(6, 13, 6, 'd').hl(7, 15, 4, 'G');
  if (kind === 2) {
    p.swap({ W: 'g' });
    for (let y = 4; y < 22; y++) for (let x = 2; x < 17; x++) if (p.get(x, y) !== '.' && hash(x, y, 4) < 0.35 - y * 0.008) p.px(x, y, hash(x, y, 9) < 0.5 ? 'e' : 'E');
    p.vl(3, 6, 12, 'E').px(4, 9, 'e').px(4, 13, 'e');
  }
  // a little pot of flowers on the slab (rounded one only)
  if (kind === 0) p.rect(12, 16, 3, 3, 'O').px(12, 15, 'p').px(14, 15, 'p').px(13, 14, 'y').px(13, 15, 'e');
  p.contour();
  return p.toString();
}

/** Mina's stone: small, white, a star carved in it, her faded paper crown on top. */
const TOMBE_MINA = (() => {
  const p = px(18, 22);
  p.rect(1, 16, 16, 5, 'W').hl(1, 16, 16, 'w').hl(1, 20, 16, 'g').vl(16, 16, 5, 'g');
  p.rect(4, 7, 10, 10, 'w');
  p.oval(9, 7.5, 5, 3.4, 'w');
  p.vl(4, 7, 10, 'f').vl(13, 6, 11, 'W').vl(12, 8, 9, 'W');
  // carved star
  p.px(8, 10, 'g').px(9, 10, 'g').px(8, 9, 'g').px(7, 11, 'g').px(10, 11, 'g').px(8, 12, 'g').px(9, 11, 'Q');
  p.hl(6, 14, 6, 'g');
  // paper crown, faded by the rain
  p.poly(
    [
      [5, 6],
      [5, 2],
      [7, 4],
      [9, 1],
      [11, 4],
      [13, 2],
      [13, 6],
    ],
    'Q',
  );
  p.hl(5, 5, 9, 'c').px(9, 2, 'q').px(6, 4, 'q');
  p.contour();
  return p.toString();
})();

/** Pinwheel planted in the ground, two frames. */
function moulin(frame: 0 | 1): string {
  const p = px(11, 18);
  p.vl(5, 6, 11, 'C').px(5, 17, 'x');
  if (frame === 0) {
    p.poly([[5, 5], [5, 1], [8, 1]], 'r');
    p.poly([[5, 5], [9, 5], [9, 8]], 'y');
    p.poly([[5, 5], [5, 9], [2, 9]], 'b');
    p.poly([[5, 5], [1, 5], [1, 2]], 'l');
  } else {
    p.poly([[5, 5], [8, 2], [9, 5]], 'r');
    p.poly([[5, 5], [8, 8], [5, 9]], 'y');
    p.poly([[5, 5], [2, 8], [1, 5]], 'b');
    p.poly([[5, 5], [2, 2], [5, 1]], 'l');
  }
  p.px(5, 5, 'w');
  p.contour();
  return p.toString();
}

/** Stone gate pillar. */
const PILIER = (() => {
  const p = px(14, 32);
  p.rect(2, 6, 10, 25, 'g').vl(2, 6, 25, 'W').vl(11, 6, 25, 'G').vl(10, 8, 23, 'G');
  for (const y of [11, 17, 23]) p.hl(3, y, 8, 'G');
  p.rect(1, 2, 12, 4, 'W').hl(1, 2, 12, 'w').hl(1, 5, 12, 'G');
  p.rect(4, 0, 6, 2, 'g').hl(4, 0, 6, 'W');
  p.contour();
  return p.toString();
})();

/** Garden tap on a post, with a bucket underneath. */
const ROBINET = (() => {
  const p = px(12, 22);
  p.rect(4, 2, 4, 18, 'g').vl(4, 2, 18, 'W').vl(7, 2, 18, 'G');
  p.rect(7, 5, 3, 2, 'G').px(9, 7, 'd').px(9, 8, 'b');
  p.rect(5, 1, 2, 1, 'r').rect(4, 0, 4, 1, 'R');
  p.rect(3, 19, 6, 2, 'G');
  p.contour();
  return p.toString();
})();

/** Watering can. */
const ARROSOIR = `
  ...kkkk.......
  ..kk..kk....k.
  .keeeeeek..kek
  keEeeeeeEkkeEk
  keeeeeeeEkeEk.
  keeeeeeeEkEk..
  keEEEEEEEkk...
  .kkkkkkkkk....
`;

/** A sparrow, pecking (2 frames). */
const MOINEAU = `
  ..kk....
  .kCCk...
  kCfCck..
  kOCcccCk
  .kcqccCk
  ..kkkkk.
  ...k.k..
`;
const MOINEAU_2 = `
  ........
  ...kkk..
  ..kcCCkk
  .kcqcCCk
  kCkcccCk
  kOkkkkk.
  ...k.k..
`;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  ...REAL_TILES,
  // nightlights on sale
  prop_vl_lune: lit(VL_LUNE),
  prop_vl_etoile: lit(VL_ETOILE),
  prop_vl_mouton: lit(VL_MOUTON),
  prop_vl_nuage: lit(VL_NUAGE),
  prop_vl_couronne: lit(VL_COURONNE),
  // shop
  prop_display_table: real(DISPLAY_TABLE),
  prop_vitrine: real(VITRINE),
  prop_cartes: real(CARTES),
  prop_parapluies: real(PARAPLUIES),
  prop_bocal: real(BOCAL),
  prop_caisse: real(CAISSE),
  prop_boule_neige: real(BOULE_NEIGE),
  prop_bonbon: lit(BONBON),
  npc_vendeuse: real(VENDEUSE),
  // garden
  prop_tombe_a: real(tombe(0)),
  prop_tombe_b: real(tombe(1)),
  prop_tombe_c: real(tombe(2)),
  prop_tombe_mina: real(TOMBE_MINA),
  prop_moulin: lit(moulin(0)),
  prop_moulin_2: lit(moulin(1)),
  prop_pilier: real(PILIER),
  prop_robinet: real(ROBINET),
  prop_arrosoir: real(ARROSOIR),
  npc_moineau: real(MOINEAU),
  npc_moineau_2: real(MOINEAU_2),
};

/** Transforms are set per sprite above: no automatic world variants. */
export const VARIANTS: string[] = [];

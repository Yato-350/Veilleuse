import type { CharDef, SpriteDef } from '../../game/assets';
import { CHARS as BASE_CHARS } from './characters';
import { Pix, rows } from './enemies';
import { ART as C5_ART } from './chapter5';
import { ART as PROP_ART } from './props';
import { ART as CHAR_ART } from './characters';
import { ART as ENEMY6_ART } from './enemies-ch6';
import { mix, realify } from '../../engine/palette';

/*
 * Chapter 6 « Le Ventre de Dodo » — the world (docs/HISTOIRE.md § 3.14, § 4 « Ch. 6 »). The inside of a plush:
 * damp yellowed cotton, foam gone yellow, Mina's red thread as walkways, pins hanging like stalactites, shelves of
 * jars labelled « Nuit 1 » to « Nuit 364 », the music box at Dodo's heart (a cylinder, a comb of baby teeth), the
 * corridor of the forty-one doors, and the voice module « REC / PLAY », as big as a cathedral, whose battery leaks a
 * white crust that spreads like rot. Mina's empty puppets hang from their strings. The body horror only ever touches
 * toys, cotton and plastic.
 *
 * The maps are of world `ouate`, which would turn every sprite into yellowed sepia: the sprites of this file are
 * already drawn in their final colours, so each one is registered a second time as `key@ouate` (see `keep` at the
 * bottom) and keeps its red thread, its steel and its crust. Noa himself (and every older sprite) is cottonified.
 *
 * Tiles `t_c6_*` (registered in src/data/tiles.ts as `c6_*`); the little girl in the knitted hat walking (`bonnet`,
 * faceless, and `bonnet_drawn`, her face drawn in pencil once Noa has looked at her); props `prop_c6_*`. Also her
 * far-off silhouette, seen from behind and faded (`npc_bonnet_loin`, `_2` half gone), placed in the earlier chapters
 * from chapter 1 on (T9, docs/HISTOIRE.md § 2.10).
 */

const N = 16;
/** A 16×16 tile painted pixel by pixel. */
const paint = (fn: (x: number, y: number) => string): string =>
  Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => fn(x, y)).join('')).join('\n');
/** Small deterministic hash in [0, 1). */
const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------------------------------

/** Inside the plush. */
const C6: Record<string, string> = {
  '6': '#efe6cc', // cotton, light
  '7': '#d9cba6', // cotton
  '8': '#b4a27f', // cotton, shade
  '9': '#86765c', // cotton, damp
  '%': '#5e5140', // soaked
  '&': '#3a3024', // deep shadow
  '@': '#221a12', // the dark between the tufts
  $: '#6f6a48', // mildew
  '+': '#f6f4ec', // battery crust
  '=': '#cfcab8', // crust, shade
  '^': '#8a5a3a', // rust
  '~': '#c8424f', // Mina's red thread
  '!': '#8e2a3a', // red thread, shade
  ';': '#ee8088', // red thread, light
  ':': '#d6dde6', // steel, light
  '<': '#9aa4b2', // steel
  '>': '#5f6878', // steel, dark
  '*': '#dcd6c6', // plastic, light
  '#': '#aaa290', // plastic
  '/': '#77705f', // plastic, dark
  '?': '#fff3b0', // light from outside / glow
  F: '#dcc47e', // foam
  U: '#f0dda0', // foam, light
  D: '#a08a4c', // foam pore
  T: '#6e5c30', // foam, deep pore
  I: '#efe8d4', // tooth (ivory)
  N: '#c9bfa5', // tooth, shade
  X: '#4a3726', // dark wood (shelves)
  '{': '#ecd08a', // brass, light
  '}': '#c39a4e', // brass
  '|': '#7e5f2c', // brass, dark
};

const sprite = (art: string, extra: Record<string, string> = {}): SpriteDef => ({ art, colors: { ...C6, ...extra } });

// ---------------------------------------------------------------------------------------------------------------------
// Tiles — cotton (cells of tufts, lit from the top-left, wrapping at 16 px so the tiles repeat without seams)
// ---------------------------------------------------------------------------------------------------------------------

/** Tuft centres for a seed (wrapped cells: a Worley pattern tiling at 16 px). */
function centres(seed: number, n: number): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => [hash(i, 1, seed) * N, hash(i, 2, seed) * N] as [number, number]);
}

/** Wrapped offset in [-8, 8). */
const wrap = (v: number): number => ((v + N * 1.5) % N) - N / 2;

/**
 * A tufted surface: a union of soft domes (the tufts), lit from the top-left; where two tufts press together, a
 * crease. `sx` squashes the tufts horizontally (walls: long bulges); `r` is the tuft radius range.
 */
function tufts(seed: number, n: number, ramp: [string, string, string, string], sx = 1, r: [number, number] = [4.5, 7]): (x: number, y: number) => string {
  const cs = centres(seed, n).map(([cx, cy], i) => [cx, cy, r[0] + hash(i, 3, seed) * (r[1] - r[0])] as const);
  const h = (x: number, y: number): number => {
    let best = 0;
    for (const [cx, cy, rr] of cs) {
      const dx = wrap(x + 0.5 - cx) * sx;
      const dy = wrap(y + 0.5 - cy);
      const v = 1 - (dx * dx + dy * dy) / (rr * rr);
      if (v > best) best = v;
    }
    return best;
  };
  return (x, y) => {
    const v = h(x, y);
    const lit = h(x + 1, y + 1) - h(x - 1, y - 1);
    if (v < 0.05) return ramp[3];
    if (v < 0.16) return lit > 0.1 ? ramp[1] : ramp[2];
    if (lit > 0.16) return ramp[0];
    if (lit < -0.22) return ramp[2];
    return ramp[1];
  };
}

/** Damp yellowed cotton, the floor of the plush. A few darker stains; now and then a single fibre. */
const cottonFloor = (seed: number, stain: boolean): string => {
  const base = tufts(seed, 7, ['6', '7', '8', '8'], 1, [4.8, 7.4]);
  return paint((x, y) => {
    const c = base(x, y);
    if (stain) {
      const sd = Math.hypot(wrap(x - 9 - seed), wrap(y - 10)) + hash(x, y, seed) * 1.6;
      if (sd < 3.2) return c === '6' ? '8' : c === '7' ? '9' : '%';
      if (sd < 4.4 && c === '7') return '8';
    }
    if (hash(x, y, seed + 3) < 0.025 && c === '7') return '6';
    return c;
  });
};

/** Soaked cotton: darker, heavy, a wet glint here and there. */
const soaked = (seed: number): string => {
  const base = tufts(seed, 6, ['7', '8', '9', '%']);
  return paint((x, y) => {
    const c = base(x, y);
    if (c === '8' && hash(x, y, seed + 5) < 0.12) return '6';
    return c;
  });
};

/** The face of a wall of cotton: long bulges stacked up, damp streaks running down. `base`: the foot of the wall. */
const cottonWall = (seed: number, base: boolean): string => {
  const t = tufts(seed, 6, ['7', '8', '9', '%'], 0.5, [4, 6]);
  return paint((x, y) => {
    let c = t(x, y);
    // One damp drip running down from a crease.
    const dx = 4 + ((seed * 5) % 8);
    const dy = (seed * 3) % 7;
    if (x === dx && y >= dy && y < dy + 5) c = y === dy + 4 ? '%' : c === '7' ? '9' : '%';
    if (base) {
      if (y >= 14) return y === 15 ? '&' : '%';
      if (y >= 12 && hash(x, y, seed + 7) < 0.55) return c === '7' ? '9' : '%';
    }
    return c;
  });
};

/** The top of a wall seen from above: a mass of dark, lumpy cotton. */
const cottonTop = (seed: number): string => paint(tufts(seed, 7, ['9', '%', '&', '@'], 1, [4, 6]));

/** The dark between the tufts: a pit. A few fibres catch what little light there is. */
const voidTile = (seed: number): string =>
  paint((x, y) => {
    const f = hash(x, y, seed);
    if (f < 0.04) return '&';
    // Short diagonal fibres.
    if ((x + y * 2 + seed) % 11 === 0 && hash(Math.floor(x / 3), Math.floor(y / 3), seed) < 0.3) return '&';
    if (f > 0.993) return '%';
    return '@';
  });

/** A walkway of Mina's red thread over a pit: three strands, tied together by short stitches. */
function threadBridge(dir: 'h' | 'v'): string {
  const p = Pix.of(voidTile(4));
  const put = (i: number, j: number, c: string): void => {
    if (dir === 'h') p.set(i, j, c);
    else p.set(j, i, c);
  };
  for (let i = 0; i < N; i++)
    for (const [k, s0] of [3, 7, 11].entries()) {
      const a = s0 + (Math.sin(((i + k * 5) / N) * Math.PI * 2) > 0.6 ? 1 : 0);
      put(i, a, (i + k * 3) % 6 === 0 ? ';' : '~');
      put(i, a + 1, '!');
    }
  // Stitches tying the strands.
  for (const i of [4, 12]) for (let j = 4; j <= 12; j++) if (j % 4 !== 3) put(i, j, j % 4 === 0 ? '~' : '!');
  return p.toString();
}

/** Yellowed foam (the music box chamber): cells full of pores. */
const foam = (seed: number): string => {
  const base = tufts(seed, 5, ['U', 'F', 'F', 'D'], 1, [5, 8]);
  return paint((x, y) => {
    for (let i = 0; i < 5; i++) {
      const px = hash(i, 7, seed) * N;
      const py = hash(i, 8, seed) * N;
      const r = 0.8 + hash(i, 9, seed) * 1.4;
      const d = Math.hypot(wrap(x + 0.5 - px), wrap(y + 0.5 - py) * 1.2);
      if (d < r * 0.55) return 'T';
      if (d < r) return wrap(y + 0.5 - py) < 0 ? 'T' : 'D';
    }
    return base(x, y);
  });
};

/**
 * The battery's crust spreading over the cotton: white crystals, a dark rotten ring where it eats into the tufts.
 * `cover` 0..1.
 */
const crust = (seed: number, cover: number): string => {
  const base = tufts(seed, 6, ['6', '7', '8', '9']);
  return paint((x, y) => {
    const f =
      Math.sin(((x + seed * 3) / N) * Math.PI * 2) * 0.5 + Math.sin(((y + seed) / N) * Math.PI * 4 + Math.sin((x / N) * Math.PI * 2)) * 0.5 + hash(x, y, seed) * 0.35;
    const k = cover * 2 - 1;
    if (f < k - 0.25) {
      const g = hash(x, y, seed + 11);
      return g < 0.12 ? ':' : g < 0.42 ? '=' : '+';
    }
    if (f < k) return hash(x, y, seed + 2) < 0.5 ? '=' : '9';
    if (f < k + 0.18) return hash(x, y, seed + 4) < 0.6 ? '%' : '$';
    return base(x, y);
  });
};

/** The plastic floor around the voice module: moulded panels, a screw. */
const plastic = (seed: number): string =>
  paint((x, y) => {
    if (y === 0 || x === 0) return '*';
    if (y === 15 || x === 15) return '/';
    if ((seed === 2 && x >= 6 && x <= 8 && y >= 6 && y <= 8) || (seed === 1 && x >= 11 && x <= 13 && y >= 2 && y <= 4)) {
      const cx = seed === 2 ? 7 : 12;
      const cy = seed === 2 ? 7 : 3;
      if (x === cx || y === cy) return '/';
      return '<';
    }
    if (hash(x, y, seed) < 0.06) return '/';
    if (hash(x, y, seed + 1) < 0.08) return '*';
    return '#';
  });

/** The back of the plush's fabric, seen from inside: a coarse twill, wool poking through in tufts. */
const fabric = (seed: number, base: boolean): string => {
  const fur = tufts(seed + 20, 3, ['6', '7', '7', '8'], 1, [2, 3.2]);
  return paint((x, y) => {
    if (base && y >= 13) return y === 15 ? '&' : '%';
    const twill = (x + y) % 4;
    let c = twill === 0 ? '9' : twill === 1 ? '8' : '7';
    if (y % 8 === 7 && x % 2 === 0) c = '9';
    const f = fur(x, y);
    if (f === '6' || (f === '7' && hash(x, y, seed) < 0.3)) c = f;
    return c;
  });
};

/** The seam Noa fell through: a slit of light between the two edges of the fabric, crossed by big red stitches. */
function seamSlit(base: boolean): string {
  const p = Pix.of(fabric(3, base));
  for (let y = 0; y < N; y++) {
    const w = base && y >= 13 ? 0 : 2;
    for (let x = 8 - w; x <= 7 + w; x++) p.set(x, y, Math.abs(x - 7.5) < 1 ? '?' : 'y');
    p.set(8 - w - 1, y, '9').set(8 + w, y, '9');
    // A big stitch every five rows, across the slit.
    if (y % 5 === 1) for (let x = 3; x <= 12; x++) p.set(x, y, x === 3 || x === 12 ? '!' : '~').set(x, y + 1, x % 3 === 0 ? '!' : p.get(x, y + 1));
  }
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// The little girl in the knitted hat, walking (faceless; then her face drawn in pencil)
// ---------------------------------------------------------------------------------------------------------------------

/** Her head, 16×12: the cream knitted hat with two sheep ears, and where the face should be, blank paper. */
const HAT: Record<'down' | 'up' | 'left', string> = {
  down: `
    .......kk.......
    ......k67k......
    ....kkk77kkk....
    ...k67676767k...
    ..k6767676778k..
    ..k7878787888k..
    .kk8989898989kk.
    k67kqqqqqqqqk76k
    k78kqqqqqqqqk87k
    k89kqqqqqqqqk98k
    .kkkkqqqqqqkkkk.
    .....kkkkkk.....
  `,
  up: `
    .......kk.......
    ......k67k......
    ....kkk77kkk....
    ...k67676767k...
    ..k6767676778k..
    ..k7878787888k..
    .kk7878787888kk.
    k67k89898989k76k
    k78kSSSSSSSSk87k
    k89kkSSSSSSkk98k
    .kk..kkkkkk..kk.
    .....kSSSSk.....
  `,
  left: `
    ........kk......
    .......k67k.....
    .....kkk77kkk...
    ....k67676767k..
    ...k6767676778k.
    ...k7878787888k.
    ..kk898989898kk.
    .kqqqqqqk8k67k..
    .kqqqqqqk8k78k..
    .kqqqqqqk9k89k..
    ..kqqqqk.kkkk...
    ...kkkk.........
  `,
};

/** Her pencil face once Noa has looked at her (§ 2.10): tired eyes, a small smile. Drawn in graphite grey. */
const DRAWN: Record<'down' | 'left', Array<[number, number, string]>> = {
  down: [
    [6, 8, 'd'],
    [9, 8, 'd'],
    [6, 9, 'G'],
    [9, 9, 'G'],
    [7, 10, 'd'],
    [8, 10, 'd'],
  ],
  left: [
    [3, 8, 'd'],
    [3, 10, 'd'],
    [4, 10, 'G'],
  ],
};

/** A cardigan too big for her, cream, down to her knees; her slippers. Replaces Mina's dress and boots. */
function bonnetFrame(frame: string, dir: 'down' | 'up' | 'left', drawn: boolean): string {
  const r = rows(frame);
  const crown = r.findIndex((l) => l.includes('kyky'));
  const top = Math.max(0, crown - 1);
  const head = rows(HAT[dir]);
  if (drawn && dir !== 'up') {
    const p = Pix.of(head.join('\n'));
    for (const [x, y, c] of DRAWN[dir]) p.set(x, y, c);
    head.splice(0, head.length, ...rows(p.toString()));
  }
  const body = r.slice(crown + 11).map((l) =>
    l
      .replace(/[rR]/g, (c) => (c === 'r' ? 'W' : 'g'))
      .replace(/y/g, 'W')
      .replace(/x/g, 'w')
      .replace(/m|M/g, 'g'),
  );
  return [...r.slice(0, top), ...head, ...body].join('\n');
}

const MINA = BASE_CHARS.mina!;
const bonnetChar = (drawn: boolean): CharDef => ({
  down: MINA.down.map((f) => bonnetFrame(f, 'down', drawn)),
  up: MINA.up.map((f) => bonnetFrame(f, 'up', drawn)),
  left: MINA.left.map((f) => bonnetFrame(f, 'left', drawn)),
  opts: { colors: C6 },
});

/**
 * Her silhouette far off, seen from behind (chapters 1–3): the same girl, washed in the dusk of the dream so she reads
 * as a shape rather than a character. `half` drops every other pixel: the frame just before she is gone.
 */
function bonnetFar(half: boolean): SpriteDef {
  let art = bonnetFrame(MINA.up[0]!, 'up', false);
  if (half) art = rows(art).map((l, y) => [...l].map((c, x) => ((x + y) % 2 ? c : '.')).join('')).join('\n');
  return { art, colors: C6, transform: (hex) => mix(hex, '#8478a0', 0.55) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Props — the jars of the nights
// ---------------------------------------------------------------------------------------------------------------------

type JarContent = 'coton' | 'fil' | 'bouton' | 'dent' | 'encre' | 'trempe' | 'vide' | 'laine';

/** One jar (10×12): glass, a rusty lid tied with string, a label, and something inside. */
function jar(p: Pix, x: number, y: number, content: JarContent, label: 'oui' | 'non' | 'vide'): void {
  // Glass body.
  p.rect(x + 1, y + 3, 8, 9, '=');
  p.rect(x, y + 4, 1, 7, '>').rect(x + 9, y + 4, 1, 7, '>').rect(x + 1, y + 12, 8, 1, '>');
  p.set(x + 1, y + 3, '>').set(x + 8, y + 3, '>');
  // Lid.
  p.rect(x + 1, y + 1, 8, 2, '^').rect(x + 2, y, 6, 1, '^');
  p.set(x + 2, y + 1, '}').set(x + 3, y + 1, '}');
  p.rect(x + 1, y + 3, 8, 1, '!');
  // Contents (the lower part of the jar).
  const fill: Record<JarContent, (i: number, j: number) => string | null> = {
    coton: (i, j) => (j > 3 ? ((i + j) % 3 === 0 ? '8' : '6') : null),
    laine: (i, j) => (j > 2 ? ((i * 3 + j) % 4 === 0 ? 'G' : 'w') : null),
    fil: (i, j) => (j > 4 ? ((i + j * 2) % 3 === 0 ? '!' : (i + j) % 2 === 0 ? '~' : '=') : null),
    bouton: (i, j) => (j > 5 ? '%' : j > 2 && i >= 2 && i <= 5 && j <= 5 ? (j === 4 && (i === 3 || i === 4) ? '=' : 'k') : null),
    dent: (i, j) => (j > 6 ? '9' : j > 3 && i >= 2 && i <= 4 ? (i === 2 ? 'I' : 'N') : null),
    encre: (i, j) => (j > 3 ? (j === 4 ? (i % 3 === 0 ? '9' : '%') : '@') : null),
    trempe: (i, j) => (j > 1 ? (j > 6 ? '%' : (i + j) % 3 === 0 ? '9' : '8') : null),
    vide: () => null,
  };
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const c = fill[content](i, j);
      if (c) p.set(x + 1 + i, y + 4 + j, c);
    }
  // Glint on the glass.
  p.set(x + 2, y + 5, '+').set(x + 2, y + 6, '+').set(x + 2, y + 9, ':');
  // The label: a paper square with a scribbled line (or blank, or none at all).
  if (label !== 'non') {
    p.rect(x + 3, y + 6, 5, 4, '6');
    p.set(x + 3, y + 6, '7').set(x + 7, y + 9, '8');
    if (label === 'oui') p.rect(x + 4, y + 7, 3, 1, '9').rect(x + 4, y + 8, 2, 1, '9');
  }
}

const SHELF_SETS: JarContent[][] = [
  ['coton', 'fil', 'bouton', 'trempe', 'dent', 'coton'],
  ['encre', 'coton', 'laine', 'bouton', 'trempe', 'fil'],
  ['dent', 'trempe', 'coton', 'fil', 'laine', 'encre'],
];

/** A shelf of jars (34×34): two dark boards, three jars on each, all labelled « Nuit N ». */
function shelf(set: number, gap = -1): string {
  const p = new Pix(34, 34);
  // Uprights and boards.
  p.rect(0, 0, 2, 34, 'X').rect(32, 0, 2, 34, 'X');
  p.rect(0, 15, 34, 2, 'X').rect(0, 32, 34, 2, 'X');
  p.rect(2, 17, 30, 1, '&').rect(2, 0, 30, 1, '&');
  for (let x = 2; x < 32; x += 5) p.set(x, 15, '^');
  const contents = SHELF_SETS[set % SHELF_SETS.length]!;
  for (let i = 0; i < 6; i++) {
    if (i === gap) continue;
    const row = Math.floor(i / 3);
    jar(p, 2 + (i % 3) * 10, row === 0 ? 2 : 19, contents[i]!, 'oui');
  }
  // Mildew creeping up the left upright, a drip from the top board.
  for (let y = 20; y < 32; y++) if (y % 3 !== 0) p.set(1, y, '$');
  p.set(18, 17, '%').set(18, 18, '%');
  return p.contour('k').toString();
}

/** A jar alone on the floor (12×14). */
function lone(content: JarContent, label: 'oui' | 'non' | 'vide'): string {
  const p = new Pix(12, 14);
  jar(p, 1, 0, content, label);
  return p.contour('k').toString();
}

/** « Nuit 1 », fallen on its side in a puddle under a dripping pin (22×12). */
const FALLEN = (() => {
  const p = new Pix(22, 12);
  p.ellipse(11, 8, 11, 3.5, '%');
  p.ellipse(10, 8, 7, 2.2, '9');
  p.set(6, 7, '6').set(15, 9, '6');
  // The jar on its side: lid to the right.
  p.rect(3, 2, 11, 7, '=').rect(3, 1, 11, 1, '>').rect(3, 9, 11, 1, '>');
  p.rect(14, 2, 2, 7, '^').rect(16, 3, 1, 5, '^');
  p.rect(4, 5, 9, 4, '6');
  p.rect(6, 3, 4, 3, '6').set(6, 3, '7').rect(7, 4, 2, 1, '9');
  p.set(4, 3, '+').set(5, 3, '+');
  return p.contour('k').toString();
})();

/** Pins hanging from the ceiling like stalactites (16×30): three long pins, a drop at each tip. */
function pins(v: number): string {
  const p = new Pix(16, 30);
  const heads = ['r', 'y', 'b', 'p', '~', 'Y'];
  const set = [
    [2, 22, 0],
    [7, 28, 1],
    [12, 17, 2],
  ];
  for (const [x, len, k] of set) {
    const hx = x! + (v % 2);
    // The shaft: two pixels of steel, lit on the left, a dark edge on the right.
    for (let y = 4; y < len!; y++) p.set(hx, y, y % 5 === 0 ? ':' : '<').set(hx + 1, y, '>');
    p.set(hx, len!, ':');
    if ((k! + v) % 2 === 0) p.set(hx, len! + 1, '9').set(hx, len! + 2, '%');
    // The head: a glass bead outlined by hand.
    const c = heads[(k! + v) % heads.length]!;
    p.stamp(`.kk.\nk${c}${c}k\nk${c}${c}k\n.kk.`, hx - 1, 1);
    p.set(hx, 2, 'w');
  }
  return p.toString();
}

/** A sewing pin as tall as Noa, stuck slantwise in the cotton (16×28). */
const PIN_FLOOR = (() => {
  const p = new Pix(16, 28);
  p.ellipse(4, 25.5, 4, 2, '8');
  p.set(3, 25, '9').set(5, 25, '9').set(4, 26, '%');
  for (let i = 0; i <= 18; i++) {
    const x = 11 - (i * 7) / 18;
    const y = 7 + i;
    p.set(x, y, '<').set(x + 1, y, '>').set(x - 1, y, i % 4 === 0 ? ':' : '<');
  }
  p.ellipse(12, 4, 3.5, 3.5, 'r');
  p.ellipse(11, 3, 1.6, 1.6, 'p');
  p.set(10, 2, 'w');
  return p.contour('k').toString();
})();

/** The nest Noa made from the emptied sheep (chapter 4): a ring of torn cotton, two crosses that were eyes (32×18). */
const NEST = (() => {
  const p = new Pix(32, 18);
  p.blob(
    [
      [6, 10, 6],
      [13, 7, 6],
      [21, 7, 6],
      [26, 10, 6],
      [20, 13, 5],
      [11, 13, 5],
    ],
    ['6', '7', '8', '9'],
    [16, 10, 16, 8],
  );
  p.ellipse(16, 10.5, 8, 3.5, '9');
  p.ellipse(16, 11, 6, 2.5, '%');
  // Scraps of sheep: an ear, two crosses of black thread where button eyes were.
  p.set(5, 7, 'k').set(7, 9, 'k').set(7, 7, 'k').set(5, 9, 'k').set(6, 8, 'k');
  p.set(25, 6, 'k').set(27, 8, 'k').set(27, 6, 'k').set(25, 8, 'k').set(26, 7, 'k');
  p.ellipse(28, 12, 2, 1.5, 'G');
  p.set(13, 10, 'w').set(18, 11, 'w');
  return p.contour('k').toString();
})();

/** The seam that shuts the way out of the wadding (16×32): sewn with crosses of red thread; then cut, gaping. */
function sealedSeam(open: boolean): string {
  const p = new Pix(16, 32);
  p.rect(2, 0, 12, 32, '8');
  for (let y = 0; y < 32; y++) {
    const w = open ? Math.round(Math.sin((y / 31) * Math.PI) * 4) : 0;
    p.rect(7 - w, y, 2 + w * 2, 1, open ? '@' : '9');
    if (open && w > 1) p.set(7 - w, y, '%').set(8 + w, y, '%');
    if (!open && y % 5 === 2) {
      // A cross of red thread.
      p.line(4, y - 1, 11, y + 2, '~');
      p.line(4, y + 2, 11, y - 1, '~');
      p.set(4, y - 1, '!').set(11, y + 2, '!');
    } else if (open && y % 5 === 2) {
      // Cut threads, hanging.
      p.set(7 - w - 1, y, '~').set(7 - w - 2, y + 1, '~').set(8 + w + 1, y, '~').set(8 + w + 2, y + 1, '!');
    }
  }
  if (open) for (let y = 10; y < 22; y += 3) p.set(7, y, '&').set(8, y + 1, '&');
  for (let y = 0; y < 32; y += 2) p.set(2, y, '7').set(13, y + 1, '9');
  return p.contour('k').toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Props — the music box at Dodo's heart
// ---------------------------------------------------------------------------------------------------------------------

/** The lullaby written as pins on the cylinder (rows of the comb, one per column). */
const PIN_ROWS = [2, 4, 5, 4, 3, 2, 1, 2, 4, 6, 5, 4, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 2, 3, 4, 2, 1, 0, 1, 3, 4, 5];

/** The brass cylinder of the music box, as wide as a room (128×44), its pins, the axle and its bearings. */
function cylinder(turn: number): string {
  const p = new Pix(128, 44);
  // Bearings.
  for (const x of [0, 118]) {
    p.rect(x, 4, 10, 36, '>').rect(x + 1, 5, 8, 34, '<');
    p.rect(x + 2, 6, 3, 30, ':');
    p.ellipse(x + 5, 22, 3, 3, '|');
  }
  // The drum, lit from above.
  for (let y = 6; y < 38; y++) {
    const t = (y - 6) / 31;
    const c = t < 0.12 ? '{' : t < 0.55 ? '}' : t < 0.85 ? '|' : '^';
    p.rect(10, y, 108, 1, c);
  }
  p.rect(10, 9, 108, 1, '{');
  // Pins: one column per note, sliding with the turn.
  PIN_ROWS.forEach((r, i) => {
    const x = 12 + ((i * 3 + turn) % 104);
    const y = 8 + r * 4;
    p.set(x, y, ':').set(x, y + 1, '<');
    if (y < 20) p.set(x + 1, y, '+');
  });
  // Scratches, dents, a smear of cotton stuck to the brass.
  for (let i = 0; i < 18; i++) p.set(14 + ((i * 37) % 100), 10 + ((i * 13) % 24), '|');
  p.ellipse(96, 33, 6, 2, '8').set(93, 32, '6');
  return p.contour('k').toString();
}

/**
 * The comb under the cylinder (112×22): its teeth are baby teeth, small and uneven, set in a steel bar. `missing`
 * teeth leave a black gap (the three Noa has to put back).
 */
function comb(missing: number): string {
  const p = new Pix(112, 22);
  p.rect(0, 14, 112, 8, '<');
  p.rect(0, 14, 112, 2, ':').rect(0, 20, 112, 2, '>');
  for (let x = 4; x < 112; x += 12) p.ellipse(x, 18, 1.5, 1.5, '>');
  const gaps = [3, 7, 11].slice(0, missing);
  const out = p.contour('k');
  for (let i = 0; i < 14; i++) {
    const x = 2 + i * 8;
    const h = 7 + ((i * 5) % 4);
    if (gaps.includes(i)) {
      // An empty socket: a dark hole in the bar.
      out.rect(x + 1, 14, 4, 2, '@').set(x + 2, 13, 'k').set(x + 3, 13, 'k');
      continue;
    }
    // A milk tooth, set in the bar: a rounded crown, a little worn, uneven.
    const top = 14 - h;
    out.rect(x, top + 1, 6, h, 'k');
    out.rect(x + 1, top, 4, 1, 'k');
    out.rect(x + 1, top + 1, 4, h - 1, 'I');
    out.rect(x + 4, top + 2, 1, h - 2, 'N');
    out.set(x + 2, top + 2, 'f');
    if (i % 3 === 1) out.set(x + 3, top + 1, 'N');
  }
  return out.toString();
}

/** The crank of the music box (16×28): brass, the handle worn by a small hand. */
const CRANK = (() => {
  const p = new Pix(16, 28);
  p.rect(6, 10, 4, 18, '|').rect(7, 10, 2, 18, '}').rect(7, 11, 1, 14, '{');
  p.rect(1, 6, 14, 4, '}').rect(1, 6, 14, 1, '{').rect(1, 9, 14, 1, '|');
  p.ellipse(3, 4, 2.5, 3, 'X').set(2, 2, 'x');
  p.ellipse(8, 8, 2, 2, '|');
  return p.contour('k').toString();
})();

/** A baby tooth lying in the foam (8×9), with a glint on the second frame. */
function tooth(glint: boolean): string {
  const p = Pix.of(`
    ........
    ..kkkk..
    .kIIINk.
    .kIIINk.
    .kIIINk.
    ..kINk..
    ..kNNk..
    .DDkkDD.
    ..DDDD..
  `);
  p.set(3, 2, glint ? 'f' : 'I').set(3, 3, glint ? 'f' : 'I');
  if (glint) p.set(1, 1, 'f').set(6, 0, 'f');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Props — the voice module, the battery's crust, Mina's empty puppets
// ---------------------------------------------------------------------------------------------------------------------

/** 3×5 capitals for the moulded letters of the module. */
const CAPS: Record<string, string[]> = {
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  E: ['###', '#..', '##.', '#..', '###'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  L: ['#..', '#..', '#..', '#..', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '0': ['.#.', '#.#', '#.#', '#.#', '.#.'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '##.', '#.#', '.#.'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['.#.', '#.#', '.#.', '#.#', '.#.'],
  '9': ['.#.', '#.#', '.##', '..#', '##.'],
  ':': ['...', '.#.', '...', '.#.', '...'],
};
function letters(p: Pix, text: string, x: number, y: number, c: string): void {
  [...text].forEach((ch, i) => {
    const g = CAPS[ch];
    if (!g) return;
    g.forEach((row, j) => [...row].forEach((v, k) => v === '#' && p.set(x + i * 4 + k, y + j, c)));
  });
}

/**
 * The voice module « Mon doudou qui parle ! » as big as a cathedral (176×120): moulded beige plastic, a speaker
 * grille, the two buttons REC and PLAY, the battery hatch bulging open, the crust oozing out of it and down, Mina's
 * big red stitches holding the whole thing inside the cotton. `rot` 0..2: the crust has spread further.
 */
function voiceModule(rot: number): string {
  const p = new Pix(176, 120);
  // The housing, slightly in perspective: a top face, a front face.
  p.poly(
    [
      [14, 10],
      [162, 10],
      [170, 24],
      [6, 24],
    ],
    '*',
  );
  p.rect(6, 24, 164, 82, '#');
  p.rect(6, 24, 164, 3, '*');
  p.rect(6, 100, 164, 6, '/');
  for (let x = 20; x < 160; x += 28) p.rect(x, 12, 14, 1, '#');
  // Speaker grille: a round field of holes in a moulded ring.
  for (let y = 34; y < 96; y++)
    for (let x = 16; x < 86; x++) {
      const d = Math.hypot(x - 50, (y - 64) * 1.12);
      if (d < 28) p.set(x, y, x % 4 < 2 && y % 4 < 2 ? (x % 4 === 0 && y % 4 === 0 ? '&' : '%') : d < 26 ? '/' : '#');
      else if (d < 29.5) p.set(x, y, '/');
      else if (d < 31) p.set(x, y, y < 64 ? '*' : '#');
    }
  // The two buttons: REC (a red dot) and PLAY (a triangle), round, worn shiny by a thumb.
  for (const [cx, kind] of [
    [110, 'rec'],
    [146, 'play'],
  ] as const) {
    p.ellipse(cx, 50, 14, 13, '/');
    p.ellipse(cx, 48, 13, 12, kind === 'rec' ? 'R' : '>');
    p.ellipse(cx - 2, 46, 9, 8, kind === 'rec' ? 'r' : '<');
    p.ellipse(cx - 5, 43, 3, 2, kind === 'rec' ? 'p' : ':');
    if (kind === 'rec') p.ellipse(cx, 48, 4, 4, 'R');
    else p.poly([[cx - 4, 42], [cx + 6, 48], [cx - 4, 54]], 'w');
    letters(p, kind === 'rec' ? 'REC' : 'PLAY', cx - (kind === 'rec' ? 6 : 8), 66, '/');
  }
  letters(p, '2', 156, 82, '/');
  // The battery hatch, bulging open; the crust oozes out of it and runs down the front.
  p.rect(98, 76, 58, 24, '/').rect(100, 78, 54, 20, '&');
  // Three button cells (LR44), swollen, one pushed half out of its slot.
  for (const [cx, cy] of [
    [110, 87],
    [127, 88],
    [144, 90],
  ]) {
    p.ellipse(cx, cy, 7, 7, '>');
    p.ellipse(cx - 0.5, cy - 0.5, 6, 6, '<');
    p.ellipse(cx - 1.5, cy - 1.5, 4, 4, ':');
    p.ellipse(cx, cy, 2, 2, '<');
    p.set(cx - 3, cy - 3, 'f');
  }
  // Rust and damp at the foot.
  for (let x = 8; x < 168; x += 3) if ((x * 7) % 5 < 2) p.set(x, 104, '^');
  const out = p.contour('k');
  // The crust oozes out of the hatch and runs down the front like rot: crystals, a moulder ring, drips.
  const ooze: Array<[number, number, number]> = [
    [108, 99, 6],
    [126, 101, 8],
    [146, 99, 6],
    [117, 108, 5],
    [137, 110, 6],
    [104, 112, 4],
    [152, 112, 5],
  ];
  for (const [x, y, r] of ooze.slice(0, 3 + rot * 2)) {
    for (let j = -r; j <= r; j++)
      for (let i = -r - 2; i <= r + 2; i++) {
        const d = Math.hypot(i / (r + 2), j / r) + (Math.sin(i * 1.7 + j * 2.3 + x) * 0.12);
        if (d > 1) continue;
        const c = d > 0.86 ? (((i + j) & 1) === 0 ? '%' : '$') : d > 0.6 ? '=' : ((i * 3 + j * 5) & 7) === 0 ? ':' : '+';
        out.set(x + i, y + j, c);
      }
    // Drips down the plastic.
    for (let k = 0; k < 3; k++) {
      const dx = x - r + 2 + k * r;
      for (let dy = 0; dy < 4 + ((dx * 3) % 5); dy++) out.set(dx, y + r + dy - 1, dy % 3 === 2 ? '=' : '+');
    }
  }
  // Crystals that crept up out of the hatch.
  for (let i = 0; i < 8 + rot * 6; i++) out.set(100 + ((i * 29) % 54), 74 - ((i * 7) % 12), i % 2 ? '+' : '=');
  // Mina's big stitches holding it into the cotton: red thread through holes punched in the plastic.
  for (const [x, y] of [
    [6, 34],
    [6, 70],
    [169, 34],
    [169, 70],
    [40, 105],
    [88, 105],
    [136, 105],
  ]) {
    out.rect(x - 1, y - 1, 3, 3, '&');
    const dx = x < 20 ? -6 : x > 160 ? 6 : 0;
    const dy = y > 100 ? 8 : 0;
    out.line(x, y, x + dx - 2, y + dy + 5, '~');
    out.line(x + 1, y, x + dx - 1, y + dy + 5, '!');
    out.line(x, y, x + dx + 2, y + dy + (dx ? -5 : 5), '~');
  }
  return out.toString();
}

/** The battery's crust spreading over the cotton floor (40×18), like mould: three stages. */
function crustBlob(stage: number): string {
  const p = new Pix(40, 18);
  const parts: Array<[number, number, number, number]> = [
    [12, 9, 9, 4],
    [25, 10, 8, 4],
    [19, 6, 6, 3],
    [33, 12, 5, 3],
    [6, 13, 5, 3],
  ];
  for (const [x, y, rx, ry] of parts.slice(0, 2 + stage))
    for (let j = -ry - 2; j <= ry + 2; j++)
      for (let i = -rx - 2; i <= rx + 2; i++) {
        const d = Math.hypot(i / rx, j / ry) + Math.sin(i * 1.3 + j * 2.1 + x) * 0.18;
        if (d > 1.25) continue;
        const cur = p.get(x + i, y + j);
        const c = d > 1 ? (((i + j) & 1) === 0 ? '%' : '$') : d > 0.7 ? '=' : ((i * 5 + j * 3) & 7) === 0 ? ':' : '+';
        if (cur === '+' || cur === ':' || (cur === '=' && (c === '%' || c === '$'))) continue;
        p.set(x + i, y + j, c);
      }
  return p.toString();
}

/**
 * Mina's empty puppets, hanging from their strings (22×54): a crossbar, strings, and the costume with nobody inside.
 * `princesse`: the pencil princess's dress and paper crown. `feutre`: the felt doll's dress, flat, its crown sewn on.
 */
function puppet(kind: 'princesse' | 'feutre', sway: number): string {
  const p = new Pix(22, 54);
  const cx = 11 + sway;
  const dress = kind === 'princesse' ? ['p', 'P'] : ['r', 'R'];
  // The dress hangs limp, a little twisted.
  for (let y = 22; y < 48; y++) {
    const w = 3 + Math.floor((y - 22) / 4);
    const off = Math.round(Math.sin((y - 22) * 0.18 + sway) * 1.2);
    for (let x = cx - w + off; x <= cx + w + off; x++) {
      const hatch = kind === 'princesse' ? (x + y) % 3 === 0 : (x * 3 + y) % 7 === 0;
      p.set(x, y, hatch ? dress[1]! : dress[0]!);
    }
  }
  // Empty sleeves dangling.
  for (const sgn of [-1, 1]) for (let k = 0; k < 9; k++) p.set(cx + sgn * (4 + Math.floor(k / 3)), 22 + k, k % 3 === 2 ? dress[1]! : dress[0]!).set(cx + sgn * (5 + Math.floor(k / 3)), 22 + k, dress[1]!);
  const out = p.contour('k');
  // A collar and nothing above it.
  out.rect(cx - 3, 21, 7, 1, 'k').rect(cx - 2, 20, 5, 1, kind === 'princesse' ? 'w' : 'W').set(cx - 3, 20, 'k').set(cx + 3, 20, 'k');
  // Crossbar and strings (to the sleeves and to the crown).
  out.rect(2, 0, 18, 3, 'C').rect(2, 0, 18, 1, 'c').rect(2, 3, 18, 1, 'x').rect(10, 3, 2, 3, 'C');
  out.line(3, 4, cx - 6, 30, 'g');
  out.line(18, 4, cx + 6, 30, 'g');
  out.line(11, 6, cx, 12, 'g');
  // The crown, tilted, hanging by its string where a head should be.
  const crown = kind === 'princesse' ? ['y', 'Y'] : ['o', 'O'];
  out.stamp(`k.k.k\n${crown[0]}k${crown[0]}k${crown[0]}\n${crown[0]}${crown[0]}${crown[0]}${crown[0]}${crown[0]}\n${crown[1]}${crown[1]}${crown[1]}${crown[1]}${crown[1]}\nkkkkk`, cx - 2, 12);
  // The hem: pencil marks for the princess; the felt doll's hem has come unsewn, a thread trails.
  if (kind === 'princesse') for (let x = cx - 8; x <= cx + 8; x += 3) out.set(x, 48, 'P');
  else out.line(cx + 4, 48, cx + 6, 53, '~');
  if (kind === 'feutre') for (let y = 26; y < 46; y += 6) out.set(cx - 3, y, '~').set(cx + 3, y + 3, '~');
  return out.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Props — the corridor of the forty-one doors, the button eyes, the 3:38 room
// ---------------------------------------------------------------------------------------------------------------------

/** A small brass number plate for door `n` (13×9). */
function plate(n: number): string {
  const p = new Pix(13, 9);
  p.rect(0, 0, 13, 9, '}').rect(0, 0, 13, 1, '{').rect(0, 8, 13, 1, '|');
  const s = String(n);
  letters(p, s, s.length === 1 ? 5 : 2, 2, 'k');
  return p.contour('k').toString();
}

/** A cotton tuft creeping over the foot of a wall (16×10). */
function creep(v: number): string {
  const p = new Pix(16, 10);
  const pts: Array<[number, number, number]> =
    v === 0
      ? [
          [3, 6, 3],
          [8, 5, 4],
          [13, 7, 3],
        ]
      : [
          [4, 7, 3],
          [10, 6, 3.5],
        ];
  p.blob(pts, ['6', '7', '8', '9'], [8, 6, 8, 4]);
  return p.contour('k').toString();
}

/** One of Dodo's button eyes as big as a window (48×48): four holes, the cross of red thread. `lit`: it glows. */
function buttonEye(lit: boolean): string {
  const p = new Pix(48, 48);
  p.ellipse(24, 24, 23, 23, 'k');
  p.ellipse(24, 24, 21, 21, lit ? 'j' : 'K');
  p.ellipse(22, 22, 17, 17, lit ? 'J' : 'd');
  p.ellipse(18, 17, 6, 4, lit ? '?' : 'G');
  // The rim of the button.
  for (let a = 0; a < Math.PI * 2; a += 0.03) p.set(24 + Math.cos(a) * 19, 24 + Math.sin(a) * 19, lit ? 'z' : 'k');
  // Four holes and the cross of red thread.
  for (const [x, y] of [
    [17, 17],
    [31, 17],
    [17, 31],
    [31, 31],
  ]) p.ellipse(x, y, 3, 3, lit ? '?' : 'k').ellipse(x, y, 1.5, 1.5, lit ? 'f' : '0');
  p.line(17, 17, 31, 31, '~').line(18, 17, 31, 30, '!');
  p.line(31, 17, 17, 31, '~').line(30, 17, 17, 30, '!');
  return p.toString();
}

/** Noa's headphones on the floor (16×12): the cord wound so tight around the band that it has cut into the plastic. */
const HEADPHONES = (() => {
  const p = new Pix(16, 12);
  p.ellipse(3.5, 8, 3, 3.5, 'd').ellipse(12.5, 8, 3, 3.5, 'd');
  p.ellipse(3, 7.5, 1.5, 2, 'G').ellipse(12, 7.5, 1.5, 2, 'G');
  for (let x = 2; x < 15; x++) {
    const y = Math.round(4 - Math.sin(((x - 2) / 12) * Math.PI) * 3);
    p.set(x, y, 'd').set(x, y + 1, 'K');
  }
  // The cord, wound tight: a spiral of grey cutting the band.
  for (let x = 4; x < 12; x += 2) p.set(x, 1 + Math.abs(x - 8) / 3, 'w').set(x + 1, 2 + Math.abs(x - 8) / 3, 'g');
  p.line(12, 10, 15, 11, 'g');
  return p.contour('k').toString();
})();

/** Rotates sprite art a quarter turn clockwise. */
function rotate(art: string): string {
  const r = rows(art);
  const h = r.length;
  const w = Math.max(...r.map((l) => l.length));
  return Array.from({ length: w }, (_, x) => Array.from({ length: h }, (_, y) => r[h - 1 - y]![x] ?? '.').join('')).join('\n');
}

/** The plush Dodo fallen on his side when the door opened (3:38): turned toward the bed. */
const DODO_SIDE = (() => {
  const plush = PROP_ART.prop_dodo_plush!;
  return rotate(typeof plush === 'string' ? plush : plush.art);
})();

/** A loose red thread hanging from the ceiling (6×30). */
function hangingThread(v: number): string {
  const p = new Pix(6, 30);
  for (let y = 0; y < 28; y++) p.set(2 + Math.round(Math.sin(y * 0.25 + v) * 1.4), y, y % 4 === 0 ? '!' : '~');
  p.set(2 + Math.round(Math.sin(28 * 0.25 + v) * 1.4), 28, ';');
  return p.toString();
}

/** A damp stain on the cotton (24×12), drawn under everything. */
const STAIN = (() => {
  const p = new Pix(24, 12);
  p.ellipse(12, 6, 11, 5, '9');
  p.ellipse(11, 6, 8, 3.5, '%');
  p.ellipse(9, 5, 3, 1.5, '&');
  p.set(15, 7, '6').set(6, 4, '8');
  return p.toString();
})();

/** The light that comes through the seam, spilling on the cotton (24×12). */
const SPILL = (() => {
  const p = new Pix(24, 12);
  p.ellipse(12, 6, 11, 5, '6');
  p.ellipse(12, 6, 7, 3, '?');
  return p.toString();
})();

/** A little felt mouse sewn to the wall by its tail, a ten-cent coin between its paws (14×14). */
const MOUSE = (() => {
  const p = new Pix(14, 14);
  // The tail, stitched up the wall with three red crosses.
  p.line(7, 0, 7, 5, 'G');
  for (const y of [1, 3]) p.set(6, y, '~').set(8, y, '~').set(7, y, '!');
  p.ellipse(7, 9, 4, 3.5, 'g').ellipse(6, 8.5, 2.5, 2, 'W');
  p.ellipse(3, 6, 1.6, 1.6, 'p').ellipse(11, 6, 1.6, 1.6, 'p');
  p.set(5, 9, 'k').set(9, 9, 'k').set(7, 11, 'P');
  // The coin, held out.
  p.ellipse(7, 12, 2, 1.2, '}').set(6, 12, '{');
  return p.contour('k').toString();
})();

/** A pool of black ink the size of a child, soaked into the cotton (32×16): the route of the ink. */
const INK_POOL = (() => {
  const p = new Pix(32, 16);
  p.ellipse(16, 8, 15, 7, 'j');
  p.ellipse(15, 8, 13, 6, 'i');
  p.ellipse(22, 11, 4, 2.5, 'i').ellipse(7, 5, 3, 2, 'i');
  // A few fibres of cotton drinking it at the edge.
  for (const [x, y] of [
    [2, 8],
    [29, 7],
    [12, 14],
    [20, 2],
  ]) p.set(x, y, '9');
  p.ellipse(11, 6, 3, 1, 'J');
  return p.toString();
})();

/** The knitted hat with sheep ears, lying flat, empty (16×10). */
const HAT_FLAT = (() => {
  const p = new Pix(16, 10);
  p.ellipse(8, 6, 6, 3.5, '7').ellipse(7, 5, 4, 2, '6');
  p.ellipse(2.5, 7, 2, 1.5, '8').ellipse(13.5, 7, 2, 1.5, '8');
  for (let x = 3; x <= 12; x += 2) p.set(x, 8, '9');
  p.set(8, 2, '7').set(8, 1, '6');
  return p.contour('k').toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const CHARS: Record<string, CharDef> = {
  bonnet: bonnetChar(false),
  bonnet_drawn: bonnetChar(true),
};

/** Every chapter 6 sprite keeps its authored colours inside the plush: `key@ouate` is the same art. */
function keep(defs: Record<string, SpriteDef>): Record<string, SpriteDef> {
  const out: Record<string, SpriteDef> = { ...defs };
  for (const [k, v] of Object.entries(defs)) out[`${k}@ouate`] = v;
  return out;
}

const plates: Record<string, SpriteDef> = {};
for (let n = 1; n <= 41; n++) plates[`prop_c6_num_${n}`] = sprite(plate(n));

export const ART: Record<string, SpriteDef> = keep({
  // --- Tiles
  t_c6_ouate_1: sprite(cottonFloor(1, false)),
  t_c6_ouate_2: sprite(cottonFloor(2, false)),
  t_c6_ouate_3: sprite(cottonFloor(3, true)),
  t_c6_ouate_4: sprite(cottonFloor(4, false)),
  t_c6_trempe_1: sprite(soaked(1)),
  t_c6_trempe_2: sprite(soaked(2)),
  t_c6_paroi_1: sprite(cottonWall(1, false)),
  t_c6_paroi_2: sprite(cottonWall(2, false)),
  t_c6_paroi_base_1: sprite(cottonWall(1, true)),
  t_c6_paroi_base_2: sprite(cottonWall(2, true)),
  t_c6_haut_1: sprite(cottonTop(1)),
  t_c6_haut_2: sprite(cottonTop(2)),
  t_c6_gouffre_1: sprite(voidTile(1)),
  t_c6_gouffre_2: sprite(voidTile(2)),
  t_c6_fil_h: sprite(threadBridge('h')),
  t_c6_fil_v: sprite(threadBridge('v')),
  t_c6_mousse_1: sprite(foam(1)),
  t_c6_mousse_2: sprite(foam(2)),
  t_c6_mousse_3: sprite(foam(3)),
  t_c6_croute_1: sprite(crust(1, 0.3)),
  t_c6_croute_2: sprite(crust(2, 0.55)),
  t_c6_croute_3: sprite(crust(3, 0.85)),
  t_c6_plastique_1: sprite(plastic(1)),
  t_c6_plastique_2: sprite(plastic(2)),
  t_c6_plastique_3: sprite(plastic(3)),
  t_c6_tissu_1: sprite(fabric(1, false)),
  t_c6_tissu_2: sprite(fabric(2, false)),
  t_c6_tissu_base: sprite(fabric(1, true)),
  t_c6_fente: sprite(seamSlit(false)),
  t_c6_fente_base: sprite(seamSlit(true)),

  // --- The jars
  prop_c6_etagere_1: sprite(shelf(0)),
  prop_c6_etagere_2: sprite(shelf(1)),
  prop_c6_etagere_3: sprite(shelf(2)),
  prop_c6_etagere_trou: sprite(shelf(1, 4)),
  prop_c6_bocal: sprite(lone('coton', 'oui')),
  prop_c6_bocal_fil: sprite(lone('fil', 'oui')),
  prop_c6_bocal_dent: sprite(lone('dent', 'oui')),
  prop_c6_bocal_vierge: sprite(lone('vide', 'vide')),
  prop_c6_bocal_zero: sprite(lone('vide', 'non')),
  prop_c6_bocal_tombe: sprite(FALLEN),
  // --- The wadding
  prop_c6_epingles_1: sprite(pins(0)),
  prop_c6_epingles_2: sprite(pins(1)),
  prop_c6_epingles_3: sprite(pins(2)),
  prop_c6_epingle: sprite(PIN_FLOOR),
  prop_c6_nid: sprite(NEST),
  prop_c6_couture: sprite(sealedSeam(false)),
  prop_c6_couture_ouverte: sprite(sealedSeam(true)),
  prop_c6_fil_pendu_1: sprite(hangingThread(0)),
  prop_c6_fil_pendu_2: sprite(hangingThread(2)),
  prop_c6_tache: sprite(STAIN),
  prop_c6_lumiere: sprite(SPILL),
  prop_c6_touffe_1: sprite(creep(0)),
  prop_c6_touffe_2: sprite(creep(1)),
  // --- The music box
  prop_c6_cylindre: sprite(cylinder(0)),
  prop_c6_cylindre_2: sprite(cylinder(2)),
  prop_c6_peigne_3: sprite(comb(3)),
  prop_c6_peigne_2: sprite(comb(2)),
  prop_c6_peigne_1: sprite(comb(1)),
  prop_c6_peigne_0: sprite(comb(0)),
  prop_c6_manivelle: sprite(CRANK),
  prop_c6_dent: sprite(tooth(false)),
  prop_c6_dent_2: sprite(tooth(true)),
  prop_c6_souris: sprite(MOUSE),
  // --- The voice
  prop_c6_module: sprite(voiceModule(0)),
  prop_c6_module_2: sprite(voiceModule(2)),
  prop_c6_croute_1: sprite(crustBlob(0)),
  prop_c6_croute_2: sprite(crustBlob(1)),
  prop_c6_croute_3: sprite(crustBlob(2)),
  prop_c6_marionnette_princesse: sprite(puppet('princesse', 0)),
  prop_c6_marionnette_princesse_2: sprite(puppet('princesse', 1)),
  prop_c6_marionnette_feutre: sprite(puppet('feutre', 0)),
  prop_c6_marionnette_feutre_2: sprite(puppet('feutre', -1)),
  prop_c6_encre: sprite(INK_POOL),
  prop_c6_bonnet_plat: sprite(HAT_FLAT),
  npc_bonnet_loin: bonnetFar(false),
  npc_bonnet_loin_2: bonnetFar(true),
  // --- The corridor, the button eyes, the 3:38 room
  ...plates,
  prop_c6_oeil: sprite(buttonEye(false)),
  prop_c6_oeil_fenetre: sprite(buttonEye(true)),
  prop_c6_casque: sprite(HEADPHONES),
  prop_c6_dodo_tombe: sprite(DODO_SIDE),
});

// The plush on its side is seen in the real room (3:38): it takes the real-world tint, like prop_dodo_plush.
ART['prop_c6_dodo_tombe@real'] = { art: DODO_SIDE, transform: realify };

// Inside the plush, the save point keeps its warm light, and Dodo, Chaussette and the Pile keep their colours.
ART['prop_savepoint@ouate'] = PROP_ART.prop_savepoint!;
ART['prop_savepoint_2@ouate'] = PROP_ART.prop_savepoint_2!;
for (const k of ['npc_chaussette', 'npc_chaussette_2']) ART[`${k}@ouate`] = CHAR_ART[k]!;
for (const k of Object.keys(ENEMY6_ART)) if (k.startsWith('ow_')) ART[`${k}@ouate`] = ENEMY6_ART[k]!;
ART['npc_c6_dodo'] = C5_ART.npc_c5_dodo!;
ART['npc_c6_dodo_2'] = C5_ART.npc_c5_dodo_2!;
ART['npc_c6_dodo@ouate'] = C5_ART.npc_c5_dodo!;
ART['npc_c6_dodo_2@ouate'] = C5_ART.npc_c5_dodo_2!;

export const VARIANTS: string[] = [];

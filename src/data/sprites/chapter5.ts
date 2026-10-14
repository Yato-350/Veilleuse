import type { CharDef, SpriteDef } from '../../game/assets';
import { CHARS as BASE_CHARS } from './characters';
import { Pix, rows } from './enemies';

/*
 * Chapter 5 « La Marée Blanche » — the world (docs/HISTOIRE.md § 3.13, § 4 « Ch. 5 »).
 *
 * Two materials, both authored here in their final colours:
 *   the beach of before (map world `dream`), overexposed: sand almost white, a pale sea, no shadow anywhere;
 *   the white hospital (map world `blanc`): correction fluid on the floor, plastic tarps for walls, ice, snow, all of
 *   it traced in a shaky blue ballpoint. The engine would turn every sprite of a `blanc` map into white-on-white;
 *   these ones are already white, so each of them is registered a second time as `key@blanc` (see `keep` at the
 *   bottom) and keeps its few colours: the red thread, the lights of the airlock doors, Dodo, the drawings, the hands.
 *
 * Tiles (`t_c5_*`, registered in src/data/tiles.ts); characters: `mina_avant` (Mina of the summer before, in crayon,
 * swimsuit and paper crown); NPCs and poses: thin Dodo with his side seam open, Mina asleep on the towel, the
 * silhouette in the knitted hat (only ever a flat shape: docs/HISTOIRE.md § 6.1), the giant Dodo of the fall.
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

/** The beach of before, overexposed: sand, wet sand, a pale sea, dune grass. */
const BEACH = {
  '6': '#fffaee', // sand, lit
  '7': '#f7ecd6', // sand
  '8': '#ecdcbc', // sand, speck / dent
  '9': '#e0cda8', // wet sand / deep dent
  '%': '#e3f6f3', // sea, light
  '&': '#c9ecec', // sea
  '@': '#acdde2', // sea, deep
  $: '#eef6dc', // dune grass, light
  '+': '#d6e8b4', // dune grass
  '=': '#b9d394', // dune grass, shade
  '!': '#3b5bd0', // blue pen (what the correction fluid could not hide)
};

/** The white hospital: correction fluid, tarps, ice, snow, the blue ballpoint. */
const WHITE = {
  '6': '#f7f9fd', // correction fluid
  '7': '#ebeff6', // brush stroke
  '8': '#dbe2ee', // tarp
  '9': '#c4cee0', // tarp fold
  '%': '#3b5bd0', // blue pen
  '&': '#a5b5e6', // ghost of a pen line, under the fluid
  '@': '#e3eef6', // ice
  $: '#c8dbea', // ice, crack
  '+': '#aec4da', // ice, deep crack
  '=': '#dfe7f2', // snow, shade
};

/** Both sets (props that cross from the beach to the hospital). */
const ALL = { ...BEACH, ...WHITE };

const sprite = (art: string, colors: Record<string, string> = ALL, extra: Partial<Exclude<SpriteDef, string>> = {}): SpriteDef => ({ art, colors, ...extra });

// ---------------------------------------------------------------------------------------------------------------------
// Tiles — the beach of before
// ---------------------------------------------------------------------------------------------------------------------

/** Dry sand: specks, wind ripples, a pebble. Overexposed: nothing darker than a fingerprint. */
const sand = (seed: number, ripples: boolean, pebble: boolean): string =>
  paint((x, y) => {
    if (ripples) {
      const wave = Math.round(Math.sin((x + seed * 3) * 0.55) * 1.2);
      if ((y + wave + 16) % 6 === 0 && hash(x, y, seed) < 0.75) return '8';
      if ((y + wave + 16) % 6 === 1 && hash(x, y, seed + 1) < 0.5) return '6';
    }
    if (pebble && ((x === 9 && y === 11) || (x === 10 && y === 11) || (x === 9 && y === 12))) return x === 9 && y === 11 ? 'W' : 'g';
    if (pebble && x === 10 && y === 12) return '8';
    const h = hash(x, y, seed);
    if (h < 0.05) return '8';
    if (h > 0.9) return '6';
    return '7';
  });

/** Wet sand near the water: darker, with a shine where the last wave pulled back. */
const wetSand = (seed: number): string =>
  paint((x, y) => {
    const h = hash(x, y, seed);
    if ((y === 4 || y === 11) && hash(x >> 2, y, seed + 3) < 0.6 && x % 5 !== 0) return 'f';
    if (h < 0.08) return '8';
    return '9';
  });

/** The foam line between wet sand and sea (3 frames: the lace comes and goes). */
const foam = (frame: number): string =>
  paint((x, y) => {
    const edge = 6 + Math.round(Math.sin(x * 0.7 + frame * 2.1) * 1.4 + Math.sin(x * 0.23 + frame) * 0.8);
    if (y < edge - 1) return '9';
    if (y < edge + 1) return 'f';
    if (y < edge + 2) return hash(x, frame, 4) < 0.6 ? 'f' : '%';
    if (y < edge + 4) return hash(x, y + frame, 5) < 0.2 ? 'f' : '%';
    return '&';
  });

/** The sea: pale, almost white, glittering lines that move without any wind. */
const sea = (frame: number): string =>
  paint((x, y) => {
    const ly = (y + 16 - frame * 2) % 8;
    const wob = Math.round(Math.sin((x + frame * 3) * 0.5) * 1);
    if (ly === 2 + wob && (x + frame * 5) % 7 < 4) return '%';
    if (ly === 6 + wob && (x + frame * 3 + 3) % 9 < 3) return 'f';
    if (hash(x, y, frame + 20) < 0.05) return '@';
    return '&';
  });

/** Ice: a frozen sea or the lake of the hospital. Long cracks, a few air bubbles, glints. */
const ice = (seed: number, crack: boolean, foamLine = false): string =>
  paint((x, y) => {
    if (crack) {
      const cx = Math.round(3 + y * 0.6 + Math.sin(y * 0.9 + seed) * 1.2);
      if (x === cx) return '+';
      if (x === cx + 1 && hash(x, y, seed) < 0.5) return '$';
      if (y > 8 && x === Math.round(cx + (y - 8) * 0.9) + 2) return '$';
    }
    if (foamLine) {
      const fy = 8 + Math.round(Math.sin(x * 0.6 + seed) * 1.5);
      if (y === fy) return '$';
      if (y === fy - 1 && hash(x, y, seed) < 0.4) return 'f';
    }
    const h = hash(x, y, seed + 9);
    if (h < 0.025) return '$';
    if (h > 0.975) return 'f';
    if ((x + y * 3 + seed) % 23 === 0) return 'f';
    return '@';
  });

/** Dune grass (map border): tufts of pale marram grass over sand. */
const dune = (seed: number): string =>
  paint((x, y) => {
    const blade = hash(x, 0, seed) < 0.55;
    const top = 2 + Math.floor(hash(x, 1, seed) * 6);
    if (blade && y >= top) {
      if (y === top) return '$';
      return hash(x, y, seed) < 0.25 ? '=' : '+';
    }
    if (y > 11) return hash(x, y, seed + 2) < 0.2 ? '8' : '7';
    if (y > 6) return hash(x, y, seed + 3) < 0.5 ? '+' : '$';
    return hash(x, y, seed + 4) < 0.6 ? '+' : '=';
  });

/** Chestnut fence on the dunes (ganivelle): split stakes tied with wire. */
const GANIVELLE = paint((x, y) => {
  const stake = x % 3 === 1;
  if (stake && y >= 2 && y <= 13) return y === 2 ? 'c' : x % 6 === 1 ? 'C' : 'x';
  if ((y === 5 || y === 11) && !stake) return 'G';
  if (y >= 13) return '7';
  return hash(x, y, 61) < 0.4 ? '+' : '$';
});

/** Rocks: rounded boulders, pale, without a shadow under them. */
const rock = (seed: number): string => {
  const p = Pix.of(paint((x, y) => (hash(x, y, seed) < 0.06 ? '8' : '7')));
  const blobs: Array<[number, number, number, number]> =
    seed % 2 ? [[5, 6, 5, 4], [11, 10, 5, 5], [4, 12, 4, 3]] : [[8, 5, 6, 4], [4, 11, 4, 4], [12, 12, 4, 3]];
  for (const [cx, cy, rx, ry] of blobs) p.ellipse(cx, cy, rx, ry, 'G').ellipse(cx - 0.6, cy - 0.6, rx - 0.8, ry - 0.8, 'g').ellipse(cx - 1.5, cy - 1.4, rx * 0.45, ry * 0.4, 'W');
  return p.toString();
};

/** The boardwalk: bleached planks. */
const PLANKS = paint((x, y) => {
  if (y % 4 === 3) return 'C';
  if (x === (y < 4 ? 5 : y < 8 ? 12 : y < 12 ? 3 : 9)) return 'C';
  return hash(x, y, 71) < 0.1 ? 'c' : 'q';
});

/** Correction fluid poured over the sand: the white tide has passed here. Thick, a raised rim, a ghost of a line. */
const whiteSand = (seed: number): string =>
  paint((x, y) => {
    const d = Math.hypot(x - 8 + Math.sin(y + seed) * 2, (y - 8) * 1.1);
    const r = 8.5 + hash(Math.floor(Math.atan2(y - 8, x - 8) * 3), 0, seed) * 2;
    if (d < r - 1.5) return hash(x, y, seed) < 0.04 ? '&' : hash(x >> 1, y, seed + 1) < 0.15 ? '6' : 'f';
    if (d < r) return '=';
    return hash(x, y, seed + 2) < 0.05 ? '8' : '7';
  });

/** Bottom edge of the beach: white haze. Nothing beyond. */
const haze = (seed: number): string => paint((x, y) => (hash(x, y, seed) < 0.15 ? '6' : 'f'));

// ---------------------------------------------------------------------------------------------------------------------
// Tiles — the white hospital (correction fluid, tarps, snow, ice, the red thread)
// ---------------------------------------------------------------------------------------------------------------------

/** Correction fluid floor: brush strokes; under the white, here and there, a line of pen still shows. */
const fluid = (seed: number, ghost: boolean): string =>
  paint((x, y) => {
    const stroke = (y + Math.round(Math.sin(x * 0.4 + seed) * 1.2) + 16) % 5 === 0;
    if (ghost && y === 6 && x >= 3 && x <= 12 && hash(x, y, seed) < 0.7) return '&';
    if (ghost && y === 7 && (x === 5 || x === 9) && seed % 2) return '&';
    if (stroke && hash(x, y, seed) < 0.55) return '7';
    if (hash(x, y, seed + 7) < 0.04) return 'f';
    return '6';
  });

/** Top of the walls: hatched white, a pen line round the edge (a wall drawn, not built). */
const wallTop = (seed: number): string =>
  paint((x, y) => {
    if (y === 15) return hash(x, y, seed) < 0.9 ? '%' : '&';
    if ((x + y + seed) % 4 === 0) return '8';
    return hash(x, y, seed) < 0.05 ? '9' : '7';
  });

/** A plastic tarp hanging from a rail: soft vertical folds, a shine, the rail at the top. `shade`: someone behind it. */
const tarp = (base: boolean, seed: number, shade = false): string =>
  paint((x, y) => {
    if (!base && y === 0) return '%';
    if (!base && y === 1) return x % 8 === 3 ? '%' : '9';
    if (base && y === 15) return '%';
    if (base && y === 14) return '9';
    if (base && y === 13 && x % 4 === 0) return '9';
    if (shade) {
      // A blurred shape pressed against the plastic, from the other side: a head, two shoulders.
      const hx = x - 8;
      const hy = (base ? y + 16 : y) - 10;
      const head = hx * hx + hy * hy * 1.1 < 12;
      const body = base && Math.abs(hx) < 5 + y * 0.2 && y > 2;
      if (head || body) return (x + y) % 2 ? '9' : '8';
    }
    const fold = Math.sin((x + seed) * 0.9 + Math.sin(y * 0.25) * 0.6);
    if (fold > 0.82) return 'f';
    if (fold < -0.75) return '9';
    return '8';
  });

/** Snow on the ice: it must not be touched. Bright, with soft blue-pen bumps. */
const snow = (seed: number): string =>
  paint((x, y) => {
    const bx = (x + (y > 7 ? 4 : 0)) % 8;
    const by = y % 8;
    const bump = (bx - 4) ** 2 + (by - 4) ** 2 * 2;
    if (bump > 13 && bump < 17 && by > 4 && hash(x, y, seed) < 0.6) return '=';
    if (bump > 16 && bump < 19 && by > 5 && hash(x, y, seed + 1) < 0.35) return '&';
    return hash(x, y, seed + 3) < 0.04 ? '=' : 'f';
  });

/** The red thread of Mina n°366 lying on the ground (transparent tile drawn over ice or fluid via `under`). */
type ThreadShape = 'h' | 'v' | 'ne' | 'nw' | 'se' | 'sw' | 'end' | 'x';
function thread(shape: ThreadShape): string {
  const p = new Pix(N, N);
  const wob = (t: number): number => Math.round(Math.sin(t * 0.8) * 0.7);
  const dot = (x: number, y: number): void => {
    p.set(x, y, 'r').set(x, y + 1, 'R');
  };
  const horiz = (x0: number, x1: number): void => {
    for (let x = x0; x <= x1; x++) dot(x, 7 + wob(x));
  };
  const vert = (y0: number, y1: number): void => {
    for (let y = y0; y <= y1; y++) {
      const x = 7 + wob(y + 2);
      p.set(x, y, 'r').set(x + 1, y, 'R');
    }
  };
  if (shape === 'h' || shape === 'x') horiz(0, 15);
  if (shape === 'v' || shape === 'x') vert(0, 15);
  if (shape === 'ne') (vert(0, 7), horiz(8, 15));
  if (shape === 'nw') (vert(0, 7), horiz(0, 7));
  if (shape === 'se') (vert(8, 15), horiz(8, 15));
  if (shape === 'sw') (vert(8, 15), horiz(0, 7));
  if (shape === 'end') {
    horiz(0, 8);
    p.rect(8, 6, 3, 3, 'r').set(9, 7, 'R').set(11, 9, 'r').set(12, 10, 'r');
  }
  return p.toString();
}

/** The lake shore inside the hospital: correction fluid giving way to ice. */
const shore = (seed: number): string =>
  paint((x, y) => {
    const edge = 7 + Math.round(Math.sin(x * 0.7 + seed) * 1.5);
    if (y < edge) return hash(x, y, seed) < 0.05 ? '7' : '6';
    if (y === edge) return '%';
    if (y === edge + 1) return '$';
    return hash(x, y, seed + 1) < 0.03 ? 'f' : '@';
  });

/** Glass walls of the room 304 seen from above: a thick pane, shine, a pen outline. */
const glassTop = (seed: number): string =>
  paint((x, y) => {
    if (y === 0 || y === 15) return '%';
    if ((x - y + 32 + seed) % 11 === 0 || (x - y + 33 + seed) % 11 === 0) return 'f';
    return y % 5 === 2 ? '$' : '@';
  });

/** A glass pane seen from the front (the walls of the glass box, the Vitre): fogged at the bottom. */
const pane = (lower: boolean, seed: number): string =>
  paint((x, y) => {
    if (x === 0 || x === 15) return '%';
    if (lower && y === 15) return '%';
    if (lower && y === 14) return '9';
    if (!lower && y === 0) return '%';
    const streak = (x - y + 32 + seed) % 13;
    if (streak === 0 || streak === 1) return 'f';
    const fog = lower ? y / 15 : 0.05;
    if (hash(x, y, seed) < fog * 0.8) return '7';
    return '@';
  });

/** Hospital lino of the glass room, pale, a seam every eight pixels. */
const lino = (seed: number): string =>
  paint((x, y) => {
    if (x % 8 === 0 && y % 8 === 4) return '8';
    if (hash(x, y, seed) < 0.04) return '7';
    return '6';
  });

/** Frost creeping on the airlock floor before the lake. */
const frost = (seed: number): string =>
  paint((x, y) => {
    const branch = Math.abs(Math.sin(x * 0.9 + y * 0.4 + seed) + Math.sin(y * 1.3 - x * 0.2)) < 0.25;
    if (branch) return '$';
    if (hash(x, y, seed) < 0.12) return 'f';
    return '@';
  });

/** Yellowed cotton: the floor at the very end, when the white turns to stuffing (the fall into chapter 6). */
const COTTON = { '6': '#f3e7c8', '7': '#e6d3a6', '8': '#cdb582', '9': '#fff6dc' };
const cottonFloor = (seed: number): string =>
  paint((x, y) => {
    const n = Math.sin(x * 0.9 + seed) + Math.sin(y * 0.8 + x * 0.3) + hash(x, y, seed) * 0.8;
    if (n > 1.4) return '9';
    if (n < -1.2) return '8';
    if (n < -0.4) return '7';
    return '6';
  });

// ---------------------------------------------------------------------------------------------------------------------
// Characters — Mina of the summer before (crayon, swimsuit, paper crown)
// ---------------------------------------------------------------------------------------------------------------------

const BODY: Record<'down' | 'up' | 'left', string[]> = {
  down: ['....ksppppsk....', '...kskpwppksk...', '...kskppppksk...', '...kSkppwpkSk...', '....kkPPPPkk....', '....kPPkkPPk....'],
  up: ['....ksppppsk....', '...kskpppPksk...', '...kskpPppksk...', '...kSkppppkSk...', '....kkPPPPkk....', '....kPPkkPPk....'],
  left: ['.....ksppppk....', '....kspppppk....', '....kssppwpk....', '....kSsppppk....', '.....kPPPPk.....', '.....kPPPk......'],
};

/** Mina's frames with a pink swimsuit (white dots) instead of the cape and the dress; bare feet. */
function beachMina(frame: string, dir: 'down' | 'up' | 'left'): string {
  const r = rows(frame);
  const crown = r.findIndex((l) => l.includes('kyky'));
  const head = r.slice(0, crown + 11);
  const legs = r.slice(crown + 17).map((l) => l.replace(/x/g, 'S').replace(/K/g, 'S'));
  return [...head, ...BODY[dir], ...legs].join('\n');
}
const MINA = BASE_CHARS.mina!;
const MINA_AVANT: CharDef = {
  down: MINA.down.map((f) => beachMina(f, 'down')),
  up: MINA.up.map((f) => beachMina(f, 'up')),
  left: MINA.left.map((f) => beachMina(f, 'left')),
};

/** Building the castle: kneeling, the spade up (frame 1) or down in the sand (frame 2). */
function digging(up: boolean): string {
  const p = Pix.of(MINA_AVANT.down[0]!);
  // Kneeling: the legs fold under her.
  p.rect(0, 21, 16, 3, '.');
  p.rect(4, 21, 8, 1, 'k').rect(5, 20, 2, 1, 'S').rect(9, 20, 2, 1, 'S');
  // The spade in her right hand (screen left), a yellow plastic one.
  if (up) {
    p.set(2, 13, 'k').set(2, 14, 'Y').set(2, 15, 'Y').set(2, 16, 'Y').set(1, 12, 'k').rect(1, 10, 3, 3, 'y').set(1, 9, 'k').set(3, 9, 'k').set(2, 9, 'k');
  } else {
    p.set(2, 17, 'Y').set(2, 18, 'Y').set(2, 19, 'Y').rect(1, 20, 3, 2, 'y').set(1, 22, 'k').set(2, 22, 'k').set(3, 22, 'k');
    p.set(0, 21, '8').set(4, 22, '8');
  }
  return p.toString();
}

/** Asleep on her side, curled up, her crown slipped off next to her head. */
const MINA_ASLEEP = `
  ......kkkk................
  ....kkmmmmkk..............
  ...kmmmmmmmMk.............
  ..kmmmmsssssk..kkkkkkkk...
  ..kmmssssssSkkkppppppppkk.
  ..kmmskksssSkspppwpppppPk.
  ..kmMsssssSkssppppppwpPPk.
  ...kMsssstSkSspPPPPPPPPkkk
  ....kkSSSSkkkkkkPPPPPPkssSk
  ..kyykkkkk...kssSkkkkksssk
  .kyyYk......kssSk...kkkkk.
  ..kkk........kkk..........
`;

/** Thin Dodo of chapter 5: the seam of his side has opened; cotton shows; a red thread trails behind him. */
const DODO = `
  ..........kk.kk.
  ....kk.kk.kpPpk.
  ...kwwkwwkwkPkk.
  ...kwwwwwwwwk...
  ..kwwwwwwwwWWk..
  .kpkGGGGGGwWkpk.
  .kpkggggggGkpk..
  ..kwgkggkgGWk...
  ..kwgkggkgGkqk..
  ..kwgpggggpkqqk.
  ...kwGgGGgGkqk..
  ...kwwGGGGWkk...
  ...kWwwwwWWkr...
  ....kWwwwWgk.r..
  .....kkkkkk...r.
  ...............r
`;
const DODO_2 = (() => {
  const p = Pix.of(DODO).move(0, 0, 16, 14, 0, 1);
  p.set(14, 14, '.').set(13, 15, 'r').set(14, 15, 'r').set(15, 15, '.');
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// Props — the beach
// ---------------------------------------------------------------------------------------------------------------------

/** The parasol (the save point of the beach): pale stripes, a pole; it does not cast a shadow either. */
function parasol(glint: boolean): string {
  const p = new Pix(34, 40);
  // Canopy: a wide flattened dome, eight stripes.
  for (let y = 2; y < 16; y++)
    for (let x = 1; x < 33; x++) {
      const nx = (x - 16.5) / 16;
      const ny = (y - 13) / 11;
      if (nx * nx + ny * ny > 1 || y > 13 + Math.round(Math.cos(nx * 9) * 1.5)) continue;
      const stripe = Math.floor(Math.atan2(y - 15, x - 16.5) * 2.6 + 20) % 2;
      const shade = y > 10 ? 1 : 0;
      p.set(x, y, stripe ? (shade ? 'P' : 'p') : shade ? 'W' : 'w');
    }
  p.contour('k');
  p.set(16, 1, 'k').set(17, 1, 'k').set(16, 0, 'y').set(17, 0, 'Y');
  // Pole.
  for (let y = 15; y < 39; y++) p.set(16, y, 'W').set(17, y, 'g').set(15, y, 'k').set(18, y, 'k');
  // Base, pushed into the sand.
  p.rect(13, 38, 8, 2, '8').set(12, 39, '8').set(21, 39, '8');
  // The little glint on the pole: the save point.
  if (glint) p.set(17, 22, 'f').set(16, 21, 'y').set(18, 21, 'y').set(16, 23, 'y').set(18, 23, 'y').set(17, 20, 'y').set(17, 24, 'y');
  else p.set(17, 22, 'y').set(16, 22, 'Y');
  return p.toString();
}

/** Mina's towel: yellow, pink and white stripes, fringes at both ends. */
const TOWEL = (() => {
  const p = new Pix(34, 14);
  p.rect(2, 1, 30, 12, 'w');
  for (let x = 2; x < 32; x++) {
    const band = Math.floor((x - 2) / 3) % 3;
    const c = band === 0 ? 'y' : band === 1 ? 'p' : 'w';
    for (let y = 1; y < 13; y++) p.set(x, y, y > 10 ? (c === 'y' ? 'Y' : c === 'p' ? 'P' : 'W') : c);
  }
  p.contour('k');
  for (let y = 2; y < 12; y += 2) p.set(0, y, 'W').set(1, y, 'W').set(32, y, 'W').set(33, y, 'W');
  return p.toString();
})();

/** The same place after the white tide: a hospital sheet, flat, folded square, empty. */
const SHEET = (() => {
  const p = new Pix(34, 14);
  p.rect(1, 1, 32, 12, 'w');
  p.rect(1, 1, 32, 2, 'W');
  // Fold lines, ironed flat; the blue hem of the hospital laundry.
  for (let x = 2; x < 32; x++) {
    p.set(x, 7, x % 3 ? 'W' : 'w');
    p.set(x, 11, 'b');
  }
  for (let y = 3; y < 12; y++) p.set(17, y, y % 2 ? 'W' : 'w');
  p.contour('g');
  p.set(4, 4, 'b').set(5, 4, 'b').set(6, 4, 'b');
  return p.toString();
})();

/** The sand castle in three stages (more shells → more towers). */
function castle(stage: 1 | 2 | 3): string {
  const p = new Pix(34, 26);
  const tower = (x: number, w: number, h: number): void => {
    const base = 24;
    p.rect(x, base - h, w, h, '7');
    p.rect(x, base - h, 1, h, '6');
    p.rect(x + w - 1, base - h, 1, h, '8');
    for (let i = 0; i < w; i += 2) p.set(x + i, base - h - 1, '7');
    for (let j = base - h + 3; j < base; j += 3) p.set(x + 1 + ((j / 3) % 2), j, '8');
  };
  // The mound and the moat.
  p.ellipse(17, 23, 15, 3, '8').ellipse(17, 22.5, 13, 2.5, '7');
  tower(12, 10, 8);
  if (stage >= 2) {
    tower(5, 7, 6);
    tower(23, 7, 6);
    p.rect(11, 18, 2, 4, '8').rect(21, 18, 2, 4, '8');
  }
  if (stage >= 3) {
    tower(14, 6, 14);
    // A paper flag: a little crown drawn on it.
    p.set(17, 3, 'x').set(17, 4, 'x').set(17, 5, 'x').set(17, 6, 'x').set(17, 7, 'x');
    p.rect(18, 3, 4, 3, 'w').set(19, 4, 'y').set(20, 4, 'y').set(21, 4, 'y');
    // Shells pressed into the walls.
    for (const [x, y] of [[7, 20], [9, 21], [15, 17], [19, 15], [25, 20], [27, 21], [13, 22], [21, 22]] as const) p.set(x, y, (x + y) % 2 ? 'p' : 'q');
  }
  p.contour('k');
  // The window-door of the keep.
  p.rect(16, 20, 2, 3, '9');
  return p.toString();
}

const BUCKET = `
  ..........k.....
  .........kyk....
  ...kkkk..kYk....
  ..krrrrk.kYk....
  .kkkkkkkkkYk....
  .krrrrrrrkYk....
  .kRrrrrrRkyyk...
  ..kRrrrRkyyyyk..
  ..kRRRRRkkyyk...
  ...kkkkk..kk....
`;

const FLIPFLOPS = `
  .kk.kk.....kkk.kkk.
  kppkppk...kbbbkbbbk
  kpPkpPk...kbBbkbBbk
  kPPkPPk...kbbbkbbbk
  .kk.kk....kbbbkbbbk
  ..........kBBBkBBBk
  ...........kkk.kkk.
`;

/** Maman's deck chair: a striped canvas on a pale wooden frame. A magazine on it, open at the same page. */
const DECKCHAIR = (() => {
  const p = new Pix(18, 30);
  p.rect(2, 2, 14, 26, 'c');
  for (let y = 3; y < 27; y++) for (let x = 3; x < 15; x++) p.set(x, y, Math.floor((x - 3) / 2) % 2 ? 'w' : 'b');
  p.rect(3, 12, 12, 1, 'C').rect(3, 13, 12, 1, 'x');
  p.contour('k');
  // The imprint of a back on the canvas.
  for (let y = 4; y < 11; y++) p.set(8, y, y % 2 ? 'B' : 'b').set(9, y, 'W');
  // The magazine.
  p.rect(5, 18, 7, 5, 'w').rect(8, 18, 1, 5, 'g').rect(6, 19, 2, 1, 'G').rect(9, 20, 2, 1, 'G').rect(6, 21, 2, 1, 'g');
  // Sunglasses.
  p.set(11, 7, 'k').set(12, 7, 'k').set(14, 7, 'k').set(13, 7, 'k').set(11, 8, 'K').set(14, 8, 'K');
  return p.toString();
})();

const SUNSCREEN = `
  ..kkk..
  ..kwk..
  .kwwwk.
  .koook.
  koyyook
  koyYYok
  kooooOk
  kOOOOOk
  .kkkkk.
`;

const COOLER = `
  ....kkkkkk......
  ...kGkkkkGk.....
  .kkkkkkkkkkkkk..
  kwwwwwwwwwwwwWk.
  kWWWWWWWWWWWWWk.
  kBbbbbbbbbbbbBk.
  kBbbwwwwwwbbbBk.
  kBbbbbbbbbbbbBk.
  kBBBBBBBBBBBBBk.
  .kkkkkkkkkkkkk..
`;

/** A beach ball gone soft: the colours are still there, folded on themselves. */
const BALL = `
  ....kkkkk.....
  ..kkrrwyykk...
  .krrrwwyyybk..
  krrRwwwyybbbk.
  kRRwwwWYYbbBk.
  .kkWWWkkYBBkk.
  ...kkk..kkk...
`;

/** Footprints in the sand (flat), a big pair and a small one. */
const STEPS_BIG = `
  .99.........
  9889........
  9889........
  .99...99....
  .....9889...
  .....9889...
  ......99....
  ............
  ..99........
  .9889.......
  .9889.......
  ..99..99....
  .....9889...
  .....9889...
  ......99....
`;
const STEPS_SMALL = `
  .9..........
  989.........
  .9..9.......
  ...989......
  ....9.......
  .9..........
  989.........
  .9..9.......
  ...989......
  ....9.......
`;
/** Where the small steps stop: the last pair, side by side. Then nothing. */
const STEPS_END = `
  .9..9..
  989989.
  .9..9..
`;

/** Letters for the writing in the sand (3×5 pixel font, a finger in the sand). */
const SAND_FONT: Record<string, string[]> = {
  A: ['.9.', '9.9', '999', '9.9', '9.9'],
  B: ['99.', '9.9', '99.', '9.9', '99.'],
  C: ['.99', '9..', '9..', '9..', '.99'],
  E: ['999', '9..', '99.', '9..', '999'],
  I: ['9', '9', '9', '9', '9'],
  M: ['9...9', '99.99', '9.9.9', '9...9', '9...9'],
  N: ['9..9', '99.9', '9.99', '9..9', '9..9'],
  O: ['.9.', '9.9', '9.9', '9.9', '.9.'],
  R: ['99.', '9.9', '99.', '9.9', '9.9'],
  S: ['.99', '9..', '.9.', '..9', '99.'],
  T: ['999', '.9.', '.9.', '.9.', '.9.'],
  U: ['9.9', '9.9', '9.9', '9.9', '.9.'],
};
function sandWriting(lines: Array<[string, number, number]>, w: number, h: number): string {
  const p = new Pix(w, h);
  for (const [text, x0, y0] of lines) {
    let x = x0;
    for (const ch of text) {
      if (ch === ' ') {
        x += 3;
        continue;
      }
      const g = SAND_FONT[ch];
      if (!g) continue;
      g.forEach((row, j) => [...row].forEach((c, i) => c !== '.' && p.set(x + i, y0 + j, '9').set(x + i + 1, y0 + j + 1, p.get(x + i + 1, y0 + j + 1) === '.' ? '6' : p.get(x + i + 1, y0 + j + 1))));
      x += g[0]!.length + 1;
    }
  }
  return p.toString();
}
const SAND_WRITING = sandWriting(
  [
    ['NOA EST UN CRABE', 1, 1],
    ['MINA AUSSI', 4, 8],
    ['NON C TOI', 20, 15],
  ],
  64,
  22,
);

/** A family on a blue towel, painted over with correction fluid, carefully, following the edges. */
const ERASED_FAMILY = (() => {
  const p = new Pix(50, 22);
  p.rect(1, 3, 48, 17, 'B').rect(1, 3, 48, 1, 'b');
  for (let x = 1; x < 49; x += 4) p.set(x, 19, 'n');
  p.contour('k');
  const blank = (cx: number, cy: number, rx: number, ry: number): void => {
    p.ellipse(cx, cy, rx, ry, 'f');
  };
  // A grown-up lying down, a grown-up sitting, a child sitting: three white shapes, no face, no line inside.
  blank(12, 11, 9, 3.2);
  blank(4, 10, 3, 2.6);
  blank(30, 9, 3, 3.5);
  blank(30, 15, 4.5, 3.5);
  blank(42, 10, 2.5, 2.4);
  blank(42, 15, 3.5, 3);
  // Their border: a raised rim of fluid, and the blue pen that went round them first.
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 50; x++) {
      if (p.get(x, y) !== 'f') continue;
      const out = ['f'].includes(p.get(x + 1, y)) && ['f'].includes(p.get(x - 1, y)) && ['f'].includes(p.get(x, y + 1)) && ['f'].includes(p.get(x, y - 1));
      if (!out) p.set(x, y, (x + y) % 3 ? '=' : '!');
    }
  return p.toString();
})();

/** Someone under a small umbrella, also painted over. */
const ERASED_ONE = (() => {
  const p = new Pix(26, 34);
  for (let y = 1; y < 10; y++)
    for (let x = 1; x < 25; x++) {
      const nx = (x - 13) / 12;
      const ny = (y - 9) / 8;
      if (nx * nx + ny * ny <= 1) p.set(x, y, Math.floor((x - 1) / 3) % 2 ? 'b' : 'w');
    }
  p.contour('k');
  for (let y = 9; y < 32; y++) p.set(13, y, 'W').set(12, y, 'k').set(14, y, 'k');
  // A deck chair, and on it a white shape.
  p.rect(4, 22, 18, 9, 'c').rect(5, 23, 16, 7, 'o');
  p.ellipse(10, 21, 3, 3, 'f').ellipse(12, 26, 6, 3.5, 'f');
  for (const [x, y] of [[7, 19], [8, 18], [13, 19], [6, 24], [18, 26], [17, 28], [7, 28]] as const) p.set(x, y, '!');
  return p.toString();
})();

/** The lifeguard chair, bleached; the green flag on its pole does not move. */
const LIFEGUARD = (() => {
  const p = new Pix(26, 44);
  // Legs and ladder.
  p.rect(5, 18, 2, 25, 'W').rect(19, 18, 2, 25, 'W');
  for (let y = 22; y < 42; y += 4) p.rect(7, y, 12, 1, 'g');
  // Seat and back.
  p.rect(3, 14, 20, 5, 'w').rect(3, 18, 20, 1, 'g').rect(5, 8, 16, 6, 'w').rect(6, 9, 14, 1, 'r');
  // Flag pole and the flag.
  p.rect(22, 0, 1, 15, 'g');
  p.rect(23, 1, 3, 1, 'L').rect(23, 2, 3, 3, 'L').rect(23, 5, 3, 1, 'e');
  p.contour('k');
  return p.toString();
})();

/** A wooden sign on a post: « Attention : ne pas s'endormir au soleil. » */
const SIGN = `
  .kkkkkkkkkkkkkk.
  kccccccccccccCCk
  kcGGGGGcGGGGcCCk
  kcccccccccccccCk
  kcGGcGGGGGcGGcCk
  kcccccccccccccCk
  kcGGGGGcGGGGGcCk
  kCCCCCCCCCCCCCCk
  .kkkkkkCCkkkkkk.
  .......kCk......
  .......kCk......
  .......kCk......
  .......kxk......
  ......k888k.....
`;

/** The ice cream kiosk: a striped awning, a cone on the roof, the shutter half-down. */
const KIOSK = (() => {
  const p = new Pix(50, 42);
  // Body.
  p.rect(3, 18, 44, 23, 'w').rect(3, 38, 44, 3, 'W');
  p.rect(6, 22, 38, 9, 'b').rect(6, 22, 38, 3, 'W');
  // Counter.
  p.rect(4, 31, 42, 2, 'c').rect(4, 33, 42, 1, 'C');
  // Awning: scalloped stripes.
  for (let x = 1; x < 49; x++)
    for (let y = 10; y < 19; y++) {
      if (y === 18 && x % 6 > 3) continue;
      p.set(x, y, Math.floor((x - 1) / 4) % 2 ? 'p' : 'w');
    }
  p.rect(1, 17, 48, 1, 'P');
  // The cone on the roof.
  p.ellipse(25, 4, 5, 4, 'p').ellipse(24, 3, 2, 1.5, 'w');
  for (let y = 7; y < 10; y++) p.rect(22 + (y - 7), y, 7 - (y - 7) * 2, 1, 'Y');
  // A menu board.
  p.rect(36, 34, 8, 6, 'K').rect(37, 35, 4, 1, 'w').rect(37, 37, 5, 1, 'w');
  p.contour('k');
  return p.toString();
})();

/** Clusters of shells (scallops, a small spiral). */
const SHELLS = [
  `
  ..kk....kk..
  .kqqk..kpQk.
  kqQqQk.kpPk.
  .kkkk...kk..
  ....kkk.....
  ...kwgwk....
  ....kkk.....
`,
  `
  .kk...kkk...
  kpPk.kqQqk..
  kPPk.kQqQk..
  .kk...kkk.k.
  ..kk.....kqk
  .kwgk.....k.
  ..kk........
`,
  `
  ...kkk..kk..
  ..kqQqk.kpk.
  ..kQqQk..k..
  ...kkk......
  .kk...kkk...
  kpPk.kwggk..
  .kk...kkk...
`,
];
/** The forty-second shell, half buried: a glint, now and then. */
const GLINT = `
  ..f..
  .fyf.
  ffyff
  .fyf.
  ..f..
`;
const GLINT_OFF = `
  .....
  .....
  ..q..
  .....
  .....
`;

/** A tide pool among the rocks; in it, a hospital bracelet walks sideways like a crab. */
function tidePool(frame: number): string {
  const p = new Pix(34, 18);
  p.ellipse(17, 9, 15, 7, 'g').ellipse(17, 9, 12.5, 5.5, '&').ellipse(15, 8, 8, 3, '%');
  p.contour('k');
  for (const [x, y] of [[3, 4], [30, 5], [5, 14], [29, 13]] as const) p.ellipse(x, y, 3, 2, 'W').set(x - 1, y - 1, 'w');
  // The bracelet: a white strap, a label, little legs.
  const bx = 13 + frame * 2;
  p.rect(bx, 8, 9, 3, 'w').rect(bx + 3, 8, 3, 2, 'b').set(bx, 11, 'k').set(bx + 8, 11, 'k').set(bx + 2 - frame, 12, 'k').set(bx + 6 + frame, 12, 'k');
  return p.toString();
}

/** The sun: it never moves, it is pinned to the sky (drawn over the screen, not the beach). Dithered glare. */
const SUN = (() => {
  const p = new Pix(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 31.5, y - 31.5);
      if (d < 9) p.set(x, y, 'f');
      else if (d < 12) p.set(x, y, (x + y) % 2 ? 'f' : 'q');
      else if (d < 18 && (x + y * 2) % 4 === 0) p.set(x, y, 'f');
      else if (d < 28 && (x * 3 + y) % 9 === 0) p.set(x, y, 'q');
    }
  return p.toString();
})();

/** The white veil over the beach (pinned to the screen; its alpha grows while Mina sleeps). */
const VEIL = new Pix(320, 180).rect(0, 0, 320, 180, 'f').toString();

/** The Thermomètre's portal: a giant digital thermometer stuck in the ice, a doorway of white light in its body. */
function portal(state: 'q' | 'ok' | 'fievre' | 'off'): string {
  const p = new Pix(40, 70);
  // The body: white plastic, rounded top.
  p.ellipse(20, 10, 13, 10, 'w');
  p.rect(7, 10, 26, 44, 'w');
  p.rect(30, 10, 3, 44, 'W').rect(7, 10, 2, 44, 'f');
  // The screen.
  p.rect(10, 8, 20, 11, 'K').rect(11, 9, 18, 9, state === 'off' ? 'd' : state === 'fievre' ? 'o' : 'L');
  const digits: Record<string, string[]> = {
    q: ['.kk.', 'k..k', '..k.', '.k..', '....', '.k..'],
    ok: ['k.kk', 'k..k', 'k.kk', 'k..k', 'k.kk', '....'],
    fievre: ['k.kk', 'k.k.', 'k.kk', 'k..k', 'k.kk', '....'],
    off: ['....', '....', '....', '....', '....', '....'],
  };
  if (state === 'q') digits.q!.forEach((row, j) => [...row].forEach((c, i) => c === 'k' && p.set(18 + i, 10 + j, 'K')));
  else if (state !== 'off') {
    // « 37,0 » or « 38,4 », in small LCD figures.
    const txt = state === 'ok' ? ['3', '7', ',', '0'] : ['3', '8', ',', '4'];
    const fig: Record<string, string[]> = {
      '3': ['kk', '.k', 'kk', '.k', 'kk'],
      '7': ['kk', '.k', '.k', '.k', '.k'],
      '8': ['kk', 'kk', '..', 'kk', 'kk'],
      '0': ['kk', 'kk', 'kk', 'kk', 'kk'],
      '4': ['k.', 'kk', 'kk', '.k', '.k'],
      ',': ['.', '.', '.', '.', 'k'],
    };
    let x = 13;
    for (const ch of txt) {
      const f = fig[ch]!;
      f.forEach((row, j) => [...row].forEach((c, i) => c === 'k' && p.set(x + i, 11 + j, 'K')));
      x += f[0]!.length + 1;
    }
  }
  // The doorway: an arch of white light.
  p.ellipse(20, 32, 7, 6, 'f');
  p.rect(13, 32, 15, 20, 'f');
  for (let y = 27; y < 52; y++) {
    p.set(12, y, p.get(12, y) === 'w' ? 'g' : p.get(12, y));
    p.set(28, y, p.get(28, y) === 'w' ? 'g' : p.get(28, y));
  }
  // The metal tip, driven into the ice.
  p.rect(15, 54, 10, 8, 'g').rect(15, 54, 2, 8, 'W').rect(23, 54, 2, 8, 'G');
  p.ellipse(20, 63, 5, 3, 'g').ellipse(19, 62, 2, 1.5, 'W');
  p.contour('k');
  // Cracks in the ice around the tip.
  for (const [x, y] of [[8, 66], [9, 67], [10, 68], [31, 66], [32, 67], [30, 68], [33, 69]] as const) p.set(x, y, '$');
  return p.toString();
}

/** The end of the red thread, where it starts: a knot, loose. */
const THREAD_END = `
  ......kk..
  ..kkkkrrk.
  .krrrrRrk.
  krRk.krk..
  .k....k...
`;

// ---------------------------------------------------------------------------------------------------------------------
// Props — the airlock
// ---------------------------------------------------------------------------------------------------------------------

/**
 * An airlock door in a partition (16×48: the lamp on the wall above, then the door over the two floor tiles of the
 * gap). `state`: red (locked), green (unlocked), open (slid into the wall), dead (closed for good, grey lamp).
 */
function airlockDoor(state: 'rouge' | 'verte' | 'ouverte' | 'morte'): string {
  const p = new Pix(16, 48);
  // The lamp, on the wall tile above the gap.
  const lamp = state === 'rouge' ? 'r' : state === 'verte' ? 'L' : state === 'ouverte' ? 'l' : 'G';
  const rim = state === 'rouge' ? 'R' : state === 'verte' ? 'e' : state === 'ouverte' ? 'L' : 'd';
  p.ellipse(8, 8, 3, 3, rim).ellipse(7.6, 7.6, 2, 2, lamp).set(7, 7, state === 'morte' ? 'g' : 'f');
  p.set(4, 8, '%').set(11, 8, '%').set(8, 4, '%');
  if (state === 'ouverte') {
    // Only the rails on the floor and the end of the panel, slid into the wall.
    p.rect(5, 16, 6, 3, '8').rect(5, 16, 1, 3, '%').rect(10, 16, 1, 3, '%').rect(5, 18, 6, 1, '%');
    for (let y = 22; y < 48; y += 3) p.set(6, y, '9').set(9, y, '9');
    return p.toString();
  }
  // The panel: thick frosted plastic seen edge-on, a rubber seal at both ends, a handle.
  p.rect(5, 16, 6, 32, '8');
  p.rect(6, 17, 4, 30, state === 'morte' ? '9' : '6');
  p.rect(5, 16, 1, 32, '%').rect(10, 16, 1, 32, '%').rect(5, 16, 6, 1, '%').rect(5, 47, 6, 1, '%');
  p.rect(6, 17, 4, 2, 'd').rect(6, 45, 4, 2, 'd');
  p.rect(3, 30, 3, 2, '%').rect(10, 30, 3, 2, '%');
  // Frost on the lower part.
  for (let y = 36; y < 45; y++) if ((y * 7) % 3 === 0) p.set(7 + (y % 2), y, 'f');
  return p.toString();
}

/** « Pas de visite si fièvre, toux, rhume. » — a laminated notice with three crossed-out pictograms. */
const NOTICE = (() => {
  const p = new Pix(30, 22);
  p.rect(0, 0, 30, 22, 'w').rect(0, 0, 30, 1, 'r').rect(0, 21, 30, 1, 'r').rect(0, 0, 1, 22, 'r').rect(29, 0, 1, 22, 'r');
  p.rect(3, 3, 24, 1, '%').rect(3, 5, 18, 1, '%');
  const picto = (cx: number): void => {
    p.ellipse(cx, 14, 4, 4, 'r').ellipse(cx, 14, 3, 3, 'w');
    for (let i = -2; i <= 2; i++) p.set(cx + i, 14 - i, 'r');
  };
  picto(7);
  picto(15);
  picto(23);
  // Inside: a thermometer, a cough cloud, a tissue.
  p.set(7, 12, '%').set(7, 13, '%').set(7, 15, 'r').set(16, 13, '%').set(14, 15, '%').set(23, 13, '%').set(24, 15, '%');
  p.contour('k');
  return p.toString();
})();

const INTERCOM = `
  .kkkkkkkk.
  k66666666k
  k6%%%%%%6k
  k6%9%9%%6k
  k6%%9%9%6k
  k66666666k
  k666rr666k
  k666rr666k
  k66666666k
  .kkkkkkkk.
`;

const SANITIZER = `
  ..kkkkkk..
  .k%%%%%%k.
  .k666666k.
  .k6@@@@6k.
  .k6@$$@6k.
  .k6@@@@6k.
  .k666666k.
  .kk%%%%kk.
  ...k%%k...
  ...k@@k...
  ....k$....
  .....$....
  ..........
  .....@....
`;

const MASK_BOX = `
  .kkkkkkkkkkkk.
  k666666666666k
  k6bbbb6bbbb66k
  k6b77b6b77b66k
  k6bbbb6bbbb66k
  k%%%%%%%%%%%%k
  k666666666666k
  k66%%%66%%6%6k
  k666666666666k
  .kkkkkkkkkkkk.
`;

const BIN = `
  .kkkkkkkk.
  k%%%%%%%%k
  .k666666k.
  .k666666k.
  .k679976k.
  .k666666k.
  .k666666k.
  .k777777k.
  ..kkkkkk..
  ..k%..%k..
`;

/** « Un sourire, ça se voit même avec un masque ! » — the smiling face wears a mask, and the smile is on the mask. */
const SMILE_POSTER = `
  kkkkkkkkkkkkkk
  k666666666666k
  k6666kkkk6666k
  k666k6666k666k
  k66k6%66%6k66k
  k66k666666k66k
  k66kbbbbbbk66k
  k66bb%bb%bbb6k
  k66bbb%%bbbb6k
  k666kbbbbk666k
  k6666kkkk6666k
  k666666666666k
  k6%%%6%%%%%66k
  k666666666666k
  k6%%%%%6%%%66k
  kkkkkkkkkkkkkk
`;

/** A trolley of sheets, folded, ironed, flat. */
const SHEET_TROLLEY = (() => {
  const p = new Pix(26, 22);
  p.rect(2, 2, 22, 2, '%').rect(2, 12, 22, 2, '%');
  for (const y of [4, 6, 8, 10]) p.rect(3, y, 20, 2, y % 4 ? 'w' : 'W').rect(3, y + 1, 20, 1, '7');
  p.rect(2, 14, 1, 6, '%').rect(23, 14, 1, 6, '%');
  p.ellipse(3, 20, 1.5, 1.5, 'd').ellipse(23, 20, 1.5, 1.5, 'd');
  p.contour('k');
  return p.toString();
})();

const RADIATOR = `
  .kkkkkkkkkkkkkk.
  k6k6k6k6k6k6k66k
  k6k6k6k6k6k6k67k
  k6k6k6k6k6k6k67k
  k6k6k6k6k6k6k67k
  k6k6k6k6k6k6k67k
  k7k7k7k7k7k7k77k
  .kkkkkkkkkkkkkk.
  ..k%.......k%...
`;

/** « Le mercredi, crêpes ! » — someone drew eyes on the crêpe. */
const CREPE_POSTER = `
  kkkkkkkkkkkkkk
  kwwwwwwwwwwwwk
  kw%%%w%%%%%wwk
  kwwwwwwwwwwwwk
  kwwwkkkkkkwwwk
  kwwkYyyyyYkwwk
  kwkyykyykyykwk
  kwkyyyyyyyykwk
  kwkyyRrrRyykwk
  kwwkYyyyyYkwwk
  kwwwkkkkkkwwwk
  kwwwwwwwwwwwwk
  kw%%w%%%w%%wwk
  kkkkkkkkkkkkkk
`;

/** Three waiting-room chairs fixed to a bar. */
const CHAIRS = (() => {
  const p = new Pix(48, 22);
  for (const x of [1, 17, 33]) {
    p.rect(x, 2, 14, 9, 'b').rect(x, 2, 14, 2, 'w').rect(x + 1, 11, 12, 4, 'B').rect(x + 1, 11, 12, 1, 'b');
  }
  p.rect(0, 15, 48, 2, '%');
  for (const x of [3, 23, 43]) p.rect(x, 17, 2, 4, '%');
  p.contour('k');
  return p.toString();
})();

/** The reception window: a blind pulled down, a bell on the ledge. */
const RECEPTION = (() => {
  const p = new Pix(34, 26);
  p.rect(0, 0, 34, 20, '8').rect(2, 2, 30, 15, '6');
  for (let y = 3; y < 16; y += 2) p.rect(3, y, 28, 1, '9');
  p.rect(0, 20, 34, 4, 'w').rect(0, 23, 34, 1, '7');
  p.ellipse(25, 19, 3, 2, 'Y').rect(25, 16, 1, 2, 'g').ellipse(24.5, 18.5, 1, 0.8, 'y');
  p.rect(6, 21, 10, 1, '%');
  p.contour('k');
  return p.toString();
})();

/** A fish tank with no fish: paper fish are taped on the outside of the glass. */
const AQUARIUM = (() => {
  const p = new Pix(26, 28);
  p.rect(1, 1, 24, 16, '@').rect(1, 1, 24, 2, '6').rect(2, 14, 22, 3, '8');
  for (const [x, y] of [[6, 7], [15, 10], [19, 5]] as const) p.rect(x, y, 4, 2, 'o').set(x - 1, y, 'o').set(x - 1, y + 1, 'o').set(x + 3, y, 'k');
  p.rect(5, 6, 6, 1, 'w').rect(14, 9, 6, 1, 'w');
  p.rect(0, 17, 26, 2, '%').rect(2, 19, 2, 8, '%').rect(22, 19, 2, 8, '%').rect(2, 23, 22, 1, '9');
  p.contour('k');
  return p.toString();
})();

/** A toy box: every toy is sealed in plastic film, « désinfecté ». */
const TOYBOX = (() => {
  const p = new Pix(22, 18);
  p.rect(1, 6, 20, 11, 'c').rect(1, 6, 20, 2, 'q').rect(1, 15, 20, 2, 'C');
  // Toys sticking out, wrapped.
  p.ellipse(6, 5, 3, 3, 'y').ellipse(14, 4, 4, 3, 'p').rect(17, 1, 2, 6, 'b');
  for (const [x, y] of [[4, 3], [8, 5], [12, 2], [16, 4], [18, 2]] as const) p.set(x, y, 'f');
  p.contour('k');
  p.rect(5, 10, 12, 1, '%');
  return p.toString();
})();

const FOUNTAIN = `
  ..kkkkkk..
  .k@@@@@@k.
  .k@$@@@@k.
  .k@$@@@@k.
  .k@@@@@@k.
  ..kkkkkk..
  .k666666k.
  .k6%%6%6k.
  .k666666k.
  .k66b666k.
  .k666666k.
  .k666666k.
  .k777777k.
  .kkkkkkkk.
  ..k%..%k..
`;

/** A coat rack of paper gowns, yellow; the last one is tiny. */
const GOWNS = (() => {
  const p = new Pix(30, 30);
  p.rect(0, 2, 30, 2, '%');
  const gown = (x: number, h: number, w: number): void => {
    p.rect(x, 4, w, h, 'y').rect(x, 4, w, 1, 'Y').rect(x + Math.floor(w / 2), 4, 1, h, 'Y');
    p.set(x + Math.floor(w / 2), 3, '%');
  };
  gown(1, 22, 8);
  gown(11, 22, 8);
  gown(22, 9, 5);
  p.contour('k');
  return p.toString();
})();

const MIRROR = `
  kkkkkkkkkkkk
  k%%%%%%%%%%k
  k%@@@@@@f@%k
  k%@@@@@f@@%k
  k%@@@@f@@@%k
  k%@@@f@@@@%k
  k%@@f@@@@@%k
  k%@f@@@@@@%k
  k%@@@@@@@@%k
  k%@@@@@@@@%k
  k%@@@@@@@@%k
  k%%%%%%%%%%k
  kkkkkkkkkkkk
`;

const SINK = `
  .....kk.....
  ....k%%k....
  ...k%kk%k...
  .kkkkkkkkkk.
  k6666666666k
  k6@@@@@@@@6k
  k6@$@@@@@@6k
  k6@@@@k@@@6k
  .k66666666k.
  ..kk%%%%kk..
  ....k%%k....
  ....k%%k....
`;

const BENCH = `
  .kkkkkkkkkkkkkkkkkkkkkkkkkkkkk.
  k6666666666666666666666666667k
  k7777777777777777777777777779k
  .k%%k..................k%%k..
`;

const WALL_THERMO = `
  .kk.
  k6rk
  k6rk
  k6rk
  k66k
  k66k
  krrk
  .kk.
`;

// ---------------------------------------------------------------------------------------------------------------------
// Props — the white lake
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The five drawings taped to the tarps (Mina's, crayon on paper): 18×22 sheets with a strip of tape at the top.
 * `fixed`: Noa has drawn himself into it, a black ballpoint figure, too tall, without a face.
 */
type DrawingKey = 'maman' | 'nadia' | 'mina' | 'chaise' | 'plage';
function drawing(id: DrawingKey, fixed: boolean): string {
  const p = new Pix(20, 24);
  p.rect(1, 2, 18, 21, 'w').rect(1, 22, 18, 1, 'W');
  p.rect(6, 1, 8, 3, 'q');
  const stick = (x: number, foot: number, size: number, c: string, head: string): void => {
    p.ellipse(x, foot - size + 2, 2, 2, head);
    for (let y = foot - size + 4; y < foot - 3; y++) p.set(x, y, c);
    p.set(x - 1, foot - 2, c).set(x - 2, foot - 1, c).set(x + 1, foot - 2, c).set(x + 2, foot - 1, c);
    p.set(x - 1, foot - size + 6, c).set(x - 2, foot - size + 7, c).set(x + 1, foot - size + 6, c).set(x + 2, foot - size + 7, c);
  };
  if (id === 'maman') {
    // Maman asleep in the armchair, a blanket, the moon in the window.
    p.rect(4, 13, 12, 7, 'V').rect(4, 12, 2, 8, 'u').rect(14, 12, 2, 8, 'u');
    p.ellipse(10, 11, 2, 2, 's').rect(8, 9, 5, 1, 'x');
    p.rect(6, 14, 8, 3, 'p');
    p.ellipse(15, 5, 1.5, 1.5, 'y');
  } else if (id === 'nadia') {
    // Nadia with a big smile and her torch.
    stick(9, 20, 13, 'b', 's');
    p.rect(7, 12, 5, 5, 'a');
    p.set(13, 13, 'g').set(14, 12, 'y').set(15, 11, 'y').set(16, 10, 'y');
    p.rect(3, 4, 6, 1, 'b').rect(11, 4, 5, 1, 'b');
  } else if (id === 'mina') {
    // Mina in her bed, her knitted hat with sheep ears (a drawing she made of herself).
    p.rect(3, 14, 14, 6, 'W').rect(3, 13, 14, 1, 'b').rect(2, 12, 2, 9, 'g').rect(16, 12, 2, 9, 'g');
    p.ellipse(7, 12, 2, 2, 's').rect(5, 10, 5, 2, 'w').set(5, 9, 'w').set(9, 9, 'w');
    p.rect(11, 4, 5, 1, 'r');
  } else if (id === 'chaise') {
    // An empty chair, « NOA » written above it.
    p.rect(7, 13, 7, 2, 'C').rect(7, 8, 1, 12, 'C').rect(13, 15, 1, 5, 'C').rect(8, 15, 1, 5, 'C');
    p.rect(5, 4, 1, 4, 'B').rect(6, 5, 1, 1, 'B').rect(7, 4, 1, 4, 'B').rect(9, 4, 3, 4, 'B').rect(10, 5, 1, 2, 'w').rect(13, 4, 3, 1, 'B').rect(13, 4, 1, 4, 'B').rect(15, 4, 1, 4, 'B').rect(13, 6, 3, 1, 'B');
  } else {
    // The beach: the sea, the sun, Maman and Mina, a towel; far away, on his own, a small boy sulking.
    p.rect(2, 15, 16, 2, 'b').rect(2, 17, 16, 5, 'q');
    p.ellipse(15, 6, 2, 2, 'y');
    stick(6, 21, 9, 'p', 's');
    stick(10, 21, 6, 'r', 's');
    p.set(10, 15, 'y').set(9, 15, 'y').set(11, 15, 'y');
    stick(16, 19, 4, 'B', 's');
  }
  if (fixed) {
    // The added figure: black ballpoint, too tall, long arms, no face.
    const x = id === 'chaise' ? 10 : id === 'plage' ? 13 : 15;
    p.ellipse(x, 5, 1.6, 1.6, 'k').set(x, 5, 'w');
    for (let y = 7; y < 21; y++) p.set(x, y, 'k');
    p.set(x - 1, 8, 'k').set(x - 2, 10, 'k').set(x - 2, 12, 'k').set(x - 2, 14, 'k').set(x + 1, 8, 'k').set(x + 2, 10, 'k').set(x + 2, 12, 'k').set(x + 2, 14, 'k');
    p.set(x - 1, 21, 'k').set(x + 1, 21, 'k').set(x - 1, 20, 'k').set(x + 1, 20, 'k');
  }
  p.contour('9');
  return p.toString();
}

/** The parents' room: a hut of tarps standing on the ice, a door, a lit window, a pipe of a heater. */
const HUT = (() => {
  const p = new Pix(66, 52);
  // Roof (a tarp pulled tight over a frame).
  for (let y = 2; y < 16; y++) {
    const inset = Math.max(0, 14 - y);
    p.rect(1 + inset, y, 64 - inset * 2, 1, y % 3 ? '8' : '9');
  }
  p.rect(1, 15, 64, 2, '%');
  // Walls: tarps with folds.
  for (let y = 17; y < 50; y++) for (let x = 2; x < 64; x++) p.set(x, y, Math.sin(x * 0.9) > 0.8 ? 'f' : Math.sin(x * 0.9) < -0.7 ? '9' : '8');
  // Door (closed tarp flap) and a window with warm light.
  p.rect(26, 26, 14, 24, '9').rect(27, 27, 12, 23, '8').rect(32, 27, 1, 23, '9');
  p.rect(8, 24, 12, 9, '%').rect(9, 25, 10, 7, 'y').rect(9, 25, 10, 2, 'q').rect(13, 25, 1, 7, '%');
  p.rect(46, 24, 12, 9, '%').rect(47, 25, 10, 7, '@').rect(51, 25, 1, 7, '%');
  // Sign: « Salle des parents ».
  p.rect(25, 19, 16, 5, 'w').rect(27, 21, 12, 1, '%');
  p.contour('%');
  return p.toString();
})();

/** The fold-out armchair of the parents' room; a blanket folded on it. */
const ARMCHAIR = (() => {
  const p = new Pix(22, 28);
  p.rect(2, 2, 18, 10, 'u').rect(3, 3, 16, 8, 'V').rect(0, 10, 4, 14, 'u').rect(18, 10, 4, 14, 'u');
  p.rect(3, 12, 16, 10, 'V').rect(3, 21, 16, 2, 'u');
  p.rect(5, 13, 12, 4, 'b').rect(5, 13, 12, 1, 'w').rect(5, 16, 12, 1, 'B');
  p.rect(3, 24, 2, 3, 'd').rect(17, 24, 2, 3, 'd');
  p.contour('k');
  return p.toString();
})();

/** The vending machine: hot chocolate, crisps, a coin slot, a light that hums. */
const VENDING = (() => {
  const p = new Pix(20, 34);
  p.rect(0, 0, 20, 34, 'r').rect(0, 0, 20, 2, 'R');
  p.rect(2, 3, 12, 22, '@');
  for (let y = 5; y < 24; y += 5) p.rect(3, y, 10, 1, 'g');
  for (const [x, y] of [[4, 6], [8, 6], [4, 11], [9, 11], [5, 16], [10, 16], [4, 21]] as const) p.rect(x, y - 3, 2, 3, (x + y) % 3 ? 'y' : 'o');
  p.rect(15, 4, 3, 10, 'K');
  for (let y = 5; y < 13; y += 2) p.rect(16, y, 1, 1, 'L');
  p.rect(15, 16, 3, 2, 'g');
  p.rect(3, 27, 10, 4, 'K');
  p.contour('k');
  return p.toString();
})();

/** Forty-one paper cups, stacked in a pyramid by the coffee machine. */
const CUPS = (() => {
  const p = new Pix(30, 26);
  let row = 0;
  for (let n = 8; n >= 1; n--, row++) {
    const y = 22 - row * 3;
    const x0 = 15 - n * 1.75;
    for (let i = 0; i < n; i++) {
      const x = Math.round(x0 + i * 3.5);
      p.rect(x, y, 3, 3, 'w').set(x, y, 'W').set(x + 2, y + 2, '7');
    }
  }
  p.contour('k');
  return p.toString();
})();

/** The coffee machine on a little table. */
const COFFEE = `
  .kkkkkkkkkk.
  k%%%%%%%%%%k
  k6666666666k
  k66KKKKK666k
  k66KLLLK666k
  k66KKKKK6r6k
  k6666666666k
  k666kkkk666k
  k666k..k666k
  k666kwwk666k
  k6666666666k
  kkkkkkkkkkkk
  .k%......%k.
  .k%......%k.
`;

/** A vent in the partition: through it, the voices. */
const VENT = `
  kkkkkkkkkkkk
  k%%%%%%%%%%k
  k9999999999k
  k%%%%%%%%%%k
  k9999999999k
  k%%%%%%%%%%k
  kkkkkkkkkkkk
`;

/** A sheet of paper taped to the glass of the box: « Semaine 5 ». */
const WEEK_SHEET = `
  ..kqqqk..
  kkkkkkkkk
  kwwwwwwwk
  kw%%%%wwk
  kwwwwwwwk
  kw%%%w5wk
  kwwwwwwwk
  kkkkkkkkk
`;

/** A paper crown frozen under the ice, seen through it. */
const UNDER_ICE_CROWN = `
  $.$..$..$.
  $$$$$$$$$$
  $@@@@@@@@$
  $$$$$$$$$$
`;

/** Snowfall markers on the lake (where the flakes are going to land) and a flake landing. */
const TARGET = `
  ..%%%%%..
  .%.....%.
  %.......%
  .%.....%.
  ..%%%%%..
`;
const FLAKE = `
  ....%....
  .%..f..%.
  ..%.f.%..
  ...fff...
  %fffffff%
  ...fff...
  ..%.f.%..
  .%..f..%.
  ....%....
`;

// ---------------------------------------------------------------------------------------------------------------------
// Props — the glass room (304, « Semaine 5 »)
// ---------------------------------------------------------------------------------------------------------------------

/** The bed of the glass room: a white bed, the sheet pulled flat. */
const BED = (() => {
  const p = new Pix(22, 34);
  p.rect(1, 1, 20, 4, 'g').rect(2, 2, 18, 2, 'W');
  p.rect(2, 5, 18, 26, 'w').rect(4, 6, 14, 5, 'f').rect(4, 10, 14, 1, 'W');
  p.rect(2, 13, 18, 18, 'w');
  for (let y = 14; y < 30; y += 3) p.rect(3, y, 16, 1, '7');
  p.rect(2, 29, 18, 2, 'b');
  p.rect(1, 31, 2, 3, 'g').rect(19, 31, 2, 3, 'g');
  p.contour('%');
  return p.toString();
})();

/** The silhouette in the knitted hat with sheep ears: a flat shape, grey-blue, like a cut-out. Never more than that. */
function silhouette(frame: number): string {
  const p = new Pix(16, 24);
  // Hat with two sheep ears.
  p.ellipse(8, 7, 5, 5, '9');
  p.ellipse(3, 5, 2, 1.5, '9').ellipse(13, 5, 2, 1.5, '9');
  p.rect(3, 8, 10, 3, '9');
  // The shape below: shoulders, a body without detail.
  p.ellipse(8, 18 + frame * 0.3, 6, 6, '9').rect(2, 18, 12, 6, '9');
  // Pom-pom of the hat, the only lighter thing.
  p.ellipse(8, 2, 1.5, 1.5, '8');
  // A drawn line where the face would be: nothing.
  return p.toString();
}

/** A small table with a sheet of paper and two pens: a blue ballpoint, a red crayon. */
const DRAW_TABLE = (() => {
  const p = new Pix(26, 20);
  p.rect(1, 2, 24, 10, 'c').rect(1, 12, 24, 2, 'C').rect(3, 14, 2, 6, 'C').rect(21, 14, 2, 6, 'C');
  p.rect(6, 3, 13, 8, 'w').ellipse(12, 6, 2.5, 2.5, 'y').ellipse(12, 6, 2.5, 2.5, 'y');
  p.rect(9, 9, 1, 1, '%').rect(15, 9, 1, 1, 'r');
  p.rect(20, 4, 1, 5, '%').rect(4, 5, 1, 5, 'r');
  p.contour('k');
  return p.toString();
})();

/** Hand prints on the glass, from the other side: small, flat, five fingers. */
const HANDPRINT = `
  .k.k.k...
  .k.k.k.k.
  .kkkkk.k.
  kkkkkkkk.
  kkkkkkk..
  .kkkkk...
  ..kkk....
`;

/** The infusion stand (an object: a pole, a bag of clear liquid). */
const DRIP = `
  kkkkkkk.
  ...k....
  .kkkkk..
  k@@@@@k.
  k@@@@@k.
  k@@@@@k.
  .k@@@k..
  ..k%k...
  ...%....
  ...k....
  ...k....
  ...k....
  ...k....
  ...k....
  ...k....
  ...k....
  .kkkkk..
  k.....k.
`;

/** After the tide: a flat round of correction fluid where the castle stood; a smear where the writing was. */
const WHITE_ROUND = (() => {
  const p = new Pix(36, 12);
  p.ellipse(18, 6, 17, 5.5, '=').ellipse(18, 5.5, 15.5, 4.5, 'f');
  for (const [x, y] of [[9, 4], [20, 3], [26, 7]] as const) p.set(x, y, '&');
  return p.toString();
})();
const WHITE_SMEAR = (() => {
  const p = new Pix(64, 22);
  for (let y = 0; y < 22; y++)
    for (let x = 0; x < 64; x++) {
      const edge = 2 + Math.sin(x * 0.4) * 1.5 + Math.sin(x * 0.13) * 2;
      if (y > edge && y < 20 - edge * 0.5) p.set(x, y, hash(x >> 1, y, 3) < 0.12 ? '=' : 'f');
    }
  // Under the white, a few letters still show.
  for (const [x, y] of [[4, 4], [5, 4], [6, 5], [22, 10], [23, 11], [41, 16], [42, 16]] as const) p.set(x, y, '&');
  return p.toString();
})();

/** The glass door of the box (front view): two frosted panels; open, they have slid into the frame. */
function glassDoor(open: boolean): string {
  const p = new Pix(32, 34);
  p.rect(0, 0, 32, 34, '%');
  p.rect(1, 1, 30, 33, open ? '6' : '@');
  if (open) {
    p.rect(1, 1, 4, 33, '@').rect(27, 1, 4, 33, '@').rect(5, 1, 1, 33, '%').rect(26, 1, 1, 33, '%');
    p.rect(6, 30, 20, 4, '7');
  } else {
    p.rect(15, 1, 2, 33, '%');
    for (let y = 2; y < 33; y++) {
      if ((y * 5) % 7 === 0) p.set(4 + (y % 9), y, 'f').set(20 + (y % 7), y, 'f');
      if (y > 20 && (y + 1) % 3 === 0) p.set(8, y, '7').set(24, y, '7');
    }
    p.rect(12, 16, 2, 4, '%').rect(18, 16, 2, 4, '%');
  }
  return p.toString();
}

const PLATE_304 = `
  kkkkkkkkkkkkkk
  kwwwwwwwwwwwwk
  kw%%%w%%%w%w%k
  kww%%w%w%w%%%k
  kw%%%w%%%www%k
  kwwwwwwwwwwwwk
  kkkkkkkkkkkkkk
`;

/** Two infusion stands planted in the ice like reeds, frozen at their feet. */
const FROZEN_DRIPS = (() => {
  const p = new Pix(32, 34);
  const stand = (x: number, h: number, bag: boolean): void => {
    p.rect(x, 34 - h, 1, h - 3, 'g');
    p.rect(x - 3, 34 - h, 7, 1, 'g');
    if (bag) p.rect(x - 3, 35 - h, 3, 5, '@').rect(x - 3, 35 - h, 3, 1, '6').set(x - 2, 40 - h, '%');
    p.set(x + 3, 35 - h, '$').set(x + 3, 36 - h, '$');
  };
  stand(8, 30, true);
  stand(22, 24, false);
  p.contour('k');
  p.ellipse(8, 32, 5, 2, '$').ellipse(22, 32, 5, 2, '$').ellipse(8, 31.5, 3, 1, 'f').ellipse(22, 31.5, 3, 1, 'f');
  return p.toString();
})();

/** A wheelchair frozen into the ice up to its axles. */
const WHEELCHAIR = (() => {
  const p = new Pix(22, 22);
  p.rect(5, 2, 2, 12, 'g').rect(5, 2, 9, 2, 'G').rect(6, 9, 12, 3, 'b').rect(7, 4, 7, 6, 'b');
  p.ellipse(7, 15, 5, 5, 'G').ellipse(7, 15, 3.5, 3.5, '.').ellipse(7, 15, 1, 1, 'g');
  p.rect(16, 12, 2, 6, 'g');
  p.contour('k');
  p.rect(0, 17, 22, 5, '@').rect(0, 17, 22, 1, '$');
  for (let x = 0; x < 22; x += 3) p.set(x, 18, 'f');
  return p.toString();
})();

/** A small snowman wearing a surgical mask; someone drew a smile on the mask. A paper crown. */
const SNOWMAN = (() => {
  const p = new Pix(18, 26);
  p.ellipse(9, 19, 7, 6, 'f').ellipse(9, 9, 5, 5, 'f');
  p.ellipse(10, 21, 6, 4, '=').ellipse(8, 18, 5, 4, 'f');
  p.rect(5, 10, 9, 3, 'b').set(4, 10, '%').set(14, 10, '%').set(4, 12, '%').set(14, 12, '%');
  for (let x = 7; x <= 11; x++) p.set(x, 11 + (x === 7 || x === 11 ? 0 : 1) - (x === 9 ? 0 : 0), '%');
  p.set(7, 7, 'k').set(11, 7, 'k');
  p.rect(5, 3, 9, 2, 'y').set(5, 2, 'y').set(9, 1, 'y').set(13, 2, 'y').set(7, 2, 'y').set(11, 2, 'y');
  p.set(2, 16, 'C').set(1, 15, 'C').set(16, 16, 'C').set(17, 15, 'C');
  p.contour('%');
  return p.toString();
})();

/** Prints of small boots in the snow; they go two steps, then stop. */
const BOOT_PRINTS = `
  ................................
  ..%%%...........................
  .%==%%.....%%%..................
  .%===%....%==%%.................
  .%===%....%===%.......%%%.%%%...
  ..%=%.....%===%......%==%%==%%..
  ...........%=%.......%===%===%..
  .....................%===%===%..
  ......................%=%.%=%...
`;

/** A round hole in the ice: black water, very still. */
const ICE_HOLE = (() => {
  const p = new Pix(34, 16);
  p.ellipse(17, 8, 16, 7, '$').ellipse(17, 8, 14, 5.5, '+').ellipse(17, 8.5, 12.5, 4.5, 'i').ellipse(14, 7, 5, 1.5, 'K');
  for (const [x, y] of [[3, 2], [30, 3], [2, 13], [31, 12]] as const) p.set(x, y, 'f');
  return p.toString();
})();

/** The visiting hours, with the times crossed out by hand. */
const PLANNING = `
  kkkkkkkkkkkkkk
  kwwwwwwwwwwwwk
  kw%%%%%%%%wwwk
  kwwwwwwwwwwwwk
  kw%%ww%%%%%wwk
  kwwwwwwwwwwwwk
  kw%%wwrrr%%wwk
  kwwwwrwwwwwwwk
  kw%%ww%%r%%wwk
  kwwwwwwwwwwwwk
  kw%%%ww%%%%wwk
  kwwwwwwwwwwwwk
  kkkkkkkkkkkkkk
`;

/** « Téléphone des familles »: a wall phone, its receiver hanging on its cord. */
const FAMILY_PHONE = `
  .kkkkkkkk.
  k66666666k
  k6%%%%%%6k
  k6%6%6%%6k
  k6%%%%%%6k
  k6%6%6%%6k
  k66666666k
  .kkkkkkkk.
  ....k%....
  ....k%....
  ...k%.....
  ..kddk....
  ..kddk....
  ..kddk....
  ...kk.....
`;

/** Maman's coat on the back of a chair, keeping the shape of her shoulders. */
const COAT_CHAIR = `
  ...kkkkkkkk.....
  ..kQQQQQQQQk....
  .kQccccccccQk...
  .kQccccccccQk...
  .kQccQccQccQk...
  .kQcccccccccQk..
  .kQcccccccccQk..
  ..kQQQQQQQQQk...
  ..kCkkkkkkkCk...
  ..kCcccccccCk...
  ..kCCCCCCCCCk...
  ..kCk.....kCk...
  ..kCk.....kCk...
  ..kxk.....kxk...
`;

/** Dodo, plump and new, asleep on the pillow (week 5: lent to Mina, « il veillera sur toi »). */
const DODO_PILLOW = `
  ...........kk.kk..
  .....kk.kk.kpPpk..
  ...kkwwkwwkwkPk...
  ..kwwwwwwwwwwwk...
  .kwwwGGGGGGwwWWk..
  kwwwGgkggkgGwWWWk.
  kwwwGgggtggGwWWWk.
  .kwwwGGGGGGwwWWk..
  ..kkWWWWWWWWWkk...
  ....kkkkkkkkk.....
`;

/** Three small drawings taped on the inside of the back glass. */
const GLASS_DRAWINGS = (() => {
  const p = new Pix(48, 18);
  const sheet = (x: number, y: number, w: number, h: number): void => {
    p.rect(x, y, w, h, 'w').rect(x + Math.floor(w / 2) - 2, y - 1, 4, 2, 'q');
  };
  sheet(2, 3, 12, 13);
  sheet(18, 2, 12, 14);
  sheet(34, 4, 12, 12);
  p.ellipse(8, 9, 3, 3, 'y').rect(21, 11, 6, 3, 'b').ellipse(24, 7, 2, 2, 'p').rect(37, 9, 6, 1, 'r').rect(37, 11, 4, 1, 'r');
  p.contour('9');
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// The giant Dodo of the fall: immense above the lake, he opens his own seam
// ---------------------------------------------------------------------------------------------------------------------

function giantDodo(open: 0 | 1 | 2): string {
  const p = new Pix(96, 92);
  // Wool body.
  p.ellipse(48, 52, 40, 36, 'W').ellipse(46, 50, 38, 34, 'w');
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    p.ellipse(48 + Math.cos(a) * 37, 52 + Math.sin(a) * 33, 5, 5, i % 3 ? 'w' : 'W');
  }
  // Face (grey felt), button eyes sewn with red thread, the bow.
  p.ellipse(48, 40, 18, 14, 'g').ellipse(47, 39, 16, 12, 'W');
  for (const ex of [40, 56]) {
    p.ellipse(ex, 38, 4, 4, 'k').ellipse(ex - 1, 37, 1.5, 1.5, 'd');
    p.set(ex - 2, 36, 'r').set(ex + 2, 40, 'r').set(ex + 2, 36, 'r').set(ex - 2, 40, 'r');
  }
  // The smile: too wide, stitched.
  for (let x = 38; x <= 58; x++) {
    const y = 46 + Math.round(((x - 48) / 10) ** 2 * -2 + 2);
    p.set(x, y, 'k');
    if (x % 3 === 0) p.set(x, y - 1, 'r').set(x, y + 1, 'r');
  }
  p.ellipse(32, 46, 3, 2, 'p').ellipse(64, 46, 3, 2, 'p');
  p.ellipse(66, 18, 6, 4, 'p').ellipse(74, 18, 6, 4, 'p').ellipse(70, 18, 2, 2, 'P');
  // Ears.
  p.ellipse(22, 30, 8, 4, 'g').ellipse(74, 30, 8, 4, 'g');
  // The seam of his belly: red stitches; opening, cotton pouring out of it.
  const top = 58;
  const len = 24;
  for (let y = top; y < top + len; y++) {
    const w = open === 0 ? 0 : open === 1 ? Math.round(Math.sin(((y - top) / len) * Math.PI) * 4) : Math.round(Math.sin(((y - top) / len) * Math.PI) * 9);
    if (w > 0) {
      p.rect(48 - w, y, w * 2 + 1, 1, open === 2 ? 'K' : 'd');
      p.set(48 - w, y, 'q').set(48 + w, y, 'q');
    }
    if (y % 3 === 0) p.set(47 - w, y, 'r').set(49 + w, y, 'r');
    else if (w === 0) p.set(48, y, 'k');
  }
  if (open === 2) {
    for (const [x, y, r] of [[48, 84, 6], [44, 88, 4], [53, 87, 5], [48, 91, 3]] as const) p.ellipse(x, y, r, r * 0.7, 'q');
    for (let y = 62; y < 78; y += 4) p.set(48, y, 'q').set(46, y + 1, 'Q');
  }
  p.contour('k');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

const ICE_C = WHITE;

export const CHARS: Record<string, CharDef> = {
  mina_avant: MINA_AVANT,
};

/** Every chapter 5 sprite keeps its authored colours in the white world: `key@blanc` is the same art. */
function keep(defs: Record<string, SpriteDef>): Record<string, SpriteDef> {
  const out: Record<string, SpriteDef> = { ...defs };
  for (const [k, v] of Object.entries(defs)) out[`${k}@blanc`] = v;
  return out;
}

export const ART: Record<string, SpriteDef> = keep({
  // --- Tiles: the beach
  t_c5_sable_1: sprite(sand(1, false, false), BEACH),
  t_c5_sable_2: sprite(sand(2, true, false), BEACH),
  t_c5_sable_3: sprite(sand(3, true, false), BEACH),
  t_c5_sable_4: sprite(sand(4, false, true), BEACH),
  t_c5_sable_mouille_1: sprite(wetSand(1), BEACH),
  t_c5_sable_mouille_2: sprite(wetSand(2), BEACH),
  t_c5_ecume_1: sprite(foam(0), BEACH),
  t_c5_ecume_2: sprite(foam(1), BEACH),
  t_c5_ecume_3: sprite(foam(2), BEACH),
  t_c5_mer_1: sprite(sea(0), BEACH),
  t_c5_mer_2: sprite(sea(1), BEACH),
  t_c5_mer_3: sprite(sea(2), BEACH),
  t_c5_dune_1: sprite(dune(1), BEACH),
  t_c5_dune_2: sprite(dune(2), BEACH),
  t_c5_ganivelle: sprite(GANIVELLE, BEACH),
  t_c5_rocher_1: sprite(rock(1), BEACH),
  t_c5_rocher_2: sprite(rock(2), BEACH),
  t_c5_planches: sprite(PLANKS, BEACH),
  t_c5_maree_1: sprite(whiteSand(1), ALL),
  t_c5_maree_2: sprite(whiteSand(2), ALL),
  t_c5_brume_1: sprite(haze(1), BEACH),
  t_c5_brume_2: sprite(haze(2), BEACH),
  // --- Tiles: ice (the frozen sea, the lake)
  t_c5_glace_1: sprite(ice(1, false), ICE_C),
  t_c5_glace_2: sprite(ice(2, false), ICE_C),
  t_c5_glace_3: sprite(ice(3, true), ICE_C),
  t_c5_glace_vague_1: sprite(ice(4, false, true), ICE_C),
  t_c5_glace_vague_2: sprite(ice(5, false, true), ICE_C),
  // --- Tiles: the white hospital
  t_c5_sol_1: sprite(fluid(1, false), WHITE),
  t_c5_sol_2: sprite(fluid(2, false), WHITE),
  t_c5_sol_3: sprite(fluid(3, true), WHITE),
  t_c5_mur_top_1: sprite(wallTop(0), WHITE),
  t_c5_mur_top_2: sprite(wallTop(2), WHITE),
  t_c5_bache_1: sprite(tarp(false, 1), WHITE),
  t_c5_bache_2: sprite(tarp(false, 5), WHITE),
  t_c5_bache_base_1: sprite(tarp(true, 1), WHITE),
  t_c5_bache_base_2: sprite(tarp(true, 5), WHITE),
  t_c5_bache_ombre: sprite(tarp(false, 3, true), WHITE),
  t_c5_bache_ombre_base: sprite(tarp(true, 3, true), WHITE),
  t_c5_neige_1: sprite(snow(1), WHITE),
  t_c5_neige_2: sprite(snow(2), WHITE),
  t_c5_rive_1: sprite(shore(1), WHITE),
  t_c5_rive_2: sprite(shore(4), WHITE),
  t_c5_givre_1: sprite(frost(1), WHITE),
  t_c5_givre_2: sprite(frost(2), WHITE),
  t_c5_verre_top_1: sprite(glassTop(0), WHITE),
  t_c5_verre_top_2: sprite(glassTop(5), WHITE),
  t_c5_vitre: sprite(pane(false, 0), WHITE),
  t_c5_vitre_base: sprite(pane(true, 0), WHITE),
  t_c5_lino_1: sprite(lino(1), WHITE),
  t_c5_lino_2: sprite(lino(2), WHITE),
  t_c5_ouate_1: sprite(cottonFloor(1), COTTON),
  t_c5_ouate_2: sprite(cottonFloor(2), COTTON),
  t_c5_fil_h: thread('h'),
  t_c5_fil_v: thread('v'),
  t_c5_fil_ne: thread('ne'),
  t_c5_fil_nw: thread('nw'),
  t_c5_fil_se: thread('se'),
  t_c5_fil_sw: thread('sw'),
  t_c5_fil_x: thread('x'),
  t_c5_fil_bout: thread('end'),

  // --- Characters and poses
  npc_mina_avant_1: sprite(digging(true), ALL),
  npc_mina_avant_2: sprite(digging(false), ALL),
  pose_c5_mina_dort: sprite(MINA_ASLEEP, ALL),
  npc_c5_dodo: DODO,
  npc_c5_dodo_2: DODO_2,
  npc_c5_silhouette: sprite(silhouette(0), WHITE),
  npc_c5_silhouette_2: sprite(silhouette(1), WHITE),
  c5_dodo_geant: giantDodo(0),
  c5_dodo_geant_1: giantDodo(1),
  c5_dodo_geant_2: giantDodo(2),

  // --- Props: the beach
  prop_c5_parasol: sprite(parasol(false), BEACH),
  prop_c5_parasol_2: sprite(parasol(true), BEACH),
  prop_c5_serviette: TOWEL,
  prop_c5_drap: SHEET,
  prop_c5_chateau_1: sprite(castle(1), BEACH),
  prop_c5_chateau_2: sprite(castle(2), BEACH),
  prop_c5_chateau_3: sprite(castle(3), BEACH),
  prop_c5_seau: BUCKET,
  prop_c5_tongs: FLIPFLOPS,
  prop_c5_transat: DECKCHAIR,
  prop_c5_creme: SUNSCREEN,
  prop_c5_glaciere: COOLER,
  prop_c5_ballon: BALL,
  prop_c5_traces_g: sprite(STEPS_BIG, BEACH),
  prop_c5_traces_p: sprite(STEPS_SMALL, BEACH),
  prop_c5_traces_fin: sprite(STEPS_END, BEACH),
  prop_c5_ecrit: sprite(SAND_WRITING, BEACH),
  prop_c5_famille: sprite(ERASED_FAMILY, ALL),
  prop_c5_efface: sprite(ERASED_ONE, ALL),
  prop_c5_poste: LIFEGUARD,
  prop_c5_panneau: sprite(SIGN, BEACH),
  prop_c5_kiosque: KIOSK,
  prop_c5_coquillages_1: SHELLS[0]!,
  prop_c5_coquillages_2: SHELLS[1]!,
  prop_c5_coquillages_3: SHELLS[2]!,
  prop_c5_eclat: GLINT,
  prop_c5_eclat_2: GLINT_OFF,
  prop_c5_flaque: sprite(tidePool(0), BEACH),
  prop_c5_flaque_2: sprite(tidePool(1), BEACH),
  c5_soleil: SUN,
  c5_voile: VEIL,
  prop_c5_portail: sprite(portal('q'), ALL),
  prop_c5_portail_2: sprite(portal('off'), ALL),
  prop_c5_portail_ok: sprite(portal('ok'), ALL),
  prop_c5_portail_fievre: sprite(portal('fievre'), ALL),
  prop_c5_fil_noeud: THREAD_END,
  prop_c5_couronne_glace: sprite(UNDER_ICE_CROWN, WHITE),

  // --- Props: the airlock
  prop_c5_porte_rouge: sprite(airlockDoor('rouge'), WHITE),
  prop_c5_porte_verte: sprite(airlockDoor('verte'), WHITE),
  prop_c5_porte_ouverte: sprite(airlockDoor('ouverte'), WHITE),
  prop_c5_porte_morte: sprite(airlockDoor('morte'), WHITE),
  prop_c5_avis: sprite(NOTICE, WHITE),
  prop_c5_interphone: sprite(INTERCOM, WHITE),
  prop_c5_gel_mural: sprite(SANITIZER, WHITE),
  prop_c5_masques: sprite(MASK_BOX, WHITE),
  prop_c5_poubelle: sprite(BIN, WHITE),
  prop_c5_affiche_sourire: sprite(SMILE_POSTER, WHITE),
  prop_c5_chariot: sprite(SHEET_TROLLEY, WHITE),
  prop_c5_radiateur: sprite(RADIATOR, WHITE),
  prop_c5_affiche_crepe: sprite(CREPE_POSTER, WHITE),
  prop_c5_chaises: sprite(CHAIRS, WHITE),
  prop_c5_guichet: sprite(RECEPTION, WHITE),
  prop_c5_aquarium: sprite(AQUARIUM, WHITE),
  prop_c5_jouets: sprite(TOYBOX, WHITE),
  prop_c5_fontaine: sprite(FOUNTAIN, WHITE),
  prop_c5_blouses: sprite(GOWNS, WHITE),
  prop_c5_miroir: sprite(MIRROR, WHITE),
  prop_c5_lavabo: sprite(SINK, WHITE),
  prop_c5_banc: sprite(BENCH, WHITE),
  prop_c5_thermo_mural: sprite(WALL_THERMO, WHITE),

  // --- Props: the lake
  prop_c5_dessin_maman: drawing('maman', false),
  prop_c5_dessin_nadia: drawing('nadia', false),
  prop_c5_dessin_mina: drawing('mina', false),
  prop_c5_dessin_chaise: drawing('chaise', false),
  prop_c5_dessin_plage: drawing('plage', false),
  prop_c5_dessin_maman_corrige: drawing('maman', true),
  prop_c5_dessin_nadia_corrige: drawing('nadia', true),
  prop_c5_dessin_mina_corrige: drawing('mina', true),
  prop_c5_dessin_chaise_corrige: drawing('chaise', true),
  prop_c5_dessin_plage_corrige: drawing('plage', true),
  prop_c5_cabane: sprite(HUT, WHITE),
  prop_c5_fauteuil: ARMCHAIR,
  prop_c5_distributeur: sprite(VENDING, WHITE),
  prop_c5_gobelets: sprite(CUPS, WHITE),
  prop_c5_cafe: sprite(COFFEE, WHITE),
  prop_c5_grille: sprite(VENT, WHITE),
  prop_c5_semaine: sprite(WEEK_SHEET, WHITE),
  c5_cible: sprite(TARGET, WHITE),
  c5_flocon: sprite(FLAKE, WHITE),

  prop_c5_maree_rond: sprite(WHITE_ROUND, ALL),
  prop_c5_maree_ecrit: sprite(WHITE_SMEAR, ALL),
  prop_c5_porte_verre: sprite(glassDoor(false), WHITE),
  prop_c5_porte_verre_ouverte: sprite(glassDoor(true), WHITE),
  prop_c5_plaque_304: sprite(PLATE_304, WHITE),
  prop_c5_perfusions: sprite(FROZEN_DRIPS, WHITE),
  prop_c5_fauteuil_roulant: sprite(WHEELCHAIR, WHITE),
  prop_c5_bonhomme: sprite(SNOWMAN, WHITE),
  prop_c5_bottes: sprite(BOOT_PRINTS, WHITE),
  prop_c5_trou: sprite(ICE_HOLE, WHITE),
  prop_c5_affiche_planning: sprite(PLANNING, WHITE),
  prop_c5_tel_mural: sprite(FAMILY_PHONE, WHITE),
  prop_c5_manteau: COAT_CHAIR,
  prop_c5_dodo_oreiller: DODO_PILLOW,
  prop_c5_dessins_vitre: sprite(GLASS_DRAWINGS, WHITE),

  // --- Props: the glass room
  prop_c5_lit: sprite(BED, WHITE),
  prop_c5_table_dessin: sprite(DRAW_TABLE, WHITE),
  prop_c5_empreinte: sprite(HANDPRINT, { ...WHITE, k: '#8f9ab8' }),
  prop_c5_perfusion: sprite(DRIP, WHITE),
});

export const VARIANTS: string[] = [];

import type { CharDef, SpriteDef } from '../../game/assets';
import { CHARS as BASE_CHARS } from './characters';
import { Pix, rows } from './enemies';
import { ART as CH4_ENEMY_ART } from './enemies-ch4';

/*
 * Chapter 4 « La Maison Cousue » — the world (docs/HISTOIRE.md § 3.11, § 4 « Ch. 4 »).
 *
 * Everything is authored in the ordinary palette: the maps' world (`feutre` or `stylo`, src/engine/palette.ts) turns it
 * into warm felt with sewn borders, or into black ballpoint on squared paper. The same tiles therefore draw both
 * layers of the house. One exception: `prop_c4_veilleuse@stylo` is drawn by hand so that, in the ballpoint nights, the
 * nightlight on Noa's bedside table stays the only thing in colour.
 *
 * Tiles (`t_c4_*`, registered in src/data/tiles.ts): felt-and-cardboard dollhouse floors and walls, the cut edge of
 * the floors (the open front of the dollhouse), the squared page of a maths exercise book around it, the sheet sewn
 * over Maman's room, the rectangle blackened so hard that the paper tore (Mina's room, at night), the attic beams
 * with their tally marks.
 * Characters: `mina366` (the felt Mina: button eyes, embroidered smile, felt crown). NPCs and poses: the Poupée-Maman
 * at the table, the Noa-doll, the domestic sheep, thin Dodo, the giant button eye, the mannequins of the attic, the
 * crowns, the toy chest, the shoe box. The horror stays on toys, felt, thread and paper.
 */

/** Local colours: felt skin (the dolls), and its shade. */
const FELT = { '6': '#f2c9b0', '7': '#d49a88' };

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
const over = (base: string, art: string, x = 0, y = 0): string => Pix.of(base).stamp(art, x, y).toString();
const withFelt = (art: string | Pix): SpriteDef => ({ art: String(art), colors: FELT });

// ---------------------------------------------------------------------------------------------------------------------
// Tiles — the dollhouse
// ---------------------------------------------------------------------------------------------------------------------

/** Dollhouse floor: wide pale boards, a nail at each end, a seam every four pixels. */
const floor = (joints: number[], seed: number): string =>
  paint((x, y) => {
    const b = Math.floor(y / 4);
    const r = y % 4;
    const j = joints[b]!;
    if (r === 3) return 'C';
    if (x === j) return 'C';
    if (r === 1 && (x === j + 2 || x === j - 2) && j >= 0) return 'x';
    if (r === 0 && hash(x, b, seed) < 0.12) return 'q';
    if (hash(x >> 1, y, seed + 1) < 0.07) return 'Q';
    return 'c';
  });
const FLOOR_1 = floor([5, 12, 2, 9], 1);
const FLOOR_2 = floor([10, 3, 14, 6], 2);
const FLOOR_3 = over(floor([1, 8, 11, 4], 3), 'w', 6, 9);

/**
 * The ballpoint floor (nights): white paper, the boards drawn with a single ink stroke, a little hatching under each
 * stroke. The paper grid is added by the ballpoint material.
 */
const penFloor = (joints: number[], seed: number): string =>
  paint((x, y) => {
    if (y === 7) return hash(x, y, seed) < 0.12 ? 'w' : 'x';
    if (y === 8 && x % 3 === 0) return 'C';
    const j = y < 7 ? joints[0]! : joints[1]!;
    if (x === j && y !== 0 && hash(x, y, seed + 3) > 0.2) return 'x';
    return 'w';
  });
const PEN_FLOOR_1 = penFloor([5, 12], 71);
const PEN_FLOOR_2 = penFloor([10, 2], 72);

/** Wallpaper of the felt house: small hearts in a cream lattice. */
const heartPaper = (x: number, y: number): string => {
  const cx = x % 8;
  const cy = y % 8;
  const heart = ['P.P', 'PPP', '.P.'];
  const hx = cx - 2;
  const hy = cy - 2;
  if (hx >= 0 && hx < 3 && hy >= 0 && hy < 3 && heart[hy]![hx] === 'P') return (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 'P' : 'p';
  if (cx === 7) return 'Q';
  return 'q';
};
const WALL = paint((x, y) => (y === 0 ? 'Q' : heartPaper(x, y)));
/** Lower half: a wainscot of felt-covered wood, a red chair rail with white stitches, a dark skirting board. */
const WALL_BASE = paint((x, y) => {
  if (y < 5) return heartPaper(x, y + 16);
  if (y === 5) return x % 4 < 2 ? 'w' : 'R';
  if (y === 6) return 'R';
  if (y >= 14) return y === 14 ? 'x' : 'C';
  if (x % 8 === 0) return 'C';
  if (x % 8 === 1) return 'q';
  return y === 13 ? 'Q' : 'c';
});
/** Top of the walls: dark felt-covered cardboard; a cross-stitch here and there. */
const WALL_TOP_1 = paint((x, y) => (hash(x, y, 7) < 0.05 ? 'k' : 'K'));
const WALL_TOP_2 = over(WALL_TOP_1, 'R.R\n.R.\nR.R', 6, 6);
/** A window sewn shut: night-blue felt, a felt moon that never moves, big red cross-stitches across. */
const WINDOW_ART = `
  .xxxxxxxxxxxxx.
  .xCCCCCCCCCCCx.
  .xCnnnnnnnnnCx.
  .xCnnnnyynnnCx.
  .xCnnnyyQnnnCx.
  .xCnnnyQnnnnCx.
  .xCnnnnyynnnCx.
  .xCCCCCCCCCCCx.
  .xCnnnnnnnnnCx.
  .xCnnBnnnnnnCx.
  .xCnnnnnnnBnCx.
  .xCnnnnnnnnnCx.
  .xCCCCCCCCCCCx.
  .xxxxxxxxxxxxx.
`;
const WINDOW = over(WALL, WINDOW_ART, 0, 1);
const SEWN_X = (p: Pix, x: number, y: number, s = 4, c = 'r'): Pix => {
  for (let i = 0; i < s; i++) p.set(x + i, y + i, c).set(x + s - 1 - i, y + i, c);
  return p;
};
const WINDOW_SEWN = (() => {
  const p = Pix.of(WINDOW);
  for (const [x, y] of [[3, 3], [9, 3], [3, 9], [9, 9]] as const) SEWN_X(p, x, y, 4, 'r');
  return p.toString();
})();
/** A felt door, rounded, a big sewing button for a knob. */
const DOOR_TOP = over(
  WALL,
  `
  ................
  ................
  ....xxxxxxxx....
  ...xRRRRRRRRx...
  ..xRrrrrrrrrRx..
  .xRrrRrrrrRrrRx.
  .xRrRwRrrRwRrRx.
  .xRrrRrrrrRrrRx.
  .xRrrrrrrrrrrRx.
  .xRrRRRRRRRRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  `,
);
const DOOR = `
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRRRRRRRRrRx.
  .xRrrrrrrrkkkRx.
  .xRrrrrrrkYyYkx.
  .xRrrrrrrkyYykx.
  .xRrrrrrrkYyYkx.
  .xRrrrrrrrkkkRx.
  .xRrRRRRRRRRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRrrrrrrRrRx.
  .xRrRRRRRRRRrRx.
  .xRRRRRRRRRRRRx.
  .xxxxxxxxxxxxxx.
  CCCCCCCCCCCCCCCC
`;
/** The same door, sewn to its frame from top to bottom (white thread, big crosses over the gap). */
const sewDoor = (art: string): string => {
  const p = Pix.of(art);
  for (let y = 0; y < 14; y += 4) SEWN_X(p, 0, y, 3, 'w').set(1, y + 1, 'W');
  for (let y = 2; y < 14; y += 4) SEWN_X(p, 13, y, 3, 'w').set(14, y + 1, 'W');
  return p.toString();
};
const DOOR_SEWN_TOP = (() => {
  const p = Pix.of(sewDoor(DOOR_TOP));
  // The sewing does not stop at the frame: the knob of light is sewn over too.
  SEWN_X(p, 5, 5, 3, 'w');
  SEWN_X(p, 9, 5, 3, 'w');
  return p.toString();
})();
const DOOR_SEWN = sewDoor(DOOR);

/** Mina's room: pink felt with little yellow stars, a white skirting. */
const minaPaper = (x: number, y: number): string => {
  const cx = x % 8;
  const cy = (y + (Math.floor(x / 8) % 2) * 4) % 8;
  if ((cx === 3 && cy >= 2 && cy <= 4) || (cy === 3 && cx >= 2 && cx <= 4)) return cx === 3 && cy === 3 ? 'w' : 'y';
  if (hash(x, y, 31) < 0.04) return 'w';
  return 'p';
};
const WALL_MINA = paint((x, y) => (y === 0 ? 'P' : minaPaper(x, y)));
const WALL_MINA_BASE = paint((x, y) => {
  if (y < 6) return minaPaper(x, y + 16);
  if (y === 6) return x % 4 < 2 ? 'w' : 'P';
  if (y >= 14) return y === 14 ? 'P' : 'W';
  return x % 6 === 0 ? 'P' : 'w';
});
const WINDOW_MINA = (() => {
  const p = Pix.of(WALL_MINA).stamp(WINDOW_ART, 0, 1);
  // A curtain with hearts, tied back. Nothing sewn here: her window is « parfaite ».
  p.rect(1, 1, 3, 13, 'v').rect(12, 1, 3, 13, 'v').set(2, 7, 'V').set(13, 7, 'V').set(2, 3, 'w').set(13, 10, 'w');
  return p.toString();
})();
const FLOOR_MINA_1 = paint((x, y) => {
  const r = (x + y * 2) % 6;
  if (r === 0 && y % 2 === 0) return 'P';
  if (hash(x, y, 41) < 0.05) return 'w';
  return 'p';
});
const FLOOR_MINA_2 = over(FLOOR_MINA_1, '.y.\nywy\n.y.', 9, 4);

/** Kitchen: a felt checkerboard (cream and blue), each square padded. */
const TILE_1 = paint((x, y) => {
  const odd = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 1;
  const ex = x % 8 === 7 || y % 8 === 7;
  if (odd) return ex ? 'B' : 'b';
  return ex ? 'Q' : 'q';
});
const TILE_2 = over(TILE_1, 'g.\n.g', 3, 11);

/** The cut edge of a floor (the open front of the dollhouse): felt hem, corrugated cardboard, a shadow below. */
const edge = (seed: number): string =>
  paint((x, y) => {
    if (y === 0) return 'r';
    if (y === 1) return x % 4 < 2 ? 'w' : 'r';
    if (y === 2) return 'R';
    if (y === 3 || y === 11) return 'C';
    if (y >= 4 && y <= 10) {
      const wave = Math.round(7 + Math.sin(((x + seed) / 4) * Math.PI) * 2.6);
      return Math.abs(y - wave) < 1 ? 'Q' : y > wave ? 'x' : 'C';
    }
    if (y === 12) return 'x';
    return y === 13 ? 'K' : 'k';
  });
const EDGE_1 = edge(0);
const EDGE_2 = over(edge(2), 'k', 9, 6);

/** Page of a maths exercise book: squared paper (5 mm = 8 px), pencil marks on some squares. */
const pagePaper = (x: number, y: number): string => (x % 8 === 0 || y % 8 === 0 ? 'b' : 'w');
const PAGE_1 = paint(pagePaper);
const PAGE_2 = over(PAGE_1, 'n.n\n.n.\nn.n', 3, 3);
const PAGE_3 = over(PAGE_1, 'nnn\n...\nnnn', 10, 11);
const PAGE_4 = over(PAGE_1, '.n.\nnnn\n.n.', 11, 2);
/** The red margin line of the page. */
const PAGE_MARGIN = paint((x, y) => (x === 11 || x === 12 ? 'r' : pagePaper(x, y)));

/** Maman's room, in felt: a sheet sewn over the whole room, from the outside. Big red crosses, a fold. */
const SHEET_1 = paint((x, y) => {
  const fold = (x + y) % 16 === 0 || (x + y) % 16 === 1;
  const cx = x % 8;
  const cy = y % 8;
  if ((cx === cy || cx === 7 - cy) && cx >= 2 && cx <= 5) return 'R';
  if (fold) return 'Q';
  return hash(x, y, 51) < 0.06 ? 'c' : 'q';
});
const SHEET_2 = over(SHEET_1, 'r\nr\nr\nr', 13, 9);

/** Mina's room, at night (ballpoint): blackened so hard that the paper tore. */
const noir = (seed: number, tear: boolean): string => {
  const p = Pix.of(paint((x, y) => ((x * 3 + y * 5 + Math.floor(hash(x, y, seed) * 3)) % 7 === 0 ? 'K' : 'i')));
  if (tear) {
    // A tear: curled white paper edges around a hole onto nothing.
    p.ellipse(8 + (seed % 3), 8, 4.5, 3.2, 'w').ellipse(8 + (seed % 3), 8.5, 3.4, 2.2, '0');
    p.set(4 + (seed % 3), 6, 'W').set(12 + (seed % 3), 10, 'W').set(7, 5, 'g');
  }
  return p.toString();
};
const NOIR_1 = noir(61, false);
const NOIR_2 = noir(62, true);
const NOIR_3 = noir(63, false);

/** Maman's room, at night: not drawn at all. A pencil construction line, dotted, that stops. */
const BLANK_1 = paint((x, y) => (y === 5 && x % 3 === 0 ? 'G' : pagePaper(x, y)));
const BLANK_2 = paint((x, y) => (x === 6 && y % 3 === 0 && y < 9 ? 'G' : pagePaper(x, y)));

/** Attic: the back wall of rough beams, with tally marks scratched in fives. */
const beamWall = (marks: Array<[number, number]>): string => {
  const p = Pix.of(
    paint((x, y) => {
      if (x % 8 === 7) return 'x';
      if (x % 8 === 0) return 'c';
      if (hash(x, y >> 1, 71) < 0.08) return 'x';
      return 'C';
    }),
  );
  for (const [mx, my] of marks) {
    for (let i = 0; i < 4; i++) p.rect(mx + i * 2, my, 1, 5, 'q');
    p.line(mx - 1, my + 4, mx + 7, my, 'Q');
  }
  return p.toString();
};
const BEAM_1 = beamWall([[1, 2]]);
const BEAM_2 = beamWall([[6, 8], [1, 1]]);
const BEAM_3 = beamWall([]);
const BEAM_BASE = paint((x, y) => {
  if (y >= 13) return y === 13 ? 'x' : 'K';
  if (x % 8 === 7) return 'x';
  return y % 5 === 0 && x % 3 === 0 ? 'q' : 'C';
});
const ATTIC_FLOOR_1 = paint((x, y) => {
  const b = Math.floor(x / 4);
  if (x % 4 === 3) return 'x';
  if ((y + b * 5) % 16 === 0) return 'x';
  if (hash(x, y, 81 + b) < 0.06) return 'Q';
  return b % 2 ? 'C' : 'c';
});
const ATTIC_FLOOR_2 = over(ATTIC_FLOOR_1, 'r.\n.r\nr.', 9, 6);

// ---------------------------------------------------------------------------------------------------------------------
// Characters — Mina n°366, the felt Mina
// ---------------------------------------------------------------------------------------------------------------------

/** Rewrites the given rows of a frame (row index → new row). */
const patchRows = (art: string, edits: Record<number, (row: string) => string>): string =>
  rows(art)
    .map((r, i) => (edits[i] ? edits[i](r) : r))
    .join('\n');
const setAt = (row: string, map: Record<number, string>): string => [...row].map((c, i) => map[i] ?? c).join('');

/** The felt Mina: skin of felt, a felt crown sewn on, button eyes (no glint), a smile embroidered in red. */
function feltMina(frame: string, dir: 'down' | 'up' | 'left'): string {
  const r = rows(frame);
  // The face rows of Mina's frames (stand and steps keep the head at the same place relative to the crown row).
  const crown = r.findIndex((l) => l.includes('kyky'));
  let art = frame;
  if (dir === 'down') {
    art = patchRows(art, {
      [crown + 7]: (l) => setAt(l, { 5: 'K', 10: 'K' }),
      [crown + 8]: (l) => setAt(l, { 5: 'K', 10: 'K' }),
      [crown + 9]: (l) => setAt(l, { 6: 'R', 7: 's', 8: 's', 9: 'R' }),
      [crown + 10]: (l) => setAt(l, { 7: 'R', 8: 'R' }),
    });
  } else if (dir === 'left') {
    art = patchRows(art, {
      [crown + 7]: (l) => setAt(l, { 4: 'K' }),
      [crown + 8]: (l) => setAt(l, { 4: 'K' }),
      [crown + 9]: (l) => setAt(l, { 3: 'R', 4: 'p' }),
    });
  }
  // Felt crown (orange felt instead of gold paper), felt skin.
  return rows(art)
    .map((l) => l.replace(/y/g, 'o').replace(/Y/g, 'O').replace(/s/g, '6').replace(/S/g, '7'))
    .join('\n');
}
const MINA = BASE_CHARS.mina!;
const MINA366: CharDef = {
  down: MINA.down.map((f) => feltMina(f, 'down')),
  up: MINA.up.map((f) => feltMina(f, 'up')),
  left: MINA.left.map((f) => feltMina(f, 'left')),
  opts: { colors: FELT },
};
const MINA366_STAND = MINA366.down[0]!;

/** Mina n°366 « gone to bed »: a doll on a chair, head tipped to one side, arms down, the smile thread loose. */
const MINA366_CHAIR = (() => {
  const p = new Pix(16, 24);
  // The chair (behind her).
  p.rect(2, 8, 12, 2, 'C').rect(2, 8, 1, 14, 'x').rect(13, 8, 1, 14, 'x').rect(2, 17, 12, 2, 'c').rect(2, 19, 12, 1, 'C');
  p.rect(3, 20, 1, 4, 'x').rect(12, 20, 1, 4, 'x');
  const doll = Pix.of(MINA366_STAND);
  // Head and body, one pixel lower and the head tipped right.
  const head = new Pix(16, 14);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) head.set(x, y, doll.get(x, y + 3));
  const body = new Pix(16, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) body.set(x, y, doll.get(x, y + 14));
  p.blit(body, 0, 13);
  p.blit(head, 1, 1);
  // Legs stick out straight on the seat, feet dangling.
  p.rect(5, 19, 2, 3, '6').rect(9, 19, 2, 3, '6').rect(4, 22, 3, 1, 'x').rect(9, 22, 3, 1, 'x');
  // The thread of her smile came loose and hangs.
  p.set(10, 13, 'r').set(10, 14, 'r').set(11, 15, 'r');
  return p.toString();
})();

/** Mina n°366 unravelling, stitch by stitch, from the feet up, into one long red thread (no tearing). */
function unravel(step: number): string {
  const p = Pix.of(MINA366_STAND);
  const gone = Math.min(24, step * 5);
  for (let y = 24 - gone; y < 24; y++) for (let x = 0; x < 16; x++) p.set(x, y, '.');
  // The loose edge: a row of red stitches where she stops.
  if (gone < 22) for (let x = 2; x < 14; x++) if (p.solid(x, 23 - gone)) p.set(x, 23 - gone, x % 2 ? 'r' : 'R');
  // The thread pooling on the floor.
  for (let i = 0; i < step * 3; i++) p.set(3 + ((i * 5) % 11), 23 - ((i * 3) % 3), i % 2 ? 'r' : 'R');
  return p.toString();
}

/** The felt crown, fallen on the floor. */
const CROWN_FELT = `
  .k.k.k.
  kokokok
  kooooOk
  kOOOOOk
  .kkkkk.
`;
/** One paper crown (the attic pile is made of them). */
const CROWN_PAPER = `
  .k.k.k.
  kykykyk
  kyyyyYk
  kYYYYYk
  .kkkkk.
`;
/** The long red thread left on the floor. */
const THREAD = (() => {
  const p = new Pix(30, 7);
  for (let x = 0; x < 30; x++) p.set(x, 3 + Math.round(Math.sin(x * 0.7) * 2), x % 5 === 0 ? 'R' : 'r');
  for (let a = 0; a < 6; a++) p.set(22 + Math.round(Math.cos(a) * 3), 3 + Math.round(Math.sin(a) * 2), 'r');
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// The dolls: the Poupée-Maman at the table, the Noa-doll (from Noa's and Maman's own frames)
// ---------------------------------------------------------------------------------------------------------------------

const toFelt = (art: string): string =>
  rows(art)
    .map((l) => l.replace(/s/g, '6').replace(/S/g, '7').replace(/t/g, '7'))
    .join('\n');

/** The Poupée-Maman: button eyes, a smile sewn wide, a telephone sewn into her hand. `serving`: the ladle up. */
function poupeeMaman(serving: boolean): string {
  const art = patchRows(BASE_CHARS.maman!.down[0]!, {
    9: (l) => setAt(l, { 4: 'K', 5: 'K', 11: 'K', 12: 'K' }),
    10: (l) => setAt(l, { 3: 'R', 12: 'R' }),
    11: (l) => setAt(l, { 4: 'R', 5: 'w', 6: 'R', 7: 'w', 8: 'R', 9: 'w', 10: 'R', 11: 'R' }),
  });
  const p = Pix.of(toFelt(art));
  // The phone, sewn into her right hand (screen dark, red stitches over the wrist).
  p.rect(12, 18, 3, 5, 'd').set(13, 19, 'b').set(12, 21, 'R').set(14, 21, 'R').set(13, 22, 'R');
  if (serving) p.rect(0, 14, 3, 1, 'g').rect(0, 12, 2, 2, 'W').set(2, 15, 'g');
  else p.rect(1, 20, 2, 3, 'g').set(1, 23, 'W');
  return p.toString();
}

/** The Noa-doll: Noa's own frame in felt, button eyes, the mouth sewn shut with a straight line of stitches. */
function noaDoll(frame: string, face: boolean): string {
  const art = face
    ? patchRows(frame, {
        10: (l) => setAt(l, { 4: 'K', 5: 'K', 10: 'K', 11: 'K' }),
        11: (l) => setAt(l, { 4: 'K', 5: 'K', 10: 'K', 11: 'K' }),
        12: (l) => setAt(l, { 6: 'R', 7: 'w', 8: 'R', 9: 'w', 10: 'R' }),
      })
    : frame;
  return toFelt(art);
}
const NOA_DOLL = noaDoll(BASE_CHARS.noa!.down[0]!, true);
const NOA_DOLL_BACK = noaDoll(BASE_CHARS.noa!.up[0]!, false);
const NOA_DOLL_SIDE = noaDoll(BASE_CHARS.noa!.left[0]!, false);
/** Eating: head bowed, a fork in the hand. */
const NOA_DOLL_EAT = (() => {
  const p = Pix.of(NOA_DOLL);
  p.move(0, 0, 16, 13, 0, 1);
  p.set(13, 18, 'g').set(13, 17, 'g').set(12, 16, 'W').set(14, 16, 'W');
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// Domestic sheep, thin Dodo, the giant eye
// ---------------------------------------------------------------------------------------------------------------------

const WOOL = { '6': '#fffaf2', '7': '#ece2df', '8': '#b7aab8' };
/** A domestic sheep: Mina's sheep in a little apron, button eyes (flat, no glint), holding a broom or a tray. */
function domesticSheep(tool: 'balai' | 'plateau' | 'fer', f: number): string {
  const p = Pix.of(
    patchRows(BASE_CHARS.mouton!.down[0]!, {
      11: (l) => setAt(l, { 5: 'K', 10: 'K' }),
    }),
  );
  // Apron: white with a red hem and a pocket.
  p.rect(4, 15, 8, 5, 'W').rect(4, 19, 8, 1, 'r').rect(6, 16, 3, 2, 'w').set(4, 14, 'r').set(11, 14, 'r');
  if (tool === 'balai') {
    p.rect(13, 8 + f, 1, 13, 'C').rect(12, 21 + f, 3, 2, 'Y').set(12, 23, 'O').set(14, 23, 'O');
  } else if (tool === 'plateau') {
    p.rect(9, 13 + f, 7, 1, 'g').rect(10, 12 + f, 2, 1, 'w').rect(13, 11 + f, 2, 2, 'p');
  } else {
    p.rect(11, 18 + f, 5, 2, 'g').set(15, 18 + f, 'G').rect(12, 17 + f, 2, 1, 'd');
  }
  return p.toString();
}

/** A domestic sheep asleep in the toy chest: curled up, button eyes closed with a stitch. */
const SHEEP_ASLEEP = `
  ...kkkkkkk...
  ..k6666667k..
  .k666766677k.
  k66666666677k
  k6kdddd66678k
  k6kdRdRd6678k
  k6kdpddd6778k
  .k6kkkk67788k
  ..kk7777888k.
  ....kkkkkk...
`;
/** The same sheep, emptied: a flat skin, two holes where the buttons were. */
const SHEEP_EMPTY = `
  .............
  .............
  .............
  ......kkk....
  ..kkkk777kk..
  .k7d.d7778k..
  k7778777888k.
  k88778888888k
  .kkkkkkkkkkk.
  .............
`;
const BUTTON = `
  .kk.
  kgdk
  kdgk
  .kk.
`;

/** Dodo, thin: a sagging plush, one seam open on the side, cotton coming out of it. */
const DODO_THIN = `
  ..........kk.kk.
  ....kk.kk.kpPpk.
  ...kwwkwwkwkPkk.
  ...kwwwwwwwwk...
  ..kwwwwwwwwWWk..
  .kpkGGGGGGwWkpk.
  .kpkggggggGkpk..
  ..kwgkggkgGWk...
  ..kwgkggkgGWk...
  ..kwgpggggpGk...
  ...kwGgGGgGWk...
  ...kwwGGGGWfwk..
  ...kWwwwwWWkwfk.
  ....kWwwwWgk.w..
  .....kkkkkk.....
  ................
`;
const DODO_THIN_2 = (() => {
  const p = Pix.of(DODO_THIN).move(0, 0, 16, 14, 0, 1);
  p.set(13, 14, 'w').set(12, 15, 'w');
  return p.toString();
})();

/** The giant button eye, rising over the open front of the house: a felt eyelid, a button for a pupil. */
const EYE = (() => {
  const p = new Pix(96, 40);
  p.ellipse(48, 40, 46, 34, 'q');
  p.ellipse(48, 42, 40, 28, 'w');
  // The button pupil: a huge sewing button, four holes, a red thread crossing them.
  p.ellipse(48, 30, 15, 15, 'd').ellipse(48, 30, 13, 13, 'K').ellipse(46, 27, 9, 9, 'd');
  for (const [hx, hy] of [[43, 25], [53, 25], [43, 35], [53, 35]] as const) p.rect(hx - 1, hy - 1, 3, 3, 'k');
  p.line(43, 25, 53, 35, 'r').line(53, 25, 43, 35, 'r');
  // The eyelid: felt, stitched along its edge, lashes of thread.
  for (let x = 2; x < 94; x++) {
    const y = Math.round(40 - Math.sqrt(Math.max(0, 1 - ((x - 48) / 46) ** 2)) * 34);
    p.set(x, y, 'C').set(x, y + 1, x % 4 < 2 ? 'R' : 'C');
    if (x % 9 === 4) p.line(x, y, x - 2 + Math.round((x - 48) / 12), y - 5, 'k');
  }
  return p.toString();
})();
/** The eye half closed (it blinks). */
const EYE_2 = (() => {
  const p = Pix.of(EYE);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 96; x++) if (p.solid(x, y)) p.set(x, y, y === 23 ? 'R' : 'C');
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// Props — the house
// ---------------------------------------------------------------------------------------------------------------------

/** A simple piece of furniture seen from the top-left: top surface, front face, contour. */
function furniture(w: number, h: number, depth: number, top: string, front: string, shade: string): Pix {
  const p = new Pix(w, h);
  p.rect(1, 1, w - 2, h - 2, front).rect(1, 1, w - 2, depth, top);
  p.rect(1, depth + 1, w - 2, 1, shade).rect(w - 2, depth + 1, 1, h - depth - 2, shade);
  for (let x = 1; x < w - 1; x++) p.set(x, 0, 'k').set(x, h - 1, 'k');
  for (let y = 1; y < h - 1; y++) p.set(0, y, 'k').set(w - 1, y, 'k');
  return p;
}

/** The table set for four: a gingham cloth, four places. `grey` = how grey the pasta has become (0–2). */
function table4(grey: number): string {
  const p = new Pix(40, 26).blit(furniture(40, 21, 15, 'w', 'r', 'R'));
  // Gingham.
  for (let y = 1; y < 16; y++) for (let x = 1; x < 39; x++) if ((Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0) p.set(x, y, 'p');
  for (let x = 1; x < 39; x++) if (x % 3 === 0) p.set(x, 17, 'w');
  // Legs.
  for (const lx of [3, 35]) p.rect(lx, 21, 2, 5, 'x').rect(lx - 1, 21, 1, 5, 'k').rect(lx + 2, 21, 1, 5, 'k').rect(lx, 25, 2, 1, 'k');
  // Noa's plate (front left): pasta, greyer each loop.
  const pasta = ['y', 'Q', 'g'][grey]!;
  const dark = ['Y', 'c', 'G'][grey]!;
  p.ellipse(9, 11, 5, 3, 'W').ellipse(9, 11, 4, 2, 'w').ellipse(9, 10.5, 3, 1.6, pasta);
  p.set(8, 10, dark).set(10, 11, dark).set(7, 11, dark);
  if (grey === 2) p.set(9, 10, 'A').set(11, 10, 'a');
  p.set(14, 9, 'g').set(14, 10, 'g').set(14, 11, 'g').set(14, 12, 'G');
  // Maman's plate (back left): food drawn in crayon on the plate itself.
  p.ellipse(9, 4.5, 5, 3, 'W').ellipse(9, 4.5, 4, 2, 'w');
  p.set(7, 4, 'L').set(8, 3, 'L').set(9, 4, 'e').set(10, 5, 'o').set(11, 4, 'o');
  // Mina's place (back right): a hospital tray, three compartments, nothing in them.
  p.rect(25, 2, 11, 6, 'g').rect(26, 3, 4, 4, 'W').rect(31, 3, 4, 2, 'W').rect(31, 6, 4, 1, 'W');
  // The fourth place (front right): an empty plate. Nobody's.
  p.ellipse(31, 11, 5, 3, 'W').ellipse(31, 11, 4, 2, 'w');
  // A tuft of cotton, as a dish in the middle.
  p.ellipse(20, 8, 3, 2, 'w').set(19, 7, 'W').set(21, 9, 'g');
  return p.toString();
}

/** A wooden kitchen chair seen from behind, turned to face the wall. */
const CHAIR_BACK = `
  .kkkkkkkkkk.
  .kccCCccCck.
  .kCkkkkkkCk.
  .kck.kk.kck.
  .kCkkkkkkCk.
  .kccccccccck
  kcQQQQQQQQck
  kCCCCCCCCCCk
  kxkkkkkkkkxk
  kxk......kxk
  kxk......kxk
  kkk......kkk
`;

/** The cuckoo clock: a sheep's head instead of a bird, the pendulum is a button on a thread. */
function clock(f: number): string {
  const p = new Pix(16, 28);
  p.poly([[1, 6], [8, 0], [15, 6]], 'R').poly([[3, 6], [8, 2], [13, 6]], 'r');
  p.rect(2, 6, 12, 12, 'c').rect(2, 6, 12, 1, 'q').rect(13, 7, 1, 11, 'C');
  p.ellipse(8, 12, 4.5, 4.5, 'w').ellipse(8, 12, 3.5, 3.5, 'q');
  p.set(8, 9, 'k').set(8, 10, 'k').set(8, 11, 'k').set(9, 12, 'k').set(10, 13, 'k');
  // The little door of the cuckoo, a sheep head peeking.
  p.rect(6, 3, 4, 3, 'x').rect(7, 4, 2, 2, 'w').set(7, 4, 'K');
  // Pendulum.
  const sw = f ? 2 : -2;
  p.line(8, 18, 8 + sw, 24, 'g');
  p.ellipse(8 + sw, 25, 2, 2, 'Y').set(8 + sw, 25, 'k');
  p.rect(3, 18, 1, 3, 'x').rect(12, 18, 1, 3, 'x');
  return p.contour('k').toString();
}

/** The wall phone (a cream handset on its cradle, a curly cord). `_2`: ringing, the handset jumping. */
function wallPhone(ring: boolean): string {
  const p = new Pix(12, 22);
  p.rect(2, 2, 8, 14, 'q').rect(2, 2, 8, 1, 'w').rect(9, 3, 1, 13, 'Q');
  p.rect(4, 7, 4, 4, 'Q');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) p.set(4 + i + (i > 0 ? 0 : 0), 7 + j, (i + j) % 2 ? 'g' : 'W');
  const dy = ring ? -2 : 0;
  p.rect(1, 1 + dy, 10, 3, 'c').rect(1, 1 + dy, 10, 1, 'q').rect(0, 0 + dy, 3, 4, 'c').rect(9, 0 + dy, 3, 4, 'c');
  for (let y = 16; y < 22; y++) p.set(6 + (y % 2), y, 'g');
  if (ring) p.set(0, 6, 'y').set(11, 5, 'y').set(1, 8, 'y');
  return p.contour('k').toString();
}

/** The fridge, covered in notes held by magnets. `n` = how many notes (the nights pile them up). */
function fridge(n: number): string {
  const p = furniture(16, 30, 3, 'W', 'w', 'g');
  p.rect(1, 13, 14, 1, 'g').rect(12, 6, 1, 5, 'G').rect(12, 16, 1, 6, 'G');
  const spots: Array<[number, number, string]> = [
    [2, 5, 'y'],
    [7, 7, 'p'],
    [3, 16, 'y'],
    [8, 18, 'b'],
    [2, 22, 'y'],
    [7, 24, 'y'],
    [4, 10, 'l'],
    [9, 13, 'y'],
    [2, 26, 'p'],
    [6, 1, 'y'],
  ];
  spots.slice(0, n).forEach(([x, y, c], i) => {
    p.rect(x, y, 4, 3, c).set(x + 1, y + 1, 'G').set(x + 2, y + 1, 'G');
    p.set(x + 1, y - 1, ['r', 'B', 'L', 'P'][i % 4]!);
  });
  return p.toString();
}

/** A stack of dirty plates on the counter: higher every night. */
function plates(n: number): string {
  const h = 4 + n * 2;
  const p = new Pix(14, h + 2);
  for (let i = 0; i < n + 1; i++) {
    const y = h - i * 2;
    p.rect(1, y - 1, 12, 2, 'W').rect(1, y - 1, 12, 1, 'w').set(0, y, 'k').set(13, y, 'k');
    if (i % 2) p.set(4 + i, y - 1, 'y').set(9 - i, y - 1, 'Q');
  }
  p.rect(1, h + 1, 12, 1, 'k');
  return p.toString();
}

/** One plate of cold pasta (the Noa-doll's dinner), on its own. */
const PLATE = `
  .kkkkkk.
  kWyYyQWk
  kwyQyyWk
  .kkkkkk.
`;

/** Noa's shoe box: the fridge notes, kept and smoothed flat. */
const SHOEBOX = (() => {
  const p = furniture(16, 12, 5, 'b', 'B', 'n');
  p.rect(2, 2, 12, 3, 'w').rect(3, 2, 4, 2, 'y').rect(8, 3, 4, 2, 'y').rect(5, 1, 4, 2, 'p');
  p.set(4, 3, 'G').set(9, 4, 'G').set(6, 2, 'G');
  return p.toString();
})();

/** The toy chest, open; felt sheep asleep inside. */
const CHEST = (() => {
  const p = furniture(32, 20, 7, 'K', 'p', 'P');
  // Lid, open against the wall.
  p.rect(1, 1, 30, 2, 'P').rect(1, 0, 30, 1, 'k');
  p.rect(2, 3, 28, 5, 'K');
  // Front: painted stars and a heart.
  p.set(6, 12, 'y').set(5, 13, 'y').set(7, 13, 'y').set(6, 14, 'y').set(16, 12, 'w').set(15, 13, 'w').set(17, 13, 'w');
  p.set(24, 13, 'r').set(26, 13, 'r').rect(24, 14, 3, 1, 'r').set(25, 15, 'r');
  return p.toString();
})();

/** The real nightlight, on the bedside table. Hand-drawn for the ballpoint nights: the only colour left. */
const NIGHTLIGHT = `
  ..kkkk..
  .kyyfyk.
  kyyyykk.
  kyyyk...
  kyyyykk.
  .kyyyyyk
  ..kkkkk.
  .kWWWWk.
  .kggggk.
`;
const NIGHTLIGHT_PEN = rows(NIGHTLIGHT)
  .map((l) => l.replace(/W/g, 'w').replace(/g/g, 'G').replace(/k/g, 'i'))
  .join('\n');

/** A thermometer on the table (night 35). */
const THERMO = `
  kkkkkkkkk.
  kwwwwwwrRk
  kkkkkkkkk.
`;

/** The thread ladder hanging from the attic hatch. */
const LADDER = (() => {
  const p = new Pix(14, 44);
  p.rect(1, 0, 12, 3, 'K').rect(1, 0, 12, 1, 'k').rect(2, 1, 10, 1, 'x');
  for (let y = 3; y < 44; y++) {
    const sway = Math.round(Math.sin(y * 0.18) * 0.8);
    p.set(2 + sway, y, 'r').set(11 + sway, y, 'r');
    if (y % 5 === 2) for (let x = 3; x < 11; x++) p.set(x + sway, y, x % 2 ? 'R' : 'r');
  }
  return p.toString();
})();
/** The hatch, still shut. */
const HATCH = (() => {
  const p = new Pix(14, 6);
  p.rect(0, 0, 14, 6, 'K').rect(1, 1, 12, 4, 'x').rect(2, 2, 10, 1, 'C').set(6, 4, 'Y').set(7, 4, 'Y');
  return p.toString();
})();

/** A small felt staircase (down = going to the ground floor, up = the steps seen from below). */
const STAIRS_DOWN = (() => {
  const p = new Pix(16, 16);
  for (let i = 0; i < 4; i++) p.rect(1, i * 4, 14, 4, i % 2 ? 'C' : 'c').rect(1, i * 4 + 3, 14, 1, 'x').rect(1 + i, i * 4, 1, 4, 'K');
  p.rect(0, 0, 1, 16, 'k').rect(15, 0, 1, 16, 'k');
  return p.toString();
})();
const STAIRS_UP = (() => {
  const p = new Pix(16, 20);
  for (let i = 0; i < 5; i++) {
    const y = 16 - i * 4;
    p.rect(1 + i, y, 14 - i * 2, 4, i % 2 ? 'C' : 'c').rect(1 + i, y, 14 - i * 2, 1, 'q');
  }
  return p.contour('k').toString();
})();

/** A mannequin of the attic: a dress form on a tripod, a felt Mina head, a tailor's label pinned to the chest. */
type Mannequin = 'plain' | 'cape' | 'nomouth' | 'turned' | 'empty';
function mannequin(kind: Mannequin): string {
  const p = new Pix(16, 30);
  // Tripod and pole.
  p.rect(7, 20, 2, 8, 'x').line(7, 27, 3, 29, 'x').line(8, 27, 12, 29, 'x');
  // Dress form torso (felt, pinned).
  p.ellipse(8, 16, 5, 5.5, 'Q').ellipse(7, 15, 3.5, 4, 'q').rect(5, 20, 6, 1, 'C');
  p.set(4, 14, 'g').set(11, 17, 'g').set(6, 19, 'g');
  if (kind === 'empty') {
    p.rect(7, 6, 2, 5, 'x').ellipse(8, 7, 2, 1.5, 'C');
    return p.contour('k').toString();
  }
  // The head: felt, two copper pigtails, a felt crown.
  p.ellipse(8, 7, 5, 5, kind === 'turned' ? 'm' : '6').rect(2, 6, 2, 4, 'm').rect(12, 6, 2, 4, 'm');
  p.rect(4, 2, 8, 2, 'm').ellipse(8, 3, 5, 2, 'm');
  p.rect(5, 0, 6, 2, 'o').set(5, 0, 'O').set(8, 0, 'O').set(10, 0, 'O');
  if (kind !== 'turned') {
    p.set(6, 7, 'K').set(10, 7, 'K');
    if (kind === 'nomouth') p.set(8, 10, '6');
    else p.set(7, 10, 'R').set(8, 10, 'R').set(6, 9, 'R').set(9, 9, 'R');
  } else {
    // Seen from behind: the back of the head, a seam down the middle.
    p.rect(8, 3, 1, 9, 'M');
    for (let y = 4; y < 12; y += 2) p.set(7, y, 'r').set(9, y, 'r');
  }
  // The tailor's label, pinned.
  p.rect(9, 14, 4, 3, 'w').set(9, 14, 'g').set(10, 15, 'G').set(11, 15, 'G');
  if (kind === 'cape') {
    // The red cape and the pencil sword of the chapters 1 to 3.
    p.poly([[3, 12], [13, 12], [15, 24], [1, 24]], 'r').rect(2, 23, 12, 1, 'R').rect(9, 14, 4, 3, 'w');
    p.line(14, 10, 14, 22, 'Y').set(14, 23, 'q').set(14, 24, 'k').set(13, 13, 'O').set(15, 13, 'O');
  }
  return p.contour('k').toString();
}

/** The pile of crowns: three hundred and sixty-four paper crowns, flattened, slipping. */
const CROWNS = (() => {
  const p = new Pix(44, 22);
  const crown = Pix.of(CROWN_PAPER);
  let i = 0;
  for (let row = 0; row < 5; row++) {
    const n = 7 - row;
    for (let c = 0; c < n; c++) {
      const x = 2 + row * 3 + c * 6 + ((i * 7) % 3) - 1;
      const y = 16 - row * 4 + ((i * 5) % 2);
      p.blit(crown, x, y);
      i++;
    }
  }
  return p.toString();
})();

/** A mouth drawn on the wall in crayon, next to the mannequin that has none. */
const MOUTH = `
  R........R
  .R......R.
  ..RRRRRR..
`;

/** The curtain of threads that closes the seamstress's corner. */
const THREADS = (() => {
  const p = new Pix(16, 32);
  for (let x = 1; x < 16; x += 2) for (let y = 0; y < 32; y++) p.set(x + (y % 7 === 0 ? 1 : 0), y, (x + y) % 9 === 0 ? 'R' : 'r');
  for (let y = 4; y < 32; y += 9) for (let x = 0; x < 16; x++) if (x % 3) p.set(x, y, 'R');
  return p.toString();
})();

/** A spool of red thread, almost empty. */
const SPOOL = `
  kkkkkkk
  kcCCCck
  .krrrk.
  .kRrRk.
  .krrrk.
  kcCCCck
  kkkkkkk
`;

/** A torn floor in the knocking corridor: the paper gives way onto nothing. */
const TEAR = (() => {
  // A jagged rip through the paper, a few pixels wide: three of them stacked across the corridor join into one rift
  // (the same width at the top and the bottom row), white torn fibres along both lips.
  const p = new Pix(16, 16);
  const left = [6, 5, 5, 4, 5, 6, 6, 5, 4, 3, 4, 5, 5, 6, 6, 6];
  const right = [10, 10, 11, 11, 10, 10, 11, 12, 12, 11, 10, 10, 11, 11, 10, 10];
  for (let y = 0; y < 16; y++) {
    const l = left[y]!;
    const r = right[y]!;
    p.rect(l, y, r - l + 1, 1, '0');
    p.set(l - 1, y, 'w').set(r + 1, y, 'w');
    if (y % 3 === 1) p.set(l - 2, y, 'g');
    if (y % 4 === 2) p.set(r + 2, y, 'g');
    if (y % 5 === 0) p.set(l, y, 'w');
  }
  return p.toString();
})();

/** The fridge-note on the floor of the dark corridor / the post-it in the hand of the shadow. */
const NOTE = `
  kkkkkk
  kyyyyk
  kyGGyk
  kyyyyk
  kkkkkk
`;

/**
 * The front door sewing itself shut (an overlay on the door and its top, 16×32): white thread, big crosses over the
 * gap, from the top down; `k` = 1…4 quarters done. Until the last quarter, the needle is still in the felt.
 */
function doorStitches(k: number): string {
  const p = new Pix(16, 32);
  const lim = k * 8;
  for (let y = 2; y < 30; y += 4) if (y < lim) SEWN_X(p, 0, y, 3, 'w').set(1, y + 1, 'W');
  for (let y = 4; y < 30; y += 4) if (y < lim) SEWN_X(p, 13, y, 3, 'w').set(14, y + 1, 'W');
  // The knob of light is sewn over too, and a long running stitch closes the gap down the middle.
  if (k >= 2) SEWN_X(p, 5, 5, 3, 'w').set(6, 6, 'W');
  if (k >= 3) SEWN_X(p, 9, 21, 3, 'w');
  for (let y = 3; y < Math.min(lim, 29); y += 3) p.set(7, y, 'w').set(8, y + 1, 'W');
  if (k < 4) {
    // The needle, half in the felt, its thread trailing up to where it came from.
    const ny = Math.min(28, lim + 1);
    p.line(9, ny - 6, 11, ny, 'g').set(9, ny - 6, 'W').set(10, ny - 4, 'W');
    p.line(9, ny - 6, 4, ny - 9, 'w');
  }
  return p.toString();
}

/** Stairs cut through the floor of the dollhouse: pale treads going down, a dark riser under each, wooden sides. */
const STAIRS_TILE = paint((x, y) => {
  if (x === 0 || x === 15) return 'x';
  if (x === 1 || x === 14) return 'C';
  const r = y % 4;
  if (r === 3) return 'x';
  if (r === 2) return 'C';
  if (r === 0 && hash(x, y, 51) < 0.15) return 'q';
  return 'c';
});

/** The shadow of a hand laid flat on a door, fingers up (Night 42). */
const HAND_SHADOW = `
  ...d.d.d....
  ..dd.d.dd...
  ..dd.d.dd...
  ..dddddddd..
  ..dddddddd.d
  ..dddddddddd
  ..ddddddddd.
  ..dddddddd..
  ...dddddd...
  ...dddddd...
  ...dddddd...
`;
const HAND_SHADOW_ART = rows(HAND_SHADOW)
  .map((l) => l.replace(/d/g, 'K'))
  .join('\n');

/** A thin line of yellow light under a door. Drawn in colour even in the ballpoint layer. */
const LIGHT_UNDER_DOOR = `
  .yyyyyyyyyyyy.
  yfffffffffffyy
  .yYyyyyyyyyYy.
`;

/** La Couseuse on the overworld: a little black sewing machine with gold flowers, a sheep's head for a presser foot. */
function couseuseSmall(f: number, broken = false): string {
  const p = new Pix(28, 26);
  // The table (felt top, wooden legs).
  p.rect(1, 17, 26, 3, 'C').rect(1, 17, 26, 1, 'c').rect(1, 19, 26, 1, 'x');
  p.rect(3, 20, 2, 6, 'x').rect(23, 20, 2, 6, 'x');
  // The machine: bed, pillar, arm.
  p.rect(4, 14, 20, 3, 'K').rect(17, 4, 5, 10, 'K').rect(6, 3, 16, 4, 'K');
  p.rect(6, 3, 16, 1, 'd').rect(17, 4, 1, 10, 'd');
  for (const [x, y] of [[9, 4], [12, 5], [15, 4], [19, 7], [20, 10], [18, 11]] as const) p.set(x, y, 'Y');
  // Handwheel.
  p.ellipse(23, 7, 2.5, 2.5, 'g').set(23, 7, f ? 'G' : 'W');
  // Spool, almost empty.
  p.rect(12, 0, 4, 3, 'C').rect(13, 1, 2, 1, 'r');
  // The sheep's head where the presser foot should be: dirty wool, two odd buttons, a mouth sewn in a cross.
  p.ellipse(8, 9, 4, 3.5, 'W').ellipse(7, 8, 3, 2.5, 'w');
  p.set(6, 9, 'K').set(10, 9, 'B').set(8, 11, 'R').set(7, 10, 'R').set(9, 10, 'R').set(7, 12, 'R').set(9, 12, 'R');
  p.set(4, 7, 'g').set(12, 7, 'g');
  // Needle (frame 2: down in the pink felt) or broken, hanging from its thread.
  if (broken) {
    p.rect(8, 13, 1, 1, 'g').line(8, 14, 6, 21, 'r').set(6, 22, 'g').set(5, 23, 'W');
  } else {
    p.rect(13, 7, 1, f ? 8 : 5, 'g').set(13, f ? 15 : 12, 'W');
  }
  p.poly([[10, 15], [20, 15], [21, 17], [11, 17]], 'p');
  for (let x = 12; x < 19; x += 2) p.set(x, 16, 'R');
  return p.contour('k').toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const CHARS: Record<string, CharDef> = {
  mina366: MINA366,
};

export const ART: Record<string, SpriteDef> = {
  // Tiles
  t_c4_floor_1: FLOOR_1,
  t_c4_floor_2: FLOOR_2,
  t_c4_floor_3: FLOOR_3,
  t_c4_floor_pen_1: PEN_FLOOR_1,
  t_c4_floor_pen_2: PEN_FLOOR_2,
  t_c4_wall: WALL,
  t_c4_wall_base: WALL_BASE,
  t_c4_wall_top_1: WALL_TOP_1,
  t_c4_wall_top_2: WALL_TOP_2,
  t_c4_window: WINDOW_SEWN,
  t_c4_door_top: DOOR_TOP,
  t_c4_door: DOOR,
  t_c4_door_sewn_top: DOOR_SEWN_TOP,
  t_c4_door_sewn: DOOR_SEWN,
  t_c4_wall_mina: WALL_MINA,
  t_c4_wall_mina_base: WALL_MINA_BASE,
  t_c4_window_mina: WINDOW_MINA,
  t_c4_floor_mina_1: FLOOR_MINA_1,
  t_c4_floor_mina_2: FLOOR_MINA_2,
  t_c4_tile_1: TILE_1,
  t_c4_tile_2: TILE_2,
  t_c4_edge_1: EDGE_1,
  t_c4_edge_2: EDGE_2,
  t_c4_page_1: PAGE_1,
  t_c4_page_2: PAGE_2,
  t_c4_page_3: PAGE_3,
  t_c4_page_4: PAGE_4,
  t_c4_page_margin: PAGE_MARGIN,
  t_c4_sheet_1: SHEET_1,
  t_c4_sheet_2: SHEET_2,
  t_c4_noir_1: NOIR_1,
  t_c4_noir_2: NOIR_2,
  t_c4_noir_3: NOIR_3,
  t_c4_blank_1: BLANK_1,
  t_c4_blank_2: BLANK_2,
  t_c4_beam_1: BEAM_1,
  t_c4_beam_2: BEAM_2,
  t_c4_beam_3: BEAM_3,
  t_c4_beam_base: BEAM_BASE,
  t_c4_attic_floor_1: ATTIC_FLOOR_1,
  t_c4_attic_floor_2: ATTIC_FLOOR_2,

  // Mina n°366
  pose_mina366_chaise: withFelt(MINA366_CHAIR),
  pose_mina366_defait_1: withFelt(unravel(1)),
  pose_mina366_defait_2: withFelt(unravel(2)),
  pose_mina366_defait_3: withFelt(unravel(3)),
  pose_mina366_defait_4: withFelt(unravel(4)),
  prop_c4_couronne_feutre: CROWN_FELT,
  prop_c4_fil: THREAD,

  // Dolls
  npc_maman_poupee: withFelt(poupeeMaman(false)),
  npc_maman_poupee_2: withFelt(poupeeMaman(true)),
  npc_poupee_noa: withFelt(NOA_DOLL),
  npc_poupee_noa_mange: withFelt(NOA_DOLL_EAT),
  npc_poupee_noa_dos: withFelt(NOA_DOLL_BACK),
  npc_poupee_noa_cote: withFelt(NOA_DOLL_SIDE),

  // Sheep, Dodo, the eye
  npc_c4_mouton_balai: { art: domesticSheep('balai', 0), colors: WOOL },
  npc_c4_mouton_balai_2: { art: domesticSheep('balai', 1), colors: WOOL },
  npc_c4_mouton_plateau: { art: domesticSheep('plateau', 0), colors: WOOL },
  npc_c4_mouton_plateau_2: { art: domesticSheep('plateau', 1), colors: WOOL },
  npc_c4_mouton_fer: { art: domesticSheep('fer', 0), colors: WOOL },
  npc_c4_mouton_fer_2: { art: domesticSheep('fer', 1), colors: WOOL },
  prop_c4_mouton_dort: { art: SHEEP_ASLEEP, colors: WOOL },
  prop_c4_mouton_vide: { art: SHEEP_EMPTY, colors: WOOL },
  prop_c4_bouton: BUTTON,
  npc_dodo_thin: DODO_THIN,
  npc_dodo_thin_2: DODO_THIN_2,
  c4_oeil: EYE,
  c4_oeil_2: EYE_2,

  // House
  prop_c4_table: table4(0),
  prop_c4_table_gris: table4(1),
  prop_c4_table_moisi: table4(2),
  prop_c4_chaise_dos: CHAIR_BACK,
  prop_c4_horloge: clock(0),
  prop_c4_horloge_2: clock(1),
  prop_c4_tel: wallPhone(false),
  prop_c4_tel_2: wallPhone(true),
  prop_c4_frigo_1: fridge(3),
  prop_c4_frigo_2: fridge(5),
  prop_c4_frigo_3: fridge(7),
  prop_c4_frigo_4: fridge(10),
  prop_c4_assiettes_1: plates(1),
  prop_c4_assiettes_2: plates(3),
  prop_c4_assiettes_3: plates(6),
  prop_c4_assiettes_4: plates(9),
  prop_c4_assiette: PLATE,
  prop_c4_boite: SHOEBOX,
  prop_c4_coffre: CHEST,
  prop_c4_veilleuse: NIGHTLIGHT,
  'prop_c4_veilleuse@stylo': NIGHTLIGHT_PEN,
  prop_c4_thermo: THERMO,
  prop_c4_echelle: LADDER,
  prop_c4_trappe: HATCH,
  prop_c4_escalier: STAIRS_DOWN,
  prop_c4_escalier_haut: STAIRS_UP,
  prop_c4_dechirure: TEAR,
  prop_c4_mot: NOTE,

  // Attic
  prop_c4_mannequin: withFelt(mannequin('plain')),
  prop_c4_mannequin_cape: withFelt(mannequin('cape')),
  prop_c4_mannequin_sansbouche: withFelt(mannequin('nomouth')),
  prop_c4_mannequin_tourne: withFelt(mannequin('turned')),
  prop_c4_mannequin_vide: withFelt(mannequin('empty')),
  prop_c4_couronnes: CROWNS,
  prop_c4_couronne: CROWN_PAPER,
  prop_c4_bouche: MOUTH,
  prop_c4_rideau: THREADS,
  prop_c4_bobine: SPOOL,

  // The entrance, the stairs, Night 42, the seamstress on the overworld
  prop_c4_coutures_1: doorStitches(1),
  prop_c4_coutures_2: doorStitches(2),
  prop_c4_coutures_3: doorStitches(3),
  prop_c4_coutures_4: doorStitches(4),
  t_c4_stairs: STAIRS_TILE,
  prop_c4_main: HAND_SHADOW_ART,
  prop_c4_lumiere: LIGHT_UNDER_DOOR,
  // In the ballpoint layer, the light stays the only colour: the light under the door, the fallen nightlight.
  'prop_c4_lumiere@stylo': LIGHT_UNDER_DOOR,
  'b_c4_veilleuse@stylo': CH4_ENEMY_ART.b_c4_veilleuse!,
  'b_c4_veilleuse_fele@stylo': CH4_ENEMY_ART.b_c4_veilleuse_fele!,
  npc_couseuse: couseuseSmall(0),
  npc_couseuse_2: couseuseSmall(1),
  npc_couseuse_cassee: couseuseSmall(0, true),
};

export const VARIANTS: string[] = [];

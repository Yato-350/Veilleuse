import type { SpriteDef } from '../../game/assets';
import { parseRows } from '../../engine/sprite';
import { PAL, mix } from '../../engine/palette';

/*
 * VEILLEUSE — props (objects placed on maps). Keys: `prop_<name>` (+ `_2` animation frames).
 *
 * Conventions
 * - Top-down 3/4 view like OMORI interiors: furniture shows its top surface, then its front face.
 * - Light comes from the top-left: highlight on top/left edges, shade on the right and bottom, one specular dot.
 * - Contour `k` around every object (inner details use softer tones, never `k` noise).
 * - Real-world props are authored in muted mid-tones: the engine builds `@real` (desaturated, bluish) and
 *   `@ink` (corrupted) variants automatically (VARIANTS below) — they are never drawn by hand.
 * - Dream props are soft pastels, forest props look drawn with crayons on paper, hospital props are pale and cold.
 */

// ---------------------------------------------------------------------------
// Toolkit
// ---------------------------------------------------------------------------

type Grid = string[][];
type Patch = [patch: string, x: number, y: number];

const toGrid = (src: string): Grid => parseRows(src).map((r) => [...r]);
const toArt = (g: Grid): string => g.map((r) => r.join('')).join('\n');

/** A tiny pixel canvas working on palette characters ('.' = transparent). Every method chains. */
class Pix {
  g: Grid;
  constructor(src: string | [w: number, h: number]) {
    this.g = typeof src === 'string' ? toGrid(src) : Array.from({ length: src[1] }, () => Array<string>(src[0]).fill('.'));
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
  /** Rectangle outline. */
  frame(x: number, y: number, w: number, h: number, c: string): this {
    return this.hl(x, y, w, c).hl(x, y + h - 1, w, c).vl(x, y, h, c).vl(x + w - 1, y, h, c);
  }
  /** Filled disc (r may be fractional). */
  disc(cx: number, cy: number, r: number, c: string): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.px(x, y, c);
    return this;
  }
  /** Filled ellipse. */
  oval(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.px(x, y, c);
    return this;
  }
  /** Overlays art ('.' transparent). */
  stamp(src: string, x: number, y: number): this {
    parseRows(src).forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && this.px(x + i, y + j, ch)));
    return this;
  }
  /** Replaces colours inside a rectangle (whole canvas by default). */
  swap(map: Record<string, string>, x = 0, y = 0, w = this.w, h = this.h): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const c = map[this.get(i, j)];
      if (c !== undefined) this.px(i, j, c);
    }
    return this;
  }
  /** Adds a 1-px contour of `c` on transparent pixels touching opaque ones (stays inside the canvas). */
  contour(c = 'k', diagonal = false): this {
    const src = this.g.map((r) => [...r]);
    const solid = (x: number, y: number) => {
      const ch = src[y]?.[x];
      return ch !== undefined && ch !== '.';
    };
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        const n = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
        const d = diagonal && (solid(x - 1, y - 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1) || solid(x + 1, y + 1));
        if (n || d) this.g[y]![x] = c;
      }
    return this;
  }
  /** Mirrors the left half onto the right half. */
  mirror(): this {
    for (const r of this.g) for (let x = 0; x < this.w >> 1; x++) r[this.w - 1 - x] = r[x]!;
    return this;
  }
  flipX(): this {
    for (const r of this.g) r.reverse();
    return this;
  }
  toString(): string {
    return toArt(this.g);
  }
}

const pix = (src: string | [number, number]) => new Pix(src);

/** Draws patches over `base` ('.' in a patch is transparent). */
function stamp(base: string, ...patches: Patch[]): string {
  const p = pix(base);
  for (const [patch, x, y] of patches) p.stamp(patch, x, y);
  return p.toString();
}

/** Recolours characters. */
const swap = (src: string, map: Record<string, string>): string => src.replace(/[^\s.]/g, (ch) => map[ch] ?? ch);

/** Stacks art blocks vertically (all must share the same width). */
const stack = (...parts: string[]): string => parts.map((p) => parseRows(p).join('\n')).join('\n');

/**
 * A piece of furniture in 3/4 view: rounded `k` contour, top surface (`depth` rows, first row highlighted),
 * a lip row, then the front face (shaded on the right and at the bottom). Optional legs below the body.
 */
function box(
  w: number,
  h: number,
  o: { top: string; hi?: string; lip?: string; front: string; shade?: string; depth: number; legs?: number; legW?: number },
): Pix {
  const p = pix([w, h]);
  const bodyH = h - (o.legs ?? 0);
  p.rect(1, 1, w - 2, bodyH - 2, o.front);
  p.rect(1, 1, w - 2, o.depth, o.top);
  if (o.hi) p.hl(1, 1, w - 2, o.hi);
  if (o.lip) p.hl(1, o.depth + 1, w - 2, o.lip);
  if (o.shade) {
    p.vl(w - 2, o.depth + (o.lip ? 2 : 1), bodyH - o.depth - (o.lip ? 3 : 2), o.shade);
    p.hl(1, bodyH - 2, w - 2, o.shade);
  }
  p.hl(1, 0, w - 2, 'k').hl(1, bodyH - 1, w - 2, 'k').vl(0, 1, bodyH - 2, 'k').vl(w - 1, 1, bodyH - 2, 'k');
  if (o.legs) {
    const lw = o.legW ?? 2;
    for (const lx of [1, w - 1 - lw]) {
      p.rect(lx, bodyH - 1, lw, o.legs, o.shade ?? o.front);
      p.vl(lx - 1, bodyH - 1, o.legs + 1, 'k').vl(lx + lw, bodyH, o.legs, 'k').hl(lx, h - 1, lw, 'k');
    }
    p.hl(1, bodyH - 1, w - 2, 'k');
    for (const lx of [1, w - 1 - lw]) p.rect(lx, bodyH - 1, lw, o.legs, o.shade ?? o.front).hl(lx, h - 1, lw, 'k');
  }
  return p;
}

/** Sprite with local colours. */
const withColors = (art: string | Pix, colors: Record<string, string>): SpriteDef => ({ art: String(art), colors });

/** Local mid-tones (derived from the palette so they stay cohesive). */
const LAV_MID = mix(PAL.v!, PAL.V!, 0.45);

// ---------------------------------------------------------------------------
// Real world — Noa's bedroom
// ---------------------------------------------------------------------------

/** Wooden bed frame shared by Noa's beds (headboard rows 0–6, footboard rows 28–31). */
const BED_HEAD = `
  .kkkkkkkkkkkkkk.
  kccccccccccccccK
  kcCCCCCCCCCCCCxk
  kcCxCCCxxCCCxCxk
  kcCxCCCxxCCCxCxk
  kcCCCCCCCCCCCCxk
  kxxxxxxxxxxxxxxk
`;

const BED_FOOT = `
  kVVVVVVVVVVVVVuk
  kcccccccccccccck
  kCCCCCCCCCCCCCxk
  .kkkkkkkkkkkkkk.
`;

const BED = stack(
  BED_HEAD,
  `
  kgggggggggggggGk
  kWWggggggggggWWk
  kWgwfwwwwwwwwGWk
  kWgwwwwwwwwwWGWk
  kWgWwwwwwwwWWGWk
  kWWGGGGGGGGGGWWk
  kWWWWWWWWWWWWWWk
  kWWWWWWWWWWWWVVk
  kWWWWWWWWWVVbbbk
  kWWWWWWWVVbbbb6k
  kWWWWWVVbbbb666k
  kWWWVVbbbbvvvv6k
  kWVVbbbb666vvv6k
  kVbbbb6vvvv66v6k
  kb66vvvvvvvvv66k
  kvvvvvvvv66vvv6k
  kvvvvvv66vvvvv6k
  kvvvv66vvvvv66Vk
  kvv66vvvvv66vvVk
  kvvvvvvv66vvvvVk
  kvvvvvvvvvvvv6Vk
  `,
  BED_FOOT,
);
/** Noa asleep: hair on the pillow, eyes closed, duvet pulled up to the chin (body shape under it). */
const BED_SLEEPING = stack(
  BED_HEAD,
  `
  kgggkkkkkkkkgggk
  kWgkhhhhhhhhkgWk
  kWkhhhhhhhhhhkWk
  kWkhhhhhhhhhhkWk
  kWkHhhHhhHhhHkWk
  kWkHsHssHssHskWk
  kWkSsHHssHHsSkWk
  kWWkSssssssSkWWk
  kwwwwwwwwwwwwwWk
  kWWWWWWWWWWWWWgk
  k6vvvvvvvvvvv6Vk
  k6vvvvvvvvvvv6Vk
  k6vvvvvvvvvvv6Vk
  k66vvvvvvvvv66Vk
  k66vvvvvvvvv66Vk
  k666vvvvvvv666Vk
  k666vvvvvvv666Vk
  k66vvvvvvvvv66Vk
  k6vvvvvvvvvvv6Vk
  k6vvvvvvvvvvv6Vk
  k66vvv666vvv66Vk
  `,
  BED_FOOT,
);

/** Mina's bed: white arched frame with a star, pink starry duvet, neatly made, a bunny plush on the pillow. */
const BED_MINA = stack(
  `
  ....kkkkkkkk....
  ..kkwwwwwwwwkk..
  .kwwwwwwywwwwWk.
  kwwwwwwyYywwwwWk
  kwwwwwwwywwwwWgk
  kwWwwwwwwwwwWWgk
  kgWWWWWWWWWWWWgk
  kgggggggggggggGk
  kWWggggggggggWWk
  kWgwfwwwwwwwwgWk
  kWgwwwwwwwwwwgWk
  kWgWwwwwwwwwWGWk
  kWWGGGGGGGGGGWWk
  kWWWWWWWWWWWWWWk
  kwwwwwwwwwwwwwWk
  kPPPPPPPPPPPPPPk
  kppppppppppppPPk
  kppyppppppqppPPk
  kpyYypppppppPpPk
  kppypppqpppyppPk
  kpppppppppyYypPk
  kpqppypppppypPPk
  kpppyYyppppppPPk
  kppppypppqpppPPk
  kpppppppppppypPk
  kpyppppqpppyYyPk
  kpppppppppppypPk
  kppppppppppppPPk
  kPPPPPPPPPPPPPPk
  kwwwwwwwwwwwwwwk
  kWWWWWWWWWWWWWgk
  .kkkkkkkkkkkkkk.
  `,
  // bunny plush on the right of the pillow
);
const BED_MINA_FULL = stamp(
  BED_MINA,
  [
    `
    .k.k..
    kpkpk.
    kwkwk.
    kwwwwk
    kkwkwk
    kwpwwk
    .kkkk.
    `,
    9,
    6,
  ],
);

const DESK_LAMP = `
  ...kkk...
  ..kBBBk..
  .kBbbBBk.
  .kBBBBBk.
  kBBBBBBnk
  knnnnnnnk
  .kkkGkkk.
  ....Gk...
  ....Gk...
  ...kGGk..
  ..kGGGGk.
  ..kkkkkk.
`;

const NOTEBOOKS = `
  .kkkkkkkk.
  kbbbbbbbBk
  kbwwwbbbBk
  kBBBBBBBBk
  kwwwwwwwWk
  kPPPPPPPPk
  kwwwwwwwWk
  .kkkkkkkk.
`;

const PHONE_FLAT = `
  kkkkk
  kaaak
  kaAak
  kddGk
  kkkkk
`;

const DESK = (() => {
  const p = pix([32, 24]);
  p.stamp(String(box(32, 16, { top: 'c', hi: 'Q', lip: 'Q', front: 'C', shade: 'x', depth: 5, legs: 0 })), 0, 8);
  // knee hole (left) and drawer block (right)
  p.rect(3, 16, 13, 6, 'x').hl(3, 16, 13, 'K').vl(3, 16, 6, 'K');
  p.frame(18, 16, 12, 3, 'x').frame(18, 19, 12, 3, 'x');
  p.hl(22, 17, 4, 'c').hl(22, 20, 4, 'c');
  p.stamp(DESK_LAMP, 1, 0);
  p.stamp(NOTEBOOKS, 11, 6);
  p.stamp(PHONE_FLAT, 24, 9);
  return p.toString();
})();

const CHAIR = `
  ..kkkkkkkkkkkk..
  ..kccccccccccCk.
  ..kCCCCCCCCCCxk.
  ..kkkkkkkkkkkkk.
  ...kCk....kCk...
  ...kCk....kCk...
  ...kCk....kCk...
  .kkkkkkkkkkkkkk.
  .kQccccccccccCk.
  .kccccccccccccCk.
  .kccccccccccccCk.
  .kCCCCCCCCCCCCxk.
  .kxkkkkkkkkkkxk.
  .kxk.......kxk..
  .kxk.......kxk..
  .kkk.......kkk..
`;

/** Wardrobe: cornice, two panelled doors, small feet. `open` = right door ajar on a black inside. */
function closet(open: boolean): string {
  const p = box(32, 32, { top: 'c', hi: 'Q', lip: 'x', front: 'C', shade: 'x', depth: 2, legs: 2, legW: 3 });
  p.hl(1, 4, 30, 'c').hl(1, 5, 30, 'x'); // cornice moulding
  // doors
  for (const dx of [2, 17]) {
    p.frame(dx, 7, 13, 20, 'x');
    p.frame(dx + 2, 9, 9, 7, 'x').frame(dx + 2, 18, 9, 7, 'x');
    p.hl(dx + 3, 10, 7, 'c').vl(dx + 3, 10, 5, 'c').hl(dx + 3, 19, 7, 'c').vl(dx + 3, 19, 5, 'c');
  }
  p.vl(15, 6, 22, 'x').vl(16, 6, 22, 'K');
  p.rect(13, 16, 1, 2, 'Q').rect(18, 16, 1, 2, 'Q');
  if (open) {
    // right door swung out: thin foreshortened door on the right, black inside
    p.rect(16, 6, 9, 22, 'i').hl(16, 6, 9, 'K').vl(16, 6, 22, 'K');
    p.rect(25, 6, 6, 22, 'C').vl(25, 6, 22, 'c').vl(30, 6, 22, 'x').vl(31, 6, 22, 'k');
    p.frame(26, 9, 4, 7, 'x').frame(26, 18, 4, 7, 'x');
    p.px(17, 9, 'G').hl(18, 8, 3, 'G').px(21, 9, 'G'); // a coat hanger glinting in the dark
  }
  return p.toString();
}

const VEILLEUSE = `
  ...kkk..
  ..kqyk..
  .kqyk...
  .kyyk...
  .kyyk..k
  .kyyykyk
  ..kYyyYk
  ...kkkk.
  ..kWWWgk
  ..kkkkkk
`;

const NIGHTSTAND = (() => {
  const p = box(16, 16, { top: 'c', hi: 'Q', lip: 'Q', front: 'C', shade: 'x', depth: 4, legs: 2 });
  p.frame(3, 7, 10, 4, 'x').hl(6, 8, 4, 'c');
  return p.toString();
})();

const DODO_PLUSH = `
  ..kk.kk.kk..
  .kwwkwwkwwk.
  kpkwwwwwwkpk
  kppkGGGGkppk
  .kkGgkkgGkk.
  ..kGgggPkkPk
  .kwkGGGGkPPk
  kwwwkkkkwkk.
  kWwwwwwwwWk.
  kWWwwwwwWWk.
  .kGkWWWWkGk.
  ..kk.kk.kk..
`;

const DODO_PLUSH_DARK = `
  ..kk.kk.kk..
  .kGGkGGkGGk.
  kRkGGGGGGkRk
  kRRkddddkRRk
  .kkdKfKKfdkk.
  ..kdKKiKkkRk
  .kGkdiidkRRk
  kGGGkikkGkk.
  kdGGGiGGGdk.
  kddGiGGGddk.
  .kik.dddkik.
  ..ki.ik.ik..
`;

const SHELF = (() => {
  const p = box(32, 32, { top: 'c', hi: 'Q', front: 'C', shade: 'x', depth: 2, legs: 0 });
  // three compartments with a dark back panel
  for (const y of [5, 14, 23]) p.rect(2, y, 28, 7, 'x').hl(2, y, 28, 'K');
  for (const y of [12, 21, 30]) p.hl(1, y, 30, 'c').hl(1, y + 1, 30, 'C');
  p.hl(1, 30, 30, 'C').hl(1, 31, 30, 'k');
  const books: Array<[x: number, y: number, w: number, h: number, c: string, d: string]> = [
    [3, 7, 2, 5, 'n', 'z'], [5, 6, 2, 6, 'R', 'K'], [7, 8, 2, 4, 'E', 'z'], [9, 6, 3, 6, 'O', 'x'], [12, 7, 2, 5, 'u', 'K'],
    [21, 9, 6, 3, 'B', 'n'], [21, 7, 6, 2, 'l', 'e'],
    [3, 17, 3, 4, 'P', 'R'], [6, 16, 2, 5, 'b', 'B'], [8, 15, 2, 6, 'n', 'z'], [10, 17, 2, 4, 'Y', 'O'],
    [20, 16, 2, 5, 'e', 'E'], [22, 15, 2, 6, 'R', 'K'], [24, 16, 2, 5, 'v', 'V'], [26, 17, 3, 4, 'c', 'C'],
    [3, 25, 6, 5, 'G', 'd'], [15, 24, 2, 6, 'B', 'n'], [17, 25, 2, 5, 'o', 'O'], [19, 24, 3, 6, 'E', 'z'],
  ];
  for (const [x, y, w, h, c, d] of books) p.rect(x, y, w, h, c).vl(x + w - 1, y, h, d).hl(x, y, w - 1, c === 'w' ? 'f' : c);
  // small framed photo and a toy rocket
  p.stamp(`
    kkkkk
    kQQQk
    kbsbk
    kBBBk
    kkkkk
  `, 15, 7);
  p.stamp(`
    .k.
    kwk
    krk
    kwk
    rkr
  `, 14, 16);
  p.stamp(`
    .kkk.
    kAaAk
    kaAak
    .kAk.
  `, 24, 26);
  return p.toString();
})();

const PHOTO = `
  .kkkkkk.
  kxxxxxxk
  kxCCCCxk
  kxCCxCxk
  kxCxCCxk
  kxCCCCxk
  kxxxxxxk
  .kxkkxk.
`;

const CALENDAR = `
  .....kk.....
  ....k..k....
  .kkkkkkkkkk.
  kRRRRRRRRRRk
  kbbbbbbbbbBk
  kbwbbblbbbBk
  kLLlLLLLlLLk
  kwwwwwwwwwWk
  kwrwrwrwgwWk
  kwrwrwgwgwWk
  kwgwgwgwgwWk
  kwgwgwgwgwWk
  kWWWWWWWWWgk
  .kkkkkkkkkk.
`;

const POSTER = `
  .kkkkkkkkkkkkkk.
  kQnnnnnnnnnnnnQk
  knnnwnnnnnnnnnnk
  knnnnnnnnnjjnwnk
  knnnnnnnnjbbjnnk
  knnwnnnnnjbBjnnk
  knnnnnnnnnjjnnnk
  knnnnkkkknnnnnnk
  knnnkooooknnnnnk
  kckkooooOOkkkcnk
  knccooooOOccnnnk
  knnkoOOOOOknnnnk
  knnnkOOOOknnwnnk
  knnnnkkkknnnnnnk
  knwnnnnnnnnnnnnk
  knnnnnnnnnnnwnnk
  knnnnnwnnnnnnnnk
  knnnnnnnnnnnnnnk
  kQnnnnnnnnnnnnQk
  .kkkkkkkkkkkkkk.
`;

const TRASH = `
  .kkkkkkkk.
  kgwWwgGgdk
  kdwwwWddKk
  kGdddddKGk
  .kgGGGGdk.
  .kgGGGGdk.
  .kgGgGGdk.
  .kgGgGGdk.
  .kgGgGGdk.
  .kgGGGGdk.
  .kdddddKk.
  ..kkkkkk..
`;

const PLANT = `
  ....k.......
  ...kek..k...
  ..kelk.kek..
  .kelEkkeLEk.
  .kLEk.keLEk.
  kYkek.kLEk..
  kOYkekkeEkkk
  .kkkeekEkeYk
  ..kkLkeEkYOk
  .keLEkekEkkk
  .kLEkkeekk..
  ..kk.keEk...
  .kkkkkekkkk.
  kooooooooOOk
  kOOOOOOOOOxk
  .kOoooooOOk.
  .kOoooooOxk.
  .kOoooooOxk.
  ..kOOOOOxk..
  ...kkkkkk...
`;

const BEDROOM: Record<string, SpriteDef> = {
  prop_bed: withColors(BED, { '6': LAV_MID }),
  prop_bed_sleeping: withColors(BED_SLEEPING, { '6': LAV_MID }),
  prop_bed_mina: BED_MINA_FULL,
  prop_desk: DESK,
  prop_chair: CHAIR,
  prop_closet: closet(false),
  prop_closet_open: closet(true),
  prop_veilleuse: VEILLEUSE,
  prop_veilleuse_off: swap(VEILLEUSE, { y: 'g', q: 'W', Y: 'G' }),
  prop_nightstand: NIGHTSTAND,
  prop_dodo_plush: DODO_PLUSH,
  prop_dodo_plush_dark: DODO_PLUSH_DARK,
  prop_shelf: SHELF,
  prop_photo: PHOTO,
  prop_calendar: CALENDAR,
  prop_poster: POSTER,
  prop_trash: TRASH,
  prop_plant: PLANT,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  ...BEDROOM,
};

export const VARIANTS: string[] = ['real', 'ink'];

// Keep helpers referenced while the file grows.
void stamp;
void swap;
void stack;
void box;
void withColors;

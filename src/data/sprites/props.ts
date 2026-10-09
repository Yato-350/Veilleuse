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
 * - Big organic shapes (cotton-candy trees, wool roofs, clouds, Dodo) are built from lit "puffs" (Pix.puff / puffs):
 *   each lobe is shaded from the top-left and creased where it overlaps the one behind.
 *
 * Sections: toolkit · real world (bedroom, kitchen / living room / bathroom / entrance) · dream (Cotton Country) ·
 * Pencil Forest · Paper Hospital · void. Every prop is shown in context in src/data/maps/showcase_props.ts.
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
  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  /** Filled polygon (pixel centres inside the outline). */
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
  /**
   * A soft round volume lit from the top-left (cotton-candy foliage, clouds, wool). Bands: highlight, base, mid,
   * shade; `dither` softens the base/mid boundary with a checker.
   */
  puff(cx: number, cy: number, r: number, t: Tones, dither = false): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        const l = (-dx * 0.62 - dy * 0.78) / r;
        let c = l > 0.5 ? t.hi : l > -0.1 ? t.base : l > -0.62 ? t.mid : t.shade;
        if (dither && Math.abs(l + 0.1) < 0.09 && (x + y) % 2 === 0) c = l > -0.1 ? t.mid : t.base;
        this.px(x, y, c);
      }
    return this;
  }
  /** Scatters `c` over pixels currently equal to one of `on` (deterministic, density 0–1). */
  sprinkle(on: string, c: string, density: number, seed = 1, x = 0, y = 0, w = this.w, h = this.h): this {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (on.includes(this.get(i, j)) && hash(i, j, seed) < density) this.px(i, j, c);
    return this;
  }
  toString(): string {
    return toArt(this.g);
  }
}

/** Tones of a lit volume, from the brightest to the darkest. */
interface Tones {
  hi: string;
  base: string;
  mid: string;
  shade: string;
}

/** Deterministic hash → [0, 1). */
function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x + 1013, 374761393) ^ Math.imul(y + 7919, 668265263) ^ Math.imul(seed + 31, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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
  ..kQccccccccCk..
  ..kcCCCCCCCCxk..
  ..kkkkkkkkkkkk..
  ..kCk.kcck.kxk..
  ..kCk.kCCk.kxk..
  .kkkkkkkkkkkkkk.
  .kQccccccccccCk.
  .kcccccccccccCk.
  .kcccccccccccCk.
  .kCCCCCCCCCCCxk.
  .kkkkkkkkkkkkkk.
  .kxk.kK..Kk.kxk.
  .kxk........kxk.
  .kxk........kxk.
  .kkk........kkk.
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
  .kkdfKKfdkk.
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
// Real world — kitchen, living room, bathroom, entrance
// ---------------------------------------------------------------------------

/** Fridge: freezer + fridge doors, a sticky note held by a magnet, Mina's crayon drawings. */
const FRIDGE = (() => {
  const p = box(16, 32, { top: 'w', hi: 'f', lip: 'g', front: 'W', shade: 'g', depth: 3 });
  p.vl(1, 5, 24, 'w');
  p.hl(1, 12, 14, 'G').hl(1, 13, 13, 'w');
  p.vl(12, 6, 5, 'G').vl(12, 15, 7, 'G').px(12, 6, 'g').px(12, 15, 'g');
  p.rect(1, 27, 14, 4, 'g').hl(1, 27, 14, 'G').hl(1, 30, 14, 'G');
  for (const x of [3, 5, 7, 9, 11]) p.px(x, 29, 'd');
  // sticky note on the freezer
  p.rect(3, 6, 6, 4, 'y').hl(4, 7, 4, 'Y').hl(4, 8, 3, 'Y').vl(9, 7, 3, 'g').hl(4, 10, 5, 'g').px(5, 6, 'r');
  // drawing: sun, house, grass
  p.rect(2, 15, 8, 8, 'f').vl(10, 16, 7, 'g').hl(3, 23, 8, 'g');
  p.rect(3, 16, 2, 2, 'Y').px(5, 16, 'Y');
  p.poly([[4.5, 20], [7, 17.5], [9.5, 20]], 'r').rect(5, 20, 4, 2, 'B').px(6, 21, 'Y');
  p.hl(2, 22, 8, 'L').px(2, 15, 'B').px(9, 15, 'B');
  // a smaller pink drawing with a heart
  p.rect(5, 24, 6, 3, 'p').px(7, 25, 'r').px(8, 25, 'r').px(5, 24, 'L');
  return p.toString();
})();

/** Kitchen unit: white worktop, pale blue cabinets. */
function kitchenUnit(w: number, h: number, depth: number): Pix {
  const p = box(w, h, { top: 'W', hi: 'w', lip: 'g', front: 'b', shade: 'B', depth });
  p.hl(1, depth + 2, w - 2, 'B');
  return p;
}

const COUNTER = (() => {
  const p = kitchenUnit(32, 24, 7);
  // drawers and doors
  for (const x of [2, 17]) {
    p.frame(x, 11, 13, 3, 'B').hl(x + 5, 12, 3, 'n');
    p.frame(x, 14, 13, 8, 'B').hl(x + 1, 14, 11, 'a');
  }
  p.vl(13, 16, 3, 'n').vl(18, 16, 3, 'n');
  // cutting board with bread
  p.rect(3, 3, 10, 4, 'c').hl(3, 6, 10, 'C').vl(12, 3, 4, 'C').px(4, 4, 'C');
  p.rect(5, 3, 6, 2, 'O').hl(6, 3, 4, 'o').px(7, 4, 'o');
  // kettle
  p.stamp(`
    ..kk..
    .kgGk.
    kWWWgkk
    kWwWgkg
    kgggGk.
    .kkkk..
  `, 14, 1);
  // fruit bowl
  p.stamp(`
    ..kkk...
    .krrkLk.
    krorrLLk
    kWwwwwWk
    .kgWWgk.
    ..kkkk..
  `, 22, 1);
  return p.toString();
})();

const SINK = (() => {
  const p = kitchenUnit(16, 24, 7);
  p.rect(3, 3, 10, 5, 'W').hl(3, 3, 10, 'G').vl(3, 3, 5, 'G').hl(4, 4, 9, 'g').vl(4, 4, 4, 'g');
  p.px(9, 6, 'd').px(10, 7, 'b').px(8, 7, 'b');
  p.frame(2, 2, 12, 7, 'g');
  p.stamp(`
    .kk.
    kgwk
    kgGk
    .kk.
  `, 6, 0);
  p.px(8, 4, 'G');
  // two doors under the sink
  p.frame(2, 11, 6, 11, 'B').frame(8, 11, 6, 11, 'B').hl(3, 11, 4, 'a').hl(9, 11, 4, 'a');
  p.vl(6, 15, 3, 'n').vl(9, 15, 3, 'n');
  return p.toString();
})();

const STOVE = (() => {
  const p = box(16, 24, { top: 'W', hi: 'w', lip: 'g', front: 'W', shade: 'g', depth: 7 });
  p.rect(1, 1, 14, 2, 'g').hl(1, 1, 14, 'W');
  for (const x of [3, 6, 9, 12]) p.px(x, 2, 'd');
  // burners
  p.frame(2, 4, 5, 4, 'd').rect(3, 5, 3, 2, 'K').px(3, 5, 'G');
  // a little pot on the right burner
  p.stamp(`
    .kkkkk.
    kBbbbBk
    kBnnnBk
    knBBBnk
    .kkkkk.
  `, 8, 3);
  // oven door
  p.hl(2, 11, 12, 'G').hl(3, 10, 10, 'w');
  p.frame(2, 12, 12, 9, 'g').rect(4, 14, 8, 5, 'K').hl(4, 14, 8, 'd').px(5, 15, 'J').px(6, 15, 'J').px(5, 16, 'j');
  return p.toString();
})();

/** Kitchen table: three places — Noa's bowl, a vase, Mina's unfinished drawing and a crayon. */
const TABLE = (() => {
  const p = box(32, 24, { top: 'c', hi: 'Q', lip: 'C', front: 'C', shade: 'x', depth: 11, legs: 6, legW: 2 });
  for (const [x, y, l] of [[4, 4, 6], [15, 7, 9], [22, 10, 5], [9, 10, 4]] as const) p.hl(x, y, l, 'Q');
  // placemat + bowl
  p.rect(3, 5, 9, 6, 'b').hl(3, 10, 9, 'B').vl(11, 5, 6, 'B');
  p.oval(7, 7.5, 3, 2, 'w').oval(7, 7.5, 2, 1, 'W').hl(6, 7, 2, 'g');
  // vase with a drooping flower
  p.stamp(`
    ..kk...
    .kyYk..
    ..kke..
    ...ek..
    .kkekk.
    kbwbbBk
    kbbbBBk
    .kBBnk.
    ..kkk..
  `, 13, 1);
  // Mina's drawing and a yellow crayon
  p.rect(20, 3, 9, 7, 'f').hl(21, 10, 9, 'C').vl(29, 4, 6, 'C');
  p.rect(21, 4, 2, 2, 'Y').line(22, 8, 25, 6, 'P').line(25, 6, 27, 8, 'P').px(24, 5, 'B').px(26, 5, 'B');
  p.hl(21, 9, 7, 'L');
  p.hl(17, 10, 4, 'Y').px(16, 10, 'O').px(21, 10, 'y');
  return p.toString();
})();

const SOFA = (() => {
  const p = pix([32, 20]);
  // backrest
  p.rect(4, 1, 24, 9, 'B').rect(4, 1, 24, 2, 'b').hl(4, 3, 24, 'n');
  for (const x of [10, 16, 22]) p.px(x, 6, 'n').px(x, 7, 'b');
  // seat cushions
  p.rect(5, 9, 22, 5, 'b').hl(5, 9, 22, 'n').rect(5, 13, 22, 4, 'B').hl(5, 16, 22, 'n').vl(16, 10, 7, 'n');
  p.hl(6, 10, 9, 'a').hl(17, 10, 9, 'a');
  // arms
  for (const x of [1, 26]) {
    p.rect(x, 4, 5, 14, 'B').rect(x, 4, 5, 3, 'b').hl(x, 7, 5, 'n').vl(x + 4, 7, 11, 'n').hl(x, 17, 5, 'n');
    p.hl(x, 4, 4, 'a');
  }
  p.vl(6, 9, 8, 'n').vl(25, 9, 8, 'n');
  // feet
  p.rect(2, 18, 2, 1, 'x').rect(28, 18, 2, 1, 'x');
  // cushion and a plaid on the right arm
  p.stamp(`
    .kkkk.
    kyqyYk
    kyyyYk
    kYYYOk
    .kkkk.
  `, 6, 5);
  p.rect(26, 4, 4, 11, 'v').hl(26, 4, 4, 'w').hl(26, 8, 4, 'V').hl(26, 11, 4, 'V').vl(29, 5, 10, 'V');
  p.px(26, 15, 'v').px(28, 15, 'v').px(27, 14, 'V');
  p.contour();
  return p.toString();
})();

/** Old CRT on a low cabinet. `frame` 0/1 = snow (rolling band moves), -1 = switched off. */
function tv(frame: number): string {
  const p = pix([24, 24]);
  p.stamp(String(box(24, 9, { top: 'c', hi: 'Q', lip: 'C', front: 'C', shade: 'x', depth: 2 })), 0, 15);
  p.frame(3, 19, 8, 3, 'x').frame(13, 19, 8, 3, 'x').px(7, 20, 'Q').px(17, 20, 'Q');
  // antenna
  p.line(11, 4, 7, 0, 'G').line(12, 4, 16, 0, 'G').px(7, 0, 'g').px(16, 0, 'g');
  p.rect(10, 3, 4, 2, 'd').hl(10, 3, 3, 'G');
  // casing
  const body = pix([22, 12]);
  body.rect(1, 1, 20, 10, 'G').hl(1, 1, 20, 'g').vl(1, 1, 10, 'g').vl(20, 2, 9, 'd').hl(1, 10, 20, 'd');
  body.contour();
  p.stamp(String(body), 1, 4);
  // screen
  p.rect(3, 6, 14, 9, 'd');
  const sx = 4;
  const sy = 7;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 12; x++) {
      const corner = (x === 0 || x === 11) && (y === 0 || y === 6);
      let c: string;
      if (corner) c = 'd';
      else if (frame < 0) c = x + y < 4 && x + y > 1 ? 'J' : y < 3 ? 'j' : 'z';
      else {
        const band = y === (frame === 0 ? 1 : 4) || y === (frame === 0 ? 2 : 5);
        const r = hash(x, y, 40 + frame);
        c = band ? (r < 0.5 ? 'f' : 'w') : r < 0.25 ? 'f' : r < 0.5 ? 'g' : r < 0.75 ? 'G' : 'W';
      }
      p.px(sx + x, sy + y, c);
    }
  if (frame < 0) p.px(6, 8, 'J').px(5, 9, 'J');
  // control panel
  p.hl(18, 7, 2, 'd').hl(18, 9, 2, 'd').px(18, 12, 'K').px(19, 12, frame < 0 ? 'd' : 'r');
  p.px(18, 13, 'g');
  return p.toString();
}

const FLOOR_LAMP = (() => {
  const p = pix([12, 28]);
  p.poly([[3, 1], [9, 1], [11.5, 9], [0.5, 9]], 'q');
  p.poly([[7, 1], [9, 1], [11.5, 9], [8.5, 9]], 'Q');
  p.line(3, 1, 1, 8, 'w').hl(1, 9, 10, 'Y').hl(3, 1, 6, 'w');
  p.rect(5, 10, 2, 15, 'G').vl(5, 10, 15, 'g');
  p.oval(5.5, 25.5, 4, 1.6, 'd').hl(3, 25, 5, 'G');
  p.contour();
  return p.toString();
})();

const BATHTUB = (() => {
  const p = pix([32, 20]);
  p.rect(1, 1, 30, 17, 'w');
  // inner basin (back and left walls in shade, floor, lit front/right)
  p.rect(3, 3, 25, 8, 'W').hl(3, 3, 25, 'G').hl(4, 4, 24, 'g').vl(3, 3, 8, 'G').vl(4, 4, 7, 'g');
  p.hl(3, 10, 25, 'f').vl(27, 4, 7, 'f');
  p.rect(6, 7, 18, 3, 'b').hl(6, 7, 18, 'a').px(8, 8, 'f').px(18, 9, 'a');
  p.px(23, 6, 'G');
  // front face
  p.hl(1, 12, 30, 'g').rect(1, 13, 30, 5, 'W').hl(1, 17, 30, 'g').vl(30, 12, 6, 'g');
  p.hl(1, 1, 30, 'f');
  p.rect(1, 18, 30, 1, 'G');
  // tap
  p.stamp(`
    kkkk
    kwgk
    kggk
    .kGk
  `, 26, 0);
  p.contour();
  // Mina's rubber duck on the rim
  p.stamp(`
    .kk..
    kyyok
    kyYyk
    .kkk.
  `, 4, 0);
  return p.toString();
})();

const TOILET = (() => {
  const p = pix([12, 16]);
  p.rect(2, 1, 8, 5, 'W').hl(2, 1, 8, 'w').hl(2, 2, 8, 'w').hl(2, 4, 8, 'g').px(8, 2, 'g');
  p.oval(5.5, 9.5, 5, 3.6, 'w').oval(5.5, 9.5, 3.4, 2.2, 'g').oval(6, 10, 2.2, 1.4, 'b');
  p.hl(3, 8, 5, 'G');
  p.rect(3, 12, 6, 3, 'W').vl(8, 12, 3, 'g').hl(3, 14, 6, 'g').oval(5.5, 11.6, 4, 1, 'W');
  p.contour();
  return p.toString();
})();

const WASHBASIN = (() => {
  const p = pix([16, 20]);
  p.rect(1, 3, 14, 7, 'w').hl(1, 9, 14, 'W').hl(1, 10, 14, 'g');
  p.oval(7.5, 6, 5, 2.6, 'W').oval(7.5, 6, 5, 2.6, 'W').hl(4, 4, 8, 'G').px(3, 5, 'G').hl(4, 5, 8, 'g');
  p.px(8, 7, 'd').px(10, 7, 'f');
  p.rect(6, 11, 4, 7, 'W').vl(6, 11, 7, 'w').vl(9, 11, 7, 'g');
  p.rect(4, 17, 8, 2, 'W').hl(4, 18, 8, 'g');
  p.rect(7, 0, 2, 4, 'g').px(7, 0, 'w').px(8, 3, 'G').px(7, 4, 'G');
  p.contour();
  return p.toString();
})();

const MIRROR = (() => {
  const p = pix([14, 20]);
  p.rect(1, 1, 12, 18, 'c').hl(1, 1, 12, 'Q').vl(1, 1, 18, 'Q').vl(12, 2, 17, 'C').hl(1, 18, 12, 'x');
  p.rect(3, 3, 8, 14, 'B').rect(3, 3, 8, 7, 'b').hl(3, 3, 8, 'J').vl(3, 3, 14, 'J');
  p.line(5, 15, 10, 10, 'a').line(6, 16, 10, 12, 'b').line(4, 8, 8, 4, 'a').px(9, 4, 'f').px(4, 9, 'f');
  p.hl(4, 16, 7, 'n');
  // a star sticker in the corner
  p.px(11, 15, 'y').px(10, 16, 'y').px(11, 16, 'Y').px(12, 16, 'y').px(11, 17, 'y');
  p.contour();
  return p.toString();
})();

/** Smartphone lying on a surface: `lit` = notification on screen, otherwise a blinking LED on a dark screen. */
function phone(lit: boolean): string {
  return lit
    ? `
      .kkkkkk.
      kdggggdk
      kdbbbbdk
      kdwwwadk
      kdwgwwdk
      kdbbbbdk
      kdbBBbdk
      kdbbbbdk
      kdddGddk
      .kkkkkk.
    `
    : `
      .kkkkkk.
      kdGGGGdk
      kdKKKKdk
      kdKJKKdk
      kdKKjKdk
      kdKKKKdk
      kdKKKKdk
      kdKKKKdk
      kddadddk
      .kkkkkk.
    `;
}

/** Noa's sneakers and Mina's little red shoes, still by the door (seen in profile, in pairs). */
const SHOES = (() => {
  const p = pix([16, 8]);
  const sneaker = `
    .kkk....
    kBnnk...
    kBnwnkk.
    knnwnnBk
    kwwwwwWk
    .kkkkkk.
  `;
  p.stamp(sneaker, 2, 0).stamp(sneaker, 0, 2);
  const small = `
    .k..kk.
    krkkrrk
    krrrrrk
    kRRRRRk
    .kkkkk.
  `;
  p.stamp(swap(small, { r: 'R', R: 'x' }), 9, 1).stamp(small, 8, 3);
  return p.toString();
})();

/** Coat stand: Mum's long beige coat and a small yellow raincoat. */
const COAT = (() => {
  const p = pix([14, 28]);
  p.rect(6, 1, 2, 24, 'C').vl(6, 1, 24, 'c').rect(6, 0, 2, 1, 'x');
  p.line(6, 4, 3, 2, 'x').line(7, 4, 10, 2, 'x');
  p.line(6, 24, 2, 26, 'x').line(7, 24, 11, 26, 'x').hl(5, 25, 4, 'x');
  // beige coat (left hook): collar, sloping shoulders, sleeves, belt and pockets
  p.poly([[2.5, 4], [4.5, 4], [7.5, 8], [7.5, 21], [0.5, 21], [0.5, 8]], 'Q');
  p.poly([[2.5, 4], [3.5, 4], [1.5, 8], [1.5, 21], [0.5, 21], [0.5, 8]], 'q');
  p.line(3, 4, 4, 7, 'c').line(5, 5, 4, 7, 'C').vl(4, 8, 13, 'c').vl(6, 9, 11, 'c');
  p.hl(1, 13, 7, 'C').px(4, 13, 'x').px(2, 16, 'c').px(6, 16, 'c').hl(1, 20, 7, 'c');
  p.px(5, 10, 'x').px(5, 17, 'x');
  // child's raincoat with a hood (right hook)
  p.poly([[8, 4], [11, 4], [12.5, 14], [7.5, 14]], 'Y');
  p.rect(9, 3, 2, 2, 'O').px(9, 3, 'Y');
  p.vl(8, 6, 8, 'y').vl(11, 7, 7, 'O').hl(8, 13, 5, 'O').px(10, 8, 'q').px(10, 11, 'q');
  p.contour();
  return p.toString();
})();

/** Mina's crayon drawings taped to the wall. */
const DRAWINGS = (() => {
  const p = pix([24, 16]);
  // sun & house
  p.rect(1, 3, 9, 11, 'f').vl(9, 4, 10, 'W').hl(1, 13, 9, 'W');
  p.rect(2, 4, 2, 2, 'Y').px(4, 4, 'Y').px(2, 6, 'Y');
  p.poly([[3, 9], [5.5, 6.5], [8, 9]], 'r').rect(4, 9, 3, 3, 'B').px(5, 10, 'Y').hl(2, 12, 7, 'L');
  // two children holding hands under a heart
  p.rect(10, 1, 8, 10, 'q').vl(17, 2, 9, 'Q').hl(10, 10, 8, 'Q');
  p.px(12, 4, 'h').px(12, 5, 's').vl(12, 6, 3, 'V').px(15, 5, 'm').px(15, 6, 's').vl(15, 7, 2, 'r');
  p.hl(13, 7, 2, 'k').px(13, 2, 'r').px(15, 2, 'r').hl(13, 3, 3, 'r').px(14, 4, 'r');
  // sheep on blue paper
  p.rect(16, 7, 7, 8, 'b').vl(22, 8, 7, 'B').hl(16, 14, 7, 'B');
  p.oval(19, 10.5, 2.4, 1.8, 'w').px(17, 10, 'd').px(18, 13, 'd').px(20, 13, 'd').px(21, 8, 'y');
  // tape
  p.px(1, 3, 'Q').px(8, 3, 'Q').px(10, 1, 'g').px(17, 1, 'g').px(22, 7, 'Q');
  p.contour();
  return p.toString();
})();

const TOYBOX = (() => {
  const p = pix([16, 14]);
  p.stamp(String(box(16, 11, { top: 'c', hi: 'Q', lip: 'x', front: 'p', shade: 'P', depth: 3 })), 0, 3);
  p.hl(1, 7, 14, 'P').vl(1, 8, 4, 'w');
  for (const [x, y] of [[4, 9], [10, 10]] as const) p.px(x, y, 'y').px(x - 1, y, 'Y').px(x + 1, y, 'Y').px(x, y - 1, 'Y').px(x, y + 1, 'Y');
  p.px(7, 11, 'w').px(13, 8, 'w');
  // bunny ears poking out from under the lid
  p.stamp(`
    .k.k.
    kpkpk
    kwkwk
  `, 9, 0);
  return p.toString();
})();

/** Mina's notebook, with a faint golden halo. */
const CARNET = `
  ........q.
  .kkkkkkqyq
  .kgPpppPq.
  .kgpyYpPk.
  .kgpYYpPk.
  ykgPPPPPk.
  .kkkkkkkk.
  .y........
`;

const CLOCK = (() => {
  const p = pix([12, 12]);
  p.disc(5.5, 5.5, 5.9, 'k').disc(5.5, 5.5, 4.9, 'C').disc(5, 5, 3.9, 'c').disc(5.5, 5.5, 3.9, 'w');
  p.px(3, 3, 'W').px(2, 4, 'W');
  for (const [x, y] of [[5, 2], [9, 5], [5, 9], [2, 5]] as const) p.px(x, y, 'G');
  // three o'clock in the night: minute hand up, hour hand to the right
  p.vl(5, 3, 3, 'k').hl(5, 6, 3, 'k').px(5, 6, 'r');
  return p.toString();
})();

const PICTURE = (() => {
  const p = pix([16, 12]);
  p.rect(1, 1, 14, 10, 'c').hl(1, 1, 14, 'Q').vl(1, 1, 10, 'Q').vl(14, 2, 9, 'C').hl(1, 10, 14, 'x');
  p.rect(3, 3, 10, 6, 'n').hl(3, 3, 10, 'z').rect(3, 6, 10, 3, 'B');
  p.oval(6, 8.5, 4, 2, 'e').oval(11, 8.5, 3, 1.6, 'E').px(10, 4, 'y').px(11, 4, 'y').px(10, 5, 'Y');
  p.px(5, 4, 'w').px(8, 3, 'b').px(6, 7, 'y');
  p.contour();
  return p.toString();
})();

const HOME: Record<string, SpriteDef> = {
  prop_fridge: FRIDGE,
  prop_counter: COUNTER,
  prop_sink: SINK,
  prop_stove: STOVE,
  prop_table: TABLE,
  prop_sofa: SOFA,
  prop_tv: tv(0),
  prop_tv_2: tv(1),
  prop_tv_off: tv(-1),
  prop_lamp: FLOOR_LAMP,
  prop_bathtub: BATHTUB,
  prop_toilet: TOILET,
  prop_washbasin: WASHBASIN,
  prop_mirror: MIRROR,
  prop_phone: phone(false),
  prop_phone_2: phone(true),
  prop_shoes: SHOES,
  prop_coat: COAT,
  prop_drawings: DRAWINGS,
  prop_toybox: TOYBOX,
  prop_carnet: CARNET,
  prop_clock: CLOCK,
  prop_picture: PICTURE,
};

// ---------------------------------------------------------------------------
// Dream — Cotton Country
// ---------------------------------------------------------------------------

type Disc = [cx: number, cy: number, r: number, tones: Tones];

/** Local colours shared by the dream props (soft in-between pastels). */
const DREAM_COLORS: Record<string, string> = {
  '6': mix(PAL.p!, PAL.w!, 0.55), // pink highlight
  '7': mix(PAL.p!, PAL.P!, 0.45), // pink mid
  '8': mix(PAL.v!, PAL.w!, 0.5), // lavender highlight
  '9': mix(PAL.v!, PAL.V!, 0.45), // lavender mid
};
const MINT_COLORS: Record<string, string> = {
  '6': mix(PAL.a!, PAL.w!, 0.55),
  '7': mix(PAL.a!, PAL.A!, 0.45),
  '8': mix(PAL.l!, PAL.w!, 0.5),
  '9': mix(PAL.l!, PAL.L!, 0.5),
};
const PEACH_COLORS: Record<string, string> = {
  '6': mix(PAL.q!, PAL.w!, 0.5),
  '7': mix(PAL.y!, PAL.o!, 0.3),
  '8': mix(PAL.v!, PAL.w!, 0.5),
  '9': mix(PAL.v!, PAL.V!, 0.45),
};

/** Tone sets: "front" puffs use 6/p/7/P-like slots, "back" puffs the 8/v/9/V-like slots (recoloured per sprite). */
const T_FRONT: Tones = { hi: '6', base: 'p', mid: '7', shade: 'P' };
const T_BACK: Tones = { hi: '8', base: 'v', mid: '9', shade: 'V' };
const T_MINT_FRONT: Tones = { hi: '6', base: 'a', mid: '7', shade: 'A' };
const T_MINT_BACK: Tones = { hi: '8', base: 'l', mid: '9', shade: 'L' };
const T_PEACH: Tones = { hi: '6', base: 'q', mid: 'y', shade: '7' };
const T_WOOL: Tones = { hi: 'f', base: 'w', mid: 'W', shade: 'g' };
const T_CLOUD: Tones = { hi: 'f', base: 'w', mid: 'W', shade: 'v' };
const T_LEAF: Tones = { hi: 'l', base: 'L', mid: 'e', shade: 'E' };
const T_STONE: Tones = { hi: 'W', base: 'g', mid: 'G', shade: 'd' };

/**
 * Draws soft puffs back to front. Each new puff first darkens what lies just outside its upper arc (a soft crease),
 * so overlapping lobes stay readable like cotton candy or wool.
 */
function puffs(p: Pix, discs: Disc[], crease = true): Pix {
  const darker: Record<string, string> = {};
  for (const [, , , t] of discs)
    for (const [from, to] of [[t.hi, t.mid], [t.base, t.mid], [t.mid, t.shade], [t.shade, t.shade]] as const)
      if (!(from in darker)) darker[from] = to;
  for (const [cx, cy, r, t] of discs) {
    if (crease)
      for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          const c = p.get(x, y);
          if (d > r && d <= r + 1.15 && dy < r * 0.25 && darker[c]) p.px(x, y, darker[c]);
        }
    p.puff(cx, cy, r, t);
  }
  return p;
}

/** Tree trunk: a slightly flared, rounded wooden stem from y0 to the bottom of the canvas. */
function trunk(p: Pix, cx: number, y0: number, w = 6): Pix {
  const h = p.h - 1;
  p.poly([[cx - w / 2, y0], [cx + w / 2, y0], [cx + w / 2 - 0.5, h - 6], [cx + w / 2 + 2.5, h], [cx - w / 2 - 2.5, h], [cx - w / 2 + 0.5, h - 6]], 'C');
  p.line(cx - w / 2 + 1, y0, cx - w / 2 + 1, h - 5, 'c').line(cx - w / 2 + 1, h - 5, cx - w / 2 - 1, h - 1, 'c');
  p.line(cx + w / 2 - 1, y0, cx + w / 2 - 1, h - 5, 'x').line(cx + w / 2 - 1, h - 5, cx + w / 2 + 1, h - 1, 'x');
  p.px(cx, h - 2, 'x').px(cx - 1, h - 9, 'x').px(cx, h - 8, 'x');
  return p;
}

/** Cotton-candy tree (32×48): wooden trunk, puffy two-tone canopy. */
function candyTree(front: Tones, back: Tones, seed: number): Pix {
  const p = pix([32, 48]);
  trunk(p, 16, 26);
  p.hl(13, 33, 6, 'x').hl(14, 34, 4, 'x');
  puffs(p, [
    [9.5, 11, 7.5, back],
    [22.5, 10, 7.5, back],
    [16, 6.5, 6.5, back],
    [7.5, 19.5, 6.2, back],
    [24.5, 19.5, 6.2, back],
    [16, 15, 8.5, front],
    [10.5, 25, 6.8, front],
    [21.5, 25, 6.8, front],
    [16, 27.5, 5.8, front],
  ]);
  p.sprinkle(front.base + back.base, 'f', 0.025, seed).sprinkle(front.mid + back.mid, front.base, 0.04, seed + 1);
  p.contour();
  return p;
}

const TREE = candyTree(T_FRONT, T_BACK, 3);
const TREE_B = candyTree(T_MINT_FRONT, T_MINT_BACK, 5);

/** The same tree with a red balloon caught in its branches (string dangling). */
const BALLOON_TREE = (() => {
  const p = candyTree(T_PEACH, T_BACK, 9);
  p.line(23, 8, 22, 14, 'k').line(22, 14, 24, 21, 'k').line(24, 21, 24, 29, 'k').line(24, 29, 26, 33, 'k').line(26, 33, 25, 37, 'k');
  p.stamp(`
    ..kkkk..
    .krrrrk.
    krfrrrRk
    krfrrrRk
    krrrrRRk
    .krrRRk.
    ..kRRk..
    ...kk...
  `, 20, 0);
  return p;
})();

const TREE_SMALL = (() => {
  const p = pix([16, 24]);
  p.rect(7, 12, 2, 10, 'C').vl(7, 12, 10, 'c').px(6, 21, 'C').px(9, 21, 'x').hl(6, 22, 4, 'C');
  p.hl(7, 14, 2, 'x');
  puffs(p, [
    [5, 8, 4.3, T_BACK],
    [11, 7.5, 4.3, T_BACK],
    [8, 4.5, 4, T_BACK],
    [8, 9, 4.6, T_FRONT],
    [4.5, 11.5, 3, T_FRONT],
    [11.5, 11.5, 3, T_FRONT],
  ]);
  p.sprinkle('pv', 'f', 0.03, 11);
  p.contour();
  return p.toString();
})();

const BUSH = (() => {
  const p = pix([16, 14]);
  puffs(p, [
    [5, 6.5, 4.2, T_LEAF],
    [11, 6.5, 4.2, T_LEAF],
    [8, 4.5, 4.2, T_LEAF],
    [4.5, 9, 3.6, T_LEAF],
    [11.5, 9, 3.6, T_LEAF],
    [8, 9.2, 3.8, T_LEAF],
  ]);
  for (const [x, y, c] of [[4, 4, 'p'], [10, 3, 'w'], [12, 8, 'p'], [6, 9, 'y'], [9, 7, 'p']] as const)
    p.px(x, y, c).px(x + 1, y, c === 'y' ? 'Y' : c === 'p' ? 'P' : 'W');
  p.contour();
  return p.toString();
})();

const FLOWER_BIG = (() => {
  const p = pix([16, 20]);
  p.vl(8, 10, 9, 'e').vl(7, 12, 7, 'L');
  p.poly([[7, 15], [2, 12], [3, 15.5]], 'L').line(3, 14, 6, 15, 'e');
  p.poly([[9, 13], [14, 11], [13, 14.5]], 'e').line(10, 13, 13, 12, 'L');
  const petal: Tones = { hi: '6', base: 'p', mid: '7', shade: 'P' };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    p.puff(8 + Math.cos(a) * 3.6, 6.5 + Math.sin(a) * 3.2, 2.8, petal);
  }
  p.puff(8, 6.5, 2.4, { hi: 'q', base: 'y', mid: 'Y', shade: 'O' });
  p.px(7, 5, 'f');
  p.contour();
  return p.toString();
})();

const ROCK = (() => {
  const p = pix([16, 12]);
  p.puff(7.5, 7.6, 6.5, T_STONE).puff(11.5, 8.5, 3.6, T_STONE);
  p.rect(0, 10, 16, 2, '.');
  p.hl(2, 9, 12, 'd').hl(4, 8, 3, 'G').px(5, 1, 'L').px(6, 1, 'l').px(4, 2, 'L').px(7, 2, 'L');
  p.contour();
  return p.toString();
})();

const MUSHROOM = (() => {
  const p = pix([12, 14]);
  p.oval(5.5, 7.5, 5, 6.5, 'r');
  p.rect(0, 8, 12, 6, '.');
  p.rect(4, 8, 4, 5, 'q').vl(7, 8, 5, 'Q').vl(4, 9, 3, 'w').hl(4, 12, 4, 'Q');
  p.hl(1, 7, 10, 'R').hl(3, 8, 6, 'Q').hl(2, 6, 1, 'R').px(10, 5, 'R').px(10, 6, 'R');
  p.px(3, 2, 'p').px(2, 3, 'p').px(4, 2, 'p');
  p.px(3, 4, 'w').px(4, 4, 'w').px(3, 5, 'w').px(7, 2, 'w').px(8, 2, 'w').px(8, 5, 'w').px(9, 5, 'w').px(6, 6, 'w');
  p.contour();
  return p.toString();
})();

const SIGN = (() => {
  const p = pix([16, 16]);
  p.rect(7, 9, 2, 6, 'C').vl(7, 9, 6, 'c').px(8, 14, 'x');
  p.rect(1, 2, 14, 8, 'c').hl(1, 2, 14, 'Q').hl(1, 5, 14, 'C').hl(1, 9, 14, 'x').vl(14, 3, 7, 'C');
  p.hl(3, 4, 5, 'x').hl(3, 7, 3, 'x').hl(7, 7, 2, 'x');
  p.poly([[9, 6], [13, 4.5], [9, 3]], 'P').px(9, 3, 'P');
  p.px(2, 3, 'C').px(13, 8, 'C');
  p.contour();
  return p.toString();
})();

/** Street lamp topped by a glowing crescent moon. */
const LAMPPOST = (() => {
  const p = pix([12, 32]);
  p.rect(5, 11, 2, 18, 'n').vl(5, 11, 18, 'B');
  p.rect(4, 10, 4, 2, 'u').hl(4, 10, 4, 'V');
  p.rect(3, 27, 6, 3, 'u').hl(3, 27, 6, 'V').rect(2, 29, 8, 2, 'n').hl(2, 29, 8, 'B');
  // crescent moon
  const m = pix([12, 12]);
  m.disc(5.5, 5, 4.6, 'y');
  m.disc(7.6, 3.6, 3.7, '.');
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) if (m.get(x, y) === 'y' && (x + y < 7 || x < 3)) m.px(x, y, 'q');
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (m.get(x, y) === 'y' && y > 7) m.px(x, y, 'Y');
  p.stamp(String(m), 0, 0);
  p.px(2, 4, 'f').vl(6, 9, 2, 'n');
  p.contour();
  p.px(10, 1, 'q').px(11, 6, 'y').px(0, 1, 'y');
  return p.toString();
})();

/**
 * Sheep cottage (48×48, 3×2 footprint): a roof of fluffy wool, cream walls, two round lit windows with flower
 * boxes, a round door in the bottom centre.
 */
function cottage(o: { roof: Tones; wall: string; wallHi: string; wallShade: string; door: string; doorShade: string; box: string; flower: string }): Pix {
  const p = pix([48, 48]);
  // walls
  p.rect(4, 22, 40, 24, o.wall).vl(4, 22, 24, o.wallHi).vl(43, 22, 24, o.wallShade).hl(4, 45, 40, o.wallShade);
  p.rect(3, 43, 42, 3, 'g').hl(3, 43, 42, 'W').hl(3, 45, 42, 'G');
  for (const x of [8, 15, 22, 29, 36]) p.px(x, 44, 'G');
  // round windows
  for (const wx of [11.5, 36.5]) {
    p.disc(wx, 32, 4.6, 'c').disc(wx, 32, 3.5, 'y').disc(wx - 0.8, 31.2, 1.8, 'q');
    p.vl(Math.floor(wx), 29, 6, 'c').hl(Math.floor(wx) - 3, 32, 7, 'c');
    p.rect(Math.floor(wx) - 4, 37, 9, 2, o.box).hl(Math.floor(wx) - 4, 38, 9, 'x');
    for (let i = 0; i < 4; i++) p.px(Math.floor(wx) - 3 + i * 2, 36, i % 2 ? 'L' : o.flower);
  }
  // round door
  p.disc(23.5, 36, 5.5, 'k').rect(18, 36, 12, 10, 'k');
  p.disc(23.5, 36.5, 4.5, o.door).rect(19, 36, 10, 10, o.door);
  p.vl(21, 33, 13, o.doorShade).vl(24, 32, 14, o.doorShade).vl(27, 34, 12, o.doorShade);
  p.px(26, 40, 'Y').px(26, 41, 'O');
  p.rect(19, 46, 10, 1, 'W');
  p.px(23, 31, 'p').px(24, 31, 'p').px(23, 30, 'P');
  // wool roof
  puffs(p, [
    [24, 7.5, 7, o.roof],
    [14, 11, 7, o.roof],
    [34, 11, 7, o.roof],
    [6.5, 18, 6, o.roof],
    [41.5, 18, 6, o.roof],
    [24, 15, 8, o.roof],
    [10, 22, 5.5, o.roof],
    [18, 22, 5.5, o.roof],
    [30, 22, 5.5, o.roof],
    [38, 22, 5.5, o.roof],
  ]);
  // chimney
  p.rect(35, 1, 5, 6, 'R').hl(35, 1, 5, 'r').vl(39, 2, 5, 'x').hl(35, 4, 5, 'x');
  p.puff(37.5, 7.5, 3.4, o.roof);
  p.contour();
  return p;
}

const HOUSE = cottage({ roof: T_WOOL, wall: 'q', wallHi: 'w', wallShade: 'Q', door: 'C', doorShade: 'x', box: 'C', flower: 'p' });
const HOUSE_B = cottage({ roof: T_FRONT, wall: 'b', wallHi: 'a', wallShade: 'B', door: 'e', doorShade: 'E', box: 'x', flower: 'y' });

/** Chaussette's shop: blue wool roof, striped awning over the display window, a big polka-dot sock sign. */
const SHOP = (() => {
  const p = cottage({
    roof: { hi: 'f', base: 'b', mid: '7', shade: 'B' },
    wall: 'q',
    wallHi: 'w',
    wallShade: 'Q',
    door: 'P',
    doorShade: 'R',
    box: 'C',
    flower: 'y',
  });
  // (roof mid tone '7' is recoloured blue in SHOP_COLORS)
  // display window (left) with an awning
  p.rect(5, 29, 13, 10, 'k').rect(6, 30, 11, 8, 'b').hl(6, 30, 11, 'a').px(7, 31, 'f').px(8, 31, 'f');
  p.rect(7, 35, 3, 3, 'B').rect(11, 34, 3, 4, 'p').px(12, 34, 'P').rect(14, 35, 2, 3, 'y');
  p.rect(5, 38, 13, 1, 'C');
  for (let x = 4; x < 19; x++) {
    const c = Math.floor((x - 4) / 2) % 2 ? 'w' : 'r';
    p.vl(x, 25, 4, c).px(x, 29, (x - 4) % 2 ? '.' : c);
  }
  p.hl(4, 24, 15, 'k').hl(4, 25, 15, 'R');
  // right window: hanging sock sign on a bracket
  p.rect(30, 26, 14, 16, 'q').vl(43, 26, 16, 'Q');
  p.hl(31, 27, 11, 'x').vl(41, 27, 3, 'x');
  p.stamp(`
    .kkkkk...
    kwwwwwk..
    kbbbbbk..
    kBwbbBk..
    kbbbwbk..
    kbwbbbk..
    kbbbBbkk.
    kBbbbbbbk
    kbbwbbBbk
    .kBBBBBk.
    ..kkkkk..
  `, 33, 28);
  p.hl(39, 28, 1, 'x');
  p.contour();
  return p;
})();

const WELL = (() => {
  const p = pix([24, 24]);
  // posts and pastel roof
  p.rect(3, 6, 2, 11, 'C').vl(3, 6, 11, 'c').rect(19, 6, 2, 11, 'C').vl(19, 6, 11, 'c');
  p.poly([[12, 0], [23, 6.5], [1, 6.5]], 'P');
  p.poly([[12, 0], [12, 0], [1, 6.5], [6, 6.5]], 'p');
  p.hl(1, 6, 22, 'R').line(12, 0, 2, 6, '6').hl(5, 7, 14, 'x');
  p.hl(5, 9, 14, 'x').vl(12, 9, 3, 'Q');
  p.stamp(`
    kkkk
    kcCk
    kCxk
    .kk.
  `, 10, 11);
  // stone ring
  p.oval(12, 17.5, 10.5, 5.5, 'g');
  p.rect(1, 17, 22, 5, 'g');
  p.oval(12, 21.5, 10.5, 1.5, 'g');
  p.oval(12, 15.5, 7.5, 2.6, 'n').oval(12, 16, 6.5, 1.8, 'B').px(9, 15, 'b').px(15, 16, 'b');
  p.hl(2, 18, 20, 'G');
  for (let y = 19; y < 23; y++) for (let x = 1; x < 23; x++) if ((x + (y % 2) * 3) % 6 === 0) p.px(x, y, 'G');
  p.hl(2, 22, 20, 'G').hl(4, 16, 2, 'W').hl(18, 16, 2, 'W').px(3, 15, 'W');
  p.contour();
  return p.toString();
})();

const BENCH = (() => {
  const p = pix([24, 12]);
  p.rect(2, 1, 20, 3, 'c').hl(2, 1, 20, 'Q').hl(2, 3, 20, 'C');
  p.rect(4, 4, 2, 2, 'x').rect(18, 4, 2, 2, 'x');
  p.rect(1, 5, 22, 3, 'c').hl(1, 5, 22, 'Q').hl(1, 7, 22, 'C').rect(1, 8, 22, 1, 'x');
  p.rect(2, 9, 2, 2, 'x').rect(20, 9, 2, 2, 'x').px(3, 9, 'C').px(21, 9, 'C');
  p.contour();
  return p.toString();
})();

const CLOUD_BIG = (() => {
  const p = pix([48, 24]);
  puffs(p, [
    [15, 10, 7, T_CLOUD],
    [27, 8, 8, T_CLOUD],
    [37.5, 11, 6.5, T_CLOUD],
    [8, 16, 6.5, T_CLOUD],
    [19, 15.5, 7.5, T_CLOUD],
    [31, 15.5, 7.5, T_CLOUD],
    [41, 16.5, 5.5, T_CLOUD],
  ]);
  p.rect(0, 22, 48, 2, '.');
  p.hl(3, 21, 42, 'v').sprinkle('w', 'f', 0.02, 4);
  p.contour();
  return p.toString();
})();

/** The lonely wardrobe on top of the hill: tall, dark, doors ajar on a black gap with two yellow eyes. */
const CLOSET_DOOR = (() => {
  const p = box(32, 48, { top: 'C', hi: 'c', lip: 'K', front: 'x', shade: 'K', depth: 2, legs: 3, legW: 3 });
  // carved crown with a moon
  p.rect(1, 4, 30, 4, 'x').hl(1, 4, 30, 'C').hl(1, 7, 30, 'K');
  p.disc(15.5, 5.5, 1.8, 'Y').disc(16.4, 5, 1.4, 'x');
  for (const dx of [2, 17]) {
    p.frame(dx, 9, 13, 33, 'K');
    p.frame(dx + 2, 11, 9, 12, 'K').frame(dx + 2, 26, 9, 13, 'K');
    p.hl(dx + 3, 12, 7, 'C').vl(dx + 3, 12, 10, 'C').hl(dx + 3, 27, 7, 'C').vl(dx + 3, 27, 11, 'C');
  }
  // the gap between the doors
  p.rect(15, 9, 2, 34, 'i').vl(14, 9, 34, 'K');
  p.px(15, 23, 'y').px(16, 24, 'Y').px(15, 21, 'Y');
  p.px(13, 24, 'Y').px(18, 24, 'Y');
  // claw marks and the round brass handles
  p.line(5, 30, 8, 34, 'K').line(7, 29, 10, 33, 'K');
  return p.toString();
})();

const STAR_FALLEN = (() => {
  const p = pix([24, 16]);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2 + 0.18;
    const r = i % 2 ? 3.9 : 8.4;
    pts.push([12 + Math.cos(a) * r * 1.25, 9.2 + Math.sin(a) * r]);
  }
  p.poly(pts, 'y');
  // light from the top-left: brighten upper-left facets, shade lower-right
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 24; x++) {
      if (p.get(x, y) !== 'y') continue;
      const d = (x - 12) * 0.55 + (y - 9) * 0.85;
      if (d < -2.2) p.px(x, y, 'q');
      else if (d > 2.2) p.px(x, y, 'Y');
    }
  p.px(9, 5, 'f').px(10, 4, 'f').px(8, 6, 'f');
  // half-sunk in the ground, grass tufts in front of its lower points
  p.rect(0, 13, 24, 3, '.');
  for (const x of [5, 10, 16]) p.poly([[x - 1.5, 15], [x, 11], [x + 1, 13], [x + 2, 11.5], [x + 3.5, 15]], 'L');
  for (const x of [5, 10, 16]) p.px(x, 12, 'l').px(x + 2, 14, 'e').px(x + 1, 14, 'e').px(x, 14, 'e');
  p.rect(0, 15, 24, 1, '.');
  p.contour();
  p.px(1, 2, 'q').px(0, 3, 'y').px(2, 3, 'y').px(1, 4, 'y').px(22, 1, 'q').px(23, 7, 'y').px(21, 11, 'q');
  return p.toString();
})();

const PILLOW_BIG = (() => {
  const p = pix([32, 16]);
  p.poly([[1, 2], [16, 3], [31, 2], [29.5, 8], [31, 14], [16, 13], [1, 14], [2.5, 8]], 'w');
  p.poly([[1, 2], [16, 3], [31, 2], [29.5, 5], [2, 5]], 'f');
  p.poly([[2.5, 10], [29.5, 10], [31, 14], [16, 13], [1, 14]], 'W');
  p.hl(3, 12, 26, 'g').line(29, 4, 29, 12, 'W');
  for (const x of [8, 16, 24]) p.vl(x, 4, 7, 'W');
  p.line(16, 8, 12, 5, 'W').line(16, 8, 20, 5, 'W').line(16, 8, 12, 11, 'W').line(16, 8, 20, 11, 'W');
  p.disc(16, 8, 1.6, 'p').px(16, 8, 'P').px(15, 7, '6');
  p.contour();
  return p.toString();
})();

/** Market stall: scalloped striped awning, crates of apples, balls of yarn, milk bottles. */
const STALL = (() => {
  const p = pix([32, 32]);
  p.rect(3, 9, 2, 20, 'C').vl(3, 9, 20, 'c').rect(27, 9, 2, 20, 'C').vl(27, 9, 20, 'c');
  p.stamp(String(box(32, 13, { top: 'c', hi: 'Q', lip: 'C', front: 'C', shade: 'x', depth: 3 })), 0, 19);
  for (const x of [8, 16, 24]) p.vl(x, 24, 6, 'x');
  // goods
  for (const [x, y] of [[3, 19], [5, 18], [7, 19], [4, 17], [6, 20]] as const) p.px(x, y, 'r').px(x + 1, y, 'R');
  p.px(4, 17, 'f');
  p.disc(13, 19, 2.2, 'b').px(12, 18, 'f').px(14, 20, 'B').disc(17.5, 19.5, 2, 'p').px(17, 18, 'f').px(18, 20, 'P');
  p.line(11, 19, 14, 19, 'B');
  for (const x of [22, 25]) p.rect(x, 16, 2, 5, 'w').px(x, 16, 'b').px(x + 1, 17, 'W').hl(x, 16, 2, 'b');
  // awning
  for (let x = 1; x < 31; x++) {
    const c = Math.floor((x - 1) / 3) % 2 ? 'w' : 'p';
    const shade = c === 'w' ? 'W' : '7';
    p.vl(x, 2, 7, c).px(x, 1, shade === 'W' ? 'f' : '6').px(x, 8, shade);
    if ((x - 1) % 3 !== 1) p.px(x, 9, c);
  }
  p.hl(1, 2, 30, 'f');
  p.contour();
  return withColors(p, DREAM_COLORS);
})();

const MAILBOX = (() => {
  const p = pix([10, 16]);
  p.rect(4, 9, 2, 6, 'C').vl(4, 9, 6, 'c');
  p.rect(1, 3, 8, 7, 'B').disc(4.5, 3.5, 3.5, 'B').rect(1, 3, 8, 1, 'B');
  p.rect(1, 2, 8, 2, 'B').hl(2, 1, 6, 'B');
  p.hl(2, 1, 5, 'b').vl(1, 2, 7, 'b').vl(8, 3, 7, 'n').hl(1, 9, 8, 'n');
  p.hl(3, 5, 4, 'n').rect(3, 4, 3, 1, 'w').px(5, 4, 'W');
  p.vl(9, 3, 4, 'r').px(8, 3, 'R');
  p.contour();
  return p.toString();
})();

/** Save point: a little moon nightlight on a cream pedestal. Frame 2 glows brighter, sparkles move. */
function savepoint(f: number): string {
  const p = pix([12, 18]);
  // pedestal
  p.rect(3, 10, 6, 5, 'q').vl(3, 10, 5, 'w').vl(8, 10, 5, 'Q').rect(2, 9, 8, 2, 'w').hl(2, 10, 8, 'Q');
  p.rect(1, 15, 10, 2, 'q').hl(1, 15, 10, 'w').hl(1, 16, 10, 'Q');
  p.px(5, 12, 'v').px(6, 12, 'v').px(5, 13, 'V').px(6, 13, 'u');
  // a round halo of light with a golden crescent inside (Mina's nightlight, magnified by the dream)
  p.disc(5.5, 4.6, 4.6, f ? 'f' : 'q').disc(5.5, 4.6, 4.6, f ? 'f' : 'q');
  for (let y = 0; y < 10; y++)
    for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x + 0.5 - 5.5, y + 0.5 - 4.6);
      if (d <= 4.6 && d > 3.7) p.px(x, y, f ? 'q' : 'y');
    }
  const m = pix([12, 10]);
  m.disc(5.2, 4.6, 3.1, 'Y');
  m.disc(6.7, 3.7, 2.4, '.');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) if (m.get(x, y) === 'Y' && (x < 4 && y < 5)) m.px(x, y, f ? 'y' : 'Y');
  for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) if (m.get(x, y) === 'Y' && y > 5) m.px(x, y, 'O');
  p.stamp(String(m), 0, 0);
  if (f) p.px(7, 6, 'q').px(8, 2, 'y');
  p.contour();
  if (f) p.px(11, 1, 'q').px(0, 2, 'y').px(11, 8, 'y').px(1, 9, 'q');
  else p.px(11, 4, 'y').px(0, 6, 'y');
  return p.toString();
}

/** Noa's own bed, in the middle of the meadow: grass and flowers grow around its feet. */
const BED_DREAM = (() => {
  const p = pix(BED);
  p.stamp(`
    .l.....
    lLl.p..
    Lel.pPy
    eLe..eY
  `, 0, 28);
  p.stamp(`
    ....l.y
    ..y.lLY
    l.YLLel
    Le.eLeL
  `, 9, 28);
  p.px(4, 18, 'y').px(10, 22, 'y').px(6, 25, 'q');
  return withColors(p, { '6': LAV_MID });
})();

const COUNTER_SHOP = (() => {
  const p = box(32, 16, { top: 'c', hi: 'Q', lip: 'C', front: 'C', shade: 'x', depth: 5 });
  for (const x of [8, 16, 24]) p.vl(x, 8, 6, 'x');
  p.hl(2, 10, 4, 'b').hl(10, 10, 4, 'b').hl(18, 10, 4, 'b').hl(26, 10, 3, 'b');
  // a little bell, a ledger, a jar of buttons (the currency)
  p.stamp(`
    ..k..
    .kYk.
    kYyYk
    kkkkk
  `, 3, 0);
  p.rect(10, 2, 7, 4, 'R').hl(10, 2, 7, 'r').hl(11, 5, 6, 'w').px(16, 3, 'x');
  p.stamp(`
    .kkkk.
    kgGGgk
    kwrbwk
    kpwywk
    kbyrPk
    .kkkk.
  `, 23, 0);
  return p.toString();
})();

const JAR_SHELF = (() => {
  const p = box(32, 24, { top: 'c', hi: 'Q', front: 'C', shade: 'x', depth: 2 });
  for (const y of [5, 14]) p.rect(2, y, 28, 7, 'x').hl(2, y, 28, 'K');
  for (const y of [12, 21]) p.hl(1, y, 30, 'c').hl(1, y + 1, 30, 'C');
  p.hl(1, 22, 30, 'C');
  const jar = (x: number, y: number, fill: string, dark: string, lid: string) => {
    p.rect(x, y + 1, 4, 5, fill).vl(x, y + 1, 5, 'a').vl(x + 3, y + 2, 4, dark).hl(x, y, 4, lid).px(x + 1, y + 2, 'f');
    p.frame(x - 1, y - 1, 6, 8, 'k').px(x - 1, y - 1, '.').px(x + 4, y - 1, '.');
  };
  jar(3, 6, 'p', 'P', 'r');
  jar(9, 6, 'y', 'Y', 'C');
  jar(15, 7, 'L', 'e', 'B');
  jar(21, 6, 'w', 'W', 'P');
  jar(4, 15, 'o', 'O', 'B');
  jar(11, 15, 'v', 'V', 'Y');
  jar(19, 16, 'b', 'B', 'r');
  p.rect(25, 18, 4, 3, 'b').hl(25, 18, 4, 'r').px(26, 19, 'f');
  p.rect(26, 7, 3, 4, 'q').hl(26, 7, 3, 'Q');
  return p.toString();
})();

const DREAM: Record<string, SpriteDef> = {
  prop_tree: withColors(TREE, DREAM_COLORS),
  prop_tree_b: withColors(TREE_B, MINT_COLORS),
  prop_tree_small: withColors(TREE_SMALL, DREAM_COLORS),
  prop_bush: BUSH,
  prop_flower_big: withColors(FLOWER_BIG, DREAM_COLORS),
  prop_rock: ROCK,
  prop_mushroom: MUSHROOM,
  prop_sign: SIGN,
  prop_lamppost: LAMPPOST,
  prop_house: withColors(HOUSE, DREAM_COLORS),
  prop_house_b: withColors(HOUSE_B, DREAM_COLORS),
  prop_shop: withColors(SHOP, { ...DREAM_COLORS, '7': mix(PAL.b!, PAL.B!, 0.45) }),
  prop_well: withColors(WELL, DREAM_COLORS),
  prop_bench: BENCH,
  prop_balloon_tree: withColors(BALLOON_TREE, PEACH_COLORS),
  prop_cloud_big: CLOUD_BIG,
  prop_closet_door: CLOSET_DOOR,
  prop_star_fallen: STAR_FALLEN,
  prop_pillow_big: withColors(PILLOW_BIG, DREAM_COLORS),
  prop_stall: STALL,
  prop_mailbox: MAILBOX,
  prop_savepoint: savepoint(0),
  prop_savepoint_2: savepoint(1),
  prop_bed_dream: BED_DREAM,
  prop_counter_shop: COUNTER_SHOP,
  prop_jar_shelf: JAR_SHELF,
};

// ---------------------------------------------------------------------------
// Pencil Forest — everything looks drawn with crayons on paper
// ---------------------------------------------------------------------------

/** Waxy crayon texture: sparse vertical streaks of `dark` over pixels of `on`. */
function waxy(p: Pix, on: string, dark: string, seed: number, x = 0, y = 0, w = p.w, h = p.h): Pix {
  for (let i = x; i < x + w; i++)
    for (let j = y; j < y + h; j++) {
      if (!on.includes(p.get(i, j))) continue;
      const r = hash(i, Math.floor(j / 3), seed);
      if (r < 0.12) p.px(i, j, dark);
    }
  return p;
}

/** Giant pencil planted tip up (16×48): sharpened wood cone, lead tip, three painted facets, paper collar at the base. */
function pencil(hi: string, base: string, shade: string): Pix {
  const p = pix([16, 48]);
  // painted body (three facets)
  p.rect(3, 15, 10, 30, base).rect(3, 15, 3, 30, hi).rect(10, 15, 3, 30, shade);
  waxy(p, base, shade, hi.charCodeAt(0), 6, 18, 4, 26);
  p.hl(3, 22, 10, shade).hl(3, 23, 10, 'Y').hl(3, 24, 10, shade);
  p.px(4, 23, 'y').px(5, 23, 'y');
  // sharpened wood cone with a scalloped paint edge
  p.poly([[8, 1], [12.9, 16], [3.1, 16]], 'c');
  p.poly([[8, 1], [5.6, 16], [3.1, 16]], 'q');
  p.poly([[8, 1], [12.9, 16], [10.4, 16]], 'C');
  p.rect(3, 15, 3, 1, hi).rect(6, 16, 4, 1, base).rect(10, 15, 3, 1, shade);
  p.px(4, 14, hi).px(7, 15, base).px(8, 15, base).px(11, 14, shade);
  // lead tip
  p.poly([[8, 1], [9.9, 6.5], [6.1, 6.5]], shade);
  p.px(7, 4, base).px(7, 5, base);
  // paper collar around the base, crumpled where it is planted
  p.rect(3, 44, 10, 1, shade);
  p.rect(1, 44, 14, 3, 'w').hl(1, 44, 14, 'f').hl(1, 46, 14, 'W').px(4, 45, 'g').px(9, 45, 'g').px(12, 46, 'g');
  p.contour();
  return p;
}

const PENCIL_COLORS = { '6': mix(PAL.r!, PAL.w!, 0.35) };

/** Paper lantern on a little stake. */
function lantern(on: boolean, tones: { core: string; inner: string; body: string; rib: string }): string {
  const p = pix([12, 20]);
  p.rect(5, 13, 2, 6, 'C').vl(5, 13, 6, 'c');
  p.oval(5.5, 7.5, 4.4, 5, tones.body);
  if (on) p.oval(5.5, 7.5, 3, 3.6, tones.inner).oval(5, 7, 1.5, 2, tones.core);
  else p.oval(3.6, 6, 1, 2, tones.inner);
  for (const y of [4, 6, 9, 11]) for (let x = 0; x < 12; x++) if (p.get(x, y) === tones.body) p.px(x, y, tones.rib);
  p.rect(3, 2, 6, 2, 'd').hl(3, 2, 6, 'G').rect(3, 12, 6, 2, 'd').hl(3, 12, 6, 'G');
  p.px(5, 1, 'd').px(6, 1, 'd');
  p.contour();
  return p.toString();
}

const LANTERN_ON = {
  r: { core: 'q', inner: 'p', body: 'r', rib: 'R' },
  b: { core: 'f', inner: 'a', body: 'b', rib: 'B' },
  y: { core: 'f', inner: 'q', body: 'y', rib: 'Y' },
  g: { core: 'q', inner: 'l', body: 'L', rib: 'e' },
};
const LANTERN_OFF = {
  r: { core: 'R', inner: 'r', body: 'R', rib: '9' },
  b: { core: 'n', inner: 'B', body: 'n', rib: '9' },
  y: { core: '8', inner: 'Y', body: '8', rib: '9' },
  g: { core: 'E', inner: 'e', body: 'E', rib: '9' },
};
const LANTERN_OFF_COLORS = {
  r: { '9': mix(PAL.R!, PAL.k!, 0.45) },
  b: { '9': mix(PAL.n!, PAL.k!, 0.45) },
  y: { '8': mix(PAL.Y!, PAL.d!, 0.45), '9': mix(PAL.Y!, PAL.k!, 0.62) },
  g: { '9': mix(PAL.E!, PAL.k!, 0.45) },
};

/** Worn wax crayon stub lying on its side: torn paper wrapper, flat broken end. */
const CRAYON_ROCK = (() => {
  const p = pix([16, 12]);
  p.rect(2, 3, 10, 7, 'o').hl(2, 3, 10, 'y').hl(2, 4, 10, 'o').rect(2, 8, 10, 2, 'O');
  p.poly([[11, 3], [14.5, 5], [14.5, 8], [11, 10]], 'o').line(12, 4, 14, 5, 'y').line(12, 9, 14, 8, 'O');
  // paper wrapper with stripes
  p.rect(4, 3, 6, 7, 'Y').hl(4, 3, 6, 'q').rect(4, 8, 6, 2, 'O').vl(5, 3, 7, 'k').vl(8, 3, 7, 'k').px(6, 6, 'O').px(7, 5, 'O');
  // broken end: lighter cross-section
  p.oval(2, 6.5, 1.3, 3.3, 'y').px(2, 5, 'q');
  p.contour();
  return p.toString();
})();

/** The Owl's library, folded from notebook paper: ruled-paper roof, round owl-eye windows, cardboard door. */
const PAPER_HOUSE = (() => {
  const p = pix([48, 48]);
  // walls
  p.rect(5, 23, 38, 23, 'w').vl(5, 23, 23, 'f').rect(36, 23, 7, 23, 'W').vl(42, 23, 23, 'g');
  for (const x of [13, 24, 36]) p.vl(x, 24, 21, 'W');
  p.hl(5, 45, 38, 'g');
  // origami roof: two facets with blue ruled lines and a red margin
  p.poly([[24, 1], [46, 24], [2, 24]], 'f');
  p.poly([[24, 1], [46, 24], [24, 24]], 'W');
  for (let y = 6; y < 24; y += 3)
    for (let x = 0; x < 48; x++) {
      const c = p.get(x, y);
      if (c === 'f') p.px(x, y, 'b');
      else if (c === 'W') p.px(x, y, 'g');
    }
  p.line(17, 8, 9, 23, 'p').line(24, 1, 24, 23, 'g');
  p.hl(2, 24, 45, 'g').hl(3, 25, 43, 'G');
  // owl-eye windows in the gable
  for (const ex of [19, 29]) p.disc(ex, 15, 3.4, 'k').disc(ex, 15, 2.5, 'y').disc(ex - 0.6, 14.4, 1.2, 'q');
  p.poly([[22.5, 18], [25.5, 18], [24, 20.5]], 'O');
  // windows full of books
  for (const wx of [8, 32]) {
    p.rect(wx, 29, 8, 8, 'k').rect(wx + 1, 30, 6, 6, 'Q');
    p.vl(wx + 1, 31, 5, 'R').vl(wx + 2, 32, 4, 'B').vl(wx + 3, 31, 5, 'e').vl(wx + 5, 32, 4, 'V').vl(wx + 6, 31, 5, 'Y');
    p.hl(wx, 37, 8, 'C');
  }
  // cardboard door with an open book sign
  p.rect(19, 33, 10, 13, 'k').rect(20, 34, 8, 12, 'c').vl(20, 34, 12, 'Q').vl(27, 34, 12, 'C').px(26, 40, 'x');
  p.vl(24, 34, 12, 'C');
  p.rect(20, 28, 8, 4, 'k').rect(21, 29, 3, 2, 'w').rect(24, 29, 3, 2, 'W').px(24, 29, 'g');
  // a paper flag on the roof tip
  p.vl(24, 0, 2, 'G');
  p.contour();
  p.poly([[25, 0], [29, 1], [25, 2]], 'r');
  return p.toString();
})();

const BOOKSTACK = (() => {
  const p = pix([16, 20]);
  const book = (x: number, y: number, w: number, c: string, d: string, pages: boolean) => {
    p.rect(x, y, w, 1, c).rect(x, y + 1, w, 2, d);
    if (pages) p.rect(x + 1, y + 1, w - 2, 1, 'q').px(x + w - 1, y + 1, d);
    else p.px(x + 2, y + 1, 'Y').px(x + 2, y + 2, 'Y').px(x + w - 3, y + 1, 'Y').px(x + w - 3, y + 2, 'Y');
  };
  book(1, 16, 14, 'B', 'n', false);
  book(2, 13, 12, 'r', 'R', true);
  book(1, 10, 13, 'L', 'e', false);
  book(3, 7, 11, 'v', 'V', true);
  book(2, 4, 10, 'y', 'O', false);
  // an open book on top
  p.rect(3, 1, 5, 3, 'w').rect(8, 1, 5, 3, 'W').px(7, 1, 'g').px(8, 1, 'g').hl(4, 2, 3, 'g').hl(9, 2, 3, 'g');
  p.contour();
  return p.toString();
})();

/** A giant red plastic pencil sharpener (metal blade, ridged grip) and a pile of colourful shavings. */
const SHARPENER = (() => {
  const q = pix([24, 20]);
  q.stamp(String(box(18, 18, { top: 'r', hi: 'p', lip: 'R', front: 'r', shade: 'R', depth: 5 })), 0, 1);
  // ridged grip on the side
  for (const x of [12, 14]) q.vl(x, 9, 7, 'R');
  q.vl(13, 9, 7, 'p');
  // steel blade screwed on top
  q.rect(2, 3, 13, 2, 'W').hl(2, 3, 13, 'f').hl(2, 5, 13, 'G').disc(8, 3.5, 1.1, 'G').px(8, 3, 'g');
  // conical hole with its metal ring
  q.disc(6.5, 12, 3.6, 'g').disc(6.5, 12, 2.7, 'd').disc(6.5, 12, 1.5, 'i').px(5, 10, 'W').px(4, 11, 'W');
  // shavings: wavy wood curls with painted edges
  q.stamp(`
    ...kkkk.
    .kkQcBBk
    kcQccckk
    kBcckQck
    kQcrrcck
    .kkkkkk.
  `, 15, 13);
  q.stamp(`
    .kkk.
    kQcrk
    krcck
    .kkk.
  `, 19, 9);
  return q.toString();
})();

const ERASER_CRUMBS = (() => {
  const p = pix([16, 8]);
  for (const [x, y, w, c, d] of [[1, 2, 3, 'p', 'P'], [6, 4, 2, 'p', 'P'], [10, 1, 3, 'p', 'P'], [12, 5, 2, 'g', 'G'], [4, 6, 2, 'p', 'P']] as const)
    p.rect(x, y, w, 1, c).px(x + w - 1, y, d);
  p.contour();
  return p.toString();
})();

const EASEL = (() => {
  const p = pix([16, 28]);
  p.line(7, 1, 2, 26, 'C').line(8, 1, 13, 26, 'C').line(8, 2, 3, 26, 'c');
  p.vl(7, 2, 18, 'x');
  p.hl(2, 19, 12, 'C').hl(2, 20, 12, 'x');
  // canvas: a half-finished drawing of the moon and two children
  p.rect(2, 4, 12, 14, 'w').vl(2, 4, 14, 'f').hl(2, 17, 12, 'W').vl(13, 5, 13, 'W');
  p.disc(10, 7, 2, 'y').disc(11, 6.5, 1.5, 'w').px(9, 6, 'Y');
  p.vl(5, 12, 3, 'V').px(5, 11, 'h').vl(8, 13, 2, 'r').px(8, 12, 'm');
  p.line(4, 16, 11, 16, 'L').px(6, 13, 'k');
  p.px(3, 7, 'b').px(4, 8, 'b');
  p.contour();
  return p.toString();
})();

const DESK_BIG = (() => {
  const p = box(48, 24, { top: 'c', hi: 'Q', lip: 'C', front: 'C', shade: 'x', depth: 9 });
  for (const x of [3, 18, 33]) p.frame(x, 13, 12, 8, 'x').hl(x + 4, 16, 4, 'Q').hl(x + 1, 13, 10, 'c');
  // large sheet with a drawing, a ruler, a cup of pencils, an ink pot
  p.rect(4, 2, 18, 8, 'w').hl(5, 10, 18, 'C').vl(22, 3, 7, 'C').vl(4, 2, 8, 'f');
  p.line(6, 8, 10, 4, 'B').line(10, 4, 14, 7, 'B').disc(17, 4.5, 1.6, 'Y').hl(6, 9, 14, 'L').px(12, 6, 'r');
  p.rect(24, 6, 12, 2, 'y').hl(24, 7, 12, 'Y');
  for (const x of [26, 28, 30, 32, 34]) p.px(x, 6, 'O');
  p.stamp(`
    .r.b.y.
    .rkbkyk
    kRkBkYk
    kwwwwWk
    kwwwwWk
    kWWWWgk
    .kkkkk.
  `, 38, 0);
  p.stamp(`
    .kk.
    kiik
    knnk
    .kk.
  `, 31, 1);
  return p.toString();
})();

/** A child's drawing on the ground, its right half rubbed out. */
const DRAWING_ERASED = (() => {
  const p = pix([24, 20]);
  p.poly([[1, 3], [22, 1], [23, 17], [2, 19]], 'q');
  p.poly([[1, 3], [22, 1], [22.3, 4], [1.2, 5.5]], 'w');
  p.line(2, 18, 22, 16, 'Q').line(22, 2, 22, 16, 'Q');
  // the drawing: moon, Noa and Mina holding hands, grass
  p.disc(6, 6, 2.2, 'y').disc(7, 5.4, 1.6, 'q').px(5, 6, 'Y');
  p.px(7, 10, 'h').px(7, 11, 's').vl(7, 12, 3, 'V').px(6, 15, 'n').px(8, 15, 'n');
  p.px(10, 11, 'm').px(10, 12, 's').vl(10, 13, 2, 'r').px(9, 12, 'y').hl(8, 13, 2, 's');
  p.line(3, 16, 11, 15, 'L');
  // rubbed-out half: ghost strokes and eraser smears
  p.px(13, 12, 'g').px(14, 13, 'W').line(12, 15, 20, 14, 'W').px(16, 6, 'W').px(17, 7, 'g');
  for (const [y, x0, x1] of [[4, 12, 21], [7, 13, 20], [10, 12, 21], [13, 14, 21]] as const) p.line(x0, y, x1, y - 1, 'f');
  p.px(18, 10, 'p').px(19, 11, 'P').px(15, 16, 'p');
  p.contour();
  return p.toString();
})();

const FOREST: Record<string, SpriteDef> = {
  prop_pencil_r: withColors(pencil('6', 'r', 'R'), PENCIL_COLORS),
  prop_pencil_b: String(pencil('b', 'B', 'n')),
  prop_pencil_y: String(pencil('y', 'Y', 'O')),
  prop_pencil_g: String(pencil('L', 'e', 'E')),
  prop_pencil_v: String(pencil('v', 'V', 'u')),
  prop_crayon_rock: CRAYON_ROCK,
  prop_paper_house: PAPER_HOUSE,
  prop_bookstack: BOOKSTACK,
  prop_sharpener_big: SHARPENER,
  prop_eraser_crumbs: ERASER_CRUMBS,
  prop_easel: EASEL,
  prop_desk_big: DESK_BIG,
  prop_drawing_erased: DRAWING_ERASED,
};
for (const c of ['r', 'b', 'y', 'g'] as const) {
  FOREST[`prop_lantern_${c}_on`] = lantern(true, LANTERN_ON[c]);
  FOREST[`prop_lantern_${c}_off`] = withColors(lantern(false, LANTERN_OFF[c]), LANTERN_OFF_COLORS[c]);
}

// ---------------------------------------------------------------------------
// Paper Hospital — pale, cold, too clean
// ---------------------------------------------------------------------------

const HOSP_COLORS: Record<string, string> = {
  '6': mix(PAL.a!, PAL.g!, 0.45), // pale institutional green
  '7': mix(PAL.A!, PAL.G!, 0.5), // its shade
  '8': mix(PAL.b!, PAL.g!, 0.35), // pale blue plastic
  '9': mix(PAL.B!, PAL.G!, 0.5),
};

const H_BED = (() => {
  const p = pix([16, 32]);
  // metal head frame
  p.rect(1, 1, 14, 5, 'g').hl(1, 1, 14, 'W').hl(1, 5, 14, 'G');
  for (const x of [4, 7, 10, 13]) p.vl(x, 2, 3, 'G');
  // mattress, pillow, pale green blanket folded back
  p.rect(1, 6, 14, 22, 'W').vl(1, 6, 22, 'w');
  p.rect(3, 7, 10, 4, 'f').hl(3, 10, 10, 'W').px(12, 8, 'W');
  p.rect(1, 14, 14, 14, '6').hl(1, 13, 14, 'w').hl(1, 14, 14, 'f').vl(14, 15, 13, '7').hl(1, 27, 14, '7');
  p.px(4, 18, '7').px(9, 21, '7').px(6, 24, '7');
  // side rails
  p.vl(0, 12, 12, 'g').vl(15, 12, 12, 'G');
  // footboard with a chart
  p.rect(1, 28, 14, 3, 'g').hl(1, 28, 14, 'W').hl(1, 30, 14, 'G').rect(6, 27, 4, 3, 'q').hl(7, 28, 2, 'G');
  p.contour();
  p.px(1, 31, 'd').px(14, 31, 'd');
  return p.toString();
})();

const H_CHAIR = (() => {
  const p = pix([14, 16]);
  p.rect(2, 1, 10, 6, '8').hl(2, 1, 10, 'b').hl(2, 6, 10, '9').vl(11, 2, 5, '9');
  p.rect(1, 7, 12, 4, '8').hl(1, 7, 12, 'b').hl(1, 10, 12, '9').vl(12, 7, 4, '9');
  p.vl(2, 11, 4, 'g').vl(11, 11, 4, 'G').vl(4, 11, 3, 'G').vl(9, 11, 3, 'G');
  p.vl(3, 4, 3, 'g').vl(10, 4, 3, 'G');
  p.contour();
  return p.toString();
})();

const H_IV = (() => {
  const p = pix([10, 28]);
  p.rect(4, 3, 2, 21, 'g').vl(4, 3, 21, 'W');
  p.hl(1, 2, 8, 'g').px(1, 3, 'g').px(8, 3, 'g');
  // drip bag
  p.rect(5, 4, 4, 7, 'f').rect(5, 7, 4, 4, 'a').vl(8, 5, 6, 'b').px(6, 5, 'w').hl(6, 11, 2, 'g');
  p.line(7, 12, 6, 17, 'W').line(6, 17, 7, 20, 'W');
  // wheeled base
  p.hl(1, 24, 8, 'G').line(4, 24, 1, 26, 'G').line(5, 24, 8, 26, 'G').px(1, 26, 'd').px(8, 26, 'd').px(4, 26, 'd');
  p.contour();
  return p.toString();
})();

/** Heart monitor on a wheeled stand: the green trace scrolls and the heart light blinks. */
function monitor(f: number): string {
  const p = pix([16, 20]);
  p.rect(1, 1, 14, 11, 'g').hl(1, 1, 14, 'W').vl(14, 2, 10, 'G').hl(1, 11, 14, 'G');
  p.rect(2, 2, 10, 8, 'z').hl(2, 2, 10, 'j');
  const trace = f ? [7, 7, 7, 7, 7, 7, 4, 9, 6, 7] : [7, 4, 9, 6, 7, 7, 7, 7, 7, 7];
  trace.forEach((y, i) => p.px(2 + i, y, i === (f ? 9 : 4) ? 'l' : 'L'));
  if (f) p.vl(8, 5, 4, 'L');
  else p.vl(3, 5, 4, 'L');
  p.px(13, 3, f ? 'R' : 'r').px(13, 5, 'L').px(13, 7, 'b');
  p.rect(7, 12, 2, 5, 'G').vl(7, 12, 5, 'g');
  p.hl(3, 17, 10, 'G').px(3, 18, 'd').px(12, 18, 'd');
  p.contour();
  return p.toString();
}

const H_DESK = (() => {
  const p = box(32, 24, { top: 'W', hi: 'w', lip: 'g', front: '6', shade: '7', depth: 6 });
  p.hl(1, 8, 30, 'w').hl(1, 13, 30, 'a').hl(1, 14, 30, '7');
  for (const x of [8, 16, 24]) p.vl(x, 15, 7, '7');
  // computer seen from behind, papers, a bell
  p.stamp(`
    .kkkkkkk.
    kgggggGGk
    kgGGGGGGk
    kgGGGGGGk
    .kkkgkkk.
    ...kgk...
  `, 3, 0);
  p.rect(14, 3, 6, 3, 'f').hl(15, 4, 4, 'g').rect(16, 2, 5, 3, 'w').hl(17, 3, 3, 'g');
  p.stamp(`
    ..k..
    .kYk.
    kYyYk
    kkkkk
  `, 24, 1);
  return withColors(p, HOSP_COLORS);
})();

const H_PLANT = (() => {
  const p = pix([12, 20]);
  // (greens are recoloured paler and colder below)
  p.rect(2, 12, 8, 7, 'w').hl(2, 12, 8, 'f').vl(9, 12, 7, 'W').hl(2, 18, 8, 'g').hl(2, 13, 8, 'W');
  for (const [x0, y0, x1, y1] of [[5, 12, 3, 3], [6, 12, 6, 1], [7, 12, 9, 4], [5, 12, 1, 7], [7, 12, 10, 8]] as const) {
    p.line(x0, y0, x1, y1, 'e');
    p.line(x0 + 1, y0, x1 + 1, y1, 'E');
  }
  p.px(3, 3, 'L').px(6, 1, 'L').px(1, 7, 'L').px(9, 4, 'L').px(10, 8, 'G').px(10, 9, 'G');
  p.contour();
  return p.toString();
})();

const H_WHEELCHAIR = (() => {
  const p = pix([16, 16]);
  // push handles and backrest
  p.vl(3, 1, 8, 'g').vl(12, 1, 8, 'g').px(3, 1, 'd').px(12, 1, 'd');
  p.rect(4, 2, 8, 6, 'J').hl(4, 2, 8, '3').hl(4, 7, 8, 'j').vl(11, 3, 4, 'j');
  // seat
  p.rect(3, 8, 10, 3, 'J').hl(3, 8, 10, '3').hl(3, 10, 10, 'j');
  // big wheels seen from the front: dark tyres, pale rims
  for (const x of [0, 13]) {
    p.rect(x, 4, 3, 11, 'd').vl(x + 1, 5, 9, 'W').px(x + 1, 5, 'f').px(x + 1, 9, 'G').px(x + 1, 13, 'g');
  }
  // footrests and casters
  p.vl(5, 11, 3, 'G').vl(10, 11, 3, 'G').hl(4, 13, 3, 'g').hl(9, 13, 3, 'g').px(5, 14, 'd').px(10, 14, 'd');
  p.contour();
  return p.toString();
})();

/** Mina's drawings taped up in her room: the moon, a sheep (Dodo), the family. */
const H_DRAWINGS = (() => {
  const p = pix([24, 16]);
  p.rect(1, 2, 8, 10, 'n').vl(8, 3, 9, 'z').hl(1, 11, 8, 'z');
  p.disc(4.5, 6, 2.4, 'y').disc(5.6, 5.2, 1.9, 'n').px(2, 3, 'w').px(7, 9, 'w').px(6, 3, 'w');
  p.rect(9, 4, 8, 9, 'f').vl(16, 5, 8, 'W').hl(9, 12, 8, 'W');
  p.oval(13, 8, 2.6, 2, 'W').px(11, 7, 'd').px(12, 10, 'd').px(14, 10, 'd').px(15, 6, 'p').px(14, 6, 'P');
  p.rect(17, 1, 6, 9, 'q').vl(22, 2, 8, 'Q').hl(17, 9, 6, 'Q');
  p.px(18, 4, 'Q').vl(18, 5, 2, 'G').px(20, 4, 'h').vl(20, 5, 2, 'V').px(21, 6, 'm').px(21, 7, 'r').hl(18, 8, 4, 'L');
  p.px(19, 2, 'r').px(21, 2, 'r').px(20, 3, 'r');
  p.hl(3, 2, 3, 'W').hl(11, 4, 3, 'W').hl(18, 1, 3, 'W');
  p.contour();
  return p.toString();
})();

/** The moon nightlight, unplugged on the hospital table: dull, cord hanging. */
const H_NIGHTLIGHT = `
  .kk.....
  kWgk....
  kgk.....
  kgWk....
  .kkkk...
  kWWWgk..
  .kkkkGk.
  .....kGd
`;

const H_TABLE = (() => {
  const p = box(16, 16, { top: 'W', hi: 'w', lip: 'g', front: '6', shade: '7', depth: 5, legs: 2 });
  p.frame(3, 8, 10, 3, '7').hl(6, 9, 4, 'w');
  // a glass of water and a paper cup
  p.stamp(`
    .kk.
    kbfk
    kabk
    kaak
    .kk.
  `, 3, 0);
  p.stamp(`
    kkk
    kwk
    kWk
  `, 10, 2);
  return withColors(p, HOSP_COLORS);
})();

const H_BENCH = (() => {
  const p = pix([32, 12]);
  p.hl(1, 8, 30, 'G').hl(1, 9, 30, 'd');
  for (const x of [2, 12, 22]) {
    p.rect(x, 1, 8, 4, '8').hl(x, 1, 8, 'b').vl(x + 7, 2, 3, '9');
    p.rect(x, 5, 8, 3, '8').hl(x, 5, 8, 'b').vl(x + 7, 5, 3, '9').hl(x, 7, 8, '9');
  }
  p.vl(3, 10, 1, 'G').vl(28, 10, 1, 'G').vl(15, 10, 1, 'G');
  p.contour();
  return withColors(p, HOSP_COLORS);
})();

const HOSPITAL: Record<string, SpriteDef> = {
  prop_h_bed: withColors(H_BED, HOSP_COLORS),
  prop_h_chair: withColors(H_CHAIR, HOSP_COLORS),
  prop_h_iv: H_IV,
  prop_h_monitor: monitor(0),
  prop_h_monitor_2: monitor(1),
  prop_h_desk: H_DESK,
  prop_h_plant: withColors(H_PLANT, { e: mix(PAL.e!, PAL.g!, 0.45), E: mix(PAL.E!, PAL.G!, 0.4), L: mix(PAL.L!, PAL.W!, 0.3) }),
  prop_h_wheelchair: H_WHEELCHAIR,
  prop_h_drawings: H_DRAWINGS,
  prop_h_nightlight: H_NIGHTLIGHT,
  prop_h_table: H_TABLE,
  prop_h_bench: H_BENCH,
};

// ---------------------------------------------------------------------------
// The void / the end
// ---------------------------------------------------------------------------

/** A door of light standing in the void, light spilling on the floor. */
const DOOR_LIGHT = (() => {
  const p = pix([16, 32]);
  // arched frame
  p.rect(1, 5, 14, 25, 'w').disc(7.5, 6, 6.5, 'w').vl(14, 6, 24, 'W').vl(13, 4, 3, 'W');
  // the opening: white at the heart, warm towards the edges
  p.rect(3, 6, 10, 24, 'y').disc(7.5, 6.5, 4.6, 'y');
  p.rect(4, 7, 8, 23, 'q').disc(7.5, 7, 3.6, 'q');
  p.rect(6, 7, 4, 23, 'f').disc(7.5, 7.5, 2, 'f');
  // the door itself swung open towards us (left), its edge lit
  p.poly([[3, 6], [5.5, 8], [5.5, 31], [3, 30]], 'b').vl(5, 9, 21, 'f').vl(3, 7, 22, 'B').px(4, 19, 'Y');
  p.contour();
  // light spilling on the floor
  p.poly([[4, 30], [12, 30], [15.5, 32], [0.5, 32]], 'q');
  p.hl(6, 30, 5, 'f').hl(3, 31, 10, 'y').px(7, 31, 'f').px(8, 31, 'f');
  return p.toString();
})();

/** Dodo, immense: a plush sheep made of wool puffs, button eyes, pink bow, stitched smile. */
const DODO_GIANT = (() => {
  const p = pix([48, 48]);
  // feet
  for (const fx of [13, 29]) p.rect(fx, 40, 7, 6, 'G').hl(fx, 40, 7, 'g').hl(fx, 45, 7, 'd').vl(fx + 6, 41, 4, 'd');
  // woolly body
  puffs(p, [
    [24, 9, 8, T_WOOL],
    [13, 13, 8, T_WOOL],
    [35, 13, 8, T_WOOL],
    [8, 23, 7, T_WOOL],
    [40, 23, 7, T_WOOL],
    [24, 20, 12, T_WOOL],
    [12, 32, 8, T_WOOL],
    [36, 32, 8, T_WOOL],
    [24, 33, 10, T_WOOL],
  ]);
  // ears
  for (const [ex, dir] of [[9, -1], [39, 1]] as const) {
    p.oval(ex, 22, 4, 2.6, 'G').oval(ex + dir * 0.5, 21.6, 2.6, 1.4, 'p');
  }
  // face
  p.oval(24, 22, 10, 8.5, 'G').oval(23.6, 21.6, 9, 7.6, 'g').oval(22, 19, 5, 3, 'W');
  // button eyes with a thread cross and a glint
  for (const ex of [19, 29]) {
    p.disc(ex, 21, 2.6, 'i').px(ex - 1, 20, 'f').px(ex, 21, 'K').px(ex + 1, 22, 'K');
  }
  // cheeks, nose and a stitched smile
  p.hl(15, 25, 2, 'p').hl(31, 25, 2, 'p');
  p.rect(23, 24, 2, 1, 'P');
  p.px(20, 26, 'd').px(21, 27, 'd').hl(22, 28, 4, 'd').px(26, 27, 'd').px(27, 26, 'd');
  p.px(22, 27, 'G').px(24, 29, 'G').px(26, 29, 'G');
  // seam with stitches down the belly
  for (let y = 33; y < 41; y += 2) p.px(24, y, 'g').px(23, y + 1, 'G');
  p.contour();
  // pink bow on the head
  p.stamp(`
    .kk...kk.
    kppk.kppk
    kpPpkpPpk
    kpPPpPPpk
    kpPpkpPpk
    kppk.kppk
    .kk...kk.
  `, 30, 2);
  p.px(34, 5, 'P');
  return p.toString();
})();

const VOID_PROPS: Record<string, SpriteDef> = {
  prop_door_light: DOOR_LIGHT,
  prop_dodo_giant: DODO_GIANT,
};

// ---------------------------------------------------------------------------
// Real world — the long night (Interludes III « Le sac », 4:06, and IV « Le placard », 4:44)
// ---------------------------------------------------------------------------

/** Headphones left on the desk, the cord wound round the headband so tight it split the plastic. */
const CASQUE = `
  ..kkkkkkkk..
  .kdwdwdwdwk.
  kdkkkkkkkkdk
  kGk......kGk
  kGGk....kGGk
  kdGk....kGdk
  .kk......kkw
  ..........kw
`;

/** Noa's desk with the right-hand drawer pulled out a finger's width: scraps of glossy paper in the gap. */
const DESK_DRAWER = (() => {
  const p = pix(DESK);
  p.rect(18, 16, 12, 2, 'i').hl(18, 16, 12, 'K');
  p.px(20, 17, 'w').px(21, 17, 'q').px(24, 17, 's').px(25, 17, 'w').px(27, 17, 'Q');
  p.rect(17, 18, 14, 4, 'C').frame(17, 18, 14, 4, 'x').hl(18, 18, 12, 'c').hl(22, 19, 4, 'Q');
  return p.toString();
})();

/** The wall above the bed, worn paler at pillow height: a round patch, as if someone had knocked there. Often. */
const MUR_USE = (() => {
  const p = pix([12, 10]);
  p.oval(5.5, 4.5, 5, 4, '3').oval(5.5, 4.5, 3.4, 2.6, '4');
  p.sprinkle('4', '3', 0.3, 7).sprinkle('3', '1', 0.25, 9);
  p.px(5, 4, 'g').px(6, 5, 'g').px(4, 5, '3');
  return p.toString();
})();

/** Grey tufts of stuffing on the floor (Dodo's back seam gave way in the night). */
const COTON = `
  ..kkk...
  .kwWgk..
  kWwwWgkk
  kgWWggGk
  .kkkkkk.
`;
const COTON_2 = `
  .kk.kk..
  kwWkwgk.
  kgWwWgGk
  .kkkkkk.
`;

/** Dodo with his back seam open: grey stuffing puffs out behind him, a loose red thread hangs down. */
const DODO_PLUSH_DECOUSU = (() => {
  const p = pix([16, 14]);
  p.stamp(DODO_PLUSH, 1, 2);
  // stuffing bulging from the back, on the right and over the top
  p.stamp(`
    ..kkk.
    .kwWgk
    kWwwgGk
    kgWWGk.
    .kkkk..
  `, 9, 6);
  p.stamp(`
    .kk..
    kwgk.
    kWwGk
    .kkk.
  `, 10, 0);
  p.px(13, 11, 'r').px(13, 12, 'r').px(14, 13, 'R');
  return p.toString();
})();

/** The nightlight cracked from one edge of the moon to the other (chapter 4, the Petit Homme beaten). */
const VEILLEUSE_FELE = (() => {
  const p = pix(VEILLEUSE);
  p.px(4, 1, 'd').px(3, 2, 'G').px(3, 3, 'd').px(2, 4, 'G').px(3, 5, 'd').px(4, 6, 'G').px(5, 6, 'd');
  return p.toString();
})();

/** A shoe box, lid off: little papers inside, flattened and stacked by date (the forty-one fridge notes). */
const BOITE_CHAUSSURES = (() => {
  const p = box(16, 10, { top: 'x', hi: 'C', lip: 'Q', front: 'c', shade: 'C', depth: 4 });
  for (let i = 0; i < 7; i++) p.rect(2 + i * 2, 1 + (i % 2), 2, 4 - (i % 2), i % 3 === 1 ? 'y' : i % 3 === 2 ? 'q' : 'w');
  p.vl(3, 1, 4, 'W').vl(9, 2, 3, 'Q').px(6, 2, 'r');
  p.hl(4, 7, 8, 'C').px(5, 7, 'x').px(9, 7, 'x');
  return p.toString();
})();

/** The nightlight's original box, worn at the corners, a moon printed on the front. */
const BOITE_VEILLEUSE = (() => {
  const p = box(12, 12, { top: 'q', hi: 'w', lip: 'Q', front: 'c', shade: 'C', depth: 2 });
  p.disc(5.5, 7, 2.6, 'y').disc(6.6, 6.2, 2, 'c').px(4, 6, 'q').px(3, 8, 'Y');
  p.px(8, 5, 'w').px(9, 9, 'q');
  p.px(1, 1, '.').px(10, 10, 'C');
  return p.toString();
})();

/** A digital thermometer that fell out of a coat pocket. */
const THERMOMETRE = `
  .kkkkkkkk.
  kwwkdadkwkk
  kWWkkkkkWWk
  .kkkkkkkk..
`;

/** The entrance cupboard, painted like the walls. `open` = ajar on the dark, a coat sleeve and a bag strap. */
function placardEntree(open: boolean): string {
  const p = box(24, 32, { top: 'W', hi: 'w', lip: 'G', front: 'g', shade: 'G', depth: 2 });
  p.hl(1, 4, 22, 'W').hl(1, 5, 22, 'G');
  p.frame(3, 7, 18, 23, 'G').frame(5, 9, 14, 8, 'G').frame(5, 19, 14, 9, 'G');
  p.hl(6, 10, 12, 'W').vl(6, 10, 6, 'W').hl(6, 20, 12, 'W').vl(6, 20, 7, 'W');
  p.rect(17, 17, 2, 2, 'Y').px(17, 17, 'y');
  if (open) {
    p.rect(9, 7, 12, 23, 'i').hl(9, 7, 12, 'K');
    // the door swung out to the right, seen edge-on
    p.rect(19, 6, 4, 25, 'g').vl(19, 6, 25, 'W').vl(22, 6, 25, 'G').vl(23, 6, 25, 'k');
    // a winter coat sleeve, and the strap of a bag with a white tag
    p.poly([[9, 8], [13, 8], [12.5, 20], [9, 20]], 'd').vl(10, 9, 10, 'G').px(11, 20, 'G');
    p.line(14, 9, 15, 22, 'n').line(15, 9, 16, 22, 'B');
    p.rect(14, 22, 4, 3, 'w').px(17, 24, 'W').px(15, 23, 'G');
    p.px(17, 12, 'G').hl(15, 11, 3, 'G');
  }
  return p.toString();
}

/** A navy sports bag. `open`: unzipped, a paper crown and pink slippers inside; a hospital tag on the handle. */
function sacHopital(open: boolean): string {
  const p = pix([24, 14]);
  p.oval(12, 8.5, 11, 5, 'n').oval(11, 7.5, 9.5, 3.6, 'B').oval(12, 9.5, 10.5, 3.5, 'n');
  p.hl(3, 12, 18, 'z').hl(5, 13, 14, 'z');
  // handle and tag
  p.line(8, 4, 10, 1, 'z').hl(10, 1, 5, 'z').line(15, 1, 17, 4, 'z');
  p.rect(16, 1, 5, 4, 'w').px(20, 4, 'W').hl(17, 2, 3, 'G').px(17, 3, 'G');
  if (open) {
    p.oval(12, 7, 7.5, 2.2, 'i').hl(5, 6, 15, 'G');
    // crown and slippers poking out
    p.hl(7, 6, 5, 'Y').px(7, 5, 'y').px(9, 5, 'y').px(11, 5, 'y').px(8, 6, 'r');
    p.oval(15.5, 6.5, 2.2, 1.2, 'p').px(16, 6, 'w').px(14, 5, 'P');
  } else {
    p.hl(4, 7, 16, 'z').px(19, 7, 'g').px(20, 8, 'g');
  }
  p.contour();
  return p.toString();
}

/** A small framed photo on the hallway wall: a little boy hugging a white sheep bigger than him. */
const PHOTO_BEBE = (() => {
  const p = pix([12, 14]);
  p.rect(1, 1, 10, 12, 'c').hl(1, 1, 10, 'Q').vl(1, 1, 12, 'Q').vl(10, 2, 11, 'C').hl(1, 12, 10, 'x');
  p.rect(2, 2, 8, 10, 'q').rect(2, 2, 8, 6, 'b').rect(2, 9, 8, 3, 'l');
  // the sheep (big, white) and the boy behind it, arms around it
  p.oval(5, 7.5, 3.2, 2.6, 'w').px(3, 6, 'W').px(2, 7, 'd').px(3, 10, 'd').px(6, 10, 'd');
  p.rect(7, 4, 2, 2, 'h').rect(7, 6, 2, 1, 's').px(8, 6, 'S').rect(7, 7, 2, 3, 'V').hl(6, 8, 2, 's');
  p.contour();
  return p.toString();
})();

/** Maman's bed, unmade (she sleeps in the day now): two pillows, a little folded pyjama on the second one. */
const LIT_MAMAN = (() => {
  const p = pix([32, 32]);
  // headboard
  p.rect(0, 0, 32, 7, 'k').rect(1, 1, 30, 5, 'c').hl(1, 1, 30, 'Q').hl(1, 5, 30, 'x').vl(30, 2, 4, 'C');
  for (const x of [5, 15, 25]) p.rect(x, 2, 2, 3, 'C');
  // mattress and sheet
  p.rect(0, 6, 32, 24, 'k').rect(1, 7, 30, 22, 'W');
  // pillows
  p.rect(2, 7, 12, 6, 'w').hl(2, 12, 12, 'g').vl(13, 8, 5, 'g').px(4, 8, 'f');
  p.rect(17, 7, 12, 6, 'w').hl(17, 12, 12, 'g').vl(28, 8, 5, 'g');
  p.rect(20, 8, 6, 4, 'b').hl(20, 11, 6, 'B').px(21, 9, 'y').px(24, 10, 'y').px(23, 8, 'q');
  // duvet thrown back to one side, crumpled (folds)
  p.poly([[1, 15], [12, 13], [31, 16], [31, 29], [1, 29]], 'p');
  p.poly([[1, 15], [12, 13], [14, 15], [3, 18]], 'P');
  p.line(4, 20, 14, 18, 'P').line(10, 24, 22, 21, 'P').line(18, 27, 29, 24, 'P').line(22, 18, 30, 19, 'P');
  p.line(5, 21, 13, 19, 'q').line(11, 25, 20, 22, 'q');
  p.vl(30, 17, 12, 'P').hl(1, 28, 30, 'P');
  // footboard
  p.rect(0, 29, 32, 3, 'k').rect(1, 29, 30, 2, 'C').hl(1, 29, 30, 'c');
  p.px(0, 0, '.').px(31, 0, '.').px(0, 31, '.').px(31, 31, '.');
  return p.toString();
})();

/** Maman's old wind-up alarm clock: two bells, the hands at a quarter to five. `tick` moves the seconds hand. */
function reveilVieux(tick: boolean): string {
  const p = pix([11, 12]);
  p.disc(2, 2, 1.8, 'R').disc(8, 2, 1.8, 'R').px(1, 1, 'r').px(7, 1, 'r');
  p.hl(4, 1, 3, 'G');
  p.disc(5, 6.5, 4.6, 'k').disc(5, 6.5, 3.6, 'w').px(3, 4, 'f');
  p.vl(5, 3, 4, 'd').line(5, 6, 3, 8, 'd');
  p.px(7, 4, 'r').px(6, 5, 'r');
  if (tick) p.px(8, 7, 'R');
  else p.px(5, 9, 'R');
  p.px(2, 11, 'k').px(8, 11, 'k');
  p.contour();
  return p.toString();
}

/** The yellow post-it: « 5h — veilleuse (chambre de Noa) », in Maman's hurried handwriting. */
const POSTIT = `
  kkkkkkk
  kyyyyYk
  kydydYk
  kyddyYk
  kydyyYk
  kYYYYQk
  kkkkkk.
`;

/** Maman's sewing box, open: spools of red thread, a tomato pincushion bristling with pins, a seam ripper. */
const BOITE_COUTURE = (() => {
  const p = box(16, 11, { top: 'x', hi: 'C', lip: 'c', front: 'C', shade: 'x', depth: 5 });
  for (const x of [2, 5, 8]) p.rect(x, 1, 2, 4, 'r').hl(x, 1, 2, 'p').vl(x + 1, 2, 3, 'R');
  p.disc(12, 3, 2, 'r').px(11, 2, 'p').px(12, 0, 'g').px(13, 1, 'g').px(10, 1, 'g').px(14, 3, 'g').px(12, 1, 'w');
  p.line(3, 6, 7, 6, 'g').px(8, 5, 'g').px(8, 7, 'g');
  p.hl(5, 8, 6, 'c');
  return p.toString();
})();

/** « Mon doudou qui parle ! — 2 pistes »: a small cardboard box, a sheep and a speech bubble printed on it. */
const KIT_VOCAL = (() => {
  const p = box(14, 12, { top: 'w', hi: 'f', lip: 'W', front: 'b', shade: 'B', depth: 2 });
  p.oval(5, 7.5, 2.5, 2, 'w').px(3, 7, 'd').px(4, 9, 'd').px(6, 9, 'd');
  p.rect(8, 4, 4, 3, 'w').px(9, 7, 'w').px(9, 5, 'r').px(10, 5, 'r');
  p.hl(2, 4, 4, 'y');
  return p.toString();
})();

/** A little mouse-shaped box: « Dents de Noa ». */
const BOITE_DENTS = `
  ..kk......
  .kgGk.....
  .kGkkkkk..
  kpgggggGk.
  kkgWgggGkk
  .kGGGGGk.k
  ..kkkkk...
`;

/** Maman's chest of drawers, the top drawer ajar on folded papers and envelopes. */
const COMMODE = (() => {
  const p = box(32, 24, { top: 'c', hi: 'Q', lip: 'Q', front: 'C', shade: 'x', depth: 4, legs: 2, legW: 3 });
  for (const y of [7, 12, 17]) p.frame(2, y, 28, 5, 'x').hl(13, y + 2, 6, 'c');
  p.rect(2, 6, 28, 2, 'i').px(5, 6, 'w').px(6, 6, 'w').px(9, 7, 'q').px(14, 6, 'w').px(15, 6, 'W').px(22, 6, 'b').px(26, 7, 'w');
  return p.toString();
})();

/** The mirror of Maman's room with a child's drawing taped in the corner: a little girl, a finger to her lips. */
const MIROIR_DESSIN = (() => {
  const p = pix(MIRROR);
  p.rect(1, 9, 8, 10, 'k').rect(2, 10, 6, 8, 'f').vl(7, 11, 7, 'W');
  p.rect(3, 11, 3, 2, 'm').px(4, 13, 's').px(3, 13, 's').px(5, 13, 's').rect(3, 14, 3, 3, 'r');
  p.px(4, 13, 'k').px(4, 12, 's');
  p.hl(2, 17, 5, 'd');
  p.px(2, 10, 'Q').px(7, 10, 'Q');
  return p.toString();
})();

/** A laundry basket: Maman's work blouse, and a small sock that has no pair. */
const PANIER = (() => {
  const p = box(14, 11, { top: 'w', hi: 'f', lip: 'Q', front: 'c', shade: 'C', depth: 3 });
  for (let y = 5; y < 9; y += 2) for (let x = 2; x < 12; x += 2) p.px(x + ((y >> 1) % 2), y, 'C');
  p.rect(2, 1, 6, 2, 'a').px(9, 1, 'p').px(10, 2, 'p').px(10, 1, 'P');
  return p.toString();
})();

/** The old cast-iron radiator, painted cream; its pipe climbs into the wall towards Mina's room. It knocks as it cools. */
const RADIATEUR = (() => {
  const p = pix([16, 20]);
  p.rect(12, 0, 2, 6, 'g').vl(12, 0, 6, 'W').vl(13, 0, 6, 'G').hl(11, 5, 4, 'G');
  p.rect(1, 6, 14, 12, 'Q');
  for (let x = 2; x < 14; x += 3) p.rect(x, 6, 2, 12, 'q').vl(x + 1, 7, 10, 'c').px(x, 6, 'w');
  p.hl(1, 6, 14, 'w').hl(1, 17, 14, 'c').hl(1, 12, 14, 'c');
  p.rect(2, 18, 2, 2, 'C').rect(12, 18, 2, 2, 'C');
  p.px(14, 8, 'O').px(13, 9, 'x');
  p.contour();
  return p.toString();
})();

const NIGHT: Record<string, SpriteDef> = {
  prop_radiateur: RADIATEUR,
  prop_casque: CASQUE,
  prop_desk_tiroir: DESK_DRAWER,
  prop_mur_use: MUR_USE,
  prop_coton: COTON,
  prop_coton_2: COTON_2,
  prop_dodo_plush_decousu: DODO_PLUSH_DECOUSU,
  prop_veilleuse_fele: VEILLEUSE_FELE,
  prop_boite_chaussures: BOITE_CHAUSSURES,
  prop_boite_veilleuse: BOITE_VEILLEUSE,
  prop_thermometre: THERMOMETRE,
  prop_placard_entree: placardEntree(false),
  prop_placard_entree_ouvert: placardEntree(true),
  prop_sac_hopital: sacHopital(false),
  prop_sac_hopital_ouvert: sacHopital(true),
  prop_photo_bebe: PHOTO_BEBE,
  prop_lit_maman: LIT_MAMAN,
  prop_reveil_vieux: reveilVieux(false),
  prop_reveil_vieux_2: reveilVieux(true),
  prop_postit: POSTIT,
  prop_boite_couture: BOITE_COUTURE,
  prop_kit_vocal: KIT_VOCAL,
  prop_boite_dents: BOITE_DENTS,
  prop_commode: COMMODE,
  prop_miroir_dessin: MIROIR_DESSIN,
  prop_panier: PANIER,
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  ...BEDROOM,
  ...HOME,
  ...DREAM,
  ...FOREST,
  ...HOSPITAL,
  ...VOID_PROPS,
  ...NIGHT,
};

export const VARIANTS: string[] = ['real', 'ink'];


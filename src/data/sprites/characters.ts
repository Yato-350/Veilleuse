import type { CharDef, SpriteDef } from '../../game/assets';

// Walking characters (16x24) and portraits (32x32). See docs/CONTENT_CONTRACT.md.

// ---------------------------------------------------------------------------------------------------------------------
// Helpers: frames are assembled from blocks of rows so that walk cycles share the exact same head/body art.
// ---------------------------------------------------------------------------------------------------------------------

/** Splits template art into rows (strips blank edges and common indentation, like the engine). */
function rows(src: string): string[] {
  const lines = src.replace(/\r/g, '').split('\n');
  while (lines.length && lines[0]!.trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
  return lines.map((l) => l.slice(indent).trimEnd());
}

/** Stacks blocks of art vertically. */
const stack = (...parts: string[]): string => parts.flatMap(rows).join('\n');

/** Replaces some rows of a block (row index → new row). */
const patch = (src: string, edits: Record<number, string>): string =>
  rows(src).map((r, i) => edits[i] ?? r).join('\n');

/** A fully transparent row of the given width. */
const blank = (w = 16): string => '.'.repeat(w);

// ---------------------------------------------------------------------------------------------------------------------
// NOA — 14 ans, cheveux indigo en bataille, grand sweat lavande, short marine.
// Walk frames: stand = [blank, upper, legs(3)] ; steps = [upper raised 1px, legs(4)] → visible bob.
// ---------------------------------------------------------------------------------------------------------------------

const NOA_DOWN_UPPER = `
  ........kk......
  ....kkkkhhk.k...
  ..kkhhhhhhhkhk..
  .khhhJJhhhhhhhk.
  khhhJJhhhhhhhhhk
  khhhhhhhhhhhhhhk
  kHhhhhhhhhhhhhHk
  kHhhHhhhHhhhHhHk
  kHHsHhsHHhsHhHHk
  kHHsskssssksSHHk
  .kHsskssssksSHk.
  ..kSsssstsssSk..
  ...kkSSSSSSkk...
  ...kvvuSSuvvk...
  ..kvvVwuuwVvvk..
  .kvVuvwvvwvuVvk.
  .kvVuvvvvvvuVvk.
  .kVVuVvvvvVuVVk.
  .kssuVVVVVVussk.
  .kkknnnnnnnnkkk.
`;

const NOA_DOWN_LEGS = `
  ....knnkknnk....
  ....ksk..ksk....
  ...kddk..kddk...
`;
const NOA_DOWN_LEGS_1 = `
  ....knnkknnk....
  ....ksk..ksk....
  ....ksk..kddk...
  ...kddk.........
`;
const NOA_DOWN_LEGS_2 = `
  ....knnkknnk....
  ....ksk..ksk....
  ...kddk..ksk....
  .........kddk...
`;

const NOA_UP_UPPER = `
  ........kk......
  ....kkkkhhk.k...
  ..kkhhhhhhhkhk..
  .khhhhhhhJJhhhk.
  khhhhhhhJJhhhhhk
  khhhhhhhhhhhhhhk
  kHhhhhhhhhhhhhHk
  kHhhhhhhhhhhhhHk
  kHHhhhhhhhhhhHHk
  kHHhhhHhhHhhhHHk
  .kHHHhHHHHhHHHk.
  ..kHHkHHHHkHHk..
  ...kkSkHHkSkk...
  ...kvvvvvvvvk...
  ..kvVvvvvvvVvk..
  .kvVuVvvvvVuVvk.
  .kvVuuVVVVuuVvk.
  .kVVuvvvvvvuVVk.
  .kssuVVVVVVussk.
  .kkknnnnnnnnkkk.
`;

const NOA_LEFT_UPPER = `
  ..........kk....
  .....kkkkkhhk...
  ...kkhhhhhhhhk..
  ..khhJJhhhhhhhk.
  .khhJhhhhhhhhhhk
  khhhhhhhhhhhhhhk
  kHhhhhhhhhhhhhhk
  kHhHhhhHhhhhhhHk
  kHsHsshHhhhhhhHk
  kssskssHhhhhhHHk
  .kssssSHhhhhHHk.
  .kSsstSSHHHHHk..
  ..kkSSSkkkkkk...
  ....kvvvvvvvk...
  ...kvwvvvvvvVk..
  ...kvwvVvvvvVk..
  ...kvvvuvvvVVk..
  ...kVvvuvvVVVk..
  ...kVVksVVVVVk..
  ....kknnnnnkk...
`;
const NOA_LEFT_LEGS = `
  .....knnnnk.....
  ......kssk......
  .....kdddk......
`;
const NOA_LEFT_LEGS_1 = `
  .....knnnnnk....
  ....ksk..ksk....
  ...ksk....ksk...
  ..kddk....kddk..
`;
const NOA_LEFT_LEGS_2 = `
  .....knnnnnk....
  .....kskksk.....
  .....ksk.ksk....
  ....kddk.kddk...
`;

const NOA_DOWN = [
  stack(blank(), NOA_DOWN_UPPER, NOA_DOWN_LEGS),
  stack(NOA_DOWN_UPPER, NOA_DOWN_LEGS_1),
  stack(NOA_DOWN_UPPER, NOA_DOWN_LEGS_2),
];
const NOA_UP = [
  stack(blank(), NOA_UP_UPPER, NOA_DOWN_LEGS),
  stack(NOA_UP_UPPER, NOA_DOWN_LEGS_2),
  stack(NOA_UP_UPPER, NOA_DOWN_LEGS_1),
];
const NOA_LEFT = [
  stack(blank(), NOA_LEFT_UPPER, NOA_LEFT_LEGS),
  stack(NOA_LEFT_UPPER, NOA_LEFT_LEGS_1),
  stack(NOA_LEFT_UPPER, NOA_LEFT_LEGS_2),
];

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const CHARS: Record<string, CharDef> = {
  noa: { down: NOA_DOWN, up: NOA_UP, left: NOA_LEFT, variants: ['real', 'ink'] },
};

void patch;

export const ART: Record<string, SpriteDef> = {};

export const VARIANTS: string[] = ['real', 'ink'];

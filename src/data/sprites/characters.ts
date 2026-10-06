import type { CharDef, SpriteDef } from '../../game/assets';

// Walking characters (16x24) and portraits (32x32). See docs/CONTENT_CONTRACT.md.

const NOA_STAND = `
....kkkkkkkk....
...khhhhhhhhk...
..khhhhhhhhhhk..
.khhhhhhhhhhhhk.
.khhhhhhhhhhhhk.
.khHhhhHHhhhHhk.
.kHhHsHhhHsHhHk.
.kHhssssssssHhk.
.khsskssssksshk.
..kssssssssssk..
..kSssssttsssk..
...kkSssssSkk...
..kvvkkkkkkvvk..
.kvvvvvwwvvvvvk.
.kvVvvvwwvvvVvk.
.ksVvvvvvvvvVsk.
.kskvvvvvvvvksk.
..kkVVVVVVVVkk..
...knnnnnnnnk...
....knnkknnk....
....knnk.knnk...
....kssk.kssk...
....kkkk.kkkk...
................
`;

export const CHARS: Record<string, CharDef> = {
  noa: { down: [NOA_STAND, NOA_STAND, NOA_STAND], up: [NOA_STAND, NOA_STAND, NOA_STAND], left: [NOA_STAND, NOA_STAND, NOA_STAND], variants: ['real', 'ink'] },
};

export const ART: Record<string, SpriteDef> = {};

export const VARIANTS: string[] = [];

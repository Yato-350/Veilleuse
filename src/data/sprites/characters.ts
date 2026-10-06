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
  kHHsHHssssHHSHHk
  .kHskksssskkSHk.
  ..kSssssstssSk..
  ...kkSSSSSSkk...
  ...kvvuSSuvvk...
  ..kvVvvuuvvVvk..
  .kvVuvwvvwvuVvk.
  .kvVuvwvvwvuVvk.
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
  ..kVvvvvvvvvVk..
  .kvVuvvvvvvuVvk.
  .kvVuuvvvvuuVvk.
  .kVVuVuuuuVuVVk.
  .kssuVVVVVVussk.
  .kkknnnnnnnnkkk.
`;

const NOA_LEFT_UPPER = `
  .........kk.....
  .....kkkkhhkk...
  ...kkhhhhhhhhkk.
  ..khhhJJhhhhhhk.
  .khhhJhhhhhhhhhk
  .khhhhhhhhhhhhhk
  khhhhhhhhhhhhhhk
  kHhHhhHhhhhhhhHk
  kHsHssHHhhhhhhHk
  kHsHHsHHhhhhhHHk
  ksskksSHhhhhhHHk
  .kssssSHHhhhHHk.
  ..kkSSkkHHHHkk..
  .....kvvvvvkk...
  ....kvvvvvvvVk..
  ....kvvuvvvuVk..
  ....kvvuvvvuVk..
  ....kVVuvvvuVk..
  ....kVVkssskVk..
  .....kknnnnkk...
`;
const NOA_LEFT_LEGS = `
  .....knnnnk.....
  ......kssk......
  .....kdddk......
`;
const NOA_LEFT_LEGS_1 = `
  .....knnnnk.....
  ....ksk..kSk....
  ...ksk....kSk...
  ..kddk....kKKk..
`;
const NOA_LEFT_LEGS_2 = `
  .....knnnnk.....
  ....kSk..ksk....
  ...kSk....ksk...
  ..kKKk....kddk..
`;

const NOA_DOWN = [
  stack(blank(), NOA_DOWN_UPPER, NOA_DOWN_LEGS),
  patch(stack(NOA_DOWN_UPPER, NOA_DOWN_LEGS_1), { 0: '.........kk.....', 18: '.kVVuVVVVVVussk.' }),
  patch(stack(NOA_DOWN_UPPER, NOA_DOWN_LEGS_2), { 0: '.......kk.......', 18: '.kssuVVVVVVuVVk.' }),
];
const NOA_UP = [
  stack(blank(), NOA_UP_UPPER, NOA_DOWN_LEGS),
  patch(stack(NOA_UP_UPPER, NOA_DOWN_LEGS_2), { 0: '.........kk.....', 18: '.kVVuVVVVVVussk.' }),
  patch(stack(NOA_UP_UPPER, NOA_DOWN_LEGS_1), { 0: '.......kk.......', 18: '.kssuVVVVVVuVVk.' }),
];
const NOA_LEFT = [
  stack(blank(), NOA_LEFT_UPPER, NOA_LEFT_LEGS),
  patch(stack(NOA_LEFT_UPPER, NOA_LEFT_LEGS_1), {
    0: '..........kk....',
    14: '....kvvuvvvvVk..',
    15: '....kvuvvvuvVk..',
    16: '....kuvvvuvVVk..',
    17: '...kssskkVVVVk..',
    18: '....kkkVVVVVVk..',
  }),
  patch(stack(NOA_LEFT_UPPER, NOA_LEFT_LEGS_2), {
    0: '........kk......',
    14: '....kvvvuvvvuk..',
    15: '....kvvvvuvvvuk.',
    16: '....kVVVVuvvvuk.',
    17: '....kVVVVVkssskk',
    18: '.....kkkkkkkkk..',
  }),
];

// ---------------------------------------------------------------------------------------------------------------------
// MINA — 8 ans, plus petite (~20 px) : couettes rousses, couronne de papier, cape rouge, robe blanche.
// ---------------------------------------------------------------------------------------------------------------------

const MINA_DOWN_UPPER = `
  .....k.kk.k.....
  ....kykyykyk....
  ....kyyyyyyk....
  ...kmYYYYYYmk...
  ..kmmmmmmmmmmk..
  ..kmmmmmmmmmMk..
  .kkmmmmmmmmmmkk.
  kmpmmmmmmmmmmpMk
  kmpmsksssskSmpMk
  kMkmskssssksMkMk
  .kkmpssttsspMkk.
  ...kkSSSSSSkk...
  ...krrkyykrrk...
  ..krRswwwwsRrk..
  .krRkwwwwwwkRrk.
  .krRswwwwwWsRrk.
  .kRRkWWWWWWkRRk.
  ..kkkkkkkkkkkk..
`;
const MINA_UP_UPPER = `
  .....k.kk.k.....
  ....kykyykyk....
  ....kyyyyyyk....
  ...kmYYYYYYmk...
  ..kmmmmmmmmmmk..
  ..kmmmmmmmmmMk..
  .kkmmmmmmmmmmkk.
  kmpmmmmmmmmmmpMk
  kmpmmmmmmmmmMpMk
  kMkMmmmmmmmMMkMk
  .kkkMMMMMMMMkkk.
  ...kkkSSSSkkk...
  ...krrrrrrrrk...
  ..krrrrrrrrrrk..
  .krrrRrrrrRrRrk.
  .ksrrRrrrrRrRsk.
  .kRrrRrrrrRrRRk.
  ..kkkkkkkkkkkk..
`;
const MINA_LEFT_UPPER = `
  ......k.kk.k....
  .....kykyykyk...
  .....kyyyyyyk...
  ....kmYYYYYYmk..
  ...kmmmmmmmmmmk.
  ..kmmmmmmmmmmMk.
  .kmmmmmmmmmmMMkk
  .kmmmmmmmmMMMpmk
  .kssksssmmMMkmMk
  .kssksssSmMMkmMk
  ..kppssSSMMkkMMk
  ...kkkkkkkk.kkk.
  ....kryyrrrk....
  ...kwwwkrrrrk...
  ...kwwskrrrrk...
  ...kwwwkRrrrrk..
  ...kWWWkRRrrRk..
  ....kkkkkkkkkk..
`;

const MINA_DOWN_LEGS = `
  ....ksskkssk....
  ....ksskkssk....
  ...kxxxkkxxxk...
`;
const MINA_DOWN_LEGS_1 = `
  ....ksskkssk....
  ....ksskkssk....
  ....ksskkxxxk...
  ...kxxxk........
`;
const MINA_DOWN_LEGS_2 = `
  ....ksskkssk....
  ....ksskkssk....
  ...kxxxkkssk....
  ........kxxxk...
`;
const MINA_LEFT_LEGS = `
  .....kssk.......
  .....kssk.......
  ....kxxxk.......
`;
const MINA_LEFT_LEGS_1 = `
  .....kssk.......
  ....kskkSk......
  ...kskk.kSk.....
  ..kxxxk.kKKk....
`;
const MINA_LEFT_LEGS_2 = `
  .....kssk.......
  ....kSkksk......
  ...kSkk.ksk.....
  ..kKKKk.kxxk....
`;

const MINA_DOWN = [
  stack(blank(), blank(), blank(), MINA_DOWN_UPPER, MINA_DOWN_LEGS),
  patch(stack(blank(), blank(), MINA_DOWN_UPPER, MINA_DOWN_LEGS_1), { 16: '.krRkwwwwwwWRrk.', 17: '.kRRkWWWWWWksRk.' }),
  patch(stack(blank(), blank(), MINA_DOWN_UPPER, MINA_DOWN_LEGS_2), { 16: '.krRwwwwwwWkRrk.', 17: '.kRskWWWWWWkRRk.' }),
];
const MINA_UP = [
  stack(blank(), blank(), blank(), MINA_UP_UPPER, MINA_DOWN_LEGS),
  patch(stack(blank(), blank(), MINA_UP_UPPER, MINA_DOWN_LEGS_2), { 16: '.krrrRrrrrRrRRk.', 17: '.kRrrRrrrrRrRsk.' }),
  patch(stack(blank(), blank(), MINA_UP_UPPER, MINA_DOWN_LEGS_1), { 16: '.kRrrRrrrrRrRrk.', 17: '.ksrrRrrrrRrRRk.' }),
];
const MINA_LEFT = [
  stack(blank(), blank(), blank(), MINA_LEFT_UPPER, MINA_LEFT_LEGS),
  patch(stack(blank(), blank(), MINA_LEFT_UPPER, MINA_LEFT_LEGS_1), {
    15: '...kwwwkrrrrk...',
    16: '..kswwwkrrrrrk..',
    17: '...kWWWkRRrrRRk.',
  }),
  patch(stack(blank(), blank(), MINA_LEFT_UPPER, MINA_LEFT_LEGS_2), {
    15: '...kwwwwkrrrrk..',
    16: '...kwwwwskrrrRk.',
    17: '...kWWWWkkRRRRk.',
  }),
];

// ---------------------------------------------------------------------------------------------------------------------
// MAMAN — 16x28. Adulte fatiguée : cheveux châtains attachés (chignon), manteau beige, cernes. Tons sobres.
// ---------------------------------------------------------------------------------------------------------------------

const MAMAN_DOWN_UPPER = `
  ......kkkk......
  .....kxCxxk.....
  ....kkKxxKkk....
  ..kkxxCCxxxxkk..
  .kxxCCxxxxxxxxk.
  .kxCxxxxxxxxxxk.
  .kxxxxsxxxxxxxk.
  .kxxsssxxssssxk.
  .kxskkssssskkxk.
  .kxsSSssssSSsxk.
  ..kxsssttsssxk..
  ..kxkSssssSkxk..
  ...kkkSSSSkkk...
  ..kcckdSSdkcCk..
  .kcccckddkcccCk.
  .kcCccckkcccCCk.
  .kccCccccccCcCk.
  .kccCccccccCcCk.
  .kccCCCCCCCCcCk.
  .kccCccccccCcCk.
  .kssCccccccCssk.
  .kkkCccccccCkkk.
  ...kccccccCCk...
  ...kccccccCCk...
  ...kkkkkkkkkk...
`;
const MAMAN_UP_UPPER = `
  ......kkkk......
  .....kxCxxk.....
  ....kkxxxxkk....
  ..kkxxxKKxxxkk..
  .kxxCxxxxxxxxxk.
  .kxCxxxxxxxxxxk.
  .kxxxxxxxxxxxxk.
  .kxxxxxxxxxxxxk.
  .kxxxxxxxxxxxxk.
  .kKxxxxxxxxxxKk.
  ..kKxxxxxxxxKk..
  ..kkKKxxxxKKkk..
  ...kkkSSSSkkk...
  ..kcccccccccCk..
  .kccccccccccCCk.
  .kccCccccccCCCk.
  .kccCccccccCcCk.
  .kccCccccccCcCk.
  .kccCCCCCCCCcCk.
  .kccCcccCccCcCk.
  .kssCcccCccCssk.
  .kkkCcccCccCkkk.
  ...kcccCccCCk...
  ...kcccCccCCk...
  ...kkkkkkkkkk...
`;
const MAMAN_LEFT_UPPER = `
  ..........kkk...
  ....kkkkkkxCxk..
  ...kxxCCxkxxxk..
  ..kxCxxxxxkKKk..
  ..kxxxxxxxxxxk..
  .kxxxxxxxxxxxxk.
  .kxxxxxxxxxxxxk.
  .kxsxxxxxxxxxxk.
  .kssssxxxxxxxxk.
  .kskssSxxxxxxk..
  kssSssxxxxxxxk..
  .kstsSkxxxxxk...
  ..kkkSkkkkkk....
  ....kcSSkk......
  ...kcccccCk.....
  ...kcccCccCk....
  ...kccCcccCk....
  ...kccCcccCk....
  ...kCCCCCCCk....
  ...kccCsscCk....
  ...kcccCCcCk....
  ...kcccccCCk....
  ...kcccccCCk....
  ...kccccccCCk...
  ...kkkkkkkkkk...
`;
const MAMAN_DOWN_LEGS = `
  .....kdkkdk.....
  ....kKKkkKKk....
`;
const MAMAN_DOWN_LEGS_1 = `
  .....kdkkdk.....
  .....kdkkKKk....
  ....kKKk........
`;
const MAMAN_DOWN_LEGS_2 = `
  .....kdkkdk.....
  ....kKKkkdk.....
  ........kKKk....
`;
const MAMAN_LEFT_LEGS = `
  .....kddk.......
  ....kKKKk.......
`;
const MAMAN_LEFT_LEGS_1 = `
  ....kdk.kGk.....
  ...kdk...kGk....
  ..kKKk...kKKk...
`;
const MAMAN_LEFT_LEGS_2 = `
  .....kGkkdk.....
  ....kGk..kdk....
  ...kKKk..kKKk...
`;

const MAMAN_DOWN = [
  stack(blank(), MAMAN_DOWN_UPPER, MAMAN_DOWN_LEGS),
  patch(stack(MAMAN_DOWN_UPPER, MAMAN_DOWN_LEGS_1), { 19: '.kccCccccccCssk.', 20: '.kkkCccccccCkkk.' }),
  patch(stack(MAMAN_DOWN_UPPER, MAMAN_DOWN_LEGS_2), { 19: '.kssCccccccCcCk.', 20: '.kkkCccccccCkkk.' }),
];
const MAMAN_UP = [
  stack(blank(), MAMAN_UP_UPPER, MAMAN_DOWN_LEGS),
  patch(stack(MAMAN_UP_UPPER, MAMAN_DOWN_LEGS_2), { 19: '.kccCcccCccCssk.' }),
  patch(stack(MAMAN_UP_UPPER, MAMAN_DOWN_LEGS_1), { 19: '.kssCcccCccCcCk.' }),
];
const MAMAN_LEFT = [
  stack(blank(), MAMAN_LEFT_UPPER, MAMAN_LEFT_LEGS),
  patch(stack(MAMAN_LEFT_UPPER, MAMAN_LEFT_LEGS_1), {
    16: '...kcCccccCk....',
    17: '...kCcccccCk....',
    19: '...kssccccCk....',
    20: '...kSSccccCk....',
  }),
  patch(stack(MAMAN_LEFT_UPPER, MAMAN_LEFT_LEGS_2), {
    16: '...kccccCcCk....',
    17: '...kcccccCCk....',
    19: '...kcccccCssk...',
    20: '...kcccccCSSk...',
  }),
];

// ---------------------------------------------------------------------------------------------------------------------
// MOUTON — villageois du Pays de Coton (16x20 dans un canevas 16x24). La laine utilise les couleurs locales 6/7/8
// pour pouvoir être recolorée (mouton_rose, mouton_bleu, mouton_jaune).
// ---------------------------------------------------------------------------------------------------------------------

const WOOL_WHITE = { '6': '#fffaf2', '7': '#ece2df', '8': '#b7aab8' };
const WOOL_ROSE = { '6': '#ffe4ee', '7': '#f8b6cf', '8': '#e07ba5' };
const WOOL_BLEU = { '6': '#dcebfb', '7': '#a7c7f0', '8': '#6d8fd6' };
const WOOL_JAUNE = { '6': '#fff7d4', '7': '#ffe991', '8': '#f5c04f' };

const MOUTON_DOWN_UPPER = `
  .....kk..kk.....
  ....k66kk67k....
  ...k66666667k...
  ..kk66666677kk..
  .kpkk666667kkpk.
  kppkdGGGGGGdkppk
  .kkkddddddddkkk.
  ...kdwddddwdk...
  ...kpddKKddpk...
  ...kkddddddkk...
  ..k66kkkkkk76k..
  .k666666666667k.
  k66766666666677k
  kd666666667667dk
  .k666666666677k.
  k76666666666778k
  .k877777777788k.
  ..k8kk8888kk8k..
`;
const MOUTON_UP_UPPER = `
  .....kk..kk.....
  ....k66kk67k....
  ...k66666667k...
  ..kk66666677kk..
  .kdkk666667kkdk.
  kddk66666667kddk
  .kkk66666677kkk.
  ...k66666677k...
  ...k66666777k...
  ...kk777788kk...
  ..k66kkkkkk76k..
  .k666666666667k.
  k66666666666677k
  kd667666666667dk
  .k666666666677k.
  k76666667666778k
  .k877777777788k.
  ..k8kk8888kk8k..
`;
const MOUTON_LEFT_UPPER = `
  .......kk.kk....
  ......k66k667k..
  .....k66666667k.
  ...kkk66666667k.
  ..kGGdk6666677k.
  .kGdddk666667kkk
  kdwdddk66667kppk
  kKddpdk666677kk.
  .kkdddk666777k..
  ...kkk6667777k..
  ...k666kkkk7k...
  ..k66666666677k.
  .k6666666666677k
  .k66d6666666677k
  ..k666666666677k
  .k766666666677k.
  ..k8777777778k..
  ...kk8888kk8k...
`;
const MOUTON_DOWN_LEGS = `
  ...kddk..kddk...
  ...kKKk..kKKk...
`;
const MOUTON_DOWN_LEGS_1 = `
  ...kddk..kddk...
  ...kddk..kKKk...
  ...kKKk.........
`;
const MOUTON_DOWN_LEGS_2 = `
  ...kddk..kddk...
  ...kKKk..kddk...
  .........kKKk...
`;
const MOUTON_LEFT_LEGS = `
  .....kddk.......
  ....kKKKk.......
`;
const MOUTON_LEFT_LEGS_1 = `
  ....kdk..kGk....
  ...kdk....kGk...
  ..kKKk....kKKk..
`;
const MOUTON_LEFT_LEGS_2 = `
  ....kGk..kdk....
  ....kGk..kdk....
  ...kKKk..kKKk...
`;
const MOUTON_TOP = stack(blank(), blank(), blank(), blank());
const MOUTON_TOP_UP = stack(blank(), blank(), blank());

const MOUTON_DOWN = [
  stack(MOUTON_TOP, MOUTON_DOWN_UPPER, MOUTON_DOWN_LEGS),
  patch(stack(MOUTON_TOP_UP, MOUTON_DOWN_UPPER, MOUTON_DOWN_LEGS_1), { 16: 'k666666666667d7k', 17: '.k666666666677k.' }),
  patch(stack(MOUTON_TOP_UP, MOUTON_DOWN_UPPER, MOUTON_DOWN_LEGS_2), { 16: 'k7d666666667667k', 17: '.k666666666677k.' }),
];
const MOUTON_UP = [
  stack(MOUTON_TOP, MOUTON_UP_UPPER, MOUTON_DOWN_LEGS),
  stack(MOUTON_TOP_UP, MOUTON_UP_UPPER, MOUTON_DOWN_LEGS_2),
  stack(MOUTON_TOP_UP, MOUTON_UP_UPPER, MOUTON_DOWN_LEGS_1),
];
const MOUTON_LEFT = [
  stack(MOUTON_TOP, MOUTON_LEFT_UPPER, MOUTON_LEFT_LEGS),
  patch(stack(MOUTON_TOP_UP, MOUTON_LEFT_UPPER, MOUTON_LEFT_LEGS_1), { 16: '.kd6d666666677k.', 17: '..k66666666677k.' }),
  patch(stack(MOUTON_TOP_UP, MOUTON_LEFT_UPPER, MOUTON_LEFT_LEGS_2), { 16: '.k666666d66677k.', 17: '..k66666d666677k' }),
];

// ---------------------------------------------------------------------------------------------------------------------
// PORTRAITS (32x32) — face_<id>_<expression>. A base bust per character, expressions are overlays on the face
// ('_' = keep the base pixel).
// ---------------------------------------------------------------------------------------------------------------------

/** Mirrors a left half horizontally into a symmetric sprite (each row = row + reversed row). */
const mirror = (half: string): string =>
  rows(half)
    .map((r) => r + [...r].reverse().join(''))
    .join('\n');

/** Draws `top` over `base` at (x, y); '_' in `top` keeps the base pixel. */
function overlay(base: string, top: string, x = 0, y = 0): string {
  const b = rows(base).map((r) => r.split(''));
  rows(top).forEach((r, j) => {
    [...r].forEach((ch, i) => {
      const row = b[y + j];
      if (ch !== '_' && row && x + i < row.length) row[x + i] = ch;
    });
  });
  return b.map((r) => r.join('')).join('\n');
}

const NOA_FACE = `
  ................................
  ...............kk...kk..........
  ...........kkkkhhkkkhhkk........
  .........kkhhhhhhhhhhhhhkk.kk...
  .......kkhhhhhhhhhhhhhhhhhkhhk..
  ......khhhhhJJJJhhhhhhhhhhhhhk..
  .....khhhhJJJhhhhhhhhhhhhhhhhhk.
  ....khhhhJJhhhhhhhhhhhhhhhhhhhk.
  ....khhhJJhhhhhhhhhhhhhhhhhhhhk.
  ...khhhhhhhhhhhhhhhhhhhhhhhhhhhk
  ...khhhhhhhhhhhhhhhhhhhhhhhhhhhk
  ..kHhhhhhhhhhhhhhhhhhhhhhhhhhhHk
  ..kHhhhhhhhhhhhhhhhhhhhhhhhhhhHk
  ..kHhhhhhHhhhhhhhHhhhhhhhHhhhhHk
  ..kHhhhhHsHhhhhhHsHhhhhhHsHhhhHk
  ..kHhhhHssHhhhhHssHhhhhHsssHhhHk
  ..kHHhHssssHhhHsssHhhhHssssHhHHk
  ..kHHHsssssHHhHsssHHhHsssssSHHHk
  ..kHHssssssssHssssssHsssssSSSHHk
  ..kHHsskkkkssssssssssskkkksSSHHk
  ..kHHskfuukssssssssssskfuuksSHHk
  ...kHsskuukssssssssssskuuksSHHk.
  ...kHHsSSSsssssssssssssSSSSSHk..
  ....kHsssssssssssssssssssSSHk...
  .....kHssssssssttssssssssSHk....
  ......kkSsssssssssssssssSSk.....
  ........kkSSsssssssssSSkk.......
  ..........kkkSSSSSSSkkk.........
  ........kkvvvkSSSSSkvvvkk.......
  ......kkvvvvvvkuuukvvvvvvkk.....
  ....kkvvvvVvvwvuuuvwvvVvvvvvkk..
  ...kvvvvvvVvvwvvvvvwvvvVvvvvvvk.
`;

// Noa expressions: eye block at (6, 18) covering both eyes, mouth block at (14, 23).
const NOA_EYES = {
  sad: `
    ssskk__________kksss
    skkuu__________uukks
    kuuuk__________kuuuk
    skuuk__________kuuks
    sSSSs__________sSSSs
  `,
  surprised: `
    skkks__________skkks
    kfuuk__________kfuuk
    kuuuk__________kuuuk
    kunuk__________kunuk
    skkks__________skkks
  `,
  tired: `
    sssss__________sssss
    sssss__________sssss
    kkkkk__________kkkkk
    skuuk__________skuuk
    sgggs__________sgggs
  `,
};
const NOA_MOUTH = {
  sad: `
    ____
    _tt_
    t__t
  `,
  surprised: `
    ____
    _kk_
    kRRk
    _kk_
  `,
  tired: `
    ____
    _tt_
    _ss_
  `,
};
const noaFace = (e: keyof typeof NOA_EYES): string => overlay(overlay(NOA_FACE, NOA_EYES[e], 6, 18), NOA_MOUTH[e], 14, 23);

// Mina: symmetric base (mirrored half) + highlights/shading overlays.
const MINA_FACE = overlay(
  mirror(`
    ................
    ..........kk...k
    .........kyyk.ky
    ........kyyyykyy
    ........kyyyyyyy
    ........kYYYYYrY
    ......kkmYYYYYYY
    .....kmmmmmmmmmm
    ....kmmmmmmmmmmm
    ...kmmmmmmmmmmmm
    ...kmmmmmmmmmmmm
    ...kmmmmmmmmmmmm
    ..kkpmmmmmmmmmmm
    .kmmpmmmmmmmmmmm
    kmmmkmmmmmmmmmmm
    kmmMkmMmmmMmmmMm
    kmmMkmssssssssss
    kmmMkmssskkkksss
    kmmMkmsskfxxxkss
    kmmMkmsskxxxxkss
    kmmMkmsskOOOOkss
    kmMMkmssskkkksss
    .kMMkmspptstssss
    .kMMkmssssssssts
    ..kMkkSsssssssst
    ...kk.kSssssssss
    .......kkSssssss
    .........kkkkSSS
    ......kkrrrrkSSS
    ....kkrrrrrrrkwy
    ...krrrrrRrrrkwy
    ..krrrrrrRrrrkww
  `),
  `
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    _________oo_____________________
    ________oo______________________
    _______oo___________________M___
    ___________________________MM___
    ___________________________MM___
    __________________________MM____
    ____________________________mmM_
    ____________________________mmM_
    ____________________________mmM_
    ____________________________mmM_
    ____________________________mmM_
    __________________kfxxxk____mmM_
    ____________________________mmM_
    ____________________________mmM_
    ____________________________MMM_
    ____________________________MMM_
    ____________________________MM__
  `,
);

/** Shifts the given rows horizontally by dx pixels (glitch effect). Vacated pixels become transparent. */
function shiftRows(art: string, which: number[], dx: number): string {
  return rows(art)
    .map((r, i) => {
      if (!which.includes(i)) return r;
      const pad = '.'.repeat(Math.abs(dx));
      return dx > 0 ? (pad + r).slice(0, r.length) : (r + pad).slice(-dx);
    })
    .join('\n');
}

// Mina expressions: eye block at (8, 16) (both eyes + brows), mouth block at (14, 22).
const MINA_EYES = {
  happy: `
    ssssss____ssssss
    ssssss____ssssss
    sskkss____sskkss
    skssks____skssks
    kssssk____kssssk
    ssssss____ssssss
  `,
  sad: `
    ssssMM____MMssss
    sMMsss____sssMMs
    skkkks____skkkks
    kxxxxk____kxxxxk
    kfOOOk____kfOOOk
    skkkkb____bkkkks
    _b____________b_
  `,
  surprised: `
    sMMMMs____sMMMMs
    skkkks____skkkks
    kwwwwk____kwwwwk
    kwxxwk____kwxxwk
    kwxxwk____kwxxwk
    skkkks____skkkks
  `,
  angry: `
    sMMsss____sssMMs
    sssMMs____sMMsss
    skkkkk____kkkkks
    kxxxxk____kxxxxk
    kOOOOk____kOOOOk
    skkkks____skkkks
  `,
  glitch: `
    ssssss____ssssss
    skkkks____skkkks
    kiiiik____kiiiik
    kiiiik____kiiiik
    kiiiik____kiiiik
    skiiks____skiiks
    __ii________ii__
    __i__________i__
  `,
};
const MINA_MOUTH = {
  neutral: `
    ______
    ______
  `,
  happy: `
    ______
    _kkkk_
    _kRRk_
    __kk__
  `,
  sad: `
    ______
    _stts_
    _tsst_
  `,
  surprised: `
    ______
    _skks_
    _kRRk_
    _skks_
  `,
  angry: `
    ______
    _stts_
    _tsst_
  `,
  glitch: `
    ______
    ______
    ______
  `,
};
const minaFace = (e: keyof typeof MINA_EYES): string =>
  overlay(overlay(MINA_FACE, MINA_EYES[e], 8, 16), MINA_MOUTH[e], 13, 22);

/** Mina's corrupted face: black eyes, wide mouth, shifted scanlines and colour noise. */
const MINA_GLITCH = overlay(
  shiftRows(
    shiftRows(
      shiftRows(
        overlay(
          minaFace('glitch'),
          `
            k__________k
            ikkkkkkkkkki
            _kiRiiiiRik_
            __kkkkkkkk__
          `,
          10,
          22,
        ),
        [4, 5, 6],
        2,
      ),
      [18, 19],
      -2,
    ),
    [26, 27, 28],
    1,
  ),
  `
    ________________________________
    ________________________________
    ____________________________a___
    ________________________________
    ______a_________________________
    ________________________________
    ___________________________PP___
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ____iiiiiiii____________________
    ________________________________
    ________________________________
    _____________________________a__
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ______________________iiiiiiii__
    ________________________________
    ________________________________
    ________________________________
    _a______________________________
  `,
);

/**
 * Rim shading (light from the top-left): every `from` pixel that has a transparent or outline pixel within `depth`
 * steps in direction (dx, dy) becomes `to`.
 */
function rimShade(art: string, from: string, to: string, dx: number, dy: number, depth = 1): string {
  const g = rows(art);
  const at = (x: number, y: number) => g[y]?.[x] ?? '.';
  return g
    .map((r, y) =>
      [...r]
        .map((ch, x) => {
          if (ch !== from) return ch;
          for (let i = 1; i <= depth; i++) {
            const n = at(x + dx * i, y + dy * i);
            if (n === '.' || n === 'k') return to;
          }
          return ch;
        })
        .join(''),
    )
    .join('\n');
}

/** Builds art from a pixel function (procedural shapes: crescents, glows…). */
function raster(w: number, h: number, fn: (x: number, y: number) => string): string {
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += fn(x, y);
    out.push(r);
  }
  return out.join('\n');
}

/** Adds a 1px `k` outline inside the canvas (transparent pixels touching opaque ones). */
function outlineIn(art: string, color = 'k'): string {
  const g = rows(art);
  const solid = (x: number, y: number) => {
    const ch = g[y]?.[x];
    return ch !== undefined && ch !== '.' && ch !== color;
  };
  return g
    .map((r, y) =>
      [...r]
        .map((ch, x) => (ch === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) ? color : ch))
        .join(''),
    )
    .join('\n');
}

// Dodo: plush sheep. Wool ball, grey face, button eyes, stitched mouth, pink bow.
const DODO_BASE = mirror(`
  ................
  ..........kkk..k
  ........kkwwwkkw
  ......kkwwwwwwww
  .....kwwwwwWwwww
  ...kkwwwwwwwWwww
  ..kwwwwWwwwwwwww
  ..kwwwwwWwwwwwWw
  ...kwwwwwwwwwwwW
  ..kwwwwWwwwwwwww
  ..kwwwwwWwwkkkkk
  .kkwwwwwwkkggggg
  kpkwwwwwkggggggg
  kppkwwwkgggggggg
  kppkwwwkgggggggg
  .kkkwwkggggggggg
  ...kwwkggggkkggg
  ..kwwwkgggkfKkgg
  ..kwWwkgggkKKkgg
  ...kwwkggggkkggg
  ..kwwwkgppgggggP
  ..kwWwkggggGgggG
  ...kwwkgggggGGGg
  ..kwwwwkgggggggg
  ..kwwWwwkkgggggg
  ...kwwwwwkkkkkkk
  ....kwwwwkkwwwww
  ...kwwwwkppkwwkk
  ...kwwwwkpPpkkpp
  ..kwwwwwkppkwwkk
  ..kwwwwwwkkwwwww
  .kwwwwwwwwwwwwww
`);
const DODO_FACE = overlay(
  rimShade(rimShade(rimShade(DODO_BASE, 'w', 'W', 1, 0, 2), 'w', 'W', 0, 1, 1), 'W', 'g', 1, 0, 1),
  `
    ________________________________
    ________________________________
    __________ff____________________
    ________fff_____________________
    _______ff_______________________
    ______f_________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ___________________kfKk_________
  `,
);

/** Replaces colours (`map`) on the given rows only. */
function recolor(art: string, map: Record<string, string>, from = 0, to = 999): string {
  return rows(art)
    .map((r, y) => (y < from || y > to ? r : [...r].map((ch) => map[ch] ?? ch).join('')))
    .join('\n');
}

// Dodo expressions: block at (8, 16) covering eyes + mouth.
const DODO_HAPPY = overlay(
  DODO_FACE,
  `
    gggggggggggggggg
    gggkkggggggkkggg
    ggkggkggggkggkgg
    gggggggggggggggg
    pppggggPPggggppp
    gggggkkkkkkggggg
    gggggkRppRkggggg
    ggggggkkkkgggggg
  `,
  8,
  16,
);
const DODO_CREEPY = overlay(
  recolor(recolor(DODO_FACE, { g: 'G', p: 'P' }, 9, 19), { w: 'W', W: 'g', f: 'W' }, 0, 31),
  `
    GGGkkGGGGGGkkGGG
    GGkffkGGGGkffkGG
    GGkyykGGGGkyykGG
    GGGkkGGGGGGkkGGG
    kggggggPPggggggk
    gkggggggggggggkg
    ggkkkkkkkkkkkkgg
    gggkwwRwwRwwkggg
    kkggkkkkkkkkggkk
  `,
  8,
  16,
);

// Maman: tired adult, chestnut hair in a bun with loose strands, coat collar.
const MAMAN_FACE = overlay(
  mirror(`
    ................
    ...........kkkkk
    ..........kxxCCx
    ..........kxCxxx
    .......kkkkKxxxx
    .....kkxxxxkKKKK
    ....kxxxCCxxxxxx
    ...kxxCCxxxxxxxx
    ...kxCxxxxxxxxxx
    ..kxxxxxxxxxxxxK
    ..kxxxxxxxxxxxKs
    ..kxxxxxxxxxKsss
    .kxxxxxxxxKsssss
    .kxxxxxxKsssssss
    .kxxxxxKssssssss
    .kxxxxksssssssss
    .kxxxksssxxxxsss
    .kxxxkssskkkksss
    .kxxkssskwxxksss
    .kxxkssssSSSssss
    .kxxkSssssssssss
    .kxxkSssssssssss
    .kxxxkSsssssssss
    ..kxxkSssssssstt
    ..kxxxkSssssssss
    ...kxxkkSsssssss
    ....kkk.kkSsssss
    .........kkkkSSS
    .......kkcckkSSS
    .....kkcccccckdS
    ...kkccCccccckdd
    ..kcccCcccccckdd
  `),
  `
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    _____________x__________________
    ____________xx__________________
    ____________x___________________
    ___________x____________________
    ________________________________
    ________________________________
    ________________________________
    ___________________kwxxk________
    ________________________________
    _________________S______________
    ________________S_______________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    ________________________________
    _____________________________C__
    ____________________________CC__
    ___________________________CCc__
  `,
);
// Maman expressions: eye block at (8, 15).
const MAMAN_EYES = {
  sad: `
    ___xx______xx___
    _xx__________xx_
    ssssssssssssssss
    _kkkk______kkkk_
    kwxxk______kwxxk
    sbSSs______sSSbs
    sb____________bs
  `,
  happy: `
    ________________
    ________________
    _xxxx______xxxx_
    ssssss____ssssss
    ssKKss____ssKKss
    sKssKs____sKssKs
    sppsss____ssspps
  `,
};
const MAMAN_MOUTH = {
  sad: `
    ______
    _tttt_
    t____t
  `,
  happy: `
    t____t
    _tttt_
    ______
  `,
};
const mamanFace = (e: keyof typeof MAMAN_EYES): string =>
  overlay(overlay(MAMAN_FACE, MAMAN_EYES[e], 8, 15), MAMAN_MOUTH[e], 13, 22);

// Chaussette: blue polka-dot sock puppet, mismatched button eyes, red bow.
const CHAUSSETTE_BASE = mirror(`
  ................
  ................
  ................
  ..........kkkkkk
  ........kkbbbbbb
  ......kkbbbbbbbb
  .....kbbbbbbbbbb
  ....kbbbbbbbbbbb
  ....kbbbbbbbbbbb
  ...kbbbbbbbbbbbb
  ...kbbbbbbbbbbbb
  ...kbbbbbbbbbbbb
  ..kbbbbbbbbbbbbb
  ..kbbbbbbbbbbbbb
  ..kbbbbbbbbbbbbb
  ..kbbbbbbbbbbbbb
  ..kbbbbbbbbbbbbb
  ..kbbbbbbbbbbbbb
  ..kbbbbbbkbbbbbb
  ..kbbbbbbbkkbbbb
  ..kbbbbbbbbbkkkk
  ...kbbbbbbbbbbbb
  ...kbbbbbbbbbbbb
  ....kbbbbbbbbbbb
  ....kbbbbbbbbbbb
  ....kbbbbbbbbbbb
  ....kkkkkkkkkkkk
  ....kwbwbwbwbwbw
  ....kwbwbwbwbwbw
  ....kwbwbwbwbwbw
  ....kwbwbwbwbwbw
  ....kkkkkkkkkkkk
`);
const CHAUSSETTE_FACE = overlay(
  rimShade(rimShade(CHAUSSETTE_BASE, 'b', 'B', 1, 0, 2), 'b', 'B', 0, 1, 1),
  `
    ________________________________
    ___________________kk___kk______
    __________________krRk_kRrk_____
    __________________krrRkRrrk_____
    ___________________kRkkkRk______
    __________________krrRkRrrk_____
    __________________krRk_kRrk_____
    ___________________kk___kk______
    ______ww________________________
    ______ww______ww________________
    ______________ww____________ww__
    _______kkkk_________________ww__
    ______kkGkkk________kkkk________
    ______kkkkkk_______kwWWwk_______
    ______kkkGkk_______kWGGWk_______
    ______kkkkkk_______kWGGWk_______
    _______kkkk________kwWWwk_______
    ____ww______________kkkk__ww____
    ____ww__________________________
    _____________________________ww_
    ____________ww_______________ww_
    ____________ww__________ww______
    ________________________ww______
    ____ww__________________________
    ____ww______________________ww__
  `,
);
const CHAUSSETTE_HAPPY = overlay(
  CHAUSSETTE_FACE,
  `
    _kbbbbbbbbbbbbbbbbk_
    __kkkkkkkkkkkkkkkk__
    ___kRRRRRRRRRRRRk___
    ____kRRRppppRRk_____
    _____kkkkkkkkkk_____
  `,
  6,
  17,
);

// Madame Lune: sleepy crescent moon with a nightcap (procedural crescent + hand-drawn cap and face).
function moonCrescent(cx: number, cy: number, r: number, ix: number, iy: number, ir: number, w = 32, h = 32): string {
  return outlineIn(
    raster(w, h, (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      const di = Math.hypot(x - ix, y - iy);
      if (d > r || di < ir) return '.';
      if (d > r - 1.3 && x + y < cx + cy - 4) return 'q'; // rim light (top-left)
      if (d > r - 1.3 && (y > cy + 3 || x > cx + 2)) return 'Y'; // shadow (bottom)
      if (di < ir + 1.3) return 'Y'; // terminator
      return 'y';
    }),
  );
}
const MOON_CAP = `
  ...........kkkk.................
  .........kkBBBBkk...............
  ........kBBByBBBBkk.............
  .......kBBBBBBBnBBBkk...........
  ......kBBBBBBBnnBBBBBk..........
  .....kbBBBBBBnnnnnBBBBk.........
  ....kbbBBBBBnnkkknnnBBk.........
  ...kwwwbbBBnnk...kknBBk.........
  ..kwwwwwwwwwwk.....knBk.........
  ..kwwWwwwWwwk______knBk.........
  ___kkkkkkkkk_______kBk__________
  ___________________kBkkk________
  __________________kkwwwwk_______
  __________________kwwwwWk_______
  ___________________kwWWk________
  ____________________kkk_________
`;
const MOON_FACE = `
  ________________
  ________k__k____
  _________kk_____
  ________________
  _______pp___yyyk
  ____________yyYk
  ________________
  __________t_____
  ___________tt___
`;
const MOON = overlay(overlay(moonCrescent(14, 18, 13, 24, 14, 11), MOON_CAP), MOON_FACE, 0, 11);
const LUNE_FACE = overlay(
  MOON,
  `
    bbbb
    __b_
    _b__
    bbbb
  `,
  25,
  1,
);

// ---------------------------------------------------------------------------------------------------------------------
// PNJ (ART statique)
// ---------------------------------------------------------------------------------------------------------------------

// Dodo flottant (16x16) — mouton en peluche rond, nœud rose. _2 = respiration (tête qui s'affaisse d'un pixel).
const NPC_DODO = `
  ..........kk.kk.
  ....kk.kk.kpPpk.
  ...kwwkwwkwkPkk.
  ..kwwwwwwwwwkk..
  .kwwwwwwwwwwWWk.
  kpkwwGGGGGGwWkpk
  kppkGggggggGkppk
  .kkwGgkggkgGWkk.
  ..kwGgkggkgGWk..
  ..kwGpggggpGWk..
  .kwwwGgGGgGWWWk.
  .kwwwwGGGGWWWWk.
  .kwwwwwwwwwWWWk.
  ..kWwwwwwwWWgk..
  ...kkWWWWWggk...
  .....kkkkkkk....
`;
const NPC_DODO_2 = `
  ................
  ..........kk.kk.
  ....kk.kk.kpPpk.
  ..kkwwkwwkwkPkk.
  .kwwwwwwwwwwkWk.
  kpkwwGGGGGGwWkpk
  kppkGggggggGkppk
  .kkwGgkggkgGWkk.
  .kwwGgkggkgGWWk.
  kwwwGpggggpGWWWk
  kwwwwGgGGgGWWWgk
  .kwwwwGGGGWWWWk.
  .kwwwwwwwwwWWWk.
  ..kWwwwwwwWWgk..
  ...kkWWWWWggk...
  .....kkkkkkk....
`;

// Dodo corrompu (16x16) — laine grisée, yeux vides blancs, couture déchirée, encre qui coule.
const NPC_DODO_DARK = `
  ..........kk.kk.
  ....kk.kk.kRrRk.
  ...kGGkGGkGkRkk.
  ..kGGGGGGGGGkk..
  .kGGGGGGGGGkwkk.
  kukGGddddddkfwkk
  kuukdKKKKKKdkwkk
  .kkGdKwKKwKdkkk.
  ..kGdKwKKwKdGk..
  ..kGdKKKKKKdGk..
  .kGGGdKiiKdGddk.
  .kGGGGdiidGdddk.
  .kdGGGGiGGGdddk.
  ..kiGGGiGGddik..
  ...kikkiikkik...
  ....i...i...i...
`;
const NPC_DODO_DARK_2 = `
  ..........kk.kk.
  ....kk.kk.kRrRk.
  ...kGGkGGkGkRkk.
  ..kGGGGGGGGGkk..
  .kGGGGGGGGGkwkk.
  kukGGddddddkfwkk
  kuukdKKKKKKdkwkk
  .kkGdKwKKwKdkkk.
  ..kGdKwKKwKdGk..
  ..kGdKKKKKKdGk..
  .kGGGdKiiKdGddk.
  .kGGGGdiidGdddk.
  .kdGGGGiGGGdddk.
  ..kiGGGiGGddik..
  ...kikkiikkik...
  ...i....i....i..
`;

// Chaussette la marchande (16x24) — chaussette-marionnette bleue à pois, yeux-boutons dépareillés, nœud rouge.
const NPC_CHAUSSETTE = `
  ................
  ...........kk.kk
  ..........krRkRk
  ......kkkkkRkRk.
  ....kkbbbbbkrRk.
  ...kbbwbbbbbkkk.
  ..kbbbbbbbbbbBk.
  ..kbkkkbbbkkbBk.
  .kbkkfkbbkwWkBBk
  .kbkkkkbbkWGkBBk
  .kbbkkbbbbkkbBBk
  .kwbbbbbbbbbbBBk
  .kkbbbbbbbbbbkkk
  ..kkkkkkkkkkkRk.
  ..kbkRRRRRRkBk..
  ..kbbkkkkkkbBk..
  ..kbbbbwbbbBBk..
  ..kbwbbbbbbBBk..
  ..kbbbbbbwbBBk..
  ..kbbbwbbbbBBk..
  ..kkkkkkkkkkkk..
  ..kwbwbwbwbwbk..
  ..kwbwbwbwbwbk..
  ..kkkkkkkkkkkk..
`;
const NPC_CHAUSSETTE_2 = `
  ................
  ................
  ...........kk.kk
  ..........krRkRk
  ......kkkkkRkRk.
  ....kkbbbbbkrRk.
  ...kbbwbbbbbkkk.
  ..kbkkkbbbkkbBk.
  .kbkkfkbbkwWkBBk
  .kbkkkkbbkWGkBBk
  .kbbkkbbbbkkbBBk
  .kwbbbbbbbbbbBBk
  .kkkkkkkkkkkkkkk
  ..kRRRRppRRRRRk.
  ..kkRRRRRRRRkkk.
  ..kbkkkkkkkkbBk.
  ..kbbbbwbbbBBBk.
  ..kbwbbbbbbBBk..
  ..kbbbbbbwbBBk..
  ..kbbbwbbbbBBk..
  ..kkkkkkkkkkkk..
  ..kwbwbwbwbwbk..
  ..kwbwbwbwbwbk..
  ..kkkkkkkkkkkk..
`;

// Madame Lune (32x32) — même croissant que le portrait, avec « zzz » qui montent.
const NPC_LUNE = overlay(
  MOON,
  `
    _______bbb
    ________b_
    _______b__
    _______bbb
    __________
    __BBBB____
    ____B_____
    ___B______
    __BBBB____
  `,
  20,
  0,
);
const NPC_LUNE_2 = overlay(
  MOON,
  `
    ______bbbb
    ________b_
    _______b__
    ______bbbb
    __________
    __________
    ___BBB____
    ____B_____
    ___BBB____
  `,
  21,
  0,
);

// Hibou bibliothécaire (16x20) — hibou en papier plié, lunettes rondes. _2 = clignement.
const NPC_HIBOU = `
  ..k..........k..
  ..kk........kk..
  ..kqk......kQk..
  ..kqqkkkkkkqQk..
  ..kqqqqqqqqqQk..
  .kqqqqqqqqqqQQk.
  .kqkkkqqqqkkkQk.
  .kkbwbkkkkbwbkk.
  .kkbkbkqqkbkbkk.
  .kqkkkqooqkkkQk.
  .kqqqqqqOOqqqQk.
  ..kQqqqwwqqqQk..
  .kQQqqwwwwqqQQk.
  .kQQqwwQwwwqQQk.
  kQQQqwwwwQwqQQQk
  kQQQqqwQwwqqQQck
  kcQQqqqwwqqqQQck
  .kcQQqqqqqqQQck.
  ..kkkkkkkkkkkk..
  ....kOk..kOk....
`;
const NPC_HIBOU_2 = patch(NPC_HIBOU, { 7: '.kkkkkkkkkkkkkk.', 8: '.kkbbbkqqkbbbkk.' });

// Petit agneau (12x14) — enfant du village.
const NPC_AGNEAU = `
  ...kk..kk...
  ..kwwkkwWk..
  .kkwwwwwWkk.
  kpkkddddkkpk
  kppkddddkppk
  .kkdwddwdkk.
  ..kpdKKdpk..
  ..kkddddkk..
  .kwwkkkkwWk.
  kwwwwwwwwWWk
  kdwwwwwwwWdk
  .kwwwwwwWWk.
  ..kkdkkdkk..
  ...kKkkKk...
`;

// Monstre du Placard apaisé (32x40) — armoire sombre entrouverte, yeux jaunes doux, petits bras-cintres.
const PLACARD_HALF = `
    ...kkkkkkkkkkkkk
    ..kCCCCCCCCCCCCC
    ..kxxxxxxxxxxxxx
    ..kKKKKKKKKKKKKK
    ...kkkkkkkkkkkkk
    ....kxxxxxxxxxxx
    ....kxkkkkkkkiii
    ....kxkCCCCCkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkxKKKKkiii
    ....kxkxxxxxkiii
    ....kxkxxxxxkiii
    ....kxkxxxxYkiii
    ....kxkxxxxYkiii
    ....kxkxxxxxkiii
    ....kxkCCCCCkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkCxxxxkiii
    ....kxkxKKKKkiii
    ....kxkxxxxxkiii
    ....kxkkkkkkkiii
    ....kxxxxxxxxxxx
    ...kkkkkkkkkkkkk
    ...kCCCCCCCCCCCC
    ...kxxxxxxxxxxxx
    ...kkkkkkkkkkkkk
    .....kKKk.......
    .....kKKk.......
    .....kxxk.......
    .....kkkk.......
  `;
const PLACARD_ARM = `
  ____ggg
  ___g___
  ___g___
  __ggg__
  _g_g_g_
  g__g__g
  ggggggg
`;
const NPC_PLACARD = overlay(
  mirror(overlay(PLACARD_HALF, PLACARD_ARM, 0, 19)),
  `
    ______________y__y______________
    _____________y_yy_y_____________
  `,
  0,
  11,
);

// Gomme apaisée (24x20) — gomme rose usée, étui en carton bleu, visage doux.
const NPC_GOMME = `
  ........................
  ....kkkkkkkkkkkkkkkk....
  ...kwppppppppkbbbbbbk...
  ..kwpppppppppkbbbbbbBk..
  ..kppppppppppkbwwwwbBk..
  .kppppppppppkkbbbbbbBBk.
  .kpppppppppppkBBBBBBBBk.
  .kppkkppppkkpkbbbbbbbBk.
  .kpkppkppkppkkbbbbbbbBk.
  .kpppppppppppkbwwwwwbBk.
  .kpPPpppppPPpkbbbbbbbBk.
  .kpppppkkppppkbbbbbbbBk.
  .kpppppppppppkbbbbbbbBk.
  .kPpppppppppPkBBBBBBBBk.
  .kPPpppppppPPkbbbbbbBBk.
  ..kPPPPPPPPPPkBBBBBBBk..
  ...kkkkkkkkkkkkkkkkkk...
  ..kpk..kpk..............
  ...k....k...............
  ........................
`;

// Luciole (8x8) — luciole lumineuse. _2 = lueur plus vive, ailes baissées.
const NPC_LUCIOLE = `
  .k....k.
  ..k..k..
  ..kddk..
  wwkddkww
  .wkyykw.
  .kyqqyk.
  ..kyyk..
  ...kk...
`;
const NPC_LUCIOLE_2 = `
  .k....k.
  ..k..k..
  .wkddkw.
  wwkddkww
  ..kqqk..
  .kqffqk.
  ..kqqk..
  ...kk...
`;

// ---------------------------------------------------------------------------------------------------------------------
// POSES (ART statique)
// ---------------------------------------------------------------------------------------------------------------------

// Noa allongé au sol, face vers le haut, tête à gauche (24x12).
const POSE_NOA_LIE = `
  ...kkkk.................
  .kkhhhhkk.kkkkkkk.......
  khhJJhhHkkvvvvvvVkkkkkk.
  khJhhHsksSkvVvvvVknnssdk
  khhhhHsksSkwwvvvVknnssdk
  khhhHssssStvvvvvVknnkkk.
  khhhHssssStvvvvvVknnkkk.
  khhhhHsksSkwwvvvVknnssdk
  khhhhHsksSkvVvvvVknnssdk
  .khhhhhHkkvvvvvvVkkkkkk.
  ..kkhhkk..kkkkkkk.......
  ....kk..................
`;// Noa assis, genoux repliés, bras autour des jambes (16x20).
const POSE_NOA_SIT = `
  .........kk.....
  ....kkkkkhhk....
  ..kkhhhhhhhhkk..
  .khhhJJhhhhhhhk.
  khhhJhhhhhhhhhhk
  kHhhhhhhhhhhhhHk
  kHhhHhhhHhhhHhHk
  kHHsHhsHHhsHhHHk
  kHHsHHssssHHSHHk
  .kHskksssskkSHk.
  .kvvvvvvvvvvvvk.
  kvvVvvvvvvvvVvVk
  kvVVvvvvvvvVVVVk
  kkVVVVVVVVVVVVkk
  kvkkkssk.ksskkvk
  kvvnksSk.kSskvVk
  kvvnksSk.kSskVVk
  kuuukddk.kddkuuk
  .kkkddddkddddkk.
  ...kkkkkkkkkk...
`;
// Mina qui pleure, mains sur les yeux (16x24).
const POSE_MINA_CRY = stack(
  blank(),
  blank(),
  blank(),
  `
  .....k.kk.k.....
  ....kykyykyk....
  ....kyyyyyyk....
  ...kmYYYYYYmk...
  ..kmmmmmmmmmmk..
  ..kmmmmmmmmmMk..
  .kkmmmmmmmmmmkk.
  kmpkkkmmmmkkkpMk
  kmksssskksssskMk
  kMksSsskksssSkMk
  .kkskbkRRkbkskk.
  ..kskSSbbSSksk..
  ..kskrkyykrksk..
  ..krRkwwwwkRrk..
  .krRkwwwwwwkRrk.
  .krRkwwwwwWkRrk.
  .kRRkWWWWWWkRRk.
  ..kkkkkkkkkkkk..
  `,
  MINA_DOWN_LEGS,
);

/** Mina déformée : lignes décalées, couleurs partiellement inversées, yeux noirs. */
const POSE_MINA_GLITCH = recolor(
  recolor(
    shiftRows(
      shiftRows(
        shiftRows(
          patch(MINA_DOWN[0]!, {
            11: 'kmpmiissssiimpMk',
            12: 'kMkmiissssiiMkMk',
            13: '.kkmiiiiiiiiMkk.',
            14: '...kkiSSSSikk...',
          }),
          [4, 5, 6],
          2,
        ),
        [12, 13],
        1,
      ),
      [16, 17],
      -2,
    ),
    { m: 'A', M: 'n', y: 'v', Y: 'u', p: 'l' },
    4,
    10,
  ),
  { r: 'a', R: 'A', w: 'i', W: 'K' },
  17,
  19,
);
/** Silhouette de Mina faite de lumière : tons crème/jaune pâle, contour jaune. */
const POSE_MINA_LIGHT = recolor(MINA_DOWN[0]!, {
  k: 'y',
  m: 'q', M: 'Q', y: 'f', Y: 'q',
  s: 'w', S: 'q', t: 'Q', p: 'q',
  r: 'q', R: 'Q', w: 'f', W: 'w', x: 'y',
});

// Maman serrant Noa dans ses bras (24x28) : Noa de dos, Maman à genoux derrière lui, yeux fermés.
const POSE_HUG = `
  ..............kkkk......
  .............kxCxxk.....
  ...........kkkxxxxkk....
  ..........kxxCCxxxxxk...
  .........kxCxxxxxxxxxk..
  ........kxxxxxxxxxxxxk..
  ........kxxxxsxxxxxxxk..
  ...kkkkkkxxsssxxsssxxk..
  ..khhhhhhkxsKKssKKsxk...
  .khhJJhhhhkssssssssSk...
  khhJhhhhhhhkSsstsSSk....
  khhhhhhhhhhhkkSSSkkk....
  khhhhhhhhhhhhkcccccck...
  kHhhhhhhhhhhhkccccCCck..
  kHHhhhhhhhhhHkcccccCCk..
  .kHHhhhhhhhHHkccccCCCk..
  ..kkSkHHHHkSkcccccCCCk..
  .kvvvkkkkkkvvkkccCCCCk..
  kcccccccccccccsskCCCCk..
  kCCcccccccccccsskCCCCk..
  kvvVuuvvvvvvuVvvkCCCCk..
  kvvVuVvvvvvVuVvvkcCCCk..
  .kVVuvvvvvvvuVVkkcCCCk..
  .kssuVVVVVVVussk.kkkkk..
  .kkknnnnnnnnnkkk........
  ....knnkkknnk...........
  ....kssk.kssk...........
  ...kddk...kddk..........
`;

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

const MOUTON = { down: MOUTON_DOWN, up: MOUTON_UP, left: MOUTON_LEFT };

export const CHARS: Record<string, CharDef> = {
  noa: { down: NOA_DOWN, up: NOA_UP, left: NOA_LEFT, variants: ['real', 'ink'] },
  mina: { down: MINA_DOWN, up: MINA_UP, left: MINA_LEFT, variants: ['ink'] },
  maman: { down: MAMAN_DOWN, up: MAMAN_UP, left: MAMAN_LEFT },
  mouton: { ...MOUTON, opts: { colors: WOOL_WHITE }, variants: ['ink'] },
  mouton_rose: { ...MOUTON, opts: { colors: WOOL_ROSE }, variants: ['ink'] },
  mouton_bleu: { ...MOUTON, opts: { colors: WOOL_BLEU }, variants: ['ink'] },
  mouton_jaune: { ...MOUTON, opts: { colors: WOOL_JAUNE }, variants: ['ink'] },
};

void patch;

export const ART: Record<string, SpriteDef> = {
  face_noa_neutral: NOA_FACE,
  face_noa_sad: noaFace('sad'),
  face_noa_surprised: noaFace('surprised'),
  face_noa_tired: noaFace('tired'),
  face_mina_neutral: MINA_FACE,
  face_mina_happy: minaFace('happy'),
  face_mina_sad: minaFace('sad'),
  face_mina_surprised: minaFace('surprised'),
  face_mina_angry: minaFace('angry'),
  face_mina_glitch: MINA_GLITCH,
  face_dodo_neutral: DODO_FACE,
  face_dodo_happy: DODO_HAPPY,
  face_dodo_creepy: DODO_CREEPY,
  face_maman_neutral: MAMAN_FACE,
  face_maman_sad: mamanFace('sad'),
  face_maman_happy: mamanFace('happy'),
  face_chaussette_neutral: CHAUSSETTE_FACE,
  face_chaussette_happy: CHAUSSETTE_HAPPY,
  face_lune_neutral: LUNE_FACE,

  // PNJ
  npc_dodo: NPC_DODO,
  npc_dodo_2: NPC_DODO_2,
  npc_dodo_dark: NPC_DODO_DARK,
  npc_dodo_dark_2: NPC_DODO_DARK_2,
  npc_chaussette: NPC_CHAUSSETTE,
  npc_chaussette_2: NPC_CHAUSSETTE_2,
  npc_lune: NPC_LUNE,
  npc_lune_2: NPC_LUNE_2,
  npc_hibou: NPC_HIBOU,
  npc_hibou_2: NPC_HIBOU_2,
  npc_agneau: NPC_AGNEAU,
  npc_placard: NPC_PLACARD,
  npc_gomme: NPC_GOMME,
  npc_luciole: NPC_LUCIOLE,
  npc_luciole_2: NPC_LUCIOLE_2,

  // Poses
  pose_noa_lie: POSE_NOA_LIE,
  pose_noa_sit: POSE_NOA_SIT,
  pose_mina_cry: POSE_MINA_CRY,
  pose_mina_glitch: POSE_MINA_GLITCH,
  pose_hug: POSE_HUG,
  pose_mina_light: POSE_MINA_LIGHT,
};

export const VARIANTS: string[] = ['real', 'ink'];

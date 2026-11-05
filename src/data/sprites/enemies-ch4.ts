import type { SpriteDef } from '../../game/assets';
import { ART as CHAR_ART } from './characters';
import { Pix, seeded, type Ramp } from './enemies';

// Chapter 4 « La Maison Cousue » — battle sprites (`b_<id>`, `b_<id>_2`), overworld sprites of the regular enemies
// (`ow_<id>`, `ow_<id>_2`) and the portraits of Mina n°366 (`face_mina366_<expr>`), the felt Mina who fights at Noa's
// side. See docs/HISTOIRE.md § 3.11 and § 4 « Ch. 4 ». Everything here is felt, thread, buttons, plates and pins: the
// body horror of the chapter only ever touches toys.

/** Local colors (felt, thread, cold pasta, brass). */
const C4_COLORS = {
  '6': '#f2c9b0', // felt skin
  '7': '#d49a88', // felt skin, shade
  '8': '#bfe0c8', // paper mould, pale
  '9': '#6f9c8a', // paper mould
};

const FELT_WHITE: Ramp = ['w', 'W', 'g', 'G'];
const METAL: Ramp = ['w', 'g', 'G', 'd'];

const flipArt = (art: string): string =>
  art
    .split('\n')
    .map((r) => [...r].reverse().join(''))
    .join('\n');

/** A running stitch along a line: every other pixel. */
function stitchLine(p: Pix, x0: number, y0: number, x1: number, y1: number, c: string, phase = 0): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    if ((i + phase) % 3 === 2) continue;
    const x = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n));
    const y = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n));
    p.set(x, y, c);
  }
}

/** A cross-stitch « X » (3×3). */
function crossStitch(p: Pix, x: number, y: number, c: string): void {
  p.set(x, y, c).set(x + 2, y, c).set(x + 1, y + 1, c).set(x, y + 2, c).set(x + 2, y + 2, c);
}

/** A round sewing button (5×5): four holes and a red thread through them. */
function buttonEye(p: Pix, x: number, y: number, fill = 'K', hole = 'g', thread = 'r'): void {
  p.stamp(`.kkk.\nk${hole}${fill}${hole}k\nk${fill}${thread}${fill}k\nk${hole}${fill}${hole}k\n.kkk.`, x, y);
}

// ---------------------------------------------------------------------------------------------------------------------
// Pâte Froide (46x42) — un tas de spaghettis froids dans une assiette, qui marche sur quatre pattes de fourchette.
// Moisissure de papier sur les bords, deux trous pour les yeux, une fourchette plantée dedans, un post-it collé.
// Frame 2 : les pattes changent de pas, les nouilles glissent, la fourchette penche.
// ---------------------------------------------------------------------------------------------------------------------
function pateFroide(f: number): string {
  const p = new Pix(46, 42);
  // Fork legs (behind the plate): handles go up under the plate, tines touch the floor.
  const legs: Array<[number, number]> = f ? [[7, -1], [16, 1], [28, -1], [37, 1]] : [[8, 1], [15, -1], [29, 1], [36, -1]];
  for (const [x, lean] of legs) {
    for (let y = 26; y < 35; y++) p.set(x + Math.round(((y - 26) * lean) / 6), y, 'g').set(x + 1 + Math.round(((y - 26) * lean) / 6), y, 'G');
    const bx = x + lean - 1;
    p.rect(bx, 35, 5, 1, 'g');
    for (let i = 0; i < 4; i++) p.rect(bx + i + (i > 1 ? 1 : 0) - (i > 1 ? 1 : 0), 36, 1, 5, i % 2 ? 'G' : 'g');
    p.set(bx, 36, 'g').set(bx + 1, 36, 'd').set(bx + 2, 36, 'g').set(bx + 3, 36, 'd').set(bx + 4, 36, 'G');
    for (let y = 37; y < 41; y++) p.set(bx, y, 'g').set(bx + 1, y, '.').set(bx + 2, y, 'g').set(bx + 3, y, '.').set(bx + 4, y, 'G');
  }
  // The plate.
  p.ellipse(23, 29, 21, 5, 'g');
  p.ellipse(23, 28, 21, 5, 'w');
  p.ellipse(23, 28, 16, 3.5, 'W');
  p.rect(5, 30, 36, 1, 'G');
  // The heap: a dark core, then a tangle of cold strands wandering over it.
  p.blob(
    [
      [23, 19, 12],
      [14, 23, 7],
      [32, 23, 7],
      [21, 12, 7],
    ],
    ['c', 'C', 'C', 'x'],
    [23, 18, 17, 12],
  );
  const rnd = seeded(41);
  for (let k = 0; k < 30; k++) {
    let x = 8 + rnd() * 30;
    let y = 8 + rnd() * 18;
    let a = rnd() * Math.PI * 2;
    const slide = f && k % 3 === 0 ? 1 : 0;
    for (let i = 0; i < 16; i++) {
      x += Math.cos(a);
      y += Math.sin(a) * 0.7;
      a += (rnd() - 0.5) * 1.1;
      const px = Math.round(x);
      const py = Math.round(y) + slide;
      if (!'cCxqQ'.includes(p.get(px, py)) || py > 27) continue;
      p.set(px, py, py < 14 || px < 16 ? 'q' : 'Q');
      if (p.get(px, py + 1) === 'C' || p.get(px, py + 1) === 'c') p.set(px, py + 1, 'x');
    }
  }
  // Paper mould: fuzzy blue-green blotches.
  for (const [mx, my, r] of [
    [10, 22, 3],
    [33, 15, 2.5],
    [27, 25, 2],
  ] as const) {
    for (let y = my - r - 1; y <= my + r + 1; y++)
      for (let x = mx - r - 1; x <= mx + r + 1; x++) {
        const d = Math.hypot(x - mx, y - my);
        if (!p.solid(x, y) || p.get(x, y) === 'w' || p.get(x, y) === 'W') continue;
        if (d < r * 0.6) p.set(x, y, '9');
        else if (d < r + (rnd() > 0.5 ? 1 : 0)) p.set(x, y, '8');
      }
  }
  // Two sunken eyes, looking two different ways; a strand hangs over one of them.
  p.stamp('.kkk.....kkk.\nkiiik...kiiik\n.kkk.....kkk.', 16, 15);
  p.set(f ? 17 : 18, 16, 'g').set(f ? 28 : 26, 16, 'g');
  for (let y = 12; y < 19; y++) p.set(26 + (y % 2), y, 'q');
  // A strand hanging down over the rim of the plate, all the way to the floor.
  for (let y = 26; y < 40; y++) p.set(39 + Math.round(Math.sin(y * 0.5 + f) * 1), y, y < 31 ? 'Q' : 'c');
  // The fork planted in the heap (it leans in frame 2).
  const fx = f ? 31 : 30;
  for (let y = 0; y < 9; y++) p.set(fx + (f ? Math.floor((9 - y) / 4) : 0), y, y < 2 ? 'W' : 'g').set(fx + 1 + (f ? Math.floor((9 - y) / 4) : 0), y, 'G');
  // The fridge note stuck to the side: « Il y a des pâtes. »
  p.stamp('yyyyy\nyGGGy\nyyyyy\nyGGyy\nYYYYY', 4, 17);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Mot Aimanté (42x38) — un dentier de farces et attrapes, aimanté au frigo : gencives roses, deux yeux qui roulent,
// une clé de remontoir, des pieds orange, et des lettres en plastique coincées entre les dents.
// Frame 2 : la mâchoire s'ouvre, une lettre apparaît, la clé a tourné.
// ---------------------------------------------------------------------------------------------------------------------
function motAimante(f: number): string {
  const p = new Pix(42, 38);
  const open = f ? 3 : 1;
  // Feet.
  p.stamp('.oooooo.\nooooooooo\n.OOOOOOO.', 7, 34);
  p.stamp('.oooooo.\nooooooooo\n.OOOOOOO.', 25, 34);
  p.rect(11, 31, 2, 3, 'O').rect(29, 31, 2, 3, 'O');
  // Lower jaw: gum and teeth.
  p.ball(21, 27 + open, 17, 5, ['p', 'p', 'P', 'R']);
  p.rect(5, 22 + open, 33, 4, 'p');
  for (let i = 0; i < 8; i++) {
    const x = 7 + i * 4;
    p.rect(x, 20 + open, 3, 4, 'w').set(x + 2, 23 + open, 'W').set(x, 20 + open, 'W');
  }
  // Mouth inside (dark) with plastic letters.
  p.rect(7, 15, 29, 5 + open, 'i');
  p.stamp('rrr\n..r\nr.r\n.r.', 10, 15 + (f ? 1 : 0));
  p.stamp('BBB\nB..\nBB.\nBBB', 17, 15 + (f ? 2 : 1));
  if (f) p.stamp('yyy\n.y.\n.y.\n.y.', 25, 16);
  // Upper jaw.
  p.ball(21, 9, 17, 6, ['p', 'p', 'P', 'R']);
  p.rect(4, 9, 35, 4, 'p');
  p.rim('p', 'P', 0, 1, 1);
  for (let i = 0; i < 8; i++) {
    const x = 7 + i * 4;
    p.rect(x, 13, 3, 4, 'w').set(x, 13, 'f').set(x + 2, 16, 'W');
  }
  // A gold tooth.
  p.rect(23, 13, 3, 4, 'Y').set(23, 13, 'y');
  // Googly eyes on top, looking two different ways.
  p.stamp('.kkkk.\nkwwwwk\nkwwwwk\nkwwwwk\n.kkkk.', 9, 0);
  p.stamp('.kkkk.\nkwwwwk\nkwwwwk\nkwwwwk\n.kkkk.', 25, 0);
  p.rect(f ? 10 : 12, f ? 1 : 2, 2, 2, 'i');
  p.rect(f ? 28 : 26, f ? 3 : 1, 2, 2, 'i');
  // The wind-up key on the side.
  const kx = 38;
  p.rect(kx, 18, 2, 2, 'G');
  p.stamp(f ? 'g.\ngg\ngW\ng.' : 'ggg\ngWg\n.g.', kx + (f ? 2 : 1), f ? 15 : 14);
  // Ink drool.
  p.set(15, 27 + open, 'i').set(15, 28 + open, 'i');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Dé-Chevalier (40x46) — un dé à coudre en armure : visière fendue, deux yeux rouges, une épingle pour lance (une goutte
// d'encre rouge au bout), un bouton pour bouclier. Frame 2 : la lance se lève, les yeux clignent.
// ---------------------------------------------------------------------------------------------------------------------
function deChevalier(f: number): string {
  const p = new Pix(40, 46);
  // Little felt legs.
  p.rect(14, 38, 3, 6, 'd').rect(22, 38, 3, 6, 'd');
  p.rect(13, 44, 5, 2, 'K').rect(22, 44, 5, 2, 'K');
  // Felt cape behind.
  p.poly([[11, 16], [29, 16], [31, 40], [9, 40]], 'R');
  p.poly([[12, 17], [20, 17], [16, 40], [10, 40]], 'r');
  // The thimble: a dome over a slightly tapered cylinder, dimpled.
  const t = new Pix(40, 46);
  t.poly([[10, 12], [30, 12], [29, 38], [11, 38]], 'g');
  t.ball(20, 12, 10, 8, METAL);
  t.rect(10, 12, 21, 1, 'g');
  t.rim('g', 'w', -1, 0, 2).rim('g', 'G', 1, 0, 3);
  for (let y = 15; y < 37; y += 3) for (let x = 12 + ((y / 3) % 2); x < 29; x += 3) if (t.get(x, y) !== '.') t.set(x, y, 'G');
  for (let y = 6; y < 12; y += 2) for (let x = 14 + ((y / 2) % 2) * 2; x < 27; x += 4) if (t.get(x, y) !== '.') t.set(x, y, 'G');
  t.rect(10, 36, 21, 2, 'G');
  p.blit(t);
  // Visor slit and eyes.
  p.rect(12, 18, 17, 4, 'i');
  if (!f) p.set(15, 19, 'r').set(16, 19, 'r').set(24, 19, 'r').set(25, 19, 'r');
  else p.rect(15, 20, 2, 1, 'r').rect(24, 20, 2, 1, 'r');
  // The button shield on the left arm.
  p.ball(7, 28, 6, 6, ['c', 'c', 'C', 'x']);
  p.set(5, 26, 'x').set(9, 26, 'x').set(5, 30, 'x').set(9, 30, 'x');
  p.line(5, 26, 9, 30, 'r').line(9, 26, 5, 30, 'r');
  // The pin-lance: from the right hand, rising (frame 2 higher).
  const hy = f ? 22 : 26;
  const tipY = f ? 0 : 6;
  p.line(32, hy + 4, 38, tipY, 'g');
  p.line(33, hy + 4, 39, tipY, 'W');
  p.rect(30, hy + 3, 4, 4, 'r').set(30, hy + 3, 'p');
  p.set(38, tipY - 1, 'r');
  p.rect(30, hy, 3, 3, 'G');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Poupée Brouillon (36x54) — une poupée pas finie, en feutre blanc : ni visage, ni cheveux, ni signe distinctif. Des
// épingles la tiennent encore, un trait de craie bleue fait le tour du cou (« couper ici »), un bras n'est pas cousu,
// des fils pendent, une étiquette vide. Frame 2 : la tête penche, le bras épinglé glisse.
// ---------------------------------------------------------------------------------------------------------------------
function poupeeBrouillon(f: number): string {
  const p = new Pix(36, 54);
  const hx = 18 + (f ? 1 : 0);
  // Legs (uneven), body, unfinished arm stumps.
  p.rect(12, 40, 5, 12, 'W').rect(20, 40, 5, 10, 'W');
  p.rect(12, 40, 1, 12, 'w').rect(20, 40, 1, 10, 'w');
  p.blob(
    [
      [18, 30, 9],
      [18, 37, 8],
    ],
    FELT_WHITE,
    [18, 32, 10, 12],
  );
  // The left arm, sewn on.
  p.poly([[8, 25], [11, 25], [7, 41], [4, 40]], 'W');
  p.line(8, 25, 4, 40, 'w');
  // The right arm, not sewn: held by two pins, with a gap (it slides in frame 2).
  const ay = f ? 2 : 0;
  p.poly([[27, 27 + ay], [30, 27 + ay], [33, 42 + ay], [30, 43 + ay]], 'W');
  p.line(30, 27 + ay, 33, 42 + ay, 'g');
  p.line(25, 26, 31, 29 + ay, 'g');
  p.rect(30, 28 + ay, 2, 2, 'y');
  p.line(26, 33, 31, 36 + ay, 'g');
  p.rect(31, 35 + ay, 2, 2, 'B');
  // The side seam was never closed: a dark slit, hollow inside, the thread hanging out.
  for (let y = 29; y < 40; y++) {
    const w = y < 31 || y > 37 ? 1 : 2;
    p.rect(22, y, w, 1, 'i');
    if (w === 2) p.set(24, y, 'g');
  }
  p.set(21, 30, 'G').set(21, 33, 'G').set(21, 36, 'G').set(24, 31, 'G').set(24, 34, 'G');
  // Unfinished seams: dashed, the thread hanging.
  stitchLine(p, 18, 24, 18, 28, 'G');
  stitchLine(p, 10, 30, 10, 44, 'G', 1);
  for (let y = 44; y < 51; y++) p.set(18 + Math.round(Math.sin(y * 0.6 + f) * 1), y, 'g');
  // Head: blank felt, a little lopsided.
  p.ball(hx, 13, 9, 10, FELT_WHITE);
  p.set(hx - 4, 12, 'g').set(hx + 3, 12, 'g');
  // Pencil marks where a face should go: two tiny crosses, a dotted line.
  p.set(hx - 4, 11, 'G').set(hx - 3, 12, 'G').set(hx - 5, 12, 'G').set(hx - 4, 13, 'G');
  p.set(hx + 3, 11, 'G').set(hx + 2, 12, 'G').set(hx + 4, 12, 'G').set(hx + 3, 13, 'G');
  for (let x = hx - 3; x <= hx + 3; x += 2) p.set(x, 17, 'g');
  // Pins in the head.
  p.line(hx - 6, 2, hx - 3, 6, 'g').rect(hx - 7, 1, 2, 2, 'r');
  p.line(hx + 8, 6, hx + 5, 9, 'g').rect(hx + 8, 5, 2, 2, 'Y');
  // The tailor's chalk line round the neck: « couper ici ».
  for (let x = 12; x < 26; x++) if (x % 3 !== 0) p.set(x, 23, 'b');
  // The blank label on a string.
  p.line(9, 31, 4, 33, 'G');
  p.rect(1, 33, 5, 4, 'q').rect(1, 36, 5, 1, 'Q');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Clé (44x48) — une petite clé argentée qui tremble dans une serrure bien trop grande : une plaque de laiton, un trou de
// serrure immense, et la clé dedans, deux yeux affolés dans l'anneau. Frame 2 : elle tremble (décalée, traits de
// tremblement).
// ---------------------------------------------------------------------------------------------------------------------
function cle(f: number): string {
  const p = new Pix(44, 48);
  // The brass lock plate.
  const plate = new Pix(44, 48);
  plate.rect(6, 4, 32, 42, 'Y');
  plate.stamp('~~~\n~~.\n~..', 6, 4).stamp('~~~\n.~~\n..~', 35, 4).stamp('~..\n~~.\n~~~', 6, 43).stamp('..~\n.~~\n~~~', 35, 43);
  plate.rim('Y', 'y', 0, -1, 2).rim('Y', 'y', -1, 0, 2).rim('Y', 'O', 1, 0, 3).rim('Y', 'O', 0, 1, 3);
  p.blit(plate.contour('x'));
  // Screws.
  for (const [sx, sy] of [
    [9, 7],
    [33, 7],
    [9, 41],
    [33, 41],
  ] as const)
    p.stamp('xx\nxO', sx, sy);
  // Scratches all around the keyhole: someone missed it, again and again.
  const scr = seeded(9);
  for (let i = 0; i < 16; i++) {
    const a = scr() * Math.PI * 2;
    const r0 = 9 + scr() * 4;
    const x0 = 22 + Math.cos(a) * r0;
    const y0 = 24 + Math.sin(a) * r0 * 1.4;
    p.line(Math.round(x0), Math.round(y0), Math.round(x0 + Math.cos(a) * 3), Math.round(y0 + Math.sin(a) * 3), 'O');
  }
  // The huge keyhole.
  p.ellipse(22, 17, 7, 7, 'i');
  p.poly([[17, 20], [27, 20], [30, 39], [14, 39]], 'i');
  // The key, trembling inside: bow (with eyes) on top, shaft, bit.
  const dx = f ? 1 : 0;
  const k = new Pix(44, 48);
  k.ellipse(22 + dx, 15, 5, 5, 'g');
  k.ellipse(22 + dx, 15, 2.5, 2.5, '.');
  k.rect(21 + dx, 20, 3, 14, 'g');
  k.rect(24 + dx, 28, 3, 2, 'g').rect(24 + dx, 31, 4, 2, 'g');
  k.rim('g', 'w', -1, 0, 1).rim('g', 'G', 1, 0, 1);
  p.blit(k.contour('d'));
  // Two frightened eyes in the bow.
  p.set(21 + dx, 14, 'w').set(23 + dx, 14, 'w').set(21 + dx, 15, 'i').set(23 + dx, 15, 'i');
  p.set(21 + dx, 13, 'k').set(23 + dx, 13, 'k');
  // Trembling marks.
  if (f) p.stamp('W...........W\n.W.........W.\nW...........W', 15, 10);
  else p.stamp('.W.........W.\nW...........W', 15, 24);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Poupée-Maman (44x70) — Maman en feutre : un chignon de laine traversé par deux aiguilles à tricoter, des yeux-boutons,
// une bouche cousue en sourire, trop large ; un tablier taché, une louche de pâtes en laine dans une main, un vieux
// téléphone cousu dans l'autre, le fil qui pend jusqu'au sol. Frame 2 : la tête penche, le fil du téléphone se balance.
// ---------------------------------------------------------------------------------------------------------------------
const MAMAN_HAIR: Ramp = ['C', 'x', 'x', 'K'];
const FELT_SKIN: Ramp = ['6', '6', '7', '7'];
function poupeeMaman(f: number): string {
  const p = new Pix(44, 70);
  // Shoes and legs.
  p.rect(15, 64, 6, 3, 'K').rect(24, 64, 6, 3, 'K');
  p.rect(17, 58, 3, 6, '7').rect(25, 58, 3, 6, '7');
  // Dress: a long felt bell.
  p.poly([[14, 28], [30, 28], [36, 60], [8, 60]], 'P');
  p.poly([[14, 28], [20, 28], [15, 60], [8, 60]], 'p');
  p.rect(8, 59, 29, 2, 'R');
  // Apron, with a grey stain and a pocket.
  p.poly([[15, 34], [29, 34], [32, 57], [12, 57]], 'w');
  p.poly([[25, 34], [29, 34], [32, 57], [27, 57]], 'W');
  p.rect(12, 57, 21, 1, 'g');
  p.ellipse(25, 47, 3, 2, 'g').set(24, 46, 'G').set(26, 48, 'G');
  p.rect(15, 49, 6, 4, 'W').rect(15, 49, 6, 1, 'g');
  stitchLine(p, 15, 34, 12, 57, 'g');
  // Apron straps.
  p.line(16, 34, 18, 27, 'w').line(28, 34, 26, 27, 'w');
  // Left arm (her right): holds the ladle of yarn noodles.
  p.poly([[13, 29], [16, 30], [9, 46], [6, 45]], 'P');
  p.ball(7, 46, 2.5, 2.5, FELT_SKIN);
  p.line(7, 46, 3, 30, 'g').line(8, 46, 4, 30, 'G');
  p.ball(4, 50, 4, 3, METAL);
  for (let i = 0; i < 4; i++) for (let y = 51; y < 56 + i; y++) p.set(2 + i * 2, y + (i % 2), y % 2 ? 'Q' : 'q');
  // Right arm (her left): the phone, sewn into the hand.
  p.poly([[30, 29], [33, 30], [36, 40], [33, 41]], 'P');
  // An old handset, held upright: earpiece, handle, mouthpiece.
  p.stamp(
    `
    .kkkk.
    kGgggk
    kGGGGk
    .kGk..
    .kGk..
    .kGk..
    .kGk..
    kGgggk
    kGGGGk
    .kkkk.
    `,
    33,
    33,
  );
  p.ball(35, 40, 2.5, 2.5, FELT_SKIN);
  // Sewn into her hand.
  p.set(33, 39, 'r').set(35, 41, 'r').set(37, 39, 'r').set(34, 40, 'r').set(36, 40, 'r');
  // The phone cord, curling down to the floor.
  for (let y = 43; y < 68; y++) {
    const x = 36 + Math.round(Math.sin(y * 0.9 + (f ? 1.4 : 0)) * 1.5 + (f ? (y - 43) * 0.06 : 0) + (y - 43) * 0.08);
    p.set(x, y, y % 2 ? 'd' : 'G');
  }
  // Head (tilts in frame 2).
  const hx = 22 + (f ? 1 : 0);
  const hy = 16 + (f ? 1 : 0);
  p.rect(20, 26, 5, 3, '7');
  p.ball(hx, hy, 10, 10, FELT_SKIN);
  // Hair: a yarn helmet, the bun, the knitting needles.
  p.ball(hx, hy - 7, 11, 5, MAMAN_HAIR);
  p.ball(hx, hy - 13, 5, 4, MAMAN_HAIR);
  p.rect(hx - 11, hy - 6, 3, 10, 'x').rect(hx + 9, hy - 6, 3, 10, 'x');
  for (let i = 0; i < 7; i++) p.set(hx - 9 + i * 3, hy - 8 + (i % 2), 'K');
  p.line(hx - 7, hy - 20, hx - 2, hy - 12, 'g').line(hx + 7, hy - 19, hx + 3, hy - 12, 'g');
  p.rect(hx - 8, hy - 21, 2, 2, 'r').rect(hx + 7, hy - 20, 2, 2, 'B');
  // Button eyes; the felt under them is darker, like tiredness.
  buttonEye(p, hx - 7, hy - 3);
  buttonEye(p, hx + 3, hy - 3);
  for (let x = -6; x <= -4; x++) p.set(hx + x, hy + 3, '7');
  for (let x = 4; x <= 6; x++) p.set(hx + x, hy + 3, '7');
  // The sewn smile: far too wide, a red seam with a tick at every stitch.
  const smile = [
    [-9, 3],
    [-8, 4],
    [-7, 5],
    [-6, 6],
    [-5, 6],
    [-4, 7],
    [-3, 7],
    [-2, 7],
    [-1, 7],
    [0, 7],
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 6],
    [6, 6],
    [7, 5],
    [8, 4],
    [9, 3],
  ] as const;
  for (const [sx, sy] of smile) p.set(hx + sx, hy + sy, 'R');
  for (const [sx, sy] of smile.filter((_, i) => i % 3 === 1)) p.set(hx + sx, hy + sy - 1, 'R').set(hx + sx, hy + sy + 1, 'R');
  return p.toString();
}

// The doll-mother, tiny, walking inside the box between the plates (pattern projectile, harmless).
const MAMAN_MINI = `
  ..xxx...
  .xxxxx..
  .x66x6..
  ..666...
  .PwwwP..
  PPwwwPPg
  .PwwwP.G
  .PPPPP..
  ..K.K...
`;

// ---------------------------------------------------------------------------------------------------------------------
// La Couseuse (80x66, boss) — une vieille machine à coudre noire à décors dorés, dont la tête est une tête de mouton :
// laine sale, une couture en travers du front, deux yeux-boutons dépareillés, une bouche cousue en croix. Une bobine de
// fil rouge presque vide, un volant, et sous l'aiguille, un morceau de feutre rose. Frame 2 : l'aiguille descend et
// perce le feutre, le volant a tourné, le fil se tend.
// ---------------------------------------------------------------------------------------------------------------------
const WOOL_DIRTY: Ramp = ['w', 'W', 'g', 'G'];
function couseuse(f: number): string {
  const p = new Pix(80, 66);
  // Wooden base.
  p.rect(2, 56, 76, 8, 'C');
  p.rect(2, 56, 76, 1, 'c').rect(2, 63, 76, 1, 'x').rect(2, 57, 1, 6, 'c').rect(77, 57, 1, 6, 'x');
  // Tally marks carved into the base: bundles of five, a lot of them.
  for (let g = 0; g < 9; g++) {
    const x0 = 5 + g * 8;
    for (let i = 0; i < 4; i++) p.rect(x0 + i, 58, 1, 4, 'x');
    p.line(x0 - 1, 61, x0 + 4, 58, 'x');
  }
  // The bed of the machine.
  const m = new Pix(80, 66);
  m.rect(6, 48, 68, 8, 'K');
  // Pillar and arm.
  m.rect(54, 14, 15, 34, 'K');
  m.rect(22, 10, 47, 13, 'K');
  m.stamp('~~\n~.', 67, 10).stamp('~~\n~.', 22, 10);
  m.rim('K', 'd', 0, -1, 1).rim('K', 'd', -1, 0, 1).rim('K', 'i', 1, 0, 2).rim('K', 'i', 0, 1, 2);
  p.blit(m);
  // Gold decals: little flowers and scrolls along the arm and the pillar.
  const rnd = seeded(7);
  for (let i = 0; i < 26; i++) {
    const onArm = i < 15;
    const x = onArm ? 26 + Math.floor(rnd() * 26) : 57 + Math.floor(rnd() * 9);
    const y = onArm ? 13 + Math.floor(rnd() * 7) : 25 + Math.floor(rnd() * 18);
    p.set(x, y, rnd() > 0.4 ? 'Y' : 'y');
  }
  p.stamp('.Y.\nYyY\n.Y.', 40, 15).stamp('.Y.\nYyY\n.Y.', 59, 32);
  // Needle plate (chrome) on the bed.
  p.rect(8, 48, 22, 2, 'g').rect(8, 48, 22, 1, 'W');
  // The pink felt being sewn.
  p.poly([[6, 46], [30, 45], [32, 49], [8, 50]], 'p');
  stitchLine(p, 8, 47, 18 + (f ? 2 : 0), 47, 'R');
  // Handwheel on the right, with turning spokes.
  p.ball(71, 26, 8, 8, METAL);
  p.ellipse(71, 26, 5, 5, 'G');
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + (f ? 0.6 : 0);
    p.line(71, 26, 71 + Math.round(Math.cos(a) * 5), 26 + Math.round(Math.sin(a) * 5), 'g');
  }
  p.set(71, 26, 'w');
  // The spool on top: almost empty.
  p.rect(43, 2, 2, 8, 'g');
  p.rect(40, 4, 8, 6, 'C').rect(40, 4, 8, 1, 'c').rect(41, 5, 6, 3, 'R').rect(41, 5, 2, 3, 'r');
  // Thread: spool → guides → down to the needle.
  p.line(42, 6, 30, 9, 'r');
  p.line(30, 9, 22, 12, 'r');
  // Needle bar and needle (frame 2: down through the felt).
  const tip = f ? 50 : 43;
  p.rect(13, 30, 3, tip - 34, 'g').rect(13, 30, 1, tip - 34, 'W');
  p.set(14, tip - 4, 'W').set(14, tip - 3, 'w').set(14, tip - 2, 'g').set(14, tip - 1, 'g');
  p.line(22, 12, 15, tip - 5, 'r');
  // Presser foot.
  p.rect(10, 42, 3, 4, 'G').rect(8, 46, 7, 1, 'g');
  // The sheep head, where the machine's head should be.
  p.blob(
    [
      [14, 18, 11],
      [6, 12, 6],
      [22, 11, 6],
      [14, 8, 7],
      [7, 25, 6],
      [21, 25, 6],
    ],
    WOOL_DIRTY,
    [14, 17, 13, 13],
  );
  for (let i = 0; i < 26; i++) {
    const x = 3 + Math.floor(rnd() * 23);
    const y = 4 + Math.floor(rnd() * 26);
    if (p.get(x, y) === 'W') p.set(x, y, 'g');
    else if (p.get(x, y) === 'w') p.set(x, y, 'W');
  }
  // Felt face.
  p.ball(14, 20, 7, 8, ['q', 'q', 'Q', 'c']);
  // Floppy ears.
  p.poly([[5, 15], [0, 23], [3, 25], [7, 18]], 'C');
  p.poly([[23, 15], [28, 23], [25, 25], [21, 18]], 'C');
  p.line(4, 17, 2, 22, 'c').line(24, 17, 26, 22, 'x');
  // A seam across the forehead.
  stitchLine(p, 8, 14, 20, 13, 'R');
  // Mismatched button eyes: a big black one, a small red one.
  buttonEye(p, 8, 17);
  p.stamp('.kk.\nkrRk\nkRrk\n.kk.', 16, 18);
  // Mouth sewn in a cross.
  crossStitch(p, 12, 24, 'R');
  crossStitch(p, 15, 24, 'R');
  // A loose thread from the mouth.
  for (let y = 27; y < 33; y++) p.set(17 + (y % 2), y, 'r');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Le Petit Homme de la Maison (70x84, boss) — une poupée-Noa géante en tablier de Maman : cheveux de laine, yeux-boutons,
// bouche cousue ; ses bras sont cousus à son torse, à gros points rouges, autour de la veilleuse-lune allumée. La lumière
// passe entre les points. Frame 2 : la lumière palpite, la tête penche un peu.
// `open`: épargné — les bras se sont ouverts, les points ont sauté, la veilleuse est tombée.
// ---------------------------------------------------------------------------------------------------------------------
const NOA_HAIR: Ramp = ['J', 'h', 'H', 'z'];
const SWEATER: Ramp = ['j', 'n', 'z', 'Z'];
function petitHomme(f: number, open = false): string {
  const p = new Pix(70, 84);
  // Legs and felt slippers.
  p.rect(24, 72, 8, 8, 'z').rect(38, 72, 8, 8, 'z');
  p.ball(27, 80, 6, 3, ['b', 'B', 'n', 'n']).ball(43, 80, 6, 3, ['b', 'B', 'n', 'n']);
  // Torso: a big sweater.
  p.blob(
    [
      [35, 52, 18],
      [35, 64, 15],
    ],
    SWEATER,
    [35, 56, 20, 20],
  );
  // Maman's apron: pink, flowered, lace at the hem, too big, a double knot.
  p.poly([[21, 42], [49, 42], [53, 74], [17, 74]], 'p');
  p.poly([[42, 42], [49, 42], [53, 74], [46, 74]], 'P');
  for (let y = 46; y < 72; y += 5) for (let x = 21 + ((y / 5) % 2) * 3; x < 50; x += 6) if (p.get(x, y) === 'p') p.set(x, y, 'w').set(x + 1, y, 'f');
  for (let x = 17; x < 54; x++) p.set(x, 74, x % 2 ? 'w' : 'W');
  for (let x = 18; x < 53; x += 2) p.set(x, 75, 'w');
  p.line(23, 42, 27, 34, 'p').line(47, 42, 43, 34, 'p');
  // Head and neck.
  p.rect(30, 30, 10, 6, '7');
  const hx = 35 + (f && !open ? 1 : 0);
  const hy = 19;
  p.ball(hx, hy, 14, 13, FELT_SKIN);
  // Yarn hair, messy.
  p.blob(
    [
      [hx, hy - 10, 12],
      [hx - 12, hy - 4, 4],
      [hx + 12, hy - 4, 4],
      [hx - 5, hy - 13, 6],
      [hx + 6, hy - 14, 6],
    ],
    NOA_HAIR,
    [hx, hy - 9, 16, 9],
  );
  p.rect(hx - 9, hy - 6, 18, 2, 'h');
  for (let i = 0; i < 8; i++) p.set(hx - 8 + i * 2, hy - 5, i % 2 ? 'h' : '6');
  for (const [lx, ly] of [
    [hx - 12, hy - 14],
    [hx + 2, hy - 18],
    [hx + 12, hy - 13],
  ] as const)
    p.stamp('.hh\nh.h\nhh.', lx, ly);
  // Button eyes.
  buttonEye(p, hx - 9, hy - 1, 'K', 'g', 'K');
  buttonEye(p, hx + 4, hy - 1, 'K', 'g', 'K');
  // The mouth.
  if (!open) {
    p.rect(hx - 5, hy + 8, 11, 1, 'R');
    for (let i = 0; i < 4; i++) crossStitch(p, hx - 5 + i * 3, hy + 7, 'R');
  } else {
    // The stitches have popped, one by one: the mouth is a seam of empty holes, half open; two thread ends curl.
    p.rect(hx - 3, hy + 8, 7, 1, 'K');
    for (let i = 0; i < 4; i++) p.set(hx - 5 + i * 3, hy + 7, '7').set(hx - 5 + i * 3, hy + 9, '7');
    p.set(hx - 6, hy + 7, 'r').set(hx - 7, hy + 6, 'r');
    p.set(hx + 5, hy + 9, 'r').set(hx + 6, hy + 10, 'r').set(hx + 7, hy + 10, 'r');
  }
  if (!open) {
    // The nightlight: a crescent moon on a little base, in a halo of light.
    p.ellipse(35, 51, 11, 10, f ? 'f' : 'q');
    p.ellipse(35, 51, 9, 8, f ? 'q' : 'y');
    const moon = new Pix(70, 84);
    moon.ellipse(34, 51, 7, 7, 'Y');
    moon.ellipse(37, 49, 6, 6, '.');
    for (let y = 40; y < 60; y++) for (let x = 25; x < 45; x++) if (moon.get(x, y) === 'Y') p.set(x, y, 'Y');
    p.set(29, 48, 'y').set(29, 49, 'y').set(30, 46, 'y');
    p.rect(30, 59, 10, 3, 'W').rect(30, 61, 10, 1, 'g');
    // Arms hugging it, sewn to the torso.
    p.poly([[15, 40], [22, 38], [32, 52], [29, 58]], 'n');
    p.poly([[55, 40], [48, 38], [38, 52], [41, 58]], 'n');
    p.line(15, 40, 29, 58, 'j');
    p.ball(30, 57, 3.5, 3, FELT_SKIN).ball(40, 57, 3.5, 3, FELT_SKIN);
    for (const [cx, cy] of [
      [19, 44],
      [24, 49],
      [47, 44],
      [43, 49],
    ] as const)
      crossStitch(p, cx, cy, 'R');
    // Light leaking between the stitches.
    for (const [lx, ly] of [
      [22, 47],
      [27, 52],
      [45, 47],
      [41, 52],
      [35, 41],
    ] as const)
      p.set(lx, ly, f ? 'f' : 'y');
  } else {
    // Arms open, hanging; the chest full of stitch holes and loose threads.
    p.poly([[15, 40], [21, 38], [12, 66], [7, 64]], 'n');
    p.poly([[55, 40], [49, 38], [58, 66], [63, 64]], 'n');
    p.ball(9, 67, 3.5, 3, FELT_SKIN).ball(61, 67, 3.5, 3, FELT_SKIN);
    // Stitch holes where the arms were sewn, and loose thread loops.
    for (const [cx, cy] of [
      [23, 46],
      [27, 51],
      [43, 46],
      [39, 51],
    ] as const) {
      p.set(cx, cy, 'P').set(cx + 2, cy, 'P').set(cx + 1, cy + 1, 'P');
      p.stamp('.r.\nr.r\n.rr', cx + 3, cy - 1);
    }
  }
  return p.toString();
}

/** The Petit Homme is drawn on 84 rows; the arena has 82: two rows of apron hem and two of legs go. */
function shorter(art: string): string {
  const drop = new Set([66, 67, 74, 75]);
  return art
    .split('\n')
    .filter((_, y) => !drop.has(y))
    .join('\n');
}

/** The nightlight once it has fallen (spared) — or cracked from one side to the other (beaten). */
function fallenLamp(cracked: boolean): string {
  const p = new Pix(16, 14);
  p.ellipse(7, 6, 6, 6, cracked ? 'Y' : 'y');
  p.ellipse(10, 4, 5, 5, '.');
  p.rim(cracked ? 'Y' : 'y', cracked ? 'O' : 'Y', 1, 1, 1);
  p.rect(3, 11, 10, 3, 'W').rect(3, 13, 10, 1, 'g');
  if (cracked) {
    p.set(3, 2, 'K').set(4, 3, 'K').set(3, 4, 'K').set(4, 5, 'K').set(5, 6, 'K').set(4, 7, 'K').set(5, 8, 'K').set(6, 9, 'K').set(7, 10, 'K');
    p.set(6, 11, 'K').set(7, 12, 'K');
  } else p.set(2, 4, 'q').set(2, 5, 'q').set(3, 3, 'q');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Mina n°366 — portraits (32x32), made from Mina's own face: felt skin, a felt crown sewn on with red thread, button
// eyes, a smile embroidered in red. `still`: the doll on the chair — faded, one button sagging, the smile thread loose.
// ---------------------------------------------------------------------------------------------------------------------
function mina366Face(expr: 'neutral' | 'happy' | 'sad' | 'still'): string {
  const src = CHAR_ART.face_mina_neutral!;
  const p = Pix.of(typeof src === 'string' ? src : src.art);
  p.recolor({ s: '6', S: '7', t: '7', y: 'Y', Y: 'O' });
  p.recolor({ r: 'R' }, 0, 0, 31, 6);
  // The crown is sewn on: red stitches along its base.
  for (let x = 9; x <= 22; x += 2) p.set(x, 6, 'R');
  // Clear the eyes and the mouth, then sew the buttons and the smile.
  p.rect(8, 17, 6, 5, '6').rect(18, 17, 6, 5, '6').rect(13, 22, 6, 3, '6');
  const sag = expr === 'still' ? 1 : 0;
  buttonEye(p, 8, 17);
  buttonEye(p, 18, 17 + sag);
  p.set(7, 22, 'p').set(8, 22, 'p').set(23, 22, 'p').set(24, 22, 'p');
  if (expr === 'happy') {
    p.set(12, 22, 'R').set(19, 22, 'R');
    stitchLine(p, 13, 23, 18, 23, 'R');
    p.set(13, 24, 'r').set(15, 24, 'r').set(17, 24, 'r');
  } else if (expr === 'sad') {
    p.set(12, 24, 'R').set(19, 24, 'R');
    stitchLine(p, 13, 23, 18, 23, 'R');
  } else {
    p.set(12, 22, 'R').set(19, 22, 'R');
    for (let x = 13; x <= 18; x++) p.set(x, 23, x % 2 ? 'R' : 'r');
    if (expr === 'still') {
      // One end of the thread came loose and hangs.
      p.set(19, 22, '6');
      for (let y = 23; y < 28; y++) p.set(19 + (y % 2), y, 'r');
    }
  }
  return p.toString();
}

/** The faded colors of the still doll. */
function fade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const l = (r + g + b) / 3;
  const mix = (c: number) => Math.round(c * 0.45 + l * 0.4 + 18);
  return `#${[mix(r), mix(g), mix(b)].map((c) => Math.min(255, c).toString(16).padStart(2, '0')).join('')}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Overworld (≈16x16 with the outline)
// ---------------------------------------------------------------------------------------------------------------------

const OW_PATE = `
  ....QQqQ....
  ..QcQQQqQ...
  .QQkkQkkQQ..
  .9QQQQQcQQ..
  .wwwwwwwwww.
  ..gWWWWWWg..
  ..g.g..g.g..
  .g.g..g.g...
`;
const OW_MOT = `
  .kwk..kwk...
  .pppppppppp.
  pwwwwwwwwwwp
  .iiriiBiii..
  pwwwwwwwwwwp
  .pppppppppp.
  ..oo....oo..
`;
const OW_DE = `
  ....ggg.....
  ...gwggg..W.
  ..gwgGgGg.g.
  ..giiiiig.g.
  ..gwgGgGgrr.
  ..gwgGgGg...
  ..GGGGGGG...
  ...d...d....
`;
const OW_BROUILLON = `
  ...WWWW...
  ..WwwwWW..
  .rWwGwGW..
  ..WwwwW...
  ..bbbbb...
  .WwwWWwW..
  W.WWWWW.W.
  ..WW.WW...
  ..W...W...
`;
const OW_CLE = `
  .xxxxxxxx.
  xYYYYYYYYx
  xYYggiYYYx
  xYgwgiYYYx
  xYYggiYYYx
  xYYYgiiYYx
  xYYYgiiYYx
  xYYYggiYYx
  xYYYiiiYYx
  .xxxxxxxx.
`;

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

const o = (art: string, extra: Partial<Exclude<SpriteDef, string>> = {}): SpriteDef => ({ art, outline: 'k', colors: C4_COLORS, ...extra });

export const ART: Record<string, SpriteDef> = {
  b_pate_froide: o(pateFroide(0)),
  b_pate_froide_2: o(pateFroide(1)),
  b_mot_aimante: o(motAimante(0)),
  b_mot_aimante_2: o(motAimante(1)),
  b_de_chevalier: o(deChevalier(0)),
  b_de_chevalier_2: o(deChevalier(1)),
  b_poupee_brouillon: o(poupeeBrouillon(0)),
  b_poupee_brouillon_2: o(poupeeBrouillon(1)),
  b_cle: o(cle(0)),
  b_cle_2: o(cle(1)),
  b_poupee_maman: o(poupeeMaman(0)),
  b_poupee_maman_2: o(poupeeMaman(1)),
  b_maman_mini: o(MAMAN_MINI),
  b_couseuse: o(couseuse(0)),
  b_couseuse_2: o(couseuse(1)),
  b_petit_homme: o(shorter(petitHomme(0))),
  b_petit_homme_2: o(shorter(petitHomme(1))),
  b_petit_homme_open: o(shorter(petitHomme(0, true))),
  b_c4_veilleuse: o(fallenLamp(false)),
  b_c4_veilleuse_fele: o(fallenLamp(true)),

  face_mina366_neutral: { art: mina366Face('neutral'), colors: C4_COLORS },
  face_mina366_happy: { art: mina366Face('happy'), colors: C4_COLORS },
  face_mina366_sad: { art: mina366Face('sad'), colors: C4_COLORS },
  face_mina366_still: { art: mina366Face('still'), colors: C4_COLORS, transform: fade },

  ow_pate_froide: o(OW_PATE),
  ow_pate_froide_2: o(flipArt(OW_PATE)),
  ow_mot_aimante: o(OW_MOT),
  ow_mot_aimante_2: o(Pix.of(OW_MOT).move(0, 3, 12, 4, 0, 1).toString()),
  ow_de_chevalier: o(OW_DE),
  ow_de_chevalier_2: o(Pix.of(OW_DE).move(9, 0, 3, 5, 0, 1).toString()),
  ow_poupee_brouillon: o(OW_BROUILLON),
  ow_poupee_brouillon_2: o(Pix.of(OW_BROUILLON).move(1, 0, 8, 4, 1, 0).toString()),
  ow_cle: o(OW_CLE),
  ow_cle_2: o(Pix.of(OW_CLE).move(3, 2, 4, 7, 1, 0).toString()),
};

export const VARIANTS: string[] = [];


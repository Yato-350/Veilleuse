import type { SpriteDef } from '../../game/assets';
import { mix, PAL } from '../../engine/palette';
import { Pix } from './enemies';
import { ART as BONUS_ART } from './bonus';

/*
 * Chapter 3 « L'Hôpital de Papier », version 2 additions (docs/HISTOIRE.md § 3.8, lot 8).
 *
 * - `npc_infirmiere_papier` (+ `_2`, the paper stirring in the draught): the paper nurses. Nadia's figure from the
 *   bonus chapter, folded out of paper: no face, only the crease down the middle; a white badge (« NADIA », too small
 *   to read at this size: the text says it).
 * - `b_bracelet` (+ `_2`), `ow_bracelet` (+ `_2`): Bracelet, a hospital wristband crawling like a worm. The clasp is its
 *   head and the two press studs its eyes; pink pediatric stripes, adjustment holes along the tail. The white print
 *   area of its body is left blank: the battle prints the label on it (« MINA — 304 », then « NOA — ??? »,
 *   src/data/enemies-ch3.ts). `BRACELET_LABEL` gives where.
 * - `prop_h_dessin_0`…`_3`: Mina's drawings taped beside the right doors of the corridor. A tiny blue stick figure in a
 *   corner comes nearer, drawing after drawing, to a little door with a window; on the last one he stands against the
 *   glass, and on the other side there is a very small hand.
 * - `prop_h_robot`: « le robot », the vending machine of the lobby, in paper (B4 gives cotton).
 * - `fx_reflet_vitre`: what the corridor window of the last wing reflects for a moment, over the night sky — a boy,
 *   and someone smaller beside him, in a knitted hat with sheep's ears.
 */

const C: Record<string, string> = {
  '6': mix(PAL.a!, PAL.w!, 0.35), // paper scrubs, pale aqua
  '7': mix(PAL.A!, PAL.g!, 0.45), // their shade and creases
};

// ---------------------------------------------------------------------------------------------------------------------
// The paper nurses
// ---------------------------------------------------------------------------------------------------------------------

/** Nadia folded out of paper (16×28). `flutter` lifts a corner of the hem and the end of the ponytail. */
function paperNurse(flutter: boolean): string {
  const src = BONUS_ART.npc_nadia!;
  const p = Pix.of(typeof src === 'string' ? src : src.art);
  // Grey paper hair, cream paper skin, pale aqua paper scrubs.
  p.recolor({ O: 'g', x: 'G', s: 'q', S: 'Q', t: 'q', a: '6', A: '7', y: 'q', w: 'f' });
  // No face: the eyes and the mouth are gone; only the crease of the fold, down the middle.
  for (const x of [4, 5, 11, 12]) p.set(x, 9, 'q');
  for (let y = 7; y <= 12; y++) p.set(8, y, 'Q');
  p.set(8, 7, 'g');
  // The badge: white, a blue line of writing.
  p.rect(4, 17, 3, 2, 'f').set(5, 18, 'n').set(4, 18, 'n');
  // The fold of the paper down the uniform.
  for (let y = 18; y <= 24; y++) p.set(8, y, '7');
  if (flutter) {
    p.set(12, 24, '6').set(12, 25, 'k').set(13, 24, 'k');
    p.set(15, 8, '.').set(15, 9, '.').set(14, 9, 'k').set(15, 7, 'G');
  }
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// « Le robot »: the vending machine of the lobby, folded out of paper like everything else
// ---------------------------------------------------------------------------------------------------------------------

/** 16×30: a tall paper box, its window of drawn snacks, the keypad, the tray at the bottom. */
const ROBOT = (() => {
  const p = new Pix(16, 30);
  p.rect(0, 0, 16, 30, 'W').rect(1, 1, 14, 28, 'w').rect(14, 1, 1, 28, 'W').rect(1, 1, 14, 1, 'f');
  // The window: four shelves of crayon snacks.
  p.rect(2, 3, 9, 17, 'j');
  const snacks = ['r', 'y', 'L', 'p', 'b', 'o', 'v', 'Y', 'r', 'l', 'p', 'B'];
  for (let row = 0; row < 4; row++) {
    p.rect(2, 7 + row * 4, 9, 1, 'G');
    for (let i = 0; i < 3; i++) p.rect(3 + i * 3, 4 + row * 4, 2, 3, snacks[(row * 3 + i) % snacks.length]!);
  }
  p.set(3, 4, 'f').set(4, 5, 'J');
  // Keypad and the coin slot.
  p.rect(12, 4, 2, 2, 'L');
  for (let i = 0; i < 6; i++) p.set(12 + (i % 2), 8 + Math.floor(i / 2) * 2, 'g');
  p.rect(12, 15, 2, 3, 'd');
  // The tray.
  p.rect(3, 23, 9, 3, 'K').rect(3, 23, 9, 1, 'd');
  // A fold of the paper down one side.
  for (let y = 21; y < 29; y++) p.set(13, y, 'W');
  p.contour();
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// Bracelet
// ---------------------------------------------------------------------------------------------------------------------

/** Where the battle prints the label on `b_bracelet` (sprite pixels, before the 1 px outline). */
export const BRACELET_LABEL = { x: 12, y: 32, w: 31, h: 5 };

/** A length of wristband, horizontal: pink stripe, white plastic, shade, pink stripe (9 px). */
function bandH(p: Pix, x: number, y: number, w: number): void {
  p.rect(x, y, w, 1, 'p').rect(x, y + 1, w, 1, 'f').rect(x, y + 2, w, 5, 'w').rect(x, y + 7, w, 1, 'W').rect(x, y + 8, w, 1, 'P');
}

/** The same, vertical (the stripes on the left and right edges). */
function bandV(p: Pix, x: number, y: number, h: number): void {
  p.rect(x, y, 1, h, 'p').rect(x + 1, y, 1, h, 'f').rect(x + 2, y, 5, h, 'w').rect(x + 7, y, 1, h, 'W').rect(x + 8, y, 1, h, 'P');
}

/** Bracelet in battle (64×44): the body lies on the ground, the tail curls up, the clasp rears up like a head. */
function bracelet(f: 0 | 1): string {
  const p = new Pix(64, 44);
  const lift = f ? 2 : 0;
  // Body on the ground.
  bandH(p, 9, 31, 38);
  // The print area (blank: the label is printed by the battle).
  p.rect(BRACELET_LABEL.x - 1, BRACELET_LABEL.y - 1, BRACELET_LABEL.w + 2, BRACELET_LABEL.h + 2, 'g');
  p.rect(BRACELET_LABEL.x, BRACELET_LABEL.y, BRACELET_LABEL.w, BRACELET_LABEL.h, 'f');
  // Tail: the free end curls up, rounded, with its row of adjustment holes.
  bandV(p, 2, 24 - (f ? 1 : 0), 13 + (f ? 1 : 0));
  p.rect(2, 31, 9, 8, '.');
  bandH(p, 2, 31, 9);
  // (the elbow where the tail meets the body: round the outer corner)
  p.set(2, 38, '.').set(2, 39, '.').set(3, 39, '.');
  p.set(2, 23 - (f ? 1 : 0), '.').set(10, 23 - (f ? 1 : 0), '.');
  p.rect(3, 23 - (f ? 1 : 0), 7, 1, 'p');
  for (const y of [26, 29, 32]) p.rect(5, y - (f && y < 31 ? 1 : 0), 3, 2, 'G').set(5, y + 1 - (f && y < 31 ? 1 : 0), 'd');
  // Neck: the other end rises from the body.
  bandV(p, 44, 15 - lift, 25 + lift);
  p.rect(44, 31, 9, 9, '.');
  bandH(p, 44, 31, 9);
  p.set(52, 39, '.').set(52, 38, '.').set(51, 39, '.');
  // A barcode printed up the neck.
  for (const dy of [0, 2, 3, 5, 8, 9, 11]) p.rect(47, 19 - lift + dy, 4, 1, dy === 5 ? 'G' : 'd');
  // Clasp head: a rounded block of harder plastic.
  const hy = 2 - lift + 2;
  p.ellipse(51.5, hy + 7, 11, 7.5, 'W');
  p.ellipse(51, hy + 6, 10, 6.5, 'w');
  p.rect(43, hy + 1, 17, 2, 'f');
  p.rect(42, hy + 12, 20, 1, 'g');
  // Press studs: the eyes.
  for (const cx of [46, 56]) {
    p.ellipse(cx + 0.5, hy + 6.5, 3, 3, 'g');
    p.ellipse(cx + 0.5, hy + 6.5, 2, 2, 'd');
    p.set(cx - 1, hy + 5, 'f').set(cx, hy + 5, 'G');
    p.set(cx + 1, hy + 7, 'k').set(cx, hy + 7, 'k');
  }
  // The snap seam: a thin closed mouth.
  p.rect(48, hy + 10, 7, 1, 'G').set(48, hy + 9, 'G').set(54, hy + 9, 'G');
  // A little pink tab under the clasp, where the band goes in.
  p.rect(45, hy + 13, 13, 1, 'p');
  return p.toString();
}

/** On the map (16×12): the same band inching along, clasp first (`f` = the middle of the band arched up). */
function braceletOw(f: 0 | 1): string {
  const p = new Pix(16, 12);
  for (let x = 1; x <= 11; x++) {
    const top = 7 - (f ? Math.round(3 * Math.sin((Math.PI * (x - 1)) / 10)) : 0);
    p.set(x, top, 'p').set(x, top + 1, x > 3 && x < 9 && !f ? 'f' : 'w').set(x, top + 2, 'w').set(x, top + 3, 'P');
  }
  p.set(2, 8, 'G').set(2, 9, 'd');
  // Clasp head with its two studs.
  const hy = f ? 6.5 : 7.5;
  p.ellipse(13, hy, 3, 3.5, 'W').ellipse(12.8, hy - 0.5, 2.5, 3, 'w');
  p.set(12, Math.floor(hy), 'd').set(14, Math.floor(hy), 'd').set(12, Math.floor(hy) - 1, 'f');
  p.contour();
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Mina's drawings in the corridor: the little blue figure and the glass door
// ---------------------------------------------------------------------------------------------------------------------

/** One sheet (14×13) with its main subject, plus the figure `step` (0..3) nearer to the door each time. */
function dessin(step: 0 | 1 | 2 | 3): string {
  const p = new Pix(14, 13);
  p.rect(0, 0, 14, 13, 'q').rect(13, 1, 1, 12, 'Q').rect(1, 12, 13, 1, 'Q');
  // Tape.
  p.rect(5, 0, 4, 1, 'b');
  if (step === 0) {
    // A sheep with a crown.
    p.ellipse(5, 5, 3, 2.2, 'w').set(2, 5, 'G').set(8, 4, 'g').set(8, 5, 'g').set(8, 4, 'd');
    p.set(4, 2, 'Y').set(5, 1, 'Y').set(6, 2, 'Y').rect(4, 3, 3, 1, 'Y');
    p.set(3, 7, 'd').set(6, 7, 'd');
  } else if (step === 1) {
    // A sock holding up a sun.
    p.ellipse(4, 3, 2, 2, 'Y').set(1, 1, 'y').set(7, 1, 'y').set(4, 0, 'y');
    p.rect(3, 6, 2, 4, 'B').rect(3, 9, 4, 1, 'B').set(4, 5, 'B');
  } else if (step === 2) {
    // Two children under a big moon.
    p.ellipse(9, 3, 2.5, 2.5, 'y').set(10, 2, 'q').set(10, 3, 'q');
    p.rect(2, 6, 1, 3, 'B').set(2, 5, 'h').rect(1, 9, 1, 1, 'B').rect(3, 9, 1, 1, 'B');
    p.rect(5, 7, 1, 2, 'r').set(5, 6, 'm').set(4, 9, 'r').set(6, 9, 'r');
  } else {
    // Only the glass door, big, and the small hand flat on the other side.
    p.rect(5, 2, 7, 10, 'C').rect(6, 3, 5, 5, 'b').set(6, 3, 'f');
    p.set(8, 5, 's').set(9, 5, 's').set(8, 4, 's').set(9, 4, 's').set(10, 4, 's').set(7, 5, 's');
  }
  // The little figure in the corner (blue hair) and the little door with its window.
  if (step < 3) {
    p.rect(11, 8, 2, 4, 'C').set(11, 8, 'b').set(12, 8, 'b');
    const fx = [1, 4, 9][step]!;
    p.set(fx, 9, 'h').set(fx, 10, 'B').set(fx, 11, 'B');
  } else {
    p.set(3, 6, 'h').rect(3, 7, 1, 3, 'B').set(2, 10, 'B').set(4, 10, 'B').set(4, 8, 'B');
  }
  p.contour('G');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// The reflection in the window of the last wing
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Drawn over the window tile `h_window` (16×16, night sky in x 5..10, y 5..11): two dark shapes against the sky, the
 * boy, and a smaller one beside him whose hat has two pointed ears.
 */
const REFLET = (() => {
  const p = new Pix(16, 16);
  // The night sky of the window (x 5..10, y 5..11), the moon hidden behind them.
  p.rect(5, 6, 6, 6, 'z');
  // The boy: head and shoulders, pale as a reflection.
  p.stamp(
    `
    .g.
    gg.
    gg.
    .g.
    ggg
    ggg
  `,
    5,
    6,
  );
  // The smaller one: a knitted hat with two sheep's ears; no face under it.
  p.stamp(
    `
    W.W
    WWW
    ggg
    .g.
    ggg
  `,
    8,
    7,
  );
  return p.toString();
})();

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const ART: Record<string, SpriteDef> = {
  npc_infirmiere_papier: { art: paperNurse(false), colors: C },
  npc_infirmiere_papier_2: { art: paperNurse(true), colors: C },
  prop_h_robot: { art: ROBOT },
  b_bracelet: { art: bracelet(0), outline: 'k' },
  b_bracelet_2: { art: bracelet(1), outline: 'k' },
  ow_bracelet: { art: braceletOw(0) },
  ow_bracelet_2: { art: braceletOw(1) },
  prop_h_dessin_0: { art: dessin(0) },
  prop_h_dessin_1: { art: dessin(1) },
  prop_h_dessin_2: { art: dessin(2) },
  prop_h_dessin_3: { art: dessin(3) },
  fx_reflet_vitre: { art: REFLET },
};

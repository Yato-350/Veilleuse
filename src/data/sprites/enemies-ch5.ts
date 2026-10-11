import type { SpriteDef } from '../../game/assets';
import { Pix, seeded, type Ramp } from './enemies';

// Chapter 5 « La Marée Blanche » — battle sprites (`b_<id>`, `b_<id>_2`), overworld sprites of the regular enemies
// (`ow_<id>`, `ow_<id>_2`), La Vitre and what is left behind her, and the two hands of the drawing game (`dt_*`).
// See docs/HISTOIRE.md § 3.13 and § 4 « Ch. 5 ». Everything is too bright here: white plastic, gel, glass, paper. The
// only body behind the glass is a silhouette in a knitted hat, and hands.

/** Local colors (glass, gel, the silhouette behind the glass, the LCD of a thermometer). */
const C5_COLORS = {
  '6': '#e4ecf3', // glass, pale
  '7': '#c4d1df', // glass, shade
  '8': '#6a7390', // silhouette behind the glass
  '9': '#525a76', // silhouette, shade
  '%': '#b9c8a4', // LCD
  '&': '#97a684', // LCD, shade
  '@': '#d9f0f4', // gel, light
  '$': '#9fd3dc', // gel
};

const GULL: Ramp = ['w', 'w', 'W', 'g'];
const CORAL: Ramp = ['p', 'p', 'P', 'R'];
const GEL: Ramp = ['@', '@', '$', 'A'];

/** Tiny hand-lettered glyphs (5 rows), for what is printed on a hospital bracelet. */
const MINI: Record<string, string> = {
  '8': 'xxx\nx.x\nxxx\nx.x\nxxx',
  M: 'x...x\nxx.xx\nx.x.x\nx...x\nx...x',
  I: 'x\nx\nx\nx\nx',
  N: 'x..x\nxx.x\nx.xx\nx..x\nx..x',
  A: '.x.\nx.x\nxxx\nx.x\nx.x',
  '3': 'xx.\n..x\n.x.\n..x\nxx.',
  '0': '.x.\nx.x\nx.x\nx.x\n.x.',
  '4': 'x.x\nx.x\nxxx\n..x\n..x',
};

/** Writes `text` with the mini glyphs in color `c`; returns the width used. */
function mini(p: Pix, text: string, x: number, y: number, c: string): number {
  let cx = x;
  for (const ch of text) {
    const art = MINI[ch];
    if (!art) {
      cx += 2;
      continue;
    }
    const rowsOf = art.split('\n');
    rowsOf.forEach((r, j) => [...r].forEach((v, i) => v === 'x' && p.set(cx + i, y + j, c)));
    cx += rowsOf[0]!.length + 1;
  }
  return cx - x - 1;
}

/** Points of a superellipse (flat-topped arch) |x/rx|^n + |y/ry|^n <= 1. */
function inSuper(x: number, y: number, cx: number, cy: number, rx: number, ry: number, n = 3.2): boolean {
  return Math.abs((x + 0.5 - cx) / rx) ** n + Math.abs((y + 0.5 - cy) / ry) ** n <= 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Crabe-Bracelet (50x38) — un bernard-l'ermite qui a pris pour coquille un bracelet d'hôpital en plastique blanc,
// arrondi en arche : sur l'étiquette, « MINA » et « 304 ». Deux pinces corail, l'une énorme. Six pattes. Des yeux au
// bout des tiges, trop noirs. Frame 2 : la grosse pince claque, les pattes changent de pas.
// ---------------------------------------------------------------------------------------------------------------------
function crabe(f: number): string {
  const p = new Pix(56, 38);
  const X = 3;
  // Legs first (behind): three per side, jointed.
  const legs: Array<[number, number, number]> = [
    [16, 28, -1],
    [19, 30, -1],
    [22, 31, -1],
    [28, 31, 1],
    [31, 30, 1],
    [34, 28, 1],
  ];
  legs.forEach(([x0, y, d], i) => {
    const x = x0 + X + d * 2;
    const step = (i + f) % 2 ? 1 : 0;
    const kx = x + d * (5 + step);
    const ky = y - 2;
    p.line(x, y, kx, ky, 'P');
    p.line(kx, ky, kx + d * (3 + step), 36, 'P');
    p.set(kx, ky, 'R');
  });
  // The body under the shell (coral, washed out by the light).
  const cx = 25 + X;
  p.ball(cx, 27, 14, 6, CORAL);
  // The bracelet: a flat-topped arch of white plastic, 6 px thick, open at the bottom.
  for (let y = 2; y < 30; y++)
    for (let x = cx - 22; x < cx + 22; x++) {
      if (!inSuper(x, y, cx, 30, 21, 28, 4) || inSuper(x, y, cx, 30, 15, 22, 4)) continue;
      const l = (x - cx) * 0.4 + (y - 12) * 0.35;
      p.set(x, y, l < -6 ? 'w' : l < 4 ? 'W' : 'g');
    }
  // Inside the arch: the dark of the shell, where the crab lives.
  for (let y = 9; y < 26; y++)
    for (let x = cx - 15; x < cx + 15; x++) if (inSuper(x, y, cx, 30, 15, 22, 4) && y < 25) p.set(x, y, y < 15 ? 'K' : 'd');
  // The label on top: a white window with MINA and, in red, the room. A seam of the plastic band between them.
  p.rect(cx - 16, 3, 33, 7, 'w');
  p.rect(cx - 16, 9, 33, 1, 'W');
  mini(p, 'MINA', cx - 15, 4, 'n');
  p.rect(cx + 2, 4, 1, 5, 'g');
  mini(p, '304', cx + 5, 4, 'r');
  // The snap studs of the clasp, on the left foot of the arch.
  p.stamp('.gg.\ngwWg\ngWWg\n.gg.', cx - 20, 17);
  p.stamp('.gg.\ngwWg\n.gg.', cx - 19, 23);
  // Eye stalks out of the dark, eyes too black and too round, looking two ways.
  for (let y = 14; y < 22; y++) p.set(cx - 4, y, 'p').set(cx + 4, y, 'p');
  p.stamp('.kkk.\nkiiik\nkiifk\nkiiik\n.kkk.', cx - 7, 10).stamp('.kkk.\nkiiik\nkfiik\nkiiik\n.kkk.', cx + 2, 10);
  // A small mouth working.
  p.stamp(f ? 'R.R\n.R.' : 'RRR', cx - 1, 22);
  // Pincers: the left one small, the right one huge (fiddler crab). Jaws open in frame 1, snapped shut in frame 2.
  p.ball(4, 25, 4, 3, CORAL);
  p.stamp(f ? 'pp..\nPpp.' : 'p...\n.p..\n..PP', 0, 20);
  p.line(8, 26, cx - 12, 27, 'P');
  const open = f ? 0 : 3;
  p.ball(50, 20, 6, 5, CORAL);
  p.ball(52, 14 - open, 4, 3, CORAL);
  p.ball(53, 25 + open, 3, 2, CORAL);
  p.set(54, 15 - open, 'w').set(53, 16 - open, 'W');
  p.line(cx + 13, 26, 45, 23, 'P');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Mouette (46x42) — une mouette trop blanche, le dos gris, les pointes des ailes noires, le bec jaune avec sa tache
// rouge. Son œil est rond, bleu pâle, beaucoup trop humain. Dans son bec ouvert, une rangée de petites dents.
// Frame 2 : elle crie, ailes ouvertes vers le haut, bec grand ouvert.
// ---------------------------------------------------------------------------------------------------------------------
function mouette(f: number): string {
  const p = new Pix(46, 42);
  // Legs and webbed feet.
  for (const x of [19, 25]) {
    p.rect(x, 31, 1, 7, 'o').rect(x + 1, 31, 1, 7, 'O');
    p.stamp('.ooo.\noOoOo', x - 2, 37);
  }
  // Tail, then body.
  p.poly([[2, 21], [9, 18], [11, 26], [4, 27]], 'W');
  p.ball(20, 23, 12, 8, GULL);
  // Head and neck.
  p.ball(30, 13, 6, 6, GULL);
  p.rect(26, 15, 7, 6, 'w');
  // Wings: folded along the back in frame 1, raised high in frame 2.
  if (!f) {
    p.ball(17, 20, 11, 5, ['W', 'g', 'g', 'G']);
    p.poly([[4, 18], [10, 17], [9, 22], [3, 22]], 'K');
    p.set(5, 19, 'w').set(7, 20, 'w');
  } else {
    p.poly([[12, 20], [22, 19], [10, 2], [6, 4]], 'g');
    p.poly([[10, 2], [6, 4], [4, 0], [8, 0]], 'K');
    p.line(12, 19, 8, 4, 'G');
    p.poly([[18, 19], [26, 18], [22, 3], [18, 5]], 'W');
    p.poly([[22, 3], [18, 5], [19, 0], [22, 0]], 'K');
    p.set(20, 2, 'w');
  }
  // The eye: round, pale blue, a black pupil, a white glint. Too human.
  p.stamp('.kkk.\nkbbbk\nkbiwk\nkbbbk\n.kkk.', 29, 9);
  // Beak: yellow, the red spot; open in frame 2 with small teeth along it.
  if (!f) {
    p.poly([[35, 12], [44, 14], [35, 16]], 'Y');
    p.line(35, 12, 43, 14, 'y');
    p.set(41, 15, 'r').set(42, 15, 'r');
    p.line(36, 14, 42, 14, 'O');
  } else {
    p.poly([[35, 10], [45, 8], [36, 14]], 'Y');
    p.poly([[35, 15], [44, 19], [35, 18]], 'Y');
    p.line(35, 10, 44, 8, 'y');
    p.set(42, 18, 'r').set(43, 18, 'r');
    p.rect(36, 13, 6, 3, 'R');
    for (let x = 36; x < 43; x += 2) p.set(x, 11 + Math.round((x - 36) * -0.15) + 1, 'w').set(x, 16 + Math.round((x - 36) * 0.25), 'w');
  }
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Masque (46x36) — un masque chirurgical qui flotte à hauteur de visage, sans visage derrière. Trois plis, la barrette
// du nez, deux élastiques qui pendent dans le vide. Quelqu'un a dessiné un sourire dessus au feutre noir, trop large,
// avec des dents comptées une à une. Frame 2 : il se gonfle (une respiration), le sourire s'étire.
// ---------------------------------------------------------------------------------------------------------------------
function masque(f: number): string {
  const p = new Pix(46, 36);
  const puff = f ? 1 : 0;
  // Elastic loops, hanging empty where ears should be.
  for (const [x0, d] of [[8, -1], [37, 1]] as const) {
    for (let t = 0; t <= 1; t += 0.02) {
      const a = -Math.PI / 2 + t * Math.PI;
      const x = x0 + d * Math.cos(a) * (6 + puff);
      const y = 17 + Math.sin(a) * 10 + (t > 0.5 ? (t - 0.5) * 6 : 0);
      p.set(Math.round(x), Math.round(y), 'W');
    }
  }
  // The mask: a soft rectangle, a little wider at the middle.
  for (let y = 8 - puff; y < 28 + puff; y++) {
    const k = Math.sin(((y - 8 + puff) / (20 + puff * 2)) * Math.PI);
    const half = Math.round(13 + k * 2 + puff);
    for (let x = 23 - half; x < 23 + half; x++) {
      const l = (x - 23) * 0.06 + (y - 18) * 0.12;
      p.set(x, y, l < -0.9 ? 'w' : l < 1.2 ? 'b' : 'B');
    }
  }
  p.recolor({ b: '6', B: '7' });
  // Pleats.
  for (const y of [13, 18, 23]) {
    for (let x = 10 - puff; x < 36 + puff; x++) p.set(x, y + (x > 21 && x < 25 ? puff : 0), '7');
    for (let x = 10 - puff; x < 36 + puff; x++) if (p.get(x, y - 1) === '6') p.set(x, y - 1, 'w');
  }
  // The nose wire.
  p.rect(16, 8 - puff, 14, 1, 'g');
  // The smile, drawn with a marker: a wide curve, too wide, with teeth counted one by one.
  const w = 12 + puff;
  const smile = (x: number) => Math.round(24 + puff - (x * x) / 22);
  for (let x = -w; x <= w; x++) {
    const y = smile(x);
    p.set(23 + x, y, 'i');
    // The upper lip, and the teeth counted one by one between the two lines.
    const top = Math.round(20 + puff - (x * x) / 30);
    if (Math.abs(x) < w - 1) p.set(23 + x, top, 'i');
    if (x % 3 === 0 && Math.abs(x) < w - 2) for (let yy = top + 1; yy < y; yy++) p.set(23 + x, yy, 'i');
  }
  // The corners go up too far, past the pleats.
  p.set(23 - w - 1, smile(w) - 1, 'i').set(23 + w + 1, smile(w) - 1, 'i');
  // A dribble of marker at one corner, where the pen pressed too long.
  p.set(23 + w - 1, smile(w) + 1, 'i').set(23 + w - 1, smile(w) + 2, 'i').set(23 + w - 1, smile(w) + 3, 'i');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Gel (36x46) — un flacon-pompe de gel hydroalcoolique, et ce qui en sort : une coulée de gel transparent qui a des yeux
// (deux bulles). Du givre au pied du flacon. Gel, c'est le gel des mains et le gel qui fige. Frame 2 : la pompe
// s'enfonce, la coulée s'allonge, une goutte tombe.
// ---------------------------------------------------------------------------------------------------------------------
function gel(f: number): string {
  const p = new Pix(36, 46);
  const press = f ? 2 : 0;
  // Bottle.
  p.ball(18, 32, 10, 12, ['6', '6', '7', 'B']);
  p.rect(9, 32, 19, 12, '6');
  p.rect(9, 40, 19, 4, '7');
  for (let y = 26; y < 43; y++) p.set(9, y, '7').set(27, y, 'B');
  // Liquid inside, a little lower than full.
  for (let y = 30; y < 43; y++) for (let x = 11; x < 26; x++) if (p.get(x, y) === '6' || p.get(x, y) === '7') p.set(x, y, y < 31 ? '@' : '$');
  // The label: a white band and a red cross.
  p.rect(10, 33, 17, 6, 'w');
  p.stamp('.r.\nrrr\n.r.', 12, 34);
  p.rect(17, 35, 8, 1, 'g').rect(17, 37, 6, 1, 'g');
  // Neck, pump head, nozzle.
  p.rect(15, 18, 7, 4, 'W');
  p.rect(16, 13 + press, 5, 6 - press, 'w');
  p.rect(13, 11 + press, 12, 3, 'w');
  p.rect(13, 13 + press, 12, 1, 'g');
  p.rect(24, 11 + press, 8, 2, 'w');
  p.rect(24, 12 + press, 8, 1, 'g');
  // The gel: a slow coulée from the nozzle down along the bottle, with a face of two bubbles.
  const len = f ? 20 : 15;
  const top = 14 + press;
  // It hangs from the nozzle like a slow tongue, thick in the middle, a face in its bulge.
  p.blob(
    [
      [31, top + 2, 2.5],
      [31, top + 8, 4.5],
      [30, top + 14, 3.5],
      [31, top + len, 3],
    ],
    GEL,
    [31, top + len / 2, 5, len / 2 + 3],
  );
  p.stamp('.kk.\nkiwk\nkiik\n.kk.', 27, top + 5).stamp('.kk.\nkiwk\nkiik\n.kk.', 31, top + 6);
  p.set(30, top + 11, 'A').set(31, top + 11, 'A').set(32, top + 12, 'A');
  for (const [bx, by] of [[29, top + 15], [33, top + 3], [32, top + 17]] as const) p.set(bx, by, 'w');
  if (f) p.stamp('@\n$\n$', 31, 42);
  // Fumes of alcohol above (wavy).
  for (let k = 0; k < 2; k++) for (let y = 2; y < 9; y++) p.set(22 + k * 6 + Math.round(Math.sin(y * 0.9 + k + f) * 1.2), y, 'W');
  // Frost round the foot: little white spikes.
  const rnd = seeded(7);
  for (let x = 4; x < 33; x += 2) {
    const h = 1 + Math.floor(rnd() * 3);
    for (let y = 0; y < h; y++) p.set(x + (y === h - 1 && rnd() > 0.5 ? 1 : 0), 44 - y, y === h - 1 ? 'w' : 'b');
  }
  p.rect(3, 45, 31, 1, 'b');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Thermomètre (22x58) — un thermomètre digital debout sur sa pointe de métal, comme sur une seule jambe. Corps de
// plastique blanc, l'écran gris-vert (les chiffres sont dessinés par le combat : ils montent), un bouton. Les segments
// éteints de l'écran forment un fantôme de « 88,8 ». Frame 2 : il tremble, la pointe a bougé d'un pixel.
// ---------------------------------------------------------------------------------------------------------------------
function thermometre(f: number): string {
  const p = new Pix(24, 58);
  // Body: a long rounded bar, narrowing at the bottom.
  for (let y = 2; y < 44; y++) {
    const half = y < 7 ? 3 + Math.floor((y - 2) * 1.1) : y < 32 ? 8 : Math.max(2, 8 - Math.floor((y - 32) / 2));
    for (let x = 12 - half; x < 12 + half; x++) {
      const l = (x - 12) * 0.3 + (y - 20) * 0.03;
      p.set(x, y, l < -1.4 ? 'w' : l < 1.3 ? 'W' : 'g');
    }
  }
  // The metal tip, standing on the floor like a single leg.
  const lean = f ? 1 : 0;
  for (let y = 44; y < 57; y++) p.set(11 + (y > 52 ? lean : 0), y, 'g').set(12 + (y > 52 ? lean : 0), y, 'G');
  p.set(11 + lean, 57, 'G').set(12 + lean, 57, 'd');
  // The LCD across the body, with the ghost of « 88,8 » in unlit segments (the battle lights the reading).
  p.rect(4, 9, 16, 9, 'k');
  p.rect(5, 10, 14, 7, '%');
  p.rect(5, 10, 14, 1, '&');
  p.rect(5, 10, 1, 7, '&');
  mini(p, '88', 6, 11, '&');
  p.set(13, 15, '&');
  mini(p, '8', 15, 11, '&');
  // The button, the battery door, a line of small print nobody reads.
  p.stamp('.gg.\ngGGg\n.gg.', 10, 23);
  p.rect(8, 30, 8, 1, 'g');
  p.rect(8, 35, 8, 1, 'g');
  p.rect(9, 27, 6, 1, 'g');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Gribouille Noire (40x38) — l'écho noir du Gribouille du tutoriel : la même pelote, mais tout en encre, plus grande,
// des traits qui s'échappent partout, et à la place des grands yeux ronds deux cercles griffonnés vides. Pas de bouche.
// Frame 2 : les traits bouillonnent, une goutte d'encre tombe.
// ---------------------------------------------------------------------------------------------------------------------
function gribouilleNoire(f: number): string {
  const p = new Pix(40, 38);
  const cx = 20;
  const cy = 18;
  p.ellipse(cx, cy, 14, 13, 'i');
  const ph = f ? 1.7 : 0;
  for (let t = 0; t < Math.PI * 2 * 8; t += 0.02) {
    const k = t / (Math.PI * 16);
    const r = 14 - k * 9 + Math.sin(t * 3.1 + ph) * 1.5;
    const x = cx + Math.cos(t) * r + Math.sin(t * 0.41 + ph) * 2.5 * k;
    const y = cy + Math.sin(t) * r * 0.92 + Math.cos(t * 0.33 + ph) * 2 * k;
    p.set(Math.floor(x), Math.floor(y), (Math.floor(t * 7) % 5 === 0) ? 'K' : 'i');
  }
  // Strokes escaping the ball in every direction.
  const rnd = seeded(f ? 23 : 11);
  for (let s = 0; s < 9; s++) {
    let a = rnd() * Math.PI * 2;
    let x = cx + Math.cos(a) * 12;
    let y = cy + Math.sin(a) * 11;
    for (let i = 0; i < 6 + rnd() * 6; i++) {
      x += Math.cos(a) * 1.2;
      y += Math.sin(a) * 1.2;
      a += (rnd() - 0.5) * 1.4;
      p.set(Math.round(x), Math.round(y), 'i');
    }
  }
  // Two scribbled white blanks where the eyes should be, not the same size, not at the same height: nothing in them.
  for (const [ex, ey, er] of [[13, 13, 4.2], [27, 15, 3.2]] as const) {
    p.ellipse(ex, ey, er, er, 'W');
    for (let t = 0; t < Math.PI * 2 * 2.2; t += 0.07) {
      const r = er * (0.4 + 0.6 * ((t * 0.7) % 1));
      p.set(Math.round(ex + Math.cos(t * 1.9) * r), Math.round(ey + Math.sin(t * 2.3) * r), 'w');
    }
    for (let t = 0; t < Math.PI * 2; t += 0.1) p.set(Math.round(ex + Math.cos(t) * (er + 0.6)), Math.round(ey + Math.sin(t) * (er + 0.6)), 'g');
  }
  // Dripping ink below; two tiny feet like the tutorial's, but bent wrong.
  p.stamp('i..i\ni..i\n...i', 17, 31);
  if (f) p.set(18, 35, 'i').set(18, 36, 'i');
  p.stamp('kKk......kKk\n..k......k..', 13, 33);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// La Vitre (96x80) — la vitre de la 304, vue du sas : un cadre de métal, la plaque « 304 », le verre pâle avec ses
// reflets. Derrière, floue, une silhouette en bonnet tricoté à oreilles de mouton, assise, qui dessine sur une
// tablette ; le bord d'un lit, une perche. Pas de visage : une forme, une main. Frame 2 : son bras a bougé (elle
// dessine). La buée, les empreintes de mains et les fissures sont dessinées par le combat, sur le verre.
// ---------------------------------------------------------------------------------------------------------------------
function vitre(f: number, empty = false): string {
  const p = new Pix(96, 80);
  // Frame.
  p.rect(0, 6, 96, 74, 'G');
  p.rect(1, 7, 94, 72, 'g');
  p.rect(1, 7, 94, 1, 'W');
  p.rect(1, 7, 1, 72, 'W');
  // The room behind the glass (seen through it, pale and blue).
  p.rect(6, 12, 84, 62, '6');
  p.rect(6, 52, 84, 22, '7');
  // The far wall: a window with the night outside, a drip stand.
  p.rect(58, 18, 22, 16, '8');
  p.rect(59, 19, 20, 14, '9');
  p.rect(68, 19, 1, 14, '8');
  p.rect(38, 16, 1, 36, '8');
  p.rect(34, 16, 9, 1, '8');
  p.stamp('.88.\n8778\n8778\n.88.', 39, 18);
  // The bed: its foot rail and a sheet.
  p.rect(48, 46, 38, 6, 'w');
  p.rect(48, 52, 38, 2, '7');
  p.rect(84, 40, 2, 18, '8');
  p.rect(48, 56, 1, 14, '8');
  p.rect(84, 56, 1, 14, '8');
  if (!empty) {
    // The little silhouette, sitting on the bed, bent over a drawing board: the hat with sheep ears, her back.
    p.ball(36, 40, 7, 7, ['8', '8', '9', '9']);
    p.ball(31, 33, 3, 3, ['8', '8', '9', '9']);
    p.ball(41, 33, 3, 3, ['8', '8', '9', '9']);
    p.ellipse(36, 37, 6, 3, '8');
    // Knitted ribs of the hat.
    for (let x = 31; x <= 41; x += 2) p.set(x, 39, '9');
    p.poly([[30, 46], [43, 46], [46, 58], [27, 58]], '9');
    // The drawing board on her knees.
    p.poly([[40, 54], [56, 50], [57, 53], [41, 57]], 'W');
    // Her arm: it moves along the board between frames.
    const hx = f ? 52 : 46;
    p.line(41, 49, hx, 52, '9');
    p.line(41, 50, hx, 53, '9');
    p.ellipse(hx + 1, 52, 1.6, 1.4, '8');
    p.set(hx + 2, 51, 'r');
  } else {
    // Nobody. The sheet is flat.
    p.rect(26, 52, 22, 2, 'w');
    p.rect(26, 54, 22, 1, '7');
  }
  if (!empty) {
    // Reflections on the glass: two pale diagonals.
    for (let i = 0; i < 70; i++) {
      const x = 8 + i;
      const y = 72 - Math.round(i * 0.85);
      if (y > 12 && x < 88) p.set(x, y, 'w');
      if (y + 6 > 12 && x + 4 < 88 && i % 3) p.set(x + 4, y + 6, 'w');
    }
  } else {
    // The glass is gone: shards left in the corners of the frame, ink running down from the breaks.
    p.poly([[6, 12], [22, 12], [6, 30]], 'W');
    p.poly([[70, 12], [90, 12], [90, 20], [80, 16]], 'W');
    p.poly([[6, 74], [6, 60], [14, 74]], 'W');
    p.poly([[90, 74], [90, 52], [84, 64], [78, 74]], 'W');
    p.line(22, 12, 6, 30, 'g').line(70, 12, 80, 16, 'g').line(80, 16, 90, 20, 'g').line(6, 60, 14, 74, 'g').line(90, 52, 84, 64, 'g').line(84, 64, 78, 74, 'g');
    for (const [x, y0, len] of [[12, 22, 9], [16, 16, 5], [86, 18, 12], [76, 15, 6], [88, 58, 9]] as const)
      for (let y = y0; y < y0 + len; y++) p.set(x + ((y >> 2) % 2), y, 'i');
  }
  // The glass edge (inner frame shadow).
  p.rect(5, 11, 86, 1, 'd');
  p.rect(5, 11, 1, 64, 'd');
  p.rect(90, 11, 1, 64, 'G');
  p.rect(5, 74, 86, 1, 'G');
  // The sill.
  p.rect(0, 76, 96, 4, 'W');
  p.rect(0, 79, 96, 1, 'g');
  // The plate above: « 304 ».
  p.rect(36, 0, 24, 9, 'k');
  p.rect(37, 1, 22, 7, 'w');
  mini(p, '304', 43, 2, 'n');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// The drawing game (src/game/scenes/drawtogether.ts): Noa's hand with the blue ballpoint, the little hand with the red
// crayon. Only hands.
// ---------------------------------------------------------------------------------------------------------------------
function hand(small: boolean): string {
  const p = new Pix(small ? 16 : 22, small ? 22 : 30);
  if (small) {
    // The red crayon, held like a fist, too tightly.
    p.poly([[9, 0], [12, 0], [12, 11], [9, 11]], 'r');
    p.rect(9, 0, 1, 11, 'R');
    p.poly([[9, 11], [12, 11], [10.5, 15]], 'c');
    p.set(10, 14, 'R').set(11, 14, 'R');
    p.ball(8, 9, 5, 4, ['s', 's', 'S', 't']);
    for (let i = 0; i < 4; i++) p.set(4 + i * 2, 7, 'S');
    p.rect(5, 12, 5, 9, 's');
    p.rect(9, 12, 1, 9, 'S');
    // A hospital bracelet at the wrist.
    p.rect(4, 16, 7, 2, 'w');
    p.rect(4, 18, 7, 1, 'W');
  } else {
    // A sleeve, a bigger hand, the blue pen.
    p.poly([[13, 1], [16, 1], [16, 16], [13, 16]], 'B');
    p.rect(13, 1, 1, 15, 'n');
    p.poly([[13, 16], [16, 16], [14.5, 20]], 'w');
    p.set(14, 19, 'n');
    p.ball(11, 14, 7, 5, ['s', 's', 'S', 't']);
    for (let i = 0; i < 5; i++) p.set(5 + i * 2, 12, 'S');
    p.rect(6, 17, 8, 13, 'j');
    p.rect(6, 17, 8, 2, 'J');
    p.rect(13, 19, 1, 11, 'z');
  }
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Overworld (≈14x14 with the outline)
// ---------------------------------------------------------------------------------------------------------------------

const OW_CRABE = `
  ..WWWWWWW..
  .WwwrwnwWW.
  WWKKKKKKKWW
  WgKiKKKiKgW
  pWgppppppgW
  pp.P.P.P.pp
  .P.P...P.P.
`;
const OW_MOUETTE = `
  ......www...
  .....wwbwY..
  .....wwwwYY.
  KgggggwWw...
  .gggggwWw...
  ..WWWWWW....
  ....o..o....
  ...oo.oo....
`;
const OW_MASQUE = `
  W..........W
  .W66666666W.
  W.66666666.W
  .W7777777W..
  W.6i6666i6.W
  .W6iiiiii6W.
  ...777777...
`;
const OW_GEL = `
  ..wwww....
  ...ww.ww@.
  ..WWWW..$.
  .66666.@$.
  .6$$$6..$.
  .6www6.@$@
  .6$$$6....
  .77777....
  w.w.w.w.w.
`;
const OW_THERMO = `
  .WWW.
  WWWWW
  k%%%k
  k&%&k
  WWWWW
  WWgWW
  .WWW.
  ..W..
  ..g..
  ..g..
`;
const OW_NOIRE = `
  .i.iiii.i...
  ..iiiiiiii..
  .iiwwiiwwii.
  iiwiiwwiiwi.
  .iiwwiiwwii.
  ..iiiiiiii.i
  i..iiiiii...
  ...k....k...
`;

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

const o = (art: string, extra: Partial<Exclude<SpriteDef, string>> = {}): SpriteDef => ({ art, outline: 'k', colors: C5_COLORS, ...extra });
const flipArt = (art: string): string =>
  Pix.of(art)
    .flip()
    .toString();

export const ART: Record<string, SpriteDef> = {
  b_crabe_bracelet: o(crabe(0)),
  b_crabe_bracelet_2: o(crabe(1)),
  b_mouette: o(mouette(0)),
  b_mouette_2: o(mouette(1)),
  b_masque: o(masque(0)),
  b_masque_2: o(masque(1)),
  b_gel: o(gel(0)),
  b_gel_2: o(gel(1)),
  b_thermometre: o(thermometre(0)),
  b_thermometre_2: o(thermometre(1)),
  b_gribouille_noire: o(gribouilleNoire(0)),
  b_gribouille_noire_2: o(gribouilleNoire(1)),
  b_vitre: o(vitre(0)),
  b_vitre_2: o(vitre(1)),
  b_c5_lit_vide: o(vitre(0, true)),

  dt_main_noa: o(hand(false)),
  dt_main_petite: o(hand(true)),

  ow_crabe_bracelet: o(OW_CRABE),
  ow_crabe_bracelet_2: o(flipArt(OW_CRABE)),
  ow_mouette: o(OW_MOUETTE),
  ow_mouette_2: o(Pix.of(OW_MOUETTE).move(0, 3, 6, 2, 0, -2).toString()),
  ow_masque: o(OW_MASQUE),
  ow_masque_2: o(Pix.of(OW_MASQUE).move(2, 1, 8, 6, 0, 1).toString()),
  ow_gel: o(OW_GEL),
  ow_gel_2: o(Pix.of(OW_GEL).move(7, 1, 3, 6, 0, 1).toString()),
  ow_thermometre: o(OW_THERMO),
  ow_thermometre_2: o(Pix.of(OW_THERMO).move(2, 6, 1, 4, 1, 0).toString()),
  ow_gribouille_noire: o(OW_NOIRE),
  ow_gribouille_noire_2: o(flipArt(OW_NOIRE)),
};

export const VARIANTS: string[] = [];

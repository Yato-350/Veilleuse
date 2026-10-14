import type { SpriteDef } from '../../game/assets';
import { ART as CHAR_ART } from './characters';
import { ART as ENEMY_ART, Pix, seeded, type Ramp } from './enemies';

// Chapter 6 « Le Ventre de Dodo » — battle sprites (`b_<id>`, `b_<id>_2`), overworld sprites of the regular enemies
// (`ow_<id>`, `ow_<id>_2`), Dodo torn open for the final battle (`b_dodo_torn`) and his portraits (`face_dodotorn_*`),
// the little girl in the knitted hat seen from behind (`b_bonnet`, she knocks on frame 2) and the pencil princess on
// her strings (`b_c6_princesse`). See docs/HISTOIRE.md § 3.14 and § 4 « Ch. 6 ». Everything is inside the plush: damp
// yellowed cotton, Mina's red thread, pins, buttons, a battery that leaks. The body horror only ever touches toys.

/** Local colors (damp cotton, steel, the battery's crust). */
const C6_COLORS = {
  '6': '#efe6cc', // cotton, light (yellowed)
  '7': '#d4c6a2', // cotton
  '8': '#a8977a', // cotton, damp shade
  '9': '#6e604c', // cotton, soaked
  '%': '#55513a', // mildew
  '&': '#d6dde6', // steel, light
  '@': '#9aa4b2', // steel
  $: '#5f6878', // steel, dark
  '=': '#f2f0e6', // crust, white
  '+': '#bdb9a8', // crust, shade
  '^': '#8a5a3a', // rust
};

const COTTON: Ramp = ['6', '7', '8', '9'];
const STEEL: Ramp = ['&', '@', '$', 'K'];
const WOOL: Ramp = ['f', 'w', 'W', 'g'];

const flipArt = (art: string): string =>
  art
    .split('\n')
    .map((r) => [...r].reverse().join(''))
    .join('\n');

const artOf = (def: SpriteDef | undefined): string => (typeof def === 'string' ? def : (def?.art ?? ''));

/** A running stitch along a line (two pixels on, one off). */
function stitchLine(p: Pix, x0: number, y0: number, x1: number, y1: number, c: string, phase = 0): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    if ((i + phase) % 3 === 2) continue;
    p.set(Math.round(x0 + ((x1 - x0) * i) / Math.max(1, n)), Math.round(y0 + ((y1 - y0) * i) / Math.max(1, n)), c);
  }
}

/** A thread sagging or swinging between two points (quadratic curve through a control point). */
function thread(p: Pix, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, c: string, shade?: string): void {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6) + 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    if (shade && !p.solid(Math.round(x) + 1, Math.round(y))) p.set(Math.round(x) + 1, Math.round(y), shade);
    p.set(Math.round(x), Math.round(y), c);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Aiguille (40x64) — une grande aiguille à coudre, en biais. Dans le chas, un œil : un vrai, qui regarde. Le fil rouge
// de Mina passe dedans et retombe en boucles, et derrière elle, des points de couture en pointillés.
// Frame 2 : l'œil regarde ailleurs, le fil se balance.
// ---------------------------------------------------------------------------------------------------------------------
function aiguille(f: number): string {
  const p = new Pix(40, 64);
  const ax = 27;
  const ay = 5;
  const bx = 10;
  const by = 61;
  const len = Math.hypot(bx - ax, by - ay);
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  const nx = -dy;
  const ny = dx;
  // Shaft: a long tapered polygon, shaded across its width (light on the upper-left side).
  const shaft = new Pix(40, 64);
  const w0 = 5.4;
  shaft.poly(
    [
      [ax + nx * w0, ay + ny * w0],
      [ax - nx * w0, ay - ny * w0],
      [bx - nx * 0.6, by - ny * 0.6],
      [bx + nx * 0.6, by + ny * 0.6],
    ],
    '@',
  );
  shaft.ellipse(ax, ay, w0, w0, '@');
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 40; x++) {
      if (!shaft.solid(x, y)) continue;
      const side = (x + 0.5 - ax) * nx + (y + 0.5 - ay) * ny;
      shaft.set(x, y, side > 1.6 ? '&' : side < -1.6 ? '$' : '@');
    }
  p.blit(shaft.contour('k'));
  // A thin highlight running down the shaft, and a glint on the tip.
  for (let i = 10; i < len - 6; i += 1) p.set(Math.round(ax + dx * i + nx * 1.6), Math.round(ay + dy * i + ny * 1.6), i % 9 === 0 ? '@' : 'f');
  // The eye of the needle: an elongated slot… with an eye in it.
  const ex = ax + dx * 9;
  const ey = ay + dy * 9;
  const slot = (x: number, y: number): number => {
    const u = (x + 0.5 - ex) * dx + (y + 0.5 - ey) * dy;
    const v = (x + 0.5 - ex) * nx + (y + 0.5 - ey) * ny;
    return (u / 7.4) ** 2 + (v / 3.6) ** 2;
  };
  for (let y = 0; y < 30; y++)
    for (let x = 10; x < 40; x++) {
      const d = slot(x, y);
      if (d <= 1) p.set(x, y, d > 0.62 ? 'R' : 'w');
      else if (d <= 1.45 && p.solid(x, y)) p.set(x, y, 'k');
    }
  // Iris and pupil, looking at you (frame 2: looking down, toward the thread).
  const look = f ? 2.6 : -0.8;
  const ix = Math.round(ex + dx * look);
  const iy = Math.round(ey + dy * look);
  p.stamp('.nnn.\nnBBBn\nnBiBn\nnBBBn\n.nnn.', ix - 2, iy - 2);
  p.set(ix - 1, iy - 1, 'f');
  // Red veins at the corners of the slot.
  p.set(Math.round(ex - dx * 4), Math.round(ey - dy * 4), 'r').set(Math.round(ex + dx * 4.5 + nx), Math.round(ey + dy * 4.5 + ny), 'r');
  // The red thread: tied through the slot, falling in a loop, then trailing away in running stitches.
  const tx = Math.round(ex + nx * 3);
  const ty = Math.round(ey + ny * 3);
  const sw = f ? 4 : -3;
  thread(p, tx, ty, 38 + sw * 0.5, 24, 30, 40 + (f ? 2 : 0), 'r', 'R');
  thread(p, 30, 40 + (f ? 2 : 0), 22 + sw, 52, 33, 60, 'r', 'R');
  for (let i = 0; i < 4; i++) stitchLine(p, 33 + i * 0, 60, 39, 60 - (i % 2), 'R', i);
  // A drop of something dark at the point.
  p.set(bx - 1, by + 1, 'R').set(bx - 1, by + 2, 'R');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Bouton Pendu (40x62) — un œil-bouton arraché, qui pend au bout d'un fil rouge. Un lambeau de feutre gris est resté
// cousu derrière, avec du rembourrage qui s'en échappe. Frame 2 : le balancier part de l'autre côté.
// ---------------------------------------------------------------------------------------------------------------------
function boutonPendu(f: number): string {
  const p = new Pix(40, 62);
  const sx = 20;
  const swing = f ? 5 : -5;
  const cx = sx + swing;
  const cy = 44;
  // The thread from the top, slightly curved by the swing.
  thread(p, sx, 0, sx + swing * 0.3, 18, cx - swing * 0.15, cy - 12, 'r', 'R');
  // The scrap of felt torn with it: grey felt with a ragged edge, stuffing poking out.
  const felt = new Pix(40, 62);
  felt.ball(cx + 1, cy + 2, 13, 11, ['W', 'g', 'G', 'd']);
  const rnd = seeded(61 + f);
  for (let a = 0; a < 360; a += 14) {
    const t = (a * Math.PI) / 180;
    if (rnd() < 0.55) felt.set(Math.round(cx + 1 + Math.cos(t) * 13), Math.round(cy + 2 + Math.sin(t) * 11), '.');
    if (rnd() < 0.3) felt.set(Math.round(cx + 1 + Math.cos(t) * 12), Math.round(cy + 2 + Math.sin(t) * 10), '.');
  }
  p.blit(felt.contour('k'));
  // Stuffing escaping from the torn bottom edge, in damp tufts.
  const tuft = new Pix(40, 62).blob(
    [
      [cx - 6, cy + 12, 3.5],
      [cx - 1, cy + 13, 4],
      [cx + 5, cy + 12, 3],
      [cx + 1, cy + 16, 2.6],
    ],
    COTTON,
    [cx, cy + 13, 9, 4],
    0.5,
  );
  p.blit(tuft.contour('k'));
  p.set(cx + 1, cy + 19, '8').set(cx + 1, cy + 20, '9');
  // The button: big, black, glossy, two holes like a stare, the red thread through them.
  const btn = new Pix(40, 62);
  btn.ball(cx, cy, 9, 9, ['d', 'K', 'i', 'i'], undefined, [0.85, 0.35, -0.2]);
  btn.ellipse(cx, cy, 6.2, 6.2, 'K');
  p.blit(btn.contour('k'));
  // Rim highlight, top-left; the sheen.
  for (let a = 200; a < 290; a += 9) {
    const t = (a * Math.PI) / 180;
    p.set(Math.round(cx + Math.cos(t) * 7.6), Math.round(cy + Math.sin(t) * 7.6), 'G');
  }
  p.set(cx - 4, cy - 5, 'f').set(cx - 5, cy - 4, 'w').set(cx - 3, cy - 5, 'w');
  // Two holes, a cross of thread between them.
  p.stamp('ii...ii\nii...ii', cx - 3, cy - 1);
  p.set(cx - 1, cy - 2, 'r').set(cx, cy - 1, 'r').set(cx + 1, cy, 'r').set(cx + 1, cy - 2, 'r').set(cx - 1, cy, 'r');
  // A frayed end of thread sticking out of the holes.
  p.set(cx + 4, cy + 3, 'R').set(cx + 5, cy + 4, 'r').set(cx + 6, cy + 4, 'r');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Bourre (54x40) — un tas de rembourrage mouillé, jauni, qui a encore la forme d'un mouton. Vidé. Là où il y avait
// les yeux, deux croix de fil défaites. Taches de moisi, gouttes. Frame 2 : il s'affaisse, une goutte tombe.
// ---------------------------------------------------------------------------------------------------------------------
function bourre(f: number): string {
  const p = new Pix(54, 40);
  const sag = f ? 1 : 0;
  // The body: a slumped lump of damp cotton.
  const body = new Pix(54, 40).blob(
    [
      [27, 25 + sag, 14],
      [16, 28 + sag, 9],
      [38, 28 + sag, 9],
      [22, 19 + sag, 8],
      [33, 18 + sag, 8],
      [10, 33, 5],
      [44, 33, 5],
      [27, 33, 8],
    ],
    COTTON,
    [27, 26 + sag, 24, 13],
    0.55,
  );
  body.curls(17 + f, 60, 4, 10, 50, 38, { '7': '8', '6': '7' });
  // Mildew stains soaked in.
  const rnd = seeded(29);
  for (let i = 0; i < 7; i++) {
    const x = 8 + Math.floor(rnd() * 38);
    const y = 16 + Math.floor(rnd() * 20);
    for (let yy = -1; yy <= 1; yy++)
      for (let xx = -2; xx <= 2; xx++) if (body.solid(x + xx, y + yy) && rnd() < 0.55) body.set(x + xx, y + yy, rnd() < 0.5 ? '%' : '9');
  }
  p.blit(body.contour('k'));
  // The head: a drooping lump on the left, two little ears of wool, no face left.
  const head = new Pix(54, 40).blob(
    [
      [11, 20 + sag * 2, 7],
      [8, 23 + sag * 2, 5],
    ],
    COTTON,
    [10, 21 + sag * 2, 8, 6],
    0.5,
  );
  p.blit(head.contour('k'));
  p.stamp('k7k\nk8k\n.k.', 3, 13 + sag * 2).stamp('k7k\nk8k\n.k.', 14, 12 + sag * 2);
  // Where the button eyes were: two undone cross-stitches, a loose end of red thread.
  const hy = 19 + sag * 2;
  p.stamp('R.R\n.R.\nR..', 6, hy).stamp('R.R\n.R.\n..R', 12, hy);
  p.set(9, hy + 4, 'r').set(9, hy + 5, 'r').set(8, hy + 6, 'r');
  // An open seam along the back, stitches pulled out.
  stitchLine(p, 20, 12 + sag, 36, 11 + sag, 'R', 1);
  // Drips under it.
  for (const [x, n] of f ? [[18, 2], [30, 4], [40, 1]] : [[18, 3], [30, 2], [40, 3]]) {
    let y = 39;
    while (y > 0 && !p.solid(x, y)) y--;
    for (let i = 1; i <= n; i++) p.set(x, y + i, '9');
  }
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Mouton Numéroté (46x42) — un mouton propre, trop propre, tamponné en rouge comme un dossier : un cartouche « N° »
// sur le flanc (le numéro est écrit par-dessus pendant le combat), une étiquette de dossier à l'oreille, un trombone.
// Les yeux fermés : il a déjà été compté. Frame 2 : il sautille.
// ---------------------------------------------------------------------------------------------------------------------
function moutonNumerote(f: number): string {
  const p = new Pix(46, 42);
  const b = f ? -2 : 0;
  // Legs, thin and dark.
  const legs = f ? [[13, 1], [19, -1], [28, 1], [34, -1]] : [[13, 0], [19, 0], [28, 0], [34, 0]];
  for (const [x, lean] of legs) {
    for (let y = 31 + b; y < 40; y++) p.set(x! + (y > 36 ? lean! : 0), y, 'd').set(x! + 1 + (y > 36 ? lean! : 0), y, 'K');
    p.set(x! + lean!, 40, 'k').set(x! + 1 + lean!, 40, 'k');
  }
  // Wool body, very white.
  const puffs: Array<[number, number, number]> = [[23, 22, 12]];
  for (let a = 0; a < 360; a += 30) {
    const t = (a * Math.PI) / 180;
    puffs.push([23 + Math.cos(t) * 13, 22 + Math.sin(t) * 8, 5]);
  }
  const wool = new Pix(46, 42).blob(
    puffs.map(([x, y, r]) => [x, y + b, r]),
    WOOL,
    [23, 22 + b, 18, 11],
    0.5,
  );
  wool.curls(11, 40, 6, 12, 40, 32, { w: 'W' });
  p.blit(wool.contour('k'));
  // Head on the right, grey face, eyes closed (counted, filed).
  const head = new Pix(46, 42);
  head.ball(38, 18 + b, 6, 6.5, ['g', 'G', 'd', 'K']);
  p.blit(head.contour('k'));
  p.stamp('kk..kk', 35, 18 + b).stamp('.pp..', 35, 21 + b);
  p.blob([[36, 12 + b, 3], [40, 12 + b, 3]], WOOL, [38, 12 + b, 5, 3]);
  // Ear with a file tab and a paperclip.
  p.stamp('kkkk.\nkgGk.\n.kk..', 41, 13 + b);
  p.stamp('kkkkk\nkYYYk\nkYQYk\nkkkkk', 41, 6 + b);
  p.stamp('.ggg\ng..g\ng.gg\ng..g\n.gg.', 42, 1 + b);
  // The red stamp on its side: a cartouche, « N° », and room for the number.
  p.stamp(
    `
    RRRRRRRRRRRRRRRRR
    R.r.r.rr........R
    R.rrr.r.r.......R
    R.r.r..r........R
    RRRRRRRRRRRRRRRRR
    `,
    7,
    19 + b,
  );
  // The ink of the stamp, a little smudged.
  p.set(24, 25 + b, 'R').set(8, 24 + b, 'r');
  return p.toString();
}

/** Where the number is written on a Mouton Numéroté (sprite pixels, after the 1px outline): left edge, top. */
export const MOUTON_STAMP = { x: 16, y: 21 };

// ---------------------------------------------------------------------------------------------------------------------
// Pile (44x42) — une pile bouton LR44, appuyée sur la tranche. Gravé : « + », « LR44 ». Elle fuit : une croûte blanche
// sur le bord, des cristaux, une coulure de rouille. Deux bosses comme des yeux mi-clos ; elle a l'air très fatiguée.
// Frame 2 : la croûte gagne un peu, les paupières tombent.
// ---------------------------------------------------------------------------------------------------------------------
function pile(f: number): string {
  const p = new Pix(44, 42);
  const cx = 21;
  const cy = 21;
  // The edge band (seen on the right, the cell leans), then the face.
  const band = new Pix(44, 42);
  band.ellipse(cx + 5, cy + 1, 16, 17, '$');
  p.blit(band.contour('k'));
  for (let y = 0; y < 42; y++) for (let x = cx + 6; x < 44; x++) if (p.get(x, y) === '$' && (y + x) % 7 === 0) p.set(x, y, '@');
  const face = new Pix(44, 42);
  face.ball(cx, cy, 16, 17, STEEL, undefined, [0.75, 0.2, -0.35]);
  p.blit(face.contour('k'));
  // Concentric rim of the positive face.
  for (let a = 0; a < 360; a += 4) {
    const t = (a * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(t) * 12.5);
    const y = Math.round(cy + Math.sin(t) * 13.5);
    if (p.get(x, y) !== 'k') p.set(x, y, a > 150 && a < 300 ? 'f' : '$');
  }
  // Engraved « + » and « LR44 »: darker on the light steel, lighter where the steel is in shadow.
  const engrave = (art: string, ox: number, oy: number): void =>
    art
      .trim()
      .split('\n')
      .forEach((r, j) => [...r.trim()].forEach((ch, i) => ch === 'x' && p.set(ox + i, oy + j, ['$', 'K'].includes(p.get(ox + i, oy + j)) ? '&' : '$')));
  engrave('.x.\nxxx\n.x.', cx - 1, cy - 9);
  engrave(
    `
    x..xx..x.x.x.x
    x..x.x.x.x.x.x
    x..xx..xxx.xxx
    x..x.x...x...x
    xx.x.x...x...x
    `,
    cx - 7,
    cy + 3,
  );
  // Two dents, like eyes half shut (frame 2: shut a little more).
  p.stamp(f ? '.....\n$$$$$\n.&&&.' : '.$$$.\n$KKK$\n.&&&.', cx - 9, cy - 3);
  p.stamp(f ? '.....\n$$$$$\n.&&&.' : '.$$$.\n$KKK$\n.&&&.', cx + 4, cy - 3);
  // The leak: white crust along the lower rim, crystals, a rust run.
  const rnd = seeded(13 + f);
  for (let a = 20; a < 160 + f * 25; a += 3) {
    const t = (a * Math.PI) / 180;
    const r = 15 + rnd() * 2.5;
    const x = Math.round(cx + 3 + Math.cos(t) * r);
    const y = Math.round(cy + Math.sin(t) * (r + 1));
    p.set(x, y, rnd() < 0.6 ? '=' : '+');
    if (rnd() < 0.5) p.set(x, y + 1, '+');
    if (rnd() < 0.25) p.set(x + 1, y - 1, '=');
  }
  for (let y = cy + 10; y < cy + 20; y++) p.set(cx + 13 + (y > cy + 16 ? 1 : 0), y, y % 3 ? '^' : 'x');
  // Crystals on the floor.
  p.stamp('.=.\n=+=', cx - 4, 39).stamp('=.\n++', cx + 8, 40);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Dodo décousu (64x64) — le Dodo de la v1.1, mais vu de l'intérieur de lui-même : laine jaunie et humide, la couture du
// ventre ouverte (fil rouge défait, gros points arrachés), le rembourrage gris qui pend, l'œil-bouton gauche arraché
// qui balance au bout de son fil, un trou à sa place. Frame 2 : l'œil balance de l'autre côté, la bourre glisse.
// ---------------------------------------------------------------------------------------------------------------------
const DODO_ART = artOf(ENEMY_ART.b_dodo);
const DODO_ART_2 = artOf(ENEMY_ART.b_dodo_2);

function dodoTorn(f: number): string {
  const p = Pix.of(f ? DODO_ART_2 : DODO_ART);
  const b = f ? 1 : 0;
  // Yellowed, damp wool; the pink of the ears and cheeks gone grey.
  p.recolor({ f: '6', w: '7', W: '8', p: 'g', P: 'G' });
  const cx = 32;
  const fy = 31 + b;
  // Brown damp stains.
  const rnd = seeded(91 + f);
  for (let i = 0; i < 14; i++) {
    const x = 6 + Math.floor(rnd() * 52);
    const y = 12 + Math.floor(rnd() * 44);
    const r = 1 + rnd() * 1.6;
    for (let yy = -2; yy <= 2; yy++)
      for (let xx = -2; xx <= 2; xx++) if (xx * xx + yy * yy <= r * r && ['7', '8'].includes(p.get(x + xx, y + yy))) p.set(x + xx, y + yy, rnd() < 0.7 ? '9' : '%');
  }
  // The left eye is gone: a dark hole with tufts of thread.
  p.stamp('.kkkk.\nkiiiik\nkiRiik\nkiiiRk\nkiiiik\n.kkkk.', cx - 10, fy - 5);
  // …it hangs by its thread, down past the cheek.
  const ex = cx - 13 + (f ? 4 : -2);
  const ey = fy + 11;
  thread(p, cx - 7, fy - 1, cx - 13, fy + 4, ex + 2, ey - 2, 'r');
  p.stamp('.kkkk.\nkKKKKk\nkKfKKk\nkKKKKk\nkKKKKk\n.kkkk.', ex - 1, ey - 2);
  // The stitched smile, undone on one side: a loose end hanging.
  p.set(cx + 3, fy + 4, '8').set(cx + 4, fy + 4, '8');
  p.set(cx + 5, fy + 5, 'R').set(cx + 5, fy + 6, 'R').set(cx + 6, fy + 7, 'r');
  // The belly seam, open: a dark slit held by a few pulled stitches, grey stuffing spilling out and down.
  const sx = cx + 9;
  const sy = 46 - b;
  const slit = new Pix(64, 64);
  slit.poly(
    [
      [sx - 3, sy - 2],
      [sx + 3, sy - 3],
      [sx + 5, sy + 6],
      [sx, sy + 10],
      [sx - 5, sy + 6],
    ],
    'i',
  );
  p.blit(slit);
  for (let y = sy - 2; y <= sy + 8; y += 3) p.set(sx - 5 + (y > sy + 4 ? 1 : 0), y, 'R').set(sx + 5 - (y > sy + 4 ? 1 : 0), y + 1, 'R');
  p.set(sx - 6, sy, 'r').set(sx - 7, sy + 1, 'r').set(sx + 6, sy + 4, 'r').set(sx + 7, sy + 5, 'r');
  const stuff = new Pix(64, 64).blob(
    [
      [sx - 1, sy + 4, 3.6],
      [sx + 2, sy + 7, 3.2],
      [sx - 1 + (f ? 1 : 0), sy + 11, 2.8],
    ],
    ['W', 'g', 'G', 'd'],
    [sx, sy + 7, 5, 7],
    0.5,
  );
  p.blit(stuff.contour('k'));
  // A thinner strand dangling lower, nearly to the floor.
  for (let y = sy + 14; y < 62; y++) if (!p.solid(sx, y)) p.set(sx + (y > 58 && f ? 1 : 0), y, y % 4 ? 'g' : 'G');
  // The side seam too: a gash on the right with stuffing.
  p.stamp('.kk.\nkigk\nkiWk\nkiik\n.kk.', 54, 28 - b);
  p.stamp('.W\nWg\n.g', 57, 33 - b);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Portraits (32x32): Dodo torn, built from his v1.1 portraits — yellowed, the left eye ripped out and hanging.
// ---------------------------------------------------------------------------------------------------------------------
function tornFace(base: string, expr: 'neutral' | 'creepy' | 'happy' | 'sad'): string {
  const p = Pix.of(base);
  p.recolor({ f: '6', w: '7', W: '8', p: 'g', P: 'G' });
  // Eyes sit on rows 16–19 of the portrait (left eye at x 11–14, right eye at x 19–22), the mouth on rows 21–22.
  const skin = p.get(8, 17);
  p.rect(10, 15, 6, 5, skin);
  p.stamp('.kkk.\nkiiik\nkiRik\n.kkk.', 10, 15);
  p.set(12, 19, 'r').set(11, 20, 'r').set(11, 21, 'r').set(10, 22, 'r');
  p.stamp('kkk\nkKk\nkkk', 8, 22);
  if (expr === 'sad') {
    // The other eye half shut; the stitched mouth turned down.
    p.rect(19, 16, 4, 4, skin);
    p.stamp('kkkk\nkKKk\n.kk.', 19, 17);
    p.rect(11, 21, 11, 2, skin);
    p.stamp('..kkkkkk..\n.k......k.', 11, 21);
  }
  // A seam opening on the forehead, two pulled stitches.
  p.stamp('R.R.R\n.i.i.\nR.R.R', 14, 6);
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// La Petite au Bonnet (24x40), de dos : un bonnet tricoté à oreilles de mouton, un gilet trop grand, des chaussons.
// Pas de visage : on ne la voit que de dos. Dessinée au crayon, en gris, sauf la laine du bonnet. Frame 2 : elle lève le
// poing et frappe au mur.
// ---------------------------------------------------------------------------------------------------------------------
function bonnet(f: number): string {
  const p = new Pix(24, 40);
  // Slippers and little legs.
  p.stamp('.kkk..kkk.\nkWWWkkWWWk\n.kkk..kkk.', 7, 37);
  p.rect(9, 32, 2, 5, 'g').rect(13, 32, 2, 5, 'g');
  p.set(9, 32, 'G').set(13, 32, 'G');
  // The cardigan, too big: shoulders, a long hem, knitted ribs.
  const body = new Pix(24, 40);
  body.poly(
    [
      [6, 18],
      [17, 18],
      [19, 33],
      [4, 33],
    ],
    'W',
  );
  body.ball(11.5, 20, 6.5, 3, ['w', 'W', 'g', 'G']);
  for (let y = 21; y < 33; y++) for (let x = 0; x < 24; x++) if (body.solid(x, y)) body.set(x, y, x > 14 ? 'g' : x < 7 ? 'g' : 'W');
  for (let x = 5; x < 19; x += 2) body.set(x, 32, 'G');
  body.rect(11, 22, 1, 10, 'G');
  p.blit(body.contour('k'));
  // Arms: the left one down; the right one down (frame 1) or raised to knock (frame 2).
  p.stamp('kk\nWk\ngk\ngk\ngk\nsk', 4, 21);
  if (f) {
    p.stamp('.kk\nkWk\nkgk\nkgk\nkgk\nkgk', 17, 9);
    p.stamp('ksk\nkSk\n.k.', 17, 6);
  } else p.stamp('kk\nkW\nkg\nkg\nkg\nks', 17, 21);
  // The knitted hat with its two sheep ears, from behind: cream wool, ribbed, a little pompom.
  const hat = new Pix(24, 40);
  hat.ball(11.5, 11, 7.5, 8, ['6', '7', '8', '9']);
  p.blit(hat.contour('k'));
  for (let x = 6; x < 18; x += 2) for (let y = 6; y < 18; y++) if (p.get(x, y) === '7') p.set(x, y, '8');
  p.rect(5, 16, 14, 2, '8');
  for (let x = 5; x < 19; x += 2) p.set(x, 16, '9');
  // Sheep ears: two soft lobes on the sides.
  p.stamp('..kkk\n.k667k\nk6778k\nk7788k\n.kkkk.', 0, 9).stamp('kkk..\nk766k.\nk8776k\nk8877k\n.kkkk.', 18, 9);
  p.stamp('.k.\nk6k\n.k.', 10, 1);
  // A little bit of neck under the hat, no hair.
  p.rect(10, 18, 4, 1, 'S');
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// La princesse au crayon (20x30) — la princesse-chevalière que Mina dessinait : couronne jaune, couettes orange, cape
// rouge, une épée en bois. Une marionnette de carton, avec trois fils qui montent (dessinés par le combat). Jamais
// abîmée : seulement suspendue.
// ---------------------------------------------------------------------------------------------------------------------
const PRINCESSE = `
  ......kkkkkk......
  .....kYkYYkYk.....
  .....kYYYYYYk.....
  ...kkkmmmmmmkkk...
  ..kmmkssssssskmmk.
  ..kmk.sksksss.kmk.
  ..kmk.sssssss.kmk.
  ...k..sPsssPs..k..
  ......kssRssk.....
  .....krrrrrrrk....
  ....krrwrrrwrrk...
  ...krrrwrrrwrrrk..
  ...krrrrrrrrrrrk..
  ..kRrrrrrrrrrrrRk.
  ..kRrrrrYYrrrrrRk.
  ..kRrrrrYYrrrrrRk.
  ..kRrrrrrrrrrrrRk.
  ...kRRrrrrrrrRRk..
  ....kkpkkkkkpkk...
  .....kpk...kpk....
  .....kpk...kpk....
  .....kck...kck....
  .....kkk...kkk....
`;

// ---------------------------------------------------------------------------------------------------------------------
// Overworld (≈14x14): small and readable.
// ---------------------------------------------------------------------------------------------------------------------
const OW_AIGUILLE = `
  ........kkk.
  .......k&wRk
  ......k&@k.r
  .....k&@k..r
  ....k&@k...r
  ...k&@k...r.
  ..k&@k...r..
  .k&@k....r..
  k&@k....r...
  k@k...rr....
  .k...r......
`;
const OW_BOUTON = `
  ....r.....
  ....r.....
  ....R.....
  ...r......
  ...r......
  ..kkkkk...
  .kKKKKKk..
  kKiKKiKKk.
  kKKrrKKKk.
  kKiKKiKKk.
  .kKKKKKk..
  ..kk7kk...
  ...787....
  ....8.....
`;
const OW_BOURRE = `
  ...kkk.kkkk...
  ..k677k6777k..
  .k6777787777k.
  kR7R777%78877k
  k.R.7787778788k
  k777877788%87k
  .k88788878888k
  ..kkkkkkkkkkk.
  ...9....9.....
`;
const OW_MOUTON = `
  ...kkkkk.kk.
  ..kwwwwwkYYk
  .kwwwwwwwkgk
  kRRRRRwwkggk
  kRrrrRwwkkk.
  kRRRRRWWk...
  .kWWWWWgk...
  ..kdk.kdk...
  ..kk..kk....
`;
const OW_PILE = `
  ...kkkkk...
  ..k&&&@$k..
  .k&@$@@@$k.
  k&@K@@K@$$k
  k@@@@@@@@$k
  k@$@$$$@@$k
  .k@@@@@@$k=
  ..kk==+kk=+
  ...=+==+...
`;

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

const o = (art: string, extra: Partial<Exclude<SpriteDef, string>> = {}): SpriteDef => ({ art, outline: 'k', colors: C6_COLORS, ...extra });
const c = (art: string): SpriteDef => ({ art, colors: C6_COLORS });

const FACE = (k: string): string => artOf(CHAR_ART[k]);

export const ART: Record<string, SpriteDef> = {
  b_aiguille: o(aiguille(0)),
  b_aiguille_2: o(aiguille(1)),
  b_bouton_pendu: o(boutonPendu(0)),
  b_bouton_pendu_2: o(boutonPendu(1)),
  b_bourre: o(bourre(0)),
  b_bourre_2: o(bourre(1)),
  b_mouton_numerote: o(moutonNumerote(0)),
  b_mouton_numerote_2: o(moutonNumerote(1)),
  b_pile: o(pile(0)),
  b_pile_2: o(pile(1)),
  b_dodo_torn: o(dodoTorn(0)),
  b_dodo_torn_2: o(dodoTorn(1)),
  b_bonnet: o(bonnet(0)),
  b_bonnet_2: o(bonnet(1)),
  b_c6_princesse: o(PRINCESSE),
  face_dodotorn_neutral: c(tornFace(FACE('face_dodo_neutral'), 'neutral')),
  face_dodotorn_creepy: c(tornFace(FACE('face_dodo_creepy'), 'creepy')),
  face_dodotorn_happy: c(tornFace(FACE('face_dodo_happy'), 'happy')),
  face_dodotorn_sad: c(tornFace(FACE('face_dodo_neutral'), 'sad')),
  ow_aiguille: o(OW_AIGUILLE),
  ow_aiguille_2: o(Pix.of(OW_AIGUILLE).move(9, 1, 3, 10, -1, 0).toString()),
  ow_bouton_pendu: o(OW_BOUTON),
  ow_bouton_pendu_2: o(Pix.of(OW_BOUTON).move(0, 5, 10, 9, 1, 0).toString()),
  ow_bourre: o(OW_BOURRE),
  ow_bourre_2: o(Pix.of(OW_BOURRE).move(0, 0, 15, 7, 0, 1).toString()),
  ow_mouton_numerote: o(OW_MOUTON),
  ow_mouton_numerote_2: o(Pix.of(OW_MOUTON).move(0, 0, 12, 7, 0, -1).toString()),
  ow_pile: o(OW_PILE),
  ow_pile_2: o(flipArt(OW_PILE)),
};

export const VARIANTS: string[] = [];

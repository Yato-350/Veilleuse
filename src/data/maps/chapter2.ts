import { hash2 } from '../../engine/math';
import type { MapDef, NpcDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { savePoint, f, nf } from '../../game/story/common';
import * as C2 from '../../game/story/chapter2';
import { Grid } from './build';

/*
 * Chapter 2 — « La Forêt de Crayons »:
 * lisiere → foret (+ bibliotheque) → clairiere → sentier_gomme → atelier.
 * Erased zones ('e') are white holes while Gomme is around; once she is spared they come back (legend getters).
 */

// TEMP: debug view spawns
const TMPVIEW = (...pts: Array<[number, number]>): MapDef['spawns'] => Object.fromEntries(pts.map(([x, y], i) => [`view${i}`, { x, y }]));
const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const DECO = (sprite: string, x: number, y: number, text?: string | string[], o: Partial<PropDef> = {}): PropDef =>
  P(sprite, x, y, { text, ...o });
const SOFT = (sprite: string, x: number, y: number, text?: string | string[], o: Partial<PropDef> = {}): PropDef =>
  P(sprite, x, y, { solid: false, text, ...o });

const spared = (): boolean => !!G.state.flags.c2_gomme_spared;
/** Erased-zone decorations disappear once Gomme gives the drawings back… */
const ERASED_ONLY = nf('c2_gomme_spared');
/** …and flowers grow there instead. */
const RESTORED_ONLY = f('c2_gomme_spared');

const FOREST_LEGEND = {
  P: 'pencil_wall',
  '.': 'paper',
  s: 'paper_scribble',
  c: 'crayon_grass',
  i: 'ink_water',
};

const PENCILS = ['prop_pencil_r', 'prop_pencil_b', 'prop_pencil_y', 'prop_pencil_g', 'prop_pencil_v'];
const PENCIL_TEXTS = [
  'Un crayon géant, planté pointe en haut. Il sent le bois taillé.',
  'Un arbre-crayon. Sa mine touche presque le ciel. Il a dû dessiner les nuages.',
  'Un crayon géant. Quelqu\'un a gravé des initiales dans le bois : « M. ».',
  'Un crayon tout neuf. Il n\'a encore jamais rien dessiné.',
  'Un arbre-crayon. Quand le vent souffle, il grince comme une craie sur un tableau.',
];
/** A pencil tree (color and text vary with position). */
const pencil = (x: number, y: number, o: Partial<PropDef> = {}): PropDef => {
  const k = (x * 7 + y * 3) % PENCILS.length;
  return P(PENCILS[k]!, x, y, { text: PENCIL_TEXTS[(x + y) % PENCIL_TEXTS.length], ...o });
};

const CRUMB_TEXTS = ['Des miettes de gomme, roses.', 'Des miettes de gomme. Elles sont encore tièdes.', 'Des miettes roses, comme une neige sale.'];
const crumbs = (x: number, y: number): PropDef => SOFT('prop_eraser_crumbs', x, y, CRUMB_TEXTS[(x + y) % CRUMB_TEXTS.length], { cond: ERASED_ONLY });
const bloom = (x: number, y: number, text = 'Une grande fleur. Elle n\'était pas là. Ou alors, elle est revenue.'): PropDef =>
  DECO('prop_flower_big', x, y, text, { cond: RESTORED_ONLY });

const LANTERN = (c: 'r' | 'y' | 'g' | 'b', x: number, y: number): PropDef => P(`prop_lantern_${c}_off`, x, y, { id: `lantern_${c}`, script: C2.lantern(c) });

const firefly = (i: number, x: number, y: number): NpcDef => ({
  id: `luciole_${i}`,
  sprite: 'npc_luciole',
  frames: ['npc_luciole', 'npc_luciole_2'],
  frameSpeed: 10 + i,
  x,
  y,
  float: true,
  shadow: false,
  solid: false,
  light: { r: 18, color: '#ffe991', flicker: true },
  cond: f('c2_lanterns_ok'),
});

// ---------------------------------------------------------------------------
// La Lisière — where the Cotton Country turns into a drawing
// ---------------------------------------------------------------------------

const lisiereTiles = new Grid(40, 22, 'g')
  .rect(16, 0, 24, 22, 'c')
  .blob(16, 5, 3, 3, 'g', 2, 'c')
  .blob(17, 17, 3, 3, 'g', 3, 'c')
  .rect(27, 0, 13, 22, '.', 'c')
  .blob(27, 4, 3, 3, 'c', 4, '.')
  .blob(26, 17, 3, 3, 'c', 5, '.')
  .blob(34, 3, 3, 2, 'c', 6, '.')
  .blob(35, 18, 3, 2, 'c', 7, '.')
  .scatter('f', 0.07, 11, 'g')
  .scatter('s', 0.07, 12, '.')
  .path(
    [
      [6, 11],
      [16, 11],
    ],
    'p',
    2,
  )
  .path(
    [
      [16, 11],
      [39, 11],
    ],
    '.',
    2,
  )
  .border('H', 1, 5, 1)
  .rect(19, 0, 21, 22, 'P', 'H')
  .open(38, 11, 2, 2, '.');

const LISIERE: MapDef = {
  id: 'lisiere',
  name: 'La Lisière',
  world: 'dream',
  music: 'forest',
  particles: 'cotton',
  banner: true,
  tiles: lisiereTiles.toString(),
  legend: { ...FOREST_LEGEND, H: 'hedge', g: 'grass', f: 'grass_flowers', p: 'path' },
  spawns: {
    ...TMPVIEW([10, 6], [30, 6], [10, 16], [30, 16]),
    default: { x: 6, y: 11, dir: 'right' },
    bed: { x: 6, y: 11, dir: 'right' },
    east: { x: 36, y: 11, dir: 'left' },
  },
  props: [
    P('prop_bed_dream', 5, 10, { id: 'dream_bed', h: 2, script: C2.dreamBed }),
    savePoint(8, 8, 'Une petite veilleuse, plantée entre l\'herbe et le papier. Elle éclaire les deux côtés à la fois.'),
    P('prop_crayon_rock', 11, 9, { script: C2.stumpText }),
    DECO('prop_sign', 15, 9, undefined, { script: C2.lisiereSign }),
    DECO('prop_sign', 2, 13, undefined, { script: C2.backSign }),
    P('prop_stall', 20, 7, { w: 2, script: C2.chaussetteTalk }),
    P('prop_mailbox', 24, 14, { script: C2.mailbox }),
    // Cotton side
    DECO('prop_tree', 3, 4, 'Un arbre en barbe à papa. Le dernier avant la forêt. Il penche un peu, comme pour regarder.'),
    DECO('prop_tree_b', 10, 3, 'Un arbre menthe. Ses feuilles du côté de la forêt sont dessinées au crayon.'),
    DECO('prop_tree', 12, 17, 'Un arbre rose. Une branche est devenue grise, toute hachurée.'),
    DECO('prop_tree_small', 3, 18, 'Un arbrisseau en coton.'),
    DECO('prop_bush', 6, 5, 'Un buisson tout rond.'),
    DECO('prop_bush', 14, 4, 'Un buisson. La moitié est en coton, l\'autre moitié est coloriée.'),
    DECO('prop_flower_big', 8, 16, 'Une fleur géante. Elle se tourne vers le Pays de Coton, pas vers la forêt.'),
    DECO('prop_flower_big', 16, 3, 'Une fleur géante, à moitié coloriée. Le crayon s\'est arrêté au milieu d\'un pétale.'),
    P('prop_cloud_big', 4, 17, { w: 3, text: ['Un petit nuage de coton s\'est posé là.', 'Il a suivi le lit jusqu\'ici. Il n\'ose pas entrer dans la forêt.'] }),
    DECO('prop_bush', 9, 13, 'Un buisson rond comme une pelote.'),
    DECO('prop_tree_b', 16, 18, 'Un arbre menthe. Ses racines sont dessinées au crayon gris.'),
    DECO('prop_rock', 17, 14, 'Un caillou en guimauve. Un côté est hachuré au crayon, comme si on avait commencé à le dessiner.'),
    SOFT('prop_mushroom', 10, 18, 'Un champignon qui dort.'),
    SOFT('prop_mushroom', 4, 8, 'Un champignon à pois.'),
    SOFT('prop_mushroom', 15, 14, 'Un champignon. Son chapeau est dessiné au feutre.'),
    // Pencil side
    pencil(23, 3),
    pencil(26, 7),
    pencil(30, 4),
    pencil(33, 7),
    pencil(36, 3),
    pencil(22, 17),
    pencil(27, 18),
    pencil(31, 15),
    pencil(35, 17),
    pencil(29, 9),
    DECO('prop_crayon_rock', 32, 13, 'Un bout de crayon de cire. Il a été beaucoup aimé.'),
    DECO('prop_crayon_rock', 25, 4, 'Un bout de crayon de cire bleu.'),
    SOFT('prop_drawing_erased', 33, 19, 'Un dessin, à moitié gommé. Il reste un bout de soleil.', { cond: ERASED_ONLY }),
  ],
  npcs: [
    {
      id: 'mina_stump',
      char: 'mina',
      x: 11,
      y: 10,
      dir: 'down',
      cond: nf('c2_intro'),
      script: C2.minaStump,
    },
    {
      id: 'chaussette',
      sprite: 'npc_chaussette',
      frames: ['npc_chaussette', 'npc_chaussette_2'],
      frameSpeed: 30,
      x: 22,
      y: 7,
      script: C2.chaussetteTalk,
    },
    {
      id: 'chaussette_paire',
      sprite: 'npc_chaussette',
      frames: ['npc_chaussette_2', 'npc_chaussette'],
      frameSpeed: 30,
      x: 23,
      y: 7,
      cond: f('c1_chaussette_paire'),
      text: ['C\'est moi, la paire ! On ne se quitte plus. Même pour les voyages.', 'Surtout pour les voyages.'],
      who: 'chaussette',
    },
    { id: 'egare', char: 'mouton_bleu', x: 13, y: 14, wander: 1, script: C2.moutonEgare },
  ],
  enemies: [{ id: 'c2_avion_0', enemies: ['avion'], x: 33, y: 16, wander: 2, cond: f('c2_intro') }],
  warps: [{ x: 39, y: 11, h: 2, to: 'foret', spawn: 'west', cond: f('c2_intro') }],
};

// ---------------------------------------------------------------------------
// Forest helpers: paper avenues along the paths, pencil trees lining them
// ---------------------------------------------------------------------------

type Pt = [number, number];

/** Distance (4-neighbour steps) from every cell to the nearest path cell. */
function pathDistance(w: number, h: number, paths: Pt[][], thick = 2): number[][] {
  const mask = new Grid(w, h, '0');
  for (const p of paths) mask.path(p, '1', thick);
  const dist = Array.from({ length: h }, () => Array.from({ length: w }, () => Infinity));
  const queue: Pt[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask.get(x, y) === '1') {
        dist[y]![x] = 0;
        queue.push([x, y]);
      }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as Pt[]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || dist[ny]![nx]! <= dist[y]![x]! + 1) continue;
      dist[ny]![nx] = dist[y]![x]! + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

/** Cells used by props, NPCs, enemies, spawns, triggers and warps (plus a margin), where no tree may grow. */
function reservedCells(parts: Pick<MapDef, 'props' | 'npcs' | 'enemies' | 'spawns' | 'triggers' | 'warps'>): Set<string> {
  const out = new Set<string>();
  const rect = (x: number, y: number, w = 1, h = 1, m = 0): void => {
    for (let yy = y - m; yy < y + h + m; yy++) for (let xx = x - m; xx < x + w + m; xx++) out.add(`${xx},${yy}`);
  };
  for (const p of parts.props ?? []) rect(p.x, p.y, p.w, (p.h ?? 1) + 1, p.script || p.text ? 1 : 0);
  for (const n of parts.npcs ?? []) rect(n.x, n.y, 1, 1, 1 + (n.wander ?? 0));
  for (const e of parts.enemies ?? []) rect(e.x, e.y, 1, 1, 1);
  for (const s of Object.values(parts.spawns)) rect(s.x, s.y, 1, 1, 1);
  for (const t of parts.triggers ?? []) rect(t.x, t.y, t.w, t.h);
  for (const w of parts.warps ?? []) rect(w.x, w.y, w.w, (w.h ?? 1) + 1, 1);
  return out;
}

/**
 * Turns the ground around the paths into lined paper (avenues `avenue` cells wide on each side), then lines them with
 * pencil trees and scatters a few more in the undergrowth. Mutates the grid; returns the tree props.
 */
function pencilForest(
  g: Grid,
  paths: Pt[][],
  reserved: Set<string>,
  o: { seed: number; avenue?: number; edge?: number; deep?: number; ground?: string[] },
): PropDef[] {
  const dist = pathDistance(g.w, g.h, paths);
  const avenue = o.avenue ?? 2;
  const ground = new Set(o.ground ?? ['c', '.', 's']);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (dist[y]![x]! <= avenue && g.get(x, y) === 'c') g.set(x, y, '.');
  const trees: PropDef[] = [];
  const taken = new Set<string>();
  for (let y = 1; y < g.h - 1; y++) {
    for (let x = 1; x < g.w - 1; x++) {
      const dd = dist[y]![x]!;
      if (dd < 2 || reserved.has(`${x},${y}`) || !ground.has(g.get(x, y) ?? '')) continue;
      // Sprites are three tiles tall: keep neighbours (and the tree two rows up) free so trunks don't pile up.
      const r = hash2(x, y, o.seed);
      const chance = dd <= 3 ? (o.edge ?? 0.42) : (o.deep ?? 0.1);
      if (r >= chance) continue;
      const near = [`${x - 1},${y}`, `${x},${y - 1}`, `${x},${y - 2}`, `${x - 1},${y - 1}`, `${x + 1},${y - 1}`];
      if (near.some((k) => taken.has(k))) continue;
      taken.add(`${x},${y}`);
      trees.push(pencil(x, y));
    }
  }
  return trees;
}

// ---------------------------------------------------------------------------
// La Forêt de Crayons
// ---------------------------------------------------------------------------

const FORET_PATHS: Pt[][] = [
  [
    [0, 17],
    [12, 17],
    [12, 8],
    [9, 8],
  ],
  [
    [12, 17],
    [28, 17],
    [28, 8],
    [40, 8],
    [40, 0],
  ],
  [
    [28, 13],
    [44, 13],
    [44, 26],
  ],
  [
    [20, 18],
    [20, 27],
    [27, 27],
  ],
];

const foret = new Grid(50, 34, 'c')
  .blob(10, 6, 4, 2.5, '.', 31)
  .blob(31, 28, 6, 4, '.', 34)
  .blob(47, 30, 2.5, 2.5, '.', 37)
  // Pencil thickets
  .blob(5, 27, 4, 4, 'P', 21)
  .blob(23, 10, 3, 2.5, 'P', 22)
  .blob(34, 3, 3.5, 2, 'P', 23)
  .blob(26, 23, 2.5, 2.5, 'P', 24)
  .blob(47, 9, 3, 2, 'P', 25)
  .blob(18, 4, 3, 2, 'P', 26)
  .blob(4, 12, 2, 2, 'P', 27)
  .blob(38, 31, 3, 1.5, 'P', 28);
for (const p of FORET_PATHS) foret.path(p, '.', 2);
foret
  // Ink pond
  .blob(32, 28, 4, 2.2, 'i', 35)
  // Erased holes (white)
  .blob(17, 14, 3.5, 1.8, 'e', 41)
  .blob(38, 21, 3.5, 2.5, 'e', 42)
  .blob(11, 27, 3, 2, 'e', 43)
  .blob(44, 3, 2, 1.5, 'e', 44)
  .border('P', 1, 27, 1)
  .open(0, 17, 2, 2, '.')
  .open(40, 0, 2, 2, '.')
  .rect(47, 30, 2, 2, '.');

const FORET_SPAWNS: MapDef['spawns'] = {
  default: { x: 2, y: 17, dir: 'right' },
  west: { x: 2, y: 17, dir: 'right' },
  north: { x: 40, y: 2, dir: 'down' },
  library: { x: 9, y: 7, dir: 'down' },
  flowers: { x: 17, y: 16, dir: 'down' },
};

const FORET_PROPS: PropDef[] = [
  // The Owl's library
  P('prop_paper_house', 8, 4, { w: 3, h: 2, text: ['Une maison en papier plié. Une pancarte : « BIBLIOTHÈQUE — Silence (sauf pour les devinettes) ».'] }),
  DECO('prop_bookstack', 6, 6, 'Une pile de livres posée dehors, sous la pluie. Personne ne l\'a jamais rentrée.'),
  DECO('prop_sign', 10, 15, undefined, { script: C2.forestSign }),
  savePoint(25, 19, 'Une veilleuse plantée dans le papier. Autour d\'elle, le blanc n\'ose pas avancer.'),
  // Pond and oddities
  P('', 31, 27, { solid: false, script: C2.inkPond }),
  P('', 29, 28, { solid: false, script: C2.inkPond }),
  P('prop_sharpener_big', 34, 16, { w: 2, script: C2.sharpener }),
  P('prop_pencil_g', 48, 30, { script: C2.greenPencil }),
  P('prop_pencil_y', 3, 20, { script: C2.chewedPencil }),
  DECO('prop_crayon_rock', 23, 20, 'Un bout de crayon de cire. Trop court pour dessiner. Trop joli pour être jeté.'),
  DECO('prop_crayon_rock', 37, 10, 'Un bout de crayon de cire rose.'),
  DECO('prop_crayon_rock', 7, 9, 'Un bout de crayon de cire. On dirait qu\'il a été mâchouillé.'),
  // Erased zones…
  SOFT('prop_drawing_erased', 17, 14, undefined, { script: C2.erasedDrawing, cond: ERASED_ONLY }),
  P('', 38, 21, { solid: false, script: C2.erasedHole, cond: ERASED_ONLY }),
  P('', 11, 27, { solid: false, script: C2.erasedHole, cond: ERASED_ONLY }),
  crumbs(15, 15),
  crumbs(20, 14),
  crumbs(36, 23),
  crumbs(40, 19),
  crumbs(10, 26),
  crumbs(44, 4),
  SOFT('prop_drawing_erased', 40, 22, 'Un dessin gommé. On devine un toboggan. Ou une girafe. Ou les deux.', { cond: ERASED_ONLY }),
  // …and what grows there once Gomme gives everything back.
  bloom(15, 14, 'Une fleur géante. Avant, il y avait des fleurs ici. Maintenant aussi.'),
  bloom(19, 13),
  bloom(37, 20),
  bloom(40, 23),
  bloom(12, 27),
];

const FORET_NPCS: NpcDef[] = [{ id: 'peintre', char: 'mouton_jaune', x: 34, y: 21, dir: 'right', script: C2.moutonPeintre }];

const FORET_ENEMIES: MapDef['enemies'] = [
  { id: 'c2_taille_1', enemies: ['taille_crayon'], x: 21, y: 23, wander: 2 },
  { id: 'c2_avion_1', enemies: ['avion'], x: 33, y: 9, wander: 2 },
  { id: 'c2_taille_2', enemies: ['taille_crayon'], x: 45, y: 23, wander: 2 },
  { id: 'c2_avion_2', enemies: ['avion'], x: 8, y: 22, wander: 2 },
  { id: 'c2_duo_1', enemies: ['avion', 'luciole'], x: 25, y: 28, wander: 2 },
  { id: 'c2_luciole_0', enemies: ['luciole'], x: 38, y: 5, wander: 1 },
];

const FORET_TRIGGERS: MapDef['triggers'] = [
  { x: 14, y: 16, w: 6, h: 3, once: 'c2_flowers', script: C2.foretFlowers },
  { x: 39, y: 4, w: 4, h: 1, once: 'c2_freeze', cond: f('c2_flowers'), script: C2.minaFreeze },
];

const FORET_WARPS: MapDef['warps'] = [
  { x: 0, y: 17, h: 2, to: 'lisiere', spawn: 'east' },
  { x: 40, y: 0, w: 2, to: 'clairiere', spawn: 'south' },
  { x: 9, y: 5, door: true, to: 'bibliotheque', spawn: 'entry' },
];

const FORET_TREES = pencilForest(
  foret,
  FORET_PATHS,
  reservedCells({ props: FORET_PROPS, npcs: FORET_NPCS, enemies: FORET_ENEMIES, spawns: FORET_SPAWNS, triggers: FORET_TRIGGERS, warps: FORET_WARPS }),
  { seed: 77 },
);
foret.scatter('s', 0.08, 36, '.');

const FORET: MapDef = {
  id: 'foret',
  name: 'Forêt de Crayons',
  world: 'dream',
  music: 'forest',
  particles: 'dust',
  banner: true,
  tiles: foret.toString(),
  get legend() {
    return { ...FOREST_LEGEND, e: spared() ? 'grass_flowers' : 'erased' };
  },
  spawns: { ...FORET_SPAWNS, ...TMPVIEW([10, 6], [26, 6], [40, 6], [10, 17], [26, 17], [40, 17], [10, 28], [26, 28], [40, 28]) },
  props: [...FORET_PROPS, ...FORET_TREES],
  npcs: FORET_NPCS,
  enemies: FORET_ENEMIES,
  triggers: FORET_TRIGGERS,
  warps: FORET_WARPS,
};

// ---------------------------------------------------------------------------
// Bibliothèque du Hibou (inside the paper house)
// ---------------------------------------------------------------------------

const BIBLIOTHEQUE: MapDef = {
  id: 'bibliotheque',
  name: 'Bibliothèque du Hibou',
  world: 'dream',
  music: 'village',
  darkness: 0.2,
  playerLight: 0,
  particles: 'dust',
  tiles: `
    TTTTTTTTTTTTTTTT
    TWWWWWWWWWWWWWWT
    TWWWWWWWWWWWWWWT
    T..............T
    T..............T
    T..............T
    T..............T
    T....RRRRRR....T
    T....RRRRRR....T
    T..............T
    T..............T
    TTTTTTT.TTTTTTTT
    TTTTTTT.TTTTTTTT
  `,
  legend: { T: 'wall_d_top', W: 'wall_d', '.': 'paper', R: 'rug' },
  spawns: { default: { x: 7, y: 10, dir: 'up' }, entry: { x: 7, y: 10, dir: 'up' } },
  props: [
    P('prop_shelf', 1, 3, { w: 2, script: C2.shelfTales }),
    P('prop_shelf', 3, 3, { w: 2, script: C2.shelfUnread }),
    DECO('prop_bookstack', 5, 3, 'Une pile de dictionnaires. Le mot « adieu » a été découpé dans chacun d\'eux.'),
    DECO('prop_bookstack', 9, 3, 'Une pile d\'atlas. Ils ne montrent que des pays qui n\'existent pas.'),
    P('prop_jar_shelf', 10, 3, { w: 2, script: C2.jars }),
    P('prop_shelf', 12, 3, { w: 2, script: C2.shelfRhymes }),
    DECO('prop_plant', 14, 3, 'Une plante en papier crépon. Quelqu\'un l\'arrose quand même.'),
    P('prop_bookstack', 14, 6, { script: C2.shelfBlank }),
    P('prop_desk', 11, 8, { w: 2, text: 'Un bureau de lecture. La lampe est allumée pour personne.' }),
    P('prop_carnet', 12, 8, { solid: false, oy: -13, script: C2.carnet, light: { r: 22, color: '#fff3cf', flicker: true, dy: -14 } }),
    DECO('prop_chair', 10, 8, 'Une chaise. Elle attend un lecteur.'),
    P('prop_lamp', 3, 7, { text: 'Un lampadaire. Son abat-jour est une page de dictionnaire.', light: { r: 46, color: '#ffe991', dy: -18 } }),
    DECO('prop_bookstack', 1, 9, 'Des livres pour s\'endormir. Celui du dessus s\'est endormi le premier.'),
    DECO('prop_bookstack', 14, 9, 'Des cahiers de vacances. Toutes les réponses sont justes. Un peu trop justes.'),
  ],
  npcs: [
    {
      id: 'hibou',
      sprite: 'npc_hibou',
      frames: ['npc_hibou', 'npc_hibou_2'],
      frameSpeed: 40,
      x: 7,
      y: 3,
      script: C2.hibou,
      light: { r: 30, color: '#fff3cf' },
    },
  ],
  warps: [{ x: 7, y: 12, to: 'foret', spawn: 'library' }],
};

// ---------------------------------------------------------------------------
// Clairière des Lucioles — the lantern puzzle
// ---------------------------------------------------------------------------

const clairiere = new Grid(30, 24, 'P')
  .blob(15, 12, 12, 9.5, 'c', 51)
  .blob(15, 12, 8, 6, '.', 52)
  .scatter('s', 0.06, 53, '.')
  .rect(14, 0, 2, 5, '.')
  .rect(14, 19, 2, 5, '.')
  // Pencils packed tight across the north path: they step aside once the lanterns are lit.
  .rect(14, 3, 2, 2, 'n');

const CLAIRIERE: MapDef = {
  id: 'clairiere',
  name: 'Clairière des Lucioles',
  world: 'dream',
  music: 'forest',
  particles: 'fireflies',
  darkness: 0.42,
  playerLight: 42,
  banner: true,
  tiles: clairiere.toString(),
  get legend() {
    return { ...FOREST_LEGEND, n: G.state.flags.c2_lanterns_ok ? 'paper' : 'pencil_wall' };
  },
  spawns: {
    ...TMPVIEW([8, 6], [22, 6], [8, 18], [22, 18]),
    default: { x: 14, y: 21, dir: 'up' },
    south: { x: 14, y: 21, dir: 'up' },
    north: { x: 14, y: 2, dir: 'down' },
  },
  onEnter: C2.clairiereEnter,
  props: [
    DECO('prop_sign', 15, 11, undefined, { script: C2.rainbowSign }),
    LANTERN('b', 9, 8),
    LANTERN('y', 21, 8),
    LANTERN('g', 8, 15),
    LANTERN('r', 22, 15),
    savePoint(19, 18, 'Une veilleuse au bord de la clairière. Les lucioles éteintes s\'en approchent, un peu jalouses.'),
    P('', 14, 4, { id: 'dark_barrier', w: 2, script: C2.darkBarrier, cond: nf('c2_lanterns_ok') }),
    pencil(5, 6),
    pencil(25, 6),
    pencil(4, 16),
    pencil(26, 15),
    pencil(10, 3),
    pencil(20, 3),
    pencil(9, 20),
    pencil(21, 20),
    DECO('prop_crayon_rock', 6, 11, 'Un bout de crayon de cire jaune. Il brille un peu, dans le noir.'),
    DECO('prop_crayon_rock', 24, 11, 'Un bout de crayon de cire vert.'),
  ],
  npcs: [
    {
      id: 'derniere_luciole',
      sprite: 'npc_luciole',
      frames: ['npc_luciole', 'npc_luciole_2'],
      frameSpeed: 12,
      x: 11,
      y: 17,
      float: true,
      shadow: false,
      light: { r: 26, color: '#ffe991', flicker: true },
      script: C2.lastFirefly,
    },
    ...C2.FIREFLIES.map(([x, y], i) => firefly(i, x, y)),
  ],
  enemies: [
    { id: 'c2_luciole_1', enemies: ['luciole'], x: 6, y: 13, wander: 2 },
    { id: 'c2_luciole_2', enemies: ['luciole'], x: 24, y: 12, wander: 2 },
    { id: 'c2_duo_2', enemies: ['luciole', 'taille_crayon'], x: 18, y: 5, wander: 1 },
  ],
  warps: [
    { x: 14, y: 23, w: 2, to: 'foret', spawn: 'north' },
    {
      x: 14,
      y: 0,
      w: 2,
      to: 'sentier_gomme',
      spawn: 'south',
      cond: f('c2_lanterns_ok'),
      locked: ['Il fait trop noir pour avancer.'],
    },
  ],
};

// ---------------------------------------------------------------------------
// Sentier gommé — the path to the workshop, whiter and whiter
// ---------------------------------------------------------------------------

const sentier = new Grid(16, 30, 'P')
  .path(
    [
      [7, 29],
      [7, 22],
      [3, 22],
      [3, 14],
      [10, 14],
      [10, 6],
      [6, 6],
      [6, 0],
    ],
    '.',
    3,
  )
  .scatter('s', 0.07, 61, '.')
  .blob(4, 19, 1.5, 1.2, 'e', 62, '.')
  .blob(11, 10, 2, 1.5, 'e', 63, '.')
  .blob(8, 6, 2.5, 1.5, 'e', 64, '.')
  .blob(7, 2, 2.5, 2, 'e', 65, '.');

const SENTIER: MapDef = {
  id: 'sentier_gomme',
  name: 'Sentier gommé',
  world: 'dream',
  music: 'forest',
  particles: 'fireflies',
  darkness: 0.3,
  playerLight: 44,
  banner: true,
  tiles: sentier.toString(),
  get legend() {
    return { ...FOREST_LEGEND, e: spared() ? 'crayon_grass' : 'erased' };
  },
  spawns: {
    ...TMPVIEW([8, 5], [8, 15], [8, 25]),
    default: { x: 8, y: 27, dir: 'up' },
    south: { x: 8, y: 27, dir: 'up' },
    north: { x: 7, y: 2, dir: 'down' },
  },
  props: [
    savePoint(12, 7, 'Une dernière veilleuse avant l\'atelier. Sa lumière ne fait pas d\'ombre sur le blanc.'),
    crumbs(5, 20),
    crumbs(11, 11),
    crumbs(4, 15),
    crumbs(8, 3),
    SOFT('prop_drawing_erased', 9, 9, undefined, { script: C2.sentierDrawing, cond: ERASED_ONLY }),
    SOFT('prop_drawing_erased', 4, 17, 'Un dessin gommé. Il reste deux pieds, et un bout de chemin.', { cond: ERASED_ONLY }),
  ],
  enemies: [{ id: 'c2_taille_3', enemies: ['taille_crayon'], x: 5, y: 15, wander: 1 }],
  triggers: [{ x: 9, y: 11, w: 4, h: 1, once: 'c2_oubli', script: C2.minaOubli }],
  warps: [
    { x: 7, y: 29, w: 3, to: 'clairiere', spawn: 'north' },
    { x: 6, y: 0, w: 3, to: 'atelier', spawn: 'south' },
  ],
};

// ---------------------------------------------------------------------------
// Atelier de Gomme — boss
// ---------------------------------------------------------------------------

const atelier = new Grid(26, 20, 'D')
  .rect(3, 10, 3, 4, '.')
  .rect(19, 13, 4, 3, '.')
  .rect(16, 3, 3, 2, '.')
  .blob(7, 14, 2.5, 2, 'e', 71, 'D')
  .blob(12, 11, 3, 1.6, 'e', 72)
  .blob(20, 7, 2, 1.5, 'e', 73)
  .blob(21, 15, 2, 1.5, 'e', 74)
  .blob(12, 3, 4, 1.2, 'e', 75)
  .border('P', 1, 9, 0)
  .open(12, 19, 2, 1, 'D');

const ATELIER: MapDef = {
  id: 'atelier',
  name: 'Atelier de Gomme',
  world: 'dream',
  music: null,
  ambience: 'wind',
  particles: 'dust',
  darkness: 0.15,
  playerLight: 0,
  banner: true,
  tiles: atelier.toString(),
  get legend() {
    return { P: 'pencil_wall', D: 'desk_wood', '.': 'paper', e: spared() ? 'paper_scribble' : 'erased' };
  },
  spawns: {
    ...TMPVIEW([8, 5], [18, 5], [8, 15], [18, 15]),
    default: { x: 12, y: 17, dir: 'up' },
    south: { x: 12, y: 17, dir: 'up' },
    boss: { x: 12, y: 7, dir: 'up' },
  },
  props: [
    P('b_gomme', 11, 4, { id: 'gomme_boss', w: 3, frames: ['b_gomme', 'b_gomme_2'], frameSpeed: 24, cond: nf('c2_boss_done'), script: C2.gommeBoss }),
    P('prop_desk_big', 2, 4, { w: 3, script: C2.atelierDesk }),
    P('prop_easel', 6, 4, { script: C2.atelierEasel }),
    P('prop_easel', 17, 5, { script: C2.atelierEasel }),
    P('prop_easel', 3, 15, { script: C2.atelierEasel }),
    P('prop_sharpener_big', 21, 10, { w: 2, script: C2.sharpener }),
    DECO('prop_bookstack', 23, 4, 'Des cahiers. Toutes les pages sont blanches. Gomme a été très appliquée.'),
    DECO('prop_bookstack', 1, 8, 'Des carnets de croquis, vidés de leurs croquis.'),
    DECO('prop_crayon_rock', 9, 16, 'Un crayon de cire, usé jusqu\'au bout. Il a beaucoup dessiné avant d\'arriver ici.'),
    DECO('prop_crayon_rock', 18, 17, 'Un bout de crayon de cire bleu nuit.'),
    SOFT('prop_drawing_erased', 7, 13, ['Un dessin gommé. Il reste un bout de couronne en papier.', 'Et la moitié d\'un sourire.'], { cond: ERASED_ONLY }),
    SOFT('prop_drawing_erased', 20, 14, 'Un dessin gommé. On devine un lit. Un grand lit, avec des barreaux.', { cond: ERASED_ONLY }),
    crumbs(11, 12),
    crumbs(14, 10),
    crumbs(19, 7),
    crumbs(10, 5),
    crumbs(15, 6),
    crumbs(22, 16),
  ],
  npcs: [
    {
      id: 'gomme',
      sprite: 'npc_gomme',
      x: 12,
      y: 4,
      cond: f('c2_gomme_spared'),
      who: 'gomme',
      text: ['On garde. Même ce qui fait mal.', 'C\'est plus lourd. Mais c\'est à nous.'],
    },
  ],
  triggers: [{ x: 8, y: 8, w: 10, h: 2, cond: nf('c2_boss_done'), script: C2.gommeBoss }],
  warps: [{ x: 12, y: 19, w: 2, to: 'sentier_gomme', spawn: 'north', cond: nf('c2_boss_done') }],
};

export const CHAPTER2_MAPS: Record<string, MapDef> = {
  lisiere: LISIERE,
  foret: FORET,
  bibliotheque: BIBLIOTHEQUE,
  clairiere: CLAIRIERE,
  sentier_gomme: SENTIER,
  atelier: ATELIER,
};

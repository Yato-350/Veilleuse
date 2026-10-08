import { hash2 } from '../../engine/math';
import type { MapDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { savePoint, f, nf } from '../../game/story/common';
import * as C1 from '../../game/story/chapter1';
import { Grid } from './build';

/* Chapter 1 — « Le Pays de Coton »: prairie → village (+ boutique, maison_mouton) → colline. */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const DECO = (sprite: string, x: number, y: number, text?: string | string[], o: Partial<PropDef> = {}): PropDef =>
  P(sprite, x, y, { text, ...o });
const SOFT = (sprite: string, x: number, y: number, text?: string): PropDef => P(sprite, x, y, { solid: false, text });

const DREAM_LEGEND = {
  H: 'hedge',
  g: 'grass',
  f: 'grass_flowers',
  '.': 'path',
  c: 'cotton',
  C: 'cotton_wall',
  w: 'water',
  '=': 'bridge',
  F: 'fence',
};

const LAMP = { r: 44, color: '#ffe991', flicker: true, dy: -22 };

// ---------------------------------------------------------------------------
// Prairie de Coton
// ---------------------------------------------------------------------------

const prairieTiles = new Grid(44, 24, 'g')
  .scatter('f', 0.05, 11, 'g')
  .blob(13, 5, 4, 2, 'f', 2)
  .blob(31, 18, 5, 2, 'f', 3)
  .blob(7, 11, 5, 4, 'c', 4)
  .path(
    [
      [11, 11],
      [20, 11],
      [20, 10],
      [42, 10],
    ],
    '.',
    2,
  )
  .border('H', 1, 5, 1)
  .rect(27, 0, 2, 24, 'w')
  .rect(27, 10, 2, 2, '=')
  .open(42, 10, 2, 2, '.')
  .toString();

const PRAIRIE: MapDef = {
  id: 'prairie',
  name: 'Prairie de Coton',
  world: 'dream',
  music: 'meadow',
  particles: 'cotton',
  banner: true,
  tiles: prairieTiles,
  legend: DREAM_LEGEND,
  spawns: {
    default: { x: 7, y: 12, dir: 'down' },
    bed: { x: 7, y: 11, dir: 'down' },
    mina: { x: 18, y: 11, dir: 'right' },
    east: { x: 41, y: 10, dir: 'left' },
  },
  props: [
    P('prop_bed_dream', 6, 10, { id: 'dream_bed', h: 2, script: C1.dreamBed }),
    savePoint(9, 8, 'Une petite lumière en forme de lune. Elle te rappelle quelque chose. Tu te sens au chaud.'),
    DECO('prop_sign', 12, 9, undefined, { script: C1.prairieSign }),
    P('prop_balloon_tree', 15, 4, { id: 'balloon_tree', script: C1.balloonTree, cond: () => !G.state.flags.c1_ballon_quest || !G.state.keyItems.includes('ballon') }),
    DECO('prop_tree', 4, 4, 'Un arbre en barbe à papa. Tu as envie d\'en arracher un bout.'),
    DECO('prop_tree', 10, 19, 'Un arbre en barbe à papa. Il sent la fête foraine.'),
    DECO('prop_tree', 23, 4, ['Un arbre rose et mou.', 'Quand le vent souffle, il en tombe des flocons sucrés.']),
    DECO('prop_tree', 34, 3, 'Un arbre en barbe à papa, un peu penché.'),
    DECO('prop_tree_b', 19, 19, 'Un arbre menthe à l\'eau. Il fait « pschit » quand on le touche.'),
    DECO('prop_tree_b', 39, 18, 'Un arbre menthe. Il est plus grand que les autres et il le sait.'),
    DECO('prop_tree_b', 39, 4, 'Un arbre menthe, tout frais.'),
    DECO('prop_tree_small', 25, 15, 'Un petit arbre qui pousse. Il deviendra grand si on rêve assez longtemps.'),
    DECO('prop_tree_small', 3, 19, 'Un arbrisseau.'),
    DECO('prop_bush', 5, 16, 'Un buisson rond comme une pelote.'),
    DECO('prop_bush', 24, 8, undefined, { script: C1.bootsBush }),
    DECO('prop_bush', 36, 13, 'Un buisson qui sent la fraise.'),
    DECO('prop_bush', 31, 14, 'Un buisson.'),
    DECO('prop_rock', 14, 15, 'Un caillou tout doux. C\'est de la guimauve.'),
    DECO('prop_rock', 32, 7, undefined, { script: C1.smileyRock }),
    P('prop_toybox', 3, 21, { script: C1.minaTreasure }),
    SOFT('prop_mushroom', 9, 4, 'Un champignon à pois. Il fait « boing » si on saute dessus. Tu ne sautes pas.'),
    SOFT('prop_mushroom', 26, 19, 'Un champignon.'),
    SOFT('prop_mushroom', 37, 8, 'Un champignon qui a l\'air de dormir.'),
    DECO('prop_flower_big', 18, 6, 'Une fleur plus grande que toi. Elle se tourne vers toi quand tu passes.'),
    DECO('prop_flower_big', 34, 19, 'Une fleur géante. Une abeille en coton dort dedans.'),
  ],
  enemies: [
    { id: 'c1_nuage_1', enemies: ['nuage'], x: 12, y: 5, wander: 2, cond: () => !!G.state.flags.c1_tutorial },
    { id: 'c1_pissenlit_1', enemies: ['pissenlit'], x: 15, y: 18, wander: 2, cond: () => !!G.state.flags.c1_tutorial },
    { id: 'c1_mouton_noir_1', enemies: ['mouton_noir'], x: 35, y: 6, wander: 2 },
    { id: 'c1_nuage_3', enemies: ['nuage', 'pissenlit'], x: 35, y: 16, wander: 2 },
  ],
  triggers: [{ x: 21, y: 1, w: 1, h: 22, cond: () => !!G.state.flags.c1_tutorial && !G.state.flags.c1_mina, script: C1.meetMina }],
  warps: [{ x: 43, y: 10, h: 2, to: 'village', spawn: 'west', cond: () => !!G.state.flags.c1_mina, locked: ['Mina t\'attend quelque part par ici.'] }],
};

// ---------------------------------------------------------------------------
// Village des Moutons
// ---------------------------------------------------------------------------

const villageTiles = new Grid(40, 28, 'g')
  .scatter('f', 0.04, 21, 'g')
  .blob(20, 14, 8, 5, '.', 5)
  .path(
    [
      [0, 13],
      [14, 13],
    ],
    '.',
    2,
  )
  .path(
    [
      [19, 0],
      [19, 9],
    ],
    '.',
    2,
  )
  .path(
    [
      [25, 6],
      [25, 10],
    ],
    '.',
    1,
  )
  .path(
    [
      [6, 6],
      [6, 12],
      [13, 12],
    ],
    '.',
    1,
  )
  .path(
    [
      [11, 6],
      [11, 11],
    ],
    '.',
    1,
  )
  .blob(31, 23, 4, 2, 'w', 6)
  .border('H', 1, 7, 1)
  .open(0, 13, 1, 2, '.')
  .open(19, 0, 2, 1, '.')
  .toString();

const VILLAGE: MapDef = {
  id: 'village',
  name: 'Village des Moutons',
  world: 'dream',
  music: 'village',
  particles: 'petals',
  darkness: 0.14,
  playerLight: 0,
  banner: true,
  tiles: villageTiles,
  legend: DREAM_LEGEND,
  spawns: {
    default: { x: 2, y: 13, dir: 'right' },
    west: { x: 2, y: 13, dir: 'right' },
    north: { x: 19, y: 2, dir: 'down' },
    shop: { x: 25, y: 6, dir: 'down' },
    maison: { x: 6, y: 6, dir: 'down' },
  },
  props: [
    P('prop_house', 5, 4, { w: 3, h: 2, text: 'La maison de Mémé Laine. La porte ronde est entrouverte.' }),
    P('prop_house_b', 10, 4, { w: 3, h: 2 }),
    P('', 11, 5, { script: C1.sleepyHouse }),
    P('prop_shop', 24, 4, { w: 3, h: 2 }),
    P('prop_house', 31, 4, { w: 3, h: 2, text: 'Une chaumière. On entend ronfler à l\'intérieur. Fort.' }),
    P('prop_house_b', 3, 19, { w: 3, h: 2, text: 'Une chaumière. Une guirlande de chaussettes sèche devant la porte.' }),
    P('prop_house', 33, 17, { w: 3, h: 2, script: C1.blackSheepHouse }),
    P('prop_well', 19, 14, { w: 2, script: C1.well }),
    DECO('prop_sign', 16, 11, undefined, { script: C1.noticeBoard }),
    P('prop_stall', 11, 16, { w: 2, script: C1.stall }),
    P('prop_bench', 25, 18, { w: 2, script: C1.benchMN }),
    P('prop_bench', 13, 8, { w: 2, text: 'Un banc. Le coussin est en laine, évidemment.' }),
    P('prop_lamppost', 15, 10, { light: LAMP, text: 'Un réverbère. Au lieu d\'une ampoule, il y a une petite lune qui dort.' }),
    P('prop_lamppost', 24, 10, { light: LAMP, text: 'Un réverbère à lune.' }),
    P('prop_lamppost', 15, 18, { light: LAMP, text: 'Un réverbère à lune.' }),
    P('prop_lamppost', 24, 18, { light: LAMP, text: 'Un réverbère à lune. Celle-ci ronfle.' }),
    P('prop_mailbox', 8, 6, { text: ['La boîte aux lettres de Mémé Laine.', 'Une lettre dépasse : « Pour Noa ». … Non. Tu as mal lu. « Pour la laine ».'] }),
    DECO('prop_tree', 2, 9, 'Un arbre en barbe à papa.'),
    DECO('prop_tree', 36, 12, 'Un arbre rose.'),
    DECO('prop_tree', 8, 24, 'Un arbre. Un écureuil en peluche te regarde depuis une branche.'),
    DECO('prop_tree_b', 22, 24, 'Un arbre menthe.'),
    DECO('prop_tree_b', 37, 24, 'Un arbre menthe.'),
    DECO('prop_tree_b', 15, 23, 'Un arbre menthe au bord du chemin.'),
    DECO('prop_flower_big', 9, 9, 'Une fleur géante qui fredonne.'),
    DECO('prop_flower_big', 29, 9, 'Une fleur géante.'),
    DECO('prop_bush', 27, 8, 'Un buisson taillé en forme de mouton.'),
    DECO('prop_bush', 3, 16, 'Un buisson.'),
    savePoint(23, 13, 'Une veilleuse au milieu de la place. Les moutons viennent s\'y réchauffer le soir.'),
  ],
  npcs: [
    { id: 'lune', sprite: 'npc_lune', frames: ['npc_lune', 'npc_lune_2'], frameSpeed: 40, x: 35, y: 8, float: true, shadow: false, script: C1.lune },
    { id: 'agneau', sprite: 'npc_agneau', x: 22, y: 16, script: C1.agneau },
    { id: 'compteur', char: 'mouton', x: 27, y: 17, script: C1.moutonCompteur },
    { id: 'poete', char: 'mouton_rose', x: 12, y: 21, wander: 1, script: C1.moutonPoete },
    { id: 'peureux', char: 'mouton_bleu', x: 33, y: 12, wander: 1, script: C1.moutonPeureux },
    { id: 'jaune', char: 'mouton_jaune', x: 8, y: 10, script: C1.moutonJaune },
    {
      id: 'chaussette_perdue',
      sprite: 'ow_chaussette_perdue',
      frames: ['ow_chaussette_perdue', 'ow_chaussette_perdue_2'],
      frameSpeed: 20,
      x: 21,
      y: 3,
      cond: nf('c1_sock_done'),
      script: C1.lostSock,
    },
  ],
  warps: [
    { x: 0, y: 13, h: 2, to: 'prairie', spawn: 'east' },
    { x: 19, y: 0, w: 2, to: 'colline', spawn: 'south' },
    { x: 25, y: 5, door: true, to: 'boutique', spawn: 'entry' },
    { x: 6, y: 5, door: true, to: 'maison_mouton', spawn: 'entry' },
  ],
};

// ---------------------------------------------------------------------------
// Interiors
// ---------------------------------------------------------------------------

const INTERIOR_LEGEND = { T: 'wall_d_top', W: 'wall_d', P: 'plank', R: 'rug' };

const BOUTIQUE: MapDef = {
  id: 'boutique',
  name: 'Boutique de Chaussette',
  world: 'dream',
  music: 'shop',
  tiles: `
    TTTTTTTTTTTTT
    TWWWWWWWWWWWT
    TWWWWWWWWWWWT
    TPPPPPPPPPPPT
    TPPPPPPPPPPPT
    TPPPRRRRRPPPT
    TPPPRRRRRPPPT
    TPPPPPPPPPPPT
    TTTTTTPTTTTTT
    TTTTTTPTTTTTT
  `,
  legend: INTERIOR_LEGEND,
  spawns: { default: { x: 6, y: 7, dir: 'up' }, entry: { x: 6, y: 7, dir: 'up' } },
  props: [
    P('prop_counter_shop', 5, 4, { w: 2, script: C1.chaussetteShop }),
    P('prop_jar_shelf', 1, 3, { w: 2, text: ['Des bocaux : « boutons », « rubans », « soupirs (périmés) ».'] }),
    P('prop_jar_shelf', 9, 3, { w: 2, text: ['Des bocaux pleins de bonbons, de bulles et de petits orages en bouteille.'] }),
    P('prop_plant', 11, 3, { text: 'Une plante en laine tricotée. Elle n\'a jamais besoin d\'eau.' }),
    P('prop_plant', 1, 7, { text: 'Une plante. Une chaussette pend à une de ses branches.' }),
    P('prop_bench', 9, 7, { w: 2, text: 'Un banc pour essayer les chaussures. Il n\'y a pas de chaussures. Juste des chaussettes.' }),
  ],
  npcs: [
    {
      id: 'chaussette',
      sprite: 'npc_chaussette',
      frames: ['npc_chaussette', 'npc_chaussette_2'],
      frameSpeed: 30,
      x: 5,
      y: 3,
      script: C1.chaussetteTalk,
    },
    {
      id: 'chaussette_paire',
      sprite: 'npc_chaussette',
      frames: ['npc_chaussette_2', 'npc_chaussette'],
      frameSpeed: 30,
      x: 6,
      y: 3,
      cond: () => !!G.state.flags.c1_chaussette_paire,
      text: ['C\'est moi, la paire ! On est jumelles, sauf que moi je suis la gauche.'],
      who: 'chaussette',
    },
  ],
  warps: [{ x: 6, y: 9, to: 'village', spawn: 'shop' }],
};

const MAISON: MapDef = {
  id: 'maison_mouton',
  name: 'Chez Mémé Laine',
  world: 'dream',
  music: 'village',
  tiles: `
    TTTTTTTTTTTT
    TWWWWWWWWWWT
    TWWWWWWWWWWT
    TPPPPPPPPPPT
    TPPPPPPPPPPT
    TPPRRRRRRPPT
    TPPRRRRRRPPT
    TPPPPPPPPPPT
    TTTTTPTTTTTT
    TTTTTPTTTTTT
  `,
  legend: INTERIOR_LEGEND,
  spawns: { default: { x: 5, y: 7, dir: 'up' }, entry: { x: 5, y: 7, dir: 'up' } },
  props: [
    P('prop_bed_dream', 1, 3, { h: 2, text: 'Le lit de Mémé Laine. Il y a dix couvertures dessus. Et un chat en laine, dessous.' }),
    P('prop_shelf', 7, 3, { w: 2, script: C1.houseShelf }),
    P('prop_plant', 10, 3, { text: 'Une plante. Elle porte une écharpe.' }),
    P('prop_table', 4, 5, { w: 2, text: ['Une table. Des pelotes, des aiguilles, une tasse de tisane.', 'Et un nuage à moitié tricoté.'] }),
    P('prop_chair', 3, 5, { text: 'Une chaise à bascule.' }),
    P('prop_chair', 6, 5, { text: 'Une chaise.' }),
  ],
  npcs: [{ id: 'meme', char: 'mouton_rose', x: 8, y: 6, dir: 'left', script: C1.memeLaine }],
  warps: [{ x: 5, y: 9, to: 'village', spawn: 'maison' }],
};

// ---------------------------------------------------------------------------
// Colline aux Couvertures
// ---------------------------------------------------------------------------

const hill = new Grid(30, 34, 'a');
for (let by = 0; by < 12; by++) for (let bx = 0; bx < 10; bx++) if (hash2(bx, by, 41) < 0.5) hill.rect(bx * 3, by * 3, 3, 3, 'b');
hill
  .border('C', 1, 9, 1)
  .rect(1, 26, 28, 1, 'O')
  .rect(16, 26, 3, 1, 'a')
  .rect(1, 20, 28, 1, 'O')
  .rect(4, 20, 3, 1, 'a')
  .rect(1, 14, 28, 1, 'O')
  .rect(21, 14, 4, 1, 'b')
  .rect(10, 22, 1, 3, 'O')
  .rect(20, 16, 1, 3, 'O')
  .rect(24, 16, 5, 4, 'F')
  .rect(25, 17, 3, 2, 'g')
  .open(14, 33, 2, 1, 'a')
  .open(14, 32, 2, 1, 'a');

const COLLINE: MapDef = {
  id: 'colline',
  name: 'Colline aux Couvertures',
  world: 'dream',
  music: 'mina',
  particles: 'cotton',
  banner: true,
  tiles: hill.toString(),
  legend: { a: 'quilt_a', b: 'quilt_b', O: 'pillow', C: 'cotton_wall', F: 'fence', g: 'grass' },
  spawns: {
    default: { x: 14, y: 31, dir: 'up' },
    south: { x: 14, y: 31, dir: 'up' },
    summit: { x: 14, y: 8, dir: 'up' },
    puzzle: { x: 18, y: 15, dir: 'right' },
    sheep: { x: 21, y: 15, dir: 'right' },
  },
  props: [
    P('prop_closet_door', 14, 4, { id: 'closet_door', w: 2, script: C1.closetBoss, cond: () => !G.state.flags.c1_boss_done }),
    savePoint(9, 9, 'Une veilleuse posée sur la couverture. Tout là-haut, quelque chose respire dans le noir.'),
    P('prop_pillow_big', 2, 23, { w: 2, script: C1.pillowA }),
    P('prop_pillow_big', 16, 16, { w: 2, script: C1.pillowB }),
    // The summit path: two pillows block it until the Moutonnier's sheep are counted, then they move aside.
    P('prop_pillow_big', 21, 14, { id: 'hill_pillow_l', w: 2, script: C1.blockingPillows, cond: nf('c1_sheep_done') }),
    P('prop_pillow_big', 23, 14, { id: 'hill_pillow_r', w: 2, script: C1.blockingPillows, cond: nf('c1_sheep_done') }),
    P('prop_pillow_big', 19, 14, { w: 2, text: 'Un oreiller qui s\'est poussé pour vous laisser passer. Il ronfle.', cond: f('c1_sheep_done') }),
    P('prop_pillow_big', 25, 14, { w: 2, text: 'Un oreiller. Il dort sur le côté, comme quelqu\'un de poli.', cond: f('c1_sheep_done') }),
    P('prop_pillow_big', 3, 6, { w: 2, script: C1.pillowC }),
    P('prop_pillow_big', 21, 9, { w: 2, script: C1.pillowSeat }),
    P('prop_cloud_big', 23, 4, { w: 3, text: 'Un nuage qui s\'est posé pour se reposer.' }),
    P('prop_cloud_big', 4, 29, { w: 3, text: 'Un nuage endormi.' }),
  ],
  npcs: [
    { id: 'moutonnier', char: 'mouton', x: 22, y: 16, dir: 'down', script: C1.moutonnier },
    { id: 'pen_sheep', char: 'mouton', x: 25, y: 17, dir: 'left', script: C1.penSheep },
    { id: 'pen_sheep_2', char: 'mouton_rose', x: 26, y: 18, dir: 'left', script: C1.penSheep },
    { id: 'pen_black', sprite: 'ow_mouton_noir', x: 27, y: 17, script: C1.penBlackSheep },
  ],
  enemies: [
    { id: 'c1_nuage_2', enemies: ['nuage'], x: 8, y: 29, wander: 2 },
    { id: 'c1_mouton_noir_2', enemies: ['mouton_noir'], x: 22, y: 23, wander: 2 },
    { id: 'c1_pissenlit_2', enemies: ['pissenlit'], x: 12, y: 17, wander: 2 },
    { id: 'c1_duo', enemies: ['mouton_noir', 'nuage'], x: 6, y: 11, wander: 1 },
  ],
  triggers: [
    { x: 1, y: 30, w: 28, h: 1, once: 'c1_hill', script: C1.hillIntro },
    { x: 1, y: 12, w: 28, h: 1, once: 'c1_fears', script: C1.hillFears },
    { x: 21, y: 15, w: 3, h: 5, once: 'c1_sheep_meet', cond: nf('c1_sheep_done'), script: C1.moutonnierMeet },
  ],
  warps: [{ x: 14, y: 33, w: 2, to: 'village', spawn: 'north' }],
};

export const CHAPTER1_MAPS: Record<string, MapDef> = {
  prairie: PRAIRIE,
  village: VILLAGE,
  boutique: BOUTIQUE,
  maison_mouton: MAISON,
  colline: COLLINE,
};

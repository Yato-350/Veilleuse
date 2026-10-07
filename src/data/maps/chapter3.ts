import type { MapDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { f, isSilenceRoute, nf, savePoint } from '../../game/story/common';
import * as C3 from '../../game/story/chapter3';
import { Grid } from './build';

/*
 * Chapter 3 — « L'Hôpital de Papier »:
 *   ruines (ink) → hopital (lobby + endless corridor; salle_jeux) → chambre_304 → vide (final battle).
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const DECO = (sprite: string, x: number, y: number, text?: string | string[], o: Partial<PropDef> = {}): PropDef =>
  P(sprite, x, y, { text, ...o });
/** A decoration hung on the wall-base row. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** An invisible light source (neon, moonlight). */
const LIGHT = (x: number, y: number, r: number, color: string, flicker = true, dy = -6): PropDef =>
  P('', x, y, { solid: false, light: { r, color, flicker, dy } });

const stage = (): number => Number(G.state.flags.c3_loop ?? 0);
const atStage = (s: number) => () => stage() === s;
const alive = () => !isSilenceRoute();

// ---------------------------------------------------------------------------
// Ruines — the Cotton Country drowned in ink
// ---------------------------------------------------------------------------

const ruinesGrid = new Grid(48, 27, 'g').scatter('f', 0.03, 31, 'g');
ruinesGrid
  .blob(6, 13, 4, 3, 'c', 5)
  // Ink pools left behind in the village.
  .blob(4, 7, 1.4, 1, 'o', 41)
  .blob(15, 2.5, 1.2, 0.8, 'o', 42)
  .blob(29, 17, 1.5, 1, 'o', 43)
  .blob(22, 22, 4, 2, 'O', 7)
  .path(
    [
      [7, 14],
      [31, 14],
    ],
    '.',
    2,
  )
  .path(
    [
      [21, 14],
      [21, 9],
    ],
    '.',
    2,
  )
  .blob(21.5, 10, 5, 1.6, '.', 12)
  .path(
    [
      [9, 16],
      [9, 19],
    ],
    '.',
    2,
  )
  // The marsh: ink everywhere east of the village.
  .blob(36, 19, 5, 3, 'O', 14)
  .blob(45, 14, 2, 4, 'O', 15)
  .blob(34, 9, 1.5, 1.5, 'O', 16)
  .blob(44, 8, 1.5, 1.2, 'O', 17)
  .blob(33, 13, 1.6, 0.9, 'o', 18)
  .blob(37, 9, 1.3, 1, 'o', 19)
  .blob(42, 11, 1.8, 1.3, 'o', 20)
  .blob(42, 18, 1.4, 1.4, 'o', 21)
  .blob(32, 23, 1.6, 1, 'o', 22)
  .blob(45, 22, 1.4, 1, 'o', 23)
  .blob(36, 15, 1.2, 0.8, 'o', 24)
  .path(
    [
      [31, 14],
      [39, 14],
      [39, 5],
    ],
    '.',
    2,
  )
  .border('I', 1, 23, 1)
  // The paper hospital, standing in the ink.
  .rect(32, 1, 15, 1, 'T')
  .rect(32, 2, 15, 2, 'W')
  .rect(32, 4, 15, 1, 'B')
  .set(34, 2, 'w')
  .set(37, 2, 'w')
  .set(42, 2, 'w')
  .set(45, 2, 'w')
  .set(34, 3, 'w')
  .set(45, 3, 'w')
  .set(39, 3, 'D')
  .set(39, 4, 'd')
  // Gomme's nook: a pocket sealed by running ink.
  .blob(9.5, 22.5, 4.2, 2.6, 'I', 25)
  .blob(9.5, 22.6, 2.8, 1.3, 'g', 26)
  .rect(9, 20, 2, 1, 'g');

const RUINES: MapDef = {
  id: 'ruines',
  name: 'Ruines du Pays de Coton',
  world: 'ink',
  music: 'dodo',
  ambience: 'wind',
  particles: 'ink',
  darkness: 0.22,
  playerLight: 44,
  vignette: 0.45,
  banner: true,
  tiles: ruinesGrid.toString(),
  legend: {
    g: 'grass',
    f: 'grass_flowers',
    '.': 'path',
    c: 'cotton',
    o: 'ink_puddle',
    O: 'ink_water',
    I: 'ink_wall',
    T: 'h_wall_top',
    W: 'h_wall',
    B: 'h_wall_base',
    w: 'h_window',
    D: 'h_door_top',
    d: 'h_door',
  },
  spawns: {
    default: { x: 6, y: 13, dir: 'down' },
    bed: { x: 6, y: 13, dir: 'down' },
    hopital: { x: 39, y: 5, dir: 'down' },
  },
  onEnter: C3.ruinesEnter,
  props: [
    P('prop_bed_dream', 5, 12, { id: 'dream_bed', h: 2, script: C3.inkBed }),
    savePoint(23, 17, 'Une petite veilleuse, au milieu de l\'encre. Elle tient bon. Tu te sens un peu plus courageux.'),
    // The village.
    P('prop_house', 12, 6, { w: 3, h: 2, text: ['La maison de Mémé Laine.', 'L\'encre a coulé par la cheminée. La porte ronde ne s\'ouvre plus.'] }),
    P('prop_house_b', 16, 5, { w: 3, h: 2, text: ['Une chaumière.', 'Sur la porte, la pancarte « Sieste en cours » a coulé. On lit seulement : « … pour toujours ».'] }),
    P('prop_shop', 25, 6, { w: 3, h: 2, text: ['La boutique de Chaussette.', 'L\'encre a rempli la vitrine jusqu\'en haut. On dirait un aquarium de nuit.'] }),
    P('prop_well', 22, 8, { w: 2, text: ['Le puits est plein d\'encre jusqu\'au bord.', 'Ton reflet n\'y apparaît pas.'] }),
    DECO('prop_sign', 19, 12, undefined, { script: C3.noticeBoardRuines }),
    P('prop_lamppost', 17, 13, { text: 'Un réverbère. La petite lune qui dormait dedans s\'est éteinte.' }),
    P('prop_lamppost', 26, 13, { text: 'Un réverbère. Il n\'y a plus de lune dedans. Juste une flaque noire.' }),
    P('prop_bench', 13, 10, { w: 2, text: ['Un banc. Un tricot y a été abandonné, les aiguilles encore plantées dedans.', 'Un nuage à moitié tricoté. Il ne sera jamais fini.'] }),
    P('prop_stall', 15, 17, { w: 2, text: ['Un étal de fortune. Quelques bocaux tachés d\'encre.', '« TOUT DOIT DISPARAÎTRE ». Quelqu\'un a barré « DISPARAÎTRE ».'] }),
    DECO('prop_bookstack', 28, 16, undefined, { script: C3.owlBooks }),
    // Around.
    DECO('prop_tree', 3, 6, 'Un arbre en barbe à papa. L\'encre a figé ses branches en filaments noirs.'),
    DECO('prop_tree', 9, 5, 'Un arbre. Il goutte.'),
    DECO('prop_tree_b', 3, 19, 'Un arbre menthe. Il ne fait plus « pschit ». Il ne fait plus rien.'),
    DECO('prop_tree', 28, 22, 'Un arbre rose, devenu gris. Il pleut de l\'encre de ses branches.'),
    DECO('prop_tree_b', 16, 20, 'Un arbre menthe à l\'eau, noyé d\'encre.'),
    DECO('prop_tree_small', 29, 4, 'Un arbrisseau. Il ne deviendra jamais grand.'),
    DECO('prop_bush', 11, 17, 'Un buisson. Il y a encore des traces de petites bottes autour.'),
    DECO('prop_bush', 13, 18, 'Un buisson rond comme une pelote. Une pelote noire.'),
    DECO('prop_flower_big', 7, 17, 'Une fleur géante, fanée, la tête basse. Elle ne se tourne plus vers toi.'),
    DECO('prop_pillow_big', 2, 9, 'Un oreiller géant, échoué ici depuis la Colline aux Couvertures. Il est imbibé d\'encre.', { w: 2 }),
    DECO('prop_rock', 2, 21, 'Un caillou en guimauve. Il a fondu.'),
    DECO('prop_mushroom', 30, 19, 'Un champignon à pois. Il ne fait plus « boing ».', { solid: false }),
    DECO('prop_mushroom', 11, 3, 'Un champignon qui dort.', { solid: false }),
    // The marsh.
    DECO('prop_tree', 44, 20, 'Un arbre mort, debout dans l\'encre.'),
    DECO('prop_rock', 33, 11, 'Un rocher. Le smiley qu\'on avait dessiné dessus a coulé. Il pleure.'),
    DECO('prop_cloud_big', 40, 23, 'Un nuage de coton tombé du ciel. Il ne se relèvera pas.', { w: 3 }),
    ...C3.MARSH_LIGHTS.map(([x, y], i) =>
      P('npc_luciole', x, y, { id: `luciole_${i}`, frames: ['npc_luciole', 'npc_luciole_2'], frameSpeed: 14, float: true, solid: false, cond: f('c3_lit'), light: { r: 46, color: '#ffe991', flicker: true } }),
    ),
    // The hospital and its fallen star.
    P('prop_star_fallen', 36, 6, { id: 'star_fallen', w: 2, script: C3.starFallen, light: { r: 44, color: '#ffe991', flicker: true } }),
    P('', 41, 4, { script: C3.hospitalSign }),
    // Gomme's nook.
    P('t_ink_wall_1', 9, 20, { id: 'ink_plug_a', frames: ['t_ink_wall_1', 't_ink_wall_2', 't_ink_wall_3'], frameSpeed: 20, script: C3.inkPlug, cond: nf('c3_nook_open') }),
    P('t_ink_wall_2', 10, 20, { id: 'ink_plug_b', frames: ['t_ink_wall_2', 't_ink_wall_3', 't_ink_wall_1'], frameSpeed: 20, script: C3.inkPlug, cond: nf('c3_nook_open') }),
    P('prop_toybox', 9, 22, { script: C3.nookChest }),
  ],
  npcs: [
    { id: 'lune', sprite: 'npc_lune', frames: ['npc_lune', 'npc_lune_2'], frameSpeed: 50, x: 29, y: 10, float: true, shadow: false, script: C3.luneRuines },
    {
      id: 'compteur',
      char: 'mouton',
      x: 18,
      y: 10,
      cond: alive,
      script: C3.frozen(['Le mouton qui comptait les moutons.', 'Il s\'est arrêté au milieu d\'un chiffre. Sa bouche fait encore « tr… ».']),
    },
    {
      id: 'poete',
      char: 'mouton_rose',
      x: 15,
      y: 12,
      dir: 'right',
      cond: alive,
      script: C3.frozen(['Le mouton poète. Figé, la bouche ouverte.', 'Une rime est restée coincée dedans. « Peine ». La rime était « peine ».']),
    },
    {
      id: 'peureux',
      char: 'mouton_bleu',
      x: 26,
      y: 11,
      dir: 'left',
      cond: alive,
      script: C3.frozen(['Le mouton peureux. Il regarde par-dessus son épaule.', 'Son ombre a fini par le rattraper. Elle l\'a recouvert entièrement.']),
    },
    {
      id: 'jaune',
      char: 'mouton_jaune',
      x: 24,
      y: 12,
      cond: alive,
      script: C3.frozen(['Le mouton jaune. Il sourit. Il ne cligne plus des yeux.', '« Ils sont heureux pour toujours. Pour toujours toujours. »', 'C\'est ce qu\'il disait.']),
    },
    { id: 'agneau', sprite: 'npc_agneau', x: 20, y: 17, cond: alive, script: C3.agneauFrozen },
    { id: 'chaussette', sprite: 'npc_chaussette', frames: ['npc_chaussette', 'npc_chaussette_2'], frameSpeed: 30, x: 17, y: 17, script: C3.chaussetteRuines },
    {
      id: 'chaussette_paire',
      sprite: 'npc_chaussette',
      frames: ['npc_chaussette_2', 'npc_chaussette'],
      frameSpeed: 30,
      x: 18,
      y: 17,
      cond: f('c1_chaussette_paire'),
      script: C3.chaussettePaireRuines,
    },
    { id: 'placard', sprite: 'npc_placard', x: 31, y: 12, cond: f('c1_placard_spared'), light: { r: 30, color: '#ffe991', flicker: true, dy: -18 }, script: C3.placardTalk },
    { id: 'gomme', sprite: 'npc_gomme', x: 12, y: 19, cond: f('c2_gomme_spared'), script: C3.gommeTalk },
  ],
  enemies: [
    { id: 'c3_gribouille_1', enemies: ['gribouille', 'gribouille'], x: 10, y: 9, wander: 2 },
    { id: 'c3_nuage_1', enemies: ['nuage'], x: 16, y: 23, wander: 2 },
    { id: 'c3_gribouille_2', enemies: ['gribouille', 'nuage'], x: 35, y: 12, wander: 2 },
    { id: 'c3_mouton_noir_1', enemies: ['mouton_noir'], x: 43, y: 6, wander: 2 },
  ],
  triggers: [
    { x: 12, y: 1, w: 1, h: 25, once: 'c3_village', script: C3.ruinesVillage },
    { x: 1, y: 1, w: 29, h: 25, script: C3.marshLeave },
    { x: 31, y: 1, w: 16, h: 25, script: C3.marshEnter },
    { x: 37, y: 9, w: 6, h: 2, once: 'c3_hospital_seen', script: C3.hospitalSeen },
  ],
  warps: [{ x: 39, y: 4, door: true, to: 'hopital', spawn: 'entry' }],
};

// ---------------------------------------------------------------------------
// Hôpital de Papier — lobby and the endless corridor
// ---------------------------------------------------------------------------

const HOSPITAL_LEGEND = {
  T: 'h_wall_top',
  W: 'h_wall',
  B: 'h_wall_base',
  F: 'h_floor',
  w: 'h_window',
  D: 'h_door_top',
  d: 'h_door',
  '3': 'h_door_304_top',
  '4': 'h_door_304',
  R: 'rug',
};

/** Corridor doors (x) and the matching scripts. */
const CORRIDOR_DOORS = [19, 28, 37, 46];
/** Where Mina's drawing is taped at each stage (next to the right door). */
const DRAWING_AT = [29, 20, 38, 56];

const hosp = new Grid(62, 10, 'T');
hosp
  .rect(1, 1, 12, 1, 'W')
  .rect(1, 2, 12, 1, 'B')
  .rect(1, 3, 12, 6, 'F')
  .rect(14, 1, 47, 1, 'W')
  .rect(14, 2, 47, 1, 'B')
  .rect(14, 3, 47, 4, 'F')
  .rect(13, 4, 1, 2, 'F')
  .rect(6, 9, 2, 1, 'F');
for (const x of [2, 10, 23, 32, 41, 50]) hosp.set(x, 1, 'w');
for (const x of [6, ...CORRIDOR_DOORS]) hosp.set(x, 1, 'D').set(x, 2, 'd');
hosp.set(57, 1, '3').set(57, 2, '4');

const NEON = '#dff7ec';

const HOPITAL: MapDef = {
  id: 'hopital',
  name: 'Hôpital de Papier',
  world: 'dream',
  music: 'hospital',
  ambience: 'hum',
  particles: 'dust',
  darkness: 0.38,
  playerLight: 34,
  vignette: 0.5,
  grain: 0.18,
  banner: true,
  bg: '#0b0710',
  tiles: hosp.toString(),
  legend: HOSPITAL_LEGEND,
  spawns: {
    default: { x: 6, y: 8, dir: 'up' },
    entry: { x: 6, y: 8, dir: 'up' },
    jeux: { x: 6, y: 3, dir: 'down' },
    start: { x: 15, y: 4, dir: 'right' },
    save: { x: 50, y: 4, dir: 'right' },
  },
  onEnter: C3.hospitalEnter,
  props: [
    // Neon tubes.
    ...[4, 10, 16, 22, 28, 34, 40, 46, 52, 58].map((x) => LIGHT(x, 3, 48, NEON, true, -8)),
    // Lobby.
    P('prop_h_desk', 8, 3, { w: 2, script: C3.register }),
    WALL('prop_h_drawings', 4, 2, -6, { script: C3.lobbyDrawings }),
    P('', 11, 2, { script: C3.lobbySign }),
    DECO('prop_h_plant', 1, 3, 'Une plante en papier crépon. Ses feuilles bruissent quand tu passes.'),
    DECO('prop_h_plant', 12, 3, 'Une plante. Quelqu\'un a accroché une étoile en papier à une de ses feuilles.'),
    DECO('prop_h_bench', 2, 8, ['Un banc de salle d\'attente.', 'Il est encore tiède, comme si quelqu\'un venait de se lever.'], { w: 2 }),
    DECO('prop_h_bench', 9, 8, ['Un banc. Sur l\'accoudoir, quelqu\'un a gravé au compas : « N + M ».'], { w: 2 }),
    P('prop_h_table', 1, 6, { script: C3.lobbyTray }),
    DECO('prop_h_chair', 2, 6, 'Une chaise de visiteur, tournée vers l\'entrée.'),
    DECO('prop_h_wheelchair', 11, 6, 'Un fauteuil roulant. Un petit nounours en papier est assis dedans.'),
    // Corridor (always).
    DECO('prop_h_chair', 15, 3, 'Une chaise de visiteur, tournée vers le mur. Personne ne s\'y assoit.'),
    DECO('prop_h_bench', 24, 3, ['Un banc de salle d\'attente.', 'Un magazine pour enfants y traîne. La grille de jeux est remplie, d\'une écriture ronde.'], { w: 2 }),
    DECO('prop_h_plant', 33, 3, 'Une plante. Une feuille est tombée. Puis une autre. Le couloir est très long.'),
    DECO('prop_h_iv', 49, 3, 'Un pied à perfusion, tout seul. La poche goutte dans le vide.'),
    DECO('prop_h_wheelchair', 42, 3, 'Un fauteuil roulant, garé contre le mur.', { cond: () => stage() < 2 }),
    DECO('prop_h_wheelchair', 43, 6, ['Le fauteuil roulant.', 'Tout à l\'heure, il était contre le mur. Tu en es sûr.'], { cond: () => stage() >= 2 }),
    // The doors along the corridor.
    ...CORRIDOR_DOORS.map((x, i) => P('', x, 2, { script: C3.corridorDoor(i) })),
    // Mina's drawings: they show the right door.
    ...[0, 1, 2, 3].map((s) => WALL('prop_h_drawings', DRAWING_AT[s]!, 2, -6, { cond: atStage(s), script: C3.tapedDrawing(s) })),
    WALL('prop_h_drawings@ink', 47, 2, -6, { cond: atStage(2), script: C3.inkDrawing }),
    // The last wing.
    { ...savePoint(52, 3, 'Une veilleuse de couloir, à hauteur d\'enfant. Elle reste allumée toute la nuit. Pour ceux qui ont peur du noir.'), cond: () => stage() >= 3 },
    DECO('prop_h_bench', 47, 6, ['Un banc. Une boîte de mouchoirs y est posée.', 'Dans les salles d\'attente, il y en a toujours une.'], { w: 2, cond: () => stage() >= 3 }),
  ],
  enemies: [
    { id: 'c3_perfusion_1', enemies: ['perfusion'], x: 5, y: 5, wander: 1 },
    { id: 'c3_bip_1', enemies: ['bip'], x: 34, y: 5, wander: 2, cond: atStage(0) },
    { id: 'c3_perfusion_2', enemies: ['perfusion'], x: 26, y: 5, wander: 2, cond: atStage(1) },
    { id: 'c3_duo_1', enemies: ['bip', 'perfusion'], x: 41, y: 5, wander: 2, cond: atStage(2) },
  ],
  triggers: [
    { x: 14, y: 3, w: 1, h: 4, once: 'c3_corridor', script: C3.corridorIntro },
    { x: 25, y: 3, w: 1, h: 4, once: 'c3_heard_0', cond: atStage(0), script: C3.heardNurse },
    { x: 24, y: 3, w: 1, h: 4, once: 'c3_heard_1', cond: atStage(1), script: C3.heardMaman },
    { x: 30, y: 3, w: 1, h: 4, once: 'c3_heard_2', cond: atStage(2), script: C3.heardNight },
    { x: 36, y: 3, w: 1, h: 4, once: 'c3_heard_3', cond: () => stage() >= 3, script: C3.heardMonitor },
    { x: 51, y: 3, w: 1, h: 4, cond: () => stage() < 3, script: C3.corridorLoop },
    { x: 55, y: 3, w: 1, h: 4, once: 'c3_door304', cond: () => stage() >= 3 && !G.state.flags.c3_mina_erased, script: C3.door304 },
  ],
  warps: [
    { x: 6, y: 9, w: 2, to: 'ruines', spawn: 'hopital', cond: nf('c3_mina_erased'), locked: ['Les portes de l\'hôpital ont disparu.'] },
    { x: 6, y: 2, door: true, to: 'salle_jeux', spawn: 'entry' },
    { x: 57, y: 2, door: true, to: 'chambre_304', spawn: 'door', cond: f('c3_mina_erased'), locked: ['Chambre 304.'] },
  ],
};

// ---------------------------------------------------------------------------
// Salle de jeux — the pediatric playroom
// ---------------------------------------------------------------------------

const SALLE_JEUX: MapDef = {
  id: 'salle_jeux',
  name: 'Salle de jeux',
  world: 'dream',
  music: 'mina',
  darkness: 0.2,
  playerLight: 40,
  vignette: 0.35,
  tiles: `
    TTTTTTTTTTTT
    TWwWWWWWWwWT
    TBBBBBBBBBBT
    TFFFFFFFFFFT
    TFFRRRRRRFFT
    TFFRRRRRRFFT
    TFFFFFFFFFFT
    TFFFFFFFFFFT
    TTTTTFTTTTTT
    TTTTTFTTTTTT
  `,
  legend: HOSPITAL_LEGEND,
  spawns: { default: { x: 5, y: 7, dir: 'up' }, entry: { x: 5, y: 7, dir: 'up' } },
  onEnter: C3.playroomEnter,
  props: [
    LIGHT(5, 4, 60, '#fff3cf', false, -10),
    P('prop_coat', 1, 3, { script: C3.capeHanger }),
    P('prop_tv_off', 3, 3, { w: 2, script: C3.playroomTv }),
    WALL('prop_drawings', 6, 2, -6, { text: ['Des dessins au crayon de cire.', 'Un soleil avec des lunettes. Un hôpital avec des jambes, qui s\'enfuit en courant.'] }),
    P('prop_easel', 8, 3, { script: C3.playroomEasel }),
    P('prop_toybox', 10, 3, { script: C3.playroomBox }),
    DECO('prop_h_table', 5, 5, ['Une petite table basse.', 'Des feutres sans bouchon, une pâte à modeler qui a séché en forme de mouton.']),
    DECO('prop_h_chair', 4, 5, 'Une chaise minuscule. Tu ne tiens plus dessus.'),
    DECO('prop_h_chair', 6, 5, 'Une chaise minuscule, avec une étiquette : « MINA ».'),
    DECO('prop_bookstack', 10, 6, ['Des livres d\'images.', '« Le mouton qui ne voulait pas dormir ». Tu ne l\'ouvres pas.']),
    DECO('npc_agneau', 1, 7, ['Un agneau en peluche, tout aplati.', 'On a dû beaucoup le serrer.'], { solid: false }),
  ],
  warps: [{ x: 5, y: 9, to: 'hopital', spawn: 'jeux' }],
};

// ---------------------------------------------------------------------------
// Chambre 304
// ---------------------------------------------------------------------------

const MOON = '#a7c7f0';

const CHAMBRE_304: MapDef = {
  id: 'chambre_304',
  name: 'Chambre 304',
  world: 'dream',
  music: null,
  ambience: 'rain',
  particles: 'dust',
  darkness: 0.5,
  playerLight: 40,
  vignette: 0.55,
  grain: 0.2,
  bg: '#0b0710',
  banner: true,
  tiles: `
    TTTTTTTTTTTTT
    TWWwWWWWWwWWT
    TBBBBBBBBBBBT
    TFFFFFFFFFFFT
    TFFFFFFFFFFFT
    TFFFFFFFFFFFT
    TFFFFFFFFFFFT
    TFFFFFFFFFFFT
    TTTTTTTTTTTTT
  `,
  legend: HOSPITAL_LEGEND,
  spawns: { default: { x: 6, y: 7, dir: 'up' }, door: { x: 6, y: 7, dir: 'up' } },
  onEnter: C3.room304Enter,
  props: [
    LIGHT(3, 3, 44, MOON, false, -12),
    LIGHT(9, 3, 44, MOON, false, -12),
    P('prop_h_monitor', 1, 3, { id: 'r304_monitor', text: ['Le moniteur.', 'L\'écran est éteint. Il n\'y a plus de bip.'] }),
    P('prop_h_bed', 2, 3, { id: 'r304_bed', h: 2, script: C3.room304Bed }),
    P('prop_h_table', 3, 3, { id: 'r304_table', script: C3.nightlight304 }),
    P('prop_h_nightlight', 3, 3, { id: 'r304_light', solid: false, oy: -11, script: C3.nightlight304 }),
    P('prop_h_iv', 1, 5, { id: 'r304_iv', text: 'Le pied à perfusion. La poche est vide. Il n\'y a plus rien qui goutte.' }),
    P('prop_h_chair', 4, 6, { id: 'r304_chair', script: C3.room304Chair }),
    WALL('prop_h_drawings', 6, 2, -6, { id: 'r304_draw1', script: C3.room304Drawing1 }),
    WALL('prop_calendar', 7, 2, -8, { id: 'r304_cal', script: C3.room304Calendar }),
    WALL('prop_h_drawings', 11, 2, -6, { id: 'r304_draw2', script: C3.room304Drawing2 }),
    P('', 9, 2, { script: C3.room304Window }),
    P('prop_h_plant', 11, 3, { id: 'r304_plant', text: ['Une plante en papier. Quelqu\'un l\'a arrosée.', 'Le papier a gondolé. C\'est l\'intention qui compte, aurait dit Maman.'] }),
    P('', 6, 8, { script: C3.room304Door }),
  ],
};

// ---------------------------------------------------------------------------
// Le vide
// ---------------------------------------------------------------------------

const videGrid = new Grid(34, 18, 'E').blob(16, 9, 14, 7, 'v', 3).rect(28, 7, 4, 4, 'v').path(
  [
    [19, 9],
    [30, 9],
  ],
  'O',
  1,
);

const VIDE: MapDef = {
  id: 'vide',
  name: 'Le vide',
  world: 'void',
  music: 'void',
  particles: 'stars',
  darkness: 0.3,
  playerLight: 50,
  vignette: 0.6,
  bg: '#000000',
  tiles: videGrid.toString(),
  legend: { E: 'v_edge', v: 'v_floor', O: 'v_white' },
  spawns: {
    default: { x: 8, y: 9, dir: 'right' },
    center: { x: 8, y: 9, dir: 'right' },
    door: { x: 28, y: 9, dir: 'right' },
  },
  props: [
    P('prop_dodo_giant', 14, 8, { id: 'dodo_giant', w: 3, h: 1, script: C3.dodoPlushTalk, cond: nf('c3_dawn_ready') }),
    P('prop_door_light', 30, 9, { script: C3.doorOfLight, light: { r: 70, color: '#fff3cf', flicker: true, dy: -16 } }),
  ],
  triggers: [{ x: 29, y: 8, w: 1, h: 3, cond: f('c3_dawn_ready'), script: C3.doorOfLight }],
};

export const CHAPTER3_MAPS: Record<string, MapDef> = {
  ruines: RUINES,
  hopital: HOPITAL,
  salle_jeux: SALLE_JEUX,
  chambre_304: CHAMBRE_304,
  vide: VIDE,
};

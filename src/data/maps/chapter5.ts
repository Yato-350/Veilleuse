import type { MapDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { f, nf, savePoint } from '../../game/story/common';
import * as C5 from '../../game/story/chapter5';
import { Grid } from './build';

/*
 * Chapter 5 — « La Marée Blanche » (docs/HISTOIRE.md § 3.13). Too bright at first, sterile at the end:
 *   plage          the beach of the summer before, overexposed (world `dream`): no shadow, a sun pinned to the sky,
 *                  Mina of before building her castle, forty-one shells and a hidden forty-second, the towel. Then
 *                  the white tide (the sea freezes, C5.freezeBeach re-tiles it) and the Thermomètre's portal.
 *   sas            the airlock (world `blanc`): a chain of rooms where the next door only opens once the one behind
 *                  is closed. The long way (« J'ai de la fièvre ») goes through the waiting room, the changing room
 *                  and the sinks first; the short way (« Oui ») starts at the first door, the rest is white.
 *   lac_blanc      the frozen lake inside the hospital: snow that hurts, the red thread as a safe path, the five
 *                  drawings to correct along the shore, the parents' room (a hut of tarps, its inside far to the
 *                  right of the map, alone in the white), the glass box in the middle.
 *   chambre_verre  room 304 as a glass box, « Semaine 5 »: the visit, then La Vitre, then the fall.
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
/** Hung on a wall-base row: lifted a little, never solid. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** An invisible interactable. */
const SPOT = (x: number, y: number, script: PropDef['script'], o: Partial<PropDef> = {}): PropDef => P('', x, y, { solid: false, script, ...o });
/** Flat on the ground (drawn under everything, walkable). */
const FLAT = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, under: true, ...o });

const before = nf('c5_maree');
const after = f('c5_maree');
const both = (a: () => boolean, b: () => boolean) => (): boolean => a() && b();
const castleAt = (stage: number) => (): boolean => !G.state.flags.c5_maree && C5.castleStage() === stage;

// ---------------------------------------------------------------------------------------------------------------------
// plage — the beach of before
// ---------------------------------------------------------------------------------------------------------------------

/** 46×32: dunes and a chestnut fence at the top, rocks on both sides, the sea from row 19, haze at the bottom. */
function beachTiles(): string {
  const g = new Grid(46, 32, '.');
  g.rect(0, 0, 46, 2, 'D').rect(0, 2, 46, 1, 'F');
  g.rect(20, 0, 3, 4, '=');
  g.rect(0, 2, 3, 18, 'R').rect(43, 2, 3, 18, 'R');
  g.rect(3, 3, 1, 3, 'R').rect(42, 3, 1, 2, 'R').rect(3, 12, 1, 2, 'R');
  g.rect(3, 17, 40, 2, ',');
  g.rect(0, 19, 46, 1, '~');
  g.rect(0, 20, 46, 10, 'w');
  g.rect(0, 30, 46, 2, 'H');
  // A rock groyne running into the sea, and rocks on the right by the water.
  g.rect(8, 17, 2, 7, 'R').rect(38, 16, 3, 3, 'R').rect(41, 15, 2, 4, 'R');
  return g.toString();
}

const BEACH_LEGEND: Record<string, string> = {
  D: 'c5_dune',
  F: 'c5_ganivelle',
  '=': 'c5_planches',
  '.': 'c5_sable',
  ',': 'c5_sable_mouille',
  '~': 'c5_ecume',
  w: 'c5_mer',
  R: 'c5_rocher',
  H: 'c5_brume',
};

const PLAGE: MapDef = {
  id: 'plage',
  name: 'La Plage d\'avant',
  world: 'dream',
  music: 'plage',
  ambience: 'wind',
  particles: 'none',
  vignette: 0,
  grain: 0,
  banner: true,
  tiles: beachTiles(),
  legend: BEACH_LEGEND,
  spawns: {
    default: { x: 22, y: 10, dir: 'down' },
    debut: { x: 22, y: 10, dir: 'down' },
    glace: { x: 15, y: 13, dir: 'down' },
    portail: { x: 22, y: 16, dir: 'down' },
  },
  onEnter: C5.beachEnter,
  props: [
    // --- The family's spot: parasol (save point), Maman's deck chair, the cooler, the towel.
    P('prop_c5_parasol', 7, 8, { w: 2, frames: ['prop_c5_parasol', 'prop_c5_parasol', 'prop_c5_parasol_2'], frameSpeed: 40, light: { r: 30, color: '#ffe991', flicker: true, dy: -14 }, script: C5.parasol }),
    P('prop_c5_transat', 10, 7, { h: 2, script: C5.deckChair }),
    P('prop_c5_creme', 11, 9, { solid: false, script: C5.sunscreen }),
    P('prop_c5_glaciere', 6, 10, { script: C5.cooler }),
    P('prop_c5_tongs', 12, 10, { solid: false, under: true, script: C5.flipflops }),
    FLAT('prop_c5_serviette', 13, 11, { w: 2, id: 'serviette', cond: nf('c5_drap'), script: C5.towel }),
    FLAT('prop_c5_drap', 13, 11, { w: 2, id: 'drap', cond: f('c5_drap'), script: C5.sheet }),
    // --- Footprints from the towel: big ones to the castle, small ones that stop in the middle of the beach.
    FLAT('prop_c5_traces_p', 16, 11, { cond: before, script: C5.smallSteps }),
    FLAT('prop_c5_traces_p', 18, 11, { cond: before, script: C5.smallSteps }),
    FLAT('prop_c5_traces_fin', 20, 11, { cond: before, oy: -4, script: C5.stepsEnd }),
    FLAT('prop_c5_traces_g', 16, 12, { cond: before, script: C5.bigSteps }),
    FLAT('prop_c5_traces_g', 19, 12, { cond: before, script: C5.bigSteps }),
    FLAT('prop_c5_traces_g', 22, 13, { cond: before, script: C5.bigSteps }),
    P('prop_c5_eclat', 20, 11, { id: 'coquillage42', solid: false, frames: ['prop_c5_eclat_2', 'prop_c5_eclat_2', 'prop_c5_eclat_2', 'prop_c5_eclat', 'prop_c5_eclat_2'], frameSpeed: 50, oy: -6, cond: nf('c5_coquillage42'), script: C5.shell42 }),
    // --- Mina of before and her castle.
    P('prop_c5_chateau_1', 25, 14, { w: 2, cond: castleAt(1), script: C5.castle }),
    P('prop_c5_chateau_2', 25, 14, { w: 2, cond: castleAt(2), script: C5.castle }),
    P('prop_c5_chateau_3', 25, 14, { w: 2, cond: castleAt(3), script: C5.castle }),
    FLAT('prop_c5_maree_rond', 25, 14, { w: 2, cond: after, script: C5.castleGone }),
    P('prop_c5_seau', 27, 13, { cond: before, script: C5.bucket }),
    // --- The rest of the beach.
    P('prop_c5_ballon', 33, 6, { solid: false, script: C5.ball }),
    FLAT('prop_c5_ecrit', 28, 10, { w: 4, cond: before, script: C5.sandWriting }),
    FLAT('prop_c5_maree_ecrit', 28, 10, { w: 4, cond: after, script: C5.sandWritingGone }),
    P('prop_c5_famille', 33, 9, { w: 3, script: C5.erasedFamily }),
    P('prop_c5_efface', 39, 12, { w: 2, script: C5.erasedOne }),
    P('prop_c5_poste', 39, 5, { w: 2, script: C5.lifeguard }),
    P('prop_c5_panneau', 18, 5, { script: C5.sign }),
    P('prop_c5_kiosque', 25, 4, { w: 3, script: C5.kiosk }),
    P('prop_c5_flaque', 3, 14, { w: 2, frames: ['prop_c5_flaque', 'prop_c5_flaque_2'], frameSpeed: 36, script: C5.tidePool }),
    SPOT(21, 1, C5.boardwalk, { w: 1, h: 2 }),
    SPOT(10, 2, C5.fence, { w: 4 }),
    SPOT(1, 9, C5.rocks, { h: 3 }),
    SPOT(44, 9, C5.rocks, { h: 3 }),
    SPOT(22, 19, C5.seaLook, { id: 'mer', w: 6, cond: before }),
    SPOT(14, 19, C5.seaLook, { w: 6, cond: before }),
    SPOT(30, 19, C5.seaLook, { w: 6, cond: before }),
    // --- After the tide: the frozen sea, the crown under the ice, the portal.
    FLAT('prop_c5_couronne_glace', 13, 23, { cond: after, script: C5.crownUnderIce }),
    P('prop_c5_fil_noeud', 15, 12, { solid: false, cond: after, oy: 2, script: C5.threadKnot }),
    P('prop_c5_portail', 21, 26, { id: 'portail', w: 3, cond: both(after, nf('c5_portail')), frames: ['prop_c5_portail', 'prop_c5_portail', 'prop_c5_portail_2'], frameSpeed: 30, script: C5.portal }),
    P('prop_c5_portail_ok', 21, 26, { w: 3, cond: both(after, f('c5_menti')), script: C5.portalAgain }),
    P('prop_c5_portail_fievre', 21, 26, { w: 3, cond: both(after, f('c5_fievre')), script: C5.portalAgain }),
    // --- Shells (before the tide).
    ...C5.SHELL_CLUSTERS.map(([x, y, , v], i) =>
      P(`prop_c5_coquillages_${v}`, x, y, { id: `coquillages_${i}`, solid: false, oy: -2, cond: both(before, nf(`c5_coq_${i}`)), script: C5.shells(i) }),
    ),
  ],
  npcs: [
    { id: 'mina_avant', sprite: 'npc_mina_avant_1', frames: ['npc_mina_avant_1', 'npc_mina_avant_2'], frameSpeed: 22, x: 25, y: 13, shadow: false, cond: both(before, nf('c5_sieste')), script: C5.minaAvant },
    { id: 'chaussette', sprite: 'npc_chaussette', frames: ['npc_chaussette', 'npc_chaussette_2'], frameSpeed: 30, x: 28, y: 5, shadow: false, cond: before, script: C5.chaussette },
    { id: 'dodo', sprite: 'npc_c5_dodo', frames: ['npc_c5_dodo', 'npc_c5_dodo_2'], frameSpeed: 28, x: 9, y: 12, float: true, shadow: false, solid: false, cond: f('c5_intro'), script: C5.dodoTalk },
  ],
  enemies: [
    { id: 'c5_crabe_1', enemies: ['crabe_bracelet'], x: 6, y: 14, wander: 2, cond: before },
    { id: 'c5_mouette_1', enemies: ['mouette'], x: 32, y: 12, wander: 3, cond: before },
    { id: 'c5_mouette_2', enemies: ['mouette'], x: 14, y: 7, wander: 3, cond: before },
    { id: 'c5_plage_duo', enemies: ['crabe_bracelet', 'mouette'], x: 36, y: 17, wander: 1, cond: before },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------
// sas — the airlock: a chain of rooms, the next door opens only when the one behind is closed
// ---------------------------------------------------------------------------------------------------------------------

/** x of the partitions; airlock doors at DOOR_X (D1…D5). The gap of every partition is at rows 6–7. */
const PARTS = [0, 13, 22, 30, 38, 46, 56, 65];

function sasTiles(): string {
  const g = new Grid(66, 11, 'T');
  // Back wall: tarps (row 1) and their hem (row 2); floor rows 3–8; bottom wall row 9; void row 10.
  g.rect(1, 1, 64, 1, 'B').rect(1, 2, 64, 1, 'b').rect(1, 3, 64, 6, '.').rect(0, 9, 66, 1, 'T').rect(0, 10, 66, 1, 'V');
  for (const x of PARTS) g.rect(x, 0, 1, 9, 'T');
  // Gaps (doorways) in the partitions.
  for (const x of PARTS.slice(1, -1)) g.rect(x, 6, 1, 2, '.');
  g.rect(65, 6, 1, 2, '.');
  // Something stands behind the tarps here and there.
  g.set(5, 1, 'O').set(5, 2, 'o').set(50, 1, 'O').set(50, 2, 'o');
  // Frost creeping in from the lake (S4).
  g.rect(57, 3, 8, 6, '*', '.').rect(56, 6, 1, 2, '*');
  g.set(57, 3, '.').set(57, 4, '.').set(58, 3, '.');
  return g.toString();
}

const SAS_LEGEND: Record<string, string> = {
  T: 'c5_mur_top',
  B: 'c5_bache',
  b: 'c5_bache_base',
  O: 'c5_bache_ombre',
  o: 'c5_bache_ombre_base',
  '.': 'c5_sol',
  '*': 'c5_givre',
  V: 'c5_brume',
};

/** The long way only (« J'ai de la fièvre »): props of the waiting room, the changing room, the sinks. */
const L = (p: PropDef): PropDef => ({ ...p, cond: p.cond ? both(nf('c5_menti'), p.cond) : nf('c5_menti') });

const SAS: MapDef = {
  id: 'sas',
  name: 'Le Sas',
  world: 'blanc',
  music: 'sas',
  ambience: 'hum',
  vignette: 0.15,
  banner: true,
  tiles: sasTiles(),
  legend: SAS_LEGEND,
  spawns: {
    default: { x: 2, y: 7, dir: 'right' },
    long: { x: 2, y: 7, dir: 'right' },
    court: { x: 31, y: 7, dir: 'right' },
    fin: { x: 63, y: 7, dir: 'right' },
  },
  onEnter: C5.sasEnter,
  props: [
    // --- L1, the waiting room (long way).
    L(P('prop_c5_porte_morte', 0, 6, { h: 2, script: C5.portalDoor })),
    L(WALL('prop_c5_guichet', 3, 2, -6, { w: 2, script: C5.reception })),
    L(WALL('prop_c5_avis', 7, 2, -4, { w: 2, script: C5.notice })),
    L(P('prop_c5_chaises', 2, 4, { w: 3, script: C5.waitingChairs })),
    L(P('prop_c5_chaises', 8, 4, { w: 3, script: C5.waitingChairs })),
    L(P('prop_c5_aquarium', 11, 3, { w: 2, script: C5.aquarium })),
    L(P('prop_c5_jouets', 2, 8, { w: 1, script: C5.toybox })),
    L(P('prop_c5_fontaine', 10, 8, { script: C5.fountain })),
    L(P('prop_tv', 6, 8, { w: 2, frames: ['prop_tv', 'prop_tv_2'], frameSpeed: 6, script: C5.waitingTv })),
    L(SPOT(13, 6, C5.thermoBlock, { id: 'thermo_barriere', h: 2, solid: true, cond: nf('c5_thermo_fait') })),
    // --- L2, the changing room.
    L(WALL('prop_c5_blouses', 15, 2, -2, { w: 2, script: C5.gowns })),
    L(WALL('prop_c5_miroir', 18, 2, -4, { script: C5.mirror })),
    L(P('prop_c5_banc', 15, 8, { w: 2, script: C5.bench })),
    L(P('prop_c5_masques', 20, 4, { script: C5.masks })),
    L(WALL('prop_c5_affiche_sourire', 20, 2, -4, { script: C5.smilePoster })),
    // --- L3, the sinks.
    L(P('prop_c5_lavabo', 24, 3, { script: C5.sink })),
    L(P('prop_c5_lavabo', 26, 3, { script: C5.sink })),
    L(WALL('prop_c5_gel_mural', 28, 2, -4, { script: C5.sanitizer })),
    L(WALL('prop_c5_avis', 24, 2, -14, { w: 2, script: C5.handNotice })),
    L(P('prop_c5_poubelle', 29, 4, { script: C5.bin })),
    // --- The short way: behind the first door there is nothing, only white.
    SPOT(29, 6, C5.whiteBehind, { h: 2, solid: true, cond: f('c5_menti') }),
    // --- S1.
    WALL('prop_c5_avis', 33, 2, -4, { w: 2, script: C5.notice }),
    WALL('prop_c5_interphone', 31, 2, -2, { script: C5.intercom }),
    WALL('prop_c5_gel_mural', 36, 2, -4, { script: C5.sanitizer }),
    P('prop_c5_masques', 37, 4, { script: C5.masks }),
    P('prop_c5_poubelle', 31, 4, { script: C5.bin }),
    // --- S2.
    P('prop_c5_chariot', 40, 4, { w: 2, script: C5.sheetTrolley }),
    WALL('prop_c5_thermo_mural', 44, 2, -4, { script: C5.wallThermo }),
    WALL('prop_c5_affiche_sourire', 42, 2, -4, { script: C5.smilePoster }),
    // --- S3: the save point, the radiator, the crêpe poster.
    savePoint(51, 4, 'Une petite lumière, dans tout ce blanc. Elle ne fait pas de bruit.'),
    WALL('prop_c5_radiateur', 48, 2, -2, { script: C5.radiator }),
    WALL('prop_c5_affiche_crepe', 54, 2, -4, { script: C5.crepePoster }),
    P('prop_c5_banc', 48, 8, { w: 2, script: C5.bench }),
    // --- S4: frost.
    WALL('prop_c5_avis', 59, 2, -4, { w: 2, script: C5.lakeNotice }),
    P('prop_c5_chariot', 62, 4, { w: 2, script: C5.frozenTrolley }),
    // --- The airlock doors (sprite and collision are set by C5.syncDoors from the flags).
    ...C5.DOOR_X.map((x, i) => P('prop_c5_porte_rouge', x, 6, { id: `porte_${i + 1}`, h: 2, script: C5.airlockDoor(i + 1) })),
  ],
  npcs: [
    { id: 'thermometre', sprite: 'ow_thermometre', frames: ['ow_thermometre', 'ow_thermometre_2'], frameSpeed: 20, x: 12, y: 6, shadow: false, cond: both(nf('c5_menti'), nf('c5_thermo_fait')), script: C5.thermoBlock },
    { id: 'dodo', sprite: 'npc_c5_dodo', frames: ['npc_c5_dodo', 'npc_c5_dodo_2'], frameSpeed: 28, x: 33, y: 5, float: true, shadow: false, solid: false, cond: nf('c5_sas_dodo'), script: C5.dodoTalk },
  ],
  enemies: [
    { id: 'c5_gel_1', enemies: ['gel'], x: 26, y: 6, wander: 1, cond: nf('c5_menti') },
    { id: 'c5_gel_2', enemies: ['gel'], x: 34, y: 7, wander: 1 },
    { id: 'c5_masque_1', enemies: ['masque'], x: 42, y: 6, wander: 1 },
    { id: 'c5_masque_2', enemies: ['masque'], x: 60, y: 5, wander: 1 },
  ],
  triggers: [
    { x: 31, y: 3, w: 2, h: 6, script: C5.s1Enter, once: 'c5_s1' },
    { x: 39, y: 3, w: 2, h: 6, script: C5.s2Enter, once: 'c5_s2' },
    { x: 47, y: 3, w: 2, h: 6, script: C5.s3Enter, once: 'c5_s3' },
    { x: 57, y: 3, w: 2, h: 6, script: C5.s4Enter, once: 'c5_s4' },
    { x: 14, y: 3, w: 1, h: 6, script: C5.l2Enter, once: 'c5_l2' },
    { x: 23, y: 3, w: 1, h: 6, script: C5.l3Enter, once: 'c5_l3' },
  ],
  warps: [{ x: 65, y: 6, w: 1, h: 2, to: 'lac_blanc', spawn: 'sas', cond: C5.lakeDoorOpen }],
};

// ---------------------------------------------------------------------------------------------------------------------
// lac_blanc — the frozen lake inside the hospital
// ---------------------------------------------------------------------------------------------------------------------

/** The red thread across the lake (tile positions, in order): from the airlock door to the glass box, a branch to the hut. */
const THREAD_MAIN: Array<[number, number]> = [
  [0, 17],
  [6, 17],
  [6, 22],
  [14, 22],
  [14, 26],
  [24, 26],
  [24, 21],
];
const THREAD_HUT: Array<[number, number]> = [
  [14, 22],
  [14, 14],
  [30, 14],
  [30, 12],
  [38, 12],
  [38, 11],
];

/** Lays a polyline of thread tiles on a grid, choosing straight pieces and corners from the neighbours. */
function layThread(g: Grid, paths: Array<Array<[number, number]>>, onFloor: (x: number, y: number) => boolean): void {
  const cells = new Set<string>();
  for (const pts of paths)
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!;
      const [x1, y1] = pts[i + 1]!;
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      let x = x0;
      let y = y0;
      for (;;) {
        cells.add(`${x},${y}`);
        if (x === x1 && y === y1) break;
        x += dx;
        y += dy;
      }
    }
  const has = (x: number, y: number): boolean => cells.has(`${x},${y}`);
  for (const c of cells) {
    const [x, y] = c.split(',').map(Number) as [number, number];
    const n = has(x, y - 1);
    const s = has(x, y + 1);
    const w = has(x - 1, y) || x === 0;
    const e = has(x + 1, y);
    const count = +n + +s + +w + +e;
    let k = 'h';
    if (count >= 3) k = 'x';
    else if (n && s) k = 'v';
    else if (w && e) k = 'h';
    else if (n && e) k = 'ne';
    else if (n && w) k = 'nw';
    else if (s && e) k = 'se';
    else if (s && w) k = 'sw';
    else if (n || s) k = 'v';
    const floor = onFloor(x, y);
    g.set(x, y, THREAD_CHARS[`${floor ? 'sol' : 'glace'}_${k}`]!);
  }
}
const THREAD_CHARS: Record<string, string> = {
  glace_h: '1',
  glace_v: '2',
  glace_ne: '3',
  glace_nw: '4',
  glace_se: '5',
  glace_sw: '6',
  glace_x: '7',
  sol_h: '!',
  sol_v: '?',
  sol_ne: '(',
  sol_nw: ')',
  sol_se: '[',
  sol_sw: ']',
  sol_x: '+',
};

/**
 * 72×36. The lake: back wall (tarps, the drawings) rows 0–2, a strip of floor along it rows 3–4, the shore row 5,
 * ice rows 6–30 with snow fields, the glass box at x 20–29 rows 15–21 (door at 24–25), the hut at x 36–39 rows 9–11.
 * Left: the airlock door at rows 16–17. Far right, alone in the white: the inside of the parents' room (x 60–70).
 */
function lakeTiles(): string {
  const g = new Grid(72, 36, 'V');
  // Lake hall.
  g.rect(0, 0, 50, 1, 'T').rect(1, 1, 48, 1, 'B').rect(1, 2, 48, 1, 'b').rect(1, 3, 48, 2, '.').rect(1, 5, 48, 1, 'r');
  g.rect(1, 6, 48, 27, 'i').rect(1, 33, 48, 1, '.').rect(0, 34, 50, 1, 'T');
  g.rect(0, 0, 1, 35, 'T').rect(49, 0, 1, 35, 'T');
  g.rect(0, 16, 1, 2, '.').rect(1, 15, 3, 4, '.');
  g.set(28, 1, 'O').set(28, 2, 'o').set(43, 1, 'O').set(43, 2, 'o');
  // Snow fields: a band under the drawings, the middle of the lake, around the hut.
  g.blob(18, 8, 16, 3, 's', 3, 'i');
  g.blob(9, 11, 6, 3, 's', 5, 'i');
  g.blob(30, 19, 7, 5, 's', 7, 'i');
  g.blob(10, 28, 7, 3, 's', 9, 'i');
  g.blob(38, 25, 8, 5, 's', 11, 'i');
  g.blob(42, 10, 5, 4, 's', 13, 'i');
  g.blob(22, 30, 9, 2, 's', 15, 'i');
  // The glass box (a fogged block of glass) and its front.
  g.rect(20, 15, 10, 1, 'G').rect(20, 16, 10, 4, 'v').rect(20, 20, 10, 1, 'u');
  g.rect(19, 21, 12, 1, 'i');
  // The thread: drawn last, over ice and snow.
  // The hut stands on the ice (its prop covers x 36–39, row 10).
  g.rect(35, 7, 6, 5, 'i');
  layThread(g, [THREAD_MAIN, THREAD_HUT], (x, y) => y < 6 || y > 32 || x < 4);
  // --- The inside of the parents' room, far away (x 60–70, rows 22–31).
  g.rect(60, 22, 11, 1, 'T').rect(61, 23, 9, 1, 'B').rect(61, 24, 9, 1, 'b').rect(61, 25, 9, 6, 'l').rect(60, 31, 11, 1, 'T');
  g.rect(60, 22, 1, 10, 'T').rect(70, 22, 1, 10, 'T');
  g.rect(65, 31, 1, 1, 'l');
  return g.toString();
}

const LAKE_LEGEND: Record<string, string> = {
  T: 'c5_mur_top',
  B: 'c5_bache',
  b: 'c5_bache_base',
  O: 'c5_bache_ombre',
  o: 'c5_bache_ombre_base',
  '.': 'c5_sol',
  r: 'c5_rive',
  i: 'c5_glace',
  s: 'c5_neige',
  G: 'c5_verre_top',
  v: 'c5_vitre',
  u: 'c5_vitre_base',
  l: 'c5_lino',
  V: 'c5_brume',
  1: 'c5_fil_h',
  2: 'c5_fil_v',
  3: 'c5_fil_ne',
  4: 'c5_fil_nw',
  5: 'c5_fil_se',
  6: 'c5_fil_sw',
  7: 'c5_fil_x',
  '!': 'c5_filsol_h',
  '?': 'c5_filsol_v',
  '(': 'c5_filsol_ne',
  ')': 'c5_filsol_nw',
  '[': 'c5_filsol_se',
  ']': 'c5_filsol_sw',
  '+': 'c5_filsol_x',
};

const LAC_BLANC: MapDef = {
  id: 'lac_blanc',
  name: 'Le Lac Blanc',
  world: 'blanc',
  music: null,
  ambience: 'wind',
  particles: 'snow',
  vignette: 0.12,
  banner: true,
  tiles: lakeTiles(),
  legend: LAKE_LEGEND,
  spawns: {
    default: { x: 2, y: 17, dir: 'right' },
    sas: { x: 2, y: 17, dir: 'right' },
    rive: { x: 17, y: 4, dir: 'up' },
    cabane: { x: 38, y: 12, dir: 'down' },
    cabane_dedans: { x: 65, y: 30, dir: 'up' },
    boite: { x: 24, y: 22, dir: 'down' },
  },
  onEnter: C5.lakeEnter,
  props: [
    // --- The five drawings along the shore, taped on the tarps.
    ...C5.DRAWINGS.flatMap(([x, id]) => [
      WALL(`prop_c5_dessin_${id}`, x, 2, -2, { id: `dessin_${id}`, cond: nf(`c5_corrige_${id}`), script: C5.drawing(id) }),
      WALL(`prop_c5_dessin_${id}_corrige`, x, 2, -2, { cond: f(`c5_corrige_${id}`), script: C5.drawing(id) }),
    ]),
    savePoint(3, 19, 'Une petite lumière, posée au bord du lac. La glace ne la reflète pas.'),
    P('prop_c5_banc', 2, 4, { w: 2, script: C5.lakeBench }),
    P('prop_c5_panneau', 4, 15, { script: C5.lakeSign }),
    // --- On the ice.
    P('prop_c5_cabane', 36, 10, { w: 4, id: 'cabane', script: C5.hutDoor }),
    P('prop_c5_porte_verre', 24, 20, { w: 2, id: 'porte_verre', script: C5.glassDoor }),
    WALL('prop_c5_semaine', 22, 19, -6, { script: C5.weekSheet }),
    WALL('prop_c5_plaque_304', 27, 19, -6, { script: C5.plate304 }),
    P('prop_c5_perfusions', 9, 25, { w: 2, script: C5.frozenDrips }),
    P('prop_c5_perfusions', 41, 17, { w: 2, script: C5.frozenDrips }),
    P('prop_c5_fauteuil_roulant', 33, 28, { script: C5.wheelchair }),
    P('prop_c5_bonhomme', 12, 9, { script: C5.snowman }),
    FLAT('prop_c5_bottes', 30, 21, { w: 2, script: C5.bootPrints }),
    P('prop_c5_trou', 44, 30, { w: 2, script: C5.iceHole }),
    FLAT('prop_c5_couronne_glace', 17, 28, { script: C5.crownUnderIce }),
    // --- The inside of the parents' room.
    P('prop_c5_fauteuil', 62, 26, { id: 'fauteuil', script: C5.armchair }),
    P('prop_c5_distributeur', 68, 26, { script: C5.vending }),
    P('prop_c5_cafe', 64, 26, { script: C5.coffee }),
    P('prop_c5_gobelets', 66, 26, { w: 1, script: C5.cups }),
    WALL('prop_c5_grille', 62, 24, -6, { id: 'grille', script: C5.vent }),
    WALL('prop_c5_affiche_planning', 66, 24, -6, { script: C5.visitPlanning }),
    WALL('prop_c5_tel_mural', 69, 24, -2, { script: C5.familyPhone }),
    P('prop_c5_manteau', 61, 29, { id: 'manteau', script: C5.coat }),
    SPOT(0, 16, C5.lakeBackDoor, { h: 2, solid: true }),
  ],
  npcs: [{ id: 'dodo', sprite: 'npc_c5_dodo', frames: ['npc_c5_dodo', 'npc_c5_dodo_2'], frameSpeed: 28, x: 18, y: 4, float: true, shadow: false, solid: false, script: C5.dodoCrayon }],
  enemies: [
    { id: 'c5_noire_1', enemies: ['gribouille_noire'], x: 42, y: 29, wander: 2 },
    { id: 'c5_noire_2', enemies: ['gribouille_noire'], x: 8, y: 30, wander: 2 },
    { id: 'c5_thermo_lac', enemies: ['thermometre'], x: 33, y: 7, wander: 2 },
    { id: 'c5_gel_lac', enemies: ['gel'], x: 20, y: 11, wander: 2 },
  ],
  triggers: [
    { x: 4, y: 3, w: 30, h: 2, script: C5.shoreEnter, once: 'c5_rive' },
    { x: 1, y: 15, w: 3, h: 4, script: C5.lakeFirst, once: 'c5_lac' },
    { x: 65, y: 31, script: C5.hutLeave },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------
// chambre_verre — room 304 as a glass box, « Semaine 5 »
// ---------------------------------------------------------------------------------------------------------------------

/**
 * 24×18. The room (rows 3–9) behind its glass wall, the Vitre (rows 10–11, door at 11–12), the antechamber below
 * (rows 12–15), the way out at the bottom (11–12, row 16).
 */
function glassRoomTiles(): string {
  const g = new Grid(24, 18, 'V');
  g.rect(0, 0, 24, 1, 'G').rect(1, 1, 22, 1, 'v').rect(1, 2, 22, 1, 'u').rect(1, 3, 22, 7, 'l');
  g.rect(0, 0, 1, 17, 'G').rect(23, 0, 1, 17, 'G');
  g.rect(1, 10, 22, 1, 'v').rect(1, 11, 22, 1, 'u').rect(11, 10, 2, 2, 'l');
  g.rect(1, 12, 22, 4, '.').rect(0, 16, 24, 1, 'G').rect(11, 16, 2, 1, '.');
  return g.toString();
}

const GLASS_LEGEND: Record<string, string> = {
  G: 'c5_verre_top',
  v: 'c5_vitre',
  u: 'c5_vitre_base',
  l: 'c5_lino',
  '.': 'c5_sol',
  V: 'c5_brume',
};

const CHAMBRE_VERRE: MapDef = {
  id: 'chambre_verre',
  name: 'La Chambre de Verre',
  world: 'blanc',
  music: null,
  ambience: 'hum',
  vignette: 0.2,
  banner: true,
  tiles: glassRoomTiles(),
  legend: GLASS_LEGEND,
  spawns: {
    default: { x: 11, y: 15, dir: 'up' },
    entree: { x: 11, y: 15, dir: 'up' },
    dedans: { x: 11, y: 8, dir: 'up' },
    vitre: { x: 11, y: 13, dir: 'up' },
  },
  onEnter: C5.glassRoomEnter,
  props: [
    // --- The room (« Semaine 5 »).
    P('prop_c5_lit', 3, 3, { h: 2, id: 'lit', script: C5.glassBed }),
    P('prop_c5_perfusion', 5, 3, { script: C5.drip }),
    P('prop_c5_dodo_oreiller', 3, 3, { solid: false, over: true, oy: -20, id: 'dodo_lit', cond: nf('c5_visite'), script: C5.dodoOnPillow }),
    P('prop_c5_table_dessin', 11, 6, { w: 2, id: 'table', cond: nf('c5_visite'), script: C5.drawTable }),
    P('prop_tv', 19, 3, { w: 2, script: C5.glassTv }),
    P('prop_nightstand', 6, 4, { script: C5.nightstand }),
    WALL('prop_c5_dessins_vitre', 15, 2, -2, { w: 3, script: C5.drawingsOnGlass }),
    // --- The Vitre.
    P('prop_c5_porte_verre_ouverte', 11, 10, { w: 2, h: 2, id: 'porte_vitre', script: C5.vitreDoor }),
    WALL('prop_c5_semaine', 9, 11, -6, { id: 'semaine', script: C5.weekSheet }),
    // --- The antechamber.
    P('prop_c5_lavabo', 2, 12, { script: C5.sink }),
    WALL('prop_c5_blouses', 4, 11, -2, { w: 2, script: C5.gowns }),
    P('prop_c5_masques', 7, 12, { script: C5.masks }),
    WALL('prop_c5_avis', 16, 11, -4, { w: 2, script: C5.notice }),
    P('prop_c5_banc', 18, 14, { w: 2, script: C5.antechamberBench }),
    WALL('prop_c5_gel_mural', 20, 11, -4, { script: C5.sanitizer }),
  ],
  npcs: [{ id: 'silhouette', sprite: 'npc_c5_silhouette', frames: ['npc_c5_silhouette', 'npc_c5_silhouette_2'], frameSpeed: 40, x: 13, y: 6, shadow: false, cond: nf('c5_visite'), script: C5.silhouetteTalk }],
  triggers: [{ x: 1, y: 12, w: 22, h: 1, script: C5.vitreApproach, cond: both(f('c5_visite'), nf('c5_vitre_fait')) }],
  warps: [{ x: 11, y: 16, w: 2, h: 1, to: 'lac_blanc', spawn: 'boite', cond: nf('c5_visite') }],
};

export const CHAPTER5_MAPS: Record<string, MapDef> = {
  plage: PLAGE,
  sas: SAS,
  lac_blanc: LAC_BLANC,
  chambre_verre: CHAMBRE_VERRE,
};

import type { MapDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { f, nf } from '../../game/story/common';
import * as B from '../../game/story/bonus';
import { Grid } from './build';

/*
 * Bonus chapter « Les rêves des autres » — Maman's dream (see src/game/story/bonus.ts):
 *   b_service (the night corridor of the care home, looping) → b_appart (home, real-world look) → b_hopital (the
 *   paper hospital behind Mina's door) → b_304 (the parents' armchair, boss Le Réveil).
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const DECO = (sprite: string, x: number, y: number, text?: string | string[], o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { text, ...o });
/** A decoration hung on the wall-base row. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** An invisible light source (neon, moonlight). */
const LIGHT = (x: number, y: number, r: number, color: string, flicker = true, dy = -6): PropDef => P('', x, y, { solid: false, light: { r, color, flicker, dy } });

const NEON = '#dff7ec';
const MOON = '#a7c7f0';
const CALL_RED = '#ff4a5a';

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
  // Home doors, out of place in the paper corridors.
  E: 'r_door_top',
  e: 'r_door',
  M: 'r_door_mina_top',
  m: 'r_door_mina',
};

const REAL_LEGEND = {
  T: 'r_wall_top',
  W: 'r_wall',
  B: 'r_wall_base',
  F: 'r_floor',
  C: 'r_carpet',
  K: 'r_tile',
  w: 'r_window',
  D: 'r_door_top',
  d: 'r_door',
  M: 'r_door_mina_top',
  m: 'r_door_mina',
};

// ---------------------------------------------------------------------------
// Les Glycines — the night corridor of the care home
// ---------------------------------------------------------------------------

/** Room doors of the corridor (x) and their room numbers. */
const ROOM_DOORS: Array<[number, number]> = [
  [14, 10],
  [19, 12],
  [28, 14],
  [33, 16],
];
const DOOR_304 = 38;
const HOME_DOOR = 43;

const svc = new Grid(46, 9, 'T');
svc
  .rect(1, 1, 9, 1, 'W')
  .rect(1, 2, 9, 1, 'B')
  .rect(1, 3, 9, 5, 'F')
  .rect(11, 1, 34, 1, 'W')
  .rect(11, 2, 34, 1, 'B')
  .rect(11, 3, 34, 5, 'F')
  .rect(10, 4, 1, 2, 'F');
svc.set(4, 1, 'w').set(24, 1, 'w');
for (const [x] of ROOM_DOORS) svc.set(x, 1, 'D').set(x, 2, 'd');
svc.set(DOOR_304, 1, '3').set(DOOR_304, 2, '4').set(HOME_DOOR, 1, 'E').set(HOME_DOOR, 2, 'e');

/** Red call light above a door (blinking until Maman sits down; the one of 304 never goes out). */
const callLight = (x: number): PropDef =>
  P('prop_appel_on', x, 1, {
    id: `appel_${x}`,
    solid: false,
    oy: -11,
    frames: ['prop_appel_on', 'prop_appel'],
    frameSpeed: 22 + (x % 5) * 3,
    light: { r: 16, color: CALL_RED, flicker: true, dy: -10 },
    cond: x === DOOR_304 ? undefined : nf('b_sat'),
  });

const SERVICE: MapDef = {
  id: 'b_service',
  name: 'Les Glycines — service de nuit',
  world: 'dream',
  music: 'garde',
  ambience: 'hum',
  particles: 'dust',
  darkness: 0.32,
  playerLight: 40,
  vignette: 0.45,
  grain: 0.12,
  bg: '#0b0710',
  banner: true,
  tiles: svc.toString(),
  legend: HOSPITAL_LEGEND,
  spawns: {
    default: { x: 3, y: 6, dir: 'right' },
    start: { x: 3, y: 6, dir: 'right' },
    loop: { x: 12, y: 5, dir: 'right' },
    banc: { x: 27, y: 4, dir: 'up' },
  },
  props: [
    // Neon tubes (one is tired).
    ...[3, 7, 13, 18, 23, 28, 33, 38, 43].map((x) => LIGHT(x, 3, 46, NEON, x === 18, -8)),
    // The break room.
    P('prop_casiers', 1, 3, { w: 2, script: B.lockers }),
    P('prop_machine_cafe', 6, 3, { frames: ['prop_machine_cafe', 'prop_machine_cafe_2'], frameSpeed: 40, script: B.coffeeMachine, light: { r: 20, color: '#ffe991', dy: -18 } }),
    P('', 4, 2, { script: B.breakWindow }),
    P('prop_h_table', 7, 5, { script: B.breakPhone }),
    P('prop_phone', 7, 5, { solid: false, oy: -11, ox: -3, script: B.breakPhone }),
    P('npc_reveil', 7, 5, { id: 'reveil', solid: false, oy: -12, ox: 4, frames: ['npc_reveil', 'npc_reveil_2'], frameSpeed: 30, cond: nf('b_intro') }),
    P('prop_fauteuil', 2, 6, { id: 'fauteuil', script: B.breakChair }),
    LIGHT(7, 5, 30, '#ffe0a0', false, -14),
    // The corridor.
    DECO('prop_h_plant', 12, 3, ['La plante qui ne pousse pas.', 'Tu l\'arroses quand même. Depuis un an, tu arroses tout ce qui ne pousse pas.']),
    ...ROOM_DOORS.map(([x, n]) => P('', x, 2, { script: B.roomDoor(n) })),
    ...[...ROOM_DOORS.map(([x]) => x), DOOR_304].map(callLight),
    P('', DOOR_304, 2, { script: B.door304 }),
    P('prop_chariot', 23, 6, { text: ['Le chariot de soins. Des serviettes pliées, du savon, des gants.', 'Et un paquet de biscuits, que Sabine cache sous les serviettes.'] }),
    P('prop_h_bench', 26, 3, { id: 'banc', w: 2, script: B.bench }),
    DECO('prop_h_wheelchair', 36, 6, 'Un fauteuil roulant, garé pour la nuit. Quelqu\'un a oublié un châle sur l\'accoudoir.'),
  ],
  npcs: [
    { id: 'sabine', sprite: 'npc_sabine', x: 22, y: 6, dir: 'down', script: B.sabineTalk },
    { id: 'albert', sprite: 'npc_albert', x: 31, y: 4, dir: 'down', script: B.albertTalk },
  ],
  enemies: [
    { id: 'b_sonnette_1', enemies: ['sonnette'], x: 17, y: 5, wander: 2 },
    { id: 'b_cafe_1', enemies: ['cafe'], x: 30, y: 6, wander: 2 },
    { id: 'b_duo_1', enemies: ['sonnette', 'sonnette'], x: 35, y: 4, wander: 2, cond: () => Number(G.state.flags.b_loop ?? 0) >= 1 },
  ],
  triggers: [
    { x: 11, y: 3, w: 1, h: 5, once: 'b_corridor', script: B.corridorIntro },
    { x: 40, y: 3, w: 1, h: 5, cond: nf('b_sat'), script: B.corridorLoop },
  ],
  warps: [{ x: HOME_DOOR, y: 2, door: true, to: 'b_appart', spawn: 'entree', cond: f('b_sat'), locked: B.homeDoorLocked }],
};

// ---------------------------------------------------------------------------
// À la maison — the apartment at night (real-world look)
// ---------------------------------------------------------------------------

const app = new Grid(26, 9, 'T');
app.rect(1, 1, 24, 1, 'W').rect(1, 2, 24, 1, 'B').rect(1, 3, 24, 5, 'F').rect(19, 3, 6, 5, 'K').rect(12, 5, 5, 2, 'C');
app.set(2, 1, 'D').set(2, 2, 'd').set(6, 1, 'D').set(6, 2, 'd').set(10, 1, 'M').set(10, 2, 'm').set(14, 1, 'D').set(14, 2, 'd');
app.set(17, 1, 'w').set(22, 1, 'w');

const APPART: MapDef = {
  id: 'b_appart',
  name: 'À la maison',
  world: 'real',
  music: 'maman',
  ambience: 'hum',
  particles: 'dust',
  darkness: 0.42,
  playerLight: 48,
  banner: true,
  tiles: app.toString(),
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 2, y: 3, dir: 'down' },
    entree: { x: 2, y: 3, dir: 'down' },
    panier: { x: 10, y: 4, dir: 'up' },
    mina: { x: 10, y: 4, dir: 'down' },
  },
  onEnter: B.homeEnter,
  props: [
    // Entrance and hallway.
    P('prop_coat', 1, 3, { script: B.coatRack }),
    P('prop_shoes', 3, 3, { solid: false, script: B.noaShoes }),
    P('', 2, 2, { text: ['La porte d\'entrée.', 'Derrière, il y a le couloir des Glycines. Tu n\'as pas envie d\'y retourner. Pas tout de suite.'] }),
    P('', 6, 2, { script: B.noaDoor, light: { r: 22, color: '#ffe0a0', flicker: true, dy: 0 } }),
    P('prop_shelf', 7, 3, { w: 2, script: B.familyPhoto }),
    P('', 10, 2, { script: B.minaDoor }),
    P('ow_panier', 10, 3, { id: 'panier', frames: ['ow_panier', 'ow_panier_2'], frameSpeed: 50, script: B.basket, cond: nf('b_panier_done') }),
    WALL('prop_clock', 12, 2, -10, { script: B.hallClock }),
    P('', 14, 2, { script: B.mamanRoom }),
    // Living room.
    P('prop_tv_off', 15, 3, { w: 2, script: B.tvOff }),
    P('prop_sofa', 13, 6, { w: 2, script: B.sofa }),
    P('prop_lamp', 16, 6, {
      light: { r: 30, color: '#ffe0a0' },
      text: ['Le lampadaire. Tu le laisses allumé, la nuit.', 'Pour que Noa ne traverse pas l\'appartement dans le noir. Il ne le traverse jamais.'],
    }),
    // Kitchen.
    P('prop_fridge', 19, 3, { script: B.fridge }),
    WALL('prop_drawings', 20, 2, -6, { text: ['Les dessins de Mina, au-dessus du plan de travail.', 'Un soleil à lunettes, un mouton à vélo, et Noa avec des cheveux tout bleus.'] }),
    P('prop_counter', 20, 3, { w: 2, text: ['Le plan de travail. Des factures, une liste de courses.', 'En haut de la liste, de ta main : « yaourts (Noa) ». Ça fait des semaines qu\'il est en haut de la liste.'] }),
    P('prop_stove', 22, 3, { script: B.stove }),
    P('prop_sink', 23, 3, { text: ['L\'évier. Le robinet goutte.', 'Tu as appelé le plombier trois fois. Il viendra. Demain, sûrement.'] }),
    P('prop_table', 21, 6, { w: 2, text: ['La table de la cuisine. Trois sets de table.', 'Tu n\'as jamais rangé le troisième.'] }),
    P('prop_chair', 20, 6, { text: 'Ta chaise. Tu ne t\'assois plus pour manger. Tu manges debout, devant l\'évier.' }),
    P('prop_chair', 23, 6, { script: B.minaChair }),
  ],
  enemies: [{ id: 'b_cafe_2', enemies: ['cafe'], x: 21, y: 4, wander: 1 }],
};

// ---------------------------------------------------------------------------
// L'Hôpital de Papier — the pediatric ward, a year ago
// ---------------------------------------------------------------------------

const hosp = new Grid(36, 8, 'T');
hosp.rect(1, 1, 34, 1, 'W').rect(1, 2, 34, 1, 'B').rect(1, 3, 34, 4, 'F');
hosp.set(2, 1, 'M').set(2, 2, 'm').set(9, 1, 'D').set(9, 2, 'd').set(21, 1, 'D').set(21, 2, 'd').set(32, 1, '3').set(32, 2, '4');
hosp.set(6, 1, 'w').set(15, 1, 'w').set(26, 1, 'w');

const HOPITAL: MapDef = {
  id: 'b_hopital',
  name: 'Pédiatrie, troisième étage',
  world: 'dream',
  music: 'hospital',
  ambience: 'hum',
  particles: 'dust',
  darkness: 0.36,
  playerLight: 38,
  vignette: 0.45,
  grain: 0.15,
  bg: '#0b0710',
  banner: true,
  tiles: hosp.toString(),
  legend: HOSPITAL_LEGEND,
  spawns: {
    default: { x: 2, y: 3, dir: 'down' },
    mina: { x: 2, y: 3, dir: 'down' },
    nadia: { x: 31, y: 4, dir: 'right' },
  },
  onEnter: B.hospEnter,
  props: [
    ...[4, 10, 16, 22, 28, 33].map((x) => LIGHT(x, 3, 48, NEON, x === 22, -8)),
    P('prop_distributeur', 4, 3, { w: 2, script: B.vending, light: { r: 26, color: '#c8e8ff', dy: -16 } }),
    WALL('prop_h_drawings', 7, 2, -6, { script: B.wardDrawings }),
    P('', 9, 2, { script: B.parentsRoom }),
    P('prop_h_bench', 12, 6, { w: 2, script: B.wardBench }),
    DECO('prop_h_plant', 14, 3, ['Une plante en papier crépon.', 'Mina lui avait donné un prénom : Gérard. Gérard a l\'air en forme.']),
    DECO('prop_h_wheelchair', 19, 6, ['Un fauteuil roulant.', 'Mina s\'en servait comme d\'une voiture de course. Les infirmières faisaient semblant de ne rien voir.']),
    P('', 21, 2, { script: B.room302 }),
    P('prop_h_desk', 24, 3, { w: 2, text: ['Le poste des infirmières. Une lampe, un classeur, une boîte de chocolats offerte par des parents.', 'Tu en as offert une, toi aussi. Après.'] }),
    { sprite: 'prop_savepoint', frames: ['prop_savepoint', 'prop_savepoint_2'], frameSpeed: 18, x: 28, y: 3, light: { r: 44, color: '#ffe991', flicker: true }, script: B.savePointHosp },
  ],
  npcs: [
    { id: 'mina', char: 'mina', x: 17, y: 5, dir: 'left', cond: nf('b_mina_mem'), script: B.minaMemory, light: { r: 34, color: '#ffe991', flicker: true, dy: -10 } },
    { id: 'nadia', sprite: 'npc_nadia', x: 32, y: 3, dir: 'down', cond: nf('b_nadia'), script: B.nadiaTalk },
    { id: 'nadia', sprite: 'npc_nadia', x: 30, y: 3, dir: 'right', cond: f('b_nadia'), script: B.nadiaTalk },
  ],
  enemies: [
    { id: 'b_sonnette_2', enemies: ['sonnette'], x: 13, y: 4, wander: 2 },
    { id: 'b_duo_2', enemies: ['cafe', 'sonnette'], x: 25, y: 5, wander: 2 },
  ],
  warps: [
    { x: 2, y: 2, door: true, to: 'b_appart', spawn: 'mina' },
    { x: 32, y: 2, door: true, to: 'b_304', spawn: 'porte', cond: f('b_nadia'), locked: ['Chambre 304.', 'Ta main ne veut pas tourner la poignée. Pas encore.'] },
  ],
};

// ---------------------------------------------------------------------------
// Chambre 304 — the parents' armchair
// ---------------------------------------------------------------------------

const ROOM_304: MapDef = {
  id: 'b_304',
  name: 'Chambre 304',
  world: 'dream',
  music: null,
  ambience: 'rain',
  particles: 'dust',
  darkness: 0.45,
  playerLight: 40,
  vignette: 0.5,
  grain: 0.15,
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
  spawns: { default: { x: 6, y: 7, dir: 'up' }, porte: { x: 6, y: 7, dir: 'up' } },
  onEnter: B.room304Enter,
  props: [
    LIGHT(3, 3, 44, MOON, false, -12),
    LIGHT(9, 3, 44, MOON, false, -12),
    P('prop_h_monitor', 1, 3, { text: ['Le moniteur. L\'écran est éteint.', 'Tu avais appris à lire ses courbes. Tu aurais préféré ne jamais apprendre.'] }),
    P('prop_h_bed', 2, 3, { h: 2, script: B.room304Bed }),
    P('prop_h_table', 4, 3, { script: B.room304Table }),
    P('prop_h_iv', 1, 5, { text: ['Le pied à perfusion. Vide.', 'Tu le poussais dans les couloirs, la nuit, quand elle voulait aller voir le robot.'] }),
    WALL('prop_h_drawings', 6, 2, -6, { script: B.room304Drawings }),
    P('', 9, 2, { script: B.room304Window }),
    P('prop_fauteuil', 8, 4, { id: 'fauteuil', text: ['Le fauteuil des parents.', 'Il grince quand on se retourne. Tu t\'y retournais beaucoup.'] }),
    P('', 6, 8, { text: ['La porte. Derrière, le couloir, Nadia, la nuit.', 'Tu ne repars pas. Pas maintenant.'] }),
  ],
};

export const BONUS_MAPS: Record<string, MapDef> = {
  b_service: SERVICE,
  b_appart: APPART,
  b_hopital: HOPITAL,
  b_304: ROOM_304,
};

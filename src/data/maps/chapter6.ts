import type { MapDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { f, isSilenceRoute, nf, savePoint } from '../../game/story/common';
import * as C6 from '../../game/story/chapter6';
import { Grid } from './build';

/*
 * Chapter 6 — « Le Ventre de Dodo » (docs/HISTOIRE.md § 3.14). The inside of the plush (world `ouate`):
 *   couture          where Noa fell through the seam: the slit of yellow light high above, the back of the fabric; a
 *                    tunnel of damp cotton whose walls replay the prologue; the hollow where T7 happens.
 *   ouate            the wadding: the shelves of jars (nights 1 to 364), a pit crossed by Mina's red thread, the puddle
 *                    where « Nuit 1 » fell (and, behind it, the jar without a label), the nest, Chaussette, the sealed
 *                    seam that only opens for the forgotten night.
 *   boite_a_musique  Dodo's heart: a round room of yellowed foam, the brass cylinder, the comb of baby teeth, the crank;
 *                    the passage down only opens once the lullaby has played whole (C6.boiteEnter / C6.musicBox).
 *   couloir_41       the apartment's hallway, far too long: fourteen doors, then two branches of doors 15 to 41 (the
 *                    layout is C6.CORRIDOR); the end room with the button eyes, the headphones and the Pile, cut off
 *                    from the rest (reached through door 41).
 *   voix             the voice chamber: the module REC / PLAY as big as a church, its crust, Mina's empty puppets, the
 *                    little girl in the knitted hat; the way out leads back in.
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
/** Hung on a wall-base row: lifted a little, never solid. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** An invisible interactable. */
const SPOT = (x: number, y: number, script: PropDef['script'], o: Partial<PropDef> = {}): PropDef => P('', x, y, { solid: false, script, ...o });
/** Flat on the ground (drawn under everything, walkable). */
const FLAT = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, under: true, ...o });

const coton = (): boolean => Number(G.state.flags.c4_coton ?? 0) > 0;
const both = (a: () => boolean, b: () => boolean) => (): boolean => a() && b();

/** Cells Noa can walk on, in the cotton maps (walls rise behind them). */
const WALKABLE = new Set(['.', ',', 's', 'm', 'c', 'k', '-', '|']);

/** Raises a wall face over every walkable cell whose north neighbour is solid cotton: the foot, then the face. */
function raiseWalls(g: Grid): Grid {
  for (let y = 1; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      if (!WALKABLE.has(g.get(x, y) ?? '') || g.get(x, y - 1) !== 'H') continue;
      g.set(x, y - 1, 'p');
      if (g.get(x, y - 2) === 'H') g.set(x, y - 2, 'P');
    }
  return g;
}

const COTTON_LEGEND: Record<string, string> = {
  H: 'c6_haut',
  P: 'c6_paroi',
  p: 'c6_paroi_base',
  '.': 'c6_ouate',
  ',': 'c6_trempe',
  s: 'c6_tache',
  V: 'c6_gouffre',
  '-': 'c6_fil_h',
  '|': 'c6_fil_v',
  m: 'c6_mousse',
  c: 'c6_croute',
  k: 'c6_plastique',
  T: 'c6_tissu',
  b: 'c6_tissu_base',
  F: 'c6_fente',
  f: 'c6_fente_base',
};

// ---------------------------------------------------------------------------------------------------------------------
// couture — the landing under the seam, the tunnel, the hollow
// ---------------------------------------------------------------------------------------------------------------------

/** 34×17: the landing (x 2–12) under the fabric and its slit, a tunnel east (rows 6–8), the hollow, a way down. */
function coutureTiles(): string {
  const g = new Grid(34, 17, 'H');
  g.rect(2, 4, 11, 7, '.');
  g.set(2, 10, 'H').set(12, 10, 'H').set(2, 4, 'H');
  g.rect(13, 6, 7, 3, '.');
  g.blob(25, 8, 5.4, 4.1, '.', 12);
  g.rect(24, 12, 2, 5, '.');
  g.blob(10, 9, 1.8, 1.1, ',', 5, '.').blob(28, 10, 1.6, 1.2, ',', 6, '.').blob(17, 8, 1.4, 0.8, ',', 7, '.');
  g.scatter('s', 0.05, 61, '.');
  raiseWalls(g);
  // The back of the fabric over the landing, and the seam Noa fell through.
  g.rect(2, 1, 11, 2, 'T').rect(2, 3, 11, 1, 'b');
  g.set(2, 3, 'H');
  g.set(6, 1, 'F').set(6, 2, 'F').set(6, 3, 'f');
  return g.toString();
}

const COUTURE: MapDef = {
  id: 'couture',
  name: 'La Couture',
  world: 'ouate',
  music: 'ventre',
  ambience: 'none',
  darkness: 0.35,
  playerLight: 52,
  particles: 'cotton',
  vignette: 0.45,
  grain: 0.12,
  banner: true,
  tiles: coutureTiles(),
  legend: COTTON_LEGEND,
  spawns: {
    default: { x: 6, y: 6, dir: 'down' },
    chute: { x: 6, y: 6, dir: 'down' },
    creux: { x: 19, y: 7, dir: 'right' },
    sortie: { x: 24, y: 14, dir: 'up' },
  },
  onEnter: C6.coutureEnter,
  props: [
    // --- The landing: the light falling from the seam, the fabric, a thread, a soaked patch.
    FLAT('prop_c6_lumiere', 5, 6, { w: 2, ox: 8, light: { r: 46, color: '#fff3b0', dy: -6 }, script: C6.slitLight }),
    SPOT(6, 3, C6.slitLight, { light: { r: 22, color: '#fff3b0', dy: -12 } }),
    SPOT(3, 3, C6.seamFabric),
    SPOT(10, 3, C6.seamFabric),
    P('prop_c6_fil_pendu_1', 11, 5, { solid: false, oy: -10, frames: ['prop_c6_fil_pendu_1', 'prop_c6_fil_pendu_2'], frameSpeed: 44, script: C6.coutureThread }),
    SPOT(10, 9, C6.coutureDrip),
    FLAT('prop_c6_tache', 3, 8, { w: 2, script: C6.ouateStain }),
    // --- The tunnel: a warm tuft that throbs, pins hanging.
    WALL('prop_c6_touffe_1', 16, 5, 3, { frames: ['prop_c6_touffe_1', 'prop_c6_touffe_2'], frameSpeed: 50, script: C6.coutureTuft }),
    WALL('prop_c6_epingles_2', 14, 5, 2, { script: C6.pinsCeiling }),
    SPOT(17, 8, C6.coutureDrip),
    // --- The hollow.
    WALL('prop_c6_epingles_1', 22, 5, 4, { script: C6.pinsCeiling }),
    WALL('prop_c6_epingles_3', 28, 5, 4, { script: C6.pinsCeiling }),
    FLAT('prop_c6_tache', 22, 10, { w: 2, script: C6.hollowStain }),
    P('prop_c6_fil_pendu_2', 29, 8, { solid: false, oy: -12, frames: ['prop_c6_fil_pendu_2', 'prop_c6_fil_pendu_1'], frameSpeed: 52, script: C6.coutureThread }),
    WALL('prop_c6_touffe_2', 26, 4, 4, { frames: ['prop_c6_touffe_2', 'prop_c6_touffe_1'], frameSpeed: 46, script: C6.coutureTuft }),
  ],
  triggers: [
    // The walls replay the prologue, one line each, as Noa walks east.
    { x: 9, y: 4, w: 1, h: 7, script: C6.replay(0), once: 'c6_mur_1' },
    { x: 12, y: 5, w: 1, h: 5, script: C6.replay(1), once: 'c6_mur_2' },
    { x: 15, y: 6, w: 1, h: 3, script: C6.replay(2), once: 'c6_mur_3' },
    { x: 18, y: 6, w: 1, h: 3, script: C6.replay(3), once: 'c6_mur_4' },
    { x: 19, y: 6, w: 1, h: 3, script: C6.t7, cond: nf('c6_t7') },
  ],
  warps: [{ x: 24, y: 16, w: 2, h: 1, to: 'ouate', spawn: 'couture', cond: f('c6_t7') }],
};

// ---------------------------------------------------------------------------------------------------------------------
// ouate — the wadding: the jars, the pit, the puddle, the nest, the sealed seam
// ---------------------------------------------------------------------------------------------------------------------

/** 44×28: the gallery of shelves (rows 3–9), a pit (rows 10–13) crossed by the red thread, the low cave (rows 14–24). */
function ouateTiles(): string {
  const g = new Grid(44, 28, 'H');
  // The way in from the seam, from the north.
  g.rect(5, 0, 2, 3, '.');
  // The gallery of shelves.
  g.rect(2, 3, 35, 7, '.');
  g.set(2, 9, 'H').set(36, 9, 'H').set(2, 3, 'H');
  // The pit, under the whole gallery, and the threads across it.
  g.rect(3, 10, 33, 4, 'V');
  g.set(2, 10, 'H').set(2, 11, 'H').set(2, 12, 'H').set(2, 13, 'H');
  g.rect(31, 10, 1, 4, '|');
  g.rect(9, 10, 1, 4, '|').set(9, 11, 'V');
  // The low cave.
  g.blob(21, 19, 19.5, 5.6, '.', 21);
  g.rect(3, 14, 33, 2, '.');
  g.rect(37, 12, 5, 9, 'H');
  g.rect(36, 14, 6, 7, '.');
  g.rect(39, 12, 1, 2, '.');
  // Soaked cotton: the puddle under the dripping pin, and where something slept.
  g.blob(9, 18, 3.2, 1.8, ',', 8, '.').blob(25, 22, 2.2, 1.2, ',', 9, '.').blob(34, 16, 1.5, 1, ',', 10, '.');
  g.scatter('s', 0.04, 62, '.');
  raiseWalls(g);
  return g.toString();
}

const OUATE: MapDef = {
  id: 'ouate',
  name: 'La Ouate',
  world: 'ouate',
  music: 'ventre',
  ambience: 'none',
  darkness: 0.28,
  playerLight: 56,
  particles: 'cotton',
  vignette: 0.4,
  grain: 0.1,
  banner: true,
  tiles: ouateTiles(),
  legend: COTTON_LEGEND,
  spawns: {
    default: { x: 5, y: 3, dir: 'down' },
    couture: { x: 5, y: 3, dir: 'down' },
    boite: { x: 39, y: 14, dir: 'down' },
  },
  onEnter: C6.ouateEnter,
  props: [
    // --- The gallery: four shelves of jars, the empty place, the jar of tonight.
    P('prop_c6_etagere_1', 9, 2, { id: 'etagere_a', w: 2, h: 2, script: C6.shelf('a') }),
    P('prop_c6_etagere_2', 13, 2, { id: 'etagere_b', w: 2, h: 2, script: C6.shelf('b') }),
    P('prop_c6_etagere_3', 17, 2, { id: 'etagere_c', w: 2, h: 2, script: C6.shelf('c') }),
    P('prop_c6_etagere_1', 21, 2, { id: 'etagere_d', w: 2, h: 2, script: C6.shelf('d') }),
    P('prop_c6_etagere_trou', 25, 2, { id: 'etagere_trou', w: 2, h: 2, script: C6.shelfGap }),
    P('prop_c6_etagere_2', 29, 2, { id: 'etagere_avance', w: 2, h: 2, script: C6.shelfSealed }),
    P('prop_c6_bocal_vierge', 33, 3, { id: 'bocal_ce_soir', script: C6.jarTonight }),
    P('prop_c6_bocal', 4, 4, { script: C6.looseJar(0) }),
    P('prop_c6_bocal_fil', 12, 8, { script: C6.looseJar(1) }),
    P('prop_c6_bocal_dent', 27, 8, { script: C6.looseJar(2) }),
    WALL('prop_c6_epingles_1', 7, 2, 4, { script: C6.pinsCeiling }),
    WALL('prop_c6_epingles_3', 23, 2, 2, { script: C6.pinsCeiling }),
    WALL('prop_c6_epingles_2', 35, 2, 4, { script: C6.pinsCeiling }),
    SPOT(16, 10, C6.pitLook),
    SPOT(24, 11, C6.pitLook),
    SPOT(30, 10, C6.bridgeLook),
    SPOT(9, 11, C6.brokenBridge),
    // --- The low cave: the fallen jar in the puddle, the jar without a label behind it, the drip.
    P('prop_c6_epingle', 9, 16, { solid: false, oy: -10, script: C6.pinFloor }),
    P('prop_c6_bocal_zero', 8, 17, { id: 'bocal_zero', solid: false, oy: 4, ox: 6, cond: nf('c6_bocal0'), script: C6.fallenJar }),
    P('prop_c6_bocal_tombe', 9, 18, { id: 'nuit1', w: 1, ox: 2, script: C6.fallenJar }),
    SPOT(11, 19, C6.puddle),
    SPOT(6, 18, C6.puddle),
    // --- The nest, the stain, the thread that holds the walls.
    P('prop_c6_nid', 19, 20, { id: 'nid', w: 2, script: C6.nest }),
    FLAT('prop_c6_tache', 24, 22, { w: 2, script: C6.ouateStain }),
    P('prop_c6_fil_pendu_1', 15, 17, { solid: false, oy: -12, frames: ['prop_c6_fil_pendu_1', 'prop_c6_fil_pendu_2'], frameSpeed: 48, script: C6.ouateThread }),
    P('prop_c6_fil_pendu_2', 35, 19, { solid: false, oy: -12, frames: ['prop_c6_fil_pendu_2', 'prop_c6_fil_pendu_1'], frameSpeed: 40, script: C6.ouateThread }),
    WALL('prop_c6_touffe_1', 13, 15, 4, { frames: ['prop_c6_touffe_1', 'prop_c6_touffe_2'], frameSpeed: 60, script: C6.coutureTuft }),
    P('prop_c6_epingle', 28, 18, { script: C6.pinFloor }),
    // --- The forest of needles.
    ...([
      [36, 19, 0],
      [37, 20, -4],
      [38, 18, 2],
      [40, 19, -2],
      [39, 21, 0],
      [41, 17, 3],
      [36, 21, 1],
    ] as const).map(([x, y, ox]) => P('prop_c6_epingle', x, y, { ox, script: C6.pinForest })),
    // --- Chaussette's corner: the save point.
    { ...savePoint(31, 17, 'Une petite lumière, au fond du coton. Elle a la chaleur d\'une main.'), id: 'sauvegarde' },
    // --- The sealed seam, in the east wall of the low cave.
    P('prop_c6_couture', 39, 12, { id: 'couture', h: 2, solid: true, script: C6.sealedSeam, cond: nf('c6_couture') }),
    P('prop_c6_couture_ouverte', 39, 12, { h: 2, solid: false, cond: f('c6_couture') }),
  ],
  npcs: [{ id: 'chaussette', sprite: 'npc_chaussette', frames: ['npc_chaussette', 'npc_chaussette_2'], frameSpeed: 30, x: 33, y: 17, shadow: false, script: C6.chaussette }],
  enemies: [
    { id: 'c6_aiguille_1', enemies: ['aiguille'], x: 14, y: 6, wander: 2 },
    { id: 'c6_moutons_1', enemies: ['mouton_numerote', 'mouton_numerote'], x: 29, y: 6, wander: 2 },
    { id: 'c6_bouton_1', enemies: ['bouton_pendu'], x: 14, y: 21, wander: 1 },
    { id: 'c6_bourre_1', enemies: ['bourre'], x: 18, y: 22, wander: 1, cond: coton },
    { id: 'c6_bourre_2', enemies: ['bourre', 'bourre'], x: 24, y: 18, wander: 1, cond: () => Number(G.state.flags.c4_coton ?? 0) > 2 },
  ],
  triggers: [{ x: 16, y: 18, w: 10, h: 6, script: C6.bourresMurmur, cond: coton }],
  warps: [
    { x: 5, y: 0, w: 2, h: 1, to: 'couture', spawn: 'sortie' },
    { x: 39, y: 12, w: 1, h: 1, to: 'boite_a_musique', spawn: 'ouate', cond: f('c6_couture') },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------
// boite_a_musique — Dodo's heart
// ---------------------------------------------------------------------------------------------------------------------

/** Cells of the passage down, closed with cotton until the lullaby has played (C6.FOAM_PASSAGE opens them). */
function boiteTiles(): string {
  const g = new Grid(30, 20, 'H');
  g.blob(15, 11.4, 12.6, 6.4, 'm', 31);
  g.rect(6, 4, 18, 3, 'm');
  // The crust creeping from the crank.
  g.blob(21, 6, 2.4, 1.3, 'c', 4, 'm');
  raiseWalls(g);
  return g.toString();
}

const BOITE: MapDef = {
  id: 'boite_a_musique',
  name: 'La Boîte à musique',
  world: 'ouate',
  music: 'ventre',
  ambience: 'none',
  darkness: 0.2,
  playerLight: 60,
  particles: 'dust',
  vignette: 0.4,
  grain: 0.08,
  banner: true,
  tiles: boiteTiles(),
  legend: COTTON_LEGEND,
  spawns: {
    default: { x: 14, y: 16, dir: 'up' },
    ouate: { x: 14, y: 16, dir: 'up' },
    couloir: { x: 14, y: 17, dir: 'up' },
  },
  onEnter: C6.boiteEnter,
  props: [
    // --- The heart: the brass cylinder, the comb of baby teeth, the crank.
    P('prop_c6_cylindre', 11, 4, { id: 'cylindre', w: 8, script: C6.cylinder }),
    P('prop_c6_peigne_3', 11, 5, { id: 'peigne', w: 8, script: C6.comb }),
    P('prop_c6_manivelle', 20, 4, { id: 'manivelle', script: C6.crank }),
    FLAT('prop_c6_croute_1', 20, 6, { w: 3, script: C6.crustLook }),
    // --- The three missing teeth.
    P('prop_c6_dent', 6, 12, { id: 'dent_1', solid: false, frames: ['prop_c6_dent', 'prop_c6_dent', 'prop_c6_dent_2'], frameSpeed: 40, cond: nf('c6_dent_1'), script: C6.tooth(1) }),
    P('prop_c6_epingle', 23, 13, { solid: false, oy: -6, script: C6.pinFloor }),
    P('prop_c6_dent', 24, 14, { id: 'dent_2', solid: false, frames: ['prop_c6_dent', 'prop_c6_dent_2', 'prop_c6_dent'], frameSpeed: 36, cond: nf('c6_dent_2'), script: C6.tooth(2) }),
    P('prop_c6_dent', 22, 6, { id: 'dent_3', solid: false, frames: ['prop_c6_dent_2', 'prop_c6_dent', 'prop_c6_dent'], frameSpeed: 44, cond: nf('c6_dent_3'), script: C6.tooth(3) }),
    // --- The room.
    WALL('prop_c6_souris', 7, 3, 2, { script: C6.boiteMouse }),
    WALL('prop_c6_epingles_3', 25, 4, 4, { script: C6.pinsCeiling }),
    SPOT(4, 10, C6.foamLook),
    SPOT(26, 11, C6.foamLook),
    SPOT(15, 16, C6.foamLook),
  ],
  enemies: [
    { id: 'c6_aiguille_2', enemies: ['aiguille'], x: 8, y: 9, wander: 2, cond: nf('c6_boite') },
    { id: 'c6_bouton_2', enemies: ['bouton_pendu'], x: 24, y: 10, wander: 1, cond: nf('c6_boite') },
  ],
  warps: [{ x: 14, y: 19, w: 2, h: 1, to: 'couloir_41', spawn: 'debut', cond: f('c6_boite') }],
};

// ---------------------------------------------------------------------------------------------------------------------
// couloir_41 — the corridor of the forty-one doors
// ---------------------------------------------------------------------------------------------------------------------

const { trunk, haut, bas, doorX, shaft, width } = C6.CORRIDOR;

/** 93×32: the trunk (doors 1–14), the shaft at the fork, two branches (doors 15–41), and the end room below. */
function corridorTiles(): string {
  const g = new Grid(width, 32, 'T');
  // The trunk.
  g.rect(1, trunk.wall, shaft - 1, 1, 'W').rect(1, trunk.base, shaft - 1, 1, 'B').rect(0, trunk.floor, shaft + 2, 1, 'F');
  for (let n = 1; n <= 14; n++) g.set(doorX(n), trunk.wall, 'D').set(doorX(n), trunk.base, 'd');
  // The shaft where the corridor splits, then the two branches.
  g.rect(shaft, haut.floor, 2, bas.floor - haut.floor + 1, 'F');
  for (const b of [haut, bas]) {
    const x0 = b === haut ? shaft : shaft + 2;
    g.rect(x0, b.wall, width - 1 - x0, 1, 'W').rect(x0, b.base, width - 1 - x0, 1, 'B').rect(shaft, b.floor, width - 2 - shaft, 1, 'F');
    for (let n = 15; n <= 41; n++) g.set(doorX(n), b.wall, 'D').set(doorX(n), b.base, 'd');
  }
  // The end room (only reached through door 41): a door of arrival, a seam in the wallpaper.
  g.rect(4, 22, 25, 2, 'W').rect(4, 24, 25, 1, 'B').rect(4, 25, 25, 6, 'F');
  g.set(6, 23, 'D').set(6, 24, 'd');
  g.set(25, 23, 'F').set(25, 24, 'F');
  return g.toString();
}

const CORRIDOR_LEGEND: Record<string, string> = {
  T: 'r_wall_top',
  W: 'r_wall',
  B: 'r_wall_base',
  F: 'r_floor',
  D: 'r_door_top',
  d: 'r_door',
};

function corridorProps(): PropDef[] {
  const out: PropDef[] = [];
  const plate = (n: number, x: number, wall: number): PropDef => WALL(`prop_c6_num_${n}`, x, wall, -6);
  for (let n = 1; n <= 14; n++) out.push(plate(n, doorX(n), trunk.wall));
  for (const b of [haut, bas]) for (let n = 15; n <= 41; n++) out.push(plate(n, doorX(n), b.wall));
  return out;
}

function corridorTriggers(): NonNullable<MapDef['triggers']> {
  const out: NonNullable<MapDef['triggers']> = [];
  for (let n = 1; n <= 14; n++) out.push({ x: doorX(n), y: trunk.floor, script: C6.trunkDoor(n) });
  for (const side of ['haut', 'bas'] as const)
    for (let n = 15; n <= 40; n++) out.push({ x: doorX(n), y: C6.CORRIDOR[side].floor, script: C6.branchDoor(side, n) });
  out.push({ x: shaft, y: trunk.floor, w: 2, h: 1, script: C6.fork });
  return out;
}

const COULOIR_41: MapDef = {
  id: 'couloir_41',
  name: 'Le Couloir des 41 portes',
  world: 'ouate',
  music: 'appel',
  ambience: 'none',
  darkness: 0.42,
  playerLight: 58,
  particles: 'dust',
  vignette: 0.5,
  grain: 0.16,
  banner: true,
  tiles: corridorTiles(),
  legend: CORRIDOR_LEGEND,
  spawns: {
    default: { x: 1, y: trunk.floor, dir: 'right' },
    debut: { x: 1, y: trunk.floor, dir: 'right' },
    fourche: { x: doorX(14), y: trunk.floor, dir: 'right' },
    bout: { x: 6, y: 25, dir: 'down' },
  },
  onEnter: C6.couloirEnter,
  props: [
    ...corridorProps(),
    // --- The trunk: the switch that does nothing, the wallpaper that breathes.
    SPOT(2, trunk.base, C6.switchLook),
    SPOT(10, trunk.base, C6.corridorWall),
    SPOT(24, trunk.base, C6.corridorWall),
    SPOT(58, haut.base, C6.corridorWall),
    SPOT(70, bas.base, C6.corridorWall),
    // --- Door 41, at the end of each branch.
    SPOT(doorX(41), haut.base, C6.door41('haut'), { id: 'porte41_haut', solid: true }),
    SPOT(doorX(41), bas.base, C6.door41('bas'), { id: 'porte41_bas', solid: true }),
    // --- The end room: Dodo's button eyes, the headphones, the seam that opens after the Pile.
    P('prop_c6_oeil', 11, 24, { id: 'oeil_g', w: 3, solid: true, script: C6.eyesLook }),
    P('prop_c6_oeil', 17, 24, { id: 'oeil_d', w: 3, solid: true, script: C6.eyesLook }),
    FLAT('prop_c6_casque', 8, 28, { id: 'casque', script: C6.headphones }),
    SPOT(5, 24, C6.boutLook),
    SPOT(22, 24, C6.boutLook),
    P('prop_c6_couture', 25, 23, { id: 'sortie', h: 2, solid: true, cond: nf('c6_pile_fait'), script: C6.boutSeam }),
    P('prop_c6_couture_ouverte', 25, 23, { h: 2, solid: false, cond: f('c6_pile_fait') }),
  ],
  npcs: [{ id: 'pile', sprite: 'ow_pile', frames: ['ow_pile', 'ow_pile_2'], frameSpeed: 26, x: 21, y: 27, shadow: false, cond: nf('c6_pile_fait'), script: C6.pile }],
  triggers: corridorTriggers(),
  warps: [
    { x: 0, y: trunk.floor, w: 1, h: 1, to: 'boite_a_musique', spawn: 'couloir' },
    { x: 25, y: 23, w: 1, h: 1, to: 'voix', spawn: 'entree', cond: f('c6_pile_fait') },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------
// voix — the voice chamber
// ---------------------------------------------------------------------------------------------------------------------

/** 31×26: a hall of cotton around the module; plastic at its foot, the crust spreading from it. */
function voixTiles(): string {
  const g = new Grid(31, 26, 'H');
  g.blob(15.5, 14.5, 14.2, 9.2, '.', 41);
  g.rect(4, 5, 23, 4, '.');
  g.rect(14, 22, 3, 4, '.');
  g.rect(9, 9, 13, 2, 'k');
  g.blob(15.5, 8, 7, 2.4, 'k', 3, '.');
  g.blob(12, 11, 3.5, 1.6, 'c', 5).blob(20, 10.5, 2.6, 1.4, 'c', 6).blob(8, 9, 2, 1.2, 'c', 7, '.');
  g.blob(23, 13, 1.6, 1, ',', 8, '.').blob(6, 16, 1.8, 1.1, ',', 9, '.');
  g.scatter('s', 0.04, 63, '.');
  raiseWalls(g);
  return g.toString();
}

const VOIX: MapDef = {
  id: 'voix',
  name: 'La Voix',
  world: 'ouate',
  music: null,
  ambience: 'hum',
  darkness: 0.18,
  playerLight: 60,
  particles: 'cotton',
  vignette: 0.45,
  grain: 0.1,
  banner: true,
  tiles: voixTiles(),
  legend: COTTON_LEGEND,
  spawns: {
    default: { x: 15, y: 22, dir: 'up' },
    entree: { x: 15, y: 22, dir: 'up' },
    seuil: { x: 15, y: 16, dir: 'up' },
  },
  onEnter: C6.voixEnter,
  props: [
    // --- The module « Mon doudou qui parle ! », its crust, Mina's stitches.
    P('prop_c6_module', 10, 7, { id: 'module', w: 11, h: 3, frames: ['prop_c6_module', 'prop_c6_module', 'prop_c6_module_2'], frameSpeed: 90, script: C6.moduleLook }),
    FLAT('prop_c6_croute_2', 7, 10, { w: 3, script: C6.crustLook }),
    FLAT('prop_c6_croute_3', 19, 11, { w: 3, script: C6.crustLook }),
    FLAT('prop_c6_croute_1', 12, 12, { w: 3, script: C6.crustLook }),
    // --- The empty puppets on their strings.
    P('prop_c6_marionnette_princesse', 5, 9, { frames: ['prop_c6_marionnette_princesse', 'prop_c6_marionnette_princesse_2'], frameSpeed: 70, script: C6.puppetPrincess }),
    P('prop_c6_marionnette_feutre', 25, 9, { frames: ['prop_c6_marionnette_feutre', 'prop_c6_marionnette_feutre_2'], frameSpeed: 64, script: C6.puppetFelt }),
    SPOT(4, 7, C6.voixThread),
    SPOT(26, 7, C6.voixThread),
    WALL('prop_c6_epingles_1', 3, 6, 4, { script: C6.pinsCeiling }),
    WALL('prop_c6_epingles_2', 27, 6, 4, { script: C6.pinsCeiling }),
    // --- The route of the ink: nobody there, a pool of ink, a hat.
    FLAT('prop_c6_encre', 14, 13, { id: 'flaque_encre', w: 2, ox: 8, cond: isSilenceRoute, script: C6.inkPool }),
    P('prop_c6_bonnet_plat', 15, 13, { solid: false, oy: -2, cond: isSilenceRoute, script: C6.inkPool }),
    // --- The save point, by the way in.
    { ...savePoint(11, 20, 'Une petite lumière, au bord de la croûte. Elle tient bon.'), id: 'sauvegarde' },
  ],
  npcs: [
    // The little girl in the knitted hat: from behind, faceless; once looked at, her face drawn in pencil, turned to Noa.
    { id: 'petite', char: 'bonnet', x: 15, y: 13, dir: 'up', cond: both(() => !isSilenceRoute(), both(nf('c6_final'), nf('c6_regarder'))), script: C6.petiteTalk },
    { id: 'petite', char: 'bonnet_drawn', x: 15, y: 13, dir: 'down', cond: both(() => !isSilenceRoute(), f('c6_regarder')), script: C6.petiteTalk },
  ],
  triggers: [{ x: 1, y: 16, w: 29, h: 1, script: C6.threshold, cond: nf('c6_seuil') }],
  warps: [{ x: 14, y: 25, w: 3, h: 1, to: 'voix', spawn: 'entree', sfx: 'none' }],
};

export const CHAPTER6_MAPS: Record<string, MapDef> = {
  couture: COUTURE,
  ouate: OUATE,
  boite_a_musique: BOITE,
  couloir_41: COULOIR_41,
  voix: VOIX,
};

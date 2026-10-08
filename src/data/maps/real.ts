import type { MapDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import * as R from '../../game/story/real';

/*
 * Real world: Noa's apartment. The same rooms are revisited at different moments of the story
 * (prologue, interlude 1, interlude 2, finale); objects read G.state.flags.interlude to change.
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
const ON = (sprite: string, x: number, y: number, oy: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });

/** An invisible interactable on a door tile of the top wall. */
const DOOR = (x: number, script: PropDef['script']): PropDef => ({ sprite: '', x, y: 2, script });

const NIGHTLIGHT = { r: 52, color: '#ffe991', flicker: true, dy: -10 };
const TV_GLOW = { r: 60, color: '#c8d8ff', flicker: true, dy: -14 };

const phase = (): number => Number(G.state.flags.interlude ?? 0);

const REAL_LEGEND = {
  T: 'r_wall_top',
  W: 'r_wall',
  B: 'r_wall_base',
  V: 'r_void',
  F: 'r_floor',
  C: 'r_carpet',
  K: 'r_tile',
  w: 'r_window',
  D: 'r_door_top',
  d: 'r_door',
  M: 'r_door_mina_top',
  m: 'r_door_mina',
  O: 'r_door_open_top',
  o: 'r_door_open',
  X: 'r_wall_mina',
  x: 'r_wall_mina_base',
  P: 'r_floor_mina',
};

// ---------------------------------------------------------------------------
// Noa's bedroom
// ---------------------------------------------------------------------------

const CHAMBRE: MapDef = {
  id: 'chambre',
  name: 'Chambre de Noa',
  world: 'real',
  music: 'room',
  ambience: 'rain',
  darkness: 0.5,
  playerLight: 46,
  particles: 'dust',
  banner: true,
  tiles: `
    TTTTTTTTTTTTTT
    TWWwWWWWDWWwWT
    TBBBBBBBdBBBBT
    TFFFFFFFFFFFFT
    TFFCCCCCCCCFFT
    TFFCCCCCCCCFFT
    TFFCCCCCCCCFFT
    TFFFFFFFFFFFFT
    TTTTTTTTTTTTTT
  `,
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 2, y: 5, dir: 'up' },
    bed: { x: 2, y: 5, dir: 'up' },
    door: { x: 8, y: 3, dir: 'down' },
  },
  onEnter: R.chambreEnter,
  props: [
    P('prop_bed', 1, 3, { id: 'bed', h: 2, script: R.bed }),
    P('prop_nightstand', 2, 3, { script: R.nightlight }),
    ON('prop_veilleuse', 2, 3, -9, { id: 'veilleuse', light: NIGHTLIGHT, script: R.nightlight }),
    ON('prop_dodo_plush', 1, 4, -5, {
      id: 'dodo_plush',
      cond: () => (phase() === 0 ? !G.state.flags.p_dodo : phase() === 2 ? !!G.state.flags.i2_dodo_back : true),
    }),
    WALL('prop_calendar', 2, 2, -8, { text: ['Un calendrier.', 'Il n\'a pas été tourné depuis un an. Les cases sont vides.'] }),
    P('prop_desk', 3, 3, { w: 2, script: R.desk }),
    ON('prop_phone', 4, 3, -12, { id: 'phone', frames: ['prop_phone', 'prop_phone_2'], frameSpeed: 30, script: R.phone }),
    P('prop_chair', 4, 4, { solid: false, text: 'Ta chaise. Ton sweat est roulé en boule dessus.' }),
    WALL('prop_poster', 5, 2, -4, { text: ['Un poster du système solaire.', 'Mina disait que Pluton était triste d\'être toute seule au bout.'] }),
    P('prop_shelf', 6, 3, { w: 2, script: R.shelf }),
    WALL('prop_clock', 10, 2, -10, { script: R.clock }),
    P('prop_closet', 10, 3, { w: 2, script: R.closet }),
    P('prop_plant', 12, 3, { text: ['Une plante. Elle a soif.', 'Toi aussi, peut-être.'] }),
    P('prop_trash', 12, 7, { text: ['La corbeille déborde de mouchoirs.', 'Et d\'un dessin froissé que tu n\'as pas réussi à jeter.'] }),
    P('prop_photo', 7, 7, { solid: false, script: R.photo }),
  ],
  npcs: [
    {
      id: 'dodo',
      sprite: 'npc_dodo',
      frames: ['npc_dodo', 'npc_dodo_2'],
      frameSpeed: 28,
      x: 3,
      y: 4,
      float: true,
      shadow: false,
      solid: false,
      cond: () => !!G.state.flags.p_dodo && phase() === 0,
      script: R.dodoFloating,
    },
  ],
  warps: [
    { x: 8, y: 2, door: true, to: 'appartement_nuit', spawn: 'noa', cond: () => phase() === 2 },
    { x: 8, y: 2, door: true, to: 'appartement_aube', spawn: 'noa', cond: () => R.isFinale() },
    { x: 8, y: 2, door: true, to: 'appartement', spawn: 'noa', cond: () => phase() === 1, locked: ['Tu poses la main sur la poignée.', 'Tu n\'as pas envie de sortir.'] },
  ],
};

// ---------------------------------------------------------------------------
// The apartment (day / dawn) — hallway with doors, living room, kitchen
// ---------------------------------------------------------------------------

const APPART_TILES = `
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
    TWDWWWDWWWMWWWDWWWDWWWWWwWWWWWwWWT
    TBdBBBdBBBmBBBdBBBdBBBBBBBBBBBBBBT
    TFFFFFFFFFFFFFFFFFFFFFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFFFFFFFFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFCCCCCCFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFCCCCCCFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFCCCCCCFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFFFFFFFFFFFKKKKKKKKT
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
  `;

const appartProps = (night: boolean): PropDef[] => [
  // Entrance
  P('prop_coat', 1, 3, { text: night ? ['Le manteau de Maman n\'est pas là.'] : ['Le portemanteau. Ton blouson. Une petite cape rouge, accrochée tout en bas.'] }),
  P('prop_shoes', 3, 3, { solid: false, text: night ? ['Tes chaussures. Les petites bottes jaunes ne sont plus là.', '… Ont-elles déjà été là ?'] : ['Tes baskets. Les chaussures de Maman. Une paire de petites bottes jaunes, bien rangées.'] }),
  // Hallway
  P('prop_shelf', 7, 3, { w: 2, script: R.familyPhoto }),
  WALL('prop_clock', 12, 2, -10, { script: R.hallClock }),
  WALL('prop_picture', 16, 2, -10, { text: ['Un tableau : une plage, l\'été. Vous y êtes allés une fois, tous les trois.', 'Mina avait ramassé quarante-deux coquillages. Elle les avait comptés.'] }),
  P('prop_plant', 20, 3, { text: night ? ['La plante a perdu toutes ses feuilles.', 'Ce matin, elle en avait encore.'] : ['Une plante verte. Maman l\'arrose quand elle pense à elle.'] }),
  // Living room
  P(night ? 'prop_tv' : 'prop_tv_off', 21, 3, {
    id: 'tv',
    w: 2,
    frames: night ? ['prop_tv', 'prop_tv_2'] : undefined,
    frameSpeed: 6,
    light: night ? TV_GLOW : undefined,
    script: R.tv,
  }),
  P('prop_sofa', 17, 7, { w: 2, script: R.sofa }),
  P('prop_lamp', 15, 7, { light: night ? undefined : { r: 34, color: '#ffe0a0' }, text: night ? 'La lampe ne s\'allume plus.' : 'Le lampadaire du salon. Sa lumière est jaune et douce.' }),
  P('prop_toybox', 22, 8, { text: ['Le coffre à jouets de Mina, rangé dans le salon.', 'Le couvercle est fermé avec du scotch. C\'est toi qui l\'as fermé.'] }),
  // Kitchen
  P('prop_fridge', 26, 3, { script: R.fridge }),
  WALL('prop_drawings', 27, 2, -6, { script: R.kitchenDrawings }),
  P('prop_counter', 27, 3, { w: 2, text: ['Le plan de travail. Une pile d\'assiettes propres. Personne ne mange vraiment, ici.'] }),
  P('prop_sink', 29, 3, { text: ['L\'évier. Le robinet goutte.', 'Plic. Plic. Plic.'] }),
  P('prop_stove', 30, 3, { text: ['La gazinière. Une casserole de pâtes froides.'], script: R.stove }),
  P('prop_counter', 31, 3, { w: 2, text: ['Des factures. Un rendez-vous chez « Dr Lambert » entouré au feutre rouge. C\'était il y a longtemps.'] }),
  P('prop_table', 28, 6, { w: 2, script: R.kitchenTable }),
  P('prop_chair', 27, 6, { text: 'Ta chaise.' }),
  P('prop_chair', 30, 6, { text: ['La chaise de Mina. Il y a encore un coussin dessus.', 'Pour qu\'elle arrive à la table.'] }),
  P('prop_trash', 32, 8, { text: 'La poubelle de la cuisine. Elle sent un peu.' }),
  // Ghost of the hallway (night only): the plush sitting in the corridor
  ...(night
    ? [
        P('prop_dodo_plush_dark', 11, 4, {
          id: 'dodo_corridor',
          solid: false,
          cond: () => !G.state.flags.i2_dodo_gone,
          script: R.corridorDodo,
        }),
      ]
    : []),
];

const APPARTEMENT: MapDef = {
  id: 'appartement',
  name: 'Appartement',
  world: 'real',
  music: 'interlude',
  ambience: 'rain',
  darkness: 0.42,
  playerLight: 50,
  particles: 'dust',
  banner: true,
  tiles: APPART_TILES,
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 6, y: 3, dir: 'down' },
    noa: { x: 6, y: 3, dir: 'down' },
    mina: { x: 10, y: 3, dir: 'down' },
  },
  onEnter: R.appartEnter,
  props: [
    ...appartProps(false),
    DOOR(2, R.frontDoor),
    DOOR(10, R.minaDoor),
    DOOR(14, R.bathroomDoor),
    DOOR(18, R.mamanDoor),
  ],
  warps: [{ x: 6, y: 2, door: true, to: 'chambre', spawn: 'door' }],
};

// The same apartment at night (interlude 2): darker, the TV on by itself, the corridor that won't end.
const APPARTEMENT_NUIT: MapDef = {
  id: 'appartement_nuit',
  name: 'Appartement — 3h33',
  world: 'real',
  music: null,
  ambience: 'hum',
  darkness: 0.86,
  playerLight: 34,
  particles: 'dust',
  banner: true,
  grain: 0.5,
  vignette: 0.75,
  tiles: APPART_TILES.replace('TWDWWWDWWWMWWWDWWWDW', 'TWDWWWDWWWOWWWDWWWDW').replace('TBdBBBdBBBmBBBdBBBdB', 'TBdBBBdBBBoBBBdBBBdB'),
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 6, y: 3, dir: 'down' },
    noa: { x: 6, y: 3, dir: 'down' },
    loop: { x: 9, y: 4, dir: 'left' },
  },
  onEnter: R.appartNuitEnter,
  props: [...appartProps(true), DOOR(2, R.frontDoor), DOOR(14, R.bathroomDoor), DOOR(18, R.mamanDoor)],
  warps: [{ x: 6, y: 2, door: true, to: 'chambre', spawn: 'door' }],
  triggers: [
    { x: 10, y: 2, script: R.minaDoorAjar },
    { x: 18, y: 3, w: 1, h: 6, script: R.tvWakes },
    { x: 4, y: 3, w: 1, h: 6, script: R.corridorLoop },
  ],
};

// The apartment at dawn (finale): lighter, Mina's door ajar.
const APPARTEMENT_AUBE: MapDef = {
  ...APPARTEMENT,
  id: 'appartement_aube',
  name: 'Appartement — aube',
  music: 'room_quiet',
  ambience: 'none',
  darkness: 0.3,
  tiles: APPART_TILES.replace('TWDWWWDWWWMWWWDWWWDW', 'TWDWWWDWWWOWWWDWWWDW').replace('TBdBBBdBBBmBBBdBBBdB', 'TBdBBBdBBBoBBBdBBBdB'),
};

// ---------------------------------------------------------------------------
// Mina's room (finale)
// ---------------------------------------------------------------------------

const CHAMBRE_MINA: MapDef = {
  id: 'chambre_mina',
  name: 'Chambre de Mina',
  world: 'real',
  music: 'room_quiet',
  ambience: 'none',
  darkness: 0.35,
  playerLight: 50,
  particles: 'dust',
  banner: true,
  tiles: `
    TTTTTTTTTTTTT
    TXXXXwXXXXXXT
    TxxxxxxxxxxxT
    TPPPPPPPPPPPT
    TPPPPPPPPPPPT
    TPPPPPPPPPPPT
    TPPPPPPPPPPPT
    TPPPPPPPPPPPT
    TTTTTTPTTTTTT
    TTTTTTPTTTTTT
  `,
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 6, y: 7, dir: 'up' },
    door: { x: 6, y: 7, dir: 'up' },
  },
  onEnter: R.minaRoomEnter,
  props: [
    P('prop_bed_mina', 1, 3, { h: 2, text: ['Le lit de Mina. La couette à étoiles est tirée bien droite.', 'Quelqu\'un l\'a faite. Maman, sûrement. Il y a un an.'] }),
    WALL('prop_drawings', 3, 2, -6, { script: R.minaDrawings }),
    WALL('prop_poster', 8, 2, -4, { text: ['Un poster de licorne, scotché un peu de travers.', '« LES LICORNES C\'EST VRAI » est écrit en dessous, au crayon violet.'] }),
    P('prop_toybox', 10, 3, { text: ['Son coffre à jouets. Une couronne en papier dépasse.', 'Elle est toute écrasée.'] }),
    P('prop_desk', 7, 3, { w: 2, text: ['Son petit bureau. Des crayons de cire. Un taille-crayon en forme de cochon.'] }),
    ON('prop_carnet', 7, 3, -14, { id: 'carnet', light: { r: 30, color: '#fff3cf', dy: -14 }, script: R.carnet }),
    P('prop_veilleuse_off', 11, 7, { solid: false, script: R.minaNightlight }),
    P('prop_plant', 11, 3, { text: 'Une petite plante grasse dans un pot peint à la main. Elle a survécu. Toute seule.' }),
  ],
  warps: [{ x: 6, y: 9, to: 'appartement_aube', spawn: 'mina' }],
};

export const REAL_MAPS: Record<string, MapDef> = {
  chambre: CHAMBRE,
  appartement: APPARTEMENT,
  appartement_nuit: APPARTEMENT_NUIT,
  appartement_aube: APPARTEMENT_AUBE,
  chambre_mina: CHAMBRE_MINA,
};

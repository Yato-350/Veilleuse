import type { MapDef, PropDef, Script } from '../../game/overworld/types';
import { G } from '../../game/state';
import * as R from '../../game/story/real';
import * as N from '../../game/story/real-nuit';

/*
 * Real world: Noa's apartment. The same rooms are revisited at different moments of the story
 * (prologue, interlude 1, interlude 2, finale); objects read G.state.flags.interlude to change.
 * Version 2: during the night interludes III (4:06) and IV (4:44) the bedroom shows its night props instead
 * (story/real-nuit.ts), the hallway is `appartement_tard` and Maman's room (`chambre_maman`) opens.
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
const ON = (sprite: string, x: number, y: number, oy: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });

/** An invisible interactable on a door tile of the top wall. */
const DOOR = (x: number, script: PropDef['script']): PropDef => ({ sprite: '', x, y: 2, script });

const NIGHTLIGHT = { r: 52, color: '#ffe991', flicker: true, dy: -10 };
const TV_GLOW = { r: 60, color: '#c8d8ff', flicker: true, dy: -14 };

const phase = (): number => Number(G.state.flags.interlude ?? 0);
const nuit = N.isNuit;
const iv = (): boolean => phase() === R.REAL.i4;
const flag = (k: string) => (): boolean => !!G.state.flags[k];
/** The finale: the nightlight is cracked (chapter 4, the Little Man beaten) / unplugged and carried to Mina's room. */
const finaleFele = (): boolean => R.isFinale() && !!G.state.flags.c4_fele;
const finaleTaken = (): boolean => R.isFinale() && !!G.state.flags.fin_veilleuse_prise;

/** Props of a room as it is by day (and in the other moments): hidden during the night interludes. */
const DAY = (props: PropDef[]): PropDef[] => props.map((p) => ({ ...p, cond: () => !nuit() && (!p.cond || p.cond()) }));
/** Props shown only during the night interludes III and IV. */
const NIGHT = (props: PropDef[]): PropDef[] => props.map((p) => ({ ...p, cond: () => nuit() && (!p.cond || p.cond()) }));
const byNight =
  (day: Script, night: Script): Script =>
  (d) =>
    nuit() ? night(d) : day(d);
/** An invisible interactable on a door tile of the top wall, with an id (bot scenarios). */
const DOOR_AT = (id: string, x: number, script: Script): PropDef => ({ id, sprite: '', x, y: 2, script });

/**
 * Dodo sitting on the bed. His footprint is the right half of the bed's lower tile (the sprite is shifted back over
 * the bed): from the side of the bed the player reaches Dodo, from below the bed itself.
 */
const PLUSH = (sprite: string, oy: number, o: Partial<PropDef>): PropDef => ON(sprite, 1.5, 4, oy, { id: 'dodo_plush', w: 0.5, ox: -4, ...o });
/**
 * The wall the bed is pushed against: the wall tiles above the bed cannot be faced (bed and nightstand stand in
 * front of them), so the wall answers on the left side of the room, at the foot of the bed.
 */
const BED_WALL = (id: string, script: Script): PropDef => ({ id, sprite: '', x: 0, y: 5, script });

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

/** The bedroom at 4:06 and 4:44 (Interludes III and IV): same furniture, other objects, other words. */
function chambreNuit(): PropDef[] {
  const notIV = (): boolean => !iv();
  const COTTON = (sprite: string, x: number, y: number, n: number): PropDef => P(sprite, x, y, { id: `n_coton_${n}`, solid: false, script: N.cotton, cond: iv });
  return [
    P('prop_bed', 1, 3, { id: 'bed', h: 2, script: N.bed }),
    P('prop_nightstand', 2, 3, { id: 'n_chevet', script: N.nightlight }),
    ON('prop_veilleuse', 2, 3, -9, { id: 'veilleuse', light: NIGHTLIGHT, script: N.nightlight, cond: () => !(iv() && G.state.flags.c4_fele) }),
    ON('prop_veilleuse_fele', 2, 3, -9, { id: 'veilleuse', light: NIGHTLIGHT, script: N.nightlight, cond: () => iv() && !!G.state.flags.c4_fele }),
    PLUSH('prop_dodo_plush', -5, { script: N.dodo, cond: notIV }),
    PLUSH('prop_dodo_plush_decousu', -5, { script: N.dodo, cond: iv }),
    WALL('prop_mur_use', 1, 2, -3, { script: N.wall }),
    BED_WALL('n_mur', N.wall),
    WALL('prop_calendar', 12, 2, -8, { id: 'n_calendrier', script: N.calendar }),
    P('prop_desk', 3, 3, { id: 'n_bureau', w: 2, script: N.desk, cond: notIV }),
    P('prop_desk_tiroir', 3, 3, { id: 'n_bureau', w: 2, script: N.desk, cond: iv }),
    ON('prop_phone', 4, 3, -12, { id: 'phone', frames: ['prop_phone', 'prop_phone_2'], frameSpeed: 30, script: N.phone, cond: notIV }),
    ON('prop_phone', 4, 3, -12, { id: 'phone', script: N.phone, cond: iv }),
    P('prop_chair', 4, 4, { id: 'n_chaise', solid: false, script: N.chair }),
    ON('prop_casque', 4, 4, -9, { id: 'n_casque', script: N.chair }),
    WALL('prop_poster', 5, 2, -4, { id: 'n_poster', script: N.poster }),
    P('prop_shelf', 6, 3, { id: 'n_etagere', w: 2, script: N.shelf }),
    DOOR_AT('n_porte', 8, N.chambreDoor),
    P('t_r_door_open_top', 8, 1, { solid: false, under: true, cond: () => iv() || !!G.state.flags.i3_porte }),
    P('t_r_door_open', 8, 2, { solid: false, under: true, cond: () => iv() || !!G.state.flags.i3_porte }),
    P('prop_radiateur', 9, 3, { id: 'n_radiateur', script: N.radiator }),
    WALL('prop_clock', 10, 2, -10, { id: 'n_horloge', script: N.clock }),
    P('prop_closet', 10, 3, { id: 'n_armoire', w: 2, script: N.closet, cond: notIV }),
    P('prop_closet_open', 10, 3, { id: 'n_armoire', w: 2, script: N.closet, cond: iv }),
    P('prop_plant', 12, 4, { id: 'n_plante', script: N.plant }),
    P('prop_trash', 12, 7, { id: 'n_corbeille', script: N.trash }),
    P('prop_photo', 7, 7, { id: 'n_photo', solid: false, script: N.photo }),
    // Interlude IV: what fell out of the open wardrobe, and the trail of stuffing from the bed to it.
    P('prop_boite_chaussures', 10, 4, { id: 'n_boite_mots', solid: false, script: N.shoebox, cond: iv }),
    P('prop_boite_veilleuse', 11, 4, { id: 'n_boite_veilleuse', solid: false, script: N.nightlightBox, cond: iv }),
    P('prop_thermometre', 12, 5, { id: 'n_thermometre', solid: false, script: N.thermometer, cond: iv }),
    COTTON('prop_coton', 3, 5, 1),
    COTTON('prop_coton_2', 5, 6, 2),
    COTTON('prop_coton', 6, 5, 3),
    COTTON('prop_coton_2', 8, 5, 4),
    COTTON('prop_coton', 9, 4, 5),
  ];
}

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
  onEnter: byNight(R.chambreEnter, N.chambreEnter),
  props: [
    ...DAY([
    P('prop_bed', 1, 3, { id: 'bed', h: 2, script: R.bed }),
    P('prop_nightstand', 2, 3, { script: R.nightlight }),
    // The finale: cracked if the Little Man was beaten (chapter 4), gone once Noa has unplugged it to carry it to her.
    ON('prop_veilleuse', 2, 3, -9, { id: 'veilleuse', light: NIGHTLIGHT, script: R.nightlight, cond: () => !finaleFele() && !finaleTaken() }),
    ON('prop_veilleuse_fele', 2, 3, -9, { id: 'veilleuse', light: NIGHTLIGHT, script: R.nightlight, cond: () => finaleFele() && !finaleTaken() }),
    // Interlude I: Dodo is not where he was left (at the foot of the bed, facing the door) until Noa puts him back.
    // The finale: Noa takes him under his arm on waking.
    PLUSH('prop_dodo_plush', -5, {
      script: R.plush,
      cond: () =>
        phase() === 0
          ? !G.state.flags.p_dodo
          : phase() === 2
            ? !!G.state.flags.i2_dodo_back
            : phase() === 1
              ? !!G.state.flags.i1_dodo_remis
              : !(R.isFinale() && G.state.flags.fin_dodo),
    }),
    PLUSH('prop_dodo_plush', 2, { script: R.plush, cond: () => phase() === 1 && !G.state.flags.i1_dodo_remis }),
    WALL('prop_mur_use', 1, 2, -3, { script: R.wall }),
    // The prologue without Dodo: what he used to say is one of Mina's treasure-hunt drawings, above the bed.
    WALL('prop_dessin_chasse', 1, 2, -15, { id: 'dessin_chasse', script: R.huntDrawing, cond: () => phase() === 0 && G.meta.dodoSilent }),
    BED_WALL('mur', R.wall),
    WALL('prop_calendar', 12, 2, -8, { id: 'calendrier', script: R.calendar }),
    P('prop_desk', 3, 3, { id: 'bureau', w: 2, script: R.desk }),
    ON('prop_casque', 3, 3, -14, { ox: 6 }),
    ON('prop_phone', 4, 3, -12, { id: 'phone', frames: ['prop_phone', 'prop_phone_2'], frameSpeed: 30, script: R.phone }),
    P('prop_chair', 4, 4, { solid: false, text: 'Ta chaise. Ton sweat est roulé en boule dessus.' }),
    WALL('prop_poster', 5, 2, -4, { text: ['Un poster du système solaire.', 'Mina disait que Pluton était triste d\'être toute seule au bout.'] }),
    P('prop_shelf', 6, 3, { w: 2, script: R.shelf }),
    WALL('prop_clock', 10, 2, -10, { script: R.clock }),
    P('prop_closet', 10, 3, { id: 'armoire', w: 2, script: R.closet }),
    P('prop_plant', 12, 4, { text: ['Une plante. Elle a soif.', 'Toi aussi, peut-être.'] }),
    P('prop_trash', 12, 7, { text: ['La corbeille déborde de mouchoirs.', 'Et d\'un dessin froissé que tu n\'as pas réussi à jeter.'] }),
    P('prop_photo', 7, 7, { id: 'photo', solid: false, script: R.photo }),
    ]),
    ...NIGHT(chambreNuit()),
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
  P('prop_shelf', 7, 3, { id: 'a_etagere', w: 2, script: R.familyPhoto }),
  WALL('prop_photo_bebe', 9, 2, -8, { id: 'a_photo_bebe', script: R.babyPhoto }),
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
  P('prop_fridge', 26, 3, { id: 'a_frigo', script: R.fridge }),
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
    DOOR_AT('a_porte_mina', 10, R.minaDoor),
    DOOR_AT('a_sdb', 14, R.bathroomDoor),
    DOOR_AT('a_porte_maman', 18, R.mamanDoor),
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
  props: [...appartProps(true), DOOR(2, R.frontDoor), DOOR_AT('a_sdb', 14, R.bathroomDoor), DOOR_AT('a_porte_maman', 18, R.mamanDoor)],
  warps: [{ x: 6, y: 2, door: true, to: 'chambre', spawn: 'door' }],
  triggers: [
    { x: 10, y: 2, script: R.minaDoorAjar },
    { x: 18, y: 3, w: 1, h: 6, script: R.tvWakes },
    { x: 4, y: 3, w: 1, h: 6, script: R.corridorLoop },
  ],
};

// The apartment at dawn (finale): lighter. Mina's door stays locked until Noa knocks and turns the key (fin_porte).
const APPARTEMENT_AUBE: MapDef = {
  ...APPARTEMENT,
  id: 'appartement_aube',
  name: 'Appartement — aube',
  music: 'room_quiet',
  ambience: 'none',
  darkness: 0.3,
  props: [
    ...(APPARTEMENT.props ?? []),
    P('t_r_door_open_top', 10, 1, { id: 'a_porte_mina_h', solid: false, under: true, cond: flag('fin_porte') }),
    P('t_r_door_open', 10, 2, { id: 'a_porte_mina_b', solid: false, under: true, cond: flag('fin_porte') }),
  ],
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
  // Version 2 (docs/HISTOIRE.md § 3.15): the beanie on the pillow, the wall worn at pillow height, the radiator pipe,
  // the empty nightstand where Noa plugs in the nightlight he carried from his room, Dodo on the windowsill.
  props: [
    // The beanie lies on the pillow (sprite prop_bed_mina_bonnet).
    P('prop_bed_mina_bonnet', 1, 3, { id: 'f_lit', h: 2, script: R.minaBed }),
    WALL('prop_mur_use_mina', 1, 2, -3),
    // The worn wall answers at the foot of the bed, like the one in Noa's room.
    { id: 'f_mur', sprite: '', x: 0, y: 5, script: R.minaWall },
    P('prop_nightstand', 2, 3, { id: 'f_chevet', script: R.minaNightlight }),
    ON('prop_veilleuse', 2, 3, -9, { id: 'f_veilleuse', light: NIGHTLIGHT, script: R.minaNightlight, cond: () => !!G.state.flags.fin_plugged && !G.state.flags.c4_fele }),
    ON('prop_veilleuse_fele', 2, 3, -9, { id: 'f_veilleuse', light: NIGHTLIGHT, script: R.minaNightlight, cond: () => !!G.state.flags.fin_plugged && !!G.state.flags.c4_fele }),
    WALL('prop_drawings', 3, 2, -6, { script: R.minaDrawings }),
    P('prop_radiateur', 5, 3, { id: 'f_radiateur', script: R.minaRadiator }),
    ON('prop_dodo_plush', 5, 2, -17, { id: 'f_dodo', cond: () => !!G.state.flags.fin_room && !!G.state.flags.fin_dodo }),
    WALL('prop_poster', 8, 2, -4, { text: ['Un poster de licorne, scotché un peu de travers.', '« LES LICORNES C\'EST VRAI » est écrit en dessous, au crayon violet.'] }),
    P('prop_toybox', 10, 3, { text: ['Son coffre à jouets. Une couronne en papier dépasse.', 'Elle est toute écrasée.'] }),
    P('prop_desk', 7, 3, { w: 2, text: ['Son petit bureau. Des crayons de cire. Un taille-crayon en forme de cochon.'] }),
    ON('prop_carnet', 7, 3, -14, { id: 'carnet', light: { r: 30, color: '#fff3cf', dy: -14 }, script: R.carnet }),
    P('prop_plant', 11, 3, { text: 'Une petite plante grasse dans un pot peint à la main. Elle a survécu. Toute seule.' }),
  ],
  warps: [{ x: 6, y: 9, to: 'appartement_aube', spawn: 'mina' }],
};

// ---------------------------------------------------------------------------
// The night interludes: the hallway at 4:06 / 4:44, and Maman's room
// ---------------------------------------------------------------------------

/** The apartment at 4 in the morning: quiet, the right length, the hall cupboard ajar (III), Maman's door ajar (IV). */
const APPARTEMENT_TARD: MapDef = {
  id: 'appartement_tard',
  get name(): string {
    return iv() ? 'Appartement — 4h44' : 'Appartement — 4h06';
  },
  world: 'real',
  music: null,
  ambience: 'hum',
  darkness: 0.72,
  playerLight: 46,
  particles: 'dust',
  banner: true,
  grain: 0.35,
  vignette: 0.6,
  tiles: APPART_TILES,
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 6, y: 3, dir: 'down' },
    noa: { x: 6, y: 3, dir: 'down' },
    maman: { x: 18, y: 3, dir: 'down' },
    placard: { x: 4, y: 5, dir: 'up' },
  },
  onEnter: N.appartEnter,
  props: [
    // Entrance
    P('prop_coat', 1, 3, { id: 't_manteau', script: N.coat }),
    P('prop_shoes', 2, 4, { id: 't_chaussures', solid: false, script: N.shoes }),
    DOOR_AT('t_entree', 2, N.frontDoor),
    P('prop_placard_entree_ouvert', 3, 3, { id: 't_placard', w: 2, script: N.hallCupboard, cond: () => !iv() }),
    P('prop_placard_entree', 3, 3, { id: 't_placard', w: 2, script: N.hallCupboard, cond: iv }),
    P('prop_sac_hopital_ouvert', 4, 4, { id: 'sac', solid: false, script: N.bag, cond: () => !iv() && flag('i3_sac_ouvert')() && !G.state.flags.i3_sac }),
    // Hallway
    P('prop_shelf', 7, 3, { id: 't_etagere', w: 2, script: N.familyPhoto }),
    WALL('prop_photo_bebe', 9, 2, -8, { id: 't_photo_bebe', script: N.babyPhoto }),
    DOOR_AT('t_porte_mina', 10, N.minaDoor),
    WALL('prop_clock', 12, 2, -10, { id: 't_horloge', script: N.hallClock }),
    DOOR_AT('t_sdb', 14, N.bathroomDoor),
    WALL('prop_picture', 16, 2, -10, { id: 't_plage', script: N.beachPicture }),
    DOOR_AT('t_porte_maman', 18, N.mamanDoor),
    P('t_r_door_open_top', 18, 1, { solid: false, under: true, cond: iv }),
    P('t_r_door_open', 18, 2, { solid: false, under: true, cond: iv }),
    P('prop_plant', 20, 3, { id: 't_plante', script: N.hallPlant }),
    // Living room
    P('prop_tv_off', 21, 3, { id: 't_tele', w: 2, script: N.tv }),
    P('prop_sofa', 17, 7, { id: 't_canape', w: 2, script: N.sofa }),
    P('prop_lamp', 15, 7, { id: 't_lampe', script: N.lamp }),
    P('prop_toybox', 22, 8, { id: 't_coffre', script: N.toybox }),
    // Kitchen
    P('prop_fridge', 26, 3, { id: 't_frigo', script: N.fridge }),
    WALL('prop_drawings', 27, 2, -6, { id: 't_dessins', script: N.kitchenDrawings }),
    P('prop_counter', 27, 3, { id: 't_plan', w: 2, script: N.counter }),
    P('prop_sink', 29, 3, { id: 't_evier', script: N.sink }),
    P('prop_stove', 30, 3, { id: 'gaziniere', script: N.stove }),
    P('prop_counter', 31, 3, { id: 't_factures', w: 2, script: N.bills }),
    P('prop_table', 28, 6, { id: 't_table', w: 2, script: N.kitchenTable }),
    P('prop_chair', 27, 6, { id: 't_chaise_noa', script: N.kitchenChair }),
    P('prop_chair', 30, 6, { id: 't_chaise_mina', script: N.minaChair }),
    P('prop_trash', 32, 8, { id: 't_poubelle', script: N.kitchenTrash }),
  ],
  warps: [{ x: 6, y: 2, door: true, to: 'chambre', spawn: 'door' }],
};

/** Maman's room (Interlude IV): the bed unmade, the old alarm clock and its post-it, the drawing on the mirror. */
const CHAMBRE_MAMAN: MapDef = {
  id: 'chambre_maman',
  name: 'Chambre de Maman',
  world: 'real',
  music: null,
  ambience: 'none',
  darkness: 0.64,
  playerLight: 48,
  particles: 'dust',
  banner: true,
  grain: 0.3,
  vignette: 0.55,
  tiles: `
    TTTTTTTTTTTTT
    TWWWWWWWWWWwT
    TBBBBBBBBBBBT
    TFFFFFFFFFFFT
    TFCCCCCCCCCFT
    TFCCCCCCCCCFT
    TFFFFFFFFFFFT
    TTTTTTFTTTTTT
    TTTTTTFTTTTTT
  `,
  legend: REAL_LEGEND,
  spawns: {
    default: { x: 6, y: 6, dir: 'up' },
    door: { x: 6, y: 6, dir: 'up' },
  },
  onEnter: N.mamanRoomEnter,
  props: [
    P('prop_nightstand', 1, 3, { id: 'm_chevet_g', script: N.mamanPhoto }),
    ON('prop_photo', 1, 3, -11, { id: 'm_photo', script: N.mamanPhoto }),
    P('prop_lit_maman', 2, 3, { id: 'm_lit', w: 2, h: 2, script: N.mamanBed }),
    P('prop_nightstand', 4, 3, { id: 'm_chevet', script: N.alarmClock }),
    ON('prop_reveil_vieux', 4, 3, -9, {
      id: 'reveil',
      ox: -3,
      frames: ['prop_reveil_vieux', 'prop_reveil_vieux_2'],
      frameSpeed: 30,
      light: { r: 16, color: '#d8ffe0', dy: -6 },
      script: N.alarmClock,
      cond: () => !G.state.flags.i4_pile,
    }),
    ON('prop_reveil_vieux', 4, 3, -9, { id: 'reveil', ox: -3, script: N.alarmClock, cond: flag('i4_pile') }),
    ON('prop_postit', 4, 3, -8, { id: 'm_postit', ox: 4, script: N.alarmClock }),
    WALL('prop_calendar', 5, 2, -8, { id: 'm_planning', script: N.planning }),
    P('prop_commode', 6, 3, { id: 'm_commode', w: 2, script: N.dresser }),
    ON('prop_boite_couture', 6, 3, -17, { id: 'm_couture', script: N.sewingBox }),
    ON('prop_kit_vocal', 7, 3, -17, { id: 'm_kit', script: N.voiceKit }),
    WALL('prop_miroir_dessin', 8, 2, -2, { id: 'm_miroir', script: N.mirror }),
    P('prop_chair', 9, 3, { id: 'm_chaise', script: N.blouse }),
    P('prop_nightstand', 10, 3, { id: 'm_table', script: N.teethBox }),
    ON('prop_boite_dents', 10, 3, -10, { id: 'm_dents', script: N.teethBox }),
    { ...DOOR_AT('m_volets', 11, N.mamanWindow), light: { r: 30, color: '#ffb070', dy: -10 } },
    P('prop_panier', 11, 5, { id: 'm_panier', script: N.laundry }),
    P('prop_lamp', 1, 5, { id: 'm_liseuse', script: N.mamanLamp }),
    P('prop_shoes', 4, 5, { id: 'm_chaussures', solid: false, script: N.mamanShoes }),
  ],
  warps: [{ x: 6, y: 8, to: 'appartement_tard', spawn: 'maman' }],
};

export const REAL_MAPS: Record<string, MapDef> = {
  chambre: CHAMBRE,
  appartement: APPARTEMENT,
  appartement_nuit: APPARTEMENT_NUIT,
  appartement_aube: APPARTEMENT_AUBE,
  chambre_mina: CHAMBRE_MINA,
  appartement_tard: APPARTEMENT_TARD,
  chambre_maman: CHAMBRE_MAMAN,
};

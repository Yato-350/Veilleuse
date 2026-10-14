import type { MapDef, PropDef, Script } from '../../game/overworld/types';
import { G } from '../../game/state';
import * as FA from '../../game/story/fausse-aube';

/*
 * La fausse aube (docs/HISTOIRE.md § 3.9): the bedroom and the apartment of the real world, in their `faux` variant —
 * the same rooms, too beautiful (world `faux`: oversaturated; warm tiles `fa_*`, src/data/sprites/fausse-aube.ts).
 *   chambre_faux      Noa's bedroom at « 6:00 ». The window has moved onto the wardrobe's wall (the wardrobe is gone),
 *                     a crayon sun rises in it; where the windows were, the wallpaper is paler. The nightlight is
 *                     unplugged, its cord wound tight. Dodo looks at the door.
 *   appartement_faux  the hallway, the living room and the kitchen. Mina's door is not there: wallpaper, warm to the
 *                     touch. Three hooks on the coat rack, two pairs of shoes, two chairs, two bowls. The same sun in
 *                     every window. Maman waits in the kitchen, smiling (story/fausse-aube.ts).
 * Both maps replay the false dawn from the white when a save is loaded on them (FA.enter).
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
/** Hung on the wall: lifted, never solid. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** Standing on a piece of furniture. */
const ON = (sprite: string, x: number, y: number, oy: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** An invisible interactable on a tile of the top wall (doors, a bare piece of wall). */
const SPOT = (id: string, x: number, script: Script): PropDef => ({ id, sprite: '', x, y: 2, script });

/** Warm morning light through the windows. */
const SUN = { r: 96, color: '#ffd27a', flicker: false, dy: -14 };
const SUN_SMALL = { r: 64, color: '#ffd27a', flicker: false, dy: -12 };

const FA_LEGEND = {
  T: 'fa_wall_top',
  W: 'fa_wall',
  B: 'fa_wall_base',
  V: 'r_void',
  F: 'fa_floor',
  C: 'fa_carpet',
  K: 'fa_tile',
  D: 'fa_door_top',
  d: 'fa_door',
};

// ---------------------------------------------------------------------------------------------------------------------
// The bedroom
// ---------------------------------------------------------------------------------------------------------------------

const CHAMBRE_FAUX: MapDef = {
  id: 'chambre_faux',
  name: 'Chambre de Noa',
  world: 'faux',
  music: null,
  ambience: 'none',
  darkness: 0.1,
  playerLight: 0,
  particles: 'dust',
  bg: '#fff3dc',
  banner: false,
  vignette: 0.2,
  grain: 0.12,
  tiles: `
    TTTTTTTTTTTTTT
    TWWWWWWWDWWWWT
    TBBBBBBBdBBBBT
    TFFFFFFFFFFFFT
    TFFCCCCCCCCFFT
    TFFCCCCCCCCFFT
    TFFCCCCCCCCFFT
    TFFFFFFFFFFFFT
    TTTTTTTTTTTTTT
  `,
  legend: FA_LEGEND,
  spawns: {
    default: { x: 2, y: 5, dir: 'up' },
    bed: { x: 2, y: 5, dir: 'up' },
    door: { x: 8, y: 3, dir: 'down' },
  },
  onEnter: FA.chambreEnter,
  props: [
    P('prop_bed', 1, 3, { id: 'bed', h: 2, script: FA.bed }),
    P('prop_nightstand', 2, 3, { id: 'fa_chevet', script: FA.nightlight }),
    ON('prop_veilleuse_off', 2, 3, -9, { id: 'fa_veilleuse', script: FA.nightlight }),
    ON('prop_dodo_plush', 1, 4, -5, { id: 'fa_dodo', script: FA.dodo }),
    WALL('prop_calendar', 2, 2, -8, { id: 'fa_calendrier', script: FA.calendar }),
    WALL('prop_fa_mur_clair', 3, 1, 2, { id: 'fa_mur_clair', script: FA.paleWall }),
    P('prop_desk', 3, 3, { id: 'fa_bureau', w: 2, script: FA.desk }),
    ON('prop_phone', 4, 3, -12, { id: 'fa_telephone', script: FA.phone }),
    P('prop_chair', 4, 4, { id: 'fa_chaise', solid: false, script: FA.chair }),
    WALL('prop_poster', 5, 2, -4, { id: 'fa_poster', script: FA.poster }),
    P('prop_shelf', 6, 3, { id: 'fa_etagere', w: 2, script: FA.shelf }),
    P('prop_radiateur', 9, 3, { id: 'fa_radiateur', script: FA.radiator }),
    WALL('prop_clock', 7, 2, -10, { id: 'fa_horloge', script: FA.clock }),
    WALL('prop_fa_fenetre', 10, 2, -2, { id: 'fa_fenetre', w: 2, light: SUN, script: FA.bigWindow }),
    P('prop_plant', 12, 3, { id: 'fa_plante', script: FA.plant }),
    P('prop_trash', 12, 7, { id: 'fa_corbeille', script: FA.trash }),
    P('prop_photo', 7, 7, { id: 'fa_photo', solid: false, script: FA.photo }),
  ],
  warps: [{ x: 8, y: 2, door: true, to: 'appartement_faux', spawn: 'noa' }],
};

// ---------------------------------------------------------------------------------------------------------------------
// The apartment
// ---------------------------------------------------------------------------------------------------------------------

/** The real apartment's layout (story/real.ts), Mina's door bricked into the wallpaper, the windows hung as props. */
const APPART_FAUX_TILES = `
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
    TWDWWWDWWWWWWWDWWWDWWWWWWWWWWWWWWT
    TBdBBBdBBBBBBBdBBBdBBBBBBBBBBBBBBT
    TFFFFFFFFFFFFFFFFFFFFFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFFFFFFFFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFCCCCCCFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFCCCCCCFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFCCCCCCFFFFKKKKKKKKT
    TFFFFFFFFFFFFFFFFFFFFFFFFKKKKKKKKT
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
  `;

const APPARTEMENT_FAUX: MapDef = {
  id: 'appartement_faux',
  name: 'Appartement',
  world: 'faux',
  music: null,
  ambience: 'none',
  darkness: 0.1,
  playerLight: 0,
  particles: 'dust',
  bg: '#fff3dc',
  banner: false,
  vignette: 0.2,
  grain: 0.12,
  tiles: APPART_FAUX_TILES,
  legend: FA_LEGEND,
  spawns: {
    default: { x: 6, y: 3, dir: 'down' },
    noa: { x: 6, y: 3, dir: 'down' },
    cuisine: { x: 27, y: 5, dir: 'right' },
  },
  onEnter: FA.appartEnter,
  props: [
    // Entrance
    P('prop_coat', 1, 3, { id: 'fa_portemanteau', script: FA.coat }),
    P('prop_shoes', 3, 3, { id: 'fa_chaussures', solid: false, script: FA.shoes }),
    SPOT('fa_porte_entree', 2, FA.frontDoor),
    // Hallway
    P('prop_shelf', 7, 3, { id: 'fa_photo_famille', w: 2, script: FA.familyPhoto }),
    SPOT('fa_mur_mina', 10, FA.minaWall),
    WALL('prop_clock', 12, 2, -10, { id: 'fa_horloge_couloir', script: FA.hallClock }),
    SPOT('fa_porte_bain', 14, FA.bathroomDoor),
    WALL('prop_picture', 16, 2, -10, { id: 'fa_tableau', script: FA.beachPicture }),
    SPOT('fa_porte_maman', 18, FA.mamanDoor),
    P('prop_plant', 20, 3, { id: 'fa_plante_couloir', script: FA.hallPlant }),
    // Living room
    P('prop_tv', 21, 3, { id: 'fa_tele', w: 2, frames: ['prop_tv', 'prop_tv_2'], frameSpeed: 6, light: { r: 40, color: '#fff3cf', flicker: true, dy: -14 }, script: FA.tv }),
    WALL('prop_fa_fenetre_petite', 24, 2, -2, { id: 'fa_fenetre_salon', light: SUN_SMALL, script: FA.smallWindow }),
    P('prop_sofa', 17, 7, { id: 'fa_canape', w: 2, script: FA.sofa }),
    P('prop_lamp', 15, 7, { id: 'fa_lampe', light: { r: 34, color: '#ffe0a0' }, script: FA.lamp }),
    P('prop_fa_sol_clair', 22, 8, { id: 'fa_sol_clair', solid: false, under: true, script: FA.paleFloor }),
    // Kitchen
    P('prop_fridge', 26, 3, { id: 'fa_frigo', script: FA.fridge }),
    WALL('prop_fa_soleils', 27, 2, -8, { id: 'fa_dessins', w: 2, script: FA.drawings }),
    P('prop_counter', 27, 3, { id: 'fa_plan', w: 2, script: FA.counter }),
    P('prop_sink', 29, 3, { id: 'fa_evier', script: FA.sink }),
    WALL('prop_fa_fenetre_petite', 30, 2, -2, { id: 'fa_fenetre_cuisine', light: SUN_SMALL, script: FA.smallWindow }),
    P('prop_stove', 30, 3, { id: 'fa_gaziniere', script: FA.stove }),
    P('prop_counter', 31, 3, { id: 'fa_factures', w: 2, script: FA.bills }),
    P('prop_table', 28, 6, { id: 'fa_table', w: 2, script: FA.table }),
    P('prop_chair', 27, 6, { id: 'fa_chaise_noa', script: FA.kitchenChair }),
    P('prop_trash', 32, 8, { id: 'fa_poubelle', script: FA.kitchenTrash }),
  ],
  npcs: [
    { id: 'maman', sprite: 'pose_fa_maman', x: 30, y: 5, solid: true, cond: () => FA.mamanInKitchen() && !G.state.flags.fa_bras, script: FA.mamanKitchen },
    { id: 'maman', sprite: 'pose_fa_maman_bras', x: 30, y: 5, solid: true, cond: () => FA.mamanInKitchen() && !!G.state.flags.fa_bras, script: FA.mamanKitchen },
  ],
  warps: [{ x: 6, y: 2, door: true, to: 'chambre_faux', spawn: 'door' }],
};

export const FAUSSE_AUBE_MAPS: Record<string, MapDef> = {
  chambre_faux: CHAMBRE_FAUX,
  appartement_faux: APPARTEMENT_FAUX,
};

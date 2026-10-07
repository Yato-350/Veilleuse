import type { TileDef } from '../game/overworld/types';
import { PAL } from '../engine/palette';
import { DEV_TILES } from './tiles-dev';

/** `t_<id>_1 … t_<id>_n` (variants picked per position, or animation frames). */
const v = (id: string, n: number): string[] => Array.from({ length: n }, (_, i) => `t_${id}_${i + 1}`);

/** Organic borders (see TileDef.edge): tiles of the same group never spill onto each other. */
const GRASS_EDGE = { color: PAL.L!, dark: PAL.e!, group: 'grass' };
const HEDGE_EDGE = { color: PAL.e!, dark: PAL.E!, group: 'hedge' };
const CRAYON_EDGE = { color: PAL.L!, dark: PAL.e!, group: 'crayon' };
const ERASED_EDGE = { color: PAL.f!, dark: PAL.W!, group: 'erased' };
const INK_EDGE = { color: PAL.i!, dark: PAL.K!, group: 'ink' };
// Groups starting with 'a_' lose against edged walkable neighbours (grass…): only those spill onto them.
const INK_POND_EDGE = { color: PAL.n!, dark: PAL.B!, group: 'a_ink_pond' };
const VOID_EDGE = { color: '#000000', dark: PAL.i!, group: 'v_edge' };
const LIGHT_EDGE = { color: PAL.f!, dark: PAL.q!, group: 'v_white' };

/** Tile registry: id → definition. Art keys refer to sprites in src/data/sprites/tiles.ts. */
export const TILES: Record<string, TileDef> = {
  ...DEV_TILES,

  // --- Real world (night tones, authored dark) ------------------------------
  r_floor: { art: v('r_floor', 3), surface: 'wood' },
  r_carpet: { art: v('r_carpet', 2), surface: 'carpet' },
  r_tile: { art: v('r_tile', 2), surface: 'stone' },
  r_wall: { art: 't_r_wall', solid: true },
  r_wall_base: { art: 't_r_wall_base', solid: true },
  r_wall_top: { art: v('r_wall_top', 2), solid: true },
  r_void: { art: 't_r_void', solid: true },
  r_window: { art: 't_r_window_1', anim: v('r_window', 3), animSpeed: 9, solid: true },
  r_door_top: { art: 't_r_door_top', solid: true },
  r_door: { art: 't_r_door', solid: true },
  r_door_mina_top: { art: 't_r_door_mina_top', solid: true },
  r_door_mina: { art: 't_r_door_mina', solid: true },
  r_door_open_top: { art: 't_r_door_open_top', surface: 'wood' },
  r_door_open: { art: 't_r_door_open', surface: 'wood' },
  r_wall_mina: { art: 't_r_wall_mina', solid: true },
  r_wall_mina_base: { art: 't_r_wall_mina_base', solid: true },
  r_floor_mina: { art: v('r_floor_mina', 2), surface: 'carpet' },

  // --- Dream: Cotton Country --------------------------------------------------
  grass: { art: v('grass', 4), edge: GRASS_EDGE, surface: 'grass' },
  grass_flowers: { art: v('grass_flowers', 3), edge: GRASS_EDGE, surface: 'grass' },
  path: { art: v('path', 3), surface: 'stone' },
  cotton: { art: v('cotton', 3), surface: 'carpet' },
  water: { art: 't_water_1', anim: v('water', 3), animSpeed: 26, solid: true, surface: 'water' },
  bridge: { art: v('bridge', 2), surface: 'wood' },
  hedge: { art: v('hedge', 2), solid: true, edge: HEDGE_EDGE },
  cotton_wall: { art: v('cotton_wall', 2), solid: true },
  fence: { art: 't_fence', under: 'grass', solid: true },
  plank: { art: v('plank', 3), surface: 'wood' },
  rug: { art: v('rug', 2), surface: 'carpet' },
  wall_d: { art: 't_wall_d', solid: true },
  wall_d_top: { art: v('wall_d_top', 2), solid: true },
  door_d_top: { art: 't_door_d_top', solid: true },
  door_d: { art: 't_door_d', solid: true },
  quilt_a: { art: v('quilt_a', 2), surface: 'carpet' },
  quilt_b: { art: v('quilt_b', 2), surface: 'carpet' },
  pillow: { art: 't_pillow', under: 'quilt_a', solid: true },

  // --- Pencil forest ----------------------------------------------------------
  paper: { art: v('paper', 3), surface: 'paper' },
  paper_scribble: { art: v('paper_scribble', 3), surface: 'paper' },
  crayon_grass: { art: v('crayon_grass', 3), edge: CRAYON_EDGE, surface: 'grass' },
  pencil_wall: { art: v('pencil_wall', 3), solid: true },
  ink_water: {
    art: 't_ink_water_1',
    anim: v('ink_water', 3),
    animSpeed: 34,
    solid: true,
    edge: INK_POND_EDGE,
    surface: 'water',
  },
  erased: { art: v('erased', 2), edge: ERASED_EDGE, surface: 'paper' },
  desk_wood: { art: v('desk_wood', 2), surface: 'wood' },

  // --- Paper hospital ---------------------------------------------------------
  h_floor: { art: v('h_floor', 3), surface: 'stone' },
  h_wall: { art: 't_h_wall', solid: true },
  h_wall_base: { art: 't_h_wall_base', solid: true },
  h_wall_top: { art: v('h_wall_top', 2), solid: true },
  h_door_top: { art: 't_h_door_top', solid: true },
  h_door: { art: 't_h_door', solid: true },
  h_door_304_top: { art: 't_h_door_304_top', solid: true },
  h_door_304: { art: 't_h_door_304', solid: true },
  h_window: { art: 't_h_window', solid: true },

  // --- Ink ----------------------------------------------------------------------
  ink_puddle: { art: v('ink_puddle', 2), edge: INK_EDGE, surface: 'water' },
  ink_wall: { art: 't_ink_wall_1', anim: v('ink_wall', 3), animSpeed: 20, solid: true },

  // --- Void ---------------------------------------------------------------------
  v_floor: { art: v('v_floor', 3), surface: 'stone' },
  v_edge: { art: 't_v_edge', solid: true, edge: VOID_EDGE },
  v_white: { art: v('v_white', 2), edge: LIGHT_EDGE, surface: 'stone' },
};

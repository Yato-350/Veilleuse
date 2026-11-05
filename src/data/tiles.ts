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
const C5_WHITE_EDGE = { color: PAL.f!, dark: '#dfe7f2', group: 'c5_maree' };
const C5_SNOW_EDGE = { color: PAL.f!, dark: '#dfe7f2', group: 'c5_neige' };
const C6_COTTON_EDGE = { color: '#d9cba6', dark: '#86765c', group: 'c6_ouate' };
const C6_CRUST_EDGE = { color: '#f6f4ec', dark: '#cfcab8', group: 'c6_croute' };

/** Chapter 5: the red thread drawn over another tile (`h`, `v`, corners `ne nw se sw`, crossing `x`, loose end `bout`). */
function c5Threads(prefix: string, under: string, surface: TileDef['surface']): Record<string, TileDef> {
  const out: Record<string, TileDef> = {};
  for (const s of ['h', 'v', 'ne', 'nw', 'se', 'sw', 'x', 'bout']) out[`${prefix}_${s}`] = { art: `t_c5_fil_${s}`, under, surface };
  return out;
}

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

  // --- La fausse aube: the real apartment in morning colours (src/data/sprites/fausse-aube.ts) -------
  fa_floor: { art: v('fa_floor', 3), surface: 'wood' },
  fa_carpet: { art: v('fa_carpet', 2), surface: 'carpet' },
  fa_tile: { art: v('fa_tile', 2), surface: 'stone' },
  fa_wall: { art: 't_fa_wall', solid: true },
  fa_wall_base: { art: 't_fa_wall_base', solid: true },
  fa_wall_top: { art: v('fa_wall_top', 2), solid: true },
  fa_door_top: { art: 't_fa_door_top', solid: true },
  fa_door: { art: 't_fa_door', solid: true },

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

  // --- Chapter 4 « La Maison Cousue » (src/data/sprites/chapter4.ts; the map world makes them felt or ballpoint) ---
  c4_floor: { art: v('c4_floor', 3), surface: 'wood' },
  c4_wall: { art: 't_c4_wall', solid: true },
  c4_wall_base: { art: 't_c4_wall_base', solid: true },
  c4_wall_top: { art: v('c4_wall_top', 2), solid: true },
  c4_window: { art: 't_c4_window', solid: true },
  c4_door_top: { art: 't_c4_door_top', solid: true },
  c4_door: { art: 't_c4_door', solid: true },
  c4_door_sewn_top: { art: 't_c4_door_sewn_top', solid: true },
  c4_door_sewn: { art: 't_c4_door_sewn', solid: true },
  c4_wall_mina: { art: 't_c4_wall_mina', solid: true },
  c4_wall_mina_base: { art: 't_c4_wall_mina_base', solid: true },
  c4_window_mina: { art: 't_c4_window_mina', solid: true },
  c4_floor_mina: { art: v('c4_floor_mina', 2), surface: 'carpet' },
  c4_tile: { art: v('c4_tile', 2), surface: 'stone' },
  c4_edge: { art: v('c4_edge', 2), solid: true },
  c4_page: { art: v('c4_page', 4), solid: true },
  c4_page_margin: { art: 't_c4_page_margin', solid: true },
  c4_sheet: { art: v('c4_sheet', 2), solid: true },
  c4_noir: { art: ['t_c4_noir_1', 't_c4_noir_3'], solid: true },
  c4_noir_tear: { art: 't_c4_noir_2', solid: true },
  c4_noir_bonnet: { art: 't_c4_noir_bonnet', solid: true },
  c4_blank: { art: v('c4_blank', 2), solid: true },
  c4_beam: { art: v('c4_beam', 3), solid: true },
  c4_beam_base: { art: 't_c4_beam_base', solid: true },
  c4_attic_floor: { art: v('c4_attic_floor', 2), surface: 'wood' },
  c4_stairs: { art: 't_c4_stairs', surface: 'wood' },
  c4_floor_pen: { art: v('c4_floor_pen', 2), surface: 'paper' },

  // --- Chapter 5 « La Marée Blanche » (src/data/sprites/chapter5.ts, authored in their final colours) -------------
  // The beach of before, overexposed.
  c5_sable: { art: v('c5_sable', 4), surface: 'carpet' },
  c5_sable_mouille: { art: v('c5_sable_mouille', 2), surface: 'carpet' },
  c5_ecume: { art: 't_c5_ecume_1', anim: v('c5_ecume', 3), animSpeed: 30, solid: true, surface: 'water' },
  c5_mer: { art: 't_c5_mer_1', anim: v('c5_mer', 3), animSpeed: 34, solid: true, surface: 'water' },
  c5_dune: { art: v('c5_dune', 2), solid: true },
  c5_ganivelle: { art: 't_c5_ganivelle', solid: true },
  c5_rocher: { art: v('c5_rocher', 2), solid: true },
  c5_planches: { art: 't_c5_planches', surface: 'wood' },
  c5_maree: { art: v('c5_maree', 2), edge: C5_WHITE_EDGE, surface: 'paper' },
  c5_brume: { art: v('c5_brume', 2), solid: true },
  // Ice: the frozen sea, the lake of the hospital.
  c5_glace: { art: v('c5_glace', 3), surface: 'stone' },
  c5_glace_vague: { art: v('c5_glace_vague', 2), surface: 'stone' },
  // The white hospital: correction fluid, tarps, snow.
  c5_sol: { art: v('c5_sol', 3), surface: 'paper' },
  c5_mur_top: { art: v('c5_mur_top', 2), solid: true },
  c5_bache: { art: v('c5_bache', 2), solid: true },
  c5_bache_base: { art: v('c5_bache_base', 2), solid: true },
  c5_bache_ombre: { art: 't_c5_bache_ombre', solid: true },
  c5_bache_ombre_base: { art: 't_c5_bache_ombre_base', solid: true },
  c5_neige: { art: v('c5_neige', 2), edge: C5_SNOW_EDGE, surface: 'carpet' },
  c5_rive: { art: v('c5_rive', 2), surface: 'stone' },
  c5_givre: { art: v('c5_givre', 2), surface: 'stone' },
  c5_verre_top: { art: v('c5_verre_top', 2), solid: true },
  c5_vitre: { art: 't_c5_vitre', solid: true },
  c5_vitre_base: { art: 't_c5_vitre_base', solid: true },
  c5_lino: { art: v('c5_lino', 2), surface: 'stone' },
  c5_ouate: { art: v('c5_ouate', 2), surface: 'carpet' },
  // The red thread of Mina n°366, lying on ice (c5_fil_*), on the hospital floor (c5_filsol_*) or on sand.
  ...c5Threads('c5_fil', 'c5_glace', 'stone'),
  ...c5Threads('c5_filsol', 'c5_sol', 'paper'),
  ...c5Threads('c5_filsable', 'c5_sable', 'carpet'),
  // Chapter 6 « Le Ventre de Dodo » (src/data/sprites/chapter6.ts): damp cotton, pits crossed by Mina's red thread,
  // yellowed foam, the battery's crust, the plastic of the voice module, the fabric and the seam.
  // The stained variant (t_c6_ouate_3) is kept for c6_tache tiles: scattered at random, its stains lined up like a print.
  c6_ouate: { art: ['t_c6_ouate_1', 't_c6_ouate_2', 't_c6_ouate_4'], edge: C6_COTTON_EDGE, surface: 'carpet' },
  c6_tache: { art: 't_c6_ouate_3', edge: C6_COTTON_EDGE, surface: 'carpet' },
  c6_trempe: { art: v('c6_trempe', 2), surface: 'carpet' },
  c6_paroi: { art: v('c6_paroi', 2), solid: true },
  c6_paroi_base: { art: v('c6_paroi_base', 2), solid: true },
  c6_haut: { art: v('c6_haut', 2), solid: true },
  c6_gouffre: { art: v('c6_gouffre', 2), solid: true },
  c6_fil_h: { art: 't_c6_fil_h', surface: 'carpet' },
  c6_fil_v: { art: 't_c6_fil_v', surface: 'carpet' },
  c6_mousse: { art: v('c6_mousse', 3), surface: 'carpet' },
  c6_croute: { art: v('c6_croute', 3), edge: C6_CRUST_EDGE, surface: 'stone' },
  c6_plastique: { art: v('c6_plastique', 3), surface: 'stone' },
  c6_tissu: { art: v('c6_tissu', 2), solid: true },
  c6_tissu_base: { art: 't_c6_tissu_base', solid: true },
  c6_fente: { art: 't_c6_fente', solid: true },
  c6_fente_base: { art: 't_c6_fente_base', solid: true },
};

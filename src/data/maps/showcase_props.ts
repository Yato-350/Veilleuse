import type { MapDef, PropDef } from '../../game/overworld/types';

/*
 * Developer showcase maps for the props (only reachable with ?debug=map&map=<id>&spawn=<spawn>).
 * Every prop of src/data/sprites/props.ts is placed on the real tile set, in context. Each map has several spawns
 * so that one screenshot per spawn covers one area (a screen is 20×11 tiles).
 */

/** A floor prop (solid by default). Inspecting it shows its key. */
const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, text: sprite, ...o });
/** A prop hung on a wall row (the `*_wall_base` row): lifted a little, never solid. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef =>
  P(sprite, x, y, { solid: false, oy, ...o });
/** A small object resting on furniture (same footprint row, drawn after it). */
const ON = (sprite: string, x: number, y: number, oy: number, o: Partial<PropDef> = {}): PropDef =>
  P(sprite, x, y, { solid: false, oy, ...o });

const GLOW = { r: 40, color: '#ffe991', flicker: true };

// ---------------------------------------------------------------------------
// Real world: Noa's bedroom, kitchen, living room / bathroom, entrance, Mina's room
// ---------------------------------------------------------------------------

const REAL: MapDef = {
  id: 'showcase_props_real',
  name: 'Vitrine — objets du monde réel',
  world: 'real',
  music: null,
  ambience: 'rain',
  tiles: `
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
    TWWwWWWWWwWWWTWWWWWWWwWWWWTWWWwWWWWwWWWT
    TBBBBBBBBBBBBTBBBBBBBBBBBBTBBBBBBBBBBBBT
    TFFFFFFFFFFFFTKKKKKKKKKKKKTFFFFFFFFFFFFT
    TFFFFFFFFFFFFTKKKKKKKKKKKKTFFFFFFFFFFFFT
    TFFFCCCCCCFFFTKKKKKKKKKKKKTFCCCCCCCCCFFT
    TFFFCCCCCCFFFFKKKKKKKKKKKKFFCCCCCCCCCFFT
    TFFFCCCCCCFFFTKKKKKKKKKKKKTFCCCCCCCCCFFT
    TFFFCCCCCCFFFTKKKKKKKKKKKKTFCCCCCCCCCFFT
    TFFFFFFFFFFFFTKKKKKKKKKKKKTFFFFFFFFFFFFT
    TTTTTTFTTTTTTTTTTTTTFTTTTTTTTTTTFTTTTTTT
    TWWOWWWWWWWWWTWWWWWDWWWWWWTXXXXXXXMXXXXT
    TBBoBBBBBBBBBTBBBBBdBBBBBBTxxxxxxxmxxxxT
    TKKKKKKKKKKKKTFFFFFFFFFFFFTPPPPPPPPPPPPT
    TKKKKKKKKKKKKTFFFFFFFFFFFFTPPPPPPPPPPPPT
    TKKKKKKKKKKKKTFFFFFFFFFFFFTPPPPPPPPPPPPT
    TKKKKKKKKKKKKFFFFFFFFFFFFFFPPPPPPPPPPPPT
    TKKKKKKKKKKKKTFFFFFFFFFFFFTPPPPPPPPPPPPT
    TKKKKKKKKKKKKTFFFFFFFFFFFFTPPPPPPPPPPPPT
    TKKKKKKKKKKKKTFFFFFFFFFFFFTPPPPPPPPPPPPT
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
    VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV
  `,
  legend: {
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
  },
  spawns: {
    default: { x: 7, y: 5, dir: 'down' },
    kitchen: { x: 22, y: 5, dir: 'down' },
    living: { x: 34, y: 5, dir: 'down' },
    bath: { x: 6, y: 15, dir: 'down' },
    hall: { x: 20, y: 15, dir: 'down' },
    mina: { x: 34, y: 15, dir: 'down' },
  },
  props: [
    // Noa's bedroom
    P('prop_bed', 1, 3, { h: 2 }),
    P('prop_nightstand', 2, 3),
    ON('prop_veilleuse', 2, 3, -9, { light: GLOW }),
    WALL('prop_calendar', 2, 2, -8),
    P('prop_desk', 4, 3, { w: 2 }),
    P('prop_chair', 4, 4),
    WALL('prop_poster', 6, 2, -4),
    P('prop_shelf', 7, 3, { w: 2 }),
    P('prop_closet', 10, 3, { w: 2 }),
    P('prop_plant', 12, 3),
    P('prop_trash', 12, 4),
    WALL('prop_clock', 12, 2, -10),
    P('prop_bed_sleeping', 1, 6, { h: 2 }),
    P('prop_nightstand', 2, 6),
    ON('prop_veilleuse_off', 2, 6, -9),
    P('prop_dodo_plush', 4, 6, { solid: false }),
    P('prop_dodo_plush_dark', 6, 6, { solid: false }),
    P('prop_photo', 4, 8, { solid: false }),
    P('prop_phone', 6, 8, { solid: false, frames: ['prop_phone', 'prop_phone_2'], frameSpeed: 30 }),
    P('prop_closet_open', 10, 7, { w: 2 }),
    // Kitchen
    P('prop_fridge', 14, 3),
    P('prop_counter', 15, 3, { w: 2 }),
    P('prop_sink', 17, 3),
    P('prop_stove', 18, 3),
    P('prop_counter', 19, 3, { w: 2 }),
    WALL('prop_drawings', 23, 2, -6),
    P('prop_trash', 25, 3),
    P('prop_table', 18, 6, { w: 2 }),
    P('prop_chair', 17, 6),
    P('prop_chair', 20, 6),
    ON('prop_phone_2', 19, 6, -12),
    // Living room
    WALL('prop_picture', 27, 2, -10),
    P('prop_tv', 28, 3, { w: 2, frames: ['prop_tv', 'prop_tv_2'], frameSpeed: 6, light: { r: 46, color: '#c8d8ff', flicker: true, dy: -12 } }),
    P('prop_tv_off', 31, 3, { w: 2 }),
    P('prop_lamp', 33, 3),
    P('prop_shelf', 36, 3, { w: 2 }),
    P('prop_plant', 38, 3),
    P('prop_sofa', 30, 7, { w: 2 }),
    P('prop_lamp', 36, 7),
    // Bathroom
    P('prop_bathtub', 5, 13, { w: 2 }),
    P('prop_toilet', 8, 13),
    P('prop_washbasin', 10, 13),
    WALL('prop_mirror', 10, 12, -4),
    P('prop_trash', 12, 13),
    WALL('prop_clock', 7, 12, -10),
    // Entrance
    WALL('prop_calendar', 15, 12, -8),
    P('prop_coat', 17, 13),
    P('prop_shoes', 19, 13, { solid: false }),
    WALL('prop_picture', 22, 12, -10),
    P('prop_lamp', 24, 13),
    // Mina's room
    P('prop_bed_mina', 27, 13, { h: 2 }),
    P('prop_nightstand', 28, 13),
    ON('prop_veilleuse_off', 28, 13, -9),
    P('prop_toybox', 30, 13),
    WALL('prop_drawings', 31, 12, -6),
    P('prop_shelf', 32, 13, { w: 2 }),
    WALL('prop_poster', 37, 12, -4),
    P('prop_plant', 38, 13),
    P('prop_dodo_plush', 29, 16, { solid: false }),
    P('prop_carnet', 31, 16, { solid: false, light: { r: 22, color: '#ffe991', flicker: true } }),
  ],
};

/** The same flat at night, as the story shows it. */
const REAL_NIGHT: MapDef = {
  ...REAL,
  id: 'showcase_props_real_night',
  name: 'Vitrine — objets du monde réel (nuit)',
  darkness: 0.6,
  playerLight: 64,
};

// ---------------------------------------------------------------------------
// Dream: Cotton Country (meadow, village, Blanket Hill, Chaussette's shop)
// ---------------------------------------------------------------------------

const DREAM: MapDef = {
  id: 'showcase_props_dream',
  name: 'Vitrine — Pays de Coton',
  world: 'dream',
  music: null,
  particles: 'cotton',
  tiles: `
    HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
    Hggggggggggggwgggggg.ggggggggggggggggggH
    Hgffgggggggggwgggggg.ggggggggggggggggggH
    Hgfggggggggggwgggggg.ggggggggggggggggggH
    Hggggggggggggwgggggg.ggggggggggggggggggH
    Hggggggggggggwgggggg.ggggggggggggggggggH
    H............=.........................H
    H............=.........................H
    Hggggggggggggwgggggg..................gH
    Hggggggggffggwggffgg.ggggggggggggggggggH
    Hggggggggggggwgggfgg.ggggggggggggggggggH
    HHHHHHHH.HHHHHHHHHHHHHHHHHHHHH.HHHHHHHHH
    HaabbbaaabbbaaabbbaaTTTTTTTTTTTTTTTTTTTT
    HaabbbaaabbbaaabbbaaTWWWWWWWWDWWWWWWWWWT
    HaabbbaaabbbaaabbbaaTWWWWWWWWdWWWWWWWWWT
    HbbaaabbbaaabbbaaabbTPPPPPPPPPPPPPPPPPPT
    HbbaaabbbaaabbbaaabbTPPPPPRRRRRRRPPPPPPT
    HbbaaabbbaaabbbaaabbTPPPPPRRRRRRRPPPPPPT
    HaabbbaaabbbaaabbbaaTPPPPPRRRRRRRPPPPPPT
    HcccccccabbbaaabbbaaTPPPPPRRRRRRRPPPPPPT
    HcccccccabbbaaabbbaaTPPPPPPPPPPPPPPPPPPT
    HcccccccbaaabbbaaabbTPPPPPPPPPPPPPPPPPPT
    HcccccccbaaabbbaaabbTTTTTTTTTTTTTTTTTTTT
    HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH
  `,
  legend: {
    H: 'hedge',
    g: 'grass',
    f: 'grass_flowers',
    '.': 'path',
    w: 'water',
    '=': 'bridge',
    c: 'cotton',
    a: 'quilt_a',
    b: 'quilt_b',
    T: 'wall_d_top',
    W: 'wall_d',
    D: 'door_d_top',
    d: 'door_d',
    P: 'plank',
    R: 'rug',
  },
  spawns: {
    default: { x: 6, y: 7, dir: 'down' },
    village: { x: 27, y: 7, dir: 'down' },
    hill: { x: 8, y: 18, dir: 'up' },
    shop: { x: 29, y: 19, dir: 'up' },
  },
  props: [
    // Meadow
    P('prop_tree', 2, 3),
    P('prop_tree_b', 5, 4),
    P('prop_tree_small', 8, 2),
    P('prop_balloon_tree', 11, 4),
    P('prop_star_fallen', 2, 5, { w: 2 }),
    P('prop_sign', 9, 5),
    P('prop_bush', 2, 9),
    P('prop_flower_big', 4, 9),
    P('prop_rock', 6, 9),
    P('prop_mushroom', 7, 8, { solid: false }),
    P('prop_bed_dream', 10, 8, { h: 2 }),
    P('prop_bush', 15, 2),
    P('prop_tree_small', 17, 3),
    P('prop_mushroom', 16, 4, { solid: false }),
    P('prop_rock', 15, 9),
    P('prop_flower_big', 18, 9),
    // Village
    P('prop_house', 21, 4, { w: 3, h: 2 }),
    P('prop_mailbox', 24, 5),
    P('prop_lamppost', 25, 4, { light: { r: 50, color: '#ffe991', dy: -26 } }),
    P('prop_well', 26, 4, { w: 2 }),
    P('prop_house_b', 28, 4, { w: 3, h: 2 }),
    P('prop_shop', 32, 4, { w: 3, h: 2 }),
    P('prop_tree_small', 37, 4),
    P('prop_bench', 22, 9, { w: 2 }),
    {
      sprite: 'prop_savepoint',
      frames: ['prop_savepoint', 'prop_savepoint_2'],
      frameSpeed: 18,
      x: 25,
      y: 9,
      light: { r: 44, color: '#ffe991', flicker: true },
      text: 'prop_savepoint',
    },
    P('prop_stall', 28, 9, { w: 2 }),
    P('prop_bush', 31, 9),
    P('prop_lamppost', 33, 9, { light: { r: 50, color: '#ffe991', dy: -26 } }),
    P('prop_tree', 36, 10),
    // Blanket Hill
    P('prop_pillow_big', 2, 14, { w: 2 }),
    P('prop_closet_door', 9, 14, { w: 2 }),
    P('prop_pillow_big', 15, 13, { w: 2 }),
    P('prop_pillow_big', 13, 18, { w: 2 }),
    P('prop_cloud_big', 2, 21, { w: 3 }),
    P('prop_star_fallen', 16, 21, { w: 2 }),
    // Chaussette's shop
    P('prop_jar_shelf', 22, 15, { w: 2 }),
    P('prop_jar_shelf', 33, 15, { w: 2 }),
    P('prop_counter_shop', 25, 17, { w: 2 }),
    P('prop_stall', 35, 20, { w: 2 }),
  ],
};

/** Cotton Country swallowed by ink (chapter 3): checks the automatic @ink variants. */
const DREAM_INK: MapDef = {
  ...DREAM,
  id: 'showcase_props_ink',
  name: 'Vitrine — Pays de Coton (encre)',
  world: 'ink',
  particles: 'ink',
};

// ---------------------------------------------------------------------------
// Pencil Forest (lined paper, crayon grass, lanterns, the Owl's library, the workshop)
// ---------------------------------------------------------------------------

const FOREST: MapDef = {
  id: 'showcase_props_forest',
  name: 'Vitrine — Forêt de Crayons',
  world: 'dream',
  music: null,
  tiles: `
    PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
    Pgggggg.......gggggg...................P
    Pgggggg.......gggggg...................P
    Pgggggg.......gggggg...................P
    Pgggggg................................P
    P......................................P
    P.......s..............................P
    P...............ii.....................P
    P..............iiii....................P
    P..s...........iiii....................P
    ...............iiii....................P
    P...............ii.....................P
    P..............s.......................P
    P.........s................DDDDDDDDDDDDP
    P....................eeee..DDDDDDDDDDDDP
    Pgggggggg...........eeeeee.DDDDDDDDDDDDP
    Pgggggggg...........eeeeee.DDDDDDDDDDDDP
    Pggggggggggggggg....eeeeee.DDDDDDDDDDDDP
    Pggggggggggggggg....eeeeee.DDDDDDDDDDDDP
    Pggggggggggggggg....eeeeee.DDDDDDDDDDDDP
    Pggggggggggggggg.....eeee..DDDDDDDDDDDDP
    PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP
  `,
  legend: {
    P: 'pencil_wall',
    '.': 'paper',
    s: 'paper_scribble',
    g: 'crayon_grass',
    i: 'ink_water',
    e: 'erased',
    D: 'desk_wood',
  },
  spawns: {
    default: { x: 9, y: 6, dir: 'right' },
    library: { x: 26, y: 8, dir: 'up' },
    workshop: { x: 31, y: 18, dir: 'up' },
  },
  props: [
    // Pencil grove
    P('prop_pencil_r', 2, 4),
    P('prop_pencil_b', 4, 3),
    P('prop_pencil_y', 6, 4),
    P('prop_pencil_g', 9, 3),
    P('prop_pencil_v', 11, 4),
    P('prop_pencil_y', 14, 3),
    P('prop_pencil_r', 17, 4),
    P('prop_pencil_g', 2, 17),
    P('prop_pencil_v', 5, 18),
    P('prop_pencil_b', 12, 18),
    // Lantern puzzle: off / on pairs
    P('prop_lantern_r_off', 2, 7),
    P('prop_lantern_r_on', 3, 7, { light: { r: 30, color: '#e8505b', flicker: true, dy: -10 } }),
    P('prop_lantern_b_off', 5, 7),
    P('prop_lantern_b_on', 6, 7, { light: { r: 30, color: '#6d8fd6', flicker: true, dy: -10 } }),
    P('prop_lantern_y_off', 8, 7),
    P('prop_lantern_y_on', 9, 7, { light: { r: 30, color: '#ffe991', flicker: true, dy: -10 } }),
    P('prop_lantern_g_off', 11, 7),
    P('prop_lantern_g_on', 12, 7, { light: { r: 30, color: '#8fd28a', flicker: true, dy: -10 } }),
    P('prop_crayon_rock', 5, 12),
    P('prop_crayon_rock', 13, 13),
    P('prop_eraser_crumbs', 9, 14, { solid: false }),
    // The Owl's library
    P('prop_paper_house', 23, 4, { w: 3, h: 2 }),
    P('prop_bookstack', 21, 5),
    P('prop_bookstack', 27, 5),
    P('prop_sharpener_big', 31, 5, { w: 2 }),
    P('prop_pencil_b', 35, 4),
    P('prop_pencil_r', 37, 6),
    // Erased patch
    P('prop_drawing_erased', 22, 17, { solid: false }),
    P('prop_eraser_crumbs', 21, 14, { solid: false }),
    P('prop_eraser_crumbs', 24, 19, { solid: false }),
    // Workshop
    P('prop_desk_big', 29, 14, { w: 3 }),
    P('prop_easel', 33, 14),
    P('prop_bookstack', 35, 14),
    P('prop_sharpener_big', 36, 17, { w: 2 }),
    P('prop_crayon_rock', 28, 18),
    P('prop_easel', 34, 19),
  ],
};

// ---------------------------------------------------------------------------
// Paper Hospital (corridor, room 304) and the void of the ending
// ---------------------------------------------------------------------------

const HOSPITAL: MapDef = {
  id: 'showcase_props_hospital',
  name: 'Vitrine — Hôpital de Papier',
  world: 'dream',
  music: null,
  tiles: `
    TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
    TWWWWWDWWWWWwWWWWWWWWWWWWWWWWWwWWWWWWWWT
    TBBBBBdBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBT
    TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT
    TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT
    TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT
    TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT
    TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT
    TFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFT
    TTTTTTTTTTTTTTTTTTFTTTEEEEEEEEvEEEEEEEEE
    TWWWwWWWWW3WWWWWwWWWWWEvvvvvvvvvvvvvvvvE
    TBBBBBBBBB4BBBBBBBBBBBEvvvvvvvvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvvvvvvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvOOOOvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvOOOOvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvOOOOvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvOOOOvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvOOOOvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvvvvvvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvvvvvvvvvvvvvvE
    TFFFFFFFFFFFFFFFFFFFFFEvvvvvvvvvvvvvvvvE
    TTTTTTTTTTTTTTTTTTTTTTEEEEEEEEEEEEEEEEEE
    EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE
  `,
  legend: {
    T: 'h_wall_top',
    W: 'h_wall',
    B: 'h_wall_base',
    F: 'h_floor',
    D: 'h_door_top',
    d: 'h_door',
    '3': 'h_door_304_top',
    '4': 'h_door_304',
    w: 'h_window',
    E: 'v_edge',
    v: 'v_floor',
    O: 'v_white',
  },
  spawns: {
    default: { x: 12, y: 7, dir: 'down' },
    room: { x: 11, y: 15, dir: 'up' },
    void: { x: 31, y: 18, dir: 'up' },
  },
  props: [
    // Corridor and waiting room
    P('prop_h_bench', 2, 3, { w: 2 }),
    P('prop_h_plant', 4, 3),
    P('prop_h_bench', 2, 7, { w: 2 }),
    P('prop_h_desk', 14, 3, { w: 2 }),
    P('prop_h_chair', 16, 3),
    P('prop_h_plant', 17, 3),
    P('prop_h_wheelchair', 20, 4),
    P('prop_h_iv', 22, 3),
    P('prop_h_chair', 25, 3),
    P('prop_h_chair', 26, 3),
    P('prop_h_bench', 28, 7, { w: 2 }),
    P('prop_h_monitor', 33, 3, { frames: ['prop_h_monitor', 'prop_h_monitor_2'], frameSpeed: 24 }),
    P('prop_h_bed', 36, 3, { h: 2 }),
    // Room 304
    WALL('prop_h_drawings', 13, 11, -6),
    P('prop_h_monitor', 3, 12, { frames: ['prop_h_monitor', 'prop_h_monitor_2'], frameSpeed: 24, light: { r: 22, color: '#8fd28a', dy: -12 } }),
    P('prop_h_bed', 5, 12, { h: 2 }),
    P('prop_h_table', 7, 12),
    ON('prop_h_nightlight', 7, 12, -11),
    P('prop_h_iv', 4, 14),
    P('prop_h_chair', 8, 14),
    P('prop_h_plant', 20, 12),
    P('prop_h_wheelchair', 17, 15),
    P('prop_h_table', 14, 12),
    // The void
    P('prop_dodo_giant', 26, 15, { w: 3, h: 2 }),
    P('prop_door_light', 35, 14, { light: { r: 60, color: '#fff3cf', dy: -16 } }),
  ],
};

export const SHOWCASE_PROPS_MAPS: Record<string, MapDef> = {
  showcase_props_real: REAL,
  showcase_props_real_night: REAL_NIGHT,
  showcase_props_dream: DREAM,
  showcase_props_ink: DREAM_INK,
  showcase_props_forest: FOREST,
  showcase_props_hospital: HOSPITAL,
};

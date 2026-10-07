import type { MapDef } from '../../game/overworld/types';

/*
 * Developer showcase maps for the tile set (only reachable with ?debug=map&map=<id>).
 * Each map fits one screen (20×11 tiles) and shows every tile in a realistic arrangement.
 * Edge warps chain them together: walk off the right edge to reach the next one.
 */

const next = (to: string, x = 19, y = 5) => ({ x, y, w: 1, h: 1, to, spawn: 'default' });

// Real world: Noa's bedroom, kitchen / corridor, Mina's room.
const REAL: MapDef = {
  id: 'showcase_tiles_real',
  name: 'Vitrine — monde réel',
  world: 'real',
  music: null,
  ambience: 'rain',
  tiles: `
    TTTTTTTTTTTTTTTTTTTT
    TWwWWDWTWMWwWOWTXwXT
    TBBBBdBTBmBBBoBTxxxT
    TFCCCCFTKKKKKKKTPPPT
    TFCCCCFFKKKKKKKFPPPT
    TFCCCCFTKKKKKKKTPPPT
    TFFFFFFTFFFFFFFTPPPT
    TFFFFFFTFFFFFFFTPPPT
    TFFFFFFTFFFFFFFTPPPT
    TTTTTTTTTTTTTTTTTTTT
    VVVVVVVVVVVVVVVVVVVV
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
  spawns: { default: { x: 3, y: 5, dir: 'down' } },
};

// Real world at night, as the story maps will show it (darkness + small light around Noa).
const REAL_NIGHT: MapDef = {
  ...REAL,
  id: 'showcase_tiles_real_night',
  name: 'Vitrine — monde réel (nuit)',
  darkness: 0.55,
  playerLight: 70,
};

// Dream meadow: hedges, grass, flowers, path, river and bridge, fence, cotton field and cotton wall.
const DREAM: MapDef = {
  id: 'showcase_tiles_dream',
  name: 'Vitrine — prairie',
  world: 'dream',
  music: null,
  particles: 'cotton',
  tiles: `
    HHHHHHHHHHHHHHHHHHHH
    HffgggggggggwwwgCCCH
    HfffggFFFFggwwwgcCCH
    Hgfggggg..ggwwwgcccH
    Hgggg.....gggwwwgccH
    .........gg..===....
    Hggg....ggggfwwwgccH
    Hgggg..ggffggwwwgccH
    HHggg..gggffgwwwggCH
    HHHggg..gggggwwwHHHH
    HHHHHH..HHHHHwwwHHHH
  `,
  legend: {
    H: 'hedge',
    g: 'grass',
    f: 'grass_flowers',
    '.': 'path',
    w: 'water',
    '=': 'bridge',
    F: 'fence',
    c: 'cotton',
    C: 'cotton_wall',
  },
  spawns: { default: { x: 2, y: 5, dir: 'right' } },
  warps: [next('showcase_tiles_house')],
};

// Dream interiors: a sheep's cottage (planks, rug, round door) and the Blanket Hill (quilts, pillows).
const HOUSE: MapDef = {
  id: 'showcase_tiles_house',
  name: 'Vitrine — chaumière et couvertures',
  world: 'dream',
  music: null,
  tiles: `
    TTTTTTTTTTTaabbaabba
    TWWWDWWWWWTaabbaOabb
    TWWWdWWWWWTbbaabbaab
    TPPPPPPPPPTbbaObbaab
    TPPRRRRPPPTaabbaabba
    TPPRRRRPPPPaabbOabba
    TPPRRRRPPPTbbaabbaab
    TPPPPPPPPPTbbaabbOab
    TPPPPPPPPPTaabbaabba
    TTTTTTTTTTTaaObaabba
    TTTTTTTTTTTbbaabbaab
  `,
  legend: {
    T: 'wall_d_top',
    W: 'wall_d',
    D: 'door_d_top',
    d: 'door_d',
    P: 'plank',
    R: 'rug',
    a: 'quilt_a',
    b: 'quilt_b',
    O: 'pillow',
  },
  spawns: { default: { x: 5, y: 3, dir: 'down' } },
  warps: [next('showcase_tiles_forest', 19, 4)],
};

// Pencil forest: lined paper, scribbles, crayon grass, ink pond, erased patch, the workshop desk.
const FOREST: MapDef = {
  id: 'showcase_tiles_forest',
  name: 'Vitrine — forêt de crayons',
  world: 'dream',
  music: null,
  tiles: `
    PPPPPPPPPPPPPPPPPPPP
    PPggg.....ggPPPPPPPP
    Pggg...s....ggPDDDDP
    Pgg.....iii..gPDDDDP
    ...s...iiiii.......P
    Pg.....iiii...eeDDDP
    Pgg..s......eeeeDDDP
    Pggg.....s...eeDDDDP
    PPggg........ggPPPPP
    PPPgggg....ggggPPPPP
    PPPPPPPPPPPPPPPPPPPP
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
  spawns: { default: { x: 1, y: 4, dir: 'right' } },
  warps: [next('showcase_tiles_hospital', 0, 4)],
};

// Paper hospital: corridor with doors, room 304, windows with green curtains.
const HOSPITAL: MapDef = {
  id: 'showcase_tiles_hospital',
  name: 'Vitrine — hôpital de papier',
  world: 'dream',
  music: null,
  tiles: `
    TTTTTTTTTTTTTTTTTTTT
    TWwWWDWWwWWWTWW3WWwT
    TBBBBdBBBBBBTBB4BBBT
    TFFFFFFFFFFFTFFFFFFT
    FFFFFFFFFFFFFFFFFFFF
    TFFFFFFFFFFFTFFFFFFT
    TTTTTTTTTTTTTTTTTTTT
    TWWDWWwWWDWWWwWWDWWT
    TBBdBBBBBdBBBBBBdBBT
    TFFFFFFFFFFFFFFFFFFT
    TTTTTTTTTTTTTTTTTTTT
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
  },
  spawns: { default: { x: 2, y: 4, dir: 'right' } },
  warps: [next('showcase_tiles_hospital_ink', 19, 4)],
};

// The same hospital in the corrupted world of chapter 3 (automatic @ink variants).
const HOSPITAL_INK: MapDef = {
  ...HOSPITAL,
  id: 'showcase_tiles_hospital_ink',
  name: 'Vitrine — hôpital (encre)',
  world: 'ink',
  particles: 'ink',
  warps: [next('showcase_tiles_ink', 19, 4)],
};

// Ink world: corrupted meadow and cottage wall, ink puddles, running ink walls.
const INK: MapDef = {
  id: 'showcase_tiles_ink',
  name: 'Vitrine — encre',
  world: 'ink',
  music: null,
  particles: 'ink',
  tiles: `
    IIIIIIIIIIIIIIIIIIII
    IIggggggIITTTTTTTIII
    IgggooggggWWDWWWWIII
    Iggoooo...WWdWWWWggI
    Iggooo........ggggII
    .....o....fgoogwwwgg
    Igggg.....ggooowwwgI
    IIgggg..ggggoogwwwgI
    IHHgggg..gggggggggII
    IHHHggg..ggggggIIIII
    IIIIIIIIIIIIIIIIIIII
  `,
  legend: {
    I: 'ink_wall',
    o: 'ink_puddle',
    g: 'grass',
    f: 'grass_flowers',
    '.': 'path',
    w: 'water',
    H: 'hedge',
    T: 'wall_d_top',
    W: 'wall_d',
    D: 'door_d_top',
    d: 'door_d',
  },
  spawns: { default: { x: 1, y: 5, dir: 'right' } },
  warps: [next('showcase_tiles_void', 19, 5)],
};

// The void: dark floor with violet stars, darker edges, a white path towards the end.
const VOID: MapDef = {
  id: 'showcase_tiles_void',
  name: 'Vitrine — le vide',
  world: 'void',
  music: null,
  particles: 'stars',
  tiles: `
    EEEEEEEEEEEEEEEEEEEE
    EEEEvvvvvvvvvvvEEEEE
    EEvvvvvvvvvvvvvvvEEE
    EvvvvvvvvvvvvvvwwwEE
    EvvvvvvvvvvvvwwwwwvE
    vvvvvvvvvvwwwwwwwwvE
    EvvvvvvvvvvvvwwwwwvE
    EvvvvvvvvvvvvvvwwwEE
    EEvvvvvvvvvvvvvvvEEE
    EEEEvvvvvvvvvvvEEEEE
    EEEEEEEEEEEEEEEEEEEE
  `,
  legend: { E: 'v_edge', v: 'v_floor', w: 'v_white' },
  spawns: { default: { x: 1, y: 5, dir: 'right' } },
  warps: [{ x: 0, y: 5, w: 1, h: 1, to: 'showcase_tiles_dream', spawn: 'default' }],
};

export const SHOWCASE_TILES_MAPS: Record<string, MapDef> = {
  showcase_tiles_real: REAL,
  showcase_tiles_real_night: REAL_NIGHT,
  showcase_tiles_dream: DREAM,
  showcase_tiles_house: HOUSE,
  showcase_tiles_forest: FOREST,
  showcase_tiles_hospital: HOSPITAL,
  showcase_tiles_hospital_ink: HOSPITAL_INK,
  showcase_tiles_ink: INK,
  showcase_tiles_void: VOID,
};

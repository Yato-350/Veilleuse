import type { MapDef, NpcDef, PropDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import * as E from '../../game/story/epilogue';

/*
 * Epilogue of the dawn route: the little shop of the street (`bazar`) and the garden where Mina rests (`jardin`).
 * Daytime, real world. The garden reuses the dream outdoor tiles, drawn in their `@real` look
 * (see src/data/sprites/epilogue.ts). Scripts and flags: src/game/story/epilogue.ts.
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
const ON = (sprite: string, x: number, y: number, oy: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
const flag = (k: string) => () => !!G.state.flags[k];
const noFlag = (k: string) => () => !G.state.flags[k];

// ---------------------------------------------------------------------------
// The shop — « Le Petit Bazar »
// ---------------------------------------------------------------------------

/** The nightlights on sale, on the display table (x = 4..8, y = 5). */
const onSale = (): PropDef[] =>
  E.VL_IDS.map((id, i) =>
    ON(E.VEILLEUSES[id].sprite, 4 + i, 5, -14, {
      id: `vl_${id}`,
      light: { r: 18, color: E.VEILLEUSES[id].light, dy: -20 },
      cond: () => G.state.flags.ep_vl !== id,
      script: E.pickVeilleuse(id),
    }),
  );

const BAZAR: MapDef = {
  id: 'bazar',
  name: 'Le Petit Bazar',
  world: 'real',
  music: 'room_quiet',
  ambience: 'none',
  darkness: 0.08,
  playerLight: 40,
  particles: 'dust',
  banner: true,
  tiles: `
    TTTTTTTTTTTTTTT
    TWWwWWWWWWWWWWT
    TBBBBBBBBBBBBBT
    TFFFFFFFFFFFFFT
    TFFFFFFFFFFFFFT
    TFFCCCCCCCFFFFT
    TFFCCCCCCCFFFFT
    TFFFFFFFFFFFFFT
    TTTTTTTKTTTTTTT
    TTTTTTTKTTTTTTT
  `,
  legend: {
    T: 'r_wall_top',
    W: 'r_wall',
    w: 'r_wall',
    B: 'r_wall_base',
    F: 'r_floor',
    C: 'r_carpet',
    K: 'r_tile',
  },
  spawns: {
    default: { x: 7, y: 7, dir: 'up' },
    door: { x: 7, y: 7, dir: 'up' },
  },
  onEnter: E.bazarEnter,
  props: [
    // The table has no text of its own, so examining it always picks the nightlight in front of Noa.
    P('prop_display_table', 4, 5, { w: 5 }),
    ...onSale(),
    // Top wall
    P('prop_vitrine', 2, 2, { w: 2, solid: false, oy: -2, text: ['La vitrine. Dehors, la rue se réveille.', 'Un monsieur promène son chien. La boulangerie remonte son rideau. Il ne pleut plus.'] }),
    P('prop_clock', 8, 2, { solid: false, oy: -10, text: ['L\'horloge de la boutique indique 9h12.', 'Elle est à l\'heure. Ça te fait bizarre.'] }),
    // Left
    P('prop_cartes', 1, 3, { text: ['Un présentoir de cartes postales. « Bons baisers de la mer ».', 'Il y a la plage où vous étiez allés, tous les trois. Quarante-deux coquillages.'] }),
    P('prop_plant', 5, 3, { text: 'Une plante verte, bien arrosée. Quelqu\'un prend soin des choses, ici.' }),
    P('prop_parapluies', 1, 7, { text: ['Des parapluies. Un jaune, avec des canards.', 'Mina le voulait tellement. Maman avait dit : « À Noël. »'] }),
    // Counter (the shopkeeper stands behind it)
    P('npc_vendeuse', 10, 3, { w: 2, solid: true }),
    P('prop_counter_shop', 10, 4, { w: 2, script: E.counter }),
    ON('prop_bocal', 10, 4, -13),
    ON('prop_caisse', 11, 4, -12),
    P('prop_shelf', 12, 3, { w: 2, text: ['Des tasses avec des prénoms. Léa, Lucas, Nina, Noé…', 'Pas de « Mina ». Il n\'y en a jamais eu. Elle trouvait ça très injuste.'] }),
    // Right
    P('prop_nightstand', 13, 7, { text: ['Une boule à neige. Un petit mouton, dedans.', 'Tu la secoues. Il neige sur le mouton. Il n\'a pas l\'air de s\'en faire.'] }),
    ON('prop_boule_neige', 13, 7, -9),
  ],
  npcs: [{ id: 'maman', char: 'maman', x: 3, y: 3, dir: 'up', script: E.mamanShop }],
  triggers: [{ x: 7, y: 8, w: 1, h: 2, script: E.bazarExit }],
};

// ---------------------------------------------------------------------------
// The garden — where Mina rests
// ---------------------------------------------------------------------------

const GRAVE_TEXT: Record<string, string[]> = {
  a: ['Une tombe. Des fleurs fraîches dans un petit pot.', 'Quelqu\'un est passé avant vous, ce matin.'],
  b: ['« Joseph. Il aimait les oiseaux. »', 'Quelqu\'un a laissé des graines sur la pierre. Les moineaux le savent.'],
  c: ['Une très vieille tombe. Le lierre a mangé les noms.', 'Mais il y a une bougie, au pied. Même après tout ce temps.'],
  d: ['Une tombe. Une photo de chien, glissée sous un caillou.', 'Il a l\'air d\'un très bon chien.'],
  e: ['« À notre maman. » Des lettres d\'enfant, collées avec du scotch.', 'La pluie les a gondolées. Quelqu\'un en a remis des neuves.'],
};
const GRAVE = (kind: 'a' | 'b' | 'c', x: number, y: number, text: keyof typeof GRAVE_TEXT): PropDef => P(`prop_tombe_${kind}`, x, y, { text: GRAVE_TEXT[text] });

/** What stays on Mina's stone (map reloads / suspend saves): the nightlight, and Dodo if he stays. */
const onStone = (): PropDef[] => [
  ...E.VL_IDS.map((id) =>
    ON(E.VEILLEUSES[id].sprite, E.STONE.x, E.STONE.y, -5, {
      id: 'vl_placed',
      ox: -7,
      light: { r: 26, color: E.VEILLEUSES[id].light, dy: -10 },
      cond: () => !!G.state.flags.ep_placed && G.state.flags.ep_vl === id,
    }),
  ),
  ON('prop_dodo_plush', E.STONE.x + 1, E.STONE.y, 0, { id: 'dodo_plush', ox: -2, cond: () => G.state.flags.ep_dodo === 'laisse' }),
];

const SPARROW = (id: string, x: number, y: number, speed: number): NpcDef => ({
  id,
  sprite: 'npc_moineau',
  frames: ['npc_moineau', 'npc_moineau_2'],
  frameSpeed: speed,
  x,
  y,
  solid: false,
  shadow: false,
  script: E.sparrow,
});

const JARDIN: MapDef = {
  id: 'jardin',
  name: 'Le jardin',
  world: 'real',
  music: 'room_quiet',
  ambience: 'none',
  darkness: 0,
  playerLight: 0,
  particles: 'dust',
  banner: true,
  tiles: `
    HHHHHHHHHHHHHHHHHHHHHHHH
    HggggggggggggggggggggggH
    HgggfgggggggggggggfgfggH
    HgggggggggggggggggfgfggH
    Hgggggggggggfggggff.ffgH
    Hgg.................gggH
    Hgggggggggg..gfgggggggfH
    Hggfggggggg..ggggggggggH
    Hgggggggggg..ggggggggggH
    Hgggggggggg..gggfggggggH
    Hggggggggfg..ggggggggggH
    Hgggggggggg..ggggggggggH
    Hggfggggggg..gggggggfggH
    Hgggggggggg..ggggggggggH
    HHHHHHHHHHH..HHHHHHHHHHH
    HHHHHHHHHHH..HHHHHHHHHHH
  `,
  legend: { H: 'hedge', g: 'grass', f: 'grass_flowers', '.': 'path' },
  spawns: {
    default: { x: 11, y: 13, dir: 'up' },
    gate: { x: 11, y: 13, dir: 'up' },
    stone: { x: 19, y: 4, dir: 'up' },
  },
  onEnter: E.jardinEnter,
  props: [
    // Entrance
    P('prop_pilier', 10, 14, { text: 'Le portail du jardin. Il est toujours ouvert, ici.' }),
    P('prop_pilier', 13, 14, { text: 'Le portail du jardin. Il est toujours ouvert, ici.' }),
    P('prop_robinet', 9, 12, { script: E.tap }),
    ON('prop_arrosoir', 8, 12, 0, { id: 'arrosoir', cond: noFlag('ep_water'), script: E.tap }),
    P('prop_bush', 2, 13),
    P('prop_bush', 21, 13),
    // Left: old graves
    GRAVE('a', 3, 7, 'a'),
    GRAVE('b', 5, 7, 'b'),
    GRAVE('c', 7, 7, 'c'),
    GRAVE('a', 9, 7, 'd'),
    GRAVE('c', 3, 10, 'c'),
    GRAVE('b', 5, 10, 'e'),
    GRAVE('a', 7, 10, 'a'),
    GRAVE('b', 9, 10, 'b'),
    // Right
    GRAVE('b', 15, 8, 'e'),
    GRAVE('a', 17, 8, 'd'),
    GRAVE('c', 19, 8, 'c'),
    P('prop_tree', 20, 11, { text: ['Un tilleul. Ses feuilles font des ombres qui bougent sur l\'herbe.'] }),
    P('prop_bench', 15, 11, { w: 2, text: 'Un banc. Une écharpe oubliée est pliée sur l\'accoudoir.' }),
    // Back
    P('prop_tree', 2, 2, { text: 'Un vieil arbre. Son écorce est pleine de cœurs gravés au couteau.' }),
    P('prop_tree_small', 8, 2, { text: 'Un jeune arbre, attaché à son tuteur. Il grandit.' }),
    // Mina's corner, under the big tree
    P('prop_tree', 21, 2, { text: ['Le grand arbre.', 'Elle aimait les arbres qui font de l\'ombre.'] }),
    P('prop_bench', 15, 3, { w: 2, text: ['Un banc, face au grand arbre.', 'Le bois est usé à un seul endroit. Toujours le même.'] }),
    P('prop_moulin', 18, 3, { solid: false, frames: ['prop_moulin', 'prop_moulin_2'], frameSpeed: 14, text: ['Des moulins à vent en plastique, plantés dans l\'herbe.', 'Maman les change à chaque saison. Tu ne le savais pas.'] }),
    P('prop_moulin', 20, 4, { solid: false, frames: ['prop_moulin_2', 'prop_moulin'], frameSpeed: 18, text: 'Un moulin à vent. Il tourne, il tourne. Il n\'a jamais le tournis.' }),
    P('prop_tombe_mina', E.STONE.x, E.STONE.y, { id: 'mina_stone', script: E.minaStone }),
    ...onStone(),
  ],
  npcs: [
    SPARROW('moineau_1', 5, 12, 40),
    SPARROW('moineau_2', 17, 6, 30),
    SPARROW('moineau_3', 12, 9, 46),
    { id: 'maman', char: 'maman', x: E.MAMAN_WAIT.x, y: E.MAMAN_WAIT.y, dir: 'right', cond: () => !!G.state.flags.ep_maman_wait && !G.state.flags.ep_poem, script: E.mamanGarden },
    { id: 'maman', char: 'maman', x: E.MAMAN_NEAR.x, y: E.MAMAN_NEAR.y, dir: 'right', cond: flag('ep_poem'), script: E.mamanGarden },
  ],
  triggers: [
    { x: 17, y: 1, w: 6, h: 4, cond: noFlag('ep_maman_wait'), script: E.mamanStops },
    { x: 11, y: 14, w: 2, h: 2, script: E.gate },
  ],
};

export const EPILOGUE_MAPS: Record<string, MapDef> = {
  bazar: BAZAR,
  jardin: JARDIN,
};

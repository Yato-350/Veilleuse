import type { MapDef, PropDef, TriggerDef } from '../../game/overworld/types';
import { G } from '../../game/state';
import { f, nf } from '../../game/story/common';
import * as C4 from '../../game/story/chapter4';
import { Grid } from './build';

/*
 * Chapter 4 — « La Maison Cousue » (docs/HISTOIRE.md § 3.11). The apartment as a giant dollhouse, its front open,
 * standing on a page of a maths exercise book: two floors cut open (upstairs: the landing, Noa's room, Mina's room,
 * Maman's room; downstairs: the entrance, the living room, the kitchen), stairs cut through the floor between them.
 *   maison_feutre  the felt layer (« en mieux »): Dodo's house, warm, sewn shut;
 *   maison_stylo   the same plan in black ballpoint: the forty-one nights alone (the props change with c4_nuit);
 *   grenier        the attic: the seamstress's workshop, the mannequins of the Minas that went wrong;
 *   couloir_coups  the corridor that grows longer, between Night 35 and Night 42.
 */

const P = (sprite: string, x: number, y: number, o: Partial<PropDef> = {}): PropDef => ({ sprite, x, y, ...o });
/** A decoration hung on the wall-base row: lifted a little, never solid. */
const WALL = (sprite: string, x: number, y: number, oy = -6, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });
/** An invisible interactable (a part of the tiles: a window, a wall, a room seen from its door). */
const SPOT = (x: number, y: number, script: PropDef['script'], o: Partial<PropDef> = {}): PropDef => P('', x, y, { solid: false, script, ...o });
/** A small object resting on a piece of furniture (same footprint, drawn after it). */
const ON = (sprite: string, x: number, y: number, oy: number, o: Partial<PropDef> = {}): PropDef => P(sprite, x, y, { solid: false, oy, ...o });

const night = (): number => C4.night();
const atNight = (n: number) => (): boolean => night() === n;
const fromNight = (n: number) => (): boolean => night() >= n;
const flagIs = (k: string, v: string) => (): boolean => G.state.flags[k] === v;

const GLOW = { r: 40, color: '#ffe991', flicker: true, dy: -8 };
const LAMP = { r: 46, color: '#ffd9a0', flicker: false, dy: -20 };

// ---------------------------------------------------------------------------------------------------------------------
// The house: one plan, two layers
// ---------------------------------------------------------------------------------------------------------------------

/**
 * 40×22. Upstairs (rows 1–9): landing 2–8 | Noa 10–18 | Mina 20–27 | Maman 29–37, the rooms open on a strip (rows
 * 8–9) along the cut front; row 10 is the cut edge of the floor. Downstairs (rows 11–18): entrance 2–8 | living room
 * 10–22 | kitchen 24–37, the front door at (5, 12–13). Stairs at x 2–3, rows 10–13.
 */
function houseTiles(pen: boolean): string {
  const g = new Grid(40, 22, '#');
  g.rect(1, 0, 1, 22, '|');
  // Upstairs.
  g.rect(2, 1, 36, 1, 'K').rect(2, 2, 36, 1, 'W').rect(2, 3, 36, 1, 'B').rect(2, 4, 36, 6, '.').rect(2, 10, 36, 1, 'E');
  g.rect(20, 2, 8, 1, 'P').rect(20, 3, 8, 1, 'p').rect(20, 4, 8, 6, 'r');
  g.set(14, 2, 'w').set(23, 2, 'n');
  for (const x of [9, 19, 28]) g.rect(x, 1, 1, 7, 'K');
  // Maman's room: a sheet sewn over the whole room (felt); not drawn at all (ballpoint).
  g.rect(29, 2, 9, 6, pen ? 'O' : 'X');
  // Mina's room at night: a rectangle blackened so hard that the paper tore.
  if (pen) g.rect(20, 2, 8, 6, 'N').set(22, 4, 'T').set(25, 6, 'T');
  // Downstairs.
  g.rect(2, 11, 36, 1, 'K').rect(2, 12, 36, 1, 'W').rect(2, 13, 36, 1, 'B').rect(2, 14, 36, 5, '.').rect(2, 19, 36, 1, 'E');
  g.rect(24, 14, 14, 5, 't');
  for (const x of [9, 23]) g.rect(x, 11, 1, 5, 'K');
  g.set(5, 12, 'D').set(5, 13, 'd');
  g.set(13, 12, 'w').set(20, 12, 'w').set(34, 12, 'w');
  // The stairs, cut through the floor.
  g.rect(2, 10, 2, 4, 'S');
  // Ballpoint: no windows (the curtains are drawn, night after night).
  return pen ? g.toString().replace(/w/g, 'W').replace(/n/g, 'N').replace(/\./g, ',') : g.toString();
}

const HOUSE_LEGEND: Record<string, string> = {
  '#': 'c4_page',
  '|': 'c4_page_margin',
  K: 'c4_wall_top',
  W: 'c4_wall',
  B: 'c4_wall_base',
  w: 'c4_window',
  D: 'c4_door_top',
  d: 'c4_door',
  P: 'c4_wall_mina',
  p: 'c4_wall_mina_base',
  n: 'c4_window_mina',
  '.': 'c4_floor',
  ',': 'c4_floor_pen',
  T: 'c4_noir_tear',
  r: 'c4_floor_mina',
  t: 'c4_tile',
  E: 'c4_edge',
  X: 'c4_sheet',
  N: 'c4_noir',
  O: 'c4_blank',
  S: 'c4_stairs',
};

const HOUSE_SPAWNS = {
  default: { x: 5, y: 15, dir: 'up' as const },
  entree: { x: 5, y: 15, dir: 'up' as const },
  cuisine: { x: 21, y: 17, dir: 'right' as const },
  horloge: { x: 16, y: 15, dir: 'up' as const },
  echelle: { x: 7, y: 5, dir: 'down' as const },
  chambre: { x: 14, y: 7, dir: 'down' as const },
  nuit42: { x: 14, y: 9, dir: 'up' as const },
};

// ---------------------------------------------------------------------------------------------------------------------
// maison_feutre — the felt layer
// ---------------------------------------------------------------------------------------------------------------------

const MAISON_FEUTRE: MapDef = {
  id: 'maison_feutre',
  name: 'La Maison Cousue',
  world: 'feutre',
  music: 'maison',
  particles: 'cotton',
  vignette: 0.35,
  banner: true,
  tiles: houseTiles(false),
  legend: HOUSE_LEGEND,
  spawns: HOUSE_SPAWNS,
  onEnter: C4.feutreEnter,
  props: [
    // --- Upstairs: the landing.
    WALL('prop_mirror', 4, 3, -2, { script: C4.mirrorFelt }),
    WALL('prop_c4_trappe', 7, 2, -6, { id: 'trappe', cond: nf('c4_trappe'), script: C4.ladderFelt }),
    P('prop_c4_echelle', 7, 4, { id: 'echelle', solid: true, cond: f('c4_trappe'), script: C4.ladderFelt }),
    P('prop_plant', 2, 4, { script: C4.look(['Une plante verte en feutre.', 'Quelqu\'un l\'arrose : la terre est trempée. La plante, elle, n\'a jamais poussé d\'un point.']) }),
    P('prop_c4_bobine', 5, 6, { solid: false, oy: -2, script: C4.look(['Une bobine de fil rouge, tombée par terre. Presque vide.', 'Le fil part sous la porte du grenier, au plafond.'], 'C\'est pas à moi. Moi, j\'ai pas le droit de toucher aux aiguilles.') }),
    // --- Noa's room.
    P('prop_bed', 10, 4, { h: 2, script: C4.bedFelt }),
    P('prop_nightstand', 11, 4, { script: C4.look(['Ta table de nuit. Il n\'y a rien dessus.', 'Ici, tu n\'as pas besoin de veilleuse. Il ne fait jamais nuit.'], 'T\'as plus peur du noir, toi. Hein ?') }),
    P('prop_desk', 13, 4, { w: 2, script: C4.deskFelt }),
    P('prop_chair', 13, 5, { solid: false, oy: -2 }),
    WALL('prop_poster', 16, 3, -4, { script: C4.look(['Un poster de l\'espace, cousu au mur.', 'Les planètes sont des boutons. La Lune aussi. Elle est cousue en croix.']) }),
    P('prop_closet', 16, 4, { w: 2, script: C4.look(['Ton placard. Fermé par une fermeture éclair, du haut jusqu\'en bas.', 'De l\'intérieur, on entend une petite respiration. Elle s\'arrête quand tu écoutes.'], 'Le monstre du placard, il habite plus ici. Il a déménagé. Je crois.') }),
    SPOT(18, 5, C4.knockWallFelt, { id: 'mur', h: 2 }),
    P('prop_c4_mot', 12, 8, { solid: false, oy: -2, script: C4.look(['Un petit papier plié en quatre, sous le lit.', 'Dessus, de ton écriture : « Bonne nuit ». C\'est tout. Il n\'a jamais été donné.']) }),
    // --- Mina's room: pink, perfect.
    P('prop_bed_mina', 26, 4, { h: 2, script: C4.look(['Le lit de Mina. La couette est tirée, les oreillers gonflés.', 'Personne n\'y a jamais dormi. Il est trop parfait pour qu\'on y dorme.'], ['Mon lit ! …Il sent pas comme mon lit.', 'Il sent le neuf.']) }),
    P('prop_nightstand', 25, 4, { script: C4.minaNightstandFelt }),
    P('prop_toybox', 21, 4, { script: C4.look(['Ses jouets. Bien rangés, par taille, par couleur.', 'Mina n\'a jamais rangé ses jouets de sa vie.'], 'C\'est Dodo qui range. Il range tout. Même moi, des fois.') }),
    WALL('prop_drawings', 22, 3, -4, { script: C4.drawingsFelt }),
    SPOT(23, 3, C4.look(['La fenêtre de Mina. Une lune de feutre est cousue dans le ciel.', 'Elle ne bouge pas. Elle ne bougera jamais. Ici, la nuit ne passe pas.'], 'C\'est ma lune. Elle me regarde dormir. Quand je dors.'), { oy: -2 }),
    P('prop_pillow_big', 24, 7, { id: 'coussin', solid: false, script: C4.pillowFort }),
    // --- Maman's room: sewn shut under a sheet.
    SPOT(29, 7, C4.mamanSheet, { id: 'drap', w: 9 }),
    // --- Downstairs: the entrance.
    P('', 5, 13, { id: 'porte', cond: nf('c4_intro'), script: C4.frontDoorFelt }),
    P('prop_c4_coutures_4', 5, 13, { id: 'coutures', cond: f('c4_intro'), script: C4.frontDoorFelt }),
    WALL('prop_coat', 7, 13, -2, { script: C4.look(['Le manteau de Maman, sur sa patère.', 'Les poches sont cousues. Dedans, quelque chose de plat et de rectangulaire. Qui vibre, parfois.']) }),
    P('prop_shoes', 6, 14, { solid: false, oy: 2, script: C4.look(['Quatre paires de chaussures, bien rangées par taille.', 'Les petites bottes de Mina sont cousues au paillasson. Pour qu\'elles ne repartent pas.'], 'Mes bottes ! Je peux plus les mettre. C\'est pas grave, je sors plus.') }),
    WALL('prop_picture', 4, 13, -4, { script: C4.familyPicture }),
    // --- The living room.
    P('prop_shelf', 10, 14, { w: 2, script: C4.look(['Une bibliothèque. Tous les livres ont le même titre, brodé sur le dos : « Avant ».', 'Tu en ouvres un. Les pages sont en feutre. Sur chacune, un dîner. Quatre assiettes.']) }),
    P('prop_tv', 13, 14, { w: 2, frames: ['prop_tv', 'prop_tv_2'], frameSpeed: 20, script: C4.tvFelt }),
    WALL('prop_c4_horloge', 16, 13, -2, { id: 'horloge', frames: ['prop_c4_horloge', 'prop_c4_horloge_2'], frameSpeed: 32, script: C4.clockFelt }),
    P('prop_lamp', 12, 17, { light: LAMP, script: C4.look(['Une lampe à abat-jour de feutre.', 'L\'ampoule est brodée. Elle éclaire quand même. Elle éclaire un peu trop.']) }),
    P('prop_sofa', 13, 17, { w: 2, script: C4.sofaFelt }),
    P('prop_c4_coffre', 19, 14, { w: 2 }),
    P('prop_c4_mouton_dort', 19, 14, { id: 'mouton_1', solid: false, over: true, oy: -8, cond: nf('c4_mouton_1'), script: C4.sheepAsleep(1) }),
    P('prop_c4_mouton_vide', 19, 14, { solid: false, over: true, oy: -8, cond: f('c4_mouton_1'), script: C4.sheepAsleep(1) }),
    P('prop_c4_mouton_dort', 20, 14, { id: 'mouton_2', solid: false, over: true, oy: -6, cond: nf('c4_mouton_2'), script: C4.sheepAsleep(2) }),
    P('prop_c4_mouton_vide', 20, 14, { solid: false, over: true, oy: -6, cond: f('c4_mouton_2'), script: C4.sheepAsleep(2) }),
    P('prop_c4_mouton_dort', 21, 14, { id: 'mouton_3', cond: nf('c4_mouton_3'), script: C4.sheepAsleep(3) }),
    P('prop_c4_mouton_vide', 21, 14, { cond: f('c4_mouton_3'), script: C4.sheepAsleep(3) }),
    P('prop_c4_mouton_dort', 22, 15, { id: 'mouton_4', cond: nf('c4_mouton_4'), script: C4.sheepAsleep(4) }),
    P('prop_c4_mouton_vide', 22, 15, { cond: f('c4_mouton_4'), script: C4.sheepAsleep(4) }),
    SPOT(20, 13, C4.look(['Une fenêtre, cousue fermée. Quatre croix de fil, une à chaque coin.', 'Derrière les points, il n\'y a pas de rue. Il y a une page de cahier, et des carreaux bleus jusqu\'au bout.'])),
    SPOT(13, 13, C4.look(['Une fenêtre cousue.', 'Tu colles l\'œil entre deux points. Dehors, très loin, une marge rouge. Et rien.'])),
    // --- The kitchen.
    P('prop_c4_frigo_1', 25, 14, { script: C4.look(['Le frigo. Des aimants en feutre tiennent des dessins.', 'Pas un seul mot. Ici, personne n\'a besoin de laisser de mot : tout le monde est là.'], 'Moi je trouve ça mieux, sans les mots. Les mots, ça veut dire que quelqu\'un est parti.') }),
    P('prop_counter', 26, 14, { w: 2, script: C4.look(['Le plan de travail. Une casserole de pâtes en laine, qui ne refroidit jamais.', 'À côté, un paquet de pâtes. Sur l\'étiquette : « Il y a des pâtes ».']) }),
    P('prop_sink', 28, 14, { script: C4.look(['L\'évier. Il est plein d\'assiettes propres.', 'Quelqu\'un les lave, les relave, les relave encore.']) }),
    P('prop_stove', 29, 14, { script: C4.look(['La cuisinière. Les flammes sont en feutre orange.', 'Tu approches la main. Ça ne chauffe pas. Ça ne brûlera jamais personne.']) }),
    WALL('prop_calendar', 31, 13, -4, { script: C4.look(['Un calendrier en feutre.', 'Tous les jours sont le même jour : un dimanche, brodé en rouge. Il n\'y a pas de lundi, ici.'], 'Le dimanche, on va nulle part. C\'est pour ça que c\'est le meilleur jour.') }),
    WALL('prop_c4_tel', 33, 13, -2, { script: C4.look(['Le téléphone mural. Quelqu\'un l\'a emmailloté dans du fil, comme un cocon.', 'Il vibre, très faiblement. Il ne sonnera pas. Il ne peut pas.']) }),
    SPOT(34, 13, C4.look(['La fenêtre de la cuisine, cousue.', 'Entre deux points, un rond de lumière bouge sur la page, lentement. Comme si quelqu\'un, dehors, tenait une lampe.'])),
    P('prop_c4_table', 28, 17, { id: 'table', w: 3, cond: nf('c4_diner_fait'), script: C4.tableFelt }),
    P('prop_c4_table_gris', 28, 17, { id: 'table', w: 3, cond: f('c4_diner_fait'), script: C4.tableFelt }),
  ],
  npcs: [
    { id: 'poupee_maman', sprite: 'npc_maman_poupee', x: 27, y: 16, dir: 'right', script: C4.mamanDollFelt, shadow: false },
    { id: 'dodo', sprite: 'npc_dodo_thin', frames: ['npc_dodo_thin', 'npc_dodo_thin_2'], frameSpeed: 26, x: 11, y: 16, float: true, shadow: false, cond: f('c4_intro'), script: C4.dodoFelt },
    { id: 'mouton_balai', sprite: 'npc_c4_mouton_balai', frames: ['npc_c4_mouton_balai', 'npc_c4_mouton_balai_2'], frameSpeed: 18, x: 7, y: 17, wander: 2, script: C4.sheepBroom },
    { id: 'mouton_fer', sprite: 'npc_c4_mouton_fer', frames: ['npc_c4_mouton_fer', 'npc_c4_mouton_fer_2'], frameSpeed: 22, x: 35, y: 17, script: C4.sheepIron },
    { id: 'mouton_plateau', sprite: 'npc_c4_mouton_plateau', frames: ['npc_c4_mouton_plateau', 'npc_c4_mouton_plateau_2'], frameSpeed: 20, x: 22, y: 8, wander: 2, script: C4.sheepTray },
  ],
  enemies: [
    { id: 'c4_de_1', enemies: ['de_chevalier'], x: 24, y: 8, wander: 2, cond: fromNight(1) },
    { id: 'c4_brouillon_1', enemies: ['poupee_brouillon'], x: 3, y: 8, wander: 2, cond: fromNight(9) },
    { id: 'c4_pate_1', enemies: ['pate_froide'], x: 33, y: 16, wander: 1, cond: fromNight(9) },
  ],
  triggers: [{ x: 23, y: 16, w: 1, h: 3, script: C4.kitchenEnter }],
};

// ---------------------------------------------------------------------------------------------------------------------
// maison_stylo — the same plan in black ballpoint, night after night
// ---------------------------------------------------------------------------------------------------------------------

const FRIDGE: Array<[number, string]> = [
  [1, 'prop_c4_frigo_1'],
  [9, 'prop_c4_frigo_2'],
  [22, 'prop_c4_frigo_3'],
  [35, 'prop_c4_frigo_4'],
];
const fridgeAt = (i: number) => (): boolean => night() >= FRIDGE[i]![0] && (i === FRIDGE.length - 1 || night() < FRIDGE[i + 1]![0]);
const PLATES: Array<[number, string]> = [
  [1, 'prop_c4_assiettes_1'],
  [9, 'prop_c4_assiettes_2'],
  [22, 'prop_c4_assiettes_3'],
  [35, 'prop_c4_assiettes_4'],
];
const platesAt = (i: number) => (): boolean => night() >= PLATES[i]![0] && (i === PLATES.length - 1 || night() < PLATES[i + 1]![0]);

const MAISON_STYLO: MapDef = {
  id: 'maison_stylo',
  name: 'La Maison Cousue — la nuit',
  world: 'stylo',
  music: 'maison_nuit',
  ambience: 'hum',
  darkness: 0.18,
  playerLight: 70,
  vignette: 0.55,
  grain: 0.25,
  tiles: houseTiles(true),
  legend: HOUSE_LEGEND,
  spawns: HOUSE_SPAWNS,
  onEnter: C4.styloEnter,
  props: [
    // --- Upstairs: the landing.
    WALL('prop_mirror', 4, 3, -2, { script: C4.byNight({ 1: ['Le miroir du couloir.', 'Tu évites de passer devant. Quand tu passes devant, tu regardes tes pieds.'], 22: ['Le miroir du couloir.', 'Tu lèves les yeux, une fois. Le garçon dedans est dessiné plus vite que le reste de la maison.', 'Comme si on n\'avait pas eu le temps de le finir.'] }) }),
    WALL('prop_c4_trappe', 7, 2, -6, { script: C4.ladderPen }),
    P('prop_trash', 2, 4, { script: C4.byNight({ 1: ['Une poubelle.', 'Un emballage de pâtes. Un seul.'], 9: ['La poubelle déborde.', 'Tu ne descends plus les poubelles. Il faudrait sortir.'], 22: ['La poubelle. Tu as mis un sac à côté. Puis un autre.'] }) }),
    // --- Noa's room.
    P('prop_bed', 10, 4, { h: 2, cond: () => night() !== 35, script: C4.byNight({ 1: ['Ton lit. Pas défait.', 'Tu ne te couches pas, ces nuits-là. Tu t\'endors assis, le téléphone dans la main.'], 22: ['Ton lit. Pas défait depuis des jours.', 'Le drap garde la forme de quelqu\'un qui ne s\'est pas couché.'], 42: ['Ton lit. La couverture est jetée par terre.', 'Ton casque est sur l\'oreiller. Le fil pend jusqu\'au sol.'] }) }),
    P('prop_bed_sleeping', 10, 4, { h: 2, cond: atNight(35), script: C4.dollCough }),
    P('prop_nightstand', 11, 4),
    ON('prop_c4_veilleuse', 11, 4, -11, { id: 'veilleuse', light: GLOW, cond: nf('c4_veilleuse'), script: C4.nightlightPen }),
    P('prop_desk', 13, 4, { w: 2, script: C4.deskPen }),
    P('prop_chair', 13, 5, { solid: false, oy: -2 }),
    P('prop_closet', 16, 4, { w: 2, script: C4.look(['Ton placard. Fermé. Bien fermé.', 'La nuit, tu vérifies deux fois. Puis une troisième, pour être sûr.']) }),
    SPOT(18, 5, C4.knockWallPen, { id: 'mur', h: 2 }),
    P('prop_c4_boite', 12, 7, { id: 'boite', script: C4.shoebox }),
    { id: 'poupee_boite', sprite: 'npc_poupee_noa_cote', x: 13, y: 7, cond: atNight(9), script: C4.dollShoebox },
    // --- Mina's room (blackened), Maman's room (not drawn).
    SPOT(20, 7, C4.minaRoomPen, { id: 'chambre_mina', w: 8 }),
    SPOT(29, 7, C4.mamanRoomPen, { id: 'chambre_maman', w: 9 }),
    // --- Downstairs: the entrance.
    SPOT(5, 13, C4.frontDoorPen, { id: 'porte', solid: true }),
    P('prop_shoes', 7, 14, { solid: false, oy: 2, script: C4.look(['Tes chaussures. Les lacets sont faits.', 'Tu ne les défais plus. Comme ça, tu es prêt. Au cas où.']) }),
    WALL('prop_picture', 4, 13, -4, { script: C4.look(['Une photo, dessinée au stylo.', 'Tu as repassé le contour de Mina tant de fois que le papier brille.', 'Le tien, tu ne l\'as pas dessiné. Il y a un trou rond, à la place.']) }),
    // --- The living room.
    P('prop_shelf', 10, 14, { w: 2, script: C4.look(['La bibliothèque.', 'Sur l\'étagère du bas, les albums photo. Tu ne les ouvres plus.', 'Enfin. Tu ne les ouvres plus depuis la dernière fois.']) }),
    P('prop_tv', 13, 14, { w: 2, frames: ['prop_tv', 'prop_tv_2'], frameSpeed: 12, script: C4.look(['La télé est allumée, le son coupé.', 'Tu ne la regardes pas. C\'est pour la lumière. Pour qu\'il y ait quelque chose d\'allumé, en bas.']) }),
    WALL('prop_c4_horloge', 16, 13, -2, { id: 'horloge', script: C4.clockPen }),
    P('prop_sofa', 13, 17, { w: 2, script: C4.byNight({ 1: ['Le canapé. Ton creux, à gauche.', 'Les deux autres places sont plates, bien gonflées. Personne ne s\'y assoit.'], 22: ['Le canapé. Une couverture, un oreiller.', 'C\'est là que tu dors, maintenant. Près de la porte. Près du téléphone.'], 35: ['Le canapé. Tu as tiré le téléphone jusqu\'ici, avec la rallonge.', 'Il est posé sur l\'accoudoir, contre ton oreiller, la sonnerie au maximum.', 'Il ne sonne que pour dire de ne pas venir.'] }) }),
    P('prop_c4_coffre', 19, 14, { w: 2, script: C4.look(['Le coffre à jouets de Mina. Ouvert. Vide.', 'Ses moutons sont partis avec elle, dans un sac, le premier soir.', 'Tu ne l\'as pas refermé. Tu ne sais pas pourquoi.']) }),
    // --- The kitchen.
    ...FRIDGE.map(([, sprite], i) => P(sprite, 25, 14, { id: 'frigo', cond: fridgeAt(i), script: C4.fridgePen })),
    P('prop_counter', 26, 14, { w: 2 }),
    ...PLATES.map(([, sprite], i) => ON(sprite, 27, 14, -12, { cond: platesAt(i), script: C4.platesPen })),
    P('prop_sink', 28, 14, { script: C4.look(['L\'évier. Une casserole qui trempe.', 'L\'eau est froide depuis longtemps. Il y a des pâtes collées au fond, comme des vers blancs.']) }),
    P('prop_stove', 29, 14, { script: C4.look(['La plaque. Tu fais chauffer l\'eau des pâtes.', 'Tu oublies le sel. Tu oublies souvent le sel. Personne ne te le dit.']) }),
    WALL('prop_coat', 31, 13, -2, { script: C4.look(['Un manteau, sur un crochet. Celui de Maman.', 'C\'est tout ce qu\'il reste d\'elle, dans cette cuisine.', 'Il garde la forme de ses épaules. Tu ne le touches pas : la forme partirait.']) }),
    WALL('prop_c4_tel', 33, 13, -2, { id: 'tel', script: C4.phonePen }),
    WALL('prop_calendar', 36, 13, -4, {
      script: C4.byNight({
        1: ['Un calendrier. Le soir, avant de ne pas dormir, tu barres le jour.', 'Une croix. Une seule, pour l\'instant.'],
        9: ['Le calendrier. Neuf croix.', 'Samedi est entouré, au stylo. Tu ne sais plus qui l\'a entouré.'],
        22: ['Le calendrier. Les croix deviennent des traits, puis des points.', 'Tu appuies de moins en moins fort.'],
        35: ['Le calendrier. Sur la case d\'aujourd\'hui, de ton écriture, en gros : « elle va mieux !! »', 'Deux points d\'exclamation. Tu y as cru.', 'En le relisant, tu y crois encore un peu.'],
      }),
    }),
    P('prop_table', 28, 17, { w: 2, script: C4.byNight({ 1: ['La table de la cuisine.', 'Trois chaises vides. Ta place, ton verre, ta fourchette.'], 22: ['La table. Des miettes, une tache de sauce.', 'Tu as arrêté de mettre ton assiette. Tu manges debout, à côté de l\'évier.'] }) }),
    ON('prop_c4_thermo', 28, 17, -14, { cond: atNight(35), script: C4.look(['Un thermomètre, posé sur la table.', 'Trente-huit et deux.', 'Tu le secoues. Tu le reprends. Trente-huit et un. Ça ne change rien.']) }),
    ON('prop_c4_assiette', 29, 17, -15, { cond: atNight(1), script: C4.look(['Une assiette de pâtes froides.', 'Pas de sauce. Ça ne valait pas la peine, pour une personne.']) }),
    P('prop_chair', 31, 16, { cond: atNight(1), script: C4.look(['La chaise de Maman.', 'Tirée, un peu de travers. Comme si elle venait de se lever.']) }),
    P('prop_c4_chaise_dos', 31, 16, { cond: fromNight(9), script: C4.chairPen }),
  ],
  npcs: [
    { id: 'poupee_noa', sprite: 'npc_poupee_noa_mange', x: 29, y: 16, cond: atNight(1), script: C4.dollEats, shadow: false },
    { id: 'poupee_porte', sprite: 'npc_poupee_noa_dos', x: 6, y: 14, dir: 'up', cond: atNight(22), script: C4.dollDoor },
  ],
  enemies: [
    { id: 'c4_pate_2', enemies: ['pate_froide'], x: 34, y: 17, wander: 1, cond: fromNight(1) },
    { id: 'c4_pate_3', enemies: ['pate_froide', 'pate_froide'], x: 26, y: 16, wander: 1, cond: fromNight(22) },
    { id: 'c4_mot_1', enemies: ['mot_aimante'], x: 10, y: 18, wander: 1, cond: fromNight(22) },
    { id: 'c4_brouillon_2', enemies: ['poupee_brouillon'], x: 24, y: 9, wander: 2, cond: fromNight(9) },
  ],
  triggers: [
    { x: 9, y: 8, w: 1, h: 2, cond: f('c4_veilleuse'), script: C4.hallwayStretches },
    { x: 19, y: 8, w: 1, h: 2, cond: f('c4_veilleuse'), script: C4.hallwayStretches },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------
// grenier — the seamstress's workshop
// ---------------------------------------------------------------------------------------------------------------------

/**
 * 30×14. Beams with tally marks along the back; the mannequins in rows; the seamstress's corner (21–26, rows 4–5)
 * behind a curtain of threads (row 6); the hatch to the landing at (12, 11).
 */
function atticTiles(): string {
  const g = new Grid(30, 14, '#');
  g.rect(0, 0, 1, 14, '|');
  g.rect(1, 1, 28, 1, 'K').rect(1, 2, 28, 1, 'H').rect(1, 3, 28, 1, 'h').rect(1, 4, 28, 8, 'a').rect(1, 12, 28, 1, 'E');
  for (const x of [20, 27]) g.rect(x, 1, 1, 6, 'K');
  return g.toString();
}

const MANNEQUINS: Array<[string, number, number]> = [
  ['mq_12', 3, 5],
  ['mq_31', 6, 5],
  ['mq_88', 9, 5],
  ['mq_140', 12, 5],
  ['mq_200', 15, 5],
  ['mq_251', 4, 8],
  ['mq_301', 7, 8],
  ['mq_364', 13, 8],
];

const GRENIER: MapDef = {
  id: 'grenier',
  name: 'Le grenier',
  world: 'feutre',
  music: null,
  ambience: 'hum',
  particles: 'dust',
  darkness: 0.35,
  playerLight: 64,
  vignette: 0.55,
  banner: true,
  tiles: atticTiles(),
  legend: {
    '#': 'c4_page',
    '|': 'c4_page_margin',
    K: 'c4_wall_top',
    H: 'c4_beam',
    h: 'c4_beam_base',
    a: 'c4_attic_floor',
    E: 'c4_edge',
  },
  spawns: {
    default: { x: 12, y: 10, dir: 'up' },
    trappe: { x: 12, y: 10, dir: 'up' },
  },
  onEnter: C4.grenierEnter,
  props: [
    P('prop_c4_trappe', 12, 11, { id: 'trappe', under: true, solid: false, oy: -4, script: C4.hatchDown }),
    // The mannequins (they turn to look at Noa, one more for each label read).
    ...MANNEQUINS.map(([id, x, y]) => P('prop_c4_mannequin_tourne', x, y, { id, script: C4.mannequin(id) })),
    P('prop_c4_mannequin_sansbouche', 17, 4, { id: 'mq_bouche', script: C4.mannequinNoMouth }),
    WALL('prop_c4_bouche', 18, 3, -10, { script: C4.mannequinNoMouth }),
    P('prop_c4_mannequin_cape', 10, 8, { id: 'mq_365', cond: nf('c4_rideau'), script: C4.mannequin365 }),
    P('prop_c4_mannequin_cape', 21, 5, { id: 'mq_365_pose', cond: f('c4_rideau'), script: C4.mannequin365 }),
    P('prop_c4_mannequin_vide', 18, 9, { id: 'mq_vide', script: C4.mannequinEmpty }),
    // The crowns, the tally marks, the patterns, the dormer.
    P('prop_c4_couronnes', 3, 10, { id: 'couronnes', w: 3, script: C4.crownsPile }),
    P('prop_c4_couronne', 6, 11, { solid: false, script: C4.crownsPile }),
    SPOT(5, 2, C4.tallyMarks, { w: 4, h: 2 }),
    SPOT(13, 2, C4.tallyMarks, { w: 4, h: 2 }),
    WALL('prop_drawings', 9, 3, -4, { script: C4.look(['Des patrons de couture, épinglés au mur, en papier de soie.', 'Une robe, taille 8 ans. Une cape. Une couronne.', 'Le même patron, trois cent soixante-cinq fois, l\'un sur l\'autre. Le papier est devenu épais comme du carton.'], 'C\'est ma taille, ça. …C\'est ma taille ?') }),
    SPOT(2, 3, C4.look(['Une lucarne, entre deux poutres.', 'Dehors, la page de cahier, à perte de vue. Et tout au bout, posé sur la marge, un œil-bouton qui ne cligne pas.'])),
    P('prop_c4_bobine', 24, 9, { solid: false, script: C4.look(['Des bobines vides, par dizaines, en tas.', 'Il ne reste du fil que sur une seule. Rouge.']) }),
    P('prop_c4_bobine', 26, 10, { solid: false, script: C4.look(['Une bobine vide.', 'Sur l\'étiquette, à l\'encre : « coton — Dodo ».']) }),
    // The curtain of threads before the seamstress's corner.
    ...[21, 22, 23, 24, 25, 26].map((x, i) => P('prop_c4_rideau', x, 6, { id: `rideau_${i + 1}`, cond: nf('c4_rideau'), script: C4.curtain })),
    P('prop_c4_bobine', 25, 4, { solid: false, oy: -4 }),
  ],
  npcs: [
    { id: 'couseuse', sprite: 'npc_couseuse', frames: ['npc_couseuse', 'npc_couseuse_2'], frameSpeed: 6, x: 23, y: 4, cond: () => G.state.flags.c4_couseuse !== 'vaincue', script: C4.couseuseTalk, shadow: false },
    { id: 'couseuse', sprite: 'npc_couseuse_cassee', x: 23, y: 4, cond: flagIs('c4_couseuse', 'vaincue'), script: C4.couseuseTalk, shadow: false },
  ],
  enemies: [
    { id: 'c4_de_2', enemies: ['de_chevalier'], x: 3, y: 7, wander: 2 },
    { id: 'c4_brouillon_3', enemies: ['poupee_brouillon', 'poupee_brouillon'], x: 17, y: 7, wander: 2 },
  ],
};

// ---------------------------------------------------------------------------------------------------------------------
// couloir_coups — the corridor that grows longer (Night 35 → Night 42)
// ---------------------------------------------------------------------------------------------------------------------

/** Doors along the corridor (always Noa's own room); Noa's real door at the end (67). */
const CORRIDOR_DOORS = [8, 12, 17, 26, 30, 35, 44, 48, 53, 61];
function corridorTiles(): string {
  const g = new Grid(72, 9, '#');
  g.rect(0, 0, 72, 1, 'K').rect(1, 1, 70, 1, 'W').rect(1, 2, 70, 1, 'B').rect(1, 3, 70, 3, '.').rect(0, 6, 72, 1, 'E');
  g.rect(0, 0, 1, 7, 'K').rect(71, 0, 1, 7, 'K').rect(68, 0, 3, 7, 'K');
  for (const x of [...CORRIDOR_DOORS, 67]) g.set(x, 1, 'D').set(x, 2, 'd');
  return g.toString();
}

const KNOCKS: TriggerDef[] = [15, 33, 51].map((x, i) => ({ x, y: 3, w: 1, h: 3, script: C4.knockPoint(i) }));

const COULOIR: MapDef = {
  id: 'couloir_coups',
  name: 'Le couloir',
  world: 'stylo',
  music: null,
  ambience: 'hum',
  darkness: 0.84,
  playerLight: 18,
  vignette: 0.7,
  grain: 0.4,
  tiles: corridorTiles(),
  legend: { '#': 'c4_page', K: 'c4_wall_top', W: 'c4_wall', B: 'c4_wall_base', D: 'c4_door_top', d: 'c4_door', '.': 'c4_floor_pen', E: 'c4_edge' },
  spawns: {
    default: { x: 3, y: 4, dir: 'right' },
    debut: { x: 3, y: 4, dir: 'right' },
    fin: { x: 60, y: 4, dir: 'right' },
  },
  onEnter: C4.corridorEnter,
  props: [
    ...CORRIDOR_DOORS.map((x) => SPOT(x, 2, C4.corridorDoor, { solid: true })),
    WALL('prop_clock', 22, 2, -8, { script: C4.corridorClock }),
    WALL('prop_clock', 40, 2, -8, { script: C4.corridorClock }),
    WALL('prop_c4_tel', 64, 2, -2, { id: 'tel_couloir', script: C4.corridorPhone }),
    P('prop_c4_mot', 28, 5, { solid: false, script: C4.look(['Un mot du frigo, par terre.', '« Tu viens demain ? »', 'Tu ne l\'avais pas jeté. Tu ne jettes rien.']) }),
    P('prop_c4_mot', 46, 3, { solid: false, script: C4.look(['Un autre mot.', '« Elle va un peu mieux ❤ »', 'Le cœur est dessiné à la main. Il a bavé.']) }),
    SPOT(67, 2, C4.noaDoor, { id: 'porte_noa', solid: true }),
    P('prop_c4_lumiere', 67, 2, { id: 'lumiere_porte', solid: false, oy: 1 }),
    P('prop_c4_main', 67, 2, { id: 'main_porte', solid: false, oy: -3 }),
  ],
  triggers: [...KNOCKS, { x: 63, y: 3, w: 1, h: 3, script: C4.nuit42 }],
};

export const CHAPTER4_MAPS: Record<string, MapDef> = {
  maison_feutre: MAISON_FEUTRE,
  maison_stylo: MAISON_STYLO,
  grenier: GRENIER,
  couloir_coups: COULOIR,
};

import { TILE } from '../../engine/constants';
import { fx } from '../../engine/fx';
import type { Director } from '../director';
import { setPageTitle } from '../meta';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { composePoem } from '../scenes/poem';
import { finishGame, REAL, wakeUp, type EndingId } from './common';
import { epilogue } from './epilogue';

/**
 * The endings (docs/HISTOIRE.md § 5). Version 2, production lot 9:
 *
 *   afterFinalBattle(d, route)   where the final battle of chapter 6 (src/game/battle/final-v2.ts) leads: [Ouvrir les
 *                                yeux] wakes up into the finale « Le carnet » (real.ts, STORY.wake[6]); [Rester] is
 *                                Beaux rêves; the route of the ink (isSilenceRoute) is Silence.
 *   dawnEnding()                 once the eyes are open, the ending the finale closes on: Veilleuse when every condition
 *                                of the secret ending holds, Aube blanche after three corrected drawings or more,
 *                                Aube otherwise. The finale (real.ts carnet / mamanComesHome) reads it for the poem's
 *                                extra line, the white memory, the offer to unstitch Dodo, and sets flags.fin_ending.
 *   endingAube                   the sunrise in Mina's room (fin_aube), then the epilogue (epilogue.ts).
 *   endingAubeBlanche            the sun is a round of correction fluid (fin_aube_blanche), then the epilogue in its
 *                                white variant (« Je venais tous les jours. », « Beaux rêves, {player}. »).
 *   endingVeilleuse              the secret ending: the seam ripper, the module and the folded drawing (lune_finie),
 *                                track 1 clear with the alarm clock's battery, track 2 under the golden button (Mina's
 *                                own voice, recorded before the last night), three knocks on her wall and the radiator,
 *                                Dodo sewn back with blue thread (fin_veilleuse), then the epilogue: Dodo left on her
 *                                stone, her drawings instead of the voice. From then on Dodo never speaks again.
 *   endingBeauxReves             Dodo keeps him: the story, the sheep — then the hallway, years going by, Maman's notes
 *                                on his door, the battery dying on « beaux rê— »; a boy of sixteen, alive, still in his
 *                                room (fin_beaux_reves). Not a death (§ 6.1).
 *   endingSilence                he wakes up rested and nothing is left: Mina's door is a storeroom, « Qui ? », three
 *                                knocks nobody answers (fin_silence).
 * Every ending is recorded by finishGame (common.ts), which also plays the credits (with the help card after Beaux
 * rêves, Silence and Aube blanche) and picks the title screen (scenes/title.ts ENDING_TITLE). The « Fin heureuse » of
 * the fake credits (fausse-aube.ts) is never recorded.
 *   endingAubeV1                 version 1.1, Mina's goodbye in the void of chapter 3 (only chapter 3's debug).
 *
 * Maps: appartement_br, appartement_silence (src/data/maps/endings.ts). Props: src/data/sprites/endings.ts.
 * Illustrations: fin_aube_blanche and lune_finie (illustrations.ts), fin_beaux_reves, fin_silence and fin_veilleuse
 * (illustrations-fins.ts).
 *
 * Flags: fin_route 'aube' | 'beaux_reves' | 'silence' (set by the final battles); fin_ending (real.ts); in the
 * secret ending: fin_decousu (Dodo unstitched), fin_piste1, fin_piste2 (the two tracks heard), fin_recousu.
 */

/** Where the final battle leaves Noa: eyes open, staying with Dodo, or nothing left to say goodbye to. */
export type FinalRoute = 'aube' | 'beaux_reves' | 'silence';

const tile = (px: number): number => Math.floor(px / TILE);

/** Version 1.1: Mina's goodbye in the void of chapter 3. No longer on the story's path (chapter 3 debug c3_aube). */
export async function endingAubeV1(d: Director): Promise<void> {
  d.set('fin_route', 'aube');
  setPageTitle(null);
  d.music(null, 2);
  const giant = d.find('dodo_giant');
  if (giant) {
    world.particles.burst(giant.x, giant.y - 20, '#fff3cf', 30, 1.4);
    d.remove('dodo_giant');
  }
  d.spawn({ id: 'dodo_plush', sprite: 'prop_dodo_plush', x: 15, y: 8, solid: false, shadow: true });
  d.flash('#fff3cf', 30);
  world.extraDarkness = -0.2;
  await d.wait(60);
  await d.say(['…', 'Tu as gagné, Noa.'], 'dodo:neutral');
  await d.say(['Elle m\'avait donné à toi pour que je veille sur toi.', 'Je crois que j\'ai mal compris.', 'Veiller, ce n\'est pas empêcher de se réveiller.'], 'dodo:neutral');
  await d.say(['Va.', 'Moi, je suis un mouton en peluche. Mon travail, c\'est de rester.'], 'dodo:happy');
  d.music('title', 2);
  await d.wait(30);
  // Mina appears a few steps ahead of Noa, left of where the choice window opens.
  const mx = Math.min(22, tile(d.player.x) + 7);
  d.spawn({ id: 'mina_light', sprite: 'pose_mina_light', x: mx, y: 8, solid: false, shadow: false, light: { r: 60, color: '#fff3cf', flicker: true } });
  d.sfx('chime', { pitch: 0.9 });
  await d.cameraTo(mx - 2, 8);
  await d.say('Noa.', 'mina:happy');
  await d.say(['Tout à l\'heure, j\'ai pas pu finir ma phrase.', 'Je voulais juste te dire…'], 'mina:neutral');
  await d.say('C\'est pas ta faute.', 'mina:sad');
  await d.say(['Et mon carnet… celui avec le Pays de Coton dedans.', 'Il est sur mon bureau. Je l\'ai fait pour toi.', 'Va le lire, d\'accord ? Et allume la lumière.'], 'mina:happy');
  await d.say('…Mina.', 'noa:sad');
  const c = await d.ask('Elle sourit. Elle attend que tu le dises.', ['Au revoir', 'Je t\'aime', 'Pardon']);
  await d.say(['Au revoir.', 'Je t\'aime.', 'Pardon.'][c]!, 'noa:sad');
  const answers = [
    ['Au revoir, Noa.', 'Fais de beaux rêves… mais pas trop longtemps, hein !'],
    ['Moi aussi.', 'Gros comme le Pays de Coton. Plus gros, même.'],
    ['Je sais.', 'Moi aussi je t\'aime, gros bêta.'],
  ];
  await d.say(answers[c]!, 'mina:happy');
  const ml = d.find('mina_light');
  if (ml) {
    for (let i = 0; i < 30; i++) {
      ml.alpha = 1 - i / 30;
      await d.wait(3);
    }
    world.particles.burst(ml.x, ml.y - 12, '#ffe991', 24, 1);
  }
  d.remove('mina_light');
  d.cameraFollow();
  d.set('c3_dawn_ready');
  await d.wait(30);
  await d.say(['Plus loin, au bout du vide, une porte de lumière s\'est ouverte.', 'De l\'autre côté, il fait presque jour.']);
}


// ---------------------------------------------------------------------------------------------------------------------
// Version 2 — the routes
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Once the eyes are open, the ending the finale closes on (§ 5): Veilleuse when every condition of the secret ending
 * holds, Aube blanche after three drawings corrected or more (chapter 5), Aube otherwise.
 */
export function dawnEnding(): EndingId {
  const fl = G.state.flags;
  const secret =
    G.meta.endings.includes('aube') &&
    !fl.c1_bouton_vendu &&
    !!fl.c5_fievre &&
    Number(fl.c5_corrige ?? 0) < 3 &&
    !!fl.c6_pile &&
    G.meta.callVersion === 'sais_pas' &&
    !!fl.i4_pile;
  if (secret) return 'veilleuse';
  return Number(fl.c5_corrige ?? 0) >= 3 ? 'aube_blanche' : 'aube';
}

/** Leaving the v2 final battle (chapter 6) for its ending. */
export async function afterFinalBattle(d: Director, route: FinalRoute): Promise<void> {
  d.set('fin_route', route);
  if (route === 'silence') await endingSilence(d);
  else if (route === 'beaux_reves') await endingBeauxReves(d);
  // « Ouvrir les yeux »: the finale (STORY.wake[6]).
  else await wakeUp(d, 6);
}

// ---------------------------------------------------------------------------------------------------------------------
// Aube, Aube blanche — the sun rises, then the epilogue (epilogue.ts records the ending)
// ---------------------------------------------------------------------------------------------------------------------

/** Aube (§ 5, § 3.15 item 10): called by the finale after the radiator, Maman and Noa in each other's arms. */
export async function endingAube(d: Director): Promise<void> {
  await d.fadeOut(120, '#fff3e0');
  await d.image('fin_aube', ['Le soleil se lève sur la chambre de Mina.', 'Pour la première fois depuis un an, il fait jour.']);
  d.remove('hug');
  await epilogue(d);
}

/**
 * Aube blanche (§ 5): the same morning, drawn over in correction fluid. The poem wrote « j'étais là » by itself, the
 * call and the cold gave way to a white memory (real.ts); here the sun is a round of correction fluid, and the
 * epilogue says « Je venais tous les jours. » and ends on « Beaux rêves, {player}. ».
 */
export async function endingAubeBlanche(d: Director): Promise<void> {
  await d.fadeOut(120, '#fbfcff');
  await d.image('fin_aube_blanche', ['Le soleil se lève sur la chambre de Mina.', 'Il est tout rond, tout blanc. Il ne chauffe pas.', 'Il fait jour quand même.']);
  d.remove('hug');
  await epilogue(d);
}

// ---------------------------------------------------------------------------------------------------------------------
// Veilleuse — the secret ending
// ---------------------------------------------------------------------------------------------------------------------

/** Where Noa unstitches Dodo: in front of the windowsill, Maman at his side. */
const SILL = { x: 5, y: 4 };

/**
 * Veilleuse, the secret ending (§ 5). Called by the finale in Mina's room once Noa chose « Le découdre » (Maman and
 * Noa standing, Dodo 'f_dodo' on the windowsill, the nightlight plugged in; the radiator has not knocked yet: its
 * knocks come back here, after the second track).
 */
export async function endingVeilleuse(d: Director): Promise<void> {
  d.set('fin_decousu');
  d.music(null, 2);
  await d.walkTo('player', SILL.x, SILL.y, 0.8);
  d.face('player', 'up');
  await d.wait(20);
  await d.say(['Tu prends Dodo sur le rebord de la fenêtre.', 'Sous ton pouce, à travers le tissu de la patte, le petit rond dur.']);
  d.remove('f_dodo');
  if (d.find('maman')) {
    await d.walkTo('maman', SILL.x + 1, SILL.y + 1, 0.6);
    d.face('maman', 'left');
  }
  d.face('player', 'right');
  await d.say('Maman fouille dans son sac. Sa trousse à couture. Elle en sort un petit découd-vite.');
  await d.say('Tu vas l\'abîmer.', 'maman:sad');
  await d.say('Je vais le réparer.', 'noa:neutral');
  await d.wait(30);
  await d.say('Elle te le tend.');
  d.face('player', 'up');
  // The seam: Mina's big red stitches.
  for (let i = 0; i < 4; i++) {
    d.sfx('thread', { pitch: 1 + i * 0.08, vol: 0.5 });
    await d.wait(26);
  }
  await d.say(['Sur son ventre, les gros points rouges de Mina.', 'Tu les défais un par un. Le fil est usé, tout doux. Il cède sans bruit.']);
  await d.say(['Sous le coton, un petit boîtier en plastique. Deux fils, deux boutons.', 'Et une feuille pliée en quatre, toute petite.']);
  await d.wait(30);
  d.sfx('write', { pitch: 0.5, vol: 0.5 });
  await d.say('Tu la déplies.');
  await d.image('lune_finie', [
    'Deux enfants sous une grande lune.',
    'Le ciel est colorié jusqu\'au bord. La lune aussi. Et la petite fille.',
    'Le grand frère n\'a pas de masque.',
    '« FINI. (sans toi mais avec toi) »',
  ]);
  await d.wait(30);
  await d.say('…', 'noa:sad');
  await d.say(['Elle l\'a fini toute seule.', 'Elle n\'a pas voulu que je regarde.'], 'maman:sad');
  await d.wait(30);
  // Track 1, clear for the first time in a year: the battery of Maman's alarm clock (Interlude IV, i4_pile).
  await d.say(['Dans le boîtier, trois piles plates. Mortes.', 'Dans ta poche, la pile du réveil de Maman. Celle de cette nuit.']);
  d.sfx('pop', { pitch: 0.7, vol: 0.5 });
  await d.say('Tu la glisses dans le boîtier. Elle rentre. Juste.');
  await d.ask('Le ventre de Dodo.', ['Appuyer']);
  d.sfx('pop', { pitch: 1.4, vol: 0.4 });
  await d.wait(30);
  await d.say('Bonne nuit, Noa ! Dodo veille sur toi. Fais de beaux rêves.', 'minavoix');
  d.set('fin_piste1');
  await d.wait(40);
  await d.say(['Pas de grésillement. Pas de coupure.', 'Toute la phrase, pour la première fois depuis un an.', 'Sa voix.']);
  await d.emote('maman', '…', 50);
  await d.wait(30);
  // Track 2: the golden button sewn into the left paw (§ 1.1, « pour plus tard »).
  await d.say(['Dans la patte gauche, cousu à part, un bouton doré.', 'Il faut appuyer fort.']);
  await d.ask('La patte gauche.', ['Appuyer fort']);
  d.sfx('pop', { pitch: 1.1, vol: 0.4 });
  await d.wait(40);
  await d.say(['Noa, c\'est Mina.', 'Appuie pas sur ce bouton avant d\'être grand.'], 'minavoix');
  await d.wait(50);
  await d.say(['{p:30}…{p:30}Bon.', 'T\'as appuyé.'], 'minavoix');
  await d.say(['C\'est pas toi qui m\'as rendue malade, gros bêta.', 'C\'est mes globules. Nadia l\'a dit, et Nadia elle sait tout.', 'Alors arrête ta tête.'], 'minavoix');
  await d.say(['Si t\'as peur du noir, c\'est pas grave.', 'Moi aussi.', 'On a le droit.'], 'minavoix');
  await d.wait(30);
  await d.say('{p:40}…{p:30}Bonne nuit.', 'minavoix');
  await d.wait(30);
  for (let i = 0; i < 3; i++) {
    d.sfx('knock1', { vol: 0.5, pitch: 1.2 });
    await d.wait(24);
  }
  await d.say('Trois petits coups, au bout. Sur du bois, tout près du micro.');
  d.set('fin_piste2');
  await d.wait(60);
  await d.say('Elle savait pas, pour l\'appel.', 'noa:sad');
  await d.wait(50);
  await d.say(['Non.', 'Mais elle te connaissait.'], 'maman:sad');
  await d.wait(40);
  // § 5: this beat replaces the radiator of the finale (§ 3.15 item 9).
  await d.walkTo('player', 1, 5, 0.8);
  d.face('player', 'left');
  await d.say('Le mur, à côté de son lit. La peinture usée, à hauteur d\'oreiller.');
  for (let i = 0; i < 3; i++) {
    d.sfx('knock1', { vol: 0.8 });
    await d.wait(28);
  }
  await d.wait(50);
  for (let i = 0; i < 3; i++) {
    d.sfx('pipe', { vol: 0.5 });
    await d.wait(30);
  }
  await d.say('Dans le mur, le tuyau du radiateur répond. Trois fois.');
  await d.say('C\'est le chauffage.', 'maman:happy');
  await d.wait(30);
  await d.say('Je sais.', 'noa:neutral');
  await d.wait(40);
  // Sewn back with blue thread, clumsily.
  d.face('player', 'right');
  await d.say(['Maman te donne une bobine de fil. Du bleu. C\'est le seul qu\'elle a.', 'Tu remets le boîtier dans le ventre. Le dessin, tu le gardes.']);
  for (let i = 0; i < 6; i++) {
    d.sfx('stitch', { pitch: 0.9 + (i % 3) * 0.1, vol: 0.5 });
    await d.wait(22);
  }
  await d.say(['Tes points sont gros, de travers.', 'Ils ne ressemblent pas du tout aux siens.', 'Ils tiennent.']);
  d.spawn({ id: 'f_dodo_recousu', sprite: 'prop_dodo_recousu', x: 1, y: 4, solid: false, shadow: false });
  d.set('fin_recousu');
  d.set('fin_ending', 'veilleuse');
  await d.wait(30);
  await d.say('Tu l\'assois sur le lit, contre le bonnet.');
  d.music('ending', 2);
  await d.wait(60);
  await d.fadeOut(120, '#fff3e0');
  await d.image('fin_veilleuse', ['Le soleil se lève sur la chambre de Mina.', 'À côté de son lit, la veilleuse est branchée.', 'Personne ne l\'éteint.']);
  d.remove('maman');
  await epilogue(d);
}

// ---------------------------------------------------------------------------------------------------------------------
// Beaux rêves — he stays (§ 5, § 6.1: a living boy whose years go by, not a death)
// ---------------------------------------------------------------------------------------------------------------------

/** Noa's door in the hallway (appartement_br) and where Maman stands to knock. */
const NOA_DOOR = { x: 6, y: 2 };
const KNOCK_AT = { x: 6, y: 3 };

/** Maman's notes on his door, one more each time: where each sticks (pixel offsets from the door tile). */
const NOTES: Array<{ sprite: string; ox: number; oy: number; text: string }> = [
  { sprite: 'prop_postit', ox: -3, oy: -12, text: '« Noa, tu as 15 ans aujourd\'hui. Il y a un gâteau dans le frigo. »' },
  { sprite: 'prop_postit', ox: 3, oy: -4, text: '« 16. »' },
  { sprite: 'prop_postit_rose', ox: -2, oy: 2, text: '« Je t\'aime. »' },
];

export async function endingBeauxReves(d: Director): Promise<void> {
  d.music('dodo_v2', 2);
  const p = d.player;
  await d.say(['Chut. Voilà.', 'Allonge-toi. Là. Tout contre moi.'], 'dodotorn:happy');
  d.show('player', false);
  d.spawn({ id: 'noa_lie', sprite: 'pose_noa_lie', x: tile(p.x), y: tile(p.y - 2), solid: false, shadow: false });
  await d.wait(60);
  await d.say(['Je vais te raconter une histoire.', 'Il était une fois un Pays de Coton, où il ne pleuvait que du coton…'], 'dodotorn:happy');
  await d.say(['…et une princesse-chevalière qui n\'est jamais partie.', 'Et un grand frère qui n\'a jamais rien fait de mal.'], 'dodotorn:happy');
  await d.say(['Tu n\'auras plus mal.', 'Plus jamais. Je te le promets.'], 'dodotorn:neutral');
  await d.say('Un mouton… {p:30}deux moutons… {p:40}trois…', 'dodotorn:neutral');
  await d.wait(40);
  await d.say(['Merci, {player}.', 'Tu peux rester, toi aussi. Tant que tu restes, il dort bien.'], 'dodotorn:creepy');
  await d.fadeOut(120);
  d.music(null, 1);
  d.remove('noa_lie');
  await d.wait(60);
  // The real world: he gets up, and goes back to his room. The years go by on the other side of his door.
  await d.narrate(['Le lendemain, Noa s\'est levé.', 'Il a bu un verre d\'eau. Il est retourné dans sa chambre.', 'Il a fermé la porte.']);
  await hallwayYears(d);
  await d.fadeOut(90);
  await d.wait(40);
  await d.image('fin_beaux_reves', [
    'Noa a seize ans.',
    'Il mange quand Maman dort. Il répond quand on frappe. Pas toujours.',
    'Dodo avait promis : tu n\'auras plus mal.',
    'Ce n\'était pas vrai. Ça fait mal pareil. Seulement plus doucement, et tous les jours.',
  ]);
  await d.fadeOut(1);
  await d.wait(40);
  await d.narrate('Bonne nuit, Noa.', { voice: 'noa' });
  await d.narrate('Bonne nuit, {player}.', { voice: 'noa' });
  await finishGame(d, 'beaux_reves');
}

/** The hallway (appartement_br): Maman's notes pile up on his door, one birthday after another. */
async function hallwayYears(d: Director): Promise<void> {
  d.load('appartement_br', 'noa');
  d.show('player', false);
  G.state.flags.interlude = REAL.finale;
  world.hideBanner();
  void d.cameraTo(KNOCK_AT.x + 1, KNOCK_AT.y + 1);
  world.snapCamera();
  const when = ['Un an plus tard.', 'Un an.', 'Plus tard.'];
  for (let i = 0; i < NOTES.length; i++) {
    const note = NOTES[i]!;
    await d.fadeOut(1);
    await d.narrate(when[i]!);
    await d.fadeIn(50);
    d.spawn({ id: 'maman', char: 'maman', x: 12, y: KNOCK_AT.y + 1, dir: 'left' });
    await d.walkTo('maman', KNOCK_AT.x + 1, KNOCK_AT.y + 1, 0.6);
    await d.walkTo('maman', KNOCK_AT.x, KNOCK_AT.y, 0.6);
    d.face('maman', 'up');
    await d.wait(30);
    d.sfx('write', { pitch: 1.2, vol: 0.4 });
    const e = d.spawn({ id: `br_mot_${i}`, sprite: note.sprite, x: NOA_DOOR.x, y: NOA_DOOR.y, solid: false, shadow: false });
    e.ox = note.ox;
    e.oy = note.oy;
    await d.wait(20);
    // Two knocks: « Je suis là. »
    d.sfx('knock1', { vol: 0.6 });
    await d.wait(26);
    d.sfx('knock1', { vol: 0.6 });
    await d.wait(40);
    await d.say(note.text, undefined, { style: 'paper' });
    if (i === 0) {
      await d.wait(40);
      await d.say('…Merci.', 'noavoix');
      await d.wait(30);
      await d.say('Elle pose la main à plat sur la porte. Elle la laisse là un long moment.');
    } else if (i === 1) {
      await d.wait(80);
      await d.say('…Bon anniversaire, mon grand.', 'maman:sad');
    } else {
      await d.wait(80);
      // Behind the door, the module in Dodo's belly, the battery nearly gone.
      d.sfx('static', { vol: 0.15, pitch: 0.8 });
      await d.say('{static}Bon{/static}ne nuit, No{static}a ! D{/static}odo veille sur toi. Fais de beaux rê{static}—{/static}', 'minavoix');
      d.sfx('static', { vol: 0.08, pitch: 0.5 });
      await d.wait(90);
      await d.say(['La pile est morte au milieu du mot.', 'Personne ne finit la phrase.']);
      await d.wait(40);
      await d.say(['Derrière la porte, quelqu\'un respire.', 'Il est là. Il est toujours là.']);
    }
    await d.walkTo('maman', 12, KNOCK_AT.y + 1, 0.6);
    d.remove('maman');
    await d.fadeOut(50);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Silence — nothing left (§ 5)
// ---------------------------------------------------------------------------------------------------------------------

export async function endingSilence(d: Director): Promise<void> {
  d.music(null, 1);
  d.ambience('none');
  world.extraDarkness = 0.4;
  await d.say(['Dors, maintenant.', 'Il n\'y a plus rien à réveiller.'], 'dodotorn:creepy');
  fx.glitch = 0.15;
  await d.fadeOut(120);
  fx.glitch = 0;
  world.extraDarkness = 0;
  await d.wait(60);
  // The real world: a school morning. He slept the whole night. He wakes up rested, and nothing is missing.
  await d.narrate(['Tu as dormi toute la nuit.', 'Tu ne te souviens d\'aucun rêve.']);
  d.load('appartement_silence', 'noa');
  G.state.flags.interlude = REAL.finale;
  world.hideBanner();
  d.face('player', 'down');
  d.spawn({ id: 'maman', char: 'maman', x: 29, y: 5, dir: 'left' });
  await d.fadeIn(60);
  d.sfx('bird', { vol: 0.3 });
  await d.wait(30);
  await d.say(['Il fait beau.', 'Tu as faim. Ça ne t\'était pas arrivé depuis longtemps.']);
  await d.walkTo('player', 10, 4, 1);
  d.face('player', 'up');
  await d.say(['Au bout du couloir, la porte du débarras.', 'Une pancarte, écrite au gros feutre : DÉBARRAS.']);
  await d.say('Tu ne t\'es jamais demandé ce qu\'il y avait dedans.');
  d.face('player', 'right');
  await d.walkTo('player', 27, 4, 1.1);
  await d.walkTo('player', 27, 5, 1);
  d.face('player', 'right');
  d.face('maman', 'left');
  await d.say(['Bonjour, mon grand.', 'Tu as bien dormi ?'], 'maman:happy');
  await d.say('Oui. Super bien.', 'noa:happy');
  await d.say(['Tu manges. Tout.', 'Maman te regarde manger comme si c\'était un miracle.']);
  await d.say('Tu souris. Ça ne te fait pas mal.');
  await d.wait(60);
  await d.say(['Tu sais…', 'Ta sœur aurait eu neuf ans cette année.'], 'maman:sad');
  await d.wait(40);
  await d.say('Qui ?', 'noa:neutral');
  await d.wait(120);
  // Three knocks from the storeroom. Nobody moves.
  for (let i = 0; i < 3; i++) {
    d.sfx('knock1', { vol: 0.5, pitch: 0.95 });
    await d.wait(32);
  }
  await d.wait(30);
  await d.say('Trois coups. Dans le débarras.');
  await d.wait(90);
  await d.say('Personne ne bouge.');
  await d.wait(60);
  await d.say(['Bon. Je vais être en retard.', 'À ce soir !'], 'noa:happy');
  await d.walkTo('player', 27, 4, 1.1);
  await d.walkTo('player', 2, 4, 1.2);
  d.face('player', 'up');
  d.sfx('door');
  d.show('player', false);
  await d.wait(60);
  await d.emote('maman', '…', 80);
  await d.fadeOut(120);
  d.remove('maman');
  await d.image('fin_silence', [
    'Noa va bien.',
    'Il dort la nuit. Il mange. Au collège, il sourit.',
    'Au bout du couloir, il y a un débarras.',
    'Personne n\'y range plus rien.',
  ]);
  await d.fadeOut(1);
  await d.wait(40);
  await d.narrate('…');
  await finishGame(d, 'silence');
}

// ---------------------------------------------------------------------------------------------------------------------
// Debug entry points (?debug=script&name=…)
// ---------------------------------------------------------------------------------------------------------------------

/** The finale reached for real, in Mina's room: the poem written, the nightlight plugged in, Maman home. */
function dawnBase(flags: Record<string, string | number | boolean> = {}): void {
  Object.assign(
    G.state.flags,
    {
      interlude: REAL.finale,
      fin_route: 'aube',
      fin_dodo: true,
      fin_tiroir: true,
      fin_veilleuse_prise: true,
      fin_porte: true,
      fin_room: true,
      fin_plugged: true,
      fin_carnet: true,
    },
    flags,
  );
  if (!G.state.flags.fin_poem) {
    const w = (text: string, emotion: 'joie' | 'tristesse' | 'neutre') => ({ text, emotion });
    const words = [w('lune', 'joie'), w('coton', 'joie'), w('pluie', 'tristesse'), w('promesse', 'joie'), w('absente', 'tristesse'), w('lumière', 'joie')];
    if (G.state.flags.fin_ending === 'aube_blanche') words.push(w('j\'étais là', 'neutre'));
    G.state.flags.fin_poem = composePoem(words).join('\n');
  }
  G.state.chapter = 6;
}

/** Mina's room with Maman, Noa and Maman in each other's arms (the radiator has knocked). */
async function inMinaRoom(d: Director, hugging: boolean): Promise<void> {
  d.load('chambre_mina', 'door');
  world.hideBanner();
  d.player.x = 6 * TILE + 8;
  d.player.y = 5 * TILE + 14;
  d.spawn({ id: 'maman', char: 'maman', x: 6, y: 6, dir: 'up' });
  if (hugging) {
    d.show('maman', false);
    d.show('player', false);
    d.spawn({ id: 'hug', sprite: 'pose_hug', x: 6, y: 5, solid: false });
  }
  world.snapCamera();
  await d.fadeIn(10);
}

/** Every condition of the secret ending (§ 5), in the memory and the run. */
function secretConditions(): void {
  if (!G.meta.endings.includes('aube')) G.meta.endings.push('aube');
  G.meta.callVersion = 'sais_pas';
  Object.assign(G.state.flags, { c5_fievre: true, c5_corrige: 0, c6_pile: true, i4_pile: true, c1_bouton: true });
}

export const DEBUG: Record<string, Script> = {
  /** Aube: the sunrise in Mina's room, then the whole epilogue (add &flags=c5_coquillage42,i3_reply=pardon…). */
  fin_aube: async (d) => {
    dawnBase({ fin_ending: 'aube' });
    await inMinaRoom(d, true);
    await endingAube(d);
  },
  /** Aube blanche: the sun of correction fluid, then the white epilogue (« Je venais tous les jours. »). */
  fin_aube_blanche: async (d) => {
    dawnBase({ fin_ending: 'aube_blanche', c5_corrige: 3 });
    await inMinaRoom(d, true);
    await endingAubeBlanche(d);
  },
  /** Veilleuse: from « Le découdre » (every condition met), to the epilogue and its drawings. */
  fin_veilleuse: async (d) => {
    secretConditions();
    dawnBase();
    await inMinaRoom(d, false);
    d.face('player', 'down');
    await endingVeilleuse(d);
  },
  /** Beaux rêves: from the threshold of the voice chamber, after [Rester]. */
  fin_beaux_reves: async (d) => {
    G.state.chapter = 6;
    G.state.flags.c6_voix_vue = true;
    d.load('voix', 'seuil');
    await d.fadeIn(10);
    await afterFinalBattle(d, 'beaux_reves');
  },
  /** Silence: from the threshold of the voice chamber, on the route of the ink. */
  fin_silence: async (d) => {
    G.state.chapter = 6;
    G.state.flags.c6_voix_vue = true;
    d.load('voix', 'seuil');
    await d.fadeIn(10);
    await afterFinalBattle(d, 'silence');
  },
};

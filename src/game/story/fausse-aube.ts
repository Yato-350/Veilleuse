import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { tr } from '../../i18n';
import type { Director } from '../director';
import { setPageTitle } from '../meta';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { CREDIT_LINES, CreditsScene, type CreditLine } from '../scenes/credits';
import { TitleScene } from '../scenes/title';
import { G, writeMeta, type GameState } from '../state';
import { isSilenceRoute, REAL } from './common';
import { inBed } from './real';
import { interlude3 } from './real-nuit';

/**
 * La fausse aube (docs/HISTOIRE.md § 2.2 T1, § 3.9, § 4 « Fausse aube », § 5 « Fin heureuse »). Chapter 3 ends — Dodo
 * gave in far too easily — and Noa wakes up (wakeUp(3), STORY.wake[3]) into a morning that is too beautiful: the
 * bedroom and the apartment in their `faux` variant (src/data/maps/fausse-aube.ts), birdsong that loops, a crayon sun
 * in a window on the wrong wall, Maman already sitting on the bed, speaking only in the words of her fridge notes.
 * The narrator lies openly (« Tout va bien. »). Mina is nowhere: not missing — never there. Then the hug, the close-up
 * (`faux_aube`: her mouth sewn shut with red thread; on the route of the ink, `faux_aube_encre`: her face is a blot of
 * ink), and the fake credits, laid out like the real ones, stuck on « Mina ……… introuvable »:
 *   [Regarder]          the credits rewind (the music backwards, the names un-write themselves), the chapter 3 card
 *                       comes back, and Noa, for the first time of his own accord: « Non. » … « C'est pas tout. ». The
 *                       crayon « FIN » of Mina's notebook is crossed out in ballpoint, and the night goes on:
 *                       Interlude III (real-nuit.ts).
 *   [Laisser défiler]   the « Fin heureuse »: the credits roll to « Merci d'avoir joué ! — Dodo », the title comes back
 *                       in cross-stitch with a single « Continuer », which leads back to the stuck line, one more
 *                       « introuvable » each time. On the third pass Mina whispers « Noa. Regarde. » and only
 *                       [Regarder] is left. Never recorded as an ending; no more than three passes.
 * Autosave at the very start: a save loaded on the false dawn's maps replays it from the white (enter hooks).
 *
 * Flags (fa_*):
 *   fa_reste     set by chapter 3: [Rester] was chosen at the end of the battle against Dodo (Maman: « Tu es resté.
 *                C'est bien. »)
 *   fa_debut     the false dawn has started (the autosave is taken right after)
 *   fa_maman     Maman has left the bedroom: she waits in the kitchen; the bedroom door opens on the apartment
 *   fa_appart    the apartment has been entered once
 *   fa_mot       fridge notes Maman has said aloud in the kitchen; fa_bras: she has opened her arms (she keeps them
 *                open); fa_pates: the pasta was eaten; fa_photo: the photo on the floor was turned over
 *   fa_calin     the hug (then the close-up and the fake credits)
 *   fa_tours     passes of the fake credits, 1–3 (« Laisser défiler » once or twice, then « Regarder »)
 *   fa_fin       « C'est pas tout. »: the false dawn is over (Interlude III begins)
 *   fa_n_<key>   how many times an inspection with changing text was read (look())
 * G.meta.fauxGenerique: +1 each time the fake credits are reached (kept across runs; NG+ lines of lot 10 read it).
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);

/** The false dawn has been played in this page session for this run (a save loaded on its maps replays it). */
const LIVE = new WeakSet<GameState>();
/** The opening is running (its own map loads must not start it again). */
let playing = false;

/** On the route of the ink, Maman's face is a blot of ink (sprites `_encre`, no portrait). */
const ink = (): boolean => isSilenceRoute();
const who = (): string => (ink() ? 'mamanvoix' : 'maman:happy');
/** Maman's sprite: `pose` '' standing, 'assise' on the bed, 'bras' arms open. */
const mamanSprite = (pose: '' | 'assise' | 'bras'): string => `pose_fa_maman${pose ? `_${pose}` : ''}${ink() ? '_encre' : ''}`;

/** Maman waits in the kitchen (after leaving the bedroom, until the hug). */
export const mamanInKitchen = (): boolean => flag('fa_maman') && !flag('fa_calin');

type Lines = string | string[];

/** How many times this inspection was done (then counts it). */
function nth(key: string): number {
  const k = `fa_n_${key}`;
  const n = num(k);
  G.state.flags[k] = n + 1;
  return n;
}

/** An inspection whose text changes each time (the last one repeats). */
const look =
  (key: string, sets: Lines[]): Script =>
  async (d) => {
    await d.say(sets[Math.min(nth(key), sets.length - 1)]!);
  };

// ---------------------------------------------------------------------------------------------------------------------
// Birdsong: the same three chirps, in the same order, every five seconds. Never one more.
// ---------------------------------------------------------------------------------------------------------------------

let birdToken = 0;
const onFauxMap = (): boolean => world.map?.id === 'chambre_faux' || world.map?.id === 'appartement_faux';

function startBirds(): void {
  const token = ++birdToken;
  const alive = (): boolean => token === birdToken && onFauxMap();
  void (async () => {
    for (;;) {
      for (const [gap, pitch] of [
        [0, 1],
        [16, 1.12],
        [18, 0.94],
      ] as const) {
        if (gap) await game.wait(gap);
        if (!alive()) return;
        audio.sfx('bird', { pitch, vol: 0.55 });
      }
      await game.wait(300);
      if (!alive()) return;
    }
  })();
}

const stopBirds = (): void => {
  birdToken++;
};

// ---------------------------------------------------------------------------------------------------------------------
// The opening (points 1 to 4 of § 3.9)
// ---------------------------------------------------------------------------------------------------------------------

/** STORY.wake[3]: the whole false dawn, from the white. Also replayed when a save is loaded on its maps. */
export async function play(d: Director): Promise<void> {
  playing = true;
  LIVE.add(G.state);
  try {
    await opening(d);
  } finally {
    playing = false;
  }
}

async function opening(d: Director): Promise<void> {
  // A new run of the dawn: what this one saw is forgotten (fa_reste comes from chapter 3 and stays).
  for (const k of Object.keys(G.state.flags)) if (k.startsWith('fa_') && k !== 'fa_reste') delete G.state.flags[k];
  G.state.flags.interlude = REAL.i3;
  G.state.chapter = 3;
  G.state.party = [];
  setPageTitle(null);
  audio.stopMusic(1);
  audio.tempoScale = 1;
  d.ambience('none');
  fx.glitch = 0;
  // (One frame first: a save being loaded fades the screen in by itself; the dawn starts from the white.)
  await d.wait(1);
  fx.setFade(1, '#ffffff');
  d.load('chambre_faux', 'bed');
  inBed(d, true);
  const m = d.spawn({ id: 'maman_lit', sprite: mamanSprite('assise'), x: 2, y: 4, solid: false, shadow: false });
  m.ox = -6;
  m.oy = -3;
  d.set('fa_debut');
  // The autosave of § 3.9, point 7: loading it plays the false dawn again from here.
  d.save();
  startBirds();
  await d.wait(60);
  const brown = { color: '#6a4a3a' };
  await d.narrate('Tu te réveilles.', brown);
  await d.wait(30);
  await d.narrate('Des oiseaux.', brown);
  await d.narrate(['La lumière est chaude.', 'Il fait beau.'], brown);
  await d.fadeIn(110);
  await d.wait(40);
  await d.say(['La lumière entre à flots. Elle est jaune, épaisse, comme du miel.', 'Tu n\'as pas froid. Tu n\'as pas mal à la tête.']);
  await d.say(['Dodo est assis sur l\'oreiller, la tête tournée vers la porte.', 'La veilleuse est éteinte.']);
  await d.wait(30);
  await d.say('Tout va bien.');
  await d.wait(30);
  // 3. Maman, already there. No keys, no door.
  await d.say(['Maman est assise au bord du lit.', 'Tu n\'as pas entendu les clés. Tu n\'as pas entendu la porte.']);
  await d.say('Tu es réveillé.', who());
  await d.wait(20);
  inBed(d, false);
  d.sfx('step', { pitch: 0.6 });
  // A step aside, to see her (she sits at the edge of the bed, where he got up).
  await d.walk('player', 1, 0, 0.8);
  d.face('player', 'left');
  await d.wait(20);
  await d.say('…Maman ?', 'noa:surprised');
  await d.say(['Noa, mange quelque chose, s\'il te plaît.', 'Je t\'aime. Tiret. Maman.'], who());
  await d.say('…Quoi ?', 'noa:tired');
  await d.say('Il y a des pâtes.', who());
  if (ink()) await d.say(['Elle sourit.', 'Tu le sais. Tu n\'as pas besoin de voir son visage pour le savoir.']);
  else await d.say(['Elle sourit. Elle souriait déjà quand tu as ouvert les yeux.', 'Elle n\'a pas changé d\'expression depuis.']);
  await d.say('Tu dors ?', who());
  await d.say('…Non. Je suis réveillé. Je crois.', 'noa:tired');
  await d.say('Tu dors ?', who());
  // 4. What she cannot know.
  if (flag('fa_reste')) {
    await d.wait(30);
    await d.say('Tu es resté. C\'est bien.', who());
    await d.say('…Comment tu sais ça ?', 'noa:surprised');
    await d.wait(20);
    await d.say('Il y a des pâtes.', who());
  }
  // She is gone between two blinks.
  await d.wait(20);
  await d.say('Tu clignes des yeux.');
  await d.fadeOut(4);
  d.remove('maman_lit');
  await d.wait(14);
  await d.fadeIn(4);
  await d.wait(40);
  await d.say(['Le drap est encore creusé, là où elle était assise.', 'Il est froid.']);
  await d.say(['Ça sent les pâtes, jusqu\'ici.', 'Elle est dans la cuisine. Tu le sais.']);
  d.set('fa_maman');
}

/** A save loaded on the false dawn's maps: the dawn starts again from the white. */
async function replayIfLoaded(d: Director): Promise<boolean> {
  if (playing || LIVE.has(G.state) || flag('fa_fin')) return false;
  await play(d);
  return true;
}

export const chambreEnter: Script = async (d) => {
  if (await replayIfLoaded(d)) return;
  world.extraDarkness = 0;
  if (flag('fa_maman') && !flag('fa_calin')) startBirds();
};

export const appartEnter: Script = async (d) => {
  if (await replayIfLoaded(d)) return;
  world.extraDarkness = 0;
  if (!flag('fa_calin')) startBirds();
  const m = d.find('maman');
  if (m) m.sprite = mamanSprite(flag('fa_bras') ? 'bras' : '');
  if (!flag('fa_appart')) {
    d.set('fa_appart');
    await d.wait(20);
    await d.say(['Le couloir. Le soleil entre par toutes les fenêtres à la fois.', 'Tout est rangé. Tout est propre. Tout est à sa place.']);
    await d.say('Il ne manque rien.');
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// The bedroom
// ---------------------------------------------------------------------------------------------------------------------

export const bed = look('lit', [
  ['Ton lit. Les draps sont tirés, bien à plat.', 'Quelqu\'un a fait ton lit pendant que tu étais encore dedans.'],
  ['Tu n\'as pas sommeil.', 'C\'est le matin. Tu n\'auras plus jamais sommeil.'],
]);

export const nightlight = look('veilleuse', [
  ['La veilleuse est éteinte. Débranchée.', 'Le fil est enroulé autour, bien serré. Comme quand on range quelque chose pour longtemps.'],
  ['Tu n\'en as plus besoin.', 'Il fait jour.'],
  ['Tu ne te souviens pas de l\'avoir débranchée.', 'Quelqu\'un l\'a fait. Dans le noir. Sans allumer.'],
  'La veilleuse. Éteinte. Tout va bien.',
]);

export const dodo: Script = async (d) => {
  const n = nth('dodo');
  if (n === 0) {
    await d.say(['Dodo est assis sur l\'oreiller.', 'Il regarde la porte. Il attend quelqu\'un.']);
    const r = await d.ask('Appuyer sur son ventre ?', ['Appuyer', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    await d.say(['Tu appuies. Rien.', 'Pas un clic. Pas même la friture.']);
    await d.say('Il dort. Tout le monde dort bien, ici.');
    return;
  }
  if (n === 1) {
    await d.say(['Tu tournes Dodo vers toi.', 'Tu te retournes une seconde.']);
    await d.wait(20);
    await d.say('Il regarde la porte.');
    return;
  }
  await d.say('Dodo regarde la porte. Tu ne le touches plus.');
};

export const calendar = look('calendrier', [
  ['Le calendrier. Toutes les cases sont barrées, au feutre vert.', 'Il n\'en reste aucune. Tu peux arrêter de compter.'],
  ['Dans chaque case, au crayon, la même chose : « elle va mieux !! ».', 'Dans toutes les cases. Jusqu\'à la dernière.'],
  ['« elle va mieux !! »', 'Tu ne sais plus de qui tu parlais.'],
]);

export const paleWall = look('mur_clair', [
  ['Sur le papier peint, un rectangle plus clair.', 'Comme quand on décroche un cadre resté très longtemps au même endroit.'],
  ['Une fenêtre. Il y avait une fenêtre, ici.', 'Avec la pluie dessus, la nuit.'],
  'Il n\'y a jamais rien eu là.',
]);

export const desk = look('bureau', [
  ['Ton bureau. Rangé. Les cahiers empilés par taille.', 'Le tiroir est fermé.'],
  ['Le tiroir est fermé.', 'Tu n\'as pas besoin de l\'ouvrir. Il n\'y a rien dedans. Rien à toi.'],
]);

export const phone = look('telephone', [
  ['Ton téléphone. Aucune notification.', 'Pas de message. Pas d\'appel manqué. Rien d\'il y a un an.'],
  ['L\'heure, sur l\'écran : 6:00.', 'La date, en dessous, tu n\'arrives pas à la lire. Les chiffres sont dessinés.'],
  ['Tu cherches un fil, épinglé tout en haut. Avec un petit mouton.', 'Il n\'y est pas. Il n\'y a jamais été.'],
]);

export const chair = look('chaise', [['Ta chaise. Ton sweat est plié dessus.', 'Plié. Les manches rentrées. Tu ne plies jamais rien.']]);

export const poster = look('poster', [
  ['Le poster du système solaire.', 'Pluton est revenue avec les autres. Elle n\'est plus toute seule, au bout.'],
  ['Quelqu\'un disait que Pluton était triste, d\'être toute seule au bout.', '…Qui disait ça, déjà ?'],
]);

export const shelf = look('etagere', [
  ['Tes livres. Rangés par couleur, du rouge au violet.', 'Tu ne les as jamais rangés par couleur.'],
  ['Entre deux livres, une place vide.', 'Juste la largeur d\'un carnet à spirale.'],
]);

export const radiator = look('radiateur', [
  ['Le radiateur. Tiède. Silencieux.', 'Il ne cogne pas. Il n\'a jamais cogné.'],
  ['Tu poses la main sur le mur, à côté.', 'Rien ne frappe, de l\'autre côté. Il n\'y a rien, de l\'autre côté.'],
]);

export const clock = look('horloge', [
  'L\'horloge. Six heures pile.',
  ['Toujours six heures.', 'La trotteuse tremble sur place, comme si elle avait peur d\'avancer.'],
  'Tu ne l\'as jamais entendue faire tic.',
]);

export const bigWindow = look('fenetre', [
  ['La fenêtre.', 'Le soleil se lève dedans. Il fait si beau.'],
  ['Le soleil est un rond jaune, avec des rayons.', 'Des traits de crayon. Ça déborde un peu. Un rayon est beaucoup trop long.'],
  ['Ta chambre donne sur la cour. À l\'ouest.', 'Tu n\'as jamais vu le soleil se lever d\'ici.'],
  ['Il y avait une armoire, contre ce mur.', '…Non. Il y a toujours eu une fenêtre. Tout va bien.'],
]);

export const plant = look('plante', [
  ['La plante est verte, brillante, parfaite.', 'Tu frottes une feuille entre tes doigts. Elle couine. Du plastique.'],
  '…Non. Elle a toujours été comme ça.',
]);

export const trash = look('corbeille', [['La corbeille est vide.', 'Pas un mouchoir. Pas un dessin froissé. Rien que tu n\'aies pas réussi à jeter.']]);

export const photo: Script = async (d) => {
  if (flag('fa_photo')) {
    await d.say(['Maman et toi, au parc. Vous souriez.', 'À côté de vous, l\'herbe. Beaucoup d\'herbe.']);
    return;
  }
  await d.say('Une photo, par terre, face contre le sol.');
  const r = await d.ask('La retourner ?', ['La retourner', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('fa_photo');
  d.sfx('pop', { pitch: 0.9, vol: 0.4 });
  await d.say('Tu la retournes. Facilement.');
  await d.say(['Maman et toi, au parc, l\'été. Vous souriez.', 'À côté de vous, il y a beaucoup de place. Une place bien nette, au milieu de l\'herbe.']);
  await d.wait(20);
  await d.say('Il ne manque personne.');
};

// ---------------------------------------------------------------------------------------------------------------------
// The apartment
// ---------------------------------------------------------------------------------------------------------------------

export const coat = look('portemanteau', [
  ['Le portemanteau. Ton blouson. Le manteau de Maman.', 'C\'est tout. Il y a trois crochets.'],
  ['Le troisième crochet est tout en bas. À hauteur d\'enfant.', 'Il est vide. Il a toujours été vide.'],
]);

export const shoes = look('chaussures', [['Tes baskets. Les chaussures de Maman.', 'Deux paires. Le compte est bon.']]);

export const frontDoor = look('porte_entree', [
  ['La porte d\'entrée. Pas de clés dans la serrure.', 'Maman n\'a pas eu besoin de clés.'],
  ['Tu tournes la poignée. Elle tourne dans le vide, sans fin.', 'Il n\'y a pas besoin de dehors, ce matin.'],
]);

export const familyPhoto = look('photo_famille', [
  ['Une photo de famille, dans un cadre doré.', 'Maman et toi. Vous êtes deux. Vous avez toujours été deux.'],
  ['Sur l\'étagère, dans la poussière, la trace d\'un autre cadre. Plus petit.', 'Il n\'y est plus.'],
]);

/** Where Mina's door should be: wallpaper. Warm to the touch. Then one knock. */
export const minaWall: Script = async (d) => {
  const n = nth('mur_mina');
  if (n === 0) {
    await d.say(['Le mur du couloir. Du papier peint à pois.', 'Entre ta porte et la salle de bains. Il n\'y a rien entre ta porte et la salle de bains.']);
  } else if (n === 1) {
    await d.say(['Tu passes la main sur le mur.', 'Il est tiède. Comme une porte qu\'on vient de refermer.']);
  } else if (n === 2) {
    await d.say('Tu colles ton oreille contre le papier peint.');
    await d.wait(60);
    d.sfx('knock1', { vol: 0.5, pitch: 0.9 });
    await d.wait(40);
    await d.say(['Toc.', 'Un coup. Un seul.']);
    await d.wait(30);
    await d.say('Les tuyaux. Sûrement les tuyaux.');
  } else {
    await d.say(['Il n\'y a jamais eu de porte ici.', 'Tout va bien.']);
  }
};

export const hallClock = look('horloge_couloir', [['L\'horloge du couloir. Six heures.', 'Ici aussi.']]);

export const bathroomDoor = look('salle_de_bains', [
  ['La salle de bains. Dans le miroir, tu as bonne mine.', 'Tu n\'as jamais eu bonne mine.'],
  ['Tu souris au miroir.', 'Ton reflet sourit une seconde de trop.'],
]);

export const beachPicture = look('tableau', [
  ['Un tableau : une plage, l\'été.', 'Le sable est lisse. Pas un coquillage. Personne n\'a rien ramassé.'],
  ['Vous y êtes allés une fois, tous les deux.', 'Tous les deux.'],
]);

export const mamanDoor = look('porte_maman', [['La chambre de Maman. Le lit est fait.', 'Elle n\'a pas dormi dedans. Elle n\'a pas eu besoin de dormir.']]);

export const hallPlant = look('plante_couloir', [['Une plante verte. Trop verte.', 'Elle a toutes ses feuilles. Elle les a toujours eues.']]);

export const tv = look('tele', [
  ['La télé est allumée. Une émission du matin.', 'Des gens sourient sur un canapé. Ils te regardent. Ils te sourient, à toi.'],
  ['Tu changes de chaîne. Les mêmes gens. Le même sourire.', 'Ils n\'ont pas cligné des yeux.'],
]);

export const smallWindow = look('fenetres', [
  ['Une fenêtre. Le soleil, dedans.', 'Le même rond jaune, avec les mêmes rayons.'],
  ['Le même soleil, dans toutes les fenêtres de l\'appartement.', 'Au même endroit. Exactement.'],
]);

export const sofa = look('canape', [['Le canapé. Les coussins sont tapés, alignés.', 'Personne ne s\'y est jamais endormi devant un dessin animé.']]);

export const lamp = look('lampe', [['Le lampadaire est allumé.', 'En plein jour. Pour que ce soit encore plus clair.']]);

export const paleFloor = look('sol_clair', [
  ['Sur le parquet, un rectangle plus clair.', 'Quelque chose est resté posé là très longtemps. Une boîte. Un coffre.'],
  ['Tu ne sais plus quoi.', 'Ça ne doit pas être important.'],
]);

export const fridge = look('frigo', [
  ['Le frigo. Sous l\'aimant fraise, un mot.', 'Le papier est blanc. Il n\'y a rien d\'écrit.'],
  'Maman a déjà tout dit à voix haute.',
]);

export const drawings = look('dessins', [
  ['Des dessins scotchés au-dessus du plan de travail.', 'Des soleils. Rien que des soleils, au crayon jaune. Tous pareils.'],
  ['Avant, il y avait un mouton qui faisait du vélo. Et un garçon avec des cheveux tout bleus.', '…Avant quand ?'],
]);

export const counter = look('plan', [['Le plan de travail brille. Pas une miette.', 'Une pile d\'assiettes propres. Personne n\'a faim, ici. Personne n\'en a besoin.']]);

export const sink = look('evier', [['L\'évier. Le robinet ne goutte plus.', 'Plic. …Non. Plus rien.']]);

export const stove: Script = async (d) => {
  if (flag('fa_pates')) {
    await d.say(['La casserole est encore pleine.', 'Tu en as mangé. Elle est encore pleine.']);
    return;
  }
  await d.say(['Une casserole de pâtes. Chaudes.', 'Elles fument. Elles fumaient déjà quand tu es arrivé. Elles fumeront encore quand tu partiras.']);
  const r = await d.ask('Manger ?', ['Manger', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('fa_pates');
  await d.say(['Tu manges, debout.', 'Ça n\'a aucun goût. Ça a le goût de « bien ».']);
  if (mamanInKitchen()) await d.say('Il y a des pâtes.', who());
};

export const bills = look('factures', [['Pas de factures. Pas de rendez-vous entouré en rouge.', 'Rien d\'urgent. Plus jamais rien d\'urgent.']]);

export const table = look('table', [
  ['La table de la cuisine. Deux chaises. Deux bols.', 'Le compte est bon.'],
  ['Sur le carrelage, sous la table, quatre petites marques.', 'Là où une troisième chaise a raclé le sol, pendant des années.'],
]);

export const kitchenChair = look('chaise_noa', ['Ta chaise.']);

export const kitchenTrash = look('poubelle', [['La poubelle est vide. Elle sent le propre.']]);

// ---------------------------------------------------------------------------------------------------------------------
// Maman in the kitchen: the fridge notes, aloud, and her arms open
// ---------------------------------------------------------------------------------------------------------------------

/** The words of her fridge notes (and of one message), in the order she says them, again and again. */
const NOTES: string[][] = [
  ['Tu as mangé ?'],
  ['Il y a des pâtes.', 'Bisous sur ton front.'],
  ['Le chat des voisins passe par le balcon.', 'Il s\'appelle Biscotte.'],
  ['Tu dors ? Je rentre tard.', 'Je t\'aime.'],
  ['Elle va un peu mieux.', 'Cœur.'],
  ['Noa, mange quelque chose, s\'il te plaît.', 'Je t\'aime. Tiret. Maman.'],
];

export const mamanKitchen: Script = async (d) => {
  const n = num('fa_mot');
  d.set('fa_mot', n + 1);
  const k = n % NOTES.length;
  await d.say(NOTES[k]!, who());
  if (k === 2) {
    await d.say('…Qui ?', 'noa:tired');
    await d.say('Ne lui donne pas les pâtes.', who());
  } else if (k === 3) {
    await d.say('…Mais tu es là.', 'noa:tired');
  } else if (k === 4) {
    await d.say('…Qui ça, « elle » ?', 'noa:surprised');
    await d.wait(30);
    await d.say('Elle sourit.');
  }
  if (!flag('fa_bras')) {
    d.set('fa_bras');
    const m = d.find('maman');
    if (m) m.sprite = mamanSprite('bras');
    d.sfx('step', { pitch: 0.8, vol: 0.5 });
    await d.wait(20);
    await d.say('Elle ouvre les bras.');
  } else {
    await d.say(['Elle a toujours les bras ouverts.', 'Elle ne les a pas baissés. Pas une seconde.']);
  }
  const r = await d.ask('Te blottir contre elle ?', ['Se blottir', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say(n === 0 ? 'Elle attend. Elle a tout son temps.' : 'Elle attend. Elle a tout le temps du monde. Ici, il n\'y a que ça.');
    return;
  }
  await hug(d);
};

/** The hug, the close-up (5), then the fake credits (6). */
async function hug(d: Director): Promise<void> {
  d.set('fa_calin');
  const m = d.get('maman');
  const p = d.player;
  const hx = Math.round((m.x + p.x) / 2 / 16 - 0.5);
  const hy = Math.round(Math.max(m.y, p.y) / 16 - 1);
  d.show('maman', false);
  d.show('player', false);
  d.spawn({ id: 'hug', sprite: 'pose_hug', x: hx, y: hy, solid: false });
  await d.wait(70);
  await d.say(['Elle te serre fort.', 'Elle sent la lessive. Pas l\'hôpital. Pas le café de la nuit.']);
  await d.say('Je t\'aime. Tiret. Maman.', who());
  await d.wait(30);
  await d.say('…', 'noa:tired');
  stopBirds();
  await d.fadeOut(60, '#fff3e0');
  if (ink()) await d.image('faux_aube_encre', ['Elle te serre fort.', 'Tu cherches son visage. Il n\'y a que de l\'encre.', 'Tu la reconnais. C\'est la tienne.']);
  else await d.image('faux_aube', ['Elle te serre fort, et elle sourit.', 'Elle sourit tout le temps.', 'Elle ne peut rien faire d\'autre.']);
  await fakeCredits(d);
}

// ---------------------------------------------------------------------------------------------------------------------
// The fake credits (6) and the « Fin heureuse »
// ---------------------------------------------------------------------------------------------------------------------

/** The stuck line of each pass: one more « introuvable » every time. */
export const minaCredit = (pass: number): string => ['Mina ………', ...Array.from({ length: pass }, () => 'introuvable')].join(' ');

/** Laid out exactly like the real credits, with a cast where Mina cannot be found (and the player can). */
export function fauxCreditLines(pass: number): { lines: CreditLine[]; stop: number } {
  const mina: CreditLine = [minaCredit(pass)];
  const memory: CreditLine[] = G.meta.endingsV1.length ? [['Tu croyais que c\'était fini, la dernière fois.', '#8a7f96'], ['']] : [];
  const lines: CreditLine[] = [
    ...CREDIT_LINES.slice(0, 4),
    ['— Distribution —', '#8a7f96'],
    ['Noa ……… Noa'],
    ['Maman ……… Maman'],
    ['Dodo ……… Dodo'],
    ['Madame Lune ……… Madame Lune'],
    ['Chaussette ……… Chaussette'],
    mina,
    ['Toi ……… {player}'],
    [''],
    ...CREDIT_LINES.slice(4, -1),
    ...memory,
    CREDIT_LINES[CREDIT_LINES.length - 1]!,
  ];
  return { lines, stop: lines.indexOf(mina) };
}

async function fakeCredits(d: Director): Promise<void> {
  stopBirds();
  G.meta.fauxGenerique++;
  writeMeta(G.meta);
  for (let pass = num('fa_tours') + 1; ; pass++) {
    d.set('fa_tours', pass);
    const { lines, stop } = fauxCreditLines(pass);
    const c = CreditsScene.open({ lines, signature: 'Merci d\'avoir joué ! — Dodo', music: 'faux_generique' });
    const last = pass >= 3;
    const choices = last ? ['Regarder'] : ['Laisser défiler', 'Regarder'];
    const i = await c.stopAt(stop, choices, last ? () => d.say('Noa. Regarde.', 'minavoix') : undefined);
    if (choices[i] === 'Regarder') {
      await c.rewind();
      d.music(null, 0.3);
      await d.fadeOut(1);
      c.close();
      break;
    }
    // « Fin heureuse »: Dodo's happy end. Never recorded as an ending; the title has a single way out.
    await c.resume();
    await TitleScene.single('point_de_croix');
    game.replace(world);
  }
  await notAll(d);
}

/** « Non. » … « C'est pas tout. » — then the ballpoint crosses out the crayon « FIN », and the night goes on. */
async function notAll(d: Director): Promise<void> {
  await d.wait(30);
  await d.chapter('Chapitre 3', 'L\'Hôpital de Papier', 'Il ne pleut plus que de l\'encre.');
  await d.wait(50);
  // For the first time, Noa speaks up of his own accord.
  await d.say('Non.', 'noa:neutral');
  await d.wait(40);
  await d.say('…', 'noa:sad');
  await d.say('C\'est pas tout.', 'noa:neutral');
  await d.wait(30);
  await crossOut(d);
  d.set('fa_fin');
  LIVE.delete(G.state);
  await d.wait(40);
  await interlude3(d);
  d.save();
}

// ---------------------------------------------------------------------------------------------------------------------
// « FIN », in crayon — crossed out in ballpoint
// ---------------------------------------------------------------------------------------------------------------------

/** The last page of Mina's notebook: « FIN » in orange crayon, a heart; a black ballpoint scratches it out. */
class CrossOutPage implements Scene {
  t = 0;
  done = false;
  private resolve: (() => void) | null = null;
  readonly finished = new Promise<void>((r) => {
    this.resolve = r;
  });

  update(): void {
    this.t++;
    if (this.t > 50 && this.t < 150 && this.t % 7 === 0) audio.sfx('scratch', { vol: 0.3, pitch: 1.1 + (this.t % 3) * 0.1 });
    if (!this.done && (this.t > 240 || (this.t > 160 && input.pressed('a')))) {
      this.done = true;
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    // Squared notebook paper, a red margin, the spiral holes.
    g.fillStyle = '#fff6e0';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e6eaf4';
    for (let y = 12; y < H; y += 12) g.fillRect(0, y, W, 1);
    g.fillStyle = '#f0b4b4';
    g.fillRect(44, 0, 1, H);
    g.fillStyle = '#d8ccb4';
    for (let y = 10; y < H; y += 18) g.fillRect(14, y, 6, 6);
    // « FIN », in crayon (Mina's hand), with a heart.
    const word = tr('FIN');
    const scale = 4;
    const ww = measure(word) * scale;
    const x0 = Math.round(W / 2 - ww / 2);
    const y0 = 62;
    drawText(g, word, x0 + 1, y0 + 1, { color: '#f6c08a', scale });
    drawText(g, word, x0, y0, { color: '#e0834f', scale });
    drawText(g, '♥', x0 + ww + 8, y0 + 10, { color: '#e07ba5', scale: 2 });
    // The ballpoint: a scribble back and forth over the word, top to bottom, then one hard stroke across.
    const p = Math.max(0, Math.min(1, (this.t - 50) / 100));
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 12; i++) pts.push([x0 - 8 + (i % 2 ? ww + 16 : 0) + ((i * 7) % 5) - 2, y0 - 3 + i * 3 + (i % 3)]);
    pts.push([x0 - 10, y0 + 30], [x0 + ww + 14, y0 - 4]);
    const total = pts.length - 1;
    const drawn = p * total;
    g.fillStyle = '#1d2238';
    for (let i = 0; i < Math.ceil(drawn); i++) {
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[i + 1]!;
      const f = Math.min(1, drawn - i);
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * f));
      for (let k = 0; k <= n; k++) {
        const u = (k / n) * f;
        g.fillRect(Math.round(ax + (bx - ax) * u), Math.round(ay + (by - ay) * u), 2, 2);
      }
    }
  }
}

async function crossOut(d: Director): Promise<void> {
  const page = new CrossOutPage();
  game.push(page);
  await d.fadeIn(30);
  await page.finished;
  await d.wait(30);
  await d.fadeOut(50);
  game.remove(page);
}

// ---------------------------------------------------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------------------------------------------------

/** As at the end of chapter 3. */
function setup(flags: Record<string, number | boolean | string> = {}, silence = false): void {
  const s = G.state;
  s.chapter = 3;
  s.party = [];
  Object.assign(s.flags, { c3_intro: true, c3_mina_erased: true, c3_veilleuse: true, c3_dawn_ready: true, ...flags });
  // (These scripts start on the dawn's maps: they must not be taken for a loaded save.)
  LIVE.add(s);
  if (silence) {
    s.spares = {};
    s.kills = { gribouille: 3, nuage: 3, mouton_noir: 2, placard: 1 };
  } else s.spares = { nuage: 1, chaussette_perdue: 1 };
}

/** The apartment, Maman in the kitchen (the opening skipped). */
async function inApartment(d: Director): Promise<void> {
  Object.assign(G.state.flags, { fa_debut: true, fa_maman: true, interlude: REAL.i3 });
  d.load('appartement_faux', 'cuisine');
  await d.fadeIn(20);
}

export const DEBUG: Record<string, Script> = {
  /** The whole false dawn, from the white (as after [Se réveiller]). */
  fausse_aube: async (d) => {
    setup();
    await play(d);
  },
  /** The same after [Rester]: « Tu es resté. C'est bien. » */
  fausse_aube_reste: async (d) => {
    setup({ fa_reste: true });
    await play(d);
  },
  /** The apartment, Maman waiting in the kitchen. */
  fausse_aube_appart: async (d) => {
    setup();
    await inApartment(d);
  },
  /** The route of the ink: her face is a blot of ink. */
  fausse_aube_encre: async (d) => {
    setup({}, true);
    await inApartment(d);
  },
  /** Straight to the fake credits (and the « Fin heureuse » loop). */
  faux_generique: async (d) => {
    setup({ fa_debut: true, fa_maman: true, fa_calin: true });
    d.load('appartement_faux', 'cuisine');
    await fakeCredits(d);
  },
  /** « Non. » … « C'est pas tout. », the crossed-out « FIN », then Interlude III. */
  fausse_aube_fin: async (d) => {
    setup({ fa_debut: true, fa_maman: true, fa_calin: true, fa_tours: 1 });
    d.load('appartement_faux', 'cuisine');
    await d.fadeOut(1);
    await notAll(d);
  },
};

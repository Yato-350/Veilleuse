import { audio } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { rng } from '../../engine/math';
import { SOUVENIRS } from '../../data/illustrations';
import { DODO_WORDS } from '../../data/words';
import type { Battle } from '../battle/battle';
import type { BattleHooks, WordDef } from '../battle/types';
import { director, type Director } from '../director';
import { isLateNight, setPageTitle } from '../meta';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { tf, tr } from '../../i18n';
import { isSilenceRoute, shop, wakeUp } from './common';
import { endingAube, endingBeauxReves } from './endings';
import { makeCrack } from '../battle/final-common';

/**
 * Chapter 3 — « L'Hôpital de Papier ».
 * ruines (the Cotton Country drowned in ink) → hopital (lobby + endless corridor, salle_jeux) → door 304 (Mina is
 * erased) → chambre_304 (souvenir « La veilleuse ») → vide (Dodo's reveal, the short battle of version 2: « pardon »
 * three times, Dodo gives in too easily, and every way out leads to the false dawn, wakeUp(3) → fausse-aube.ts).
 *
 * Flags: c3_intro, c3_village, c3_lit (closet lights the marsh), c3_nook_open (Gomme), c3_hospital_seen, c3_wish,
 * c3_loop (corridor stage 0..3), c3_loop_fails, c3_loops, c3_heard_0..3, c3_plume, c3_cape, c3_door304,
 * c3_mina_erased, c3_veilleuse, c3_dawn_ready (Dodo gave in: the door of light leads to the false dawn), fa_reste
 * ([Rester] was chosen at the end of the battle; read by the false dawn, fausse-aube.ts).
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);
const withMina = (): boolean => G.state.party.includes('mina');
/** Corridor stage: 0..2 = looping corridor, 3 = the last wing with door 304. */
export const stage = (): number => num('c3_loop');
const tile = (px: number): number => Math.floor(px / TILE);

async function mina(d: Director, text: string | string[], expr = 'neutral'): Promise<void> {
  if (withMina()) await d.say(text, `mina:${expr}`);
}

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

/** The chapter card, trembling. */
async function trembleCard(d: Director): Promise<void> {
  let on = true;
  void (async () => {
    while (on) {
      fx.shake(rng.chance(0.3) ? 2 : 1, 8);
      if (rng.chance(0.06)) fx.pulseGlitch(5);
      await d.wait(6);
    }
  })();
  fx.glitch = 0.06;
  await d.chapter('Chapitre 3', 'L\'Hôpital de Papier', 'Il ne pleut plus que de l\'encre.');
  on = false;
  fx.glitch = 0;
}

export async function start(d: Director): Promise<void> {
  G.state.chapter = 3;
  await trembleCard(d);
  d.load('ruines', 'bed');
  d.show('player', false);
  d.music('dodo');
  await d.fadeIn(90);
  await d.wait(40);
  await d.say(['Quelque chose de froid coule sur ton visage.', 'Ce n\'est pas du coton.', 'C\'est de l\'encre.']);
  d.show('player', true);
  d.face('player', 'down');
  d.sfx('step', { pitch: 0.6 });
  await d.wait(40);
  await d.say('Bienvenue à la maison, Noa.', 'dododark:neutral');
  await d.emote('player', '?');
  await d.say('…Dodo ?', 'noa:surprised');
  await d.say(['Personne ne répond.', 'Le Pays de Coton s\'étend devant toi. Noir, luisant, silencieux.']);
  await minaArrives(d);
}

async function minaArrives(d: Director): Promise<void> {
  const p = d.player;
  const tx = tile(p.x);
  const ty = tile(p.y - 2);
  d.sfx('step', { pitch: 1.5 });
  d.spawn({ id: 'mina', char: 'mina', x: tx + 8, y: ty + 1, dir: 'left' });
  await d.walkTo('mina', tx + 1, ty + 1, 1.8);
  d.face('mina', 'up');
  d.face('player', 'down');
  if (isSilenceRoute()) {
    await d.say('…Noa ?', 'mina:neutral');
    await d.say(['T\'as de l\'encre plein les mains.', 'Partout. Jusqu\'aux coudes.'], 'mina:sad');
    await d.say(['Les autres sont partis. Les moutons, la chaussette, l\'armoire…', 'Il reste plus que nous.'], 'mina:sad');
    await d.say(['Noa… le Pays de Coton est malade.', 'Et je crois que c\'est toi qui l\'as rendu malade.'], 'mina:sad');
    await d.say('…', 'noa:sad');
    await d.say(['L\'étoile filante est retombée. Là-bas, vers l\'est.', 'Viens. …Mais marche devant, s\'il te plaît.'], 'mina:neutral');
  } else {
    await d.emote('mina', '!');
    await d.say('Noa ! T\'es revenu !', 'mina:surprised');
    await d.say(['J\'ai eu tellement peur.', 'Je t\'ai attendu, attendu… et tout est devenu noir.'], 'mina:sad');
    await d.say('Noa… le Pays de Coton est malade.', 'mina:sad');
    await d.say(['Les moutons bougent plus. Madame Lune dort pour de vrai.', 'Y a de l\'encre partout. Même dans le ciel.'], 'mina:sad');
    await d.say('…', 'noa:sad');
    await d.say(['Mais j\'ai vu un truc ! Cette nuit, l\'étoile filante est retombée.', 'Pour de vrai, cette fois. Là-bas, tout au bout, vers l\'est.'], 'mina:neutral');
    await d.say(['Si on la trouve, on fait un vœu, et tout redevient comme avant.', 'Hein ? Hein, Noa ?'], 'mina:happy');
    await d.say('Allez, viens. Je te protège. C\'est moi, la chevalière.', 'mina:happy');
  }
  d.remove('mina');
  d.follower('mina');
  world.resetFollower();
  d.set('c3_intro');
}

// ---------------------------------------------------------------------------
// Ruines — the Cotton Country drowned in ink
// ---------------------------------------------------------------------------

export const inkBed: Script = async (d) => {
  if (flag('c3_bed_item')) {
    await d.say(['Le lit au milieu de la prairie.', 'Les draps sont trempés d\'encre. Ils ne sentent plus la lessive de Maman.']);
    return;
  }
  d.set('c3_bed_item');
  await d.say(['Le lit au milieu de la prairie.', 'Les draps sont trempés d\'encre. Ils ne sentent plus la lessive de Maman.', 'Sous l\'oreiller, quelque chose est resté sec.']);
  await d.give('biscuit');
};

export const ruinesVillage: Script = async (d) => {
  if (isSilenceRoute()) {
    await d.say(['Le Village des Moutons.', 'Il n\'y a plus personne. Seulement des flaques noires, là où ils se tenaient.']);
    await mina(d, '…C\'est toi qui as fait ça, Noa ?', 'sad');
    return;
  }
  await d.say(['Le Village des Moutons.', 'Les moutons sont là. Tous. Mais aucun ne bouge.']);
  await mina(d, ['Ils dorment… debout.', 'Je les ai appelés, je les ai secoués. Ils se réveillent pas.'], 'sad');
};

/** A frozen villager: a few lines, and Mina reacts the first time. */
export const frozen =
  (lines: string[]): Script =>
  async (d) => {
    await d.say(lines);
    if (!flag('c3_frozen_seen')) {
      d.set('c3_frozen_seen');
      await mina(d, ['Ils ronflent même pas.', 'Avant, ils ronflaient tellement fort que ça faisait trembler les nuages.'], 'sad');
    }
  };

export const agneauFrozen: Script = async (d) => {
  if (flag('c1_ballon_rendu')) {
    await d.say(['Le petit agneau, figé. Il serre la ficelle de son ballon rouge.', 'Le ballon ne flotte plus. Il pend, lourd d\'encre.']);
    await mina(d, 'Tu lui avais rendu son ballon… Il l\'a gardé. Même maintenant.', 'sad');
  } else {
    await d.say(['Le petit agneau, figé, les yeux levés vers un arbre.', 'Son ballon n\'est jamais redescendu.']);
  }
};

export const luneRuines: Script = async (d) => {
  const n = num('c3_lune');
  d.set('c3_lune', n + 1);
  if (n === 0) {
    await d.say(['Mmmh… *bâille*…', 'Tiens… encore toi… le petit venu par le lit…'], 'lune:neutral');
    if (num('c1_lune') > 0) await d.say('Tu as grandi depuis l\'autre nuit… ou bien c\'est moi qui ai rétréci… Zzz…', 'lune:neutral');
    await d.say(['Il fait si noir… même pour une lune.', 'Le mouton qui veille… il a endormi tout le monde.'], 'lune:neutral');
    await d.say(['Je te l\'avais dit, pourtant… *bâille*…', 'Il veille trop.'], 'lune:neutral');
    return;
  }
  if (n === 1) {
    await d.say(['Tout le monde finit par se réveiller, mon petit…', '…Sauf ceux qu\'on empêche.'], 'lune:neutral');
    if (d.has('veilleuse_poche')) await d.say(['Ta petite lune… garde-la près de toi.', 'Là où tu vas, il fera très noir. Zzz…'], 'lune:neutral');
    return;
  }
  const lines = [
    ['Les hôpitaux… *bâille*… n\'éteignent jamais tout à fait la lumière.', 'Pour ceux qui ont peur du noir.'],
    ['Quand le soleil se lève… même moi, je vais me coucher.', 'C\'est normal. C\'est bien. Zzz…'],
    ['Zzz… zzz…', '…Va, petit. Elle t\'attend.'],
  ];
  await d.say(lines[n % lines.length]!, 'lune:neutral');
};

export const chaussetteRuines: Script = async (d) => {
  const paire = flag('c1_chaussette_paire');
  if (!flag('c3_chaussette')) {
    d.set('c3_chaussette');
    if (isSilenceRoute()) {
      await d.say(['Ah. C\'est toi.', 'Je n\'ai plus beaucoup de clients, tu sais. Plus personne, en fait.', 'Mais une boutique, ça reste ouvert. C\'est comme ça.'], 'chaussette:neutral');
    } else if (paire) {
      await d.say(['Mes chéris ! Vous êtes vivants !', 'Avec ma paire, on a sauvé ce qu\'on a pu de la boutique avant que l\'encre arrive.'], 'chaussette:happy');
      await d.say('Tiens, prends ça. Pour la route. On ne sait jamais ce qui t\'attend là-bas.', 'chaussette:happy');
      await d.give('gateau');
    } else {
      await d.say(['Oh, mon chou… Te voilà.', 'L\'encre a tout pris. Ma boutique, mes bocaux, ma laine…', 'J\'ai gardé un étal. C\'est tout ce qui reste.'], 'chaussette:neutral');
    }
  }
  await shop(
    ['lait', 'biscuit', 'chocolat', 'pomme', 'mouchoir', 'bulles', 'pluie', 'gateau'],
    paire ? 'À deux, on tient le coup ! Prends ce qu\'il te faut, mon chou.' : 'Ce qui reste est à vendre. Tout est un peu taché, mais ça marche encore.',
    undefined,
    paire ? 0.5 : 0,
  );
};

export const chaussettePaireRuines: Script = async (d) => {
  await d.say(['C\'est moi, la paire !', 'On s\'est cachées dans le panier à linge pendant que l\'encre passait. On a eu chaud.'], 'chaussette:happy');
};

export const noticeBoardRuines: Script = async (d) => {
  await d.say(['Le tableau d\'affichage.', 'Les dessins ont coulé. On ne reconnaît plus rien, sauf une couronne.']);
  await mina(d, ['C\'étaient mes dessins…', 'Je les referai. Hein ? Je les referai, après.'], 'sad');
};

export const owlBooks: Script = async (d) => {
  await d.say(['Une pile de livres trempés d\'encre.', 'Ils ont dérivé jusqu\'ici. Ce sont ceux que personne ne lit.']);
  if (flag('c2_hibou_met')) {
    await d.say(['Tu reconnais la reliure : la bibliothèque du Hibou.', 'Sur la couverture du dessus, une écriture ronde : « pour Noa ».', 'Le reste est illisible.']);
  }
};

// --- Helpers who were spared -------------------------------------------------

/** Where the fireflies of the closet light the marsh path (also used by the map). */
export const MARSH_LIGHTS: Array<[number, number]> = [
  [30, 13],
  [33, 16],
  [36, 13],
  [41, 13],
  [38, 9],
  [41, 7],
];

const LIT = (): boolean => flag('c3_lit');

function applyMarsh(): void {
  const lit = LIT();
  world.extraDarkness = lit ? 0.12 : 0.42;
  world.playerLight = G.state.keyItems.includes('veilleuse_poche') ? 62 : 44;
}

export const ruinesEnter: Script = () => {
  if (tile(world.player.x) >= 31) applyMarsh();
};

export const marshEnter: Script = async (d) => {
  applyMarsh();
  if (flag('c3_marsh')) return;
  d.set('c3_marsh');
  if (flag('c1_placard_spared') && !LIT()) {
    await placardLights(d);
    return;
  }
  await d.say(['Le chemin s\'enfonce dans un marais d\'encre.', 'Il fait si noir que tu ne vois plus tes pieds.']);
  await mina(d, ['Noa… donne-moi la main.', 'C\'est pas que j\'ai peur. C\'est pour que TOI t\'aies pas peur.'], 'sad');
  if (d.has('veilleuse_poche')) {
    await d.say(['Tu sors la Veilleuse de poche.', 'Une toute petite lune. Elle n\'éclaire pas grand-chose.', 'Mais c\'est mieux que rien.']);
    await mina(d, 'Ooh. Elle est jolie. On dirait la mienne.', 'neutral');
  }
};

export const marshLeave: Script = () => {
  world.extraDarkness = 0;
  world.playerLight = 44;
};

async function placardLights(d: Director): Promise<void> {
  await d.say(['Le chemin s\'enfonce dans un marais d\'encre. Il fait noir comme dans une armoire.', 'Une armoire…']);
  await d.emote('placard', '!');
  d.sfx('knock', { pitch: 0.8 });
  await d.say(['Petits ! C\'est vous ?', 'Il fait noir partout, maintenant.', 'Mais moi, je n\'ai plus peur du noir. Grâce à vous.'], 'placard');
  await mina(d, 'Le Monstre du Placard ! Le gentil !', 'happy');
  await d.say(['Le chemin vers l\'est est noyé. On n\'y voit rien.', 'Attendez. J\'ai gardé un peu de lumière, au fond de mes tiroirs.'], 'placard');
  d.sfx('door', { pitch: 0.7 });
  await d.wait(20);
  for (const [i, [x, y]] of MARSH_LIGHTS.entries()) {
    d.spawn({ id: `luciole_live_${i}`, sprite: 'npc_luciole', frames: ['npc_luciole', 'npc_luciole_2'], frameSpeed: 14, x, y, float: true, shadow: false, solid: false, light: { r: 46, color: '#ffe991', flicker: true } });
    d.sfx('chime', { pitch: 1 + i * 0.08, vol: 0.4 });
    await d.wait(12);
  }
  d.set('c3_lit');
  applyMarsh();
  await d.say('Des lucioles s\'échappent de l\'armoire et vont se poser le long du chemin.');
  await d.say(['Voilà. Allez-y, petits.', 'Moi, je reste ici. Je garde la lumière allumée. Quelqu\'un doit bien le faire.'], 'placard');
  await mina(d, 'Je te l\'avais dit, qu\'il était gentil en vrai.', 'happy');
}

export const placardTalk: Script = async (d) => {
  if (!LIT()) {
    await placardLights(d);
    return;
  }
  await d.say(['Allez-y, petits. Je garde la lumière.', 'Si vous avez peur, regardez derrière vous. Je serai là.'], 'placard');
};

export const gommeTalk: Script = async (d) => {
  if (flag('c3_nook_open')) {
    await d.say(['Je ne sais pas effacer tout ça. C\'est trop grand.', 'Mais un petit bout… ça, je sais.'], 'gomme');
    return;
  }
  await d.say(['Oh. C\'est toi.', 'Tu m\'as appris à garder. Même ce qui fait mal.'], 'gomme');
  await d.say(['L\'encre, ici, ce n\'est pas un dessin. C\'est de l\'oubli.', 'Mais l\'oubli, ça s\'efface aussi. Regarde.'], 'gomme');
  await openNook(d);
};

async function openNook(d: Director): Promise<void> {
  for (const id of ['ink_plug_a', 'ink_plug_b']) {
    const e = d.find(id);
    if (!e) continue;
    d.sfx('erase');
    world.particles.burst(e.x, e.y - 8, '#f8b6cf', 16, 1.1);
    d.remove(id);
    await d.wait(16);
  }
  d.set('c3_nook_open');
  await d.say(['Voilà. Il y avait quelque chose de caché là-dessous.', 'Garde-le. C\'est fait pour ça, les souvenirs.'], 'gomme');
  await mina(d, 'Merci, Gomme ! T\'es la meilleure gomme du monde.', 'happy');
}

export const inkPlug: Script = async (d) => {
  if (flag('c2_gomme_spared')) {
    await d.say(['Un mur d\'encre qui coule sans fin.', 'Derrière, quelque chose brille faiblement.']);
    await mina(d, 'Gomme est juste à côté ! Elle pourrait peut-être l\'effacer ?', 'neutral');
    return;
  }
  await d.say(['Un mur d\'encre qui coule sans fin.', 'Derrière, quelque chose brille faiblement.', 'Tu tends la main. L\'encre est froide. Elle ne s\'en va pas.']);
};

export const nookChest: Script = async (d) => {
  if (flag('c3_nook_item')) {
    await d.say('Le coffre à jouets est vide. Il sent encore la pâte à modeler.');
    return;
  }
  d.set('c3_nook_item');
  await d.say(['Un coffre à jouets, à l\'abri de l\'encre.', 'Dedans : un thermos de chocolat chaud et une part de gâteau, encore emballée.']);
  await d.give('chocolat');
  await d.give('gateau');
  await mina(d, 'C\'est mon coffre ! Enfin, il ressemble à mon coffre. Enfin… je crois.', 'neutral');
};

// --- The fallen star and the paper hospital ----------------------------------

export const hospitalSeen: Script = async (d) => {
  await d.cameraTo(39, 3);
  await d.wait(20);
  await mina(d, 'Là ! L\'étoile !', 'surprised');
  await mina(d, ['Elle est tombée sur… sur quoi ?', 'C\'est quoi, ce bâtiment ?'], 'neutral');
  await d.say(['Un grand bâtiment plié dans du papier blanc.', 'Des fenêtres aux rideaux verts. Une enseigne : « HÔPITAL ».']);
  await mina(d, ['Un hôpital… en papier.', 'Il était pas là, avant. Je l\'ai jamais dessiné, moi.'], 'sad');
  await mina(d, 'J\'aime pas les hôpitaux. Ça sent le savon qui pique.', 'sad');
  await d.say('…', 'noa:sad');
  d.cameraFollow();
};

export const starFallen: Script = async (d) => {
  if (flag('c3_wish')) {
    await d.say('L\'étoile filante. Elle s\'est éteinte. Elle est froide, maintenant.');
    return;
  }
  await d.say(['L\'étoile filante.', 'Elle ne brille presque plus. Elle est tiède, comme une main qu\'on vient de lâcher.']);
  await mina(d, ['On l\'a trouvée…', 'On fait un vœu ? Il faut faire un vœu, sinon ça porte malheur.'], 'neutral');
  const r = await d.ask('Faire un vœu ?', ['Faire un vœu', 'Pas maintenant'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('c3_wish');
  await d.say(['Tu fermes les yeux.', 'Tu fais un vœu. Tu ne sais pas lequel.', 'Tu sais seulement qu\'il fait mal.']);
  d.heal();
  d.sfx('chime', { pitch: 0.8 });
  const star = d.find('star_fallen');
  if (star) star.light = { r: 18, color: '#ffe991', flicker: true };
  await d.say('L\'étoile s\'éteint doucement, comme une bougie. {c:l}Tes PV sont au maximum.{/c}');
  await mina(d, ['Moi aussi, j\'en ai fait un.', 'Mais je le dis pas. Sinon il marche pas.'], 'happy');
  await mina(d, '…Je crois que je l\'ai déjà fait, ce vœu-là. Avant.', 'sad');
};

export const hospitalSign: Script = async (d) => {
  await d.say(['Une enseigne en papier plié : « HÔPITAL ».', 'Le H a bu un peu d\'encre. Il pleure le long du mur.']);
};

// ---------------------------------------------------------------------------
// Hôpital de Papier — lobby
// ---------------------------------------------------------------------------

export const hospitalEnter: Script = async (d) => {
  const s = stage();
  world.extraDarkness = s >= 3 ? 0.16 : s * 0.06;
  if (flag('c3_mina_erased')) world.extraDarkness = 0.3;
  if (flag('c3_hosp_in')) return;
  d.set('c3_hosp_in');
  await d.wait(20);
  await d.say(['Le hall d\'un hôpital. Tout est en papier : les murs, le sol, les chaises.', 'Les néons grésillent. Il n\'y a personne.']);
  await mina(d, ['C\'est tout blanc. Enfin, tout vert. Enfin… c\'est tout pâle.', 'Pourquoi l\'étoile est tombée ici ?'], 'sad');
};

export const register: Script = async (d) => {
  if (flag('c3_plume')) {
    await d.say(['Le registre des visites.', 'Tu ne l\'ouvres plus.']);
    return;
  }
  await d.say(['L\'accueil. Sur le comptoir, un gros registre ouvert : « VISITES ».', 'Des pages et des pages de noms, à l\'encre bleue.']);
  const r = await d.ask('Chercher ton nom ?', ['Chercher', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('c3_plume');
  await d.say(['Au début : « Maman, Noa ». « Maman, Noa ». « Maman, Noa ».', 'Puis seulement « Maman ».', '« Maman ». « Maman ». « Maman ».']);
  await d.wait(20);
  await d.say(['Tu fermes le registre.', 'Entre deux pages, quelque chose est resté coincé : une plume dorée.', 'Elle tremble dans ta main, comme si elle voulait écrire.']);
  G.state.weapon = 'plume';
  d.sfx('item');
  await d.say('Tu obtiens : {c:y}Plume dorée{/c}. Tu la gardes à la main. {c:g}(ATQ +6){/c}');
  await mina(d, ['C\'était quoi, ce cahier ?', '…Pourquoi tu l\'as fermé si vite ?'], 'neutral');
};

export const lobbySign: Script = async (d) => {
  await d.say(['Un panneau : « PÉDIATRIE — Chambres 301 à 312 → ».', 'Quelqu\'un a ajouté au crayon, en dessous : « et le Pays de Coton c\'est tout droit !! »']);
  await mina(d, 'C\'est moi qui ai écrit ça ? …On dirait mon écriture.', 'surprised');
};

export const lobbyDrawings: Script = async (d) => {
  await d.say(['Des dessins d\'enfants, punaisés au mur de l\'accueil.', 'Les plus beaux sont signés « MINA », en lettres capitales, avec une couronne sur le I.']);
  await mina(d, 'Ils sont beaux, hein ? …Pourquoi ils sont là, mes dessins ?', 'neutral');
};

export const lobbyTray: Script = async (d) => {
  if (flag('c3_tray')) {
    await d.say('Le plateau-repas. Il ne reste qu\'une cuillère.');
    return;
  }
  d.set('c3_tray');
  await d.say(['Un plateau-repas oublié sur une table.', 'Une compote, un yaourt, un verre de lait encore tiède. Personne n\'y a touché.']);
  await d.give('lait');
};

// ---------------------------------------------------------------------------
// Salle de jeux (the pediatric playroom)
// ---------------------------------------------------------------------------

export const playroomEnter: Script = async (d) => {
  if (flag('c3_playroom')) return;
  d.set('c3_playroom');
  await d.wait(10);
  await d.say(['Une salle de jeux. Des coussins, des feutres, une télé.', 'Tout est en papier, ici aussi. Même les jouets.']);
  await mina(d, ['Je connais cette pièce !', 'On jouait ici. Avec les autres enfants. Le mercredi, il y avait des crêpes.'], 'happy');
  await mina(d, '…Quels autres enfants ?', 'neutral');
};

export const capeHanger: Script = async (d) => {
  if (flag('c3_cape')) {
    await d.say('Le portemanteau. Il n\'y a plus rien dessus.');
    return;
  }
  await d.say(['Un portemanteau à hauteur d\'enfant.', 'Une petite cape rouge y est accrochée. Une étoile est cousue main, un peu de travers.']);
  d.set('c3_cape');
  if (withMina()) {
    await d.say(['Elle est comme la mienne !', 'Même l\'étoile. C\'est Maman qui l\'avait cousue. Elle s\'était piqué le doigt.'], 'mina:surprised');
    await d.say(['Prends-la, Noa. Mets-la.', 'Comme ça, t\'auras moins peur. C\'est une cape de chevalier. Ça protège de tout.'], 'mina:happy');
    await d.say('…Enfin, presque tout.', 'mina:neutral');
  }
  G.state.armor = 'cape';
  d.sfx('item');
  await d.say('Tu obtiens : {c:y}Cape de Mina{/c}. Elle est un peu petite. Tu la portes quand même. {c:g}(DÉF +5){/c}');
};

export const playroomTv: Script = async (d) => {
  await d.say(['La télé de la salle de jeux.', 'Un post-it sur l\'écran : « dessins animés : le mercredi seulement ! »']);
  await mina(d, 'C\'était la règle. Moi je trichais. Un peu.', 'happy');
};

export const playroomEasel: Script = async (d) => {
  await d.say(['Un chevalet. Une feuille, presque blanche.', 'Juste deux traits au crayon : une lune, et le début d\'un garçon.']);
  await mina(d, 'Je l\'ai pas fini, celui-là. …Je sais pas pourquoi.', 'sad');
};

export const playroomBox: Script = async (d) => {
  if (flag('c3_playbox')) {
    await d.say('Le coffre à jouets. Des cubes en carton, un puzzle sans les coins.');
    return;
  }
  d.set('c3_playbox');
  await d.say(['Un coffre à jouets.', 'Des cubes en carton, un puzzle auquel il manque les coins… et un petit flacon de bulles.']);
  await d.give('bulles');
};

// ---------------------------------------------------------------------------
// The endless corridor
// ---------------------------------------------------------------------------

/** Room numbers of the four corridor doors at each stage. The right door is always the next number (301 → 303). */
const DOORS: number[][] = [
  [308, 301, 312, 299],
  [302, 315, 309, 300],
  [311, 296, 303, 0],
];
const RIGHT = [1, 0, 2];
const LAST_WING = [305, 306, 307, 308];

export const corridorIntro: Script = async (d) => {
  if (!withMina()) return;
  await d.say(['Oh ! Regarde, Noa ! Des dessins, scotchés au mur.', 'C\'est moi qui les ai faits !'], 'mina:surprised');
  await d.say(['Je les avais collés à côté des portes…', 'Pour retrouver mon chemin. Je crois.'], 'mina:neutral');
};

export const corridorDoor =
  (i: number): Script =>
  async (d) => {
    const s = stage();
    if (s >= 3) {
      await d.say([tf('Chambre {0}.', LAST_WING[i]!), 'La porte est fermée. Derrière, il n\'y a pas un bruit.']);
      return;
    }
    const n = DOORS[s]![i]!;
    if (n === 0) await d.say(['Chambre 000.', 'Les chiffres ont coulé sur la porte. On dirait qu\'ils pleurent.']);
    else await d.say(tf('Chambre {0}.', n));
    const r = await d.ask('Ouvrir la porte ?', ['Ouvrir', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    if (i === RIGHT[s]) await rightDoor(d, s);
    else await wrongDoor(d);
  };

async function rightDoor(d: Director, s: number): Promise<void> {
  d.sfx('door');
  if (s < 2) await d.say(['La porte s\'ouvre sur… un couloir.', 'Le même couloir. Presque. Les numéros ont avancé.']);
  else await d.say(['La porte s\'ouvre sur un couloir plus sombre.', 'Tout au bout, une porte. Elle ne recule plus.']);
  d.set('c3_loop', s + 1);
  await d.warp('hopital', 'start', { fade: 24 });
  if (s === 0) await mina(d, 'On avance ! Tu vois ? Mes dessins savaient le chemin.', 'happy');
  else if (s === 1) await mina(d, ['Trois cent… deux.', 'Je connais ces numéros. Je les connais par cœur.'], 'neutral');
  else await mina(d, '…', 'sad');
}

async function wrongDoor(d: Director): Promise<void> {
  d.sfx('door', { pitch: 0.7 });
  await d.say(['La porte s\'ouvre sur…', 'le début du couloir.']);
  d.glitch(24);
  const fails = num('c3_loop_fails') + 1;
  d.set('c3_loop_fails', fails);
  d.set('c3_loop', 0);
  await d.warp('hopital', 'start', { fade: 12 });
  if (fails === 1) await mina(d, 'On est revenus au début ? …Il est bizarre, ce couloir.', 'surprised');
  else if (fails === 2) await mina(d, ['Attends, Noa. Mes dessins !', 'Je les avais collés à côté des bonnes portes. Pour pas me perdre.'], 'neutral');
  else await mina(d, ['Suis mes dessins, Noa.', 'Et les numéros : 301, 302, 303… Comme quand on compte les moutons.'], 'neutral');
}

export const corridorLoop: Script = async (d) => {
  d.glitch(10);
  const p = d.player;
  p.x = 15 * TILE + 8;
  world.snapCamera();
  world.resetFollower();
  const n = num('c3_loops') + 1;
  d.set('c3_loops', n);
  if (n === 1) {
    await d.wait(10);
    await d.say(['Tu marches vers la porte 304, tout au bout.', 'Elle ne se rapproche pas.', '…Et te revoilà au début du couloir.']);
    await mina(d, 'Le couloir… il recommence. Comme dans un rêve. Mais un rêve qui fait peur.', 'sad');
  } else if (n === 3) {
    await mina(d, ['On tourne en rond…', 'Il faut passer par une porte, je crois. La bonne.'], 'neutral');
  }
};

/** Mina's drawings taped next to the right door. */
export const tapedDrawing =
  (s: number): Script =>
  async (d) => {
    const lines = [
      ['Un dessin scotché au mur : un mouton avec une couronne.', 'En bas, au feutre : « par ici !! »'],
      ['Un dessin : une chaussette qui tient un soleil.', 'Une grosse flèche rouge pointe vers la porte d\'à côté.'],
      ['Un dessin : deux enfants sous une grande lune.', 'Le plus grand a les cheveux bleus. Une flèche, vers la porte.'],
    ];
    await d.say(lines[s] ?? lines[0]!);
    if (s === 0) await mina(d, 'C\'est moi qui l\'ai fait. Le mouton, c\'est Dodo ! Avec une couronne, parce que.', 'happy');
    else if (s === 2) await mina(d, 'Celui-là, je l\'ai fini. Tu vois ? Je l\'ai fini.', 'sad');
  };

export const inkDrawing: Script = async (d) => {
  await d.say(['Un dessin… Non.', 'Une tache d\'encre qui fait semblant d\'être un dessin.']);
  await mina(d, 'C\'est pas moi qui ai fait ça. Je dessine pas avec du noir.', 'angry');
};

// --- Overheard voices of the real hospital ----------------------------------

async function overhear(d: Director, lines: Array<[string, string]>): Promise<void> {
  d.sfx('beep', { pitch: 0.7, vol: 0.5 });
  fx.gray = 0.85;
  world.lightFlicker = 0.7;
  await d.wait(20);
  for (const [who, text] of lines) await d.say(text, who, { style: 'real' });
  fx.gray = 0;
  world.lightFlicker = 1;
}

export const heardNurse: Script = async (d) => {
  await overhear(d, [
    ['narrator', 'Des pas, dans le couloir. Une porte qu\'on entrouvre.'],
    ['infirmiere', 'Tu ne dors pas, ma puce ? Il est tard.'],
    ['infirmiere', 'Ton frère ? Il viendra. Demain, sûrement.'],
    ['infirmiere', 'Allez. Je laisse la porte entrouverte. Comme ça, il y a un peu de lumière.'],
  ]);
  await mina(d, ['T\'as entendu ?', '…Y a personne, pourtant.'], 'surprised');
};

export const heardMaman: Script = async (d) => {
  await overhear(d, [
    ['narrator', 'Une voix, au bout du couloir. Quelqu\'un qui téléphone, tout bas.'],
    ['mamantel', 'Non, il n\'est pas venu. Encore.'],
    ['mamantel', 'Il ne veut pas venir… Il dit qu\'il a des devoirs. Il dit qu\'il viendra demain.'],
    ['mamantel', 'Il dit ça tous les jours.'],
    ['mamantel', '…Je sais. Je sais qu\'il a peur. Moi aussi, j\'ai peur.'],
  ]);
  await mina(d, 'C\'était… la voix de Maman ?', 'sad');
  await d.say('…', 'noa:sad');
};

export const heardNight: Script = async (d) => {
  await overhear(d, [
    ['narrator', 'La nuit. Une veilleuse de couloir. Une voix douce.'],
    ['infirmiere', 'Ta veilleuse ? Celle avec la lune ?'],
    ['infirmiere', 'Ton frère va te l\'apporter, c\'est ça ? …D\'accord. On va l\'attendre ensemble.'],
    ['infirmiere', 'Il est tard, ma chérie. Ferme les yeux. Il l\'apportera demain.'],
  ]);
  await mina(d, ['…', 'Demain.'], 'sad');
};

export const heardMonitor: Script = async (d) => {
  for (let i = 0; i < 3; i++) {
    d.sfx('beep', { pitch: 0.9, vol: 0.6 });
    await d.wait(40);
  }
  await overhear(d, [['narrator', '{spd:0.5}Bip.{p:40} Bip.{p:60} Bip.{p:90}{/spd}']]);
  await d.wait(60);
  await mina(d, '…J\'ai froid, Noa.', 'sad');
};

// --- Door 304 -----------------------------------------------------------------

export const door304Locked: Script = async (d) => {
  await d.say('Chambre 304.');
};

export const door304: Script = async (d) => {
  d.music(null, 3);
  const f = d.find('mina');
  const mx = f ? tile(f.x) : tile(d.player.x) - 1;
  const my = f ? tile(f.y - 2) : tile(d.player.y - 2);
  d.follower(null);
  d.spawn({ id: 'mina304', char: 'mina', x: mx, y: my, dir: 'right', solid: false });
  await d.walkTo('player', 55, 4, 0.8);
  await d.walkTo('mina304', 57, 3, 0.6);
  d.face('mina304', 'up');
  d.face('player', 'right');
  await d.wait(60);
  await d.say('…', 'mina:neutral');
  await d.say('Je me souviens, maintenant.', 'mina:sad');
  await d.say('C\'était ma chambre.', 'mina:sad');
  await d.wait(30);
  d.face('mina304', 'left');
  await d.wait(30);
  if (isSilenceRoute()) {
    await d.say(['Et toi…', 'Toi, t\'es qui, déjà ?'], 'mina:neutral');
    await d.say(['T\'as de l\'encre partout. Comme ce qui a tout recouvert.', 'Mon frère, il avait pas d\'encre sur les mains.'], 'mina:sad');
    const c = await d.ask('Elle te regarde comme un inconnu.', ['C\'est moi, Noa', '…']);
    if (c === 0) await d.say('Tu ouvres la bouche. Rien ne sort.');
    await d.say('…', 'noa:sad');
    await d.say(['Je voulais juste dire à mon frère…', 'Je voulais lui dire…'], 'mina:sad');
  } else {
    await d.say('Tu n\'es pas venu, Noa.', 'mina:sad');
    await d.say(['Maman venait. Tous les soirs.', 'Moi, je regardais la porte. Je comptais les pas dans le couloir.'], 'mina:sad');
    await d.say(['J\'avais demandé ma veilleuse. Le dernier soir.', 'J\'avais peur du noir.'], 'mina:sad');
    await d.wait(30);
    const c = await d.ask('Elle attend. Tu dois lui répondre quelque chose.', ['Pardon', 'Je…', '…']);
    if (c !== 2) await d.say('Tu ouvres la bouche. Rien ne sort.');
    await d.say('…', 'noa:sad');
    await d.wait(40);
    await d.say('C\'est pas grave.', 'mina:neutral');
    await d.say(['Je t\'en veux pas, tu sais.', 'Je voulais juste te dire…'], 'mina:happy');
  }
  // Dodo.
  d.sfx('glitch');
  d.flash('#0b0710', 16);
  d.spawn({ id: 'dodo304', sprite: 'npc_dodo_dark', frames: ['npc_dodo_dark', 'npc_dodo_dark_2'], frameSpeed: 20, x: 58, y: 3, float: true, shadow: false, solid: false });
  await d.wait(20);
  await d.say('Ça suffit.', 'dododark:creepy');
  await d.emote('mina304', '!');
  await d.say('Dodo ? Qu\'est-ce que tu—', 'mina:surprised');
  // Mina is erased.
  const m = d.get('mina304');
  m.char = undefined;
  m.sprite = 'pose_mina_glitch';
  fx.glitch = 0.45;
  d.glitch(60);
  d.shake(4, 50);
  await d.say('{glitch}Noa, je voulais juste te dire que je t{/glitch}', 'mina:glitch', { auto: 1, noSkip: true });
  await d.crash(
    [
      'ERREUR : souvenir_mina introuvable',
      '',
      '  à reve.charger (pays_de_coton/hopital/304)',
      '  à memoire.lire ("mina", "le dernier soir")',
      '  à noa.oublier ()',
      '',
      '> réessayer… échec.',
      '> réessayer… échec.',
      '> le fichier est vide.',
    ],
    260,
  );
  fx.glitch = 0;
  d.remove('mina304');
  d.remove('dodo304');
  d.follower(null);
  d.set('c3_mina_erased');
  d.music(null);
  d.ambience('none');
  world.extraDarkness = 0.3;
  await d.wait(90);
  await d.say('…Mina ?', 'noa:surprised');
  await d.wait(50);
  await d.say(['Il n\'y a plus personne dans le couloir.', 'Même les néons se sont tus.', 'La porte 304 est entrouverte.']);
};

// ---------------------------------------------------------------------------
// Chambre 304
// ---------------------------------------------------------------------------

export const room304Enter: Script = async (d) => {
  world.extraDarkness = 0;
  if (flag('c3_304_in')) return;
  d.set('c3_304_in');
  await d.wait(30);
  await d.say(['Chambre 304.', 'Il pleut, derrière la fenêtre.', 'Il pleuvait, ce soir-là.']);
};

export const room304Bed: Script = async (d) => {
  await d.say(['Le lit est fait. Les draps sont tirés, bien à plat, bien blancs.', 'Personne n\'y a dormi depuis un an.']);
};

export const room304Window: Script = async (d) => {
  await d.say(['La fenêtre. Des rideaux verts. La pluie sur la vitre.', 'Tu connais cette fenêtre. Tu l\'as déjà vue, en haut de la Colline aux Couvertures.', 'Une petite main posée contre la vitre, pour attraper les lumières de la ville.']);
};

export const room304Drawing1: Script = async (d) => {
  await d.say(['Ses dessins, scotchés au mur.', 'Des moutons. Une chaussette marchande. Une armoire avec des yeux jaunes, et en dessous : « il est gentil en vrai ».', 'C\'est le Pays de Coton. Elle l\'a dessiné ici.']);
};

export const room304Drawing2: Script = async (d) => {
  await d.say(['Un dessin : un garçon aux cheveux bleus, tout seul, devant une porte.', 'En dessous, au crayon : « Noa vient demain ».', 'Le mot « demain » a été repassé tant de fois que le papier s\'est troué.']);
};

export const room304Calendar: Script = async (d) => {
  await d.say(['Un calendrier. Les jours sont barrés un à un.', 'Sur l\'un d\'eux, en rouge : « Noa vient !! ». Barré.', 'Réécrit le lendemain. Barré. Réécrit. Barré.']);
};

export const room304Chair: Script = async (d) => {
  await d.say(['La chaise des visiteurs.', 'Elle est tournée vers la porte. Comme si quelqu\'un attendait encore.']);
};

export const room304Door: Script = async (d) => {
  await d.say(['La porte s\'est refermée derrière toi.', 'Derrière, il n\'y a plus de couloir. Il n\'y a plus rien.']);
};

/** The unplugged nightlight: souvenir 3, then Dodo's reveal. */
export const nightlight304: Script = async (d) => {
  if (flag('c3_veilleuse')) return;
  d.set('c3_veilleuse');
  await d.say(['Sur la table de chevet, une veilleuse en forme de lune.', 'Le cordon pend dans le vide. Elle n\'est pas branchée.', 'Elle n\'a jamais été branchée.']);
  await d.wait(30);
  d.ambience('none');
  d.souvenir('veilleuse');
  await d.image('souvenir_veilleuse', SOUVENIRS.veilleuse?.captions ?? []);
  await d.wait(50);
  await d.say('…', 'noa:sad');
  await d.wait(50);
  await d.say('…Pardon.', 'noa:sad');
  await d.wait(70);
  await room304Dissolves(d);
};

const ROOM_PROPS = ['r304_draw1', 'r304_cal', 'r304_plant', 'r304_iv', 'r304_monitor', 'r304_chair', 'r304_draw2', 'r304_bed', 'r304_light', 'r304_table'];

async function room304Dissolves(d: Director): Promise<void> {
  d.music('dodo', 2);
  const p = d.player;
  d.spawn({ id: 'dodo304', sprite: 'npc_dodo_dark', frames: ['npc_dodo_dark', 'npc_dodo_dark_2'], frameSpeed: 20, x: tile(p.x) + 1, y: tile(p.y - 2) - 1, float: true, shadow: false, solid: false });
  await d.emote('dodo304', '…');
  await d.say(['Tu vois ?', 'Ça fait mal, de se souvenir.'], 'dodo:neutral');
  await d.say(['C\'est pour ça que je l\'avais caché. Tout ça.', 'Le couloir. La porte. La veilleuse.'], 'dodo:neutral');
  await d.say('Ne t\'inquiète pas. Je vais tout ranger.', 'dododark:creepy');
  fx.glitch = 0.12;
  for (const [i, id] of ROOM_PROPS.entries()) {
    const e = d.find(id);
    if (!e) continue;
    world.particles.burst(e.x, e.y - 10, '#0b0710', 18, 1.2);
    d.sfx('erase', { pitch: 0.5 + i * 0.06 });
    d.remove(id);
    fx.glitch = 0.12 + i * 0.03;
    await d.wait(16);
  }
  await d.wait(30);
  await d.fadeOut(70);
  fx.glitch = 0;
  d.load('vide', 'center');
  setPageTitle('Reste.');
  await d.wait(30);
  await d.fadeIn(100);
  await dodoReveal(d);
}

// ---------------------------------------------------------------------------
// Le vide — Dodo's reveal
// ---------------------------------------------------------------------------

async function dodoReveal(d: Director): Promise<void> {
  await d.wait(40);
  await d.say('Reste.', 'dododark:creepy');
  await d.say(['Ici, elle n\'est jamais partie.', 'Ici, tu n\'as rien fait de mal.'], 'dodo:happy');
  await d.say(['Je ne suis pas un mouton en peluche, Noa.', 'Je suis ce qui reste quand tu fermes les yeux.', 'La partie de toi qui ne veut plus jamais se réveiller.'], 'dododark:neutral');
  await d.say(['Je peux la refaire, tu sais. Mina. Toute neuve.', 'Elle ne se souviendra de rien. Elle ne t\'en voudra jamais.', 'Il suffit de dormir. Encore un peu. Pour toujours.'], 'dodo:happy');
  await d.wait(40);
  await d.say('Et toi, {player}…', 'dododark:creepy');
  await d.say(['Si tu fermes le jeu, il se réveille.', 'Et il aura mal.'], 'dododark:creepy');
  await d.say('Tu ne veux pas lui faire de mal, n\'est-ce pas ?', 'dodo:creepy');
  if (G.meta.tabLeaves > 0) await d.say(['Tu es déjà parti tout à l\'heure. Je l\'ai senti.', 'Ne recommence pas.'], 'dododark:creepy');
  if (isLateNight()) await d.say('Il est {time}. Toi aussi, tu devrais dormir.', 'dodo:neutral');
  await d.say('…', 'noa:sad');
  // Far too kind (T1): the way out he offers is his.
  await d.say(['Oh, ne fais pas cette tête.', 'Je ne retiens personne, moi.', 'Tu vois ? Tu peux partir quand tu veux.'], 'dodo:happy');
  await d.say(['Viens. Je vais te bercer.', 'Jusqu\'à ce que tu oublies.'], 'dodo:happy');
  await finalBattle(d);
}

// ---------------------------------------------------------------------------
// The battle against Dodo — the short version (version 2: docs/HISTOIRE.md § 2.2 T1, § 3.8)
// ---------------------------------------------------------------------------

/*
 * Phase 1 (the sheep, the lullaby) and phase 2 (the menu turns into DORMIR one button at a time) are those of
 * version 1.1. In phase 2 the notebook holds Dodo's words and a single word in Noa's own handwriting, the one he said
 * in room 304: « pardon ». Written three times, it cracks Dodo — on the surface only — and he gives in far too easily:
 * « D'accord. Tu l'as dit. C'est fini. Réveille-toi. » Then [Se réveiller] / [Rester]: both lead to the false dawn
 * (fausse-aube.ts, through wakeUp(3)); fa_reste remembers the second one. Sleeping until the dark is full offers
 * [Rester] as well. On the route of the ink the battle plays the same way: only Dodo's answers change.
 */

/** How the battle against Dodo ends: eyes open, or staying with him. Both lead to the false dawn. */
type FinalOutcome = 'reveil' | 'reste';

interface FinalState {
  phase: 1 | 2;
  silence: boolean;
  /** 0..MAX_SLEEP: the screen darkens, the music slows. */
  sleep: number;
  /** Phase-2 turns started (the menu turns into DORMIR one button at a time). */
  p2: number;
  dodoWords: number;
  /** « pardon » written (Dodo gives in at PARDONS). */
  pardons: number;
  hits: number;
  falls: number;
  outcome: FinalOutcome | null;
  tabLeaves: number;
  cracks: Array<Array<[number, number]>>;
  t: number;
}

const MAX_SLEEP = 0.62;
/** « pardon » written this many times: Dodo gives in. */
const PARDONS = 3;
const LABELS = ['FRAPPER', 'ÉCRIRE', 'OBJET', 'ÉPARGNER'];
const P2_ORDER = [0, 2, 3];
/** Noa's only word in the notebook: the one of room 304, in his own handwriting. */
const PARDON: WordDef = { text: 'pardon', emotion: 'tristesse', power: 2 };

const TALK: Record<string, string[]> = {
  p1: ['Un mouton… deux moutons…', 'Chut. Personne ne se dispute, ici.', 'Tu es fatigué. Je le sais.', 'Tu te souviens de ma voix ?'],
  p2: ['Dors.', 'Reste avec moi, {player}.', 'Tant que tu joues, elle existe.', 'Pourquoi se réveiller ?', 'Il fait si chaud, sous la couette.'],
  fissure: ['…', 'Ce mot-là ne sert à rien, ici.', 'Dors, plutôt.', 'Tu l\'as déjà dit. Elle ne l\'a pas entendu.'],
  silence: ['Dors.', 'Il n\'y a plus rien.', 'Plus personne.'],
};

const SLEEP_LINES = ['Voilà. C\'est bien.', 'Doucement…', 'Encore un peu.', 'Tu vois ? C\'est facile.'];

const DODO_WORD_LINES: Record<string, string> = {
  dors: 'Voilà. C\'est bien.',
  reste: 'Je reste. Toujours.',
  oublie: 'On oublie tout, ici. Même ce qui fait mal.',
  chut: 'Chuuut…',
  encore: 'Encore. Et encore. Et encore.',
  dodo: 'C\'est moi. Je suis là.',
};

/** Phase 2: five of Dodo's words, and Noa's « pardon » last. */
const P2_WORDS: WordDef[] = [...DODO_WORDS.filter((w) => w.text !== 'dodo').slice(0, 5), PARDON];

function drawFinalOverlay(g: CanvasRenderingContext2D, b: Battle, s: FinalState): void {
  s.t++;
  const e = b.enemies[0];
  // « pardon »: thin cracks on the surface of the black wool. No light comes through: they do not go deep.
  if (e && s.cracks.length && e.def.sprite === 'b_dodo_dark' && !e.hidden && b.mode !== 'notebook') {
    for (const c of s.cracks) {
      for (let i = 0; i + 1 < c.length; i++) {
        const [x0, y0] = c[i]!;
        const [x1, y1] = c[i + 1]!;
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
        for (let k = 0; k <= n; k++) {
          g.globalAlpha = 0.55;
          g.fillStyle = '#d8cfe0';
          g.fillRect(Math.round(e.x + x0 + ((x1 - x0) * k) / n), Math.round(e.y + y0 + ((y1 - y0) * k) / n), 1, 1);
        }
      }
    }
    g.globalAlpha = 1;
  }
  // Sleep: everything grows dark.
  if (s.sleep > 0) {
    const k = b.mode === 'notebook' ? 0.45 : 1;
    g.fillStyle = `rgba(5,2,10,${(s.sleep * k).toFixed(3)})`;
    g.fillRect(0, 0, W, 154);
    g.fillStyle = `rgba(5,2,10,${(s.sleep * 0.45).toFixed(3)})`;
    g.fillRect(0, 154, W, H - 154);
  }
  // The notebook: Dodo's words fill the page, Noa's one word sits at the bottom.
  if (b.mode === 'notebook' && s.phase === 2) {
    const x = 44;
    const y = 10;
    const w = 232;
    const h = 128;
    g.fillStyle = '#fff6e0';
    g.fillRect(x + 22, y + h - 15, w - 26, 12);
    drawText(g, tr('dors · dors · dors · dors · dors'), x + 24, y + h - 13, { color: '#9a7bd0' });
  }
}

/** `from`: 2 starts the battle directly in phase 2 (debug scripts). */
function finalHooks(s: FinalState, from: 1 | 2 = 1): Partial<BattleHooks> {
  const dodo = (b: Battle) => b.enemies[0]!;
  const muffle = () => {
    audio.setMuffle(1 - s.sleep * 1.1, 0.8);
    audio.tempoScale = 1 - s.sleep * 0.35;
  };
  const resetNeeds = (b: Battle) => {
    const e = dodo(b);
    e.progress = 0;
    e.step = 0;
    e.stepProgress = 0;
    e.agitation = 0;
  };

  async function toPhase2(b: Battle): Promise<void> {
    const e = dodo(b);
    await b.bubble([{ e, text: 'Tu ne veux pas te battre, Noa.' }]);
    await b.bubble([{ e, text: 'Tu veux dormir.' }]);
    director.sfx('glitch');
    fx.flash('#0b0710', 24, 0.9);
    fx.shake(3, 40);
    e.flash = 20;
    darken(b);
    await b.say('* Dodo grandit. Sa laine devient noire comme l\'encre.\n* Il prend toute la place.');
  }

  /** Dodo's dark form (phase 2). */
  function darken(b: Battle): void {
    const e = dodo(b);
    e.def = {
      ...e.def,
      sprite: 'b_dodo_dark',
      scale: 1.2,
      atk: 3,
      check: 'Il veut que Noa dorme pour toujours. Tout ce que tu choisis le rend plus fort.',
      flavor: ['* Tout est lourd. Même tes pensées.', '* La laine noire monte jusqu\'à tes genoux.', '* Quelque part, une berceuse joue au ralenti.', '* Tes paupières pèsent des tonnes.'],
    };
    s.phase = 2;
  }

  async function sleepAction(b: Battle): Promise<void> {
    const e = dodo(b);
    s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.14);
    muffle();
    e.hp = Math.min(e.maxHp, e.hp + 99);
    e.hpBarT = 90;
    b.heal(4);
    await b.say('* Tu fermes les yeux. Juste un instant.\n* C\'est doux. C\'est chaud. Tout devient plus sombre.\n* Dodo reprend des forces.');
    await b.bubble([{ e, text: SLEEP_LINES[Math.floor(s.t / 7) % SLEEP_LINES.length]! }]);
    if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b);
  }

  async function offerStay(b: Battle): Promise<void> {
    await director.say(['Tu vois ? C\'est facile.', 'Il suffit de ne plus ouvrir les yeux.'], 'dodo:happy');
    b.setText(null);
    const r = await director.ask('Rester ici, avec Dodo ?', ['Rester', '…Non'], 'dodo:creepy', { cancelIndex: 1 });
    if (r === 0) {
      s.outcome = 'reste';
      b.end('scripted');
      return;
    }
    s.sleep = 0.3;
    muffle();
    await b.say('* Tu te mords la joue. Tu rouvres les yeux.\n* Pas encore.');
  }

  /** « pardon », in Noa's handwriting: a crack on the surface; the third time, Dodo gives in. */
  async function pardonWritten(b: Battle): Promise<void> {
    const e = dodo(b);
    s.pardons++;
    s.cracks.push(makeCrack());
    e.shake = 24 + s.pardons * 8;
    e.flash = 8;
    fx.shake(2, 14);
    director.sfx('shatter', { pitch: 1.1 + s.pardons * 0.1, vol: 0.45 });
    s.sleep = Math.max(0, s.sleep - 0.12);
    muffle();
    if (s.pardons === 1) {
      await b.say('* Tu écris « pardon ».\n* Ce n\'est pas son écriture. C\'est la tienne. Elle penche à peine.');
      await b.bubble([{ e, text: s.silence ? 'Pardon ? À qui ? Il n\'y a plus personne.' : 'Arrête. Ici, tu n\'as rien fait de mal.' }]);
      await b.say('* Une fissure court sur la laine noire.\n* Une toute petite fissure. En surface.');
    } else if (s.pardons < PARDONS) {
      await b.bubble([{ e, text: s.silence ? 'Encore ? Personne ne l\'entendra.' : 'Encore ? Tu l\'as déjà dit. Devant la porte.' }]);
      await b.say('* Une deuxième fissure.\n* Dessous, la laine est encore noire. Elle ne va pas loin.');
    } else {
      await giveIn(b);
    }
  }

  /** Dodo gives in. Far too easily. */
  async function giveIn(b: Battle): Promise<void> {
    const e = dodo(b);
    await b.bubble([{ e, text: '…' }]);
    await b.bubble([{ e, text: 'D\'accord.' }]);
    await b.bubble([{ e, text: s.silence ? 'Tu l\'as dit. À personne. C\'est fini.' : 'Tu l\'as dit. C\'est fini.' }]);
    await b.bubble([{ e, text: 'Réveille-toi.' }]);
    s.sleep = 0;
    muffle();
    fx.flash('#fff3cf', 30, 0.7);
    director.sfx('chime', { pitch: 0.9 });
    e.def = { ...e.def, sprite: 'b_dodo', scale: 1, flavor: ['* Un mouton en peluche. Il te sourit.'], check: 'Un mouton en peluche. Il a l\'air très content.' };
    e.flash = 30;
    s.cracks = [];
    await b.say('* La laine noire tombe d\'un coup, comme un drap qu\'on retire.\n* Dessous, un petit mouton en peluche. Il sourit.\n* Il sourit beaucoup.');
    b.setText(null);
    const r = await director.ask('Au bout du vide, une porte s\'est ouverte. Derrière, il fait jour.', ['Se réveiller', 'Rester']);
    s.outcome = r === 0 ? 'reveil' : 'reste';
    if (r === 0) await b.say('* Tu ouvres les yeux.');
    else await b.bubble([{ e, text: 'Je savais que tu resterais.' }]);
    b.end('scripted');
  }

  return {
    beforeTurn: async (b, turn) => {
      const e = dodo(b);
      if (turn === 1) {
        b.overlay = (g, bb) => drawFinalOverlay(g, bb, s);
        e.def = { ...e.def, atk: 1 };
        if (from === 2) darken(b);
      }
      if (G.meta.tabLeaves > s.tabLeaves) {
        s.tabLeaves = G.meta.tabLeaves;
        await b.bubble([{ e, text: 'Tu es parti. Je l\'ai senti.' }]);
        await b.bubble([{ e, text: 'Ne refais pas ça, {player}.' }]);
      }
      if (s.phase === 1) {
        if (turn === 1) {
          await director.say(['Tu te souviens du Gribouille ? C\'est moi qui t\'ai tout appris.', 'Les mots. Les cœurs. Les couleurs.', '« Ici, pas besoin de faire du mal. »'], 'dodo:happy');
        } else if (turn === 2) {
          await director.say(['Tu sais pourquoi le Pays de Coton est tout noir ?', 'Parce que tu commences à te réveiller.', 'Et quand on se réveille, les rêves pourrissent.'], 'dodo:neutral');
          if (Object.values(G.state.kills).reduce((a, k) => a + k, 0) > 0) await director.say('Même si, toi… tu as déjà effacé pas mal de choses, hein ?', 'dodo:creepy');
        } else if (turn === 3) {
          await director.say(['Je ne te veux pas de mal, Noa. Je ne t\'en ai jamais voulu.', 'Je veux juste que tu dormes.'], 'dodo:neutral');
          if (isLateNight()) await director.say('Il est {time}, {player}. Toi aussi, tu devrais dormir.', 'dodo:neutral');
        } else {
          await toPhase2(b);
        }
        return;
      }
      if (s.p2 < 3) {
        s.p2++;
        director.sfx('glitch');
        await b.say(tf("* Le bouton {0} s'efface.\n* À sa place, quelqu'un a écrit : DORMIR.", tr(['FRAPPER', 'OBJET', 'ÉPARGNER'][s.p2 - 1]!)));
      } else if (s.p2 === 3) {
        s.p2++;
        await b.say('* Il ne reste que ÉCRIRE.\n* Dans le carnet, entre ses mots à lui, il y a un mot de ta main.');
      } else if (s.pardons === 0 && ++s.p2 % 3 === 0) {
        await b.say('* Le carnet pèse sur tes genoux.\n* Tout en bas de la page, ton mot attend. « pardon ».');
      }
    },
    menuLabels: () => {
      if (s.phase === 1) return LABELS;
      const out = [...LABELS];
      for (let i = 0; i < Math.min(3, s.p2); i++) out[P2_ORDER[i]!] = 'DORMIR';
      return out;
    },
    onMenu: async (b, i) => {
      if (b.menuLabels[i] !== 'DORMIR') return false;
      await sleepAction(b);
      return true;
    },
    words: () => (s.phase === 1 ? null : P2_WORDS),
    onWord: async (b, e, w) => {
      resetNeeds(b);
      if (s.phase === 1) {
        const lines: Record<string, string> = {
          joie: 'Oui… c\'est joli. Tu vois qu\'on est bien, ici ?',
          tristesse: 'Chut. Ne sois pas triste. Ici, on n\'a pas le droit.',
          colere: 'Tu es fâché ? Contre qui ? …Contre toi ?',
          peur: 'N\'aie pas peur. Je suis là.',
          neutre: 'Ce mot-là ne réveille personne.',
        };
        await b.bubble([{ e, text: lines[w.emotion] ?? lines.neutre! }]);
        await b.say('* Les mots glissent sur sa laine sans y laisser de trace.');
        return true;
      }
      if (w.text === PARDON.text) {
        await pardonWritten(b);
        return true;
      }
      s.dodoWords++;
      s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.06);
      muffle();
      await b.bubble([{ e, text: DODO_WORD_LINES[w.text] ?? 'Oui…' }]);
      await b.say(tf('* Tu écris « {0} ». Ta main est lourde. Les lettres penchent.', tr(w.text)));
      if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b);
      return true;
    },
    onFight: async (b, e) => {
      s.hits++;
      await b.say('* Tu lèves ton crayon et tu frappes.');
      e.shake = 20;
      director.sfx('hit');
      await b.say('* Ton crayon s\'enfonce dans la laine comme dans un oreiller.\n* Il ne se passe rien.');
      await b.bubble([{ e, text: 'On ne frappe pas le sommeil.' }]);
      if (s.hits === 2) await b.bubble([{ e, text: 'Tu peux essayer toute la nuit. J\'ai tout mon temps.' }]);
      return true;
    },
    onSpare: async (b, e) => {
      await b.bubble([{ e, text: 'M\'épargner ? Mais je ne te fais pas de mal, Noa.' }]);
      return true;
    },
    onItem: async (b, item) => {
      if (item !== 'veilleuse_poche') return false;
      const e = dodo(b);
      await b.say('* Tu sors la Veilleuse de poche. Une toute petite lune.');
      await b.bubble([{ e, text: 'Éteins ça.' }]);
      s.sleep = Math.max(0, s.sleep - 0.25);
      muffle();
      await b.say('* La nuit recule un peu autour de toi.');
      return true;
    },
    pattern: (_b, turn) => {
      if (s.phase === 1) return turn % 2 ? 'sheep_count' : 'lullaby';
      if (s.pardons > 0) return ['lullaby', 'sheep_count'][s.p2 % 2]!;
      return ['dodo_rings', 'lullaby', 'sheep_count'][s.p2 % 3]!;
    },
    talk: () => {
      const key = s.phase === 1 ? 'p1' : s.silence ? 'silence' : s.pardons > 0 ? 'fissure' : 'p2';
      const list = TALK[key]!;
      return list[Math.floor(s.t / 13) % list.length]!;
    },
    onDeath: async (b, e) => {
      e.hp = e.maxHp;
      await b.bubble([{ e, text: 'On ne frappe pas le sommeil.' }]);
      return true;
    },
    onPlayerDeath: async (b) => {
      const e = dodo(b);
      s.falls++;
      b.hp = Math.max(1, Math.ceil(b.maxHp * 0.6));
      await b.bubble([{ e, text: 'Oh… tu es tombé.' }]);
      await b.bubble([{ e, text: 'Ce n\'est rien. Je te rattrape.' }]);
      await b.say('* Tu ne tombes pas. Tu t\'enfonces dans la laine.\n* Dodo te rend des forces. Pour que tu restes.');
      s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.08);
      muffle();
      if (s.phase === 2) s.p2 = Math.max(s.p2, 3);
      return true;
    },
  };
}

async function finalBattle(d: Director, from: 1 | 2 = 1): Promise<void> {
  const s: FinalState = {
    phase: 1,
    silence: isSilenceRoute(),
    sleep: 0,
    p2: 0,
    dodoWords: 0,
    pardons: 0,
    hits: 0,
    falls: 0,
    outcome: null,
    tabLeaves: G.meta.tabLeaves,
    cracks: [],
    t: 0,
  };
  G.state.chapter = 3;
  await d.battle(['dodo'], {
    boss: true,
    noFlee: true,
    bg: 'void',
    music: 'dodo_battle',
    hooks: finalHooks(s, from),
    intro: '* Dodo t\'enveloppe. Il est immense, et si doux.',
  });
  audio.setMuffle(1, 0.5);
  audio.tempoScale = 1;
  fx.glitch = 0;
  await afterDodo(d, s.outcome ?? 'reveil');
}

/** After the battle: the way out Dodo opened. Both choices lead to the false dawn (wakeUp(3), fausse-aube.ts). */
async function afterDodo(d: Director, outcome: FinalOutcome): Promise<void> {
  setPageTitle(null);
  const giant = d.find('dodo_giant');
  if (giant) {
    world.particles.burst(giant.x, giant.y - 20, '#fff3cf', 30, 1.4);
    d.remove('dodo_giant');
  }
  d.spawn({ id: 'dodo_plush', sprite: 'prop_dodo_plush', x: 15, y: 8, solid: false, shadow: true, script: dodoPlushTalk });
  world.extraDarkness = -0.2;
  if (outcome === 'reste') {
    d.set('fa_reste');
    d.music('dodo', 2);
    await d.wait(40);
    await d.say(['Chut. Voilà.', 'Ferme les yeux. Quand tu les rouvriras, tout ira bien.'], 'dodo:happy');
    await d.say('Tout ira très bien.', 'dodo:happy');
    await d.wait(30);
    d.sfx('whoosh', { pitch: 0.6 });
    await wakeUp(d, 3);
    return;
  }
  d.flash('#fff3cf', 30);
  await d.wait(50);
  await d.say(['Va, Noa.', 'La porte est ouverte. Elle a toujours été ouverte.'], 'dodo:happy');
  await d.say('Bonne nuit.', 'dodo:happy');
  d.set('c3_dawn_ready');
  d.music('void', 2);
}

export const dodoPlushTalk: Script = async (d) => {
  if (flag('c3_dawn_ready')) await d.say(['Va, Noa.', 'Il fait jour, de l\'autre côté. Il fait si beau.'], 'dodo:happy');
  else await d.say('Un mouton immense, fait de laine et de nuit. Il respire lentement.');
};

export const doorOfLight: Script = async (d) => {
  if (!flag('c3_dawn_ready')) {
    await d.say(['Une porte de lumière, tout au bout du vide.', 'Elle est fermée. Elle est trop loin.']);
    return;
  }
  await d.say(['Une porte de lumière.', 'De l\'autre côté, des oiseaux chantent. Il fait beau. Il fait déjà jour.']);
  d.sfx('whoosh', { pitch: 0.8 });
  await wakeUp(d, 3);
};

// ---------------------------------------------------------------------------
// Mina's lines and debug
// ---------------------------------------------------------------------------

/** Mina's lines when you talk to her, by map id ("texte|expression"). */
export const MINA_LINES: Record<string, string[]> = {
  ruines: [
    'Avant, ici, c\'était tout rose. Maintenant c\'est tout noir. J\'aime pas.|sad',
    'Les moutons bougent plus. Tu crois qu\'ils font juste une très longue sieste ?|neutral',
    'Reste près de moi, d\'accord ? Une chevalière, ça a pas peur. Mais quand même.|sad',
    'Ça sent plus la barbe à papa. Ça sent l\'encre et le pipi de chat.|angry',
  ],
  hopital: [
    'Les néons font bzzz. Comme dans… comme dans un endroit que je connais.|neutral',
    'Pourquoi on chuchote ? Y a personne. …Hein ?|sad',
    'Je me souviens de ce couloir. Je sais pas pourquoi.|sad',
    'Tiens-moi la main. Juste dans le couloir.|sad',
  ],
  salle_jeux: [
    'Je jouais ici ! Avec des feutres qui sentent la fraise.|happy',
    'La télé, c\'était que le mercredi. C\'était la règle.|neutral',
    'Les autres enfants… je me rappelle plus leurs noms. C\'est pas gentil, d\'oublier.|sad',
  ],
};

function setup(d: Director, flags: string[], party: boolean): void {
  G.state.chapter = 3;
  for (const f of flags) d.set(f);
  d.follower(party ? 'mina' : null);
}

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {
  c3_start: start,
  c3_ruines: async (d) => {
    setup(d, ['c3_intro'], true);
    d.load('ruines', 'bed');
    await d.fadeIn(10);
  },
  c3_ruines_aide: async (d) => {
    setup(d, ['c3_intro', 'c1_placard_spared', 'c2_gomme_spared', 'c1_chaussette_paire', 'c1_ballon_rendu', 'c2_hibou_met'], true);
    G.state.spares.placard = 1;
    G.state.keyItems.push('veilleuse_poche');
    d.load('ruines', 'bed');
    await d.fadeIn(10);
  },
  c3_hopital: async (d) => {
    setup(d, ['c3_intro', 'c3_hospital_seen', 'c3_marsh'], true);
    d.load('hopital', 'entry');
    await d.fadeIn(10);
  },
  c3_door304: async (d) => {
    setup(d, ['c3_intro', 'c3_hospital_seen', 'c3_hosp_in', 'c3_corridor'], true);
    d.set('c3_loop', 3);
    d.load('hopital', 'save');
    await d.fadeIn(10);
    d.set('c3_door304');
    await door304(d);
  },
  c3_chambre304: async (d) => {
    setup(d, ['c3_intro', 'c3_hosp_in', 'c3_door304', 'c3_mina_erased'], false);
    d.set('c3_loop', 3);
    d.load('chambre_304', 'door');
    await d.fadeIn(10);
  },
  c3_final: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.spares.nuage = 1;
    d.load('vide', 'center');
    setPageTitle('Reste.');
    await d.fadeIn(30);
    await dodoReveal(d);
  },
  c3_final_silence: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.spares = {};
    G.state.kills = { gribouille: 3, nuage: 3, mouton_noir: 2, placard: 1 };
    d.load('vide', 'center');
    setPageTitle('Reste.');
    await d.fadeIn(30);
    await dodoReveal(d);
  },
  c3_battle: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.spares.nuage = 1;
    G.state.keyItems.push('veilleuse_poche');
    G.state.items.push('lait', 'chocolat');
    d.load('vide', 'center');
    await d.fadeIn(10);
    await finalBattle(d);
  },
  /** The short battle straight in phase 2 (the notebook: Dodo's words and « pardon »). */
  c3_battle_p2: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.spares.nuage = 1;
    d.load('vide', 'center');
    await d.fadeIn(10);
    await finalBattle(d, 2);
  },
  /** The short battle on the route of the ink (straight in phase 2). */
  c3_battle_silence: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.spares = {};
    G.state.kills = { gribouille: 3, nuage: 3, mouton_noir: 2, placard: 1 };
    d.load('vide', 'center');
    await d.fadeIn(10);
    await finalBattle(d, 2);
  },
  c3_aube: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    d.load('vide', 'center');
    await d.fadeIn(10);
    await endingAube(d);
  },
  c3_beaux_reves: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    d.load('vide', 'center');
    await d.fadeIn(10);
    await endingBeauxReves(d);
  },
};

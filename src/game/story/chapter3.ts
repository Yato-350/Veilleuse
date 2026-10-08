import { audio } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game } from '../../engine/game';
import { input } from '../../engine/input';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import { drawSprite } from '../../engine/sprite';
import { SOUVENIRS } from '../../data/illustrations';
import { DODO_WORDS, MINA_WORDS } from '../../data/words';
import { hasSpr, spr } from '../assets';
import type { Battle } from '../battle/battle';
import type { EnemyRuntime } from '../battle/enemy';
import type { BattleHooks, WordDef } from '../battle/types';
import { director, type Director } from '../director';
import { isLateNight, setPageTitle } from '../meta';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { finishGame, isSilenceRoute, shop, wakeUp } from './common';

/**
 * Chapter 3 — « L'Hôpital de Papier ».
 * ruines (the Cotton Country drowned in ink) → hopital (lobby + endless corridor, salle_jeux) → door 304 (Mina is
 * erased) → chambre_304 (souvenir « La veilleuse ») → vide (Dodo's reveal, final battle, three endings).
 *
 * Flags: c3_intro, c3_village, c3_lit (closet lights the marsh), c3_nook_open (Gomme), c3_hospital_seen, c3_wish,
 * c3_loop (corridor stage 0..3), c3_loop_fails, c3_loops, c3_heard_0..3, c3_plume, c3_cape, c3_door304,
 * c3_mina_erased, c3_veilleuse, fin_route ('aube').
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
      await d.say([`Chambre ${LAST_WING[i]}.`, 'La porte est fermée. Derrière, il n\'y a pas un bruit.']);
      return;
    }
    const n = DOORS[s]![i]!;
    if (n === 0) await d.say(['Chambre 000.', 'Les chiffres ont coulé sur la porte. On dirait qu\'ils pleurent.']);
    else await d.say(`Chambre ${n}.`);
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
  await d.say(['Viens. Je vais te bercer.', 'Jusqu\'à ce que tu oublies.'], 'dodo:happy');
  await finalBattle(d);
}

// ---------------------------------------------------------------------------
// FINAL BATTLE — Dodo
// ---------------------------------------------------------------------------

type FinalOutcome = 'aube' | 'beaux_reves' | 'silence';

interface FinalState {
  phase: 1 | 2 | 3;
  silence: boolean;
  /** 0..MAX_SLEEP: the screen darkens, the music slows. */
  sleep: number;
  /** Phase-2 turns started (the menu turns into DORMIR one button at a time). */
  p2: number;
  p3: number;
  dodoWords: number;
  hits: number;
  falls: number;
  /** Mina's words already written. */
  written: string[];
  outcome: FinalOutcome | null;
  tabLeaves: number;
  cracks: Array<Array<[number, number]>>;
  t: number;
  /** Mina's words drowned in the player's own ink (mixed route), by original text. */
  drowned: string[];
  /** Drowned words written anyway (Dodo's cutting lines cycle). */
  inkTries: number;
  /** Spared friends still to come in phase 3 (species ids, in order of appearance). */
  friends: string[];
  friendVisits: number;
  /** Friends drawn around Dodo (fading in and out). */
  stage: StageFriend[];
  /** Words shown in the notebook (blots are drawn over the drowned ones). */
  nbWords: WordDef[];
  /** A word of the notebook is being written (the list is hidden). */
  nbWriting: boolean;
  /** A friend's gift: the whole next dodge takes the soul's color (frames left, longer than any attack). */
  recolorNext: number;
  recolorLeft: number;
  recolorEmo: Emotion;
  recolorBy: StageFriend | null;
  wasDodge: boolean;
  /** Per-frame hook registered in game.hooks for the battle's duration. */
  tick: (() => void) | null;
}

interface StageFriend {
  sprite: string;
  x: number;
  y: number;
  scale: number;
  born: number;
  gone: number | null;
}

const MAX_SLEEP = 0.62;
/** Number of Mina's words needed before ÉPARGNER becomes SE RÉVEILLER. */
const WAKE_AT = 4;
const LABELS = ['FRAPPER', 'ÉCRIRE', 'OBJET', 'ÉPARGNER'];
const P2_ORDER = [0, 2, 3];

/** Mina's words drowned in ink (silence route). */
const INK_WORDS: WordDef[] = ['#%@&#', '&#%*', '@#&%#@#', '%#@& &#%', '#&@%#&', '*#%@#'].map((text) => ({ text, emotion: 'neutre' }));

const TALK: Record<string, string[]> = {
  p1: ['Un mouton… deux moutons…', 'Chut. Personne ne se dispute, ici.', 'Tu es fatigué. Je le sais.', 'Tu te souviens de ma voix ?'],
  p2: ['Dors.', 'Reste avec moi, {player}.', 'Tant que tu joues, elle existe.', 'Pourquoi se réveiller ?', 'Il fait si chaud, sous la couette.'],
  p3: ['Arrête… ces mots-là…', 'Ce n\'est pas ton écriture !', 'Si tu te réveilles, tu la perds.', 'Je voulais juste que tu n\'aies plus mal.', 'Elle n\'est plus là. ELLE N\'EST PLUS LÀ.'],
  ready: ['…', 'Tu es sûr ?', 'Il fera froid, dehors.'],
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

/** Dodo cracks, Mina whispers: one pair per word. */
const MINA_PAIRS: Record<string, [string, string[]]> = {
  merci: ['Merci ? Pourquoi merci ?', ['Merci pour les histoires, le soir. Au téléphone.', 'Même quand t\'avais plus envie.']],
  pardon: ['Arrête. Ici, tu n\'as rien fait de mal.', ['Je sais, Noa. Je sais.', 'Je t\'en ai jamais voulu. Gros bêta.']],
  'au revoir': ['Non. Pas au revoir. Bonne nuit.', ['Au revoir, c\'est pas un mot triste.', 'C\'est un mot pour ceux qui restent.']],
  'je t\'aime': ['Elle disait ça. Le soir. Avant d\'éteindre.', ['Moi aussi.', 'Gros comme le Pays de Coton. Plus gros, même.']],
  lumière: ['Éteins ça. ÉTEINS ÇA.', ['Allume la lumière, Noa.', 'T\'as plus besoin d\'avoir peur du noir.']],
  matin: ['Le matin, tout s\'en va. TOUT.', ['Il fait bientôt jour.', 'Regarde par la fenêtre. Le ciel devient tout pâle.']],
};

// --- The weight of the ink (mixed route) -------------------------------------------------------------------------

/** Mina's words drowned first by the player's ink: the core of the goodbye (pardon, au revoir, je t'aime, matin) stays. */
const DROWN_ORDER = ['merci', 'lumière'];

/** Number of Mina's words drowned in ink: one per 3 Encre, always leaving WAKE_AT readable words (the dawn stays possible). */
export function drownedCount(encre: number): number {
  return Math.max(0, Math.min(Math.floor(encre / 3), MINA_WORDS.length - WAKE_AT, DROWN_ORDER.length));
}

/** The illegible blot that replaces a drowned word in the notebook (same length, so it takes the word's place). */
const blot = (text: string): string => [...text].map((c, i) => (c === ' ' ? ' ' : i % 3 === 1 ? '█' : '▓')).join('');
const INK_OF: Record<string, WordDef> = Object.fromEntries(DROWN_ORDER.map((t) => [t, { text: blot(t), emotion: 'neutre' as Emotion }]));
const isBlot = (text: string): boolean => text.length > 0 && /^[▓█ ]+$/.test(text);

/** Dodo, when a drowned word is written anyway. */
const INK_CUTS = [
  'Tu ne peux pas lire ça, hein ? C\'est ton encre.',
  'Je t\'avais dit que ça partait au lavage. J\'ai menti.',
  'Elle voulait te le dire. Toi, tu frappais.',
  'Ceux que tu as effacés aussi avaient des choses à dire.',
];

/** …and where Mina's voice should have answered, nothing. */
const INK_SILENCES = [
  '* Tu écris sur la tache. L\'encre boit les lettres.\n* Tu attends la voix de Mina. Elle ne vient pas.',
  '* La tache s\'étale encore un peu.\n* Là où elle aurait dû parler, il n\'y a que du silence.',
];

// --- Spared friends come to help (phase 3) -------------------------------------------------------------------------

type FriendGift = 'crack' | 'recolor' | 'heal' | 'placard' | 'gomme';

interface Friend {
  /** Species id (G.state.spares). */
  id: string;
  sprite: string;
  name: string;
  /** Rich-text color code of the name. */
  col: string;
  voice: string;
  line: string;
  gift: FriendGift;
  /** Narration of the gift. {n} = HP healed. */
  act: string;
  /** Spared bosses: a narration box before they speak. */
  intro?: string;
  boss?: boolean;
  scale?: number;
  /** Feet on the stage (lower = higher on screen; fliers float). */
  y?: number;
}

/** In order of appearance: the small ones first, then the spared bosses, who get the strongest moments. */
const FRIENDS: Friend[] = [
  { id: 'gribouille', sprite: 'b_gribouille', name: 'Gribouille', col: 'v', voice: 'default', line: 'Scritch ! On gribouille ensemble ?', gift: 'crack', act: '* Il gribouille un trait de lumière sur Dodo.' },
  { id: 'pissenlit', sprite: 'b_pissenlit', name: 'Pissenlit', col: 'y', voice: 'default', line: 'Hi hi ! Fais un vœu ! Un gros !', gift: 'recolor', act: '* Ses graines se posent sur ton cœur.\n* La prochaine attaque aura ta couleur.' },
  { id: 'nuage', sprite: 'b_nuage', name: 'Nuage Triste', col: 'b', voice: 'default', line: 'J\'ai gardé un peu de pluie. De la tiède.', gift: 'heal', act: '* Une petite averse tiède. Tu récupères {n} PV.' },
  { id: 'chaussette_perdue', sprite: 'b_chaussette_perdue', name: 'Chaussette Perdue', col: 'p', voice: 'sock', line: 'J\'ai retrouvé ma paire. Ça arrive, tu vois ?', gift: 'heal', act: '* Elle réchauffe ton cœur. Tu récupères {n} PV.' },
  { id: 'mouton_noir', sprite: 'b_mouton_noir', name: 'Mouton Noir', col: 'v', voice: 'sheep', line: 'Hé, le gros. Moi aussi, j\'étais tout noir.', gift: 'crack', act: '* Il fonce tête baissée. BONK ! Dodo se fissure.' },
  { id: 'avion', sprite: 'b_avion', name: 'Avion en Papier', col: 'b', voice: 'default', line: 'Vrrrr ! Courrier ! De la part de tout le monde !', gift: 'recolor', act: '* Il fait des loopings autour de ton cœur.\n* La prochaine attaque aura ta couleur.' },
  { id: 'taille_crayon', sprite: 'b_taille_crayon', name: 'Taille-Crayon', col: 'r', voice: 'monster', line: 'Donne ton crayon. Crrr… Voilà. Bien pointu.', gift: 'crack', act: '* Ton crayon brille. Un trait de lumière fend Dodo.' },
  { id: 'bip', sprite: 'b_bip', name: 'Bip', col: 'o', voice: 'tv', line: 'Bip. Bip. Bip. Tu entends ? C\'est le tien.', gift: 'heal', act: '* Ton cœur bat plus fort. Tu récupères {n} PV.' },
  { id: 'perfusion', sprite: 'b_perfusion', name: 'Perfusion', col: 'p', voice: 'default', line: 'Goutte à goutte… Doucement. Ça va aller.', gift: 'heal', act: '* Une goutte de lumière. Tu récupères {n} PV.' },
  { id: 'luciole', sprite: 'b_luciole_2', name: 'Luciole', col: 'y', voice: 'default', line: 'Je brille encore. C\'est toi qui m\'as rallumée.', gift: 'crack', act: '* Elle se pose sur Dodo.\n* Là où elle brille, la laine se fend.', y: 64 },
  { id: 'placard', sprite: 'b_placard', name: 'Monstre du Placard', col: 'y', voice: 'monster', line: 'Le noir, je connais, petit. J\'y ai vécu toute ma vie.\nEt je te le dis : il ne faut pas y rester.', gift: 'placard', act: '* Il ouvre grand ses portes.\n* Toute sa lumière se déverse sur Dodo.\n* Tu récupères tous tes PV.', intro: '* Au bord du vide, une armoire s\'ouvre en grinçant.\n* Le Monstre du Placard !', boss: true },
  { id: 'gomme', sprite: 'b_gomme', name: 'Gomme', col: 'p', voice: 'eraser', line: 'Tu m\'as appris à garder. Même ce qui fait mal.\nAlors je garde. Et j\'efface juste ce qu\'il faut.', gift: 'gomme', act: '* Frrrt, frrrt. Elle efface la laine noire.\n* Dessous, il n\'y a que de la lumière.', intro: '* Une petite gomme rose roule jusqu\'à tes pieds.\n* Gomme !', boss: true },
];
const FRIEND = (id: string): Friend | undefined => FRIENDS.find((f) => f.id === id);
/** Where friends stand around Dodo (bottom-center anchor). */
const STAGE_X = [62, 258, 98, 222, 30, 290];

/** Spared friends, in order of appearance. With drowned words, Gomme comes first: she knows how to erase ink. */
export function friendQueue(spares: Record<string, number>, drowned: number): string[] {
  const ids = FRIENDS.filter((f) => (spares[f.id] ?? 0) > 0).map((f) => f.id);
  if (drowned > 0 && ids.includes('gomme')) return ['gomme', ...ids.filter((id) => id !== 'gomme')];
  return ids;
}

/**
 * The next visit: a spared boss alone, or a small group, sized so that every boss still gets its own turn before
 * Dodo turns back into a plush (`slots` = visits left until then, this one included).
 */
export function nextVisit(queue: string[], slots: number): string[] {
  if (!queue.length) return [];
  const bosses = queue.filter((id) => FRIEND(id)?.boss);
  const small = queue.filter((id) => !FRIEND(id)?.boss);
  if (FRIEND(queue[0]!)?.boss || !small.length || (bosses.length && slots <= bosses.length)) return [bosses[0] ?? queue[0]!];
  const size = Math.min(3, Math.ceil(small.length / Math.max(1, slots - bosses.length)));
  return small.slice(0, size);
}

/** « A, B et C ». */
function listNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}.`;
}

/** Word-wraps a list to the battle text box (first line prefixed with `head`, the next ones indented with `tail`). */
function wrapList(text: string, head: string, tail: string, width = 274): string[] {
  const out: string[] = [];
  let line = head;
  for (const word of text.split(' ')) {
    const next = line === head || line === tail ? `${line}${word}` : `${line} ${word}`;
    if (measure(next) > width && line !== head && line !== tail) {
      out.push(line);
      line = `${tail}${word}`;
    } else line = next;
  }
  out.push(line);
  return out;
}

function makeCrack(): Array<[number, number]> {
  let x = rng.range(-20, 20);
  let y = rng.range(-50, -18);
  const pts: Array<[number, number]> = [[x, y]];
  for (let i = 0; i < 6; i++) {
    x += rng.range(-6, 6);
    y += rng.range(-5, 6);
    pts.push([x, y]);
  }
  return pts;
}

/** A filled pixel disc (halos). */
function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2, 1);
  }
}

/** An ink blot over a drowned word of the notebook (x, y: where the word is written; w: its width). */
function drawBlot(g: CanvasRenderingContext2D, x: number, y: number, w: number, t: number, seed: number): void {
  g.fillStyle = '#0b0710';
  // A lumpy puddle: overlapping discs along the word.
  const n = Math.max(2, Math.round(w / 6));
  for (let i = 0; i <= n; i++) {
    const r = 4 + ((seed + i * 3) % 3 === 0 ? 2 : 1);
    disc(g, Math.round(x + (w * i) / n), y + 4 + (((seed + i) % 2) * 2 - 1), r);
  }
  g.fillRect(x - 2, y - 1, w + 4, 10);
  // Splashes
  g.fillRect(x - 8, y + 6, 2, 2);
  g.fillRect(x + w + 7, y, 2, 2);
  g.fillRect(x + w + 6, y + 9, 1, 1);
  // One slow drip
  const dx = x + Math.round(w * (0.35 + (seed % 3) * 0.15));
  const len = 2 + ((Math.floor(t / 10) + seed * 4) % 8);
  g.fillRect(dx, y + 9, 2, len);
  disc(g, dx + 1, y + 9 + len, 2);
  // A dull sheen
  g.fillStyle = '#3a2f52';
  g.fillRect(x + 1, y, Math.max(3, Math.round(w / 3)), 1);
  g.fillRect(x, y + 1, 1, 2);
}

/** Spared friends around Dodo: they fade in with a soft halo, bob, and fade out. */
function drawStage(g: CanvasRenderingContext2D, s: FinalState): void {
  s.stage = s.stage.filter((f) => f.gone === null || s.t - f.gone < 30);
  for (const f of s.stage) {
    if (!hasSpr(f.sprite)) continue;
    const k = Math.min(1, (s.t - f.born) / 20);
    const a = k * (f.gone === null ? 1 : Math.max(0, 1 - (s.t - f.gone) / 30));
    if (a <= 0) continue;
    const bob = Math.round(Math.sin((s.t + f.x) * 0.06) * 1.5);
    const y = f.y + bob + Math.round((1 - k) * 6);
    const sp = spr(f.sprite);
    const cy = Math.round(y - (sp.ay * f.scale) / 2);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ffd27a';
    for (const [r, al] of [[22, 0.05], [17, 0.06], [12, 0.08], [7, 0.1]] as const) {
      g.globalAlpha = al * a;
      disc(g, f.x, cy, r);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const key = hasSpr(`${f.sprite}_2`) && Math.floor((s.t + f.x) / 24) % 2 === 1 ? `${f.sprite}_2` : f.sprite;
    drawSprite(g, spr(key), f.x, y, { alpha: a, scaleX: f.scale, scaleY: f.scale });
  }
  g.globalAlpha = 1;
}

function drawFinalOverlay(g: CanvasRenderingContext2D, b: Battle, s: FinalState): void {
  s.t++;
  const e = b.enemies[0];
  // Light leaking through the cracks of the dark Dodo.
  if (e && s.phase === 3 && !s.silence && e.def.sprite === 'b_dodo_dark' && !e.hidden && b.mode !== 'notebook') {
    const pulse = 0.65 + 0.35 * Math.sin(s.t * 0.12);
    for (const c of s.cracks) {
      for (let i = 0; i + 1 < c.length; i++) {
        const [x0, y0] = c[i]!;
        const [x1, y1] = c[i + 1]!;
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
        for (let k = 0; k <= n; k++) {
          const px = Math.round(e.x + x0 + ((x1 - x0) * k) / n);
          const py = Math.round(e.y + y0 + ((y1 - y0) * k) / n);
          g.globalAlpha = 0.35 * pulse;
          g.fillStyle = '#ffe991';
          g.fillRect(px - 1, py - 1, 3, 3);
          g.globalAlpha = 1;
          g.fillStyle = '#fff3cf';
          g.fillRect(px, py, 1, 1);
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
  // Dawn: a warm light grows with Mina's words.
  if (s.phase === 3 && !s.silence && s.written.length) {
    g.fillStyle = `rgba(255,214,150,${Math.min(0.16, s.written.length * 0.028).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
  }
  // Spared friends, glowing through the dark.
  if (s.stage.length && b.mode !== 'notebook') drawStage(g, s);
  // The notebook's handwriting.
  if (b.mode === 'notebook') {
    const x = 44;
    const y = 10;
    const w = 232;
    const h = 128;
    if (s.phase === 2) {
      g.fillStyle = '#fff6e0';
      g.fillRect(x + 22, y + h - 15, w - 26, 12);
      drawText(g, 'dors · dors · dors · dors · dors', x + 24, y + h - 13, { color: '#9a7bd0' });
    } else if (s.phase === 3 && !s.silence) {
      g.fillStyle = '#fff6e0';
      g.fillRect(x + 22, y + h - 15, w - 26, 12);
      drawText(g, 'Écris avec moi. — Mina ♥', x + 24, y + h - 13, { color: '#e0834f' });
      // Mina's words drowned in the player's ink.
      if (!s.nbWriting) {
        s.nbWords.forEach((wd, i) => {
          if (isBlot(wd.text)) drawBlot(g, x + 34 + (i % 2) * 100, y + 51 + Math.floor(i / 2) * 25, measure(wd.text), s.t, i);
        });
      }
      // A tiny paper crown in the margin.
      g.fillStyle = '#f5c04f';
      g.fillRect(x + 5, y + h - 22, 9, 3);
      g.fillRect(x + 5, y + h - 25, 1, 3);
      g.fillRect(x + 9, y + h - 26, 1, 4);
      g.fillRect(x + 13, y + h - 25, 1, 3);
    } else if (s.phase === 3 && s.silence) {
      // Ink running down the page.
      g.fillStyle = '#0b0710';
      for (let i = 0; i < 11; i++) {
        const dx = x + 22 + i * 19 + ((i * 7) % 5);
        const len = 18 + ((i * 37 + Math.floor(s.t / 4)) % 70);
        g.fillRect(dx, y, 3 + (i % 2), Math.min(h - 4, len));
        g.fillRect(dx - 1, y + Math.min(h - 6, len) - 2, 5 + (i % 2), 4);
      }
    }
  }
}

/** Removes the final battle's per-frame hook. */
function unhook(s: FinalState): void {
  if (!s.tick) return;
  const i = game.hooks.indexOf(s.tick);
  if (i >= 0) game.hooks.splice(i, 1);
  s.tick = null;
}

/** `from`: 3 starts the battle directly in phase 3 (debug scripts). */
function finalHooks(s: FinalState, from: 1 | 3 = 1): Partial<BattleHooks> {
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

  /** Dodo's dark form (phase 2 onwards). */
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

  async function toPhase3(b: Battle): Promise<void> {
    const e = dodo(b);
    s.phase = 3;
    await b.say('* Le carnet s\'ouvre tout seul.\n* La page est pleine de « dors », de « reste », d\'« oublie ».');
    await b.say('* Tu tournes la page.');
    if (s.silence) {
      e.def = { ...e.def, atk: 4, flavor: ['* L\'encre monte. Elle n\'a plus de fond.', '* Il n\'y a plus de couleurs.', '* Le silence est très grand.'] };
      await b.say('* Sur la page suivante, il y avait des mots.\n* Ils sont noyés d\'encre. Tu ne peux plus les lire.');
      await b.bubble([{ e, text: 'Tu cherches quelqu\'un ?' }]);
      return;
    }
    e.def = {
      ...e.def,
      atk: 4,
      check: 'Il a peur que tu partes. Les mots de Mina le fissurent.',
      flavor: ['* Des fissures de lumière courent sur la laine noire.', '* Le carnet est tiède, comme une main.', '* Tu entends des feutres sur du papier.', '* Quelque part, quelqu\'un fredonne la berceuse. Juste.'],
    };
    // The weight of the ink: some of Mina's words are drowned (never so many that the dawn becomes unreachable).
    s.drowned = DROWN_ORDER.slice(0, drownedCount(G.state.encre));
    s.friends = friendQueue(G.state.spares, s.drowned.length);
    await b.say('* Ce n\'est pas ton écriture.\n* Des lettres rondes, maladroites. Des cœurs sur les i.');
    audio.playMusic('title', { fadeIn: 3, fadeOut: 2 });
    s.sleep = Math.max(0, s.sleep - 0.2);
    muffle();
    await director.say(['Noa ?', 'C\'est moi. Je suis là. Dans les mots.'], 'minavoix');
    if (s.drowned.length) {
      director.sfx('glitch', { vol: 0.5 });
      await b.say(`* Mais sur la page, ${s.drowned.length > 1 ? 'deux mots sont noyés' : 'un mot est noyé'} d'encre.\n* Tu reconnais cette encre. C'est la tienne.`);
      await director.say(['Y a des mots que j\'arrive plus à dire, Noa. C\'est tout taché.', 'Mais les autres sont encore là. Écris avec moi.'], 'minavoix');
    } else {
      await director.say(['Écris avec moi.', 'On a encore des choses à se dire.'], 'minavoix');
    }
  }

  // --- Ink and friends (phase 3) ---

  /** A drowned word written anyway: Dodo cuts, and where Mina should have answered, nothing. */
  async function inkWritten(b: Battle, e: EnemyRuntime): Promise<void> {
    const i = s.inkTries++;
    director.sfx('glitch', { pitch: 0.6, vol: 0.5 });
    fx.flash('#0b0710', 16, 0.5);
    s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.06);
    muffle();
    await b.bubble([{ e, text: INK_CUTS[i % INK_CUTS.length]! }]);
    await b.say(INK_SILENCES[Math.min(i, INK_SILENCES.length - 1)]!);
    if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b);
  }

  const healFor = (b: Battle): number => Math.max(4, Math.round(b.maxHp * 0.25));

  /** Heals and returns the narration with the HP actually healed (the sentence is dropped at full HP). */
  function healText(b: Battle, n: number, text: string): string {
    const before = b.hp;
    b.heal(n);
    const got = b.hp - before;
    return got > 0 ? text.replace('{n}', String(got)) : text.replace(/ Tu récupères \{n\} PV\./, '');
  }

  function onStage(f: Friend, slot: number): StageFriend {
    const sf: StageFriend = { sprite: f.sprite, x: STAGE_X[slot % STAGE_X.length]!, y: f.y ?? 80, scale: f.scale ?? (f.boss ? 0.8 : 0.7), born: s.t, gone: null };
    s.stage.push(sf);
    return sf;
  }

  const leave = (sf: StageFriend | null): void => {
    if (sf && sf.gone === null) sf.gone = s.t;
  };

  /** Light cracks the dark Dodo (false if he is already a plush again). */
  function lightCrack(b: Battle, n: number): boolean {
    const e = dodo(b);
    if (e.def.sprite !== 'b_dodo_dark') return false;
    for (let i = 0; i < n; i++) s.cracks.push(makeCrack());
    e.shake = 24 + n * 8;
    e.flash = 8;
    fx.shake(2, 12 + n * 4);
    director.sfx('shatter', { pitch: 1.3, vol: 0.6 });
    s.sleep = Math.max(0, s.sleep - 0.06 * n);
    muffle();
    return true;
  }

  /** A friend's gift; returns its narration. */
  function gift(b: Battle, f: Friend, sf: StageFriend): string {
    const fallback = '* La nuit s\'éclaire un peu autour de toi. Tu récupères {n} PV.';
    if (f.gift === 'heal') return healText(b, healFor(b), f.act);
    if (f.gift === 'crack') return lightCrack(b, 1) ? f.act : healText(b, healFor(b), fallback);
    if (f.gift === 'recolor') {
      // Pointless once Dodo is calm (his last attacks are harmless): then a little light instead.
      if (s.written.length >= WAKE_AT) return healText(b, healFor(b), fallback);
      s.recolorNext = 900;
      leave(s.recolorBy);
      s.recolorBy = sf;
      return f.act;
    }
    if (f.gift === 'placard') {
      lightCrack(b, 3);
      fx.flash('#fff3cf', 36, 0.85);
      director.sfx('door', { pitch: 0.7 });
      s.sleep = 0;
      muffle();
      b.heal(b.maxHp);
      return f.act;
    }
    // Gomme: she erases the player's ink first.
    const word = s.drowned.shift();
    if (word) {
      lightCrack(b, 1);
      fx.flash('#fff6e0', 24, 0.6);
      director.sfx('chime', { pitch: 1.2 });
      return `* Frrrt, frrrt. Elle frotte la tache d'encre.\n* De toutes ses forces.\n* Dessous, un mot revient : « ${word} ».`;
    }
    return lightCrack(b, 2) ? f.act : healText(b, healFor(b), fallback);
  }

  /** One visit of spared friends (at most one appearance each), at the start of a phase-3 turn. */
  async function visit(b: Battle): Promise<void> {
    // Visits left while Dodo is still dark (one word per turn), this one included: the bosses must come before.
    const slots = Math.max(0, WAKE_AT - s.written.length);
    const ids = nextVisit(s.friends, slots);
    if (!ids.length) return;
    s.friends = s.friends.filter((id) => !ids.includes(id));
    const e = dodo(b);
    const k = s.friendVisits++;
    if (k === 0) {
      await b.bubble([{ e, text: 'Qui les a laissés entrer ?' }]);
      await b.say('* Au bord de la page, quelque chose bouge.\n* Ceux que tu as épargnés ne t\'ont pas oublié.');
    }
    const shown: StageFriend[] = [];
    for (const [i, id] of ids.entries()) {
      const f = FRIEND(id)!;
      const sf = onStage(f, i === 0 ? k % 2 : i === 1 ? (k + 1) % 2 : 2 + (k % 2));
      shown.push(sf);
      director.sfx('chime', { pitch: 0.9 + i * 0.15, vol: 0.5 });
      await game.wait(18);
      if (f.intro) await b.say(f.intro);
      const name = `{c:${f.col}}${f.name} :{/c} `;
      if (f.boss) {
        await b.say(`${name}${f.line}`, false, true, f.voice);
        const erased = f.gift === 'gomme' && s.drowned.length > 0;
        await b.say(gift(b, f, sf));
        const cry = f.gift === 'placard' ? 'Fermez ça ! FERMEZ ÇA !' : erased ? 'Non ! Cette encre, il l\'a méritée !' : 'Non ! Ça, c\'était à moi !';
        await b.bubble([{ e, text: cry }]);
      } else {
        const act = gift(b, f, sf);
        await b.say(`${name}${f.line}\n${act}`, false, true, f.voice);
      }
    }
    for (const sf of shown) if (sf !== s.recolorBy) leave(sf);
  }

  /** Waking up: the spared friends who have not come yet wave goodbye, all together. */
  async function chorus(b: Battle): Promise<void> {
    const fs = s.friends.map(FRIEND).filter((f): f is Friend => !!f);
    s.friends = [];
    if (!fs.length) return;
    fs.forEach((f, i) => onStage(f, i));
    director.sfx('chime', { pitch: 1.1 });
    if (fs.length === 1) {
      await b.say(`* ${fs[0]!.name} est encore là, derrière toi.\n* Un petit signe. Bonne route, Noa.`);
      return;
    }
    const names = wrapList(listNames(fs.map((f) => f.name)), '* ', '  ');
    const bye = '* Ils te font signe. Bonne route, Noa.';
    if (names.length <= 2) await b.say(['* Derrière toi, il y a encore du monde :', ...names, bye].join('\n'));
    else {
      await b.say(['* Derrière toi, il y a encore du monde :', ...names].join('\n'));
      await b.say(bye);
    }
  }

  /** Every frame: notebook state (blots) and the friends' recoloring of the next dodge. */
  function frame(b: Battle): void {
    if (b.ended) {
      unhook(s);
      return;
    }
    if (b.mode !== 'notebook') s.nbWriting = false;
    else if (input.pressed('a')) s.nbWriting = true;
    const dodge = b.mode === 'dodge';
    if (dodge && !s.wasDodge && s.recolorNext > 0) {
      // The gift colors the heart too, if it has no color: white projectiles never pass through.
      if (b.soulEmo === 'neutre') b.setEmotion('joie');
      s.recolorEmo = b.soulEmo;
      s.recolorLeft = s.recolorNext;
      s.recolorNext = 0;
    }
    if (!dodge && s.wasDodge) s.recolorLeft = 0;
    s.wasDodge = dodge;
    if (dodge && s.recolorLeft > 0) {
      for (const p of b.bw.bullets) {
        if (p.emo !== s.recolorEmo && !p.data.friend) {
          p.emo = s.recolorEmo;
          p.data.friend = 1;
        }
      }
      if (--s.recolorLeft === 0) {
        leave(s.recolorBy);
        s.recolorBy = null;
      }
    } else if (!dodge && s.recolorBy && s.recolorNext === 0) {
      leave(s.recolorBy);
      s.recolorBy = null;
    }
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
    if (s.sleep >= MAX_SLEEP - 0.001 && !s.silence) await offerStay(b);
  }

  async function offerStay(b: Battle): Promise<void> {
    await director.say(['Tu vois ? C\'est facile.', 'Il suffit de ne plus ouvrir les yeux.'], 'dodo:happy');
    b.setText(null);
    const r = await director.ask('Rester ici, avec Dodo ?', ['Rester', '…Non'], 'dodo:creepy', { cancelIndex: 1 });
    if (r === 0) {
      s.outcome = 'beaux_reves';
      b.end('scripted');
      return;
    }
    s.sleep = 0.3;
    muffle();
    await b.say('* Tu te mords la joue. Tu rouvres les yeux.\n* Pas encore.');
  }

  async function stayAction(b: Battle): Promise<void> {
    b.setText(null);
    const r = await director.ask('Rester ici ? Pour toujours ?', ['Rester', 'Pas encore'], 'dodo:happy', { cancelIndex: 1 });
    if (r === 0) {
      s.outcome = 'beaux_reves';
      b.end('scripted');
      return;
    }
    await b.say('* La porte reste entrouverte. Tu n\'y vas pas. Pas encore.');
  }

  async function wakeAction(b: Battle): Promise<void> {
    const e = dodo(b);
    await b.bubble([{ e, text: 'Non… attends.' }]);
    await director.say(['Si tu te réveilles, elle s\'en va. Pour de vrai, cette fois.', 'Tu vas avoir mal, Noa. Tellement mal.'], 'dododark:creepy');
    await director.say('Ici, au moins… tu n\'as jamais froid.', 'dodo:neutral');
    b.setText(null);
    const r = await director.ask('Dodo te tend la patte. Derrière lui, la nuit est si douce.', ['Se réveiller', 'Rester']);
    s.outcome = r === 0 ? 'aube' : 'beaux_reves';
    if (r === 0) {
      director.set('fin_route', 'aube');
      await chorus(b);
      await b.say('* Tu ouvres les yeux.');
    }
    b.end('scripted');
  }

  async function silenceEnd(b: Battle): Promise<void> {
    const e = dodo(b);
    await b.bubble([{ e, text: 'Tu ne peux plus les lire, hein ?' }]);
    fx.glitch = 0.2;
    await director.say(['Regarde ce que tu as fait.', 'Il n\'y a plus personne à qui dire au revoir.'], 'dododark:creepy');
    fx.glitch = 0;
    s.outcome = 'silence';
    b.end('scripted');
  }

  async function crack(b: Battle, w: WordDef): Promise<void> {
    const e = dodo(b);
    s.written.push(w.text);
    s.cracks.push(makeCrack(), makeCrack());
    e.shake = 40;
    e.flash = 10;
    fx.shake(4, 24);
    director.sfx('shatter', { pitch: 0.8 + s.written.length * 0.08 });
    s.sleep = Math.max(0, s.sleep - 0.16);
    muffle();
    const pair = MINA_PAIRS[w.text];
    if (pair) {
      await b.bubble([{ e, text: pair[0] }]);
      await director.say(pair[1], 'minavoix');
    }
    const n = s.written.length;
    if (n >= WAKE_AT && e.def.sprite !== 'b_dodo') {
      e.def = { ...e.def, sprite: 'b_dodo', scale: 1, flavor: ['* Dodo est tout petit, maintenant. Un mouton en peluche, un peu usé.'], check: 'Un mouton en peluche. Mina te l\'avait donné. Il veillera sur toi.' };
      e.flash = 30;
      fx.flash('#fff3cf', 30, 0.8);
      await b.say('* La laine noire tombe en morceaux.\n* Dessous, il y a un petit mouton en peluche. Un peu usé.');
      await b.say('* {c:y}La lumière passe à travers les fissures.\n* Tu peux SE RÉVEILLER.{/c}');
    } else if (n === 1) {
      await b.say('* Dodo se fissure. La lumière passe.\n* {c:y}Le bouton OBJET revient.{/c}');
    } else if (n === 2) {
      await b.say('* Une autre fissure.\n* Un bouton change encore : RESTER. Comme une porte qu\'on laisse ouverte.');
    } else if (n < WAKE_AT) {
      await b.say('* Dodo se fissure de partout.');
    } else {
      await b.say('* Les mots de Mina flottent autour de toi, tout doux.');
    }
  }

  return {
    beforeTurn: async (b, turn) => {
      const e = dodo(b);
      if (turn === 1) {
        b.overlay = (g, bb) => drawFinalOverlay(g, bb, s);
        e.def = { ...e.def, atk: 1 };
        if (!s.tick) {
          const tick = (): void => frame(b);
          s.tick = tick;
          game.hooks.push(tick);
        }
        if (from === 3) {
          darken(b);
          s.p2 = 4;
        }
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
      }
      if (s.phase === 2) {
        if (s.p2 >= 4 || (s.dodoWords >= 3 && s.p2 >= 3)) {
          await toPhase3(b);
        } else {
          s.p2++;
          const name = ['FRAPPER', 'OBJET', 'ÉPARGNER'][s.p2 - 1];
          director.sfx('glitch');
          if (name) await b.say(`* Le bouton ${name} s'efface.\n* À sa place, quelqu'un a écrit : DORMIR.`);
          else await b.say('* Il ne reste que ÉCRIRE.\n* Et le carnet ne contient plus que ses mots à lui.');
        }
      }
      if (s.phase === 3 && !b.ended) {
        s.p3++;
        if (s.silence && s.p3 >= 3) await silenceEnd(b);
        else if (!s.silence) {
          if (s.written.length === 0 && s.p3 === 3) await director.say('Écris, Noa. Dans le carnet. Avec moi.', 'minavoix');
          if (s.p3 >= 2) await visit(b);
        }
      }
    },
    menuLabels: () => {
      if (s.phase === 1) return LABELS;
      if (s.phase === 2) {
        const out = [...LABELS];
        for (let i = 0; i < Math.min(3, s.p2); i++) out[P2_ORDER[i]!] = 'DORMIR';
        return out;
      }
      if (s.silence) return ['DORMIR', 'ÉCRIRE', 'DORMIR', 'DORMIR'];
      const n = s.written.length;
      return [n >= 2 ? 'RESTER' : 'DORMIR', 'ÉCRIRE', n >= 1 ? 'OBJET' : 'DORMIR', n >= WAKE_AT ? 'SE RÉVEILLER' : 'DORMIR'];
    },
    onMenu: async (b, i) => {
      const label = b.menuLabels[i];
      if (label === 'DORMIR') {
        await sleepAction(b);
        return true;
      }
      if (label === 'RESTER') {
        await stayAction(b);
        return true;
      }
      if (label === 'SE RÉVEILLER') {
        await wakeAction(b);
        return true;
      }
      return false;
    },
    words: () => {
      if (s.phase === 1) return null;
      if (s.phase === 2) return DODO_WORDS;
      if (s.silence) return INK_WORDS;
      const left = MINA_WORDS.filter((w) => !s.written.includes(w.text));
      s.nbWords = (left.length ? left : MINA_WORDS).map((w) => (s.drowned.includes(w.text) ? (INK_OF[w.text] ?? w) : w));
      return s.nbWords;
    },
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
      if (s.phase === 2) {
        s.dodoWords++;
        s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.06);
        muffle();
        await b.bubble([{ e, text: DODO_WORD_LINES[w.text] ?? 'Oui…' }]);
        await b.say(`* Tu écris « ${w.text} ». Ta main est lourde. Les lettres penchent.`);
        if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b);
        return true;
      }
      if (s.silence) {
        await silenceEnd(b);
        return true;
      }
      if (isBlot(w.text)) await inkWritten(b, e);
      else if (!s.written.includes(w.text) && MINA_PAIRS[w.text]) await crack(b, w);
      else {
        await b.bubble([{ e, text: 'Tu l\'as déjà dit…' }]);
        await director.say('Je l\'ai entendu, Noa. La première fois.', 'minavoix');
      }
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
      if (s.phase === 2) return ['dodo_rings', 'lullaby', 'sheep_count'][s.p2 % 3]!;
      if (s.silence) return 'dodo_rings';
      if (s.written.length >= WAKE_AT) return 'calm';
      return 'dodo_storm';
    },
    talk: () => {
      const key = s.phase === 1 ? 'p1' : s.phase === 2 ? 'p2' : s.silence ? 'silence' : s.written.length >= WAKE_AT ? 'ready' : 'p3';
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

async function finalBattle(d: Director, from: 1 | 3 = 1): Promise<void> {
  const s: FinalState = {
    phase: 1,
    silence: isSilenceRoute(),
    sleep: 0,
    p2: 0,
    p3: 0,
    dodoWords: 0,
    hits: 0,
    falls: 0,
    written: [],
    outcome: null,
    tabLeaves: G.meta.tabLeaves,
    cracks: [],
    t: 0,
    drowned: [],
    inkTries: 0,
    friends: [],
    friendVisits: 0,
    stage: [],
    nbWords: [],
    nbWriting: false,
    recolorNext: 0,
    recolorLeft: 0,
    recolorEmo: 'joie',
    recolorBy: null,
    wasDodge: false,
    tick: null,
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
  unhook(s);
  audio.setMuffle(1, 0.5);
  audio.tempoScale = 1;
  fx.glitch = 0;
  const outcome: FinalOutcome = s.outcome ?? (s.silence ? 'silence' : 'aube');
  if (outcome === 'silence') await endingSilence(d);
  else if (outcome === 'beaux_reves') await endingBeauxReves(d);
  else await endingAube(d);
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

async function endingAube(d: Director): Promise<void> {
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

export const dodoPlushTalk: Script = async (d) => {
  if (flag('c3_dawn_ready')) await d.say(['Va, Noa.', 'Je veillerai. Pour de vrai.'], 'dodo:happy');
  else await d.say('Un mouton immense, fait de laine et de nuit. Il respire lentement.');
};

export const doorOfLight: Script = async (d) => {
  if (!flag('c3_dawn_ready')) {
    await d.say(['Une porte de lumière, tout au bout du vide.', 'Elle est fermée. Elle est trop loin.']);
    return;
  }
  await d.say(['Une porte de lumière.', 'De l\'autre côté, quelqu\'un a laissé une veilleuse allumée.']);
  d.sfx('whoosh', { pitch: 0.8 });
  d.set('fin_route', 'aube');
  await wakeUp(d, 3);
};

async function endingBeauxReves(d: Director): Promise<void> {
  d.music('dodo', 2);
  const p = d.player;
  await d.say(['Chut. Voilà.', 'Allonge-toi. Là. Tout contre moi.'], 'dodo:happy');
  d.show('player', false);
  d.spawn({ id: 'noa_lie', sprite: 'pose_noa_lie', x: tile(p.x), y: tile(p.y - 2), solid: false, shadow: false });
  await d.wait(60);
  await d.say(['Je vais te raconter une histoire.', 'Il était une fois un Pays de Coton, où il ne pleuvait que du coton…'], 'dodo:happy');
  await d.say(['…et une princesse-chevalière qui n\'est jamais partie.', 'Et un grand frère qui n\'a jamais rien fait de mal.'], 'dodo:happy');
  await d.say('Un mouton… {p:30}deux moutons… {p:40}trois…', 'dodo:neutral');
  await d.wait(40);
  await d.say(['Merci, {player}.', 'Tu peux rester, toi aussi. Tant que tu restes, il dort bien.'], 'dodo:creepy');
  await d.fadeOut(120);
  await d.image('fin_beaux_reves', [
    'Noa dort. Il fait de beaux rêves.',
    'Dans le rêve, il fait toujours nuit, et personne n\'est jamais triste.',
    'Dans l\'appartement, la veilleuse grésille encore un peu. Puis plus rien.',
  ]);
  await d.narrate('Bonne nuit, Noa.', { voice: 'dodo' });
  await d.narrate('Bonne nuit, {player}.', { voice: 'dodo' });
  await finishGame(d, 'beaux_reves');
}

async function endingSilence(d: Director): Promise<void> {
  d.music(null, 1);
  d.ambience('none');
  world.extraDarkness = 0.4;
  await d.say(['Dors, maintenant.', 'Il n\'y a plus rien à réveiller.'], 'dododark:creepy');
  fx.glitch = 0.15;
  await d.fadeOut(120);
  fx.glitch = 0;
  await d.image('fin_silence', [
    'Le Pays de Coton est noyé d\'encre.',
    'Il n\'y a plus de moutons. Plus de lune. Plus de princesse.',
    'Il n\'y a plus personne pour se souvenir de rien.',
  ]);
  await d.narrate('…', { voice: 'dododark' });
  await finishGame(d, 'silence');
}

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
  /** Phase 3 on a mixed route: 9 Encre (two of Mina's words drowned) and a few spared friends. */
  c3_final_mixed: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.encre = 9;
    G.state.kills = { nuage: 2, mouton_noir: 3, taille_crayon: 2, avion: 2 };
    G.state.spares = { pissenlit: 1, chaussette_perdue: 1, bip: 1 };
    G.state.items.push('lait');
    d.load('vide', 'center');
    await d.fadeIn(10);
    await finalBattle(d, 3);
  },
  /** Phase 3 on a gentle route: every friend was spared (both bosses included). */
  c3_final_friends: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.kills = {};
    G.state.spares = Object.fromEntries(FRIENDS.map((f) => [f.id, 1]));
    G.state.keyItems.push('veilleuse_poche');
    d.load('vide', 'center');
    await d.fadeIn(10);
    await finalBattle(d, 3);
  },
  /** Phase 3 with ink and Gomme spared: she erases a drowned word. */
  c3_final_gomme: async (d) => {
    setup(d, ['c3_intro', 'c3_mina_erased', 'c3_veilleuse'], false);
    G.state.encre = 7;
    G.state.kills = { nuage: 3, mouton_noir: 2, taille_crayon: 2 };
    G.state.spares = { gomme: 1, placard: 1, luciole: 1 };
    d.load('vide', 'center');
    await d.fadeIn(10);
    await finalBattle(d, 3);
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

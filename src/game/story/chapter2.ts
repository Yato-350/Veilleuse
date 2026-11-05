import { fx } from '../../engine/fx';
import { rng } from '../../engine/math';
import { SOUVENIRS } from '../../data/illustrations';
import { WORD_POOLS } from '../../data/words';
import type { Battle } from '../battle/battle';
import type { BattleHooks, WordDef } from '../battle/types';
import { director, type Director } from '../director';
import { isLateNight } from '../meta';
import type { Entity } from '../overworld/entity';
import type { NpcDef, Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { tf, tr } from '../../i18n';
import { shop, wakeUp } from './common';

/**
 * Chapter 2 — « La Forêt de Crayons ».
 * lisiere (Mina on her stump, Dodo, Chaussette's stall) → foret (pencil trees, erased holes, the Owl's library) →
 * clairiere (lantern puzzle, plaid) → sentier_gomme (« c'est grave si on oublie ? ») → atelier (boss Gomme, souvenir 2).
 * Mina starts forgetting; Dodo cracks for the first time (« Chut. »).
 *
 * Version 2 clues (docs/HISTOIRE.md § 3.6, docs/INDICES.md): each place keeps at most one false note, and each one has
 * an ordinary double (a joke or a line of Mina's, a banal explanation). Flags:
 *   c2_chuchote      the erased hole that whispers numbers was heard (talk counter)
 *   c2_bonnet_vu     the tiny figure in the other erased hole was seen; she is gone afterwards
 *   c2_copeaux       the sharpener's shavings were looked at; c2_taille: Noa sharpened a pencil tree (it bled ink)
 *   c2_illisible     the shelf of unread books was looked at (counter): the book that repeats one sentence
 *   c2_contes        the shelf of tales was looked at (counter): the tale heard through a telephone
 *   c2_carnet_hibou  the Owl talked about the notebook (« trois pays »)
 *   c2_fils          the threads above Mina's wrists were seen in the blue light
 *   c2_bocal         Gomme's jar of crumbs was looked at
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const withMina = (): boolean => G.state.party.includes('mina');
/** Talk counter stored in a flag: returns how many times this was seen before, then increments it. */
function bump(k: string): number {
  const n = Number(G.state.flags[k] ?? 0);
  G.state.flags[k] = n + 1;
  return n;
}

/** Tile position of an entity. */
function tileOf(e: Entity): { x: number; y: number } {
  return { x: Math.floor(e.x / 16), y: Math.floor((e.y - 2) / 16) };
}

/** Briefly swaps Mina's walking sprite for a pose (her glitched pose by default). */
async function minaGlitch(d: Director, id: string, frames: number, pose = 'pose_mina_glitch'): Promise<void> {
  const m = d.find(id);
  if (!m) return;
  const char = m.char;
  m.char = undefined;
  m.sprite = pose;
  await d.wait(frames);
  m.char = char;
  m.sprite = undefined;
}

const dodoDef = (x: number, y: number): NpcDef => ({
  id: 'dodo',
  sprite: 'npc_dodo',
  frames: ['npc_dodo', 'npc_dodo_2'],
  frameSpeed: 28,
  x,
  y,
  float: true,
  shadow: false,
  solid: false,
});

// ---------------------------------------------------------------------------
// Opening — la Lisière
// ---------------------------------------------------------------------------

export async function start(d: Director): Promise<void> {
  await d.chapter('Chapitre 2', 'La Forêt de Crayons', 'Ici, tout est dessiné. Même ce qu\'on oublie.');
  d.load('lisiere', 'bed');
  d.show('player', false);
  const stump = d.find('mina_stump');
  if (stump) {
    stump.z = 22;
    stump.shadow = false;
  }
  d.music('forest');
  await d.fadeIn(90);
  await d.wait(40);
  await d.say(['Une odeur de bois taillé. De gomme. De cahier neuf.', 'Le lit t\'attendait, de l\'autre côté.']);
  d.show('player', true);
  d.face('player', 'right');
  d.sfx('pop');
  await d.wait(30);
  await intro(d);
}

async function intro(d: Director): Promise<void> {
  const p = tileOf(d.player);
  const m = d.find('mina_stump');
  if (m) {
    d.face('mina_stump', 'left');
    await d.emote('mina_stump', '!');
    // She hops off her stump.
    for (let i = 0; i < 8; i++) {
      m.z = Math.max(0, 22 - i * 3) + (i < 3 ? 2 : 0);
      await d.wait(2);
    }
    m.z = 0;
    m.shadow = true;
    d.sfx('step', { pitch: 1.4 });
    await d.walkTo('mina_stump', p.x + 1, p.y, 1.5);
    d.face('mina_stump', 'left');
  }
  d.face('player', 'right');
  await d.say(['Noa ! Tu es revenu !', 'Tu as dormi super longtemps, tu sais. Super super longtemps.'], 'mina:happy');
  await d.say(['Je t\'ai attendu sur ma souche.', 'J\'ai compté jusqu\'à mille. Deux fois. La deuxième fois, j\'ai triché.'], 'mina:happy');
  await d.say('…', 'noa:tired');
  if (flag('c1_placard_spared')) {
    await d.say(['Le Monstre du Placard te dit coucou !', 'Il dort la porte ouverte, maintenant. Avec une petite lumière.'], 'mina:happy');
  } else if (flag('c1_boss_done')) {
    await d.say(['La colline est toute tachée d\'encre, maintenant.', 'J\'y vais plus. Ça sent le noir.'], 'mina:sad');
  }
  if (G.state.weapon === 'cire') await d.say('Et t\'as gardé mon crayon rouge ! Il te va trop bien.', 'mina:happy');
  await d.say([
    'Bon. L\'étoile, on l\'a pas trouvée. Mais j\'ai une nouvelle mission.',
    'Quelqu\'un efface la {c:l}Forêt de Crayons{/c}. Les arbres, les fleurs… Mes dessins. Frrrt. Partis.',
  ], 'mina:angry');
  await d.say([
    'Les lucioles disent que c\'est {c:p}Gomme{/c}. Elle habite tout au fond, dans un atelier.',
    'On va l\'arrêter ! Enfin… lui parler d\'abord. C\'est toi qui m\'as appris ça.',
  ], 'mina:neutral');

  // Dodo
  d.spawn(dodoDef(p.x, p.y - 2));
  d.sfx('chime', { pitch: 0.8 });
  await d.emote('dodo', '♥');
  await d.say(['Te revoilà, Noa.', 'La forêt est un peu… {static}abîmée{/static}, en ce moment. Restez sur le chemin.'], 'dodo:happy');
  await d.say('Dodo ! T\'étais où ?', 'mina:surprised');
  await d.say('Jamais très loin.', 'dodo:neutral');
  await d.wait(30);
  await d.say([
    '…Et toi aussi, te revoilà, {player}.',
    'Je savais que tu reviendrais. On revient toujours, ici.',
  ], 'dodo:neutral');
  if (isLateNight()) await d.say('Il est {time}. Chez toi aussi, il fait nuit, hein ?', 'dodo:neutral');
  else if (G.meta.newGames > 1) await d.say('C\'est drôle. J\'ai l\'impression qu\'on s\'est déjà dit tout ça.', 'dodo:neutral');
  if (G.state.encre > 0) await d.say('Tu as un peu d\'encre sur les mains, Noa. Ce n\'est rien. Ça part au lavage.', 'dodo:neutral');
  await d.say('Si quelque chose vous fait peur, pensez à {static}moi{/static}. Bonne promenade !', 'dodo:happy');
  d.sfx('chime');
  d.remove('dodo');
  await d.wait(20);
  await d.say('Allez, Noa ! La forêt, c\'est par là. Suis la chevalière !', 'mina:happy');
  d.remove('mina_stump');
  d.follower('mina');
  world.resetFollower();
  d.set('c2_intro');
}

export const minaStump: Script = async (d) => {
  if (!flag('c2_intro')) await intro(d);
};

// ---------------------------------------------------------------------------
// Lisière — objects and people
// ---------------------------------------------------------------------------

export const dreamBed: Script = async (d) => {
  await d.say(['Le lit, posé dans l\'herbe. Il t\'a suivi jusqu\'ici.', 'Les draps sont encore tièdes.']);
  const r = await d.ask('Te recoucher ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  await d.fadeOut(30);
  await d.wait(50);
  await d.fadeIn(30);
  await d.say(['Tu fermes les yeux dans le rêve.', '… Rien. On ne peut pas dormir deux fois.']);
  if (withMina()) await d.say('Hé ! C\'est pas le moment de faire la sieste, chevalier !', 'mina:angry');
};

export const stumpText: Script = async (d) => {
  await d.say(['Une souche. Enfin… un gros bout de crayon de cire, coupé ras.', 'C\'est le trône de Mina. Il y a des petites marques de bottes dessus.']);
};

export const lisiereSign: Script = async (d) => {
  await d.say(['« → FORÊT DE CRAYONS »', 'En dessous, quelqu\'un a ajouté au crayon : « ne pas tailler les arbres SVP ».']);
};

export const backSign: Script = async (d) => {
  await d.say(['« ← PAYS DE COTON (fermé pour la nuit) »', 'Le chemin disparaît dans un brouillard de coton.']);
  if (withMina()) await d.say('Pas par là ! L\'aventure, c\'est de l\'autre côté !', 'mina:neutral');
};

export const mailbox: Script = async (d) => {
  if (flag('c2_mailbox')) {
    await d.say('La boîte aux lettres est vide. Elle l\'a toujours été, peut-être.');
    return;
  }
  d.set('c2_mailbox');
  await d.say(['Une boîte aux lettres, plantée au milieu de nulle part.', 'Dedans, une feuille pliée en quatre. Tu la déplies.', '… Elle est blanche. Quelqu\'un l\'a gommée avec beaucoup de soin.']);
  if (withMina()) await d.say('C\'était une lettre pour qui ?', 'mina:neutral');
};

export const moutonEgare: Script = async (d) => {
  const n = Number(G.state.flags.c2_egare ?? 0);
  G.state.flags.c2_egare = n + 1;
  if (n === 0) {
    await d.say(['Bêê… Vous allez dans la forêt ?', 'Moi, je n\'y vais plus. Ça s\'efface, là-bas.'], 'mouton');
    return;
  }
  if (n === 1) {
    await d.say(['Mon cousin y est allé, la semaine dernière.', 'Il s\'appelait… Il s\'appelait…', '…'], 'mouton');
    await d.say('C\'est drôle. Je ne sais plus si j\'avais un cousin.', 'mouton');
    return;
  }
  await d.say('Si tu vois quelque chose de blanc, ne marche pas dedans. On ne sait jamais ce qu\'on oublie.', 'mouton');
};

export const chaussetteTalk: Script = async (d) => {
  const paire = flag('c1_chaussette_paire');
  if (!flag('c2_chaussette')) {
    d.set('c2_chaussette');
    if (paire) {
      await d.say(['Noa ! Mon petit chou ! Regarde qui est là !', 'On a monté un étal ambulant, ma paire et moi. À deux, on porte deux fois plus de choses !'], 'chaussette:happy');
      await d.say('Tiens, pour la route. Il fait frais, dans la forêt.', 'chaussette:happy');
      await d.give('chocolat');
    } else if (flag('c1_sock_done')) {
      await d.say(['Oh, bonjour, mon chou…', 'On m\'a dit qu\'il y avait une flaque d\'encre bleue, sur le chemin de la colline.', 'Une flaque… avec des pois.'], 'chaussette:neutral');
      await d.say('Ce n\'est sûrement rien. Sûrement.', 'chaussette:neutral');
      if (withMina()) await d.say('…', 'mina:sad');
    } else {
      await d.say(['Oh, bonjour, mon chou !', 'Toujours pas de nouvelles de ma paire. Alors j\'ai pris la route avec mon étal.', 'Peut-être qu\'elle se promène dans la forêt ?'], 'chaussette:neutral');
    }
    await d.say(['Fais attention, là-dedans. Gomme a effacé mon panneau, la semaine dernière.', 'Il ne restait que le clou.'], 'chaussette:neutral');
  } else if (paire) {
    await d.say('Deux chaussettes, deux fois plus de choix ! Et deux fois plus de câlins.', 'chaussette:happy');
  } else {
    await d.say('Si tu vois une chaussette bleue à pois, dis-lui que je l\'attends. Je l\'attendrai toujours.', 'chaussette:neutral');
  }
  const r = await d.ask('Acheter quelque chose ?', ['Oui', 'Non'], paire ? 'chaussette:happy' : 'chaussette:neutral', { cancelIndex: 1 });
  if (r === 0) await chaussetteShop(d);
};

export const chaussetteShop: Script = async () => {
  const paire = flag('c1_chaussette_paire');
  await shop(
    ['bonbon', 'lait', 'biscuit', 'chocolat', 'pomme', 'mouchoir', 'bulles', 'pluie', 'orage'],
    paire ? 'L\'étal ambulant des Chaussettes ! Tout est cousu main. Enfin… pied. Enfin… pieds !' : 'Bienvenue à l\'étal de Chaussette. Il fait un peu froid, mais les prix sont chauds.',
    undefined,
    paire ? 0.5 : 0,
  );
};

// ---------------------------------------------------------------------------
// Forêt de Crayons
// ---------------------------------------------------------------------------

export const foretFlowers: Script = async (d) => {
  if (!withMina()) return;
  d.set('c2_flowers');
  await d.wait(10);
  await d.emote('mina', '…');
  await d.say(['…', 'Avant, il y avait des fleurs ici.'], 'mina:sad');
  await d.wait(30);
  await d.say('Je crois.', 'mina:neutral');
};

export const minaFreeze: Script = async (d) => {
  if (!withMina()) return;
  const m = d.find('mina');
  await d.say(['Hé, Noa. Tu te souviens de la cabane sous la table du salon ?', 'Avec le plaid, les coussins, et la lampe de poche de Papi.'], 'mina:happy');
  await d.say('Maman avait dit qu\'on pouvait la garder jusqu\'à', 'mina:happy', { auto: 30 });
  // She stops. Mid-sentence. Everything stops.
  d.music(null, 0.05);
  d.ambience('none');
  fx.pulseGlitch(10);
  await minaGlitch(d, 'mina', 5);
  if (m) m.moving = false;
  await d.wait(100);
  const p = d.player;
  if (m) d.face('player', Math.abs(m.x - p.x) > Math.abs(m.y - p.y) ? (m.x > p.x ? 'right' : 'left') : m.y > p.y ? 'down' : 'up');
  await d.wait(30);
  await d.emote('player', '?');
  await d.say('…Mina ?', 'noa:surprised');
  await d.wait(70);
  // For a handful of ticks, facing you, her eyes are two buttons sewn with red thread (§ 2.4, T3). Then the glitch.
  if (m) m.data.boutons = true;
  await minaGlitch(d, 'mina', 6, 'pose_mina_boutons');
  fx.pulseGlitch(6);
  await minaGlitch(d, 'mina', 3);
  d.music('forest', 0.3);
  await d.say(['…dimanche ! Et on l\'a gardée trois dimanches. Hihi.', 'Quoi ? Pourquoi tu me regardes comme ça ?'], 'mina:happy');
  await d.say('…', 'noa:sad');
  await d.say('T\'es bizarre, aujourd\'hui. Allez, viens !', 'mina:neutral');
  d.set('c2_freeze');
};

export const forestSign: Script = async (d) => {
  await d.say(['« ↑ Clairière des Lucioles · ← Lisière · Bibliothèque du Hibou ↖ »', 'Tout en bas, quelqu\'un avait écrit en rouge : « ATTENTION À G… ». La suite est gommée.']);
};

export const inkPond: Script = async (d) => {
  if (!flag('c2_pond')) {
    d.set('c2_pond');
    await d.say(['Une mare d\'encre bleue. Elle ne fait aucune vague.', 'Tu te penches. Ton reflet a les yeux fermés.']);
    return;
  }
  await d.say(['Ton reflet dort toujours.', 'Il a l\'air bien. Il a l\'air de ne plus jamais vouloir se réveiller.']);
};

export const erasedDrawing: Script = async (d) => {
  await d.say(['Un dessin, à moitié gommé, posé à même le sol.', 'On devine un toit, une fenêtre. Une maison. Il manque la porte.']);
  if (withMina()) await d.say('On peut pas rentrer dans une maison sans porte…', 'mina:sad');
};

/** The erased hole east of the path: something counts, deep in the white (§ 2.4, T3). */
export const erasedHole: Script = async (d) => {
  if (bump('c2_chuchote')) {
    await d.say(['Le trou blanc chuchote toujours, tout au fond.', 'Tu n\'arrives jamais à entendre la fin.']);
    return;
  }
  await d.say(['Un trou blanc dans le monde. Pas un trou noir : un trou blanc.', 'Il n\'y a rien dedans. Même pas le vide.']);
  await d.say('Tu te penches au-dessus du bord. Tout au fond, quelque chose chuchote.');
  d.sfx('static', { vol: 0.2, pitch: 0.6 });
  await d.say('{spd:0.5}{c:g}« …trois cent… soixante… »{/c}{/spd}');
  if (withMina()) {
    await d.say(['Chut ! C\'est quelqu\'un qui compte les moutons.', 'Faut pas le déranger. Sinon, il doit tout recommencer depuis le début.'], 'mina:neutral');
  }
};

/**
 * The erased hole in the south-west: far away in the white, a tiny figure in grey pencil, seen from behind, in a hat
 * with sheep ears (§ 2.10, T9). Mina's double: an eraser always misses a little bit. Then she is not there any more.
 */
export const erasedHoleFigure: Script = async (d) => {
  const e = d.find('c2_bonnet');
  if (!e) {
    await d.say(['Un trou blanc dans le monde. Pas un trou noir : un trou blanc.', 'Il n\'y a rien dedans. Même pas le vide.']);
    return;
  }
  // Keep her above the dialogue box.
  await d.cameraTo(Math.floor(e.x / 16), Math.floor((e.y - 8) / 16));
  await d.say(['Un trou blanc dans le monde. Pas un trou noir : un trou blanc.', 'Tout au fond, très loin, il y a une toute petite figure. De dos.']);
  await d.wait(30);
  await d.say('Elle ne bouge pas. Elle a l\'air d\'attendre quelqu\'un.');
  if (withMina()) await d.say(['C\'est un bout de dessin que Gomme a oublié !', 'Il reste toujours un petit bout, quand on gomme. Toujours.'], 'mina:neutral');
  d.set('c2_bonnet_vu');
  e.alpha = 0.5;
  await d.wait(6);
  d.remove('c2_bonnet');
  await d.wait(40);
  await d.say('Tu regardes encore. Il n\'y a plus rien. Gomme est repassée, sûrement.');
  d.cameraFollow();
};

/** The giant sharpener: the shavings (§ 3.6), and in the forest, sharpening a pencil tree that bleeds ink. */
export const sharpener: Script = async (d) => {
  await d.say(['Un taille-crayon géant, couché dans les copeaux.', 'Des centaines de crayons sont passés par là. Ils en sont ressortis plus courts.']);
  if (!flag('c2_copeaux')) {
    d.set('c2_copeaux');
    await d.say('Par terre, les copeaux sont fins, recourbés, un peu transparents. Comme des rognures d\'ongles.');
    if (withMina()) await d.say(['Beurk !', '…Moi, je les garde pour faire des jupes aux fleurs. Ça tourne comme une robe de princesse.'], 'mina:happy');
  }
  if (G.state.map !== 'foret') return;
  if (flag('c2_taille')) {
    await d.say('Le crayon rouge a une coupe toute fraîche. Tu n\'as pas envie de recommencer.');
    return;
  }
  const r = await d.ask('Tailler un arbre-crayon ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
  if (r === 0) await bleedingTree(d);
};

/**
 * Sharpening the red pencil tree next to the sharpener: the cut oozes thick dark-red ink down the trunk (§ 3.6). The
 * double is plain: a red pencil is red inside. With « Réduire les flashs », no shake and no spray, only slow drops.
 */
async function bleedingTree(d: Director): Promise<void> {
  d.set('c2_taille');
  const gentle = G.settings.reduceFlashes;
  const sh = d.find('taille_crayon_geant');
  const ox = sh ? sh.x : d.player.x;
  const oy = sh ? sh.y : d.player.y;
  // The nearest red pencil tree (there is one right next to the sharpener).
  const tree = world.entities
    .filter((e) => e.sprite === 'prop_pencil_r')
    .sort((a, b) => Math.hypot(a.x - ox, a.y - oy) - Math.hypot(b.x - ox, b.y - oy))[0];
  await d.say(['Tu pousses le taille-crayon contre le tronc rouge le plus proche. Il est lourd.', 'Tu tournes.']);
  for (let i = 0; i < 3; i++) {
    d.sfx('scratch', { pitch: 0.7 + i * 0.05 });
    if (!gentle) d.shake(1, 10);
    if (tree) world.particles.burst(tree.x - 3, tree.y - 26, '#dcb488', 4, 0.8);
    await d.wait(22);
  }
  await d.say('Crrr. Crrr. Le bois s\'enroule en copeaux. Puis quelque chose perle, sous la coupe.');
  if (tree) world.particles.bleed(tree.x - 3, tree.y - 26, tree.y - 1, { frames: 260, color: '#6a1028', dark: '#2e0816', gentle });
  d.sfx('pop', { pitch: 0.4, vol: 0.4 });
  await d.wait(60);
  await d.say(['Ça coule le long du bois. Lentement. Épais.', 'Rouge sombre, comme d\'une écorchure.']);
  if (withMina()) {
    await d.say('Il saigne !', 'mina:surprised');
    await d.wait(30);
    await d.say(['…Mais non. C\'est un crayon rouge, gros bêta. C\'est rouge, dedans.', 'Tout le monde sait ça.'], 'mina:neutral');
    await d.say('Le panneau disait de pas tailler les arbres, quand même.', 'mina:sad');
  } else {
    await d.say('De la mine. Un crayon rouge est rouge dedans. C\'est tout.');
  }
  await d.wait(30);
  await d.say('Tu remets le taille-crayon à sa place. Le crayon goutte encore un peu. Puis plus du tout.');
}

export const greenPencil: Script = async (d) => {
  if (flag('c2_hidden_choc')) {
    await d.say('Un crayon vert géant. Tu as déjà fouillé ses racines.');
    return;
  }
  d.set('c2_hidden_choc');
  await d.say(['Un crayon vert géant, tout au fond de la forêt.', 'À son pied, quelqu\'un a caché un gâteau, enveloppé dans une serviette. Il reste huit bougies dessus.']);
  await d.give('gateau');
  if (withMina()) await d.say('Huit bougies ! Comme moi ! … C\'était mon anniversaire, ça ?', 'mina:surprised');
};

export const chewedPencil: Script = async (d) => {
  const n = Number(G.state.flags.c2_chewed ?? 0);
  G.state.flags.c2_chewed = n + 1;
  const lines = [
    'Un crayon géant. Le bout est tout mâchouillé.',
    'Les traces de dents sont énormes. Et étrangement familières.',
    'C\'est ton crayon de CE2. Celui que tu mâchouillais pendant les dictées. Il a beaucoup grandi.',
  ];
  await d.say(lines[Math.min(n, lines.length - 1)]!);
};

export const moutonPeintre: Script = async (d) => {
  if (flag('c2_gomme_spared')) {
    await d.say(['Tout est revenu ! Je n\'ai plus rien à redessiner.', 'Alors je dessine des choses nouvelles. C\'est bien aussi.'], 'mouton');
    return;
  }
  const n = Number(G.state.flags.c2_peintre ?? 0);
  G.state.flags.c2_peintre = n + 1;
  if (n === 0) {
    await d.say(['Ah, des promeneurs ! Ne marchez pas dans le blanc, je viens de le gommer…', 'Non. Pardon. C\'est Gomme qui l\'a gommé. Moi, je redessine.'], 'mouton');
    await d.say(['Le problème, c\'est que je ne me souviens plus de ce qu\'il y avait.', 'Alors je dessine des choses au hasard. Hier, j\'ai dessiné un parapluie.'], 'mouton');
    return;
  }
  await d.say('Tu te souviens de ce qu\'il y avait ici, toi ? … Non ? Personne ne se souvient.', 'mouton');
};

// ---------------------------------------------------------------------------
// Bibliothèque du Hibou
// ---------------------------------------------------------------------------

const RIDDLES: Array<{ q: string[]; choices: string[]; answer: number; ok: string[]; item: string }> = [
  {
    q: ['Hou. Première devinette.', 'Plus il y en a, moins on y voit. Qu\'est-ce que c\'est ?'],
    choices: ['Le noir', 'Les étoiles', 'Les moutons'],
    answer: 0,
    ok: ['Hou ! Le noir. Bien sûr.', 'Ceux qui en ont peur devraient toujours garder une petite lumière près d\'eux.'],
    item: 'biscuit',
  },
  {
    q: ['Hou. Deuxième devinette.', 'Il est à toi, mais les autres s\'en servent bien plus que toi. Qu\'est-ce que c\'est ?'],
    choices: ['Ton lit', 'Ton prénom', 'Ton ombre'],
    answer: 1,
    ok: ['Hou-hou. Ton prénom. Noa.', 'Quelqu\'un le disait très souvent, avant. Tout le temps, même. En riant.'],
    item: 'lait',
  },
  {
    q: ['Hou. Dernière devinette. La plus difficile.', 'Il suffit de dire mon nom pour que je disparaisse. Qui suis-je ?'],
    choices: ['Un secret', 'Le sommeil', 'Le silence'],
    answer: 2,
    ok: ['Hou. Le silence.', 'Ici, il est très bien gardé. Peut-être trop bien.'],
    item: 'chocolat',
  },
];

export const hibou: Script = async (d) => {
  if (!flag('c2_hibou_met')) {
    d.set('c2_hibou_met');
    await d.say(['Hou. Hou-hou. Des lecteurs !', 'Ça faisait longtemps. Très longtemps.'], 'hibou');
    await d.say(['Je suis le Hibou. Je garde les livres que personne ne lit.', 'Ils sont très bien gardés. Personne ne vient jamais les chercher.'], 'hibou');
    if (withMina()) {
      await d.say('C\'est toi qui as écrit tous ces livres ?', 'mina:surprised');
      await d.say('Hou, non. Moi, je les plie. C\'est très différent.', 'hibou');
    }
  }
  for (;;) {
    // Once the notebook on the desk has been looked at, the Owl can talk about it (§ 2.2, T1).
    const topics = ['Une devinette', 'Les lanternes', 'Gomme', ...(flag('c2_carnet') ? ['Le carnet'] : []), 'Au revoir'];
    const pick = await d.ask('Hou ? Que veux-tu savoir ?', topics, 'hibou', { cancelIndex: topics.length - 1 });
    const r = topics[pick] === 'Le carnet' ? 4 : topics[pick] === 'Au revoir' ? 3 : pick;
    if (r === 0) await riddle(d);
    else if (r === 4) await owlNotebook(d);
    else if (r === 1) {
      d.set('c2_hint');
      await d.say([
        'Les lanternes de la clairière ? Hou.',
        'Autrefois, les lucioles les allumaient en chantant une comptine. Toujours dans le même ordre.',
        'J\'ai rangé la comptine sur l\'étagère de droite. Si Gomme ne l\'a pas mangée.',
      ], 'hibou');
    } else if (r === 2) {
      await d.say([
        'Gomme… Elle efface ce qui fait mal. Elle croit que c\'est gentil.',
        'Elle est venue ici, une fois. Elle a gommé un rayon entier.',
        'Je ne sais plus ce qu\'il y avait dessus. C\'est ça, le problème, avec Gomme : on ne sait jamais ce qu\'on a perdu.',
      ], 'hibou');
      if (withMina()) await d.say('…', 'mina:sad');
    } else {
      await d.say('Hou. Reviens quand tu veux. Les livres ne bougent pas. Ils attendent.', 'hibou');
      return;
    }
  }
};

/** The Owl on the notebook with star stickers: « trois pays » (§ 2.2, T1). The double: children's notebooks end in scribbles. */
async function owlNotebook(d: Director): Promise<void> {
  d.set('c2_carnet_hibou');
  await d.say(['Hou. Le carnet aux étoiles…', 'Ce carnet n\'a que trois pays. Le reste, quelqu\'un d\'autre le gribouille.'], 'hibou');
  if (withMina()) {
    await d.say(['Normal ! Les dernières pages d\'un cahier, c\'est toujours pour les gribouillis.', 'Tout le monde fait ça.'], 'mina:happy');
  } else {
    await d.say('Les cahiers d\'enfants finissent souvent comme ça. Hou.', 'hibou');
  }
}

async function riddle(d: Director): Promise<void> {
  const i = Number(G.state.flags.c2_riddle ?? 0);
  const rd = RIDDLES[i];
  if (!rd) {
    await d.say(['Je n\'ai plus de devinettes. Seulement des questions.', 'Les questions, c\'est moins drôle : on n\'a pas toujours la réponse.'], 'hibou');
    return;
  }
  await d.say(rd.q.slice(0, -1), 'hibou');
  const a = await d.ask(rd.q[rd.q.length - 1]!, rd.choices, 'hibou');
  if (a !== rd.answer) {
    await d.say('Hou. Non. Réfléchis encore. Les devinettes ne s\'envolent pas.', 'hibou');
    if (withMina() && i === 0) await d.say('Psst… C\'est un truc qui fait peur la nuit.', 'mina:neutral');
    return;
  }
  G.state.flags.c2_riddle = i + 1;
  await d.say(rd.ok, 'hibou');
  await d.say('Pour ta peine, un petit quelque chose. Les bibliothécaires ont toujours des provisions.', 'hibou');
  await d.give(rd.item);
}

export const shelfUnread: Script = async (d) => {
  await d.say([
    'L\'étagère des livres que personne ne lit.',
    '« Lettres jamais envoyées ». « Ce que j\'aurais dû dire ». « Mode d\'emploi d\'une veilleuse ».',
    '« Combien de temps dure un an ». Les pages ne sont même pas coupées.',
  ]);
  // Looked at again: the one book that has been read, and read, and read (§ 2.4, T3).
  if (!bump('c2_illisible')) return;
  await d.say(['Sauf un. Celui-là, on l\'a ouvert souvent : la tranche est toute grise de doigts.', 'Tu l\'ouvres au hasard.']);
  const page = ['Tu es revenu !', 'Tu as dormi super longtemps.'];
  await d.paper([...page, ...page, ...page, ...page, 'Tu es revenu !', 'Tu as dormi super lon']);
  await d.say(['Toutes les pages disent la même chose. Le livre est très épais.', 'Tu ne comptes pas les pages.']);
  if (withMina()) {
    await d.say(['C\'est des lignes ! Comme à l\'école, quand on recopie une phrase jusqu\'à ce qu\'elle soit belle.', 'Celle-là, elle est déjà belle, pourtant.'], 'mina:neutral');
  }
};

export const shelfTales: Script = async (d) => {
  await d.say([
    'Des contes. « Le Mouton qui comptait les enfants ». « La Lune qui ne voulait pas se coucher ».',
    '« La Princesse-Chevalière contre le Monstre du Placard ». Écrit en grosses lettres. Ça finit bien.',
  ]);
  if (withMina()) await d.say('Hé ! C\'est mon histoire ! Je suis connue !', 'mina:happy');
  // Looked at again: a tale that stops in the middle (§ 3.6, T8). The double: phone calls always cut at the best part.
  if (!bump('c2_contes')) return;
  await d.say('Tout au bout de l\'étagère, un conte sans couverture. Les pages s\'arrêtent au milieu d\'une phrase.');
  await d.say(['Hou. Et celui-ci, quelqu\'un l\'a écouté à travers un téléphone.', 'Il ne finit pas.'], 'hibou');
  if (withMina()) await d.say('Au téléphone, ça coupe toujours au meilleur moment. Saleté de réseau !', 'mina:angry');
};

export const shelfRhymes: Script = async (d) => {
  await d.say(['L\'étagère des comptines. Un petit livre dépasse, tout corné.', '« Comptines pour allumer la nuit ». Tu l\'ouvres à la page marquée.']);
  d.set('c2_hint');
  await d.paper(['Rouge, la fraise du goûter,', 'Jaune, le soleil levé,', 'Vert, le jardin mouillé,', 'Bleu, la nuit pour rêver.', '', 'Quatre lanternes, une chanson :', 'les lucioles rentrent à la maison.'], 'Comptine des lanternes');
  if (withMina()) {
    await d.say(['Je la connais, celle-là ! C\'est moi qui l\'ai inventée !', '… Ou alors on me l\'a chantée. Je sais plus.'], 'mina:surprised');
  }
};

export const shelfBlank: Script = async (d) => {
  await d.say(['Un livre sans titre, tout au bout de l\'étagère.', 'Sur la tranche, quelqu\'un a écrit au crayon : « {player} ».', 'Toutes les pages sont blanches. Pour l\'instant.']);
  if (flag('c2_hibou_met')) await d.say('Hou. Celui-là n\'est pas encore écrit. Ne le lis pas trop vite.', 'hibou');
};

export const jars: Script = async (d) => {
  await d.say(['Des bocaux étiquetés à la main : « mots doux », « mots durs », « mots trop longs ».', 'Le dernier, « mots qu\'on n\'a pas dits », est plein à ras bord. Le couvercle force.']);
};

export const carnet: Script = async (d) => {
  await d.say(['Un carnet à spirale, posé seul sur le bureau.', 'Des gommettes en forme d\'étoile sur la couverture. Une petite lumière s\'en échappe.']);
  const r = await d.ask('L\'ouvrir ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
  if (r === 0) {
    await d.say(['Tu poses la main sur la couverture.', '…', 'Tu ne peux pas. Tes doigts ne veulent pas.']);
  }
  if (!flag('c2_carnet')) {
    d.set('c2_carnet');
    await d.say(['Hou. Celui-là…', 'On l\'a écrit pour quelqu\'un qui ne l\'a jamais ouvert.', 'Il attend. Les carnets, ça sait attendre très longtemps.'], 'hibou');
    if (withMina()) {
      await d.say('Il est joli. On dirait le mien.', 'mina:happy');
      await d.wait(30);
      await d.say('…J\'avais un carnet, moi ?', 'mina:neutral');
    }
  }
};

// ---------------------------------------------------------------------------
// Clairière des Lucioles — the lantern puzzle
// ---------------------------------------------------------------------------

const LANTERN_ORDER = ['r', 'y', 'g', 'b'] as const;
type LanternColor = (typeof LANTERN_ORDER)[number];
const LANTERN_NAME: Record<LanternColor, string> = { r: 'rouge', y: 'jaune', g: 'verte', b: 'bleue' };
const LANTERN_LIGHT: Record<LanternColor, string> = { r: '#e8505b', y: '#ffe991', g: '#8fd28a', b: '#6d8fd6' };
let lanternSeq: LanternColor[] = [];

function setLantern(d: Director, c: LanternColor, on: boolean): void {
  const e = d.find(`lantern_${c}`);
  if (!e) return;
  e.sprite = `prop_lantern_${c}_${on ? 'on' : 'off'}`;
  e.light = on ? { r: 34, color: LANTERN_LIGHT[c], flicker: true, dy: -10 } : undefined;
}

/** Fireflies that come back once the lanterns are lit (also placed on the map with a condition). */
export const FIREFLIES: Array<[number, number]> = [
  [11, 6],
  [18, 6],
  [14, 9],
  [9, 13],
  [20, 12],
  [16, 7],
  [14, 3],
  [15, 1],
];

export const clairiereEnter: Script = (d) => {
  if (flag('c2_lanterns_ok')) {
    for (const c of LANTERN_ORDER) setLantern(d, c, true);
    world.extraDarkness = -0.25;
  } else {
    lanternSeq = [];
  }
};

export const lantern =
  (c: LanternColor): Script =>
  async (d) => {
    if (flag('c2_lanterns_ok')) {
      await d.say(tf('La lanterne {0} brille doucement. Des lucioles dansent autour.', tr(LANTERN_NAME[c])));
      return;
    }
    if (lanternSeq.includes(c)) {
      await d.say(tf('La lanterne {0} brille déjà.', tr(LANTERN_NAME[c])));
      return;
    }
    d.sfx('chime', { pitch: 0.8 + LANTERN_ORDER.indexOf(c) * 0.12 });
    setLantern(d, c, true);
    lanternSeq.push(c);
    const expected = LANTERN_ORDER.slice(0, lanternSeq.length);
    const right = lanternSeq.every((x, i) => x === expected[i]);
    await d.say(tf("Tu effleures la lanterne {0}. Une petite flamme s'y réveille.", tr(LANTERN_NAME[c])));
    if (!right) {
      await d.wait(20);
      d.sfx('whoosh', { pitch: 0.5 });
      for (const k of LANTERN_ORDER) setLantern(d, k, false);
      lanternSeq = [];
      const fails = Number(G.state.flags.c2_lantern_fails ?? 0) + 1;
      G.state.flags.c2_lantern_fails = fails;
      await d.say('Pfff. Toutes les lanternes s\'éteignent d\'un coup, comme une bougie qu\'on souffle.');
      if (withMina()) {
        if (fails === 1) await d.say('Raté ! Il faut un ordre, je crois. Le panneau, au milieu, il disait quoi ?', 'mina:neutral');
        else if (fails === 2) await d.say('Rouge, la fraise… jaune, le soleil… Et après ? Le jardin, c\'est quelle couleur, un jardin ?', 'mina:neutral');
        else await d.say('Rouge, jaune, vert, bleu ! Comme l\'arc-en-ciel ! … Enfin, presque tout l\'arc-en-ciel.', 'mina:happy');
      }
      return;
    }
    if (lanternSeq.length === LANTERN_ORDER.length) await lanternsSolved(d);
  };

async function lanternsSolved(d: Director): Promise<void> {
  d.set('c2_lanterns_ok');
  d.music(null, 1);
  await d.wait(30);
  d.sfx('chime', { pitch: 1.3 });
  d.flash('#ffe991', 20);
  world.extraDarkness = -0.25;
  for (const [i, [x, y]] of FIREFLIES.entries()) {
    d.spawn({
      id: `luciole_${i}`,
      sprite: 'npc_luciole',
      frames: ['npc_luciole', 'npc_luciole_2'],
      frameSpeed: 10 + i,
      x,
      y,
      float: true,
      shadow: false,
      solid: false,
      light: { r: 18, color: '#ffe991', flicker: true },
    });
    await d.wait(8);
  }
  d.music('forest');
  await d.say(['Les quatre lanternes brillent ensemble.', 'Une à une, les lucioles sortent des herbes. Elles chantent tout bas, sans paroles.']);
  if (withMina()) {
    await d.say(['Les lucioles ! Elles sont revenues !', 'Je le savais. Je savais qu\'elles chantaient.'], 'mina:happy');
    await threadsInBlue(d);
  }
  await d.say(['Tout au nord de la clairière, les crayons serrés comme des barreaux s\'écartent en grinçant.', 'Un chemin apparaît, bordé de petites lumières.']);
  d.sfx('knock', { pitch: 0.6 });
  d.shake(1, 30);
  await d.fadeOut(30);
  const p = tileOf(d.player);
  world.load('clairiere', { x: p.x, y: p.y, dir: d.player.dir }, { keepMusic: true });
  await d.wait(10);
  await d.fadeIn(30);
  await d.say(['Au pied de la lanterne bleue, quelque chose est plié avec soin.', 'Un plaid. Doux, un peu bouloché. Il sent la lessive de Maman.']);
  G.state.armor = 'plaid';
  d.sfx('item');
  await d.say('Tu obtiens : {c:y}Plaid tout doux{/c}. Tu le poses sur tes épaules. {c:g}(DÉF +2){/c}');
  if (withMina()) {
    await d.say(['C\'est le plaid du canapé ! Celui de la cabane !', 'On se mettait dessous pour regarder les dessins animés. Toi, tu t\'endormais toujours avant la fin.'], 'mina:happy');
  }
}

/**
 * In the blue light, for a moment, two threads above Mina's wrists rise out of sight (§ 2.10, T9: the puppet she was).
 * Doubles: Mina thinks it is a spider; the narrator says the fireflies leave trails of light everywhere.
 */
async function threadsInBlue(d: Director): Promise<void> {
  const m = d.find('mina');
  if (!m) return;
  d.set('c2_fils');
  const t = d.spawn({ id: 'fils_mina', sprite: 'fx_fils_mina', x: 0, y: 0, shadow: false, solid: false });
  t.x = m.x;
  t.y = m.y;
  t.layer = 1;
  t.alpha = 0;
  d.sfx('thread', { vol: 0.25, pitch: 1.4 });
  for (let i = 1; i <= 10; i++) {
    t.alpha = i / 10;
    await d.wait(3);
  }
  await d.say(['Dans la lumière de la lanterne bleue, quelque chose brille au-dessus des poignets de Mina.', 'Deux fils. Très fins. Ils montent tout droit, jusqu\'où tu ne vois plus.']);
  await d.say('Quoi ? J\'ai une araignée sur moi ? ENLÈVE-LA !', 'mina:surprised');
  for (let i = 9; i >= 0; i--) {
    t.alpha = i / 10;
    await d.wait(2);
  }
  d.remove('fils_mina');
  await d.say(['Tu passes la main au-dessus de ses poignets. Rien.', 'Un fil de lumière, peut-être. Les lucioles en laissent partout.']);
  await d.say('Ouf.', 'mina:neutral');
}

export const rainbowSign: Script = async (d) => {
  await d.say(['Un panneau. Dessus, un arc-en-ciel dessiné au crayon de cire.', 'Une partie a été gommée. Juste en dessous, une comptine, d\'une écriture ronde et maladroite.']);
  await d.paper(['Rouge, la fraise du goûter,', 'Jaune, le ______ levé,', '______, le jardin mouillé,', 'Bleu, la nuit pour rêver.'], 'Pour allumer la nuit');
  if (withMina() && !flag('c2_sign_read')) await d.say('Quelqu\'un a gommé des mots ! C\'est sûrement Gomme. Elle gomme tout, celle-là.', 'mina:angry');
  d.set('c2_sign_read');
};

export const lastFirefly: Script = async (d) => {
  if (flag('c2_lanterns_ok')) {
    await d.say(['Merci, merci ! On voit de nouveau le chemin.', 'L\'atelier de Gomme est tout au bout. Là où il ne reste plus rien.'], 'inconnu');
    return;
  }
  await d.say([
    'Bzz… Vous me voyez ? Je suis la dernière luciole allumée.',
    'Quand Gomme est passée, toutes les lanternes se sont éteintes. Mes amies ont oublié comment briller.',
    'Sans les lanternes, personne ne trouve le chemin de l\'atelier.',
  ], 'inconnu');
  await d.say('On les allumait en chantant. Rouge d\'abord… et après… bzz… J\'ai oublié la suite.', 'inconnu');
};

export const darkBarrier: Script = async (d) => {
  await d.say(['Des crayons serrés comme des barreaux barrent le chemin. Derrière, il fait tout noir.', 'Quelque part au fond, on entend : frrrt… frrrt…']);
  if (withMina()) await d.say('On a besoin de lumière. Les lanternes, peut-être ?', 'mina:neutral');
};

// ---------------------------------------------------------------------------
// Sentier gommé
// ---------------------------------------------------------------------------

export const minaOubli: Script = async (d) => {
  if (!withMina()) return;
  await d.wait(20);
  await d.say('Noa…', 'mina:neutral');
  await d.wait(40);
  await d.say('C\'est grave, si on oublie des choses ?', 'mina:sad');
  const r = await d.ask('…', ['« Non, c\'est pas grave. »', '« … »'], 'noa:sad');
  if (r === 0) {
    d.set('c2_oubli_rassure');
    await d.say('Ah. Tant mieux.', 'mina:neutral');
    await d.say([
      'Parce que j\'oublie plein de trucs, en ce moment.',
      'Le nom de ma maîtresse. La couleur de ma chambre. Le goût des bonbons à la fraise.',
    ], 'mina:sad');
    await d.say('Mais toi, je t\'oublie pas. Ça, jamais. Promis juré, craché.', 'mina:happy');
  } else {
    d.set('c2_oubli_silence');
    await d.say('…Tu sais pas, toi non plus, hein.', 'mina:sad');
    await d.say([
      'C\'est pas grave. On a qu\'à se souvenir à deux.',
      'Toi, tu gardes une moitié. Moi, je garde l\'autre. Comme ça, rien ne se perd.',
    ], 'mina:happy');
  }
};

export const crumbs: Script = async (d) => {
  await d.say('Des miettes de gomme, roses. Il y en a de plus en plus.');
};

export const sentierDrawing: Script = async (d) => {
  await d.say(['Un dessin gommé. Il reste un bout de couronne en papier. Et un bout de cape rouge.']);
  if (withMina()) await d.say('…C\'est moi, ça ?', 'mina:surprised');
};

// ---------------------------------------------------------------------------
// Atelier de Gomme — boss
// ---------------------------------------------------------------------------

const ERASED = '______';
const GOMME_TALK = [
  'Ce qui est effacé ne fait plus mal.',
  'Frrrt ! Encore un trait de trop.',
  'Pourquoi tu dessines encore ?',
  'Je rends tout blanc. Tout propre. Tout calme.',
  'Je m\'use, moi aussi, tu sais.',
];

/** Six notebook words; Gomme rubs some of them out ("______") as the fight goes on. */
function gommeWords(b: Battle, cache: { turn: number; words: WordDef[] | null }): WordDef[] {
  if (cache.turn === b.turn && cache.words) return cache.words;
  const e = b.enemies[0]!;
  const pool = WORD_POOLS[2] ?? [];
  const pick = (emo: WordDef['emotion'], n: number): WordDef[] => rng.shuffle(pool.filter((w) => w.emotion === emo)).slice(0, n);
  const special = e.def.specialWords ?? [];
  const late = e.step >= 1 && !e.spareable;
  const words: WordDef[] = late
    ? [...special, ...pick('tristesse', 1), ...pick('joie', 1), ...pick('colere', 1), ...pick('neutre', 1)]
    : [...pick('tristesse', 2), ...rng.shuffle([...special]).slice(0, 1), ...pick('joie', 1), ...pick('colere', 1), ...pick('neutre', 1)];
  const erased = new Set<WordDef>();
  if (!e.spareable && b.turn >= 2) {
    let n = Math.min(3, 1 + Math.floor((b.turn - 2) / 2));
    if (late) {
      // She always tries to rub out one of the two words that would stop her. Never both.
      erased.add(special[b.turn % 2] ?? special[0]!);
      n--;
    }
    const keep = late ? new Set(special) : new Set([words[0]!]);
    const candidates = rng.shuffle(words.filter((w) => !keep.has(w) && !erased.has(w)));
    for (const w of candidates.slice(0, Math.max(0, n))) erased.add(w);
  }
  const out = rng.shuffle(words.map((w) => (erased.has(w) ? { text: ERASED, emotion: 'neutre' as const } : w)));
  cache.turn = b.turn;
  cache.words = out;
  return out;
}

function gommeHooks(): Partial<BattleHooks> {
  const cache: { turn: number; words: WordDef[] | null } = { turn: -1, words: null };
  const told = { erase: false, hint: false, step: false, hurt: false, calm: false };
  let crumbT = 0;
  return {
    beforeTurn: async (b, turn) => {
      const e = b.enemies[0];
      if (!e) return;
      if (turn === 1) {
        b.overlay = (g) => {
          crumbT++;
          if (e.spareable || e.dead) return;
          g.fillStyle = '#f8b6cf';
          for (let i = 0; i < 14; i++) {
            const x = Math.round((i * 47 + crumbT * (0.3 + (i % 3) * 0.1)) % 320);
            const y = Math.round((i * 29 + crumbT * (0.5 + (i % 4) * 0.15)) % 84);
            g.fillRect(x, y, i % 3 === 0 ? 2 : 1, 1);
          }
        };
        await director.say('Noa, attention ! Tout ce qu\'elle touche devient blanc !', 'mina:surprised');
        return;
      }
      if (turn === 2 && !told.erase) {
        told.erase = true;
        director.sfx('erase');
        await b.say('* Gomme frotte les pages de ton carnet. Frrrt !\n* Des mots disparaissent.');
        await director.say('Tes mots ! Elle efface tes mots !', 'mina:angry');
        return;
      }
      if (e.spareable) {
        if (!told.calm) {
          told.calm = true;
          await director.say('Elle a arrêté de frotter… Noa, tu peux l\'épargner, maintenant.', 'mina:neutral');
        }
        return;
      }
      if (e.step >= 1 && !told.step) {
        told.step = true;
        await b.bubble([{ e, text: 'Arrête… Pourquoi tu me rends triste ?' }]);
        await b.bubble([{ e, text: 'Je peux l\'effacer, ça aussi. Frrrt, et c\'est fini.' }]);
        await director.say(['Non ! On veut pas tout effacer !', 'Il y a des choses qu\'il faut… qu\'il faut…'], 'mina:sad');
        await director.say('…garder. Même si ça pique.', 'mina:sad');
        return;
      }
      if (e.hp < e.maxHp * 0.5 && !told.hurt) {
        told.hurt = true;
        await director.say(['Noa… tu lui fais mal.', 'Regarde, elle s\'use. Elle devient toute petite.'], 'mina:sad');
        return;
      }
      if (turn >= 3 && e.step === 0 && e.stepProgress === 0 && !told.hint) {
        told.hint = true;
        await director.say(['Elle crie fort… mais regarde ses yeux.', 'On dirait qu\'elle a de la peine, en vrai. Comme toi, des fois.'], 'mina:neutral');
      }
    },
    words: (b) => gommeWords(b, cache),
    pattern: (b, turn) => {
      if (b.enemies[0]?.spareable) return 'calm';
      if (turn <= 1) return 'eraser_sweep';
      return turn % 2 === 0 ? 'eraser_shrink' : 'eraser_sweep';
    },
    talk: (b, turn) => {
      const e = b.enemies[0];
      if (e?.spareable) return '…';
      return GOMME_TALK[turn - 1] ?? null;
    },
    onWord: async (b, e, w) => {
      if (w.text === ERASED) {
        await b.bubble([{ e, text: 'Ce mot-là ? Il n\'existe plus.' }]);
        await b.say('* Tu écris… rien. Le mot a été gommé.\n* Ton cœur se vide un peu.');
        return true;
      }
      const key = w.text === 'garder' || w.text === 'souvenir';
      if (!key) return false;
      if (w.text === 'souvenir' && e.step === 1) {
        // « souvenir » works as well as « garder » for the last step.
        e.step = 2;
        e.stepProgress = 0;
        e.progress = e.total;
        e.emotion = 'neutre';
      }
      if (e.spareable) {
        await b.bubble([{ e, text: w.text === 'garder' ? 'Garder… ?' : 'Un souvenir… ?' }]);
        await b.bubble([{ e, text: 'Tu veux garder… même ce qui fait mal ?' }]);
        await director.say('…Oui.', 'noa:sad');
        await b.say('* Gomme ne frotte plus. Ses miettes tremblent.\n* {c:y}Gomme est apaisée.{/c} Tu peux l\'épargner.');
        return true;
      }
      await b.bubble([{ e, text: w.text === 'garder' ? 'Garder ? Garder QUOI ? Tout ça fait mal !' : 'Un souvenir, ça pique. Ça pique !' }]);
      await b.say('* Tes mots touchent Gomme. Elle frotte un peu moins fort.');
      return true;
    },
    onDeath: async (b, e) => {
      await b.bubble([{ e, text: 'Enfin… tout… propre…' }]);
      return false;
    },
  };
}

export const gommeBoss: Script = async (d) => {
  if (flag('c2_boss_done')) return;
  d.bars(true);
  const p = tileOf(d.player);
  await d.cameraTo(p.x, p.y - 3);
  d.sfx('erase');
  await d.wait(30);
  d.sfx('erase', { pitch: 0.9 });
  await d.wait(30);
  await d.say(['Frrrt. Frrrt.', 'Une gomme rose, grande comme une armoire, frotte le plancher. Sous elle, un dessin disparaît.']);
  if (withMina()) await d.say('C\'est elle ! C\'est Gomme !', 'mina:surprised');
  await d.say(['Encore des gribouillages qui marchent.', 'Ne bougez pas. Je vais vous rendre tout propres.'], 'gomme');
  if (withMina()) {
    await d.say('Rends-moi mes dessins ! Les fleurs, les lucioles, la forêt… C\'est à moi, tout ça !', 'mina:angry');
    await d.say(['Tes dessins ? Ils faisaient mal.', 'Je les ai effacés pour toi. Tu devrais me dire merci.'], 'gomme');
    await d.say('…Pour moi ?', 'mina:surprised');
    await d.say(['Et pour lui.', 'Surtout pour lui.'], 'gomme');
    await d.wait(20);
    await d.say('Ce qui est effacé ne fait plus mal. Laisse-moi faire, Noa.', 'gomme');
  }
  d.bars(false);
  d.cameraFollow();
  const r = await d.battle(['gomme'], { music: 'boss', bg: 'eraser', hooks: gommeHooks() });
  if (r.outcome === 'lose') return;
  d.set('c2_boss_done');
  if (r.outcome === 'spare') await gommeSpared(d);
  else await gommeErased(d);
  await chapterEnd(d);
};

async function gommeSpared(d: Director): Promise<void> {
  d.set('c2_gomme_spared');
  const g = d.find('gomme_boss');
  if (g) {
    g.frames = undefined;
    g.sprite = 'npc_gomme';
  }
  await d.say(['…D\'accord.', 'On garde.'], 'gomme');
  await d.say(['Même ce qui fait mal.', 'Je crois que… je suis fatiguée d\'effacer.'], 'gomme');
  await d.say(['On efface pour ne plus avoir mal. Ou pour ne plus être coupable.', 'Ce n\'est pas pareil.'], 'gomme');
  await d.say('Je vais tout rendre. Les fleurs, les lucioles, les dessins. Un trait après l\'autre.', 'gomme');
  d.sfx('chime', { pitch: 0.9 });
  d.flash('#fffaf2', 40);
  await d.fadeOut(50, '#fffaf2');
  // Somewhere in the forest, the white holes fill up again.
  d.load('foret', 'flowers', true);
  d.show('player', false);
  d.show('mina', false);
  world.particles.setMode('petals');
  d.music('forest');
  await d.fadeIn(60);
  await d.wait(40);
  await d.say(['Dans la forêt, les trous blancs se remplissent.', 'Un trait. Puis un autre. Puis des couleurs.', 'Là où il n\'y avait plus rien, il y a des fleurs.']);
  if (withMina()) await d.say('Des fleurs ! Je le savais, qu\'il y avait des fleurs !', 'mina:happy');
  await d.fadeOut(40);
  d.load('atelier', 'boss', true);
  d.face('player', 'up');
  world.resetFollower();
  await d.fadeIn(40);
  await d.say(['Il en reste un.', 'Celui-là, je n\'ai jamais réussi à l\'effacer. J\'ai essayé. Souvent.', 'Il fait trop mal. Même à moi.'], 'gomme');
  await d.say('Je crois qu\'il est à toi.', 'gomme');
}

async function gommeErased(d: Director): Promise<void> {
  d.set('c2_gomme_killed');
  d.remove('gomme_boss');
  await d.say(['Là où était Gomme, il ne reste qu\'un petit tas de miettes roses.', 'Autour, tout est blanc. Ça ne reviendra pas.']);
  if (withMina()) await d.say(['…', 'Elle voulait juste que ça fasse moins mal.'], 'mina:sad');
  await d.say(['Au milieu des miettes, une feuille de papier.', 'Le seul dessin qu\'elle n\'avait pas réussi à effacer.']);
}

// ---------------------------------------------------------------------------
// Souvenir 2 — the unfinished drawing. Dodo's first crack.
// ---------------------------------------------------------------------------

async function chapterEnd(d: Director): Promise<void> {
  d.music(null, 2);
  d.ambience('none');
  await d.wait(40);
  if (withMina()) await d.say('C\'est quoi ? Montre !', 'mina:surprised');
  d.souvenir('dessin');
  await d.image('souvenir_dessin', SOUVENIRS.dessin?.captions ?? []);
  if (!withMina()) {
    await d.say(['Tu regardes le dessin longtemps.', 'Quelqu\'un aurait dû le finir.']);
    await dodoHush(d);
    return;
  }
  await d.say(['C\'est… c\'est mon dessin.', 'C\'est toi et moi. Sous la grande lune.'], 'mina:surprised');
  await d.say(['T\'as vu ? T\'as les cheveux tout bleus.', 'Et moi, j\'ai ma couronne.'], 'mina:happy');
  await d.say('Mais il est pas fini. De mon côté, il y a pas de couleurs.', 'mina:sad');
  await d.wait(30);
  await d.say('Je l\'ai pas fini… parce que…', 'mina:sad');
  await d.wait(40);
  await d.say('…parce que', 'mina:sad', { auto: 40 });
  // It breaks.
  fx.glitch = 0.55;
  d.glitch(60);
  d.shake(4, 90);
  const m = d.find('mina');
  if (m) {
    m.char = undefined;
    m.sprite = 'pose_mina_glitch';
  }
  await d.say('{glitch}PARCE QUE{/glitch}', 'mina:glitch', { auto: 50 });
  d.shake(6, 70);
  fx.glitch = 0.8;
  await d.say('{glitch}PARCE QUE PARCE QUE PARCE QUE PARCE{/glitch}', 'mina:glitch', { auto: 25 });
  await dodoHush(d);
}

async function dodoHush(d: Director): Promise<void> {
  const p = tileOf(d.player);
  fx.glitch = 0;
  d.shake(0, 1);
  d.spawn(dodoDef(p.x - 1, p.y - 1));
  const m = d.find('mina');
  if (m && m.sprite === 'pose_mina_glitch') {
    m.sprite = undefined;
    m.char = 'mina';
    m.moving = false;
  }
  await d.say('Ch{static}—{/static}t.', 'dododark');
  await d.wait(50);
  await d.say('On ne parle pas de ça ici.', 'dododark');
  await d.wait(160);
  if (withMina()) {
    await d.say('Mina ne bouge plus. Elle regarde le dessin sans le voir.');
    await d.wait(40);
  }
  d.face('dodo', 'down');
  await d.say(['…', 'Il est tard.', 'Réveille-toi, Noa.'], 'dodo:neutral');
  await wakeUp(d, 2);
}

// ---------------------------------------------------------------------------
// Atelier objects
// ---------------------------------------------------------------------------

export const atelierDesk: Script = async (d) => {
  if (flag('c2_gomme_spared')) {
    await d.say(['Le grand bureau à dessin. Des feuilles s\'y empilent de nouveau, couvertes de couleurs.']);
    return;
  }
  await d.say(['Le grand bureau à dessin de Gomme.', 'Il est parfaitement propre. Pas une trace. Pas une miette. Rien.']);
};

/** Gomme's jar of crumbs (§ 3.6): « Certaines ont une bouche. » The double: like seeing faces in clouds. */
export const crumbJar: Script = async (d) => {
  if (flag('c2_gomme_spared')) {
    await d.say(['Le bocal est ouvert. Les miettes sont reparties dessiner.', 'Il en reste une, tout au fond. Elle dort.']);
    return;
  }
  d.set('c2_bocal');
  await d.say(['Un bocal plein de miettes de gomme, roses. Sur l\'étiquette : « À JETER ».', 'Tu regardes de plus près.']);
  await d.wait(20);
  await d.say('Certaines ont une bouche.');
  if (withMina()) await d.say(['Elles font « o » ! Comme les nuages qui ressemblent à des trucs.', '…Non. Elles bâillent. C\'est l\'heure de dormir, pour les miettes.'], 'mina:happy');
};

export const atelierEasel: Script = async (d) => {
  if (flag('c2_gomme_spared')) {
    await d.say('Un chevalet. Le dessin est revenu : une maison, avec une porte, cette fois.');
    return;
  }
  await d.say(['Un chevalet. La feuille est blanche.', 'Pas neuve : gommée. On sent encore sous le doigt les creux laissés par le crayon.']);
};

// ---------------------------------------------------------------------------
// Mina's lines and debug
// ---------------------------------------------------------------------------

/** Mina's lines when you talk to her, by map id ("texte|expression"). */
export const MINA_LINES: Record<string, string[]> = {
  lisiere: [
    'Ma souche, c\'est mon trône. Il est un peu dur, mais c\'est un trône.|happy',
    'Chaussette a fait tout le chemin jusqu\'ici ! Avec son étal sur le dos !|happy',
    'Derrière nous, c\'est le Pays de Coton. Devant, c\'est la forêt. On dirait un dessin.|neutral',
  ],
  foret: [
    'Les arbres, c\'est des crayons ! Si on en cassait un, on pourrait dessiner le ciel.|happy',
    'Les trous blancs… Marche pas dedans. Ça me fait bizarre dans le ventre.|sad',
    'Qui c\'est qui parle, quand c\'est écrit en blanc ? …Le livre, je parie.|neutral',
    'Je connais cette forêt par cœur. Enfin… je la connaissais.|neutral',
    'Tu crois qu\'on peut se perdre dans un dessin ?|neutral',
  ],
  clairiere: [
    'Avant, les lucioles chantaient, ici. Je m\'en souviens. Je crois.|neutral',
    'Reste près de moi. Enfin, je veux dire : je reste près de toi. Pour te protéger.|sad',
    'Rouge, jaune… Quand je ferme les yeux, je vois encore les couleurs.|happy',
  ],
  bibliotheque: [
    'Chut ! Dans une bibliothèque, on parle TOUT BAS !|angry',
    'Le Hibou sent le vieux papier. C\'est une bonne odeur.|happy',
    'Des livres que personne ne lit… Ça doit être triste, d\'être un livre comme ça.|sad',
  ],
  sentier_gomme: [
    'Il fait de plus en plus blanc. Comme quand on ferme les yeux trop fort.|sad',
    'Tu me tiens la main ? … Non, c\'est pour toi. Au cas où t\'aurais peur.|neutral',
  ],
  atelier: [
    'C\'est ici qu\'elle habite. Ça sent le caoutchouc.|neutral',
    'Tous ces dessins effacés… C\'était peut-être les miens.|sad',
  ],
};

/** Debug helper: chapter 2 state with Mina in the party, then loads `map` at `spawn`. */
const setup = (d: Director, flags: string[], map: string, spawn: string): void => {
  G.state.chapter = 2;
  for (const f of ['c2_intro', ...flags]) d.set(f);
  d.follower('mina');
  d.load(map, spawn);
  world.resetFollower();
};

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {
  c2_start: start,
  c2_foret: async (d) => {
    setup(d, [], 'foret', 'west');
    await d.fadeIn(10);
  },
  c2_freeze: async (d) => {
    setup(d, ['c2_flowers'], 'foret', 'north');
    // Walking up the north path, Mina behind, as when the trigger fires in play.
    d.player.x = 40 * 16 + 8;
    d.player.y = 8 * 16 + 14;
    d.face('player', 'up');
    world.resetFollower();
    await d.fadeIn(10);
    await d.walk('player', 0, -3);
    await minaFreeze(d);
  },
  c2_bibliotheque: async (d) => {
    setup(d, ['c2_flowers'], 'bibliotheque', 'entry');
    await d.fadeIn(10);
  },
  c2_clairiere: async (d) => {
    setup(d, ['c2_flowers', 'c2_freeze', 'c2_hibou_met'], 'clairiere', 'south');
    await d.fadeIn(10);
  },
  c2_lanterns: async (d) => {
    setup(d, ['c2_flowers', 'c2_freeze', 'c2_hibou_met'], 'clairiere', 'south');
    // Next to the blue lantern, the last one of the rhyme (Mina beside Noa, in its light).
    d.player.x = 10 * 16 + 8;
    d.player.y = 9 * 16 + 14;
    d.face('player', 'left');
    world.resetFollower();
    await d.fadeIn(10);
    // One wrong try, then the order of the nursery rhyme.
    for (const c of ['r', 'g', 'r', 'y', 'g', 'b'] as LanternColor[]) await lantern(c)(d);
  },
  c2_sentier: async (d) => {
    G.state.armor = 'plaid';
    setup(d, ['c2_flowers', 'c2_freeze', 'c2_lanterns_ok'], 'sentier_gomme', 'south');
    await d.fadeIn(10);
  },
  c2_boss: async (d) => {
    G.state.armor = 'plaid';
    setup(d, ['c2_flowers', 'c2_freeze', 'c2_hibou_met', 'c2_lanterns_ok', 'c2_oubli'], 'atelier', 'south');
    await d.fadeIn(10);
  },
  c2_end: async (d) => {
    setup(d, ['c2_flowers', 'c2_freeze', 'c2_lanterns_ok', 'c2_oubli'], 'atelier', 'boss');
    d.set('c2_boss_done');
    await d.fadeIn(10);
    await gommeSpared(d);
    await chapterEnd(d);
  },
  // --- Version 2 clues (docs/INDICES.md): each one starts with Mina, next to the place.
  /** The erased hole that whispers numbers (east of the sharpener). */
  c2_chuchote: async (d) => {
    await clueAt(d, 'foret', 37, 21);
    d.face('player', 'right');
  },
  /** The erased hole with the tiny figure seen from behind (south-west). */
  c2_figure: async (d) => {
    await clueAt(d, 'foret', 11, 25);
    d.face('player', 'down');
  },
  /** The giant sharpener and the red pencil tree beside it. */
  c2_taille: async (d) => {
    await clueAt(d, 'foret', 34, 17);
    d.face('player', 'up');
  },
  /** Mina with button eyes, held still (the frame is only a few ticks long in the freeze). */
  c2_boutons: async (d) => {
    await clueAt(d, 'foret', 40, 6);
    const m = d.find('mina');
    if (m) {
      m.char = undefined;
      m.sprite = 'pose_mina_boutons';
    }
  },
  /** Gomme's workshop, before the fight, next to the jar of crumbs. */
  c2_bocal: async (d) => {
    await clueAt(d, 'atelier', 5, 7);
    d.face('player', 'up');
  },
  c2_end_erased: async (d) => {
    setup(d, ['c2_flowers', 'c2_freeze', 'c2_lanterns_ok', 'c2_oubli'], 'atelier', 'boss');
    d.set('c2_boss_done');
    await d.fadeIn(10);
    await gommeErased(d);
    await chapterEnd(d);
  },
};

/** Debug: chapter 2 with Mina, on `map` at tile (x, y) (the intro and the forest's first scenes already seen). */
async function clueAt(d: Director, map: string, x: number, y: number): Promise<void> {
  setup(d, ['c2_flowers', 'c2_freeze'], map, 'default');
  d.player.x = x * 16 + 8;
  d.player.y = y * 16 + 14;
  world.resetFollower();
  await d.fadeIn(10);
}

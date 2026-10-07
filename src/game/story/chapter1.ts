import type { BattleHooks } from '../battle/types';
import { director, type Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { input } from '../../engine/input';
import { SOUVENIRS } from '../../data/illustrations';
import { SheepCountScene } from '../scenes/sheepcount';
import { shop, wakeUp } from './common';

/**
 * Chapter 1 — « Le Pays de Coton ».
 * prairie (arrival, tutorial, Mina) → village (Madame Lune, Chaussette, the lamb's balloon) → colline (the closet).
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const withMina = (): boolean => G.state.party.includes('mina');
/** Talk counter stored in a flag: returns how many times this was seen before, then increments it. */
function bump(k: string): number {
  const n = Number(G.state.flags[k] ?? 0);
  G.state.flags[k] = n + 1;
  return n;
}

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

export async function start(d: Director): Promise<void> {
  await d.chapter('Chapitre 1', 'Le Pays de Coton', 'Il ne pleut que du coton.');
  d.load('prairie', 'bed');
  const bed = d.find('dream_bed');
  d.show('player', false);
  if (bed) bed.sprite = 'prop_bed_dream';
  d.music('meadow');
  await d.fadeIn(90);
  await d.wait(40);
  await d.say(['Quelque chose de doux tombe sur ton visage.', 'Du coton. Il neige du coton.']);
  d.show('player', true);
  d.face('player', 'down');
  d.sfx('pop');
  await d.wait(20);
  d.spawn({ id: 'dodo', sprite: 'npc_dodo', frames: ['npc_dodo', 'npc_dodo_2'], frameSpeed: 28, x: 8, y: 11, float: true, shadow: false, solid: false });
  await d.emote('dodo', '♥');
  await d.say(['Bienvenue au Pays de Coton, Noa !', 'Ici, il ne pleut que du coton. Il ne fait jamais froid. Et personne n\'est jamais triste.'], 'dodo:happy');
  await d.say('…', 'noa:tired');
  await d.say(['Tu verras. Tu vas te sentir mieux.', 'Oh ! Attention, quelque chose arrive.'], 'dodo:neutral');
  await tutorial(d);
}

// ---------------------------------------------------------------------------
// Tutorial battle (Gribouille), guided by Dodo
// ---------------------------------------------------------------------------

function tutorialHooks(): Partial<BattleHooks> {
  let toldSpare = false;
  return {
    beforeTurn: async (b, turn) => {
      const e = b.enemies[0];
      if (turn === 1) {
        await director.say(['Ça, c\'est un Gribouille. N\'aie pas peur, il est tout petit.', 'Le petit cœur, en bas, c\'est le tien.'], 'dodo:happy');
        await director.say([
          'Tu peux le {c:o}FRAPPER{/c}… mais tu peux aussi lui {c:y}ÉCRIRE{/c} quelque chose.',
          'Ici, les mots ont du pouvoir. Dans le carnet, « Observer » t\'aide à deviner ce dont il a besoin.',
        ], 'dodo:neutral');
      } else if (turn === 2) {
        await director.say([
          'Tu as vu ? Quand tu écris un mot, {c:y}ton cœur change de couleur{/c}.',
          '{c:y}Jaune{/c} pour la JOIE, {c:b}bleu{/c} pour la TRISTESSE, {c:r}rouge{/c} pour la COLÈRE.',
          'Et le secret : les attaques {c:y}de la même couleur que ton cœur{/c} passent à travers toi !',
          'Seules les blanches font toujours mal. Malin, non ?',
        ], 'dodo:happy');
      }
      if (e?.spareable && !toldSpare) {
        toldSpare = true;
        await director.say(['Regarde ! Son nom est devenu {c:y}jaune{/c}.', 'Il est apaisé. Tu peux l\'{c:y}ÉPARGNER{/c}.'], 'dodo:happy');
      } else if (turn === 3 && e && !e.spareable) {
        await director.say('Il a l\'air de s\'ennuyer… Un mot joyeux, peut-être ?', 'dodo:neutral');
      }
    },
  };
}

async function tutorial(d: Director): Promise<void> {
  d.spawn({ id: 'gribouille', sprite: 'ow_gribouille', frames: ['ow_gribouille', 'ow_gribouille_2'], frameSpeed: 14, x: 11, y: 12, solid: false });
  await d.walkTo('gribouille', 9, 12, 0.6);
  await d.emote('gribouille', '!');
  d.remove('gribouille');
  const r = await d.battle(['gribouille'], { tutorial: true, music: 'battle', hooks: tutorialHooks() });
  if (r.outcome === 'spare') {
    await d.say(['Tu vois ? Ici, pas besoin de faire du mal.', 'Il suffit de trouver les bons mots.'], 'dodo:happy');
  } else if (r.outcome === 'win') {
    await d.say(['Oh…', 'Tu l\'as effacé.', '…Ce n\'est pas grave. Ce n\'était qu\'un gribouillis.'], 'dodo:neutral');
  } else {
    await d.say('Bon. On réessaiera plus tard.', 'dodo:neutral');
  }
  await d.say([
    'Quand tu verras une petite lumière comme celle-là, touche-la.',
    'Ça garde le rêve au chaud. Comme ça, tu pourras toujours revenir.',
  ], 'dodo:happy');
  await d.say(['Va vers l\'est. Quelqu\'un t\'attend.', 'Moi, je ne serai jamais très loin. Il suffit de penser à moi.'], 'dodo:happy');
  d.sfx('chime');
  d.remove('dodo');
  d.set('c1_tutorial');
}

// ---------------------------------------------------------------------------
// Meeting Mina
// ---------------------------------------------------------------------------

export const meetMina: Script = async (d) => {
  if (flag('c1_mina')) return;
  d.set('c1_mina');
  const p = d.player;
  const tx = Math.floor(p.x / 16);
  const ty = Math.floor((p.y - 2) / 16);
  d.sfx('bark', { pitch: 1.6 });
  await d.say('{shake}HALTE, MONSTRE !{/shake}', 'inconnu');
  d.spawn({ id: 'mina', char: 'mina', x: tx + 4, y: ty, dir: 'left' });
  await d.walkTo('mina', tx + 1, ty, 1.6);
  d.face('mina', 'left');
  d.face('player', 'right');
  await d.say(['Je suis la Princesse-Chevalière du Pays de Coton !', 'Et je t\'ordonne de… de…'], 'mina:angry');
  await d.emote('mina', '!');
  await d.say('… Oh. C\'est toi, Noa !', 'mina:surprised');
  await d.wait(30);
  await d.say('…Mina ?', 'noa:surprised');
  await d.say(['Ben oui ! Qui d\'autre ?', 'Tu en as mis, du temps ! Je t\'attends depuis super longtemps.'], 'mina:happy');
  await d.say('…', 'noa:sad');
  await d.say(['Pourquoi tu fais cette tête ?', 'On dirait que t\'as vu un fantôme.'], 'mina:neutral');
  await d.wait(20);
  await d.say([
    'Bon. Tu tombes bien, j\'ai une mission super importante.',
    'Cette nuit, une {c:y}étoile filante{/c} est tombée sur la Colline aux Couvertures !',
    'Si on la trouve, on peut faire un vœu. N\'importe quel vœu !',
  ], 'mina:happy');
  await d.say(['La colline est derrière le village. Allez, viens !', 'Je te protège. C\'est moi, la chevalière.'], 'mina:happy');
  d.remove('mina');
  d.follower('mina');
  world.resetFollower();
};

// ---------------------------------------------------------------------------
// Prairie objects
// ---------------------------------------------------------------------------

export const dreamBed: Script = async (d) => {
  await d.say(['Un lit, posé au milieu de la prairie.', 'Les draps sont tièdes. Ils sentent la lessive de Maman.']);
  if (withMina() && !bump('c1_bed_mina')) {
    await d.say(['C\'est ton lit ? Il ressemble à celui de la maison !', 'Sauf qu\'il grince pas. Et qu\'il y a pas tes chaussettes sales dessous.'], 'mina:happy');
  }
};

export const smileyRock: Script = async (d) => {
  await d.say('Un rocher. Quelqu\'un a dessiné un smiley dessus.');
  if (!withMina()) return;
  if (bump('c1_smiley') === 0) {
    await d.say(['C\'est moi qui l\'ai dessiné ! Il te ressemble.', '…Enfin. Avant. Quand tu souriais.'], 'mina:neutral');
    await d.say('…', 'noa:sad');
    await d.say('Bon ! Je t\'en dessinerai un nouveau. Avec des dents.', 'mina:happy');
  } else await d.say('Il sourit toujours, lui. Il a de la chance.', 'mina:neutral');
};

export const bootsBush: Script = async (d) => {
  await d.say('Un buisson. Il y a des traces de petites bottes autour.');
  if (withMina()) await d.say(['C\'est là que je me cachais pour te sauter dessus !', 'Tu as eu peur, hein ? Avoue.'], 'mina:happy');
};

/** Secret: Mina's treasure box, hidden at the bottom of the prairie. */
export const minaTreasure: Script = async (d) => {
  if (flag('c1_tresor')) {
    await d.say('Le trésor de Mina. Trois billes, un bouton doré et une plume. On ne touche pas au reste.');
    return;
  }
  await d.say([
    'Une petite boîte en carton, cachée dans l\'herbe. Dessus, au feutre :',
    '« TRÉSOR DE MINA. PAS TOUCHE. (sauf Noa) »',
    'Dedans : trois billes, un bouton doré, une plume… et un biscuit en forme d\'étoile.',
  ]);
  if (withMina()) {
    await d.emote('mina', '!');
    await d.say(['Hé ! Mon trésor ! Comment tu l\'as trouvé ?!', '…Bon. C\'est marqué « sauf Noa ». Tu peux prendre le biscuit.'], 'mina:surprised');
    await d.say('Mais pas la plume. C\'est une plume magique. Elle écrit toute seule quand on est triste.', 'mina:neutral');
  } else {
    await d.say('« Sauf Noa ». Tu prends le biscuit. Tu laisses le reste : c\'est un trésor.');
  }
  if (await d.give('biscuit')) d.set('c1_tresor');
};

export const balloonTree: Script = async (d) => {
  if (flag('c1_ballon_rendu') || d.has('ballon')) {
    await d.say('Un arbre en barbe à papa. Il n\'y a plus de ballon dans ses branches.');
    return;
  }
  if (!flag('c1_ballon_quest')) {
    await d.say(['Un arbre en barbe à papa.', 'Un ballon rouge est coincé tout en haut, dans le feuillage rose.']);
    return;
  }
  await d.say(['Le ballon rouge de l\'agneau !', 'Tu grimpes. Le tronc est collant et sent le sucre.']);
  if (G.state.party.includes('mina')) await d.say('Vas-y, Noa ! Encore un peu ! T\'es presque un chevalier !', 'mina:happy');
  await d.give('ballon');
  const tree = d.find('balloon_tree');
  if (tree) tree.sprite = 'prop_tree';
};

export const prairieSign: Script = async (d) => {
  await d.say(['« ← Le Lit · Le Village des Moutons → »', 'En dessous, au crayon : « et la colline, c\'est tout en haut !! »']);
};

// ---------------------------------------------------------------------------
// Village
// ---------------------------------------------------------------------------

export const lune: Script = async (d) => {
  const n = Number(G.state.flags.c1_lune ?? 0);
  G.state.flags.c1_lune = n + 1;
  if (n === 0) {
    await d.say(['Mmmh… *bâille*…', 'Tiens. Un petit nouveau, venu par le lit…'], 'lune:neutral');
    await d.say(['Tout le monde finit par se réveiller, mon petit.', '…Ou presque.', 'Zzz…'], 'lune:neutral');
    return;
  }
  if (!d.has('veilleuse_poche')) {
    await d.say(['Encore toi… *bâille*…', 'Tu as les yeux de quelqu\'un qui a peur du noir.'], 'lune:neutral');
    await d.say('Prends ça. Une toute petite lune. Pour ceux qui ont peur du noir… Zzz…', 'lune:neutral');
    await d.give('veilleuse_poche');
    if (G.state.party.includes('mina')) await d.say('Ooooh, c\'est trop joli ! On dirait la veilleuse de… de…', 'mina:neutral');
    if (G.state.party.includes('mina')) await d.say('…Je sais plus. C\'est pas grave !', 'mina:happy');
    return;
  }
  if (flag('c1_sheep_done') && !bump('c1_lune_sheep')) {
    await d.say(['Tu as compté les moutons du Moutonnier… *bâille*…', 'Fais attention, mon petit. À force de compter, certains s\'endorment pour de bon.', 'Zzz…'], 'lune:neutral');
    return;
  }
  const lines = [
    ['Les rêves sont des chambres… *bâille*… dont on oublie la porte.'],
    ['Le mouton qui veille… il veille trop, parfois. Zzz…'],
    ['Quand le soleil se lève… même moi, je vais me coucher. C\'est normal. C\'est bien.'],
  ];
  await d.say(lines[n % lines.length]!, 'lune:neutral');
};

export const agneau: Script = async (d) => {
  if (flag('c1_ballon_rendu')) {
    await d.say('Merci, merci ! Mon ballon ne s\'envolera plus jamais. Je l\'ai attaché à ma laine !', 'agneau');
    return;
  }
  if (d.has('ballon')) {
    await d.say(['Mon ballon !! Tu l\'as retrouvé !', 'Tiens, je te donne mon plus beau crayon. Il est rouge comme mon ballon !'], 'agneau');
    d.take('ballon');
    d.set('c1_ballon_rendu');
    G.state.weapon = 'cire';
    d.sfx('item');
    await d.say('Tu obtiens : {c:y}Crayon de cire{/c}. Tu le gardes à la main. {c:g}(ATQ +3){/c}');
    if (G.state.party.includes('mina')) await d.say('C\'est mon rouge préféré ! Enfin… c\'était. Je crois.', 'mina:neutral');
    return;
  }
  d.set('c1_ballon_quest');
  await d.say(['*snif*… Mon ballon rouge…', 'Le vent l\'a emporté. Il est coincé dans un arbre de la prairie, je l\'ai vu…', 'Je suis trop petit pour grimper. *snif*'], 'agneau');
  if (G.state.party.includes('mina')) await d.say('T\'inquiète, petit mouton. Mon chevalier va te le chercher ! … Hein, Noa ?', 'mina:happy');
};

export const moutonCompteur: Script = async (d) => {
  if (flag('c1_sheep_done')) {
    await d.say([
      'C\'est toi qui as aidé mon grand frère, là-haut ?',
      'Il paraît que tu comptes mieux que tout le monde. Même mieux que moi !',
      'Moi, je m\'arrête toujours à un. {p:20}Un.',
    ], 'mouton');
    return;
  }
  if (bump('c1_compteur') === 0) {
    await d.say(['Un mouton… deux moutons… trois moutons…', 'Oh ! Bonjour. Je compte les moutons pour m\'endormir.', 'Mais je suis un mouton. Alors je me compte moi-même. {p:20}Un.'], 'mouton');
    return;
  }
  await d.say([
    'Mon grand frère, le Moutonnier, compte les vrais moutons, là-haut sur la colline.',
    'Lui, il arrive jusqu\'à cent ! Mais ce soir, il a un problème.',
    'Il s\'endort avant la fin. À chaque fois. C\'est les risques du métier.',
  ], 'mouton');
};

export const moutonPoete: Script = async (d) => {
  const n = bump('c1_poete');
  if (n === 0) {
    await d.say(['Ô laine, ô douce laine,', 'Toi qui… euh… toi qui…', 'Tu as une rime avec « laine » ? … « peine » ?'], 'mouton');
    await d.say('Non, non. Trop triste. Ici, on n\'a pas le droit d\'être triste.', 'mouton');
    return;
  }
  if (n === 1) {
    await d.say(['J\'ai trouvé ! Écoute :', '« Ô laine, ô douce laine, je t\'aime toute la semaine. »', 'C\'est beau, hein ? J\'en ai les sabots qui tremblent.'], 'mouton');
    if (withMina()) {
      await d.say('C\'est nul.', 'mina:neutral');
      await d.wait(20);
      await d.say('…Non, c\'est trop beau en fait. J\'ai rien dit.', 'mina:happy');
    }
    return;
  }
  await d.say(['Je cherche une rime avec « Noa ».', '« Noa… qui ne parle pas » ? Hmm. Ça te va bien, en tout cas.'], 'mouton');
};

export const moutonPeureux: Script = async (d) => {
  if (bump('c1_peureux') === 0) {
    await d.say(['Chut ! Ne fais pas de bruit !', 'Mon ombre me suit depuis ce matin.', '… Elle est encore là ? Ne te retourne pas.'], 'mouton');
    return;
  }
  await d.say(['Elle est toujours là… Elle fait tout comme moi.', 'Quand j\'ai peur, elle a peur. Quand je cours, elle court.'], 'mouton');
  if (withMina()) {
    await d.say(['C\'est juste une ombre ! Une ombre, c\'est de la lumière avec un trou dedans.', 'C\'est Maman qui dit ça.'], 'mina:happy');
    await d.say('…De la lumière avec un trou. Oh. Elle est moins effrayante, dit comme ça.', 'mouton');
  }
};

export const moutonJaune: Script = async (d) => {
  if (!flag('c1_jaune')) {
    d.set('c1_jaune');
    await d.say(['Tu viens d\'où, toi ? Du lit ?', 'Moi aussi ! Tout le monde vient du lit, ici.'], 'mouton');
    return;
  }
  await d.say(['Parfois, des gens arrivent par le lit et ne repartent jamais.', 'C\'est bien, non ? Ils sont heureux pour toujours. Pour toujours toujours.'], 'mouton');
};

export const noticeBoard: Script = async (d) => {
  await d.say(['Le tableau d\'affichage du village.', 'Des dessins y sont punaisés : un mouton, une couronne, un garçon aux cheveux bleus.']);
  if (flag('c1_ballon_rendu')) await d.say('Un nouveau dessin, encore humide : un agneau qui tient un ballon rouge. Il sourit jusqu\'aux oreilles.');
  if (flag('c1_sheep_done')) await d.say('Une affiche : « MERCI AU GRAND COMPTEUR DE MOUTONS. Signé : les moutons (tous). »');
  if (G.state.party.includes('mina') && !bump('c1_board_mina')) await d.say(['C\'est moi qui les ai faits !', '…Enfin, je crois. Je me rappelle plus quand.'], 'mina:neutral');
};

export const well: Script = async (d) => {
  await d.say(['Un puits en pierres de coton.', 'Au fond, quelque chose brille. Une étoile ? Non. Juste ton reflet.']);
  if (withMina() && !bump('c1_well_mina')) {
    await d.say(['Fais un vœu ! … Non, attends.', 'Garde-le pour l\'étoile. Les vœux de puits, ça marche qu\'à moitié.'], 'mina:neutral');
  }
};

export const benchMN: Script = async (d) => {
  await d.say('Un banc en bois. Il porte des initiales gravées : « M + N ».');
  if (!withMina()) return;
  if (bump('c1_bench_mn') === 0) {
    await d.say(['M + N… Mina et Noa ! C\'est nous !', 'C\'est moi qui l\'ai gravé ? Je m\'en souviens pas…'], 'mina:surprised');
    await d.say('Bah. Ça doit être moi. Personne d\'autre n\'écrit aussi bien.', 'mina:happy');
  } else await d.say('Un jour, j\'écrirai « M + N » sur la lune. Comme ça, tout le monde le verra.', 'mina:happy');
};

export const blackSheepHouse: Script = async (d) => {
  await d.say(['Une chaumière.', 'Sur la porte : « Ici vit le Mouton Noir. ON NE FRAPPE PAS. »']);
  if (flag('c1_knock')) return;
  const r = await d.ask('Frapper quand même ?', ['Frapper', 'Laisser tranquille'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('c1_knock');
  d.sfx('knock');
  await d.wait(40);
  await d.say(['Une voix grogne derrière la porte :', '« J\'AI DIT : ON NE FRAPPE PAS. »']);
  await d.wait(30);
  await d.say('Puis, plus bas : « …Bonne nuit quand même. »');
  if (withMina()) await d.say('Tu vois ? Il est grognon, mais il est gentil.', 'mina:happy');
};

export const stall: Script = async (d) => {
  if (flag('c1_stall')) {
    await d.say('L\'étal de bonbons. « Revenez demain ! » dit la pancarte.');
    return;
  }
  d.set('c1_stall');
  await d.say(['Un étal de bonbons. Une pancarte, écrite d\'une écriture ronde et maladroite :', '« GRATUIT POUR LES PRINSESSES-CHEVALIÈRES ET LEURS GRANDS FRÈRES »']);
  await d.give('bonbon');
  await d.give('bonbon', true);
  if (G.state.party.includes('mina')) await d.say('Ben quoi ? C\'est la règle !', 'mina:happy');
};

export const sleepyHouse: Script = async (d) => {
  await d.say(['La porte est fermée. Une pancarte :', '« Sieste en cours. Revenir dans cent ans. »']);
};

export const memeLaine: Script = async (d) => {
  await d.say(['Oh, un petit visiteur ! Tu as l\'air épuisé, mon agneau.', 'Tu veux faire une petite sieste ? Mon lit est tout chaud.'], 'meme');
  const r = await d.ask('Faire une sieste ?', ['Oui', 'Non merci'], 'meme', { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Comme tu veux. Mais ne veille pas trop tard, hein.', 'meme');
    return;
  }
  await d.fadeOut(40);
  d.heal();
  await d.wait(40);
  await d.fadeIn(40);
  await d.say(['Tu as dormi dans un rêve.', 'C\'est bizarre, mais tu te sens reposé. {c:l}PV au maximum.{/c}']);
};

export const houseShelf: Script = async (d) => {
  await d.say(['Des livres de Mémé Laine :', '« Tricoter les nuages », « 1001 façons de compter jusqu\'à un », « Dormir : le guide complet (tome 12) ».']);
};

// ---------------------------------------------------------------------------
// Chaussette (shop) and the lost sock
// ---------------------------------------------------------------------------

export const chaussetteShop: Script = async (d) => {
  if (flag('c1_chaussette_paire') && !flag('c1_chaussette_merci')) {
    d.set('c1_chaussette_merci');
    await d.say(['TOI ! C\'est toi qui as retrouvé ma paire !', 'On ne s\'était pas vues depuis la grande lessive de l\'an dernier !'], 'chaussette:happy');
    await d.say('Tiens, prends ça. C\'est la maison qui offre !', 'chaussette:happy');
    await d.give('gateau');
  }
  const paire = flag('c1_chaussette_paire');
  await shop(
    ['bonbon', 'lait', 'biscuit', 'mouchoir', 'bulles', 'pluie', 'orage', 'pomme'],
    paire ? 'Bienvenue, bienvenue ! On est deux maintenant, alors les prix sont deux fois plus doux !' : 'Bienvenue chez Chaussette ! Tout est cousu main. Enfin… pied.',
    undefined,
    paire ? 0.5 : 0,
  );
};

export const chaussetteTalk: Script = async (d) => {
  if (flag('c1_chaussette_paire')) {
    await d.say(['Ma paire et moi, on ne se quitte plus.', 'Même dans la machine à laver !'], 'chaussette:happy');
    return;
  }
  await d.say(['Ah, mon chou… Tu n\'aurais pas vu une chaussette bleue à pois ?', 'C\'est ma paire. Elle est partie se promener, et elle n\'est jamais revenue.'], 'chaussette:neutral');
  await d.say('On dit qu\'elle traîne vers le chemin de la colline, toute triste…', 'chaussette:neutral');
};

export const lostSock: Script = async (d) => {
  await d.say(['Une chaussette bleue à pois, assise au bord du chemin.', 'Elle renifle.']);
  const r = await d.battle(['chaussette_perdue']);
  if (r.outcome === 'flee' || r.outcome === 'lose') return;
  d.set('c1_sock_done');
  d.remove('chaussette_perdue');
  if (r.outcome === 'spare') {
    d.set('c1_chaussette_paire');
    await d.say(['La chaussette sautille vers le village.', 'Elle a une paire à retrouver.']);
    if (G.state.party.includes('mina')) await d.say('Elle va retrouver Chaussette ! Trop bien !', 'mina:happy');
  } else if (G.state.party.includes('mina')) {
    await d.say('…Elle cherchait juste sa paire, Noa.', 'mina:sad');
  }
};

// ---------------------------------------------------------------------------
// Colline aux Couvertures
// ---------------------------------------------------------------------------

export const hillIntro: Script = async (d) => {
  await d.say('La Colline aux Couvertures ! Elle est toute moelleuse !', 'mina:happy');
  await d.say(['Attention, il y a des oreillers partout.', 'Si on se perd, on pourra toujours faire une sieste.'], 'mina:neutral');
};

export const hillFears: Script = async (d) => {
  await d.say(['Tu sais, Noa…', 'Les monstres sous le lit, ceux dans le placard… j\'avais peur d\'eux.'], 'mina:sad');
  await d.say('Avant.', 'mina:neutral');
  await d.say('Maintenant, je suis chevalière. Alors j\'ai plus peur de rien !', 'mina:happy');
};

const pillowItem =
  (id: string, item: string, text: string): Script =>
  async (d) => {
    if (flag(id)) {
      await d.say('Un gros oreiller. Tu as déjà regardé dessous.');
      return;
    }
    await d.say(text);
    // Only mark the pillow as searched once the item is actually taken (pockets may be full).
    if (await d.give(item)) d.set(id);
  };

export const pillowA = pillowItem('c1_pillow_a', 'pomme', 'Un gros oreiller. Dessous, il y a… une pomme d\'amour ?');
export const pillowB = pillowItem('c1_pillow_b', 'chocolat', 'Un gros oreiller tout chaud. Dessous, une tasse de chocolat. Encore chaude.');
export const pillowC = pillowItem('c1_pillow_c', 'mouchoir', 'Sous cet oreiller-là, un mouchoir brodé d\'une lune. Quelqu\'un a pleuré ici.');

// ---------------------------------------------------------------------------
// The Moutonnier and his sheep: the path to the summit
// ---------------------------------------------------------------------------

const NUMBER_WORDS = ['zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix', 'Onze', 'Douze', 'Treize', 'Quatorze', 'Quinze'];

const ROUND_INTRO: string[][] = [
  [
    'Première manche : tout doucement.',
    'Quand un mouton passe {c:y}au-dessus de la barrière{/c}, tu comptes. Pas avant, pas après.',
    'Et si un mouton hésite… attends qu\'il saute pour de vrai.',
  ],
  [
    'Deuxième manche. Attention : voilà le {c:v}mouton noir{/c}.',
    'Lui, on ne le compte {c:r}jamais{/c}. Il déteste ça. Il boude pendant des semaines.',
    'Et parfois, ils sautent à deux. Deux moutons, ça fait deux !',
  ],
  [
    'Dernière manche. La plus difficile.',
    'Moi, je ferme les yeux… *bâille*… Et toi, tu comptes {c:y}dans ta tête{/c}.',
    'Seulement ceux qui sautent pour de vrai. À la fin, tu me diras combien.',
  ],
];

const FAIL_LINES = [
  'Oh là là… je me suis emmêlé les sabots.',
  'Ce n\'est pas grave. Les moutons adorent recommencer. Ils sautent pour le plaisir.',
  'Hmm… On reprend la manche du début ?',
];

function controlsHint(): string {
  const touch = input.lastDevice === 'touch' || ('ontouchstart' in window && input.lastDevice !== 'keyboard');
  return touch
    ? '{c:g}(Touche l\'écran ou A quand un mouton passe au-dessus de la barrière.){/c}'
    : '{c:g}(Espace, Entrée ou Z quand un mouton passe au-dessus de la barrière.){/c}';
}

/** Slides the two pillows that block the summit path out of the way. */
async function pillowsMoveAside(d: Director): Promise<void> {
  const moves: [string, number][] = [
    ['hill_pillow_l', -1],
    ['hill_pillow_r', 1],
  ];
  d.sfx('whoosh');
  for (let i = 0; i < 32; i++) {
    for (const [id, dir] of moves) {
      const e = d.find(id);
      if (!e) continue;
      e.x += dir;
      if (e.rect) e.rect.x += dir;
    }
    await d.wait(i < 8 || i > 24 ? 2 : 1);
  }
  d.sfx('pop', { pitch: 0.7 });
}

/**
 * The counting minigame (scenes/sheepcount.ts): three rounds, free retries, and after two failures
 * « Je n'y arrive pas » lets Noa through anyway. Returns true when the way is open.
 */
async function countSheep(d: Director, replay = false): Promise<boolean> {
  await d.fadeOut(24);
  const scene = SheepCountScene.open();
  await d.fadeIn(24);
  let round = replay ? 1 : Math.min(3, Math.max(1, Number(G.state.flags.c1_sheep_round ?? 1)));
  let fails = replay ? 0 : Number(G.state.flags.c1_sheep_fails ?? 0);
  let attempt = 0;
  let gaveUp = false;
  if (round === 1 && !flag('c1_sheep_tried')) {
    d.set('c1_sheep_tried');
    await d.say(['Voilà mes moutons. Ils vont sauter la barrière, un par un.', 'À chaque mouton qui passe {c:y}au-dessus{/c}, tu comptes avec moi.'], 'mouton');
    await d.say(controlsHint());
  }
  while (round <= 3) {
    scene.announce(round);
    if (attempt === 0) await d.say(ROUND_INTRO[round - 1]!, 'mouton');
    const r = await scene.play(round, attempt + fails);
    let ok = r.ok;
    if (round === 3) {
      const offsets = [
        [-1, 0, 1],
        [0, 1, 2],
        [-2, -1, 0],
      ][(attempt + fails) % 3]!;
      const nums = offsets.map((o) => r.valid + o);
      const i = await d.ask('*ouvre un œil* Alors… ça fait combien ?', nums.map(String), 'mouton');
      ok = nums[i] === r.valid;
      if (ok) await d.say([`${NUMBER_WORDS[r.valid] ?? r.valid} ! C'est exactement ça.`, 'Moi, j\'en avais compté quarante-deux. Mais je dormais un peu.'], 'mouton');
      else await d.say([`Hmm… Moi, en ouvrant un œil, j'en ai vu ${r.valid}.`, 'Ils vont ressauter dans un autre ordre. Ouvre bien les yeux… enfin, toi.'], 'mouton');
    } else if (ok) {
      if (round === 1) await d.say(['Bravo ! Ils sont tous passés.', 'Tu as un don. Ou alors… tu as du mal à dormir, toi aussi ?'], 'mouton');
      else await d.say(r.errors ? 'Ils sont tous passés ! Et le mouton noir boude dans son coin. Parfait.' : 'Pas une seule erreur ! Le mouton noir est vexé. C\'est bon signe.', 'mouton');
    }
    if (ok) {
      round++;
      attempt = 0;
      if (!replay) d.set('c1_sheep_round', Math.min(3, round));
      continue;
    }
    fails++;
    attempt++;
    if (!replay) d.set('c1_sheep_fails', fails);
    if (round < 3) await d.say(FAIL_LINES[(fails - 1) % FAIL_LINES.length]!, 'mouton');
    if (fails === 1 && withMina()) await d.say('Courage, chevalier ! Moi, après dix, je me trompe tout le temps.', 'mina:happy');
    const choices = ['On recommence', 'Plus tard'];
    if (fails >= 2) choices.push('Je n\'y arrive pas');
    const c = await d.ask('On recommence ?', choices, 'mouton', { cancelIndex: 1 });
    if (c === 1) {
      await d.fadeOut(24);
      scene.close();
      await d.fadeIn(24);
      await d.say('D\'accord. Je ne bouge pas d\'ici. Enfin… si je ne m\'endors pas.', 'mouton');
      return false;
    }
    if (c === 2) {
      gaveUp = true;
      break;
    }
  }
  if (gaveUp) {
    await d.say([
      'Ce n\'est pas grave, tu sais.',
      'Moi non plus, je n\'y arrive jamais. Je m\'endors toujours avant la fin.',
      'Mais tu as compté avec moi. Et regarde : ils sont tous couchés quand même.',
    ], 'mouton');
    if (withMina()) await d.say('Tu vois ? T\'as réussi quand même. À ta façon.', 'mina:happy');
  }
  await d.fadeOut(24);
  scene.close();
  await d.fadeIn(24);
  if (replay) {
    await d.say(['Merci… Ça fait du bien, de compter à deux.', 'Zzz…'], 'mouton');
    return true;
  }
  d.set('c1_sheep_done');
  if (gaveUp) d.set('c1_sheep_helped');
  else await d.say(['Tous comptés ! Tous couchés !', 'Merci, petit. Maintenant, je vais enfin pouvoir… *bâille*…'], 'mouton');
  await d.say([
    'C\'est un grand mouton tout doux qui m\'a appris à compter, tu sais.',
    'Il dit qu\'à force de compter, on oublie tout le reste.',
    'C\'est reposant, d\'oublier…',
  ], 'mouton');
  if (withMina()) await d.say('Moi, je veux rien oublier.', 'mina:neutral');
  await d.say('Dans un grand soupir de plumes, les oreillers bâillent… et s\'écartent.');
  await pillowsMoveAside(d);
  await d.say(['Tiens, pour la route. Un lait chaud.', 'C\'est fait pour dormir… mais ça marche aussi pour être courageux.'], 'mouton');
  await d.give('lait');
  if (withMina()) await d.say('Le chemin est ouvert ! L\'étoile, on arrive !', 'mina:happy');
  await d.emote('moutonnier', '…');
  await d.say('Zzz… cent douze… cent treize… Zzz…', 'mouton');
  return true;
}

async function offerHelp(d: Director): Promise<void> {
  const r = await d.ask('Compter les moutons avec lui ?', ['Compter', 'Pas maintenant'], 'mouton', { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('D\'accord. Je ne bouge pas d\'ici. Enfin… si je ne m\'endors pas.', 'mouton');
    return;
  }
  if (withMina() && !bump('c1_sheep_mina')) await d.say('Noa est super fort pour compter ! Il m\'aidait toujours pour mes devoirs.', 'mina:happy');
  await countSheep(d);
}

/** Trigger: the Moutonnier hails Noa when he reaches the pillows. */
export const moutonnierMeet: Script = async (d) => {
  d.face('moutonnier', 'left');
  await d.emote('moutonnier', '!');
  await d.say(['Hé ! Hé, vous deux ! Par ici !', 'Vous voulez monter au sommet ? Ah… Ça va être difficile.'], 'mouton');
  await d.say([
    'Le soir, les oreillers ferment le chemin.',
    'Ils ne se poussent que quand tous les moutons sont {c:y}comptés et couchés{/c}. C\'est la règle.',
    'Les oreillers sont très à cheval sur la règle.',
  ], 'mouton');
  if (withMina()) await d.say('Ben, compte-les, alors !', 'mina:neutral');
  await d.say(['J\'essaie ! Mais au bout de trois ou quatre moutons… *bâille*…', '…je m\'endors. C\'est le problème, quand on compte les moutons.'], 'mouton');
  await d.say('Tu voudrais bien compter avec moi ?', 'mouton');
  await offerHelp(d);
};

export const moutonnier: Script = async (d) => {
  if (flag('c1_sheep_done')) {
    const n = bump('c1_moutonnier_after');
    if (n % 2 === 0) {
      await d.say('Zzz… deux cent… deux cent quoi, déjà… Zzz…', 'mouton');
      return;
    }
    await d.say('*ouvre un œil* Tu veux recompter avec moi ? Juste pour le plaisir ?', 'mouton');
    const r = await d.ask('Recompter les moutons ?', ['Oui', 'Non'], 'mouton', { cancelIndex: 1 });
    if (r === 0) await countSheep(d, true);
    else await d.say('Zzz…', 'mouton');
    return;
  }
  d.set('c1_sheep_meet');
  const round = Number(G.state.flags.c1_sheep_round ?? 1);
  await d.say(round > 1 ? `Tu reviens ! On en était à la manche ${round}. Les moutons t'attendent.` : 'Alors ? Tu es prêt ? Les moutons s\'impatientent.', 'mouton');
  await offerHelp(d);
};

export const penSheep: Script = async (d) => {
  if (flag('c1_sheep_done')) {
    await d.say('Le mouton dort debout, la tête sur la barrière. Il sourit.');
    return;
  }
  await d.say(['Bêê.', '…Je suis prêt à sauter. Il faut juste que quelqu\'un me compte.'], 'mouton');
};

export const penBlackSheep: Script = async (d) => {
  if (flag('c1_sheep_done')) {
    await d.say('Le mouton noir fait semblant de dormir. Il a un œil ouvert.');
    return;
  }
  await d.say(['Le mouton noir te tourne le dos.', 'Il marmonne : « On ne me compte pas. Jamais. Je ne suis pas un mouton comme les autres. »']);
  if (withMina()) await d.say('Il est grognon. Mais je l\'aime bien, moi.', 'mina:happy');
};

export const blockingPillows: Script = async (d) => {
  await d.say(['Deux oreillers géants bouchent le chemin du sommet.', 'Ils ronflent. Ils ne bougeront pas tant que les moutons ne sont pas couchés.']);
  if (withMina()) await d.say('Pousse-toi, l\'oreiller ! … Il veut pas.', 'mina:angry');
};

// ---------------------------------------------------------------------------
// Optional: sitting with Mina on the big pillow, watching the cotton fall
// ---------------------------------------------------------------------------

export const pillowSeat: Script = async (d) => {
  if (!withMina()) {
    await d.say('Un oreiller géant. Il garde la forme d\'une tête toute petite.');
    return;
  }
  if (flag('c1_hill_sit')) {
    await d.say('Un oreiller géant. Il garde la forme de deux têtes, maintenant. Une grande, une petite.');
    return;
  }
  await d.say(['Oh, un oreiller géant ! On s\'assoit deux minutes ?', 'Les chevalières aussi ont le droit de se reposer.'], 'mina:happy');
  const r = await d.ask('S\'asseoir avec Mina ?', ['S\'asseoir', 'Plus tard'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Rabat-joie.', 'mina:neutral');
    return;
  }
  await sitWithMina(d);
};

async function sitWithMina(d: Director): Promise<void> {
  d.set('c1_hill_sit');
  d.bars(true);
  await d.fadeOut(30);
  const p = d.player;
  p.x = 21 * 16 + 8;
  p.y = 10 * 16 + 14;
  d.face('player', 'down');
  const m = d.find('mina');
  if (m) {
    m.x = 22 * 16 + 8;
    m.y = 10 * 16 + 14;
  }
  d.face('mina', 'down');
  await d.fadeIn(40);
  await d.say([
    'Vous vous asseyez au bord de l\'oreiller.',
    'En bas, tout le Pays de Coton : la prairie, le village, les petites lunes des réverbères.',
    'Le coton tombe sans un bruit.',
  ]);
  await d.wait(60);
  await d.say('Tu te souviens, la fois où il a neigé pour de vrai ?', 'mina:neutral');
  await d.say(['On avait fait un bonhomme de neige tout petit, sur le rebord de la fenêtre.', 'Parce qu\'on avait pas le droit de sortir.'], 'mina:happy');
  await d.say('…', 'noa:tired');
  await d.wait(20);
  await d.say('Pourquoi on avait pas le droit, déjà ?', 'mina:neutral');
  const a = await d.ask('…', ['Il faisait trop froid.', '…'], 'noa:sad', { cancelIndex: 1 });
  if (a === 0) {
    await d.say('Il faisait trop froid.', 'noa:sad');
    await d.say('Ah oui. Sûrement.', 'mina:neutral');
    await d.say('Ce n\'était pas le froid. Tu le sais. Tu ne sais plus pourquoi tu le sais.');
  } else {
    await d.say('Bah. C\'est pas grave.', 'mina:neutral');
  }
  await d.wait(30);
  await d.say(['Ici, on a le droit de tout. Même de manger la neige.', 'Aaaah…'], 'mina:happy');
  d.sfx('pop', { pitch: 1.4 });
  await d.say('Ça a le goût de rien ! Trop bien !', 'mina:happy');
  await d.say(['Elle rit. Le coton s\'accroche à ses cheveux.', 'Tu voudrais que ce moment ne finisse jamais.']);
  await d.wait(40);
  await d.say(['Noa ?', 'Si un jour j\'oublie des trucs… tu me les raconteras ?'], 'mina:neutral');
  const b = await d.ask('…', ['Promis.', '…'], 'noa:neutral', { cancelIndex: 1 });
  if (b === 0) {
    d.set('c1_promesse');
    await d.say('Promis.', 'noa:neutral');
    await d.say(['Juré craché ?', '…Non, crache pas. C\'est dégoûtant.'], 'mina:happy');
  } else {
    await d.say('Je prends ça pour un oui. Les chevaliers, ça parle pas beaucoup.', 'mina:happy');
  }
  await d.fadeOut(40);
  d.heal();
  world.resetFollower();
  d.bars(false);
  await d.fadeIn(40);
  await d.say('Tu te sens reposé. {c:l}PV au maximum.{/c}');
}

function placardHooks(): Partial<BattleHooks> {
  let hinted = false;
  let used = false;
  return {
    beforeTurn: async (b, turn) => {
      if (turn === 2) {
        await director.say(['Noa ! Regarde ses yeux…', 'Il tremble. Il a peur, lui aussi !', 'Il a peur du noir… comme moi avant.'], 'mina:surprised');
      }
      if (turn >= 3 && !hinted && !used && G.state.keyItems.includes('veilleuse_poche')) {
        hinted = true;
        await director.say('La petite lune de Madame Lune ! Montre-la-lui, dans {c:y}OBJET{/c} !', 'mina:happy');
      }
      if (turn === 4 && !b.enemies[0]?.spareable) {
        await director.say('Écris-lui des choses joyeuses, Noa ! Des trucs qui font de la lumière !', 'mina:neutral');
      }
    },
    onItem: async (b, item) => {
      if (item !== 'veilleuse_poche') return false;
      const e = b.enemies[0]!;
      used = true;
      await b.say('* Tu tends la Veilleuse de poche vers la fente de l\'armoire.');
      await b.bubble([{ e, text: '…De la… lumière ?' }]);
      await b.bubble([{ e, text: 'Il fait moins noir. Merci…' }]);
      e.forceSpare = true;
      e.emotion = 'neutre';
      b.setEmotion('joie');
      await b.say('* {c:y}Le Monstre du Placard n\'a plus peur.{/c} Tu peux l\'épargner.');
      return true;
    },
  };
}

export const closetBoss: Script = async (d) => {
  if (flag('c1_boss_done')) return;
  await d.say(['Au sommet de la colline, une armoire.', 'Toute seule, au milieu des couvertures.', 'Par la fente de la porte, deux yeux jaunes te regardent.']);
  await d.say('…L\'étoile est là-dedans ? Il fait tout noir…', 'mina:sad');
  d.sfx('knock');
  d.shake(2, 30);
  await d.wait(30);
  await d.say(['QUI… EST… LÀ ?', 'NE M\'OUVREZ PAS. IL FAIT TROP CLAIR. IL FAIT TROP NOIR.'], 'placard');
  await d.say('C\'est… c\'est le Monstre du Placard ! Le vrai !', 'mina:surprised');
  const r = await d.battle(['placard'], { music: 'boss', bg: 'closet', hooks: placardHooks() });
  if (r.outcome === 'lose') return;
  d.set('c1_boss_done');
  if (r.outcome === 'spare') {
    d.set('c1_placard_spared');
    const door = d.find('closet_door');
    if (door) door.sprite = 'npc_placard';
    await d.say(['Merci, petits.', 'Je n\'avais pas peur de vous. J\'avais peur d\'être tout seul, dans le noir.'], 'placard');
    await d.say('Tu vois ? Il est gentil, en vrai !', 'mina:happy');
  } else {
    d.remove('closet_door');
    await d.say('L\'armoire s\'effondre en une flaque d\'encre. Les deux yeux jaunes s\'éteignent.');
    await d.say(['…', 'Il voulait juste de la lumière.'], 'mina:sad');
  }
  await chapterEnd(d);
};

async function chapterEnd(d: Director): Promise<void> {
  await d.wait(30);
  await d.say(['Là où était l\'armoire, quelque chose brille dans les couvertures.', 'Ce n\'est pas une étoile.']);
  await d.say('C\'est quoi ? Montre !', 'mina:surprised');
  d.music(null, 2);
  d.souvenir('fenetre');
  await d.image('souvenir_fenetre', SOUVENIRS.fenetre?.captions ?? []);
  d.sfx('beep');
  await d.wait(20);
  d.sfx('beep');
  d.flash('#ffffff', 30);
  d.shake(3, 30);
  await d.say(['Ta tête te fait mal.', 'Quelque part, très loin, une machine fait {c:g}bip{/c}. {p:30}Bip.']);
  await d.say(['Noa ? Ça va ?', 'Tu fais une drôle de tête…'], 'mina:sad');
  d.spawn({ id: 'dodo', sprite: 'npc_dodo', frames: ['npc_dodo', 'npc_dodo_2'], frameSpeed: 28, x: Math.floor(d.player.x / 16) + 1, y: Math.floor(d.player.y / 16) - 2, float: true, shadow: false, solid: false });
  await d.emote('dodo', '…');
  await d.say(['Chut, chut. Tout va bien.', 'C\'est l\'heure de se réveiller… {p:20}pour l\'instant.'], 'dodo:neutral');
  await d.say('Tu reviens, hein ? Promis ? On a pas fini de chercher l\'étoile !', 'mina:sad');
  await wakeUp(d, 1);
}

// ---------------------------------------------------------------------------
// Mina's lines and debug
// ---------------------------------------------------------------------------

/** Mina's lines when you talk to her, by map id ("texte|expression"). */
export const MINA_LINES: Record<string, string[]> = {
  prairie: [
    'Tu sens ? Ça sent la barbe à papa !|happy',
    'Fais attention aux Nuages Tristes. Ils pleurent sur tout le monde.|neutral',
    'Je suis contente que tu sois là. Vraiment vraiment.|happy',
    'Ici, quand on tombe, ça fait pas mal. Regarde ! … Bon, je tombe pas. Mais ça ferait pas mal.|happy',
  ],
  village: [
    'Les moutons sont trop mignons. Sauf le noir. Il est grognon.|happy',
    'Tu veux un bonbon ? J\'en ai plus. Je les ai tous mangés.|neutral',
    'Madame Lune dort tout le temps. Mais elle sait plein de trucs.|neutral',
    'Le mouton noir, il fait le grognon. Mais je crois qu\'il est juste timide.|neutral',
    'Si j\'habitais ici, je voudrais la maison avec la porte ronde. Et un mouton de compagnie.|happy',
  ],
  boutique: ['Chaussette, c\'est ma copine. Elle cherche sa paire depuis toujours.|neutral', 'Achète des biscuits étoiles ! Ils rendent joyeux.|happy'],
  maison_mouton: ['Mémé Laine tricote des nuages. Je l\'ai vue !|happy'],
  colline: [
    'C\'est haut, hein ? On voit tout le Pays de Coton d\'ici !|happy',
    'Si on trouve l\'étoile, tu feras quel vœu, toi ?|neutral',
    'Moi, mon vœu, c\'est un secret. … Bon, d\'accord : c\'est que tu restes.|happy',
    'Les moutons qui sautent, ça me donne envie de dormir. C\'est bizarre, non ?|neutral',
  ],
};

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {
  c1_start: start,
  c1_tutorial: async (d) => {
    G.state.chapter = 1;
    d.load('prairie', 'bed');
    await d.fadeIn(10);
    await tutorial(d);
  },
  c1_mina: async (d) => {
    G.state.chapter = 1;
    d.set('c1_tutorial');
    d.load('prairie', 'mina');
    await d.fadeIn(10);
    await meetMina(d);
  },
  c1_village: async (d) => {
    G.state.chapter = 1;
    d.set('c1_tutorial');
    d.set('c1_mina');
    d.follower('mina');
    d.load('village', 'west');
    await d.fadeIn(10);
  },
  c1_hill_puzzle: async (d) => {
    G.state.chapter = 1;
    d.set('c1_tutorial');
    d.set('c1_mina');
    d.set('c1_hill');
    d.follower('mina');
    d.load('colline', 'puzzle');
    await d.fadeIn(10);
  },
  c1_sheep: async (d) => {
    G.state.chapter = 1;
    d.set('c1_tutorial');
    d.set('c1_mina');
    d.set('c1_hill');
    d.set('c1_sheep_meet');
    // &round=2 or &round=3 starts later in the minigame.
    const round = Number(new URLSearchParams(location.search).get('round') ?? 1);
    if (round > 1) d.set('c1_sheep_round', Math.min(3, round));
    d.follower('mina');
    d.load('colline', 'sheep');
    await d.fadeIn(10);
    await countSheep(d);
  },
  c1_hill_sit: async (d) => {
    G.state.chapter = 1;
    d.set('c1_tutorial');
    d.set('c1_mina');
    d.set('c1_hill');
    d.set('c1_fears');
    d.follower('mina');
    d.load('colline', 'summit');
    await d.fadeIn(10);
    await sitWithMina(d);
  },
  c1_boss: async (d) => {
    G.state.chapter = 1;
    d.set('c1_tutorial');
    d.set('c1_mina');
    G.state.keyItems.push('veilleuse_poche');
    d.follower('mina');
    d.load('colline', 'summit');
    await d.fadeIn(10);
  },
  c1_end: async (d) => {
    G.state.chapter = 1;
    d.follower('mina');
    d.load('colline', 'summit');
    await d.fadeIn(10);
    await chapterEnd(d);
  },
};

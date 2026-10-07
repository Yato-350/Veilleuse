import type { BattleHooks } from '../battle/types';
import { director, type Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { SOUVENIRS } from '../../data/illustrations';
import { shop, wakeUp } from './common';

/**
 * Chapter 1 — « Le Pays de Coton ».
 * prairie (arrival, tutorial, Mina) → village (Madame Lune, Chaussette, the lamb's balloon) → colline (the closet).
 */

const flag = (k: string): boolean => !!G.state.flags[k];

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
  await d.say(['Un mouton… deux moutons… trois moutons…', 'Oh ! Bonjour. Je compte les moutons pour m\'endormir.', 'Mais je suis un mouton. Alors je me compte moi-même. {p:20}Un.'], 'mouton');
};

export const moutonPoete: Script = async (d) => {
  await d.say(['Ô laine, ô douce laine,', 'Toi qui… euh… toi qui…', 'Tu as une rime avec « laine » ? … « peine » ?'], 'mouton');
  await d.say('Non, non. Trop triste. Ici, on n\'a pas le droit d\'être triste.', 'mouton');
};

export const moutonPeureux: Script = async (d) => {
  await d.say(['Chut ! Ne fais pas de bruit !', 'Mon ombre me suit depuis ce matin.', '… Elle est encore là ? Ne te retourne pas.'], 'mouton');
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
  if (G.state.party.includes('mina')) await d.say(['C\'est moi qui les ai faits !', '…Enfin, je crois. Je me rappelle plus quand.'], 'mina:neutral');
};

export const well: Script = async (d) => {
  await d.say(['Un puits en pierres de coton.', 'Au fond, quelque chose brille. Une étoile ? Non. Juste ton reflet.']);
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
  ],
  village: [
    'Les moutons sont trop mignons. Sauf le noir. Il est grognon.|happy',
    'Tu veux un bonbon ? J\'en ai plus. Je les ai tous mangés.|neutral',
    'Madame Lune dort tout le temps. Mais elle sait plein de trucs.|neutral',
  ],
  boutique: ['Chaussette, c\'est ma copine. Elle cherche sa paire depuis toujours.|neutral', 'Achète des biscuits étoiles ! Ils rendent joyeux.|happy'],
  maison_mouton: ['Mémé Laine tricote des nuages. Je l\'ai vue !|happy'],
  colline: [
    'C\'est haut, hein ? On voit tout le Pays de Coton d\'ici !|happy',
    'Si on trouve l\'étoile, tu feras quel vœu, toi ?|neutral',
    'Moi, mon vœu, c\'est un secret. … Bon, d\'accord : c\'est que tu restes.|happy',
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

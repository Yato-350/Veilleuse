import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G } from '../state';
import { composePoem } from '../scenes/poem';
import { finishGame, REAL } from './common';
import { trLine, translated } from '../../i18n';

/*
 * Epilogue of the dawn route (« aube »): the morning after. Noa and Maman buy a new nightlight at the little shop
 * of the street (map `bazar`), then take it to the garden where Mina rests (map `jardin`). Noa places it on her
 * stone and reads the poem he wrote in the night (flag fin_poem). Dodo, in Noa's bag, has a last silent moment.
 *
 * Everything after the intro is driven by map scripts and flags, so a suspend save made anywhere resumes cleanly:
 *   ep_vl (chosen nightlight id) · ep_paid · ep_garden · ep_maman_wait · ep_water / ep_watered · ep_placed ·
 *   ep_poem · ep_dodo ('laisse' | 'garde').
 */

const flag = (k: string): boolean => !!G.state.flags[k];

export type VlId = 'lune' | 'etoile' | 'mouton' | 'nuage' | 'couronne';

interface Veilleuse {
  sprite: string;
  light: string;
  /** Examining it on the display table. */
  look: string[];
  /** Maman, when Noa chooses it. */
  maman: string[];
  /** Once placed on Mina's stone. */
  placed: string[];
}

export const VEILLEUSES: Record<VlId, Veilleuse> = {
  lune: {
    sprite: 'prop_vl_lune',
    light: '#ffe991',
    look: ['Une petite lune en plastique.', 'La même que celle de Mina. Exactement la même.'],
    maman: ['La même que la sienne…', 'Oui. C\'est bien. Comme ça, elle ne sera pas perdue.'],
    placed: ['La même lune. Une neuve.', 'Elle ne grésille pas.'],
  },
  etoile: {
    sprite: 'prop_vl_etoile',
    light: '#fff3a0',
    look: ['Une étoile à cinq branches.', 'Elle s\'allume et s\'éteint doucement, comme si elle respirait.'],
    maman: ['Une étoile.', 'Elle disait que les étoiles, c\'étaient les veilleuses du ciel. Tu te souviens ?'],
    placed: ['L\'étoile respire doucement, à côté de l\'étoile gravée.', 'Deux étoiles.'],
  },
  mouton: {
    sprite: 'prop_vl_mouton',
    light: '#fffaf2',
    look: ['Un petit mouton tout rond qui brille de l\'intérieur.', 'Il ressemble un peu à Dodo. Un peu trop, peut-être.'],
    maman: ['Un mouton !', 'Elle aurait dit qu\'il fallait lui trouver un nom. Tout de suite.'],
    placed: ['Le petit mouton brille dans l\'herbe.', 'Il a l\'air de monter la garde.'],
  },
  nuage: {
    sprite: 'prop_vl_nuage',
    light: '#c8e0ff',
    look: ['Un nuage qui change de couleur, très lentement.', 'Rose. Jaune. Bleu. Comme le ciel du Pays de Coton.'],
    maman: ['Un nuage…', 'Elle en dessinait partout. Même sur les murs. Surtout sur les murs.'],
    placed: ['Le nuage change de couleur, très lentement.', 'Rose. Jaune. Bleu.'],
  },
  couronne: {
    sprite: 'prop_vl_couronne',
    light: '#ffd84a',
    look: ['Une couronne dorée, avec des pierres en plastique.', 'Une veilleuse de princesse. De chevalière, plutôt.'],
    maman: ['Une couronne.', 'Pour Sa Majesté la Princesse-Chevalière.', '… Elle aurait exigé qu\'on s\'incline.'],
    placed: ['La couronne dorée brille à côté de la couronne en papier.', 'Sa Majesté a deux couronnes, maintenant.'],
  },
};

export const VL_IDS = Object.keys(VEILLEUSES) as VlId[];
const chosen = (): VlId | undefined => {
  const v = G.state.flags.ep_vl;
  return typeof v === 'string' && v in VEILLEUSES ? (v as VlId) : undefined;
};

/** Tiles of the garden used by the scripts (see src/data/maps/epilogue.ts). */
export const STONE = { x: 19, y: 3 };
export const MAMAN_WAIT = { x: 15, y: 4 };
export const MAMAN_NEAR = { x: 18, y: 5 };

// ---------------------------------------------------------------------------
// Start — called by the finale after « On lui apportera une veilleuse. Une neuve. »
// ---------------------------------------------------------------------------

export async function epilogue(d: Director): Promise<void> {
  d.follower(null);
  d.music(null, 2);
  await d.fadeOut(30, '#000000');
  await d.wait(40);
  await d.narrate('Plus tard, ce matin-là.');
  await d.chapter('Épilogue', 'Une veilleuse neuve', 'Un an. Jour pour jour.');
  await shopIntro(d);
}

async function shopIntro(d: Director): Promise<void> {
  await d.fadeOut(1, '#000000');
  d.load('bazar', 'door');
  d.face('player', 'up');
  await d.narrate(['Tu as mis Dodo dans ton sac.', 'Tu ne sais pas trop pourquoi.']);
  d.sfx('chime', { pitch: 1.6, vol: 0.6 });
  await d.fadeIn(60);
  await d.wait(20);
  await d.say(['Bonjour ! Oh, vous êtes matinaux, dites donc.'], 'vendeuse');
  await d.say('Bonjour… On cherche une veilleuse.', 'maman:neutral');
  await d.say(['Les veilleuses ? Sur la grande table, au milieu.', 'Prenez votre temps.'], 'vendeuse');
  d.face('maman', 'right');
  await d.say(['Choisis, toi.', 'C\'est toi qui sais.'], 'maman:happy');
  d.face('maman', 'up');
  d.set('ep_shop');
}

// ---------------------------------------------------------------------------
// The shop (map `bazar`)
// ---------------------------------------------------------------------------

export const bazarEnter: Script = async (d) => {
  world.extraDarkness = 0;
  d.follower(null);
};

/** Examining one of the nightlights on the display table. */
export const pickVeilleuse =
  (id: VlId): Script =>
  async (d) => {
    const v = VEILLEUSES[id];
    await d.say(v.look);
    if (chosen()) {
      await d.say('Elle est jolie aussi. Mais tu as déjà choisi.');
      return;
    }
    const r = await d.ask('Choisir celle-ci ?', ['La choisir', 'Regarder les autres'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    d.set('ep_vl', id);
    d.remove(`vl_${id}`);
    d.sfx('item');
    await d.say('Tu la prends dans tes mains. Elle est toute légère.');
    await d.emote('maman', '♥', 30);
    await d.say(v.maman, 'maman:happy');
    await d.say('On va payer ?', 'maman:neutral');
  };

export const mamanShop: Script = async (d) => {
  if (flag('ep_paid')) {
    await d.say(['On y va ?', 'Le jardin est au bout de la rue.'], 'maman:happy');
    return;
  }
  if (chosen()) {
    await d.say('Tu l\'as choisie, ta veilleuse. On va payer ?', 'maman:neutral');
    return;
  }
  const n = Number(G.state.flags.ep_maman_talk ?? 0);
  G.state.flags.ep_maman_talk = n + 1;
  const lines = [
    ['Prends ton temps.', 'On n\'est pas pressés. Pour une fois.'],
    ['Tu te souviens, quand elle voulait acheter toute la boutique ?', 'Elle avait fait une liste. Trois pages. Avec des dessins.'],
    ['Je ne suis pas revenue ici depuis…', '… Depuis longtemps.'],
  ];
  await d.say(lines[n % lines.length]!, n % lines.length === 2 ? 'maman:sad' : 'maman:happy');
};

/** The counter: the shopkeeper, and paying. */
export const counter: Script = async (d) => {
  if (flag('ep_paid')) {
    await d.say(['Bonne journée à vous deux.', 'Revenez quand vous voulez. Vraiment.'], 'vendeuse');
    return;
  }
  if (!chosen()) {
    await d.say(['Les veilleuses sont sur la grande table, mon grand.', 'Ça ne se choisit pas à la légère, une veilleuse.'], 'vendeuse');
    return;
  }
  await d.say('Elle est jolie, celle-là.', 'vendeuse');
  const r = await d.ask('C\'est pour offrir ?', ['« C\'est pour ma sœur. »', '…'], 'vendeuse');
  if (r === 0) {
    await d.say('C\'est pour ma sœur.', 'noa:neutral');
    await d.say(['Maman te regarde.', 'Tu ne dis plus jamais « ma sœur ». Pas depuis un an.']);
  } else {
    await d.say('…', 'noa:sad');
    await d.say('Oui. C\'est pour sa petite sœur.', 'maman:neutral');
  }
  await d.say(['Sa sœur… Attendez.', 'La petite rousse ? Celle qui venait le samedi, et qui voulait toujours le parapluie à canards ?'], 'vendeuse');
  await d.wait(30);
  await d.say('… Oui. C\'est elle.', 'maman:sad');
  await d.wait(40);
  await d.say(['{p:20}Oh.', '{p:30}…', 'Je vais vous faire un joli paquet.'], 'vendeuse');
  d.sfx('write', { pitch: 0.7 });
  await d.say(['Elle emballe la veilleuse dans du papier de soie, très lentement.', 'Avec un ruban jaune.']);
  d.sfx('item');
  await d.say(['Et deux bonbons à la fraise.', 'Un pour toi. Un pour elle.', 'C\'est la maison qui offre.'], 'vendeuse');
  await d.say('Merci. Merci beaucoup.', 'maman:sad');
  await d.say('Maman paie. Elle met longtemps à ranger la monnaie.');
  d.set('ep_paid');
  await d.say(['On y va ?', 'Le jardin est au bout de la rue.'], 'maman:happy');
};

export const bazarExit: Script = async (d) => {
  if (!flag('ep_paid')) {
    await d.say(chosen() ? 'Il faut payer, d\'abord.' : 'Pas sans la veilleuse.');
    await d.walk('player', 0, -1, 1.2);
    return;
  }
  await d.warp('jardin', 'gate', { sfx: 'door', fade: 40 });
};

// ---------------------------------------------------------------------------
// The garden (map `jardin`)
// ---------------------------------------------------------------------------

/** Maman walks behind Noa until they reach Mina's corner. */
function mamanFollows(d: Director): void {
  if (flag('ep_maman_wait')) return;
  d.follower('maman');
  if (world.follower) world.follower.interact = mamanWalking;
}

export const jardinEnter: Script = async (d) => {
  world.extraDarkness = 0;
  mamanFollows(d);
  if (!flag('ep_garden')) {
    d.set('ep_garden');
    await d.wait(30);
    await d.say(['Le jardin est au bout de la rue, derrière un vieux mur.', 'Il y a des oiseaux.', 'Tu avais oublié qu\'il y avait des oiseaux, le matin.']);
    await d.say(['C\'est tout au fond. Sous le grand arbre.', 'On y va doucement.'], 'maman:neutral');
  }
};

const mamanWalking: Script = async (d) => {
  const n = Number(G.state.flags.ep_walk_talk ?? 0);
  G.state.flags.ep_walk_talk = n + 1;
  const lines: Array<[string[], string]> = [
    [['Je venais toute seule, avant. Le dimanche.', 'Je ne savais pas comment te demander.'], 'maman:sad'],
    [['Elle aimait les arbres qui font de l\'ombre.', 'Alors on a choisi le grand arbre, tout au fond.'], 'maman:neutral'],
    [['Tu as le droit de rester longtemps.', 'Ou pas longtemps. Comme tu veux.'], 'maman:happy'],
  ];
  if (flag('ep_water') && !flag('ep_watered')) {
    await d.say('Tu as pris l\'arrosoir ? Elle va avoir des fleurs toutes neuves.', 'maman:happy');
    return;
  }
  const [text, who] = lines[n % lines.length]!;
  await d.say(text, who);
};

/** Reaching Mina's corner: Maman lets Noa go first. */
export const mamanStops: Script = async (d) => {
  if (flag('ep_maman_wait')) return;
  const f = world.follower;
  const fx = f ? Math.floor(f.x / 16) : MAMAN_WAIT.x - 1;
  const fy = f ? Math.floor((f.y - 2) / 16) : MAMAN_WAIT.y + 1;
  d.follower(null);
  d.spawn({ id: 'maman', char: 'maman', x: fx, y: fy, dir: 'right', script: mamanGarden });
  d.set('ep_maman_wait');
  await d.walkTo('maman', MAMAN_WAIT.x, MAMAN_WAIT.y, 0.7);
  d.face('maman', 'right');
  d.face('player', 'left');
  await d.say(['C\'est là.', 'Vas-y, toi. Je reste là.', 'Je ne bouge pas.'], 'maman:sad');
  d.face('player', 'right');
};

/** Talking to Maman once she waits (before / after the poem). */
export const mamanGarden: Script = async (d) => {
  if (!flag('ep_poem')) {
    await d.say(['Vas-y. Prends ton temps.', 'Je suis juste là.'], 'maman:neutral');
    return;
  }
  await goHome(d);
};

export const gate: Script = async (d) => {
  if (!flag('ep_poem')) {
    await d.say(flag('ep_maman_wait') ? 'Pas encore. Pas sans lui avoir dit bonjour.' : ['Maman t\'attend.', 'Le grand arbre est tout au fond du jardin.']);
    await d.walk('player', 0, -1, 1.2);
    return;
  }
  const r = await d.ask('Rentrer à la maison ?', ['Rentrer', 'Rester encore un peu'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.walk('player', 0, -1, 1.2);
    return;
  }
  await goHome(d);
};

export const tap: Script = async (d) => {
  if (flag('ep_water')) {
    await d.say('Le robinet goutte un peu. Plic. Plic. Comme celui de la cuisine.');
    return;
  }
  await d.say(['Un robinet sur un piquet, et un arrosoir en fer.', 'Pour les fleurs. Tout le monde peut s\'en servir.']);
  const r = await d.ask('Remplir l\'arrosoir ?', ['Le remplir', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.sfx('heal', { pitch: 0.6 });
  d.remove('arrosoir');
  d.set('ep_water');
  await d.say(['L\'eau est glacée. L\'arrosoir devient lourd.', 'Tu le portes à deux mains.']);
};

export const sparrow: Script = async (d) => {
  await d.say(['Un moineau. Il te regarde, la tête penchée.', 'Puis il retourne picorer. Tu ne lui fais pas peur.']);
};

/** Mina's stone: the nightlight, the poem, Dodo. */
export const minaStone: Script = async (d) => {
  if (!flag('ep_placed')) {
    await d.say(['Une petite pierre blanche, avec une étoile gravée.', 'MINA. Son prénom, et deux dates beaucoup trop proches.']);
    await d.say(['Sur la pierre, une couronne en papier, décolorée par la pluie.', 'Quelqu\'un l\'a remise bien droite.']);
    await d.wait(30);
    await d.say('… Salut, Mina.', 'noa:sad');
    const r = await d.ask('Poser la veilleuse ?', ['La poser', 'Pas encore'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    await placeVeilleuse(d);
    await readPoem(d);
    await dodoMoment(d);
    await mamanJoins(d);
    return;
  }
  if (flag('ep_water') && !flag('ep_watered')) {
    await waterFlowers(d);
    return;
  }
  const v = VEILLEUSES[chosen() ?? 'lune'];
  await d.say(v.placed);
  if (G.state.flags.ep_dodo === 'laisse') await d.say('Dodo est assis contre la pierre. Il a l\'air bien, là.');
};

async function placeVeilleuse(d: Director): Promise<void> {
  const id = chosen() ?? 'lune';
  const v = VEILLEUSES[id];
  await d.say(['Tu défais le ruban jaune, puis le papier de soie.', 'Tu poses la veilleuse sur la pierre, contre l\'étoile.']);
  const e = d.spawn({ id: 'vl_placed', sprite: v.sprite, x: STONE.x, y: STONE.y, solid: false, shadow: false, light: { r: 26, color: v.light, dy: -10 } });
  e.oy = -3;
  e.ox = -7;
  d.set('ep_placed');
  await d.wait(30);
  d.sfx('chime');
  d.flash('#fff3cf', 8);
  await d.say(['Tu appuies sur le petit bouton.', 'En plein jour, on la voit à peine.', 'Mais elle brille.']);
  await d.say(v.placed);
  if (flag('ep_water') && !flag('ep_watered')) await waterFlowers(d);
}

async function waterFlowers(d: Director): Promise<void> {
  const r = await d.ask('Arroser les fleurs ?', ['Arroser', 'Plus tard'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.sfx('heal', { pitch: 0.8 });
  d.set('ep_watered');
  await d.say(['Tu arroses le petit pot de fleurs, au pied de la pierre.', 'L\'eau brille au soleil. La terre sent bon.']);
}

/** Noa reads aloud the poem he wrote in Mina's notebook, at dawn. */
async function readPoem(d: Director): Promise<void> {
  const text = typeof G.state.flags.fin_poem === 'string' ? G.state.flags.fin_poem : defaultPoem();
  const lines = text.split('\n');
  // ['Pour Mina.', '', word…, '', ending…, '— Noa']
  const blank = lines.indexOf('', 2);
  const words = lines.slice(2, blank > 0 ? blank : lines.length);
  const ending = blank > 0 ? lines.slice(blank + 1).filter((l) => l && !l.startsWith('—')) : [];
  const sad = ending.join(' ').includes('manques');
  const face = sad ? 'noa:sad' : 'noa:neutral';

  await d.wait(30);
  await d.say(['Tu sors le carnet de Mina de ton sac.', 'La page que tu as écrite cette nuit.']);
  d.music('mina', 1.5);
  await d.ask('Tu prends ta respiration.', ['Lire à voix haute']);
  await d.say(lines[0] ?? 'Pour Mina.', face);
  // The poem is stored in French (flag fin_poem): each line is translated on its own (« lune, » → "moon,").
  for (let i = 0; i < words.length; i += 3) {
    await d.say(
      translated(
        words
          .slice(i, i + 3)
          .map((w) => `${trLine(w)}{p:18}`)
          .join('\n'),
      ),
      face,
    );
  }
  if (ending.length) await d.say(translated(ending.map(trLine).join('\n')), face);
  d.set('ep_poem');
  await d.wait(40);
  await d.say(['Ta voix a tremblé.', 'Mais tu es allé jusqu\'au bout.']);
}

function defaultPoem(): string {
  const w = (text: string, emotion: 'joie' | 'tristesse') => ({ text, emotion });
  return composePoem([w('lune', 'joie'), w('coton', 'joie'), w('pluie', 'tristesse'), w('promesse', 'joie'), w('absente', 'tristesse'), w('lumière', 'joie')]).join('\n');
}

/** Dodo, a plush again, has a last silent moment. */
async function dodoMoment(d: Director): Promise<void> {
  await d.wait(30);
  await d.say(['Ton sac pèse sur ton épaule.', 'Dodo. Les oreilles écrasées, les yeux-boutons tournés vers le ciel.']);
  const e = d.spawn({ id: 'dodo_plush', sprite: 'prop_dodo_plush', x: STONE.x + 1, y: STONE.y, solid: false, shadow: false });
  e.oy = 2;
  e.ox = -2;
  await d.say('Tu l\'assois sur la pierre, à côté de la veilleuse.');
  await d.wait(60);
  await d.say('Il ne dit rien.');
  await d.wait(50);
  d.sfx('whoosh', { pitch: 0.4, vol: 0.4 });
  await d.say('Le vent fait tourner les moulins. Ses yeux-boutons attrapent la lumière.');
  await d.emote('dodo_plush', '♥', 70);
  await d.wait(30);
  const r = await d.ask('Dodo…', ['Le laisser à Mina', 'Le garder avec toi']);
  if (r === 0) {
    d.set('ep_dodo', 'laisse');
    await d.say('Veille sur elle, maintenant.', 'noa:sad');
    await d.say(['Tu l\'appuies bien contre la pierre, pour qu\'il ne tombe pas.', 'Il a l\'air de monter la garde.']);
  } else {
    d.set('ep_dodo', 'garde');
    d.remove('dodo_plush');
    await d.say(['Tu le remets dans ton sac.', 'Sa tête dépasse un peu. Pour qu\'il voie le ciel.']);
  }
}

/** Maman comes closer after the poem. */
async function mamanJoins(d: Director): Promise<void> {
  await d.wait(30);
  d.face('player', 'left');
  await d.emote('maman', '…', 40);
  await d.walkTo('maman', MAMAN_NEAR.x, MAMAN_NEAR.y, 0.6);
  d.face('maman', 'right');
  await d.wait(20);
  await d.say(['Elle l\'aurait accroché sur le frigo.', 'Avec l\'aimant en forme de fraise.'], 'maman:sad');
  await d.say('… Elle l\'aurait corrigé, aussi. Au feutre violet.', 'maman:happy');
  await d.wait(30);
  await d.say('Vous restez là un moment, sans rien dire. Ce n\'est pas un silence lourd.');
  d.face('player', 'up');
}

/** The end: going home together. */
async function goHome(d: Director): Promise<void> {
  const r = await d.ask('On rentre ?', ['Rentrer', 'Rester encore un peu'], 'maman:neutral', { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('D\'accord. Prends ton temps.', 'maman:happy');
    return;
  }
  await d.say(['Ce soir, je ne travaille pas.', 'Je fais des pâtes.'], 'maman:happy');
  const r1 = G.state.flags.i1_reply;
  if (r1 === 'sale') {
    await d.say('… Pas trop salées.', 'noa:neutral');
    await d.say('Pas trop salées. Promis.', 'maman:happy');
  } else if (G.state.flags.i1_ate) {
    await d.say('… D\'accord.', 'noa:neutral');
  } else {
    await d.say(['… D\'accord.', 'J\'aurai faim, je crois.'], 'noa:neutral');
  }
  await d.say(['Maman te tend la main.', 'Tu la prends. Elle serre fort.']);
  d.music('ending', 2);
  await d.fadeOut(140, '#fff3e0');
  d.remove('maman');
  await d.image('fin_jardin', ['Derrière vous, la veilleuse brille en plein jour.', 'Personne ne la remarque vraiment.', 'Mais elle brille.']);
  await d.fadeOut(1, '#000000');
  await d.wait(40);
  if (G.state.flags.ep_dodo === 'laisse') {
    await d.narrate('Je veillerai sur elle.', { voice: 'dodo' });
    await d.narrate('Lui, il n\'a plus peur du noir. Plus autant.', { voice: 'dodo' });
  } else {
    await d.narrate('Je veillerai sur lui.', { voice: 'dodo' });
    await d.narrate('Pour de vrai, cette fois.', { voice: 'dodo' });
  }
  await d.narrate('Merci, {player}.', { voice: 'dodo' });
  await d.narrate('{c:y}Bonne nuit. Et bonjour.{/c}', { voice: 'dodo' });
  await finishGame(d, 'aube');
}

// ---------------------------------------------------------------------------
// Debug entry points (merged into real.ts DEBUG)
// ---------------------------------------------------------------------------

function debugBase(): void {
  G.state.flags.interlude = REAL.finale;
  G.state.flags.fin_room = true;
  G.state.flags.fin_route = 'aube';
  G.state.chapter = 3;
}

export const EPILOGUE_DEBUG: Record<string, Script> = {
  /** From the transition (« Plus tard, ce matin-là. ») to the shop. */
  epilogue_full: async (d) => {
    debugBase();
    d.load('chambre_mina', 'door');
    await epilogue(d);
  },
  epilogue_shop: async (d) => {
    debugBase();
    await shopIntro(d);
  },
  /** At the garden gate, nightlight already bought (add &flags=ep_vl=etoile to pick another one). */
  epilogue_garden: async (d) => {
    debugBase();
    if (!chosen()) G.state.flags.ep_vl = 'couronne';
    G.state.flags.ep_shop = true;
    G.state.flags.ep_paid = true;
    d.load('jardin', 'gate');
    await d.fadeIn(20);
  },
  /** In front of Mina's stone, Maman waiting on the side. */
  epilogue_stone: async (d) => {
    debugBase();
    if (!chosen()) G.state.flags.ep_vl = 'lune';
    G.state.flags.ep_shop = true;
    G.state.flags.ep_paid = true;
    G.state.flags.ep_garden = true;
    G.state.flags.ep_maman_wait = true;
    d.load('jardin', 'stone');
    await d.fadeIn(20);
  },
};

import { W } from '../engine/constants';
import { drawText } from '../engine/font';
import { tf } from '../i18n';
import { spr } from '../game/assets';
import type { Battle } from '../game/battle/battle';
import { EnemyRuntime } from '../game/battle/enemy';
import { FINAL_V2_HOOKS } from '../game/battle/final-v2';
import { CH6 } from '../game/battle/patterns-ch6';
import type { BattleHooks, EnemyDef } from '../game/battle/types';
import { director } from '../game/director';
import { G } from '../game/state';
import { MOUTON_STAMP } from './sprites/enemies-ch6';

/*
 * Chapter 6 « Le Ventre de Dodo » — the enemies (docs/HISTOIRE.md § 3.14). Spread into ENEMIES by src/data/enemies.ts.
 *
 * Balance (act III, chapter 5 stats: about 26 Étoiles): regular PV 30–48 / ATQ 5–6. Nobody at Noa's side.
 *
 *   aiguille          Colère → Tristesse ×2. Dashes across the box and leaves running stitches; its needle sews the
 *                     heart (Battle.emoLockUntil: the heart keeps its color two turns).
 *   bouton_pendu      Peur → « regarder » (at once), or Tristesse ×2. A pendulum that sweeps the box.
 *   bourre            Tristesse → « pardon ». Wet cotton sticks to the heart and slows it (BulletWorld.slow). Only
 *                     met when flags.c4_coton > 0 (the sheep Noa emptied in chapter 4): the story decides.
 *   mouton_numerote   Joie → Joie. Met in groups (put them alone in the battle, hooks come from the first enemy):
 *                     each gets a night number (« Mouton n°212 »). Spared out of order — while a higher number is
 *                     still not calm — it multiplies (up to four on screen). Spare from the highest number down.
 *   pile              Neutre → Joie, then Tristesse → « garder ». Unique encounter, cannot be fled. Its voice (track 1
 *                     of the voice module) slows down every turn. Spared: key item « Pile chargée » and
 *                     flags.c6_pile = true. Defeated: flags.c6_pile = false and flags.c6_pile_morte = true (Dodo's
 *                     voice dies sooner, the secret ending is lost).
 *   dodo_v2           the final battle, see src/game/battle/final-v2.ts.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------------------------------

/** Per-battle scratch state of a scripted enemy (hooks objects are shared between battles). */
const STATES = new WeakMap<Battle, object>();
function state<T extends object>(b: Battle, init: () => T): T {
  let s = STATES.get(b) as T | undefined;
  if (!s) {
    s = init();
    STATES.set(b, s);
  }
  return s;
}

// ---------------------------------------------------------------------------------------------------------------------
// Moutons Numérotés — spare them from the highest number down
// ---------------------------------------------------------------------------------------------------------------------

const MOUTON_MAX = 4;

/** The night number stamped on a sheep (set on the first turn). */
const numberOf = (e: EnemyRuntime): number => Number(e.data.n ?? 0);

/** Places the sheep still standing side by side. */
function layout(b: Battle): void {
  const standing = b.enemies.filter((e) => e.alive);
  const n = standing.length;
  standing.forEach((e, i) => {
    e.x = Math.round(W / 2 + (i - (n - 1) / 2) * (n > 2 ? 86 : 110));
  });
}

function stampNumber(b: Battle, e: EnemyRuntime, n: number): void {
  e.data.n = n;
  e.def = { ...e.def, name: tf('Mouton n°{0}', n) };
  void b;
}

function newNight(b: Battle): number {
  const used = b.enemies.map(numberOf);
  let n = 0;
  while (!n || used.includes(n)) n = 1 + Math.floor(Math.random() * 364);
  return n;
}

const MOUTON_HOOKS: Partial<BattleHooks> = {
  beforeTurn: async (b, turn) => {
    if (turn !== 1) return;
    for (const e of b.enemies) if (!numberOf(e)) stampNumber(b, e, newNight(b));
    // The number, handwritten in red in the stamp's cartouche.
    const prev = b.overlay;
    b.overlay = (g, bb) => {
      prev?.(g, bb);
      for (const e of bb.enemies) {
        if (!e.alive || e.hidden || !numberOf(e) || e.def.id !== 'mouton_numerote') continue;
        const sp = spr(e.def.sprite);
        const o = bb.spriteOffset(e);
        const x = e.x + o.dx - sp.ax + MOUTON_STAMP.x + 1;
        const y = e.y + o.dy - sp.ay + MOUTON_STAMP.y + 1 + (bb.clock % 48 >= 24 ? -2 : 0);
        drawText(g, String(numberOf(e)), x, y - 1, { color: '#a8324a' });
      }
    };
  },
  onSpare: async (b, e) => {
    // Allowed when no sheep with a higher number is left uncalmed (calm ones are spared in the same breath).
    const higher = b.enemies.filter((o) => o !== e && o.alive && numberOf(o) > numberOf(e) && !o.spareable);
    if (!higher.length) return false;
    const st = state(b, () => ({ errors: 0 }));
    st.errors++;
    e.progress = 0;
    e.step = 0;
    e.stepProgress = 0;
    e.emotion = e.def.emotion;
    e.shake = 20;
    director.sfx('pop', { pitch: 0.6 });
    if (b.alive.length < MOUTON_MAX) {
      const twin = new EnemyRuntime(b.enemies.find((o) => o.def.id === 'mouton_numerote')!.def);
      stampNumber(b, twin, Math.min(...b.enemies.map(numberOf).filter(Boolean)) - 1 || newNight(b));
      twin.y = e.y;
      b.enemies.push(twin);
      layout(b);
      twin.flash = 12;
      director.sfx('baa', { pitch: 0.7 });
      await b.say(tf('* {0} se dédouble. Un dossier sort du dossier.\n* Pas dans cet ordre. Le n°{1} attend encore.', e.name, numberOf(higher[0]!)));
    } else {
      await b.say(tf('* {0} se froisse et recommence.\n* Pas dans cet ordre. Le n°{1} attend encore.', e.name, numberOf(higher[0]!)));
    }
    return true;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// La Pile — its voice slows down every turn
// ---------------------------------------------------------------------------------------------------------------------

/** Track 1 of the voice module, a little more worn out every turn. */
const PILE_LINES = [
  'Bonne nuit, Noa ! Dodo veille sur toi.{p:20} Fais de beaux rêves.',
  'Bonne nuit,{p:20} Noa…{p:20} Dodo veille{p:20} sur…',
  'Bon…{p:30}ne…{p:30} nuit…{p:40} N…',
  'B…{p:40}o…{p:50}n…',
  '…{p:60}…',
];
const PILE_VOICES = ['pile', 'pile2', 'pile3', 'pile4', 'pile4'];
const PILE_SPEEDS = [1, 0.6, 0.4, 0.3, 0.25];

const PILE_HOOKS: Partial<BattleHooks> = {
  beforeTurn: async (b, turn) => {
    const e = b.enemies[0];
    if (!e?.alive) return;
    const i = Math.min(PILE_LINES.length - 1, turn - 1);
    CH6.voice = Math.max(0.2, 1 - (turn - 1) * 0.2);
    // The battle music slows with it.
    b.detune(Math.min(0.6, (turn - 1) * 0.12));
    await director.say(PILE_LINES[i]!, 'pile', { voice: PILE_VOICES[i], speed: PILE_SPEEDS[i] });
    if (turn === 4) await b.say('* La voix est presque partie.\n* Il lui reste quelque chose. Pas pour longtemps.');
  },
  talk: () => '',
  onWord: async (_b, e) => {
    // Once it has smiled, it is sad: what is left of a battery that is running out.
    if (e.step >= 1 && !e.spareable) e.emotion = 'tristesse';
    return false;
  },
  onSpare: async () => {
    G.state.flags.c6_pile = true;
    delete G.state.flags.c6_pile_morte;
    if (!G.state.keyItems.includes('pile_chargee')) G.state.keyItems.push('pile_chargee');
    return false;
  },
  onDeath: async () => {
    G.state.flags.c6_pile = false;
    G.state.flags.c6_pile_morte = true;
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// The enemies
// ---------------------------------------------------------------------------------------------------------------------

export const CH6_ENEMIES: Record<string, EnemyDef> = {
  aiguille: {
    id: 'aiguille',
    name: 'Aiguille',
    fem: true,
    sprite: 'b_aiguille',
    hp: 48,
    atk: 6,
    def: 2,
    emotion: 'colere',
    needs: [{ emotion: 'tristesse', count: 2 }],
    hates: ['colere'],
    check: 'Elle recoud tout ce qui dépasse. Sa pointe coud le cœur : sa couleur reste deux tours.',
    flavor: [
      '* L\'Aiguille te regarde par son chas. Un œil, un vrai. Il ne cligne pas.',
      '* Point. Point. Point arrière. Elle recoud l\'air derrière toi.',
      '* Le fil rouge traîne par terre. Il est encore humide.',
      '* Ça sent le coton mouillé et le métal.',
    ],
    flavorCalm: '* L\'Aiguille s\'est piquée dans le coton. Elle tremble un peu. Son œil s\'est fermé.',
    talk: ['Point.', 'Point. Point.', 'Ce qui dépasse, je le recouds.', 'Ne bouge pas. Je vais te coudre.', 'Elle cousait mal. Les points étaient trop grands.', 'Une couture, ça tient. Ça ne part pas.'],
    reactGood: ['…Ça pique, les larmes aussi.', 'Mon fil se détend.', 'Point… arrière.'],
    reactBad: ['Je vais te coudre la bouche !', 'Ça dépasse ! ÇA DÉPASSE !', 'Trop de bruit. Je recouds.'],
    reactNeutral: ['Point ?', 'Ça ne se coud pas, ça.', '…Fil.'],
    reactSpecial: {
      'fil rouge': 'C\'est le sien. Moi, je ne fais que le passer.',
      aiguille: 'Moi. Oui. Fine et froide.',
      découdre: 'Découdre ? Je fais l\'inverse. Toujours l\'inverse.',
      pardon: 'Pardon, ça ne se coud pas. Ça glisse entre les points.',
    },
    spareText: '* L\'Aiguille se pique dans le coton, tout doucement, et ne bouge plus. Le fil rouge reste où il est.',
    killText: '* L\'Aiguille casse net. Le chas se vide. Le fil rouge tombe en boucles, sans personne au bout.',
    patterns: ['aiguille_points', 'aiguille_couture'],
    rewards: { boutons: 18 },
    bg: 'ventre',
  },

  bouton_pendu: {
    id: 'bouton_pendu',
    name: 'Bouton Pendu',
    sprite: 'b_bouton_pendu',
    hp: 44,
    atk: 6,
    def: 1,
    emotion: 'peur',
    needs: [{ emotion: 'tristesse', word: 'regarder', count: 2 }],
    specialWords: [{ text: 'regarder', emotion: 'neutre' }],
    check: 'Un œil arraché qui pend au bout d\'un fil. Il a peur qu\'on le regarde. Regarde-le.',
    flavor: [
      '* Le Bouton Pendu se balance. Tic. Tac. Il ne s\'arrête jamais au milieu.',
      '* Ses deux trous te fixent. Ce n\'est qu\'un bouton. Ce n\'est qu\'un bouton.',
      '* Au bout du fil, un lambeau de feutre gris. Arraché, pas décousu.',
      '* Quelque part au-dessus, une orbite vide attend qu\'il revienne.',
    ],
    flavorCalm: '* Le Bouton Pendu s\'est arrêté. Il pend tout droit. Il te regarde, et ça va.',
    talk: ['Ne me regarde pas.', 'Tic. Tac.', 'J\'étais son œil gauche.', 'De là-haut, on voyait tout. Tout.', 'Il était assis contre la porte. Il a vu.', 'Ne me regarde pas comme ça.'],
    reactGood: ['…Tu me regardes vraiment.', 'Personne ne regarde un bouton.', 'Tic… tac…'],
    reactBad: ['Arrête ! Arrête de crier !', 'Je me balance plus fort !', 'NE ME REGARDE PAS COMME ÇA.'],
    reactNeutral: ['Tic ?', 'Hein ?', '…Tac.'],
    reactSpecial: {
      regarder: 'Regarder. Oui. Pour de vrai. Pas les yeux fermés.',
      noir: 'Le noir, je connais. J\'y pends.',
      bouton: 'C\'est moi. Juste un bouton. Ça se recoud.',
      'trois heures': 'À trois heures, j\'avais les yeux ouverts. Lui aussi.',
    },
    spareText: '* Le Bouton Pendu cesse de se balancer. Le fil remonte, tout seul, vers le noir d\'en haut. Il retourne à sa place.',
    killText: '* Le fil casse. Le bouton tombe, roule, et s\'arrête face contre terre. Il ne voit plus rien.',
    patterns: ['bouton_balancier', 'bouton_pluie'],
    rewards: { boutons: 17 },
    bg: 'ventre',
  },

  bourre: {
    id: 'bourre',
    name: 'Bourre',
    fem: true,
    sprite: 'b_bourre',
    hp: 40,
    atk: 5,
    def: 0,
    emotion: 'tristesse',
    needs: [{ word: 'pardon' }],
    specialWords: [{ text: 'pardon', emotion: 'tristesse' }],
    check: 'Le coton des moutons que tu as vidés. Il colle, il ralentit. Il n\'attend qu\'un mot.',
    flavor: [
      '* La Bourre goutte. Ploc. Ploc. Ça sent la cave et le doudou mouillé.',
      '* Sur sa tête, deux croix défaites. Il y avait des yeux, là.',
      '* Elle a encore la forme d\'un mouton. Presque.',
      '* Elle se traîne. Elle laisse une trace jaune derrière elle.',
    ],
    flavorCalm: '* La Bourre ne goutte plus. Elle a l\'air, enfin, d\'un tas de coton. Juste ça.',
    talk: ['C\'est toi qui nous as vidés.', 'On était des moutons.', 'Tu as tiré. Tu as tiré tout le coton.', 'Pour te faire un nid. Pour avoir chaud.', 'On avait froid, après.', 'Ploc.'],
    reactGood: ['…', 'Encore. Dis-le encore.', 'Ploc… ploc…'],
    reactBad: ['Tu tires encore !', 'Arrête de tirer !'],
    reactNeutral: ['Ploc.', 'Ce n\'est pas ce mot-là.', 'On attend autre chose.'],
    reactSpecial: {
      pardon: 'Pardon… Il l\'a dit. Vous avez entendu ? Il l\'a dit.',
      coton: 'Notre coton. Il était à nous.',
      câlin: 'Tu nous serrais trop fort. Ça déchirait.',
    },
    spareText: '* La Bourre s\'étale doucement, comme on s\'endort. Ce n\'est plus qu\'un tas de coton. Il sèche.',
    killText: '* La Bourre se défait en touffes grises. Elles collent à tes semelles. Longtemps.',
    patterns: ['bourre_colle', 'bourre_moisi'],
    rewards: { boutons: 12 },
    bg: 'ventre',
  },

  mouton_numerote: {
    id: 'mouton_numerote',
    name: 'Mouton Numéroté',
    sprite: 'b_mouton_numerote',
    hp: 30,
    atk: 5,
    def: 1,
    emotion: 'joie',
    needs: [{ emotion: 'joie' }],
    check: 'Tamponné comme un dossier. Les dossiers se rangent du plus grand numéro au plus petit.',
    flavor: [
      '* Les Moutons Numérotés attendent, en rang. Bien rangés. Trop bien.',
      '* Sur leurs flancs, l\'encre des tampons n\'a pas séché.',
      '* Ils ont les yeux fermés. On les a déjà comptés.',
      '* Ça sent le papier et la photocopieuse.',
    ],
    flavorCalm: '* Un mouton tamponné sourit. Il attend son tour, bien sagement.',
    talk: ['Bêê. Suivant.', 'Numéro ?', 'On a été comptés. Tous.', 'Chaque nuit a son mouton.', 'Classés. Bêê.', 'Pas de doublons.'],
    reactGood: ['Bêê ! Dossier clos !', 'Hi hi. Classé.', 'Bêê… c\'est gentil.'],
    reactBad: ['Erreur de classement !', 'BÊÊ ! Hors catégorie !'],
    reactNeutral: ['Bêê ?', 'Pas de case pour ça.', 'Formulaire incomplet.'],
    reactSpecial: {
      'quarante et une': 'Quarante et un ! On avait un dossier à ce nom-là.',
      'nuit blanche': 'Pas de numéro pour les nuits blanches. Elles ne comptent pas.',
      'trois heures': 'Trois heures ? Sous-dossier quatorze.',
    },
    spareText: '* Le mouton se range dans son dossier, et le dossier se referme. Bêê.',
    killText: '* L\'encre du tampon coule. Le numéro devient illisible. Ce mouton n\'a jamais été compté.',
    patterns: ['mouton_tampon', 'mouton_saute'],
    rewards: { boutons: 8 },
    hooks: MOUTON_HOOKS,
    bg: 'ventre',
  },

  pile: {
    id: 'pile',
    name: 'Pile',
    fem: true,
    sprite: 'b_pile',
    hp: 36,
    atk: 4,
    def: 1,
    emotion: 'neutre',
    needs: [{ emotion: 'joie' }, { word: 'garder' }],
    specialWords: [{ text: 'garder', emotion: 'tristesse' }],
    noFlee: true,
    check: 'La pile de la voix. « Ça tient environ un an. » Fais-la sourire. Puis garde-la.',
    flavor: [
      '* La Pile grésille. Une voix sort d\'elle, très loin, comme un jouet oublié sous une couette.',
      '* Une croûte blanche lui pousse sur le bord. On dirait du sel. On dirait du givre.',
      '* Sur la boîte du kit, quelqu\'un avait écrit : « ça tient environ un an ».',
      '* Elle est tiède. Elle a gardé un peu de chaleur, quelque part.',
    ],
    flavorCalm: '* La Pile ne grésille plus. Elle attend, avec sa dernière phrase dedans.',
    talk: [''],
    reactGood: ['…ne nuit… Noa…', 'Hi… hi…', '…veille… sur…'],
    reactBad: ['Kssh… kssh…', '…', 'Bzz… zz…'],
    reactNeutral: ['…?', 'Kssh…', '…rêves…'],
    reactSpecial: {
      garder: 'Garder… Oui. Garde-moi. Pas pour toujours. Juste pour une phrase.',
      pile: 'Moi. Presque vide.',
      berceuse: '…fais de beaux… rê…',
      'bonne nuit': 'Bonne nuit, N… Bonne nuit… N…',
    },
    spareText: '* Tu ramasses la Pile. Elle tient au creux de ta main. Tiède. Il lui reste une phrase.\n* Tu obtiens : {c:y}Pile chargée{/c}.',
    killText: '* La Pile s\'éteint au milieu d\'un mot. Plus de voix.\n* Quelque part, très loin, Dodo se tait un peu plus tôt.',
    patterns: ['pile_fuite', 'pile_gresille'],
    rewards: { boutons: 0 },
    hooks: PILE_HOOKS,
    voice: 'pile',
    bg: 'ventre',
  },

  dodo_v2: {
    id: 'dodo_v2',
    name: 'Dodo',
    sprite: 'b_dodo',
    hp: 365,
    atk: 1,
    def: 0,
    emotion: 'neutre',
    needs: [],
    check: 'Ton mouton. Il parle avec ta voix. Il ne veut pas que tu aies mal.',
    flavor: ['* Dodo te regarde. Il a ta voix, maintenant.', '* Il fait chaud. Il fait doux. Il fait noir.', '* Quelque part, la berceuse tourne au ralenti.'],
    talk: ['…'],
    reactGood: ['…'],
    reactBad: ['…'],
    reactNeutral: ['…'],
    patterns: ['v2_moutons'],
    rewards: { boutons: 0 },
    boss: true,
    noFlee: true,
    voice: 'noa',
    music: 'dodo_v2',
    bg: 'voix',
    hooks: FINAL_V2_HOOKS,
  },
};


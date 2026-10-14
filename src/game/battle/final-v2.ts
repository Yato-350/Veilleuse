import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game } from '../../engine/game';
import { input } from '../../engine/input';
import type { Emotion } from '../../engine/palette';
import { drawSprite } from '../../engine/sprite';
import { DODO_WORDS_V2, MINA_WORDS_V2 } from '../../data/words';
import { tf, tr, translated } from '../../i18n';
import { hasSpr, spr } from '../assets';
import { director, type Director } from '../director';
import { isLateNight } from '../meta';
import { CountingScene, type SheepKind, type SheepRound } from '../scenes/sheepcount';
import { G } from '../state';
import { isSilenceRoute } from '../story/common';
import type { Battle } from './battle';
import { CH6_BG } from './bg-ch6';
import type { EnemyRuntime } from './enemy';
import {
  drawBlot,
  drawStage,
  FRIEND,
  friendQueue,
  INK_CUTS,
  INK_SILENCES,
  INK_WORDS,
  inkOf,
  isBlot,
  listNames,
  makeCrack,
  nextVisit,
  wrapList,
  type Friend,
  type StageFriend,
} from './final-common';
import { CH6 } from './patterns-ch6';
import type { BattleHooks, WordDef } from './types';

/*
 * The final battle of version 2 — Dodo, at the heart of the voice module (docs/HISTOIRE.md § 3.14, « Combat final »).
 * Enemy `dodo_v2` (src/data/enemies-ch6.ts), arena `voix` (the battery's crust spreads as the fight goes on), music
 * `dodo_v2`. You do not strike sleep. Four phases:
 *
 *   1 « Les moutons »   turns 1–3. One sheep per death of the player (G.meta.deaths, up to 41) — none: 41, « ses
 *                       nuits » — jumping the box, counted by a tally of pen strokes over the arena. Dodo speaks with
 *                       Noa's blip. Words slide off his wool.
 *   2 « DORMIR »        his seams open (b_dodo_torn): stuffing hanging, an eye-button swinging on its thread. The
 *                       buttons turn into DORMIR one by one; the notebook only holds his words, those of the call
 *                       (« Dors. », « Arrête d'appeler. », « Demain. », « Promis. »), shown as subtitles when written.
 *                       His reason, said once. One announced turn of crayons whose color lies (the HUD shows « ? »).
 *   3 « Les coups »     everything goes black. Someone knocks behind a wall. FRAPPER comes back — to knock on the wall:
 *                       the knocks are counted in the counting scene (skin « coups », blind, the radiator's false
 *                       knocks among hers; Story mode: slower, no false knocks), then Noa knocks back.
 *                         round A — she knocks once (« t'es là ? »): answer two (« je suis là »);
 *                         round B — she knocks three times (« bonne nuit »): answer three.
 *                       A wrong answer: Dodo gets HP back, and it starts again; after two, the little girl in the knitted
 *                       hat knocks in plain view, slowly. If flags.i4_knock is 'deux' or 'trois', only round B. On the
 *                       route of the ink, nobody knocks: only the radiator.
 *   4 « Les mots de Mina »  the notebook in her pencil handwriting (MINA_WORDS_V2): each word cracks Dodo, she answers.
 *                       Spared friends come and help (as in version 1.1). Drowned words (the player's ink) are blots.
 *                       OBJET › Bouton doré: a scrambled track, a big crack (counts as a word). OBJET › Pile chargée
 *                       (flags.c6_pile): track 1, whole and clear, once — « C'était ça. Juste ça. Cinq secondes. ».
 *                       Five cracks and ÉPARGNER becomes OUVRIR LES YEUX. Every hit taken here (and in phase 3) sinks
 *                       Noa a little deeper into sleep, whatever his HP: at the bottom, Dodo offers to stay. Dodo's
 *                       attack grows with the player's max HP: many Étoiles do not make this phase trivial.
 *   The choice: [Ouvrir les yeux] → route 'aube' (the finale; Aube or Aube blanche, see endings.ts), [Rester] →
 *   'beaux_reves'. The route of the ink (isSilenceRoute()) → 'silence'. DORMIR at the bottom of sleep → 'beaux_reves'.
 *
 * Outcome: the battle ends 'scripted'; G.state.flags.fin_route = 'aube' | 'beaux_reves' | 'silence'. The story then
 * calls afterFinalBattle(d, route) (src/game/story/endings.ts). Debug: FINAL_V2.from starts at a later phase.
 */

export type FinalV2Route = 'aube' | 'beaux_reves' | 'silence';

/** Debug: the phase the next final battle starts at (reset to 1 when it starts). */
export const FINAL_V2 = { from: 1 as 1 | 2 | 3 | 4 };

interface V2State {
  phase: 1 | 2 | 3 | 4;
  silence: boolean;
  /** 0..MAX_SLEEP: the screen darkens, the music slows. */
  sleep: number;
  // Phase 1
  sheep: number;
  // Phase 2
  p2: number;
  dodoWords: number;
  lied: boolean;
  lieNow: boolean;
  subtitle: { text: string; t: number } | null;
  // Phase 3
  knock: 'A' | 'B' | 'done';
  knockErrors: number;
  knockTries: number;
  /** 0..1: the black of phase 3. */
  black: number;
  // Phase 4
  p4: number;
  written: string[];
  /** Cracks given by the items (they count as words). */
  bonus: number;
  usedBouton: boolean;
  usedPile: boolean;
  hits: number;
  falls: number;
  outcome: FinalV2Route | null;
  tabLeaves: number;
  cracks: Array<Array<[number, number]>>;
  t: number;
  drowned: string[];
  inkTries: number;
  friends: string[];
  friendVisits: number;
  stage: StageFriend[];
  nbWords: WordDef[];
  nbWriting: boolean;
  recolorNext: number;
  recolorLeft: number;
  recolorEmo: Emotion;
  recolorBy: StageFriend | null;
  wasDodge: boolean;
  lastHp: number;
  /** OUVRIR LES YEUX was announced. */
  ready: boolean;
  /** The little girl in the knitted hat, standing beside Noa (phase 4): alpha. */
  bonnet: number;
  tick: (() => void) | null;
}

const MAX_SLEEP = 0.62;
/** Cracks (words + items) needed before ÉPARGNER becomes OUVRIR LES YEUX. */
const WAKE_AT = 5;
/** Sleep added by each hit taken in phases 3 and 4. */
const SLEEP_PER_HIT = 0.045;
const LABELS = ['FRAPPER', 'ÉCRIRE', 'OBJET', 'ÉPARGNER'];
const P2_ORDER = [0, 2, 3];
/** Mina's words drowned first by the player's ink (one per 3 Encre, at most two: the goodbye stays possible). */
const DROWN_ORDER = ['merci', 'lumière'];

/** Number of words drowned in ink in phase 4 (one per 3 Encre, at most two, never below WAKE_AT readable). */
export function drownedCountV2(encre: number): number {
  return Math.max(0, Math.min(Math.floor(encre / 3), MINA_WORDS_V2.length - WAKE_AT - 1, DROWN_ORDER.length));
}

/** Sheep of phase 1: one per death of the player, up to 41; no death at all, 41 (her nights). */
export function sheepFor(deaths: number): number {
  return deaths > 0 ? Math.min(41, deaths) : 41;
}

const TALK: Record<string, string[]> = {
  p1: ['Un mouton… deux moutons…', 'Chut. Ici, personne ne se dispute.', 'Tu es fatigué. Je le sais. Je suis toi.', 'Tu reconnais ma voix ? C\'est la tienne.'],
  p2: ['Dors.', 'Reste avec moi, {player}.', 'Tant que tu joues, elle existe.', 'Pourquoi se réveiller ?', 'Il fait si chaud, dans le coton.'],
  p3: ['…', 'Tu l\'entends ?', 'C\'est le radiateur.', 'Ne réponds pas.'],
  p4: ['Arrête… ces mots-là…', 'Ce n\'est pas ton écriture !', 'Si tu te réveilles, tu la perds.', 'Je voulais juste que tu n\'aies plus mal.', 'Elle n\'est plus là. ELLE N\'EST PLUS LÀ.'],
  ready: ['…', 'Tu es sûr ?', 'Il fera froid, dehors.'],
  silence: ['Dors.', 'Il n\'y a plus rien.', 'Plus personne.'],
};

const SLEEP_LINES = ['Voilà. C\'est bien.', 'Doucement…', 'Encore un peu.', 'Tu vois ? C\'est facile.'];

/** Dodo, when one of his words (those of the call) is written. */
const DODO_WORD_LINES: Record<string, string> = {
  'Dors.': 'Voilà. C\'est le mot. Tu le connais.',
  'Arrête d\'appeler.': 'Tu entends comme ça sonne, écrit ?',
  'Demain.': 'Demain. Il n\'y a pas eu de demain.',
  'Promis.': 'Promis promis.',
  reste: 'Je reste. Toujours.',
  oublie: 'On oublie tout, ici. Même ce qui fait mal.',
};

/** Dodo cracks, she answers: one pair per word of her notebook. */
const MINA_PAIRS: Record<string, [string, string[]]> = {
  'je suis là': ['Elle ne peut pas t\'entendre. Elle n\'entend plus rien.', ['Je sais que t\'es là.', 'Deux coups. C\'était toi, ou le radiateur ? …On s\'en fiche. Ça voulait dire pareil.']],
  'bonne nuit': ['C\'est MOI qui dis bonne nuit. C\'est moi, la voix.', ['Bonne nuit, Noa.', 'Pour de vrai. Pas pour toujours. Juste pour cette nuit.']],
  merci: ['Merci ? Il n\'est pas venu. Il n\'y a rien à remercier.', ['Merci pour Dodo.', 'Il sentait ta chambre. Je dormais mieux, avec.']],
  pardon: ['Pardon, c\'est à moi qu\'il le dit. Tous les soirs. À moi.', ['Pardon pour quoi ? T\'avais peur.', 'Moi aussi, j\'avais peur. On avait le droit.']],
  'au revoir': ['Pas au revoir. Bonne nuit. Juste bonne nuit, et on recommence.', ['Au revoir, c\'est pas un mot triste.', 'C\'est pour ceux qui restent. Toi, tu restes.']],
  'je t\'aime': ['Elle disait ça au téléphone. Avant de raccrocher.', ['Moi aussi.', 'Gros comme le Pays de Coton. Plus gros, même.']],
  lumière: ['Éteins. ÉTEINS. Elle était allumée, ta lumière. Chez toi.', ['Garde-la allumée, si tu veux.', 'C\'était la tienne, d\'abord. Je l\'ai toujours su.']],
  matin: ['Le matin, elle n\'est plus là. Le matin, c\'est vrai.', ['Il fait bientôt jour, Noa.', 'Regarde. Le ciel devient tout pâle.']],
};


// ---------------------------------------------------------------------------------------------------------------------
// Knocks (phase 3)
// ---------------------------------------------------------------------------------------------------------------------

/** Her knocks and the radiator's, for each round. S = a knock in the wall, B = the radiator pipe, H = she hesitates. */
const KNOCKS: Record<'A' | 'B' | 'rien', SheepKind[][]> = {
  A: [
    ['B', 'S', 'B', 'B'],
    ['B', 'B', 'H', 'B'],
    ['S', 'B', 'B', 'B', 'B'],
  ],
  B: [
    ['S', 'B', 'S', 'B', 'S'],
    ['B', 'S', 'S', 'B', 'H'],
    ['S', 'B', 'B', 'S', 'B', 'S'],
  ],
  rien: [['B', 'B', 'Z', 'B']],
};

/** The round played in the counting scene: blind (the arena is black), or slow and in plain view once she helps. */
export function knockRound(round: 'A' | 'B' | 'rien', helped: boolean): SheepRound {
  if (helped) return { title: 'Le mur', interval: 110, window: 20, tolerance: 99, blind: false, seqs: [round === 'A' ? ['S'] : ['S', 'S', 'S']] };
  return { title: 'Dans le noir', interval: 64, window: 16, tolerance: 99, blind: true, seqs: KNOCKS[round] };
}

// ---------------------------------------------------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------------------------------------------------

/** A tally of pen strokes (groups of five, the fifth across): the sheep counted in phase 1. */
function drawTally(g: CanvasRenderingContext2D, n: number, total: number): void {
  const x0 = 12;
  const y0 = 6;
  for (let i = 0; i < total; i++) {
    const grp = Math.floor(i / 5);
    const k = i % 5;
    const x = x0 + (grp % 9) * 15 + k * 3;
    const y = y0 + Math.floor(grp / 9) * 12;
    const done = i < n;
    g.fillStyle = done ? '#e2d6b4' : '#3b322f';
    if (k < 4) g.fillRect(x, y, 1, 8);
    else for (let j = 0; j < 13; j++) g.fillRect(x - 12 + j, y + 6 - Math.floor(j / 2.2), 1, 1);
  }
}

/** The pencil princess on her strings, held up by Dodo's paw (the lying turn). */
function drawPuppet(g: CanvasRenderingContext2D, b: Battle, e: EnemyRuntime, t: number): void {
  if (!hasSpr('b_c6_princesse')) return;
  const o = b.spriteOffset(e);
  const sway = Math.sin(t * 0.08) * 6;
  const px = Math.round(e.x + 46 + sway + o.dx);
  const py = Math.round(e.y - 16 + Math.sin(t * 0.16) * 2);
  const hand = { x: e.x + 30 + o.dx, y: e.y - 70 };
  g.fillStyle = '#d9cbb5';
  for (const dx of [-6, 0, 6]) {
    const tx = px + dx;
    const ty = py - 26;
    const n = Math.max(1, Math.round(Math.hypot(tx - hand.x, ty - hand.y)));
    for (let i = 0; i <= n; i += 1) g.fillRect(Math.round(hand.x + ((tx - hand.x) * i) / n), Math.round(hand.y + ((ty - hand.y) * i) / n), 1, 1);
  }
  drawSprite(g, spr('b_c6_princesse'), px, py);
}

/** A subtitle under Dodo, as in a film: the line of the call he made you write. */
function drawSubtitle(g: CanvasRenderingContext2D, s: V2State): void {
  const st = s.subtitle;
  if (!st) return;
  st.t++;
  if (st.t > 200) {
    s.subtitle = null;
    return;
  }
  const a = Math.min(1, st.t / 10, (200 - st.t) / 30);
  const text = `— ${tr(st.text)}`;
  const w = measure(text);
  g.globalAlpha = 0.75 * a;
  g.fillStyle = '#000000';
  g.fillRect(Math.round(W / 2 - w / 2 - 4), 71, w + 8, 12);
  g.globalAlpha = a;
  drawText(g, text, Math.round(W / 2 - w / 2), 73, { color: '#fffaf2' });
  g.globalAlpha = 1;
}

/** Arena darkness (phase 3), sleep darkness, under the box and the HUD. */
function drawBackdrop(g: CanvasRenderingContext2D, b: Battle, s: V2State): void {
  s.t++;
  if (s.black > 0) {
    g.fillStyle = `rgba(0,0,0,${Math.min(1, s.black).toFixed(3)})`;
    g.fillRect(0, 0, W, 84);
    // A heartbeat in the dark, very faint.
    const beat = s.t % 84;
    if (beat < 10 && !G.settings.reduceFlashes) {
      g.fillStyle = `rgba(120,20,30,${(0.08 * s.black * Math.sin((beat / 10) * Math.PI)).toFixed(3)})`;
      g.fillRect(0, 0, W, 84);
    }
  }
  // The little girl in the knitted hat, beside Noa, facing Dodo (phase 4).
  if (s.bonnet > 0 && hasSpr('b_bonnet') && b.mode !== 'notebook') {
    const writing = s.t % 90 < 12;
    drawSprite(g, spr(writing && hasSpr('b_bonnet_2') ? 'b_bonnet_2' : 'b_bonnet'), 36, 83, { alpha: Math.min(1, s.bonnet) * 0.92 });
  }
}

function drawOverlay(g: CanvasRenderingContext2D, b: Battle, s: V2State): void {
  const e = b.enemies[0];
  // Light leaking through the cracks of the torn Dodo.
  if (e && s.phase === 4 && !s.silence && e.def.sprite === 'b_dodo_torn' && !e.hidden && b.mode !== 'notebook') {
    const pulse = 0.65 + 0.35 * Math.sin(s.t * 0.12);
    const o = b.spriteOffset(e);
    for (const c of s.cracks) {
      for (let i = 0; i + 1 < c.length; i++) {
        const [x0, y0] = c[i]!;
        const [x1, y1] = c[i + 1]!;
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
        for (let k = 0; k <= n; k++) {
          const px = Math.round(e.x + o.dx + x0 + ((x1 - x0) * k) / n);
          const py = Math.round(e.y + o.dy + y0 + ((y1 - y0) * k) / n);
          g.globalAlpha = 0.35 * pulse;
          g.fillStyle = '#ffe991';
          g.fillRect(px - 1, py - 1, 3, 3);
          g.globalAlpha = 1;
          g.fillStyle = '#fff3cf';
          g.fillRect(px, py, 1, 1);
        }
      }
    }
  }
  if (e && s.phase === 2 && s.lieNow && b.mode !== 'notebook') drawPuppet(g, b, e, s.t);
  if (s.phase === 1 && b.mode !== 'notebook') drawTally(g, CH6.counted, s.sheep);
  if (s.phase === 2 && b.mode !== 'notebook') drawSubtitle(g, s);
  // Sleep: everything grows dark.
  if (s.sleep > 0) {
    const k = b.mode === 'notebook' ? 0.45 : 1;
    g.fillStyle = `rgba(5,2,10,${(s.sleep * k).toFixed(3)})`;
    g.fillRect(0, 0, W, 154);
    g.fillStyle = `rgba(5,2,10,${(s.sleep * 0.45).toFixed(3)})`;
    g.fillRect(0, 154, W, H - 154);
  }
  // Dawn: a pale light grows with her words.
  const n = s.written.length + s.bonus;
  if (s.phase === 4 && !s.silence && n) {
    g.fillStyle = `rgba(255,224,170,${Math.min(0.16, n * 0.026).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
  }
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
      drawText(g, tr('dors · dors · dors · dors · dors'), x + 24, y + h - 13, { color: '#9a7bd0' });
    } else if (s.phase === 4 && !s.silence) {
      g.fillStyle = '#fff6e0';
      g.fillRect(x + 22, y + h - 15, w - 26, 12);
      drawText(g, tr('Écris avec moi. — M.'), x + 24, y + h - 13, { color: '#7d6f86' });
      if (!s.nbWriting) {
        s.nbWords.forEach((wd, i) => {
          if (isBlot(wd.text)) drawBlot(g, x + 34 + (i % 2) * 100, y + 51 + Math.floor(i / 2) * 25, measure(wd.text), s.t, i);
        });
      }
      // A knitted hat with two sheep ears, in pencil, in the margin.
      g.fillStyle = '#7d6f86';
      g.fillRect(x + 6, y + h - 22, 8, 1);
      g.fillRect(x + 5, y + h - 25, 1, 3);
      g.fillRect(x + 14, y + h - 25, 1, 3);
      g.fillRect(x + 6, y + h - 27, 8, 1);
      g.fillRect(x + 3, y + h - 25, 2, 2);
      g.fillRect(x + 15, y + h - 25, 2, 2);
    } else if (s.phase === 4 && s.silence) {
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

// ---------------------------------------------------------------------------------------------------------------------
// The hooks
// ---------------------------------------------------------------------------------------------------------------------

const STATES = new WeakMap<Battle, V2State>();

function newState(): V2State {
  return {
    phase: 1,
    silence: isSilenceRoute(),
    sleep: 0,
    sheep: sheepFor(G.meta.deaths),
    p2: 0,
    dodoWords: 0,
    lied: false,
    lieNow: false,
    subtitle: null,
    knock: 'A',
    knockErrors: 0,
    knockTries: 0,
    black: 0,
    p4: 0,
    written: [],
    bonus: 0,
    usedBouton: false,
    usedPile: false,
    hits: 0,
    falls: 0,
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
    lastHp: -1,
    ready: false,
    bonnet: 0,
    tick: null,
  };
}

const st = (b: Battle): V2State => {
  let s = STATES.get(b);
  if (!s) {
    s = newState();
    STATES.set(b, s);
  }
  return s;
};

const dodo = (b: Battle): EnemyRuntime => b.enemies[0]!;

function muffle(s: V2State): void {
  audio.setMuffle(1 - s.sleep * 1.1, 0.8);
  audio.tempoScale = 1 - s.sleep * 0.35;
}

function unhook(s: V2State): void {
  if (!s.tick) return;
  const i = game.hooks.indexOf(s.tick);
  if (i >= 0) game.hooks.splice(i, 1);
  s.tick = null;
}

/** Dodo's attack grows with the player's max HP, so that many Étoiles do not make the last phases trivial. */
function scaleAtk(b: Battle, base: number, per: number): void {
  const e = dodo(b);
  e.def = { ...e.def, atk: base + Math.round(b.maxHp / per) };
}

/** Dodo's HP: what is left to crack (knocks answered, words written, items), as a bar. */
function showHp(b: Battle, s: V2State): void {
  const e = dodo(b);
  const knocks = s.knock === 'done' ? 2 : s.knock === 'B' ? 1 : 0;
  const done = Math.min(WAKE_AT, s.written.length + s.bonus) + knocks;
  e.hp = Math.max(1, Math.round(e.maxHp * (1 - done / (WAKE_AT + 2))));
  e.hpBarT = 90;
}

/** Ends the battle on a route. */
function finish(b: Battle, s: V2State, route: FinalV2Route): void {
  s.outcome = route;
  G.state.flags.fin_route = route;
  b.end('scripted');
}

// --- Phase transitions ---

function tear(b: Battle, s: V2State): void {
  const e = dodo(b);
  e.def = {
    ...e.def,
    sprite: 'b_dodo_torn',
    scale: 1.15,
    check: 'Ses coutures ont lâché. Il veut que Noa dorme. Tout ce que tu choisis le rend plus fort.',
    flavor: [
      '* Tout est lourd. Même tes pensées.',
      '* Le rembourrage gris pend jusqu\'au sol. Il goutte.',
      '* L\'œil-bouton se balance. Tic. Tac. Il te regarde à chaque passage.',
      '* Quelque part, une berceuse joue au ralenti.',
    ],
  };
  scaleAtk(b, 3, 16);
  s.phase = 2;
  CH6_BG.rot = 0.4;
}

async function toPhase2(b: Battle, s: V2State): Promise<void> {
  const e = dodo(b);
  await b.bubble([{ e, text: 'Tu ne veux pas te battre, Noa.' }]);
  await b.bubble([{ e, text: 'Tu veux dormir.' }]);
  director.sfx('thread', { pitch: 0.5 });
  director.sfx('stitch', { pitch: 0.5 });
  fx.flash('#3a1c2c', 20, 0.7);
  fx.shake(3, 40);
  e.flash = 20;
  tear(b, s);
  await b.say('* Les coutures de Dodo s\'ouvrent, une à une. Le fil rouge saute.\n* Le rembourrage pend. Un œil-bouton se balance au bout de son fil.');
}

function blacken(b: Battle, s: V2State): void {
  s.phase = 3;
  s.black = 1;
  s.knock = s.silence ? 'A' : ['deux', 'trois'].includes(String(G.state.flags.i4_knock ?? '')) ? 'B' : 'A';
  scaleAtk(b, 3, 14);
  CH6_BG.rot = 0.6;
}

async function toPhase3(b: Battle, s: V2State): Promise<void> {
  await b.say('* Le carnet se ferme tout seul. Clac.');
  audio.stopMusic(2);
  for (let i = 0; i < 30; i++) {
    s.black = i / 29;
    await game.wait(2);
  }
  blacken(b, s);
  await b.say('* Tout devient noir. Plus de laine, plus de carnet. Rien.');
  await game.wait(40);
  if (s.silence) {
    director.sfx('pipe', { vol: 0.7 });
    await b.say('* Tu attends un coup dans le mur. Il ne vient pas.\n* Seul le radiateur cogne, quelque part.');
  } else {
    director.sfx('knock1', { vol: 0.9 });
    fx.shake(1, 6);
    await b.say('* Et puis, dans le noir : toc.\n* Quelqu\'un frappe. Derrière un mur.');
  }
  await b.say('* {c:y}Le bouton FRAPPER revient.{/c}\n* Pas pour frapper Dodo.');
}

function lighten(b: Battle, s: V2State): void {
  s.phase = 4;
  s.knock = 'done';
  s.black = 0;
  scaleAtk(b, 4, 8);
  CH6_BG.rot = 0.75;
  const e = dodo(b);
  e.def = {
    ...e.def,
    check: s.silence ? 'Il n\'y a plus rien à lui dire. Tout est noyé.' : 'Il a peur que tu partes. Ses mots à elle le fissurent.',
    flavor: s.silence
      ? ['* L\'encre monte. Elle n\'a plus de fond.', '* Il n\'y a plus de couleurs.', '* Le silence est très grand.']
      : ['* Des fissures de lumière courent sur la laine jaunie.', '* Le carnet est tiède, comme une main.', '* Tu entends un crayon de papier sur une feuille.', '* Quelque part, quelqu\'un fredonne la berceuse. Juste.'],
  };
}

async function toPhase4(b: Battle, s: V2State): Promise<void> {
  const e = dodo(b);
  lighten(b, s);
  if (s.silence) {
    await b.say('* Le noir reste. Le carnet s\'ouvre quand même.\n* Sur la page, il y avait des mots. Ils sont noyés d\'encre.');
    await b.bubble([{ e, text: 'Tu cherches quelqu\'un ?' }]);
    return;
  }
  for (let i = 0; i < 40; i++) {
    s.black = 1 - i / 39;
    s.bonnet = i / 39;
    await game.wait(2);
  }
  await b.say('* Le noir se déchire, tout doucement, comme du papier mouillé.\n* À côté de toi, quelqu\'un. Un bonnet à oreilles de mouton.');
  audio.playMusic('title', { fadeIn: 3, fadeOut: 2 });
  s.sleep = Math.max(0, s.sleep - 0.2);
  muffle(s);
  s.drowned = DROWN_ORDER.slice(0, drownedCountV2(G.state.encre));
  s.friends = friendQueue(G.state.spares, s.drowned.length);
  await b.say('* Le carnet s\'ouvre tout seul. Ce n\'est pas ton écriture.\n* Une écriture au crayon de papier. Appliquée. Fatiguée.');
  await director.say(['T\'as répondu.', 'Maintenant, écris avec moi, gros bêta. On a encore des choses à se dire.'], 'bonnet');
  if (s.drowned.length) {
    director.sfx('glitch', { vol: 0.5 });
    await b.say(
      s.drowned.length > 1
        ? "* Mais sur la page, deux mots sont noyés d'encre.\n* Tu reconnais cette encre. C'est la tienne."
        : "* Mais sur la page, un mot est noyé d'encre.\n* Tu reconnais cette encre. C'est la tienne.",
    );
    await director.say(['Y a des mots que j\'arrive plus à dire. C\'est tout taché.', 'Mais les autres sont encore là.'], 'bonnet');
  }
  showHp(b, s);
}

// --- Actions ---

async function offerStay(b: Battle, s: V2State): Promise<void> {
  await director.say(['Tu vois ? C\'est facile.', 'Il suffit de ne plus ouvrir les yeux.'], 'dodotorn:happy');
  b.setText(null);
  const r = await director.ask('Rester ici, avec Dodo ?', ['Rester', '…Non'], 'dodotorn:creepy', { cancelIndex: 1 });
  if (r === 0) {
    finish(b, s, 'beaux_reves');
    return;
  }
  s.sleep = 0.3;
  muffle(s);
  await b.say('* Tu te mords la joue. Tu rouvres les yeux.\n* Pas encore.');
}

async function sleepAction(b: Battle, s: V2State): Promise<void> {
  const e = dodo(b);
  s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.14);
  muffle(s);
  e.hp = e.maxHp;
  e.hpBarT = 90;
  b.heal(4);
  await b.say('* Tu fermes les yeux. Juste un instant.\n* C\'est doux. C\'est chaud. Ça sent ta chambre.\n* Dodo reprend des forces.');
  await b.bubble([{ e, text: SLEEP_LINES[Math.floor(s.t / 7) % SLEEP_LINES.length]! }]);
  if (s.sleep >= MAX_SLEEP - 0.001 && !s.silence) await offerStay(b, s);
}

async function stayAction(b: Battle, s: V2State): Promise<void> {
  b.setText(null);
  const r = await director.ask('Rester ici ? Pour toujours ?', ['Rester', 'Pas encore'], 'dodotorn:happy', { cancelIndex: 1 });
  if (r === 0) {
    finish(b, s, 'beaux_reves');
    return;
  }
  await b.say('* La porte reste entrouverte. Tu n\'y vas pas. Pas encore.');
}

/** Phase 3: FRAPPER — listen to the wall in the dark, then knock back. */
async function knockAction(b: Battle, s: V2State): Promise<void> {
  const e = dodo(b);
  const helped = s.knockErrors >= 2 && !s.silence;
  const round = s.silence ? 'rien' : s.knock === 'B' ? 'B' : 'A';
  await b.say(
    helped
      ? '* Dans le noir, une petite silhouette s\'approche du mur.\n* Un bonnet à oreilles de mouton. Elle lève la main. Lentement.'
      : '* Tu poses ta main à plat sur le mur. Il est froid.\n* Tu écoutes.',
  );
  await director.fadeOut(16);
  const scene = CountingScene.open('coups', [knockRound(round, helped)]);
  if (helped) scene.visitor = 'b_bonnet';
  scene.announce(1);
  await director.fadeIn(16);
  await scene.play(1, s.knockTries++);
  await director.say('Tu lèves la main vers le mur.');
  const n = await scene.answer();
  await game.wait(20);
  await director.fadeOut(16);
  scene.close();
  await director.fadeIn(16);
  if (s.silence) {
    await b.say('* Tu frappes. Rien ne répond.\n* Il n\'y avait personne derrière le mur. Seulement le chauffage.');
    await toPhase4(b, s);
    return;
  }
  const want = round === 'A' ? 2 : 3;
  if (n === want) {
    director.sfx('chime', { pitch: 0.8, vol: 0.6 });
    e.shake = 30;
    if (round === 'A') {
      s.knock = 'B';
      showHp(b, s);
      await b.say('* Toc, toc. « Je suis là. »');
      await b.bubble([{ e, text: 'Arrête. Elle ne peut pas t\'entendre.' }]);
      await game.wait(40);
      director.sfx('knock1', { vol: 0.7 });
      await game.wait(26);
      director.sfx('knock1', { vol: 0.7 });
      await game.wait(26);
      director.sfx('knock1', { vol: 0.7 });
      await b.say('* De l\'autre côté, un silence.\n* Puis trois coups. Tout doucement.');
      return;
    }
    await b.say('* Toc, toc, toc. « Bonne nuit. »');
    await b.bubble([{ e, text: '…Bonne nuit.' }]);
    await toPhase4(b, s);
    return;
  }
  // A wrong answer: Dodo gets HP back; it starts again.
  s.knockErrors++;
  s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.06);
  muffle(s);
  e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.15));
  e.hpBarT = 90;
  director.sfx('pipe', { pitch: 0.7 });
  if (n === 1) await b.say('* Toc.\n* Tu lui renvoies sa question. Elle attendait une réponse.');
  else if (round === 'A') await b.say('* Toc, toc, toc. « Bonne nuit. »\n* Elle demandait si tu étais là. Tu lui as dit de dormir.');
  else await b.bubble([{ e, text: 'Deux ? Tu étais là, peut-être. Mais tu n\'es pas venu.' }]);
  await b.say('* Dodo reprend des forces.');
  if (s.knockErrors === 2) await b.say('* Quelque chose bouge dans le noir, près du mur.\n* Quelqu\'un de petit.');
}

async function openEyes(b: Battle, s: V2State): Promise<void> {
  const e = dodo(b);
  await b.bubble([{ e, text: 'Attends.' }]);
  await director.say(['Si tu ouvres les yeux, elle s\'en va. Pour de vrai.', 'Et ce ne sera la faute de personne. Tu comprends ? De personne.'], 'dodotorn:creepy');
  await director.say('Ici, au moins, c\'est ta faute. Ici, elle reste un peu.', 'dodotorn:sad');
  b.setText(null);
  const r = await director.ask('Dodo te tend la patte. Derrière lui, la nuit est si douce.', ['Ouvrir les yeux', 'Rester']);
  if (r !== 0) {
    finish(b, s, 'beaux_reves');
    return;
  }
  // Dodo, small again: a plush, worn out, torn.
  e.def = { ...e.def, scale: 0.85, flavor: ['* Dodo est tout petit, maintenant. Un mouton en peluche, décousu, qui sent ta chambre.'] };
  e.flash = 30;
  fx.flash('#fff3cf', 30, 0.7);
  CH6_BG.rot = 0.3;
  await b.say('* Le coton se tait. Le module ne grésille plus.\n* Dodo est tout petit. Un mouton en peluche, décousu.');
  await director.say('Elle m\'a dit de veiller sur toi. J\'ai cru que ça voulait dire : la nuit.', 'dodotorn:sad');
  await director.say('On était trop petits. Tous les deux.', 'noa:sad');
  await chorus(b, s);
  await b.say('* Tu ouvres les yeux.');
  finish(b, s, 'aube');
}

async function silenceEnd(b: Battle, s: V2State): Promise<void> {
  const e = dodo(b);
  await b.bubble([{ e, text: 'Tu ne peux plus les lire, hein ?' }]);
  fx.glitch = 0.2;
  await director.say(['Regarde ce que tu as fait.', 'Il n\'y a plus personne à qui dire au revoir.'], 'dodotorn:creepy');
  fx.glitch = 0;
  finish(b, s, 'silence');
}

// --- Cracks, ink, friends (phase 4) ---

function lightCrack(b: Battle, s: V2State, n: number): boolean {
  const e = dodo(b);
  if (e.def.sprite !== 'b_dodo_torn') return false;
  for (let i = 0; i < n; i++) s.cracks.push(makeCrack());
  e.shake = 24 + n * 8;
  e.flash = 8;
  fx.shake(2, 12 + n * 4);
  director.sfx('shatter', { pitch: 1.3, vol: 0.6 });
  s.sleep = Math.max(0, s.sleep - 0.06 * n);
  muffle(s);
  return true;
}

/** The OUVRIR LES YEUX moment: enough cracks. */
async function maybeReady(b: Battle, s: V2State): Promise<void> {
  if (s.written.length + s.bonus < WAKE_AT || s.ready) return;
  s.ready = true;
  const e = dodo(b);
  e.flash = 30;
  fx.flash('#fff3cf', 30, 0.8);
  CH6_BG.rot = 0.5;
  await b.say('* Les coutures lâchent toutes en même temps.\n* Dedans, il n\'y a que du coton. Et un petit boîtier en plastique.');
  await b.say('* {c:y}La lumière passe à travers les fissures.\n* Tu peux OUVRIR LES YEUX.{/c}');
}

async function crack(b: Battle, s: V2State, w: WordDef): Promise<void> {
  const e = dodo(b);
  s.written.push(w.text);
  s.cracks.push(makeCrack(), makeCrack());
  e.shake = 40;
  e.flash = 10;
  fx.shake(4, 24);
  director.sfx('shatter', { pitch: 0.8 + s.written.length * 0.08 });
  s.sleep = Math.max(0, s.sleep - 0.16);
  muffle(s);
  const pair = MINA_PAIRS[w.text];
  if (pair) {
    await b.bubble([{ e, text: pair[0] }]);
    await director.say(pair[1], 'bonnet');
  }
  showHp(b, s);
  const n = s.written.length + s.bonus;
  if (n >= WAKE_AT) await maybeReady(b, s);
  else if (s.written.length === 1) await b.say('* Dodo se fissure. La lumière passe.\n* {c:y}Le bouton OBJET revient.{/c}');
  else if (s.written.length === 2) await b.say('* Une autre fissure.\n* Un bouton change encore : RESTER. Comme une porte qu\'on laisse ouverte.');
  else await b.say('* Dodo se fissure de partout. Le coton tombe en flocons.');
}

async function inkWritten(b: Battle, s: V2State, e: EnemyRuntime): Promise<void> {
  const i = s.inkTries++;
  director.sfx('glitch', { pitch: 0.6, vol: 0.5 });
  fx.flash('#0b0710', 16, 0.5);
  s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.06);
  muffle(s);
  await b.bubble([{ e, text: INK_CUTS[i % INK_CUTS.length]! }]);
  await b.say(INK_SILENCES[Math.min(i, INK_SILENCES.length - 1)]!);
  if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b, s);
}

const healFor = (b: Battle): number => Math.max(4, Math.round(b.maxHp * 0.25));

function healText(b: Battle, n: number, text: string): string {
  const before = b.hp;
  b.heal(n);
  const got = b.hp - before;
  const t = tr(text);
  return translated(got > 0 ? t.replace('{n}', String(got)) : t.replace(/ [^.!?\n]*\{n\}[^.!?\n]*\./, ''));
}

/** Where friends stand around Dodo in this arena (the little girl in the hat keeps the far left). */
const STAGE_V2 = [94, 240, 278, 70, 306, 214];

function onStage(s: V2State, f: Friend, slot: number): StageFriend {
  const sf: StageFriend = { sprite: f.sprite, x: STAGE_V2[slot % STAGE_V2.length]!, y: f.y ?? 80, scale: f.scale ?? (f.boss ? 0.8 : 0.7), born: s.t, gone: null };
  s.stage.push(sf);
  return sf;
}

const leave = (s: V2State, sf: StageFriend | null): void => {
  if (sf && sf.gone === null) sf.gone = s.t;
};

function gift(b: Battle, s: V2State, f: Friend, sf: StageFriend): string {
  const fallback = '* La nuit s\'éclaire un peu autour de toi. Tu récupères {n} PV.';
  if (f.gift === 'heal') return healText(b, healFor(b), f.act);
  if (f.gift === 'crack') return lightCrack(b, s, 1) ? tr(f.act) : healText(b, healFor(b), fallback);
  if (f.gift === 'recolor') {
    if (s.written.length + s.bonus >= WAKE_AT) return healText(b, healFor(b), fallback);
    s.recolorNext = 900;
    leave(s, s.recolorBy);
    s.recolorBy = sf;
    return tr(f.act);
  }
  if (f.gift === 'placard') {
    lightCrack(b, s, 3);
    fx.flash('#fff3cf', 36, 0.85);
    director.sfx('door', { pitch: 0.7 });
    s.sleep = 0;
    muffle(s);
    b.heal(b.maxHp);
    return tr(f.act);
  }
  const word = s.drowned.shift();
  if (word) {
    lightCrack(b, s, 1);
    fx.flash('#fff6e0', 24, 0.6);
    director.sfx('chime', { pitch: 1.2 });
    return tf("* Frrrt, frrrt. Elle frotte la tache d'encre.\n* De toutes ses forces.\n* Dessous, un mot revient : « {0} ».", tr(word));
  }
  return lightCrack(b, s, 2) ? tr(f.act) : healText(b, healFor(b), fallback);
}

async function visit(b: Battle, s: V2State): Promise<void> {
  const slots = Math.max(0, WAKE_AT - s.written.length - s.bonus);
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
    const sf = onStage(s, f, i === 0 ? k % 2 : i === 1 ? (k + 1) % 2 : 2 + (k % 2));
    shown.push(sf);
    director.sfx('chime', { pitch: 0.9 + i * 0.15, vol: 0.5 });
    await game.wait(18);
    if (f.intro) await b.say(f.intro);
    const name = `{c:${f.col}}${tf('{0} :', tr(f.name))}{/c} `;
    if (f.boss) {
      await b.say(translated(`${name}${tr(f.line)}`), false, true, f.voice);
      const erased = f.gift === 'gomme' && s.drowned.length > 0;
      await b.say(gift(b, s, f, sf));
      const cry = f.gift === 'placard' ? 'Fermez ça ! FERMEZ ÇA !' : erased ? 'Non ! Cette encre, il l\'a méritée !' : 'Non ! Ça, c\'était à moi !';
      await b.bubble([{ e, text: cry }]);
    } else {
      const act = gift(b, s, f, sf);
      await b.say(translated(`${name}${tr(f.line)}\n${act}`), false, true, f.voice);
    }
  }
  for (const sf of shown) if (sf !== s.recolorBy) leave(s, sf);
  showHp(b, s);
}

async function chorus(b: Battle, s: V2State): Promise<void> {
  const fs = s.friends.map(FRIEND).filter((f): f is Friend => !!f);
  s.friends = [];
  if (!fs.length) return;
  fs.forEach((f, i) => onStage(s, f, i));
  director.sfx('chime', { pitch: 1.1 });
  if (fs.length === 1) {
    await b.say(tf('* {0} est encore là, derrière toi.\n* Un petit signe. Bonne route, Noa.', tr(fs[0]!.name)));
    return;
  }
  const names = wrapList(listNames(fs.map((f) => tr(f.name))), '* ', '  ');
  const head = tr('* Derrière toi, il y a encore du monde :');
  const bye = tr('* Ils te font signe. Bonne route, Noa.');
  if (names.length <= 2) await b.say(translated([head, ...names, bye].join('\n')));
  else {
    await b.say(translated([head, ...names].join('\n')));
    await b.say(bye);
  }
}

/** Every frame: the notebook state (blots), the friends' recoloring, and every hit taken (it sinks Noa into sleep). */
function frame(b: Battle, s: V2State): void {
  if (b.ended) {
    unhook(s);
    return;
  }
  if (b.mode !== 'notebook') s.nbWriting = false;
  else if (input.pressed('a')) s.nbWriting = true;
  const dodge = b.mode === 'dodge';
  if (dodge && s.lastHp >= 0 && b.hp < s.lastHp && (s.phase === 3 || s.phase === 4) && !s.silence) {
    s.hits++;
    s.sleep = Math.min(MAX_SLEEP, s.sleep + SLEEP_PER_HIT);
    muffle(s);
  }
  s.lastHp = b.hp;
  if (dodge && !s.wasDodge && s.recolorNext > 0) {
    if (b.soulEmo === 'neutre') b.setEmotion('joie');
    s.recolorEmo = b.soulEmo;
    s.recolorLeft = s.recolorNext;
    s.recolorNext = 0;
  }
  if (!dodge && s.wasDodge) s.recolorLeft = 0;
  s.wasDodge = dodge;
  if (dodge && s.recolorLeft > 0) {
    for (const p of b.bw.bullets) {
      if (p.emo !== s.recolorEmo && !p.data.friend && !p.data.lie) {
        p.emo = s.recolorEmo;
        p.data.friend = 1;
      }
    }
    if (--s.recolorLeft === 0) {
      leave(s, s.recolorBy);
      s.recolorBy = null;
    }
  } else if (!dodge && s.recolorBy && s.recolorNext === 0) {
    leave(s, s.recolorBy);
    s.recolorBy = null;
  }
}

/** Fast-forward to a later phase (debug: FINAL_V2.from). */
function skipTo(b: Battle, s: V2State, from: 2 | 3 | 4): void {
  tear(b, s);
  s.p2 = 4;
  s.lied = true;
  if (from >= 3) blacken(b, s);
  if (from >= 4) {
    lighten(b, s);
    s.bonnet = s.silence ? 0 : 1;
    s.drowned = DROWN_ORDER.slice(0, drownedCountV2(G.state.encre));
    s.friends = friendQueue(G.state.spares, s.drowned.length);
  }
}

export const FINAL_V2_HOOKS: Partial<BattleHooks> = {
  beforeTurn: async (b, turn) => {
    const s = st(b);
    const e = dodo(b);
    if (turn === 1) {
      CH6.counted = 0;
      CH6.note = 0;
      CH6_BG.rot = 0.15;
      b.overlay = (g, bb) => drawOverlay(g, bb, s);
      b.backdrop = (g, bb) => drawBackdrop(g, bb, s);
      e.def = { ...e.def, atk: 2 };
      if (!s.tick) {
        const tick = (): void => frame(b, s);
        s.tick = tick;
        game.hooks.push(tick);
      }
      const from = FINAL_V2.from;
      FINAL_V2.from = 1;
      if (from > 1) {
        skipTo(b, s, from as 2 | 3 | 4);
        if (from === 3) audio.stopMusic(1);
        if (from === 4 && !s.silence) audio.playMusic('title', { fadeIn: 1 });
      }
    }
    b.lie = false;
    s.lieNow = false;
    if (G.meta.tabLeaves > s.tabLeaves) {
      s.tabLeaves = G.meta.tabLeaves;
      await b.bubble([{ e, text: 'Tu es parti. Je l\'ai senti.' }]);
      await b.bubble([{ e, text: 'Ne refais pas ça, {player}.' }]);
    }
    if (s.phase === 1) {
      if (turn === 1) {
        await director.say(['Tu es venu jusqu\'ici. Dans mon ventre.', 'Il fait chaud, hein ? C\'est ton coton. Celui que tu as gratté, tous les soirs.'], 'dodonoa:happy');
        if (G.meta.deaths > 0) await director.say(['Regarde. Des moutons.', 'Ce sont tes morts, {player}. Je les ai comptées.'], 'dodonoa:creepy');
        else await director.say(['Regarde. Des moutons.', 'Tu n\'es jamais mort·e, {player}. Alors je compte ses nuits.'], 'dodonoa:creepy');
      } else if (turn === 2) {
        await director.say(['Un mouton, deux moutons…', 'C\'est toi qui m\'as appris. Tous les soirs, tu comptais jusqu\'à ce que ça s\'arrête.'], 'dodonoa:neutral');
      } else if (turn === 3) {
        await director.say(['Je ne te veux pas de mal, Noa.', 'Je suis ta voix. Je dis ce que tu n\'oses pas dire.'], 'dodonoa:neutral');
        if (isLateNight()) await director.say('Il est {time}, {player}. Toi aussi, tu devrais dormir.', 'dodonoa:neutral');
      } else {
        await toPhase2(b, s);
      }
    }
    if (s.phase === 2 && !b.ended) {
      if (s.p2 >= 4 || (s.dodoWords >= 3 && s.p2 >= 3)) {
        await toPhase3(b, s);
      } else {
        s.p2++;
        const name = ['FRAPPER', 'OBJET', 'ÉPARGNER'][s.p2 - 1];
        director.sfx('glitch');
        if (name) await b.say(tf("* Le bouton {0} s'efface.\n* À sa place, quelqu'un a écrit : DORMIR.", tr(name)));
        else await b.say('* Il ne reste que ÉCRIRE.\n* Et le carnet ne contient plus que ses mots à lui.');
        if (s.p2 === 1) {
          await director.say(['Tant que c\'est ta faute, elle est encore un peu là.', 'Si ce n\'est la faute de personne… alors elle est juste partie.'], 'dodotorn:neutral');
        } else if (s.p2 === 2 && !s.lied) {
          s.lied = true;
          s.lieNow = true;
          b.lie = true;
          await director.say('Tu la reconnais ? C\'est elle qui l\'a dessinée. Sa princesse.', 'dodotorn:happy');
          await b.say('* Dodo agite la princesse au crayon au bout de ses fils.\n* Ses crayons ont l\'air jaunes. Ton cœur aussi, peut-être.');
          await b.bubble([{ e, text: 'Ici, même les couleurs mentent.' }]);
        }
      }
    }
    if (s.phase === 3 && !b.ended) {
      if (s.sleep >= MAX_SLEEP - 0.001 && !s.silence) await offerStay(b, s);
    }
    if (s.phase === 4 && !b.ended) {
      s.p4++;
      if (s.silence && s.p4 >= 3) await silenceEnd(b, s);
      else if (!s.silence) {
        if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b, s);
        if (!b.ended && s.written.length === 0 && s.p4 === 3) await director.say('Écris, Noa. Dans le carnet. Avec moi.', 'bonnet');
        if (!b.ended && s.p4 >= 2) await visit(b, s);
      }
    }
  },
  menuLabels: (b) => {
    const s = st(b);
    if (s.phase === 1) return LABELS;
    if (s.phase === 2) {
      const out = [...LABELS];
      for (let i = 0; i < Math.min(3, s.p2); i++) out[P2_ORDER[i]!] = 'DORMIR';
      return out;
    }
    if (s.phase === 3) return ['FRAPPER', 'DORMIR', 'DORMIR', 'DORMIR'];
    if (s.silence) return ['DORMIR', 'ÉCRIRE', 'DORMIR', 'DORMIR'];
    const n = s.written.length;
    return [n >= 2 ? 'RESTER' : 'DORMIR', 'ÉCRIRE', n >= 1 || s.bonus ? 'OBJET' : 'DORMIR', n + s.bonus >= WAKE_AT ? 'OUVRIR LES YEUX' : 'DORMIR'];
  },
  onMenu: async (b, i) => {
    const s = st(b);
    const label = b.menuLabels[i];
    if (label === 'DORMIR') {
      await sleepAction(b, s);
      return true;
    }
    if (label === 'RESTER') {
      await stayAction(b, s);
      return true;
    }
    if (label === 'OUVRIR LES YEUX') {
      await openEyes(b, s);
      return true;
    }
    if (label === 'FRAPPER' && s.phase === 3) {
      await knockAction(b, s);
      return true;
    }
    return false;
  },
  words: (b) => {
    const s = st(b);
    if (s.phase === 1) return null;
    if (s.phase === 2) return DODO_WORDS_V2;
    if (s.silence) return INK_WORDS;
    const left = MINA_WORDS_V2.filter((w) => !s.written.includes(w.text));
    s.nbWords = (left.length ? left : MINA_WORDS_V2).slice(0, 6).map((w) => (s.drowned.includes(w.text) ? inkOf(w.text) : w));
    return s.nbWords;
  },
  onWord: async (b, e, w) => {
    const s = st(b);
    e.progress = 0;
    e.step = 0;
    e.stepProgress = 0;
    e.agitation = 0;
    if (s.phase === 1) {
      const lines: Record<string, string> = {
        joie: 'Oui… c\'est joli. Tu vois qu\'on est bien, ici ?',
        tristesse: 'Chut. Ne sois pas triste. Ici, on n\'a pas le droit.',
        colere: 'Tu es fâché ? Contre qui ? …Contre toi ?',
        peur: 'N\'aie pas peur. Je suis là. C\'est moi qui frappe dans le mur, la nuit.',
        neutre: 'Ce mot-là ne réveille personne.',
      };
      await b.bubble([{ e, text: lines[w.emotion] ?? lines.neutre! }]);
      await b.say('* Les mots glissent sur sa laine mouillée sans y laisser de trace.');
      return true;
    }
    if (s.phase === 2) {
      s.dodoWords++;
      s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.06);
      muffle(s);
      s.subtitle = { text: w.text, t: 0 };
      await b.bubble([{ e, text: DODO_WORD_LINES[w.text] ?? 'Oui…' }]);
      await b.say(tf('* Tu écris « {0} ». Ta main est lourde. Les lettres penchent.', tr(w.text)));
      if (s.sleep >= MAX_SLEEP - 0.001) await offerStay(b, s);
      return true;
    }
    if (s.silence) {
      await silenceEnd(b, s);
      return true;
    }
    if (isBlot(w.text)) await inkWritten(b, s, e);
    else if (!s.written.includes(w.text) && MINA_PAIRS[w.text]) await crack(b, s, w);
    else {
      await b.bubble([{ e, text: 'Tu l\'as déjà dit…' }]);
      await director.say('Je l\'ai entendu, Noa. La première fois.', 'bonnet');
    }
    return true;
  },
  onFight: async (b, e) => {
    const s = st(b);
    s.hits++;
    await b.say('* Tu lèves ton crayon et tu frappes.');
    e.shake = 20;
    director.sfx('hit');
    await b.say('* Ton crayon s\'enfonce dans le coton mouillé, jusqu\'au poignet.\n* Il ne se passe rien.');
    await b.bubble([{ e, text: 'On ne frappe pas le sommeil.' }]);
    if (s.hits === 2) await b.bubble([{ e, text: 'Tu peux essayer toute la nuit. J\'ai trois cent soixante-cinq nuits.' }]);
    return true;
  },
  onSpare: async (b, e) => {
    void b;
    await b.bubble([{ e, text: 'M\'épargner ? Mais je ne te fais pas de mal, Noa.' }]);
    return true;
  },
  onItem: async (b, item) => {
    const s = st(b);
    const e = dodo(b);
    if (item === 'veilleuse_poche') {
      await b.say('* Tu sors la Veilleuse de poche. Une toute petite lune.');
      await b.bubble([{ e, text: 'Éteins ça.' }]);
      s.sleep = Math.max(0, s.sleep - 0.25);
      muffle(s);
      await b.say('* La nuit recule un peu autour de toi.');
      return true;
    }
    if (item === 'bouton_dore') {
      if (s.phase !== 4 || s.silence || s.usedBouton) {
        await b.say(s.usedBouton ? '* Le Bouton doré ne fait plus de bruit. Il a dit ce qu\'il avait à dire.' : '* Tu serres le Bouton doré. Il fait un tout petit bruit, comme un souffle.\n* Pas encore.');
        return true;
      }
      s.usedBouton = true;
      await b.say('* Tu serres le Bouton doré. Fort. Plus fort.\n* Quelque chose craque, dedans. Un tout petit haut-parleur.');
      director.sfx('static', { vol: 0.8 });
      await director.say('{static}…pas toi… gros bê…{/static}', 'minavoix');
      lightCrack(b, s, 3);
      s.bonus++;
      fx.flash('#ffe991', 24, 0.6);
      await b.bubble([{ e, text: 'Ce n\'est pas… Ce n\'est pas sa voix. C\'est un bouton.' }]);
      await b.say('* Une grande fissure traverse Dodo de haut en bas.');
      showHp(b, s);
      await maybeReady(b, s);
      return true;
    }
    if (item === 'pile_chargee') {
      if (s.phase !== 4 || s.silence || s.usedPile) {
        await b.say(s.usedPile ? '* La Pile est vide, maintenant. Elle a servi.' : '* La Pile chargée est tiède dans ta main.\n* Pas maintenant. Pas encore.');
        return true;
      }
      s.usedPile = true;
      await b.say('* Tu glisses la Pile chargée dans le ventre de Dodo, à côté du module.\n* Clic.');
      audio.setMuffle(1, 0.3);
      audio.tempoScale = 1;
      await game.wait(30);
      await director.say('Bonne nuit, Noa ! Dodo veille sur toi. Fais de beaux rêves.', 'dodo:happy');
      await game.wait(60);
      await director.say('…C\'était ça. Juste ça. Cinq secondes.', 'dodotorn:sad', { speed: 0.6 });
      s.sleep = 0;
      muffle(s);
      b.heal(b.maxHp);
      lightCrack(b, s, 2);
      s.bonus++;
      await b.say('* Pour la première fois depuis un an, la voix n\'a pas grésillé.\n* Tu récupères tous tes PV.');
      showHp(b, s);
      await maybeReady(b, s);
      return true;
    }
    return false;
  },
  pattern: (b, turn) => {
    const s = st(b);
    if (s.phase === 1) {
      // The sheep, spread over the three turns of the phase.
      const per = Math.ceil(s.sheep / 3);
      const left = Math.max(0, s.sheep - CH6.counted);
      b.prepareDodge({ mem: { n: turn >= 3 ? left : Math.min(per, left) } });
      return 'v2_moutons';
    }
    if (s.phase === 2) {
      if (s.lieNow) return 'v2_crayons';
      return ['v2_dors', 'v2_epingles', 'dodo_rings'][s.p2 % 3]!;
    }
    if (s.phase === 3) {
      b.prepareDodge({ mem: { code: s.silence ? 0 : s.knock === 'B' ? 3 : 1 } });
      return 'v2_coups_noir';
    }
    if (s.silence) return 'dodo_rings';
    if (s.written.length + s.bonus >= WAKE_AT) return 'calm';
    return ['v2_berceuse', 'v2_coutures', 'dodo_storm'][s.p4 % 3]!;
  },
  talk: (b) => {
    const s = st(b);
    const key =
      s.phase === 1 ? 'p1' : s.phase === 2 ? 'p2' : s.phase === 3 ? 'p3' : s.silence ? 'silence' : s.written.length + s.bonus >= WAKE_AT ? 'ready' : 'p4';
    const list = TALK[key]!;
    return list[Math.floor(s.t / 13) % list.length]!;
  },
  onDeath: async (b, e) => {
    e.hp = e.maxHp;
    await b.bubble([{ e, text: 'On ne frappe pas le sommeil.' }]);
    showHp(b, st(b));
    return true;
  },
  onPlayerDeath: async (b) => {
    const s = st(b);
    const e = dodo(b);
    s.falls++;
    b.hp = Math.max(1, Math.ceil(b.maxHp * 0.6));
    s.lastHp = b.hp;
    await b.bubble([{ e, text: 'Oh… tu es tombé.' }]);
    await b.bubble([{ e, text: 'Ce n\'est rien. Je te rattrape.' }]);
    await b.say('* Tu ne tombes pas. Tu t\'enfonces dans le coton.\n* Dodo te rend des forces. Pour que tu restes.');
    s.sleep = Math.min(MAX_SLEEP, s.sleep + 0.08);
    muffle(s);
    if (s.phase === 2) s.p2 = Math.max(s.p2, 3);
    return true;
  },
};

/**
 * Plays the final battle and returns where it leads (the story then calls afterFinalBattle(d, route), see
 * src/game/story/endings.ts). `from` starts at a later phase (debug).
 */
export async function runFinalBattleV2(d: Director, from: 1 | 2 | 3 | 4 = 1): Promise<FinalV2Route> {
  delete G.state.flags.fin_route;
  FINAL_V2.from = from;
  G.state.chapter = 6;
  await d.battle(['dodo_v2'], { boss: true, noFlee: true, intro: '* Dodo t\'enveloppe. Il sent ta chambre, ta couette, ton coton.' });
  audio.setMuffle(1, 0.5);
  audio.tempoScale = 1;
  fx.glitch = 0;
  const r = String(G.state.flags.fin_route ?? '');
  return r === 'beaux_reves' || r === 'silence' || r === 'aube' ? r : isSilenceRoute() ? 'silence' : 'aube';
}


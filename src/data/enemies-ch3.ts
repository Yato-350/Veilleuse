import { audio } from '../engine/audio';
import { game } from '../engine/game';
import { rng } from '../engine/math';
import type { Battle } from '../game/battle/battle';
import type { EnemyRuntime } from '../game/battle/enemy';
import { BRACELET } from '../game/battle/patterns-ch3';
import type { BattleHooks, EnemyDef } from '../game/battle/types';
import { spr } from '../game/assets';
import { G } from '../game/state';
import { tf } from '../i18n';
import { BRACELET_LABEL } from './sprites/chapter3';

/*
 * Chapter 3 « L'Hôpital de Papier », version 2 (docs/HISTOIRE.md § 3.8, T6): Bracelet.
 *
 * A hospital wristband that crawls like a worm. Peur. Needs Tristesse ×2, then the special word « prénom ».
 * - Its label first reads « MINA — 304 ». Once the sadness is answered it turns over: on the other side, « NOA — ??? »
 *   (a name with no room). Writing « prénom » then prints « NOA » on it. Written too early, « prénom » only gets
 *   « it is already written: M, I, N, A » (it still counts as a sad word).
 * - Spared, it closes round Noa's wrist (cosmetic: the key item `bracelet_noa`) and flags.c3_bracelet = 'epargne';
 *   killed, it snaps at the clasp and flags.c3_bracelet = 'coupe'.
 * - Attacks (src/game/battle/patterns-ch3.ts): it coils round the box and tightens it, its letters fall; its holed
 *   end sweeps the box.
 */

interface BraceletState {
  flipped: boolean;
  named: boolean;
  /** Frame of the flip (the label is blank while the band turns over). */
  flipAt: number;
  t: number;
}
const STATES = new WeakMap<Battle, BraceletState>();
function state(b: Battle): BraceletState {
  let s = STATES.get(b);
  if (!s) {
    s = { flipped: false, named: false, flipAt: -99, t: 0 };
    STATES.set(b, s);
  }
  return s;
}

/** Tiny print letters (5 px high) for the label of the band. */
const PRINT: Record<string, string[]> = {
  M: ['x...x', 'xx.xx', 'x.x.x', 'x...x', 'x...x'],
  I: ['x', 'x', 'x', 'x', 'x'],
  N: ['x..x', 'xx.x', 'x.xx', 'x..x', 'x..x'],
  A: ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'],
  O: ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'],
  '-': ['...', '...', 'xxx', '...', '...'],
  '?': ['xx.', '..x', '.x.', '...', '.x.'],
  '3': ['xxx', '..x', 'xxx', '..x', 'xxx'],
  '0': ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'],
  '4': ['x.x', 'x.x', 'xxx', '..x', '..x'],
};
const NAVY = '#3d4c8f';
const RED = '#e8505b';

function printWidth(text: string): number {
  let w = 0;
  for (const ch of text) w += ch === ' ' ? 1 : (PRINT[ch]?.[0]?.length ?? 0) + 1;
  return Math.max(0, w - 1);
}

function print(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): number {
  g.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += 1;
      continue;
    }
    const rows = PRINT[ch];
    if (!rows) continue;
    rows.forEach((r, j) => [...r].forEach((v, i) => v === 'x' && g.fillRect(cx + i, y + j, 1, 1)));
    cx += rows[0]!.length + 1;
  }
  return cx;
}

/** The label printed on the band: [navy part, red part]. */
function label(s: BraceletState): Array<[string, string]> {
  // i18n-ignore-start (a name and a room number printed on a wristband)
  if (s.named) return [['NOA', NAVY]];
  if (s.flipped)
    return [
      ['NOA', NAVY],
      [' - ', NAVY],
      ['???', RED],
    ];
  return [
    ['MINA', NAVY],
    [' - ', NAVY],
    ['304', RED],
  ];
  // i18n-ignore-end
}

function drawLabel(g: CanvasRenderingContext2D, b: Battle, e: EnemyRuntime, s: BraceletState): void {
  s.t++;
  if (e.dead || e.spared || e.hidden || e.flash > 0) return;
  const sp = spr(e.def.sprite);
  const o = b.spriteOffset(e);
  // (+1: the battle sprite has a 1 px outline)
  const x0 = Math.round(e.x + o.dx - sp.ax + BRACELET_LABEL.x + 1);
  const y0 = Math.round(e.y + o.dy - sp.ay + BRACELET_LABEL.y + 1);
  // While it turns over, the label is a blank strip that narrows and widens again.
  const k = s.t - s.flipAt;
  if (k >= 0 && k < 24) {
    const squash = Math.abs(12 - k) / 12;
    g.fillStyle = '#ece2df';
    g.fillRect(x0, y0, BRACELET_LABEL.w, BRACELET_LABEL.h);
    g.fillStyle = '#ffffff';
    const h = Math.max(1, Math.round(BRACELET_LABEL.h * squash));
    g.fillRect(x0, y0 + Math.floor((BRACELET_LABEL.h - h) / 2), BRACELET_LABEL.w, h);
    return;
  }
  const parts = label(s);
  const total = printWidth(parts.map((p) => p[0]).join(''));
  let x = x0 + Math.floor((BRACELET_LABEL.w - total) / 2);
  for (const [text, color] of parts) x = print(g, text, x, y0, color);
}

const bracelet = (b: Battle): EnemyRuntime | undefined => b.enemies.find((e) => e.def.id === 'bracelet');

const BRACELET_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = state(b);
    const e = bracelet(b);
    if (!e) return;
    if (turn === 1) {
      BRACELET.label = 'MINA304';
      const prev = b.backdrop;
      b.backdrop = (g, bb) => {
        prev?.(g, bb);
        drawLabel(g, bb, e, s);
      };
      await b.say("* Sur l'étiquette de Bracelet, on lit : « MINA — 304 ».");
    }
    if (e.alive && e.step >= 1 && !s.flipped) {
      s.flipped = true;
      s.flipAt = s.t;
      BRACELET.label = 'NOA???'; // i18n-ignore
      audio.sfx('thread', { pitch: 0.8 });
      await game.wait(30);
      await b.say("* Bracelet se retourne, lentement.\n* De l'autre côté, une autre étiquette : « NOA — ??? ».");
    }
  },
  pattern(_b, turn) {
    return turn % 2 ? 'bracelet_wrap' : 'bracelet_holes';
  },
  talk(b) {
    const s = state(b);
    const e = bracelet(b);
    if (!e || e.spareable || !s.flipped) return null;
    return rng.pick([
      "Et lui ? C'est quelle chambre, lui ?",
      'Il manque quelque chose. Ici. Après le nom.',
      'Il me faut un prénom. Le vrai.',
      'Clic ? Clic ?',
    ]);
  },
  async onWord(b, e, w) {
    const s = state(b);
    if (w.text !== 'prénom') return false;
    if (!s.flipped) {
      // Its name is already printed on it. (« prénom » still counts as a sad word.)
      await b.bubble([{ e, text: "Un prénom ? Il y en a déjà un. C'est écrit. M… I… N… A." }]);
      await b.say(tf('* Tes mots touchent {0}.', e.name));
      return true;
    }
    s.named = true;
    BRACELET.label = 'NOA'; // i18n-ignore
    return false;
  },
  async onSpare(_b, e) {
    if (e.def.id !== 'bracelet') return false;
    G.state.flags.c3_bracelet = 'epargne';
    if (!G.state.keyItems.includes('bracelet_noa')) G.state.keyItems.push('bracelet_noa');
    return false;
  },
  async onDeath(_b, e) {
    if (e.def.id === 'bracelet') G.state.flags.c3_bracelet = 'coupe';
    return false;
  },
};

export const CH3_ENEMIES: Record<string, EnemyDef> = {
  bracelet: {
    id: 'bracelet',
    name: 'Bracelet',
    sprite: 'b_bracelet',
    hp: 38,
    atk: 5,
    def: 1,
    emotion: 'peur',
    needs: [{ emotion: 'tristesse', count: 2 }, { word: 'prénom' }],
    hates: ['joie'],
    specialWords: [{ text: 'prénom', emotion: 'tristesse' }],
    check: 'Il a perdu son poignet et il a peur. Pleure avec lui… puis il lui faudra un nom.',
    flavor: [
      '* Bracelet rampe sur le lino, comme un ver. Le plastique crisse.',
      '* Clic. Clic. Bracelet essaie de se fermer sur quelque chose.',
      '* Ses trous de réglage te regardent, comme des yeux en plus.',
      '* Ça sent le savon qui pique et le plastique neuf.',
      '* Bracelet regarde ton poignet. Longtemps.',
    ],
    flavorCalm: '* Bracelet ne serre plus. Il attend, ouvert, comme une main.',
    talk: [
      'Clic.',
      "C'est écrit dessus. C'est écrit.",
      "Je ne m'enlève pas. On me coupe.",
      'Pédiatrie, troisième. Clic.',
      'On me met le premier jour.',
      'Tu as un poignet, toi ?',
    ],
    reactGood: [
      '…Le plastique, à la fin, ça tient chaud.',
      'Clic… doucement.',
      'Tu sais lire, toi. Tu sais ce qui est écrit.',
    ],
    reactBad: ['Pas si fort ! Ici, on ne rit pas fort !', 'CLIC ! Je serre !'],
    reactNeutral: ['Clic ?', "Ça, ce n'est pas écrit dessus.", '…'],
    reactSpecial: {
      prénom: "N… O… A.{p:20} …Voilà. Ça, c'est écrit.",
      numéro: "Trois cent quatre. C'est tout ce que je sais.",
      chambre: 'La chambre est écrite. Pas le reste.',
      pardon: 'Pardon à qui ? Il faut un nom, pour ça.',
      rentrer: 'Le jour où on rentre, on me coupe. Clic.',
      guérir: 'On ne me met pas pour guérir. On me met pour ne pas se tromper.',
    },
    spareText:
      "* Bracelet rampe jusqu'à ton poignet et s'y referme. Clic.\n* L'étiquette dit « NOA ». Il ne serre pas.",
    killText:
      "* Bracelet se rompt au fermoir. Les deux bouts se tortillent encore un peu.\n* Sur aucun des deux, il n'y a plus de nom.",
    patterns: ['bracelet_wrap', 'bracelet_holes'],
    rewards: { boutons: 14 },
    bg: 'hospital',
    hooks: BRACELET_HOOKS,
  },
};

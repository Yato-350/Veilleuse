import type { Emotion } from '../../engine/palette';
import type { NeedStep, WordDef } from './types';

/** The emotion triangle: Joie > Colère > Tristesse > Joie. */
export function beats(a: Emotion, b: Emotion): boolean {
  return (a === 'joie' && b === 'colere') || (a === 'colere' && b === 'tristesse') || (a === 'tristesse' && b === 'joie');
}

/** The emotions carried by a word: one, or two for a bittersweet word (« mot doux-amer »). */
export function wordEmotions(w: WordDef): Emotion[] {
  return w.emotion2 && w.emotion2 !== w.emotion ? [w.emotion, w.emotion2] : [w.emotion];
}

/**
 * Emotion used by the triangle and the damage multipliers. A bicolor (bittersweet) soul holds two feelings that
 * balance each other: it fights like a neutral heart — its strength is resonance, not damage.
 */
export function combatEmotion(soul: Emotion, soul2: Emotion | null = null): Emotion {
  return soul2 && soul2 !== soul ? 'neutre' : soul;
}

/** Movement speed multiplier of the soul (a bicolor soul moves at the average of its two speeds). */
export function soulSpeed(e: Emotion, e2: Emotion | null = null): number {
  if (e2 && e2 !== e) return (soulSpeed(e) + soulSpeed(e2)) / 2;
  switch (e) {
    case 'joie':
      return 1.25;
    case 'tristesse':
      return 0.8;
    case 'peur':
      return 0.9;
    default:
      return 1;
  }
}

/** Multiplier on damage dealt by the player. */
export function dealtMultiplier(soul: Emotion, enemy: Emotion): number {
  let m = 1;
  if (soul === 'colere') m *= 1.5;
  if (beats(soul, enemy)) m *= 1.5;
  else if (beats(enemy, soul)) m *= 0.75;
  return m;
}

/** Multiplier on damage taken by the player. */
export function takenMultiplier(soul: Emotion, enemy: Emotion): number {
  let m = 1;
  if (soul === 'tristesse') m *= 0.6;
  if (soul === 'colere') m *= 1.3;
  if (beats(soul, enemy)) m *= 0.75;
  else if (beats(enemy, soul)) m *= 1.25;
  return m;
}

/**
 * Resonance rule: a projectile of the same color as the soul passes through it. White always hurts.
 * A bicolor (bittersweet) soul resonates with both of its colors.
 */
export function resonates(soul: Emotion, bullet: Emotion, soul2: Emotion | null = null): boolean {
  return bullet !== 'neutre' && (soul === bullet || soul2 === bullet);
}

export function playerDamage(atk: number, accuracy: number, soul: Emotion, enemy: Emotion, def: number, crit: boolean): number {
  const base = (atk + 2) * (0.4 + accuracy * 1.4) * dealtMultiplier(soul, enemy) * (crit ? 1.5 : 1);
  return Math.max(1, Math.round(base - def));
}

export function enemyDamage(
  bulletDmg: number,
  enemyAtk: number,
  def: number,
  soul: Emotion,
  enemy: Emotion,
  storyMode: boolean,
): number {
  const raw = (bulletDmg + enemyAtk) * takenMultiplier(soul, enemy) - def;
  const dmg = Math.max(1, Math.round(raw));
  return storyMode ? Math.max(1, Math.round(dmg * 0.25)) : dmg;
}

export type WordVerdict = 'good' | 'bad' | 'neutral' | 'special';

export interface WordResult {
  verdict: WordVerdict;
  /** Progress gained on the current need step (negative when the enemy is upset). */
  gain: number;
}

/**
 * Evaluates a written word against the enemy's current need.
 * - the step's special word → completes the step
 * - a hated emotion → loses progress, the enemy gets agitated
 * - the needed emotion → +1 progress (×word power)
 * - anything else → no effect
 * Bittersweet words (two emotions) answer a need of EITHER emotion (still +1, not +2). When one half answers the need,
 * the word soothes even if the enemy hates the other half (the sweetness carries the bitterness); otherwise, hating
 * either half agitates the enemy.
 */
export function evaluateWord(word: WordDef, need: NeedStep | undefined, hates: Emotion[] = [], remaining = 1): WordResult {
  if (need?.word && need.word.toLowerCase() === word.text.toLowerCase()) {
    return { verdict: 'special', gain: Math.max(1, remaining) };
  }
  const emos = wordEmotions(word);
  const needed = !!need?.emotion && emos.includes(need.emotion);
  const hated = emos.some((e) => hates.includes(e));
  if (hated && !(needed && emos.length > 1)) return { verdict: 'bad', gain: -1 };
  if (needed) return { verdict: 'good', gain: word.power ?? 1 };
  return { verdict: 'neutral', gain: 0 };
}

/** Total number of "correct words" needed to fully calm an enemy. */
export function needTotal(needs: NeedStep[]): number {
  return needs.reduce((a, n) => a + (n.count ?? 1), 0);
}

// -----------------------------------------------------------------------------
// Mina, the ally (version 1.1)
// -----------------------------------------------------------------------------

/**
 * 'mina' = she helps every 3rd turn; 'absent' = the empty slot she left (chapter 3, after she was erased);
 * 'mina366' = the felt Mina of chapter 4 helps, in her stitched way; 'still' = the felt Mina sits in her slot and does
 * not move any more (chapter 4, after La Couseuse was beaten: nobody will sew her again).
 */
export type AllyState = 'none' | 'mina' | 'absent' | 'mina366' | 'still';
export type AllyEffect = 'shield' | 'color' | 'heal';

/** Mina acts every ALLY_EVERY turns (turns 3, 6, 9…), before the enemy's attack. */
export const ALLY_EVERY = 3;

export interface AllyContext {
  enemyIds: string[];
  bg?: string;
  tutorial?: boolean;
  noAlly?: boolean;
  chapter: number;
  party: string[];
  flags: Record<string, unknown>;
}

/**
 * Who stands at Noa's side: Mina when she is in the party during a dream chapter (1–3); her empty slot in chapter 3
 * once she was erased; in chapter 4, Mina n°366 (party member 'mina366'), frozen once La Couseuse was beaten
 * (`c4_couseuse === 'vaincue'`). Never in the tutorial, the final Dodo battle (it has its own design) or the real world.
 */
export function allyState(c: AllyContext): AllyState {
  if (c.noAlly || c.tutorial || c.enemyIds.includes('dodo')) return 'none';
  if (c.bg === 'real' || c.flags.interlude) return 'none';
  if (c.chapter === 4) {
    if (!c.party.includes('mina366')) return 'none';
    return c.flags.c4_couseuse === 'vaincue' ? 'still' : 'mina366';
  }
  if (c.chapter < 1 || c.chapter > 3) return 'none';
  if (c.party.includes('mina')) return 'mina';
  if (c.chapter === 3 && c.flags.c3_mina_erased) return 'absent';
  return 'none';
}

export function allyActsOn(turn: number): boolean {
  return turn > 0 && turn % ALLY_EVERY === 0;
}

/**
 * What Mina draws: a band-aid when Noa is at half HP or less; otherwise she alternates a crayon shield (absorbs 3 hits)
 * and coloring the white projectiles in the soul's color (only useful for a colored soul).
 */
export function pickAllyEffect(hp: number, maxHp: number, soul: Emotion, acts: number): AllyEffect {
  if (hp <= maxHp * 0.5) return 'heal';
  const options: AllyEffect[] = soul === 'neutre' ? ['shield'] : ['shield', 'color'];
  return options[acts % options.length]!;
}

/** HP healed by Mina's band-aid. */
export function allyHeal(maxHp: number): number {
  return Math.max(4, Math.round(maxHp * 0.25));
}

// -----------------------------------------------------------------------------
// Defeats in a row (Mina offers help on the game over screen)
// -----------------------------------------------------------------------------

/** Mina offers help on this defeat in a row of the same fight. */
export const HELP_AFTER_DEFEATS = 3;

/** Consecutive defeats in the same fight (game over → retry → game over…). Any other outcome resets it. */
export class DefeatStreak {
  key = '';
  count = 0;
  /** Mina was at Noa's side in the last lost fight. */
  mina = false;

  record(key: string, lost: boolean, mina: boolean): void {
    if (!lost) {
      this.key = '';
      this.count = 0;
      this.mina = false;
      return;
    }
    this.count = this.key === key ? this.count + 1 : 1;
    this.key = key;
    this.mina = mina;
  }

  /** Exactly on the 3rd defeat in a row (asked once: a refusal is respected), never when the Story Mode is already on. */
  offersHelp(storyMode: boolean): boolean {
    return this.count === HELP_AFTER_DEFEATS && this.mina && !storyMode;
  }
}

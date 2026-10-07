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

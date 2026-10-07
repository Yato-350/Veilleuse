import type { Emotion } from '../../engine/palette';
import type { Battle } from './battle';
import type { EnemyRuntime } from './enemy';

export interface WordDef {
  text: string;
  emotion: Emotion;
  /** Calm multiplier (default 1). */
  power?: number;
}

export interface NeedStep {
  /** Emotion that answers this need. */
  emotion?: Emotion;
  /** A specific word that completes this step at once. */
  word?: string;
  /** Number of matching words required (default 1). */
  count?: number;
}

export interface BattleHooks {
  /** Before each player turn. */
  beforeTurn(b: Battle, turn: number): Promise<void>;
  /** After a word was written (after the default reaction). Return true to skip the default reaction. */
  onWord(b: Battle, e: EnemyRuntime, w: WordDef): Promise<boolean>;
  /** Fight pressed on this enemy. Return true if handled (default damage skipped). */
  onFight(b: Battle, e: EnemyRuntime): Promise<boolean>;
  /** Spare pressed. Return true if handled. */
  onSpare(b: Battle, e: EnemyRuntime): Promise<boolean>;
  /** Item used. Return true if handled. */
  onItem(b: Battle, item: string): Promise<boolean>;
  /** Override pattern choice. */
  pattern(b: Battle, turn: number): string | null;
  /** Override the 4 menu labels (evaluated every frame). */
  menuLabels(b: Battle): string[];
  /** A main-menu button was chosen. Return true if handled (the turn is consumed). */
  onMenu(b: Battle, index: number): Promise<boolean>;
  /** Override the word pool. */
  words(b: Battle): WordDef[] | null;
  /** Enemy line before attacking (overrides random talk). */
  talk(b: Battle, turn: number): string | null;
  /** Called when the enemy HP reaches 0 (return true to prevent death). */
  onDeath(b: Battle, e: EnemyRuntime): Promise<boolean>;
  /** Called when the player's HP reaches 0 (return true to prevent game over). */
  onPlayerDeath(b: Battle): Promise<boolean>;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Grammatical gender (French agreement: apaisé / apaisée). */
  fem?: boolean;
  /** Battle sprite key (animated with `<key>_2` if it exists). */
  sprite: string;
  hp: number;
  atk: number;
  def: number;
  emotion: Emotion;
  needs: NeedStep[];
  hates?: Emotion[];
  specialWords?: WordDef[];
  /** "Observer" description. */
  check: string;
  /** Random flavor text shown in the box at the start of a turn. */
  flavor: string[];
  /** Flavor shown when the enemy can be spared. */
  flavorCalm?: string;
  talk: string[];
  reactGood: string[];
  reactBad: string[];
  reactNeutral: string[];
  reactSpecial?: Record<string, string>;
  spareText?: string;
  killText?: string;
  patterns: string[];
  rewards: { boutons: number; item?: string };
  boss?: boolean;
  noFlee?: boolean;
  hooks?: Partial<BattleHooks>;
  music?: string;
  /** Battle background. */
  bg?: 'dream' | 'forest' | 'hospital' | 'void' | 'closet' | 'eraser' | 'real';
  /** Pixel offset for the sprite. */
  dy?: number;
  /** Emotion inflicted on the soul at the start of the battle. */
  inflict?: Emotion;
  /** Sprite scale (1 = native). */
  scale?: number;
}

export type BattleOutcome = 'win' | 'spare' | 'flee' | 'lose' | 'scripted';

export interface BattleResult {
  outcome: BattleOutcome;
  killed: string[];
  spared: string[];
}

export interface BattleOptions {
  /** Can't lose (tutorial). */
  tutorial?: boolean;
  music?: string;
  noFlee?: boolean;
  bg?: EnemyDef['bg'];
  /** Starting soul emotion. */
  emotion?: Emotion;
  hooks?: Partial<BattleHooks>;
  /** Intro text override. */
  intro?: string;
  /** Can't flee and no game over retry prompt customization. */
  boss?: boolean;
}

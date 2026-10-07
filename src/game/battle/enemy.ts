import type { Emotion } from '../../engine/palette';
import { evaluateWord, needTotal, type WordResult } from './rules';
import type { EnemyDef, NeedStep, WordDef } from './types';

/** Mutable battle state of one enemy. */
export class EnemyRuntime {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  emotion: Emotion;
  step = 0;
  stepProgress = 0;
  progress = 0;
  total: number;
  /** Grows with words the enemy hates → harder attacks. */
  agitation = 0;
  spared = false;
  dead = false;
  /** Forced spareable state (scripted). */
  forceSpare = false;
  // Visual state
  x = 160;
  y = 82;
  shake = 0;
  flash = 0;
  alpha = 1;
  deathT = 0;
  spareT = 0;
  hpShown: number;
  hpBarT = 0;
  hidden = false;
  /** Scripted extra data. */
  data: Record<string, unknown> = {};

  constructor(def: EnemyDef) {
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.hpShown = def.hp;
    this.emotion = def.emotion;
    this.total = Math.max(1, needTotal(def.needs));
  }

  get name(): string {
    return this.def.name;
  }

  get need(): NeedStep | undefined {
    return this.def.needs[this.step];
  }

  get calm(): number {
    return this.forceSpare ? 1 : Math.min(1, this.progress / this.total);
  }

  get spareable(): boolean {
    return this.calm >= 1;
  }

  get alive(): boolean {
    return !this.dead && !this.spared;
  }

  applyWord(w: WordDef): WordResult {
    const need = this.need;
    const remaining = need ? (need.count ?? 1) - this.stepProgress : 0;
    const r = evaluateWord(w, need, this.def.hates, remaining);
    if (r.gain > 0 && need) {
      let gain = r.gain;
      while (gain > 0 && this.step < this.def.needs.length) {
        const cur = this.def.needs[this.step]!;
        const left = (cur.count ?? 1) - this.stepProgress;
        const used = Math.min(left, gain);
        this.stepProgress += used;
        this.progress += used;
        gain -= used;
        if (this.stepProgress >= (cur.count ?? 1)) {
          this.step++;
          this.stepProgress = 0;
          if (r.verdict === 'special') break;
        }
      }
    } else if (r.gain < 0) {
      this.agitation++;
      if (this.stepProgress > 0) {
        this.stepProgress--;
        this.progress--;
      }
    }
    // Calmed enemies settle into a neutral mood.
    if (this.spareable) this.emotion = 'neutre';
    return r;
  }
}

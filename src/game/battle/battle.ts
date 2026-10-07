import { audio, VOICES } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawChar, drawOutlined, drawText, LINE_HEIGHT, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { clamp, lerp, rng, type Rect } from '../../engine/math';
import { EMOTION_COLOR, EMOTION_COLOR_NAME, EMOTION_LABEL, soulLabel, type Emotion } from '../../engine/palette';
import { vibrate } from '../../engine/screen';
import { drawSprite, silhouette } from '../../engine/sprite';
import { ITEMS } from '../../data/items';
import { WORD_POOLS } from '../../data/words';
import { hasSpr, spr } from '../assets';
import { attack, defense, G, level, MAX_ITEMS, maxHp } from '../state';
import { bar, heart, nextArrow } from '../ui/draw';
import { layoutRich, parseRich, type RichChar } from '../ui/richtext';
import { BulletWorld, type Bullet } from './bullets';
import { drawEmoIcon, soulHeart } from './emoshape';
import { EnemyRuntime } from './enemy';
import { PATTERNS, type Pattern, type PatternCtx } from './patterns';
import { combatEmotion, enemyDamage, playerDamage, soulSpeed } from './rules';
import type { BattleHooks, BattleOptions, BattleResult, EnemyDef, WordDef } from './types';

const TEXT_BOX: Rect = { x: 12, y: 86, w: 296, h: 54 };
const LABELS = ['FRAPPER', 'ÉCRIRE', 'OBJET', 'ÉPARGNER'];
const ICONS = ['✕', '♪', '•', '♥'];

interface Floater {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

type Mode = 'idle' | 'menu' | 'list' | 'notebook' | 'bar' | 'dodge' | 'text';

/** Agreement helper: "apaisé" / "apaisée". */
export const agree = (e: EnemyRuntime, word: string): string => (e.def.fem ? `${word}e` : word);

// -----------------------------------------------------------------------------
// Music that follows the soul
// -----------------------------------------------------------------------------

/** How the soul's emotion shapes the battle track (lowpass « muffle », tempo, slight detune). */
const MOODS: Record<Emotion, { muffle: number; tempo: number; wobble: number }> = {
  neutre: { muffle: 1, tempo: 1, wobble: 0 },
  joie: { muffle: 1, tempo: 1.05, wobble: 0 },
  tristesse: { muffle: 0.5, tempo: 0.92, wobble: 0 },
  colere: { muffle: 1, tempo: 1.1, wobble: 0 },
  peur: { muffle: 0.68, tempo: 0.97, wobble: 0.2 },
};

// -----------------------------------------------------------------------------
// Defeats in a row (Mina offers help on the game over screen)
// -----------------------------------------------------------------------------

const streak = { key: '', count: 0, mina: false };

/** Consecutive defeats in the same fight (game over → retry → game over…). */
export function defeatStreak(): number {
  return streak.count;
}

/** Mina offers to help on the 3rd defeat in a row of the same fight — once, only if she fought at Noa's side. */
export function minaOffersHelp(): boolean {
  return streak.count === 3 && streak.mina && !G.settings.storyMode;
}

/** Debug: pretend the fight against `ids` was just lost `n` times in a row. */
export function setDefeatStreak(ids: string[], n: number, mina = true): void {
  streak.key = ids.join('+');
  streak.count = n;
  streak.mina = mina;
}

// -----------------------------------------------------------------------------
// Mina, the ally
// -----------------------------------------------------------------------------

/** 'mina' = she helps every 3rd turn; 'absent' = the empty slot she left (chapter 3, after she was erased). */
export type AllyState = 'none' | 'mina' | 'absent';
type AllyEffect = 'shield' | 'color' | 'heal';

const ALLY_EVERY = 3;
const ALLY_SLOT = { x: 4, y: 4, w: 30, h: 30 };
const MINA_ORANGE = '#f09a4a';

const ALLY_LINES: Record<AllyEffect, string[]> = {
  shield: ['Je dessine un bouclier ! Bouge pas !', 'Bouclier de chevalière ! Tadaaa !', 'Attends, je te fais une armure en crayon !'],
  color: ['Je colorie les gribouillis blancs en {color} !', 'Hop ! Tout en {color}, comme ton cœur !'],
  heal: ['Tiens, un pansement à paillettes !', 'Bouge pas, je fais un bisou magique !'],
};

const ABSENT_LINES = [
  '* Tu attends le dessin de Mina. Il ne vient pas.',
  '* Tu te tournes vers Mina pour lui dire « à toi ! ».\n* Il n\'y a personne.',
  '* D\'habitude, à ce moment-là, quelqu\'un criait « Vas-y, chevalier ! ».',
  '* La place de Mina est vide. Tu la gardes quand même.',
];

/** Who stands at Noa's side in this battle. Never in the tutorial, the final Dodo battle or the real world. */
function allyFor(defs: EnemyDef[], opts: BattleOptions): AllyState {
  if (opts.noAlly || opts.tutorial || defs.some((d) => d.id === 'dodo')) return 'none';
  if ((opts.bg ?? defs[0]?.bg) === 'real') return 'none';
  const ch = G.state.chapter;
  if (ch < 1 || ch > 3) return 'none';
  if (G.state.party.includes('mina')) return 'mina';
  if (ch === 3 && G.state.flags.c3_mina_erased) return 'absent';
  return 'none';
}

/** A battle. `await new Battle(...).run()` resolves with the outcome. */
export class Battle implements Scene {
  enemies: EnemyRuntime[];
  opts: BattleOptions;
  hooks: Partial<BattleHooks>;
  bw = new BulletWorld();
  turn = 0;
  hp: number;
  soulEmo: Emotion;
  box: Rect = { ...TEXT_BOX };
  boxTarget: Rect = { ...TEXT_BOX };
  mode: Mode = 'idle';
  menuIdx = 0;
  menuLabels = [...LABELS];
  /** Disabled menu entries (scripted). */
  menuDisabled: boolean[] = [false, false, false, false];
  private t = 0;
  private floaters: Floater[] = [];
  bgKind: NonNullable<EnemyDef['bg']>;
  // Box text
  private text: { chars: RichChar[][]; shown: number; total: number; wait: number; voice: string; waitInput: boolean; resolve?: () => void } | null = null;
  // List
  private list: { items: string[]; colors: (string | undefined)[]; idx: number; resolve: (i: number) => void; cancel: boolean } | null = null;
  // Notebook
  private nb: {
    target: EnemyRuntime;
    words: WordDef[];
    idx: number;
    resolve: (r: WordDef | 'observe' | null) => void;
    writing: { word: WordDef; t: number } | null;
    scramble: boolean;
  } | null = null;
  // Attack bar
  private atk: { x: number; speed: number; done: boolean; acc: number; resolve: (acc: number) => void; flash: number; t: number } | null = null;
  // Dodge
  private dodge: { pattern: Pattern; ctx: PatternCtx; t: number; resolve: () => void } | null = null;
  // Bubbles
  private bubbles: Array<{ e: EnemyRuntime; chars: RichChar[][]; shown: number; total: number }> = [];
  private bubbleResolve: (() => void) | null = null;
  private slash: { e: EnemyRuntime; t: number; crit: boolean } | null = null;
  private soulFlash = 0;
  private result: BattleResult = { outcome: 'win', killed: [], spared: [] };
  /** Darkness around the soul (fear). */
  fear = 0;
  /** Extra overlay draw (scripted bosses). */
  overlay: ((g: CanvasRenderingContext2D, b: Battle) => void) | null = null;
  ended = false;
  /** Player name label in the HUD. */
  hudName = 'NOA';
  private hpGhost: number;
  /** Second color of a bicolor (bittersweet) soul. */
  soulEmo2: Emotion | null = null;
  /** Mina at Noa's side (or her empty slot). */
  ally: AllyState;
  private allyActs = 0;
  /** Frames of the « Mina acts » animation. */
  private allyT = 0;
  private absentNoted = false;
  /** Help prepared by Mina for the next dodge. */
  private nextDodge: { shield?: number; recolor?: Emotion } | null = null;
  private readonly key: string;
  /** The soul's emotion shapes the track (off when the battle's scripts own the music filter/tempo). */
  private readonly moodMusic: boolean;
  private moodSaved: { tempo: number; wobble: number } | null = null;
  /** Last mood applied to the music (debug / tests). */
  mood = '';

  constructor(defs: EnemyDef[], opts: BattleOptions = {}) {
    this.enemies = defs.map((d) => new EnemyRuntime(d));
    this.opts = opts;
    this.hooks = { ...defs[0]?.hooks, ...opts.hooks };
    this.hp = G.state.hp;
    this.hpGhost = this.hp;
    this.soulEmo = opts.emotion ?? defs.find((d) => d.inflict)?.inflict ?? 'neutre';
    this.bgKind = opts.bg ?? defs[0]?.bg ?? 'dream';
    this.key = defs.map((d) => d.id).join('+');
    this.ally = allyFor(defs, opts);
    this.moodMusic = !opts.fixedMusic && !defs.some((d) => d.id === 'dodo');
    const n = this.enemies.length;
    this.enemies.forEach((e, i) => {
      e.x = Math.round(W / 2 + (i - (n - 1) / 2) * (n > 2 ? 86 : 110));
      e.y = 82 + (e.def.dy ?? 0);
    });
  }

  get maxHp(): number {
    return maxHp(G.state);
  }

  get alive(): EnemyRuntime[] {
    return this.enemies.filter((e) => e.alive);
  }

  // ---------------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------------

  async run(): Promise<BattleResult> {
    const music = this.opts.music ?? this.enemies[0]?.def.music ?? (this.enemies.some((e) => e.def.boss) ? 'boss' : 'battle');
    audio.playMusic(music, { fadeIn: 0.2, fadeOut: 0.2 });
    this.applyMood();
    const first = this.enemies[0]!;
    const intro =
      this.opts.intro ??
      (this.enemies.length > 1 ? `* ${first.name} et ses amis te barrent la route !` : `* ${first.name} ${first.def.boss ? 'se dresse devant toi.' : 'te barre la route !'}`);
    await this.say(intro);
    while (!this.ended) {
      this.turn++;
      await this.hooks.beforeTurn?.(this, this.turn);
      if (this.ended || !this.alive.length) break;
      const action = await this.playerTurn();
      if (action === 'fled') {
        this.result.outcome = 'flee';
        return this.finish();
      }
      if (this.ended || !this.alive.length) break;
      await this.enemyTurn();
      if (this.hp <= 0) {
        if (await this.hooks.onPlayerDeath?.(this)) continue;
        if (this.opts.tutorial) {
          this.hp = 1;
          continue;
        }
        this.result.outcome = 'lose';
        return this.finish();
      }
    }
    if (this.result.outcome !== 'scripted') await this.victory();
    return this.finish();
  }

  exit(): void {
    this.resetMood();
  }

  /** Ends the battle from a script. */
  end(outcome: BattleResult['outcome'] = 'scripted'): void {
    this.result.outcome = outcome;
    this.ended = true;
  }

  private finish(): BattleResult {
    G.state.hp = clamp(this.hp, 1, this.maxHp);
    this.mode = 'idle';
    this.resetMood();
    if (this.result.outcome === 'lose') {
      if (streak.key === this.key) streak.count++;
      else {
        streak.key = this.key;
        streak.count = 1;
      }
      streak.mina = this.ally === 'mina';
    } else setDefeatStreak([], 0, false);
    return this.result;
  }

  // ---------------------------------------------------------------------------
  // Music mood
  // ---------------------------------------------------------------------------

  /** Shapes the current track after the soul's emotion(s): sadness muffles and slows, anger speeds up… */
  private applyMood(): void {
    if (!this.moodMusic) return;
    const a = MOODS[this.soulEmo];
    const b = MOODS[this.soulEmo2 ?? this.soulEmo];
    if (!this.moodSaved) this.moodSaved = { tempo: audio.tempoScale, wobble: audio.corruption };
    audio.setMuffle((a.muffle + b.muffle) / 2, 1.5);
    audio.tempoScale = this.moodSaved.tempo * ((a.tempo + b.tempo) / 2);
    audio.corruption = Math.max(this.moodSaved.wobble, (a.wobble + b.wobble) / 2);
    this.mood = this.soulEmo2 ? `${this.soulEmo}+${this.soulEmo2}` : this.soulEmo;
  }

  private resetMood(): void {
    if (!this.moodSaved) return;
    audio.setMuffle(1, 0.6);
    audio.tempoScale = this.moodSaved.tempo;
    audio.corruption = this.moodSaved.wobble;
    this.moodSaved = null;
    this.mood = '';
  }

  private async playerTurn(): Promise<'acted' | 'fled'> {
    while (true) {
      const spareable = this.alive.filter((e) => e.spareable);
      const pickFrom = this.alive[rng.int(0, this.alive.length - 1)]!;
      const flavor = spareable.length && pickFrom.def.flavorCalm && pickFrom.spareable ? pickFrom.def.flavorCalm : rng.pick(pickFrom.def.flavor);
      this.setText(flavor, false);
      const choice = await this.mainMenu();
      if (await this.hooks.onMenu?.(this, choice)) return 'acted';
      if (this.ended) return 'acted';
      if (choice === 0) {
        const target = await this.chooseTarget();
        if (!target) continue;
        if (await this.hooks.onFight?.(this, target)) return 'acted';
        const acc = await this.attackBar();
        await this.strike(target, acc);
        return 'acted';
      }
      if (choice === 1) {
        const target = await this.chooseTarget();
        if (!target) continue;
        const r = await this.openNotebook(target);
        if (r === null) continue;
        if (r === 'observe') {
          await this.observe(target);
          continue;
        }
        await this.writeWord(target, r);
        return 'acted';
      }
      if (choice === 2) {
        const keys = G.state.keyItems.filter((id) => ITEMS[id]?.battleKey);
        const items = [...G.state.items, ...keys];
        if (!items.length) {
          await this.say('* Tes poches sont vides.');
          continue;
        }
        const idx = await this.listMenu(
          items.map((id) => ITEMS[id]?.name ?? id),
          items.map((_, i) => (i >= G.state.items.length ? '#a7c7f0' : undefined)),
        );
        if (idx < 0) continue;
        if (idx >= G.state.items.length) {
          const id = items[idx]!;
          if (!(await this.hooks.onItem?.(this, id))) await this.say(`* Tu sors : ${ITEMS[id]?.name ?? id}. Rien ne se passe.`);
          return 'acted';
        }
        await this.useItem(idx);
        return 'acted';
      }
      if (choice === 3) {
        const any = this.alive.some((e) => e.spareable);
        const canFlee = !(this.opts.noFlee || this.opts.boss || this.enemies.some((e) => e.def.noFlee || e.def.boss));
        const opts = ['Épargner', canFlee ? 'Fuir' : '{c:g}Fuir'];
        const idx = await this.listMenu(opts, [any ? '#ffd84a' : undefined, canFlee ? undefined : '#5c5468']);
        if (idx < 0) continue;
        if (idx === 0) {
          await this.spare();
          return 'acted';
        }
        if (!canFlee) {
          await this.say('* Impossible de fuir. Pas cette fois.');
          continue;
        }
        if (rng.chance(0.75)) {
          audio.sfx('whoosh');
          await this.say('* Tu prends tes jambes à ton cou…', true);
          return 'fled';
        }
        await this.say('* Tu trébuches. Pas moyen de t\'enfuir !');
        return 'acted';
      }
    }
  }

  private async observe(e: EnemyRuntime): Promise<void> {
    const emo = EMOTION_LABEL[e.emotion];
    const col = e.emotion === 'neutre' ? 'g' : e.emotion === 'joie' ? 'y' : e.emotion === 'tristesse' ? 'b' : e.emotion === 'colere' ? 'r' : 'v';
    await this.say(`* ${e.name.toUpperCase()} — ATQ ${e.def.atk} DÉF ${e.def.def} — {c:${col}}${emo}{/c}\n* ${e.def.check}`);
  }

  private async enemyTurn(): Promise<void> {
    const alive = this.alive;
    if (!alive.length) return;
    // Speech bubbles
    const lines: Array<{ e: EnemyRuntime; text: string }> = [];
    for (const e of alive) {
      const custom = this.hooks.talk?.(this, this.turn);
      const text = custom ?? (e.spareable ? (e.def.reactGood[0] ?? '...') : rng.pick(e.def.talk));
      if (text) lines.push({ e, text });
      if (custom) break;
    }
    if (lines.length) await this.bubble(lines);
    await this.allyTurn();
    if (this.ended) return;
    // Attack
    const src = alive[rng.int(0, alive.length - 1)]!;
    const pid = this.hooks.pattern?.(this, this.turn) ?? rng.pick(src.def.patterns);
    const power = Math.min(3, Math.max(...alive.map((e) => e.agitation)) + Math.floor(this.turn / 4) + (alive.length > 1 ? 1 : 0));
    await this.runPattern(pid, power, src.emotion);
    if (this.hp > 0 && this.combatEmo === 'tristesse') this.heal(1, false);
  }

  /** Emotion used by the triangle and damage (a bicolor soul counts as neutral). */
  get combatEmo(): Emotion {
    return combatEmotion(this.soulEmo, this.soulEmo2);
  }

  /** Turns left before Mina's next action (0 = she acts this turn). */
  get allyCharge(): number {
    return (ALLY_EVERY - (this.turn % ALLY_EVERY)) % ALLY_EVERY;
  }

  /** Every 3rd turn, before the enemy attacks: Mina helps — or, after she was erased, her absence is felt. */
  private async allyTurn(): Promise<void> {
    if (this.ally === 'none' || this.turn % ALLY_EVERY !== 0) return;
    if (this.ally === 'absent') {
      // Sparingly: at most once per battle, always the first time, then one battle in three.
      if (this.absentNoted) return;
      this.absentNoted = true;
      const first = !G.state.flags.c3_mina_absence_felt;
      if (!first && !rng.chance(0.35)) return;
      G.state.flags.c3_mina_absence_felt = true;
      this.allyT = 90;
      await this.say(first ? ABSENT_LINES[0]! : rng.pick(ABSENT_LINES));
      return;
    }
    const effect = this.pickAllyEffect();
    this.allyActs++;
    this.allyT = 60;
    audio.sfx('write', { pitch: 1.3 });
    let line = rng.pick(ALLY_LINES[effect]).replace('{color}', EMOTION_COLOR_NAME[this.soulEmo]);
    let after: string;
    if (effect === 'heal') {
      const before = this.hp;
      this.heal(Math.max(4, Math.round(this.maxHp * 0.25)));
      after = `* Tu récupères ${this.hp - before} PV.`;
    } else if (effect === 'shield') {
      this.nextDodge = { shield: 3 };
      after = '* Un cercle de crayon entoure ton cœur. Il arrêtera trois coups.';
    } else {
      this.nextDodge = { recolor: this.soulEmo };
      after = '* Les attaques blanches prendront la couleur de ton cœur.';
    }
    line = `{c:o}Mina :{/c} ${line}\n${after}`;
    await this.say(line, false, true, 'mina');
  }

  /** Heals when Noa is hurt; otherwise alternates shield and coloring (coloring only helps a colored soul). */
  private pickAllyEffect(): AllyEffect {
    if (this.hp <= this.maxHp * 0.5) return 'heal';
    const options: AllyEffect[] = this.soulEmo === 'neutre' ? ['shield'] : ['shield', 'color'];
    return options[this.allyActs % options.length]!;
  }

  /** Runs one dodge phase. */
  async runPattern(id: string, power = 0, emo: Emotion = 'neutre'): Promise<void> {
    const pattern = PATTERNS[id] ?? PATTERNS.ink_drops!;
    const bw = this.bw;
    bw.clear();
    const bx = Math.round(W / 2 - pattern.box.w / 2);
    const by = Math.round(113 - pattern.box.h / 2);
    this.boxTarget = { x: bx, y: by, w: pattern.box.w, h: pattern.box.h };
    this.setText(null);
    this.mode = 'dodge';
    await game.until(() => Math.abs(this.box.w - this.boxTarget.w) < 1 && Math.abs(this.box.h - this.boxTarget.h) < 1);
    bw.box = { ...this.boxTarget };
    bw.t = 0;
    bw.soul.x = bx + pattern.box.w / 2;
    bw.soul.y = by + pattern.box.h / 2;
    bw.soul.inv = 20;
    bw.soul.emo = this.soulEmo;
    bw.soul.emo2 = this.soulEmo2;
    bw.onHit = (b) => this.hurt(b);
    bw.onResonate = () => {
      this.soulFlash = 10;
      audio.sfx('chime', { vol: 0.25, pitch: 1.2 });
    };
    bw.shield = this.nextDodge?.shield ?? 0;
    bw.recolor = this.nextDodge?.recolor ?? null;
    this.nextDodge = null;
    bw.onShield = () => {
      audio.sfx('write', { pitch: 0.7 });
      fx.shake(1, 4);
    };
    const ctx: PatternCtx = { power, turn: this.turn, emo, mem: {} };
    pattern.start?.(bw, ctx);
    await new Promise<void>((resolve) => {
      this.dodge = { pattern, ctx, t: 0, resolve };
    });
    this.dodge = null;
    bw.clear();
    this.mode = 'idle';
    this.boxTarget = { ...TEXT_BOX };
    await game.until(() => Math.abs(this.box.w - TEXT_BOX.w) < 1);
  }

  private hurt(b: Bullet): void {
    if (b.dmg <= 0) return;
    const src = this.alive[0];
    const dmg = enemyDamage(b.dmg, src?.def.atk ?? 0, defense(G.state), this.combatEmo, src?.emotion ?? 'neutre', G.settings.storyMode);
    this.hp = Math.max(0, this.hp - dmg);
    this.bw.soul.inv = 50;
    audio.sfx('hurt');
    fx.shake(2, 8);
    vibrate(40);
    if (this.hp <= 0 && this.dodge) {
      if (this.opts.tutorial) this.hp = 1;
    }
  }

  heal(n: number, text = true): void {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (this.hp > before) {
      audio.sfx('heal');
      this.floaters.push({ text: `+${this.hp - before}`, x: 70, y: 140, t: 0, color: '#7ee08a' });
    }
    void text;
  }

  /** Changes the soul's color. `e2`: second color of a bicolor (bittersweet) soul. */
  setEmotion(e: Emotion, sound = true, e2: Emotion | null = null): void {
    const second = e2 && e2 !== e ? e2 : null;
    if (this.soulEmo === e && this.soulEmo2 === second) return;
    this.soulEmo = e;
    this.soulEmo2 = second;
    this.bw.soul.emo = e;
    this.bw.soul.emo2 = second;
    this.soulFlash = 16;
    if (sound) audio.sfx('emotion', { pitch: second ? 1 : e === 'joie' ? 1.2 : e === 'tristesse' ? 0.8 : e === 'colere' ? 1 : 0.9 });
    if (sound && second) window.setTimeout(() => audio.sfx('emotion', { pitch: 0.8, vol: 0.6 }), 120);
    this.applyMood();
  }

  /** Main color of the soul and its second color (bicolor soul), for drawing. */
  private soulColors(): [string, string | null] {
    return [EMOTION_COLOR[this.soulEmo], this.soulEmo2 ? EMOTION_COLOR[this.soulEmo2] : null];
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private async strike(e: EnemyRuntime, acc: number): Promise<void> {
    if (acc <= 0) {
      audio.sfx('miss');
      this.floaters.push({ text: 'RATÉ', x: e.x, y: e.y - 40, t: 0, color: '#b7aab8' });
      await game.wait(40);
      return;
    }
    const crit = acc > 0.93 || (this.combatEmo === 'joie' && rng.chance(0.2));
    const dmg = playerDamage(attack(G.state), acc, this.combatEmo, e.emotion, e.def.def, crit);
    this.slash = { e, t: 0, crit };
    audio.sfx('slash');
    await game.wait(18);
    audio.sfx(crit ? 'crit' : 'hit');
    e.hp = Math.max(0, e.hp - dmg);
    e.shake = 20;
    e.flash = 8;
    e.hpBarT = 90;
    fx.shake(crit ? 4 : 2, 10);
    this.floaters.push({ text: `${dmg}`, x: e.x, y: e.y - 44, t: 0, color: crit ? '#ffd84a' : '#ff4a5a' });
    await game.wait(60);
    this.slash = null;
    // Hitting a calmed enemy hurts its feelings.
    if (e.progress > 0 && e.hp > 0) {
      e.progress = Math.max(0, e.progress - 1);
      e.stepProgress = Math.max(0, e.stepProgress - 1);
      e.agitation++;
    }
    if (e.hp <= 0) {
      if (await this.hooks.onDeath?.(this, e)) return;
      await this.kill(e);
    }
  }

  async kill(e: EnemyRuntime): Promise<void> {
    e.dead = true;
    e.deathT = 1;
    audio.sfx('die');
    this.result.killed.push(e.def.id);
    await game.wait(70);
    await this.say(e.def.killText ?? `* ${e.name} se dissout en une flaque d'encre.`);
  }

  private async writeWord(e: EnemyRuntime, w: WordDef): Promise<void> {
    const r = e.applyWord(w);
    this.setEmotion(w.emotion, true, w.emotion2 ?? null);
    if (await this.hooks.onWord?.(this, e, w)) return;
    const special = e.def.reactSpecial?.[w.text];
    let reaction: string;
    if (special) reaction = special;
    else if (r.verdict === 'special' || r.verdict === 'good') reaction = rng.pick(e.def.reactGood);
    else if (r.verdict === 'bad') reaction = rng.pick(e.def.reactBad);
    else reaction = rng.pick(e.def.reactNeutral);
    await this.bubble([{ e, text: reaction }]);
    let line: string;
    if (e.spareable) line = `* {c:y}${e.name} est ${agree(e, 'apaisé')}.{/c} Tu peux l'épargner.`;
    else if (r.verdict === 'good' || r.verdict === 'special') line = `* Tes mots touchent ${e.name}.`;
    else if (r.verdict === 'bad') line = `* ${e.name} se crispe. Ses attaques seront plus fortes.`;
    else line = `* ${e.name} ne semble pas comprendre.`;
    await this.say(line);
  }

  private async useItem(idx: number): Promise<void> {
    const id = G.state.items[idx]!;
    const item = ITEMS[id];
    if (!item) return;
    if (await this.hooks.onItem?.(this, id)) return;
    G.state.items.splice(idx, 1);
    audio.sfx('item');
    let line = `* Tu utilises : ${item.name}. ${item.useText ?? ''}`;
    if (item.heal) {
      const before = this.hp;
      this.heal(item.heal);
      line += this.hp >= this.maxHp ? ' PV au maximum !' : ` +${this.hp - before} PV.`;
    }
    if (item.emotion) {
      this.setEmotion(item.emotion);
      line += ` Ton cœur devient ${EMOTION_LABEL[item.emotion]}.`;
    }
    await this.say(line);
  }

  private async spare(): Promise<void> {
    const targets = this.alive.filter((e) => e.spareable);
    if (!targets.length) {
      const e = this.alive[0];
      await this.say(this.alive.length === 1 && e ? `* ${e.name} n'est pas encore ${agree(e, 'apaisé')}.` : '* Personne n\'est prêt à partir en paix.');
      return;
    }
    for (const e of targets) {
      if (await this.hooks.onSpare?.(this, e)) continue;
      e.spared = true;
      e.spareT = 1;
      this.result.spared.push(e.def.id);
      audio.sfx('spare');
    }
    await game.wait(50);
    for (const e of targets) if (e.spared) await this.say(e.def.spareText ?? `* ${e.name} s'en va en paix.`);
  }

  private async victory(): Promise<void> {
    const spared = this.result.spared.length;
    const killed = this.result.killed.length;
    if (!spared && !killed) return;
    let boutons = 0;
    for (const e of this.enemies) {
      if (e.spared) boutons += Math.ceil(e.def.rewards.boutons * 0.6);
      else if (e.dead) boutons += e.def.rewards.boutons;
    }
    const s = G.state;
    const hpBefore = maxHp(s);
    const lvBefore = level(s);
    const atkBefore = attack(s);
    s.etoiles += spared;
    s.encre += killed;
    s.boutons += boutons;
    for (const id of this.result.spared) s.spares[id] = (s.spares[id] ?? 0) + 1;
    for (const id of this.result.killed) s.kills[id] = (s.kills[id] ?? 0) + 1;
    this.result.outcome = killed > 0 && spared === 0 ? 'win' : spared > 0 && killed === 0 ? 'spare' : 'win';
    audio.stopMusic(1.2);
    const parts: string[] = [];
    if (spared) parts.push(`{c:y}${spared} Étoile${spared > 1 ? 's' : ''}{/c}`);
    if (killed) parts.push(`{c:v}${killed} Encre${killed > 1 ? 's' : ''}{/c}`);
    parts.push(`${boutons} Bouton${boutons > 1 ? 's' : ''}`);
    const lines = [`* C'est fini. Tu gagnes ${parts.join(', ')}.`];
    if (maxHp(s) > hpBefore) {
      lines.push(`* Ta lumière grandit ! PV max +${maxHp(s) - hpBefore}.`);
      this.hp += maxHp(s) - hpBefore;
    }
    if (attack(s) > atkBefore) lines.push(`* L'encre coule en toi… ATQ +${attack(s) - atkBefore}.`);
    else if (level(s) > lvBefore && maxHp(s) === hpBefore) lines.push(`* Tu passes au niveau ${level(s)}.`);
    for (const e of this.enemies) {
      if (e.def.rewards.item && (e.spared || e.dead)) {
        const it = ITEMS[e.def.rewards.item];
        if (!it) continue;
        if (it.key) {
          if (!s.keyItems.includes(it.id)) s.keyItems.push(it.id);
          lines.push(`* Tu obtiens : ${it.name}.`);
        } else if (s.items.length < MAX_ITEMS) {
          s.items.push(it.id);
          lines.push(`* Tu obtiens : ${it.name}.`);
        } else lines.push(`* Tes poches sont pleines. Tu laisses : ${it.name}.`);
      }
    }
    // The text box holds about three lines: show the summary two sentences at a time.
    for (let i = 0; i < lines.length; i += 2) await this.say(lines.slice(i, i + 2).join('\n'), false, true);
  }

  // ---------------------------------------------------------------------------
  // Widgets (promise-based)
  // ---------------------------------------------------------------------------

  /** Types text in the box. If `wait`, resolves after the player confirms. `voice`: blip voice (default narrator). */
  async say(text: string, auto = false, wait = true, voice?: string): Promise<void> {
    this.setText(text, wait && !auto);
    if (voice && this.text && VOICES[voice]) this.text.voice = voice;
    await new Promise<void>((resolve) => {
      if (this.text) this.text.resolve = resolve;
    });
    if (auto) await game.wait(30);
    this.mode = 'idle';
  }

  setText(text: string | null, waitInput = false): void {
    if (text === null) {
      this.text = null;
      return;
    }
    const chars = parseRich(text, { player: G.state.playerName });
    const lines = layoutRich(chars, TEXT_BOX.w - 20);
    this.text = { chars: lines, shown: 0, total: lines.reduce((a, l) => a + l.length, 0), wait: 0, voice: 'narrator', waitInput };
    if (waitInput) this.mode = 'text';
  }

  private mainMenu(): Promise<number> {
    this.mode = 'menu';
    return new Promise((resolve) => {
      this.menuResolve = resolve;
    });
  }
  private menuResolve: ((i: number) => void) | null = null;

  private async chooseTarget(): Promise<EnemyRuntime | null> {
    const alive = this.alive;
    if (alive.length === 1) return alive[0]!;
    const idx = await this.listMenu(
      alive.map((e) => e.name),
      alive.map((e) => (e.spareable ? '#ffd84a' : undefined)),
    );
    return idx < 0 ? null : alive[idx]!;
  }

  listMenu(items: string[], colors: (string | undefined)[] = [], cancel = true): Promise<number> {
    this.setText(null);
    this.mode = 'list';
    return new Promise((resolve) => {
      this.list = { items, colors, idx: 0, resolve, cancel };
    });
  }

  private openNotebook(target: EnemyRuntime): Promise<WordDef | 'observe' | null> {
    const words = this.pickWords(target);
    this.mode = 'notebook';
    this.setText(null);
    audio.sfx('pop', { pitch: 0.8 });
    return new Promise((resolve) => {
      this.nb = { target, words, idx: 1, resolve, writing: null, scramble: this.soulEmo === 'peur' || this.soulEmo2 === 'peur' };
    });
  }

  /** Six words: always at least one that answers the current need, plus special words. */
  pickWords(e: EnemyRuntime): WordDef[] {
    const custom = this.hooks.words?.(this);
    if (custom) return custom.slice(0, 6);
    const chapter = clamp(G.state.chapter, 1, 3);
    const pool = [...(WORD_POOLS[chapter] ?? WORD_POOLS[1]!)];
    const out: WordDef[] = [];
    const need = e.need;
    for (const sw of e.def.specialWords ?? []) if (out.length < 2) out.push(sw);
    if (need?.emotion) {
      const match = rng.shuffle(pool.filter((w) => w.emotion === need.emotion || w.emotion2 === need.emotion));
      out.push(...match.slice(0, rng.chance(0.5) ? 2 : 1));
    }
    const rest = rng.shuffle(pool.filter((w) => !out.some((o) => o.text === w.text)));
    // Keep a variety of emotions.
    for (const emo of ['joie', 'tristesse', 'colere'] as Emotion[]) {
      if (out.length >= 6) break;
      if (!out.some((w) => w.emotion === emo)) {
        const pick = rest.find((w) => w.emotion === emo && !out.includes(w));
        if (pick) out.push(pick);
      }
    }
    for (const w of rest) {
      if (out.length >= 6) break;
      if (!out.includes(w)) out.push(w);
    }
    return rng.shuffle(out.slice(0, 6));
  }

  private attackBar(): Promise<number> {
    this.setText(null);
    this.mode = 'bar';
    return new Promise((resolve) => {
      this.atk = { x: 0, speed: 3.6, done: false, acc: 0, resolve, flash: 0, t: 0 };
    });
  }

  /** Shows speech bubbles next to enemies; resolves when the player confirms. */
  bubble(lines: Array<{ e: EnemyRuntime; text: string }>): Promise<void> {
    this.bubbles = lines.map(({ e, text }) => {
      const chars = layoutRich(parseRich(text, { player: G.state.playerName }), 92);
      return { e, chars, shown: 0, total: chars.reduce((a, l) => a + l.length, 0) };
    });
    return new Promise((resolve) => {
      this.bubbleResolve = resolve;
    });
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(): void {
    this.t++;
    if (this.hooks.menuLabels) this.menuLabels = this.hooks.menuLabels(this);
    // Box animation
    const k = 0.25;
    this.box.x = lerp(this.box.x, this.boxTarget.x, k);
    this.box.y = lerp(this.box.y, this.boxTarget.y, k);
    this.box.w = lerp(this.box.w, this.boxTarget.w, k);
    this.box.h = lerp(this.box.h, this.boxTarget.h, k);
    if (Math.abs(this.box.w - this.boxTarget.w) < 0.5) Object.assign(this.box, this.boxTarget);
    if (this.hpGhost > this.hp) this.hpGhost = Math.max(this.hp, this.hpGhost - 0.25);
    else this.hpGhost = this.hp;
    for (const e of this.enemies) {
      if (e.shake > 0) e.shake--;
      if (e.flash > 0) e.flash--;
      if (e.hpBarT > 0) e.hpBarT--;
      e.hpShown = lerp(e.hpShown, e.hp, 0.12);
      if (e.deathT > 0) e.deathT++;
      if (e.spareT > 0) e.spareT++;
    }
    this.floaters = this.floaters.filter((f) => ++f.t < 60);
    if (this.soulFlash > 0) this.soulFlash--;
    if (this.allyT > 0) this.allyT--;

    this.updateText();
    if (this.bubbles.length) {
      this.updateBubbles();
      return;
    }
    switch (this.mode) {
      case 'menu':
        this.updateMenu();
        break;
      case 'list':
        this.updateList();
        break;
      case 'notebook':
        this.updateNotebook();
        break;
      case 'bar':
        this.updateBar();
        break;
      case 'dodge':
        this.updateDodge();
        break;
      default:
        break;
    }
  }

  private updateText(): void {
    const tx = this.text;
    if (!tx) return;
    if (tx.shown < tx.total) {
      if (tx.wait > 0) tx.wait--;
      else {
        const speed = [0.5, 1, 2, 99][G.settings.textSpeed]!;
        const before = Math.floor(tx.shown);
        tx.shown = Math.min(tx.total, tx.shown + speed);
        const after = Math.floor(tx.shown);
        if (after > before) {
          const rc = charAt(tx.chars, after - 1);
          if (rc && rc.ch !== ' ' && after % 2 === 0) audio.voice(VOICES[tx.voice]!);
          if (rc?.pause && G.settings.textSpeed < 3) tx.wait = rc.pause;
        }
      }
      if (tx.waitInput && (input.pressed('a') || input.pressed('b'))) tx.shown = tx.total;
      else if (!tx.waitInput && tx.resolve && (input.pressed('a') || input.pressed('b'))) tx.shown = tx.total;
      return;
    }
    if (tx.resolve) {
      if (!tx.waitInput || input.pressed('a')) {
        const r = tx.resolve;
        tx.resolve = undefined;
        if (tx.waitInput) {
          input.consume();
          this.text = null;
        }
        r();
      }
    }
  }

  private updateBubbles(): void {
    let all = true;
    for (const b of this.bubbles) {
      if (b.shown < b.total) {
        b.shown = Math.min(b.total, b.shown + [0.5, 1, 2, 99][G.settings.textSpeed]!);
        if (Math.floor(b.shown) % 2 === 0) audio.voice(VOICES[b.e.def.boss ? 'monster' : 'default']!);
        all = false;
      }
    }
    if (!all && (input.pressed('a') || input.pressed('b'))) {
      for (const b of this.bubbles) b.shown = b.total;
      return;
    }
    if (all && input.pressed('a')) {
      this.bubbles = [];
      input.consume();
      const r = this.bubbleResolve;
      this.bubbleResolve = null;
      r?.();
    }
  }

  private updateMenu(): void {
    const n = 4;
    if (input.repeat('left')) {
      this.menuIdx = (this.menuIdx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('right')) {
      this.menuIdx = (this.menuIdx + 1) % n;
      audio.sfx('move');
    }
    if (input.pressed('a')) {
      if (this.menuDisabled[this.menuIdx]) {
        audio.sfx('cancel');
        return;
      }
      audio.sfx('select');
      this.mode = 'idle';
      input.consume();
      const r = this.menuResolve;
      this.menuResolve = null;
      r?.(this.menuIdx);
    }
  }

  private updateList(): void {
    const l = this.list!;
    const n = l.items.length;
    const cols = 2;
    if (input.repeat('up') && l.idx - cols >= 0) {
      l.idx -= cols;
      audio.sfx('move');
    }
    if (input.repeat('down') && l.idx + cols < n) {
      l.idx += cols;
      audio.sfx('move');
    }
    if (input.repeat('left') && l.idx % cols === 1) {
      l.idx--;
      audio.sfx('move');
    }
    if (input.repeat('right') && l.idx % cols === 0 && l.idx + 1 < n) {
      l.idx++;
      audio.sfx('move');
    }
    if (input.pressed('a')) {
      audio.sfx('select');
      this.closeList(l.idx);
    } else if (input.pressed('b') && l.cancel) {
      audio.sfx('cancel');
      this.closeList(-1);
    }
  }

  private closeList(i: number): void {
    const l = this.list!;
    this.list = null;
    this.mode = 'idle';
    input.consume();
    l.resolve(i);
  }

  private updateNotebook(): void {
    const nb = this.nb!;
    if (nb.writing) {
      nb.writing.t++;
      const len = nb.writing.word.text.length;
      if (nb.writing.t % 4 === 0 && nb.writing.t / 4 <= len) audio.sfx('write', { pitch: 0.8 + rng.next() * 0.5 });
      if (nb.writing.t > len * 4 + 40) {
        const w = nb.writing.word;
        this.nb = null;
        this.mode = 'idle';
        input.consume();
        nb.resolve(w);
      }
      return;
    }
    // idx 0 = observe, 1..6 = words (2 columns x 3 rows)
    const nWords = nb.words.length;
    if (input.repeat('up')) {
      if (nb.idx <= 2) nb.idx = 0;
      else nb.idx -= 2;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      if (nb.idx === 0) nb.idx = 1;
      else if (nb.idx + 2 <= nWords) nb.idx += 2;
      audio.sfx('move');
    }
    if (input.repeat('left') && nb.idx > 0 && nb.idx % 2 === 0) {
      nb.idx--;
      audio.sfx('move');
    }
    if (input.repeat('right') && nb.idx > 0 && nb.idx % 2 === 1 && nb.idx + 1 <= nWords) {
      nb.idx++;
      audio.sfx('move');
    }
    if (input.pressed('a')) {
      audio.sfx('select');
      if (nb.idx === 0) {
        this.nb = null;
        this.mode = 'idle';
        input.consume();
        nb.resolve('observe');
        return;
      }
      nb.writing = { word: nb.words[nb.idx - 1]!, t: 0 };
    } else if (input.pressed('b')) {
      audio.sfx('cancel');
      this.nb = null;
      this.mode = 'idle';
      input.consume();
      nb.resolve(null);
    }
  }

  private updateBar(): void {
    const a = this.atk!;
    a.t++;
    const w = TEXT_BOX.w - 16;
    if (!a.done) {
      a.x += a.speed;
      if (input.pressed('a')) {
        a.done = true;
        const center = w / 2;
        a.acc = clamp(1 - Math.abs(a.x - center) / center, 0, 1);
        a.flash = 30;
        audio.sfx('select', { pitch: 0.7 + a.acc * 0.6 });
      } else if (a.x >= w) {
        a.done = true;
        a.acc = 0;
        a.flash = 10;
      }
    } else if (--a.flash <= 0) {
      this.atk = null;
      this.mode = 'idle';
      a.resolve(a.acc);
    }
  }

  private updateDodge(): void {
    const d = this.dodge;
    if (!d) return;
    const bw = this.bw;
    d.t++;
    d.pattern.tick(bw, d.t, d.ctx);
    // Soul movement
    const s = bw.soul;
    const ax = input.axis();
    const speed = 1.5 * soulSpeed(this.soulEmo, this.soulEmo2);
    let dx = ax.x;
    let dy = ax.y;
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    s.x += dx * speed + input.drag.dx * 0.9;
    s.y += dy * speed + input.drag.dy * 0.9;
    const b = bw.box;
    s.x = clamp(s.x, b.x + 5, b.x + b.w - 5);
    s.y = clamp(s.y, b.y + 5, b.y + b.h - 5);
    s.emo = this.soulEmo;
    s.emo2 = this.soulEmo2;
    if (s.inv > 0) s.inv--;
    bw.update();
    const over = d.t >= d.pattern.duration || this.hp <= 0;
    if (over) {
      const r = d.resolve;
      this.dodge = null;
      r();
    }
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D): void {
    this.drawBackground(g);
    for (const e of this.enemies) this.drawEnemy(g, e);
    this.drawAlly(g);
    this.drawSlash(g);
    this.drawBox(g);
    this.drawHud(g);
    this.drawMenu(g);
    if (this.nb) this.drawNotebook(g);
    for (const b of this.bubbles) this.drawBubble(g, b);
    for (const f of this.floaters) {
      const y = f.y - Math.min(14, f.t * 0.6);
      drawOutlined(g, f.text, f.x - Math.floor(measure(f.text) / 2), Math.round(y), f.color, '#0b0710');
    }
    this.overlay?.(g, this);
  }

  private drawBackground(g: CanvasRenderingContext2D): void {
    const t = this.t;
    const kind = this.bgKind;
    const palettes: Record<string, [string, string, string]> = {
      dream: ['#1a1030', '#2a1a48', '#4a3270'],
      forest: ['#0f1f1a', '#1a3328', '#2f5a44'],
      hospital: ['#141c22', '#22303a', '#3a5260'],
      void: ['#000000', '#0b0710', '#1c1424'],
      closet: ['#120a18', '#1c1028', '#3a2050'],
      eraser: ['#20141c', '#3a2030', '#6a3a50'],
      real: ['#0a0b12', '#15172a', '#2a2c44'],
    };
    const [c0, c1, c2] = palettes[kind] ?? palettes.dream!;
    g.fillStyle = c0;
    g.fillRect(0, 0, W, H);
    // Soft horizontal bands
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? c1 : c0;
      g.fillRect(0, 10 + i * 12, W, 6);
    }
    // Drifting shapes
    g.fillStyle = c2;
    for (let i = 0; i < 24; i++) {
      const x = ((i * 53 + t * (0.15 + (i % 3) * 0.08)) % (W + 20)) - 10;
      const y = (i * 37) % 84;
      if (kind === 'hospital') {
        g.fillRect(Math.round(x), y, 1, 1);
      } else if (kind === 'void') {
        g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 0.03 + i);
        g.fillRect(Math.round(x), y, 1, 1);
        g.globalAlpha = 1;
      } else {
        g.fillRect(Math.round(x), y, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
      }
    }
    if (kind === 'hospital') {
      // ECG line across the top
      g.fillStyle = '#5fbfc4';
      for (let x = 0; x < W; x++) {
        const p = (x + t * 1.5) % 120;
        const yy = p > 50 && p < 60 ? 30 - Math.sin(((p - 50) / 10) * Math.PI * 2) * 12 : 30;
        g.globalAlpha = 0.35;
        g.fillRect(x, Math.round(yy), 1, 1);
      }
      g.globalAlpha = 1;
    }
    // Ground line under the enemies
    g.fillStyle = c1;
    g.fillRect(0, 83, W, 1);
  }

  private drawEnemy(g: CanvasRenderingContext2D, e: EnemyRuntime): void {
    if (e.hidden) return;
    if (e.spared && e.spareT > 50) return;
    if (e.dead && e.deathT > 80) return;
    const base = e.def.sprite;
    const frame = hasSpr(`${base}_2`) && Math.floor(this.t / 24) % 2 === 1 ? `${base}_2` : base;
    const s = spr(frame);
    const bob = Math.round(Math.sin(this.t * 0.05 + e.x) * 1.5);
    const sx = e.x + (e.shake > 0 ? (e.shake % 4 < 2 ? 2 : -2) : 0);
    const sy = e.y + bob;
    const scale = e.def.scale ?? 1;
    if (e.dead) {
      // Ink dissolve: sink and fade, with drips.
      const k = e.deathT / 80;
      drawSprite(g, silhouette(s, '#0b0710'), sx, sy + k * 10, { alpha: 1 - k, scaleX: scale * (1 + k * 0.3), scaleY: scale * (1 - k * 0.5) });
      g.fillStyle = '#0b0710';
      for (let i = 0; i < 6; i++) g.fillRect(sx - 12 + i * 5, Math.round(sy - 10 + k * (20 + i * 6)), 2, 3);
      return;
    }
    if (e.spared) {
      const k = e.spareT / 50;
      drawSprite(g, s, sx, sy - k * 6, { alpha: 1 - k, scaleX: scale, scaleY: scale });
      g.fillStyle = '#ffe991';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + k * 2;
        g.fillRect(Math.round(sx + Math.cos(a) * k * 30), Math.round(sy - 20 + Math.sin(a) * k * 20), 2, 2);
      }
      return;
    }
    drawSprite(g, e.flash > 0 ? silhouette(s, '#fffaf2') : s, sx, sy, scale !== 1 || e.alpha !== 1 ? { scaleX: scale, scaleY: scale, alpha: e.alpha } : undefined);
    // HP bar after hits
    if (e.hpBarT > 0) {
      bar(g, e.x - 20, e.y + 3, 40, 3, e.hpShown / e.maxHp, '#7ee08a', '#3a1c2c');
    }
  }

  private drawSlash(g: CanvasRenderingContext2D): void {
    const sl = this.slash;
    if (!sl) return;
    sl.t++;
    const e = sl.e;
    const k = Math.min(1, sl.t / 10);
    g.fillStyle = sl.crit ? '#ffd84a' : '#fffaf2';
    for (let i = 0; i < 18 * k; i++) {
      g.fillRect(Math.round(e.x - 18 + i * 2), Math.round(e.y - 46 + i * 2), 2, 2);
      if (sl.crit) g.fillRect(Math.round(e.x + 18 - i * 2), Math.round(e.y - 46 + i * 2), 2, 2);
    }
  }

  private drawBox(g: CanvasRenderingContext2D): void {
    const b = this.box;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const w = Math.round(b.w);
    const h = Math.round(b.h);
    g.fillStyle = '#fffaf2';
    g.fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle = '#000000';
    g.fillRect(x, y, w, h);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    if (this.mode === 'dodge' && this.dodge) {
      this.bw.draw(g);
      this.drawSoul(g);
      if (this.soulEmo === 'peur' || this.soulEmo2 === 'peur' || this.fear > 0) this.drawFear(g, x, y, w, h);
    }
    if (this.text) this.drawBoxText(g, x, y);
    if (this.list) this.drawList(g, x, y);
    if (this.atk) this.drawBar(g, x, y);
    g.restore();
  }

  private drawFear(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const s = this.bw.soul;
    const r = 26;
    g.fillStyle = 'rgba(8,4,14,0.92)';
    for (let yy = y; yy < y + h; yy += 2) {
      for (let xx = x; xx < x + w; xx += 2) {
        const d = Math.hypot(xx - s.x, yy - s.y);
        if (d > r + ((xx + yy) % 4 === 0 ? 2 : 0)) g.fillRect(xx, yy, 2, 2);
      }
    }
  }

  private drawSoul(g: CanvasRenderingContext2D): void {
    const s = this.bw.soul;
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    if (this.bw.shield > 0) this.drawShield(g, sx, sy);
    if (s.inv > 0 && Math.floor(s.inv / 4) % 2 === 0) return;
    const flash = this.soulFlash > 0 && this.soulFlash % 4 < 2;
    const [c1, c2] = this.soulColors();
    soulHeart(g, sx - 3, sy - 3, flash ? '#fffaf2' : c1, flash ? null : c2);
    if (G.settings.emotionShapes) {
      // Accessibility: the emotion's shape(s) just above the heart.
      g.globalAlpha = 0.9;
      if (this.soulEmo2) {
        drawEmoIcon(g, this.soulEmo, sx - 6, sy - 11, c1, '#0b0710');
        drawEmoIcon(g, this.soulEmo2, sx + 1, sy - 11, c2!, '#0b0710');
      } else drawEmoIcon(g, this.soulEmo, sx - 3, sy - 11, c1, '#0b0710');
      g.globalAlpha = 1;
    }
  }

  /** Mina's crayon shield: a scribbled circle, one third per remaining hit. */
  private drawShield(g: CanvasRenderingContext2D, sx: number, sy: number): void {
    const n = this.bw.shield;
    const steps = 24;
    const shown = Math.round((steps * Math.min(3, n)) / 3);
    const rot = this.t * 0.03;
    g.fillStyle = MINA_ORANGE;
    for (let i = 0; i < shown; i++) {
      const a = rot + (i / steps) * Math.PI * 2;
      const r = 8 + ((i * 7) % 3 === 0 ? 1 : 0);
      g.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 1, 1);
    }
    g.fillStyle = '#e8505b';
    for (let i = 0; i < shown; i += 3) {
      const a = -rot * 1.5 + (i / steps) * Math.PI * 2;
      g.fillRect(Math.round(sx + Math.cos(a) * 10), Math.round(sy + Math.sin(a) * 10), 1, 1);
    }
  }

  /** Mina's portrait in the top-left corner, with three pips filling up to her next action (or her empty slot). */
  private drawAlly(g: CanvasRenderingContext2D): void {
    if (this.ally === 'none') return;
    const { x, y, w, h } = ALLY_SLOT;
    if (this.ally === 'absent') {
      const flicker = this.allyT > 0 && Math.floor(this.allyT / 6) % 2 === 0;
      g.fillStyle = flicker ? '#5c5468' : '#2d2238';
      g.fillRect(x, y, w, 1);
      g.fillRect(x, y + h - 1, w, 1);
      g.fillRect(x, y, 1, h);
      g.fillRect(x + w - 1, y, 1, h);
      drawText(g, '…', x + Math.floor((w - measure('…')) / 2), y + 10, { color: flicker ? '#8a7f96' : '#4e4359' });
      return;
    }
    const acting = this.allyT > 0;
    const bob = acting ? -Math.round(Math.abs(Math.sin(this.allyT * 0.25)) * 3) : 0;
    g.fillStyle = acting && Math.floor(this.allyT / 4) % 2 === 0 ? '#ffd84a' : MINA_ORANGE;
    g.fillRect(x - 1, y - 1 + bob, w + 2, h + 2);
    g.fillStyle = '#1c1424';
    g.fillRect(x, y + bob, w, h);
    const expr = acting ? 'happy' : this.hp <= this.maxHp * 0.3 ? 'surprised' : 'neutral';
    const key = hasSpr(`face_mina_${expr}`) ? `face_mina_${expr}` : 'face_mina_neutral';
    if (hasSpr(key)) {
      const face = spr(key);
      // Crop the 32×32 face into the 28×28 frame (keeps the paper crown).
      g.drawImage(face.img, 2, 1, w - 2, h - 2, x + 1, y + 1 + bob, w - 2, h - 2);
    }
    // Pips: lit as turns pass; all three lit = she acts before the next attack.
    const lit = this.turn > 0 ? ALLY_EVERY - this.allyCharge : 0;
    for (let i = 0; i < ALLY_EVERY; i++) {
      g.fillStyle = '#0b0710';
      g.fillRect(x + 4 + i * 8, y + h + 2, 6, 4);
      g.fillStyle = i < lit ? (lit === ALLY_EVERY ? '#ffd84a' : MINA_ORANGE) : '#3a2c4c';
      g.fillRect(x + 5 + i * 8, y + h + 3, 4, 2);
    }
  }

  private drawBoxText(g: CanvasRenderingContext2D, x: number, y: number): void {
    const tx = this.text!;
    let count = 0;
    const shown = Math.floor(tx.shown);
    tx.chars.forEach((line, li) => {
      let cx = x + 10;
      const cy = y + 6 + li * LINE_HEIGHT;
      for (const rc of line) {
        if (count++ >= shown) return;
        if (!rc.ch) continue;
        let dx = 0;
        let dy = 0;
        if (rc.fx === 'shake') {
          dx = Math.round(Math.random() * 2 - 1);
          dy = Math.round(Math.random() * 2 - 1);
        } else if (rc.fx === 'wave') dy = Math.round(Math.sin(this.t * 0.15 + cx * 0.2) * 1.5);
        cx += drawChar(g, rc.ch, cx + dx, cy + dy, rc.color ?? '#fffaf2');
      }
    });
    if (tx.waitInput && tx.shown >= tx.total) nextArrow(g, x + TEXT_BOX.w - 14, y + TEXT_BOX.h - 10, this.t);
  }

  private drawList(g: CanvasRenderingContext2D, x: number, y: number): void {
    const l = this.list!;
    const perPage = 6;
    const page = Math.floor(l.idx / perPage);
    const start = page * perPage;
    for (let i = start; i < Math.min(l.items.length, start + perPage); i++) {
      const col = i % 2;
      const row = Math.floor((i - start) / 2);
      const ix = x + 22 + col * 140;
      const iy = y + 6 + row * 14;
      const sel = i === l.idx;
      if (sel) soulHeart(g, ix - 12, iy + 3, ...this.soulColors());
      const label = l.items[i]!.replace('{c:g}', '');
      drawText(g, `* ${label}`, ix, iy, { color: l.colors[i] ?? (sel ? '#fffaf2' : '#d8cfe0') });
      // Enemy calm meter next to names
      const enemy = this.alive.find((e) => e.name === l.items[i]);
      if (enemy) this.drawCalm(g, ix + measure(`* ${label}`) + 6, iy + 3, enemy);
    }
    if (l.items.length > perPage) drawText(g, `${page + 1}/${Math.ceil(l.items.length / perPage)}`, x + TEXT_BOX.w - 30, y + TEXT_BOX.h - 13, { color: '#8a7f96' });
  }

  private drawCalm(g: CanvasRenderingContext2D, x: number, y: number, e: EnemyRuntime): void {
    const n = Math.min(6, e.total);
    const filled = Math.round(e.calm * n);
    for (let i = 0; i < n; i++) heart(g, x + i * 8, y, i < filled ? '#ffd84a' : '#3a2c4c');
  }

  private drawBar(g: CanvasRenderingContext2D, x: number, y: number): void {
    const a = this.atk!;
    const w = TEXT_BOX.w - 16;
    const bx = x + 8;
    const by = y + 8;
    const h = TEXT_BOX.h - 16;
    // Target graphic: concentric bands
    const bands = ['#2a1a48', '#4a3270', '#9a7bd0', '#ffd84a', '#fffaf2'];
    bands.forEach((c, i) => {
      const bw = w * (1 - i * 0.2);
      g.fillStyle = c;
      g.fillRect(Math.round(bx + (w - bw) / 2), by + 4 + i, Math.round(bw), h - 8 - i * 2);
    });
    g.fillStyle = '#000';
    g.fillRect(Math.round(bx + w / 2), by, 1, h);
    // Cursor
    const show = !a.done || Math.floor(a.flash / 3) % 2 === 0;
    if (show) {
      g.fillStyle = a.done ? (a.acc > 0.93 ? '#ffd84a' : '#fffaf2') : '#fffaf2';
      g.fillRect(Math.round(bx + a.x) - 2, by - 2, 4, h + 4);
      g.fillStyle = '#000';
      g.fillRect(Math.round(bx + a.x) - 1, by, 2, h);
    }
  }

  private drawHud(g: CanvasRenderingContext2D): void {
    const y = 143;
    drawText(g, this.hudName, 14, y, { color: '#fffaf2' });
    drawText(g, `NV ${level(G.state)}`, 48, y, { color: '#fffaf2' });
    drawText(g, 'PV', 88, y, { color: '#fffaf2' });
    const maxw = Math.min(70, 24 + this.maxHp);
    bar(g, 104, y + 3, maxw, 7, this.hp / this.maxHp, this.hp / this.maxHp < 0.3 ? '#ff4a5a' : '#ffd84a', '#5a1c2c', this.hpGhost / this.maxHp);
    drawText(g, `${this.hp}/${this.maxHp}`, 108 + maxw, y, { color: '#fffaf2' });
    const label = soulLabel(this.soulEmo, this.soulEmo2);
    const lw = measure(label);
    const [c1, c2] = this.soulColors();
    soulHeart(g, W - 22 - lw, y + 3, c1, c2);
    if (c2) {
      // « DOUX-AMER »: each half in its color.
      const dash = label.indexOf('-') + 1 || Math.ceil(label.length / 2);
      const head = label.slice(0, dash);
      drawText(g, head, W - 12 - lw, y, { color: c1 });
      drawText(g, label.slice(dash), W - 12 - lw + measure(head), y, { color: c2 });
    } else drawText(g, label, W - 12 - lw, y, { color: c1 });
    if (G.settings.emotionShapes) {
      if (this.soulEmo2) {
        drawEmoIcon(g, this.soulEmo2, W - 30 - lw, y + 3, c2!, '#0b0710');
        drawEmoIcon(g, this.soulEmo, W - 37 - lw, y + 3, c1, '#0b0710');
      } else drawEmoIcon(g, this.soulEmo, W - 30 - lw, y + 3, c1, '#0b0710');
    }
  }

  private drawMenu(g: CanvasRenderingContext2D): void {
    const y = 157;
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * 76;
      const sel = this.menuIdx === i && (this.mode === 'menu' || this.mode === 'list' || this.mode === 'notebook' || this.mode === 'bar');
      const disabled = this.menuDisabled[i];
      const color = disabled ? '#4e4359' : sel ? '#ffd84a' : '#f09a4a';
      g.fillStyle = color;
      g.fillRect(x, y, 72, 18);
      g.fillStyle = '#000';
      g.fillRect(x + 1, y + 1, 70, 16);
      const label = this.menuLabels[i] ?? '';
      const lw = measure(label);
      // Long labels (« SE RÉVEILLER ») take the whole button: no icon, centered.
      if (lw > 56) {
        drawText(g, label, x + 1 + Math.floor((70 - lw) / 2), y + 3, { color });
        continue;
      }
      if (sel && this.mode === 'menu') soulHeart(g, x + 5, y + 6, ...this.soulColors());
      else drawText(g, ICONS[i]!, x + 5, y + 3, { color });
      drawText(g, label, x + 14 + Math.floor((56 - lw) / 2), y + 3, { color });
    }
  }

  private drawNotebook(g: CanvasRenderingContext2D): void {
    const nb = this.nb!;
    const x = 44;
    const y = 10;
    const w = 232;
    const h = 128;
    // Paper
    g.fillStyle = '#4e3528';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#fff6e0';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#d7e6f7';
    for (let ly = y + 22; ly < y + h - 4; ly += 14) g.fillRect(x + 2, ly, w - 4, 1);
    g.fillStyle = '#f08a9a';
    g.fillRect(x + 18, y, 1, h);
    // Spiral
    g.fillStyle = '#8a7f96';
    for (let sy = y + 6; sy < y + h; sy += 10) g.fillRect(x - 3, sy, 6, 2);
    drawText(g, `Carnet — ${nb.target.name}`, x + 24, y + 6, { color: '#2b2a5c' });
    this.drawCalm(g, x + w - 10 - Math.min(6, nb.target.total) * 8, y + 9, nb.target);
    if (nb.writing) {
      const wd = nb.writing.word;
      const n = Math.min(wd.text.length, Math.floor(nb.writing.t / 4));
      const txt = wd.text.slice(0, n);
      const scale = 2;
      const tw = measure(wd.text) * scale;
      const tx = x + w / 2 - tw / 2;
      drawText(g, txt, tx, y + 52, { color: wd.emotion === 'neutre' ? '#2b2a5c' : EMOTION_COLOR[wd.emotion], scale, shadow: '#2b2a5c' });
      if (wd.emotion2) {
        // Bittersweet: the lower half of the letters in the second color.
        g.save();
        g.beginPath();
        g.rect(tx - 2, y + 52 + 5 * scale, tw + 4, 20);
        g.clip();
        drawText(g, txt, tx, y + 52, { color: EMOTION_COLOR[wd.emotion2], scale, shadow: '#2b2a5c' });
        g.restore();
      }
      // Pencil
      const px = x + w / 2 - tw / 2 + measure(txt) * scale + 2;
      g.fillStyle = '#f5c04f';
      g.fillRect(px, y + 48, 3, 12);
      g.fillStyle = '#2b2a5c';
      g.fillRect(px + 1, y + 60, 1, 2);
      return;
    }
    // Observe
    const obsSel = nb.idx === 0;
    if (obsSel) this.drawPencil(g, x + 22, y + 26);
    drawText(g, 'Observer', x + 34, y + 23, { color: obsSel ? '#c46a2e' : '#6e4a3a' });
    // Words
    nb.words.forEach((wd, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const wx = x + 34 + col * 100;
      const wy = y + 51 + row * 25;
      const sel = nb.idx === i + 1;
      let label = wd.text;
      if (nb.scramble) label = scramble(label, this.t + i);
      if (!nb.scramble) this.drawWordMark(g, wd, wx, wy, label);
      if (sel) this.drawPencil(g, wx - 16, wy + 2);
      drawText(g, label, wx, wy, { color: sel ? '#c46a2e' : '#2b2a5c' });
    });
    drawText(g, 'Un mot change ton cœur.', x + 24, y + h - 13, { color: '#8a7f96' });
  }

  /** The emotion mark before a word: a color square (split for bittersweet words), or shapes (accessibility). */
  private drawWordMark(g: CanvasRenderingContext2D, wd: WordDef, wx: number, wy: number, label: string): void {
    const c1 = wd.emotion === 'neutre' ? '#b7aab8' : EMOTION_COLOR[wd.emotion];
    const c2 = wd.emotion2 ? EMOTION_COLOR[wd.emotion2] : null;
    if (G.settings.emotionShapes) {
      drawEmoIcon(g, wd.emotion, wx - 8, wy + 3, c1, '#2b2a5c');
      if (wd.emotion2) drawEmoIcon(g, wd.emotion2, wx + measure(label) + 3, wy + 3, c2!, '#2b2a5c');
      return;
    }
    g.fillStyle = c1;
    g.fillRect(wx - 7, wy + 4, 4, 4);
    if (c2) {
      g.fillStyle = c2;
      g.fillRect(wx - 5, wy + 4, 2, 4);
      g.fillRect(wx - 6, wy + 6, 1, 2);
    }
    g.fillStyle = '#2b2a5c';
    g.globalAlpha = 0.4;
    g.fillRect(wx - 7, wy + 8, 4, 1);
    g.globalAlpha = 1;
  }

  private drawPencil(g: CanvasRenderingContext2D, x: number, y: number): void {
    const bob = Math.floor(this.t / 12) % 2;
    g.fillStyle = '#f5c04f';
    g.fillRect(x + bob, y, 7, 3);
    g.fillStyle = '#e07ba5';
    g.fillRect(x - 2 + bob, y, 2, 3);
    g.fillStyle = '#ecd3a0';
    g.fillRect(x + 7 + bob, y, 2, 3);
    g.fillStyle = '#2b2a5c';
    g.fillRect(x + 9 + bob, y + 1, 1, 1);
  }

  private drawBubble(g: CanvasRenderingContext2D, b: { e: EnemyRuntime; chars: RichChar[][]; shown: number; total: number }): void {
    const e = b.e;
    const lines = b.chars;
    const w = Math.max(40, ...lines.map((l) => measure(l.map((c) => c.ch).join('')))) + 10;
    const h = lines.length * LINE_HEIGHT + 6;
    let x = e.x + 28;
    if (x + w > W - 4) x = e.x - 28 - w;
    const y = Math.max(4, e.y - 70);
    g.fillStyle = '#0b0710';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#fffaf2';
    g.fillRect(x, y, w, h);
    // Tail
    const tx = x < e.x ? x + w : x - 4;
    g.fillRect(tx, y + 8, 4, 3);
    g.fillRect(x < e.x ? tx + 3 : tx - 1, y + 9, 2, 1);
    let count = 0;
    const shown = Math.floor(b.shown);
    lines.forEach((line, li) => {
      let cx = x + 5;
      for (const rc of line) {
        if (count++ >= shown) return;
        if (!rc.ch) continue;
        const dy = rc.fx === 'shake' ? Math.round(Math.random() * 2 - 1) : 0;
        cx += drawChar(g, rc.ch, cx, y + 2 + li * LINE_HEIGHT + dy, rc.color ?? '#1c1424');
      }
    });
  }
}

function charAt(lines: RichChar[][], i: number): RichChar | undefined {
  let n = i;
  for (const l of lines) {
    if (n < l.length) return l[n];
    n -= l.length;
  }
  return undefined;
}

function scramble(word: string, seed: number): string {
  const s = Math.floor(seed / 20);
  const chars = [...word];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = (s * 31 + i * 17) % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

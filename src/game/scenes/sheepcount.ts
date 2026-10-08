import { audio, parsePattern } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { hash2 } from '../../engine/math';
import { LULLABY_PATTERN } from '../../data/music';
import { buildSprite, drawSprite, type Sprite } from '../../engine/sprite';
import { ART as ENEMY_ART } from '../../data/sprites/enemies';
import { charSet, spr } from '../assets';
import { G } from '../state';
import { dialogue } from '../ui/dialogue';
import { box, heart, rect } from '../ui/draw';
import { tf, tr } from '../../i18n';

/**
 * Counting scene (generalized in v2). Three skins share the same rhythm engine:
 *   moutons  « Compter les moutons » (v1.1, chapter 1) — unchanged, described below;
 *   coups    knocks behind the wall between the two bedrooms (final battle, phase 3): the knocks of the wall must be
 *            counted, not those of the old radiator pipe (decoys); an « answer » mode then lets Noa knock back
 *            1, 2 or 3 times (1 « T'es là ? », 2 « Je suis là. », 3 « Bonne nuit. » — the code is never printed);
 *   dents    the music box at the heart of Dodo (chapter 6): pins ride the cylinder toward the comb, whose teeth are
 *            baby teeth; press as a pin passes the empty slot to put a tooth back, and the lullaby plays note by
 *            note. Sewing pins are the decoys.
 * The v1.1 sheep rounds, timings and texts are kept identical. Story mode (accessibility) slows the knocks and the
 * teeth and removes their decoys.
 *
 * « Compter les moutons » — chapter 1 rhythm minigame on the Colline aux Couvertures.
 *
 * Sheep trot in from the left and leap over a fence; the player presses A (or taps the screen) as each one passes
 * over it. Some hesitate, some come in pairs, a black sheep must NOT be counted, and in the last round the
 * Moutonnier closes his eyes: the player counts in their head and gives the total (asked by the story script).
 *
 * The leap is the exact arc, rhythm, sprites and « bêê » of Dodo's `sheep_count` pattern (battle/patterns.ts),
 * so the final battle brings it back.
 *
 * The scene stays on the stack for the whole session; the story script talks over it (dialogue is a global overlay)
 * and calls `play(round)` for each round.
 */

/** S normal · B black (don't count) · P pair (small then big) · H hesitates then jumps · Z hesitates and falls asleep. */
export type SheepKind = 'S' | 'B' | 'P' | 'H' | 'Z';

export interface SheepRound {
  title: string;
  /** Frames between two sheep. */
  interval: number;
  /** Timing window (± frames around the moment a sheep is above the fence). */
  window: number;
  /** Mistakes allowed before the Moutonnier gets lost. */
  tolerance: number;
  /** Eyes closed: no feedback, the total is asked at the end. */
  blind: boolean;
  /** One sequence per attempt (cycled), so retries of the blind round don't share the same answer. */
  seqs: SheepKind[][];
}

export const SHEEP_ROUNDS: SheepRound[] = [
  { title: 'Doucement', interval: 66, window: 18, tolerance: 2, blind: false, seqs: [['S', 'S', 'S', 'H', 'S', 'S']] },
  {
    title: 'Le mouton noir',
    interval: 54,
    window: 16,
    tolerance: 2,
    blind: false,
    seqs: [['S', 'S', 'B', 'S', 'P', 'B', 'H', 'S', 'S']],
  },
  {
    title: 'Les yeux fermés',
    interval: 48,
    window: 16,
    tolerance: 99,
    blind: true,
    seqs: [
      ['S', 'P', 'B', 'S', 'Z', 'S', 'P', 'B', 'H', 'S'],
      ['P', 'S', 'B', 'Z', 'S', 'B', 'P', 'S', 'H', 'S', 'S'],
      ['S', 'S', 'Z', 'P', 'B', 'S', 'H', 'B', 'P', 'S'],
    ],
  },
];

/** Knocks behind the wall (final battle, phase 3). B = a knock in the radiator pipe, Z = a scratch and nothing. */
export const KNOCK_ROUNDS: SheepRound[] = [
  { title: 'Le mur', interval: 72, window: 18, tolerance: 2, blind: false, seqs: [['S', 'S', 'B', 'S', 'H', 'S']] },
  { title: 'Le radiateur', interval: 62, window: 16, tolerance: 2, blind: false, seqs: [['S', 'B', 'P', 'S', 'B', 'Z', 'S', 'B', 'S']] },
  {
    title: 'Dans le noir',
    interval: 58,
    window: 16,
    tolerance: 99,
    blind: true,
    seqs: [
      ['S', 'B', 'P', 'Z', 'B', 'S', 'H', 'B'],
      ['B', 'S', 'S', 'B', 'Z', 'P', 'B', 'S'],
      ['S', 'Z', 'B', 'P', 'S', 'B', 'B', 'H'],
    ],
  },
];

/** The music box (chapter 6). B = a sewing pin, H = the cylinder stutters, Z = a pin rusts away before the comb. */
export const TOOTH_ROUNDS: SheepRound[] = [
  { title: 'Le peigne', interval: 58, window: 18, tolerance: 2, blind: false, seqs: [['S', 'S', 'S', 'H', 'S', 'S', 'S']] },
  { title: 'Les épingles', interval: 50, window: 16, tolerance: 2, blind: false, seqs: [['S', 'B', 'S', 'P', 'B', 'S', 'H', 'S', 'Z', 'S']] },
  { title: 'La berceuse', interval: 44, window: 15, tolerance: 3, blind: false, seqs: [['S', 'P', 'S', 'B', 'S', 'S', 'P', 'Z', 'S', 'B', 'S', 'H', 'S', 'S']] },
];

export type CountSkin = 'moutons' | 'coups' | 'dents';
export type CountRound = SheepRound;
export const COUNT_ROUNDS: Record<CountSkin, SheepRound[]> = { moutons: SHEEP_ROUNDS, coups: KNOCK_ROUNDS, dents: TOOTH_ROUNDS };
/** Noa's answer through the wall: how many times he knocks back. */
export type KnockAnswer = 1 | 2 | 3;

/** Texts of each skin (French; translated when drawn). */
interface SkinText {
  title: string;
  lost: string;
  decoy: string;
  waiting: string;
  done: string;
  hintTouch: string;
  hintPad: string;
  hintKey: string;
  hintBlind: string;
}
const SKIN_TEXT: Record<CountSkin, SkinText> = {
  moutons: {
    title: 'Compter les moutons',
    lost: 'Je… je me suis perdu…',
    decoy: 'Pas le noir !',
    waiting: "Il n'a pas sauté !",
    done: '{0} ! Tous comptés !',
    hintTouch: "Touche l'écran quand un mouton passe la barrière.",
    hintPad: 'Appuie sur A quand un mouton passe la barrière.',
    hintKey: 'Espace ou Entrée quand un mouton passe la barrière.',
    hintBlind: 'Les moutons qui sautent pour de vrai… et pas le noir.',
  },
  coups: {
    title: 'Compter les coups',
    lost: 'Tu as perdu le compte.',
    decoy: "C'était le radiateur.",
    waiting: "Rien n'a frappé.",
    done: '{0} coups.',
    hintTouch: "Touche l'écran à chaque coup dans le mur.",
    hintPad: 'Appuie sur A à chaque coup dans le mur.',
    hintKey: 'Espace ou Entrée à chaque coup dans le mur.',
    hintBlind: 'Les coups dans le mur… pas ceux du radiateur.',
  },
  dents: {
    title: 'La boîte à musique',
    lost: 'La mélodie se perd.',
    decoy: "Pas l'épingle !",
    waiting: 'Le cylindre a calé.',
    done: '{0} dents.',
    hintTouch: "Touche l'écran quand une goupille passe sous le trou.",
    hintPad: 'Appuie sur A quand une goupille passe sous le trou.',
    hintKey: 'Espace ou Entrée quand une goupille passe sous le trou.',
    hintBlind: 'Compte les dents dans ta tête…',
  },
};

/** The lullaby's melody, note by note (MIDI), for the music-box teeth. */
let lullabyNotes: number[] | null = null;
function lullabyNote(i: number): number {
  lullabyNotes ??= parsePattern(LULLABY_PATTERN).events.map((e) => e.midis[0]!);
  return lullabyNotes[i % lullabyNotes.length]!;
}

/** Number of sheep that must be counted in a sequence. */
export function validCount(seq: SheepKind[]): number {
  return seq.reduce((n, k) => n + (k === 'P' ? 2 : k === 'S' || k === 'H' ? 1 : 0), 0);
}

export interface SheepResult {
  ok: boolean;
  /** Sheep that should have been counted. */
  valid: number;
  counted: number;
  errors: number;
  /** Presses during a blind round. */
  taps: number;
}

const NUMBERS = [
  'zéro',
  'Un',
  'Deux',
  'Trois',
  'Quatre',
  'Cinq',
  'Six',
  'Sept',
  'Huit',
  'Neuf',
  'Dix',
  'Onze',
  'Douze',
  'Treize',
  'Quatorze',
  'Quinze',
];

// Stage geometry (the sheep's jump is the same as in the battle box).
const STAGE = { x: 20, y: 24, w: 280, h: 80 };
const GROUND = STAGE.y + STAGE.h - 12;
const FENCE = STAGE.x + STAGE.w / 2;
const TAKEOFF = FENCE - 48;
const VX = 1.4;
const VY = -2.6;
const AY = 0.075;
/** A tap registers on release: count it a few frames earlier. */
const TAP_LAG = 5;
/** Knocks: where Mina's knocks land on the wall, and the radiator (decoys), in stage pixels. */
const KNOCK_X = FENCE + 46;
const KNOCK_Y = GROUND - 34;
const RADIATOR_X = STAGE.x + 44;
/** Music box: the cylinder band and the comb's empty slot. */
const CYL_TOP = GROUND - 30;
const CYL_BOT = GROUND - 8;

interface Sheep {
  n: number;
  black: boolean;
  big: boolean;
  hes: 'jump' | 'sleep' | null;
  pause: number;
  x: number;
  /** Height offset (≤ 0 while airborne). */
  dy: number;
  vy: number;
  state: 'trot' | 'stop' | 'air' | 'away' | 'sleep' | 'gone';
  stateT: number;
  crossT: number | null;
  judged: boolean;
  penalized: boolean;
  flash: number;
  alpha: number;
}

interface Float {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

let blackSprites: { small: Sprite; big: Sprite } | null = null;
function blackSheep(big: boolean): Sprite {
  if (!blackSprites) {
    const art = (k: string): string => {
      const def = ENEMY_ART[k];
      return typeof def === 'string' ? def : (def?.art ?? '');
    };
    const colors = { w: '#4e4359', W: '#2d2238', g: '#2d2238', d: '#b7aab8' };
    blackSprites = { small: buildSprite(art('b_sheep'), { colors }), big: buildSprite(art('b_sheep_big'), { colors }) };
  }
  return big ? blackSprites.big : blackSprites.small;
}

/** Debug: `?sheep=auto` plays perfectly, `?sheep=fail` never presses (to test retries and the escape). */
function autoMode(): 'auto' | 'fail' | null {
  if (typeof location === 'undefined') return null;
  const v = new URLSearchParams(location.search).get('sheep');
  return v === 'auto' || v === 'fail' ? v : null;
}

export class CountingScene implements Scene {
  private t = 0;
  /** Answer mode (coups): Noa knocks back 1, 2 or 3 times. */
  private answering: { idx: number; picked: number; t: number } | null = null;
  private resolveAnswer: ((n: KnockAnswer) => void) | null = null;
  /** Noa's own knocks (answer mode): frames when they hit the wall. */
  private replies: number[] = [];
  /** Teeth put back in the music box this round. */
  private teeth = 0;

  constructor(
    readonly skin: CountSkin = 'moutons',
    private rounds: SheepRound[] = COUNT_ROUNDS[skin],
  ) {}
  private sheep: Sheep[] = [];
  private floats: Float[] = [];
  private queue: { t: number; kind: SheepKind; big: boolean; black: boolean; pause: number }[] = [];
  private round: SheepRound | null = null;
  private roundNo = 0;
  private roundT = 0;
  private counted = 0;
  private errors = 0;
  private taps = 0;
  private valid = 0;
  private failT = -1;
  private endT = -1;
  private spawned = 0;
  private bubble = '';
  private bubbleT = 0;
  private resolve: ((r: SheepResult) => void) | null = null;
  private auto = autoMode();
  private closing = false;

  /** Pushes the scene (idle stage) and returns it. `rounds` replaces the skin's default rounds. */
  static open(skin: CountSkin = 'moutons', rounds?: SheepRound[]): CountingScene {
    const s = new CountingScene(skin, rounds);
    game.push(s);
    return s;
  }

  /** The round being played or announced. */
  get roundDef(): SheepRound | null {
    return this.round;
  }

  private get text(): SkinText {
    return SKIN_TEXT[this.skin];
  }

  /** Accessibility (story mode): slower knocks and teeth, no decoys. The v1.1 sheep never change. */
  private get gentle(): boolean {
    return this.skin !== 'moutons' && G.settings.storyMode;
  }

  /** Late edge of the timing window: a knock can only be counted once heard. */
  private late(r: SheepRound): number {
    return this.skin === 'coups' ? r.window * 1.8 : r.window;
  }

  private inWindow(s: Sheep, pt: number, r: SheepRound): boolean {
    if (s.crossT === null) return false;
    const dt = pt - s.crossT;
    return this.skin === 'coups' ? dt >= -r.window * 0.4 && dt <= this.late(r) : Math.abs(dt) <= r.window;
  }

  close(): void {
    this.closing = true;
    game.remove(this);
    input.consume();
  }

  /** Shows the next round in the HUD (while the Moutonnier explains it). */
  announce(roundNo: number): void {
    this.round = this.rounds[Math.max(0, Math.min(this.rounds.length - 1, roundNo - 1))]!;
    this.teeth = 0;
    this.roundNo = roundNo;
    this.roundT = 0;
    this.counted = 0;
    this.errors = 0;
    this.taps = 0;
    this.failT = -1;
    this.endT = -1;
    this.spawned = 0;
    this.sheep = [];
    this.floats = [];
  }

  /** Plays one round (1-3). `attempt` picks the sequence variant. */
  play(roundNo: number, attempt = 0): Promise<SheepResult> {
    this.announce(roundNo);
    const def = this.round!;
    let seq = def.seqs[attempt % def.seqs.length]!;
    if (this.gentle) seq = seq.filter((k) => k !== 'B');
    const interval = Math.round(def.interval * (this.gentle ? 1.35 : 1));
    this.valid = validCount(seq);
    this.bubble = def.blind && this.skin === 'moutons' ? 'Zzz…' : '';
    // Schedule: hesitant sheep and pairs push the next one back so they never bump into each other.
    this.queue = [];
    let at = 50;
    let n = 0;
    const pairGap = this.skin === 'coups' ? 15 : 18;
    for (const kind of seq) {
      const pause = kind === 'H' ? 52 : kind === 'Z' ? 46 : 0;
      if (kind === 'P') {
        this.queue.push({ t: at, kind: 'S', big: false, black: false, pause: 0 });
        this.queue.push({ t: at + pairGap, kind: 'S', big: true, black: false, pause: 0 });
        at += pairGap;
        n += 2;
      } else {
        n++;
        this.queue.push({ t: at, kind, big: kind === 'S' && n % 4 === 0, black: kind === 'B', pause });
      }
      at += interval + pause + (kind === 'Z' ? 40 : 0);
    }
    return new Promise((r) => {
      this.resolve = r;
    });
  }

  private get playing(): boolean {
    return this.resolve !== null;
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  update(): void {
    this.t++;
    if (this.bubbleT > 0) this.bubbleT--;
    if (this.shakeT > 0) this.shakeT--;
    for (const f of this.floats) f.t++;
    this.floats = this.floats.filter((f) => f.t < 50);
    this.updateAnswer();
    if (!this.playing || !this.round) return;
    const r = this.round;
    const t = ++this.roundT;

    // Spawns (stop scheduling once the Moutonnier is lost).
    while (this.queue.length && this.queue[0]!.t <= t && this.failT < 0) {
      const q = this.queue.shift()!;
      const born: Sheep = {
        n: ++this.spawned,
        black: q.black,
        big: q.big,
        hes: q.kind === 'H' ? 'jump' : q.kind === 'Z' ? 'sleep' : null,
        pause: q.pause,
        x: STAGE.x - 10,
        dy: 0,
        vy: 0,
        state: 'trot',
        stateT: t,
        crossT: null,
        judged: false,
        penalized: false,
        flash: 0,
        alpha: 1,
      };
      this.sheep.push(born);
      if (this.skin === 'coups') this.startKnock(born, t);
    }
    if (this.failT >= 0) this.queue = [];

    for (const s of this.sheep) this.updateSheep(s, t);
    this.sheep = this.sheep.filter((s) => s.state !== 'gone');

    // Missed sheep.
    if (!r.blind) {
      for (const s of this.sheep) {
        if (!s.black && !s.judged && s.crossT !== null && t > s.crossT + this.late(r)) {
          s.judged = true;
          this.mistake('Oublié…');
        }
      }
    }

    // Input (ignored while someone talks over the stage).
    let press = false;
    let lag = 0;
    if (this.auto === 'auto') {
      press = this.sheep.some((s) => !s.black && !s.judged && s.crossT !== null && Math.abs(t - s.crossT) < 0.75);
    } else if (this.auto === null && !dialogue.busy) {
      if (input.pressed('a')) press = true;
      else if (input.tap) {
        press = true;
        lag = TAP_LAG;
      }
    }
    if (press && this.failT < 0) this.press(t - lag);

    // End of the round.
    if (this.failT >= 0 && t - this.failT > 70) this.finish(false);
    else if (this.failT < 0 && !this.queue.length && !this.sheep.length) {
      if (this.endT < 0) this.endT = t;
      else if (t - this.endT > 24) this.finish(r.blind ? true : this.errors <= r.tolerance);
    }
  }

  private updateSheep(s: Sheep, t: number): void {
    if (s.flash > 0) s.flash--;
    if (this.skin === 'coups') {
      this.updateKnock(s, t);
      return;
    }
    switch (s.state) {
      case 'trot':
        s.x += VX;
        if (s.crossT === null && s.x >= TAKEOFF) {
          if (s.hes) {
            s.state = 'stop';
            s.stateT = t;
            if (this.skin === 'moutons') audio.sfx('baa', { pitch: 1.25, vol: 0.25 });
            else audio.sfx('scratch', { pitch: 1.6, vol: 0.4 });
          } else this.leap(s, t);
        }
        if (s.x > STAGE.x + STAGE.w + 12) s.state = 'gone';
        break;
      case 'stop':
        if (t - s.stateT >= s.pause) {
          if (s.hes === 'jump') this.leap(s, t);
          else {
            s.state = 'sleep';
            s.stateT = t;
          }
        }
        break;
      case 'sleep':
        if (t - s.stateT > 40) s.alpha = Math.max(0, 1 - (t - s.stateT - 40) / 24);
        if (s.alpha <= 0) s.state = 'gone';
        break;
      case 'air':
        s.x += VX;
        s.dy += s.vy;
        s.vy += AY;
        if (s.dy >= 0 && s.vy > 0) {
          s.dy = 0;
          s.state = 'away';
        }
        break;
      case 'away':
        s.x += VX;
        if (s.x > STAGE.x + STAGE.w + 12) s.state = 'gone';
        break;
      case 'gone':
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Knocks (skin « coups »)
  // ---------------------------------------------------------------------------

  /** Wall shake after a knock (frames left). */
  private shakeT = 0;

  private startKnock(s: Sheep, t: number): void {
    s.x = s.black ? RADIATOR_X : KNOCK_X + (s.big ? 7 : 0);
    if (s.hes) {
      // A fingernail on the other side of the wall first.
      s.state = 'stop';
      s.stateT = t;
      audio.sfx('scratch', { vol: 0.7, pitch: 0.9 + Math.random() * 0.2 });
    } else this.knock(s, t);
  }

  private knock(s: Sheep, t: number): void {
    s.state = 'away';
    s.stateT = t;
    s.crossT = t;
    if (s.black) audio.sfx('pipe', { pitch: 0.95 + (s.n % 3) * 0.03 });
    else {
      audio.sfx('knock1', { pitch: s.big ? 1.05 : 1 });
      this.shakeT = 6;
    }
  }

  private updateKnock(s: Sheep, t: number): void {
    switch (s.state) {
      case 'stop':
        if (t - s.stateT >= s.pause) {
          if (s.hes === 'jump') this.knock(s, t);
          else {
            s.state = 'sleep';
            s.stateT = t;
          }
        }
        break;
      case 'sleep':
        if (t - s.stateT > 20) s.alpha = Math.max(0, 1 - (t - s.stateT - 20) / 20);
        if (s.alpha <= 0) s.state = 'gone';
        break;
      case 'away':
        if (t - s.stateT > 70) s.state = 'gone';
        break;
      default:
        break;
    }
  }

  /**
   * Answer mode (skin « coups »): Noa knocks back on the wall, once, twice or three times. Resolves with the number.
   * The meaning of each answer is the story's business (never printed here).
   */
  answer(): Promise<KnockAnswer> {
    this.answering = { idx: 0, picked: 0, t: 0 };
    this.replies = [];
    input.consume();
    return new Promise((r) => {
      this.resolveAnswer = r;
    });
  }

  private updateAnswer(): void {
    const a = this.answering;
    if (!a) return;
    a.t++;
    if (!a.picked) {
      if (dialogue.busy || a.t < 10) return;
      const hit = hits.pick(this);
      if (hit && typeof hit.id === 'number') {
        if (hit.id !== a.idx) audio.sfx('move');
        a.idx = hit.id;
        if (hit.tap) this.pickAnswer(a);
        return;
      }
      if (input.repeat('left') || input.repeat('up')) {
        a.idx = (a.idx + 2) % 3;
        audio.sfx('move');
      } else if (input.repeat('right') || input.repeat('down')) {
        a.idx = (a.idx + 1) % 3;
        audio.sfx('move');
      } else if (input.pressed('a')) this.pickAnswer(a);
      return;
    }
    const k = a.t - 12;
    if (k >= 0 && k % 26 === 0 && k / 26 < a.picked) {
      audio.sfx('knock1', { pitch: 0.92, vol: 1.1 });
      this.replies.push(this.t);
      this.shakeT = 6;
    }
    if (k > (a.picked - 1) * 26 + 40) {
      const n = a.picked as KnockAnswer;
      this.answering = null;
      const r = this.resolveAnswer;
      this.resolveAnswer = null;
      input.consume();
      r?.(n);
    }
  }

  private pickAnswer(a: { idx: number; picked: number; t: number }): void {
    audio.sfx('select');
    a.picked = a.idx + 1;
    a.t = 0;
    input.consume();
  }

  private leap(s: Sheep, t: number): void {
    if (this.skin === 'dents') {
      // The pin rolls on with the cylinder toward the comb.
      s.state = 'away';
      s.stateT = t;
      s.crossT = t + (FENCE - s.x) / VX;
      if (s.hes) audio.sfx('tooth', { pitch: 0.5, vol: 0.5 });
      return;
    }
    s.state = 'air';
    s.stateT = t;
    s.vy = VY;
    s.crossT = t + (FENCE - s.x) / VX;
    // Same « bêê » as the battle pattern, pitch climbing with each sheep.
    audio.sfx('baa', { pitch: 0.8 + (s.n % 5) * 0.08, vol: 0.5 });
  }

  private press(pt: number): void {
    const r = this.round!;
    if (r.blind) {
      this.taps++;
      audio.sfx('blip', { pitch: 1.6, vol: 0.4 });
      return;
    }
    let best: Sheep | null = null;
    for (const s of this.sheep) {
      if (s.judged || !this.inWindow(s, pt, r)) continue;
      if (!best || Math.abs(pt - s.crossT!) < Math.abs(pt - best.crossT!)) best = s;
    }
    if (best) {
      best.judged = true;
      if (best.black) {
        best.flash = 20;
        this.mistake(this.text.decoy);
        if (this.skin === 'dents') audio.note('musicbox', lullabyNote(this.teeth) - 1, 0.6, 0.5);
        return;
      }
      this.counted++;
      best.flash = 14;
      const word = tf('{0} !', tr(NUMBERS[this.counted] ?? String(this.counted)));
      if (this.skin === 'moutons') {
        this.floats.push({ text: word, x: best.x, y: GROUND - 54, t: 0, color: '#ffe991' });
        this.say(word);
        audio.sfx('chime', { pitch: 0.9 + this.counted * 0.05, vol: 0.5 });
      } else if (this.skin === 'coups') {
        this.floats.push({ text: word, x: KNOCK_X, y: KNOCK_Y - 22, t: 0, color: '#ffe991' });
        audio.sfx('chime', { pitch: 0.6 + this.counted * 0.03, vol: 0.25 });
      } else {
        this.floats.push({ text: word, x: FENCE, y: CYL_TOP - 24, t: 0, color: '#fff3cf' });
        audio.note('musicbox', lullabyNote(this.teeth), 0.9, 0.7);
        audio.sfx('tooth');
        this.teeth++;
      }
      return;
    }
    const waiting = this.sheep.find((s) => (s.state === 'stop' || s.state === 'sleep') && !s.penalized);
    if (waiting) {
      waiting.penalized = true;
      this.mistake(this.text.waiting);
      return;
    }
    // A press with no sheep around: harmless.
    audio.sfx('blip', { pitch: 0.7, vol: 0.3 });
    this.floats.push({ text: '?', x: FENCE, y: GROUND - 30, t: 20, color: '#b7aab8' });
  }

  private mistake(text: string): void {
    const r = this.round!;
    this.errors++;
    audio.sfx('miss');
    this.floats.push({ text, x: FENCE, y: GROUND - 62, t: 0, color: '#f8b6cf' });
    if (this.errors > r.tolerance) {
      this.failT = this.roundT;
      this.say(this.text.lost);
    } else if (this.skin === 'moutons') this.say('Euh…');
  }

  private say(text: string): void {
    this.bubble = text;
    this.bubbleT = 70;
  }

  private finish(ok: boolean): void {
    const res: SheepResult = { ok, valid: this.valid, counted: this.counted, errors: this.errors, taps: this.taps };
    const resolve = this.resolve;
    this.resolve = null;
    this.bubble = ok && !this.round?.blind ? tf(this.text.done, tr(NUMBERS[this.counted] ?? String(this.counted))) : this.bubble;
    this.bubbleT = ok ? 90 : 0;
    this.sheep = [];
    resolve?.(res);
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D): void {
    if (this.closing) return;
    if (this.skin === 'coups') {
      this.drawKnockRoom(g);
      this.drawKnockStage(g);
      this.drawHud(g);
      this.drawKnockForeground(g);
      this.drawHint(g);
      this.drawAnswer(g);
      return;
    }
    if (this.skin === 'dents') {
      this.drawCotton(g);
      this.drawBoxStage(g);
      this.drawHud(g);
      this.drawCottonForeground(g);
      this.drawHint(g);
      return;
    }
    this.drawNight(g);
    this.drawStage(g);
    this.drawHud(g);
    this.drawForeground(g);
  }

  private drawNight(g: CanvasRenderingContext2D): void {
    const bands = ['#15172a', '#1a1c32', '#22243a', '#2b2946', '#33365a'];
    bands.forEach((c, i) => rect(g, 0, Math.floor((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1, c));
    // Stars.
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(hash2(i, 3, 77) * W);
      const y = Math.floor(hash2(i, 9, 77) * 120);
      const tw = (this.t + i * 23) % 140 < 12;
      rect(g, x, y, 1, 1, tw ? '#fffaf2' : '#8a8fb0');
    }
    // Falling cotton.
    for (let i = 0; i < 26; i++) {
      const sp = 0.18 + hash2(i, 1, 13) * 0.25;
      const x = (hash2(i, 2, 13) * W + Math.sin((this.t + i * 40) / 50) * 6 + W) % W;
      const y = (hash2(i, 4, 13) * H + this.t * sp) % H;
      rect(g, x, y, 2, 2, '#ece2df');
    }
  }

  private drawStage(g: CanvasRenderingContext2D): void {
    const { x, y, w, h } = STAGE;
    box(g, x - 2, y - 2, w + 4, h + 4, 'dream');
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    // Dusk sky.
    const sky = ['#63489a', '#9a7bd0', '#b39bdc', '#d4b8f0', '#f8b6cf'];
    const skyH = GROUND - y;
    sky.forEach((c, i) => rect(g, x, y + Math.floor((i * skyH) / sky.length), w, Math.ceil(skyH / sky.length) + 1, c));
    // A sleepy moon.
    this.drawMoon(g, x + w - 34, y + 16);
    // Distant cotton hills.
    for (let i = 0; i < w; i += 2) {
      const hh = 6 + Math.round(Math.sin(i / 23) * 3 + Math.sin(i / 9 + 1) * 1.5);
      rect(g, x + i, GROUND - hh, 2, hh, '#ece2df');
    }
    // Quilt ground.
    for (let qx = 0; qx < w; qx += 14) {
      const c = Math.floor(qx / 14) % 2 ? '#f8b6cf' : '#d4b8f0';
      rect(g, x + qx, GROUND, 14, h - (GROUND - y), c);
      for (let sx = 2; sx < 14; sx += 3) rect(g, x + qx + sx, GROUND + 2, 1, 1, '#fffaf2');
    }
    rect(g, x, GROUND, w, 1, '#e07ba5');
    // Timing aid: the fence glows while a sheep is above it.
    const r = this.round;
    const glow =
      this.playing &&
      !!r &&
      !r.blind &&
      this.sheep.some((s) => s.crossT !== null && !s.judged && Math.abs(this.roundT - s.crossT) <= r.window);
    this.drawFence(g, glow);
    // Sheep.
    for (const s of this.sheep) this.drawSheep(g, s);
    // Floating words.
    for (const f of this.floats) {
      const a = f.t < 36 ? 1 : 1 - (f.t - 36) / 14;
      const fy = f.y - Math.min(10, f.t / 3);
      const ft = tr(f.text);
      const fx = Math.max(x + measure(ft) / 2 + 2, Math.min(x + w - measure(ft) / 2 - 2, f.x));
      drawText(g, ft, Math.round(fx), Math.round(fy), {
        align: 'center',
        color: f.color,
        shadow: '#1c1424',
        alpha: a,
      });
    }
    g.restore();
  }

  private drawMoon(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    for (let dy = -7; dy <= 7; dy++) {
      const half = Math.floor(Math.sqrt(49 - dy * dy));
      rect(g, cx - half, cy + dy, half * 2 + 1, 1, '#fff3cf');
      const sh = Math.floor(Math.sqrt(Math.max(0, 36 - (dy + 1) * (dy + 1))));
      if (sh > 0) rect(g, cx - half, cy + dy, Math.max(0, half - sh + 1), 1, '#ecd3a0');
    }
    // Closed eye and a little « z ».
    rect(g, cx + 1, cy, 3, 1, '#a8774f');
    if (Math.floor(this.t / 40) % 2) drawText(g, 'z', cx + 9, cy - 12, { color: '#fffaf2' });
  }

  private drawFence(g: CanvasRenderingContext2D, glow: boolean): void {
    const post = (px: number, ph: number): void => {
      rect(g, px - 1, GROUND - ph - 1, 8, ph + 1, '#1c1424');
      rect(g, px, GROUND - ph, 6, ph, '#dcb488');
      rect(g, px + 4, GROUND - ph, 2, ph, '#a8774f');
      rect(g, px, GROUND - ph, 6, 1, '#fff3cf');
    };
    // Rails, then the posts (the middle one has the same size as the battle's fence post).
    for (const ry of [GROUND - 11, GROUND - 6]) {
      rect(g, FENCE - 26, ry - 1, 52, 4, '#1c1424');
      rect(g, FENCE - 25, ry, 50, 2, '#dcb488');
    }
    post(FENCE - 27, 11);
    post(FENCE + 21, 11);
    if (glow) {
      rect(g, FENCE - 5, GROUND - 17, 10, 17, '#ffe991');
      rect(g, FENCE - 4, GROUND - 22, 8, 3, '#ffe991');
    }
    post(FENCE - 3, 14);
  }

  private drawSheep(g: CanvasRenderingContext2D, s: Sheep): void {
    const base = s.black ? blackSheep(s.big) : spr(s.big ? 'b_sheep_big' : 'b_sheep');
    const moving = s.state === 'trot' || s.state === 'away';
    const bob = moving && Math.floor((this.roundT + s.n * 3) / 5) % 2 ? -1 : 0;
    const sx = Math.round(s.x);
    const sy = Math.round(GROUND + s.dy + bob);
    // Shadow on the ground.
    const shw = Math.max(4, Math.round(base.w * 0.7 + s.dy / 8));
    g.globalAlpha = s.alpha * 0.35;
    rect(g, sx - shw / 2, GROUND, shw, 2, '#63489a');
    g.globalAlpha = 1;
    if (s.state === 'sleep') {
      drawSprite(g, base, sx, sy, { alpha: s.alpha, scaleY: 0.7 });
      if ((this.roundT - s.stateT) % 30 < 20)
        drawText(g, 'z', sx + 6, sy - 14 - ((this.roundT - s.stateT) % 30) / 4, { color: '#fffaf2', alpha: s.alpha });
      return;
    }
    drawSprite(g, base, sx, sy, { alpha: s.alpha });
    if (s.flash > 0 && s.flash % 4 < 2) {
      g.globalAlpha = 0.6;
      g.globalCompositeOperation = 'lighter';
      drawSprite(g, base, sx, sy);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    if (s.state === 'stop') {
      const k = this.roundT - s.stateT;
      drawText(g, k < s.pause / 2 ? '?' : '…', sx, sy - base.h - 10 - (k % 20 < 10 ? 1 : 0), {
        align: 'center',
        color: '#fffaf2',
        shadow: '#1c1424',
      });
    }
  }

  private drawHud(g: CanvasRenderingContext2D): void {
    const r = this.round;
    if (!r) {
      drawText(g, tr(this.text.title), W / 2, 8, { align: 'center', color: '#ffe991', shadow: '#1c1424' });
      return;
    }
    const roundLabel = tf('Manche {0}/{1} · ', this.roundNo, this.rounds.length);
    drawText(g, roundLabel, STAGE.x, 8, { color: '#fffaf2', shadow: '#1c1424' });
    drawText(g, tr(r.title), STAGE.x + measure(roundLabel), 8, { color: '#ffe991', shadow: '#1c1424' });
    const right = STAGE.x + STAGE.w;
    if (r.blind) {
      drawText(g, tr('Compte dans ta tête…'), right, 8, { align: 'right', color: '#d4b8f0', shadow: '#1c1424' });
      return;
    }
    const label = tf('Comptés : {0}', this.counted);
    drawText(g, label, right, 8, { align: 'right', color: '#fffaf2', shadow: '#1c1424' });
    // Cotton balls = mistakes still allowed.
    const left = right - measure(label) - 8;
    for (let i = 0; i < r.tolerance; i++) {
      const cx = left - i * 9;
      const used = i < this.errors;
      rect(g, cx - 3, 10, 7, 5, used ? '#3e4160' : '#fffaf2');
      rect(g, cx - 2, 9, 5, 7, used ? '#3e4160' : '#fffaf2');
      if (!used) rect(g, cx - 1, 10, 2, 1, '#ffffff');
    }
  }

  private drawForeground(g: CanvasRenderingContext2D): void {
    // The hill in the foreground (a darker, night-time quilt).
    const top = 126;
    for (let qx = 0; qx < W; qx += 16) {
      const lift = Math.round(Math.sin(qx / 60) * 3);
      for (let qy = top + lift; qy < H; qy += 16) {
        const odd = (Math.floor(qx / 16) + Math.floor((qy - top) / 16)) % 2;
        rect(g, qx, qy, 16, 16, odd ? '#63489a' : '#4a4e78');
        // Stitches and a little motif, like the hill's quilt.
        for (let k = 1; k < 16; k += 3) {
          rect(g, qx + k, qy + 1, 1, 1, '#7d6f86');
          rect(g, qx + 1, qy + k, 1, 1, '#7d6f86');
        }
        rect(g, qx + 7, qy + 7, 2, 2, odd ? '#9a7bd0' : '#6d8fd6');
      }
      rect(g, qx, top + lift - 1, 16, 1, '#9a7bd0');
    }
    // The Moutonnier, left; Noa and Mina watching, right.
    const mouton = charSet('mouton');
    if (mouton) drawSprite(g, mouton.right[0]!, 58, 160);
    const noa = charSet('noa');
    if (noa) drawSprite(g, noa.up[0]!, 250, 166);
    const mina = charSet('mina');
    if (mina && G.state.party.includes('mina')) drawSprite(g, mina.up[0]!, 268, 164);
    // His speech bubble.
    const text = tr(this.bubbleT > 0 || (this.round?.blind && this.playing) ? this.bubble : '');
    if (text) {
      const bw = measure(text) + 10;
      const bx = 70;
      const by = 130;
      rect(g, bx - 1, by - 1, bw + 2, 15, '#1c1424');
      rect(g, bx, by, bw, 13, '#fffaf2');
      rect(g, bx - 3, by + 9, 3, 2, '#fffaf2');
      drawText(g, text, bx + 5, by + 3, { color: '#2b2a5c' });
    }
    this.drawHint(g);
  }

  /** Controls hint under the stage. */
  private drawHint(g: CanvasRenderingContext2D): void {
    if (!this.playing || !this.round) return;
    const touch = input.lastDevice === 'touch';
    const t = this.text;
    const hint = this.round.blind ? t.hintBlind : touch ? t.hintTouch : input.lastDevice === 'gamepad' ? t.hintPad : t.hintKey;
    drawText(g, tr(hint), W / 2, STAGE.y + STAGE.h + 6, { align: 'center', color: '#b7aab8', shadow: '#1c1424' });
  }

  /** A caption under the stage for the skins without a talking Moutonnier (lost count, round over). */
  private drawCaption(g: CanvasRenderingContext2D): void {
    const text = tr(this.bubbleT > 0 ? this.bubble : '');
    if (text) drawText(g, text, W / 2, 128, { align: 'center', color: '#fff3cf', shadow: '#0b0710' });
  }

  // ---------------------------------------------------------------------------
  // Draw — knocks (« coups »): the wall between the two bedrooms, at night
  // ---------------------------------------------------------------------------

  private drawKnockRoom(g: CanvasRenderingContext2D): void {
    rect(g, 0, 0, W, H, '#0c0b14');
    // Noa's side of the wall: dark wallpaper, thin stripes, little crescent moons.
    for (let x = 4; x < W; x += 12) rect(g, x, 0, 1, H, '#13111d');
    for (let y = 10; y < H; y += 20) {
      for (let x = (y / 20) % 2 ? 10 : 4; x < W; x += 24) {
        rect(g, x, y, 2, 1, '#1b1829');
        rect(g, x - 1, y + 1, 1, 2, '#1b1829');
        rect(g, x, y + 3, 2, 1, '#1b1829');
      }
    }
    // The moonlight from the window, a pale slanted square on the wallpaper.
    g.globalAlpha = 0.05;
    for (let i = 0; i < 70; i++) rect(g, 236 - i * 0.5, 4 + i * 2, 54, 2, '#a7c7f0');
    g.globalAlpha = 1;
  }

  private drawKnockStage(g: CanvasRenderingContext2D): void {
    const { x, y, w, h } = STAGE;
    box(g, x - 2, y - 2, w + 4, h + 4, 'real');
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    const sh = this.shakeT > 0 && G.settings.shake ? (this.shakeT % 2 ? 1 : -1) : 0;
    // The wall, up close: Mina's wallpaper shows through where the paint flakes (sheep, a crown).
    rect(g, x, y, w, h, '#26223a');
    for (let sx = 6; sx < w; sx += 12) rect(g, x + sx + sh, y, 2, GROUND - y, '#2c2843');
    for (let sy = y + 8; sy < GROUND - 4; sy += 18) {
      for (let sx = ((sy - y) / 18) % 2 ? 14 : 2; sx < w; sx += 24) this.moonMotif(g, x + sx + sh, sy);
    }
    // A child's drawing taped to the wall: a sheep and a crown, in crayon.
    this.childDrawing(g, KNOCK_X - 70 + sh, KNOCK_Y - 14);
    // Hairline cracks around the knocking spot, longer with every knock counted.
    const crack = Math.min(5, this.counted);
    for (let i = 0; i < crack; i++) {
      const ang = i * 2.4 + 0.7;
      for (let k = 3; k < 6 + i * 3; k++) rect(g, Math.round(KNOCK_X + Math.cos(ang) * k + Math.sin(k) * 0.8) + sh, Math.round(KNOCK_Y + Math.sin(ang) * k * 0.7), 1, 1, '#141120');
    }
    // Skirting board and floor.
    rect(g, x, GROUND, w, y + h - GROUND, '#151120');
    rect(g, x, GROUND, w, 1, '#3a3550');
    rect(g, x, GROUND + 4, w, 1, '#1e1a2c');
    // The old radiator and its pipe along the wall (decoy knocks ring in it).
    const pipeKnock = this.sheep.some((s) => s.black && s.state === 'away' && this.roundT - s.stateT < 10);
    this.radiator(g, RADIATOR_X + (pipeKnock && G.settings.shake ? (this.t % 2 ? 1 : -1) : 0), GROUND);
    const blind = !!this.round?.blind;
    if (blind) {
      g.fillStyle = 'rgba(4,3,8,0.62)';
      g.fillRect(x, y, w, h);
    }
    // Timing aid: the spot glows while a knock can be counted.
    const r = this.round;
    if (this.playing && r && !r.blind && this.sheep.some((s) => !s.black && !s.judged && this.inWindow(s, this.roundT, r))) {
      g.globalAlpha = 0.25;
      this.disc(g, KNOCK_X + 3, KNOCK_Y, 9, '#ffe991');
      g.globalAlpha = 1;
    }
    for (const s of this.sheep) this.drawKnock(g, s, blind);
    // Noa's own knocks (answer mode), a little lower: his fist, his side of the wall.
    for (const at of this.replies) {
      const age = this.t - at;
      if (age < 40) this.rings(g, KNOCK_X - 26, KNOCK_Y + 14, age, '#d4b8f0', 1);
    }
    this.drawFloats(g);
    g.restore();
  }

  private drawKnock(g: CanvasRenderingContext2D, s: Sheep, blind: boolean): void {
    const age = this.roundT - s.stateT;
    if (s.state === 'stop' || s.state === 'sleep') {
      // Scratches: three little lines appearing, then fading if nothing knocks.
      const k = Math.min(1, age / Math.max(1, s.pause));
      g.globalAlpha = s.alpha * (blind ? 0.5 : 0.9);
      for (let i = 0; i < 3; i++) {
        const len = Math.round(k * 6);
        for (let j = 0; j < len; j++) rect(g, KNOCK_X - 4 + i * 4 + j, KNOCK_Y - 6 + j, 1, 1, '#b7aab8');
      }
      g.globalAlpha = 1;
      return;
    }
    if (s.state !== 'away') return;
    if (s.black) {
      // The radiator: a cold metallic ring on the pipe.
      this.rings(g, RADIATOR_X + 16, GROUND - 44, age, '#a7c7f0', blind ? 0.45 : 0.8);
      return;
    }
    this.rings(g, s.x, KNOCK_Y, age, s.flash > 0 ? '#ffffff' : '#ffe991', blind ? 0.45 : 1);
    // Plaster dust falling from the spot.
    for (let i = 0; i < 4; i++) {
      const dy = age * (0.5 + hash2(s.n, i, 3) * 0.5);
      if (dy > 40) continue;
      g.globalAlpha = (1 - dy / 40) * (blind ? 0.4 : 0.8);
      rect(g, s.x - 4 + Math.floor(hash2(s.n, i, 4) * 9), KNOCK_Y + 4 + dy, 1, 1, '#b7aab8');
    }
    g.globalAlpha = 1;
  }

  /** Expanding rings (dotted circles, flattened on the wall). */
  private rings(g: CanvasRenderingContext2D, cx: number, cy: number, age: number, color: string, alpha: number): void {
    for (let k = 0; k < 3; k++) {
      const rad = age * 1.1 - k * 7;
      if (rad <= 1 || rad > 30) continue;
      g.globalAlpha = alpha * (1 - rad / 30);
      const n = Math.max(8, Math.round(rad * 2.4));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        rect(g, Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad * 0.75), 1, 1, color);
      }
    }
    g.globalAlpha = 1;
  }

  private disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      rect(g, cx - half, cy + dy, half * 2 + 1, 1, color);
    }
  }

  private moonMotif(g: CanvasRenderingContext2D, x: number, y: number): void {
    rect(g, x + 1, y, 2, 1, '#3a3558');
    rect(g, x, y + 1, 1, 3, '#3a3558');
    rect(g, x + 1, y + 4, 2, 1, '#3a3558');
  }

  private childDrawing(g: CanvasRenderingContext2D, x: number, y: number): void {
    rect(g, x, y, 22, 16, '#d8d0bc');
    rect(g, x, y + 15, 22, 1, '#a89f8c');
    // Tape.
    rect(g, x + 8, y - 2, 6, 3, '#8a8fb0');
    // A crayon sheep (wobbly cloud, four legs) and a yellow crown above it.
    rect(g, x + 6, y + 7, 9, 4, '#fffaf2');
    rect(g, x + 7, y + 6, 7, 6, '#fffaf2');
    rect(g, x + 14, y + 7, 3, 3, '#4e4359');
    for (const lx of [7, 9, 12, 14]) rect(g, x + lx, y + 12, 1, 2, '#4e4359');
    rect(g, x + 8, y + 3, 6, 2, '#f5c04f');
    rect(g, x + 8, y + 2, 1, 1, '#f5c04f');
    rect(g, x + 11, y + 2, 1, 1, '#f5c04f');
    rect(g, x + 13, y + 2, 1, 1, '#f5c04f');
    // « N » in a corner, the way she signed his drawings.
    rect(g, x + 2, y + 11, 1, 3, '#e8505b');
    rect(g, x + 3, y + 12, 1, 1, '#e8505b');
    rect(g, x + 4, y + 11, 1, 3, '#e8505b');
  }

  private radiator(g: CanvasRenderingContext2D, x: number, floor: number): void {
    const top = floor - 26;
    // Pipe up the wall and along it (to Mina's room).
    rect(g, x + 15, STAGE.y, 3, top - STAGE.y + 2, '#3e4160');
    rect(g, x + 16, STAGE.y, 1, top - STAGE.y + 2, '#5c6080');
    rect(g, x + 15, floor - 46, 3, 3, '#2a2c44');
    rect(g, x - 15, top - 1, 32, 2, '#2a2c44');
    for (let i = 0; i < 5; i++) {
      const fx = x - 14 + i * 6;
      rect(g, fx, top, 5, 25, '#2a2c44');
      rect(g, fx + 1, top + 1, 3, 23, '#4a4e78');
      rect(g, fx + 1, top + 1, 1, 23, '#6d7398');
    }
    rect(g, x - 14, floor - 3, 30, 2, '#2a2c44');
    // A thermostat knob, set on 3.
    rect(g, x + 18, top + 4, 3, 4, '#8a8fb0');
  }

  private drawKnockForeground(g: CanvasRenderingContext2D): void {
    // Noa's room at night: floorboards, his bed against the wall on the right, Noa facing the wall.
    const top = 126;
    rect(g, 0, top, W, H - top, '#16131f');
    for (let y = top + 6; y < H; y += 7) rect(g, 0, y, W, 1, '#0f0d17');
    for (let i = 0; i < 18; i++) {
      const y = top + 6 + (i % 8) * 7;
      rect(g, Math.floor(hash2(i, 1, 81) * W), y - 6, 1, 6, '#0f0d17');
    }
    rect(g, 0, top, W, 1, '#2a2640');
    // The bed: wooden frame, the quilt hanging over the side, the pillow against the wall.
    const bx = 222;
    rect(g, bx, top + 2, W - bx, 30, '#2b2946');
    for (let qx = bx; qx < W; qx += 12) {
      for (let qy = top + 4; qy < top + 32; qy += 12) {
        const odd = (Math.floor((qx - bx) / 12) + Math.floor((qy - top) / 12)) % 2;
        rect(g, qx, qy, 12, 12, odd ? '#33365a' : '#2b2e4c');
        rect(g, qx + 1, qy + 1, 1, 1, '#4a4e78');
      }
    }
    rect(g, bx + 6, top + 2, 30, 8, '#6d7398');
    rect(g, bx + 7, top + 3, 28, 2, '#8a8fb0');
    rect(g, bx, top + 32, W - bx, 3, '#3a2c3c');
    rect(g, bx, top + 35, 3, H - top - 35, '#3a2c3c');
    rect(g, bx, top + 32, W - bx, 1, '#5a4a5c');
    const noa = charSet('noa');
    if (noa) drawSprite(g, noa.up[0]!, 196, 168);
    this.drawCaption(g);
  }

  private drawAnswer(g: CanvasRenderingContext2D): void {
    const a = this.answering;
    if (!a || a.picked) return;
    const bw = 236;
    const bx = Math.round((W - bw) / 2);
    const by = 132;
    box(g, bx, by, bw, 42, 'real');
    drawText(g, tr('Répondre :'), bx + 8, by + 3, { color: '#b7aab8' });
    for (let i = 0; i < 3; i++) {
      const ox = bx + 10 + i * 74;
      const oy = by + 17;
      const sel = i === a.idx;
      hits.add(this, i, ox - 2, oy - 2, 70, 22);
      if (sel) heart(g, ox + 2, oy + 6, '#ff4a5a');
      // One little fist (knuckles) per knock.
      for (let k = 0; k <= i; k++) {
        const kx = ox + 12 + k * 9;
        rect(g, kx, oy + 2, 7, 6, sel ? '#ffe991' : '#8a8fb0');
        rect(g, kx, oy + 2, 7, 1, sel ? '#fff3cf' : '#b7aab8');
        rect(g, kx + 2, oy + 3, 1, 3, '#2a2c44');
        rect(g, kx + 4, oy + 3, 1, 3, '#2a2c44');
      }
      drawText(g, tf(i === 0 ? '{0} coup' : '{0} coups', i + 1), ox + 12, oy + 8, { color: sel ? '#ffd84a' : '#fffaf2' });
    }
  }

  // ---------------------------------------------------------------------------
  // Draw — teeth (« dents »): the music box at the heart of Dodo
  // ---------------------------------------------------------------------------

  private drawCotton(g: CanvasRenderingContext2D): void {
    const bands = ['#1a130c', '#1f170f', '#251c12', '#2a2016', '#30251a'];
    bands.forEach((c, i) => rect(g, 0, Math.floor((i * H) / bands.length), W, Math.ceil(H / bands.length) + 1, c));
    // Damp cotton lumps.
    for (let i = 0; i < 26; i++) {
      const cx = Math.floor(hash2(i, 1, 51) * W);
      const cy = Math.floor(hash2(i, 2, 51) * H);
      const r = 4 + Math.floor(hash2(i, 3, 51) * 9);
      this.disc(g, cx, cy, r, i % 3 ? '#2e2418' : '#3a2e1e');
    }
    // Needles hanging from the top like stalactites.
    for (let i = 0; i < 18; i++) {
      const nx = Math.floor(hash2(i, 5, 52) * W);
      const len = 8 + Math.floor(hash2(i, 6, 52) * 18);
      rect(g, nx, 0, 1, len, '#6d7398');
      rect(g, nx, len, 1, 1, '#b7aab8');
    }
    // Mina's red thread, crossing the dark like a footbridge.
    for (let x = 0; x < W; x += 3) rect(g, x, Math.round(140 + Math.sin(x / 40) * 6 - x * 0.12), 2, 1, '#7a2030');
  }

  private drawBoxStage(g: CanvasRenderingContext2D): void {
    const { x, y, w, h } = STAGE;
    box(g, x - 2, y - 2, w + 4, h + 4, 'dream');
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    // Velvet lining.
    rect(g, x, y, w, h, '#3a1020');
    for (let sx = 0; sx < w; sx += 9) rect(g, x + sx + Math.round(Math.sin(sx / 13) * 2), y, 2, h, '#2e0c1a');
    // The comb: a steel bar, steel tines, and at the end of each tine a milk tooth.
    rect(g, x, y + 4, w, 7, '#4e4359');
    rect(g, x, y + 5, w, 4, '#8a8fb0');
    rect(g, x, y + 5, w, 1, '#b7aab8');
    for (let sx = 10; sx < w; sx += 40) rect(g, x + sx, y + 6, 2, 2, '#2d2238');
    const r = this.round;
    const glow = this.playing && !!r && this.sheep.some((s) => !s.black && !s.judged && this.inWindow(s, this.roundT, r));
    const lit = this.sheep.find((s) => s.flash > 0 && !s.black && s.judged);
    for (let tx = FENCE % 14; tx < x + w; tx += 14) {
      if (tx < x + 4) continue;
      const slot = tx === FENCE;
      const missing = slot || hash2(tx, 9, 61) < 0.25;
      rect(g, tx, y + 11, 1, CYL_TOP - y - 20, '#8a8fb0');
      if (!missing) this.tooth(g, tx, CYL_TOP - 11, 0);
      else if (!slot) {
        // A tooth missing for good: a dark socket and a loose end of red thread.
        rect(g, tx - 2, CYL_TOP - 11, 5, 3, '#1c0810');
        rect(g, tx + 1, CYL_TOP - 9, 1, 4, '#a8324a');
      }
    }
    // The empty slot: a socket ringed with red stitches, a frayed thread, a glow while a pin can take a tooth,
    // the tooth while it rings.
    if (lit) this.tooth(g, FENCE, CYL_TOP - 11, lit.flash % 4 < 2 ? 1 : -1);
    else {
      rect(g, FENCE - 4, CYL_TOP - 13, 9, 9, '#1c0810');
      for (let i = 0; i < 9; i += 2) {
        rect(g, FENCE - 4 + i, CYL_TOP - 14, 1, 1, '#e8505b');
        rect(g, FENCE - 4 + i, CYL_TOP - 4, 1, 1, '#e8505b');
      }
      rect(g, FENCE, CYL_TOP - 11, 1, 6, '#e8505b');
      rect(g, FENCE + 1, CYL_TOP - 6, 1, 3, '#e8505b');
    }
    if (glow) {
      rect(g, FENCE - 6, CYL_TOP - 16, 13, 1, '#ffe991');
      rect(g, FENCE - 6, CYL_TOP - 2, 13, 1, '#ffe991');
      rect(g, FENCE - 6, CYL_TOP - 16, 1, 15, '#ffe991');
      rect(g, FENCE + 6, CYL_TOP - 16, 1, 15, '#ffe991');
    }
    // The brass cylinder, turning.
    const rows = ['#5a4220', '#8a6a2e', '#c89a4a', '#f0d080', '#c89a4a', '#a07a38', '#8a6a2e', '#5a4220'];
    const rh = (CYL_BOT - CYL_TOP) / rows.length;
    rows.forEach((c, i) => rect(g, x, Math.round(CYL_TOP + i * rh), w, Math.ceil(rh), c));
    const off = Math.floor((this.playing ? this.roundT : this.t) * VX) % 8;
    for (let sx = off; sx < w; sx += 8) rect(g, x + sx, CYL_TOP + 2, 1, CYL_BOT - CYL_TOP - 4, '#a07a38');
    for (const s of this.sheep) this.drawPin(g, s);
    // The teeth put back this round, lined up on the velvet like in a little box.
    for (let i = 0; i < this.teeth; i++) this.tooth(g, x + 8 + i * 8, GROUND + 4, 0, true);
    this.drawFloats(g);
    g.restore();
  }

  /** A milk tooth (crown + root), optionally small. `wob` shakes it sideways (ringing). */
  private tooth(g: CanvasRenderingContext2D, cx: number, top: number, wob: number, small = false): void {
    const x = cx - (small ? 2 : 3) + wob;
    if (small) {
      rect(g, x, top, 4, 3, '#fffaf2');
      rect(g, x + 3, top, 1, 3, '#ecd3a0');
      rect(g, x, top + 3, 1, 1, '#ecd3a0');
      rect(g, x + 3, top + 3, 1, 1, '#ecd3a0');
      return;
    }
    rect(g, x + 1, top, 4, 1, '#fffaf2');
    rect(g, x, top + 1, 6, 4, '#fffaf2');
    rect(g, x + 4, top + 1, 2, 4, '#ecd3a0');
    rect(g, x + 1, top + 5, 1, 2, '#dcb488');
    rect(g, x + 4, top + 5, 1, 2, '#c98572');
    rect(g, x + 1, top + 1, 1, 1, '#ffffff');
  }

  private drawPin(g: CanvasRenderingContext2D, s: Sheep): void {
    const px = Math.round(s.x);
    const jitter = s.state === 'stop' ? (this.roundT % 4 < 2 ? 1 : 0) : 0;
    g.globalAlpha = s.alpha;
    if (s.black) {
      // A sewing pin stuck in the cylinder: thin needle, round red head.
      rect(g, px, CYL_TOP - 8, 1, 12, '#b7aab8');
      rect(g, px - 1, CYL_TOP - 11, 3, 3, s.flash % 4 < 2 ? '#e8505b' : '#ffffff');
      rect(g, px - 1, CYL_TOP - 11, 1, 1, '#f8b6cf');
    } else if (s.state === 'sleep') {
      // A pin rusting away before reaching the comb.
      rect(g, px - 1, CYL_TOP + 2, 3, 3, '#6e4a3a');
      if ((this.roundT - s.stateT) % 12 < 6) rect(g, px + 1, CYL_TOP + 6, 1, 1, '#6e4a3a');
    } else {
      // A brass pin standing out of the cylinder.
      const bx = px - 2 + jitter;
      rect(g, bx - 1, CYL_TOP - 4, 6, 7, '#3a2a12');
      rect(g, bx, CYL_TOP - 3, 4, 5, s.flash > 0 ? '#ffffff' : '#f0d080');
      rect(g, bx + 3, CYL_TOP - 3, 1, 5, '#c89a4a');
      rect(g, bx, CYL_TOP - 3, 1, 1, '#fff3cf');
    }
    g.globalAlpha = 1;
  }

  private drawCottonForeground(g: CanvasRenderingContext2D): void {
    // Yellowed cotton heaped at the bottom of the belly, a seam of red stitches across it.
    for (let x = 0; x < W; x++) {
      const top = 130 + Math.round(Math.sin(x / 17) * 3 + Math.sin(x / 7 + 1) * 1.5);
      rect(g, x, top, 1, H - top, '#4a3c26');
      if (hash2(x, 3, 71) < 0.3) rect(g, x, top + 2 + Math.floor(hash2(x, 4, 71) * 30), 1, 1, '#6a5838');
      rect(g, x, top, 1, 1, '#6a5838');
    }
    for (let x = 6; x < W; x += 8) rect(g, x, 150 + Math.round(Math.sin(x / 30) * 2), 4, 1, '#a8324a');
    const noa = charSet('noa');
    if (noa) drawSprite(g, noa.up[0]!, 250, 170);
    this.drawCaption(g);
  }

  private drawFloats(g: CanvasRenderingContext2D): void {
    const { x, w } = STAGE;
    for (const f of this.floats) {
      const a = f.t < 36 ? 1 : 1 - (f.t - 36) / 14;
      const fy = f.y - Math.min(10, f.t / 3);
      const ft = tr(f.text);
      const fx = Math.max(x + measure(ft) / 2 + 2, Math.min(x + w - measure(ft) / 2 - 2, f.x));
      drawText(g, ft, Math.round(fx), Math.round(fy), { align: 'center', color: f.color, shadow: '#1c1424', alpha: a });
    }
  }
}

/** v1.1 name of the counting scene (sheep skin by default). */
export const SheepCountScene = CountingScene;
export type SheepCountScene = CountingScene;

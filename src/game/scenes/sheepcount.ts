import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { hash2 } from '../../engine/math';
import { buildSprite, drawSprite, type Sprite } from '../../engine/sprite';
import { ART as ENEMY_ART } from '../../data/sprites/enemies';
import { charSet, spr } from '../assets';
import { G } from '../state';
import { dialogue } from '../ui/dialogue';
import { box, rect } from '../ui/draw';

/**
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

export class SheepCountScene implements Scene {
  private t = 0;
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

  /** Pushes the scene (idle stage) and returns it. */
  static open(): SheepCountScene {
    const s = new SheepCountScene();
    game.push(s);
    return s;
  }

  close(): void {
    this.closing = true;
    game.remove(this);
    input.consume();
  }

  /** Shows the next round in the HUD (while the Moutonnier explains it). */
  announce(roundNo: number): void {
    this.round = SHEEP_ROUNDS[Math.max(0, Math.min(SHEEP_ROUNDS.length - 1, roundNo - 1))]!;
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
    const seq = def.seqs[attempt % def.seqs.length]!;
    this.valid = validCount(seq);
    this.bubble = def.blind ? 'Zzz…' : '';
    // Schedule: hesitant sheep and pairs push the next one back so they never bump into each other.
    this.queue = [];
    let at = 50;
    let n = 0;
    for (const kind of seq) {
      const pause = kind === 'H' ? 52 : kind === 'Z' ? 46 : 0;
      if (kind === 'P') {
        this.queue.push({ t: at, kind: 'S', big: false, black: false, pause: 0 });
        this.queue.push({ t: at + 18, kind: 'S', big: true, black: false, pause: 0 });
        at += 18;
        n += 2;
      } else {
        n++;
        this.queue.push({ t: at, kind, big: kind === 'S' && n % 4 === 0, black: kind === 'B', pause });
      }
      at += def.interval + pause + (kind === 'Z' ? 40 : 0);
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
    for (const f of this.floats) f.t++;
    this.floats = this.floats.filter((f) => f.t < 50);
    if (!this.playing || !this.round) return;
    const r = this.round;
    const t = ++this.roundT;

    // Spawns (stop scheduling once the Moutonnier is lost).
    while (this.queue.length && this.queue[0]!.t <= t && this.failT < 0) {
      const q = this.queue.shift()!;
      this.sheep.push({
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
      });
    }
    if (this.failT >= 0) this.queue = [];

    for (const s of this.sheep) this.updateSheep(s, t);
    this.sheep = this.sheep.filter((s) => s.state !== 'gone');

    // Missed sheep.
    if (!r.blind) {
      for (const s of this.sheep) {
        if (!s.black && !s.judged && s.crossT !== null && t > s.crossT + r.window) {
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
    switch (s.state) {
      case 'trot':
        s.x += VX;
        if (s.crossT === null && s.x >= TAKEOFF) {
          if (s.hes) {
            s.state = 'stop';
            s.stateT = t;
            audio.sfx('baa', { pitch: 1.25, vol: 0.25 });
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

  private leap(s: Sheep, t: number): void {
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
      if (s.judged || s.crossT === null || Math.abs(pt - s.crossT) > r.window) continue;
      if (!best || Math.abs(pt - s.crossT) < Math.abs(pt - best.crossT!)) best = s;
    }
    if (best) {
      best.judged = true;
      if (best.black) {
        best.flash = 20;
        this.mistake('Pas le noir !');
        return;
      }
      this.counted++;
      best.flash = 14;
      const word = `${NUMBERS[this.counted] ?? this.counted} !`;
      this.floats.push({ text: word, x: best.x, y: GROUND - 54, t: 0, color: '#ffe991' });
      this.say(word);
      audio.sfx('chime', { pitch: 0.9 + this.counted * 0.05, vol: 0.5 });
      return;
    }
    const waiting = this.sheep.find((s) => (s.state === 'stop' || s.state === 'sleep') && !s.penalized);
    if (waiting) {
      waiting.penalized = true;
      this.mistake("Il n'a pas sauté !");
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
      this.say('Je… je me suis perdu…');
    } else this.say('Euh…');
  }

  private say(text: string): void {
    this.bubble = text;
    this.bubbleT = 70;
  }

  private finish(ok: boolean): void {
    const res: SheepResult = { ok, valid: this.valid, counted: this.counted, errors: this.errors, taps: this.taps };
    const resolve = this.resolve;
    this.resolve = null;
    this.bubble = ok && !this.round?.blind ? `${NUMBERS[this.counted] ?? this.counted} ! Tous comptés !` : this.bubble;
    this.bubbleT = ok ? 90 : 0;
    this.sheep = [];
    resolve?.(res);
  }

  // ---------------------------------------------------------------------------
  // Draw
  // ---------------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D): void {
    if (this.closing) return;
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
      const fx = Math.max(x + measure(f.text) / 2 + 2, Math.min(x + w - measure(f.text) / 2 - 2, f.x));
      drawText(g, f.text, Math.round(fx), Math.round(fy), {
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
      drawText(g, 'Compter les moutons', W / 2, 8, { align: 'center', color: '#ffe991', shadow: '#1c1424' });
      return;
    }
    drawText(g, `Manche ${this.roundNo}/3 · `, STAGE.x, 8, { color: '#fffaf2', shadow: '#1c1424' });
    drawText(g, r.title, STAGE.x + measure(`Manche ${this.roundNo}/3 · `), 8, { color: '#ffe991', shadow: '#1c1424' });
    const right = STAGE.x + STAGE.w;
    if (r.blind) {
      drawText(g, 'Compte dans ta tête…', right, 8, { align: 'right', color: '#d4b8f0', shadow: '#1c1424' });
      return;
    }
    const label = `Comptés : ${this.counted}`;
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
    const text = this.bubbleT > 0 || (this.round?.blind && this.playing) ? this.bubble : '';
    if (text) {
      const bw = measure(text) + 10;
      const bx = 70;
      const by = 130;
      rect(g, bx - 1, by - 1, bw + 2, 15, '#1c1424');
      rect(g, bx, by, bw, 13, '#fffaf2');
      rect(g, bx - 3, by + 9, 3, 2, '#fffaf2');
      drawText(g, text, bx + 5, by + 3, { color: '#2b2a5c' });
    }
    // Controls hint.
    if (this.playing && this.round) {
      const touch = input.lastDevice === 'touch';
      const hint = this.round.blind
        ? 'Les moutons qui sautent pour de vrai… et pas le noir.'
        : touch
          ? "Touche l'écran quand un mouton passe la barrière."
          : input.lastDevice === 'gamepad'
            ? 'Appuie sur A quand un mouton passe la barrière.'
            : 'Espace ou Entrée quand un mouton passe la barrière.';
      drawText(g, hint, W / 2, STAGE.y + STAGE.h + 6, { align: 'center', color: '#b7aab8', shadow: '#1c1424' });
    }
  }
}

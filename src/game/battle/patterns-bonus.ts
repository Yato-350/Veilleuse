import { audio } from '../../engine/audio';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import type { Bullet, BulletWorld } from './bullets';
import type { Pattern } from './patterns';

/*
 * Attack patterns of the bonus chapter « Les rêves des autres » (Maman's dream): the call bells and the coffee of the
 * night shift, the laundry basket, and Le Réveil (clock hands, alarm rings, the ticking).
 */

const pickEmo = (main: Emotion, whiteChance: number): Emotion => (rng.chance(whiteChance) ? 'neutre' : main);

/** An expanding ring with a gap, from (x, y). */
function wave(w: BulletWorld, x: number, y: number, speed: number, emo: Emotion, gapA: number, gapW = 1, warn = 18, dmg = 3): Bullet {
  return w.spawn({
    x,
    y,
    r: 2,
    shape: 'ring',
    dmg,
    emo,
    warn,
    clip: false,
    data: { gapA, gapW },
    update: (bl) => {
      bl.r += speed;
      if (bl.r > 150) bl.dead = true;
    },
  });
}

/** Angle from (x, y) towards the soul. */
const towardSoul = (w: BulletWorld, x: number, y: number): number => Math.atan2(w.soul.y - y, w.soul.x - x);

export const BONUS_PATTERNS: Record<string, Pattern> = {
  // ---------------------------------------------------------------------------
  // Sonnette — call bells
  // ---------------------------------------------------------------------------
  /** Bells ring along the top of the box: each sends a wave with a gap (aimed near the soul, never exactly on it). */
  call_bells: {
    box: { w: 130, h: 66 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(40, 58 - c.power * 6);
      if (t % every === 0 && t < 280) {
        const n = (c.mem.n = (c.mem.n ?? 0) + 1);
        const x = b.x + [0.15, 0.5, 0.85][n % 3]! * b.w;
        const y = b.y - 4;
        audio.sfx('beep', { pitch: 1.6 + (n % 3) * 0.15, vol: 0.4 });
        const gap = towardSoul(w, x, y) + rng.range(-0.5, 0.5);
        wave(w, x, y, 0.95 + c.power * 0.12, n % 3 === 0 ? 'neutre' : 'peur', gap, 1.15);
      }
    },
  },
  /** The red lights of the corridor: cells of the box light up (warning) then burn; a few stay dark. */
  call_lights: {
    box: { w: 120, h: 64 },
    duration: 320,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(52, 70 - c.power * 6);
      if (t % every === 10 && t < 270) {
        const cols = 4;
        const rows = 2;
        const cw = b.w / cols;
        const ch = b.h / rows;
        const safe = new Set([rng.int(0, cols * rows - 1), rng.int(0, cols * rows - 1)]);
        const emo: Emotion = rng.chance(0.4) ? 'neutre' : 'peur';
        for (let i = 0; i < cols * rows; i++) {
          if (safe.has(i)) continue;
          const x = b.x + (i % cols) * cw;
          const y = b.y + Math.floor(i / cols) * ch;
          w.zones.push({ x: x + 2, y: y + 2, w: cw - 4, h: ch - 4, emo, dmg: 3, warn: 34, life: 58 });
        }
      }
      // A few stray sparks between the waves.
      if (t % 24 === 0 && t < 290) {
        w.spawn({ x: rng.range(b.x, b.x + b.w), y: b.y - 4, vy: 0.9 + c.power * 0.1, shape: 'spark', r: 2, dmg: 2, emo: 'neutre', data: { ph: rng.int(0, 3) } });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Café Serré
  // ---------------------------------------------------------------------------
  /** The cup shakes and spills: drops fly up in arcs and fall back. */
  coffee_spill: {
    box: { w: 130, h: 64 },
    duration: 320,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(5, 9 - c.power);
      if (t % every === 0 && t < 280) {
        const x = b.x + b.w / 2 + Math.sin(t * 0.05) * (b.w * 0.3);
        w.spawn({
          x,
          y: b.y + b.h + 4,
          vx: rng.range(-1.1, 1.1),
          vy: -2.6 - rng.range(0, 0.6) - c.power * 0.1,
          ay: 0.065,
          shape: 'drop',
          r: 2,
          dmg: 3,
          emo: pickEmo('colere', 0.3),
          clip: false,
        });
      }
    },
  },
  /** Sugar cubes rain down in columns, jittering left and right. */
  coffee_jitter: {
    box: { w: 120, h: 64 },
    duration: 320,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(10, 16 - c.power * 2);
      if (t % every === 0 && t < 285) {
        const col = rng.int(0, 7);
        const x0 = b.x + 6 + col * ((b.w - 12) / 7);
        w.spawn({
          x: x0,
          y: b.y - 6,
          w: 5,
          h: 5,
          vy: 0.9 + c.power * 0.15,
          shape: 'rect',
          dmg: 3,
          emo: pickEmo('colere', 0.5),
          data: { x0, ph: rng.range(0, 6) },
          update: (bl) => {
            bl.x = bl.data.x0! - 2 + Math.round(Math.sin(bl.life * 0.6 + bl.data.ph!) * 3);
            if (bl.y > b.y + b.h + 4) bl.dead = true;
          },
        });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Le Panier
  // ---------------------------------------------------------------------------
  /** The washing machine: a ring of laundry turns around the centre, breathing in and out, with a gap. */
  laundry: {
    box: { w: 100, h: 74 },
    duration: 340,
    start(w, c) {
      const b = w.box;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const n = 12;
      const speed = 0.018 + c.power * 0.004;
      for (let i = 0; i < n; i++) {
        if (i === 0 || i === 1) continue;
        const a0 = (i / n) * Math.PI * 2;
        w.spawn({
          x: cx + Math.cos(a0) * 22,
          y: cy + Math.sin(a0) * 22 * 0.85,
          shape: i % 3 === 0 ? 'star' : 'yarn',
          r: 3,
          dmg: 3,
          emo: i % 4 === 0 ? 'neutre' : 'tristesse',
          warn: 30,
          clip: false,
          maxLife: 400,
          data: { a0 },
          update: (bl) => {
            const life = bl.life - 30;
            const a = bl.data.a0! + life * speed;
            const r = 22 + Math.sin(life * 0.022) * 14;
            bl.x = cx + Math.cos(a) * r;
            bl.y = cy + Math.sin(a) * r * 0.85;
            if (bl.life > 320) bl.dead = true;
          },
        });
      }
    },
    tick(w, t, c) {
      const b = w.box;
      // Socks thrown out of the drum now and then.
      if (t % Math.max(30, 44 - c.power * 6) === 20 && t < 300) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const a = rng.range(0, Math.PI * 2);
        w.spawn({ x: cx, y: cy, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, shape: 'yarn', r: 3, dmg: 3, emo: pickEmo('tristesse', 0.4) });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Le Réveil
  // ---------------------------------------------------------------------------
  /** The clock hands sweep the box from its centre: the long minute hand and the short hour hand. */
  clock_hands: {
    box: { w: 110, h: 84 },
    duration: 380,
    start(w, c) {
      const b = w.box;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const fast = 0.016 + c.power * 0.005;
      const hands: Array<{ len: number; from: number; speed: number; emo: Emotion; a0: number }> = [
        { len: 38, from: 9, speed: fast, emo: 'colere', a0: (33 / 60) * Math.PI * 2 },
        { len: 23, from: 8, speed: fast / 3, emo: 'neutre', a0: (15 / 60) * Math.PI * 2 },
      ];
      for (const h of hands) {
        for (let r = h.from; r <= h.len; r += 5) {
          w.spawn({
            x: cx + Math.cos(h.a0 - Math.PI / 2) * r,
            y: cy + Math.sin(h.a0 - Math.PI / 2) * r,
            shape: 'dot',
            r: 2,
            dmg: 3,
            emo: h.emo,
            warn: 36,
            clip: false,
            maxLife: 420,
            data: { r, a0: h.a0 },
            update: (bl) => {
              const a = bl.data.a0! + (bl.life - 36) * h.speed - Math.PI / 2;
              bl.x = cx + Math.cos(a) * bl.data.r!;
              bl.y = cy + Math.sin(a) * bl.data.r!;
              if (bl.life > 350) bl.dead = true;
            },
          });
        }
      }
      // The pivot (the soul starts on it: it only bites after a full second, time to step aside).
      w.spawn({ x: cx, y: cy, shape: 'dot', r: 3, dmg: 3, emo: 'neutre', warn: 60, clip: false, maxLife: 386 });
    },
    tick(w, t, c) {
      // Tick… tock: a small sound every second, and a stray tick mark from the edge.
      if (t % 30 === 0 && t < 350) {
        audio.sfx('knock', { pitch: t % 60 === 0 ? 2.2 : 1.8, vol: 0.25 });
        if (c.power >= 1 && t % 60 === 0) {
          const b = w.box;
          const a = rng.range(0, Math.PI * 2);
          const x = b.x + b.w / 2 + Math.cos(a) * 70;
          const y = b.y + b.h / 2 + Math.sin(a) * 50;
          const d = towardSoul(w, x, y);
          w.spawn({ x, y, vx: Math.cos(d) * 1.1, vy: Math.sin(d) * 1.1, shape: 'dot', r: 2, dmg: 3, emo: 'colere', warn: 14, clip: false });
        }
      }
    },
  },
  /** DRIIING: both bells hit in turn; shock waves from the top corners, the box trembles. */
  alarm_ring: {
    box: { w: 140, h: 70 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(26, 40 - c.power * 5);
      if (t % every === 0 && t < 310) {
        const left = (t / every) % 2 === 0;
        const x = left ? b.x - 2 : b.x + b.w + 2;
        const y = b.y - 2;
        audio.sfx('beep', { pitch: left ? 2.1 : 2.4, vol: 0.35 });
        const gap = towardSoul(w, x, y) + rng.range(-0.35, 0.35);
        wave(w, x, y, 1.25 + c.power * 0.12, pickEmo('colere', 0.35), gap, 0.75, 12, 4);
      }
      // Little sparks shaken off the bells.
      if (t % 14 === 0 && t < 320) {
        const left = rng.chance(0.5);
        w.spawn({
          x: left ? b.x + 6 : b.x + b.w - 6,
          y: b.y + 2,
          vx: (left ? 1 : -1) * rng.range(0.4, 1.4),
          vy: rng.range(0.3, 1),
          shape: 'spark',
          r: 2,
          dmg: 3,
          emo: 'neutre',
          bounce: 1,
          data: { ph: rng.int(0, 3) },
        });
      }
    },
  },
  /** Tick… tock: rows of tick marks fall on the beat (tick) and rise (tock), each with one gap. */
  tick_rain: {
    box: { w: 120, h: 66 },
    duration: 340,
    tick(w, t, c) {
      const b = w.box;
      const beat = Math.max(30, 42 - c.power * 4);
      if (t % beat === 0 && t < 290) {
        const tock = (t / beat) % 2 === 1;
        audio.sfx('knock', { pitch: tock ? 1.6 : 2.2, vol: 0.3 });
        const cols = 8;
        const gap = rng.int(0, cols - 2);
        for (let i = 0; i < cols; i++) {
          if (i === gap || i === gap + 1) continue;
          const x = b.x + 4 + i * ((b.w - 8) / (cols - 1));
          w.spawn({
            x: x - 1,
            y: tock ? b.y + b.h + 2 : b.y - 8,
            w: 2,
            h: 6,
            vy: (tock ? -1 : 1) * (0.75 + c.power * 0.1),
            shape: 'rect',
            dmg: 3,
            emo: tock ? 'colere' : 'neutre',
            warn: 10,
          });
        }
      }
    },
  },
};

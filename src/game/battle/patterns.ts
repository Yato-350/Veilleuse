import { audio } from '../../engine/audio';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import type { BulletWorld } from './bullets';

export interface PatternCtx {
  /** Difficulty modifier: 0 = gentle, grows with agitation and turn count. */
  power: number;
  turn: number;
  /** Emotion of the enemy (used for colored bullets). */
  emo: Emotion;
  /** Shared scratch data. */
  mem: Record<string, number>;
}

export interface Pattern {
  box: { w: number; h: number };
  duration: number;
  start?: (w: BulletWorld, c: PatternCtx) => void;
  tick: (w: BulletWorld, t: number, c: PatternCtx) => void;
}

const pickEmo = (main: Emotion, whiteChance: number): Emotion => (rng.chance(whiteChance) ? 'neutre' : main);

export const PATTERNS: Record<string, Pattern> = {
  // ---------------------------------------------------------------------------
  // Chapter 1
  // ---------------------------------------------------------------------------
  ink_drops: {
    box: { w: 96, h: 60 },
    duration: 300,
    tick(w, t, c) {
      const every = Math.max(18, 34 - c.power * 6);
      if (t % every === 0 && t < 260) {
        const b = w.box;
        w.spawn({ x: rng.range(b.x + 6, b.x + b.w - 6), y: b.y - 6, vy: 0.55 + c.power * 0.1, shape: 'ink', r: 3, dmg: 2, emo: 'neutre' });
      }
    },
  },
  ink_wiggle: {
    box: { w: 110, h: 60 },
    duration: 320,
    tick(w, t, c) {
      if (t % 40 === 0 && t < 270) {
        const b = w.box;
        const side = rng.chance(0.5) ? -1 : 1;
        const y = rng.range(b.y + 8, b.y + b.h - 8);
        w.spawn({
          x: side < 0 ? b.x - 6 : b.x + b.w + 6,
          y,
          vx: -side * (0.9 + c.power * 0.15),
          shape: 'ink',
          r: 3,
          dmg: 2,
          data: { y0: y },
          update: (bl) => {
            bl.y = bl.data.y0! + Math.sin(bl.life * 0.08) * 10;
          },
        });
      }
    },
  },
  rain: {
    box: { w: 120, h: 62 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      const rate = Math.max(4, 9 - c.power * 2);
      if (t % rate === 0 && t < 300) {
        w.spawn({
          x: rng.range(b.x + 2, b.x + b.w + 20),
          y: b.y - 6,
          vx: -0.35,
          vy: 1.4 + rng.range(0, 0.6) + c.power * 0.15,
          shape: 'drop',
          r: 2,
          dmg: 3,
          emo: pickEmo('tristesse', 0.18),
        });
      }
    },
  },
  rain_puddles: {
    box: { w: 120, h: 62 },
    duration: 320,
    tick(w, t, c) {
      const b = w.box;
      if (t % 7 === 0 && t < 290) {
        w.spawn({ x: rng.range(b.x, b.x + b.w), y: b.y - 6, vy: 1.6 + c.power * 0.2, shape: 'drop', r: 2, dmg: 3, emo: 'tristesse' });
      }
      if (t % 70 === 30) {
        const x = rng.range(b.x + 10, b.x + b.w - 30);
        w.zones.push({ x, y: b.y + b.h - 6, w: 24, h: 6, emo: 'neutre', dmg: 3, warn: 30, life: 90 });
      }
    },
  },
  horns: {
    box: { w: 140, h: 60 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(26, 44 - c.power * 6);
      if (t % every === 0 && t < 290) {
        const lanes = 4;
        const lane = rng.int(0, lanes - 1);
        const y = b.y + 8 + lane * ((b.h - 16) / (lanes - 1));
        const fromLeft = rng.chance(0.5);
        w.spawn({
          x: fromLeft ? b.x - 10 : b.x + b.w + 10,
          y,
          vx: (fromLeft ? 1 : -1) * (2.2 + c.power * 0.3),
          shape: 'horn',
          r: 3,
          dmg: 4,
          emo: pickEmo('colere', 0.25),
          warn: 26,
          clip: false,
        });
      }
    },
  },
  horns_charge: {
    box: { w: 150, h: 60 },
    duration: 300,
    tick(w, t, c) {
      const b = w.box;
      if (t % 60 === 10 && t < 260) {
        const gap = rng.int(0, 3);
        for (let i = 0; i < 5; i++) {
          if (i === gap) continue;
          const y = b.y + 6 + i * ((b.h - 12) / 4);
          w.spawn({ x: b.x + b.w + 10, y, vx: -(1.8 + c.power * 0.25), shape: 'horn', r: 3, dmg: 4, emo: 'colere', warn: 20 });
        }
      }
    },
  },
  seeds: {
    box: { w: 110, h: 64 },
    duration: 320,
    start(_w, c) {
      c.mem.a = 0;
    },
    tick(w, t, c) {
      const b = w.box;
      const cx = b.x + b.w / 2;
      const cy = b.y + 8;
      if (t % Math.max(5, 9 - c.power) === 0 && t < 280) {
        c.mem.a = (c.mem.a ?? 0) + 0.55;
        const a = c.mem.a!;
        const sp = 0.7 + c.power * 0.1;
        w.spawn({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 0.25, shape: 'seed', r: 2, dmg: 3, emo: pickEmo('joie', 0.2) });
      }
    },
  },
  seeds_wind: {
    box: { w: 140, h: 60 },
    duration: 300,
    tick(w, t) {
      const b = w.box;
      if (t % 6 === 0 && t < 270) {
        const y = rng.range(b.y + 4, b.y + b.h - 4);
        w.spawn({
          x: b.x - 8,
          y,
          vx: 1.3 + rng.range(0, 0.6),
          shape: 'seed',
          r: 2,
          dmg: 3,
          emo: pickEmo('joie', 0.3),
          data: { y0: y, ph: rng.range(0, 6) },
          update: (bl) => {
            bl.y = bl.data.y0! + Math.sin(bl.life * 0.1 + bl.data.ph!) * 6;
          },
        });
      }
    },
  },
  yarn: {
    box: { w: 100, h: 64 },
    duration: 330,
    start(w, c) {
      const b = w.box;
      const n = 2 + Math.min(2, c.power);
      for (let i = 0; i < n; i++) {
        const a = rng.range(0.4, 1.2) + (i * Math.PI) / 2;
        w.spawn({
          x: b.x + 15 + i * 20,
          y: b.y + 12,
          vx: Math.cos(a) * 1.2,
          vy: Math.sin(a) * 1.2,
          shape: 'yarn',
          r: 4,
          dmg: 3,
          emo: i % 2 === 0 ? 'tristesse' : 'neutre',
          bounce: 999,
          warn: 30,
        });
      }
    },
    tick() {},
  },
  // Closet monster: hangers spinning in from the sides + closing doors.
  hangers: {
    box: { w: 120, h: 64 },
    duration: 340,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(22, 34 - c.power * 4) === 0 && t < 300) {
        const left = rng.chance(0.5);
        const y = rng.range(b.y + 6, b.y + b.h - 6);
        const target = w.soul;
        const dx = target.x - (left ? b.x - 8 : b.x + b.w + 8);
        const dy = target.y - y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = 1.3 + c.power * 0.2;
        w.spawn({ x: left ? b.x - 8 : b.x + b.w + 8, y, vx: (dx / d) * sp, vy: (dy / d) * sp, shape: 'hanger', r: 4, spin: 0.2, dmg: 4, emo: pickEmo('peur', 0.4) });
      }
    },
  },
  closet_doors: {
    box: { w: 130, h: 64 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const period = 120;
      const ph = t % period;
      if (ph === 0 && t < 320) {
        const gapY = rng.range(b.y + 10, b.y + b.h - 22);
        const gapH = 16 - Math.min(4, c.power);
        audio.sfx('door', { vol: 0.5 });
        for (const side of [-1, 1]) {
          const startX = side < 0 ? b.x - 60 : b.x + b.w;
          // Top and bottom wall pieces leave a gap.
          for (const [yy, hh] of [
            [b.y, gapY - b.y],
            [gapY + gapH, b.y + b.h - gapY - gapH],
          ] as Array<[number, number]>) {
            if (hh <= 0) continue;
            w.spawn({
              x: startX,
              y: yy,
              w: 60,
              h: hh,
              shape: 'rect',
              dmg: 4,
              emo: 'peur',
              warn: 24,
              data: { side, x0: startX },
              update: (bl) => {
                const k = Math.sin(Math.min(1, (bl.life - 24) / 50) * Math.PI);
                bl.x = bl.data.x0! - bl.data.side! * k * 52;
                if (bl.life > 80) bl.dead = true;
              },
            });
          }
        }
      }
    },
  },
  // ---------------------------------------------------------------------------
  // Chapter 2
  // ---------------------------------------------------------------------------
  shavings: {
    box: { w: 110, h: 64 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      if (t % 50 === 0 && t < 280) {
        const cx = rng.range(b.x + 20, b.x + b.w - 20);
        const cy = rng.range(b.y + 15, b.y + b.h - 15);
        const n = 6 + c.power;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          w.spawn({
            x: cx,
            y: cy,
            shape: 'shaving',
            r: 3,
            dmg: 4,
            emo: i % 3 === 0 ? 'neutre' : 'colere',
            warn: 20,
            data: { cx, cy, a },
            update: (bl) => {
              const rr = (bl.life - 20) * 0.6;
              const aa = bl.data.a! + bl.life * 0.03;
              bl.x = bl.data.cx! + Math.cos(aa) * rr;
              bl.y = bl.data.cy! + Math.sin(aa) * rr;
              bl.angle = aa;
            },
          });
        }
      }
    },
  },
  planes: {
    box: { w: 140, h: 62 },
    duration: 320,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(24, 40 - c.power * 5) === 0 && t < 290) {
        const left = rng.chance(0.5);
        const y = rng.range(b.y + 4, b.y + b.h - 4);
        const x = left ? b.x - 8 : b.x + b.w + 8;
        const dx = w.soul.x - x;
        const dy = w.soul.y - y;
        const d = Math.hypot(dx, dy) || 1;
        w.spawn({ x, y, vx: (dx / d) * 1.8, vy: (dy / d) * 1.8, shape: 'plane', r: 3, dmg: 3, emo: pickEmo('joie', 0.5), warn: 12 });
      }
    },
  },
  sparks: {
    box: { w: 110, h: 64 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(8, 14 - c.power * 2) === 0 && t < 300) {
        const emo: Emotion = rng.pick(['tristesse', 'joie', 'neutre']);
        w.spawn({
          x: rng.range(b.x + 4, b.x + b.w - 4),
          y: rng.range(b.y + 4, b.y + b.h - 4),
          shape: 'spark',
          r: 3,
          dmg: 3,
          emo,
          warn: 34,
          maxLife: 70,
          data: { ph: rng.int(0, 3) },
        });
      }
    },
  },
  eraser_sweep: {
    box: { w: 130, h: 64 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      if (t % 75 === 0 && t < 320) {
        const vertical = rng.chance(0.5);
        audio.sfx('erase', { vol: 0.6 });
        if (vertical) {
          const x = rng.range(b.x, b.x + b.w - 28);
          w.zones.push({ x, y: b.y, w: 26 - Math.min(6, c.power * 2), h: b.h, emo: 'colere', dmg: 4, warn: 36, life: 70 });
        } else {
          const y = rng.range(b.y, b.y + b.h - 20);
          w.zones.push({ x: b.x, y, w: b.w, h: 18, emo: 'neutre', dmg: 4, warn: 36, life: 70 });
        }
      }
      if (t % 18 === 0 && t < 320) {
        const b2 = w.box;
        w.spawn({ x: rng.range(b2.x, b2.x + b2.w), y: b2.y - 4, vy: 1.2, shape: 'dot', r: 2, dmg: 3, emo: 'tristesse' });
      }
    },
  },
  eraser_shrink: {
    box: { w: 150, h: 70 },
    duration: 360,
    tick(w, t) {
      const b = w.box;
      // Erased margins grow from the edges: the playable area shrinks then comes back.
      const k = Math.sin(Math.min(1, t / 300) * Math.PI);
      const m = Math.round(k * 28);
      if (t % 4 === 0) {
        w.zones = w.zones.filter((z) => z.dmg !== 5);
        w.zones.push({ x: b.x, y: b.y, w: m * 1.6, h: b.h, emo: 'neutre', dmg: 5, warn: 0, life: 5 });
        w.zones.push({ x: b.x + b.w - m * 1.6, y: b.y, w: m * 1.6, h: b.h, emo: 'neutre', dmg: 5, warn: 0, life: 5 });
      }
      if (t % 22 === 0 && t < 320) {
        w.spawn({ x: b.x + b.w / 2 + rng.range(-20, 20), y: b.y - 4, vy: 1.1, shape: 'drop', r: 2, dmg: 3, emo: rng.pick(['tristesse', 'colere']) });
      }
    },
  },
  // ---------------------------------------------------------------------------
  // Chapter 3
  // ---------------------------------------------------------------------------
  ecg: {
    box: { w: 160, h: 60 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const beat = Math.max(46, 70 - c.power * 8);
      if (t % beat === 0 && t < 320) {
        audio.sfx('beep', { vol: 0.6 });
        const y = b.y + b.h / 2;
        const spike = rng.range(-1, 1) > 0 ? 1 : -1;
        // A line with a spike travels right to left.
        for (let i = 0; i < 26; i++) {
          const x = b.x + b.w + 6 + i * 4;
          const off = i >= 10 && i <= 14 ? spike * [8, 22, -14, 10, 3][i - 10]! : 0;
          w.spawn({ x, y: y + off - 1, w: 4, h: 2, shape: 'rect', vx: -2.2, dmg: 4, emo: i >= 10 && i <= 14 ? 'peur' : 'neutre', clip: false });
        }
      }
    },
  },
  drip: {
    box: { w: 110, h: 64 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      const cols = 5;
      if (t % 26 === 0 && t < 300) {
        const col = (t / 26) % cols;
        const x = b.x + 10 + col * ((b.w - 20) / (cols - 1));
        w.spawn({ x, y: b.y - 4, vy: 0.8, ay: 0.04 + c.power * 0.01, shape: 'drop', r: 2, dmg: 4, emo: pickEmo('tristesse', 0.35), warn: 14 });
      }
    },
  },
  // ---------------------------------------------------------------------------
  // Dodo
  // ---------------------------------------------------------------------------
  sheep_count: {
    box: { w: 150, h: 64 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(30, 48 - c.power * 6) === 0 && t < 360) {
        const n = (c.mem.count = (c.mem.count ?? 0) + 1);
        audio.sfx('baa', { pitch: 0.8 + (n % 5) * 0.08, vol: 0.5 });
        const big = n % 4 === 0;
        w.spawn({
          x: b.x - 8,
          y: b.y + b.h - 8,
          vx: 1.4,
          vy: -2.6 - rng.range(0, 0.7),
          ay: 0.075,
          shape: 'sprite',
          sprite: big ? 'b_sheep_big' : 'b_sheep',
          r: big ? 6 : 4,
          dmg: 4,
          emo: n % 3 === 0 ? 'tristesse' : 'neutre',
          clip: false,
        });
      }
      // Fence posts.
      if (t === 1) w.zones.push({ x: b.x + b.w / 2 - 3, y: b.y + b.h - 14, w: 6, h: 14, emo: 'neutre', dmg: 3, warn: 30, life: 380 });
    },
  },
  lullaby: {
    box: { w: 130, h: 64 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      if (t % 10 === 0 && t < 340) {
        const y0 = b.y + b.h / 2;
        const lane = Math.floor(t / 10) % 2;
        w.spawn({
          x: lane ? b.x + b.w + 6 : b.x - 6,
          y: y0,
          vx: lane ? -1.2 : 1.2,
          shape: 'note',
          r: 3,
          dmg: 4,
          emo: t % 30 === 0 ? 'neutre' : lane ? 'tristesse' : 'joie',
          data: { y0, ph: t * 0.05, amp: 18 + c.power * 3 },
          update: (bl) => {
            bl.y = bl.data.y0! + Math.sin(bl.life * 0.07 + bl.data.ph!) * bl.data.amp!;
          },
        });
      }
    },
  },
  dodo_rings: {
    box: { w: 120, h: 70 },
    duration: 380,
    tick(w, t) {
      const b = w.box;
      if (t % 70 === 10 && t < 330) {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const gapA = rng.range(0, Math.PI * 2);
        w.spawn({
          x: cx,
          y: cy,
          r: 90,
          shape: 'ring',
          dmg: 5,
          emo: rng.pick(['neutre', 'tristesse', 'peur']),
          data: { gapA, gapW: 1.1 },
          clip: false,
          warn: 10,
          update: (bl) => {
            bl.r = Math.max(0, 90 - (bl.life - 10) * 0.7);
            if (bl.r <= 2) bl.dead = true;
          },
        });
      }
    },
  },
  dodo_storm: {
    box: { w: 150, h: 70 },
    duration: 420,
    tick(w, t, c) {
      const b = w.box;
      const emos: Emotion[] = ['joie', 'tristesse', 'colere'];
      const emo = emos[Math.floor(t / 120) % 3]!;
      if (t % 6 === 0 && t < 390) {
        const a = t * 0.13;
        const cx = b.x + b.w / 2;
        const cy = b.y + 6;
        w.spawn({ x: cx, y: cy, vx: Math.cos(a) * 1.1, vy: Math.abs(Math.sin(a)) * 1.1 + 0.3, shape: 'star', r: 3, dmg: 5, emo });
      }
      if (t % 40 === 0 && t < 390) {
        w.spawn({ x: rng.range(b.x, b.x + b.w), y: b.y - 6, vy: 1.6 + c.power * 0.2, shape: 'drop', r: 2, dmg: 5, emo: 'neutre' });
      }
    },
  },
  // A gentle, harmless pattern for scripted moments.
  calm: {
    box: { w: 100, h: 56 },
    duration: 200,
    tick(w, t) {
      const b = w.box;
      if (t % 20 === 0 && t < 170) {
        w.spawn({ x: rng.range(b.x, b.x + b.w), y: b.y - 4, vy: 0.5, shape: 'star', r: 3, dmg: 0, emo: 'joie', alpha: 0.6 });
      }
    },
  },
};

import { audio } from '../../engine/audio';
import { drawChar } from '../../engine/font';
import { fx } from '../../engine/fx';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import { G } from '../state';
import type { Bullet, BulletWorld } from './bullets';
import type { Pattern, PatternCtx } from './patterns';

/*
 * Attack patterns of chapter 4 « La Maison Cousue » (docs/HISTOIRE.md § 3.11): cold noodles and paper mould, fridge
 * magnets pulled to the heart and chattering joke teeth, pins, an unfinished doll that redraws the box, a key and its
 * lock, the doll-mother's slow plates and the table for four, La Couseuse (stitch lines that harden into walls, the
 * needle that pins the heart, the closing cage) and Le Petit Homme de la Maison (slamming doors, then the black arena
 * where only the nightlight's cone shows what is coming).
 */

const pickEmo = (main: Emotion, whiteChance: number): Emotion => (rng.chance(whiteChance) ? 'neutre' : main);

// ---------------------------------------------------------------------------------------------------------------------
// Custom-drawn projectiles (fill color = the emotion's color)
// ---------------------------------------------------------------------------------------------------------------------

/** A cold noodle: a wavy strand, 2 px wide. */
function drawNoodle(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const len = b.data.len ?? 10;
  for (let i = 0; i < len; i++) {
    const off = Math.round(Math.sin((i + b.life * 0.22 + (b.data.ph ?? 0)) * 0.75) * 1.5);
    g.fillRect(x + off - 1, y - (len >> 1) + i, 2, 1);
  }
}

/** A pin: a thin shaft along `angle` (point forward) and a round head at the back. */
function drawPin(g: CanvasRenderingContext2D, b: Bullet): void {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const len = b.data.len ?? 5;
  for (let i = -len; i <= len - 1; i++) g.fillRect(Math.round(b.x + c * i), Math.round(b.y + s * i), 1, 1);
  const hx = Math.round(b.x - c * (len + 1));
  const hy = Math.round(b.y - s * (len + 1));
  g.fillRect(hx - 1, hy - 1, 3, 3);
}

/** A white plate seen from the table: an ellipse with a darker well. */
function drawPlate(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillRect(x - 4, y - 3, 9, 1);
  g.fillRect(x - 6, y - 2, 13, 1);
  g.fillRect(x - 7, y - 1, 15, 3);
  g.fillRect(x - 6, y + 2, 13, 1);
  g.fillRect(x - 4, y + 3, 9, 1);
  const a = g.globalAlpha;
  g.globalAlpha = a * 0.45;
  g.fillStyle = '#0b0710';
  g.fillRect(x - 4, y - 1, 9, 3);
  g.fillRect(x - 3, y - 2, 7, 5);
  g.globalAlpha = a;
}

/** A plastic fridge-magnet letter (bold glyph). */
function drawLetter(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const ch = String.fromCharCode(b.data.ch ?? 65);
  const x = Math.round(b.x) - 3;
  const y = Math.round(b.y) - 4;
  drawChar(g, ch, x, y, color);
  drawChar(g, ch, x + 1, y, color);
}

/** Wind-up chattering teeth: two rows of teeth that open and shut. */
function drawTeeth(g: CanvasRenderingContext2D, b: Bullet, color: string, t: number): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const open = Math.floor(t / 4 + (b.data.ph ?? 0)) % 2 ? 2 : 0;
  g.fillStyle = '#e07ba5';
  g.fillRect(x - 6, y - 3 - open, 12, 2);
  g.fillRect(x - 6, y + 2 + open, 12, 2);
  g.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    g.fillRect(x - 5 + i * 2 + (i > 2 ? 1 : 0), y - 1 - open, 1, 2);
    g.fillRect(x - 5 + i * 2 + (i > 2 ? 1 : 0), y + 1 + open, 1, 2);
  }
  // The orange wind-up feet.
  g.fillStyle = '#f09a4a';
  g.fillRect(x - 4, y + 4 + open, 2, 1);
  g.fillRect(x + 3, y + 4 + open, 2, 1);
}

/** A scribble: a short zigzag. */
function drawScribble(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const ph = Math.floor(b.life / 3) % 2;
  for (let i = -4; i <= 4; i++) g.fillRect(x + i, y + ((i + ph) % 2 ? -1 : 1), 1, 2);
}

/** A key: a ring bow and a toothed bit, along `angle`. */
function drawKeyBit(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillRect(x - 2, y - 2, 5, 5);
}

/** The giant sewing-machine needle (tip at y, shaft going up out of the box). */
function drawNeedle(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillRect(x - 1, y - 2, 3, 2);
  g.fillRect(x, y, 1, 2);
  g.fillRect(x - 2, y - 70, 5, 68);
  // The eye, with the red thread through it.
  g.fillStyle = '#0b0710';
  g.fillRect(x, y - 20, 1, 6);
  g.fillStyle = '#e8505b';
  g.fillRect(x - 6, y - 17, 13, 1);
  g.fillStyle = color;
}

const noodle = (w: BulletWorld, p: Partial<Bullet>): Bullet =>
  w.spawn({ shape: 'custom', draw: drawNoodle, data: { hw: 1.5, hh: 5, ph: rng.range(0, 6), len: 10 }, dmg: 3, ...p });

/**
 * The doll-mother herself, tiny, walking among the plates she serves (harmless: dmg 0). She goes from place to place
 * and stops at each one, as if setting the table.
 */
function servingMaman(w: BulletWorld): void {
  const b = w.box;
  w.spawn({
    x: b.x + 10,
    y: b.y + b.h - 12,
    shape: 'sprite',
    sprite: 'b_maman_mini',
    dmg: 0,
    clip: false,
    maxLife: 2000,
    data: { pierce: 1, tx: b.x + 10, ty: b.y + b.h - 12, wait: 0 },
    update: (bl) => {
      if (bl.data.wait! > 0) {
        bl.data.wait!--;
        return;
      }
      const dx = bl.data.tx! - bl.x;
      const dy = bl.data.ty! - bl.y;
      const d = Math.hypot(dx, dy);
      if (d < 1) {
        bl.data.tx = rng.range(b.x + 8, b.x + b.w - 8);
        bl.data.ty = rng.range(b.y + 12, b.y + b.h - 4);
        bl.data.wait = 30;
        return;
      }
      bl.x += (dx / d) * 0.5;
      bl.y += (dy / d) * 0.5;
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The light cone of the nightlight (Le Petit Homme, phase 2)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The nightlight held against the Petit Homme's chest lights a cone downwards. Its apex and its sway are shared with
 * the boss's backdrop (src/data/enemies-ch4.ts), which draws the same cone over the black arena.
 */
export const LIGHT = {
  /** Apex: the lamp, at the boss's chest. */
  ax: 160,
  ay: 52,
  /** Current direction (radians, π/2 = straight down) and half-width. */
  a: Math.PI / 2,
  half: 0.26,
  /** Shared clock of the sway. */
  clock: 0,
  /** Mina n°366 embroidered a thread of light: the cone is wider for one dodge. */
  wide: false,
};

/** Advances the sway of the cone (the boss rocks the lamp in his sewn arms). */
export function swayLight(wide: boolean): void {
  LIGHT.clock++;
  LIGHT.a = Math.PI / 2 + Math.sin(LIGHT.clock * 0.017) * 0.5 + Math.sin(LIGHT.clock * 0.041) * 0.12;
  LIGHT.wide = wide;
  LIGHT.half = wide ? 0.42 : 0.26;
}

/** Horizontal span of the cone at screen row y: [left, right] (empty above the apex). */
export function coneSpan(y: number, spread = 0): [number, number] {
  const dy = y - LIGHT.ay;
  if (dy <= 0) return [LIGHT.ax, LIGHT.ax];
  const a0 = Math.max(0.12, LIGHT.a - LIGHT.half - spread);
  const a1 = Math.min(Math.PI - 0.12, LIGHT.a + LIGHT.half + spread);
  // cot is decreasing on (0, π): the larger angle gives the left edge.
  return [LIGHT.ax + dy / Math.tan(a1), LIGHT.ax + dy / Math.tan(a0)];
}

/** Turns the box into the black arena: only the cone (and the heart itself) can be seen. */
function darkArena(w: BulletWorld, c: PatternCtx): void {
  w.dark = true;
  swayLight(!!c.mem.light);
  w.pre = (g, bw) => {
    const b = bw.box;
    g.fillStyle = '#ffe991';
    g.globalAlpha = 0.14;
    for (let y = b.y; y < b.y + b.h; y += 2) {
      const [l, r] = coneSpan(y);
      g.fillRect(Math.round(l), y, Math.max(0, Math.round(r - l)), 2);
    }
    g.globalAlpha = 1;
  };
  w.post = (g, bw) => {
    const b = bw.box;
    const flicker = G.settings.reduceFlashes ? 0 : Math.sin(bw.t * 0.9) * 0.6 + (rng.chance(0.03) ? -2 : 0);
    g.fillStyle = '#000000';
    for (let y = b.y; y < b.y + b.h; y += 2) {
      const [l0, r0] = coneSpan(y);
      const l = Math.round(l0 - flicker);
      const r = Math.round(r0 + flicker);
      if (l > b.x) g.fillRect(b.x, y, l - b.x, 2);
      if (r < b.x + b.w) g.fillRect(r, y, b.x + b.w - r, 2);
      // Dithered edge.
      g.globalAlpha = 0.6;
      if ((y >> 1) % 2) {
        g.fillRect(l, y, 2, 1);
        g.fillRect(r - 2, y + 1, 2, 1);
      } else {
        g.fillRect(l, y + 1, 2, 1);
        g.fillRect(r - 2, y, 2, 1);
      }
      g.globalAlpha = 1;
    }
    // The heart keeps a tiny glow of its own: you can always see yourself, never what comes.
    const s = bw.soul;
    g.fillStyle = '#ffe991';
    g.globalAlpha = 0.12;
    g.fillRect(Math.round(s.x) - 4, Math.round(s.y) - 4, 9, 9);
    g.globalAlpha = 1;
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------------------------------------------------

/** Cold noodles fall from the top; `blueChance` of them are mouldy (blue). */
function noodleRain(w: BulletWorld, t: number, c: PatternCtx, blueChance: number, until: number): void {
  const b = w.box;
  const every = Math.max(7, 13 - c.power * 2);
  if (t % every === 0 && t < until) {
    noodle(w, {
      x: rng.range(b.x + 4, b.x + b.w - 4),
      y: b.y - 8,
      vy: 0.9 + rng.range(0, 0.5) + c.power * 0.12,
      emo: rng.chance(blueChance) ? 'tristesse' : 'neutre',
    });
  }
}

/** A fork stomps down: four thin tines after a warning (no room between them). */
function forkStomp(w: BulletWorld, x: number, emo: Emotion): void {
  const b = w.box;
  for (let i = 0; i < 4; i++) {
    w.spawn({ x: x + i * 3, y: b.y - 34, w: 2, h: 22, shape: 'rect', vy: 3.2, dmg: 4, emo, warn: 30, clip: false, maxLife: 90 });
  }
}

/** A door panel: wood-like planks in the bullet's color, two recessed panels and a knob. */
function drawDoor(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const hw = b.data.hw ?? 10;
  const hh = b.data.hh ?? 10;
  const x = Math.round(b.x - hw);
  const y = Math.round(b.y - hh);
  const w = Math.round(hw * 2);
  const h = Math.round(hh * 2);
  g.fillRect(x, y, w, h);
  const a = g.globalAlpha;
  g.globalAlpha = a * 0.35;
  g.fillStyle = '#0b0710';
  const vertical = h >= w;
  if (vertical) {
    g.fillRect(x + 3, y + 3, w - 6, Math.floor(h / 2) - 5);
    g.fillRect(x + 3, y + Math.floor(h / 2) + 2, w - 6, Math.floor(h / 2) - 5);
  } else {
    g.fillRect(x + 3, y + 3, Math.floor(w / 2) - 5, h - 6);
    g.fillRect(x + Math.floor(w / 2) + 2, y + 3, Math.floor(w / 2) - 5, h - 6);
  }
  g.globalAlpha = a;
  g.fillRect(vertical ? x + w - 5 : x + Math.floor(w / 2) - 1, vertical ? y + Math.floor(h / 2) - 1 : y + h - 5, 3, 3);
  g.fillStyle = color;
}

/** A door slams in from one side: a warning, then a heavy door panel for a moment. */
function slamDoor(w: BulletWorld, side: 'left' | 'right' | 'top', depth: number, emo: Emotion, warn = 28): void {
  const b = w.box;
  const r =
    side === 'left'
      ? { x: b.x, y: b.y, w: depth, h: b.h }
      : side === 'right'
        ? { x: b.x + b.w - depth, y: b.y, w: depth, h: b.h }
        : { x: b.x, y: b.y, w: b.w, h: depth };
  // The warning only (harmless): where the door will be.
  w.zones.push({ ...r, emo, dmg: 0, warn, life: warn });
  w.spawn({
    x: r.x + r.w / 2,
    y: r.y + r.h / 2,
    shape: 'custom',
    draw: drawDoor,
    dmg: 4,
    emo,
    warn,
    clip: false,
    // (A bullet's life also counts its warning frames.)
    maxLife: warn + 22,
    data: { hw: r.w / 2, hh: r.h / 2, pierce: 1 },
    update: (bl) => {
      if (bl.life === warn + 1) {
        audio.sfx('door', { pitch: 0.7, vol: 0.8 });
        fx.shake(2, 6);
      }
    },
  });
}

/** Three knocks in the wall: rings with a gap, from a side of the box (the code: 1 « t'es là ? », 2, 3…). */
function knockRing(w: BulletWorld, x: number, y: number, emo: Emotion, speed: number): void {
  const gapA = Math.atan2(w.soul.y - y, w.soul.x - x) + rng.range(-0.6, 0.6);
  w.spawn({
    x,
    y,
    r: 2,
    shape: 'ring',
    dmg: 4,
    emo,
    warn: 10,
    clip: false,
    data: { gapA, gapW: 1.05 },
    update: (bl) => {
      bl.r += speed;
      if (bl.r > 170) bl.dead = true;
    },
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------------------------------------------------

export const CH4_PATTERNS: Record<string, Pattern> = {
  // ---------------------------------------------------------------------------
  // Pâte Froide — cold noodles that always hurt, blue spores, fork legs
  // ---------------------------------------------------------------------------
  noodle_rain: {
    box: { w: 120, h: 64 },
    duration: 330,
    tick(w, t, c) {
      noodleRain(w, t, c, 0.18, 290);
      if (t % 85 === 40 && t < 280) {
        const b = w.box;
        forkStomp(w, Math.round(rng.range(b.x + 4, b.x + b.w - 14)), pickEmo('tristesse', 0.5));
        audio.sfx('step', { pitch: 0.6 });
      }
    },
  },
  mold_spores: {
    box: { w: 110, h: 64 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      // Paper mould spots on the floor of the box puff blue spores that drift up, then burst.
      if (t % 60 === 1 && t < 270) {
        const x = rng.range(b.x + 10, b.x + b.w - 10);
        w.zones.push({ x: x - 6, y: b.y + b.h - 4, w: 12, h: 4, emo: 'tristesse', dmg: 3, warn: 24, life: 120 });
        for (let i = 0; i < 4 + c.power; i++) {
          w.spawn({
            x: x + rng.range(-5, 5),
            y: b.y + b.h - 6,
            vx: rng.range(-0.35, 0.35),
            vy: -rng.range(0.35, 0.7),
            shape: 'dot',
            r: 2,
            dmg: 3,
            emo: 'tristesse',
            warn: 24 + i * 6,
            data: { ph: rng.range(0, 6), burst: 70 + rng.int(0, 40) },
            update: (bl, bw) => {
              bl.x += Math.sin(bl.life * 0.08 + bl.data.ph!) * 0.3;
              if (bl.life === bl.data.burst) {
                bl.dead = true;
                for (let k = 0; k < 4; k++) {
                  const a = (k / 4) * Math.PI * 2 + 0.4;
                  bw.spawn({ x: bl.x, y: bl.y, vx: Math.cos(a) * 0.9, vy: Math.sin(a) * 0.9, shape: 'dot', r: 1, dmg: 2, emo: 'tristesse', maxLife: 80 });
                }
              }
            },
          });
        }
      }
      // A few white noodles: they always hurt.
      if (t % 26 === 0 && t < 290) noodle(w, { x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 8, vy: 0.8 + c.power * 0.1, emo: 'neutre' });
    },
  },

  // ---------------------------------------------------------------------------
  // Mot Aimanté — fridge letters pulled to the heart, chattering teeth
  // ---------------------------------------------------------------------------
  magnet_letters: {
    box: { w: 130, h: 66 },
    duration: 340,
    tick(w, t, c) {
      const b = w.box;
      const word = 'JETAIME';
      if (t % Math.max(16, 24 - c.power * 3) === 0 && t < 290) {
        const n = (c.mem.n = (c.mem.n ?? 0) + 1);
        const side = n % 4;
        const x = side === 0 ? b.x - 6 : side === 1 ? b.x + b.w + 6 : rng.range(b.x, b.x + b.w);
        const y = side === 2 ? b.y - 6 : side === 3 ? b.y + b.h + 6 : rng.range(b.y, b.y + b.h);
        w.spawn({
          x,
          y,
          shape: 'custom',
          draw: drawLetter,
          r: 3,
          dmg: 3,
          emo: pickEmo('colere', 0.3),
          clip: false,
          warn: 14,
          maxLife: 240,
          data: { ch: word.charCodeAt(n % word.length), pull: 0.035 + c.power * 0.008, max: 1.5 + c.power * 0.2 },
          update: (bl, bw) => {
            // Pulled towards the heart (a magnet), harder during the « pulses ».
            const pulse = bw.t % 90 < 12 ? 3 : 1;
            const dx = bw.soul.x - bl.x;
            const dy = bw.soul.y - bl.y;
            const d = Math.hypot(dx, dy) || 1;
            bl.vx += (dx / d) * bl.data.pull! * pulse;
            bl.vy += (dy / d) * bl.data.pull! * pulse;
            const sp = Math.hypot(bl.vx, bl.vy);
            if (sp > bl.data.max! * pulse) {
              bl.vx *= (bl.data.max! * pulse) / sp;
              bl.vy *= (bl.data.max! * pulse) / sp;
            }
            if (bl.life > 170) bl.alpha = Math.max(0, 1 - (bl.life - 170) / 60);
            if (bl.alpha <= 0.05) bl.dead = true;
          },
        });
      }
      if (t % 90 === 0 && t > 0 && t < 300) audio.sfx('tooth', { pitch: 0.7 });
    },
  },
  chatter_teeth: {
    box: { w: 130, h: 64 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(40, 62 - c.power * 8) === 0 && t < 280) {
        const left = rng.chance(0.5);
        w.spawn({
          x: left ? b.x - 8 : b.x + b.w + 8,
          y: b.y + b.h - 6,
          vx: (left ? 1 : -1) * (0.9 + c.power * 0.15),
          vy: -2.2,
          ay: 0.09,
          shape: 'custom',
          draw: drawTeeth,
          dmg: 4,
          emo: 'neutre',
          clip: false,
          data: { hw: 6, hh: 4, ph: rng.int(0, 1), floor: b.y + b.h - 6 },
          update: (bl, bw) => {
            if (bl.y > bl.data.floor! && bl.vy > 0) {
              bl.y = bl.data.floor!;
              bl.vy = -rng.range(1.8, 2.6);
              audio.sfx('tooth', { pitch: 1.4, vol: 0.4 });
              // Chewed bits of words fly off at each bite.
              for (let k = 0; k < 2; k++) {
                bw.spawn({ x: bl.x, y: bl.y - 4, vx: rng.range(-0.8, 0.8), vy: -rng.range(1, 1.8), ay: 0.06, shape: 'dot', r: 1, dmg: 2, emo: 'colere', maxLife: 70 });
              }
            }
          },
        });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Dé-Chevalier — pins
  // ---------------------------------------------------------------------------
  pin_rain: {
    box: { w: 120, h: 64 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(9, 15 - c.power * 2) === 0 && t < 290) {
        const a = Math.PI / 2 + rng.range(-0.25, 0.25);
        w.spawn({ x: rng.range(b.x + 2, b.x + b.w - 2), y: b.y - 8, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, ay: 0.02, angle: a, shape: 'custom', draw: drawPin, r: 2, dmg: 3, emo: pickEmo('colere', 0.3) });
      }
      // A fan of five pins from the thimble, aimed near the heart.
      if (t % 70 === 35 && t < 280) {
        const x = rng.range(b.x + 20, b.x + b.w - 20);
        const y = b.y - 6;
        const base = Math.atan2(w.soul.y - y, w.soul.x - x);
        for (let k = -2; k <= 2; k++) {
          const a = base + k * 0.28;
          w.spawn({ x, y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, angle: a, shape: 'custom', draw: drawPin, r: 2, dmg: 3, emo: 'colere', warn: 18 });
        }
        audio.sfx('tooth', { pitch: 2 });
      }
    },
  },
  pin_lance: {
    box: { w: 140, h: 60 },
    duration: 330,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(26, 40 - c.power * 5) === 0 && t < 290) {
        const lanes = 4;
        const lane = rng.int(0, lanes - 1);
        const y = b.y + 8 + lane * ((b.h - 16) / (lanes - 1));
        const left = rng.chance(0.5);
        const a = left ? 0 : Math.PI;
        w.spawn({
          x: left ? b.x - 16 : b.x + b.w + 16,
          y,
          vx: (left ? 1 : -1) * (2.4 + c.power * 0.3),
          angle: a,
          shape: 'custom',
          draw: drawPin,
          dmg: 4,
          emo: pickEmo('colere', 0.25),
          warn: 26,
          clip: false,
          data: { len: 12, hw: 12, hh: 1.5 },
        });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Poupée Brouillon — scribbles that redraw the box, tailor's chalk lines
  // ---------------------------------------------------------------------------
  scribble_box: {
    box: { w: 120, h: 64 },
    duration: 360,
    start(w, c) {
      w.liveBox = true;
      c.mem.cx = w.box.x + w.box.w / 2;
      c.mem.cy = w.box.y + w.box.h / 2;
      c.mem.tw = w.box.w;
      c.mem.th = w.box.h;
    },
    tick(w, t, c) {
      const b = w.box;
      // Every 80 frames the box is redrawn: narrow and tall, wide and flat, small…
      if (t % 80 === 20 && t < 300) {
        const shapes: Array<[number, number]> = [
          [70, 72],
          [150, 44],
          [90, 56],
          [120, 64],
          [60, 60],
        ];
        const [tw, th] = shapes[(c.mem.k = ((c.mem.k ?? rng.int(0, 4)) + 1) % shapes.length)]!;
        c.mem.tw = tw;
        c.mem.th = th;
        audio.sfx('scratch', { pitch: 1.2, vol: 0.6 });
      }
      const nw = b.w + (c.mem.tw! - b.w) * 0.12;
      const nh = b.h + (c.mem.th! - b.h) * 0.12;
      w.box = { x: Math.round(c.mem.cx! - nw / 2), y: Math.round(c.mem.cy! - nh / 2), w: Math.round(nw), h: Math.round(nh) };
      // Scribbles cross the box.
      if (t % Math.max(14, 22 - c.power * 3) === 0 && t < 310) {
        const left = rng.chance(0.5);
        const y = rng.range(w.box.y + 4, w.box.y + w.box.h - 4);
        w.spawn({
          x: left ? w.box.x - 6 : w.box.x + w.box.w + 6,
          y,
          vx: (left ? 1 : -1) * (1 + c.power * 0.15),
          vy: rng.range(-0.3, 0.3),
          shape: 'custom',
          draw: drawScribble,
          dmg: 3,
          emo: pickEmo('peur', 0.4),
          clip: false,
          data: { hw: 4, hh: 2 },
        });
      }
    },
  },
  chalk_lines: {
    box: { w: 120, h: 64 },
    duration: 340,
    tick(w, t, c) {
      const b = w.box;
      // The tailor's chalk traces where to cut: a dashed line (warning), then the cut.
      if (t % Math.max(40, 58 - c.power * 6) === 5 && t < 280) {
        const vertical = rng.chance(0.5);
        if (vertical) {
          const x = Math.round(rng.range(b.x + 6, b.x + b.w - 10));
          w.zones.push({ x, y: b.y, w: 5, h: b.h, emo: 'neutre', dmg: 4, warn: 34, life: 64 });
        } else {
          const y = Math.round(rng.range(b.y + 6, b.y + b.h - 10));
          w.zones.push({ x: b.x, y, w: b.w, h: 5, emo: 'neutre', dmg: 4, warn: 34, life: 64 });
        }
        audio.sfx('scratch', { pitch: 1.6, vol: 0.4 });
      }
      if (t % 30 === 0 && t < 290) {
        w.spawn({ x: rng.range(b.x, b.x + b.w), y: b.y - 6, vy: 0.9, shape: 'custom', draw: drawScribble, dmg: 3, emo: 'peur', data: { hw: 4, hh: 2 } });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Clé — the lock's pins, the turning key
  // ---------------------------------------------------------------------------
  tumblers: {
    box: { w: 140, h: 64 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const cols = 7;
      const cw = b.w / cols;
      const period = Math.max(80, 104 - c.power * 8);
      if (t % period === 1 && t < 300) {
        // A gap per column, never more than one level away from its neighbour: there is always a way through.
        const levels = 4;
        let lv = rng.int(0, levels - 1);
        const gapH = 18;
        for (let i = 0; i < cols; i++) {
          if (i) lv = Math.max(0, Math.min(levels - 1, lv + rng.int(-1, 1)));
          const gy = b.y + 4 + lv * ((b.h - gapH - 8) / (levels - 1));
          const x = Math.round(b.x + i * cw + 1);
          const ww = Math.round(cw - 2);
          const top = Math.round(gy - b.y);
          const bottom = Math.round(b.y + b.h - (gy + gapH));
          const emo = pickEmo('peur', 0.4);
          if (top > 0) w.zones.push({ x, y: b.y, w: ww, h: top, emo, dmg: 4, warn: 40, life: 40 + 46 });
          if (bottom > 0) w.zones.push({ x, y: Math.round(gy + gapH), w: ww, h: bottom, emo, dmg: 4, warn: 40, life: 40 + 46 });
        }
        w.spawn({ x: -50, y: -50, shape: 'dot', r: 0, dmg: 0, alpha: 0, clip: false, maxLife: 42, update: (bl) => (bl.life === 40 ? audio.sfx('knock1', { pitch: 1.8, vol: 0.5 }) : undefined) });
      }
    },
  },
  key_turn: {
    box: { w: 100, h: 66 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      if (t === 1) {
        const n = 9;
        for (let i = 0; i < n; i++) {
          const k = i;
          w.spawn({
            x: cx + 6 + k * 4.2,
            y: cy,
            shape: 'custom',
            draw: drawKeyBit,
            data: { pierce: 1 },
            r: 2,
            dmg: 4,
            emo: k >= n - 2 ? 'neutre' : 'peur',
            warn: 40,
            clip: false,
            maxLife: 340,
            update: (bl, bw) => {
              // The key turns in a lock too big for it: it jerks, stops, turns back.
              const tt = bw.t;
              const sp = 0.028 + c.power * 0.006;
              const a = Math.sin(tt * sp) * 2.6 + Math.sin(tt * 0.11) * 0.08;
              const r = 6 + k * 4.2;
              bl.x = cx + Math.cos(a) * r;
              bl.y = cy + Math.sin(a) * r;
            },
          });
        }
      }
      if (t % 46 === 20 && t < 300) {
        audio.sfx('knock1', { pitch: 2.2, vol: 0.4 });
        const a = rng.range(0, Math.PI * 2);
        for (let k = 0; k < 3; k++) {
          const aa = a + (k * Math.PI * 2) / 3;
          w.spawn({ x: cx, y: cy, vx: Math.cos(aa) * 1.1, vy: Math.sin(aa) * 1.1, shape: 'dot', r: 2, dmg: 3, emo: 'neutre', maxLife: 120 });
        }
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Poupée-Maman — slow plates, the table for four (one plate for nobody)
  // ---------------------------------------------------------------------------
  slow_plates: {
    box: { w: 140, h: 64 },
    duration: 360,
    start(w) {
      servingMaman(w);
    },
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(36, 50 - c.power * 5) === 0 && t < 300) {
        const row = (c.mem.row = ((c.mem.row ?? 0) + 1) % 3);
        const y = b.y + 12 + row * ((b.h - 24) / 2);
        const left = row % 2 === 0;
        w.spawn({
          x: left ? b.x - 10 : b.x + b.w + 10,
          y,
          vx: (left ? 1 : -1) * (0.45 + c.power * 0.08),
          shape: 'custom',
          draw: drawPlate,
          dmg: 4,
          emo: 'neutre',
          clip: false,
          maxLife: 500,
          data: { hw: 7, hh: 3 },
          update: (bl) => {
            // Every plate stops a moment in front of you, as if someone were serving.
            if (Math.abs(bl.x - (b.x + b.w / 2)) < 1 && !bl.data.served) {
              bl.data.served = 1;
              bl.data.wait = 40;
            }
            if (bl.data.wait! > 0) {
              bl.data.wait!--;
              bl.x -= bl.vx;
            }
          },
        });
      }
      // The noodles she serves.
      if (t % 34 === 17 && t < 300) noodle(w, { x: rng.range(b.x + 6, b.x + b.w - 6), y: b.y - 8, vy: 0.7 + c.power * 0.1, emo: 'neutre' });
    },
  },
  four_plates: {
    box: { w: 120, h: 64 },
    duration: 380,
    start(w) {
      servingMaman(w);
    },
    tick(w, t, c) {
      const b = w.box;
      const period = Math.max(78, 96 - c.power * 6);
      const q = (i: number) => ({ x: b.x + (i % 2) * (b.w / 2), y: b.y + Math.floor(i / 2) * (b.h / 2), w: b.w / 2, h: b.h / 2 });
      if (t % period === 1 && t < 320) {
        // Four places are set. Three are served. The fourth plate is for nobody.
        let empty = rng.int(0, 3);
        if (empty === c.mem.empty) empty = (empty + 1 + rng.int(0, 2)) % 4;
        c.mem.empty = empty;
        for (let i = 0; i < 4; i++) {
          if (i === empty) continue;
          const r = q(i);
          w.zones.push({ x: Math.round(r.x + 1), y: Math.round(r.y + 1), w: Math.round(r.w - 2), h: Math.round(r.h - 2), emo: 'neutre', dmg: 4, warn: 46, life: 46 + 34 });
        }
      }
      w.pre = (g) => {
        if (c.mem.empty === undefined) return;
        const r = q(c.mem.empty);
        const x = Math.round(r.x + r.w / 2);
        const y = Math.round(r.y + r.h / 2);
        g.fillStyle = '#ece2df';
        g.globalAlpha = 0.5;
        g.fillRect(x - 9, y - 4, 19, 1);
        g.fillRect(x - 9, y + 4, 19, 1);
        g.fillRect(x - 11, y - 3, 1, 7);
        g.fillRect(x + 11, y - 3, 1, 7);
        g.fillRect(x - 10, y - 3, 1, 1);
        g.fillRect(x + 10, y - 3, 1, 1);
        g.fillRect(x - 10, y + 3, 1, 1);
        g.fillRect(x + 10, y + 3, 1, 1);
        g.globalAlpha = 1;
      };
      if (t % 40 === 20 && t < 330) {
        const left = rng.chance(0.5);
        w.spawn({ x: left ? b.x - 10 : b.x + b.w + 10, y: rng.range(b.y + 6, b.y + b.h - 6), vx: (left ? 1 : -1) * 0.55, shape: 'custom', draw: drawPlate, dmg: 4, emo: 'neutre', clip: false, data: { hw: 7, hh: 3 } });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // La Couseuse — stitch lines that harden into walls, the pinning needle, the cage
  // ---------------------------------------------------------------------------
  stitch_walls: {
    box: { w: 140, h: 66 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(44, 62 - c.power * 6);
      if (t % every === 1 && t < 300) {
        const vertical = (c.mem.v = ((c.mem.v ?? rng.int(0, 1)) + 1) % 2) === 1;
        const pos = vertical ? Math.round(rng.range(b.x + 12, b.x + b.w - 14)) : Math.round(rng.range(b.y + 10, b.y + b.h - 12));
        const warn = 40;
        const emo = pickEmo('colere', 0.35);
        // The running stitch is sewn along the line (warning), then the thread is pulled tight: a wall.
        const len = vertical ? b.h : b.w;
        for (let i = 0; i < len; i += 6) {
          w.spawn({
            x: vertical ? pos : b.x + i,
            y: vertical ? b.y + i : pos,
            w: vertical ? 3 : 4,
            h: vertical ? 4 : 3,
            shape: 'rect',
            dmg: 4,
            emo,
            warn: Math.round((i / len) * warn * 0.7) + 8,
            maxLife: 150,
            data: { grow: vertical ? 2 : 1 },
            update: (bl) => {
              // Hardening: the dashes join into a solid seam.
              if (bl.life < 20) {
                if (bl.data.grow === 2) bl.h = Math.min(6, bl.h + 0.2);
                else bl.w = Math.min(6, bl.w + 0.2);
              }
              if (bl.life > 120) bl.alpha = Math.max(0, 1 - (bl.life - 120) / 30);
            },
          });
        }
        w.spawn({ x: -50, y: -50, shape: 'dot', r: 0, dmg: 0, alpha: 0, clip: false, maxLife: warn, update: (bl) => (bl.life % 6 === 0 ? audio.sfx('stitch', { pitch: 1 + bl.life * 0.01, vol: 0.5 }) : undefined) });
      }
      // Loose buttons roll in.
      if (t % 50 === 25 && t < 320) {
        const left = rng.chance(0.5);
        w.spawn({ x: left ? b.x - 6 : b.x + b.w + 6, y: rng.range(b.y + 6, b.y + b.h - 6), vx: (left ? 1 : -1) * 1.1, shape: 'yarn', r: 3, dmg: 3, emo: 'neutre', clip: false });
      }
    },
  },
  needle_pin: {
    box: { w: 120, h: 64 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      if (t === 1) {
        // The needle: it follows the heart from above, stops, and stabs.
        w.spawn({
          x: b.x + b.w / 2,
          y: b.y + 4,
          shape: 'custom',
          draw: drawNeedle,
          r: 2,
          dmg: 5,
          emo: 'neutre',
          clip: false,
          maxLife: 999,
          data: { hw: 1.5, hh: 5, pierce: 1 },
          update: (bl, bw) => {
            const s = bw.soul;
            const cycle = Math.max(56, 74 - c.power * 6);
            const p = bl.life % cycle;
            if (p < cycle - 26) {
              // Hover and follow.
              bl.x += Math.max(-1.6, Math.min(1.6, (s.x - bl.x) * 0.08));
              bl.y += (b.y + 4 - bl.y) * 0.3;
              bl.dmg = 0;
            } else if (p < cycle - 18) {
              // It stops: a short shiver before the stab.
              bl.x += rng.range(-0.6, 0.6);
              bl.dmg = 0;
            } else if (p === cycle - 18) {
              audio.sfx('stitch', { pitch: 0.6, vol: 0.9 });
              bl.dmg = 5;
              bl.vy = 6;
            }
            if (bl.vy > 0 && bl.y >= b.y + b.h - 2) {
              bl.vy = 0;
              bl.y = b.y + b.h - 2;
              fx.shake(1, 4);
            }
            if (p === cycle - 1) {
              bl.vy = 0;
              bl.dmg = 0;
            }
            // Pinned: the heart stays nailed for a second.
            if (bl.dmg > 0 && Math.abs(s.x - bl.x) < 3 && s.y < bl.y + 2 && s.y > bl.y - 40 && !bl.data.pinned) {
              bl.data.pinned = 1;
              s.pin = 60;
              audio.sfx('stitch', { pitch: 0.4 });
            }
            if (p === 0) bl.data.pinned = 0;
          },
        });
      }
      // While you are pinned (or not), a seam runs across the box.
      if (t % 74 === 60 && t < 330) {
        const y = Math.round(rng.range(b.y + 6, b.y + b.h - 6));
        const left = rng.chance(0.5);
        for (let i = 0; i < 6; i++) {
          w.spawn({ x: left ? b.x - 6 - i * 7 : b.x + b.w + 6 + i * 7, y, w: 4, h: 2, shape: 'rect', vx: (left ? 1 : -1) * 1.6, dmg: 3, emo: pickEmo('colere', 0.4), clip: false, warn: 16 });
        }
      }
      if (t % 20 === 0 && t < 330) w.spawn({ x: rng.range(b.x, b.x + b.w), y: b.y - 4, vy: 0.9, shape: 'dot', r: 1, dmg: 2, emo: 'colere' });
    },
  },
  stitch_cage: {
    box: { w: 120, h: 66 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      // Four seams close in from the sides, each with a gap; then they open again.
      const period = 170;
      const p = t % period;
      if (p === 1 && t < 340) {
        const emo = pickEmo('peur', 0.3);
        for (const side of [0, 1, 2, 3]) {
          const horizontal = side < 2;
          const len = horizontal ? b.w : b.h;
          const gap = rng.range(10, len - 26);
          for (let i = 0; i < len; i += 4) {
            if (i > gap && i < gap + 18) continue;
            w.spawn({
              x: horizontal ? b.x + i : side === 2 ? b.x : b.x + b.w,
              y: horizontal ? (side === 0 ? b.y : b.y + b.h) : b.y + i,
              w: horizontal ? 3 : 2,
              h: horizontal ? 2 : 3,
              shape: 'rect',
              dmg: 4,
              emo,
              warn: 30,
              clip: false,
              maxLife: period - 4,
              data: { side, i },
              update: (bl) => {
                const k = Math.sin(Math.min(1, Math.max(0, (bl.life - 30) / (period - 40))) * Math.PI);
                const dx = (b.w / 2 - 10) * k * (0.8 + c.power * 0.05);
                const dy = (b.h / 2 - 10) * k * (0.8 + c.power * 0.05);
                if (bl.data.side === 0) bl.y = b.y + dy;
                else if (bl.data.side === 1) bl.y = b.y + b.h - dy;
                else if (bl.data.side === 2) bl.x = b.x + dx;
                else bl.x = b.x + b.w - dx;
              },
            });
          }
        }
        audio.sfx('thread', { pitch: 0.8 });
      }
      if (t % 24 === 12 && t < 360) {
        const a = rng.range(0, Math.PI * 2);
        w.spawn({ x: b.x + b.w / 2 + Math.cos(a) * 70, y: b.y + b.h / 2 + Math.sin(a) * 50, vx: -Math.cos(a) * 0.8, vy: -Math.sin(a) * 0.8, angle: a + Math.PI, shape: 'custom', draw: drawPin, r: 2, dmg: 3, emo: 'neutre', clip: false, warn: 12 });
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Le Petit Homme de la Maison — phase 1: doors and noodles; phase 2: the black arena and the light cone
  // ---------------------------------------------------------------------------
  doors_slam: {
    box: { w: 140, h: 66 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(44, 58 - c.power * 5);
      if (t % every === 1 && t < 300) {
        const sides: Array<'left' | 'right' | 'top'> = ['left', 'right', 'top'];
        const side = sides[(c.mem.s = ((c.mem.s ?? rng.int(0, 2)) + 1 + rng.int(0, 1)) % 3)]!;
        slamDoor(w, side, side === 'top' ? Math.round(b.h * 0.55) : Math.round(b.w * 0.45), pickEmo('colere', 0.4));
      }
      // A moving wall with a doorway in it.
      if (t % 110 === 60 && t < 300) {
        const left = rng.chance(0.5);
        const gy = rng.range(b.y + 6, b.y + b.h - 24);
        for (const [y0, y1] of [
          [b.y, gy],
          [gy + 20, b.y + b.h],
        ] as const) {
          if (y1 - y0 < 1) continue;
          w.spawn({ x: left ? b.x - 6 : b.x + b.w + 2, y: y0, w: 4, h: y1 - y0, shape: 'rect', vx: (left ? 1 : -1) * (1 + c.power * 0.15), dmg: 4, emo: 'neutre', clip: false, warn: 16 });
        }
      }
    },
  },
  dark_noodles: {
    box: { w: 130, h: 64 },
    duration: 360,
    start(w, c) {
      darkArena(w, c);
    },
    tick(w, t, c) {
      swayLight(!!c.mem.light);
      noodleRain(w, t, { ...c, power: Math.max(0, c.power - 1) }, 0.1, 320);
      if (t % 90 === 45 && t < 300) {
        const b = w.box;
        forkStomp(w, Math.round(rng.range(b.x + 4, b.x + b.w - 14)), 'peur');
      }
    },
  },
  dark_doors: {
    box: { w: 140, h: 66 },
    duration: 360,
    start(w, c) {
      darkArena(w, c);
    },
    tick(w, t, c) {
      swayLight(!!c.mem.light);
      const b = w.box;
      if (t % Math.max(52, 66 - c.power * 5) === 1 && t < 300) {
        const side = rng.pick(['left', 'right', 'top'] as const);
        slamDoor(w, side, side === 'top' ? Math.round(b.h * 0.5) : Math.round(b.w * 0.4), pickEmo('peur', 0.5), 34);
      }
      if (t % 28 === 14 && t < 320) noodle(w, { x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 8, vy: 0.8, emo: 'neutre' });
    },
  },
  dark_knocks: {
    box: { w: 130, h: 64 },
    duration: 380,
    start(w, c) {
      darkArena(w, c);
    },
    tick(w, t, c) {
      swayLight(!!c.mem.light);
      const b = w.box;
      // Knocks in the walls of the dark: one (« t'es là ? »), two, three. Each knock is a ring with a gap.
      const period = 120;
      const p = t % period;
      if (p === 1 && t < 330) {
        c.mem.n = ((c.mem.n ?? 0) % 3) + 1;
        c.mem.side = rng.int(0, 1);
      }
      for (let k = 0; k < (c.mem.n ?? 0); k++) {
        if (p === 10 + k * 16 && t < 340) {
          const x = c.mem.side ? b.x + b.w + 4 : b.x - 4;
          const y = b.y + b.h * rng.range(0.2, 0.8);
          audio.sfx('knock1', { pitch: 0.9 - k * 0.05 });
          fx.shake(1, 3);
          knockRing(w, x, y, k === 2 ? 'neutre' : 'peur', 0.8 + c.power * 0.1);
        }
      }
    },
  },
};

import { audio, parsePattern } from '../../engine/audio';
import { drawChar } from '../../engine/font';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import { LULLABY_PATTERN } from '../../data/music';
import { G } from '../state';
import type { Bullet, BulletWorld } from './bullets';
import type { Pattern } from './patterns';

/*
 * Attack patterns of chapter 6 « Le Ventre de Dodo » (docs/HISTOIRE.md § 3.14).
 *
 * Regular enemies: L'Aiguille dashes across the box and leaves running stitches behind (its needle sews the heart:
 * `data.sew`, the color stays two turns), then sews a seam up and down through the box; Le Bouton Pendu swings like a
 * pendulum and drops buttons on their threads like yo-yos; La Bourre drips wet cotton that sticks to the heart and
 * slows it down (a sad heart lets it through), and puffs of mildew; the Moutons Numérotés slam rubber stamps and jump
 * the box, numbered; La Pile leaks a crust that grows from the floor of the box, and its voice is a waveform of static
 * that gets flatter turn after turn.
 *
 * The final battle (dodo_v2, src/data/enemies-ch6.ts): the sheep of the player's deaths (`mem.n` this turn, counted in
 * CH6.counted for the tally drawn over the arena); « DORS » falling letter by letter; pins falling like stalactites;
 * the crayons whose color lies (drawn yellow, never what they are: `data.lie`, a « ? » with the emotion shapes);
 * the knocks in the dark (hers light the box and never hurt; Dodo's false knocks ring from the radiator and do — Story
 * mode: slower knocks, no false knocks); the lullaby with holes (walls of notes, the gap follows the melody); the seams
 * that burst.
 */

/** Shared with the chapter 6 enemies and the final battle. */
export const CH6 = {
  /** Sheep counted so far in the final battle (phase 1), for the tally over the arena. */
  counted: 0,
  /** The voice of La Pile: 1 = clear, down to 0.2 (flatter waveform each turn). */
  voice: 1,
  /** Where the lullaby with holes is in the melody (note index). */
  note: 0,
};

const pickEmo = (main: Emotion, whiteChance: number): Emotion => (rng.chance(whiteChance) ? 'neutre' : main);
const gentle = (): boolean => G.settings.storyMode;

// ---------------------------------------------------------------------------------------------------------------------
// Custom-drawn projectiles (fill color = the emotion's color)
// ---------------------------------------------------------------------------------------------------------------------

/** A sewing needle along its direction of travel: the shaft in its color, the eye, a red thread trailing behind. */
function drawNeedle(g: CanvasRenderingContext2D, b: Bullet, _color: string, t: number): void {
  const a = Math.atan2(b.vy, b.vx);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = b.x;
  const y = b.y;
  for (let i = -7; i <= 6; i++) g.fillRect(Math.round(x + c * i), Math.round(y + s * i), 1, 1);
  for (let i = -7; i <= 2; i++) g.fillRect(Math.round(x + c * i - s), Math.round(y + s * i + c), 1, 1);
  const al = g.globalAlpha;
  g.fillStyle = '#0b0710';
  g.fillRect(Math.round(x - c * 5), Math.round(y - s * 5), 1, 1);
  g.fillStyle = '#e8505b';
  for (let i = 8; i < 16; i++) {
    const wv = Math.sin(i * 0.8 - t * 0.3) * 1.5;
    g.fillRect(Math.round(x - c * i - s * wv), Math.round(y - s * i + c * wv), 1, 1);
  }
  g.globalAlpha = al;
}

/** A running stitch left in the box: a short dash, slanted. */
function drawStitch(g: CanvasRenderingContext2D, b: Bullet): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const d = b.data.dir ?? 1;
  g.fillRect(x - 2, y - d, 2, 1);
  g.fillRect(x, y, 2, 1);
  g.fillRect(x + 2, y + d, 1, 1);
}

/** A sewing button: a disc, its rim, two holes. */
function drawButton(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const r = Math.round(b.r);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(x - w, y + dy, w * 2 + 1, 1);
  }
  const al = g.globalAlpha;
  g.fillStyle = '#0b0710';
  const h = Math.max(1, Math.round(r / 3));
  g.fillRect(x - h - 1, y - 1, h, h);
  g.fillRect(x + 1, y - 1, h, h);
  if (r >= 5) {
    g.globalAlpha = al * 0.5;
    g.fillRect(x - r + 1, y + r - 1, r * 2 - 1, 1);
    g.globalAlpha = al;
    g.fillStyle = '#ffffff';
    g.fillRect(x - r + 2, y - r + 2, 1, 1);
  }
  g.fillStyle = color;
}

/** A wad of wet cotton: three lumps, a darker underside. */
function drawWad(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillRect(x - 3, y - 2, 6, 5);
  g.fillRect(x - 4, y - 1, 8, 3);
  g.fillRect(x - 1, y - 4, 4, 3);
  g.fillRect(x - 5, y, 3, 2);
  const al = g.globalAlpha;
  g.globalAlpha = al * 0.45;
  g.fillStyle = '#0b0710';
  g.fillRect(x - 3, y + 2, 6, 1);
  g.fillRect(x + 2, y - 1, 1, 2);
  g.globalAlpha = al;
  g.fillStyle = color;
}

/** A puff of mildew spores: a few dots that breathe. */
function drawSpores(g: CanvasRenderingContext2D, b: Bullet, _c: string, t: number): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const k = Math.floor(t / 8 + (b.data.ph ?? 0)) % 2;
  g.fillRect(x - 1, y - 1, 3, 3);
  g.fillRect(x - 3 - k, y + 1, 1, 1);
  g.fillRect(x + 2 + k, y - 2, 1, 1);
  g.fillRect(x + 1, y + 3 + k, 1, 1);
  g.fillRect(x - 2, y - 3 - k, 1, 1);
}

/** A crayon, pointing where it flies. Drawn yellow whatever it really is (its color lies), at full alpha. */
function drawLyingCrayon(g: CanvasRenderingContext2D, b: Bullet): void {
  const a = Math.atan2(b.vy, b.vx);
  const c = Math.cos(a);
  const s = Math.sin(a);
  g.globalAlpha = b.alpha;
  g.fillStyle = '#ffd84a';
  for (let i = -5; i <= 3; i++) {
    g.fillRect(Math.round(b.x + c * i - s), Math.round(b.y + s * i + c), 1, 1);
    g.fillRect(Math.round(b.x + c * i), Math.round(b.y + s * i), 1, 1);
    g.fillRect(Math.round(b.x + c * i + s), Math.round(b.y + s * i - c), 1, 1);
  }
  g.fillStyle = '#b5862a';
  for (let i = -5; i <= 3; i += 4) g.fillRect(Math.round(b.x + c * i + s), Math.round(b.y + s * i - c), 1, 1);
  g.fillStyle = '#ecd3a0';
  g.fillRect(Math.round(b.x + c * 4), Math.round(b.y + s * 4), 1, 1);
  g.fillStyle = '#2b2a5c';
  g.fillRect(Math.round(b.x + c * 5), Math.round(b.y + s * 5), 1, 1);
}

/** A sewing pin, point down: a round head in its color, a grey shaft. */
function drawPin(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillRect(x - 1, y - 6, 3, 3);
  const al = g.globalAlpha;
  g.fillStyle = '#b7aab8';
  g.fillRect(x, y - 3, 1, 7);
  g.fillStyle = '#ffffff';
  g.fillRect(x, y + 4, 1, 1);
  g.globalAlpha = al;
  g.fillStyle = color;
}

/** A capital letter of the call, bold. */
function drawLetter(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const ch = String.fromCharCode(b.data.ch ?? 68);
  drawChar(g, ch, Math.round(b.x) - 3, Math.round(b.y) - 4, color);
  drawChar(g, ch, Math.round(b.x) - 2, Math.round(b.y) - 4, color);
}

// ---------------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------------

/** A projectile pointing from (x, y) toward the heart at `speed`. */
function aimAt(w: BulletWorld, x: number, y: number, speed: number): { vx: number; vy: number } {
  const dx = w.soul.x - x;
  const dy = w.soul.y - y;
  const d = Math.max(1, Math.hypot(dx, dy));
  return { vx: (dx / d) * speed, vy: (dy / d) * speed };
}

/** Darkness over the box except a small halo around the heart (and the whole box while `light` > 0). */
function darkness(g: CanvasRenderingContext2D, w: BulletWorld, radius: number, light: number): void {
  const b = w.box;
  const r = radius + light * 120;
  g.fillStyle = '#000000';
  for (let y = b.y; y < b.y + b.h; y++) {
    const dy = y + 0.5 - w.soul.y;
    const span = r * r - dy * dy;
    if (span <= 0) {
      g.fillRect(b.x, y, b.w, 1);
      continue;
    }
    const hw = Math.sqrt(span);
    const l = Math.round(w.soul.x - hw);
    const rr = Math.round(w.soul.x + hw);
    if (l > b.x) g.fillRect(b.x, y, l - b.x, 1);
    if (rr < b.x + b.w) g.fillRect(rr, y, b.x + b.w - rr, 1);
    // Dithered rim of the halo.
    g.globalAlpha = 0.5;
    if (y % 2) g.fillRect(l, y, 2, 1);
    else g.fillRect(rr - 2, y, 2, 1);
    g.globalAlpha = 1;
  }
}

let lullaby: number[] | null = null;
function lullabyNote(i: number): number {
  lullaby ??= parsePattern(LULLABY_PATTERN).events.map((e) => e.midis[0]!);
  return lullaby[((i % lullaby.length) + lullaby.length) % lullaby.length]!;
}

// ---------------------------------------------------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------------------------------------------------

export const CH6_PATTERNS: Record<string, Pattern> = {
  // --- L'Aiguille ---------------------------------------------------------------------------------------------------
  /** The needle dashes from edge to edge (a thin warning line first) and leaves running stitches that linger. */
  aiguille_points: {
    box: { w: 130, h: 70 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(52, 84 - c.power * 10);
      if (t % every === 10 && t < 330) {
        // From a random side, aimed through where the heart is now.
        const side = rng.int(0, 3);
        const x0 = side === 0 ? b.x - 10 : side === 1 ? b.x + b.w + 10 : rng.range(b.x, b.x + b.w);
        const y0 = side === 2 ? b.y - 10 : side === 3 ? b.y + b.h + 10 : rng.range(b.y, b.y + b.h);
        const v = aimAt(w, x0, y0, 2.6 + c.power * 0.3);
        // The warning: the stitches it will leave, faint, along its line.
        for (let i = 1; i < 12; i++) {
          const k = i * 12;
          w.spawn({ x: x0 + v.vx * k * 0.38, y: y0 + v.vy * k * 0.38, shape: 'custom', draw: drawStitch, emo: 'colere', dmg: 0, alpha: 0.35, maxLife: 22, clip: false, data: { dir: i % 2 ? 1 : -1 } });
        }
        audio.sfx('stitch', { pitch: 1.2, vol: 0.5 });
        w.spawn({
          x: x0,
          y: y0,
          vx: v.vx,
          vy: v.vy,
          r: 3,
          shape: 'custom',
          draw: drawNeedle,
          emo: pickEmo('colere', 0.25),
          dmg: 5,
          warn: 20,
          clip: false,
          data: { sew: 2, pierce: 1, hw: 3, hh: 3 },
          update: (bl, bw) => {
            // Every few pixels, a stitch stays behind.
            if (bl.life % 5 === 0 && bl.x > bw.box.x && bl.x < bw.box.x + bw.box.w && bl.y > bw.box.y && bl.y < bw.box.y + bw.box.h) {
              bw.spawn({ x: bl.x, y: bl.y, shape: 'custom', draw: drawStitch, emo: 'colere', dmg: 2, r: 1.5, maxLife: 70 + c.power * 10, data: { dir: (bl.life / 5) % 2 ? 1 : -1 } });
            }
          },
        });
      }
    },
  },
  /** A seam sewn through the box: the needle dives in and out along a line; the thread it leaves blocks, with gaps. */
  aiguille_couture: {
    box: { w: 140, h: 76 },
    duration: 420,
    tick(w, t, c) {
      const b = w.box;
      const period = Math.max(110, 150 - c.power * 12);
      if (t % period === 1 && t < 360) {
        const n = Math.floor(t / period);
        const y = b.y + 14 + ((n * 23) % (b.h - 28));
        const dir = n % 2 ? -1 : 1;
        w.spawn({
          x: dir > 0 ? b.x - 8 : b.x + b.w + 8,
          y,
          vx: dir * (1.3 + c.power * 0.15),
          r: 3,
          shape: 'custom',
          draw: drawNeedle,
          emo: 'colere',
          dmg: 5,
          warn: 16,
          clip: false,
          data: { sew: 2, pierce: 1, y0: y, hw: 3, hh: 3 },
          update: (bl, bw) => {
            bl.y = bl.data.y0! + Math.sin(bl.life * 0.16) * 13;
            // The thread is left only on the way down (two stitches on, one gap): cross where it is missing.
            if (bl.life % 4 === 0 && Math.cos(bl.life * 0.16) < 0.2 && bl.x > bw.box.x + 2 && bl.x < bw.box.x + bw.box.w - 2) {
              bw.spawn({ x: bl.x, y: bl.data.y0!, w: 3, h: 2, shape: 'rect', emo: 'colere', dmg: 3, maxLife: 120, alpha: 0.9 });
            }
            if (bl.life % 12 === 0) audio.sfx('stitch', { pitch: 1.4, vol: 0.25 });
          },
        });
      }
      // Loose pins fall now and then.
      if (t % 46 === 23 && t < 380) w.spawn({ x: rng.range(b.x + 6, b.x + b.w - 6), y: b.y - 6, vy: 1.2 + c.power * 0.2, r: 2, shape: 'custom', draw: drawPin, emo: pickEmo('colere', 0.5), dmg: 3, data: { hw: 1, hh: 5 } });
    },
  },

  // --- Le Bouton Pendu ------------------------------------------------------------------------------------------------
  /** The button eye swings across the box on its thread, faster and wider; buttons come loose at the ends. */
  bouton_balancier: {
    box: { w: 150, h: 72 },
    duration: 420,
    start(w, c) {
      const b = w.box;
      const px = b.x + b.w / 2;
      const py = b.y - 46;
      const len = b.h + 30;
      const pend = (ph: number, emo: Emotion): void => {
        w.spawn({
          x: px,
          y: py + len,
          r: 7,
          shape: 'custom',
          draw: drawButton,
          emo,
          dmg: 5,
          clip: false,
          maxLife: 9999,
          data: { ph, pierce: 1, lastSide: 0 },
          update: (bl, bw) => {
            const amp = 0.95 + Math.min(0.25, bl.life / 1600);
            const a = Math.sin(bl.life * (0.028 + c.power * 0.003) + bl.data.ph!) * amp;
            bl.x = px + Math.sin(a) * len;
            bl.y = py + Math.cos(a) * len;
            const side = a > 0.8 ? 1 : a < -0.8 ? -1 : 0;
            if (side && side !== bl.data.lastSide) {
              // At the end of each swing, a small button comes loose and falls.
              audio.sfx('tooth', { pitch: 0.6, vol: 0.4 });
              bw.spawn({ x: bl.x, y: bl.y, vx: -side * 0.6, vy: -1.2, ay: 0.06, r: 3, shape: 'custom', draw: drawButton, emo: pickEmo('peur', 0.4), dmg: 3, clip: false });
            }
            bl.data.lastSide = side;
          },
        });
      };
      pend(0, 'peur');
      if (c.power >= 2) pend(Math.PI, 'neutre');
      // The thread, drawn from the pivot to each button.
      w.pre = (g, bw) => {
        g.fillStyle = '#a8324a';
        for (const bl of bw.bullets) {
          if (bl.data.ph === undefined || bl.shape !== 'custom') continue;
          const n = 40;
          for (let i = 0; i < n; i++) g.fillRect(Math.round(px + ((bl.x - px) * i) / n), Math.round(py + ((bl.y - py) * i) / n), 1, 1);
        }
      };
    },
    tick() {},
  },
  /** Buttons on threads drop from the top like yo-yos, to different depths, and climb back. */
  bouton_pluie: {
    box: { w: 140, h: 70 },
    duration: 380,
    start(w) {
      w.pre = (g, bw) => {
        g.fillStyle = '#a8324a';
        for (const bl of bw.bullets) if (bl.data.top !== undefined) g.fillRect(Math.round(bl.x), Math.round(bl.data.top), 1, Math.max(0, Math.round(bl.y - bl.r - bl.data.top)));
      };
    },
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(16, 30 - c.power * 5) === 0 && t < 330) {
        const depth = rng.range(18, b.h - 8);
        const x = rng.range(b.x + 8, b.x + b.w - 8);
        w.spawn({
          x,
          y: b.y - 6,
          r: 4,
          shape: 'custom',
          draw: drawButton,
          emo: pickEmo('peur', 0.35),
          dmg: 4,
          warn: 14,
          clip: false,
          data: { top: b.y, depth, pierce: 1 },
          update: (bl) => {
            const k = Math.sin(Math.min(Math.PI, bl.life * 0.035));
            bl.y = bl.data.top! - 6 + k * (bl.data.depth! + 6);
            if (bl.life * 0.035 > Math.PI) bl.dead = true;
          },
        });
      }
    },
  },

  // --- La Bourre ------------------------------------------------------------------------------------------------------
  /** Wet cotton drips; a wad that touches the heart sticks to it and slows it down (a sad heart lets them through). */
  bourre_colle: {
    box: { w: 130, h: 72 },
    duration: 400,
    start(w) {
      w.post = (g, bw) => {
        const n = bw.bullets.filter((bl) => bl.data.stuck).length;
        if (!n) return;
        g.fillStyle = '#d4c6a2';
        g.globalAlpha = 0.85;
        for (let i = 0; i < n; i++) {
          const a = i * 2.1;
          g.fillRect(Math.round(bw.soul.x + Math.cos(a) * 4) - 1, Math.round(bw.soul.y + Math.sin(a) * 4) - 1, 3, 3);
        }
        g.globalAlpha = 1;
      };
    },
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(18, 30 - c.power * 4) === 0 && t < 350) {
        w.spawn({
          x: rng.range(b.x + 6, b.x + b.w - 6),
          y: b.y - 6,
          vx: rng.range(-0.2, 0.2),
          vy: 0.55 + c.power * 0.08,
          ay: 0.004,
          r: 4,
          shape: 'custom',
          draw: drawWad,
          emo: pickEmo('tristesse', 0.3),
          dmg: 2,
          data: { pierce: 1 },
          update: (bl, bw) => {
            if (bl.data.stuck) {
              bl.x = bw.soul.x;
              bl.y = bw.soul.y;
              bl.alpha = 0;
              return;
            }
            if (!bw.passes(bl.emo) && Math.hypot(bl.x - bw.soul.x, bl.y - bw.soul.y) < bl.r + 2) {
              bl.data.stuck = 1;
              bl.dmg = 0;
              bw.slow = Math.max(0.45, bw.slow * 0.82);
              audio.sfx('thread', { pitch: 0.6, vol: 0.4 });
            }
          },
        });
      }
      // Drops of damp between the wads: these just hurt.
      if (t % 13 === 6 && t < 360) w.spawn({ x: rng.range(b.x + 2, b.x + b.w - 2), y: b.y - 4, vy: 1.6 + c.power * 0.2, shape: 'drop', r: 2, dmg: 3, emo: 'neutre' });
    },
  },
  /** Puffs of mildew drift in from the sides, waving, and burst into spores. */
  bourre_moisi: {
    box: { w: 140, h: 70 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(30, 48 - c.power * 6) === 0 && t < 320) {
        const side = rng.chance(0.5) ? -1 : 1;
        const y0 = rng.range(b.y + 10, b.y + b.h - 10);
        w.spawn({
          x: side < 0 ? b.x - 6 : b.x + b.w + 6,
          y: y0,
          vx: -side * (0.7 + c.power * 0.1),
          r: 3,
          shape: 'custom',
          draw: drawSpores,
          emo: pickEmo('tristesse', 0.4),
          dmg: 3,
          clip: false,
          data: { y0, ph: rng.range(0, 6) },
          update: (bl, bw) => {
            bl.y = bl.data.y0! + Math.sin(bl.life * 0.06 + bl.data.ph!) * 9;
            if (bl.life === 70) {
              bl.dead = true;
              for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + bl.data.ph!;
                bw.spawn({ x: bl.x, y: bl.y, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.8, shape: 'dot', r: 1.5, emo: bl.emo, dmg: 2, maxLife: 90 });
              }
            }
          },
        });
      }
    },
  },

  // --- Les Moutons Numérotés -----------------------------------------------------------------------------------------
  /** Rubber stamps slam down on the box: a warning, the hit, and the red print that stays (harmless). */
  mouton_tampon: {
    box: { w: 140, h: 72 },
    duration: 400,
    start(w) {
      w.pre = (g, bw) => {
        g.fillStyle = '#a8324a';
        for (const bl of bw.bullets) {
          if (!bl.data.print) continue;
          g.globalAlpha = Math.min(0.5, (bl.maxLife - bl.life) / 60);
          g.fillRect(Math.round(bl.x), Math.round(bl.y), 22, 1);
          g.fillRect(Math.round(bl.x), Math.round(bl.y + 13), 22, 1);
          g.fillRect(Math.round(bl.x), Math.round(bl.y), 1, 14);
          g.fillRect(Math.round(bl.x + 21), Math.round(bl.y), 1, 14);
          drawChar(g, 'N', Math.round(bl.x) + 3, Math.round(bl.y) + 3, '#a8324a');
          g.fillRect(Math.round(bl.x) + 10, Math.round(bl.y) + 4, 3, 3);
        }
        g.globalAlpha = 1;
      };
    },
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(30, 50 - c.power * 6);
      if (t % every === 0 && t < 340) {
        // Aim at the heart, but snapped to a grid: the stamps land like files on a desk.
        const x = Math.max(b.x, Math.min(b.x + b.w - 22, Math.round((w.soul.x - 11 - b.x) / 11) * 11 + b.x + rng.int(-1, 1) * 11));
        const y = Math.max(b.y, Math.min(b.y + b.h - 14, Math.round(w.soul.y - 7)));
        const emo = pickEmo('joie', 0.3);
        w.zones.push({ x, y, w: 22, h: 14, emo, dmg: 4, warn: 24, life: 34 });
        w.spawn({
          x,
          y,
          shape: 'custom',
          draw: () => {},
          dmg: 0,
          emo: 'neutre',
          maxLife: 170,
          data: { print: 1 },
          update: (bl) => {
            if (bl.life === 24) audio.sfx('knock1', { pitch: 1.5, vol: 0.5 });
          },
        });
      }
    },
  },
  /** Numbered sheep jump across the box in arcs, from both sides. */
  mouton_saute: {
    box: { w: 150, h: 64 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(24, 40 - c.power * 5) === 0 && t < 350) {
        const n = (c.mem.count = (c.mem.count ?? 0) + 1);
        const dir = n % 2 ? 1 : -1;
        audio.sfx('baa', { pitch: 0.9 + (n % 4) * 0.06, vol: 0.4 });
        w.spawn({
          x: dir > 0 ? b.x - 8 : b.x + b.w + 8,
          y: b.y + b.h - 8,
          vx: dir * (1.3 + rng.range(0, 0.3)),
          vy: -2.4 - rng.range(0, 0.6),
          ay: 0.07,
          shape: 'sprite',
          sprite: 'b_sheep',
          r: 4,
          dmg: 4,
          emo: n % 3 === 0 ? 'neutre' : 'joie',
          clip: false,
        });
      }
    },
  },

  // --- La Pile --------------------------------------------------------------------------------------------------------
  /** The battery leaks: a white crust grows from the floor of the box in columns, then crumbles; drops of electrolyte. */
  pile_fuite: {
    box: { w: 140, h: 72 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      if (t % 40 === 20 && t < 330) {
        const col = rng.int(0, 6);
        const cw = b.w / 7;
        const hgt = Math.round(b.h * (0.25 + rng.range(0, 0.15) + c.power * 0.04));
        w.zones.push({ x: Math.round(b.x + col * cw), y: b.y + b.h - hgt, w: Math.round(cw), h: hgt, emo: 'neutre', dmg: 3, warn: 30, life: 120 });
      }
      if (t % 17 === 0 && t < 360) w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y - 4, vy: 1.1 + c.power * 0.15, shape: 'drop', r: 2, dmg: 3, emo: pickEmo('tristesse', 0.5) });
    },
  },
  /** Its voice: a waveform of static scrolling across the box, flatter every turn (CH6.voice); dots that crackle. */
  pile_gresille: {
    box: { w: 150, h: 70 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      const amp = (b.h / 2 - 8) * Math.max(0.2, CH6.voice);
      if (t % 4 === 0 && t < 330) {
        const ph = t * 0.09;
        const y = b.y + b.h / 2 + Math.sin(ph) * amp + Math.sin(ph * 2.7) * amp * 0.3;
        // A gap now and then: where the voice cut out.
        if (Math.floor(t / 24) % 4 !== 3) w.spawn({ x: b.x + b.w + 4, y, vx: -1.3 - c.power * 0.1, shape: 'dot', r: 2, dmg: 3, emo: pickEmo('tristesse', 0.3), clip: false });
      }
      if (t % 9 === 0 && t < 340 && rng.chance(0.5)) {
        // Static: a crackle that blinks in and out.
        w.spawn({
          x: rng.range(b.x + 4, b.x + b.w - 4),
          y: rng.range(b.y + 4, b.y + b.h - 4),
          shape: 'spark',
          r: 2,
          dmg: 2,
          emo: 'neutre',
          warn: 18,
          maxLife: 30,
          data: { ph: rng.range(0, 4) },
        });
        if (rng.chance(0.3)) audio.sfx('static', { vol: 0.3 });
      }
    },
  },

  // --- The final battle -----------------------------------------------------------------------------------------------
  /** Phase 1: the sheep of the player's deaths (`mem.n` this turn), counted aloud by the tally (CH6.counted). */
  v2_moutons: {
    box: { w: 150, h: 64 },
    duration: 420,
    tick(w, t, c) {
      const b = w.box;
      const n = c.mem.n ?? 12;
      const every = Math.max(9, Math.floor(340 / Math.max(1, n)));
      const k = c.mem.k ?? 0;
      if (t % every === 5 && k < n) {
        c.mem.k = k + 1;
        CH6.counted++;
        const big = CH6.counted % 5 === 0;
        audio.sfx('baa', { pitch: 0.75 + (CH6.counted % 6) * 0.05, vol: 0.4 });
        const dir = k % 7 === 6 ? -1 : 1;
        w.spawn({
          x: dir > 0 ? b.x - 8 : b.x + b.w + 8,
          y: b.y + b.h - 8,
          vx: dir * (1.4 + (n > 25 ? 0.3 : 0)),
          vy: -2.5 - rng.range(0, 0.7),
          ay: 0.075,
          shape: 'sprite',
          sprite: big ? 'b_sheep_big' : 'b_sheep',
          r: big ? 6 : 4,
          dmg: 4,
          emo: CH6.counted % 3 === 0 ? 'tristesse' : 'neutre',
          clip: false,
        });
      }
      if (t === 1) w.zones.push({ x: b.x + b.w / 2 - 3, y: b.y + b.h - 14, w: 6, h: 14, emo: 'neutre', dmg: 3, warn: 30, life: 400 });
    },
  },
  /** Phase 2: the word of the call falls, letter by letter — D, O, R, S — in columns that sway. */
  v2_dors: {
    box: { w: 140, h: 72 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      const word = 'DORS';
      if (t % Math.max(9, 14 - c.power * 2) === 0 && t < 350) {
        const i = Math.floor(t / 14) % word.length;
        const x0 = b.x + 10 + ((t * 37) % (b.w - 20));
        w.spawn({
          x: x0,
          y: b.y - 6,
          vy: 0.9 + c.power * 0.12,
          r: 3,
          shape: 'custom',
          draw: drawLetter,
          emo: i === 1 ? 'tristesse' : pickEmo('tristesse', 0.6),
          dmg: 4,
          data: { ch: word.charCodeAt(i), x0 },
          update: (bl) => {
            bl.x = bl.data.x0! + Math.sin(bl.life * 0.05) * 6;
          },
        });
      }
    },
  },
  /** Phase 2: pins fall from the roof like stalactites — a glint where each one is, then it drops. */
  v2_epingles: {
    box: { w: 150, h: 72 },
    duration: 380,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(10, 18 - c.power * 3) === 0 && t < 330) {
        const x = rng.range(b.x + 4, b.x + b.w - 4);
        w.spawn({ x, y: b.y + 5, vy: 0, ay: 0.12 + c.power * 0.02, r: 2, shape: 'custom', draw: drawPin, emo: pickEmo(rng.pick(['peur', 'tristesse'] as Emotion[]), 0.4), dmg: 4, warn: 22, data: { hw: 1, hh: 5 } });
      }
      // Tufts of stuffing float up from below, slowly.
      if (t % 45 === 0 && t < 330) w.spawn({ x: rng.range(b.x + 8, b.x + b.w - 8), y: b.y + b.h + 6, vy: -0.45, r: 4, shape: 'custom', draw: drawWad, emo: 'neutre', dmg: 3, clip: false });
    },
  },
  /**
   * Phase 2, one turn: the crayons whose color lies. They are all drawn yellow; none of them is. A yellow heart is hurt
   * like any other: dodge everything. (`data.lie`: a « ? » instead of the emotion's shape.)
   */
  v2_crayons: {
    box: { w: 150, h: 72 },
    duration: 400,
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(30, 44 - c.power * 5) === 6 && t < 340) {
        const x0 = b.x + b.w / 2 + rng.range(-40, 40);
        const y0 = b.y - 10;
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.32;
          const sp = 1.15 + c.power * 0.12;
          w.spawn({
            x: x0,
            y: y0,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            r: 3,
            shape: 'custom',
            draw: drawLyingCrayon,
            emo: rng.pick(['colere', 'tristesse', 'neutre', 'peur'] as Emotion[]),
            dmg: 4,
            clip: false,
            data: { lie: 1, hw: 3, hh: 3 },
          });
        }
        audio.sfx('write', { pitch: 0.7, vol: 0.5 });
      }
    },
  },
  /**
   * Phase 3: the knocks in the dark. Her knocks (`mem.code`: 1 or 3 at a time) ring from the left wall: warm light that
   * shows the whole box for a moment and never hurts. Dodo's false knocks ring from the radiator pipe and hurt. Pins
   * fall in the dark, glinting first. Story mode: her knocks only, slower, and slower pins.
   */
  v2_coups_noir: {
    box: { w: 150, h: 76 },
    duration: 440,
    start(w, c) {
      w.dark = true;
      c.mem.light = 0;
      w.post = (g, bw) => {
        darkness(g, bw, 24, Math.max(0, c.mem.light ?? 0) / 30);
        // The false knocks can be seen through the dark: cold dotted rings.
        for (const bl of bw.bullets) {
          if (bl.shape !== 'ring' || bl.data.light) continue;
          g.fillStyle = '#a7c7f0';
          g.globalAlpha = 0.5;
          const steps = Math.max(12, Math.floor(bl.r * 1.5));
          for (let i = 0; i < steps; i += 2) {
            const a = (i / steps) * Math.PI * 2;
            g.fillRect(Math.round(bl.x + Math.cos(a) * bl.r), Math.round(bl.y + Math.sin(a) * bl.r), 1, 1);
          }
          g.globalAlpha = 1;
        }
        // Glints of the pins about to fall.
        g.fillStyle = '#fffaf2';
        for (const bl of bw.bullets) if (bl.data.pin && bl.warn > 0 && Math.floor(bl.warn / 4) % 2) g.fillRect(Math.round(bl.x), bw.box.y + 1, 1, 2);
      };
    },
    tick(w, t, c) {
      const b = w.box;
      const story = gentle();
      if ((c.mem.light ?? 0) > 0) c.mem.light!--;
      // Her knocks, from the left wall.
      const code = c.mem.code ?? 1;
      const gap = story ? 30 : 20;
      const starts = [50, 190, 330];
      for (const s0 of starts) {
        for (let i = 0; i < code; i++) {
          if (t === s0 + i * gap) {
            audio.sfx('knock1', { vol: 0.9 });
            c.mem.light = 30;
            w.spawn({ x: b.x, y: b.y + b.h / 2, r: 4, shape: 'ring', emo: 'joie', dmg: 0, clip: false, maxLife: 60, data: { light: 1 }, update: (bl) => (bl.r += 2.4) });
          }
        }
      }
      // His false knocks, from the radiator: anywhere on the edges.
      if (!story && t % Math.max(44, 70 - c.power * 8) === 30 && t < 400) {
        const side = rng.int(0, 2);
        const x = side === 0 ? b.x + b.w : rng.range(b.x + 10, b.x + b.w - 10);
        const y = side === 0 ? rng.range(b.y + 10, b.y + b.h - 10) : side === 1 ? b.y : b.y + b.h;
        audio.sfx('pipe', { pitch: 0.9 + rng.range(0, 0.15), vol: 0.8 });
        w.spawn({ x, y, r: 3, shape: 'ring', emo: 'neutre', dmg: 4, clip: false, maxLife: 80, warn: 6, update: (bl) => (bl.r += 1.3 + c.power * 0.1) });
      }
      // Pins in the dark.
      if (t % (story ? 34 : 22) === 11 && t < 400) {
        w.spawn({ x: rng.range(b.x + 4, b.x + b.w - 4), y: b.y + 4, vy: 0, ay: story ? 0.05 : 0.09, r: 2, shape: 'custom', draw: drawPin, emo: 'neutre', dmg: 3, warn: 28, data: { pin: 1, hw: 1, hh: 5 } });
      }
    },
  },
  /**
   * Phase 4: the lullaby with holes. Walls of notes scroll across the box; in each wall, a hole at the height of the
   * melody's next note (higher note, higher hole). Follow the tune to get through.
   */
  v2_berceuse: {
    box: { w: 160, h: 76 },
    duration: 440,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(20, 28 - c.power * 2);
      if (t % every === 0 && t < 380) {
        const midi = lullabyNote(CH6.note++);
        const k = Math.max(0, Math.min(1, (midi - 67) / 14));
        const hole = b.y + b.h - 12 - k * (b.h - 24);
        const half = 11 - Math.min(3, c.power);
        const emo: Emotion = Math.floor(t / every) % 2 ? 'joie' : 'tristesse';
        for (let y = b.y + 3; y < b.y + b.h; y += 7) {
          if (Math.abs(y - hole) < half) continue;
          w.spawn({ x: b.x + b.w + 6, y, vx: -1.25 - c.power * 0.1, shape: 'note', r: 3, dmg: 4, emo: rng.chance(0.15) ? 'neutre' : emo, clip: false });
        }
      }
    },
  },
  /** Phase 4: Dodo's seams burst — fans of grey stuffing thrown from the top, and the button eye swinging below. */
  v2_coutures: {
    box: { w: 150, h: 74 },
    duration: 420,
    start(w, c) {
      CH6_PATTERNS.bouton_balancier!.start!(w, { ...c, power: Math.min(1, c.power) });
    },
    tick(w, t, c) {
      const b = w.box;
      if (t % Math.max(42, 60 - c.power * 6) === 20 && t < 360) {
        const x0 = b.x + rng.range(20, b.w - 20);
        const emos: Emotion[] = ['joie', 'tristesse', 'neutre'];
        const emo = emos[Math.floor(t / 60) % 3]!;
        audio.sfx('thread', { pitch: 0.5, vol: 0.5 });
        for (let i = 0; i < 7; i++) {
          const a = Math.PI / 2 + (i - 3) * 0.36;
          w.spawn({ x: x0, y: b.y - 4, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.2, ay: 0.01, r: 3, shape: 'custom', draw: drawWad, emo, dmg: 4, clip: false });
        }
      }
    },
  },
};

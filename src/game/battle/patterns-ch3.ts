import { audio } from '../../engine/audio';
import { drawChar } from '../../engine/font';
import { fx } from '../../engine/fx';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import type { Bullet } from './bullets';
import type { Pattern } from './patterns';

/*
 * Attack patterns of chapter 3 « L'Hôpital de Papier », version 2 (docs/HISTOIRE.md § 3.8): Bracelet, the hospital
 * wristband that crawls like a worm.
 * - `bracelet_wrap`: it coils round the box. Its clasp runs along the border, the band laid behind it hurts, and each
 *   lap tightens the box a little more, until the clasp clicks shut and lets go. The letters printed on it come loose
 *   and fall (the label it shows at that moment: `BRACELET.label`, set by src/data/enemies-ch3.ts).
 * - `bracelet_holes`: its free end, punched with adjustment holes, sweeps down across the box: the heart slips
 *   through a hole.
 */

const pickEmo = (main: Emotion, whiteChance: number): Emotion => (rng.chance(whiteChance) ? 'neutre' : main);

/** What the band says right now (letters that fall in `bracelet_wrap`). Updated by Bracelet's battle hooks. */
export const BRACELET = { label: 'MINA304' };

const WHITE = '#fffaf2';
const PINK = '#f8b6cf';
const PINK_DARK = '#e07ba5';
const GREY = '#7d6f86';

/** A point at distance `s` along the border of the box (clockwise from the top-left corner), `inset` px inside. */
function onBorder(b: { x: number; y: number; w: number; h: number }, s: number, inset: number): [number, number] {
  const w = b.w - inset * 2;
  const h = b.h - inset * 2;
  const x0 = b.x + inset;
  const y0 = b.y + inset;
  const p = 2 * (w + h);
  let d = ((s % p) + p) % p;
  if (d < w) return [x0 + d, y0];
  d -= w;
  if (d < h) return [x0 + w, y0 + d];
  d -= h;
  if (d < w) return [x0 + w - d, y0 + h];
  d -= w;
  return [x0, y0 + h - d];
}

/** The rectangles of band laid along the border from 0 to `s` (at most one lap), `t` px thick. */
function bandRects(
  b: { x: number; y: number; w: number; h: number },
  s: number,
  t: number,
): Array<{ x: number; y: number; w: number; h: number }> {
  const out: Array<{ x: number; y: number; w: number; h: number }> = [];
  let left = Math.min(s, 2 * (b.w + b.h));
  const top = Math.min(left, b.w);
  if (top > 0) out.push({ x: b.x, y: b.y, w: top, h: t });
  left -= top;
  const right = Math.min(left, b.h);
  if (right > 0) out.push({ x: b.x + b.w - t, y: b.y, w: t, h: right });
  left -= right;
  const bottom = Math.min(left, b.w);
  if (bottom > 0) out.push({ x: b.x + b.w - bottom, y: b.y + b.h - t, w: bottom, h: t });
  left -= bottom;
  const leftSide = Math.min(left, b.h);
  if (leftSide > 0) out.push({ x: b.x, y: b.y + b.h - leftSide, w: t, h: leftSide });
  return out;
}

/** The clasp crawling along the border: a little rounded head with two press studs. */
function drawClasp(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  g.fillStyle = color === WHITE ? '#ece2df' : color;
  g.fillRect(x - 4, y - 3, 9, 7);
  g.fillRect(x - 3, y - 4, 7, 9);
  g.fillStyle = WHITE;
  g.fillRect(x - 3, y - 3, 7, 2);
  g.fillStyle = '#4e4359';
  g.fillRect(x - 2, y, 2, 2);
  g.fillRect(x + 1, y, 2, 2);
  g.fillStyle = PINK;
  g.fillRect(x - 3, y + 3, 7, 1);
}

/** A letter come loose from the band. */
function drawLetter(g: CanvasRenderingContext2D, b: Bullet, color: string): void {
  const ch = String.fromCharCode(b.data.ch ?? 63);
  g.fillStyle = color;
  g.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 4, 7, 9);
  drawChar(g, ch, Math.round(b.x) - 2, Math.round(b.y) - 7, '#3d4c8f');
}

export const CH3_PATTERNS: Record<string, Pattern> = {
  bracelet_wrap: {
    box: { w: 124, h: 66 },
    duration: 380,
    start(w, c) {
      w.liveBox = true;
      c.mem.x = w.box.x;
      c.mem.y = w.box.y;
      c.mem.w = w.box.w;
      c.mem.h = w.box.h;
      c.mem.s = 0;
      c.mem.lap = 0;
      w.spawn({
        x: w.box.x,
        y: w.box.y,
        shape: 'custom',
        r: 4,
        dmg: 4,
        emo: 'neutre',
        clip: false,
        maxLife: 999,
        draw: drawClasp,
        data: { hw: 4, hh: 4, pierce: 1 },
      });
      // The band laid along the border: drawn under the heart, its hits checked below.
      w.post = (g, bw) => {
        if (c.mem.done) return;
        const t = 4;
        for (const r of bandRects(bw.box, c.mem.s ?? 0, t)) {
          const x = Math.round(r.x);
          const y = Math.round(r.y);
          const wd = Math.round(r.w);
          const ht = Math.round(r.h);
          g.fillStyle = '#ece2df';
          g.fillRect(x, y, wd, ht);
          // Pink stripe on the inner edge, and the punched adjustment holes along the band.
          const horiz = ht === t;
          const inner = horiz ? (y > bw.box.y + 1 ? y : y + t - 1) : x > bw.box.x + 1 ? x : x + t - 1;
          g.fillStyle = PINK;
          if (horiz) g.fillRect(x, inner, wd, 1);
          else g.fillRect(inner, y, 1, ht);
          g.fillStyle = GREY;
          if (horiz) for (let i = 4; i < wd - 1; i += 9) g.fillRect(x + i, y + 1, 2, 2);
          else for (let i = 4; i < ht - 1; i += 9) g.fillRect(x + 1, y + i, 2, 2);
        }
      };
    },
    tick(w, t, c) {
      const b = w.box;
      const clasp = w.bullets.find((x) => x.draw === drawClasp);
      if (t < 300) {
        // The clasp crawls round; a full lap tightens the box, and it starts again on the new border.
        const per = 2 * (b.w + b.h);
        c.mem.s = (c.mem.s ?? 0) + 3.4 + c.power * 0.4;
        if ((c.mem.s ?? 0) >= per) {
          c.mem.s = 0;
          c.mem.lap = (c.mem.lap ?? 0) + 1;
          audio.sfx('stitch', { pitch: 0.7 + (c.mem.lap ?? 0) * 0.1, vol: 0.6 });
          if ((c.mem.lap ?? 0) <= 3) {
            b.x += 6;
            b.w -= 12;
            b.y += 3;
            b.h -= 6;
          }
        }
        const [hx, hy] = onBorder(b, c.mem.s ?? 0, 2);
        if (clasp) {
          clasp.x = hx;
          clasp.y = hy;
        }
        // The band behind it hurts (refreshed every frame, so it is never drawn as a zone).
        for (const r of bandRects(b, c.mem.s ?? 0, 4)) w.zones.push({ ...r, emo: 'neutre', dmg: 3, warn: 0, life: 1 });
      } else if (t === 300) {
        // Clic. It lets go.
        audio.sfx('pop', { pitch: 0.6 });
        fx.shake(1, 6);
        c.mem.done = 1;
        if (clasp) clasp.dead = true;
      } else {
        // The box comes back to its size.
        b.x += ((c.mem.x ?? b.x) - b.x) * 0.12;
        b.y += ((c.mem.y ?? b.y) - b.y) * 0.12;
        b.w += ((c.mem.w ?? b.w) - b.w) * 0.12;
        b.h += ((c.mem.h ?? b.h) - b.h) * 0.12;
      }
      // Letters come loose and fall.
      if (t % Math.max(16, 26 - c.power * 3) === 0 && t > 20 && t < 340) {
        const label = BRACELET.label;
        const ch = label[Math.floor(t / 26) % label.length] ?? '?';
        w.spawn({
          x: rng.range(b.x + 10, b.x + b.w - 10),
          y: b.y - 6,
          vy: 0.75 + c.power * 0.1,
          shape: 'custom',
          r: 3,
          dmg: 3,
          emo: pickEmo('peur', 0.45),
          draw: drawLetter,
          data: { ch: ch.charCodeAt(0), hw: 3, hh: 4 },
          warn: 8,
        });
      }
    },
  },

  bracelet_holes: {
    box: { w: 112, h: 62 },
    duration: 360,
    tick(w, t, c) {
      const b = w.box;
      const every = Math.max(50, 70 - c.power * 6);
      if (t % every === 10 && t < 300) {
        const holeW = 15 - Math.min(3, c.power);
        const hx = rng.range(b.x + 8, b.x + b.w - holeW - 8);
        const emo = pickEmo('peur', 0.6);
        const h = 6;
        const vy = 0.8 + c.power * 0.08;
        const parts: Array<[number, number]> = [
          [b.x - 4, hx],
          [hx + holeW, b.x + b.w + 4],
        ];
        for (const [x0, x1] of parts) {
          const cw = x1 - x0;
          w.spawn({
            x: x0 + cw / 2,
            y: b.y - 8,
            vy,
            shape: 'custom',
            dmg: 3,
            emo,
            clip: true,
            maxLife: 400,
            data: { hw: cw / 2, hh: h / 2, pierce: 1, cw, edge: x0 < hx ? 1 : 0 },
            draw: (g, bl, color) => {
              const x = Math.round(bl.x - (bl.data.cw ?? 0) / 2);
              const y = Math.round(bl.y - h / 2);
              const wd = Math.round(bl.data.cw ?? 0);
              g.fillStyle = color;
              g.fillRect(x, y, wd, h);
              g.fillStyle = color === WHITE ? PINK : PINK_DARK;
              g.fillRect(x, y, wd, 1);
              g.fillRect(x, y + h - 1, wd, 1);
              // The adjustment hole: its rim on either side of the gap.
              g.fillStyle = GREY;
              const rx = bl.data.edge ? x + wd - 1 : x;
              g.fillRect(rx, y + 1, 1, h - 2);
            },
          });
        }
      }
      // Now and then a press stud pops off and bounces.
      if (t % 90 === 55 && t < 300) {
        w.spawn({
          x: rng.range(b.x + 10, b.x + b.w - 10),
          y: b.y + 4,
          vx: rng.range(-1, 1),
          vy: 0.6,
          r: 3,
          shape: 'dot',
          dmg: 3,
          emo: 'neutre',
          bounce: 3,
          warn: 16,
        });
      }
    },
  },
};

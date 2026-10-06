import { EMOTION_COLOR, type Emotion } from '../../engine/palette';
import { circleRect, type Rect } from '../../engine/math';
import { drawSprite } from '../../engine/sprite';
import { hasSpr, spr } from '../assets';
import { resonates } from './rules';

export type BulletShape =
  | 'dot'
  | 'drop'
  | 'star'
  | 'seed'
  | 'horn'
  | 'yarn'
  | 'note'
  | 'rect'
  | 'ink'
  | 'spark'
  | 'shaving'
  | 'plane'
  | 'hanger'
  | 'sprite'
  | 'ring';

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  r: number;
  w: number;
  h: number;
  shape: BulletShape;
  emo: Emotion;
  dmg: number;
  life: number;
  maxLife: number;
  angle: number;
  spin: number;
  dead: boolean;
  /** Frames during which the bullet is shown as a harmless warning. */
  warn: number;
  bounce: number;
  /** Stay inside the box (clipped) – otherwise allowed to fly anywhere. */
  clip: boolean;
  sprite?: string;
  alpha: number;
  update?: (b: Bullet, w: BulletWorld) => void;
  data: Record<string, number>;
}

export interface Soul {
  x: number;
  y: number;
  emo: Emotion;
  inv: number;
  /** Half-size of the hitbox. */
  hit: number;
}

/** Holds bullets during an enemy turn. */
export class BulletWorld {
  bullets: Bullet[] = [];
  box: Rect = { x: 100, y: 86, w: 120, h: 56 };
  t = 0;
  soul: Soul = { x: 160, y: 114, emo: 'neutre', inv: 0, hit: 2 };
  /** Called when the soul is hit by a bullet. */
  onHit: ((b: Bullet) => void) | null = null;
  /** Called when a bullet passes harmlessly through the soul (resonance). */
  onResonate: ((b: Bullet) => void) | null = null;
  /** Extra hazards drawn/checked by patterns (erased zones etc.). */
  zones: Array<Rect & { emo: Emotion; dmg: number; warn: number; life: number }> = [];

  spawn(p: Partial<Bullet>): Bullet {
    const b: Bullet = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      r: 3,
      w: 6,
      h: 6,
      shape: 'dot',
      emo: 'neutre',
      dmg: 3,
      life: 0,
      maxLife: 600,
      angle: 0,
      spin: 0,
      dead: false,
      warn: 0,
      bounce: 0,
      clip: true,
      alpha: 1,
      data: {},
      ...p,
    };
    this.bullets.push(b);
    return b;
  }

  clear(): void {
    this.bullets = [];
    this.zones = [];
  }

  update(): void {
    this.t++;
    const box = this.box;
    for (const b of this.bullets) {
      b.life++;
      if (b.warn > 0) {
        b.warn--;
        continue;
      }
      b.vx += b.ax;
      b.vy += b.ay;
      b.x += b.vx;
      b.y += b.vy;
      b.angle += b.spin;
      b.update?.(b, this);
      if (b.bounce > 0) {
        if (b.x - b.r < box.x || b.x + b.r > box.x + box.w) {
          b.vx = -b.vx;
          b.x = Math.max(box.x + b.r, Math.min(box.x + box.w - b.r, b.x));
          b.bounce--;
        }
        if (b.y - b.r < box.y || b.y + b.r > box.y + box.h) {
          b.vy = -b.vy;
          b.y = Math.max(box.y + b.r, Math.min(box.y + box.h - b.r, b.y));
          b.bounce--;
        }
      }
      if (b.life > b.maxLife) b.dead = true;
      const margin = 60;
      if (b.x < box.x - margin || b.x > box.x + box.w + margin || b.y < box.y - margin || b.y > box.y + box.h + margin) {
        if (b.life > 20) b.dead = true;
      }
      if (!b.dead && this.hits(b)) {
        if (resonates(this.soul.emo, b.emo)) {
          if (!b.data.resonated) {
            b.data.resonated = 1;
            this.onResonate?.(b);
          }
        } else if (this.soul.inv <= 0) {
          this.onHit?.(b);
          if (b.shape !== 'rect' && b.shape !== 'ring') b.dead = true;
        }
      }
    }
    for (const z of this.zones) {
      z.life--;
      if (z.warn > 0) {
        z.warn--;
        continue;
      }
      const s = this.soul;
      if (s.inv <= 0 && !resonates(s.emo, z.emo) && s.x + s.hit > z.x && s.x - s.hit < z.x + z.w && s.y + s.hit > z.y && s.y - s.hit < z.y + z.h) {
        this.onHit?.({ dmg: z.dmg, emo: z.emo } as Bullet);
      }
    }
    this.zones = this.zones.filter((z) => z.life > 0);
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  private hits(b: Bullet): boolean {
    const s = this.soul;
    const soulRect = { x: s.x - s.hit, y: s.y - s.hit, w: s.hit * 2, h: s.hit * 2 };
    if (b.shape === 'rect') {
      return soulRect.x < b.x + b.w && soulRect.x + soulRect.w > b.x && soulRect.y < b.y + b.h && soulRect.y + soulRect.h > b.y;
    }
    if (b.shape === 'ring') {
      const d = Math.hypot(s.x - b.x, s.y - b.y);
      return Math.abs(d - b.r) < 2 + s.hit && !(b.data.gapA !== undefined && angleInGap(Math.atan2(s.y - b.y, s.x - b.x), b.data.gapA, b.data.gapW ?? 0.8));
    }
    return circleRect(b.x, b.y, b.r, soulRect);
  }

  draw(g: CanvasRenderingContext2D): void {
    for (const z of this.zones) {
      const warn = z.warn > 0;
      g.globalAlpha = warn ? 0.25 + 0.2 * Math.sin(this.t * 0.5) : 0.9;
      g.fillStyle = warn ? '#ff4a5a' : z.emo === 'neutre' ? '#fffaf2' : EMOTION_COLOR[z.emo];
      g.fillRect(Math.round(z.x), Math.round(z.y), Math.round(z.w), Math.round(z.h));
    }
    g.globalAlpha = 1;
    for (const b of this.bullets) drawBullet(g, b, this.soul.emo, this.t);
    g.globalAlpha = 1;
  }
}

function angleInGap(a: number, gapA: number, gapW: number): boolean {
  let d = a - gapA;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) < gapW / 2;
}

export function drawBullet(g: CanvasRenderingContext2D, b: Bullet, soulEmo: Emotion, t: number): void {
  const color = b.emo === 'neutre' ? '#fffaf2' : EMOTION_COLOR[b.emo];
  const harmless = resonates(soulEmo, b.emo);
  let alpha = b.alpha * (harmless ? 0.45 : 1);
  if (b.warn > 0) alpha = 0.25 + 0.2 * Math.sin(t * 0.6);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  switch (b.shape) {
    case 'dot':
      if (b.r <= 2) g.fillRect(x - 1, y - 1, 3, 3);
      else {
        g.fillRect(x - b.r + 1, y - b.r, b.r * 2 - 2, b.r * 2);
        g.fillRect(x - b.r, y - b.r + 1, b.r * 2, b.r * 2 - 2);
      }
      break;
    case 'ink':
      g.fillStyle = b.emo === 'neutre' ? '#fffaf2' : color;
      g.fillRect(x - 2, y - 3, 4, 6);
      g.fillRect(x - 3, y - 2, 6, 4);
      g.fillStyle = '#0b0710';
      g.fillRect(x - 1, y - 1, 1, 1);
      break;
    case 'drop':
      g.fillRect(x, y - 3, 1, 1);
      g.fillRect(x - 1, y - 2, 3, 2);
      g.fillRect(x - 2, y, 5, 2);
      g.fillRect(x - 1, y + 2, 3, 1);
      break;
    case 'star':
      g.fillRect(x - 1, y - 3, 3, 7);
      g.fillRect(x - 3, y - 1, 7, 3);
      g.fillRect(x - 2, y - 2, 5, 5);
      break;
    case 'seed':
      g.fillRect(x - 1, y - 1, 2, 3);
      g.fillRect(x - 3, y - 4, 1, 2);
      g.fillRect(x + 2, y - 4, 1, 2);
      g.fillRect(x - 2, y - 3, 1, 1);
      g.fillRect(x + 1, y - 3, 1, 1);
      g.fillRect(x, y - 5, 1, 3);
      break;
    case 'horn': {
      const dir = b.vx >= 0 ? 1 : -1;
      for (let i = 0; i < 7; i++) {
        const hh = Math.max(1, 5 - Math.floor(i * 0.7));
        g.fillRect(x - dir * 3 + dir * i, y - Math.floor(hh / 2) - Math.floor(i / 3), 1, hh);
      }
      break;
    }
    case 'yarn':
      g.fillRect(x - 3, y - 4, 6, 8);
      g.fillRect(x - 4, y - 3, 8, 6);
      g.fillStyle = '#0b0710';
      g.globalAlpha = alpha * 0.4;
      g.fillRect(x - 2, y - 2, 4, 1);
      g.fillRect(x - 3, y, 5, 1);
      g.fillRect(x - 1, y + 2, 4, 1);
      break;
    case 'note':
      g.fillRect(x - 3, y + 1, 4, 3);
      g.fillRect(x, y - 5, 1, 7);
      g.fillRect(x + 1, y - 5, 3, 1);
      g.fillRect(x + 3, y - 4, 1, 2);
      break;
    case 'rect':
      g.fillRect(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
      break;
    case 'spark': {
      const s = Math.floor(t / 4 + b.data.ph!) % 2 === 0;
      g.fillRect(x, y - 2, 1, 5);
      g.fillRect(x - 2, y, 5, 1);
      if (s) {
        g.fillRect(x - 1, y - 1, 3, 3);
      }
      break;
    }
    case 'shaving': {
      const c = Math.cos(b.angle);
      const s = Math.sin(b.angle);
      for (let i = -3; i <= 3; i++) g.fillRect(Math.round(x + c * i), Math.round(y + s * i), 2, 2);
      break;
    }
    case 'plane': {
      const dir = b.vx >= 0 ? 1 : -1;
      g.fillRect(x - 4 * dir, y, 9, 1);
      g.fillRect(x - 2 * dir, y - 1, 5, 1);
      g.fillRect(x, y - 2, 2, 1);
      g.fillRect(x - 3 * dir, y + 1, 4, 1);
      break;
    }
    case 'hanger': {
      const c = Math.cos(b.angle);
      const s = Math.sin(b.angle);
      for (let i = -5; i <= 5; i++) g.fillRect(Math.round(x + c * i), Math.round(y + s * i + Math.abs(i) * 0.4 * c), 1, 1);
      g.fillRect(Math.round(x - s * 3), Math.round(y + c * -3), 1, 3);
      break;
    }
    case 'ring': {
      const steps = Math.max(12, Math.floor(b.r * 2));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        if (b.data.gapA !== undefined && angleInGap(a, b.data.gapA, b.data.gapW ?? 0.8)) continue;
        g.fillRect(Math.round(b.x + Math.cos(a) * b.r), Math.round(b.y + Math.sin(a) * b.r), 2, 2);
      }
      break;
    }
    case 'sprite':
      if (b.sprite && hasSpr(b.sprite)) drawSprite(g, spr(b.sprite), x, y + Math.floor(spr(b.sprite).h / 2));
      break;
  }
  g.globalAlpha = 1;
}

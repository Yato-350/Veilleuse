import { drawSprite, type Sprite } from '../../engine/sprite';
import { type Dir, type Rect } from '../../engine/math';
import { charSet, hasSpr, spr, walkFrame } from '../assets';
import type { Script } from './types';

export type EntityKind = 'player' | 'npc' | 'prop' | 'enemy' | 'follower';

let nextUid = 1;

export class Entity {
  uid = nextUid++;
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  dir: Dir = 'down';
  moving = false;
  animT = 0;
  char?: string;
  sprite?: string;
  frames?: string[];
  frameSpeed = 12;
  /** Collision box size at the feet. */
  hitW = 10;
  hitH = 6;
  /** Custom collision rect (props), relative to x/y top-left instead of feet. */
  rect?: Rect;
  solid = true;
  visible = true;
  shadow = true;
  /** Vertical offset (jumps, floating). */
  z = 0;
  float = false;
  alpha = 1;
  /** Sort layer: -1 always below, 0 y-sorted, 1 always above. */
  layer: -1 | 0 | 1 = 0;
  interact?: Script;
  text?: string | string[];
  who?: string;
  light?: { r: number; color?: string; flicker?: boolean; dy?: number };
  /** Optional per-frame behavior. */
  brain?: (e: Entity) => void;
  // Scripted movement
  target: { x: number; y: number; speed: number; resolve: () => void } | null = null;
  ghost = false;
  /** Draw offset for sprites (props). */
  ox = 0;
  oy = 0;
  scaleX = 1;
  scaleY = 1;
  /** Emote bubble ('!', '?', '…', '♥'). */
  emote: { ch: string; t: number } | null = null;
  variant?: string;
  flash = 0;
  home = { x: 0, y: 0 };
  data: Record<string, unknown> = {};

  constructor(id: string, kind: EntityKind, x: number, y: number) {
    this.id = id;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.home = { x, y };
  }

  /** Collision rectangle in world pixels. */
  get box(): Rect {
    if (this.rect) return { x: this.rect.x, y: this.rect.y, w: this.rect.w, h: this.rect.h };
    return { x: this.x - this.hitW / 2, y: this.y - this.hitH, w: this.hitW, h: this.hitH };
  }

  /** Larger rectangle used for interaction checks. */
  get talkBox(): Rect {
    const b = this.box;
    return { x: b.x - 3, y: b.y - 6, w: b.w + 6, h: b.h + 9 };
  }

  get sortY(): number {
    if (this.rect) return this.rect.y + this.rect.h;
    return this.y;
  }

  currentSprite(): Sprite | null {
    if (this.char) {
      const set = charSet(this.char, this.variant);
      if (set) return walkFrame(set, this.dir, this.animT, this.moving);
    }
    if (this.frames?.length) {
      const key = this.frames[Math.floor(this.animT / this.frameSpeed) % this.frames.length]!;
      return spr(this.withVariant(key));
    }
    if (this.sprite) return spr(this.withVariant(this.sprite));
    return null;
  }

  private withVariant(key: string): string {
    if (this.variant && hasSpr(`${key}@${this.variant}`)) return `${key}@${this.variant}`;
    return key;
  }

  /** Moves toward the scripted target. Returns true while moving. */
  stepTarget(): boolean {
    const t = this.target;
    if (!t) return false;
    const dx = t.x - this.x;
    const dy = t.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= t.speed) {
      this.x = t.x;
      this.y = t.y;
      this.target = null;
      this.moving = false;
      t.resolve();
      return false;
    }
    this.x += (dx / dist) * t.speed;
    this.y += (dy / dist) * t.speed;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else this.dir = dy > 0 ? 'down' : 'up';
    this.moving = true;
    return true;
  }

  moveTo(x: number, y: number, speed = 1): Promise<void> {
    this.target?.resolve();
    return new Promise((resolve) => {
      this.target = { x, y, speed, resolve };
    });
  }

  update(): void {
    this.animT++;
    if (this.flash > 0) this.flash--;
    if (this.emote) {
      this.emote.t++;
      if (this.emote.t > 70) this.emote = null;
    }
    this.brain?.(this);
  }

  draw(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (!this.visible) return;
    const s = this.currentSprite();
    const sx = Math.round(this.x - camX + this.ox);
    const bob = this.float ? Math.round(Math.sin(this.animT * 0.06) * 2) - 3 : 0;
    const sy = Math.round(this.y - camY + this.oy - this.z + bob);
    if (this.shadow && this.kind !== 'prop') {
      g.save();
      g.globalAlpha = 0.28 * this.alpha;
      g.fillStyle = '#0b0710';
      const w = s ? Math.min(12, Math.max(6, s.w - 6)) : 8;
      g.beginPath();
      g.ellipse(Math.round(this.x - camX), Math.round(this.y - camY), w / 2, 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    if (s) {
      if (this.scaleX !== 1 || this.scaleY !== 1 || this.alpha !== 1) {
        drawSprite(g, s, sx, sy, { alpha: this.alpha, scaleX: this.scaleX, scaleY: this.scaleY });
      } else {
        drawSprite(g, s, sx, sy);
      }
    }
  }
}

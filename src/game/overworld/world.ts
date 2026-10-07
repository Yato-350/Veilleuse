import { audio } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { drawOutlined, drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { clamp, DIR_VEC, rectsOverlap, rng, type Dir, type Rect, pointInRect, hash2 } from '../../engine/math';
import { ctx2d, makeCanvas } from '../../engine/sprite';
import { MAPS } from '../../data/maps';
import { hasSpr } from '../assets';
import { G, setFlag } from '../state';
import { dialogue } from '../ui/dialogue';
import { Entity } from './entity';
import { Particles } from './particles';
import { Tilemap } from './tilemap';
import type { MapDef, Script, SpawnDef, TriggerDef, WarpDef } from './types';

export interface WorldHooks {
  run(script: Script): Promise<void>;
  encounter(enemy: Entity): void;
  openMenu(): void;
}

const PLAYER_SPEED = 1.15;
const STEP_PITCH: Record<string, number> = { grass: 0.7, wood: 1.25, stone: 1.6, carpet: 0.55, paper: 2.2, water: 0.9 };
const RUN_SPEED = 1.9;

/** The exploration scene. */
export class WorldScene implements Scene {
  map!: MapDef;
  tilemap!: Tilemap;
  entities: Entity[] = [];
  player!: Entity;
  follower: Entity | null = null;
  camX = 0;
  camY = 0;
  camTarget: { x: number; y: number } | null = null;
  particles = new Particles();
  /** >0 while a cutscene/script controls the game. */
  busy = 0;
  hooks!: WorldHooks;
  private history: Array<{ x: number; y: number; dir: Dir }> = [];
  private _dark: HTMLCanvasElement | null = null;
  private _darkG: CanvasRenderingContext2D | null = null;
  private get darkCanvas(): HTMLCanvasElement {
    return (this._dark ??= makeCanvas(W, H));
  }
  private get darkG(): CanvasRenderingContext2D {
    return (this._darkG ??= ctx2d(this.darkCanvas));
  }
  private bannerT = 0;
  private stepT = 0;
  /** Frames during which enemies can't start a battle (after fleeing / loading). */
  grace = 0;
  private triggersInside = new Set<TriggerDef>();
  private warpLock = false;
  /** Light radius around the player when the map is dark. */
  playerLight = 40;
  extraDarkness = 0;
  lightFlicker = 1;
  /** Hide HUD hints. */
  hideHud = false;
  frame = 0;

  get world(): string {
    return this.map?.world ?? 'dream';
  }

  get variant(): string | undefined {
    return this.world === 'dream' ? undefined : this.world;
  }

  /** Loads a map and places the player at a spawn. */
  load(mapId: string, spawn: string | SpawnDef, opts: { keepMusic?: boolean } = {}): void {
    const map = MAPS[mapId];
    if (!map) throw new Error(`Unknown map ${mapId}`);
    this.map = map;
    this.tilemap = new Tilemap(map);
    this.tilemap.render();
    this.entities = [];
    this.triggersInside.clear();
    setFlag('world', map.world);
    const sp: SpawnDef = typeof spawn === 'string' ? (map.spawns[spawn] ?? map.spawns.default ?? { x: 1, y: 1 }) : spawn;
    const variant = map.world === 'dream' ? undefined : map.world;

    // Player
    const p = new Entity('player', 'player', sp.x * TILE + 8, sp.y * TILE + 14);
    p.char = 'noa';
    p.variant = variant;
    p.dir = sp.dir ?? 'down';
    this.player = p;
    this.entities.push(p);

    // Follower
    this.follower = null;
    if (G.state.party.includes('mina') && !map.noFollower) {
      const f = new Entity('mina', 'follower', p.x, p.y - 1);
      f.char = 'mina';
      f.variant = variant;
      f.dir = p.dir;
      f.solid = false;
      this.follower = f;
      this.entities.push(f);
    }
    this.history = [];

    // Props
    for (const [i, pd] of (map.props ?? []).entries()) {
      if (pd.cond && !pd.cond()) continue;
      const w = (pd.w ?? 1) * TILE;
      const h = (pd.h ?? 1) * TILE;
      const e = new Entity(pd.id ?? `prop${i}`, 'prop', pd.x * TILE + w / 2, pd.y * TILE + h);
      e.rect = { x: pd.x * TILE, y: pd.y * TILE, w, h };
      e.sprite = pd.sprite;
      e.frames = pd.frames;
      if (pd.frameSpeed) e.frameSpeed = pd.frameSpeed;
      e.ox = pd.ox ?? 0;
      e.oy = pd.oy ?? 0;
      e.solid = pd.solid ?? true;
      e.shadow = false;
      e.layer = pd.over ? 1 : pd.under ? -1 : 0;
      e.text = pd.text;
      e.who = pd.who;
      e.interact = pd.script;
      e.light = pd.light;
      e.float = !!pd.float;
      e.variant = variant;
      this.entities.push(e);
    }

    // NPCs
    for (const nd of map.npcs ?? []) {
      if (nd.cond && !nd.cond()) continue;
      const e = new Entity(nd.id, 'npc', nd.x * TILE + 8, nd.y * TILE + 14);
      e.char = nd.char;
      e.sprite = nd.sprite;
      e.frames = nd.frames;
      if (nd.frameSpeed) e.frameSpeed = nd.frameSpeed;
      e.dir = nd.dir ?? 'down';
      e.text = nd.text;
      e.who = nd.who;
      e.interact = nd.script;
      e.float = !!nd.float;
      e.solid = nd.solid ?? true;
      e.shadow = nd.shadow ?? true;
      e.light = nd.light;
      e.variant = variant;
      if (nd.wander) e.brain = wanderBrain(nd.wander, this);
      this.entities.push(e);
    }

    // Enemies
    for (const ed of map.enemies ?? []) {
      if (G.state.cleared.includes(ed.id)) continue;
      if (ed.cond && !ed.cond()) continue;
      const e = new Entity(ed.id, 'enemy', ed.x * TILE + 8, ed.y * TILE + 14);
      e.sprite = ed.sprite ?? `ow_${ed.enemies[0]}`;
      e.frames = [e.sprite, `${e.sprite}_2`].filter((k) => hasSpr(k));
      e.frameSpeed = 16;
      e.solid = false;
      e.data.enemies = ed.enemies;
      e.data.passive = !!ed.passive;
      e.variant = variant;
      e.brain = enemyBrain(ed.wander ?? 2, this);
      this.entities.push(e);
    }

    this.particles.setMode(map.particles);
    this.playerLight = map.playerLight ?? 40;
    this.extraDarkness = 0;
    fx.vignette = map.vignette ?? (map.world === 'real' ? 0.55 : 0.25);
    fx.grain = map.grain ?? (map.world === 'real' ? 0.35 : 0);
    if (!opts.keepMusic && map.music !== undefined) audio.playMusic(map.music, { fadeIn: 1 });
    audio.setAmbience(map.ambience ?? 'none');
    this.snapCamera();
    this.grace = 40;
    this.bannerT = map.banner ? 1 : 0;
    G.state.map = mapId;
    // Triggers the player spawns inside shouldn't fire immediately.
    for (const t of map.triggers ?? []) if (rectsOverlap(this.player.box, this.trigRect(t))) this.triggersInside.add(t);
    this.warpLock = (map.warps ?? []).some((w) => !w.door && rectsOverlap(this.player.box, this.warpRect(w)));
    if (map.onEnter) void this.hooks.run(map.onEnter);
  }

  get(id: string): Entity | undefined {
    return this.entities.find((e) => e.id === id);
  }

  addEntity(e: Entity): Entity {
    this.entities.push(e);
    return e;
  }

  removeEntity(id: string | Entity): void {
    this.entities = this.entities.filter((e) => (typeof id === 'string' ? e.id !== id : e !== id));
    if (this.follower && (id === this.follower || id === this.follower.id)) this.follower = null;
  }

  /** Adds Mina (or another follower) behind the player. */
  setFollower(char: string | null): void {
    if (this.follower) this.removeEntity(this.follower);
    this.follower = null;
    if (!char) return;
    const f = new Entity(char, 'follower', this.player.x, this.player.y - 1);
    f.char = char;
    f.variant = this.variant;
    f.solid = false;
    f.dir = this.player.dir;
    this.follower = f;
    this.entities.push(f);
    this.history = [];
  }

  private trigRect(t: TriggerDef): Rect {
    return { x: t.x * TILE, y: t.y * TILE, w: (t.w ?? 1) * TILE, h: (t.h ?? 1) * TILE };
  }

  private warpRect(w: WarpDef): Rect {
    return { x: w.x * TILE, y: w.y * TILE, w: (w.w ?? 1) * TILE, h: (w.h ?? 1) * TILE };
  }

  snapCamera(): void {
    const t = this.cameraGoal();
    this.camX = t.x;
    this.camY = t.y;
  }

  private cameraGoal(): { x: number; y: number } {
    const fx0 = this.camTarget?.x ?? this.player.x;
    const fy0 = this.camTarget?.y ?? this.player.y - 8;
    const mw = this.tilemap.pxW;
    const mh = this.tilemap.pxH;
    const x = mw <= W ? (mw - W) / 2 : clamp(fx0 - W / 2, 0, mw - W);
    const y = mh <= H ? (mh - H) / 2 : clamp(fy0 - H / 2, 0, mh - H);
    return { x, y };
  }

  // -------------------------------------------------------------------------
  // Collision
  // -------------------------------------------------------------------------

  blocked(e: Entity, nx: number, ny: number): boolean {
    const b = { x: nx - e.hitW / 2, y: ny - e.hitH, w: e.hitW, h: e.hitH };
    const tm = this.tilemap;
    if (
      tm.solidAt(b.x, b.y) ||
      tm.solidAt(b.x + b.w - 0.01, b.y) ||
      tm.solidAt(b.x, b.y + b.h - 0.01) ||
      tm.solidAt(b.x + b.w - 0.01, b.y + b.h - 0.01)
    ) {
      return true;
    }
    for (const o of this.entities) {
      if (o === e || !o.solid || !o.visible || o.kind === 'follower') continue;
      if (rectsOverlap(b, o.box)) return true;
    }
    return false;
  }

  /** Moves with axis separation and corner sliding. Returns true if the entity moved. */
  move(e: Entity, dx: number, dy: number): boolean {
    let moved = false;
    if (dx !== 0) {
      if (!this.blocked(e, e.x + dx, e.y)) {
        e.x += dx;
        moved = true;
      } else if (dy === 0) {
        // Corner nudge: slide around obstacles when slightly misaligned.
        for (const n of [1, -1]) {
          for (let k = 1; k <= 5; k++) {
            if (!this.blocked(e, e.x + dx, e.y + n * k) && !this.blocked(e, e.x, e.y + n * Math.min(k, 1))) {
              e.y += n * 0.75;
              return true;
            }
          }
        }
      }
    }
    if (dy !== 0) {
      if (!this.blocked(e, e.x, e.y + dy)) {
        e.y += dy;
        moved = true;
      } else if (dx === 0) {
        for (const n of [1, -1]) {
          for (let k = 1; k <= 5; k++) {
            if (!this.blocked(e, e.x + n * k, e.y + dy) && !this.blocked(e, e.x + n * Math.min(k, 1), e.y)) {
              e.x += n * 0.75;
              return true;
            }
          }
        }
      }
    }
    return moved;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  get controllable(): boolean {
    return this.busy === 0 && !dialogue.busy;
  }

  update(): void {
    if (!this.map) return;
    this.frame++;
    G.state.playtime += 1 / 60;
    if (this.grace > 0) this.grace--;
    const p = this.player;

    if (this.controllable) {
      if (input.pressed('menu')) {
        audio.sfx('select');
        this.hooks.openMenu();
        return;
      }
      const ax = input.axis();
      const running = input.down('b');
      const speed = running ? RUN_SPEED : PLAYER_SPEED;
      let dx = ax.x;
      let dy = ax.y;
      if (dx !== 0 && dy !== 0) {
        dx *= Math.SQRT1_2;
        dy *= Math.SQRT1_2;
      }
      if (dx !== 0 || dy !== 0) {
        // Facing: prefer the newly pressed axis.
        if (dx !== 0 && dy !== 0) {
          const hd: Dir = dx > 0 ? 'right' : 'left';
          const vd: Dir = dy > 0 ? 'down' : 'up';
          if (p.dir !== hd && p.dir !== vd) p.dir = Math.abs(dx) >= Math.abs(dy) ? hd : vd;
        } else if (dx !== 0) p.dir = dx > 0 ? 'right' : 'left';
        else p.dir = dy > 0 ? 'down' : 'up';
        const moved = this.move(p, dx * speed, dy * speed);
        p.moving = moved;
        if (moved) {
          p.animT += running ? 1 : 0;
          this.stepT += running ? 1.6 : 1;
          if (this.stepT > 16) {
            this.stepT = 0;
            const surf = this.tilemap.tileAt(Math.floor(p.x / TILE), Math.floor((p.y - 2) / TILE))?.surface;
            const base = surf ? STEP_PITCH[surf] : 1;
            audio.sfx('step', { pitch: base * (0.85 + rng.next() * 0.3), vol: surf === 'carpet' || surf === 'grass' ? 0.45 : 0.7 });
          }
        }
      } else {
        p.moving = false;
      }
      if (input.pressed('a')) this.interact();
      this.checkTriggers();
      this.checkWarps();
    } else if (!p.target) {
      p.moving = false;
    }

    for (const e of this.entities) {
      if (e.target) e.stepTarget();
      e.update();
    }
    this.updateFollower();
    this.checkEnemies();
    // Camera
    const goal = this.cameraGoal();
    this.camX += (goal.x - this.camX) * 0.18;
    this.camY += (goal.y - this.camY) * 0.18;
    if (Math.abs(goal.x - this.camX) < 0.3) this.camX = goal.x;
    if (Math.abs(goal.y - this.camY) < 0.3) this.camY = goal.y;
    this.particles.update(this.camX, this.camY);
    if (this.bannerT > 0) this.bannerT++;
    if (this.bannerT > 200) this.bannerT = 0;
  }

  private updateFollower(): void {
    const f = this.follower;
    if (!f || f.target) return;
    const p = this.player;
    const last = this.history[this.history.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) >= 1) {
      this.history.push({ x: p.x, y: p.y, dir: p.dir });
      if (this.history.length > 60) this.history.shift();
    }
    const delay = 16;
    if (this.history.length > delay) {
      const h = this.history[this.history.length - 1 - delay]!;
      f.moving = Math.hypot(h.x - f.x, h.y - f.y) > 0.3;
      if (f.moving) {
        const dx = h.x - f.x;
        const dy = h.y - f.y;
        if (Math.abs(dx) > Math.abs(dy)) f.dir = dx > 0 ? 'right' : 'left';
        else if (Math.abs(dy) > 0.1) f.dir = dy > 0 ? 'down' : 'up';
      }
      f.x = h.x;
      f.y = h.y;
    } else {
      f.moving = false;
    }
    if (!p.moving) f.moving = false;
  }

  /** Teleports the follower behind the player (after cutscenes). */
  resetFollower(): void {
    if (!this.follower) return;
    const [vx, vy] = DIR_VEC[this.player.dir];
    this.follower.x = this.player.x - vx * 14;
    this.follower.y = this.player.y - vy * 14;
    this.follower.dir = this.player.dir;
    this.history = [];
  }

  private frontPoint(): { x: number; y: number } {
    const p = this.player;
    const [vx, vy] = DIR_VEC[p.dir];
    return { x: p.x + vx * 11, y: p.y - 3 + vy * 10 };
  }

  private interact(): void {
    const pt = this.frontPoint();
    const candidates = this.entities.filter(
      (e) =>
        e !== this.player &&
        e.visible &&
        e.kind !== 'follower' &&
        (e.interact || e.text) &&
        pointInRect(pt.x, pt.y, e.kind === 'prop' ? inflate(e.box, 2) : e.talkBox),
    );
    // Also allow talking to the follower.
    if (!candidates.length && this.follower && pointInRect(pt.x, pt.y, this.follower.talkBox) && this.follower.interact) {
      candidates.push(this.follower);
    }
    const target = candidates.sort((a, b) => dist(a, pt) - dist(b, pt))[0];
    if (target) {
      // NPCs turn to face the player.
      if (target.kind === 'npc' && target.char) target.dir = opposite(this.player.dir);
      void this.hooks.run(async (d) => {
        if (target.interact) await target.interact(d);
        else if (target.text) await d.say(target.text, target.who);
      });
      return;
    }
    // Door warps (several conditional warps may share a tile: the first whose condition passes wins).
    const doors = (this.map.warps ?? []).filter((w) => w.door && pointInRect(pt.x, pt.y, this.warpRect(w)));
    const door = doors.find((w) => !w.cond || w.cond()) ?? doors[0];
    if (door) this.doWarp(door);
  }

  private checkTriggers(): void {
    const pb = this.player.box;
    for (const t of this.map.triggers ?? []) {
      const inside = rectsOverlap(pb, this.trigRect(t));
      if (inside && !this.triggersInside.has(t)) {
        this.triggersInside.add(t);
        if (t.once && G.state.flags[t.once]) continue;
        if (t.cond && !t.cond()) continue;
        if (t.once) setFlag(t.once);
        void this.hooks.run(t.script);
        return;
      } else if (!inside) {
        this.triggersInside.delete(t);
      }
    }
  }

  private checkWarps(): void {
    const pb = this.player.box;
    let any = false;
    const hits = (this.map.warps ?? []).filter((w) => !w.door && rectsOverlap(pb, this.warpRect(w)));
    if (hits.length) {
      any = true;
      if (!this.warpLock) {
        this.warpLock = true;
        this.doWarp(hits.find((w) => !w.cond || w.cond()) ?? hits[0]!);
        return;
      }
    }
    if (!any) this.warpLock = false;
  }

  private doWarp(w: WarpDef): void {
    if (w.cond && !w.cond()) {
      if (w.locked) void this.hooks.run((d) => d.say(w.locked!));
      return;
    }
    void this.hooks.run(async (d) => {
      await d.warp(w.to, w.spawn, { sfx: w.sfx ?? (w.door ? 'door' : 'none') });
    });
  }

  private checkEnemies(): void {
    if (!this.controllable || this.grace > 0) return;
    const pb = inflate(this.player.box, -1);
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || !e.visible) continue;
      const eb = { x: e.x - 6, y: e.y - 8, w: 12, h: 8 };
      if (rectsOverlap(pb, eb)) {
        this.hooks.encounter(e);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Draw
  // -------------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D): void {
    if (!this.map) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      return;
    }
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    g.fillStyle = this.map.bg ?? (this.world === 'real' ? '#0a0b12' : '#1a1424');
    g.fillRect(0, 0, W, H);
    if (this.tilemap.ground) g.drawImage(this.tilemap.ground, -cx, -cy);
    this.tilemap.drawAnimated(g, cx, cy, this.frame, W, H);
    if (this.tilemap.edges) g.drawImage(this.tilemap.edges, -cx, -cy);

    const sorted = [...this.entities].sort((a, b) => a.layer - b.layer || a.sortY - b.sortY || a.uid - b.uid);
    for (const e of sorted) {
      if (e.layer === 1) continue;
      e.draw(g, cx, cy);
    }
    if (this.tilemap.over) g.drawImage(this.tilemap.over, -cx, -cy);
    for (const e of sorted) if (e.layer === 1) e.draw(g, cx, cy);

    this.particles.draw(g, cx, cy);
    this.drawLighting(g, cx, cy);
    for (const e of this.entities) if (e.emote) drawEmote(g, e, cx, cy);
    this.drawHud(g);
  }

  private drawLighting(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    const dark = clamp((this.map.darkness ?? 0) + this.extraDarkness, 0, 1);
    if (dark <= 0) return;
    const d = this.darkG;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = this.world === 'real' ? `rgba(6,7,16,${dark})` : `rgba(12,6,20,${dark})`;
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const lights: Array<{ x: number; y: number; r: number; color?: string }> = [];
    const flick = this.lightFlicker;
    if (this.playerLight > 0) lights.push({ x: this.player.x - cx, y: this.player.y - 10 - cy, r: this.playerLight * flick });
    for (const e of this.entities) {
      if (!e.light || !e.visible) continue;
      const f = e.light.flicker ? 0.92 + 0.08 * Math.sin(this.frame * 0.3 + e.uid) + (hash2(this.frame >> 2, e.uid) < 0.04 ? -0.25 : 0) : 1;
      const ly = (e.rect ? e.rect.y + e.rect.h / 2 : e.y - 8) + (e.light.dy ?? 0);
      lights.push({ x: e.x - cx, y: ly - cy, r: e.light.r * f * flick, color: e.light.color });
    }
    for (const l of lights) {
      if (l.r <= 0) continue;
      const grad = d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.75)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grad;
      d.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.drawImage(this.darkCanvas, 0, 0);
    // Warm glows
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.color) continue;
      const grad = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
      grad.addColorStop(0, l.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.22;
      g.fillStyle = grad;
      g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.restore();
  }

  private drawHud(g: CanvasRenderingContext2D): void {
    if (this.hideHud) return;
    if (this.bannerT > 0 && this.map.banner) {
      const t = this.bannerT;
      const a = t < 30 ? t / 30 : t > 170 ? (200 - t) / 30 : 1;
      g.save();
      g.globalAlpha = Math.max(0, a);
      const name = this.map.name;
      g.fillStyle = 'rgba(11,7,16,0.75)';
      g.fillRect(0, 10, 140, 17);
      g.fillStyle = '#fffaf2';
      g.fillRect(0, 26, 140, 1);
      drawText(g, name, 8, 12, { color: '#fffaf2', shadow: '#0b0710' });
      g.restore();
    }
    // Interaction hint: small sparkle over the thing in front of the player.
    if (this.controllable && G.settings.textSpeed >= 0) {
      const pt = this.frontPoint();
      const target = this.entities.find(
        (e) =>
          e !== this.player &&
          e.kind !== 'follower' &&
          e.visible &&
          (e.interact || e.text) &&
          pointInRect(pt.x, pt.y, e.kind === 'prop' ? inflate(e.box, 2) : e.talkBox),
      );
      if (target) {
        const bob = Math.floor(this.frame / 20) % 2;
        const s = target.currentSprite();
        const topY = target.kind === 'prop' && target.rect ? target.rect.y + target.rect.h - (s?.h ?? 16) + target.oy : target.y - (s?.h ?? 20);
        const x = Math.round(target.x - this.camX + target.ox);
        const y = Math.round(topY - this.camY - 9 - bob);
        drawOutlined(g, '!', x - 1, y - 3, '#ffd84a', '#0b0710');
      }
    }
  }
}

function inflate(r: Rect, n: number): Rect {
  return { x: r.x - n, y: r.y - n, w: r.w + n * 2, h: r.h + n * 2 };
}

function dist(e: Entity, p: { x: number; y: number }): number {
  return Math.hypot(e.x - p.x, e.y - p.y);
}

export function opposite(d: Dir): Dir {
  return d === 'up' ? 'down' : d === 'down' ? 'up' : d === 'left' ? 'right' : 'left';
}

function drawEmote(g: CanvasRenderingContext2D, e: Entity, cx: number, cy: number): void {
  const em = e.emote!;
  const s = e.currentSprite();
  const pop = em.t < 8 ? em.t / 8 : 1;
  const x = Math.round(e.x - cx);
  const y = Math.round(e.y - cy - (s?.h ?? 22) - 10 - (1 - pop) * 4);
  g.fillStyle = '#0b0710';
  g.fillRect(x - 6, y - 5, 13, 13);
  g.fillStyle = '#fffaf2';
  g.fillRect(x - 5, y - 4, 11, 11);
  g.fillRect(x - 1, y + 7, 3, 2);
  const color = em.ch === '!' ? '#e8505b' : em.ch === '♥' ? '#e07ba5' : '#1c1424';
  drawText(g, em.ch, x - Math.floor(measureEmote(em.ch) / 2), y - 4, { color });
}

function measureEmote(ch: string): number {
  return ch === '!' ? 1 : ch === '…' ? 5 : ch === '♥' ? 7 : 5;
}

/** Random wandering around the spawn point. */
function wanderBrain(radius: number, world: WorldScene) {
  let wait = rng.int(60, 180);
  return (e: Entity) => {
    if (e.target || world.busy) return;
    if (wait-- > 0) {
      e.moving = false;
      return;
    }
    wait = rng.int(90, 240);
    const tx = e.home.x + rng.int(-radius, radius) * 8;
    const ty = e.home.y + rng.int(-radius, radius) * 8;
    if (!world.blocked(e, tx, ty)) void e.moveTo(tx, ty, 0.4);
  };
}

/** Enemies wander and chase the player when close. */
function enemyBrain(radius: number, world: WorldScene) {
  let wait = rng.int(30, 120);
  let dirX = 0;
  let dirY = 0;
  return (e: Entity) => {
    if (world.busy || dialogue.busy) {
      e.moving = false;
      return;
    }
    const p = world.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    const homeD = Math.hypot(e.home.x - e.x, e.home.y - e.y);
    if (!e.data.passive && d < 60 && homeD < radius * 16 + 70 && world.grace <= 0) {
      const sp = 0.75;
      world.move(e, (dx / d) * sp, (dy / d) * sp);
      e.moving = true;
      if (!e.data.alerted) {
        e.data.alerted = true;
        e.emote = { ch: '!', t: 0 };
      }
      return;
    }
    e.data.alerted = false;
    if (wait-- > 0) {
      if (dirX || dirY) {
        world.move(e, dirX * 0.35, dirY * 0.35);
        if (Math.hypot(e.home.x - e.x, e.home.y - e.y) > radius * 16) {
          dirX = Math.sign(e.home.x - e.x);
          dirY = Math.sign(e.home.y - e.y);
        }
      }
      return;
    }
    wait = rng.int(50, 150);
    const r = rng.next();
    if (r < 0.35) {
      dirX = 0;
      dirY = 0;
    } else {
      const a = rng.range(0, Math.PI * 2);
      dirX = Math.cos(a);
      dirY = Math.sin(a);
    }
  };
}

export const world = new WorldScene();

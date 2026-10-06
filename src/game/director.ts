import { audio, type Ambience, type Sfx } from '../engine/audio';
import { TILE } from '../engine/constants';
import { fx } from '../engine/fx';
import { game } from '../engine/game';
import { input } from '../engine/input';
import { type Dir } from '../engine/math';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { Battle } from './battle/battle';
import type { BattleOptions, BattleResult } from './battle/types';
import { Entity } from './overworld/entity';
import type { NpcDef, Script } from './overworld/types';
import { world } from './overworld/world';
import { G, MAX_ITEMS, maxHp, setFlag, writeMeta, writeSave } from './state';
import { dialogue, type SayOptions } from './ui/dialogue';
import { GameOverScene } from './scenes/gameover';
import { ChapterCard } from './scenes/chapter';
import { ImageScene } from './scenes/image';
import { openMenu } from './scenes/menu';
import { PaperScene } from './scenes/paper';
import { CrashScene } from './scenes/crash';
import { PoemScene } from './scenes/poem';
import type { WordDef } from './battle/types';
import { ScriptAbort } from './flow';

/** Scripting API used by cutscenes, NPCs and events. */
export class Director {
  // ---------------------------------------------------------------------------
  // Text
  // ---------------------------------------------------------------------------

  say(text: string | string[], who?: string, opts: SayOptions = {}): Promise<void> {
    return dialogue.say(text, { ...opts, who: who ?? opts.who });
  }

  ask(text: string, choices: string[], who?: string, opts: SayOptions & { cancelIndex?: number } = {}): Promise<number> {
    return dialogue.ask(text, choices, { ...opts, who: who ?? opts.who });
  }

  /** Narration in the center of a black screen. */
  narrate(text: string | string[], opts: SayOptions = {}): Promise<void> {
    return dialogue.say(text, { style: 'none', pos: 'center', center: true, who: 'narrator', ...opts });
  }

  // ---------------------------------------------------------------------------
  // Time & screen
  // ---------------------------------------------------------------------------

  wait(frames: number): Promise<void> {
    return game.wait(frames);
  }

  fadeOut(frames = 30, color = '#000000'): Promise<void> {
    return fx.fadeOut(frames, color);
  }

  fadeIn(frames = 30): Promise<void> {
    return fx.fadeIn(frames);
  }

  flash(color = '#ffffff', frames = 12): void {
    fx.flash(color, frames);
  }

  shake(mag = 3, frames = 20): void {
    fx.shake(mag, frames);
  }

  glitch(frames = 20): void {
    fx.pulseGlitch(frames);
    audio.sfx('glitch');
  }

  bars(on: boolean): void {
    fx.setBars(on);
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  music(id: string | null, fade = 0.8): void {
    audio.playMusic(id, { fadeIn: fade, fadeOut: fade });
  }

  sfx(name: Sfx, opts?: { pitch?: number; vol?: number }): void {
    audio.sfx(name, opts);
  }

  ambience(kind: Ambience): void {
    audio.setAmbience(kind);
  }

  // ---------------------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------------------

  get player(): Entity {
    return world.player;
  }

  get(id: string): Entity {
    const e = id === 'player' ? world.player : world.get(id);
    if (!e) throw new Error(`Entity not found: ${id}`);
    return e;
  }

  find(id: string): Entity | undefined {
    return id === 'player' ? world.player : world.get(id);
  }

  /** Walks by a relative number of tiles. */
  walk(id: string, dx: number, dy: number, speed = 1): Promise<void> {
    const e = this.get(id);
    return e.moveTo(e.x + dx * TILE, e.y + dy * TILE, speed);
  }

  /** Walks to an absolute tile. */
  walkTo(id: string, tx: number, ty: number, speed = 1): Promise<void> {
    const e = this.get(id);
    return e.moveTo(tx * TILE + 8, ty * TILE + 14, speed);
  }

  face(id: string, dir: Dir): void {
    const e = this.find(id);
    if (e) e.dir = dir;
  }

  async emote(id: string, ch: '!' | '?' | '…' | '♥', wait = 40): Promise<void> {
    const e = this.find(id);
    if (!e) return;
    e.emote = { ch, t: 0 };
    if (ch === '!') audio.sfx('pop', { pitch: 1.4 });
    await game.wait(wait);
  }

  spawn(def: NpcDef): Entity {
    world.removeEntity(def.id);
    const e = new Entity(def.id, 'npc', def.x * TILE + 8, def.y * TILE + 14);
    e.char = def.char;
    e.sprite = def.sprite;
    e.frames = def.frames;
    if (def.frameSpeed) e.frameSpeed = def.frameSpeed;
    e.dir = def.dir ?? 'down';
    e.text = def.text;
    e.who = def.who;
    e.interact = def.script;
    e.float = !!def.float;
    e.solid = def.solid ?? true;
    e.shadow = def.shadow ?? true;
    e.light = def.light;
    e.variant = world.variant;
    return world.addEntity(e);
  }

  remove(id: string): void {
    world.removeEntity(id);
  }

  show(id: string, visible = true): void {
    const e = this.find(id);
    if (e) e.visible = visible;
  }

  /** Sets the party follower (Mina) on/off. */
  follower(char: string | null): void {
    G.state.party = char ? [char] : [];
    world.setFollower(char);
  }

  cameraTo(tx: number, ty: number): Promise<void> {
    world.camTarget = { x: tx * TILE + 8, y: ty * TILE + 8 };
    return game.wait(40);
  }

  cameraFollow(): void {
    world.camTarget = null;
  }

  // ---------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------

  async warp(map: string, spawn: string, opts: { sfx?: 'door' | 'whoosh' | 'none'; fade?: number; keepMusic?: boolean; color?: string } = {}): Promise<void> {
    const f = opts.fade ?? 18;
    if (opts.sfx && opts.sfx !== 'none') audio.sfx(opts.sfx);
    await fx.fadeOut(f, opts.color ?? '#000000');
    world.load(map, spawn, { keepMusic: opts.keepMusic });
    input.consume();
    await game.wait(4);
    await fx.fadeIn(f);
  }

  /** Loads a map without any fade (used while the screen is already black). */
  load(map: string, spawn: string, keepMusic = false): void {
    world.load(map, spawn, { keepMusic });
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  flag(name: string): number | boolean | string | undefined {
    return G.state.flags[name];
  }

  set(name: string, value: number | boolean | string = true): void {
    setFlag(name, value);
  }

  has(item: string): boolean {
    return G.state.items.includes(item) || G.state.keyItems.includes(item);
  }

  async give(item: string, silent = false): Promise<boolean> {
    const def = ITEMS[item];
    if (!def) return false;
    if (def.key) {
      if (!G.state.keyItems.includes(item)) G.state.keyItems.push(item);
    } else {
      if (G.state.items.length >= MAX_ITEMS) {
        if (!silent) await this.say(`Tes poches sont pleines. Tu laisses : ${def.name}.`);
        return false;
      }
      G.state.items.push(item);
    }
    if (!silent) {
      audio.sfx('item');
      await this.say(`Tu obtiens : {c:y}${def.name}{/c}.`);
    }
    return true;
  }

  take(item: string): void {
    const s = G.state;
    const i = s.items.indexOf(item);
    if (i >= 0) s.items.splice(i, 1);
    s.keyItems = s.keyItems.filter((k) => k !== item);
  }

  heal(): void {
    G.state.hp = maxHp(G.state);
    audio.sfx('heal');
  }

  souvenir(id: string): void {
    if (!G.state.souvenirs.includes(id)) G.state.souvenirs.push(id);
  }

  save(): void {
    G.state.x = Math.floor(world.player.x / TILE);
    G.state.y = Math.floor((world.player.y - 2) / TILE);
    G.state.dir = world.player.dir;
    G.state.map = world.map.id;
    writeSave(G.state);
    G.meta.lastPlay = Date.now();
    writeMeta(G.meta);
  }

  /** Save point (nightlight): heals and offers to save. */
  async savePoint(text = 'La petite lumière te remplit de courage.'): Promise<void> {
    this.heal();
    await this.say(text);
    const r = await this.ask('Sauvegarder ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
    if (r === 0) {
      this.save();
      audio.sfx('save');
      await this.say('{c:y}Ta progression est gardée au chaud.{/c}');
    }
  }

  // ---------------------------------------------------------------------------
  // Battles
  // ---------------------------------------------------------------------------

  /** Starts a battle with a transition. */
  async battle(ids: string[], opts: BattleOptions = {}): Promise<BattleResult> {
    const defs = ids.map((id) => {
      const d = ENEMIES[id];
      if (!d) throw new Error(`Unknown enemy ${id}`);
      return d;
    });
    const prevMusic = audio.currentMusic;
    // Snapshot for "retry".
    const snapshot = JSON.stringify(G.state);
    audio.stopMusic(0.1);
    audio.sfx('encounter');
    fx.flash('#ffffff', 6, 0.8);
    await game.wait(8);
    fx.flash('#ffffff', 6, 0.8);
    await game.wait(8);
    await fx.fadeOut(10);
    const b = new Battle(defs, opts);
    game.push(b);
    await fx.fadeIn(12);
    const result = await b.run();
    if (result.outcome === 'lose') {
      await game.wait(20);
      game.pop();
      const choice = await GameOverScene.show(snapshot);
      if (choice === 'retry') {
        G.state = JSON.parse(snapshot);
        return this.battle(ids, opts);
      }
      // 'load' and 'title' are handled by the game over scene (it replaces the scene stack): stop the caller.
      throw new ScriptAbort();
    }
    await fx.fadeOut(14);
    game.pop();
    world.grace = 90;
    if (opts.music !== undefined || prevMusic) audio.playMusic(world.map.music ?? prevMusic, { fadeIn: 1 });
    await fx.fadeIn(14);
    return result;
  }

  /** Battle triggered by touching an overworld enemy. */
  async encounter(e: Entity): Promise<void> {
    const ids = (e.data.enemies as string[]) ?? [];
    world.player.moving = false;
    e.emote = { ch: '!', t: 0 };
    await game.wait(18);
    const result = await this.battle(ids);
    if (result.outcome === 'flee') {
      world.grace = 150;
      // Step the enemy away a bit.
      e.x = e.home.x;
      e.y = e.home.y;
      return;
    }
    if (result.outcome === 'lose') return;
    if (!G.state.cleared.includes(e.id)) G.state.cleared.push(e.id);
    world.removeEntity(e);
    // Spared enemies leave a friendly sparkle.
    if (result.spared.length) world.particles.burst(e.x, e.y - 8, '#ffe991', 14, 1.2);
    else world.particles.burst(e.x, e.y - 6, '#0b0710', 14, 1);
  }

  // ---------------------------------------------------------------------------
  // Presentation
  // ---------------------------------------------------------------------------

  chapter(num: string, title: string, subtitle = ''): Promise<void> {
    return ChapterCard.show(num, title, subtitle);
  }

  /** Shows a full-screen illustration (souvenirs, drawings) with optional captions. */
  image(key: string, captions: string[] = [], opts: { style?: SayOptions['style'] } = {}): Promise<void> {
    return ImageScene.show(key, captions, opts);
  }

  menu(): void {
    openMenu();
  }

  /** Shows handwritten lines on a notebook page. */
  paper(lines: string[], title = ''): Promise<void> {
    return PaperScene.show(lines, title);
  }

  /** Fake crash / error screen. */
  crash(lines: string[], minFrames = 180, style: 'black' | 'blue' = 'black'): Promise<void> {
    return CrashScene.show(lines, minFrames, style);
  }

  /** DDLC-style poem: the player picks words. */
  poem(title: string): Promise<WordDef[]> {
    return PoemScene.write(title);
  }

  /** Runs another script inline. */
  async run(script: Script): Promise<void> {
    await script(this);
  }
}

export const director = new Director();

/** Runs a script as a cutscene: locks player control until it finishes. */
export async function runScript(script: Script): Promise<void> {
  world.busy++;
  try {
    await script(director);
  } catch (err) {
    if (!(err instanceof ScriptAbort)) console.error('Script error', err);
  } finally {
    world.busy = Math.max(0, world.busy - 1);
    world.player.moving = false;
    input.consume();
  }
}

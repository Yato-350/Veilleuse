import { audio } from '../../engine/audio';
import { fx } from '../../engine/fx';
import { game } from '../../engine/game';
import type { Director } from '../director';
import { flow } from '../flow';
import type { PropDef, Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G, deleteSave, maxHp, writeMeta } from '../state';
import { CreditsScene } from '../scenes/credits';
import { ShopScene } from '../scenes/shop';
import { setPageTitle } from '../meta';

/**
 * Story wiring shared by every chapter module.
 *
 * The real world thread (prologue, interludes, finale) and the three dream chapters are written in separate modules
 * and connected only through this file:
 *
 *   prologue ─ enterDream(1) ─▶ chapter 1 ─ wakeUp(1) ─▶ interlude 1 ─ enterDream(2) ─▶ chapter 2 ─ wakeUp(2) ─▶
 *   interlude 2 ─ enterDream(3) ─▶ chapter 3 ─┬─ wakeUp(3) ─▶ finale ─ finishGame('aube')
 *                                              ├─ finishGame('beaux_reves')
 *                                              └─ finishGame('silence')
 */
export const STORY: {
  /** Dream chapter entry scripts: load the first map and play the opening. */
  dream: Partial<Record<1 | 2 | 3, Script>>;
  /** Real-world scripts played after waking up from chapter N (3 = finale). */
  wake: Partial<Record<1 | 2 | 3, Script>>;
} = { dream: {}, wake: {} };

export type EndingId = 'aube' | 'beaux_reves' | 'silence';

/** Falls asleep in the real world and enters dream chapter `n`. */
export async function enterDream(d: Director, n: 1 | 2 | 3): Promise<void> {
  audio.stopMusic(2);
  audio.setAmbience('none');
  await d.fadeOut(90, '#000000');
  G.state.chapter = n;
  G.state.hp = maxHp(G.state);
  G.state.flags.interlude = 0;
  d.sfx('whoosh', { pitch: 0.6 });
  await d.wait(40);
  const script = STORY.dream[n];
  if (!script) {
    console.error(`No dream script for chapter ${n}`);
    return;
  }
  await script(d);
  // Autosave at the start of each chapter.
  d.save();
}

/** Wakes up in the real world after dream chapter `n`. */
export async function wakeUp(d: Director, n: 1 | 2 | 3): Promise<void> {
  audio.stopMusic(1.5);
  fx.glitch = 0;
  await d.fadeOut(60, '#ffffff');
  await d.wait(30);
  await d.fadeOut(1, '#000000');
  G.state.flags.interlude = n;
  G.state.party = [];
  const script = STORY.wake[n];
  if (!script) {
    console.error(`No wake script after chapter ${n}`);
    return;
  }
  await script(d);
  d.save();
}

/** Records an ending, plays the credits and returns to the title screen. The run is over: the save is deleted. */
export async function finishGame(d: Director, ending: EndingId): Promise<void> {
  if (!G.meta.endings.includes(ending)) G.meta.endings.push(ending);
  G.meta.runInProgress = false;
  writeMeta(G.meta);
  deleteSave();
  setPageTitle(null);
  fx.glitch = 0;
  fx.setBars(false);
  await d.fadeOut(90);
  game.remove(world);
  await CreditsScene.play();
  await flow.toTitle();
}

/** Opens a shop. */
export function shop(stock: string[], greeting?: string, keeper?: string): Promise<void> {
  return ShopScene.open(stock, greeting, keeper);
}

/** A dream save point (a little nightlight on a pedestal). */
export function savePoint(x: number, y: number, text?: string): PropDef {
  return {
    sprite: 'prop_savepoint',
    frames: ['prop_savepoint', 'prop_savepoint_2'],
    frameSpeed: 18,
    x,
    y,
    light: { r: 44, color: '#ffe991', flicker: true },
    script: (d) => d.savePoint(text),
  };
}

/** True once the player has defeated (rather than spared) every enemy met so far — used for the Silence ending. */
export function isSilenceRoute(): boolean {
  const kills = Object.values(G.state.kills).reduce((a, b) => a + b, 0);
  const spares = Object.values(G.state.spares).reduce((a, b) => a + b, 0);
  return spares === 0 && kills >= 8;
}

/** Shorthand for a flag check in map conditions. */
export const f = (name: string) => () => !!G.state.flags[name];
export const nf = (name: string) => () => !G.state.flags[name];

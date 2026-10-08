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
 * The real world thread (prologue, interludes, finale) and the six dream chapters are written in separate modules
 * and connected only through this file. Version 2 (« Il fait toujours nuit », docs/HISTOIRE.md §3.1):
 *
 *   prologue ─ enterDream(1) ─▶ ch. 1 ─ wakeUp(1) ─▶ I ─ enterDream(2) ─▶ ch. 2 ─ wakeUp(2) ─▶ II ─ enterDream(3) ─▶
 *   ch. 3 ─ wakeUp(3) ─▶ (fausse aube) III ─ enterDream(4) ─▶ ch. 4 ─ wakeUp(4) ─▶ IV ─ enterDream(5) ─▶ ch. 5 ─
 *   fallInto(6) ─▶ ch. 6 ─┬─ wakeUp(6) ─▶ finale ─ finishGame('aube' | 'aube_blanche' | 'veilleuse')
 *                          ├─ finishGame('beaux_reves')
 *                          └─ finishGame('silence')
 *
 * Until the new acts are wired (production lot 5), STORY.wake[3] is still the v1.1 finale.
 */

/** Dream chapter numbers. */
export type DreamNo = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Moments of the real-world thread, stored in `G.state.flags.interlude` (the same rooms are revisited):
 * 0 prologue, 1–4 the interludes after chapters 1–4, 9 the finale (« Le carnet »). Dream chapters reset it to 0.
 */
export const REAL = { prologue: 0, i1: 1, i2: 2, i3: 3, i4: 4, finale: 9 } as const;

/** Current real-world moment (see REAL). */
export const realPhase = (): number => Number(G.state.flags.interlude ?? 0);

/** True during the finale (and the epilogue that follows it). */
export const isFinale = (): boolean => realPhase() === REAL.finale;

/** The real-world moment reached by waking up from dream chapter `n` (chapter 5 never wakes up: Noa falls). */
export function wakePhase(n: DreamNo): number {
  return n === 6 ? REAL.finale : n;
}

export const STORY: {
  /** Dream chapter entry scripts: load the first map and play the opening. */
  dream: Partial<Record<DreamNo, Script>>;
  /** Real-world scripts played after waking up from chapter N (3 = interlude III, 6 = finale). */
  wake: Partial<Record<DreamNo, Script>>;
} = { dream: {}, wake: {} };

export type EndingId = 'aube' | 'aube_blanche' | 'beaux_reves' | 'silence' | 'veilleuse';

/** Falls asleep in the real world and enters dream chapter `n`. */
export async function enterDream(d: Director, n: DreamNo): Promise<void> {
  audio.stopMusic(2);
  audio.setAmbience('none');
  await d.fadeOut(90, '#000000');
  d.sfx('whoosh', { pitch: 0.6 });
  await d.wait(40);
  await startDream(d, n);
}

/**
 * Chapter 5 → 6: Noa does not wake up between the two, he falls (docs/HISTOIRE.md §3.1). No white flash and no real
 * world: the music sinks, the screen goes dark from the top, a long low whoosh, and the next dream starts.
 */
export async function fallInto(d: Director, n: DreamNo): Promise<void> {
  audio.tempoScale = 1;
  audio.stopMusic(3);
  audio.setAmbience('none');
  fx.glitch = 0;
  d.sfx('whoosh', { pitch: 0.35, vol: 0.9 });
  d.shake(2, 50);
  await d.fadeOut(110, '#000000');
  d.sfx('whoosh', { pitch: 0.25, vol: 0.6 });
  await d.wait(70);
  d.sfx('heartbeat', { pitch: 0.8, vol: 0.5 });
  await d.wait(50);
  await startDream(d, n);
}

async function startDream(d: Director, n: DreamNo): Promise<void> {
  G.state.chapter = n;
  G.state.hp = maxHp(G.state);
  G.state.flags.interlude = 0;
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
export async function wakeUp(d: Director, n: DreamNo): Promise<void> {
  audio.stopMusic(1.5);
  audio.tempoScale = 1;
  fx.glitch = 0;
  await d.fadeOut(60, '#ffffff');
  await d.wait(30);
  await d.fadeOut(1, '#000000');
  G.state.flags.interlude = wakePhase(n);
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
export function shop(stock: string[], greeting?: string, keeper?: string, discount = 0): Promise<void> {
  return ShopScene.open(stock, greeting, keeper, discount);
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

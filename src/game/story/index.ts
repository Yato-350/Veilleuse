import type { Script } from '../overworld/types';
import { STORY } from './common';
import { world } from '../overworld/world';
import { G } from '../state';
import * as real from './real';
import * as chapter1 from './chapter1';
import * as chapter2 from './chapter2';
import * as chapter3 from './chapter3';
import * as bonus from './bonus';
import * as battleDebug from '../battle/debug-battles';

/** Talking to Mina while she follows Noa: a line depending on where you are. */
const MINA_LINES: Record<string, string[]> = { ...chapter1.MINA_LINES, ...chapter2.MINA_LINES, ...chapter3.MINA_LINES, ...bonus.MINA_LINES };
world.followerTalk = async (d) => {
  const lines = MINA_LINES[G.state.map] ?? ['Quoi ? J\'ai quelque chose sur la figure ?'];
  const n = Number(G.state.flags[`mina_talk_${G.state.map}`] ?? 0);
  G.state.flags[`mina_talk_${G.state.map}`] = n + 1;
  const line = lines[n % lines.length]!;
  const [text, expr] = line.split('|') as [string, string | undefined];
  await d.say(text, `mina:${expr ?? 'happy'}`);
};

STORY.dream[1] = chapter1.start;
STORY.dream[2] = chapter2.start;
STORY.dream[3] = chapter3.start;
STORY.wake[1] = real.interlude1;
STORY.wake[2] = real.interlude2;
STORY.wake[3] = real.finale;

/** Entry point of a new game. */
export const startPrologue: Script = real.prologue;

/** Named scripts runnable with ?debug=script&name=… */
export const DEBUG_SCRIPTS: Record<string, Script> = {
  prologue: real.prologue,
  interlude1: real.interlude1,
  interlude2: real.interlude2,
  finale: real.finale,
  chapter1: chapter1.start,
  chapter2: chapter2.start,
  chapter3: chapter3.start,
  bonus: bonus.start,
  ...real.DEBUG,
  ...chapter1.DEBUG,
  ...chapter2.DEBUG,
  ...chapter3.DEBUG,
  ...bonus.DEBUG,
  ...battleDebug.DEBUG,
};

/** Entry point of the bonus chapter (title screen, after the dawn ending). */
export const startBonus: Script = bonus.start;

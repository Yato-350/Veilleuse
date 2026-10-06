import type { Script } from '../overworld/types';
import { STORY } from './common';
import * as real from './real';
import * as chapter1 from './chapter1';
import * as chapter2 from './chapter2';
import * as chapter3 from './chapter3';

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
  ...real.DEBUG,
  ...chapter1.DEBUG,
  ...chapter2.DEBUG,
  ...chapter3.DEBUG,
};

import type { Director } from '../director';
import type { Script } from '../overworld/types';

/** Dream chapter 1 — entry script (called by enterDream). TODO: content. */
export async function start(d: Director): Promise<void> {
  d.load('test', 'default');
  await d.fadeIn(30);
  await d.say('(Chapitre 1 — à venir.)');
}

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {};

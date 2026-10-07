import type { Director } from '../director';
import type { Script } from '../overworld/types';

/** Dream chapter 3 — entry script (called by enterDream). TODO: content. */
export async function start(d: Director): Promise<void> {
  d.load('test', 'default');
  await d.fadeIn(30);
  await d.say('(Chapitre 3 — à venir.)');
}

/** Mina's lines when you talk to her, by map id ("texte|expression"). */
export const MINA_LINES: Record<string, string[]> = {};

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {};

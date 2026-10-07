import type { Director } from '../director';
import type { Script } from '../overworld/types';

/**
 * Bonus chapter « Les rêves des autres » — Maman's dream. Unlocked on the title screen after the « aube » ending.
 * Placeholder: the chapter is being written.
 */
export async function start(d: Director): Promise<void> {
  await d.narrate(['Les rêves des autres.', '(À venir.)']);
}

/** Mina's lines by map id (none: Mina is not in this chapter). */
export const MINA_LINES: Record<string, string[]> = {};

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {};

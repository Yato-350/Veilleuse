import type { Director } from '../director';
import type { Script } from '../overworld/types';

/** Real world thread: prologue, interludes and finale. TODO: content. */
export async function prologue(d: Director): Promise<void> {
  d.load('test', 'default');
  await d.fadeIn(30);
  await d.say('(Prologue — à venir.)');
}

export async function interlude1(d: Director): Promise<void> {
  d.load('test', 'default');
  await d.fadeIn(30);
}

export async function interlude2(d: Director): Promise<void> {
  d.load('test', 'default');
  await d.fadeIn(30);
}

export async function finale(d: Director): Promise<void> {
  d.load('test', 'default');
  await d.fadeIn(30);
}

export const DEBUG: Record<string, Script> = {};

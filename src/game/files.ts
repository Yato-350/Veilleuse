import { G, writeMeta } from './state';

/*
 * The characters' files (after a first ending, « Fichiers » on the title screen): dodo.chr, mina.chr and maman.chr
 * can be deleted, and the whole game changes. Nothing is removed from the story itself (every scene still plays, so
 * nothing can get stuck): a deleted character's lines turn to static, under a « ??? » with no portrait, and their
 * sprite is drawn as a glitch, in the world and in battle. The choice lives in the memory (G.meta.deleted): it holds
 * for every run until the file is restored from the bin. noa.chr is in use and cannot be deleted.
 */

export type CharFile = 'dodo' | 'mina' | 'maman';
export const CHAR_FILES: readonly CharFile[] = ['dodo', 'mina', 'maman'];

/** Speakers (src/data/speakers.ts) that belong to each file: the little girl in the hat is Mina's real voice. */
const SPEAKER_FILE: Record<string, CharFile> = {
  dodo: 'dodo',
  dododark: 'dodo',
  dodoreel: 'dodo',
  dodotorn: 'dodo',
  mina: 'mina',
  minavoix: 'mina',
  mina366: 'mina',
  bonnet: 'mina',
  petite: 'mina',
  maman: 'maman',
  mamantel: 'maman',
  mamanvoix: 'maman',
  poupeemaman: 'maman',
};

/** World and battle sprites (sprite keys, walking characters, enemy ids) of each file. */
const SPRITE_FILE: Array<[RegExp, CharFile]> = [
  [/^(npc_|b_|prop_)?dodo/, 'dodo'],
  [/^(npc_|b_|pose_)?(mina|bonnet)/, 'mina'],
  [/^(npc_|b_|pose_)?maman/, 'maman'],
];

const deleted = (): string[] => G.meta?.deleted ?? [];

export function isDeleted(f: CharFile): boolean {
  return deleted().includes(f);
}

/** Whether a dialogue speaker (« dodo », « mina366 »…) belongs to a deleted file. */
export function deletedSpeaker(who: string): boolean {
  const f = SPEAKER_FILE[who];
  return !!f && isDeleted(f);
}

/** Whether a sprite key, a walking character or an enemy id belongs to a deleted file. */
export function deletedSprite(...keys: Array<string | undefined>): boolean {
  if (!deleted().length) return false;
  return keys.some((k) => !!k && SPRITE_FILE.some(([re, f]) => re.test(k) && isDeleted(f)));
}

/** A deleted character's line: as long as before, every letter gone to static. */
export function scrambled(text: string): string {
  let i = 0;
  const plain = text.replace(/\{[^}]*\}/g, '');
  const noise = [...plain].map((ch) => (/[\p{L}\p{N}]/u.test(ch) ? ['▓', '█', '░'][i++ % 3]! : ch)).join('');
  return `{static}${noise}{/static}`;
}

/** The speaker shown instead of a deleted character. */
export const GONE_SPEAKER = { name: '???', voice: 'default', color: '#8a8fb0' };

export function deleteFile(f: CharFile): void {
  if (isDeleted(f)) return;
  G.meta.deleted = [...deleted(), f];
  writeMeta(G.meta);
}

export function restoreFile(f: CharFile): void {
  G.meta.deleted = deleted().filter((x) => x !== f);
  writeMeta(G.meta);
}

/** The files are offered once the game has been finished (any ending). */
export function filesUnlocked(): boolean {
  return (G.meta?.endings ?? []).length > 0;
}

import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { WORD_POOLS } from '../../data/words';
import { G } from '../state';
import { setDefeatStreak } from './battle';

/** A notebook with the chapter's bittersweet words first (the longest last), then one word of each other emotion. */
const douxWords = (chapter: number, n: number) => () => {
  const pool = WORD_POOLS[chapter]!;
  const doux = pool.filter((w) => w.emotion2).sort((a, b) => a.text.length - b.text.length).slice(-n);
  const other = (['joie', 'tristesse', 'colere', 'neutre'] as const).map((e) => pool.find((w) => w.emotion === e && !w.emotion2)!);
  return [...doux, ...other].slice(0, 6);
};

/**
 * Battle-system showcase scripts (version 1.1), runnable with ?debug=script&name=… :
 *   bt_ally       chapter 1, Mina at Noa's side (she acts every 3rd turn)
 *   bt_ally2      chapter 2 (forest), Mina at Noa's side, two enemies
 *   bt_absent     chapter 3 after Mina was erased: her empty slot and the line about her absence
 *   bt_shapes     « Formes des émotions » on (shapes on the soul, the bullets, the HUD and the notebook, with the two
 *                 longest bittersweet words of chapter 2)
 *   bt_doux       chapter 3 before the erasure: a notebook of bittersweet words (« souvenir », « dessin »…)
 *   bt_defeats    2 defeats already counted and 1 HP: lose once more and Mina offers to help
 *   bt_real       a battle in the real world: no ally, even with Mina in the party
 */
function setup(d: Director, chapter: number, map: string, spawn: string, mina: boolean, flags: string[] = []): void {
  G.state.chapter = chapter;
  for (const f of flags) d.set(f);
  d.follower(mina ? 'mina' : null);
  d.load(map, spawn);
}

export const DEBUG: Record<string, Script> = {
  bt_ally: async (d) => {
    setup(d, 1, 'prairie', 'mina', true, ['c1_tutorial', 'c1_mina']);
    await d.fadeIn(10);
    await d.battle(['nuage']);
  },
  bt_ally2: async (d) => {
    setup(d, 2, 'foret', 'west', true);
    await d.fadeIn(10);
    await d.battle(['luciole', 'taille_crayon']);
  },
  bt_absent: async (d) => {
    setup(d, 3, 'hopital', 'default', false, ['c3_intro', 'c3_mina_erased']);
    await d.fadeIn(10);
    await d.battle(['perfusion']);
  },
  bt_shapes: async (d) => {
    G.settings.emotionShapes = true;
    setup(d, 2, 'foret', 'west', true);
    await d.fadeIn(10);
    await d.battle(['luciole', 'taille_crayon'], { hooks: { words: douxWords(2, 2) } });
  },
  bt_doux: async (d) => {
    setup(d, 3, 'hopital', 'default', true, ['c3_intro']);
    await d.fadeIn(10);
    await d.battle(['perfusion'], { hooks: { words: douxWords(3, 3) } });
  },
  bt_defeats: async (d) => {
    setup(d, 1, 'prairie', 'mina', true, ['c1_tutorial', 'c1_mina']);
    G.settings.storyMode = false;
    G.state.hp = 1;
    setDefeatStreak(['nuage'], 2, true);
    await d.fadeIn(10);
    await d.battle(['nuage']);
  },
  bt_real: async (d) => {
    setup(d, 1, 'prairie', 'mina', true, ['c1_tutorial', 'c1_mina']);
    await d.fadeIn(10);
    await d.battle(['nuage'], { bg: 'real' });
  },
};

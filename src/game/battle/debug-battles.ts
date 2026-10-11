import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { WORD_POOLS } from '../../data/words';
import { G, maxHp } from '../state';
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
 *
 * Chapter 4 « La Maison Cousue » (chapter 3 stats: 14 Étoiles, the Plume dorée, the plaid; Mina n°366 at Noa's side;
 * the outcome is kept in flags.debug_battle, e.g. « spare:couseuse »):
 *   couseuse, petit_homme, poupee_maman   the mini-boss, the boss, the dinner (« merci » or « reste »)
 *   bt_pate_froide, bt_mot_aimante, bt_de_chevalier, bt_poupee_brouillon, bt_cle   the regular enemies
 *   bt_ch4_duo        Pâte Froide and Mot Aimanté together
 *   bt_mina366_still  after La Couseuse was beaten: Mina n°366 sits in her slot and does not move any more
 *   bt_ch4_seul       a chapter 4 battle without her
 *
 * Chapter 5 « La Marée Blanche » (chapter 4 stats: 20 Étoiles, the Plume dorée, the plaid; nobody at Noa's side, only
 * Mina's empty frame and the red thread; the outcome is kept in flags.debug_battle):
 *   vitre             the boss (Tristesse ×2, then « je ne sais pas »); flags.c5_vitre = 'epargnee' | 'brisee'
 *   vitre_menti       the same after « Oui » at the portal (flags.c5_menti): « pardon » first
 *   bt_crabe_bracelet, bt_mouette, bt_masque, bt_gel, bt_thermometre   the regular enemies
 *   bt_gribouille_noire   fear drawn in ink: words slide off, blows split it, only fleeing works (not Ink)
 *   bt_ch5_duo        Crabe-Bracelet and Mouette together, on the beach
 */
function setup(d: Director, chapter: number, map: string, spawn: string, mina: boolean, flags: string[] = []): void {
  G.state.chapter = chapter;
  for (const f of flags) d.set(f);
  d.follower(mina ? 'mina' : null);
  d.load(map, spawn);
}

/** Chapter 4 battle: chapter 3 stats, Mina n°366 in the party (no follower on the map: lot 1b draws her). */
async function ch4(d: Director, ids: string[], opts: { mina?: boolean; flags?: string[]; vaincue?: boolean } = {}): Promise<void> {
  setup(d, 1, 'prairie', 'mina', false, ['c1_tutorial', 'c1_mina', ...(opts.flags ?? [])]);
  const s = G.state;
  s.chapter = 4;
  s.etoiles = 14;
  s.encre = 3;
  s.weapon = 'plume';
  s.armor = 'plaid';
  s.items = ['chocolat', 'lait', 'biscuit', 'mouchoir', 'pluie'];
  s.hp = maxHp(s);
  s.party = opts.mina === false ? [] : ['mina366'];
  if (opts.vaincue) s.flags.c4_couseuse = 'vaincue';
  await d.fadeIn(10);
  const r = await d.battle(ids);
  s.flags.debug_battle = `${r.outcome}:${[...r.spared, ...r.killed].join('+')}`;
}

/** Chapter 5 battle: chapter 4 stats, nobody in the party (Mina's frame stays empty). */
async function ch5(d: Director, ids: string[], flags: string[] = []): Promise<void> {
  setup(d, 1, 'prairie', 'mina', false, ['c1_tutorial', 'c1_mina', ...flags]);
  const s = G.state;
  s.chapter = 5;
  s.etoiles = 20;
  s.encre = 3;
  s.weapon = 'plume';
  s.armor = 'plaid';
  s.items = ['chocolat', 'lait', 'biscuit', 'mouchoir', 'pluie'];
  s.hp = maxHp(s);
  s.party = [];
  await d.fadeIn(10);
  const r = await d.battle(ids);
  s.flags.debug_battle = `${r.outcome}:${[...r.spared, ...r.killed].join('+')}`;
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
  // Chapter 4
  couseuse: (d) => ch4(d, ['couseuse']),
  petit_homme: (d) => ch4(d, ['petit_homme']),
  poupee_maman: (d) => ch4(d, ['poupee_maman']),
  bt_pate_froide: (d) => ch4(d, ['pate_froide']),
  bt_mot_aimante: (d) => ch4(d, ['mot_aimante']),
  bt_de_chevalier: (d) => ch4(d, ['de_chevalier']),
  bt_poupee_brouillon: (d) => ch4(d, ['poupee_brouillon']),
  bt_cle: (d) => ch4(d, ['cle']),
  bt_ch4_duo: (d) => ch4(d, ['pate_froide', 'mot_aimante']),
  bt_mina366_still: (d) => ch4(d, ['de_chevalier'], { vaincue: true }),
  bt_ch4_seul: (d) => ch4(d, ['poupee_brouillon'], { mina: false }),
  // Chapter 5
  vitre: (d) => ch5(d, ['vitre']),
  vitre_menti: (d) => ch5(d, ['vitre'], ['c5_menti']),
  bt_crabe_bracelet: (d) => ch5(d, ['crabe_bracelet']),
  bt_mouette: (d) => ch5(d, ['mouette']),
  bt_masque: (d) => ch5(d, ['masque']),
  bt_gel: (d) => ch5(d, ['gel']),
  bt_thermometre: (d) => ch5(d, ['thermometre']),
  bt_gribouille_noire: (d) => ch5(d, ['gribouille_noire']),
  bt_ch5_duo: (d) => ch5(d, ['crabe_bracelet', 'mouette']),
};

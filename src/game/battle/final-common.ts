import { measure } from '../../engine/font';
import { rng } from '../../engine/math';
import type { Emotion } from '../../engine/palette';
import { drawSprite } from '../../engine/sprite';
import { tf, tr } from '../../i18n';
import { hasSpr, spr } from '../assets';
import type { WordDef } from './types';

/*
 * What the two final battles against Dodo share (moved out of src/game/story/chapter3.ts, unchanged): the words drowned
 * in the player's own ink and their blots, Dodo's cutting lines when one is written anyway, the spared friends who come
 * to help (who they are, in which order, how they are drawn around Dodo), the cracks of light. Used by the version 1.1
 * battle (chapter 3) and the version 2 battle (chapter 6, src/game/battle/final-v2.ts).
 */

export interface StageFriend {
  sprite: string;
  x: number;
  y: number;
  scale: number;
  born: number;
  gone: number | null;
}

/** Mina's words drowned in ink (silence route). */
export const INK_WORDS: WordDef[] = ['#%@&#', '&#%*', '@#&%#@#', '%#@& &#%', '#&@%#&', '*#%@#'].map((text) => ({ text, emotion: 'neutre' }));

/** The illegible blot that replaces a drowned word in the notebook (same length, so it takes the word's place). */
export const blot = (text: string): string => [...text].map((c, i) => (c === ' ' ? ' ' : i % 3 === 1 ? '█' : '▓')).join('');
/** The blot of a drowned word, as long as the word shown in the current language. */
export const inkOf = (t: string): WordDef => ({ text: blot(tr(t)), emotion: 'neutre' as Emotion });
export const isBlot = (text: string): boolean => text.length > 0 && /^[▓█ ]+$/.test(text);

/** Dodo, when a drowned word is written anyway. */
export const INK_CUTS = [
  'Tu ne peux pas lire ça, hein ? C\'est ton encre.',
  'Je t\'avais dit que ça partait au lavage. J\'ai menti.',
  'Elle voulait te le dire. Toi, tu frappais.',
  'Ceux que tu as effacés aussi avaient des choses à dire.',
];

/** …and where Mina's voice should have answered, nothing. */
export const INK_SILENCES = [
  '* Tu écris sur la tache. L\'encre boit les lettres.\n* Tu attends la voix de Mina. Elle ne vient pas.',
  '* La tache s\'étale encore un peu.\n* Là où elle aurait dû parler, il n\'y a que du silence.',
];

// --- Spared friends come to help (phase 3) -------------------------------------------------------------------------

export type FriendGift = 'crack' | 'recolor' | 'heal' | 'placard' | 'gomme';

export interface Friend {
  /** Species id (G.state.spares). */
  id: string;
  sprite: string;
  name: string;
  /** Rich-text color code of the name. */
  col: string;
  voice: string;
  line: string;
  gift: FriendGift;
  /** Narration of the gift. {n} = HP healed. */
  act: string;
  /** Spared bosses: a narration box before they speak. */
  intro?: string;
  boss?: boolean;
  scale?: number;
  /** Feet on the stage (lower = higher on screen; fliers float). */
  y?: number;
}

/** In order of appearance: the small ones first, then the spared bosses, who get the strongest moments. */
export const FRIENDS: Friend[] = [
  { id: 'gribouille', sprite: 'b_gribouille', name: 'Gribouille', col: 'v', voice: 'default', line: 'Scritch ! On gribouille ensemble ?', gift: 'crack', act: '* Il gribouille un trait de lumière sur Dodo.' },
  { id: 'pissenlit', sprite: 'b_pissenlit', name: 'Pissenlit', col: 'y', voice: 'default', line: 'Hi hi ! Fais un vœu ! Un gros !', gift: 'recolor', act: '* Ses graines se posent sur ton cœur.\n* La prochaine attaque aura ta couleur.' },
  { id: 'nuage', sprite: 'b_nuage', name: 'Nuage Triste', col: 'b', voice: 'default', line: 'J\'ai gardé un peu de pluie. De la tiède.', gift: 'heal', act: '* Une petite averse tiède. Tu récupères {n} PV.' },
  { id: 'chaussette_perdue', sprite: 'b_chaussette_perdue', name: 'Chaussette Perdue', col: 'p', voice: 'sock', line: 'J\'ai retrouvé ma paire. Ça arrive, tu vois ?', gift: 'heal', act: '* Elle réchauffe ton cœur. Tu récupères {n} PV.' },
  { id: 'mouton_noir', sprite: 'b_mouton_noir', name: 'Mouton Noir', col: 'v', voice: 'sheep', line: 'Hé, le gros. Moi aussi, j\'étais tout noir.', gift: 'crack', act: '* Il fonce tête baissée. BONK ! Dodo se fissure.' },
  { id: 'avion', sprite: 'b_avion', name: 'Avion en Papier', col: 'b', voice: 'default', line: 'Vrrrr ! Courrier ! De la part de tout le monde !', gift: 'recolor', act: '* Il fait des loopings autour de ton cœur.\n* La prochaine attaque aura ta couleur.' },
  { id: 'taille_crayon', sprite: 'b_taille_crayon', name: 'Taille-Crayon', col: 'r', voice: 'monster', line: 'Donne ton crayon. Crrr… Voilà. Bien pointu.', gift: 'crack', act: '* Ton crayon brille. Un trait de lumière fend Dodo.' },
  { id: 'bip', sprite: 'b_bip', name: 'Bip', col: 'o', voice: 'tv', line: 'Bip. Bip. Bip. Tu entends ? C\'est le tien.', gift: 'heal', act: '* Ton cœur bat plus fort. Tu récupères {n} PV.' },
  { id: 'perfusion', sprite: 'b_perfusion', name: 'Perfusion', col: 'p', voice: 'default', line: 'Goutte à goutte… Doucement. Ça va aller.', gift: 'heal', act: '* Une goutte de lumière. Tu récupères {n} PV.' },
  { id: 'luciole', sprite: 'b_luciole_2', name: 'Luciole', col: 'y', voice: 'default', line: 'Je brille encore. C\'est toi qui m\'as rallumée.', gift: 'crack', act: '* Elle se pose sur Dodo.\n* Là où elle brille, la laine se fend.', y: 64 },
  { id: 'placard', sprite: 'b_placard', name: 'Monstre du Placard', col: 'y', voice: 'monster', line: 'Le noir, je connais, petit. J\'y ai vécu toute ma vie.\nEt je te le dis : il ne faut pas y rester.', gift: 'placard', act: '* Il ouvre grand ses portes.\n* Toute sa lumière se déverse sur Dodo.\n* Tu récupères tous tes PV.', intro: '* Au bord du vide, une armoire s\'ouvre en grinçant.\n* Le Monstre du Placard !', boss: true },
  { id: 'gomme', sprite: 'b_gomme', name: 'Gomme', col: 'p', voice: 'eraser', line: 'Tu m\'as appris à garder. Même ce qui fait mal.\nAlors je garde. Et j\'efface juste ce qu\'il faut.', gift: 'gomme', act: '* Frrrt, frrrt. Elle efface la laine noire.\n* Dessous, il n\'y a que de la lumière.', intro: '* Une petite gomme rose roule jusqu\'à tes pieds.\n* Gomme !', boss: true },
];
export const FRIEND = (id: string): Friend | undefined => FRIENDS.find((f) => f.id === id);
/** Where friends stand around Dodo (bottom-center anchor). */
export const STAGE_X = [62, 258, 98, 222, 30, 290];

/** Spared friends, in order of appearance. With drowned words, Gomme comes first: she knows how to erase ink. */
export function friendQueue(spares: Record<string, number>, drowned: number): string[] {
  const ids = FRIENDS.filter((f) => (spares[f.id] ?? 0) > 0).map((f) => f.id);
  if (drowned > 0 && ids.includes('gomme')) return ['gomme', ...ids.filter((id) => id !== 'gomme')];
  return ids;
}

/**
 * The next visit: a spared boss alone, or a small group, sized so that every boss still gets its own turn before
 * Dodo turns back into a plush (`slots` = visits left until then, this one included).
 */
export function nextVisit(queue: string[], slots: number): string[] {
  if (!queue.length) return [];
  const bosses = queue.filter((id) => FRIEND(id)?.boss);
  const small = queue.filter((id) => !FRIEND(id)?.boss);
  if (FRIEND(queue[0]!)?.boss || !small.length || (bosses.length && slots <= bosses.length)) return [bosses[0] ?? queue[0]!];
  const size = Math.min(3, Math.ceil(small.length / Math.max(1, slots - bosses.length)));
  return small.slice(0, size);
}

/** « A, B et C ». */
export function listNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : tf('{0} et {1}.', names.slice(0, -1).join(', '), names[names.length - 1]!);
}

/** Word-wraps a list to the battle text box (first line prefixed with `head`, the next ones indented with `tail`). */
export function wrapList(text: string, head: string, tail: string, width = 274): string[] {
  const out: string[] = [];
  let line = head;
  for (const word of text.split(' ')) {
    const next = line === head || line === tail ? `${line}${word}` : `${line} ${word}`;
    if (measure(next) > width && line !== head && line !== tail) {
      out.push(line);
      line = `${tail}${word}`;
    } else line = next;
  }
  out.push(line);
  return out;
}

export function makeCrack(): Array<[number, number]> {
  let x = rng.range(-20, 20);
  let y = rng.range(-50, -18);
  const pts: Array<[number, number]> = [[x, y]];
  for (let i = 0; i < 6; i++) {
    x += rng.range(-6, 6);
    y += rng.range(-5, 6);
    pts.push([x, y]);
  }
  return pts;
}

/** A filled pixel disc (halos). */
export function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2, 1);
  }
}

/** An ink blot over a drowned word of the notebook (x, y: where the word is written; w: its width). */
export function drawBlot(g: CanvasRenderingContext2D, x: number, y: number, w: number, t: number, seed: number): void {
  g.fillStyle = '#0b0710';
  // A lumpy puddle: overlapping discs along the word.
  const n = Math.max(2, Math.round(w / 6));
  for (let i = 0; i <= n; i++) {
    const r = 4 + ((seed + i * 3) % 3 === 0 ? 2 : 1);
    disc(g, Math.round(x + (w * i) / n), y + 4 + (((seed + i) % 2) * 2 - 1), r);
  }
  g.fillRect(x - 2, y - 1, w + 4, 10);
  // Splashes
  g.fillRect(x - 8, y + 6, 2, 2);
  g.fillRect(x + w + 7, y, 2, 2);
  g.fillRect(x + w + 6, y + 9, 1, 1);
  // One slow drip
  const dx = x + Math.round(w * (0.35 + (seed % 3) * 0.15));
  const len = 2 + ((Math.floor(t / 10) + seed * 4) % 8);
  g.fillRect(dx, y + 9, 2, len);
  disc(g, dx + 1, y + 9 + len, 2);
  // A dull sheen
  g.fillStyle = '#3a2f52';
  g.fillRect(x + 1, y, Math.max(3, Math.round(w / 3)), 1);
  g.fillRect(x, y + 1, 1, 2);
}

/** Spared friends around Dodo: they fade in with a soft halo, bob, and fade out. */
export function drawStage(g: CanvasRenderingContext2D, s: { stage: StageFriend[]; t: number }): void {
  s.stage = s.stage.filter((f) => f.gone === null || s.t - f.gone < 30);
  for (const f of s.stage) {
    if (!hasSpr(f.sprite)) continue;
    const k = Math.min(1, (s.t - f.born) / 20);
    const a = k * (f.gone === null ? 1 : Math.max(0, 1 - (s.t - f.gone) / 30));
    if (a <= 0) continue;
    const bob = Math.round(Math.sin((s.t + f.x) * 0.06) * 1.5);
    const y = f.y + bob + Math.round((1 - k) * 6);
    const sp = spr(f.sprite);
    const cy = Math.round(y - (sp.ay * f.scale) / 2);
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ffd27a';
    for (const [r, al] of [[22, 0.05], [17, 0.06], [12, 0.08], [7, 0.1]] as const) {
      g.globalAlpha = al * a;
      disc(g, f.x, cy, r);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const key = hasSpr(`${f.sprite}_2`) && Math.floor((s.t + f.x) / 24) % 2 === 1 ? `${f.sprite}_2` : f.sprite;
    drawSprite(g, spr(key), f.x, y, { alpha: a, scaleX: f.scale, scaleY: f.scale });
  }
  g.globalAlpha = 1;
}

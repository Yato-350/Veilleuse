import { audio } from '../../engine/audio';
import { fx } from '../../engine/fx';
import { game } from '../../engine/game';
import type { Director } from '../director';
import { flow } from '../flow';
import type { PropDef, Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G, deleteSave, inkRoute, maxHp, writeMeta } from '../state';
import type { Entity } from '../overworld/entity';
import { CreditsScene } from '../scenes/credits';
import { ShopScene } from '../scenes/shop';
import type { PhoneScene } from '../scenes/phone';
import { setPageTitle } from '../meta';

/**
 * Story wiring shared by every chapter module.
 *
 * The real world thread (prologue, interludes, finale) and the six dream chapters are written in separate modules
 * and connected only through this file. Version 2 (« Il fait toujours nuit », docs/HISTOIRE.md §3.1):
 *
 *   prologue ─ enterDream(1) ─▶ ch. 1 ─ wakeUp(1) ─▶ I ─ enterDream(2) ─▶ ch. 2 ─ wakeUp(2) ─▶ II ─ enterDream(3) ─▶
 *   ch. 3 ─ wakeUp(3) ─▶ (fausse aube) III ─ enterDream(4) ─▶ ch. 4 ─ wakeUp(4) ─▶ IV ─ enterDream(5) ─▶ ch. 5 ─
 *   fallInto(6) ─▶ ch. 6 ─┬─ wakeUp(6) ─▶ finale ─ finishGame('aube' | 'aube_blanche' | 'veilleuse')
 *                          ├─ finishGame('beaux_reves')
 *                          └─ finishGame('silence')
 *
 * Wiring (story/index.ts): STORY.wake[3] is the false dawn (fausse-aube.ts), which ends by playing Interlude III
 * (real-nuit.ts); STORY.wake[4] is Interlude IV; STORY.wake[6] is the finale (real.ts).
 */

/** Dream chapter numbers. */
export type DreamNo = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Moments of the real-world thread, stored in `G.state.flags.interlude` (the same rooms are revisited):
 * 0 prologue, 1–4 the interludes after chapters 1–4, 9 the finale (« Le carnet »). Dream chapters reset it to 0.
 */
export const REAL = { prologue: 0, i1: 1, i2: 2, i3: 3, i4: 4, finale: 9 } as const;

/** Current real-world moment (see REAL). */
export const realPhase = (): number => Number(G.state.flags.interlude ?? 0);

/** True during the finale (and the epilogue that follows it). */
export const isFinale = (): boolean => realPhase() === REAL.finale;

/** The real-world moment reached by waking up from dream chapter `n` (chapter 5 never wakes up: Noa falls). */
export function wakePhase(n: DreamNo): number {
  return n === 6 ? REAL.finale : n;
}

export const STORY: {
  /** Dream chapter entry scripts: load the first map and play the opening. */
  dream: Partial<Record<DreamNo, Script>>;
  /** Real-world scripts played after waking up from chapter N (3 = interlude III, 6 = finale). */
  wake: Partial<Record<DreamNo, Script>>;
} = { dream: {}, wake: {} };

export type EndingId = 'aube' | 'aube_blanche' | 'beaux_reves' | 'silence' | 'veilleuse';

/** Falls asleep in the real world and enters dream chapter `n`. */
export async function enterDream(d: Director, n: DreamNo): Promise<void> {
  audio.stopMusic(2);
  audio.setAmbience('none');
  await d.fadeOut(90, '#000000');
  d.sfx('whoosh', { pitch: 0.6 });
  await d.wait(40);
  await startDream(d, n);
}

/**
 * Chapter 5 → 6: Noa does not wake up between the two, he falls (docs/HISTOIRE.md §3.1). No white flash and no real
 * world: the music sinks, the screen goes dark from the top, a long low whoosh, and the next dream starts.
 */
export async function fallInto(d: Director, n: DreamNo): Promise<void> {
  audio.tempoScale = 1;
  audio.stopMusic(3);
  audio.setAmbience('none');
  fx.glitch = 0;
  d.sfx('whoosh', { pitch: 0.35, vol: 0.9 });
  d.shake(2, 50);
  await d.fadeOut(110, '#000000');
  d.sfx('whoosh', { pitch: 0.25, vol: 0.6 });
  await d.wait(70);
  d.sfx('heartbeat', { pitch: 0.8, vol: 0.5 });
  await d.wait(50);
  await startDream(d, n);
}

async function startDream(d: Director, n: DreamNo): Promise<void> {
  G.state.chapter = n;
  G.state.hp = maxHp(G.state);
  G.state.flags.interlude = 0;
  const script = STORY.dream[n];
  if (!script) {
    console.error(`No dream script for chapter ${n}`);
    return;
  }
  await script(d);
  // Autosave at the start of each chapter.
  d.save();
}

/** Wakes up in the real world after dream chapter `n`. */
export async function wakeUp(d: Director, n: DreamNo): Promise<void> {
  audio.stopMusic(1.5);
  audio.tempoScale = 1;
  fx.glitch = 0;
  await d.fadeOut(60, '#ffffff');
  await d.wait(30);
  await d.fadeOut(1, '#000000');
  G.state.flags.interlude = wakePhase(n);
  G.state.party = [];
  const script = STORY.wake[n];
  if (!script) {
    console.error(`No wake script after chapter ${n}`);
    return;
  }
  await script(d);
  d.save();
}

/** The endings after which the credits end on the help card (docs/HISTOIRE.md § 6.4). */
export const HELP_CARD_ENDINGS: readonly EndingId[] = ['beaux_reves', 'silence', 'aube_blanche'];

/**
 * Records an ending, plays the credits and returns to the title screen. The run is over: the save is deleted.
 * The memory keeps it (§ 5 « Méta »): `endings`, `lastEnding` (it picks the title screen), one more night
 * (`nuits`), the date of Beaux rêves (its title counts the days), and after Veilleuse Dodo stays silent for good.
 */
export async function finishGame(d: Director, ending: EndingId): Promise<void> {
  if (!G.meta.endings.includes(ending)) G.meta.endings.push(ending);
  G.meta.lastEnding = ending;
  G.meta.nuits++;
  if (ending === 'beaux_reves') G.meta.beauxRevesAt = Date.now();
  if (ending === 'veilleuse') G.meta.dodoSilent = true;
  G.meta.runInProgress = false;
  writeMeta(G.meta);
  deleteSave();
  setPageTitle(null);
  fx.glitch = 0;
  fx.setBars(false);
  await d.fadeOut(90);
  game.remove(world);
  await CreditsScene.play({ helpCard: HELP_CARD_ENDINGS.includes(ending) });
  await flow.toTitle();
}

/** Opens a shop. */
export function shop(stock: string[], greeting?: string, keeper?: string, discount = 0): Promise<void> {
  return ShopScene.open(stock, greeting, keeper, discount);
}

/** A dream save point (a little nightlight on a pedestal). */
export function savePoint(x: number, y: number, text?: string): PropDef {
  return {
    sprite: 'prop_savepoint',
    frames: ['prop_savepoint', 'prop_savepoint_2'],
    frameSpeed: 18,
    x,
    y,
    light: { r: 44, color: '#ffe991', flicker: true },
    script: (d) => d.savePoint(text),
  };
}

/** True once the player has defeated (rather than spared) every enemy met so far — used for the Silence ending. */
export function isSilenceRoute(): boolean {
  const kills = Object.values(G.state.kills).reduce((a, b) => a + b, 0);
  const spares = Object.values(G.state.spares).reduce((a, b) => a + b, 0);
  return spares === 0 && kills >= 8;
}

/** Shorthand for a flag check in map conditions. */
export const f = (name: string) => () => !!G.state.flags[name];
export const nf = (name: string) => () => !G.state.flags[name];

// ---------------------------------------------------------------------------------------------------------------------
// The road of the ink: the inhabitants of the dream back away from Noa
// ---------------------------------------------------------------------------------------------------------------------

/** What the inhabitants say, the first time Noa talks to each of them on the road of the ink (in this order). */
export const INK_FEAR: string[][] = [
  ['Un pas en arrière, en te voyant arriver.', '« Ne me fais pas de mal. »'],
  ['Un regard vers tes mains. Elles sont bleues jusqu\'aux poignets.', '« Monstre. »'],
  ['« C\'est toi. Celui qui laisse des flaques partout. »'],
  ['Un long silence. Puis, tout bas :', '« Les autres ne sont pas rentrés, hier soir. Tu sais pourquoi, toi. »'],
  ['« On compte les absents, le soir. Ça prend de plus en plus longtemps. »'],
  ['« Monstre. »', 'C\'est dit tout bas. Comme on dit un prénom.'],
  ['« S\'il te plaît. Pas moi. »'],
  ['Un regard vers la sortie. Un autre vers toi.', '« …Tu vas me faire pareil ? »'],
  ['« On t\'a vu, sur le chemin. Tout le monde t\'a vu. »'],
  ['« Tu sens l\'encre. Ça ne part pas au lavage, tu sais. »'],
];

/** Who never backs away: Noa's own (Dodo, Mina, Maman, the little girl in the hat), and Chaussette, who has her own words. */
const NO_FEAR = /^(dodo|mina|maman|petite|bonnet|chaussette|noa)/;

/**
 * world.beforeTalk: on the road of the ink (inkRoute), the first time Noa talks to an inhabitant of a dream map, it backs
 * away and says what it thinks of him; then its usual words follow. Once per inhabitant (flags encre_peur_<map>_<id>).
 */
export function inkFear(e: Entity): Script | null {
  const map = world.map;
  if (!map || map.world === 'real' || G.state.playerChar !== 'noa' || !inkRoute(G.state)) return null;
  if (NO_FEAR.test(e.id) || (e.who && NO_FEAR.test(e.who))) return null;
  const key = `encre_peur_${map.id}_${e.id}`;
  if (G.state.flags[key]) return null;
  return async (d) => {
    const n = Object.keys(G.state.flags).filter((k) => k.startsWith('encre_peur_')).length;
    G.state.flags[key] = true;
    e.emote = { ch: '!', t: 0 };
    audio.sfx('step', { pitch: 0.7, vol: 0.4 });
    await d.wait(16);
    await d.say(INK_FEAR[n % INK_FEAR.length]!);
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The phone: deleting a conversation (an easter egg)
// ---------------------------------------------------------------------------------------------------------------------

/** What Dodo says the first time, by conversation; then « Encore ? », then silence. Dodo speaks to the player. */
const DODO_DELETE: Record<string, string[]> = {
  mina: ['Tu l\'as effacée.', 'Moi, je garde tout, {player}. Les numéros, les nuits, les moutons.', 'Je l\'ai remise. Elle était bien, là.'],
  maman: ['Elle t\'écrit tous les soirs, tu sais.', 'Si tu l\'effaces, elle écrira dans le vide. Elle ne s\'en rendra même pas compte.', 'Je l\'ai remise. Ne fais pas ça, {player}.'],
};
const DODO_DELETE_OTHER = ['On n\'efface pas les gens comme ça, {player}.', 'Je l\'ai remis. Ici, les gens reviennent toujours.'];

/**
 * Noa deletes a conversation (the bin of an open thread, or the menu button: PhoneEvent 'delete'). It vanishes from
 * the list; then Dodo, from the bed, speaks to the player by name and puts it back (the story still needs every
 * thread). In the finale Dodo is silent: the conversation is simply still there. Counted in flags.tel_supprime.
 */
export async function phoneDelete(d: Director, ph: PhoneScene, id: string): Promise<void> {
  const r = await d.ask('Supprimer la conversation ?', ['Supprimer', 'Annuler'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  const removed = ph.removeContact(id);
  if (!removed) return;
  audio.sfx('cancel', { pitch: 0.5 });
  const n = Number(G.state.flags.tel_supprime ?? 0) + 1;
  G.state.flags.tel_supprime = n;
  await d.wait(60);
  if (isFinale()) {
    await d.say('Tu effaces la conversation. L\'écran s\'éteint.');
    ph.restoreContact(removed);
    await d.say(['Tu le rallumes. Elle est toujours là.', 'Certaines choses ne s\'effacent pas.']);
    return;
  }
  if (n === 1) await d.say('Sur le lit, Dodo n\'a pas bougé. Pourtant, quelqu\'un parle.');
  fx.glitch = 0.2;
  audio.sfx('glitch', { vol: 0.4 });
  await d.wait(10);
  fx.glitch = 0;
  if (n === 1) await d.say(DODO_DELETE[id] ?? DODO_DELETE_OTHER, 'dodo:creepy');
  else if (n === 2) await d.say(['Encore ?', 'Je la remettrai autant de fois qu\'il le faudra, {player}.'], 'dodo:creepy');
  else await d.say('…', 'dodo:creepy');
  ph.restoreContact(removed);
  audio.sfx('pop', { pitch: 0.8 });
}

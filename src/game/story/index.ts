import type { Script } from '../overworld/types';
import { STORY, enterDream } from './common';
import { world } from '../overworld/world';
import { G } from '../state';
import { tr } from '../../i18n';
import * as real from './real';
import * as realNuit from './real-nuit';
import * as chapter1 from './chapter1';
import * as chapter2 from './chapter2';
import * as chapter3 from './chapter3';
import * as fausseAube from './fausse-aube';
import * as chapter4 from './chapter4';
import * as chapter5 from './chapter5';
import * as chapter6 from './chapter6';
import * as bonus from './bonus';
import * as socle from './socle';
import * as endings from './endings';
import * as battleDebug from '../battle/debug-battles';

/** Talking to Mina while she follows Noa: a line depending on where you are. */
const MINA_LINES: Record<string, string[]> = { ...chapter1.MINA_LINES, ...chapter2.MINA_LINES, ...chapter3.MINA_LINES, ...bonus.MINA_LINES };
world.followerTalk = async (d) => {
  if (G.state.party.includes('mina366')) return chapter4.mina366Talk(d);
  const lines = MINA_LINES[G.state.map] ?? ['Quoi ? J\'ai quelque chose sur la figure ?'];
  const n = Number(G.state.flags[`mina_talk_${G.state.map}`] ?? 0);
  G.state.flags[`mina_talk_${G.state.map}`] = n + 1;
  const line = lines[n % lines.length]!;
  // The catalog key is the whole "text|expression" line; the English value keeps the same suffix.
  const [text, expr] = tr(line).split('|') as [string, string | undefined];
  await d.say(text, `mina:${expr ?? 'happy'}`);
};

// Version 2, the whole night (docs/HISTOIRE.md § 3.1):
//   prologue → ch. 1 → I → ch. 2 → II → ch. 3 → the false dawn → III → ch. 4 → IV → ch. 5 ⇣ ch. 6 → finale.
STORY.dream[1] = chapter1.start;
STORY.dream[2] = chapter2.start;
STORY.dream[3] = chapter3.start;
// Interlude III (real-nuit.ts, entered at the end of the false dawn) enters chapter 4.
STORY.dream[4] = chapter4.start;
// Interlude IV ends by entering chapter 5, which falls into chapter 6 (fallInto) without waking up.
STORY.dream[5] = chapter5.start;
// Chapter 5 falls into chapter 6 (chapter5.theFall → fallInto(d, 6)), the last dream.
STORY.dream[6] = chapter6.start;
STORY.wake[1] = real.interlude1;
STORY.wake[2] = real.interlude2;
// Chapter 3 wakes up into the false dawn (fausse-aube.ts), which ends in Interlude III.
STORY.wake[3] = fausseAube.play;
STORY.wake[4] = realNuit.interlude4;
// « Ouvrir les yeux » at the end of chapter 6 wakes up into the finale (« Le carnet »; production lot 9 rewrites it).
STORY.wake[6] = real.finale;

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
  chapter4: chapter4.start,
  bonus: bonus.start,
  ...real.DEBUG,
  ...realNuit.DEBUG,
  ...chapter1.DEBUG,
  ...chapter2.DEBUG,
  ...chapter3.DEBUG,
  ...fausseAube.DEBUG,
  ...chapter4.DEBUG,
  ...chapter5.DEBUG,
  ...chapter6.DEBUG,
  ...bonus.DEBUG,
  ...socle.DEBUG,
  ...endings.DEBUG,
  ...battleDebug.DEBUG,
};

/** After Beaux rêves, « Continuer » on the title: a new run that starts in chapter 1 (flags.br_retour). */
export const dreamAgain: Script = (d) => enterDream(d, 1);

/** Entry point of the bonus chapter (title screen, after the dawn ending). */
export const startBonus: Script = bonus.start;

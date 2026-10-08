import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { G } from '../state';
import { dialogue, nightNarratorVoice } from '../ui/dialogue';
import { CountingScene, type CountSkin } from '../scenes/sheepcount';

/*
 * Version 2 groundwork (production lot 0, docs/HISTOIRE.md §7): replayable demos of the new building blocks, so that
 * later lots (and the bot scenarios in tools/scenarios/) can check them in isolation:
 *   dialogue_tags   {as:noa} speaker switch mid-box, {static} radio static, {voice:…}, the narrator's night blip
 *   count_coups     the counting scene, « coups » skin (3 rounds, the blind one asked, then the answer: 1, 2 or 3 knocks)
 *   count_dents     the counting scene, « dents » skin (the music box; each tooth plays the next lullaby note)
 *   (add &round=N to start at round N, &sheep=auto to let the scene play perfectly, &sheep=fail to never press)
 *
 * Nothing here is part of the story: the chapters and interludes use these blocks with their own text.
 */

/** The speaker switch of T7 (§2.8) and the radio static of Dodo's dying battery. */
async function dialogueTags(d: Director): Promise<void> {
  d.load('chambre', 'bed');
  await d.fadeIn(10);
  await d.say('Je suis là, Noa. Je suis toujours là.', 'dodo');
  await d.say('Bonne nuit, Noa ! Dodo veille sur t{static}—ch—t… tt…{/static}', 'dodo');
  await d.say('{c:g}*crrr*{/c} {static}…veille… su…{/static}{p:30}{as:noa}…sur toi. Fais de beaux rêves.', 'dodo');
  await d.say('Tu ne dors pas ?{p:20} {as:noa:sad}Tu ne dors pas ?', 'dodo:creepy');
  await d.narrate('Tu ne peux pas.');
  await d.narrate('{voice:noa}Tu ne peux pas.');
  dialogue.narratorVoice = nightNarratorVoice(3, G.meta.dodoSilent);
  await d.narrate('Il est trois heures. Tu devrais dormir.');
  dialogue.narratorVoice = null;
}

/** Plays the rounds of a counting skin (retrying failed rounds once), as a story script would. */
async function countingDemo(d: Director, skin: CountSkin): Promise<void> {
  d.load('chambre', 'bed');
  await d.fadeOut(1);
  const scene = CountingScene.open(skin);
  await d.fadeIn(20);
  const first = Number(new URLSearchParams(location.search).get('round') ?? 1);
  for (let round = first; round <= 3; round++) {
    scene.announce(round);
    await d.say(skin === 'coups' ? ['Toc.', 'Quelque chose frappe dans le mur. De l\'autre côté.'] : ['Le cylindre se remet à tourner.', 'Il manque une dent au peigne.']);
    let r = await scene.play(round, 0);
    if (!r.ok) {
      await d.say('Encore une fois.');
      r = await scene.play(round, 1);
    }
    if (scene.roundDef?.blind) {
      const nums = [r.valid - 1, r.valid, r.valid + 1];
      const i = await d.ask('Combien ?', nums.map(String));
      await d.say(nums[i] === r.valid ? 'Oui.' : `Non. ${r.valid}.`);
    }
  }
  if (skin === 'coups') {
    await d.say('Un coup. Tout doucement. Elle attend.');
    const n = await scene.answer();
    d.set('socle_knock_answer', n);
    await d.say(n === 1 ? 'Toc.' : n === 2 ? 'Toc, toc.' : 'Toc, toc, toc.');
  }
  await d.fadeOut(20);
  scene.close();
  await d.fadeIn(20);
}

export const DEBUG: Record<string, Script> = {
  dialogue_tags: dialogueTags,
  count_coups: (d) => countingDemo(d, 'coups'),
  count_dents: (d) => countingDemo(d, 'dents'),
};

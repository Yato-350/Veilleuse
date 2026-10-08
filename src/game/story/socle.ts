import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { G } from '../state';
import { dialogue, nightNarratorVoice } from '../ui/dialogue';

/*
 * Version 2 groundwork (production lot 0, docs/HISTOIRE.md §7): replayable demos of the new building blocks, so that
 * later lots (and the bot scenarios in tools/scenarios/) can check them in isolation:
 *   dialogue_tags   {as:noa} speaker switch mid-box, {static} radio static, {voice:…}, the narrator's night blip
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

export const DEBUG: Record<string, Script> = {
  dialogue_tags: dialogueTags,
};

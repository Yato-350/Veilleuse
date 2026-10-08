import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { G } from '../state';
import { dialogue, nightNarratorVoice } from '../ui/dialogue';
import { CountingScene, type CountSkin } from '../scenes/sheepcount';
import { dateLabel, PhoneScene, type PhoneCall, type PhoneContact, type PhoneMessage, type PhoneTab } from '../scenes/phone';

/*
 * Version 2 groundwork (production lot 0, docs/HISTOIRE.md §7): replayable demos of the new building blocks, so that
 * later lots (and the bot scenarios in tools/scenarios/) can check them in isolation:
 *   dialogue_tags   {as:noa} speaker switch mid-box, {static} radio static, {voice:…}, the narrator's night blip
 *   count_coups     the counting scene, « coups » skin (3 rounds, the blind one asked, then the answer: 1, 2 or 3 knocks)
 *   count_dents     the counting scene, « dents » skin (the music box; each tooth plays the next lullaby note)
 *   (add &round=N to start at round N, &sheep=auto to let the scene play perfectly, &sheep=fail to never press)
 *   phone_home      the v2 phone on its contact list: a pinned, locked thread (refused once, then opened), a year of
 *                   history, the call log
 *   phone_log       the same phone, opened on the « Journal d'appels » tab
 *   phone_ring      an incoming call that cannot be answered, which becomes a missed call
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

// ---------------------------------------------------------------------------
// Phone (sample data: the interludes write their own)
// ---------------------------------------------------------------------------

/** A year of « bonne nuit », one a night, all delivered; the number changed hands in the ninth month. */
function sampleMinaThread(): PhoneMessage[] {
  const out: PhoneMessage[] = [];
  const words = ['bonne nuit', 'bonne nuit', 'bonne nuit mina', 'bonne nuit', 'bn', 'bonne nuit.'];
  for (let day = 364; day >= 1; day--) {
    out.push({ from: 'info', text: dateLabel(day) });
    out.push({ from: 'me', text: words[day % words.length]!, status: 'Distribué' });
    if (day === 92) out.push({ from: 'them', text: 'Je ne sais pas qui vous êtes. Ce numéro est à moi maintenant. S\'il vous plaît, arrêtez.' });
  }
  return out;
}

function sampleContacts(): PhoneContact[] {
  return [
    {
      id: 'maman',
      name: 'Maman',
      color: '#c86a8a',
      when: '23:52',
      unread: 1,
      messages: [
        { from: 'info', text: dateLabel(1) },
        { from: 'them', text: 'Tu as mangé ?' },
        { from: 'info', text: dateLabel(0) },
        { from: 'them', text: 'Je rentre tard. Il y a des pâtes dans le frigo. Je t\'aime.' },
      ],
    },
    {
      id: 'leo',
      name: 'Léo',
      color: '#5f8fd6',
      when: dateLabel(61),
      messages: [
        { from: 'info', text: dateLabel(130) },
        { from: 'them', text: 'tu reviens quand au collège ?' },
        { from: 'info', text: dateLabel(95) },
        { from: 'them', text: 'on t\'a gardé ta place à la cantine' },
        { from: 'them', text: 'enfin on essaie' },
        { from: 'info', text: dateLabel(61) },
        { from: 'them', text: 'bon.' },
      ],
    },
    { id: 'mina', name: 'Mina 🐑', avatar: '🐑', color: '#e0834f', pinned: true, locked: true, when: dateLabel(1), messages: sampleMinaThread() },
  ];
}

function sampleCalls(): PhoneCall[] {
  return [
    { name: 'Maman', dir: 'missed', time: '19:02', date: dateLabel(1) },
    { name: 'Maman', dir: 'in', time: '12:30', duration: '0:12', date: dateLabel(1) },
    { name: 'Maman', dir: 'missed', time: '18:47', date: dateLabel(9) },
    { name: 'Léo', dir: 'missed', time: '16:05', date: dateLabel(130) },
    { name: 'Mina 🐑', dir: 'in', time: '3:14', duration: '0:41', date: dateLabel(365) },
  ];
}

/** Browses the sample phone: the pinned thread is refused once, then opens; the call log is commented once. */
async function phoneDemo(d: Director, tab: PhoneTab): Promise<void> {
  d.load('chambre', 'bed');
  await d.fadeIn(10);
  const ph = PhoneScene.home({ clock: '4:06', contacts: sampleContacts(), calls: sampleCalls(), tab });
  let refused = 0;
  let logSeen = false;
  for (;;) {
    if (ph.isOnCalls && !logSeen) {
      logSeen = true;
      await d.wait(30);
      await d.say('Tu ne te souviens pas de cet appel.');
    }
    const ev = await ph.browse();
    if (ev.kind === 'close') break;
    if (ev.kind === 'locked') {
      refused++;
      if (refused === 1) await d.say('Tu ne l\'ouvres pas. Pas ce soir.');
      else {
        await d.say('…');
        ph.setLocked(ev.id, false);
      }
    }
  }
  await ph.close();
}

async function phoneRing(d: Director): Promise<void> {
  d.load('chambre', 'bed');
  await d.fadeIn(10);
  const ph = PhoneScene.home({ clock: '3:14', contacts: sampleContacts(), calls: sampleCalls(), tab: 'calls' });
  await d.wait(30);
  await ph.ring('Mina 🐑', '3:14', 240);
  await d.say('Tu n\'as pas pu décrocher.');
  while ((await ph.browse()).kind !== 'close') {
    /* browse until the phone is put down */
  }
  await ph.close();
}

export const DEBUG: Record<string, Script> = {
  phone_home: (d) => phoneDemo(d, 'messages'),
  phone_log: (d) => phoneDemo(d, 'calls'),
  phone_ring: phoneRing,
  dialogue_tags: dialogueTags,
  count_coups: (d) => countingDemo(d, 'coups'),
  count_dents: (d) => countingDemo(d, 'dents'),
};

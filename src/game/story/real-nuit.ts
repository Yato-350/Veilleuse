import { audio, parsePattern } from '../../engine/audio';
import { fx } from '../../engine/fx';
import { game } from '../../engine/game';
import { LULLABY_PATTERN } from '../../data/music';
import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G, maxHp } from '../state';
import { setPageTitle } from '../meta';
import { CountingScene, type SheepRound } from '../scenes/sheepcount';
import { dateLabel, PhoneScene, type PhoneCall, type PhoneContact, type PhoneMessage, type PhoneReply } from '../scenes/phone';
import { enterDream, REAL, realPhase, STORY } from './common';
import { inBed, mamanThread, PHONE_CLOCK } from './real';

/**
 * The long night, in the real apartment (docs/HISTOIRE.md § 3.10, § 3.12, T2 § 2.3, T5 § 2.6, § 4 « Monde réel »):
 *   Interlude III « Le sac » (4:06)      after the false dawn; enters chapter 4 (enterDream(4))
 *   Interlude IV  « Le placard » (4:44)  after chapter 4 (STORY.wake[4]); enters chapter 5 once it exists
 * Maps (src/data/maps/real.ts): `chambre` (its night props show while isNuit()), `appartement_tard` (the hallway at
 * night, quiet, the right length), `chambre_maman` (IV). G.state.flags.interlude is REAL.i3 or REAL.i4.
 * Quiet, domestic scenes: small sounds, what Maman keeps, the bag that was never unpacked. Every strange detail has
 * an ordinary double (the radiator, a dying battery, a draught, photos).
 *
 * Flags (i3_*, Interlude III):
 *   i3_dodo          the narrator got Dodo wrong (« Ton mouton. » … « …Le mouton de Mina. »); i3_ventre: belly presses
 *   i3_tel           the « Mina 🐑 » thread was unlocked and read; i3_reply: 'pardon' | 'bonnenuit' | 'rien'
 *   i3_appel         the call log was seen (« Mina 🐑 — entrant — 3:14 — 0:41 »); i3_appel_n: taps on that line
 *   i3_leo           Léo's thread (the sheep he sends every week)
 *   i3_photo         the photo was turned over (`photo_decoupee`); i3_photo_essais: tries (the narrator gives in)
 *   i3_porte         the bedroom door opened by itself (after the call log and the photo)
 *   i3_placard       the hall cupboard; i3_sac_ouvert: the bag unzipped; i3_sac_<objet>: couronne, chaussons,
 *                    bracelet, telephone; i3_sac: the polaroid (T2) at the bottom of the bag
 *   i3_fin           « Tu vois ? Tu reviens toujours. » — Noa went back to sleep (chapter 4)
 * Flags (i4_*, Interlude IV):
 *   i4_armoire       the open wardrobe; i4_mots: the forty-one fridge notes in the shoe box; i4_boite: the nightlight's
 *                    box (« Pour Noa, 4 ans »); i4_thermo: the thermometer (« MEM 38,4 »)
 *   i4_mot_pris      the fridge note taken down; i4_mot: its back read under the hood light (« Je sais que t— »)
 *   i4_maman         Maman's room entered; i4_reveil: the alarm clock and its post-it (T5); i4_pile: its battery taken;
 *   i4_dessin        the drawing on the mirror (`dessin_chut`); i4_kit: the voice kit and Nadia's note; i4_couture,
 *                    i4_dents, i4_lettre (the phone company's letter), i4_bonbon (a mint from her work blouse)
 *   i4_coups         a knock in Mina's wall (after the alarm clock and the drawing); i4_knock: 'deux' | 'trois' |
 *                    'rien' | 'un' (what Noa knocked back, or nothing)
 *   i4_tel           the « Lu » under the reply of III; i4_fin: Noa went back to sleep (chapter 5)
 * Counters i3_n_<prop> / i4_n_<prop> pick the line of each inspection.
 */

const phase = realPhase;
const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);

/** True during Interludes III and IV (the maps show their night props). */
export const isNuit = (): boolean => phase() === REAL.i3 || phase() === REAL.i4;
/** Interlude IV (4:44). */
const iv = (): boolean => phase() === REAL.i4;

type Lines = string | string[];

/** How many times this inspection was done in this interlude (then counts it). */
function nth(key: string): number {
  const k = `${iv() ? 'i4' : 'i3'}_n_${key}`;
  const n = num(k);
  G.state.flags[k] = n + 1;
  return n;
}

/** An inspection whose text changes each time (the last one repeats); `iv4` replaces it in Interlude IV. */
const look =
  (key: string, iii: Lines[], iv4?: Lines[]): Script =>
  async (d) => {
    const set = iv() && iv4 ? iv4 : iii;
    const n = nth(key);
    await d.say(set[Math.min(n, set.length - 1)]!);
  };

// ---------------------------------------------------------------------------------------------------------------------
// Sounds of the apartment at night: the radiator pipe, a car far away, the clock of Maman's room
// ---------------------------------------------------------------------------------------------------------------------

let ambientToken = 0;

/** Small sounds every few seconds while the player stays on `mapId` (stops by itself on leaving). */
function startAmbient(mapId: string, play: () => void, min = 420, max = 1100): void {
  const token = ++ambientToken;
  void (async () => {
    for (;;) {
      await game.wait(min + Math.floor(Math.random() * (max - min)));
      if (token !== ambientToken || world.map?.id !== mapId || !isNuit()) return;
      play();
    }
  })();
}

/** The radiator knocking as it cools, or the scratch of something small in the wall. */
function roomSounds(): void {
  const r = Math.random();
  if (r < 0.55) {
    audio.sfx('pipe', { vol: 0.22, pitch: 0.9 + Math.random() * 0.2 });
  } else if (r < 0.8) {
    audio.sfx('whoosh', { vol: 0.08, pitch: 0.35 });
  } else if (iv()) {
    audio.sfx('scratch', { vol: 0.12, pitch: 0.8 });
  }
}

function flatSounds(): void {
  const r = Math.random();
  if (r < 0.4) audio.sfx('pipe', { vol: 0.15, pitch: 0.7 });
  else if (r < 0.75) audio.sfx('whoosh', { vol: 0.1, pitch: 0.3 });
  else audio.sfx('step', { vol: 0.08, pitch: 0.5 });
}

/** The lullaby on the music box in Dodo's tail: `n` notes, slowing down, a little out of tune. */
let lullabyNotes: number[] | null = null;
async function lullaby(d: Director, n: number, slow = 1): Promise<void> {
  lullabyNotes ??= parsePattern(LULLABY_PATTERN).events.map((e) => e.midis[0]!);
  for (let i = 0; i < n; i++) {
    const out = i >= n - 2 ? -1 : 0;
    audio.note('musicbox', lullabyNotes[i % lullabyNotes.length]! + out, 0.9, 0.45);
    await d.wait(Math.round((22 + i * 3) * slow));
  }
}

/** Dodo's belly: the voice module, its battery dying (the recording is never attributed here). */
async function pressBelly(d: Director, slower: boolean): Promise<void> {
  d.sfx('tooth', { pitch: 0.6, vol: 0.6 });
  await d.wait(20);
  d.sfx('static', { vol: 0.5, pitch: slower ? 0.6 : 0.9 });
  if (slower) await d.say('{spd:0.35}{static}« …n… nui… N… »{/static}{/spd}');
  else await d.say('{spd:0.6}{static}« …nne nuit, N… »{/static}{/spd}');
  d.sfx('static', { vol: 0.35, pitch: slower ? 0.45 : 0.7 });
  await d.say('{static}krrrsshhh…{/static}');
}

// ---------------------------------------------------------------------------------------------------------------------
// Interlude III — « Le sac » (4:06)
// ---------------------------------------------------------------------------------------------------------------------

export async function interlude3(d: Director): Promise<void> {
  // Reached from the false dawn (production lot 5) or by debug.
  G.state.flags.interlude = REAL.i3;
  G.state.party = [];
  G.state.hp = maxHp(G.state);
  setPageTitle(null);
  d.load('chambre', 'bed');
  inBed(d, true);
  d.music(null);
  d.ambience('none');
  await d.wait(60);
  d.sfx('thread', { pitch: 0.45, vol: 0.35 });
  await d.wait(50);
  await d.narrate('Un bruit de tissu.');
  await d.wait(40);
  await d.narrate('4:06');
  await d.narrate('Il fait toujours nuit.');
  audio.setAmbience('rain', 0.6);
  await d.fadeIn(100);
  await d.wait(40);
  await d.say(['Pas d\'oiseaux. Pas de soleil.', 'Juste la pluie, et la veilleuse qui grésille.']);
  const lamp = d.find('veilleuse');
  if (lamp?.light) lamp.light = { ...lamp.light, r: 30 };
  d.sfx('static', { vol: 0.2, pitch: 1.4 });
  await d.wait(24);
  if (lamp?.light) lamp.light = { ...lamp.light, r: 52 };
  await d.wait(20);
  inBed(d, false);
  d.sfx('step', { pitch: 0.6 });
  await d.say(['Tu as rêvé d\'un matin. Il faisait beau, dans le rêve.', 'Il faisait trop beau.']);
  await d.say('…', 'noa:tired');
  await d.say(['Dodo est assis sur l\'oreiller.', 'Il a la tête tournée vers toi.']);
}

/** Chambre at night (both interludes): darker than the prologue, the rain, the radiator. */
export const chambreEnter: Script = async (d) => {
  world.extraDarkness = iv() ? 0.32 : 0.26;
  d.music(null);
  audio.setAmbience('rain', iv() ? 0.35 : 0.6);
  startAmbient('chambre', roomSounds);
  if (iv() && flag('i4_reveil') && flag('i4_dessin') && !flag('i4_coups')) await knocks(d);
};

// --- Dodo -------------------------------------------------------------------------------------------------------------

export const dodo: Script = async (d) => {
  if (iv()) return dodoIV(d);
  if (flag('i3_sac')) return lastWordIII(d);
  if (!flag('i3_dodo')) {
    d.set('i3_dodo');
    await d.say('Dodo.');
    await d.wait(20);
    await d.say('Dodo. Ton mouton.');
    fx.pulseGlitch(6);
    d.sfx('static', { vol: 0.25, pitch: 1.6 });
    await d.wait(30);
    await d.say('{p:30}…Le mouton de Mina.');
    await d.say(['Le mouton en peluche de Mina. Elle te l\'a donné, avant.', 'Son dos est tout pelé. Gratté jusqu\'à la trame, par endroits.']);
  } else {
    await d.say(['Dodo. Les yeux-boutons, le nez rose, le dos pelé.', 'Une peluche. Juste une peluche.']);
  }
  const r = await d.ask('Appuyer sur son ventre ?', ['Appuyer', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  const n = num('i3_ventre');
  d.set('i3_ventre', n + 1);
  await d.say('Tu appuies. Quelque chose, dedans, fait clic.');
  await pressBelly(d, false);
  await d.wait(30);
  await d.say(n === 0 ? 'Tu n\'as rien entendu.' : ['Tu n\'as rien entendu.', 'Tu n\'as rien entendu. Les peluches ne parlent pas.']);
  if (n === 0) await d.say('…', 'noa:sad');
};

/** Back in bed after the bag: Dodo's only words of the night, then the dream of the sewn house. */
async function lastWordIII(d: Director): Promise<void> {
  if (!flag('i3_fin_dit')) {
    d.set('i3_fin_dit');
    await d.say(['Dodo est sur l\'oreiller. Exactement là où tu l\'as laissé.', 'Tu t\'assois au bord du lit.']);
    await d.wait(40);
    d.sfx('static', { vol: 0.15, pitch: 1.2 });
    await d.wait(30);
    await d.say('Tu vois ?', 'dodoreel');
    await d.wait(20);
    await d.say('Tu reviens toujours.', 'dodoreel');
    await d.wait(30);
  }
  const r = await d.ask('Dormir ?', ['Dormir', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say(['Tu restes assis, les mains sur les genoux.', 'Dodo attend. Il a le temps.']);
    return;
  }
  d.set('i3_fin');
  inBed(d, true);
  await d.say(['Tu remontes la couette jusqu\'au menton.', 'Le coton de l\'oreiller sent la lessive. Et autre chose. Le désinfectant.']);
  await enterDream(d, 4);
}

// --- The bed ------------------------------------------------------------------------------------------------------------

export const bed: Script = async (d) => {
  if (iv()) {
    if (flag('i4_coups')) return dodoIV(d);
    const n = nth('lit');
    await d.say(
      [
        ['Tu n\'as pas sommeil.', 'Il reste quelque chose, dans l\'appartement. Tu le sens dans ton ventre.'],
        'Pas maintenant. Pour l\'instant.',
        ['Le drap a gardé la forme de ton dos.', 'Et de tout petits flocons de coton gris.'],
      ][Math.min(n, 2)]!,
    );
    return;
  }
  if (flag('i3_sac')) return lastWordIII(d);
  const n = nth('lit');
  if (n === 1) {
    await d.say('Pas maintenant. Pour l\'instant.', 'noa:tired');
    return;
  }
  await d.say(
    n === 0
      ? ['Ton lit. Les draps sont froids, alors que tu viens d\'en sortir.', 'Tu n\'as pas sommeil.']
      : ['Tu n\'as pas sommeil.', 'Quelque chose t\'attend, dehors. Pas loin. Derrière une porte.'],
  );
};

// --- The nightlight (save point) --------------------------------------------------------------------------------------

export const nightlight: Script = async (d) => {
  if (!iv()) {
    await d.savePoint('La veilleuse grésille. La petite lune clignote, une fois, deux fois. Puis elle tient.');
    return;
  }
  if (flag('c4_fele')) {
    await d.say(['La veilleuse. Une fêlure traverse la lune, d\'un bord à l\'autre.', 'Elle n\'était pas là hier soir.']);
    await d.savePoint('Elle brille quand même. Moins bien. Mais elle brille.');
    return;
  }
  await d.savePoint('La veilleuse ne grésille plus. Elle attend, comme toi.');
};

// --- The phone ----------------------------------------------------------------------------------------------------------

const MINA = 'Mina 🐑';
const REPLIES: Array<PhoneReply & { id: string }> = [
  { id: 'pardon', text: 'Pardon. C\'était ma sœur.', emotion: 'tristesse' },
  { id: 'bonnenuit', text: 'bonne nuit', emotion: 'neutre' },
  { id: 'rien', text: 'Ne rien répondre' },
];
const STRANGER = 'Je ne sais pas qui vous êtes. Ce numéro est à moi maintenant. S\'il vous plaît, arrêtez.';
/** The day (counted back from tonight) the number answered, in the ninth month. */
const STRANGER_DAY = 92;

/** What Noa wrote some nights (the others: a plain « bonne nuit »). */
const SOME_NIGHTS: Record<number, string[]> = {
  364: ['bonne nuit mina'],
  351: ['dodo veille. tkt'],
  333: ['maman travaille la nuit maintenant', 'bonne nuit'],
  301: ['j\'ai rêvé de toi. tu avais ta couronne', 'bonne nuit'],
  270: ['il pleut', 'tu aimais bien quand il pleut', 'bonne nuit'],
  244: ['bonne nuit. tu me manques. bonne nuit.'],
  212: ['j\'ai essayé de dormir sans la veilleuse'],
  211: ['non'],
  180: ['ça fait six mois', 'bonne nuit'],
  150: ['léo m\'envoie des moutons', 'tu l\'aurais adoré', 'bonne nuit'],
  121: ['bonne nuit 🐑'],
};
const PLAIN = ['bonne nuit', 'bonne nuit', 'bn', 'bonne nuit mina', 'bonne nuit.', 'bonne nuit'];

/**
 * The « Mina 🐑 » thread: Maman's old phone, left to Mina at the hospital. Her messages first (forty-two days), then a
 * « bonne nuit » every night, all « Distribué », until a stranger answers in the ninth month. Then nothing.
 */
function minaThread(): PhoneMessage[] {
  const out: PhoneMessage[] = [];
  const day = (n: number) => out.push({ from: 'info', text: dateLabel(n) });
  const her = (...t: string[]) => t.forEach((text) => out.push({ from: 'them', text }));
  const me = (text: string, status = 'Lu') => out.push({ from: 'me', text, status });
  day(407);
  her('cé mina !!!!', 'maman ma donné son vieu téléphone pour lopital', 'mais un mouton a coté de mon nom');
  me('fait.');
  her('🐑🐑🐑🐑🐑');
  day(405);
  her('dodo ronfle');
  me('un mouton ça ronfle pas');
  her('LUI SI', 'comme toi');
  day(399);
  her('linfirmière de nuit elle sapelle nadia', 'elle a des chossettes avec des pingouins', 'elle sait tout');
  me('tout tout ?');
  her('TOUT TOUT');
  day(388);
  her('on a fait une bataille de coussins avec nadia', 'jai gagné', 'nadia dit que cé elle', 'cé MOI');
  day(379);
  her('tu vien quand ?');
  me('bientôt');
  day(371);
  her('cé pas grave si tu viens pas', 'jai dodo. il veille.');
  day(368);
  her('bonne nuit gros bêta 🐑');
  me('bonne nuit');
  for (let n = 365; n >= STRANGER_DAY; n--) {
    day(n);
    for (const text of SOME_NIGHTS[n] ?? [PLAIN[n % PLAIN.length]!]) me(text, 'Distribué');
    if (n === STRANGER_DAY) her(STRANGER);
  }
  // Noa's answer of Interlude III (read by IV: « Lu » if he asked for forgiveness).
  const reply = REPLIES.find((r) => r.id === G.state.flags.i3_reply && r.id !== 'rien');
  if (reply) {
    day(0);
    me(reply.text, iv() && reply.id === 'pardon' ? 'Lu' : 'Distribué');
  }
  return out;
}

/** Léo, from school: one sheep a week, whatever happens. */
function leoThread(): PhoneMessage[] {
  return [
    { from: 'info', text: dateLabel(121) },
    { from: 'them', text: 'tu reviens quand au collège ?' },
    { from: 'info', text: dateLabel(97) },
    { from: 'them', text: 'on t\'a gardé ta place à la cantine' },
    { from: 'them', text: 'enfin on essaie. Kenzo veut la prendre' },
    { from: 'them', text: 'je l\'ai mordu' },
    { from: 'them', text: 'non je rigole' },
    { from: 'them', text: 'un peu' },
    { from: 'info', text: dateLabel(60) },
    { from: 'them', text: 'regarde ce mouton il a ta tête quand on te réveille en maths' },
    { from: 'them', text: '🐑' },
    { from: 'me', text: 'arrête avec tes moutons', status: 'Lu' },
    { from: 'them', text: 'jamais' },
    { from: 'info', text: dateLabel(39) },
    { from: 'them', text: 'mouton n°47' },
    { from: 'them', text: '🐑' },
    { from: 'info', text: dateLabel(12) },
    { from: 'them', text: 'mouton n°112. il est content' },
    { from: 'them', text: 'comme toi bientôt' },
    { from: 'them', text: '🐑' },
  ];
}

/** A list date without its year (« 8 juil. »): the contact list has no room for more. */
const shortDate = (n: number): string => dateLabel(n).replace(/,? \d{4}$/, '');

function contacts(): PhoneContact[] {
  return [
    { id: 'mina', name: MINA, avatar: '🐑', color: '#e0834f', pinned: true, locked: !flag('i3_tel'), when: flag('i3_reply') && G.state.flags.i3_reply !== 'rien' ? PHONE_CLOCK[REAL.i3]! : shortDate(STRANGER_DAY), messages: minaThread() },
    { id: 'maman', name: 'Maman', color: '#c86a8a', when: '3:33', messages: mamanThread() },
    { id: 'leo', name: 'Léo', color: '#5f8fd6', when: shortDate(12), unread: flag('i3_leo') ? 0 : 3, messages: leoThread() },
  ];
}

/** The call log. The 3:14 line is the only one of its night. */
function calls(): PhoneCall[] {
  return [
    { name: 'Maman', dir: 'missed', time: '3:33', date: dateLabel(0) },
    { name: 'Maman', dir: 'in', time: '12:30', duration: '0:12', date: dateLabel(2) },
    { name: 'Maman', dir: 'missed', time: '19:02', date: dateLabel(30) },
    { name: 'Léo', dir: 'missed', time: '16:05', date: dateLabel(61) },
    { name: 'Maman', dir: 'missed', time: '22:47', date: dateLabel(130) },
    { name: 'Maman', dir: 'missed', time: '22:40', date: dateLabel(130) },
    { name: MINA, dir: 'in', time: '3:14', duration: '0:41', date: dateLabel(365) },
    { name: MINA, dir: 'in', time: '18:02', duration: '4:12', date: dateLabel(374) },
    { name: MINA, dir: 'out', time: '20:00', duration: '2:31', date: dateLabel(392) },
    { name: MINA, dir: 'in', time: '19:30', duration: '6:05', date: dateLabel(403) },
  ];
}
const CALL_314 = 6;

export const phone: Script = async (d) => {
  if (!iv() && !flag('i3_tel_vu')) {
    d.set('i3_tel_vu');
    await d.say(['Ton téléphone. 4h06.', 'En haut de la liste, une conversation épinglée. Un petit cadenas à côté.']);
  }
  const tab = !iv() && flag('i3_reply') && !flag('i3_appel') ? 'calls' : 'messages';
  const ph = PhoneScene.home({ clock: PHONE_CLOCK[phase()]!, contacts: contacts(), calls: calls(), tab });
  if (tab === 'calls') await callLogSeen(d, ph);
  for (;;) {
    const ev = await ph.browse();
    if (ev.kind === 'close') break;
    if (ev.kind === 'locked' && ev.id === 'mina') await unlockMina(d, ph);
    else if (ev.kind === 'open') await openedThread(d, ph, ev.id);
    else if (ev.kind === 'tab' && ev.tab === 'calls') await callLogSeen(d, ph);
    else if (ev.kind === 'call') await callTapped(d, ev.index);
  }
  await ph.close();
  if (!iv() && flag('i3_reply') && !flag('i3_appel')) await d.say('Tu poses le téléphone. Il reste un onglet que tu n\'as pas regardé.');
  await maybeOpenDoor(d);
};

async function unlockMina(d: Director, ph: PhoneScene): Promise<void> {
  await d.say(['Le cadenas. C\'est toi qui l\'as mis, il y a trois mois.', 'Pour ne plus l\'ouvrir. Pour ne plus l\'ouvrir par erreur, la nuit.']);
  const r = await d.ask('Ton pouce reste au-dessus.', ['Déverrouiller', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Pas maintenant.');
    return;
  }
  d.sfx('select', { pitch: 0.8 });
  ph.setLocked('mina', false);
  ph.showThread('mina');
  await openedThread(d, ph, 'mina');
}

async function openedThread(d: Director, ph: PhoneScene, id: string): Promise<void> {
  if (id === 'leo' && !flag('i3_leo')) {
    d.set('i3_leo');
    await d.wait(20);
    await d.say(['Léo. Il t\'envoie un mouton par semaine.', 'Tu n\'as répondu qu\'une fois. Pour lui dire d\'arrêter.']);
    await d.say('« jamais »');
    await d.say(['Tu souris. Un peu.', 'Dans le noir, ça ne compte pas.']);
    return;
  }
  if (id === 'maman' && nth('fil_maman') === 0) {
    await d.wait(20);
    await d.say(['Le fil de Maman.', 'Le dernier message, c\'est son message vocal. Tu ne le réécoutes pas.']);
    return;
  }
  if (id !== 'mina') return;
  if (iv()) {
    if (G.state.flags.i3_reply === 'pardon' && !flag('i4_tel')) {
      d.set('i4_tel');
      await d.wait(30);
      await d.say('« Lu », sous ton message.');
      ph.typing(true);
      await d.wait(110);
      ph.typing(false);
      await d.wait(50);
      await d.say(['Quelqu\'un a commencé à écrire.', 'Puis plus rien.']);
    }
    return;
  }
  if (flag('i3_tel')) return;
  d.set('i3_tel');
  await d.wait(30);
  await d.say(['Le fil s\'ouvre tout en bas.', 'Le dernier message n\'est pas de toi.']);
  await d.say(['Au-dessus, des « bonne nuit ». Un par soir.', 'Tous « Distribué ».']);
  await d.say('Tu as écrit tous les soirs. Pendant neuf mois.');
  await d.say(['Et puis, il y a trois mois, quelqu\'un a répondu.', 'Ce n\'était pas elle.']);
  await d.say('…', 'noa:sad');
  await d.wait(20);
  const pick = REPLIES[await ph.choose('Répondre :', REPLIES)]!;
  d.set('i3_reply', pick.id);
  if (pick.id === 'rien') {
    await d.wait(30);
    await d.say(['Tu ne réponds pas.', 'Le petit trait clignote dans le champ vide. Longtemps.']);
  } else {
    ph.add({ from: 'info', text: dateLabel(0) });
    ph.add({ from: 'me', text: pick.text, status: 'Envoi…' });
    await d.wait(50);
    ph.status('Distribué');
    await d.wait(60);
    if (pick.id === 'pardon') await d.say(['« C\'était. »', 'Tu l\'as écrit au passé. C\'est la première fois que tu l\'écris au passé.']);
    else await d.say(['Tu l\'as envoyé quand même.', 'Elle avait demandé d\'arrêter. Tu sais.', 'Mais ça fait un an, cette nuit. Juste une fois.']);
  }
  await d.say('En bas de l\'écran, il y a un autre onglet. « Appels ».');
}

async function callLogSeen(d: Director, ph: PhoneScene): Promise<void> {
  if (iv() || flag('i3_appel')) return;
  d.set('i3_appel');
  ph.focusCall(CALL_314);
  await d.wait(40);
  d.sfx('buzz', { vol: 0.25, pitch: 0.8 });
  await d.wait(30);
  await d.say(['Mina 🐑. Entrant. 3h14. 0:41.', 'Il y a un an. Cette nuit-là.']);
  await d.wait(20);
  await d.say('Tu ne te souviens pas de cet appel.');
}

async function callTapped(d: Director, index: number): Promise<void> {
  const c = calls()[index];
  if (!c) return;
  if (index === CALL_314) {
    const n = num('i3_appel_n');
    d.set('i3_appel_n', n + 1);
    if (n === 0) await d.say(['Quarante et une secondes.', 'Tu dormais.']);
    else if (n === 1) {
      fx.pulseGlitch(5);
      await d.say('Tu dormais. Tu dormais forcément.');
    } else await d.say('…', 'noa:sad');
    return;
  }
  if (c.name === MINA) await d.say(['Mina. Elle t\'appelait, de là-bas.', 'Elle racontait tout. Les pingouins de Nadia, la purée, le monsieur du couloir qui chantait faux.']);
  else if (c.dir === 'missed' && c.name === 'Maman') await d.say(['Maman. Tu n\'as pas décroché.', 'Elle laisse toujours sonner jusqu\'au bout.']);
  else if (c.name === 'Léo') await d.say('Léo. Une fois. Tu n\'as pas rappelé.');
  else await d.say('Maman. Douze secondes. « Tu as mangé ? » « Oui. »');
}

// --- The photo (the narrator gives in) --------------------------------------------------------------------------------

export const photo: Script = async (d) => {
  if (iv()) {
    await d.say(['La photo, face contre le sol. Tu l\'as reposée comme ça.', 'Comme ça, le trou ne se voit pas.']);
    return;
  }
  if (flag('i3_photo')) {
    await d.say('Le cadre, face contre le sol. Tu sais ce qu\'il y a dessous, maintenant.');
    return;
  }
  const n = num('i3_photo_essais');
  d.set('i3_photo_essais', n + 1);
  if (n === 0) {
    await d.say(['Un cadre photo, posé face contre le sol.', 'Tu ne le retournes pas.']);
    return;
  }
  if (n === 1) {
    await d.say('…');
    return;
  }
  d.set('i3_photo');
  await d.say('Tu le retournes.');
  d.sfx('glitch', { vol: 0.3 });
  fx.pulseGlitch(8);
  await d.wait(20);
  await d.image('photo_decoupee', ['Maman. Mina, avec sa couronne en papier.', 'À ta place, un trou. Les bords sont nets. Bien droits.', 'Aux ciseaux.']);
  await d.wait(20);
  await d.say('…', 'noa:sad');
  await d.say(['Quelqu\'un a pris son temps. Quelqu\'un a été soigneux.', 'Le petit morceau découpé n\'est pas là.']);
  await d.say('Tu sais où il est. Tu ne sais pas comment tu le sais.');
  await maybeOpenDoor(d);
};

/** After the call log and the photo, the bedroom door opens on the dark hallway. A draught. Surely. */
async function maybeOpenDoor(d: Director): Promise<void> {
  if (iv() || flag('i3_porte') || !flag('i3_appel') || !flag('i3_photo')) return;
  d.set('i3_porte');
  await d.wait(50);
  d.sfx('door', { pitch: 0.55, vol: 0.5 });
  showDoorOpen(d);
  await d.wait(30);
  await d.emote('player', '!');
  await d.say(['Derrière toi, un grincement.', 'La porte de ta chambre s\'est ouverte. Toute seule.']);
  await d.say('Un courant d\'air. La fenêtre de la cuisine ferme mal. Sûrement.');
}

function showDoorOpen(d: Director): void {
  if (d.find('porte_ouverte_h')) return;
  const top = d.spawn({ id: 'porte_ouverte_h', sprite: 't_r_door_open_top', x: 8, y: 1, solid: false, shadow: false });
  const bot = d.spawn({ id: 'porte_ouverte_b', sprite: 't_r_door_open', x: 8, y: 2, solid: false, shadow: false });
  top.layer = -1;
  bot.layer = -1;
}

export const chambreDoor: Script = async (d) => {
  if (!iv() && !flag('i3_porte')) {
    await d.say(nth('porte') === 0 ? ['La poignée est froide.', 'Tu n\'as pas envie de sortir. Pas encore.'] : 'Pas encore.');
    return;
  }
  if (iv() && !flag('i4_armoire')) {
    await d.say(['Tu ne sors pas.', 'L\'armoire est ouverte, derrière toi. Tu n\'aimes pas tourner le dos à une armoire ouverte.']);
    return;
  }
  await d.warp('appartement_tard', 'noa', { sfx: 'door' });
};

// --- The rest of the bedroom ----------------------------------------------------------------------------------------

export const calendar = look(
  'calendrier',
  [
    ['Le calendrier de l\'année dernière. Tu ne l\'as jamais tourné.', 'Des cases entourées, puis barrées. Des ratures, des ratures.'],
    'Tu ne le regardes pas plus longtemps.',
  ],
  [
    ['Le calendrier. Quelques jours avant la fin du mois, ton écriture :', '« elle va mieux !! »'],
    ['Deux points d\'exclamation.', 'Tu y croyais.'],
  ],
);

export const desk: Script = async (d) => {
  if (iv()) {
    if (!flag('i4_tiroir')) {
      d.set('i4_tiroir');
      await d.say(['Le tiroir de ton bureau est entrouvert. D\'un doigt.', 'Dans la fente, des petits morceaux de papier glacé, découpés en rond.']);
      const r = await d.ask('Regarder ?', ['Regarder', 'Refermer'], undefined, { cancelIndex: 1 });
      if (r === 0) {
        await d.say(['Un œil. Un œil marron, un peu plissé, comme quand on rit.', 'Le tien.']);
        await d.wait(20);
        await d.say('Et quelque chose de métallique, tout au fond, qui fait un petit bruit.');
      }
      d.sfx('door', { pitch: 1.6, vol: 0.2 });
      await d.say('Tu refermes le tiroir. Doucement. Comme une porte de chambre.');
      return;
    }
    await d.say(['Les bâtons dans la marge de ton cahier, par paquets de cinq.', 'Tu sais ce que tu comptais, maintenant. Tu fais semblant de ne pas savoir.']);
    return;
  }
  const n = nth('bureau');
  if (n === 0) {
    await d.say(['Ton bureau. Tes cahiers.', 'Dans la marge du dernier, des bâtons, par paquets de cinq. Des pages entières.', 'Tu ne sais plus ce que tu comptais.']);
    return;
  }
  await d.say(['Le tiroir de droite est fermé.', 'Tu sais ce qu\'il y a dedans.']);
  if (flag('i3_photo')) {
    await d.say(['Le petit morceau de photo est là-dedans. Avec les autres.', 'Tu ne l\'ouvres pas.']);
    return;
  }
  const r = await d.ask('L\'ouvrir ?', ['Ouvrir', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r === 0) await d.say('Tu ne peux pas.');
};

export const chair = look(
  'chaise',
  [
    ['Ton casque, posé sur la chaise.', 'Le fil est enroulé autour, si serré qu\'il a fendu le plastique.'],
    ['Tu le mets tous les soirs.', 'Pour ne plus rien entendre.'],
    ['Dans la poche de ton sweat, roulé en boule sur la chaise : un masque en papier, plié en quatre.', 'Un masque d\'hôpital. Tu ne sais pas ce qu\'il fait là.'],
    'Ton casque. Ton sweat. Tu n\'y touches pas.',
  ],
  [['Le casque.', 'Le fil a laissé des marques dans le plastique. Des petites marques, comme des dents.'], 'Tu ne le mets pas. Cette nuit, tu écoutes.'],
);

export const poster = look(
  'poster',
  [['Le système solaire. Pluton, toute seule au bout.', 'Quelqu\'un l\'a entourée au crayon. Plusieurs fois. Très fort.'], 'Mina disait que Pluton était triste d\'être toute seule au bout.'],
  [
    ['Pluton n\'est plus sur le poster.', 'À sa place, un petit trou rond. Bien net.'],
    ['Aux ciseaux.', 'Ce n\'est plus une planète, de toute façon. Mina trouvait ça injuste.'],
  ],
);

export const shelf = look(
  'etagere',
  [
    ['Tes livres. L\'atlas des étoiles est ouvert, à la page de la Lune.', 'Tu ne l\'as pas ouvert. Tu ne l\'ouvres plus.'],
    ['La boîte à dessins de Mina, sur l\'étagère du bas.', 'Le couvercle est fermé au scotch. Plusieurs couches de scotch.'],
  ],
  [
    ['Un de tes livres est rangé à l\'envers. Tu le remets à l\'endroit.', 'Tu te retournes. Il est à l\'envers.'],
    'Tu as mal regardé. Il est tard. Il est très tard.',
  ],
);

export const clock = look(
  'horloge',
  [['4h06.', 'La trotteuse avance. Elle, au moins.'], '4h07. Le temps passe. Lentement, mais il passe.'],
  [['4h44.', 'Trois fois le même chiffre.'], '4h45. Encore une minute. Tu les comptes, maintenant.'],
);

export const closet: Script = async (d) => {
  if (!iv()) {
    const n = nth('armoire');
    if (n === 0) {
      await d.say(['Ton armoire. Fermée. Tu n\'aimes pas la laisser ouverte la nuit.', 'Mina disait qu\'un monstre vivait dedans.']);
      if (G.state.flags.c1_placard_spared) await d.say('Tu espères qu\'il va bien, le monstre.');
      await d.say('Tu vérifies quand même que la porte est bien fermée. Elle l\'est.');
    } else await d.say('Fermée. Tu as vérifié.');
    return;
  }
  if (!flag('i4_armoire')) {
    d.set('i4_armoire');
    await d.say(['L\'armoire est ouverte.', 'Tu l\'avais fermée. Tu en es sûr. Tu avais vérifié.']);
    await d.say(['Les cintres se balancent encore un peu,', 'comme si quelqu\'un venait de passer entre eux.']);
    await d.say('Il n\'y a pas de courant d\'air.');
    await d.say(['Des choses sont tombées par terre, devant.', 'Ou quelqu\'un les a sorties.']);
    return;
  }
  await d.say(
    nth('armoire') % 2 === 0
      ? ['Le noir, dans l\'armoire.', 'Tu ne la refermes pas. Tu ne veux pas toucher la porte.']
      : ['Tes pulls. Ton manteau d\'hiver. Le noir entre les deux.', 'Rien ne bouge. Rien ne bouge.'],
  );
};

export const trash = look(
  'corbeille',
  [['La corbeille. Des mouchoirs. Beaucoup.', 'Et le dessin froissé que tu n\'arrives pas à jeter.'], 'Tu ne le défroisses pas.'],
  [['Dans la corbeille, sur les mouchoirs : des petits bouts de coton gris.', 'Tu ne te souviens pas de les avoir jetés.']],
);

export const plant: Script = async (d) => {
  if (!iv()) {
    await d.say(['La plante a soif. La terre est fendue.', 'Toi aussi, tu as soif. Tu ne bouges pas.']);
    return;
  }
  if (!flag('i4_plante')) {
    d.set('i4_plante');
    await d.say(['Une feuille est tombée. Toute sèche, toute recroquevillée.', 'Tu verses le fond de ton verre d\'eau dans le pot.']);
    await d.say('Pour qu\'il se passe au moins une chose bien, cette nuit.');
    return;
  }
  await d.say('La terre a bu. Elle est plus foncée. C\'est déjà ça.');
};

export const radiator: Script = async (d) => {
  if (iv() && flag('i4_coups')) {
    await d.say(['Le radiateur. Le tuyau est encore un peu tiède.', 'Il cogne quand il refroidit. C\'est tout.', 'C\'est tout.']);
    return;
  }
  const n = nth('radiateur');
  if (n === 0) {
    d.sfx('pipe', { vol: 0.4 });
    await d.say(['Le vieux radiateur. Son tuyau monte dans le mur, vers la chambre de Mina.', 'La nuit, il cogne en refroidissant. Toc. Toc.']);
    await d.say('On dirait quelqu\'un.');
    return;
  }
  await d.say(iv() ? 'Le radiateur est tiède. Il fait tic, de temps en temps. Comme une horloge.' : 'Le radiateur. Tu poses la main dessus. Il est tiède. Il est normal.');
};

export const wall: Script = async (d) => {
  if (iv() && flag('i4_coups')) {
    await d.say(['Tu poses le front contre le mur. Il est froid.', 'Tu attends.', 'Rien.']);
    return;
  }
  if (nth('mur') === 0) {
    await d.say(['Le mur, au-dessus de ton oreiller. De l\'autre côté, la chambre de Mina.', 'À hauteur d\'oreiller, la peinture est usée.', 'Une tache plus claire, ronde. De la taille d\'un poing.']);
  }
  const r = await d.ask('Poser la main ?', ['Poser la main', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  await d.say(['Tu poses la main à plat sur le mur.', 'Il est froid. De l\'autre côté, rien ne bouge.']);
  await d.say('…', 'noa:sad');
};

// ---------------------------------------------------------------------------------------------------------------------
// The apartment at night (both interludes)
// ---------------------------------------------------------------------------------------------------------------------

export const appartEnter: Script = async (d) => {
  world.extraDarkness = 0.05;
  d.music(null);
  d.ambience('hum');
  startAmbient('appartement_tard', flatSounds, 500, 1300);
  if (!iv() && !flag('i3_couloir')) {
    d.set('i3_couloir');
    await d.wait(20);
    await d.say(['Le couloir. Il a la bonne longueur, cette fois.', 'C\'est presque pire.']);
    await d.say('Au fond, près de l\'entrée, la porte du placard est entrouverte.');
  } else if (iv() && !flag('i4_couloir')) {
    d.set('i4_couloir');
    await d.wait(20);
    await d.say(['Le couloir. 4h44.', 'Quelque chose a changé, et tu ne sais pas quoi.']);
    await d.wait(20);
    await d.say(['Si. Tu sais.', 'La porte de Maman est entrouverte.']);
  }
};

export const hallCupboard: Script = async (d) => {
  if (iv()) {
    await d.say(['Le placard de l\'entrée. Fermé.', 'Le sac est dedans. Tu as tout remis, dans l\'ordre. Comme si personne n\'y avait touché.', 'Comme Maman.']);
    return;
  }
  if (flag('i3_sac')) {
    await d.say('Le placard. Le sac est dedans. Tu as tout remis. Dans l\'ordre.');
    return;
  }
  if (!flag('i3_placard')) {
    d.set('i3_placard');
    await d.say(['Le placard de l\'entrée est entrouvert. Il ne l\'était pas.', 'Dedans, les manteaux d\'hiver. Ça sent la naphtaline et la poussière.']);
    await d.say(['Derrière les manteaux, par terre, un sac de sport bleu marine.', 'Une étiquette pend à la poignée. L\'écriture de Maman :']);
    await d.say('{c:y}« Affaires de Mina — Pédiatrie 3e — ch. 304 »{/c}');
    await d.say(['Il n\'a jamais été défait.', 'Un an. Il n\'a jamais été défait.']);
  }
  if (!flag('i3_sac_ouvert')) {
    const r = await d.ask('Ouvrir le sac ?', ['Ouvrir', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r !== 0) {
      await d.say('Tu laisses le sac dans le noir. Il ne bouge pas.');
      return;
    }
    d.set('i3_sac_ouvert');
    showBag(d);
    d.sfx('thread', { pitch: 1.7, vol: 0.6 });
    await d.wait(30);
    await d.say(['Tu tires le sac dehors. La fermeture éclair.', 'Elle fait un bruit énorme, dans le silence.']);
  }
  await bag(d);
};

export function showBag(d: Director): void {
  if (!d.find('sac')) d.spawn({ id: 'sac', sprite: 'prop_sac_hopital_ouvert', x: 4, y: 4, solid: false, script: bag });
}

const BAG_ITEMS: Array<{ id: string; label: string }> = [
  { id: 'couronne', label: 'La couronne' },
  { id: 'chaussons', label: 'Les chaussons' },
  { id: 'bracelet', label: 'Le bracelet' },
  { id: 'telephone', label: 'Le téléphone' },
];

/** What is in the bag, item by item; the polaroid lies at the very bottom (T2). */
export const bag: Script = async (d) => {
  if (flag('i3_sac')) {
    await d.say('Le sac. Tu as tout remis. Dans l\'ordre.');
    return;
  }
  for (;;) {
    const left = BAG_ITEMS.filter((it) => !flag(`i3_sac_${it.id}`));
    const seen = BAG_ITEMS.length - left.length;
    const options = [...left.map((it) => it.label), ...(seen >= 2 ? ['Tout au fond'] : []), 'Refermer'];
    const i = await d.ask('Dans le sac :', options, undefined, { cancelIndex: options.length - 1 });
    const label = options[i];
    if (label === 'Refermer') {
      await d.say('Tu laisses le sac ouvert, par terre. Tu reviendras. Tu crois.');
      return;
    }
    if (label === 'Tout au fond') {
      await polaroid(d);
      return;
    }
    const item = left.find((it) => it.label === label);
    if (item) await bagItem(d, item.id);
  }
};

async function bagItem(d: Director, id: string): Promise<void> {
  d.set(`i3_sac_${id}`);
  if (id === 'couronne') {
    await d.say(['Sa couronne en papier. Aplatie, pliée en deux pour tenir dans le sac.', 'À l\'intérieur, au feutre violet :']);
    await d.say('{c:y}« PRINCESSE-CHEVALIÈRE MINA 1re, REINE DES MOUTONS ET DES FRITES »{/c}');
    await d.say(['Un coin est mâchouillé.', 'Elle mâchouillait tout, quand elle s\'ennuyait.']);
    await d.say('Tu souris. Tu ne voulais pas.');
  } else if (id === 'chaussons') {
    await d.say(['Ses chaussons. Deux moutons, avec des oreilles qui pendent.', 'Ils n\'ont presque pas servi.']);
    await d.say(['Au fond de l\'un d\'eux, un peu de sable.', 'Le sable de la plage. L\'été d\'avant.']);
  } else if (id === 'bracelet') {
    await d.say(['Un bracelet d\'hôpital, en plastique blanc.', '{c:g}« MINA — PÉD. 3 — CH. 304 »{/c}']);
    await d.say(['Il est tout petit.', 'Il ferait à peine le tour de ton poignet.']);
    await d.say('…', 'noa:sad');
  } else if (id === 'telephone') {
    await d.say(['Le vieux téléphone de Maman. Celui qu\'elle avait laissé à Mina, là-bas.', 'La coque est couverte d\'autocollants de moutons.']);
    await d.say('Il est éteint. Il n\'y a pas de chargeur.');
    const r = await d.ask('L\'allumer ?', ['Appuyer', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r === 0) {
      d.sfx('select', { pitch: 0.6, vol: 0.4 });
      await d.wait(30);
      await d.say(['Tu appuies. Rien.', 'Dans l\'écran noir, ton reflet.']);
      await d.say('Tu clignes des yeux. Lui, un tout petit peu après.');
    }
  }
}

async function polaroid(d: Director): Promise<void> {
  d.set('i3_sac');
  await d.say(['Tout au fond, glissé contre la doublure, un carré de papier glacé.', 'Un polaroïd.']);
  d.music(null);
  audio.setAmbience('none');
  await d.wait(30);
  void lullaby(d, 7, 1.4);
  await d.image('polaroid_dodo', ['Dodo, sur un oreiller d\'hôpital. Une main de garçon posée sur lui.', 'Dessous, l\'écriture de Maman :', '« Noa prête Dodo à Mina. "Il veillera sur toi." »']);
  await d.wait(40);
  await d.say('… C\'était moi.', 'noa:sad');
  await d.wait(30);
  await d.say(['Il veillera sur toi.', 'C\'est toi qui l\'as dit. En premier.']);
  await d.wait(20);
  await d.say(['Dodo est revenu, après. Tu ne sais plus comment.', 'Un matin, il était dans le couloir. Assis contre ta porte.', 'Comme s\'il attendait qu\'on lui ouvre.']);
  d.ambience('hum');
  await d.wait(20);
  await d.say(['Tu remets tout dans le sac. Dans l\'ordre.', 'La couronne, les chaussons, le bracelet, le téléphone. Le polaroïd, tout au fond.']);
  d.remove('sac');
  d.sfx('door', { pitch: 1.3, vol: 0.3 });
  await d.say('Tu as froid, tout à coup. Ton lit t\'attend.');
}

// --- Hallway, living room, kitchen --------------------------------------------------------------------------------

export const coat = look(
  'manteau',
  [['Le portemanteau. Ton blouson.', 'Le crochet du bas est vide. Au-dessus, des lettres autocollantes : M, I, N, A.']],
  [['Le crochet vide. M, I, N, A.', 'Le A se décolle. Tu le recolles avec le pouce. Il se décolle.']],
);

export const shoes = look('chaussures', [['Tes baskets. Les lacets sont noués.', 'Tu ne les as pas défaits depuis des semaines. Tu les enfiles comme des chaussons.']]);

export const frontDoor = look(
  'entree',
  [['La porte d\'entrée. Le verrou est tiré. La chaîne est mise.', 'Dehors, la ville dort. Toi, non.']],
  [['La porte d\'entrée.', 'Maman rentrera par là. Bientôt. Pas encore.']],
);

export const familyPhoto: Script = async (d) => {
  if (flag('i3_photo')) {
    await d.say(['L\'étagère du couloir. La même photo que dans ta chambre.', 'Celle-ci est entière.']);
    await d.image('photo_famille', iv() ? ['Vous trois. Entiers.'] : ['Maman, toi, et Mina avec sa couronne en papier.', 'Ici, tu as encore ton visage.']);
    return;
  }
  await d.say(['L\'étagère du couloir. Le cadre est revenu.', 'Une photo de famille. Tu ne regardes pas trop longtemps.']);
};

export const babyPhoto = look(
  'photo_bebe',
  [
    ['Une petite photo au mur, dans un cadre en bois.', 'Un petit garçon serre un mouton blanc plus gros que lui. Il n\'a pas l\'air de vouloir le lâcher.'],
    'Tu ne te souviens pas de cette photo.',
  ],
  [['Le petit garçon et son mouton. Trois ans, peut-être.', 'Il l\'avait appelé Dodo. « Pour faire dodo. »'], 'Tu ne te souviens pas de cette photo. Tu te souviens de ce mouton.'],
);

export const hallClock = look(
  'horloge_couloir',
  [['L\'horloge du couloir indique 4h16.', 'Elle avance de dix minutes. Personne ne l\'a jamais remise à l\'heure.']],
  [['L\'horloge du couloir indique 4h54.', 'Dix minutes d\'avance. Dans six minutes, sur cette horloge, il sera cinq heures.']],
);

export const beachPicture = look(
  'plage',
  [
    ['Le tableau de la plage. L\'été d\'avant.', 'Tu ne l\'avais jamais remarqué : sur une serviette, dans un coin, quelqu\'un dort.'],
    ['Elle dormait tout le temps, cet été-là.', 'Tu te moquais d\'elle. « T\'es nulle, tu dors tout le temps. »'],
  ],
  [['La plage. Quarante-deux coquillages.', 'Elle les avait comptés deux fois, pour être sûre.']],
);

export const minaDoor = look(
  'porte_mina',
  [['La pancarte : « CHAMBRE DE MINA — DÉFENSE D\'ENTRER (sauf Noa) ».', 'Fermée à clé. La clé est quelque part. Tu ne sais plus où.']],
  [['La porte de Mina. Fermée à clé.', 'La clé est dans ton tiroir. Tu l\'as toujours su.']],
);

export const bathroomDoor = look(
  'sdb',
  [['La salle de bain. Tu n\'allumes pas.', 'Tu n\'as pas envie de croiser ton reflet.']],
  [['La salle de bain. Le robinet goutte.', 'Tu le fermes. Il goutte.']],
);

export const mamanDoor: Script = async (d) => {
  if (!iv()) {
    await d.say(nth('porte_maman') === 0 ? ['La chambre de Maman. Fermée.', 'Tu n\'y entres jamais. Pas une fois, cette année.'] : 'Fermée. Pas à clé. Juste fermée.');
    return;
  }
  if (!flag('i4_maman')) await d.say(['La porte de Maman est entrouverte.', 'Elle n\'a jamais été fermée à clé.']);
  const r = await d.ask('Entrer ?', ['Entrer', 'Attendre'], undefined, { cancelIndex: 1 });
  if (r === 0) await d.warp('chambre_maman', 'door', { sfx: 'door' });
};

export const hallPlant = look(
  'plante_couloir',
  [['La plante du couloir. Ses feuilles sont par terre.', 'Personne ne les a ramassées.']],
  [['Tu ramasses les feuilles, une par une.', 'Tu ne sais pas où les mettre. Tu les gardes dans ta main.']],
);

export const tv = look(
  'tele',
  [['La télé, éteinte. Pas de neige, cette fois.', 'Dans l\'écran noir, ton reflet, tout petit. Derrière toi, le couloir.'], 'Rien, derrière toi.'],
  [['La télé. La prise est débranchée.', 'Tu ne te souviens pas de l\'avoir fait.']],
);

export const sofa = look(
  'canape',
  [['Le canapé. Un plaid plié, du côté de Maman.', 'Elle dort là, parfois, quand elle rentre trop fatiguée pour aller jusqu\'à son lit.']],
  [['Tu t\'assois une minute à sa place.', 'Le creux est trop grand pour toi.']],
);

export const lamp = look('lampadaire', [['Le lampadaire. Tu ne l\'allumes pas.', 'Tu ne veux pas voir l\'appartement en entier.']]);

export const toybox = look(
  'coffre',
  [['Le coffre à jouets de Mina, fermé au scotch.', 'Le scotch a été décollé, puis recollé. Pas par toi.']],
  [['Le coffre. Tu ne le rouvres pas.', 'Il y a des choses qu\'on garde fermées. Pour les autres.']],
);

export const fridge: Script = async (d) => {
  if (!iv()) {
    await d.say(['Le frigo bourdonne. Le mot de Maman est toujours là, sous l\'aimant fraise.', '« Mange quelque chose s\'il te plaît. Je t\'aime. »']);
    return;
  }
  if (flag('i4_mot')) {
    await d.say(['Le mot est revenu sous l\'aimant fraise.', 'Côté pâtes.']);
    return;
  }
  if (!flag('i4_mot_pris')) {
    await d.say(['Le mot de Maman, sous l\'aimant fraise.', 'Par transparence, il y a quelque chose, au dos. Des lignes serrées.']);
    const r = await d.ask('Le décrocher ?', ['Le décrocher', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    d.set('i4_mot_pris');
    d.sfx('pop', { pitch: 0.7, vol: 0.4 });
    await d.say(['Tu décroches le mot. Tu le retournes.', 'Au dos, quelque chose a été écrit, puis raturé. Beaucoup raturé.']);
    await d.say(['Il fait trop sombre pour lire.', 'La hotte, au-dessus de la gazinière, a une petite lumière.']);
    return;
  }
  await d.say('Le mot est dans ta main. Il faut de la lumière.');
};

export const stove: Script = async (d) => {
  if (iv() && flag('i4_mot_pris') && !flag('i4_mot')) {
    d.set('i4_mot');
    const s = world.entities.find((e) => e.id === 'gaziniere');
    if (s) s.light = { r: 34, color: '#fff0c0', dy: -18 };
    d.sfx('static', { vol: 0.15, pitch: 2 });
    await d.say(['Tu allumes la petite lumière de la hotte. Elle bourdonne.', 'Tu glisses le mot dessous. Les ratures deviennent transparentes.']);
    await d.paper(['Je sais que t—'], '');
    await d.say('La suite est déchirée.');
    await d.say('…', 'noa:surprised');
    await d.say(['Je sais que tu quoi ?', 'Tu retournes le mot dans tous les sens. Il ne dit rien de plus.']);
    if (s) s.light = undefined;
    await d.say(['Tu éteins la hotte.', 'Tu remets le mot sur le frigo. Côté pâtes.']);
    return;
  }
  await d.say(
    iv()
      ? 'La gazinière. La casserole retournée sur l\'égouttoir.'
      : ['La gazinière. La casserole a été lavée, retournée sur l\'égouttoir.', 'La hotte a une petite lumière. Elle grésille comme ta veilleuse.'],
  );
};

export const kitchenDrawings = look(
  'dessins_cuisine',
  [['Les dessins de Mina, au-dessus du plan de travail.', 'Le mouton qui fait du vélo. Le soleil à lunettes. Toi, avec des cheveux tout bleus.']],
  [['Le mouton à vélo n\'a pas de pédales.', 'Elle avait dit : « Il pédale avec son cœur. » Tu avais dit que c\'était débile.', 'Ça ne l\'est pas.']],
);

export const counter = look(
  'plan',
  [['Le plan de travail. Deux bols propres, retournés.', 'Il n\'y en a jamais trois.']],
  [['Une liste de courses, de l\'écriture de Maman :', '« pâtes, lait, yaourts (ceux qu\'il aime) »'], ['« Ceux qu\'il aime. »', 'Tu ne savais pas qu\'elle savait.']],
);

export const sink = look(
  'evier',
  [['L\'évier. Le robinet goutte. Plic. Plic.', 'Tu comptes sans le vouloir. Trente-neuf. Quarante. Quarante et un.'], 'Tu t\'arrêtes avant quarante-deux.'],
  [['Tu fermes le robinet plus fort.', 'Plic.']],
);

export const bills = look(
  'factures',
  [['Des factures, en pile bien droite.', 'Maman range tout. Surtout ce qui fait mal.']],
  [['Les factures. Tout en bas de la pile, une enveloppe de l\'hôpital.', 'Jamais ouverte. Elle aussi, elle laisse des choses fermées.']],
);

export const kitchenTable = look('table', [['La table. Trois chaises. Deux bols, ce matin.', 'Il est quatre heures et tu comptes encore les bols.']]);

export const kitchenChair = look('chaise_noa', [['Ta chaise.', 'Tu t\'assois rarement. Tu manges debout.']]);

export const minaChair = look('chaise_mina', [['La chaise de Mina. Le coussin garde un tout petit creux.', 'Personne ne s\'assoit dessus. Personne ne l\'enlève.']]);

export const kitchenTrash = look('poubelle', [['La poubelle de la cuisine. Elle sent un peu.', 'Tu la sortiras demain. Tu dis ça tous les jours.']]);

// ---------------------------------------------------------------------------------------------------------------------
// Interlude IV — « Le placard » (4:44)
// ---------------------------------------------------------------------------------------------------------------------

export async function interlude4(d: Director): Promise<void> {
  G.state.flags.interlude = REAL.i4;
  G.state.party = [];
  G.state.hp = maxHp(G.state);
  setPageTitle(null);
  d.load('chambre', 'bed');
  inBed(d, true);
  d.music(null);
  d.ambience('none');
  await d.wait(50);
  await d.narrate('Un fil rouge. Très long. Il se défait.');
  await d.wait(30);
  await d.narrate('4:44');
  audio.setAmbience('rain', 0.35);
  await d.fadeIn(90);
  await d.wait(30);
  inBed(d, false);
  d.sfx('step', { pitch: 0.6 });
  await d.say(['Tu te réveilles. Encore.', 'Le réveil affiche 4h44.']);
  await d.wait(30);
  d.sfx('door', { pitch: 0.45, vol: 0.4 });
  await d.wait(20);
  await d.say('L\'armoire est ouverte.');
  await d.say('Tu n\'aimes pas la laisser ouverte la nuit.');
  await d.say(['Par terre, des flocons de coton gris.', 'Une traînée. Du lit jusqu\'à l\'armoire.']);
}

export const cotton = look(
  'coton',
  [['Des petits flocons de coton gris.', 'Une traînée, du lit jusqu\'à l\'armoire.'], 'Comme des miettes. Pour retrouver le chemin.', 'Tu ne marches pas dessus.'],
);

export const shoebox: Script = async (d) => {
  if (flag('i4_mots')) {
    await d.say('Les mots du frigo, dans leur boîte. Tous là. Tu as compté.');
    return;
  }
  d.set('i4_mots');
  await d.say(['Une boîte à chaussures. Dedans, des petits papiers, aplatis, rangés par date.', 'Les mots du frigo.']);
  await d.say(['Tous ceux de Maman. Ceux de là-bas, quand elle dormait à l\'hôpital.', 'Un par soir. Tu les as tous gardés.']);
  await d.paper(
    [
      'Noa, mange quelque chose s\'il te plaît.',
      'Je t\'aime. — Maman',
      '',
      'Il y a des pâtes. Bisous sur ton front.',
      '',
      'Le chat des voisins passe par le balcon.',
      'Il s\'appelle Biscotte.',
      'Ne lui donne pas les pâtes.',
      '',
      'Tu dors ? Je rentre tard. Je t\'aime.',
    ],
    '',
  );
  await d.say('Quarante et un.');
  await d.say(['Biscotte.', 'Tu avais oublié Biscotte.']);
  await d.say('Tu souris dans le noir. Personne ne te voit. Ça compte quand même.');
};

export const nightlightBox: Script = async (d) => {
  if (flag('i4_boite')) {
    await d.say('La boîte de la veilleuse. « Pour Noa, 4 ans. »');
    return;
  }
  d.set('i4_boite');
  await d.say(['La boîte d\'origine de la veilleuse. Le carton est usé aux coins, scotché, rescotché.', 'Sur le côté, au feutre, l\'écriture de Maman :']);
  await d.say('{c:y}« Pour Noa, 4 ans — pour les monstres du placard »{/c}');
  await d.say('Pour Noa.');
  if (flag('c4_fele')) await d.say(['Sur la boîte, la lune est lisse.', 'La tienne, sur la table de nuit, est fêlée d\'un bord à l\'autre.']);
  await d.say(['Tu la lui avais donnée, après.', 'Quand elle a eu peur du noir, à son tour.']);
};

export const thermometer: Script = async (d) => {
  if (!flag('i4_thermo')) await d.say(['Un thermomètre digital.', 'Il était dans la poche de ton manteau d\'hiver. Il a dû tomber.']);
  const r = await d.ask('L\'allumer ?', ['Appuyer', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('i4_thermo');
  d.sfx('beep', { pitch: 1.6, vol: 0.5 });
  await d.wait(20);
  await d.say('{c:a}MEM 38,4{/c}');
  await d.say(['La dernière température qu\'il a gardée en mémoire.', '38,4.']);
  await d.say('Tu ne te souviens pas d\'avoir eu de la fièvre.');
};

/** Returning to the bedroom after Maman's room: one knock in Mina's wall. */
async function knocks(d: Director): Promise<void> {
  d.set('i4_coups');
  await d.wait(70);
  d.sfx('knock1', { vol: 0.9 });
  d.shake(1, 6);
  await d.wait(20);
  await d.say('Toc.');
  await d.say(['Un coup. Dans le mur, au-dessus de ton lit.', 'Le mur de Mina.']);
  await d.say(['Un coup, ça veut dire « t\'es là ? ».', 'C\'est toi qui as inventé le code. Tu avais neuf ans.']);
  await d.fadeOut(20);
  const scene = CountingScene.open('coups', [KNOCK_IV]);
  scene.announce(1);
  await d.fadeIn(20);
  await d.say('Écoute.');
  const r = await scene.play(1, 0);
  if (!r.ok) await d.say(['Le radiateur, d\'abord. Puis le mur.', 'Un seul coup. Dans le mur.']);
  const c = await d.ask('De l\'autre côté, on attend.', ['Répondre', 'Ne rien faire'], undefined, { cancelIndex: 1 });
  let answer: 'un' | 'deux' | 'trois' | 'rien' = 'rien';
  if (c === 0) {
    await d.say('Tu lèves la main vers le mur.');
    const n = await scene.answer();
    answer = n === 1 ? 'un' : n === 2 ? 'deux' : 'trois';
  }
  d.set('i4_knock', answer);
  await d.wait(20);
  await d.fadeOut(20);
  scene.close();
  await d.fadeIn(30);
  await d.wait(40);
  if (answer === 'deux') {
    await d.say(['Toc, toc.', '« Je suis là. »']);
    await d.wait(90);
    d.sfx('knock1', { vol: 0.7 });
    await d.wait(20);
    await d.say(['Un coup.', 'Encore « t\'es là ? ». Comme si elle n\'avait pas entendu.']);
    await d.say('Ou comme si elle te demandait autre chose.');
  } else if (answer === 'trois') {
    await d.say(['Toc, toc, toc.', '« Bonne nuit. »']);
    await d.wait(120);
    await d.say(['Silence. Un long silence.', 'Tu as dit bonne nuit. Elle t\'a laissé dormir.']);
  } else if (answer === 'un') {
    await d.say(['Toc.', 'Tu lui renvoies sa question.']);
    await d.wait(80);
    d.sfx('pipe', { vol: 0.5 });
    await d.wait(30);
    d.sfx('pipe', { vol: 0.45, pitch: 0.95 });
    await d.wait(20);
    await d.say(['Deux coups. Dans le tuyau du radiateur.', 'Le chauffage. Ce n\'est que le chauffage.']);
  } else {
    await d.say('Tu ne réponds pas.');
    await d.wait(100);
    d.sfx('knock1', { vol: 0.35, pitch: 0.9 });
    await d.wait(30);
    await d.say(['Toc.', 'Un autre coup. Plus faible.']);
    await d.wait(60);
    await d.say(['Puis plus rien.', 'Tu ne réponds pas. Tu n\'as jamais su répondre, la nuit.']);
  }
  await d.wait(30);
  d.sfx('pipe', { vol: 0.2, pitch: 0.8 });
  await d.say('Le radiateur cliquette en refroidissant.');
  await d.say(['Sur ton lit, Dodo a glissé de l\'oreiller.', 'Il est tombé sur le côté. Le dos tourné vers toi.']);
}

/** One radiator knock, then one knock in the wall (« t'es là ? »): count only the wall. */
const KNOCK_IV: SheepRound = { title: 'Le mur', interval: 84, window: 18, tolerance: 3, blind: false, seqs: [['B', 'S']] };

async function dodoIV(d: Director): Promise<void> {
  if (!flag('i4_coups')) {
    await d.say(['Dodo. Sa couture du dos a lâché.', 'Tu ne veux pas le regarder trop longtemps. Pas encore.']);
    return;
  }
  if (!flag('i4_dodo')) {
    d.set('i4_dodo');
    await d.say(['Dodo. Sa couture du dos a lâché pendant la nuit.', 'Il y a du coton partout. Sur le drap, sur l\'oreiller, par terre.']);
    await d.say(['Tu regardes tes mains.', 'Tu as du coton sous les ongles.']);
    await d.say('Tu ne te souviens pas d\'avoir fait ça.');
    await d.say('…', 'noa:sad');
    const r = await d.ask('Appuyer sur son ventre ?', ['Appuyer', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r === 0) {
      await pressBelly(d, true);
      await d.wait(30);
      await d.say(['La friture est plus lente que tout à l\'heure.', 'Comme quelqu\'un qui s\'endort.']);
    }
  }
  const r = await d.ask('{voice:dodo}Tu devrais dormir.', ['Dormir', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Tu ramasses un flocon de coton. Tu le remets dans le trou, tout doucement. Il ressort.');
    return;
  }
  d.set('i4_fin');
  inBed(d, true);
  await d.say(['Tu serres Dodo contre toi. Il est plus léger qu\'avant.', 'Il se vide un peu chaque nuit.']);
  // Chapter 5 « La Marée Blanche » (production lot 3) registers STORY.dream[5]; until then, the night stops here.
  if (STORY.dream[5]) {
    await enterDream(d, 5);
    return;
  }
  await d.fadeOut(90);
  await d.narrate('…');
}

// ---------------------------------------------------------------------------------------------------------------------
// Maman's room (Interlude IV)
// ---------------------------------------------------------------------------------------------------------------------

export const mamanRoomEnter: Script = async (d) => {
  world.extraDarkness = 0.12;
  d.music(null);
  d.ambience('none');
  startAmbient('chambre_maman', () => {
    if (!flag('i4_pile')) audio.sfx('tooth', { vol: 0.08, pitch: 2.2 });
  }, 58, 62);
  if (!flag('i4_maman')) {
    d.set('i4_maman');
    await d.wait(20);
    await d.say(['La chambre de Maman. Ça sent sa crème pour les mains, et la lessive.', 'Les volets sont fermés. Elle dort le jour, maintenant.']);
    await d.say('Quelque part, un réveil fait tic, tac.');
  }
};

export const mamanBed = look('lit_maman', [
  ['Le lit de Maman, défait. Les draps sont froids.', 'Sur l\'autre oreiller, un petit pyjama plié. Des étoiles jaunes.'],
  ['Elle dort avec.', 'Tu ne savais pas.'],
  'Le creux, d\'un seul côté du lit.',
]);

export const alarmClock: Script = async (d) => {
  if (!flag('i4_reveil')) {
    d.set('i4_reveil');
    await d.say(['Son vieux réveil. Celui qui sonne comme une casserole.', 'Il est réglé sur 5h.']);
    await d.say('Un post-it jaune est collé dessus. Son écriture, penchée, pressée :');
    await d.paper(['5h — veilleuse', '(chambre de Noa)'], '');
    await d.wait(20);
    await d.say(['Cinq heures. Elle allait venir la chercher.', 'Dans ta chambre.']);
    await d.say('Elle savait où elle était.');
    await d.say('…', 'noa:sad');
  } else if (flag('i4_pile')) {
    await d.say(['Le réveil arrêté. 5h, pour toujours.', 'Le post-it : « 5h — veilleuse (chambre de Noa) ».']);
    return;
  } else {
    await d.say(['Le réveil, réglé sur 5h.', 'Tic. Tac. Il attend cinq heures. Il attend depuis un an.']);
  }
  const r = await d.ask('Prendre la pile ?', ['Prendre la pile', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Tu le laisses. Il fait tic. Il fait tac.');
    return;
  }
  d.set('i4_pile');
  const e = world.entities.find((x) => x.id === 'reveil');
  if (e) {
    e.frames = undefined;
    e.sprite = 'prop_reveil_vieux';
  }
  d.sfx('tooth', { pitch: 0.7, vol: 0.5 });
  await d.say('Tu ouvres le petit capot. La pile glisse dans ta paume. Elle est tiède.');
  await d.wait(30);
  await d.say(['Le réveil s\'arrête.', 'Il n\'a jamais sonné, de toute façon.']);
};

export const mirror: Script = async (d) => {
  if (!flag('i4_dessin')) {
    d.set('i4_dessin');
    await d.say('Un dessin est scotché dans le coin du miroir.');
    await d.image('dessin_chut', ['Une petite fille, un doigt sur la bouche.', '« MAMAN TU DIS PAS A NOA. PROMIS. »']);
    await d.wait(20);
    await d.say('…', 'noa:surprised');
    await d.say(['Tu ne sais pas ce qu\'on t\'a caché.', 'Tu n\'as pas envie de savoir. Tu crois.']);
    return;
  }
  await d.say(['Dans le miroir, derrière le dessin, ton reflet.', 'Il a les yeux ouverts. Cette fois.']);
};

export const dresser: Script = async (d) => {
  if (flag('i4_lettre')) {
    await d.say('Le tiroir de la commode, entrouvert. Tu n\'y retouches pas.');
    return;
  }
  await d.say(['Sa commode. Le tiroir du haut est entrouvert.', 'Des papiers, des enveloppes, rangés bien droit.']);
  const r = await d.ask('Regarder ?', ['Regarder', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('i4_lettre');
  await d.say(['Des papiers de l\'hôpital, dans une chemise bleue. Tu ne l\'ouvres pas.', 'Et une lettre de l\'opérateur téléphonique, au nom de Maman :']);
  await d.paper(['Confirmation de résiliation', 'de votre ligne secondaire', '06 •• •• •• 14'], '');
  await d.say(['La lettre date d\'il y a trois mois.', 'Trois mois.']);
  await d.say('…', 'noa:sad');
  await d.say('Elle ne t\'a rien dit.');
};

export const sewingBox = look('couture', [
  ['Sa boîte à couture. Des bobines de fil rouge. Beaucoup de fil rouge.', 'Et un découd-vite : la petite fourche pointue qui sert à défaire les coutures.'],
  ['Le même rouge que les gros points', 'sur le ventre de Dodo.'],
  'Tu n\'y touches pas. Ça pique.',
]);

export const voiceKit: Script = async (d) => {
  if (flag('i4_kit')) {
    await d.say(['« Mon doudou qui parle ! — 2 pistes ».', 'Deux pistes. Tu n\'en connais qu\'une.']);
    return;
  }
  d.set('i4_kit');
  await d.say(['Une petite boîte en carton, vide, aplatie.', '{c:b}« Mon doudou qui parle ! — 2 pistes — 20 secondes chacune »{/c}']);
  await d.say('Un mot est scotché dessus. Ce n\'est pas l\'écriture de Maman.');
  await d.paper(['piles : 3 x LR44', 'ça tient environ un an', '— Nadia'], '');
  await d.say(['Nadia. L\'infirmière de nuit. Celle qui savait tout.', 'Environ un an.']);
  await d.wait(30);
  await d.say('Ça fait un an.');
};

export const teethBox: Script = async (d) => {
  if (!flag('i4_dents')) {
    await d.say(['Une petite boîte en forme de souris.', 'Sur le couvercle, de l\'écriture de Maman : « Dents de Noa ».']);
    const r = await d.ask('Ouvrir ?', ['Ouvrir', 'Laisser'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    d.set('i4_dents');
    for (let i = 0; i < 3; i++) {
      d.sfx('tooth', { pitch: 1.4 + i * 0.2, vol: 0.4 });
      await d.wait(8);
    }
    await d.say(['Tes dents de lait. Toutes.', 'Elles font un petit bruit de dés quand la boîte bouge.']);
    await d.say(['Il y en a une avec encore un peu de chocolat dessus.', 'C\'est dégoûtant.']);
    await d.say('Tu ris. Tout bas. Pour la première fois de la nuit.');
    return;
  }
  await d.say('« Dents de Noa ». Elle garde tout. Toi aussi.');
};

export const planning = look('planning', [
  ['Son planning des Glycines, punaisé au mur.', 'Des nuits. Rien que des nuits.'],
  ['Cette nuit, la case est barrée. Réécrite au-dessus, en rouge : « fin 5h30 ».', 'Elle a demandé à partir plus tôt.'],
  'Pour toi.',
]);

export const blouse: Script = async (d) => {
  await d.say(['Sa blouse de rechange, sur le dossier de la chaise.', 'Un badge : « Les Glycines — équipe de nuit ».']);
  if (flag('i4_bonbon')) return;
  d.set('i4_bonbon');
  await d.say('Dans la poche, un stylo qui ne marche plus et un bonbon à la menthe.');
  if (await d.give('bonbon', true)) {
    d.sfx('item');
    await d.say(['Tu prends le bonbon.', 'Elle en a toujours un. Pour toi. Depuis que tu as quatre ans.']);
  }
};

export const laundry = look('panier', [
  ['Le panier à linge. Des chaussettes, une serviette.', 'Tout au fond, une petite chaussette rose. Sans sa paire.'],
  'Elle cherche sa paire.',
]);

export const mamanPhoto = look('photo_maman', [
  ['Sur sa table de nuit, un cadre. Posé face contre le bois.', 'Comme le tien.'],
  'Elle aussi.',
]);

export const mamanWindow = look('volets', [['Les volets sont fermés. Entre les lattes, la lumière orange du lampadaire de la rue.', 'Elle dort le jour. Toi, tu ne dors plus.']]);

// ---------------------------------------------------------------------------------------------------------------------
// Debug (?debug=script&name=…)
// ---------------------------------------------------------------------------------------------------------------------

/** The end of chapter 4 as the bible plays it: the stats of a chapter-4 run, the souvenir « lumière ». */
function setupIV(): void {
  const s = G.state;
  s.chapter = 4;
  s.flags.c4_fin = true;
  if (!s.souvenirs.includes('lumiere')) s.souvenirs.push('lumiere');
}

function setupIII(): void {
  G.state.chapter = 3;
}

export const DEBUG: Record<string, Script> = {
  interlude3: async (d) => {
    setupIII();
    await interlude3(d);
  },
  /** The phone of Interlude III straight away (unlock « Mina 🐑 », reply, call log). */
  phone_mina: async (d) => {
    setupIII();
    G.state.flags.interlude = REAL.i3;
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await phone(d);
  },
  /** Interlude III, the hall cupboard and the bag (the phone and the photo done). */
  interlude3_sac: async (d) => {
    setupIII();
    Object.assign(G.state.flags, { interlude: REAL.i3, i3_dodo: true, i3_tel: true, i3_tel_vu: true, i3_reply: 'pardon', i3_appel: true, i3_photo: true, i3_porte: true });
    d.load('appartement_tard', 'placard');
    await d.fadeIn(10);
  },
  /** Interlude III, back in bed after the polaroid: « Tu vois ? Tu reviens toujours. », then chapter 4. */
  interlude3_fin: async (d) => {
    setupIII();
    Object.assign(G.state.flags, { interlude: REAL.i3, i3_dodo: true, i3_tel: true, i3_reply: 'rien', i3_appel: true, i3_photo: true, i3_porte: true, i3_placard: true, i3_sac_ouvert: true, i3_sac: true });
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await lastWordIII(d);
  },
  interlude4: async (d) => {
    setupIV();
    await interlude4(d);
  },
  /** Maman's room (the wardrobe and the kitchen done). */
  interlude4_maman: async (d) => {
    setupIV();
    Object.assign(G.state.flags, { interlude: REAL.i4, i4_armoire: true, i4_couloir: true });
    d.load('chambre_maman', 'door');
    await d.fadeIn(10);
  },
  /** Back in the bedroom after Maman's room: the knock in Mina's wall, then Dodo. */
  interlude4_coups: async (d) => {
    setupIV();
    Object.assign(G.state.flags, { interlude: REAL.i4, i4_armoire: true, i4_couloir: true, i4_maman: true, i4_reveil: true, i4_dessin: true });
    d.load('chambre', 'door');
    await d.fadeIn(10);
  },
};

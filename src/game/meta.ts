import { audio } from '../engine/audio';
import { GAME_TITLE, W } from '../engine/constants';
import { measure } from '../engine/font';
import { game } from '../engine/game';
import { G, newMeta, writeMeta, type Meta } from './state';
import { lang, tf, tr, translated } from '../i18n';
import { now, nowMs } from './clock';
import { dialogue, nightNarratorVoice } from './ui/dialogue';
import { world } from './overworld/world';
import { runScript, type Director } from './director';
import { PhoneScene } from './scenes/phone';
import { REAL, realPhase } from './story/common';

/**
 * Fourth-wall touches (docs/HISTOIRE.md § 5 « Méta et nouvelle partie+ »): the game notices when the player leaves
 * the tab and changes the page title during horror moments. Kept subtle and never blocking. Version 2 adds:
 * - the narrator's blip becomes Dodo's between midnight and 5 a.m., real time (`dialogue.narratorVoice`);
 * - from chapter 4 on, coming back to the tab after a while brings a page: « Pendant ton absence, Noa a dit : … »;
 * - at 3:14, real time, during an interlude, Noa's phone rings (« Mina 🐑 ») and cannot be answered.
 * Each waits for a free moment (exploring, no dialogue): never mid-cutscene, never mid-battle.
 */
let creepyTitle: string | null = null;
let leftAt = 0;

/** Shortest absence (ms) that leaves a page, and the least time between two pages. */
export const ABSENCE_MIN = 10_000;
const ABSENCE_COOLDOWN = 90_000;
/** A page not shown within this time after the player came back is dropped. */
const ABSENCE_STALE = 300_000;

let pendingAbsence: { from: number; to: number } | null = null;
let lastAbsencePage = -Infinity;
/** The 3:14 call is due (real time reached it during an interlude: when, and the time on the phone); the night it rang. */
let ringDue: { at: number; time: string } | null = null;
let rangOn = '';
/** A call that could not ring within this time (a long cutscene) is dropped. */
const RING_STALE = 600_000;
/** Last narrator voice set by the clock (undefined = never set), so that a script's own setting stays until it changes. */
let clockVoice: string | null | undefined;
let tick = 0;

export function setupMeta(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      leftAt = nowMs();
      if (G.state.chapter >= 2 && G.state.playerName) document.title = tr('Ne pars pas…');
    } else {
      document.title = creepyTitle ? tr(creepyTitle) : GAME_TITLE;
      if (leftAt) cameBack(leftAt, nowMs());
      leftAt = 0;
    }
  });
  game.hooks.push(metaTick);
}

/** The player came back to the tab after leaving it at `from` (ms). */
export function cameBack(from: number, to: number): void {
  const away = to - from;
  if (away > 3000) {
    G.meta.tabLeaves++;
    writeMeta(G.meta);
  }
  if (away >= ABSENCE_MIN && absenceApplies() && to - lastAbsencePage >= ABSENCE_COOLDOWN) {
    // Two departures before the page could be shown: the page covers both.
    pendingAbsence = pendingAbsence ? { from: pendingAbsence.from, to } : { from, to };
  }
}

/** Sets (or clears) an unsettling browser tab title. */
export function setPageTitle(t: string | null): void {
  creepyTitle = t;
  document.title = t ? tr(t) : GAME_TITLE;
}

/** True if the player left the tab for a while since `since` (used by Dodo's lines). */
export function leftRecently(): boolean {
  return G.meta.tabLeaves > 0;
}

/** Real-world hour (0-23). */
export function hourNow(): number {
  return now().getHours();
}

export function isLateNight(): boolean {
  const h = hourNow();
  return h >= 0 && h < 5;
}

// ---------------------------------------------------------------------------------------------------------------------
// The clock-driven moments
// ---------------------------------------------------------------------------------------------------------------------

/** Not in the bonus chapter (Maman's night): that run has no Noa, no Dodo. */
const inMainRun = (): boolean => !G.state.flags.bonus;

/** Noa's apartment during one of the four interludes (not the prologue, not the finale, not the false dawn). */
export function inInterlude(): boolean {
  const p = realPhase();
  const inApartment = !!world.map && world.map.world === 'real' && game.scenes.includes(world);
  return inMainRun() && inApartment && (p === REAL.i1 || p === REAL.i2 || p === REAL.i3 || p === REAL.i4);
}

/** The « pendant ton absence » page: from chapter 4 on, during a run. */
function absenceApplies(): boolean {
  return inMainRun() && G.state.chapter >= 4 && !!world.map && game.scenes.includes(world);
}

/** Exploring freely: the moment a page or a phone may come up without cutting into anything. */
const free = (): boolean => game.top === world && !!world.map && world.controllable;

function metaTick(): void {
  if (++tick % 20 !== 0) return;
  const t = now();
  // Dodo's blip for the narrator between midnight and 5 a.m. (none once Dodo is silent for good, none in the bonus).
  const voice = inMainRun() ? nightNarratorVoice(t.getHours(), G.meta.dodoSilent) : null;
  if (voice !== clockVoice) {
    clockVoice = voice;
    dialogue.narratorVoice = voice;
  }
  // 3:14, once a night, during an interlude.
  const night = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
  if (t.getHours() === 3 && t.getMinutes() === 14 && rangOn !== night && inInterlude()) {
    rangOn = night;
    ringDue = { at: nowMs(), time: clockLabel(t, ':') };
  }
  if (ringDue && (!inInterlude() || nowMs() - ringDue.at > RING_STALE)) ringDue = null;
  if (pendingAbsence && (nowMs() - pendingAbsence.to > ABSENCE_STALE || !absenceApplies())) pendingAbsence = null;
  if (!free()) return;
  if (ringDue) {
    const time = ringDue.time;
    ringDue = null;
    void runScript((d) => ring314(d, time));
  } else if (pendingAbsence) {
    const a = pendingAbsence;
    pendingAbsence = null;
    lastAbsencePage = nowMs();
    void runScript((d) => absencePage(d, a.from, a.to));
  }
}

/** « 3h14 » in French, « 3:14 » in English (like the {time} variable of the dialogue). */
export function clockLabel(t: Date, sep = lang() === 'en' ? ':' : 'h'): string {
  return `${t.getHours()}${sep}${String(t.getMinutes()).padStart(2, '0')}`;
}

/**
 * 3:14, real time, during an interlude: the phone rings, « Mina 🐑 ». The green button does nothing. It rings for
 * forty-one seconds (a few with « Réduire les attentes »), then it is a missed call.
 */
async function ring314(d: Director, time: string): Promise<void> {
  G.state.flags.m_appel_314 = true;
  audio.sfx('buzz', { vol: 0.9 });
  if (G.settings.vibration && typeof navigator !== 'undefined') navigator.vibrate?.([400, 200, 400]);
  await d.wait(40);
  const ph = PhoneScene.home({ clock: time, contacts: [{ id: 'mina', name: 'Mina 🐑', avatar: '🐑', color: '#e0834f', pinned: true, locked: true, preview: '', messages: [] }], calls: [], tab: 'calls' });
  await d.wait(20);
  await ph.ring('Mina 🐑', time, G.settings.shortWaits ? 300 : 41 * 60);
  if (G.settings.vibration && typeof navigator !== 'undefined') navigator.vibrate?.(0);
  await d.wait(30);
  await d.say('Tu n\'as pas pu décrocher.');
  for (;;) {
    const ev = await ph.browse();
    if (ev.kind === 'close') break;
    if (ev.kind === 'locked') await d.say('Tu ne l\'ouvres pas.');
  }
  await ph.close();
}

/**
 * What Noa said while the player was away, one line per doubling of the time (15 s: one line; half an hour: all of
 * them). The first one is the question of the wall code, one knock: « T'es là ? ».
 */
export const ABSENCE_LINES = [
  '« …t\'es là ? »',
  '« … »',
  '« {0} ? »',
  '« Toc. »',
  '« J\'en suis à cent moutons. »',
  '« J\'ai l\'habitude. »',
  '« Je laisse la lumière. »',
  '« Tu reviens, hein ? »',
];

/** Width of a line on the notebook page (scenes/paper.ts); longer lines go on under the quote. */
const PAGE_WIDTH = W - 100 - 30;

/** How many lines of ABSENCE_LINES an absence of `ms` earns. */
export function absenceCount(ms: number): number {
  if (ms < ABSENCE_MIN) return 0;
  return Math.max(1, Math.min(ABSENCE_LINES.length, 1 + Math.floor(Math.log2(ms / 15_000))));
}

/**
 * The page's lines: the real time each one was said, then the line (French source, translated piece by piece). A line
 * too wide for the page (a long name, a longer language) goes on below, under its quote.
 */
export function absenceLines(from: number, to: number, name = G.state.playerName || '…'): string[] {
  const n = absenceCount(to - from);
  return ABSENCE_LINES.slice(0, n).flatMap((line, i) => {
    const at = new Date(from + ((to - from) * (i + 0.3)) / n);
    const head = `${clockLabel(at)} — `;
    const indent = ' '.repeat(Math.ceil(measure(head) / Math.max(1, measure(' '))));
    const [first = '', ...words] = tf(line, name).split(' ');
    const rows: string[] = [];
    let row = head + first;
    for (const word of words) {
      if (measure(`${row} ${word}`) > PAGE_WIDTH) {
        rows.push(row);
        row = indent + word;
      } else row = `${row} ${word}`;
    }
    rows.push(row);
    return rows.map(translated);
  });
}

async function absencePage(d: Director, from: number, to: number): Promise<void> {
  const lines = absenceLines(from, to);
  if (!lines.length) return;
  G.state.flags.m_absence = Number(G.state.flags.m_absence ?? 0) + 1;
  await d.paper(['Noa a dit :', ...lines], 'Pendant ton absence');
}

// ---------------------------------------------------------------------------------------------------------------------
// Nights (meta.nuits)
// ---------------------------------------------------------------------------------------------------------------------

/** Runs that reached an ending before this one (Beaux rêves included): one more crown in the attic for each. */
export function runsBefore(): number {
  return Math.max(0, G.meta.nuits - 365);
}

// i18n-ignore-start (number words are built per language here, not translated)
const FR_UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const FR_TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
const EN_UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function fr99(n: number): string {
  if (n < 20) return FR_UNITS[n]!;
  if (n < 70) {
    const u = n % 10;
    return FR_TENS[Math.floor(n / 10)]! + (u === 0 ? '' : u === 1 ? ' et un' : `-${FR_UNITS[u]}`);
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${FR_UNITS[n - 60]}`;
  return n === 80 ? 'quatre-vingts' : `quatre-vingt-${FR_UNITS[n - 80]}`;
}

function frWords(n: number): string {
  if (n < 100) return fr99(n);
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    const head = h === 1 ? 'cent' : `${FR_UNITS[h]} cent${r === 0 ? 's' : ''}`;
    return r === 0 ? head : `${head} ${fr99(r)}`;
  }
  const k = Math.floor(n / 1000);
  const r = n % 1000;
  const head = k === 1 ? 'mille' : `${frWords(k).replace(/(cent|vingt)s$/, '$1')} mille`;
  return r === 0 ? head : `${head} ${frWords(r)}`;
}

function en99(n: number): string {
  if (n < 20) return EN_UNITS[n]!;
  const u = n % 10;
  return EN_TENS[Math.floor(n / 10)]! + (u ? `-${EN_UNITS[u]}` : '');
}

function enWords(n: number): string {
  if (n < 100) return en99(n);
  if (n < 1000) {
    const r = n % 100;
    return `${EN_UNITS[Math.floor(n / 100)]} hundred${r ? ` and ${en99(r)}` : ''}`;
  }
  const r = n % 1000;
  return `${enWords(Math.floor(n / 1000))} thousand${r ? `${r < 100 ? ' and ' : ' '}${enWords(r)}` : ''}`;
}

// i18n-ignore-end

/**
 * A whole number in words, in the current language (« trois cent soixante-cinq », "three hundred and sixty-five").
 * `feminine`: « une » for a French count of feminine things (« vingt et une couronnes »).
 */
export function numberWords(n: number, feminine = false): string {
  const v = Math.max(0, Math.floor(n));
  if (lang() === 'en') return enWords(v);
  const w = frWords(v);
  return feminine && /(^|[ -])un$/.test(w) ? `${w}e` : w;
}

/** The same, with a capital letter (at the start of a sentence). */
export function NumberWords(n: number, feminine = false): string {
  const w = numberWords(n, feminine);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ---------------------------------------------------------------------------------------------------------------------
// Debug: a simulated memory (?debug=…&meta=endings:aube,callVersion:douce)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Applies a memory description to `m` and returns the keys it did not know. Pairs are separated by commas, a key from
 * its value by « : » (or « = »), list items by « | » (« endings:aube|silence »). Any Meta field works; the value is read
 * with the field's type (a boolean without value is true: « dodoSilent »). Shortcuts, to look like a real memory:
 * - `endingsV1` items are also added to `endings` (a migrated version 1.1 memory keeps both);
 * - without `nuits`, the nights follow the endings: 365 + one per ending;
 * - `beauxRevesAt` below 100000 is a number of days ago;
 * - `reset` (first) starts from a blank memory.
 */
export function applyMetaSpec(m: Meta, spec: string): string[] {
  const blank = newMeta();
  const unknown: string[] = [];
  const pairs = spec.split(',').map((s) => s.trim()).filter(Boolean);
  let nuits = false;
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split(/[:=]/);
    const key = rawKey!.trim() as keyof Meta;
    const value = rest.join(':').trim();
    if (key === ('reset' as keyof Meta)) {
      Object.assign(m, newMeta());
      continue;
    }
    if (!(key in blank)) {
      unknown.push(key);
      continue;
    }
    const was = blank[key];
    const rec = m as unknown as Record<string, unknown>;
    if (Array.isArray(was)) rec[key] = value.split(/[|+ ]/).filter(Boolean);
    else if (typeof was === 'number') rec[key] = Number(value || 0);
    else if (typeof was === 'boolean') rec[key] = !/^(0|false|non|no)$/i.test(value);
    else if (key === 'callVersion') rec[key] = value === '' || value === 'null' ? null : value;
    else rec[key] = value;
    if (key === 'nuits') nuits = true;
    if (key === 'beauxRevesAt' && m.beauxRevesAt < 100_000) m.beauxRevesAt = Date.now() - m.beauxRevesAt * 86_400_000;
  }
  for (const e of m.endingsV1) if (!m.endings.includes(e)) m.endings.push(e);
  if (!nuits && pairs.some((p) => /^endings(V1)?\b/.test(p))) m.nuits = 365 + m.endings.length;
  return unknown;
}

/**
 * Tiny i18n layer. French is the source language: every text in the code stays French and is looked up, as is,
 * in an English catalog (exact match) when the game runs in English. See docs/I18N.md.
 *
 *   tr('Nouvelle partie')                          → 'New Game'
 *   tf('Tu obtiens : {c:y}{0}{/c}.', tr(item))     → 'You got the {c:y}Strawberry Candy{/c}.'
 *   tn(n, '{0} Étoile', '{0} Étoiles')             → '1 Star' / '3 Stars' (plural rule of the current language)
 *
 * This module is a leaf (no game imports): the game binds the language source with `bindLanguage`.
 */
import { EN } from './en';

export type Lang = 'fr' | 'en';

/** Languages offered in the options, with their own name. */
export const LANGUAGES: ReadonlyArray<{ id: Lang; name: string }> = [
  { id: 'fr', name: 'Français' },
  { id: 'en', name: 'English' },
];

const CATALOGS: Record<Exclude<Lang, 'fr'>, Record<string, string>> = { en: EN };

let getLang: () => Lang = () => 'fr';

/** Tells the i18n layer where the current language lives (the settings). */
export function bindLanguage(get: () => Lang): void {
  getLang = get;
}

/** Current language. */
export function lang(): Lang {
  return getLang();
}

export function isLang(v: unknown): v is Lang {
  return v === 'fr' || v === 'en';
}

// -----------------------------------------------------------------------------
// Missing translations (dev only)
// -----------------------------------------------------------------------------

const DEV = import.meta.env?.DEV ?? false;
/** French strings looked up without an English entry (dev builds only), in order of appearance. */
export const missing = new Set<string>();
/** English strings already produced (catalog values, `tf` results): looking them up again is not a miss. */
let produced: Set<string> | null = null;

function known(): Set<string> {
  if (!produced) {
    produced = new Set();
    for (const v of Object.values(EN)) {
      produced.add(v);
      // MINA_LINES style "text|expression": the text part is said alone.
      const bar = v.lastIndexOf('|');
      if (bar > 0) produced.add(v.slice(0, bar));
    }
  }
  return produced;
}

function remember(s: string): string {
  const k = known();
  if (k.size > 20000) produced = null;
  known().add(s);
  return s;
}

function miss(fr: string): void {
  if (!DEV || missing.has(fr) || known().has(fr)) return;
  // Strings without letters (numbers, «…», «?!») need no translation.
  if (!/[A-Za-zÀ-ÿŒœ]/.test(fr.replace(/\{[^{}]*\}/g, ''))) return;
  missing.add(fr);
  console.info(`[i18n] missing ${getLang()}: ${JSON.stringify(fr)}`);
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/** Translates a French source string (exact match). Falls back to the French text. */
export function tr(fr: string): string {
  const l = getLang();
  if (l === 'fr' || !fr) return fr;
  const v = CATALOGS[l][fr];
  if (v) return v;
  miss(fr);
  return fr;
}

/**
 * Dev check for text drawn directly by the font (`drawText`, `drawWrapped`): a French catalog key reaching the screen
 * in another language means a missing `tr()` on the way, so it is reported like a missing translation. No-op in
 * production builds and in French.
 */
export function checkDrawn(text: string): void {
  if (!DEV) return;
  const l = getLang();
  if (l === 'fr') return;
  const v = CATALOGS[l][text];
  if (v && v !== text) miss(text);
}

/** True if the current language has an entry for this French string (always true in French). */
export function hasTr(fr: string): boolean {
  const l = getLang();
  return l === 'fr' || !!CATALOGS[l][fr];
}

/**
 * Translates a line of a poem or a note: the whole line if the catalog has it, else its body without a trailing
 * « , » or « . » (« lumière, » → "light,": poems are built from single words plus punctuation).
 */
export function trLine(line: string): string {
  if (getLang() === 'fr' || !line || hasTr(line)) return tr(line);
  const m = /^(.*?)([.,])$/.exec(line);
  return m && hasTr(m[1]!) ? tr(m[1]!) + m[2] : tr(line);
}

/** Translates every string of a list. */
export function trAll(list: readonly string[]): string[] {
  return list.map(tr);
}

/** Replaces {0}, {1}… in an already translated template. */
export function format(template: string, ...args: Array<string | number>): string {
  return template.replace(/\{(\d+)\}/g, (m, i: string) => (Number(i) < args.length ? String(args[Number(i)]) : m));
}

/**
 * Translates a template, then fills {0}, {1}… with `args` (inserted as is: translate names with `tr` yourself).
 * The French template is the catalog key: `tf('* {0} te barre la route !', tr(enemy))`.
 */
export function tf(fr: string, ...args: Array<string | number>): string {
  const out = format(tr(fr), ...args);
  return getLang() === 'fr' ? out : remember(out);
}

/**
 * Marks a string composed from translated parts (`tf(…) + tr(…)`) as final display text: passing it to a
 * translating chokepoint (dialogue, battle box) then is not reported as a missing translation.
 */
export function translated(s: string): string {
  return getLang() === 'fr' ? s : remember(s);
}

/**
 * Plural-aware template: picks `one` or `other` with the rule of the current language (French: 0 and 1 are
 * singular; English: only 1), then formats it with {0} = n and {1}… = `args`.
 */
export function tn(n: number, one: string, other: string, ...args: Array<string | number>): string {
  const singular = getLang() === 'fr' ? Math.abs(n) < 2 : Math.abs(n) === 1;
  return tf(singular ? one : other, n, ...args);
}

/** Value for the current language from an inline table (number words, month names, layouts…). */
export function pick<T>(byLang: { fr: T } & Partial<Record<Lang, T>>): T {
  return byLang[getLang()] ?? byLang.fr;
}

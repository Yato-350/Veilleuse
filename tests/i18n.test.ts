import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error — plain JS tool, no type declarations
import { findMissing, readManifest, extractStrings } from '../tools/i18n-missing.mjs';
import { CATALOG_PARTS, EN } from '../src/i18n/en';
import { bindLanguage, format, tf, tn, tr, trLine } from '../src/i18n';
import { ACCENTS, GLYPHS } from '../src/engine/font-data';
import { measure } from '../src/engine/font';
import { DODO_WORDS, MINA_WORDS, POEM_WORDS, WORD_POOLS } from '../src/data/words';
import { ENEMIES } from '../src/data/enemies';

type Missing = { file: string; line: number; value: string; dynamic: boolean };

// Rich-text tokens ({c:y}, {/c}, {p:20}, {wave}, {player}, {0}…) must survive translation unchanged.
const tokens = (s: string): string[] => (s.match(/\{[^{}\s]*\}/g) ?? []).sort();
const drawable = (ch: string): boolean => ch === '\n' || !!GLYPHS[ch] || !!ACCENTS[ch] || !!GLYPHS[ch.toUpperCase()];

describe('i18n coverage', () => {
  it('translates every display string of the files in src/i18n/manifest.json', () => {
    const missing = (findMissing(readManifest()) as Missing[]).map(
      (m) => `${m.file}:${m.line} ${m.dynamic ? 'template literal, use tf(): ' : ''}${JSON.stringify(m.value)}`,
    );
    // Fix: add the strings to a catalog in src/i18n/en/ (node tools/i18n-missing.mjs <file> --write <catalog>).
    expect(missing).toEqual([]);
  });

  it('finds display strings and skips ids, keys and comparisons', () => {
    const src = [
      "const a = d.say('Bonjour toi.');",
      "const b = { id: 'mouton_noir', 'Clé': 1, sprite: 'face_mina_happy', color: '#ffd84a' };",
      "if (x === 'Oui') console.warn('Pas affiché du tout');",
      "const c = `Il est ${h}h.`; // i18n-ignore",
      "const e = `* ${name} te barre la route !`;",
      "const f = cond ? 'Réessayer' : 'Titre';",
    ].join('\n');
    const found = (extractStrings(src) as Missing[]).map((s) => `${s.dynamic ? 'dyn:' : ''}${s.value}`);
    expect(found).toEqual(['Bonjour toi.', 'dyn:* ${} te barre la route !', 'Réessayer', 'Titre']);
  });
});

describe('English catalog', () => {
  const entries = Object.entries(EN);

  it('keeps rich-text tokens, placeholders, « * » prefixes and |expression suffixes', () => {
    const bad: string[] = [];
    for (const [fr, en] of entries) {
      if (!en) continue;
      if (tokens(fr).join() !== tokens(en).join()) bad.push(`tokens: ${JSON.stringify(fr)} → ${JSON.stringify(en)}`);
      const suffix = /\|\w+$/.exec(fr)?.[0];
      if (suffix && !en.endsWith(suffix)) bad.push(`suffix ${suffix}: ${JSON.stringify(en)}`);
      if (fr.startsWith('* ') !== en.startsWith('* ')) bad.push(`"* " prefix: ${JSON.stringify(en)}`);
      if (fr.split('\n*').length !== en.split('\n*').length) bad.push(`"\\n*" lines: ${JSON.stringify(en)}`);
    }
    expect(bad).toEqual([]);
  });

  it('only uses characters of the bitmap font', () => {
    const bad = new Set<string>();
    for (const [, en] of entries) for (const ch of en.replace(/\{[^{}\s]*\}/g, '')) if (!drawable(ch)) bad.add(`${ch} in ${JSON.stringify(en)}`);
    expect([...bad]).toEqual([]);
  });

  it('has no conflicting duplicates across catalog files', () => {
    const seen = new Map<string, [string, string]>();
    const bad: string[] = [];
    for (const [part, cat] of Object.entries(CATALOG_PARTS)) {
      for (const [fr, en] of Object.entries(cat)) {
        const prev = seen.get(fr);
        if (prev && prev[1] !== en) bad.push(`${JSON.stringify(fr)}: ${prev[0]} → ${JSON.stringify(prev[1])}, ${part} → ${JSON.stringify(en)}`);
        seen.set(fr, [part, en]);
      }
    }
    expect(bad).toEqual([]);
  });

  it('fits battle button labels (all-caps entries) in their 70px buttons', () => {
    const tooWide = entries
      // (shouted lines such as « FERME LA PORTE. » end with punctuation: buttons never do)
      .filter(([fr, en]) => en && fr.length <= 16 && !/[a-zà-ÿ{]/.test(fr) && /[A-Z]/.test(fr) && !/[.!?…]$/.test(fr))
      .filter(([, en]) => measure(en) > 68)
      .map(([fr, en]) => `${fr} → ${en} (${measure(en)}px)`);
    expect(tooWide).toEqual([]);
  });

  it('translates every notebook, poem and special word (lowercase words escape the extractor)', () => {
    const words = [...Object.values(WORD_POOLS).flat(), ...DODO_WORDS, ...MINA_WORDS, ...POEM_WORDS];
    for (const e of Object.values(ENEMIES)) words.push(...(e.specialWords ?? []));
    expect([...new Set(words.map((w) => w.text))].filter((t) => !EN[t])).toEqual([]);
  });

  it('is plain data: catalog files hold only string entries', () => {
    for (const part of Object.keys(CATALOG_PARTS)) {
      const src = readFileSync(`src/i18n/en/${part}.ts`, 'utf8');
      expect(src, part).not.toMatch(/\$\{/);
    }
  });
});

describe('i18n API', () => {
  afterEach(() => bindLanguage(() => 'fr'));

  it('returns French unchanged, English from the catalog', () => {
    bindLanguage(() => 'fr');
    expect(tr('Oui')).toBe('Oui');
    expect(tf('Poches : {0}/{1}', 3, 8)).toBe('Poches : 3/8');
    bindLanguage(() => 'en');
    expect(tr('Oui')).toBe('Yes');
    expect(tr('Phrase absente du catalogue')).toBe('Phrase absente du catalogue');
    expect(tf('Poches : {0}/{1}', 3, 8)).toBe('Pockets: 3/8');
    expect(format('{1} {0} {2}', 'a', 'b')).toBe('b a {2}');
  });

  it('picks plural forms with the rule of the language', () => {
    bindLanguage(() => 'fr');
    expect(tn(0, '{0} Bouton', '{0} Boutons')).toBe('0 Bouton');
    expect(tn(2, '{0} Bouton', '{0} Boutons')).toBe('2 Boutons');
    bindLanguage(() => 'en');
    expect(tn(0, '{0} Bouton', '{0} Boutons')).toBe('0 Buttons');
    expect(tn(1, '{0} Bouton', '{0} Boutons')).toBe('1 Button');
  });

  it('translates poem lines word by word', () => {
    bindLanguage(() => 'en');
    expect(trLine('Pour Mina.')).toBe('For Mina.');
    expect(trLine('Oui,')).toBe('Yes,');
    expect(trLine('')).toBe('');
  });
});

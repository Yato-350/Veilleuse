import { describe, expect, it } from 'vitest';
import { noteToMidi, parsePattern } from '../src/engine/audio';
import { getGlyph, measure, wrap } from '../src/engine/font';
import { GLYPHS, ACCENTS } from '../src/engine/font-data';
import { hash2, Rng, clamp, rectsOverlap } from '../src/engine/math';
import { parseRows } from '../src/engine/sprite';
import { layoutRich, parseRich, plainText } from '../src/game/ui/richtext';
import { beats, enemyDamage, evaluateWord, needTotal, playerDamage, resonates, soulSpeed } from '../src/game/battle/rules';
import { EnemyRuntime } from '../src/game/battle/enemy';
import type { EnemyDef } from '../src/game/battle/types';
import { attack, defense, level, maxHp, newState, readSave, writeSave, hasSave, deleteSave, readMeta } from '../src/game/state';
import { useMemoryStorage } from '../src/engine/storage';
import { nameReaction } from '../src/game/scenes/nameentry';
import { composePoem } from '../src/game/scenes/poem';

describe('math', () => {
  it('hash2 is deterministic and in [0,1)', () => {
    expect(hash2(3, 4)).toBe(hash2(3, 4));
    for (let i = 0; i < 100; i++) {
      const v = hash2(i, i * 7, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('Rng is seedable', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
    expect(a.int(1, 3)).toBeGreaterThanOrEqual(1);
  });
  it('clamp & rects', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(rectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 3, y: 3, w: 4, h: 4 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 })).toBe(false);
  });
});

describe('font', () => {
  it('has glyphs for every printable ASCII character', () => {
    for (let c = 32; c < 127; c++) {
      const ch = String.fromCharCode(c);
      expect(GLYPHS[ch] !== undefined || ch.toUpperCase() !== ch || ch === '`' || ch === '{' || ch === '}' || ch === '$').toBe(true);
    }
  });
  it('composes French accented letters', () => {
    for (const ch of Object.keys(ACCENTS)) {
      const g = getGlyph(ch);
      expect(g.px.length).toBeGreaterThan(getGlyph(ACCENTS[ch]![0]).px.length);
    }
  });
  it('measures and wraps text', () => {
    expect(measure('')).toBe(0);
    expect(measure('A')).toBe(5);
    expect(measure('AA')).toBe(11);
    const lines = wrap('le petit mouton dort sous la lune', 60);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(60);
  });
});

describe('rich text', () => {
  it('parses colors, effects, pauses and variables', () => {
    const chars = parseRich('Salut {player}, {c:y}or{/c}{p:30}!', { player: 'Léa' });
    expect(plainText('Salut {player}, {c:y}or{/c}{p:30}!', { player: 'Léa' })).toBe('Salut Léa, or!');
    const o = chars.find((c) => c.ch === 'o' && c.color);
    expect(o?.color).toBe('#ffd84a');
    expect(chars.find((c) => c.ch === 'r' && c.color)?.pause).toBe(30);
  });
  it('wraps rich text by words', () => {
    const lines = layoutRich(parseRich('un deux trois quatre cinq six sept huit neuf dix'), 50);
    expect(lines.length).toBeGreaterThan(2);
    for (const l of lines) expect(l[0]?.ch).not.toBe(' ');
  });
  it('honors explicit newlines', () => {
    expect(layoutRich(parseRich('a\nb'), 200).length).toBe(2);
  });
});

describe('sprites', () => {
  it('parses rows and strips indentation', () => {
    const rows = parseRows(`
      ..k
      .kk
      kkk
    `);
    expect(rows).toEqual(['..k', '.kk', 'kkk']);
  });
});

describe('audio patterns', () => {
  it('converts notes to midi', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(noteToMidi('nope')).toBeNull();
  });
  it('parses holds, rests and chords', () => {
    const p = parsePattern('C4 - - . E4+G4 | x . X');
    expect(p.length).toBe(8);
    expect(p.events[0]).toMatchObject({ step: 0, len: 3 });
    expect(p.events[1]!.midis).toEqual([64, 67]);
    expect(p.events[2]!.hit).toBe(true);
  });
});

describe('battle rules', () => {
  it('emotion triangle', () => {
    expect(beats('joie', 'colere')).toBe(true);
    expect(beats('colere', 'tristesse')).toBe(true);
    expect(beats('tristesse', 'joie')).toBe(true);
    expect(beats('joie', 'tristesse')).toBe(false);
    expect(beats('neutre', 'joie')).toBe(false);
  });
  it('resonance: same color passes through, white always hurts', () => {
    expect(resonates('tristesse', 'tristesse')).toBe(true);
    expect(resonates('tristesse', 'joie')).toBe(false);
    expect(resonates('neutre', 'neutre')).toBe(false);
  });
  it('soul speed by emotion', () => {
    expect(soulSpeed('joie')).toBeGreaterThan(soulSpeed('neutre'));
    expect(soulSpeed('tristesse')).toBeLessThan(soulSpeed('neutre'));
  });
  it('damage formulas', () => {
    expect(playerDamage(4, 1, 'neutre', 'neutre', 0, false)).toBeGreaterThan(playerDamage(4, 0.2, 'neutre', 'neutre', 0, false));
    expect(playerDamage(4, 1, 'colere', 'tristesse', 0, false)).toBeGreaterThan(playerDamage(4, 1, 'neutre', 'tristesse', 0, false));
    expect(enemyDamage(3, 0, 0, 'tristesse', 'neutre', false)).toBeLessThan(enemyDamage(3, 0, 0, 'neutre', 'neutre', false));
    expect(enemyDamage(10, 2, 0, 'neutre', 'neutre', true)).toBeLessThan(enemyDamage(10, 2, 0, 'neutre', 'neutre', false));
    expect(enemyDamage(1, 0, 50, 'neutre', 'neutre', false)).toBe(1);
  });
  it('word evaluation', () => {
    expect(evaluateWord({ text: 'pluie', emotion: 'tristesse' }, { emotion: 'tristesse' }).verdict).toBe('good');
    expect(evaluateWord({ text: 'rire', emotion: 'joie' }, { emotion: 'tristesse' }, ['joie']).verdict).toBe('bad');
    expect(evaluateWord({ text: 'paire', emotion: 'tristesse' }, { word: 'paire', count: 3 }, [], 3)).toEqual({ verdict: 'special', gain: 3 });
    expect(needTotal([{ emotion: 'colere' }, { emotion: 'joie', count: 2 }])).toBe(3);
  });
  it('enemy calm progresses through need steps and becomes spareable', () => {
    const def: EnemyDef = {
      id: 't',
      name: 'Test',
      sprite: 'x',
      hp: 10,
      atk: 1,
      def: 0,
      emotion: 'colere',
      needs: [{ emotion: 'colere' }, { emotion: 'joie', count: 2 }],
      hates: ['tristesse'],
      check: '',
      flavor: [''],
      talk: [''],
      reactGood: [''],
      reactBad: [''],
      reactNeutral: [''],
      patterns: ['rain'],
      rewards: { boutons: 1 },
    };
    const e = new EnemyRuntime(def);
    expect(e.spareable).toBe(false);
    expect(e.applyWord({ text: 'rire', emotion: 'joie' }).verdict).toBe('neutral');
    e.applyWord({ text: 'orage', emotion: 'colere' });
    expect(e.step).toBe(1);
    expect(e.applyWord({ text: 'pluie', emotion: 'tristesse' }).verdict).toBe('bad');
    expect(e.agitation).toBe(1);
    e.applyWord({ text: 'rire', emotion: 'joie' });
    e.applyWord({ text: 'soleil', emotion: 'joie' });
    expect(e.spareable).toBe(true);
    expect(e.emotion).toBe('neutre');
  });
});

describe('state & saves', () => {
  it('derives stats from progression', () => {
    const s = newState('Léa');
    expect(maxHp(s)).toBe(20);
    expect(level(s)).toBe(1);
    s.etoiles = 4;
    expect(maxHp(s)).toBe(24);
    const atk0 = attack(s);
    s.encre = 3;
    expect(attack(s)).toBeGreaterThan(atk0);
    expect(defense(s)).toBeGreaterThanOrEqual(1);
  });
  it('round-trips the save file and fills missing fields', () => {
    useMemoryStorage();
    expect(hasSave()).toBe(false);
    const s = newState('Sacha');
    s.flags.test = 3;
    writeSave(s);
    expect(hasSave()).toBe(true);
    const r = readSave()!;
    expect(r.playerName).toBe('Sacha');
    expect(r.flags.test).toBe(3);
    deleteSave();
    expect(hasSave()).toBe(false);
    expect(readMeta().endings).toEqual([]);
  });
});

describe('story helpers', () => {
  it('reacts to special names', () => {
    expect(nameReaction('Noa')?.allow).toBe(false);
    expect(nameReaction('  dodo ')?.allow).toBe(false);
    expect(nameReaction('Frisk')?.allow).toBe(true);
    expect(nameReaction('Camille')).toBeNull();
  });
  it('composes the final poem', () => {
    const poem = composePoem([
      { text: 'lune', emotion: 'joie' },
      { text: 'rire', emotion: 'joie' },
      { text: 'pluie', emotion: 'tristesse' },
      { text: 'carnet', emotion: 'neutre' },
      { text: 'matin', emotion: 'joie' },
      { text: 'câlin', emotion: 'joie' },
    ]);
    expect(poem[0]).toBe('Pour Mina.');
    expect(poem).toContain('câlin.');
    expect(poem[poem.length - 1]).toBe('— Noa');
  });
});

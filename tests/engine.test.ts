import { describe, expect, it } from 'vitest';
import { noteToMidi, parsePattern } from '../src/engine/audio';
import { getGlyph, measure, wrap } from '../src/engine/font';
import { GLYPHS, ACCENTS } from '../src/engine/font-data';
import { hash2, Rng, clamp, rectsOverlap } from '../src/engine/math';
import { parseRows } from '../src/engine/sprite';
import { layoutRich, parseRich, plainText } from '../src/game/ui/richtext';
import {
  allyActsOn,
  allyHeal,
  allyState,
  beats,
  combatEmotion,
  DefeatStreak,
  enemyDamage,
  evaluateWord,
  needTotal,
  pickAllyEffect,
  playerDamage,
  resonates,
  soulSpeed,
  wordEmotions,
  type AllyContext,
} from '../src/game/battle/rules';
import { soulLabel } from '../src/engine/palette';
import { WORD_POOLS } from '../src/data/words';
import { EnemyRuntime } from '../src/game/battle/enemy';
import { ENEMIES } from '../src/data/enemies';
import { BulletWorld } from '../src/game/battle/bullets';
import type { EnemyDef } from '../src/game/battle/types';
import { attack, defense, level, maxHp, newState, readSave, writeSave, hasSave, deleteSave, readMeta, writeMeta, migrateSave, SAVE_VERSION, type GameState } from '../src/game/state';
import { MAPS } from '../src/data/maps';
import { REAL, wakePhase } from '../src/game/story/common';
import { saveJSON, useMemoryStorage } from '../src/engine/storage';
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

describe('battle 1.1: bittersweet words', () => {
  const souvenir = { text: 'souvenir', emotion: 'joie', emotion2: 'tristesse' } as const;
  it('a bittersweet word carries two emotions', () => {
    expect(wordEmotions(souvenir)).toEqual(['joie', 'tristesse']);
    expect(wordEmotions({ text: 'pluie', emotion: 'tristesse' })).toEqual(['tristesse']);
    expect(wordEmotions({ text: 'x', emotion: 'joie', emotion2: 'joie' })).toEqual(['joie']);
  });
  it('a bicolor soul resonates with both of its colors, never with white or a third color', () => {
    expect(resonates('joie', 'joie', 'tristesse')).toBe(true);
    expect(resonates('joie', 'tristesse', 'tristesse')).toBe(true);
    expect(resonates('joie', 'colere', 'tristesse')).toBe(false);
    expect(resonates('joie', 'peur', 'tristesse')).toBe(false);
    expect(resonates('joie', 'neutre', 'tristesse')).toBe(false);
  });
  it('a bicolor soul fights like a neutral heart and moves at the average speed', () => {
    expect(combatEmotion('joie', 'tristesse')).toBe('neutre');
    expect(combatEmotion('joie', null)).toBe('joie');
    expect(combatEmotion('joie', 'joie')).toBe('joie');
    expect(soulSpeed('joie', 'tristesse')).toBeCloseTo((soulSpeed('joie') + soulSpeed('tristesse')) / 2);
    expect(soulLabel('joie', 'tristesse')).toBe('DOUX-AMER');
    expect(soulLabel('tristesse', 'joie')).toBe('DOUX-AMER');
    expect(soulLabel('colere')).toBe('COLÈRE');
  });
  it('answers a need of either emotion, +1 only', () => {
    expect(evaluateWord(souvenir, { emotion: 'joie' })).toEqual({ verdict: 'good', gain: 1 });
    expect(evaluateWord(souvenir, { emotion: 'tristesse' })).toEqual({ verdict: 'good', gain: 1 });
    expect(evaluateWord(souvenir, { emotion: 'colere' }).verdict).toBe('neutral');
  });
  it('the needed half carries the hated half; otherwise a hated half agitates', () => {
    expect(evaluateWord(souvenir, { emotion: 'tristesse' }, ['joie']).verdict).toBe('good');
    expect(evaluateWord(souvenir, { emotion: 'colere' }, ['joie']).verdict).toBe('bad');
    expect(evaluateWord(souvenir, { emotion: 'colere' }, ['tristesse']).verdict).toBe('bad');
    // A single-emotion word is still upsetting when hated, whatever the need.
    expect(evaluateWord({ text: 'rire', emotion: 'joie' }, { emotion: 'joie' }, ['joie']).verdict).toBe('bad');
  });
  it('chapters 2 to 4 have bittersweet words, chapter 1 none; all pool words are unique', () => {
    expect(WORD_POOLS[1]!.some((w) => w.emotion2)).toBe(false);
    for (const ch of [2, 3, 4]) {
      const doux = WORD_POOLS[ch]!.filter((w) => w.emotion2);
      expect(doux.length).toBeGreaterThanOrEqual(3);
      for (const w of doux) expect(wordEmotions(w)).toEqual(['joie', 'tristesse']);
    }
    for (const pool of Object.values(WORD_POOLS)) expect(new Set(pool.map((w) => w.text)).size).toBe(pool.length);
  });
});

describe('battle 1.1: Mina the ally', () => {
  const ctx = (o: Partial<AllyContext>): AllyContext => ({ enemyIds: ['nuage'], chapter: 1, party: ['mina'], flags: {}, ...o });
  it('is at Noa\'s side in dream chapters when she is in the party', () => {
    expect(allyState(ctx({}))).toBe('mina');
    expect(allyState(ctx({ chapter: 2 }))).toBe('mina');
    expect(allyState(ctx({ chapter: 3 }))).toBe('mina');
    expect(allyState(ctx({ party: [] }))).toBe('none');
  });
  it('never in the tutorial, the final Dodo battle, the real world or outside chapters 1-3', () => {
    expect(allyState(ctx({ tutorial: true }))).toBe('none');
    expect(allyState(ctx({ noAlly: true }))).toBe('none');
    expect(allyState(ctx({ enemyIds: ['dodo'], chapter: 3 }))).toBe('none');
    expect(allyState(ctx({ bg: 'real' }))).toBe('none');
    expect(allyState(ctx({ flags: { interlude: 1 } }))).toBe('none');
    expect(allyState(ctx({ chapter: 0 }))).toBe('none');
    expect(allyState(ctx({ chapter: 4 }))).toBe('none');
  });
  it('chapter 4: Mina n°366 (party « mina366 ») helps, and sits frozen once La Couseuse was beaten', () => {
    expect(allyState(ctx({ chapter: 4, party: ['mina366'] }))).toBe('mina366');
    expect(allyState(ctx({ chapter: 4, party: ['mina366'], flags: { c4_couseuse: 'vaincue' } }))).toBe('still');
    expect(allyState(ctx({ chapter: 4, party: ['mina366'], flags: { c4_couseuse: 'epargnee' } }))).toBe('mina366');
    expect(allyState(ctx({ chapter: 4, party: [] }))).toBe('none');
    expect(allyState(ctx({ chapter: 4, party: ['mina366'], noAlly: true }))).toBe('none');
    expect(allyState(ctx({ chapter: 4, party: ['mina366'], flags: { interlude: 4 } }))).toBe('none');
    expect(allyState(ctx({ chapter: 3, party: ['mina366'] }))).toBe('none');
    expect(allyState(ctx({ chapter: 5, party: ['mina366'] }))).toBe('none');
  });
  it('leaves an empty slot in chapter 3 once she was erased', () => {
    expect(allyState(ctx({ chapter: 3, party: [], flags: { c3_mina_erased: true } }))).toBe('absent');
    expect(allyState(ctx({ chapter: 2, party: [], flags: { c3_mina_erased: true } }))).toBe('none');
    expect(allyState(ctx({ chapter: 3, party: [], flags: { c3_mina_erased: true }, enemyIds: ['dodo'] }))).toBe('none');
  });
  it('acts every 3rd turn: heals when hurt, else alternates shield and coloring', () => {
    expect([1, 2, 3, 4, 5, 6].filter(allyActsOn)).toEqual([3, 6]);
    expect(pickAllyEffect(10, 20, 'joie', 0)).toBe('heal');
    expect(pickAllyEffect(20, 20, 'joie', 0)).toBe('shield');
    expect(pickAllyEffect(20, 20, 'joie', 1)).toBe('color');
    expect(pickAllyEffect(20, 20, 'neutre', 1)).toBe('shield');
    expect(allyHeal(20)).toBe(5);
    expect(allyHeal(8)).toBe(4);
  });
  it('offers help on exactly the 3rd defeat in a row of the same fight', () => {
    const s = new DefeatStreak();
    s.record('nuage', true, true);
    s.record('nuage', true, true);
    expect(s.offersHelp(false)).toBe(false);
    s.record('nuage', true, true);
    expect(s.count).toBe(3);
    expect(s.offersHelp(false)).toBe(true);
    expect(s.offersHelp(true)).toBe(false);
    s.record('nuage', true, true);
    expect(s.offersHelp(false)).toBe(false);
    // Another fight starts a new streak; a win (or a flight) resets it.
    s.record('gomme', true, true);
    expect(s.count).toBe(1);
    s.record('gomme', false, true);
    expect(s.count).toBe(0);
    // Without Mina at Noa's side, nobody offers anything.
    for (let i = 0; i < 3; i++) s.record('bip', true, false);
    expect(s.offersHelp(false)).toBe(false);
  });
});

describe('chapter 4 battles', () => {
  it('has the special words of its fights in the chapter 4 pool, and fear words for Le Petit Homme', () => {
    const texts = WORD_POOLS[4]!.map((w) => w.text);
    for (const w of ['découdre', 'rendre', 'ouvrir', 'merci', 'reste', 'pâtes', 'mot du frigo']) expect(texts).toContain(w);
    expect(WORD_POOLS[4]!.filter((w) => w.emotion === 'peur').length).toBeGreaterThanOrEqual(4);
  });
  it('declares the fights the story calls, with their special words', () => {
    for (const id of ['pate_froide', 'mot_aimante', 'de_chevalier', 'poupee_brouillon', 'cle', 'poupee_maman', 'couseuse', 'petit_homme']) expect(ENEMIES[id]).toBeTruthy();
    expect(ENEMIES.poupee_maman!.specialWords!.map((w) => w.text).sort()).toEqual(['merci', 'reste']);
    expect(ENEMIES.couseuse!.needs.at(-1)!.word).toBe('découdre');
    expect(ENEMIES.petit_homme!.needs.map((n) => n.emotion ?? n.word)).toEqual(['peur', 'tristesse', 'rendre']);
    expect(ENEMIES.cle!.needs.at(-1)!.word).toBe('ouvrir');
  });
  it('lets harmless projectiles (dmg 0) pass through the soul without using up the shield', () => {
    const w = new BulletWorld();
    w.box = { x: 0, y: 0, w: 100, h: 100 };
    w.soul.x = 50;
    w.soul.y = 50;
    w.shield = 2;
    let hits = 0;
    w.onHit = () => hits++;
    const b = w.spawn({ x: 50, y: 50, r: 3, dmg: 0, data: { pierce: 1 } });
    w.update();
    expect(hits).toBe(0);
    expect(w.shield).toBe(2);
    expect(b.dead).toBe(false);
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

  // v1.1 saves (version 1), one per moment of a run: every one must still load in v2.
  const V11 = (chapter: number, map: string, flags: GameState['flags'], extra: Partial<GameState> = {}): Partial<GameState> => ({
    version: 1,
    playerName: 'Sacha',
    chapter,
    map,
    x: 40,
    y: 60,
    dir: 'down',
    hp: 18,
    etoiles: 5,
    encre: 1,
    items: ['biscuit'],
    keyItems: [],
    souvenirs: ['souvenir_fenetre'],
    flags,
    kills: { gribouille: 1 },
    spares: { nuage: 2 },
    cleared: ['c1_e1'],
    party: chapter > 0 ? ['mina'] : [],
    playtime: 1234,
    savedAt: 1,
    weapon: 'crayon',
    armor: 'pyjama',
    ...extra,
  });
  const V11_SAVES: Record<string, Partial<GameState>> = {
    prologue: V11(0, 'chambre', { interlude: 0, p_reply: 'aime', world: 'real' }),
    chapter1: V11(1, 'prairie', { interlude: 0, c1_sheep_round: 2, world: 'dream' }),
    interlude1: V11(1, 'appartement', { interlude: 1, i1_ate: true, world: 'real' }),
    chapter2: V11(2, 'foret', { interlude: 0, world: 'dream' }),
    interlude2: V11(2, 'appartement_nuit', { interlude: 2, i2_reply: 'pardon', world: 'real' }),
    chapter3: V11(3, 'hopital', { interlude: 0, world: 'ink' }),
    finale: V11(3, 'chambre_mina', { interlude: 3, fin_room: true, world: 'real' }),
    // A very old save: no version, no playerChar, no souvenirs.
    legacy: { playerName: 'Léa', chapter: 1, map: 'prairie', x: 1, y: 1, flags: { interlude: 0 } } as Partial<GameState>,
  };

  it('loads a v1.1 save taken at every step of a run (migration v1 → v2)', () => {
    useMemoryStorage();
    for (const [step, raw] of Object.entries(V11_SAVES)) {
      saveJSON('save.v1', raw);
      const s = readSave()!;
      expect(s, step).not.toBeNull();
      expect(s.version, step).toBe(SAVE_VERSION);
      expect(MAPS[s.map], `${step}: map ${s.map}`).toBeDefined();
      expect(s.chapter, step).toBe(raw.chapter);
      expect(s.playerName, step).toBe(raw.playerName);
      expect(s.playerChar, step).toBe('noa');
      expect(Array.isArray(s.souvenirs) && Array.isArray(s.cleared), step).toBe(true);
      // Every flag survives, except the finale's moment, which moves from 3 to 9.
      const flags = { ...raw.flags };
      if (step === 'finale') flags.interlude = REAL.finale;
      expect(s.flags, step).toEqual(flags);
      // Saving and loading again changes nothing (no double migration).
      writeSave(s);
      expect({ ...readSave()!, savedAt: 0 }, step).toEqual({ ...s, savedAt: 0 });
    }
    deleteSave();
  });

  it('keeps the v1.1 run order: interludes I and II stay 1 and 2, only the old finale moves', () => {
    expect(migrateSave({ version: 1, flags: { interlude: 1 } }).flags.interlude).toBe(1);
    expect(migrateSave({ version: 1, flags: { interlude: 2 } }).flags.interlude).toBe(2);
    expect(migrateSave({ version: 1, flags: { interlude: 3 } }).flags.interlude).toBe(9);
    // A v2 save at interlude III (3) is not touched.
    expect(migrateSave({ version: 2, flags: { interlude: 3 } }).flags.interlude).toBe(3);
    expect([1, 2, 3, 4, 6].map((n) => wakePhase(n as 1 | 2 | 3 | 4 | 6))).toEqual([REAL.i1, REAL.i2, REAL.i3, REAL.i4, REAL.finale]);
  });

  it('migrates the v1.1 meta memory: endings copied to endingsV1, one night per ending', () => {
    useMemoryStorage();
    expect(readMeta()).toMatchObject({ nuits: 365, endingsV1: [], callVersion: null, dodoSilent: false, fauxGenerique: 0, beauxRevesAt: 0 });
    saveJSON('meta.v1', { launches: 7, deaths: 12, endings: ['aube', 'silence'], names: ['Sacha'], poems: [], seen: ['fin_aube'] });
    const m = readMeta();
    expect(m.endings).toEqual(['aube', 'silence']);
    expect(m.endingsV1).toEqual(['aube', 'silence']);
    expect(m.nuits).toBe(367);
    expect(m.deaths).toBe(12);
    expect(m.metaVersion).toBe(2);
    // Once written in the v2 format, v2 endings are never mistaken for v1.1 ones.
    m.endings.push('aube_blanche');
    m.nuits++;
    writeMeta(m);
    const again = readMeta();
    expect(again.endingsV1).toEqual(['aube', 'silence']);
    expect(again.nuits).toBe(368);
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

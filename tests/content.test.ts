import { describe, expect, it } from 'vitest';
import { PAL } from '../src/engine/palette';
import { parseRows } from '../src/engine/sprite';
import { parsePattern } from '../src/engine/audio';
import { SPRITE_MODULES, type SpriteDef } from '../src/game/assets';
import { TILES } from '../src/data/tiles';
import { MAPS } from '../src/data/maps';
import { ENEMIES } from '../src/data/enemies';
import { ITEMS } from '../src/data/items';
import { TRACKS } from '../src/data/music';
import { ILLUSTRATIONS, SOUVENIRS } from '../src/data/illustrations';
import { SPEAKERS } from '../src/data/speakers';
import { PATTERNS } from '../src/game/battle/patterns';
import { WORD_POOLS } from '../src/data/words';
import { ACCENTS, GLYPHS } from '../src/engine/font-data';
import { V2_WORLDS, WORLD_BG, WORLD_MATERIALS, WORLD_TRANSFORMS } from '../src/engine/palette';
import { VARIANT_TRANSFORMS } from '../src/game/assets';
import type { World } from '../src/game/overworld/types';
import { COUNT_ROUNDS, KNOCK_ROUNDS, SHEEP_ROUNDS, TOOTH_ROUNDS, validCount } from '../src/game/scenes/sheepcount';
import { dateLabel } from '../src/game/scenes/phone';
import { CREDIT_LINES, HELP_CARD } from '../src/game/scenes/credits';
import { daysSince, defaultTitleVariant, TITLE_VARIANTS } from '../src/game/scenes/title';
import { parseRich, plainText } from '../src/game/ui/richtext';
import { nightNarratorVoice } from '../src/game/ui/dialogue';
import { DEBUG_SCRIPTS } from '../src/game/story';
import { fallInto, REAL, STORY } from '../src/game/story/common';
import { PHONE_CLOCK } from '../src/game/story/real';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Sprite key index (built without a DOM)
// ---------------------------------------------------------------------------

const ART: Record<string, SpriteDef> = {};
const VARIANT_KEYS = new Set<string>();
const CHAR_IDS = new Set<string>();
for (const mod of SPRITE_MODULES) {
  for (const [k, v] of Object.entries(mod.ART)) {
    ART[k] = v;
    for (const variant of mod.VARIANTS ?? []) VARIANT_KEYS.add(`${k}@${variant}`);
  }
  for (const [id, def] of Object.entries(mod.CHARS ?? {})) {
    CHAR_IDS.add(id);
    for (const variant of def.variants ?? []) CHAR_IDS.add(`${id}@${variant}`);
  }
}
const hasSprite = (k: string) => k in ART || VARIANT_KEYS.has(k);

function artOf(def: SpriteDef): { art: string; colors?: Record<string, string>; pal?: Record<string, string> } {
  return typeof def === 'string' ? { art: def } : def;
}

describe('sprites', () => {
  it('every sprite only uses palette colors', () => {
    const bad: string[] = [];
    for (const [k, def] of Object.entries(ART)) {
      const { art, colors, pal } = artOf(def);
      const allowed = new Set(['.', ' ', ...Object.keys(pal ?? PAL), ...Object.keys(colors ?? {})]);
      const rows = parseRows(art);
      if (!rows.length) bad.push(`${k}: empty`);
      for (const r of rows) for (const ch of r) if (!allowed.has(ch)) bad.push(`${k}: unknown color "${ch}"`);
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('every walking character has consistent frames', () => {
    const bad: string[] = [];
    for (const mod of SPRITE_MODULES) {
      for (const [id, def] of Object.entries(mod.CHARS ?? {})) {
        for (const dir of ['down', 'up', 'left'] as const) {
          const frames = def[dir];
          if (frames.length !== 3) bad.push(`${id}.${dir}: expected 3 frames, got ${frames.length}`);
          const sizes = new Set(frames.map((f) => `${parseRows(f)[0]?.length}x${parseRows(f).length}`));
          if (sizes.size > 1) bad.push(`${id}.${dir}: frames have different sizes ${[...sizes].join(' ')}`);
          for (const f of frames) {
            const allowed = new Set(['.', ' ', ...Object.keys(PAL), ...Object.keys(def.opts?.colors ?? {})]);
            for (const r of parseRows(f)) for (const ch of r) if (!allowed.has(ch)) bad.push(`${id}.${dir}: unknown color "${ch}"`);
          }
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('every speaker portrait exists (neutral expression at least)', () => {
    const missing = Object.entries(SPEAKERS)
      .filter(([, s]) => s.portrait)
      .map(([, s]) => `face_${s.portrait}_neutral`)
      .filter((k) => !hasSprite(k));
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('tiles', () => {
  it('every tile art key exists', () => {
    const missing: string[] = [];
    for (const [id, t] of Object.entries(TILES)) {
      const keys = [...(Array.isArray(t.art) ? t.art : [t.art]), ...(t.anim ?? [])];
      for (const k of keys) if (!hasSprite(k)) missing.push(`${id} → ${k}`);
      if (t.under && !TILES[t.under]) missing.push(`${id} → under ${t.under}`);
    }
    expect(missing).toEqual([]);
  });
});

describe('maps', () => {
  const enemyPlacementIds = new Set<string>();
  for (const [id, map] of Object.entries(MAPS)) {
    describe(id, () => {
      const rows = parseRows(map.tiles);
      const w = rows[0]?.length ?? 0;
      const tileAt = (x: number, y: number) => TILES[map.legend[rows[y]?.[x] ?? ''] ?? ''];
      const walkable = (x: number, y: number) => {
        const t = tileAt(x, y);
        return !!t && !t.solid;
      };

      it('has a valid id and rectangular grid', () => {
        expect(map.id).toBe(id);
        expect(rows.length).toBeGreaterThan(0);
        // parseRows pads short rows with '.', so check raw rows instead.
        const raw = map.tiles
          .replace(/\r/g, '')
          .split('\n')
          .filter((l) => l.trim() !== '');
        const indent = Math.min(...raw.map((l) => /^ */.exec(l)![0].length));
        const lengths = new Set(raw.map((l) => l.slice(indent).replace(/\s+$/, '').length));
        expect([...lengths]).toEqual([w]);
      });

      it('uses only known legend characters and tiles', () => {
        const bad: string[] = [];
        for (const r of rows) for (const ch of r) if (!(ch in map.legend)) bad.push(`char "${ch}" not in legend`);
        for (const [ch, t] of Object.entries(map.legend)) if (!TILES[t]) bad.push(`legend "${ch}" → unknown tile ${t}`);
        expect([...new Set(bad)]).toEqual([]);
      });

      it('spawns are inside the map on walkable tiles', () => {
        const bad: string[] = [];
        expect(Object.keys(map.spawns).length).toBeGreaterThan(0);
        for (const [name, s] of Object.entries(map.spawns)) {
          if (s.x < 0 || s.y < 0 || s.x >= w || s.y >= rows.length) bad.push(`${name} out of bounds`);
          else if (!walkable(s.x, s.y)) bad.push(`${name} (${s.x},${s.y}) on a solid tile`);
        }
        expect(bad).toEqual([]);
      });

      it('warps lead to existing maps and spawns', () => {
        const bad: string[] = [];
        for (const wp of map.warps ?? []) {
          const target = MAPS[wp.to];
          if (!target) bad.push(`warp → unknown map ${wp.to}`);
          else if (!target.spawns[wp.spawn]) bad.push(`warp → ${wp.to} has no spawn "${wp.spawn}"`);
        }
        expect(bad).toEqual([]);
      });

      it('props, NPCs and enemies reference existing sprites and enemies', () => {
        const bad: string[] = [];
        for (const p of map.props ?? []) {
          if (p.sprite !== '' && !hasSprite(p.sprite)) bad.push(`prop sprite ${p.sprite}`);
          for (const fr of p.frames ?? []) if (!hasSprite(fr)) bad.push(`prop frame ${fr}`);
        }
        for (const n of map.npcs ?? []) {
          if (n.char && !CHAR_IDS.has(n.char)) bad.push(`npc ${n.id} char ${n.char}`);
          if (n.sprite && !hasSprite(n.sprite)) bad.push(`npc ${n.id} sprite ${n.sprite}`);
          for (const fr of n.frames ?? []) if (!hasSprite(fr)) bad.push(`npc ${n.id} frame ${fr}`);
          if (!n.char && !n.sprite && !n.frames) bad.push(`npc ${n.id} has no visual`);
        }
        for (const e of map.enemies ?? []) {
          if (enemyPlacementIds.has(e.id)) bad.push(`duplicate enemy placement id ${e.id}`);
          enemyPlacementIds.add(e.id);
          for (const eid of e.enemies) if (!ENEMIES[eid]) bad.push(`enemy ${eid}`);
          const sp = e.sprite ?? `ow_${e.enemies[0]}`;
          if (!hasSprite(sp)) bad.push(`enemy overworld sprite ${sp}`);
        }
        expect(bad).toEqual([]);
      });
    });
  }
});

describe('enemies', () => {
  for (const [id, e] of Object.entries(ENEMIES)) {
    it(`${id} is consistent`, () => {
      const bad: string[] = [];
      if (e.id !== id) bad.push('id mismatch');
      if (!hasSprite(e.sprite)) bad.push(`battle sprite ${e.sprite}`);
      for (const p of e.patterns) if (!PATTERNS[p]) bad.push(`pattern ${p}`);
      if (!e.patterns.length) bad.push('no patterns');
      if (!e.flavor.length || !e.talk.length || !e.reactGood.length || !e.reactBad.length || !e.reactNeutral.length) bad.push('missing texts');
      if (e.rewards.item && !ITEMS[e.rewards.item]) bad.push(`reward item ${e.rewards.item}`);
      for (const n of e.needs) {
        if (n.word && !(e.specialWords ?? []).some((w) => w.text === n.word)) bad.push(`need word "${n.word}" is not in specialWords`);
        if (!n.word && !n.emotion) bad.push('need without emotion or word');
      }
      expect(bad).toEqual([]);
    });
  }
});

describe('music', () => {
  it('has a track registry', () => expect(typeof TRACKS).toBe('object'));
  for (const [id, t] of Object.entries(TRACKS)) {
    it(`${id} parses`, () => {
      expect(t.bpm).toBeGreaterThan(20);
      for (const ch of t.channels) {
        const toks = ch.pattern.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
        const bad = toks.filter((tk) => !/^([.\-xX]|([A-G][#b]?-?\d)(\+[A-G][#b]?-?\d)*)$/.test(tk));
        expect(bad).toEqual([]);
        expect(parsePattern(ch.pattern).length).toBeGreaterThan(0);
      }
    });
  }
});

describe('illustrations & souvenirs', () => {
  it('souvenirs point to existing illustrations', () => {
    const bad = Object.entries(SOUVENIRS)
      .filter(([, s]) => !ILLUSTRATIONS[s.image])
      .map(([k, s]) => `${k} → ${s.image}`);
    expect(bad).toEqual([]);
  });
});

describe('words', () => {
  it('each chapter pool has enough words of each emotion', () => {
    for (const pool of Object.values(WORD_POOLS)) {
      for (const emo of ['joie', 'tristesse', 'colere'] as const) {
        expect(pool.filter((w) => w.emotion === emo).length).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Bitmap font coverage: every non-ASCII character in the game's text must have a glyph (otherwise it renders « ? »).
// ---------------------------------------------------------------------------

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('font', () => {
  const drawable = (ch: string): boolean => !!GLYPHS[ch] || !!ACCENTS[ch] || !!GLYPHS[ch.toUpperCase()];
  it('has a glyph for every character used in strings', () => {
    const missing = new Map<string, string>();
    for (const file of sourceFiles('src')) {
      if (file.includes('sprites') || file.endsWith('font-data.ts')) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\])*)`/g)) {
        for (const ch of m[1] ?? m[2] ?? '') {
          if (ch.charCodeAt(0) > 126 && !drawable(ch) && !missing.has(ch)) missing.set(ch, file);
        }
      }
    }
    expect([...missing].map(([ch, f]) => `${ch} (${f})`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Version 2 groundwork (docs/HISTOIRE.md §7, lot 0): the new worlds and the new scenes.
// ---------------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;
const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  return (0.3 * r + 0.59 * g + 0.11 * b) / 255;
};
const chroma = (hex: string): number => {
  const c = rgbOf(hex);
  return Math.max(...c) - Math.min(...c);
};
const PAL_HEX = Object.values(PAL).filter((h) => HEX.test(h));

describe('v2 worlds', () => {
  it('has the five materials of the bible, each with a transform, a background and sprite variants', () => {
    expect([...V2_WORLDS]).toEqual(['feutre', 'stylo', 'blanc', 'ouate', 'faux']);
    for (const w of V2_WORLDS) {
      expect(typeof WORLD_TRANSFORMS[w], w).toBe('function');
      expect(VARIANT_TRANSFORMS[w], w).toBe(WORLD_TRANSFORMS[w]);
      expect(WORLD_BG[w], w).toMatch(HEX);
    }
  });

  it('maps every palette color to a valid color, and every material pixel too', () => {
    const bad: string[] = [];
    for (const w of V2_WORLDS) {
      const mat = WORLD_MATERIALS[w];
      for (const hex of PAL_HEX) {
        const out = WORLD_TRANSFORMS[w](hex);
        if (!HEX.test(out)) bad.push(`${w}: ${hex} → ${out}`);
        if (!mat) continue;
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++)
            for (const [edge, tile] of [
              [false, false],
              [true, false],
              [false, true],
            ] as const) {
              const px = mat(x, y, out, edge, tile);
              if (!HEX.test(px)) bad.push(`${w} material: (${x},${y}) ${out} → ${px}`);
            }
      }
    }
    expect([...new Set(bad)].slice(0, 10)).toEqual([]);
  });

  it('gives each world its own look', () => {
    const avg = (f: (h: string) => number, xs: string[]) => xs.reduce((a, h) => a + f(h), 0) / xs.length;
    const T = WORLD_TRANSFORMS;
    // feutre: warm (more red than blue on average than the source palette), a little desaturated.
    const warmth = (h: string) => rgbOf(h)[0] - rgbOf(h)[2];
    expect(avg(warmth, PAL_HEX.map(T.feutre))).toBeGreaterThan(avg(warmth, PAL_HEX));
    expect(avg(chroma, PAL_HEX.map(T.feutre))).toBeLessThan(avg(chroma, PAL_HEX));
    // stylo: three levels only (paper, hatching grey, ink), and the darkest is a near-black ink.
    const pen = new Set(PAL_HEX.map(T.stylo));
    expect(pen.size).toBe(3);
    expect(Math.min(...[...pen].map(lum))).toBeLessThan(0.2);
    // blanc: white on white; only the dark lines survive, as blue pen.
    const white = PAL_HEX.map(T.blanc);
    for (const h of white) {
      const [r, , b] = rgbOf(h);
      expect(lum(h) > 0.85 || b > r + 80, h).toBe(true);
    }
    expect(white.some((h) => lum(h) < 0.5)).toBe(true);
    // ouate: yellowed cotton, red ≥ green ≥ blue on (almost) every color.
    const sepia = PAL_HEX.map(T.ouate).filter((h) => {
      const [r, g, b] = rgbOf(h);
      return r + 8 >= g && g + 8 >= b;
    });
    expect(sepia.length / PAL_HEX.length).toBeGreaterThan(0.9);
    // faux: too beautiful, more saturated than the dream.
    expect(avg(chroma, PAL_HEX.map(T.faux))).toBeGreaterThan(avg(chroma, PAL_HEX) * 1.2);
  });

  it('is accepted as a map world, and every map uses a known world', () => {
    const known = new Set(['dream', 'real', 'ink', 'void', ...V2_WORLDS]);
    const worlds: World[] = [...V2_WORLDS];
    expect(worlds.length).toBe(5);
    const bad = Object.values(MAPS)
      .filter((m) => !known.has(m.world))
      .map((m) => `${m.id}: ${m.world}`);
    expect(bad).toEqual([]);
  });
});

describe('v2 scenes', () => {
  it('counting: three skins of three rounds, the v1.1 sheep unchanged', () => {
    expect(Object.keys(COUNT_ROUNDS)).toEqual(['moutons', 'coups', 'dents']);
    expect(COUNT_ROUNDS.moutons).toBe(SHEEP_ROUNDS);
    // The v1.1 rounds (titles and sheep to count) must not move: chapter 1 plays exactly as before.
    expect(SHEEP_ROUNDS.map((r) => [r.title, r.blind, r.tolerance, ...r.seqs.map(validCount)])).toEqual([
      ['Doucement', false, 2, 6],
      ['Le mouton noir', false, 2, 8],
      ['Les yeux fermés', true, 99, 9, 10, 9],
    ]);
    for (const [skin, rounds] of Object.entries(COUNT_ROUNDS)) {
      expect(rounds.length, skin).toBe(3);
      for (const r of rounds) {
        expect(r.interval > 20 && r.window > 0 && r.seqs.length > 0, `${skin} ${r.title}`).toBe(true);
        for (const s of r.seqs) expect(validCount(s), `${skin} ${r.title}`).toBeGreaterThan(3);
      }
    }
    // Knocks: the radiator answers too (decoys), and the last round is counted in the dark.
    expect(KNOCK_ROUNDS.slice(1).every((r) => r.seqs.every((s) => s.includes('B')))).toBe(true);
    expect(KNOCK_ROUNDS[2]!.blind).toBe(true);
    // Teeth: sewing pins among the teeth.
    expect(TOOTH_ROUNDS.slice(1).every((r) => r.seqs.every((s) => s.includes('B')))).toBe(true);
  });

  it('phone: dates a year back, in the real calendar', () => {
    const now = new Date(2026, 9, 9);
    expect(dateLabel(0, now)).toBe('Aujourd\'hui');
    expect(dateLabel(1, now)).toBe('Hier');
    expect(dateLabel(2, now)).toBe('7 oct. 2026');
    expect(dateLabel(365, now)).toBe('9 oct. 2025');
    expect(dateLabel(40, now)).toBe('30 août 2026');
  });

  it('credits: the help line stays, the help card says what the bible says', () => {
    expect(HELP_CARD).toBe('Si tu as des idées noires, tu peux appeler le 3114 (gratuit, 24 h/24). Tu n\'es pas seul·e.');
    expect(CREDIT_LINES.some(([t]) => t.includes('3114'))).toBe(true);
    expect(CREDIT_LINES[CREDIT_LINES.length - 1]![0]).toContain('{player}');
  });

  it('title: the v1.1 looks plus the five v2 variants, and the real days of Beaux rêves', () => {
    for (const v of ['night', 'dawn', 'dream', 'point_de_croix', 'continuer_seul', 'soleil_blanc', 'silence_v2', 'veilleuse']) {
      expect(TITLE_VARIANTS, v).toContain(v);
    }
    expect(defaultTitleVariant([])).toBe('night');
    expect(defaultTitleVariant(['beaux_reves'])).toBe('dream');
    expect(defaultTitleVariant(['silence', 'aube'])).toBe('dawn');
    const day = 86400000;
    expect(daysSince(0)).toBe(0);
    expect(daysSince(1000, 1000 + 23 * day + 5)).toBe(23);
  });

  it('dialogue: {as:…} switches the speaker mid-box, {voice:…} only the blip, {static} crackles', () => {
    const chars = parseRich('Dodo veille sur t{static}—ch—t…{/static}{as:noa}…sur toi.{as:noa:sad} Tu ne dors pas ?{voice:dodo}');
    expect(chars.filter((c) => c.as !== undefined).map((c) => c.as)).toEqual(['noa', 'noa:sad']);
    expect(chars.filter((c) => c.voice !== undefined).map((c) => c.voice)).toEqual(['dodo']);
    // Markers take no room and print nothing.
    expect(chars.filter((c) => c.as !== undefined || c.voice !== undefined).every((c) => c.ch === '')).toBe(true);
    expect(chars.filter((c) => c.fx === 'static').map((c) => c.ch).join('')).toBe('—ch—t…');
    expect(plainText('a{as:noa}b{static}c{/static}')).toBe('abc');
    // {as:noa} needs Noa's name, face and blip.
    expect(SPEAKERS.noa).toMatchObject({ name: 'Noa', voice: 'noa', portrait: 'noa' });
    // The narrator takes Dodo's blip between midnight and 5 a.m., never once Dodo is silent for good.
    expect(nightNarratorVoice(3, false)).toBe('dodo');
    expect(nightNarratorVoice(0, false)).toBe('dodo');
    expect(nightNarratorVoice(5, false)).toBeNull();
    expect(nightNarratorVoice(23, false)).toBeNull();
    expect(nightNarratorVoice(3, true)).toBeNull();
  });

  it('story wiring: six dreams, the real-world phases and their clocks', () => {
    expect(REAL).toEqual({ prologue: 0, i1: 1, i2: 2, i3: 3, i4: 4, finale: 9 });
    expect(PHONE_CLOCK[REAL.i3]).toBe('4:06');
    expect(PHONE_CLOCK[REAL.i4]).toBe('4:44');
    expect(PHONE_CLOCK[REAL.finale]).toBe('5:52');
    expect(typeof fallInto).toBe('function');
    // Until lot 5 wires the new acts, chapter 3 still wakes up into the v1.1 finale.
    expect(STORY.dream[1] && STORY.dream[2] && STORY.dream[3] && STORY.wake[1] && STORY.wake[2] && STORY.wake[3]).toBeTruthy();
  });

  it('debug: every lot 0 demo can be replayed', () => {
    for (const name of ['phone_log', 'phone_home', 'phone_ring', 'faux_generique', 'dialogue_tags', 'count_coups', 'count_dents']) {
      expect(typeof DEBUG_SCRIPTS[name], name).toBe('function');
    }
  });
});

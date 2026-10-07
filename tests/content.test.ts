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

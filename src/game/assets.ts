import { buildSprite, type BuildOptions, type Sprite } from '../engine/sprite';
import * as characterArt from '../data/sprites/characters';
import * as tileArt from '../data/sprites/tiles';
import * as propArt from '../data/sprites/props';
import * as enemyArt from '../data/sprites/enemies';
import * as devArt from '../data/sprites/dev';
import * as epilogueArt from '../data/sprites/epilogue';
import * as bonusArt from '../data/sprites/bonus';
import * as enemyCh4Art from '../data/sprites/enemies-ch4';
import * as chapter4Art from '../data/sprites/chapter4';
import { realify, corrupt, V2_WORLDS, WORLD_MATERIALS, WORLD_TRANSFORMS, type V2World } from '../engine/palette';
import type { Dir } from '../engine/math';

/** A sprite definition: raw art, or art with build options. */
export type SpriteDef = string | ({ art: string } & BuildOptions);

export const SPR: Record<string, Sprite> = {};

export interface CharFrames {
  down: Sprite[];
  up: Sprite[];
  left: Sprite[];
  right: Sprite[];
}

export const CHARS: Record<string, CharFrames> = {};

let placeholder: Sprite | null = null;

/**
 * v2 world variants (`key@feutre`, `key@stylo`, `key@blanc`, `key@ouate`, `key@faux`) exist for every sprite and
 * walking character, but are only built the first time a map of that world asks for them.
 */
const LAZY: Record<string, () => Sprite> = {};
const LAZY_CHARS: Record<string, () => CharFrames> = {};

export function spr(key: string): Sprite {
  const s = SPR[key] ?? buildLazy(key);
  if (s) return s;
  if (!placeholder) {
    placeholder = buildSprite(['P.P', '.P.', 'P.P'], { colors: { P: '#ff00ff' } });
    console.warn(`Missing sprite: ${key}`);
  }
  return placeholder;
}

function buildLazy(key: string): Sprite | undefined {
  const make = LAZY[key];
  if (!make) return undefined;
  delete LAZY[key];
  return (SPR[key] = make());
}

export function hasSpr(key: string): boolean {
  return key in SPR || key in LAZY;
}

export const VARIANT_TRANSFORMS: Record<string, (hex: string) => string> = {
  real: realify,
  ink: corrupt,
  ...WORLD_TRANSFORMS,
};

/** Build options of a v2 world variant (color transform + pixel material). */
function worldOpts(w: V2World, tile: boolean): BuildOptions {
  return { transform: WORLD_TRANSFORMS[w], material: WORLD_MATERIALS[w], tile };
}

/**
 * Registers a set of sprite definitions, optionally with world variants (`key@real`, `key@ink`), plus the lazy v2
 * world variants (`worlds`; `tile` = map tiles, whose materials draw seams and grids instead of borders).
 */
export function register(defs: Record<string, SpriteDef>, variants: string[] = [], worlds: readonly V2World[] = [], tile = false): void {
  for (const [key, def] of Object.entries(defs)) {
    const art = typeof def === 'string' ? def : def.art;
    const opts: BuildOptions = typeof def === 'string' ? {} : def;
    SPR[key] = buildSprite(art, opts);
    for (const v of variants) {
      SPR[`${key}@${v}`] = buildSprite(art, { ...opts, transform: VARIANT_TRANSFORMS[v] });
    }
    // Map tiles (`t_*`, also those of the chapter modules) take the tile material: seams and grids, not borders.
    const isTile = tile || key.startsWith('t_');
    for (const w of worlds) LAZY[`${key}@${w}`] = () => buildSprite(art, { ...opts, ...worldOpts(w, isTile) });
  }
}

/**
 * Registers a walking character from per-direction frames. Right frames are mirrored from left when not provided.
 * Each direction has [stand, step1, step2].
 */
export function registerChar(
  id: string,
  frames: { down: string[]; up: string[]; left: string[]; right?: string[] },
  opts: BuildOptions = {},
  variants: string[] = [],
): void {
  const build = (extra: BuildOptions): CharFrames => {
    const o = { ...opts, ...extra };
    const left = frames.left.map((f) => buildSprite(f, o));
    const right = frames.right
      ? frames.right.map((f) => buildSprite(f, o))
      : frames.left.map((f) => buildSprite(f, { ...o, flipX: true }));
    return {
      down: frames.down.map((f) => buildSprite(f, o)),
      up: frames.up.map((f) => buildSprite(f, o)),
      left,
      right,
    };
  };
  CHARS[id] = build({});
  for (const v of variants) CHARS[`${id}@${v}`] = build({ transform: VARIANT_TRANSFORMS[v] });
  for (const w of V2_WORLDS) LAZY_CHARS[`${id}@${w}`] = () => build(worldOpts(w, false));
}

/** Frame for a walk cycle: stand, step1, stand, step2. */
export function walkFrame(set: CharFrames, dir: Dir, animT: number, moving: boolean): Sprite {
  const frames = set[dir];
  if (!moving || frames.length < 3) return frames[0]!;
  const phase = Math.floor(animT / 9) % 4;
  return frames[phase === 1 ? 1 : phase === 3 ? 2 : 0]!;
}

export function charSet(id: string, variant?: string): CharFrames | undefined {
  if (!variant) return CHARS[id];
  const key = `${id}@${variant}`;
  const lazy = LAZY_CHARS[key];
  if (lazy) {
    delete LAZY_CHARS[key];
    CHARS[key] = lazy();
  }
  return CHARS[key] ?? CHARS[id];
}

/** Walking character definition: [stand, step1, step2] frames per direction. */
export interface CharDef {
  down: string[];
  up: string[];
  left: string[];
  right?: string[];
  opts?: BuildOptions;
  variants?: string[];
}

export interface SpriteModule {
  ART: Record<string, SpriteDef>;
  VARIANTS?: string[];
  CHARS?: Record<string, CharDef>;
}

export const SPRITE_MODULES: SpriteModule[] = [devArt, characterArt, tileArt, propArt, enemyArt, epilogueArt, bonusArt, enemyCh4Art, chapter4Art];

/** Builds every sprite of the game (call once at boot). */
export function buildAll(): void {
  for (const mod of SPRITE_MODULES) {
    register(mod.ART, mod.VARIANTS ?? [], mod === devArt ? [] : V2_WORLDS, mod === tileArt);
    for (const [id, def] of Object.entries(mod.CHARS ?? {})) {
      registerChar(id, def, def.opts ?? {}, def.variants ?? []);
    }
  }
}

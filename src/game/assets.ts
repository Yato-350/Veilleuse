import { buildSprite, type BuildOptions, type Sprite } from '../engine/sprite';
import { realify, corrupt } from '../engine/palette';
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

export function spr(key: string): Sprite {
  const s = SPR[key];
  if (s) return s;
  if (!placeholder) {
    placeholder = buildSprite(['P.P', '.P.', 'P.P'], { colors: { P: '#ff00ff' } });
    console.warn(`Missing sprite: ${key}`);
  }
  return placeholder;
}

export function hasSpr(key: string): boolean {
  return key in SPR;
}

export const VARIANT_TRANSFORMS: Record<string, (hex: string) => string> = {
  real: realify,
  ink: corrupt,
};

/** Registers a set of sprite definitions, optionally with world variants (`key@real`, `key@ink`). */
export function register(defs: Record<string, SpriteDef>, variants: string[] = []): void {
  for (const [key, def] of Object.entries(defs)) {
    const art = typeof def === 'string' ? def : def.art;
    const opts: BuildOptions = typeof def === 'string' ? {} : def;
    SPR[key] = buildSprite(art, opts);
    for (const v of variants) {
      SPR[`${key}@${v}`] = buildSprite(art, { ...opts, transform: VARIANT_TRANSFORMS[v] });
    }
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
}

/** Frame for a walk cycle: stand, step1, stand, step2. */
export function walkFrame(set: CharFrames, dir: Dir, animT: number, moving: boolean): Sprite {
  const frames = set[dir];
  if (!moving || frames.length < 3) return frames[0]!;
  const phase = Math.floor(animT / 9) % 4;
  return frames[phase === 1 ? 1 : phase === 3 ? 2 : 0]!;
}

export function charSet(id: string, variant?: string): CharFrames | undefined {
  return (variant && CHARS[`${id}@${variant}`]) || CHARS[id];
}

import { tr } from '../i18n';
/**
 * Global palette. Every sprite is authored as text where each character is a key of this table.
 * '.' and ' ' are transparent.
 */
export const PAL: Record<string, string> = {
  k: '#1c1424', // outline (dark plum)
  K: '#2d2238',
  w: '#fffaf2', // warm white
  W: '#ece2df',
  g: '#b7aab8',
  G: '#7d6f86',
  d: '#4e4359',
  s: '#fbd7c0', // skin
  S: '#eeb39b',
  t: '#c98572',
  h: '#3f3d63', // Noa hair
  H: '#2b2946',
  m: '#e0834f', // Mina hair
  M: '#b05a3a',
  b: '#a7c7f0', // blues
  B: '#6d8fd6',
  n: '#3d4c8f',
  p: '#f8b6cf', // pinks
  P: '#e07ba5',
  r: '#e8505b', // reds
  R: '#a8324a',
  y: '#ffe991', // yellows
  Y: '#f5c04f',
  o: '#f09a4a', // oranges
  O: '#c46a2e',
  l: '#c4ecaa', // greens
  L: '#8fd28a',
  e: '#5aa76a',
  E: '#3a7558',
  v: '#d4b8f0', // purples
  V: '#9a7bd0',
  u: '#63489a',
  c: '#dcb488', // woods
  C: '#a8774f',
  x: '#6e4a3a',
  a: '#b0f0e6', // aquas
  A: '#5fbfc4',
  q: '#fff3cf', // creams
  Q: '#ecd3a0',
  z: '#22243a', // night
  Z: '#15172a',
  j: '#33365a',
  J: '#4a4e78',
  i: '#0b0710', // ink
  f: '#ffffff',
  '0': '#000000',
  '1': '#5c6080', // real-world wall tones
  '2': '#3e4160',
  '3': '#6d7398',
  '4': '#8a8fb0',
  '5': '#2a2c44',
};

export type Emotion = 'neutre' | 'joie' | 'tristesse' | 'colere' | 'peur';

export const EMOTION_COLOR: Record<Emotion, string> = {
  neutre: '#ffffff',
  joie: '#ffd84a',
  tristesse: '#5aa8ff',
  colere: '#ff4a5a',
  peur: '#b06aff',
};

export const EMOTION_DARK: Record<Emotion, string> = {
  neutre: '#7d6f86',
  joie: '#b5862a',
  tristesse: '#2f5aa8',
  colere: '#a8324a',
  peur: '#63489a',
};

export const EMOTION_LABEL: Record<Emotion, string> = {
  neutre: 'NEUTRE',
  joie: 'JOIE',
  tristesse: 'TRISTESSE',
  colere: 'COLÈRE',
  peur: 'PEUR',
};

/** Color names, for lines such as « je colorie tout en bleu ». */
export const EMOTION_COLOR_NAME: Record<Emotion, string> = {
  neutre: 'blanc',
  joie: 'jaune',
  tristesse: 'bleu',
  colere: 'rouge',
  peur: 'violet',
};

/** HUD label of a soul that may hold two emotions at once (bittersweet words: joie + tristesse = « DOUX-AMER »). */
export function soulLabel(e: Emotion, e2: Emotion | null = null): string {
  if (!e2 || e2 === e) return emotionLabel(e);
  const pair = [e, e2].sort().join('+');
  if (pair === 'joie+tristesse') return tr('DOUX-AMER');
  return `${emotionLabel(e)}/${emotionLabel(e2)}`;
}

/** Translated emotion name (« JOIE » / "JOY"). */
export const emotionLabel = (e: Emotion): string => tr(EMOTION_LABEL[e]);

/** Translated color name (« bleu » / "blue"). */
export const emotionColorName = (e: Emotion): string => tr(EMOTION_COLOR_NAME[e]);

/** UI colors. */
export const UI = {
  bg: '#0d0a14',
  bgSoft: '#1a1424',
  border: '#fffaf2',
  text: '#fffaf2',
  dim: '#8a7f96',
  accent: '#ffd84a',
  danger: '#ff4a5a',
  heal: '#7ee08a',
  paper: '#fff6e0',
  paperLine: '#a7c7f0',
  paperMargin: '#f08a9a',
  ink: '#2b2a5c',
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Transforms a dream color into its "real world" counterpart: desaturated, darker, blue-tinted. */
export function realify(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  const sat = 0.28;
  const nr = lum + (r - lum) * sat;
  const ng = lum + (g - lum) * sat;
  const nb = lum + (b - lum) * sat;
  return rgbToHex(nr * 0.78 + 8, ng * 0.8 + 10, nb * 0.88 + 26);
}

/** Ink-corrupted variant used in chapter 3. */
export function corrupt(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  return rgbToHex(lum * 0.55 + r * 0.25, lum * 0.5 + g * 0.15, lum * 0.6 + b * 0.25);
}

export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ---------------------------------------------------------------------------
// Version 2 worlds (docs/HISTOIRE.md §0: each act has its own material). A world is a color transform (applied to
// every palette color, also used for the organic tile edges) plus an optional per-pixel « material » effect.
// ---------------------------------------------------------------------------

/** The five v2 world materials (map `world` values and sprite variant suffixes `key@feutre`…). */
export const V2_WORLDS = ['feutre', 'stylo', 'blanc', 'ouate', 'faux'] as const;
export type V2World = (typeof V2_WORLDS)[number];

const lumOf = (r: number, g: number, b: number): number => (0.3 * r + 0.59 * g + 0.11 * b) / 255;

/** Ch. 4 « La Maison Cousue » — felt: warm, matte, a little desaturated, a little lighter. */
export function feltify(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  const sat = 0.72;
  const nr = lum + (r - lum) * sat;
  const ng = lum + (g - lum) * sat;
  const nb = lum + (b - lum) * sat;
  return rgbToHex(nr * 0.92 + 30, ng * 0.86 + 14, nb * 0.72 + 6);
}

/** Ch. 4 nights — black ballpoint on off-white: three levels (paper, hatching grey, ink). */
const PEN_INK = '#1d2238';
const PEN_PAPER = '#efe9dc';
const PEN_MID = '#8d8b98';
export function penify(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const l = lumOf(r, g, b);
  return l < 0.3 ? PEN_INK : l < 0.62 ? PEN_MID : PEN_PAPER;
}

/** Ch. 5 « La Marée Blanche » — white on white, every dark line becomes blue pen. */
const WHITE_PEN = '#3b5bd0';
export function whiteout(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const l = lumOf(r, g, b);
  if (l < 0.22) return WHITE_PEN;
  // Everything else fades toward a cold paper white (darker colors keep a faint trace).
  const k = 0.12 * (1 - l);
  return rgbToHex(244 - 70 * k + (r - 244) * 0.06, 246 - 60 * k + (g - 246) * 0.06, 251 - 30 * k + (b - 251) * 0.06);
}

/** Ch. 6 « Le Ventre de Dodo » — yellowed cotton: a sepia ramp that keeps a quarter of the hue. */
export function cottonify(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const l = lumOf(r, g, b);
  const sr = 42 + l * 199;
  const sg = 30 + l * 197;
  const sb = 20 + l * 164;
  return rgbToHex(sr * 0.75 + r * 0.25, sg * 0.75 + g * 0.25, sb * 0.75 + b * 0.25);
}

/** La fausse aube — too beautiful: oversaturated, brighter, warm. */
export function oversaturate(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  const sat = 1.75;
  return rgbToHex((lum + (r - lum) * sat) * 1.06 + 6, (lum + (g - lum) * sat) * 1.05 + 4, (lum + (b - lum) * sat) * 0.98);
}

export const WORLD_TRANSFORMS: Record<V2World, (hex: string) => string> = {
  feutre: feltify,
  stylo: penify,
  blanc: whiteout,
  ouate: cottonify,
  faux: oversaturate,
};

/**
 * Per-pixel material, applied after the color transform. `edge`: the pixel touches transparency (a silhouette
 * border); `tile`: the sprite is a map tile (16×16, laid edge to edge, so patterns must tile at 16 px).
 */
export type PixelMaterial = (x: number, y: number, hex: string, edge: boolean, tile: boolean) => string;

const shade = (hex: string, f: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * f, g * f, b * f);
};
const noise = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
};

export const WORLD_MATERIALS: Partial<Record<V2World, PixelMaterial>> = {
  // Felt: fibrous grain, and every silhouette is sewn — dashes of red thread along the border, like a running stitch.
  // Tiles get stitched seams on their top and left borders (a quilt of felt patches).
  feutre: (x, y, hex, edge, tile) => {
    if (tile && ((y === 0 && x % 4 < 2) || (x === 0 && y % 4 < 2))) return shade(hex, 0.74);
    if (edge && !tile) return (x + y) % 3 === 0 ? '#c8424f' : '#3a1f2a';
    const n = noise(x, y, 41);
    return n < 0.18 ? shade(hex, 0.93) : n > 0.9 ? shade(hex, 1.05) : hex;
  },
  // Ballpoint: the grey level is cross-hatched in ink; tiles show the squared paper (5 mm grid, 8 px).
  stylo: (x, y, hex, edge, tile) => {
    if (edge && !tile) return PEN_INK;
    if (hex === PEN_MID) return (x + y) % 3 === 0 || (tile && (x - y + 32) % 6 === 0) ? PEN_INK : PEN_PAPER;
    if (hex === PEN_PAPER && tile && (x % 8 === 0 || y % 8 === 0)) return '#c9d3e6';
    if (hex === PEN_INK && noise(x, y, 7) < 0.08) return '#2f3a66';
    return hex;
  },
  // White on white: silhouettes are drawn in blue pen; here and there a thick blot of correction fluid.
  blanc: (x, y, hex, edge, tile) => {
    if (edge && !tile) return WHITE_PEN;
    if (hex !== WHITE_PEN && noise(x >> 1, y >> 1, 13) < 0.05) return '#ffffff';
    return hex;
  },
  // Yellowed cotton: mottled, with damp darker stains.
  ouate: (x, y, hex, edge) => {
    const n = noise(x, y, 29);
    const stain = noise(x >> 2, y >> 2, 31) < 0.1 && noise(x, y, 37) < 0.8;
    const f = (stain ? 0.88 : 1) * (n < 0.2 ? 0.95 : n > 0.92 ? 1.04 : 1) * (edge ? 0.9 : 1);
    return f === 1 ? hex : shade(hex, f);
  },
};

/** Default background color outside the map and darkness tint, per world (dream and real keep theirs). */
export const WORLD_BG: Partial<Record<string, string>> = {
  feutre: '#24141c',
  stylo: '#e4ddcd',
  blanc: '#e8ecf4',
  ouate: '#1f170f',
  faux: '#1a1424',
};

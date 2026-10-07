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
  if (!e2 || e2 === e) return EMOTION_LABEL[e];
  const pair = [e, e2].sort().join('+');
  if (pair === 'joie+tristesse') return 'DOUX-AMER';
  return `${EMOTION_LABEL[e]}/${EMOTION_LABEL[e2]}`;
}

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

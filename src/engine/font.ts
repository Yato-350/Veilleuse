import { ACCENTS, ACCENT_PIXELS, FONT_METRICS, GLYPHS } from './font-data';
import { ctx2d, makeCanvas } from './sprite';

interface Glyph {
  w: number;
  px: Array<[number, number]>;
}

const glyphCache = new Map<string, Glyph>();

function parseGlyph(def: string): Glyph {
  const rows = def.split('/');
  const w = Math.max(...rows.map((r) => r.length));
  const px: Array<[number, number]> = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') px.push([x, y + FONT_METRICS.capTop]);
  });
  return { w, px };
}

/** Returns the pixel list for a character, composing accents when needed. Pure (no DOM). */
export function getGlyph(ch: string): Glyph {
  const cached = glyphCache.get(ch);
  if (cached) return cached;
  let glyph: Glyph;
  const def = GLYPHS[ch];
  if (def !== undefined) {
    glyph = parseGlyph(def);
  } else if (ACCENTS[ch]) {
    const [baseCh, accent] = ACCENTS[ch];
    const base = getGlyph(baseCh);
    const w = Math.max(base.w, 3);
    const off = Math.floor((w - base.w) / 2);
    const px: Array<[number, number]> = base.px.map(([x, y]) => [x + off, y]);
    const cx = Math.floor((w - 1) / 2);
    const isUpper = baseCh !== baseCh.toLowerCase();
    if (accent === 'cedil') {
      const top = FONT_METRICS.capTop + 7;
      for (const [dx, r] of ACCENT_PIXELS.cedil) px.push([cx + dx, top + r]);
    } else {
      const top = isUpper ? FONT_METRICS.capAccentTop : FONT_METRICS.lowerAccentTop;
      for (const [dx, r] of ACCENT_PIXELS[accent]) px.push([cx + dx, top + r]);
    }
    glyph = { w, px };
  } else {
    const upper = ch.toUpperCase();
    glyph = upper !== ch && GLYPHS[upper] ? parseGlyph(GLYPHS[upper]) : parseGlyph(GLYPHS['?']!);
  }
  glyphCache.set(ch, glyph);
  return glyph;
}

export function charWidth(ch: string): number {
  return getGlyph(ch).w + FONT_METRICS.spacing;
}

/** Text width in pixels (unscaled). */
export function measure(text: string): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return Math.max(0, w - FONT_METRICS.spacing);
}

/** Greedy word wrap on plain text. Honors explicit '\n'. */
export function wrap(text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= maxWidth || !line) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export const LINE_HEIGHT = FONT_METRICS.lineHeight;

// ---------------------------------------------------------------------------
// Rendering (DOM)
// ---------------------------------------------------------------------------

interface Atlas {
  canvas: HTMLCanvasElement;
  pos: Map<string, number>;
}

const atlases = new Map<string, Atlas>();
const ATLAS_H = FONT_METRICS.lineHeight;

function buildAtlas(color: string, chars: Iterable<string>): Atlas {
  const list = [...new Set(chars)];
  let total = 0;
  const pos = new Map<string, number>();
  for (const ch of list) {
    pos.set(ch, total);
    total += getGlyph(ch).w + 1;
  }
  const canvas = makeCanvas(total, ATLAS_H);
  const g = ctx2d(canvas);
  g.fillStyle = color;
  for (const ch of list) {
    const x0 = pos.get(ch)!;
    for (const [x, y] of getGlyph(ch).px) g.fillRect(x0 + x, y, 1, 1);
  }
  return { canvas, pos };
}

const BASE_CHARS = [
  ...Object.keys(GLYPHS),
  ...Object.keys(ACCENTS),
];

function atlasFor(color: string, ch: string): Atlas {
  let a = atlases.get(color);
  if (!a) {
    a = buildAtlas(color, BASE_CHARS);
    atlases.set(color, a);
  }
  if (!a.pos.has(ch)) {
    // Unknown character: rebuild including it (rare).
    a = buildAtlas(color, [...a.pos.keys(), ch]);
    atlases.set(color, a);
  }
  return a;
}

export interface TextOptions {
  color?: string;
  shadow?: string | null;
  align?: 'left' | 'center' | 'right';
  scale?: number;
  alpha?: number;
}

/** Draws one character; returns the advance (unscaled). */
export function drawChar(g: CanvasRenderingContext2D, ch: string, x: number, y: number, color: string, scale = 1): number {
  const glyph = getGlyph(ch);
  if (ch !== ' ') {
    const a = atlasFor(color, ch);
    const sx = a.pos.get(ch)!;
    g.drawImage(a.canvas, sx, 0, glyph.w, ATLAS_H, Math.round(x), Math.round(y), glyph.w * scale, ATLAS_H * scale);
  }
  return glyph.w + FONT_METRICS.spacing;
}

/** Draws a single line of text. */
export function drawText(g: CanvasRenderingContext2D, text: string, x: number, y: number, opts: TextOptions = {}): number {
  const scale = opts.scale ?? 1;
  const color = opts.color ?? '#fffaf2';
  const w = measure(text) * scale;
  let cx = x;
  if (opts.align === 'center') cx = Math.round(x - w / 2);
  else if (opts.align === 'right') cx = x - w;
  const prevAlpha = g.globalAlpha;
  if (opts.alpha !== undefined) g.globalAlpha = prevAlpha * opts.alpha;
  if (opts.shadow) {
    let sx = cx;
    for (const ch of text) sx += drawChar(g, ch, sx + scale, y + scale, opts.shadow, scale) * scale;
  }
  for (const ch of text) cx += drawChar(g, ch, cx, y, color, scale) * scale;
  g.globalAlpha = prevAlpha;
  return w;
}

/** Draws text wrapped to a width. Returns the number of lines. */
export function drawWrapped(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: TextOptions & { lineHeight?: number } = {},
): number {
  const lines = wrap(text, maxWidth / (opts.scale ?? 1));
  const lh = (opts.lineHeight ?? LINE_HEIGHT) * (opts.scale ?? 1);
  lines.forEach((line, i) => {
    const lx = opts.align === 'center' ? x + maxWidth / 2 : opts.align === 'right' ? x + maxWidth : x;
    drawText(g, line, lx, y + i * lh, opts);
  });
  return lines.length;
}

/** Draws text with a 1px outline on all sides (used for big titles and floating numbers). */
export function drawOutlined(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  outline: string,
  opts: Omit<TextOptions, 'color' | 'shadow'> = {},
): void {
  const s = opts.scale ?? 1;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
  ] as const) {
    drawText(g, text, x + dx * s, y + dy * s, { ...opts, color: outline, shadow: null });
  }
  drawText(g, text, x, y, { ...opts, color, shadow: null });
}

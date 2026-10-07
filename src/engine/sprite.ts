import { PAL } from './palette';

export interface Sprite {
  img: HTMLCanvasElement;
  w: number;
  h: number;
  /** Anchor (pivot) in sprite pixels. drawSprite(x, y) puts the anchor at (x, y). */
  ax: number;
  ay: number;
}

export interface BuildOptions {
  pal?: Record<string, string>;
  /** Extra per-sprite colors that override the palette. */
  colors?: Record<string, string>;
  /** Color transform applied to every opaque pixel (e.g. realify). */
  transform?: (hex: string) => string;
  flipX?: boolean;
  /** Adds a 1px outline around opaque pixels (canvas grows by 1px on each side). */
  outline?: string;
  /** Anchor; defaults to bottom-center. */
  ax?: number;
  ay?: number;
}

/** Parses a multi-line template string into rows, removing blank edges and common indentation. */
export function parseRows(src: string): string[] {
  const lines = src.replace(/\r/g, '').split('\n');
  while (lines.length && lines[0]!.trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop();
  let indent = Infinity;
  for (const l of lines) {
    if (l.trim() === '') continue;
    const m = /^ */.exec(l)!;
    indent = Math.min(indent, m[0].length);
  }
  if (!isFinite(indent)) indent = 0;
  const rows = lines.map((l) => l.slice(indent).replace(/\s+$/, ''));
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width, '.'));
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { willReadFrequently: false })!;
  g.imageSmoothingEnabled = false;
  return g;
}

const isClear = (ch: string | undefined): boolean => ch === undefined || ch === '.' || ch === ' ';

/** Renders text rows into a canvas sprite. */
export function buildSprite(src: string | string[], opts: BuildOptions = {}): Sprite {
  const rows = typeof src === 'string' ? parseRows(src) : src;
  const pal = opts.colors ? { ...(opts.pal ?? PAL), ...opts.colors } : (opts.pal ?? PAL);
  const h0 = rows.length;
  const w0 = rows[0]?.length ?? 0;
  const pad = opts.outline ? 1 : 0;
  const w = w0 + pad * 2;
  const h = h0 + pad * 2;
  const canvas = makeCanvas(w, h);
  const g = ctx2d(canvas);
  const img = g.createImageData(w, h);
  const cache = new Map<string, [number, number, number]>();
  const rgb = (ch: string): [number, number, number] => {
    let v = cache.get(ch);
    if (!v) {
      let hex = pal[ch] ?? '#ff00ff';
      if (opts.transform) hex = opts.transform(hex);
      const n = parseInt(hex.slice(1), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      cache.set(ch, v);
    }
    return v;
  };
  const put = (x: number, y: number, c: [number, number, number]) => {
    const i = (y * w + x) * 4;
    img.data[i] = c[0];
    img.data[i + 1] = c[1];
    img.data[i + 2] = c[2];
    img.data[i + 3] = 255;
  };
  const at = (x: number, y: number): string | undefined => {
    if (y < 0 || y >= h0 || x < 0 || x >= w0) return undefined;
    const sx = opts.flipX ? w0 - 1 - x : x;
    return rows[y]![sx];
  };
  if (opts.outline) {
    const oc = rgb(opts.outline);
    for (let y = -1; y <= h0; y++) {
      for (let x = -1; x <= w0; x++) {
        if (!isClear(at(x, y))) continue;
        if (!isClear(at(x - 1, y)) || !isClear(at(x + 1, y)) || !isClear(at(x, y - 1)) || !isClear(at(x, y + 1))) {
          put(x + pad, y + pad, oc);
        }
      }
    }
  }
  for (let y = 0; y < h0; y++) {
    for (let x = 0; x < w0; x++) {
      const ch = at(x, y);
      if (isClear(ch)) continue;
      put(x + pad, y + pad, rgb(ch!));
    }
  }
  g.putImageData(img, 0, 0);
  return {
    img: canvas,
    w,
    h,
    ax: (opts.ax ?? Math.floor(w0 / 2)) + pad,
    ay: (opts.ay ?? h0) + pad,
  };
}

/** Wraps an existing canvas as a sprite. */
export function canvasSprite(img: HTMLCanvasElement, ax = Math.floor(img.width / 2), ay = img.height): Sprite {
  return { img, w: img.width, h: img.height, ax, ay };
}

export function drawSprite(
  g: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  opts?: { alpha?: number; scaleX?: number; scaleY?: number },
): void {
  if (!opts || (opts.alpha === undefined && opts.scaleX === undefined && opts.scaleY === undefined)) {
    g.drawImage(s.img, Math.round(x - s.ax), Math.round(y - s.ay));
    return;
  }
  const sx = opts.scaleX ?? 1;
  const sy = opts.scaleY ?? 1;
  const prev = g.globalAlpha;
  if (opts.alpha !== undefined) g.globalAlpha = prev * opts.alpha;
  const dw = Math.round(s.w * sx);
  const dh = Math.round(s.h * sy);
  g.drawImage(s.img, Math.round(x - s.ax * sx), Math.round(y - s.ay * sy), dw, dh);
  g.globalAlpha = prev;
}

/** Returns a solid-color silhouette of a sprite (for hit flashes, shadows, ink effects). */
const silhouetteCache = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>();
export function silhouette(s: Sprite, color: string): Sprite {
  let byColor = silhouetteCache.get(s.img);
  if (!byColor) {
    byColor = new Map();
    silhouetteCache.set(s.img, byColor);
  }
  let c = byColor.get(color);
  if (!c) {
    c = makeCanvas(s.w, s.h);
    const g = ctx2d(c);
    g.drawImage(s.img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, s.w, s.h);
    byColor.set(color, c);
  }
  return { ...s, img: c };
}

/** Builds the same art as several variants (dream / real / corrupted). */
export function variants(src: string | string[], opts: BuildOptions, transforms: Record<string, (hex: string) => string>) {
  const out: Record<string, Sprite> = { base: buildSprite(src, opts) };
  for (const [k, t] of Object.entries(transforms)) out[k] = buildSprite(src, { ...opts, transform: t });
  return out;
}

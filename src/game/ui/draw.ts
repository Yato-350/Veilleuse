/** Shared UI drawing helpers (boxes, bars, cursors). */

export type BoxStyle = 'dream' | 'real' | 'paper' | 'dodo' | 'none' | 'battle';

const STYLES: Record<Exclude<BoxStyle, 'none'>, { bg: string; border: string; inner: string; outer: string }> = {
  dream: { bg: '#1a1424', border: '#fffaf2', inner: '#3a2c4c', outer: '#0b0710' },
  battle: { bg: '#000000', border: '#fffaf2', inner: '#000000', outer: '#000000' },
  real: { bg: '#0f111c', border: '#8a8fb0', inner: '#22243a', outer: '#05060a' },
  paper: { bg: '#fff6e0', border: '#a8774f', inner: '#ecd3a0', outer: '#4e3528' },
  dodo: { bg: '#0b0710', border: '#9a7bd0', inner: '#2a1838', outer: '#000000' },
};

export function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: BoxStyle = 'dream', alpha = 1): void {
  if (style === 'none') return;
  const s = STYLES[style];
  const prev = g.globalAlpha;
  g.globalAlpha = prev * alpha;
  g.fillStyle = s.outer;
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = s.border;
  g.fillRect(x, y, w, h);
  g.fillStyle = s.bg;
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle = s.inner;
  g.fillRect(x + 2, y + 2, w - 4, 1);
  g.fillRect(x + 2, y + 2, 1, h - 4);
  if (style === 'paper') {
    g.fillStyle = '#d7e6f7';
    for (let ly = y + 14; ly < y + h - 3; ly += 13) g.fillRect(x + 3, ly, w - 6, 1);
  }
  g.globalAlpha = prev;
}

export function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function strokeRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, t = 1): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, t);
  g.fillRect(x, y + h - t, w, t);
  g.fillRect(x, y, t, h);
  g.fillRect(x + w - t, y, t, h);
}

/** Horizontal bar (HP etc.). */
export function bar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  back = '#3a1c2c',
  ghost?: number,
): void {
  rect(g, x, y, w, h, back);
  if (ghost !== undefined && ghost > ratio) rect(g, x, y, Math.round(w * Math.min(1, ghost)), h, '#fffaf2');
  rect(g, x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), h, fill);
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

/** Small 7x6 heart (menu cursor / soul icon). */
export function heart(g: CanvasRenderingContext2D, x: number, y: number, color = '#ff4a5a', scale = 1): void {
  g.fillStyle = color;
  for (let r = 0; r < HEART.length; r++) {
    const row = HEART[r]!;
    for (let c = 0; c < row.length; c++) if (row[c] === '#') g.fillRect(x + c * scale, y + r * scale, scale, scale);
  }
}

/** Little downward triangle that bobs (continue prompt). */
export function nextArrow(g: CanvasRenderingContext2D, x: number, y: number, t: number, color = '#fffaf2'): void {
  const dy = Math.floor(t / 15) % 2;
  g.fillStyle = color;
  g.fillRect(x, y + dy, 5, 1);
  g.fillRect(x + 1, y + 1 + dy, 3, 1);
  g.fillRect(x + 2, y + 2 + dy, 1, 1);
}

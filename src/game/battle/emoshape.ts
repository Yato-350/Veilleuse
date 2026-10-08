import { EMOTION_COLOR, type Emotion } from '../../engine/palette';

/**
 * Accessibility: one small shape per emotion (setting « Formes des émotions »), so that colors are never the only cue.
 * joie = sun, tristesse = drop, colère = anger mark (spikes), peur = spiral, neutre = ring (soul / HUD / notebook only:
 * white projectiles stay plain).
 */
export const EMO_ICONS: Record<Emotion, string[]> = {
  joie: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
  tristesse: ['..#..', '..#..', '.###.', '#####', '.###.'],
  colere: ['.#.#.', '##.##', '.....', '##.##', '.#.#.'],
  peur: ['#####', '....#', '###.#', '#...#', '#####'],
  neutre: ['.###.', '#...#', '#...#', '#...#', '.###.'],
};

export const ICON_SIZE = 5;

/** Draws the 5×5 icon of `emo` with its top-left corner at (x, y), with an optional 1px outline. */
export function drawEmoIcon(g: CanvasRenderingContext2D, emo: Emotion, x: number, y: number, color: string, outline?: string): void {
  const icon = EMO_ICONS[emo];
  if (outline) {
    g.fillStyle = outline;
    for (let r = 0; r < ICON_SIZE; r++) {
      for (let c = 0; c < ICON_SIZE; c++) {
        if (icon[r]![c] !== '#') continue;
        g.fillRect(x + c - 1, y + r, 1, 1);
        g.fillRect(x + c + 1, y + r, 1, 1);
        g.fillRect(x + c, y + r - 1, 1, 1);
        g.fillRect(x + c, y + r + 1, 1, 1);
      }
    }
  }
  g.fillStyle = color;
  for (let r = 0; r < ICON_SIZE; r++) {
    for (let c = 0; c < ICON_SIZE; c++) if (icon[r]![c] === '#') g.fillRect(x + c, y + r, 1, 1);
  }
}

/**
 * A shape « token » centered on (cx, cy): a dark rounded 7×7 chip with the icon in the emotion's color, drawn over a
 * colored projectile. The current globalAlpha is kept (harmless projectiles stay faded).
 */
export function drawEmoToken(g: CanvasRenderingContext2D, emo: Emotion, cx: number, cy: number): void {
  if (emo === 'neutre') return;
  const x = Math.round(cx) - 3;
  const y = Math.round(cy) - 3;
  g.fillStyle = '#0b0710';
  g.fillRect(x + 1, y, 5, 7);
  g.fillRect(x, y + 1, 7, 5);
  drawEmoIcon(g, emo, x + 1, y + 1, EMOTION_COLOR[emo]);
}

const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
/** Column where the second color starts on each row of a bicolor heart (a zigzag crack down the middle). */
const CRACK = [3, 4, 3, 4, 3, 4];

/** The soul's heart: one color, or split by a zigzag crack for a bicolor (bittersweet) soul. 7×6 (× scale). */
export function soulHeart(g: CanvasRenderingContext2D, x: number, y: number, c1: string, c2: string | null = null, scale = 1): void {
  for (let r = 0; r < HEART.length; r++) {
    const row = HEART[r]!;
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '#') continue;
      g.fillStyle = c2 && c >= CRACK[r]! ? c2 : c1;
      g.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

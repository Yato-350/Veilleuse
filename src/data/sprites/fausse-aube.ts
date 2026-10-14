import type { SpriteDef } from '../../game/assets';
import { parseRows } from '../../engine/sprite';
import { CHARS as CHARACTER_CHARS } from './characters';
import { ART as TILE_ART } from './tiles';

/*
 * La fausse aube (docs/HISTOIRE.md § 3.9, § 4 « Fausse aube »): the same apartment as the real world, too beautiful.
 * The maps are of world `faux` (palette.ts: oversaturated), so everything here is drawn in plain colours and gets the
 * too-bright look like every other sprite.
 *
 * Tiles `t_fa_*`: the real-world tiles (same shapes, same boards, same wallpaper lattice) recoloured in warm morning
 * tones — butter wallpaper with coral dots, honey parquet, a pink rug, white doors with a brass knob.
 * Props `prop_fa_*`: the window that moved onto the wardrobe's wall, a crayon sun in it (a yellow ring with rays,
 * two « v » birds drawn beside it), the same window, smaller, for the hallway (the same sun, at the same place), the
 * paler rectangle where a window used to be, the paler patch of floor where the toy box stood, a sheet of drawn suns.
 * Maman (`pose_fa_maman_*`): standing, sitting on the edge of the bed, arms open — her mouth sewn shut with a few red
 * stitches, too small to be sure of at this size. Her eyes are open. She smiles. She always smiles.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Toolkit (a tiny pixel canvas on palette characters, as in the other sprite modules)
// ---------------------------------------------------------------------------------------------------------------------

class Px {
  g: string[][];
  constructor(w: number, h: number) {
    this.g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  }
  static of(src: string): Px {
    const rows = parseRows(src);
    const p = new Px(Math.max(...rows.map((r) => r.length)), rows.length);
    rows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && c !== ' ' && p.px(x, y, c)));
    return p;
  }
  get w(): number {
    return this.g[0]?.length ?? 0;
  }
  get h(): number {
    return this.g.length;
  }
  get(x: number, y: number): string {
    return this.g[Math.round(y)]?.[Math.round(x)] ?? '.';
  }
  px(x: number, y: number, c: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (y >= 0 && y < this.h && x >= 0 && x < this.w) this.g[y]![x] = c;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }
  hl(x: number, y: number, len: number, c: string): this {
    return this.rect(x, y, len, 1, c);
  }
  vl(x: number, y: number, len: number, c: string): this {
    return this.rect(x, y, 1, len, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    return this;
  }
  /** Pastes another canvas ('.' skipped). */
  blit(p: Px, ox = 0, oy = 0): this {
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.get(x, y) !== '.') this.px(ox + x, oy + y, p.get(x, y));
    return this;
  }
  toString(): string {
    return this.g.map((r) => r.join('')).join('\n');
  }
}

/** Small deterministic hash in [0, 1). */
const hash = (x: number, y: number, seed: number): number => {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------------------------------------------------------------
// Tiles — the real apartment's shapes in morning colours
// ---------------------------------------------------------------------------------------------------------------------

/** The real tile's art (string), whatever form its definition takes. */
const base = (key: string): string => {
  const def = TILE_ART[key]!;
  return typeof def === 'string' ? def : def.art;
};
const recolor = (key: string, colors: Record<string, string>): SpriteDef => ({ art: base(key), colors });

/** Wallpaper: butter yellow, coral dots, peach petals; a cream rim on top, a white baseboard. */
const WALLPAPER = { '2': '#f6dca0', '1': '#ef8f84', J: '#f7b9a0', '4': '#fff4da', j: '#e2b878', '3': '#fffaf0' };
/** Honey parquet. */
const PARQUET = { j: '#d99f5c', J: '#efc27f', z: '#9a6034', '5': '#be8447' };
/** The pink rug. */
const RUG = { '2': '#f2a0b6', J: '#fbcad6', j: '#d97b98' };
/** Kitchen checker: white and baby blue. */
const CHECKER = { '1': '#ffffff', '3': '#f3f7ff', j: '#cfe0f4', '2': '#bcd2ec', z: '#9fb6d2', '5': '#9fb6d2' };
/** White painted doors, brass knob, set in the same wallpaper. */
const DOOR = { ...WALLPAPER, '1': '#ead2a8', d: '#fbf2df', K: '#e1cba5', G: '#fffcf4', g: '#f5c04f' };
/** The top of the walls (the cut through the ceiling): warm brown instead of night. */
const WALL_TOP = { Z: '#6e4230', '5': '#7f4f38' };

const TILES: Record<string, SpriteDef> = {
  t_fa_floor_1: recolor('t_r_floor_1', PARQUET),
  t_fa_floor_2: recolor('t_r_floor_2', PARQUET),
  t_fa_floor_3: recolor('t_r_floor_3', PARQUET),
  t_fa_carpet_1: recolor('t_r_carpet_1', RUG),
  t_fa_carpet_2: recolor('t_r_carpet_2', RUG),
  t_fa_tile_1: recolor('t_r_tile_1', CHECKER),
  t_fa_tile_2: recolor('t_r_tile_2', CHECKER),
  t_fa_wall: recolor('t_r_wall', WALLPAPER),
  t_fa_wall_base: recolor('t_r_wall_base', WALLPAPER),
  t_fa_wall_top_1: recolor('t_r_wall_top_1', WALL_TOP),
  t_fa_wall_top_2: recolor('t_r_wall_top_2', WALL_TOP),
  t_fa_door_top: recolor('t_r_door_top', DOOR),
  t_fa_door: recolor('t_r_door', DOOR),
};

// ---------------------------------------------------------------------------------------------------------------------
// The window and its crayon sun
// ---------------------------------------------------------------------------------------------------------------------

/** Local colours of the windows and drawings. */
const FA: Record<string, string> = {
  '6': '#86cdf4', // sky, high
  '7': '#b8e4fb', // sky, middle
  '8': '#ffd6a8', // sky, peach
  '9': '#ffaebf', // sky, pink (low)
  '%': '#f6c33a', // crayon yellow, pressed hard
  '&': '#ffe36b', // crayon yellow
  '@': '#e8823a', // crayon orange (rays)
  $: '#5a6fb8', // crayon blue (birds)
  '+': '#fff6e6', // paper
  '=': '#ead9bd', // paper, shade
  '~': '#f4e6c8', // pale wallpaper (where a frame hung)
  '^': '#e9cf98', // its edge
  '<': '#e6b06e', // pale parquet (where the toy box stood)
  '>': '#d1964f', // its edge
};

/** Sky with soft bands (dithered between them), from blue at the top to pink at the bottom. */
function sky(p: Px, x0: number, y0: number, w: number, h: number): void {
  const bands = ['6', '7', '8', '9'];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = (y / Math.max(1, h - 1)) * (bands.length - 1);
      const i = Math.floor(v);
      const c = v - i > ((x * 3 + y * 5) % 4) / 4 + 0.12 ? bands[Math.min(i + 1, 3)]! : bands[i]!;
      p.px(x0 + x, y0 + y, c);
    }
}

/**
 * A sun drawn in wax crayon: a ring pressed hard, filled in quick strokes that leave the sky showing through, rays of
 * uneven length (one of them goes too far). `r` is the radius of the ring.
 */
function crayonSun(p: Px, cx: number, cy: number, r: number, seed: number): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y);
      if (d > r + 0.4) continue;
      if (d > r - 0.9) p.px(cx + x, cy + y, '%');
      else if (hash(x, y + (x % 2), seed) > 0.22) p.px(cx + x, cy + y, (x + y * 2 + 9) % 5 === 0 ? '%' : '&');
    }
  const rays = 9;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + 0.3;
    const len = r + 2 + Math.round(hash(i, 3, seed) * 3) + (i === 4 ? 3 : 0);
    p.line(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), cx + Math.cos(a) * len, cy + Math.sin(a) * len, '@');
  }
}

/** Two crayon birds, a « v » each. */
function crayonBirds(p: Px, x: number, y: number): void {
  p.px(x, y, '$').px(x + 1, y + 1, '$').px(x + 2, y, '$');
  p.px(x + 5, y + 2, '$').px(x + 6, y + 3, '$').px(x + 7, y + 2, '$');
}

/** A window: white frame, sill, cross bars; the sky, the sun (and birds) inside. */
function window(w: number, h: number, sun: { x: number; y: number; r: number }, birds: boolean): string {
  const p = new Px(w, h);
  // Casing: outline, white wood, a shade on the right and under the top.
  p.rect(0, 0, w, h - 3, 'x');
  p.rect(1, 1, w - 2, h - 5, 'w');
  p.vl(w - 2, 1, h - 5, 'W');
  // Panes.
  const px0 = 3;
  const py0 = 3;
  const pw = w - 6;
  const ph = h - 9;
  sky(p, px0, py0, pw, ph);
  crayonSun(p, px0 + sun.x, py0 + sun.y, sun.r, w);
  if (birds) crayonBirds(p, px0 + 2, py0 + 3);
  // Cross bars (over the drawing: the sun is behind the glass).
  const mx = px0 + Math.floor(pw / 2);
  const my = py0 + Math.floor(ph / 2);
  p.vl(mx, py0, ph, 'w');
  p.hl(px0, my, pw, 'w');
  p.vl(mx + 1, py0, ph, 'W');
  // Inner shadow of the casing on the glass.
  p.hl(px0, py0, pw, 'W');
  // Sill.
  p.rect(0, h - 4, w, 2, 'w');
  p.hl(0, h - 3, w, 'W');
  p.hl(1, h - 2, w - 2, 'x');
  p.hl(0, h - 4, 1, 'x').hl(w - 1, h - 4, 1, 'x');
  return p.toString();
}

/** The paler rectangle on the wallpaper where something hung for years (a window, says Noa; nothing, says the text). */
function paleWall(): string {
  const p = new Px(14, 13);
  p.rect(0, 0, 14, 13, '^');
  p.rect(1, 1, 12, 11, '~');
  for (const [x, y] of [
    [3, 3],
    [9, 7],
    [5, 9],
  ] as const)
    p.px(x, y, '^');
  return p.toString();
}

/** The paler patch of floor where the toy box stood. */
function paleFloor(): string {
  const p = new Px(16, 8);
  p.rect(1, 0, 14, 8, '>');
  p.rect(2, 1, 12, 6, '<');
  for (let x = 2; x < 14; x += 4) p.vl(x, 1, 6, '>');
  return p.toString();
}

/** Three drawings of suns taped above the counter: the same sun, three times. */
function drawnSuns(): string {
  const p = new Px(26, 12);
  for (let i = 0; i < 3; i++) {
    const x = i * 9;
    const y = i === 1 ? 0 : 1;
    p.rect(x, y, 8, 10, '=');
    p.rect(x, y, 7, 9, '+');
    crayonSun(p, x + 3, y + 4, 2, 7);
    p.px(x + 3, y, 'y');
  }
  return p.toString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Maman, too gentle
// ---------------------------------------------------------------------------------------------------------------------

/** Her standing frame (eyes open), the mouth row replaced by a few red stitches. */
const MAMAN_STAND = CHARACTER_CHARS.maman!.down[0]!;

function sewn(p: Px, ox: number, oy: number): Px {
  // Mouth at frame row 11, columns 7–8: red instead of pink — lips, at first glance; a stitch going under the chin.
  p.px(ox + 7, oy + 11, 'r').px(ox + 8, oy + 11, 'R');
  p.px(ox + 8, oy + 12, 'R');
  return p;
}

/** Standing, hands at her sides. */
const STAND = sewn(Px.of(MAMAN_STAND), 0, 0).toString();

/** Sitting on the edge of the bed: the same head and shoulders, a lap, two knees (16x24). */
const SIT = (() => {
  const src = sewn(Px.of(MAMAN_STAND), 0, 0);
  const p = new Px(16, 24);
  for (let y = 0; y <= 18; y++) for (let x = 0; x < 16; x++) if (src.get(x, y) !== '.') p.px(x, y, src.get(x, y));
  // Lap (her skirt), hands folded on it, knees and shoes.
  p.rect(2, 19, 12, 3, 'c').hl(2, 21, 12, 'C').rect(6, 18, 4, 2, 's').hl(6, 19, 4, 'S');
  p.rect(4, 22, 3, 2, 'K').rect(9, 22, 3, 2, 'K');
  p.vl(1, 13, 9, 'k').vl(14, 13, 9, 'k').hl(1, 22, 3, 'k').hl(12, 22, 3, 'k');
  return p.toString();
})();

/** Arms open, for the hug (24 wide). She does not lower them. */
const OPEN_ARMS = (() => {
  const src = sewn(Px.of(MAMAN_STAND), 0, 0);
  const p = new Px(24, src.h);
  p.blit(src, 4, 0);
  // The hands leave her sides: coat where they were.
  for (const x of [6, 7, 16, 17]) {
    if (p.get(x, 20) === 's') p.px(x, 20, x < 12 ? 'c' : 'C');
    if (p.get(x, 21) === 'k' && x !== 5 && x !== 18) p.px(x, 21, 'C');
  }
  // The arms, held out sideways and a little up (sleeve, cuff, hand).
  for (const [dir, sx] of [
    [-1, 5],
    [1, 18],
  ] as const) {
    for (let i = 0; i < 5; i++) {
      const x = sx + dir * i;
      const y = 15 - Math.floor(i / 2);
      p.px(x, y - 1, 'k').px(x, y, i < 4 ? 'c' : 's').px(x, y + 1, i < 4 ? 'C' : 's').px(x, y + 2, 'k');
    }
    p.px(sx + dir * 5, 12, 'k').px(sx + dir * 5, 13, 's').px(sx + dir * 5, 14, 'k');
  }
  return p.toString();
})();

/**
 * The route of the ink: where her face should be, a blot of ink (every skin and feature pixel of the face, the hair
 * kept), and two drips over her collar. `faceRows`: the rows of the face in that frame.
 */
function inked(src: string, faceRows: [number, number], ox = 0): string {
  const p = Px.of(src);
  for (let y = faceRows[0]; y <= faceRows[1]; y++)
    for (let x = ox + 3; x <= ox + 12; x++) if ('sStrRk'.includes(p.get(x, y)) && p.get(x - 1, y) !== '.' && p.get(x + 1, y) !== '.') p.px(x, y, 'i');
  p.px(ox + 6, faceRows[1] + 1, 'i').px(ox + 6, faceRows[1] + 2, 'i').px(ox + 9, faceRows[1] + 1, 'i');
  return p.toString();
}

const sprite = (art: string): SpriteDef => ({ art, colors: FA });

export const ART: Record<string, SpriteDef> = {
  ...TILES,
  prop_fa_fenetre: sprite(window(32, 30, { x: 18, y: 5, r: 4 }, true)),
  prop_fa_fenetre_petite: sprite(window(16, 26, { x: 6, y: 4, r: 2 }, false)),
  prop_fa_mur_clair: sprite(paleWall()),
  prop_fa_sol_clair: sprite(paleFloor()),
  prop_fa_soleils: sprite(drawnSuns()),
  pose_fa_maman: STAND,
  pose_fa_maman_assise: SIT,
  pose_fa_maman_bras: OPEN_ARMS,
  pose_fa_maman_encre: inked(STAND, [6, 12]),
  pose_fa_maman_assise_encre: inked(SIT, [6, 12]),
  pose_fa_maman_bras_encre: inked(OPEN_ARMS, [6, 12], 4),
};

export const VARIANTS: string[] = [];

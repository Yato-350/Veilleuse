import { drawText, measure } from '../../engine/font';
import { drawSprite, makeCanvas } from '../../engine/sprite';
import { hasSpr, spr } from '../assets';
import { isNative, toast } from '../pwa';
import type { SavedPoem } from '../state';
import { lang, tf, tr, trLine } from '../../i18n';

/**
 * Poems as notebook pages: the page drawn in the gallery (same look as the finale's PaperScene) and the picture the
 * player can keep — rendered off-screen at 1x with the bitmap font, then upscaled pixel-perfect into a PNG that is
 * shared (Web Share API, mobile) or downloaded (desktop).
 */

const DESK = '#2a1e18';
const EDGE = '#4e3528';
const PAPER = '#fff6e0';
const RULE = '#d7e6f7';
const MARGIN = '#f08a9a';
const INK = '#2b2a5c';
const RED = '#a8324a';
const FADED = '#9a8f8a';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; // i18n-ignore
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; // i18n-ignore

/** « le 8 octobre 2026 » / "October 8, 2026" (no locale lookup: always the same glyphs). */
export function poemDate(at: number): string {
  const d = new Date(at);
  if (lang() === 'en') return `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return `le ${d.getDate() === 1 ? '1er' : d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; // i18n-ignore
}

/** Lines for display. Saved poems keep their French text (the source) and are translated line by line. */
export function poemLines(poem: SavedPoem): string[] {
  return poem.text.split('\n').map(trLine);
}

/** The finale's poems open with « Pour Mina. »: the title is then already on the page. */
function needsTitle(poem: SavedPoem): boolean {
  const first = (poemLines(poem)[0] ?? '').replace(/[.!…,]+$/, '').trim().toLowerCase();
  return !!poem.title && first !== tr(poem.title).trim().toLowerCase();
}

const TEXT_X = 24;
const FIRST_RULE = 16;
const TITLE_SPACE = 12;
const DATE_SPACE = 14;

/** Page height that fits the whole poem at the normal 12px line spacing. */
export function poemPageHeight(poem: SavedPoem): number {
  return FIRST_RULE + (needsTitle(poem) ? TITLE_SPACE : 0) + poemLines(poem).length * 12 + DATE_SPACE;
}

/** Page width that fits the longest line. */
export function poemPageWidth(poem: SavedPoem, min = 176): number {
  const widest = Math.max(measure(tr(poem.title)) - TEXT_X + 12, ...poemLines(poem).map(measure));
  return Math.max(min, widest + TEXT_X + 16);
}

/**
 * A notebook page with the poem written on it: ruled paper, red margin, a star sticker, the date in pencil.
 * Lines sit on the rules (descenders cross them, like handwriting). `shown` limits the visible lines.
 */
export function drawPoemPage(g: CanvasRenderingContext2D, poem: SavedPoem, x: number, y: number, w: number, h: number, shown = Infinity): void {
  const lines = poemLines(poem);
  const title = needsTitle(poem);
  g.fillStyle = EDGE;
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = PAPER;
  g.fillRect(x, y, w, h);
  const top = y + FIRST_RULE + (title ? TITLE_SPACE : 0);
  const room = y + h - DATE_SPACE - top;
  const lh = Math.max(9, Math.min(12, Math.floor(room / Math.max(1, lines.length))));
  g.fillStyle = RULE;
  for (let ly = top; ly < y + h - 3; ly += lh) g.fillRect(x + 2, ly, w - 4, 1);
  g.fillStyle = MARGIN;
  g.fillRect(x + 16, y, 1, h);
  // Mina's star stickers were on everything she owned.
  star(g, x + w - 12, y + 4, '#f9cf3a', '#d89a1a');
  if (title) drawText(g, tr(poem.title), x + w / 2, y + 5, { align: 'center', color: RED });
  lines.slice(0, shown).forEach((line, i) => drawText(g, line, x + TEXT_X, top + i * lh - 8, { color: INK }));
  if (shown >= lines.length) drawText(g, poemDate(poem.at), x + w - 6, y + h - 11, { align: 'right', color: FADED });
}

const STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.'];

function star(g: CanvasRenderingContext2D, x: number, y: number, c: string, shade: string): void {
  STAR.forEach((row, r) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] !== '#') continue;
      g.fillStyle = r === STAR.length - 1 ? shade : c;
      g.fillRect(x + i, y + r, 1, 1);
    }
  });
}

/** The picture to keep: the page on the desk, signed « Veilleuse » under a little nightlight. 1x canvas. */
export function renderPoemCard(poem: SavedPoem): HTMLCanvasElement {
  const pw = poemPageWidth(poem, 184);
  const ph = poemPageHeight(poem);
  const m = 14;
  const cw = pw + m * 2;
  const ch = ph + m + 44;
  const c = makeCanvas(cw, ch);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = DESK;
  g.fillRect(0, 0, cw, ch);
  // Wood grain, deterministic
  g.fillStyle = '#33251d';
  for (let i = 0; i < 24; i++) g.fillRect((i * 37) % cw, 3 + ((i * 53) % (ch - 6)), 6 + ((i * 7) % 14), 1);
  // A soft shadow under the page, then the page itself
  g.fillStyle = '#1c140f';
  g.fillRect(m + 2, m + 2, pw + 1, ph + 1);
  drawPoemPage(g, poem, m, m, pw, ph);
  // A strip of tape holding it to the desk
  g.fillStyle = 'rgba(249,233,170,0.75)';
  g.fillRect(m + Math.floor(pw / 2) - 12, m - 4, 24, 8);
  // Signature
  const sy = m + ph + 12;
  let sx = Math.floor(cw / 2);
  const sig = 'Veilleuse';
  const sw = measure(sig);
  if (hasSpr('prop_veilleuse')) {
    const s = spr('prop_veilleuse');
    const left = sx - Math.floor((s.w + 4 + sw) / 2);
    const glow = g.createRadialGradient(left + s.w / 2, sy + 4, 0, left + s.w / 2, sy + 4, 16);
    glow.addColorStop(0, 'rgba(255,233,145,0.35)');
    glow.addColorStop(1, 'rgba(255,233,145,0)');
    g.fillStyle = glow;
    g.fillRect(left - 16, sy - 12, s.w + 32, 32);
    drawSprite(g, s, left + s.ax, sy + 9);
    sx = left + s.w + 4;
    drawText(g, sig, sx, sy, { color: '#ffe991' });
  } else {
    drawText(g, sig, sx, sy, { color: '#ffe991', align: 'center' });
  }
  drawText(g, tr('Fais de beaux rêves.'), Math.floor(cw / 2), sy + 12, { color: '#9a7bd0', align: 'center' });
  return c;
}

/** Nearest-neighbour upscale to about 1080px wide (integer factor, so every pixel stays a crisp square). */
export function upscale(src: HTMLCanvasElement, target = 1080): HTMLCanvasElement {
  const k = Math.max(2, Math.round(target / src.width));
  const c = makeCanvas(src.width * k, src.height * k);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function fileName(poem: SavedPoem): string {
  const d = new Date(poem.at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `veilleuse-${lang() === 'en' ? 'poem' : 'poeme'}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`;
}

/** Renders the poem picture as a PNG file. Start it early: sharing must happen close to the player's key press. */
export function poemFile(poem: SavedPoem): Promise<File> {
  const canvas = upscale(renderPoemCard(poem));
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(new File([blob], fileName(poem), { type: 'image/png' }));
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/**
 * Keeps the poem: the system share sheet with the PNG where files can be shared (phones), a download elsewhere.
 * Never throws; the player is told what happened with a toast.
 */
export async function sharePoem(poem: SavedPoem, file?: Promise<File>): Promise<ShareResult> {
  let f: File;
  try {
    f = await (file ?? poemFile(poem));
  } catch {
    toast('Le poème n\'a pas pu être enregistré. Désolé.');
    return 'failed';
  }
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  let canShareFiles: boolean;
  try {
    canShareFiles = !!nav.share && !!nav.canShare?.({ files: [f] });
  } catch {
    canShareFiles = false;
  }
  if (canShareFiles) {
    try {
      await nav.share({ files: [f], title: tr(poem.title), text: tf('« {0} » — un poème écrit dans Veilleuse.', tr(poem.title)) });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return 'cancelled';
      // NotAllowedError (gesture expired) or a share target that failed: fall back to a download.
    }
  }
  if (isNative()) {
    // The app's web view can neither share files nor download them.
    toast('Impossible de garder l\'image sur cet appareil. Le poème reste dans ton carnet.');
    return 'failed';
  }
  try {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast(tf('Poème enregistré : {0}', f.name));
    return 'downloaded';
  } catch {
    toast('Le poème n\'a pas pu être enregistré. Désolé.');
    return 'failed';
  }
}

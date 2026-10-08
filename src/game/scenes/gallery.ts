import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawOutlined, drawText, measure, wrap } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { makeCanvas } from '../../engine/sprite';
import { ILLUSTRATIONS, SOUVENIRS } from '../../data/illustrations';
import { G, type SavedPoem } from '../state';
import { box, heart } from '../ui/draw';
import { drawPoemPage, poemDate, poemFile, poemLines, sharePoem, type ShareResult } from '../ui/share';

/**
 * « Carnet de souvenirs » — opened from the title screen after a first ending.
 *  - Souvenirs: every illustration seen in any run (G.meta.seen), taped into a notebook as small photos; the ones not
 *    found yet are blank « ? » pages. A opens one full screen with its title and captions, ◀ ▶ turn the pages.
 *  - Poèmes: the poems written for Mina (G.meta.poems), newest first, on the same paper as the finale; « Garder ce
 *    poème » turns the page into a PNG to share or download (src/game/ui/share.ts).
 */

export interface GalleryEntry {
  key: string;
  kind: string;
  title: string;
  captions: string[];
}

const KIND_SOUVENIR = 'Souvenir';
const KIND_REAL = 'L\'appartement';
const KIND_CARNET = 'Le carnet de Mina';
const KIND_FIN = 'Fin';

/** Story order. Souvenirs take their title and captions from SOUVENIRS; the others repeat what the game said. */
const CATALOG: Array<[key: string, kind: string, title: string, captions: string[]]> = [
  ['souvenir_fenetre', KIND_SOUVENIR, '', []],
  ['souvenir_dessin', KIND_SOUVENIR, '', []],
  ['souvenir_veilleuse', KIND_SOUVENIR, '', []],
  ['photo_famille', KIND_REAL, 'La photo de l\'été', ['Maman, toi, et Mina avec sa couronne en papier.', 'Tu avais oublié que tu souriais comme ça.']],
  [
    'tv_mina',
    KIND_REAL,
    'La vidéo',
    [
      '« Noa ! Noa, regarde ! Regarde ce que j\'ai dessiné ! »',
      '« Ça, c\'est toi, avec tes cheveux bleus. Et moi, je suis la lune ! »',
      '« Tu le gardes, hein ? Promis ? Promis juré ? »',
    ],
  ],
  ['carnet_couverture', KIND_CARNET, 'Le Pays de Coton', ['Un carnet à spirale, des gommettes en forme d\'étoile.', '« Le Pays de Coton — pour Noa »']],
  ['carnet_page1', KIND_CARNET, 'La prairie', ['Une prairie pleine de coton. Un garçon aux cheveux bleus.', 'Une princesse avec une cape et une couronne.']],
  ['carnet_page2', KIND_CARNET, 'Le village des moutons', ['Un village de moutons. Une chaussette marchande.', '« elle cherche sa paire !! »']],
  ['carnet_page3', KIND_CARNET, 'La forêt de crayons', ['Une forêt de crayons. Un hibou à lunettes. Des lucioles.']],
  ['carnet_page4', KIND_CARNET, 'La dernière page', ['« Si tu as peur du noir, regarde la lune. Moi je serai ta veilleuse. »', 'Elle l\'avait écrit pour toi, bien avant tout ça.']],
  ['fin_aube', KIND_FIN, 'L\'aube', ['Le soleil se lève sur la chambre de Mina.', 'Pour la première fois depuis un an, il fait jour.']],
  ['fin_jardin', KIND_FIN, 'Le jardin', ['Derrière vous, la veilleuse brille en plein jour.', 'Personne ne la remarque vraiment.', 'Mais elle brille.']],
  [
    'fin_beaux_reves',
    KIND_FIN,
    'Beaux rêves',
    ['Noa dort. Il fait de beaux rêves.', 'Dans le rêve, il fait toujours nuit, et personne n\'est jamais triste.', 'Dans l\'appartement, la veilleuse grésille encore un peu. Puis plus rien.'],
  ],
  ['fin_silence', KIND_FIN, 'Le silence', ['Le Pays de Coton est noyé d\'encre.', 'Il n\'y a plus de moutons. Plus de lune. Plus de princesse.', 'Il n\'y a plus personne pour se souvenir de rien.']],
  ['maman_aube', 'Les rêves des autres', 'Cinq heures cinquante', ['Maman a dormi. Deux heures, d\'une traite.', 'Sur la table, le réveil est face contre le bois.', '« Je rentre. »']],
];

/** Every illustration of the game, in story order; ones added later without a catalog entry go at the end. */
export function galleryEntries(): GalleryEntry[] {
  const out: GalleryEntry[] = [];
  const known = new Set<string>();
  for (const [key, kind, title, captions] of CATALOG) {
    if (!ILLUSTRATIONS[key]) continue;
    known.add(key);
    const s = Object.values(SOUVENIRS).find((x) => x.image === key);
    out.push({ key, kind, title: title || s?.title || 'Un souvenir', captions: captions.length ? captions : (s?.captions ?? []) });
  }
  for (const key of Object.keys(ILLUSTRATIONS)) {
    if (!known.has(key)) out.push({ key, kind: 'Un rêve', title: 'Un autre souvenir', captions: [] });
  }
  return out;
}

// --- Thumbnails --------------------------------------------------------------------------------------------------

const TW = W / 5;
const TH = H / 5;
/** Kept between visits: painting an illustration's static layer the first time is not free. */
const THUMBS = new Map<string, HTMLCanvasElement>();

/** 1/5 scale, each thumbnail pixel the average of a 5x5 block (soft, like a small photo). */
function makeThumb(key: string): HTMLCanvasElement {
  const full = makeCanvas(W, H);
  const fg = full.getContext('2d', { willReadFrequently: true })!;
  fg.imageSmoothingEnabled = false;
  fg.fillStyle = '#0b0710';
  fg.fillRect(0, 0, W, H);
  ILLUSTRATIONS[key]?.(fg, 0);
  const src = fg.getImageData(0, 0, W, H).data;
  const out = makeCanvas(TW, TH);
  const og = out.getContext('2d')!;
  const img = og.createImageData(TW, TH);
  for (let ty = 0; ty < TH; ty++) {
    for (let tx = 0; tx < TW; tx++) {
      let r = 0;
      let gg = 0;
      let b = 0;
      for (let dy = 0; dy < 5; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const i = ((ty * 5 + dy) * W + tx * 5 + dx) * 4;
          r += src[i]!;
          gg += src[i + 1]!;
          b += src[i + 2]!;
        }
      }
      const o = (ty * TW + tx) * 4;
      img.data[o] = r / 25;
      img.data[o + 1] = gg / 25;
      img.data[o + 2] = b / 25;
      img.data[o + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

// --- Layout ------------------------------------------------------------------------------------------------------

const DESK = '#2a1e18';
const PAPER = '#fff6e0';
const INK = '#2b2a5c';
const RED = '#a8324a';
const FADED = '#9a8f8a';
const GOLD = '#ffd84a';

const PAGE = { x: 8, y: 22, w: W - 16, h: 142 };
const COLS = 4;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
const CELL_W = TW + 4;
const CELL_H = TH + 4;
const GAP_X = 8;
const GAP_Y = 6;
const GRID_X = PAGE.x + Math.floor((PAGE.w - (COLS * CELL_W + (COLS - 1) * GAP_X)) / 2);
const GRID_Y = PAGE.y + Math.floor((PAGE.h - (ROWS * CELL_H + (ROWS - 1) * GAP_Y)) / 2);
const ROW_H = 26;
const LIST_ROWS = 5;

type Tab = 0 | 1;
type Mode = 'grid' | 'view' | 'poem';

export class GalleryScene implements Scene {
  private t = 0;
  private fade = 1;
  private closing = false;
  private prevMusic: string | null = null;
  private entries = galleryEntries();
  private poems: SavedPoem[] = [];
  private tab: Tab = 0;
  private onTabs = false;
  private mode: Mode = 'grid';
  private cell = 0;
  private poemIdx = 0;
  private listTop = 0;
  // Full-screen view
  private viewKey = '';
  private viewT = 0;
  private caption = 0;
  // Poem page
  private poemT = 0;
  private file: Promise<File> | null = null;
  private busy = false;
  private result: ShareResult | null = null;
  private resultT = 0;
  // Direct touch / mouse: region tapped / hovered this frame ('tab:1', 'cell:3', 'poem:0', 'prev', 'next', 'keep', 'close'…)
  private tapped: string | null = null;
  private hovered: string | null = null;

  enter(): void {
    this.poems = [...G.meta.poems].sort((a, b) => b.at - a.at);
    if (!this.seenCount() && this.poems.length) this.tab = 1;
    this.prevMusic = audio.currentMusic;
    audio.playMusic('room_quiet', { fadeIn: 1.5 });
    audio.sfx('pop', { pitch: 0.7 });
  }

  exit(): void {
    if (this.prevMusic) audio.playMusic(this.prevMusic, { fadeIn: 1.5 });
  }

  private seen(key: string): boolean {
    return G.meta.seen.includes(key);
  }

  private seenCount(): number {
    return this.entries.filter((e) => this.seen(e.key)).length;
  }

  private seenEntries(): GalleryEntry[] {
    return this.entries.filter((e) => this.seen(e.key));
  }

  private get confirm(): boolean {
    return input.pressed('a');
  }

  /** B, or the ✕ tapped. */
  private get back(): boolean {
    return input.pressed('b') || this.tapped === 'close';
  }

  /** Index of a region id such as 'cell:3' when it has the given prefix. */
  private static num(prefix: string, id: string | null): number | null {
    return id?.startsWith(`${prefix}:`) ? Number(id.slice(prefix.length + 1)) : null;
  }

  update(): void {
    this.t++;
    if (this.closing) {
      this.fade = Math.min(1, this.fade + 0.12);
      if (this.fade >= 1) game.remove(this);
      return;
    }
    this.fade = Math.max(0, this.fade - 0.1);
    this.bakeOneThumb();
    if (this.resultT > 0) this.resultT--;
    const hit = hits.pick(this);
    this.tapped = hit?.tap ? String(hit.id) : null;
    this.hovered = hit && !hit.tap ? String(hit.id) : null;
    if (this.mode === 'view') this.updateView();
    else if (this.mode === 'poem') this.updatePoem();
    else this.updateGrid();
  }

  /** Thumbnails appear one per frame, like photos being developed. */
  private bakeOneThumb(): void {
    const e = this.entries.find((x) => this.seen(x.key) && !THUMBS.has(x.key));
    if (e) THUMBS.set(e.key, makeThumb(e.key));
  }

  // --- Notebook (tabs, grid, poem list) --------------------------------------------------------------------------

  private updateGrid(): void {
    if (this.back) {
      this.closing = true;
      audio.sfx('cancel');
      return;
    }
    if (input.pressed('menu')) return this.switchTab(this.tab === 0 ? 1 : 0);
    const tab = GalleryScene.num('tab', this.tapped);
    if (tab !== null) {
      this.switchTab(tab as Tab);
      this.onTabs = false;
      return;
    }
    if (this.onTabs) {
      if (input.repeat('left') || input.repeat('right')) this.switchTab(this.tab === 0 ? 1 : 0);
      else if (input.repeat('down') || this.confirm) {
        this.onTabs = false;
        audio.sfx('move');
      }
      return;
    }
    if (this.tab === 0) this.updateCells();
    else this.updateList();
  }

  private switchTab(tab: Tab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    audio.sfx('move');
  }

  private updateCells(): void {
    const n = this.entries.length;
    const col = this.cell % COLS;
    const inPage = this.cell % PER_PAGE;
    let next = this.cell;
    // Touch / mouse: hover highlights, a tap opens the photo; ◀ ▶ under the page or a flick turns it.
    const over = GalleryScene.num('cell', this.hovered);
    if (over !== null && over !== this.cell) {
      this.cell = over;
      audio.sfx('move');
    }
    const tapped = GalleryScene.num('cell', this.tapped);
    if (tapped !== null) {
      this.cell = tapped;
      const e = this.entries[tapped];
      if (e && this.seen(e.key)) this.openView(e.key);
      else audio.sfx('miss');
      return;
    }
    const turn = this.tapped === 'pgnext' || input.swipe === 'left' ? 1 : this.tapped === 'pgprev' || input.swipe === 'right' ? -1 : 0;
    const page = Math.floor(this.cell / PER_PAGE) + turn;
    if (turn && page >= 0 && page * PER_PAGE < n) {
      this.cell = Math.min(n - 1, page * PER_PAGE + inPage);
      audio.sfx('whoosh', { pitch: 1.6, vol: 0.4 });
      return;
    }
    // Left/right past the edge turns the page (same row); up from the first row reaches the tabs.
    if (input.repeat('left')) next = col > 0 ? this.cell - 1 : this.cell >= PER_PAGE ? this.cell - PER_PAGE + COLS - 1 : this.cell;
    else if (input.repeat('right')) {
      const turn = this.cell - inPage + PER_PAGE;
      next = col < COLS - 1 && this.cell < n - 1 ? this.cell + 1 : turn < n ? this.cell - col + PER_PAGE : this.cell;
    }
    else if (input.repeat('up')) {
      if (inPage < COLS) {
        this.onTabs = true;
        audio.sfx('move');
        return;
      }
      next = this.cell - COLS;
    } else if (input.repeat('down')) next = inPage + COLS < PER_PAGE ? this.cell + COLS : this.cell;
    else if (this.confirm) {
      const e = this.entries[this.cell];
      if (e && this.seen(e.key)) this.openView(e.key);
      else audio.sfx('miss');
      return;
    }
    if (next !== this.cell) {
      // A short last page clamps to its last photo.
      next = Math.max(0, Math.min(n - 1, next));
      if (next === this.cell) return;
      if (Math.floor(next / PER_PAGE) !== Math.floor(this.cell / PER_PAGE)) audio.sfx('whoosh', { pitch: 1.6, vol: 0.4 });
      else audio.sfx('move');
      this.cell = next;
    }
  }

  private updateList(): void {
    const n = this.poems.length;
    if (!n) {
      if (input.repeat('up')) {
        this.onTabs = true;
        audio.sfx('move');
      }
      return;
    }
    const over = GalleryScene.num('poem', this.hovered);
    if (over !== null && over !== this.poemIdx) {
      this.poemIdx = over;
      audio.sfx('move');
    }
    const tapped = GalleryScene.num('poem', this.tapped);
    if (tapped !== null) return this.openPoem(tapped);
    if (this.tapped === 'up' || this.tapped === 'down') {
      this.poemIdx = this.tapped === 'up' ? Math.max(0, this.listTop - 1) : Math.min(n - 1, this.listTop + LIST_ROWS);
      audio.sfx('move');
    } else if (input.repeat('up')) {
      if (this.poemIdx === 0) this.onTabs = true;
      else this.poemIdx--;
      audio.sfx('move');
    } else if (input.repeat('down') && this.poemIdx < n - 1) {
      this.poemIdx++;
      audio.sfx('move');
    } else if (this.confirm) this.openPoem(this.poemIdx);
    this.listTop = Math.max(0, Math.min(this.listTop, this.poemIdx, n - LIST_ROWS));
    if (this.poemIdx >= this.listTop + LIST_ROWS) this.listTop = this.poemIdx - LIST_ROWS + 1;
  }

  // --- Full-screen illustration ------------------------------------------------------------------------------------

  private openView(key: string): void {
    this.mode = 'view';
    this.viewKey = key;
    this.viewT = 0;
    this.caption = 0;
    audio.sfx('whoosh', { pitch: 1.4, vol: 0.4 });
  }

  private updateView(): void {
    this.viewT++;
    const list = this.seenEntries();
    const i = list.findIndex((e) => e.key === this.viewKey);
    const e = list[i];
    if (this.back || !e) {
      this.mode = 'grid';
      const back = this.entries.findIndex((x) => x.key === this.viewKey);
      if (back >= 0) this.cell = back;
      audio.sfx('cancel');
      return;
    }
    // Touch: ◀ ▶ on the sides or a flick change the picture; a tap anywhere else shows the next caption.
    const prev = input.repeat('left') || this.tapped === 'prev' || input.swipe === 'right';
    const step = prev ? -1 : input.repeat('right') || this.tapped === 'next' || input.swipe === 'left' ? 1 : 0;
    if (step && list.length > 1) {
      this.viewKey = list[(i + step + list.length) % list.length]!.key;
      this.caption = 0;
      audio.sfx('whoosh', { pitch: 1.6, vol: 0.35 });
    } else if (this.confirm || input.tap) {
      // Captions one by one; past the last one the text hides so the picture can be seen whole; then again.
      this.caption = this.caption >= Math.max(1, e.captions.length) ? 0 : this.caption + 1;
      audio.sfx('blip', { vol: 0.5 });
    }
  }

  // --- Poem page ---------------------------------------------------------------------------------------------------

  private openPoem(i: number): void {
    const p = this.poems[i];
    if (!p) return;
    this.mode = 'poem';
    this.poemIdx = i;
    this.poemT = 0;
    this.result = null;
    this.resultT = 0;
    // Rendered ahead of time: the share sheet must open close to the key press that asks for it.
    const f = poemFile(p);
    f.catch(() => undefined);
    this.file = f;
    audio.sfx('pop', { pitch: 0.7 });
  }

  private poemShown(): number {
    return Math.floor(this.poemT / 8);
  }

  private updatePoem(): void {
    this.poemT++;
    const p = this.poems[this.poemIdx];
    if (!p) {
      this.mode = 'grid';
      return;
    }
    const lines = poemLines(p).length;
    if (this.poemShown() < lines) {
      if (this.poemT % 8 === 0 && poemLines(p)[this.poemShown() - 1]) audio.sfx('write', { pitch: 0.9, vol: 0.5 });
      if (this.confirm || input.tap || this.tapped || input.pressed('b')) this.poemT = lines * 8;
      return;
    }
    if (this.busy) return;
    if (this.back) {
      this.mode = 'grid';
      audio.sfx('cancel');
      return;
    }
    const prev = input.repeat('left') || this.tapped === 'prev' || input.swipe === 'right';
    const step = prev ? -1 : input.repeat('right') || this.tapped === 'next' || input.swipe === 'left' ? 1 : 0;
    if (step && this.poems.length > 1) {
      const n = this.poems.length;
      this.openPoem((this.poemIdx + step + n) % n);
      this.listTop = Math.max(0, Math.min(this.poemIdx, n - LIST_ROWS));
      return;
    }
    if (this.confirm || this.tapped === 'keep') {
      this.busy = true;
      audio.sfx('select');
      void sharePoem(p, this.file ?? undefined).then((r) => {
        this.busy = false;
        this.result = r;
        this.resultT = r === 'shared' || r === 'downloaded' ? 180 : 0;
        if (r === 'shared' || r === 'downloaded') audio.sfx('chime', { pitch: 1.2 });
        else if (r === 'failed') audio.sfx('cancel');
      });
    }
  }

  // --- Drawing -----------------------------------------------------------------------------------------------------

  draw(g: CanvasRenderingContext2D): void {
    if (this.mode === 'view') this.drawView(g);
    else if (this.mode === 'poem') this.drawPoem(g);
    else this.drawNotebook(g);
    if (this.fade > 0) {
      g.fillStyle = `rgba(5,3,10,${this.fade})`;
      g.fillRect(0, 0, W, H);
    }
  }

  private drawDesk(g: CanvasRenderingContext2D): void {
    g.fillStyle = DESK;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#33251d';
    for (let i = 0; i < 30; i++) g.fillRect((i * 67) % W, 2 + ((i * 41) % (H - 4)), 8 + ((i * 13) % 22), 1);
    // The nightlight's glow, somewhere off the edge of the desk
    const glow = g.createRadialGradient(W, H, 0, W, H, 120);
    glow.addColorStop(0, 'rgba(255,233,145,0.14)');
    glow.addColorStop(1, 'rgba(255,233,145,0)');
    g.fillStyle = glow;
    g.fillRect(W - 120, H - 120, 120, 120);
  }

  private drawNotebook(g: CanvasRenderingContext2D): void {
    this.drawDesk(g);
    const p = PAGE;
    // The cover peeking out around the page
    g.fillStyle = '#0b0710';
    g.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
    g.fillStyle = '#3a2c4c';
    g.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
    g.fillStyle = PAPER;
    g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle = '#f3e9cf';
    for (let ly = p.y + 12; ly < p.y + p.h - 2; ly += 12) g.fillRect(p.x + 2, ly, p.w - 4, 1);
    this.drawTabs(g);
    if (this.tab === 0) this.drawGrid(g);
    else this.drawList(g);
    if (this.onTabs) {
      const hint = this.tab === 0 ? 'Les images gardées, d\'une nuit à l\'autre.' : 'Les poèmes que tu as écrits pour Mina.';
      drawText(g, hint, W / 2, H - 12, { align: 'center', color: '#8a7f96' });
    }
  }

  private tabLabels(): string[] {
    return [`Souvenirs ${this.seenCount()}/${this.entries.length}`, this.poems.length ? `Poèmes ${this.poems.length}` : 'Poèmes'];
  }

  private drawTabs(g: CanvasRenderingContext2D): void {
    let x = PAGE.x + 4;
    this.tabLabels().forEach((label, i) => {
      const sel = i === this.tab;
      const focus = sel && this.onTabs;
      const w = measure(label) + 14 + (focus ? 9 : 0);
      const y = sel ? 4 : 6;
      g.fillStyle = '#0b0710';
      g.fillRect(x - 1, y - 1, w + 2, PAGE.y - y + 1);
      g.fillStyle = sel ? PAPER : '#c9b48e';
      g.fillRect(x, y, w, PAGE.y - y + (sel ? 1 : -2));
      drawText(g, label, x + 7 + (focus ? 9 : 0), y + 2, { color: sel ? RED : '#5e4636' });
      if (focus) heart(g, x + 5, y + 6 - Math.round(Math.abs(Math.sin(this.t * 0.08))), '#ff4a5a');
      hits.add(this, `tab:${i}`, x, y - 2, w, PAGE.y - y + 2);
      x += w + 3;
    });
    const close = input.pointerUsed;
    drawText(g, 'Carnet de souvenirs', W - (close ? 20 : 8), 6, { align: 'right', color: '#ffe991', shadow: '#120c0a' });
    if (close) this.drawClose(g, W - 12, 6);
  }

  private drawGrid(g: CanvasRenderingContext2D): void {
    const page = Math.floor(this.cell / PER_PAGE);
    const pages = Math.max(1, Math.ceil(this.entries.length / PER_PAGE));
    const start = page * PER_PAGE;
    this.entries.slice(start, start + PER_PAGE).forEach((e, k) => {
      const i = start + k;
      const sel = i === this.cell && !this.onTabs;
      // A little handmade irregularity: photos are not taped perfectly straight in a row
      const jx = ((i * 7) % 3) - 1;
      const jy = ((i * 5) % 3) - 1;
      const x = GRID_X + (k % COLS) * (CELL_W + GAP_X) + jx;
      const y = GRID_Y + Math.floor(k / COLS) * (CELL_H + GAP_Y) + jy - (sel ? 1 : 0);
      if (this.seen(e.key)) this.drawPhoto(g, e.key, x, y, sel, i);
      else this.drawBlank(g, x, y, sel);
      hits.add(this, `cell:${i}`, x - 2, y - 2, CELL_W + 4, CELL_H + 4);
    });
    // Footer, on the desk: what is under the cursor
    const e = this.entries[this.cell];
    if (this.onTabs) return;
    if (pages > 1) drawText(g, `p. ${page + 1}/${pages}`, PAGE.x, H - 12, { color: '#8a7f96' });
    if (pages > 1 && input.pointerUsed) {
      // Touch: ◀ ▶ at both ends of the desk turn the page (flicking the page works too).
      drawText(g, '◀', 1, H - 12, { color: page > 0 ? '#d8cfe0' : '#4e4359' });
      drawText(g, '▶', W - 6, H - 12, { color: page < pages - 1 ? '#d8cfe0' : '#4e4359' });
      hits.add(this, 'pgprev', 0, H - 17, 40, 17);
      hits.add(this, 'pgnext', W - 40, H - 17, 40, 17);
    }
    if (e && this.seen(e.key)) {
      const kw = measure(`${e.kind} · `);
      const tw = measure(e.title);
      const x0 = Math.round(W / 2 - (kw + tw) / 2);
      drawText(g, `${e.kind} · `, x0, H - 12, { color: '#8a7f96' });
      drawText(g, e.title, x0 + kw, H - 12, { color: '#ffe991' });
    } else if (e) {
      drawText(g, 'Un souvenir que tu n\'as pas encore trouvé.', W / 2, H - 12, { align: 'center', color: '#8a7f96' });
    }
  }

  private drawPhoto(g: CanvasRenderingContext2D, key: string, x: number, y: number, sel: boolean, i: number): void {
    g.fillStyle = 'rgba(78,53,40,0.35)';
    g.fillRect(x + 1, y + 1, CELL_W + 1, CELL_H + 1);
    g.fillStyle = sel ? '#e2404c' : '#bfae90';
    g.fillRect(x - 1, y - 1, CELL_W + 2, CELL_H + 2);
    if (sel) g.fillRect(x - 2, y - 2, CELL_W + 4, CELL_H + 4);
    g.fillStyle = '#fffdf6';
    g.fillRect(x, y, CELL_W, CELL_H);
    const th = THUMBS.get(key);
    if (th) g.drawImage(th, x + 2, y + 2);
    else {
      g.fillStyle = '#3a3448';
      g.fillRect(x + 2, y + 2, TW, TH);
    }
    // Tape, alternating corners and centre
    g.fillStyle = 'rgba(249,233,170,0.7)';
    const tx = i % 3 === 0 ? x + CELL_W / 2 - 6 : i % 3 === 1 ? x - 3 : x + CELL_W - 9;
    g.fillRect(tx, y - 3, 12, 5);
  }

  private drawBlank(g: CanvasRenderingContext2D, x: number, y: number, sel: boolean): void {
    g.fillStyle = sel ? '#e2404c' : '#d8c8a6';
    for (let k = 0; k < CELL_W; k += 4) {
      g.fillRect(x + k, y, 2, 1);
      g.fillRect(x + k, y + CELL_H - 1, 2, 1);
    }
    for (let k = 0; k < CELL_H; k += 4) {
      g.fillRect(x, y + k, 1, 2);
      g.fillRect(x + CELL_W - 1, y + k, 1, 2);
    }
    if (sel) {
      g.fillRect(x - 1, y - 1, CELL_W + 2, 1);
      g.fillRect(x - 1, y + CELL_H, CELL_W + 2, 1);
    }
    drawText(g, '?', x + CELL_W / 2, y + CELL_H / 2 - 4, { align: 'center', color: sel ? '#e2404c' : '#c9b48e', scale: 1 });
  }

  private drawList(g: CanvasRenderingContext2D): void {
    const p = PAGE;
    if (!this.poems.length) {
      drawText(g, 'Pas encore de poème.', W / 2, p.y + 52, { align: 'center', color: INK });
      drawText(g, 'Quelque part, une page blanche attend.', W / 2, p.y + 70, { align: 'center', color: FADED });
      return;
    }
    const x = p.x + 14;
    const w = p.w - 28;
    this.poems.slice(this.listTop, this.listTop + LIST_ROWS).forEach((poem, k) => {
      const i = this.listTop + k;
      const y = p.y + 7 + k * ROW_H;
      const sel = i === this.poemIdx && !this.onTabs;
      hits.add(this, `poem:${i}`, x - 4, y - 2, w + 8, ROW_H - 2);
      if (sel) {
        g.fillStyle = '#f6e3b8';
        g.fillRect(x - 4, y - 2, w + 8, ROW_H - 2);
        heart(g, x - 2 + Math.round(Math.sin(this.t * 0.15)), y + 2, '#ff4a5a');
      }
      drawText(g, poem.title, x + 10, y, { color: RED });
      drawText(g, poemDate(poem.at), x + w, y, { align: 'right', color: FADED });
      drawText(g, this.preview(poem, w - 10), x + 10, y + 11, { color: INK });
    });
    if (this.listTop > 0) {
      drawText(g, '↑', p.x + p.w - 8, p.y + 2, { color: FADED });
      hits.add(this, 'up', p.x + p.w - 14, p.y - 2, 16, 12);
    }
    if (this.listTop + LIST_ROWS < this.poems.length) {
      drawText(g, '↓', p.x + p.w - 8, p.y + p.h - 11, { color: FADED });
      hits.add(this, 'down', p.x + p.w - 14, p.y + p.h - 13, 16, 13);
    }
    if (this.poems.length > 1 && !this.onTabs) drawText(g, `${this.poemIdx + 1}/${this.poems.length}`, PAGE.x, H - 12, { color: '#8a7f96' });
  }

  /** The chosen words, as far as they fit: « lune · coton · peur… ». */
  private preview(poem: SavedPoem, max: number): string {
    const words = poem.words.length ? poem.words : poemLines(poem).filter(Boolean);
    let s = '';
    for (const w of words) {
      const next = s ? `${s} · ${w}` : w;
      if (measure(`${next}…`) > max) return `${s}…`;
      s = next;
    }
    return s;
  }

  private drawView(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0b0710';
    g.fillRect(0, 0, W, H);
    ILLUSTRATIONS[this.viewKey]?.(g, this.viewT);
    const list = this.seenEntries();
    const i = list.findIndex((e) => e.key === this.viewKey);
    const e = list[i];
    if (!e) return;
    if (input.pointerUsed) this.drawClose(g, 6, 4, true);
    if (list.length > 1) {
      hits.add(this, 'prev', 0, 16, 44, 96);
      hits.add(this, 'next', W - 44, 16, 44, 96);
      const bob = Math.round(Math.sin(this.t * 0.1));
      drawOutlined(g, '◀', 4 - bob, H / 2 - 30, '#fffaf2', '#0b0710');
      drawOutlined(g, '▶', W - 10 + bob, H / 2 - 30, '#fffaf2', '#0b0710');
      drawOutlined(g, `${i + 1}/${list.length}`, W - 5, 4, '#fffaf2', '#0b0710', { align: 'right' });
    }
    if (this.caption >= Math.max(1, e.captions.length)) return;
    const text = e.captions[this.caption];
    const lines = text ? wrap(text, W - 40) : [];
    const h = 20 + lines.length * 12 + (lines.length ? 2 : -4);
    const y = H - h - 4;
    box(g, 8, y, W - 16, h, 'paper');
    drawText(g, e.title, 16, y + 5, { color: RED });
    const count = e.captions.length > 1 ? ` · ${this.caption + 1}/${e.captions.length}` : '';
    drawText(g, `${e.kind}${count}`, W - 16, y + 5, { align: 'right', color: FADED });
    lines.forEach((l, k) => drawText(g, l, 16, y + 19 + k * 12, { color: INK }));
  }

  /** Touch: a ✕ to leave (the page, or the notebook), with a comfortable tap area around it. */
  private drawClose(g: CanvasRenderingContext2D, x: number, y: number, outlined = false): void {
    if (outlined) drawOutlined(g, '✕', x, y, '#fffaf2', '#0b0710');
    else drawText(g, '✕', x, y, { color: '#d8cfe0', shadow: '#120c0a' });
    hits.add(this, 'close', x - 8, y - 6, 22, 20);
  }

  private drawPoem(g: CanvasRenderingContext2D): void {
    this.drawDesk(g);
    const p = this.poems[this.poemIdx];
    if (!p) return;
    const x = 50;
    const w = W - 100;
    drawPoemPage(g, p, x, 4, w, 158, this.poemShown());
    const n = this.poems.length;
    if (input.pointerUsed) this.drawClose(g, 10, 6);
    if (n > 1) {
      drawText(g, '◀', 30, 78, { color: '#8a7f96' });
      drawText(g, '▶', W - 36, 78, { color: '#8a7f96' });
      hits.add(this, 'prev', 12, 60, 36, 44);
      hits.add(this, 'next', W - 48, 60, 36, 44);
      drawText(g, `${this.poemIdx + 1}/${n}`, 8, H - 12, { color: '#8a7f96' });
    }
    if (this.poemShown() < poemLines(p).length) return;
    const label = this.busy
      ? 'Un instant…'
      : this.resultT > 0 && this.result === 'shared'
        ? 'Poème partagé.'
        : this.resultT > 0 && this.result === 'downloaded'
          ? 'Poème gardé.'
          : 'Garder ce poème';
    const lw = measure(label);
    const lx = Math.round(W / 2 - lw / 2 + 5);
    const y = H - 13;
    if (!this.busy && this.resultT <= 0) {
      heart(g, lx - 12 + Math.round(Math.sin(this.t * 0.15)), y + 2, '#ff4a5a');
      hits.add(this, 'keep', lx - 16, y - 4, lw + 22, 17);
    }
    drawText(g, label, lx, y, { color: this.resultT > 0 ? '#f8b6cf' : GOLD, shadow: '#120c0a' });
  }
}

import { audio } from '../../engine/audio';
import { H, VERSION, W } from '../../engine/constants';
import { drawOutlined, drawText, drawWrapped, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { hash2 } from '../../engine/math';
import { drawSprite } from '../../engine/sprite';
import { hasSpr, spr } from '../assets';
import { flow } from '../flow';
import { G, hasSave, readSave, formatPlaytime } from '../state';
import { box, heart } from '../ui/draw';
import { OptionsPanel } from '../ui/options';
import { CreditsScene } from './credits';
import { install } from '../pwa';
import { NameEntryScene } from './nameentry';
import { GalleryScene } from './gallery';
import { lang, tf, tr } from '../../i18n';

type Item = { label: string; action: () => void; color?: string };

/**
 * Title screen looks. v1.1: 'night' (first run), 'dawn' (after Aube), 'dream' (after Beaux rêves). v2 adds
 * (docs/HISTOIRE.md §3.9 and §5):
 *   point_de_croix  after the fake credits let roll: cross-stitched letters, a single « Continuer »;
 *   continuer_seul  Beaux rêves: a single « Continuer », and the real days counted since that ending;
 *   soleil_blanc    Aube blanche: the dawn, but the sun is a hole of correction fluid;
 *   silence_v2      Silence: the family photo, with a blank in the shape of a child;
 *   veilleuse       the secret ending: the nightlight plugged in at dawn, and no Dodo.
 */
export type TitleVariant = 'night' | 'dawn' | 'dream' | 'point_de_croix' | 'continuer_seul' | 'soleil_blanc' | 'silence_v2' | 'veilleuse';
export const TITLE_VARIANTS: TitleVariant[] = ['night', 'dawn', 'dream', 'point_de_croix', 'continuer_seul', 'soleil_blanc', 'silence_v2', 'veilleuse'];

/** The title look from the endings seen (v1.1 rule; the v2 endings choose their variant explicitly). */
export function defaultTitleVariant(endings: string[] = G.meta.endings): TitleVariant {
  return endings.includes('aube') ? 'dawn' : endings.includes('beaux_reves') ? 'dream' : 'night';
}

/** Real days since `since` (ms timestamp), for the Beaux rêves title (« Ça fait 23 jours, … »). */
export function daysSince(since: number, now: number = Date.now()): number {
  return since > 0 ? Math.max(0, Math.floor((now - since) / 86400000)) : 0;
}

export interface TitleOptions {
  variant?: TitleVariant;
  /** A single entry instead of the menu (« Continuer »): `onPick` runs after the screen fades out. */
  single?: { label: string; onPick: () => Promise<void> | void };
}

/** Title screen. Its mood changes with the endings the player has seen (the game remembers). */
export class TitleScene implements Scene {
  private t = 0;
  private idx = 0;
  private items: Item[] = [];
  private options: OptionsPanel | null = null;
  private confirmNew = false;
  private leaving = false;
  private mood: 'night' | 'dawn' | 'dream' = 'night';
  private variant: TitleVariant;

  constructor(private opts: TitleOptions = {}) {
    this.variant = opts.variant ?? defaultTitleVariant();
  }

  /**
   * Shows a title screen with one entry (e.g. the cross-stitched « Continuer » after the fake credits) and resolves
   * when the player picks it, once the screen has faded out. The caller replaces the scene.
   */
  static single(variant: TitleVariant, label = 'Continuer'): Promise<void> {
    return new Promise((resolve) => {
      game.replace(new TitleScene({ variant, single: { label, onPick: resolve } }));
    });
  }

  enter(): void {
    const v = this.variant;
    this.mood = v === 'dawn' || v === 'soleil_blanc' || v === 'veilleuse' ? 'dawn' : v === 'dream' || v === 'continuer_seul' ? 'dream' : 'night';
    this.buildItems();
    if (v === 'silence_v2') {
      audio.stopMusic(1);
      audio.setAmbience('hum', 0.4);
    } else {
      // The fake happy end: the title theme, very slightly out of tune.
      audio.corruption = v === 'point_de_croix' ? 0.3 : 0;
      audio.playMusic(this.mood === 'dream' ? 'dodo' : 'title', { fadeIn: 2 });
      audio.setAmbience(this.mood === 'dawn' ? 'none' : 'rain', 0.6);
    }
    fx.vignette = 0.4;
    fx.grain = 0.15;
    fx.glitch = 0;
    fx.gray = 0;
    fx.tint = null;
    void fx.fadeIn(40);
  }

  private buildItems(): void {
    const save = hasSave() ? readSave() : null;
    this.items = [];
    const single = this.opts.single ?? (this.variant === 'continuer_seul' ? { label: 'Continuer', onPick: () => (save ? flow.continueGame() : game.replace(new NameEntryScene())) } : null);
    if (single) {
      this.items.push({ label: single.label, action: () => this.leave(single.onPick) });
      this.idx = 0;
      return;
    }
    if (save) {
      this.items.push({
        label: 'Continuer',
        action: () => this.leave(() => flow.continueGame()),
      });
    }
    this.items.push({
      label: this.mood === 'dream' ? 'Réveiller Noa' : 'Nouvelle partie',
      action: () => {
        if (save) this.confirmNew = true;
        else this.startNew();
      },
    });
    // After a first ending: the gallery of souvenirs and poems, and (after the dawn) the bonus chapter.
    if (G.meta.endings.length > 0 && (G.meta.seen.length > 0 || G.meta.poems.length > 0)) {
      this.items.push({ label: 'Carnet de souvenirs', action: () => game.push(new GalleryScene()), color: '#b4e2c8' });
    }
    if (G.meta.endings.includes('aube')) {
      this.items.push({ label: 'Les rêves des autres', action: () => this.leave(() => flow.startBonus()), color: '#f8b6cf' });
    }
    this.items.push({ label: 'Options', action: () => (this.options = new OptionsPanel()) });
    if (canInstall()) this.items.push({ label: 'Installer le jeu', action: () => void install(), color: '#a7c7f0' });
    this.items.push({ label: 'Crédits', action: () => game.push(new CreditsScene(false)) });
    this.idx = 0;
  }

  private startNew(): void {
    this.leave(async () => {
      game.replace(new NameEntryScene());
    });
  }

  private leave(fn: () => Promise<void> | void): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.stopMusic(1);
    audio.corruption = 0;
    void fx.fadeOut(40).then(async () => {
      await fn();
      this.leaving = false;
    });
  }

  update(): void {
    this.t++;
    if (this.leaving) return;
    if (this.options) {
      if (!this.options.update()) this.options = null;
      // Touch: the ✕ or a tap outside the panel closes it.
      else if (hits.tap(this) === 'close') {
        audio.sfx('cancel');
        this.options = null;
      }
      return;
    }
    // Direct touch / mouse: hovering highlights an entry, a tap picks it at once.
    const hit = hits.pick(this);
    const tapped = !!hit?.tap && typeof hit.id === 'number';
    if (hit && typeof hit.id === 'number' && hit.id !== this.idx) {
      this.idx = hit.id;
      audio.sfx('move');
    }
    if (this.confirmNew) {
      if (input.repeat('left') || input.repeat('right')) {
        this.idx = this.idx === 0 ? 1 : 0;
        audio.sfx('move');
      }
      if (input.pressed('b')) {
        this.confirmNew = false;
        this.idx = 0;
        audio.sfx('cancel');
      } else if (input.pressed('a') || tapped) {
        audio.sfx('select');
        if (this.idx === 0) this.startNew();
        this.confirmNew = false;
        this.idx = 0;
      }
      return;
    }
    const n = this.items.length;
    if (input.repeat('up')) {
      this.idx = (this.idx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.idx = (this.idx + 1) % n;
      audio.sfx('move');
    }
    if ((input.pressed('a') || tapped) && this.t > 30) {
      audio.sfx('select');
      this.items[this.idx]!.action();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    this.drawBackground(g);
    this.drawLogo(g);
    if (this.options) {
      hits.add(this, 'close', 0, 0, W, H);
      hits.add(this, 'panel', 40, 20, W - 80, H - 40);
      box(g, 40, 20, W - 80, H - 40, 'dream');
      drawText(g, tr('Options'), W / 2, 28, { align: 'center', color: '#d4b8f0' });
      if (input.pointerUsed) {
        drawText(g, '✕', W - 52, 27, { color: '#8a7f96' });
        hits.add(this, 'close', W - 60, 20, 20, 18);
      }
      this.options.draw(g, 52, 46, W - 104, 8);
      return;
    }
    if (this.confirmNew) {
      box(g, 50, 108, W - 100, 50, 'dream');
      drawText(g, tr('Effacer la sauvegarde et recommencer ?'), W / 2, 116, { align: 'center' });
      ['Oui', 'Non'].forEach((l, i) => {
        const x = W / 2 - 40 + i * 80;
        hits.add(this, i, x - 30, 130, 60, 18);
        if (this.idx === i) heart(g, x - 18, 139, '#ff4a5a');
        drawText(g, tr(l), x, 136, { align: 'center', color: this.idx === i ? '#ffd84a' : '#fffaf2' });
      });
      return;
    }
    // 1.1 added entries (souvenirs, bonus): a long menu starts higher and tightens so it never leaves the screen.
    const n = this.items.length;
    const gap = n >= 7 ? 12 : 13;
    const startY = Math.min(108, 156 - (n - 1) * gap);
    this.items.forEach((it, i) => {
      const y = startY + i * gap;
      const sel = i === this.idx;
      const a = Math.min(1, Math.max(0, (this.t - 40 - i * 8) / 20));
      g.globalAlpha = a;
      if (a >= 1) hits.add(this, i, W / 2 - 58, y - 1, 124, gap);
      if (sel) heart(g, W / 2 - 52, y + 3, '#ff4a5a');
      drawText(g, tr(it.label), W / 2 - 40, y, { color: sel ? '#ffd84a' : (it.color ?? '#fffaf2'), shadow: '#0b0710' });
      g.globalAlpha = 1;
    });
    // Save info
    if (hasSave() && this.idx === 0 && !this.opts.single && this.variant !== 'continuer_seul') {
      const s = readSave();
      if (s) {
        drawText(g, `${s.playerName ? s.playerName + ' · ' : ''}${formatPlaytime(s.playtime)}`, W / 2 + 10, startY, { color: '#8a7f96' });
      }
    }
    drawText(g, `v${VERSION}`, W - 4, H - 11, { color: '#4e4359', align: 'right' });
    this.drawMeta(g);
  }

  private drawMeta(g: CanvasRenderingContext2D): void {
    if (this.variant === 'continuer_seul') {
      // Beaux rêves: the real days go by. He is still in his room.
      const days = daysSince(G.meta.beauxRevesAt);
      const name = G.meta.names[G.meta.names.length - 1] ?? G.state.playerName ?? '';
      g.globalAlpha = 0.8;
      const text = tf(days === 1 ? 'Ça fait {0} jour, {1}. Il est toujours dans sa chambre.' : 'Ça fait {0} jours, {1}. Il est toujours dans sa chambre.', days, name || '…');
      drawWrapped(g, text, 40, H - 27, W - 80, { color: '#9a7bd0', align: 'center', lineHeight: 10, shadow: '#0b0710' });
      g.globalAlpha = 1;
      return;
    }
    const h = new Date().getHours();
    if (h >= 0 && h < 5) {
      const a = 0.5 + 0.3 * Math.sin(this.t * 0.03);
      g.globalAlpha = a;
      drawText(g, tf('Il est {0}h. Tu devrais dormir, toi aussi.', h === 0 && lang() === 'en' ? 12 : h), 4, H - 11, { color: '#6d5a8a' });
      g.globalAlpha = 1;
    } else if (G.meta.deaths > 5 && this.mood === 'night') {
      g.globalAlpha = 0.4;
      drawText(g, tf('Tu es tombé·e {0} fois.', G.meta.deaths), 4, H - 11, { color: '#6d5a8a' });
      g.globalAlpha = 1;
    }
  }

  /** The logo embroidered in red thread, one little « x » per pixel of the font (the house of chapter 4). */
  private drawStitchedLogo(g: CanvasRenderingContext2D, title: string, y: number): void {
    const m = logoMask(title);
    const cell = 3;
    const x0 = Math.round(W / 2 - (m.w * cell) / 2);
    const y0 = y - 2;
    // A strip of canvas (aida cloth) behind the letters.
    g.fillStyle = '#e8dcc0';
    g.fillRect(x0 - 6, y0 - 4, m.w * cell + 12, m.h * cell + 4);
    g.fillStyle = '#d6c8a8';
    for (let gx = x0 - 6; gx < x0 + m.w * cell + 6; gx += cell) g.fillRect(gx, y0 - 4, 1, m.h * cell + 4);
    for (let gy = y0 - 4; gy < y0 + m.h * cell; gy += cell) g.fillRect(x0 - 6, gy, m.w * cell + 12, 1);
    for (let py = 0; py < m.h; py++) {
      for (let px = 0; px < m.w; px++) {
        if (!m.on[py * m.w + px]) continue;
        const cx = x0 + px * cell;
        const cy = y0 + py * cell;
        // An « x »: two crossing stitches, the top one lighter.
        g.fillStyle = '#a8324a';
        g.fillRect(cx, cy, 1, 1);
        g.fillRect(cx + 2, cy + 2, 1, 1);
        g.fillStyle = '#e8505b';
        g.fillRect(cx + 2, cy, 1, 1);
        g.fillRect(cx + 1, cy + 1, 1, 1);
        g.fillRect(cx, cy + 2, 1, 1);
      }
    }
    // A loose end of thread, hanging from the last letter.
    g.fillStyle = '#e8505b';
    const lx = x0 + m.w * cell + 2;
    for (let i = 0; i < 12; i++) g.fillRect(lx + Math.round(Math.sin((i + this.t * 0.05) * 0.6)), y0 + m.h * cell - 4 + i, 1, 1);
  }

  /** Silence: the family photo of the summer, with a blank where the child stood (left of the menu). */
  private drawPhoto(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#16121c';
    g.fillRect(0, 0, W, H);
    // A bare wall, a nail, the photo hanging slightly crooked.
    g.fillStyle = '#1c1724';
    for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 1, H);
    const px = 22;
    const py = 70;
    const pw = 90;
    const ph = 96;
    g.fillStyle = '#5c6080';
    g.fillRect(px + pw / 2, py - 10, 1, 10);
    g.fillRect(px + pw / 2 - 1, py - 11, 3, 2);
    g.fillStyle = '#0b0710';
    g.fillRect(px + 3, py + 3, pw, ph);
    g.fillStyle = '#ece6da';
    g.fillRect(px, py, pw, ph);
    const ix = px + 5;
    const iy = py + 5;
    const iw = pw - 10;
    const ih = ph - 22;
    ['#b8c4d4', '#c4ccd8', '#d0d4dc'].forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(ix, iy + i * 10, iw, 10);
    });
    g.fillStyle = '#9aaa8a';
    g.fillRect(ix, iy + 30, iw, ih - 30);
    g.fillStyle = '#8a9a7a';
    for (let i = 0; i < 10; i++) g.fillRect(ix + Math.floor(hash2(i, 3, 91) * (iw - 3)), iy + 33 + Math.floor(hash2(i, 4, 91) * (ih - 35)), 3, 1);
    // A tree.
    g.fillStyle = '#7a8a6a';
    g.fillRect(ix + 4, iy + 8, 18, 16);
    g.fillRect(ix + 7, iy + 5, 12, 22);
    g.fillStyle = '#6e5a4a';
    g.fillRect(ix + 12, iy + 27, 3, 10);
    // Maman (left) and Noa (right); between them, cut out with scissors, a little girl in a paper crown: nothing.
    const fig = (x: number, top: number, hgt: number, body: string, hair: string): void => {
      g.fillStyle = hair;
      g.fillRect(x - 4, top, 8, 7);
      g.fillStyle = '#e8cdbb';
      g.fillRect(x - 3, top + 2, 6, 6);
      g.fillStyle = hair;
      g.fillRect(x - 3, top + 1, 6, 2);
      g.fillStyle = body;
      g.fillRect(x - 5, top + 8, 10, hgt - 8);
      g.fillStyle = '#5c6080';
      g.fillRect(x - 4, top + hgt, 3, 8);
      g.fillRect(x + 1, top + hgt, 3, 8);
    };
    fig(ix + 26, iy + 20, 30, '#b0849a', '#6e4a3a');
    fig(ix + 63, iy + 26, 24, '#7d86b0', '#3f3d63');
    const bx = ix + 45;
    const by = iy + 36;
    g.fillStyle = '#fbfaf6';
    g.fillRect(bx - 3, by - 3, 7, 2);
    g.fillRect(bx - 3, by - 5, 1, 2);
    g.fillRect(bx, by - 5, 1, 2);
    g.fillRect(bx + 3, by - 5, 1, 2);
    g.fillRect(bx - 3, by - 1, 7, 6);
    g.fillRect(bx - 4, by + 5, 9, 11);
    g.fillRect(bx - 3, by + 16, 2, 6);
    g.fillRect(bx + 2, by + 16, 2, 6);
    // Maman's hand reaches into the blank.
    g.fillStyle = '#e8cdbb';
    g.fillRect(ix + 31, iy + 38, 9, 2);
    drawText(g, tr('L\'été, au parc.'), px + pw / 2, py + ph - 15, { color: '#4a4e78', align: 'center' });
  }

  private drawBackground(g: CanvasRenderingContext2D): void {
    if (this.variant === 'silence_v2') {
      this.drawPhoto(g);
      return;
    }
    const t = this.t;
    const dawn = this.mood === 'dawn';
    // Sky gradient (banded, pixel style)
    const sky = dawn ? ['#3a3a6a', '#6a5a8a', '#b07a9a', '#f0a088', '#ffd0a0'] : ['#0b0716', '#120c22', '#1a1230', '#22183c', '#2a1e48'];
    sky.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, i * 22, W, 22);
    });
    g.fillStyle = sky[sky.length - 1]!;
    g.fillRect(0, 110, W, 70);
    // Stars
    if (!dawn) {
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(hash2(i, 1) * W);
        const y = Math.floor(hash2(i, 2) * 100);
        const tw = Math.sin(t * 0.04 + i) > 0.6;
        g.fillStyle = tw ? '#fffaf2' : '#6d5a8a';
        g.fillRect(x, y, 1, 1);
      }
    }
    // Moon / sun
    const mx = 238;
    const my = 44;
    if (dawn && this.variant === 'soleil_blanc') {
      // A sun of correction fluid: flat white, lumpy edge, a blue pen line around it, no light at all.
      const sy = 120 - Math.min(40, t * 0.05);
      g.fillStyle = '#3b5bd0';
      g.beginPath();
      g.arc(mx, sy, 23, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fbfcff';
      g.beginPath();
      g.arc(mx, sy, 22, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        g.fillRect(Math.round(mx + Math.cos(a) * 22 - 1), Math.round(sy + Math.sin(a) * 22 - 1), 3, 3);
      }
      g.fillStyle = '#e8ecf4';
      g.fillRect(mx - 9, Math.round(sy) + 4, 7, 2);
      g.fillRect(mx + 5, Math.round(sy) - 8, 4, 2);
    } else if (dawn) {
      g.fillStyle = '#ffe8a0';
      g.beginPath();
      g.arc(mx, 120 - Math.min(40, t * 0.05), 22, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = 'rgba(255,233,145,0.08)';
      g.beginPath();
      g.arc(mx, my, 34 + Math.sin(t * 0.02) * 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffe991';
      g.beginPath();
      g.arc(mx, my, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = sky[1]!;
      g.beginPath();
      g.arc(mx + 7, my - 5, 14, 0, Math.PI * 2);
      g.fill();
    }
    // City silhouette / rooftops
    g.fillStyle = dawn ? '#2a2040' : '#07050d';
    for (let i = 0; i < 16; i++) {
      const bw = 14 + Math.floor(hash2(i, 9) * 18);
      const bh = 18 + Math.floor(hash2(i, 4) * 40);
      const x = i * 21 - 4;
      g.fillRect(x, 150 - bh, bw, bh + 30);
      // Lit windows
      for (let wy = 150 - bh + 4; wy < 146; wy += 6) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
          if (hash2(wx, wy) > (dawn ? 0.95 : 0.88)) {
            g.fillStyle = '#ffe991';
            g.fillRect(wx, wy, 2, 2);
            g.fillStyle = dawn ? '#2a2040' : '#07050d';
          }
        }
      }
    }
    // Window frame (we are inside Noa's room)
    g.fillStyle = dawn ? '#3a2c4c' : '#120c1c';
    g.fillRect(0, 0, 24, H);
    g.fillRect(W - 24, 0, 24, H);
    g.fillRect(0, 0, W, 8);
    g.fillRect(0, 150, W, 30);
    g.fillRect(W / 2 - 2, 8, 4, 142);
    g.fillRect(24, 76, W - 48, 3);
    // Rain on glass
    if (!dawn) {
      g.fillStyle = 'rgba(167,199,240,0.25)';
      for (let i = 0; i < 30; i++) {
        const x = 26 + Math.floor(hash2(i, 7) * (W - 52));
        const y = (Math.floor(hash2(i, 8) * 140) + t * (0.6 + hash2(i, 3))) % 142;
        g.fillRect(x, 8 + y, 1, 3);
      }
    }
    // Windowsill: the nightlight and Dodo
    g.fillStyle = dawn ? '#5c4a6a' : '#1c1428';
    g.fillRect(16, 146, W - 32, 6);
    if (hasSpr('prop_veilleuse')) drawSprite(g, spr('prop_veilleuse'), 60, 147);
    if (this.variant === 'veilleuse') {
      // No Dodo. The nightlight is plugged in: its cord runs down the wall to the socket.
      g.fillStyle = '#3a2c4c';
      g.fillRect(56, 147, 2, 3);
      g.fillRect(57, 150, 1, 18);
      g.fillStyle = '#e8e2f0';
      g.fillRect(52, 166, 10, 8);
      g.fillStyle = '#5c4a6a';
      g.fillRect(55, 168, 1, 3);
      g.fillRect(58, 168, 1, 3);
    } else if (hasSpr('prop_dodo_plush')) drawSprite(g, spr(this.mood === 'dream' && hasSpr('prop_dodo_plush_dark') ? 'prop_dodo_plush_dark' : 'prop_dodo_plush'), 262, 147);
    // Nightlight glow
    const flick = 0.85 + 0.15 * Math.sin(t * 0.07) + (hash2(t >> 3, 5) < 0.03 ? -0.4 : 0);
    const grad = g.createRadialGradient(60, 140, 0, 60, 140, 60);
    grad.addColorStop(0, `rgba(255,233,145,${0.28 * flick})`);
    grad.addColorStop(1, 'rgba(255,233,145,0)');
    g.fillStyle = grad;
    g.fillRect(0, 80, 130, 100);
  }

  private drawLogo(g: CanvasRenderingContext2D): void {
    const t = this.t;
    const a = Math.min(1, t / 60);
    g.globalAlpha = a;
    const title = 'VEILLEUSE';
    const y = 34 + Math.round(Math.sin(t * 0.03) * 2);
    if (this.variant === 'point_de_croix') {
      this.drawStitchedLogo(g, title, y);
      drawText(g, tr('Fais de beaux rêves.'), W / 2, y + 30, { color: '#f8b6cf', align: 'center', shadow: '#0b0710' });
      g.globalAlpha = 1;
      return;
    }
    // Glow
    drawOutlined(g, title, W / 2 - 1, y, '#ffe991', '#2a1a48', { scale: 3, align: 'center' });
    drawText(g, title, W / 2, y, { color: '#fff3cf', scale: 3, align: 'center' });
    drawText(g, tr('Fais de beaux rêves.'), W / 2, y + 30, { color: this.mood === 'dream' ? '#9a7bd0' : '#d4b8f0', align: 'center', shadow: '#0b0710' });
    g.globalAlpha = 1;
  }
}

/** Cross-stitch mask of the logo (built once). */
let stitchMask: { w: number; h: number; on: boolean[] } | null = null;

function logoMask(title: string): { w: number; h: number; on: boolean[] } {
  if (stitchMask) return stitchMask;
  const w = measure(title) + 2;
  const h = 12;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  drawText(g, title, 1, -2, { color: '#ffffff' });
  const data = g.getImageData(0, 0, w, h).data;
  const on: boolean[] = [];
  for (let i = 0; i < w * h; i++) on.push(data[i * 4 + 3]! > 128);
  stitchMask = { w, h, on };
  return stitchMask;
}

function canInstall(): boolean {
  return !!(window as unknown as { __veilleuseInstall?: unknown }).__veilleuseInstall;
}

import { audio } from '../../engine/audio';
import { H, VERSION, W } from '../../engine/constants';
import { drawOutlined, drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
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

type Item = { label: string; action: () => void; color?: string };

/** Title screen. Its mood changes with the endings the player has seen (the game remembers). */
export class TitleScene implements Scene {
  private t = 0;
  private idx = 0;
  private items: Item[] = [];
  private options: OptionsPanel | null = null;
  private confirmNew = false;
  private leaving = false;
  private mood: 'night' | 'dawn' | 'dream' = 'night';

  enter(): void {
    const endings = G.meta.endings;
    this.mood = endings.includes('aube') ? 'dawn' : endings.includes('beaux_reves') ? 'dream' : 'night';
    this.buildItems();
    audio.playMusic(this.mood === 'dream' ? 'dodo' : 'title', { fadeIn: 2 });
    audio.setAmbience(this.mood === 'dawn' ? 'none' : 'rain', 0.6);
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
    if (save) {
      this.items.push({
        label: `Continuer`,
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
      this.items.push({ label: 'Carnet de souvenirs', action: () => game.push(new GalleryScene()), color: '#ffe991' });
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
      return;
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
      } else if (input.pressed('a')) {
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
    if (input.pressed('a') && this.t > 30) {
      audio.sfx('select');
      this.items[this.idx]!.action();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    this.drawBackground(g);
    this.drawLogo(g);
    if (this.options) {
      box(g, 40, 20, W - 80, H - 40, 'dream');
      drawText(g, 'Options', W / 2, 28, { align: 'center', color: '#d4b8f0' });
      this.options.draw(g, 52, 46, W - 104, 9);
      return;
    }
    if (this.confirmNew) {
      box(g, 50, 108, W - 100, 50, 'dream');
      drawText(g, 'Effacer la sauvegarde et recommencer ?', W / 2, 116, { align: 'center' });
      ['Oui', 'Non'].forEach((l, i) => {
        const x = W / 2 - 40 + i * 80;
        if (this.idx === i) heart(g, x - 18, 139, '#ff4a5a');
        drawText(g, l, x, 136, { align: 'center', color: this.idx === i ? '#ffd84a' : '#fffaf2' });
      });
      return;
    }
    const startY = 108;
    this.items.forEach((it, i) => {
      const y = startY + i * 13;
      const sel = i === this.idx;
      const a = Math.min(1, Math.max(0, (this.t - 40 - i * 8) / 20));
      g.globalAlpha = a;
      if (sel) heart(g, W / 2 - 52, y + 3, '#ff4a5a');
      drawText(g, it.label, W / 2 - 40, y, { color: sel ? '#ffd84a' : (it.color ?? '#fffaf2'), shadow: '#0b0710' });
      g.globalAlpha = 1;
    });
    // Save info
    if (hasSave() && this.idx === 0) {
      const s = readSave();
      if (s) {
        drawText(g, `${s.playerName ? s.playerName + ' · ' : ''}${formatPlaytime(s.playtime)}`, W / 2 + 10, startY, { color: '#8a7f96' });
      }
    }
    drawText(g, `v${VERSION}`, W - 4, H - 11, { color: '#4e4359', align: 'right' });
    this.drawMeta(g);
  }

  private drawMeta(g: CanvasRenderingContext2D): void {
    const h = new Date().getHours();
    if (h >= 0 && h < 5) {
      const a = 0.5 + 0.3 * Math.sin(this.t * 0.03);
      g.globalAlpha = a;
      drawText(g, `Il est ${h}h. Tu devrais dormir, toi aussi.`, 4, H - 11, { color: '#6d5a8a' });
      g.globalAlpha = 1;
    } else if (G.meta.deaths > 5 && this.mood === 'night') {
      g.globalAlpha = 0.4;
      drawText(g, `Tu es tombé·e ${G.meta.deaths} fois.`, 4, H - 11, { color: '#6d5a8a' });
      g.globalAlpha = 1;
    }
  }

  private drawBackground(g: CanvasRenderingContext2D): void {
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
    if (dawn) {
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
    if (hasSpr('prop_dodo_plush')) drawSprite(g, spr(this.mood === 'dream' && hasSpr('prop_dodo_plush_dark') ? 'prop_dodo_plush_dark' : 'prop_dodo_plush'), 262, 147);
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
    // Glow
    drawOutlined(g, title, W / 2 - 1, y, '#ffe991', '#2a1a48', { scale: 3, align: 'center' });
    drawText(g, title, W / 2, y, { color: '#fff3cf', scale: 3, align: 'center' });
    drawText(g, 'Fais de beaux rêves.', W / 2, y + 30, { color: this.mood === 'dream' ? '#9a7bd0' : '#d4b8f0', align: 'center', shadow: '#0b0710' });
    g.globalAlpha = 1;
  }
}

function canInstall(): boolean {
  return !!(window as unknown as { __veilleuseInstall?: unknown }).__veilleuseInstall;
}

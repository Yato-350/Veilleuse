import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, drawWrapped } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { drawSprite } from '../../engine/sprite';
import { ITEMS } from '../../data/items';
import { SOUVENIRS } from '../../data/illustrations';
import { charSet } from '../assets';
import { flow } from '../flow';
import { world } from '../overworld/world';
import { ARMORS, attack, defense, formatPlaytime, G, level, maxHp, WEAPONS } from '../state';
import { dialogue } from '../ui/dialogue';
import { bar, box, heart } from '../ui/draw';
import { OptionsPanel } from '../ui/options';
import { ImageScene } from './image';
import { tf, tr } from '../../i18n';

const TABS = ['Objets', 'Souvenirs', 'Statut', 'Options', 'Quitter'];

type Focus = 'tabs' | 'items' | 'souvenirs' | 'options' | 'quit';

/** Pause menu (OMORI-like). */
export class MenuScene implements Scene {
  transparent = true;
  private tab = 0;
  private focus: Focus = 'tabs';
  private itemIdx = 0;
  private souvIdx = 0;
  private quitIdx = 1;
  private options = new OptionsPanel();
  private t = 0;
  private anim = 0;
  private msg: { text: string; t: number } | null = null;
  /** A tap that confirms the focused row this frame, like A (set by updatePointer). */
  private tapA = false;

  update(): void {
    this.t++;
    this.anim = Math.min(1, this.anim + 0.15);
    if (this.msg && ++this.msg.t > 120) this.msg = null;
    if (dialogue.busy) return;
    this.tapA = false;
    if (this.updatePointer()) return;
    switch (this.focus) {
      case 'tabs':
        return this.updateTabs();
      case 'items':
        return this.updateItems();
      case 'souvenirs':
        return this.updateSouvenirs();
      case 'options':
        if (!this.options.update()) this.focus = 'tabs';
        return;
      case 'quit':
        return this.updateQuit();
    }
  }

  /**
   * Direct touch / mouse. Tabs open at once; item rows select then use on a second tap; souvenirs open at once;
   * options rows act at once (the panel handles them); « Oui » (back to title) needs a second tap; ✕ or a tap
   * outside the boxes closes the menu. True when the tap was handled here.
   */
  private updatePointer(): boolean {
    const at = input.tapAt;
    // Options rows answer even while the tab column has the focus: hand the tap to the panel.
    if (at && input.tap && this.tab === 3 && hits.at(this.options, at.x, at.y)) {
      this.focus = 'options';
      return false;
    }
    const hit = hits.pick(this);
    if (!hit || typeof hit.id !== 'string') return false;
    const [kind, arg] = hit.id.split(':');
    const i = Number(arg);
    if (!hit.tap) {
      // Mouse hover: highlight rows of the focused list only.
      if (kind === 'item' && this.focus === 'items' && i !== this.itemIdx) {
        this.itemIdx = i;
        audio.sfx('move');
      } else if (kind === 'souv' && this.focus === 'souvenirs' && i !== this.souvIdx) {
        this.souvIdx = i;
        audio.sfx('move');
      }
      return false;
    }
    switch (kind) {
      case 'close':
        this.close();
        return true;
      case 'tab':
        audio.sfx('select');
        this.tab = i;
        this.focus = (['items', 'souvenirs', 'tabs', 'options', 'quit'] as Focus[])[i]!;
        if (this.focus === 'items') this.itemIdx = 0;
        if (this.focus === 'quit') this.quitIdx = 1;
        return true;
      case 'item':
        if (this.focus === 'items' && this.itemIdx === i) {
          this.tapA = true; // second tap on the highlighted item: use it
          return false;
        }
        audio.sfx('move');
        this.focus = 'items';
        this.itemIdx = i;
        return true;
      case 'souv':
        this.focus = 'souvenirs';
        this.souvIdx = i;
        this.tapA = true; // opens it
        return false;
      case 'quit':
        if (i === 1 || (this.focus === 'quit' && this.quitIdx === 0)) {
          this.focus = 'quit';
          this.quitIdx = i;
          this.tapA = true; // « Non », or « Oui » tapped twice
          return false;
        }
        audio.sfx('move');
        this.focus = 'quit';
        this.quitIdx = i;
        return true;
    }
    return true;
  }

  private close(): void {
    audio.sfx('cancel');
    game.pop();
  }

  private updateTabs(): void {
    const n = TABS.length;
    if (input.repeat('up')) {
      this.tab = (this.tab + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.tab = (this.tab + 1) % n;
      audio.sfx('move');
    }
    if (input.pressed('b') || input.pressed('menu')) return this.close();
    if (input.pressed('a') || input.pressed('right')) {
      audio.sfx('select');
      this.focus = (['items', 'souvenirs', 'tabs', 'options', 'quit'] as Focus[])[this.tab]!;
      if (this.focus === 'items') this.itemIdx = 0;
    }
  }

  private allItems(): string[] {
    return [...G.state.items, ...G.state.keyItems];
  }

  private updateItems(): void {
    const items = this.allItems();
    if (input.pressed('b') || input.pressed('left')) {
      audio.sfx('cancel');
      this.focus = 'tabs';
      return;
    }
    if (!items.length) return;
    if (input.repeat('up')) {
      this.itemIdx = (this.itemIdx + items.length - 1) % items.length;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.itemIdx = (this.itemIdx + 1) % items.length;
      audio.sfx('move');
    }
    if (input.pressed('a') || this.tapA) {
      const id = items[this.itemIdx]!;
      const def = ITEMS[id];
      if (!def || def.key || !def.heal) {
        audio.sfx('cancel');
        this.msg = { text: def?.key ? 'C\'est important. Tu le gardes.' : 'Ça ne sert qu\'en combat.', t: 0 };
        return;
      }
      const s = G.state;
      if (s.hp >= maxHp(s)) {
        audio.sfx('cancel');
        this.msg = { text: 'Tes PV sont déjà au maximum.', t: 0 };
        return;
      }
      s.hp = Math.min(maxHp(s), s.hp + def.heal);
      s.items.splice(this.itemIdx, 1);
      audio.sfx('heal');
      this.msg = { text: `${def.name} : ${def.useText ?? ''}`, t: 0 };
      this.itemIdx = Math.max(0, Math.min(this.itemIdx, this.allItems().length - 1));
    }
  }

  private updateSouvenirs(): void {
    const list = G.state.souvenirs;
    if (input.pressed('b') || input.pressed('left')) {
      audio.sfx('cancel');
      this.focus = 'tabs';
      return;
    }
    if (!list.length) return;
    if (input.repeat('up')) {
      this.souvIdx = (this.souvIdx + list.length - 1) % list.length;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.souvIdx = (this.souvIdx + 1) % list.length;
      audio.sfx('move');
    }
    if (input.pressed('a') || this.tapA) {
      const s = SOUVENIRS[list[this.souvIdx]!];
      if (s) {
        audio.sfx('select');
        void ImageScene.show(s.image, s.captions);
      }
    }
  }

  private updateQuit(): void {
    if (input.repeat('left') || input.repeat('right')) {
      this.quitIdx = 1 - this.quitIdx;
      audio.sfx('move');
    }
    if (input.pressed('b')) {
      audio.sfx('cancel');
      this.focus = 'tabs';
      return;
    }
    if (input.pressed('a') || this.tapA) {
      audio.sfx('select');
      if (this.quitIdx === 0) {
        void flow.toTitle();
      } else this.focus = 'tabs';
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const a = this.anim;
    g.fillStyle = `rgba(11,7,16,${0.55 * a})`;
    g.fillRect(0, 0, W, H);
    const ox = Math.round((1 - a) * -40);
    // Touch: a tap on the dimmed background closes the menu; taps inside the boxes never do.
    hits.add(this, 'close', 0, 0, W, H);
    hits.add(this, 'box', 8, 8, 76, 164);
    hits.add(this, 'box', 92, 8, W - 100, H - 16);
    // Tabs column
    box(g, 8 + ox, 8, 76, 86, 'dream');
    if (input.pointerUsed) {
      drawText(g, '✕', 72 + ox, 13, { color: '#8a7f96' });
      hits.add(this, 'close', 64, 8, 20, 16);
    }
    TABS.forEach((label, i) => {
      const y = 15 + i * 15;
      const sel = i === this.tab;
      hits.add(this, `tab:${i}`, 10, y - 3, i === 0 ? 54 : 72, 15);
      if (sel) heart(g, 14 + ox, y + 3, this.focus === 'tabs' ? '#ff4a5a' : '#8a3a4a');
      drawText(g, tr(label), 25 + ox, y, { color: sel ? '#ffd84a' : '#fffaf2' });
    });
    // Mini status under tabs
    this.drawMiniStatus(g, 8 + ox, 100);
    // Content panel
    const px = 92;
    const py = 8;
    const pw = W - px - 8;
    const ph = H - 16;
    box(g, px, py, pw, ph, 'dream');
    switch (this.tab) {
      case 0:
        this.drawItems(g, px, py, pw, ph);
        break;
      case 1:
        this.drawSouvenirs(g, px, py, pw, ph);
        break;
      case 2:
        this.drawStatus(g, px, py, pw);
        break;
      case 3:
        drawText(g, tr('Options'), px + 10, py + 6, { color: '#d4b8f0' });
        this.options.draw(g, px + 8, py + 24, pw - 18, 10);
        if (this.focus !== 'options') drawText(g, tr('A : modifier'), px + pw - 10, py + ph - 14, { color: '#8a7f96', align: 'right' });
        break;
      case 4:
        drawWrapped(g, tr('Retourner à l\'écran titre ? Ce qui n\'a pas été sauvegardé près d\'une veilleuse sera perdu.'), px + 10, py + 10, pw - 20, {
          color: '#fffaf2',
        });
        ['Oui', 'Non'].forEach((l, i) => {
          const x = px + 40 + i * 80;
          const sel = this.focus === 'quit' && this.quitIdx === i;
          hits.add(this, `quit:${i}`, x - 16, py + 56, 48, 16);
          if (sel) heart(g, x - 11, py + 63, '#ff4a5a');
          drawText(g, tr(l), x, py + 60, { color: sel ? '#ffd84a' : '#fffaf2' });
        });
        break;
    }
    if (this.msg) {
      box(g, 20, H - 34, W - 40, 26, 'dream');
      drawText(g, tr(this.msg.text), 28, H - 28, { color: '#fffaf2' });
    }
  }

  private drawMiniStatus(g: CanvasRenderingContext2D, x: number, y: number): void {
    const s = G.state;
    box(g, x, y, 76, 72, 'dream');
    const maman = s.playerChar === 'maman';
    const set = charSet(maman ? 'maman' : 'noa', world.variant);
    if (set) drawSprite(g, set.down[0]!, x + 16, y + 30);
    drawText(g, tr(maman ? 'Maman' : 'Noa'), x + 30, y + 6, { color: maman ? '#f8b6cf' : '#d4b8f0' });
    drawText(g, tf('NV {0}', level(s)), x + 30, y + 18, { color: '#fffaf2' });
    drawText(g, tr('PV'), x + 6, y + 36, { color: '#fffaf2' });
    bar(g, x + 22, y + 39, 46, 5, s.hp / maxHp(s), '#ffd84a', '#5a1c2c');
    drawText(g, `${s.hp}/${maxHp(s)}`, x + 6, y + 48, { color: '#fffaf2' });
    drawText(g, `● ${s.boutons}`, x + 6, y + 58, { color: '#f5c04f' });
  }

  private drawItems(g: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    const items = this.allItems();
    drawText(g, tr('Objets'), px + 10, py + 6, { color: '#d4b8f0' });
    drawText(g, `${G.state.items.length}/8`, px + pw - 10, py + 6, { color: '#8a7f96', align: 'right' });
    if (!items.length) {
      drawText(g, tr('Rien. Tes poches sont vides.'), px + 10, py + 26, { color: '#8a7f96' });
      return;
    }
    const visible = 8;
    const start = Math.max(0, Math.min(this.itemIdx - 3, items.length - visible));
    for (let i = start; i < Math.min(items.length, start + visible); i++) {
      const def = ITEMS[items[i]!];
      const y = py + 24 + (i - start) * 12;
      const sel = this.focus === 'items' && i === this.itemIdx;
      hits.add(this, `item:${i}`, px + 4, y - 2, pw - 8, 12);
      if (sel) heart(g, px + 8, y + 3, '#ff4a5a');
      const isKey = i >= G.state.items.length;
      drawText(g, tr(def?.name ?? items[i]!), px + 19, y, { color: sel ? '#ffd84a' : isKey ? '#a7c7f0' : '#fffaf2' });
    }
    const cur = ITEMS[items[Math.min(this.itemIdx, items.length - 1)]!];
    if (cur && this.focus === 'items') {
      g.fillStyle = '#3a2c4c';
      g.fillRect(px + 6, py + ph - 40, pw - 12, 1);
      drawWrapped(g, tr(cur.desc), px + 10, py + ph - 36, pw - 20, { color: '#d8cfe0' });
    }
  }

  private drawSouvenirs(g: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number): void {
    drawText(g, tr('Souvenirs'), px + 10, py + 6, { color: '#d4b8f0' });
    const list = G.state.souvenirs;
    if (!list.length) {
      drawWrapped(g, tr('Aucun souvenir pour l\'instant. Ils reviendront… quand tu seras prêt.'), px + 10, py + 26, pw - 20, { color: '#8a7f96' });
      return;
    }
    list.forEach((id, i) => {
      const s = SOUVENIRS[id];
      const y = py + 24 + i * 14;
      const sel = this.focus === 'souvenirs' && i === this.souvIdx;
      hits.add(this, `souv:${i}`, px + 4, y - 3, pw - 8, 14);
      if (sel) heart(g, px + 8, y + 3, '#ff4a5a');
      drawText(g, s ? tr(s.title) : id, px + 19, y, { color: sel ? '#ffd84a' : '#fffaf2' });
    });
    drawText(g, `${list.length}/3`, px + pw - 10, py + ph - 14, { color: '#8a7f96', align: 'right' });
  }

  private drawStatus(g: CanvasRenderingContext2D, px: number, py: number, pw: number): void {
    const s = G.state;
    drawText(g, tr('Statut'), px + 10, py + 6, { color: '#d4b8f0' });
    const rows: Array<[string, string, string?]> = [
      ['Niveau', `${level(s)}`],
      ['PV', `${s.hp} / ${maxHp(s)}`],
      ['Attaque', `${attack(s)}`],
      ['Défense', `${defense(s)}`],
      ['Étoiles', `${s.etoiles}`, '#ffd84a'],
      ['Encre', `${s.encre}`, '#b06aff'],
      ['Boutons', `${s.boutons}`, '#f5c04f'],
      ['Arme', tr(WEAPONS[s.weapon]?.name ?? '-')],
      ['Tenue', tr(ARMORS[s.armor]?.name ?? '-')],
      ['Temps de jeu', formatPlaytime(s.playtime)],
    ];
    rows.forEach(([k, v, c], i) => {
      const y = py + 22 + i * 13;
      drawText(g, tr(k), px + 12, y, { color: '#b7aab8' });
      drawText(g, v, px + pw - 12, y, { color: c ?? '#fffaf2', align: 'right' });
    });
    if (s.playerName) drawText(g, `— ${s.playerName}`, px + 12, py + 22 + rows.length * 13 + 4, { color: '#6d6080' });
  }
}

export function openMenu(): void {
  game.push(new MenuScene());
}

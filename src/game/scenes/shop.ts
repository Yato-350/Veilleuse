import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, drawWrapped } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { ITEMS } from '../../data/items';
import { G, MAX_ITEMS } from '../state';
import { box, heart } from '../ui/draw';

/** Rows of the item list that fit above the shopkeeper's speech box (the list scrolls beyond). */
const ROWS = 6;
const ROW_H = 13;

/** Simple shop: buy items with Boutons. */
export class ShopScene implements Scene {
  transparent = true;
  private idx = 0;
  private top = 0;
  private msg = '';
  private msgT = 0;
  private resolve: (() => void) | null = null;

  constructor(
    private stock: string[],
    greeting: string,
    private keeper: string,
    /** 0.5 = half price. */
    private discount = 0,
  ) {
    this.msg = greeting;
  }

  static open(stock: string[], greeting = 'Qu\'est-ce qui te ferait plaisir ?', keeper = 'Chaussette', discount = 0): Promise<void> {
    const s = new ShopScene(stock, greeting, keeper, discount);
    game.push(s);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  update(): void {
    if (this.msgT > 0) this.msgT--;
    const n = this.stock.length + 1;
    if (input.repeat('up')) {
      this.idx = (this.idx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.idx = (this.idx + 1) % n;
      audio.sfx('move');
    }
    // Direct touch / mouse: a tap highlights an item (its description shows), a second tap buys it;
    // « Partir » leaves at once; the little arrows scroll.
    let buy = input.pressed('a');
    const hit = hits.pick(this);
    if (hit?.id === 'up' || hit?.id === 'down') {
      if (hit.tap) {
        this.idx = hit.id === 'up' ? Math.max(0, this.top - 1) : Math.min(n - 1, this.top + ROWS);
        audio.sfx('move');
      }
    } else if (hit && typeof hit.id === 'number') {
      if (hit.tap && (hit.id === this.idx || hit.id === this.stock.length)) buy = true;
      else if (hit.id !== this.idx) audio.sfx('move');
      this.idx = hit.id;
    }
    // Keep the selection inside the visible window.
    if (this.idx < this.top) this.top = this.idx;
    if (this.idx >= this.top + ROWS) this.top = this.idx - ROWS + 1;
    if (input.pressed('b') || (buy && this.idx === this.stock.length)) {
      audio.sfx('cancel');
      game.remove(this);
      input.consume();
      this.resolve?.();
      return;
    }
    if (buy) {
      const it = ITEMS[this.stock[this.idx]!];
      if (!it) return;
      const price = this.price(it.price ?? 0);
      if (G.state.boutons < price) {
        audio.sfx('cancel');
        this.say('Il te manque des boutons, mon chou.');
      } else if (G.state.items.length >= MAX_ITEMS) {
        audio.sfx('cancel');
        this.say('Tes poches débordent déjà !');
      } else {
        G.state.boutons -= price;
        G.state.items.push(it.id);
        audio.sfx('item');
        this.say(`Et voilà : ${it.name} ! Merci, merci !`);
      }
    }
  }

  private price(base: number): number {
    return this.discount > 0 && base > 0 ? Math.max(1, Math.ceil(base * (1 - this.discount))) : base;
  }

  private say(t: string): void {
    this.msg = t;
    this.msgT = 120;
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(11,7,16,0.5)';
    g.fillRect(0, 0, W, H);
    box(g, 8, 8, 150, H - 70, 'dream');
    drawText(g, `Boutique de ${this.keeper}`, 16, 14, { color: '#d4b8f0' });
    const n = this.stock.length + 1;
    for (let i = this.top; i < Math.min(n, this.top + ROWS); i++) {
      const y = 32 + (i - this.top) * ROW_H;
      const sel = i === this.idx;
      hits.add(this, i, 10, y - 2, 146, ROW_H);
      if (sel) heart(g, 14, y + 3, '#ff4a5a');
      if (i === this.stock.length) {
        drawText(g, 'Partir', 25, y, { color: sel ? '#ffd84a' : '#b7aab8' });
        continue;
      }
      const it = ITEMS[this.stock[i]!];
      drawText(g, it?.name ?? this.stock[i]!, 25, y, { color: sel ? '#ffd84a' : '#fffaf2' });
      drawText(g, `${this.price(it?.price ?? 0)}`, 150, y, { color: this.discount > 0 ? '#7ee08a' : '#f5c04f', align: 'right' });
    }
    // Scroll hints
    g.fillStyle = '#d4b8f0';
    if (this.top > 0) {
      for (let k = 0; k < 3; k++) g.fillRect(83 - k, 26 + k, 1 + k * 2, 1);
      hits.add(this, 'up', 70, 22, 28, 8);
    }
    if (this.top + ROWS < n) {
      for (let k = 0; k < 3; k++) g.fillRect(83 - k, 113 - k, 1 + k * 2, 1);
      hits.add(this, 'down', 70, 109, 28, 8);
    }
    // Info panel
    box(g, 166, 8, W - 174, H - 70, 'dream');
    drawText(g, `● ${G.state.boutons} boutons`, 174, 14, { color: '#f5c04f' });
    drawText(g, `Poches : ${G.state.items.length}/${MAX_ITEMS}`, 174, 28, { color: '#b7aab8' });
    if (this.discount > 0) drawText(g, `Prix doux : -${Math.round(this.discount * 100)} %`, 174, 100, { color: '#7ee08a' });
    const cur = ITEMS[this.stock[this.idx] ?? ''];
    if (cur) drawWrapped(g, cur.desc, 174, 48, W - 190, { color: '#d8cfe0' });
    // Keeper speech
    box(g, 8, H - 56, W - 16, 48, 'dream');
    drawWrapped(g, this.msg, 16, H - 50, W - 32, { color: '#fffaf2' });
  }
}

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, drawWrapped } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { ITEMS } from '../../data/items';
import { G, MAX_ITEMS } from '../state';
import { box, heart } from '../ui/draw';

/** Simple shop: buy items with Boutons. */
export class ShopScene implements Scene {
  transparent = true;
  private idx = 0;
  private msg = '';
  private msgT = 0;
  private resolve: (() => void) | null = null;

  constructor(
    private stock: string[],
    greeting: string,
    private keeper: string,
  ) {
    this.msg = greeting;
  }

  static open(stock: string[], greeting = 'Qu\'est-ce qui te ferait plaisir ?', keeper = 'Chaussette'): Promise<void> {
    const s = new ShopScene(stock, greeting, keeper);
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
    if (input.pressed('b') || (input.pressed('a') && this.idx === this.stock.length)) {
      audio.sfx('cancel');
      game.remove(this);
      input.consume();
      this.resolve?.();
      return;
    }
    if (input.pressed('a')) {
      const it = ITEMS[this.stock[this.idx]!];
      if (!it) return;
      const price = it.price ?? 0;
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

  private say(t: string): void {
    this.msg = t;
    this.msgT = 120;
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(11,7,16,0.5)';
    g.fillRect(0, 0, W, H);
    box(g, 8, 8, 150, H - 70, 'dream');
    drawText(g, `Boutique de ${this.keeper}`, 16, 14, { color: '#d4b8f0' });
    this.stock.forEach((id, i) => {
      const it = ITEMS[id];
      const y = 32 + i * 13;
      const sel = i === this.idx;
      if (sel) heart(g, 14, y + 3, '#ff4a5a');
      drawText(g, it?.name ?? id, 25, y, { color: sel ? '#ffd84a' : '#fffaf2' });
      drawText(g, `${it?.price ?? 0}`, 150, y, { color: '#f5c04f', align: 'right' });
    });
    const qy = 32 + this.stock.length * 13;
    if (this.idx === this.stock.length) heart(g, 14, qy + 3, '#ff4a5a');
    drawText(g, 'Partir', 25, qy, { color: this.idx === this.stock.length ? '#ffd84a' : '#b7aab8' });
    // Info panel
    box(g, 166, 8, W - 174, H - 70, 'dream');
    drawText(g, `● ${G.state.boutons} boutons`, 174, 14, { color: '#f5c04f' });
    drawText(g, `Poches : ${G.state.items.length}/${MAX_ITEMS}`, 174, 28, { color: '#b7aab8' });
    const cur = ITEMS[this.stock[this.idx] ?? ''];
    if (cur) drawWrapped(g, cur.desc, 174, 48, W - 190, { color: '#d8cfe0' });
    // Keeper speech
    box(g, 8, H - 56, W - 16, 48, 'dream');
    drawWrapped(g, this.msg, 16, H - 50, W - 32, { color: '#fffaf2' });
  }
}

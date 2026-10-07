import { W, H } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';

/**
 * « Carnet de souvenirs » — title-screen gallery of the illustrations seen (G.meta.seen) and the poems written
 * (G.meta.poems). Placeholder: the full scene is being written.
 */
export class GalleryScene implements Scene {
  update(): void {
    if (input.pressed('b') || input.pressed('a') || input.tap) {
      game.remove(this);
      input.consume();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, W, H);
    drawText(g, 'Carnet de souvenirs', W / 2, H / 2 - 4, { align: 'center', color: '#ffe991' });
  }
}

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, drawWrapped } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { G, writeMeta } from '../state';
import { nextArrow } from '../ui/draw';
import { TitleScene } from './title';
import { tr } from '../../i18n';

/** Content warning shown before the title screen (skippable after the first time). */
export class WarningScene implements Scene {
  private t = 0;
  private leaving = false;

  enter(): void {
    void fx.fadeIn(30);
  }

  update(): void {
    this.t++;
    const minT = G.meta.warningSeen ? 20 : 90;
    if (!this.leaving && this.t > minT && (input.pressed('a') || input.pressed('b') || input.tap)) {
      this.leaving = true;
      audio.unlock();
      audio.sfx('select');
      G.meta.warningSeen = true;
      writeMeta(G.meta);
      void fx.fadeOut(30).then(() => game.replace(new TitleScene()));
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, W, H);
    const a = Math.min(1, this.t / 40);
    g.globalAlpha = a;
    drawText(g, tr('AVERTISSEMENT'), W / 2, 18, { align: 'center', color: '#ffd84a' });
    drawWrapped(
      g,
      tr(
        'Ce jeu aborde le deuil, la maladie d\'un enfant, la culpabilité et des pensées sombres. Il contient des scènes et des effets visuels qui peuvent être perturbants. Il n\'est pas adapté aux jeunes enfants ni aux personnes facilement impressionnables.',
      ),
      30,
      40,
      W - 60,
      { color: '#d8cfe0', align: 'center' },
    );
    drawWrapped(g, tr('Joue de préférence avec un casque, dans le noir.'), 30, 118, W - 60, { color: '#8a7f96', align: 'center' });
    g.globalAlpha = 1;
    if (this.t > (G.meta.warningSeen ? 20 : 90)) {
      drawText(g, tr('Appuie sur A (ou touche l\'écran)'), W / 2, H - 22, { align: 'center', color: '#fffaf2' });
      nextArrow(g, W / 2 - 2, H - 9, this.t);
    }
  }
}

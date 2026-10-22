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
    // The text of docs/HISTOIRE.md § 6.3, then where to find help (§ 6.4).
    drawText(g, tr('AVERTISSEMENT'), W / 2, 8, { align: 'center', color: '#ffd84a' });
    const body = drawWrapped(
      g,
      tr(
        'Veilleuse parle du deuil, de la maladie et de la mort d\'un enfant, de la culpabilité, du repli sur soi et de pensées sombres. Le jeu contient de l\'horreur psychologique, des images inquiétantes (poupées et peluches décousues, encre qui coule comme du sang), de faux plantages et des effets visuels qui peuvent perturber. Il n\'est pas adapté aux jeunes enfants ni aux personnes facilement impressionnables.',
      ),
      18,
      24,
      W - 36,
      { color: '#d8cfe0', align: 'center', lineHeight: 12 },
    );
    drawWrapped(g, tr('Si tu traverses un moment difficile, tu n\'es pas seul·e : en France, le 3114 répond gratuitement, jour et nuit.'), 18, 30 + body * 12, W - 36, {
      color: '#ffe991',
      align: 'center',
      lineHeight: 12,
    });
    g.globalAlpha = 1;
    if (this.t > (G.meta.warningSeen ? 20 : 90)) {
      drawText(g, tr('Appuie sur A (ou touche l\'écran)'), W / 2, H - 19, { align: 'center', color: '#fffaf2' });
      nextArrow(g, W / 2 - 2, H - 7, this.t);
    }
  }
}

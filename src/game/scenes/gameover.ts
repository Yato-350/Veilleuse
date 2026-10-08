import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { rng } from '../../engine/math';
import { hasSpr, spr } from '../assets';
import { minaOffersHelp } from '../battle/battle';
import { flow } from '../flow';
import { G, hasSave, writeMeta, writeSettings } from '../state';
import { heart } from '../ui/draw';

const LINES = [
  'Noa a perdu tout espoir…',
  'Le noir était trop épais.',
  'Ton cœur s\'est éteint comme une veilleuse.',
  'Les mots n\'ont pas suffi, cette fois.',
];

const DODO_LINES = [
  'Tu pourrais simplement… rester endormi.',
  'Chut. Ce n\'est rien. Dors.',
  'Tu vois ? C\'est plus doux, ici, dans le noir.',
  '{player}, tu n\'es pas obligé de le réveiller.',
];

type Choice = 'retry' | 'load' | 'title';

/** Mina's offer after the 3rd defeat in a row of the same fight (she chases Dodo's whisper away). */
const MINA_ASK = ['Hé ! N\'écoute pas Dodo, chevalier.', 'Tu veux que je t\'aide un peu ?'];
const MINA_YES = ['Promis, je le dis à personne.', 'On y retourne ensemble ! Prêt ?'];
const MINA_NO = ['D\'accord ! Je sais que tu peux le faire.', 'Je regarde, hein. Je bouge pas.'];
const MINA_COLOR = '#f09a4a';
const OFFER_START = 200;

/** Game over: broken heart, Dodo whispers, retry / load / title. */
export class GameOverScene implements Scene {
  private t = 0;
  private idx = 0;
  private resolve: ((c: Choice) => void) | null = null;
  private line = rng.pick(LINES);
  private dodo = rng.pick(DODO_LINES).replace('{player}', G.state.playerName || '…');
  private choices: Array<[string, Choice]>;
  /** Mina's offer: 'ask' (yes/no), 'reply' (her answer), 'done' (regular choices below her answer). */
  private offer: 'ask' | 'reply' | 'done' | null;
  private offerIdx = 0;
  private offerT = 0;
  private reply: string[] = [];
  private accepted = false;

  constructor() {
    this.choices = [['Réessayer', 'retry']];
    if (hasSave()) this.choices.push(['Charger', 'load']);
    this.choices.push(['Titre', 'title']);
    this.offer = minaOffersHelp() ? 'ask' : null;
  }

  static show(_snapshot: string): Promise<Choice> {
    G.meta.deaths++;
    writeMeta(G.meta);
    const s = new GameOverScene();
    fx.setFade(0);
    game.push(s);
    audio.stopMusic(0.3);
    audio.sfx('shatter');
    return new Promise((resolve) => {
      s.resolve = resolve;
    });
  }

  update(): void {
    this.t++;
    if (this.t === 120) audio.playMusic('gameover', { fadeIn: 2 });
    if (this.t < 200) return;
    // Direct touch / mouse: hovering highlights, a tap answers at once (ids: offer answers 'o:i', choices 'c:i').
    const hit = hits.pick(this, 300);
    const [kind, arg] = typeof hit?.id === 'string' ? hit.id.split(':') : [];
    if (this.offer && this.offer !== 'done') {
      if (kind === 'o' && this.offerT >= 60) {
        if (Number(arg) !== this.offerIdx) audio.sfx('move');
        this.offerIdx = Number(arg);
      }
      this.updateOffer(kind === 'o' && !!hit?.tap);
      return;
    }
    if (kind === 'c') {
      if (Number(arg) !== this.idx) audio.sfx('move');
      this.idx = Number(arg);
    }
    const n = this.choices.length;
    if (input.repeat('left') || input.repeat('up')) {
      this.idx = (this.idx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('right') || input.repeat('down')) {
      this.idx = (this.idx + 1) % n;
      audio.sfx('move');
    }
    if (input.pressed('a') || (kind === 'c' && hit?.tap)) {
      audio.sfx('select');
      const c = this.choices[this.idx]![1];
      void this.choose(c);
    }
  }

  /** « Tu veux que je t'aide un peu ? » — accepting turns the Story Mode on (and says so); refusing is respected. */
  private updateOffer(tapped = false): void {
    this.offerT++;
    if (this.offer === 'reply') {
      if (this.offerT > 50) this.offer = 'done';
      return;
    }
    if (this.offerT < 60) return;
    if (input.repeat('left') || input.repeat('right') || input.repeat('up') || input.repeat('down')) {
      this.offerIdx = 1 - this.offerIdx;
      audio.sfx('move');
    }
    if (!input.pressed('a') && !tapped) return;
    this.accepted = this.offerIdx === 0;
    if (this.accepted) {
      G.settings.storyMode = true;
      writeSettings(G.settings);
      audio.sfx('chime');
    } else audio.sfx('select');
    this.reply = this.accepted ? MINA_YES : MINA_NO;
    this.offer = 'reply';
    this.offerT = 0;
  }

  private async choose(c: Choice): Promise<void> {
    this.t = -9999;
    await fx.fadeOut(30);
    game.remove(this);
    const r = this.resolve;
    this.resolve = null;
    if (c === 'retry') {
      fx.setFade(0);
      r?.('retry');
      return;
    }
    if (c === 'load') await flow.continueGame();
    else await flow.toTitle();
    r?.(c);
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = Math.max(0, this.t);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const cx = W / 2 - 3;
    const cy = 60;
    if (t < 40) {
      heart(g, cx - 4, cy - 3, '#ff4a5a', 2);
    } else if (t < 80) {
      // Cracked: two halves drifting apart.
      const d = Math.floor((t - 40) / 10);
      g.save();
      g.beginPath();
      g.rect(0, 0, cx + 3, H);
      g.clip();
      heart(g, cx - 4 - d, cy - 3, '#ff4a5a', 2);
      g.restore();
      g.save();
      g.beginPath();
      g.rect(cx + 3, 0, W, H);
      g.clip();
      heart(g, cx - 4 + d, cy - 3, '#ff4a5a', 2);
      g.restore();
    } else {
      // Shards falling
      g.fillStyle = '#ff4a5a';
      for (let i = 0; i < 8; i++) {
        const tt = t - 80;
        const x = cx + Math.cos(i * 0.8) * tt * 0.6 + (i - 4) * 2;
        const y = cy + tt * tt * 0.004 * (1 + (i % 3)) - 4 + i;
        if (y < H) g.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
    }
    if (t > 110) {
      const a = Math.min(1, (t - 110) / 40);
      g.globalAlpha = a;
      drawText(g, this.line, W / 2, 96, { color: '#fffaf2', align: 'center' });
      g.globalAlpha = 1;
    }
    if (t > 160) {
      // Mina chases Dodo's whisper away.
      const fade = this.offer && t >= OFFER_START ? Math.max(0, 1 - (t - OFFER_START) / 30) : 1;
      const a = Math.min(1, (t - 160) / 60) * fade;
      g.globalAlpha = a * (0.7 + 0.3 * Math.sin(t * 0.05));
      if (a > 0) drawText(g, this.dodo, W / 2, 116, { color: '#9a7bd0', align: 'center' });
      g.globalAlpha = 1;
    }
    if (this.offer && (t >= OFFER_START || this.t < 0)) this.drawOffer(g, this.t < 0 ? 999 : t - OFFER_START);
    if ((t >= 200 && (!this.offer || this.offer === 'done')) || this.t < 0) {
      const total = this.choices.length;
      const y = this.offer ? 158 : 144;
      this.choices.forEach(([label], i) => {
        const x = W / 2 + (i - (total - 1) / 2) * 80;
        const sel = i === this.idx;
        hits.add(this, `c:${i}`, Math.round(x - 38), y - 4, 76, 16);
        if (sel) heart(g, Math.round(x - measureHalf(label) - 11), y + 3, '#ff4a5a');
        drawText(g, label, Math.round(x), y, { color: sel ? '#ffd84a' : '#8a7f96', align: 'center' });
      });
    }
  }

  /** Mina's face, her words, and the yes/no choice (or the Story Mode note once she was accepted). */
  private drawOffer(g: CanvasRenderingContext2D, ot: number): void {
    const a = Math.min(1, Math.max(0, (ot - 20) / 30));
    if (a <= 0) return;
    g.globalAlpha = a;
    const lines = this.offer === 'ask' ? MINA_ASK : this.reply;
    const fx0 = 52;
    const fy = 110;
    const key = this.offer === 'ask' ? 'face_mina_sad' : this.accepted ? 'face_mina_happy' : 'face_mina_neutral';
    if (hasSpr(key)) g.drawImage(spr(key).img, fx0, fy);
    lines.forEach((l, i) => drawText(g, l, fx0 + 40, fy + 4 + i * 12, { color: i === 0 ? MINA_COLOR : '#fffaf2' }));
    if (this.offer === 'ask' && ot >= 60) {
      const opts = ['Oui, aide-moi', 'Non, ça ira'];
      opts.forEach((label, i) => {
        const x = W / 2 + (i - 0.5) * 110;
        const sel = i === this.offerIdx;
        hits.add(this, `o:${i}`, Math.round(x - 52), 144, 104, 16);
        if (sel) heart(g, Math.round(x - measureHalf(label) - 11), 151, MINA_COLOR);
        drawText(g, label, Math.round(x), 148, { color: sel ? '#ffd84a' : '#8a7f96', align: 'center' });
      });
    }
    if (this.offer !== 'ask' && this.accepted) {
      drawText(g, '(Mode Histoire activé — modifiable dans les Options.)', W / 2, 145, { color: '#8a7f96', align: 'center' });
    }
    g.globalAlpha = 1;
  }
}

const measureHalf = (s: string): number => Math.ceil(measure(s) / 2);

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { flow } from '../flow';
import { G } from '../state';
import { heart } from '../ui/draw';

const ROWS = ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', 'abcdefghijklm', 'nopqrstuvwxyz', 'éèêàçïôù-\' '];
const MAX = 10;

/** Special reactions to some names (Undertale style). */
export function nameReaction(raw: string): { text: string; allow: boolean } | null {
  const n = raw.trim().toLowerCase();
  const map: Record<string, { text: string; allow: boolean }> = {
    noa: { text: 'C\'est son nom à lui. Pas le tien.', allow: false },
    mina: { text: '…', allow: false },
    dodo: { text: 'Hihi. Non. Ça, c\'est moi.', allow: false },
    maman: { text: 'Elle n\'est pas encore rentrée.', allow: false },
    sunny: { text: 'Tu t\'es trompé de rêve.', allow: true },
    omori: { text: 'Ici, il n\'y a pas d\'espace blanc.', allow: true },
    frisk: { text: 'Pas de Souterrain ici. Juste un lit.', allow: true },
    chara: { text: 'Le vrai nom ? …D\'accord.', allow: true },
    monika: { text: 'Elle ne peut pas t\'entendre, ici.', allow: true },
    claude: { text: 'Oh. Bonjour, toi.', allow: true },
  };
  return map[n] ?? null;
}

/** "Comment t'appelles-tu ?" — the game asks for the PLAYER's name, not Noa's. */
export class NameEntryScene implements Scene {
  private name = '';
  private row = 0;
  private col = 0;
  private t = 0;
  private reaction: { text: string; allow: boolean; t: number } | null = null;
  private confirm = false;
  private confirmIdx = 0;
  private done = false;
  private typing = 0;

  enter(): void {
    audio.playMusic('room_quiet', { fadeIn: 2 });
    void fx.fadeIn(40);
  }

  private get cells(): string[][] {
    const rows = ROWS.map((r) => [...r]);
    rows.push(['←', 'OK']);
    return rows;
  }

  update(): void {
    this.t++;
    if (this.done) return;
    if (this.reaction) {
      this.reaction.t++;
      if (this.reaction.t > 30 && input.pressed('a')) {
        if (this.reaction.allow) this.confirm = true;
        else this.name = '';
        this.reaction = null;
        input.consume();
      }
      return;
    }
    if (this.confirm) {
      if (input.repeat('left') || input.repeat('right')) {
        this.confirmIdx = 1 - this.confirmIdx;
        audio.sfx('move');
      }
      if (input.pressed('b')) {
        this.confirm = false;
        audio.sfx('cancel');
      }
      if (input.pressed('a')) {
        audio.sfx('select');
        if (this.confirmIdx === 0) void this.finish();
        else this.confirm = false;
      }
      return;
    }
    // Physical keyboard typing: letters typed on a keyboard must not also act as buttons (Z, X, WASD…).
    if (input.typed.length) {
      for (const k of input.typed) {
        if (k === '\b') this.name = [...this.name].slice(0, -1).join('');
        else if (k === '\n') this.submit();
        else if (k.length === 1 && [...this.name].length < MAX && /[\p{L}\d '-]/u.test(k)) {
          this.name += k;
          audio.sfx('blip');
        }
      }
      this.typing = 24;
      return;
    }
    if (this.typing > 0) {
      this.typing--;
      return;
    }
    const cells = this.cells;
    if (input.repeat('up')) {
      this.row = (this.row + cells.length - 1) % cells.length;
      this.col = Math.min(this.col, cells[this.row]!.length - 1);
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.row = (this.row + 1) % cells.length;
      this.col = Math.min(this.col, cells[this.row]!.length - 1);
      audio.sfx('move');
    }
    if (input.repeat('left')) {
      this.col = (this.col + cells[this.row]!.length - 1) % cells[this.row]!.length;
      audio.sfx('move');
    }
    if (input.repeat('right')) {
      this.col = (this.col + 1) % cells[this.row]!.length;
      audio.sfx('move');
    }
    if (input.pressed('b')) {
      this.name = [...this.name].slice(0, -1).join('');
      audio.sfx('cancel');
    }
    if (input.pressed('a')) {
      const cell = cells[this.row]![this.col]!;
      if (cell === '←') {
        this.name = [...this.name].slice(0, -1).join('');
        audio.sfx('cancel');
      } else if (cell === 'OK') {
        this.submit();
      } else if ([...this.name].length < MAX) {
        this.name += cell;
        audio.sfx('blip');
      }
    }
  }

  private submit(): void {
    const n = this.name.trim();
    if (!n) {
      audio.sfx('cancel');
      return;
    }
    audio.sfx('select');
    const r = nameReaction(n);
    if (r) this.reaction = { ...r, t: 0 };
    else this.confirm = true;
    this.confirmIdx = 0;
  }

  private async finish(): Promise<void> {
    this.done = true;
    G.state.playerName = this.name.trim();
    audio.stopMusic(1.5);
    await fx.fadeOut(60);
    await flow.newGame(this.name.trim());
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#05030a';
    g.fillRect(0, 0, W, H);
    drawText(g, 'Avant de commencer…', W / 2, 12, { align: 'center', color: '#8a7f96' });
    drawText(g, 'Comment t\'appelles-tu ?', W / 2, 26, { align: 'center', color: '#fffaf2' });
    // Name field
    const shown = this.name + (Math.floor(this.t / 30) % 2 === 0 && [...this.name].length < MAX ? '_' : ' ');
    drawText(g, shown, W / 2, 46, { align: 'center', color: '#ffd84a', scale: 2 });
    if (this.reaction) {
      const a = Math.min(1, this.reaction.t / 30);
      g.globalAlpha = a;
      drawText(g, this.reaction.text, W / 2, 100, { align: 'center', color: '#d4b8f0' });
      g.globalAlpha = 1;
      return;
    }
    if (this.confirm) {
      drawText(g, 'C\'est bien toi ?', W / 2, 96, { align: 'center', color: '#fffaf2' });
      ['Oui', 'Non'].forEach((l, i) => {
        const x = W / 2 - 40 + i * 80;
        if (this.confirmIdx === i) heart(g, x - 18, 119, '#ff4a5a');
        drawText(g, l, x, 116, { align: 'center', color: this.confirmIdx === i ? '#ffd84a' : '#fffaf2' });
      });
      return;
    }
    const cells = this.cells;
    cells.forEach((row, r) => {
      const isLast = r === cells.length - 1;
      const spacing = isLast ? 60 : 18;
      const total = (row.length - 1) * spacing;
      row.forEach((ch, c) => {
        const x = Math.round(W / 2 - total / 2 + c * spacing);
        const y = 72 + r * 15 + (isLast ? 6 : 0);
        const sel = r === this.row && c === this.col;
        // The space key is shown as « _ ».
        const label = ch === ' ' ? '_' : ch;
        const lw = measure(label);
        if (sel) heart(g, x - lw / 2 - 10, y + 3, '#ff4a5a');
        drawText(g, label, x, y, { align: 'center', color: sel ? '#ffd84a' : '#d8cfe0' });
      });
    });
    drawText(g, 'Clavier possible · B : effacer', W / 2, H - 12, { align: 'center', color: '#4e4359' });
  }
}

import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, drawWrapped } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { tf, tr } from '../../i18n';
import { deleteFile, isDeleted, restoreFile, type CharFile } from '../files';

/*
 * « Fichiers » (title screen, after a first ending): the characters' files, in an old file explorer. dodo.chr,
 * mina.chr and maman.chr can be deleted (they go to the bin, where they can be restored); noa.chr is in use. While
 * dodo.chr is there, Dodo has something to say about it. What a deletion changes in the game: src/game/files.ts.
 */

type File = 'noa' | CharFile;
type Row = { file: File | 'bin'; name: string; size: string };

const FILES: ReadonlyArray<{ file: File; name: string; size: string }> = [
  { file: 'noa', name: 'noa.chr', size: '14 Ko' },
  { file: 'dodo', name: 'dodo.chr', size: '365 Ko' },
  { file: 'mina', name: 'mina.chr', size: '8 Ko' },
  { file: 'maman', name: 'maman.chr', size: '41 Ko' },
];

/** What Dodo says, while his own file is still there. */
const DODO = {
  open: 'Qu\'est-ce que tu cherches là-dedans ?',
  self: 'Tu ne peux pas m\'effacer. Je suis dans tous les autres.',
  mina: 'Elle n\'aurait pas aimé ça.',
  maman: 'Maintenant, il n\'y a plus que moi pour veiller sur lui.',
  back: '…Merci. Je ne dirai rien.',
};

const BOX = { x: 30, y: 14, w: 260, h: 152 };
const ROW_H = 13;

const binned = (): Array<{ file: File; name: string; size: string }> => FILES.filter((f) => f.file !== 'noa' && isDeleted(f.file));

export class FilesScene implements Scene {
  private t = 0;
  private idx = 0;
  private inBin = false;
  /** The file waiting for « A : supprimer · B : annuler ». */
  private confirm: CharFile | null = null;
  /** The status line (already translated), and whether Dodo is the one speaking. */
  private status = '';
  private statusDodo = false;

  constructor() {
    if (!isDeleted('dodo')) this.dodo(DODO.open);
  }

  rows(): Row[] {
    if (this.inBin) return binned();
    return [...FILES.filter((f) => f.file === 'noa' || !isDeleted(f.file)), { file: 'bin', name: tf('Corbeille ({0})', binned().length), size: '' }];
  }

  private say(text: string): void {
    this.status = text;
    this.statusDodo = false;
  }

  private dodo(line: string): void {
    this.status = tr(line);
    this.statusDodo = true;
  }

  update(): void {
    this.t++;
    const rows = this.rows();
    this.idx = Math.min(this.idx, Math.max(0, rows.length - 1));
    const hit = hits.pick(this);
    const tap = hit?.tap ? hit.id : null;
    if (this.confirm) {
      if (input.pressed('a') || tap === 'yes') return this.doDelete(this.confirm);
      if (input.pressed('b') || input.pressed('menu') || tap === 'no') {
        audio.sfx('cancel');
        this.confirm = null;
        this.say('');
      }
      return;
    }
    if (hit && typeof hit.id === 'number' && hit.id !== this.idx) {
      this.idx = hit.id;
      audio.sfx('move');
    }
    if (rows.length > 1 && input.repeat('up')) {
      this.idx = (this.idx + rows.length - 1) % rows.length;
      audio.sfx('move');
    } else if (rows.length > 1 && input.repeat('down')) {
      this.idx = (this.idx + 1) % rows.length;
      audio.sfx('move');
    }
    if ((input.pressed('a') || typeof tap === 'number') && rows[this.idx]) return this.act(rows[this.idx]!);
    if (input.pressed('b') || input.pressed('menu') || tap === 'close') {
      audio.sfx('cancel');
      if (!this.inBin) return void game.pop();
      this.inBin = false;
      this.idx = FILES.length;
      this.say('');
    }
  }

  private act(row: Row): void {
    if (row.file === 'bin') {
      audio.sfx('select');
      if (!binned().length) return this.say(tr('Rien dans la corbeille.'));
      this.inBin = true;
      this.idx = 0;
      this.say('');
      return;
    }
    if (row.file === 'noa') {
      audio.sfx('cancel');
      this.say(tr('Impossible : le fichier est en cours d\'utilisation.'));
      return;
    }
    if (this.inBin) {
      restoreFile(row.file);
      audio.sfx('heal');
      if (row.file === 'dodo') this.dodo(DODO.back);
      else this.say(tf('{0} restauré.', row.name));
      if (!binned().length) {
        this.inBin = false;
        this.idx = 0;
      }
      return;
    }
    audio.sfx('select', { pitch: 0.8 });
    this.confirm = row.file;
    if (row.file === 'dodo') this.dodo(DODO.self);
    else this.say(tf('Supprimer {0} ? Le jeu ne sera plus le même.', row.name));
  }

  private doDelete(f: CharFile): void {
    const dodoThere = !isDeleted('dodo');
    deleteFile(f);
    this.confirm = null;
    audio.sfx('erase');
    if (dodoThere && f === 'mina') this.dodo(DODO.mina);
    else if (dodoThere && f === 'maman') this.dodo(DODO.maman);
    else this.say(tf('{0} supprimé.', `${f}.chr`));
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07050c';
    g.fillRect(0, 0, W, H);
    const { x, y, w, h } = BOX;
    // The window: an old file explorer, in the game's colours.
    g.fillStyle = '#3a2d48';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#15172a';
    g.fillRect(x, y, w, h);
    g.fillStyle = '#2d2238';
    g.fillRect(x, y, w, 13);
    drawText(g, tr(this.inBin ? 'Corbeille' : 'Fichiers'), x + 5, y + 3, { color: '#fffaf2' });
    hits.add(this, 'close', x + w - 14, y, 14, 13);
    drawText(g, 'x', x + w - 9, y + 2, { color: '#8a8fb0' });
    drawText(g, tr(this.inBin ? 'C:/Veilleuse/corbeille/' : 'C:/Veilleuse/personnages/'), x + 5, y + 17, { color: '#5c6080' });
    this.rows().forEach((r, i) => {
      const ry = y + 31 + i * ROW_H;
      const sel = i === this.idx && !this.confirm;
      hits.add(this, i, x + 3, ry - 2, w - 6, ROW_H);
      if (sel) {
        g.fillStyle = '#33365a';
        g.fillRect(x + 3, ry - 2, w - 6, ROW_H);
      }
      this.icon(g, x + 8, ry, r.file);
      const color = sel ? '#ffe991' : r.file === 'noa' ? '#8a8fb0' : r.file === this.confirm ? '#ff4a5a' : '#d8cfe0';
      drawText(g, r.name, x + 20, ry, { color });
      if (r.size) drawText(g, tr(r.size), x + w - 10, ry, { color: '#5c6080', align: 'right' });
    });
    // The status line: what happened, or Dodo (his line shivers now and then).
    const sy = y + h - 42;
    if (this.status) {
      g.fillStyle = '#0b0710';
      g.fillRect(x + 3, sy - 3, w - 6, 28);
      const jitter = this.statusDodo && this.t % 50 < 3 ? 1 : 0;
      const text = this.statusDodo ? tf('dodo.chr : « {0} »', this.status) : this.status;
      drawWrapped(g, text, x + 7 + jitter, sy, w - 14, { color: this.statusDodo ? '#fffaf2' : '#b7aab8', lineHeight: 11 });
    }
    const by = y + h - 11;
    if (this.confirm) {
      hits.add(this, 'yes', x + 4, by - 2, 90, 12);
      hits.add(this, 'no', x + w - 94, by - 2, 90, 12);
      drawText(g, tr('A : supprimer'), x + 8, by, { color: '#ff4a5a' });
      drawText(g, tr('B : annuler'), x + w - 8, by, { color: '#8a8fb0', align: 'right' });
    } else {
      drawText(g, tr(this.inBin ? 'A : restaurer · B : retour' : 'A : choisir · B : retour'), x + 8, by, { color: '#5c6080' });
    }
  }

  /** A little file icon (a page with a folded corner, in the character's colour), or the bin. */
  private icon(g: CanvasRenderingContext2D, x: number, y: number, file: Row['file']): void {
    if (file === 'bin') {
      g.fillStyle = '#8a8fb0';
      g.fillRect(x + 2, y, 3, 1);
      g.fillRect(x, y + 1, 7, 1);
      g.fillRect(x + 1, y + 3, 5, 5);
      return;
    }
    g.fillStyle = file === 'noa' ? '#9a7bd0' : file === 'dodo' ? '#fffaf2' : file === 'mina' ? '#e0834f' : '#f8b6cf';
    g.fillRect(x, y, 5, 8);
    g.fillRect(x + 5, y + 2, 2, 6);
    g.fillStyle = '#15172a';
    g.fillRect(x + 5, y, 2, 2);
  }
}

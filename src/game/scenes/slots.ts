import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { game, type Scene } from '../../engine/game';
import { hits, input } from '../../engine/input';
import { MAPS } from '../../data/maps';
import { lang, tf, tr, translated } from '../../i18n';
import { formatPlaytime, listSaves, SLOTS, type GameState } from '../state';
import { box, heart } from '../ui/draw';
import { MONTHS_EN, MONTHS_FR } from './phone';

/*
 * The five save slots (src/game/state.ts): one list for the three uses.
 *   save  at a nightlight: where to keep the run (another run's slot asks before it is replaced);
 *   load  « Continuer » on the title screen (several saves), « Charger » in the pause menu;
 *   new   « Nouvelle partie » when all five are taken: which one the new run replaces (asks first).
 * The running game's slot is marked « en cours ».
 */

export type SlotMode = 'save' | 'load' | 'new';

const BOX = { x: 22, y: 6, w: W - 44, h: H - 12 };
const ROW_Y = BOX.y + 24;
const ROW_H = 26;
const TEXT_W = BOX.w - 40;

const ROMAN = ['', 'I', 'II', 'III', 'IV']; // i18n-ignore (the same in English)

/** Where a save stands: « Chapitre 4 · Salle de jeux », « Interlude II · Chambre de Noa »… (in the reader's language). */
export function slotPlace(s: GameState, width = TEXT_W): string {
  const phase = Number(s.flags.interlude ?? 0);
  const part = s.flags.bonus
    ? tr('Les rêves des autres')
    : phase === 9
      ? tr('Final')
      : phase > 0
        ? tf('Interlude {0}', ROMAN[phase] ?? String(phase))
        : s.chapter <= 0
          ? tr('Prologue')
          : tf('Chapitre {0}', s.chapter);
  const map = MAPS[s.map]?.name;
  const full = map ? `${part} · ${tr(map)}` : part;
  return translated(measure(full) <= width ? full : part);
}

/** Who and when: « Noa · 1:23 · 14 nov., 02:13 » (a save from before version 2.2 has no date). */
export function slotDetails(s: GameState): string {
  const parts = [s.playerName, formatPlaytime(s.playtime)];
  if (s.savedAt > 0) {
    const d = new Date(s.savedAt);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    parts.push(lang() === 'en' ? `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${hm}` : `${d.getDate()} ${MONTHS_FR[d.getMonth()]}, ${hm}`);
  }
  return translated(parts.filter(Boolean).join(' · '));
}

export class SlotsScene implements Scene {
  /** Drawn over the screen it was opened from (dimmed). */
  transparent = true;
  private t = 0;
  private idx: number;
  /** The slot waiting for « Remplacer cette sauvegarde ? » (0-based), and the answer under the cursor. */
  private confirm: number | null = null;
  private yes = false;
  private readonly saves: Array<GameState | null>;
  private resolve: ((slot: number | null) => void) | null = null;

  constructor(
    readonly mode: SlotMode,
    /** The running game's slot (1-based), or null. */
    private readonly current: number | null,
    /** Where the cursor starts (1-based). */
    start: number | null,
  ) {
    this.saves = listSaves();
    this.idx = Math.max(0, Math.min(SLOTS - 1, (start ?? 1) - 1));
  }

  /** Shows the slots; resolves with the chosen slot (1-based), or null when the player backs out. */
  static pick(mode: SlotMode, current: number | null, start: number | null = current): Promise<number | null> {
    const s = new SlotsScene(mode, current, start);
    game.push(s);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  /** The slots as shown (tests, bot). */
  get slots(): Array<GameState | null> {
    return this.saves;
  }

  private close(slot: number | null): void {
    game.remove(this);
    const r = this.resolve;
    this.resolve = null;
    r?.(slot);
  }

  private choose(i: number): void {
    const save = this.saves[i];
    if (this.mode === 'load') {
      if (!save) {
        audio.sfx('cancel');
        return;
      }
      audio.sfx('select');
      this.close(i + 1);
      return;
    }
    // Saving over this run's own slot, or into an empty one, needs no question.
    if (!save || (this.mode === 'save' && this.current === i + 1)) {
      audio.sfx('select');
      this.close(i + 1);
      return;
    }
    audio.sfx('select', { pitch: 0.8 });
    this.confirm = i;
    this.yes = false;
  }

  update(): void {
    this.t++;
    const hit = hits.pick(this);
    const tap = hit?.tap ? hit.id : null;
    if (this.confirm !== null) {
      if (hit?.id === 'yes' || hit?.id === 'no') this.yes = hit.id === 'yes';
      if (input.repeat('left') || input.repeat('right')) {
        this.yes = !this.yes;
        audio.sfx('move');
      }
      const ok = input.pressed('a') || tap === 'yes' || tap === 'no';
      if (input.pressed('b') || input.pressed('menu') || (ok && !this.yes)) {
        audio.sfx('cancel');
        this.confirm = null;
      } else if (ok) {
        audio.sfx('select');
        this.close(this.confirm + 1);
      }
      return;
    }
    if (hit && typeof hit.id === 'number' && hit.id !== this.idx) {
      this.idx = hit.id;
      audio.sfx('move');
    }
    if (input.repeat('up')) {
      this.idx = (this.idx + SLOTS - 1) % SLOTS;
      audio.sfx('move');
    } else if (input.repeat('down')) {
      this.idx = (this.idx + 1) % SLOTS;
      audio.sfx('move');
    }
    if (input.pressed('a') || typeof tap === 'number') return this.choose(this.idx);
    if (input.pressed('b') || input.pressed('menu') || tap === 'close') {
      audio.sfx('cancel');
      this.close(null);
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(11,7,16,0.82)';
    g.fillRect(0, 0, W, H);
    const { x, y, w, h } = BOX;
    box(g, x, y, w, h, 'dream');
    const title = this.mode === 'save' ? 'Où garder ta progression ?' : this.mode === 'load' ? 'Charger une sauvegarde' : 'Remplacer quelle sauvegarde ?';
    drawText(g, tr(title), x + 10, y + 8, { color: '#d4b8f0' });
    hits.add(this, 'close', x + w - 18, y, 18, 18);
    drawText(g, '✕', x + w - 13, y + 7, { color: '#8a7f96' });
    this.saves.forEach((s, i) => {
      const ry = ROW_Y + i * ROW_H;
      const sel = i === this.idx && this.confirm === null;
      hits.add(this, i, x + 4, ry - 3, w - 8, ROW_H - 1);
      if (sel) heart(g, x + 8, ry + 4, '#ff4a5a');
      const dim = !s && this.mode === 'load';
      drawText(g, String(i + 1), x + 20, ry + 1, { color: sel ? '#ffd84a' : '#8a7f96' });
      if (!s) {
        drawText(g, tr('— vide —'), x + 32, ry + 1, { color: dim ? '#4e4359' : sel ? '#ffd84a' : '#8a7f96' });
        return;
      }
      drawText(g, slotPlace(s), x + 32, ry + 1, { color: sel ? '#ffd84a' : '#fffaf2' });
      drawText(g, slotDetails(s), x + 32, ry + 12, { color: '#8a7f96' });
      if (this.current === i + 1) drawText(g, tr('en cours'), x + w - 10, ry + 12, { color: '#b4e2c8', align: 'right' });
    });
    if (this.confirm !== null) this.drawConfirm(g);
  }

  private drawConfirm(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(11,7,16,0.6)';
    g.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    const bw = 200;
    const bx = (W - bw) / 2;
    const by = 64;
    box(g, bx, by, bw, 52, 'dream');
    drawText(g, tr('Remplacer cette sauvegarde ?'), W / 2, by + 9, { align: 'center' });
    drawText(g, slotPlace(this.saves[this.confirm!]!, bw - 16), W / 2, by + 21, { align: 'center', color: '#8a7f96' });
    ['Oui', 'Non'].forEach((l, i) => {
      const cx = W / 2 - 36 + i * 72;
      const sel = this.yes === (i === 0);
      hits.add(this, i === 0 ? 'yes' : 'no', cx - 26, by + 33, 52, 16);
      if (sel) heart(g, cx - 18, by + 40, '#ff4a5a');
      drawText(g, tr(l), cx, by + 37, { align: 'center', color: sel ? '#ffd84a' : '#fffaf2' });
    });
  }
}

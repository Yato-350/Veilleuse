import { audio } from '../../engine/audio';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { hits, input } from '../../engine/input';
import { screen, setVibration } from '../../engine/screen';
import { G, TEXT_SPEED_LABELS, writeSettings, type Settings } from '../state';
import { heart } from './draw';
import { LANGUAGES, tr } from '../../i18n';

interface Row {
  label: string;
  value: () => string;
  change: (dir: number) => void;
  action?: () => void;
  /** Numeric value: a tap on the left half of the row lowers it, on the right half raises it. */
  slider?: boolean;
}

/** Applies settings to the engine. */
export function applySettings(s: Settings = G.settings): void {
  audio.setMusicVolume(s.music);
  audio.setSfxVolume(s.sfx);
  fx.shakeEnabled = s.shake;
  fx.reduceFlashes = s.reduceFlashes;
  screen.setCrt(s.crt);
  screen.setTouchMode(s.touch);
  screen.setTouchStyle(s.touchOpacity, s.touchSize);
  setVibration(s.vibration);
  if (typeof document !== 'undefined') document.documentElement.lang = s.language;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const onOff = (v: boolean) => tr(v ? 'Oui' : 'Non');

/** Settings list widget (used in the pause menu and on the title screen). */
export class OptionsPanel {
  idx = 0;
  rows: Row[];
  private t = 0;
  /** First visible row of the last draw; kept while tapping so the list doesn't jump under the finger. */
  private start = 0;
  private visible = 9;
  private pinned = false;
  /** Row rectangles of the last draw (x, width) for left/right half taps on sliders. */
  private rowX = 0;
  private rowW = 0;

  constructor() {
    const s = () => G.settings;
    const save = () => {
      writeSettings(G.settings);
      applySettings();
    };
    const vol = (key: 'music' | 'sfx') => (dir: number) => {
      s()[key] = Math.round(Math.min(1, Math.max(0, s()[key] + dir * 0.1)) * 10) / 10;
      save();
      if (key === 'sfx') audio.sfx('blip');
    };
    const toggle = (key: 'shake' | 'reduceFlashes' | 'crt' | 'storyMode' | 'vibration' | 'emotionShapes') => () => {
      s()[key] = !s()[key];
      save();
    };
    this.rows = [
      {
        // Shown in both languages, so that a player lost in a language they can't read still finds it.
        label: 'Langue / Language',
        value: () => LANGUAGES.find((l) => l.id === s().language)?.name ?? s().language,
        change: (d) => {
          const i = LANGUAGES.findIndex((l) => l.id === s().language);
          s().language = LANGUAGES[(i + d + LANGUAGES.length) % LANGUAGES.length]!.id;
          save();
        },
      },
      { label: 'Musique', value: () => pct(s().music), change: vol('music'), slider: true },
      { label: 'Effets sonores', value: () => pct(s().sfx), change: vol('sfx'), slider: true },
      {
        label: 'Vitesse du texte',
        value: () => tr(TEXT_SPEED_LABELS[s().textSpeed]!),
        change: (d) => {
          s().textSpeed = (((s().textSpeed + d) % 4) + 4) % 4 as Settings['textSpeed'];
          save();
        },
      },
      { label: 'Mode Histoire', value: () => onOff(s().storyMode), change: toggle('storyMode') },
      { label: 'Secousses', value: () => onOff(s().shake), change: toggle('shake') },
      { label: 'Réduire les flashs', value: () => onOff(s().reduceFlashes), change: toggle('reduceFlashes') },
      { label: 'Formes des émotions', value: () => onOff(s().emotionShapes), change: toggle('emotionShapes') },
      { label: 'Filtre CRT', value: () => onOff(s().crt), change: toggle('crt') },
      {
        label: 'Contrôles tactiles',
        value: () => tr({ auto: 'Auto', on: 'Toujours', off: 'Jamais' }[s().touch]),
        change: (d) => {
          const order: Settings['touch'][] = ['auto', 'on', 'off'];
          s().touch = order[(order.indexOf(s().touch) + d + 3) % 3]!;
          save();
        },
      },
      {
        label: 'Opacité tactile',
        slider: true,
        value: () => pct(s().touchOpacity),
        change: (d) => {
          s().touchOpacity = Math.round(Math.min(1, Math.max(0.2, s().touchOpacity + d * 0.1)) * 10) / 10;
          save();
        },
      },
      {
        label: 'Taille tactile',
        slider: true,
        value: () => pct(s().touchSize),
        change: (d) => {
          s().touchSize = Math.round(Math.min(1.5, Math.max(0.7, s().touchSize + d * 0.1)) * 10) / 10;
          save();
        },
      },
      { label: 'Vibrations', value: () => onOff(s().vibration), change: toggle('vibration') },
      {
        label: 'Plein écran',
        value: () => onOff(!!document.fullscreenElement),
        change: () => toggleFullscreen(),
        action: () => toggleFullscreen(),
      },
    ];
  }

  /** Returns false when the player backs out. */
  update(): boolean {
    this.t++;
    const n = this.rows.length;
    if (this.updatePointer()) return true;
    if (input.repeat('up')) {
      this.idx = (this.idx + n - 1) % n;
      this.pinned = false;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.idx = (this.idx + 1) % n;
      this.pinned = false;
      audio.sfx('move');
    }
    const row = this.rows[this.idx]!;
    if (input.repeat('left')) {
      row.change(-1);
      audio.sfx('move', { pitch: 0.9 });
    }
    if (input.repeat('right')) {
      row.change(1);
      audio.sfx('move', { pitch: 1.1 });
    }
    if (input.pressed('a')) {
      if (row.action) row.action();
      else row.change(1);
      audio.sfx('select');
    }
    if (input.pressed('b') || input.pressed('menu')) {
      audio.sfx('cancel');
      return false;
    }
    return true;
  }

  /**
   * Direct touch / mouse: hovering selects a row; a tap selects it and acts at once (toggles and lists cycle,
   * sliders go down on the left half of the row and up on the right half, ↑ ↓ scroll). True when a tap was handled.
   */
  private updatePointer(): boolean {
    const hit = hits.pick(this);
    if (!hit) return false;
    const n = this.rows.length;
    if (hit.id === 'up' || hit.id === 'down') {
      if (!hit.tap) return false;
      this.idx = hit.id === 'up' ? Math.max(0, this.start - 1) : Math.min(n - 1, this.start + this.visible);
      this.pinned = false;
      audio.sfx('move');
      return true;
    }
    if (typeof hit.id !== 'number') return false;
    if (hit.id !== this.idx) {
      this.idx = hit.id;
      this.pinned = true;
      if (!hit.tap) audio.sfx('move');
    }
    if (!hit.tap) return false;
    const row = this.rows[this.idx]!;
    if (row.slider) {
      const right = (input.tapAt?.x ?? 0) >= this.rowX + this.rowW / 2;
      row.change(right ? 1 : -1);
      audio.sfx('move', { pitch: right ? 1.1 : 0.9 });
    } else {
      if (row.action) row.action();
      else row.change(1);
      audio.sfx('select');
    }
    return true;
  }

  draw(g: CanvasRenderingContext2D, x: number, y: number, w: number, visible = 9): void {
    const max = Math.max(0, this.rows.length - visible);
    let start = Math.max(0, Math.min(this.idx - Math.floor(visible / 2), max));
    // After a tap, keep the list still as long as the selected row stays visible.
    if (this.pinned && this.idx >= this.start && this.idx < this.start + visible) start = Math.min(this.start, max);
    this.start = start;
    this.visible = visible;
    this.rowX = x - 4;
    this.rowW = w + 8;
    for (let i = start; i < Math.min(this.rows.length, start + visible); i++) {
      const r = this.rows[i]!;
      const ry = y + (i - start) * 13;
      const sel = i === this.idx;
      hits.add(this, i, x - 4, ry - 2, w + 8, 13);
      if (sel) heart(g, x, ry + 3, '#ff4a5a');
      drawText(g, tr(r.label), x + 11, ry, { color: sel ? '#ffd84a' : '#fffaf2' });
      const v = r.value();
      drawText(g, sel ? `◀ ${v} ▶` : v, x + w, ry, { color: sel ? '#ffd84a' : '#b7aab8', align: 'right' });
    }
    if (start > 0) {
      drawText(g, '↑', x + w / 2, y - 10, { color: '#8a7f96' });
      hits.add(this, 'up', x + w / 2 - 12, y - 13, 28, 11);
    }
    if (start + visible < this.rows.length) {
      drawText(g, '↓', x + w / 2, y + visible * 13, { color: '#8a7f96' });
      hits.add(this, 'down', x + w / 2 - 12, y + visible * 13 - 2, 28, 12);
    }
  }
}

export function toggleFullscreen(): void {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    /* not supported (iOS Safari) */
  }
}

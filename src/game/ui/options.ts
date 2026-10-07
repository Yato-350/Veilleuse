import { audio } from '../../engine/audio';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { input } from '../../engine/input';
import { screen, setVibration } from '../../engine/screen';
import { G, TEXT_SPEED_LABELS, writeSettings, type Settings } from '../state';
import { heart } from './draw';

interface Row {
  label: string;
  value: () => string;
  change: (dir: number) => void;
  action?: () => void;
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
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const onOff = (v: boolean) => (v ? 'Oui' : 'Non');

/** Settings list widget (used in the pause menu and on the title screen). */
export class OptionsPanel {
  idx = 0;
  rows: Row[];
  private t = 0;

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
    const toggle = (key: 'shake' | 'reduceFlashes' | 'crt' | 'storyMode' | 'vibration') => () => {
      s()[key] = !s()[key];
      save();
    };
    this.rows = [
      { label: 'Musique', value: () => pct(s().music), change: vol('music') },
      { label: 'Effets sonores', value: () => pct(s().sfx), change: vol('sfx') },
      {
        label: 'Vitesse du texte',
        value: () => TEXT_SPEED_LABELS[s().textSpeed]!,
        change: (d) => {
          s().textSpeed = (((s().textSpeed + d) % 4) + 4) % 4 as Settings['textSpeed'];
          save();
        },
      },
      { label: 'Mode Histoire', value: () => onOff(s().storyMode), change: toggle('storyMode') },
      { label: 'Secousses', value: () => onOff(s().shake), change: toggle('shake') },
      { label: 'Réduire les flashs', value: () => onOff(s().reduceFlashes), change: toggle('reduceFlashes') },
      { label: 'Filtre CRT', value: () => onOff(s().crt), change: toggle('crt') },
      {
        label: 'Contrôles tactiles',
        value: () => ({ auto: 'Auto', on: 'Toujours', off: 'Jamais' })[s().touch],
        change: (d) => {
          const order: Settings['touch'][] = ['auto', 'on', 'off'];
          s().touch = order[(order.indexOf(s().touch) + d + 3) % 3]!;
          save();
        },
      },
      {
        label: 'Opacité tactile',
        value: () => pct(s().touchOpacity),
        change: (d) => {
          s().touchOpacity = Math.round(Math.min(1, Math.max(0.2, s().touchOpacity + d * 0.1)) * 10) / 10;
          save();
        },
      },
      {
        label: 'Taille tactile',
        value: () => pct(s().touchSize),
        change: (d) => {
          s().touchSize = Math.round(Math.min(1.5, Math.max(0.7, s().touchSize + d * 0.1)) * 10) / 10;
          save();
        },
      },
      { label: 'Vibrations', value: () => onOff(s().vibration), change: toggle('vibration') },
      {
        label: 'Plein écran',
        value: () => (document.fullscreenElement ? 'Oui' : 'Non'),
        change: () => toggleFullscreen(),
        action: () => toggleFullscreen(),
      },
    ];
  }

  /** Returns false when the player backs out. */
  update(): boolean {
    this.t++;
    const n = this.rows.length;
    if (input.repeat('up')) {
      this.idx = (this.idx + n - 1) % n;
      audio.sfx('move');
    }
    if (input.repeat('down')) {
      this.idx = (this.idx + 1) % n;
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

  draw(g: CanvasRenderingContext2D, x: number, y: number, w: number, visible = 9): void {
    const start = Math.max(0, Math.min(this.idx - Math.floor(visible / 2), this.rows.length - visible));
    for (let i = start; i < Math.min(this.rows.length, start + visible); i++) {
      const r = this.rows[i]!;
      const ry = y + (i - start) * 13;
      const sel = i === this.idx;
      if (sel) heart(g, x, ry + 3, '#ff4a5a');
      drawText(g, r.label, x + 11, ry, { color: sel ? '#ffd84a' : '#fffaf2' });
      const v = r.value();
      drawText(g, sel ? `◀ ${v} ▶` : v, x + w, ry, { color: sel ? '#ffd84a' : '#b7aab8', align: 'right' });
    }
    if (start > 0) drawText(g, '↑', x + w / 2, y - 10, { color: '#8a7f96' });
    if (start + visible < this.rows.length) drawText(g, '↓', x + w / 2, y + visible * 13, { color: '#8a7f96' });
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

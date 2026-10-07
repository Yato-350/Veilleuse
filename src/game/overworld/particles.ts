import { H, W } from '../../engine/constants';
import { rng } from '../../engine/math';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  kind: 'dot' | 'glow' | 'streak' | 'flake' | 'drip' | 'star';
  phase: number;
  screen: boolean;
}

export type ParticleMode = 'fireflies' | 'cotton' | 'dust' | 'rain' | 'ink' | 'petals' | 'stars' | 'snow' | 'none';

/** Ambient particles (world-space or screen-space). */
export class Particles {
  list: Particle[] = [];
  mode: ParticleMode = 'none';
  private t = 0;

  setMode(m: ParticleMode | undefined): void {
    this.mode = m ?? 'none';
    this.list = [];
  }

  burst(x: number, y: number, color: string, n = 12, speed = 1.5, kind: Particle['kind'] = 'dot'): void {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(0.3, speed);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 0.5,
        life: 0,
        max: rng.int(25, 50),
        color,
        size: 1,
        kind,
        phase: rng.range(0, 6),
        screen: false,
      });
    }
  }

  update(camX: number, camY: number): void {
    this.t++;
    const m = this.mode;
    const spawn = (p: Partial<Particle>) =>
      this.list.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 300,
        color: '#ffffff',
        size: 1,
        kind: 'dot',
        phase: rng.range(0, 6),
        screen: false,
        ...p,
      });
    const count = this.list.length;
    if (m === 'fireflies' && count < 18 && this.t % 12 === 0) {
      spawn({
        x: camX + rng.range(0, W),
        y: camY + rng.range(0, H),
        vx: rng.range(-0.15, 0.15),
        vy: rng.range(-0.15, 0.05),
        max: rng.int(200, 400),
        color: rng.pick(['#ffe991', '#fff3cf', '#c4ecaa']),
        kind: 'glow',
      });
    } else if (m === 'cotton' && count < 30 && this.t % 8 === 0) {
      spawn({
        x: rng.range(-20, W),
        y: -4,
        vx: rng.range(0.1, 0.35),
        vy: rng.range(0.15, 0.35),
        max: 700,
        color: rng.pick(['#fffaf2', '#ece2df', '#f8d6e6']),
        kind: 'flake',
        size: rng.pick([1, 2]),
        screen: true,
      });
    } else if (m === 'petals' && count < 22 && this.t % 10 === 0) {
      spawn({
        x: rng.range(-20, W),
        y: -4,
        vx: rng.range(0.2, 0.5),
        vy: rng.range(0.2, 0.4),
        max: 700,
        color: rng.pick(['#f8b6cf', '#e07ba5', '#fff3cf']),
        kind: 'flake',
        size: 2,
        screen: true,
      });
    } else if (m === 'snow' && count < 50 && this.t % 4 === 0) {
      spawn({
        x: rng.range(-20, W),
        y: -4,
        vx: rng.range(-0.1, 0.3),
        vy: rng.range(0.3, 0.6),
        max: 600,
        color: '#fffaf2',
        kind: 'flake',
        size: rng.pick([1, 1, 2]),
        screen: true,
      });
    } else if (m === 'dust' && count < 25 && this.t % 14 === 0) {
      spawn({
        x: rng.range(0, W),
        y: rng.range(0, H),
        vx: rng.range(-0.05, 0.05),
        vy: rng.range(-0.08, 0.02),
        max: rng.int(200, 400),
        color: '#8a8fb0',
        kind: 'dot',
        screen: true,
      });
    } else if (m === 'rain' && count < 90) {
      for (let i = 0; i < 3; i++) {
        spawn({
          x: rng.range(-20, W + 40),
          y: rng.range(-20, -2),
          vx: -1.2,
          vy: rng.range(5, 7),
          max: 60,
          color: '#6d7398',
          kind: 'streak',
          screen: true,
        });
      }
    } else if (m === 'ink' && count < 20 && this.t % 9 === 0) {
      spawn({
        x: rng.range(0, W),
        y: -4,
        vx: 0,
        vy: rng.range(0.4, 1.2),
        max: 400,
        color: '#0b0710',
        kind: 'drip',
        size: rng.pick([1, 2]),
        screen: true,
      });
    } else if (m === 'stars' && count < 40 && this.t % 6 === 0) {
      spawn({
        x: rng.range(0, W),
        y: rng.range(0, H),
        max: rng.int(80, 200),
        color: rng.pick(['#fffaf2', '#ffe991', '#d4b8f0']),
        kind: 'star',
        screen: true,
      });
    }
    for (const p of this.list) {
      p.life++;
      if (p.kind === 'glow') {
        p.vx += Math.sin(p.life * 0.05 + p.phase) * 0.01;
        p.vy += Math.cos(p.life * 0.04 + p.phase) * 0.01;
      } else if (p.kind === 'flake') {
        p.vx = Math.sin(p.life * 0.03 + p.phase) * 0.3 + 0.15;
      } else if (p.kind === 'dot' && !p.screen) {
        p.vy += 0.05;
        p.vx *= 0.95;
      }
      p.x += p.vx;
      p.y += p.vy;
    }
    this.list = this.list.filter((p) => p.life < p.max && (p.screen ? p.y < H + 10 : true));
  }

  draw(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.list) {
      const x = Math.round(p.screen ? p.x : p.x - camX);
      const y = Math.round(p.screen ? p.y : p.y - camY);
      const fade = Math.min(1, p.life / 20, (p.max - p.life) / 20);
      g.globalAlpha = Math.max(0, fade);
      g.fillStyle = p.color;
      switch (p.kind) {
        case 'glow': {
          const pulse = 0.5 + 0.5 * Math.sin(p.life * 0.08 + p.phase);
          g.globalAlpha = fade * (0.25 + pulse * 0.2);
          g.fillRect(x - 1, y - 1, 3, 3);
          g.globalAlpha = fade * (0.6 + pulse * 0.4);
          g.fillRect(x, y, 1, 1);
          break;
        }
        case 'streak':
          g.globalAlpha = 0.5;
          g.fillRect(x, y, 1, 4);
          break;
        case 'drip':
          g.fillRect(x, y, p.size, p.size * 3);
          break;
        case 'star': {
          const tw = Math.sin((p.life / p.max) * Math.PI);
          g.globalAlpha = tw;
          g.fillRect(x, y, 1, 1);
          if (tw > 0.7) {
            g.globalAlpha = tw * 0.5;
            g.fillRect(x - 1, y, 3, 1);
            g.fillRect(x, y - 1, 1, 3);
          }
          break;
        }
        default:
          g.fillRect(x, y, p.size, p.size);
      }
    }
    g.globalAlpha = 1;
  }
}

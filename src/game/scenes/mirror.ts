import { audio } from '../../engine/audio';
import { H, W } from '../../engine/constants';
import { drawText } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { hash2 } from '../../engine/math';
import { silhouette, type Sprite } from '../../engine/sprite';
import { tr } from '../../i18n';
import { spr } from '../assets';

/*
 * The bathroom mirror (src/data/maps/real.ts, story/real.ts bathroomMirror), the first time Noa looks at himself:
 * his reflection, close and calm; then, for a few frames, an ink silhouette in its place — the head tilted, the face
 * a hole. Faster and faster, the reflection's eyes crossed out in ink a little more each time (like a drawing one
 * scribbles over); then the silhouette stays, its head bends further, a scream, black.
 *
 * Flashes: the two images never swap more than three times a second (a state lasts 10 frames at least: the general
 * flash threshold, WCAG 2.3.1). With « Réduire les flashs », no swapping at all: the reflection slowly dissolves into
 * the silhouette, and the end fades instead of cutting.
 *
 * The ink route (inkRoute()) is stronger: more swaps, a longer stare, and the mirror keeps a word in ink.
 */

type Shot = { kind: 'noa' | 'ink'; frames: number };

/** The timeline: long calm reflection, then the silhouette more and more often. */
function timeline(ink: boolean): Shot[] {
  const pairs: Array<[number, number]> = [
    [110, 10],
    [70, 10],
    [50, 12],
    [36, 12],
    [26, 12],
    [18, 12],
    [14, 12],
    [12, 12],
    [10, 10],
    [10, 10],
  ];
  if (ink) pairs.push([10, 10], [10, 10], [10, 12], [10, 14], [10, 16]);
  return pairs.flatMap(([n, k]) => [
    { kind: 'noa' as const, frames: n },
    { kind: 'ink' as const, frames: k },
  ]);
}

const GLASS = { x: 108, y: 12, w: 104, h: 148 };
const FACE = 3;
/** Where the face sits in the glass (top-left of the 32×32 portrait, scaled ×3). */
const FX = GLASS.x + (GLASS.w - 32 * FACE) / 2;
const FY = GLASS.y + 34;
/** The neck: the silhouette's head turns around it. */
const PIVOT = { x: FX + 16 * FACE, y: FY + 27 * FACE };
/** Ballpoint ink (the material of act 2), its lighter edge, and the black of the glass behind it. */
const INK = '#1b1a78';
/** The portrait's eyes (rows 19–21, 7 px either side of the middle), scaled. */
const EYE_X = 22;
const EYE_Y = 60;
const RIM = '#4a48d0';
const VOID = '#04050a';

export class MirrorScene implements Scene {
  private t = 0;
  private readonly shots: Shot[];
  /** Frame at which the alternation ends (the stare starts). */
  private readonly endAlt: number;
  private readonly stare: number;
  private readonly calm: boolean;
  private resolve: (() => void) | null = null;
  private screamed = false;
  private readonly face: Sprite;
  private readonly ink: Sprite;
  private readonly rim: Sprite;

  constructor(private readonly inkRoute: boolean) {
    this.calm = fx.reduceFlashes;
    this.shots = timeline(inkRoute);
    this.endAlt = this.calm ? 320 : this.shots.reduce((a, s) => a + s.frames, 0);
    this.stare = inkRoute ? 120 : 80;
    this.face = spr('face_noa_tired');
    this.ink = silhouette(this.face, INK);
    this.rim = silhouette(this.face, RIM);
  }

  /** Plays the scene; resolves once the screen is black (the caller fades back in). */
  static play(inkRoute: boolean): Promise<void> {
    const s = new MirrorScene(inkRoute);
    game.push(s);
    audio.stopMusic(0.5);
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  /** Total length in frames (tests). */
  get length(): number {
    return this.endAlt + this.stare + 70;
  }

  /** Which image the mirror shows at frame t, and how many silhouettes came before (for the scratches). */
  private shotAt(t: number): { kind: 'noa' | 'ink'; index: number; mix: number } {
    if (this.calm) {
      // A slow dissolve: the reflection for two seconds, then three seconds into the silhouette.
      const k = Math.min(1, Math.max(0, (t - 120) / 200));
      return { kind: k >= 1 ? 'ink' : 'noa', index: Math.floor(k * 10), mix: k };
    }
    let acc = 0;
    let inks = 0;
    for (const s of this.shots) {
      if (t < acc + s.frames) return { kind: s.kind, index: inks, mix: s.kind === 'ink' ? 1 : 0 };
      acc += s.frames;
      if (s.kind === 'ink') inks++;
    }
    return { kind: 'ink', index: inks, mix: 1 };
  }

  update(): void {
    const t = this.t++;
    if (t < 100 && t % 50 === 20) audio.sfx('drip', { vol: 0.8 });
    if (t < this.endAlt) {
      const prev = t > 0 ? this.shotAt(t - 1).kind : 'noa';
      const now = this.shotAt(t).kind;
      if (!this.calm && now === 'ink' && prev === 'noa') audio.sfx('static', { vol: 0.35, pitch: 0.7 + Math.random() * 0.2 });
      if (t % 40 === 0 && t > 100) audio.sfx('heartbeat', { vol: 0.5 + Math.min(0.4, t / 1200) });
    }
    // The stare: the head creaks over, then the scream and black.
    const s = t - this.endAlt;
    if (s === 10) audio.sfx('scratch', { vol: 0.5, pitch: 0.6 });
    if (s === this.stare && !this.screamed) {
      this.screamed = true;
      audio.sfx('scream');
      if (!this.calm) fx.pulseGlitch(10);
    }
    if (t >= this.length) {
      // Black underneath too: the room comes back with the caller's fade in.
      fx.setFade(1);
      game.remove(this);
      const r = this.resolve;
      this.resolve = null;
      r?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = this.t;
    const s = t - this.endAlt;
    g.imageSmoothingEnabled = false;
    // After the scream: black (cut; faded with « Réduire les flashs »).
    if (s >= this.stare) {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      if (this.calm) {
        const k = Math.max(0, 1 - (s - this.stare) / 30);
        if (k > 0) {
          g.globalAlpha = k;
          this.drawRoom(g, 1);
          g.globalAlpha = 1;
        }
      }
      return;
    }
    const shot = t < this.endAlt ? this.shotAt(t) : { kind: 'ink' as const, index: 99, mix: 1 };
    this.drawRoom(g, shot.mix);
    g.save();
    g.beginPath();
    g.rect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    g.clip();
    // Behind the head, the reflected light; when the silhouette is there, the glass is black and the light a cold halo.
    g.fillStyle = shot.mix >= 1 ? VOID : '#262c3e';
    g.fillRect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
    g.globalAlpha = 1 - shot.mix;
    g.fillStyle = '#353d55';
    g.beginPath();
    g.arc(PIVOT.x, FY + 40, 52, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = shot.mix;
    g.fillStyle = '#0d1230';
    g.beginPath();
    g.arc(PIVOT.x, FY + 40, 50, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    const scratches = Math.min(1, shot.index / (this.inkRoute ? 12 : 9));
    if (shot.mix < 1) {
      g.globalAlpha = 1 - shot.mix;
      this.drawFace(g, t, scratches);
      g.globalAlpha = 1;
    }
    if (shot.mix > 0) {
      g.globalAlpha = shot.mix;
      const stare = Math.max(0, Math.min(1, s / this.stare));
      this.drawInk(g, t, shot.index, s >= 0 ? stare : 0);
      g.globalAlpha = 1;
    }
    // The ink route: the word stays on the glass at the end of the stare.
    if (this.inkRoute && s > this.stare * 0.45) this.drawWord(g, s);
    // Glass: two faint diagonal glints.
    g.globalAlpha = 0.07;
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 2; i++) {
      g.save();
      g.translate(GLASS.x + 20 + i * 30, GLASS.y);
      g.rotate(0.5);
      g.fillRect(0, 0, 6 - i * 3, GLASS.h * 1.4);
      g.restore();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  /** The bathroom wall around the mirror: tiles, the frame, the shelf with two toothbrushes in a glass. */
  private drawRoom(g: CanvasRenderingContext2D, dark: number): void {
    g.fillStyle = dark >= 1 ? '#0d0f15' : '#1b1f2b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = dark >= 1 ? '#13161f' : '#242a39';
    for (let x = 0; x < W; x += 16) g.fillRect(x, 0, 1, H);
    for (let y = 6; y < H; y += 16) g.fillRect(0, y, W, 1);
    const { x, y, w, h } = GLASS;
    g.fillStyle = '#5c6080';
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
    g.fillStyle = '#8a8fb0';
    g.fillRect(x - 4, y - 4, w + 8, 1);
    g.fillRect(x - 4, y - 4, 1, h + 8);
    g.fillStyle = '#2f3248';
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    // The shelf under the mirror: the glass, two toothbrushes (a big one, a little one with a sheep).
    g.fillStyle = '#8a8fb0';
    g.fillRect(x - 10, y + h + 6, w + 20, 3);
    g.fillStyle = '#4e5470';
    g.fillRect(x + w - 26, y + h - 2, 8, 8);
    g.fillStyle = '#a7c7f0';
    g.fillRect(x + w - 24, y + h - 12, 1, 12);
    g.fillStyle = '#f8b6cf';
    g.fillRect(x + w - 21, y + h - 8, 1, 8);
    g.fillStyle = '#fffaf2';
    g.fillRect(x + w - 22, y + h - 10, 3, 2);
  }

  /** Noa's reflection, breathing; ink scribbles over the eyes, more each time the silhouette has come. */
  private drawFace(g: CanvasRenderingContext2D, t: number, scratches: number): void {
    const bob = Math.round(Math.sin(t / 24));
    const s = this.face;
    g.drawImage(s.img, FX, FY + bob, s.w * FACE, s.h * FACE);
    if (scratches <= 0) return;
    // Ballpoint scribbles across the eyes, as one crosses out a drawing (never a wound: ink on the glass).
    g.strokeStyle = INK;
    g.lineWidth = 2;
    const n = Math.round(scratches * 16);
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const ex = PIVOT.x + side * EYE_X;
      const ey = FY + bob + EYE_Y;
      g.beginPath();
      for (let k = 0; k < 5; k++) {
        const x = ex + (k % 2 === 0 ? -11 : 11) + (hash2(i, k, 3) - 0.5) * 6;
        const y = ey - 6 + k * 3 + (hash2(i, k, 7) - 0.5) * 4;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    // At the end, ink runs down from the scribbles.
    if (scratches > 0.6) {
      g.fillStyle = INK;
      for (let i = 0; i < 4; i++) {
        const len = Math.round((scratches - 0.6) * 70 * (0.5 + hash2(i, 2, 8)));
        g.fillRect(PIVOT.x + (i < 2 ? -EYE_X - 3 : EYE_X - 3) + (i % 2) * 6, FY + bob + EYE_Y + 5, 2, len);
      }
    }
  }

  /** The ink silhouette: Noa's shape, the head tilted (further at each coming, then during the stare), a hollow face. */
  private drawInk(g: CanvasRenderingContext2D, t: number, index: number, stare: number): void {
    const tilt = (0.16 + Math.min(index, 14) * 0.012 + stare * stare * 0.42) * (this.inkRoute ? 1.15 : 1);
    const s = this.ink;
    g.save();
    g.translate(PIVOT.x, PIVOT.y);
    g.rotate(-tilt);
    const ox = -16 * FACE;
    const oy = -27 * FACE;
    g.drawImage(this.rim.img, ox - 1, oy, s.w * FACE, s.h * FACE);
    g.drawImage(this.rim.img, ox + 1, oy - 1, s.w * FACE, s.h * FACE);
    g.drawImage(s.img, ox, oy, s.w * FACE, s.h * FACE);
    // The face: two hollows where the eyes were, and below them a mouth that keeps opening downward.
    const open = 4 + stare * 20 + (this.inkRoute ? 5 : 0);
    const holes = (grow: number, color: string): void => {
      g.fillStyle = color;
      for (const [x, y, rx, ry] of [
        [-EYE_X + 1, EYE_Y - 81, 6, 4],
        [EYE_X - 1, EYE_Y - 81, 6, 4],
        [0, -10 + open / 2, 5, open / 2 + 1],
      ] as const) {
        g.beginPath();
        g.ellipse(x, y, rx + grow, ry + grow, 0, 0, Math.PI * 2);
        g.fill();
      }
    };
    holes(1, '#08072a');
    holes(0, '#000000');
    g.restore();
    // Ink drips from the chin, longer and longer.
    g.fillStyle = INK;
    for (let i = 0; i < 5; i++) {
      const len = ((t * (0.6 + hash2(i, 1, 4)) + i * 17) % 60) + stare * 30;
      g.fillRect(PIVOT.x - 14 + i * 7, PIVOT.y + 2, 2, Math.round(len));
    }
  }

  /** The ink route: MONSTRE, written in ink on the glass, as if from the other side. */
  private drawWord(g: CanvasRenderingContext2D, s: number): void {
    const k = Math.min(1, (s - this.stare * 0.45) / 20);
    g.globalAlpha = k;
    drawText(g, tr('MONSTRE'), GLASS.x + GLASS.w / 2, GLASS.y + GLASS.h - 30, { align: 'center', color: RIM, scale: 2 });
    g.fillStyle = RIM;
    for (let i = 0; i < 6; i++) g.fillRect(GLASS.x + 18 + i * 13, GLASS.y + GLASS.h - 16, 2, Math.round(k * (6 + hash2(i, 5, 1) * 14)));
    g.globalAlpha = 1;
  }
}

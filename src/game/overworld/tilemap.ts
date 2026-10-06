import { TILE } from '../../engine/constants';
import { hash2 } from '../../engine/math';
import { parseRows, makeCanvas, ctx2d, drawSprite } from '../../engine/sprite';
import { hasSpr, spr } from '../assets';
import { TILES } from '../../data/tiles';
import type { MapDef, TileDef } from './types';

/** Parsed tile grid with collision and pre-rendered layers. */
export class Tilemap {
  w: number;
  h: number;
  ids: string[][];
  defs: (TileDef | null)[][];
  ground: HTMLCanvasElement | null = null;
  over: HTMLCanvasElement | null = null;
  /** Organic edges, drawn after animated tiles so they also overlap water. */
  edges: HTMLCanvasElement | null = null;
  animated: Array<{ x: number; y: number; def: TileDef }> = [];
  private variant: string;

  constructor(map: MapDef) {
    const rows = parseRows(map.tiles);
    this.h = rows.length;
    this.w = rows[0]?.length ?? 0;
    this.variant = map.world;
    this.ids = rows.map((row) => [...row].map((ch) => map.legend[ch] ?? ''));
    this.defs = this.ids.map((row) => row.map((id) => (id ? (TILES[id] ?? null) : null)));
  }

  get pxW(): number {
    return this.w * TILE;
  }

  get pxH(): number {
    return this.h * TILE;
  }

  tileAt(tx: number, ty: number): TileDef | null {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return null;
    return this.defs[ty]![tx]!;
  }

  solidAt(px: number, py: number): boolean {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    const d = this.defs[ty]![tx];
    return !d || !!d.solid;
  }

  private key(k: string): string {
    const v = `${k}@${this.variant}`;
    return hasSpr(v) ? v : k;
  }

  private artFor(def: TileDef, x: number, y: number): string {
    if (Array.isArray(def.art)) {
      const i = Math.floor(hash2(x, y, 7) * def.art.length);
      return def.art[i]!;
    }
    return def.art;
  }

  /** Pre-renders static layers (call after sprites are built). */
  render(): void {
    this.ground = makeCanvas(this.pxW, this.pxH);
    this.over = makeCanvas(this.pxW, this.pxH);
    const gg = ctx2d(this.ground);
    const go = ctx2d(this.over);
    this.animated = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const def = this.defs[y]![x];
        if (!def) continue;
        const target = def.over ? go : gg;
        if (def.under) {
          const u = TILES[def.under];
          if (u) drawSprite(gg, spr(this.key(this.artFor(u, x, y))), x * TILE + 8, y * TILE + TILE);
        }
        if (def.anim) {
          this.animated.push({ x, y, def });
          continue;
        }
        drawSprite(target, spr(this.key(this.artFor(def, x, y))), x * TILE + 8, y * TILE + TILE);
      }
    }
    this.edges = makeCanvas(this.pxW, this.pxH);
    this.renderEdges(ctx2d(this.edges));
  }

  /** Draws jagged overhangs from tiles with an `edge` onto different neighbours. */
  private renderEdges(g: CanvasRenderingContext2D): void {
    const groupOf = (d: TileDef | null | undefined) => (d?.edge ? (d.edge.group ?? d.art.toString()) : null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = this.defs[y]![x];
        if (!d?.edge || d.over) continue;
        const grp = groupOf(d);
        const dirs: Array<[number, number]> = [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ];
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          const n = this.tileAt(nx, ny);
          if (!n || n.over || groupOf(n) === grp) continue;
          if (n.edge && !n.solid && (n.edge.group ?? '') > (grp ?? '')) continue; // only one side spills
          for (let i = 0; i < TILE; i++) {
            const h = hash2(x * 31 + i, y * 17 + dx * 7 + dy * 3, 11);
            const depth = h < 0.35 ? 1 : h < 0.8 ? 2 : 3;
            for (let k = 0; k < depth; k++) {
              const tip = k === depth - 1;
              g.fillStyle = tip && d.edge.dark ? d.edge.dark : d.edge.color;
              let px: number;
              let py: number;
              if (dy === -1) {
                px = nx * TILE + i;
                py = ny * TILE + TILE - 1 - k;
              } else if (dy === 1) {
                px = nx * TILE + i;
                py = ny * TILE + k;
              } else if (dx === -1) {
                px = nx * TILE + TILE - 1 - k;
                py = ny * TILE + i;
              } else {
                px = nx * TILE + k;
                py = ny * TILE + i;
              }
              g.fillRect(px, py, 1, 1);
            }
          }
        }
      }
    }
  }

  drawAnimated(g: CanvasRenderingContext2D, camX: number, camY: number, frame: number, viewW: number, viewH: number): void {
    for (const a of this.animated) {
      const px = a.x * TILE - camX;
      const py = a.y * TILE - camY;
      if (px < -TILE || py < -TILE || px > viewW || py > viewH) continue;
      const frames = a.def.anim!;
      const speed = a.def.animSpeed ?? 20;
      const i = (Math.floor(frame / speed) + Math.floor(hash2(a.x, a.y, 3) * frames.length)) % frames.length;
      drawSprite(g, spr(this.key(frames[i]!)), px + 8, py + TILE);
    }
  }
}

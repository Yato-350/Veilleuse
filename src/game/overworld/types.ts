import type { Ambience } from '../../engine/audio';
import type { Dir } from '../../engine/math';
import type { Director } from '../director';

export type Script = (d: Director) => Promise<void> | void;
export type Cond = () => boolean;

/** Map material: v1.1 worlds, then the v2 ones (palette.ts V2_WORLDS: felt, ballpoint, white-out, cotton, too-bright). */
export type World = 'dream' | 'real' | 'ink' | 'void' | 'feutre' | 'stylo' | 'blanc' | 'ouate' | 'faux';

export interface TileDef {
  /** Sprite key (or keys for random variation). */
  art: string | string[];
  solid?: boolean;
  /** Tile drawn underneath (e.g. grass under a flower). */
  under?: string;
  /** Drawn above entities. */
  over?: boolean;
  /** Animation frames (sprite keys) — overrides art. */
  anim?: string[];
  animSpeed?: number;
  /** Footstep pitch / surface type. */
  surface?: 'grass' | 'wood' | 'stone' | 'carpet' | 'paper' | 'water';
  /**
   * Organic border: this tile "spills" 1–2 jagged pixels onto neighbouring tiles of another kind
   * (e.g. grass overhanging a path). `color` is the fill, `dark` the tip/shadow pixel.
   * Tiles sharing the same `group` don't spill onto each other.
   */
  edge?: { color: string; dark?: string; group?: string };
}

export interface PropDef {
  id?: string;
  /** Sprite key ('' = invisible interactable, e.g. a door or a wall decoration that is part of the tiles). */
  sprite: string;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  /** Footprint in tiles (collision). Default 1x1. */
  w?: number;
  h?: number;
  /** Pixel offset of the sprite. */
  ox?: number;
  oy?: number;
  solid?: boolean;
  /** Draw above everything (ceiling decorations). */
  over?: boolean;
  /** Draw below entities regardless of y (rugs). */
  under?: boolean;
  /** Inspect text or script. */
  text?: string | string[];
  who?: string;
  script?: Script;
  cond?: Cond;
  /** Light emitted. */
  light?: { r: number; color?: string; flicker?: boolean; dy?: number };
  /** Animation frames. */
  frames?: string[];
  frameSpeed?: number;
  float?: boolean;
}

export interface NpcDef {
  id: string;
  /** Character set id (walking sprites) or static sprite key. */
  char?: string;
  sprite?: string;
  frames?: string[];
  frameSpeed?: number;
  x: number;
  y: number;
  dir?: Dir;
  text?: string | string[];
  who?: string;
  script?: Script;
  cond?: Cond;
  wander?: number;
  float?: boolean;
  solid?: boolean;
  shadow?: boolean;
  light?: { r: number; color?: string; flicker?: boolean; dy?: number };
}

export interface EnemyPlacement {
  /** Unique id in the save (used to remember cleared enemies). */
  id: string;
  /** Encounter: one or more enemy definition ids. */
  enemies: string[];
  x: number;
  y: number;
  wander?: number;
  /** Overworld sprite key (defaults to `ow_<first enemy>`). */
  sprite?: string;
  cond?: Cond;
  /** If true, the enemy doesn't chase. */
  passive?: boolean;
}

export interface TriggerDef {
  id?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  script: Script;
  /** Flag set after running once (if provided, trigger runs only once). */
  once?: string;
  cond?: Cond;
}

export interface WarpDef {
  x: number;
  y: number;
  w?: number;
  h?: number;
  to: string;
  spawn: string;
  /** Require pressing A (doors) instead of walking in. */
  door?: boolean;
  cond?: Cond;
  /** Text shown when the condition fails. */
  locked?: string | string[];
  sfx?: 'door' | 'whoosh' | 'none';
}

export interface SpawnDef {
  x: number;
  y: number;
  dir?: Dir;
}

export interface MapDef {
  id: string;
  name: string;
  world: World;
  music?: string | null;
  ambience?: Ambience;
  /** 0 (lit) .. 1 (pitch black). */
  darkness?: number;
  /** Radius of the light around the player when dark. */
  playerLight?: number;
  bg?: string;
  /** Rows of tile characters. */
  tiles: string;
  legend: Record<string, string>;
  props?: PropDef[];
  npcs?: NpcDef[];
  enemies?: EnemyPlacement[];
  triggers?: TriggerDef[];
  warps?: WarpDef[];
  spawns: Record<string, SpawnDef>;
  onEnter?: Script;
  particles?: 'fireflies' | 'cotton' | 'dust' | 'rain' | 'ink' | 'petals' | 'stars' | 'snow' | 'none';
  /** Show the map name banner on enter. */
  banner?: boolean;
  /** Visual post effects while on this map. */
  vignette?: number;
  grain?: number;
  /** Camera locked (small rooms are centered automatically). */
  noFollower?: boolean;
}

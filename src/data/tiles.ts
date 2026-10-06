import type { TileDef } from '../game/overworld/types';
import { DEV_TILES } from './tiles-dev';

/** Tile registry: id → definition. Art keys refer to sprites in src/data/sprites/tiles.ts. */
export const TILES: Record<string, TileDef> = {
  ...DEV_TILES,
};

import type { TileDef } from '../game/overworld/types';

export const DEV_TILES: Record<string, TileDef> = {
  dev_floor: { art: 'dev_floor' },
  dev_wall: { art: 'dev_wall', solid: true },
};

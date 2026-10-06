import type { EnemyDef } from '../game/battle/types';
import { DEV_ENEMIES } from './enemies-dev';

/** Enemy registry. See docs/CONTENT_CONTRACT.md. */
export const ENEMIES: Record<string, EnemyDef> = {
  ...DEV_ENEMIES,
};

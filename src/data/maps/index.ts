import type { MapDef } from '../../game/overworld/types';
import { TEST } from './test';
import { REAL_MAPS } from './real';
import { CHAPTER1_MAPS } from './chapter1';
import { CHAPTER2_MAPS } from './chapter2';
import { CHAPTER3_MAPS } from './chapter3';
import { SHOWCASE_TILES_MAPS } from './showcase_tiles';
import { SHOWCASE_PROPS_MAPS } from './showcase_props';

/** Map registry. */
export const MAPS: Record<string, MapDef> = {
  test: TEST,
  ...REAL_MAPS,
  ...CHAPTER1_MAPS,
  ...CHAPTER2_MAPS,
  ...CHAPTER3_MAPS,
  ...SHOWCASE_TILES_MAPS,
  ...SHOWCASE_PROPS_MAPS,
};

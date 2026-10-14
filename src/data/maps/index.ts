import type { MapDef } from '../../game/overworld/types';
import { TEST } from './test';
import { REAL_MAPS } from './real';
import { EPILOGUE_MAPS } from './epilogue';
import { CHAPTER1_MAPS } from './chapter1';
import { CHAPTER2_MAPS } from './chapter2';
import { CHAPTER3_MAPS } from './chapter3';
import { FAUSSE_AUBE_MAPS } from './fausse-aube';
import { CHAPTER4_MAPS } from './chapter4';
import { CHAPTER5_MAPS } from './chapter5';
import { CHAPTER6_MAPS } from './chapter6';
import { BONUS_MAPS } from './bonus';
import { SHOWCASE_TILES_MAPS } from './showcase_tiles';
import { SHOWCASE_PROPS_MAPS } from './showcase_props';

/** Map registry. */
export const MAPS: Record<string, MapDef> = {
  test: TEST,
  ...REAL_MAPS,
  ...EPILOGUE_MAPS,
  ...CHAPTER1_MAPS,
  ...CHAPTER2_MAPS,
  ...CHAPTER3_MAPS,
  ...FAUSSE_AUBE_MAPS,
  ...CHAPTER4_MAPS,
  ...CHAPTER5_MAPS,
  ...CHAPTER6_MAPS,
  ...BONUS_MAPS,
  ...SHOWCASE_TILES_MAPS,
  ...SHOWCASE_PROPS_MAPS,
};

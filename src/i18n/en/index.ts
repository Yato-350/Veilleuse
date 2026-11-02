/**
 * English catalog: French source text → English, merged from one file per source area.
 * Add a new area file here (and its source files to src/i18n/manifest.json). See docs/I18N.md.
 */
import { UI } from './ui';
import { BATTLE } from './battle';
import { DATA } from './data';
import { DATA_CH4 } from './data-ch4';
import { DATA_CH5 } from './data-ch5';
import { DATA_CH6 } from './data-ch6';
import { MAPS } from './maps';
import { STORY_REAL } from './story-real';
import { STORY_EPILOGUE } from './story-epilogue';
import { STORY_CHAPTER1 } from './story-chapter1';
import { STORY_CHAPTER2 } from './story-chapter2';
import { STORY_CHAPTER3 } from './story-chapter3';
import { STORY_BONUS } from './story-bonus';
import { STORY_COMMON } from './story-common';
import { STORY_CHAPTER4 } from './story-chapter4';
import { STORY_CHAPTER5 } from './story-chapter5';
import { STORY_CHAPTER6 } from './story-chapter6';
import { STORY_REAL_NUIT } from './story-real-nuit';
import { STORY_FAUSSE_AUBE } from './story-fausse-aube';
import { STORY_ENDINGS } from './story-endings';

export const CATALOG_PARTS: Record<string, Record<string, string>> = {
  ui: UI,
  battle: BATTLE,
  data: DATA,
  'data-ch4': DATA_CH4,
  'data-ch5': DATA_CH5,
  'data-ch6': DATA_CH6,
  maps: MAPS,
  'story-real': STORY_REAL,
  'story-epilogue': STORY_EPILOGUE,
  'story-chapter1': STORY_CHAPTER1,
  'story-chapter2': STORY_CHAPTER2,
  'story-chapter3': STORY_CHAPTER3,
  'story-bonus': STORY_BONUS,
  'story-common': STORY_COMMON,
  'story-chapter4': STORY_CHAPTER4,
  'story-chapter5': STORY_CHAPTER5,
  'story-chapter6': STORY_CHAPTER6,
  'story-real-nuit': STORY_REAL_NUIT,
  'story-fausse-aube': STORY_FAUSSE_AUBE,
  'story-endings': STORY_ENDINGS,
};

export const EN: Record<string, string> = Object.assign({}, ...Object.values(CATALOG_PARTS));

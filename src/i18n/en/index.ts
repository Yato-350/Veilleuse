/**
 * English catalog: French source text → English, merged from one file per source area.
 * Add a new area file here (and its source files to src/i18n/manifest.json). See docs/I18N.md.
 */
import { UI } from './ui';
import { BATTLE } from './battle';
import { DATA } from './data';
import { MAPS } from './maps';
import { STORY_REAL } from './story-real';
import { STORY_EPILOGUE } from './story-epilogue';
import { STORY_CHAPTER1 } from './story-chapter1';
import { STORY_CHAPTER2 } from './story-chapter2';
import { STORY_CHAPTER3 } from './story-chapter3';
import { STORY_BONUS } from './story-bonus';
import { STORY_COMMON } from './story-common';

export const CATALOG_PARTS: Record<string, Record<string, string>> = {
  ui: UI,
  battle: BATTLE,
  data: DATA,
  maps: MAPS,
  'story-real': STORY_REAL,
  'story-epilogue': STORY_EPILOGUE,
  'story-chapter1': STORY_CHAPTER1,
  'story-chapter2': STORY_CHAPTER2,
  'story-chapter3': STORY_CHAPTER3,
  'story-bonus': STORY_BONUS,
  'story-common': STORY_COMMON,
};

export const EN: Record<string, string> = Object.assign({}, ...Object.values(CATALOG_PARTS));

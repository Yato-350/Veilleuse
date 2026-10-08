/**
 * English catalog: French source text → English, merged from one file per source area.
 * Add a new area file here (and its source files to src/i18n/manifest.json). See docs/I18N.md.
 */
import { UI } from './ui';
import { BATTLE } from './battle';
import { DATA } from './data';
import { MAPS } from './maps';

export const CATALOG_PARTS: Record<string, Record<string, string>> = {
  ui: UI,
  battle: BATTLE,
  data: DATA,
  maps: MAPS,
};

export const EN: Record<string, string> = Object.assign({}, ...Object.values(CATALOG_PARTS));

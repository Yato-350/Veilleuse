import { loadJSON, saveJSON, storage } from '../engine/storage';
import type { Dir } from '../engine/math';
import type { Emotion } from '../engine/palette';

export const SAVE_VERSION = 1;

export interface GameState {
  version: number;
  playerName: string;
  chapter: number;
  map: string;
  x: number;
  y: number;
  dir: Dir;
  hp: number;
  etoiles: number;
  encre: number;
  boutons: number;
  items: string[];
  keyItems: string[];
  souvenirs: string[];
  flags: Record<string, number | boolean | string>;
  kills: Record<string, number>;
  spares: Record<string, number>;
  /** Overworld enemies already resolved (by placement id). */
  cleared: string[];
  party: string[];
  playtime: number;
  savedAt: number;
  weapon: string;
  armor: string;
}

export function newState(playerName = ''): GameState {
  return {
    version: SAVE_VERSION,
    playerName,
    chapter: 0,
    map: 'chambre',
    x: 0,
    y: 0,
    dir: 'down',
    hp: 20,
    etoiles: 0,
    encre: 0,
    boutons: 0,
    items: [],
    keyItems: [],
    souvenirs: [],
    flags: {},
    kills: {},
    spares: {},
    cleared: [],
    party: [],
    playtime: 0,
    savedAt: 0,
    weapon: 'crayon',
    armor: 'pyjama',
  };
}

export const MAX_ITEMS = 8;

/** Stats derived from progression. Étoiles (sparing) raise max HP, Encre (defeating) raises attack. */
export function maxHp(s: GameState): number {
  return 20 + Math.floor(s.etoiles / 4) * 4;
}

export function level(s: GameState): number {
  return 1 + Math.floor(s.etoiles / 4) + Math.floor(s.encre / 3);
}

export const WEAPONS: Record<string, { name: string; atk: number; desc: string }> = {
  crayon: { name: 'Crayon gris', atk: 0, desc: 'Un crayon à papier mâchouillé.' },
  cire: { name: 'Crayon de cire', atk: 3, desc: 'Le rouge préféré de Mina.' },
  plume: { name: 'Plume dorée', atk: 6, desc: 'Elle écrit toute seule, parfois.' },
};

export const ARMORS: Record<string, { name: string; def: number; desc: string }> = {
  pyjama: { name: 'Pyjama étoilé', def: 0, desc: 'Un peu trop petit maintenant.' },
  plaid: { name: 'Plaid tout doux', def: 2, desc: 'Ça sent la lessive de Maman.' },
  cape: { name: 'Cape de Mina', def: 5, desc: 'Rouge, avec une étoile cousue main.' },
};

export function attack(s: GameState): number {
  return 4 + Math.floor(s.encre / 3) * 2 + (WEAPONS[s.weapon]?.atk ?? 0);
}

export function defense(s: GameState): number {
  return 1 + Math.floor(s.etoiles / 8) + (ARMORS[s.armor]?.def ?? 0);
}

export function totalKills(s: GameState): number {
  return Object.values(s.kills).reduce((a, b) => a + b, 0);
}

export function totalSpares(s: GameState): number {
  return Object.values(s.spares).reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Persistent "meta" memory (survives new games — the game remembers).
// ---------------------------------------------------------------------------

export interface Meta {
  launches: number;
  newGames: number;
  deaths: number;
  endings: string[];
  firstPlay: number;
  lastPlay: number;
  names: string[];
  warningSeen: boolean;
  /** Set while a run is in progress, to detect "reset" (new game over an unfinished run). */
  runInProgress: boolean;
  resets: number;
  tabLeaves: number;
  /** Illustration ids seen at least once, in any run (souvenirs, carnet pages, endings…): the title-screen gallery. */
  seen: string[];
  /** Poems written for Mina in the finale, newest last (kept after the run ends). */
  poems: SavedPoem[];
  /** Bonus chapter « Les rêves des autres » completed at least once. */
  bonusDone: boolean;
}

export interface SavedPoem {
  title: string;
  /** The poem as displayed (lines joined with \n). */
  text: string;
  words: string[];
  at: number;
}

export function newMeta(): Meta {
  return {
    launches: 0,
    newGames: 0,
    deaths: 0,
    endings: [],
    firstPlay: Date.now(),
    lastPlay: Date.now(),
    names: [],
    warningSeen: false,
    runInProgress: false,
    resets: 0,
    tabLeaves: 0,
    seen: [],
    poems: [],
    bonusDone: false,
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  music: number;
  sfx: number;
  textSpeed: 0 | 1 | 2 | 3;
  shake: boolean;
  reduceFlashes: boolean;
  crt: boolean;
  storyMode: boolean;
  touch: 'auto' | 'on' | 'off';
  touchOpacity: number;
  touchSize: number;
  vibration: boolean;
  showFps: boolean;
  /** Accessibility: draw a shape per emotion (drop, star, spikes…) on the soul and on bullets, not only a color. */
  emotionShapes: boolean;
  /** Text language. */
  language: 'fr' | 'en';
}

export function defaultSettings(): Settings {
  return {
    music: 0.7,
    sfx: 0.8,
    textSpeed: 1,
    shake: true,
    reduceFlashes: false,
    crt: false,
    storyMode: false,
    touch: 'auto',
    touchOpacity: 0.55,
    touchSize: 1,
    vibration: true,
    showFps: false,
    emotionShapes: false,
    language: typeof navigator !== 'undefined' && !/^fr\b/i.test(navigator.language ?? 'fr') ? 'en' : 'fr',
  };
}

/** Chars per frame for each text speed setting. */
export const TEXT_SPEEDS = [0.35, 0.7, 1.4, 99];
export const TEXT_SPEED_LABELS = ['Lente', 'Normale', 'Rapide', 'Instantanée'];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const SAVE_KEY = 'save.v1';
const META_KEY = 'meta.v1';
const SETTINGS_KEY = 'settings.v1';

export function hasSave(): boolean {
  return storage.get(SAVE_KEY) !== null;
}

export function readSave(): GameState | null {
  const s = loadJSON<GameState | null>(SAVE_KEY, null);
  if (!s || typeof s !== 'object') return null;
  // Forward-compatible: fill missing fields with defaults.
  return { ...newState(s.playerName ?? ''), ...s };
}

export function writeSave(s: GameState): void {
  s.savedAt = Date.now();
  saveJSON(SAVE_KEY, s);
}

export function deleteSave(): void {
  storage.remove(SAVE_KEY);
}

export function readMeta(): Meta {
  return { ...newMeta(), ...loadJSON<Partial<Meta>>(META_KEY, {}) };
}

export function writeMeta(m: Meta): void {
  saveJSON(META_KEY, m);
}

export function readSettings(): Settings {
  return { ...defaultSettings(), ...loadJSON<Partial<Settings>>(SETTINGS_KEY, {}) };
}

export function writeSettings(s: Settings): void {
  saveJSON(SETTINGS_KEY, s);
}

// ---------------------------------------------------------------------------
// Runtime singleton
// ---------------------------------------------------------------------------

export const G = {
  state: newState(),
  meta: newMeta(),
  settings: defaultSettings(),
  /** Soul emotion carried between turns of a battle (reset each battle). */
  emotion: 'neutre' as Emotion,
};

export function flag(name: string): number | boolean | string | undefined {
  return G.state.flags[name];
}

export function setFlag(name: string, value: number | boolean | string = true): void {
  G.state.flags[name] = value;
}

export function hasItem(id: string): boolean {
  return G.state.items.includes(id) || G.state.keyItems.includes(id);
}

export function formatPlaytime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

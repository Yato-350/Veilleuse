import { loadJSON, saveJSON, storage } from '../engine/storage';
import type { Dir } from '../engine/math';
import type { Emotion } from '../engine/palette';

/** Save format version. 1 = v1.1 (finale stored as interlude 3), 2 = v2 (finale = interlude 9). */
export const SAVE_VERSION = 2;
/** Version of the persistent meta memory. 1 = v1.1, 2 = v2 (nights, endingsV1…). */
export const META_VERSION = 2;

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
  /** Walking character the player controls ('noa'; 'maman' in the bonus chapter). */
  playerChar: string;
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
    playerChar: 'noa',
  };
}

export const MAX_ITEMS = 8;

/** Stats derived from progression. Étoiles (sparing) raise max HP, Encre (defeating) raises attack. */
export function maxHp(s: GameState): number {
  // Chapter 4: « Coton chaud », the cotton taken from the felt sheep for Dodo, until the end of that night.
  return 20 + Math.floor(s.etoiles / 4) * 4 + Number(s.flags.c4_coton_chaud ?? 0);
}

export function level(s: GameState): number {
  return 1 + Math.floor(s.etoiles / 4) + Math.floor(s.encre / 3);
}

export const WEAPONS: Record<string, { name: string; atk: number; desc: string }> = {
  crayon: { name: 'Crayon gris', atk: 0, desc: 'Un crayon à papier mâchouillé.' },
  cire: { name: 'Crayon de cire', atk: 3, desc: 'Le rouge préféré de Mina.' },
  plume: { name: 'Plume dorée', atk: 6, desc: 'Elle écrit toute seule, parfois.' },
  // Bonus chapter (Maman).
  stylo: { name: 'Stylo quatre couleurs', atk: 2, desc: 'Celui du service. Le vert ne marche plus.' },
};

export const ARMORS: Record<string, { name: string; def: number; desc: string }> = {
  pyjama: { name: 'Pyjama étoilé', def: 0, desc: 'Un peu trop petit maintenant.' },
  plaid: { name: 'Plaid tout doux', def: 2, desc: 'Ça sent la lessive de Maman.' },
  cape: { name: 'Cape de Mina', def: 5, desc: 'Rouge, avec une étoile cousue main.' },
  // Bonus chapter (Maman).
  gilet: { name: 'Gilet de laine', def: 2, desc: 'Mina l\'appelait « le gilet-câlin ».' },
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
  // --- v2 « Il fait toujours nuit » (docs/HISTOIRE.md §5, « Méta et nouvelle partie+ ») ---
  /** Nights Noa has dreamt the Pays de Coton: 365 on a first run, +1 per ending (Beaux rêves included). */
  nuits: number;
  /** What the player answered to « Laquelle est vraie ? » in the corridor of 41 doors (null = never asked). */
  callVersion: CallAnswer | null;
  /** After the secret ending, Dodo never speaks again, in any run. */
  dodoSilent: boolean;
  /** Times the fake credits (« fausse aube ») were reached; 0 = never. */
  fauxGenerique: number;
  /** When the Beaux rêves ending was last reached (ms timestamp, 0 = never): its title screen counts the real days. */
  beauxRevesAt: number;
  /** Endings seen with version 1.1 of the game (copied by the migration): the fake credits remember them. */
  endingsV1: string[];
  /** Format version of this memory (see META_VERSION). */
  metaVersion: number;
}

/** The three answers to « Laquelle est vraie ? » (the player's choice: the game never says which one is right). */
export type CallAnswer = 'douce' | 'dure' | 'sais_pas';

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
    nuits: 365,
    callVersion: null,
    dodoSilent: false,
    fauxGenerique: 0,
    beauxRevesAt: 0,
    endingsV1: [],
    metaVersion: META_VERSION,
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
  return migrateSave(s);
}

/**
 * Brings a save of any older version up to SAVE_VERSION. Missing fields get their defaults (forward-compatible).
 * v1 → v2: a v1.1 run in chapters 1–3 or interludes I–II resumes as is; the v1.1 finale (interlude 3) is now 9.
 */
export function migrateSave(raw: Partial<GameState>): GameState {
  const s: GameState = { ...newState(raw.playerName ?? ''), ...raw, flags: { ...(raw.flags ?? {}) } };
  const from = typeof raw.version === 'number' ? raw.version : 1;
  if (from < 2) {
    if (Number(s.flags.interlude ?? 0) === 3) s.flags.interlude = 9;
  }
  s.version = SAVE_VERSION;
  return s;
}

export function writeSave(s: GameState): void {
  s.savedAt = Date.now();
  saveJSON(SAVE_KEY, s);
}

export function deleteSave(): void {
  storage.remove(SAVE_KEY);
}

export function readMeta(): Meta {
  return migrateMeta(loadJSON<Partial<Meta>>(META_KEY, {}));
}

/**
 * Brings the persistent memory up to META_VERSION. A memory without `metaVersion` comes from v1.1 (or is new):
 * its endings are copied to `endingsV1`, and every ending already seen counts as one more night.
 */
export function migrateMeta(raw: Partial<Meta>): Meta {
  const m: Meta = { ...newMeta(), ...raw };
  const from = typeof raw.metaVersion === 'number' ? raw.metaVersion : 1;
  if (from < 2) {
    const v1 = Array.isArray(raw.endings) ? [...new Set(raw.endings)] : [];
    m.endingsV1 = v1;
    m.nuits = 365 + v1.length;
  }
  m.metaVersion = META_VERSION;
  return m;
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

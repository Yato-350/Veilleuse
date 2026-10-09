import type { Channel, Track } from '../engine/audio';

/**
 * Procedural soundtrack of VEILLEUSE.
 *
 * Every piece is built around the leitmotif « La Berceuse de la Veilleuse » (C major, 3/4, eighth notes,
 * 6 steps per bar). Small helpers below turn chord symbols and note lists into tracker patterns
 * (see src/engine/audio.ts): one token per step, `-` holds, `.` rests, `+` stacks a chord, `x` hits a drum.
 */

// ---------------------------------------------------------------------------
// Note helpers
// ---------------------------------------------------------------------------

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function toMidi(n: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3]!, 10) + 1) * 12;
}

function toName(m: number): string {
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Maps every note of a pattern (chords included) through `f`. */
function mapNotes(pattern: string, f: (m: number) => number): string {
  return pattern
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => (/^[A-G]/.test(tok) ? tok.split('+').map((n) => toName(f(toMidi(n)))).join('+') : tok))
    .join(' ');
}

const transpose = (p: string, semis: number): string => (semis ? mapNotes(p, (m) => m + semis) : p);

/** Turns a C-major line into C natural minor (E→Eb, A→Ab, B→Bb). */
const toMinor = (p: string): string => mapNotes(p, (m) => ([4, 9, 11].includes(((m % 12) + 12) % 12) ? m - 1 : m));

/** Harmonic minor: like toMinor but keeps the leading tone (B natural). */
const toHarmonicMinor = (p: string): string => mapNotes(p, (m) => ([4, 9].includes(((m % 12) + 12) % 12) ? m - 1 : m));

const join = (...parts: string[]): string => parts.join(' | ');
const rep = (p: string, n: number): string => Array.from({ length: n }, () => p).join(' | ');
const rest = (steps: number): string => Array.from({ length: steps }, () => '.').join(' ');
const hold = (note: string, steps: number): string => [note, ...Array.from({ length: steps - 1 }, () => '-')].join(' ');

// ---------------------------------------------------------------------------
// Chords
// ---------------------------------------------------------------------------

const CHORD_TONES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  dim: [0, 3, 6],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  add9: [0, 4, 7, 14],
  m9: [0, 3, 7, 10, 14],
};

/** Parses "Am", "G7", "Fmaj7", "C#m", "Bb" into [root pitch class, intervals]. */
function chord(sym: string): [number, number[]] {
  const m = /^([A-G])([#b]?)(.*)$/.exec(sym);
  if (!m) throw new Error(`bad chord ${sym}`);
  const root = PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const tones = CHORD_TONES[m[3]!];
  if (!tones) throw new Error(`bad chord quality ${sym}`);
  return [(root + 12) % 12, tones];
}

/** Chord tones as midi numbers, root placed in `octave`. */
function voicing(sym: string, octave: number): number[] {
  const [root, tones] = chord(sym);
  const base = root + (octave + 1) * 12;
  return tones.map((t) => base + t);
}

/** Sustained chords: one chord per `steps` steps. */
function padLine(chords: string[], octave: number, steps: number): string {
  return chords.map((c) => hold(voicing(c, octave).map(toName).join('+'), steps)).join(' | ');
}

/**
 * Generic per-chord figure. Figure tokens: R (root), 3, 5, 7 (chord tones by index 0..3), 8 (root an octave up),
 * L (root an octave down), '-' hold, '.' rest, 'C' (whole chord stacked).
 */
function figure(chords: string[], octave: number, fig: string): string {
  const toks = fig.split(/\s+/).filter(Boolean);
  return chords
    .map((c) => {
      const v = voicing(c, octave);
      return toks
        .map((t) => {
          switch (t) {
            case 'R':
              return toName(v[0]!);
            case '3':
              return toName(v[1]!);
            case '5':
              return toName(v[2]!);
            case '7':
              return toName(v[3] ?? v[0]! + 12);
            case '8':
              return toName(v[0]! + 12);
            case '10':
              return toName(v[1]! + 12);
            case 'L':
              return toName(v[0]! - 12);
            case 'C':
              return v.map(toName).join('+');
            default:
              return t;
          }
        })
        .join(' ');
    })
    .join(' | ');
}

/** Drum line from a one-bar pattern of x / X / . repeated `bars` times. */
const drums = (bar: string, bars: number): string => rep(bar, bars);

// ---------------------------------------------------------------------------
// The leitmotif (C major, 3/4, 6 eighth-note steps per bar)
// ---------------------------------------------------------------------------

const LULLABY_A = [
  'E5 - - D5 C5 -',
  'D5 - - E5 G5 -',
  'A5 - G5 E5 - -',
  'D5 - - - - -',
  'E5 - - D5 C5 -',
  'D5 - - E5 C5 -',
  'B4 - C5 D5 - G4',
  'C5 - - - - -',
].join(' | ');

const LULLABY_B = [
  'A5 - - G5 E5 -',
  'F5 - - E5 D5 -',
  'G5 - - F5 D5 -',
  'E5 - - - - -',
  'A5 - - G5 E5 -',
  'F5 - E5 D5 - C5',
  'D5 - - G4 B4 D5',
  'C5 - - - - -',
].join(' | ');

const LULLABY = join(LULLABY_A, LULLABY_B);
/** The leitmotif's melody as a tracker pattern (the music-box teeth of chapter 6 play it note by note). */
export const LULLABY_PATTERN = LULLABY;
const CH_A = ['C', 'G', 'Am', 'G', 'C', 'G', 'G7', 'C'];
const CH_B = ['F', 'Dm', 'G7', 'C', 'F', 'Dm', 'G7', 'C'];
const CH_LULLABY = [...CH_A, ...CH_B];
/** Night shift / Le Réveil (bonus chapter): A minor. */
const GARDE_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'];

/** Same melody in 4/4 (8 eighth-note steps per bar): each 3/4 bar stretched with a dotted feel. */
const LULLABY_44_A = [
  'E5 - - D5 C5 - - -',
  'D5 - - E5 G5 - - -',
  'A5 - G5 - E5 - - -',
  'D5 - - - - - . .',
  'E5 - - D5 C5 - - -',
  'D5 - - E5 C5 - - -',
  'B4 - C5 - D5 - G4 -',
  'C5 - - - - - . .',
].join(' | ');

const LULLABY_44_B = [
  'A5 - - G5 E5 - - -',
  'F5 - - E5 D5 - - -',
  'G5 - - F5 D5 - - -',
  'E5 - - - - - . .',
  'A5 - - G5 E5 - - -',
  'F5 - E5 - D5 - C5 -',
  'D5 - - G4 B4 - D5 -',
  'C5 - - - - - . .',
].join(' | ');

const ch = (inst: Channel['inst'], pattern: string, o: Omit<Channel, 'inst' | 'pattern'> = {}): Channel => ({ inst, pattern, ...o });

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export const TRACKS: Record<string, Track> = {
  /** Title — the lullaby on a music box, warm pad, low heartbeat bass. 16 bars of 3/4, A then B. */
  title: {
    bpm: 66,
    stepsPerBeat: 2,
    vol: 0.85,
    channels: [
      ch('musicbox', LULLABY, { vol: 0.75, reverb: 0.55 }),
      ch('pad', padLine(CH_LULLABY, 3, 6), { vol: 0.32, reverb: 0.6 }),
      ch('triangle', figure(CH_LULLABY, 2, 'R - - - - .'), { vol: 0.35 }),
      ch('bell', rep(join('C6 - - - - -', rest(6), rest(6), rest(6)), 4), { vol: 0.12, reverb: 0.8 }),
    ],
  },

  /** Noa's room at night — slow piano arpeggios in A minor, lullaby fragments falling apart. 16 bars 3/4. */
  room: {
    bpm: 60,
    stepsPerBeat: 2,
    vol: 0.8,
    channels: [
      ch('piano', figure(['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'Am', 'F', 'C', 'G', 'F', 'Dm', 'E', 'Am'], 3, 'R 5 8 10 8 5'), {
        vol: 0.4,
        reverb: 0.5,
      }),
      ch(
        'piano',
        join(
          rest(6),
          rest(6),
          'E5 - - D5 C5 -',
          'D5 - - - - -',
          rest(6),
          rest(6),
          'C5 - - B4 A4 -',
          'G#4 - - - - -',
          rest(6),
          'A5 - - G5 E5 -',
          'F5 - - E5 D5 -',
          'D5 - - - - -',
          rest(6),
          'C5 - - B4 A4 -',
          'B4 - - G#4 - -',
          'A4 - - - - -',
        ),
        { vol: 0.32, reverb: 0.6 },
      ),
      ch('pad', padLine(['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E', 'Am', 'F', 'C', 'G', 'F', 'Dm', 'E', 'Am'], 2, 6), { vol: 0.16, reverb: 0.5 }),
    ],
  },

  /** Almost silence (name entry): a handful of music-box notes very far apart. 16 bars 3/4. */
  room_quiet: {
    bpm: 50,
    stepsPerBeat: 2,
    vol: 0.7,
    channels: [
      ch(
        'musicbox',
        join(
          'E5 - - - - -',
          rest(6),
          'D5 - - - - -',
          rest(6),
          'C5 - - - - -',
          rest(6),
          rest(6),
          rest(6),
          'A4 - - - - -',
          rest(6),
          'G4 - - - - -',
          rest(6),
          'C5 - - - - -',
          rest(6),
          rest(6),
          rest(6),
        ),
        { vol: 0.5, reverb: 0.8 },
      ),
      ch('pad', padLine(['C', 'C', 'G', 'G', 'Am', 'Am', 'G', 'G', 'F', 'F', 'C', 'C', 'Am', 'Am', 'G', 'G'], 3, 6), { vol: 0.12, reverb: 0.7 }),
    ],
  },

  /** Grey daytime apartment — 4/4, piano and pad in A minor, the lullaby slowed into minor. 16 bars. */
  interlude: {
    bpm: 72,
    stepsPerBeat: 2,
    vol: 0.8,
    channels: [
      ch('piano', figure(['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'F', 'E', 'Dm', 'Am', 'E', 'Am'], 3, 'R 5 8 5 10 5 8 5'), {
        vol: 0.32,
        reverb: 0.45,
      }),
      ch('piano', transpose(toHarmonicMinor(LULLABY_44_A), -3) + ' | ' + transpose(toHarmonicMinor(LULLABY_44_A), -3), { vol: 0.34, reverb: 0.55 }),
      ch('pad', padLine(['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'F', 'E', 'Dm', 'Am', 'E', 'Am'], 3, 8), { vol: 0.15, reverb: 0.6 }),
      ch('bass', figure(['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'F', 'E', 'Dm', 'Am', 'E', 'Am'], 2, 'R - - - 5 - - -'), { vol: 0.3 }),
    ],
  },

  /** Meadow — a lilting chiptune waltz on the lullaby, bouncy bass, plucked chords. 32 bars 3/4 (A B, A' B'). */
  meadow: {
    bpm: 112,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch('pulse25', join(LULLABY, transpose(LULLABY, 12)), { vol: 0.42 }),
      ch('pluck', rep(figure(CH_LULLABY, 4, '. . C . C .'), 2), { vol: 0.2 }),
      ch('bass', rep(figure(CH_LULLABY, 2, 'R - 5 - 5 -'), 2), { vol: 0.45 }),
      ch('triangle', join(rep(rest(6), 16), rep(join('G5 - - E5 - -', 'B5 - - G5 - -', 'C6 - - A5 - -', 'B5 - - - - -'), 4)), {
        vol: 0.2,
      }),
      ch('kick', drums('x . . . . .', 32), { vol: 0.35 }),
      ch('hat', drums('. . x . x .', 32), { vol: 0.25 }),
    ],
  },

  /** Village — cosy F major, pizzicato chords and a bell melody in 4/4. 16 bars. */
  village: {
    bpm: 92,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch(
        'bell',
        join(
          'A5 - G5 - F5 - C5 -',
          'D5 - - - C5 - - -',
          'A5 - G5 - F5 - A5 -',
          'G5 - - - - - . .',
          'Bb5 - A5 - G5 - F5 -',
          'G5 - - - E5 - C5 -',
          'F5 - G5 - A5 - C6 -',
          'A5 - - - - - . .',
          'A5 - G5 - F5 - C5 -',
          'D5 - - - C5 - - -',
          'D5 - E5 - F5 - A5 -',
          'G5 - - - - - . .',
          'Bb5 - A5 - G5 - F5 -',
          'E5 - - - G5 - C5 -',
          'E5 - - - G5 - E5 -',
          'F5 - - - - - . .',
        ),
        { vol: 0.28, reverb: 0.4 },
      ),
      ch('pluck', figure(['F', 'Bb', 'F', 'C', 'Gm7', 'C7', 'F', 'F', 'F', 'Bb', 'Dm', 'C', 'Gm7', 'C7', 'C7', 'F'].map(fixFlat), 4, 'R 5 3 5 R 5 3 5'), {
        vol: 0.22,
      }),
      ch('bass', figure(['F', 'Bb', 'F', 'C', 'Gm7', 'C7', 'F', 'F', 'F', 'Bb', 'Dm', 'C', 'Gm7', 'C7', 'C7', 'F'].map(fixFlat), 2, 'R - . . 5 - . .'), {
        vol: 0.4,
      }),
      ch('hat', drums('. . x . . . x .', 16), { vol: 0.12 }),
    ],
  },

  /** Chaussette's shop — bouncy G major with a cheeky square lead, 16th steps. 8 bars. */
  shop: {
    bpm: 118,
    stepsPerBeat: 4,
    vol: 0.7,
    channels: [
      ch(
        'square',
        join(
          'G5 - . B5 D6 - . B5 C6 - A5 - G5 - . .',
          'E5 - . G5 A5 - G5 - E5 - D5 - . . . .',
          'C5 - . E5 G5 - . E5 F#5 - A5 - D6 - . .',
          'C6 - B5 - A5 - F#5 - G5 - - - . . . .',
          'G5 - . B5 D6 - . B5 C6 - A5 - G5 - . .',
          'E5 - . G5 A5 - G5 - E5 - D5 - . . . .',
          'C5 - E5 - A5 - G5 - F#5 - A5 - C6 - B5 -',
          'G5 - - - D5 - - - G5 - - - . . . .',
        ),
        { vol: 0.28 },
      ),
      ch('pluck', figure(['G', 'Em', 'C', 'D7', 'G', 'Em', 'Am', 'D7'], 4, '. . C . . . C . . . C . . . C .'), { vol: 0.18 }),
      ch('bass', figure(['G', 'Em', 'C', 'D7', 'G', 'Em', 'Am', 'D7'], 2, 'R - . . 5 - . . R - . . 5 - 3 -'), { vol: 0.42 }),
      ch('kick', drums('x . . . . . . . x . . . . . . .', 8), { vol: 0.35 }),
      ch('snare', drums('. . . . x . . . . . . . x . . .', 8), { vol: 0.25 }),
      ch('hat', drums('x . x . x . x . x . x . x . x .', 8), { vol: 0.12 }),
    ],
  },

  /** Mina's theme — playful, bright D major, the lullaby in a skipping 4/4. 16 bars. */
  mina: {
    bpm: 126,
    stepsPerBeat: 2,
    vol: 0.72,
    channels: [
      ch('pulse12', transpose(join(LULLABY_44_A, LULLABY_44_B), 2), { vol: 0.3 }),
      ch('pluck', figure(['D', 'A', 'Bm', 'A', 'D', 'A', 'A7', 'D', 'G', 'Em', 'A7', 'D', 'G', 'Em', 'A7', 'D'], 4, 'R 3 5 3 8 5 3 5'), { vol: 0.16 }),
      ch('bass', figure(['D', 'A', 'Bm', 'A', 'D', 'A', 'A7', 'D', 'G', 'Em', 'A7', 'D', 'G', 'Em', 'A7', 'D'], 2, 'R - 5 - 8 - 5 -'), { vol: 0.38 }),
      ch('kick', drums('x . . . x . . .', 16), { vol: 0.28 }),
      ch('hat', drums('. . x . . . x x', 16), { vol: 0.14 }),
    ],
  },

  /** Battle — driving A minor, 16th steps, square lead quoting the lullaby in minor. 16 bars. */
  battle: {
    bpm: 140,
    stepsPerBeat: 4,
    vol: 0.7,
    channels: [
      ch(
        'square',
        join(
          'E5 - - - D5 - C5 - D5 - - - E5 - G5 -',
          'A5 - - - G5 - E5 - D5 - - - . . . .',
          'E5 - - - D5 - C5 - D5 - - - E5 - C5 -',
          'B4 - C5 - D5 - G4 - A4 - - - . . . .',
          'A5 - - - G5 - E5 - F5 - - - E5 - D5 -',
          'G5 - - - F5 - D5 - E5 - - - . . E5 F5',
          'G5 - A5 - B5 - C6 - B5 - A5 - G#5 - E5 -',
          'A5 - - - - - - - . . . . A4 B4 C5 D5',
          'E5 - - - D5 - C5 - D5 - - - E5 - G5 -',
          'A5 - - - G5 - E5 - D5 - - - . . . .',
          'C6 - - - B5 - A5 - B5 - - - C6 - D6 -',
          'E6 - - - D6 - C6 - B5 - - - . . . .',
          'A5 - - - G5 - E5 - F5 - - - E5 - D5 -',
          'G5 - - - F5 - D5 - E5 - - - . . E5 F5',
          'G#5 - - - B5 - - - E6 - - - D6 - B5 -',
          'A5 - - - - - - - . . . . . . . .',
        ),
        { vol: 0.3 },
      ),
      ch('pulse12', figure(['Am', 'Am', 'Am', 'E', 'F', 'Dm', 'E', 'Am', 'Am', 'Am', 'Am', 'E', 'F', 'Dm', 'E', 'Am'], 4, 'R 3 5 8 R 3 5 8 R 3 5 8 R 3 5 8'), {
        vol: 0.12,
      }),
      ch('bass', figure(['Am', 'Am', 'Am', 'E', 'F', 'Dm', 'E', 'Am', 'Am', 'Am', 'Am', 'E', 'F', 'Dm', 'E', 'Am'], 2, 'R - 8 - R - 8 - R - 8 - 5 - 8 -'), {
        vol: 0.45,
      }),
      ch('kick', drums('x . . . . . . . x . x . . . . .', 16), { vol: 0.4 }),
      ch('snare', drums('. . . . x . . . . . . . x . . x', 16), { vol: 0.28 }),
      ch('hat', drums('x . x . x . x . x . x . x . x .', 16), { vol: 0.12 }),
    ],
  },

  /** Boss — fast D minor, saw lead and organ stabs, heavy drums. 16 bars. */
  boss: {
    bpm: 150,
    stepsPerBeat: 4,
    vol: 0.7,
    channels: [
      ch(
        'saw',
        join(
          'D5 - - - . . D5 - F5 - - - E5 - D5 -',
          'C5 - - - A4 - - - Bb4 - - - A4 - - -',
          'D5 - - - . . D5 - F5 - - - G5 - A5 -',
          'Bb5 - - - A5 - G5 - A5 - - - . . . .',
          'F5 - - - E5 - D5 - E5 - - - F5 - A5 -',
          'Bb5 - - - A5 - F5 - E5 - - - . . . .',
          'F5 - G5 - A5 - C6 - Bb5 - A5 - G5 - E5 -',
          'D5 - - - - - - - C#5 - - - - - - -',
          'D6 - - - . . D6 - F6 - - - E6 - D6 -',
          'C6 - - - A5 - - - Bb5 - - - A5 - - -',
          'D6 - - - . . D6 - F6 - - - G6 - A6 -',
          'Bb6 - - - A6 - G6 - A6 - - - . . . .',
          'F6 - - - E6 - D6 - E6 - - - F6 - A6 -',
          'G6 - - - F6 - E6 - F6 - - - . . . .',
          'E6 - F6 - G6 - Bb6 - A6 - G6 - F6 - E6 -',
          'D6 - - - - - - - A5 - - - C#6 - - -',
        ).replace(/Bb/g, 'A#'),
        { vol: 0.2 },
      ),
      ch('organ', figure(['Dm', 'F', 'Dm', 'G', 'Bbmaj7', 'Gm', 'Bbmaj7', 'A', 'Dm', 'F', 'Dm', 'G', 'Bbmaj7', 'Gm', 'Gm', 'A'].map(fixFlat), 4, 'C - . . C - . . C - . . C - C -'), {
        vol: 0.12,
      }),
      ch('bass', figure(['Dm', 'F', 'Dm', 'G', 'Bbmaj7', 'Gm', 'Bbmaj7', 'A', 'Dm', 'F', 'Dm', 'G', 'Bbmaj7', 'Gm', 'Gm', 'A'].map(fixFlat), 2, 'R 8 R 8 R 8 R 8 R 8 R 8 5 8 5 8'), {
        vol: 0.4,
      }),
      ch('kick', drums('x . . x . . x . x . . x . . x .', 16), { vol: 0.42 }),
      ch('snare', drums('. . . . x . . . . . . . x . x .', 16), { vol: 0.3 }),
      ch('hat', drums('x x x . x x x . x x x . x x x .', 16), { vol: 0.1 }),
    ],
  },

  /** Pencil forest — D dorian, plucked arpeggios, a breathy sine flute on the lullaby. 16 bars 4/4. */
  forest: {
    bpm: 84,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch('pluck', figure(['Dm7', 'Em7', 'Fmaj7', 'Em7', 'Dm7', 'Em7', 'Cmaj7', 'Dm7', 'Gm7', 'Am7', 'Fmaj7', 'Em7', 'Dm7', 'Em7', 'Cmaj7', 'Dm7'].map(fixFlat), 3, 'R 5 7 10 8 7 5 3'), {
        vol: 0.22,
        reverb: 0.4,
      }),
      ch(
        'sine',
        join(
          rest(8),
          rest(8),
          'A5 - - G5 F5 - - -',
          'E5 - - F5 G5 - - -',
          'A5 - G5 - E5 - - -',
          'D5 - - - - - . .',
          'F5 - - E5 D5 - - -',
          'E5 - - - - - . .',
          'D6 - - C6 A5 - - -',
          'C6 - - A5 G5 - - -',
          'A5 - G5 - F5 - - -',
          'E5 - - - - - . .',
          'F5 - - E5 D5 - - -',
          'E5 - F5 - G5 - E5 -',
          'C5 - - D5 E5 - - -',
          'D5 - - - - - . .',
        ),
        { vol: 0.3, reverb: 0.6 },
      ),
      ch('pad', padLine(['Dm7', 'Em7', 'Fmaj7', 'Em7', 'Dm7', 'Em7', 'Cmaj7', 'Dm7', 'Gm7', 'Am7', 'Fmaj7', 'Em7', 'Dm7', 'Em7', 'Cmaj7', 'Dm7'], 3, 8), {
        vol: 0.12,
        reverb: 0.6,
      }),
      ch('bass', figure(['Dm7', 'Em7', 'Fmaj7', 'Em7', 'Dm7', 'Em7', 'Cmaj7', 'Dm7', 'Gm7', 'Am7', 'Fmaj7', 'Em7', 'Dm7', 'Em7', 'Cmaj7', 'Dm7'], 2, 'R - - - - - 5 -'), {
        vol: 0.3,
      }),
    ],
  },

  /** Paper hospital — cold and very slow: heart-monitor beeps, detuned pad, the lullaby in C minor. 16 bars 3/4. */
  hospital: {
    bpm: 56,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch('sine', rep('B5 . . . . .', 16), { vol: 0.1 }),
      ch('pad', padLine(['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G', 'Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'].map(fixFlat), 3, 6), {
        vol: 0.18,
        reverb: 0.7,
        detune: 14,
      }),
      ch('musicbox', join(rep(rest(6), 4), toHarmonicMinor(LULLABY_A).split(' | ').slice(0, 4).join(' | '), rep(rest(6), 4), toHarmonicMinor(LULLABY_A).split(' | ').slice(4).join(' | ')), {
        vol: 0.32,
        reverb: 0.8,
        detune: -18,
      }),
      ch('bass', figure(['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G', 'Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'].map(fixFlat), 1, 'R - - - - -'), { vol: 0.25 }),
    ],
  },

  /** Dodo's theme — the lullaby slowed down in C minor, out-of-tune music box over a drone. 16 bars 3/4. */
  dodo: {
    bpm: 52,
    stepsPerBeat: 2,
    vol: 0.8,
    channels: [
      ch('musicbox', toMinor(LULLABY), { vol: 0.6, reverb: 0.8, detune: -25 }),
      ch('musicbox', transpose(toMinor(LULLABY), -12), { vol: 0.22, reverb: 0.9, detune: 18 }),
      ch('pad', padLine(['Cm', 'G', 'Ab', 'G', 'Cm', 'G', 'G7', 'Cm', 'Fm', 'Ab', 'G7', 'Cm', 'Fm', 'Ab', 'G7', 'Cm'].map(fixFlat), 2, 6), {
        vol: 0.2,
        reverb: 0.7,
        detune: -10,
      }),
      ch('triangle', rep('C2 - - - - -', 16), { vol: 0.3 }),
    ],
  },

  /** Final battle — a dark waltz: the lullaby in minor on a saw lead, organ, heavy kick on one. 32 bars 3/4. */
  dodo_battle: {
    bpm: 138,
    stepsPerBeat: 2,
    vol: 0.72,
    channels: [
      ch('saw', join(toHarmonicMinor(LULLABY), transpose(toHarmonicMinor(LULLABY), 12)), { vol: 0.18 }),
      ch('musicbox', rep(transpose(toMinor(LULLABY_B), 12), 4).split(' | ').slice(0, 32).join(' | '), { vol: 0.12, reverb: 0.6, detune: 35 }),
      ch('organ', rep(figure(['Cm', 'G', 'Ab', 'G', 'Cm', 'G', 'G7', 'Cm', 'Fm', 'Ab', 'G7', 'Cm', 'Fm', 'Db', 'G7', 'Cm'].map(fixFlat), 4, '. . C - C -'), 2), {
        vol: 0.1,
      }),
      ch('bass', rep(figure(['Cm', 'G', 'Ab', 'G', 'Cm', 'G', 'G7', 'Cm', 'Fm', 'Ab', 'G7', 'Cm', 'Fm', 'Db', 'G7', 'Cm'].map(fixFlat), 2, 'R - 5 - L -'), 2), {
        vol: 0.45,
      }),
      ch('kick', drums('X . . . x .', 32), { vol: 0.42 }),
      ch('snare', drums('. . x . x .', 32), { vol: 0.22 }),
      ch('hat', drums('x x x x x x', 32), { vol: 0.08 }),
    ],
  },

  /** The void — drones and lonely bells. 8 bars, very slow 4/4. */
  void: {
    bpm: 40,
    stepsPerBeat: 2,
    vol: 0.8,
    channels: [
      ch('pad', join(hold('C2+G2', 32), hold('Ab1+Eb2', 16), hold('G1+D2', 16)).replace(/Eb/g, 'D#').replace(/Ab/g, 'G#'), { vol: 0.28, reverb: 0.8, detune: -8 }),
      ch('bell', join('E5 - - - - - - -', rest(8), rest(8), 'D5 - - - - - - -', rest(8), 'C5 - - - - - - -', rest(8), rest(8)), {
        vol: 0.14,
        reverb: 0.95,
        detune: -30,
      }),
    ],
  },

  /** Ending — tender and luminous: piano arpeggios, the lullaby on piano then music box, rising to D major. 32 bars 3/4. */
  ending: {
    bpm: 72,
    stepsPerBeat: 2,
    vol: 0.85,
    channels: [
      ch('piano', join(LULLABY, transpose(LULLABY, 2)), { vol: 0.42, reverb: 0.5 }),
      ch('piano', join(figure(CH_LULLABY, 3, 'R 5 8 10 8 5'), figure(CH_LULLABY.map((c) => transposeChord(c, 2)), 3, 'R 5 8 10 8 5')), {
        vol: 0.26,
        reverb: 0.5,
      }),
      ch('musicbox', join(rep(rest(6), 16), transpose(LULLABY, 14)), { vol: 0.18, reverb: 0.8 }),
      ch('pad', join(padLine(CH_LULLABY, 3, 6), padLine(CH_LULLABY.map((c) => transposeChord(c, 2)), 3, 6)), { vol: 0.2, reverb: 0.7 }),
      ch('triangle', join(figure(CH_LULLABY, 2, 'R - - - - -'), figure(CH_LULLABY.map((c) => transposeChord(c, 2)), 2, 'R - - - - -')), {
        vol: 0.28,
      }),
    ],
  },

  /** Game over — a short falling phrase on piano in A minor. 8 bars 3/4. */
  gameover: {
    bpm: 60,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch('piano', join('E5 - - D5 C5 -', 'B4 - - A4 - -', 'D5 - - C5 B4 -', 'A4 - - G#4 - -', 'C5 - - B4 A4 -', 'G4 - - F4 - -', 'E4 - - G#4 B4 -', 'A4 - - - - -'), {
        vol: 0.38,
        reverb: 0.6,
      }),
      ch('pad', padLine(['Am', 'Em', 'Dm', 'E', 'F', 'Dm', 'E', 'Am'], 3, 6), { vol: 0.16, reverb: 0.7 }),
      ch('bass', figure(['Am', 'Em', 'Dm', 'E', 'F', 'Dm', 'E', 'Am'], 2, 'R - - - - -'), { vol: 0.25 }),
    ],
  },

  // ---------------------------------------------------------------------------
  // Bonus « Les rêves des autres » — Maman's dream
  // ---------------------------------------------------------------------------

  /** The night shift: A minor, muted piano, a sparse bell tune, and a clock ticking on every beat. 8 bars 4/4. */
  garde: {
    bpm: 76,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch('piano', figure(GARDE_CHORDS, 3, 'R . 5 . 8 . 5 .'), { vol: 0.26, reverb: 0.5 }),
      ch(
        'bell',
        join(
          'E5 - - - C5 - - -',
          'A4 - - - . . . .',
          'G4 - C5 - E5 - - -',
          'D5 - - - . . . .',
          'E5 - - - C5 - A4 -',
          'C5 - - - . . . .',
          'D5 - - - F5 - E5 -',
          'G#4 - - - - - . .',
        ),
        { vol: 0.16, reverb: 0.7 },
      ),
      ch('pad', padLine(GARDE_CHORDS, 3, 8), { vol: 0.12, reverb: 0.6, detune: 8 }),
      ch('bass', figure(GARDE_CHORDS, 2, 'R - - - - - - -'), { vol: 0.2 }),
      ch('hat', drums('x . x . x . x .', 8), { vol: 0.05 }),
    ],
  },

  /** Maman's theme — the lullaby in F, slow, on a tired piano, like someone humming it alone in a kitchen. 16 bars 3/4. */
  maman: {
    bpm: 58,
    stepsPerBeat: 2,
    vol: 0.8,
    channels: [
      ch('piano', transpose(LULLABY, -7), { vol: 0.34, reverb: 0.55 }),
      ch('piano', figure(CH_LULLABY.map((c) => transposeChord(c, 5)), 2, 'R 5 8 10 8 5'), { vol: 0.2, reverb: 0.5 }),
      ch('pad', padLine(CH_LULLABY.map((c) => transposeChord(c, 5)), 3, 6), { vol: 0.12, reverb: 0.7 }),
      ch('musicbox', join(rep(rest(6), 12), 'C6 - - - - -', 'A5 - - - - -', 'G5 - - - - -', 'F5 - - - - -'), { vol: 0.1, reverb: 0.8 }),
    ],
  },

  /** Le Réveil — a relentless A minor tune, ticking eighths, a high bell that goes tic… tac…, the alarm at the end. 8 bars 4/4. */
  reveil: {
    bpm: 138,
    stepsPerBeat: 4,
    vol: 0.7,
    channels: [
      ch(
        'pulse25',
        join(
          'A5 - - - C6 - B5 - A5 - - - E5 - - -',
          'F5 - - - A5 - G5 - F5 - - - C5 - - -',
          'E5 - - - G5 - A5 - C6 - - - B5 - A5 -',
          'B5 - - - - - - - D6 - C6 - B5 - G5 -',
          'A5 - - - C6 - B5 - A5 - - - E5 - - -',
          'F5 - - - A5 - C6 - F6 - - - E6 - D6 -',
          'D6 - - - F6 - E6 - D6 - C6 - B5 - A5 -',
          'G#5 - - - B5 - - - E6 . E6 . E6 . E6 .',
        ),
        { vol: 0.15 },
      ),
      ch('bell', rep('A6 . . . . . . . E6 . . . . . . .', 8), { vol: 0.06, reverb: 0.4 }),
      ch('bass', figure(GARDE_CHORDS, 2, 'R . R . 8 . R . R . R . 8 . 5 .'), { vol: 0.34 }),
      ch('pad', padLine(GARDE_CHORDS, 3, 16), { vol: 0.07, detune: 10 }),
      ch('kick', drums('x . . . . . . . x . . x . . . .', 8), { vol: 0.4 }),
      ch('snare', drums('. . . . x . . . . . . . x . . .', 8), { vol: 0.24 }),
      ch('hat', drums('x . x . x . x . x . x . x . x .', 8), { vol: 0.08 }),
    ],
  },

  // -------------------------------------------------------------------------------------------------------------------
  // Chapter 4 « La Maison Cousue »
  // -------------------------------------------------------------------------------------------------------------------

  /**
   * La Couseuse — a sewing machine that never stops: needle ticks in sixteenths with a stutter, the pedal on the kick,
   * and over it the lullaby in C minor on a detuned music box that skips like a stuck record (the same bar, again,
   * again — one night after another). 8 bars 4/4.
   */
  couseuse: {
    bpm: 132,
    stepsPerBeat: 4,
    vol: 0.72,
    channels: [
      ch(
        'musicbox',
        join(
          'Eb5 - - - . . D5 - C5 - - - . . . .',
          'Eb5 - - - . . D5 - C5 - - - . . . .',
          'Eb5 - - - . . D5 - C5 - - - D5 - Eb5 -',
          'G5 - - - - - - - . . . . . . . .',
          'Ab5 - - - G5 - Eb5 - - - - - D5 - - -',
          'Ab5 - - - G5 - Eb5 - - - - - D5 - - -',
          'C5 - - - Bb4 - C5 - D5 - - - Eb5 - D5 -',
          'C5 - - - - - - - . . . . B4 - - -',
        ),
        { vol: 0.32, reverb: 0.55, detune: -38 },
      ),
      ch('musicbox', transpose(rep('Eb6 . . . . . . . . . . . D6 . . .', 8), 0), { vol: 0.07, reverb: 0.8, detune: 30 }),
      ch('pulse12', rep('G6 . G6 G6 G6 . G6 G6 G6 . G6 G6 G6 . G6 .', 8), { vol: 0.035 }),
      ch('organ', padLine(['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'].map(fixFlat), 3, 16), { vol: 0.07, detune: 14 }),
      ch('bass', figure(['Cm', 'Cm', 'Ab', 'Ab', 'Fm', 'Fm', 'G', 'G'].map(fixFlat), 2, 'R . R . R . R . R . R . 8 . R .'), { vol: 0.36 }),
      ch('kick', drums('X . . . . . x . X . . . . . . .', 8), { vol: 0.42 }),
      ch('snare', drums('. . . . x . . . . . . . x . . x', 8), { vol: 0.16 }),
      ch('hat', drums('x . x x x . x x x . x x x . x x', 8), { vol: 0.11 }),
    ],
  },

  /**
   * Le Petit Homme de la Maison — a small man's march in 3/4: the lullaby in C minor, low on the piano; very faint and
   * out of tune above it, the same lullaby in major on a music box (the nightlight he will not let go of); knocks on
   * the kick, one, two, three, then nothing; a heartbeat. 16 bars 3/4.
   */
  petit_homme: {
    bpm: 100,
    stepsPerBeat: 2,
    vol: 0.75,
    channels: [
      ch('piano', transpose(toHarmonicMinor(LULLABY), -12), { vol: 0.34, reverb: 0.4 }),
      ch('musicbox', transpose(LULLABY, 12), { vol: 0.06, reverb: 0.85, detune: 48 }),
      ch('organ', padLine(['Cm', 'G', 'Ab', 'G', 'Cm', 'G', 'G7', 'Cm', 'Fm', 'Ab', 'G7', 'Cm', 'Fm', 'Db', 'G7', 'Cm'].map(fixFlat), 3, 6), {
        vol: 0.08,
        detune: -12,
      }),
      ch('bass', figure(['Cm', 'G', 'Ab', 'G', 'Cm', 'G', 'G7', 'Cm', 'Fm', 'Ab', 'G7', 'Cm', 'Fm', 'Db', 'G7', 'Cm'].map(fixFlat), 2, 'R - - L - -'), {
        vol: 0.42,
      }),
      ch('kick', drums(join('X . . . . .', 'X . X . . .', 'X . X . X .', '. . . . . .'), 4), { vol: 0.5 }),
      ch('triangle', rep('C2 . C2 . . .', 16), { vol: 0.28 }),
      ch('snare', drums('. . . . . x', 16), { vol: 0.1 }),
    ],
  },
};

/** Spells flats as sharps so chord() can parse them (Bb → A#). */
function fixFlat(sym: string): string {
  const m = /^([A-G])b(.*)$/.exec(sym);
  if (!m) return sym;
  const pc = (PC[m[1]!]! + 11) % 12;
  return `${NAMES[pc]}${m[2]}`;
}

/** Transposes a chord symbol by semitones (spelled with sharps). */
function transposeChord(sym: string, semis: number): string {
  const [root] = chord(sym);
  const m = /^[A-G][#b]?(.*)$/.exec(sym)!;
  return `${NAMES[(root + semis + 120) % 12]}${m[1]}`;
}

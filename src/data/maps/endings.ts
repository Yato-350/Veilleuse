import type { MapDef, PropDef } from '../../game/overworld/types';
import { REAL_MAPS } from './real';

/*
 * Maps of the endings (docs/HISTOIRE.md § 5; scripts in src/game/story/endings.ts). Both are the apartment's hallway
 * (`appartement`, maps/real.ts) seen from outside the story: no map script, no banner, and only played as cutscenes.
 *
 *   appartement_br       Beaux rêves: the hallway in the evening, the years going by. Noa's door (x 6) stays shut;
 *                        a line of light shows under it. Maman's notes are spawned on it by the script.
 *   appartement_silence  Silence: the hallway on a bright school morning. Mina's door (x 10) has a card taped on it,
 *                        « DÉBARRAS »; her chair at the kitchen table and her toy box are gone.
 */

const BASE = REAL_MAPS.appartement!;

/** The hallway's props, with their scripts and texts dropped (the endings are cutscenes) and some left out. */
function props(skip: (p: PropDef) => boolean): PropDef[] {
  return (BASE.props ?? []).filter((p) => !skip(p)).map(({ script: _s, text: _t, ...p }) => p);
}

const APPARTEMENT_BR: MapDef = {
  ...BASE,
  id: 'appartement_br',
  name: 'Appartement',
  music: null,
  ambience: 'none',
  darkness: 0.62,
  playerLight: 0,
  banner: false,
  onEnter: undefined,
  triggers: [],
  warps: [],
  props: [
    ...props(() => false),
    // The light under Noa's door: his nightlight, always on.
    { id: 'br_lumiere', sprite: '', x: 6, y: 3, oy: -14, solid: false, light: { r: 22, color: '#ffe991', flicker: true, dy: -14 } },
  ],
};

const APPARTEMENT_SILENCE: MapDef = {
  ...BASE,
  id: 'appartement_silence',
  name: 'Appartement',
  music: null,
  ambience: 'none',
  darkness: 0.05,
  playerLight: 0,
  particles: 'dust',
  banner: false,
  // Her door is a plain door now: no name plate.
  tiles: BASE.tiles.replace('TWDWWWDWWWMWWWDWWWDW', 'TWDWWWDWWWDWWWDWWWDW').replace('TBdBBBdBBBmBBBdBBBdB', 'TBdBBBdBBBdBBBdBBBdB'),
  onEnter: undefined,
  triggers: [],
  warps: [],
  props: [
    // No chair for her at the table any more, no toy box.
    ...props((p) => (p.sprite === 'prop_chair' && p.x === 30) || p.sprite === 'prop_toybox'),
    { id: 's_pancarte', sprite: 'prop_pancarte_debarras', x: 10, y: 2, oy: -9, solid: false },
  ],
};

export const ENDINGS_MAPS: Record<string, MapDef> = {
  appartement_br: APPARTEMENT_BR,
  appartement_silence: APPARTEMENT_SILENCE,
};

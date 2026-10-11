import { audio } from '../engine/audio';
import { W } from '../engine/constants';
import { fx } from '../engine/fx';
import { game } from '../engine/game';
import { rng } from '../engine/math';
import { drawSprite } from '../engine/sprite';
import { drawText, measure } from '../engine/font';
import { tf, tr } from '../i18n';
import { hasSpr, spr } from '../game/assets';
import type { Battle } from '../game/battle/battle';
import { EnemyRuntime } from '../game/battle/enemy';
import { CH5, crackPath, tempLabel } from '../game/battle/patterns-ch5';
import { needTotal } from '../game/battle/rules';
import type { BattleHooks, EnemyDef } from '../game/battle/types';
import { G } from '../game/state';
import { dialogue } from '../game/ui/dialogue';
import { WORD_POOLS } from './words';

/*
 * Chapter 5 « La Marée Blanche » — the enemies (docs/HISTOIRE.md § 3.13). Spread into ENEMIES by src/data/enemies.ts.
 *
 * Balance (act III; chapter 4 stats, about 20 Étoiles): regular PV 40–46 / ATQ 5, La Vitre PV 180 / ATQ 6. Mina is not
 * at Noa's side: her empty frame stays in the HUD, the red thread of Mina n°366 running through it (rules.ts).
 *
 *   crabe_bracelet  (plage) Colère → Tristesse ×2. Pincers in arcs, the bracelet's clasp closing round the heart.
 *   mouette         (plage) Joie → Colère, then Joie. From turn 2 she steals a word a turn (the last one written, or a
 *                   random one) and pecks a slot out of the notebook (Battle.stolenWords / tornSlots); she gives them
 *                   back once calmed. Her cry « Mine ! » turns into « Mina » turn after turn.
 *   masque          (sas)   Peur → Joie ×2, hates Colère. Squeezes the text box from both sides and muffles the text
 *                   (Battle.textInset / muffle); the pleats squeeze the dodge box too.
 *   gel             (sas)   Colère → Tristesse ×2. Its drops stick to the heart and sting three times (damage over
 *                   time, BulletWorld.onSting); the text box gets chapped; snowflakes in figures (white: always hurt).
 *   thermometre     (sas/lac) Peur, then Colère from 38. The reading on its screen goes up 0,7 a turn; at 40 it screams
 *                   (a full-width attack, every turn). Needs the special word « fièvre ». « ça va » makes it jump.
 *   gribouille_noire (lac)  noInk: it cannot be calmed, words slide off it, each blow splits it in two (up to three on
 *                   screen, endlessly); fleeing always works and is the only way out. Its death is never Ink.
 *   vitre           (chambre_verre) the boss, see below.
 *
 * La Vitre — what the story reads after the fight:
 *   - the battle sets flags.c5_vitre = 'epargnee' (outcome 'spare': the fog lifts, Noa's hand meets hers on the glass,
 *     « … », « Je sais pas ce que tu dis. », she nods) or 'brisee' (outcome 'win': the glass bursts into ink, an empty
 *     bed behind it). She cannot be fled.
 *   - needs: Tristesse ×2, then the special word « je ne sais pas ». If flags.c5_menti (Noa answered « Oui » at the
 *     Thermomètre's portal), « pardon » must be written first: until then every word crashes on the glass.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------------------------------

/** Per-battle scratch state of a scripted enemy (hooks objects are shared between battles). */
const STATES = new WeakMap<Battle, object>();
function state<T extends object>(b: Battle, init: () => T): T {
  let s = STATES.get(b) as T | undefined;
  if (!s) {
    s = init();
    STATES.set(b, s);
  }
  return s;
}

/** The battle text box at rest (see TEXT_BOX in src/game/battle/battle.ts). */
const BOX = { x: 12, y: 86, w: 296, h: 54 };

/** Where a sprite pixel (sx, sy) of enemy `e` is on screen this frame (sprites built with a 1 px outline). */
function at(b: Battle, e: EnemyRuntime, sx: number, sy: number): [number, number] {
  const s = spr(e.def.sprite);
  const o = b.spriteOffset(e);
  return [e.x + o.dx - s.ax + sx + 1, e.y + o.dy - s.ay + sy + 1];
}

/** Small LCD digits (3×5), for the thermometer's screen. */
const LCD: Record<string, string[]> = {
  '0': ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'],
  '1': ['..x', '..x', '..x', '..x', '..x'],
  '2': ['xxx', '..x', 'xxx', 'x..', 'xxx'],
  '3': ['xxx', '..x', 'xxx', '..x', 'xxx'],
  '4': ['x.x', 'x.x', 'xxx', '..x', '..x'],
  '5': ['xxx', 'x..', 'xxx', '..x', 'xxx'],
  '6': ['xxx', 'x..', 'xxx', 'x.x', 'xxx'],
  '7': ['xxx', '..x', '..x', '..x', '..x'],
  '8': ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
  '9': ['xxx', 'x.x', 'xxx', '..x', 'xxx'],
  ',': ['.', '.', '.', '.', 'x'],
};
function drawLcd(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  g.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const rowsOf = LCD[ch];
    if (!rowsOf) continue;
    rowsOf.forEach((r, j) => [...r].forEach((v, i) => v === 'x' && g.fillRect(cx + i, y + j, 1, 1)));
    cx += rowsOf[0]!.length + 1;
  }
}

/** Loose particles (glass, ink, plastic) drawn by an overlay. */
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
function drawParts(g: CanvasRenderingContext2D, parts: Part[], floor = 82): void {
  for (const p of parts) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    if (p.y > floor) {
      p.y = floor;
      p.vx *= 0.5;
      p.vy = 0;
    }
    p.life--;
    g.globalAlpha = Math.min(1, p.life / 30);
    g.fillStyle = p.color;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  g.globalAlpha = 1;
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i]!.life <= 0) parts.splice(i, 1);
}

// ---------------------------------------------------------------------------------------------------------------------
// Mouette — steals a word a turn
// ---------------------------------------------------------------------------------------------------------------------

interface MouetteState {
  last: string;
  cries: number;
  given: boolean;
}
const mouetteState = (b: Battle): MouetteState => state(b, () => ({ last: '', cries: 0, given: false }));

/** « Mine ! » — until it sounds like a name. */
const MOUETTE_CRIES = ['Mine !', 'Mine ! Mine !', 'Mine ! Miine !', 'Mi… ne ?', 'Mi… na ?', 'Mina. Mina. Mina.'];

const MOUETTE_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = mouetteState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) {
      CH5.stolen = [];
      b.backdrop = (g) => {
        if (!b.stolenWords.length || !e.alive) return;
        // The last stolen word hangs from her beak, on a scrap of notebook paper.
        const [x, y] = at(b, e, 38, 16);
        const word = tr(b.stolenWords[b.stolenWords.length - 1]!);
        const label = word.length > 7 ? `${word.slice(0, 6)}…` : word;
        const w = measure(label) + 4;
        g.fillStyle = '#fff6e0';
        g.fillRect(x - 2, y, w, 9);
        g.fillStyle = '#d7e6f7';
        g.fillRect(x - 2, y + 7, w, 1);
        drawText(g, label, x, y + 1, { color: '#2b2a5c' });
      };
    }
    if (!e.alive) return;
    if (e.spareable) {
      if (b.stolenWords.length && !s.given) {
        s.given = true;
        b.stolenWords = [];
        b.tornSlots = 0;
        CH5.stolen = [];
        audio.sfx('pop', { pitch: 0.7 });
        await b.say('* La Mouette recrache tes mots, un par un. Ils sont mouillés, mais ils marchent encore.');
      }
      return;
    }
    if (turn < 2 || b.stolenWords.length >= 3) return;
    // The word written last, if she can have it; otherwise any word of the notebook.
    const pool = (WORD_POOLS[5] ?? []).filter((w) => !b.stolenWords.includes(w.text) && w.text !== 'je ne sais pas');
    const word = s.last && !b.stolenWords.includes(s.last) ? s.last : rng.pick(pool).text;
    b.stolenWords.push(word);
    b.tornSlots = b.stolenWords.length;
    CH5.stolen = [...b.stolenWords];
    audio.sfx('chime', { pitch: 2.6, vol: 0.3 });
    window.setTimeout(() => audio.sfx('scratch', { pitch: 1.3 }), 120);
    e.shake = 12;
    await b.say(tf('* La Mouette plonge dans ton carnet et arrache « {0} ».\n* Ce mot-là, tu ne peux plus l\'écrire.', tr(word)));
  },
  talk(b) {
    const s = mouetteState(b);
    const e = b.enemies[0];
    if (!e || e.spareable) return null;
    const line = MOUETTE_CRIES[Math.min(MOUETTE_CRIES.length - 1, s.cries)]!;
    s.cries++;
    return line;
  },
  pattern(b, turn) {
    return b.stolenWords.length && turn % 2 === 0 ? 'word_theft' : 'gull_dive';
  },
  async onWord(b, _e, w) {
    mouetteState(b).last = w.text;
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Masque — squeezes and muffles the text box
// ---------------------------------------------------------------------------------------------------------------------

interface MasqueState {
  squeeze: number;
  told: boolean;
  freed: boolean;
}
const masqueState = (b: Battle): MasqueState => state(b, () => ({ squeeze: 0, told: false, freed: false }));
const INSETS = [0, 10, 16, 22];
const MUFFLES = [0, 0.12, 0.22, 0.3];

/** The mask's cloth over both sides of the text box: pleats, the elastic loops running off to the screen's edges. */
function drawMaskCloth(g: CanvasRenderingContext2D, b: Battle): void {
  const inset = b.textInset;
  if (inset <= 0 || b.mode === 'dodge' || b.mode === 'notebook') return;
  for (const side of [0, 1]) {
    const x0 = side ? BOX.x + BOX.w - inset : BOX.x - 2;
    const w = inset + 2;
    g.fillStyle = '#dfe8f0';
    g.fillRect(x0, BOX.y - 3, w, BOX.h + 6);
    g.fillStyle = '#c4d1df';
    for (let y = BOX.y + 3; y < BOX.y + BOX.h; y += 9) g.fillRect(x0, y, w, 1);
    g.fillRect(side ? x0 : x0 + w - 1, BOX.y - 3, 1, BOX.h + 6);
    // Elastic: from the cloth out to the edge of the screen and back, like a loop over an ear that is not there.
    g.fillStyle = '#fffaf2';
    const ex = side ? W - 2 : 1;
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const y = BOX.y + 6 + t * (BOX.h - 12);
      const x = (side ? x0 + w : x0) + (ex - (side ? x0 + w : x0)) * Math.sin(t * Math.PI);
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

const MASQUE_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = masqueState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) b.overlay = (g) => drawMaskCloth(g, b);
    if (!e.alive) return;
    if (e.spareable) {
      if (!s.freed) {
        s.freed = true;
        b.textInset = 0;
        b.muffle = 0;
        audio.sfx('thread', { pitch: 1.4, vol: 0.5 });
        await b.say('* Le Masque se décroche d\'une oreille. L\'air revient dans la boîte.');
      }
      return;
    }
    if (turn < 2) return;
    s.squeeze = Math.min(3, s.squeeze + 1);
    b.textInset = INSETS[s.squeeze]!;
    b.muffle = MUFFLES[s.squeeze]!;
    if (!s.told) {
      s.told = true;
      audio.sfx('whoosh', { pitch: 0.6, vol: 0.4 });
      await b.say('* Le Masque se plaque sur la boîte de texte.\n* Tes mots ont moins de place pour respirer.');
    }
  },
  async onWord(b, e, w) {
    const s = masqueState(b);
    if (w.emotion === 'colere' && !e.spareable) {
      s.squeeze = Math.min(3, s.squeeze + 1);
      b.textInset = INSETS[s.squeeze]!;
      b.muffle = MUFFLES[s.squeeze]!;
    }
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Gel — the chapped box
// ---------------------------------------------------------------------------------------------------------------------

/** Chaps along the white frame of the box: gaps in the frame and small pink cuts, more every turn. */
function drawChaps(g: CanvasRenderingContext2D, b: Battle, n: number): void {
  const bx = b.box;
  for (let i = 0; i < n; i++) {
    const k = (i * 0.618 + 0.13) % 1;
    const top = i % 2 === 0;
    const x = Math.round(bx.x + 6 + k * (bx.w - 12));
    const y = Math.round(top ? bx.y - 2 : bx.y + bx.h);
    // A split in the white frame, and a thin pink cut running from it into the box, like chapped skin.
    g.fillStyle = '#000000';
    g.fillRect(x, y, 2, 2);
    g.fillStyle = '#ff8a96';
    const dir = top ? 1 : -1;
    for (let j = 0; j < 4 + (i % 3); j++) g.fillRect(x + (j % 2 ? 1 : 0) + Math.floor(j / 2) * (i % 2 ? 1 : -1), y + (top ? 2 : -1) + j * dir, 1, 1);
    g.fillStyle = '#a8324a';
    g.fillRect(x + 1, y + (top ? 2 : -1), 1, 1);
  }
}

const GEL_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const e = b.enemies[0];
    if (turn === 1 && e) b.overlay = (g) => (b.mode === 'notebook' ? undefined : drawChaps(g, b, Math.min(12, (b.turn - 1) * 3)));
    if (turn === 2) await b.say('* Le bord de la boîte se gerce. Ça sent l\'alcool jusqu\'ici.');
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Thermomètre — the reading goes up; at 40 it screams
// ---------------------------------------------------------------------------------------------------------------------

interface ThermoState {
  temp: number;
  angry: boolean;
  screamed: boolean;
  mem: boolean;
  t: number;
}
const thermoState = (b: Battle): ThermoState => state(b, () => ({ temp: 37.2, angry: false, screamed: false, mem: false, t: 0 }));

const THERMO_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = thermoState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) {
      CH5.temp = s.temp;
      b.backdrop = (g) => {
        s.t++;
        if (e.dead || e.spareT > 30 || e.hidden) return;
        const [x, y] = at(b, e, 5, 10);
        const hot = s.temp >= 40 && !e.spareable;
        // At 40 the screen blinks; once « fièvre » is written, it shows the reading it remembers.
        if (hot && Math.floor(s.t / 10) % 2) return;
        drawLcd(g, s.mem ? '38,4' : tempLabel(s.temp), x + 1, y + 1, hot ? '#a8324a' : '#2d3324');
      };
    }
    if (!e.alive || e.spareable) return;
    if (turn >= 2) {
      s.temp = Math.min(40, Math.round((s.temp + 0.7) * 10) / 10);
      CH5.temp = s.temp;
      audio.sfx('beep', { pitch: 1.4 + (s.temp - 37) * 0.2, vol: 0.4 });
    }
    if (s.temp >= 38 && !s.angry) {
      s.angry = true;
      e.emotion = 'colere';
      await b.say('* Le chiffre passe 38. Le Thermomètre ne tremble plus.\n* Il est en colère.');
    }
    if (s.temp >= 40 && !s.screamed) {
      s.screamed = true;
      b.detune(0.35);
      await b.say('* 40,0. L\'écran clignote.\n* Le Thermomètre se met à hurler.');
    }
  },
  pattern(b, turn) {
    const s = thermoState(b);
    if (s.temp >= 40) return 'thermo_scream';
    return turn % 2 ? 'thermo_digits' : 'thermo_mercury';
  },
  talk(b) {
    const s = thermoState(b);
    const e = b.enemies[0];
    if (!e || e.spareable) return null;
    if (s.temp >= 40) return rng.pick(['BIIIIIIP.', 'QUARANTE.', 'BIP BIP BIP BIP BIP.']);
    return null;
  },
  async onWord(b, e, w) {
    const s = thermoState(b);
    if (w.text === 'ça va' && !e.spareable) {
      s.temp = Math.min(40, Math.round((s.temp + 0.8) * 10) / 10);
      CH5.temp = s.temp;
      audio.sfx('beep', { pitch: 2.2, vol: 0.5 });
      await b.bubble([{ e, text: 'Bip bip bip. Menteur.' }]);
      await b.say(tf('* Le chiffre saute : {0}.', tempLabel(s.temp)));
      return true;
    }
    if (w.text === 'fièvre') {
      s.mem = true;
      e.emotion = 'neutre';
      b.detune(0);
    }
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Gribouille Noire — splits in two, cannot be calmed, can only be fled
// ---------------------------------------------------------------------------------------------------------------------

interface NoireState {
  splits: number;
}
const noireState = (b: Battle): NoireState => state(b, () => ({ splits: 0 }));

/** Spreads the living enemies across the screen again (as the battle does at the start). */
function relayout(b: Battle): void {
  const alive = b.enemies.filter((x) => x.alive);
  const n = alive.length;
  alive.forEach((x, i) => {
    x.x = Math.round(W / 2 + (i - (n - 1) / 2) * (n > 2 ? 86 : 110));
  });
}

const NOIRE_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    if (turn !== 1) return;
    if (!G.state.flags.c5_gribouille_noire) {
      G.state.flags.c5_gribouille_noire = true;
      await dialogue.say('Ça, c\'est un Gribouille. N\'aie pas peur, il est tout p…', { who: 'dodo:happy' });
      await dialogue.say(['…Non. Pas celui-là.', 'Celui-là n\'a pas de cœur. C\'est juste de la peur dessinée.', 'On ne la console pas. On ne la frappe pas non plus.', 'On s\'en va. Viens.'], {
        who: 'dodo:creepy',
      });
    } else await b.say('* Encore une. Elle ne se souvient pas de toi.\n* Elle n\'a pas de quoi se souvenir.');
  },
  async onWord(b, e) {
    await b.bubble([{ e, text: '…' }]);
    await b.say('* Le mot glisse sur l\'encre.\n* Il n\'y a rien dessous pour l\'entendre.');
    return true;
  },
  async onDeath(b, e) {
    const alive = b.enemies.filter((x) => x.alive).length;
    if (alive >= 3) return false;
    // It splits instead of dying.
    const s = noireState(b);
    s.splits++;
    e.hp = e.maxHp;
    e.hpShown = e.maxHp;
    const copy = new EnemyRuntime(e.def);
    copy.y = e.y;
    copy.x = e.x;
    copy.flash = 10;
    copy.shake = 14;
    b.enemies.push(copy);
    relayout(b);
    audio.sfx('scratch', { pitch: 0.8 });
    fx.shake(1, 8);
    if (s.splits === 1) await b.say('* Tu la coupes en deux.\n* Ça fait deux Gribouilles Noires.');
    else if (s.splits === 2) await b.say('* Chaque coup en fait deux.\n* La peur, on ne la tue pas. On s\'en éloigne.');
    else await b.say('* Encore deux.');
    return true;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// La Vitre — the boss
// ---------------------------------------------------------------------------------------------------------------------

interface VitreState {
  menti: boolean;
  prints: number;
  clear: number;
  meetT: number;
  meeting: boolean;
  broken: boolean;
  shownTear: boolean;
  firstGood: boolean;
  parts: Part[];
  t: number;
}
const vitreState = (b: Battle): VitreState =>
  state(b, () => ({ menti: false, prints: 0, clear: 0, meetT: -1, meeting: false, broken: false, shownTear: false, firstGood: false, parts: [], t: 0 }));

/** Glass of the window, in sprite pixels (see vitre() in src/data/sprites/enemies-ch5.ts). */
const GLASS = { x: 6, y: 12, w: 84, h: 62 };

/** Her handprints, from her side of the glass (glass pixels). */
const PRINTS: Array<[number, number]> = [
  [20, 30],
  [58, 22],
  [36, 44],
  [66, 46],
  [12, 50],
  [46, 16],
];

/** A small open hand: fingers, palm, thumb (7×9). `s` scales it. */
const HAND = ['.x.x.x.', '.x.x.x.', '.x.x.xx', 'xxxxxx.', 'xxxxxxx', 'xxxxxx.', '.xxxxx.', '.xxxx..', '..xxx..'];
function drawHand(g: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1, outline = false): void {
  g.fillStyle = color;
  HAND.forEach((r, j) =>
    [...r].forEach((v, i) => {
      if (v !== 'x') return;
      if (outline) {
        const at = (ii: number, jj: number) => HAND[jj]?.[ii] === 'x';
        if (at(i - 1, j) && at(i + 1, j) && at(i, j - 1) && at(i, j + 1)) return;
      }
      g.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), Math.ceil(scale), Math.ceil(scale));
    }),
  );
}

function drawVitre(g: CanvasRenderingContext2D, b: Battle, e: EnemyRuntime, s: VitreState): void {
  s.t++;
  if (s.broken) {
    // Behind the glass that burst: the same room, nobody, the sheet flat. It comes out of the ink.
    const k = Math.min(1, e.deathT / 70);
    if (k > 0.1 && hasSpr('b_c5_lit_vide')) drawSprite(g, spr('b_c5_lit_vide'), e.x, e.y, { alpha: k });
    drawParts(g, s.parts);
    return;
  }
  if (e.dead || (e.spared && e.spareT > 40)) return;
  const [gx, gy] = at(b, e, GLASS.x, GLASS.y);
  g.save();
  g.beginPath();
  g.rect(gx, gy, GLASS.w, GLASS.h);
  g.clip();
  // Her handprints, one more each turn: on her side, so they show through the fog, darker.
  for (let i = 0; i < Math.min(s.prints, PRINTS.length); i++) {
    const [px, py] = PRINTS[i]!;
    g.globalAlpha = 0.55;
    drawHand(g, gx + px, gy + py, '#8396ad');
  }
  g.globalAlpha = 1;
  // The fog of Noa's breath: it comes with every breath, and less once he is sad with her.
  const breath = Math.max(0, Math.sin(s.t * 0.035)) ** 2;
  let fogA = Math.max(0, 0.2 + 0.45 * breath + (s.menti && e.step === 0 ? 0.25 : 0) - s.clear);
  if (s.meeting) fogA *= Math.max(0, 1 - s.meetT / 40);
  if (fogA > 0.02) {
    g.globalAlpha = Math.min(0.85, fogA);
    g.fillStyle = '#eef3f7';
    g.fillRect(gx, gy, GLASS.w, GLASS.h);
    g.fillStyle = '#ffffff';
    for (let y = gy; y < gy + GLASS.h; y += 3) for (let x = gx + ((y >> 1) % 4); x < gx + GLASS.w; x += 4) g.fillRect(x, y, 1, 1);
    g.globalAlpha = 1;
  }
  // Cracks, as she is hurt.
  const n = Math.ceil((1 - e.hp / e.maxHp) * 7);
  for (let i = 0; i < n; i++) {
    const pts = crackPath(i * 37 + 11, gx + 10 + ((i * 29) % 64), gy + 8 + ((i * 17) % 44), 5 + (i % 3));
    g.fillStyle = i === n - 1 ? '#a8324a' : '#3d4c8f';
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1]!;
      const [bx, by] = pts[k]!;
      const m = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let q = 0; q <= m; q++) g.fillRect(Math.round(ax + ((bx - ax) * q) / Math.max(1, m)), Math.round(ay + ((by - ay) * q) / Math.max(1, m)), 1, 1);
    }
  }
  // The two hands meeting on the glass: hers, small, at the center; his, drawn in blue pen, rising to meet it.
  if (s.meeting) {
    s.meetT++;
    // Where her small hand already was (the second print), to the right of her, on the glass.
    const cx = gx + 54;
    const cy = gy + 18;
    // Hers, from the other side: small, grey through the glass, flat.
    g.globalAlpha = Math.min(1, s.meetT / 30);
    drawHand(g, cx + 4, cy + 5, '#525a76', 1);
    g.globalAlpha = 1;
    // His, on this side: bigger, pale, outlined in blue pen, rising until it covers hers.
    const rise = Math.min(1, s.meetT / 70);
    const hy = Math.round(cy + (1 - rise) * 64);
    g.globalAlpha = 0.5;
    drawHand(g, cx, hy, '#f3e6dc', 2);
    g.globalAlpha = 1;
    drawHand(g, cx, hy, '#3d4c8f', 2, true);
  }
  g.restore();
}

const VITRE_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = vitreState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) {
      s.menti = !!G.state.flags.c5_menti;
      if (s.menti) {
        // « Oui » at the portal: she cannot hear him until he says sorry.
        e.def = { ...e.def, needs: [{ word: 'pardon' }, ...e.def.needs] };
        e.total = needTotal(e.def.needs);
      }
      b.backdrop = (g) => drawVitre(g, b, e, s);
      if (s.menti) await b.say('* La vitre s\'embue dès que tu t\'approches.\n* Au portail, tu as dit « oui ». Elle ne t\'entend pas.');
    }
    if (!e.alive) return;
    if (s.prints < PRINTS.length && turn >= 2) {
      s.prints++;
      if (s.prints === 1) {
        audio.sfx('knock1', { vol: 0.5 });
        await b.say('* Une main se pose de l\'autre côté.\n* Petite. À plat.');
      }
    }
    if (e.hp < e.maxHp / 2 && !s.shownTear) {
      s.shownTear = true;
      b.detune(0.25);
    }
  },
  pattern(b, turn) {
    const e = b.enemies[0];
    const order = ['vitre_buee', 'vitre_condensation', 'vitre_fissures'];
    let id = order[(turn - 1) % 3]!;
    // Hurt or upset, the glass cracks more; once he is sad with her, less.
    if (e && (e.agitation >= 2 || e.hp < e.maxHp / 2) && turn % 2 === 0) id = 'vitre_fissures';
    if (e && e.step >= (vitreState(b).menti ? 2 : 1) && id === 'vitre_fissures') id = 'vitre_condensation';
    return id;
  },
  async onWord(b, e, w) {
    const s = vitreState(b);
    // « Oui » at the portal: until « pardon », every word crashes on the glass.
    if (s.menti && e.step === 0 && w.text !== 'pardon') {
      await b.bubble([{ e, text: '…' }]);
      await b.say('* Tes mots s\'écrasent sur le verre.\n* De l\'autre côté, elle se bouche les oreilles.');
      return true;
    }
    if (s.menti && w.text === 'pardon' && e.step === 1 && e.stepProgress === 0) {
      s.clear += 0.15;
      audio.sfx('chime', { pitch: 0.8, vol: 0.5 });
      await b.bubble([{ e, text: '…' }]);
      await b.say('* « Pardon. » La buée tremble.\n* De l\'autre côté, elle enlève ses mains de ses oreilles.');
      return true;
    }
    if (w.text === 'je ne sais pas' && !e.spareable) {
      await b.bubble([{ e, text: '…' }]);
      await b.say('* La buée efface ta phrase avant qu\'elle arrive de l\'autre côté.');
      return true;
    }
    if (w.text === 'je ne sais pas' && e.spareable) {
      s.clear = 1;
      await b.say('* « Je sais pas. »\n* Pour la première fois, ta buée ne revient pas.');
      return false;
    }
    if (w.emotion === 'tristesse' || w.emotion2 === 'tristesse') {
      s.clear = Math.min(0.5, s.clear + 0.15);
      if (!s.firstGood) {
        s.firstGood = true;
        await b.bubble([{ e, text: '…' }]);
        await b.say('* La buée recule un peu.\n* De l\'autre côté, elle a levé la tête.');
        return false;
      }
    }
    return false;
  },
  async onSpare(b, e) {
    const s = vitreState(b);
    s.meeting = true;
    s.meetT = 0;
    audio.sfx('chime', { pitch: 0.6, vol: 0.6 });
    await game.until(() => s.meetT >= 90);
    await b.bubble([{ e, text: '…' }]);
    await dialogue.say('Je sais pas ce que tu dis.', { who: 'noa:sad' });
    await b.say('* Elle hoche la tête.\n* C\'est la bonne réponse.');
    G.state.flags.c5_vitre = 'epargnee';
    return false;
  },
  async onDeath(b, e) {
    const s = vitreState(b);
    s.broken = true;
    G.state.flags.c5_vitre = 'brisee';
    audio.sfx('shatter', { vol: 0.9 });
    window.setTimeout(() => audio.sfx('shatter', { pitch: 0.6, vol: 0.6 }), 160);
    fx.shake(4, 20);
    if (!G.settings.reduceFlashes) fx.flash('#fffaf2', 8, 0.4);
    const [gx, gy] = at(b, e, GLASS.x, GLASS.y);
    for (let i = 0; i < 70; i++) {
      const glass = i % 3 !== 0;
      s.parts.push({
        x: gx + rng.range(0, GLASS.w),
        y: gy + rng.range(0, GLASS.h),
        vx: rng.range(-1.6, 1.6),
        vy: -rng.range(0.2, 2),
        life: rng.int(60, 150),
        color: glass ? (i % 2 ? '#e4ecf3' : '#fffaf2') : '#0b0710',
        size: glass ? rng.int(1, 2) : 2,
      });
    }
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------------------------------------------------

export const CH5_ENEMIES: Record<string, EnemyDef> = {
  crabe_bracelet: {
    id: 'crabe_bracelet',
    name: 'Crabe-Bracelet',
    sprite: 'b_crabe_bracelet',
    hp: 44,
    atk: 5,
    def: 1,
    emotion: 'colere',
    needs: [{ emotion: 'tristesse', count: 2 }],
    check: 'Sa coquille : un bracelet « MINA — PÉD. 3 — 304 ». Il serre fort. Pleure avec lui.',
    flavor: [
      '* Le Crabe-Bracelet claque des pinces. Clac. Clac. Toujours deux fois.',
      '* Sur l\'étiquette, l\'encre a un peu bavé. On lit encore « 304 ».',
      '* Il marche de travers, comme on sort d\'une chambre sans se retourner.',
      '* Le sable autour de lui est blanc. Il n\'a pas d\'ombre.',
      '* Ça sent la crème solaire et le désinfectant.',
    ],
    flavorCalm: '* Le Crabe-Bracelet desserre ses pinces. Le plastique a laissé une marque rouge dans le sable.',
    talk: ['Clac !', 'C\'est à moi. C\'est écrit dessus.', 'Pédiatrie, troisième. Clac.', 'Je serre. Je ne lâche pas.', 'Ça ne s\'enlève pas. Il faut couper.', 'Tu viens samedi ? Clac. Clac.'],
    reactGood: ['…Le plastique, ça gratte, la nuit.', 'Clac… doucement.', 'Tu sais, toi. Tu sais ce qu\'il y a écrit.'],
    reactBad: ['CLAC ! Ne ris pas !', 'Je serre plus fort !', 'Pas de soleil ici. Il est faux.'],
    reactNeutral: ['Clac ?', 'Ça, ce n\'est pas écrit dessus.', '…Pédiatrie ?'],
    reactSpecial: {
      bracelet: 'Bracelet. Oui. Son prénom, sa chambre. Rien d\'autre.',
      coquillage: 'Une coquille vide, c\'est une maison. Demande-moi.',
      'quarante-deux': 'Elle comptait jusqu\'à quarante-deux. Après, on lui a mis ça au poignet.',
      visite: 'Les visites, c\'est le samedi. Clac. Il n\'est pas entré.',
      'derrière la vitre': 'Clac. Moi aussi, j\'étais derrière. Au poignet.',
    },
    spareText: '* Le Crabe-Bracelet s\'ouvre, clac, et laisse le bracelet sur le sable. Il repart tout nu, de travers.',
    killText: '* Le bracelet se referme sur rien. Clac. Le crabe fond en encre dans le sable blanc.',
    patterns: ['pincer_arcs', 'bracelet_clasp'],
    rewards: { boutons: 16 },
    bg: 'plage',
  },

  mouette: {
    id: 'mouette',
    name: 'Mouette',
    fem: true,
    sprite: 'b_mouette',
    hp: 40,
    atk: 5,
    def: 1,
    emotion: 'joie',
    needs: [{ emotion: 'colere' }, { emotion: 'joie' }],
    check: 'Elle vole un mot du carnet par tour. Crie avec elle, puis rends-lui sa joie.',
    flavor: [
      '* La Mouette te regarde de son œil rond. Bleu pâle. Un œil de quelqu\'un.',
      '* Elle ne bat pas des ailes. Elle reste en l\'air quand même.',
      '* Le vent sent le sel et le pansement.',
      '* Elle a des dents. Petites. Trop bien rangées pour une mouette.',
    ],
    flavorCalm: '* La Mouette se pose sur le sable. Elle a l\'air de quelqu\'un qui a fini de crier.',
    talk: ['Mine !', 'Mine ! Mine !', 'Mine !!'],
    reactGood: ['MINE ! …Oh. Ça fait du bien de crier.', 'Mine… mine… mieux.', 'Tu ris ? Je ris aussi. Kiaaa !'],
    reactBad: ['MINE ! C\'est à MOI !', 'Tu ne me reprendras rien !'],
    reactNeutral: ['Mine ?', 'Pas brillant. Pas pour moi.', '…Mine.'],
    reactSpecial: {
      coquillage: 'Quarante et un. Il en manque un. Mine !',
      été: 'L\'été d\'avant ! Elle dormait tout le temps. Mine.',
      château: 'Je l\'ai piétiné. Pas exprès. Mine.',
      'quarante-deux': 'Le quarante-deuxième, c\'est moi qui l\'ai. Mine.',
      vacances: 'Vacances ! Mine ! Mine ! …Les dernières.',
    },
    spareText: '* La Mouette s\'envole. Elle crie encore, très loin. Ça ressemble à un prénom.',
    killText: '* La Mouette tombe en plumes d\'encre. Les mots qu\'elle avait avalés ne reviennent pas.',
    patterns: ['gull_dive', 'word_theft'],
    rewards: { boutons: 15 },
    hooks: MOUETTE_HOOKS,
    bg: 'plage',
  },

  masque: {
    id: 'masque',
    name: 'Masque',
    sprite: 'b_masque',
    hp: 42,
    atk: 5,
    def: 2,
    emotion: 'peur',
    needs: [{ emotion: 'joie', count: 2 }],
    hates: ['colere'],
    check: 'Un masque au sourire dessiné. La colère le serre plus fort. Fais-le rire, deux fois.',
    flavor: [
      '* Le Masque respire. Il n\'y a personne derrière, mais il respire.',
      '* Le sourire dessiné au feutre a bavé à un coin.',
      '* Les élastiques pendent dans le vide, là où il devrait y avoir des oreilles.',
      '* Tu sens ton propre souffle revenir sur ta figure. Chaud. Humide.',
      '* « Pas de visite si fièvre, toux, rhume. » C\'est écrit à l\'intérieur.',
    ],
    flavorCalm: '* Le Masque pend à un seul élastique. Il ne sourit plus. Il a l\'air soulagé.',
    talk: ['Mmh. Mmmh.', 'Mmh mh… souris… mmh.', 'Mmmh. On ne voit pas si tu souris.', 'Respire. Mmh. Pas trop fort.', 'Mmh… dehors… mmh.', 'Mmmmmh.'],
    reactGood: ['Mmh ! Mh mh mh !', 'Mmh… ça se voit, sous le tissu ?', 'Hi… hi. Mmh.'],
    reactBad: ['MMMH !', 'Mmh ! Pas si près !', 'Mmh… tu postillonnes.'],
    reactNeutral: ['Mmh ?', 'Mmh mmh.', '…mmh.'],
    reactSpecial: {
      tousser: 'MMH ! Dehors ! Dehors, s\'il te plaît !',
      contagieux: 'Mmh. Pour toujours ? Mmh.',
      masque: 'Mmh ! C\'est moi ! Mmh !',
      microbe: 'Mmh. On ne les voit pas. C\'est ça, le pire.',
    },
    spareText: '* Le Masque se décroche de l\'autre oreille. Derrière, il n\'y avait personne. Il se pose comme une feuille.',
    killText: '* Le Masque se déchire au milieu de son sourire. Il en coule de l\'encre, puis plus rien.',
    patterns: ['mask_pleats', 'mask_elastics'],
    rewards: { boutons: 15 },
    hooks: MASQUE_HOOKS,
    bg: 'blanc',
  },

  gel: {
    id: 'gel',
    name: 'Gel',
    sprite: 'b_gel',
    hp: 44,
    atk: 5,
    def: 1,
    emotion: 'colere',
    needs: [{ emotion: 'tristesse', count: 2 }],
    check: 'Ça pique et ça fige. Ses gouttes restent collées et brûlent. Pleure avec lui.',
    flavor: [
      '* Le Gel sent l\'alcool. Tes yeux piquent rien qu\'à le regarder.',
      '* Pschit. Pschit. Il se lave les mains. Il n\'a pas de mains.',
      '* Une couche de givre monte le long du flacon.',
      '* Tes doigts sont gercés. Tu ne te souviens pas de les avoir lavés autant.',
    ],
    flavorCalm: '* Le Gel fond doucement. Ça sent moins fort. Presque l\'eau.',
    talk: ['Pschit.', 'Frotte. Trente secondes. Frotte.', 'Entre les doigts. Sous les ongles.', 'Ça pique ? C\'est que ça marche.', 'Rien ne doit entrer. Rien.', 'Pschit. Pschit. Pschit.'],
    reactGood: ['…Ça pique moins.', 'Pschit… doucement.', 'Tu pleures ? Ça nettoie aussi.'],
    reactBad: ['Ça brûle ! Frotte plus fort !', 'Pschit ! PSCHIT !'],
    reactNeutral: ['Pschit ?', 'Frotte.', 'Ce mot n\'est pas propre.'],
    reactSpecial: {
      tousser: 'Toux ? PSCHIT ! Pschit ! Pschit !',
      microbe: 'Je les tue tous. Presque tous. Il en passe toujours un.',
      neige: 'Ne touche pas la neige. Ne touche à rien.',
      dehors: 'Dehors, c\'est sale. Dehors, c\'est toi.',
    },
    spareText: '* Le Gel fond en une petite flaque claire. Tes mains arrêtent de piquer.',
    killText: '* Le Gel se fige, se fend, et se répand en encre glacée.',
    patterns: ['gel_drops', 'snowflakes'],
    rewards: { boutons: 16 },
    hooks: GEL_HOOKS,
    bg: 'blanc',
  },

  thermometre: {
    id: 'thermometre',
    name: 'Thermomètre',
    sprite: 'b_thermometre',
    hp: 46,
    atk: 5,
    def: 1,
    emotion: 'peur',
    needs: [{ word: 'fièvre' }],
    specialWords: [
      { text: 'fièvre', emotion: 'peur' },
      { text: 'ça va', emotion: 'joie' },
    ],
    check: 'Le chiffre monte à chaque tour. À 40, il hurle. Il attend un mot. Le vrai.',
    flavor: [
      '* Bip. Le Thermomètre se tient sur sa pointe. Il vacille.',
      '* L\'écran clignote. Il attend que quelqu\'un le lise.',
      '* « Sous la langue », c\'est écrit en tout petit.',
      '* Le chiffre monte. Le Thermomètre, lui, ne bouge pas.',
    ],
    flavorCalm: '* L\'écran affiche le chiffre dont il se souvient. Le Thermomètre attend qu\'on le range.',
    talk: ['Bip.', 'Tu vas bien ?', 'Dis « ça va ». Bip.', 'On ne ment pas à un thermomètre.', 'Bip. Bip. Bip.', 'Encore un peu sous la langue.'],
    reactGood: ['Bip… le chiffre baisse.', 'Ah. Enfin.', 'Bip. Merci de l\'avoir dit.'],
    reactBad: ['BIIIP !', 'Le chiffre monte ! Il monte !'],
    reactNeutral: ['Bip ?', 'Ça ne se mesure pas, ça.', 'Bip. Rien.'],
    reactSpecial: {
      fièvre: 'MEM. 38,4. Je m\'en souviens, moi.',
      tousser: 'Bip. Et la toux ? Bip.',
      'je ne sais pas': 'Moi, je sais. Bip. Je sais toujours.',
      contagieux: 'Ça, je ne le mesure pas. Bip.',
    },
    spareText: '* Le Thermomètre s\'éteint avec un petit bip. Il se range tout seul, comme dans son étui.',
    killText: '* L\'écran se fend. Le dernier chiffre reste allumé un moment. Puis l\'encre l\'efface.',
    patterns: ['thermo_digits', 'thermo_mercury'],
    rewards: { boutons: 16 },
    hooks: THERMO_HOOKS,
    bg: 'blanc',
  },

  gribouille_noire: {
    id: 'gribouille_noire',
    name: 'Gribouille Noire',
    fem: true,
    sprite: 'b_gribouille_noire',
    hp: 14,
    atk: 5,
    def: 0,
    emotion: 'neutre',
    needs: [],
    noInk: true,
    check: 'Ça n\'a pas de cœur. C\'est juste de la peur dessinée.',
    flavor: [
      '* La Gribouille Noire ne bouge pas. Elle grandit quand tu la regardes.',
      '* Ça fait « scritch scritch ». À l\'envers.',
      '* Il n\'y a rien derrière ses yeux. Il n\'y a pas de derrière.',
      '* Elle ressemble au premier Gribouille. En plus noir. En plus vieux.',
    ],
    talk: ['Hctircs.', '…', 'Scr…', 'Personne ne finit jamais rien.', 'Tu vas me gommer ?', '…'],
    reactGood: ['…'],
    reactBad: ['…'],
    reactNeutral: ['…', 'Hctircs.'],
    killText: '* La Gribouille Noire se défait. Ce n\'était pas de l\'encre. Ce n\'était rien.',
    patterns: ['black_scribbles'],
    rewards: { boutons: 0 },
    hooks: NOIRE_HOOKS,
    bg: 'blanc',
  },

  vitre: {
    id: 'vitre',
    name: 'La Vitre',
    fem: true,
    sprite: 'b_vitre',
    hp: 180,
    atk: 6,
    def: 2,
    emotion: 'tristesse',
    needs: [{ emotion: 'tristesse', count: 2 }, { word: 'je ne sais pas' }],
    specialWords: [
      { text: 'je ne sais pas', emotion: 'neutre' },
      { text: 'pardon', emotion: 'tristesse' },
    ],
    check: 'La dernière visite, celle où tu n\'es pas entré. Pleure, puis dis la seule chose vraie.',
    flavor: [
      '* Derrière la vitre, quelqu\'un dessine. Elle ne lève pas la tête.',
      '* Tu respires. La vitre s\'embue. Le dessin disparaît. Tu arrêtes de respirer.',
      '* De l\'autre côté, une petite main efface la buée en rond.',
      '* « Semaine 5 », dit une feuille scotchée sur la porte.',
      '* Le bonnet a des oreilles de mouton. Elles bougent quand elle penche la tête.',
    ],
    flavorCalm: '* La buée ne revient plus. De l\'autre côté, une main attend, à plat contre le verre.',
    talk: ['Toc. Toc.', '…', 'Toc.', '…?', 'Toc. Toc.'],
    reactGood: ['…', '(Toc. Toc.)', '…!'],
    reactBad: ['…', '(Le verre tremble.)'],
    reactNeutral: ['…', '…?'],
    reactSpecial: {
      'deux crayons': '(Elle lève un crayon rouge. Elle attend le tien.)',
      bonnet: '(Elle touche son bonnet. Les oreilles de mouton se plient.)',
      visite: '(Elle montre la porte du doigt. Elle est fermée.)',
      'derrière la vitre': '(Elle pose son front contre le verre. En face du tien.)',
      'je ne sais pas': '…',
    },
    spareText: '* Les deux mains restent l\'une contre l\'autre, de chaque côté du verre. Puis la vitre s\'efface, comme de la buée.',
    killText: '* La vitre éclate en encre. Derrière, il n\'y a qu\'un lit. Le drap est plat.',
    patterns: ['vitre_buee', 'vitre_condensation', 'vitre_fissures'],
    rewards: { boutons: 40 },
    boss: true,
    noFlee: true,
    music: 'vitre',
    hooks: VITRE_HOOKS,
    bg: 'blanc',
    dy: 2,
  },
};

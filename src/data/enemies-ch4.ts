import { audio } from '../engine/audio';
import { W } from '../engine/constants';
import { fx } from '../engine/fx';
import { game } from '../engine/game';
import { rng } from '../engine/math';
import { drawSprite } from '../engine/sprite';
import { tf, tr } from '../i18n';
import { hasSpr, spr } from '../game/assets';
import { agree, type Battle } from '../game/battle/battle';
import type { EnemyRuntime } from '../game/battle/enemy';
import { coneSpan, LIGHT } from '../game/battle/patterns-ch4';
import type { BattleHooks, EnemyDef } from '../game/battle/types';
import { G } from '../game/state';

/*
 * Chapter 4 « La Maison Cousue » — the enemies (docs/HISTOIRE.md § 3.11). Spread into ENEMIES by src/data/enemies.ts.
 *
 * Balance (act II peak; the player has chapter 3 stats, often the « Plume dorée » and the « Cape de Mina »):
 * regular PV 38–46 / ATQ 5, Poupée-Maman cannot fall, La Couseuse PV 150 / ATQ 6, Le Petit Homme PV 200 / ATQ 7.
 *
 * What the story reads after each fight (BattleResult + flags):
 *   - poupee_maman  « merci »: outcome 'spare', and the battle sets flags c4_maman = 'merci'.
 *                   « reste »: outcome 'scripted' (the battle ends at once), flags c4_maman = 'reste', c4_reste = true.
 *                   She cannot be beaten (struck, red thread comes out of her chest and she sews herself back).
 *   - couseuse      spared → outcome 'spare' (then the story plays T3); beaten → 'win' (the needle breaks). The story
 *                   sets c4_couseuse = 'epargnee' | 'vaincue': 'vaincue' freezes Mina n°366 in every later fight.
 *   - petit_homme   spared → 'spare' (arms open, the light falls, the mouth stitches pop); beaten → 'win' (ink and
 *                   stuffing, the nightlight cracks: the story sets c4_fele).
 * Mina n°366 fights at Noa's side when G.state.party includes 'mina366' (src/game/battle/rules.ts allyState).
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

/** The menu button rectangles (see Battle.drawMenu). */
const BUTTON = (i: number) => ({ x: 10 + i * 76, y: 157, w: 72, h: 18 });

/** A menu button sewn shut: a red seam across it, cross-stitches at regular intervals. */
function drawSewnButton(g: CanvasRenderingContext2D, i: number): void {
  const r = BUTTON(i);
  g.fillStyle = '#a8324a';
  g.fillRect(r.x + 2, r.y + 9, r.w - 4, 1);
  g.fillStyle = '#e8505b';
  for (let k = 0; k < 6; k++) {
    const cx = r.x + 6 + k * 12;
    const cy = r.y + 6;
    for (let d = 0; d < 6; d++) {
      g.fillRect(cx + d, cy + d, 1, 1);
      g.fillRect(cx + 5 - d, cy + d, 1, 1);
    }
  }
}

/** A menu button locked by Clé: a chain across it and a padlock. */
function drawLockedButton(g: CanvasRenderingContext2D, i: number, t: number): void {
  const r = BUTTON(i);
  g.fillStyle = '#7d6f86';
  for (let x = r.x + 2; x < r.x + r.w - 2; x += 4) g.fillRect(x, r.y + 9 + (((x >> 2) % 2) as number), 3, 1);
  const px = r.x + r.w / 2 - 4 + (Math.floor(t / 6) % 2);
  g.fillStyle = '#b7aab8';
  g.fillRect(px + 1, r.y + 2, 6, 1);
  g.fillRect(px + 1, r.y + 3, 1, 4);
  g.fillRect(px + 6, r.y + 3, 1, 4);
  g.fillStyle = '#f5c04f';
  g.fillRect(px, r.y + 7, 8, 7);
  g.fillStyle = '#c46a2e';
  g.fillRect(px, r.y + 13, 8, 1);
  g.fillStyle = '#1c1424';
  g.fillRect(px + 3, r.y + 9, 2, 3);
}

/** Loose particles (popped stitches, stuffing, ink) drawn by an overlay. */
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
function drawParts(g: CanvasRenderingContext2D, parts: Part[]): void {
  for (const p of parts) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.12;
    if (p.y > 82) {
      p.y = 82;
      p.vx *= 0.6;
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
// Clé — locks one command of the menu every turn
// ---------------------------------------------------------------------------------------------------------------------

interface CleState {
  locked: number;
  last: number;
  t: number;
}
const cleState = (b: Battle): CleState => state(b, () => ({ locked: -1, last: -1, t: 0 }));

const CLE_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = cleState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) {
      b.overlay = (g) => {
        s.t++;
        if (s.locked >= 0) drawLockedButton(g, s.locked, s.t);
      };
    }
    if (s.locked >= 0) b.menuDisabled[s.locked] = false;
    s.locked = -1;
    if (!e.alive || e.spareable) return;
    // Never the same button twice in a row; ÉCRIRE not on the first turn.
    const options = [0, 1, 2, 3].filter((i) => i !== s.last && !(i === 1 && turn < 2));
    const i = rng.pick(options);
    s.locked = i;
    s.last = i;
    b.menuDisabled[i] = true;
    audio.sfx('knock1', { pitch: 2.2, vol: 0.7 });
    await b.say(tf('* Clac. Clé verrouille {0}.', tr(b.menuLabels[i] ?? '')));
  },
  async onWord(b, e, w) {
    if (w.text === 'ouvrir' && !e.spareable) {
      await b.bubble([{ e, text: 'Ouvrir ? Pas comme ça. Tu ne sais même pas ce qu\'il y a derrière.' }]);
      await b.say(tf('* {0} se crispe dans la serrure.', e.name));
      return true;
    }
    return false;
  },
  async onAlly(b) {
    const s = cleState(b);
    if (s.locked < 0) return false;
    const i = s.locked;
    b.menuDisabled[i] = false;
    s.locked = -1;
    audio.sfx('knock1', { pitch: 1.6, vol: 0.6 });
    await b.allySay('C\'est moi qui ai la clé ! {p:30}…Non. C\'est toi.', tf('* Mina n°366 décroche le cadenas. {0} est libre.', tr(b.menuLabels[i] ?? '')));
    return true;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Poupée-Maman — the dinner loop. « merci » (her real sentence) or « reste » (Dodo's word). She cannot fall.
// ---------------------------------------------------------------------------------------------------------------------

interface MamanState {
  hits: number;
  lastHp: number;
  told: boolean;
  allyOnce: boolean;
  t: number;
}
const mamanState = (b: Battle): MamanState => state(b, () => ({ hits: 0, lastHp: -1, told: false, allyOnce: false, t: 0 }));

/** The red thread out of her chest: from where she was struck down to the floor, pooling longer at each blow. */
function drawThread(g: CanvasRenderingContext2D, e: EnemyRuntime, s: MamanState): void {
  if (!s.hits) return;
  s.t++;
  const cx = e.x + 3;
  const top = e.y - 40;
  g.fillStyle = '#e8505b';
  if (!e.hidden && !e.spared) {
    for (let y = top; y < 83; y++) {
      const sway = Math.round(Math.sin(y * 0.35 + s.t * 0.05) * (y - top) * 0.04);
      g.fillRect(cx + sway, y, 1, 1);
    }
  }
  // The pool of thread on the floor: loops, longer with every blow.
  const len = Math.min(110, s.hits * 16);
  g.fillStyle = '#a8324a';
  for (let i = 0; i < len; i++) {
    const x = cx + i;
    const y = 82 + Math.round(Math.sin(i * 0.7) * 1.2);
    g.fillRect(x, y, 1, 1);
    if (i % 9 === 4) {
      g.fillStyle = '#e8505b';
      g.fillRect(x - 1, y - 2, 3, 1);
      g.fillRect(x - 1, y - 1, 1, 1);
      g.fillRect(x + 1, y - 1, 1, 1);
      g.fillStyle = '#a8324a';
    }
  }
}

async function resteEnding(b: Battle, e: EnemyRuntime): Promise<void> {
  G.state.flags.c4_maman = 'reste';
  G.state.flags.c4_reste = true;
  audio.sfx('stitch', { pitch: 0.7 });
  e.hidden = false;
  await b.bubble([{ e, text: 'Hmm-hmm. Hmm-hmm.' }]);
  await b.say('* La Poupée-Maman se rassoit. Elle reprend sa fourchette.\n* Elle ne se relèvera plus jamais de table.');
  if (b.ally === 'mina366') await b.allySay('On reste ? D\'accord. {p:30}D\'accord.');
  await b.say(tf('{c:#fffaf2}Dodo :{/c} {0}', tr('Tu vois ? Tout le monde peut rester.')), false, true, 'dodo');
  b.end('scripted');
}

const MAMAN_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = mamanState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) {
      s.lastHp = e.hp;
      b.backdrop = (g) => drawThread(g, e, s);
    }
    // Between turns, she steps out of the box and sits back at her place.
    e.hidden = false;
    if (s.hits && !s.told) {
      s.told = true;
      await b.say('* Là où tu as frappé, un fil rouge sort de sa poitrine. Il s\'enroule par terre.\n* Elle ne tombe pas. Elle ne tombe jamais.');
    }
  },
  pattern(b, turn) {
    const e = b.enemies[0];
    // She walks into the box to serve (the little figure among the plates): her chair stays empty.
    if (e) e.hidden = true;
    return turn % 2 ? 'slow_plates' : 'four_plates';
  },
  talk(b) {
    const s = mamanState(b);
    const e = b.enemies[0];
    if (!e) return null;
    if (s.lastHp >= 0 && e.hp < s.lastHp) {
      // Struck: she sews herself back on, and says the only sentence she has left.
      s.hits++;
      e.hp = e.maxHp;
      s.lastHp = e.hp;
      audio.sfx('thread', { pitch: 0.7 });
      return 'Il y a des pâtes.';
    }
    s.lastHp = e.hp;
    return null;
  },
  async onDeath(_b, e) {
    // She cannot fall: the thread holds her up.
    e.hp = 1;
    return true;
  },
  async onWord(b, e, w) {
    if (w.text === 'reste') {
      await resteEnding(b, e);
      return true;
    }
    if (w.text === 'merci') {
      if (!e.spareable) {
        await b.bubble([{ e, text: 'Il y a des pâtes.' }]);
        await b.say('* Le mot glisse sur les points de sa bouche. Pas encore.\n* Elle n\'a pas fini de servir.');
        return true;
      }
      audio.sfx('thread');
      await b.bubble([{ e, text: 'Mmh… M… merci.{p:30} Merci, mon grand.' }]);
      await b.say('* Un point de sa bouche saute. Puis un autre.\n* Elle pose la louche.');
      await b.say(tf("* {c:y}{0} est {1}.{/c} Tu peux l'épargner.", e.name, agree(e, 'apaisé')));
      return true;
    }
    return false;
  },
  async onSpare() {
    G.state.flags.c4_maman = 'merci';
    return false;
  },
  async onAlly(b) {
    const s = mamanState(b);
    if (s.allyOnce) return false;
    s.allyOnce = true;
    b.prepareDodge({ shield: 3 });
    audio.sfx('stitch', { pitch: 1.3 });
    await b.allySay('Mange, sinon elle recommence. {p:30}…Elle recommence.', tr('* Mina n°366 pose un dé à coudre sur ton cœur (3 coups).'));
    return true;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// La Couseuse — sews the menu buttons shut; every written word pulls a thread and unsews one
// ---------------------------------------------------------------------------------------------------------------------

interface CouseuseState {
  sewn: number[];
  afraid: boolean;
  first: boolean;
}
const couseuseState = (b: Battle): CouseuseState => state(b, () => ({ sewn: [], afraid: false, first: true }));
/** OBJET, then ÉPARGNER, then FRAPPER. Never ÉCRIRE: writing is what unsews. */
const SEW_ORDER = [2, 3, 0];

const COUSEUSE_AFRAID_TALK = [
  'Ne tire pas sur le fil. Ne tire pas.',
  'Si tu défais, il faudra tout refaire. Demain. Et après-demain.',
  'Il n\'y a plus assez de coton.',
  'Elle se défait toujours au même endroit. Toujours.',
];

async function unsew(b: Battle, s: CouseuseState): Promise<number> {
  const i = s.sewn.pop() ?? -1;
  if (i >= 0) {
    b.menuDisabled[i] = false;
    audio.sfx('thread');
  }
  return i;
}

const COUSEUSE_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = couseuseState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) b.overlay = (g) => s.sewn.forEach((i) => drawSewnButton(g, i));
    if (!e.alive) return;
    if (!s.afraid && e.step >= 1) {
      s.afraid = true;
      if (!e.spareable) e.emotion = 'peur';
      audio.sfx('stitch', { pitch: 0.5 });
      await b.say('* La Couseuse s\'arrête de piquer. Ses yeux-boutons tremblent.\n* Pour la première fois, elle a peur de ce que tu vas défaire.');
    }
    if (turn >= 2 && !e.spareable && s.sewn.length < SEW_ORDER.length) {
      const i = SEW_ORDER.find((k) => !s.sewn.includes(k))!;
      s.sewn.push(i);
      b.menuDisabled[i] = true;
      for (let k = 0; k < 4; k++) window.setTimeout(() => audio.sfx('stitch', { pitch: 1 + k * 0.08 }), k * 90);
      fx.shake(1, 6);
      const label = tr(b.menuLabels[i] ?? '');
      if (s.first) {
        s.first = false;
        await b.say(tf('* Tac-tac-tac-tac. La Couseuse coud le bouton {0}.\n* Un mot écrit tire sur le fil.', label));
      } else await b.say(tf('* Tac-tac-tac-tac. La Couseuse coud le bouton {0}.', label));
    }
  },
  pattern(b, turn) {
    const s = couseuseState(b);
    const e = b.enemies[0];
    const afraid = s.afraid || (!!e && e.hp <= e.maxHp / 2);
    if (afraid) return turn % 2 ? 'stitch_cage' : 'needle_pin';
    return turn % 2 ? 'stitch_walls' : 'needle_pin';
  },
  talk(b) {
    const s = couseuseState(b);
    const e = b.enemies[0];
    if (!e || e.spareable || !s.afraid) return null;
    return rng.pick(COUSEUSE_AFRAID_TALK);
  },
  async onWord(b, e, w) {
    const s = couseuseState(b);
    const i = await unsew(b, s);
    if (i >= 0) await b.say(tf('* Ton mot tire sur le fil. Le bouton {0} se découd.', tr(b.menuLabels[i] ?? '')));
    if (w.text === 'découdre' && !e.spareable) {
      await b.bubble([{ e, text: 'Découdre ? Tu ne sais même pas ce que je couds.' }]);
      await b.say('* Le fil résiste. Elle n\'est pas prête à défaire son ouvrage.');
      return true;
    }
    return false;
  },
  async onAlly(b) {
    const s = couseuseState(b);
    if (!s.sewn.length) return false;
    const i = await unsew(b, s);
    await b.allySay(
      'Attends, je découds. Je sais faire. {p:30}…Je sais faire.',
      tf('* Mina n°366 tire le fil avec ses doigts de feutre. Le bouton {0} se découd.', tr(b.menuLabels[i] ?? '')),
    );
    return true;
  },
  async onDeath() {
    audio.sfx('shatter', { vol: 0.7 });
    fx.shake(3, 12);
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Le Petit Homme de la Maison — phase 1 (anger): doors and noodles; phase 2 (fear): the black arena, only the cone of
// the nightlight he holds shows what is coming.
// ---------------------------------------------------------------------------------------------------------------------

interface HommeState {
  phase: 1 | 2;
  dark: number;
  darkTarget: number;
  i: number;
  open: boolean;
  lampY: number;
  lampVy: number;
  cracked: boolean;
  parts: Part[];
  t: number;
}
const hommeState = (b: Battle): HommeState =>
  state(b, () => ({ phase: 1, dark: 0, darkTarget: 0, i: 0, open: false, lampY: -1, lampVy: 0, cracked: false, parts: [], t: 0 }));

/** Height of the nightlight above the boss's feet (where he holds it against his chest). */
const LAMP_DY = 30;

const HOMME_DARK_FLAVOR = [
  '* Il fait noir. Il n\'y a que la lumière qu\'il tient.',
  '* Quelque part, trois coups dans le mur. Personne ne répond.',
  '* Tu entends sa respiration à travers les points de sa bouche.',
  '* La veilleuse tremble. Lui aussi.',
  '* Sous une porte, très loin, un trait de lumière. Puis plus rien.',
];
const HOMME_DARK_TALK = [
  'Il fait noir. Il fait trop noir.',
  'T\'es là ? …T\'es là ?',
  'Si je la lâche, il n\'y a plus rien.',
  'Chut. Je dors. Je dors.',
  'Elle est à moi. Elle a toujours été à moi.',
];

/** The black arena around the boss: everything dark but a halo round the lamp and the cone it throws down. */
function drawHommeDark(g: CanvasRenderingContext2D, e: EnemyRuntime, s: HommeState): void {
  s.t++;
  s.dark += (s.darkTarget - s.dark) * (G.settings.reduceFlashes ? 0.012 : 0.035);
  // Once it has fallen, the light comes from the floor, where the nightlight lies.
  const fallen = s.lampY >= 0;
  const lx = fallen ? e.x + 16 : e.x;
  const ly = fallen ? s.lampY - 6 : e.y - LAMP_DY;
  LIGHT.ax = lx;
  LIGHT.ay = ly;
  if (s.dark < 0.02) return;
  const flicker = G.settings.reduceFlashes ? 0 : Math.sin(s.t * 0.7) * 1.2;
  const halo = (fallen ? 12 : 17) + flicker;
  for (let y = 0; y < 84; y += 2) {
    const dy = y - ly;
    const h = Math.abs(dy) < halo ? Math.sqrt(halo * halo - dy * dy) : -1;
    let l = h >= 0 ? lx - h : W;
    let r = h >= 0 ? lx + h : -1;
    if (dy > 0 && !fallen) {
      const [cl, cr] = coneSpan(y);
      l = Math.min(l, cl);
      r = Math.max(r, cr);
    }
    g.globalAlpha = 0.93 * s.dark;
    g.fillStyle = '#000000';
    if (r < l) g.fillRect(0, y, W, 2);
    else {
      g.fillRect(0, y, Math.max(0, Math.round(l)), 2);
      g.fillRect(Math.round(r), y, W - Math.round(r), 2);
      // Dithered edge, and a warm glow inside.
      g.globalAlpha = 0.5 * s.dark;
      g.fillRect(Math.round(l) + ((y >> 1) % 2), y, 2, 1);
      g.fillRect(Math.round(r) - 2 - ((y >> 1) % 2), y + 1, 2, 1);
      g.globalAlpha = 0.07 * s.dark;
      g.fillStyle = '#ffe991';
      g.fillRect(Math.round(l), y, Math.round(r - l), 2);
    }
  }
  g.globalAlpha = 1;
}

/** Overlay: the nightlight falling (spared) or lying cracked (beaten), popped stitches, stuffing and ink. */
function drawHommeOverlay(g: CanvasRenderingContext2D, e: EnemyRuntime, s: HommeState): void {
  if (s.lampY >= 0) {
    s.lampVy += 0.25;
    s.lampY = Math.min(82, s.lampY + s.lampVy);
    if (s.lampY >= 82 && s.lampVy > 1) {
      s.lampVy = 0;
      audio.sfx('knock1', { pitch: 1.4, vol: 0.5 });
    }
    const key = s.cracked ? 'b_c4_veilleuse_fele' : 'b_c4_veilleuse';
    if (hasSpr(key)) drawSprite(g, spr(key), e.x + 16, Math.round(s.lampY));
  }
  drawParts(g, s.parts);
}

async function toDark(b: Battle, e: EnemyRuntime, s: HommeState): Promise<void> {
  s.phase = 2;
  audio.sfx('door', { pitch: 0.5 });
  fx.shake(2, 10);
  s.darkTarget = 1;
  await b.say('* La veilleuse vacille. Une à une, toutes les lumières de la maison s\'éteignent.\n* Il ne reste que la sienne.');
  b.bgKind = 'noir';
  if (!e.spareable) e.emotion = 'peur';
  e.def = { ...e.def, flavor: HOMME_DARK_FLAVOR };
}

const HOMME_HOOKS: Partial<BattleHooks> = {
  async beforeTurn(b, turn) {
    const s = hommeState(b);
    const e = b.enemies[0];
    if (!e) return;
    if (turn === 1) {
      b.backdrop = (g) => drawHommeDark(g, e, s);
      b.overlay = (g) => drawHommeOverlay(g, e, s);
    }
    if (e.alive && s.phase === 1 && (e.step >= 1 || e.hp <= e.maxHp / 2)) await toDark(b, e, s);
  },
  pattern(b, turn) {
    const s = hommeState(b);
    if (s.phase === 1) return turn % 2 ? 'doors_slam' : 'noodle_rain';
    return ['dark_noodles', 'dark_doors', 'dark_knocks'][s.i++ % 3]!;
  },
  talk(b) {
    const s = hommeState(b);
    const e = b.enemies[0];
    if (!e || e.spareable || s.phase === 1) return null;
    return rng.pick(HOMME_DARK_TALK);
  },
  async onWord(b, e, w) {
    if (w.text === 'rendre' && !e.spareable) {
      await b.bubble([{ e, text: 'NON. Pas encore. Il fait trop noir.' }]);
      await b.say('* Ses bras se resserrent sur la lumière. Les points tirent.');
      return true;
    }
    return false;
  },
  async onAlly(b) {
    const s = hommeState(b);
    if (s.phase !== 2) return false;
    b.prepareDodge({ mem: { light: 1 } });
    audio.sfx('chime', { pitch: 1.4, vol: 0.5 });
    await b.allySay(
      'Je te brode un fil de lumière. Comme ça, tu vois où tu marches. {p:30}…Où tu marches.',
      tr('* Un fil doré s\'allume dans le noir : le cône de la veilleuse s\'élargit.'),
    );
    return true;
  },
  async onSpare(b, e) {
    const s = hommeState(b);
    // His arms open, the light falls, the stitches of his mouth pop one by one.
    audio.sfx('thread', { pitch: 0.8 });
    await b.say('* Ses bras tirent sur les points. Un point saute. Puis un autre.');
    s.open = true;
    e.def = { ...e.def, sprite: 'b_petit_homme_open' };
    s.lampY = e.y - LAMP_DY;
    s.lampVy = -1;
    s.darkTarget = 0.55;
    audio.sfx('thread', { pitch: 1.1 });
    await b.say('* Ses bras s\'ouvrent. La lumière tombe.');
    for (let k = 0; k < 4; k++) {
      audio.sfx('stitch', { pitch: 1.4 + k * 0.12 });
      for (let n = 0; n < 3; n++) s.parts.push({ x: e.x - 5 + k * 3, y: e.y - 62, vx: rng.range(-0.8, 0.8), vy: -rng.range(0.6, 1.4), life: 60, color: '#e8505b', size: 1 });
      await game.wait(20);
    }
    await b.bubble([{ e, text: 'J\'avais peur du noir.{p:30} Moi.{p:30} Pas elle.' }]);
    return false;
  },
  async onDeath(b, e) {
    const s = hommeState(b);
    // He bursts into ink and stuffing; the nightlight rolls away, cracked.
    audio.sfx('shatter');
    fx.shake(4, 16);
    for (let n = 0; n < 40; n++) {
      const a = rng.range(0, Math.PI * 2);
      const sp = rng.range(0.6, 2.4);
      const tuft = n % 3 !== 0;
      s.parts.push({ x: e.x, y: e.y - 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: tuft ? rng.int(240, 420) : rng.int(60, 140), color: tuft ? '#fffaf2' : '#0b0710', size: tuft ? 2 : 1 });
    }
    s.cracked = true;
    s.lampY = e.y - LAMP_DY;
    s.lampVy = -2;
    s.darkTarget = 0.85;
    return false;
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------------------------------------------------

export const CH4_ENEMIES: Record<string, EnemyDef> = {
  pate_froide: {
    id: 'pate_froide',
    name: 'Pâte Froide',
    fem: true,
    sprite: 'b_pate_froide',
    hp: 40,
    atk: 5,
    def: 1,
    emotion: 'tristesse',
    needs: [{ emotion: 'tristesse', count: 2 }],
    hates: ['joie'],
    check: 'Une assiette oubliée sur la table depuis des nuits. Ne lui souris pas. Assieds-toi avec elle, c\'est tout.',
    flavor: [
      '* Pâte Froide avance sur ses pattes de fourchette. Tic. Tic. Tic.',
      '* Une moisissure de papier bleuit sur ses bords.',
      '* Ça sent le frigo resté ouvert trop longtemps.',
      '* Un mot du frigo est collé dessous : « Il y a des pâtes. »',
      '* Les pâtes sont un peu plus grises qu\'avant. Tu en es sûr.',
    ],
    flavorCalm: '* Pâte Froide ne marche plus. Elle attend qu\'on finisse l\'assiette. Ou pas.',
    talk: [
      'Il y a des pâtes.',
      'Réchauffe-moi. …Non. Laisse.',
      'Mange. Sinon personne ne le fera.',
      'Je suis là depuis la première nuit.',
      'Tu manges debout ? Comme d\'habitude.',
      'Il y a des pâtes. Il y a toujours des pâtes.',
    ],
    reactGood: ['…Oui. Froid. C\'est ça.', 'Tu t\'assois ? Personne ne s\'assoit.', 'Mmh. Moins seule, comme ça.'],
    reactBad: ['Arrête de sourire la bouche pleine.', 'Trop chaud ! Ça brûle !', 'Ne fais pas semblant que c\'est bon.'],
    reactNeutral: ['Il y a des pâtes.', '…', 'Fourchette. Fourchette.'],
    reactSpecial: {
      pâtes: 'Tu dis mon nom comme lui. La bouche pleine.',
      'mot du frigo': 'Je suis écrite dessus. « Il y a des pâtes. »',
      reste: 'Rester. Oui. Jusqu\'à moisir.',
      merci: '…Personne ne m\'a jamais dit merci.',
    },
    spareText: '* Pâte Froide va se coucher dans l\'assiette « à personne ». Elle y tient tout juste.',
    killText: '* Pâte Froide se répand en une encre grise. Ça sent le frigo.',
    patterns: ['noodle_rain', 'mold_spores'],
    rewards: { boutons: 14 },
    bg: 'stylo',
  },

  mot_aimante: {
    id: 'mot_aimante',
    name: 'Mot Aimanté',
    sprite: 'b_mot_aimante',
    hp: 38,
    atk: 5,
    def: 1,
    emotion: 'colere',
    needs: [{ emotion: 'colere' }, { emotion: 'joie', count: 2 }],
    check: 'Un dentier de farces et attrapes, aimanté au frigo. Il mâche les mots. Grince des dents avec lui d\'abord. Ensuite, parle-lui de quelque chose de doux.',
    flavor: [
      '* Mot Aimanté claque des dents. Clac-clac-clac.',
      '* Entre ses dents, des lettres en plastique : un T, un A, un I…',
      '* Il mâchonne un post-it jaune. Il n\'en reste que « …ce soir. Bisous. »',
      '* Sa clé de remontoir tourne toute seule, dans son dos.',
      '* Il y a de la salive d\'encre sur la porte du frigo.',
    ],
    flavorCalm: '* Mot Aimanté a la mâchoire fatiguée. Il garde quelque chose dans la bouche.',
    talk: [
      'Clac ! Clac ! Clac !',
      'Je mange les mots. Comme ça, plus personne ne ment.',
      '« Elle va mieux. » Miam.',
      '« Je rentre tard. » « Je rentre tard. » « Je rentre tard. »',
      'Tu veux le dernier mot ? Viens le chercher.',
      'Les aimants, ça tient. Pas les gens.',
    ],
    reactGood: ['CLAC ! Oui ! Mords !', 'Grrr… ça fait du bien, hein ?', 'Je… je mâche moins vite.'],
    reactBad: ['Clac. Tu parles comme un post-it.', 'Je vais te mâcher aussi !'],
    reactNeutral: ['Pas de goût.', 'Clac ?', 'Ça, ça ne tient pas sur un frigo.'],
    reactSpecial: {
      'mot du frigo': 'C\'est mon repas. Rends-le-moi. …Non. Garde-le.',
      pâtes: '« Il y a des pâtes. » Je l\'ai mangé quarante fois.',
      menteuse: 'CLAC ! Oui ! Menteuse ! …Elle dessinait des cœurs, pourtant.',
      merci: 'Merci ? Ça, personne ne l\'a jamais écrit sur le frigo.',
      reste: 'Je reste collé. Toujours. C\'est mon travail.',
    },
    spareText: '* Mot Aimanté recrache ce qu\'il gardait : des lettres mâchouillées, collées de travers. « JE T\'AIME ». Puis il se laisse tomber du frigo.',
    killText: '* Mot Aimanté avale le dernier mot. Tu ne sauras jamais lequel c\'était.',
    patterns: ['magnet_letters', 'chatter_teeth'],
    rewards: { boutons: 15 },
    bg: 'stylo',
  },

  de_chevalier: {
    id: 'de_chevalier',
    name: 'Dé-Chevalier',
    sprite: 'b_de_chevalier',
    hp: 42,
    atk: 5,
    def: 2,
    emotion: 'colere',
    needs: [{ emotion: 'tristesse', count: 3 }],
    check: 'Un dé à coudre en armure, une épingle pour lance. Il protège un doigt et rien d\'autre, et il le sait. Sous le métal, du chagrin.',
    flavor: [
      '* Dé-Chevalier brandit son épingle. Elle tremble.',
      '* « Je protège le doigt. » Il le répète pour s\'en convaincre.',
      '* Son casque est criblé de petits trous. Comme une passoire. Comme une armure.',
      '* Au bout de son épingle, une goutte d\'encre rouge. Une seule.',
    ],
    flavorCalm: '* Dé-Chevalier baisse son épingle. Il ne protège plus rien. Il a l\'air soulagé.',
    talk: [
      'Je protège le doigt. Pas le reste.',
      'En garde ! …C\'est comme ça qu\'on dit ?',
      'Une chevalière m\'a nommé. Je ne sais plus laquelle.',
      'Le doigt ne saignera pas. Le reste, ce n\'est pas mon travail.',
      'Pique ! Pique ! Pique !',
    ],
    reactGood: ['…Le reste aussi, j\'aurais dû le protéger.', 'Mon armure… elle est trop petite.', 'Tu as mal aussi ? Là, au reste ?'],
    reactBad: ['Je ne suis pas là pour le reste !', 'En garde !'],
    reactNeutral: ['Pas compris. Pique ?', '…En garde ?'],
    reactSpecial: {
      reste: 'Le reste… Je ne protège pas le reste.',
      merci: 'Merci ? Je n\'ai protégé qu\'un doigt.',
      découdre: 'Découdre, c\'est pas mon métier. Moi, je pique.',
      'mot du frigo': 'Il est trop loin du doigt. Je ne peux pas le protéger.',
    },
    spareText: '* Dé-Chevalier se pose sur la table, à l\'envers, comme un tout petit bol. Il ne protège plus personne. Il dort.',
    killText: '* Dé-Chevalier roule sous un meuble. On l\'entend tourner longtemps. Puis plus du tout.',
    patterns: ['pin_rain', 'pin_lance'],
    rewards: { boutons: 15 },
    bg: 'feutre',
  },

  poupee_brouillon: {
    id: 'poupee_brouillon',
    name: 'Poupée Brouillon',
    fem: true,
    sprite: 'b_poupee_brouillon',
    hp: 38,
    atk: 5,
    def: 1,
    emotion: 'peur',
    needs: [{ emotion: 'tristesse', count: 2 }],
    hates: ['joie'],
    check: 'Une poupée pas finie, en feutre blanc. Pas de visage, pas de nom. Elle ne supporte pas les sourires. Sois triste avec elle.',
    flavor: [
      '* Poupée Brouillon n\'a pas de visage. Elle te regarde quand même.',
      '* Des épingles tiennent encore ses bras en place.',
      '* Un trait de craie fait le tour de son cou. « Couper ici. »',
      '* Elle gribouille l\'air autour d\'elle, comme pour se dessiner une forme.',
      '* Dans son dos, une étiquette vide. Quelqu\'un a commencé à écrire, puis s\'est arrêté.',
    ],
    flavorCalm: '* Poupée Brouillon s\'est assise. Elle tient sa tête vide entre ses mains.',
    talk: [
      'Arrête de sourire comme lui.',
      'Qui je devais être ? Tu sais, toi ?',
      'On m\'a commencée un soir. Puis il y a eu le matin.',
      'Dessine-moi une bouche. Non. Pas celle-là.',
      'Je suis un brouillon. On jette les brouillons.',
    ],
    reactGood: ['…Oui. Comme ça. Pas de sourire.', 'Tu ne sais pas non plus qui tu es ?', 'Mes épingles… elles piquent moins.'],
    reactBad: ['Arrête de sourire comme lui.', 'NON. Pas de sourire. Pas sur moi.', 'Tu me dessines une bouche ? ARRÊTE.'],
    reactNeutral: ['…', 'Brouillon. Brouillon.', 'Ça ne me donne pas de visage.'],
    reactSpecial: {
      reste: 'Rester pas finie ? Pour toujours ?',
      merci: 'Merci de quoi ? Je ne suis personne.',
      'mot du frigo': 'Il n\'y a pas mon nom dessus.',
    },
    spareText: '* Poupée Brouillon enlève ses épingles une à une. « Je devais être quelqu\'un. Je ne sais plus qui. » Elle s\'assoit dans un coin, et attend qu\'on la finisse.',
    killText: '* Poupée Brouillon se défait en un long fil blanc. Il n\'y avait rien dedans. Même pas du coton.',
    patterns: ['scribble_box', 'chalk_lines'],
    rewards: { boutons: 16 },
    bg: 'feutre',
    inflict: 'peur',
  },

  cle: {
    id: 'cle',
    name: 'Clé',
    fem: true,
    sprite: 'b_cle',
    hp: 40,
    atk: 5,
    def: 2,
    emotion: 'peur',
    needs: [{ emotion: 'tristesse' }, { word: 'ouvrir' }],
    specialWords: [{ text: 'ouvrir', emotion: 'joie' }],
    check: 'Une clé qui tremble dans une serrure bien trop grande pour elle. Elle verrouille tout ce qu\'elle touche. Avant de lui demander d\'ouvrir, dis-lui que tu comprends.',
    flavor: [
      '* Clé tremble. Cling-cling-cling contre la serrure.',
      '* Elle tourne d\'un quart de tour. Elle revient. Elle n\'ose pas.',
      '* Derrière elle, une porte d\'entrée. Devant, des chaussures, lacées.',
      '* Son anneau est trop grand pour un doigt d\'enfant.',
    ],
    flavorCalm: '* Clé ne tremble plus. Elle attend que quelqu\'un tourne.',
    talk: [
      'Fermé. Fermé. Fermé.',
      'Si j\'ouvre, il faudra sortir.',
      'Tu as mis tes chaussures. Tu les as depuis une heure.',
      'Dehors, il y a l\'hôpital. Dedans, il y a des pâtes.',
      'Je suis trop petite pour cette porte.',
      'Tu viens demain. Tu viens demain. Tu viens demain.',
    ],
    reactGood: ['…Tu as peur aussi ? De la porte ?', 'Cling… cling…', 'Personne ne m\'avait dit que c\'était lourd, une porte.'],
    reactBad: ['FERMÉ !', 'Tu veux sortir ? Tu ne sortiras pas.'],
    reactNeutral: ['Ce mot n\'a pas la bonne forme.', 'Cling ?', 'Ça ne rentre pas dans la serrure.'],
    reactSpecial: {
      ouvrir: 'Ouvrir… Ouvrir. D\'accord. Mais c\'est toi qui sors.',
      reste: 'Rester. Oui. C\'est plus facile, rester.',
      merci: 'Ne me remercie pas. Je n\'ai rien ouvert.',
    },
    spareText: '* Clé tourne, enfin. Clac. La porte d\'entrée s\'entrouvre sur un palier noir.\n* Personne ne sort.',
    killText: '* Clé se tord dans la serrure et casse net. La moitié reste dedans.',
    patterns: ['tumblers', 'key_turn'],
    rewards: { boutons: 15 },
    bg: 'stylo',
    hooks: CLE_HOOKS,
  },

  poupee_maman: {
    id: 'poupee_maman',
    name: 'Poupée-Maman',
    fem: true,
    sprite: 'b_poupee_maman',
    hp: 60,
    atk: 5,
    def: 2,
    emotion: 'neutre',
    needs: [{ emotion: 'tristesse' }, { word: 'merci' }],
    specialWords: [
      { text: 'merci', emotion: 'joie' },
      { text: 'reste', emotion: 'neutre' },
    ],
    check: 'Maman, en feutre : un sourire cousu, un téléphone cousu dans la main. Elle sert, elle ressert. Sous les points, il reste sa vraie phrase. Il y a aussi un mot plus facile, qui ne demande rien.',
    flavor: [
      '* La Poupée-Maman sert. Elle ressert. Les assiettes ne se vident pas.',
      '* Le téléphone cousu dans sa main ne sonne pas. Elle le regarde quand même.',
      '* Les points de sa bouche sont un peu plus serrés qu\'au tour d\'avant.',
      '* La table est mise pour quatre. Une assiette est à personne.',
      '* Les pâtes sont un peu plus grises.',
    ],
    flavorCalm: '* La Poupée-Maman a posé la louche. Elle attend quelque chose. Un mot.',
    talk: ['Il y a des pâtes.', 'Il y a des pâtes.', 'Mange, mon grand.', 'Je rentre tard. Il y a des pâtes.', 'T\'es grand, tu te débrouilles, hein ?', 'Hmmmm. Hmm-hmm.'],
    reactGood: ['…', 'Hm.', '…Mon grand.'],
    reactBad: ['Il y a des pâtes.'],
    reactNeutral: ['Il y a des pâtes.', 'Mange.'],
    spareText: '* La Poupée-Maman pose le téléphone sur la table. Pour la première fois, elle a les mains vides.\n* Elle les regarde longtemps.',
    patterns: ['slow_plates', 'four_plates'],
    rewards: { boutons: 12 },
    noFlee: true,
    bg: 'feutre',
    music: 'dodo',
    hooks: MAMAN_HOOKS,
  },

  couseuse: {
    id: 'couseuse',
    name: 'La Couseuse',
    fem: true,
    sprite: 'b_couseuse',
    hp: 150,
    atk: 6,
    def: 3,
    emotion: 'colere',
    needs: [{ emotion: 'tristesse', count: 2 }, { word: 'découdre' }],
    specialWords: [{ text: 'découdre', emotion: 'colere' }],
    check: 'Une machine à coudre à tête de mouton. Elle recoud quelqu\'un tous les soirs, au même endroit. Sa colère, c\'est de la peur. Pleure avec elle, puis demande-lui de défaire.',
    flavor: [
      '* La Couseuse pique, pique, pique. Le bruit ne s\'arrête jamais.',
      '* Sa tête de mouton fixe tes coutures de ses yeux-boutons dépareillés.',
      '* Une bobine de fil rouge se dévide toute seule. Elle est presque vide.',
      '* Ça sent l\'huile de machine et le coton chaud.',
      '* Sur son socle, quelqu\'un a gravé des bâtons. Beaucoup de bâtons.',
    ],
    flavorCalm: '* La Couseuse a levé le pied. L\'aiguille tremble, en l\'air.',
    talk: [
      'Tiens-toi droit. Je couds.',
      'Une par nuit. Une par nuit. Une par nuit.',
      'Elle se défait toujours au même endroit.',
      'Ne bouge pas, ou je couds de travers.',
      'Tu n\'aurais pas dû monter ici.',
    ],
    reactGood: ['…Tu pleures ? Le fil va être mouillé.', 'Ma bobine… elle tremble.', 'Moi aussi, j\'en ai assez. Assez de coudre.'],
    reactBad: ['Je te couds la bouche, à toi aussi !', 'ON NE DÉFAIT PAS MON OUVRAGE.'],
    reactNeutral: ['Ce n\'est pas du fil, ça.', 'Tac-tac-tac.', 'Pas le temps. Je couds.'],
    reactSpecial: {
      découdre: 'Découdre… Défaire tout ce que j\'ai cousu ? …Toutes ces nuits ?',
      reste: 'Rester. Oui. C\'est ce que je couds.',
      merci: 'Personne ne remercie une machine.',
      'mot du frigo': 'Je les ai tous lus. Je les couds dans la doublure.',
    },
    spareText: '* La Couseuse lève l\'aiguille. Le fil rouge se détend.\n* Pour la première fois depuis très longtemps, la machine se tait.',
    killText: '* L\'aiguille de La Couseuse casse net. La machine tousse, grince, s\'arrête.\n* « Alors personne ne la recoudra. »',
    patterns: ['stitch_walls', 'needle_pin'],
    rewards: { boutons: 45 },
    boss: true,
    noFlee: true,
    bg: 'feutre',
    music: 'couseuse',
    hooks: COUSEUSE_HOOKS,
  },

  petit_homme: {
    id: 'petit_homme',
    name: 'Le Petit Homme',
    sprite: 'b_petit_homme',
    hp: 200,
    atk: 7,
    def: 4,
    emotion: 'colere',
    needs: [{ emotion: 'peur' }, { emotion: 'tristesse', count: 2 }, { word: 'rendre' }],
    specialWords: [{ text: 'rendre', emotion: 'tristesse' }],
    check: 'Une poupée-Noa géante, en tablier de Maman, la bouche cousue. Ses bras sont cousus à sa poitrine, autour de la veilleuse allumée. Il crie parce qu\'il ne peut pas dire de quoi il a peur.',
    flavor: [
      '* Le Petit Homme serre la veilleuse. Ses bras sont cousus autour.',
      '* Les portes de la maison claquent toutes seules. Il ne sursaute même plus.',
      '* Le tablier est trop grand pour lui. Il a fait un double nœud.',
      '* Derrière lui, des assiettes sales, empilées jusqu\'au plafond.',
      '* La lumière de la veilleuse passe entre les points de sa poitrine.',
    ],
    flavorCalm: '* Le Petit Homme ne serre plus si fort. La lumière tremble entre ses bras.',
    talk: [
      'MA lumière.',
      'Je suis grand. Je me débrouille.',
      'Pose-la dans l\'entrée. Pose-la dans l\'entrée. Non.',
      'Il y a des pâtes. J\'ai mangé les pâtes.',
      'Ne touche pas. Elle est à moi.',
    ],
    reactGood: ['…Ne le dis à personne.', 'Mes bras… ils tirent sur les points.', 'Mmh. Mmmh.'],
    reactBad: ['MA LUMIÈRE !', 'Je n\'ai PAS peur !', 'Les portes ! Fermez les portes !'],
    reactNeutral: ['Mmh.', '…Pose-la dans l\'entrée ?', 'Ça ne fait pas de lumière, ça.'],
    reactSpecial: {
      rendre: 'Rendre… À elle ? …Elle la réclame. Elle la réclame depuis tout à l\'heure.',
      reste: 'Oui. Reste. Reste avec moi dans le noir.',
      merci: 'Pourquoi merci ? Je n\'ai rien apporté.',
      noir: 'Le noir. Oui. C\'est ça. C\'est lui.',
      'sous la porte': '…Tu l\'as vue, toi aussi ? La lumière, sous la porte ?',
      'mot du frigo': '« Pose-la dans l\'entrée. » Je l\'ai lu. Je l\'ai lu, je te dis.',
    },
    spareText: '* Le Petit Homme s\'assoit par terre, à côté de la lumière. Il ne la reprend pas.',
    killText: '* Le Petit Homme éclate en encre et en rembourrage. La veilleuse roule par terre.\n* Une fêlure la traverse, d\'un bord à l\'autre.',
    patterns: ['doors_slam', 'noodle_rain'],
    rewards: { boutons: 60 },
    boss: true,
    noFlee: true,
    bg: 'stylo',
    music: 'petit_homme',
    hooks: HOMME_HOOKS,
  },
};

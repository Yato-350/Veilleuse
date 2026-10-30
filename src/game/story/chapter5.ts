import { audio } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { rng } from '../../engine/math';
import { SOUVENIRS } from '../../data/illustrations';
import { TILES } from '../../data/tiles';
import { tf, tr } from '../../i18n';
import type { Director } from '../director';
import type { Entity } from '../overworld/entity';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { DrawTogetherScene, type DrawingId } from '../scenes/drawtogether';
import { G, maxHp } from '../state';
import { fallInto, shop } from './common';

/**
 * Chapter 5 — « La Marée Blanche » (docs/HISTOIRE.md § 3.13, T6 § 2.7). Act III, « Dedans »: correction fluid and blue
 * ballpoint. It starts too bright and ends sterile. Order of play:
 *   card (« Il fait beau. Il fait toujours beau. ») → plage: no shadow, the sun pinned to the sky, Mina of before and
 *   her castle, 41 shells in clusters (some play a hospital night when held to the ear) and a hidden 42nd → the towel:
 *   she falls asleep and cannot be woken for 30 real seconds (5 with Story mode or « Réduire les attentes ») → Noa's
 *   only line slips out → the white tide; the towel is a hospital sheet, flat and empty; the sea freezes → the
 *   Thermomètre's portal, « Tu vas bien ? » → sas (the long way through the waiting room, or the short one) → lac_blanc
 *   (snow that hurts, the red thread, the drawings to correct, the parents' room: T6) → chambre_verre: the visit
 *   (drawing game), La Vitre, souvenir 5 → the fall (fallInto(6)).
 *
 * Flags (c5_*):
 *   c5_intro          the beach opening has been played
 *   c5_coquillages    shells picked up (0–42); c5_coq_<i> cluster i picked; c5_ecoute_<i> its shell listened to
 *   c5_coquillage42   the hidden forty-second shell was found (where the small footprints stop)
 *   c5_donnes         shells given to Mina of before (her castle grows with them; she always counts forty-two)
 *   c5_mina_parle     times Noa talked to Mina of before
 *   c5_sieste         she lay down on the towel (the 30-second wait runs from then)
 *   c5_serviette      times Noa pressed A on her while she slept (« Elle dort. »; the last one wakes the tide)
 *   c5_nulle          Noa's only line slipped out (« T'es nulle, tu dors tout le temps. »)
 *   c5_maree          the white tide has passed (the sea is frozen; the beach re-tiled by freezeBeach)
 *   c5_drap           the towel is a hospital sheet, flat and empty
 *   c5_fil_vu         Noa has seen the red thread on the ice
 *   c5_portail        the portal has asked; c5_menti: « Oui. » (short way; La Vitre wants « pardon » first);
 *                     c5_fievre: « Non. J'ai de la fièvre. » (long way; one of the conditions of the secret ending)
 *   c5_thermo_fait    the Thermomètre of the waiting room (long way) has been calmed or beaten
 *   c5_porte_<1–5>    the airlock doors: 'ouverte' | 'fermee' (closed for good); door n+1 unlocks when n is 'fermee'
 *   c5_sas_toc        times Noa knocked back through the third door (two knocks: « Je suis là. »)
 *   c5_sas_dodo       Dodo was shut behind the fourth door (and was on Noa's side anyway)
 *   c5_lac            Noa has stepped onto the lake; c5_neige_vue: the snow has hurt him once
 *   c5_corrige        drawings corrected (0–5; ≥ 3 leads to Aube blanche, docs/HISTOIRE.md § 5);
 *                     c5_corrige_<id> that drawing has the black figure; c5_laisse_<id>: left as it was
 *   c5_parents        the parents' room: the voices through the partition (T6)
 *   c5_visite         the visit has been drawn (the cough, the nurse's shadow, the drawing stops)
 *   c5_vitre          'epargnee' | 'brisee' (set by the battle, src/data/enemies-ch5.ts); c5_vitre_fait after it
 *   c5_fin            the fall: Noa goes into Dodo (chapter 6)
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);
const bump = (k: string, n = 1): number => {
  const v = num(k) + n;
  G.state.flags[k] = v;
  return v;
};
const tileOf = (px: number): number => Math.floor(px / TILE);

/** The 30-second wait on the towel (real seconds), 5 with Story mode or « Réduire les attentes ». */
export const sleepWaitMs = (): number => (G.settings.storyMode || G.settings.shortWaits ? 5000 : 30000);

// ---------------------------------------------------------------------------------------------------------------------
// Constants shared with the maps (src/data/maps/chapter5.ts)
// ---------------------------------------------------------------------------------------------------------------------

/** The ten clusters of shells on the beach: [x, y, how many, sprite variant]. 41 in all; the 42nd is hidden. */
export const SHELL_CLUSTERS: Array<[number, number, number, number]> = [
  [5, 5, 3, 1],
  [11, 15, 4, 2],
  [19, 8, 5, 3],
  [31, 16, 4, 1],
  [35, 14, 6, 3],
  [41, 9, 3, 2],
  [5, 16, 5, 1],
  [30, 6, 4, 2],
  [15, 5, 3, 3],
  [37, 12, 4, 2],
];

/** x of the five airlock doors of the sas (D1 … D5). */
export const DOOR_X = [30, 38, 46, 56, 65];

/** The five drawings along the shore of the lake: x on the tarp wall, drawing id. */
export const DRAWINGS: Array<[number, DrawingId]> = [
  [8, 'maman'],
  [14, 'nadia'],
  [20, 'mina'],
  [26, 'chaise'],
  [32, 'plage'],
];

/** Stage of the castle of Mina of before, from the shells she was given. */
export function castleStage(): 1 | 2 | 3 {
  const n = num('c5_donnes');
  return n >= 25 ? 3 : n >= 10 ? 2 : 1;
}

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers: re-tiling, Dodo floating beside Noa, pinned overlays
// ---------------------------------------------------------------------------------------------------------------------

/** Changes tiles of the current map in place (the map is re-rendered once afterwards). */
function retile(cells: Array<[number, number, string]>): void {
  const tm = world.tilemap;
  for (const [x, y, id] of cells) {
    if (y < 0 || y >= tm.h || x < 0 || x >= tm.w) continue;
    tm.ids[y]![x] = id;
    tm.defs[y]![x] = TILES[id] ?? null;
  }
  tm.render();
}

/** Dodo floats beside Noa, a little behind him, softly (chapter 5: no follower, only him). */
function floatingDodo(d: Director, x?: number, y?: number): Entity {
  d.remove('dodo');
  const p = world.player;
  const e = d.spawn({
    id: 'dodo',
    sprite: 'npc_c5_dodo',
    frames: ['npc_c5_dodo', 'npc_c5_dodo_2'],
    frameSpeed: 28,
    x: x ?? tileOf(p.x) - 1,
    y: y ?? tileOf(p.y) - 1,
    float: true,
    shadow: false,
    solid: false,
    script: dodoTalk,
  });
  e.brain = (self) => {
    if (self.data.parked || self.target) return;
    const pl = world.player;
    const side = pl.dir === 'left' ? 1 : pl.dir === 'right' ? -1 : -0.8;
    const tx = pl.x + side * 18;
    const ty = pl.y - (pl.dir === 'down' ? 14 : 4);
    const dx = tx - self.x;
    const dy = ty - self.y;
    if (Math.hypot(dx, dy) > 6) {
      self.x += dx * 0.04;
      self.y += dy * 0.04;
    }
  };
  return e;
}

/** An overlay sprite pinned to the screen (the sun that does not move, the white veil). */
function pinned(d: Director, id: string, sprite: string, sx: number, sy: number): Entity {
  d.remove(id);
  const e = d.spawn({ id, sprite, x: 0, y: 0, solid: false, shadow: false });
  e.layer = 1;
  e.brain = (self) => {
    self.x = world.camX + sx;
    self.y = world.camY + sy;
  };
  return e;
}

/** Nothing on the beach casts a shadow (Noa included). */
function noShadows(): void {
  for (const e of world.entities) e.shadow = false;
}

// ---------------------------------------------------------------------------------------------------------------------
// The chapter card: blue ballpoint on correction fluid
// ---------------------------------------------------------------------------------------------------------------------

const FLUID = '#f6f8fc';
const PEN = '#3b5bd0';
const GHOST = '#d5dcea';

class FluidCard implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;
  private readonly num = tr('Chapitre 5');
  private readonly title = tr('La Marée Blanche');
  private readonly line1 = tr('Il fait beau.');
  private readonly line2 = tr('Il fait toujours beau.');
  private readonly under = tr('Il fait nuit.');

  static show(): Promise<void> {
    const c = new FluidCard();
    game.push(c);
    return new Promise((r) => {
      c.resolve = r;
    });
  }

  update(): void {
    this.t++;
    const t = this.t;
    if (t > 30 && t < 130 && t % 7 === 0) audio.sfx('write', { vol: 0.3, pitch: 1 + rng.next() * 0.2 });
    if (t > 170 && t < 260 && t % 8 === 0) audio.sfx('write', { vol: 0.25, pitch: 1.1 + rng.next() * 0.2 });
    if (t > 460 || (t > 140 && (input.pressed('a') || input.pressed('b')))) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = this.t;
    g.fillStyle = FLUID;
    g.fillRect(0, 0, W, H);
    // The fluid was brushed on in strokes; under it, faintly, something else was written.
    g.fillStyle = '#eef1f8';
    for (let y = 8; y < H; y += 11) g.fillRect(0, y + Math.round(Math.sin(y) * 2), W, 3);
    drawText(g, this.under, W / 2 + 3, 134, { color: GHOST, align: 'center', scale: 2 });
    g.fillStyle = FLUID;
    for (let x = 90; x < 230; x += 9) g.fillRect(x, 133 + (x % 3), 7, 2);
    const head = `${this.num} — ${this.title}`;
    const k = Math.min(1, Math.max(0, (t - 30) / 100));
    drawText(g, head.slice(0, Math.floor(head.length * k)), W / 2, 50, { color: PEN, align: 'center' });
    if (t > 150) {
      const k1 = Math.min(1, (t - 150) / 50);
      drawText(g, this.line1.slice(0, Math.floor(this.line1.length * k1)), W / 2, 80, { color: PEN, align: 'center', scale: 2 });
    }
    if (t > 210) {
      const k2 = Math.min(1, (t - 210) / 60);
      // The pen trembles on the second line.
      const wob = Math.round(Math.sin(t * 0.7) * 0.6);
      drawText(g, this.line2.slice(0, Math.floor(this.line2.length * k2)), W / 2 + wob, 104, { color: PEN, align: 'center' });
    }
    if (t > 400) {
      g.fillStyle = `rgba(255,255,255,${Math.min(1, (t - 400) / 50)})`;
      g.fillRect(0, 0, W, H);
    }
    void measure;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The white tide: correction fluid rising from the bottom of the screen, then drawing back
// ---------------------------------------------------------------------------------------------------------------------

class TideScene implements Scene {
  readonly transparent = true;
  readonly passthrough = true;
  /** 0 = nothing, 1 = the whole screen is white. */
  level = 0;
  goal = 0;
  private t = 0;

  static open(): TideScene {
    const s = new TideScene();
    game.push(s);
    return s;
  }

  to(goal: number, speed = 0.006): Promise<void> {
    this.goal = goal;
    this.speed = speed;
    return game.until(() => Math.abs(this.level - this.goal) < 0.004);
  }

  private speed = 0.006;

  close(): void {
    game.remove(this);
  }

  update(): void {
    this.t++;
    const d = this.goal - this.level;
    this.level += Math.sign(d) * Math.min(Math.abs(d), this.speed);
    if (this.t % 50 === 0 && this.level > 0 && this.level < 1) audio.sfx('erase', { vol: 0.25, pitch: 0.5 + rng.next() * 0.2 });
  }

  draw(g: CanvasRenderingContext2D): void {
    if (this.level <= 0) return;
    const top = H + 12 - this.level * (H + 40);
    for (let x = 0; x < W; x += 2) {
      const y = Math.round(top + Math.sin(x * 0.045 + this.t * 0.03) * 5 + Math.sin(x * 0.13 - this.t * 0.05) * 2);
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, 2, H - y + 4);
      g.fillStyle = '#e7ecf6';
      g.fillRect(x, y + 4, 2, 2);
      g.fillStyle = PEN;
      if ((x + this.t) % 9 < 7) g.fillRect(x, y - 1, 2, 1);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------------------------------------------------

export async function start(d: Director): Promise<void> {
  G.state.chapter = 5;
  G.state.party = [];
  await FluidCard.show();
  fx.setFade(1, '#ffffff');
  d.load('plage', 'debut');
  await opening(d);
}

async function opening(d: Director): Promise<void> {
  const p = world.player;
  p.visible = false;
  d.spawn({ id: 'noa_couche', sprite: 'pose_noa_lie', x: 21, y: 10, solid: false, shadow: false });
  await d.fadeIn(120);
  await d.wait(40);
  await d.say(['Du sable. Chaud sous la joue.', 'Il y a trop de lumière. Tu fermes les yeux. Elle passe à travers les paupières.']);
  d.sfx('step', { pitch: 0.7 });
  d.remove('noa_couche');
  p.visible = true;
  p.dir = 'down';
  await d.wait(30);
  await d.say(['La plage.', 'Celle d\'avant. L\'été d\'avant.']);
  await d.say(['Le soleil est là-haut, dans le coin du ciel.', 'Tu bouges la tête. Il ne bouge pas avec.']);
  await d.wait(20);
  d.face('player', 'up');
  await d.wait(30);
  d.face('player', 'down');
  await d.say(['Tu baisses les yeux.', 'Tu n\'as pas d\'ombre.']);
  await d.say('Rien n\'a d\'ombre, ici. Ni le parasol, ni les rochers, ni toi.');
  d.set('c5_intro');
  floatingDodo(d, 18, 9);
  d.sfx('whoosh', { pitch: 1.4, vol: 0.3 });
  await d.wait(30);
  await d.say(['Il fait beau, hein ?', 'Il fait toujours beau, ici. J\'y ai veillé.'], 'dodo:happy');
  await d.say(['« Une ombre, c\'est de la lumière avec un trou. »', 'C\'est ta sœur qui disait ça.'], 'dodo');
  await d.say('Ici, y a pas de trou.', 'dodo:happy');
  await d.say(['Dodo a encore maigri.', 'La couture de son flanc est ouverte. Un fil rouge pend derrière lui et traîne dans le sable, sans laisser de trace.']);
  await d.say('Ne regarde pas ça. Regarde plutôt là-bas.', 'dodo');
  await d.cameraTo(25, 13);
  await d.wait(30);
  await d.say(['Au bord de l\'eau, quelqu\'un construit un château.', 'Une couronne en papier. Un maillot rose à pois blancs.']);
  await d.say('…Mina.', 'noa:surprised');
  d.cameraFollow();
  await d.say(['Elle t\'attend depuis l\'été dernier.', 'Va. Sois gentil, cette fois.'], 'dodo');
}

// ---------------------------------------------------------------------------------------------------------------------
// plage — on enter: the overexposure, the pinned sun, the frozen sea once the tide has passed
// ---------------------------------------------------------------------------------------------------------------------

/** Timestamp (ms) when Mina lay down on the towel (module state: a reload restarts the wait). */
let sleepStart = 0;

/** The music's mood on this map: tempo scale and wobble (battles save and restore it). */
function mood(tempo: number, wobble: number): void {
  audio.tempoScale = tempo;
  audio.corruption = wobble;
}

export const beachEnter: Script = (d) => {
  noShadows();
  // After the tide the lullaby in major goes on, a little slower, a little out of tune.
  if (flag('c5_maree')) mood(0.9, 0.16);
  else mood(1, 0);
  const sun = pinned(d, 'soleil', 'c5_soleil', 58, 70);
  sun.alpha = 0.9;
  const veil = pinned(d, 'voile', 'c5_voile', W / 2, H);
  veil.alpha = flag('c5_maree') ? 0.24 : 0.14;
  if (flag('c5_maree')) freezeBeach(false);
  else if (flag('c5_sieste')) {
    sleepStart = performance.now();
    lieDown(d);
  }
  if (flag('c5_intro')) floatingDodo(d);
  veil.brain = (self) => {
    self.x = world.camX + W / 2;
    self.y = world.camY + H;
    // While she sleeps, the beach goes whiter and whiter.
    if (flag('c5_sieste') && !flag('c5_maree') && sleepStart) {
      const k = Math.min(1, (performance.now() - sleepStart) / sleepWaitMs());
      self.alpha = 0.14 + k * 0.22;
      // And the lullaby slows down, as if it were falling asleep too.
      if (world.controllable) mood(1 - k * 0.3, k * 0.3);
    }
  };
};

/** The tiles of the beach after the white tide: the sea is ice, patches of correction fluid, the red thread. */
function freezeBeach(render = true): void {
  const cells: Array<[number, number, string]> = [];
  const tm = world.tilemap;
  for (let y = 17; y < 30; y++)
    for (let x = 0; x < 46; x++) {
      const id = tm.ids[y]![x]!;
      if (id === 'c5_ecume') cells.push([x, y, 'c5_glace_vague']);
      else if (id === 'c5_mer') cells.push([x, y, 'c5_glace']);
      // The tide mark: where the white stopped, a thick band of correction fluid along the water.
      else if (id === 'c5_sable_mouille') cells.push([x, y, 'c5_maree']);
    }
  // Tongues of white where the tide went highest, up the beach (never on the props or the thread).
  const tongues: Array<[number, number, number, number]> = [
    [11, 14, 3, 2],
    [17, 14, 2, 3],
    [22, 15, 4, 2],
    [27, 13, 3, 4],
    [32, 15, 3, 2],
    [36, 14, 2, 3],
    [4, 15, 3, 2],
    [12, 13, 2, 1],
  ];
  for (const [x0, y0, w, h] of tongues)
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (tm.ids[y]?.[x] === 'c5_sable') cells.push([x, y, 'c5_maree']);
  // The red thread: from the knot by the sheet down to the portal.
  const thread: Array<[number, number, string]> = [
    [15, 13, 'c5_filsable_v'],
    [15, 14, 'c5_filsable_v'],
    [15, 15, 'c5_filsable_v'],
    [15, 16, 'c5_filsable_ne'],
    [16, 16, 'c5_filsable_h'],
    [17, 16, 'c5_filsable_h'],
    [18, 16, 'c5_filsable_h'],
    [19, 16, 'c5_filsable_sw'],
    [19, 17, 'c5_fil_v'],
    [19, 18, 'c5_fil_v'],
    [19, 19, 'c5_fil_v'],
    [19, 20, 'c5_fil_v'],
    [19, 21, 'c5_fil_ne'],
    [20, 21, 'c5_fil_h'],
    [21, 21, 'c5_fil_h'],
    [22, 21, 'c5_fil_sw'],
    [22, 22, 'c5_fil_v'],
    [22, 23, 'c5_fil_v'],
    [22, 24, 'c5_fil_v'],
    [22, 25, 'c5_fil_v'],
  ];
  cells.push(...thread);
  if (render) retile(cells);
  else {
    for (const [x, y, id] of cells) {
      tm.ids[y]![x] = id;
      tm.defs[y]![x] = TILES[id] ?? null;
    }
    tm.render();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// plage — the family's spot
// ---------------------------------------------------------------------------------------------------------------------

export const parasol: Script = async (d) => {
  if (!flag('c5_maree')) {
    await d.savePoint('Le parasol. Sur son mât, quelque chose brille, comme une toute petite veilleuse qu\'on aurait oubliée allumée en plein jour.');
    return;
  }
  await d.savePoint('Le parasol. Il est resté planté là. La marée ne l\'a pas pris. Elle n\'a pris que ce qui comptait.');
};

export const deckChair: Script = async (d) => {
  if (flag('c5_maree')) {
    await d.say(['Le transat de Maman. Vide.', 'Le magazine est toujours ouvert à la même page. Il n\'y a plus rien d\'imprimé dessus.']);
    return;
  }
  const n = bump('c5_transat');
  if (n === 1) {
    await d.say(['Le transat de Maman. Rayé bleu et blanc.', 'La toile a gardé la forme d\'un dos.', 'Ses lunettes de soleil sont posées sur l\'accoudoir, les branches repliées.']);
    await d.say(['Un magazine, ouvert. Elle a lu la même page tout l\'après-midi.', 'Tu t\'en souviens, maintenant. Elle ne lisait pas. Elle regardait Mina dormir.']);
  } else {
    await d.say(['Tu t\'assois au bord du transat. Il grince.', 'D\'ici, on voit toute la plage. On voit surtout la serviette.']);
  }
};

export const sunscreen: Script = async (d) => {
  await d.say(['Une bouteille de crème solaire. Indice 50, « peaux sensibles ».', 'Maman en remettait à Mina toutes les heures. Toi, tu disais que c\'était pour les bébés.']);
  if (!flag('c5_maree')) await d.say('Le bouchon est encore ouvert. Ça sent l\'été. Ça sent un peu l\'hôpital, aussi.');
};

export const cooler: Script = async (d) => {
  const n = bump('c5_glaciere');
  if (n === 1) {
    await d.say(['La glacière. Dedans : trois compotes, des sandwichs, une bouteille d\'eau gelée.', 'Le froid sort de la glacière comme d\'une porte ouverte.']);
    await d.say('Il ne fait pas chaud, ici. Il fait seulement clair.');
    if (await d.give('pomme', true)) await d.say('Tout au fond, une pomme d\'amour. Tu la prends. {c:y}(Pomme d\'amour){/c}');
  } else await d.say(['La glacière. Il reste les compotes.', 'Sur le couvercle, au feutre : « NE PAS OUVRIR AVANT MIDI ». Il est midi depuis toujours.']);
};

export const flipflops: Script = async (d) => {
  await d.say(['Deux paires de tongs, alignées au bord de la serviette.', 'Des petites roses. Des grandes bleues : les tiennes.']);
  await d.say('Tu essaies les tiennes. Elles sont trop petites. Tu avais douze ans, cet été-là. Tu ne le savais pas, que c\'était le dernier.');
};

export const towel: Script = async (d) => {
  if (flag('c5_sieste')) return asleep(d);
  await d.say(['La serviette de Mina. Jaune, rose, blanche.', 'Elle l\'avait choisie pour les couleurs. « Comme une glace à trois boules. »']);
  await d.say('Il y a du sable dessus. Du sable, et un creux. La forme de quelqu\'un qui dormait.');
};

export const sheet: Script = async (d) => {
  const n = bump('c5_drap_vu');
  if (n === 1) {
    await d.say(['Un drap. Blanc, repassé, plié au carré.', 'Un ourlet bleu, et dans un coin, l\'étiquette de la blanchisserie de l\'hôpital.']);
    await d.say('Il est plat. Il est tout à fait plat.');
    await d.say('…', 'noa:sad');
  } else if (n === 2) {
    await d.say(['Tu passes la main dessus. Il est froid.', 'Personne n\'a dormi dessus. Personne ne dormira dessus.']);
  } else await d.say('Le drap. Tu ne le soulèves pas. Il n\'y a rien dessous. Tu le sais.');
};

export const smallSteps: Script = async (d) => {
  await d.say(['Des petites empreintes de pas. Pieds nus.', 'Elles partent de la serviette et vont vers le château.']);
};

export const bigSteps: Script = async (d) => {
  await d.say(['Des grandes empreintes. Les tiennes.', 'Elles vont droit au château, sans détour. Tu marchais vite, cet été-là. Tu marchais toujours devant.']);
};

export const stepsEnd: Script = async (d) => {
  const n = bump('c5_traces');
  if (n === 1) {
    await d.say(['Les petites empreintes s\'arrêtent ici.', 'Au milieu de la plage. Pas de demi-tour. Pas de pas plus loin.']);
    await d.say('Elles s\'arrêtent, c\'est tout.');
    await d.say(['Quelqu\'un a dû la porter, à partir d\'ici.', 'Tu ne te souviens pas qui.']);
  } else await d.say('Ici, les petits pas s\'arrêtent. Les grands continuent tout seuls jusqu\'au château.');
};

// ---------------------------------------------------------------------------------------------------------------------
// plage — the shells
// ---------------------------------------------------------------------------------------------------------------------

/** What each cluster's big shell plays, held to the ear: a night of the hospital. */
const SHELL_NIGHTS: Array<Array<{ text: string | string[]; who?: string }>> = [
  [
    { text: ['Pas de mer, dedans.', 'Quelqu\'un fredonne. Pas de paroles, juste l\'air. L\'air de la boîte à musique.'] },
    { text: ['C\'est Maman. Elle chante faux sur la même note, toujours la même.', 'Tu avais oublié. Tu avais oublié qu\'elle chantait faux.'] },
  ],
  [{ text: '« Chambre 304, on prend la température ? Allez, sous le bras, championne. »', who: 'infirmiere' }, { text: ['Un bip.', '« Trente-sept huit. Bon. On verra demain. »'] }],
  [{ text: ['Un rire. Le sien. Fort, pour rien, devant un dessin animé.', 'Elle rit comme elle éternue : d\'un coup, en entier.'] }, { text: 'Tu souris sans le vouloir. Tu t\'arrêtes de sourire.' }],
  [{ text: '« Il viendra samedi, ma puce. Samedi. »', who: 'mamanvoix' }, { text: '« C\'est quand, samedi ? »', who: 'minavoix' }, { text: 'Un silence. Personne ne répond.' }],
  [
    { text: '« …trente-neuf. Quarante. Quarante et un. »', who: 'minavoix' },
    { text: ['« Maman, quand tu dors, tu respires tout doucement.', 'Alors je compte. Pour que tu t\'arrêtes pas. »'], who: 'minavoix' },
  ],
  [{ text: ['Bip. Bip. Bip.', 'La pluie contre une fenêtre. Quelqu\'un tourne une page, très lentement, pour ne réveiller personne.'] }],
  [{ text: ['« Allô ? Noa ? »', 'Un temps.', '« …Il répond pas. C\'est pas grave. Je réessaie demain. »'], who: 'minavoix' }, { text: 'C\'était l\'après-midi. Tu étais devant ton ordinateur. Tu as vu le nom s\'afficher.' }],
  [{ text: ['« Tu dors pas, toi ? »', 'Une voix de femme, douce, avec un accent du Sud.'], who: 'nadia' }, { text: '« Allez. Je reste un peu. » Le bruit d\'une chaise qu\'on approche du lit.', who: 'nadia' }],
  [{ text: '« Écris : Dodo, il ronfle. »', who: 'minavoix' }, { text: '« Les moutons, ça ronfle pas, ma puce. »', who: 'mamanvoix' }, { text: '« Lui si. Fort. Comme Noa. »', who: 'minavoix' }],
  [{ text: ['La mer.', 'Rien que la mer. Le seul coquillage de la plage qui fait ce qu\'on attend de lui.'] }],
];

/** Picking up a cluster of shells (and listening to its biggest one). */
export const shells =
  (i: number): Script =>
  async (d) => {
    const [, , n] = SHELL_CLUSTERS[i]!;
    if (flag(`c5_coq_${i}`)) return;
    d.set(`c5_coq_${i}`);
    d.remove(`coquillages_${i}`);
    const total = bump('c5_coquillages', n);
    d.sfx('pop', { pitch: 1.3 });
    await d.say(tf('Tu ramasses {0} coquillages. Tu en as {1}.', n, total));
    const first = !flag('c5_ecoute_vu');
    const r = await d.ask(first ? 'Il y en a un plus gros que les autres. Le porter à l\'oreille ?' : 'Le plus gros, à l\'oreille ?', ['Écouter', 'Le garder'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    d.set('c5_ecoute_vu');
    d.set(`c5_ecoute_${i}`);
    audio.setAmbience('none');
    d.sfx('whoosh', { pitch: 0.5, vol: 0.25 });
    await d.wait(40);
    for (const part of SHELL_NIGHTS[i] ?? []) await d.say(part.text, part.who);
    await d.wait(20);
    audio.setAmbience('wind');
    if (bump('c5_ecoutes') === 3) await d.say(['Ce ne sont pas des coquillages.', 'Ce sont des nuits. Quarante et une nuits, ramassées dans le sable.'], 'dodo');
  };

/** The forty-second shell: where the small footprints stop. No sea inside. */
export const shell42: Script = async (d) => {
  if (flag('c5_coquillage42')) return;
  await d.say(['Là où les petits pas s\'arrêtent, quelque chose dépasse du sable.', 'Un coquillage. Tout petit. Le quarante-deuxième.']);
  d.set('c5_coquillage42');
  d.remove('coquillage42');
  bump('c5_coquillages');
  const r = await d.ask('Le porter à l\'oreille ?', ['Écouter', 'Le garder'], undefined, { cancelIndex: 1 });
  if (r === 0) {
    audio.setAmbience('none');
    audio.stopMusic(2);
    await d.wait(60);
    await d.say(['Pas de mer.', 'Un grésillement, tout près. Une veilleuse branchée dans une chambre.']);
    await d.say(['Et une respiration.', 'Pas endormie. Réveillée. Elle retient son souffle, puis elle recommence.']);
    await d.wait(40);
    await d.say('Tu la reconnais.');
    await d.say('…', 'noa:sad');
    await d.say(['Repose-le.', 'Il est cassé, celui-là.'], 'dodo');
    audio.setAmbience('wind');
    d.music('plage');
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// plage — Mina of before
// ---------------------------------------------------------------------------------------------------------------------

/** Her holiday lines: she never answers, she says what she said that summer. */
const HOLIDAY = [
  'Regarde, Noa ! J\'en ai quarante-deux !|happy',
  'On fait un château avec des tours et un pont-levis ! Et des oubliettes pour les crabes.|happy',
  'Tu viens dans l\'eau ? …Après. Après la sieste.|neutral',
  'Je suis la reine de la plage. Toi t\'es… le crabe. Le crabe-chevalier, d\'accord.|happy',
  'T\'as vu ? Ma couronne tient même avec le vent.|happy',
  'Quand je serai grande, je serai sauveteuse. Ou dentiste. Ou les deux en même temps.|happy',
  'Maman a dit pas de crabe dans la voiture. Même un petit. Même un gentil.|neutral',
];

export const minaAvant: Script = async (d) => {
  const talks = bump('c5_mina_parle');
  if (talks === 1) {
    await d.say(['Elle creuse. Elle ne lève pas la tête.', 'Elle est dessinée au crayon : on voit le sens des traits dans ses cheveux.']);
    await d.say('Regarde, Noa ! J\'en ai quarante-deux !', 'mina:happy');
    await d.say(['Elle te tend son seau.', 'Il est vide.']);
    await d.say(['Elle ne te regarde pas.', 'Elle regarde un peu à côté de toi. Là où tu étais, l\'été dernier.']);
    await d.say('…Mina ?', 'noa:sad');
    await d.say('On fait un château avec des tours et un pont-levis ! Va chercher des coquillages, les plus beaux.', 'mina:happy');
    return;
  }
  // Shells for the castle.
  const have = num('c5_coquillages');
  const given = num('c5_donnes');
  if (have > given) {
    const before = castleStage();
    d.set('c5_donnes', have);
    d.sfx('pop', { pitch: 1.1 });
    await d.say(tf('Tu lui donnes tes coquillages. Elle les enfonce un par un dans les murs du château. ({0})', have));
    if (castleStage() !== before) {
      // The castle grows in place (the map shows the right stage on the next load).
      const c = world.entities.find((e) => e.sprite?.startsWith('prop_c5_chateau_'));
      if (c) c.sprite = `prop_c5_chateau_${castleStage()}`;
      d.sfx('erase', { pitch: 1.6, vol: 0.3 });
      await d.say(castleStage() === 3 ? 'Le château a trois tours, maintenant. Et un drapeau.' : 'Le château a grandi d\'un coup. Deux tours de plus.');
    }
    if (have >= 42) {
      await d.say('Regarde, Noa ! J\'en ai quarante-deux !', 'mina:happy');
      await d.say(['Cette fois, c\'est vrai. Tu les as comptés.', 'Pour une fois, elle et toi, vous avez le même nombre.']);
    } else {
      await d.say('Regarde, Noa ! J\'en ai quarante-deux !', 'mina:happy');
      await d.say(tf('Tu lui en as donné {0}. Elle en compte quarante-deux. Elle compte toujours quarante-deux.', have));
    }
  } else {
    const [text, expr] = tr(HOLIDAY[(talks - 2) % HOLIDAY.length]!).split('|') as [string, string | undefined];
    await d.say(text, `mina:${expr ?? 'happy'}`);
  }
  // She gets sleepy.
  const shellsGiven = num('c5_donnes');
  if (talks >= 3 && (shellsGiven >= 10 || talks >= 5)) await sleepy(d);
  else if (talks >= 2) await d.say('Elle bâille. Elle se frotte les yeux avec le dos de la main, plein de sable.');
};

/** She lies down on the towel. From now on she cannot be woken for 30 real seconds. */
async function sleepy(d: Director): Promise<void> {
  await d.say('Il fait chaud, hein ? J\'ai un peu sommeil.', 'mina:neutral');
  await d.say(['Je fais juste une petite sieste. Cinq minutes.', 'Tu me réveilles pour finir le château, hein ? Promis ?'], 'mina:happy');
  await d.wait(20);
  d.remove('mina_avant');
  d.spawn({ id: 'mina_marche', char: 'mina_avant', x: 25, y: 13, dir: 'left', shadow: false, solid: false });
  await d.walkTo('mina_marche', 20, 12, 0.7);
  await d.walkTo('mina_marche', 15, 12, 0.7);
  d.face('mina_marche', 'up');
  await d.wait(20);
  d.remove('mina_marche');
  d.set('c5_sieste');
  sleepStart = performance.now();
  lieDown(d);
  d.sfx('step', { pitch: 1.5, vol: 0.3 });
  await d.wait(40);
  await d.say(['Elle s\'allonge sur la serviette, en chien de fusil.', 'Sa couronne glisse dans le sable. Elle ne la ramasse pas.']);
  await d.say('Elle dort déjà.');
}

/** Mina asleep on the towel (also restored by beachEnter after a reload). */
function lieDown(d: Director): void {
  const e = d.spawn({ id: 'mina_dort', sprite: 'pose_c5_mina_dort', x: 13, y: 11, solid: true, shadow: false, script: asleep });
  e.x += 8;
  e.y -= 1;
  e.layer = 0;
}

/** Pressing A on her while she sleeps: « Elle dort. » Until the 30 seconds have passed. */
async function asleep(d: Director): Promise<void> {
  if (flag('c5_maree')) return;
  const elapsed = performance.now() - sleepStart;
  bump('c5_serviette');
  if (elapsed < sleepWaitMs()) {
    await d.say('Elle dort.');
    return;
  }
  await wakeAttempt(d);
}

/** After the wait: Noa tries to wake her, Dodo, the one line, the white tide. */
async function wakeAttempt(d: Director): Promise<void> {
  audio.stopMusic(3);
  mood(1, 0);
  audio.setAmbience('none');
  await d.wait(40);
  await d.say(['Tu t\'accroupis à côté d\'elle.', 'Mina. Mina, réveille-toi. Le château.']);
  await d.wait(60);
  await d.say('Elle ne bouge pas. Elle respire. Elle dort, c\'est tout.');
  const dodo = d.find('dodo');
  if (dodo) dodo.data.parked = true;
  await d.say(['Laisse-la.', 'Elle a toujours été fatiguée.'], 'dodo');
  await d.wait(50);
  d.set('c5_nulle');
  await d.say('T\'es nulle, tu dors tout le temps.', 'noa:neutral');
  await d.wait(30);
  await d.say('Ça t\'a échappé. Comme cet été-là. Les mêmes mots, dans le même ordre.');
  // Silence.
  await d.wait(150);
  await whiteTide(d);
}

/** The white tide covers the towel; when it withdraws the towel is a flat empty sheet, and the sea freezes. */
async function whiteTide(d: Director): Promise<void> {
  d.face('player', 'down');
  d.sfx('whoosh', { pitch: 0.3, vol: 0.6 });
  await d.say('Au loin, la mer se met à monter. Sans bruit. Elle est blanche.');
  const tide = TideScene.open();
  await tide.to(0.55, 0.004);
  await d.say(['Blanche comme du correcteur.', 'Elle avance en couches épaisses, et elle recouvre. Le sable. Les traces. Le château.']);
  await tide.to(1, 0.006);
  // Under the white: the towel becomes a sheet, Mina is gone, the sea freezes.
  d.set('c5_maree');
  d.set('c5_drap');
  d.remove('mina_dort');
  world.removeEntity('serviette');
  for (const id of world.entities.map((e) => e.id)) if (id.startsWith('coquillages_') || id.startsWith('c5_')) world.removeEntity(id);
  await d.wait(60);
  d.load('plage', 'glace');
  noShadows();
  world.player.dir = 'down';
  const dodo = d.find('dodo');
  if (dodo) dodo.data.parked = true;
  await d.wait(30);
  await tide.to(0, 0.004);
  tide.close();
  d.sfx('shatter', { pitch: 0.35, vol: 0.5 });
  d.shake(1, 30);
  await d.wait(30);
  d.sfx('shatter', { pitch: 0.28, vol: 0.4 });
  await d.say(['La marée se retire.', 'Là où était la serviette, il y a un drap. Un drap d\'hôpital, plié au carré.', 'Plat. Vide.']);
  await d.wait(30);
  await d.say(['Derrière, la mer a gelé.', 'D\'un coup, jusqu\'au bout. Les vagues sont restées en l\'air, figées en plein mouvement.']);
  const dd = d.find('dodo');
  if (dd) dd.data.parked = false;
  await d.say(['Ce n\'est qu\'un drap.', 'Les draps, ça se plie.'], 'dodo');
  await d.wait(40);
  await afterTideStep(d);
}

/** Right after the tide: the red thread. */
export const afterTideStep: Script = async (d) => {
  if (flag('c5_fil_vu')) return;
  d.set('c5_fil_vu');
  await d.say(['Un fil rouge, par terre.', 'Il part du drap et s\'en va sur la glace, tout droit, vers quelque chose de haut et de blanc.']);
  await d.say(['C\'est le fil de Mina. Celle de feutre.', 'Il est resté quand elle s\'est défaite. Il ne s\'est pas défait, lui.']);
  await d.say('Ne marche pas dessus. Ça porte malheur.', 'dodo');
  await d.say('Tu marches dessus. Il ne casse pas.');
};

export const threadKnot: Script = async (d) => {
  await d.say(['Le bout du fil. Un nœud, serré, fait par de petits doigts.', 'Tu tires un peu dessus. Très loin, au bout, quelque chose tire en retour.']);
};

// ---------------------------------------------------------------------------------------------------------------------
// plage — the rest of the beach
// ---------------------------------------------------------------------------------------------------------------------

export const castle: Script = async (d) => {
  const st = castleStage();
  if (st === 1) await d.say(['Le château de Mina. Pour l\'instant, c\'est surtout une tour en forme de seau.', 'Une ligne au doigt, tout autour : les douves. « Pour les crabes. »']);
  else if (st === 2) await d.say(['Le château a deux tours de plus, et un mur entre elles.', 'Tes coquillages sont enfoncés dans le sable, le côté brillant vers l\'extérieur. « Pour que ça se voie de loin. »']);
  else await d.say(['Le château est fini. Trois tours, des remparts, un drapeau en papier avec une couronne dessus.', 'C\'est le plus beau château de la plage. C\'était le plus beau château de la plage.']);
};

export const castleGone: Script = async (d) => {
  await d.say(['Là où était le château, un rond de blanc. Bien lisse.', 'Le correcteur a même rempli les douves.']);
};

export const bucket: Script = async (d) => {
  await d.say(['Le seau rouge et la pelle jaune.', 'Dans le seau, un peu d\'eau de mer. Elle est tiède. Tiède comme une main.']);
};

export const ball: Script = async (d) => {
  if (flag('c5_maree')) {
    await d.say('Le ballon dégonflé. Une fine couche de blanc a séché dessus. On ne voit plus que le rouge.');
    return;
  }
  await d.say(['Un ballon de plage, dégonflé, plié sur lui-même.', 'Tu l\'avais gonflé toi-même, ce jour-là. Mina avait dit que tu avais « des poumons de baleine ».']);
  await d.say('Tu souffles dans la valve. L\'air ressort par un trou que tu ne trouves pas.');
};

export const sandWriting: Script = async (d) => {
  await d.say(['Écrit dans le sable, au doigt :', '{c:o}« NOA EST UN CRABE »{/c}']);
  await d.say(['Dessous, de ton écriture : {c:b}« MINA AUSSI »{/c}', 'Dessous encore, de la sienne, en plus gros : {c:o}« NON C TOI »{/c}']);
  await d.say('…', 'noa:neutral');
  await d.say('Tu as souri. Ça t\'a surpris toi-même.');
};

export const sandWritingGone: Script = async (d) => {
  await d.say(['Une grande tache blanche, là où il y avait des mots.', 'Sous le correcteur, on devine encore une lettre. Un C. Le C de crabe.']);
};

export const erasedFamily: Script = async (d) => {
  const n = bump('c5_famille');
  if (n === 1) {
    await d.say(['Une serviette bleue. Dessus, une famille.', 'Ou plutôt : la forme d\'une famille.']);
    await d.say(['Quelqu\'un a passé du blanc dessus. Soigneusement, en suivant les bords.', 'Un grand allongé, un grand assis, un petit assis. Pas de visage. Pas de couleur.']);
    await d.say('Il ne fallait pas qu\'ils te regardent.', 'dodo');
  } else await d.say('La famille effacée ne bouge pas. Le petit est tourné vers la mer. Il l\'a toujours été.');
};

export const erasedOne: Script = async (d) => {
  await d.say(['Quelqu\'un, sous un petit parasol, dans une chaise longue orange.', 'Blanchi lui aussi. On a laissé dépasser un pied, par oubli. Un pied, et une tong.']);
};

export const lifeguard: Script = async (d) => {
  await d.say(['Le poste de secours. Une chaise haute, blanchie par le soleil.', 'Personne dessus. Le drapeau est vert : baignade surveillée.']);
  await d.say('Le drapeau ne bouge pas. Pourtant, tu entends le vent.');
};

export const sign: Script = async (d) => {
  await d.say(['Un panneau en bois.', '{c:o}« ATTENTION. Ne pas s\'endormir au soleil. Pensez à vous hydrater. »{/c}']);
  if (flag('c5_maree')) await d.say('Quelqu\'un a raturé « au soleil » au stylo bleu. Il ne reste que « Ne pas s\'endormir. »');
};

export const boardwalk: Script = async (d) => {
  await d.say(['Le chemin de planches remonte vers le parking.', 'En haut de la dune, il s\'arrête net. Après, il n\'y a que du blanc.']);
  await d.say('On ne repart pas de cette plage. Ce n\'est pas ce genre de souvenir.', 'dodo');
};

export const fence: Script = async (d) => {
  await d.say(['Une ganivelle, des piquets de châtaignier liés par du fil de fer.', 'Pour retenir le sable. Le sable reste. C\'est ce qu\'on lui demande.']);
};

export const rocks: Script = async (d) => {
  await d.say(['Des rochers lisses, chauds.', 'Il n\'y a pas d\'ombre au pied des rochers non plus. On dirait des découpages posés sur une feuille.']);
};

export const seaLook: Script = async (d) => {
  if (flag('c5_maree')) return;
  const n = bump('c5_mer');
  if (n === 1) await d.say(['La mer. Très pâle, presque blanche.', 'Elle ne fait pas de vagues. Elle respire. Elle monte, elle descend, sans jamais toucher tes pieds.']);
  else await d.say('Tu pourrais aller dans l\'eau. Tu ne vas pas dans l\'eau. Tu n\'y es pas allé, cet été-là non plus. Tu boudais.');
};

export const tidePool: Script = async (d) => {
  const n = bump('c5_flaque');
  if (n === 1) {
    await d.say(['Une flaque entre les rochers. De l\'eau claire, tiède.', 'Au fond, quelque chose marche de travers, comme un crabe.']);
    await d.say(['Ce n\'est pas un crabe.', 'C\'est un bracelet en plastique, blanc, avec une étiquette. Il a des pattes.']);
  } else await d.say('Le bracelet fait le tour de la flaque. Encore. Encore. Il cherche un poignet.');
};

export const crownUnderIce: Script = async (d) => {
  await d.say(['Sous la glace, prise dedans, une couronne en papier.', 'L\'or a déteint dans l\'eau gelée tout autour, comme un halo.']);
  await d.say('Tu poses la main sur la glace, juste au-dessus. Elle ne fond pas.');
};

export const kiosk: Script = async (d) => {
  if (flag('c5_maree')) {
    await d.say(['Le kiosque à glaces. Le rideau de fer est baissé.', 'Sur le comptoir, une chaussette. Une seule. Sans sa paire.']);
    return;
  }
  await chaussette(d);
};

export const chaussette: Script = async (d) => {
  const n = bump('c5_chaussette');
  if (n === 1) {
    await d.say(['Oh ! Mon chou ! Tu tombes bien : je suis en vacances.', 'Une chaussette en vacances, c\'est une chaussette qui ne sèche pas sur un fil.'], 'chaussette:happy');
    await d.say(['Mais une boutique, ça reste ouvert. Même ici.', 'Surtout ici.'], 'chaussette:neutral');
  } else if (n === 2) {
    await d.say(['Tu as vu ? Il n\'y a pas d\'ombre.', 'J\'ai cherché la mienne partout. Pour une fois que j\'avais une paire de quelque chose.'], 'chaussette:neutral');
  } else if (n === 3) {
    await d.say(['La petite reine, là-bas, elle est venue m\'acheter une glace tout à l\'heure.', 'Trois boules. Elle n\'a mangé que la première. Elle avait sommeil.'], 'chaussette:neutral');
  }
  await shop(['lait', 'biscuit', 'chocolat', 'pomme', 'mouchoir', 'bulles', 'pluie', 'gateau'], 'Prends ce qu\'il te faut, mon chou. Ici, rien ne fond.');
};

export const dodoTalk: Script = async (d) => {
  const map = G.state.map;
  const n = bump(`c5_dodo_${map}`);
  const lines: Record<string, Array<[string | string[], string]>> = {
    plage: flag('c5_maree')
      ? [
          [['Ne regarde pas trop la mer.', 'Elle a gelé pour toi. Pour que tu puisses marcher dessus.'], 'dodo'],
          ['Tu as été très bien. Tu n\'as presque rien dit.', 'dodo:happy'],
          [['Tu l\'as entendu, {player} ?', '« T\'es nulle, tu dors tout le temps. » Il le dit si bien.'], 'dodo:creepy'],
        ]
      : [
          [['Tu te souviens de cette plage ? Moi oui.', 'Je me souviens de tout ce que tu oublies. C\'est mon travail.'], 'dodo'],
          ['Ramasse des coquillages. Ça occupe les mains.', 'dodo:happy'],
          [['Elle a l\'air heureuse, non ?', 'Profites-en. Ça ne dure pas, l\'été.'], 'dodo'],
          ['Tu sens ? Ça sent la crème solaire. Et un peu le désinfectant. Ne fais pas attention.', 'dodo'],
        ],
    sas: [
      [['Ferme derrière toi.', 'C\'est ce que tu fais de mieux.'], 'dodo'],
      [['Tu vois ? Derrière une porte fermée, rien ne fait mal.', 'C\'est toi qui me l\'as appris.'], 'dodo:happy'],
      ['Tu as les mains toutes blanches. C\'est propre, au moins.', 'dodo'],
    ],
    lac_blanc: [
      [['Ne marche pas dans la neige.', 'Tu sais ce qui arrive à ceux qui touchent ce qu\'il ne faut pas.'], 'dodo'],
      [['Corrige les dessins.', 'Ce n\'est pas mentir. C\'est réparer.'], 'dodo:happy'],
      [['Le fil, le fil… Tu t\'accroches à un fil.', 'Moi, je suis rempli de fil. Je pourrais t\'en donner tant que tu veux.'], 'dodo'],
    ],
  };
  const list = lines[map] ?? [['…', 'dodo']];
  const [text, who] = list[(n - 1) % list.length]!;
  await d.say(text, who);
};

// ---------------------------------------------------------------------------------------------------------------------
// plage — the Thermomètre's portal
// ---------------------------------------------------------------------------------------------------------------------

export const portal: Script = async (d) => {
  if (flag('c5_portail')) return portalAgain(d);
  await d.say(['Un thermomètre. Un thermomètre digital, haut comme une maison, planté dans la glace par sa pointe.', 'Au milieu, une ouverture, pleine de lumière blanche.']);
  await d.say('Sur l\'écran, un point d\'interrogation clignote.');
  d.sfx('beep', { pitch: 1.2 });
  await d.wait(30);
  d.sfx('beep', { pitch: 1.2 });
  const r = await d.ask('« Tu vas bien ? »', ['Oui.', 'Non. J\'ai de la fièvre.']);
  d.set('c5_portail');
  const p = d.find('portail');
  if (r === 0) {
    d.set('c5_menti');
    if (p) {
      p.frames = undefined;
      p.sprite = 'prop_c5_portail_ok';
    }
    d.sfx('chime', { pitch: 1.2, vol: 0.5 });
    await d.say(['« 37,0 ». L\'écran passe au vert.', 'L\'ouverture s\'élargit tout de suite. Ça ne coûte rien, de dire oui. Ça n\'a jamais rien coûté.']);
    await d.say(['Bien.', 'Tu vois, {player} ? Il va bien.'], 'dodo:happy');
    await d.say('Le chemin court. Tout droit vers elle.', 'dodo');
    await d.warp('sas', 'court', { sfx: 'whoosh', fade: 40, color: '#ffffff' });
    return;
  }
  d.set('c5_fievre');
  if (p) {
    p.frames = undefined;
    p.sprite = 'prop_c5_portail_fievre';
  }
  d.sfx('beep', { pitch: 0.7 });
  await d.say('« 38,4 ». L\'écran passe à l\'orange.');
  await d.wait(30);
  // Behind the glass of the thermometer, a small shape in a knitted hat hits it with her fist.
  const sil = d.spawn({ id: 'sil_thermo', sprite: 'npc_c5_silhouette', x: 22, y: 25, solid: false, shadow: false });
  sil.layer = 1;
  sil.alpha = 0.75;
  sil.oy = -6;
  sil.brain = (self) => {
    self.ox = (self.animT % 20 < 3 ? (self.animT % 2 ? 1 : -1) : 0);
  };
  d.sfx('knock1', { vol: 0.7 });
  d.shake(2, 14);
  await d.say(['Derrière le verre du thermomètre, contre la colonne, une petite silhouette tape du poing.', 'Un bonnet. Deux oreilles de mouton.']);
  d.sfx('knock1', { vol: 0.9, pitch: 1.1 });
  await d.say('T\'avais promis !', 'minavoix');
  d.shake(3, 20);
  for (let i = 10; i >= 0; i--) {
    sil.alpha = i / 14;
    await d.wait(3);
  }
  d.remove('sil_thermo');
  await d.say(['Ça fait mal.', 'C\'est vrai, et ça fait mal. Les deux en même temps.']);
  await d.say('…Je sais.', 'noa:sad');
  await d.wait(30);
  await d.say(['Tu aurais pu dire oui.', 'Tout le monde dit oui.'], 'dodo');
  await d.say('L\'ouverture s\'élargit lentement. Le chemin, par là, est plus long. Il passe par la salle d\'attente.');
  await d.warp('sas', 'long', { sfx: 'whoosh', fade: 50, color: '#ffffff' });
};

export const portalAgain: Script = async (d) => {
  await d.say(flag('c5_menti') ? 'L\'écran affiche « 37,0 ». Il a l\'air content de toi.' : 'L\'écran affiche « 38,4 ». Il clignote doucement, comme une respiration.');
  await d.warp('sas', flag('c5_menti') ? 'court' : 'long', { sfx: 'whoosh', fade: 30, color: '#ffffff' });
};

// ---------------------------------------------------------------------------------------------------------------------
// sas — the airlock doors
// ---------------------------------------------------------------------------------------------------------------------

type DoorState = 'rouge' | 'verte' | 'ouverte' | 'morte';

/** State of airlock door n (1–5): D1 starts open; each next door unlocks once the previous one is closed for good. */
export function doorState(n: number): DoorState {
  const f = G.state.flags[`c5_porte_${n}`];
  if (f === 'fermee') return 'morte';
  if (f === 'ouverte') return 'ouverte';
  if (n === 1) return 'ouverte';
  // The third door stays red while Noa keeps answering the knocks.
  if (n === 4 && num('c5_sas_toc') > 0 && G.state.flags.c5_porte_3 !== 'fermee') return 'rouge';
  return G.state.flags[`c5_porte_${n - 1}`] === 'fermee' ? 'verte' : 'rouge';
}

/** Applies the door states to the door entities (sprite and collision). */
function syncDoors(): void {
  for (let n = 1; n <= 5; n++) {
    const e = world.get(`porte_${n}`);
    if (!e) continue;
    const st = doorState(n);
    e.sprite = `prop_c5_porte_${st}`;
    e.solid = st !== 'ouverte';
  }
}

export const lakeDoorOpen = (): boolean => doorState(5) === 'ouverte';

export const sasEnter: Script = async (d) => {
  mood(1, 0);
  syncDoors();
  if (flag('c5_menti')) {
    // The short way: the waiting room, the changing room and the sinks were never drawn.
    const cells: Array<[number, number, string]> = [];
    for (let y = 1; y < 10; y++) for (let x = 0; x < 30; x++) cells.push([x, y, 'c5_brume']);
    retile(cells);
  }
  // Dodo floats beside Noa (even once he was shut behind the fourth door: he is on Noa's side of every door).
  floatingDodo(d);
  if (G.state.map === 'sas' && !flag('c5_sas_intro')) {
    d.set('c5_sas_intro');
    await d.wait(20);
    if (flag('c5_menti')) {
      await d.say(['Une pièce blanche. Des bâches en plastique pendues partout.', 'Le dessin est fait au stylo bleu, d\'un trait qui tremble.']);
      await d.say(['Derrière toi, la porte est restée ouverte.', 'De l\'autre côté, il n\'y a rien. Du blanc. Rien n\'a été dessiné.']);
    } else {
      await d.say(['Une salle d\'attente. Blanche. Des bâches en plastique pendues partout, comme dans un chantier.', 'Le dessin est fait au stylo bleu, d\'un trait qui tremble.']);
      await d.say('Tout sent l\'alcool. Le froid aussi sent l\'alcool.');
    }
  }
};

/** Talking to door n: open it from behind (if unlocked), or close it from the far side. */
export const airlockDoor =
  (n: number): Script =>
  async (d) => {
    const st = doorState(n);
    const x = DOOR_X[n - 1]!;
    const behind = world.player.x < x * TILE + 8;
    if (st === 'morte') {
      await d.say(n === 5 ? 'La porte du lac.' : ['La porte est fermée. Le joint a collé au cadre.', 'De ce côté, il n\'y a pas de poignée.']);
      return;
    }
    if (st === 'rouge') {
      d.sfx('beep', { pitch: 0.6 });
      await d.say(['La lampe au-dessus de la porte est rouge.', 'Une étiquette : {c:r}« Fermez la porte précédente. »{/c}']);
      if (n === 2 && !flag('c5_regle')) {
        d.set('c5_regle');
        await d.say(['La porte suivante ne s\'ouvre que si celle de derrière est fermée.', 'C\'est le principe d\'un sas. Il ne faut jamais que les deux soient ouvertes.']);
      }
      if (n === 4 && num('c5_sas_toc') > 0) await d.say('Tant que tu réponds, rien ne s\'ouvre devant.');
      return;
    }
    if (st === 'verte') {
      if (!behind) return;
      d.set(`c5_porte_${n}`, 'ouverte');
      d.sfx('whoosh', { pitch: 1.8, vol: 0.4 });
      d.sfx('door', { pitch: 1.3 });
      syncDoors();
      await d.say(n === 5 ? ['La dernière porte s\'ouvre dans un souffle de froid.', 'Derrière, tout est blanc. Plus blanc que blanc.'] : 'Pschhh. La porte glisse dans le mur.');
      return;
    }
    // Open: walk through it; once on the other side, close it.
    if (behind) {
      await d.say('La porte est ouverte. De l\'autre côté, une autre pièce. Une autre porte.');
      return;
    }
    await closeDoor(d, n);
  };

async function closeDoor(d: Director, n: number): Promise<void> {
  if (n === 1) {
    await d.say(flag('c5_menti') ? ['Derrière toi, il n\'y a rien à fermer. Juste du blanc.', 'Ferme quand même.'] : ['Par le hublot de la porte, les lavabos.', 'Un robinet coule encore. Tu ne l\'as pas fermé.']);
  } else if (n === 2) {
    await d.say(['Par le hublot, tu vois la plage.', 'Trop claire. La mer gelée. Sur le sable, un drap plié.']);
  } else if (n === 3) {
    if (!(await knocks(d))) return;
  } else if (n === 4) {
    await d.say(['Dodo est resté de l\'autre côté.', 'Il te regarde par le hublot. Il ne dit rien. Il attend que tu fermes.']);
  }
  const r = await d.ask('Fermer la porte ?', ['Fermer', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set(`c5_porte_${n}`, 'fermee');
  d.sfx('door', { pitch: 0.8 });
  d.sfx('whoosh', { pitch: 0.6, vol: 0.3 });
  syncDoors();
  await d.wait(20);
  d.sfx('chime', { pitch: 1.4, vol: 0.35 });
  syncDoors();
  if (n === 1) {
    await d.say(['Pfff. Le joint colle au cadre.', 'En face, la lampe passe au vert.']);
    await d.say('C\'est facile. Tu as l\'habitude.');
  } else if (n === 2) {
    await d.say('La buée recouvre le hublot. La plage disparaît.');
    await d.say(['Tu vois ?', 'C\'est facile, de fermer.'], 'dodo:happy');
  } else if (n === 3) {
    await d.say(['Tu fermes.', 'La porte avale le dernier coup.']);
    await d.wait(40);
    await d.say('Tu n\'as rien entendu.');
  } else if (n === 4) {
    d.set('c5_sas_dodo');
    await d.wait(60);
    await dodoInside(d);
  }
}

/** Behind the third door: one knock (« T'es là ? »). Answering keeps the next door red. */
async function knocks(d: Director): Promise<boolean> {
  d.sfx('knock1', { vol: 0.6 });
  await d.wait(30);
  await d.say(['Toc.', 'Un coup, de l\'autre côté de la porte. Un seul.']);
  if (!flag('c5_toc_voix')) {
    d.set('c5_toc_voix');
    await d.say('Noa ? T\'es là ?', 'minavoix');
  }
  const r = await d.ask('Un coup. « T\'es là ? »', ['Frapper deux fois', 'Fermer la porte'], undefined, { cancelIndex: 1 });
  if (r === 0) {
    bump('c5_sas_toc');
    d.sfx('knock1', { pitch: 1.1 });
    await d.wait(14);
    d.sfx('knock1', { pitch: 1.1 });
    await d.say('Toc toc. « Je suis là. »');
    await d.wait(60);
    await d.say('De l\'autre côté, plus rien. Et devant toi, la lampe reste rouge.');
    syncDoors();
    if (num('c5_sas_toc') >= 2) await d.say(['Tu peux frapper toute la nuit.', 'Tu ne passeras pas comme ça.'], 'dodo');
    return false;
  }
  return true;
}

/** Shutting Dodo out: he is on Noa's side anyway. */
async function dodoInside(d: Director): Promise<void> {
  d.remove('dodo');
  await d.say(['Le hublot s\'embue.', 'Le visage de Dodo s\'efface derrière.']);
  await d.wait(40);
  d.sfx('whoosh', { pitch: 1.5, vol: 0.2 });
  const p = world.player;
  const e = floatingDodo(d, tileOf(p.x) + 1, tileOf(p.y) - 1);
  e.data.parked = true;
  await d.wait(30);
  d.face('player', 'right');
  await d.emote('player', '!');
  await d.say(['Tu ne peux pas fermer une porte sur moi, Noa.', 'Je suis de ton côté de toutes les portes.'], 'dodo:creepy');
  await d.say('Je suis toujours déjà dedans.', 'dodo:happy');
  e.data.parked = false;
}

export const whiteBehind: Script = async (d) => {
  await d.say(['Derrière, il n\'y a rien. Du blanc, épais.', 'Tu as dit oui. Ce chemin-là n\'a jamais été dessiné.']);
};

export const portalDoor: Script = async (d) => {
  await d.say(['La porte par laquelle tu es entré.', 'Elle ne s\'ouvre que dans un sens. Derrière, le thermomètre affiche toujours « 38,4 ».']);
};

// ---------------------------------------------------------------------------------------------------------------------
// sas — the rooms
// ---------------------------------------------------------------------------------------------------------------------

export const s1Enter: Script = async (d) => {
  await d.say(['Sas 1. Une pièce étroite, deux portes.', 'Une affiche plastifiée, à hauteur d\'yeux.']);
};

export const s2Enter: Script = async (d) => {
  await d.say('Sas 2. Il fait plus froid. Les bâches bougent alors qu\'il n\'y a pas d\'air.');
};

export const s3Enter: Script = async (d) => {
  await d.say(['Sas 3. Une petite lumière par terre, un radiateur, une affiche de crêpes.', 'Quelqu\'un a essayé de rendre cette pièce gentille.']);
};

export const s4Enter: Script = async (d) => {
  await d.say(['Sas 4. Le givre monte le long des bâches.', 'Au fond, la dernière porte. Derrière, il fait encore plus blanc.']);
};

export const l2Enter: Script = async (d) => {
  await d.say('Un vestiaire. Des blouses de papier jaune, des masques, un miroir.');
};

export const l3Enter: Script = async (d) => {
  await d.say('Les lavabos. Une affiche montre comment se laver les mains, en six dessins.');
};

export const thermoBlock: Script = async (d) => {
  if (flag('c5_thermo_fait')) return;
  if (!flag('c5_thermo_vu')) {
    d.set('c5_thermo_vu');
    await d.say(['Un thermomètre te barre le passage. Il a des bras.', 'Sur son écran : « 38,4 ».']);
    await d.say('Tu as dit que tu avais de la fièvre. Alors dis-le-lui.', 'dodo');
  }
  const r = await d.battle(['thermometre']);
  if (r.outcome === 'spare' || r.outcome === 'win') {
    d.set('c5_thermo_fait');
    d.remove('thermometre');
    d.remove('thermo_barriere');
    await d.say(r.outcome === 'spare' ? 'Le passage est libre. Tu as dit le mot, et le monde ne s\'est pas écroulé.' : 'Le passage est libre. Sur le sol, l\'écran éteint.');
  }
};

export const reception: Script = async (d) => {
  const n = bump('c5_guichet');
  if (n === 1) {
    await d.say(['Le guichet de l\'accueil. Le store est baissé.', 'Sur le rebord, une sonnette.']);
    const r = await d.ask('Sonner ?', ['Sonner', 'Non'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    d.sfx('chime', { pitch: 1.8, vol: 0.4 });
    await d.wait(60);
    await d.say(['Derrière le store, une chaise roule.', '« Pour les visites, c\'est quand on va bien. Revenez quand vous irez mieux. »'], 'infirmiere');
  } else await d.say('Le store ne se relève pas. On entend quelqu\'un taper sur un clavier, très lentement.');
};

export const notice: Script = async (d) => {
  await d.say(['Une affiche plastifiée, bordée de rouge :', '{c:r}« PAS DE VISITE SI FIÈVRE, TOUX, RHUME. »{/c}']);
  if (!flag('c5_avis_vu')) {
    d.set('c5_avis_vu');
    await d.say(['Trois dessins barrés : un thermomètre, un nuage de toux, un mouchoir.', 'Tu connais cette affiche par cœur. Tu l\'as lue en entrant, la semaine 5. Tu as mis ton masque. Tu es entré quand même.']);
  }
};

export const handNotice: Script = async (d) => {
  await d.say(['« Lavage des mains : 30 secondes. »', 'Trente secondes. Tu sais compter jusqu\'à trente, maintenant.']);
};

export const waitingChairs: Script = async (d) => {
  const n = bump('c5_chaises');
  if (n === 1) await d.say(['Des chaises fixées à une barre, pour qu\'on ne puisse pas les rapprocher.', 'Sur l\'une d\'elles, un manteau beige, plié. Il a gardé la forme de deux épaules.']);
  else await d.say('Tu t\'assois. De là, on voit la porte. On attend que quelqu\'un vienne dire « Vous pouvez entrer ». Personne ne vient.');
};

export const aquarium: Script = async (d) => {
  await d.say(['Un aquarium sans poissons. L\'eau est très propre.', 'Des poissons en papier sont scotchés sur la vitre, du côté de la salle d\'attente. Ils regardent l\'eau.']);
};

export const toybox: Script = async (d) => {
  await d.say(['Un coffre à jouets. Chaque jouet est emballé dans du film plastique.', 'Une étiquette : « Désinfectés. Ne pas déballer. » Personne ne joue avec.']);
};

export const fountain: Script = async (d) => {
  await d.say(['Une fontaine à eau. Des gobelets en cône.', 'Tu bois. L\'eau a le goût de rien du tout.']);
  if (G.state.hp < maxHp(G.state)) {
    G.state.hp = Math.min(maxHp(G.state), G.state.hp + 4);
    d.sfx('heal');
    await d.say('{c:g}(Tu te sens un peu mieux.){/c}');
  }
};

export const waitingTv: Script = async (d) => {
  await d.say(['La télé de la salle d\'attente. De la neige, en silence.', 'Dans la neige, par moments, on croit voir un dessin animé. Puis plus.']);
};

export const gowns: Script = async (d) => {
  const n = bump('c5_blouses');
  if (n === 1) {
    await d.say(['Des blouses en papier, jaunes. Pour les visiteurs.', 'La dernière est toute petite. Taille enfant. Elle n\'a jamais servi : les enfants n\'ont pas le droit d\'entrer.']);
    await d.say('Sauf toi. Toi, on t\'avait laissé entrer. Tu avais treize ans, tu avais l\'air grand.');
  } else await d.say('Tu enfiles une blouse. Le papier crisse. Elle te va. Elle t\'allait déjà.');
};

export const mirror: Script = async (d) => {
  const n = bump('c5_miroir');
  if (n === 1) await d.say(['Un miroir. Dedans, un garçon avec un masque.', 'Quelqu\'un a dessiné un sourire sur son masque, au feutre. Pas sur le tien. Sur le sien.']);
  else if (n === 2) await d.say(['Le garçon du miroir tousse.', 'Toi, tu ne tousses pas. Tu en es sûr.']);
  else await d.say('Le miroir s\'est embué de l\'intérieur.');
};

export const bench: Script = async (d) => {
  await d.say(['Un banc. Tu t\'assois une seconde.', 'Le plastique est froid, puis il prend ta chaleur, puis il la garde quand tu te lèves.']);
};

export const masks: Script = async (d) => {
  const n = bump('c5_masques');
  if (n === 1) {
    await d.say(['Une boîte de masques. Tu en prends un.', 'Le masque cache la bouche. Il cache aussi la toux, si on la retient bien.']);
    await d.say('Tu le mets. Tu respires ta propre chaleur.');
  } else await d.say('La boîte de masques. Il en reste beaucoup. Tout le monde en met. Tout le monde a peur de quelque chose.');
};

export const smilePoster: Script = async (d) => {
  await d.say(['Une affiche : un visage avec un masque.', '{c:b}« Un sourire, ça se voit même avec un masque ! »{/c}']);
  await d.say('Le sourire est dessiné sur le masque. Dessous, on ne sait pas.');
};

export const sink: Script = async (d) => {
  const n = bump('c5_lavabo');
  if (n === 1) {
    await d.say('Un lavabo. Tu te laves les mains.');
    d.sfx('erase', { vol: 0.4, pitch: 0.7 });
    await d.say(['Les paumes. Le dos. Entre les doigts. Les pouces. Les ongles.', 'L\'eau est blanche. Elle ne mouille pas : elle recouvre.']);
    await d.say('Tes mains sont toutes blanches, maintenant. Propres. Dessinées au stylo bleu, comme le reste.');
  } else await d.say('Tu te relaves les mains. Il n\'y a plus rien à enlever. Tu frottes quand même.');
};

export const sanitizer: Script = async (d) => {
  await d.say(['Un distributeur de gel. Tu appuies. Ça sent l\'alcool, fort.', 'Ça te pique les yeux. L\'odeur de là-bas, exactement.']);
};

export const bin: Script = async (d) => {
  await d.say(['Une poubelle à pédale. Dedans, des masques usagés.', 'Sur l\'un d\'eux, un sourire au feutre, à moitié effacé.']);
};

export const intercom: Script = async (d) => {
  const n = bump('c5_interphone');
  if (n === 1) {
    d.sfx('static', { vol: 0.3 });
    await d.say('Tu appuies sur le bouton de l\'interphone. Grésillement.');
    await d.say(['« Oui ? »', '« …Vous êtes qui ? »'], 'infirmiere');
    await d.say('« Le grand frère ? Attendez. »', 'infirmiere');
    await d.wait(90);
    await d.say('Personne ne revient.');
  } else await d.say('L\'interphone grésille tout seul. Une voix demande « Vous êtes qui ? », encore, encore.');
};

export const sheetTrolley: Script = async (d) => {
  await d.say(['Un chariot de draps propres, pliés au carré.', 'Tu les comptes sans le vouloir. Quarante et un. Ils sont tous plats.']);
};

export const frozenTrolley: Script = async (d) => {
  await d.say(['Le même chariot. Les draps ont gelé.', 'Ils ont pris la forme de la glace, pas la forme de quelqu\'un.']);
};

export const wallThermo: Script = async (d) => {
  await d.say(['Un thermomètre mural. Il indique la température de la pièce.', 'Il indique « 38,4 ». Tu regardes à nouveau : 19 degrés.']);
};

export const radiator: Script = async (d) => {
  const n = bump('c5_radiateur');
  if (n === 1) await d.say(['Un radiateur. Froid.', 'Tu poses la main dessus. Il ne cogne pas. Celui-là, non.']);
  else await d.say('Tu frappes deux coups sur le radiateur. Toc toc. Le métal ne répond pas. Il n\'a jamais répondu à personne.');
};

export const crepePoster: Script = async (d) => {
  await d.say(['Une affiche : {c:y}« Le mercredi, crêpes ! »{/c}', 'Quelqu\'un a dessiné des yeux et un sourire sur la crêpe. Et une petite couronne.']);
  await d.say('Tu souris derrière ton masque. Personne ne le voit. Ça compte quand même.');
};

export const lakeNotice: Script = async (d) => {
  await d.say(['Une affiche, à moitié recouverte de givre :', '{c:r}« ACCÈS AU LAC. NE PAS TOUCHER LA NEIGE. »{/c}']);
  await d.say('Mina n\'avait pas le droit de toucher la neige. « Avec ses globules. » C\'est tout ce qu\'on t\'avait dit.');
};

// ---------------------------------------------------------------------------------------------------------------------
// lac_blanc — the snow, the thread, the snowfall in figures
// ---------------------------------------------------------------------------------------------------------------------

/** The snowfall patterns of the lake (tile offsets around Noa). */
const SNOW_PATTERNS: Array<{ name: string; cells: (cx: number, cy: number) => Array<[number, number]> }> = [
  { name: 'anneau', cells: (cx, cy) => square(cx, cy, 2).filter(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) === 2) },
  { name: 'ligne', cells: (cx, cy) => Array.from({ length: 13 }, (_, i) => [cx - 6 + i, cy] as [number, number]).concat(Array.from({ length: 13 }, (_, i) => [cx - 6 + i, cy - 3] as [number, number])) },
  { name: 'colonne', cells: (cx, cy) => Array.from({ length: 9 }, (_, i) => [cx, cy - 4 + i] as [number, number]).concat(Array.from({ length: 9 }, (_, i) => [cx + 3, cy - 4 + i] as [number, number])) },
  { name: 'damier', cells: (cx, cy) => square(cx, cy, 3).filter(([x, y]) => (x + y) % 2 === 0) },
  { name: 'croix', cells: (cx, cy) => square(cx, cy, 4).filter(([x, y]) => x === cx || y === cy) },
];
function square(cx: number, cy: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) out.push([x, y]);
  return out;
}

/** Tiles where snow can fall (the thread, the floor and the shore are safe). */
const snowable = (x: number, y: number): boolean => {
  const id = world.tilemap.ids[y]?.[x];
  return id === 'c5_glace' || id === 'c5_neige';
};

/** Hurts Noa a little (never below 1 HP: the white hurts, it does not kill). */
function frostbite(d: Director, n: number, why: 'neige' | 'flocon'): void {
  const s = G.state;
  if (s.hp <= 1) return;
  s.hp = Math.max(1, s.hp - n);
  world.player.flash = 14;
  audio.sfx('hurt', { pitch: 1.4, vol: 0.5 });
  fx.shake(1, 6);
  fx.flash('#ffffff', 10, 0.3);
  if (!flag('c5_neige_vue')) {
    d.set('c5_neige_vue');
    void world.hooks.run(async (dd) => {
      await dd.say(why === 'neige' ? ['Tu as marché dans la neige.', 'Ça ne mouille pas. Ça brûle.'] : ['Un flocon t\'a touché.', 'Ça ne mouille pas. Ça brûle, comme du froid qu\'on aurait fait chauffer.']);
      await dd.say(tf('{c:r}(PV : {0}/{1}){/c} Le fil rouge, lui, ne laisse pas tomber la neige sur toi.', s.hp, maxHp(s)));
      if (s.armor === 'cape') await dd.say('La cape de Mina te protège un peu. « Ça protège de tout. Enfin, presque tout. »');
    });
  } else if (s.hp <= Math.ceil(maxHp(s) / 4) && !flag('c5_neige_froid')) {
    d.set('c5_neige_froid');
    void world.hooks.run(async (dd) => {
      await dd.say(tf('Tu as froid jusqu\'aux os. {c:r}(PV : {0}/{1}){/c}', s.hp, maxHp(s)));
    });
  }
}

/** The invisible controller of the lake: snow underfoot, and flakes falling in figures (markers, then the fall). */
function lakeHazards(d: Director): void {
  d.remove('neige_ctl');
  const ctl = d.spawn({ id: 'neige_ctl', x: 0, y: 0, solid: false, shadow: false });
  ctl.visible = false;
  let t = 0;
  let underfoot = 0;
  let phase: 'calme' | 'alerte' | 'chute' = 'calme';
  let pt = 0;
  let cells: Array<[number, number]> = [];
  let marks: Entity[] = [];
  let pat = 0;
  const clear = (): void => {
    for (const m of marks) world.removeEntity(m);
    marks = [];
    cells = [];
    phase = 'calme';
    pt = 0;
  };
  ctl.brain = () => {
    if (world.map?.id !== 'lac_blanc') return;
    const p = world.player;
    const tx = tileOf(p.x);
    const ty = tileOf(p.y - 2);
    // Inside the parents' room, or before the lake was entered: nothing falls.
    if (tx >= 52 || !flag('c5_lac') || flag('c5_fin')) {
      if (marks.length) clear();
      return;
    }
    if (!world.controllable) return;
    t++;
    const cape = G.state.armor === 'cape';
    // Snow underfoot.
    if (world.tilemap.ids[ty]?.[tx] === 'c5_neige') {
      underfoot++;
      if (underfoot >= (cape ? 110 : 60)) {
        underfoot = 0;
        frostbite(d, 1, 'neige');
      }
    } else underfoot = Math.max(0, underfoot - 3);
    // Flakes in figures.
    if (phase === 'calme' && t % 330 === 120 && snowable(tx, ty) === snowable(tx, ty)) {
      const shape = SNOW_PATTERNS[pat++ % SNOW_PATTERNS.length]!;
      cells = shape.cells(tx, ty).filter(([x, y]) => snowable(x, y));
      if (!cells.length) return;
      phase = 'alerte';
      pt = 0;
      for (const [x, y] of cells) {
        const m = d.spawn({ id: `cible_${x}_${y}`, sprite: 'c5_cible', x, y, solid: false, shadow: false });
        m.y -= 4;
        m.layer = -1;
        marks.push(m);
      }
      audio.sfx('chime', { pitch: 2, vol: 0.15 });
    } else if (phase === 'alerte') {
      pt++;
      for (const m of marks) m.visible = pt % 16 < 11 || pt > 60;
      if (pt >= 80) {
        phase = 'chute';
        pt = 0;
        for (const m of marks) {
          m.sprite = 'c5_flocon';
          m.layer = 1;
          m.oy = -60;
          m.visible = true;
        }
      }
    } else if (phase === 'chute') {
      pt++;
      for (const m of marks) m.oy = Math.min(0, -60 + pt * 4);
      if (pt === 15) {
        audio.sfx('erase', { vol: 0.25, pitch: 1.6 });
        if (cells.some(([x, y]) => x === tx && y === ty)) frostbite(d, cape ? 1 : 2, 'flocon');
      }
      if (pt >= 34) clear();
    }
  };
}

export const lakeEnter: Script = async (d) => {
  lakeHazards(d);
  const p = world.player;
  if (tileOf(p.x) < 52) floatingDodo(d);
  else d.remove('dodo');
  // Out of the airlock: the first look at the lake (the snow only falls from then on).
  if (!flag('c5_lac') && tileOf(p.x) < 6) {
    await d.wait(20);
    await lakeFirst(d);
  }
};

export const lakeFirst: Script = async (d) => {
  d.set('c5_lac');
  await d.say(['Un lac. À l\'intérieur de l\'hôpital.', 'Gelé, d\'un bord à l\'autre. Des bâches tout autour, à la place des murs.']);
  await d.say(['Il neige. Il neige à l\'intérieur.', 'Par plaques, la neige s\'est posée sur la glace. Elle est plus blanche que le reste. Elle brille.']);
  await d.say(['Le fil rouge traverse le lac, en zigzag, entre les plaques de neige.', 'Au milieu, une boîte de verre. Plus loin, une cabane de bâches, avec une fenêtre allumée.']);
  await d.say('Ne touche pas la neige.', 'dodo');
};

export const lakeBackDoor: Script = async (d) => {
  await d.say(['La porte du sas s\'est refermée derrière toi.', 'De ce côté, il n\'y a pas de poignée. Il n\'y en a jamais eu.']);
};

export const lakeBench: Script = async (d) => {
  await d.say(['Un banc au bord du lac, comme dans un parc.', 'Une plaque vissée au dossier : « En souvenir de ». Le nom a été passé au blanc.']);
};

export const lakeSign: Script = async (d) => {
  await d.say(['Un panneau :', '{c:r}« LAC BLANC. Ne pas toucher la neige. Rester sur le chemin. »{/c}']);
  await d.say('Le chemin, c\'est le fil. Quelqu\'un a ajouté une flèche au stylo, qui suit le fil.');
};

export const frozenDrips: Script = async (d) => {
  await d.say(['Des pieds à perfusion, plantés dans la glace comme des roseaux.', 'Les poches sont gelées. Dedans, l\'eau a pris en cristaux, en forme de fleurs.']);
};

export const wheelchair: Script = async (d) => {
  await d.say(['Un fauteuil roulant pris dans la glace jusqu\'aux roues.', 'Sur le dossier, un autocollant de licorne, à moitié décollé. Tu ne le décolles pas.']);
};

export const snowman: Script = async (d) => {
  const n = bump('c5_bonhomme');
  if (n === 1) {
    await d.say(['Un bonhomme de neige. Petit. Fait par des mains d\'enfant.', 'Il porte un masque chirurgical. Quelqu\'un a dessiné un sourire sur le masque. Et une couronne en papier sur sa tête.']);
    await d.say('Elle n\'avait pas le droit de toucher la neige.');
  } else await d.say('Le bonhomme te regarde. Il a des yeux de bouton. Il sourit sur son masque, comme tout le monde ici.');
};

export const bootPrints: Script = async (d) => {
  await d.say(['Dans la neige, des empreintes de petites bottes.', 'Deux pas. Puis plus rien. Comme si quelqu\'un était venu, rien que pour voir, et qu\'on l\'avait rattrapé.']);
};

export const iceHole: Script = async (d) => {
  await d.say(['Un trou rond dans la glace. Dessous, de l\'eau noire.', 'Rien ne bouge dedans. Puis quelque chose de noir remonte, comme un gribouillage, et redescend.']);
  await d.say('Ne t\'approche pas. Ça, ce n\'est même pas à moi.', 'dodo');
};

// ---------------------------------------------------------------------------------------------------------------------
// lac_blanc — the drawings to correct
// ---------------------------------------------------------------------------------------------------------------------

const DRAWING_TEXT: Record<DrawingId, { look: string[]; fixed: string[] }> = {
  maman: {
    look: ['Un dessin de Mina : Maman endormie dans le fauteuil des parents, une couverture sur les genoux.', 'Elle a dessiné ses cernes en violet, très appliquée. La lune, par la fenêtre.'],
    fixed: ['Maman dort toujours dans le fauteuil.', 'À côté d\'elle, au stylo noir, quelqu\'un se tient debout. Trop grand. Sans visage. Il la regarde dormir.'],
  },
  nadia: {
    look: ['Nadia, l\'infirmière de nuit, avec sa lampe de poche et un sourire immense.', 'Écrit au-dessus, en bleu : {c:b}« NADIA ELLE SAIT TOUT »{/c}.'],
    fixed: ['Nadia sourit toujours.', 'Derrière elle, au stylo noir, une silhouette qui dépasse le cadre. Nadia ne la voit pas. Nadia qui sait tout.'],
  },
  mina: {
    look: ['Mina s\'est dessinée elle-même : dans son lit, avec son bonnet à oreilles de mouton.', 'Elle s\'est fait un très grand sourire. Elle a écrit {c:r}« MOI »{/c}, avec une flèche.'],
    fixed: ['Mina, dans son lit.', 'Au bord du lit, la silhouette noire, trop grande, penchée sur elle. Sans visage. Elle a l\'air de veiller. Elle a l\'air de quelque chose.'],
  },
  chaise: {
    look: ['Une chaise vide, dessinée au crayon marron.', 'Au-dessus, en lettres bleues tremblées : {c:b}« NOA »{/c}. La chaise est tournée vers le lit. Il n\'y a personne dessus.'],
    fixed: ['La chaise « NOA ».', 'Il y a quelqu\'un dessus, maintenant. Trop grand pour la chaise. Les bras jusqu\'aux genoux. Pas de visage. C\'est toi.'],
  },
  plage: {
    look: ['La plage. Maman, Mina avec sa couronne, le soleil, la mer.', 'Tout au bout, tout petit, un garçon tourné de l\'autre côté. Elle a écrit à côté : {c:b}« NOA IL BOUDE »{/c}.'],
    fixed: ['La plage. Maman, Mina, le soleil.', 'Entre elles, au stylo noir, une grande silhouette sans visage. Le petit garçon qui boudait n\'est plus là. Tu l\'as recouvert.'],
  },
};

/** One of the five drawings taped to the tarps. Dodo holds out Mina's crayon. */
export const drawing =
  (id: DrawingId): Script =>
  async (d) => {
    const txt = DRAWING_TEXT[id];
    if (flag(`c5_corrige_${id}`)) {
      await d.say(txt.fixed);
      return;
    }
    await d.say(txt.look);
    if (!flag('c5_crayon')) {
      d.set('c5_crayon');
      const dodo = d.find('dodo');
      if (dodo) {
        dodo.data.parked = true;
        await d.walkTo('dodo', tileOf(world.player.x) + 1, tileOf(world.player.y) - 1, 0.8);
      }
      await d.say(['Dodo te tend un crayon. Un stylo bille noir, mâchouillé au bout.', 'Il le tient entre ses pattes, comme un cadeau.']);
      await d.say(['Dessine-toi dedans.', 'Personne ne saura.'], 'dodo:happy');
      await d.say(['Tu y étais, de toute façon. Tu y étais en pensée.', 'C\'est presque pareil. C\'est même mieux : tu étais là sans la rendre malade.'], 'dodo');
      if (dodo) dodo.data.parked = false;
    }
    const r = await d.ask('Te dessiner dedans ?', ['Me dessiner dedans', 'Laisser le dessin comme il est'], undefined, { cancelIndex: 1 });
    if (r !== 0) {
      d.set(`c5_laisse_${id}`);
      await d.say(flag(`c5_laisse_vu`) ? 'Tu laisses le dessin comme elle l\'a fait.' : ['Tu laisses le dessin comme elle l\'a fait.', 'Sans toi dedans. C\'est elle qui l\'a dessiné. C\'est sa vérité à elle.']);
      if (!flag('c5_laisse_vu')) {
        d.set('c5_laisse_vu');
        await d.say('Comme tu veux. Le crayon reste là. Il attendra.', 'dodo');
      }
      return;
    }
    const dt = DrawTogetherScene.open('corriger', id);
    const done = await dt.correct();
    dt.close();
    if (!done) {
      await d.say('Tu reposes le stylo avant la première ligne.');
      return;
    }
    d.set(`c5_corrige_${id}`);
    const n = bump('c5_corrige');
    G.state.etoiles += 2;
    d.sfx('heal', { pitch: 1.2 });
    const e = world.get(`dessin_${id}`);
    if (e) e.sprite = `prop_c5_dessin_${id}_corrige`;
    await d.say(tf('Un petit son chaud. Ça fait du bien. {c:y}(+2 Étoiles){/c}'));
    if (n === 1) await d.say(['Voilà. Tu y étais.', 'Tu y as toujours été.']);
    else if (n === 2) await d.say('Voilà. Là aussi, tu y étais.');
    else if (n === 3) await d.say(['Tu y étais. Tu y étais. Tu y étais.', 'C\'est tellement plus facile à dessiner qu\'à faire.'], 'dodo:happy');
    else await d.say('Tu y étais. Ça devient vrai, à force.', 'dodo:creepy');
    await d.say(['La silhouette est trop grande pour le dessin.', 'Elle n\'a pas de visage. Elle te ressemble quand même.']);
  };

export const shoreEnter: Script = async (d) => {
  await d.say(['Le long des bâches, des dessins scotchés. Cinq.', 'Les dessins de Mina. Ceux qui étaient au mur de la 304.']);
};

export const dodoCrayon: Script = async (d) => dodoTalk(d);

// ---------------------------------------------------------------------------------------------------------------------
// lac_blanc — the parents' room (T6)
// ---------------------------------------------------------------------------------------------------------------------

export const hutDoor: Script = async (d) => {
  if (!flag('c5_cabane_vue')) {
    d.set('c5_cabane_vue');
    await d.say(['Une cabane de bâches, sur la glace.', 'Une pancarte : {c:b}« SALLE DES PARENTS »{/c}. La fenêtre est allumée, jaune. La seule chose jaune, ici.']);
  }
  await d.warp('lac_blanc', 'cabane_dedans', { sfx: 'door' });
  if (!flag('c5_cabane_dedans')) {
    d.set('c5_cabane_dedans');
    await d.say(['Une petite pièce. Un fauteuil qui se déplie en lit. Un distributeur. Une machine à café.', 'Ça sent le café froid et la lessive. Ça sent Maman.']);
  }
};

export const hutLeave: Script = async (d) => {
  await d.warp('lac_blanc', 'cabane', { sfx: 'door' });
};

export const armchair: Script = async (d) => {
  if (flag('c5_parents')) {
    await d.say(['Le fauteuil des parents. Il a la forme de Maman.', 'Quarante et une nuits. Tu t\'assois au bord, sans t\'enfoncer.']);
    return;
  }
  await d.say(['Le fauteuil des parents. Il se déplie en lit, mal.', 'Une couverture bleue, pliée. Un oreiller plat qui a gardé un creux.']);
  const r = await d.ask('T\'asseoir ?', ['M\'asseoir', 'Non'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  await parentsRoom(d);
};

/** T6 « Il est venu »: the voices through the partition. */
async function parentsRoom(d: Director): Promise<void> {
  d.set('c5_parents');
  const p = world.player;
  p.x = 62 * TILE + 8;
  p.y = 27 * TILE + 14;
  p.dir = 'down';
  audio.setAmbience('none');
  await d.say(['Tu t\'assois. Le fauteuil s\'enfonce, tiède.', 'Il est encore tiède. Après un an.']);
  await d.wait(60);
  d.sfx('door', { pitch: 0.6, vol: 0.3 });
  await d.say('De l\'autre côté de la cloison, une porte se ferme. Des pas. Deux voix. La grille d\'aération laisse tout passer.');
  await d.wait(40);
  await d.say(['Avec ses globules, ça peut venir de partout.', 'De sa propre peau, souvent.'], 'medecin');
  await d.wait(50);
  await d.say(['Il croit que c\'est lui.', 'Il a treize ans, il se croit contagieux pour toujours. Il ne veut plus venir.'], 'mamanvoix');
  await d.wait(80);
  await d.say('La porte, à nouveau. Le médecin est parti. Une seule voix, maintenant. Plus bas. Elle téléphone.');
  await d.wait(40);
  await d.say(['Elle m\'a fait promettre.', '« Dis pas à Noa que je guéris pas. »'], 'mamanvoix');
  await d.wait(40);
  await d.say('Alors je lui dis qu\'elle va mieux.', 'mamanvoix');
  await d.wait(120);
  await d.say('…', 'noa:sad');
  await d.wait(40);
  await d.say(['« Elle va mieux. »', 'Tu l\'avais écrit sur ton calendrier. Avec deux points d\'exclamation.']);
  await d.say(['« De sa propre peau, souvent. »', 'Tu n\'avais entendu que le mot « infection ». Le reste, tu l\'avais laissé de l\'autre côté de la cloison.']);
  await d.wait(60);
  // The breath after it: the blanket.
  await d.say(['La couverture bleue glisse du dossier et tombe sur tes genoux.', 'Personne ne l\'a poussée. Elle est tombée comme tombent les couvertures, au bout d\'un moment.']);
  await d.say('Tu la laisses. Il fait moins froid, comme ça.');
  audio.setAmbience('wind');
  await d.wait(30);
  const dodo = floatingDodo(d, 63, 27);
  dodo.data.parked = true;
  await d.say(['Tu vois ?', 'Même eux mentaient. Même elle.'], 'dodo');
  await d.say(['Alors un dessin de plus, un dessin de moins…', 'Qu\'est-ce que ça change ?'], 'dodo:happy');
  dodo.data.parked = false;
}

export const vent: Script = async (d) => {
  if (flag('c5_parents')) await d.say('La grille d\'aération. De l\'autre côté, plus rien. Le silence passe aussi bien que les voix.');
  else await d.say(['Une grille d\'aération dans la cloison.', 'De l\'autre côté, on entend une machine respirer. Bip. Bip.']);
};

export const vending: Script = async (d) => {
  if (!flag('c5_distributeur')) {
    d.set('c5_distributeur');
    await d.say(['Un distributeur rouge. Il ronronne.', 'Une étiquette sur la vitre : « N\'accepte que les boutons ». Quelqu\'un a ajouté au stylo : « et les sourires ».']);
  }
  await shop(['chocolat', 'lait', 'biscuit', 'bonbon', 'mouchoir', 'pluie'], '* Le distributeur ronronne. Ses lumières clignotent dans l\'ordre, toujours le même.', 'la Machine');
};

export const coffee: Script = async (d) => {
  await d.say(['La machine à café. Le bouton « court » est usé jusqu\'au blanc.', 'Maman le prenait court. Pour ne pas s\'endormir. Pour s\'endormir quand même.']);
};

export const cups: Script = async (d) => {
  const n = bump('c5_gobelets');
  if (n === 1) {
    await d.say(['Des gobelets en carton, empilés en pyramide à côté de la machine.', 'Tu les comptes. Quarante et un.']);
    await d.say('Un par nuit.');
  } else await d.say('Tu n\'y touches pas. Si tu en retires un, tout tombe.');
};

export const visitPlanning: Script = async (d) => {
  await d.say(['« HORAIRES DES VISITES. Frères et sœurs : le samedi, accompagnés. »', 'Quelqu\'un a entouré « samedi » au stylo rouge, plusieurs fois, et écrit à côté : {c:r}« il viendra ? »{/c}']);
  await d.say('L\'écriture est petite et ronde. Les « i » ont des cœurs à la place des points.');
};

export const familyPhone: Script = async (d) => {
  await d.say(['« Téléphone des familles ». Le combiné pend au bout de son fil.', 'Tu le portes à ton oreille. La tonalité. Rien d\'autre.']);
  await d.say('Tu raccroches avant qu\'elle s\'arrête.');
};

export const coat: Script = async (d) => {
  const n = bump('c5_manteau');
  if (n === 1) {
    await d.say(['Le manteau de Maman, sur le dossier d\'une chaise.', 'Il a gardé la forme de ses épaules. Il les garde depuis un an.']);
    await d.say(['Dans la poche, un papier plié. Son écriture :', '{c:p}« Ne pas lui dire. Pas encore. Pas maintenant. »{/c}']);
    await d.say('« Pas encore » est souligné deux fois. « Pas maintenant », trois.');
  } else await d.say('Tu remets le papier dans la poche. Exactement comme il était.');
};

// ---------------------------------------------------------------------------------------------------------------------
// lac_blanc — the glass box
// ---------------------------------------------------------------------------------------------------------------------

export const glassDoor: Script = async (d) => {
  if (!flag('c5_parents')) {
    await d.say(['Une porte de verre. Embuée de l\'intérieur.', 'Sur la buée, au doigt, une flèche vers la cabane. Et deux mots : « PAS ENCORE ».']);
    return;
  }
  if (flag('c5_vitre_fait')) {
    await d.say('La boîte de verre. Elle est vide, maintenant. Toute la buée est de ton côté.');
    return;
  }
  await d.say(['La porte de verre glisse.', 'Dedans, il fait chaud. Ça sent le crayon de cire.']);
  await d.warp('chambre_verre', 'entree', { sfx: 'door' });
};

export const weekSheet: Script = async (d) => {
  if (G.state.map === 'chambre_verre' && flag('c5_visite')) {
    await d.say(['La feuille, scotchée sur la vitre.', '« Semaine 5 ». Quelqu\'un a passé du blanc sur le 5. Dessous, au stylo, d\'une main qui tremble : « 6 ».']);
    return;
  }
  await d.say(['Une feuille scotchée sur le verre :', '{c:b}« Semaine 5 »{/c}']);
};

export const plate304: Script = async (d) => {
  await d.say(['Une plaque : « 304 ».', 'Tu n\'as pas besoin de la lire. Tu l\'as toujours su, le numéro.']);
};

// ---------------------------------------------------------------------------------------------------------------------
// chambre_verre — the visit (« Semaine 5 »)
// ---------------------------------------------------------------------------------------------------------------------

export const glassRoomEnter: Script = async (d) => {
  d.remove('dodo');
  if (!flag('c5_visite')) {
    if (!flag('c5_verre_intro')) {
      d.set('c5_verre_intro');
      await d.wait(20);
      await d.say(['La chambre 304. En verre.', 'Les murs, le plafond, la porte : tout est en verre. Dehors, le lac et la neige, de tous les côtés.']);
      await d.say(['Au milieu, à une petite table, quelqu\'un dessine.', 'Une silhouette. Un bonnet tricoté, avec deux oreilles de mouton.']);
      await d.say('Une voix, dans ton dos. Une infirmière, qui passe.');
      await d.say(['Tu vas bien, toi ?', 'Pas de rhume ?'], 'infirmiere');
      await d.say('Je vais bien.', 'noa:neutral');
      if (flag('c5_fievre')) await d.say('Tu l\'as dit. Au portail, tu avais dit le contraire. Ici, c\'est la semaine 5 : ici, tu dis « je vais bien ».');
      else await d.say('Tu l\'as dit vite. Comme au portail. Ça sort tout seul, à force.');
    }
    return;
  }
  if (!flag('c5_vitre_fait')) {
    const door = d.find('porte_vitre');
    if (door) {
      door.sprite = 'prop_c5_porte_verre';
      door.solid = true;
    }
  }
};

export const silhouetteTalk: Script = async (d) => {
  await visit(d);
};

export const drawTable: Script = async (d) => {
  await visit(d);
};

/** The drawing game: the moon, her, him, the cough, the nurse's shadow; the drawing stops where chapter 2 found it. */
async function visit(d: Director): Promise<void> {
  if (flag('c5_visite')) return;
  await d.say('T\'es venu !', 'minavoix');
  await d.say(['La silhouette lève la tête. Elle n\'a pas de visage. Juste la forme d\'un bonnet, et de deux épaules.', 'Elle a la voix de Mina.']);
  await d.say(['T\'as un masque, toi aussi ! On est pareils.', 'On fait un dessin ? Un grand. Deux enfants sous une grande lune.'], 'minavoix');
  const r = await d.ask('Dessiner avec elle ?', ['Dessiner', 'Dessiner quand même']);
  void r;
  // Sit at the table.
  const p = world.player;
  p.x = 12 * TILE + 8;
  p.y = 7 * TILE + 14;
  p.dir = 'up';
  await d.wait(20);
  const dt = DrawTogetherScene.open('visite');
  await d.say('Toi tu fais la lune. Moi je la colorie. Mais tu la fais grande, hein.', 'minavoix');
  await dt.stroke('lune');
  if (dt.result.crossed) await d.say(['Tes crayons et les miens, ils se sont touchés.', 'Ça compte comme un bisou.'], 'minavoix');
  else await d.say('T\'es allé trop vite. C\'est pas grave. Elle est belle quand même.', 'minavoix');
  await dt.watch('elle');
  await d.say(['Voilà, c\'est moi. Avec ma couronne.', 'À toi. Fais-toi à côté. Tu me donnes la main, hein.'], 'minavoix');
  await dt.stroke('lui', { cough: 0.55 });
  d.sfx('cough', { vol: 0.7 });
  await d.wait(30);
  await d.say('Noa ?', 'minavoix');
  await dt.shadow();
  await d.say(['Le grand frère, il tousse ?', 'Dehors, s\'il te plaît.'], 'infirmiere');
  await d.say('Je vais b—', 'noa:sad');
  d.sfx('cough', { vol: 0.5, pitch: 0.9 });
  await d.say('Dehors. Tout de suite.', 'infirmiere');
  await d.wait(30);
  await dt.reveal();
  await d.say(['Le dessin s\'arrête là. Exactement là.', 'Tu l\'as déjà vu, ce dessin. Dans la forêt de crayons. Il n\'a jamais été fini.']);
  dt.close();
  d.set('c5_visite');
  d.souvenir('dessin');
  await d.fadeOut(40, '#ffffff');
  d.load('chambre_verre', 'vitre');
  const door = d.find('porte_vitre');
  if (door) {
    door.sprite = 'prop_c5_porte_verre';
    door.solid = true;
  }
  await d.fadeIn(40);
  await d.say(['Tu es dehors. Dans le sas. La porte de verre s\'est refermée.', 'Sur ta manche, une tache d\'encre bleue. Là où tu as toussé.']);
  floatingDodo(d, 13, 13).data.parked = true;
  await d.wait(30);
  await d.say(['Ce n\'est pas elle.', 'C\'est ton dessin d\'elle.'], 'dodo:creepy');
  const dd = d.find('dodo');
  if (dd) dd.data.parked = false;
}

export const glassBed: Script = async (d) => {
  if (flag('c5_visite')) await d.say(['Le lit, de l\'autre côté de la vitre.', 'Le drap est tiré, bien à plat.']);
  else await d.say(['Le lit de la 304. Les barrières sont relevées.', 'Sur l\'oreiller, un mouton en peluche, rond, tout neuf.']);
};

export const dodoOnPillow: Script = async (d) => {
  await d.say(['Sur l\'oreiller, Dodo. Le vrai. Rond, propre, la laine bien blanche.', 'Tu le lui avais prêté la première semaine. « Il veillera sur toi. »']);
  await d.say('Tout bas, tu avais ajouté : « Comme ça, t\'as pas besoin de moi. »');
};

export const drip: Script = async (d) => {
  await d.say(['Un pied à perfusion. Une poche de liquide clair, un tuyau qui descend vers le lit.', 'Le tuyau s\'arrête au bord du drap. Tu ne regardes pas plus loin.']);
};

export const glassTv: Script = async (d) => {
  await d.say(['La télé, sur son bras articulé. Un dessin animé, sans le son.', 'Un mouton saute une barrière. Un autre. Un autre. On ne sait plus qui compte.']);
};

export const nightstand: Script = async (d) => {
  await d.say(['La table de chevet. Des crayons, un verre avec une paille, un carnet.', 'Pas de veilleuse. La semaine 5, la veilleuse était chez toi. Sur ta table de nuit à toi.']);
};

export const drawingsOnGlass: Script = async (d) => {
  await d.say(['Des dessins scotchés sur la vitre du fond, tournés vers dehors.', 'Pour que les gens du lac les voient. Il n\'y a personne sur le lac.']);
};

export const antechamberBench: Script = async (d) => {
  await d.say(['Le banc du sas. On s\'y assoit pour mettre les surchaussures.', 'Tu t\'y es assis longtemps, une fois. Plus longtemps que la visite.']);
};

export const vitreDoor: Script = async (d) => {
  if (!flag('c5_visite')) {
    await d.say('La porte de verre est ouverte. Le dessin attend sur la table.');
    return;
  }
  const n = bump('c5_porte_vitre');
  await d.say(['La porte de verre. Fermée.', 'Ta main s\'arrête à un centimètre de la poignée.']);
  if (n === 1) await d.say('Tu ne peux pas l\'ouvrir. Elle est fermée à clé.');
  else if (n === 2) await d.say(['Il n\'y a pas de serrure.', 'Tu n\'as pas envie de l\'ouvrir. C\'est tout.']);
  else await d.say('Tu regardes ta main. Elle ne tremble même pas. Elle s\'arrête, c\'est tout.');
};

// ---------------------------------------------------------------------------------------------------------------------
// chambre_verre — La Vitre, souvenir 5, the fall
// ---------------------------------------------------------------------------------------------------------------------

export const vitreApproach: Script = async (d) => {
  if (flag('c5_vitre_fait') || !flag('c5_visite')) return;
  await d.say(['Tu t\'approches de la vitre. Elle s\'embue à chaque respiration.', 'Tu arrêtes de respirer. La buée s\'en va. Tu respires. Elle revient.']);
  const sil = d.spawn({ id: 'sil_vitre', sprite: 'npc_c5_silhouette', frames: ['npc_c5_silhouette', 'npc_c5_silhouette_2'], frameSpeed: 40, x: 12, y: 9, shadow: false, solid: false });
  sil.alpha = 0;
  for (let i = 1; i <= 20; i++) {
    sil.alpha = i / 20;
    await d.wait(3);
  }
  await d.say(['De l\'autre côté, la silhouette au bonnet.', 'Ce n\'est plus la semaine 5. C\'est plus tard. C\'est la dernière fois que tu es venu.']);
  d.spawn({ id: 'empreinte', sprite: 'prop_c5_empreinte', x: 11, y: 10, solid: false, shadow: false }).layer = 1;
  d.sfx('knock1', { vol: 0.4 });
  await d.say(['Elle pose sa main à plat sur la vitre.', 'Elle attend.']);
  await d.say('Ce jour-là, tu n\'as pas posé la tienne. Tu es reparti. Tu n\'es plus jamais revenu.');
  await d.wait(30);
  const r = await d.battle(['vitre']);
  d.set('c5_vitre_fait');
  d.remove('sil_vitre');
  d.remove('empreinte');
  const spared = r.outcome === 'spare' || G.state.flags.c5_vitre === 'epargnee';
  if (!G.state.flags.c5_vitre) d.set('c5_vitre', spared ? 'epargnee' : 'brisee');
  await souvenirVitre(d, spared);
  await theFall(d);
};

async function souvenirVitre(d: Director, spared: boolean): Promise<void> {
  const key = spared ? 'vitre' : 'vitre_brisee';
  d.souvenir(key);
  await d.image(SOUVENIRS[key]?.image ?? 'souvenir_vitre', SOUVENIRS[key]?.captions ?? []);
  await d.wait(30);
}

/** Dodo, immense above the lake, opens his own seam; the white floor turns to cotton; Noa falls (chapter 6). */
async function theFall(d: Director): Promise<void> {
  d.set('c5_fin');
  await d.fadeOut(30, '#ffffff');
  d.load('lac_blanc', 'boite');
  d.remove('dodo');
  world.player.dir = 'down';
  d.music(null);
  audio.setAmbience('wind');
  await d.fadeIn(60);
  await d.say(['Dehors, le lac. La boîte de verre est vide derrière toi.', 'Il ne neige plus. Tout est immobile.']);
  await d.wait(40);
  // The giant Dodo comes down over the lake: twice his size, too big for the screen.
  const g = d.spawn({ id: 'dodo_geant', sprite: 'c5_dodo_geant', x: 24, y: 19, solid: false, shadow: false });
  g.layer = 1;
  g.alpha = 0;
  g.scaleX = 2;
  g.scaleY = 2;
  g.y -= 120;
  d.sfx('whoosh', { pitch: 0.3, vol: 0.6 });
  d.sfx('heartbeat', { pitch: 0.6, vol: 0.5 });
  await d.cameraTo(24, 16);
  for (let i = 0; i < 60; i++) {
    g.alpha = Math.min(1, i / 30);
    g.y += 2;
    await d.wait(1);
  }
  await d.wait(20);
  await d.say(['Au-dessus du lac, Dodo.', 'Immense. Plus grand que la boîte de verre, plus grand que la cabane. Ses yeux-boutons sont grands comme des fenêtres.']);
  await d.say(['Tu vois, Noa ?', 'Tout ce que tu touches tombe malade.'], 'dodo:creepy');
  await d.say(['Ta sœur. Le dessin. La vitre.', 'Moi aussi. Regarde-moi. Je me vide un peu chaque nuit.'], 'dodo');
  await d.say(['Viens.', 'Dedans, on ne peut plus rien abîmer.'], 'dodo:happy');
  await d.wait(30);
  // He opens his seam.
  for (let k = 0; k < 6; k++) {
    d.sfx('thread', { pitch: 0.7 + k * 0.05, vol: 0.6 });
    await d.wait(10);
  }
  g.sprite = 'c5_dodo_geant_1';
  d.shake(1, 20);
  await d.say('Il passe une patte sur son ventre. Les points rouges sautent, un par un. Tac. Tac. Tac.');
  for (let k = 0; k < 8; k++) {
    d.sfx('stitch', { pitch: 0.6, vol: 0.5 });
    await d.wait(8);
  }
  g.sprite = 'c5_dodo_geant_2';
  d.shake(2, 30);
  await d.say(['La couture s\'ouvre en grand.', 'Dedans, c\'est noir et jaune. Ça sent la poussière et la lessive de Maman.']);
  // The white floor turns to cotton, from Noa outwards. The camera goes down to him; the words go up.
  const p = world.player;
  await d.cameraTo(tileOf(p.x), tileOf(p.y) - 2);
  const cx = tileOf(p.x);
  const cy = tileOf(p.y - 2);
  for (let r = 0; r <= 7; r++) {
    const cells: Array<[number, number, string]> = [];
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.hypot(x - cx, y - cy) > r + 0.5) continue;
        const id = world.tilemap.ids[y]?.[x];
        if (id && !id.startsWith('c5_vitre') && !id.startsWith('c5_verre') && id !== 'c5_mur_top') cells.push([x, y, 'c5_ouate']);
      }
    retile(cells);
    d.sfx('erase', { pitch: 0.4, vol: 0.3 });
    await d.wait(14);
  }
  await d.say(['Sous tes pieds, la glace devient molle.', 'Du coton. Jaune, tassé, tiède. Le sol blanc était du coton depuis le début.'], undefined, { pos: 'top' });
  await d.say('Tu t\'enfonces. Jusqu\'aux chevilles. Jusqu\'aux genoux. Ça ne fait pas mal. C\'est ça, le pire.', undefined, { pos: 'top' });
  await d.say('…', 'noa:sad', { pos: 'top' });
  d.sfx('whoosh', { pitch: 0.25, vol: 0.7 });
  for (let i = 0; i < 60; i++) {
    p.oy += 0.5;
    p.alpha = Math.max(0, 1 - i / 55);
    await d.wait(2);
  }
  p.oy = 0;
  p.alpha = 1;
  d.cameraFollow();
  // Chapter 6 « Le Ventre de Dodo » is STORY.dream[6] (story/index.ts): Noa falls into it without waking up.
  await fallInto(d, 6);
}

// ---------------------------------------------------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------------------------------------------------

/** After chapter 4 and Interlude IV: about 20 Étoiles, the Plume dorée, the Cape de Mina, a few items. */
function setup(flags: Record<string, number | boolean | string>): void {
  const s = G.state;
  s.chapter = 5;
  s.etoiles = 20;
  s.encre = 3;
  s.weapon = 'plume';
  s.armor = 'cape';
  s.items = ['chocolat', 'lait', 'biscuit', 'mouchoir', 'pluie'];
  s.boutons = 40;
  s.spares = { nuage: 2, mouton_noir: 1, placard: 1, gomme: 1, perfusion: 1, couseuse: 1 };
  s.party = [];
  s.flags.c3_cape = true;
  s.flags.c4_fin = true;
  s.flags.i4_fin = true;
  for (const [k, v] of Object.entries(flags)) s.flags[k] = v;
  s.hp = maxHp(s);
}

const AFTER_TIDE = { c5_intro: true, c5_sieste: true, c5_serviette: 3, c5_nulle: true, c5_maree: true, c5_drap: true, c5_coquillages: 12, c5_donnes: 12, c5_mina_parle: 4 };
const AFTER_SAS_LONG = { ...AFTER_TIDE, c5_fil_vu: true, c5_portail: true, c5_fievre: true, c5_thermo_fait: true, c5_porte_1: 'fermee', c5_porte_2: 'fermee', c5_porte_3: 'fermee', c5_porte_4: 'fermee', c5_porte_5: 'ouverte', c5_sas_dodo: true };

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {
  chapter5: async (d) => {
    setup({});
    await start(d);
  },
  /** The beach, Mina of before has had her shells: the next talk puts her to sleep on the towel (the 30 s wait). */
  chapter5_serviette: async (d) => {
    setup({ c5_intro: true, c5_mina_parle: 3, c5_coquillages: 12, c5_donnes: 12, c5_coq_0: true, c5_coq_1: true, c5_coq_2: true });
    d.load('plage', 'debut');
    world.player.x = 24 * TILE + 8;
    world.player.y = 15 * TILE + 14;
    world.player.dir = 'up';
    await d.fadeIn(10);
  },
  /** After the tide, in front of the Thermomètre's portal. */
  chapter5_portail: async (d) => {
    setup({ ...AFTER_TIDE, c5_fil_vu: true });
    d.load('plage', 'portail');
    await d.fadeIn(10);
  },
  /** The airlock, the long way (« J'ai de la fièvre »); &menti=1 for the short way. */
  chapter5_sas: async (d) => {
    const menti = new URLSearchParams(location.search).get('menti') === '1';
    setup({ ...AFTER_TIDE, c5_fil_vu: true, c5_portail: true, [menti ? 'c5_menti' : 'c5_fievre']: true });
    d.load('sas', menti ? 'court' : 'long');
    await d.fadeIn(10);
  },
  /** The white lake, just out of the airlock. */
  chapter5_lac: async (d) => {
    setup(AFTER_SAS_LONG);
    d.load('lac_blanc', 'sas');
    await d.fadeIn(10);
  },
  /** The parents' room (T6). */
  chapter5_cabane: async (d) => {
    setup({ ...AFTER_SAS_LONG, c5_lac: true, c5_rive: true, c5_cabane_vue: true });
    d.load('lac_blanc', 'cabane_dedans');
    await d.fadeIn(10);
  },
  /** The glass room before the visit (the drawing game). */
  chapter5_visite: async (d) => {
    setup({ ...AFTER_SAS_LONG, c5_lac: true, c5_rive: true, c5_parents: true, c5_corrige: 1, c5_corrige_chaise: true });
    d.load('chambre_verre', 'entree');
    await d.fadeIn(10);
  },
  /** After the visit, in front of the glass: La Vitre (&menti=1: « pardon » first). */
  chapter5_vitre: async (d) => {
    const menti = new URLSearchParams(location.search).get('menti') === '1';
    setup({ ...AFTER_SAS_LONG, c5_lac: true, c5_parents: true, c5_visite: true, c5_verre_intro: true, ...(menti ? { c5_menti: true, c5_fievre: false } : {}) });
    d.load('chambre_verre', 'vitre');
    await d.fadeIn(10);
  },
  /** Souvenir 5 and the fall (&brisee=1 for the broken glass). */
  chapter5_chute: async (d) => {
    const broken = new URLSearchParams(location.search).get('brisee') === '1';
    setup({ ...AFTER_SAS_LONG, c5_lac: true, c5_parents: true, c5_visite: true, c5_vitre_fait: true, c5_vitre: broken ? 'brisee' : 'epargnee' });
    d.load('chambre_verre', 'vitre');
    await d.fadeIn(10);
    await souvenirVitre(d, !broken);
    await theFall(d);
  },
};

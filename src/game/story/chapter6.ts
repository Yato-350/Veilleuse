import { audio, parsePattern, type Sfx } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { rng } from '../../engine/math';
import { LULLABY_PATTERN } from '../../data/music';
import { TILES } from '../../data/tiles';
import { tr } from '../../i18n';
import { blot } from '../battle/final-common';
import { runFinalBattleV2 } from '../battle/final-v2';
import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { CountingScene } from '../scenes/sheepcount';
import { G, maxHp, writeMeta, type CallAnswer } from '../state';
import { dialogue } from '../ui/dialogue';
import { isSilenceRoute, shop } from './common';
import { afterFinalBattle } from './endings';
import { inBed } from './real';

/**
 * Chapter 6 — « Le Ventre de Dodo » (docs/HISTOIRE.md § 3.14, T7 § 2.8, T8 § 2.9, T9 § 2.10). The last chapter, inside
 * the plush: damp yellowed cotton, Mina's red thread, pins, a music box for a heart, a voice on a dying battery. From
 * T7 on, the narrator (the white box) speaks with Noa's blip — it was always him — and it tells the truth. Order of play:
 *   card (« Il fait toujours nuit. », ballpoint and red thread) → couture: Noa has fallen through the seam; the cotton
 *   walls replay the prologue → T7 in the hollow: « Tu ne dors pas ? », DODO becomes NOA, the real flashback (Noa
 *   finishes the battery's sentence himself, then speaks Dodo's first line), « Je suis ce que tu fais avec sa voix. »
 *   → ouate: the jars of the nights 1 to 364, the riddle of night 0 (the jar without a label, behind « Nuit 1 », holds a
 *   phone vibrating; it opens the sealed seam), the nest, Chaussette, the Bourres (if c4_coton > 0)
 *   → boite_a_musique: the comb of baby teeth, the three missing teeth, the counting scene (skin « dents »), the
 *   lullaby played whole for the first time → couloir_41: forty-one doors, one per second of the call; at door 14 the
 *   corridor splits and both versions are heard, one per branch (which branch carries which is drawn at random once
 *   per run); « Laquelle est vraie ? » (G.meta.callVersion); Dodo's button eyes become two windows on 3:38; the Pile
 *   → voix: the module REC / PLAY, the crust, Mina's empty puppets, the little girl in the knitted hat (T9: the notebook
 *   opens outside battle — « regarder », « fermer les yeux », « partir ») → the final battle (runFinalBattleV2) and
 *   where it leads (afterFinalBattle: [Ouvrir les yeux] the finale, [Rester] Beaux rêves, the ink Silence).
 *
 * Flags (c6_*):
 *   c6_intro          the landing in the seam has been played
 *   c6_mur_<1–4>      the walls of the seam replayed a line of the prologue
 *   c6_t7             « Dodo n'a jamais parlé » (T7) has been played; from here the narrator speaks with Noa's blip
 *   c6_ouate_vu       the wadding has been entered; c6_etagere_<id>: jars read on that shelf; c6_bocaux: jars read
 *   c6_trou           the empty place on a shelf (a ring in the dust) was seen
 *   c6_couture_vue    the sealed seam (« Rapporte la nuit qu'il a oubliée. ») was read
 *   c6_nuit1          the fallen jar « Nuit 1 » was found
 *   c6_bocal0         the jar without a label was taken (night 0: a phone vibrating); c6_couture: the seam is open
 *   c6_nid            the nest; c6_chaussette: talks with Chaussette
 *   c6_boite_vue      the music box chamber has been entered; c6_peigne: the comb was looked at
 *   c6_dent_<1–3>     baby tooth found; c6_dents: how many
 *   c6_boite          the music box played the lullaby whole (the counting scene « dents »)
 *   c6_couloir        the corridor has been entered; c6_porte_<n>: door n opened (trunk 1–14)
 *   c6_haut           'douce' | 'dure': which version plays behind the doors of the upper branch (drawn once)
 *   c6_haut_<n>, c6_bas_<n>   door n of that branch opened; c6_ecoute_haut, c6_ecoute_bas: branch heard to door 41
 *   c6_appel          « Laquelle est vraie ? » has been answered (the answer is G.meta.callVersion)
 *   c6_fenetres       the button eyes opened on 3:38
 *   c6_casque         the headphones
 *   c6_pile / c6_pile_morte   set by the battle (src/data/enemies-ch6.ts); c6_pile_fait once it is over
 *   c6_voix_vue       the voice chamber has been entered
 *   c6_partir         « partir » was chosen at the threshold (the room loops; the word is crossed out)
 *   c6_regarder       « regarder »: her face drawn in pencil (the final battle reads it); c6_seuil: the threshold is
 *                     crossed (« regarder » or « fermer les yeux »)
 *   fin_route         set by the final battle: 'aube' | 'beaux_reves' | 'silence'
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);
const bump = (k: string, n = 1): number => {
  const v = num(k) + n;
  G.state.flags[k] = v;
  return v;
};
const tileOf = (px: number): number => Math.floor(px / TILE);
const param = (k: string): string | null => new URLSearchParams(location.search).get(k);

type Lines = string | string[];

/** From T7 on, the white box speaks with Noa's blip (it always was his voice) — and it tells the truth. */
function tell(d: Director, lines: Lines): Promise<void> {
  return d.say(lines, undefined, flag('c6_t7') ? { voice: 'noa' } : {});
}

/** An inspection told by the narrator; `then` adds a line by someone else. */
const look =
  (lines: Lines, then?: [Lines, string]): Script =>
  async (d) => {
    await tell(d, lines);
    if (then) await d.say(then[0], then[1]);
  };

/** An inspection whose text changes each time (the last one repeats). */
const looks =
  (key: string, set: Lines[]): Script =>
  async (d) => {
    const n = bump(`c6_n_${key}`) - 1;
    await tell(d, set[Math.min(n, set.length - 1)]!);
  };

/** Dodo's voice coming from the cotton itself (no portrait). Since T7 it has Noa's blip. */
function voice(d: Director, lines: Lines): Promise<void> {
  return d.say(lines, 'dodoreel', flag('c6_t7') ? { voice: 'noa' } : {});
}

/** A glitch that respects « Réduire les flashs et secousses ». */
function glitch(d: Director, frames: number): void {
  if (G.settings.reduceFlashes) d.sfx('glitch', { vol: 0.4 });
  else d.glitch(frames);
}

/** Changes tiles of the current map in place. */
function retile(cells: Array<[number, number, string]>): void {
  const tm = world.tilemap;
  for (const [x, y, id] of cells) {
    if (y < 0 || y >= tm.h || x < 0 || x >= tm.w) continue;
    tm.ids[y]![x] = id;
    tm.defs[y]![x] = TILES[id] ?? null;
  }
  tm.render();
}

/** Dodo, floating, as thin as in chapter 5 (his side seam open), inside himself. */
function spawnDodo(d: Director, x: number, y: number): void {
  d.remove('dodo');
  d.spawn({ id: 'dodo', sprite: 'npc_c6_dodo', frames: ['npc_c6_dodo', 'npc_c6_dodo_2'], frameSpeed: 28, x, y, float: true, shadow: false, solid: false, script: dodoTalk });
}

// ---------------------------------------------------------------------------------------------------------------------
// Murmurs: words floating out of the cotton (the walls repeating « …fais de beaux rêves », the silences behind doors)
// ---------------------------------------------------------------------------------------------------------------------

interface Murmur {
  text: string;
  x: number;
  y: number;
  t: number;
  life: number;
  color: string;
}
const murmurs: Murmur[] = [];
let murmurInstalled = false;
let whisperT = 0;
/** Maps whose walls whisper. */
const WHISPER_MAPS = new Set(['couture', 'ouate', 'boite_a_musique', 'voix']);
const WHISPER = '…fais… de… beaux… rê…ves…';

/** A line that floats out of the world at (x, y) (world pixels) and fades, without stopping Noa. */
export function murmur(text: string, x: number, y: number, life = 150, color = '#e9dcb8'): void {
  installMurmurs();
  murmurs.push({ text: tr(text), x, y, t: 0, life, color });
}

function installMurmurs(): void {
  if (murmurInstalled) return;
  murmurInstalled = true;
  game.hooks.push(() => {
    for (const m of murmurs) m.t++;
    for (let i = murmurs.length - 1; i >= 0; i--) if (murmurs[i]!.t >= murmurs[i]!.life) murmurs.splice(i, 1);
    if (game.top !== world || !world.map || !WHISPER_MAPS.has(world.map.id) || dialogue.open) return;
    // The walls repeat the battery's last words, slowly, every quarter of a minute or so.
    if (++whisperT < 900) return;
    whisperT = Math.floor(rng.next() * 300);
    const tm = world.tilemap;
    for (let k = 0; k < 30; k++) {
      const tx = tileOf(world.camX) + Math.floor(rng.next() * (W / TILE));
      const ty = tileOf(world.camY) + Math.floor(rng.next() * (H / TILE - 3));
      const id = tm.ids[ty]?.[tx] ?? '';
      if (id.startsWith('c6_paroi') || id.startsWith('c6_tissu')) {
        murmur(WHISPER, tx * TILE + 8, ty * TILE + 10, 240, '#cbbd96');
        audio.sfx('static', { vol: 0.12, pitch: 0.45 });
        break;
      }
    }
  });
  game.overlays.push((g) => {
    if (!murmurs.length || game.top !== world) return;
    for (const m of murmurs) {
      const a = Math.min(1, m.t / 30, (m.life - m.t) / 40);
      g.globalAlpha = Math.max(0, a) * 0.9;
      const sx = Math.round(m.x - world.camX);
      const sy = Math.round(m.y - world.camY - m.t * 0.08);
      drawText(g, m.text, Math.max(4 + measure(m.text) / 2, Math.min(W - 4 - measure(m.text) / 2, sx)), sy, { color: m.color, align: 'center' });
    }
    g.globalAlpha = 1;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The chapter card: ballpoint on squared paper, sewn through with red thread; then the page yellows like cotton
// ---------------------------------------------------------------------------------------------------------------------

const INK = '#1d2238';

class ThreadCard implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;
  private readonly head = `${tr('Chapitre 6')} — ${tr('Le Ventre de Dodo')}`;
  private readonly line = tr('Il fait toujours nuit.');

  static show(): Promise<void> {
    const c = new ThreadCard();
    game.push(c);
    return new Promise((r) => {
      c.resolve = r;
    });
  }

  update(): void {
    this.t++;
    const t = this.t;
    if (t > 30 && t < 130 && t % 7 === 0) audio.sfx('write', { vol: 0.3, pitch: 0.9 + rng.next() * 0.2 });
    if (t >= 140 && t < 240 && t % 10 === 0) audio.sfx('stitch', { vol: 0.35, pitch: 0.9 + (t % 30) / 100 });
    if (t > 250 && t < 320 && t % 8 === 0) audio.sfx('write', { vol: 0.25, pitch: 0.8 });
    if (t > 470 || (t > 150 && (input.pressed('a') || input.pressed('b')))) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = this.t;
    g.fillStyle = '#efe9dc';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#c9d3e6';
    for (let x = 4; x < W; x += 8) g.fillRect(x, 0, 1, H);
    for (let y = 4; y < H; y += 8) g.fillRect(0, y, W, 1);
    const k = Math.min(1, Math.max(0, (t - 30) / 100));
    drawText(g, this.head.slice(0, Math.floor(this.head.length * k)), W / 2, 56, { color: INK, align: 'center' });
    // The red thread: a running stitch under the title, dash by dash, as if sewn through the page.
    const w = measure(this.head) + 24;
    const x0 = Math.round(W / 2 - w / 2);
    const dashes = Math.floor(Math.max(0, Math.min(1, (t - 140) / 100)) * (w / 6));
    for (let i = 0; i < dashes; i++) {
      g.fillStyle = '#c8424f';
      g.fillRect(x0 + i * 6, 70 + (i % 2), 4, 2);
      g.fillStyle = '#8e2a3a';
      g.fillRect(x0 + i * 6 + 4, 71, 1, 1);
    }
    if (t > 250) {
      const k2 = Math.min(1, (t - 250) / 70);
      const wob = Math.round(Math.sin(t * 0.7) * 0.6);
      drawText(g, this.line.slice(0, Math.floor(this.line.length * k2)), W / 2 + wob, 96, { color: INK, align: 'center', scale: 2 });
    }
    // The page yellows from the edges in, like old cotton; then it is dark inside.
    if (t > 360) {
      const y = Math.min(1, (t - 360) / 80);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(110,90,50,${0.12 * y})`;
        const m = Math.round(i * 14 * (1.4 - y));
        g.fillRect(0, 0, W, m);
        g.fillRect(0, H - m, W, m);
        g.fillRect(0, 0, m, H);
        g.fillRect(W - m, 0, m, H);
      }
      g.fillStyle = `rgba(31,23,15,${Math.max(0, (t - 400) / 70)})`;
      g.fillRect(0, 0, W, H);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Opening: the seam
// ---------------------------------------------------------------------------------------------------------------------

export async function start(d: Director): Promise<void> {
  G.state.chapter = 6;
  G.state.party = [];
  await ThreadCard.show();
  fx.setFade(1, '#1f170f');
  d.load('couture', 'chute');
  await landing(d);
}

async function landing(d: Director): Promise<void> {
  const p = world.player;
  p.visible = false;
  d.spawn({ id: 'noa_couche', sprite: 'pose_noa_lie', x: 6, y: 6, solid: false, shadow: false });
  d.music(null);
  await d.fadeIn(120);
  await d.wait(40);
  await d.say(['Du coton.', 'Tiède, humide, tassé. Ça sent la poussière et la lessive de Maman.']);
  await d.say(['Très haut au-dessus de toi, une fente de lumière jaune.', 'La couture. Celle que Dodo a ouverte sur son ventre. Tu es tombé par là.']);
  d.sfx('step', { pitch: 0.5 });
  d.remove('noa_couche');
  p.visible = true;
  p.dir = 'down';
  await d.wait(30);
  await voice(d, 'Entre.');
  await d.wait(20);
  await voice(d, ['Tu as toujours voulu savoir ce qu\'il y a dedans.', 'Quand tu étais petit, tu tirais sur la ficelle sous ma queue, pour entendre la berceuse. Et tu collais ton oreille contre mon ventre.']);
  await d.say(['La voix vient de partout.', 'Des parois. Du sol. De la fente, en haut. Elle est un peu trop grave pour être celle de Dodo.']);
  d.set('c6_intro');
  d.music('ventre', 2);
}

/** On enter (couture): the light of the seam; the walls whisper. */
export const coutureEnter: Script = (d) => {
  installMurmurs();
  if (flag('c6_intro')) d.music('ventre', 1);
  world.extraDarkness = 0.05;
};

/** The walls replay the prologue, line by line, slowed down like a worn tape. */
const REPLAYS: Array<[string, string[]]> = [
  ['« Il fait nuit. »', ['La voix sort des parois. Du coton qui parle tout bas, comme une cassette qu\'on aurait trop écoutée.']],
  ['« Il fait toujours nuit. »', ['Les premiers mots de cette nuit. Ceux que tu as entendus dans ta chambre, il y a une éternité. Il y a quelques heures.']],
  ['« La pluie tape contre la vitre. Tu n\'arrives pas à dormir. »', ['Il ne pleut pas, ici.', 'C\'est le plafond qui goutte. Une goutte tiède sur ta nuque. Puis une autre.']],
  ['« Sur l\'oreiller, quelque chose te regarde. »', ['Le coton se creuse dans le mur, juste à côté de toi. Deux trous ronds, à la hauteur de tes yeux.', 'Le temps de te retourner, ils se sont refermés.']],
];

export const replay =
  (i: number): Script =>
  async (d) => {
    const [line, after] = REPLAYS[i]!;
    d.sfx('static', { vol: 0.25, pitch: 0.5 });
    audio.tempoScale = 0.85;
    await d.say(`{c:g}${line}{/c}`, undefined, { speed: 0.4, pos: 'top' });
    audio.tempoScale = 1;
    await d.say(after);
  };

export const slitLight: Script = look(['La fente, tout là-haut. Les points de fil rouge passent devant la lumière comme des barreaux.', 'Dehors, c\'est jaune. Une veilleuse ? Une lampe de chevet ? Tu ne remonteras pas par là.']);
export const seamFabric: Script = looks('tissu', [
  ['L\'envers du tissu. La trame est grosse, rêche, comme de la toile de jute.', 'Des touffes de laine passent au travers. C\'est la peau de Dodo, vue de dedans.'],
  'Sur la trame, au feutre, à l\'envers, des lettres qu\'on lit en miroir : « DODO — à Noa ».',
]);
export const coutureDrip: Script = look(['Le coton est trempé, ici. Il colle aux semelles.', 'Quand tu soulèves le pied, ça fait un bruit de baiser mouillé.']);
export const coutureThread: Script = look('Un fil rouge pend du plafond. Il frémit, comme si quelqu\'un tirait dessus, très loin, à l\'autre bout.');
export const coutureTuft: Script = looks('touffe_couture', [
  'Une touffe de coton plus jaune que les autres. Tu la touches : elle est chaude. Elle palpite.',
  ['Elle palpite toujours.', 'Tu enlèves ta main. Tu ne la remets pas.'],
]);

export const hollowStain: Script = looks('creux', [
  ['Au fond du creux, le coton est tassé en rond, un peu plus sombre.', 'Quelqu\'un s\'est assis là, souvent. Les genoux contre la poitrine. Assez longtemps pour laisser sa forme.'],
  ['La forme a ta taille. Exactement.', 'Tu ne t\'assois pas dedans. Tu as peur qu\'elle te tienne chaud.'],
]);

// ---------------------------------------------------------------------------------------------------------------------
// T7 — « Dodo n'a jamais parlé » (§ 2.8)
// ---------------------------------------------------------------------------------------------------------------------

export const t7: Script = async (d) => {
  if (flag('c6_t7')) return;
  world.player.moving = false;
  spawnDodo(d, 21, 6);
  const dodo = d.find('dodo');
  if (dodo) dodo.alpha = 0;
  d.music(null, 2);
  await d.wait(30);
  for (let i = 0; i <= 30; i++) {
    if (dodo) dodo.alpha = i / 30;
    await d.wait(2);
  }
  d.face('player', 'right');
  await d.wait(30);
  await d.say('Tu ne dors pas ?', 'dodo:happy');
  await d.say('…', 'noa:sad');
  await d.say(['C\'est la première chose que je t\'ai dite, cette nuit.', 'Dans ta chambre. Sur l\'oreiller. Tu te souviens ?'], 'dodo:neutral');
  await d.say(['Dis-le avec moi.', 'Tu ne dors pas ?'], 'dodo:happy');
  await d.wait(20);
  d.sfx('static', { vol: 0.4, pitch: 0.7 });
  await d.say('Tu ne dors pas ?{p:40} {as:noa:sad}Tu ne dors pas ?', 'dodo:neutral');
  await d.wait(20);
  glitch(d, 12);
  await d.say(['Le nom, dans la boîte, a clignoté.', 'La voix est descendue d\'une octave.', 'C\'est la tienne.']);
  await flashback(d);
  // Back inside.
  await d.say('Je suis ce que tu fais avec sa voix.', 'dodonoa:neutral');
  await d.say(['Sa voix à elle, sur une pile qui meurt. Cinq secondes.', 'Et la tienne pour finir les phrases. Et puis pour tout le reste.'], 'dodonoa:neutral');
  await d.say('…', 'noa:sad');
  await d.wait(30);
  await d.say(['Et toi…', 'Toi, {player}, je ne sais pas d\'où tu viens.'], 'dodonoa:neutral');
  await d.say(['Tu lui tiens la main depuis le début de la nuit.', 'Je n\'ai jamais su comment. Je ne veux pas le savoir.'], 'dodonoa:creepy');
  await d.wait(30);
  // The white box takes Noa's blip: the narrator was him too.
  await d.say('Tu ne peux pas.', undefined, { voice: 'noa' });
  await d.say(['Tu l\'entends, maintenant ?', 'Les phrases en blanc. « Tu ne peux pas. » « Tu n\'as pas envie. » « Tu n\'as rien entendu. »'], 'dodonoa:neutral');
  await d.say(['C\'était toi aussi.', 'Tu te racontais ta propre nuit, avec des trous aux bons endroits.'], 'dodonoa:happy');
  d.set('c6_t7');
  await d.wait(20);
  await tell(d, '…');
  await tell(d, ['Tu as entendu.', 'Tu te souviens de l\'appel.', 'Et tu peux.']);
  await tell(d, 'À partir d\'ici, il n\'y a plus de trous.');
  await d.wait(20);
  await d.say(['Viens. Je te fais visiter.', 'C\'est chez moi. C\'est chez toi. C\'est pareil.'], 'dodonoa:happy');
  d.music('ventre', 2);
  await d.walkTo('dodo', 24, 9, 0.6);
  d.remove('dodo');
};

/** The real flashback: one evening of the year after, any of them. Noa finishes the battery's sentence himself. */
async function flashback(d: Director): Promise<void> {
  await d.fadeOut(50, '#000000');
  const back = { map: G.state.map, x: world.player.x, y: world.player.y };
  d.load('chambre', 'bed', true);
  d.remove('dodo');
  d.remove('dodo_plush');
  inBed(d, false);
  d.show('player', false);
  d.spawn({ id: 'noa_assis', sprite: 'pose_noa_sit', x: 2, y: 4, solid: false, shadow: false });
  const plush = d.spawn({ id: 'plush', sprite: 'prop_dodo_plush', x: 2, y: 5, solid: false, shadow: false });
  plush.oy = -9;
  plush.ox = 4;
  world.extraDarkness = 0.25;
  await d.fadeIn(60);
  await d.say(['Ta chambre. Un soir.', 'N\'importe lequel : depuis un an, ils se ressemblent tous.']);
  await d.say(['Tu es assis au bord du lit. Dodo sur les genoux.', 'Son dos est pelé, gratté jusqu\'à la trame. Tu as du coton sous les ongles.']);
  await d.wait(30);
  await d.say('Tu appuies sur son ventre.');
  d.sfx('tooth', { pitch: 0.6, vol: 0.6 });
  await d.wait(24);
  d.sfx('static', { vol: 0.45, pitch: 0.9 });
  await d.say('{spd:0.7}« Bonne nuit, Noa ! Dodo veille sur t{static}—krr—chhh…{/static} »{/spd}', 'dodoreel');
  await d.wait(50);
  await d.say('{spd:0.45}…sur toi. Fais de beaux rêves.{/spd}', 'noa:tired');
  await d.wait(40);
  await d.say('{voice:dodo}Tu ne dors pas ?', 'noa:neutral');
  await d.wait(30);
  await d.say(['Personne d\'autre dans la chambre.', 'C\'est ta bouche qui a bougé.']);
  await d.say('{voice:dodo}Ne fais pas cette tête-là. C\'est moi, Dodo ! Mina m\'a donné à toi. Alors je veille.', 'noa:tired');
  await d.say(['Tous les soirs. La pile ne dit plus que la moitié de la phrase.', 'Tu dis l\'autre moitié. Et puis tu continues, tout bas, avec sa voix. Jusqu\'à ce que tu t\'endormes.']);
  await d.fadeOut(50, '#000000');
  d.remove('noa_assis');
  d.remove('plush');
  d.load(back.map, 'creux', true);
  world.player.x = back.x;
  world.player.y = back.y;
  world.player.dir = 'right';
  spawnDodo(d, 21, 6);
  await d.fadeIn(50);
}

// ---------------------------------------------------------------------------------------------------------------------
// Dodo, when Noa talks to him (wherever he floats)
// ---------------------------------------------------------------------------------------------------------------------

export const dodoTalk: Script = async (d) => {
  const n = bump('c6_dodo_parle');
  const lines: Array<[Lines, string]> = [
    [['Tu sais ce qui me fait le plus peur, ici ?', 'Rien. Il n\'y a rien qui me fasse peur. C\'est moi, le noir.'], 'dodonoa:neutral'],
    [['Ne gratte pas les murs.', 'Tu as déjà assez gratté mon dos comme ça.'], 'dodonoa:creepy'],
    [['Je n\'ai jamais su faire que deux choses.', 'Veiller. Et faire de beaux rêves. Elle ne m\'avait pas dit quand m\'arrêter.'], 'dodonoa:neutral'],
  ];
  const [t, who] = lines[(n - 1) % lines.length]!;
  await d.say(t, who);
};

// ---------------------------------------------------------------------------------------------------------------------
// ouate — the wadding: the jars of the nights, the riddle of night 0, the nest, Chaussette
// ---------------------------------------------------------------------------------------------------------------------

export const ouateEnter: Script = async (d) => {
  installMurmurs();
  world.extraDarkness = 0;
  if (flag('c6_ouate_vu')) return;
  d.set('c6_ouate_vu');
  await d.wait(20);
  await tell(d, ['Une grotte de coton. Le plafond est bas, mou, il goutte.', 'Le long des parois, des étagères. Sur les étagères, des bocaux. Des centaines de bocaux, avec des étiquettes écrites au stylo bille.']);
  await tell(d, 'Ton écriture.');
  await voice(d, ['Mes conserves.', 'Une par nuit. Je ne jette rien.']);
};

interface Jar {
  label: string;
  inside: string;
}

/** The shelves of jars: a few nights out of three hundred and sixty-four, in Noa's handwriting (§ 3.14). */
export const SHELVES: Record<string, Jar[]> = {
  a: [
    { label: 'Nuit 2 : il a cherché la nuit 1. On ne l\'a jamais rangée avec les autres. Elle est tombée.', inside: 'Dedans, du coton, rien que du coton. Il a l\'air d\'attendre quelque chose.' },
    { label: 'Nuit 3 : il a dit « c\'est un rêve ». Personne ne l\'a cru. Pas même lui.', inside: 'Dedans, une couronne en papier, pliée en quatre.' },
    { label: 'Nuit 17 : il a mangé les pâtes froides du rêve. Elles étaient froides aussi.', inside: 'Dedans, une fourchette. Une seule. Elle est tordue.' },
    { label: 'Nuit 40 : il a gravé M + N sur un banc.', inside: 'Dedans, des copeaux de bois. Ils sentent le crayon taillé.' },
    { label: 'Nuit 41 : il a compté jusqu\'à quarante et un. Il s\'est arrêté là, sans savoir pourquoi.', inside: 'Dedans, quarante et un moutons en papier, tous froissés. Le dernier n\'a pas de tête.' },
    { label: 'Nuit 58 : il a refusé de suivre Dodo. Il a dormi par terre, dans le rêve. Au réveil, il avait mal au dos.', inside: 'Dedans, une touffe de moquette. Un cheveu noir.' },
  ],
  b: [
    { label: 'Nuit 87 : il a fait rire Mina si fort qu\'elle est tombée du nuage. Elle riait encore en tombant.', inside: 'Dedans, rien. Mais le verre est chaud, comme une main qu\'on vient de lâcher.' },
    { label: 'Nuit 99 : il a couru jusqu\'au bout du Pays de Coton. Il n\'y a pas de bout.', inside: 'Dedans, une semelle de chaussure, usée jusqu\'au trou.' },
    { label: 'Nuit 120 : il a demandé à Madame Lune d\'éteindre la lumière. Elle a refusé. Elle a eu raison.', inside: 'Dedans, un petit croissant de lune en carton, qui luit à peine.' },
    { label: 'Nuit 151 : il a appris à Mina à siffler. Elle n\'a jamais su. Lui non plus.', inside: 'Dedans, un souffle. Tu ouvres, et il en sort un sifflement raté. Tu refermes vite.' },
    { label: 'Nuit 177 : il a essayé de dire au revoir. Il a dit « à demain ».', inside: 'Dedans, une page de calendrier. Toutes les cases sont barrées sauf une.' },
    { label: 'Nuit 212 : il a frappé Madame Lune. Nuit 213 : il s\'est excusé.', inside: 'Deux bocaux attachés ensemble par un fil rouge. Dans l\'un, un poing de coton serré. Dans l\'autre, le même, ouvert.' },
  ],
  c: [
    { label: 'Nuit 250 : il a recousu Dodo. Mal.', inside: 'Dedans, une aiguille et du fil bleu. Le fil a été mordu plutôt que coupé.' },
    { label: 'Nuit 280 : il a rapporté la veilleuse. Il n\'y avait personne pour la prendre.', inside: 'Dedans, une prise électrique. Le fil est enroulé si serré que le plastique a craqué.' },
    { label: 'Nuit 300 : il a demandé à Mina de ne rien dire. Elle n\'a rien dit.', inside: 'Dedans, un doigt de gant, posé debout. Comme un doigt sur une bouche.' },
    { label: 'Nuit 333 : il n\'a pas voulu dire qu\'il était malade.', inside: 'Dedans, un mouchoir roulé en boule. Une tache d\'encre dessus, sèche.' },
    { label: 'Nuit 350 : il a gagné aux moutons. Il n\'y avait rien à gagner.', inside: 'Dedans, une médaille en chocolat. Le chocolat a blanchi.' },
    { label: 'Nuit 364 : presque.', inside: 'Dedans, un bout de phrase écrit au crayon, coupé au ciseau : « Je voulais juste te d— »' },
  ],
  d: [
    { label: 'Nuit 128 : il a trouvé la porte de sa chambre à elle. Elle était cousue.', inside: 'Dedans, une poignée de porte. Juste la poignée.' },
    { label: 'Nuit 199 : il ne s\'est rien passé. Il a pleuré quand même.', inside: 'Dedans, de l\'eau. Un peu salée. Tu ne goûtes pas : tu sais.' },
    { label: 'Nuit 222 : il a appelé Maman, dans le rêve. Ça a sonné dans le vide.', inside: 'Dedans, une tonalité. Tu approches l\'oreille : « tuuut… tuuut… »' },
    { label: 'Nuit 311 : Dodo a perdu un œil. Il l\'a recousu avec un bouton de manteau.', inside: 'Dedans, un œil-bouton. Le vrai. Il est tourné vers toi. Il ne se détourne pas quand tu tournes le bocal.' },
    { label: 'Nuit 360 : il a demandé combien il en restait. Dodo a répondu : « Toutes. »', inside: 'Dedans, un sablier. Le sable est du coton. Il ne descend pas.' },
    { label: 'Nuit 363 : elle a dit « Je voulais juste te dire… ». Il l\'a arrêtée. Comme les autres nuits.', inside: 'Dedans, une main de feutre, toute petite. Elle est ouverte.' },
  ],
};

/** A shelf of jars: one label at a time, then « Lire le suivant ? ». */
export const shelf =
  (id: string): Script =>
  async (d) => {
    const jars = SHELVES[id]!;
    for (;;) {
      const k = `c6_etagere_${id}`;
      const i = num(k) % jars.length;
      G.state.flags[k] = num(k) + 1;
      if (num(k) <= jars.length) bump('c6_bocaux');
      const jar = jars[i]!;
      d.sfx('tooth', { pitch: 1.6, vol: 0.25 });
      await tell(d, `L'étiquette : « ${jar.label} »`);
      await tell(d, jar.inside);
      if (i === jars.length - 1) {
        await tell(d, 'C\'est le dernier bocal de cette étagère. Le premier est de nouveau devant.');
        return;
      }
      const r = await d.ask('Lire le suivant ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
      if (r !== 0) return;
    }
  };

/** The place on a shelf where « Nuit 1 » should be: a ring in the dust. */
export const shelfGap: Script = async (d) => {
  d.set('c6_trou');
  await tell(d, ['Une étagère où il manque un bocal, le premier de la rangée.', 'À sa place, un rond propre dans la poussière, et une traînée qui part vers le bord.']);
  await tell(d, 'Il est tombé. Quelque part plus bas, il fait ploc, ploc.');
  if (!flag('c6_nuit1')) murmur('ploc.', world.player.x + 40, world.player.y + 30, 120);
};

/** The jar of this night (365 on a first run): its label is blank; on a later run, the night before has a label. */
export const jarTonight: Script = async (d) => {
  const n = G.meta.nuits;
  await tell(d, [`Un bocal un peu à l'écart. L'étiquette porte seulement : « Nuit ${n} : »`, 'Le reste est blanc. Le stylo est posé à côté, le capuchon mâchonné. L\'encre n\'a pas séché.']);
  await tell(d, 'C\'est le bocal de cette nuit. Il attend de savoir ce qu\'il faut écrire.');
  if (n > 365) {
    await tell(d, [`Derrière, un autre bocal. « Nuit ${n - 1} : quelqu'un lui tenait la main. »`, 'Dessous, au crayon, d\'une autre écriture : « {player} ».']);
  }
};

/** The last shelf: jars already labelled for the nights to come, empty, their lids sewn on in advance. */
export const shelfSealed: Script = async (d) => {
  const n = G.meta.nuits;
  const k = bump('c6_n_avance');
  if (k === 1) {
    await tell(d, ['Une étagère de bocaux vides. Les couvercles sont déjà cousus au fil rouge.', 'Les étiquettes sont écrites d\'avance.']);
    await tell(d, [`« Nuit ${n + 1} ». « Nuit ${n + 2} ». « Nuit ${n + 3} ».`, `Plus loin : « Nuit ${n + 40} ». Et plus loin encore, au fond, dans l'ombre : « Nuit ${n + 365} ».`]);
    await voice(d, ['Je prépare.', 'On n\'est jamais trop prévoyant.']);
    return;
  }
  await tell(d, k === 2 ? ['Tu tournes un bocal vers toi. Sous l\'étiquette, au crayon, une deuxième écriture, plus ronde :', '« et après ? »'] : 'Les bocaux vides attendent. Ils ont tout leur temps. C\'est le seul endroit d\'ici où il y a du temps.');
};

/** Jars rolled away from the shelves. */
const LOOSE: Array<[string, string]> = [
  ['« Nuit 9 : il a demandé à Dodo s\'il pouvait rentrer. Dodo a dit : bientôt. »', 'Dedans, une clé de porte, avec un petit mouton en plastique au bout. Tu sais quelle porte elle ferme.'],
  ['« Nuit 64 : il a tenu la main de Mina jusqu\'au matin. Le matin n\'est pas venu. »', 'Dedans, une pelote de fil rouge, emmêlée, serrée, comme si on avait tiré dessus de toutes ses forces.'],
  ['« Nuit 190 : il a perdu une dent dans le rêve. Au réveil, il les avait toutes. »', 'Dedans, une dent en plastique, de celles des pochettes-surprises. Quelqu\'un a essayé de la faire passer pour une vraie.'],
];

export const looseJar =
  (i: number): Script =>
  async (d) => {
    const [label, inside] = LOOSE[i]!;
    d.sfx('tooth', { pitch: 1.6, vol: 0.25 });
    await tell(d, ['Un bocal qui a roulé loin des étagères.', `L'étiquette : ${label}`]);
    await tell(d, inside);
  };

/** The sealed seam out of the wadding (the riddle). */
export const sealedSeam: Script = async (d) => {
  if (flag('c6_couture')) return;
  if (flag('c6_bocal0')) {
    await tell(d, ['Tu tends le bocal sans étiquette vers la couture.', 'Il vibre plus fort. Bzzz. Bzzz.']);
    for (let i = 0; i < 6; i++) {
      d.sfx('thread', { pitch: 0.8 + i * 0.06, vol: 0.5 });
      await d.wait(12);
    }
    d.set('c6_couture');
    const seam = d.find('couture');
    if (seam) {
      seam.sprite = 'prop_c6_couture_ouverte';
      seam.solid = false;
    }
    d.shake(1, 12);
    await tell(d, ['Les croix de fil rouge se défont une à une, d\'elles-mêmes, comme des lacets qu\'on tire.', 'La couture s\'ouvre. Derrière, ça bat. Lentement.']);
    await voice(d, ['Tu l\'as trouvée.', 'Je l\'avais bien rangée, pourtant.']);
    return;
  }
  d.set('c6_couture_vue');
  await tell(d, ['Une couture. Des croix de fil rouge, serrées, comme sur une cicatrice.', 'Elle ferme la grotte. Derrière, quelque chose bat. Tu sens les coups dans tes pieds.']);
  await tell(d, ['À côté, sur le coton, au stylo bille, de ton écriture :', '« Pour passer, rapporte la nuit qu\'il a oubliée. »']);
  if (!flag('c6_nuit1')) await voice(d, 'Bonne chance. Il y en a trois cent soixante-quatre.');
};

/** « Nuit 1 », fallen in a puddle; behind it, the jar without a label: night 0. */
export const fallenJar: Script = async (d) => {
  if (flag('c6_bocal0')) {
    await tell(d, ['« Nuit 1 », couché dans la flaque.', 'Derrière lui, la place vide de l\'autre, l\'empreinte ronde dans le coton mouillé.']);
    return;
  }
  d.set('c6_nuit1');
  await tell(d, ['Un bocal tombé, couché sur le flanc dans une flaque.', 'Une épingle, au-dessus, goutte dessus depuis longtemps. Ploc. Ploc.']);
  d.sfx('tooth', { pitch: 1.4, vol: 0.25 });
  await tell(d, 'L\'étiquette, à moitié décollée : « Nuit 1 : il ne se souvient pas de la nuit 0. »');
  await d.wait(20);
  await tell(d, ['Derrière, à moitié enfoncé dans le coton trempé, il y a un autre bocal.', 'Plus petit. Sans étiquette. Le couvercle est cousu au fil rouge.']);
  const r = await d.ask('Le prendre ?', ['Le prendre', 'Le laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await tell(d, 'Tu le laisses. Il ne bouge pas. Il attend, il a l\'habitude.');
    return;
  }
  await nightZero(d);
};

/** Night 0: a jar with nothing in it but a phone vibrating on a desk. */
async function nightZero(d: Director): Promise<void> {
  d.set('c6_bocal0');
  const jar = d.find('bocal_zero');
  if (jar) d.remove('bocal_zero');
  await tell(d, ['Tu le prends. Il est froid. Il ne pèse rien.', 'Dedans, il n\'y a rien. Du noir.']);
  await d.wait(40);
  d.music(null, 1);
  for (let i = 0; i < 2; i++) {
    d.sfx('buzz', { vol: 0.8 });
    d.shake(1, 8);
    await d.wait(26);
    d.sfx('buzz', { vol: 0.8 });
    d.shake(1, 8);
    await d.wait(60);
  }
  await tell(d, ['Il vibre dans ta main.', 'Deux fois. Un silence. Deux fois. Comme un téléphone posé sur un bureau, la nuit, que personne ne décroche.']);
  await tell(d, ['La nuit zéro. Celle d\'avant toutes les autres.', 'Tu ne l\'as pas oubliée. Tu l\'as rangée derrière la première, là où on ne regarde pas.']);
  await voice(d, 'Repose ça.');
  await d.say('…', 'noa:sad');
  await tell(d, 'Tu le gardes.');
  d.music('ventre', 2);
  if (flag('c6_couture_vue')) await tell(d, 'Quelque part en haut, la couture tire sur ses fils.');
}

export const puddle: Script = look(['Une flaque. L\'eau est jaune, épaisse. Elle sent le doudou qu\'on a oublié dehors sous la pluie.', 'Dans le reflet, il n\'y a pas de plafond. Il y a une fenêtre, et derrière, une chambre. Tu cligneras des yeux : plus rien.']);

export const nest: Script = async (d) => {
  const n = bump('c6_nid');
  if (n === 1) {
    await tell(d, ['Un nid. Du coton arraché, tassé en rond.', 'Au fond, la forme d\'un garçon couché en chien de fusil, les genoux contre le ventre.']);
    await tell(d, ['Dans les touffes, des bouts de laine avec deux croix de fil noir.', 'Des yeux de mouton, défaits.']);
    if (num('c4_coton') > 0) {
      await tell(d, ['C\'est le coton des moutons. Ceux que tu as vidés, dans la maison cousue, pour avoir chaud.', 'Tu avais froid. Ce n\'est pas une excuse. C\'est vrai quand même.']);
    } else {
      await tell(d, ['Personne n\'a été vidé pour faire ce nid.', 'Le coton est venu tout seul, une touffe par nuit. Le nid a la forme exacte de ton dos.']);
    }
    return;
  }
  const r = await d.ask('Te coucher dans le nid ?', ['Juste un instant', 'Non'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.heal();
  d.sfx('heal');
  await tell(d, ['Tu te couches. C\'est chaud. C\'est exactement ta taille.', 'Tu te relèves vite, avant que ça devienne facile.']);
  await d.say('Tu reviendras.', 'dodoreel', { voice: 'noa' });
};

export const chaussette: Script = async (d) => {
  const n = bump('c6_chaussette');
  if (n === 1) {
    await d.say(['Mon chou ! Tu tombes bien.', 'Enfin… tu tombes. Moi aussi, je suis tombée. Par la couture, la tête la première. Une chaussette n\'a pas vraiment de tête, mais tu vois l\'idée.'], 'chaussette:happy');
    await d.say(['Il fait chaud, ici. Ça sent le doudou mouillé et la lessive de ta maman.', 'Pour une chaussette, c\'est presque le paradis.'], 'chaussette:neutral');
  } else if (n === 2) {
    await d.say(['Tu sais ce que je fais, là-dedans ? Je tiens boutique.', 'Tout le monde tient quelque chose, ici. Toi, tu tiens le coup. Moi, je tiens boutique.'], 'chaussette:happy');
  } else if (n === 3) {
    await d.say(['Les bocaux, là… je n\'y touche pas.', 'Une fois, j\'en ai ouvert un. Il y avait une nuit dedans. Une nuit entière, mon chou, avec la pluie et tout.', 'J\'ai mis trois jours à la remettre.'], 'chaussette:neutral');
  } else if (n === 4) {
    await d.say(['Hé. Quand tu sortiras… parce que tu vas sortir, hein…', 'Tu me mettras au sale ? Ça fait un an que je ne sèche pas.'], 'chaussette:happy');
    await d.say('…Promis.', 'noa:neutral');
    await d.say('Promis promis ?', 'chaussette:happy');
    await d.say('Hi hi. Je dis ça comme ça. C\'est une chose que disait une petite reine, sur une plage.', 'chaussette:neutral');
  }
  await shop(['lait', 'chocolat', 'biscuit', 'pomme', 'mouchoir', 'bulles', 'pluie', 'gateau'], 'Prends ce qu\'il te faut. C\'est un peu humide, mais tout se mange.');
};

export const pinsCeiling: Script = looks('epingles', [
  ['Des épingles plantées à l\'envers dans le plafond de coton. Des têtes de toutes les couleurs.', 'Elles gouttent. Ce n\'est pas de l\'eau, c\'est de la rouille.'],
  'Tu comptes les épingles. Tu t\'arrêtes à quarante et une. Il y en a d\'autres.',
]);
export const pinFloor: Script = look(['Une épingle aussi grande que toi, plantée de biais.', 'Quelqu\'un a essayé de la retirer : le coton autour est griffé en rond. Les griffures ont la largeur de tes ongles.']);
export const ouateStain: Script = looks('tache', [
  'Une tache humide. Elle a la forme de quelqu\'un qui a dormi là très longtemps, sans bouger.',
  'La tache est un peu plus grande que tout à l\'heure.',
]);
export const ouateThread: Script = look(['Le fil rouge de Mina.', 'Il traverse tout, ici. Il tient les parois ensemble. Si on le coupait, tout s\'effondrerait doucement, comme un oreiller qu\'on ouvre.']);
export const pitLook: Script = look(['Un trou dans le coton. En bas, c\'est noir et ça sent le renfermé.', 'Quelque chose remonte de là, très lentement : l\'odeur de ta chambre fermée.']);
export const bridgeLook: Script = look('Trois brins de fil rouge tendus au-dessus du noir. Ils tiennent. Elle cousait solide.');
export const brokenBridge: Script = looks('pont_coupe', [
  ['Un autre pont de fil. Il s\'arrête au milieu, au-dessus du noir.', 'Les trois brins ont été coupés net. Non : mordus. Il y a des marques de petites dents dans le fil.'],
  'Tu regardes en bas. Le noir te regarde aussi, poliment, sans insister.',
]);

/** When Noa comes near the nest with the Bourres still crawling: their reproach floats out of them. */
export const bourresMurmur: Script = async () => {
  for (const e of world.entities) {
    if (e.kind === 'enemy' && String((e.data.enemies as string[] | undefined)?.[0]) === 'bourre') murmur('C\'est toi qui nous as vidés.', e.x, e.y - 24, 200, '#d9cba6');
  }
};

// ---------------------------------------------------------------------------------------------------------------------
// boite_a_musique — Dodo's heart: the comb of baby teeth, three teeth to put back, the lullaby whole
// ---------------------------------------------------------------------------------------------------------------------

/** The passage down out of the music box chamber: cotton until the lullaby has played whole. */
export const FOAM_PASSAGE: Array<[number, number]> = [
  [14, 18],
  [15, 18],
  [14, 19],
  [15, 19],
];

function openPassage(): void {
  retile(FOAM_PASSAGE.map(([x, y]) => [x, y, 'c6_mousse']));
}

/** Once the lullaby has played: the cylinder turns and sings, the passage is open. */
function boxPlaying(): void {
  openPassage();
  const cyl = world.entities.find((e) => e.id === 'cylindre');
  if (cyl) {
    cyl.frames = ['prop_c6_cylindre', 'prop_c6_cylindre_2'];
    cyl.frameSpeed = 20;
  }
}

export const boiteEnter: Script = async (d) => {
  installMurmurs();
  syncComb();
  if (flag('c6_boite')) {
    boxPlaying();
    d.music(null);
    audio.setAmbience('hum', 0.4);
    return;
  }
  if (flag('c6_boite_vue')) return;
  d.set('c6_boite_vue');
  await d.wait(20);
  await tell(d, ['Ici, ça bat.', 'Une salle ronde, en mousse jaunie, qui se gonfle et se dégonfle un peu, comme une poitrine.']);
  await tell(d, ['Au fond, un cylindre de laiton grand comme une pièce tourne, très lentement, sans rien jouer.', 'Le cœur de Dodo est une boîte à musique.']);
};

/** The comb shows the teeth still missing. */
function syncComb(): void {
  const comb = world.entities.find((e) => e.id === 'peigne');
  if (comb) comb.sprite = flag('c6_boite') ? 'prop_c6_peigne_0' : `prop_c6_peigne_${3 - num('c6_dents')}`;
}

export const cylinder: Script = async (d) => {
  if (flag('c6_boite')) {
    await tell(d, ['Le cylindre tourne, et cette fois il chante.', 'Très doucement, pour lui tout seul.']);
    return;
  }
  await tell(d, ['Un cylindre de boîte à musique, en laiton, grand comme une pièce.', 'Des centaines de picots dessus : la berceuse, écrite en relief. Il tourne. Il ne joue rien.']);
};

export const comb: Script = async (d) => {
  if (flag('c6_boite')) {
    await tell(d, 'Le peigne est complet. Dix-huit dents de lait, petites, inégales. Elles vibrent encore.');
    return;
  }
  if (!flag('c6_peigne')) {
    d.set('c6_peigne');
    await tell(d, ['Le peigne, sous le cylindre. Ses dents ne sont pas en métal.', 'Ce sont des dents de lait. Petites, inégales, un peu jaunies.']);
    await tell(d, 'Les tiennes.');
    await d.wait(20);
    await tell(d, ['Quand tu en perdais une, Maman disait que la petite souris la confiait au mouton.', '« Il les garde pour toi. Il en prend soin. » Tu trouvais ça normal. Tu avais cinq ans.']);
    await voice(d, 'J\'en ai pris soin.');
  }
  const left = 3 - num('c6_dents');
  if (left > 0) await tell(d, left === 1 ? 'Il manque encore une dent. Un trou noir dans la rangée.' : `Il manque ${left === 3 ? 'trois' : 'deux'} dents. Des trous noirs dans la rangée, comme un sourire d'enfant.`);
  else await tell(d, 'Les trois dents sont revenues. Il ne reste qu\'à tourner la manivelle.');
};

/** The three missing teeth, scattered in the foam, each with a memory (the tender beat of the chapter). */
const TEETH: Record<number, string[]> = {
  1: ['Une dent de lait, dans un pore de la mousse.', 'La première que tu as perdue. Dans une pomme, à la cantine. Tu avais pleuré — pas pour la dent : pour la pomme.'],
  2: ['Une dent, sous une épingle tombée.', 'Celle-là, c\'est Mina qui l\'avait volée sous ton oreiller, pour voir si la petite souris passerait quand même.', 'Elle était passée. Maman avait laissé deux pièces : une pour toi, une « pour la voleuse ».'],
  3: ['Une dent, collée dans la croûte, près de la manivelle.', 'Celle-là, tu l\'as arrachée toi-même, avec un fil attaché à la poignée de la porte.', 'C\'est Mina qui avait claqué la porte, pour t\'aider. Elle avait crié plus fort que toi.'],
};

export const tooth =
  (i: number): Script =>
  async (d) => {
    if (flag(`c6_dent_${i}`)) return;
    d.set(`c6_dent_${i}`);
    bump('c6_dents');
    d.remove(`dent_${i}`);
    d.sfx('item', { pitch: 1.3 });
    await tell(d, TEETH[i]!);
    if (i === 3) await d.say('{p:20}Hé. T\'as crié comme une fille, gros bêta.', 'minavoix');
    syncComb();
    if (num('c6_dents') === 3) await tell(d, 'Trois dents dans ta main. Elles cliquettent comme des billes.');
  };

/** The crank: once the three teeth are back, the counting scene « dents » puts them in, and the lullaby plays. */
export const crank: Script = async (d) => {
  if (flag('c6_boite')) {
    await tell(d, 'La manivelle tourne toute seule, maintenant. Tu n\'as plus besoin d\'y toucher.');
    return;
  }
  if (num('c6_dents') < 3) {
    await tell(d, ['Une manivelle de laiton, polie à l\'endroit d\'une petite main.', 'Tu essaies de tourner. Le cylindre résiste : avec des trous dans le peigne, la mélodie n\'aurait pas où tomber.']);
    return;
  }
  const r = await d.ask('Tourner la manivelle ?', ['Tourner', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  await musicBox(d);
};

async function musicBox(d: Director): Promise<void> {
  d.music(null, 1);
  await d.fadeOut(20);
  const scene = CountingScene.open('dents');
  await d.fadeIn(20);
  const intro = [
    ['Le cylindre se remet à tourner.', 'Quand une goupille passe sous le trou du peigne, remets une dent. Une seule.'],
    ['Des épingles se sont mêlées aux goupilles.', 'Pas les épingles. Jamais les épingles.'],
    ['La berceuse, cette fois. Jusqu\'au bout.'],
  ];
  for (let round = 1; round <= 3; round++) {
    scene.announce(round);
    await d.say(intro[round - 1]!, undefined, { voice: 'noa' });
    let attempt = 0;
    for (;;) {
      const res = await scene.play(round, attempt);
      if (res.ok) break;
      attempt++;
      if (attempt === 2) await d.say('Doucement. Elle chantait doucement, elle.', 'dodoreel', { voice: 'noa' });
      else await d.say('La mélodie se perd. Le cylindre recule d\'un cran. Encore.', undefined, { voice: 'noa' });
    }
  }
  await d.wait(30);
  await d.fadeOut(30);
  scene.close();
  d.set('c6_boite');
  syncComb();
  const cyl = d.find('cylindre');
  if (cyl) {
    cyl.frames = ['prop_c6_cylindre', 'prop_c6_cylindre_2'];
    cyl.frameSpeed = 20;
  }
  for (const e of world.entities.filter((x) => x.kind === 'enemy')) world.removeEntity(e);
  await d.fadeIn(30);
  await wholeLullaby(d);
  await d.wait(30);
  await d.say(['Elle la chantait. Maman. Dans le fauteuil.', 'Quarante et une fois.'], 'dodonoa:neutral');
  await d.say('…', 'noa:sad');
  await d.say(['Moi, je l\'ai juste apprise par cœur.', 'C\'est tout ce que je sais faire : par cœur.'], 'dodonoa:sad');
  await d.wait(20);
  d.sfx('thread', { pitch: 0.7, vol: 0.5 });
  d.shake(1, 10);
  openPassage();
  await tell(d, 'En bas de la salle, la mousse s\'écarte. Un passage. Il donne sur un couloir. Tu connais ce papier peint.');
  d.music('ventre', 2);
}

/**
 * The lullaby, whole, for the first time in the game (§ 3.14): the leitmotif note by note on the music box, slowly,
 * with nothing missing. A soft low note marks each bar.
 */
async function wholeLullaby(d: Director): Promise<void> {
  const { events } = parsePattern(LULLABY_PATTERN);
  const step = G.settings.shortWaits ? 9 : 13;
  let done = false;
  void (async () => {
    let at = 0;
    for (const e of events) {
      if (e.step > at) await game.wait((e.step - at) * step);
      at = e.step;
      audio.note('musicbox', e.midis[0]!, (e.len * step) / 60 + 0.4, 0.75);
      if (e.step % 6 === 0) audio.note('sine', e.midis[0]! - 24, (6 * step) / 60, 0.35);
    }
    await game.wait(step * 8);
    done = true;
  })();
  const lines = [
    'Et la berceuse joue.',
    'En entier. Sans trou, sans grésillement, sans une note qui manque.',
    'Tu ne l\'avais jamais entendue jusqu\'au bout. Pas une seule fois de toute la nuit.',
    'Tu fermes les yeux. Tu ne t\'endors pas. Tu écoutes.',
  ];
  for (const l of lines) await d.say(l, undefined, { voice: 'noa', auto: 150 });
  await game.until(() => done);
}

export const foamLook: Script = looks('mousse', [
  'La mousse est jaune et pleine de trous. Quand tu appuies, elle met longtemps à se regonfler.',
  'Sous la mousse, quelque chose bat. Lub. Dub. Et un long silence.',
]);
export const boiteMouse: Script = look(['Une petite souris en feutre, cousue au mur par la queue.', 'Elle tient une pièce de dix centimes entre ses pattes. Elle a l\'air d\'attendre une dent depuis très longtemps.']);

// ---------------------------------------------------------------------------------------------------------------------
// couloir_41 — the corridor of the forty-one doors (T8, § 2.9)
// ---------------------------------------------------------------------------------------------------------------------

/** Layout shared with the map (src/data/maps/chapter6.ts). Rows: wall face (door tops), base (doors). */
export const CORRIDOR = {
  trunk: { wall: 8, base: 9, floor: 10 },
  haut: { wall: 1, base: 2, floor: 3 },
  bas: { wall: 15, base: 16, floor: 17 },
  /** x of door n: 1–14 on the trunk, 15–41 on each branch. */
  doorX: (n: number): number => (n <= 14 ? 3 + 2 * (n - 1) : 37 + 2 * (n - 15)),
  shaft: 32,
  width: 93,
};

type Side = 'haut' | 'bas';
type Version = 'douce' | 'dure';

interface Fragment {
  sfx?: Sfx;
  text: string[];
  /** The screen goes dark while it plays (otherwise it floats out of the door and Noa walks on). */
  dark?: boolean;
}

/** Behind the fourteen doors of the trunk: the seconds before the voices (3:14, the phone, Noa awake). */
const TRUNK: Fragment[] = [
  { sfx: 'buzz', text: ['Bzzz. Bzzz.', 'Le téléphone vibre sur le bureau. L\'écran s\'allume : « Mina 🐑 ».'], dark: true },
  { text: ['Tu ne bouges pas.'] },
  { sfx: 'buzz', text: ['Bzzz. Bzzz.', 'Le casque sur tes oreilles. Rien dedans, pas de musique. Juste pour ne pas entendre.'], dark: true },
  { text: ['3:14.'] },
  { sfx: 'buzz', text: ['Bzzz.', 'La veilleuse est allumée sur ta table de nuit. Sa veilleuse. Elle fait une lune au plafond.'], dark: true },
  { text: ['Tu enlèves le casque.'] },
  { sfx: 'beep', text: ['Clic.', 'Tu as décroché.'], dark: true },
  { sfx: 'beep', text: ['Dans le téléphone, une chambre d\'hôpital. Une machine qui bipe, lentement.', 'Une voix d\'adulte, loin du micro : « Vas-y, ma puce. Il t\'écoute. »'], dark: true },
  { text: ['Quelqu\'un respire, tout près.'] },
  { text: ['Tu ne dis rien.'] },
  { text: ['Elle ne dit rien.'] },
  { sfx: 'pipe', text: ['La pluie contre ta fenêtre. Le radiateur : toc.'], dark: true },
  { text: ['Tu ouvres la bouche.'] },
  { text: ['Quatorze secondes.', 'Derrière la porte, il y a une voix. Puis il y en a deux. Puis le couloir se partage.'], dark: true },
];

/**
 * The two versions of the call (§ 2.9), door by door. Both have the same length, the same doors, the same silences
 * between the words and the same last word; the game never says which one was said.
 */
const CALL: Record<Version, Record<number, [string, string]>> = {
  douce: {
    15: ['minavoix', 'Noa ?'],
    18: ['noavoix', '…Mina ? Il est trois heures.'],
    21: ['minavoix', 'J\'ai peur. Y a pas ma veilleuse.'],
    25: ['noavoix', 'Je te l\'apporte demain. Promis.'],
    29: ['minavoix', 'Promis promis ?'],
    34: ['noavoix', 'Promis promis. Dors, Mina.'],
  },
  dure: {
    15: ['minavoix', 'Noa ?'],
    18: ['noavoix', 'Quoi ? Il est trois heures.'],
    21: ['minavoix', 'T\'as ma veilleuse ?'],
    25: ['noavoix', '…Arrête d\'appeler. Tu vas encore être malade à cause de moi.'],
    29: ['minavoix', 'Noa…'],
    34: ['noavoix', 'Dors.'],
  },
};

/** What floats out of the other doors of both branches (the same in both). */
const SILENCES: Record<number, string> = {
  16: 'La machine bipe.',
  17: '…',
  19: 'Elle respire.',
  20: 'Toc. Le radiateur.',
  22: '…',
  23: 'Ta main serre le téléphone.',
  24: 'La pluie.',
  26: '…',
  27: 'La machine bipe.',
  28: 'Elle respire. Plus lentement.',
  30: '…',
  31: 'La veilleuse grésille.',
  32: 'Toc.',
  33: '…',
  35: 'Elle respire.',
  36: '…',
  37: 'La machine bipe.',
  38: '…',
  39: 'Elle ne raccroche pas.',
  40: 'Toi non plus.',
};

/** Which version plays behind the upper branch (drawn once per run). */
function upper(): Version {
  let v = G.state.flags.c6_haut;
  if (v !== 'douce' && v !== 'dure') {
    v = rng.next() < 0.5 ? 'douce' : 'dure';
    G.state.flags.c6_haut = v;
  }
  return v as Version;
}
const versionOf = (side: Side): Version => (side === 'haut' ? upper() : upper() === 'douce' ? 'dure' : 'douce');

export const couloirEnter: Script = async (d) => {
  upper();
  world.extraDarkness = 0.1;
  audio.setAmbience('none');
  if (flag('c6_couloir')) return;
  d.set('c6_couloir');
  await d.wait(30);
  await tell(d, ['Un couloir. Celui de l\'appartement : le papier peint, le parquet qui grince, l\'interrupteur qui ne marche plus.', 'Mais beaucoup trop long. Et des portes. Beaucoup trop de portes.']);
  await tell(d, ['Sur chacune, une petite plaque. 1. 2. 3.', 'Ce ne sont pas des numéros de chambre. Ce sont des secondes.']);
  await voice(d, ['Quarante et une. Une par seconde.', 'Tu es sûr de vouloir les ouvrir ? Tu pourrais rester dans le couloir. C\'est bien, un couloir. Il ne s\'y passe rien.']);
};

/** Opens a door tile pair for a moment (the door swings open on darkness). */
function setDoor(x: number, wall: number, open: boolean): void {
  retile([
    [x, wall, open ? 'r_door_open_top' : 'r_door_top'],
    [x, wall + 1, open ? 'r_door_open' : 'r_door'],
  ]);
}

async function playFragment(d: Director, x: number, wall: number, f: Fragment): Promise<void> {
  world.player.moving = false;
  setDoor(x, wall, true);
  d.sfx('door', { pitch: 0.7, vol: 0.5 });
  if (f.dark) {
    await d.fadeOut(16, '#000000');
    if (f.sfx) d.sfx(f.sfx, { vol: 0.7 });
    await d.narrate(f.text, { voice: 'noa' });
    await d.fadeIn(16);
    setDoor(x, wall, false);
    return;
  }
  if (f.sfx) d.sfx(f.sfx, { vol: 0.6 });
  murmur(f.text[0]!, x * TILE + 8, (wall + 2) * TILE + 4, 170);
  void (async () => {
    await game.wait(80);
    setDoor(x, wall, false);
  })();
}

/** A door of the trunk (1–14), heard when Noa passes in front of it. */
export const trunkDoor =
  (n: number): Script =>
  async (d) => {
    if (flag(`c6_porte_${n}`)) return;
    d.set(`c6_porte_${n}`);
    await playFragment(d, CORRIDOR.doorX(n), CORRIDOR.trunk.wall, TRUNK[n - 1]!);
  };

/** The fork: one corridor becomes two, exactly the same. */
export const fork: Script = async (d) => {
  if (flag('c6_fourche')) return;
  d.set('c6_fourche');
  world.player.moving = false;
  await tell(d, ['Le couloir se partage. Un passage monte, un autre descend.', 'Deux couloirs. Les mêmes. Le même papier peint, les mêmes plaques, les mêmes secondes, de 15 à 41.']);
  await voice(d, ['Tu voulais savoir ce que tu as dit ?', 'Il y a deux réponses. Écoute les deux. Après, tu choisiras celle que tu préfères croire.']);
};

/** A door of a branch (15–41): a line of the call, or a silence. */
export const branchDoor =
  (side: Side, n: number): Script =>
  async (d) => {
    const k = `c6_${side}_${n}`;
    if (flag(k) || n === 41) return;
    d.set(k);
    const wall = CORRIDOR[side].wall;
    const x = CORRIDOR.doorX(n);
    const line = CALL[versionOf(side)][n];
    if (!line) {
      await playFragment(d, x, wall, { text: [SILENCES[n] ?? '…'] });
      return;
    }
    world.player.moving = false;
    setDoor(x, wall, true);
    d.sfx('door', { pitch: 0.7, vol: 0.5 });
    await d.fadeOut(16, '#000000');
    d.sfx('static', { vol: 0.2, pitch: 0.6 });
    await d.say(line[1], line[0], { pos: 'center' });
    await d.fadeIn(16);
    setDoor(x, wall, false);
  };

/** Door 41 at the end of a branch: « Clic. » — it opens on door 14, or, once both are heard, on the end. */
export const door41 =
  (side: Side): Script =>
  async (d) => {
    world.player.moving = false;
    const other: Side = side === 'haut' ? 'bas' : 'haut';
    const x = CORRIDOR.doorX(41);
    setDoor(x, CORRIDOR[side].wall, true);
    d.sfx('door', { pitch: 0.6, vol: 0.5 });
    await d.fadeOut(20, '#000000');
    d.sfx('beep', { vol: 0.5, pitch: 0.7 });
    await d.narrate(['Clic.', 'Zéro minute, quarante et une secondes.'], { voice: 'noa' });
    d.set(`c6_ecoute_${side}`);
    if (!flag(`c6_ecoute_${other}`)) {
      await d.narrate('La porte 41 donne sur la porte 14.', { voice: 'noa' });
      d.load('couloir_41', 'fourche');
      await d.fadeIn(30);
      await tell(d, 'Le même couloir. L\'autre passage t\'attend.');
      return;
    }
    d.load('couloir_41', 'bout');
    await d.fadeIn(40);
    await question(d);
    await buttonWindows(d);
  };

/** « Laquelle est vraie ? » — recorded in G.meta.callVersion; nobody ever says. */
async function question(d: Director): Promise<void> {
  if (flag('c6_appel')) return;
  spawnDodo(d, 10, 29);
  await d.wait(30);
  await tell(d, ['Le bout du couloir. Une petite pièce sans fenêtre.', 'Ça sent le plastique chaud et la nuit.']);
  const before = G.meta.callVersion;
  if (before) {
    const said: Record<CallAnswer, string> = { douce: 'la douce', dure: 'la dure', sais_pas: 'que tu ne savais pas' };
    await d.say([`La dernière fois, tu as choisi ${said[before]}.`, 'C\'est pratique, la mémoire. On la range comme on veut.'], 'dodonoa:creepy');
  }
  await d.say(['Tu as entendu les deux.', 'Alors ?'], 'dodonoa:neutral');
  const c = await d.ask('Laquelle est vraie ?', ['La douce', 'La dure', 'Je ne sais pas'], 'dodonoa:neutral');
  const answers: CallAnswer[] = ['douce', 'dure', 'sais_pas'];
  G.meta.callVersion = answers[c]!;
  writeMeta(G.meta);
  d.set('c6_appel');
  await d.wait(40);
  await d.say(['Personne ne te dira si tu as raison.', 'Pas moi. Surtout pas moi.'], 'dodonoa:neutral');
  await tell(d, 'Personne n\'était là pour l\'entendre. Personne, sauf vous deux.');
}

// --- The button windows: 3:38 seen through Dodo's eyes --------------------------------------------------------------

/** Two round windows cut out of the dark (Dodo's button eyes): the real room shows through them. */
class ButtonWindows implements Scene {
  readonly transparent = true;
  readonly passthrough = true;
  /** 0 = shut, 1 = open. */
  open = 0;
  private goal = 0;
  private t = 0;

  static show(): ButtonWindows {
    const s = new ButtonWindows();
    game.push(s);
    return s;
  }

  to(goal: number): Promise<void> {
    this.goal = goal;
    return game.until(() => Math.abs(this.open - this.goal) < 0.01);
  }

  close(): void {
    game.remove(this);
  }

  update(): void {
    this.t++;
    const dlt = this.goal - this.open;
    this.open += Math.sign(dlt) * Math.min(Math.abs(dlt), 0.012);
  }

  draw(g: CanvasRenderingContext2D): void {
    const r = 64 * this.open;
    const eyes = [W / 2 - 70, W / 2 + 70];
    const cy = H / 2 - 16;
    g.save();
    g.fillStyle = '#1a130c';
    g.beginPath();
    g.rect(0, 0, W, H);
    for (const cx of eyes) {
      g.moveTo(cx + r, cy);
      g.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
    }
    g.fill('evenodd');
    if (r > 2) {
      for (const cx of eyes) {
        // The rim of the button, the four holes, the cross of red thread over the glass.
        g.strokeStyle = '#2d2238';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(cx, cy, r + 2, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = '#4e4359';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, r + 5, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 0.45;
        g.strokeStyle = '#c8424f';
        g.lineWidth = 2;
        const k = r * 0.5;
        g.beginPath();
        g.moveTo(cx - k, cy - k);
        g.lineTo(cx + k, cy + k);
        g.moveTo(cx + k, cy - k);
        g.lineTo(cx - k, cy + k);
        g.stroke();
        g.globalAlpha = 1;
        g.fillStyle = '#1a130c';
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          g.beginPath();
          g.arc(cx + dx * k, cy + dy * k, Math.max(1, r * 0.07), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.restore();
  }
}

/** Dodo's eyes become two windows on Noa's room, a year ago, 3:38 (§ 2.9). Dodo was there: he saw. */
async function buttonWindows(d: Director): Promise<void> {
  if (flag('c6_fenetres')) return;
  await d.say(['Viens. Je vais te montrer ce que j\'ai vu, moi.', 'J\'étais là. J\'ai toujours été là.'], 'dodonoa:neutral');
  for (const id of ['oeil_g', 'oeil_d']) {
    const e = d.find(id);
    if (e) e.sprite = 'prop_c6_oeil_fenetre';
  }
  d.sfx('chime', { pitch: 0.5, vol: 0.4 });
  await tell(d, ['Sur le mur du fond, deux boutons noirs grands comme des fenêtres. Les yeux de Dodo.', 'Ils s\'éclairent de l\'intérieur.']);
  await d.fadeOut(50, '#1a130c');
  const back = { x: world.player.x, y: world.player.y };
  d.music(null, 1);
  // The room, a year ago. Noa in bed, the nightlight on, the door shut. Dodo sits against the door, in the hallway.
  d.load('chambre', 'bed', true);
  d.remove('dodo');
  d.remove('dodo_plush');
  inBed(d, true);
  world.extraDarkness = 0.3;
  const win = ButtonWindows.show();
  await d.fadeIn(10);
  await win.to(1);
  await d.wait(30);
  await tell(d, ['Ta chambre. Une nuit d\'il y a un an.', 'La quarante-deuxième.']);
  await tell(d, ['Tu es dans ton lit. La veilleuse est allumée.', 'Tu vois tout ça d\'en bas, de très près du sol. D\'un peu derrière la porte.']);
  await d.wait(40);
  await d.narrate('3:38', { voice: 'noa' });
  // The door opens; the plush that sat against it in the hallway falls over on its side, toward the bed.
  d.sfx('door', { pitch: 0.9, vol: 0.6 });
  retile([
    [8, 1, 'r_door_open_top'],
    [8, 2, 'r_door_open'],
  ]);
  const plush = d.spawn({ id: 'plush338', sprite: 'prop_dodo_plush', x: 8, y: 3, solid: false, shadow: false });
  plush.oy = -4;
  await d.wait(14);
  plush.sprite = 'prop_c6_dodo_tombe';
  plush.oy = 0;
  d.sfx('step', { pitch: 0.4, vol: 0.4 });
  await d.wait(30);
  await tell(d, ['La porte s\'ouvre. La peluche qui était assise contre bascule sur le côté.', 'Elle tombe la tête tournée vers le lit. Elle ne peut plus regarder ailleurs.']);
  d.spawn({ id: 'maman338', char: 'maman', x: 8, y: 3, dir: 'down' });
  await d.wait(20);
  await d.walkTo('maman338', 7, 4, 0.45);
  await d.walkTo('maman338', 3, 4, 0.45);
  d.face('maman338', 'left');
  await d.wait(30);
  await tell(d, ['Maman. Son manteau sur le dos. Son téléphone dans la main, l\'écran encore allumé.', 'Elle n\'allume pas la lumière.']);
  await d.wait(30);
  d.sfx('pop', { vol: 0.5, pitch: 0.6 });
  const lamp = d.find('veilleuse');
  if (lamp) lamp.light = undefined;
  world.extraDarkness = 0.62;
  await d.wait(40);
  await tell(d, ['Elle débranche la veilleuse.', 'Le noir, d\'un coup.']);
  await d.wait(40);
  await d.say('{spd:0.6}Noa ?{/spd}', 'mamanvoix');
  await d.wait(60);
  await tell(d, 'Le garçon dans le lit serre les paupières.');
  await d.wait(40);
  await tell(d, ['Elle reste là. Longtemps.', 'Le fil de la veilleuse enroulé autour de sa main.']);
  await d.walkTo('maman338', 7, 4, 0.45);
  await d.walkTo('maman338', 8, 3, 0.45);
  d.face('maman338', 'up');
  await d.wait(20);
  d.remove('maman338');
  await tell(d, ['Elle sort. Elle ne referme pas tout à fait.', 'La peluche reste où elle est tombée, sur le seuil, la tête vers le lit. Elle a tout vu.']);
  await d.wait(30);
  await win.to(0);
  win.close();
  d.remove('plush338');
  d.load('couloir_41', 'bout', true);
  world.player.x = back.x;
  world.player.y = back.y;
  spawnDodo(d, 10, 29);
  for (const id of ['oeil_g', 'oeil_d']) {
    const e = d.find(id);
    if (e) e.sprite = 'prop_c6_oeil';
  }
  d.set('c6_fenetres');
  await d.fadeIn(50);
  await d.say(['Elle, quarante et une nuits.', 'Toi, quarante et une secondes.'], 'dodonoa:neutral');
  await d.wait(30);
  await d.say('…Je ne dormais pas.', 'noa:sad');
  await tell(d, 'Tu ne dormais pas.');
  await d.wait(20);
  await d.say(['Je sais.', 'J\'étais là.'], 'dodonoa:sad');
  d.music('appel', 2);
  await d.walkTo('dodo', 26, 29, 0.6);
  d.remove('dodo');
}

export const eyesLook: Script = async (d) => {
  if (!flag('c6_fenetres')) return;
  await tell(d, ['Les deux boutons ont refroidi. Ce sont de nouveau des yeux de peluche, noirs, cousus en croix.', 'Ils ont vu la nuit entière, la tête posée par terre. Ils ne pouvaient pas se fermer.']);
};

export const headphones: Script = async (d) => {
  d.set('c6_casque');
  await tell(d, ['Ton casque, par terre.', 'Le fil est enroulé si serré autour de l\'arceau qu\'il a coupé le plastique.']);
  await tell(d, 'Tu l\'as enroulé, cette nuit-là. Pendant quarante et une secondes. Puis tu as continué.');
};

/** The Pile (the battery of the voice module): the unique encounter (§ 3.14). */
export const pile: Script = async (d) => {
  if (flag('c6_pile_fait')) return;
  await tell(d, ['Une pile bouton. Ronde, plate, grosse comme une assiette.', 'Elle a roulé jusqu\'ici toute seule, en laissant derrière elle une traînée blanche. Elle grésille.']);
  await d.say('{static}…ne nuit… N… Dodo veil…{/static}', 'pile');
  await tell(d, ['Sur sa tranche, gravé : LR44.', 'Sur la boîte du kit, Nadia avait écrit : « ça tient environ un an ».']);
  await d.say('{spd:0.5}…ça… tient… environ… un… a…{/spd}', 'pile');
  const r = await d.battle(['pile']);
  d.set('c6_pile_fait');
  d.remove('pile');
  if (flag('c6_pile') || r.outcome === 'spare') {
    d.set('c6_pile');
    await tell(d, ['Elle tient au creux de ta main. Tiède. Elle ne grésille plus.', 'Il lui reste une phrase. Une seule. Tu ne sais pas encore pour qui.']);
  } else {
    d.set('c6_pile_morte');
    await tell(d, ['Elle ne grésille plus. Plus rien.', 'Quelque part plus loin, dans la grande salle, une voix vient de se taire un peu plus tôt que prévu.']);
  }
  const seam = d.find('sortie');
  if (seam) {
    d.sfx('thread', { pitch: 0.7, vol: 0.5 });
    seam.sprite = 'prop_c6_couture_ouverte';
    seam.solid = false;
  }
  await tell(d, 'Au fond de la pièce, la couture du papier peint s\'est ouverte. De l\'autre côté, une lumière blanche, plate. Un bourdonnement.');
};

export const boutLook: Script = looks('bout', [
  ['Le papier peint est celui du couloir de l\'appartement. Des lunes et des étoiles, délavées.', 'Mina avait choisi. Tu avais dit que c\'était pour les bébés.'],
  'À hauteur d\'enfant, quelqu\'un a dessiné une petite porte au feutre, avec une poignée. Elle ne s\'ouvre pas. Bien sûr qu\'elle ne s\'ouvre pas.',
]);
export const corridorWall: Script = looks('papier', [
  'Le papier peint gondole. Derrière, ça respire.',
  'Il y a des traces de doigts sur le papier peint, à hauteur de ta main. Des centaines. Toujours au même endroit, comme si tu t\'étais tenu au mur, nuit après nuit.',
]);
export const switchLook: Script = look('L\'interrupteur. Tu appuies. Rien. Tu appuies encore. Il fait toujours nuit.');
/** The seam in the wallpaper of the end room, before the Pile. */
export const boutSeam: Script = look(['Une couture, au milieu du papier peint. Des croix de fil rouge, serrées.', 'Derrière, quelque chose bourdonne, comme un frigo la nuit. Elle ne s\'ouvre pas. Pas encore.']);

// ---------------------------------------------------------------------------------------------------------------------
// voix — the voice chamber: the module, the crust, the puppets; the threshold (T9); the final battle
// ---------------------------------------------------------------------------------------------------------------------

export const voixEnter: Script = async (d) => {
  installMurmurs();
  world.extraDarkness = 0;
  d.music(null);
  audio.setAmbience('hum', 0.5);
  if (flag('c6_voix_vue')) return;
  d.set('c6_voix_vue');
  await d.wait(30);
  await tell(d, 'Le fond du ventre. Une salle immense.');
  // The camera climbs up the machine, slowly.
  world.player.moving = false;
  await d.cameraTo(15, 9);
  await d.wait(30);
  await d.cameraTo(15, 6);
  await d.wait(20);
  await tell(d, ['Au fond, une machine en plastique beige, haute comme une église. Deux boutons ronds : REC. PLAY.', 'Une grille de haut-parleur grande comme un mur.']);
  await tell(d, ['« Mon doudou qui parle ! — 2 pistes ». C\'est moulé en relief sur le côté, à hauteur de géant.', 'Mina l\'a cousue là, avec Nadia, à gros points de fil rouge.']);
  await tell(d, ['La pile fuit. Une croûte blanche descend du ventre de la machine et mange le coton, lentement.', 'Comme une moisissure. Comme du givre qui aurait faim.']);
  d.cameraFollow();
  await d.wait(30);
};

export const moduleLook: Script = async (d) => {
  const n = bump('c6_module');
  if (n === 1) {
    await tell(d, ['La machine bourdonne. La grille du haut-parleur est grande comme un mur.', 'Dans les trous, il y a du coton, et dans le coton, il y a des miettes de voix.']);
    return;
  }
  const r = await d.ask('Appuyer sur…', ['PLAY', 'REC', 'Rien'], undefined, { cancelIndex: 2 });
  if (r === 0) {
    d.sfx('tooth', { pitch: 0.4, vol: 0.7 });
    await d.wait(30);
    d.sfx('static', { vol: 0.6, pitch: 0.5 });
    if (flag('c6_pile_morte')) {
      await tell(d, ['Le bouton s\'enfonce. Rien ne sort.', 'Pas même du grésillement. La machine a fini de parler.']);
    } else {
      await d.say('{spd:0.3}{static}« …nne… nuit… N…… »{/static}{/spd}', 'dodoreel');
      await tell(d, ['La voix sort de partout à la fois. Des murs, du sol, de ta poitrine.', 'Elle s\'arrête au même endroit que dans ta chambre. Les parois continuent toutes seules : « …fais de beaux rêves ».']);
    }
  } else if (r === 1) {
    await tell(d, ['REC. Ton pouce sur le bouton rouge.', 'Qu\'est-ce que tu enregistrerais ? Pour qui ?', 'Tu enlèves ton pouce.']);
  }
};

export const crustLook: Script = looks('croute', [
  ['La croûte de la pile. Blanche, cristalline, comme du sel sur une route en hiver.', 'Au bord, là où elle mord le coton, c\'est gris, mou, et ça sent le métal.'],
  'Elle a avancé depuis tout à l\'heure. Tu en es sûr.',
  'Tu poses le pied dessus. Ça crisse. Elle ne fait pas mal. C\'est ça, le pire.',
]);
export const puppetPrincess: Script = look(['La princesse au crayon. Sa robe rose pend au bout des fils, sa couronne de papier par-dessus.', 'Il n\'y a personne dedans. Il n\'y a jamais eu personne dedans : c\'est toi qui tenais les fils.']);
export const puppetFelt: Script = look(['La poupée de feutre. Mina n°366, ou une autre. Vide, plate, son sourire brodé replié sur lui-même.', 'Sa couronne est cousue. Elle n\'est jamais tombée, celle-là.']);
export const voixThread: Script = look(['Les fils des marionnettes montent jusqu\'au plafond et se perdent dans le coton.', 'Ils sont tous noués au même endroit. Juste au-dessus de ta tête.']);

/** The route of the ink: where she should be, a pool of ink and the hat lying flat in it. */
export const inkPool: Script = looks('encre', [
  ['Une flaque d\'encre, de la taille d\'un enfant. Le coton la boit tout autour, lentement.', 'Au milieu, un bonnet tricoté à oreilles de mouton, posé à plat. Vide.'],
  'Tu ne le ramasses pas. Il n\'y a plus rien dessous à regarder.',
]);

/** The little girl in the knitted hat, when Noa talks to her after the threshold (or on the way in). */
export const petiteTalk: Script = async (d) => {
  if (flag('c6_regarder')) {
    await d.say(['Vas-y, gros bêta.', 'Moi, je reste là. Je regarde.'], 'bonnet:drawn');
    return;
  }
  await tell(d, 'Elle ne se retourne pas. Elle attend que tu sois prêt.');
};

// --- The notebook opened outside battle (T9): « regarder », « fermer les yeux », « partir » -----------------------

type ThresholdWord = 'regarder' | 'fermer les yeux' | 'partir';

/** A page of the notebook with three words, opened in Noa's hand, outside any battle. */
class NotebookPick implements Scene {
  readonly transparent = true;
  private idx = 0;
  private t = 0;
  private written = -1;
  private writeT = 0;
  private resolve: ((w: number) => void) | null = null;

  constructor(
    private readonly words: string[],
    private readonly crossed: boolean[],
  ) {
    this.idx = crossed.findIndex((c) => !c);
  }

  static pick(words: string[], crossed: boolean[]): Promise<number> {
    const s = new NotebookPick(words, crossed);
    game.push(s);
    input.consume();
    return new Promise((r) => {
      s.resolve = r;
    });
  }

  update(): void {
    this.t++;
    if (this.written >= 0) {
      this.writeT++;
      if (this.writeT % 6 === 0 && this.writeT < this.words[this.written]!.length * 6) audio.sfx('write', { vol: 0.35, pitch: 0.9 + rng.next() * 0.2 });
      if (this.writeT > this.words[this.written]!.length * 6 + 40) {
        game.remove(this);
        input.consume();
        this.resolve?.(this.written);
      }
      return;
    }
    if (this.t < 20) return;
    const step = (dir: number): void => {
      let i = this.idx;
      for (let k = 0; k < this.words.length; k++) {
        i = (i + dir + this.words.length) % this.words.length;
        if (!this.crossed[i]) break;
      }
      if (i !== this.idx) audio.sfx('move');
      this.idx = i;
    };
    if (input.pressed('up') || input.pressed('left')) step(-1);
    if (input.pressed('down') || input.pressed('right')) step(1);
    if (input.pressed('a')) {
      audio.sfx('select');
      this.written = this.idx;
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = 'rgba(20,14,8,0.55)';
    g.fillRect(0, 0, W, H);
    const pw = 170;
    const ph = 98;
    const px = Math.round(W / 2 - pw / 2);
    const py = 16;
    g.fillStyle = '#f4ecd8';
    g.fillRect(px, py, pw, ph);
    g.fillStyle = '#c9d3e6';
    for (let y = py + 22; y < py + ph; y += 12) g.fillRect(px + 4, y, pw - 8, 1);
    g.fillStyle = '#e8a0a8';
    g.fillRect(px + 18, py, 1, ph);
    g.fillStyle = '#2d2238';
    g.fillRect(px, py, pw, 1);
    g.fillRect(px, py + ph - 1, pw, 1);
    g.fillRect(px, py, 1, ph);
    g.fillRect(px + pw - 1, py, 1, ph);
    drawText(g, tr('Carnet'), px + 26, py + 6, { color: '#7d6f86' });
    this.words.forEach((w, i) => {
      const y = py + 26 + i * 22;
      const text = tr(w);
      const shown = this.written === i ? text.slice(0, Math.floor(this.writeT / 6)) : text;
      const col = this.crossed[i] ? '#b7aab8' : '#4e4359';
      drawText(g, shown, px + 34, y, { color: col, scale: 1 });
      if (this.crossed[i]) {
        g.fillStyle = '#4e4359';
        g.fillRect(px + 30, y + 4, measure(text) + 8, 1);
      }
      if (i === this.idx && this.written < 0 && Math.floor(this.t / 20) % 2 === 0) drawText(g, '>', px + 24, y, { color: '#c8424f' });
      if (this.written === i) {
        g.fillStyle = '#c8424f';
        g.fillRect(px + 34, y + 10, Math.min(measure(text), this.writeT * 1.5), 1);
      }
    });
  }
}

/** The threshold of the voice (T9, § 2.10). */
export const threshold: Script = async (d) => {
  if (flag('c6_seuil')) return;
  world.player.moving = false;
  d.face('player', 'up');
  const silence = isSilenceRoute();
  if (silence) {
    await tell(d, ['Au milieu de la salle, il n\'y a personne.', 'Une tache d\'encre sur le coton, de la taille d\'un enfant. Un bonnet posé dedans, à plat.']);
  } else if (!flag('c6_partir')) {
    await tell(d, ['Elle est là. La petite fille au bonnet.', 'Celle qui était toujours un peu plus loin, de dos, au coin d\'un mur, derrière une vitre. Depuis le début de la nuit.']);
    await tell(d, ['Les oreilles de mouton de son bonnet pendent de chaque côté.', 'Elle ne se retourne pas. Elle attend.']);
  } else {
    await tell(d, 'Elle est toujours là, de dos. Elle n\'a pas bougé d\'un pouce.');
  }
  await d.wait(20);
  d.sfx('write', { vol: 0.4 });
  await tell(d, 'Le carnet s\'ouvre tout seul dans ta main.');
  const words: ThresholdWord[] = ['regarder', 'fermer les yeux', 'partir'];
  const shown = silence ? words.map((w) => blot(w)) : words;
  const pick = await NotebookPick.pick(shown, [false, false, flag('c6_partir')]);
  if (silence) {
    await tell(d, ['Les mots sont noyés. Tu écris quand même.', 'L\'encre boit ce que tu écris. Il n\'y a plus rien à regarder, plus rien à fermer.']);
    d.set('c6_seuil');
    await beforeFinal(d);
    return;
  }
  if (words[pick] === 'partir') {
    d.set('c6_partir');
    await tell(d, ['Tu tournes le dos. Tu marches vers la sortie.', 'Le coton étouffe tes pas. Tu ne cours pas. Tu as envie de courir.']);
    await d.fadeOut(40);
    d.load('voix', 'entree');
    await d.fadeIn(40);
    await tell(d, ['La sortie donne sur la même salle.', 'La même machine. La même croûte. Les mêmes marionnettes. Et au milieu, de dos, la petite fille au bonnet.']);
    await voice(d, ['Il n\'y a pas de sortie, ici. Il n\'y en a jamais eu.', 'Il y a elle. Et il y a moi.']);
    return;
  }
  d.set('c6_seuil');
  if (words[pick] === 'fermer les yeux') {
    await closeEyes(d);
  } else {
    await lookAtHer(d);
  }
  await beforeFinal(d);
};

async function closeEyes(d: Director): Promise<void> {
  await d.fadeOut(40, '#000000');
  await tell(d, 'Tu fermes les yeux.');
  await d.wait(30);
  d.sfx('step', { pitch: 1.5, vol: 0.4 });
  await d.say('D\'accord.', 'petite');
  await d.say(['Tu regarderas quand tu pourras.', 'Moi, j\'attends. J\'ai l\'habitude, tu sais. Tu mets toujours super longtemps.'], 'petite');
  await d.wait(30);
  await d.say('C\'est pas grave. On a le droit.', 'petite');
  await d.fadeIn(40);
}

async function lookAtHer(d: Director): Promise<void> {
  await tell(d, 'Tu la regardes.');
  await d.wait(30);
  d.face('petite', 'down');
  await d.wait(40);
  await tell(d, ['Elle se retourne.', 'Là où il devrait y avoir un visage, il y a une feuille blanche. Puis un trait de crayon. Puis un autre.']);
  d.set('c6_regarder');
  await d.image('bonnet_visage', ['Son visage, au crayon de papier. Fatigué, et souriant.', 'Pas de couettes. Juste le bonnet.']);
  const e = d.find('petite');
  if (e) e.char = 'bonnet_drawn';
  await d.wait(20);
  await d.say('T\'as mis le temps, gros bêta.', 'bonnet:drawn');
  await d.wait(30);
  await d.say(['Je voulais juste te dire que je savais.', 'Pour la veilleuse. Que c\'était toi qui avais peur du noir.'], 'bonnet:drawn');
  await d.say(['C\'est pas grave.', 'On a le droit.'], 'bonnet:drawn');
  await d.wait(40);
  await d.say('Le téléphone… qu\'est-ce que je t\'ai dit ?', 'noa:sad');
  await d.wait(40);
  await d.say(['…Je sais pas.', 'J\'étais très fatiguée.'], 'bonnet:drawn');
  await d.say(['Toi non plus, tu sais pas.', 'Alors on sait pas, tous les deux.'], 'bonnet:drawn');
  await d.wait(30);
  await tell(d, ['Elle a fini sa phrase.', 'Celle que la Mina du rêve n\'a jamais pu finir, nuit après nuit, parce que tu l\'arrêtais avant.']);
  await d.say(['Et Dodo, faut pas lui en vouloir.', 'Je lui ai dit de veiller sur toi. Il l\'a pris très, très au sérieux.'], 'bonnet:drawn');
}

/** Dodo comes down from the ceiling: the final battle (dodo_v2), then where it leads (endings.ts). */
async function beforeFinal(d: Director): Promise<void> {
  d.sfx('thread', { pitch: 0.5, vol: 0.6 });
  d.shake(1, 20);
  await tell(d, ['Au-dessus de la machine, les coutures du plafond craquent, une à une.', 'Quelque chose descend au bout de ses propres fils.']);
  spawnDodo(d, 15, 11);
  const dodo = d.find('dodo');
  if (dodo) {
    dodo.oy = -60;
    for (let i = 0; i < 30; i++) {
      dodo.oy += 2;
      await d.wait(2);
    }
  }
  if (isSilenceRoute()) {
    await d.say(['Tu vois ? Il n\'y a plus personne.', 'Il n\'y a plus rien à réveiller. Reste.'], 'dodotorn:creepy');
  } else {
    await d.say(['Ne la regarde pas trop.', 'Je l\'ai cousue avec ce que tu avais : ta voix, tes souvenirs, ton coton. Elle est à toi. Elle reste si tu restes.'], 'dodotorn:neutral');
    await d.say('Reste.', 'dodotorn:creepy');
  }
  d.set('c6_final');
  const route = await runFinalBattleV2(d);
  d.remove('dodo');
  await afterFinalBattle(d, route);
}

// ---------------------------------------------------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------------------------------------------------

/** After chapter 5: 26 Étoiles, the Plume dorée, the Cape de Mina, a few items, friends spared. */
function setup(flags: Record<string, number | boolean | string>): void {
  const s = G.state;
  s.chapter = 6;
  s.etoiles = 26;
  s.encre = 3;
  s.weapon = 'plume';
  s.armor = 'cape';
  s.items = ['chocolat', 'lait', 'biscuit', 'mouchoir', 'pluie', 'pomme'];
  s.boutons = 60;
  s.spares = { nuage: 2, mouton_noir: 1, placard: 1, gomme: 1, perfusion: 1, couseuse: 1, vitre: 1 };
  s.party = [];
  s.flags.p_dodo = true;
  s.flags.c3_cape = true;
  s.flags.c4_fin = true;
  s.flags.i4_fin = true;
  s.flags.c5_fin = true;
  s.flags.c5_vitre = 'epargnee';
  const coton = param('coton');
  if (coton !== null) s.flags.c4_coton = Number(coton);
  for (const [k, v] of Object.entries(flags)) s.flags[k] = v;
  s.hp = maxHp(s);
}

const AFTER_T7 = { c6_intro: true, c6_mur_1: true, c6_mur_2: true, c6_mur_3: true, c6_mur_4: true, c6_t7: true };
const AFTER_JARS = { ...AFTER_T7, c6_ouate_vu: true, c6_couture_vue: true, c6_nuit1: true, c6_bocal0: true, c6_couture: true, c6_bocaux: 8 };
const AFTER_BOX = { ...AFTER_JARS, c6_boite_vue: true, c6_peigne: true, c6_dent_1: true, c6_dent_2: true, c6_dent_3: true, c6_dents: 3, c6_boite: true };
const AFTER_CALL = { ...AFTER_BOX, c6_couloir: true, c6_fourche: true, c6_ecoute_haut: true, c6_ecoute_bas: true, c6_appel: true, c6_fenetres: true };

/** Scripts runnable with ?debug=script&name=… (&coton=N: sheep emptied in chapter 4, the Bourres of the wadding). */
export const DEBUG: Record<string, Script> = {
  /** The whole chapter, from the card. */
  chapter6: async (d) => {
    setup({});
    await start(d);
  },
  /** The hollow of the seam: T7 (the DODO / NOA switch, the real flashback). */
  chapter6_t7: async (d) => {
    setup({ c6_intro: true, c6_mur_1: true, c6_mur_2: true, c6_mur_3: true, c6_mur_4: true });
    d.load('couture', 'creux');
    world.player.x -= 3 * TILE;
    await d.fadeIn(10);
    await t7(d);
  },
  /** The wadding, just after T7: the jars, the riddle of night 0, the nest, Chaussette. */
  chapter6_bocaux: async (d) => {
    setup(AFTER_T7);
    d.load('ouate', 'couture');
    await d.fadeIn(10);
  },
  /** The music box chamber (&dents=3: the three teeth already found, only the crank is left). */
  chapter6_boite: async (d) => {
    const all = param('dents') === '3';
    setup({ ...AFTER_JARS, ...(all ? { c6_boite_vue: true, c6_peigne: true, c6_dent_1: true, c6_dent_2: true, c6_dent_3: true, c6_dents: 3 } : {}) });
    d.load('boite_a_musique', 'ouate');
    await d.fadeIn(10);
  },
  /** The corridor of the forty-one doors (&haut=douce|dure fixes which version plays in the upper branch). */
  chapter6_appel: async (d) => {
    const h = param('haut');
    setup({ ...AFTER_BOX, ...(h === 'douce' || h === 'dure' ? { c6_haut: h } : {}) });
    d.load('couloir_41', 'debut');
    await d.fadeIn(10);
  },
  /** Straight to the end of the corridor: « Laquelle est vraie ? » and the button windows on 3:38. */
  chapter6_fenetres: async (d) => {
    setup({ ...AFTER_BOX, c6_couloir: true, c6_fourche: true, c6_ecoute_haut: true, c6_ecoute_bas: true, c6_haut: 'douce' });
    d.load('couloir_41', 'bout');
    await d.fadeIn(10);
    await question(d);
    await buttonWindows(d);
  },
  /** The end of the corridor after the windows: the headphones and the Pile. */
  chapter6_pile: async (d) => {
    setup(AFTER_CALL);
    d.load('couloir_41', 'bout');
    await d.fadeIn(10);
  },
  /** The voice chamber and the threshold (T9). &silence=1: the route of the ink (nothing spared, 12 Encre). */
  chapter6_bonnet: async (d) => {
    const silence = param('silence') === '1';
    setup({ ...AFTER_CALL, c6_pile_fait: true, c6_pile: true });
    if (silence) {
      G.state.spares = {};
      G.state.kills = { nuage: 3, mouton_noir: 2, placard: 1, gomme: 1, perfusion: 1, couseuse: 1, vitre: 1 };
      G.state.encre = 12;
    }
    if (!silence && !G.state.keyItems.includes('pile_chargee')) G.state.keyItems.push('pile_chargee');
    d.load('voix', 'entree');
    await d.fadeIn(10);
  },
  /**
   * The final battle from the threshold, with flags: &bouton=1 (the Bouton doré kept), &pile=1 (the Pile spared: the
   * Pile chargée), &coups=deux|trois|rien|un (what Noa knocked back in Interlude IV), &regarder=1, &histoire=1 (Story
   * mode: slower knocks, no false knocks), &silence=1 (the route of the ink).
   */
  chapter6_final: async (d) => {
    const silence = param('silence') === '1';
    setup({ ...AFTER_CALL, c6_pile_fait: true, c6_voix_vue: true, c6_seuil: true });
    const s = G.state;
    if (param('bouton') === '1') {
      if (!s.keyItems.includes('bouton_dore')) s.keyItems.push('bouton_dore');
    } else s.flags.c1_bouton_vendu = true;
    if (param('pile') === '1') {
      s.flags.c6_pile = true;
      if (!s.keyItems.includes('pile_chargee')) s.keyItems.push('pile_chargee');
    } else s.flags.c6_pile_morte = true;
    const coups = param('coups');
    if (coups) s.flags.i4_knock = coups;
    if (param('regarder') === '1') s.flags.c6_regarder = true;
    if (param('histoire') === '1') G.settings.storyMode = true;
    if (silence) {
      s.spares = {};
      s.kills = { nuage: 3, mouton_noir: 2, placard: 1, gomme: 1, perfusion: 1, couseuse: 1, vitre: 1 };
      s.encre = 12;
    }
    d.load('voix', 'seuil');
    await d.fadeIn(10);
    await beforeFinal(d);
  },
};

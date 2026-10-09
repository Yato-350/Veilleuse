import { audio } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { drawText, measure } from '../../engine/font';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { input } from '../../engine/input';
import { rng } from '../../engine/math';
import { SOUVENIRS } from '../../data/illustrations';
import { tf, tr } from '../../i18n';
import type { Director } from '../director';
import type { Entity } from '../overworld/entity';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { CountingScene, type SheepKind, type SheepRound } from '../scenes/sheepcount';
import { G, maxHp } from '../state';
import { STORY, wakeUp } from './common';

/**
 * Chapter 4 — « La Maison Cousue » (docs/HISTOIRE.md § 3.11, T3 § 2.4, T4 § 2.5).
 *
 * The apartment as a giant dollhouse, its front open, standing on a page of a maths exercise book. Two layers:
 *   maison_feutre — the house Dodo sewed to keep Noa in (« en mieux »): warm felt, sewn windows, button-eyed sheep;
 *   maison_stylo  — the truth: the forty-one nights alone, in black ballpoint (one map for every night).
 * The cuckoo clock of the living room switches layer. Order of play:
 *   entrance (the door sews itself shut, thin Dodo, Mina n°366) → the looping dinner and the Poupée-Maman
 *   → Night 1 → felt → Night 9 → felt → Night 22 (Clé; the attic hatch opens) → felt → grenier (mannequins, La
 *   Couseuse, T3) → Night 35 (Noa takes the nightlight) → couloir_coups (the knocking code) → Night 42 out of 41 at
 *   the end of the corridor (T4) → Le Petit Homme → Mina n°366 unravels → souvenir « La lumière sous la porte »
 *   → wakeUp(4) (Interlude IV, production lot 2).
 *
 * Flags (c4_*):
 *   c4_intro          the entrance has been played
 *   c4_diner          number of times Noa ate in the looping dinner; c4_diner_fait once the Poupée-Maman fight is over
 *   c4_maman          'merci' | 'reste' (set by the battle, src/data/enemies-ch4.ts); c4_reste: true when « reste »
 *   c4_nuit           the night of the ballpoint layer (0 before Night 1, then 1, 9, 22, 35, 42)
 *   c4_nuit_fait      the last night whose event is done (the clock may move on)
 *   c4_tel_<n>        the phone of night n was answered
 *   c4_mina_dort      Mina n°366 sits on her chair as a doll (Noa is in the ballpoint layer, or has not woken her)
 *   c4_reveil_<n>     Mina n°366 was woken after night n
 *   c4_dodo_faim      Dodo asked for cotton; c4_coton: sheep emptied (0–4, read in chapter 6: the Bourres);
 *   c4_coton_chaud    the temporary « Coton chaud » bonus to max HP (state.ts maxHp), cleared when the chapter ends
 *   c4_mouton_<i>     sheep i of the toy chest was emptied
 *   c4_trappe         the attic hatch is open (after Clé, Night 22)
 *   c4_grenier        Noa went up to the attic; c4_etiquettes: tailor's labels read; c4_rideau: the curtain opened
 *   c4_couseuse       'epargnee' | 'vaincue' ('vaincue' freezes Mina n°366 in every later fight)
 *   c4_t3             the « 365 » reveal has been played
 *   c4_veilleuse      Noa carries the nightlight (Night 35)
 *   c4_coups          knocks answered right in the corridor (0–3); c4_coups_faux: wrong answers
 *   c4_nuit42         the light under the door (T4) has been seen
 *   c4_petit_homme    'epargne' | 'vaincu'; c4_fele: the nightlight is cracked (beaten)
 *   c4_mina366        'merci' (she thanked Noa before unravelling) | 'silence'
 *   c4_cabane         the pillow fort in Mina's felt room (the tender beat: a joke, Noa laughs)
 *   c4_fin            the chapter is over (souvenir 4 seen)
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);
/** The ballpoint nights, in order. */
export const NIGHTS = [1, 9, 22, 35, 42];
export const night = (): number => num('c4_nuit');
const nightDone = (): boolean => num('c4_nuit_fait') >= night() && night() > 0;
const withMina = (): boolean => G.state.party.includes('mina366');
/** After La Couseuse was beaten, Mina n°366 hardly moves any more. */
const still = (): boolean => G.state.flags.c4_couseuse === 'vaincue';
const tile = (px: number): number => Math.floor(px / TILE);

/** Mina n°366 says something, if she is following Noa (a frozen doll only manages « … »). */
async function mina(d: Director, text: string | string[], expr = 'neutral', stillText: string | string[] = '…'): Promise<void> {
  if (!withMina()) return;
  if (still()) await d.say(stillText, 'mina366:still');
  else await d.say(text, `mina366:${expr}`);
}

/** An inspection: lines, then Mina n°366's remark when she is there. */
export const look =
  (lines: string | string[], minaLine?: string | string[], expr = 'neutral'): Script =>
  async (d) => {
    await d.say(lines);
    if (minaLine) await mina(d, minaLine, expr);
  };

/** An inspection in the ballpoint layer whose text depends on the night (the latest key ≤ current night). */
export const byNight =
  (texts: Record<number, string | string[]>): Script =>
  async (d) => {
    const keys = Object.keys(texts)
      .map(Number)
      .filter((k) => k <= Math.max(1, night()))
      .sort((a, b) => b - a);
    const t = texts[keys[0] ?? 1];
    if (t) await d.say(t);
  };

// ---------------------------------------------------------------------------------------------------------------------
// The chapter card: written in ballpoint, crossed out, written again
// ---------------------------------------------------------------------------------------------------------------------

const PAPER = '#efe9dc';
const INK = '#1d2238';
const GRID = '#c9d3e6';

class PenCard implements Scene {
  private t = 0;
  private resolve: (() => void) | null = null;
  private readonly num = tr('Chapitre 4');
  private readonly title = tr('La Maison Cousue');

  static show(): Promise<void> {
    const c = new PenCard();
    game.push(c);
    return new Promise((r) => {
      c.resolve = r;
    });
  }

  update(): void {
    this.t++;
    const t = this.t;
    // The pen scratches while it writes; the crossing-out is louder.
    if (t < 110 && t % 7 === 0) audio.sfx('write', { vol: 0.35, pitch: 0.9 + rng.next() * 0.3 });
    if (t >= 120 && t < 160 && t % 5 === 0) audio.sfx('scratch', { vol: 0.5 });
    if (t >= 175 && t < 280 && t % 7 === 0) audio.sfx('write', { vol: 0.35, pitch: 0.8 + rng.next() * 0.2 });
    if (t > 420 || (t > 120 && (input.pressed('a') || input.pressed('b')))) {
      game.remove(this);
      input.consume();
      this.resolve?.();
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const t = this.t;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
    g.fillStyle = GRID;
    for (let x = 4; x < W; x += 8) g.fillRect(x, 0, 1, H);
    for (let y = 4; y < H; y += 8) g.fillRect(0, y, W, 1);
    g.fillStyle = '#e8505b';
    g.fillRect(36, 0, 1, H);
    const head = `${this.num} — ${this.title}`;
    const first = head.slice(0, Math.floor(Math.min(t, 110) * (head.length / 100)));
    drawText(g, first, W / 2, 56, { color: INK, align: 'center', scale: 1 });
    // Crossed out: a zigzag of ink over the first line, drawn stroke by stroke.
    if (t >= 120) {
      const w = measure(head);
      const x0 = Math.round(W / 2 - w / 2) - 4;
      const k = Math.min(1, (t - 120) / 40);
      g.fillStyle = INK;
      for (let i = 0; i < (w + 8) * k; i++) {
        const y = 59 + Math.round(Math.sin(i * 0.9) * 3);
        g.fillRect(x0 + i, y, 1, 2);
      }
    }
    // Written again, lower, bigger, a little crooked.
    if (t >= 175) {
      const n = Math.floor(Math.min(t - 175, 100) * (this.title.length / 90));
      drawText(g, this.num, W / 2, 86, { color: INK, align: 'center' });
      drawText(g, this.title.slice(0, n), W / 2 + 2, 100, { color: INK, align: 'center', scale: 2 });
    }
    if (t > 380) {
      g.fillStyle = `rgba(0,0,0,${Math.min(1, (t - 380) / 40)})`;
      g.fillRect(0, 0, W, H);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Opening: the door that sews itself shut, thin Dodo, Mina n°366
// ---------------------------------------------------------------------------------------------------------------------

export async function start(d: Director): Promise<void> {
  G.state.chapter = 4;
  await PenCard.show();
  await d.narrate('Ce n\'est plus son carnet. C\'est le tien.');
  d.load('maison_feutre', 'entree');
  await d.fadeIn(80);
  await entrance(d);
}

async function entrance(d: Director): Promise<void> {
  d.set('c4_intro');
  await d.wait(30);
  await d.say(['Une porte d\'entrée. La vôtre.', 'Le même paillasson. La même éraflure près de la poignée, là où Mina tapait avec ses bottes.']);
  await d.say(['Mais tout est en feutre.', 'Et tout est trop grand. Ou c\'est toi qui es devenu tout petit.']);
  // The door sews itself shut behind him.
  d.face('player', 'up');
  const seam = d.spawn({ id: 'coutures', sprite: 'prop_c4_coutures_1', x: 5, y: 13, solid: false, shadow: false, script: frontDoorFelt });
  seam.oy = 2;
  for (let i = 1; i <= 4; i++) {
    seam.sprite = `prop_c4_coutures_${i}`;
    for (let k = 0; k < 3; k++) {
      d.sfx('stitch', { pitch: 0.9 + k * 0.08 });
      await d.wait(9);
    }
    d.shake(1, 6);
    await d.wait(12);
  }
  await d.say(['Derrière toi, une aiguille passe et repasse dans le cadre de la porte.', 'Tac. Tac. Tac.', 'La porte se coud toute seule. Du haut jusqu\'en bas.']);
  await d.wait(30);
  // Thin Dodo floats down the stairs.
  d.spawn({ id: 'dodo', sprite: 'npc_dodo_thin', frames: ['npc_dodo_thin', 'npc_dodo_thin_2'], frameSpeed: 26, x: 3, y: 10, float: true, shadow: false, solid: false, script: dodoFelt });
  d.sfx('step', { pitch: 0.6, vol: 0.3 });
  await d.walkTo('dodo', 3, 14, 0.5);
  d.face('player', 'left');
  await d.walkTo('dodo', 4, 15, 0.5);
  await d.wait(20);
  await d.say('Regarde. Je l\'ai réparée.', 'dodo:happy');
  await d.say(['La maison. Tu te souviens ? Elle était toute abîmée.', 'Alors je l\'ai recousue. Point par point.', 'En mieux.'], 'dodo');
  await d.say('…Dodo ?', 'noa:surprised');
  await d.say(['Dodo a maigri.', 'Sa laine pend sur lui comme un pull trop grand.', 'Un flocon de coton s\'échappe de son flanc et tombe sans bruit sur le plancher.']);
  await d.say(['Ne fais pas attention.', 'Je perds un peu mes moyens.'], 'dodo');
  // Mina n°366 comes running.
  d.sfx('step', { pitch: 1.6 });
  d.spawn({ id: 'mina366_intro', char: 'mina366', x: 12, y: 17, dir: 'left' });
  await d.walkTo('mina366_intro', 6, 17, 1.8);
  await d.walkTo('mina366_intro', 5, 16, 1.8);
  d.face('mina366_intro', 'up');
  d.face('player', 'down');
  await d.say('Noa ! On est chez nous ! En mieux !', 'mina366:happy');
  await d.wait(20);
  await d.say('…Mina ?', 'noa:surprised');
  await d.say('Ben oui ! Qui d\'autre ?', 'mina366:happy');
  await d.say(['Tu en as mis, du temps !', 'Je t\'attends depuis super longtemps.'], 'mina366:happy');
  await d.wait(30);
  await d.say(['Ses yeux sont deux boutons noirs, cousus en croix avec du fil rouge.', 'Son sourire est brodé. Il ne bouge pas quand elle parle.', 'Sa couronne est en feutre, elle aussi.']);
  await d.say('{as:mina366:happy}Pourquoi tu fais cette tête ?{p:30} {as:mina366:neutral}On dirait que t\'as vu un fantôme.', 'mina366:happy');
  await d.say('…Tes yeux.', 'noa:sad');
  await d.say(['Quoi, mes yeux ?', 'Ils sont très bien, mes yeux. Ils tiennent.'], 'mina366:neutral');
  await d.say(['Elle est neuve. Je l\'ai finie ce soir.', 'Elle est jolie, hein ?'], 'dodo:happy');
  await d.say(['Viens ! Maman a fait à manger.', 'Maman est là, Noa. Maman est TOUJOURS là, maintenant.'], 'mina366:happy');
  await d.say('Je te protège. C\'est moi, la chevalière.{p:40} …C\'est moi, la chevalière.', 'mina366:happy');
  d.remove('mina366_intro');
  d.follower('mina366');
  world.resetFollower();
  await d.walkTo('dodo', 8, 16, 0.6);
  await d.walkTo('dodo', 11, 16, 0.6);
  const dodo = d.find('dodo');
  if (dodo) dodo.solid = true;
  await d.say('Mina te tire par la manche, vers le salon. Ça sent les pâtes. Ça sent les pâtes depuis le début.');
}

// ---------------------------------------------------------------------------------------------------------------------
// The looping dinner and the Poupée-Maman
// ---------------------------------------------------------------------------------------------------------------------

const TABLE_BY_LOOP = ['prop_c4_table', 'prop_c4_table', 'prop_c4_table_gris', 'prop_c4_table_moisi'];

/** The kitchen threshold: the dinner starts. */
export const kitchenEnter: Script = async (d) => {
  if (flag('c4_diner_fait') || !flag('c4_intro')) return;
  await dinner(d);
};

async function dinner(d: Director): Promise<void> {
  d.set('c4_diner_vu');
  await d.say('{wave}Il y a des pâtes.{/wave}', 'poupeemaman');
  await mina(d, 'À table ! Vite, avant que ça refroidisse.{p:30} Ça refroidit jamais.', 'happy');
  // Everyone takes a seat: Mina n°366 behind the drawn food, Dodo before the cotton, Noa before the plate « à personne ».
  const hadMina = withMina();
  if (hadMina) {
    d.follower(null);
    d.spawn({ id: 'mina_table', char: 'mina366', x: 29, y: 15, dir: 'down' });
  }
  d.show('dodo', false);
  d.spawn({ id: 'dodo_table', sprite: 'npc_dodo_thin', frames: ['npc_dodo_thin', 'npc_dodo_thin_2'], frameSpeed: 26, x: 32, y: 17, float: true, shadow: false, solid: false });
  await d.walkTo('player', 26, 18);
  await d.walkTo('player', 29, 18);
  d.face('player', 'up');
  await d.wait(20);
  await d.say([
    'La table est mise pour quatre.',
    'Une assiette de nourriture dessinée au crayon. Une touffe de coton. Un plateau d\'hôpital à trois compartiments, vide.',
    'Et devant toi, une assiette blanche. Sur le bord, une petite étiquette : « à personne ».',
  ]);
  const doll = d.find('poupee_maman');
  for (let loop = 1; ; loop++) {
    const tableE = d.find('table');
    if (tableE) tableE.sprite = TABLE_BY_LOOP[Math.min(loop, 3)]!;
    audio.tempoScale = Math.max(0.78, 1 - (loop - 1) * 0.07);
    if (doll) doll.frames = ['npc_maman_poupee_2', 'npc_maman_poupee'];
    d.sfx('thread', { pitch: 1.2 - loop * 0.1 });
    if (loop === 1) {
      await d.say(['La Poupée-Maman te sert.', 'Sa bouche est cousue en sourire. Les mots passent quand même, entre les points.']);
      await d.say('Il y a des pâtes.', 'poupeemaman');
      await d.say(['Des pâtes en laine, enroulées sur la louche. Elles fument un peu.', 'Pas de la vapeur. De la poussière.']);
      await d.say(['Dans son autre main, un téléphone. Cousu à sa paume.', 'L\'écran est éteint. Elle le regarde quand même, entre deux louches.']);
      await mina(d, 'Mange, sinon elle recommence.', 'neutral');
    } else if (loop === 2) {
      await d.say(['Clic.', 'La Poupée-Maman se relève. Reprend la louche. Comme si de rien n\'était.']);
      await d.say('Il y a des pâtes.', 'poupeemaman');
      await d.say(['Les points de sa bouche sont plus serrés qu\'avant. Le sourire est plus large.', 'Les pâtes sont un peu plus grises.']);
      await mina(d, 'Mange, sinon elle…{p:40} Mange, sinon elle recommence.', 'neutral');
      await d.say(['C\'est bon, hein ? C\'est comme avant.', 'Avant, c\'était bien.'], 'dodo:happy');
    } else if (loop === 3) {
      await d.say(['Clic.', 'La musique a ralenti. La louche aussi.']);
      await d.say('{shake}Il y a des pâtes.{/shake}', 'poupeemaman');
      await d.say(['Une moisissure de papier bleuit au bord de ton assiette.', 'Le téléphone cousu vibre dans sa main. Elle ne décroche pas.', 'Elle ne peut pas : ses doigts sont cousus autour.']);
      await mina(d, '{as:mina366:happy}Mange, Noa.{p:20} {as:mina366:neutral}C\'est bon.{p:20} {as:mina366:sad}C\'est toujours bon.', 'happy');
    } else {
      await d.say(['Clic.', 'Il n\'y a plus de pâtes dans la louche. Il n\'y a plus que du fil gris.', 'Elle sert quand même.']);
      await d.say('Il y a des pâtes. Il y a des pâtes. Il y a des pâtes.', 'poupeemaman', { speed: 0.6 });
    }
    if (doll) doll.frames = undefined;
    const choices = loop === 1 ? ['Manger', 'Ne pas manger'] : loop === 2 ? ['Manger', 'Ne pas manger', 'Se lever'] : loop < 5 ? ['Manger', 'Se lever'] : ['Se lever'];
    const i = await d.ask('…', choices);
    const pick = choices[i]!;
    if (pick === 'Se lever') break;
    if (pick === 'Manger') {
      d.set('c4_diner', num('c4_diner') + 1);
      await d.say(['Tu manges.', loop < 3 ? 'C\'est de la laine. Ça a le goût du froid. Du frigo. De l\'attente.' : 'Ça crisse sous les dents. Ça a le goût du papier mouillé.']);
    } else {
      await d.say(['Tu poses ta fourchette.', 'La Poupée-Maman s\'arrête au milieu d\'un geste. Les points de sa bouche grincent.']);
      await mina(d, '…Elle recommence.', 'sad');
    }
    // The loop starts again: the clock ticks backwards.
    d.glitch(14);
    d.sfx('whoosh', { pitch: 0.4, vol: 0.5 });
    await d.fadeOut(16, '#24141c');
    await d.wait(20);
    await d.fadeIn(16);
  }
  await d.say(['Tu te lèves. Ta chaise racle le plancher de feutre.', 'La Poupée-Maman se tourne vers toi. Tout son corps d\'un coup. Le sourire d\'abord.']);
  await d.battle(['poupee_maman']);
  audio.tempoScale = 1;
  d.set('c4_diner_fait');
  const tableE = d.find('table');
  if (tableE) tableE.sprite = 'prop_c4_table_gris';
  if (G.state.flags.c4_maman === 'reste') {
    await d.say(['La Poupée-Maman est assise à sa place.', 'Elle sert l\'air. Encore. Encore.', 'Elle ne se relèvera plus.']);
    await mina(d, 'On reste. C\'est bien, de rester.{p:30} Hein ?', 'happy');
  } else {
    await d.say(['La Poupée-Maman est assise. Ses mains sont vides.', 'Le téléphone est posé sur la nappe, à côté de ton assiette. L\'écran contre le tissu.']);
    await mina(d, ['Elle a dit merci.', 'Elle dit jamais merci, d\'habitude.'], 'happy');
    await d.say('…D\'habitude ?', 'noa:surprised');
    await mina(d, 'Je sais pas pourquoi j\'ai dit « d\'habitude ».', 'sad');
  }
  d.remove('dodo_table');
  d.show('dodo', true);
  await clockStrikes(d, hadMina);
}

/** After the dinner: the cuckoo strikes, Mina n°366 goes to bed on her chair, the felt peels off: Night 1. */
async function clockStrikes(d: Director, hadMina: boolean): Promise<void> {
  await d.wait(30);
  for (let i = 0; i < 4; i++) {
    d.sfx('baa', { pitch: 0.7, vol: 0.5 });
    await d.wait(36);
  }
  await d.say(['Dans le salon, l\'horloge sonne.', 'À la place du coucou, une tête de mouton sort de sa petite porte. Bêê. Bêê. Bêê.']);
  if (hadMina) {
    await d.say(['C\'est l\'heure. Faut que j\'aille me coucher.', 'Moi. Pas toi.', 'Toi, tu te couches jamais. T\'as remarqué ?'], 'mina366:neutral');
    const m = d.find('mina_table');
    if (m) {
      await d.walkTo('mina_table', 28, 17, 1);
      await d.walkTo('mina_table', 19, 17, 1);
      await d.walkTo('mina_table', 18, 16, 1);
    }
    d.remove('mina_table');
  }
  d.set('c4_mina_dort');
  const chair = d.find('mina_chaise');
  if (!chair) d.spawn({ id: 'mina_chaise', sprite: 'pose_mina366_chaise', x: 18, y: 16, solid: true, shadow: false, script: wakeMina });
  else chair.visible = true;
  if (hadMina) {
    await d.wait(30);
    await d.say(['Elle s\'assoit sur la chaise du salon. Ses bras retombent.', 'Elle ne bouge plus.', 'Une poupée, assise sur une chaise. L\'a-t-elle toujours été ?']);
  }
  await toPen(d, 1);
}

// ---------------------------------------------------------------------------------------------------------------------
// Switching layers: the felt peels off (ballpoint night n), the felt is glued back
// ---------------------------------------------------------------------------------------------------------------------

async function toPen(d: Director, n: number): Promise<void> {
  if (withMina()) d.follower(null);
  d.set('c4_mina_dort');
  d.set('c4_nuit', n);
  d.sfx('thread', { pitch: 0.7 });
  fx.pulseGlitch(18);
  d.music(null, 1.5);
  await d.fadeOut(80, PAPER);
  d.load('maison_stylo', 'horloge');
  await d.wait(30);
  await d.narrate(tf('Nuit {0}/41', n), { color: INK });
  await d.fadeIn(60);
}

async function toFelt(d: Director): Promise<void> {
  d.sfx('stitch', { pitch: 0.8 });
  await d.fadeOut(60, '#24141c');
  d.load('maison_feutre', 'horloge');
  await d.wait(20);
  await d.fadeIn(50);
  await d.say(['Le feutre se recolle, bord à bord.', 'Ça sent de nouveau la lessive et le gâteau. Un gâteau qu\'on ne mange jamais.']);
}

/** The cuckoo clock in the felt living room. */
export const clockFelt: Script = async (d) => {
  if (!flag('c4_diner_fait')) {
    await d.say(['Une horloge à coucou. À la place du coucou, une tête de mouton en feutre.', 'Les aiguilles sont cousues sur huit heures. Ici, c\'est toujours l\'heure du dîner.']);
    await mina(d, 'Elle est jolie, hein ? Elle avance jamais. Comme ça, on est jamais en retard.', 'happy');
    return;
  }
  const next = NIGHTS[NIGHTS.indexOf(night()) + 1];
  if (!next) return;
  await d.say(['L\'horloge à coucou. Les aiguilles sont cousues.', 'Mais le fil est un peu lâche. Tu pourrais les pousser.']);
  if (next >= 35 && !G.state.flags.c4_couseuse) {
    await d.say(['Tu pousses. L\'aiguille résiste.', 'Quelque chose, au-dessus de la maison, n\'est pas fini.', 'Tac-tac-tac-tac. Une machine à coudre, quelque part sous le toit.']);
    return;
  }
  const i = await d.ask(tf('Avancer l\'horloge jusqu\'à la nuit {0} ?', next), ['Oui', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (i !== 0) return;
  if (withMina()) {
    await d.say(next >= 35 ? ['Tu y retournes ?', 'Tu me réveilles, après. Promis ?', '…Promis ?'] : ['Tu y retournes ? Alors je vais me coucher.', 'Tu me réveilles, après. Promis ?'], 'mina366:sad');
    d.follower(null);
    const chair = d.find('mina_chaise');
    if (chair) chair.visible = true;
  }
  d.set('c4_mina_dort');
  await toPen(d, next);
};

/** The clock in the ballpoint living room. */
export const clockPen: Script = async (d) => {
  const n = night();
  await d.say(['L\'horloge du salon. Dessinée au stylo, à la règle.', tf('Elle ne donne pas l\'heure. Elle affiche : « Nuit {0}/41 ».', n)]);
  if (!nightDone()) {
    await d.say('L\'aiguille ne bouge pas. Cette nuit n\'est pas finie.');
    return;
  }
  if (n >= 35) return;
  const i = await d.ask('Recoller le feutre ?', ['Oui', 'Rester encore'], undefined, { cancelIndex: 1 });
  if (i === 0) await toFelt(d);
};

// ---------------------------------------------------------------------------------------------------------------------
// The felt house: entering, the giant eye, Mina n°366 on her chair, thin Dodo, feeding Dodo
// ---------------------------------------------------------------------------------------------------------------------

let eyeToken = 0;

export const feutreEnter: Script = (d) => {
  const token = ++eyeToken;
  if (flag('c4_mina_dort') && !d.find('mina_chaise')) {
    d.spawn({ id: 'mina_chaise', sprite: 'pose_mina366_chaise', x: 18, y: 16, solid: true, shadow: false, script: wakeMina });
  }
  // From time to time, a giant button eye looks in through the open front of the house. Nobody says whose it is.
  void (async () => {
    let wait = 900 + Math.floor(rng.next() * 600);
    while (token === eyeToken && world.map?.id === 'maison_feutre') {
      await d.wait(30);
      if (!night() || world.busy || game.top !== world) continue;
      wait -= 30;
      if (wait <= 0) {
        await eyePass(d, token);
        wait = 1800 + Math.floor(rng.next() * 1500);
      }
    }
  })();
};

/** The eye rises over the bottom edge of the screen, looks, blinks, slides away; its shadow darkens the rooms. */
async function eyePass(d: Director, token: number): Promise<void> {
  if (G.state.flags.c4_oeil === undefined) d.set('c4_oeil', 0);
  const e = d.spawn({ id: 'oeil', sprite: 'c4_oeil', x: 0, y: 0, solid: false, shadow: false });
  e.layer = 1;
  e.alpha = 0.92;
  let rise = 0;
  let slide = -60;
  let t = 0;
  e.brain = (self: Entity) => {
    t++;
    rise = t < 80 ? t / 80 : t > 260 ? Math.max(0, 1 - (t - 260) / 70) : 1;
    slide += 0.35;
    self.x = world.camX + W / 2 + slide;
    self.y = world.camY + H + 40 - rise * 40;
    self.sprite = t % 150 > 140 ? 'c4_oeil_2' : 'c4_oeil';
    world.extraDarkness = rise * 0.38;
  };
  d.sfx('whoosh', { pitch: 0.3, vol: 0.4 });
  d.sfx('heartbeat', { pitch: 0.7, vol: 0.4 });
  const first = num('c4_oeil') === 0;
  d.set('c4_oeil', num('c4_oeil') + 1);
  while (t < 330 && token === eyeToken && world.map?.id === 'maison_feutre') await d.wait(5);
  world.extraDarkness = 0;
  d.remove('oeil');
  if (first && token === eyeToken && world.map?.id === 'maison_feutre' && !world.busy) {
    world.busy++;
    try {
      await d.say(['Une ombre est passée sur les pièces. Énorme.', 'Par la façade ouverte, quelque chose regardait dans la maison.', 'Un œil. Un bouton, cousu à la place d\'un œil.']);
      await mina(d, ['Fais pas attention. Il regarde, c\'est tout.', 'Il regarde tout le temps.'], 'neutral');
    } finally {
      world.busy--;
    }
  }
}

/** Mina n°366 on her chair: Noa wakes her after each night. */
export const wakeMina: Script = async (d) => {
  const n = night();
  if (!n) return;
  await d.say(['Mina est assise sur la chaise du salon.', 'Ses bras pendent. Ses yeux-boutons fixent le mur.', 'Tu lui touches l\'épaule.']);
  d.sfx('thread', { pitch: 1.4, vol: 0.5 });
  await d.wait(40);
  const key = `c4_reveil_${n}`;
  const first = !flag(key);
  d.set(key);
  if (still()) {
    await d.say(['Sa tête se redresse, d\'un coup sec.', 'Elle se lève. Elle ne dit rien. Le fil de son sourire pend un peu plus bas.'], 'mina366:still');
  } else if (!first) {
    await d.say('On y va ? On y va.', 'mina366:neutral');
  } else if (n === 1) {
    await d.say('…', 'mina366:neutral');
    await d.say('Tu étais où ? J\'ai dormi super longtemps.', 'mina366:neutral');
    await d.wait(30);
    await d.say(['Tu en as mis, du temps !', 'Je t\'attends depuis super longtemps.'], 'mina366:happy');
    await d.say('…Tu viens de le dire.', 'noa:sad');
    await d.say(['Quoi ?', 'J\'ai rien dit. J\'ai dormi.'], 'mina366:neutral');
  } else if (n === 9) {
    await d.say(['Tu sens ? Ça sent la barbe à papa !', '…', 'Non. Ça sent les pâtes.'], 'mina366:happy');
    await d.say(['J\'ai rêvé que tu venais samedi.', 'C\'est quoi, samedi ?'], 'mina366:neutral');
  } else if (n === 22) {
    await d.say(['J\'ai entendu une porte, en haut, pendant que je dormais.', 'Tu crois que c\'est Maman qui sort de sa chambre ?'], 'mina366:neutral');
    await d.say(['Ma couronne tient plus très bien.', 'Tu peux la recoudre ? …Non ? Dodo le fera. Dodo recoud tout.'], 'mina366:sad');
  } else {
    await d.say('Tu m\'as réveillée. Tu avais promis. Tu as tenu ta promesse.', 'mina366:happy');
  }
  d.set('c4_mina_dort', false);
  d.remove('mina_chaise');
  d.follower('mina366');
  world.resetFollower();
};

/** Thin Dodo in the living room: he is the save point of the chapter, and he leaks. */
export const dodoFelt: Script = async (d) => {
  const n = night();
  const coton = num('c4_coton');
  if (!n) {
    await d.say(['Va dîner. Elle a cuisiné pour toi.', 'Moi, je n\'ai pas faim. Je n\'ai plus de place.'], 'dodo');
  } else if (!flag('c4_dodo_faim')) {
    d.set('c4_dodo_faim');
    await d.say(['Dodo flotte un peu de travers. Une couture s\'est ouverte sur son flanc.', 'Du coton s\'en échappe à chaque mot.']);
    await d.say(['Ne fais pas attention. Je perds un peu mes moyens.', 'C\'est le travail. Recoudre une maison entière, ça use.'], 'dodo');
    await d.say(['Il me faudrait du coton. Un peu. Pour tenir jusqu\'au matin.', 'Les moutons du coffre à jouets en ont plein, tu sais.', 'Ils dorment. Ils ne sentiront rien.'], 'dodo');
    await mina(d, 'Les moutons du coffre, c\'est les miens.{p:30} …Je crois que c\'est les miens.', 'sad');
  } else if (coton === 0) {
    await d.say(['Le coffre à jouets, Noa. Juste un peu.', 'Tu ferais ça pour moi ? Tu as toujours été gentil avec moi.'], 'dodo');
  } else if (coton < 4) {
    await d.say(['C\'est mieux. Je tiens. Je tiens presque.', coton >= 2 ? 'Tu es gentil avec moi. Personne n\'est gentil avec moi.' : 'Encore un peu, et je tiendrai jusqu\'au matin.'], 'dodo:happy');
  } else {
    await d.say(['Je suis plein.', 'Plein de petits « bêê » qui descendent tout au fond.', 'Merci, Noa.'], 'dodo:creepy');
  }
  await d.savePoint('Dodo se serre contre toi. Il sent la lessive, et un peu le renfermé.');
};

/** A felt sheep asleep in the toy chest. Taking its cotton heals Dodo (and gives Noa « Coton chaud »). */
export const sheepAsleep =
  (i: number): Script =>
  async (d) => {
    const key = `c4_mouton_${i}`;
    if (flag(key)) {
      await d.say(['Une peau de mouton vide, à plat, comme un gant retourné.', 'Deux trous à la place des yeux.']);
      if (i === 4) await mina(d, '…', 'sad');
      return;
    }
    await d.say(['Un mouton de feutre, endormi en boule.', 'Son ventre se gonfle. Se dégonfle. Il est plein de coton.']);
    if (!flag('c4_dodo_faim')) return;
    const c = await d.ask('Prendre le coton ?', ['Prendre le coton', 'Le laisser dormir'], undefined, { cancelIndex: 1 });
    if (c !== 0) {
      await mina(d, 'Merci. Il dormait si bien.', 'happy');
      return;
    }
    const sheep = d.find(`mouton_${i}`);
    const n = num('c4_coton') + 1;
    if (n === 4) {
      await d.say(['Le mouton ouvre un œil. Un bouton.', 'Il te regarde.']);
      await d.say('…Pourquoi ?', 'mouton');
    }
    await d.say('Tu glisses deux doigts dans la couture de son ventre. Le coton vient tout seul, en longs rubans tièdes.');
    // The « bêê » goes down into the low notes; the sheep deflates.
    for (const [k, p] of [1, 0.8, 0.62, 0.46, 0.34].entries()) {
      d.sfx('baa', { pitch: p, vol: 0.55 - k * 0.08 });
      if (sheep && k === 2) sheep.sprite = 'prop_c4_mouton_vide';
      await d.wait(28 + k * 6);
    }
    d.set(key);
    // Its button eyes come undone and roll under the furniture.
    const x = sheep ? tile(sheep.x) : 21;
    const y = sheep ? tile(sheep.y - 2) : 15;
    for (const [k, tx] of [12, 15].entries()) {
      d.spawn({ id: `bouton_${k}`, sprite: 'prop_c4_bouton', x, y, solid: false, shadow: false });
      void d.walkTo(`bouton_${k}`, tx, 18, 1.4).then(() => d.remove(`bouton_${k}`));
    }
    d.sfx('pop', { pitch: 1.8, vol: 0.4 });
    await d.say(['Le mouton se dégonfle. Son « bêê » descend, descend, jusqu\'à n\'être plus qu\'un souffle.', 'Ses yeux-boutons se décousent et roulent sous les meubles. Tu les entends rouler longtemps.']);
    d.set('c4_coton', n);
    d.set('c4_coton_chaud', num('c4_coton_chaud') + 4);
    G.state.hp = maxHp(G.state);
    d.sfx('heal');
    await d.say(['Dodo arrive en flottant. Tu bourres le coton dans sa couture ouverte.', 'Il ferme les yeux.']);
    await d.say(n === 1 ? 'C\'est encore chaud.' : n === 2 ? 'Encore chaud. C\'est le meilleur moment.' : n === 3 ? 'Merci. Merci. Je ne sentais plus mes pattes.' : 'Le dernier. Le dernier, c\'est toujours le plus chaud.', 'dodo:happy');
    await d.say('{c:y}Coton chaud{/c} : tes PV max augmentent de 4 jusqu\'au réveil.');
    const lines = ['Il dormait…', 'Noa. Il dormait.', '…', 'Tu vas me prendre le mien aussi ? Quand j\'aurai plus de coton ?'];
    await mina(d, lines[n - 1] ?? '…', n >= 3 ? 'sad' : 'neutral');
  };

/** The sofa: after the sheep, buttons look out from under it. */
export const sofaFelt: Script = async (d) => {
  await d.say(['Le canapé. Trois coussins brodés : MAMAN, NOA, MINA.', 'Un quatrième, sans nom. Le fil attend, enfilé dans l\'aiguille.']);
  const c = num('c4_coton');
  if (c > 0) await d.say(tf('Sous le canapé, dans le noir, {0} yeux-boutons te regardent. Ils ne clignent pas.', String(c * 2)));
  else await mina(d, 'Le quatrième, c\'est pour qui ? …Pour toi, peut-être. Toi, t\'as pas de coussin.', 'neutral');
};

/** A mirror on the landing: the reflection lifts its hand a little after you. */
export const mirrorFelt: Script = async (d) => {
  await d.say(['Un miroir ovale, encadré de feutre.', 'Dedans, une poupée en sweat lavande, avec tes cheveux.']);
  const i = await d.ask('Lever la main ?', ['Lever la main', 'Ne pas bouger'], undefined, { cancelIndex: 1 });
  if (i === 0) {
    await d.wait(30);
    await d.say(['Tu lèves la main.', 'Elle lève la main.', '{p:40}Un peu après toi.']);
  } else {
    await d.wait(60);
    await d.say(['Tu ne bouges pas.', 'Elle non plus.', '{p:40}Puis elle cligne des yeux. Tu n\'as pas cligné.']);
  }
  await mina(d, 'Moi, je me regarde jamais dans ce miroir. Il est en retard.', 'neutral');
};

/** The wall between Noa's and Mina's rooms (felt): the code of the knocks. */
export const knockWallFelt: Script = async (d) => {
  await d.say(['Le mur entre ta chambre et celle de Mina.', 'Tu poses l\'oreille. Rien. Le feutre étouffe tout.']);
  if (!withMina()) return;
  if (still()) {
    await d.say('…Toc.', 'mina366:still');
    return;
  }
  d.set('c4_code');
  await d.say(['Tu te rappelles le code ?', 'Un coup, c\'est « t\'es là ? ».', 'Deux coups, « je suis là ».', 'Trois coups, « bonne nuit ».'], 'mina366:happy');
  await d.say(['C\'est toi qui l\'as inventé. Pour quand j\'avais peur du noir.', '{p:30}…C\'est toi qui l\'as inventé ?'], 'mina366:neutral');
  d.sfx('knock1', { vol: 0.6 });
  await d.wait(26);
  d.sfx('knock1', { vol: 0.6 });
  await d.wait(26);
  d.sfx('knock1', { vol: 0.6 });
  await d.say('Elle frappe trois fois contre le mur. Le feutre avale les coups.');
};

/**
 * Mina's pillow fort (felt): the tender beat of the chapter. A password, a joke about a sheep that counts boys, and
 * Noa laughs, a little, through his nose. Then a breath: Noa's HP come back.
 */
export const pillowFort: Script = async (d) => {
  if (!withMina() || still()) {
    await d.say(['Un gros coussin, au milieu du tapis.', 'Dessus, une marque ronde, comme quand on y pose une couronne. Et trois cheveux roux, en fil.']);
    return;
  }
  if (flag('c4_cabane')) {
    await d.say('Le gros coussin. Il garde encore la forme de vous deux, l\'un contre l\'autre.');
    await d.say(['Tu reviens jouer quand tu veux. C\'est ouvert tout le temps.', 'Sauf la nuit.{p:30} …Il fait toujours nuit ?'], 'mina366:neutral');
    return;
  }
  d.set('c4_cabane');
  await d.say(['Attends ! C\'est ma cabane, ça.', 'Pour rentrer, faut dire le mot de passe.'], 'mina366:happy');
  await d.ask('Le mot de passe ?', ['Dodo', 'Chevalière', '…']);
  await d.say(['Faux !', 'Le mot de passe, c\'est « s\'il te plaît ». Tout le monde se trompe. C\'est fait exprès.'], 'mina366:happy');
  await d.say('…S\'il te plaît.', 'noa:neutral');
  await d.say('Entrez, monsieur le chevalier. Baissez la tête.', 'mina366:happy');
  d.sfx('pop', { pitch: 0.8, vol: 0.4 });
  await d.fadeOut(24, '#3a2430');
  await d.wait(30);
  await d.say(['Vous êtes assis sous le gros coussin, les genoux contre le menton.', 'Il fait chaud. Ça sent la lessive. Ici, l\'œil ne peut pas vous voir.']);
  await d.say(['Tu veux une blague ?', 'C\'est l\'histoire d\'un mouton qui arrive pas à dormir.', 'Alors il compte les garçons.'], 'mina366:happy');
  await d.say(['Un garçon.{p:30} Un garçon.{p:30} Un garçon…'], 'mina366:neutral');
  await d.say('…Pourquoi toujours un ?', 'noa:surprised');
  await d.say(['Parce qu\'il y en a qu\'un, de garçon ! Il arrête pas de revenir !', 'Du coup, le mouton, il dort jamais. Jamais jamais.'], 'mina366:happy');
  await d.wait(40);
  await d.say(['Ce n\'est pas drôle.', 'Tu ris quand même. Un tout petit peu, par le nez.']);
  await d.say(['T\'as ri ! Je t\'ai vu ! Ça compte !', 'Ça fait au moins cent ans que t\'avais pas ri.'], 'mina366:happy');
  await d.say(['Son sourire brodé ne bouge pas. Mais ses épaules tremblent, de rire.', 'Pendant un moment, tu ne vois plus les boutons. Tu vois juste ta sœur, sous un coussin, très fière d\'elle.']);
  await d.fadeIn(24);
  d.heal();
  await d.say('Tu te sens un peu plus léger. {c:y}Tes PV sont revenus.{/c}');
  await d.say(['On rejouera, hein ?', 'Demain. Ou ce soir. C\'est pareil, ici.'], 'mina366:happy');
};

/** The sheet sewn over Maman's room. */
export const mamanSheet: Script = async (d) => {
  await d.say(['Quelqu\'un a cousu un drap sur toute la chambre de Maman.', 'Des points énormes, serrés, faits de l\'extérieur.']);
  await d.wait(40);
  await d.say(['Derrière le drap, quelque chose respire, très lentement.', 'Le tissu se soulève. Retombe. Se soulève.']);
  await mina(d, ['Chut. Maman fait la sieste.', 'Faut pas la réveiller. Elle est fatiguée depuis…', 'Depuis…'], 'sad');
};

/** The front door, sewn shut. */
export const frontDoorFelt: Script = async (d) => {
  await d.say(['La porte d\'entrée. Cousue à son cadre, du haut jusqu\'en bas.', 'Du fil blanc, des points bien serrés.', 'Tu n\'avais pas l\'intention de sortir. Si ?']);
  await mina(d, 'Pourquoi tu voudrais sortir ? Dehors, il y a rien. Tout est ici.', 'neutral');
};

/** Mina's empty bedside table (felt): the nightlight is not there. */
export const minaNightstandFelt: Script = async (d) => {
  await d.say(['Sa table de nuit. Il n\'y a rien dessus.', 'Dans la poussière de feutre, une trace ronde.', 'Comme si quelque chose y était resté posé longtemps, puis qu\'on l\'avait pris.']);
  await mina(d, ['C\'est la place de ma veilleuse.', 'Elle est où, ma veilleuse ?', '{p:30}…Je l\'ai prêtée, je crois. Je sais plus à qui.'], 'sad');
};

// ---------------------------------------------------------------------------------------------------------------------
// The felt house, room by room: what Dodo mended « en mieux »
// ---------------------------------------------------------------------------------------------------------------------

/** Counts how many times something was looked at (returns the count before this look). */
const bump = (k: string): number => {
  const n = num(k);
  G.state.flags[k] = n + 1;
  return n;
};

export const bedFelt: Script = async (d) => {
  await d.say(['Ton lit. Le drap est cousu au matelas, tout autour, bien tendu. Sans un pli.', 'On ne peut pas se glisser dedans.']);
  await mina(d, ['Ici, on dort pas. On attend que tu reviennes.', '{p:30}…On attend qui ?'], 'neutral');
};

export const deskFelt: Script = async (d) => {
  if (bump('c4_bureau') === 0) {
    await d.say(['Ton bureau. Un cahier de maths ouvert. Les exercices sont faits, de ton écriture.', 'Tu ne te souviens pas de les avoir faits. Ils sont tous justes.']);
    return;
  }
  await d.say(['Le tiroir du bureau est cousu.', 'À travers le feutre, tu sens quelque chose de petit et de dur. Une clé.', 'Et des petits ronds de papier. Beaucoup de petits ronds.']);
  await mina(d, 'Faut pas ouvrir le tiroir de quelqu\'un. C\'est la règle. C\'est toi qui l\'as dit.', 'neutral');
};

export const drawingsFelt: Script = async (d) => {
  await d.say(['Des dessins de Mina, encadrés. Brodés au point de croix, pas dessinés.', 'Sur chacun : une maison, un mouton, trois personnes qui se tiennent la main.']);
  await d.say(['Sur le dernier, l\'une des trois n\'a pas de visage.', 'L\'aiguille est encore plantée dedans, avec un bout de fil beige.']);
  await mina(d, ['C\'est pas moi qui les ai faits. Moi, je dessine au crayon.', '{p:40}Je dessinais.'], 'sad');
};

export const familyPicture: Script = async (d) => {
  await d.say(['Une photo de famille, brodée au point de croix.', 'Maman. Mina, avec Dodo dans les bras. Et toi.']);
  await d.say(['Ton visage a été recouvert, point par point, avec du fil couleur peau.', 'À ta place, il n\'y a plus qu\'un rond lisse.']);
  await mina(d, ['Dodo a dit que t\'étais pas content, sur cette photo.', 'Alors il l\'a réparée.'], 'neutral');
};

export const tvFelt: Script = async (d) => {
  const n = bump('c4_tele');
  if (n === 0) {
    await d.say(['La télé. Elle montre ce salon, filmé d\'en haut.', 'Le canapé. La lampe. Un garçon debout devant la télé, de dos.']);
    await d.say(['Tu lèves la main.', '{p:30}Sur l\'écran, le garçon ne lève pas la main.']);
    await mina(d, 'C\'est mon émission préférée. Il se passe jamais rien. C\'est reposant.', 'happy');
  } else if (n === 1) {
    await d.say(['Sur l\'écran, le garçon est toujours de dos.', 'Il est un peu plus près de la télé que tout à l\'heure.']);
  } else {
    d.sfx('static', { vol: 0.3 });
    await d.say(['Sur l\'écran, le salon est vide.', 'Tu ne te retournes pas.']);
  }
};

export const tableFelt: Script = async (d) => {
  if (!flag('c4_diner_fait')) {
    await d.say(['La table, mise pour quatre.', 'Une assiette « à personne ». Tu ne sais pas qui est personne.']);
    return;
  }
  if (G.state.flags.c4_maman === 'reste') {
    await d.say(['La table. La Poupée-Maman y sert l\'air, encore et encore.', 'L\'assiette « à personne » déborde de fil gris.']);
  } else {
    await d.say(['La table. Les pâtes en laine ont refroidi. Pour la première fois.', 'Le téléphone est posé sur la nappe, l\'écran contre le tissu.']);
  }
};

/** The Poupée-Maman, after the dinner. */
export const mamanDollFelt: Script = async (d) => {
  if (!flag('c4_diner_fait')) {
    await d.say('Il y a des pâtes.', 'poupeemaman');
    await d.say('Elle te sourit. Elle ne peut pas faire autrement : c\'est cousu.');
    return;
  }
  if (G.state.flags.c4_maman === 'reste') {
    await d.say(['Il y a des pâtes.', 'Il y a des pâtes.'], 'poupeemaman');
    await d.say(['Elle ne te regarde plus. Elle regarde l\'assiette « à personne ».', 'Elle restera là. C\'est le mot que tu as écrit.']);
    return;
  }
  await d.say(['La Poupée-Maman a posé ses mains à plat sur la nappe.', 'Les points de sa bouche ont un peu lâché. Juste un peu.']);
  await d.say('{spd:0.6}Merci…{p:30} mon grand.{/spd}', 'poupeemaman');
  await mina(d, 'Elle t\'a appelé « mon grand ». Elle m\'appelle jamais « ma grande », moi.', 'neutral');
};

/** The domestic sheep: they do not talk; they keep the house. */
export const sheepBroom: Script = async (d) => {
  const lines = [
    ['Un mouton-domestique. Il balaie.', 'Il pousse un petit tas de coton sous le paillasson. Puis il recommence, au même endroit.'],
    ['Tu lui dis bonjour.', 'Il continue de balayer. Ses yeux-boutons ne te suivent pas : il balaie l\'endroit où tu étais.'],
    ['Sous le paillasson, il y a une bosse de coton, longue comme un enfant couché.', 'Le mouton tape dessus avec son balai, pour l\'aplatir. Pour que ça ne se voie pas.'],
  ];
  const n = bump('c4_mouton_balai');
  await d.say(lines[Math.min(n, lines.length - 1)]!);
  if (n === 0) await mina(d, 'Les moutons d\'ici, ils parlent pas. Ils font juste le ménage. C\'est mieux, non ?', 'neutral');
};

export const sheepIron: Script = async (d) => {
  const lines = [
    ['Un mouton-domestique repasse un pyjama d\'enfant, avec des petites lunes.', 'Il le repasse. Le plie. Le déplie. Le repasse.'],
    ['Le fer ne chauffe pas : il est en feutre.', 'Le pyjama est usé jusqu\'à la trame, à force d\'être repassé.'],
    ['Tu poses la main sur le fer.', 'Le mouton se fige, la patte en l\'air. Il attend que tu l\'enlèves. Il attendra aussi longtemps qu\'il faudra.'],
  ];
  const n = bump('c4_mouton_fer');
  await d.say(lines[Math.min(n, lines.length - 1)]!);
  if (n === 0) await mina(d, ['C\'est mon pyjama. Je le mets plus.', 'Je mets plus rien. Je suis cousue dans ma robe.'], 'neutral');
};

export const sheepTray: Script = async (d) => {
  const lines = [
    ['Un mouton-domestique porte un plateau : un verre de lait, une compote, une cuillère.', 'Il le pose sur le lit de Mina. Il attend. Personne ne mange.'],
    ['Il reprend le plateau. Il ressort. Il revient. Il le repose.', 'Le lait a une peau, dessus. Il est là depuis très longtemps.'],
    ['Sur le plateau, une petite carte : « Chambre 304 ».', 'Le mouton la retourne, face contre le plateau, quand il voit que tu lis.'],
  ];
  const n = bump('c4_mouton_plateau');
  await d.say(lines[Math.min(n, lines.length - 1)]!);
  if (n === 2) await mina(d, 'C\'est quoi, la chambre 304 ? …Je connais pas. Je connais pas.', 'sad');
};

// ---------------------------------------------------------------------------------------------------------------------
// The ballpoint house: more of the forty-one nights
// ---------------------------------------------------------------------------------------------------------------------

export const deskPen: Script = async (d) => {
  const n = night();
  await d.say(['Ton bureau. Ton téléphone, posé à l\'envers.', 'Tu le retournes. Pas de nouveau message.']);
  if (n >= 22) await d.say(['Tu relis les anciens. Tu les connais par cœur.', '« Elle te réclame. » « Tu viens demain ? » « Elle te réclame. »']);
  else await d.say('Tu relis les anciens. Il n\'y en a pas beaucoup. Tu les relis quand même.');
  if (n >= 9) await d.say(['Ton cahier de maths, ouvert à la page du jour.', 'Elle est vide. Celle d\'hier aussi. Celle d\'avant-hier aussi.']);
};

export const knockWallPen: Script = async (d) => {
  await d.say(['Le mur entre ta chambre et celle de Mina.', 'Tu poses la main dessus. Le papier est froid.']);
  const i = await d.ask('Frapper ?', ['Frapper une fois', 'Ne pas frapper'], undefined, { cancelIndex: 1 });
  if (i !== 0) return;
  d.sfx('knock1', { vol: 0.7 });
  await d.wait(100);
  if (night() >= 9) {
    d.sfx('pipe', { vol: 0.6 });
    await d.wait(26);
    d.sfx('pipe', { vol: 0.5 });
    await d.say(['Toc. Toc.', 'Deux coups. « Je suis là. »', 'C\'est le radiateur. Tu le sais. Tu attends quand même la suite.']);
  } else {
    await d.say(['Rien.', 'Il n\'y a personne, de l\'autre côté. Elle est là-bas.']);
  }
};

export const platesPen: Script = byNight({
  1: ['Une assiette sale, sur le plan de travail.', 'Une seule. Tu ne cuisines que pour toi.'],
  9: ['Une pile d\'assiettes sales.', 'Tu les laves quand il n\'y en a plus de propres. Pas avant.'],
  22: ['La pile monte. Tu as arrêté de compter.', 'Il y a une odeur. Tu ne la sens plus.'],
  35: ['La pile d\'assiettes touche presque le placard du haut.', 'Sur celle du dessus pousse une moisissure bleue, en forme de fleur.', 'Tu la trouves jolie. Ça te fait peur, de la trouver jolie.'],
});

export const chairPen: Script = async (d) => {
  await d.say(['La chaise de Maman. Tournée vers le mur.', 'Personne ne l\'a tournée. Elle s\'est tournée une nuit où tu ne regardais pas.']);
  if (night() >= 22) await d.say('Tu ne la retournes pas. Tu n\'as pas envie de voir qui est assis dessus.');
};

// ---------------------------------------------------------------------------------------------------------------------
// The ballpoint nights: the phone, the Noa-doll, the shoe box, the fridge, the front door, the nightlight
// ---------------------------------------------------------------------------------------------------------------------

let ringToken = 0;

export const styloEnter: Script = (d) => {
  const n = night();
  const token = ++ringToken;
  // The phone rings until Noa answers.
  if (n && n < 42 && !flag(`c4_tel_${n}`)) {
    void (async () => {
      await d.wait(90);
      while (token === ringToken && world.map?.id === 'maison_stylo' && !flag(`c4_tel_${n}`)) {
        const p = d.find('tel');
        if (p && game.top === world) {
          p.frames = ['prop_c4_tel_2', 'prop_c4_tel'];
          p.frameSpeed = 6;
          d.sfx('beep', { pitch: 1.6, vol: 0.5 });
          await d.wait(10);
          d.sfx('beep', { pitch: 1.6, vol: 0.5 });
          await d.wait(30);
          p.frames = undefined;
        }
        await d.wait(70);
      }
    })();
  }
};

interface Call {
  lines: Array<[string | string[], string]>;
}

/** What Maman says on the phone, night after night. */
const CALLS: Record<number, Call> = {
  1: {
    lines: [
      [['Allô ? Mon grand ?', '{static}…{/static} Je reste avec elle cette nuit. Et demain aussi, sûrement.'], 'mamantel'],
      ['…', 'noa:tired'],
      [['T\'es grand. Tu te débrouilles, hein ?', 'Il y a des pâtes.'], 'mamantel'],
      ['…Oui.', 'noa:tired'],
      ['Je t\'embrasse. Ferme bien à clé.', 'mamantel'],
    ],
  },
  9: {
    lines: [
      [['C\'est moi. Je ne te réveille pas ?', 'Elle dessine. Elle n\'arrête pas de dessiner.', 'Elle dit que c\'est un pays. Pour toi. Elle ne veut pas que je regarde.'], 'mamantel'],
      ['Tu viendras samedi ?', 'mamantel'],
    ],
  },
  22: {
    lines: [
      [['Noa ? {static}…{/static} Elle te réclame.', 'Elle te réclame tout le temps, tu sais. Elle demande si tu as mangé.'], 'mamantel'],
      ['Tu viens demain ?', 'mamantel'],
      ['…Demain.', 'noa:tired'],
      [['Demain. D\'accord. Je lui dis.', 'Elle va être contente.'], 'mamantel'],
    ],
  },
  35: {
    lines: [
      ['Tu tousses encore ?', 'mamantel'],
      ['Tu tousses dans ton coude. Il reste une petite tache d\'encre sur ta manche.', 'narrator'],
      [['Alors tu ne viens pas, d\'accord ?', 'Avec ses globules, on ne peut pas. On ne peut pas, Noa.'], 'mamantel'],
      ['{static}…{/static}', 'mamantel'],
      [['Elle va un peu mieux.', '{p:40}Elle va un peu mieux, je te dis.'], 'mamantel'],
    ],
  },
};

/** The wall phone of the ballpoint kitchen. */
export const phonePen: Script = async (d) => {
  const n = night();
  const key = `c4_tel_${n}`;
  if (flag(key) || !CALLS[n]) {
    await d.say(['Le téléphone mural. Le combiné est raccroché.', 'Tu attends qu\'il sonne. Tu attends tout le temps qu\'il sonne.']);
    return;
  }
  d.set(key);
  const p = d.find('tel');
  if (p) p.frames = undefined;
  d.sfx('select');
  await d.say('Tu décroches.');
  for (const [text, who] of CALLS[n]!.lines) await d.say(text, who);
  if (n === 9) {
    await d.ask('…', ['Oui, samedi', 'Je sais pas']);
    await d.narrate('Tu n\'as pas envie.');
    await d.say(['{static}…Allô ? Noa ?{/static}', '…Bon. Tu me diras. Mange un peu.'], 'mamantel');
  }
  d.sfx('beep', { pitch: 0.8, vol: 0.4 });
  await d.say('Elle a raccroché. La tonalité dure longtemps.');
  if (n === 1) await d.say('Dans la cuisine, à la table, une poupée mange.');
  if (n === 22) await d.say('Dans l\'entrée, quelqu\'un a mis ses chaussures.');
  if (n === 35) await d.say('En haut, dans ta chambre, la veilleuse est allumée.');
};

/** Night 1: the Noa-doll eats alone. */
export const dollEats: Script = async (d) => {
  await d.say(['La poupée-Noa mange. Seule.', 'Des pâtes froides, à même la casserole. Elle mâche longtemps.', 'Elle ne lève pas la tête. Elle ne regarde pas les trois chaises vides.']);
  if (!flag('c4_tel_1')) return;
  if (num('c4_nuit_fait') < 1) {
    d.set('c4_nuit_fait', 1);
    await d.wait(30);
    await d.say(['Elle a fini. Elle rince la casserole. Elle la pose sur l\'égouttoir.', 'Elle éteint la lumière de la cuisine. Elle ne va pas se coucher.']);
  }
};

/** Night 9: the Noa-doll smooths out the fridge notes and keeps them in a shoe box. */
export const dollShoebox: Script = async (d) => {
  await d.say(['La poupée-Noa est assise par terre, à côté d\'une boîte à chaussures.', 'Elle déplie un mot du frigo. Elle le lisse avec le plat de la main. Longtemps.', 'Puis elle le range avec les autres, bien à plat, dans le bon ordre.']);
};

/** The shoe box: every fridge note, kept. Mina's card with the code of the knocks at the bottom. */
export const shoebox: Script = async (d) => {
  const n = night();
  if (n < 9) {
    await d.say(['Une boîte à chaussures vide.', 'Tu ne sais pas encore à quoi elle va servir.']);
    return;
  }
  await d.paper(
    [
      'Je rentre tard. Il y a des pâtes. Bisous.',
      'Pense à ton linge, mon grand.',
      'Elle a dessiné un mouton qui te ressemble ❤',
      'Mange quelque chose de chaud, pas que des pâtes.',
      ...(n >= 22 ? ['Elle demande si tu dors bien. Je lui ai dit oui.'] : []),
      ...(n >= 35 ? ['Ne viens pas tant que tu tousses. Je t\'aime.'] : []),
    ],
    'Les mots du frigo',
  );
  await d.say(['Tout au fond, une carte, au feutre violet, de l\'écriture de Mina :']);
  await d.paper(['1 = T\'ES LÀ ?', '2 = JE SUIS LÀ', '3 = BONNE NUIT', '(c\'est Noa qui a inventé)'], 'LE CODE');
  d.set('c4_code');
};

/** Night 9: the magnets chew the words of the fridge. */
export const fridgePen: Script = async (d) => {
  const n = night();
  if (n === 9 && num('c4_nuit_fait') < 9) {
    await d.say(['Le frigo. Les mots de Maman, tenus par des aimants.', 'Les aimants claquent des dents. Ce sont des dentiers.', 'Ils mâchent les mots. « Je rentre tard » est déjà à moitié mangé.']);
    if (!flag('c4_tel_9')) return;
    await d.say('Clac-clac-clac !', 'inconnu');
    const r = await d.battle(['mot_aimante']);
    if (r.outcome === 'lose') return;
    d.set('c4_nuit_fait', 9);
    await d.say(r.spared.length ? ['Sur le carrelage, des lettres mâchouillées, collées de travers.', '« JE T\'AIME ». Il manque l\'apostrophe.'] : ['Le frigo est nu. Il n\'y a plus un mot dessus.', 'Tu ne sauras jamais ce que disait le dernier.']);
    return;
  }
  const notes: Record<number, string[]> = {
    1: ['Le frigo. Trois mots, tenus par des aimants.', '« Je rentre tard. » « Il y a des pâtes. » « Je t\'aime. » Dans cet ordre.'],
    9: ['Le frigo. Les mots s\'empilent les uns sur les autres.', 'Certains sont mâchouillés sur les bords.'],
    22: ['Le frigo. Tu ne vois plus la porte, sous les mots.', '« Elle te réclame. » « Elle te réclame. » « Tu viens demain ? »'],
    35: ['Le frigo est couvert de mots, du haut jusqu\'en bas.', 'Le dernier est tout petit, écrit vite : « Elle va un peu mieux ❤ ».'],
  };
  const k = [35, 22, 9, 1].find((x) => x <= n) ?? 1;
  await d.say(notes[k]!);
  await d.say('À l\'intérieur, des pâtes. Il y a toujours des pâtes.');
};

/** Night 22: the Noa-doll in front of the front door, its shoes on. */
export const dollDoor: Script = async (d) => {
  await d.say(['La poupée-Noa est devant la porte d\'entrée.', 'Elle a mis ses chaussures. Les lacets sont faits, deux fois. Elle a sa veste.', 'Elle ne bouge pas. Elle regarde la poignée.']);
};

/** The front door (ballpoint). Night 22: Clé. */
export const frontDoorPen: Script = async (d) => {
  const n = night();
  if (n === 22 && num('c4_nuit_fait') < 22 && flag('c4_tel_22')) {
    await d.say(['La porte d\'entrée. Une clé tremble dans la serrure.', 'Elle est beaucoup trop petite pour une porte pareille.']);
    await d.say('Cling-cling-cling.', 'inconnu');
    const r = await d.battle(['cle']);
    if (r.outcome === 'lose') return;
    d.set('c4_nuit_fait', 22);
    d.set('c4_trappe');
    if (r.spared.length) {
      await d.say(['La porte est entrouverte sur le palier. Il fait noir, dehors. L\'ascenseur ronronne quelque part.', 'La poupée-Noa a ses chaussures aux pieds.', 'Elle ne sort pas.']);
    } else {
      await d.say(['La clé est cassée dans la serrure. La porte ne s\'ouvrira plus.', 'La poupée-Noa enlève ses chaussures. Elle les range bien droit, à côté du paillasson.']);
    }
    d.sfx('door', { pitch: 0.6 });
    await d.say(['Quelque part au-dessus de la maison, une trappe s\'ouvre.', 'Tac-tac-tac-tac. Une machine à coudre, sous le toit.']);
    return;
  }
  if (n === 22 && !flag('c4_tel_22')) {
    await d.say('La porte d\'entrée. Le téléphone sonne dans la cuisine.');
    return;
  }
  await d.say(['La porte d\'entrée. Fermée à clé, deux tours.', 'Tu ne l\'ouvres pas. Dehors, il y a l\'hôpital.']);
};

/** The nightlight on Noa's bedside table, in the ballpoint nights: the only thing in colour. The save point. */
export const nightlightPen: Script = async (d) => {
  const n = night();
  if (n === 35 && flag('c4_tel_35') && !flag('c4_veilleuse')) {
    await d.say(['La veilleuse. Allumée, sur ta table de nuit.', 'La seule chose en couleur dans toute la maison.']);
    const i = await d.ask('Prendre la veilleuse ?', ['La prendre', 'Pas encore'], undefined, { cancelIndex: 1 });
    if (i !== 0) {
      await d.savePoint('Elle est tiède. Elle n\'a jamais été froide.');
      return;
    }
    d.set('c4_veilleuse');
    const v = d.find('veilleuse');
    if (v) {
      v.visible = false;
      v.light = undefined;
    }
    await d.say(['Tu débranches la veilleuse. Elle reste allumée. Ici, elle n\'a pas besoin de prise.', 'Elle est chaude dans tes mains.']);
    await d.narrate('Tu vas la lui apporter. Bien sûr que tu vas la lui apporter.');
    await d.say('Le couloir, devant ta chambre, est plus long que d\'habitude.');
    return;
  }
  const lie: Record<number, string[]> = {
    1: ['Une veilleuse en forme de lune, allumée.', 'Tu ne sais pas ce qu\'elle fait là. Elle n\'est pas à toi.'],
    9: ['La veilleuse. Elle n\'est pas à toi.', 'Tu la gardes, c\'est tout. En attendant.'],
    22: ['La veilleuse. Tu ne t\'en sers pas.', 'Tu ne dors pas avec. Tu ne pourrais pas.'],
    35: ['La veilleuse. Elle brille un peu plus fort que d\'habitude.', 'Tu ne l\'as pas éteinte depuis… depuis la première nuit.'],
  };
  const k = [35, 22, 9, 1].find((x) => x <= n) ?? 1;
  await d.say(lie[k]!);
  await d.savePoint('La petite lumière est tiède. Elle a toujours été là.');
};

/** Night 35: the upper hallway turns into the knocking corridor once Noa holds the nightlight. */
export const hallwayStretches: Script = async (d) => {
  if (!flag('c4_veilleuse') || flag('c4_coups_debut')) return;
  d.set('c4_coups_debut');
  d.sfx('whoosh', { pitch: 0.5 });
  await d.warp('couloir_coups', 'debut', { fade: 40 });
};

/** Mina's room at night: a rectangle blackened so hard that the paper tore. */
export const minaRoomPen: Script = async (d) => {
  await d.say(['La chambre de Mina.', 'Tu l\'as coloriée en noir. Fort. Si fort que le papier s\'est déchiré.', 'Tu n\'es pas entré depuis qu\'elle est partie.']);
  if (night() >= 9) {
    await d.wait(30);
    d.sfx('knock1', { vol: 0.5 });
    await d.wait(26);
    d.sfx('pipe', { vol: 0.6 });
    await d.wait(26);
    d.sfx('knock1', { vol: 0.5 });
    await d.say(['Toc. Toc. Toc.', 'C\'est le radiateur. Ce n\'est que le radiateur.']);
  }
};

/** Maman's room at night: not drawn at all. */
export const mamanRoomPen: Script = async (d) => {
  await d.say(['La chambre de Maman.', 'Pas dessinée. Juste les carreaux de la page, et un trait de crayon qui s\'arrête.', 'Elle dort là-bas, sur le fauteuil des parents. Ici, il n\'y a rien à dessiner.']);
};

/** Night 35: the Noa-doll in bed, coughing. */
export const dollCough: Script = async (d) => {
  d.sfx('hurt', { pitch: 0.5, vol: 0.3 });
  await d.say(['La poupée-Noa est couchée, la couverture jusqu\'au menton.', 'Elle tousse dans son coude. Une petite tache d\'encre sur la manche, rien de plus.', 'Sur la table de la cuisine, il y a un thermomètre.']);
};

// ---------------------------------------------------------------------------------------------------------------------
// The attic: the mannequins of the Minas that went wrong, La Couseuse, T3 « Trois cent soixante-cinq »
// ---------------------------------------------------------------------------------------------------------------------

/** The ladder of thread (felt landing). */
export const ladderFelt: Script = async (d) => {
  if (!flag('c4_trappe')) {
    await d.say(['Une trappe au plafond. Fermée.', 'De là-haut vient un bruit de machine. Tac-tac-tac-tac.']);
    return;
  }
  await d.say(['Une échelle de fil rouge pend de la trappe ouverte.', 'Les barreaux sont des points de couture. Ils tiennent ton poids. Ils ont l\'habitude.']);
  if (!withMina() && flag('c4_mina_dort')) await d.say('Mina dort encore, en bas, sur sa chaise.');
  const i = await d.ask('Monter au grenier ?', ['Monter', 'Rester'], undefined, { cancelIndex: 1 });
  if (i === 0) await d.warp('grenier', 'trappe', { sfx: 'whoosh' });
};

export const ladderPen: Script = async (d) => {
  if (!flag('c4_trappe')) {
    await d.say(['Une trappe au plafond, dessinée en pointillés.', 'Tu ne l\'as jamais ouverte.']);
    return;
  }
  await d.say(['La trappe est ouverte. Il fait noir, là-haut.', 'Ça sent le coton chaud et l\'huile de machine.', 'D\'ici, tu n\'y arrives pas. Le grenier, c\'est le feutre qui l\'a.']);
};

const LABELS: Record<string, [string, string | string[] | undefined]> = {
  mq_12: ['Mina n°12 : trop sage.', 'Elle est sage, elle. Moi, je suis pas sage. …Hein ?'],
  mq_31: ['Mina n°31 : ne riait pas au bon moment.', undefined],
  mq_88: ['Mina n°88 : a demandé où était Maman.', 'C\'est interdit, de demander où est Maman ?'],
  mq_140: ['Mina n°140 : trop de taches de rousseur.', 'J\'en ai combien, moi ? Compte pas. Compte pas !'],
  mq_200: ['Mina n°200 : a demandé où était Noa.', '…'],
  mq_251: ['Mina n°251 : a pleuré.', undefined],
  mq_301: ['Mina n°301 : la cape est cousue à l\'envers.', 'Ça, c\'est pas grave, une cape à l\'envers. C\'est pas grave du tout.'],
  mq_364: ['Mina n°364 : hier.', 'Hier, c\'était moi ? Non. Hier, je dormais.'],
};

/** The mannequins turn to look at Noa, one more each time he reads a label (persisted by count). */
const TURN_ORDER = ['mq_301', 'mq_88', 'mq_200', 'mq_31', 'mq_251', 'mq_12', 'mq_140', 'mq_364'];

let atticToken = 0;

export const grenierEnter: Script = async (d) => {
  const token = ++atticToken;
  // Behind the curtain, the machine never stops (until the seamstress is spared or beaten).
  void (async () => {
    while (token === atticToken && world.map?.id === 'grenier' && !G.state.flags.c4_couseuse) {
      if (game.top === world) d.sfx('stitch', { vol: 0.12, pitch: 0.9 + rng.next() * 0.2 });
      await d.wait(9 + Math.floor(rng.next() * 4));
    }
  })();
  const turned = num('c4_etiquettes');
  TURN_ORDER.forEach((id, i) => {
    const e = d.find(id);
    if (e) e.sprite = i < turned ? (id === 'mq_301' ? 'prop_c4_mannequin_cape' : 'prop_c4_mannequin') : 'prop_c4_mannequin_tourne';
  });
  if (flag('c4_grenier')) return;
  d.set('c4_grenier');
  await d.wait(20);
  await d.say(['Le grenier. Sous les poutres, ça sent le coton chaud et l\'huile de machine.', 'Quelque part derrière un rideau de fils, une machine pique, pique, pique.', 'Il y a des Mina partout.']);
  await mina(d, ['C\'est quoi, ici ?', 'On a un grenier, nous ?'], 'neutral');
};

/** A mannequin of the attic: its tailor's label. */
export const mannequin =
  (id: string): Script =>
  async (d) => {
    const [label, remark] = LABELS[id]!;
    await d.say(['Un mannequin de couturière. Une tête de Mina en feutre, une couronne, deux boutons pour les yeux.', 'Une étiquette de tailleur est épinglée sur sa poitrine :']);
    await d.say(`{c:y}${label}{/c}`);
    if (remark) await mina(d, remark, remark === '…' ? 'sad' : 'neutral');
    const n = num('c4_etiquettes') + 1;
    d.set('c4_etiquettes', n);
    const next = TURN_ORDER.find((k, i) => i >= n - 1 && k !== id && d.find(k)?.sprite === 'prop_c4_mannequin_tourne');
    if (next) {
      const e = d.find(next);
      if (e) e.sprite = next === 'mq_301' ? 'prop_c4_mannequin_cape' : 'prop_c4_mannequin';
      d.sfx('thread', { pitch: 1.6, vol: 0.4 });
      if (n === 1 || n === 4) await d.say('Derrière toi, quelque chose a bougé. Un mannequin regarde vers toi, maintenant. Il regardait le mur, avant.');
    }
  };

/** The mannequin with no mouth; its mouth is drawn on the wall next to it. */
export const mannequinNoMouth: Script = async (d) => {
  await d.say(['Un mannequin sans bouche. Le feutre est lisse, à l\'endroit où elle devrait être.', 'Son étiquette est vide.']);
  await d.say(['À côté de lui, sur le mur, quelqu\'un a dessiné une bouche au crayon.', 'Elle sourit. Elle est exactement à la bonne hauteur.']);
  await mina(d, 'Elle a dû la poser là le temps de dormir. Pour pas l\'abîmer.', 'neutral');
};

/** The empty dress form: n°366, « en cours ». */
export const mannequinEmpty: Script = async (d) => {
  await d.say(['Un mannequin vide. Pas de tête. Juste le buste, et l\'étiquette :', '{c:y}Mina n°366 : en cours.{/c}']);
  if (!withMina()) return;
  if (still()) {
    await d.say('…', 'mina366:still');
    return;
  }
  await d.say(['C\'est mon nom.', '{p:30}C\'est mon numéro ?'], 'mina366:neutral');
};

/** Mina n°365: the Mina of the chapters 1 to 3, cape and pencil sword. Carrying her opens the curtain. */
export const mannequin365: Script = async (d) => {
  await d.say(['Un mannequin plus petit que les autres. Il porte une cape rouge et une épée de crayon.', 'Celles que tu connais. Le bord de la cape est taché d\'encre.']);
  await d.say('{c:y}Mina n°365 : ce soir. A failli finir sa phrase.{/c}');
  await mina(d, ['Elle a mon épée.', '{p:30}…Non. C\'est la sienne. La mienne est en feutre.'], 'sad', '…');
  if (flag('c4_rideau')) return;
  const i = await d.ask('Sur le rideau de fils, une épingle tient un papier : « Rapporte-moi celle de ce soir. »', ['La porter jusqu\'au rideau', 'La laisser'], undefined, { cancelIndex: 1 });
  if (i !== 0) return;
  d.set('c4_rideau');
  await d.say(['Tu la soulèves. Elle est légère. Plus légère qu\'une poupée devrait l\'être.', 'Sa cape traîne sur le plancher.']);
  await d.fadeOut(30);
  d.remove('mq_365');
  for (let k = 1; k <= 6; k++) d.remove(`rideau_${k}`);
  d.spawn({ id: 'mq_365_pose', sprite: 'prop_c4_mannequin_cape', x: 21, y: 5, solid: true, shadow: false, script: mannequin365 });
  d.player.x = 23 * TILE + 8;
  d.player.y = 7 * TILE + 14;
  d.face('player', 'up');
  world.resetFollower();
  await d.fadeIn(30);
  d.sfx('thread');
  await d.say('Le rideau de fils s\'écarte tout seul, comme des cheveux qu\'on repousse.');
  await couseuseTalk(d);
};

/** La Couseuse: before the fight, T3 after it. */
export const couseuseTalk: Script = async (d) => {
  const state = G.state.flags.c4_couseuse;
  if (state === 'epargnee') {
    await d.say(['Une par nuit. Une par nuit.', 'Ce soir, je me repose. Pour la première fois, je crois.'], 'couseuse');
    return;
  }
  if (state === 'vaincue') {
    await d.say(['La machine ne bouge plus. L\'aiguille cassée pend au bout de son fil.', 'Sur le socle, une étiquette : « Une par nuit. N°365 : ce soir. N°366 : ce soir aussi. Plus de coton. »']);
    return;
  }
  await d.say(['Une machine à coudre posée sur une table. À la place du pied presseur, une tête de mouton.', 'Elle lève ses yeux-boutons dépareillés vers toi. L\'aiguille s\'arrête.']);
  await d.say(['Ah. Tu me la rapportes.', 'Celle de ce soir. Elle a encore essayé de finir sa phrase. Elles essaient toutes.'], 'couseuse');
  await d.say(['Pose-la là. Je la referai.', 'Et toi, tiens-toi droit.'], 'couseuse');
  await mina(d, 'Noa… Elle veut me recoudre, moi aussi ?', 'sad');
  await d.say('Tu n\'aurais pas dû monter ici.', 'couseuse');
  const r = await d.battle(['couseuse']);
  if (r.outcome === 'lose') return;
  if (r.outcome === 'win') {
    d.set('c4_couseuse', 'vaincue');
    await t3Beaten(d);
  } else {
    d.set('c4_couseuse', 'epargnee');
    await t3(d);
  }
};

/** T3 — « Trois cent soixante-cinq ». */
async function t3(d: Director): Promise<void> {
  d.set('c4_t3');
  await d.wait(30);
  await d.say(['Tu veux savoir ? Bon.', 'Je la recouds tous les soirs.'], 'couseuse');
  await d.say('{spd:0.6}Trois cent soixante-cinq fois.{/spd} Une par nuit.', 'couseuse');
  await d.wait(20);
  await d.say(['Et ce soir, deux.', 'Il n\'y a plus assez de coton.'], 'couseuse');
  await d.say(['Elle se défait toujours au même endroit : la bouche.', 'Elle veut toujours finir sa phrase, cette petite.'], 'couseuse');
  await d.say('…Quelle phrase ?', 'noa:sad');
  await d.say(['Je ne sais pas. On ne la laisse jamais finir.', 'Chaque nuit, il vient. Chaque nuit, il l\'arrête avant la fin. Chaque matin, il oublie.'], 'couseuse');
  if (withMina()) {
    await d.say(['Deux ?', 'Ce soir, deux ?'], 'mina366:neutral');
    await d.say('Mina regarde le mannequin à la cape. Puis le buste vide, avec son étiquette.');
    await d.say(['Alors moi, je suis la deuxième.', 'Je suis celle d\'après.', '{p:40}C\'est pour ça que j\'ai mal à la bouche ?'], 'mina366:sad');
  }
  // Dodo comes up through the hatch, losing cotton.
  d.spawn({ id: 'dodo_t3', sprite: 'npc_dodo_thin', frames: ['npc_dodo_thin', 'npc_dodo_thin_2'], frameSpeed: 22, x: 12, y: 11, float: true, shadow: false, solid: false });
  await d.walkTo('dodo_t3', 21, 8, 0.7);
  await d.say('Tu n\'aurais pas dû compter.', 'dodo:creepy');
  await d.wait(30);
  await d.say(['Toi, par contre.', 'Toi, tu es nouveau.', 'Trois cent soixante-quatre nuits que je couds, et jamais personne ne lui tenait la main.'], 'couseuse');
  await d.say('Tu es la seule chose nouvelle, {player}.', 'couseuse');
  await d.say(['Ne l\'écoute pas. Elle radote.', 'Les machines, ça radote. Ça répète toujours la même chose. Point, point, point.'], 'dodo');
  d.remove('dodo_t3');
  await mina(d, ['Noa.', 'Tu viens toutes les nuits ?', '{p:30}…Moi, je m\'en souviendrai, demain. Promis.'], 'sad');
}

/** T3 when La Couseuse was beaten: the label on the machine says it, Dodo says the rest. */
async function t3Beaten(d: Director): Promise<void> {
  d.set('c4_t3');
  await d.say(['La machine ne bouge plus. L\'aiguille cassée pend au bout de son fil.', 'Sur le socle, une étiquette :']);
  await d.paper(['Une par nuit.', 'N°364 : hier.', 'N°365 : ce soir.', 'N°366 : ce soir aussi.', 'Plus de coton.'], 'La Couseuse');
  d.spawn({ id: 'dodo_t3', sprite: 'npc_dodo_thin', frames: ['npc_dodo_thin', 'npc_dodo_thin_2'], frameSpeed: 22, x: 12, y: 11, float: true, shadow: false, solid: false });
  await d.walkTo('dodo_t3', 21, 8, 0.7);
  await d.say('Tu n\'aurais pas dû compter.', 'dodo:creepy');
  await d.say(['Maintenant, personne ne la recoudra.', 'Ni demain. Ni après.'], 'dodo');
  d.remove('dodo_t3');
  if (withMina()) await d.say(['Mina ne bouge plus.', 'Elle te suit quand même, à petits pas raides, comme une poupée qu\'on tire par la main.']);
}

/** The tally marks on the beams. */
export const tallyMarks: Script = async (d) => {
  await d.say(['Des bâtons, gravés dans les poutres. Par paquets de cinq.', 'Tu comptes. Tu arrêtes à cent.', 'Il y en a encore. Il y en a partout.']);
  await mina(d, 'C\'est quelqu\'un qui compte les nuits. Moi, je compte les moutons. C\'est pareil ?', 'neutral');
};

/** The pile of crowns. */
export const crownsPile: Script = async (d) => {
  await d.say(['Des couronnes de papier, en tas. Des centaines.', 'Toutes pliées pareil. Toutes un peu écrasées sur le côté gauche, là où une tête s\'appuie sur l\'oreiller.', 'Trois cent soixante-quatre. Tu n\'as pas besoin de compter. Tu le sais.']);
  await mina(d, 'C\'est des déguisements.{p:40} …Hein ?', 'neutral', '…');
};

/** The curtain of threads before the seamstress's corner. */
export const curtain: Script = async (d) => {
  if (flag('c4_rideau')) return;
  await d.say(['Un rideau de fils rouges, tendu des poutres jusqu\'au plancher.', 'Derrière, une machine pique, pique, pique. Elle ne s\'arrête jamais.']);
  await d.say('Une épingle tient un papier : « Rapporte-moi celle de ce soir. »');
  await mina(d, 'Celle de ce soir… C\'est laquelle ?', 'neutral', '…');
};

/** Back down through the hatch. */
export const hatchDown: Script = async (d) => {
  if (!G.state.flags.c4_couseuse) {
    const i = await d.ask('Redescendre ?', ['Redescendre', 'Rester'], undefined, { cancelIndex: 1 });
    if (i !== 0) return;
  }
  await d.warp('maison_feutre', 'echelle', { sfx: 'whoosh' });
};

// ---------------------------------------------------------------------------------------------------------------------
// The knocking corridor (Night 35 → Night 42)
// ---------------------------------------------------------------------------------------------------------------------

/** One knock event: the knocks to count (B = the radiator pipe, not a knock), and the answer that is expected. */
interface Knock {
  seq: SheepKind[];
  blind: boolean;
}
const KNOCKS: Knock[] = [
  { seq: ['B', 'S', 'B'], blind: false },
  { seq: ['S', 'B', 'S', 'B', 'S'], blind: false },
  { seq: ['B', 'Z', 'S', 'B'], blind: true },
];
const SEGMENT_START = [3, 21, 39, 57];

const knockRound = (k: Knock): SheepRound => ({ title: k.blind ? 'Dans le noir' : 'Le mur', interval: 70, window: 18, tolerance: 2, blind: k.blind, seqs: [k.seq] });
const validOf = (seq: SheepKind[]): number => seq.reduce((n, k) => n + (k === 'P' ? 2 : k === 'S' || k === 'H' ? 1 : 0), 0);
/** The code: to one knock (« t'es là ? ») you answer two (« je suis là ») ; to three (« bonne nuit »), three. */
const expected = (heard: number): number => (heard === 1 ? 2 : 3);

let corridorToken = 0;

export const corridorEnter: Script = (d) => {
  const token = ++corridorToken;
  if (!flag('c4_nuit42')) {
    d.show('lumiere_porte', false);
    d.show('main_porte', false);
  }
  // The nightlight in Noa's hands: the only warm thing in the corridor, and it follows him.
  const lamp = d.spawn({ id: 'lampe', sprite: flag('c4_nuit42') ? '' : 'prop_c4_veilleuse', x: 0, y: 0, solid: false, shadow: false });
  lamp.light = flag('c4_nuit42') ? undefined : { r: 54, color: '#ffc860', flicker: true, dy: -4 };
  lamp.brain = (e: Entity) => {
    const p = world.player;
    e.x = p.x + (p.dir === 'left' ? -5 : p.dir === 'right' ? 5 : 0);
    e.y = p.y + (p.dir === 'up' ? -1 : 1);
    e.oy = -6;
  };
  // Tears behind the segments already passed: no way back.
  const passed = num('c4_coups');
  for (let s = 1; s <= passed; s++) tearBehind(d, SEGMENT_START[s]! - 2);
  // Running makes the light tremble, and the corridor grows longer.
  let runT = 0;
  void (async () => {
    while (token === corridorToken && world.map?.id === 'couloir_coups') {
      await d.wait(1);
      const p = world.player;
      if (!world.busy && game.top === world && input.down('b') && p.moving) runT++;
      else runT = Math.max(0, runT - 2);
      world.lightFlicker = runT > 10 ? 0.55 + rng.next() * 0.4 : 1;
      if (runT > 45) {
        runT = 0;
        world.lightFlicker = 1;
        world.busy++;
        try {
          d.sfx('whoosh', { pitch: 0.35, vol: 0.5 });
          d.shake(2, 14);
          const seg = Math.min(3, num('c4_coups'));
          p.x = Math.max(SEGMENT_START[seg]! * TILE + 8, p.x - 4 * TILE);
          addDoor(d, tile(p.x) + 6);
          if (!flag('c4_coups_course')) {
            d.set('c4_coups_course');
            await d.say(['La lumière tremble quand tu cours.', 'Et le couloir s\'allonge. Une porte de plus. Puis une autre.']);
          }
        } finally {
          world.busy--;
        }
      }
    }
    world.lightFlicker = 1;
  })();
  if (!flag('c4_coups_intro')) {
    d.set('c4_coups_intro');
    void introCorridor(d);
  }
};

async function introCorridor(d: Director): Promise<void> {
  world.busy++;
  try {
    await d.wait(30);
    await d.say(['Le couloir de l\'appartement.', 'Il n\'a jamais été aussi long. Des portes, des portes, des portes.', 'Au bout, quelque part, il y a l\'entrée.']);
    await d.say('La veilleuse tremble un peu dans tes mains. Il ne faut pas qu\'elle s\'éteigne.');
  } finally {
    world.busy--;
  }
}

function tearBehind(d: Director, x: number): void {
  for (let y = 3; y <= 5; y++) {
    if (x < 1) continue;
    d.spawn({ id: `dechirure_${x}_${y}`, sprite: 'prop_c4_dechirure', x, y, solid: true, shadow: false });
  }
}

function addDoor(d: Director, x: number): void {
  const n = num('c4_portes') + 1;
  d.set('c4_portes', n);
  const top = d.spawn({ id: `porte_${n}_h`, sprite: 't_c4_door_top', x, y: 1, solid: false, shadow: false });
  const bot = d.spawn({ id: `porte_${n}_b`, sprite: 't_c4_door', x, y: 2, solid: false, shadow: false });
  top.layer = -1;
  bot.layer = -1;
  d.sfx('door', { pitch: 0.5, vol: 0.4 });
}

/** A knock point of the corridor (`i` = 0, 1, 2). */
export const knockPoint =
  (i: number): Script =>
  async (d) => {
    if (num('c4_coups') !== i) return;
    const k = KNOCKS[i]!;
    await d.wait(20);
    d.sfx('knock1', { vol: 0.8 });
    await d.say(i === 2 ? ['La veilleuse vacille. Tout devient noir.', 'Dans le noir, quelque chose frappe dans le mur.'] : ['Toc.', 'Quelque chose frappe dans le mur. De l\'autre côté.']);
    const scene = CountingScene.open('coups', [knockRound(k)]);
    scene.announce(1);
    await d.wait(20);
    const r = await scene.play(1, 0);
    const heard = validOf(k.seq);
    if (k.blind) {
      const nums = [1, 2, 3];
      const c = await d.ask('Combien de coups ?', nums.map(String));
      await d.say(nums[c] === heard ? 'Oui.' : tf('Non. {0}.', String(heard)));
    } else if (!r.ok) {
      await d.say(tf('Les coups du mur, pas ceux du radiateur. Il y en avait {0}.', String(heard)));
    }
    if (num('c4_coups_faux') >= 1 || !flag('c4_code')) {
      await d.say(heard === 1 ? 'Un coup. Ça veut dire « t\'es là ? ». Tu sais ce qu\'on répond.' : 'Trois coups. « Bonne nuit. » Tu sais ce qu\'on répond.');
    }
    await d.say('Tu lèves la main vers le mur.');
    const answer = await scene.answer();
    await d.wait(20);
    await d.fadeOut(20);
    scene.close();
    await d.fadeIn(20);
    if (answer === expected(heard)) {
      d.set('c4_coups', i + 1);
      d.sfx('chime', { pitch: 0.8, vol: 0.5 });
      await d.say(i === 0 ? ['Silence. Puis, tout doucement : toc, toc.', 'Les portes derrière toi se referment une à une. Le couloir raccourcit.'] : i === 1 ? ['Toc. Toc. Toc.', 'Quelqu\'un a répondu. Le couloir raccourcit encore.'] : ['La veilleuse se rallume.', 'De l\'autre côté du mur, plus rien. Mais ce n\'est pas un mauvais silence.']);
      d.sfx('erase', { vol: 0.6 });
      const p = world.player;
      tearBehind(d, SEGMENT_START[i + 1]! - 2);
      p.x = SEGMENT_START[i + 1]! * TILE + 8;
      world.snapCamera();
      await d.say('Derrière toi, le papier se déchire. Il n\'y a plus de chemin pour revenir.');
    } else {
      d.set('c4_coups_faux', num('c4_coups_faux') + 1);
      d.sfx('door', { pitch: 0.4 });
      d.shake(2, 12);
      addDoor(d, SEGMENT_START[i]! + 7);
      addDoor(d, SEGMENT_START[i]! + 11);
      await d.say(['Rien ne répond.', 'Le couloir s\'étire. Deux portes de plus, qui n\'étaient pas là.']);
      world.player.x = SEGMENT_START[i]! * TILE + 8;
      world.snapCamera();
    }
  };

/** A door of the corridor: always Noa's own room. */
export const corridorDoor: Script = async (d) => {
  const n = num('c4_portes_ouvertes') + 1;
  d.set('c4_portes_ouvertes', n);
  d.sfx('door', { pitch: 0.7, vol: 0.5 });
  const lines = [
    ['Tu ouvres. C\'est ta chambre.', 'Tu refermes.'],
    ['Tu ouvres. C\'est ta chambre. La veilleuse est allumée sur la table de nuit.', 'Mais la veilleuse est dans tes mains.', 'Tu refermes.'],
    ['Tu ouvres. Ta chambre. Quelqu\'un dort dans ton lit, tourné vers le mur.', 'Tu refermes très doucement.'],
    ['Ta chambre.', 'Encore ta chambre.'],
  ];
  await d.say(lines[Math.min(n, lines.length) - 1]!);
};

/** The clock of the corridor: « 42/41 ». */
export const corridorClock: Script = async (d) => {
  await d.say(['Une horloge, dessinée au stylo sur le mur.', 'Elle affiche : « 42/41 ».', 'Il n\'y a pas de quarante-deuxième nuit. Il y en a eu une quand même.']);
};

/** The wall phone at the end of the corridor. */
export const corridorPhone: Script = async (d) => {
  if (flag('c4_nuit42')) {
    await d.say(['Le combiné pend au bout de son fil.', 'Il tourne doucement sur lui-même. Dedans, une tonalité, très loin.']);
    return;
  }
  await d.say(['Un téléphone mural, dessiné au stylo, à la règle.', 'Le combiné attend. Tu attends aussi.']);
};

/** Noa's own door, at the end of the corridor (before Night 42 has been played). */
export const noaDoor: Script = async (d) => {
  await d.say(['La porte de ta chambre.', 'Ta vraie porte. Tu reconnais l\'autocollant à moitié arraché, à hauteur d\'enfant.']);
  if (!flag('c4_nuit42')) await d.say('Elle ne s\'ouvre pas. Pas encore. Il faut que la nuit arrive jusqu\'ici.');
};

// ---------------------------------------------------------------------------------------------------------------------
// Night 42 out of 41: T4 « La lumière sous la porte », Le Petit Homme, Mina n°366 unravels
// ---------------------------------------------------------------------------------------------------------------------

/** The end of the corridor, in front of Noa's door. */
export const nuit42: Script = async (d) => {
  if (flag('c4_nuit42') || num('c4_coups') < 3) return;
  d.set('c4_nuit42');
  d.set('c4_nuit', 42);
  d.face('player', 'right');
  await d.wait(30);
  // The phone rings in the corridor, one last time.
  const tel = d.find('tel_couloir');
  for (let k = 0; k < 2; k++) {
    if (tel) tel.frames = ['prop_c4_tel_2', 'prop_c4_tel'];
    d.sfx('beep', { pitch: 1.6, vol: 0.5 });
    await d.wait(10);
    d.sfx('beep', { pitch: 1.6, vol: 0.5 });
    await d.wait(60);
  }
  if (tel) tel.frames = undefined;
  await d.say('Sur le mur du couloir, un téléphone sonne. Le combiné se décroche tout seul.');
  await d.say('Elle réclame sa veilleuse 🙂 Tu peux me l\'apporter ?', 'mamantel');
  await d.wait(40);
  await d.say(['Tu as la veilleuse dans les mains.', 'Tu as dit « oui tt à l\'heure ».']);
  await d.wait(40);
  d.sfx('beep', { pitch: 1.6, vol: 0.5 });
  await d.say('Je rentre. Pose-la dans l\'entrée.', 'mamantel');
  await d.wait(60);
  // The narrator, honest for once.
  d.music(null, 2);
  await d.narrate('Tu ne l\'as pas posée dans l\'entrée.');
  // The light goes out of his hands: it was never there. It is behind the door.
  const lamp = d.find('lampe');
  if (lamp) {
    lamp.light = undefined;
    lamp.visible = false;
  }
  d.sfx('whoosh', { pitch: 0.4, vol: 0.4 });
  await d.wait(50);
  await d.say(['Tes mains sont vides.', 'La lumière est derrière la porte. Sous la porte, un trait jaune, très fin.']);
  const glow = d.find('lumiere_porte');
  if (glow) {
    glow.visible = true;
    glow.light = { r: 26, color: '#ffe991', flicker: false, dy: -2 };
  }
  d.sfx('chime', { pitch: 0.5, vol: 0.3 });
  await d.wait(80);
  // The shadow of a hand, laid flat on the door, then gone.
  const hand = d.find('main_porte');
  if (hand) {
    hand.visible = true;
    hand.alpha = 0;
    for (let a = 0; a <= 10; a++) {
      hand.alpha = a / 10;
      await d.wait(6);
    }
  }
  await d.say('L\'ombre d\'une main se pose à plat sur la porte.');
  await d.wait(120);
  if (hand) {
    for (let a = 10; a >= 0; a--) {
      hand.alpha = a / 10;
      await d.wait(8);
    }
    hand.visible = false;
  }
  await d.say('Puis elle s\'en va.');
  await d.wait(60);
  // Mina n°366, in the doorframe behind him.
  d.sfx('step', { pitch: 1.4, vol: 0.4 });
  const mx = tile(d.player.x) - 3;
  const framed = d.spawn({ id: 'mina_cadre', char: 'mina366', x: mx, y: 4, dir: 'right' });
  framed.variant = 'feutre';
  d.face('player', 'left');
  await d.say('Derrière toi, sur le papier déchiré, des petits pas de feutre.');
  await d.say(still() ? '…Noa…{p:40} elle est où…{p:40} ma veilleuse ?' : 'Noa… elle est où, ma veilleuse ?', still() ? 'mina366:still' : 'mina366:sad');
  d.remove('mina_cadre');
  d.follower('mina366');
  world.resetFollower();
  // She is felt, in a world of ink: she keeps her colours.
  if (world.follower) world.follower.variant = 'feutre';
  d.face('player', 'right');
  await d.say('La porte de ta chambre s\'ouvre toute seule.');
  await petitHommeBattle(d);
};

async function petitHommeBattle(d: Director): Promise<void> {
  d.set('c4_coton_chaud', G.state.flags.c4_coton_chaud ?? 0);
  const r = await d.battle(['petit_homme']);
  if (r.outcome === 'lose') return;
  const spared = r.outcome === 'spare';
  d.set('c4_petit_homme', spared ? 'epargne' : 'vaincu');
  if (!spared) d.set('c4_fele');
  await aftermath(d, spared);
}

/** After the boss: the nightlight falls into Mina n°366's hands; she unravels, stitch after stitch. */
async function aftermath(d: Director, spared: boolean): Promise<void> {
  if (withMina()) d.follower(null);
  await d.fadeOut(30);
  d.load('maison_stylo', 'nuit42');
  d.music(null);
  const doll = d.spawn({ id: 'petit', sprite: 'npc_poupee_noa', x: 13, y: 7, solid: true });
  doll.dir = 'down';
  const lampKey = spared ? 'b_c4_veilleuse' : 'b_c4_veilleuse_fele';
  const lamp = d.spawn({ id: 'veilleuse_sol', sprite: lampKey, x: 15, y: 7, solid: false, shadow: false });
  lamp.light = { r: 40, color: '#ffe991', flicker: !spared };
  d.spawn({ id: 'mina_fin', char: 'mina366', x: 17, y: 8, dir: 'left' }).variant = 'feutre';
  await d.fadeIn(40);
  if (spared) {
    await d.say(['Le Petit Homme s\'est assis par terre, à côté de la lumière.', 'Il ne la reprend pas. Les points de sa bouche ont sauté. Il ne dit plus rien.']);
  } else {
    await d.say(['Il ne reste du Petit Homme qu\'une flaque d\'encre et des bouts de rembourrage.', 'La veilleuse a roulé par terre. Une fêlure la traverse, d\'un bord à l\'autre.', 'Elle brille quand même. Moins bien.']);
  }
  await d.wait(40);
  await d.walkTo('mina_fin', 16, 7, 0.6);
  d.face('mina_fin', 'left');
  await d.wait(30);
  d.remove('veilleuse_sol');
  const held = d.spawn({ id: 'veilleuse_main', sprite: lampKey, x: 16, y: 7, solid: false, shadow: false });
  held.oy = -10;
  held.light = { r: 46, color: '#ffe991', flicker: !spared };
  d.sfx('chime', { pitch: 1.2, vol: 0.5 });
  await d.say(spared ? 'La veilleuse tombe dans les mains de Mina.' : 'Mina ramasse la veilleuse fêlée. Elle la tient contre elle.');
  await d.wait(40);
  if (spared) {
    d.set('c4_mina366', 'merci');
    await d.say('Merci.', still() ? 'mina366:still' : 'mina366:happy');
    await d.wait(60);
  } else {
    d.set('c4_mina366', 'silence');
    await d.say('…', 'mina366:sad');
    await d.wait(60);
  }
  // She comes undone, stitch after stitch, without tearing: one long red thread on the floor.
  d.remove('mina_fin');
  const u = d.spawn({ id: 'mina_defait', sprite: 'pose_mina366_defait_1', x: 16, y: 7, solid: false, shadow: false });
  u.variant = 'feutre';
  for (let s = 1; s <= 4; s++) {
    u.sprite = `pose_mina366_defait_${s}`;
    for (let k = 0; k < 4; k++) {
      d.sfx('thread', { pitch: 1.3 - s * 0.15, vol: 0.5 });
      await d.wait(22);
    }
  }
  d.remove('mina_defait');
  d.remove('veilleuse_main');
  const l2 = d.spawn({ id: 'veilleuse_sol2', sprite: lampKey, x: 16, y: 8, solid: false, shadow: false });
  l2.light = { r: 40, color: '#ffe991', flicker: !spared };
  d.spawn({ id: 'fil', sprite: 'prop_c4_fil', x: 16, y: 7, solid: false, shadow: false }).variant = 'feutre';
  d.spawn({ id: 'couronne', sprite: 'prop_c4_couronne_feutre', x: 17, y: 7, solid: false, shadow: false }).variant = 'feutre';
  await d.say(
    spared
      ? ['Elle se défait doucement, maille après maille. Sans déchirure. Sans un bruit.', 'Il ne reste d\'elle qu\'un long fil rouge, par terre.', 'La couronne de feutre tombe à côté.']
      : ['Elle se défait, maille après maille. Elle n\'a pas dit merci.', 'Il ne reste d\'elle qu\'un long fil rouge, par terre, et une couronne de feutre.'],
  );
  await d.wait(60);
  await d.say('…', 'noa:sad');
  await d.wait(60);
  await endChapter(d);
}

async function endChapter(d: Director): Promise<void> {
  d.set('c4_fin');
  // « Coton chaud » lasted one night.
  d.set('c4_coton_chaud', 0);
  d.ambience('none');
  await d.fadeOut(60);
  d.souvenir('lumiere');
  await d.image('souvenir_lumiere', SOUVENIRS.lumiere?.captions ?? []);
  await d.wait(40);
  // Interlude IV (« Le placard », production lot 2) takes over from here.
  if (STORY.wake[4]) {
    await wakeUp(d, 4);
    return;
  }
  await d.fadeOut(60, '#ffffff');
  G.state.flags.interlude = 4;
  await d.narrate('…');
}

// ---------------------------------------------------------------------------------------------------------------------
// Mina n°366's lines when Noa talks to her (index.ts calls mina366Talk while she follows)
// ---------------------------------------------------------------------------------------------------------------------

/** Mina n°366's lines by map id ("texte|expression"). She repeats chapter 1 a little late. */
export const MINA_LINES: Record<string, string[]> = {
  maison_feutre: [
    'Tu sens ? Ça sent la barbe à papa !{p:40} …Ça sent la barbe à papa.|happy',
    'Les moutons sont trop mignons. Sauf le noir. Il est grognon.{p:40} …Il est grognon.|happy',
    'Moi, mon vœu, c\'est un secret. … Bon, d\'accord : c\'est que tu restes.{p:50} C\'est que tu restes.|happy',
    'Madame Lune dort tout le temps.{p:30} Ici, y a pas de Madame Lune. Y a juste la lune.|neutral',
    'Pourquoi tu me regardes comme ça ?|neutral',
    'Je suis pas cassée. Je suis cousue.|neutral',
    'Ici, quand on tombe, ça fait pas mal. Regarde ! … Bon, je tombe pas.{p:30} Je tombe pas.|happy',
    'Je suis contente que tu sois là. Vraiment vraiment.{p:40} Vraiment.|happy',
    'Mon sourire, il tient tout seul. J\'ai même pas besoin d\'y penser.|happy',
    'Les moutons d\'ici, ils parlent pas. Ils font juste le ménage. C\'est mieux, non ?|neutral',
  ],
  grenier: [
    'Il fait chaud, ici. Comme dans un ventre.|neutral',
    'Si on trouve l\'étoile, tu feras quel vœu, toi ?{p:40} …Quel vœu, toi ?|neutral',
    'Elles me regardent toutes. Dis-leur d\'arrêter.|sad',
    'Si je finis ma phrase, qu\'est-ce qui se passe ?|neutral',
  ],
  maison_stylo: [
    'C\'est tout gris, ici. C\'est toi qui as dessiné ?|sad',
    'Je touche à rien. Promis. J\'ai peur que ça s\'efface.|neutral',
  ],
  couloir_coups: ['Il est long, ce couloir. Il était pas si long, avant.{p:30} Avant quoi ?|sad'],
};

/** Talking to Mina n°366 while she follows. */
export const mina366Talk: Script = async (d) => {
  if (still()) {
    await d.say(['Mina te regarde. Ses yeux-boutons ne suivent plus tes mouvements.', 'Le fil de son sourire pend.'], 'mina366:still');
    return;
  }
  const lines = MINA_LINES[G.state.map] ?? ['Je te protège. C\'est moi, la chevalière.{p:40} …C\'est moi ?|happy'];
  const n = num(`mina366_talk_${G.state.map}`);
  d.set(`mina366_talk_${G.state.map}`, n + 1);
  const [text, expr] = tr(lines[n % lines.length]!).split('|') as [string, string | undefined];
  await d.say(text, `mina366:${expr ?? 'neutral'}`);
};

// ---------------------------------------------------------------------------------------------------------------------
// Debug
// ---------------------------------------------------------------------------------------------------------------------

/** Chapter 3 stats: 14 Étoiles, the Plume dorée, the Cape de Mina, a few items. */
function setup(d: Director, flags: Record<string, number | boolean | string>, party: boolean): void {
  const s = G.state;
  s.chapter = 4;
  s.etoiles = 14;
  s.encre = 3;
  s.weapon = 'plume';
  s.armor = 'cape';
  s.items = ['chocolat', 'lait', 'biscuit', 'mouchoir', 'pluie'];
  s.spares = { nuage: 2, mouton_noir: 1, placard: 1, gomme: 1, perfusion: 1 };
  for (const [k, v] of Object.entries(flags)) s.flags[k] = v;
  s.hp = maxHp(s);
  d.follower(party ? 'mina366' : null);
}

const AFTER_DINNER = { c4_intro: true, c4_diner_vu: true, c4_diner_fait: true, c4_maman: 'merci' };

/** Scripts runnable with ?debug=script&name=… */
export const DEBUG: Record<string, Script> = {
  chapter4: async (d) => {
    setup(d, {}, false);
    await start(d);
  },
  /** The felt house, just before the looping dinner. */
  chapter4_diner: async (d) => {
    setup(d, { c4_intro: true }, true);
    d.load('maison_feutre', 'cuisine');
    await d.fadeIn(10);
  },
  /** Night 1 (the felt has just peeled off). */
  chapter4_nuits: async (d) => {
    setup(d, AFTER_DINNER, false);
    d.load('maison_feutre', 'horloge');
    await toPen(d, 1);
  },
  /** Back in the felt house after Night 1: Mina n°366 on her chair, Dodo hungry, the toy chest. */
  chapter4_retour: async (d) => {
    setup(d, { ...AFTER_DINNER, c4_nuit: 1, c4_nuit_fait: 1, c4_tel_1: true, c4_mina_dort: true }, false);
    d.load('maison_feutre', 'horloge');
    await d.fadeIn(10);
  },
  /** Night 22, just answered: the Noa-doll at the front door, Clé. */
  chapter4_nuit22: async (d) => {
    setup(d, { ...AFTER_DINNER, c4_nuit: 22, c4_nuit_fait: 9, c4_tel_1: true, c4_tel_9: true, c4_tel_22: true, c4_mina_dort: true }, false);
    d.load('maison_stylo', 'entree');
    await d.fadeIn(10);
  },
  /** The attic, Mina n°366 following (the hatch opened on Night 22). */
  chapter4_grenier: async (d) => {
    setup(d, { ...AFTER_DINNER, c4_nuit: 22, c4_nuit_fait: 22, c4_tel_1: true, c4_tel_9: true, c4_tel_22: true, c4_trappe: true, c4_code: true }, true);
    d.load('grenier', 'trappe');
    await d.fadeIn(10);
    await grenierEnter(d);
  },
  /** The knocking corridor (Night 35, the nightlight in Noa's hands). */
  chapter4_coups: async (d) => {
    setup(d, { ...AFTER_DINNER, c4_nuit: 35, c4_nuit_fait: 35, c4_tel_35: true, c4_trappe: true, c4_couseuse: 'epargnee', c4_t3: true, c4_veilleuse: true, c4_coups_debut: true, c4_code: true, c4_mina_dort: true }, false);
    d.load('couloir_coups', 'debut');
    await d.fadeIn(10);
  },
  /** Night 42 out of 41: the end of the corridor (T4), then Le Petit Homme. */
  chapter4_nuit42: async (d) => {
    setup(d, { ...AFTER_DINNER, c4_nuit: 35, c4_nuit_fait: 35, c4_couseuse: 'epargnee', c4_t3: true, c4_veilleuse: true, c4_coups_debut: true, c4_coups_intro: true, c4_code: true, c4_coups: 3, c4_mina_dort: true }, false);
    d.load('couloir_coups', 'fin');
    await d.fadeIn(10);
    await nuit42(d);
  },
  /** After Le Petit Homme (spared): Mina n°366 unravels, then the souvenir. */
  chapter4_fin: async (d) => {
    setup(d, { ...AFTER_DINNER, c4_nuit: 42, c4_couseuse: 'epargnee', c4_nuit42: true, c4_petit_homme: 'epargne' }, true);
    d.load('couloir_coups', 'fin');
    await d.fadeIn(10);
    await aftermath(d, true);
  },
};

import { TILE } from '../../engine/constants';
import { fx } from '../../engine/fx';
import type { Director } from '../director';
import { setPageTitle } from '../meta';
import { world } from '../overworld/world';
import { G } from '../state';
import { finishGame, wakeUp, type EndingId } from './common';

/**
 * The endings (docs/HISTOIRE.md § 5), taken out of chapter3.ts (production lot 4).
 *
 *   endingAube, endingBeauxReves, endingSilence   version 1.1, moved unchanged. Since the battle of chapter 3 was
 *                                                 shortened (it always leads to the false dawn), Beaux rêves and
 *                                                 Silence are reached from the v2 final battle; endingAube (the v1.1
 *                                                 dream goodbye) only by debug (c3_aube).
 *   endingAubeBlanche, endingVeilleuse           version 2, placeholders: production lot 9 writes them (and the v2
 *                                                 Aube, Beaux rêves and Silence) in this file.
 *   afterFinalBattle(d, route)                   where the v2 final battle (chapter 6, src/data/enemies-ch6.ts) leads:
 *                                                 « Ouvrir les yeux » wakes up into the finale (STORY.wake[6], still the
 *                                                 v1.1 « Le carnet » until lot 9), « Rester » is Beaux rêves, the
 *                                                 route of the ink is Silence.
 *   dawnEnding()                                 which ending the finale closes on, once the eyes are open (§ 5).
 *
 * Flags: fin_route 'aube' | 'beaux_reves' | 'silence' (set by the final battles).
 */

/** Where the final battle leaves Noa: eyes open, staying with Dodo, or nothing left to say goodbye to. */
export type FinalRoute = 'aube' | 'beaux_reves' | 'silence';

const tile = (px: number): number => Math.floor(px / TILE);

export async function endingAube(d: Director): Promise<void> {
  d.set('fin_route', 'aube');
  setPageTitle(null);
  d.music(null, 2);
  const giant = d.find('dodo_giant');
  if (giant) {
    world.particles.burst(giant.x, giant.y - 20, '#fff3cf', 30, 1.4);
    d.remove('dodo_giant');
  }
  d.spawn({ id: 'dodo_plush', sprite: 'prop_dodo_plush', x: 15, y: 8, solid: false, shadow: true });
  d.flash('#fff3cf', 30);
  world.extraDarkness = -0.2;
  await d.wait(60);
  await d.say(['…', 'Tu as gagné, Noa.'], 'dodo:neutral');
  await d.say(['Elle m\'avait donné à toi pour que je veille sur toi.', 'Je crois que j\'ai mal compris.', 'Veiller, ce n\'est pas empêcher de se réveiller.'], 'dodo:neutral');
  await d.say(['Va.', 'Moi, je suis un mouton en peluche. Mon travail, c\'est de rester.'], 'dodo:happy');
  d.music('title', 2);
  await d.wait(30);
  // Mina appears a few steps ahead of Noa, left of where the choice window opens.
  const mx = Math.min(22, tile(d.player.x) + 7);
  d.spawn({ id: 'mina_light', sprite: 'pose_mina_light', x: mx, y: 8, solid: false, shadow: false, light: { r: 60, color: '#fff3cf', flicker: true } });
  d.sfx('chime', { pitch: 0.9 });
  await d.cameraTo(mx - 2, 8);
  await d.say('Noa.', 'mina:happy');
  await d.say(['Tout à l\'heure, j\'ai pas pu finir ma phrase.', 'Je voulais juste te dire…'], 'mina:neutral');
  await d.say('C\'est pas ta faute.', 'mina:sad');
  await d.say(['Et mon carnet… celui avec le Pays de Coton dedans.', 'Il est sur mon bureau. Je l\'ai fait pour toi.', 'Va le lire, d\'accord ? Et allume la lumière.'], 'mina:happy');
  await d.say('…Mina.', 'noa:sad');
  const c = await d.ask('Elle sourit. Elle attend que tu le dises.', ['Au revoir', 'Je t\'aime', 'Pardon']);
  await d.say(['Au revoir.', 'Je t\'aime.', 'Pardon.'][c]!, 'noa:sad');
  const answers = [
    ['Au revoir, Noa.', 'Fais de beaux rêves… mais pas trop longtemps, hein !'],
    ['Moi aussi.', 'Gros comme le Pays de Coton. Plus gros, même.'],
    ['Je sais.', 'Moi aussi je t\'aime, gros bêta.'],
  ];
  await d.say(answers[c]!, 'mina:happy');
  const ml = d.find('mina_light');
  if (ml) {
    for (let i = 0; i < 30; i++) {
      ml.alpha = 1 - i / 30;
      await d.wait(3);
    }
    world.particles.burst(ml.x, ml.y - 12, '#ffe991', 24, 1);
  }
  d.remove('mina_light');
  d.cameraFollow();
  d.set('c3_dawn_ready');
  await d.wait(30);
  await d.say(['Plus loin, au bout du vide, une porte de lumière s\'est ouverte.', 'De l\'autre côté, il fait presque jour.']);
}

export async function endingBeauxReves(d: Director): Promise<void> {
  d.music('dodo', 2);
  const p = d.player;
  await d.say(['Chut. Voilà.', 'Allonge-toi. Là. Tout contre moi.'], 'dodo:happy');
  d.show('player', false);
  d.spawn({ id: 'noa_lie', sprite: 'pose_noa_lie', x: tile(p.x), y: tile(p.y - 2), solid: false, shadow: false });
  await d.wait(60);
  await d.say(['Je vais te raconter une histoire.', 'Il était une fois un Pays de Coton, où il ne pleuvait que du coton…'], 'dodo:happy');
  await d.say(['…et une princesse-chevalière qui n\'est jamais partie.', 'Et un grand frère qui n\'a jamais rien fait de mal.'], 'dodo:happy');
  await d.say('Un mouton… {p:30}deux moutons… {p:40}trois…', 'dodo:neutral');
  await d.wait(40);
  await d.say(['Merci, {player}.', 'Tu peux rester, toi aussi. Tant que tu restes, il dort bien.'], 'dodo:creepy');
  await d.fadeOut(120);
  await d.image('fin_beaux_reves', [
    'Noa dort. Il fait de beaux rêves.',
    'Dans le rêve, il fait toujours nuit, et personne n\'est jamais triste.',
    'Dans l\'appartement, la veilleuse grésille encore un peu. Puis plus rien.',
  ]);
  await d.narrate('Bonne nuit, Noa.', { voice: 'dodo' });
  await d.narrate('Bonne nuit, {player}.', { voice: 'dodo' });
  await finishGame(d, 'beaux_reves');
}

export async function endingSilence(d: Director): Promise<void> {
  d.music(null, 1);
  d.ambience('none');
  world.extraDarkness = 0.4;
  await d.say(['Dors, maintenant.', 'Il n\'y a plus rien à réveiller.'], 'dododark:creepy');
  fx.glitch = 0.15;
  await d.fadeOut(120);
  fx.glitch = 0;
  await d.image('fin_silence', [
    'Le Pays de Coton est noyé d\'encre.',
    'Il n\'y a plus de moutons. Plus de lune. Plus de princesse.',
    'Il n\'y a plus personne pour se souvenir de rien.',
  ]);
  await d.narrate('…', { voice: 'dododark' });
  await finishGame(d, 'silence');
}

// ---------------------------------------------------------------------------
// Version 2
// ---------------------------------------------------------------------------

/**
 * Once the eyes are open, the ending the finale closes on (§ 5): Veilleuse when every condition of the secret ending
 * holds, Aube blanche after three drawings corrected or more (chapter 5), Aube otherwise.
 */
export function dawnEnding(): EndingId {
  const fl = G.state.flags;
  const secret =
    G.meta.endings.includes('aube') &&
    !fl.c1_bouton_vendu &&
    !!fl.c5_fievre &&
    Number(fl.c5_corrige ?? 0) < 3 &&
    !!fl.c6_pile &&
    G.meta.callVersion === 'sais_pas' &&
    !!fl.i4_pile;
  if (secret) return 'veilleuse';
  return Number(fl.c5_corrige ?? 0) >= 3 ? 'aube_blanche' : 'aube';
}

/** Leaving the v2 final battle (chapter 6) for its ending. */
export async function afterFinalBattle(d: Director, route: FinalRoute): Promise<void> {
  d.set('fin_route', route);
  if (route === 'silence') await endingSilence(d);
  else if (route === 'beaux_reves') await endingBeauxReves(d);
  // « Ouvrir les yeux »: the finale (STORY.wake[6]).
  else await wakeUp(d, 6);
}

/** Aube blanche (§ 5) — placeholder until production lot 9: records the ending and rolls the credits. */
export async function endingAubeBlanche(d: Director): Promise<void> {
  await finishGame(d, 'aube_blanche');
}

/** Veilleuse, the secret ending (§ 5) — placeholder until production lot 9: records the ending and rolls the credits. */
export async function endingVeilleuse(d: Director): Promise<void> {
  await finishGame(d, 'veilleuse');
}

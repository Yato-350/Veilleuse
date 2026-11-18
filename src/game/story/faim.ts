import { audio } from '../../engine/audio';
import { fx } from '../../engine/fx';
import type { Director } from '../director';
import type { Entity } from '../overworld/entity';
import { world } from '../overworld/world';
import { JumpScene } from '../scenes/jump';
import { G } from '../state';

/*
 * Hunger (2.2; the author: « en fonction de s'il mange ou qu'il choisit qu'il ne mange pas, Noa peut faire des
 * illusions »). flags.faim counts the meals Noa turned down — the cold pasta of Interlude I, the fridge at 4:06
 * (Interlude III), the dinner that starts again in chapter 4 — minus the meals he ate. In the apartment:
 *   faim ≥ 1  Mina at her place in the kitchen (she is gone when you come near); a plate that steams on the table,
 *             and then there is nothing on the table;
 *   faim ≥ 2  at night, the hallway: Dodo at the far end, life-size, torn open, the cotton hanging out (horror on a
 *             toy only: docs/HISTOIRE.md § 6.1) — then at Noa's face (scenes/jump.ts). Once.
 * Eating makes them fade. Nothing here is ever the finale (Noa is waking up).
 */

export const faim = (): number => Number(G.state.flags.faim ?? 0);

/** Noa turns a meal down (`key`: once per meal). */
export function refuseMeal(d: Director, key: string): void {
  if (G.state.flags[key]) return;
  d.set(key);
  d.set('faim', faim() + 1);
}

/** Noa eats: one meal less missing. */
export function eatMeal(d: Director): void {
  d.set('faim', Math.max(0, faim() - 1));
}

const phase = (): number => Number(G.state.flags.interlude ?? 0);
const TILE = 16;
const dist = (e: Entity): number => Math.hypot(e.x - world.player.x, e.y - world.player.y) / TILE;

/** The apartment maps' onEnter: what Noa sees when he has not eaten (nothing in the finale). */
export function hungerSights(d: Director): void {
  const p = phase();
  if (p === 9 || faim() < 1) return;
  if (!G.state.flags[`faim_mina_${p}`]) minaAtHerPlace(d, p);
  if (faim() >= 2 && p >= 2 && !G.state.flags.faim_couloir) dodoInTheHallway(d);
}

/** Mina, at her place at the kitchen table, as she was. Coming near, she is not there any more. */
function minaAtHerPlace(d: Director, p: number): void {
  const e = d.spawn({
    id: 'faim_mina',
    sprite: 'npc_mina_avant_1',
    x: 30,
    y: 5,
    dir: 'down',
    solid: false,
    shadow: false,
    script: async (dd) => {
      await dd.say(['Il n\'y a personne.', 'La chaise de Mina. Le coussin est froid.']);
    },
  });
  // She is there when Noa looks from afar (four tiles or more: turning round after the cold pasta, coming down the
  // hallway); when he comes near, she is not.
  e.alpha = 0;
  let shown = false;
  let gone = false;
  e.brain = (m) => {
    if (!shown && dist(m) >= 4) shown = true;
    if (shown && !gone) m.alpha = Math.min(0.6, m.alpha + 0.03);
    if (shown && !gone && dist(m) < 2.5) {
      gone = true;
      d.set(`faim_mina_${p}`);
      audio.sfx('static', { vol: 0.2, pitch: 0.5 });
    }
    if (gone) {
      m.alpha = Math.max(0, m.alpha - 0.04);
      if (m.alpha <= 0) world.removeEntity(m);
    }
  };
}

/**
 * The table: a plate that steams, Mina's already finished — then nothing. Once per moment (true if it played: the
 * table's own words wait for the next look).
 */
export async function plateOnTheTable(d: Director): Promise<boolean> {
  const p = phase();
  if (p === 9 || faim() < 1 || G.state.flags[`faim_assiette_${p}`]) return false;
  d.set(`faim_assiette_${p}`);
  if (faim() >= 2) {
    // Two meals turned down: the plate is not pasta any more (gore on food, never on the children: § 6.1).
    await d.say(['Sur la table, une assiette de pâtes. Elles bougent.', 'Ce ne sont pas des pâtes. Ça se tortille, blanc, dans une sauce trop rouge.']);
    fx.pulseGlitch(8);
    audio.sfx('splat', { vol: 0.35, pitch: 1.4 });
    await d.wait(30);
    await d.say(['Tu clignes des yeux.', 'L\'assiette est vide. Elle a toujours été vide.']);
    return true;
  }
  await d.say(['Sur la table, une assiette de pâtes t\'attend. Elles fument encore.', 'L\'assiette de Mina est déjà vide. Elle t\'a attendu pour le dessert.']);
  fx.pulseGlitch(6);
  audio.sfx('glitch', { vol: 0.3 });
  await d.wait(30);
  await d.say(['Tu clignes des yeux.', 'Il n\'y a rien sur la table. Il n\'y a rien eu depuis longtemps.']);
  return true;
}

/**
 * The hallway at night: Dodo, life-size, torn open, at the far end; a few seconds later (or when Noa comes near), at
 * his face. Then the hallway is empty, and Dodo is on the bed, where he always was.
 */
function dodoInTheHallway(d: Director): void {
  const left = world.player.x > 12 * TILE;
  const e = d.spawn({ id: 'faim_dodo', sprite: 'b_dodo_torn', x: left ? 2 : 23, y: 6, dir: 'down', solid: false, shadow: false });
  e.alpha = 0;
  let t = 0;
  let done = false;
  e.brain = (m) => {
    if (done || !world.controllable) return;
    t++;
    // It shows a little in the dark (a cold light on it), then comes.
    if (t > 120) m.alpha = Math.min(0.75, m.alpha + 0.02);
    if (t > 120 && !m.light) m.light = { r: 44, color: '#8a7cff', flicker: true, dy: -30 };
    if (t > 420 || (t > 160 && dist(m) < 4)) {
      done = true;
      void world.hooks.run(async (dd) => {
        dd.set('faim_couloir');
        world.removeEntity(m);
        await JumpScene.play('b_dodo_torn');
        await dd.wait(30);
        await dd.fadeIn(40);
        await dd.say(['…', 'Le couloir est vide.']);
        await dd.say(['Sur le parquet, une traînée de coton mouillé. Rouge.', 'Elle va jusqu\'à ta chambre.']);
        await dd.say(['Dodo est sur ton lit. Il a toujours été sur ton lit.', 'Ta tête tourne. Depuis quand tu n\'as pas mangé ?']);
      });
    }
  };
}

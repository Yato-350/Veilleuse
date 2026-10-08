import { audio } from '../../engine/audio';
import { H, TILE, W } from '../../engine/constants';
import { fx } from '../../engine/fx';
import { game, type Scene } from '../../engine/game';
import { ILLUSTRATIONS } from '../../data/illustrations';
import type { Battle } from '../battle/battle';
import type { EnemyRuntime } from '../battle/enemy';
import type { BattleHooks, WordDef } from '../battle/types';
import { director, type Director } from '../director';
import { flow } from '../flow';
import { setPageTitle } from '../meta';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { CreditsScene } from '../scenes/credits';
import { PhoneScene, type PhoneMessage, type PhoneReply } from '../scenes/phone';
import { deleteSave, G, hasSave, maxHp, readSave, writeMeta } from '../state';
import { tf, tr } from '../../i18n';

/**
 * Bonus chapter « Les rêves des autres » — Maman's dream. Unlocked on the title screen after the « aube » ending.
 *
 * The same night as Noa's last one, seen from Maman's side. 3:33, at the care home where she works nights « pour ne
 * pas penser »: she leaves Noa the voicemail he hears in interlude II, closes her eyes « juste une seconde », and
 * dreams. Her old alarm clock — the one she set for 5:00 on Mina's last night, to bring back the nightlight before
 * Mina woke up, and that never rang because the phone rang first, at 3:33 — has come alive: Le Réveil, her Dodo.
 * It wants her never to sleep again.
 *
 *   b_service (the night corridor of « Les Glycines », looping until she sits down for five minutes)
 *   → b_appart (home at night: Noa's door, the fridge note, the laundry basket in front of Mina's door)
 *   → b_hopital (behind Mina's door, the paper hospital: the vending machine, Mina at 3 a.m., Nadia the night nurse)
 *   → b_304 (the parents' armchair: boss Le Réveil, then she sleeps; Mina watches over her)
 *   → dawn at the care home, « Je rentre. » (5:52, the message Noa reads in the finale) → « Noa ? Tu es réveillé ? »
 *
 * The player controls Maman (G.state.playerChar = 'maman'). Separate run: it never touches the main story flags.
 * Flags (prefix b_): b_intro, b_corridor, b_loop (corridor loops), b_sat (sat on the bench: the way home opens),
 * b_sabine / b_albert (talk counts), b_room_<n>, b_cafe, b_phone, b_home, b_noa_door, b_note, b_panier_done,
 * b_hosp, b_choco, b_mina_mem, b_nadia, b_boss_done.
 */

const flag = (k: string): boolean => !!G.state.flags[k];
const num = (k: string): number => Number(G.state.flags[k] ?? 0);
const bump = (k: string): number => {
  const n = num(k);
  G.state.flags[k] = n + 1;
  return n;
};
const tileOf = (px: number): number => Math.floor(px / TILE);

/** Turns the fresh run into Maman's: player character, chapter, equipment, a tissue in the pocket. */
function setupMaman(): void {
  const s = G.state;
  s.chapter = 4;
  s.playerChar = 'maman';
  s.flags.bonus = 1;
  s.weapon = 'stylo';
  s.armor = 'gilet';
  s.party = [];
  if (!s.items.includes('mouchoir')) s.items.push('mouchoir');
  s.hp = maxHp(s);
}

/** Noa's old voicemail greeting (recorded two years ago, Mina doing the beep). */
async function voicemailGreeting(d: Director): Promise<void> {
  for (let i = 0; i < 3; i++) {
    d.sfx('beep', { pitch: 0.75, vol: 0.5 });
    await d.wait(48);
  }
  await d.say('Salut, c\'est Noa. Laissez un message après le…', 'messagerie');
  await d.say('Noa ! Noa ! C\'est moi qui fais le bip !', 'minavoix');
  await d.say('…Mina. Bon. Le bip, c\'est elle.', 'messagerie');
  await d.say('{wave}Biiiiiiiip !{/wave}', 'minavoix');
}

// ---------------------------------------------------------------------------
// Opening — 3:33, the voicemail, « juste une seconde »
// ---------------------------------------------------------------------------

export async function start(d: Director): Promise<void> {
  setupMaman();
  setPageTitle(null);
  d.music(null);
  d.ambience('hum');
  await d.wait(40);
  await d.narrate('Trois heures trente-trois.');
  await d.narrate(['La salle de pause, au bout du couloir.', 'Une seule lampe allumée.']);
  await voicemailGreeting(d);
  d.sfx('beep', { pitch: 1.3 });
  await d.wait(30);
  await d.say(['Noa… c\'est Maman.', 'Je… je sais que tu ne décroches pas. C\'est pas grave.'], 'maman:sad');
  await d.say(['Ça fait un an demain.', 'Je rentre ce soir. Plus tôt. J\'ai demandé.'], 'maman:sad');
  await d.say(['On ira la voir ensemble, d\'accord ?', 'Je t\'aime, mon grand.'], 'maman:sad');
  await d.wait(40);
  await d.narrate(['Tu raccroches.', 'Sur la table, à côté du téléphone, ton vieux réveil fait tic.', 'Puis tac.']);
  await d.narrate(['Tu fermes les yeux.', 'Juste une seconde.']);
  d.ambience('none');
  await d.wait(30);
  await d.chapter('Les rêves des autres', 'La nuit de Maman', 'Elle travaille de nuit. Ça l\'aide à ne pas penser.');
  d.load('b_service', 'start');
  d.show('player', false);
  const chair = world.get('fauteuil');
  if (chair) chair.sprite = 'pose_maman_fauteuil';
  d.music(null);
  await d.fadeIn(80);
  await d.wait(50);
  await alarm(d, 4);
  if (chair) chair.sprite = 'prop_fauteuil';
  d.show('player', true);
  d.face('player', 'right');
  await d.emote('player', '!');
  await d.say(['Debout ! Debout, debout, debout !'], 'reveil:happy');
  await d.say(['Tu as fermé les yeux. Je t\'ai vue.'], 'reveil:neutral');
  await d.say('Je ne dormais pas.', 'maman:neutral');
  await d.say(['Bien sûr que non. Tu ne dors jamais.', 'C\'est pour ça qu\'on s\'entend si bien, toi et moi.'], 'reveil:happy');
  await d.say(['Ton vieux réveil. Celui de ta table de nuit, que tu emportes partout depuis un an.', 'Il a des yeux, maintenant. Et il parle.']);
  await d.say('…Je rêve.', 'maman:neutral');
  await d.say(['Tu rêves ? Non, non, non. Tu travailles.', 'Écoute.'], 'reveil:neutral');
  d.music('garde', 1);
  for (let i = 0; i < 3; i++) {
    d.sfx('beep', { pitch: 1.5 + i * 0.2, vol: 0.4 });
    await d.wait(14);
  }
  await d.say('Au fond du couloir, les sonnettes se mettent à sonner. Une, puis deux, puis toutes.');
  await d.say(['Chambre 12 ! Chambre 14 ! Tout le monde a besoin de toi.', 'Allez, hop ! Je saute dans ta poche.'], 'reveil:happy');
  d.remove('reveil');
  d.sfx('pop', { pitch: 1.2 });
  await d.say(['Le Réveil saute dans la poche de ton gilet.', 'Tu le sens battre contre ta hanche. Comme un deuxième cœur, un peu trop rapide.']);
  d.set('b_intro');
}

/** DRIIING: the little clock on the table rings `n` times. */
async function alarm(d: Director, n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    d.sfx('beep', { pitch: 2.4, vol: 0.5 });
    d.shake(1, 6);
    await d.wait(7);
    d.sfx('beep', { pitch: 2.2, vol: 0.5 });
    await d.wait(9);
  }
}

// ---------------------------------------------------------------------------
// b_service — the night corridor
// ---------------------------------------------------------------------------

export const lockers: Script = async (d) => {
  await d.say(['Ton casier. Une photo est scotchée à l\'intérieur de la porte : Noa et Mina sur la plage, l\'été d\'avant.', 'Sur la photo, Noa fait semblant de ne pas sourire. Mina fait semblant d\'être un crabe.']);
  await d.say('C\'est ici que tu lis ses messages, à la pause. Quand il y en a.');
};

export const coffeeMachine: Script = async (d) => {
  if (flag('b_cafe')) {
    await d.say('La machine à café. Encore un ? Ton cœur bat déjà assez vite comme ça.');
    return;
  }
  const r = await d.ask('La machine à café. Un café ?', ['Un café', 'Non'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('b_cafe');
  d.sfx('pop', { pitch: 0.7 });
  d.heal();
  await d.say(['Ton quatrième de la nuit. Ou le cinquième.', 'Il est amer. Tu le bois quand même. Tu te sens mieux. Un peu.']);
  await d.say('Voilà ! Tic, tac !', 'reveil:happy');
};

export const breakPhone: Script = async (d) => {
  await d.say('Ton téléphone. L\'écran dit : « Noa — message vocal envoyé, 3:33 ».');
  const r = await d.ask('Rappeler ?', ['Rappeler', 'Le laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  bump('b_phone');
  await voicemailGreeting(d);
  await d.say(['Tu raccroches avant le vrai bip.', 'Tu fais ça, des fois. Juste pour les entendre tous les deux.']);
};

export const breakWindow: Script = async (d) => {
  await d.say(['Dehors, la ville dort.', 'Quelque part, il y a tes fenêtres. Celle de la cuisine, éteinte. Celle de Noa, allumée, peut-être.']);
};

export const breakChair: Script = async (d) => {
  await d.say('Le fauteuil de la salle de pause. Il a gardé la forme de toutes les collègues qui s\'y sont assises « juste cinq minutes ».');
};

export const corridorIntro: Script = async (d) => {
  await d.say(['Le couloir des Glycines. Tu le connais par cœur.', 'Dix-huit chambres, une plante qui ne pousse pas, et le ronflement de Monsieur Paul.']);
  await d.say('Vite, vite ! Les sonnettes !', 'reveil:happy');
};

const ROOMS: Record<number, string[][]> = {
  10: [
    ['Chambre 10. Monsieur Paul.', 'Il dort. Il ronfle comme un tracteur qui monterait une côte.', 'Tu remontes sa couverture jusqu\'au menton. Il sourit sans se réveiller.'],
    ['Monsieur Paul ronfle. Tout va bien.'],
  ],
  12: [
    ['Chambre 12. Madame Rose.', '« Quelle heure est-il, ma petite ? »', '« Trois heures trente-trois, Madame Rose. »', '« Déjà ? Ça passe vite, la nuit, quand vous êtes là. »'],
    ['« Quelle heure est-il, ma petite ? » Toujours trois heures trente-trois, Madame Rose.'],
  ],
  14: [
    ['Chambre 14. Madame Odette.', 'Elle a fait un cauchemar. Tu prends sa main et tu attends que sa respiration ralentisse.', 'Tu sais faire ça. Tu l\'as fait quarante et une nuits de suite, l\'an dernier.'],
    ['Madame Odette dort. Sa main serre encore un peu le bord du drap.'],
  ],
  16: [
    ['Chambre 16. Le lit est fait, les draps bien tirés.', 'Il y avait quelqu\'un, la semaine dernière.', 'Dans ce métier, on apprend à refaire les lits. On n\'apprend jamais vraiment.'],
    ['Chambre 16. Le lit est fait.'],
  ],
};

/** A door of the corridor: a little scene the first time. */
export const roomDoor =
  (n: number): Script =>
  async (d) => {
    const lines = ROOMS[n];
    if (!lines) return;
    const seen = flag(`b_room_${n}`);
    d.set(`b_room_${n}`);
    if (!seen) d.sfx('knock', { vol: 0.5 });
    await d.say(seen ? lines[1]! : lines[0]!);
    if (!seen && n === 12) await d.say('La sonnette de la 14 ! Et celle de la 10 ! Plus vite !', 'reveil:happy');
  };

export const door304: Script = async (d) => {
  await d.say(['Chambre 304.', 'Il n\'y a pas de chambre 304, aux Glycines. Les chambres s\'arrêtent à 18.', 'Au-dessus de la porte, la petite lumière rouge est allumée quand même.']);
  await d.say('Pas celle-là. Celle-là, on ne l\'ouvre pas.', 'reveil:angry');
};

export const sabineTalk: Script = async (d) => {
  if (flag('b_sat')) {
    await d.say('Vas-y. Rentre. Je m\'occupe des sonnettes.', 'sabine');
    return;
  }
  const n = bump('b_sabine');
  if (n === 0) {
    await d.say('Ah, te voilà. Je croyais que tu dormais, dans la salle de pause.', 'sabine');
    await d.say('Je ne dormais pas.', 'maman:neutral');
    await d.say(['Évidemment. Tu ne dors jamais.', 'Tiens. Un bonbon. C\'est tout ce qu\'il me reste, mais il est à la fraise.'], 'sabine');
    await d.give('bonbon');
  } else if (num('b_loop') >= 1) {
    await d.say(['Tu tournes en rond, ma belle. Ça fait trois fois que tu passes devant moi.', 'Assieds-toi cinq minutes. Sur le banc, là. Je te couvre.'], 'sabine');
    await d.say('Rien ne va s\'écrouler. Promis.', 'sabine');
    await d.say('Ne l\'écoute pas. Tout va s\'écrouler.', 'reveil:angry');
  } else if (n === 1) {
    await d.say('Et ton grand, ça va ? Noa, c\'est ça ?', 'sabine');
    await d.say(['Il… grandit.', 'Il ne sort plus de sa chambre. Il ne répond plus au téléphone.'], 'maman:sad');
    await d.say(['Quatorze ans. Le mien ne me parlait que par grognements, à cet âge-là.', '…C\'est pas pareil, je sais. Pardon.'], 'sabine');
  } else {
    await d.say('Les sonnettes, je m\'en occupe aussi, tu sais. On est deux, cette nuit.', 'sabine');
  }
};

export const albertTalk: Script = async (d) => {
  const n = bump('b_albert');
  if (n === 0) {
    await d.say(['Vous non plus, vous ne dormez pas, hein ?', 'Moi, c\'est l\'âge. Le sommeil est parti avant moi.', 'Et vous, c\'est quoi ?'], 'albert');
    await d.say('…Le travail.', 'maman:neutral');
    await d.say(['Le travail. Bien sûr.', 'Ma femme disait que la nuit, c\'est fait pour poser les choses.', 'Ses lunettes, ses soucis… et moi, sur le côté gauche du lit.'], 'albert');
  } else if (n === 1) {
    await d.say(['Le banc, là-bas. Personne ne s\'y assoit jamais.', 'C\'est dommage. C\'est un très bon banc. Je l\'ai essayé.'], 'albert');
  } else if (n === 2) {
    await d.say('Vous avez des enfants, je crois ? Vous en parlez, des fois. Le grand et la petite.', 'albert');
    await d.say('…Oui. Le grand et la petite.', 'maman:sad');
    await d.say('Ça doit être une belle maison, chez vous.', 'albert');
    await d.say('…', 'maman:sad');
  } else {
    await d.say('Bonne nuit, ma petite dame. Enfin… façon de parler.', 'albert');
  }
};

/** The far end of the corridor folds back to its start until Maman sits down. */
export const corridorLoop: Script = async (d) => {
  const n = bump('b_loop') + 1;
  for (let i = 0; i < 2; i++) {
    d.sfx('beep', { pitch: 1.8 + i * 0.3, vol: 0.4 });
    await d.wait(6);
  }
  await d.warp('b_service', 'loop', { sfx: 'none', fade: 10, keepMusic: true });
  if (n === 1) {
    await d.say(['Tu marchais vers la porte de chez toi, au bout du couloir.', 'Tu clignes des yeux, et tu es revenue au début.']);
    await d.say('On ne rentre pas avant la fin du service ! Chambre 12 ! Chambre 14 !', 'reveil:happy');
  } else if (n === 2) {
    await d.say(['Le début du couloir. Encore.', 'Les sonnettes sonnent un peu plus fort.']);
    await d.say('Le service ne finit jamais, tu sais. C\'est ça qui est bien.', 'reveil:neutral');
  } else {
    await d.say(['Le couloir. Encore. Tes pieds te font mal.', 'Il y a un banc, au milieu du couloir. Tu ne t\'y es jamais assise.']);
  }
};

export const bench: Script = async (d) => {
  if (flag('b_sat')) {
    await d.say('Le banc. Tu t\'y es assise cinq minutes. Le monde ne s\'est pas écroulé.');
    return;
  }
  if (!num('b_loop')) {
    await d.say('Un banc. Tu n\'as pas le temps de t\'asseoir.');
    await d.say('Tic, tac !', 'reveil:happy');
    return;
  }
  const r = await d.ask('Le banc. T\'asseoir ? Juste cinq minutes.', ['S\'asseoir', 'Pas le temps'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  await sitDown(d);
};

async function sitDown(d: Director): Promise<void> {
  const b = d.get('banc');
  const bx = tileOf(b.x);
  const by = tileOf(b.y - 2);
  d.show('player', false);
  // One row lower (drawn in front of the bench), lifted back onto the seat.
  d.spawn({ id: 'maman_sit', sprite: 'pose_maman_sit', x: bx - 1, y: by + 1, solid: false, shadow: false }).oy = -12;
  d.sfx('step', { pitch: 0.7 });
  await d.wait(30);
  await d.say(['Tu t\'assois.', 'Tes jambes tremblent un peu. Tu ne l\'avais pas remarqué.']);
  d.spawn({ id: 'reveil', sprite: 'npc_reveil_dark', frames: ['npc_reveil_dark', 'npc_reveil_dark_2'], frameSpeed: 6, x: bx, y: by - 1, float: true, solid: false });
  await alarm(d, 3);
  await d.say(['Qu\'est-ce que tu fais ?', 'On ne s\'assoit pas ! Les sonnettes ! Les cafés ! Les lits !'], 'reveildark:angry');
  d.flash('#ffffff', 6);
  await d.say('{shake}DRIIIIIIIIIIIING !{/shake}', 'reveildark:angry');
  await d.say(['Tu poses la main sur le Réveil.', 'Il sonne contre ta paume. Fort. Puis un peu moins fort.']);
  await d.say('Cinq minutes.', 'maman:neutral');
  await d.say(['Cinq minutes ?!', '…', 'Bon. Cinq minutes. Pas une de plus. Je compte.'], 'reveil:angry');
  d.remove('reveil');
  d.music(null, 3);
  for (const e of world.entities) {
    // Every call light goes out — except the one above the door 304, which doesn't exist here.
    if (e.id === 'appel_304' || (e.sprite !== 'prop_appel_on' && !e.frames?.includes('prop_appel_on'))) continue;
    await d.wait(20);
    e.frames = undefined;
    e.sprite = 'prop_appel';
    e.light = undefined;
    d.sfx('blip', { pitch: 0.6, vol: 0.3 });
  }
  await d.say(['Une sonnette se tait. Puis une autre.', 'Le couloir respire.']);
  await d.wait(60);
  await d.say(['Tu fermes les yeux.', 'Pour la première fois de la nuit, tu entends le silence.']);
  await d.say('Il fait du bruit, le silence. Un bruit de frigo, de chauffage. De quelqu\'un qui dort dans la pièce d\'à côté.');
  await d.wait(40);
  d.sfx('door', { pitch: 0.7 });
  await d.say('Au bout du couloir, une porte grince. La porte de chez toi s\'entrouvre.');
  d.set('b_sat');
  d.remove('maman_sit');
  d.show('player', true);
  d.face('player', 'right');
  d.music('maman', 2);
}

export const homeDoorLocked = ['Ta porte d\'entrée, au bout du couloir.', 'Tu marches vers elle. Tu n\'y arrives jamais.'];

// ---------------------------------------------------------------------------
// b_appart — home, at night
// ---------------------------------------------------------------------------

export const homeEnter: Script = async (d) => {
  if (flag('b_home')) return;
  d.set('b_home');
  await d.say(['Chez toi.', 'Il est trois heures trente-trois, ici aussi. Il est toujours trois heures trente-trois.']);
  await d.say('Dans ta poche, le Réveil s\'agite.');
  await d.say('On avait dit cinq minutes ! Ça fait six. SIX !', 'reveil:angry');
  await d.say('Chut. Tu vas réveiller Noa.', 'maman:neutral');
  await d.say('…', 'reveil:sad');
};

export const coatRack: Script = async (d) => {
  await d.say(['Tu accroches ton manteau.', 'À côté, tout en bas du portemanteau, il y a une petite cape rouge. Tu ne l\'as pas rangée.', 'Tu ne la rangeras pas. Pas encore.']);
};

export const noaShoes: Script = async (d) => {
  await d.say(['Les baskets de Noa. Il a encore grandi.', 'Tu les as remplacées deux fois cette année, sans rien dire. Il n\'a rien dit non plus.']);
};

export const noaDoor: Script = async (d) => {
  if (flag('b_noa_door')) {
    await d.say(['La porte de Noa. La lumière, dessous.', 'Tu restes là un moment. Tu restes toujours là un moment.']);
    return;
  }
  await d.say(['La porte de Noa.', 'Un rai de lumière passe dessous. Il ne dort pas.']);
  const r = await d.ask('Frapper ?', ['Frapper', 'Le laisser'], undefined, { cancelIndex: 1 });
  d.set('b_noa_door', r === 0 ? 'frappe' : 'laisse');
  if (r === 0) {
    d.sfx('knock');
    await d.wait(20);
    d.sfx('knock');
    await d.wait(60);
    await d.say(['Pas de réponse.', 'Derrière la porte, le grésillement d\'une veilleuse. Une petite musique, dans des écouteurs.']);
    await d.say(['Tu poses ta main à plat sur la porte.', 'Comme le soir où il avait de la fièvre, à trois ans, et où tu as dormi par terre à côté de son lit.']);
  } else {
    await d.say(['Tu ne frappes pas. S\'il dort, au moins, il dort.', 'Tu te dis ça tous les matins.']);
  }
};

export const hallClock: Script = async (d) => {
  await d.say(['L\'horloge du couloir : 3 h 33.', 'L\'aiguille des secondes ne bouge plus. Dans ta poche, le Réveil fait semblant de ne rien remarquer.']);
};

export const familyPhoto: Script = async (d) => {
  await d.say('Sur l\'étagère, la photo du parc.');
  await d.image('photo_famille', [
    'C\'est un monsieur du parc qui l\'a prise. Tu lui as dit merci quatre fois.',
    'Mina avait exigé sa couronne. Noa avait exigé de ne pas être sur la photo.',
    'Il est sur la photo. Il sourit. Tu avais oublié qu\'il souriait comme ça.',
  ]);
};

export const sofa: Script = async (d) => {
  await d.say(['Le canapé. Ton côté est creusé.', 'Le jour, tu dors là, quand tu dors. Devant la télé éteinte.']);
};

export const tvOff: Script = async (d) => {
  await d.say('La télé. Dans le lecteur, il y a encore le DVD des vacances. Personne n\'ose l\'enlever.');
};

export const stove: Script = async (d) => {
  await d.say(['Une casserole de pâtes.', 'Tu en fais tous les soirs, avant de partir. Le matin, tu regardes si la casserole a bougé.', 'Elle ne bouge pas souvent. Tu en refais quand même.']);
};

export const minaChair: Script = async (d) => {
  await d.say('La chaise de Mina, avec son coussin pour arriver à la table. Personne ne l\'a enlevé. Ni toi, ni Noa.');
};

export const mamanRoom: Script = async (d) => {
  await d.say(['Ta chambre.', 'Ton lit n\'a pas été défait depuis des mois.']);
};

/** The fridge: the note she writes Noa every night (whatever she starts with, it ends the same). */
export const fridge: Script = async (d) => {
  if (flag('b_note')) {
    await d.say('Ton mot est sur le frigo, sous l\'aimant en forme de fraise.');
    return;
  }
  await d.say(['Le frigo. Les dessins de Mina, l\'aimant en forme de fraise.', 'Tu prends un post-it. Tu écris un mot pour Noa, comme tous les soirs.']);
  const r = await d.ask('Écrire…', ['Mange quelque chose.', 'Pardon.', 'Je t\'aime.']);
  if (r === 0) await d.say(['« Mange quelque chose. »', 'Comme si c\'était ça, le plus important. C\'est un peu ça, le plus important.']);
  else if (r === 1) await d.say(['« Pardon. » Tu le barres.', 'Pardon de quoi ? Il ne comprendrait pas. Ou il comprendrait trop bien.']);
  else await d.say(['« Je t\'aime. »', 'Ça, tu le gardes. Tu le gardes toujours.']);
  await d.say('Tu recommences. Tu barres. Tu recommences. À la fin, il y a tout, en petit :');
  await d.paper(['Noa, mange quelque chose', 's\'il te plaît.', 'Je t\'aime.', '— Maman'], '');
  d.set('b_note', ['mange', 'pardon', 'aime'][r] ?? 'mange');
};

export const basket: Script = async (d) => {
  await d.say(['Le panier de linge, devant la porte de Mina.', 'Tout au fond, il y a un pyjama à étoiles. Tu ne l\'as pas lavé. Il sent encore. Un peu.']);
  const r = await d.ask('Le déplacer ?', ['Le déplacer', 'Pas maintenant'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  const res = await d.battle(['panier'], { intro: '* Le Panier ne veut pas bouger.' });
  if (res.outcome !== 'spare' && res.outcome !== 'win') return;
  d.set('b_panier_done', res.outcome);
  d.remove('panier');
  if (res.outcome === 'spare') await d.say(['Tu as plié ses habits, un par un. Tu n\'as rien lavé.', 'Sur ton oreiller, il y a un pyjama à étoiles, plié en quatre.']);
  else await d.say(['Le panier est vide. Le linge est parti.', 'Tu ne sais pas où est le pyjama. Tu le chercheras longtemps.']);
};

export const minaDoor: Script = async (d) => {
  if (!flag('b_panier_done')) {
    await d.say(['La porte de Mina.', 'Le panier de linge est posé devant. Tu l\'as posé là il y a un an.', 'Tu ne l\'as plus bougé.']);
    return;
  }
  await d.say(['« CHAMBRE DE MINA — DÉFENSE D\'ENTRER (sauf Noa) »', 'En dessous, plus petit, au feutre violet : « et Maman pour les câlins ».']);
  await d.say('Tu n\'es pas entrée depuis un an. Tu fais la poussière devant la porte.');
  const r = await d.ask('Ouvrir ?', ['Ouvrir', 'Pas encore'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Très bonne idée. On a du travail.', 'reveil:happy');
    return;
  }
  d.sfx('door', { pitch: 0.8 });
  await d.say(['Tu tournes la poignée.', 'Derrière la porte de Mina, il n\'y a pas sa chambre.', 'Il y a un couloir d\'hôpital. Évidemment.']);
  await d.warp('b_hopital', 'mina', { sfx: 'whoosh', fade: 40, color: '#ffffff' });
};

// ---------------------------------------------------------------------------
// b_hopital — the paper hospital, a year ago
// ---------------------------------------------------------------------------

export const hospEnter: Script = async (d) => {
  if (flag('b_hosp')) return;
  d.set('b_hosp');
  await d.say(['Le couloir de pédiatrie. Troisième étage.', 'Tout est en papier, ici : les murs, le sol, les néons.', 'Tu connais chaque fissure du plafond. Tu les as comptées, la nuit.']);
  await d.say('Pas ici. Pourquoi ici ? On a du travail, aux Glycines.', 'reveil:angry');
  await d.say('…Tu sais très bien pourquoi ici.', 'maman:sad');
};

export const vending: Script = async (d) => {
  if (flag('b_choco')) {
    await d.say('Le robot n\'a plus de chocolat. Il n\'en a jamais vraiment eu : c\'était de l\'eau marron. Elle adorait ça.');
    return;
  }
  d.set('b_choco');
  await d.say(['Le distributeur du troisième étage.', 'Bouton B4 : chocolat chaud. Mina l\'appelait « le chocolat du robot ».']);
  await d.give('chocolat');
  await d.say('« Un pour moi, un pour toi, un pour Noa. » Elle comptait toujours Noa.');
};

export const wardDrawings: Script = async (d) => {
  await d.say(['Les dessins de Mina, scotchés dans le couloir. Les infirmières les avaient affichés.', 'Elle en faisait un par jour : un pour chaque infirmière, un pour le monsieur du ménage, un pour le robot.']);
  await d.say('Et le soir, un pour Noa. Ceux-là, elle les gardait dans son tiroir.');
};

export const parentsRoom: Script = async (d) => {
  await d.say(['La salle des parents. Un micro-ondes, une bouilloire, une boîte de mouchoirs. Toujours.', 'C\'est là que tu téléphonais. « Il ne veut pas venir. » Tu le disais tout bas, pour qu\'elle n\'entende pas.']);
};

export const room302: Script = async (d) => {
  await d.say(['Chambre 302. Le petit Hugo.', 'Il ronflait comme un dinosaure. Mina l\'imitait pour te faire rire.']);
};

export const wardBench: Script = async (d) => {
  await d.say('Un banc. Tu y as attendu des résultats. Des médecins. Des matins.');
};

/** Mina at 3 a.m., a year ago: she couldn't sleep either. */
export const minaMemory: Script = async (d) => {
  d.face('mina', 'left');
  d.face('player', 'right');
  await d.say(['Chut ! Maman ! C\'est moi.', 'Je peux pas dormir. Le petit Hugo, il ronfle comme un dinosaure.'], 'mina:happy');
  await d.say('…Mina.', 'maman:sad');
  await d.say(['Ben quoi ? T\'as une drôle de tête.', 'On fait la course jusqu\'au robot ? Le dernier arrivé est une chaussette !'], 'mina:happy');
  await d.say('…Non, en fait. Porte-moi. J\'ai les jambes en coton, ce soir.', 'mina:neutral');
  await d.say(['Tu te souviens de cette nuit-là.', 'Tu l\'avais portée jusqu\'au distributeur. Elle ne pesait presque plus rien.', 'Elle s\'était endormie avant le chocolat.']);
  await d.say(['Maman ? Toi aussi, tu devrais dormir.', 'Tu dis que tu dors. Mais t\'as toujours les yeux ouverts.'], 'mina:sad');
  d.set('b_mina_mem');
  const m = d.find('mina');
  if (m) {
    for (let i = 0; i < 20; i++) {
      m.alpha = 1 - i / 20;
      await d.wait(3);
    }
  }
  d.remove('mina');
  await d.say('Au bout du couloir, il n\'y a plus personne. Juste le bruit du robot qui ronronne.');
};

export const nadiaTalk: Script = async (d) => {
  if (flag('b_nadia')) {
    await d.say(['Allez-y. Je reste là.', 'Je garde la lumière du couloir allumée.'], 'nadia');
    return;
  }
  await d.say('Vous êtes revenue.', 'nadia');
  await d.say(['Vous revenez souvent, vous savez. La nuit.', 'Vous vous arrêtez devant cette porte. Et vous n\'entrez jamais.'], 'nadia');
  await d.say('…Nadia.', 'maman:sad');
  await d.say(['Ce soir-là, c\'est moi qui vous ai dit de rentrer dormir.', '« Rentrez, madame. Elle est calme, ce soir. Je reste avec elle. »'], 'nadia');
  await d.say('Je sais.', 'maman:sad');
  await d.say('Vous m\'en voulez ?', 'nadia');
  await d.say('Non. Pas à vous.', 'maman:neutral');
  await d.say('…À qui, alors ?', 'nadia');
  await d.say('…', 'maman:sad');
  await d.say(['Il y a quelqu\'un, là-dedans. Pas votre fille.', 'Quelque chose qui fait tic-tac.'], 'nadia');
  await d.walk('nadia', -2, 0, 0.8);
  d.face('nadia', 'right');
  d.set('b_nadia');
  await d.say('Je reste là. Je reste toujours là, la nuit.', 'nadia');
};

/** The bonus save point: it never overwrites a main run in progress. */
export const savePointHosp: Script = async (d) => {
  d.heal();
  await d.say(['Une veilleuse de couloir, à hauteur d\'enfant.', 'Tu t\'arrêtais toujours devant, en revenant du distributeur. Pour respirer.']);
  const main = hasSave() && !readSave()?.flags.bonus;
  if (main) {
    await d.say('{c:g}(Une partie est déjà en cours : ce rêve-là ne peut pas être sauvegardé.){/c}');
    return;
  }
  const r = await d.ask('Sauvegarder ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.save();
  d.sfx('save');
  await d.say('{c:y}Ta progression est gardée au chaud.{/c}');
};

// ---------------------------------------------------------------------------
// b_304 — the parents' armchair, Le Réveil
// ---------------------------------------------------------------------------

export const room304Enter: Script = async (d) => {
  if (flag('b_boss_done')) return;
  await d.say(['La chambre 304.', 'Rien n\'a bougé. Le lit, les dessins de Mina, la fenêtre aux rideaux verts.']);
  await d.say(['Et le fauteuil des parents. Il se déplie en lit, à peu près.', 'Tu y as dormi quarante et une nuits.']);
  await d.wait(40);
  await d.say('Quarante et une. Pas quarante-deux.');
  await bossFight(d, 1);
};

export const room304Bed: Script = async (d) => {
  await d.say(['Le lit est fait. Les draps sont tirés, bien à plat, bien blancs.', 'Le premier soir, elle avait dit : « Il est trop grand pour moi, ce lit. Viens. »']);
};

export const room304Window: Script = async (d) => {
  await d.say(['La fenêtre aux rideaux verts.', 'Elle posait sa main sur la vitre pour attraper les lumières de la ville. Tu lui disais : « Tu vas avoir froid. »']);
};

export const room304Drawings: Script = async (d) => {
  await d.say(['Un dessin : une maman aux cheveux marron, endormie dans un fauteuil vert.', 'Il y a des « z » partout autour d\'elle. En dessous : « Maman fé dodo (enfin) ».']);
};

export const room304Table: Script = async (d) => {
  await d.say(['La table de chevet. Il n\'y a rien dessus.', 'Cette nuit-là, tu y as posé sa veilleuse. Tu ne l\'as pas branchée.']);
};

async function bossFight(d: Director, from: 1 | 3): Promise<void> {
  const chair = d.get('fauteuil');
  const cx = tileOf(chair.x);
  const cy = tileOf(chair.y - 2);
  d.spawn({ id: 'reveil', sprite: 'npc_reveil', frames: ['npc_reveil', 'npc_reveil_2'], frameSpeed: 20, x: cx, y: cy, float: true, solid: false });
  d.sfx('pop', { pitch: 1.2 });
  await d.say('Le Réveil saute de ta poche et s\'installe dans le fauteuil.');
  if (from === 1) {
    await d.say(['Tu te souviens de moi ?', 'Cette nuit-là, tu m\'as remonté. Tu m\'as réglé sur cinq heures.'], 'reveil:neutral');
    await d.say(['Tu voulais revenir avant qu\'elle se réveille. Avec sa veilleuse.', 'Tu avais tout prévu.'], 'reveil:neutral');
    await d.say(['Je n\'ai jamais sonné.', 'Le téléphone a sonné avant moi. À trois heures trente-trois.'], 'reveil:sad');
    await d.say('…', 'maman:sad');
    await d.say(['Alors maintenant, je sonne. Tout le temps.', 'Pour que tu ne dormes plus jamais.'], 'reveildark:angry');
    await d.say(['Tu as dormi une nuit. Une seule.', 'Et regarde.'], 'reveildark:angry');
  }
  const e = d.get('reveil');
  e.sprite = 'npc_reveil_dark';
  e.frames = ['npc_reveil_dark', 'npc_reveil_dark_2'];
  await alarm(d, 3);
  d.flash('#ffffff', 10);
  const s = newBossState(from);
  try {
    await d.battle(['reveil'], { hooks: bossHooks(s), boss: true, noFlee: true, fixedMusic: true, music: 'reveil', intro: '* Le Réveil se dresse devant toi. Tic. Tac.' });
  } finally {
    audio.tempoScale = s.tempo0;
    audio.setMuffle(1, 0.6);
  }
  d.remove('reveil');
  d.set('b_boss_done');
  await rest(d);
}

// --- The battle ---------------------------------------------------------------------------------------------------

interface BossState {
  phase: 1 | 2 | 3;
  /** Phase 2 turns (buttons turned into DEBOUT). */
  p2: number;
  /** Phase 3 turns. */
  p3: number;
  /** Words of the Réveil written in phase 2. */
  clockWords: number;
  /** Maman's own words written to herself in phase 3. */
  written: string[];
  /** 0..1: how hard she keeps going (DEBOUT, the clock's words): faster music, harder attacks. */
  rush: number;
  tempo0: number;
  t: number;
}

const newBossState = (from: 1 | 3): BossState => ({ phase: from, p2: from === 3 ? 4 : 0, p3: 0, clockWords: 0, written: [], rush: 0, tempo0: audio.tempoScale, t: 0 });

const LABELS = ['FRAPPER', 'ÉCRIRE', 'OBJET', 'ÉPARGNER'];
/** Phase 2: OBJET, then FRAPPER, then ÉPARGNER turn into DEBOUT. */
const P2_ORDER = [2, 0, 3];
/** Words written to herself before DORMIR appears. */
const SLEEP_AT = 4;

const w = (emotion: WordDef['emotion'], ...texts: string[]): WordDef[] => texts.map((text) => ({ text, emotion }));

/** Phase 2: the notebook only has the clock's words. */
const CLOCK_WORDS: WordDef[] = w('neutre', 'debout', 'encore', 'vite', 'ça va', 'tiens bon', 'plus tard');
const CLOCK_WORD_LINES: Record<string, string> = {
  debout: 'Debout. Voilà.',
  encore: 'Encore un café. Encore une nuit.',
  vite: 'Vite, vite. Avant que ça te rattrape.',
  'ça va': '« Ça va. » Tu le dis si bien.',
  'tiens bon': 'Tu tiens. Tu tiens toujours.',
  'plus tard': 'Tu pleureras plus tard. Plus tard, c\'est jamais.',
};

/** Phase 3: what she writes to Noa every night, written for once to herself. */
const MAMAN_WORDS: WordDef[] = [
  { text: 'repose-toi', emotion: 'joie', power: 2 },
  { text: 'pleure', emotion: 'tristesse', power: 2 },
  { text: 'pas ta faute', emotion: 'joie', emotion2: 'tristesse', power: 2 },
  { text: 'pardonne-toi', emotion: 'joie', power: 2 },
  { text: 'je t\'aime', emotion: 'joie', power: 2 },
  { text: 'rentre', emotion: 'joie', power: 2 },
];
/** For each of her words: the clock's objection, then what comes back (narration or a voice). */
const MAMAN_PAIRS: Record<string, { clock: string; lines: Array<[string, string]> }> = {
  'repose-toi': {
    clock: 'Te reposer ? Et qui fera tout ?',
    lines: [
      ['minavoix', '« Maman, tu fais dodo avec moi ? Juste cinq minutes ? »'],
      ['narrator', '* Tu disais toujours oui. Et tu t\'endormais la première.'],
    ],
  },
  pleure: {
    clock: 'Pas devant les enfants. Pas devant personne.',
    lines: [['narrator', '* À l\'enterrement, tu n\'as pas pleuré. Tu as tenu la main de Noa. Tu as dit merci à tout le monde.\n* Ici, il n\'y a personne. Tu peux.']],
  },
  'pas ta faute': {
    clock: 'Tu étais partie dormir. TU DORMAIS.',
    lines: [
      ['maman:sad', 'Je dormais. …Oui. Je dormais.'],
      ['narrator', '* Une nuit. Après quarante et une. Parce qu\'on te l\'avait dit, et parce que tu n\'en pouvais plus.\n* Ce n\'est pas une faute. C\'est une nuit.'],
    ],
  },
  'pardonne-toi': {
    clock: '…Tic.',
    lines: [['narrator', '* « Ce n\'est la faute de personne. » Tu l\'as dit à Noa cent fois.\n* Tu ne l\'as jamais cru pour toi.']],
  },
  "je t'aime": {
    clock: 'Ça, tu l\'écris aux autres. À ton fils. Aux messageries.',
    lines: [['narrator', '* Tu l\'écris à Noa tous les soirs. Même quand il ne répond pas.\n* Pour une fois, c\'est pour toi.']],
  },
  rentre: {
    clock: 'Rentrer ? Le service n\'est pas fini.',
    lines: [['narrator', '* Il y a des pâtes dans le frigo. Un garçon derrière une porte.\n* Une maison, quelque part, qui attend que tu rentres.']],
  },
};
const CRACKS = [
  '* Le Réveil hoquette. Tic… tac.\n* {c:y}Le bouton OBJET revient.{/c}',
  '* Une fissure traverse le cadran.\n* {c:y}Le bouton FRAPPER revient.{/c}',
  '* Les aiguilles ralentissent. Le tic-tac traîne.',
  '* Le cadran se fend de part en part.\n* {c:y}Un bouton change : DORMIR.{/c}',
  '* Le tic-tac est si lent, maintenant, qu\'on dirait une respiration.',
  '* Le Réveil ne fait presque plus de bruit.',
];
const DEBOUT_LINES = ['Voilà. Debout.', 'Encore un peu. Tu tiens.', 'Tu vois ? Pas besoin de dormir.', 'C\'est bien. C\'est très bien.'];

function bossHooks(s: BossState): Partial<BattleHooks> {
  const clock = (b: Battle): EnemyRuntime => b.enemies[0]!;
  const resetNeeds = (b: Battle): void => {
    const e = clock(b);
    e.progress = 0;
    e.step = 0;
    e.stepProgress = 0;
  };
  /** Faster while she keeps going; slower and softer as she writes her words. */
  const tempo = (): void => {
    const n = s.written.length;
    audio.tempoScale = s.tempo0 * (s.phase === 3 ? Math.max(0.6, 1 - n * 0.07) : 1 + s.rush * 0.25);
    audio.setMuffle(s.phase === 3 ? Math.max(0.55, 1 - n * 0.08) : 1, 1);
  };
  const look = (b: Battle, sprite: string, atk: number): void => {
    const e = clock(b);
    e.def = { ...e.def, sprite, atk };
  };

  async function toPhase2(b: Battle): Promise<void> {
    const e = clock(b);
    s.phase = 2;
    await b.bubble([{ e, text: 'Assez parlé. Debout.' }]);
    director.sfx('beep', { pitch: 2.4 });
    fx.flash('#ff4a5a', 16, 0.5);
    fx.shake(3, 40);
    e.flash = 20;
    look(b, 'b_reveil_sonne', 3);
    e.def = {
      ...e.def,
      flavor: ['* DRIIIIIING.', '* La sonnerie te vrille les oreilles.', '* Les sonnettes du couloir répondent à la sienne.', '* Ton cœur bat au rythme du tic-tac.'],
    };
    tempo();
    await b.say('* Le Réveil se met à sonner. Il ne s\'arrête plus.\n* Les boutons tremblent.');
  }

  async function toPhase3(b: Battle): Promise<void> {
    s.phase = 3;
    director.sfx('beep', { pitch: 1, vol: 0.4 });
    await b.say('* Dans la poche de ton gilet, ton téléphone vibre. Une fois.\n* Tu ne le regardes pas. Mais tu sais à qui tu écris, tous les soirs.');
    await b.say('* Tu tournes la page du carnet.\n* Ce sont tes mots. Ceux que tu écris à Noa.');
    await b.say('* Pour une fois, écris-les pour toi.');
    tempo();
  }

  async function debout(b: Battle): Promise<void> {
    const e = clock(b);
    s.rush = Math.min(1, s.rush + 0.25);
    e.agitation = Math.min(3, e.agitation + 1);
    tempo();
    if (s.rush < 1) {
      b.heal(5);
      await b.say('* Tu te relèves. Tu te relèves toujours.\n* Le tic-tac accélère.');
    } else {
      b.hp = Math.max(1, b.hp - 3);
      await b.say('* Tu te relèves encore. Tes jambes tremblent.\n* Tenir, ça coûte. Tu ne l\'avais jamais compté.');
    }
    await b.bubble([{ e, text: DEBOUT_LINES[(s.t++ + s.p2) % DEBOUT_LINES.length]! }]);
  }

  async function sleep(b: Battle): Promise<boolean> {
    const e = clock(b);
    await b.bubble([{ e, text: 'Non… Si tu dors… S\'il arrive quelque chose…' }]);
    b.setText(null);
    await director.say(['Alors on m\'appellera.', 'Et je me réveillerai. C\'est tout.'], 'maman:neutral');
    const r = await director.ask('Dormir ?', ['Dormir', 'Pas encore'], undefined, { cancelIndex: 1 });
    if (r !== 0) {
      await b.say('* Pas encore. Mais bientôt.');
      return true;
    }
    await b.bubble([{ e, text: 'Tic……… …tac.' }]);
    b.end('scripted');
    return true;
  }

  async function writeMine(b: Battle, wd: WordDef): Promise<void> {
    const e = clock(b);
    if (s.written.includes(wd.text)) {
      await b.bubble([{ e, text: 'Tu l\'as déjà écrit…' }]);
      await b.say('* Tu le relis. C\'est toujours vrai.');
      return;
    }
    s.written.push(wd.text);
    const n = s.written.length;
    const pair = MAMAN_PAIRS[wd.text];
    e.agitation = 0;
    e.shake = 16;
    director.sfx('chime', { pitch: 0.8 + n * 0.08 });
    look(b, n >= SLEEP_AT ? 'b_reveil_fele' : 'b_reveil', n >= SLEEP_AT ? 1 : 2);
    tempo();
    if (pair) {
      await b.bubble([{ e, text: pair.clock }]);
      for (const [who, text] of pair.lines) {
        if (who === 'narrator') await b.say(text);
        else {
          b.setText(null);
          await director.say(text, who);
        }
      }
    }
    await b.say(CRACKS[Math.min(n, CRACKS.length) - 1]!);
  }

  return {
    beforeTurn: async (b, turn) => {
      const e = clock(b);
      if (turn === 1) {
        e.def = { ...e.def, atk: 2 };
        tempo();
        b.overlay = (g) => {
          if (s.phase !== 2) return;
          s.t++;
          const a = (0.06 + 0.14 * s.rush) * (0.5 + 0.5 * Math.sin(s.t * 0.25));
          g.globalAlpha = a;
          g.fillStyle = '#ff4a5a';
          g.fillRect(0, 0, 320, 3);
          g.fillRect(0, 177, 320, 3);
          g.fillRect(0, 0, 3, 180);
          g.fillRect(317, 0, 3, 180);
          g.globalAlpha = 1;
        };
        if (s.phase === 3) {
          look(b, 'b_reveil_sonne', 3);
          await toPhase3(b);
          return;
        }
      }
      if (s.phase === 1) {
        if (turn === 1) {
          await director.say(['Tic. Tac. Tu entends ?', 'C\'est le temps qui passe sans toi.'], 'reveil:happy');
        } else if (turn === 2) {
          await director.say(['Chaque minute où tu ne fais rien, quelqu\'un a besoin de toi.', 'Une sonnette. Un café. Un lit à refaire. Un fils.'], 'reveil:neutral');
        } else if (turn === 3) {
          await director.say(['Je ne te veux pas de mal. Je veux que tu sois prête.', 'La prochaine fois.'], 'reveil:neutral');
          await director.say('Il n\'y aura pas de prochaine fois.', 'maman:sad');
          await director.say(['Il y a Noa.', 'Et s\'il t\'appelle, une nuit ? Et si tu dors ?'], 'reveildark:angry');
        } else {
          await toPhase2(b);
        }
      }
      if (s.phase === 2) {
        if (s.p2 >= 4 || (s.clockWords >= 3 && s.p2 >= 3)) {
          await toPhase3(b);
        } else {
          s.p2++;
          const idx = P2_ORDER[s.p2 - 1];
          director.sfx('glitch');
          if (idx !== undefined) await b.say(tf("* Le bouton {0} s'efface.\n* À sa place, il est écrit : DEBOUT.", tr(LABELS[idx]!)));
          else await b.say('* Il ne reste que ÉCRIRE.\n* Et le carnet ne contient plus que ses mots à lui.');
        }
      } else if (s.phase === 3 && turn > 1) {
        s.p3++;
        if (!s.written.length && s.p3 === 2) await b.say('* Écris. Une fois. Rien qu\'une.');
        if (s.written.length >= SLEEP_AT && s.p3 % 2 === 0) await b.say('* Le fauteuil est juste là. Il t\'attend depuis un an.');
      }
    },
    menuLabels: () => {
      if (s.phase === 1) return LABELS;
      if (s.phase === 2) {
        const out = [...LABELS];
        for (let i = 0; i < Math.min(3, s.p2); i++) out[P2_ORDER[i]!] = 'DEBOUT';
        return out;
      }
      const n = s.written.length;
      return [n >= 2 ? 'FRAPPER' : 'DEBOUT', 'ÉCRIRE', n >= 1 ? 'OBJET' : 'DEBOUT', n >= SLEEP_AT ? 'DORMIR' : 'DEBOUT'];
    },
    onMenu: async (b, i) => {
      const label = b.menuLabels[i];
      if (label === 'DEBOUT') {
        await debout(b);
        return true;
      }
      if (label === 'DORMIR') return sleep(b);
      return false;
    },
    words: () => {
      if (s.phase === 1) return null;
      if (s.phase === 2) return CLOCK_WORDS;
      const left = MAMAN_WORDS.filter((x) => !s.written.includes(x.text));
      return left.length ? left : MAMAN_WORDS;
    },
    onWord: async (b, e, wd) => {
      resetNeeds(b);
      if (s.phase === 1) {
        const lines: Record<string, string> = {
          joie: 'Souris. C\'est bien. Ça rassure les autres.',
          tristesse: 'Pas maintenant. Pleurer, ça prend du temps.',
          colere: 'En colère ? Contre qui ? Contre toi ?',
          peur: 'Tu as peur ? Moi aussi. C\'est pour ça que je sonne.',
          neutre: 'Tic. Tac.',
        };
        await b.bubble([{ e, text: lines[wd.emotion] ?? lines.neutre! }]);
        await b.say('* Les mots glissent sur le verre du cadran.');
        return true;
      }
      if (s.phase === 2) {
        s.clockWords++;
        s.rush = Math.min(1, s.rush + 0.15);
        tempo();
        await b.bubble([{ e, text: CLOCK_WORD_LINES[wd.text] ?? 'Tic. Tac.' }]);
        await b.say(tf("* Tu écris « {0} ». Tu l'écris tous les jours.", tr(wd.text)));
        return true;
      }
      await writeMine(b, wd);
      return true;
    },
    onFight: async (b, e) => {
      await b.say('* Tu tapes sur le bouton, au-dessus du Réveil.\n* Le geste de tous les matins.');
      e.shake = 20;
      director.sfx('hit');
      if (s.phase === 3 && s.written.length >= 2) {
        await b.bubble([{ e, text: '…Ça ne sert à rien, tu sais. Ça n\'a jamais servi à rien.' }]);
        return true;
      }
      await b.say('* Silence. Cinq minutes de silence…');
      director.sfx('beep', { pitch: 2.4 });
      fx.shake(2, 20);
      await b.bubble([{ e, text: 'DRIIIIING !' }]);
      await b.say('* On n\'arrête pas ce réveil-là en tapant dessus.');
      return true;
    },
    onSpare: async (b, e) => {
      await b.bubble([{ e, text: 'M\'épargner ? Mais c\'est moi qui te protège.' }]);
      return true;
    },
    pattern: (b, turn) => {
      if (s.phase === 1) return turn % 2 ? 'clock_hands' : 'tick_rain';
      if (s.phase === 2) return turn % 2 ? 'alarm_ring' : 'clock_hands';
      const n = s.written.length;
      void b;
      return n >= SLEEP_AT ? 'calm' : n >= 2 ? 'tick_rain' : 'clock_hands';
    },
    talk: (_b, turn) => {
      if (s.phase === 2) return ['DEBOUT.', 'DRIIIING !', 'Il est l\'heure !', 'Plus vite !'][turn % 4]!;
      if (s.phase === 3 && s.written.length >= SLEEP_AT) return 'Tic……… tac.';
      return null;
    },
    onPlayerDeath: async (b) => {
      b.hp = Math.ceil(b.maxHp / 2);
      director.sfx('beep', { pitch: 2.4 });
      await b.say('* Tu tombes. DRIIIING.\n* Tu te relèves. Tu te relèves toujours.');
      if (s.phase >= 2) await b.bubble([{ e: clock(b), text: 'Tu vois ? Tu ne tombes jamais. Grâce à moi.' }]);
      return true;
    },
  };
}

// --- After the battle: she sleeps, Mina watches over her ----------------------------------------------------------

async function rest(d: Director): Promise<void> {
  d.music('maman', 2);
  await d.say(['Tu poses le Réveil sur la table de chevet, face contre le bois.', 'Il fait tic.', 'Puis il ne fait plus rien.']);
  await d.wait(40);
  const chair = d.get('fauteuil');
  const cx = tileOf(chair.x);
  const cy = tileOf(chair.y - 2);
  d.face('player', 'up');
  await d.say(['Tu t\'assois dans le fauteuil. Il grince, comme avant.', 'Tu fermes les yeux.']);
  await d.fadeOut(60, '#0b0710');
  d.show('player', false);
  chair.sprite = 'pose_maman_fauteuil';
  await d.wait(60);
  await d.narrate('Tu dors.');
  d.spawn({ id: 'mina', char: 'mina', x: cx + 1, y: cy + 1, dir: 'left', light: { r: 40, color: '#ffe991', flicker: true, dy: -10 } });
  world.extraDarkness = 0.15;
  await d.fadeIn(90);
  await d.wait(40);
  await d.say('Chuuut. Elle dort. Enfin.', 'mina:happy');
  await d.say('T\'étais pas là, le dernier soir. Je sais.', 'mina:sad');
  await d.say(['Mais t\'étais là tous les autres soirs.', 'Quarante et un. Je les ai comptés, moi aussi.'], 'mina:happy');
  await d.say(['Nadia m\'a tenu la main. Elle m\'a raconté le mouton qui voulait pas dormir.', 'Elle le raconte moins bien que toi. Elle fait pas les voix.'], 'mina:neutral');
  await d.say(['J\'avais un peu peur. Mais la porte était entrouverte.', 'Il y avait de la lumière.'], 'mina:neutral');
  await d.say(['Et puis je voulais que tu dormes, Maman. Tu dormais jamais.', 'T\'avais des valises sous les yeux. Des énormes valises.'], 'mina:happy');
  await d.say(['Ma veilleuse, tu l\'as rapportée à la maison. Avec le fil tout enroulé.', 'Un jour, quelqu\'un va la rebrancher. Tu verras.'], 'mina:neutral');
  await d.say(['Et Noa…', 'Il a peur, Maman. Comme toi. Vous faites pareil, tous les deux : vous fermez les portes.'], 'mina:sad');
  await d.say('Frappe quand même. Même s\'il répond pas. Surtout s\'il répond pas.', 'mina:neutral');
  await d.wait(30);
  await d.say(['Une petite main remonte la couverture jusqu\'à ton menton.', 'Quelqu\'un éteint la grande lumière et laisse la petite.']);
  await d.say('{wave}Dors. Moi, je veille.{/wave}', 'mina:happy');
  await d.wait(40);
  await d.fadeOut(160, '#fff3e0');
  d.remove('mina');
  await dawn(d);
}

// ---------------------------------------------------------------------------
// Dawn — « Je rentre. »
// ---------------------------------------------------------------------------

/** The dawn illustration (src/data/illustrations-bonus.ts). */
const DAWN = 'maman_aube';

/** Maman's side of the thread (her messages on the right), up to the voicemail of 3:33. */
function mamanThread(): PhoneMessage[] {
  const me = (text: string, status?: string): PhoneMessage => ({ from: 'me', text, status });
  return [
    { from: 'info', text: 'Hier' },
    me('Noa ?'),
    me('Tu dors ?'),
    me('Je rentre tard. Il y a des pâtes dans le frigo. Je t\'aime.'),
    { from: 'info', text: 'Aujourd\'hui' },
    me('Tu as mangé ?'),
    { from: 'info', text: '3:33' },
    me('Message vocal · 0:41', 'Distribué'),
  ];
}

/** The dawn illustration kept on screen under the dialogue and the phone (the world is gone by then). */
class Backdrop implements Scene {
  private t = 0;
  /** 0..1: darkens the picture while the phone is up. */
  dim = 0;
  constructor(private key: string) {}
  update(): void {
    this.t++;
  }
  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0b0710';
    g.fillRect(0, 0, W, H);
    ILLUSTRATIONS[this.key]?.(g, this.t);
    if (this.dim > 0) {
      g.globalAlpha = this.dim;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
  }
}

async function dawn(d: Director): Promise<void> {
  d.music(null, 2);
  game.remove(world);
  await d.fadeOut(1, '#000000');
  await d.wait(40);
  await d.narrate('Cinq heures cinquante.');
  d.music('maman', 2);
  // Remembered for the title-screen gallery, like any illustration shown with d.image().
  if (!G.meta.seen.includes(DAWN)) {
    G.meta.seen.push(DAWN);
    writeMeta(G.meta);
  }
  const back = new Backdrop(DAWN);
  game.push(back);
  await d.fadeIn(90);
  const paper = { style: 'paper' as const };
  await d.say(['Tu as dormi. Deux heures, d\'une traite.', 'Quelqu\'un a posé une couverture sur tes épaules. Le Réveil est face contre la table.'], undefined, paper);
  await d.say(['Je t\'ai laissée dormir. Tu ronflais un peu.', 'Les sonnettes, j\'ai fait. Tout le monde est vivant. Toi aussi, on dirait.'], 'sabine');
  await d.say('…Merci, Sabine.', 'maman:happy');
  await d.say('Dehors, le ciel pâlit. Juste un peu. Tu prends ton téléphone.', undefined, paper);
  back.dim = 0.45;
  const ph = PhoneScene.open('Noa', '5:52', mamanThread());
  await d.wait(30);
  const drafts: Array<PhoneReply & { id: string }> = [
    { id: 'pardon', text: 'Pardon.', emotion: 'tristesse' },
    { id: 'dors', text: 'Tu dors ?', emotion: 'peur' },
    { id: 'rentre', text: 'Je rentre.', emotion: 'joie' },
  ];
  const left = [...drafts];
  for (;;) {
    const i = await ph.choose('Écrire à Noa', left);
    const pick = left[i]!;
    if (pick.id === 'rentre') break;
    await d.say(pick.id === 'pardon' ? ['Tu l\'écris. Tu l\'effaces.', 'Pas comme ça. Pas par message.'] : ['Tu l\'écris. Tu l\'effaces.', 'Tu lui as déjà demandé hier. Et avant-hier.']);
    left.splice(i, 1);
  }
  ph.add({ from: 'me', text: 'Je rentre.', status: 'Distribué' });
  await d.wait(110);
  ph.status('Lu');
  audio.sfx('chime', { pitch: 1.2 });
  await d.wait(40);
  await d.say(['« Lu. »', 'Il ne dort pas. Il a lu.']);
  await ph.waitKey();
  await ph.close();
  back.dim = 0;
  await d.say(['Tu enfiles ton manteau.', 'Tu laisses le réveil sur la table.'], undefined, paper);
  d.music(null, 3);
  await d.fadeOut(90);
  game.remove(back);
  fx.setFade(0);
  await d.wait(60);
  d.sfx('step', { pitch: 0.7 });
  await d.wait(24);
  d.sfx('door', { pitch: 0.8 });
  await d.wait(50);
  await d.narrate('Des clés dans la serrure. La porte d\'entrée.');
  await d.wait(30);
  await d.say('Noa ? Tu es réveillé ?', 'maman:neutral');
  await d.wait(60);
  await finishBonus(d);
}

/** End of the bonus run: remembered, credits, title. (Not finishGame: no ending is recorded.) */
async function finishBonus(d: Director): Promise<void> {
  G.meta.bonusDone = true;
  writeMeta(G.meta);
  if (hasSave() && readSave()?.flags.bonus) deleteSave();
  setPageTitle(null);
  fx.glitch = 0;
  fx.setBars(false);
  await d.fadeOut(90);
  game.remove(world);
  await CreditsScene.play();
  await flow.toTitle();
}

/** Mina's lines by map id (none: Mina does not follow Maman). */
export const MINA_LINES: Record<string, string[]> = {};

// ---------------------------------------------------------------------------
// Debug entry points (?debug=script&name=…)
// ---------------------------------------------------------------------------

function debugSetup(flags: string[]): void {
  setupMaman();
  for (const k of flags) G.state.flags[k] = true;
}

export const DEBUG: Record<string, Script> = {
  bonus_start: start,
  bonus_service: async (d) => {
    debugSetup(['b_intro']);
    d.load('b_service', 'start');
    await d.fadeIn(10);
  },
  bonus_banc: async (d) => {
    debugSetup(['b_intro', 'b_corridor']);
    G.state.flags.b_loop = 1;
    d.load('b_service', 'banc');
    await d.fadeIn(10);
    await sitDown(d);
  },
  bonus_appart: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat']);
    d.load('b_appart', 'entree');
    await d.fadeIn(10);
  },
  bonus_panier: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat', 'b_home']);
    d.load('b_appart', 'panier');
    await d.fadeIn(10);
    await basket(d);
  },
  bonus_hopital: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat', 'b_home', 'b_panier_done']);
    d.load('b_hopital', 'mina');
    await d.fadeIn(10);
  },
  bonus_nadia: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat', 'b_home', 'b_panier_done', 'b_hosp', 'b_mina_mem']);
    d.load('b_hopital', 'nadia');
    await d.fadeIn(10);
    await nadiaTalk(d);
  },
  bonus_boss: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat', 'b_home', 'b_panier_done', 'b_hosp', 'b_mina_mem', 'b_nadia']);
    d.load('b_304', 'porte');
    await d.fadeIn(10);
  },
  bonus_boss3: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat', 'b_home', 'b_panier_done', 'b_hosp', 'b_mina_mem', 'b_nadia', 'b_boss_done']);
    d.load('b_304', 'porte');
    await d.fadeIn(10);
    await bossFight(d, 3);
  },
  bonus_end: async (d) => {
    debugSetup(['b_intro', 'b_corridor', 'b_sat', 'b_home', 'b_panier_done', 'b_hosp', 'b_mina_mem', 'b_nadia', 'b_boss_done']);
    d.load('b_304', 'porte');
    await d.fadeIn(10);
    await rest(d);
  },
  bonus_aube: async (d) => {
    debugSetup(['b_boss_done']);
    d.load('b_304', 'porte');
    await dawn(d);
  },
};

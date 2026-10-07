import { input } from '../../engine/input';
import { fx } from '../../engine/fx';
import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G, maxHp, writeMeta } from '../state';
import { isLateNight, setPageTitle } from '../meta';
import { composePoem } from '../scenes/poem';
import { PhoneScene, type PhoneMessage, type PhoneReply } from '../scenes/phone';
import { enterDream } from './common';
import { epilogue, EPILOGUE_DEBUG } from './epilogue';

/**
 * Real world thread: prologue, interlude 1 (« Le frigo »), interlude 2 (« La porte ») and the finale (« Le carnet »).
 * The same rooms are reused; G.state.flags.interlude says which moment we are in:
 *   0 = prologue, 1 = after chapter 1, 2 = after chapter 2, 3 = finale (dawn route).
 */

const phase = (): number => Number(G.state.flags.interlude ?? 0);
const flag = (k: string): boolean => !!G.state.flags[k];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Noa lies in bed (hidden player, sleeping bed sprite). */
function inBed(d: Director, sleeping: boolean): void {
  const bed = d.find('bed');
  if (bed) bed.sprite = sleeping ? 'prop_bed_sleeping' : 'prop_bed';
  d.show('player', !sleeping);
  if (!sleeping) d.face('player', 'down');
}

async function controlsHint(d: Director): Promise<void> {
  const touch = input.lastDevice === 'touch' || ('ontouchstart' in window && input.lastDevice !== 'keyboard');
  await d.say(
    touch
      ? '{c:g}(Croix pour marcher · A pour examiner · B pour courir · ☰ pour le menu){/c}'
      : '{c:g}(Flèches ou ZQSD pour marcher · Entrée pour examiner · Maj pour courir · C pour le menu){/c}',
  );
}

// ---------------------------------------------------------------------------
// Maman's messages — Noa may answer (one short reply per moment), and she remembers it.
// Flags: p_reply (prologue), i1_reply (interlude 1), i2_reply (interlude 2) = reply id, 'rien' = chose silence.
// ---------------------------------------------------------------------------

interface ReplyDef extends PhoneReply {
  id: string;
  /** Maman's answer, message by message ([] = she starts typing, then gives up). */
  answer?: string[];
  /** Narration once the phone is put down. */
  after?: string[];
  /** Only offered when this returns true. */
  when?: () => boolean;
}

const REPLY_FLAGS = ['p_reply', 'i1_reply', 'i2_reply'] as const;
const PHONE_CLOCK = ['23:52', '14:06', '3:33', '5:52'];
const SILENCE: ReplyDef = { id: 'rien', text: 'Ne rien répondre', after: ['Tu ne réponds pas. Tu ne sais jamais quoi répondre.'] };

const REPLIES: ReplyDef[][] = [
  // Prologue: « Je rentre tard. Il y a des pâtes dans le frigo. Je t'aime. »
  [
    { id: 'ok', text: 'ok', emotion: 'neutre', answer: ['Merci de répondre.', 'Dors bien, mon grand.'], after: ['Deux lettres. Elle a répondu en dix secondes.', 'Comme si elle attendait, le téléphone dans la main.'] },
    { id: 'aime', text: 'Moi aussi.', emotion: 'joie', answer: ['♥', 'Je vais le relire toute la nuit.'], after: ['Tu poses le téléphone, écran contre le bureau.', 'Tu as chaud aux joues. C\'est idiot.'] },
    { id: 'dormir', text: 'J\'arrive pas à dormir.', emotion: 'peur', answer: ['Moi non plus, je crois.', 'Laisse la veilleuse allumée. Je rentre vite.'], after: ['Tu regardes la veilleuse.', 'Elle grésille. Mais elle est allumée.'] },
    { id: 'laisse', text: 'Laisse-moi.', emotion: 'colere', answer: [], after: ['Elle a commencé à écrire. Plusieurs fois.', 'Puis plus rien.'] },
  ],
  // Interlude 1: « Tu as mangé ? »
  [
    { id: 'oui', text: 'Oui.', emotion: 'neutre', answer: ['Bravo. ♥'], after: [] },
    { id: 'sale', text: 'C\'était trop salé.', emotion: 'joie', answer: ['Pardon !!', 'J\'avais la tête ailleurs.', 'Mais tu as mangé. Merci.'], after: ['Tu souris.', 'Ça fait bizarre, sur ton visage.'], when: () => flag('i1_ate') },
    { id: 'essayer', text: 'Je vais essayer.', emotion: 'joie', answer: ['Merci, mon grand.', 'C\'est déjà beaucoup.'], after: ['Les pâtes sont dans la cuisine. Tu le sais.'], when: () => !flag('i1_ate') },
    { id: 'faim', text: 'Pas faim.', emotion: 'tristesse', answer: ['Même un yaourt.', 'Pour me faire plaisir ?'], after: [] },
    { id: 'arrete', text: 'Arrête de demander.', emotion: 'colere', answer: ['Pardon.', 'Je m\'inquiète, c\'est tout.'], after: ['Tu regrettes un peu.', 'Un peu seulement.'] },
  ],
  // Interlude 2, after the voicemail: « On ira la voir ensemble, d'accord ? » — 3h33, nobody answers.
  [
    { id: 'accord', text: 'D\'accord.', emotion: 'joie', after: ['Ton cœur bat très fort.', 'Tu viens de promettre quelque chose. Tu crois.'] },
    { id: 'peux', text: 'Je peux pas.', emotion: 'peur', after: ['C\'est la vérité.', 'C\'est la première fois que tu la lui dis.'] },
    { id: 'pardon', text: 'Pardon.', emotion: 'tristesse', after: ['Elle ne comprendra pas.', 'Pas encore.'] },
    { id: 'pourquoi', text: 'Pourquoi faire ?', emotion: 'colere', after: ['Tu le regrettes à la seconde où tu appuies sur « envoyer ».'] },
  ],
];

const replyOf = (n: number): string | undefined => {
  const v = G.state.flags[REPLY_FLAGS[n]!];
  return typeof v === 'string' ? v : undefined;
};
/** True when Noa actually sent something at moment n (not silence, not unread). */
const answered = (n: number): boolean => {
  const r = replyOf(n);
  return !!r && r !== 'rien';
};
const replyDef = (n: number, id: string | undefined): ReplyDef | undefined => REPLIES[n]?.find((r) => r.id === id);
/** Every reply Noa sent (ids). */
const sentReplies = (): string[] => [0, 1, 2].filter(answered).map((n) => replyOf(n)!);
const ANGRY = ['laisse', 'arrete', 'pourquoi'];

/** What Maman wrote at moment n (it depends on what Noa answered before). */
function mamanWrote(n: number): PhoneMessage[] {
  const them = (text: string): PhoneMessage => ({ from: 'them', text });
  if (n === 0) return [{ from: 'info', text: '14 messages non lus' }, them('Noa ?'), them('Tu dors ?'), them('Je rentre tard. Il y a des pâtes dans le frigo. Je t\'aime.')];
  if (n === 1) {
    const before: Record<string, string> = {
      ok: 'Merci pour ton « ok », hier.',
      aime: 'J\'ai relu ton message dix fois.',
      dormir: 'Tu as réussi à dormir un peu ?',
      laisse: 'Je te laisse tranquille. Promis. Juste une question :',
    };
    const p = replyOf(0);
    return [{ from: 'info', text: 'Aujourd\'hui' }, ...(p && before[p] ? [them(before[p])] : []), them('Tu as mangé ?')];
  }
  if (n === 2) return [{ from: 'info', text: '3:33' }, { from: 'info', text: 'Appel manqué' }, them('Message vocal · 0:41')];
  return [{ from: 'info', text: '5:52' }, them('Je rentre.')];
}

/** Noa's reply at moment n and Maman's answer, as they appear in the thread afterwards. */
function repliedAt(n: number, upTo: number): PhoneMessage[] {
  const def = answered(n) ? replyDef(n, replyOf(n)) : undefined;
  if (!def) return [];
  const status = n === 2 && upTo < 3 ? 'Distribué' : 'Lu';
  return [{ from: 'me', text: def.text, status }, ...(def.answer ?? []).map((text): PhoneMessage => ({ from: 'them', text }))];
}

function thread(upTo: number, withReply: boolean): PhoneMessage[] {
  const out: PhoneMessage[] = [];
  for (let n = 0; n <= upTo; n++) {
    out.push(...mamanWrote(n));
    if (n < upTo || withReply) out.push(...repliedAt(n, upTo));
  }
  return out;
}

/** Opens the phone at moment n: Noa may answer (once — or again later if he chose silence). */
async function answerMaman(d: Director, n: 0 | 1 | 2): Promise<void> {
  const prev = replyOf(n);
  const done = !!prev && prev !== 'rien';
  const ph = PhoneScene.open('Maman', PHONE_CLOCK[n]!, thread(n, done));
  if (done) {
    await ph.waitKey();
    await ph.close();
    return;
  }
  await d.wait(24);
  const options = [...REPLIES[n]!.filter((r) => !r.when || r.when()), SILENCE];
  const pick = options[await ph.choose('Répondre :', options)]!;
  d.set(REPLY_FLAGS[n], pick.id);
  if (pick.id === 'rien') {
    ph.sleep();
    await d.wait(70);
    await ph.close();
  } else {
    ph.add({ from: 'me', text: pick.text, status: 'Envoi…' });
    await d.wait(40);
    ph.status('Distribué');
    await d.wait(50);
    if (n < 2) {
      ph.status('Lu');
      await d.wait(30);
      const answer = pick.answer ?? [];
      if (!answer.length) {
        // She starts writing, stops, starts again… and gives up.
        for (const f of [80, 50, 60]) {
          ph.typing(true);
          await d.wait(f);
          ph.typing(false);
          await d.wait(45);
        }
      }
      for (const text of answer) {
        ph.typing(true);
        await d.wait(Math.min(110, 40 + text.length * 2));
        ph.add({ from: 'them', text });
        await d.wait(30);
      }
    }
    await ph.waitKey();
    await ph.close();
  }
  if (pick.after?.length) await d.say(pick.after);
}

// ---------------------------------------------------------------------------
// Prologue — « Il fait nuit »
// ---------------------------------------------------------------------------

export async function prologue(d: Director): Promise<void> {
  d.load('chambre', 'bed');
  inBed(d, true);
  d.music(null);
  await d.wait(40);
  await d.narrate('Il fait nuit.');
  await d.wait(30);
  await d.narrate('Il fait toujours nuit.');
  d.ambience('rain');
  await d.fadeIn(120);
  await d.wait(50);
  await d.say(['La pluie tape contre la vitre.', 'Tu n\'arrives pas à dormir. Ça fait longtemps que tu n\'arrives plus à dormir.']);
  await d.wait(20);
  d.sfx('step', { pitch: 0.6 });
  inBed(d, false);
  await d.wait(30);
  d.music('room');
  await controlsHint(d);
}

export const chambreEnter: Script = async (d) => {
  const p = phase();
  if (p === 0) {
    world.extraDarkness = 0.22;
    d.ambience('rain');
  } else if (p === 1) {
    world.extraDarkness = -0.08;
    d.ambience('rain');
    d.music('interlude');
  } else if (p === 2) {
    world.extraDarkness = 0.36;
    d.ambience('hum');
    d.music(null);
  } else {
    world.extraDarkness = -0.22;
    d.ambience('none');
    d.music('room_quiet');
  }
};

export const bed: Script = async (d) => {
  const p = phase();
  if (p === 0) {
    if (!flag('p_dodo')) {
      await d.say(['Ton lit. Les draps sont froids.', 'Sur l\'oreiller, quelque chose te regarde.']);
      await prologueDodo(d);
      return;
    }
    const r = await d.ask('Glisser sous le lit ?', ['Oui', 'Non'], undefined, { cancelIndex: 1 });
    if (r !== 0) {
      await d.say('Pas encore.', 'dodo:neutral');
      return;
    }
    await d.say(['Ferme les yeux.', 'Je te tiens.'], 'dodo:happy');
    d.sfx('whoosh', { pitch: 0.5 });
    await enterDream(d, 1);
    return;
  }
  if (p === 1) {
    if (!flag('i1_note')) {
      await d.say('Dodo est assis sur l\'oreiller. Une peluche. Juste une peluche.');
      await d.say(['Tu n\'as pas sommeil. Pas encore.', 'Le ventre vide, et la tête pleine.']);
      return;
    }
    const r = await d.ask('Te recoucher ?', ['Dormir', 'Pas encore'], undefined, { cancelIndex: 1 });
    if (r !== 0) return;
    await d.say(['Tu remontes la couette jusqu\'au menton.', 'Quelque part, Mina t\'attend.']);
    await enterDream(d, 2);
    return;
  }
  if (p === 2) {
    if (!flag('i2_voicemail') || !flag('i2_tv') || !flag('i2_dodo_back')) {
      await d.say(['Tu n\'arrives pas à fermer les yeux.', 'Quelque chose ne va pas, de l\'autre côté de la porte.']);
      return;
    }
    await interlude2Dodo(d);
    return;
  }
  await d.say(['Dodo est sur ton lit, la tête tournée vers la porte.', 'Tu n\'as plus sommeil. Pour la première fois depuis longtemps.']);
};

export const nightlight: Script = async (d) => {
  const p = phase();
  if (p === 2) {
    await d.say(['La veilleuse ne grésille plus.', 'Elle brille très fort, au contraire. Trop fort.']);
    await d.savePoint('Tu fixes la petite lune jusqu\'à avoir des taches dans les yeux.');
    return;
  }
  if (p === 3) {
    await d.savePoint('La veilleuse de Mina. Dehors, le ciel pâlit. Elle n\'a presque plus besoin de briller.');
    return;
  }
  await d.savePoint(
    p === 0
      ? 'La veilleuse de Mina grésille. Sa petite lumière en forme de lune te tient compagnie.'
      : 'La veilleuse. Même le jour, tu ne l\'éteins pas.',
  );
};

async function prologueDodo(d: Director): Promise<void> {
  await d.say(['Dodo. Le mouton en peluche de Mina.', 'Elle te l\'a donné, avant. « Pour quand tu fais des cauchemars. »']);
  await d.wait(30);
  d.sfx('chime', { pitch: 0.8 });
  d.show('dodo_plush', false);
  d.spawn({ id: 'dodo', sprite: 'npc_dodo', frames: ['npc_dodo', 'npc_dodo_2'], frameSpeed: 28, x: 1, y: 4, float: true, shadow: false, solid: false });
  await d.emote('player', '!');
  await d.say('Tu ne dors pas ?', 'dodo:happy');
  await d.say('…', 'noa:surprised');
  await d.say(['Ne fais pas cette tête-là. C\'est moi, Dodo !', 'Mina m\'a donné à toi. Elle a dit : « Il veillera sur toi. »', 'Alors je veille.'], 'dodo:happy');
  await d.wait(30);
  await d.say('{p:20}…{p:20} Et toi ?', 'dodo:neutral');
  await d.say(['Pas Noa. L\'autre.', 'Celui ou celle qui tient sa main, de l\'autre côté de l\'écran.'], 'dodo:neutral');
  await d.wait(20);
  await d.say('Ah. {wave}{player}{/wave}. C\'est joli, {player}.', 'dodo:happy');
  if (G.meta.endings.length) await d.say(['On s\'est déjà dit bonne nuit, toi et moi.', 'Tu te souviens ? Moi, je me souviens de tout.'], 'dodo:creepy');
  else if (G.meta.newGames > 1) await d.say('Tu es revenu·e. Je savais que tu reviendrais.', 'dodo:happy');
  if (isLateNight()) await d.say('Il est {time}. Toi non plus, tu ne dors pas ?', 'dodo:neutral');
  await d.say(
    [
      'Noa n\'arrive plus à dormir. Depuis longtemps.',
      'Mais moi, je connais un endroit.',
      'Un endroit tout doux, où il ne pleut que du coton. Où personne n\'est jamais triste.',
    ],
    'dodo:happy',
  );
  await d.say('{wave}Regarde sous le lit.{/wave}', 'dodo:happy');
  d.set('p_dodo');
}

export const dodoFloating: Script = async (d) => {
  await d.say(['Sous le lit, {player}.', 'Fais-moi confiance.'], 'dodo:happy');
};

export const desk: Script = async (d) => {
  const p = phase();
  if (p === 3) {
    await d.say(['Ton bureau. Tes cahiers.', 'Peut-être que tu les rouvriras. Un jour. Pas tout de suite.']);
    return;
  }
  await d.say(['Ton bureau. Des cahiers jamais ouverts depuis la rentrée.', 'Le collège a appelé, une fois. Maman a parlé longtemps, à voix basse, dans la cuisine.']);
};

export const phone: Script = async (d) => {
  const p = phase();
  if (p === 0) {
    if (!replyOf(0)) await d.say('Ton téléphone. 14 messages non lus de « Maman ».');
    await answerMaman(d, 0);
  } else if (p === 1) {
    if (!replyOf(1)) await d.say('Un nouveau message de « Maman ».');
    await answerMaman(d, 1);
  } else if (p === 2) {
    if (flag('i2_voicemail')) {
      await answerMaman(d, 2);
      return;
    }
    d.sfx('beep');
    await d.say('1 message vocal. Tu appuies.');
    const sent = sentReplies();
    if (!sent.length) await d.say(['Noa… c\'est Maman.', 'Je… je sais que tu ne décroches pas. C\'est pas grave.'], 'maman:sad');
    else if (sent.every((r) => ANGRY.includes(r))) await d.say(['Noa… c\'est Maman.', 'Je sais que tu m\'en veux. Tu as le droit, tu sais.'], 'maman:sad');
    else await d.say(['Noa… c\'est Maman.', 'Tes petits messages… je les garde tous. Tous.'], 'maman:sad');
    await d.say(['Ça fait un an demain.', 'Je rentre ce soir. Plus tôt. J\'ai demandé.'], 'maman:sad');
    await d.say(['On ira la voir ensemble, d\'accord ?', 'Je t\'aime, mon grand.'], 'maman:sad');
    await d.wait(30);
    await d.say('…', 'noa:sad');
    d.set('i2_voicemail');
    await answerMaman(d, 2);
  } else {
    await d.say('Un message de « Maman », il y a cinq minutes.');
    const ph = PhoneScene.open('Maman', PHONE_CLOCK[3]!, thread(3, true));
    await ph.waitKey();
    await ph.close();
    if (!sentReplies().length) await d.say(['Tu fais défiler la conversation. Des dizaines de messages.', 'Pas une seule réponse.']);
    else await d.say(['Tu fais défiler la conversation.', 'Tes réponses sont toutes petites, à côté des siennes. Mais elles sont là.']);
  }
};

export const shelf: Script = async (d) => {
  await d.say(['Tes livres. Des BD. Un atlas des étoiles.', 'Et une boîte à chaussures pleine de dessins de Mina. Tu ne l\'ouvres pas.']);
};

export const clock: Script = async (d) => {
  const p = phase();
  if (p === 2) await d.say(['3h33.', 'L\'aiguille des secondes ne bouge plus.']);
  else if (p === 3) await d.say(['5h58.', 'Le jour se lève dans deux minutes.']);
  else await d.say('Tic. Tac. Tic. Tac.');
};

export const closet: Script = async (d) => {
  if (phase() === 3) {
    await d.say(['Ton armoire. Fermée.', 'Il n\'y a pas de monstre dedans. Il n\'y en a jamais eu. Juste des pulls.']);
    return;
  }
  await d.say(['Ton armoire. Tu n\'aimes pas la laisser ouverte la nuit.', 'Mina disait qu\'un monstre vivait dedans. Tu lui répondais que c\'était n\'importe quoi.']);
  if (G.state.flags.c1_placard_spared) await d.say('Tu espères qu\'il va bien, le monstre.');
};

export const photo: Script = async (d) => {
  if (phase() < 3) {
    await d.say(['Un cadre photo, posé face contre le sol.', 'Tu ne le retournes pas.']);
    return;
  }
  await d.say('Un cadre photo, face contre le sol. Tu le retournes.');
  await d.image('photo_famille', ['Maman, toi, et Mina avec sa couronne en papier.', 'Tu avais oublié que tu souriais comme ça.']);
};

// ---------------------------------------------------------------------------
// Interlude 1 — « Le frigo »
// ---------------------------------------------------------------------------

export async function interlude1(d: Director): Promise<void> {
  d.load('chambre', 'bed');
  inBed(d, true);
  await d.wait(30);
  await d.narrate('Tu te réveilles.');
  await d.fadeIn(80);
  await d.wait(30);
  await d.say(['Le jour, enfin… ce qui y ressemble.', 'Le ciel est gris. La pluie n\'a pas cessé.']);
  inBed(d, false);
  G.state.hp = maxHp(G.state);
  await d.wait(20);
  d.sfx('beep');
  await d.emote('phone', '!');
  await d.say('Ton téléphone vibre sur le bureau.');
}

export const appartEnter: Script = async (d) => {
  const p = phase();
  if (p === 3) {
    world.extraDarkness = -0.25;
    d.ambience('none');
  } else {
    world.extraDarkness = 0;
  }
  if (p === 1 && !flag('i1_out')) {
    d.set('i1_out');
    await d.say(['L\'appartement est silencieux.', 'Maman est déjà partie. Ou pas encore rentrée. Tu ne sais plus très bien.']);
  }
};

export const familyPhoto: Script = async (d) => {
  const p = phase();
  if (p === 2) {
    await d.say(['L\'étagère du couloir.', 'Le cadre est vide. Il y avait une photo, dedans. Tu en es sûr.']);
    return;
  }
  await d.say('L\'étagère du couloir. Une photo de famille, dans un cadre en bois.');
  await d.image('photo_famille', p === 3 ? ['Vous souriez tous les trois.', 'C\'était vrai. Tout ça, c\'était vrai.'] : ['Le parc, l\'été dernier. L\'été d\'avant.', 'Tu ne regardes pas trop longtemps.']);
};

export const hallClock: Script = async (d) => {
  const p = phase();
  if (p === 2) await d.say(['L\'horloge du couloir indique 3h33.', 'Comme celle de ta chambre. Comme toutes les horloges.']);
  else if (p === 3) await d.say('L\'horloge du couloir. Six heures moins deux.');
  else await d.say(['L\'horloge du couloir.', 'Elle avance de dix minutes. Personne ne l\'a jamais remise à l\'heure.']);
};

export const tv: Script = async (d) => {
  const p = phase();
  if (p === 2) await d.say(['La neige grésille sur l\'écran.', 'Si tu plisses les yeux, tu crois voir une couronne.']);
  else if (p === 3) await d.say('La télé, éteinte. Ton reflet dans l\'écran noir a l\'air… réveillé.');
  else await d.say(['La télé est éteinte.', 'Mina regardait ses dessins animés le samedi matin, le son trop fort.']);
};

export const sofa: Script = async (d) => {
  if (phase() === 2) await d.say(['Il y a un creux dans le coussin, à côté de toi.', 'Petit. Tiède. Comme si quelqu\'un venait de se lever.']);
  else await d.say(['Le canapé garde la forme de quelqu\'un qui s\'assoit toujours du même côté.', 'Maman. Le soir. Devant la télé éteinte.']);
};

export const fridge: Script = async (d) => {
  const p = phase();
  if (p === 2) {
    await d.say(['Le frigo bourdonne.', 'Les dessins de Mina sont toujours là. Mais les aimants ont été déplacés, comme si quelqu\'un avait voulu les cacher.']);
    return;
  }
  if (p === 1 && !flag('i1_note')) {
    await d.say('Sur le frigo, un mot tenu par un aimant en forme de fraise.');
    await d.paper(['Noa,', '', 'Mange quelque chose,', 's\'il te plaît.', 'Il y a des pâtes.', '', 'Je t\'aime.', '— Maman'], '');
    d.set('i1_note');
    await d.say('Tu relis le mot. Deux fois.', 'noa:sad');
    return;
  }
  await d.say(['Le frigo. Des yaourts, du jus d\'orange, une boîte de pâtes.', 'Les dessins de Mina tiennent avec des aimants en forme de fruits.']);
};

export const kitchenDrawings: Script = async (d) => {
  await d.say(['Les dessins de Mina, scotchés au-dessus du plan de travail :', 'un soleil avec des lunettes de soleil, un mouton qui fait du vélo, et toi, avec des cheveux tout bleus.']);
};

export const stove: Script = async (d) => {
  if (phase() !== 1 || flag('i1_ate')) {
    await d.say('Une casserole vide sur la gazinière.');
    return;
  }
  const r = await d.ask('Une casserole de pâtes froides. Manger ?', ['Manger', 'Laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) {
    await d.say('Tu n\'as pas faim. Tu crois.');
    return;
  }
  await d.say(['Tu manges debout, dans la cuisine silencieuse.', 'C\'est froid. C\'est trop salé.', 'C\'est bon, en fait.']);
  d.heal();
  d.set('i1_ate');
  await d.say('{c:l}Tu te sens un peu plus solide.{/c}');
};

export const kitchenTable: Script = async (d) => {
  if (phase() === 3) {
    await d.say(['La table de la cuisine.', 'Tout à l\'heure, il y aura du chocolat chaud. Tu le sais, sans savoir comment.']);
    return;
  }
  await d.say(['La table de la cuisine. Trois chaises.', 'Il n\'y a que deux bols dans l\'égouttoir.']);
};

export const frontDoor: Script = async (d) => {
  const p = phase();
  if (p === 2) await d.say(['La porte d\'entrée.', 'Tu n\'as pas réussi à l\'atteindre. Tu ne sais pas comment tu es arrivé là.']);
  else if (p === 3) await d.say(['La porte d\'entrée.', 'Maman va rentrer par là. Bientôt.']);
  else await d.say(['La porte d\'entrée.', 'Dehors, il pleut. Dehors, il y a des gens. Tu n\'as pas envie.']);
};

export const minaDoor: Script = async (d) => {
  const p = phase();
  if (p === 3) {
    await d.say(['La porte de Mina est entrouverte.', 'Une lumière pâle filtre par l\'interstice.']);
    const r = await d.ask('Entrer ?', ['Entrer', 'Attendre'], undefined, { cancelIndex: 1 });
    if (r === 0) await d.warp('chambre_mina', 'door', { sfx: 'door' });
    return;
  }
  await d.say(['Une pancarte en carton, écrite au feutre :', '« CHAMBRE DE MINA — DÉFENSE D\'ENTRER (sauf Noa) »']);
  await d.say(['Tu poses la main sur la poignée.', '{p:30}Tu ne peux pas.'], 'noa:sad');
};

export const bathroomDoor: Script = async (d) => {
  const p = phase();
  if (p === 2) {
    await d.say(['Derrière la porte de la salle de bain, l\'eau coule.', 'Personne n\'a ouvert le robinet.']);
    return;
  }
  if (p === 3) {
    await d.say(['Tu te passes de l\'eau froide sur le visage.', 'Dans le miroir, tu as les yeux rouges. Mais ce sont tes yeux.']);
    return;
  }
  await d.say(['La salle de bain.', 'Dans le miroir, quelqu\'un te regarde. Il a l\'air très fatigué.', 'Tu évites ton reflet.']);
};

export const mamanDoor: Script = async (d) => {
  const p = phase();
  if (p === 2) await d.say(['La chambre de Maman.', 'Le lit n\'a pas été défait. Elle n\'est toujours pas rentrée.']);
  else if (p === 3) await d.say('La chambre de Maman. Vide. Plus pour longtemps.');
  else await d.say(['La chambre de Maman.', 'Elle travaille de nuit, maintenant. Depuis l\'année dernière. Elle dit que ça l\'aide à ne pas penser.']);
};

// ---------------------------------------------------------------------------
// Interlude 2 — « La porte »
// ---------------------------------------------------------------------------

export async function interlude2(d: Director): Promise<void> {
  d.load('chambre', 'bed');
  inBed(d, true);
  await d.wait(40);
  d.sfx('heartbeat');
  await d.narrate('Tu te réveilles en sursaut.');
  await d.fadeIn(60);
  inBed(d, false);
  await d.wait(20);
  await d.say(['Il fait noir. Plus noir que d\'habitude.', 'Le réveil affiche 3h33.']);
  d.sfx('beep');
  await d.emote('phone', '!');
  await d.say('Ton téléphone clignote. Un message vocal.');
}

export const appartNuitEnter: Script = async (d) => {
  world.extraDarkness = 0;
  d.music(null);
  d.ambience('hum');
  if (!flag('i2_out')) {
    d.set('i2_out');
    await d.say(['Le couloir est plongé dans le noir.', 'Quelque part, une télé grésille.']);
  }
};

export const tvWakes: Script = async (d) => {
  if (flag('i2_tv')) return;
  d.set('i2_tv');
  d.sfx('glitch');
  d.flash('#c8d8ff', 10);
  await d.wait(20);
  await d.say('La télé s\'allume toute seule.');
  await d.image('tv_mina', [
    '« Noa ! Noa, regarde ! Regarde ce que j\'ai dessiné ! »',
    '« Ça, c\'est toi, avec tes cheveux bleus. Et moi, je suis la lune ! »',
    '« Tu le gardes, hein ? Promis ? Promis juré ? »',
  ]);
  d.glitch(30);
  await d.wait(30);
  await d.say(['La vidéo s\'arrête.', 'Il ne reste que la neige, et ton reflet dedans.']);
  await d.say('…Promis.', 'noa:sad');
};

export const corridorLoop: Script = async (d) => {
  // The corridor towards the front door never ends: you always come back.
  d.glitch(8);
  const p = d.player;
  p.x = 10 * 16 + 8;
  p.y = Math.max(4 * 16 + 14, Math.min(p.y, 8 * 16 + 14));
  world.snapCamera();
  world.resetFollower();
  if (!flag('i2_loop')) {
    d.set('i2_loop');
    await d.wait(10);
    await d.say(['Le couloir est plus long que d\'habitude.', 'Tu marches, tu marches… et tu reviens devant la porte de Mina.']);
  }
};

export const corridorDodo: Script = async (d) => {
  await d.say(['Dodo. Assis au milieu du couloir.', 'Il était sur ton lit. Tu en es sûr.']);
  await d.wait(30);
  await d.emote('dodo_corridor', '…', 60);
  await d.say('Ses yeux-boutons te regardent. Ils brillent.');
  d.glitch(20);
  fx.flash('#000000', 20);
  d.remove('dodo_corridor');
  d.set('i2_dodo_gone');
  d.set('i2_dodo_back');
  await d.wait(30);
  await d.say(['Dodo n\'est plus là.', 'Tu crois entendre, très loin, quelqu\'un fredonner une berceuse.']);
};

export const minaDoorAjar: Script = async (d) => {
  await d.say(['La porte de Mina est entrouverte.', 'Derrière, il fait noir. Un noir épais, qui ne laisse rien passer.']);
  await d.say('Pas encore.', 'inconnu');
  await d.walk('player', 0, 1, 1.4);
};

async function interlude2Dodo(d: Director): Promise<void> {
  const plush = d.find('dodo_plush');
  if (plush) await d.emote('dodo_plush', '…', 50);
  d.music('dodo');
  await d.say('Tu sais ce qui se passe quand on se réveille, {player} ?', 'dododark:neutral');
  await d.say(['On perd tout.', 'Les rêves s\'en vont. Les gens dedans aussi.'], 'dododark:creepy');
  await d.say(['Mais si on ne se réveille pas…', 'si on reste bien au chaud, sous la couette…', 'alors rien ne s\'en va jamais.'], 'dodo:happy');
  setPageTitle('Ne pars pas');
  await d.say('Dors, Noa. {spd:0.5}Mina t\'attend.{/spd}', 'dodo:creepy');
  await d.ask('Tes paupières sont si lourdes.', ['Dormir']);
  await enterDream(d, 3);
}

// ---------------------------------------------------------------------------
// Finale — « Le carnet »
// ---------------------------------------------------------------------------

export async function finale(d: Director): Promise<void> {
  setPageTitle(null);
  d.load('chambre', 'bed');
  inBed(d, true);
  await d.wait(40);
  await d.narrate('La pluie s\'est arrêtée.');
  await d.fadeIn(100);
  await d.wait(30);
  await d.say(['Il fait encore nuit.', 'Mais derrière la fenêtre, le ciel a pâli. Juste un peu.']);
  inBed(d, false);
  await d.wait(20);
  await d.say(['Dodo est sur ton lit.', 'Sa tête est tournée vers la porte.']);
}

export const minaRoomEnter: Script = async (d) => {
  world.extraDarkness = -0.1;
  d.ambience('none');
  if (!flag('fin_room')) {
    d.set('fin_room');
    await d.say(['La chambre de Mina.', 'Ça sent encore la pâte à modeler et les crayons de cire.', 'Rien n\'a bougé depuis un an.']);
  }
};

export const minaDrawings: Script = async (d) => {
  await d.say(['Ses dessins, au mur.', 'Un mouton en couronne. Un nuage qui pleure. Une armoire avec des yeux, et, en dessous : « il est gentil en vrai ».']);
};

export const minaNightlight: Script = async (d) => {
  if (flag('fin_plugged')) {
    await d.say('La veilleuse de Mina brille doucement. Elle n\'a plus peur du noir, ici.');
    return;
  }
  await d.say(['Sa veilleuse. Celle de l\'hôpital.', 'Quelqu\'un l\'a rapportée. Le cordon est enroulé autour, bien serré.']);
  const r = await d.ask('La brancher ?', ['La brancher', 'La laisser'], undefined, { cancelIndex: 1 });
  if (r !== 0) return;
  d.set('fin_plugged');
  const e = world.entities.find((x) => x.sprite === 'prop_veilleuse_off');
  if (e) {
    e.sprite = 'prop_veilleuse';
    e.light = { r: 56, color: '#ffe991', flicker: false, dy: -6 };
  }
  d.sfx('chime');
  await d.say(['Tu la branches.', 'La petite lune s\'allume. Elle grésille, puis elle se stabilise.', 'Un an trop tard. Mais elle s\'allume.']);
};

export const carnet: Script = async (d) => {
  if (flag('fin_carnet')) {
    await d.say('Le carnet de Mina.');
    return;
  }
  await d.say(['Sur son bureau, un carnet à spirale.', 'Des gommettes en forme d\'étoile sur la couverture.', 'Tu l\'ouvres.']);
  d.music('title', 1.5);
  await d.image('carnet_couverture', ['« Le Pays de Coton — pour Noa »']);
  await d.image('carnet_page1', ['Une prairie pleine de coton. Un garçon aux cheveux bleus. Une princesse avec une cape et une couronne.']);
  await d.image('carnet_page2', ['Un village de moutons. Une chaussette marchande. « elle cherche sa paire !! »']);
  await d.image('carnet_page3', ['Une forêt de crayons. Un hibou à lunettes. Des lucioles.']);
  await d.say('La dernière page.');
  await d.image('carnet_page4', []);
  await d.wait(20);
  await d.say('…', 'noa:sad');
  await d.say('Mina.', 'noa:sad');
  await d.wait(30);
  await d.say(['Dans sa trousse, il reste un crayon.', 'Tu tournes la page. Elle est blanche.', 'Tu écris.']);
  const words = await d.poem('Pour Mina');
  const lines = composePoem(words);
  savePoem(lines, words.map((w) => w.text));
  await d.paper(lines, '');
  d.set('fin_carnet');
  await mamanComesHome(d);
};

/** Keeps the poem: in the run (read aloud in the epilogue) and forever in the title-screen gallery. */
function savePoem(lines: string[], words: string[]): void {
  const text = lines.join('\n');
  G.state.flags.fin_poem = text;
  G.meta.poems.push({ title: 'Pour Mina', text, words, at: Date.now() });
  writeMeta(G.meta);
}

async function mamanComesHome(d: Director): Promise<void> {
  await d.wait(40);
  d.sfx('door', { pitch: 0.8 });
  await d.wait(30);
  await d.say('Au loin, des clés dans la serrure. La porte d\'entrée.');
  d.sfx('step', { pitch: 0.7 });
  await d.wait(20);
  d.sfx('step', { pitch: 0.7 });
  await d.say('Noa ? Tu es réveillé ?', 'maman:neutral');
  d.spawn({ id: 'maman', char: 'maman', x: 6, y: 9, dir: 'up' });
  await d.walkTo('maman', 6, 6, 0.6);
  d.face('player', 'down');
  await d.wait(20);
  await d.emote('maman', '!');
  await d.say(['Tu… tu es dans sa chambre.', 'Tu es entré.'], 'maman:sad');
  await d.wait(30);
  await d.say(['Maman.', 'Je l\'ai pas apportée. La veilleuse. Le dernier soir.', 'Je voulais pas la voir comme ça. J\'avais peur. Pardon. Pardon…'], 'noa:sad');
  await d.wait(30);
  await d.say('Oh, mon grand…', 'maman:sad');
  // The hug.
  const m = d.get('maman');
  const p = d.player;
  const hx = Math.round((m.x + p.x) / 2 / 16 - 0.5);
  const hy = Math.round(Math.max(m.y, p.y) / 16 - 1);
  d.show('maman', false);
  d.show('player', false);
  d.spawn({ id: 'hug', sprite: 'pose_hug', x: hx, y: hy, solid: false });
  d.music('ending', 2);
  await d.wait(60);
  await d.say(['Ce n\'est pas ta faute.', 'Tu m\'entends ? Ce n\'est la faute de personne.', 'Elle t\'aimait tellement. Elle parlait de toi tout le temps.'], 'maman:sad');
  if (flag('fin_plugged')) await d.say('Tu as rallumé sa veilleuse…', 'maman:sad');
  if (flag('i1_ate')) await d.say('Et tu as mangé les pâtes, l\'autre jour. Je l\'ai vu. … C\'est bien. C\'est bien, mon grand.', 'maman:happy');
  else if (replyOf(1) === 'oui')
    await d.say(['Tu m\'avais écrit « oui », pour les pâtes.', 'La casserole était encore pleine.', 'C\'est pas grave. Moi aussi, je dis que ça va quand ça ne va pas.'], 'maman:sad');
  await mamanOnMessages(d);
  await mamanInvites(d);
  await d.fadeOut(120, '#fff3e0');
  await d.image('fin_aube', ['Le soleil se lève sur la chambre de Mina.', 'Pour la première fois depuis un an, il fait jour.']);
  d.remove('hug');
  await epilogue(d);
}

/** Maman on the messages of the last days (what Noa answered, or his silence). */
async function mamanOnMessages(d: Director): Promise<void> {
  const sent = sentReplies();
  if (!sent.length) {
    await d.say(['Je t\'écris tous les soirs, tu sais.', 'Même quand tu ne réponds pas.', 'Surtout quand tu ne réponds pas.'], 'maman:sad');
  } else if (replyOf(0) === 'aime') {
    await d.say(['Ton « moi aussi », l\'autre nuit…', 'Je l\'ai lu dans le vestiaire, au travail.', 'J\'ai pleuré comme une idiote. Une idiote très heureuse.'], 'maman:happy');
  } else if (replyOf(0) === 'dormir') {
    await d.say(['Tu m\'avais écrit que tu n\'arrivais pas à dormir.', 'J\'aurais dû rentrer. Je vais arrêter les nuits. Je vais demander.'], 'maman:sad');
  } else if (sent.some((r) => ANGRY.includes(r))) {
    await d.say(['Tu as le droit d\'être en colère, tu sais.', 'Contre elle, contre moi, contre tout.', 'Moi aussi, je l\'étais. Je le suis encore, des fois.'], 'maman:sad');
  } else {
    await d.say(['Tes petits messages…', 'Je les relis la nuit, au travail. Quand il n\'y a personne.'], 'maman:happy');
  }
}

/** « On ira la voir, aujourd'hui ? » — answers the message Noa sent (or not) at 3h33. */
async function mamanInvites(d: Director): Promise<void> {
  const r = replyOf(2);
  let yes = '…Oui.';
  if (r === 'accord') {
    await d.say(['Tu m\'as répondu « d\'accord », cette nuit.', 'Alors on y va ? Aujourd\'hui. Tous les deux.'], 'maman:happy');
  } else if (r === 'peux') {
    await d.say(['Tu m\'as écrit que tu ne pouvais pas.', 'On ira doucement. Si tu veux faire demi-tour, on fera demi-tour.', 'Mais on essaie ? Aujourd\'hui. Tous les deux.'], 'maman:sad');
    yes = '…D\'accord.';
  } else if (r === 'pardon') {
    await d.say(['Ton message, cette nuit. « Pardon. »', 'Je n\'avais pas compris. Maintenant, je comprends.', 'Et il n\'y a rien à pardonner. Rien du tout.'], 'maman:sad');
    await d.say('On ira la voir, aujourd\'hui ? Tous les deux.', 'maman:happy');
  } else if (r === 'pourquoi') {
    await d.say(['Tu m\'as demandé « pourquoi faire ».', 'Je ne sais pas, mon grand. Pour lui dire bonjour.', 'Pour lui dire qu\'on est là. Qu\'on est encore là.'], 'maman:sad');
    await d.say('On ira la voir, aujourd\'hui ? Tous les deux.', 'maman:happy');
  } else {
    await d.say('On ira la voir, aujourd\'hui ? Tous les deux.', 'maman:happy');
  }
  await d.say('On lui apportera une veilleuse. Une neuve.', 'maman:happy');
  await d.wait(30);
  await d.say(yes, 'noa:neutral');
}

// ---------------------------------------------------------------------------
// Debug entry points
// ---------------------------------------------------------------------------

export const DEBUG: Record<string, Script> = {
  prologue_dodo: async (d) => {
    G.state.flags.interlude = 0;
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await prologueDodo(d);
  },
  interlude1_fridge: async (d) => {
    G.state.flags.interlude = 1;
    d.load('appartement', 'noa');
    await d.fadeIn(10);
  },
  interlude2_corridor: async (d) => {
    G.state.flags.interlude = 2;
    d.load('appartement_nuit', 'noa');
    await d.fadeIn(10);
  },
  finale_room: async (d) => {
    G.state.flags.interlude = 3;
    G.state.chapter = 3;
    d.load('chambre_mina', 'door');
    await d.fadeIn(10);
  },
  finale_poem: async (d) => {
    G.state.flags.interlude = 3;
    G.state.chapter = 3;
    G.state.flags.i1_ate = true;
    d.load('chambre_mina', 'door');
    await d.fadeIn(10);
    await carnet(d);
  },
  // Maman's messages (add &flags=p_reply=aime,i1_ate,… to replay a given history).
  reply_prologue: async (d) => {
    G.state.flags.interlude = 0;
    G.state.flags.p_dodo = true;
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await phone(d);
  },
  interlude1_phone: async (d) => {
    G.state.flags.interlude = 1;
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await phone(d);
  },
  interlude2_phone: async (d) => {
    G.state.flags.interlude = 2;
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await phone(d);
  },
  finale_phone: async (d) => {
    G.state.flags.interlude = 3;
    d.load('chambre', 'bed');
    await d.fadeIn(10);
    await phone(d);
  },
  /** Maman comes home (the finale's reactions to the replies), then the epilogue. */
  finale_maman: async (d) => {
    G.state.flags.interlude = 3;
    G.state.chapter = 3;
    if (!G.state.flags.fin_poem) G.state.flags.fin_poem = composePoem(DEBUG_WORDS).join('\n');
    G.state.flags.fin_room = true;
    d.load('chambre_mina', 'door');
    await d.fadeIn(10);
    await mamanComesHome(d);
  },
  ...EPILOGUE_DEBUG,
};

const DEBUG_WORDS = [
  { text: 'lune', emotion: 'joie' as const },
  { text: 'coton', emotion: 'joie' as const },
  { text: 'pluie', emotion: 'tristesse' as const },
  { text: 'promesse', emotion: 'joie' as const },
  { text: 'absente', emotion: 'tristesse' as const },
  { text: 'lumière', emotion: 'joie' as const },
];

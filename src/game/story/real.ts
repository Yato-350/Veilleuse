import { input } from '../../engine/input';
import { fx } from '../../engine/fx';
import type { Director } from '../director';
import type { Script } from '../overworld/types';
import { world } from '../overworld/world';
import { G, maxHp } from '../state';
import { isLateNight, setPageTitle } from '../meta';
import { composePoem } from '../scenes/poem';
import { enterDream, finishGame } from './common';

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
    await d.say(['Ton téléphone. 14 messages non lus de « Maman ».', 'Le dernier : « Je rentre tard. Il y a des pâtes dans le frigo. Je t\'aime. »']);
  } else if (p === 1) {
    await d.say(['Un nouveau message de « Maman » :', '« Tu as mangé ? »', 'Tu ne réponds pas. Tu ne sais jamais quoi répondre.']);
  } else if (p === 2) {
    if (flag('i2_voicemail')) {
      await d.say('« On ira la voir ensemble, d\'accord ? »', 'maman:sad');
      return;
    }
    d.sfx('beep');
    await d.say('1 message vocal. Tu appuies.');
    await d.say(['Noa… c\'est Maman.', 'Je… je sais que tu ne décroches pas. C\'est pas grave.'], 'maman:sad');
    await d.say(['Ça fait un an demain.', 'Je rentre ce soir. Plus tôt. J\'ai demandé.'], 'maman:sad');
    await d.say(['On ira la voir ensemble, d\'accord ?', 'Je t\'aime, mon grand.'], 'maman:sad');
    await d.wait(30);
    await d.say('…', 'noa:sad');
    d.set('i2_voicemail');
  } else {
    await d.say(['Un message de « Maman », il y a cinq minutes :', '« Je rentre. »']);
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
  await d.paper(composePoem(words), '');
  d.set('fin_carnet');
  await mamanComesHome(d);
};

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
  await d.say(['On ira la voir, aujourd\'hui ? Tous les deux.', 'On lui apportera une veilleuse. Une neuve.'], 'maman:happy');
  await d.wait(30);
  await d.say('…Oui.', 'noa:neutral');
  await d.fadeOut(120, '#fff3e0');
  await d.image('fin_aube', ['Le soleil se lève sur la chambre de Mina.', 'Pour la première fois depuis un an, il fait jour.']);
  d.remove('hug');
  await d.narrate('Je veillerai sur lui.', { voice: 'dodo' });
  await d.narrate('Pour de vrai, cette fois.', { voice: 'dodo' });
  await d.narrate('Merci, {player}.', { voice: 'dodo' });
  await d.narrate('{c:y}Bonne nuit. Et bonjour.{/c}', { voice: 'dodo' });
  await finishGame(d, 'aube');
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
};

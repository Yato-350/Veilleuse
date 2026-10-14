import type { WordDef } from '../game/battle/types';

const w = (emotion: WordDef['emotion'], ...texts: string[]): WordDef[] => texts.map((text) => ({ text, emotion }));

/** Bittersweet words (« mots doux-amers »): joie + tristesse at once. Writing one makes the soul bicolor. */
const doux = (...texts: string[]): WordDef[] => texts.map((text) => ({ text, emotion: 'joie', emotion2: 'tristesse' }));

/** Words available in the notebook, by chapter. */
export const WORD_POOLS: Record<number, WordDef[]> = {
  1: [
    ...w('joie', 'soleil', 'rire', 'bonbon', 'câlin', 'danser', 'arc-en-ciel', 'pique-nique', 'bulles', 'fête', 'chatouilles'),
    ...w('tristesse', 'pluie', 'larmes', 'absence', 'hiver', 'seul', 'adieu', 'souvenir', 'vide', 'nuage', 'perdu'),
    ...w('colere', 'orage', 'crier', 'injuste', 'poing', 'tonnerre', 'épines', 'non', 'claquer', 'rage', 'feu'),
    ...w('neutre', 'maison', 'fenêtre', 'papier', 'chaise', 'lit'),
  ],
  2: [
    ...w('joie', 'lumière', 'printemps', 'chanson', 'goûter', 'cerf-volant', 'luciole', 'confettis', 'sourire', 'ensemble', 'balançoire'),
    ...w('tristesse', 'gris', 'oublier', 'manque', 'pleurer', 'fané', 'silence', 'partir', 'brouillard', 'regret', 'automne'),
    ...w('colere', 'griffer', 'rouge', 'hurler', 'casser', 'foudre', 'menteur', 'brûler', 'serrer', 'grogner', 'tempête'),
    ...w('neutre', 'crayon', 'arbre', 'chemin', 'feuille', 'cahier'),
    // « souvenir » is Gomme's special word in this chapter: not a pool word here.
    ...doux('berceuse', 'photo', 'goûter d\'avant', 'vieux dessin'),
  ],
  3: [
    ...w('joie', 'matin', 'guérir', 'espoir', 'rentrer', 'chaleur', 'promesse', 'vivre', 'soleil', 'courage', 'merci'),
    ...w('tristesse', 'pardon', 'couloir', 'attendre', 'perfusion', 'pâle', 'jamais', 'trop tard', 'nuit', 'froid', 'lâcher'),
    ...w('colere', 'pourquoi', 'injuste', 'personne', 'tais-toi', 'cogner', 'faute', 'assez', 'déchirer', 'mensonge', 'crier'),
    ...w('neutre', 'chambre', 'lit', 'blouse', 'horloge', 'numéro'),
    ...doux('souvenir', 'dessin', 'son rire', 'anniversaire'),
  ],
  // Chapter 4 « La Maison Cousue »: the house, the dinner, the nights alone. « découdre », « rendre », « ouvrir », « merci »
  // and « reste » are also the special words of La Couseuse, Le Petit Homme, Clé and the Poupée-Maman. Fear words exist
  // here for the first time: Le Petit Homme needs one.
  4: [
    ...w('joie', 'merci', 'ouvrir', 'samedi', 'dehors', 'ensemble', 'chanter', 'goûter', 'rire'),
    ...w('tristesse', 'rendre', 'seul', 'attendre', 'manteau', 'chaise vide', 'porte close', 'se taire', 'nuit blanche'),
    ...w('colere', 'découdre', 'arracher', 'claquer', 'menteuse', 'casser', 'hurler', 'assez'),
    ...w('peur', 'noir', 'cauchemar', 'trembler', 'placard', 'sous la porte', 'coups'),
    ...w('neutre', 'reste', 'maison', 'horloge', 'téléphone', 'fil', 'aiguille'),
    ...doux('pâtes', 'mot du frigo', 'dimanche', 'deux coups'),
  ],
  // Chapter 5 « La Marée Blanche »: the beach of before, the white hospital, the visit through the glass. « fièvre »
  // (Le Thermomètre), « pardon » and « je ne sais pas » (La Vitre) are special words too. « je ne sais pas » is neutral:
  // it is neither sad nor angry, it is only true.
  5: [
    ...w('joie', 'été', 'vacances', 'château', 'vague', 'glace', 'dessiner', 'ensemble', 'samedi'),
    ...w('tristesse', 'pardon', 'marée', 'visite', 'dormir', 'drap', 'neige', 'derrière la vitre', 'attendre'),
    ...w('colere', 'interdit', 'injuste', 'crier', 'promis', 'brûlant', 'casser', 'dehors'),
    ...w('peur', 'fièvre', 'tousser', 'microbe', 'contagieux', 'sas', 'blanc'),
    ...w('neutre', 'je ne sais pas', 'sable', 'masque', 'bracelet', 'lune', 'crayon rouge'),
    ...doux('coquillage', 'bonnet', 'deux crayons', 'quarante-deux'),
  ],
  // Chapter 6 « Le Ventre de Dodo »: inside the plush. « regarder » (Le Bouton Pendu), « pardon » (La Bourre) are also
  // special words; « garder » belongs to La Pile alone. « je suis là » and « bonne nuit » are the knocks of the wall,
  // put into words: two knocks, three knocks.
  6: [
    ...w('joie', 'lumière', 'chanter', 'ensemble', 'rire', 'câlin', 'réveil', 'dents de lait', 'courage'),
    ...w('tristesse', 'pardon', 'absence', 'fauteuil', 'quarante et une', 'manquer', 'nuit blanche', 'adieu', 'trop tard'),
    ...w('colere', 'découdre', 'arracher', 'menteur', 'assez', 'mordre', 'tais-toi', 'pourquoi'),
    ...w('peur', 'noir', 'aiguille', 'trois heures', 'sonnerie', 'tousser', 'coups'),
    ...w('neutre', 'regarder', 'je ne sais pas', 'coton', 'fil rouge', 'bocal', 'pile'),
    ...doux('je suis là', 'bonne nuit', 'berceuse', 'veilleuse'),
  ],
};

/** Words Dodo forces into the notebook during the final battle. */
export const DODO_WORDS: WordDef[] = w('neutre', 'dors', 'reste', 'oublie', 'chut', 'encore', 'dodo');

/** Mina's words, written in her handwriting during the final battle. */
export const MINA_WORDS: WordDef[] = [
  { text: 'merci', emotion: 'joie', power: 2 },
  { text: 'pardon', emotion: 'tristesse', power: 2 },
  { text: 'au revoir', emotion: 'tristesse', power: 2 },
  { text: 'je t\'aime', emotion: 'joie', power: 2 },
  { text: 'lumière', emotion: 'joie', power: 2 },
  { text: 'matin', emotion: 'joie', power: 2 },
];

/**
 * Version 2, the final battle (chapter 6), phase 2: Dodo's words, the ones of the phone call at 3:14 (from both
 * versions, never told apart). They are shown as subtitles when written.
 */
export const DODO_WORDS_V2: WordDef[] = w('neutre', 'Dors.', 'Arrête d\'appeler.', 'Demain.', 'Promis.', 'reste', 'oublie');

/**
 * Version 2, the final battle, phase 4: Mina's words, in the handwriting of the little girl in the knitted hat. « je
 * suis là » and « bonne nuit » are the knocks of the wall (two, three). In this order in the notebook (six at a time).
 */
export const MINA_WORDS_V2: WordDef[] = [
  { text: 'je suis là', emotion: 'joie', emotion2: 'tristesse', power: 2 },
  { text: 'bonne nuit', emotion: 'tristesse', emotion2: 'joie', power: 2 },
  { text: 'merci', emotion: 'joie', power: 2 },
  { text: 'pardon', emotion: 'tristesse', power: 2 },
  { text: 'au revoir', emotion: 'tristesse', power: 2 },
  { text: 'je t\'aime', emotion: 'joie', power: 2 },
  { text: 'lumière', emotion: 'joie', power: 2 },
  { text: 'matin', emotion: 'joie', power: 2 },
];

/** Words offered for the final poem (good ending). */
export const POEM_WORDS: WordDef[] = [
  ...w('joie', 'lune', 'étoile', 'veilleuse', 'rire', 'couronne', 'cape', 'dessin', 'matin', 'printemps', 'câlin'),
  ...w('tristesse', 'absence', 'pluie', 'pardon', 'couloir', 'fenêtre', 'adieu', 'silence', 'manque'),
  ...w('neutre', 'carnet', 'crayon', 'chambre', 'maison', 'nuit', 'lumière'),
];

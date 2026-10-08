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

/** Words offered for the final poem (good ending). */
export const POEM_WORDS: WordDef[] = [
  ...w('joie', 'lune', 'étoile', 'veilleuse', 'rire', 'couronne', 'cape', 'dessin', 'matin', 'printemps', 'câlin'),
  ...w('tristesse', 'absence', 'pluie', 'pardon', 'couloir', 'fenêtre', 'adieu', 'silence', 'manque'),
  ...w('neutre', 'carnet', 'crayon', 'chambre', 'maison', 'nuit', 'lumière'),
];

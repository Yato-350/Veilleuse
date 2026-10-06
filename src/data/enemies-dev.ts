import type { EnemyDef } from '../game/battle/types';

/** Developer test enemy. */
export const DEV_ENEMIES: Record<string, EnemyDef> = {
  dev_dummy: {
    id: 'dev_dummy',
    name: 'Mannequin',
    sprite: 'dev_wall',
    hp: 30,
    atk: 1,
    def: 0,
    emotion: 'tristesse',
    needs: [{ emotion: 'tristesse', count: 2 }],
    hates: ['joie'],
    check: 'Un mannequin d\'entraînement. Il a besoin de compréhension.',
    flavor: ['* Le mannequin attend.', '* Ça sent la poussière.'],
    talk: ['…', 'Frappe-moi. Ou parle-moi.'],
    reactGood: ['Merci…'],
    reactBad: ['Ce n\'est pas drôle.'],
    reactNeutral: ['?'],
    patterns: ['rain', 'ink_drops'],
    rewards: { boutons: 3 },
  },
};

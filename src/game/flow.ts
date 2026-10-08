/**
 * Late-bound navigation functions (title ↔ game ↔ endings). They are registered at boot by main.ts to avoid
 * circular imports between scenes.
 */
export const flow = {
  toTitle: async (): Promise<void> => {},
  newGame: async (_name: string): Promise<void> => {},
  continueGame: async (): Promise<void> => {},
  /** Bonus chapter « Les rêves des autres » (title screen, after the dawn ending). */
  startBonus: async (): Promise<void> => {},
};

/** Thrown to stop a running cutscene script (e.g. after loading a save from the game over screen). */
export class ScriptAbort extends Error {
  constructor() {
    super('script aborted');
  }
}

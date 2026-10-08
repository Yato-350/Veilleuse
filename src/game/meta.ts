import { GAME_TITLE } from '../engine/constants';
import { G, writeMeta } from './state';
import { tr } from '../i18n';

/**
 * Fourth-wall touches: the game notices when the player leaves the tab and changes the page title
 * during horror moments. Kept subtle and never blocking.
 */
let creepyTitle: string | null = null;
let leftAt = 0;

export function setupMeta(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      leftAt = Date.now();
      if (G.state.chapter >= 2 && G.state.playerName) document.title = tr('Ne pars pas…');
    } else {
      document.title = creepyTitle ? tr(creepyTitle) : GAME_TITLE;
      if (leftAt && Date.now() - leftAt > 3000) {
        G.meta.tabLeaves++;
        writeMeta(G.meta);
      }
    }
  });
}

/** Sets (or clears) an unsettling browser tab title. */
export function setPageTitle(t: string | null): void {
  creepyTitle = t;
  document.title = t ? tr(t) : GAME_TITLE;
}

/** True if the player left the tab for a while since `since` (used by Dodo's lines). */
export function leftRecently(): boolean {
  return G.meta.tabLeaves > 0;
}

/** Real-world hour (0-23). */
export function hourNow(): number {
  return new Date().getHours();
}

export function isLateNight(): boolean {
  const h = hourNow();
  return h >= 0 && h < 5;
}

/** Progressive Web App glue: service worker, install prompt, update notification. */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type W = Window & { __veilleuseInstall?: BeforeInstallPromptEvent | null };

export function setupPwa(): void {
  const w = window as W;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    w.__veilleuseInstall = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    w.__veilleuseInstall = null;
    toast('Veilleuse est installé. Tu peux le lancer depuis ton écran d\'accueil.');
  });
  // The native Android build (Capacitor) serves files locally: no service worker needed there.
  if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative()) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            nw?.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                toast('Une nouvelle version est disponible.', 'Mettre à jour', () => {
                  nw.postMessage('skipWaiting');
                });
              }
            });
          });
        })
        .catch(() => {
          /* offline support unavailable */
        });
      // Reload only when an update replaces a running version. On the very first visit the new worker claims the
      // page too (clients.claim), and reloading then would throw the player back to the title screen.
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return;
        reloading = true;
        window.location.reload();
      });
    });
  }
}

export async function install(): Promise<void> {
  const w = window as W;
  const ev = w.__veilleuseInstall;
  if (ev) {
    await ev.prompt();
    await ev.userChoice;
    w.__veilleuseInstall = null;
    return;
  }
  if (isIos()) {
    toast('Sur iPhone / iPad : touche « Partager » puis « Sur l\'écran d\'accueil ».');
  }
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Running inside the native app shell (Capacitor). */
export function isNative(): boolean {
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function toast(text: string, action?: string, onAction?: () => void, ms = 7000): void {
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
  if (action && onAction) {
    const b = document.createElement('button');
    b.textContent = action;
    b.addEventListener('click', () => {
      onAction();
      el.remove();
    });
    el.appendChild(b);
  }
  document.getElementById('app')?.appendChild(el);
  window.setTimeout(() => el.remove(), ms);
}

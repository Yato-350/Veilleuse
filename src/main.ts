import './styles.css';
import { audio } from './engine/audio';
import { W, H } from './engine/constants';
import { drawText } from './engine/font';
import { fx } from './engine/fx';
import { game } from './engine/game';
import { hits, input } from './engine/input';
import { screen } from './engine/screen';
import { TRACKS } from './data/music';
import { MAPS } from './data/maps';
import { buildAll } from './game/assets';
import { director, runScript } from './game/director';
import { flow } from './game/flow';
import { world } from './game/overworld/world';
import { setupPwa } from './game/pwa';
import { G, newState, readMeta, readSave, readSettings, writeMeta, deleteSave, maxHp } from './game/state';
import { dialogue } from './game/ui/dialogue';
import { applySettings } from './game/ui/options';
import { TitleScene } from './game/scenes/title';
import { WarningScene } from './game/scenes/warning';
import { startBonus, startPrologue } from './game/story';
import { setupMeta } from './game/meta';
import { startDebug } from './game/debug';
import { openMenu } from './game/scenes/menu';
import { bindLanguage, isLang, missing } from './i18n';

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  game.init(canvas);
  screen.init();
  input.attach(window);
  input.onGesture = () => audio.unlock();
  buildAll();
  for (const [id, t] of Object.entries(TRACKS)) audio.register(id, t);

  G.meta = readMeta();
  G.meta.launches++;
  G.meta.lastPlay = Date.now();
  writeMeta(G.meta);
  G.settings = readSettings();
  bindLanguage(() => G.settings.language);
  // ?lang=en / ?lang=fr: language for this visit (links, tests); the options can still change it.
  const urlLang = new URLSearchParams(location.search).get('lang');
  if (isLang(urlLang)) G.settings.language = urlLang;
  applySettings();

  // Global UI layers.
  game.hooks.push(() => dialogue.update());
  game.topOverlays.push((g) => dialogue.draw(g));
  // Touch / mouse regions drawn during this render become clickable (after every layer, dialogue included).
  game.topOverlays.push(() => hits.flip());
  world.hooks = {
    run: (s) => runScript(s),
    encounter: (e) => void runScript((d) => d.encounter(e)),
    openMenu: () => openMenu(),
  };

  flow.toTitle = async () => {
    audio.stopMusic(0.5);
    world.busy = 0;
    fx.setFade(1);
    fx.glitch = 0;
    fx.bars = 0;
    fx.setBars(false);
    game.replace(new TitleScene());
  };
  flow.newGame = async (name: string) => {
    if (G.meta.runInProgress) G.meta.resets++;
    G.meta.newGames++;
    G.meta.runInProgress = true;
    if (name && !G.meta.names.includes(name)) G.meta.names.push(name);
    writeMeta(G.meta);
    deleteSave();
    G.state = newState(name);
    G.state.hp = maxHp(G.state);
    game.replace(world);
    await runScript(async (d) => {
      await startPrologue(d);
    });
  };
  flow.startBonus = async () => {
    // A separate short run: it never touches the main save's story flags (flags.bonus marks it).
    G.state = newState(G.meta.names[G.meta.names.length - 1] ?? '');
    G.state.flags.bonus = 1;
    G.state.hp = maxHp(G.state);
    game.replace(world);
    await runScript(async (d) => {
      await startBonus(d);
    });
  };
  flow.continueGame = async () => {
    const s = readSave();
    if (!s) return flow.toTitle();
    G.state = s;
    G.state.hp = Math.max(1, Math.min(G.state.hp, maxHp(G.state)));
    world.busy = 0;
    game.replace(world);
    world.load(s.map, { x: s.x, y: s.y, dir: s.dir });
    fx.setFade(1);
    await fx.fadeIn(40);
  };

  setupMeta();
  setupPwa();

  const params = new URLSearchParams(location.search);

  // Suspend save: phones kill backgrounded apps, so save when the game is hidden or closed — only while exploring
  // freely (never mid-battle or mid-cutscene), so that « Continuer » always resumes in a consistent state.
  const suspendSave = (): void => {
    if (params.has('debug') || !G.meta.runInProgress || game.top !== world || !world.map || !world.controllable) return;
    director.save();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendSave();
  });
  window.addEventListener('pagehide', suspendSave);
  if (params.has('debug')) {
    startDebug(params);
  } else {
    fx.setFade(1);
    game.push(new WarningScene());
  }
  game.topOverlays.push(drawFps);
  game.start();
  document.getElementById('boot')?.classList.add('done');
  window.setTimeout(() => document.getElementById('boot')?.remove(), 800);
  // Expose a tiny API for automated tests.
  // Class names are minified in production builds: `scene()` gives tests a stable name for the top scene.
  const scene = (): string => {
    const t = game.top;
    if (t instanceof TitleScene) return 'TitleScene';
    if (t instanceof WarningScene) return 'WarningScene';
    if (t === world) return 'WorldScene';
    return t?.constructor.name ?? 'none';
  };
  const i18nMissing = (): string[] => [...missing];
  (window as unknown as { __veilleuse: unknown }).__veilleuse = {
    game,
    world,
    G,
    MAPS,
    dialogue,
    fx,
    scene,
    i18nMissing,
  };
}

let fpsT = performance.now();
let fpsN = 0;
let fps = 0;
function drawFps(g: CanvasRenderingContext2D): void {
  fpsN++;
  const now = performance.now();
  if (now - fpsT > 1000) {
    fps = fpsN;
    fpsN = 0;
    fpsT = now;
  }
  if (G.settings.showFps) drawText(g, `${fps} fps`, W - 4, H - 11, { align: 'right', color: '#7ee08a' }); // i18n-ignore
}

boot();

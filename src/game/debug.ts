import { H, W } from '../engine/constants';
import { drawText } from '../engine/font';
import { fx } from '../engine/fx';
import { game, type Scene } from '../engine/game';
import { ctx2d, makeCanvas, drawSprite } from '../engine/sprite';
import { ENEMIES } from '../data/enemies';
import { ILLUSTRATIONS } from '../data/illustrations';
import { CHARS, SPR } from './assets';
import { Battle } from './battle/battle';
import { PATTERNS } from './battle/patterns';
import { runScript } from './director';
import { world } from './overworld/world';
import type { MapDef } from './overworld/types';
import { MAPS } from '../data/maps';
import { G, maxHp, newState } from './state';
import { TitleScene, TITLE_VARIANTS, type TitleVariant } from './scenes/title';
import { ImageScene } from './scenes/image';
import { DEBUG_SCRIPTS } from './story';
import { CreditsScene } from './scenes/credits';
import { GalleryScene } from './scenes/gallery';
import { composePoem } from './scenes/poem';

/**
 * Developer entry points, driven by URL parameters (used by tools/shot.mjs for visual checks):
 *   ?debug=sheet&filter=b_&scale=3      sprite sheet (all sprites whose key starts with `filter`; several prefixes: a,b; &base: no @variants)
 *   ?debug=map&map=prairie&spawn=default&chapter=1&party=mina&flags=a,b=2
 *   ?debug=map&map=chambre&world=feutre   any map seen in another world material (feutre, stylo, blanc, ouate, faux…)
 *   ?debug=battle&enemies=nuage,pissenlit&chapter=1&emotion=joie
 *   ?debug=pattern&id=rain&emotion=tristesse
 *   ?debug=image&key=souvenir_fenetre
 *   ?debug=script&name=chapter1_intro&map=prairie
 *   ?debug=title | ?debug=credits
 *   ?debug=title&variant=point_de_croix|continuer_seul|soleil_blanc|silence_v2|veilleuse|night|dawn|dream (&days=23)
 *   ?debug=credits&mode=faux   the fake credits of the false dawn (stop, choice, rewind / let roll, cross-stitch)
 *   ?debug=credits&mode=aide   the credits followed by the help card
 *   ?debug=gallery&seen=some|all|none&poems=3&open=1   title screen + « Carnet de souvenirs » with sample memories
 */
export function startDebug(p: URLSearchParams): void {
  const mode = p.get('debug') ?? '';
  G.state = newState(p.get('name') ?? 'Testeur');
  G.state.chapter = Number(p.get('chapter') ?? 1);
  G.state.hp = maxHp(G.state);
  if (p.get('party')) G.state.party = p.get('party')!.split(',');
  for (const kv of (p.get('flags') ?? '').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    G.state.flags[k!] = v === undefined ? true : isNaN(Number(v)) ? v : Number(v);
  }
  for (const it of (p.get('items') ?? '').split(',').filter(Boolean)) G.state.items.push(it);
  for (const it of (p.get('keys') ?? '').split(',').filter(Boolean)) G.state.keyItems.push(it);
  fx.setFade(0);
  switch (mode) {
    case 'sheet':
      return showSheet(p.get('filter') ?? '', Number(p.get('scale') ?? 3), p.get('chars') !== null, p.get('base') !== null);
    case 'map': {
      const id = p.get('map') ?? 'chambre';
      const w = p.get('world');
      if (w && MAPS[id]) MAPS[id] = { ...MAPS[id]!, world: w as MapDef['world'] };
      game.replace(world);
      world.load(id, p.get('spawn') ?? 'default');
      return;
    }
    case 'battle': {
      const ids = (p.get('enemies') ?? 'gribouille').split(',').filter((id) => ENEMIES[id]);
      if (!ids.length) return showError(`Unknown enemies: ${p.get('enemies')}`);
      const b = new Battle(
        ids.map((id) => ENEMIES[id]!),
        { emotion: (p.get('emotion') as never) ?? undefined, tutorial: true },
      );
      game.replace(b);
      void b.run();
      return;
    }
    case 'pattern': {
      const id = p.get('id') ?? 'ink_drops';
      if (!PATTERNS[id]) return showError(`Unknown pattern: ${id}`);
      const first = Object.values(ENEMIES)[0];
      const b = new Battle(first ? [first] : [], { emotion: (p.get('emotion') as never) ?? undefined, tutorial: true });
      game.replace(b);
      const loop = async () => {
        while (true) await b.runPattern(id, Number(p.get('power') ?? 0));
      };
      void loop();
      return;
    }
    case 'image': {
      const key = p.get('key') ?? '';
      if (!ILLUSTRATIONS[key]) return showError(`Unknown illustration: ${key}`);
      game.replace(new BlackScene());
      void ImageScene.show(key, []);
      return;
    }
    case 'script': {
      const name = p.get('name') ?? '';
      const s = DEBUG_SCRIPTS[name];
      if (!s) return showError(`Unknown script: ${name}. Available: ${Object.keys(DEBUG_SCRIPTS).join(', ')}`);
      game.replace(world);
      if (p.get('map')) world.load(p.get('map')!, p.get('spawn') ?? 'default');
      void runScript(async (d) => {
        await s(d);
      });
      return;
    }
    case 'gallery': {
      // Sample memories, in memory only (never written to the real save).
      const keys = Object.keys(ILLUSTRATIONS);
      const seen = p.get('seen') ?? 'some';
      G.meta.seen = seen === 'all' ? keys : seen === 'none' ? [] : keys.filter((_, i) => i % 3 !== 2);
      G.meta.endings = ['aube'];
      const words = [
        // Words of POEM_WORDS, so the sample poems are translated like real ones.
        ['lune', 'couronne', 'cape', 'lumière', 'câlin', 'printemps'],
        ['pluie', 'silence', 'pardon', 'fenêtre', 'couloir', 'nuit'],
        ['étoile', 'absence', 'dessin', 'veilleuse', 'rire', 'matin'],
      ];
      const emo = ['joie', 'tristesse', 'peur'] as const;
      G.meta.poems = Array.from({ length: Number(p.get('poems') ?? 3) }, (_, i) => {
        const w = words[i % words.length]!.map((text) => ({ text, emotion: emo[i % 3]! }));
        return { title: 'Pour Mina', text: composePoem(w).join('\n'), words: w.map((x) => x.text), at: Date.UTC(2026, 9, 8 - i * 9, 22) };
      });
      game.replace(new TitleScene());
      if (p.get('open') !== '0') game.push(new GalleryScene());
      return;
    }
    case 'credits': {
      game.replace(new BlackScene());
      const m = p.get('mode');
      if (m === 'faux') {
        game.replace(world);
        void runScript(async (d) => {
          await DEBUG_SCRIPTS.faux_generique!(d);
        });
      } else void CreditsScene.play({ helpCard: m === 'aide' });
      return;
    }
    case 'title':
    default: {
      // (No audio.unlock() here: without a user gesture the browser refuses it; the first key press unlocks audio.)
      const v = p.get('variant');
      if (p.get('days')) G.meta.beauxRevesAt = Date.now() - Number(p.get('days')) * 86400000;
      game.replace(new TitleScene(v && (TITLE_VARIANTS as string[]).includes(v) ? { variant: v as TitleVariant } : {}));
    }
  }
}

class BlackScene implements Scene {
  update(): void {}
  draw(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
  }
}

function showError(msg: string): void {
  console.error(msg);
  game.replace({
    update() {},
    draw(g) {
      g.fillStyle = '#300';
      g.fillRect(0, 0, W, H);
      drawText(g, msg.slice(0, 50), 4, 4, { color: '#fff' });
      drawText(g, msg.slice(50, 100), 4, 18, { color: '#fff' });
    },
  });
}

/** Renders a large sprite sheet into the page (outside the game canvas) for visual review. */
function showSheet(filter: string, scale: number, includeChars: boolean, baseOnly = false): void {
  const entries: Array<[string, HTMLCanvasElement, number, number]> = [];
  const prefixes = filter.split(',');
  for (const [k, s] of Object.entries(SPR)) {
    if (baseOnly && k.includes('@')) continue;
    if (prefixes.some((f) => k.startsWith(f))) entries.push([k, s.img, s.w, s.h]);
  }
  if (includeChars) {
    for (const [id, set] of Object.entries(CHARS)) {
      if (!id.startsWith(filter.replace(/^char:/, ''))) continue;
      for (const dir of ['down', 'up', 'left', 'right'] as const) {
        set[dir].forEach((f, i) => entries.push([`${id}.${dir}${i}`, f.img, f.w, f.h]));
      }
    }
  }
  const cols = 8;
  const cellW = Math.max(64, ...entries.map((e) => e[2] * scale + 8));
  const cellH = Math.max(40, ...entries.map((e) => e[3] * scale + 22));
  const sheetW = cols * cellW;
  const sheetH = Math.ceil(entries.length / cols) * cellH + 4;
  const c = makeCanvas(Math.max(sheetW, 200), Math.max(sheetH, 60));
  const g = ctx2d(c);
  g.fillStyle = '#3a3448';
  g.fillRect(0, 0, c.width, c.height);
  entries.forEach(([key, img, w, h], i) => {
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    g.fillStyle = (Math.floor(i / cols) + i) % 2 ? '#4a4458' : '#423c50';
    g.fillRect(x, y, cellW, cellH);
    g.drawImage(img, x + 4, y + 4, w * scale, h * scale);
    drawText(g, key.slice(0, Math.floor(cellW / 6)), x + 3, y + cellH - 14, { color: '#ffffff' });
  });
  if (!entries.length) drawText(g, `No sprite matches "${filter}"`, 4, 4, { color: '#fff' });
  c.id = 'sheet';
  c.style.imageRendering = 'pixelated';
  document.body.style.overflow = 'auto';
  document.body.style.touchAction = 'auto';
  const app = document.getElementById('app')!;
  app.style.display = 'none';
  document.body.appendChild(c);
  void drawSprite;
}

#!/usr/bin/env node
/**
 * Playtest bot: drives the game in a headless browser with high-level steps and saves screenshots.
 *
 *   node tools/play.mjs "debug=script&name=c1_start" out.png --steps "auto,shot:menu,write:soleil,auto,shot:end"
 *
 * Steps (comma-separated):
 *   auto[:ms]        advance dialogue / battle text until something needs a decision (choice, battle menu, free roam)
 *   choose:N         pick choice N (0-based) in a dialogue choice or battle list
 *   menu:N           pick battle menu button N (0 FRAPPER, 1 ÉCRIRE, 2 OBJET, 3 ÉPARGNER)
 *   write:word       ÉCRIRE then the given word in the notebook (falls back to the first word)
 *   hit              FRAPPER and stop the bar near the middle
 *   dodge[:ms]       wait for the enemy turn to end (random wiggle)
 *   interact:id      run the interaction script of entity `id` (prop, NPC)
 *   go:x/y           teleport the player to tile (x, y)
 *   god[:off]        keep Noa's HP full during enemy turns
 *   until:mode       advance text until the battle is in `mode` (dodge, menu, …)
 *   load:map/spawn   load a map;  flag:key[=value]  set a story flag
 *   (--touch: phone emulation with touch events; --canvas: screenshots of the game screen only)
 *   swipe:x/y/x2/y2  quick pointer flick between two game pixels (mouse drag)
 *   tap:x/y          tap (touch with --touch, else mouse click) at game pixel (x, y) of the 320×180 screen
 *   Code[:ms]        press (or hold) a key; wait:ms; shot:name; log (prints state); eval:js
 * Prints a state line after each step; exits non-zero on page errors.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const query = args[0] ?? 'debug=title';
const out = resolve(args[1] ?? 'play.png');
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
// --sep ";" lets eval steps contain commas.
const steps = opt('steps', 'auto').split(opt('sep', ',')).filter(Boolean);
const [vw, vh] = opt('size', '640x360').split('x').map(Number);
const quiet = args.includes('--quiet');
/** --canvas: screenshots show only the game screen (handy with --touch / phone sizes). */
const canvasOnly = args.includes('--canvas');

const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const addr = server.httpServer.address();
// The bundled browser may be missing (e.g. a sandbox with a preinstalled Chromium): fall back to PW_CHROMIUM or
// /opt/pw-browsers/chromium.
const launch = (executablePath) => chromium.launch({ executablePath });
const browser = await launch(process.env.PW_CHROMIUM || undefined).catch((e) => {
  if (existsSync('/opt/pw-browsers/chromium')) return launch('/opt/pw-browsers/chromium');
  throw e;
});
const touch = args.includes('--touch');
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack ?? e)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
await page.goto(`http://127.0.0.1:${addr.port}/?${query}`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__veilleuse);
await page.waitForTimeout(600);

const state = () =>
  page.evaluate(() => {
    const v = window.__veilleuse;
    const top = v.game.top;
    const d = v.dialogue;
    const st = v.G.state;
    const s = {
      top: top?.constructor?.name ?? 'none',
      dlg: d.busy,
      choices: d.choices ? d.choices.length : 0,
      worldBusy: v.world.busy,
      map: st.map,
      hp: st.hp,
      chapter: st.chapter,
    };
    if ('mode' in (top ?? {}) && 'enemies' in top) {
      s.battle = top.mode;
      s.bhp = top.hp;
      if (Array.isArray(top.menuLabels)) s.labels = top.menuLabels.join('|');
      s.enemies = top.enemies.map((e) => `${e.def.id}:${Math.round(e.hp)}hp:${Math.round((e.calm ?? 0) * 100)}%${e.spareable ? ':spare' : ''}`).join(' ');
      s.waitInput = !!top.text?.waitInput;
      if (top.list) s.list = top.list.items.join('|');
      if (top.nb) s.nb = top.nb.writing ? 'writing' : true;
    }
    return s;
  });

const press = async (code, ms = 0) => {
  if (ms) {
    await page.keyboard.down(code);
    await page.waitForTimeout(ms);
    await page.keyboard.up(code);
  } else {
    await page.keyboard.down(code);
    await page.waitForTimeout(40);
    await page.keyboard.up(code);
  }
  await page.waitForTimeout(60);
};

let god = false;
const refill = () => page.evaluate(() => {
  const b = window.__veilleuse.game.top;
  if (b && 'hp' in b && 'enemies' in b) b.hp = b.maxHp;
});

async function auto(limit = 30000) {
  const t0 = Date.now();
  let idle = 0;
  while (Date.now() - t0 < limit) {
    const s = await state();
    if (s.choices) return `choice(${s.choices})`;
    if (s.dlg) {
      idle = 0;
      await press('KeyZ');
      await page.waitForTimeout(80);
      continue;
    }
    if (s.battle) {
      if (s.battle === 'menu' || s.battle === 'list' || (s.battle === 'notebook' && s.nb !== 'writing') || s.battle === 'bar') return `battle:${s.battle}`;
      if (s.battle === 'text' || s.battle === 'idle') await press('KeyZ');
      else if (s.battle === 'dodge') {
        if (god) await refill();
        await press(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(Math.random() * 4)], 120);
      }
      await page.waitForTimeout(80);
      continue;
    }
    if (s.top === 'WorldScene' && s.worldBusy === 0) {
      if (++idle > 6) return 'free';
    } else idle = 0;
    // Scenes like chapter cards, souvenirs, papers, crash screens: confirm.
    if (s.top !== 'WorldScene' && !s.battle) await press('KeyZ');
    await page.waitForTimeout(150);
  }
  return 'timeout';
}

async function chooseList(n) {
  const s = await state();
  const up = s.battle ? 'ArrowUp' : 'ArrowUp';
  for (let i = 0; i < 12; i++) await press(up);
  for (let i = 0; i < n; i++) await press('ArrowDown');
  await press('KeyZ');
}

async function menu(n) {
  const cur = await page.evaluate(() => window.__veilleuse.game.top.menuIdx ?? 0);
  for (let i = 0; i < (n - cur + 4) % 4; i++) await press('ArrowRight');
  await press('KeyZ');
  await page.waitForTimeout(250);
}

async function write(word) {
  await menu(1);
  let s = await state();
  if (s.battle === 'list') {
    await press('KeyZ');
    await page.waitForTimeout(250);
    s = await state();
  }
  if (s.battle !== 'notebook') return `no-notebook(${s.battle})`;
  // Select by word text, by emotion name, or "observe"; falls back to the first word.
  const picked = await page.evaluate((w) => {
    const nb = window.__veilleuse.game.top.nb;
    const words = nb.words.map((x) => `${x.text}/${x.emotion}`);
    let idx = w === 'observe' ? 0 : nb.words.findIndex((x) => x.text === w) + 1;
    if (idx <= 0 && w !== 'observe') idx = nb.words.findIndex((x) => x.emotion === w) + 1;
    if (idx < 0 || (idx === 0 && w !== 'observe')) idx = 1;
    nb.idx = idx;
    return `${idx ? nb.words[idx - 1].text : 'observe'} [${words.join(' ')}]`;
  }, word);
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(200);
    await press('KeyZ');
    const st = await state();
    if (st.battle !== 'notebook' || st.nb === 'writing') break;
  }
  return picked;
}

/** Taps game pixel (x, y): converts through the canvas bounding box (whatever the scale / layout). */
async function tapAt(xy) {
  // "tap:@id" taps an overworld entity where it is drawn; "tap:x/y" taps game pixels.
  const [gx, gy] = xy.startsWith('@')
    ? await page.evaluate((id) => {
        const w = window.__veilleuse.world;
        const e = w.get(id);
        return e ? [Math.round(e.x - Math.round(w.camX)), Math.round(e.y - 8 - Math.round(w.camY))] : [-99, -99];
      }, xy.slice(1))
    : xy.split('/').map(Number);
  const r = await page.evaluate(() => {
    const b = document.getElementById('game').getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  const px = r.x + ((gx + 0.5) * r.w) / 320;
  const py = r.y + ((gy + 0.5) * r.h) / 180;
  if (touch) await page.touchscreen.tap(px, py);
  else await page.mouse.click(px, py);
  await page.waitForTimeout(120);
  return `${Math.round(px)},${Math.round(py)}`;
}

const snap = async (path) => {
  const clip = canvasOnly
    ? await page.evaluate(() => {
        const b = document.getElementById('game').getBoundingClientRect();
        return { x: b.left, y: b.top, width: b.width, height: b.height };
      })
    : undefined;
  await page.screenshot({ path, clip });
};

async function swipe(arg) {
  const [x1, y1, x2, y2] = arg.split('/').map(Number);
  const r = await page.evaluate(() => {
    const b = document.getElementById('game').getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  const P = (gx, gy) => [r.x + (gx * r.w) / 320, r.y + (gy * r.h) / 180];
  await page.mouse.move(...P(x1, y1));
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(...P(x1 + ((x2 - x1) * k) / 6, y1 + ((y2 - y1) * k) / 6));
  await page.mouse.up();
  await page.waitForTimeout(150);
}

const shotPath = (name) => out.replace(/\.png$/, `-${name}.png`);
for (const step of steps) {
  const colon = step.indexOf(':');
  const cmd = colon < 0 ? step : step.slice(0, colon);
  const arg = colon < 0 ? undefined : step.slice(colon + 1);
  let res = '';
  if (cmd === 'auto') res = await auto(arg ? Number(arg) : 30000);
  else if (cmd === 'choose') await chooseList(Number(arg));
  else if (cmd === 'menu') await menu(Number(arg));
  else if (cmd === 'hit') {
    await menu(0);
    await page.waitForTimeout(Number(arg ?? 700));
    await press('KeyZ');
  } else if (cmd === 'write') res = (await write(arg)) ?? 'no-notebook';
  else if (cmd === 'dodge') {
    const t0 = Date.now();
    while (Date.now() - t0 < Number(arg ?? 15000)) {
      const s = await state();
      if (s.battle !== 'dodge') break;
      await press(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(Math.random() * 4)], 150);
    }
  } else if (cmd === 'wait') await page.waitForTimeout(Number(arg));
  else if (cmd === 'shot') await snap(shotPath(arg));
  else if (cmd === 'log') res = '';
  else if (cmd === 'god') god = arg !== 'off';
  else if (cmd === 'until') {
    // Advance text until the battle reaches the given mode (e.g. until:dodge).
    const t0 = Date.now();
    for (;;) {
      const st = await state();
      if (st.battle === arg || Date.now() - t0 > 20000) break;
      if (st.dlg || st.battle === 'text' || st.battle === 'idle') await press('KeyZ');
      await page.waitForTimeout(60);
    }
  }
  else if (cmd === 'load')
    res = await page.evaluate((ms) => {
      const [m, sp] = ms.split('/');
      window.__veilleuse.world.load(m, sp);
      return m;
    }, arg);
  else if (cmd === 'flag')
    res = await page.evaluate((kv) => {
      const [k, v] = kv.split('=');
      window.__veilleuse.G.state.flags[k] = v === undefined ? true : isNaN(Number(v)) ? v : Number(v);
      return kv;
    }, arg);
  else if (cmd === 'interact')
    res = await page.evaluate((id) => {
      const v = window.__veilleuse;
      const e = v.world.get(id);
      if (!e) return `no entity ${id}: ${v.world.entities.map((x) => x.id).join(' ')}`;
      if (!e.interact) return `entity ${id} has no script`;
      v.world.hooks.run(e.interact);
      return 'ran';
    }, arg);
  else if (cmd === 'go')
    res = await page.evaluate((xy) => {
      const [x, y] = xy.split('/').map(Number);
      const p = window.__veilleuse.world.player;
      p.x = x * 16 + 8;
      p.y = y * 16 + 14;
      window.__veilleuse.world.resetFollower?.();
      return `${x},${y}`;
    }, arg);
  else if (cmd === 'eval') res = String(await page.evaluate(arg));
  else if (cmd === 'tap') res = await tapAt(arg);
  else if (cmd === 'swipe') await swipe(arg);
  else await press(cmd, arg ? Number(arg) : 0);
  if (!quiet || cmd === 'auto' || cmd === 'log') console.log(`${step.padEnd(18)} → ${res} ${JSON.stringify(await state())}`);
}
await snap(out);
// English runs (lang=en): list the French strings that were displayed without a translation (dev builds only).
const untranslated = await page.evaluate(() => window.__veilleuse.i18nMissing?.() ?? []).catch(() => []);
if (untranslated.length)
  console.log(`i18n: ${untranslated.length} untranslated string(s) shown:\n  ${untranslated.slice(0, 40).map((s) => JSON.stringify(s)).join('\n  ')}`);
if (errors.length) {
  console.log('PAGE ERRORS/WARNINGS:\n' + [...new Set(errors)].slice(0, 30).join('\n'));
  process.exitCode = 1;
} else console.log('ok, no page errors');
await browser.close();
await server.close();

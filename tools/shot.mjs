#!/usr/bin/env node
/**
 * Visual check helper: renders the game (dev server) with a debug query and saves a PNG.
 *
 *   node tools/shot.mjs "debug=sheet&filter=b_" out.png
 *   node tools/shot.mjs "debug=map&map=prairie" out.png --wait 1500 --keys "ArrowRight:600,KeyZ"
 *   node tools/shot.mjs "debug=battle&enemies=nuage" out.png --keys "KeyZ,KeyZ" --size 1280x720
 *
 * --keys: comma-separated key codes; "Code:ms" holds the key for ms; "wait:ms" pauses.
 * Several shots in one run: --shots "500,1500,3000" (saves out-1.png, out-2.png, …).
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const query = args[0] ?? 'debug=title';
const out = resolve(args[1] ?? 'shot.png');
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const wait = Number(opt('wait', '1200'));
const keys = opt('keys', '');
const shots = opt('shots', '');
const [vw, vh] = opt('size', '1280x720').split('x').map(Number);

const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const addr = server.httpServer.address();
const url = `http://127.0.0.1:${addr.port}/?${query}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(wait);
for (const k of keys.split(',').filter(Boolean)) {
  const [code, ms] = k.split(':');
  if (code === 'wait') {
    await page.waitForTimeout(Number(ms));
    continue;
  }
  if (ms) {
    await page.keyboard.down(code);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(code);
  } else {
    await page.keyboard.press(code);
    await page.waitForTimeout(120);
  }
}
const sheet = await page.$('#sheet');
if (shots) {
  let last = 0;
  const list = shots.split(',').map(Number);
  for (const [i, t] of list.entries()) {
    await page.waitForTimeout(Math.max(0, t - last));
    last = t;
    await page.screenshot({ path: out.replace(/\.png$/, `-${i + 1}.png`) });
  }
} else if (sheet) {
  await sheet.screenshot({ path: out });
} else {
  await page.waitForTimeout(200);
  await page.screenshot({ path: out });
}
if (errors.length) console.log('PAGE ERRORS/WARNINGS:\n' + [...new Set(errors)].slice(0, 30).join('\n'));
else console.log('ok, no page errors');
await browser.close();
await server.close();

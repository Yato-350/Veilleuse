#!/usr/bin/env node
/**
 * Replays the saved bot scenarios (tools/scenarios/*.txt) and prints a pass/fail summary.
 *
 *   node tools/run-scenarios.mjs                       every scenario, 3 at a time, screenshots in ./scenario-shots/
 *   node tools/run-scenarios.mjs lot0 v11 --jobs 2     only the scenarios whose file name contains « lot0 » or « v11 »
 *   node tools/run-scenarios.mjs --out /tmp/shots      screenshots elsewhere
 *
 * Each scenario runs `node tools/play.mjs --scenario <file> <out>/<name>.png --quiet` (its own vite server and
 * browser). A scenario passes when play.mjs exits 0: no page error, every assert/waitfor/zuntil satisfied.
 * Exits non-zero when one fails; the failing run's output is printed.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const filters = args.filter((a, i) => !a.startsWith('--') && !['--jobs', '--out'].includes(args[i - 1] ?? ''));
const jobs = Math.max(1, Number(opt('jobs', 3)));
const outDir = resolve(opt('out', 'scenario-shots'));
mkdirSync(outDir, { recursive: true });

const dir = resolve('tools/scenarios');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.txt'))
  .filter((f) => !filters.length || filters.some((s) => f.includes(s)))
  .sort();
if (!files.length) {
  console.log('no scenario matches');
  process.exit(1);
}

function run(file) {
  return new Promise((done) => {
    const name = basename(file, '.txt');
    const t0 = Date.now();
    const child = spawn(process.execPath, ['tools/play.mjs', '--scenario', join(dir, file), join(outDir, `${name}.png`), '--quiet'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    child.stdout.on('data', (b) => (log += b));
    child.stderr.on('data', (b) => (log += b));
    child.on('close', (code) => {
      const s = ((Date.now() - t0) / 1000).toFixed(0);
      console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${name} (${s} s)`);
      if (code !== 0) console.log(log.replace(/^/gm, '      '));
      done(code === 0);
    });
  });
}

const queue = [...files];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) results.push(await run(queue.shift()));
  }),
);
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed}/${results.length} scenario(s) passed — screenshots in ${outDir}`);
process.exitCode = failed ? 1 : 0;

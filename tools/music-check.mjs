#!/usr/bin/env node
/** Prints the length of every music track and checks that all channels loop in sync. Usage: node tools/music-check.mjs */
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', root: process.cwd() });
const { TRACKS } = await server.ssrLoadModule('/src/data/music.ts');
const { parsePattern } = await server.ssrLoadModule('/src/engine/audio.ts');
let ok = true;
for (const [id, t] of Object.entries(TRACKS)) {
  const lens = t.channels.map((c) => parsePattern(c.pattern).length);
  const max = Math.max(...lens);
  const bad = lens.filter((l) => max % l !== 0);
  const secs = (max / t.stepsPerBeat) * (60 / t.bpm);
  console.log(id.padEnd(12), 'steps', lens.join(','), `→ ${secs.toFixed(1)}s`, bad.length ? 'MISALIGNED' : '');
  if (bad.length) ok = false;
  for (const c of t.channels) {
    for (const ev of parsePattern(c.pattern).events) for (const m of ev.midis) if (!ev.hit && (m < 24 || m > 100)) { console.log('  range!', id, c.inst, m); ok = false; }
  }
}
console.log(ok ? 'ALL OK' : 'PROBLEMS');
await server.close();

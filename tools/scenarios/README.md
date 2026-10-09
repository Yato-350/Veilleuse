# Bot scenarios

Saved proof runs of the playtest bot: each `.txt` file is a query plus one step per line, replayed with
`node tools/play.mjs --scenario tools/scenarios/<file>.txt [out.png] [--quiet]`, or all at once with
`node tools/run-scenarios.mjs [name filters…] [--jobs 3] [--out dir]` (exit code 1 when one fails).

Format: `#` starts a comment line; `query: <url query>` (e.g. `debug=script&name=c1_sheep&lang=fr`); optional
`size: 640x360`, `touch: true`, `canvas: true`, `lang: en`; then the steps of `tools/play.mjs`, one per line (so they
may contain commas), plus three checks that fail the run: `assert: <js>` (falsy = failure), `waitfor: <js>` (waits up
to 20 s) and `zuntil: <js>` (presses Z until true, up to 30 s). `window.__veilleuse` = { game, world, G, MAPS,
dialogue, fx, scene, flow, readSave, readMeta }. Name files by lot (`lot0-…`, `lot1-…`); `v11-…` files check that
version 1.1 still plays.

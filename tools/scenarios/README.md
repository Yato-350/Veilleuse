# Bot scenarios

Saved proof runs of the playtest bot: each `.txt` file is a query plus one step per line, replayed with
`node tools/play.mjs --scenario tools/scenarios/<file>.txt [out.png] [--quiet]`, or all at once with
`node tools/run-scenarios.mjs [name filters…] [--jobs 3] [--out dir]` (exit code 1 when one fails).

Format: `#` starts a comment line; `query: <url query>` (e.g. `debug=script&name=c1_sheep&lang=fr`); optional
`size: 640x360`, `touch: true`, `canvas: true`, `lang: en`; then the steps of `tools/play.mjs`, one per line (so they
may contain commas), plus three checks that fail the run: `assert: <js>` (falsy = failure), `waitfor: <js>` (waits up
to 20 s) and `zuntil: <js>` (presses Z until true, up to 30 s). `window.__veilleuse` = { game, world, G, MAPS,
dialogue, fx, scene, flow, readSave, readMeta, clock, cameBack } (`clock.set('3:14')`, `clock.shift(ms)`: the game's
real clock; `cameBack(from, to)`: a return to the tab). A memory can be simulated in the query with
`&meta=endings:aube,callVersion:douce` and the clock set with `&clock=3:14` (lot 10). Name files by lot (`lot0-…`, `lot1-…`); `v11-…` files check that
version 1.1 saves and screens still work; `v2_aube` plays a whole new game, from the title to the end credits through
the six chapters (about 25 minutes: run it alone, `node tools/run-scenarios.mjs v2_aube --jobs 1`).

The whole suite (every file but `v2_aube`) takes about 95 minutes with `--jobs 2`. English proofs end on
`assert: window.__veilleuse.i18nMissing().length === 0` (dev builds list every French string shown without a
translation); `lot13-*-en` play every ending, the bonus and the title/credits in English. The CI job « End-to-end »
replays a short smoke subset (`v11-prologue v11-saves v11-title-credits v11-wake3 lot0-titles lot1-battle-regulars
lot13-silence-en`, a few minutes) after the Playwright tests.

In battles, `auto` presses A only when the battle waits for it (a text to confirm, speech bubbles): a press sent while
the battle moves on by itself could land on the menu that opens meanwhile. `menu:N` closes a notebook or list left open
before picking the button.

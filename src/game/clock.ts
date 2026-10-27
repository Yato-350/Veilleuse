/**
 * The real clock, as the game reads it (the {time} variable, the night narrator, the 3:14 phone, the title's hour).
 * Debug and the playtest bot can set or shift it (`?debug=…&clock=3:14`, `window.__veilleuse.clock`); the offset lives
 * in memory only and is never saved.
 */
let offset = 0;

/** Current real time (ms), with the debug offset. */
export function nowMs(): number {
  return Date.now() + offset;
}

/** Current real date, with the debug offset. */
export function now(): Date {
  return new Date(nowMs());
}

/** Debug: makes the clock read `h:mm` (local time, today) from now on. Returns false if `hhmm` is not a time. */
export function setClock(hhmm: string): boolean {
  const m = /^(\d{1,2})[:h](\d{2})(?::(\d{2}))?$/.exec(hhmm.trim());
  if (!m) return false;
  const want = new Date();
  want.setHours(Number(m[1]), Number(m[2]), Number(m[3] ?? 0), 0);
  offset = want.getTime() - Date.now();
  return true;
}

/** Debug: moves the clock forward (or back) by `ms`. */
export function shiftClock(ms: number): void {
  offset += ms;
}

/** Debug: back to the real time. */
export function resetClock(): void {
  offset = 0;
}

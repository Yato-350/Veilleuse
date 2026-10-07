import { charWidth } from '../../engine/font';

export type TextFx = 'none' | 'wave' | 'shake' | 'glitch';

export interface RichChar {
  ch: string;
  color: string | null;
  fx: TextFx;
  /** Extra frames to wait after this char is revealed. */
  pause: number;
  /** Reveal speed multiplier from this char on. */
  speed: number;
}

export const NAMED_COLORS: Record<string, string> = {
  y: '#ffd84a',
  r: '#ff4a5a',
  b: '#5aa8ff',
  p: '#f8b6cf',
  v: '#b06aff',
  g: '#8a7f96',
  o: '#f09a4a',
  l: '#8fd28a',
  a: '#7ee0e0',
  k: '#1c1424',
};

const PUNCT_PAUSE: Record<string, number> = { '.': 10, '!': 10, '?': 10, '…': 16, ',': 5, ';': 6, ':': 6 };

/**
 * Parses dialogue markup.
 *   {c:y} … {/c}      color (named or #hex)
 *   {wave} {shake} {glitch} and their closing tags
 *   {p:20} / {p}      pause
 *   {spd:0.5}         speed multiplier
 *   {anyVar}          variable substitution
 */
export function parseRich(text: string, vars: Record<string, string> = {}): RichChar[] {
  // Variables first (they may not contain markup).
  const src = text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));
  const out: RichChar[] = [];
  let color: string | null = null;
  let fx: TextFx = 'none';
  let speed = 1;
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '{') {
      const end = src.indexOf('}', i);
      if (end > i) {
        const tag = src.slice(i + 1, end);
        i = end + 1;
        const [name, arg] = tag.split(':') as [string, string | undefined];
        switch (name) {
          case 'c':
            color = arg ? (NAMED_COLORS[arg] ?? (arg.startsWith('#') ? arg : null)) : null;
            break;
          case '/c':
            color = null;
            break;
          case 'wave':
          case 'shake':
          case 'glitch':
            fx = name;
            break;
          case '/wave':
          case '/shake':
          case '/glitch':
            fx = 'none';
            break;
          case 'p': {
            const n = arg ? parseInt(arg, 10) : 20;
            if (out.length) out[out.length - 1]!.pause += n;
            else out.push({ ch: '', color, fx, pause: n, speed });
            break;
          }
          case 'spd':
            speed = arg ? parseFloat(arg) : 1;
            break;
          default:
            // Unknown tag: keep literally.
            for (const ch of `{${tag}}`) out.push({ ch, color, fx, pause: 0, speed });
        }
        continue;
      }
    }
    // Iterate by code point (handles characters outside the BMP).
    const cp = src.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    i += ch.length;
    const next = src[i];
    // Pause after punctuation only when followed by whitespace (not inside "..." or at the very end).
    const pause = PUNCT_PAUSE[ch] && (next === ' ' || next === '\n') ? PUNCT_PAUSE[ch]! : 0;
    out.push({ ch, color, fx, pause, speed });
  }
  return out;
}

/** Word-wraps rich characters into lines. */
export function layoutRich(chars: RichChar[], maxWidth: number): RichChar[][] {
  const lines: RichChar[][] = [];
  let line: RichChar[] = [];
  let lineW = 0;
  let word: RichChar[] = [];
  let wordW = 0;
  const flushWord = () => {
    if (!word.length) return;
    if (lineW + wordW > maxWidth && line.length) {
      // Drop trailing space before breaking.
      while (line.length && line[line.length - 1]!.ch === ' ') line.pop();
      lines.push(line);
      line = [];
      lineW = 0;
    }
    line.push(...word);
    lineW += wordW;
    word = [];
    wordW = 0;
  };
  for (const rc of chars) {
    if (rc.ch === '\n') {
      flushWord();
      lines.push(line);
      line = [];
      lineW = 0;
      continue;
    }
    if (rc.ch === ' ') {
      flushWord();
      if (line.length) {
        line.push(rc);
        lineW += charWidth(' ');
      }
      continue;
    }
    word.push(rc);
    wordW += rc.ch ? charWidth(rc.ch) : 0;
  }
  flushWord();
  if (line.length || !lines.length) lines.push(line);
  return lines;
}

export function plainText(text: string, vars: Record<string, string> = {}): string {
  return parseRich(text, vars)
    .map((c) => c.ch)
    .join('');
}

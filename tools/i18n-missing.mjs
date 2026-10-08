#!/usr/bin/env node
/**
 * i18n coverage helper.
 *
 *   node tools/i18n-missing.mjs <source.ts…>                 list display strings with no English translation
 *   node tools/i18n-missing.mjs --manifest                    same, for every file in src/i18n/manifest.json
 *   node tools/i18n-missing.mjs <source.ts…> --write <cat.ts> also append the missing keys (empty values) to a catalog
 *   node tools/i18n-missing.mjs <source.ts…> --all            list every display string found (translated or not)
 *
 * "Display strings" are found heuristically (see `isDisplay`): string/template literals containing letters and a space,
 * an accented letter or a capitalised word. Ids, sprite keys, flags, colors, imports, object keys, comparisons,
 * console/Error messages and rich-text-only strings are skipped. Opt-outs:
 *   - `/* i18n-ignore *\/` (or `// i18n-ignore`) on a line skips every string of that line;
 *   - `// i18n-ignore-start` … `// i18n-ignore-end` skips a whole region.
 * Template literals with `${…}` cannot be looked up: they are reported as "dynamic" and must be converted to
 * `tf('… {0} …', value)` (see docs/I18N.md).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG_DIR = join(ROOT, 'src/i18n/en');
export const MANIFEST = join(ROOT, 'src/i18n/manifest.json');

// ---------------------------------------------------------------------------
// Tokenizer: finds string literals with a little context (enclosing call, neighbours, ignore comments).
// ---------------------------------------------------------------------------

const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

function unescape(raw) {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g, (_, e) => {
    if (e[0] === 'u') return String.fromCodePoint(parseInt(e[1] === '{' ? e.slice(2, -1) : e.slice(1), 16));
    if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e === '\n' || e === '\r\n') return '';
    return ESC[e] ?? e;
  });
}

/** Marks a `${…}` hole of a template literal while it is unescaped. */
const HOLE = '\uE000';

const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '']);

/**
 * @returns {{ value: string, line: number, quote: string, dynamic: boolean, call: string, prev: string, next: string,
 *   ignored: boolean }[]}
 */
export function tokenize(src, firstLine = 1, parentIgnored = null) {
  const out = [];
  let ignoredLines = parentIgnored;
  if (!ignoredLines) {
    ignoredLines = new Set();
    let region = false;
    src.split('\n').forEach((l, i) => {
      if (/i18n-ignore-start/.test(l)) region = true;
      if (region || /i18n-ignore(?![-\w])/.test(l)) ignoredLines.add(i + 1);
      if (/i18n-ignore-end/.test(l)) region = false;
    });
  }

  let i = 0;
  let line = firstLine;
  const n = src.length;
  /** Stack of call names for each open paren / brace / template expression. */
  const stack = [];
  let lastSig = ''; // last significant (non-space, non-comment) char
  let lastWord = ''; // last identifier chain before current position

  /** Name of the call the string is a direct argument of ('' inside an object/array literal). */
  const callName = () => {
    const top = stack[stack.length - 1];
    return top && top.kind === '(' ? top.name : '';
  };
  const nextSig = (from) => {
    let j = from;
    while (j < n) {
      const c = src[j];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') j++;
      else if (c === '/' && src[j + 1] === '/') while (j < n && src[j] !== '\n') j++;
      else if (c === '/' && src[j + 1] === '*') j = src.indexOf('*/', j + 2) + 2 || n;
      else break;
    }
    return src.slice(j, j + 3);
  };

  const readTemplate = (start) => {
    // src[start] === '`'; returns [endIndex, cooked-with-{}placeholders, dynamic]
    let j = start + 1;
    let raw = '';
    let dynamic = false;
    while (j < n && src[j] !== '`') {
      if (src[j] === '\\') {
        raw += src.slice(j, j + 2);
        j += 2;
      } else if (src[j] === '$' && src[j + 1] === '{') {
        dynamic = true;
        raw += HOLE;
        const from = j + 2;
        const fromLine = line;
        j = skipExpr(from);
        // Strings inside the expression (`${ok ? 'Oui' : 'Non'}`) are display strings too.
        out.push(...tokenize(src.slice(from, j - 1), fromLine, ignoredLines));
      } else {
        if (src[j] === '\n') line++;
        raw += src[j++];
      }
    }
    return [j + 1, unescape(raw).split(HOLE).join('${}'), dynamic];
  };

  // Skips a `${ … }` expression (nested strings included); returns index after the closing brace.
  const skipExpr = (j) => {
    let depth = 1;
    while (j < n && depth > 0) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '\n') line++;
      else if (c === "'" || c === '"') {
        const q = c;
        j++;
        while (j < n && src[j] !== q) j += src[j] === '\\' ? 2 : 1;
      } else if (c === '`') {
        j = readTemplate(j)[0] - 1;
      }
      j++;
    }
    return j;
  };

  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      for (let k = i; k < end; k++) if (src[k] === '\n') line++;
      i = end;
      continue;
    }
    if (c === '/' && (REGEX_PREV.has(lastSig) || /^(return|typeof|case|in|of)$/.test(lastWord))) {
      // Regex literal.
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') j += 2;
        else {
          if (src[j] === '[') cls = true;
          else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) break;
          j++;
        }
      }
      i = j + 1;
      while (i < n && /[a-z]/.test(src[i])) i++;
      lastSig = ')';
      lastWord = '';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const startLine = line;
      const prev = lastSig;
      const prevWord = lastWord;
      let value;
      let end;
      let dynamic = false;
      if (c === '`') {
        [end, value, dynamic] = readTemplate(i);
      } else {
        let j = i + 1;
        while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
        end = j + 1;
        value = unescape(src.slice(i + 1, j));
      }
      let ignored = false;
      for (let l = startLine; l <= line; l++) if (ignoredLines.has(l)) ignored = true;
      const before = src.slice(Math.max(0, i - 6), i).trimEnd();
      out.push({ value, line: startLine, quote: c, dynamic, call: callName(), prev, prevWord, before, next: nextSig(end), ignored });
      i = end;
      lastSig = 's';
      lastWord = '';
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[\w$]/.test(src[j])) j++;
      const w = src.slice(i, j);
      lastWord = lastSig === '.' && lastWord ? `${lastWord}.${w}` : w;
      lastSig = 'w';
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      while (i < n && /[\w.]/.test(src[i])) i++;
      lastSig = '0';
      lastWord = '';
      continue;
    }
    if (c === '(' || c === '{' || c === '[') {
      stack.push({ kind: c, name: c === '(' && lastSig === 'w' ? lastWord : '' });
    } else if (c === ')' || c === '}' || c === ']') {
      stack.pop();
    }
    if (c !== '.' && c !== '?' && c !== '!') lastWord = c === '.' ? lastWord : '';
    if (c === '?' && src[i + 1] === '.') {
      // Optional chaining: `a?.b` continues the chain, `f?.(…)` is still a call of f.
      i += 2;
      lastSig = src[i] === '(' ? 'w' : '.';
      continue;
    }
    lastSig = c;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Display heuristic
// ---------------------------------------------------------------------------

const SKIP_CALLS =
  /^(console\.\w+|Error|TypeError|RangeError|super|require|import|querySelector|querySelectorAll|getElementById|createElement|addEventListener|removeEventListener|setAttribute|getAttribute|getItem|setItem|removeItem|matchMedia|postMessage|fetch|getContext|has|hasSpr|spr|sprite|flag|set|setFlag|music|sfx|emote|face|spawn|load|warp|get|find|remove|show|follower|souvenir|take|give|startsWith|endsWith|includes|indexOf|split|replace|test|match|search|tile|prop|play|ambience)$/;
const KEY_NAMES = /^(Escape|Enter|Space|Backspace|Tab|Shift(Left|Right)?|Control(Left|Right)?|Alt(Left|Right)?|Meta(Left|Right)?|Arrow(Up|Down|Left|Right)|Key[A-Z]|Digit\d|Numpad\w*|F\d+|Home|End|PageUp|PageDown|Delete|Insert|ContextMenu)$/;
const ACCENTED = /[À-ÖØ-öø-ÿŒœ]/;

/** Strips rich-text tags ({c:y}, {/c}, {p:20}, {wave}…) and template placeholders. */
export const stripMarkup = (s) => s.replace(/\$\{\}/g, '0').replace(/\{[^{}\s]*\}/g, '');

export function isDisplay(tok) {
  if (tok.ignored) return false;
  const v = tok.value;
  if (/^(import|from|export)$/.test(tok.prevWord) || tok.call === 'import') return false;
  if (SKIP_CALLS.test(tok.call) || SKIP_CALLS.test(tok.call.split('.').pop())) return false;
  // Object keys ({ 'clé': … }) and comparisons (x === 'id', case 'id':).
  if ((tok.prev === '{' || tok.prev === ',') && tok.next.startsWith(':')) return false;
  if (tok.prevWord === 'case') return false;
  if (/[=!]=$/.test(tok.before)) return false;
  if (/^[=!]=/.test(tok.next)) return false;
  const text = stripMarkup(v).trim();
  if (!/[A-Za-zÀ-ÖØ-öø-ÿŒœ]/.test(text)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text) || /^(https?:|\.{0,2}\/|data:)/.test(text) || /^[\w./-]+\.(png|svg|json|ts|js|mjs|css|html|webmanifest|mp3|ogg|wav)$/.test(text)) return false;
  if (KEY_NAMES.test(text)) return false;
  if (/^\d*(px|em|%)?\s*(bold |italic )*[\d.]+px\s/.test(text)) return false; // CSS font
  if (/^(rgba?|hsla?)\(/.test(text)) return false;
  // Pixel-art / tile grids: multi-line strings without real words.
  if (/\n/.test(text) && !/[A-Za-zÀ-ÿŒœ]{2,}\s+\S*[A-Za-zÀ-ÿŒœ]/.test(text)) return false;
  const rows = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (rows.length > 1 && rows.every((r) => r.length >= 4 && r.length === rows[0].length && !/\s/.test(r))) return false;
  const hasSpace = /\S\s+\S/.test(text);
  const hasAccent = ACCENTED.test(text) || /[A-Za-z]['’][a-zà-ÿ]/.test(text); // accents or French elision (l'aube)
  const capWord =
    /(^|[^\w])[A-ZÀ-Ý][a-zà-ÿ]+(?![A-Z\d_])/.test(text) || /(^|[^\wÀ-ÿ])[A-ZÀ-ÖØ-Ý]{2,}([^\wÀ-ÿ]|$)/.test(text);
  const identifier = /^[A-Za-z_$][\w$-]*$/.test(text) && (/[a-z][A-Z]|_|\d/.test(text) || text === text.toLowerCase());
  if (identifier) return false;
  if (/^[a-z_\d.:@/-]+$/.test(text)) return false; // ids, sprite keys, flags
  return hasSpace || hasAccent || capWord;
}

/** Display strings of a source file. Dynamic ones (template literals with `${…}`) are flagged. */
export function extractStrings(src) {
  return tokenize(src)
    .filter(isDisplay)
    .map((t) => ({ value: t.value, line: t.line, dynamic: t.dynamic }));
}

// ---------------------------------------------------------------------------
// Catalogs (parsed from source so the tool needs no TS loader)
// ---------------------------------------------------------------------------

/** Parses `'french': 'english',` pairs of one catalog file. */
export function parseCatalog(src) {
  const toks = tokenize(src);
  const map = new Map();
  for (let k = 0; k < toks.length - 1; k++) {
    const a = toks[k];
    if (a.next.startsWith(':') && !a.dynamic) {
      const b = toks[k + 1];
      map.set(a.value, b.value);
      k++;
    }
  }
  return map;
}

export function loadCatalog(dir = CATALOG_DIR) {
  const map = new Map();
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.ts') || f === 'index.ts') continue;
    for (const [k, v] of parseCatalog(readFileSync(join(dir, f), 'utf8'))) map.set(k, v);
  }
  return map;
}

export function readManifest() {
  return JSON.parse(readFileSync(MANIFEST, 'utf8')).files;
}

/** Missing translations of the given files: { file, line, value, dynamic }[]. */
export function findMissing(files, catalog = loadCatalog()) {
  const out = [];
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const s of extractStrings(src)) {
      if (s.dynamic || !catalog.get(s.value)) out.push({ file, ...s });
    }
  }
  return out;
}

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

function appendSkeleton(catalogFile, keys) {
  const path = join(ROOT, catalogFile);
  let src = existsSync(path)
    ? readFileSync(path, 'utf8')
    : `/** English catalog: ${relative(ROOT, path)}. */\nexport const EN: Record<string, string> = {\n};\n`;
  const existing = parseCatalog(src);
  const add = [...new Set(keys)].filter((k) => !existing.has(k));
  if (!add.length) return 0;
  const end = src.lastIndexOf('};');
  src = src.slice(0, end) + add.map((k) => `  ${quote(k)}: '',\n`).join('') + src.slice(end);
  writeFileSync(path, src);
  return add.length;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const wi = args.indexOf('--write');
  const writeTo = wi >= 0 ? args.splice(wi, 2)[1] : null;
  const all = args.includes('--all');
  let files = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--manifest')) files = readManifest();
  if (!files.length) {
    console.log('usage: node tools/i18n-missing.mjs <file.ts…> | --manifest [--write src/i18n/en/x.ts] [--all]');
    process.exit(1);
  }
  const catalog = loadCatalog();
  let missing = 0;
  let dyn = 0;
  const keys = [];
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    const rows = extractStrings(src).filter((s) => all || s.dynamic || !catalog.get(s.value));
    if (!rows.length) continue;
    console.log(`\n${file}`);
    for (const s of rows) {
      const tag = s.dynamic ? 'DYNAMIC (use tf)' : catalog.get(s.value) ? 'ok' : 'missing';
      console.log(`  ${String(s.line).padStart(4)}  ${tag.padEnd(16)} ${JSON.stringify(s.value)}`);
      if (s.dynamic) dyn++;
      else if (!catalog.get(s.value)) {
        missing++;
        keys.push(s.value);
      }
    }
  }
  console.log(`\n${missing} missing, ${dyn} dynamic template(s) to convert.`);
  // Keys already present in another catalog (even untranslated) are not duplicated.
  if (writeTo) console.log(`${appendSkeleton(writeTo, keys.filter((k) => !catalog.has(k)))} key(s) added to ${writeTo}.`);
  process.exitCode = missing || dyn ? 1 : 0;
}

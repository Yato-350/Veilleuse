#!/usr/bin/env node
/**
 * Generates the PWA / favicon / social images from a procedural pixel-art design (no image editor needed).
 * Output: public/icons/*.png
 *
 *   node tools/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA, 8-bit)
// ---------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Pixel canvas
// ---------------------------------------------------------------------------

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

class Px {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = Buffer.alloc(w * h * 4);
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = c[3] ?? 255;
  }
  get(x, y) {
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  scale(k) {
    const o = new Px(this.w * k, this.h * k);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, this.get(Math.floor(x / k), Math.floor(y / k)));
    return o;
  }
  blit(src, ox, oy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c[3] > 0) this.set(ox + x, oy + y, c);
      }
  }
  png() {
    return encodePng(this.w, this.h, this.d);
  }
}

const C = {
  sky0: hex('#0d0a14'),
  sky1: hex('#15102a'),
  sky2: hex('#1e1638'),
  glow1: hex('#2c2148'),
  glow2: hex('#3d2d5c'),
  moon: hex('#ffe991'),
  moonS: hex('#f5c04f'),
  moonD: hex('#c4902e'),
  outline: hex('#1c1424'),
  star: hex('#fffaf2'),
  starD: hex('#9a7bd0'),
  blush: hex('#f8b6cf'),
  wool: hex('#fffaf2'),
  woolS: hex('#d8cfe0'),
  face: hex('#7d6f86'),
};

/** 32x32 icon: a sleeping crescent moon (the nightlight) with stars, on a night sky with a soft glow. */
function icon32(full = true) {
  const p = new Px(32, 32);
  const cx = 15.5;
  const cy = 16.5;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let c = y < 11 ? C.sky0 : y < 22 ? C.sky1 : C.sky2;
      if (d < 15) c = C.glow1;
      if (d < 12.5) c = C.glow2;
      // Dither the glow edges.
      if (d >= 12.5 && d < 13.5 && (x + y) % 2 === 0) c = C.glow2;
      if (d >= 15 && d < 16 && (x + y) % 2 === 0) c = C.glow1;
      if (full || d < 15.5) p.set(x, y, c);
    }
  // Crescent: big circle minus offset circle.
  const inMoon = (x, y) => Math.hypot(x - 15, y - 16) <= 9.2 && Math.hypot(x - 20, y - 12.5) > 7.8;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (!inMoon(x, y)) continue;
      const d = Math.hypot(x - 15, y - 16);
      const shade = d > 7.4 && y > 17 ? C.moonS : C.moon;
      p.set(x, y, shade);
    }
  // Outline
  const copy = new Px(32, 32);
  copy.d = Buffer.from(p.d);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (inMoon(x, y)) continue;
      if (inMoon(x - 1, y) || inMoon(x + 1, y) || inMoon(x, y - 1) || inMoon(x, y + 1)) p.set(x, y, C.outline);
    }
  // Sleeping eye (closed arc) and blush on the crescent body.
  for (const [x, y] of [
    [9, 16],
    [10, 17],
    [11, 17],
    [12, 16],
  ])
    p.set(x, y, C.moonD);
  p.set(11, 20, C.blush);
  p.set(12, 20, C.blush);
  // Stars
  const star = (x, y, big) => {
    p.set(x, y, C.star);
    if (big) {
      p.set(x - 1, y, C.starD);
      p.set(x + 1, y, C.starD);
      p.set(x, y - 1, C.starD);
      p.set(x, y + 1, C.starD);
    }
  };
  star(24, 7, true);
  star(27, 20, false);
  star(6, 6, false);
  star(22, 26, true);
  star(5, 24, false);
  // "z" of sleep
  for (const [x, y] of [
    [20, 14],
    [21, 14],
    [22, 14],
    [23, 14],
    [22, 15],
    [21, 16],
    [20, 17],
    [21, 17],
    [22, 17],
    [23, 17],
  ])
    p.set(x, y, C.star);
  for (const [x, y] of [
    [25, 10],
    [26, 10],
    [26, 11],
    [25, 12],
    [26, 12],
  ])
    p.set(x, y, C.starD);
  return p;
}

const out = resolve('public/icons');
mkdirSync(out, { recursive: true });
const base = icon32(true);
writeFileSync(resolve(out, 'favicon-32.png'), base.png());
writeFileSync(resolve(out, 'icon-192.png'), base.scale(6).png());
writeFileSync(resolve(out, 'icon-512.png'), base.scale(16).png());
writeFileSync(resolve(out, 'apple-touch-icon.png'), (() => {
  const p = new Px(180, 180);
  for (let y = 0; y < 180; y++) for (let x = 0; x < 180; x++) p.set(x, y, C.sky0);
  p.blit(base.scale(5), 10, 10);
  return p;
})().png());
// Maskable: content inside the 80% safe zone.
writeFileSync(resolve(out, 'icon-maskable-512.png'), (() => {
  const p = new Px(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) p.set(x, y, C.sky0);
  p.blit(base.scale(12), 64, 64);
  return p;
})().png());
// Open Graph / social preview (1200x630): icon + starry band.
writeFileSync(resolve(out, 'og-image.png'), (() => {
  const p = new Px(300, 158);
  for (let y = 0; y < 158; y++)
    for (let x = 0; x < 300; x++) {
      const c = y < 50 ? C.sky0 : y < 110 ? C.sky1 : C.sky2;
      p.set(x, y, c);
    }
  let s = 7;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 70; i++) p.set(Math.floor(rnd() * 300), Math.floor(rnd() * 158), rnd() > 0.7 ? C.star : C.starD);
  p.blit(base.scale(3), 102, 31);
  return p.scale(4);
})().png());
console.log('icons written to', out);

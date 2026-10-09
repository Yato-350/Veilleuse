/**
 * Fully procedural audio: a tiny tracker-style sequencer + synthesized sound effects.
 * No audio files are shipped; everything is generated with the Web Audio API.
 */

export type Instrument =
  | 'square'
  | 'pulse25'
  | 'pulse12'
  | 'triangle'
  | 'sine'
  | 'saw'
  | 'musicbox'
  | 'piano'
  | 'pad'
  | 'bass'
  | 'pluck'
  | 'bell'
  | 'kick'
  | 'snare'
  | 'hat'
  | 'organ';

export interface Channel {
  inst: Instrument;
  /** Space-separated tokens, one per step: note (C4, F#3, Bb2), chord (C4+E4), '.' rest, '-' hold, 'x' drum hit. */
  pattern: string;
  vol?: number;
  /** Semitone transposition. */
  transpose?: number;
  /** 0..1 reverb send. */
  reverb?: number;
  pan?: number;
  detune?: number;
}

export interface Track {
  bpm: number;
  /** Steps per beat (4 = sixteenth notes, 2 = eighth notes, 3 = triplets / 3/4 eighths). */
  stepsPerBeat: number;
  channels: Channel[];
  loop?: boolean;
  /** Global volume of the track. */
  vol?: number;
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parses "C#4" / "Bb3" / "E5" into a MIDI note number. Returns null for invalid input. */
export function noteToMidi(tok: string): number | null {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  let n = NOTE_INDEX[m[1]!.toUpperCase()]!;
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  return n + (parseInt(m[3]!, 10) + 1) * 12;
}

export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export interface NoteEvent {
  step: number;
  len: number;
  midis: number[];
  hit: boolean;
}

/** Converts a pattern string into note events (pure; unit tested). */
export function parsePattern(pattern: string): { events: NoteEvent[]; length: number } {
  const toks = pattern
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
  const events: NoteEvent[] = [];
  let last: NoteEvent | null = null;
  toks.forEach((tok, i) => {
    if (tok === '-') {
      if (last) last.len += 1;
      return;
    }
    if (tok === '.') {
      last = null;
      return;
    }
    if (tok === 'x' || tok === 'X') {
      last = { step: i, len: 1, midis: [tok === 'X' ? 1 : 0], hit: true };
      events.push(last);
      return;
    }
    const midis = tok
      .split('+')
      .map(noteToMidi)
      .filter((m): m is number => m !== null);
    if (midis.length) {
      last = { step: i, len: 1, midis, hit: false };
      events.push(last);
    } else {
      last = null;
    }
  });
  return { events, length: toks.length };
}

interface ParsedChannel extends Channel {
  events: NoteEvent[];
  length: number;
}

interface PlayingTrack {
  id: string;
  track: Track;
  channels: ParsedChannel[];
  stepDur: number;
  startTime: number;
  nextStep: number;
  totalSteps: number;
  gain: GainNode;
  tempo: number;
}

export type Sfx =
  | 'blip'
  | 'move'
  | 'select'
  | 'cancel'
  | 'hit'
  | 'hurt'
  | 'heal'
  | 'save'
  | 'spare'
  | 'die'
  | 'door'
  | 'glitch'
  | 'write'
  | 'emotion'
  | 'encounter'
  | 'slash'
  | 'crit'
  | 'heartbeat'
  | 'thunder'
  | 'item'
  | 'step'
  | 'shatter'
  | 'chime'
  | 'whoosh'
  | 'miss'
  | 'knock'
  | 'beep'
  | 'pop'
  | 'erase'
  | 'bark'
  | 'baa'
  // v2: radio static (dialogue {static}), one knock on a wall, a knock in a radiator pipe, a tooth clicking into a
  // music-box comb, a fingernail scratching a wall, a phone vibrating on a desk.
  | 'static'
  | 'knock1'
  | 'pipe'
  | 'tooth'
  | 'scratch'
  | 'buzz'
  // v2 chapter 4: a sewing-machine needle punching through felt, a long thread pulled out of stuffing.
  | 'stitch'
  | 'thread';

export type Ambience = 'rain' | 'static' | 'wind' | 'hum' | 'none';

export interface Voice {
  wave: OscillatorType | 'pulse25';
  pitch: number;
  vary?: number;
  len?: number;
  vol?: number;
}

export const VOICES: Record<string, Voice> = {
  default: { wave: 'square', pitch: 440, vary: 0.05, len: 0.04, vol: 0.12 },
  narrator: { wave: 'triangle', pitch: 330, vary: 0.02, len: 0.05, vol: 0.2 },
  noa: { wave: 'triangle', pitch: 260, vary: 0.04, len: 0.05, vol: 0.22 },
  mina: { wave: 'square', pitch: 740, vary: 0.12, len: 0.035, vol: 0.09 },
  dodo: { wave: 'sine', pitch: 520, vary: 0.08, len: 0.06, vol: 0.25 },
  /** Mina n°366, the felt Mina (chapter 4): Mina's voice, flattened, a little lower, as if replayed. */
  mina366: { wave: 'square', pitch: 680, vary: 0.02, len: 0.045, vol: 0.08 },
  dododark: { wave: 'sawtooth', pitch: 110, vary: 0.15, len: 0.08, vol: 0.12 },
  maman: { wave: 'triangle', pitch: 360, vary: 0.03, len: 0.05, vol: 0.22 },
  monster: { wave: 'sawtooth', pitch: 140, vary: 0.2, len: 0.06, vol: 0.08 },
  sheep: { wave: 'pulse25', pitch: 600, vary: 0.15, len: 0.04, vol: 0.09 },
  sock: { wave: 'square', pitch: 500, vary: 0.25, len: 0.03, vol: 0.08 },
  moon: { wave: 'sine', pitch: 200, vary: 0.02, len: 0.09, vol: 0.28 },
  owl: { wave: 'triangle', pitch: 420, vary: 0.1, len: 0.05, vol: 0.2 },
  eraser: { wave: 'square', pitch: 300, vary: 0.05, len: 0.04, vol: 0.09 },
  tv: { wave: 'sawtooth', pitch: 900, vary: 0.4, len: 0.03, vol: 0.05 },
  none: { wave: 'sine', pitch: 0, vol: 0 },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noiseBuf!: AudioBuffer;
  private waves: Partial<Record<string, PeriodicWave>> = {};
  private tracks = new Map<string, Track>();
  private playing: PlayingTrack | null = null;
  private fading: PlayingTrack[] = [];
  private ambience: { kind: Ambience; nodes: AudioNode[]; gain: GainNode; extra?: number } | null = null;
  musicVolume = 0.7;
  sfxVolume = 0.8;
  /** 0..1: pitch wobble + detune applied to music (horror moments). */
  corruption = 0;
  /** Playback rate multiplier for music (slow-down effects). */
  tempoScale = 1;
  private pendingMusic: string | null = null;
  muted = false;
  /** Music plays backwards (steps in reverse order, notes swell in and stop dead): the fake credits rewinding. */
  reverse = false;
  /** While holding, the sequence stops where it is and its last note rings on (see `hold`). */
  private held: { at: number; nodes: OscillatorNode[]; gain: GainNode } | null = null;
  private lastFreq = 523.25;

  register(id: string, t: Track): void {
    this.tracks.set(id, t);
  }

  get currentMusic(): string | null {
    return this.playing?.id ?? this.pendingMusic;
  }

  /** Must be called from a user gesture at least once (browser autoplay policy). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.setup();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.pendingMusic) {
      const id = this.pendingMusic;
      this.pendingMusic = null;
      this.playMusic(id, { fadeIn: 1 });
    }
  }

  private setup(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.musicFilter).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.6, 2.2);
    this.reverbBus = ctx.createGain();
    this.reverbBus.gain.value = 0.6;
    this.reverbBus.connect(this.reverb).connect(this.musicBus);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.waves.pulse25 = this.pulseWave(0.25);
    this.waves.pulse12 = this.pulseWave(0.125);
    this.waves.organ = ctx.createPeriodicWave(new Float32Array([0, 1, 0.5, 0.3, 0.2, 0.1, 0.05]), new Float32Array(7));
    this.waves.musicbox = ctx.createPeriodicWave(new Float32Array([0, 1, 0, 0.25, 0, 0.08, 0, 0.04]), new Float32Array(8));

    window.setInterval(() => this.schedule(), 25);
  }

  private pulseWave(duty: number): PeriodicWave {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    return this.ctx!.createPeriodicWave(real, imag);
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.setMusicVolume(this.musicVolume);
    this.setSfxVolume(this.sfxVolume);
  }

  /** Muffles the music (underwater / dreamy / distant). 1 = clear, 0 = very muffled. */
  setMuffle(amount: number, time = 0.5): void {
    if (!this.ctx) return;
    const f = 300 + Math.pow(amount, 2) * 19700;
    this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, time / 3);
  }

  // -------------------------------------------------------------------------
  // Music
  // -------------------------------------------------------------------------

  playMusic(id: string | null, opts: { fadeIn?: number; fadeOut?: number; restart?: boolean } = {}): void {
    if (!this.ctx) {
      this.pendingMusic = id;
      return;
    }
    if (id && this.playing?.id === id && !opts.restart) return;
    this.stopMusic(opts.fadeOut ?? 0.6);
    if (!id) return;
    const track = this.tracks.get(id);
    if (!track) {
      console.warn(`Unknown track: ${id}`);
      return;
    }
    const ctx = this.ctx;
    const gain = ctx.createGain();
    const vol = track.vol ?? 1;
    const fadeIn = opts.fadeIn ?? 0.05;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + fadeIn);
    gain.connect(this.musicBus);
    const channels = track.channels.map((c) => ({ ...c, ...parsePattern(c.pattern) }));
    const totalSteps = Math.max(...channels.map((c) => c.length));
    this.playing = {
      id,
      track,
      channels,
      stepDur: 60 / track.bpm / track.stepsPerBeat,
      startTime: ctx.currentTime + 0.08,
      nextStep: 0,
      totalSteps,
      gain,
      tempo: this.tempoScale,
    };
  }

  stopMusic(fade = 0.6): void {
    if (this.held) this.hold(false);
    if (!this.ctx || !this.playing) {
      this.pendingMusic = null;
      return;
    }
    const p = this.playing;
    const t = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    this.fading.push(p);
    window.setTimeout(() => {
      p.gain.disconnect();
      this.fading = this.fading.filter((f) => f !== p);
    }, (fade + 0.5) * 1000);
    this.playing = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const p = this.playing;
    if (!ctx || !p) return;
    if (this.held) {
      // Frozen: push the timeline forward so nothing new is scheduled until release.
      p.startTime += ctx.currentTime - this.held.at;
      this.held.at = ctx.currentTime;
      return;
    }
    const ahead = ctx.currentTime + 0.12;
    if (p.tempo !== this.tempoScale) {
      // Re-anchor so the next step keeps its position in time when the tempo changes.
      const nextTime = p.startTime + (p.nextStep * p.stepDur) / p.tempo;
      p.tempo = this.tempoScale;
      p.startTime = nextTime - (p.nextStep * p.stepDur) / p.tempo;
    }
    const stepDur = p.stepDur / this.tempoScale;
    // Recover gracefully if the tab was suspended.
    if (p.startTime + p.nextStep * stepDur < ctx.currentTime - 0.5) {
      p.startTime = ctx.currentTime - p.nextStep * stepDur;
    }
    while (p.startTime + p.nextStep * stepDur < ahead) {
      const step = p.nextStep;
      const when = p.startTime + step * stepDur;
      for (const ch of p.channels) {
        if (ch.length === 0) continue;
        const local = this.reverse ? ch.length - 1 - (step % ch.length) : step % ch.length;
        if (p.track.loop === false && step >= ch.length) continue;
        for (const ev of ch.events) {
          if (ev.step === local) this.playNote(ch, ev, when, ev.len * stepDur, p.gain);
        }
      }
      p.nextStep++;
      if (p.track.loop === false && p.nextStep >= p.totalSteps) {
        this.playing = null;
        return;
      }
    }
  }

  private playNote(ch: ParsedChannel, ev: NoteEvent, when: number, dur: number, out: GainNode): void {
    const vol = (ch.vol ?? 0.5) * 0.35;
    if (ev.hit || ch.inst === 'kick' || ch.inst === 'snare' || ch.inst === 'hat') {
      this.drum(ch.inst, when, vol * (ev.midis[0] === 1 ? 1.4 : 1), out);
      return;
    }
    const wob = this.corruption;
    for (const midi0 of ev.midis) {
      const midi = midi0 + (ch.transpose ?? 0);
      let freq = midiToFreq(midi);
      if (wob > 0) freq *= 1 + (Math.random() - 0.5) * 0.04 * wob - 0.03 * wob;
      if (ch === this.playing?.channels[0]) this.lastFreq = freq;
      if (this.reverse) this.backwardsNote(freq, when, Math.max(0.3, dur), vol / Math.sqrt(ev.midis.length), out);
      else this.synth(ch.inst, freq, when, dur, vol / Math.sqrt(ev.midis.length), out, ch);
    }
  }

  /** A note played backwards: it swells in from silence and stops dead. */
  private backwardsNote(freq: number, when: number, dur: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol * 0.8, when + dur * 0.92);
    g.gain.linearRampToValueAtTime(0, when + dur);
    g.connect(out);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    g.connect(send).connect(this.reverbBus);
    const o = this.osc(this.waves.musicbox ? 'musicbox' : 'triangle', freq, when);
    o.connect(g);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  /**
   * Freezes the music on its last note (true) — the fake credits stopping on a line — or lets it go on (false).
   * The held note rings with a slow, slightly sour vibrato.
   */
  hold(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.held) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.08);
      gain.connect(this.musicBus);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.2;
      const depth = ctx.createGain();
      depth.gain.value = this.lastFreq * 0.006;
      lfo.connect(depth);
      const nodes = [lfo];
      for (const [type, mul, det] of [
        ['sine', 1, 0],
        ['triangle', 2, 6],
      ] as const) {
        const o = this.osc(type, this.lastFreq * mul, ctx.currentTime);
        o.detune.value = det;
        depth.connect(o.frequency);
        const g = ctx.createGain();
        g.gain.value = mul === 1 ? 1 : 0.25;
        o.connect(g).connect(gain);
        o.start();
        nodes.push(o);
      }
      lfo.start();
      this.held = { at: ctx.currentTime, nodes, gain };
    } else if (!on && this.held) {
      const h = this.held;
      this.held = null;
      h.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      for (const n of h.nodes) n.stop(ctx.currentTime + 0.8);
    }
  }

  /** One note on an instrument (story puzzles: the music-box comb plays the lullaby note by note). */
  note(inst: Instrument, midi: number, dur = 0.5, vol = 0.5): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.synth(inst, midiToFreq(midi), this.ctx.currentTime + 0.01, dur, vol * 0.35, this.sfxBus);
  }

  private osc(type: string, freq: number, when: number): OscillatorNode {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const w = this.waves[type];
    if (w) o.setPeriodicWave(w);
    else o.type = type as OscillatorType;
    o.frequency.setValueAtTime(freq, when);
    return o;
  }

  private synth(inst: Instrument, freq: number, when: number, dur: number, vol: number, out: AudioNode, ch?: Channel): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    let dest: AudioNode = out;
    if (ch?.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = ch.pan;
      p.connect(out);
      dest = p;
    }
    g.connect(dest);
    if (ch?.reverb) {
      const send = ctx.createGain();
      send.gain.value = ch.reverb;
      g.connect(send).connect(this.reverbBus);
    }
    const env = g.gain;
    const end = when + dur;
    const oscs: OscillatorNode[] = [];
    const add = (type: string, f: number, detune = 0) => {
      const o = this.osc(type, f, when);
      o.detune.value = detune + (ch?.detune ?? 0);
      o.connect(g);
      oscs.push(o);
      return o;
    };
    let stop = end + 0.05;
    switch (inst) {
      case 'musicbox': {
        add('musicbox', freq);
        add('sine', freq * 2, 4);
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(vol * 0.9, when + 0.005);
        env.exponentialRampToValueAtTime(0.001, when + 1.6);
        stop = when + 1.7;
        break;
      }
      case 'bell': {
        add('sine', freq);
        add('sine', freq * 2.76, 0);
        add('sine', freq * 5.4, 0);
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(vol * 0.7, when + 0.004);
        env.exponentialRampToValueAtTime(0.001, when + 2.2);
        stop = when + 2.3;
        break;
      }
      case 'piano': {
        add('triangle', freq);
        add('sine', freq * 2, 3);
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(vol, when + 0.008);
        env.exponentialRampToValueAtTime(vol * 0.35, when + 0.3);
        env.exponentialRampToValueAtTime(0.001, Math.max(end + 0.4, when + 0.6));
        stop = Math.max(end + 0.45, when + 0.65);
        break;
      }
      case 'pluck': {
        add('pulse25', freq);
        env.setValueAtTime(vol, when);
        env.exponentialRampToValueAtTime(0.001, when + Math.min(0.35, dur + 0.15));
        stop = when + 0.4;
        break;
      }
      case 'pad': {
        add('sawtooth', freq, -7);
        add('sawtooth', freq, 7);
        add('triangle', freq / 2);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        g.disconnect();
        g.connect(f).connect(dest);
        if (ch?.reverb) {
          const send = ctx.createGain();
          send.gain.value = ch.reverb;
          f.connect(send).connect(this.reverbBus);
        }
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(vol * 0.45, when + Math.min(0.4, dur * 0.5));
        env.setValueAtTime(vol * 0.45, end);
        env.linearRampToValueAtTime(0, end + 0.5);
        stop = end + 0.55;
        break;
      }
      case 'bass': {
        add('triangle', freq);
        add('pulse25', freq);
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(vol * 0.9, when + 0.01);
        env.setValueAtTime(vol * 0.7, Math.max(when + 0.02, end - 0.03));
        env.linearRampToValueAtTime(0, end);
        break;
      }
      case 'organ': {
        add('organ', freq);
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(vol * 0.6, when + 0.03);
        env.setValueAtTime(vol * 0.6, end);
        env.linearRampToValueAtTime(0, end + 0.08);
        stop = end + 0.1;
        break;
      }
      default: {
        const type = inst === 'saw' ? 'sawtooth' : inst === 'square' ? 'square' : inst;
        add(type, freq);
        const peak = inst === 'sine' || inst === 'triangle' ? vol : vol * 0.55;
        env.setValueAtTime(0, when);
        env.linearRampToValueAtTime(peak, when + 0.006);
        env.setValueAtTime(peak * 0.8, Math.max(when + 0.01, end - 0.02));
        env.linearRampToValueAtTime(0, end);
      }
    }
    for (const o of oscs) {
      o.start(when);
      o.stop(stop);
    }
  }

  private noise(when: number, dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.start(when, Math.random() * 1.5, dur + 0.05);
    return src;
  }

  private drum(kind: Instrument, when: number, vol: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.connect(out);
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, when);
      o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
      g.gain.setValueAtTime(vol * 1.6, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
      o.connect(g);
      o.start(when);
      o.stop(when + 0.2);
    } else if (kind === 'snare') {
      const n = this.noise(when, 0.15);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1800;
      n.connect(f).connect(g);
      g.gain.setValueAtTime(vol * 1.1, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
    } else {
      const n = this.noise(when, 0.05);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      n.connect(f).connect(g);
      g.gain.setValueAtTime(vol * 0.6, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    }
  }

  // -------------------------------------------------------------------------
  // Sound effects
  // -------------------------------------------------------------------------

  private tone(
    type: string,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    when = this.ctx!.currentTime,
    out: AudioNode = this.sfxBus,
  ): void {
    const ctx = this.ctx!;
    const o = this.osc(type, f0, when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, filter: BiquadFilterType, freq: number, when = this.ctx!.currentTime): void {
    const ctx = this.ctx!;
    const n = this.noise(when, dur);
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    n.connect(f).connect(g).connect(this.sfxBus);
  }

  sfx(name: Sfx, opts: { pitch?: number; vol?: number } = {}): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const p = opts.pitch ?? 1;
    const v = opts.vol ?? 1;
    switch (name) {
      case 'blip':
        this.tone('square', 880 * p, 880 * p, 0.03, 0.08 * v);
        break;
      case 'move':
        this.tone('square', 660 * p, 700 * p, 0.04, 0.07 * v);
        break;
      case 'select':
        this.tone('square', 660 * p, 660 * p, 0.05, 0.08 * v);
        this.tone('square', 990 * p, 990 * p, 0.08, 0.08 * v, t + 0.05);
        break;
      case 'cancel':
        this.tone('square', 500 * p, 300 * p, 0.08, 0.07 * v);
        break;
      case 'hit':
        this.noiseBurst(0.15, 0.4 * v, 'lowpass', 2500);
        this.tone('square', 220 * p, 80 * p, 0.15, 0.12 * v);
        break;
      case 'hurt':
        this.tone('sawtooth', 300 * p, 90 * p, 0.25, 0.15 * v);
        this.noiseBurst(0.12, 0.25 * v, 'bandpass', 900);
        break;
      case 'heal':
        [0, 1, 2, 3].forEach((i) => this.tone('triangle', 523 * Math.pow(1.26, i) * p, 523 * Math.pow(1.26, i) * p, 0.15, 0.15 * v, t + i * 0.06));
        break;
      case 'save':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f * p, f * p, 0.6, 0.12 * v, t + i * 0.09));
        break;
      case 'spare':
        [1047, 1319, 1568, 2093, 1568, 2093].forEach((f, i) => this.tone('triangle', f * p, f * p, 0.18, 0.1 * v, t + i * 0.05));
        break;
      case 'die':
        this.noiseBurst(0.8, 0.35 * v, 'lowpass', 1200);
        this.tone('square', 400 * p, 40 * p, 0.8, 0.1 * v);
        break;
      case 'door':
        this.noiseBurst(0.18, 0.3 * v, 'lowpass', 600);
        this.tone('triangle', 120 * p, 80 * p, 0.2, 0.2 * v);
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) {
          this.tone('square', 100 + Math.random() * 2000, 100 + Math.random() * 2000, 0.04, 0.06 * v, t + i * 0.035);
        }
        this.noiseBurst(0.2, 0.15 * v, 'highpass', 3000);
        break;
      case 'write':
        this.noiseBurst(0.06, 0.12 * v, 'bandpass', 3500 * p);
        break;
      case 'emotion':
        this.tone('sine', 880 * p, 880 * p, 0.4, 0.12 * v);
        this.tone('sine', 1320 * p, 1320 * p, 0.4, 0.08 * v, t + 0.08);
        break;
      case 'encounter':
        this.tone('square', 880, 880, 0.06, 0.12 * v);
        this.tone('square', 1175, 1175, 0.12, 0.12 * v, t + 0.07);
        break;
      case 'slash':
        this.noiseBurst(0.18, 0.3 * v, 'highpass', 1500);
        this.tone('sawtooth', 1200 * p, 200 * p, 0.15, 0.06 * v);
        break;
      case 'crit':
        this.tone('square', 1500, 1500, 0.05, 0.1 * v);
        this.tone('square', 2000, 2000, 0.1, 0.1 * v, t + 0.05);
        this.noiseBurst(0.2, 0.3 * v, 'lowpass', 3000);
        break;
      case 'heartbeat':
        this.tone('sine', 70 * p, 40 * p, 0.15, 0.6 * v);
        this.tone('sine', 65 * p, 40 * p, 0.15, 0.45 * v, t + 0.2);
        break;
      case 'thunder':
        this.noiseBurst(2.2, 0.6 * v, 'lowpass', 400);
        break;
      case 'item':
        this.tone('triangle', 784, 784, 0.1, 0.15 * v);
        this.tone('triangle', 1047, 1047, 0.2, 0.15 * v, t + 0.1);
        break;
      case 'step':
        this.noiseBurst(0.04, 0.05 * v, 'lowpass', 800 * p);
        break;
      case 'shatter':
        this.tone('square', 600, 600, 0.05, 0.15 * v);
        this.noiseBurst(0.5, 0.4 * v, 'highpass', 2000, t + 0.3);
        this.tone('square', 300, 50, 0.4, 0.1 * v, t + 0.3);
        break;
      case 'chime':
        this.tone('sine', 1568 * p, 1568 * p, 1.2, 0.1 * v);
        this.tone('sine', 2093 * p, 2093 * p, 1.2, 0.06 * v, t + 0.12);
        break;
      case 'whoosh':
        this.noiseBurst(0.6, 0.25 * v, 'bandpass', 800 * p);
        break;
      case 'miss':
        this.tone('triangle', 400, 300, 0.1, 0.1 * v);
        break;
      case 'knock':
        [0, 0.22, 0.44].forEach((d) => {
          this.tone('sine', 110, 60, 0.12, 0.5 * v, t + d);
          this.noiseBurst(0.06, 0.2 * v, 'lowpass', 500, t + d);
        });
        break;
      case 'beep':
        this.tone('sine', 1000 * p, 1000 * p, 0.12, 0.1 * v);
        break;
      case 'pop':
        this.tone('sine', 400 * p, 900 * p, 0.06, 0.15 * v);
        break;
      case 'erase':
        this.noiseBurst(0.25, 0.2 * v, 'bandpass', 1200 * p);
        break;
      case 'bark':
        this.tone('sawtooth', 300, 150, 0.15, 0.1 * v);
        break;
      case 'static':
        // A short crackle of radio « friture »: band-passed noise and two tiny clicks.
        this.noiseBurst(0.07, 0.16 * v, 'bandpass', 2400 * p);
        this.noiseBurst(0.02, 0.2 * v, 'highpass', 5000, t + 0.02 + Math.random() * 0.03);
        break;
      case 'knock1':
        this.tone('sine', 120 * p, 62 * p, 0.12, 0.55 * v);
        this.noiseBurst(0.06, 0.22 * v, 'lowpass', 520 * p);
        break;
      case 'pipe':
        // A knock in the old radiator pipe: metallic, ringing, slightly out of tune.
        this.tone('sine', 410 * p, 400 * p, 0.5, 0.16 * v);
        this.tone('sine', 1130 * p, 1122 * p, 0.3, 0.07 * v);
        this.tone('triangle', 96 * p, 70 * p, 0.08, 0.3 * v);
        this.noiseBurst(0.04, 0.12 * v, 'bandpass', 1800 * p);
        break;
      case 'tooth':
        this.tone('square', 2400 * p, 1800 * p, 0.02, 0.05 * v);
        this.noiseBurst(0.025, 0.1 * v, 'highpass', 4000);
        break;
      case 'scratch':
        this.noiseBurst(0.45, 0.07 * v, 'bandpass', 3200 * p);
        this.noiseBurst(0.3, 0.05 * v, 'bandpass', 2100 * p, t + 0.2);
        break;
      case 'stitch':
        this.tone('square', 1900 * p, 900 * p, 0.025, 0.06 * v);
        this.tone('triangle', 150 * p, 70 * p, 0.06, 0.25 * v, t + 0.01);
        this.noiseBurst(0.03, 0.12 * v, 'highpass', 3500, t + 0.005);
        break;
      case 'thread':
        this.tone('sawtooth', 260 * p, 820 * p, 0.38, 0.035 * v);
        this.noiseBurst(0.38, 0.09 * v, 'bandpass', 2600 * p);
        break;
      case 'buzz':
        // A phone vibrating on a wooden desk.
        [0, 0.12, 0.24, 0.5, 0.62, 0.74].forEach((d) => this.tone('sawtooth', 58, 56, 0.1, 0.09 * v, t + d));
        break;
      case 'baa': {
        const o = this.osc('sawtooth', 380 * p, t);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 22;
        const lg = this.ctx.createGain();
        lg.gain.value = 18;
        lfo.connect(lg).connect(o.frequency);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0, t);
        g.gain.linearRampToValueAtTime(0.18 * v, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(f).connect(g).connect(this.sfxBus);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.55);
        lfo.stop(t + 0.55);
        break;
      }
    }
  }

  /** Text "voice" blip. */
  voice(v: Voice): void {
    if (!this.ctx || this.ctx.state !== 'running' || v.vol === 0) return;
    const f = v.pitch * (1 + (Math.random() - 0.5) * 2 * (v.vary ?? 0));
    const type = v.wave === 'pulse25' ? 'pulse25' : v.wave;
    this.tone(type, f, f, v.len ?? 0.04, v.vol ?? 0.1);
  }

  // -------------------------------------------------------------------------
  // Ambience loops
  // -------------------------------------------------------------------------

  setAmbience(kind: Ambience, vol = 1): void {
    if (!this.ctx) return;
    if (this.ambience?.kind === kind) return;
    const ctx = this.ctx;
    if (this.ambience) {
      const old = this.ambience;
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      window.setTimeout(() => {
        for (const n of old.nodes) {
          try {
            (n as AudioScheduledSourceNode).stop?.();
          } catch {
            /* already stopped */
          }
          n.disconnect();
        }
        if (old.extra) window.clearInterval(old.extra);
      }, 2000);
      this.ambience = null;
    }
    if (kind === 'none') return;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
    gain.connect(this.sfxBus);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    const nodes: AudioNode[] = [src, f];
    let extra: number | undefined;
    if (kind === 'rain') {
      f.type = 'lowpass';
      f.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.value = 0.1;
      src.connect(f).connect(g).connect(gain);
      nodes.push(g);
      extra = window.setInterval(() => {
        if (Math.random() < 0.6) this.tone('sine', 2000 + Math.random() * 2500, 800, 0.03, 0.015, ctx.currentTime, gain);
      }, 60);
    } else if (kind === 'static') {
      f.type = 'highpass';
      f.frequency.value = 2000;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      src.connect(f).connect(g).connect(gain);
      nodes.push(g);
    } else if (kind === 'wind') {
      f.type = 'bandpass';
      f.frequency.value = 500;
      f.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.value = 0.12;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.15;
      const lg = ctx.createGain();
      lg.gain.value = 300;
      lfo.connect(lg).connect(f.frequency);
      lfo.start();
      src.connect(f).connect(g).connect(gain);
      nodes.push(g, lfo, lg);
    } else if (kind === 'hum') {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 50;
      f.type = 'lowpass';
      f.frequency.value = 200;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      o.connect(f).connect(g).connect(gain);
      o.start();
      nodes.push(o, g);
      extra = window.setInterval(() => this.tone('sine', 1000, 1000, 0.1, 0.03, ctx.currentTime, gain), 1400);
    }
    src.start();
    this.ambience = { kind, nodes, gain, extra };
  }
}

export const audio = new AudioEngine();

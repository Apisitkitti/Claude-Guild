/**
 * Chiptune sound, synthesized with WebAudio (no audio files). The AudioContext is created lazily, only after the
 * viewer turned sound on (a user gesture). Nothing here runs on the server.
 */

export type SfxCue =
  "hit" | "kill" | "levelUp" | "bossAppear" | "bossDown" | "bell" | "questDone" | "cheers" | "door" | "enterDungeon";

export type AmbientKind = "tavern" | "dungeon" | null;

const MASTER_GAIN = 0.15;
const HIT_MAX_PER_SECOND = 6;
const RATE_WINDOW_S = 1;
const LOOKAHEAD_S = 0.4;
const STOP_PAD_S = 0.05;
const ATTACK_S = 0.005;
const MIN_GAIN = 0.0001;
/** the same non-hit cue twice inside this gap is dropped (many adventurers finishing at once) */
const CUE_MIN_GAP_S = 0.08;

type Wave = "square" | "triangle" | "sawtooth" | "sine";
interface Tone {
  /** start offset in seconds from the cue start */
  at: number;
  freq: number;
  dur: number;
  wave?: Wave;
  gain?: number;
  /** end frequency for a slide */
  slideTo?: number;
}

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

/** 8-bar original tavern tune in C major pentatonic: [midi note, beats]; 0 = rest. 4 beats per bar. */
const TAVERN_BPM = 92;
const TAVERN: readonly (readonly [number, number])[] = [
  [76, 1],
  [79, 0.5],
  [76, 0.5],
  [72, 1],
  [67, 1],
  [69, 1.5],
  [72, 0.5],
  [69, 1],
  [0, 1],
  [67, 1],
  [72, 0.5],
  [74, 0.5],
  [76, 1],
  [72, 1],
  [74, 2],
  [0, 2],
  [79, 1],
  [81, 0.5],
  [79, 0.5],
  [76, 1],
  [72, 1],
  [74, 1.5],
  [76, 0.5],
  [74, 1],
  [0, 1],
  [69, 1],
  [72, 0.5],
  [69, 0.5],
  [67, 1],
  [64, 1],
  [67, 2],
  [0, 2],
];
const BASS: readonly number[] = [48, 55, 45, 52, 48, 55, 45, 43];
const BEATS_PER_BAR = 4;
const DRONE_BASE = 55;
const DRONE_LEN_S = 4;

const CUES: Record<Exclude<SfxCue, "hit">, Tone[]> = {
  kill: [
    { at: 0, freq: midi(83), dur: 0.08, wave: "square", gain: 0.5 },
    { at: 0.08, freq: midi(88), dur: 0.18, wave: "square", gain: 0.5 },
  ],
  levelUp: [60, 64, 67, 72, 76].map((note, index) => ({
    at: index * 0.07,
    freq: midi(note),
    dur: 0.12,
    wave: "square" as Wave,
    gain: 0.45,
  })),
  bossAppear: [
    { at: 0, freq: midi(36), dur: 0.7, wave: "sawtooth", gain: 0.6, slideTo: midi(33) },
    { at: 0.25, freq: midi(37), dur: 0.7, wave: "sawtooth", gain: 0.45, slideTo: midi(30) },
  ],
  bossDown: [
    { at: 0, freq: midi(67), dur: 0.12, wave: "square", gain: 0.5 },
    { at: 0.12, freq: midi(72), dur: 0.12, wave: "square", gain: 0.5 },
    { at: 0.24, freq: midi(76), dur: 0.12, wave: "square", gain: 0.5 },
    { at: 0.36, freq: midi(79), dur: 0.5, wave: "square", gain: 0.55 },
    { at: 0.36, freq: midi(67), dur: 0.5, wave: "triangle", gain: 0.5 },
  ],
  bell: [
    { at: 0, freq: midi(88), dur: 0.9, wave: "sine", gain: 0.8 },
    { at: 0, freq: midi(88) * 2.76, dur: 0.5, wave: "sine", gain: 0.25 },
    { at: 0.32, freq: midi(88), dur: 0.9, wave: "sine", gain: 0.6 },
    { at: 0.32, freq: midi(88) * 2.76, dur: 0.5, wave: "sine", gain: 0.2 },
  ],
  questDone: [
    { at: 0, freq: midi(72), dur: 0.1, wave: "triangle", gain: 0.7 },
    { at: 0.1, freq: midi(76), dur: 0.1, wave: "triangle", gain: 0.7 },
    { at: 0.2, freq: midi(79), dur: 0.25, wave: "triangle", gain: 0.7 },
  ],
  cheers: [
    { at: 0, freq: midi(91), dur: 0.12, wave: "sine", gain: 0.5 },
    { at: 0.05, freq: midi(95), dur: 0.2, wave: "sine", gain: 0.4 },
  ],
  door: [{ at: 0, freq: 180, dur: 0.35, wave: "sawtooth", gain: 0.3, slideTo: 110 }],
  enterDungeon: [
    { at: 0, freq: 200, dur: 0.5, wave: "sawtooth", gain: 0.3, slideTo: 90 },
    { at: 0.3, freq: 70, dur: 0.5, wave: "triangle", gain: 0.5, slideTo: 50 },
  ],
};

/** the slice of the WebAudio API used here (kept small so tests can mock it) */
interface ParamLike {
  value: number;
  setValueAtTime: (value: number, time: number) => unknown;
  linearRampToValueAtTime: (value: number, time: number) => unknown;
  exponentialRampToValueAtTime: (value: number, time: number) => unknown;
}
interface NodeLike {
  connect: (to: unknown) => unknown;
  type: string;
  buffer: unknown;
  gain: ParamLike;
  frequency: ParamLike;
  start: (time: number) => unknown;
  stop: (time: number) => unknown;
}
interface BufferLike {
  getChannelData: (channel: number) => Float32Array;
}
interface AudioLike {
  currentTime: number;
  sampleRate: number;
  destination: unknown;
  resume?: () => Promise<void> | void;
  close?: () => Promise<void> | void;
  createOscillator: () => NodeLike;
  createGain: () => NodeLike;
  createBuffer: (channels: number, length: number, rate: number) => BufferLike;
  createBufferSource: () => NodeLike;
}

export type AudioContextFactory = () => AudioLike | null;

const defaultFactory: AudioContextFactory = () => {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    AudioContext?: new () => AudioLike;
    webkitAudioContext?: new () => AudioLike;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  return Ctor ? new Ctor() : null;
};

export class Sfx {
  private ctx: AudioLike | null = null;
  private master: NodeLike | null = null;
  private noise: BufferLike | null = null;
  private hitTimes: number[] = [];
  private lastCueAt = new Map<SfxCue, number>();
  private ambient: AmbientKind = null;
  private ambientNext = 0;
  private ambientStep = 0;
  private ambientBeats = 0;
  private volume = 1;

  constructor(private readonly factory: AudioContextFactory = defaultFactory) {}

  /** true once an AudioContext exists */
  get started(): boolean {
    return this.ctx !== null;
  }

  /** create the context (call from a user gesture) */
  start(): boolean {
    if (this.ctx) {
      void this.ctx.resume?.();
      return true;
    }
    try {
      const ctx = this.factory();
      if (!ctx) return false;
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = MASTER_GAIN * this.volume;
      this.master.connect(ctx.destination);
      void ctx.resume?.();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = MASTER_GAIN * this.volume;
  }

  /** stop everything and release the context */
  stop() {
    this.ambient = null;
    this.hitTimes = [];
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.noise = null;
    try {
      void ctx?.close?.();
    } catch {}
  }

  /** play one cue; false when nothing was scheduled (not started or rate limited) */
  play(cue: SfxCue): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    const now = ctx.currentTime;
    if (cue === "hit") {
      this.hitTimes = this.hitTimes.filter((time) => now - time < RATE_WINDOW_S);
      if (this.hitTimes.length >= HIT_MAX_PER_SECOND) return false;
      this.hitTimes.push(now);
      this.hit(now);
      return true;
    }
    const last = this.lastCueAt.get(cue);
    if (last !== undefined && now - last < CUE_MIN_GAP_S) return false;
    this.lastCueAt.set(cue, now);
    for (const tone of CUES[cue]) this.tone(now, tone);
    return true;
  }

  setAmbient(kind: AmbientKind) {
    if (kind === this.ambient) return;
    this.ambient = kind;
    this.ambientStep = 0;
    this.ambientBeats = 0;
    this.ambientNext = this.ctx ? this.ctx.currentTime : 0;
  }

  /** call a few times a second: schedules ambient notes a little ahead of the clock */
  tick() {
    const ctx = this.ctx;
    if (!ctx || !this.ambient) return;
    if (this.ambientNext < ctx.currentTime) this.ambientNext = ctx.currentTime;
    while (this.ambientNext < ctx.currentTime + LOOKAHEAD_S) {
      if (this.ambient === "tavern") this.tavernStep();
      else this.droneStep();
    }
  }

  private tavernStep() {
    const beat = 60 / TAVERN_BPM;
    const [note, beats] = TAVERN[this.ambientStep % TAVERN.length];
    const at = this.ambientNext;
    if (this.ambientBeats % BEATS_PER_BAR === 0) {
      const bar = Math.floor(this.ambientBeats / BEATS_PER_BAR) % BASS.length;
      this.tone(at, { at: 0, freq: midi(BASS[bar]), dur: beat * 1.6, wave: "square", gain: 0.12 });
    }
    if (note) this.tone(at, { at: 0, freq: midi(note), dur: beats * beat * 0.9, wave: "triangle", gain: 0.5 });
    this.ambientNext += beats * beat;
    this.ambientBeats += beats;
    this.ambientStep++;
  }

  private droneStep() {
    const at = this.ambientNext;
    this.tone(at, { at: 0, freq: DRONE_BASE, dur: DRONE_LEN_S + 0.5, wave: "triangle", gain: 0.35 });
    this.tone(at, { at: 0, freq: DRONE_BASE * 1.5, dur: DRONE_LEN_S + 0.5, wave: "sine", gain: 0.12 });
    this.ambientNext += DRONE_LEN_S;
    this.ambientStep++;
  }

  private tone(base: number, tone: Tone) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = base + tone.at;
    const end = start + tone.dur;
    osc.type = tone.wave ?? "square";
    osc.frequency.setValueAtTime(tone.freq, start);
    if (tone.slideTo) osc.frequency.linearRampToValueAtTime(tone.slideTo, end);
    gain.gain.setValueAtTime(MIN_GAIN, start);
    gain.gain.linearRampToValueAtTime(tone.gain ?? 0.5, start + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, end);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(end + STOP_PAD_S);
  }

  /** a short filtered-noise blip with a random pitch */
  private hit(now: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.1);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = this.noise;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + 0.07);
    src.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.1);
    this.tone(now, { at: 0, freq: 300 + Math.random() * 300, dur: 0.06, wave: "square", gain: 0.25, slideTo: 120 });
  }
}

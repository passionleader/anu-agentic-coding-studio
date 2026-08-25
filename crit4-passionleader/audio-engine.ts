// The only module that touches the Web Audio API. Chord data and UI
// rendering both stay ignorant of how sound is produced, so a future voice
// (drums, arpeggios) can schedule through this same context without touching
// button code.
import { type ChordDef, midiToFrequency, voiceChordTones } from "./chords.ts";
import { msPerChord } from "./clock.ts";
import { type DrumPatternId, drumStepsFor, type RhythmPatternId, stepsFor } from "./rhythm.ts";

type AudioContextConstructor = typeof AudioContext;

function resolveAudioContextConstructor(): AudioContextConstructor {
  const globalWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  const ctor = globalWindow.AudioContext ?? globalWindow.webkitAudioContext;
  if (!ctor) {
    throw new Error("This browser does not support the Web Audio API.");
  }
  return ctor;
}

// One octave below the chord root sits in a register small speakers still
// reproduce, unlike the two-octave drop this used to be.
const BASS_OCTAVE_DROP = 12;
const MASTER_GAIN = 0.55;
// Separate buses per part instead of one flat master gain, so "make the bass
// louder" is a single number here instead of re-tuning every bass voice.
const MELODY_BUS_GAIN = 1;
const BASS_BUS_GAIN = 1.8;
const DRUM_BUS_GAIN = 1.05;

// A rolling "da-ra-ra-ra-ra": the chord tones ripple upward instead of
// striking together.
const ARPEGGIO_LEAD_S = 0.02;
const ARPEGGIO_STEP_S = 0.055;

const KICK_DURATION_S = 0.18;
const SNARE_DURATION_S = 0.15;
const HIHAT_DURATION_S = 0.055;

export type InstrumentId = "piano" | "guitar" | "xylophone" | "marimba" | "violin";

export interface InstrumentOption {
  readonly id: InstrumentId;
  readonly label: string;
}

export const INSTRUMENTS: readonly InstrumentOption[] = [
  { id: "piano", label: "Piano" },
  { id: "guitar", label: "Guitar" },
  { id: "xylophone", label: "Xylophone" },
  { id: "marimba", label: "Marimba" },
  { id: "violin", label: "Violin" },
];

interface VoiceShape {
  readonly style: "pluck" | "sustain";
  readonly attack: number;
  readonly decay: number;
  readonly peak: number;
  readonly waveforms: readonly OscillatorType[];
  readonly detunesCents: readonly number[];
  readonly filterStart: number;
  readonly filterEnd: number;
  readonly vibrato?: boolean;
  // 0-1 amount of a short filtered noise burst layered under the onset — a
  // hammer/pick transient, the main thing that makes a struck or plucked
  // voice read as acoustic instead of a bare oscillator.
  readonly noiseAttack?: number;
}

// Struck/plucked voices ramp up then decay away in two stages (a quick
// initial drop, then a longer tail) — closer to a real string than a single
// exponential curve. The violin sustains and bows instead. These are
// stylised approximations, not sample-accurate emulations — the Web Audio
// graph stays a handful of oscillators per note, live-generated, no
// recordings.
const INSTRUMENT_SHAPES: Readonly<Record<InstrumentId, VoiceShape>> = {
  piano: {
    style: "pluck",
    attack: 0.004,
    decay: 1.5,
    peak: 0.4,
    waveforms: ["triangle", "sine", "sine"],
    detunesCents: [0, 5, -4],
    filterStart: 5200,
    filterEnd: 1100,
    noiseAttack: 0.1,
  },
  guitar: {
    style: "pluck",
    attack: 0.003,
    decay: 1.0,
    peak: 0.36,
    waveforms: ["sawtooth", "triangle", "sine"],
    detunesCents: [0, -7, 5],
    filterStart: 3600,
    filterEnd: 550,
    noiseAttack: 0.16,
  },
  xylophone: {
    style: "pluck",
    attack: 0.001,
    decay: 0.4,
    peak: 0.42,
    waveforms: ["sine", "square", "sine"],
    detunesCents: [0, 12, -12],
    filterStart: 7000,
    filterEnd: 3200,
    noiseAttack: 0.08,
  },
  marimba: {
    style: "pluck",
    attack: 0.002,
    decay: 0.65,
    peak: 0.4,
    waveforms: ["sine", "sine", "triangle"],
    detunesCents: [0, 6, -5],
    filterStart: 2400,
    filterEnd: 750,
    noiseAttack: 0.05,
  },
  violin: {
    style: "sustain",
    attack: 0.1,
    decay: 1.1,
    peak: 0.32,
    waveforms: ["sawtooth", "sawtooth", "sine"],
    detunesCents: [0, 8, -6],
    filterStart: 2800,
    filterEnd: 2100,
    vibrato: true,
  },
};

// Sawtooth for presence on small speakers, a sine underneath for real sub
// weight, and a filter that opens enough for the sawtooth's harmonics to
// actually get through — the previous pure triangle through a static 700Hz
// lowpass was inaudible on most laptop/phone speakers regardless of gain.
const BASS_SHAPE: VoiceShape = {
  style: "pluck",
  attack: 0.01,
  decay: 1.4,
  peak: 0.55,
  waveforms: ["sawtooth", "sine"],
  detunesCents: [0, 0],
  filterStart: 1500,
  filterEnd: 450,
  noiseAttack: 0.05,
};

// When a rhythm pattern packs more than one bass hit into a chord's
// duration, each hit must decay before the next one starts, or the pattern
// just sounds like one long held note again.
function withDecayCap(shape: VoiceShape, maxDecaySeconds: number): VoiceShape {
  return maxDecaySeconds >= shape.decay ? shape : { ...shape, decay: Math.max(maxDecaySeconds, 0.05) };
}

interface StepHit {
  readonly time: number;
  readonly stepSeconds: number;
}

function hitTimes(steps: readonly boolean[], totalSeconds: number, startAt: number): StepHit[] {
  if (steps.length === 0) return [];
  const stepSeconds = totalSeconds / steps.length;
  return steps.flatMap((hit, index) => (hit ? [{ time: startAt + index * stepSeconds, stepSeconds }] : []));
}

function createNoiseBuffer(context: AudioContext, duration: number): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// A handle to silence one already-scheduled sound immediately, for Stop.
interface StopHandle {
  readonly stop: () => void;
}

export class AudioEngine {
  #context: AudioContext | null = null;
  #melodyBus: GainNode | null = null;
  #bassBus: GainNode | null = null;
  #drumBus: GainNode | null = null;
  #lastVoicing: number[] | null = null;
  #instrument: InstrumentId = "piano";
  #bassPattern: RhythmPatternId = "sustain";
  #drumPattern: DrumPatternId = "off";
  #activeVoices = new Set<StopHandle>();

  setInstrument(instrument: InstrumentId): void {
    this.#instrument = instrument;
  }

  setBassPattern(pattern: RhythmPatternId): void {
    this.#bassPattern = pattern;
  }

  setDrumPattern(pattern: DrumPatternId): void {
    this.#drumPattern = pattern;
  }

  // A single pad press: the chord's arpeggio only. Bass and drums join in
  // only when the whole progression plays, via playSequence below.
  playChord(chord: ChordDef): void {
    const { context, melody } = this.#ensureGraph();
    this.#scheduleChordVoices(context, melody, chord, context.currentTime);
  }

  // Replays a whole progression from the top, one chord per beat, with the
  // bass and drum patterns layered in as one synchronised backing track.
  // Returns a canceller that stops pending chords AND silences anything
  // already sounding, so a second "play from start" never overlaps the
  // first.
  playSequence(chords: readonly ChordDef[]): () => void {
    const timers = chords.map((chord, index) =>
      window.setTimeout(() => this.#playChordWithBacking(chord), index * msPerChord()),
    );
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      this.stopAll();
    };
  }

  // Call when the progression is cleared so the next chord voices in plain
  // root position instead of leading smoothly from an abandoned progression.
  reset(): void {
    this.#lastVoicing = null;
  }

  // Immediately silences every currently-sounding voice (pad presses,
  // arpeggio notes, bass, drums) regardless of how it was triggered. Safe to
  // call when nothing is playing.
  stopAll(): void {
    for (const handle of this.#activeVoices) handle.stop();
    this.#activeVoices.clear();
  }

  #playChordWithBacking(chord: ChordDef): void {
    const { context, melody, bass, drums } = this.#ensureGraph();
    const startAt = context.currentTime;
    const chordSeconds = msPerChord() / 1000;

    this.#scheduleChordVoices(context, melody, chord, startAt);

    const bassFrequency = midiToFrequency(chord.rootMidi - BASS_OCTAVE_DROP);
    const bassHits = hitTimes(stepsFor(this.#bassPattern), chordSeconds, startAt);
    bassHits.forEach(({ time, stepSeconds }) => {
      const bassShape = bassHits.length > 1 ? withDecayCap(BASS_SHAPE, stepSeconds * 0.85) : BASS_SHAPE;
      this.#playVoice(context, bass, bassFrequency, time, bassShape);
    });

    const grid = drumStepsFor(this.#drumPattern);
    hitTimes(grid.kick, chordSeconds, startAt).forEach(({ time }) => this.#playKick(context, drums, time));
    hitTimes(grid.snare, chordSeconds, startAt).forEach(({ time }) => this.#playSnare(context, drums, time));
    hitTimes(grid.hihat, chordSeconds, startAt).forEach(({ time }) => this.#playHihat(context, drums, time));
  }

  #scheduleChordVoices(context: AudioContext, destination: AudioNode, chord: ChordDef, startAt: number): void {
    const voicing = voiceChordTones(chord, this.#lastVoicing);
    this.#lastVoicing = voicing;
    const shape = INSTRUMENT_SHAPES[this.#instrument];
    const rolled = [...voicing].sort((a, b) => a - b);
    rolled.forEach((note, index) => {
      const noteStart = startAt + ARPEGGIO_LEAD_S + index * ARPEGGIO_STEP_S;
      this.#playVoice(context, destination, midiToFrequency(note), noteStart, shape);
    });
  }

  #ensureGraph(): { context: AudioContext; melody: GainNode; bass: GainNode; drums: GainNode } {
    if (!this.#context || !this.#melodyBus || !this.#bassBus || !this.#drumBus) {
      const Ctor = resolveAudioContextConstructor();
      const context = new Ctor();
      const master = context.createGain();
      master.gain.value = MASTER_GAIN;

      const melody = context.createGain();
      melody.gain.value = MELODY_BUS_GAIN;
      const bass = context.createGain();
      bass.gain.value = BASS_BUS_GAIN;
      const drums = context.createGain();
      drums.gain.value = DRUM_BUS_GAIN;
      melody.connect(master);
      bass.connect(master);
      drums.connect(master);

      const compressor = context.createDynamicsCompressor();
      master.connect(compressor);
      compressor.connect(context.destination);

      this.#context = context;
      this.#melodyBus = melody;
      this.#bassBus = bass;
      this.#drumBus = drums;
    }
    if (this.#context.state === "suspended") {
      void this.#context.resume();
    }
    return { context: this.#context, melody: this.#melodyBus, bass: this.#bassBus, drums: this.#drumBus };
  }

  // Struck/plucked voices ramp up then decay away over two stages. Sustained
  // (bowed) voices hold near peak instead, with a short release at the end,
  // and may carry a gentle vibrato on top. Every voice registers a stop
  // handle so stopAll() can silence it immediately instead of waiting out
  // its natural decay.
  #playVoice(context: AudioContext, destination: AudioNode, frequency: number, startAt: number, shape: VoiceShape): void {
    const { attack, decay, peak, style } = shape;
    const releaseAt = startAt + attack + decay;
    const stopAt = releaseAt + 0.05;

    const voiceGain = context.createGain();
    voiceGain.gain.setValueAtTime(0, startAt);
    voiceGain.gain.linearRampToValueAtTime(peak, startAt + attack);
    if (style === "sustain") {
      const releaseStart = Math.max(startAt + attack, releaseAt - 0.15);
      voiceGain.gain.linearRampToValueAtTime(peak * 0.82, releaseStart);
      voiceGain.gain.linearRampToValueAtTime(0.0001, releaseAt);
    } else {
      const kneeAt = startAt + attack + Math.min(decay * 0.3, 0.15);
      voiceGain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.4, 0.002), kneeAt);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, releaseAt);
      voiceGain.gain.setValueAtTime(0, releaseAt + 0.02);
    }

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(shape.filterStart, startAt);
    filter.frequency.exponentialRampToValueAtTime(Math.max(shape.filterEnd, 40), releaseAt);

    voiceGain.connect(filter);
    filter.connect(destination);

    let vibratoLfo: OscillatorNode | null = null;
    let vibratoDepth: GainNode | null = null;
    if (shape.vibrato) {
      vibratoLfo = context.createOscillator();
      vibratoLfo.type = "sine";
      vibratoLfo.frequency.value = 5.5;
      vibratoDepth = context.createGain();
      vibratoDepth.gain.value = 6; // cents
      vibratoLfo.connect(vibratoDepth);
      vibratoLfo.start(startAt);
      vibratoLfo.stop(stopAt);
    }

    const oscillators: OscillatorNode[] = [];
    shape.waveforms.forEach((type, index) => {
      const osc = context.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, startAt);
      osc.detune.setValueAtTime(shape.detunesCents[index] ?? 0, startAt);
      vibratoDepth?.connect(osc.detune);
      osc.connect(voiceGain);
      osc.start(startAt);
      osc.stop(stopAt);
      oscillators.push(osc);
    });

    let attackNoise: AudioBufferSourceNode | null = null;
    let attackFilter: BiquadFilterNode | null = null;
    let attackGain: GainNode | null = null;
    if (shape.noiseAttack) {
      const noiseDuration = 0.02;
      attackNoise = context.createBufferSource();
      attackNoise.buffer = createNoiseBuffer(context, noiseDuration);
      attackFilter = context.createBiquadFilter();
      attackFilter.type = "bandpass";
      attackFilter.frequency.value = Math.min(frequency * 3, 9000);
      attackFilter.Q.value = 0.7;
      attackGain = context.createGain();
      attackGain.gain.setValueAtTime(peak * shape.noiseAttack, startAt);
      attackGain.gain.exponentialRampToValueAtTime(0.001, startAt + noiseDuration);
      attackNoise.connect(attackFilter);
      attackFilter.connect(attackGain);
      attackGain.connect(destination);
      attackNoise.start(startAt);
      attackNoise.stop(startAt + noiseDuration + 0.01);
    }

    const stopNow = (): void => {
      const now = context.currentTime;
      voiceGain.gain.cancelScheduledValues(now);
      voiceGain.gain.setValueAtTime(voiceGain.gain.value, now);
      voiceGain.gain.linearRampToValueAtTime(0.0001, now + 0.03);
      for (const osc of oscillators) {
        try {
          osc.stop(now + 0.04);
        } catch {
          // Already stopped.
        }
      }
      try {
        vibratoLfo?.stop(now + 0.04);
      } catch {
        // Already stopped.
      }
      try {
        attackNoise?.stop(now);
      } catch {
        // Already stopped or never started.
      }
    };
    const handle: StopHandle = { stop: stopNow };
    this.#activeVoices.add(handle);

    window.setTimeout(
      () => {
        this.#activeVoices.delete(handle);
        voiceGain.disconnect();
        filter.disconnect();
        for (const osc of oscillators) osc.disconnect();
        vibratoLfo?.disconnect();
        vibratoDepth?.disconnect();
        attackNoise?.disconnect();
        attackFilter?.disconnect();
        attackGain?.disconnect();
      },
      (stopAt - startAt) * 1000 + 50,
    );
  }

  // Sine sweep from a punchy click down into a sub thump — no samples, just
  // a pitch envelope, which is the standard way to synthesise a kick.
  #playKick(context: AudioContext, destination: AudioNode, startAt: number): void {
    const stopAt = startAt + KICK_DURATION_S;
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, startAt);
    osc.frequency.exponentialRampToValueAtTime(46, startAt + 0.1);

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.linearRampToValueAtTime(1, startAt + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, stopAt);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(startAt);
    osc.stop(stopAt + 0.02);

    const stopNow = (): void => {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.02);
      try {
        osc.stop(now + 0.03);
      } catch {
        // Already stopped.
      }
    };
    const handle: StopHandle = { stop: stopNow };
    this.#activeVoices.add(handle);
    window.setTimeout(
      () => {
        this.#activeVoices.delete(handle);
        osc.disconnect();
        gain.disconnect();
      },
      KICK_DURATION_S * 1000 + 60,
    );
  }

  // A noise burst for the crack, a short pitched "body" underneath — the
  // classic two-layer synthesised snare.
  #playSnare(context: AudioContext, destination: AudioNode, startAt: number): void {
    const stopAt = startAt + SNARE_DURATION_S;

    const noise = context.createBufferSource();
    noise.buffer = createNoiseBuffer(context, SNARE_DURATION_S);
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1600;
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.7, startAt);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, stopAt);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(destination);
    noise.start(startAt);
    noise.stop(stopAt + 0.02);

    const body = context.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(200, startAt);
    body.frequency.exponentialRampToValueAtTime(140, startAt + 0.08);
    const bodyGain = context.createGain();
    bodyGain.gain.setValueAtTime(0.4, startAt);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.09);
    body.connect(bodyGain);
    bodyGain.connect(destination);
    body.start(startAt);
    body.stop(startAt + 0.1);

    const stopNow = (): void => {
      const now = context.currentTime;
      for (const gainNode of [noiseGain, bodyGain]) {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.02);
      }
      try {
        noise.stop(now + 0.03);
      } catch {
        // Already stopped.
      }
      try {
        body.stop(now + 0.03);
      } catch {
        // Already stopped.
      }
    };
    const handle: StopHandle = { stop: stopNow };
    this.#activeVoices.add(handle);
    window.setTimeout(
      () => {
        this.#activeVoices.delete(handle);
        noise.disconnect();
        noiseFilter.disconnect();
        noiseGain.disconnect();
        body.disconnect();
        bodyGain.disconnect();
      },
      SNARE_DURATION_S * 1000 + 80,
    );
  }

  // A short, bright noise burst — closed by a fast decay the way a closed
  // hi-hat chokes itself.
  #playHihat(context: AudioContext, destination: AudioNode, startAt: number): void {
    const stopAt = startAt + HIHAT_DURATION_S;
    const noise = context.createBufferSource();
    noise.buffer = createNoiseBuffer(context, HIHAT_DURATION_S);
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7500;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.32, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, stopAt);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(startAt);
    noise.stop(stopAt + 0.01);

    const stopNow = (): void => {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.01);
      try {
        noise.stop(now + 0.015);
      } catch {
        // Already stopped.
      }
    };
    const handle: StopHandle = { stop: stopNow };
    this.#activeVoices.add(handle);
    window.setTimeout(
      () => {
        this.#activeVoices.delete(handle);
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      },
      HIHAT_DURATION_S * 1000 + 40,
    );
  }
}

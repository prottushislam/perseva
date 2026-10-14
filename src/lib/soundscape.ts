export type SoundKind = "rain" | "piano" | "violin" | "cello";

const PIANO = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 349.23];
const VIOLIN = [440, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88];
const CELLO = [196.0, 220.0, 246.94, 196.0, 174.61, 220.0, 164.81, 196.0];

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private timer: number | null = null;
  kind: SoundKind | null = null;

  async play(kind: SoundKind, volume: number) {
    this.stop();
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const master = this.ctx.createGain();
    master.gain.value = clamp(volume);
    master.connect(this.ctx.destination);
    this.master = master;
    this.kind = kind;
    if (kind === "rain") this.rain(this.ctx, master);
    else if (kind === "piano") this.loop(this.ctx, master, PIANO, 2800, (freq) => this.hammer(this.ctx!, master, freq));
    else if (kind === "violin") this.loop(this.ctx, master, VIOLIN, 3600, (freq) => this.bow(this.ctx!, master, freq, 3.4, true));
    else this.loop(this.ctx, master, CELLO, 4200, (freq) => this.bow(this.ctx!, master, freq, 4, false));
  }

  volume(value: number) {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(clamp(value), this.ctx.currentTime, 0.08);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.master?.disconnect();
    this.master = null;
    this.kind = null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private rain(ctx: AudioContext, master: GainNode) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.98 + white * 0.02;
      data[i] = last * 3;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const hush = ctx.createGain();
    hush.gain.value = 0.35;
    source.connect(filter);
    filter.connect(hush);
    hush.connect(master);
    source.start();
    this.sources.push(source);
  }

  private loop(ctx: AudioContext, master: GainNode, notes: number[], every: number, play: (freq: number) => void) {
    let step = 0;
    const next = () => {
      if (!this.ctx || !this.kind || this.kind === "rain") return;
      play(notes[step % notes.length]);
      step += 1;
      if (this.sources.length > 24) this.sources.splice(0, this.sources.length - 12);
    };
    next();
    this.timer = window.setInterval(next, every);
    void ctx;
    void master;
  }

  private hammer(ctx: AudioContext, master: GainNode, freq: number) {
    const now = ctx.currentTime;
    const partials: [OscillatorType, number, number, number][] = [
      ["sine", 1, 0.14, 3.4],
      ["triangle", 2, 0.035, 1.6],
    ];
    for (const [type, ratio, level, decay] of partials) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + decay + 0.05);
      this.sources.push(osc);
    }
  }

  private bow(ctx: AudioContext, master: GainNode, freq: number, seconds: number, violin: boolean) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = violin ? 5 : 4.2;
    const depth = ctx.createGain();
    depth.gain.value = freq * (violin ? 0.006 : 0.004);
    lfo.connect(depth);
    depth.connect(osc.frequency);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(violin ? 700 : 380, now);
    filter.frequency.exponentialRampToValueAtTime(violin ? 1600 : 800, now + 0.7);
    filter.frequency.exponentialRampToValueAtTime(violin ? 900 : 420, now + seconds);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(violin ? 0.09 : 0.11, now + 0.55);
    gain.gain.setValueAtTime(violin ? 0.07 : 0.08, now + seconds * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + seconds + 0.05);
    lfo.stop(now + seconds + 0.05);
    this.sources.push(osc, lfo);
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

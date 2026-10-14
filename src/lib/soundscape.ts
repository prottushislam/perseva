export type SoundKind = "rain" | "stream" | "piano";

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private timer: number | null = null;
  kind: SoundKind | null = null;

  async play(kind: SoundKind, volume: number) {
    this.stop();
    const Ctx = window.AudioContext;
    if (!this.ctx) this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const master = this.ctx.createGain();
    master.gain.value = clamp(volume);
    master.connect(this.ctx.destination);
    this.master = master;
    if (kind === "piano") {
      this.kind = kind;
      this.piano(this.ctx, master);
    } else {
      this.noise(this.ctx, master, kind === "rain" ? 1100 : 480);
      this.kind = kind;
    }
  }

  volume(value: number) {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(clamp(value), this.ctx.currentTime, 0.05);
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

  private noise(ctx: AudioContext, master: GainNode, cutoff: number) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 4;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.6;
    source.connect(filter);
    filter.connect(master);
    source.start();
    this.sources.push(source);
  }

  private piano(ctx: AudioContext, master: GainNode) {
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 392.0, 329.63];
    let step = 0;
    const strike = () => {
      if (!this.ctx || this.kind !== "piano") return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = notes[step % notes.length];
      step += 1;
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 1.7);
      this.sources.push(osc);
      if (this.sources.length > 12) this.sources.splice(0, this.sources.length - 8);
    };
    strike();
    this.timer = window.setInterval(strike, 1800);
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

const MELODY = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 349.23];

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private timer: number | null = null;
  playing = false;

  async play(volume: number) {
    this.stop();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) throw new Error("Audio is not available in this browser.");
    if (!this.ctx || this.ctx.state === "closed") this.ctx = new Ctx();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const master = this.ctx.createGain();
    master.gain.value = clamp(volume);
    master.connect(this.ctx.destination);
    this.master = master;
    this.playing = true;
    let step = 0;
    const next = () => {
      if (!this.ctx || !this.playing || !this.master) return;
      const note = MELODY[step % MELODY.length];
      this.hammer(this.ctx, this.master, note, 0.55);
      if (step % 2 === 0) this.hammer(this.ctx, this.master, note / 2, 0.28);
      step += 1;
      if (this.sources.length > 40) this.sources.splice(0, this.sources.length - 20);
    };
    next();
    this.timer = window.setInterval(next, 2200);
  }

  volume(value: number) {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(clamp(value), this.ctx.currentTime, 0.05);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.playing = false;
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
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private hammer(ctx: AudioContext, master: GainNode, freq: number, level: number) {
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + 1.6);
    const voice = ctx.createGain();
    voice.gain.setValueAtTime(0.0001, now);
    voice.gain.exponentialRampToValueAtTime(Math.max(0.05, level), now + 0.02);
    voice.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    filter.connect(voice);
    voice.connect(master);
    const partials: [number, OscillatorType, number][] = [
      [1, "triangle", 1],
      [2, "sine", 0.35],
      [3, "sine", 0.16],
      [4, "sine", 0.08],
    ];
    for (const [ratio, type, amount] of partials) {
      const osc = ctx.createOscillator();
      const partial = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * ratio;
      partial.gain.value = amount;
      osc.connect(partial);
      partial.connect(filter);
      osc.start(now);
      osc.stop(now + 2.5);
      this.sources.push(osc);
    }
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

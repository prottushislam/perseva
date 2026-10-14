const NOTES = [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 349.23];

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private timer: number | null = null;
  playing = false;

  async play(volume: number) {
    this.stop();
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const master = this.ctx.createGain();
    master.gain.value = clamp(volume);
    master.connect(this.ctx.destination);
    this.master = master;
    this.playing = true;
    let step = 0;
    const next = () => {
      if (!this.ctx || !this.playing) return;
      this.hammer(this.ctx, master, NOTES[step % NOTES.length]);
      step += 1;
      if (this.sources.length > 16) this.sources.splice(0, this.sources.length - 8);
    };
    next();
    this.timer = window.setInterval(next, 2800);
  }

  volume(value: number) {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(clamp(value), this.ctx.currentTime, 0.08);
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
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

import { soundTracks, type SoundKind } from './sounds';
export type { SoundKind } from './sounds';

/** Recorded audio, loaded only on request. One voice, a quiet default, no autoplay. */
export class Soundscape {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  source: AudioBufferSourceNode | null = null;
  private voice: GainNode | null = null;
  active: SoundKind | null = null;
  private generation = 0;
  private request: AbortController | null = null;
  private buffers = new Map<SoundKind, AudioBuffer>();
  private level = .18;

  async play(kind: SoundKind, volume: number): Promise<boolean> {
    const generation = ++this.generation;
    this.request?.abort();
    this.request = new AbortController();
    const signal = this.request.signal;
    this.level = volume;
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.level * .65;
      this.master.connect(this.context.destination);
    }
    const ctx = this.context;
    await ctx.resume();
    let buffer = this.buffers.get(kind);
    if (!buffer) {
      const track = soundTracks.find(t => t.id === kind)!;
      const response = await fetch(track.file, { signal });
      if (!response.ok) throw new Error('This sound could not be loaded. Please try again.');
      const decoded = await ctx.decodeAudioData(await response.arrayBuffer());
      if (generation !== this.generation) return false;
      // Join the tail and head over two seconds to remove a hard loop boundary.
      const overlap = Math.min(Math.round(decoded.sampleRate * 2), Math.floor(decoded.length / 8));
      buffer = ctx.createBuffer(decoded.numberOfChannels, decoded.length - overlap, decoded.sampleRate);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const input = decoded.getChannelData(ch), out = buffer.getChannelData(ch);
        out.set(input.subarray(0, out.length));
        for (let i = 0; i < overlap; i++) {
          const blend = i / Math.max(1, overlap - 1);
          out[i] = input[decoded.length - overlap + i] * (1 - blend) + input[i] * blend;
        }
      }
      if (this.buffers.size >= 2) this.buffers.delete(this.buffers.keys().next().value!);
      this.buffers.set(kind, buffer);
    }
    if (generation !== this.generation) return false;
    this.releaseVoice();
    const source = ctx.createBufferSource();
    const voice = ctx.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(voice);
    voice.connect(this.master!);
    voice.gain.setValueAtTime(0, ctx.currentTime);
    voice.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.4);
    this.volume(this.level);
    source.onended = () => { source.disconnect(); voice.disconnect(); };
    source.start();
    this.source = source;
    this.voice = voice;
    this.active = kind;
    return true;
  }
  volume(value: number) {
    this.level = Math.min(1, Math.max(0, value));
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.level * .65, this.context.currentTime, .06);
    }
  }
  stop() {
    ++this.generation;
    this.request?.abort();
    this.request = null;
    this.active = null;
    this.releaseVoice();
  }
  private releaseVoice() {
    const old = this.source, voice = this.voice;
    this.source = null;
    this.voice = null;
    if (this.context && voice && old) {
      const time = this.context.currentTime;
      voice.gain.cancelAndHoldAtTime(time);
      voice.gain.setTargetAtTime(0, time, .06);
      try { old.stop(time + .3); } catch {}
    }
  }
  dispose() {
    this.stop();
    this.buffers.clear();
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }
}

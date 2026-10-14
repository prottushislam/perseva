export type SoundId = "piano" | "quiet" | "rain" | "forest";

export const SOUNDS: { id: SoundId; title: string; copy: string; src: string }[] = [
  { id: "piano", title: "Piano", copy: "A short, quiet piece. Good for reading.", src: "/audio/piano.mp3" },
  { id: "quiet", title: "Quiet", copy: "Slow music, nothing busy.", src: "/audio/quiet.mp3" },
  { id: "rain", title: "Rain", copy: "Soft rain, looping.", src: "/audio/rain.mp3" },
  { id: "forest", title: "Forest", copy: "Rain under the trees.", src: "/audio/forest.mp3" },
];

export class Ambience {
  private audio: HTMLAudioElement | null = null;
  id: SoundId | null = null;

  async play(id: SoundId, volume: number) {
    const track = SOUNDS.find((item) => item.id === id);
    if (!track) return;
    this.stop();
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.volume = clamp(volume);
    this.audio = audio;
    this.id = id;
    await audio.play();
  }

  volume(value: number) {
    if (this.audio) this.audio.volume = clamp(value);
  }

  stop() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.src = "";
    this.audio = null;
    this.id = null;
  }

  dispose() {
    this.stop();
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export type SoundKind = 'rain' | 'river' | 'piano';
export const soundTracks = [
  { id: 'rain', label: 'Gentle rain', description: 'A steady rainfall, without thunder.', detail: 'NATURE', file: '/audio/rain.mp3', color: 'blue' },
  { id: 'river', label: 'By the stream', description: 'Flowing water and open air.', detail: 'NATURE', file: '/audio/river.mp3', color: 'green' },
  { id: 'piano', label: 'Quiet piano', description: 'Unhurried notes. Room to think.', detail: 'INSTRUMENTAL', file: '/audio/piano.mp3', color: 'peach' },
] as const;

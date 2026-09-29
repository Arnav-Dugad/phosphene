import type { SpectralKey } from '../design/tokens.ts';

/** Keys of the WebGL scenes the persistent stage can host. */
export type SceneKey =
  | 'lacuna'
  | 'orrery'
  | 'relic'
  | 'constellation'
  | 'array'
  | 'static'
  | 'interference'
  | 'resonance'
  | 'gravity'
  | 'terrain'
  | 'aurora';

/** Modes of the shared Lacuna scene (the ring over the black sea). */
export type LacunaMode = 'home' | 'chronicle' | 'ambient' | 'dusk' | 'finale' | 'credits' | 'lanterns' | 'choir';

export type { SpectralKey };

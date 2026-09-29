/**
 * The fixed facts of the PHOSPHENE universe. Pure data: imported by the app,
 * the build-time prerenderer and the tests.
 */
export const world = {
  name: 'PHOSPHENE',
  institute: 'The Phosphene Institute',
  tagline: 'The Observatory of Remembered Light',
  definition: {
    word: 'phos·phene',
    pronunciation: '/ˈfɒs.fiːn/',
    partOfSpeech: 'noun',
    sense: 'The sensation of seeing light without light entering the eye.',
  },
  array: 'Halden Deep Array',
  arraySite: 'Daedalus Crater, lunar far side',
  /** Daedalus is a real far-side crater, long proposed for radio astronomy. */
  arrayLatitude: -5.9,
  arrayLongitude: 179.4,
  signal: 'The Serein Signal',
  signalGloss: 'serein — fine rain falling from a cloudless sky',
  source: 'The Lacuna',
  constellation: 'Cygnus',
  rightAscension: { h: 20, m: 41, s: 26 },
  declination: { d: 41, m: 12, s: 8 },
  distanceLightYears: 36_200,
  civilization: 'the Ithra',
  civilizationGloss: 'those who keep the light',
  star: 'Vael',
  /** Observatory Standard Time runs three centuries ahead of the visitor's calendar. */
  yearOffset: 300,
  /** First detection, in observatory time. */
  detectionIso: '2236-03-14T04:12:00Z',
  /** The carrier's heartbeat: the period of Transmission Zero's repetition. */
  cadenceSeconds: 9 * 3600 + 17 * 60 + 23,
  /** Estimated operating life of the Choir, i.e. the total length of the stream. */
  streamYearsTotal: 1100,
  channels: 7,
  dishes: 64,
} as const;

export type World = typeof world;

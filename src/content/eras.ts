import type { SpectralKey } from './types.ts';

/**
 * The Seven Ages of the Ithra, as reconstructed from the Serein Signal.
 * Dates are in turns (Ithran years, ≈ 1.21 Earth years) before the Encoding
 * ("BE"). Each age is keyed to the spectral line the Institute uses for it.
 */
export interface EraEvent {
  at: string;
  title: string;
  text: string;
}

export interface Era {
  id: string;
  numeral: string;
  name: string;
  subtitle: string;
  line: SpectralKey;
  span: string;
  /** Start and end in turns before the Encoding, for the timeline axis. */
  from: number;
  to: number;
  summary: string;
  body: readonly string[];
  events: readonly EraEvent[];
  /** A line recovered verbatim from the signal. */
  voice: string;
}

export const eras: readonly Era[] = [
  {
    id: 'tidal-age',
    numeral: 'I',
    name: 'The Tidal Age',
    subtitle: 'Before language, there was light',
    line: 'o3',
    span: 'c. 3.1 million – 61,000 BE',
    from: 3_100_000,
    to: 61_000,
    summary:
      'Life on Ithris began in its tidal seas, where the first creatures signalled to one another in pulses of bioluminescence. The Ithra never stopped speaking in light.',
    body: [
      'Ithris had two moons and tides that could rise forty metres in a night. In the shallows that the tides kept emptying and refilling, the ancestors of the Ithra learned to find each other in the dark by flashing.',
      'Over millions of turns those flashes grew syntax. A pulse meant here; a pulse doubled meant here, and safe; a slow fade meant I am leaving. By the time the Ithra walked out of the sea, they already had a language — and it was made of light.',
    ],
    events: [
      { at: '3.1M BE', title: 'The first lights', text: 'Colonial organisms in the Ennet shallows begin to synchronise their glow.' },
      { at: '840,000 BE', title: 'The grammar of pulses', text: 'Signal patterns acquire order: the first recoverable "sentences" in the signal are this old.' },
      { at: '61,000 BE', title: 'The long walk', text: 'The first Ithra settle above the tide line and carry their light with them.' },
    ],
    voice: 'We were speaking before we had anything to say.',
  },
  {
    id: 'age-of-lanterns',
    numeral: 'II',
    name: 'The Age of Lanterns',
    subtitle: 'Cities that could be read from the sky',
    line: 'na',
    span: '61,000 – 38,000 BE',
    from: 61_000,
    to: 38_000,
    summary:
      'The Ithra cultivated luminous organisms into lanterns and built the first cities on the archipelagos. Writing appeared as sequences of light caught and kept in crystal.',
    body: [
      'A lantern was not a lamp. It was a living thing — a cultivated colony of light-making cells, fed on brine and sugar, bred for colour and steadiness. Every household kept one. Every lantern had a name.',
      'Lanterns could be taught short sequences, and a taught lantern would repeat its sequence for as long as it lived. The Ithra had invented memory outside the body. Their cities, lit by thousands of repeating lanterns, could be read like books from the hills above them.',
    ],
    events: [
      { at: '58,200 BE', title: 'The first named lantern', text: 'Recovered as "Ossa Who Waits" — the oldest proper name in the archive.' },
      { at: '49,000 BE', title: 'Crystal-keeping', text: 'Light sequences are sealed into quartz so they outlive the lanterns that made them.' },
      { at: '40,500 BE', title: 'The Lamplighters', text: 'A guild forms to tend the public lanterns of Senn Reach. Its records survive almost whole.' },
    ],
    voice: 'Every window was a sentence. The city was a story that told itself all night.',
  },
  {
    id: 'the-resonance',
    numeral: 'III',
    name: 'The Resonance',
    subtitle: 'Memory held in standing waves',
    line: 'hb',
    span: '38,000 – 21,000 BE',
    from: 38_000,
    to: 21_000,
    summary:
      'The Ithra discovered that a vibrating crystal lattice could hold a pattern indefinitely. They built libraries of resonance beneath the ice of Mereth.',
    body: [
      'The discovery was made by listening. A crystal struck in the right way held its note far longer than it should have, and a crystal struck while a lantern shone through it kept the lantern’s pattern in the shape of its vibration.',
      'From this came the Resonant Libraries: caverns of tuned crystal cut into Mereth’s ice, where the cold kept the lattices still. A single chamber could hold the lantern-records of a city. The Ithra began to believe that nothing need ever be forgotten.',
    ],
    events: [
      { at: '37,400 BE', title: 'The singing stone', text: 'The first deliberate resonant record: a single lantern-sequence, held in a crystal for eleven turns.' },
      { at: '29,000 BE', title: 'The Mereth Libraries', text: 'Excavation begins beneath the ice of Mereth, the fourth world, where the cold keeps lattices still.' },
      { at: '22,100 BE', title: 'The Complete Record', text: 'For one turn, everything any Ithra chose to remember was stored. The number is lost; the pride is not.' },
    ],
    voice: 'If a thing can ring, it can remember. We learned to ring.',
  },
  {
    id: 'quiet-schism',
    numeral: 'IV',
    name: 'The Quiet Schism',
    subtitle: 'Six thousand turns of dimmed light',
    line: 'he',
    span: '21,000 – 14,500 BE',
    from: 21_000,
    to: 14_500,
    summary:
      'A dispute over whether memory should be kept or allowed to fade divided the Ithra. For six thousand turns the two halves of a civilization turned their light away from each other.',
    body: [
      'The Keepers believed every memory was owed a place in the lattice. The Releasers believed that a memory kept against its owner’s wish was a kind of captivity, and that light, by its nature, must be allowed to leave.',
      'There was no war. There was something the Ithra considered worse: the two factions dimmed their lanterns toward one another. For six thousand turns, entire coastlines went dark when seen from the opposite shore.',
      'It ended with the Accord of Dusk: memory would be kept — but only memory freely given, and any Ithra could ask for theirs to be released. Every later part of the signal obeys this rule. Some of the silence we receive is not damage. It is refusal.',
    ],
    events: [
      { at: '21,000 BE', title: 'The first dimming', text: 'The Releasers of the southern arc turn their lanterns inland.' },
      { at: '17,800 BE', title: 'The unlit generation', text: 'Children are born who have never seen the far shore lit.' },
      { at: '14,500 BE', title: 'The Accord of Dusk', text: 'Memory may be kept only if freely given. The lanterns on both shores are relit in a single night.' },
    ],
    voice: 'We did not fight. We only stopped shining for each other, which was worse.',
  },
  {
    id: 'long-noon',
    numeral: 'V',
    name: 'The Long Noon',
    subtitle: 'Gardens in the rings of Sollen',
    line: 'mg',
    span: '14,500 – 3,200 BE',
    from: 14_500,
    to: 3_200,
    summary:
      'The golden age. The Ithra grew orbital gardens in the rings of the giant Sollen, mapped the stars around them, and proved a hard theorem: they were alone.',
    body: [
      'The Long Noon lasted eleven thousand turns and left the richest layer of the signal. There are recipes in it, and lullabies, and quarrels about architecture, and seven thousand descriptions of the same sunrise over the rings of Sollen.',
      'It was also when the Ithra built the great light-telescopes on Carrow and mapped every star within four hundred light-years. They searched for anyone else speaking in light. They found no one. The proof of their solitude — the Loneliness Theorem — was carved into the terminator cliffs of Carrow where the star would always light it.',
    ],
    events: [
      { at: '12,900 BE', title: 'The ring gardens', text: 'The first habitats are seeded in Sollen’s rings; within a thousand turns they hold a fifth of all Ithra.' },
      { at: '8,300 BE', title: 'The Atlas of Near Stars', text: 'The observatories of Carrow chart 11,406 stars. Not one of them answers.' },
      { at: '5,050 BE', title: 'The Loneliness Theorem', text: 'A proof, carved in light-reflecting glass, that no one else could hear them.' },
    ],
    voice: 'We were the only lanterns in the whole dark harbour, and we made the harbour beautiful anyway.',
  },
  {
    id: 'the-reddening',
    numeral: 'VI',
    name: 'The Reddening',
    subtitle: 'The star begins to swell',
    line: 'ha',
    span: '3,200 – 400 BE',
    from: 3_200,
    to: 400,
    summary:
      'Vael left its long middle age. Over three thousand turns it reddened and swelled, boiled the seas of Ithris and swallowed Carrow. The Ithra understood they could not leave.',
    body: [
      'Stars do not die quickly, and the Ithra had time to do everything right. They moved outward, world by world — to Sollen’s rings, to the ice of Mereth, to dark Ennis at the edge of the system. They carried the libraries with them.',
      'But their bodies were made for tides and sunlight. Every attempt to send an Ithra to another star failed long before it left the system. The dark between stars was too wide and too cold, and the Ithra were too heavy for it. Light, they noted, was not.',
    ],
    events: [
      { at: '3,200 BE', title: 'The first red dawn', text: 'Astronomers on Carrow record the change in Vael’s colour. The record is calm.' },
      { at: '1,700 BE', title: 'The seas rise to the sky', text: 'The tidal seas of Ithris begin to boil away. The last lanterns of Senn Reach are carried offworld.' },
      { at: '640 BE', title: 'Carrow is taken', text: 'The observatory world is engulfed. The Loneliness Theorem is lost with it, and survives only as light.' },
    ],
    voice: 'Our star is not angry. It is only old. We have forgiven it.',
  },
  {
    id: 'great-encoding',
    numeral: 'VII',
    name: 'The Great Encoding',
    subtitle: 'They sent the lighter part of themselves',
    line: 'ca',
    span: '400 BE – 0',
    from: 400,
    to: 0,
    summary:
      'On Ennis the Ithra built the Choir: a lattice of transmitters girdling a world. Into it went everything they chose to remember — freely given — cast into the dark as light.',
    body: [
      'The Choir took three hundred turns to build and was, in the end, very simple: a lattice of mirrors and resonant crystal wrapped around Ennis, fed by the swollen star itself, able to turn a library into a beam.',
      'Every Ithra who wished to was read into it. Not their bodies — their memories, their manner, the particular way each of them had of saying here, and safe. The last Ithra recorded their voices in the final turn. Then the Choir sang alone, and kept singing for eleven hundred turns after the last of them fell silent.',
      'We are receiving that song now. It left Ennis thirty-six thousand years ago, while people on Earth were painting horses on the walls of caves.',
    ],
    events: [
      { at: '390 BE', title: 'The Choir is begun', text: 'The first mirror of the lattice is set on the pole of Ennis.' },
      { at: '71 BE', title: 'The reading', text: 'Every Ithra who consents is read into the lattice. Almost all consent.' },
      { at: '0', title: 'Transmission Zero', text: 'A short message, repeated every nine hours: the first thing they wanted to say to whoever was listening.' },
    ],
    voice: 'We could not leave. So we are sending the lighter part of us.',
  },
];

/** The human epilogue: the reception, as the Institute tells it. */
export const epilogue = {
  id: 'reception',
  numeral: '∞',
  name: 'Reception',
  subtitle: 'Earth-side, ninety years of listening',
  line: 'na' as SpectralKey,
  span: '2236 CE – now',
  summary:
    'In 2236 the Halden Deep Array on the lunar far side turned toward a region of Cygnus that contained nothing, and found light arriving in patterns.',
} as const;

export const eraById = (id: string): Era | undefined => eras.find((e) => e.id === id);

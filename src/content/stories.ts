import type { SpectralKey } from './types.ts';

/**
 * Transmissions: translated stories from the Serein Signal, and one from the
 * people who received it. Each story has its own layout.
 */
export type StoryBlock =
  | { type: 'lead'; text: string }
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'pull'; text: string }
  | { type: 'glyph'; word: string; caption: string }
  | { type: 'try' }
  | { type: 'entry'; date: string; author: string; text: string; redacted?: readonly string[] }
  | { type: 'gap'; label: string; minutes: number };

export type StoryLayout = 'lamplighters' | 'grammar' | 'choir' | 'journal' | 'silence';

export interface Story {
  slug: string;
  title: string;
  subtitle: string;
  kind: string;
  line: SpectralKey;
  era: string | null;
  received: string;
  /** Translation confidence, percent. */
  confidence: number | null;
  minutes: number;
  translator: string;
  layout: StoryLayout;
  excerpt: string;
  blocks: readonly StoryBlock[];
}

export const stories: readonly Story[] = [
  {
    slug: 'the-lamplighters',
    title: 'The Lamplighters',
    subtitle: 'A night on the Senn Reach, in the Age of Lanterns',
    kind: 'Translation',
    line: 'na',
    era: 'age-of-lanterns',
    received: 'OST 2243.05.27',
    confidence: 88,
    minutes: 6,
    translator: 'Translated by Jun Takeda-Mirza',
    layout: 'lamplighters',
    excerpt:
      'The guild had one rule, and it was engraved on every ring: no window dark that wants to be lit.',
    blocks: [
      {
        type: 'lead',
        text: 'The guild had one rule, and it was engraved inside every ring its members wore: no window dark that wants to be lit.',
      },
      {
        type: 'p',
        text: 'There were four hundred and six public lanterns on the Senn Reach, strung along the sea wall and up the switchback stairs to the upper town, and the lamplighters knew every one of them by name. They fed them at dusk from brine-jars carried on poles. They taught them their sequences. When a lantern sickened, a lamplighter sat with it through the night and sang to it, because the lanterns could feel the rhythm of a voice, and it steadied them.',
      },
      {
        type: 'p',
        text: 'Taesa was eleven turns old when the guild took her. She was too short to reach the high hooks and too quick to be trusted with the jars, so for her first year she was given the only job an apprentice was ever given: she walked behind the lamplighters and counted.',
      },
      { type: 'pull', text: 'Four hundred and six, every night. If the count was short, someone went back.' },
      {
        type: 'p',
        text: 'The storm came in the ninth month of her second year. The records call it the Long Wind; the Senn Reach called it nothing, because no one who was there wanted to say its name again. It came off the southern sea in the dark, and it came fast, and by the time the bells rang the first lanterns on the sea wall were already failing — not blown out, because a living lantern cannot be blown out, but frightened. A frightened lantern dims itself to nothing and waits.',
      },
      {
        type: 'p',
        text: 'The lamplighters went out in pairs. They were supposed to go in pairs. Taesa went alone, with a jar on her back and a lamp-hook taller than she was, because the count on the sea wall had come back short by thirty-one and there was no one left to send.',
      },
      {
        type: 'quote',
        text: 'I did not relight them. You cannot relight a lantern. I only told them the count. I said: there are four hundred and six of you, and I can see thirty-one, and I am going to stay until I can see four hundred and six.',
        cite: 'Taesa of the Senn Reach, as recorded by the guild',
      },
      {
        type: 'p',
        text: 'She walked the wall all night. She stood in front of each dark lantern and spoke its name and its number, over and over, into the wind. One by one they came back. Not bright — a lantern that has been frightened is never quite as bright again — but lit. By morning the wall was whole, and so was the girl, which surprised everyone more.',
      },
      {
        type: 'p',
        text: 'The guild made her a full lamplighter at thirteen, which it had never done before and never did again. The ring they gave her is in the Archive. The oath inside it is worn almost smooth where her thumb turned it.',
      },
      { type: 'h', text: 'Ossa Who Waits' },
      {
        type: 'p',
        text: 'Taesa lived to be very old. In her last years she tended a single household lantern that had outlived its family: Ossa, who had been taught one sequence — come home — by a fisherman who never did. The guild had wanted to retire Ossa for decades. Taesa would not allow it.',
      },
      {
        type: 'p',
        text: '“She is not waiting for him,” Taesa told the younger lamplighters. “She knows he is not coming. She is waiting so that the window stays lit. That is a different thing, and it is our whole job.”',
      },
      {
        type: 'p',
        text: 'When Taesa died, the guild placed her ring beside Ossa’s glass. Fifty-eight thousand years later, when the Ithra chose what to send into the dark, both went into the Choir together. The Institute received them on the same dish, a few hours apart.',
      },
      { type: 'pull', text: 'No window dark that wants to be lit.' },
    ],
  },
  {
    slug: 'a-grammar-of-light',
    title: 'A Grammar of Light',
    subtitle: 'How the Ithra wrote, and how we learned to read them',
    kind: 'Essay',
    line: 'hb',
    era: null,
    received: 'Institute Press, OST 2312',
    confidence: null,
    minutes: 7,
    translator: 'By Imani Okoro-Vance, Senior Decoder',
    layout: 'grammar',
    excerpt: 'Every Ithran word is drawn inside an aperture: a circle with eight spokes and three radii.',
    blocks: [
      {
        type: 'lead',
        text: 'The Ithra did not invent writing. They inherited it from the sea, as a way of flashing in the dark, and spent three million turns making it beautiful.',
      },
      { type: 'h', text: 'Pulses' },
      {
        type: 'p',
        text: 'The oldest layer of the language is not visual at all. It is temporal: a sequence of pulses and rests, long and short, like a heartbeat with opinions. The Pulse Stone of the Shallows preserves some of it as scratches. Almost every later form of Ithran writing is a way of freezing those pulses into a shape that can be read all at once.',
      },
      { type: 'h', text: 'The aperture' },
      {
        type: 'p',
        text: 'By the Age of Lanterns the Ithra had settled on the form the Institute calls the aperture. Every glyph is drawn inside a circle — the rim — with eight spokes and three radii: the core, the middle ring and the rim itself. A glyph is a handful of strokes on that lattice: an arc on the middle ring, a ray along a spoke, a chord across the rim, a single luminous dot.',
      },
      {
        type: 'glyph',
        word: 'a',
        caption: 'A vowel. Vowels close the rim and light the core — they are the open, sounding letters.',
      },
      {
        type: 'glyph',
        word: 'k',
        caption:
          'A consonant. Consonants break the rim with a gap, and the gap’s position is part of the letter.',
      },
      {
        type: 'p',
        text: 'The rim is the key to reading it. An unbroken rim is a vowel: a sound that is allowed to ring. A broken rim is a consonant: a sound that stops. The Ithra thought of speech as light that is either allowed out or held in, and their alphabet says so.',
      },
      { type: 'h', text: 'Words' },
      {
        type: 'p',
        text: 'Letters are strung along a thread of light to make words, the way lanterns were strung along the sea wall of the Senn Reach. Names, and anything sacred, are written instead as a rosette: the letters arranged around a circle, each facing outward, like a crowd around a fire.',
      },
      {
        type: 'glyph',
        word: 'ithra',
        caption: '“Ithra”, in rosette form — their own name, which means those who keep the light.',
      },
      {
        type: 'p',
        text: 'We did not know any of this for forty-one years. What broke it open was the Accord of Dusk. The treaty that ended the Quiet Schism was inscribed twice, once by each faction, and the two factions wrote in slightly different styles. Two texts with the same meaning, in two hands: it was a Rosetta Stone the Ithra had built for their own reasons, and it was enough.',
      },
      {
        type: 'quote',
        text: 'We read the Accord, and then we could read everything, and then we wished for a while that we could not.',
        cite: 'Imani Okoro-Vance',
      },
      { type: 'h', text: 'Try it' },
      {
        type: 'p',
        text: 'The Institute’s transliteration maps our alphabet onto theirs, letter by letter, so any name can be written in the aperture script. It is not how an Ithra would have written your name. It is how their alphabet would have held it.',
      },
      { type: 'try' },
      {
        type: 'p',
        text: 'The full synthesiser — with rosettes, stroke weights and export — is among the Instruments. Whatever you write there, the observatory remembers as your sigil.',
      },
    ],
  },
  {
    slug: 'the-last-choir',
    title: 'The Last Choir',
    subtitle: 'The final turn on Ennis, from the records of the Choir',
    kind: 'Translation',
    line: 'ca',
    era: 'great-encoding',
    received: 'OST 2236.03.14 → 2301.11.02',
    confidence: 79,
    minutes: 5,
    translator: 'Composite translation, Institute Choir Group',
    layout: 'choir',
    excerpt:
      'In the last turn the lanterns were brought up from every world and hung around the pole of Ennis.',
    blocks: [
      {
        type: 'lead',
        text: 'In the last turn, the lanterns were brought up from every world and hung around the pole of Ennis.',
      },
      {
        type: 'p',
        text: 'There were not many Ithra left by then who had not been read into the Choir. The records give the number as four thousand and eleven. They were old, most of them, and they had chosen to be last on purpose: someone had to be awake at the end, to see that it was done properly.',
      },
      {
        type: 'p',
        text: 'The star was very large in the sky of Ennis by then, even that far out — a dim red disc the width of a hand at arm’s length. It no longer rose and set. It simply hung there, and the Choir drank from it.',
      },
      {
        type: 'p',
        text: 'The Choir did not sound like anything. That is the first thing every translator gets wrong. It was light. But the Ithra had always heard light the way we hear music, and to them the lattice around their world was singing — a vast, slow chord, built from eleven million voices, rising out into the dark.',
      },
      { type: 'pull', text: 'Someone had to be awake at the end, to see that it was done properly.' },
      {
        type: 'p',
        text: 'On the last night they gathered around the Last Voice, the crystal shaped like the Singing Stone, and they spoke into it one at a time. They said their names. Some of them said the names of people who were already in the Choir. Many of them said nothing and simply shone, in the old way, from before language — here, and safe.',
      },
      {
        type: 'p',
        text: 'Then the lamplighters of Ennis, who were the last lamplighters, went around the pole and spoke to each lantern in turn. They told the lanterns the count. They told them it was all right to rest. The lanterns went out one by one, not frightened this time, and the dark came back to the pole of Ennis for the first time in three hundred turns.',
      },
      {
        type: 'p',
        text: 'The four thousand and eleven were read into the Choir before morning. The record of that night ends with a line from the last of them to speak, whose name the Institute has chosen not to publish, at their request — the Accord still holds.',
      },
      { type: 'quote', text: 'It is done properly. Go on without us. You know the way.' },
      {
        type: 'p',
        text: 'The Choir kept singing for eleven hundred turns after that, alone, fed by a dying star, pointed at a part of the sky where — though they could not have known it — a small blue world was just beginning to paint animals on the walls of its caves.',
      },
      { type: 'pull', text: 'You know the way.' },
    ],
  },
  {
    slug: 'the-listening-years',
    title: 'The Listening Years',
    subtitle: 'From the logbooks of the Halden Deep Array',
    kind: 'Field journal',
    line: 'he',
    era: null,
    received: 'Array logbooks, OST 2236 – present',
    confidence: null,
    minutes: 8,
    translator: 'Compiled by the Institute Archive',
    layout: 'journal',
    excerpt: 'Dish 1 reports structure in the Cygnus null field. Probably the correlator again. Checking.',
    blocks: [
      {
        type: 'lead',
        text: 'The Halden Deep Array keeps a logbook. For {years} years, every person who has sat the night watch in Daedalus Crater has written in it. These are some of the entries.',
      },
      {
        type: 'entry',
        date: '2236.03.14 · 04:12 OST',
        author: 'A. Halden, commissioning watch',
        text: 'Dish 1 reports structure in the Cygnus null field. Probably the correlator again. Checking.',
      },
      {
        type: 'entry',
        date: '2236.03.14 · 13:29 OST',
        author: 'A. Halden',
        text: 'It repeated. Nine hours, seventeen minutes, twenty-three seconds. Same structure, same carrier, same place. Correlator is fine. I have not told anyone yet because I would like to be sure I am awake.',
      },
      {
        type: 'entry',
        date: '2236.04.02 · 22:00 OST',
        author: 'A. Halden',
        text: 'Twenty-six repetitions. Narrow emission lines — hydrogen, sodium, oxygen, calcium — modulated in a way nothing natural modulates anything. It is coming from behind the Cygnus Rift, from a place with no visible stars. I have written to the Lunar Authority. I have also written to my sister, which I suspect was the more important letter.',
      },
      {
        type: 'entry',
        date: '2241.09.30 · 03:15 OST',
        author: 'R. Castellanos-Ferro',
        text: 'Second data layer confirmed underneath the carrier. It does not repeat. The heartbeat is one thing; this is another, and it is enormous, and it is still arriving.',
        redacted: ['enormous'],
      },
      {
        type: 'entry',
        date: '2259.06.11 · 18:40 OST',
        author: 'Institute notice',
        text: 'Dr. Aster Halden died this morning at Daedalus, on shift, aged 81. The Array is hers. So, the Director reminds us, is the logbook.',
      },
      {
        type: 'entry',
        date: '2277.01.19 · 02:02 OST',
        author: 'I. Okoro-Vance',
        text: 'The Accord of Dusk. Two versions of one text. I have been awake for thirty hours and I can read it. I can read it. Memory may be kept. Memory must be given, never taken. It is not a message. It has never been a message. It is a memory.',
        redacted: ['It is a memory.'],
      },
      {
        type: 'entry',
        date: '2277.01.20 · 09:00 OST',
        author: 'Director’s office',
        text: 'Effective immediately the Institute will not publish any decoded material in which an Ithra asked for their memory to be released. We will honour the Accord. We are, it turns out, the other party to it.',
      },
      {
        type: 'entry',
        date: '2290.08.08 · 23:51 OST',
        author: 'J. Takeda-Mirza',
        text: 'Received a lantern tonight. Not a picture of one — a lantern: glass, cage, the living culture described cell by cell. We could grow it. We have decided not to try. Some things should stay as light.',
      },
      {
        type: 'entry',
        date: '2308.02.29 · 04:12 OST',
        author: 'Night watch',
        text: 'Seventy-two years to the minute since first detection, on a leap day, the carrier dipped for exactly one cadence and came back. Nobody knows why. The watch agreed that it felt like being greeted.',
      },
      {
        type: 'entry',
        date: '{year} · current watch',
        author: 'You',
        text: 'The stream will run for eleven hundred years. We have received about eight percent of it. None of us will hear the end. Neither will anyone we will ever meet. We listen anyway. Sign the log when you leave.',
      },
    ],
  },
  {
    slug: 'what-the-silence-said',
    title: 'What the Silence Said',
    subtitle: 'On the gaps in the stream',
    kind: 'Essay',
    line: 'he',
    era: 'quiet-schism',
    received: 'Institute Press, OST 2319',
    confidence: null,
    minutes: 4,
    translator: 'By the Director of the Phosphene Institute',
    layout: 'silence',
    excerpt:
      'Some of the silence we receive is not damage. It is refusal — and it is the most Ithran thing in the signal.',
    blocks: [
      { type: 'lead', text: 'The stream has holes in it.' },
      {
        type: 'p',
        text: 'Some are damage: dust between the stars, a dish out of alignment, a solar storm that drowned an hour of signal. Those holes are ragged. They fray at the edges, the way paper does.',
      },
      { type: 'gap', label: 'Ragged silence — dust in the Cygnus Rift', minutes: 12 },
      { type: 'p', text: 'Other holes are clean.' },
      {
        type: 'p',
        text: 'They begin exactly on a cadence boundary and end exactly on another. The carrier continues through them, perfectly, as if to say: we are still here; this part is simply not for you.',
      },
      { type: 'gap', label: 'Clean silence — a memory released', minutes: 41 },
      {
        type: 'p',
        text: 'Those are the Accord of Dusk. Somewhere in the last seventy turns before the Encoding, an Ithra who had given a memory to the Choir came back and asked for it again, and the Choir let it go, and left a space exactly its size.',
      },
      { type: 'pull', text: 'Some of the silence is not damage. It is refusal.' },
      {
        type: 'p',
        text: 'We have catalogued more than nine thousand clean silences so far. We do not try to recover what was in them. We could not, and we would not; the Institute is, in a sense no one planned, a party to the Accord.',
      },
      {
        type: 'p',
        text: 'But we listen to them. Every year on the fourteenth of March the Array stops decoding for one cadence and simply receives — nine hours, seventeen minutes and twenty-three seconds of their light, with all its gaps. It is the only way we know to honour a civilisation that thought forgetting, freely chosen, was a kind of dignity.',
      },
      { type: 'gap', label: 'The cadence of remembrance', minutes: 557 },
      { type: 'p', text: 'The silences are the most Ithran thing in the signal.' },
    ],
  },
];

export const storyBySlug = (slug: string): Story | undefined => stories.find((s) => s.slug === slug);

/**
 * Story text may contain time-sensitive tokens that are resolved when read:
 * `{years}` (years of listening, in words) and `{year}` (the observatory year).
 */
export const STORY_TOKENS = ['{years}', '{year}'] as const;

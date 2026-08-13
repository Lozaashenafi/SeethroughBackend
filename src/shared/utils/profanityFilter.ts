// NOTE: keep the word list in sync with seethroughfront/src/utils/profanity.ts
// (the frontend mirrors this file so users get an instant client-side warning).

// Lightweight profanity filter for user-generated content. Designed to catch
// common English profanity while keeping false positives low:
//   - Every term is matched as a WHOLE word, so "class" never trips on "ass",
//     "can't" never trips on "cunt" and "batch" never trips on "bitch".
//   - Common obfuscations are normalised first: leetspeak ("sh1t", "f0ck")
//     and separator characters between letters ("f.u.c.k", "f u c k").
//   - Vowel-dropping obfuscations ("f*ck", "b*tch", "a**hole") are covered by
//     explicit variant patterns, each mapped back to its canonical spelling so
//     warning messages stay readable.

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
};

const BAD_WORDS: readonly string[] = [
  // f-words
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fucks',
  'motherfucker', 'motherfucking',
  // s-words
  'shit', 'shits', 'shitty', 'shitting', 'bullshit', 'horseshit', 'shithead',
  // b-words
  'bitch', 'bitches', 'bitchy', 'bitchass',
  // a-words
  'ass', 'asshole', 'assholes', 'asshat', 'asswipe', 'dumbass', 'jackass',
  'arse', 'arsehole',
  // d-words
  'dick', 'dicks', 'dickhead', 'dickheads',
  // c-words
  'cunt', 'cunts',
  // other vulgar terms
  'whore', 'whores',
  'slut', 'sluts', 'slutty',
  'bastard', 'bastards',
  'pussy', 'pussies',
  'twat', 'twats',
  'wanker', 'wankers',
  'prick', 'pricks',
  'bollocks',
  'piss', 'pissing', 'pissed',
  'damnit', 'goddamn',
  // slurs — never acceptable
  'nigger', 'nigga', 'niggas',
  'faggot', 'faggots', 'fag',
  'retard', 'retards', 'retarded',
];

// Obfuscated spellings (dropped letters/vowels) mapped to the canonical word
// shown to the user. Each pattern is still matched as a whole word, and only
// NON-letter characters may sit between its letters — so "can't" can never
// resolve to "cunt" ('a' is a letter and cannot be skipped).
const VARIANTS: Record<string, string> = {
  fck: 'fuck', fuk: 'fuck', fuq: 'fuck', fux: 'fuck', fvck: 'fuck', fuxk: 'fuck',
  phuck: 'fuck', phuk: 'fuck', fock: 'fuck',
  fcking: 'fucking', fckin: 'fucking', fckng: 'fucking', fuking: 'fucking',
  phucking: 'fucking', phcking: 'fucking',
  sht: 'shit', shyt: 'shit', shts: 'shit', shtty: 'shit', shtting: 'shit',
  btch: 'bitch', btches: 'bitch',
  ashole: 'asshole', asholes: 'asshole', ahole: 'asshole', aholes: 'asshole',
  dck: 'dick', dcks: 'dick',
  cnt: 'cunt', cnts: 'cunt',
  pssy: 'pussy',
  fggot: 'faggot', fagot: 'faggot',
  rtard: 'retard',
};

interface TermPattern {
  pattern: string;
  label: string;
  regex: RegExp;
}

// Each letter of a term may be followed by any run of non-letter characters,
// so "f.u.c.k", "f u c k" and "f*ck" (via its "fck" variant) all resolve.
const PATTERNS: readonly TermPattern[] = [
  ...BAD_WORDS.map((word) => ({ pattern: word, label: word })),
  ...Object.entries(VARIANTS).map(([pattern, label]) => ({ pattern, label })),
].map(({ pattern, label }) => ({
  pattern,
  label,
  regex: new RegExp(
    `\\b${pattern
      .split('')
      .map((ch) => `${ch}[^a-z0-9_]*`)
      .join('')}\\b`,
  ),
}));

/** Normalise obfuscated characters (leetspeak) before matching. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('');
}

/**
 * Returns the canonical spellings of the profane terms found in `text`, or an
 * empty array. Case-insensitive and tolerant of common obfuscations.
 */
export function findBadWords(text: string): string[] {
  if (!text) return [];
  const normalized = normalize(text);
  const found = new Set<string>();
  for (const { label, regex } of PATTERNS) {
    if (regex.test(normalized)) found.add(label);
  }
  return [...found];
}

/** Which fields contain profanity, and the exact terms found in each. */
export function findBadWordsInFields(
  fields: Record<string, string | undefined>,
): Array<{ field: string; words: string[] }> {
  const hits: Array<{ field: string; words: string[] }> = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const words = findBadWords(value);
    if (words.length > 0) hits.push({ field, words });
  }
  return hits;
}

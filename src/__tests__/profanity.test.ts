import { describe, it, expect } from 'vitest';
import {
  findBadWords,
  findBadWordsInFields,
} from '../shared/utils/profanityFilter.js';

describe('profanityFilter', () => {
  it('returns an empty array for clean text', () => {
    expect(findBadWords('This company pays well and has great culture.')).toEqual([]);
    expect(findBadWords('')).toEqual([]);
  });

  it('detects plain profanity regardless of case', () => {
    expect(findBadWords('This is a fucked up place')).toContain('fucked');
    expect(findBadWords('What a BITCH of a manager')).toContain('bitch');
    expect(findBadWords('total bullshit management')).toContain('bullshit');
  });

  it('does not flag innocent substrings (word-boundary matching)', () => {
    expect(findBadWords('I work in customer service and love my class')).toEqual([]);
    expect(findBadWords('The assistant helped me a lot')).toEqual([]);
    expect(findBadWords('She gave a passionate presentation')).toEqual([]);
    expect(findBadWords("The manager can't keep up with demand")).toEqual([]);
    expect(findBadWords('We run a batch of reports every night')).toEqual([]);
    expect(findBadWords('Cantonese food is served on Fridays')).toEqual([]);
  });

  it('detects common obfuscations (leetspeak and separator characters)', () => {
    expect(findBadWords('this place is f*cking toxic')).toContain('fucking');
    expect(findBadWords('they treat us like sh1t')).toContain('shit');
    expect(findBadWords('a b i t c h of a boss')).toContain('bitch');
    expect(findBadWords('management is b.u.l.l.s.h.i.t')).toContain('bullshit');
    expect(findBadWords('the ceo is an a**hole')).toContain('asshole');
    expect(findBadWords('that manager is a b*tch')).toContain('bitch');
    expect(findBadWords('this d*ck of a supervisor')).toContain('dick');
    expect(findBadWords('she is a ph*cking menace')).toContain('fucking');
    expect(findBadWords('they are all c*nts')).toContain('cunt');
  });

  it('returns all distinct words found', () => {
    const words = findBadWords('fuck this shit, fuck the bitch');
    expect(words).toContain('fuck');
    expect(words).toContain('shit');
    expect(words).toContain('bitch');
  });

  it('reports which fields contain profanity', () => {
    const hits = findBadWordsInFields({
      title: 'Great place to work',
      pros: 'None',
      cons: 'The manager is a dick',
      jobTitle: 'Engineer',
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].field).toBe('cons');
    expect(hits[0].words).toContain('dick');
  });

  it('ignores empty fields', () => {
    expect(findBadWordsInFields({ title: '', pros: undefined })).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  broadcastMessage,
  cropNameFromSlug,
  diseaseKeyCandidates,
  diseaseNameFromSlug,
  shortDay,
  warningSentence,
  warningSpeech,
} from './areaWarningText';

describe('diseaseKeyCandidates', () => {
  it('tries every split between crop and disease', () => {
    expect(diseaseKeyCandidates('paddy_rice_blast')).toEqual(['paddy:rice-blast', 'paddy-rice:blast']);
    expect(diseaseKeyCandidates('betel_leaf_leaf_rot')).toContain('betel-leaf:leaf-rot');
  });

  it('gives nothing for a single word', () => {
    expect(diseaseKeyCandidates('paddy')).toEqual([]);
  });
});

describe('diseaseNameFromSlug', () => {
  const labels: Record<string, string> = { 'paddy:rice-blast': 'Rice blast', 'betel-leaf:leaf-rot': 'Leaf rot' };
  const lookup = (key: string) => labels[key] ?? null;

  it('finds the name whichever split is right', () => {
    expect(diseaseNameFromSlug('paddy_rice_blast', 'en', lookup)).toBe('Rice blast');
    expect(diseaseNameFromSlug('betel_leaf_leaf_rot', 'en', lookup)).toBe('Leaf rot');
  });

  it('returns null when the disease is unknown', () => {
    expect(diseaseNameFromSlug('paddy_unknown_thing', 'en', lookup)).toBeNull();
  });
});

describe('warningSentence', () => {
  it('writes English with plain numbers', () => {
    expect(warningSentence({ farmers: 4, crop: 'paddy', disease: 'Rice blast' }, 'en')).toBe(
      '4 farmers near you reported Rice blast on paddy in the last 14 days.'
    );
  });

  it('writes Bangla with Bangla numerals', () => {
    const text = warningSentence({ farmers: 4, crop: 'paddy', disease: 'ধানের ব্লাস্ট' }, 'bn');
    expect(text).toContain('৪ জন কৃষক');
    expect(text).toContain('১৪ দিনে');
    expect(text).toContain('ধান ফসলে ধানের ব্লাস্ট');
    expect(text).not.toMatch(/[0-9]/);
  });

  it('still reads well when the disease has no name', () => {
    expect(warningSentence({ farmers: 3, crop: 'potato', disease: null }, 'en')).toContain('the same problem on potato');
    expect(warningSentence({ farmers: 3, crop: 'potato', disease: null }, 'bn')).toContain('আলু ফসলে একই সমস্যা');
  });

  it('adds the not-confirmed note for speech', () => {
    expect(warningSpeech({ farmers: 3, crop: 'jute', disease: null }, 'en')).toContain('not confirmed');
    expect(warningSpeech({ farmers: 3, crop: 'jute', disease: null }, 'bn')).toContain('নিশ্চিত নয়');
  });
});

describe('small helpers', () => {
  it('names crops, with a fallback for unknown ones', () => {
    expect(cropNameFromSlug('betel_leaf', 'bn')).toBe('পান পাতা');
    expect(cropNameFromSlug('dragon_fruit', 'en')).toBe('dragon fruit');
  });

  it('formats a day in both languages', () => {
    expect(shortDay('2026-11-28', 'en')).toBe('28 Nov');
    expect(shortDay('2026-11-28', 'bn')).toBe('২৮ নভেম্বর');
    expect(shortDay('nonsense', 'en')).toBe('');
  });

  it('falls back to the other language for a broadcast', () => {
    expect(broadcastMessage({ messageBn: '', messageEn: 'Rain soon' }, 'bn')).toBe('Rain soon');
    expect(broadcastMessage({ messageBn: 'বৃষ্টি', messageEn: 'Rain' }, 'bn')).toBe('বৃষ্টি');
  });
});

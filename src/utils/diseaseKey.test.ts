import { describe, expect, it } from 'vitest';
import { CROP_KNOWLEDGE } from '../data/diseaseKb';
import { diseaseKeyFor, diseaseLabelForKey } from './diseaseKey';

describe('diseaseKeyFor', () => {
  it('matches an English name case-insensitively', () => {
    expect(diseaseKeyFor({ crop: 'Paddy', text: '**Diagnosis:** this looks like RICE BLAST on the leaves.' })).toBe(
      'paddy:rice-blast',
    );
  });

  it('matches a Bangla name', () => {
    expect(diseaseKeyFor({ crop: 'Paddy', text: 'আপনার ধানে ধানের ব্লাস্ট হয়েছে।' })).toBe('paddy:rice-blast');
  });

  it('accepts the crop in Bangla', () => {
    expect(diseaseKeyFor({ crop: 'ধান', text: 'Sheath blight is likely.' })).toBe('paddy:sheath-blight');
  });

  it('uses the crop to pick between crops sharing a disease name', () => {
    expect(diseaseKeyFor({ crop: 'Potato', text: 'Late blight' })).toBe('potato:late-blight');
    expect(diseaseKeyFor({ crop: 'tomato', text: 'Late blight' })).toBe('tomato:late-blight');
  });

  it('searches all crops when the crop is unknown or auto, and does not guess on shared names', () => {
    expect(diseaseKeyFor({ crop: 'auto', text: 'This is Rice blast.' })).toBe('paddy:rice-blast');
    expect(diseaseKeyFor({ crop: null, text: 'Red rot found' })).toBe('sugarcane:red-rot');
    expect(diseaseKeyFor({ crop: '', text: 'Late blight' })).toBeNull();
    expect(diseaseKeyFor({ crop: 'Dragonfruit', text: 'Blister blight' })).toBe('tea:blister-blight');
  });

  it('falls back to other crops when the given crop has no match', () => {
    expect(diseaseKeyFor({ crop: 'Tomato', text: 'Rice blast' })).toBe('paddy:rice-blast');
  });

  it('prefers the disease that appears earliest when two are named', () => {
    const text = 'Likely Brown spot, though Rice blast is the look-alike.';
    expect(diseaseKeyFor({ crop: 'Paddy', text })).toBe('paddy:brown-spot');
    expect(diseaseKeyFor({ crop: 'Paddy', text: 'Rice blast, not Brown spot.' })).toBe('paddy:rice-blast');
  });

  it('prefers the longer name over one contained in it', () => {
    expect(diseaseKeyFor({ crop: 'Mustard', text: 'White rust on leaves' })).toBe('mustard:white-rust');
    expect(diseaseKeyFor({ crop: 'Mustard', text: 'সাদা রাস্ট' })).toBe('mustard:white-rust');
  });

  it('does not match inside other words', () => {
    expect(diseaseKeyFor({ crop: 'Wheat', text: 'The soil is rusty and crusty' })).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(diseaseKeyFor({ crop: 'Paddy', text: 'The plant looks healthy.' })).toBeNull();
    expect(diseaseKeyFor({ text: '' })).toBeNull();
  });
});

describe('every knowledge-base disease', () => {
  const all = Object.entries(CROP_KNOWLEDGE).flatMap(([crop, k]) => k.diseases.map((d) => ({ crop, d })));

  it('produces a unique key of at most 80 chars that round-trips to its label', () => {
    const keys = new Set<string>();
    for (const { crop, d } of all) {
      const key = diseaseKeyFor({ crop, text: `Diagnosis: ${d.disease}.` });
      expect(key, `${crop} / ${d.disease}`).not.toBeNull();
      expect(key!.length).toBeLessThanOrEqual(80);
      expect(key).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
      expect(diseaseLabelForKey(key!, 'en')).toBe(d.disease);
      expect(diseaseLabelForKey(key!, 'bn')).toBe(d.diseaseBn);
      keys.add(key!);
    }
    expect(keys.size).toBe(all.length);
  });

  it('is found by its Bangla name too, within its own crop', () => {
    for (const { crop, d } of all) {
      const key = diseaseKeyFor({ crop, text: `রোগ: ${d.diseaseBn}` });
      expect(diseaseLabelForKey(key!, 'bn'), `${crop} / ${d.diseaseBn}`).toBe(d.diseaseBn);
    }
  });

  it('returns null for unknown keys', () => {
    expect(diseaseLabelForKey('paddy:nothing', 'en')).toBeNull();
  });
});

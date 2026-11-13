import { describe, expect, it } from 'vitest';
import {
  filterByProvider,
  matchScheme,
  matchSchemes,
  normalizeCrop,
  normalizeDistrict,
  resolveEligibilityTags,
  sanitizeEligibilityTags,
  type EligibilityTags,
} from './schemeMatch';

interface S {
  id: string;
  eligibilityTags?: EligibilityTags;
}

const s = (id: string, eligibilityTags?: EligibilityTags): S => ({ id, eligibilityTags });
const ids = (list: { scheme: S }[]) => list.map((m) => m.scheme.id);

describe('normalize', () => {
  it('lowercases, trims and joins words', () => {
    expect(normalizeDistrict('  Cox’s Bazar ')).toBe('coxsbazar');
    expect(normalizeCrop(' PADDY ')).toBe('paddy');
  });
  it('maps old district spellings to the new ones', () => {
    expect(normalizeDistrict('Bogra')).toBe('bogura');
    expect(normalizeDistrict('Barisal')).toBe('barishal');
    expect(normalizeDistrict('Chittagong')).toBe('chattogram');
    expect(normalizeDistrict('Comilla')).toBe('cumilla');
    expect(normalizeDistrict('Jessore')).toBe('jashore');
  });
  it('maps other crop names to the app crop ids', () => {
    expect(normalizeCrop('Rice')).toBe('paddy');
    expect(normalizeCrop('Chilli')).toBe('chili');
    expect(normalizeCrop('eggplant')).toBe('brinjal');
  });
  it('returns an empty key for missing or non-string values', () => {
    expect(normalizeCrop(null)).toBe('');
    expect(normalizeDistrict(undefined)).toBe('');
    expect(normalizeDistrict(42)).toBe('');
  });
});

describe('matchScheme', () => {
  it('treats an untagged scheme as open to all', () => {
    const m = matchScheme(s('a'), undefined, { crop: 'paddy', district: 'Dhaka' });
    expect(m?.level).toBe('general');
    expect(m?.reasons).toEqual(['open-to-all']);
  });

  it("treats lists with 'all' or nothing in them as no limit", () => {
    expect(matchScheme(s('a'), { crops: ['all'], districts: [] }, {})?.level).toBe('general');
    expect(matchScheme(s('a'), { crops: ['ALL', 'paddy'] }, { crop: 'jute' })?.level).toBe('general');
  });

  it('treats a provider tag alone as no limit', () => {
    expect(matchScheme(s('a'), { provider: 'ngo' }, {})?.level).toBe('general');
  });

  it('matches the crop strongly, ignoring case and other names', () => {
    const m = matchScheme(s('a'), { crops: ['Paddy'] }, { crop: 'RICE' });
    expect(m?.level).toBe('strong');
    expect(m?.reasons).toEqual(['crop']);
  });

  it('rules out a farmer who grows another crop', () => {
    expect(matchScheme(s('a'), { crops: ['paddy'] }, { crop: 'potato' })).toBeNull();
  });

  it('marks a crop limit as possible when the crop is not known', () => {
    for (const crop of [undefined, null, '', '   ']) {
      const m = matchScheme(s('a'), { crops: ['paddy'] }, { crop });
      expect(m?.level).toBe('possible');
      expect(m?.reasons).toEqual(['crop-unknown']);
    }
  });

  it('matches districts across old and new spellings', () => {
    expect(matchScheme(s('a'), { districts: ['bogra'] }, { district: 'Bogura' })?.reasons).toEqual(['district']);
    expect(matchScheme(s('a'), { districts: ['Chattogram'] }, { district: 'chittagong' })?.level).toBe('strong');
  });

  it('rules out a farmer in another district', () => {
    expect(matchScheme(s('a'), { districts: ['rajshahi'] }, { district: 'Sylhet' })).toBeNull();
  });

  it('marks a district limit as possible when the district is not known', () => {
    expect(matchScheme(s('a'), { districts: ['rajshahi'] }, {})?.reasons).toEqual(['district-unknown']);
  });

  it('lists fitting reasons before unknown ones and stays possible', () => {
    const m = matchScheme(s('a'), { crops: ['paddy'], districts: ['dhaka'] }, { crop: 'paddy' });
    expect(m?.level).toBe('possible');
    expect(m?.reasons).toEqual(['crop', 'district-unknown']);
  });

  it('is strong when every limit fits', () => {
    const m = matchScheme(s('a'), { crops: ['paddy'], districts: ['dhaka'] }, { crop: 'paddy', district: 'Dhaka' });
    expect(m?.level).toBe('strong');
    expect(m?.reasons).toEqual(['crop', 'district']);
  });

  it('is ruled out when any one limit fails', () => {
    expect(matchScheme(s('a'), { crops: ['paddy'], districts: ['dhaka'] }, { crop: 'paddy', district: 'Khulna' })).toBeNull();
  });

  describe('land limits', () => {
    const small: EligibilityTags = { maxLandDecimals: 100 };
    const big: EligibilityTags = { minLandDecimals: 50 };
    const band: EligibilityTags = { minLandDecimals: 50, maxLandDecimals: 100 };

    it('accepts land on the limit itself', () => {
      expect(matchScheme(s('a'), small, { landDecimals: 100 })?.reasons).toEqual(['land']);
      expect(matchScheme(s('a'), big, { landDecimals: 50 })?.reasons).toEqual(['land']);
      expect(matchScheme(s('a'), band, { landDecimals: 75 })?.level).toBe('strong');
    });
    it('accepts zero land under a maximum', () => {
      expect(matchScheme(s('a'), small, { landDecimals: 0 })?.level).toBe('strong');
    });
    it('rules out land outside the limits', () => {
      expect(matchScheme(s('a'), small, { landDecimals: 101 })).toBeNull();
      expect(matchScheme(s('a'), big, { landDecimals: 49 })).toBeNull();
      expect(matchScheme(s('a'), band, { landDecimals: 120 })).toBeNull();
    });
    it('is possible when the land size is unknown or not a real number', () => {
      for (const landDecimals of [undefined, null, NaN, -5, Infinity]) {
        expect(matchScheme(s('a'), small, { landDecimals })?.reasons).toEqual(['land-unknown']);
      }
    });
    it('ignores broken land limits', () => {
      expect(matchScheme(s('a'), { maxLandDecimals: NaN, minLandDecimals: -1 }, { landDecimals: 10 })?.level).toBe('general');
    });
  });

  describe('tenure', () => {
    it('matches owners to an owner-only scheme', () => {
      expect(matchScheme(s('a'), { tenure: ['owner'] }, { tenure: 'owner' })?.reasons).toEqual(['tenure']);
    });
    it('rules out tenants from an owner-only scheme', () => {
      expect(matchScheme(s('a'), { tenure: ['owner'] }, { tenure: 'tenant' })).toBeNull();
    });
    it('is possible when tenure is unknown', () => {
      expect(matchScheme(s('a'), { tenure: ['owner'] }, {})?.reasons).toEqual(['tenure-unknown']);
    });
    it('does not limit anyone when both are allowed', () => {
      expect(matchScheme(s('a'), { tenure: ['owner', 'tenant'] }, {})?.level).toBe('general');
    });
  });

  it('returns the tags it used', () => {
    const tags: EligibilityTags = { crops: ['paddy'], provider: 'government' };
    expect(matchScheme(s('a'), tags, { crop: 'paddy' })?.tags).toBe(tags);
  });
});

describe('matchSchemes', () => {
  const schemes: S[] = [
    s('open-1'),
    s('paddy-only', { crops: ['paddy'] }),
    s('potato-only', { crops: ['potato'] }),
    s('open-2', { crops: ['all'] }),
    s('rajshahi-only', { districts: ['rajshahi'] }),
    s('paddy-dhaka', { crops: ['paddy'], districts: ['dhaka'] }),
  ];

  it('drops schemes that rule the farmer out and sorts strong, possible, general', () => {
    const out = matchSchemes(schemes, { crop: 'paddy' });
    expect(ids(out)).toEqual(['paddy-only', 'rajshahi-only', 'paddy-dhaka', 'open-1', 'open-2']);
    expect(out.map((m) => m.level)).toEqual(['strong', 'possible', 'possible', 'general', 'general']);
  });

  it('keeps the given order within a level', () => {
    const many = Array.from({ length: 30 }, (_, i) => s(`g${i}`));
    expect(ids(matchSchemes(many, {}))).toEqual(many.map((x) => x.id));
  });

  it('with no farmer facts, keeps every scheme and ranks limited ones as possible', () => {
    const out = matchSchemes(schemes, {});
    expect(out).toHaveLength(schemes.length);
    expect(out.filter((m) => m.level === 'general').map((m) => m.scheme.id)).toEqual(['open-1', 'open-2']);
    expect(out.some((m) => m.level === 'strong')).toBe(false);
  });

  it('uses a custom tag reader', () => {
    const plain = [{ id: 'x' }, { id: 'y' }];
    const tags: Record<string, EligibilityTags> = { x: { districts: ['khulna'] } };
    expect(matchSchemes(plain, { district: 'Dhaka' }, (p) => tags[p.id]).map((m) => m.scheme.id)).toEqual(['y']);
  });

  it('returns an empty list for no schemes', () => {
    expect(matchSchemes([], { crop: 'paddy' })).toEqual([]);
  });
});

describe('sanitizeEligibilityTags', () => {
  it('keeps well-formed fields', () => {
    expect(
      sanitizeEligibilityTags({
        crops: ['paddy'],
        districts: ['Dhaka'],
        maxLandDecimals: 100,
        minLandDecimals: 0,
        tenure: ['owner'],
        provider: 'ngo',
      }),
    ).toEqual({ crops: ['paddy'], districts: ['Dhaka'], maxLandDecimals: 100, minLandDecimals: 0, tenure: ['owner'], provider: 'ngo' });
  });

  it('drops malformed fields', () => {
    expect(
      sanitizeEligibilityTags({
        crops: 'paddy',
        districts: [1, '', 'Dhaka'],
        maxLandDecimals: '100',
        tenure: ['landlord'],
        provider: 'bank',
      }),
    ).toEqual({ districts: ['Dhaka'] });
  });

  it('returns undefined for nothing usable', () => {
    for (const raw of [undefined, null, 'x', 5, [], {}, { provider: 'bank' }]) {
      expect(sanitizeEligibilityTags(raw)).toBeUndefined();
    }
  });
});

describe('resolveEligibilityTags', () => {
  const seed: Record<string, EligibilityTags> = {
    'gov-paddy-procurement': { crops: ['paddy'], provider: 'government' },
    'krishi-call-centre': { provider: 'government' },
  };

  it("uses the scheme's own tags first", () => {
    expect(resolveEligibilityTags({ id: 'gov-paddy-procurement', eligibilityTags: { provider: 'ngo' } }, seed)).toEqual({ provider: 'ngo' });
  });

  it('falls back to the seed tags by id, ignoring case', () => {
    expect(resolveEligibilityTags({ id: 'GOV-Paddy-Procurement ' }, seed)).toEqual(seed['gov-paddy-procurement']);
  });

  it('falls back to the seed tags when own tags are malformed', () => {
    expect(resolveEligibilityTags({ id: 'krishi-call-centre', eligibilityTags: { provider: 'x' } }, seed)).toEqual({ provider: 'government' });
  });

  it('prefers the seed tags over older crop lists', () => {
    expect(resolveEligibilityTags({ id: 'krishi-call-centre', crops: ['paddy'] }, seed)).toEqual({ provider: 'government' });
  });

  it('uses older crops and districts lists for unknown records', () => {
    expect(resolveEligibilityTags({ id: 'other', crops: ['tomato'], districts: ['dhaka'] }, seed)).toEqual({
      crops: ['tomato'],
      districts: ['dhaka'],
    });
  });

  it("ignores older lists that say 'all'", () => {
    expect(resolveEligibilityTags({ id: 'other', crops: ['all'], districts: ['all'] }, seed)).toEqual({});
  });

  it('gives no tags to an AI-written record with no lists', () => {
    expect(resolveEligibilityTags({ id: 'some-new-scheme' }, seed)).toEqual({});
    expect(resolveEligibilityTags({}, seed)).toEqual({});
    expect(resolveEligibilityTags({ id: 'x' })).toEqual({});
  });
});

describe('filterByProvider', () => {
  const items = [s('g', { provider: 'government' }), s('n', { provider: 'ngo' }), s('u')];
  const get = (x: S) => x.eligibilityTags;

  it('keeps everything for all', () => {
    expect(filterByProvider(items, 'all', get).map((x) => x.id)).toEqual(['g', 'n', 'u']);
  });
  it('keeps only the chosen provider and leaves untagged items out', () => {
    expect(filterByProvider(items, 'government', get).map((x) => x.id)).toEqual(['g']);
    expect(filterByProvider(items, 'ngo', get).map((x) => x.id)).toEqual(['n']);
    expect(filterByProvider(items, 'private', get)).toEqual([]);
  });
});

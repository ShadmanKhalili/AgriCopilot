import { describe, expect, it } from 'vitest';
import { buildLocationContext, describePlace, seasonForDate } from './farmerContext';

// Noon in Bangladesh on the given day.
const dhaka = (isoDay: string) => new Date(`${isoDay}T06:00:00Z`);

describe('seasonForDate', () => {
  it('names the season on each side of every boundary', () => {
    expect(seasonForDate(dhaka('2026-03-15')).key).toBe('rabi');
    expect(seasonForDate(dhaka('2026-03-16')).key).toBe('kharif1');
    expect(seasonForDate(dhaka('2026-07-15')).key).toBe('kharif1');
    expect(seasonForDate(dhaka('2026-07-16')).key).toBe('kharif2');
    expect(seasonForDate(dhaka('2026-10-15')).key).toBe('kharif2');
    expect(seasonForDate(dhaka('2026-10-16')).key).toBe('rabi');
  });

  it('keeps Rabi across the new year', () => {
    expect(seasonForDate(dhaka('2026-12-31')).key).toBe('rabi');
    expect(seasonForDate(dhaka('2027-01-01')).key).toBe('rabi');
  });

  it('uses the date in Bangladesh, not the date in UTC', () => {
    // 20:00 UTC on 15 March is already 02:00 on 16 March in Dhaka.
    expect(seasonForDate(new Date('2026-03-15T20:00:00Z')).key).toBe('kharif1');
  });
});

describe('describePlace', () => {
  it('finds the district and its mapped risks', () => {
    const satkhira = describePlace({ latitude: 22.7185, longitude: 89.0705 });
    expect(satkhira?.district).toBe('Satkhira');
    expect(satkhira?.risks[0]).toBe('salinity');
  });

  it('returns null with no position or one outside Bangladesh', () => {
    expect(describePlace(null)).toBeNull();
    expect(describePlace({ latitude: 51.5, longitude: -0.12 })).toBeNull();
    expect(describePlace({ latitude: NaN, longitude: 90 })).toBeNull();
  });
});

describe('buildLocationContext', () => {
  it('names the district, its risks and the season', () => {
    const text = buildLocationContext({ latitude: 22.7185, longitude: 89.0705 }, { date: dhaka('2026-11-11') });
    expect(text).toContain('Satkhira district, Bangladesh');
    expect(text).toContain('salinity');
    expect(text).toContain('Rabi');
  });

  it('says the area is unknown rather than guessing one', () => {
    const text = buildLocationContext(null, { date: dhaka('2026-08-01') });
    expect(text).toContain('exact area not known');
    expect(text).not.toContain('district,');
    expect(text).toContain('Kharif-2');
  });

  it('can leave the season out', () => {
    const text = buildLocationContext(null, { includeSeason: false });
    expect(text).not.toContain('Cropping season');
  });
});

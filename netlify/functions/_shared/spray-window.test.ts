import { describe, expect, it } from 'vitest';
import { isDaylightSprayHour, isSafeSprayWindowHour, localHourOf } from './spray-window';

const calm = { temp: 26, windSpeed: 5, rainChance: 0 };

describe('localHourOf', () => {
  it('reads a zone-less local time as written', () => {
    expect(localHourOf('2026-11-12T00:00')).toBe(0);
    expect(localHourOf('2026-11-12T14:00')).toBe(14);
  });
  it('converts a UTC time to Dhaka (UTC+6)', () => {
    expect(localHourOf('2026-11-12T18:00:00Z')).toBe(0);
    expect(localHourOf('2026-11-12T00:30:00Z')).toBe(6);
    expect(localHourOf(new Date('2026-11-12T12:00:00Z'))).toBe(18);
  });
  it('returns null for nonsense', () => {
    expect(localHourOf('not a time')).toBeNull();
    expect(localHourOf(undefined)).toBeNull();
  });
});

describe('isDaylightSprayHour', () => {
  it('allows 6 to 18 and nothing else', () => {
    expect([0, 1, 2, 5].some((h) => isDaylightSprayHour(h))).toBe(false);
    expect([6, 7, 12, 17, 18].every((h) => isDaylightSprayHour(h))).toBe(true);
    expect([19, 20, 23].some((h) => isDaylightSprayHour(h))).toBe(false);
    expect(isDaylightSprayHour(null)).toBe(false);
  });
});

describe('isSafeSprayWindowHour', () => {
  it('is safe in calm daytime weather', () => {
    expect(isSafeSprayWindowHour({ ...calm, time: '2026-11-12T09:00' })).toBe(true);
  });
  it('is never safe at night, even when calm (12 AM to 2 AM)', () => {
    for (const hh of ['00', '01', '02', '03', '05', '19', '22']) {
      expect(isSafeSprayWindowHour({ ...calm, time: `2026-11-12T${hh}:00` })).toBe(false);
    }
  });
  it('treats the Google UTC timestamps as Dhaka time', () => {
    expect(isSafeSprayWindowHour({ ...calm, time: '2026-11-12T18:00:00Z' })).toBe(false); // 00:00 Dhaka
    expect(isSafeSprayWindowHour({ ...calm, time: '2026-11-12T04:00:00Z' })).toBe(true); // 10:00 Dhaka
  });
  it('respects the feed day/night flag', () => {
    expect(isSafeSprayWindowHour({ ...calm, time: '2026-11-12T09:00', isDaytime: false })).toBe(false);
    expect(isSafeSprayWindowHour({ ...calm, time: '2026-11-12T09:00', isDaytime: true })).toBe(true);
  });
  it('still follows the shared spray rule, and missing readings are not safe', () => {
    expect(isSafeSprayWindowHour({ ...calm, windSpeed: 15, time: '2026-11-12T09:00' })).toBe(false);
    expect(isSafeSprayWindowHour({ ...calm, rainChance: 25, time: '2026-11-12T09:00' })).toBe(false);
    expect(isSafeSprayWindowHour({ temp: 26, windSpeed: undefined, rainChance: 0, time: '2026-11-12T09:00' })).toBe(false);
    expect(isSafeSprayWindowHour({ temp: 26, windSpeed: 5, rainChance: null, time: '2026-11-12T09:00' })).toBe(false);
  });
});

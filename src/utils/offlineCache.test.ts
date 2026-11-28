import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedWeather, saveCachedWeather } from './offlineCache';

describe('getCachedWeather', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when offline and nothing is saved for the place (no made-up forecast)', () => {
    expect(getCachedWeather('23.81_90.41', 'weathernext3', true)).toBeNull();
    expect(getCachedWeather('21.45_91.97', 'weathernext3', true)).toBeNull();
  });

  it('returns the real saved entry for the same place, and nothing for another place', () => {
    saveCachedWeather('23.81_90.41', { temp: 30 }, 'weathernext3');
    expect(getCachedWeather('23.81_90.41', 'weathernext3', true)?.data).toEqual({ temp: 30 });
    expect(getCachedWeather('21.45_91.97', 'weathernext3', true)).toBeNull();
  });
});

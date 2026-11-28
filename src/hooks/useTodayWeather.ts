import { useCallback, useEffect, useState } from 'react';
import { fetchWithTimeout, readJsonWithTimeout } from '../utils/fetchWithTimeout';
import { todayWeatherFromFeed, type TodayWeather } from '../utils/todaySignals';

interface Coordinates {
  latitude: number;
  longitude: number;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; weather: TodayWeather; fetchedAt: number }
  | { status: 'error' };

// One reading per area is reused for a while, so going back to Home does not
// fetch the weather again.
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; weather: TodayWeather }>();

const keyFor = (c: Coordinates): string => `${c.latitude.toFixed(2)}_${c.longitude.toFixed(2)}`;

const inFlight = new Map<string, Promise<{ at: number; weather: TodayWeather }>>();

/** Fetch today's reading for a place and remember it. Calls for the same place at the same time share one request. */
const loadReading = (
  location: Coordinates,
  key: string,
  options: { timeoutMs: number; retries: number }
): Promise<{ at: number; weather: TodayWeather }> => {
  const running = inFlight.get(key);
  if (running) return running;
  const started = (async () => {
    const response = await fetchWithTimeout(
      `/api/weathernext-3?latitude=${location.latitude}&longitude=${location.longitude}&timezone=auto`,
      options
    );
    if (!response.ok) throw new Error(`weather status ${response.status}`);
    const weather = todayWeatherFromFeed(await readJsonWithTimeout<any>(response, options.timeoutMs));
    if (!weather) throw new Error('weather feed had no current reading');
    const reading = { at: Date.now(), weather };
    cache.set(key, reading);
    return reading;
  })().finally(() => {
    if (inFlight.get(key) === started) inFlight.delete(key);
  });
  inFlight.set(key, started);
  return started;
};

/** How long the assistant waits for a reading that Home has not fetched yet. */
const ASK_READING_TIMEOUT_MS = 3500;

/**
 * Today's reading for a question to the assistant: the one Home shows (same
 * cache and same feed), fetched once when there is none yet. Null when there is
 * no place or no reading in time; the question is then asked without one.
 */
export async function getTodayReading(
  location: Coordinates | null | undefined
): Promise<{ readingAt: string; weather: TodayWeather } | null> {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const key = keyFor(location);
  try {
    const hit = cache.get(key);
    const reading = hit && Date.now() - hit.at < CACHE_MS ? hit : await loadReading(location, key, { timeoutMs: ASK_READING_TIMEOUT_MS, retries: 0 });
    return { readingAt: new Date(reading.at).toISOString(), weather: reading.weather };
  } catch (error) {
    console.warn('No weather reading for the assistant:', error);
    return null;
  }
}

/** Today's weather numbers for the Home screen's signals. */
export function useTodayWeather(location: Coordinates | null) {
  const key = location ? keyFor(location) : null;
  const [state, setState] = useState<State>(() => {
    const hit = key ? cache.get(key) : undefined;
    return hit && Date.now() - hit.at < CACHE_MS ? { status: 'ready', weather: hit.weather, fetchedAt: hit.at } : { status: 'idle' };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!location || !key) {
      setState({ status: 'idle' });
      return;
    }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setState({ status: 'ready', weather: hit.weather, fetchedAt: hit.at });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const { at: fetchedAt, weather } = await loadReading(location, key, { timeoutMs: 10000, retries: 1 });
        if (!cancelled) setState({ status: 'ready', weather, fetchedAt });
      } catch (error) {
        console.warn('Could not load today\'s weather:', error);
        if (!cancelled) setState({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // `key` stands in for `location`: a new object with the same place must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, retry };
}

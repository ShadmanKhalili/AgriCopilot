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
  | { status: 'ready'; weather: TodayWeather }
  | { status: 'error' };

// One reading per area is reused for a while, so going back to Home does not
// fetch the weather again.
const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; weather: TodayWeather }>();

const keyFor = (c: Coordinates): string => `${c.latitude.toFixed(2)}_${c.longitude.toFixed(2)}`;

/** Today's weather numbers for the Home screen's signals. */
export function useTodayWeather(location: Coordinates | null) {
  const key = location ? keyFor(location) : null;
  const [state, setState] = useState<State>(() => {
    const hit = key ? cache.get(key) : undefined;
    return hit && Date.now() - hit.at < CACHE_MS ? { status: 'ready', weather: hit.weather } : { status: 'idle' };
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!location || !key) {
      setState({ status: 'idle' });
      return;
    }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      setState({ status: 'ready', weather: hit.weather });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      try {
        const response = await fetchWithTimeout(
          `/api/weathernext-3?latitude=${location.latitude}&longitude=${location.longitude}&timezone=auto`,
          { timeoutMs: 10000, retries: 1 }
        );
        if (!response.ok) throw new Error(`weather status ${response.status}`);
        const weather = todayWeatherFromFeed(await readJsonWithTimeout<any>(response, 10000));
        if (!weather) throw new Error('weather feed had no current reading');
        cache.set(key, { at: Date.now(), weather });
        if (!cancelled) setState({ status: 'ready', weather });
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

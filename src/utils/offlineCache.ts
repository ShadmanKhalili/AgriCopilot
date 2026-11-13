/**
 * Offline Cache & Resilience Engine for Rural Agriculture
 * Specially optimized for low-connectivity coastal and rural zones of Cox's Bazar
 * (Chakaria, Ramu, Teknaf, Ukhia, Cox's Bazar Sadar, Maheshkhali, Pekua, Kutubdia).
 */

const WEATHER_CACHE_PREFIX = 'agri_cached_weather_';
const MARKET_CACHE_PREFIX = 'agri_cached_market_';
const GLOBAL_SYNC_KEY = 'agri_last_sync_timestamp';

// Weather changes rapidly (e.g., fast storm fronts, showers, rapid shifts).
// Weather cache retention is strictly capped at 20 minutes to prevent stale data interference.
export const MAX_WEATHER_CACHE_AGE_MS = 1000 * 60 * 20; // 20 minutes max
// Hard ceiling for emergency-offline display: even without connectivity, cached
// weather older than this is never presented to the user (it is dropped instead).
export const MAX_EMERGENCY_WEATHER_CACHE_AGE_MS = 1000 * 60 * 60 * 6; // 6 hours max

// Mandi market wholesale prices change 1-2 times daily after morning auctions.
export const MAX_MARKET_CACHE_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours max

export const MAX_CACHE_AGE_MS = MAX_WEATHER_CACHE_AGE_MS;

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  locationKey: string;
  isFallback?: boolean;
}

/**
 * Pre-seeded emergency fallback weather data for rural Cox's Bazar
 * when both network and user cache are unavailable.
 */
export const COX_BAZAR_OFFLINE_WEATHER: Record<string, any> = {
  temp: 28,
  condition: 'Partly Cloudy',
  humidity: 78,
  windSpeed: 14,
  rainfall: 0,
  rainChance: 25,
  uvIndex: 7,
  locationName: "কক্সবাজার উপকূলীয় কৃষি অঞ্চল (Cox's Bazar Coastal Zone)",
  soilMoisture: 0.28,
  evapotranspiration: 4.2,
  safeSprayingWindow: "সকাল ৬:৩০ - ৯:১৫ (বাতাস শান্ত ও পাতার আর্দ্রতা বালাইনাশক প্রয়োগের উপযুক্ত)",
  dewPoint: 22,
  fungalBlightRisk: 'Moderate',
  ensembleConfidence: 85,
  heavyRainRisk: 15,
  hourlyForecast: [
    { time: '6 AM', temp: 24, humidity: 86, rainProb: 10, wind: 8, condition: 'Sunny' },
    { time: '9 AM', temp: 27, humidity: 76, rainProb: 15, wind: 11, condition: 'Sunny' },
    { time: '12 PM', temp: 30, humidity: 68, rainProb: 20, wind: 15, condition: 'Partly Cloudy' },
    { time: '3 PM', temp: 29, humidity: 72, rainProb: 25, wind: 16, condition: 'Partly Cloudy' },
    { time: '6 PM', temp: 27, humidity: 80, rainProb: 20, wind: 12, condition: 'Partly Cloudy' },
    { time: '9 PM', temp: 25, humidity: 85, rainProb: 10, wind: 9, condition: 'Clear' }
  ]
};

export function recordGlobalSync(timestamp: number = Date.now()): void {
  try {
    localStorage.setItem(GLOBAL_SYNC_KEY, timestamp.toString());
  } catch (err) {
    console.warn('Failed to record global sync time:', err);
  }
}

/**
 * Save weather data into localStorage with timestamp, model type, and coordinates identifier
 */
export function saveCachedWeather(locationKey: string, data: any, model: string = 'weathernext3'): void {
  try {
    const now = Date.now();
    const entry: CacheEntry<any> = {
      data,
      timestamp: now,
      locationKey,
      isFallback: false
    };
    // Save scoped to exact coordinates and model (never to an unscoped key, so a
    // future model toggle can never read another engine's data)
    localStorage.setItem(`${WEATHER_CACHE_PREFIX}${model}_${locationKey}`, JSON.stringify(entry));
    recordGlobalSync(now);
  } catch (err) {
    console.warn('Failed to cache weather to localStorage:', err);
  }
}

/**
 * Retrieve cached weather data.
 * Will only return a valid cache if it is fresher than MAX_WEATHER_CACHE_AGE_MS (20 mins)
 * and strictly matches the requested coordinates.
 * Stale or mismatched caches are never returned when online to prevent overriding live changes.
 */
export function getCachedWeather(
  locationKey: string, 
  model: string = 'weathernext3', 
  isEmergencyOffline: boolean = false
): CacheEntry<any> | null {
  try {
    const scopedKey = `${WEATHER_CACHE_PREFIX}${model}_${locationKey}`;
    const raw = localStorage.getItem(scopedKey);
    
    if (raw) {
      const parsed: CacheEntry<any> = JSON.parse(raw);
      const age = Date.now() - parsed.timestamp;
      
      // If within 20 minutes freshness window, it is considered safe
      if (age < MAX_WEATHER_CACHE_AGE_MS) {
        return {
          ...parsed,
          isFallback: false
        };
      }
      
      // If older than 20 minutes:
      // When online, do NOT return stale cache so live data isn't interfered with.
      // Only when confirmed offline, return it marked explicitly as fallback —
      // and only within a bounded window so multi-day-old data is never shown.
      if (isEmergencyOffline && age < MAX_EMERGENCY_WEATHER_CACHE_AGE_MS) {
        return {
          ...parsed,
          isFallback: true
        };
      }
      return null;
    }
  } catch (err) {
    console.warn('Failed to read cached weather:', err);
  }

  // Emergency offline fallback ONLY when user has no connection and no local cache exists
  if (isEmergencyOffline) {
    return {
      data: COX_BAZAR_OFFLINE_WEATHER,
      timestamp: Date.now() - (1000 * 60 * 35),
      locationKey: 'cox_bazar_default',
      isFallback: true
    };
  }

  return null;
}

/**
 * Wipe all cached weather data from localStorage
 */
export function clearWeatherCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(WEATHER_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Failed to clear weather cache:', err);
  }
}

/**
 * Save market insights to localStorage
 */
export function saveCachedMarket(cropKey: string, locationKey: string, data: any): void {
  try {
    const now = Date.now();
    const storageKey = `${MARKET_CACHE_PREFIX}${cropKey.toLowerCase()}_${locationKey}`;
    const entry: CacheEntry<any> = {
      data,
      timestamp: now,
      locationKey,
      isFallback: false
    };
    localStorage.setItem(storageKey, JSON.stringify(entry));
    localStorage.setItem(`${MARKET_CACHE_PREFIX}${cropKey.toLowerCase()}_latest`, JSON.stringify(entry));
    recordGlobalSync(now);
  } catch (err) {
    console.warn('Failed to cache market insights:', err);
  }
}

/**
 * Retrieve cached market insights.
 *
 * Returns ONLY genuinely cached, non-expired entries (or null). Synthetic
 * offline baselines are intentionally NOT returned here — use
 * `getMarketOfflineFallback()` so callers can tell "real cached data" apart
 * from "no data available".
 */
export function getCachedMarket(cropKey: string, locationKey: string): CacheEntry<any> | null {
  const normCrop = cropKey.toLowerCase();
  try {
    const exactKey = `${MARKET_CACHE_PREFIX}${normCrop}_${locationKey}`;
    const exact = localStorage.getItem(exactKey);
    if (exact) {
      const parsed: CacheEntry<any> = JSON.parse(exact);
      if (Date.now() - parsed.timestamp < MAX_MARKET_CACHE_AGE_MS) {
        return parsed;
      }
    }

    const latest = localStorage.getItem(`${MARKET_CACHE_PREFIX}${normCrop}_latest`);
    if (latest) {
      const parsed: CacheEntry<any> = JSON.parse(latest);
      if (Date.now() - parsed.timestamp < MAX_MARKET_CACHE_AGE_MS) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read cached market insights:', err);
  }

  return null;
}

/**
 * User-friendly relative time formatter in Bengali and English
 */
export function formatCacheAge(timestamp: number, lang: 'bn' | 'en'): string {
  const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / (1000 * 60)));
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (diffMinutes < 60) {
    return lang === 'bn' 
      ? `${toBengaliDigits(diffMinutes)} মিনিট আগের ক্যাশ (${timeStr})` 
      : `Cached ${diffMinutes}m ago (${timeStr})`;
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return lang === 'bn' 
      ? `${toBengaliDigits(diffHours)} ঘণ্টা আগের ক্যাশ (${timeStr})` 
      : `Cached ${diffHours}h ago (${timeStr})`;
  }
  
  const diffDays = Math.floor(diffHours / 24);
  return lang === 'bn' 
    ? `${toBengaliDigits(diffDays)} দিন আগের ক্যাশ` 
    : `Cached ${diffDays}d ago`;
}

function toBengaliDigits(num: number): string {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().split('').map(d => bnDigits[parseInt(d, 10)] ?? d).join('');
}

/**
 * Returns the most recent synchronization timestamp from localStorage
 */
export function getLastSyncTimestamp(): number | null {
  try {
    const saved = localStorage.getItem(GLOBAL_SYNC_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    // Inspect weather or market cache timestamps
    let maxTs = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(WEATHER_CACHE_PREFIX) || key.startsWith(MARKET_CACHE_PREFIX))) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item && item.timestamp && item.timestamp > maxTs) {
            maxTs = item.timestamp;
          }
        } catch (_) {}
      }
    }
    return maxTs > 0 ? maxTs : null;
  } catch (err) {
    console.warn('Failed to get last sync timestamp:', err);
    return null;
  }
}

export interface CacheSummary {
  lastSyncTimestamp: number | null;
  weatherEntriesCount: number;
  marketEntriesCount: number;
  totalEntries: number;
  estimatedSizeKb: number;
  isOnline: boolean;
  hasServiceWorkerCache: boolean;
}

/**
 * Inspects all local cache entries and sizes for the Data Status view
 */
export async function getCacheSummary(): Promise<CacheSummary> {
  let weatherCount = 0;
  let marketCount = 0;
  let totalBytes = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (key.startsWith(WEATHER_CACHE_PREFIX)) {
          weatherCount++;
          const val = localStorage.getItem(key) || '';
          totalBytes += (key.length + val.length) * 2;
        } else if (key.startsWith(MARKET_CACHE_PREFIX)) {
          marketCount++;
          const val = localStorage.getItem(key) || '';
          totalBytes += (key.length + val.length) * 2;
        }
      }
    }
  } catch (e) {
    console.warn('Error reading localStorage keys for cache summary:', e);
  }

  let hasSwCache = false;
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      hasSwCache = keys.some(k => k.includes('agri-') || k.includes('workbox'));
    } catch (_) {}
  }

  return {
    lastSyncTimestamp: getLastSyncTimestamp(),
    weatherEntriesCount: weatherCount,
    marketEntriesCount: marketCount,
    totalEntries: weatherCount + marketCount,
    estimatedSizeKb: Math.max(1, Math.round(totalBytes / 1024)),
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasServiceWorkerCache: hasSwCache
  };
}

/**
 * Manually flushes local caches and service worker caches, then notifies active components to re-sync
 */
export async function forceRefreshLocalCaches(): Promise<{ clearedCount: number; newSyncTimestamp: number }> {
  let clearedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(WEATHER_CACHE_PREFIX) || key.startsWith(MARKET_CACHE_PREFIX))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      clearedCount++;
    });

    // Reset or invalidate service worker caches for API routes
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheNames = await window.caches.keys();
        for (const name of cacheNames) {
          if (name.includes('weather') || name.includes('agri-')) {
            await window.caches.delete(name);
          }
        }
      } catch (cacheErr) {
        console.warn('Could not clear browser CacheStorage:', cacheErr);
      }
    }
  } catch (err) {
    console.warn('Error clearing local caches:', err);
  }

  const now = Date.now();
  recordGlobalSync(now);

  // Dispatch custom broadcast event so active views (WeatherAdvisory, MarketConnect, etc.) immediately refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('agri:force-refresh-cache', { detail: { timestamp: now } }));
  }

  return {
    clearedCount,
    newSyncTimestamp: now
  };
}

/**
 * Formats full readable date & time in Bengali and English
 */
export function formatExactSyncTime(timestamp: number | null, lang: 'bn' | 'en'): string {
  if (!timestamp) {
    return lang === 'bn' ? 'কোনো পূর্ববর্তী সিঙ্ক রেকর্ড নেই' : 'No previous sync record';
  }

  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const isPM = hours >= 12;
  const standardHours = hours % 12 || 12;

  if (lang === 'bn') {
    const period = hours < 6 ? 'রাত' : hours < 12 ? 'সকাল' : hours < 16 ? 'দুপুর' : hours < 19 ? 'বিকেল' : 'রাত';
    const day = toBengaliDigits(date.getDate());
    const monthNamesBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
    const month = monthNamesBn[date.getMonth()];
    const timeStr = `${period} ${toBengaliDigits(standardHours)}:${toBengaliDigits(parseInt(minutes, 10))}`;
    return `${day} ${month}, ${timeStr}`;
  }

  const period = isPM ? 'PM' : 'AM';
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${monthNamesEn[date.getMonth()]}, ${standardHours}:${minutes} ${period}`;
}


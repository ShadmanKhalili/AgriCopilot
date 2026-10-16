/**
 * farmMemory.ts — "Farm Memory" context builder for the Live Video Copilot.
 *
 * Silently assembles a compact ground-truth block (today's weather + the
 * farmer's saved profile & recent history) that gets appended to the Live API
 * system instruction at session start. This lets the copilot answer questions
 * like "can I spray today?" with real numbers, and refer back to past
 * consultations — without any new screens or buttons.
 *
 * Honesty rules:
 * - Weather numbers come only from our own /api/weathernext-3 payload
 *   (live Google Weather API or the AgroCast AI / Open-Meteo fallback), and the
 *   provider is passed through so the model can name it if asked.
 * - History comes only from the farmer's saved dossier (never invented).
 * - Failure is silent: if anything fails, the session proceeds without memory.
 */

import { fetchFarmerProfile, fetchFarmerTimeline } from './farmerProfiler';
import { Language } from './translations';

export interface FarmMemoryOptions {
  userId?: string | null;
  locationContext: string;
  globalLocation?: { latitude: number; longitude: number } | null;
  lang: Language;
}

const WEATHER_MEMO_TTL_MS = 10 * 60 * 1000; // reuse a weather block for 10 min
const TOTAL_TIMEOUT_MS = 3500; // never block session start longer than this

let weatherMemo: { key: string; at: number; block: string | null } | null = null;

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** WMO weather code -> plain English condition (the model speaks Bangla itself). */
function conditionFromCode(code: number): string {
  if (code >= 1 && code <= 3) return 'partly cloudy';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snowy';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'clear / sunny';
}

function truncate(text: string, max: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function daysAgo(dateStr?: string): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 86400000));
}

/**
 * Fetch today's weather summary block from our weather endpoint.
 * Uses a short-lived in-memory memo so multiple sessions in a row stay cheap.
 */
async function fetchWeatherBlock(
  lat: number,
  lon: number
): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (weatherMemo && weatherMemo.key === key && Date.now() - weatherMemo.at < WEATHER_MEMO_TTL_MS) {
    return weatherMemo.block;
  }

  let block: string | null = null;
  try {
    const gMapKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(
      `/api/weathernext-3?latitude=${lat}&longitude=${lon}&timezone=auto`,
      {
        signal: controller.signal,
        headers: gMapKey ? { 'x-google-maps-key': gMapKey } : undefined,
      }
    );
    clearTimeout(timer);
    if (res.ok) {
      const d: any = await res.json();
      const cur = d.current || {};
      const daily = d.daily || {};
      const agro = d.agro_metrics || {};
      const hourly = d.hourly || {};

      // Current hour index inside the hourly timeline
      let idx = 0;
      if (Array.isArray(hourly.time) && cur.time) {
        const found = hourly.time.findIndex((t: string) => t >= cur.time);
        if (found >= 0) idx = found;
      }
      const slice12 = (arr: any): number[] =>
        Array.isArray(arr) ? arr.slice(idx, idx + 12).filter((n: any) => typeof n === 'number') : [];
      const maxOf = (arr: number[]) => (arr.length ? Math.max(...arr) : null);
      const maxRain12 = maxOf(slice12(hourly.precipitation_probability));
      const maxWind12 = maxOf(slice12(hourly.wind_speed_10m));

      const alerts = Array.isArray(d.alerts)
        ? d.alerts
            .slice(0, 2)
            .map((a: any) => `${a?.severity ? `[${a.severity}] ` : ''}${a?.event || a?.headline || ''}`.trim())
            .filter(Boolean)
        : [];

      const provider =
        (typeof d.provider === 'string' && d.provider) ||
        (typeof d.model === 'string' && d.model) ||
        'unknown source';

      const lines = [
        `- Right now: ${cur.temperature_2m ?? '?'}°C, humidity ${cur.relative_humidity_2m ?? '?'}%, wind ${cur.wind_speed_10m ?? '?'} km/h, precipitation ${cur.precipitation ?? 0} mm, condition: ${conditionFromCode(cur.weather_code || 0)}`,
        `- Rain probability — whole day's maximum: ${daily.precipitation_probability_max?.[0] ?? '?'}%; from now through the next 12 hours (max): ${maxRain12 ?? '?'}%; max UV today: ${daily.uv_index_max?.[0] ?? '?'}`,
        `- Wind — maximum expected in the next 12 hours: ${maxWind12 ?? '?'} km/h`,
        `- Safe spraying window: ${agro.safe_spraying_window || 'not available'}`,
        alerts.length > 0
          ? `- Active weather alerts: ${alerts.join(' | ')}`
          : `- No active severe weather alerts right now`,
        `- Data provider (mention ONLY if the farmer directly asks): ${provider}`,
      ];
      block = lines.join('\n');
    }
  } catch (err) {
    // Silent — Farm Memory is best-effort only.
    console.warn('[FarmMemory] weather block unavailable:', err);
  }

  weatherMemo = { key, at: Date.now(), block };
  return block;
}

/**
 * Fetch the farmer's saved profile + recent non-demo timeline events.
 */
async function fetchFarmerBlock(userId: string): Promise<string | null> {
  try {
    const [profRes, tlRes] = await Promise.allSettled([
      fetchFarmerProfile(userId),
      fetchFarmerTimeline(userId),
    ]);
    const profile = profRes.status === 'fulfilled' ? profRes.value : null;
    const timeline = tlRes.status === 'fulfilled' ? tlRes.value || [] : [];

    const lines: string[] = [];

    if (profile) {
      const crops = (profile.cropsGrown && profile.cropsGrown.length > 0)
        ? profile.cropsGrown
        : (profile.primaryCrop ? [profile.primaryCrop] : []);
      if (crops.length > 0) lines.push(`- Crops grown (saved profile): ${crops.join(', ')}`);
      if (profile.totalLandDecimals) lines.push(`- Land: about ${profile.totalLandDecimals} decimals`);
      const place = [profile.locationUpazila, profile.locationDistrict].filter(Boolean).join(', ');
      if (place) lines.push(`- Farm location: ${place}`);
      if (profile.soilType) lines.push(`- Soil type: ${profile.soilType}`);
      if (profile.irrigationType) lines.push(`- Irrigation: ${profile.irrigationType}`);
      const lastAge = daysAgo(profile.lastInteractionDate);
      if (profile.lastInteractionSummary) {
        lines.push(
          `- Last recorded interaction${lastAge !== null ? ` (${lastAge} day(s) ago)` : ''}: ${truncate(profile.lastInteractionSummary, 180)}`
        );
      }
    }

    const recent = timeline
      .filter((e) => !e.isDemoOrGuest)
      .slice(0, 3)
      .map((e) => {
        const age = daysAgo(e.createdAt);
        const ageStr = age === null ? '' : (age === 0 ? 'today' : `${age} day(s) ago`);
        return `- ${ageStr ? `(${ageStr}) ` : ''}[${e.eventType}] ${truncate(e.title, 90)}: ${truncate(e.summary, 170)}`;
      });

    if (recent.length > 0) {
      lines.push(`- Recent history (newest first):`);
      lines.push(...recent.map((l) => `  ${l}`));
    }

    return lines.length > 0 ? lines.join('\n') : null;
  } catch (err) {
    console.warn('[FarmMemory] farmer block unavailable:', err);
    return null;
  }
}

/**
 * Build the full "FARM MEMORY & LIVE GROUND TRUTH" block for the Live API
 * system instruction. Returns '' when nothing could be gathered.
 */
export async function buildFarmMemoryContext(opts: FarmMemoryOptions): Promise<string> {
  const weatherPromise = opts.globalLocation
    ? fetchWeatherBlock(opts.globalLocation.latitude, opts.globalLocation.longitude)
    : Promise.resolve(null);
  const farmerPromise = opts.userId
    ? fetchFarmerBlock(opts.userId)
    : Promise.resolve(null);

  let weather: string | null = null;
  let farmer: string | null = null;

  try {
    const timeout = new Promise<[null, null]>((resolve) =>
      setTimeout(() => resolve([null, null]), TOTAL_TIMEOUT_MS)
    );
    const [w, f] = await Promise.race([
      Promise.all([weatherPromise.catch(() => null), farmerPromise.catch(() => null)]),
      timeout,
    ]);
    weather = w;
    farmer = f;
  } catch {
    // proceed with whatever we have (nothing)
  }

  if (!weather && !farmer) return '';

  let dateLine = '';
  try {
    dateLine = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());
  } catch {
    dateLine = new Date().toISOString();
  }

  const sections: string[] = [
    'FARM MEMORY & LIVE GROUND TRUTH (silent context — never read this out as a list, never announce that you "have a file"; simply know it and speak like an advisor who remembers):',
    `- Date & time (Asia/Dhaka): ${dateLine}`,
    `- Location context: ${opts.locationContext || 'Bangladesh'}`,
  ];

  if (weather) {
    sections.push('TODAY\'S WEATHER (from the app\'s live weather feed):');
    sections.push(weather);
  }
  if (farmer) {
    sections.push('FARMER\'S SAVED PROFILE & RECENT HISTORY:');
    sections.push(farmer);
  }

  sections.push(
    [
      'HOW TO USE THIS MEMORY (critical):',
      '1. If the farmer asks about spraying, irrigation or "what should I do today", ground your answer in the weather numbers above (mention rain probability, wind or the safe spraying window when relevant).',
      '2. If the farmer refers to earlier problems or "last time", use the saved history above naturally (e.g., "প্রায় ৪ দিন আগে..."), without reciting it as a list.',
      '3. Saved data may be in Bangla or English — translate mentally; keep answering in natural spoken Bangla as usual.',
      '4. If a value is missing or looks stale, do NOT invent numbers — ask normally or give general guidance.',
      '5. Never mention this memory block itself; if the farmer asks where weather information comes from, answer with the provider named above, otherwise do not bring it up.',
    ].join('\n')
  );

  return sections.join('\n');
}

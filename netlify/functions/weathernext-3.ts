import { Handler } from '@netlify/functions';
import axios from 'axios';
import { checkIpRateLimit, extractClientIpFromHeaders, weatherCallsPerIpPerMinute } from './_shared/ip-limit.ts';
import { farmActionsFromFeed, isSafeSprayHour } from './_shared/farm-actions.ts';
import { OPEN_METEO_DAILY_PARAM, dateKeyInZone, mergeDailyForecast } from './_shared/daily-merge.ts';

/**
 * AgroCast AI / Google Weather API agro-forecast endpoint (Netlify function).
 *
 * NOTE: This is the Netlify parity port of `handleWeatherNext3` in server.ts.
 * It serves /api/weathernext-3 and /api/weather-next (see netlify.toml redirects).
 *
 * PATHWAY 1: Live Google Maps Platform Weather API (weather.googleapis.com) -
 *            activated when a Google Maps key is available (client header
 *            a server env secret).
 * PATHWAY 2: Automatic high-resolution Open-Meteo agro-meteorological ensemble
 *            fallback when no key is configured or the live lookup fails.
 *
 * Keep both implementations in sync when changing the forecast math.
 */

type WeatherAlertItem = {
  id: string;
  event: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  headline: string;
  description: string;
  effective: string;
  expires: string;
  agroImpact: string;
  kind?: 'heavy_rain' | 'storm' | 'blight' | 'heat' | 'wind' | 'official';
  facts?: { rainChance?: number; humidity?: number; dewPointDepression?: number; heatIndex?: number; wind?: number; gust?: number };
  dataSource?: { name: string; authorityUri: string };
};

const PAID_WEATHER_CACHE_MS = 10 * 60 * 1000;
const PAID_WEATHER_CACHE_MAX = 500;
const paidWeatherCache = new Map<string, { at: number; body: string }>();

const weatherResponse = (body: string) => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    // Browsers and proxies must not keep a forecast; only this function's short cache does.
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  },
  body
});

/**
 * Open-Meteo's 7-day daily block, used to complete the Google-derived `daily`.
 * Never throws and never waits long: null on any failure or after 4 seconds.
 */
const fetchOpenMeteoDaily = async (lat: number, lon: number, timezone: string): Promise<any | null> => {
  try {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lon,
        daily: OPEN_METEO_DAILY_PARAM,
        timezone,
        forecast_days: 7
      },
      timeout: 4000
    });
    return res.data?.daily ?? null;
  } catch (err: any) {
    console.warn('[AgroCast AI][netlify] Open-Meteo daily completion failed, serving Google-only daily:', err?.message);
    return null;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const qs = event.queryStringParameters || {};
    const latitude = qs.latitude;
    const longitude = qs.longitude;
    const timezone = qs.timezone || 'auto';
    const forecast_days = qs.forecast_days || '7';

    if (!latitude || !longitude) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Latitude and longitude are required' }) };
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid latitude or longitude' }) };
    }

    // Resolve Google API key. Server-side secrets only: a caller must not be able
    // to choose the key this function spends.
    const googleKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY;

    const gridLat = Math.round(lat / 0.05) * 0.05;
    const gridLon = Math.round(lon / 0.05) * 0.05;

    // Each live lookup makes 3 paid Google calls, and this endpoint is open to
    // signed-out visitors. Nearby requests share an answer for a few minutes,
    // and one address cannot loop past the limit.
    const cacheKey = `${gridLat.toFixed(2)}_${gridLon.toFixed(2)}_${timezone}_${forecast_days}`;
    const cached = paidWeatherCache.get(cacheKey);
    if (cached && Date.now() - cached.at < PAID_WEATHER_CACHE_MS) {
      return weatherResponse(cached.body);
    }
    if (googleKey) {
      const limit = checkIpRateLimit(
        extractClientIpFromHeaders(event.headers as Record<string, string | undefined>),
        weatherCallsPerIpPerMinute(),
        'weather'
      );
      if (!limit.allowed) {
        return {
          statusCode: 429,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Too many weather requests. Please wait a minute.', retryAfterSeconds: limit.retryAfterSeconds })
        };
      }
    }

    let googleWeatherSucceeded = false;
    let weatherPayload: any = null;

    // =========================================================================
    // PATHWAY 1: Live Google Maps Platform Weather API (Google Weather API)
    // =========================================================================
    if (googleKey) {
      try {
        console.log(`[AgroCast AI][netlify] Initiating live Google Maps Weather API request for (${lat.toFixed(4)}, ${lon.toFixed(4)})`);

        const gmpHeaders = {
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio'
        };

        // Start the Open-Meteo 7-day request now so it runs while Google answers.
        // It never rejects (null on failure), so it cannot break this lookup.
        const openMeteoDailyPromise = fetchOpenMeteoDaily(lat, lon, timezone);

        // Fetch Current Conditions, Hourly Forecast (48h), and Public Alerts concurrently
        const [currentRes, hourlyRes, alertsRes] = await Promise.all([
          axios.get('https://weather.googleapis.com/v1/currentConditions:lookup', {
            params: {
              key: googleKey,
              'location.latitude': lat,
              'location.longitude': lon
            },
            headers: gmpHeaders,
            timeout: 7000
          }),
          axios.get('https://weather.googleapis.com/v1/forecast/hours:lookup', {
            params: {
              key: googleKey,
              'location.latitude': lat,
              'location.longitude': lon,
              hours: 48
            },
            headers: gmpHeaders,
            timeout: 8000
          }),
          axios.get('https://weather.googleapis.com/v1/publicAlerts:lookup', {
            params: {
              key: googleKey,
              'location.latitude': lat,
              'location.longitude': lon
            },
            headers: gmpHeaders,
            timeout: 5000
          }).catch(() => {
            // Gracefully handle 404 (no alerts or region not supported) without aborting
            return { data: { weatherAlerts: [] } };
          })
        ]);

        const currentCond = currentRes.data;
        const forecastHours = hourlyRes.data?.forecastHours || [];
        const publicAlertsData = alertsRes.data?.weatherAlerts || [];

        if (currentCond && forecastHours.length > 0) {
          console.log(`[AgroCast AI][netlify] Live Google Weather API lookup successful! ${forecastHours.length} hours received.`);

          const currentTemp = currentCond.temperature?.degrees ?? 28;
          const currentHumidity = currentCond.relativeHumidity ?? 60;
          const currentDewPoint = currentCond.dewPoint?.degrees ?? (currentTemp - ((100 - currentHumidity) / 5));
          const currentWind = currentCond.wind?.speed?.value ?? 6;
          const currentWindGust = currentCond.wind?.gust?.value ?? (currentWind * 1.4);
          const current100mWind = parseFloat((currentWind * 1.38).toFixed(1));
          const currentConditionText = currentCond.weatherCondition?.description?.text || currentCond.weatherCondition?.type || 'Partly Cloudy';
          const currentDNI = currentCond.isDaytime ? Math.max(0, Math.round((100 - (currentCond.cloudCover || 20)) * 7.5)) : 0;
          const currentShortwave = Math.round(currentDNI * 0.85);

          // Dew Point Depression (Plant Pathology & Fungal Spore Germination Metric)
          const dewPointDepression = Math.max(0, currentTemp - currentDewPoint);
          let fungalBlightRisk: 'low' | 'moderate' | 'high' = 'low';
          if (currentHumidity > 82 && dewPointDepression < 2.5) {
            fungalBlightRisk = 'high';
          } else if (currentHumidity > 72 && dewPointDepression < 4.0) {
            fungalBlightRisk = 'moderate';
          }

          // Map hourly series
          const hourlyTimes: string[] = [];
          const hourlyTemps: number[] = [];
          const hourlyHumidities: number[] = [];
          const hourlyDewPoints: number[] = [];
          const hourlyRainProbs: number[] = [];
          const hourlyRainQpfs: number[] = [];
          const hourlyWinds10m: number[] = [];
          const hourlyWinds100m: number[] = [];
          const hourlyWeatherCodes: number[] = [];
          const hourlyConditions: string[] = [];
          const hourlyDNIs: number[] = [];
          const hourlySpread: Array<{
            time: string;
            displayTime: string;
            temp: number;
            p10: number;
            p50: number;
            p90: number;
            rainProb: number;
            rainQpf: number;
            windSpeed: number;
            wind100m: number;
            condition: string;
            isSafeSpray: boolean;
          }> = [];

          let totalExpectedRain = 0;
          let maxRainProb = 0;

          for (let i = 0; i < forecastHours.length; i++) {
            const item = forecastHours[i];
            const intervalTime = item.interval?.startTime || new Date(Date.now() + i * 3600000).toISOString();
            const hTemp = item.temperature?.degrees ?? currentTemp;
            const hHumidity = item.relativeHumidity ?? currentHumidity;
            const hDewPoint = item.dewPoint?.degrees ?? (hTemp - ((100 - hHumidity) / 5));
            const hRainProb = item.precipitation?.probability?.percent ?? 0;
            const hRainQpf = item.precipitation?.qpf?.quantity ?? 0;
            const hWind = item.wind?.speed?.value ?? currentWind;
            const hWind100 = parseFloat((hWind * 1.38).toFixed(1));
            const hCond = item.weatherCondition?.description?.text || item.weatherCondition?.type || 'Clear';
            const hCloud = item.cloudCover ?? 20;
            const hDNI = item.isDaytime ? Math.max(0, Math.round((100 - hCloud) * 7.5)) : 0;

            hourlyTimes.push(intervalTime);
            hourlyTemps.push(hTemp);
            hourlyHumidities.push(hHumidity);
            hourlyDewPoints.push(hDewPoint);
            hourlyRainProbs.push(hRainProb);
            hourlyRainQpfs.push(hRainQpf);
            hourlyWinds10m.push(hWind);
            hourlyWinds100m.push(hWind100);
            hourlyConditions.push(hCond);
            hourlyDNIs.push(hDNI);

            totalExpectedRain += hRainQpf;
            if (hRainProb > maxRainProb) maxRainProb = hRainProb;

            // Derive weather code
            let wCode = 0;
            const condLower = hCond.toLowerCase();
            if (condLower.includes('thunder') || condLower.includes('storm')) wCode = 95;
            else if (condLower.includes('heavy rain') || condLower.includes('downpour')) wCode = 65;
            else if (condLower.includes('rain') || condLower.includes('shower')) wCode = 61;
            else if (condLower.includes('fog')) wCode = 45;
            else if (condLower.includes('cloud') || condLower.includes('overcast')) wCode = 3;
            hourlyWeatherCodes.push(wCode);

            // Probabilistic risk envelope calculation for this hour (P10, P50, P90)
            const p10 = Math.max(0, parseFloat((hRainQpf * 0.55).toFixed(2)));
            const p50 = parseFloat(hRainQpf.toFixed(2));
            const p90 = parseFloat((hRainQpf * 1.5 + (hRainProb > 40 ? 1.5 : 0.1)).toFixed(2));

            // Same rule as the spray advice (shared engine), so the window can never contradict it.
            const isSafe = isSafeSprayHour({ temp: hTemp, windSpeed: hWind, rainChance: hRainProb });


            const displayDate = new Date(intervalTime);
            // Google Weather API returns UTC (Z) timestamps — label them in Bangladesh time
            const displayTime = displayDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });

            hourlySpread.push({
              time: intervalTime,
              displayTime,
              temp: hTemp,
              p10,
              p50,
              p90,
              rainProb: hRainProb,
              rainQpf: hRainQpf,
              windSpeed: hWind,
              wind100m: hWind100,
              condition: hCond,
              isSafeSpray: isSafe
            });
          }

          // Daily summary per local calendar day, built only from values Google
          // returned, under the same field names as Open-Meteo's `daily`. The
          // hourly lookup covers 48 h, so this is the rest of today plus about
          // one full day; a later day is listed only when the forecast covers
          // at least 20 of its hours.
          const dayFormatter = (() => {
            const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
            try {
              return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: timezone && timezone !== 'auto' ? String(timezone) : 'Asia/Dhaka' });
            } catch {
              return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: 'Asia/Dhaka' });
            }
          })();
          const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
          type DayBucket = { hours: number; temps: number[]; probs: number[]; qpf: number[]; winds: number[]; uvs: number[] };
          const dayBuckets = new Map<string, DayBucket>();
          const bucketFor = (key: string): DayBucket => {
            let b = dayBuckets.get(key);
            if (!b) {
              b = { hours: 0, temps: [], probs: [], qpf: [], winds: [], uvs: [] };
              dayBuckets.set(key, b);
            }
            return b;
          };
          const todayKey = dayFormatter.format(new Date(currentCond.currentTime || Date.now()));
          const todayBucket = bucketFor(todayKey);
          if (isNum(currentCond.temperature?.degrees)) todayBucket.temps.push(currentCond.temperature.degrees);
          if (isNum(currentCond.precipitation?.probability?.percent)) todayBucket.probs.push(currentCond.precipitation.probability.percent);
          if (isNum(currentCond.wind?.speed?.value)) todayBucket.winds.push(currentCond.wind.speed.value);
          if (isNum(currentCond.uvIndex)) todayBucket.uvs.push(currentCond.uvIndex);
          for (const item of forecastHours) {
            const start = item?.interval?.startTime;
            if (!start) continue;
            const key = dayFormatter.format(new Date(start));
            if (key < todayKey) continue;
            const b = bucketFor(key);
            b.hours++;
            if (isNum(item.temperature?.degrees)) b.temps.push(item.temperature.degrees);
            if (isNum(item.precipitation?.probability?.percent)) b.probs.push(item.precipitation.probability.percent);
            if (isNum(item.precipitation?.qpf?.quantity)) b.qpf.push(item.precipitation.qpf.quantity);
            if (isNum(item.wind?.speed?.value)) b.winds.push(item.wind.speed.value);
            if (isNum(item.uvIndex)) b.uvs.push(item.uvIndex);
          }
          const dayKeys = [...dayBuckets.keys()]
            .filter((k) => k === todayKey || (dayBuckets.get(k)?.hours ?? 0) >= 20)
            .sort();
          const maxOrNull = (xs: number[]) => (xs.length > 0 ? Math.max(...xs) : null);
          const minOrNull = (xs: number[]) => (xs.length > 0 ? Math.min(...xs) : null);
          const dayField = (pick: (b: DayBucket) => number | null) => dayKeys.map((k) => pick(dayBuckets.get(k)!));
          const googleDaily = {
            time: dayKeys,
            temperature_2m_max: dayField((b) => maxOrNull(b.temps)),
            temperature_2m_min: dayField((b) => minOrNull(b.temps)),
            precipitation_sum: dayField((b) => (b.qpf.length > 0 ? parseFloat(b.qpf.reduce((s, v) => s + v, 0).toFixed(1)) : null)),
            precipitation_probability_max: dayField((b) => maxOrNull(b.probs)),
            wind_speed_10m_max: dayField((b) => maxOrNull(b.winds)),
            uv_index_max: dayField((b) => maxOrNull(b.uvs))
          };

          const totalP10 = Math.max(0, parseFloat((totalExpectedRain * 0.6).toFixed(1)));
          const totalP50 = parseFloat(totalExpectedRain.toFixed(1));
          const totalP90 = parseFloat((totalExpectedRain * 1.45 + (maxRainProb > 40 ? 2.5 : 0.4)).toFixed(1));

          // Certified 48-Hour Safe Spraying Window
          let safeSprayingWindow = "No safe window in next 24 hours";
          let safeWindowDetailed: { start: string; end: string; avgWind: number; avgTemp: number; rainRisk: number } | null = null;

          for (let i = 0; i < Math.min(46, hourlySpread.length - 2); i++) {
            if (hourlySpread[i].isSafeSpray && hourlySpread[i + 1]?.isSafeSpray && hourlySpread[i + 2]?.isSafeSpray) {
              const sDate = new Date(hourlySpread[i].time);
              const eDate = new Date(hourlySpread[i + 2].time);
              const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });
              const dhakaDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
              const dayLabel = dhakaDay(sDate) === dhakaDay(new Date())
                ? "Today"
                : (dhakaDay(new Date(Date.now() + 86400000)) === dhakaDay(sDate)
                  ? "Tomorrow"
                  : sDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' }));
              safeSprayingWindow = `${dayLabel}, ${formatTime(sDate)} - ${formatTime(eDate)}`;
              safeWindowDetailed = {
                start: hourlySpread[i].time,
                end: hourlySpread[i + 2].time,
                avgWind: Math.round(((hourlySpread[i].windSpeed + hourlySpread[i + 1].windSpeed + hourlySpread[i + 2].windSpeed) / 3) * 10) / 10,
                avgTemp: Math.round(((hourlySpread[i].temp + hourlySpread[i + 1].temp + hourlySpread[i + 2].temp) / 3) * 10) / 10,
                rainRisk: Math.max(hourlySpread[i].rainProb, hourlySpread[i + 1].rainProb, hourlySpread[i + 2].rainProb)
              };
              break;
            }
          }

          // Real-Time Meteorological & Agro Alerts
          const alerts: WeatherAlertItem[] = [];

          // 1. Ingest official Google Public Alerts
          if (Array.isArray(publicAlertsData) && publicAlertsData.length > 0) {
            for (const pAlert of publicAlertsData) {
              alerts.push({
                id: pAlert.alertId || `gmp-${Date.now()}`,
                event: pAlert.eventType || pAlert.alertTitle || "Severe Weather Alert",
                kind: 'official',
                severity: (pAlert.severity?.toLowerCase() as any) || "severe",
                headline: pAlert.alertTitle || "Official Meteorological Alert",
                description: pAlert.instruction || pAlert.safetyRecommendations || "Follow official meteorological precautions.",
                effective: pAlert.startTime || new Date().toISOString(),
                expires: pAlert.expirationTime || new Date(Date.now() + 86400000).toISOString(),
                agroImpact: "Suspend field spraying, clear farm drainage, and protect standing crops against adverse weather.",
                dataSource: pAlert.dataSource ? {
                  name: pAlert.dataSource.name || "National Meteorological Agency",
                  authorityUri: pAlert.dataSource.authorityUri || "https://weather.googleapis.com"
                } : {
                  name: "Google Maps Platform Weather Alerts",
                  authorityUri: "https://developers.google.com/maps/documentation/weather"
                }
              });
            }
          }

          // 2. Synthesize precision Agro-Climatic Alerts from real-time Google conditions
          if (currentHumidity > 82 && dewPointDepression < 2.5) {
            alerts.push({
              id: `blight-risk-${gridLat}-${gridLon}`,
              event: "Fungal Blight Critical Risk (Late Blight / Rice Blast)",
              severity: "moderate",
              kind: 'blight',
              facts: { humidity: Math.round(Number(currentHumidity)), dewPointDepression: Number(Number(dewPointDepression).toFixed(1)) },
              headline: "Fungal disease risk is high",
              description: `Humidity is ${Math.round(Number(currentHumidity))}% and the air is very damp, so fungal diseases like blight can spread fast.`,
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 86400000).toISOString(),
              agroImpact: "Check potato and boro rice seedbeds today. Spray a fungicide before the disease shows.",
              dataSource: {
                name: "Google Maps Weather API & Agronomic Pathology Engine",
                authorityUri: "https://developers.google.com/maps/documentation/weather"
              }
            });
          }

          if (currentCond.heatIndex?.degrees && currentCond.heatIndex.degrees >= 38) {
            alerts.push({
              id: `heat-stress-${gridLat}-${gridLon}`,
              event: "Severe Agricultural Heat Stress Warning",
              severity: "severe",
              kind: 'heat',
              facts: { heatIndex: Number(currentCond.heatIndex.degrees.toFixed(1)) },
              headline: `Very hot: feels like ${currentCond.heatIndex.degrees.toFixed(1)}°C`,
              description: "Strong heat dries the soil fast and can hurt flowering crops and farm animals.",
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 43200000).toISOString(),
              agroImpact: "Keep 5-7 cm of water in paddy fields. Do not spray in the midday heat. Give animals shade and water.",
              dataSource: {
                name: "Google Maps Weather API Telemetry",
                authorityUri: "https://developers.google.com/maps/documentation/weather"
              }
            });
          }

          if (currentWind >= 22 || currentWindGust >= 30) {
            alerts.push({
              id: `spray-drift-${gridLat}-${gridLon}`,
              event: "High Canopy Wind Spray Drift Hazard",
              severity: "moderate",
              kind: 'wind',
              facts: { wind: Math.round(currentWind), gust: Math.round(currentWindGust) },
              headline: `Strong wind: ${Math.round(currentWind)} km/h, gusts up to ${Math.round(currentWindGust)} km/h`,
              description: "The wind is too strong for spraying. The spray will blow away.",
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 28800000).toISOString(),
              agroImpact: "Do not spray pesticide or fertilizer now. Wait for calmer wind.",
              dataSource: {
                name: "Google Maps Weather API Telemetry",
                authorityUri: "https://developers.google.com/maps/documentation/weather"
              }
            });
          }

          if (maxRainProb >= 65 || totalP90 >= 20) {
            alerts.push({
              id: `cloudburst-risk-${gridLat}-${gridLon}`,
              event: "Thunderstorm & Cloudburst Heavy Rain Advisory",
              severity: "severe",
              kind: 'storm',
              facts: { rainChance: maxRainProb },
              headline: `Heavy rain and storm likely: ${maxRainProb}% chance of rain`,
              description: "Heavy rain and strong storms are likely in the next 2 days.",
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 86400000).toISOString(),
              agroImpact: "Clear the drains in your fields. Keep harvested crops under cover. Do not put fertilizer before the rain.",
              dataSource: {
                name: "Google Maps Weather API Forecast Analytics",
                authorityUri: "https://developers.google.com/maps/documentation/weather"
              }
            });
          }

          // Complete `daily` to 7 days with Open-Meteo for the dates Google does not cover
          // (Google keeps its own days). Falls back to the Google-only daily on failure.
          const mergedDaily = mergeDailyForecast(googleDaily, await openMeteoDailyPromise, 'google', 'open-meteo');

          weatherPayload = {
            model: "Google Weather API",
            provider: "Google Maps Platform",
            version: "1.0-live-gmp",
            source: "google_weather_api",
            daily_sources: mergedDaily.sources,
            resolution: "0.05° (~5 km spatial grid)",
            grid_coordinates: { latitude: gridLat, longitude: gridLon },
            data_sources: {
              forecast: "Google Maps Platform Weather API (weather.googleapis.com)",
              note: "Agro-meteorological metrics (dew point, blight risk, spray windows, spread envelopes) are computed server-side from the live Google Weather API response."
            },
            alerts: alerts,
            ensemble: {
              estimate_basis: "Heuristic spread envelope derived from hourly Google Weather API forecast data",
              precipitation_spread_mm: {
                p10: totalP10,
                median: totalP50,
                p90: totalP90
              },
              heavy_rain_risk_prob: Math.min(100, Math.round(maxRainProb * 0.45))
            },
            agro_metrics: {
              boundary_layer_wind_100m_kmh: current100mWind,
              surface_wind_10m_kmh: currentWind,
              wind_gust_kmh: currentWindGust,
              wind_shear_ratio: parseFloat((current100mWind / Math.max(1, currentWind)).toFixed(2)),
              direct_normal_irradiance_wm2: currentDNI,
              shortwave_radiation_wm2: currentShortwave,
              dew_point_celsius: parseFloat(currentDewPoint.toFixed(1)),
              dew_point_depression_celsius: parseFloat(dewPointDepression.toFixed(1)),
              fungal_blight_risk: fungalBlightRisk,
              heat_index_celsius: currentCond.heatIndex?.degrees,
              air_pressure_hpa: currentCond.airPressure?.meanSeaLevelMillibars,
              safe_spraying_window: safeSprayingWindow,
              safe_spraying_window_detail: safeWindowDetailed
            },
            current: {
              time: currentCond.currentTime || new Date().toISOString(),
              temperature_2m: currentTemp,
              relative_humidity_2m: currentHumidity,
              dew_point_2m: currentDewPoint,
              wind_speed_10m: currentWind,
              wind_speed_100m: current100mWind,
              direct_normal_irradiance: currentDNI,
              surface_pressure: currentCond.airPressure?.meanSeaLevelMillibars,
              precipitation: currentCond.precipitation?.qpf?.quantity || 0,
              precipitation_probability: currentCond.precipitation?.probability?.percent || 0,
              uv_index: currentCond.uvIndex || 3,
              condition: currentConditionText,
              icon_base_uri: currentCond.weatherCondition?.iconBaseUri,
              is_daytime: currentCond.isDaytime
            },
            hourly: {
              time: hourlyTimes,
              temperature_2m: hourlyTemps,
              relative_humidity_2m: hourlyHumidities,
              dew_point_2m: hourlyDewPoints,
              precipitation_probability: hourlyRainProbs,
              precipitation: hourlyRainQpfs,
              wind_speed_10m: hourlyWinds10m,
              wind_speed_100m: hourlyWinds100m,
              weather_code: hourlyWeatherCodes,
              conditions: hourlyConditions,
              direct_normal_irradiance: hourlyDNIs
            },
            hourly_spread: hourlySpread,
            daily: mergedDaily.daily,
            dataSource: {
              name: "Google Maps Platform Weather API",
              authorityUri: "https://developers.google.com/maps/documentation/weather"
            },
            agentAttribution: "Google Maps"
          };

          googleWeatherSucceeded = true;
        }
      } catch (gmpErr: any) {
        console.warn("[AgroCast AI][netlify] Google Maps Weather API lookup failed, gracefully engaging automatic ensemble fallback:", gmpErr.response?.data || gmpErr.message);
      }
    }

    // =========================================================================
    // PATHWAY 2: Automatic High-Resolution Agro Ensemble Fallback
    // =========================================================================
    if (!googleWeatherSucceeded) {
      console.log(`[AgroCast AI][netlify] Synthesizing high-resolution agro-meteorological ensemble fallback (Open-Meteo) for (${lat.toFixed(4)}, ${lon.toFixed(4)})`);

      const url = `https://api.open-meteo.com/v1/forecast`;
      const response = await axios.get(url, {
        params: {
          latitude: lat,
          longitude: lon,
          current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure',
          hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_speed_100m,wind_direction_10m,shortwave_radiation,direct_normal_irradiance,soil_moisture_0_to_7cm',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,et0_fao_evapotranspiration',
          timezone: timezone,
          forecast_days: parseInt(forecast_days) || 7
        },
        timeout: 12000
      });

      const raw = response.data;
      const hourly = raw.hourly || {};
      const current = raw.current || {};
      const daily = raw.daily || {};

      let currentIndex = 0;
      if (hourly.time && current.time) {
        const idx = hourly.time.findIndex((t: string) => t >= current.time);
        if (idx !== -1) currentIndex = idx;
      }

      const currentTemp = current.temperature_2m ?? (hourly.temperature_2m ? hourly.temperature_2m[currentIndex] : 26);
      const currentHumidity = current.relative_humidity_2m ?? (hourly.relative_humidity_2m ? hourly.relative_humidity_2m[currentIndex] : 65);
      const currentDewPoint = hourly.dew_point_2m ? hourly.dew_point_2m[currentIndex] : (currentTemp - ((100 - currentHumidity) / 5));
      const current10mWind = current.wind_speed_10m ?? (hourly.wind_speed_10m ? hourly.wind_speed_10m[currentIndex] : 8);
      const current100mWind = hourly.wind_speed_100m ? hourly.wind_speed_100m[currentIndex] : (current10mWind * 1.35);
      const currentDNI = hourly.direct_normal_irradiance ? hourly.direct_normal_irradiance[currentIndex] : 0;
      const currentShortwave = hourly.shortwave_radiation ? hourly.shortwave_radiation[currentIndex] : 0;
      const currentSoilMoisture = hourly.soil_moisture_0_to_7cm ? hourly.soil_moisture_0_to_7cm[currentIndex] : undefined;

      const dewPointDepression = Math.max(0, currentTemp - currentDewPoint);
      let fungalBlightRisk: 'low' | 'moderate' | 'high' = 'low';
      if (currentHumidity > 82 && dewPointDepression < 2.5) {
        fungalBlightRisk = 'high';
      } else if (currentHumidity > 72 && dewPointDepression < 4.0) {
        fungalBlightRisk = 'moderate';
      }

      const rainProbMax = daily.precipitation_probability_max?.[0] ?? 10;
      const expectedRainSum = daily.precipitation_sum?.[0] ?? 0;

      const rainP10 = Math.max(0, parseFloat((expectedRainSum * 0.6).toFixed(1)));
      const rainP90 = parseFloat((expectedRainSum * 1.45 + (rainProbMax > 40 ? 1.8 : 0.2)).toFixed(1));

      // Build hourly spread for charting
      const hourlySpread: Array<{
        time: string;
        displayTime: string;
        temp: number;
        p10: number;
        p50: number;
        p90: number;
        rainProb: number;
        rainQpf: number;
        windSpeed: number;
        wind100m: number;
        condition: string;
        isSafeSpray: boolean;
      }> = [];

      if (hourly.time) {
        const maxH = Math.min(currentIndex + 48, hourly.time.length);
        for (let i = currentIndex; i < maxH; i++) {
          const hTime = hourly.time[i];
          const hTemp = hourly.temperature_2m?.[i] ?? currentTemp;
          const hProb = hourly.precipitation_probability?.[i] ?? 0;
          const hPrecip = hourly.precipitation?.[i] ?? 0;
          const hWind = hourly.wind_speed_10m?.[i] ?? current10mWind;
          const hWind100 = hourly.wind_speed_100m?.[i] ?? (hWind * 1.35);
          const isSafe = isSafeSprayHour({ temp: hTemp, windSpeed: hWind, rainChance: hProb });
          const d = new Date(hTime);

          hourlySpread.push({
            time: hTime,
            displayTime: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            temp: hTemp,
            p10: Math.max(0, parseFloat((hPrecip * 0.55).toFixed(2))),
            p50: parseFloat(hPrecip.toFixed(2)),
            p90: parseFloat((hPrecip * 1.5 + (hProb > 40 ? 1.5 : 0.1)).toFixed(2)),
            rainProb: hProb,
            rainQpf: hPrecip,
            windSpeed: hWind,
            wind100m: hWind100,
            condition: hProb > 50 ? 'Rainy' : 'Clear',
            isSafeSpray: isSafe
          });
        }
      }

      let safeSprayingWindow = "No safe window in next 24 hours";
      let safeWindowDetailed: { start: string; end: string; avgWind: number; avgTemp: number; rainRisk: number } | null = null;

      if (hourly.time && hourly.precipitation_probability && hourly.wind_speed_10m && hourly.temperature_2m) {
        const times = hourly.time;
        const rainProbs = hourly.precipitation_probability;
        const winds10m = hourly.wind_speed_10m;
        const winds100m = hourly.wind_speed_100m || winds10m;
        const temps = hourly.temperature_2m;

        for (let i = currentIndex; i < Math.min(currentIndex + 48, times.length - 2); i++) {
          let isSafe = true;
          let sumWind = 0;
          let sumTemp = 0;
          let maxRainProbLocal = 0;

          for (let j = 0; j < 3; j++) {
            const idx = i + j;
            const rProb = rainProbs[idx] ?? 0;
            const w10 = winds10m[idx] ?? 0;
            const tVal = temps[idx] ?? 25;

            sumWind += w10;
            sumTemp += tVal;
            if (rProb > maxRainProbLocal) maxRainProbLocal = rProb;

            if (!isSafeSprayHour({ temp: tVal, windSpeed: w10, rainChance: rProb })) {
              isSafe = false;
              break;
            }
          }

          if (isSafe) {
            const startDate = new Date(times[i]);
            const endDate = new Date(times[i + 2]);
            const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            // Compare calendar dates in the request's timezone (Asia/Dhaka for 'auto'),
            // not the server's own day of the month. Open-Meteo times are local to that zone.
            const startKey = String(times[i]).slice(0, 10);
            const todayKey = dateKeyInZone(new Date(), timezone);
            const dayLabel = startKey === todayKey
              ? "Today"
              : (startKey === dateKeyInZone(new Date(Date.now() + 86400000), timezone)
                ? "Tomorrow"
                : new Date(`${startKey}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }));
            safeSprayingWindow = `${dayLabel}, ${formatTime(startDate)} - ${formatTime(endDate)}`;
            safeWindowDetailed = {
              start: times[i],
              end: times[i + 2],
              avgWind: Math.round((sumWind / 3) * 10) / 10,
              avgTemp: Math.round((sumTemp / 3) * 10) / 10,
              rainRisk: maxRainProbLocal
            };
            break;
          }
        }
      }

      // Synthetic Agro Alerts for Ensemble
      const ensembleAlerts: WeatherAlertItem[] = [];

      if (fungalBlightRisk === 'high') {
        ensembleAlerts.push({
          id: `blight-${gridLat}-${gridLon}`,
          event: "Fungal Blight Incubation Risk (Late Blight / Rice Blast)",
          severity: "moderate",
          kind: 'blight',
          facts: { humidity: Math.round(Number(currentHumidity)), dewPointDepression: Number(Number(dewPointDepression).toFixed(1)) },
          headline: "Fungal disease risk is high",
          description: `Humidity is ${Math.round(Number(currentHumidity))}% and the air is very damp, so fungal diseases like blight can spread fast.`,
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 86400000).toISOString(),
          agroImpact: "Check potato and boro rice seedbeds today. Spray a fungicide before the disease shows.",
          dataSource: {
            name: "Agro-Meteorological Pathology Model",
            authorityUri: "https://open-meteo.com"
          }
        });
      }

      if (rainProbMax >= 70 || rainP90 >= 25) {
        ensembleAlerts.push({
          id: `heavy-rain-${gridLat}-${gridLon}`,
          event: "Impending Heavy Precipitation & Waterlogging Alert",
          severity: "severe",
          kind: 'heavy_rain',
          facts: { rainChance: rainProbMax },
          headline: `Heavy rain likely: ${rainProbMax}% chance of rain`,
          description: "Heavy rain is likely. Low fields may get waterlogged.",
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 86400000).toISOString(),
          agroImpact: "Keep drains open in vegetable beds and paddy plots so water can flow out.",
          dataSource: {
            name: "High-Resolution Meteorological Ensemble",
            authorityUri: "https://open-meteo.com"
          }
        });
      }

      weatherPayload = {
        model: "AgroCast AI",
        provider: "Open-Meteo (5 km grid)",
        version: "1.0-ensemble",
        source: "ensemble_synthesis",
        daily_sources: (Array.isArray(daily.time) ? daily.time : []).map(() => "open-meteo"),
        resolution: "0.05° (~5 km spatial grid)",
        grid_coordinates: { latitude: gridLat, longitude: gridLon },
        data_sources: {
          forecast: "Open-Meteo high-resolution model data (api.open-meteo.com)",
          note: "Agro-meteorological metrics (dew point, blight risk, spray windows, spread envelopes) are computed server-side from Open-Meteo model data."
        },
        alerts: ensembleAlerts,
        ensemble: {
          estimate_basis: "Heuristic spread estimate derived from Open-Meteo daily probabilities",
          precipitation_spread_mm: { p10: rainP10, median: expectedRainSum, p90: rainP90 },
          heavy_rain_risk_prob: Math.min(100, Math.round(rainProbMax * 0.45))
        },
        agro_metrics: {
          boundary_layer_wind_100m_kmh: current100mWind,
          surface_wind_10m_kmh: current10mWind,
          wind_shear_ratio: parseFloat((current100mWind / Math.max(1, current10mWind)).toFixed(2)),
          direct_normal_irradiance_wm2: currentDNI,
          shortwave_radiation_wm2: currentShortwave,
          dew_point_celsius: parseFloat(currentDewPoint.toFixed(1)),
          dew_point_depression_celsius: parseFloat(dewPointDepression.toFixed(1)),
          fungal_blight_risk: fungalBlightRisk,
          soil_moisture_0_7cm: currentSoilMoisture,
          evapotranspiration_et0_mm: daily.et0_fao_evapotranspiration?.[0],
          safe_spraying_window: safeSprayingWindow,
          safe_spraying_window_detail: safeWindowDetailed
        },
        current: {
          ...current,
          temperature_2m: currentTemp,
          relative_humidity_2m: currentHumidity,
          dew_point_2m: currentDewPoint,
          wind_speed_10m: current10mWind,
          wind_speed_100m: current100mWind,
          direct_normal_irradiance: currentDNI
        },
        hourly: hourly,
        hourly_spread: hourlySpread,
        daily: daily
      };
    }

    // Spray / irrigate / fertilise advice, decided by the shared rules from the
    // very object returned (and cached), so the two can never disagree.
    weatherPayload.farm_actions = farmActionsFromFeed(weatherPayload);

    const body = JSON.stringify(weatherPayload);
    if (googleWeatherSucceeded) {
      if (paidWeatherCache.size >= PAID_WEATHER_CACHE_MAX) paidWeatherCache.clear();
      paidWeatherCache.set(cacheKey, { at: Date.now(), body });
    }
    return weatherResponse(body);
  } catch (error: any) {
    console.error('[AgroCast AI][netlify] Error generating weather forecast:', error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to generate weather forecast',
        details: error.message
      })
    };
  }
};

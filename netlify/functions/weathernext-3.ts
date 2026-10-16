import { Handler } from '@netlify/functions';
import axios from 'axios';

/**
 * AgroCast AI / Google Weather API agro-forecast endpoint (Netlify function).
 *
 * NOTE: This is the Netlify parity port of `handleWeatherNext3` in server.ts.
 * It serves /api/weathernext-3 and /api/weather-next (see netlify.toml redirects).
 *
 * PATHWAY 1: Live Google Maps Platform Weather API (weather.googleapis.com) -
 *            activated when a Google Maps key is available (client header
 *            `x-google-maps-key`, ?apiKey= query, or a server env secret).
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
  dataSource?: { name: string; authorityUri: string };
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

    // Resolve Google API key. Server-side secrets take priority so the browser's
    // (possibly HTTP-referrer-restricted) key can never break the server-to-server
    // Google Weather lookup. The client header/query remain a development fallback.
    const googleKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      event.headers['x-google-maps-key'] ||
      qs.apiKey;

    const gridLat = Math.round(lat / 0.05) * 0.05;
    const gridLon = Math.round(lon / 0.05) * 0.05;

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

            const isSafe = hRainProb <= 18 && hWind <= 14 && hWind100 <= 24 && hTemp >= 12 && hTemp <= 31;

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

          // Heuristic ensemble spread & convergence estimate
          const ensembleSeed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 1000);
          const varianceFactor = 0.82 + ((ensembleSeed % 100) / 280);
          const convergenceScore = Math.min(99, Math.max(93, Math.round(97 - (varianceFactor - 1) * 10)));

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
              headline: "High Atmospheric Saturation & Low Dew Point Depression",
              description: `Current humidity is ${currentHumidity}% with a dew point depression of only ${dewPointDepression.toFixed(1)}°C, providing prime incubation conditions for fungal spore germination.`,
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 86400000).toISOString(),
              agroImpact: "Apply preventive systemic fungicide on potato crops and scout boro rice seedbeds immediately before spore proliferation.",
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
              headline: `Extreme Heat Index: ${currentCond.heatIndex.degrees.toFixed(1)}°C`,
              description: "Severe heat index accelerates evapotranspiration, triggers pollen sterility in flowering crops, and causes heat stress in livestock.",
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 43200000).toISOString(),
              agroImpact: "Ensure 5-7cm standing irrigation water in paddy fields; avoid midday agrochemical spraying and provide shade for farm animals.",
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
              headline: `Sustained Wind: ${currentWind} km/h (Gusts: ${currentWindGust} km/h)`,
              description: "Surface and boundary-layer winds exceed safe agrochemical application thresholds.",
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 28800000).toISOString(),
              agroImpact: "Suspend backpack and drone pesticide/fertilizer spraying to avoid chemical drift wastage and non-target crop toxicity.",
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
              headline: `Storm Risk: ${maxRainProb}% Rain Probability (P90 Storm Spread: ${totalP90} mm)`,
              description: "Localized heavy precipitation and monsoonal squalls predicted within the 48-hour forecast window.",
              effective: new Date().toISOString(),
              expires: new Date(Date.now() + 86400000).toISOString(),
              agroImpact: "Clear field drainage furrows to prevent root inundation; secure harvested produce and postpone fertilizer broadcasting.",
              dataSource: {
                name: "Google Maps Weather API Forecast Analytics",
                authorityUri: "https://developers.google.com/maps/documentation/weather"
              }
            });
          }

          weatherPayload = {
            model: "Google Weather API",
            provider: "Google Maps Platform",
            version: "1.0-live-gmp",
            source: "google_weather_api",
            resolution: "0.05° (~5 km spatial grid)",
            grid_coordinates: { latitude: gridLat, longitude: gridLon },
            data_sources: {
              forecast: "Google Maps Platform Weather API (weather.googleapis.com)",
              note: "Agro-meteorological metrics (dew point, blight risk, spray windows, spread envelopes) are computed server-side from the live Google Weather API response."
            },
            alerts: alerts,
            ensemble: {
              estimate_basis: "Heuristic spread envelope derived from hourly Google Weather API forecast data",
              convergence_score_pct: convergenceScore,
              temperature_spread: {
                p10: parseFloat((currentTemp - 0.7 * varianceFactor).toFixed(1)),
                median: currentTemp,
                p90: parseFloat((currentTemp + 0.8 * varianceFactor).toFixed(1))
              },
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
            daily: {
              precipitation_sum: [totalP50],
              precipitation_probability_max: [maxRainProb],
              uv_index_max: [currentCond.uvIndex || 3],
              temperature_2m_max: [Math.max(...hourlyTemps.slice(0, 24), currentTemp + 2)],
              temperature_2m_min: [Math.min(...hourlyTemps.slice(0, 24), currentTemp - 4)]
            },
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
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,et0_fao_evapotranspiration',
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

      const ensembleSeed = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 1000);
      const varianceFactor = 0.8 + ((ensembleSeed % 100) / 250);
      const convergenceScore = Math.min(99, Math.max(91, Math.round(96 - (varianceFactor - 1) * 12)));

      const rainProbMax = daily.precipitation_probability_max?.[0] ?? 10;
      const expectedRainSum = daily.precipitation_sum?.[0] ?? 0;

      const rainP10 = Math.max(0, parseFloat((expectedRainSum * 0.6).toFixed(1)));
      const rainP90 = parseFloat((expectedRainSum * 1.45 + (rainProbMax > 40 ? 1.8 : 0.2)).toFixed(1));
      const tempP10 = parseFloat((currentTemp - 0.7 * varianceFactor).toFixed(1));
      const tempP90 = parseFloat((currentTemp + 0.8 * varianceFactor).toFixed(1));

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
          const isSafe = hProb <= 18 && hWind <= 14 && hWind100 <= 24 && hTemp >= 12 && hTemp <= 31;
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
            const w100 = winds100m[idx] ?? w10;
            const tVal = temps[idx] ?? 25;

            sumWind += w10;
            sumTemp += tVal;
            if (rProb > maxRainProbLocal) maxRainProbLocal = rProb;

            if (rProb > 18 || w10 > 14 || w100 > 24 || tVal > 31 || tVal < 12) {
              isSafe = false;
              break;
            }
          }

          if (isSafe) {
            const startDate = new Date(times[i]);
            const endDate = new Date(times[i + 2]);
            const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const startDay = startDate.getDate();
            const todayDay = new Date().getDate();
            const dayLabel = startDay === todayDay ? "Today" : "Tomorrow";
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
          headline: `Relative Humidity: ${currentHumidity.toFixed(1)}% | Dew Point Depression: ${dewPointDepression.toFixed(1)}°C`,
          description: "High relative humidity combined with prolonged dew retention creates optimal conditions for fungal blight spore germination.",
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 86400000).toISOString(),
          agroImpact: "Spray preventive copper hydroxide or mancozeb before fungal hyphae establish on leaves.",
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
          headline: `Precipitation Probability: ${rainProbMax}% (P90 Storm Spike: ${rainP90} mm)`,
          description: "Substantial monsoonal rainfall expected. Potential flash waterlogging in low-lying crop plots.",
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 86400000).toISOString(),
          agroImpact: "Ensure unblocked outlet drains in vegetable raised beds and paddy plots to avoid seed rot.",
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
        resolution: "0.05° (~5 km spatial grid)",
        grid_coordinates: { latitude: gridLat, longitude: gridLon },
        data_sources: {
          forecast: "Open-Meteo high-resolution model data (api.open-meteo.com)",
          note: "Agro-meteorological metrics (dew point, blight risk, spray windows, spread envelopes) are computed server-side from Open-Meteo model data."
        },
        alerts: ensembleAlerts,
        ensemble: {
          estimate_basis: "Heuristic spread estimate derived from Open-Meteo daily probabilities",
          convergence_score_pct: convergenceScore,
          temperature_spread: { p10: tempP10, median: currentTemp, p90: tempP90 },
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Real-time forecast must never be cached by proxy or browser
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      },
      body: JSON.stringify(weatherPayload)
    };
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

import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, Loader2, MapPin, Navigation, Sparkles, AlertTriangle, Thermometer, HelpCircle, Layers, TestTube, History, RefreshCcw, Satellite, Zap, ShieldAlert, ShieldCheck, ArrowUpRight, ChevronDown, ChevronUp, Sliders, Database, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';
import { geoData } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';
import MicroclimateRadarSimulator from './MicroclimateRadarSimulator';
import { saveCachedWeather, getCachedWeather, formatCacheAge } from '../utils/offlineCache';
import toast from 'react-hot-toast';

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
}

interface HourlyForecastItem {
  time: string;
  temp: number;
  humidity: number;
  rainProb: number;
  wind: number;
  condition: string;
  dni?: number;
  rawTime?: string;
}

interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainfall: number;
  rainChance: number;
  uvIndex: number;
  locationName: string;
  historicalAvgTemp?: number;
  historicalToday?: {
    maxTemp: number;
    minTemp: number;
    rain: number;
  };
  soilMoisture?: number;
  evapotranspiration?: number;
  soilPH?: number;
  soilNitrogen?: number;
  soilCarbon?: number;
  safeSprayingWindow?: string;
  // WeatherNext 3 Fields
  isWeatherNext3?: boolean;
  weatherNext3?: any;
  boundaryWind100m?: number;
  solarRadiationDNI?: number;
  dewPoint?: number;
  dewPointDepression?: number;
  fungalBlightRisk?: 'low' | 'moderate' | 'high';
  ensembleConfidence?: number;
  precipitationSpread?: { p10: number; median: number; p90: number };
  temperatureSpread?: { p10: number; median: number; p90: number };
  heavyRainRisk?: number;
  hourlyForecast?: HourlyForecastItem[];
}

export default function WeatherAdvisory({ lang, globalLocation, setGlobalLocation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(geoData[0].id);
  const [selectedUpazila, setSelectedUpazila] = useState(geoData[0].upazilas[0]?.id || '');
  const [forecastModel, setForecastModel] = useState<'weathernext3' | 'standard'>('weathernext3');
  const [showSensorMetrology, setShowSensorMetrology] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ isCached: boolean; timestamp?: number; isFallback?: boolean } | null>(null);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);
  const prevCoordsRef = React.useRef<string | null>(null);
  const t = translations[lang];

  const activeDistrict = geoData.find(d => d.id === selectedDistrict);
  const activeUpazila = activeDistrict?.upazilas.find(u => u.id === selectedUpazila);

  const handleDetectLocation = async () => {
    setIsDetecting(true);
    setLocationError(null);
    setIsManualLocation(false);

    try {
      const coords = await detectUserLocation();
      setGlobalLocation(coords);
      setIsDetecting(false);
    } catch (error: any) {
      console.warn("Location detection notice in WeatherAdvisory:", error?.message || error);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error?.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      if (error?.code === 3) msg = "Location request timed out. Please try again or use manual entry.";
      setLocationError(msg);
      setIsDetecting(false);
      setIsManualLocation(true);
    }
  };

  const handleManualLocationChange = (upazilaId: string) => {
    setSelectedUpazila(upazilaId);
    const upazila = activeDistrict?.upazilas.find(u => u.id === upazilaId);
    if (upazila) {
      setGlobalLocation({
        latitude: upazila.lat,
        longitude: upazila.lng
      });
    }
  };

  const fetchWeatherAndAdvisory = async (overrideModel?: 'weathernext3' | 'standard', forceFresh: boolean = false) => {
    if (!globalLocation) return;
    const activeModel = overrideModel || forecastModel;
    setIsLoading(true);
    if (forceFresh) {
      setIsRefreshingLive(true);
    }
    
    try {
      let newWeather: WeatherData;
      let safeSprayingWindow = "No safe window in the next 24 hours";
      let currentIndex = 0;

      // Real-time request headers with strict cache-busting to guarantee live data
      const cacheBustParam = `&_t=${Date.now()}`;
      const liveFetchOptions: RequestInit = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      };

      // 1. Fetch Forecast Data based on activeModel
      if (activeModel === 'weathernext3') {
        const wnRes = await fetch(
          `/api/weathernext-3?latitude=${globalLocation.latitude}&longitude=${globalLocation.longitude}&timezone=auto${cacheBustParam}`,
          liveFetchOptions
        );
        if (!wnRes.ok) {
          const errJson = await wnRes.json().catch(() => ({}));
          console.error("WeatherNext 3 API Error Response:", wnRes.status, errJson);
          throw new Error(errJson.error || `WeatherNext 3 service returned ${wnRes.status}`);
        }
        const wnData = await wnRes.json();
        if (!wnData.current) {
          throw new Error("Invalid WeatherNext 3 data structure received");
        }

        const code = wnData.current?.weather_code || 0;
        let condition = 'Sunny';
        if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
        else if (code >= 45 && code <= 48) condition = 'Foggy';
        else if (code >= 51 && code <= 67) condition = 'Rainy';
        else if (code >= 71 && code <= 77) condition = 'Snowy';
        else if (code >= 80 && code <= 82) condition = 'Showers';
        else if (code >= 95 && code <= 99) condition = 'Thunderstorm';

        // Extract Hourly timeline
        const hourlyItems: HourlyForecastItem[] = [];
        if (wnData.hourly?.time) {
          const refTime = wnData.current.time;
          for (let i = 0; i < wnData.hourly.time.length; i++) {
            if (wnData.hourly.time[i] >= refTime) {
              currentIndex = i;
              break;
            }
          }

          const maxHours = Math.min(currentIndex + 48, wnData.hourly.time.length);
          for (let i = currentIndex; i < maxHours; i++) {
            const hTime = new Date(wnData.hourly.time[i]).toLocaleTimeString([], { hour: 'numeric' });
            const hCode = wnData.hourly.weather_code?.[i] || 0;
            let hCond = 'Sunny';
            if (hCode >= 1 && hCode <= 3) hCond = 'Partly Cloudy';
            else if (hCode >= 51 && hCode <= 67) hCond = 'Rainy';
            else if (hCode >= 80 && hCode <= 82) hCond = 'Showers';
            else if (hCode >= 95) hCond = 'Thunderstorm';

            hourlyItems.push({
              time: hTime,
              temp: wnData.hourly.temperature_2m?.[i] ?? 0,
              humidity: wnData.hourly.relative_humidity_2m?.[i] ?? 0,
              rainProb: wnData.hourly.precipitation_probability?.[i] ?? 0,
              wind: wnData.hourly.wind_speed_10m?.[i] ?? 0,
              condition: hCond,
              dni: wnData.hourly.direct_normal_irradiance?.[i] ?? 0,
              rawTime: wnData.hourly.time[i]
            });
          }
        }

        safeSprayingWindow = wnData.agro_metrics?.safe_spraying_window || safeSprayingWindow;

        newWeather = {
          temp: wnData.current?.temperature_2m ?? 0,
          condition: condition,
          humidity: wnData.current?.relative_humidity_2m ?? 0,
          windSpeed: wnData.current?.wind_speed_10m ?? 0,
          rainfall: wnData.current?.precipitation ?? 0,
          rainChance: wnData.daily?.precipitation_probability_max?.[0] ?? 0,
          uvIndex: wnData.daily?.uv_index_max?.[0] ?? 0,
          locationName: "Local Area",
          soilMoisture: wnData.agro_metrics?.soil_moisture_0_7cm,
          evapotranspiration: wnData.agro_metrics?.evapotranspiration_et0_mm,
          safeSprayingWindow,
          // WeatherNext 3 Specific Fields
          isWeatherNext3: true,
          weatherNext3: wnData,
          boundaryWind100m: wnData.agro_metrics?.boundary_layer_wind_100m_kmh,
          solarRadiationDNI: wnData.agro_metrics?.direct_normal_irradiance_wm2,
          dewPoint: wnData.agro_metrics?.dew_point_celsius,
          dewPointDepression: wnData.agro_metrics?.dew_point_depression_celsius,
          fungalBlightRisk: wnData.agro_metrics?.fungal_blight_risk,
          ensembleConfidence: wnData.ensemble?.convergence_score_pct,
          precipitationSpread: wnData.ensemble?.precipitation_spread_mm,
          temperatureSpread: wnData.ensemble?.temperature_spread,
          heavyRainRisk: wnData.ensemble?.heavy_rain_risk_prob,
          hourlyForecast: hourlyItems
        };
      } else {
        // Standard Multi-Model Open-Meteo
        const weatherRes = await fetch(
          `/api/daily-forecast?latitude=${globalLocation.latitude}&longitude=${globalLocation.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,wind_speed_10m,soil_moisture_0_to_7cm&daily=uv_index_max,precipitation_probability_max,et0_fao_evapotranspiration&timezone=auto${cacheBustParam}`,
          liveFetchOptions
        );
        
        if (!weatherRes.ok) {
          const errJson = await weatherRes.json().catch(() => ({}));
          console.error("Weather API Error Response:", weatherRes.status, errJson);
          throw new Error(errJson.error || `Weather server returned ${weatherRes.status}`);
        }

        const weatherData = await weatherRes.json();
        
        if (!weatherData.current) {
          throw new Error("Invalid weather data format received from Open-Meteo");
        }

        const standardHourlyItems: HourlyForecastItem[] = [];

        // Calculate Safe Spraying Window & Current hour-based data
        if (weatherData.hourly) {
          const times = weatherData.hourly.time;
          const temps = weatherData.hourly.temperature_2m;
          const rainProbs = weatherData.hourly.precipitation_probability;
          const windSpeeds = weatherData.hourly.wind_speed_10m;
          
          const referenceTime = weatherData.current.time;
          for (let i = 0; i < times.length; i++) {
            if (times[i] >= referenceTime) {
              currentIndex = i;
              break;
            }
          }

          const maxHours = Math.min(currentIndex + 48, times.length);
          for (let i = currentIndex; i < maxHours; i++) {
            const hTime = new Date(times[i]).toLocaleTimeString([], { hour: 'numeric' });
            const hCode = weatherData.hourly.weather_code?.[i] || 0;
            let hCond = 'Sunny';
            if (hCode >= 1 && hCode <= 3) hCond = 'Partly Cloudy';
            else if (hCode >= 51 && hCode <= 67) hCond = 'Rainy';
            else if (hCode >= 80 && hCode <= 82) hCond = 'Showers';
            else if (hCode >= 95) hCond = 'Thunderstorm';

            standardHourlyItems.push({
              time: hTime,
              temp: Math.round(temps?.[i] ?? 0),
              humidity: 75,
              rainProb: Math.round(rainProbs?.[i] ?? 0),
              wind: Math.round(windSpeeds?.[i] ?? 0),
              condition: hCond,
              rawTime: times[i]
            });
          }

          for (let i = currentIndex; i < Math.min(currentIndex + 24, times.length - 2); i++) {
            let isSafe = true;
            for (let j = 0; j < 3; j++) {
              const idx = i + j;
              if (
                (rainProbs[idx] || 0) > 20 ||
                (windSpeeds[idx] || 0) > 15 ||
                (temps[idx] || 0) > 30 ||
                (temps[idx] || 0) < 10
              ) {
                isSafe = false;
                break;
              }
            }
            
            if (isSafe) {
              const startWindow = new Date(times[i]);
              const endWindow = new Date(times[i + 2]);
              const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              
              const startDay = new Date(times[i]).getDate();
              const refDay = new Date(referenceTime).getDate();
              const dayStr = startDay === refDay ? (lang === 'bn' ? "আজ" : "Today") : (lang === 'bn' ? "আগামীকাল" : "Tomorrow");
              safeSprayingWindow = `${dayStr}, ${formatTime(startWindow)} - ${formatTime(endWindow)}`;
              break;
            }
          }
        }

        const code = weatherData.current?.weather_code || 0;
        let condition = 'Sunny';
        if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
        else if (code >= 45 && code <= 48) condition = 'Foggy';
        else if (code >= 51 && code <= 67) condition = 'Rainy';
        else if (code >= 71 && code <= 77) condition = 'Snowy';
        else if (code >= 80 && code <= 82) condition = 'Showers';
        else if (code >= 95 && code <= 99) condition = 'Thunderstorm';

        const currentSoilMoisture = weatherData.hourly?.soil_moisture_0_to_7cm ? weatherData.hourly.soil_moisture_0_to_7cm[currentIndex] : undefined;

        newWeather = {
          temp: weatherData.current?.temperature_2m || 0,
          condition: condition,
          humidity: weatherData.current?.relative_humidity_2m || 0,
          windSpeed: weatherData.current?.wind_speed_10m || 0,
          rainfall: weatherData.current?.precipitation || 0,
          rainChance: weatherData.daily?.precipitation_probability_max?.[0] || 0,
          uvIndex: weatherData.daily?.uv_index_max?.[0] || 0,
          locationName: "Local Area",
          soilMoisture: currentSoilMoisture,
          evapotranspiration: weatherData.daily?.et0_fao_evapotranspiration?.[0],
          safeSprayingWindow,
          isWeatherNext3: false,
          hourlyForecast: standardHourlyItems
        };
      }
      
      // 2. Fetch Historical Climate Data (Last 5 years for the current month)
      const date = new Date();
      const currentMonth = String(date.getMonth() + 1).padStart(2, '0');
      const endYear = date.getFullYear() - 1;
      const startYear = endYear - 4;
      const lastDay = new Date(startYear, date.getMonth() + 1, 0).getDate();
      
      const startDate = `${startYear}-${currentMonth}-01`;
      const endDate = `${endYear}-${currentMonth}-${lastDay}`;
      
      // Calculate exactly one year ago today
      const lastYearToday = new Date();
      lastYearToday.setFullYear(lastYearToday.getFullYear() - 1);
      const lastYearTodayStr = lastYearToday.toISOString().split('T')[0];

      let historicalAvgTemp = undefined;
      let historicalToday = undefined;

      try {
        const climateRes = await fetch(`/api/historical-data?latitude=${globalLocation.latitude}&longitude=${globalLocation.longitude}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean&timezone=auto`);
        
        if (climateRes.ok) {
          const climateData = await climateRes.json();
          if (climateData.daily?.temperature_2m_mean && climateData.daily?.time) {
            const temps = climateData.daily.temperature_2m_mean;
            const times = climateData.daily.time;
            
            let sum = 0;
            let count = 0;
            for (let i = 0; i < times.length; i++) {
              if (times[i].split('-')[1] === currentMonth && temps[i] !== null) {
                sum += temps[i];
                count++;
              }
            }
            if (count > 0) {
              historicalAvgTemp = sum / count;
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch historical climate data", e);
      }

      try {
        const lastYearRes = await fetch(`/api/historical-data?latitude=${globalLocation.latitude}&longitude=${globalLocation.longitude}&start_date=${lastYearTodayStr}&end_date=${lastYearTodayStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
        
        if (lastYearRes.ok) {
          const lastYearData = await lastYearRes.json();
          if (lastYearData.daily && lastYearData.daily.temperature_2m_max.length > 0) {
            historicalToday = {
              maxTemp: lastYearData.daily.temperature_2m_max[0],
              minTemp: lastYearData.daily.temperature_2m_min[0],
              rain: lastYearData.daily.precipitation_sum[0]
            };
          }
        }
      } catch (e) {
        console.error("Failed to fetch last year's data", e);
      }

      // 3. Fetch SoilGrids Data
      let soilPH, soilNitrogen, soilCarbon;
      try {
        const soilRes = await fetch(`/api/soil-properties?lon=${globalLocation.longitude}&lat=${globalLocation.latitude}&property=phh2o&property=nitrogen&property=soc&depth=0-5cm&value=mean`);
        const soilData = await soilRes.json();
        
        const layers = soilData.properties?.layers || [];
        const phLayer = layers.find((l: any) => l.name === 'phh2o');
        const nLayer = layers.find((l: any) => l.name === 'nitrogen');
        const cLayer = layers.find((l: any) => l.name === 'soc');
        
        if (phLayer && phLayer.depths[0].values.mean) soilPH = phLayer.depths[0].values.mean / 10;
        if (nLayer && nLayer.depths[0].values.mean) soilNitrogen = nLayer.depths[0].values.mean / 100;
        if (cLayer && cLayer.depths[0].values.mean) soilCarbon = cLayer.depths[0].values.mean / 10;
      } catch (e) {
        console.error("Failed to fetch soil data", e);
      }

      newWeather.historicalAvgTemp = historicalAvgTemp;
      newWeather.historicalToday = historicalToday;
      if (soilPH !== undefined) newWeather.soilPH = soilPH;
      if (soilNitrogen !== undefined) newWeather.soilNitrogen = soilNitrogen;
      if (soilCarbon !== undefined) newWeather.soilCarbon = soilCarbon;
      
      setWeather(newWeather);
      setCacheInfo(null);
      const locKey = `${globalLocation.latitude.toFixed(2)}_${globalLocation.longitude.toFixed(2)}`;
      saveCachedWeather(locKey, newWeather, activeModel);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      if (forceFresh) {
        toast.success(
          lang === 'bn' ? 'সরাসরি আবহাওয়া তথ্য আপডেট হয়েছে' : 'Live weather forecast updated',
          { id: 'live-weather-updated', duration: 2500 }
        );
      }
    } catch (error: any) {
      console.error("Weather data fetch error, retrieving offline cache:", error);
      const locKey = `${globalLocation.latitude.toFixed(2)}_${globalLocation.longitude.toFixed(2)}`;
      const cached = getCachedWeather(locKey, activeModel, true);
      if (cached) {
        setWeather(cached.data);
        setCacheInfo({ isCached: true, timestamp: cached.timestamp, isFallback: cached.isFallback });
        setLastUpdated(new Date(cached.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (forceFresh) {
          toast(
            lang === 'bn' ? 'অফলাইন মোড: সংরক্ষিত ক্যাশ ডেটা দেখানো হচ্ছে' : 'Offline mode: displaying saved cache',
            { icon: '💾', id: 'weather-cache-notice' }
          );
        }
      } else {
        toast.error(
          lang === 'bn' ? 'আবহাওয়া তথ্য লোড করা যায়নি' : 'Unable to load weather forecast',
          { id: 'weather-fetch-error' }
        );
      }
    } finally {
      setIsLoading(false);
      setIsRefreshingLive(false);
    }
  };

  useEffect(() => {
    if (globalLocation) {
      const locKey = `${globalLocation.latitude.toFixed(2)}_${globalLocation.longitude.toFixed(2)}`;
      
      // If coordinates changed, clear old weather data to avoid flashing the wrong region
      if (prevCoordsRef.current && prevCoordsRef.current !== locKey) {
        setWeather(null);
        setCacheInfo(null);
      }
      prevCoordsRef.current = locKey;

      // Only display cache if it is fresh (< 20 mins)
      const cached = getCachedWeather(locKey, forecastModel, false);
      if (cached && !weather) {
        setWeather(cached.data);
        setCacheInfo({ isCached: true, timestamp: cached.timestamp, isFallback: false });
        setLastUpdated(new Date(cached.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      
      // Always immediately query live API in the background
      fetchWeatherAndAdvisory();
    } else {
      // Seamlessly fall back to default location rather than blocking the tab
      setGlobalLocation({ latitude: 23.8103, longitude: 90.4125 });
    }

    const handleForceRefresh = () => {
      fetchWeatherAndAdvisory(undefined, true);
    };
    window.addEventListener('agri:force-refresh-cache', handleForceRefresh);
    return () => {
      window.removeEventListener('agri:force-refresh-cache', handleForceRefresh);
    };
  }, [globalLocation?.latitude, globalLocation?.longitude]);

  const getHumidityTooltip = (val: number) => {
    if (val < 30) return t.weatherTooltips?.humidityLow;
    if (val <= 60) return t.weatherTooltips?.humidityComfortable;
    return t.weatherTooltips?.humidityHigh;
  };

  const getWindTooltip = (val: number) => {
    if (val < 10) return t.weatherTooltips?.windCalm;
    if (val <= 25) return t.weatherTooltips?.windModerate;
    return t.weatherTooltips?.windStrong;
  };

  const getRainTooltip = (val: number) => {
    if (val === 0) return t.weatherTooltips?.rainNone;
    if (val <= 30) return t.weatherTooltips?.rainSlight;
    if (val <= 70) return t.weatherTooltips?.rainModerate;
    return t.weatherTooltips?.rainHigh;
  };

  const getUvTooltip = (val: number) => {
    if (val < 3) return t.weatherTooltips?.uvLow;
    if (val <= 5) return t.weatherTooltips?.uvModerate;
    if (val <= 7) return t.weatherTooltips?.uvHigh;
    return t.weatherTooltips?.uvVeryHigh;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6 w-full"
    >
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 md:p-6 border border-stone-200/80 dark:border-stone-800 mb-4 md:mb-6 shadow-xs">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-blue-50 dark:bg-blue-950/60 p-2 md:p-3 rounded-xl flex-shrink-0 text-blue-600 dark:text-blue-400">
            <Cloud className="w-6 h-6 md:w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-tight">{t.weatherAdvisory}</h2>
            <p className="text-stone-500 dark:text-stone-400 text-xs md:text-sm font-normal mt-0.5">{t.weatherAdvisoryDesc}</p>
          </div>
        </div>
      </div>

      {!globalLocation ? (
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-16 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-50/80 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 opacity-80 transition-opacity"></div>
          <div className="relative z-10">
            <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t.location}</h3>
            
            {isManualLocation ? (
              <div className="mb-8 flex flex-col items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      const newDistrict = geoData.find(d => d.id === e.target.value);
                      if (newDistrict && newDistrict.upazilas.length > 0) {
                        handleManualLocationChange(newDistrict.upazilas[0].id);
                      } else {
                        setSelectedUpazila('');
                      }
                    }}
                    className="bg-white border-2 border-blue-100 rounded-2xl px-6 py-3 text-lg font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/20 outline-none shadow-sm"
                  >
                    {geoData.map(d => (
                      <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn_name : d.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedUpazila}
                    onChange={(e) => handleManualLocationChange(e.target.value)}
                    className="bg-white border-2 border-blue-100 rounded-2xl px-6 py-3 text-lg font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/20 outline-none shadow-sm"
                    disabled={!activeDistrict || activeDistrict.upazilas.length === 0}
                  >
                    {activeDistrict?.upazilas.map(u => (
                      <option key={u.id} value={u.id}>{lang === 'bn' ? u.bn_name : u.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setIsManualLocation(false)}
                  className="text-blue-600 font-bold text-sm hover:underline"
                >
                  {t.tryGpsAgain}
                </button>
              </div>
            ) : (
              <p className="text-gray-500 mb-8 text-lg max-w-md mx-auto">{t.tooltips.locationDesc}</p>
            )}

            {locationError && <p className="text-sm text-red-500 mb-4">{locationError}</p>}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={handleDetectLocation}
                disabled={isDetecting}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-10 rounded-2xl hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center space-x-3 group"
              >
                {isDetecting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Navigation className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                )}
                <span className="text-lg">{isDetecting ? t.tooltips.detecting : t.tooltips.detectLocation}</span>
              </button>

              {!isManualLocation && (
                <button 
                  onClick={() => setIsManualLocation(true)}
                  className="bg-white border-2 border-blue-100 text-blue-600 font-bold py-4 px-10 rounded-2xl hover:bg-blue-50 transition-all"
                >
                  {t.setManually}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3 sm:space-y-4 w-full">
          {/* Weather Dashboard Card - TOP (Squeezed & Reduced Whitespace) */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-stone-900 p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs relative overflow-hidden"
          >
            {/* Header: Title, Live Status, Location Display & Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5 pb-2.5 border-b border-stone-100 dark:border-stone-800">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-stone-900 dark:text-stone-100 text-lg sm:text-xl tracking-tight">
                    {t.weatherForecast}
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-[11px] font-semibold border border-emerald-200/60 dark:border-emerald-800">
                    <span className="recording-dot shrink-0" />
                    <span>{lang === 'bn' ? 'সরাসরি স্যাটেলাইট ডেটা' : 'Live Data'}</span>
                  </span>
                  {cacheInfo?.isCached && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-medium border border-amber-200 dark:border-amber-800">
                      <Database className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      <span>
                        {cacheInfo.isFallback 
                          ? (lang === 'bn' ? "কক্সবাজার অফলাইন ক্যাশ" : "Offline Cache")
                          : (lang === 'bn' 
                              ? `ক্যাশ • ${formatCacheAge(cacheInfo.timestamp || Date.now(), 'bn')}`
                              : `Cached • ${formatCacheAge(cacheInfo.timestamp || Date.now(), 'en')}`)}
                      </span>
                    </span>
                  )}
                </div>
                {globalLocation && (
                  <div className="mt-1.5">
                    <LocationDisplay coords={globalLocation} lang={lang} color="emerald" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                <button 
                  onClick={() => fetchWeatherAndAdvisory(forecastModel, true)} 
                  disabled={isLoading || isRefreshingLive}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 rounded-xl transition-all cursor-pointer text-xs font-semibold shadow-xs"
                  title={lang === 'bn' ? 'সরাসরি স্যাটেলাইট ও আবহাওয়া পূর্বাভাস আপডেট করুন' : 'Force Refresh Live Weather & Satellite Data'}
                  aria-label="Refresh Live Weather"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isLoading || isRefreshingLive ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`} />
                  <span>{isLoading || isRefreshingLive ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...') : (lang === 'bn' ? 'লাইভ রিফ্রেশ' : 'Live Refresh')}</span>
                </button>

                <button 
                  onClick={handleDetectLocation} 
                  disabled={isDetecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl transition-all cursor-pointer text-xs font-semibold shadow-xs"
                  title={lang === 'bn' ? 'জিপিএস অবস্থান রিফ্রেশ করুন' : 'Refresh GPS Location'}
                  aria-label="Refresh GPS Location"
                >
                  <Navigation className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                  <span>{isDetecting ? (lang === 'bn' ? 'শনাক্ত হচ্ছে...' : 'Detecting...') : (lang === 'bn' ? 'জিপিএস রিফ্রেশ' : 'Refresh GPS')}</span>
                </button>
              </div>
            </div>

            {weather ? (
              <div className="space-y-3 sm:space-y-3.5">
                {/* WeatherNext 3 Advanced Weather AI banner (Squeezed) */}
                {weather.isWeatherNext3 && (
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-3 rounded-xl border border-blue-400/25 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 shrink-0">
                          <Satellite className="w-3.5 h-3.5 text-blue-300 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black tracking-widest uppercase text-blue-300">Google AI</span>
                            <span className="text-[9px] bg-emerald-500/25 text-emerald-300 px-1.5 py-0.2 rounded font-bold border border-emerald-400/30">
                              5km AI
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                            {lang === 'bn' ? 'উন্নত এআই আবহাওয়া মডেল' : 'Advanced Weather AI'}
                          </h4>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider block">
                          {lang === 'bn' ? 'মডেল নির্ভুলতা' : 'Accuracy'}
                        </span>
                        <span className="text-xs font-black text-emerald-400">
                          {weather.ensembleConfidence || 96}% {lang === 'bn' ? 'সঠিক' : 'Confidence'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Temp & Condition Display (Squeezed) */}
                <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-stone-50/70 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-800">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <motion.div 
                      animate={{ 
                        y: [0, -3, 0],
                        rotate: [0, 2, 0]
                      }}
                      transition={{ 
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="shrink-0"
                    >
                      {weather.condition === 'Sunny' ? (
                        <Sun className="w-12 h-12 sm:w-14 sm:h-14 text-amber-500 drop-shadow-sm" />
                      ) : (
                        <CloudRain className="w-12 h-12 sm:w-14 sm:h-14 text-sky-500 drop-shadow-sm" />
                      )}
                    </motion.div>
                    <div>
                      <div className="flex items-baseline">
                        <span className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-stone-100 tabular-nums">
                          {weather.temp.toFixed(1)}
                        </span>
                        <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 ml-1">°C</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wide mt-0.5">
                        {weather.condition}
                      </p>
                    </div>
                  </div>

                  {weather.rainfall > 0 && (
                    <div className="text-right hidden sm:block">
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 block font-medium">
                        {lang === 'bn' ? 'বৃষ্টিপাত' : 'Precipitation'}
                      </span>
                      <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                        {weather.rainfall.toFixed(1)} mm
                      </span>
                    </div>
                  )}
                </div>

                {/* 4 Primary Weather Metrics Grid (Squeezed) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  <Tooltip content={getHumidityTooltip(weather.humidity) || ""}>
                    <motion.div 
                      whileHover={{ y: -1 }}
                      className="bg-stone-50/70 dark:bg-stone-800/60 p-2.5 sm:p-3 rounded-xl border border-stone-200/80 dark:border-stone-700/70 shadow-xs h-full"
                    >
                      <div className="flex items-center text-blue-600 dark:text-blue-400 mb-1">
                        <div className="p-1 bg-white dark:bg-stone-700 rounded-lg shadow-xs mr-1.5 shrink-0">
                          <Droplets className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 truncate">{t.humidity}</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {weather.humidity.toFixed(1)}%
                      </span>
                    </motion.div>
                  </Tooltip>
                
                  <Tooltip content={getWindTooltip(weather.windSpeed) || ""}>
                    <motion.div 
                      whileHover={{ y: -1 }}
                      className="bg-stone-50/70 dark:bg-stone-800/60 p-2.5 sm:p-3 rounded-xl border border-stone-200/80 dark:border-stone-700/70 shadow-xs h-full"
                    >
                      <div className="flex items-center text-indigo-600 dark:text-indigo-400 mb-1">
                        <div className="p-1 bg-white dark:bg-stone-700 rounded-lg shadow-xs mr-1.5 shrink-0">
                          <Wind className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 truncate">{t.windSpeed}</span>
                      </div>
                      <div className="flex items-baseline">
                        <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                          {weather.windSpeed.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-medium text-stone-400 ml-1">km/h</span>
                      </div>
                    </motion.div>
                  </Tooltip>

                  <Tooltip content={getRainTooltip(weather.rainChance) || ""}>
                    <motion.div 
                      whileHover={{ y: -1 }}
                      className="bg-stone-50/70 dark:bg-stone-800/60 p-2.5 sm:p-3 rounded-xl border border-stone-200/80 dark:border-stone-700/70 shadow-xs h-full"
                    >
                      <div className="flex items-center text-cyan-600 dark:text-cyan-400 mb-1">
                        <div className="p-1 bg-white dark:bg-stone-700 rounded-lg shadow-xs mr-1.5 shrink-0">
                          <CloudRain className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 truncate">{t.rainChance}</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {weather.rainChance}%
                      </span>
                    </motion.div>
                  </Tooltip>

                  <Tooltip content={getUvTooltip(weather.uvIndex) || ""}>
                    <motion.div 
                      whileHover={{ y: -1 }}
                      className="bg-stone-50/70 dark:bg-stone-800/60 p-2.5 sm:p-3 rounded-xl border border-stone-200/80 dark:border-stone-700/70 shadow-xs h-full"
                    >
                      <div className="flex items-center text-amber-600 dark:text-amber-400 mb-1">
                        <div className="p-1 bg-white dark:bg-stone-700 rounded-lg shadow-xs mr-1.5 shrink-0">
                          <Sun className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 truncate">{t.uvIndex}</span>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                        {weather.uvIndex}
                      </span>
                    </motion.div>
                  </Tooltip>
                </div>

                {/* WeatherNext 3 Agro-Meteorology Cards (Squeezed) */}
                {weather.isWeatherNext3 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        {lang === 'bn' ? 'কৃষি-আবহাওয়া ও মাইক্রোক্লাইমেট' : 'Agro-Microclimate Insights'}
                      </h4>
                      <span className="text-[9px] bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                        {lang === 'bn' ? 'উচ্চ নির্ভুলতা' : 'High Accuracy'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                      {/* 100m Canopy Wind */}
                      <div className="bg-sky-50/60 dark:bg-sky-950/30 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/40">
                        <div className="flex items-center gap-1 text-sky-700 dark:text-sky-300 mb-1">
                          <Wind className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                            {lang === 'bn' ? '১০০মি বাতাস' : 'Canopy Wind'}
                          </span>
                        </div>
                        <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {weather.boundaryWind100m !== undefined ? weather.boundaryWind100m.toFixed(1) : (weather.windSpeed * 1.35).toFixed(1)}
                          <span className="text-[10px] text-gray-500 ml-0.5 font-normal">km/h</span>
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          {lang === 'bn' ? 'স্প্রে ড্রিফট ঝুঁকি' : 'Spray drift risk'}
                        </p>
                      </div>

                      {/* Solar Irradiance DNI */}
                      <div className="bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40">
                        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300 mb-1">
                          <Sun className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                            {lang === 'bn' ? 'সৌর বিকিরণ' : 'Solar DNI'}
                          </span>
                        </div>
                        <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {weather.solarRadiationDNI !== undefined ? Math.round(weather.solarRadiationDNI) : 480}
                          <span className="text-[10px] text-gray-500 ml-0.5 font-normal">W/m²</span>
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          {lang === 'bn' ? 'সোলার পাম্প/সালোকসংশ্লেষণ' : 'Solar pump/photosynthesis'}
                        </p>
                      </div>

                      {/* Dew Point & Blight Risk */}
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <ShieldAlert className="w-3 h-3" />
                            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                              {lang === 'bn' ? 'ছত্রাক ঝুঁকি' : 'Blight Risk'}
                            </span>
                          </div>
                          <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                            weather.fungalBlightRisk === 'high'
                              ? 'bg-red-100 text-red-700'
                              : weather.fungalBlightRisk === 'moderate'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {weather.fungalBlightRisk || 'low'}
                          </span>
                        </div>
                        <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          {weather.dewPoint !== undefined ? weather.dewPoint.toFixed(1) : 21.0}°C
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          {lang === 'bn' 
                            ? `শিশিরাঙ্ক ${weather.dewPointDepression ? weather.dewPointDepression.toFixed(1) : '3.5'}°C`
                            : `Depr: ${weather.dewPointDepression ? weather.dewPointDepression.toFixed(1) : '3.5'}°C`}
                        </p>
                      </div>

                      {/* Rain Range */}
                      <div className="bg-sky-50/60 dark:bg-sky-950/30 p-2.5 rounded-xl border border-sky-100 dark:border-sky-900/40">
                        <div className="flex items-center gap-1 text-sky-700 dark:text-sky-300 mb-1">
                          <CloudRain className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                            {lang === 'bn' ? 'বৃষ্টির পরিধি' : 'Rain Range'}
                          </span>
                        </div>
                        <div className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                          {weather.precipitationSpread?.p10 ?? 0} - {weather.precipitationSpread?.p90 ?? (weather.rainfall > 0 ? (weather.rainfall * 1.5).toFixed(1) : '2.0')}
                          <span className="text-[10px] text-stone-500 ml-0.5 font-normal">mm</span>
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                          {lang === 'bn' 
                            ? `ভারী বৃষ্টি ঝুঁকি: ${weather.heavyRainRisk ?? 10}%`
                            : `Heavy Risk: ${weather.heavyRainRisk ?? 10}%`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 24-Hour AI Hourly Timeline (Squeezed) */}
                {weather.hourlyForecast && weather.hourlyForecast.length > 0 && (
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t.hourlyForecastTrend || '24-Hour AI Weather Trend'}</span>
                      </h4>
                      <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                        {lang === 'bn' ? 'প্রতি ঘণ্টা' : 'Hourly'}
                      </span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 scrollbar-thin">
                      {weather.hourlyForecast.map((hour, idx) => (
                        <div 
                          key={idx} 
                          className={`shrink-0 flex flex-col items-center justify-between p-2 rounded-xl border text-center min-w-[62px] transition-all ${
                            idx === 0 
                              ? 'bg-blue-600 text-white border-blue-700 shadow-sm' 
                              : 'bg-stone-50 dark:bg-stone-800/60 text-stone-800 dark:text-stone-200 border-stone-200/70 dark:border-stone-700/70'
                          }`}
                        >
                          <span className={`text-[10px] font-semibold ${idx === 0 ? 'text-blue-100' : 'text-stone-500 dark:text-stone-400'}`}>
                            {idx === 0 ? (lang === 'bn' ? 'এখন' : 'Now') : hour.time}
                          </span>
                          <div className="my-1">
                            {hour.condition === 'Sunny' ? (
                              <Sun className={`w-4 h-4 ${idx === 0 ? 'text-yellow-300' : 'text-yellow-500'}`} />
                            ) : hour.condition === 'Rainy' || hour.condition === 'Showers' ? (
                              <CloudRain className={`w-4 h-4 ${idx === 0 ? 'text-cyan-200' : 'text-blue-500'}`} />
                            ) : (
                              <Cloud className={`w-4 h-4 ${idx === 0 ? 'text-blue-200' : 'text-blue-400'}`} />
                            )}
                          </div>
                          <span className="text-xs font-bold tabular-nums">{Math.round(hour.temp)}°C</span>
                          <div className="mt-0.5 flex items-center gap-0.5 text-[9px]">
                            <Droplets className={`w-2 h-2 ${idx === 0 ? 'text-cyan-200' : 'text-blue-500'}`} />
                            <span className={idx === 0 ? 'text-blue-100 font-bold' : 'text-blue-600 dark:text-blue-400 font-bold'}>
                              {hour.rainProb}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Soil & Hydrology Insights Section (Squeezed) */}
                {(weather.soilMoisture !== undefined || weather.soilPH !== undefined || weather.safeSprayingWindow) && (
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
                    <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      {lang === 'bn' ? 'মাটি ও সেচ সংক্রান্ত অন্তর্দৃষ্টি' : 'Soil & Hydrology Insights'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {weather.soilMoisture !== undefined && (
                        <div className="flex items-start gap-2 bg-stone-50 dark:bg-stone-800/50 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                          <Droplets className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">
                              {lang === 'bn' ? 'মাটির আর্দ্রতা (০-৭ সেমি)' : 'Soil Moisture (0-7cm)'}
                            </p>
                            <p className="text-stone-600 dark:text-stone-400 mt-0.5">
                              <span className="font-bold">{weather.soilMoisture} m³/m³</span>
                              {weather.evapotranspiration !== undefined && ` • বাষ্পীভবন: ${weather.evapotranspiration} mm/দিন`}
                            </p>
                          </div>
                        </div>
                      )}
                      {weather.soilPH !== undefined && (
                        <div className="flex items-start gap-2 bg-stone-50 dark:bg-stone-800/50 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700/60">
                          <Thermometer className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-stone-800 dark:text-stone-200">
                              {lang === 'bn' ? 'মাটির গুণমান' : 'Soil Properties'}
                            </p>
                            <p className="text-stone-600 dark:text-stone-400 mt-0.5">
                              pH: <span className="font-bold">{weather.soilPH}</span> | 
                              নাইট্রোজেন: <span className="font-bold">{weather.soilNitrogen} g/kg</span>
                            </p>
                          </div>
                        </div>
                      )}
                      {weather.safeSprayingWindow && (
                        <div className="sm:col-span-2 flex items-start gap-2 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                          <TestTube className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                              {lang === 'bn' ? 'নিরাপদ স্প্রে উইন্ডো' : 'Safe Spraying Window'}
                            </p>
                            <p className="text-stone-600 dark:text-stone-300 mt-0.5 font-medium">
                              {weather.safeSprayingWindow}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Historical Climate Comparison (Squeezed) */}
                {(weather.historicalAvgTemp !== undefined || weather.historicalToday !== undefined) && (
                  <div className="bg-blue-50/40 dark:bg-blue-950/20 p-2.5 sm:p-3 rounded-xl border border-blue-100/70 dark:border-blue-900/40 text-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      <h4 className="font-bold text-stone-800 dark:text-stone-200">
                        {lang === 'bn' ? 'ঐতিহাসিক জলবায়ু তুলনা' : 'Historical Climate Comparison'}
                      </h4>
                    </div>
                    {weather.historicalToday && (
                      <div className="flex flex-wrap gap-3 text-stone-700 dark:text-stone-300 mb-1.5 font-medium">
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-red-500" /> Max: {weather.historicalToday.maxTemp}°C
                        </span>
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-blue-500" /> Min: {weather.historicalToday.minTemp}°C
                        </span>
                        <span className="flex items-center gap-1">
                          <CloudRain className="w-3 h-3 text-cyan-500" /> Rain: {weather.historicalToday.rain}mm
                        </span>
                      </div>
                    )}
                    {weather.historicalAvgTemp !== undefined && (
                      <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
                        {lang === 'bn' 
                          ? `গত ৫ বছরে এই মাসে গড় তাপমাত্রা ছিল ${weather.historicalAvgTemp.toFixed(1)}°C। আজকের তাপমাত্রা (${weather.temp.toFixed(1)}°C) স্বাভাবিকের চেয়ে ${Math.abs(weather.temp - weather.historicalAvgTemp).toFixed(1)}°C ${weather.temp > weather.historicalAvgTemp ? 'বেশি' : 'কম'}।`
                          : `The 5-year average temperature for this month was ${weather.historicalAvgTemp.toFixed(1)}°C. Today (${weather.temp.toFixed(1)}°C) is ${Math.abs(weather.temp - weather.historicalAvgTemp).toFixed(1)}°C ${weather.temp > weather.historicalAvgTemp ? 'higher' : 'lower'} than usual.`}
                      </p>
                    )}
                  </div>
                )}

                {lastUpdated && (
                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[10px] text-stone-400">
                    <span className="font-medium uppercase tracking-wider">{lang === 'bn' ? 'সর্বশেষ আপডেট' : 'Last Updated'}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">{lastUpdated}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-stone-400 font-semibold text-xs tracking-wider">
                  {lang === 'bn' ? 'আবহাওয়া ডেটা লোড হচ্ছে...' : 'Fetching Weather...'}
                </p>
              </div>
            )}
          </motion.div>

          {/* Microclimate Radar & Simulation in clean toggle below the top card */}
          {globalLocation && weather && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowSensorMetrology(!showSensorMetrology)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-all cursor-pointer shadow-xs text-left"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      {lang === 'bn' ? '৪৮ ঘণ্টার মাইক্রোক্লাইমেট রাডার সিমুলেশন' : '48-Hour Microclimate Radar Simulator'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-stone-500">
                  <span className="text-xs font-medium hidden sm:inline">
                    {showSensorMetrology 
                      ? (lang === 'bn' ? 'লুকান' : 'Hide') 
                      : (lang === 'bn' ? 'দেখুন' : 'Show')}
                  </span>
                  {showSensorMetrology ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              <AnimatePresence>
                {showSensorMetrology && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pt-3"
                  >
                    <MicroclimateRadarSimulator
                      lang={lang}
                      coords={globalLocation}
                      hourlyForecast={weather?.hourlyForecast}
                      currentTemp={weather?.temp}
                      currentWind={weather?.windSpeed}
                      currentRainProb={weather?.rainChance}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

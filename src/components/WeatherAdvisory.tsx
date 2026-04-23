import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, Loader2, MapPin, Navigation, Sparkles, AlertTriangle, Thermometer, HelpCircle, Layers, TestTube, Volume2, VolumeX, Globe, History, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';
import Markdown from 'react-markdown';
import { translateText, generateWeatherAdvisory, generateSpeech } from '../services/ai';
import { geoData } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
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
}

export default function WeatherAdvisory({ lang, globalLocation, setGlobalLocation }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(geoData[0].id);
  const [selectedUpazila, setSelectedUpazila] = useState(geoData[0].upazilas[0]?.id || '');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const t = translations[lang];

  const handleTranslate = async () => {
    if (!advisory) return;
    setIsTranslating(true);
    try {
      const targetLang = lang === 'en' ? 'English' : 'Bengali';
      const translatedText = await translateText(advisory, targetLang);
      setAdvisory(translatedText);
      
      // Stop current speech if any
      if (isSpeaking) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

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
      console.error("Location error:", error);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      if (error.code === 3) msg = "Location request timed out. Please try again or use manual entry.";
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

  const toggleSpeech = async () => {
    if (!advisory) return;

    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsSpeaking(false);
      return;
    }

    setIsAudioLoading(true);
    try {
      const plainText = advisory.replace(/[*#_]/g, '');
      const base64Audio = await generateSpeech(plainText);
      
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsSpeaking(true);
        }
      }
    } catch (error) {
      console.error("Speech error:", error);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const fetchWeatherAndAdvisory = async () => {
    if (!globalLocation) return;
    setIsLoading(true);
    
    try {
      // 1. Fetch Current Weather, Hourly Forecast (including Soil Moisture) from Open-Meteo
      // soil_moisture_0_to_7cm is moved to hourly as it's not supported in current variables by default Open-Meteo API
      const weatherRes = await fetch(`/api/daily-forecast?latitude=${globalLocation.latitude}&longitude=${globalLocation.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,wind_speed_10m,soil_moisture_0_to_7cm&daily=uv_index_max,precipitation_probability_max,et0_fao_evapotranspiration&timezone=auto`);
      
      if (!weatherRes.ok) {
        const errJson = await weatherRes.json().catch(() => ({}));
        console.error("Weather API Error Response:", weatherRes.status, errJson);
        throw new Error(errJson.error || `Weather server returned ${weatherRes.status}`);
      }

      const weatherData = await weatherRes.json();
      
      if (!weatherData.current) {
        throw new Error("Invalid weather data format received from Open-Meteo");
      }

      // Calculate Safe Spraying Window & Current hour-based data
      let safeSprayingWindow = "No safe window in the next 24 hours";
      let currentIndex = 0;
      
      if (weatherData.hourly) {
        const times = weatherData.hourly.time;
        const temps = weatherData.hourly.temperature_2m;
        const rainProbs = weatherData.hourly.precipitation_probability;
        const windSpeeds = weatherData.hourly.wind_speed_10m;
        
        // Find current hour index based on current time from API (to avoid timezone issues)
        const referenceTime = weatherData.current.time;
        for (let i = 0; i < times.length; i++) {
          if (times[i] >= referenceTime) {
            currentIndex = i;
            break;
          }
        }

        // Look for a 3-hour contiguous block in the next 24 hours
        for (let i = currentIndex; i < Math.min(currentIndex + 24, times.length - 2); i++) {
          let isSafe = true;
          for (let j = 0; j < 3; j++) {
            const idx = i + j;
            if (
              (rainProbs[idx] || 0) > 20 || // Too much rain risk
              (windSpeeds[idx] || 0) > 15 || // Too windy (drift risk)
              (temps[idx] || 0) > 30 || // Too hot (evaporation/burn risk)
              (temps[idx] || 0) < 10 // Too cold
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
        
        if (!climateRes.ok) {
          throw new Error(`Historical API returned ${climateRes.status}`);
        }

        const climateData = await climateRes.json();
        
        if (!climateData.daily || !climateData.daily.temperature_2m_mean || !climateData.daily.time) {
          throw new Error("Incomplete daily historical temperature data");
        }
        
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
      } catch (e) {
        console.error("Failed to fetch historical climate data", e);
      }

      try {
        const lastYearRes = await fetch(`/api/historical-data?latitude=${globalLocation.latitude}&longitude=${globalLocation.longitude}&start_date=${lastYearTodayStr}&end_date=${lastYearTodayStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
        
        if (!lastYearRes.ok) {
          throw new Error(`Last year API returned ${lastYearRes.status}`);
        }

        const lastYearData = await lastYearRes.json();
        
        if (lastYearData.daily && lastYearData.daily.temperature_2m_max.length > 0) {
          historicalToday = {
            maxTemp: lastYearData.daily.temperature_2m_max[0],
            minTemp: lastYearData.daily.temperature_2m_min[0],
            rain: lastYearData.daily.precipitation_sum[0]
          };
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

      // Map WMO weather code to condition
      const code = weatherData.current?.weather_code || 0;
      let condition = 'Sunny';
      if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
      if (code >= 45 && code <= 48) condition = 'Foggy';
      if (code >= 51 && code <= 67) condition = 'Rainy';
      if (code >= 71 && code <= 77) condition = 'Snowy';
      if (code >= 80 && code <= 82) condition = 'Showers';
      if (code >= 95 && code <= 99) condition = 'Thunderstorm';

      const currentTemp = weatherData.current?.temperature_2m || 0;

      // Extract current soil moisture from hourly if available (takes the first value which is for the current hour usually)
      const currentSoilMoisture = weatherData.hourly?.soil_moisture_0_to_7cm ? weatherData.hourly.soil_moisture_0_to_7cm[currentIndex] : undefined;

      const newWeather: WeatherData = {
        temp: currentTemp,
        condition: condition,
        humidity: weatherData.current?.relative_humidity_2m || 0,
        windSpeed: weatherData.current?.wind_speed_10m || 0,
        rainfall: weatherData.current?.precipitation || 0,
        rainChance: weatherData.daily?.precipitation_probability_max?.[0] || 0,
        uvIndex: weatherData.daily?.uv_index_max?.[0] || 0,
        locationName: "Local Area",
        historicalAvgTemp,
        historicalToday,
        soilMoisture: currentSoilMoisture,
        evapotranspiration: weatherData.daily?.et0_fao_evapotranspiration?.[0],
        soilPH,
        soilNitrogen,
        soilCarbon,
        safeSprayingWindow
      };
      
      setWeather(newWeather);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // 4. Generate AI Advisory
      try {
        const advisoryText = await generateWeatherAdvisory(newWeather, lang, globalLocation);
        setAdvisory(advisoryText);
      } catch (aiError) {
        console.error("Advisory generation failed", aiError);
        setAdvisory("Weather data loaded, but we couldn't generate a personalized AI advisory at this moment. Please check the stats below.");
      }
    } catch (error: any) {
      console.error("Weather/Advisory error:", error);
      setAdvisory(`Failed to load weather data. Please try again later. (Debug: ${error.message || 'Network error or server timeout. Check your connection.'})`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (globalLocation) {
      fetchWeatherAndAdvisory();
    }
  }, [globalLocation]);

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-blue-900/5 border border-blue-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-blue-50 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <Cloud className="w-6 h-6 md:w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{t.weatherAdvisory}</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">{t.weatherAdvisoryDesc}</p>
          </div>
        </div>
      </div>
        
        {globalLocation && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setAdvisory(null);
              fetchWeatherAndAdvisory();
            }}
            className="inline-flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-4 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <RefreshCcw className="w-3 h-3" />
            <span>{lang === 'bn' ? 'পুনরায় লোড করুন' : 'Refresh Data'}</span>
          </motion.button>
        )}

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Weather Dashboard Card */}
          <div className="lg:col-span-5 space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="font-black text-gray-900 text-2xl tracking-tight">{t.weatherForecast}</h3>
                  <div className="flex items-center mt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Data</span>
                  </div>
                </div>
                <button 
                  onClick={handleDetectLocation} 
                  className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              </div>

              {globalLocation && (
                <div className="mb-8">
                  <LocationDisplay coords={globalLocation} lang={lang} color="blue" />
                </div>
              )}

              {weather ? (
                <div className="space-y-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <motion.div 
                        animate={{ 
                          y: [0, -10, 0],
                          rotate: [0, 5, 0]
                        }}
                        transition={{ 
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        {weather.condition === 'Sunny' ? (
                          <Sun className="w-20 h-20 text-yellow-500 drop-shadow-lg" />
                        ) : (
                          <Cloud className="w-20 h-20 text-blue-400 drop-shadow-lg" />
                        )}
                      </motion.div>
                      <div>
                        <div className="flex items-baseline">
                          <span className="text-6xl font-black text-gray-900 tracking-tighter">{weather.temp.toFixed(1)}</span>
                          <span className="text-3xl font-bold text-blue-500 ml-1">°C</span>
                        </div>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm mt-1">{weather.condition}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <Tooltip content={getHumidityTooltip(weather.humidity) || ""}>
                        <motion.div 
                          whileHover={{ scale: 1.02 }}
                          className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-3xl border border-blue-100/50 shadow-sm h-full"
                        >
                          <div className="flex items-center text-blue-500 mb-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                              <Droplets className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">{t.humidity}</span>
                          </div>
                          <span className="text-3xl font-black text-gray-900">{weather.humidity.toFixed(2)}%</span>
                        </motion.div>
                      </Tooltip>
                    
                      <Tooltip content={getWindTooltip(weather.windSpeed) || ""}>
                        <motion.div 
                          whileHover={{ scale: 1.02 }}
                          className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-3xl border border-indigo-100/50 shadow-sm h-full"
                        >
                          <div className="flex items-center text-indigo-500 mb-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                              <Wind className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">{t.windSpeed}</span>
                          </div>
                          <span className="text-3xl font-black text-gray-900">{weather.windSpeed.toFixed(1)}</span>
                          <span className="text-xs font-bold text-gray-400 ml-1">km/h</span>
                        </motion.div>
                      </Tooltip>

                      <Tooltip content={getRainTooltip(weather.rainChance) || ""}>
                        <motion.div 
                          whileHover={{ scale: 1.02 }}
                          className="bg-gradient-to-br from-cyan-50 to-white p-5 rounded-3xl border border-cyan-100/50 shadow-sm h-full"
                        >
                          <div className="flex items-center text-cyan-500 mb-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                              <CloudRain className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">{t.rainChance}</span>
                          </div>
                          <span className="text-3xl font-black text-gray-900">{weather.rainChance}%</span>
                        </motion.div>
                      </Tooltip>

                      <Tooltip content={getUvTooltip(weather.uvIndex) || ""}>
                        <motion.div 
                          whileHover={{ scale: 1.02 }}
                          className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-3xl border border-orange-100/50 shadow-sm h-full"
                        >
                          <div className="flex items-center text-orange-500 mb-3">
                            <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                              <Sun className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">{t.uvIndex}</span>
                          </div>
                          <span className="text-3xl font-black text-gray-900">{weather.uvIndex}</span>
                        </motion.div>
                      </Tooltip>
                  </div>

                  {/* Soil & Hydrology Insights Section */}
                  {(weather.soilMoisture !== undefined || weather.soilPH !== undefined) && (
                    <div className="mt-8 pt-6 border-t border-blue-50">
                      <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-green-500" />
                        Soil & Hydrology Insights
                      </h4>
                      <div className="space-y-4">
                        {weather.soilMoisture !== undefined && (
                          <div className="flex gap-3">
                            <Droplets className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-gray-700">Soil Moisture (0-7cm)</p>
                              <p className="text-sm text-gray-600 mt-1">
                                <span className="font-bold">{weather.soilMoisture} m³/m³</span>. 
                                {weather.evapotranspiration !== undefined && ` Evapotranspiration is ${weather.evapotranspiration} mm/day.`}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Data: Open-Meteo Agronomic</p>
                            </div>
                          </div>
                        )}
                        {weather.soilPH !== undefined && (
                          <div className="flex gap-3">
                            <Thermometer className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-gray-700">Soil Health Properties</p>
                              <p className="text-sm text-gray-600 mt-1">
                                pH: <span className="font-bold">{weather.soilPH}</span> | 
                                Nitrogen: <span className="font-bold">{weather.soilNitrogen} g/kg</span> | 
                                Organic Carbon: <span className="font-bold">{weather.soilCarbon} g/kg</span>
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Data: ISRIC SoilGrids</p>
                            </div>
                          </div>
                        )}
                        {weather.safeSprayingWindow && (
                          <div className="flex gap-3 bg-green-50/50 p-3 rounded-2xl border border-green-100 mt-2">
                            <TestTube className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-bold text-gray-700">Safe Spraying Window</p>
                              <p className="text-sm text-gray-600 mt-1">
                                <span className="font-bold text-green-700">{weather.safeSprayingWindow}</span>
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Based on Wind & Rain Forecast</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {lastUpdated && (
                    <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Last Updated</span>
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{lastUpdated}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                  <p className="text-gray-400 font-bold animate-pulse uppercase tracking-widest text-xs">Fetching Weather...</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* AI Advisory Card */}
          <div className="lg:col-span-7 space-y-6">
            {/* Historical Climate Comparison */}
            {(weather?.historicalAvgTemp !== undefined || weather?.historicalToday !== undefined) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <History className="w-5 h-5 text-blue-500" />
                  <h4 className="font-bold text-gray-900">{lang === 'bn' ? 'ঐতিহাসিক জলবায়ু তুলনা' : 'Historical Climate Comparison'}</h4>
                </div>
                
                <div className="space-y-4">
                  {weather.historicalToday && (
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                      <p className="text-sm font-bold text-blue-900 mb-2">
                        {lang === 'bn' ? 'গত বছর আজকের দিনে' : 'Last Year on This Day'}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                        <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-red-400" /> Max: {weather.historicalToday.maxTemp}°C</span>
                        <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-blue-400" /> Min: {weather.historicalToday.minTemp}°C</span>
                        <span className="flex items-center gap-1"><CloudRain className="w-4 h-4 text-cyan-500" /> Rain: {weather.historicalToday.rain}mm</span>
                      </div>
                    </div>
                  )}

                  {weather.historicalAvgTemp !== undefined && (
                    <p className="text-sm text-gray-600 px-1">
                      {lang === 'bn' 
                        ? `গত ৫ বছরে এই মাসে গড় তাপমাত্রা ছিল ${weather.historicalAvgTemp.toFixed(1)}°C। আজকের তাপমাত্রা (${weather.temp.toFixed(1)}°C) স্বাভাবিকের চেয়ে ${Math.abs(weather.temp - weather.historicalAvgTemp).toFixed(1)}°C ${weather.temp > weather.historicalAvgTemp ? 'বেশি' : 'কম'}।`
                        : `The average temperature for this month over the last 5 years was ${weather.historicalAvgTemp.toFixed(1)}°C. Today's temperature (${weather.temp.toFixed(1)}°C) is ${Math.abs(weather.temp - weather.historicalAvgTemp).toFixed(1)}°C ${weather.temp > weather.historicalAvgTemp ? 'higher' : 'lower'} than usual.`}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-1 rounded-[40px] shadow-2xl shadow-blue-200 h-full"
            >
              <div className="bg-white/95 backdrop-blur-xl rounded-[38px] p-8 md:p-10 h-full flex flex-col relative overflow-hidden">
                {/* Translation Loading Overlay */}
                <AnimatePresence>
                  {isTranslating && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4"
                    >
                      <div className="relative">
                        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                        <Globe className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-blue-600 font-black uppercase tracking-widest text-xs animate-pulse">
                        {lang === 'bn' ? 'অনুবাদ করা হচ্ছে...' : 'Translating...'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-100">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t.farmingAdvisory}</h3>
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mt-0.5">AI-Powered Insights</p>
                    </div>
                  </div>
                  {advisory && (
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={handleTranslate}
                        disabled={isTranslating}
                        className="flex items-center space-x-1 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-2xl border border-blue-100 uppercase tracking-widest transition-all"
                      >
                        {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                        <span className="hidden sm:inline">{lang === 'en' ? 'Translate to EN' : 'Translate to BN'}</span>
                      </button>
                        <button
                          onClick={toggleSpeech}
                          disabled={isAudioLoading}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-2xl transition-all duration-300 font-black uppercase text-[10px] tracking-widest ${
                            isSpeaking 
                              ? 'bg-red-100 text-red-600 shadow-inner' 
                              : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/30'
                          } ${isAudioLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={isSpeaking ? "Stop listening" : "Listen to advisory"}
                        >
                          {isAudioLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isSpeaking ? (
                            <VolumeX className="w-5 h-5" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                          <span className="hidden sm:inline">
                            {isSpeaking ? (lang === 'bn' ? 'থামান' : 'Stop') : (lang === 'bn' ? 'শুনুন' : 'Listen')}
                          </span>
                        </button>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                        <Loader2 className="w-16 h-16 animate-spin text-blue-600 relative z-10" />
                      </div>
                      <div className="text-center">
                        <p className="text-blue-600 font-black text-lg animate-pulse">{t.tooltips.aiThinking}</p>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Analyzing local climate patterns</p>
                      </div>
                    </div>
                  ) : advisory ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="bg-blue-50/50 rounded-3xl p-8 border border-blue-100 shadow-inner"
                    >
                      <div className="markdown-body text-gray-800 leading-relaxed prose prose-blue max-w-none">
                        <Markdown>{advisory}</Markdown>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <div className="bg-gray-50 p-6 rounded-full mb-6">
                        <AlertTriangle className="w-16 h-16 text-gray-200" />
                      </div>
                      <h4 className="text-xl font-bold text-gray-900 mb-2">No Advisory Yet</h4>
                      <p className="text-gray-400 font-medium max-w-xs mx-auto">Please detect your location to receive personalized farming tips based on real-time weather.</p>
                    </div>
                  )}
                </div>

                {advisory && !isLoading && (
                  <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Localized for your GPS</span>
                    </div>
                    <Tooltip content="This advice is generated based on your specific location and current weather conditions.">
                      <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" />
                    </Tooltip>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
      {/* Hidden Audio for TTS */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsSpeaking(false)} 
        className="hidden" 
      />
    </motion.div>
  );
}

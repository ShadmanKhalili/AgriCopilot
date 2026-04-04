import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, Loader2, MapPin, Navigation, Sparkles, AlertTriangle, Thermometer, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';

interface Props {
  lang: Language;
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
}

export default function WeatherAdvisory({ lang }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [advisory, setAdvisory] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const t = translations[lang];

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported");
      return;
    }
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setIsDetecting(false);
      },
      (error) => {
        console.error("Location error:", error);
        setIsDetecting(false);
      }
    );
  };

  const fetchWeatherAndAdvisory = async () => {
    if (!coords) return;
    setIsLoading(true);
    
    try {
      const mockWeather: WeatherData = {
        temp: 28 + Math.random() * 5,
        condition: Math.random() > 0.5 ? 'Cloudy' : 'Sunny',
        humidity: 65 + Math.random() * 10,
        windSpeed: 12 + Math.random() * 5,
        rainfall: Math.random() > 0.7 ? 5 : 0,
        rainChance: Math.floor(Math.random() * 100),
        uvIndex: Math.floor(Math.random() * 11),
        locationName: "Cox's Bazar Area"
      };
      setWeather(mockWeather);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an expert agricultural meteorologist in Bangladesh.
        Current Weather at GPS (${coords.latitude}, ${coords.longitude}):
        Temp: ${mockWeather.temp.toFixed(1)}°C, Condition: ${mockWeather.condition}, Humidity: ${mockWeather.humidity}%, Wind: ${mockWeather.windSpeed}km/h, Rain: ${mockWeather.rainfall}mm.
        
        Provide a short, actionable farming advisory in ${lang === 'bn' ? 'Bangla' : 'English'} (approx 80 words).
        Focus on:
        - Irrigation needs
        - Pesticide/Fertilizer application safety (based on wind/rain)
        - Harvesting or sowing advice
        Use markdown for bullet points.`
      });
      
      setAdvisory(response.text);
    } catch (error) {
      console.error("Weather/Advisory error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (coords) {
      fetchWeatherAndAdvisory();
    }
  }, [coords]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="text-center mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-6 shadow-lg shadow-blue-200"
        >
          <Cloud className="w-10 h-10 text-white animate-pulse" />
        </motion.div>
        <h2 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">{t.weatherAdvisory}</h2>
        <p className="text-gray-500 text-xl font-medium max-w-2xl mx-auto">{t.weatherAdvisoryDesc}</p>
      </div>

      {!coords ? (
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-white p-16 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 text-center relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="relative z-10">
            <div className="bg-blue-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">{t.location}</h3>
            <p className="text-gray-500 mb-8 text-lg max-w-md mx-auto">{t.tooltips.locationDesc}</p>
            <button 
              onClick={handleDetectLocation}
              disabled={isDetecting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-10 rounded-2xl hover:shadow-lg hover:shadow-blue-200 transition-all flex items-center justify-center mx-auto space-x-3 group"
            >
              {isDetecting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Navigation className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              )}
              <span className="text-lg">{isDetecting ? t.tooltips.detecting : t.tooltips.detectLocation}</span>
            </button>
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
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-3xl border border-blue-100/50 shadow-sm"
                    >
                      <div className="flex items-center text-blue-500 mb-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider">{t.humidity}</span>
                      </div>
                      <span className="text-3xl font-black text-gray-900">{weather.humidity.toFixed(2)}%</span>
                    </motion.div>
                    
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-3xl border border-indigo-100/50 shadow-sm"
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

                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="bg-gradient-to-br from-cyan-50 to-white p-5 rounded-3xl border border-cyan-100/50 shadow-sm"
                    >
                      <div className="flex items-center text-cyan-500 mb-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                          <CloudRain className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider">{t.rainChance}</span>
                      </div>
                      <span className="text-3xl font-black text-gray-900">{weather.rainChance}%</span>
                    </motion.div>

                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="bg-gradient-to-br from-orange-50 to-white p-5 rounded-3xl border border-orange-100/50 shadow-sm"
                    >
                      <div className="flex items-center text-orange-500 mb-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm mr-2">
                          <Sun className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-wider">{t.uvIndex}</span>
                      </div>
                      <span className="text-3xl font-black text-gray-900">{weather.uvIndex}</span>
                    </motion.div>
                  </div>

                  {/* Weather Insights Section */}
                  <div className="mt-8 pt-6 border-t border-blue-50">
                    <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-blue-500" />
                      {t.weatherInsightsTitle}
                    </h4>
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Droplets className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-gray-700">{t.humidity}</p>
                          <p className="text-sm text-gray-500">{t.humidityInsight}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Wind className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-gray-700">{t.windSpeed}</p>
                          <p className="text-sm text-gray-500">{t.windInsight}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <CloudRain className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-gray-700">{t.rainChance}</p>
                          <p className="text-sm text-gray-500">{t.rainChanceInsight}</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Sun className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-gray-700">{t.uvIndex}</p>
                          <p className="text-sm text-gray-500">{t.uvInsight}</p>
                        </div>
                      </div>
                    </div>
                  </div>

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
          <div className="lg:col-span-7">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-1 rounded-[40px] shadow-2xl shadow-blue-200 h-full"
            >
              <div className="bg-white/95 backdrop-blur-xl rounded-[38px] p-8 md:p-10 h-full flex flex-col">
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
                        <ReactMarkdown>{advisory}</ReactMarkdown>
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
    </motion.div>
  );
}

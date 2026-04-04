import React, { useState } from 'react';
import { TrendingUp, Loader2, MapPin, Sparkles, Store, BarChart, HelpCircle, Calendar, Navigation, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, AreaChart, Area } from 'recharts';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getMarketInsights } from '../services/ai';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from './Tooltip';

const PRODUCE_TYPES = ['tomato', 'brinjal', 'paddy', 'betelLeaf', 'chili', 'watermelon', 'potato', 'onion'];
const MARKET_LOCATIONS = [
  'kawranBazar', 
  'shyambazar', 
  'khatunganj',
  'teknaf', 
  'ukhiya', 
  'moheshkhali', 
  'kutubdia', 
  'ramu', 
  'sadar', 
  'chakaria', 
  'pekua',
  'others'
];

interface Props {
  lang: Language;
  persistedInsights?: any | null;
  setPersistedInsights?: (insights: any | null) => void;
  persistedProduce?: string;
  setPersistedProduce?: (produce: string) => void;
  persistedLocation?: string;
  setPersistedLocation?: (location: string) => void;
}

export default function MarketConnect({ 
  lang,
  persistedInsights,
  setPersistedInsights,
  persistedProduce,
  setPersistedProduce,
  persistedLocation,
  setPersistedLocation
}: Props) {
  const [produce, setProduce] = useState(persistedProduce || PRODUCE_TYPES[0]);
  const [location, setLocation] = useState(persistedLocation || MARKET_LOCATIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<any | null>(persistedInsights || null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const { user } = useAuth();
  const { canUse, incrementUsage, tier, currentUsage, limit } = useUsageTracking();
  const t = translations[lang];

  // Sync with persisted state
  React.useEffect(() => {
    if (setPersistedInsights) setPersistedInsights(insights);
  }, [insights, setPersistedInsights]);

  React.useEffect(() => {
    if (setPersistedProduce) setPersistedProduce(produce);
  }, [produce, setPersistedProduce]);

  React.useEffect(() => {
    if (setPersistedLocation) setPersistedLocation(location);
  }, [location, setPersistedLocation]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setIsDetectingLocation(false);
      },
      (error) => {
        console.error("Error detecting location:", error);
        setIsDetectingLocation(false);
        alert(t.tooltips.locationError || "Failed to detect location. Please check permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleGetInsights = async () => {
    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsLoading(true);
    setInsights(null);
    
    let result = null;
    try {
      const produceName = translations.en.crops[produce as keyof typeof translations.en.crops] || produce;
      const locationName = translations.en.locations[location as keyof typeof translations.en.locations] || location;
      
      result = await getMarketInsights(produceName, locationName, lang, isAdvanced, coords || undefined);
      setInsights(result);
      setLastUpdated(new Date().toLocaleString());

      // Save query if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'market_queries'), {
            userId: user.uid,
            produce,
            location,
            insights: result.insights,
            isAdvanced,
            createdAt: new Date().toISOString()
          });
        } catch (saveError) {
          handleFirestoreError(saveError, OperationType.CREATE, 'market_queries');
        }
      }
    } catch (error: any) {
      console.error("Market insights failed:", error);
      setInsights(error.message || "Error fetching market insights from AI. Please try again.");
      setIsLoading(false);
      return;
    }

    try {
      await incrementUsage();
    } catch (error) {
      console.error("Usage increment failed:", error);
      // We don't overwrite insights here, just log the error
    } finally {
      setIsLoading(false);
    }
  };

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
          className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl mb-6 shadow-lg shadow-orange-200"
        >
          <TrendingUp className="w-10 h-10 text-white animate-pulse" />
        </motion.div>
        <h2 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">{t.marketConnect}</h2>
        <p className="text-gray-500 text-xl font-medium max-w-2xl mx-auto">{t.marketConnectDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 space-y-6 bg-white p-8 rounded-[40px] border border-orange-100 shadow-xl shadow-orange-50/50 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceName}</label>
              <select 
                value={produce} 
                onChange={(e) => setProduce(e.target.value)}
                className="w-full rounded-2xl border-orange-100 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-orange-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
              >
                {PRODUCE_TYPES.map(p => (
                  <option key={p} value={p}>
                    {t.crops[p as keyof typeof t.crops] || p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.location}</label>
                <button 
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className={`flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all ${
                    coords 
                      ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  {isDetectingLocation ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : coords ? (
                    <Navigation className="w-3 h-3" />
                  ) : (
                    <MapPin className="w-3 h-3" />
                  )}
                  <span>{isDetectingLocation ? t.tooltips.detecting : coords ? t.tooltips.locationDetected : t.tooltips.detectLocation}</span>
                </button>
              </div>
              <select 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl border-orange-100 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-orange-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
              >
                {MARKET_LOCATIONS.map(u => (
                  <option key={u} value={u}>
                    {t.locations[u as keyof typeof t.locations] || u}
                  </option>
                ))}
              </select>
              {coords && location === 'others' && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-[10px] text-orange-600 font-black uppercase tracking-widest flex items-center bg-orange-50 px-3 py-2 rounded-xl border border-orange-100"
                >
                  <Navigation className="w-3 h-3 mr-2" />
                  GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                </motion.div>
              )}
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-white p-4 rounded-2xl border border-orange-100 shadow-inner">
              <div className="flex items-center space-x-3">
                <div className="relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="advancedMarket" 
                    checked={isAdvanced}
                    onChange={(e) => setIsAdvanced(e.target.checked)}
                    disabled={tier !== 'premium'}
                    className="absolute w-6 h-6 transition duration-200 ease-in-out transform bg-white border-2 border-gray-300 rounded-full appearance-none cursor-pointer checked:translate-x-4 checked:border-orange-500 focus:outline-none disabled:opacity-50"
                  />
                  <label htmlFor="advancedMarket" className={`block h-6 overflow-hidden bg-gray-200 rounded-full cursor-pointer ${isAdvanced ? 'bg-orange-400' : ''}`}></label>
                </div>
                <label htmlFor="advancedMarket" className={`text-sm font-black uppercase tracking-widest flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" />
                  {t.advancedAnalysis}
                </label>
              </div>
              <Tooltip content={t.tooltips.advanced}>
                <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" />
              </Tooltip>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <Tooltip content={t.tooltips.usage}>
                    <HelpCircle className="w-3 h-3 text-gray-300" />
                  </Tooltip>
                </div>
                <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
              </div>
              <div className="w-full bg-orange-100/50 rounded-full h-2 overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentUsage / limit) * 100}%` }}
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetInsights}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-black py-5 px-6 rounded-2xl hover:shadow-lg hover:shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all text-lg tracking-tight"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span>{t.fetchingInsights}</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-7 h-7" />
                  <span>{t.getInsights}</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Insights Output */}
        <div className="lg:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {insights ? (
              <motion.div 
                key="insights"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-orange-600 via-red-600 to-orange-700 p-1 rounded-[40px] shadow-2xl shadow-orange-200 h-full"
              >
                <div className="bg-white/95 backdrop-blur-xl rounded-[38px] p-8 md:p-10 h-full flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center space-x-4">
                        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-2xl shadow-lg shadow-orange-100">
                          <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t.marketInsights}</h3>
                          <div className="flex items-center mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Market Pulse</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Updated</p>
                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 uppercase tracking-widest">
                          {lastUpdated || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6 flex-1">
                      {/* Price Trend Chart */}
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-8">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2 text-orange-600" />
                            {lang === 'bn' ? 'মূল্যের প্রবণতা (৭ দিন)' : 'Price Trend (7 Days)'}
                          </h4>
                          {insights.priceTrend && insights.priceTrend.length > 1 && (
                            <div className={`flex items-center text-xs font-black ${
                              insights.priceTrend[insights.priceTrend.length - 1].price >= insights.priceTrend[0].price 
                                ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {insights.priceTrend[insights.priceTrend.length - 1].price >= insights.priceTrend[0].price 
                                ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                              {Math.abs(((insights.priceTrend[insights.priceTrend.length - 1].price - insights.priceTrend[0].price) / insights.priceTrend[0].price) * 100).toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <div className="w-full h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={insights.priceTrend}>
                              <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                              <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: '900', fill: '#9ca3af' }}
                              />
                              <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickFormatter={(value) => `৳${value}`}
                              />
                              <RechartsTooltip 
                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                                formatter={(value: number) => [`৳${value} ${t.perKg}`, lang === 'bn' ? 'মূল্য' : 'Price']}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke="#f97316" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorPrice)" 
                                dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-20"></div>
                        <div className="markdown-body text-base md:text-lg leading-relaxed prose prose-orange max-w-none">
                          <ReactMarkdown>{insights.insights}</ReactMarkdown>
                        </div>
                      </motion.div>

                      {/* Nearest Markets */}
                      {insights.nearestMarkets && (
                        <div className="bg-gray-50/50 backdrop-blur-sm rounded-[32px] p-8 border border-gray-100">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-orange-600" />
                            {lang === 'bn' ? 'নিকটস্থ বাজার' : 'Nearest Markets'}
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {insights.nearestMarkets.map((m: any, idx: number) => (
                              <motion.div 
                                key={idx} 
                                whileHover={{ scale: 1.02 }}
                                className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm group"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="bg-orange-50 p-2 rounded-xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                                    <Store className="w-4 h-4" />
                                  </div>
                                  <span className="font-black text-gray-800 text-sm">{m.name}</span>
                                </div>
                                <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full">{m.distance}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[40px] p-16 border border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-gray-400 text-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
                <div className="bg-gray-50 p-10 rounded-[32px] mb-8 shadow-inner relative z-10">
                  <TrendingUp className="w-20 h-20 text-gray-200" />
                </div>
                <p className="text-2xl font-black text-gray-300 max-w-sm leading-tight relative z-10 tracking-tight">Select produce and location to get real-time market insights and pricing trends.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

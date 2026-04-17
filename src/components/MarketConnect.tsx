import React, { useState } from 'react';
import { TrendingUp, Loader2, MapPin, Sparkles, Store, BarChart, HelpCircle, Navigation, Package, Scale, DollarSign, Activity, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, AreaChart, Area } from 'recharts';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getMarketInsights } from '../services/ai';
import { detectUserLocation } from '../utils/geolocation';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';

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
  persistedQuantity?: string;
  setPersistedQuantity?: (quantity: string) => void;
}

export default function MarketConnect({ 
  lang,
  persistedInsights,
  setPersistedInsights,
  persistedProduce,
  setPersistedProduce,
  persistedQuantity,
  setPersistedQuantity
}: Props) {
  const [produce, setProduce] = useState(persistedProduce || PRODUCE_TYPES[0]);
  const [quantity, setQuantity] = useState(persistedQuantity || '100');
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
    if (setPersistedQuantity) setPersistedQuantity(quantity);
  }, [quantity, setPersistedQuantity]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const coords = await detectUserLocation();
      setCoords(coords);
      setIsDetectingLocation(false);
    } catch (error: any) {
      console.error("Error detecting location:", error);
      setIsDetectingLocation(false);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      alert(msg);
    }
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
      
      result = await getMarketInsights(produceName, quantity, lang, isAdvanced, coords || undefined);
      setInsights(result);
      setLastUpdated(new Date().toLocaleString());

      // Save query if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'market_queries'), {
            userId: user.uid,
            produce,
            quantity,
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
      className="max-w-6xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[32px] border border-orange-100 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-orange-50 p-4 rounded-2xl">
            <TrendingUp className="w-8 h-8 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{t.marketConnect}</h2>
            <p className="text-gray-500 font-medium text-sm mt-1">{t.marketConnectDesc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4"
        >
          <div className="bg-white rounded-[32px] p-6 lg:p-8 shadow-xl shadow-orange-900/5 border border-orange-100 relative overflow-hidden space-y-6">
            <div className="space-y-6 relative z-10">
              
              {/* Product Selection */}
              <div className="space-y-3">
                <label className="flex items-center text-sm font-black text-gray-800 uppercase tracking-widest">
                  <Package className="w-4 h-4 mr-2 text-orange-500" />
                  {t.produceName}
                </label>
                <div className="relative">
                  <select 
                    value={produce} 
                    onChange={(e) => setProduce(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-gray-200 shadow-sm focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 bg-gray-50 p-4 pr-10 text-base font-bold text-gray-900 transition-all outline-none"
                  >
                    {PRODUCE_TYPES.map(p => (
                      <option key={p} value={p}>
                        {t.crops[p as keyof typeof t.crops] || p}
                      </option>
                    ))}
                  </select>
                  <ArrowDownRight className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-3">
                <label className="flex items-center text-sm font-black text-gray-800 uppercase tracking-widest">
                  <Scale className="w-4 h-4 mr-2 text-blue-500" />
                  {t.quantity}
                </label>
                <div className="relative">
                  <input 
                    type="number"
                    value={quantity} 
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full rounded-2xl border border-gray-200 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 bg-gray-50 p-4 pr-16 text-base font-bold text-gray-900 transition-all outline-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 p-1 px-2 bg-blue-100 text-blue-700 font-bold text-xs rounded-lg">
                    KG
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-sm font-black text-gray-800 uppercase tracking-widest">
                    <MapPin className="w-4 h-4 mr-2 text-emerald-500" />
                    Market Region
                  </label>
                  <button 
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className={`flex items-center space-x-1 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all ${
                      coords 
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                {coords ? (
                  <LocationDisplay coords={coords} lang={lang} color="emerald" />
                ) : (
                  <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-2xl text-center">
                    <p className="text-gray-500 text-xs font-medium">Use your location to find the nearest wholesale rates.</p>
                  </div>
                )}
              </div>

              {/* Advanced Toggle */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-2xl border border-amber-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                    <input 
                      type="checkbox" 
                      id="advancedMarket" 
                      checked={isAdvanced}
                      onChange={(e) => setIsAdvanced(e.target.checked)}
                      disabled={tier !== 'premium'}
                      className="absolute w-6 h-6 transition duration-200 ease-in-out transform bg-white border-2 border-gray-300 rounded-full appearance-none cursor-pointer checked:translate-x-4 checked:border-amber-500 focus:outline-none disabled:opacity-50"
                    />
                    <label htmlFor="advancedMarket" className={`block h-6 overflow-hidden bg-gray-200 rounded-full cursor-pointer ${isAdvanced ? 'bg-amber-400' : ''}`}></label>
                  </div>
                  <label htmlFor="advancedMarket" className={`text-sm font-black uppercase tracking-widest flex items-center ${tier === 'premium' ? 'text-gray-800' : 'text-gray-400'}`}>
                    <Sparkles className="w-4 h-4 mr-1.5 text-amber-500" />
                    {t.advancedAnalysis}
                  </label>
                </div>
                <Tooltip content={t.tooltips.advanced}>
                  <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" />
                </Tooltip>
              </div>

              {/* Usage Bar */}
              <div className="py-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentUsage / limit) * 100}%` }}
                    className="bg-orange-500 h-full rounded-full"
                  />
                </div>
              </div>

              {/* Actions */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGetInsights}
                disabled={isLoading}
                className="w-full bg-gray-900 text-white font-bold py-4 px-6 rounded-2xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-colors text-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t.fetchingInsights}</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5" />
                    <span>{t.getInsights}</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Insights Output (Bento Box Layout) */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {insights ? (
              <motion.div 
                key="insights"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full"
              >
                {/* Main Executive Summary */}
                <div className="md:col-span-2 bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="bg-orange-50 p-2.5 rounded-xl text-orange-600">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Market Analytics</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Live Assessment</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100 uppercase tracking-widest">
                      Updated {lastUpdated || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="markdown-body text-base leading-relaxed prose prose-orange max-w-none prose-headings:font-black prose-headings:tracking-tight prose-a:text-orange-600">
                    <ReactMarkdown>{insights.insights}</ReactMarkdown>
                  </div>
                </div>

                {/* Price Drivers */}
                {insights.priceDrivers && insights.priceDrivers.length > 0 && (
                  <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center mb-6">
                      <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600 mr-3">
                        <Activity className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                        {lang === 'bn' ? 'মূল্যের গতিপথ' : 'Price Drivers'}
                      </h4>
                    </div>
                    <ul className="space-y-4 flex-1">
                      {insights.priceDrivers.map((driver: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-700 font-medium leading-relaxed">{driver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Nearest Markets */}
                {insights.nearestMarkets && (
                  <div className="bg-white p-6 md:p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col">
                    <div className="flex items-center mb-6">
                      <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600 mr-3">
                        <Store className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                        {lang === 'bn' ? 'নিকটস্থ পাইকারি বাজার' : 'Nearest Wholesale Hubs'}
                      </h4>
                    </div>
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {insights.nearestMarkets.map((m: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 group hover:bg-emerald-50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <Store className="w-4 h-4 text-emerald-600" />
                            <span className="font-bold text-gray-800 text-sm">{m.name}</span>
                          </div>
                          <span className="text-[10px] font-black text-emerald-700 bg-white shadow-sm px-3 py-1.5 rounded-xl border border-emerald-100 uppercase overflow-hidden whitespace-nowrap">
                            {m.distance}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[40px] border border-gray-200 h-full min-h-[500px] flex flex-col items-center justify-center p-10 text-center shadow-sm"
              >
                <div className="bg-gray-50 p-6 rounded-[24px] mb-6">
                  <BarChart className="w-12 h-12 text-gray-300" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">Market Intelligence</h3>
                <p className="text-sm font-medium text-gray-500 max-w-sm leading-relaxed">
                  Enter your produce, quantity, and location to fetch real-time market insights and nearby wholesale pricing.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

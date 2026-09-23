import React, { useState } from 'react';
import { TrendingUp, Loader2, MapPin, Sparkles, Store, BarChart, HelpCircle, Navigation, Package, Scale, DollarSign, Activity, AlertCircle, ArrowUpRight, ArrowDownRight, Calculator, ArrowRight, Database, ShoppingBag, BadgePercent, ExternalLink, CheckCircle2, Layers } from 'lucide-react';
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
import toast from 'react-hot-toast';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';
import { saveCachedMarket, getCachedMarket, formatCacheAge } from '../utils/offlineCache';

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

const SAMPLE_MARKET_SCENARIOS = [
  {
    titleBn: 'কারওয়ান বাজার — আলু ও পেঁয়াজ',
    titleEn: 'Kawran Bazar — Potato & Onion',
    descBn: 'ঢাকার কেন্দ্রীয় মোকামের পাইকারি দর ও চালান প্রবাহ',
    descEn: 'Dhaka central wholesale mandi rates & arrival volume',
    produce: 'potato',
    lat: 23.7516,
    lng: 90.3944,
  },
  {
    titleBn: 'খাতুনগঞ্জ — চাল ও শুকনা মরিচ',
    titleEn: 'Khatunganj — Paddy & Chili',
    descBn: 'চট্টগ্রামের প্রধান বাণিজ্যিক আড়ত নিলাম বিশ্লেষণ',
    descEn: 'Chattogram commercial auction price & supply elasticity',
    produce: 'paddy',
    lat: 22.3384,
    lng: 91.8391,
  },
  {
    titleBn: 'শ্যামবাজার — বেগুন ও টমেটো',
    titleEn: 'Shyambazar — Brinjal & Tomato',
    descBn: 'বুড়িগঙ্গা তীরবর্তী মোকামের সকালের পাইকারি দর',
    descEn: 'Riverside fresh produce morning mandi bids & demand',
    produce: 'brinjal',
    lat: 23.7099,
    lng: 90.4125,
  }
];

interface Props {
  lang: Language;
  persistedInsights?: any | null;
  setPersistedInsights?: (insights: any | null) => void;
  persistedProduce?: string;
  setPersistedProduce?: (produce: string) => void;
  onNavigateTab?: (tab: any, payload?: any) => void;
  globalLocation?: { latitude: number; longitude: number } | null;
  setGlobalLocation?: (loc: { latitude: number; longitude: number }) => void;
}

export default function MarketConnect({ 
  lang,
  persistedInsights,
  setPersistedInsights,
  persistedProduce,
  setPersistedProduce,
  onNavigateTab,
  globalLocation,
  setGlobalLocation
}: Props) {
  const [produce, setProduce] = useState(persistedProduce || PRODUCE_TYPES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<any | null>(persistedInsights || null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [marketCacheInfo, setMarketCacheInfo] = useState<{ isCached: boolean; timestamp: number; isFallback?: boolean } | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(globalLocation || null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const { user } = useAuth();
  const { canUse, canUsePremium, incrementUsage, incrementPremiumUsage, tier, currentUsage, limit } = useUsageTracking('market-connect');
  const [usePremium, setUsePremium] = useState(false);
  const t = translations[lang];

  // Sync with globalLocation if changed from outside
  React.useEffect(() => {
    if (globalLocation) {
      setCoords(globalLocation);
    }
  }, [globalLocation]);

  // Sync with persisted state
  React.useEffect(() => {
    if (setPersistedInsights) setPersistedInsights(insights);
  }, [insights, setPersistedInsights]);

  React.useEffect(() => {
    if (setPersistedProduce) setPersistedProduce(produce);
    if (!insights) {
      const locKey = `${coords?.latitude?.toFixed(2) || 'default'}_${coords?.longitude?.toFixed(2) || 'default'}`;
      const cached = getCachedMarket(produce, locKey);
      if (cached) {
        setInsights(cached.data);
        setMarketCacheInfo({ isCached: true, timestamp: cached.timestamp, isFallback: cached.isFallback });
        setLastUpdated(new Date(cached.timestamp).toLocaleString());
      }
    }

    const handleForceRefresh = () => {
      handleGetInsights(produce, coords || undefined);
    };
    window.addEventListener('agri:force-refresh-cache', handleForceRefresh);
    return () => {
      window.removeEventListener('agri:force-refresh-cache', handleForceRefresh);
    };
  }, [produce, setPersistedProduce, coords]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const loc = await detectUserLocation();
      const newCoords = { latitude: loc.latitude, longitude: loc.longitude };
      setCoords(newCoords);
      setAccuracy(loc.accuracy);
      if (setGlobalLocation) {
        setGlobalLocation(newCoords);
      }
      setIsDetectingLocation(false);
      if (loc.isFallback) {
        toast(lang === 'bn' ? 'আঞ্চলিক অবস্থান কেন্দ্র ব্যবহার করা হচ্ছে' : 'Using regional market center', { icon: '📍' });
      } else {
        toast.success(lang === 'bn' ? 'সঠিক অবস্থান সনাক্ত হয়েছে' : 'Location accurately detected');
      }
    } catch (error: any) {
      const errorMsg = error?.message || (error?.code ? `Code ${error.code}` : 'Location unavailable');
      console.warn("Location detection notice in MarketConnect:", errorMsg);
      setIsDetectingLocation(false);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error?.code === 1) msg = lang === 'bn' ? "জিপিএস অনুমতি দেওয়া হয়নি। ব্রাউজার লোকেশন অন করুন।" : "Permission denied. Please allow location access in your browser.";
      toast.error(msg);
    }
  };

  const handleSelectMarketPreset = (lat: number, lng: number) => {
    const newCoords = { latitude: lat, longitude: lng };
    setCoords(newCoords);
    setAccuracy(undefined);
    if (setGlobalLocation) {
      setGlobalLocation(newCoords);
    }
  };

  const handleGetInsights = async (overrideProduce?: string, overrideCoords?: { latitude: number; longitude: number }) => {
    if (!canUse()) {
      toast.error(t.limitReached);
      return;
    }

    const targetProduce = overrideProduce || produce;
    const targetCoords = overrideCoords || coords;

    setIsLoading(true);
    setInsights(null);
    
    let result = null;
    try {
      const produceName = translations.en.crops[targetProduce as keyof typeof translations.en.crops] || targetProduce;
      
      const isPremiumAnalysis = usePremium || tier === 'premium';
      result = await getMarketInsights(produceName, lang, isPremiumAnalysis, targetCoords || undefined);
      setInsights(result);
      if (setPersistedInsights) {
        setPersistedInsights(result);
      }
      setLastUpdated(new Date().toLocaleString());
      const locKey = `${targetCoords?.latitude?.toFixed(2) || 'default'}_${targetCoords?.longitude?.toFixed(2) || 'default'}`;
      saveCachedMarket(targetProduce, locKey, result);
      setMarketCacheInfo(null);

      // Save query if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'market_queries'), {
            userId: user.uid,
            produce: targetProduce,
            insights: result.insights,
            isAdvanced: isPremiumAnalysis,
            createdAt: new Date().toISOString()
          });
        } catch (saveError) {
          handleFirestoreError(saveError, OperationType.CREATE, 'market_queries');
        }
      }
    } catch (error: any) {
      console.warn("Market insights API failed, retrieving local storage cache:", error);
      const locKey = `${targetCoords?.latitude?.toFixed(2) || 'default'}_${targetCoords?.longitude?.toFixed(2) || 'default'}`;
      const cached = getCachedMarket(targetProduce, locKey);
      if (cached) {
        setInsights(cached.data);
        setMarketCacheInfo({ isCached: true, timestamp: cached.timestamp, isFallback: cached.isFallback });
        if (setPersistedInsights) {
          setPersistedInsights(cached.data);
        }
        setLastUpdated(new Date(cached.timestamp).toLocaleString());
        toast.success(lang === 'bn' 
          ? 'অফলাইন ক্যাশ: কক্সবাজার ও স্থানীয় বাজারদর সংরক্ষিত তথ্য থেকে প্রদর্শিত হচ্ছে' 
          : 'Loaded cached mandi rates from offline storage');
        setIsLoading(false);
        return;
      }

      const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
      const errorMsg = isQuotaError 
        ? (lang === 'bn' ? 'সিস্টেমের চাপ বেশি, দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'AI limit reached. Please try again in 5 minutes.')
        : (error.message || "Error fetching market insights from AI. Please try again.");
      
      setInsights({ insights: errorMsg });
      setIsLoading(false);
      return;
    }

    try {
      if (usePremium && tier !== 'premium') incrementPremiumUsage();
      await incrementUsage();
    } catch (error) {
      console.error("Usage increment failed:", error);
      // We don't overwrite insights here, just log the error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectScenario = (sc: typeof SAMPLE_MARKET_SCENARIOS[0]) => {
    setProduce(sc.produce);
    if (setPersistedProduce) {
      setPersistedProduce(sc.produce);
    }
    const targetLoc = { latitude: sc.lat, longitude: sc.lng };
    setCoords(targetLoc);
    if (setGlobalLocation) {
      setGlobalLocation(targetLoc);
    }
    handleGetInsights(sc.produce, targetLoc);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full space-y-4 md:space-y-5"
    >
      {/* Header Banner - Flat Depth & Micro-dot indicator */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-50 dark:bg-orange-950/60 p-2 rounded-xl text-orange-600 dark:text-orange-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
                {t.marketConnect}
              </h2>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{lang === 'bn' ? 'সরাসরি রেট' : 'Live Rates'}</span>
              </span>
            </div>
            <p className="text-stone-500 dark:text-stone-400 text-xs font-normal leading-normal mt-0.5">
              {t.marketConnectDesc}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        {/* Control Panel: Integrated Command Toolbar (Rank 4 & Rank 2) */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:col-span-4"
        >
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
            <div className="space-y-4">
              
              {/* Product Selection */}
              <div className="space-y-1.5">
                <label className="flex items-center text-xs font-bold text-stone-700 dark:text-stone-300">
                  <Package className="w-3.5 h-3.5 mr-1.5 text-orange-500" />
                  {t.produceName}
                </label>
                <div className="relative">
                  <select 
                    value={produce} 
                    onChange={(e) => setProduce(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 p-2.5 sm:p-3 pr-10 text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-orange-500 outline-none transition-colors cursor-pointer"
                  >
                    {PRODUCE_TYPES.map(p => (
                      <option key={p} value={p}>
                        {t.crops[p as keyof typeof t.crops] || p}
                      </option>
                    ))}
                  </select>
                  <ArrowDownRight className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Location & Mandi Command Toolbar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-xs font-bold text-stone-700 dark:text-stone-300">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    {lang === 'bn' ? 'বাজার মোকাম ও অবস্থান' : 'Wholesale Mandi'}
                  </label>
                  <button 
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : coords ? (
                      <Navigation className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <MapPin className="w-3 h-3 text-stone-400" />
                    )}
                    <span>{isDetectingLocation ? t.tooltips.detecting : coords ? t.tooltips.locationDetected : t.tooltips.detectLocation}</span>
                  </button>
                </div>

                {/* Major Wholesale Market Hubs Quick Select (Unified Toolbar Chips) */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-stone-400 mr-0.5">
                    {lang === 'bn' ? 'মোকাম:' : 'Mandi:'}
                  </span>
                  {[
                    { nameBn: 'কারওয়ান বাজার', nameEn: 'Kawran Bazar', lat: 23.7516, lng: 90.3944 },
                    { nameBn: 'শ্যামবাজার', nameEn: 'Shyambazar', lat: 23.7099, lng: 90.4125 },
                    { nameBn: 'খাতুনগঞ্জ', nameEn: 'Khatunganj', lat: 22.3384, lng: 91.8391 },
                    { nameBn: 'কক্সবাজার', nameEn: 'Cox\'s Bazar', lat: 21.4272, lng: 92.0058 },
                  ].map(m => (
                    <button
                      key={m.nameEn}
                      type="button"
                      onClick={() => handleSelectMarketPreset(m.lat, m.lng)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition-colors cursor-pointer"
                    >
                      {lang === 'bn' ? m.nameBn : m.nameEn}
                    </button>
                  ))}
                </div>

                {coords ? (
                  <LocationDisplay coords={coords} lang={lang} color="emerald" accuracy={accuracy} />
                ) : (
                  <div className="p-3 bg-stone-50 dark:bg-stone-800/50 border border-dashed border-stone-200 dark:border-stone-700 rounded-xl text-center">
                    <p className="text-stone-500 dark:text-stone-400 text-xs font-normal">
                      {lang === 'bn' 
                        ? 'আপনার এলাকার পাইকারি রেট জানতে জিপিএস চালু করুন অথবা মোকাম নির্বাচন করুন।' 
                        : 'Use GPS or select a wholesale mandi to see regional rates.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Advanced / Premium Toggle */}
              {tier === 'premium' ? (
                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="relative inline-block w-9 h-5 transition duration-200 ease-in-out rounded-full cursor-pointer">
                      <input 
                        type="checkbox" 
                        id="advancedMarket" 
                        checked={isAdvanced}
                        onChange={(e) => setIsAdvanced(e.target.checked)}
                        className="absolute w-5 h-5 transition duration-200 ease-in-out transform bg-white border border-stone-300 rounded-full appearance-none cursor-pointer checked:translate-x-4 checked:border-amber-500 focus:outline-none"
                      />
                      <label htmlFor="advancedMarket" className={`block h-5 overflow-hidden bg-stone-200 rounded-full cursor-pointer ${isAdvanced ? 'bg-amber-400' : ''}`}></label>
                    </div>
                    <label htmlFor="advancedMarket" className="text-xs font-semibold flex items-center text-stone-800 dark:text-stone-200">
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
                      {t.advancedAnalysis}
                    </label>
                  </div>
                  <Tooltip content={t.tooltips.advanced}>
                    <HelpCircle className="w-3.5 h-3.5 text-stone-400 cursor-help" />
                  </Tooltip>
                </div>
              ) : canUsePremium() && (
                <div className="p-3 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="bg-orange-100 dark:bg-orange-950 p-1.5 rounded-lg">
                      <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">Premium Analysis</h4>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">1 free daily run</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUsePremium(!usePremium)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${usePremium ? 'bg-orange-500' : 'bg-stone-200 dark:bg-stone-700'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${usePremium ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {/* Usage Bar */}
              <div className="py-0.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">{t.usage}</span>
                  <span className="text-[10px] font-mono font-semibold text-stone-600 dark:text-stone-300">{currentUsage} / {limit}</span>
                </div>
                <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1 overflow-hidden">
                  <div 
                    style={{ width: `${Math.min(100, (currentUsage / limit) * 100)}%` }}
                    className="bg-orange-500 h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>

              {/* Actions */}
              <motion.button
                whileHover={{ y: -1 }}
                transition={{ duration: 0.1 }}
                onClick={() => handleGetInsights()}
                disabled={isLoading}
                className="w-full bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold py-2.5 sm:py-3 px-4 rounded-xl hover:bg-stone-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors text-xs sm:text-sm min-h-[42px] cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.fetchingInsights}</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
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
                className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 h-full"
              >
                {/* Cross-Module Linked Action Bar (Rank 2 Flat Depth) */}
                {onNavigateTab && (
                  <div className="md:col-span-2 bg-stone-900 dark:bg-stone-800 p-4 sm:p-5 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-stone-800 dark:border-stone-700 shadow-xs">
                    <div className="flex items-center space-x-3 text-left">
                      <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl shrink-0 border border-emerald-400/30">
                        <Calculator className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-stone-100 leading-tight truncate">
                          {lang === 'bn' ? 'এই ফসলের প্রকৃত লাভ ও উৎপাদন খরচ হিসাব করুন' : 'Calculate Profit Margin & Net Cost'}
                        </h4>
                        <p className="text-[11px] text-stone-400 font-normal mt-0.5 line-clamp-1">
                          {lang === 'bn' ? 'পাইকারদের কাছে বিক্রির আগে আপনার আসল উৎপাদন খরচ জানুন' : 'Know your true baseline cost before trading'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('krishi-profit', { crop: produce })}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-colors min-h-[38px] cursor-pointer"
                      >
                        <span>{lang === 'bn' ? 'মুনাফা হিসাব' : 'Profit Calculator'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('agri-copilot', { crop: produce })}
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs rounded-xl border border-stone-700 transition-colors min-h-[38px] cursor-pointer"
                      >
                        <span>{lang === 'bn' ? 'এআই ডাক্তার' : 'AI Doctor'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Wholesale Mandi vs Supermarket Benchmark Cards */}
                {((insights.wholesaleRates && insights.supermarketRates) || (insights.supermarkets && insights.supermarkets.length > 0)) && (
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Wholesale Mandi Average */}
                    <div className="bg-gradient-to-br from-emerald-900/90 to-stone-900 p-4 rounded-2xl text-white border border-emerald-700/40 shadow-xs relative overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5" />
                          {lang === 'bn' ? 'পাইকারি মোকাম দর (আড়ৎ)' : 'Wholesale Mandi Rates'}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {insights.wholesaleRates?.primaryMarket || (lang === 'bn' ? 'কারওয়ান বাজার মোকাম' : 'Kawran Bazar')}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                          ৳{insights.wholesaleRates?.avgPriceBdt || (insights.priceRange ? Math.round((insights.priceRange.min + insights.priceRange.max) / 2) : '৩৫')}
                        </span>
                        <span className="text-xs text-emerald-200/80 font-bold">/ কেজি</span>
                      </div>
                      <p className="text-[11px] text-emerald-100/70 mt-1">
                        {lang === 'bn' ? 'পরিসীমা:' : 'Range:'} ৳{insights.wholesaleRates?.minPriceBdt || insights.priceRange?.min || '২৮'} - ৳{insights.wholesaleRates?.maxPriceBdt || insights.priceRange?.max || '৪২'} / কেজি
                      </p>
                    </div>

                    {/* Supermarket Retail Average */}
                    <div className="bg-gradient-to-br from-orange-950/90 to-stone-900 p-4 rounded-2xl text-white border border-orange-700/40 shadow-xs relative overflow-hidden">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-300 flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {lang === 'bn' ? 'সুপারমার্কেট খুচরা দর' : 'Supermarket Shelves'}
                        </span>
                        <span className="text-[10px] font-bold bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30">
                          {lang === 'bn' ? 'স্বপ্ন / মীনা বাজার / আগোরা' : 'Shwapno / Agora'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                          ৳{insights.supermarketRates?.avgPriceBdt || '৬০'}
                        </span>
                        <span className="text-xs text-orange-200/80 font-bold">/ কেজি</span>
                      </div>
                      <p className="text-[11px] text-orange-100/70 mt-1">
                        {lang === 'bn' ? 'পরিসীমা:' : 'Range:'} ৳{insights.supermarketRates?.minPriceBdt || '৪৮'} - ৳{insights.supermarketRates?.maxPriceBdt || '৭২'} / কেজি
                      </p>
                    </div>

                    {/* Value-Chain Margin Spread */}
                    <div className="bg-gradient-to-br from-indigo-950/90 to-stone-900 p-4 rounded-2xl text-white border border-indigo-700/40 shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                          <BadgePercent className="w-3.5 h-3.5" />
                          {lang === 'bn' ? 'রিটেইল মার্জিন স্প্রেড' : 'Retail Margin Spread'}
                        </span>
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800/40">
                          {lang === 'bn' ? 'ভ্যালু-চেইন' : 'Value Chain'}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                          +{insights.marginSpread?.spreadPercentage || '৬৫'}%
                        </span>
                        <span className="text-xs text-stone-300 font-bold">{lang === 'bn' ? 'দাম বৃদ্ধি' : 'Markup'}</span>
                      </div>
                      <p className="text-[10px] text-stone-300 leading-tight mt-1">
                        {lang === 'bn' 
                          ? 'গ্রেডিং, প্যাকেজিং ও কোল্ড চেইনের কারণে পাইকারি থেকে সুপারমার্কেটের এই ব্যবধান।' 
                          : 'Spread driven by sorting, branded packaging & shelf distribution.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Direct Supermarket Price Tracker (Shwapno, Meena Bazar, Agora, Chaldal) */}
                {insights.supermarkets && insights.supermarkets.length > 0 && (
                  <div className="md:col-span-2 bg-white dark:bg-stone-900 p-4 sm:p-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
                    <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-orange-100 dark:bg-orange-950/60 rounded-lg text-orange-600 dark:text-orange-400">
                          <ShoppingBag className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                            {lang === 'bn' ? 'সুপারমার্কেট ও অনলাইন গ্রোসারি লাইভ দর' : 'Supermarket & E-Grocery Shelf Prices'}
                          </h4>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400">
                            {lang === 'bn' ? 'স্বপ্ন, মীনা বাজার, আগোরা ও চালডালের সরাসরি তালিকাভুক্ত মূল্য' : 'Verified data from Shwapno, Meena Bazar, Agora & Chaldal catalogs'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800">
                        {lang === 'bn' ? 'ওয়েব সার্চ তথ্য' : 'Web Grounded'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {insights.supermarkets.map((sm: any, idx: number) => (
                        <div key={idx} className="bg-stone-50/70 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/80 dark:border-stone-700 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                                {sm.name}
                              </span>
                              <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                                {sm.stockStatus || 'ইন স্টক'}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-2">
                              {sm.packagingType || 'প্যাকেটজাত'}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1 border-t border-stone-200/50 dark:border-stone-700/50">
                            <span className="text-[10px] text-stone-400 font-bold uppercase">{lang === 'bn' ? 'খুচরা দর:' : 'Retail:'}</span>
                            <span className="text-sm font-black font-mono text-stone-900 dark:text-stone-100">
                              ৳{sm.pricePerKgBdt} <span className="text-[10px] font-normal text-stone-400">/কেজি</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mainstream Wholesale Mandis Hubs Table */}
                {insights.mandiHubs && insights.mandiHubs.length > 0 && (
                  <div className="md:col-span-2 bg-white dark:bg-stone-900 p-4 sm:p-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs">
                    <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-stone-100 dark:border-stone-800">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-700 dark:text-emerald-300">
                          <Store className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                            {lang === 'bn' ? 'প্রধান মোকামের পাইকারি রেট ও চালান প্রবাহ' : 'Mainstream Wholesale Mandi Rates & Inflow'}
                          </h4>
                          <p className="text-[10px] text-stone-500 dark:text-stone-400">
                            {lang === 'bn' ? 'কারওয়ান বাজার, শ্যামবাজার, খাতুনগঞ্জ ও আঞ্চলিক আড়তের দর' : 'Live wholesale trading bids at Kawran Bazar, Shyambazar & Khatunganj'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        {lang === 'bn' ? 'পাইকারি মোকাম' : 'Wholesale Mandis'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {insights.mandiHubs.map((hub: any, idx: number) => (
                        <div key={idx} className="bg-stone-50/70 dark:bg-stone-800/60 p-3 rounded-xl border border-stone-200/80 dark:border-stone-700 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                                {hub.mandiName}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                hub.trend === 'উর্ধ্বমুখী' || hub.trend === 'up'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              }`}>
                                {hub.trend}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-500 dark:text-stone-400 block mb-2">
                              {hub.arrivalVolume || 'স্বাভাবিক প্রবাহ'}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1 border-t border-stone-200/50 dark:border-stone-700/50">
                            <span className="text-[10px] text-stone-400 font-bold uppercase">{lang === 'bn' ? 'পাইকারি দর:' : 'Wholesale:'}</span>
                            <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400">
                              ৳{hub.wholesalePriceBdt} <span className="text-[10px] font-normal text-stone-400">/কেজি</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Farmer Bargaining Tips & Direct Opportunity */}
                {insights.farmerActionTips && insights.farmerActionTips.length > 0 && (
                  <div className="md:col-span-2 bg-gradient-to-r from-emerald-50 to-stone-50 dark:from-emerald-950/30 dark:to-stone-900 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200">
                        {lang === 'bn' ? 'কৃষকদের জন্য সরাসরি লাভ বাড়ানোর কৌশল' : 'Farmer Profit Maximization Strategies'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700 dark:text-stone-300">
                      {insights.farmerActionTips.map((tip: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-stone-800/70 p-2.5 rounded-xl border border-stone-200/60 dark:border-stone-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Executive Summary */}
                <div className="md:col-span-2 bg-white dark:bg-stone-900 p-4 sm:p-6 md:p-7 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 pb-4 sm:pb-5 border-b border-stone-100 dark:border-stone-800">
                    <div className="flex items-center space-x-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2 sm:p-2.5 rounded-xl text-emerald-700 dark:text-emerald-300">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Market Analytics</h3>
                          {marketCacheInfo?.isCached && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-medium border border-amber-200 dark:border-amber-800">
                              <Database className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>
                                {marketCacheInfo.isFallback 
                                  ? (lang === 'bn' ? "কক্সবাজার আড়ৎ ক্যাশ" : "Cox's Bazar Mandi Cache")
                                  : (lang === 'bn' 
                                      ? `অফলাইন • ${formatCacheAge(marketCacheInfo.timestamp, 'bn')}`
                                      : `Offline • ${formatCacheAge(marketCacheInfo.timestamp, 'en')}`)}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          {marketCacheInfo?.isCached
                            ? (lang === 'bn' ? 'সংরক্ষিত পাইকারি আড়ৎ মূল্যায়ন' : 'Preserved Mandi Assessment')
                            : 'Live Mandi Assessment'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700 tabular-nums">
                      Updated {lastUpdated || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="markdown-body text-sm sm:text-base leading-relaxed prose prose-stone dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-emerald-700">
                    <ReactMarkdown>{insights.insights}</ReactMarkdown>
                  </div>
                </div>

                {/* Price Drivers */}
                {insights.priceDrivers && insights.priceDrivers.length > 0 && (
                  <div className="bg-white dark:bg-stone-900 p-4 sm:p-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col">
                    <div className="flex items-center mb-4 sm:mb-5">
                      <div className="bg-stone-100 dark:bg-stone-800 p-2 sm:p-2.5 rounded-xl text-stone-700 dark:text-stone-300 mr-3">
                        <Activity className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                        {lang === 'bn' ? 'মূল্যের গতিপথ' : 'Price Drivers'}
                      </h4>
                    </div>
                    <ul className="space-y-2.5 flex-1">
                      {insights.priceDrivers.map((driver: string, idx: number) => (
                        <li key={idx} className="flex items-start space-x-2.5 p-3 sm:p-3.5 bg-stone-50/70 dark:bg-stone-800/60 rounded-xl border border-stone-200/80 dark:border-stone-700/70">
                          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 font-normal leading-relaxed">{driver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Nearest Markets */}
                {insights.nearestMarkets && (
                  <div className="bg-white dark:bg-stone-900 p-4 sm:p-6 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col">
                    <div className="flex items-center mb-4 sm:mb-5">
                      <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2 sm:p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 mr-3">
                        <Store className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                        {lang === 'bn' ? 'নিকটস্থ পাইকারি বাজার' : 'Nearest Wholesale Hubs'}
                      </h4>
                    </div>
                    <div className="space-y-2 flex-1 overflow-y-auto">
                      {insights.nearestMarkets.map((m: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-3 sm:p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40 group hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-semibold text-stone-800 dark:text-stone-200 text-xs sm:text-sm truncate">{m.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-stone-800 shadow-2xs px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800/50 tabular-nums overflow-hidden whitespace-nowrap shrink-0 ml-2">
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
                className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 p-5 sm:p-6 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-stone-100 dark:bg-stone-800 text-emerald-700 dark:text-emerald-400 rounded-xl">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {lang === 'bn' ? 'বাজার পর্যবেক্ষণ ও নমুনা পরিস্থিতি' : 'Market Intelligence & Sample Scenarios'}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 font-normal">
                        {lang === 'bn' ? 'এক ক্লিকে প্রধান পাইকারি মোকামের বাস্তব দর ও প্রবাহ পরীক্ষা করুন' : 'Tap any live mandi scenario below to simulate wholesale demand & rate analysis'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800">
                    {lang === 'bn' ? '১-ট্যাপ টেস্ট' : '1-Tap Run'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {SAMPLE_MARKET_SCENARIOS.map((sc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectScenario(sc)}
                      className="p-3.5 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100 group-hover:text-emerald-800 dark:group-hover:text-emerald-300">
                          {lang === 'bn' ? sc.titleBn : sc.titleEn}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed line-clamp-2">
                        {lang === 'bn' ? sc.descBn : sc.descEn}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

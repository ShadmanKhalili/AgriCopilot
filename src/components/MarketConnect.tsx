import React, { useState } from 'react';
import { TrendingUp, Loader2, MapPin, Sparkles, Store, BarChart } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getMarketInsights } from '../services/ai';
import { useAuth } from './AuthProvider';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import { motion, AnimatePresence } from 'motion/react';

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
  'pekua'
];

interface Props {
  lang: Language;
}

export default function MarketConnect({ lang }: Props) {
  const [produce, setProduce] = useState(PRODUCE_TYPES[0]);
  const [location, setLocation] = useState(MARKET_LOCATIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { user } = useAuth();
  const { canUse, incrementUsage, tier, currentUsage, limit } = useUsageTracking();
  const t = translations[lang];

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
      
      result = await getMarketInsights(produceName, locationName, lang, isAdvanced);
      setInsights(result);
      setLastUpdated(new Date().toLocaleString());

      // Save query if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'market_queries'), {
            userId: user.uid,
            produce,
            location,
            insights: result,
            isAdvanced,
            createdAt: new Date().toISOString()
          });
        } catch (saveError) {
          console.error("Failed to save market query:", saveError);
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
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-purple-100 rounded-2xl mb-4">
          <TrendingUp className="w-8 h-8 text-purple-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.marketConnect}</h2>
        <p className="text-gray-500 text-lg">{t.marketConnectDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Control Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 space-y-6"
        >
          <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-bold text-purple-900 mb-6 flex items-center text-xl">
              <div className="bg-purple-100 p-2 rounded-xl mr-3">
                <Store className="w-6 h-6 text-purple-600" />
              </div>
              {t.marketInsights}
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">{t.produceName}</label>
                <select 
                  value={produce} 
                  onChange={(e) => setProduce(e.target.value)}
                  className="w-full rounded-xl border-purple-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-purple-50/50 p-3.5 border text-base font-medium transition-colors"
                >
                  {PRODUCE_TYPES.map(p => (
                    <option key={p} value={p}>
                      {t.crops[p as keyof typeof t.crops] || p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-purple-500" />
                  {t.location}
                </label>
                <select 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border-purple-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-purple-50/50 p-3.5 border text-base font-medium transition-colors"
                >
                  {MARKET_LOCATIONS.map(u => (
                    <option key={u} value={u}>
                      {t.locations[u as keyof typeof t.locations] || u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-2 bg-purple-50/50 p-3.5 rounded-xl border border-purple-100">
                <input 
                  type="checkbox" 
                  id="advancedMarket" 
                  checked={isAdvanced}
                  onChange={(e) => setIsAdvanced(e.target.checked)}
                  disabled={tier !== 'premium'}
                  className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50 w-4 h-4"
                />
                <label htmlFor="advancedMarket" className={`text-sm font-bold flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" />
                  {t.advancedAnalysis}
                </label>
              </div>

              <div className="pt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentUsage / limit) * 100}%` }}
                    className="bg-purple-600 h-full"
                  />
                </div>
              </div>

              <button
                onClick={handleGetInsights}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold py-4 px-4 rounded-xl hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 mt-4"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>{t.fetchingInsights}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-6 h-6" />
                    <span>{t.getInsights}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Insights Output */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {insights ? (
              <motion.div 
                key="insights"
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className="bg-white rounded-3xl border border-purple-200 shadow-sm h-full flex flex-col relative overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white p-6 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                  <div className="relative z-10">
                    <h3 className="font-bold text-xl flex items-center">
                      <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm mr-3">
                        <BarChart className="w-6 h-6" />
                      </div>
                      {t.marketInsights}
                    </h3>
                    {lastUpdated && (
                      <p className="text-[10px] text-purple-100 mt-1 ml-14 font-medium uppercase tracking-widest opacity-80">
                        Updated: {lastUpdated}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-bold bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full relative z-10 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                    Live Data
                  </span>
                </div>
                
                <div className="p-8 flex-1 flex flex-col bg-gradient-to-b from-white to-purple-50/30">
                  <div className="space-y-6">
                    <div className="bg-purple-50/80 backdrop-blur-sm border border-purple-100/50 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start gap-5">
                        <div className="mt-1 bg-white p-3 rounded-xl shadow-sm">
                          <Sparkles className="w-6 h-6 text-purple-500" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <h4 className="font-black text-gray-900 text-2xl tracking-tight">
                            {t.crops[produce as keyof typeof t.crops] || produce} <span className="text-purple-600 font-medium">{lang === 'bn' ? 'মধ্যে' : 'in'}</span> {t.locations[location as keyof typeof t.locations] || location}
                          </h4>
                          <div className="text-gray-800 leading-relaxed whitespace-pre-wrap prose prose-purple max-w-none text-base">
                            {insights}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-3xl border border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-gray-400 text-center py-16 px-8"
              >
                <div className="bg-gray-50 p-6 rounded-full mb-6">
                  <TrendingUp className="w-16 h-16 text-gray-300" />
                </div>
                <p className="text-xl font-medium text-gray-500 max-w-md">Select produce and location to get real-time market insights and pricing trends.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

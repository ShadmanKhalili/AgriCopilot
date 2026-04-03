import React, { useState } from 'react';
import { TrendingUp, Loader2, MapPin, Sparkles, Store, BarChart } from 'lucide-react';
import { getMarketInsights } from '../services/ai';
import { useAuth } from './AuthProvider';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';

const PRODUCE_TYPES = ['Tomato', 'Brinjal', 'Paddy', 'Betel Leaf', 'Chili', 'Watermelon'];
const UPAZILAS = ['Teknaf', 'Ukhia', 'Moheshkhali', 'Kutubdia', 'Ramu', 'Cox\'s Bazar Sadar', 'Chakaria', 'Pekua'];

interface Props {
  lang: Language;
}

export default function MarketConnect({ lang }: Props) {
  const [produce, setProduce] = useState(PRODUCE_TYPES[0]);
  const [location, setLocation] = useState(UPAZILAS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const { user } = useAuth();
  const { canUse, incrementUsage, tier } = useUsageTracking();
  const t = translations[lang];

  const handleGetInsights = async () => {
    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsLoading(true);
    setInsights(null);
    try {
      const result = await getMarketInsights(produce, location, lang, isAdvanced);
      await incrementUsage();
      setInsights(result);
    } catch (error) {
      console.error("Market insights failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t.marketConnect}</h2>
        <p className="text-gray-500 mt-1">{t.marketConnectDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
            <h3 className="font-semibold text-purple-900 mb-4 flex items-center">
              <Store className="w-5 h-5 mr-2" />
              {t.marketInsights}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.produceName}</label>
                <select 
                  value={produce} 
                  onChange={(e) => setProduce(e.target.value)}
                  className="w-full rounded-lg border-purple-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white p-2.5 border text-sm"
                >
                  {PRODUCE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <MapPin className="w-4 h-4 mr-1 text-purple-500" />
                  {t.location}
                </label>
                <select 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border-purple-200 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white p-2.5 border text-sm"
                >
                  {UPAZILAS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="advancedMarket" 
                  checked={isAdvanced}
                  onChange={(e) => setIsAdvanced(e.target.checked)}
                  disabled={tier !== 'premium'}
                  className="rounded text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                />
                <label htmlFor="advancedMarket" className={`text-sm font-medium flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1 text-yellow-500" />
                  {t.advancedAnalysis}
                </label>
              </div>

              <button
                onClick={handleGetInsights}
                disabled={isLoading}
                className="w-full bg-purple-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center space-x-2 transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t.fetchingInsights}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    <span>{t.getInsights}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Insights Output */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-purple-500" />
                {t.marketInsights}
              </h3>
              {insights && <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">Live Data</span>}
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              {!insights ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center py-12">
                  <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                  <p>Select produce and location to get real-time market insights and pricing trends.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 bg-white p-2 rounded-full shadow-sm">
                        <Sparkles className="w-6 h-6 text-purple-500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <h4 className="font-semibold text-gray-900 text-lg">{produce} in {location}</h4>
                        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {insights}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

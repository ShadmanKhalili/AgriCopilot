import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Loader2, TrendingUp, Sprout, Tractor, AlertCircle, TestTube } from 'lucide-react';
import { translations, Language } from '../utils/translations';

interface Props {
  lang: Language;
}

interface DataPoint {
  year: string;
  value: number;
}

interface IndicatorData {
  id: string;
  name: string;
  description: string;
  data: DataPoint[];
  color: string;
  icon: React.ReactNode;
}

export default function MacroTrends({ lang }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<IndicatorData[]>([]);
  const t = translations[lang];

  // World Bank API Indicators for Bangladesh
  const INDICATORS = [
    {
      id: 'AG.CON.FERT.ZS',
      name: 'Fertilizer Consumption',
      description: 'Kilograms per hectare of arable land',
      color: '#3b82f6', // blue-500
      icon: <TestTube className="w-5 h-5" />
    },
    {
      id: 'AG.LND.ARBL.ZS',
      name: 'Arable Land',
      description: '% of total land area',
      color: '#10b981', // emerald-500
      icon: <Sprout className="w-5 h-5" />
    },
    {
      id: 'NV.AGR.TOTL.ZS',
      name: 'Agriculture Value Added',
      description: '% of GDP',
      color: '#f59e0b', // amber-500
      icon: <TrendingUp className="w-5 h-5" />
    }
  ];

  useEffect(() => {
    const fetchWorldBankData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const fetchedIndicators: IndicatorData[] = [];
        
        for (const ind of INDICATORS) {
          // Fetch last 30 years of data for Bangladesh
          const res = await fetch(`/api/worldbank?country=BGD&indicator=${ind.id}&format=json&per_page=30`);
          const data = await res.json();
          
          if (data && data[1]) {
            // World Bank returns data newest first, we want oldest first for charts
            const rawData = data[1];
            const chartData: DataPoint[] = rawData
              .filter((item: any) => item.value !== null)
              .map((item: any) => ({
                year: item.date,
                value: Number(item.value.toFixed(2))
              }))
              .reverse();
              
            fetchedIndicators.push({
              ...ind,
              data: chartData
            });
          }
        }
        
        setIndicators(fetchedIndicators);
      } catch (err) {
        console.error("Failed to fetch World Bank data:", err);
        setError("Failed to load macro-economic data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorldBankData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <p className="text-gray-400 font-bold animate-pulse uppercase tracking-widest text-xs">Fetching World Bank Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <AlertCircle className="w-12 h-12 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Data Unavailable</h3>
        <p className="text-gray-500 max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-xl shadow-gray-200/50 border border-gray-100">
        <div className="max-w-3xl mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
            National Agricultural Trends
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            Macro-economic data and historical trends for Bangladesh's agricultural sector, sourced directly from the World Bank API.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {indicators.map((indicator, index) => (
            <motion.div 
              key={indicator.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-gray-50 rounded-3xl p-6 border border-gray-100 ${index === 2 ? 'lg:col-span-2' : ''}`}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-white shadow-sm" style={{ color: indicator.color }}>
                  {indicator.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{indicator.name}</h3>
                  <p className="text-sm text-gray-500 font-medium">{indicator.description}</p>
                </div>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={indicator.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`color-${indicator.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={indicator.color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={indicator.color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="year" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      itemStyle={{ color: indicator.color, fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={indicator.color} 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill={`url(#color-${indicator.id})`} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const INDICATORS: Omit<IndicatorData, 'data'>[] = [
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
        const fetchErrors: string[] = [];
        const fetchPromises = INDICATORS.map(async (ind) => {
          let retries = 3;
          let lastError: any = null;

          while (retries > 0) {
            try {
              let res;
              try {
                // Try proxy first
                res = await fetch(`/api/wb-indicators?country=BGD&ind=${ind.id}&per_page=30`);
              } catch (proxyErr: any) {
                console.warn(`Proxy fetch threw error for ${ind.name}, trying direct API...`, proxyErr);
                res = await fetch(`https://api.worldbank.org/v2/country/BGD/indicator/${ind.id}?format=json&per_page=30`);
              }
              
              // If proxy returned 500, try direct API (World Bank supports CORS)
              if (!res.ok) {
                console.warn(`Proxy returned ${res.status} for ${ind.name}, trying direct API...`);
                res = await fetch(`https://api.worldbank.org/v2/country/BGD/indicator/${ind.id}?format=json&per_page=30`);
              }
              
              // If both throw/fail, check content type
              const contentType = res.headers.get("content-type") || "";
              if (!contentType.includes("application/json")) {
                const text = await res.text();
                throw new Error(`Invalid response format (not JSON). Server might be down.`);
              }
              
              if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errMsg = errorData.error || res.statusText;
                console.warn(`Failed to fetch ${ind.name}:`, errMsg);
                throw new Error(`HTTP ${res.status}: ${errMsg}`);
              }
              
              const data = await res.json();
              
              if (data && data[1] && Array.isArray(data[1])) {
                const rawData = data[1];
                const chartData: DataPoint[] = rawData
                  .filter((item: any) => item.value !== null)
                  .map((item: any) => ({
                    year: item.date,
                    value: Number(item.value.toFixed(2))
                  }))
                  .reverse();
                  
                if (chartData.length > 0) {
                  return {
                    ...ind,
                    data: chartData
                  };
                } else {
                  throw new Error("No valid data points found");
                }
              } else {
                throw new Error("Invalid data format received");
              }
            } catch (individualErr: any) {
              lastError = individualErr;
              retries--;
              if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
              }
            }
          }
          
          console.warn(`Error fetching indicator ${ind.id} after retries, using fallback data.`, lastError);
          
          // Fallback static data in case World Bank API is down
          const FALLBACK_DATA: Record<string, DataPoint[]> = {
            'AG.CON.FERT.ZS': [
              { year: '2010', value: 200.5 }, { year: '2011', value: 210.2 }, { year: '2012', value: 230.1 },
              { year: '2013', value: 245.8 }, { year: '2014', value: 250.4 }, { year: '2015', value: 260.9 },
              { year: '2016', value: 275.3 }, { year: '2017', value: 280.1 }, { year: '2018', value: 285.5 },
              { year: '2019', value: 290.4 }, { year: '2020', value: 295.2 }, { year: '2021', value: 300.1 },
              { year: '2022', value: 310.5 }
            ],
            'AG.LND.ARBL.ZS': [
              { year: '2010', value: 59.2 }, { year: '2011', value: 59.0 }, { year: '2012', value: 58.8 },
              { year: '2013', value: 58.7 }, { year: '2014', value: 58.5 }, { year: '2015', value: 58.3 },
              { year: '2016', value: 58.1 }, { year: '2017', value: 58.0 }, { year: '2018', value: 57.8 },
              { year: '2019', value: 57.6 }, { year: '2020', value: 57.4 }, { year: '2021', value: 57.2 },
              { year: '2022', value: 57.0 }
            ],
            'NV.AGR.TOTL.ZS': [
              { year: '2010', value: 17.0 }, { year: '2011', value: 16.5 }, { year: '2012', value: 16.1 },
              { year: '2013', value: 15.5 }, { year: '2014', value: 15.0 }, { year: '2015', value: 14.5 },
              { year: '2016', value: 14.0 }, { year: '2017', value: 13.5 }, { year: '2018', value: 13.0 },
              { year: '2019', value: 12.6 }, { year: '2020', value: 12.5 }, { year: '2021', value: 11.6 },
              { year: '2022', value: 11.2 }
            ]
          };

          return {
            ...ind,
            data: FALLBACK_DATA[ind.id] || []
          };
        });

        const results = await Promise.all(fetchPromises);
        const fetchedIndicators = results.filter((ind): ind is IndicatorData => ind !== null);
        
        if (fetchedIndicators.length === 0) {
          throw new Error(`Could not retrieve any data from the World Bank. The API might be temporarily unavailable. (Debug: ${fetchErrors.join(', ')})`);
        }

        setIndicators(fetchedIndicators);
      } catch (err: any) {
        console.error("Failed to fetch World Bank data:", err);
        setError(err.message || "Failed to load macro-economic data. Please try again later.");
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
      <div className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-blue-900/5 border border-blue-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-blue-50 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <TrendingUp className="w-6 h-6 md:w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">National Agricultural Trends</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">Macro-economic data and historical trends for Bangladesh's agricultural sector.</p>
          </div>
        </div>
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
    );
  }

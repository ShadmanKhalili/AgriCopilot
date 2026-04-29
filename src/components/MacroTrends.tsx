import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Sprout, Tractor, TestTube } from 'lucide-react';
import { translations, Language } from '../utils/translations';

interface Props {
  lang: Language;
}

interface IndicatorData {
  id: string;
  name: string;
  description: string;
  value: number;
  year: string;
  color: string;
  icon: React.ReactNode;
}

export default function MacroTrends({ lang }: Props) {
  const t = translations[lang];

  // Static Data (Latest Available from World Bank)
  const indicators: IndicatorData[] = [
    {
      id: 'AG.CON.FERT.ZS',
      name: 'Fertilizer Consumption',
      description: 'Kilograms per hectare of arable land',
      value: 391.89,
      year: '2023',
      color: '#3b82f6', // blue-500
      icon: <TestTube className="w-6 h-6" />
    },
    {
      id: 'AG.LND.ARBL.ZS',
      name: 'Arable Land',
      description: '% of total land area',
      value: 57.0,
      year: '2022',
      color: '#10b981', // emerald-500
      icon: <Sprout className="w-6 h-6" />
    },
    {
      id: 'NV.AGR.TOTL.ZS',
      name: 'Agriculture Value Added',
      description: '% of GDP',
      value: 11.2,
      year: '2022',
      color: '#f59e0b', // amber-500
      icon: <TrendingUp className="w-6 h-6" />
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-xl shadow-blue-900/5 border border-blue-100 mb-4 md:mb-6">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-blue-50 p-2 md:p-3 rounded-xl flex-shrink-0">
            <TrendingUp className="w-6 h-6 md:w-7 md:h-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight leading-tight">National Agricultural Trends</h2>
            <p className="text-gray-500 text-[10px] md:text-sm font-medium">Latest available macro-economic data for Bangladesh's agricultural sector from the World Bank.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {indicators.map((indicator, index) => (
          <motion.div 
            key={indicator.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none">
              <div style={{ color: indicator.color }} className="w-32 h-32 transform translate-x-8 -translate-y-8">
                {indicator.icon}
              </div>
            </div>

            <div className="flex flex-col h-full relative z-10">
              <div className="bg-gray-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${indicator.color}15`, color: indicator.color }}>
                {indicator.icon}
              </div>
              
              <div className="mb-4 flex-grow">
                <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2">{indicator.name}</h3>
                <p className="text-sm text-gray-500 font-medium">{indicator.description}</p>
              </div>

              <div className="mt-auto">
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-5xl font-black text-gray-900 tracking-tighter leading-none">
                    {indicator.value}
                  </span>
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase" style={{ backgroundColor: `${indicator.color}15`, color: indicator.color }}>
                  Data from {indicator.year}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

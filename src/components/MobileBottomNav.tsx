import React from 'react';
import { Leaf, Cloud, Calculator, Waves, Grid, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from '../utils/translations';

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'climate-resilience' | 'krishi-profit' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'community-radar' | 'gov-schemes' | 'user-guide' | 'profile' | 'admin-dashboard';

interface Props {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  lang: Language;
  onOpenAllTools: () => void;
}

export default function MobileBottomNav({ activeTab, setActiveTab, lang, onOpenAllTools }: Props) {
  const t = translations[lang];

  const primaryNavItems = [
    {
      id: 'agri-copilot' as Tab,
      label: t.quickDoctor || (lang === 'bn' ? 'ডাক্তার' : 'Doctor'),
      icon: Leaf,
      badge: 'AI'
    },
    {
      id: 'weather-advisory' as Tab,
      label: t.quickWeather || (lang === 'bn' ? 'আবহাওয়া' : 'Weather'),
      icon: Cloud,
      badge: null
    },
    {
      id: 'krishi-profit' as Tab,
      label: t.quickProfit || (lang === 'bn' ? 'লাভ হিসাব' : 'Profit'),
      icon: Calculator,
      badge: lang === 'bn' ? 'নতুন' : 'New'
    },
    {
      id: 'climate-resilience' as Tab,
      label: t.quickResilience || (lang === 'bn' ? 'সহনশীল জাত' : 'Climate'),
      icon: Waves,
      badge: null
    }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-emerald-900/10 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-2xl transition-all duration-150 active:scale-95 select-none min-h-[48px] cursor-pointer ${
                isActive ? 'text-emerald-950' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute inset-0 bg-emerald-100/90 rounded-2xl -z-10 shadow-2xs"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="relative">
                <div className={`p-1 rounded-xl transition-all ${isActive ? 'text-emerald-900 font-bold' : ''}`}>
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
                </div>
                {item.badge && (
                  <span className={`absolute -top-1 -right-2.5 text-[8px] font-black px-1.5 py-0.2 rounded-full border leading-tight ${
                    item.badge === 'AI' 
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs' 
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[11px] tracking-tight transition-all truncate max-w-[68px] text-center ${
                isActive ? 'font-black text-emerald-950' : 'font-bold text-slate-700'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Button: All Tools Drawer Trigger */}
        <button
          onClick={onOpenAllTools}
          className="relative flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-2xl transition-all duration-150 text-slate-700 hover:text-emerald-950 active:scale-95 select-none min-h-[48px] cursor-pointer"
        >
          <div className="p-1 rounded-xl">
            <Grid className="w-5 h-5 stroke-2" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 tracking-tight truncate max-w-[68px] text-center">
            {t.allTools || (lang === 'bn' ? 'সকল সেবা' : 'All Tools')}
          </span>
        </button>
      </div>
    </div>
  );
}

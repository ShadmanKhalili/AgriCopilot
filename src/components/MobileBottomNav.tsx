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

  const isOtherActive = !primaryNavItems.some((i) => i.id === activeTab);

  return (
    <nav 
      aria-label={lang === 'bn' ? 'মোবাইল নেভিগেশন' : 'Mobile navigation'}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-2xl border-t border-emerald-900/10 shadow-[0_-8px_32px_rgba(6,78,59,0.07)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto gap-0.5">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-0.5 rounded-2xl transition-all duration-200 active:scale-92 select-none min-h-[50px] cursor-pointer ${
                isActive ? 'text-emerald-950' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute inset-0 bg-emerald-100/90 rounded-2xl -z-10 shadow-xs border border-emerald-200/50"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <div className="relative">
                <div className={`p-1 rounded-xl transition-transform ${isActive ? 'scale-105' : ''}`}>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-emerald-900 stroke-[2.5]' : 'text-slate-600 stroke-2'}`} />
                </div>
                {item.badge && (
                  <span className={`absolute -top-1 -right-3 text-[8px] font-black px-1.5 py-0.2 rounded-full border leading-tight shadow-2xs ${
                    item.badge === 'AI' 
                      ? 'bg-emerald-700 text-white border-emerald-800' 
                      : 'bg-amber-600 text-white border-amber-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10.5px] leading-tight tracking-tight transition-all truncate max-w-[66px] text-center mt-0.5 ${
                isActive ? 'font-black text-emerald-950 scale-102' : 'font-bold text-slate-600'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Button: All Tools Drawer Trigger */}
        <button
          onClick={onOpenAllTools}
          aria-haspopup="dialog"
          className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-0.5 rounded-2xl transition-all duration-200 active:scale-92 select-none min-h-[50px] cursor-pointer ${
            isOtherActive ? 'text-emerald-950' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {isOtherActive && (
            <motion.div
              layoutId="mobileNavIndicator"
              className="absolute inset-0 bg-emerald-100/90 rounded-2xl -z-10 shadow-xs border border-emerald-200/50"
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            />
          )}

          <div className="relative">
            <div className={`p-1 rounded-xl transition-transform ${isOtherActive ? 'scale-105' : ''}`}>
              <Grid className={`w-5 h-5 transition-colors ${isOtherActive ? 'text-emerald-900 stroke-[2.5]' : 'text-slate-600 stroke-2'}`} />
            </div>
            {isOtherActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-600 ring-2 ring-white" />
            )}
          </div>
          <span className={`text-[10.5px] leading-tight tracking-tight transition-all truncate max-w-[66px] text-center mt-0.5 ${
            isOtherActive ? 'font-black text-emerald-950 scale-102' : 'font-bold text-slate-600'
          }`}>
            {t.allTools || (lang === 'bn' ? 'সকল সেবা' : 'All Tools')}
          </span>
        </button>
      </div>
    </nav>
  );
}

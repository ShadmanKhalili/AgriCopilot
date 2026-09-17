import React from 'react';
import { ShieldCheck, Cloud, TrendingUp, BookOpen, Grid } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from '../utils/translations';

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'climate-resilience' | 'krishi-profit' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'community-radar' | 'gov-schemes' | 'user-guide' | 'profile' | 'admin-dashboard';

export type PillarKey = 'all' | 'health' | 'weather' | 'economics' | 'support';

interface NavCategoryItem {
  id: PillarKey;
  targetTab: Tab;
  tabs: Tab[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
}

interface Props {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  lang: Language;
  onOpenAllTools: () => void;
  onSelectPillar?: (pillar: PillarKey) => void;
}

export default function MobileBottomNav({ 
  activeTab, 
  setActiveTab, 
  lang, 
  onOpenAllTools,
  onSelectPillar 
}: Props) {
  const t = translations[lang];

  // The 4 Core Agri Pillars matching the Sidebar & Menu Categories
  const categoryNavItems: NavCategoryItem[] = [
    {
      id: 'health',
      targetTab: 'agri-copilot',
      tabs: ['agri-copilot', 'crop-health', 'community-radar'],
      label: t.quickHealth || (lang === 'bn' ? 'স্বাস্থ্য' : 'Health'),
      icon: ShieldCheck,
      badge: 'AI'
    },
    {
      id: 'weather',
      targetTab: 'weather-advisory',
      tabs: ['weather-advisory', 'smart-planting', 'climate-resilience'],
      label: t.quickWeather || (lang === 'bn' ? 'আবহাওয়া' : 'Weather'),
      icon: Cloud,
      badge: null
    },
    {
      id: 'economics',
      targetTab: 'market-connect',
      tabs: ['market-connect', 'krishi-profit', 'smart-grade', 'gov-schemes'],
      label: t.quickMarket || (lang === 'bn' ? 'বাজার' : 'Market'),
      icon: TrendingUp,
      badge: lang === 'bn' ? 'দর' : 'Live'
    },
    {
      id: 'support',
      targetTab: 'user-guide',
      tabs: ['user-guide', 'profile', 'admin-dashboard'],
      label: t.quickSupport || (lang === 'bn' ? 'সহায়তা' : 'Support'),
      icon: BookOpen,
      badge: null
    }
  ];

  const handleCategoryClick = (item: NavCategoryItem) => {
    const isAlreadyInPillar = item.tabs.includes(activeTab);
    if (isAlreadyInPillar && onSelectPillar) {
      // If already on this pillar, tapping it opens the drawer pre-filtered to this category
      onSelectPillar(item.id);
    } else {
      setActiveTab(item.targetTab);
    }
  };

  return (
    <nav 
      aria-label={lang === 'bn' ? 'মোবাইল ক্যাটাগরি নেভিগেশন' : 'Mobile category navigation'}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c1c13]/95 backdrop-blur-2xl border-t border-emerald-900/10 dark:border-emerald-800/40 shadow-[0_-8px_32px_rgba(6,78,59,0.08)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-colors duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto gap-1">
        {categoryNavItems.map((item) => {
          const Icon = item.icon;
          const isPillarActive = item.tabs.includes(activeTab);

          return (
            <button
              key={item.id}
              onClick={() => handleCategoryClick(item)}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-0.5 rounded-2xl transition-all duration-200 active:scale-92 select-none min-h-[50px] cursor-pointer ${
                isPillarActive ? 'text-emerald-950 dark:text-emerald-100' : 'text-slate-500 hover:text-slate-800 dark:text-emerald-300/70 dark:hover:text-white'
              }`}
            >
              {isPillarActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute inset-0 bg-emerald-100/90 dark:bg-emerald-900/80 rounded-2xl -z-10 shadow-xs border border-emerald-200/60 dark:border-emerald-700/50"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}

              <div className="relative">
                <div className={`p-1 rounded-xl transition-transform ${isPillarActive ? 'scale-105' : ''}`}>
                  <Icon className={`w-5 h-5 transition-colors ${isPillarActive ? 'text-emerald-900 dark:text-emerald-300 stroke-[2.5]' : 'text-slate-600 dark:text-emerald-400/80 stroke-2'}`} />
                </div>
                {item.badge && (
                  <span className={`absolute -top-1 -right-3 text-[7.5px] font-black px-1.5 py-0.2 rounded-full border leading-tight shadow-2xs ${
                    item.badge === 'AI' 
                      ? 'bg-emerald-700 text-white border-emerald-800 dark:bg-emerald-600' 
                      : 'bg-amber-600 text-white border-amber-700 dark:bg-amber-500'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10.5px] leading-tight tracking-tight transition-all truncate max-w-[66px] text-center mt-0.5 ${
                isPillarActive ? 'font-black text-emerald-950 dark:text-white scale-102' : 'font-bold text-slate-600 dark:text-emerald-300/80'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Button: All Tools Drawer Trigger */}
        <button
          onClick={() => {
            if (onSelectPillar) {
              onSelectPillar('all');
            } else {
              onOpenAllTools();
            }
          }}
          aria-haspopup="dialog"
          aria-label={t.allTools || (lang === 'bn' ? 'সকল সেবা' : 'All Tools')}
          className="relative flex flex-col items-center justify-center flex-1 py-1.5 px-0.5 rounded-2xl transition-all duration-200 active:scale-92 select-none min-h-[50px] cursor-pointer text-slate-500 hover:text-slate-800 dark:text-emerald-300/70 dark:hover:text-white"
        >
          <div className="relative">
            <div className="p-1 rounded-xl transition-transform">
              <Grid className="w-5 h-5 transition-colors text-slate-600 dark:text-emerald-400/80 stroke-2" />
            </div>
          </div>
          <span className="text-[10.5px] leading-tight tracking-tight transition-all truncate max-w-[66px] text-center mt-0.5 font-bold text-slate-600 dark:text-emerald-300/80">
            {t.allTools || (lang === 'bn' ? 'সকল সেবা' : 'All Tools')}
          </span>
        </button>
      </div>
    </nav>
  );
}

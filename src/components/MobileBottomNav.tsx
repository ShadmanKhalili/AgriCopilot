import React from 'react';
import { ShieldCheck, Cloud, TrendingUp, BookOpen, Grid } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from '../utils/translations';

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'climate-resilience' | 'krishi-profit' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'community-radar' | 'gov-schemes' | 'farmer-dossier' | 'user-guide' | 'profile' | 'admin-dashboard';

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
    },
    {
      id: 'weather',
      targetTab: 'weather-advisory',
      tabs: ['weather-advisory', 'smart-planting', 'climate-resilience'],
      label: t.quickWeather || (lang === 'bn' ? 'আবহাওয়া' : 'Weather'),
      icon: Cloud,
    },
    {
      id: 'economics',
      targetTab: 'market-connect',
      tabs: ['market-connect', 'krishi-profit', 'smart-grade', 'gov-schemes'],
      label: t.quickMarket || (lang === 'bn' ? 'বাজার' : 'Market'),
      icon: TrendingUp,
    },
    {
      id: 'support',
      targetTab: 'user-guide',
      tabs: ['user-guide', 'profile', 'admin-dashboard', 'farmer-dossier'],
      label: t.quickSupport || (lang === 'bn' ? 'সহায়তা' : 'Support'),
      icon: BookOpen,
    }
  ];

  const handleCategoryClick = (item: NavCategoryItem) => {
    const isAlreadyInPillar = item.tabs.includes(activeTab);
    if (isAlreadyInPillar && onSelectPillar) {
      onSelectPillar(item.id);
    } else {
      setActiveTab(item.targetTab);
    }
  };

  return (
    <nav 
      aria-label={lang === 'bn' ? 'মোবাইল ক্যাটাগরি নেভিগেশন' : 'Mobile category navigation'}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c1c13]/95 backdrop-blur-md border-t border-stone-200/80 dark:border-stone-800 shadow-xs px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] transition-colors duration-200"
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
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-colors duration-150 select-none min-h-[48px] cursor-pointer ${
                isPillarActive ? 'text-emerald-900 dark:text-emerald-200' : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
              }`}
            >
              {isPillarActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute inset-0 bg-emerald-50/90 dark:bg-emerald-950/60 rounded-xl -z-10 border border-emerald-200/60 dark:border-emerald-800/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="p-1">
                <Icon className={`w-5 h-5 transition-colors ${isPillarActive ? 'text-emerald-800 dark:text-emerald-300 stroke-[2.2]' : 'text-stone-500 dark:text-stone-400 stroke-[1.8]'}`} />
              </div>

              <span className={`text-[10px] leading-tight tracking-tight truncate max-w-[64px] text-center ${
                isPillarActive ? 'font-bold text-emerald-900 dark:text-emerald-200' : 'font-medium text-stone-500 dark:text-stone-400'
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
          className="relative flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-colors duration-150 select-none min-h-[48px] cursor-pointer text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
        >
          <div className="p-1">
            <Grid className="w-5 h-5 text-stone-500 dark:text-stone-400 stroke-[1.8]" />
          </div>
          <span className="text-[10px] leading-tight tracking-tight truncate max-w-[64px] text-center font-medium text-stone-500 dark:text-stone-400">
            {t.allTools || (lang === 'bn' ? 'সকল সেবা' : 'All Tools')}
          </span>
        </button>
      </div>
    </nav>
  );
}

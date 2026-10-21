import React from 'react';
import { Sprout, Cloud, FileText, Grid } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from '../utils/translations';

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'climate-resilience' | 'krishi-profit' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'community-radar' | 'gov-schemes' | 'farmer-dossier' | 'expert-hub' | 'user-guide' | 'profile' | 'admin-dashboard';

export type PillarKey = 'all' | 'health' | 'weather' | 'economics' | 'support';

interface PrimaryNavItem {
  id: string;
  targetTab: Tab;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
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

  // Simplified First Experience: Ask about my crop, Check weather, My farm record. Specialist tools under "More".
  const primaryNavItems: PrimaryNavItem[] = [
    {
      id: 'ask-crop',
      targetTab: 'agri-copilot',
      label: lang === 'bn' ? 'ফসল জিজ্ঞাসা' : 'Ask Crop',
      sublabel: lang === 'bn' ? 'রোগ ও যত্ন' : 'Disease & Care',
      icon: Sprout,
    },
    {
      id: 'check-weather',
      targetTab: 'weather-advisory',
      label: lang === 'bn' ? 'আবহাওয়া' : 'Weather',
      sublabel: lang === 'bn' ? 'বৃষ্টি ও রাডার' : 'Rain & Radar',
      icon: Cloud,
    },
    {
      id: 'farm-record',
      targetTab: 'farmer-dossier',
      label: lang === 'bn' ? 'খামার রেকর্ড' : 'Farm Record',
      sublabel: lang === 'bn' ? 'ডিজিটাল কার্ড' : 'Krishi Card',
      icon: FileText,
    }
  ];

  const isSpecialistToolActive = !primaryNavItems.some(item => item.targetTab === activeTab);

  return (
    <nav 
      aria-label={lang === 'bn' ? 'মোবাইল প্রধান নেভিগেশন' : 'Mobile primary navigation'}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0c1c13]/95 backdrop-blur-md border-t border-stone-200/80 dark:border-stone-800 shadow-xs px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] transition-colors duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto gap-1">
        {primaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.targetTab;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.targetTab)}
              aria-label={item.label}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-colors duration-150 select-none min-h-[50px] cursor-pointer ${
                isActive ? 'text-emerald-900 dark:text-emerald-200 font-bold' : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 font-medium'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobileNavIndicator"
                  className="absolute inset-0 bg-emerald-50/90 dark:bg-emerald-950/60 rounded-xl -z-10 border border-emerald-200/60 dark:border-emerald-800/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <div className="p-1">
                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-emerald-800 dark:text-emerald-300 stroke-[2.2]' : 'text-stone-500 dark:text-stone-400 stroke-[1.8]'}`} />
              </div>

              <span className="text-[11px] leading-tight tracking-tight truncate max-w-[70px] text-center">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 4th Button: Specialist Tools Drawer Trigger ("More") */}
        <button
          onClick={() => {
            if (onSelectPillar) {
              onSelectPillar('all');
            }
            onOpenAllTools();
          }}
          aria-haspopup="dialog"
          aria-label={lang === 'bn' ? 'আরও সেবা ও বিশেষায়িত টুলস' : 'More Specialist Tools'}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-colors duration-150 select-none min-h-[50px] cursor-pointer ${
            isSpecialistToolActive ? 'text-emerald-900 dark:text-emerald-200 font-bold' : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 font-medium'
          }`}
        >
          {isSpecialistToolActive && (
            <motion.div
              layoutId="mobileNavIndicator"
              className="absolute inset-0 bg-emerald-50/90 dark:bg-emerald-950/60 rounded-xl -z-10 border border-emerald-200/60 dark:border-emerald-800/40"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <div className="p-1">
            <Grid className={`w-5 h-5 transition-colors ${isSpecialistToolActive ? 'text-emerald-800 dark:text-emerald-300 stroke-[2.2]' : 'text-stone-500 dark:text-stone-400 stroke-[1.8]'}`} />
          </div>
          <span className="text-[11px] leading-tight tracking-tight truncate max-w-[70px] text-center">
            {lang === 'bn' ? 'আরও সেবা' : 'More'}
          </span>
        </button>
      </div>
    </nav>
  );
}

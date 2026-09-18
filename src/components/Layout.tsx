import React, { useState, useEffect, Suspense, lazy } from 'react';
import { 
  Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, TrendingUp, 
  UserCircle, Cloud, Satellite, BarChart3, Radar, Landmark, Sprout, 
  ShieldCheck, Loader2, Calculator, Waves, MapPin, PhoneCall, ChevronRight, ChevronDown,
  Search, Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Lazy load components
const AgriCopilot = lazy(() => import('./AgriCopilot'));
const SmartGrade = lazy(() => import('./SmartGrade'));
const SmartPlanting = lazy(() => import('./SmartPlanting'));
const MarketConnect = lazy(() => import('./MarketConnect'));
const KrishiProfitCalculator = lazy(() => import('./KrishiProfitCalculator'));
const ClimateResilienceGuide = lazy(() => import('./ClimateResilienceGuide'));
const WeatherAdvisory = lazy(() => import('./WeatherAdvisory'));
const SatelliteHealth = lazy(() => import('./SatelliteHealth'));
const CommunityRadar = lazy(() => import('./CommunityRadar'));
const GovSchemes = lazy(() => import('./GovSchemes'));
const UserGuide = lazy(() => import('./UserGuide'));
const Profile = lazy(() => import('./Profile'));
const FarmerDossier = lazy(() => import('./FarmerDossier'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

import PricingModal from './PricingModal';
import { useAuth } from './AuthProvider';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';
import GoogleAd from './GoogleAd';
import OfflineBanner from './OfflineBanner';
import LegalModal from './LegalModal';
import AuthModal from './AuthModal';
import RegionModal from './RegionModal';
import MobileBottomNav from './MobileBottomNav';
import { useLocationName } from '../hooks/useLocationName';

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'climate-resilience' | 'krishi-profit' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'community-radar' | 'gov-schemes' | 'farmer-dossier' | 'user-guide' | 'profile' | 'admin-dashboard';

type PillarKey = 'all' | 'health' | 'weather' | 'economics' | 'support';

interface TabItem {
  id: Tab;
  name: string;
  icon: any;
  description: string;
  pillar: 'health' | 'weather' | 'economics' | 'support';
  subcategory: string;
  badge?: string;
}

interface PillarMeta {
  key: 'health' | 'weather' | 'economics' | 'support';
  title: string;
  subtitle: string;
  icon: any;
}

export default function Layout() {
  const [activeTab, setActiveTab] = useState<Tab>('agri-copilot');
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['agri-copilot']));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedPillarFilter, setSelectedPillarFilter] = useState<PillarKey>('all');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [lang, setLang] = useState<Language>('bn');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('krishi_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', theme);
    localStorage.setItem('krishi_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    setVisitedTabs(prev => new Set(prev).add(activeTab));
  }, [activeTab]);

  // AgriCopilot State Persistence
  const [agriImages, setAgriImages] = useState<{ base64: string; mimeType: string }[]>([]);
  const [agriDiagnosis, setAgriDiagnosis] = useState<any | null>(null);
  const [agriChatMessages, setAgriChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [agriChatSession, setAgriChatSession] = useState<any | null>(null);
  const [agriAudioUrl, setAgriAudioUrl] = useState<string | null>(null);
  const [agriCropStage, setAgriCropStage] = useState<string>('');
  const [agriCrop, setAgriCrop] = useState<string>('');
  const [agriAnalysisType, setAgriAnalysisType] = useState<string>('disease');

  // Profit Calculator State Persistence & Cross-Navigation
  const [profitCrop, setProfitCrop] = useState<string>('paddy_boro');

  // MarketConnect State Persistence
  const [marketInsights, setMarketInsights] = useState<any | null>(null);
  const [marketProduce, setMarketProduce] = useState<string>('tomato');

  // Global Location State (Default: null - prompts user for GIS/GPS detection or manual region selection)
  const [globalLocation, setGlobalLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const handleNavigateTab = (tab: Tab, payload?: { crop?: string; produce?: string }) => {
    if (payload?.crop) {
      const cropMap: Record<string, string> = {
        'potato': 'potato',
        'tomato': 'tomato',
        'onion': 'onion',
        'brinjal': 'brinjal',
        'chili': 'chili',
        'paddy': 'paddy_boro',
        'rice': 'paddy_boro',
        'paddy_boro': 'paddy_boro',
        'paddy_aman': 'paddy_aman',
        'maize': 'maize',
        'wheat': 'wheat',
        'mustard': 'mustard',
        'jute': 'jute',
      };
      const targetCrop = cropMap[payload.crop.toLowerCase()] || payload.crop;
      setProfitCrop(targetCrop);
    }
    if (payload?.produce) {
      setMarketProduce(payload.produce.toLowerCase());
    }
    setActiveTab(tab);
  };

  const { locationName, isLoading: isLocNameLoading } = useLocationName(globalLocation, lang);
  const { user, userRole, isAuthReady, signOut } = useAuth();
  const t = translations[lang];

  const tabs: TabItem[] = [
    // Pillar 1: Crop Health & Protection (শস্য স্বাস্থ্য ও সুরক্ষা)
    { 
      id: 'agri-copilot', 
      name: t.agriCopilot, 
      icon: Leaf, 
      description: t.agriCopilotDesc, 
      pillar: 'health', 
      subcategory: t.subcatDoctor || (lang === 'bn' ? 'এআই রোগ নিদান' : 'AI Crop Doctor'), 
      badge: 'AI Live' 
    },
    { 
      id: 'crop-health', 
      name: t.cropHealth, 
      icon: Satellite, 
      description: t.cropHealthDesc, 
      pillar: 'health', 
      subcategory: t.subcatSatellite || (lang === 'bn' ? 'স্যাটেলাইট নজরদারি' : 'Satellite NDVI'), 
      badge: 'Sentinel' 
    },
    { 
      id: 'community-radar', 
      name: t.communityRadar, 
      icon: Radar, 
      description: t.communityRadarDesc, 
      pillar: 'health', 
      subcategory: t.subcatRadar || (lang === 'bn' ? 'বালাই প্রাদুর্ভাব রাডার' : 'Pest Alerts'), 
      badge: lang === 'bn' ? 'লাইভ' : 'Live' 
    },

    // Pillar 2: Weather & Climate Intelligence (আবহাওয়া ও জলবায়ু বুদ্ধিমত্তা)
    { 
      id: 'weather-advisory', 
      name: t.weatherAdvisory, 
      icon: Cloud, 
      description: t.weatherAdvisoryDesc, 
      pillar: 'weather', 
      subcategory: t.subcatWeather || (lang === 'bn' ? 'আবহাওয়া ও রাডার' : 'Forecast & Radar'), 
      badge: 'DeepMind' 
    },
    { 
      id: 'smart-planting', 
      name: t.smartPlanting, 
      icon: Sprout, 
      description: t.smartPlantingDesc, 
      pillar: 'weather', 
      subcategory: t.subcatPlanting || (lang === 'bn' ? 'বপন ও বৃদ্ধি ক্যালেন্ডার' : 'Planting Calendar') 
    },
    { 
      id: 'climate-resilience', 
      name: t.climateResilience, 
      icon: Waves, 
      description: t.climateResilienceDesc, 
      pillar: 'weather', 
      subcategory: t.subcatResilience || (lang === 'bn' ? 'দুর্যোগ সহনশীল জাত' : 'Resilient Varieties'), 
      badge: lang === 'bn' ? 'জাত' : 'Guide' 
    },

    // Pillar 3: Agri-Economics & Markets (কৃষি অর্থনীতি ও বাজার)
    { 
      id: 'krishi-profit', 
      name: t.krishiProfit, 
      icon: Calculator, 
      description: t.krishiProfitDesc, 
      pillar: 'economics', 
      subcategory: t.subcatProfit || (lang === 'bn' ? 'উৎপাদন খরচ ও লাভ' : 'Cost & Margin'), 
      badge: lang === 'bn' ? 'নতুন' : 'New' 
    },
    { 
      id: 'market-connect', 
      name: t.marketConnect, 
      icon: TrendingUp, 
      description: t.marketConnectDesc, 
      pillar: 'economics', 
      subcategory: t.subcatMarket || (lang === 'bn' ? 'পাইকারি বাজার দর' : 'Wholesale Mandi'), 
      badge: 'DAM' 
    },
    { 
      id: 'smart-grade', 
      name: t.smartGrade, 
      icon: Award, 
      description: t.smartGradeDesc, 
      pillar: 'economics', 
      subcategory: t.subcatGrading || (lang === 'bn' ? 'মান যাচাই ও সঠিক দর' : 'Quality Grading') 
    },
    { 
      id: 'gov-schemes', 
      name: t.govSchemes, 
      icon: Landmark, 
      description: t.govSchemesDesc, 
      pillar: 'economics', 
      subcategory: t.subcatSchemes || (lang === 'bn' ? 'সরকারি প্রণোদনা ও সার' : 'DAE Subsidies') 
    },

    // Pillar 4: Support & Farm Settings (সহায়তা ও প্রোফাইল)
    { 
      id: 'farmer-dossier', 
      name: lang === 'bn' ? 'স্মার্ট কৃষক কার্ড ও ঋণ' : 'Smart Krishi Card & Loans', 
      icon: ShieldCheck, 
      description: lang === 'bn' ? 'ডিজিটাল ক্রেডিট স্কোর, ফসল বীমা ও লাইভ ইতিহাস' : 'Digital credit score, crop insurance & history', 
      pillar: 'support', 
      subcategory: lang === 'bn' ? 'ডিজিটাল প্রোফাইল ও ঋণ' : 'Credit & Insurance Dossier',
      badge: 'PRO'
    },
    { 
      id: 'user-guide', 
      name: t.userGuide, 
      icon: BookOpen, 
      description: t.userGuideDesc, 
      pillar: 'support', 
      subcategory: t.subcatGuide || (lang === 'bn' ? 'ব্যবহার সহায়িকা ও টিপস' : 'Tutorial & Guide') 
    },
    { 
      id: 'profile', 
      name: t.profile, 
      icon: UserCircle, 
      description: t.profileDesc, 
      pillar: 'support', 
      subcategory: t.subcatProfile || (lang === 'bn' ? 'খামারি প্রোফাইল ও জমি' : 'Farmer Profile') 
    },
    ...( (userRole === 'admin' || user?.email === 'sadmankhalili@gmail.com') ? [{ 
      id: 'admin-dashboard' as const, 
      name: 'Admin Hub', 
      icon: BarChart3, 
      description: 'Protocol & Analytics', 
      pillar: 'support' as const, 
      subcategory: 'System Telemetry',
      badge: 'Admin'
    }] : []),
  ];

  const pillarDefinitions: PillarMeta[] = [
    {
      key: 'health',
      title: t.pillarHealth || (lang === 'bn' ? 'শস্য স্বাস্থ্য ও সুরক্ষা' : 'Crop Health & Protection'),
      subtitle: lang === 'bn' ? 'এআই রোগ নিদান, স্যাটেলাইট ও বালাই সতর্কতা' : 'AI diagnostics, satellite NDVI & pest tracking',
      icon: ShieldCheck,
    },
    {
      key: 'weather',
      title: t.pillarWeather || (lang === 'bn' ? 'আবহাওয়া ও জলবায়ু বুদ্ধিমত্তা' : 'Weather & Climate Intelligence'),
      subtitle: lang === 'bn' ? 'মাইক্রোক্লাইমেট রাডার, বপন ক্যালেন্ডার ও সহনশীল জাত' : 'Microclimate radar, planting calendar & resilient seeds',
      icon: Cloud,
    },
    {
      key: 'economics',
      title: t.pillarEconomics || (lang === 'bn' ? 'কৃষি অর্থনীতি ও বাজার' : 'Agri-Economics & Markets'),
      subtitle: lang === 'bn' ? 'উৎপাদন খরচ, পাইকারি বাজার, গ্রেডিং ও সরকারি অনুদান' : 'Cost of production, mandi prices, grading & subsidies',
      icon: TrendingUp,
    },
    {
      key: 'support',
      title: t.pillarSupport || (lang === 'bn' ? 'সহায়তা ও খামারি সেটিংস' : 'Support & Settings'),
      subtitle: lang === 'bn' ? 'ব্যবহার সহায়িকা, কৃষক প্রোফাইল ও সেটিংস' : 'User guide, farm profile & administration',
      icon: BookOpen,
    },
  ];

  const pillarCategories: { key: PillarKey; label: string; icon: any }[] = [
    { key: 'all', label: lang === 'bn' ? 'সকল' : 'All', icon: Sprout },
    { key: 'health', label: lang === 'bn' ? 'স্বাস্থ্য' : 'Health', icon: ShieldCheck },
    { key: 'weather', label: lang === 'bn' ? 'আবহাওয়া' : 'Weather', icon: Cloud },
    { key: 'economics', label: lang === 'bn' ? 'বাজার' : 'Market', icon: TrendingUp },
    { key: 'support', label: lang === 'bn' ? 'সহায়তা' : 'Support', icon: BookOpen },
  ];

  const normalizedQuery = menuSearchQuery.trim().toLowerCase();
  
  const matchesSearch = (tab: TabItem) => {
    if (!normalizedQuery) return true;
    return (
      tab.name.toLowerCase().includes(normalizedQuery) ||
      tab.description.toLowerCase().includes(normalizedQuery) ||
      tab.subcategory.toLowerCase().includes(normalizedQuery)
    );
  };

  const filteredPillars = pillarDefinitions.filter((p) => {
    if (selectedPillarFilter !== 'all' && selectedPillarFilter !== p.key) {
      return false;
    }
    return tabs.some((tab) => tab.pillar === p.key && matchesSearch(tab));
  });

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'bn' : 'en');
  };

  const activeTabDetails = tabs.find(tab => tab.id === activeTab);

  // Dynamic SEO & Title synchronization
  useEffect(() => {
    document.documentElement.lang = lang;
    if (activeTabDetails) {
      document.title = `${activeTabDetails.name} | Agri-Copilot`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute(
          'content',
          `${activeTabDetails.name} - ${activeTabDetails.description} | Agri-Copilot: AI-Powered Climate Intelligence Tools for Bangladesh Agriculture.`
        );
      }
    }
  }, [activeTabDetails, lang]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-emerald-800">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
        <span className="text-xs font-black uppercase tracking-widest text-emerald-950">
          {lang === 'bn' ? 'স্মার্ট কৃষি সেবা লোড হচ্ছে...' : 'Loading Smart Agri-Tools...'}
        </span>
      </div>
    );
  }

  return (
    <>
      <OfflineBanner lang={lang} />
      
      <div className="h-[100dvh] w-full bg-[#F4F6F4] dark:bg-[#09110c] text-slate-900 dark:text-emerald-50 flex flex-col md:flex-row font-sans overflow-hidden transition-colors duration-200">
        
        {/* ======================= SIDEBAR (DESKTOP & MOBILE DRAWER) ======================= */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}
        </AnimatePresence>

        <div 
          id="sidebar-nav"
          className={`
            fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            md:relative md:translate-x-0 transition-transform duration-300 ease-in-out
            w-[86vw] max-w-sm md:w-80 rounded-r-3xl md:rounded-none 
            bg-white dark:bg-gradient-to-b dark:from-emerald-950 dark:via-[#0c1c13] dark:to-[#08150d] 
            text-slate-900 dark:text-white flex flex-col shadow-2xl z-50 h-full shrink-0 
            border-r border-emerald-200/80 dark:border-emerald-800/40 
            pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]
          `}
          role="navigation"
          aria-label={lang === 'bn' ? 'প্রধান নেভিগেশন' : 'Main navigation'}
        >
          {/* Brand Header */}
          <div className="p-4 sm:p-5 pb-4 flex items-center justify-between border-b border-emerald-100 dark:border-white/10 bg-emerald-50/70 dark:bg-black/10">
            <div className="flex items-center space-x-3">
              <motion.div 
                whileHover={{ rotate: 12, scale: 1.05 }}
                className="bg-gradient-to-tr from-emerald-500 to-green-600 dark:from-emerald-400 dark:to-green-500 p-2.5 rounded-2xl shadow-lg shadow-emerald-600/20 text-white dark:text-emerald-950"
                aria-hidden="true"
              >
                <Leaf className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
              </motion.div>
              <div className="flex flex-col">
                <span className="font-display font-black text-lg sm:text-xl tracking-tight leading-none text-emerald-950 dark:text-white">
                  {lang === 'bn' ? 'স্মার্ট কৃষি-সেবা' : 'Smart Agri-Tools'}
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 tracking-[0.1em] opacity-80 uppercase">
                    AI-Studio Krishi
                  </span>
                  {(userRole === 'admin' || user?.email === 'sadmankhalili@gmail.com') && (
                    <span className="text-[8px] bg-yellow-400 text-gray-900 font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label={lang === 'bn' ? 'মেনু বন্ধ করুন' : 'Close Menu'}
              className="md:hidden p-2.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-white/10 dark:text-white/90 rounded-2xl active:scale-90 focus:outline-none transition-all cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Pillar Category Filter Tabs (Quick Filter) & Search */}
          <div className="px-3 pt-3 pb-1 space-y-2">
            <div className="grid grid-cols-5 gap-1 p-1 bg-emerald-50/90 dark:bg-emerald-950/80 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40">
              {pillarCategories.map((cat) => {
                const isCatActive = selectedPillarFilter === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setSelectedPillarFilter(cat.key);
                    }}
                    className={`py-1.5 px-0.5 text-[10px] font-black rounded-xl transition-all truncate text-center cursor-pointer ${
                      isCatActive
                        ? 'bg-emerald-600 text-white shadow-xs dark:bg-emerald-400 dark:text-emerald-950'
                        : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/70 dark:text-emerald-300/80 dark:hover:text-white dark:hover:bg-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Instant Menu Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400/70 pointer-events-none" />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder={lang === 'bn' ? 'টুল বা বিষয় খুঁজুন...' : 'Search tools or tasks...'}
                className="w-full bg-white dark:bg-emerald-950/60 text-slate-900 dark:text-white placeholder-emerald-700/50 dark:placeholder-emerald-400/50 text-xs pl-8 pr-7 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400 transition-all shadow-2xs"
              />
              {menuSearchQuery && (
                <button 
                  onClick={() => setMenuSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white p-0.5 cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          
          {/* Categorized and Subcategorized Navigation List */}
          <nav 
            className="flex-1 px-3 py-2 space-y-4 overflow-y-auto custom-scrollbar"
            role="tablist"
            aria-orientation="vertical"
          >
            {filteredPillars.length === 0 ? (
              <div className="py-8 text-center px-4">
                <div className="p-3 bg-emerald-100/60 dark:bg-white/5 rounded-2xl inline-flex text-emerald-700 dark:text-emerald-400 mb-2">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-700 dark:text-emerald-300 font-bold mb-2">
                  {lang === 'bn' ? 'কোন সেবা পাওয়া যায়নি' : 'No tools found'}
                </p>
                <button
                  onClick={() => {
                    setMenuSearchQuery('');
                    setSelectedPillarFilter('all');
                  }}
                  className="text-[11px] text-emerald-700 dark:text-emerald-400 underline font-black hover:text-emerald-900 dark:hover:text-white cursor-pointer"
                >
                  {lang === 'bn' ? 'সকল সেবা প্রদর্শন করুন' : 'Reset and show all'}
                </button>
              </div>
            ) : (
              filteredPillars.map((pillar) => {
                const PillarIcon = pillar.icon;
                const pillarTabs = tabs.filter(
                  (t) => t.pillar === pillar.key && matchesSearch(t)
                );
                if (pillarTabs.length === 0) return null;

                return (
                  <div key={pillar.key} className="space-y-1.5">
                    {/* Category Header */}
                    <div className="px-1.5 pt-1 flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="p-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/80 dark:text-emerald-300 dark:border-emerald-700/50 shrink-0">
                          <PillarIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-black text-[11px] uppercase tracking-wider text-emerald-950 dark:text-emerald-200 block truncate">
                            {pillar.title}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/90 dark:text-emerald-300 dark:border-emerald-700/40 shrink-0">
                        {pillarTabs.length}
                      </span>
                    </div>
                    <div className="text-[9.5px] text-emerald-700/80 dark:text-emerald-400/70 pl-7 leading-tight mb-1 truncate">
                      {pillar.subtitle}
                    </div>

                    {/* Subcategorized Tools in this Pillar */}
                    <div className="space-y-1">
                      {pillarTabs.map((tab, index) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <motion.button
                            key={tab.id}
                            type="button"
                            role="tab"
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.015, duration: 0.15 }}
                            aria-selected={isActive}
                            aria-controls={`panel-${tab.id}`}
                            id={`tab-${tab.id}`}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setActiveTab(tab.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl transition-all duration-150 text-left relative overflow-hidden group outline-none cursor-pointer ${
                              isActive 
                                ? 'bg-emerald-700 text-white shadow-md shadow-emerald-700/20 dark:bg-white dark:text-emerald-950 dark:shadow-lg dark:shadow-emerald-950/40' 
                                : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 dark:text-emerald-100 dark:hover:bg-white/10 dark:hover:text-white'
                            }`}
                          >
                            {isActive && (
                              <motion.div 
                                layoutId="activeSidebarTabBg"
                                className="absolute inset-0 bg-emerald-700 dark:bg-white"
                                transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                              />
                            )}
                            
                            <div className="relative z-10 flex items-center space-x-2.5 min-w-0 flex-1">
                              <div className={`p-2 rounded-xl transition-colors shrink-0 ${
                                isActive 
                                  ? 'bg-emerald-800 text-white dark:bg-emerald-100 dark:text-emerald-800' 
                                  : 'bg-emerald-100/80 text-emerald-700 group-hover:bg-emerald-200 dark:bg-emerald-900/60 dark:text-emerald-300 dark:group-hover:bg-white/15'
                              }`}>
                                <Icon className="w-4 h-4" aria-hidden="true" />
                              </div>
                              <div className="min-w-0 flex-1 pr-1">
                                <div className="flex items-center space-x-1.5 truncate">
                                  <span className={`font-black text-xs tracking-tight truncate ${isActive ? 'text-white dark:text-emerald-950' : 'text-slate-800 dark:text-emerald-50'}`}>
                                    {tab.name}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md tracking-tight shrink-0 ${
                                    isActive 
                                      ? 'bg-emerald-800/90 text-emerald-100 border border-emerald-600 dark:bg-emerald-100 dark:text-emerald-900 dark:border-emerald-300/80 font-black' 
                                      : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-emerald-950/80 dark:text-emerald-300/90 dark:border-emerald-700/50'
                                  }`}>
                                    {tab.subcategory}
                                  </span>
                                  <span className={`text-[9.5px] truncate ${isActive ? 'text-emerald-100/90 dark:text-emerald-800' : 'text-slate-500 dark:text-emerald-300/70'}`}>
                                    {tab.description}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {tab.badge && (
                              <span className={`relative z-10 text-[8.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ml-1 ${
                                isActive 
                                  ? 'bg-white text-emerald-900 dark:bg-emerald-800 dark:text-white' 
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300/70 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                              }`}>
                                {tab.badge}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </nav>
          
          {/* Sidebar Footer: Theme Switcher, DAE Hotline & Auth */}
          <div className="p-3.5 border-t border-emerald-100 dark:border-white/10 bg-emerald-50/70 dark:bg-black/15 space-y-2.5 shrink-0">
            
            {/* Theme Switcher in Sidebar */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-white dark:bg-white/5 border border-emerald-200/80 dark:border-white/10 text-xs shadow-2xs">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                  {theme === 'light' ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Moon className="w-4 h-4 text-emerald-300" />
                  )}
                </div>
                <div>
                  <div className="font-black text-[11px] text-slate-800 dark:text-white leading-tight">
                    {theme === 'light' ? t.lightMode : t.darkMode}
                  </div>
                  <div className="text-[9.5px] text-slate-500 dark:text-emerald-400/80">
                    {theme === 'light' ? (lang === 'bn' ? 'উজ্জ্বল মোড' : 'Daylight theme') : (lang === 'bn' ? 'রাত্রিকালীন মোড' : 'Night theme')}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-2.5 py-1 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white font-black text-[10.5px] transition-all active:scale-95 cursor-pointer border border-emerald-300/60 dark:border-white/10"
              >
                {theme === 'light' ? (lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode') : (lang === 'bn' ? 'লাইট মোড' : 'Light Mode')}
              </button>
            </div>

            {/* Quick DAE Toll-Free Call Box */}
            <a 
              href="tel:16123"
              className="flex items-center justify-between p-2.5 bg-white hover:bg-emerald-100/70 dark:bg-emerald-900/50 dark:hover:bg-emerald-900/80 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 text-emerald-900 dark:text-emerald-200 text-xs transition-colors group shadow-2xs"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-emerald-500 text-white dark:text-emerald-950 rounded-xl group-hover:scale-105 transition-transform">
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-black text-[11px] text-slate-900 dark:text-white leading-tight">
                    {lang === 'bn' ? 'কৃষি কল সেন্টার' : 'Krishi Call Center'}
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-bold">16123 (বিনামূল্যে)</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-700 dark:text-emerald-300 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </a>

            {/* Auth Button */}
            {user ? (
              <div className="flex items-center justify-between bg-white dark:bg-white/5 p-2 rounded-2xl border border-emerald-200 dark:border-white/10 shadow-2xs">
                <button 
                  onClick={() => {
                    setActiveTab('profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2.5 text-left flex-1 hover:bg-emerald-50 dark:hover:bg-white/5 p-1 rounded-xl transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center font-black text-white text-xs shadow-md">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                  <div className="text-xs truncate">
                    <div className="font-black tracking-tight truncate max-w-[90px] text-slate-900 dark:text-white">
                      {user.displayName}
                    </div>
                    <div className="text-emerald-700 dark:text-emerald-400 text-[9px] font-bold uppercase tracking-wider">{userRole}</div>
                  </div>
                </button>
                <button 
                  onClick={signOut} 
                  className="p-2 hover:bg-red-500/20 rounded-xl text-slate-500 hover:text-red-600 dark:text-emerald-300 dark:hover:text-red-400 transition-all cursor-pointer" 
                  title={t.signOut}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-white dark:text-emerald-950 dark:hover:bg-emerald-50 font-black py-2.5 px-4 rounded-xl active:scale-95 transition-all shadow-md text-xs uppercase tracking-wider cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{t.signIn}</span>
              </button>
            )}

            <div className="text-center pt-0.5">
              <button 
                onClick={() => setIsLegalOpen(true)}
                className="text-[9px] text-emerald-800/70 hover:text-emerald-950 dark:text-emerald-300/60 dark:hover:text-emerald-300 underline underline-offset-2 uppercase tracking-wider transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'গোপনীয়তা ও শর্তাবলী' : 'Privacy & Terms'}
              </button>
            </div>
          </div>
        </div>

        {/* ======================= MAIN CONTENT AREA ======================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* ================= STANDARDIZED PERSISTENT TOP BAR ================= */}
          <header className="bg-white/95 dark:bg-[#0c1c13]/95 backdrop-blur-md sticky top-0 border-b border-gray-200/80 dark:border-emerald-900/60 px-2.5 sm:px-4 md:px-6 py-2 sm:py-2.5 flex items-center justify-between z-30 shrink-0 shadow-xs pt-[max(0.5rem,env(safe-area-inset-top))]">
            {/* Left: Mobile Menu Toggle & Active Module Info */}
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:hover:bg-emerald-800 dark:text-emerald-200 rounded-xl transition-all active:scale-95 shrink-0 cursor-pointer"
                aria-label={lang === 'bn' ? 'মেনু খুলুন' : 'Open Menu'}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 truncate">
                {activeTabDetails && (
                  <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
                    <div className="p-1 sm:p-1.5 bg-emerald-50 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0">
                      <activeTabDetails.icon className="w-4 h-4" />
                    </div>
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <h1 className="font-black text-xs sm:text-base text-gray-900 dark:text-white tracking-tight truncate max-w-[110px] sm:max-w-[200px] md:max-w-none m-0 leading-tight">
                        {activeTabDetails.name}
                      </h1>
                      <span className="hidden sm:inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 dark:bg-emerald-900/70 dark:text-emerald-300 dark:border-emerald-700/50 shrink-0">
                        {activeTabDetails.subcategory}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Universal Location Chip, Theme Toggle, Language Toggle & Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              
              {/* Universal Location Chip with 1-Click Switcher */}
              <Tooltip content={lang === 'bn' ? 'উপজেলা বা জেলা পরিবর্তন করুন' : 'Click to change District / Upazila'}>
                <button
                  type="button"
                  onClick={() => setIsRegionModalOpen(true)}
                  className="flex items-center space-x-1 sm:space-x-1.5 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/70 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-200 dark:border-emerald-800/60 px-2 py-1.5 sm:px-2.5 rounded-xl transition-all active:scale-95 shadow-2xs group shrink-0 cursor-pointer"
                >
                  <span className="relative flex h-2 w-2">
                    {globalLocation ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                      </>
                    ) : (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </>
                    )}
                  </span>
                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${globalLocation ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  <span className="text-[11px] sm:text-xs font-black truncate max-w-[70px] sm:max-w-[160px]">
                    {isLocNameLoading ? (
                      <span className="opacity-60">{lang === 'bn' ? 'খোঁজা হচ্ছে...' : 'Locating...'}</span>
                    ) : (
                      locationName || (lang === 'bn' ? 'অবস্থান নির্বাচন' : 'Set Location')
                    )}
                  </span>
                  <ChevronDown className="w-3 h-3 text-emerald-600/70 dark:text-emerald-400/70 shrink-0" />
                </button>
              </Tooltip>

              {/* Quick Light/Dark Mode Switcher */}
              <button 
                type="button"
                onClick={toggleTheme} 
                className="flex items-center space-x-1 font-black text-[11px] sm:text-xs bg-gray-100/90 hover:bg-gray-200 text-gray-800 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-200 px-2 py-1.5 sm:px-2.5 rounded-xl border border-gray-200 dark:border-emerald-800/60 transition-all active:scale-95 shrink-0 cursor-pointer"
                title={theme === 'light' ? t.darkMode : t.lightMode}
                aria-label={t.themeToggle}
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-700 dark:text-emerald-300" aria-hidden="true" />
                    <span className="hidden md:inline">{lang === 'bn' ? 'ডার্ক' : 'Dark'}</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    <span className="hidden md:inline">{lang === 'bn' ? 'লাইট' : 'Light'}</span>
                  </>
                )}
              </button>

              {/* Language Switcher Pill */}
              <button 
                type="button"
                onClick={toggleLanguage} 
                className="flex items-center space-x-1 font-black text-[11px] sm:text-xs bg-gray-100/90 hover:bg-gray-200 text-gray-800 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:text-emerald-200 px-2 py-1.5 sm:px-2.5 rounded-xl border border-gray-200 dark:border-emerald-800/60 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Toggle Language"
              >
                <Globe className="w-3.5 h-3.5 text-gray-500 dark:text-emerald-400" aria-hidden="true" />
                <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
              </button>

              {/* Profile or Sign-in Quick Pill */}
              {user ? (
                <button
                  onClick={() => setActiveTab('profile')}
                  className="p-1 sm:p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 dark:border-emerald-800/60 transition-all shrink-0 cursor-pointer"
                  title="Profile"
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex items-center space-x-1 sm:space-x-1.5 text-[11px] sm:text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1.5 sm:px-3 rounded-xl transition-all shadow-xs active:scale-95 shrink-0 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.signIn}</span>
                </button>
              )}
            </div>
          </header>

          {/* ================= SCROLLABLE MAIN CONTENT ================= */}
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar w-full relative bg-[#F7F8F6] dark:bg-[#08120b] pb-28 md:pb-6 transition-colors duration-200">
            
            {/* Background Texture Grid */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.025] dark:opacity-[0.05] pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#064e3b 0.6px, transparent 0.6px)', backgroundSize: '24px 24px' }}
              />
            </div>

            <div className="relative z-10 min-h-full flex flex-col w-full max-w-7xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="flex-1 flex flex-col"
                >
                  <Suspense fallback={
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-emerald-700/60">
                      <Loader2 className="w-10 h-10 animate-spin mb-3 text-emerald-600" />
                      <div className="font-display font-black text-xs uppercase tracking-widest text-emerald-950">
                        {lang === 'bn' ? 'টুল প্রস্তুত করা হচ্ছে...' : 'Loading Tool Module...'}
                      </div>
                    </div>
                  }>
                    <div className={activeTab === 'agri-copilot' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('agri-copilot') && (
                        <AgriCopilot 
                          lang={lang} 
                          globalLocation={globalLocation}
                          setGlobalLocation={setGlobalLocation}
                          persistedImages={agriImages}
                          setPersistedImages={setAgriImages}
                          persistedDiagnosis={agriDiagnosis}
                          setPersistedDiagnosis={setAgriDiagnosis}
                          persistedChatMessages={agriChatMessages}
                          setPersistedChatMessages={setAgriChatMessages}
                          persistedChatSession={agriChatSession}
                          setPersistedChatSession={setAgriChatSession}
                          persistedAudioUrl={agriAudioUrl}
                          setPersistedAudioUrl={setAgriAudioUrl}
                          persistedCropStage={agriCropStage}
                          setPersistedCropStage={setAgriCropStage}
                          persistedCrop={agriCrop}
                          setPersistedCrop={setAgriCrop}
                          persistedAnalysisType={agriAnalysisType}
                          setPersistedAnalysisType={setAgriAnalysisType}
                          onNavigateTab={handleNavigateTab}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'weather-advisory' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('weather-advisory') && (
                        <WeatherAdvisory 
                          lang={lang} 
                          globalLocation={globalLocation}
                          setGlobalLocation={setGlobalLocation}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'krishi-profit' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('krishi-profit') && (
                        <KrishiProfitCalculator 
                          lang={lang} 
                          initialCrop={profitCrop}
                          onCropSelect={setProfitCrop}
                          onNavigateTab={handleNavigateTab}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'climate-resilience' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('climate-resilience') && (
                        <ClimateResilienceGuide 
                          lang={lang} 
                          onNavigateTab={handleNavigateTab}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'crop-health' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('crop-health') && (
                        <SatelliteHealth 
                          lang={lang} 
                          globalLocation={globalLocation}
                          setGlobalLocation={setGlobalLocation}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'smart-grade' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('smart-grade') && <SmartGrade lang={lang} />}
                    </div>
                    <div className={activeTab === 'smart-planting' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('smart-planting') && (
                        <SmartPlanting 
                          lang={lang} 
                          globalLocation={globalLocation}
                          setGlobalLocation={setGlobalLocation}
                          onNavigateTab={handleNavigateTab}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'market-connect' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('market-connect') && (
                        <MarketConnect 
                          lang={lang} 
                          persistedInsights={marketInsights}
                          setPersistedInsights={setMarketInsights}
                          persistedProduce={marketProduce}
                          setPersistedProduce={setMarketProduce}
                          onNavigateTab={handleNavigateTab}
                        />
                      )}
                    </div>
                    <div className={activeTab === 'community-radar' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('community-radar') && <CommunityRadar lang={lang} />}
                    </div>
                    <div className={activeTab === 'gov-schemes' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('gov-schemes') && <GovSchemes lang={lang} globalLocation={globalLocation} />}
                    </div>
                    <div className={activeTab === 'user-guide' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('user-guide') && <UserGuide lang={lang} />}
                    </div>
                    <div className={activeTab === 'farmer-dossier' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('farmer-dossier') && <FarmerDossier lang={lang} onNavigateToTab={handleNavigateTab} />}
                    </div>
                    <div className={activeTab === 'profile' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('profile') && <Profile lang={lang} onUpgrade={() => setIsPricingOpen(true)} />}
                    </div>
                    <div className={activeTab === 'admin-dashboard' ? 'block flex-1' : 'hidden'}>
                      {visitedTabs.has('admin-dashboard') && <AdminDashboard lang={lang} />}
                    </div>
                  </Suspense>
                </motion.div>
              </AnimatePresence>

              <GoogleAd lang={lang} className="mt-10 mb-2" />
            </div>
          </main>

          {/* ================= SLEEK MOBILE BOTTOM ACTION BAR ================= */}
          <MobileBottomNav 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            lang={lang}
            onOpenAllTools={() => {
              setSelectedPillarFilter('all');
              setIsMobileMenuOpen(true);
            }}
            onSelectPillar={(pillar) => {
              setSelectedPillarFilter(pillar);
              setIsMobileMenuOpen(true);
            }}
          />
        </div>

        {/* ================= MODALS ================= */}
        {/* Universal Region / District Selector */}
        <RegionModal
          isOpen={isRegionModalOpen}
          onClose={() => setIsRegionModalOpen(false)}
          lang={lang}
          globalLocation={globalLocation}
          setGlobalLocation={setGlobalLocation}
          currentLocationName={locationName}
        />

        {/* Pricing Modal */}
        <PricingModal 
          isOpen={isPricingOpen} 
          onClose={() => setIsPricingOpen(false)} 
          lang={lang} 
        />

        {/* Legal Modal */}
        <LegalModal
          isOpen={isLegalOpen}
          onClose={() => setIsLegalOpen(false)}
          lang={lang}
        />

        {/* Auth Modal */}
        <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          lang={lang}
        />
      </div>
    </>
  );
}

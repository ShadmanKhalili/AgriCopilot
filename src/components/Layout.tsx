import React, { useState, useEffect, Suspense, lazy } from 'react';
import { 
  Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, TrendingUp, 
  UserCircle, Cloud, Satellite, BarChart3, Radar, Landmark, Sprout, 
  ShieldCheck, Loader2, Calculator, Waves, MapPin, PhoneCall, ChevronRight, ChevronDown
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

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'climate-resilience' | 'krishi-profit' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'community-radar' | 'gov-schemes' | 'user-guide' | 'profile' | 'admin-dashboard';

type PillarKey = 'all' | 'health' | 'planning' | 'economics';

interface TabItem {
  id: Tab;
  name: string;
  icon: any;
  description: string;
  pillar: 'health' | 'planning' | 'economics' | 'account';
  badge?: string;
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
  const [lang, setLang] = useState<Language>('bn');

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
    // Pillar 1: Crop Health & Doctor
    { id: 'agri-copilot', name: t.agriCopilot, icon: Leaf, description: t.agriCopilotDesc, pillar: 'health', badge: 'AI' },
    { id: 'weather-advisory', name: t.weatherAdvisory, icon: Cloud, description: t.weatherAdvisoryDesc, pillar: 'health' },
    { id: 'crop-health', name: t.cropHealth, icon: Satellite, description: t.cropHealthDesc, pillar: 'health' },
    { id: 'community-radar', name: t.communityRadar, icon: Radar, description: t.communityRadarDesc, pillar: 'health' },

    // Pillar 2: Planning & Resilience
    { id: 'smart-planting', name: t.smartPlanting, icon: Sprout, description: t.smartPlantingDesc, pillar: 'planning' },
    { id: 'climate-resilience', name: t.climateResilience, icon: Waves, description: t.climateResilienceDesc, pillar: 'planning', badge: lang === 'bn' ? 'জাত' : 'Guide' },

    // Pillar 3: Economics & Markets
    { id: 'krishi-profit', name: t.krishiProfit, icon: Calculator, description: t.krishiProfitDesc, pillar: 'economics', badge: lang === 'bn' ? 'নতুন' : 'New' },
    { id: 'market-connect', name: t.marketConnect, icon: TrendingUp, description: t.marketConnectDesc, pillar: 'economics' },
    { id: 'smart-grade', name: t.smartGrade, icon: Award, description: t.smartGradeDesc, pillar: 'economics' },
    { id: 'gov-schemes', name: t.govSchemes, icon: Landmark, description: t.govSchemesDesc, pillar: 'economics' },

    // Account & Help
    { id: 'user-guide', name: t.userGuide, icon: BookOpen, description: t.userGuideDesc, pillar: 'account' },
    { id: 'profile', name: t.profile, icon: UserCircle, description: t.profileDesc, pillar: 'account' },
    ...( (userRole === 'admin' || user?.email === 'sadmankhalili@gmail.com') ? [{ id: 'admin-dashboard' as const, name: 'Admin Hub', icon: BarChart3, description: 'Protocol & Analytics', pillar: 'account' as const }] : []),
  ];

  const pillarCategories = [
    { key: 'all' as PillarKey, label: lang === 'bn' ? 'সকল' : 'All' },
    { key: 'health' as PillarKey, label: lang === 'bn' ? 'স্বাস্থ্য' : 'Health' },
    { key: 'planning' as PillarKey, label: lang === 'bn' ? 'পরিকল্পনা' : 'Plan' },
    { key: 'economics' as PillarKey, label: lang === 'bn' ? 'বাজার/লাভ' : 'Market' },
  ];

  const filteredTabs = selectedPillarFilter === 'all' 
    ? tabs 
    : tabs.filter(t => t.pillar === selectedPillarFilter || t.pillar === 'account');

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
      
      <div className="h-[100dvh] w-full bg-[#F4F6F4] flex flex-col md:flex-row font-sans overflow-hidden">
        
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
            w-[86vw] max-w-sm md:w-80 rounded-r-3xl md:rounded-none bg-gradient-to-b from-emerald-950 via-emerald-900 to-green-950 text-white flex flex-col shadow-2xl z-50 h-full shrink-0 border-r border-emerald-800/40 pt-[max(0.25rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]
          `}
          role="navigation"
          aria-label={lang === 'bn' ? 'প্রধান নেভিগেশন' : 'Main navigation'}
        >
          {/* Brand Header */}
          <div className="p-4 sm:p-5 pb-4 flex items-center justify-between border-b border-white/10 bg-black/10">
            <div className="flex items-center space-x-3">
              <motion.div 
                whileHover={{ rotate: 12, scale: 1.05 }}
                className="bg-gradient-to-tr from-emerald-400 to-green-500 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20 text-emerald-950"
                aria-hidden="true"
              >
                <Leaf className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
              </motion.div>
              <div className="flex flex-col">
                <span className="font-display font-black text-lg sm:text-xl tracking-tight leading-none text-white">
                  {lang === 'bn' ? 'স্মার্ট কৃষি-সেবা' : 'Smart Agri-Tools'}
                </span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[9px] font-mono font-bold text-emerald-300 tracking-[0.1em] opacity-70 uppercase">
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
              className="md:hidden p-2.5 bg-white/10 rounded-2xl hover:bg-white/20 active:scale-90 text-white/90 focus:outline-none transition-all cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Pillar Category Filter Tabs (Quick Filter) */}
          <div className="px-3 pt-3 pb-1">
            <div className="grid grid-cols-4 gap-1 p-1 bg-emerald-950/80 rounded-2xl border border-emerald-800/40">
              {pillarCategories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedPillarFilter(cat.key)}
                  className={`py-1.5 px-1 text-[10px] font-black rounded-xl transition-all truncate text-center ${
                    selectedPillarFilter === cat.key
                      ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                      : 'text-emerald-300/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Tabs Navigation List */}
          <nav 
            className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto custom-scrollbar"
            role="tablist"
            aria-orientation="vertical"
          >
            {filteredTabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  role="tab"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02, duration: 0.2 }}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all duration-150 text-left relative overflow-hidden group outline-none ${
                    isActive 
                      ? 'bg-white text-emerald-950 shadow-xl shadow-emerald-950/30' 
                      : 'text-emerald-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="activeSidebarTabBg"
                      className="absolute inset-0 bg-white"
                      transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                    />
                  )}
                  
                  <div className="relative z-10 flex items-center space-x-3 min-w-0">
                    <div className={`p-2 rounded-xl transition-colors shrink-0 ${
                      isActive 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-emerald-900/60 text-emerald-300 group-hover:bg-white/15'
                    }`}>
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="truncate">
                      <div className="font-black text-xs uppercase tracking-wider truncate">{tab.name}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider truncate opacity-70 ${isActive ? 'text-emerald-800' : 'text-emerald-300'}`}>
                        {tab.description}
                      </div>
                    </div>
                  </div>

                  {tab.badge && (
                    <span className={`relative z-10 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ml-1 ${
                      isActive 
                        ? 'bg-emerald-800 text-white' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>
          
          {/* Sidebar Footer: DAE Hotline & Auth */}
          <div className="p-3.5 border-t border-white/10 bg-black/15 space-y-2.5 shrink-0">
            {/* Quick DAE Toll-Free Call Box */}
            <a 
              href="tel:16123"
              className="flex items-center justify-between p-2.5 bg-emerald-900/50 hover:bg-emerald-900/80 rounded-2xl border border-emerald-700/40 text-emerald-200 text-xs transition-colors group"
            >
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-emerald-500 text-emerald-950 rounded-xl group-hover:scale-105 transition-transform">
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-black text-[11px] text-white leading-tight">
                    {lang === 'bn' ? 'কৃষি কল সেন্টার' : 'Krishi Call Center'}
                  </div>
                  <div className="text-[10px] text-emerald-300 font-mono font-bold">16123 (বিনামূল্যে)</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </a>

            {/* Auth Button */}
            {user ? (
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-2xl border border-white/10">
                <button 
                  onClick={() => {
                    setActiveTab('profile');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2.5 text-left flex-1 hover:bg-white/5 p-1 rounded-xl transition-all"
                >
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center font-black text-white text-xs shadow-md">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                  <div className="text-xs truncate">
                    <div className="font-black tracking-tight truncate max-w-[90px] text-white">
                      {user.displayName}
                    </div>
                    <div className="text-emerald-400 text-[9px] font-bold uppercase tracking-wider">{userRole}</div>
                  </div>
                </button>
                <button 
                  onClick={signOut} 
                  className="p-2 hover:bg-red-500/20 rounded-xl text-emerald-300 hover:text-red-400 transition-all" 
                  title={t.signOut}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full flex items-center justify-center space-x-2 bg-white text-emerald-950 font-black py-2.5 px-4 rounded-xl hover:bg-emerald-50 active:scale-95 transition-all shadow-md text-xs uppercase tracking-wider"
              >
                <LogIn className="w-4 h-4" />
                <span>{t.signIn}</span>
              </button>
            )}

            <div className="text-center pt-0.5">
              <button 
                onClick={() => setIsLegalOpen(true)}
                className="text-[9px] text-emerald-300/60 hover:text-emerald-300 underline underline-offset-2 uppercase tracking-wider transition-colors"
              >
                {lang === 'bn' ? 'গোপনীয়তা ও শর্তাবলী' : 'Privacy & Terms'}
              </button>
            </div>
          </div>
        </div>

        {/* ======================= MAIN CONTENT AREA ======================= */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          
          {/* ================= STANDARDIZED PERSISTENT TOP BAR ================= */}
          <header className="bg-white/95 backdrop-blur-md sticky top-0 border-b border-gray-200/80 px-2.5 sm:px-4 md:px-6 py-2 sm:py-2.5 flex items-center justify-between z-30 shrink-0 shadow-xs pt-[max(0.5rem,env(safe-area-inset-top))]">
            {/* Left: Mobile Menu Toggle & Active Module Info */}
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <button 
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl transition-all active:scale-95 shrink-0"
                aria-label={lang === 'bn' ? 'মেনু খুলুন' : 'Open Menu'}
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2 truncate">
                {activeTabDetails && (
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <div className="p-1 sm:p-1.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
                      <activeTabDetails.icon className="w-4 h-4" />
                    </div>
                    <h1 className="font-black text-xs sm:text-base text-gray-900 tracking-tight truncate max-w-[110px] sm:max-w-none m-0 leading-tight">
                      {activeTabDetails.name}
                    </h1>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Universal Location Chip, Language Toggle & Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2">
              
              {/* Universal Location Chip with 1-Click Switcher */}
              <Tooltip content={lang === 'bn' ? 'উপজেলা বা জেলা পরিবর্তন করুন' : 'Click to change District / Upazila'}>
                <button
                  type="button"
                  onClick={() => setIsRegionModalOpen(true)}
                  className="flex items-center space-x-1 sm:space-x-1.5 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/70 px-2 py-1.5 sm:px-2.5 rounded-xl transition-all active:scale-95 shadow-2xs group shrink-0"
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
                  <MapPin className={`w-3.5 h-3.5 shrink-0 ${globalLocation ? 'text-emerald-700' : 'text-amber-600'}`} />
                  <span className="text-[11px] sm:text-xs font-black truncate max-w-[70px] sm:max-w-[160px]">
                    {isLocNameLoading ? (
                      <span className="opacity-60">{lang === 'bn' ? 'খোঁজা হচ্ছে...' : 'Locating...'}</span>
                    ) : (
                      locationName || (lang === 'bn' ? 'অবস্থান নির্বাচন' : 'Set Location')
                    )}
                  </span>
                  <ChevronDown className="w-3 h-3 text-emerald-600/70 shrink-0" />
                </button>
              </Tooltip>

              {/* Language Switcher Pill */}
              <button 
                type="button"
                onClick={toggleLanguage} 
                className="flex items-center space-x-1 font-black text-[11px] sm:text-xs bg-gray-100/90 hover:bg-gray-200 text-gray-800 px-2 py-1.5 sm:px-2.5 rounded-xl border border-gray-200 transition-all active:scale-95 shrink-0"
                title="Toggle Language"
              >
                <Globe className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
              </button>

              {/* Profile or Sign-in Quick Pill */}
              {user ? (
                <button
                  onClick={() => setActiveTab('profile')}
                  className="p-1 sm:p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-all shrink-0"
                  title="Profile"
                >
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex items-center space-x-1 sm:space-x-1.5 text-[11px] sm:text-xs font-black bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1.5 sm:px-3 rounded-xl transition-all shadow-xs active:scale-95 shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.signIn}</span>
                </button>
              )}
            </div>
          </header>

          {/* ================= SCROLLABLE MAIN CONTENT ================= */}
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto custom-scrollbar w-full relative bg-[#F7F8F6] pb-28 md:pb-6">
            
            {/* Background Texture Grid */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.025] pointer-events-none" 
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
            onOpenAllTools={() => setIsMobileMenuOpen(true)}
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

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, TrendingUp, UserCircle, Cloud, Satellite, BarChart3, Radar, Landmark, Sprout, ShieldCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Lazy load components
const AgriCopilot = lazy(() => import('./AgriCopilot'));
const SmartGrade = lazy(() => import('./SmartGrade'));
const SmartPlanting = lazy(() => import('./SmartPlanting'));
const MarketConnect = lazy(() => import('./MarketConnect'));
const WeatherAdvisory = lazy(() => import('./WeatherAdvisory'));
const SatelliteHealth = lazy(() => import('./SatelliteHealth'));
const MacroTrends = lazy(() => import('./MacroTrends'));
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

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'macro-trends' | 'community-radar' | 'gov-schemes' | 'user-guide' | 'profile' | 'admin-dashboard';

export default function Layout() {
  const [activeTab, setActiveTab] = useState<Tab>('agri-copilot');
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['agri-copilot']));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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

  // MarketConnect State Persistence
  const [marketInsights, setMarketInsights] = useState<any | null>(null);
  const [marketProduce, setMarketProduce] = useState<string>('tomato');

  // Global Location State
  const [globalLocation, setGlobalLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const { user, userRole, isAuthReady, signIn, signOut } = useAuth();

  const t = translations[lang];

  const tabs: { id: Tab; name: string; icon: any; description: string }[] = [
    { id: 'agri-copilot', name: t.agriCopilot, icon: Leaf, description: t.agriCopilotDesc },
    { id: 'smart-planting', name: t.smartPlanting, icon: Sprout, description: t.smartPlantingDesc },
    { id: 'weather-advisory', name: t.weatherAdvisory, icon: Cloud, description: t.weatherAdvisoryDesc },
    { id: 'crop-health', name: t.cropHealth, icon: Satellite, description: t.cropHealthDesc },
    { id: 'smart-grade', name: t.smartGrade, icon: Award, description: t.smartGradeDesc },
    { id: 'market-connect', name: t.marketConnect, icon: TrendingUp, description: t.marketConnectDesc },
    { id: 'community-radar', name: t.communityRadar, icon: Radar, description: t.communityRadarDesc },
    { id: 'gov-schemes', name: t.govSchemes, icon: Landmark, description: t.govSchemesDesc },
    { id: 'macro-trends', name: lang === 'bn' ? 'জাতীয় প্রবণতা' : 'National Trends', icon: BarChart3, description: lang === 'bn' ? 'বিশ্বব্যাংকের সামষ্টিক অর্থনৈতিক তথ্য' : 'World Bank Macro-Economic Data' },
    { id: 'user-guide', name: t.userGuide, icon: BookOpen, description: t.userGuideDesc },
    { id: 'profile', name: t.profile, icon: UserCircle, description: t.profileDesc },
    ...( (userRole === 'admin' || user?.email === 'sadmankhalili@gmail.com') ? [{ id: 'admin-dashboard' as const, name: 'Admin Hub', icon: BarChart3, description: 'Protocol & Analytics' }] : []),
  ];

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'bn' : 'en');
  };

  return (
    <>
      <OfflineBanner lang={lang} />
      <div className="h-[100dvh] w-full bg-gray-50 flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-green-700/90 backdrop-blur-md text-white p-4 flex justify-between items-center shadow-lg z-30 shrink-0 sticky top-0 border-b border-white/10">
        <div className="flex items-center space-x-2">
          <Leaf className="w-6 h-6 text-green-300" />
          <span className="font-display font-black text-lg tracking-tighter uppercase">{t.agriCopilot}</span>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            type="button"
            onClick={toggleLanguage} 
            className="flex items-center space-x-1 font-black text-[10px] bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/10 shadow-sm transition-all active:scale-95"
          >
            <Globe className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
            <span>{lang === 'en' ? 'BN' : 'EN'}</span>
          </button>
          <button 
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all active:scale-95"
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Sidebar / Mobile Drawer */}
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
          w-80 bg-gradient-to-b from-green-900 via-green-800 to-emerald-900 text-white flex flex-col shadow-2xl z-50 h-full shrink-0
        `}
        role="navigation"
        aria-label={lang === 'bn' ? 'প্রধান নেভিগেশন' : 'Main navigation'}
      >
        <div className="p-8 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center space-x-4">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg"
              aria-hidden="true"
            >
              <Leaf className="w-8 h-8 text-green-400" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl tracking-tighter uppercase italic leading-none">{t.agriCopilot}</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-[10px] font-mono font-bold text-green-300 tracking-[0.1em] opacity-40 uppercase">v3.0-Live</span>
                {(userRole === 'admin' || user?.email === 'sadmankhalili@gmail.com') && (
                  <div className="inline-flex items-center space-x-1.5 bg-yellow-400 text-gray-900 px-2 py-0.5 mt-0.5 rounded-full border border-yellow-300 shadow-lg shadow-yellow-400/20">
                    <div className="w-1.5 h-1.5 bg-gray-900 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black uppercase tracking-widest">Admin Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              type="button"
              onClick={toggleLanguage} 
              className="md:flex hidden text-green-200/60 hover:text-white transition-all p-2 hover:bg-white/10 rounded-xl focus:outline-none"
              title="Toggle Language"
            >
              <Globe className="w-5 h-5" aria-hidden="true" />
            </button>
            <button 
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-2 bg-white/5 rounded-xl hover:bg-white/10 focus:outline-none"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>
        </div>
        
        <nav 
          className="flex-1 px-4 py-8 space-y-3 overflow-y-auto custom-scrollbar"
          role="tablist"
          aria-orientation="vertical"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-4 px-5 py-3.5 mt-1 rounded-[24px] transition-all duration-200 text-left relative overflow-hidden group focus:ring-2 focus:ring-white/50 outline-none ${
                  isActive 
                    ? 'bg-white text-green-900 shadow-xl shadow-green-950/20' 
                    : 'text-green-100 hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white"
                    transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                  />
                )}
                <div className="relative z-10 flex items-center space-x-4">
                  <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-green-100 text-green-700' : 'bg-white/5 text-green-300 group-hover:bg-white/10'}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-black text-sm uppercase tracking-wider">{tab.name}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest opacity-60 mt-0.5 ${isActive ? 'text-green-800' : 'text-green-200'}`}>
                      {tab.description}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </nav>
        
        <div className="p-6 border-t border-white/10 space-y-6 pb-10 md:pb-8">
          {/* Auth Section */}
          {user ? (
            <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
              <button 
                onClick={() => setActiveTab('profile')}
                className="flex items-center space-x-3 text-left flex-1 hover:bg-white/5 p-1 rounded-xl transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center font-black text-white shadow-lg border border-white/20 group-hover:scale-105 transition-transform">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
                <div className="text-sm">
                  <div className="font-black tracking-tight truncate max-w-[100px] flex items-center gap-1.5">
                    {user.displayName}
                    {userRole === 'admin' && <ShieldCheck className="w-3 h-3 text-blue-400" />}
                  </div>
                  <div className="text-green-400 text-[10px] font-bold uppercase tracking-widest">{userRole}</div>
                </div>
              </button>
              <motion.button 
                whileHover={{ rotate: 90 }}
                onClick={signOut} 
                className="p-2.5 hover:bg-red-500/20 rounded-xl text-green-300 hover:text-red-400 transition-all border border-transparent hover:border-red-500/30" 
                title={t.signOut}
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full flex items-center justify-center space-x-3 bg-white text-green-900 font-black py-4 px-6 rounded-2xl hover:bg-green-50 transition-all shadow-xl shadow-green-950/20 text-sm uppercase tracking-widest"
            >
              <LogIn className="w-5 h-5" />
              <span>{t.signIn}</span>
            </motion.button>
          )}
          <div className="text-center pt-2">
            <button 
              onClick={() => setIsLegalOpen(true)}
              className="text-[10px] text-green-300/60 hover:text-green-300 underline underline-offset-2 uppercase tracking-wider transition-colors"
            >
              {lang === 'bn' ? 'গোপনীয়তা নীতি ও শর্তাবলী' : 'Privacy Policy & Terms'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar w-full max-w-7xl mx-auto relative bg-[#F7F7F5]">
        {/* Background Decorative Elements */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#141414 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
        </div>

        <div className="relative z-10 min-h-full flex flex-col">
          <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-green-700/40">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <div className="font-display font-black text-xs uppercase tracking-widest leading-none">Initializing Module...</div>
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
                />
              )}
            </div>
            <div className={activeTab === 'macro-trends' ? 'block flex-1' : 'hidden'}>
               {visitedTabs.has('macro-trends') && <MacroTrends lang={lang} />}
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

          <GoogleAd lang={lang} className="mt-12 mb-4" />
        </div>
      </main>
      
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

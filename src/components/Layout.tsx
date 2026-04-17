import React, { useState } from 'react';
import { Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, TrendingUp, UserCircle, Cloud, Satellite, BarChart3, Radar, Landmark, Sprout, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgriCopilot from './AgriCopilot';
import SmartGrade from './SmartGrade';
import SmartPlanting from './SmartPlanting';
import MarketConnect from './MarketConnect';
import WeatherAdvisory from './WeatherAdvisory';
import SatelliteHealth from './SatelliteHealth';
import MacroTrends from './MacroTrends';
import CommunityRadar from './CommunityRadar';
import GovSchemes from './GovSchemes';
import UserGuide from './UserGuide';
import Profile from './Profile';
import PricingModal from './PricingModal';
import { useAuth } from './AuthProvider';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';
import GoogleAd from './GoogleAd';

type Tab = 'agri-copilot' | 'smart-grade' | 'smart-planting' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'macro-trends' | 'community-radar' | 'gov-schemes' | 'user-guide' | 'profile';

export default function Layout() {
  const [activeTab, setActiveTab] = useState<Tab>('agri-copilot');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [lang, setLang] = useState<Language>('bn');

  // AgriCopilot State Persistence
  const [agriImages, setAgriImages] = useState<{ base64: string; mimeType: string }[]>([]);
  const [agriDiagnosis, setAgriDiagnosis] = useState<any | null>(null);
  const [agriChatMessages, setAgriChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [agriChatSession, setAgriChatSession] = useState<any | null>(null);
  const [agriAudioUrl, setAgriAudioUrl] = useState<string | null>(null);
  const [agriCropStage, setAgriCropStage] = useState<string>('vegetative');
  const [agriCrop, setAgriCrop] = useState<string>('tomato');
  const [agriAnalysisType, setAgriAnalysisType] = useState<string>('disease');

  // MarketConnect State Persistence
  const [marketInsights, setMarketInsights] = useState<any | null>(null);
  const [marketProduce, setMarketProduce] = useState<string>('tomato');

  // Global Location State
  const [globalLocation, setGlobalLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const { user, userRole, isAuthReady, signIn, signOut } = useAuth();

  const t = translations[lang];

  const tabs = [
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
  ] as const;

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'bn' : 'en');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-green-700 text-white p-4 flex justify-between items-center shadow-md z-30 sticky top-0">
        <div className="flex items-center space-x-2">
          <Leaf className="w-6 h-6 text-green-300" />
          <span className="font-bold text-lg tracking-tight">{t.agriCopilot}</span>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={toggleLanguage} 
            className="flex items-center space-x-1 font-bold text-xs bg-green-800 px-2.5 py-1.5 rounded-lg border border-green-600 shadow-sm"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{lang === 'en' ? 'BN' : 'EN'}</span>
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 bg-green-800 rounded-lg"
          >
            <Menu className="w-6 h-6" />
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className={`
        fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:sticky md:top-0 md:translate-x-0 transition-transform duration-500 ease-in-out
        w-80 bg-gradient-to-b from-green-900 via-green-800 to-emerald-900 text-white flex flex-col shadow-2xl z-50 h-[100dvh]
      `}>
        <div className="p-8 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-4">
            <motion.div 
              whileHover={{ rotate: 15 }}
              className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg"
            >
              <Leaf className="w-8 h-8 text-green-300" />
            </motion.div>
            <span className="font-black text-2xl tracking-tighter uppercase italic">{t.agriCopilot}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={toggleLanguage} 
              className="md:flex hidden text-green-200 hover:text-white transition-all p-2 hover:bg-white/10 rounded-xl border border-transparent hover:border-white/20"
              title="Toggle Language"
            >
              <Globe className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-3 overflow-y-auto custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileHover={{ x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-4 px-5 py-4 rounded-[24px] transition-all duration-300 text-left relative overflow-hidden group ${
                  isActive 
                    ? 'bg-white text-green-900 shadow-xl shadow-green-950/20' 
                    : 'text-green-100 hover:bg-white/10'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative z-10 flex items-center space-x-4">
                  <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-green-100 text-green-700' : 'bg-white/5 text-green-300 group-hover:bg-white/10'}`}>
                    <Icon className="w-5 h-5" />
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
              onClick={signIn}
              className="w-full flex items-center justify-center space-x-3 bg-white text-green-900 font-black py-4 px-6 rounded-2xl hover:bg-green-50 transition-all shadow-xl shadow-green-950/20 text-sm uppercase tracking-widest"
            >
              <LogIn className="w-5 h-5" />
              <span>{t.signIn}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto w-full max-w-7xl mx-auto relative">
        {/* Background Decorative Elements */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-100/50 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/50 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative z-10 min-h-full flex flex-col">
          <div className={activeTab === 'agri-copilot' ? 'block flex-1' : 'hidden'}>
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
          </div>
          <div className={activeTab === 'weather-advisory' ? 'block flex-1' : 'hidden'}>
            <WeatherAdvisory 
              lang={lang} 
              globalLocation={globalLocation}
              setGlobalLocation={setGlobalLocation}
            />
          </div>
          <div className={activeTab === 'crop-health' ? 'block flex-1' : 'hidden'}>
            <SatelliteHealth 
              lang={lang} 
              globalLocation={globalLocation}
              setGlobalLocation={setGlobalLocation}
            />
          </div>
          <div className={activeTab === 'smart-grade' ? 'block flex-1' : 'hidden'}>
            <SmartGrade lang={lang} />
          </div>
          <div className={activeTab === 'smart-planting' ? 'block flex-1' : 'hidden'}>
            <SmartPlanting 
              lang={lang} 
              globalLocation={globalLocation}
              setGlobalLocation={setGlobalLocation}
            />
          </div>
          <div className={activeTab === 'market-connect' ? 'block flex-1' : 'hidden'}>
            <MarketConnect 
              lang={lang} 
              persistedInsights={marketInsights}
              setPersistedInsights={setMarketInsights}
              persistedProduce={marketProduce}
              setPersistedProduce={setMarketProduce}
            />
          </div>
          <div className={activeTab === 'macro-trends' ? 'block flex-1' : 'hidden'}>
            <MacroTrends lang={lang} />
          </div>
          <div className={activeTab === 'community-radar' ? 'block flex-1' : 'hidden'}>
            <CommunityRadar lang={lang} />
          </div>
          <div className={activeTab === 'gov-schemes' ? 'block flex-1' : 'hidden'}>
            <GovSchemes lang={lang} globalLocation={globalLocation} />
          </div>
          <div className={activeTab === 'user-guide' ? 'block flex-1' : 'hidden'}>
            <UserGuide lang={lang} />
          </div>
          <div className={activeTab === 'profile' ? 'block flex-1' : 'hidden'}>
            <Profile lang={lang} onUpgrade={() => setIsPricingOpen(true)} />
          </div>

          <GoogleAd lang={lang} className="mt-12 mb-4" />
        </div>
      </main>
      
      {/* Pricing Modal */}
      <PricingModal 
        isOpen={isPricingOpen} 
        onClose={() => setIsPricingOpen(false)} 
        lang={lang} 
      />
    </div>
  );
}

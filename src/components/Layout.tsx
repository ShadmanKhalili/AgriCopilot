import React, { useState } from 'react';
import { Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, Crown, TrendingUp, UserCircle, HelpCircle, Cloud, Satellite } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgriCopilot from './AgriCopilot';
import SmartGrade from './SmartGrade';
import MarketConnect from './MarketConnect';
import WeatherAdvisory from './WeatherAdvisory';
import SatelliteHealth from './SatelliteHealth';
import UserGuide from './UserGuide';
import Profile from './Profile';
import PricingModal from './PricingModal';
import { useAuth } from './AuthProvider';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';

type Tab = 'agri-copilot' | 'smart-grade' | 'market-connect' | 'weather-advisory' | 'crop-health' | 'user-guide' | 'profile';

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
  const [marketQuantity, setMarketQuantity] = useState<string>('100');

  const { user, userRole, isAuthReady, signIn, signOut } = useAuth();
  const { currentUsage, limit, tier } = useUsageTracking();

  const t = translations[lang];

  const tabs = [
    { id: 'agri-copilot', name: t.agriCopilot, icon: Leaf, description: t.agriCopilotDesc },
    { id: 'smart-grade', name: t.smartGrade, icon: Award, description: t.smartGradeDesc },
    { id: 'market-connect', name: t.marketConnect, icon: TrendingUp, description: t.marketConnectDesc },
    { id: 'weather-advisory', name: t.weatherAdvisory, icon: Cloud, description: t.weatherAdvisoryDesc },
    { id: 'crop-health', name: t.cropHealth, icon: Satellite, description: t.cropHealthDesc },
    { id: 'user-guide', name: t.userGuide, icon: BookOpen, description: t.userGuideDesc },
    { id: 'profile', name: t.profile, icon: UserCircle, description: t.profileDesc },
  ] as const;

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  const toggleLanguage = () => {
    setLang(prev => prev === 'en' ? 'bn' : 'en');
  };

  const getTierName = () => {
    if (tier === 'premium') return t.premiumTier;
    if (tier === 'free') return t.freeTier;
    return t.anonTier;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden bg-green-700 text-white p-4 flex justify-between items-center shadow-md z-30 sticky top-0">
        <div className="flex items-center space-x-2">
          <Leaf className="w-6 h-6 text-green-300" />
          <span className="font-bold text-lg tracking-tight">Agri-Copilot</span>
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
        md:relative md:translate-x-0 transition-transform duration-500 ease-in-out
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
            <span className="font-black text-2xl tracking-tighter uppercase italic">Agri-Copilot</span>
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
          {/* Usage Stats */}
          <div className="bg-black/20 backdrop-blur-md rounded-[32px] p-6 border border-white/10 shadow-inner">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-green-300 uppercase tracking-widest">{t.usage}</span>
                <Tooltip content={t.tooltips.usage} position="right">
                  <HelpCircle className="w-3 h-3 text-green-500 cursor-help" />
                </Tooltip>
              </div>
              <span className="text-[10px] font-black text-white bg-white/10 px-2 py-1 rounded-lg">
                {currentUsage} / {limit === Infinity ? '∞' : limit}
              </span>
            </div>
            <div className="w-full bg-black/30 rounded-full h-2.5 overflow-hidden shadow-inner p-0.5">
              <motion.div 
                className={`h-full rounded-full shadow-sm ${tier === 'premium' ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-green-400 to-emerald-400'}`} 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((currentUsage / (limit === Infinity ? 1 : limit)) * 100, 100)}%` }}
                transition={{ duration: 1.5, ease: "circOut" }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">{getTierName()}</span>
              {tier !== 'premium' && (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={user ? () => setIsPricingOpen(true) : signIn}
                  className="flex items-center space-x-1.5 text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black px-3 py-1.5 rounded-full shadow-lg shadow-orange-900/20 transition-all"
                >
                  <Crown className="w-3 h-3" />
                  <span className="uppercase tracking-widest">{t.upgrade}</span>
                </motion.button>
              )}
            </div>
          </div>

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
                  <div className="font-black tracking-tight truncate max-w-[100px]">{user.displayName}</div>
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
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.98 }}
              transition={{ 
                type: "spring",
                stiffness: 100,
                damping: 20
              }}
              className="flex-1"
            >
              {activeTab === 'agri-copilot' && (
                <AgriCopilot 
                  lang={lang} 
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
              {activeTab === 'smart-grade' && <SmartGrade lang={lang} />}
              {activeTab === 'market-connect' && (
                <MarketConnect 
                  lang={lang} 
                  persistedInsights={marketInsights}
                  setPersistedInsights={setMarketInsights}
                  persistedProduce={marketProduce}
                  setPersistedProduce={setMarketProduce}
                  persistedQuantity={marketQuantity}
                  setPersistedQuantity={setMarketQuantity}
                />
              )}
              {activeTab === 'weather-advisory' && (
                <WeatherAdvisory lang={lang} />
              )}
              {activeTab === 'crop-health' && (
                <SatelliteHealth lang={lang} />
              )}
              {activeTab === 'user-guide' && <UserGuide lang={lang} />}
              {activeTab === 'profile' && <Profile lang={lang} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      
      {/* Mobile Overlay - Removed as it's handled by AnimatePresence above */}

      {/* Pricing Modal */}
      <PricingModal 
        isOpen={isPricingOpen} 
        onClose={() => setIsPricingOpen(false)} 
        lang={lang} 
      />
    </div>
  );
}

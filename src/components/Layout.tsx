import React, { useState } from 'react';
import { Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, Crown, TrendingUp, UserCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AgriCopilot from './AgriCopilot';
import SmartGrade from './SmartGrade';
import MarketConnect from './MarketConnect';
import UserGuide from './UserGuide';
import Profile from './Profile';
import PricingModal from './PricingModal';
import { useAuth } from './AuthProvider';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import Tooltip from './Tooltip';

type Tab = 'agri-copilot' | 'smart-grade' | 'market-connect' | 'user-guide' | 'profile';

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
  const [agriUpazila, setAgriUpazila] = useState<string>('teknaf');
  const [agriCrop, setAgriCrop] = useState<string>('tomato');
  const [agriAnalysisType, setAgriAnalysisType] = useState<string>('disease');

  // MarketConnect State Persistence
  const [marketInsights, setMarketInsights] = useState<any | null>(null);
  const [marketProduce, setMarketProduce] = useState<string>('tomato');
  const [marketLocation, setMarketLocation] = useState<string>('kawranBazar');

  const { user, userRole, isAuthReady, signIn, signOut } = useAuth();
  const { currentUsage, limit, tier } = useUsageTracking();

  const t = translations[lang];

  const tabs = [
    { id: 'agri-copilot', name: t.agriCopilot, icon: Leaf, description: t.agriCopilotDesc },
    { id: 'smart-grade', name: t.smartGrade, icon: Award, description: t.smartGradeDesc },
    { id: 'market-connect', name: t.marketConnect, icon: TrendingUp, description: t.marketConnectDesc },
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
        md:relative md:translate-x-0 transition-transform duration-300 ease-in-out
        w-72 bg-green-800 text-white flex flex-col shadow-2xl z-50 h-[100dvh]
      `}>
        <div className="p-6 flex items-center justify-between border-b border-green-700/50">
          <div className="flex items-center space-x-3">
            <Leaf className="w-8 h-8 text-green-300" />
            <span className="font-bold text-xl tracking-tight">Agri-Copilot</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={toggleLanguage} 
              className="md:flex hidden text-green-200 hover:text-white transition-colors p-1.5 hover:bg-green-700 rounded-lg"
              title="Toggle Language"
            >
              <Globe className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden p-2 bg-green-700/50 rounded-xl hover:bg-green-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                  isActive ? 'bg-green-700 text-white shadow-md scale-[1.02]' : 'text-green-100 hover:bg-green-700/50 hover:scale-[1.01]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-green-300' : 'text-green-200'}`} />
                <div>
                  <div className="font-medium">{tab.name}</div>
                  <div className="text-xs opacity-80 mt-0.5">{tab.description}</div>
                </div>
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-green-700/50 space-y-4 pb-8 md:pb-6">
          {/* Usage Stats */}
          <div className="bg-green-900/50 rounded-xl p-4 shadow-inner">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-1">
                <span className="text-xs font-medium text-green-200">{t.usage} ({getTierName()})</span>
                <Tooltip content={t.tooltips.usage} position="right">
                  <HelpCircle className="w-3 h-3 text-green-400" />
                </Tooltip>
              </div>
              <span className="text-xs font-bold text-white">
                {currentUsage} / {limit === Infinity ? '∞' : limit}
              </span>
            </div>
            <div className="w-full bg-green-950 rounded-full h-2 overflow-hidden">
              <motion.div 
                className={`h-full rounded-full ${tier === 'premium' ? 'bg-yellow-400' : 'bg-green-400'}`} 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((currentUsage / (limit === Infinity ? 1 : limit)) * 100, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
            {tier !== 'premium' && (
              <button 
                onClick={user ? () => setIsPricingOpen(true) : signIn}
                className="mt-4 w-full flex items-center justify-center space-x-1 text-xs bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-yellow-950 font-bold py-2 rounded-lg shadow-sm transition-all hover:shadow-md"
              >
                <Crown className="w-4 h-4" />
                <span>{t.upgrade}</span>
              </button>
            )}
          </div>

          {/* Auth Section */}
          {user ? (
            <div className="flex items-center justify-between bg-green-900/30 p-3 rounded-xl">
              <button 
                onClick={() => setActiveTab('profile')}
                className="flex items-center space-x-3 text-left flex-1 hover:bg-green-700/50 p-1 rounded-lg transition-colors"
              >
                <div className="text-sm">
                  <div className="font-medium truncate max-w-[120px]">{user.displayName}</div>
                  <div className="text-green-300 text-xs capitalize">{userRole}</div>
                </div>
              </button>
              <button onClick={signOut} className="p-2 hover:bg-green-700 rounded-lg text-green-200 hover:text-white transition-colors" title={t.signOut}>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center space-x-2 bg-white text-green-800 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>{t.signIn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-3 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 min-h-[calc(100vh-2rem)] relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
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
                  persistedUpazila={agriUpazila}
                  setPersistedUpazila={setAgriUpazila}
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
                  persistedLocation={marketLocation}
                  setPersistedLocation={setMarketLocation}
                />
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

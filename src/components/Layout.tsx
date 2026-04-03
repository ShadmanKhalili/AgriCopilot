import React, { useState } from 'react';
import { Leaf, Award, Menu, X, LogOut, LogIn, BookOpen, Globe, Crown, TrendingUp } from 'lucide-react';
import AgriCopilot from './AgriCopilot';
import SmartGrade from './SmartGrade';
import MarketConnect from './MarketConnect';
import UserGuide from './UserGuide';
import PricingModal from './PricingModal';
import { useAuth } from './AuthProvider';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';

type Tab = 'agri-copilot' | 'smart-grade' | 'market-connect' | 'user-guide';

export default function Layout() {
  const [activeTab, setActiveTab] = useState<Tab>('agri-copilot');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const { user, userRole, isAuthReady, signIn, signOut } = useAuth();
  const { currentUsage, limit, tier } = useUsageTracking();

  const t = translations[lang];

  const tabs = [
    { id: 'agri-copilot', name: t.agriCopilot, icon: Leaf, description: t.agriCopilotDesc },
    { id: 'smart-grade', name: t.smartGrade, icon: Award, description: t.smartGradeDesc },
    { id: 'market-connect', name: t.marketConnect, icon: TrendingUp, description: t.marketConnectDesc },
    { id: 'user-guide', name: t.userGuide, icon: BookOpen, description: t.userGuideDesc },
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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-green-700 text-white p-4 flex justify-between items-center shadow-md z-20">
        <div className="flex items-center space-x-2">
          <Leaf className="w-6 h-6" />
          <span className="font-bold text-lg">{t.appTitle}</span>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={toggleLanguage} className="font-medium text-sm bg-green-800 px-2 py-1 rounded">
            {lang === 'en' ? 'BN' : 'EN'}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 transition duration-200 ease-in-out
        w-64 bg-green-800 text-white flex flex-col shadow-xl z-10
      `}>
        <div className="p-6 hidden md:flex items-center justify-between border-b border-green-700">
          <div className="flex items-center space-x-3">
            <Leaf className="w-8 h-8 text-green-300" />
            <span className="font-bold text-xl tracking-tight">Agri-Tools</span>
          </div>
          <button onClick={toggleLanguage} className="text-green-200 hover:text-white transition-colors" title="Toggle Language">
            <Globe className="w-5 h-5" />
          </button>
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
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left ${
                  isActive ? 'bg-green-700 text-white shadow-sm' : 'text-green-100 hover:bg-green-700/50'
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
        
        <div className="p-4 border-t border-green-700 space-y-4">
          {/* Usage Stats */}
          <div className="bg-green-900/50 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-green-200">{t.usage} ({getTierName()})</span>
              <span className="text-xs font-bold text-white">
                {currentUsage} / {limit === Infinity ? '∞' : limit}
              </span>
            </div>
            <div className="w-full bg-green-950 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${tier === 'premium' ? 'bg-yellow-400' : 'bg-green-400'}`} 
                style={{ width: `${Math.min((currentUsage / (limit === Infinity ? 1 : limit)) * 100, 100)}%` }}
              ></div>
            </div>
            {tier !== 'premium' && (
              <button 
                onClick={user ? () => setIsPricingOpen(true) : signIn}
                className="mt-3 w-full flex items-center justify-center space-x-1 text-xs bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold py-1.5 rounded transition-colors"
              >
                <Crown className="w-3 h-3" />
                <span>{t.upgrade}</span>
              </button>
            )}
          </div>

          {/* Auth Section */}
          {user ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium truncate max-w-[150px]">{user.displayName}</div>
                <div className="text-green-300 text-xs capitalize">{userRole}</div>
              </div>
              <button onClick={signOut} className="p-2 hover:bg-green-700 rounded-lg text-green-200 hover:text-white transition-colors" title={t.signOut}>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={signIn}
              className="w-full flex items-center justify-center space-x-2 bg-white text-green-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>{t.signIn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-8 min-h-[calc(100vh-2rem)]">
          {activeTab === 'agri-copilot' && <AgriCopilot lang={lang} />}
          {activeTab === 'smart-grade' && <SmartGrade lang={lang} />}
          {activeTab === 'market-connect' && <MarketConnect lang={lang} />}
          {activeTab === 'user-guide' && <UserGuide lang={lang} />}
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-0 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Pricing Modal */}
      <PricingModal 
        isOpen={isPricingOpen} 
        onClose={() => setIsPricingOpen(false)} 
        lang={lang} 
      />
    </div>
  );
}

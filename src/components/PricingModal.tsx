import React from 'react';
import { X, Check, Zap, Shield, Crown, Sparkles } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { useAuth } from './AuthProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function PricingModal({ isOpen, onClose, lang }: Props) {
  const { user, userProfile, upgradeToPremium } = useAuth();
  const t = translations[lang];

  const handleUpgrade = async () => {
    if (!user) {
      alert("Please sign in first.");
      return;
    }
    await upgradeToPremium();
    onClose();
  };

  const isPremium = userProfile?.tier === 'premium';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/95 backdrop-blur-2xl rounded-[40px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 border border-white/20"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 opacity-30 pointer-events-none"></div>

            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg shadow-green-100">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{t.pricingTitle}</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2.5 hover:bg-gray-100 rounded-2xl transition-all hover:rotate-90"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-8 md:p-12 overflow-y-auto custom-scrollbar relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                
                {/* Basic Tier */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col relative overflow-hidden group"
                >
                  <div className="mb-8">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t.pricingBasic}</h3>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed">{t.pricingBasicDesc}</p>
                  </div>
                  <div className="mb-10 flex items-baseline">
                    <span className="text-5xl font-black text-gray-900 tracking-tighter">৳0</span>
                    <span className="text-gray-400 font-bold ml-1 uppercase tracking-widest text-[10px]">/mo</span>
                  </div>
                  <ul className="space-y-5 mb-10 flex-1">
                    {[
                      { text: `10 ${t.usesPerMonth}`, icon: Check },
                      { text: t.agriCopilot, icon: Check },
                      { text: t.smartGrade, icon: Check }
                    ].map((item, i) => (
                      <li key={i} className="flex items-center space-x-3">
                        <div className="bg-green-50 p-1 rounded-lg">
                          <item.icon className="w-4 h-4 text-green-500" />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button 
                    disabled={true}
                    className="w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-100"
                  >
                    {t.currentPlan}
                  </button>
                </motion.div>

                {/* Premium Tier */}
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 p-1 rounded-[36px] shadow-2xl shadow-green-200 flex flex-col relative transform md:-translate-y-4"
                >
                  <div className="bg-white rounded-[34px] p-8 flex flex-col h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
                    
                    <div className="absolute top-4 right-4">
                      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center">
                        <Crown className="w-3 h-3 mr-1.5" /> Recommended
                      </div>
                    </div>

                    <div className="mb-8 relative z-10">
                      <h3 className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">{t.pricingPremium}</h3>
                      <p className="text-gray-500 text-sm font-medium leading-relaxed">{t.pricingPremiumDesc}</p>
                    </div>
                    <div className="mb-10 flex items-baseline relative z-10">
                      <span className="text-5xl font-black text-gray-900 tracking-tighter">৳500</span>
                      <span className="text-gray-400 font-bold ml-1 uppercase tracking-widest text-[10px]">/mo</span>
                    </div>
                    <ul className="space-y-5 mb-10 flex-1 relative z-10">
                      {[
                        { text: `50 ${t.usesPerMonth}`, icon: Zap },
                        { text: t.advancedAnalysis, icon: Sparkles },
                        { text: "Priority Processing", icon: Shield }
                      ].map((item, i) => (
                        <li key={i} className="flex items-center space-x-3">
                          <div className="bg-green-50 p-1 rounded-lg">
                            <item.icon className="w-4 h-4 text-green-500" />
                          </div>
                          <span className="text-sm font-black text-gray-900">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUpgrade}
                      disabled={isPremium}
                      className={`w-full py-5 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all relative z-10 shadow-xl ${
                        isPremium 
                          ? 'bg-green-50 text-green-600 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-green-200'
                      }`}
                    >
                      {isPremium ? t.currentPlan : t.subscribe}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Enterprise Tier */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col relative overflow-hidden group"
                >
                  <div className="mb-8">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t.pricingEnterprise}</h3>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed">{t.pricingEnterpriseDesc}</p>
                  </div>
                  <div className="mb-10 flex items-baseline">
                    <span className="text-4xl font-black text-gray-900 tracking-tighter">Custom</span>
                  </div>
                  <ul className="space-y-5 mb-10 flex-1">
                    {[
                      { text: t.customLimits, icon: Check },
                      { text: t.apiAccess, icon: Check },
                      { text: t.dedicatedSupport, icon: Check }
                    ].map((item, i) => (
                      <li key={i} className="flex items-center space-x-3">
                        <div className="bg-gray-50 p-1 rounded-lg">
                          <item.icon className="w-4 h-4 text-gray-400" />
                        </div>
                        <span className="text-sm font-bold text-gray-700">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-all"
                    onClick={() => alert("Contacting sales... (Mock)")}
                  >
                    {t.contactSales}
                  </motion.button>
                </motion.div>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

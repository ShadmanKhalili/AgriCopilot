import React from 'react';
import { X, Check, Zap, Shield, Crown, Sparkles, PhoneCall } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { useAuth } from './AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function PricingModal({ isOpen, onClose, lang }: Props) {
  const { user, userProfile } = useAuth();
  const t = translations[lang];

  const handleContactSales = () => {
    window.location.href = "tel:01410456453";
  };

  const isFree = user && userProfile?.tier !== 'premium';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 xl:p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/95 backdrop-blur-2xl rounded-[40px] shadow-2xl w-full max-w-6xl my-auto overflow-hidden flex flex-col relative z-10 border border-white/20"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-green-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 opacity-30 pointer-events-none"></div>

            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100 relative z-10 bg-white/50 backdrop-blur-sm sticky top-0">
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 rounded-xl shadow-lg shadow-green-100">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Account Plans</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2.5 hover:bg-gray-100 rounded-2xl transition-all hover:rotate-90"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-6 md:p-10 relative z-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Guest Tier */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col relative overflow-hidden group"
                >
                  <div className="mb-8">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Guest Access</h3>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed">Try Agri-Copilot without an account.</p>
                  </div>
                  <div className="mb-8 flex items-baseline">
                    <span className="text-5xl font-black text-gray-900 tracking-tighter">Free</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                    {[
                      { text: "10 uses per tab / day", icon: Check },
                      { text: "Standard Gemini Flash model", icon: Check },
                      { text: "Basic Market Insights", icon: Check }
                    ].map((item, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <div className="bg-gray-50 p-1 rounded-lg mt-0.5">
                          <item.icon className="w-4 h-4 text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-600">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button 
                    disabled={!user}
                    className={`w-full py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs border ${!user ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed' : 'bg-white text-gray-600 border-gray-200'}`}
                  >
                    {!user ? "Current Plan" : "Downgrade"}
                  </button>
                </motion.div>

                {/* Standard Free Tier */}
                <motion.div 
                  whileHover={{ y: -10 }}
                  className="bg-gradient-to-br from-green-500 to-emerald-600 p-1 rounded-[36px] shadow-2xl shadow-green-200 flex flex-col relative transform md:-translate-y-4"
                >
                  <div className="bg-white rounded-[34px] p-8 flex flex-col h-full relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
                    
                    <div className="absolute top-4 right-4">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center">
                        <Check className="w-3 h-3 mr-1.5" /> Most Popular
                      </div>
                    </div>

                    <div className="mb-8 relative z-10">
                      <h3 className="text-xs font-black text-green-600 uppercase tracking-widest mb-2">Standard Account</h3>
                      <p className="text-gray-500 text-sm font-medium leading-relaxed">Unlimited general usage with fair-use daily caps.</p>
                    </div>
                    <div className="mb-8 flex items-baseline relative z-10">
                      <span className="text-5xl font-black text-gray-900 tracking-tighter">৳0</span>
                      <span className="text-gray-400 font-bold ml-1 uppercase tracking-widest text-[10px]">/mo</span>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1 relative z-10">
                      {[
                        { text: "Unlimited UI Usage (100 cap/day)", icon: Zap },
                        { text: "1 Premium Analysis per tab / day", icon: Sparkles, highlight: true },
                        { text: "Powered by Gemini Flash", icon: Check },
                        { text: "Save Chat History", icon: Check }
                      ].map((item, i) => (
                        <li key={i} className="flex items-start space-x-3">
                          <div className={`p-1 rounded-lg mt-0.5 ${item.highlight ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          <span className={`text-sm font-bold ${item.highlight ? 'text-gray-900' : 'text-gray-700'}`}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                    <button 
                      disabled={isFree}
                      className={`w-full py-5 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all relative z-10 shadow-xl ${
                        isFree
                          ? 'bg-gradient-to-r from-gray-100 to-gray-50 text-gray-400 shadow-none cursor-not-allowed border border-gray-100'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-green-900/20'
                      }`}
                    >
                      {isFree ? "Current Plan" : "Create Free Account"}
                    </button>
                  </div>
                </motion.div>

                {/* Enterprise/Paid Tier */}
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="bg-gray-900 rounded-[32px] p-8 border border-gray-800 shadow-xl shadow-black/20 flex flex-col relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/3"></div>

                  <div className="mb-8 relative z-10">
                    <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">Pro & Enterprise</h3>
                    <p className="text-gray-400 text-sm font-medium leading-relaxed">Customize your paid plan limit for large-scale operations.</p>
                  </div>
                  <div className="mb-8 flex items-baseline relative z-10">
                    <span className="text-5xl font-black text-white tracking-tighter">Custom</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 relative z-10">
                    {[
                      { text: "Unlimited Premium Analysis", icon: Zap },
                      { text: "Custom API access", icon: Shield },
                      { text: "Dedicated Hub Manager dashboard", icon: Check },
                      { text: "Direct 24/7 Support", icon: PhoneCall }
                    ].map((item, i) => (
                      <li key={i} className="flex items-start space-x-3">
                        <div className="bg-gray-800 p-1 rounded-lg mt-0.5">
                          <item.icon className="w-4 h-4 text-blue-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-300">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <div className="mt-auto relative z-10">
                    <button 
                      onClick={handleContactSales}
                      className="w-full mb-3 py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs bg-white hover:bg-gray-50 text-gray-900 transition-colors flex items-center justify-center space-x-2 shadow-lg"
                    >
                      <PhoneCall className="w-4 h-4" />
                      <span>Contact Sales</span>
                    </button>
                    <div className="text-center text-xs font-medium text-gray-400 flex flex-col items-center justify-center">
                      <span>Call Shadman Khalili:</span>
                      <span className="text-white mt-1">(+880) 141-045-6453</span>
                    </div>
                  </div>
                </motion.div>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

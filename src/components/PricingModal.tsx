import React from 'react';
import { X, Check, Zap, Shield, Crown } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { useAuth } from './AuthProvider';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export default function PricingModal({ isOpen, onClose, lang }: Props) {
  const { user, userProfile, upgradeToPremium } = useAuth();
  const t = translations[lang];

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">{t.pricingTitle}</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Basic Tier */}
            <div className="border border-gray-200 rounded-2xl p-6 flex flex-col relative">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{t.pricingBasic}</h3>
                <p className="text-gray-500 text-sm mt-1">{t.pricingBasicDesc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">৳0</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">10 {t.usesPerMonth}</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">{t.agriCopilot}</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">{t.smartGrade}</span>
                </li>
              </ul>
              <button 
                disabled={true}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-gray-100 text-gray-500 cursor-not-allowed"
              >
                {t.currentPlan}
              </button>
            </div>

            {/* Premium Tier */}
            <div className="border-2 border-green-500 rounded-2xl p-6 flex flex-col relative bg-green-50/30 transform md:-translate-y-2 shadow-lg">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex items-center">
                <Crown className="w-3 h-3 mr-1" /> Recommended
              </div>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-green-900">{t.pricingPremium}</h3>
                <p className="text-green-700/70 text-sm mt-1">{t.pricingPremiumDesc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">৳500</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-900 font-medium">50 {t.usesPerMonth}</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">{t.advancedAnalysis}</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">Priority Processing</span>
                </li>
              </ul>
              <button 
                onClick={handleUpgrade}
                disabled={isPremium}
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors ${
                  isPremium 
                    ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
                }`}
              >
                {isPremium ? t.currentPlan : t.subscribe}
              </button>
            </div>

            {/* Enterprise Tier */}
            <div className="border border-gray-200 rounded-2xl p-6 flex flex-col relative">
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{t.pricingEnterprise}</h3>
                <p className="text-gray-500 text-sm mt-1">{t.pricingEnterpriseDesc}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">{t.customLimits}</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">{t.apiAccess}</span>
                </li>
                <li className="flex items-start">
                  <Check className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-gray-700">{t.dedicatedSupport}</span>
                </li>
              </ul>
              <button 
                className="w-full py-3 px-4 rounded-xl font-semibold border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
                onClick={() => alert("Contacting sales... (Mock)")}
              >
                {t.contactSales}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

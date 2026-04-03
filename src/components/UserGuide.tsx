import React from 'react';
import { translations, Language } from '../utils/translations';
import { BookOpen, Leaf, Award, ShieldAlert, TrendingUp } from 'lucide-react';

interface Props {
  lang: Language;
}

export default function UserGuide({ lang }: Props) {
  const t = translations[lang];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center justify-center mb-4">
          <BookOpen className="w-8 h-8 mr-3 text-green-600" />
          {t.guideTitle}
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">{t.guideIntro}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Agri-Copilot Guide */}
        <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-green-50">
            <div className="bg-green-100 p-3 rounded-xl text-green-600">
              <Leaf className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-green-900">{t.agriCopilot}</h3>
          </div>
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
              <p className="text-gray-700 text-sm leading-relaxed">{t.guideAgriCopilot1}</p>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
              <p className="text-gray-700 text-sm leading-relaxed">{t.guideAgriCopilot2}</p>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
              <p className="text-gray-700 text-sm leading-relaxed">{t.guideAgriCopilot3}</p>
            </li>
          </ul>
        </div>

        {/* Smart-Grade Guide */}
        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-blue-50">
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-blue-900">{t.smartGrade}</h3>
          </div>
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
              <p className="text-gray-700 text-sm leading-relaxed">{t.guideSmartGrade1}</p>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
              <p className="text-gray-700 text-sm leading-relaxed">{t.guideSmartGrade2}</p>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
              <p className="text-gray-700 text-sm leading-relaxed">{t.guideSmartGrade3}</p>
            </li>
          </ul>
        </div>

        {/* Market-Connect Guide */}
        <div className="bg-white p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-purple-50">
            <div className="bg-purple-100 p-3 rounded-xl text-purple-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-purple-900">{t.marketConnect}</h3>
          </div>
          <ul className="space-y-4">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
              <p className="text-gray-700 text-sm leading-relaxed">{lang === 'bn' ? 'পণ্যের নাম এবং আপনার অবস্থান নির্বাচন করুন।' : 'Select the produce name and your location.'}</p>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
              <p className="text-gray-700 text-sm leading-relaxed">{lang === 'bn' ? '"বাজারের অন্তর্দৃষ্টি পান" এ ক্লিক করুন।' : 'Click "Get Market Insights".'}</p>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
              <p className="text-gray-700 text-sm leading-relaxed">{lang === 'bn' ? 'বর্তমান মূল্য এবং বিক্রির পরামর্শ পড়ুন।' : 'Read the current price and selling recommendations.'}</p>
            </li>
          </ul>
        </div>
      </div>

      {/* Pricing & Usage Guide */}
      <div className="mt-12 bg-gray-50 p-8 rounded-2xl border border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <ShieldAlert className="w-6 h-6 text-gray-700" />
          <h3 className="text-xl font-bold text-gray-900">{t.guidePricing}</h3>
        </div>
        <p className="text-gray-700 leading-relaxed text-lg">{t.guidePricingDesc}</p>
      </div>
    </div>
  );
}

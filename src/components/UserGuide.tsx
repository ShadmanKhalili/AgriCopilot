import React from 'react';
import { translations, Language } from '../utils/translations';
import { BookOpen, Leaf, Award, ShieldAlert, TrendingUp, CheckCircle2, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import Tooltip from './Tooltip';

interface Props {
  lang: Language;
}

export default function UserGuide({ lang }: Props) {
  const t = translations[lang];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring' as const, stiffness: 100 }
    }
  };

  return (
    <motion.div 
      className="space-y-10 max-w-5xl mx-auto"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants} className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-2xl mb-6">
          <BookOpen className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
          {t.guideTitle}
        </h2>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
          {t.guideIntro}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agri-Copilot Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl border border-green-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-4 mb-8">
            <div className="bg-green-100 p-4 rounded-2xl text-green-600 shadow-inner">
              <Leaf className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{t.agriCopilot}</h3>
          </div>
          <ul className="space-y-5">
            {[
              lang === 'bn' ? 'আপনার ফসলের ১ থেকে ৩টি পরিষ্কার ছবি তুলুন বা আপলোড করুন (বিভিন্ন দিক থেকে ছবি তুললে ভালো ফলাফল পাওয়া যায়)।' : 'Take or upload 1 to 3 clear photos of your crop (multiple angles provide better results).',
              t.guideAgriCopilot2,
              lang === 'bn' ? 'এআই-এর পরামর্শ দেখুন এবং প্রয়োজনে "বিশেষজ্ঞের পরামর্শ নিন" বাটনে ক্লিক করে নিকটস্থ কৃষি কর্মকর্তার সাথে যোগাযোগ করুন।' : 'Review AI insights and click "Verify with Expert" if you need to contact a local agricultural officer.'
            ].map((step, i) => (
              <li key={i} className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-sm font-bold mr-4 border border-green-100 shadow-sm">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm leading-relaxed pt-1">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Smart-Grade Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl border border-blue-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-4 mb-8">
            <div className="bg-blue-100 p-4 rounded-2xl text-blue-600 shadow-inner">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{t.smartGrade}</h3>
          </div>
          <ul className="space-y-5">
            {[t.guideSmartGrade1, t.guideSmartGrade2, t.guideSmartGrade3].map((step, i) => (
              <li key={i} className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold mr-4 border border-blue-100 shadow-sm">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm leading-relaxed pt-1">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Market-Connect Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-3xl border border-purple-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
          <div className="flex items-center space-x-4 mb-8">
            <div className="bg-purple-100 p-4 rounded-2xl text-purple-600 shadow-inner">
              <TrendingUp className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{t.marketConnect}</h3>
          </div>
          <ul className="space-y-5">
            {[
              t.guideMarketConnect1 || (lang === 'bn' ? 'পণ্যের নাম এবং আপনার অবস্থান নির্বাচন করুন।' : 'Select the produce name and your location.'),
              t.guideMarketConnect2 || (lang === 'bn' ? '"বাজারের অন্তর্দৃষ্টি পান" এ ক্লিক করুন।' : 'Click "Get Market Insights".'),
              t.guideMarketConnect3 || (lang === 'bn' ? 'বর্তমান মূল্য এবং বিক্রির পরামর্শ পড়ুন।' : 'Read the current price and selling recommendations.')
            ].map((step, i) => (
              <li key={i} className="flex items-start">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold mr-4 border border-purple-100 shadow-sm">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm leading-relaxed pt-1">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Pricing & Usage Guide */}
      <motion.div variants={itemVariants} className="mt-12 bg-gradient-to-br from-gray-50 to-gray-100 p-8 md:p-10 rounded-3xl border border-gray-200 shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="flex items-center space-x-4 mb-6">
          <div className="bg-gray-200 p-3 rounded-2xl text-gray-700">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{t.guidePricing}</h3>
        </div>
        <p className="text-gray-600 leading-relaxed text-lg max-w-3xl">
          {t.guidePricingDesc}
        </p>
        
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tooltip content={lang === 'bn' ? 'কোনো অ্যাকাউন্ট ছাড়াই ব্যবহার করুন' : 'Use without an account'}>
            <div className="bg-white p-4 rounded-2xl border border-gray-200 flex items-center space-x-3 shadow-sm w-full">
              <CheckCircle2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">{lang === 'bn' ? 'অজ্ঞাত' : 'Anonymous'}</p>
                <p className="text-xs text-gray-500">{lang === 'bn' ? '৫টি ব্যবহার' : '5 uses total'}</p>
              </div>
            </div>
          </Tooltip>
          <Tooltip content={lang === 'bn' ? 'লগ ইন করে আরও সুবিধা পান' : 'Get more benefits by logging in'}>
            <div className="bg-white p-4 rounded-2xl border border-green-200 flex items-center space-x-3 shadow-sm w-full">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-semibold text-gray-900">{lang === 'bn' ? 'ফ্রি' : 'Free Account'}</p>
                <p className="text-xs text-gray-500">{lang === 'bn' ? '১০টি ব্যবহার' : '10 uses total'}</p>
              </div>
            </div>
          </Tooltip>
          <Tooltip content={lang === 'bn' ? 'সর্বোচ্চ সুবিধা এবং এআই শক্তি' : 'Maximum benefits and AI power'}>
            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-2xl border border-yellow-200 flex items-center space-x-3 shadow-sm w-full">
              <CheckCircle2 className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-gray-900">{lang === 'bn' ? 'প্রিমিয়াম' : 'Premium'}</p>
                <p className="text-xs text-gray-500">{lang === 'bn' ? '৫০টি ব্যবহার' : '50 uses total'}</p>
              </div>
            </div>
          </Tooltip>
        </div>
      </motion.div>
    </motion.div>
  );
}

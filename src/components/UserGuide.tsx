import React from 'react';
import { translations, Language } from '../utils/translations';
import { BookOpen, Leaf, Award, ShieldAlert, TrendingUp, CheckCircle2, HelpCircle, Crown } from 'lucide-react';
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
      <motion.div variants={itemVariants} className="text-center mb-16">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl mb-6 shadow-lg shadow-green-200"
        >
          <BookOpen className="w-10 h-10 text-white animate-pulse" />
        </motion.div>
        <h2 className="text-5xl font-black text-gray-900 tracking-tight mb-4 uppercase italic">
          {t.guideTitle}
        </h2>
        <p className="text-gray-500 text-xl max-w-2xl mx-auto leading-relaxed font-medium">
          {t.guideIntro}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Agri-Copilot Guide */}
        <motion.div variants={itemVariants} className="bg-white p-10 rounded-[40px] border border-green-100 shadow-xl shadow-green-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-5 mb-10 relative z-10">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl text-white shadow-lg shadow-green-100">
              <Leaf className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{t.agriCopilot}</h3>
          </div>
          <ul className="space-y-8 relative z-10">
            {[
              lang === 'bn' ? 'আপনার ফসলের ১ থেকে ৩টি পরিষ্কার ছবি তুলুন বা আপলোড করুন (বিভিন্ন দিক থেকে ছবি তুললে ভালো ফলাফল পাওয়া যায়)।' : 'Take or upload 1 to 3 clear photos of your crop (multiple angles provide better results).',
              t.guideAgriCopilot2,
              lang === 'bn' ? 'এআই-এর পরামর্শ দেখুন এবং "নিশ্চিত হওয়ার উপায়" সেকশনে দেওয়া ধাপগুলো অনুসরণ করে নিশ্চিত হোন। প্রয়োজনে কৃষি অফিসারের সাথে আলাপ করুন।' : 'Review AI insights and follow the specific steps in "Verification Advice" to confirm. Contact a local officer if needed.'
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center text-sm font-black mr-5 border border-green-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Smart-Grade Guide */}
        <motion.div variants={itemVariants} className="bg-white p-10 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-5 mb-10 relative z-10">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-100">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{t.smartGrade}</h3>
          </div>
          <ul className="space-y-8 relative z-10">
            {[t.guideSmartGrade1, t.guideSmartGrade2, t.guideSmartGrade3].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-black mr-5 border border-blue-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Market-Connect Guide */}
        <motion.div variants={itemVariants} className="bg-white p-10 rounded-[40px] border border-orange-100 shadow-xl shadow-orange-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-5 mb-10 relative z-10">
            <div className="bg-gradient-to-br from-orange-500 to-red-600 p-4 rounded-2xl text-white shadow-lg shadow-orange-100">
              <TrendingUp className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{t.marketConnect}</h3>
          </div>
          <ul className="space-y-8 relative z-10">
            {[
              t.guideMarketConnect1 || (lang === 'bn' ? 'পণ্যের নাম এবং আপনার অবস্থান নির্বাচন করুন।' : 'Select the produce name and your location.'),
              t.guideMarketConnect2 || (lang === 'bn' ? '"বাজারের অন্তর্দৃষ্টি পান" এ ক্লিক করুন।' : 'Click "Get Market Insights".'),
              t.guideMarketConnect3 || (lang === 'bn' ? 'বর্তমান মূল্য এবং বিক্রির পরামর্শ পড়ুন।' : 'Read the current price and selling recommendations.')
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-sm font-black mr-5 border border-orange-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-sm font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Pricing & Usage Guide */}
      <motion.div variants={itemVariants} className="mt-16 bg-white p-10 md:p-12 rounded-[48px] border border-gray-100 shadow-2xl shadow-gray-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-50 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 opacity-50 pointer-events-none"></div>
        
        <div className="flex items-center space-x-6 mb-8 relative z-10">
          <div className="bg-gray-100 p-4 rounded-3xl text-gray-700 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">{t.guidePricing}</h3>
        </div>
        <p className="text-gray-500 leading-relaxed text-xl max-w-3xl font-medium relative z-10">
          {t.guidePricingDesc}
        </p>
        
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
          <Tooltip content={lang === 'bn' ? 'কোনো অ্যাকাউন্ট ছাড়াই ব্যবহার করুন' : 'Use without an account'}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white p-6 rounded-[32px] border border-gray-100 flex items-center space-x-4 shadow-xl shadow-gray-100/50 w-full"
            >
              <div className="bg-gray-50 p-2 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="font-black text-gray-900 uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'অজ্ঞাত' : 'Anonymous'}</p>
                <p className="text-lg font-black text-gray-400 tracking-tighter">{lang === 'bn' ? '৫টি ব্যবহার' : '5 uses total'}</p>
              </div>
            </motion.div>
          </Tooltip>
          <Tooltip content={lang === 'bn' ? 'লগ ইন করে আরও সুবিধা পান' : 'Get more benefits by logging in'}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-white p-6 rounded-[32px] border border-green-100 flex items-center space-x-4 shadow-xl shadow-green-100/50 w-full"
            >
              <div className="bg-green-50 p-2 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="font-black text-green-900 uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'ফ্রি' : 'Free Account'}</p>
                <p className="text-lg font-black text-green-600 tracking-tighter">{lang === 'bn' ? '১০টি ব্যবহার' : '10 uses total'}</p>
              </div>
            </motion.div>
          </Tooltip>
          <Tooltip content={lang === 'bn' ? 'সর্বোচ্চ সুবিধা এবং এআই শক্তি' : 'Maximum benefits and AI power'}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-[32px] border border-yellow-200 flex items-center space-x-4 shadow-xl shadow-orange-200/50 w-full"
            >
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-white uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'প্রিমিয়াম' : 'Premium'}</p>
                <p className="text-lg font-black text-white tracking-tighter">{lang === 'bn' ? '৫০টি ব্যবহার' : '50 uses total'}</p>
              </div>
            </motion.div>
          </Tooltip>
        </div>
      </motion.div>
    </motion.div>
  );
}

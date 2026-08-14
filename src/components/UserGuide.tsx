import React from 'react';
import { translations, Language } from '../utils/translations';
import { BookOpen, Leaf, Award, ShieldAlert, TrendingUp, CheckCircle2, HelpCircle, Crown, Satellite, Cloud, Calculator, Waves } from 'lucide-react';
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
      className="space-y-10 w-full"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants} className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-green-900/5 border border-green-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-green-100 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <BookOpen className="w-6 h-6 md:w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{t.guideTitle}</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">{t.guideIntro}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Krishi Profit Calculator Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-[40px] border border-emerald-100 shadow-xl shadow-emerald-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-4 mb-8 relative z-10">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 rounded-2xl text-white shadow-lg shadow-emerald-100">
              <Calculator className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">
              {lang === 'bn' ? 'লাভ ও খরচ হিসাব' : 'Profit & Cost Calc'}
            </h3>
          </div>
          <ul className="space-y-6 relative z-10">
            {[
              lang === 'bn' ? 'ফসল ও জমির পরিমাণ নির্বাচন করুন (বিঘা, শতাংশ বা একর)।' : 'Select crop type and land area (Bigha, Decimal, Acre).',
              lang === 'bn' ? 'চাষ, সার, কীটনাশক ও শ্রমিক খরচ যাচাই ও সম্পাদনা করুন।' : 'Review and edit itemized tillage, fertilizer, and labor costs.',
              lang === 'bn' ? 'প্রতি মণ উৎপাদন ব্যয় (ব্রেক-ইভেন) এবং নিট লাভের হিসাব দেখুন।' : 'Inspect break-even cost per Maund and projected net ROI.'
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black mr-4 border border-emerald-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-xs font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Climate Resilience Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-[40px] border border-cyan-100 shadow-xl shadow-cyan-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-4 mb-8 relative z-10">
            <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-4 rounded-2xl text-white shadow-lg shadow-cyan-100">
              <Waves className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">
              {lang === 'bn' ? 'দুর্যোগ ও জলবায়ু গাইড' : 'Climate Hazard Guide'}
            </h3>
          </div>
          <ul className="space-y-6 relative z-10">
            {[
              lang === 'bn' ? 'বন্যা, লবণাক্ততা বা খরা ফিল্টার থেকে আপনার সমস্যা বেছে নিন।' : 'Filter by hazard: submergence, salinity, or Barind drought.',
              lang === 'bn' ? 'ব্রি (BRRI) ও বিনা (BINA) উদ্ভাবিত উচ্চ সহনশীল জাতের তালিকা দেখুন।' : 'Explore officially authenticated stress-tolerant seed cultivars.',
              lang === 'bn' ? 'দুর্যোগের পর ফসল উদ্ধারের জরুরি প্রটোকল অনুসরণ করুন।' : 'Follow field recovery protocols after floodwaters or tidal surges.'
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xs font-black mr-4 border border-cyan-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-xs font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Agri-Copilot Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-[40px] border border-green-100 shadow-xl shadow-green-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-4 mb-8 relative z-10">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl text-white shadow-lg shadow-green-100">
              <Leaf className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">{t.agriCopilot}</h3>
          </div>
          <ul className="space-y-6 relative z-10">
            {[
              t.guideAgriCopilot1 || (lang === 'bn' ? 'আপনার ফসলের ১ থেকে ৩টি পরিষ্কার ছবি তুলুন বা আপলোড করুন।' : 'Take or upload 1 to 3 clear photos of your crop.'),
              t.guideAgriCopilot2,
              t.guideAgriCopilot3 || (lang === 'bn' ? 'এআই-এর পরামর্শ দেখুন এবং কৃষি অফিসারের সাথে যাচাই করুন।' : 'Review AI diagnosis and verify with local DAE.')
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-50 text-green-600 flex items-center justify-center text-xs font-black mr-4 border border-green-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-xs font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Weather Advisory Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-[40px] border border-cyan-100 shadow-xl shadow-cyan-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-4 mb-8 relative z-10">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-2xl text-white shadow-lg shadow-cyan-100">
              <Cloud className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">{t.weatherAdvisory}</h3>
          </div>
          <ul className="space-y-6 relative z-10">
            {[
              t.guideWeather1 || (lang === 'bn' ? 'আপনার জিপিএস লোকেশন আপডেট করুন।' : 'Update your GPS location.'),
              t.guideWeather2 || (lang === 'bn' ? 'বর্তমান আবহাওয়া এবং মাটির আর্দ্রতা দেখুন।' : 'View current weather conditions and soil moisture.')
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xs font-black mr-4 border border-cyan-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-xs font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Satellite Health Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-[40px] border border-indigo-100 shadow-xl shadow-indigo-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-4 mb-8 relative z-10">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
              <Satellite className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">{t.cropHealth}</h3>
          </div>
          <ul className="space-y-6 relative z-10">
            {[
              t.guideSatellite1 || (lang === 'bn' ? 'আপনার জিপিএস লোকেশন আপডেট করুন।' : 'Update your GPS location.'),
              t.guideSatellite2 || (lang === 'bn' ? 'স্যাটেলাইট ডেটা রিফ্রেশ করতে বাটনে ক্লিক করুন।' : 'Click the refresh button to fetch Sentinel Hub satellite data.'),
              t.guideSatellite3 || (lang === 'bn' ? 'ফসলের স্বাস্থ্য (NDVI) এবং আর্দ্রতা (NDMI) সূচক বিশ্লেষণ করুন।' : 'Analyze crop health (NDVI) and moisture (NDMI) indices.')
            ].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black mr-4 border border-indigo-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-xs font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Smart-Grade Guide */}
        <motion.div variants={itemVariants} className="bg-white p-8 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          <div className="flex items-center space-x-4 mb-8 relative z-10">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-blue-100">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">{t.smartGrade}</h3>
          </div>
          <ul className="space-y-6 relative z-10">
            {[t.guideSmartGrade1, t.guideSmartGrade2, t.guideSmartGrade3].map((step, i) => (
              <li key={i} className="flex items-start group/item">
                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black mr-4 border border-blue-100 shadow-sm group-hover/item:scale-110 transition-transform">
                  {i + 1}
                </span>
                <p className="text-gray-600 text-xs font-bold leading-relaxed pt-1.5">{step}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Pricing & Usage Guide */}
      <motion.div variants={itemVariants} className="mt-16 bg-white p-10 md:p-12 rounded-[48px] border border-gray-100 shadow-2xl shadow-gray-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-green-50/80 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 opacity-80 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-50/80 to-transparent rounded-full translate-y-1/2 -translate-x-1/3 opacity-80 pointer-events-none"></div>
        
        <div className="flex items-center space-x-6 mb-8 relative z-10">
          <div className="bg-gray-100 p-4 rounded-3xl text-gray-700 shadow-inner">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic">{t.guidePricing}</h3>
        </div>
        <p className="text-gray-500 leading-relaxed text-xl max-w-3xl font-medium relative z-10">
          Access different performance levels and limits based on your account type.
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
                <p className="font-black text-gray-900 uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'গেস্ট' : 'Guest'}</p>
                <p className="text-sm font-black text-gray-400 tracking-tight">{lang === 'bn' ? '১০ বার প্রতি ট্যাব/দিন' : '10 uses / tab / day'}</p>
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
                <p className="font-black text-green-900 uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'ফ্রি' : 'Standard'}</p>
                <p className="text-sm font-black text-green-600 tracking-tight">{lang === 'bn' ? '১০০ বার/দিন + ১ প্রিমিয়াম/ট্যাব' : '100 queries/day + 1 Premium/tab'}</p>
              </div>
            </motion.div>
          </Tooltip>
          <Tooltip content={lang === 'bn' ? 'যোগাযোগ করুন কাস্টমাইজড প্ল্যানের জন্য - Shadman Khalili, +880 141-045-6453' : 'Contact for custom plans - Shadman Khalili, +880 141-045-6453'}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-[32px] border border-yellow-200 flex items-center space-x-4 shadow-xl shadow-orange-200/50 w-full cursor-pointer"
            >
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-black text-white uppercase tracking-widest text-[10px]">{lang === 'bn' ? 'প্রো ও এন্টারপ্রাইজ' : 'Pro & Enterprise'}</p>
                <p className="text-sm font-black text-white tracking-tight">{lang === 'bn' ? 'আনলিমিটেড প্রিমিয়াম' : 'Unlimited Premium'}</p>
              </div>
            </motion.div>
          </Tooltip>
        </div>
      </motion.div>
    </motion.div>
  );
}

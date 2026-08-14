import React, { useState } from 'react';
import { 
  Waves, Sun, Droplets, ShieldAlert, Sparkles, Sprout, 
  HelpCircle, PhoneCall, CheckCircle2, AlertCircle, ArrowRight,
  BookOpen, Compass, ThermometerSnowflake, FileText, ChevronRight,
  Calculator, Cloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';

interface StressVariety {
  name: string;
  breeder: string;
  stressType: 'flood' | 'salinity' | 'drought' | 'cold' | 'waterlog';
  toleranceLevelBn: string;
  toleranceLevelEn: string;
  durationDays: number;
  yieldPotentialBn: string;
  yieldPotentialEn: string;
  suitableRegionsBn: string;
  suitableRegionsEn: string;
  managementTipsBn: string;
  managementTipsEn: string;
}

const STRESS_VARIETIES: StressVariety[] = [
  // Flash Flood & Submergence
  {
    name: 'ব্রি ধান৫১ (BRRI dhan 51)',
    breeder: 'BRRI',
    stressType: 'flood',
    toleranceLevelBn: 'সম্পূর্ণ পানির নিচে ১৪-১৭ দিন ডুবে থাকলেও চারা পচে না (Sub1 জিন যুক্ত)',
    toleranceLevelEn: 'Survives 14-17 days completely submerged underwater (Sub1 gene)',
    durationDays: 142,
    yieldPotentialBn: '১৬-১৮ মণ / বিঘা (৪.৫ টন/হে.)',
    yieldPotentialEn: '16-18 Mon / Bigha (4.5 t/ha)',
    suitableRegionsBn: 'কুড়িগ্রাম, গাইবান্ধা, সিরাজগঞ্জ, জামালপুর ও বন্যাপ্রবণ রোপা আমন এলাকা',
    suitableRegionsEn: 'Kurigram, Gaibandha, Sirajganj, Jamalpur flood-prone Aman zones',
    managementTipsBn: 'বন্যা নেমে যাওয়ার পর প্রতি বিঘায় ৪ কেজি ইউরিয়া ও ২ কেজি পটাশ উপরিপ্রয়োগ করুন।',
    managementTipsEn: 'Top-dress with 4kg Urea and 2kg MOP per Bigha once flood water drains.'
  },
  {
    name: 'ব্রি ধান৫২ (BRRI dhan 52)',
    breeder: 'BRRI',
    stressType: 'flood',
    toleranceLevelBn: '২ সপ্তাহের বেশি আকস্মিক বন্যায় টিকে থাকে এবং স্বর্ণা ধানের সমান ফলন দেয়',
    toleranceLevelEn: 'Survives >2 weeks submerged with Swarna-equivalent grain yield',
    durationDays: 145,
    yieldPotentialBn: '১৮-২০ মণ / বিঘা (৫.০ টন/হে.)',
    yieldPotentialEn: '18-20 Mon / Bigha (5.0 t/ha)',
    suitableRegionsBn: 'সিলেট, সুনামগঞ্জ, নেত্রকোনা ও উত্তরবঙ্গের নিম্নাঞ্চল',
    suitableRegionsEn: 'Sylhet, Sunamganj, Netrokona Haor & Northern wetlands',
    managementTipsBn: '৩০-৩৫ দিনের বয়স্ক চারা রোপণ করলে পানির তোড় সহজে সহ্য করতে পারে।',
    managementTipsEn: 'Transplant 30-35 day mature sturdy seedlings to withstand water currents.'
  },
  {
    name: 'বিনা ধান-১১ (BINA dhan-11)',
    breeder: 'BINA',
    stressType: 'flood',
    toleranceLevelBn: '২০-২৫ দিন জলমগ্নতা সহনশীল এবং স্বল্পমেয়াদী হওয়ায় বন্যার পর রবি ফসল করা যায়',
    toleranceLevelEn: '20-25 days submergence tolerance; short-duration enables early Rabi crops',
    durationDays: 120,
    yieldPotentialBn: '১৫-১৭ মণ / বিঘা (৪.২ টন/হে.)',
    yieldPotentialEn: '15-17 Mon / Bigha (4.2 t/ha)',
    suitableRegionsBn: 'চরাঞ্চল ও মধ্যবর্তী বন্যাপ্রবণ অববাহিকা',
    suitableRegionsEn: 'Riverine Chars and active floodplains',
    managementTipsBn: 'স্বল্প জীবনকাল হওয়ায় রবি সরিষা বা আলুর জন্য জমি দ্রুত খালি হয়।',
    managementTipsEn: 'Quick maturity clears fields on time for profitable Rabi Mustard or Potato.'
  },

  // Coastal Salinity
  {
    name: 'ব্রি ধান৬৭ (BRRI dhan 67)',
    breeder: 'BRRI',
    stressType: 'salinity',
    toleranceLevelBn: 'চারা অবস্থায় ৮-১২ dS/m এবং পুরো জীবনকালে ৮ dS/m লবণাক্ততা সহ্য করে',
    toleranceLevelEn: 'Tolerates 8-12 dS/m salinity at seedling stage and 8 dS/m throughout cycle',
    durationDays: 140,
    yieldPotentialBn: '২২-২৪ মণ / বিঘা (৬.৫ টন/হে.)',
    yieldPotentialEn: '22-24 Mon / Bigha (6.5 t/ha)',
    suitableRegionsBn: 'সাতক্ষীরা, খুলনা, বাগেরহাট, বরগুনা, পটুয়াখালী উপকূলীয় বোরো মৌসুম',
    suitableRegionsEn: 'Satkhira, Khulna, Bagerhat, Barguna, Patuakhali coastal Boro tract',
    managementTipsBn: 'লবণাক্ততা বেশি হলে জমিতে জিপসাম সার (সালফার) এবং জৈব সার বেশি দিন।',
    managementTipsEn: 'Apply extra Gypsum (Sulphur) and organic compost to displace sodium ions.'
  },
  {
    name: 'ব্রি ধান৯৭ ও ব্রি ধান৯৯ (BRRI dhan 97 & 99)',
    breeder: 'BRRI',
    stressType: 'salinity',
    toleranceLevelBn: '১৪ dS/m পর্যন্ত তীব্র লবণাক্ত পানি সহ্য করতে সক্ষম নতুন উচ্চফলনশীল জাত',
    toleranceLevelEn: 'Advanced HYV tolerating high saline surges up to 14 dS/m',
    durationDays: 145,
    yieldPotentialBn: '২০-২২ মণ / বিঘা (৬.০ টন/হে.)',
    yieldPotentialEn: '20-22 Mon / Bigha (6.0 t/ha)',
    suitableRegionsBn: 'পেকুয়া, টেকনাফ, মহেশখালী, নোয়াখালী ও ভোলা উপকূল',
    suitableRegionsEn: 'Pekua, Teknaf, Moheshkhali, Noakhali and Bhola coastal belts',
    managementTipsBn: 'জোয়ারের সময় নোনা পানি আটকাতে খামারের স্লুইস গেট বন্ধ রাখুন।',
    managementTipsEn: 'Coordinate sluice gate management during high-tide brackish surges.'
  },

  // Drought & Barind Tract
  {
    name: 'ব্রি ধান৭১ (BRRI dhan 71)',
    breeder: 'BRRI',
    stressType: 'drought',
    toleranceLevelBn: 'ফুল ফোটার সময় টানা ২০-২৫ দিন বৃষ্টি না হলেও স্বাভাবিক ফলন দেয়',
    toleranceLevelEn: 'Resists 20-25 days dry spell during flowering without sterile spikes',
    durationDays: 115,
    yieldPotentialBn: '১৮-২০ মণ / বিঘা (৫.৫ টন/হে.)',
    yieldPotentialEn: '18-20 Mon / Bigha (5.5 t/ha)',
    suitableRegionsBn: 'রাজশাহী, চাঁপাইনবাবগঞ্জ, নওগাঁ ও কুষ্টিয়া বরেন্দ্র অঞ্চল',
    suitableRegionsEn: 'Rajshahi, Chapainawabganj, Naogaon Barind drought tract',
    managementTipsBn: 'পর্যায়ক্রমিক ভিজানো ও শুকানো (AWD) পদ্ধতিতে ৩০% সেচের পানি সাশ্রয় হয়।',
    managementTipsEn: 'Use Alternate Wetting and Drying (AWD) pipe to cut irrigation cost by 30%.'
  },
  {
    name: 'বারি গম-৩৩ (BARI Gom 33)',
    breeder: 'BARI',
    stressType: 'drought',
    toleranceLevelBn: 'উচ্চ তাপমাত্রা ও ব্লাস্ট রোগ প্রতিরোধী জিংক সমৃদ্ধ জাত',
    toleranceLevelEn: 'Heat-tolerant and resistant to deadly Wheat Blast fungus; rich in Zinc',
    durationDays: 105,
    yieldPotentialBn: '১৪-১৬ মণ / বিঘা (৪.০ টন/হে.)',
    yieldPotentialEn: '14-16 Mon / Bigha (4.0 t/ha)',
    suitableRegionsBn: 'যশোর, চুয়াডাঙ্গা, মেহেরপুর ও উত্তরবঙ্গের উষ্ণ অঞ্চল',
    suitableRegionsEn: 'Jashore, Chuadanga, Meherpur and North-West high-temperature regions',
    managementTipsBn: 'নভেম্বরের ১৫-৩০ তারিখের মধ্যে বপন করলে সর্বোচ্চ ফলন পাওয়া যায়।',
    managementTipsEn: 'Sow between Nov 15-30 to escape extreme late-spring terminal heat.'
  },

  // Cold Wave
  {
    name: 'ব্রি ধান৩৬ (BRRI dhan 36)',
    breeder: 'BRRI',
    stressType: 'cold',
    toleranceLevelBn: 'তীব্র শৈত্যপ্রবাহেও চারা হলুদ হয় না ও কুশি গজানো ব্যাহত হয় না',
    toleranceLevelEn: 'Seedlings resist severe cold waves and yellowing shock during early Boro',
    durationDays: 140,
    yieldPotentialBn: '১৮-২০ মণ / বিঘা (৫.০ টন/হে.)',
    yieldPotentialEn: '18-20 Mon / Bigha (5.0 t/ha)',
    suitableRegionsBn: 'পঞ্চগড়, ঠাকুরগাঁও, দিনাজপুর ও রংপুর শীতপ্রধান অঞ্চল',
    suitableRegionsEn: 'Panchagarh, Thakurgaon, Dinajpur cold-prone belt',
    managementTipsBn: 'কুয়াশার রাতে বীজতলায় পলিথিন ছাউনি দিন এবং সকালে জমা পানি বের করে দিন।',
    managementTipsEn: 'Cover nursery with transparent polythene at night; wash cold dew at sunrise.'
  }
];

interface Props {
  lang: Language;
  onNavigateTab?: (tab: any, payload?: any) => void;
}

export default function ClimateResilienceGuide({ lang, onNavigateTab }: Props) {
  const [selectedStress, setSelectedStress] = useState<'all' | 'flood' | 'salinity' | 'drought' | 'cold'>('all');
  const [activeAccordion, setActiveAccordion] = useState<string>('recovery');

  const filteredVarieties = selectedStress === 'all'
    ? STRESS_VARIETIES
    : STRESS_VARIETIES.filter(v => v.stressType === selectedStress);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-cyan-900 via-teal-900 to-emerald-950 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-cyan-500/20 border border-cyan-400/30 px-3 py-1 rounded-full text-xs font-mono text-cyan-300">
              <Waves className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'জলবায়ু ঝুঁকি ও দুর্যোগ সহনশীল প্রযুক্তি' : 'Climate Hazard Mitigation & Stress Seeds'}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">
              {lang === 'bn' ? 'বন্যা, খরা ও লবণাক্ততা সহনশীল কৃষি গাইড' : 'Climate Resilience & Stress-Tolerant Seed Hub'}
            </h1>
            <p className="text-cyan-100/80 text-sm max-w-2xl leading-relaxed">
              {lang === 'bn'
                ? 'আকস্মিক বন্যা, উপকূলীয় নোনা পানি ও বরেন্দ্রের খরার মতো প্রতিকূল পরিবেশে নিশ্চিত ফলন পেতে সরকারি ব্রি (BRRI), বারি (BARI) ও বিনা (BINA) উদ্ভাবিত জাত ও জরুরি পুনরুদ্ধার নির্দেশিকা।'
                : 'Authenticated climate-smart cultivars and post-disaster crop recovery playbooks engineered by BRRI, BARI, and BINA for flood, salinity, and drought regions.'}
            </p>
          </div>

          {/* Quick Helpline Hotline */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-3xl self-start md:self-auto space-y-2">
            <div className="flex items-center space-x-2 text-xs font-black text-cyan-200">
              <PhoneCall className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'bn' ? 'কৃষি কল সেন্টার (বিনামূল্যে)' : 'DAE Emergency Hotline'}</span>
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-wider">
              16123 / 333
            </div>
            <p className="text-[10px] text-cyan-200/80 font-medium">
              {lang === 'bn' ? 'সকাল ৯টা - বিকাল ৫টা (সরকারি কৃষি কর্মকর্তা)' : 'Direct access to government agronomists'}
            </p>
          </div>
        </div>
      </div>

      {/* Stress Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-2.5 rounded-2xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setSelectedStress('all')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            selectedStress === 'all'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {lang === 'bn' ? 'সকল জাত (All)' : 'All Varieties'}
        </button>

        <button
          onClick={() => setSelectedStress('flood')}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            selectedStress === 'flood'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? '🌊 জলমগ্নতা ও বন্যা সহনশীল' : 'Flood & Submergence'}</span>
        </button>

        <button
          onClick={() => setSelectedStress('salinity')}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            selectedStress === 'salinity'
              ? 'bg-teal-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? '🧂 উপকূলীয় লবণাক্ততা সহনশীল' : 'Coastal Salinity'}</span>
        </button>

        <button
          onClick={() => setSelectedStress('drought')}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            selectedStress === 'drought'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? '☀️ খরা ও উচ্চ তাপমাত্রা' : 'Drought & Heat'}</span>
        </button>

        <button
          onClick={() => setSelectedStress('cold')}
          className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            selectedStress === 'cold'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ThermometerSnowflake className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? '❄️ শৈত্যপ্রবাহ সহনশীল' : 'Cold Wave'}</span>
        </button>
      </div>

      {/* Stress Varieties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVarieties.map((variety, idx) => {
          const badgeColor =
            variety.stressType === 'flood' ? 'bg-blue-100 text-blue-800 border-blue-200' :
            variety.stressType === 'salinity' ? 'bg-teal-100 text-teal-800 border-teal-200' :
            variety.stressType === 'drought' ? 'bg-amber-100 text-amber-800 border-amber-200' :
            'bg-indigo-100 text-indigo-800 border-indigo-200';

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-3xl p-5 border-2 border-gray-100 hover:border-emerald-300 shadow-md hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                    {variety.stressType === 'flood' ? (lang === 'bn' ? 'বন্যা সহনশীল' : 'Flood Tolerant') :
                     variety.stressType === 'salinity' ? (lang === 'bn' ? 'লবণাক্ততা সহনশীল' : 'Salinity Tolerant') :
                     variety.stressType === 'drought' ? (lang === 'bn' ? 'খরা সহনশীল' : 'Drought Tolerant') :
                     (lang === 'bn' ? 'শৈত্যপ্রবাহ' : 'Cold Tolerant')}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                    {variety.breeder}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">
                    {variety.name}
                  </h3>
                  <p className="text-xs font-bold text-emerald-700 mt-0.5">
                    {lang === 'bn' ? `জীবনকাল: ${variety.durationDays} দিন` : `Duration: ${variety.durationDays} Days`}
                  </p>
                </div>

                {/* Tolerance Trait */}
                <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-100/80 text-xs text-emerald-950 font-medium leading-relaxed">
                  <span className="font-bold mr-1">
                    {lang === 'bn' ? 'সহনশীলতার মাত্রা:' : 'Tolerance Capacity:'}
                  </span>
                  {lang === 'bn' ? variety.toleranceLevelBn : variety.toleranceLevelEn}
                </div>

                {/* Yield & Regions */}
                <div className="space-y-1.5 text-xs text-gray-600">
                  <div className="flex items-center space-x-1.5">
                    <Sprout className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <span>
                      <strong>{lang === 'bn' ? 'সম্ভাব্য ফলন:' : 'Yield:'}</strong> {lang === 'bn' ? variety.yieldPotentialBn : variety.yieldPotentialEn}
                    </span>
                  </div>
                  <div className="flex items-start space-x-1.5">
                    <Compass className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>{lang === 'bn' ? 'উপযুক্ত এলাকা:' : 'Zones:'}</strong> {lang === 'bn' ? variety.suitableRegionsBn : variety.suitableRegionsEn}
                    </span>
                  </div>
                </div>
              </div>

              {/* Management Note */}
              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 bg-gray-50/70 p-2.5 rounded-xl">
                <span className="font-bold text-gray-700">{lang === 'bn' ? 'চাষ পরামর্শ: ' : 'Field Tip: '}</span>
                {lang === 'bn' ? variety.managementTipsBn : variety.managementTipsEn}
              </div>

              {/* Cross-Module Action Buttons */}
              {onNavigateTab && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('krishi-profit', { crop: 'paddy_aman' })}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-900 text-xs font-black rounded-xl border border-emerald-200/80 transition-all min-h-[40px] shadow-2xs cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{lang === 'bn' ? 'ব্যয় ও লাভ' : 'Cost & Profit'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('weather-advisory')}
                    className="flex items-center justify-center space-x-1.5 py-2.5 px-2 bg-sky-50 hover:bg-sky-100 active:scale-95 text-sky-900 text-xs font-black rounded-xl border border-sky-200/80 transition-all min-h-[40px] shadow-2xs cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-sky-700" />
                    <span>{lang === 'bn' ? 'আবহাওয়া' : 'Weather Alert'}</span>
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Post-Disaster Emergency Crop Recovery Playbooks */}
      <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-900/5 space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-100">
          <div className="p-2.5 bg-amber-600 text-white rounded-2xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">
              {lang === 'bn' ? 'দুর্যোগোত্তর ফসল বাঁচানোর জরুরি নির্দেশিকা' : 'Post-Disaster Emergency Field Recovery Protocol'}
            </h3>
            <p className="text-xs text-gray-500">
              {lang === 'bn' ? 'বন্যা পরবর্তী বা লবণাক্ত জোয়ারের পর দ্রুত করণীয় পদক্ষেপ' : 'Immediate step-by-step rescue actions after floods, cyclones, or saline incursions.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Protocol 1: Flash Flood */}
          <div className="bg-blue-50/60 p-5 rounded-2xl border border-blue-100 space-y-3">
            <div className="flex items-center space-x-2 text-blue-900 font-black text-sm">
              <Waves className="w-4 h-4 text-blue-600" />
              <span>{lang === 'bn' ? 'বন্যার পানি নেমে যাওয়ার পর' : 'After Flood Water Recedes'}</span>
            </div>
            <ul className="text-xs text-blue-950/80 space-y-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'গাছের পাতার পলিমাটি পরিষ্কার পানিতে স্প্রে করে ধুয়ে দিন।' : 'Wash off silt/mud from leaves using clean water spray.'}</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'প্রতি লিটার পানিতে ২০ গ্রাম ইউরিয়া ও ১০ গ্রাম পটাশ গুলে পাতায় স্প্রে করুন।' : 'Foliar spray 20g Urea + 10g MOP per liter to revive shocked roots.'}</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'সম্পূর্ণ নষ্ট হলে নাবি আমন জাত (বিআর২২/বিআর২৩) দিয়ে পুনরায় রোপণ করুন।' : 'Re-plant with late photoperiod-sensitive varieties like BR22/BR23.'}</span>
              </li>
            </ul>
          </div>

          {/* Protocol 2: Saline Surge */}
          <div className="bg-teal-50/60 p-5 rounded-2xl border border-teal-100 space-y-3">
            <div className="flex items-center space-x-2 text-teal-900 font-black text-sm">
              <Droplets className="w-4 h-4 text-teal-600" />
              <span>{lang === 'bn' ? 'নোনা পানি প্রবেশ করলে' : 'After Saline Water Inundation'}</span>
            </div>
            <ul className="text-xs text-teal-950/80 space-y-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'মিষ্টি পানি দিয়ে জমি প্লাবিত করে দ্রুত নিষ্কাশন করুন (লবণ ধৌতকরণ)।' : 'Flush field with fresh canal water to leach accumulated salt.'}</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'বিঘায় ৮-১০ কেজি জিপসাম প্রয়োগ করুন যাতে ক্যালসিয়াম সোডিয়ামকে প্রতিস্থাপন করে।' : 'Apply 8-10kg Gypsum per Bigha to displace toxic sodium ions.'}</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'খড়কুটা বা মালচিং দিয়ে মাটির রস ধরে রাখুন যাতে কৈশিক নালীতে লবণ উপরে না ওঠে।' : 'Mulch heavily with straw to halt capillary salt rising.'}</span>
              </li>
            </ul>
          </div>

          {/* Protocol 3: Barind Drought */}
          <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-100 space-y-3">
            <div className="flex items-center space-x-2 text-amber-900 font-black text-sm">
              <Sun className="w-4 h-4 text-amber-600" />
              <span>{lang === 'bn' ? 'তীব্র খরা পরিস্থিতিতে' : 'Severe Drought & Heatwave'}</span>
            </div>
            <ul className="text-xs text-amber-950/80 space-y-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'এডব্লিউডি (AWD) পাইপ বসিয়ে কেবল গাছের সংকটময় অবস্থায় সেচ দিন।' : 'Use AWD perforated tubes to irrigate only at critical stages.'}</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'সন্ধ্যাবেলা হালকা সেচ দিন যাতে বাষ্পীভবন কম হয়।' : 'Irrigate strictly during evening hours to cut evaporation loss.'}</span>
              </li>
              <li className="flex items-start space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'গাছের তাপ চাপ কমাতে ০.৫% পটাশিয়াম নাইট্রেট বা বোরন স্প্রে করুন।' : 'Foliar spray 0.5% Potassium Nitrate/Boron to minimize heat shock.'}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

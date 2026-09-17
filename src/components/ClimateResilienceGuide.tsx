import React, { useState } from 'react';
import { 
  Waves, Sun, Droplets, Sparkles, Sprout, 
  PhoneCall, CheckCircle2, AlertCircle, ArrowRight,
  Compass, ThermometerSnowflake, ChevronRight,
  Calculator, Cloud, LayoutGrid, Columns2, TableProperties,
  BookOpen, Scale, X, Layers, Check, ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';

export interface StressVariety {
  id: string;
  name: string;
  breeder: string;
  season: 'আমন (Aman)' | 'বোরো (Boro)' | 'রবি (Rabi)';
  stressType: 'flood' | 'salinity' | 'drought' | 'cold';
  toleranceLevelBn: string;
  toleranceLevelEn: string;
  toleranceGauge: {
    value: number;
    max: number;
    unitBn: string;
    unitEn: string;
    labelBn: string;
    labelEn: string;
  };
  durationDays: number;
  yieldPotentialBn: string;
  yieldPotentialEn: string;
  suitableRegionsBn: string;
  suitableRegionsEn: string;
  managementTipsBn: string;
  managementTipsEn: string;
  specialTraitBn: string;
  specialTraitEn: string;
}

export const STRESS_VARIETIES: StressVariety[] = [
  // Flash Flood & Submergence
  {
    id: 'brri-51',
    name: 'ব্রি ধান৫১ (BRRI dhan 51)',
    breeder: 'BRRI',
    season: 'আমন (Aman)',
    stressType: 'flood',
    toleranceLevelBn: 'সম্পূর্ণ পানির নিচে ১৪-১৭ দিন ডুবে থাকলেও চারা পচে না (Sub1 জিন যুক্ত)',
    toleranceLevelEn: 'Survives 14-17 days completely submerged underwater (Sub1 gene)',
    toleranceGauge: {
      value: 17,
      max: 25,
      unitBn: 'দিন জলমগ্নতা',
      unitEn: 'Days Submerged',
      labelBn: '১৭ দিন পর্যন্ত পানির নিচে বেঁচে থাকে',
      labelEn: 'Up to 17 days under floodwater'
    },
    durationDays: 142,
    yieldPotentialBn: '১৬-১৮ মণ / বিঘা (৪.৫ টন/হে.)',
    yieldPotentialEn: '16-18 Mon / Bigha (4.5 t/ha)',
    suitableRegionsBn: 'কুড়িগ্রাম, গাইবান্ধা, সিরাজগঞ্জ, জামালপুর ও বন্যাপ্রবণ রোপা আমন এলাকা',
    suitableRegionsEn: 'Kurigram, Gaibandha, Sirajganj, Jamalpur flood-prone Aman zones',
    managementTipsBn: 'বন্যা নেমে যাওয়ার পর প্রতি বিঘায় ৪ কেজি ইউরিয়া ও ২ কেজি পটাশ উপরিপ্রয়োগ করুন।',
    managementTipsEn: 'Top-dress with 4kg Urea and 2kg MOP per Bigha once flood water drains.',
    specialTraitBn: 'Sub1 জিনযুক্ত হওয়ায় পানির তোড়ে পচে না ও দ্রুত নতুন কুশি গজায়',
    specialTraitEn: 'Sub1 gene prevents stem rotting and spurs vigorous post-flood tillering'
  },
  {
    id: 'brri-52',
    name: 'ব্রি ধান৫২ (BRRI dhan 52)',
    breeder: 'BRRI',
    season: 'আমন (Aman)',
    stressType: 'flood',
    toleranceLevelBn: '২ সপ্তাহের বেশি আকস্মিক বন্যায় টিকে থাকে এবং স্বর্ণা ধানের সমান ফলন দেয়',
    toleranceLevelEn: 'Survives >2 weeks submerged with Swarna-equivalent grain yield',
    toleranceGauge: {
      value: 16,
      max: 25,
      unitBn: 'দিন জলমগ্নতা',
      unitEn: 'Days Submerged',
      labelBn: '১৬ দিন পানির নিচে সহনশীল',
      labelEn: 'Tolerates 16 days total submersion'
    },
    durationDays: 145,
    yieldPotentialBn: '১৮-২০ মণ / বিঘা (৫.০ টন/হে.)',
    yieldPotentialEn: '18-20 Mon / Bigha (5.0 t/ha)',
    suitableRegionsBn: 'সিলেট, সুনামগঞ্জ, নেত্রকোনা ও উত্তরবঙ্গের নিম্নাঞ্চল',
    suitableRegionsEn: 'Sylhet, Sunamganj, Netrokona Haor & Northern wetlands',
    managementTipsBn: '৩০-৩৫ দিনের বয়স্ক চারা রোপণ করলে পানির তোড় সহজে সহ্য করতে পারে।',
    managementTipsEn: 'Transplant 30-35 day mature sturdy seedlings to withstand water currents.',
    specialTraitBn: 'স্বর্ণা ধানের সমমানের প্রিমিয়াম ভাত ও উচ্চ বাজারদর',
    specialTraitEn: 'Premium grain quality equivalent to popular Swarna rice'
  },
  {
    id: 'bina-11',
    name: 'বিনা ধান-১১ (BINA dhan-11)',
    breeder: 'BINA',
    season: 'আমন (Aman)',
    stressType: 'flood',
    toleranceLevelBn: '২০-২৫ দিন জলমগ্নতা সহনশীল এবং স্বল্পমেয়াদী হওয়ায় বন্যার পর রবি ফসল করা যায়',
    toleranceLevelEn: '20-25 days submergence tolerance; short-duration enables early Rabi crops',
    toleranceGauge: {
      value: 25,
      max: 25,
      unitBn: 'দিন জলমগ্নতা',
      unitEn: 'Days Submerged',
      labelBn: '২৫ দিন পর্যন্ত জলমগ্নতা সহনশীল (সর্বোচ্চ)',
      labelEn: 'Up to 25 days tolerance (Highest in class)'
    },
    durationDays: 120,
    yieldPotentialBn: '১৫-১৭ মণ / বিঘা (৪.২ টন/হে.)',
    yieldPotentialEn: '15-17 Mon / Bigha (4.2 t/ha)',
    suitableRegionsBn: 'চরাঞ্চল ও মধ্যবর্তী বন্যাপ্রবণ অববাহিকা',
    suitableRegionsEn: 'Riverine Chars and active floodplains',
    managementTipsBn: 'স্বল্প জীবনকাল হওয়ায় রবি সরিষা বা আলুর জন্য জমি দ্রুত খালি হয়।',
    managementTipsEn: 'Quick maturity clears fields on time for profitable Rabi Mustard or Potato.',
    specialTraitBn: 'মাত্র ১২০ দিনের স্বল্পজীবনকাল — রবি ফসলের আগাম সুযোগ',
    specialTraitEn: 'Ultra short 120-day cycle opens field early for Rabi Mustard/Potato'
  },

  // Coastal Salinity
  {
    id: 'brri-67',
    name: 'ব্রি ধান৬৭ (BRRI dhan 67)',
    breeder: 'BRRI',
    season: 'বোরো (Boro)',
    stressType: 'salinity',
    toleranceLevelBn: 'চারা অবস্থায় ৮-১২ dS/m এবং পুরো জীবনকালে ৮ dS/m লবণাক্ততা সহ্য করে',
    toleranceLevelEn: 'Tolerates 8-12 dS/m salinity at seedling stage and 8 dS/m throughout cycle',
    toleranceGauge: {
      value: 12,
      max: 16,
      unitBn: 'dS/m লবণাক্ততা',
      unitEn: 'dS/m Salinity',
      labelBn: '১২ dS/m নোনা পানি সহনশীল',
      labelEn: 'Resists up to 12 dS/m saline stress'
    },
    durationDays: 140,
    yieldPotentialBn: '২২-২৪ মণ / বিঘা (৬.৫ টন/হে.)',
    yieldPotentialEn: '22-24 Mon / Bigha (6.5 t/ha)',
    suitableRegionsBn: 'সাতক্ষীরা, খুলনা, বাগেরহাট, বরগুনা, পটুয়াখালী উপকূলীয় বোরো মৌসুম',
    suitableRegionsEn: 'Satkhira, Khulna, Bagerhat, Barguna, Patuakhali coastal Boro tract',
    managementTipsBn: 'লবণাক্ততা বেশি হলে জমিতে জিপসাম সার (সালফার) এবং জৈব সার বেশি দিন।',
    managementTipsEn: 'Apply extra Gypsum (Sulphur) and organic compost to displace sodium ions.',
    specialTraitBn: 'উপকূলের প্রতিকূল নোনা মাটিতেও বাম্পার ফলন (৬.৫ টন/হে.)',
    specialTraitEn: 'High-yielding capacity (6.5 t/ha) under challenging coastal brackish soils'
  },
  {
    id: 'brri-97-99',
    name: 'ব্রি ধান৯৭ ও ব্রি ধান৯৯',
    breeder: 'BRRI',
    season: 'বোরো (Boro)',
    stressType: 'salinity',
    toleranceLevelBn: '১৪ dS/m পর্যন্ত তীব্র লবণাক্ত পানি সহ্য করতে সক্ষম নতুন উচ্চফলনশীল জাত',
    toleranceLevelEn: 'Advanced HYV tolerating high saline surges up to 14 dS/m',
    toleranceGauge: {
      value: 14,
      max: 16,
      unitBn: 'dS/m লবণাক্ততা',
      unitEn: 'dS/m Salinity',
      labelBn: '১৪ dS/m তীব্র লবণাক্ততা প্রতিরোধ',
      labelEn: 'Withstands extreme 14 dS/m saline surges'
    },
    durationDays: 145,
    yieldPotentialBn: '২০-২২ মণ / বিঘা (৬.০ টন/হে.)',
    yieldPotentialEn: '20-22 Mon / Bigha (6.0 t/ha)',
    suitableRegionsBn: 'পেকুয়া, টেকনাফ, মহেশখালী, নোয়াখালী ও ভোলা উপকূল',
    suitableRegionsEn: 'Pekua, Teknaf, Moheshkhali, Noakhali and Bhola coastal belts',
    managementTipsBn: 'জোয়ারের সময় নোনা পানি আটকাতে খামারের স্লুইস গেট বন্ধ রাখুন।',
    managementTipsEn: 'Coordinate sluice gate management during high-tide brackish surges.',
    specialTraitBn: 'সবচেয়ে তীব্র নোনা এলাকায় আধুনিক বায়োটেকনোলজির উদ্ভাবন',
    specialTraitEn: 'Engineered for extreme coastal salinity zones with modern biotechnology'
  },

  // Drought & Barind Tract
  {
    id: 'brri-71',
    name: 'ব্রি ধান৭১ (BRRI dhan 71)',
    breeder: 'BRRI',
    season: 'আমন (Aman)',
    stressType: 'drought',
    toleranceLevelBn: 'ফুল ফোটার সময় টানা ২০-২৫ দিন বৃষ্টি না হলেও স্বাভাবিক ফলন দেয়',
    toleranceLevelEn: 'Resists 20-25 days dry spell during flowering without sterile spikes',
    toleranceGauge: {
      value: 25,
      max: 30,
      unitBn: 'দিন অনাবৃষ্টি',
      unitEn: 'Days Drought',
      labelBn: '২৫ দিন খরা সহনশীল',
      labelEn: 'Resists 25 dry spell days at flowering'
    },
    durationDays: 115,
    yieldPotentialBn: '১৮-২০ মণ / বিঘা (৫.৫ টন/হে.)',
    yieldPotentialEn: '18-20 Mon / Bigha (5.5 t/ha)',
    suitableRegionsBn: 'রাজশাহী, চাঁপাইনবাবগঞ্জ, নওগাঁ ও কুষ্টিয়া বরেন্দ্র অঞ্চল',
    suitableRegionsEn: 'Rajshahi, Chapainawabganj, Naogaon Barind drought tract',
    managementTipsBn: 'পর্যায়ক্রমিক ভিজানো ও শুকানো (AWD) পদ্ধতিতে ৩০% সেচের পানি সাশ্রয় হয়।',
    managementTipsEn: 'Use Alternate Wetting and Drying (AWD) pipe to cut irrigation cost by 30%.',
    specialTraitBn: 'গভীর শিকড় যা মাটির তলদেশ থেকে আর্দ্রতা টেনে নেয়',
    specialTraitEn: 'Deep penetrating root architecture pulls moisture from subsoil layers'
  },
  {
    id: 'bari-gom-33',
    name: 'বারি গম-৩৩ (BARI Gom 33)',
    breeder: 'BARI',
    season: 'রবি (Rabi)',
    stressType: 'drought',
    toleranceLevelBn: 'উচ্চ তাপমাত্রা ও ব্লাস্ট রোগ প্রতিরোধী জিংক সমৃদ্ধ জাত',
    toleranceLevelEn: 'Heat-tolerant and resistant to deadly Wheat Blast fungus; rich in Zinc',
    toleranceGauge: {
      value: 22,
      max: 30,
      unitBn: 'দিন তাপ ও খরা',
      unitEn: 'Days Heat/Dry',
      labelBn: 'উচ্চ তাপ ও খরা প্রতিরোধক',
      labelEn: 'Resists terminal heatwave shock'
    },
    durationDays: 105,
    yieldPotentialBn: '১৪-১৬ মণ / বিঘা (৪.০ টন/হে.)',
    yieldPotentialEn: '14-16 Mon / Bigha (4.0 t/ha)',
    suitableRegionsBn: 'যশোর, চুয়াডাঙ্গা, মেহেরপুর ও উত্তরবঙ্গের উষ্ণ অঞ্চল',
    suitableRegionsEn: 'Jashore, Chuadanga, Meherpur and North-West high-temperature regions',
    managementTipsBn: 'নভেম্বরের ১৫-৩০ তারিখের মধ্যে বপন করলে সর্বোচ্চ ফলন পাওয়া যায়।',
    managementTipsEn: 'Sow between Nov 15-30 to escape extreme late-spring terminal heat.',
    specialTraitBn: 'মারাত্মক ব্লাস্ট রোগ প্রতিরোধী ও পুষ্টিকর বায়োফর্টিফাইড জিংক সমৃদ্ধ',
    specialTraitEn: 'Immune to deadly Wheat Blast fungus with biofortified Zinc enrichment'
  },

  // Cold Wave
  {
    id: 'brri-36',
    name: 'ব্রি ধান৩৬ (BRRI dhan 36)',
    breeder: 'BRRI',
    season: 'বোরো (Boro)',
    stressType: 'cold',
    toleranceLevelBn: 'তীব্র শৈত্যপ্রবাহেও চারা হলুদ হয় না ও কুশি গজানো ব্যাহত হয় না',
    toleranceLevelEn: 'Seedlings resist severe cold waves and yellowing shock during early Boro',
    toleranceGauge: {
      value: 10,
      max: 15,
      unitBn: '°C শৈত্য সহন',
      unitEn: '°C Cold Shock',
      labelBn: '১০°C নিম্ন তাপমাত্রায় স্বাভাবিক বৃদ্ধি',
      labelEn: 'Normal tillering even at 10°C low temperature'
    },
    durationDays: 140,
    yieldPotentialBn: '১৮-২০ মণ / বিঘা (৫.০ টন/হে.)',
    yieldPotentialEn: '18-20 Mon / Bigha (5.0 t/ha)',
    suitableRegionsBn: 'পঞ্চগড়, ঠাকুরগাঁও, দিনাজপুর ও রংপুর শীতপ্রধান অঞ্চল',
    suitableRegionsEn: 'Panchagarh, Thakurgaon, Dinajpur cold-prone belt',
    managementTipsBn: 'কুয়াশার রাতে বীজতলায় পলিথিন ছাউনি দিন এবং সকালে জমা পানি বের করে দিন।',
    managementTipsEn: 'Cover nursery with transparent polythene at night; wash cold dew at sunrise.',
    specialTraitBn: 'উত্তরাঞ্চলের তীব্র শীতে বোরো ধানের চারা রক্ষা করার প্রধান ভরসা',
    specialTraitEn: 'Prevents winter seedling mortality and cold yellowing in northern districts'
  }
];

interface Props {
  lang: Language;
  onNavigateTab?: (tab: any, payload?: any) => void;
}

type DesignMode = 'botanical-editorial' | 'master-detail' | 'atmospheric-gauges' | 'comparison-matrix';

export default function ClimateResilienceGuide({ lang, onNavigateTab }: Props) {
  const [selectedStress, setSelectedStress] = useState<'all' | 'flood' | 'salinity' | 'drought' | 'cold'>('all');
  const [designMode, setDesignMode] = useState<DesignMode>('botanical-editorial');
  
  // Master-Detail active selection
  const [selectedVarietyId, setSelectedVarietyId] = useState<string>('brri-51');

  // Multi-variety comparison selection
  const [comparisonIds, setComparisonIds] = useState<string[]>(['brri-51', 'bina-11']);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);

  const filteredVarieties = selectedStress === 'all'
    ? STRESS_VARIETIES
    : STRESS_VARIETIES.filter(v => v.stressType === selectedStress);

  const activeVariety = STRESS_VARIETIES.find(v => v.id === selectedVarietyId) || STRESS_VARIETIES[0];

  const toggleComparison = (id: string) => {
    if (comparisonIds.includes(id)) {
      if (comparisonIds.length > 1) {
        setComparisonIds(comparisonIds.filter(item => item !== id));
      }
    } else {
      if (comparisonIds.length < 3) {
        setComparisonIds([...comparisonIds, id]);
      } else {
        setComparisonIds([comparisonIds[1], comparisonIds[2], id]);
      }
    }
  };

  const getStressTheme = (stress: string) => {
    switch (stress) {
      case 'flood':
        return {
          labelBn: 'জলমগ্নতা ও বন্যা',
          labelEn: 'Flood Submergence',
          icon: Waves,
          colorText: 'text-sky-800',
          colorBg: 'bg-sky-50',
          colorBorder: 'border-sky-200',
          colorAccent: 'from-sky-600 to-blue-700',
          colorBadge: 'bg-sky-100 text-sky-900 border-sky-300',
          barColor: 'bg-sky-500'
        };
      case 'salinity':
        return {
          labelBn: 'উপকূলীয় লবণাক্ততা',
          labelEn: 'Coastal Salinity',
          icon: Droplets,
          colorText: 'text-teal-800',
          colorBg: 'bg-teal-50',
          colorBorder: 'border-teal-200',
          colorAccent: 'from-teal-600 to-emerald-800',
          colorBadge: 'bg-teal-100 text-teal-900 border-teal-300',
          barColor: 'bg-teal-500'
        };
      case 'drought':
        return {
          labelBn: 'খরা ও তাপপ্রবাহ',
          labelEn: 'Drought & Heat',
          icon: Sun,
          colorText: 'text-amber-800',
          colorBg: 'bg-amber-50',
          colorBorder: 'border-amber-200',
          colorAccent: 'from-amber-600 to-orange-700',
          colorBadge: 'bg-amber-100 text-amber-900 border-amber-300',
          barColor: 'bg-amber-500'
        };
      default:
        return {
          labelBn: 'শৈত্যপ্রবাহ',
          labelEn: 'Cold Wave',
          icon: ThermometerSnowflake,
          colorText: 'text-indigo-800',
          colorBg: 'bg-indigo-50',
          colorBorder: 'border-indigo-200',
          colorAccent: 'from-indigo-600 to-slate-800',
          colorBadge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
          barColor: 'bg-indigo-500'
        };
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header Banner with Clean Identity */}
      <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl border border-emerald-800/40">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-mono text-emerald-300">
              <Sprout className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সরকারি ব্রি, বারি ও বিনা উদ্ভাবিত প্রযুক্তি' : 'Authenticated National Seed Registry'}</span>
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {lang === 'bn' ? 'প্রতিকূল পরিবেশ সহনশীল শস্য নির্দেশিকা' : 'Climate-Smart Crop Resilience Index'}
            </h1>
            <p className="text-emerald-100/80 text-sm max-w-2xl leading-relaxed">
              {lang === 'bn'
                ? 'বন্যা, উপকূলের লবণাক্ততা ও বরেন্দ্রের খরার ঝুঁকি মোকাবিলার জন্য বৈজ্ঞানিকভাবে প্রমাণিত ফসলের জাত। নিচে চারটি ভিন্ন ভিজ্যুয়াল শৈলীতে ব্রাউজ করুন।'
                : 'Scientifically validated cultivars engineered for submerged floodplains, coastal saline belts, and drought zones. Explore across 4 distinctive design philosophies.'}
            </p>
          </div>

          {/* Quick Helpline Hotline */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl self-start md:self-auto space-y-1.5 shrink-0">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-200">
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'bn' ? 'কৃষি জরুরি হেল্পলাইন' : 'Agri Emergency Helpline'}</span>
            </div>
            <div className="text-2xl font-black text-white font-mono tracking-wider">
              16123 / 333
            </div>
            <p className="text-[10px] text-emerald-200/80 font-medium">
              {lang === 'bn' ? 'সকাল ৯টা - বিকাল ৫টা (বিনামূল্যে)' : 'Toll-Free Agricultural Support'}
            </p>
          </div>
        </div>
      </div>

      {/* 4 DESIGN PHILOSOPHIES SELECTOR (Direct Answer to User Request) */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-stone-900">
                {lang === 'bn' ? 'ডিজাইন শৈলী নির্বাচন করুন (Choose UI/UX Philosophy)' : 'Choose UI/UX Design Philosophy'}
              </h2>
              <p className="text-xs text-stone-500">
                {lang === 'bn' 
                  ? 'বক্স ও কার্ডের একঘেয়েমি দূর করতে ৪টি অনন্য ডিজাইন বিকল্প তৈরি করা হয়েছে'
                  : 'Compare 4 distinctive non-generic layouts to determine your ideal user experience'}
              </p>
            </div>
          </div>

          <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold self-start sm:self-auto">
            {lang === 'bn' ? '💡 টিপ: সবগুলো ট্যাব ঘুরে দেখে পছন্দের শৈলী বেছে নিন' : '💡 Tip: Click each tab to preview the interaction feel'}
          </div>
        </div>

        {/* 4 Style Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setDesignMode('botanical-editorial')}
            className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              designMode === 'botanical-editorial'
                ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/10'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <BookOpen className={`w-4 h-4 shrink-0 ${designMode === 'botanical-editorial' ? 'text-emerald-400' : 'text-stone-500'}`} />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">
                {lang === 'bn' ? '১. বোটানিক্যাল ডসিয়ার' : '1. Botanical Dossier'}
              </div>
              <div className={`text-[10px] truncate ${designMode === 'botanical-editorial' ? 'text-stone-300' : 'text-stone-500'}`}>
                {lang === 'bn' ? 'বক্সবিহীন এডিটোরিয়াল স্পেক' : 'Clean unboxed spec sheet'}
              </div>
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setDesignMode('master-detail')}
            className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              designMode === 'master-detail'
                ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/10'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Columns2 className={`w-4 h-4 shrink-0 ${designMode === 'master-detail' ? 'text-teal-400' : 'text-stone-500'}`} />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">
                {lang === 'bn' ? '২. ইন্টারেক্টিভ ইনডেক্স' : '2. Split Master-Detail'}
              </div>
              <div className={`text-[10px] truncate ${designMode === 'master-detail' ? 'text-stone-300' : 'text-stone-500'}`}>
                {lang === 'bn' ? 'বামপাশে তালিকা, ডানে বিস্তারিত' : 'Quick navigation + deep view'}
              </div>
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setDesignMode('atmospheric-gauges')}
            className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              designMode === 'atmospheric-gauges'
                ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/10'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <LayoutGrid className={`w-4 h-4 shrink-0 ${designMode === 'atmospheric-gauges' ? 'text-sky-400' : 'text-stone-500'}`} />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">
                {lang === 'bn' ? '৩. পরিবেশগত গেজ' : '3. Environmental Gauges'}
              </div>
              <div className={`text-[10px] truncate ${designMode === 'atmospheric-gauges' ? 'text-stone-300' : 'text-stone-500'}`}>
                {lang === 'bn' ? 'পানির স্তর ও লবণাক্ততা মিটার' : 'Water & salinity metric bars'}
              </div>
            </div>
          </motion.button>

          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setDesignMode('comparison-matrix')}
            className={`flex items-center space-x-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
              designMode === 'comparison-matrix'
                ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/10'
                : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <TableProperties className={`w-4 h-4 shrink-0 ${designMode === 'comparison-matrix' ? 'text-amber-400' : 'text-stone-500'}`} />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">
                {lang === 'bn' ? '৪. তুলনামূলক মেট্রিক্স' : '4. Comparison Matrix'}
              </div>
              <div className={`text-[10px] truncate ${designMode === 'comparison-matrix' ? 'text-stone-300' : 'text-stone-500'}`}>
                {lang === 'bn' ? 'পাশাপাশি জাতের তুলনা টেবিল' : 'Side-by-side data table'}
              </div>
            </div>
          </motion.button>
        </div>
      </div>

      {/* Stress Category Filter Bar (Shared across all views) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedStress('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedStress === 'all'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {lang === 'bn' ? 'সকল জাত' : 'All Varieties'} ({STRESS_VARIETIES.length})
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedStress('flood')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedStress === 'flood'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Waves className="w-3.5 h-3.5 text-sky-400" />
            <span>{lang === 'bn' ? 'বন্যা ও জলমগ্নতা' : 'Flood'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedStress('salinity')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedStress === 'salinity'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-teal-300" />
            <span>{lang === 'bn' ? 'উপকূলীয় লবণাক্ততা' : 'Salinity'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedStress('drought')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedStress === 'drought'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-300" />
            <span>{lang === 'bn' ? 'খরা ও তাপপ্রবাহ' : 'Drought'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setSelectedStress('cold')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedStress === 'cold'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <ThermometerSnowflake className="w-3.5 h-3.5 text-indigo-300" />
            <span>{lang === 'bn' ? 'শৈত্যপ্রবাহ' : 'Cold'}</span>
          </motion.button>
        </div>

        {/* Quick Comparison Trigger */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowComparisonModal(true)}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
        >
          <Scale className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            {lang === 'bn' ? `পাশাপাশি তুলনা (${comparisonIds.length})` : `Compare (${comparisonIds.length})`}
          </span>
        </motion.button>
      </div>

      {/* =========================================================================
          DESIGN 1: THE BOTANICAL FIELD DOSSIER (Unboxed, Editorial & High-Craft)
          ========================================================================= */}
      {designMode === 'botanical-editorial' && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200 flex items-center justify-between">
            <div className="text-xs text-stone-600 leading-relaxed">
              <strong className="text-stone-900 font-bold">{lang === 'bn' ? 'ডিজাইন বৈশিষ্ট্য:' : 'Design Philosophy:'}</strong>{' '}
              {lang === 'bn'
                ? 'কোনো কার্ডের ভিতর কার্ড বা নেস্টেড বাক্স নেই। কাগজের মত পরিচ্ছন্ন এডিটোরিয়াল স্পেক শীট, স্পষ্ট টাইপোগ্রাফি এবং উচ্চ-কনট্রাস্ট ডেটা স্ট্রিপ।'
                : 'Zero nested cards or box clutter. Editorial botanical layout with distinct typographic hierarchy, fine hairline rules, and generous whitespace.'}
            </div>
            <span className="text-[11px] font-mono font-bold text-stone-500 bg-white px-2.5 py-1 rounded-lg border border-stone-200 shrink-0 ml-3">
              Editorial Spec Sheet
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-sm divide-y divide-stone-100 overflow-hidden">
            {filteredVarieties.map((variety, idx) => {
              const theme = getStressTheme(variety.stressType);
              const Icon = theme.icon;
              const isSelected = comparisonIds.includes(variety.id);

              return (
                <motion.div 
                  key={variety.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.3) }}
                  className="p-6 md:p-8 hover:bg-stone-50/60 transition-colors group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    {/* Left: Identity & Core Trait */}
                    <div className="lg:w-5/12 space-y-3">
                      <div className="flex items-center space-x-2.5">
                        <span className={`inline-flex items-center space-x-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.colorBadge}`}>
                          <Icon className="w-3 h-3" />
                          <span>{lang === 'bn' ? theme.labelBn : theme.labelEn}</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-stone-400">
                          {variety.breeder} • {variety.season}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-2xl font-black text-stone-900 tracking-tight group-hover:text-emerald-950 transition-colors">
                          {variety.name}
                        </h3>
                        <p className="text-xs text-stone-500 font-medium mt-1">
                          {lang === 'bn' ? variety.specialTraitBn : variety.specialTraitEn}
                        </p>
                      </div>

                      {/* Primary Tolerance Capacity Statement (Unboxed) */}
                      <div className="pt-2">
                        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                          {lang === 'bn' ? 'সহনশীলতার সর্বোচ্চ মাত্রা' : 'Stress Tolerance Threshold'}
                        </div>
                        <p className="text-sm font-bold text-stone-900 mt-1 leading-snug">
                          {lang === 'bn' ? variety.toleranceLevelBn : variety.toleranceLevelEn}
                        </p>
                      </div>
                    </div>

                    {/* Middle: Airy Horizontal Metric Strip */}
                    <div className="lg:w-4/12 grid grid-cols-2 sm:grid-cols-3 gap-4 py-3 lg:py-0 border-y lg:border-y-0 lg:border-x border-stone-200/80 lg:px-6">
                      <div>
                        <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                          {lang === 'bn' ? 'জীবনকাল' : 'Duration'}
                        </div>
                        <div className="text-2xl font-black text-stone-900 font-mono mt-0.5">
                          {variety.durationDays}
                          <span className="text-xs font-sans font-medium text-stone-500 ml-1">
                            {lang === 'bn' ? 'দিন' : 'd'}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {variety.durationDays < 130 
                            ? (lang === 'bn' ? 'স্বল্পমেয়াদী' : 'Short cycle') 
                            : (lang === 'bn' ? 'মাঝারি মেয়াদী' : 'Medium cycle')}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                          {lang === 'bn' ? 'সম্ভাব্য ফলন' : 'Yield Potential'}
                        </div>
                        <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
                          {variety.yieldPotentialBn.split('/')[0]}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {lang === 'bn' ? 'অনুকূল পরিচর্যায়' : 'Under optimal care'}
                        </div>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                          {lang === 'bn' ? 'সহনশীল সীমা' : 'Threshold'}
                        </div>
                        <div className="text-lg font-black text-sky-800 font-mono mt-0.5">
                          {variety.toleranceGauge.value}{' '}
                          <span className="text-[10px] font-sans font-medium text-stone-500">
                            {lang === 'bn' ? variety.toleranceGauge.unitBn.split(' ')[0] : variety.toleranceGauge.unitEn.split(' ')[0]}
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {variety.breeder} সার্টিফাইড
                        </div>
                      </div>
                    </div>

                    {/* Right: Geographical Suitability & Smart Actions */}
                    <div className="lg:w-3/12 space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5 text-stone-400 text-xs font-bold uppercase tracking-wider">
                          <Compass className="w-3.5 h-3.5 text-stone-500" />
                          <span>{lang === 'bn' ? 'অনুকূল এলাকা' : 'Target Region'}</span>
                        </div>
                        <p className="text-xs text-stone-700 leading-relaxed font-medium">
                          {lang === 'bn' ? variety.suitableRegionsBn : variety.suitableRegionsEn}
                        </p>
                      </div>

                      {/* Management Note */}
                      <div className="text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-xl border border-stone-200/60">
                        <strong className="text-stone-800 font-bold">{lang === 'bn' ? 'মাঠ পরামর্শ: ' : 'Field Tip: '}</strong>
                        {lang === 'bn' ? variety.managementTipsBn : variety.managementTipsEn}
                      </div>

                      {/* Clean Actions */}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleComparison(variety.id)}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                          <span>{isSelected ? (lang === 'bn' ? 'যুক্ত আছে' : 'Selected') : (lang === 'bn' ? '+ তুলনা করুন' : '+ Compare')}</span>
                        </button>

                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('krishi-profit', { crop: 'paddy_aman' })}
                            className="flex items-center space-x-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                          >
                            <span>{lang === 'bn' ? 'লাভ হিসাব' : 'Calculator'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          DESIGN 2: THE INTERACTIVE BOTANICAL INDEX (Split Master-Detail)
          ========================================================================= */}
      {designMode === 'master-detail' && (
        <div className="space-y-6">
          <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200 flex items-center justify-between">
            <div className="text-xs text-stone-600 leading-relaxed">
              <strong className="text-stone-900 font-bold">{lang === 'bn' ? 'ডিজাইন বৈশিষ্ট্য:' : 'Design Philosophy:'}</strong>{' '}
              {lang === 'bn'
                ? 'স্ক্রল করে লম্বা পেজে হারিয়ে না গিয়ে বামপাশে জাতের কমপ্যাক্ট ইনডেক্স থেকে ক্লিক করুন, আর ডানপাশে বড় পূর্ণাঙ্গ বোটানিক্যাল ডসিয়ার শিট স্বয়ংক্রিয়ভাবে আপডেট হবে।'
                : 'Zero vertical scroll fatigue. A compact catalog on the left paired with an authoritative, expansive field dossier on the right.'}
            </div>
            <span className="text-[11px] font-mono font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 shrink-0 ml-3">
              Master-Detail Layout
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Cultivar Catalog List */}
            <div className="lg:col-span-4 bg-white rounded-3xl border border-stone-200 shadow-sm p-3 space-y-2">
              <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between">
                <span className="text-xs font-black text-stone-900 uppercase tracking-wider">
                  {lang === 'bn' ? 'জাতের তালিকা' : 'Cultivar Index'} ({filteredVarieties.length})
                </span>
                <span className="text-[11px] text-stone-400 font-medium">
                  {lang === 'bn' ? 'ক্লিক করে বিস্তারিত দেখুন' : 'Click to inspect'}
                </span>
              </div>

              <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
                {filteredVarieties.map((variety) => {
                  const theme = getStressTheme(variety.stressType);
                  const Icon = theme.icon;
                  const isActive = activeVariety.id === variety.id;

                  return (
                    <button
                      key={variety.id}
                      type="button"
                      onClick={() => setSelectedVarietyId(variety.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'bg-stone-900 text-white border-stone-900 shadow-md ring-2 ring-stone-900/10'
                          : 'bg-white text-stone-800 border-stone-100 hover:bg-stone-50 hover:border-stone-200'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isActive ? 'bg-white/20 text-white' : theme.colorBadge
                          }`}>
                            {variety.breeder}
                          </span>
                          <span className={`text-[10px] font-bold ${isActive ? 'text-stone-300' : 'text-stone-500'}`}>
                            {variety.season.split(' ')[0]}
                          </span>
                        </div>
                        <div className="text-sm font-black truncate">
                          {variety.name}
                        </div>
                        <div className={`text-[11px] truncate ${isActive ? 'text-stone-300' : 'text-stone-500'}`}>
                          {variety.durationDays} {lang === 'bn' ? 'দিন' : 'days'} • {variety.toleranceGauge.labelBn.split(' ')[0]}
                        </div>
                      </div>

                      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                        isActive ? 'text-emerald-400 translate-x-0.5' : 'text-stone-300'
                      }`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Expansive Field Dossier */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-stone-200 shadow-sm p-6 md:p-8 space-y-6">
              {/* Active Variety Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-6 border-b border-stone-200">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2.5">
                    {(() => {
                      const theme = getStressTheme(activeVariety.stressType);
                      const Icon = theme.icon;
                      return (
                        <span className={`inline-flex items-center space-x-1.5 text-xs font-black px-3 py-1 rounded-full border ${theme.colorBadge}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? theme.labelBn : theme.labelEn}</span>
                        </span>
                      );
                    })()}
                    <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                      {activeVariety.breeder} • {activeVariety.season}
                    </span>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
                    {activeVariety.name}
                  </h2>
                  <p className="text-sm font-medium text-emerald-800">
                    {lang === 'bn' ? activeVariety.specialTraitBn : activeVariety.specialTraitEn}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleComparison(activeVariety.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      comparisonIds.includes(activeVariety.id)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-stone-50 text-stone-800 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {comparisonIds.includes(activeVariety.id)
                      ? (lang === 'bn' ? '✓ তালিকায় যুক্ত' : '✓ In Comparison')
                      : (lang === 'bn' ? '+ তুলনায় যোগ করুন' : '+ Add to Compare')}
                  </button>
                </div>
              </div>

              {/* Graphical Stress Resistance Gauge */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                    {lang === 'bn' ? 'সহনশীলতার পরিমাপক (Stress Gauge)' : 'Stress Resistance Gauge'}
                  </div>
                  <div className="text-sm font-black font-mono text-stone-900">
                    {activeVariety.toleranceGauge.value} / {activeVariety.toleranceGauge.max}{' '}
                    <span className="text-xs font-sans text-stone-500">
                      {lang === 'bn' ? activeVariety.toleranceGauge.unitBn : activeVariety.toleranceGauge.unitEn}
                    </span>
                  </div>
                </div>

                {/* Visual Bar */}
                <div className="w-full bg-stone-200 h-3 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(activeVariety.toleranceGauge.value / activeVariety.toleranceGauge.max) * 100}%` }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    className={`h-full rounded-full ${getStressTheme(activeVariety.stressType).barColor}`}
                  />
                </div>

                <div className="text-xs text-stone-600 font-medium">
                  {lang === 'bn' ? activeVariety.toleranceLevelBn : activeVariety.toleranceLevelEn}
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl border border-stone-200 bg-white space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'মোট জীবনকাল' : 'Maturity Days'}
                  </div>
                  <div className="text-2xl font-black text-stone-900 font-mono">
                    {activeVariety.durationDays}{' '}
                    <span className="text-xs font-sans text-stone-500 font-medium">
                      {lang === 'bn' ? 'দিন' : 'Days'}
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {lang === 'bn' ? 'বীজ থেকে পরিপক্বতা' : 'Seed to harvest'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-stone-200 bg-white space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'সম্ভাব্য ফলন' : 'Yield Capacity'}
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {activeVariety.yieldPotentialBn.split('/')[0]}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {activeVariety.yieldPotentialBn.split('(')[1]?.replace(')', '') || 'উচ্চফলনশীল'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-stone-200 bg-white space-y-1">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                    {lang === 'bn' ? 'উদ্ভাবন সংস্থা' : 'Research Institute'}
                  </div>
                  <div className="text-2xl font-black text-stone-900 font-mono">
                    {activeVariety.breeder}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {activeVariety.breeder === 'BRRI' 
                      ? (lang === 'bn' ? 'বাংলাদেশ ধান গবেষণা' : 'Rice Research Inst.') 
                      : (lang === 'bn' ? 'পরমাণু কৃষি গবেষণা' : 'Nuclear Agri Inst.')}
                  </div>
                </div>
              </div>

              {/* Agronomic Lifecycle Guidance */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-emerald-700" />
                  <span>{lang === 'bn' ? 'অনুকূল এলাকা ও ভৌগোলিক বিন্যাস' : 'Suitable Regions & Geography'}</span>
                </h4>
                <p className="text-sm text-stone-700 leading-relaxed font-medium bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200/80">
                  {lang === 'bn' ? activeVariety.suitableRegionsBn : activeVariety.suitableRegionsEn}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black text-stone-900 uppercase tracking-wider flex items-center space-x-2">
                  <Sprout className="w-4 h-4 text-emerald-700" />
                  <span>{lang === 'bn' ? 'বিশেষ মাঠ পরিচর্যা ও সার প্রয়োগ' : 'Agronomic Protocol & Fertilizer Guide'}</span>
                </h4>
                <p className="text-sm text-stone-700 leading-relaxed font-medium bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100">
                  {lang === 'bn' ? activeVariety.managementTipsBn : activeVariety.managementTipsEn}
                </p>
              </div>

              {/* Action Buttons */}
              {onNavigateTab && (
                <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('weather-advisory')}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-bold text-xs transition-all cursor-pointer"
                  >
                    <Cloud className="w-4 h-4 text-sky-600" />
                    <span>{lang === 'bn' ? 'আবহাওয়া ঝুঁকি চেক' : 'Weather Risk'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('krishi-profit', { crop: 'paddy_aman' })}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-all cursor-pointer shadow-sm"
                  >
                    <Calculator className="w-4 h-4 text-emerald-300" />
                    <span>{lang === 'bn' ? 'উৎপাদন ব্যয় ও লাভ হিসাব' : 'Cost & Profit'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DESIGN 3: ATMOSPHERIC CARDS WITH ENVIRONMENTAL GAUGES
          ========================================================================= */}
      {designMode === 'atmospheric-gauges' && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200 flex items-center justify-between">
            <div className="text-xs text-stone-600 leading-relaxed">
              <strong className="text-stone-900 font-bold">{lang === 'bn' ? 'ডিজাইন বৈশিষ্ট্য:' : 'Design Philosophy:'}</strong>{' '}
              {lang === 'bn'
                ? 'জেনেরিক সাদাকালো কার্ডের পরিবর্তে প্রতিটি জলবায়ু সংকটের (বন্যা, লবণাক্ততা, খরা) জন্য প্রাকৃতিক থিম ও গ্রাফিক্যাল গেজ বার, যা এক পলকেই সহনশীলতা প্রকাশ করে।'
                : 'Visually differentiated by environmental condition. Water-level depth bars and salinity EC meters turn numbers into visual cues.'}
            </div>
            <span className="text-[11px] font-mono font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 shrink-0 ml-3">
              Atmospheric Gauges
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVarieties.map((variety) => {
              const theme = getStressTheme(variety.stressType);
              const Icon = theme.icon;
              const isSelected = comparisonIds.includes(variety.id);

              return (
                <motion.div
                  key={variety.id}
                  whileHover={{ y: -4 }}
                  className="bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Atmospheric Top Accent Bar */}
                  <div>
                    <div className={`p-4 bg-gradient-to-r ${theme.colorAccent} text-white flex items-center justify-between`}>
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4 text-white" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          {lang === 'bn' ? theme.labelBn : theme.labelEn}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md">
                        {variety.breeder}
                      </span>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Name & Season */}
                      <div>
                        <h3 className="text-xl font-black text-stone-900 tracking-tight">
                          {variety.name}
                        </h3>
                        <div className="text-xs font-bold text-stone-500 mt-0.5 flex items-center space-x-2">
                          <span>{variety.season}</span>
                          <span>•</span>
                          <span className="text-emerald-700">{variety.durationDays} {lang === 'bn' ? 'দিন জীবনকাল' : 'Days'}</span>
                        </div>
                      </div>

                      {/* Environmental Gauge Widget */}
                      <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-stone-600">
                            {lang === 'bn' ? 'সহনশীলতার সর্বোচ্চ সীমা:' : 'Tolerance Capacity:'}
                          </span>
                          <span className="font-mono font-black text-stone-900">
                            {variety.toleranceGauge.value} / {variety.toleranceGauge.max}
                          </span>
                        </div>

                        <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(variety.toleranceGauge.value / variety.toleranceGauge.max) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className={`h-full rounded-full ${theme.barColor}`}
                          />
                        </div>

                        <div className="text-[11px] font-medium text-stone-700">
                          {lang === 'bn' ? variety.toleranceGauge.labelBn : variety.toleranceGauge.labelEn}
                        </div>
                      </div>

                      {/* Yield & Regions */}
                      <div className="space-y-2 text-xs text-stone-600">
                        <div>
                          <strong className="text-stone-900">{lang === 'bn' ? 'সম্ভাব্য ফলন:' : 'Yield:'}</strong>{' '}
                          {lang === 'bn' ? variety.yieldPotentialBn : variety.yieldPotentialEn}
                        </div>
                        <div>
                          <strong className="text-stone-900">{lang === 'bn' ? 'উপযুক্ত এলাকা:' : 'Zones:'}</strong>{' '}
                          {lang === 'bn' ? variety.suitableRegionsBn : variety.suitableRegionsEn}
                        </div>
                      </div>

                      {/* Special Trait Highlight */}
                      <div className="text-[11px] text-stone-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <strong className="text-emerald-900">{lang === 'bn' ? 'বিশেষত্ব: ' : 'Trait: '}</strong>
                        {lang === 'bn' ? variety.specialTraitBn : variety.specialTraitEn}
                      </div>
                    </div>
                  </div>

                  {/* Clean Footer Controls */}
                  <div className="p-4 bg-stone-50/60 border-t border-stone-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleComparison(variety.id)}
                      className={`text-xs font-bold transition-colors cursor-pointer ${
                        isSelected ? 'text-emerald-700' : 'text-stone-500 hover:text-stone-800'
                      }`}
                    >
                      {isSelected ? (lang === 'bn' ? '✓ তুলনায় আছে' : '✓ Compared') : (lang === 'bn' ? '+ তুলনায় যোগ' : '+ Compare')}
                    </button>

                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('krishi-profit', { crop: 'paddy_aman' })}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center space-x-1 cursor-pointer"
                      >
                        <span>{lang === 'bn' ? 'লাভের হিসাব' : 'Profit Calc'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          DESIGN 4: MULTI-CULTIVAR COMPARISON MATRIX (Analytical Table)
          ========================================================================= */}
      {designMode === 'comparison-matrix' && (
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="bg-stone-50/80 rounded-2xl p-4 border border-stone-200 flex items-center justify-between">
            <div className="text-xs text-stone-600 leading-relaxed">
              <strong className="text-stone-900 font-bold">{lang === 'bn' ? 'ডিজাইন বৈশিষ্ট্য:' : 'Design Philosophy:'}</strong>{' '}
              {lang === 'bn'
                ? 'কৃষি গবেষক ও সিদ্ধান্ত গ্রহণকারী কৃষকদের জন্য তথ্যবহুল ডেটা টেবিল। ফলন, মেয়াদ ও সহনশীলতার তুলনা এক নজরে পাওয়া যায়।'
                : 'Dense, structured comparison matrix favored by agronomists. Side-by-side metric comparison across duration, yield, and tolerance.'}
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 shrink-0 ml-3">
              Analytical Matrix
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-900 text-white font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-4">{lang === 'bn' ? 'তুলনা' : 'Select'}</th>
                  <th className="p-4">{lang === 'bn' ? 'জাত ও উদ্ভাবক' : 'Cultivar & Breeder'}</th>
                  <th className="p-4">{lang === 'bn' ? 'সহনশীলতার ধরন' : 'Stress Trait'}</th>
                  <th className="p-4">{lang === 'bn' ? 'সহনশীল সীমা' : 'Tolerance'}</th>
                  <th className="p-4">{lang === 'bn' ? 'জীবনকাল' : 'Duration'}</th>
                  <th className="p-4">{lang === 'bn' ? 'সম্ভাব্য ফলন' : 'Yield Potential'}</th>
                  <th className="p-4">{lang === 'bn' ? 'উপযুক্ত এলাকা' : 'Target Region'}</th>
                  <th className="p-4 text-right">{lang === 'bn' ? 'কার্যক্রম' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-800">
                {filteredVarieties.map((variety) => {
                  const theme = getStressTheme(variety.stressType);
                  const isSelected = comparisonIds.includes(variety.id);

                  return (
                    <tr key={variety.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleComparison(variety.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-black text-stone-900 text-sm">{variety.name}</div>
                        <div className="text-[10px] text-stone-400 font-mono">{variety.breeder} • {variety.season}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${theme.colorBadge}`}>
                          {lang === 'bn' ? theme.labelBn : theme.labelEn}
                        </span>
                      </td>
                      <td className="p-4 max-w-[200px]">
                        <div className="font-bold text-stone-900 font-mono">
                          {variety.toleranceGauge.value} {variety.toleranceGauge.unitBn.split(' ')[0]}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate" title={variety.toleranceLevelBn}>
                          {variety.toleranceLevelBn}
                        </div>
                      </td>
                      <td className="p-4 font-mono font-black text-stone-900">
                        {variety.durationDays} {lang === 'bn' ? 'দিন' : 'd'}
                      </td>
                      <td className="p-4 font-bold text-emerald-800">
                        {variety.yieldPotentialBn.split('(')[0]}
                      </td>
                      <td className="p-4 text-[11px] text-stone-600 max-w-[180px] truncate" title={variety.suitableRegionsBn}>
                        {variety.suitableRegionsBn}
                      </td>
                      <td className="p-4 text-right">
                        {onNavigateTab && (
                          <button
                            type="button"
                            onClick={() => onNavigateTab('krishi-profit', { crop: 'paddy_aman' })}
                            className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            {lang === 'bn' ? 'হিসাব' : 'Calc'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* =========================================================================
          INTERACTIVE SIDE-BY-SIDE COMPARISON MODAL (Power Tool for Farmers)
          ========================================================================= */}
      <AnimatePresence>
        {showComparisonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-stone-200 shadow-2xl p-6 md:p-8 space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <div className="flex items-center space-x-2">
                  <Scale className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-xl font-black text-stone-900">
                    {lang === 'bn' ? 'জাতের পাশাপাশি তুলনামূলক বিশ্লেষণ' : 'Side-by-Side Cultivar Comparison'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComparisonModal(false)}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {comparisonIds.map((id) => {
                  const variety = STRESS_VARIETIES.find(v => v.id === id);
                  if (!variety) return null;
                  const theme = getStressTheme(variety.stressType);

                  return (
                    <div key={variety.id} className="p-5 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-4">
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border mb-2 ${theme.colorBadge}`}>
                          {lang === 'bn' ? theme.labelBn : theme.labelEn}
                        </span>
                        <h4 className="text-lg font-black text-stone-900">{variety.name}</h4>
                        <p className="text-xs text-stone-500">{variety.breeder} • {variety.season}</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-stone-200 text-xs">
                        <div>
                          <div className="font-bold text-stone-400 uppercase text-[10px]">{lang === 'bn' ? 'সহনশীলতা' : 'Tolerance'}</div>
                          <div className="font-bold text-stone-900">{variety.toleranceLevelBn}</div>
                        </div>

                        <div>
                          <div className="font-bold text-stone-400 uppercase text-[10px]">{lang === 'bn' ? 'জীবনকাল' : 'Duration'}</div>
                          <div className="font-black text-stone-900 font-mono text-base">{variety.durationDays} দিন (Days)</div>
                        </div>

                        <div>
                          <div className="font-bold text-stone-400 uppercase text-[10px]">{lang === 'bn' ? 'সম্ভাব্য ফলন' : 'Yield'}</div>
                          <div className="font-black text-emerald-800 font-mono text-base">{variety.yieldPotentialBn}</div>
                        </div>

                        <div>
                          <div className="font-bold text-stone-400 uppercase text-[10px]">{lang === 'bn' ? 'মাঠ পরামর্শ' : 'Tips'}</div>
                          <div className="text-stone-700">{variety.managementTipsBn}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowComparisonModal(false)}
                  className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  {lang === 'bn' ? 'বন্ধ করুন' : 'Close Comparison'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Post-Disaster Emergency Field Protocols (Clean, Non-Boxy Layout) */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-stone-200 shadow-sm space-y-6">
        <div className="flex items-center space-x-3 pb-4 border-b border-stone-100">
          <div className="p-2.5 bg-amber-600 text-white rounded-2xl">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-stone-900">
              {lang === 'bn' ? 'দুর্যোগোত্তর ফসল বাঁচানোর জরুরি প্রটোকল' : 'Post-Disaster Field Emergency Recovery Protocol'}
            </h3>
            <p className="text-xs text-stone-500">
              {lang === 'bn' ? 'বন্যা পরবর্তী বা নোনা পানি প্রবেশের পর তাৎক্ষণিক পদক্ষেপ' : 'Validated agronomic rescue operations after floods, saline surges, or droughts.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Protocol 1: Flash Flood */}
          <div className="space-y-2.5 p-5 rounded-2xl bg-sky-50/50 border border-sky-100">
            <div className="flex items-center space-x-2 text-sky-900 font-black text-sm">
              <Waves className="w-4 h-4 text-sky-600" />
              <span>{lang === 'bn' ? 'বন্যার পানি নেমে যাওয়ার পর' : 'After Flood Waters Drain'}</span>
            </div>
            <ul className="text-xs text-sky-950/90 space-y-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'গাছের পাতার পলিমাটি পরিষ্কার পানিতে স্প্রে করে ধুয়ে দিন।' : 'Wash off silt/mud from leaves with clean water spray.'}</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'প্রতি লিটার পানিতে ২০ গ্রাম ইউরিয়া ও ১০ গ্রাম পটাশ গুলে পাতায় স্প্রে করুন।' : 'Foliar spray 20g Urea + 10g MOP per liter to revive shocked roots.'}</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'সম্পূর্ণ নষ্ট হলে নাবি আমন জাত (বিআর২২/বিআর২৩) দিয়ে পুনরায় রোপণ করুন।' : 'Re-plant with late photoperiod-sensitive varieties like BR22/BR23.'}</span>
              </li>
            </ul>
          </div>

          {/* Protocol 2: Saline Surge */}
          <div className="space-y-2.5 p-5 rounded-2xl bg-teal-50/50 border border-teal-100">
            <div className="flex items-center space-x-2 text-teal-900 font-black text-sm">
              <Droplets className="w-4 h-4 text-teal-600" />
              <span>{lang === 'bn' ? 'নোনা পানি প্রবেশ করলে' : 'After Saline Inundation'}</span>
            </div>
            <ul className="text-xs text-teal-950/90 space-y-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'মিষ্টি পানি দিয়ে জমি প্লাবিত করে দ্রুত নিষ্কাশন করুন (লবণ ধৌতকরণ)।' : 'Flush field with fresh canal water to leach accumulated salt.'}</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'বিঘায় ৮-১০ কেজি জিপসাম প্রয়োগ করুন যাতে ক্যালসিয়াম সোডিয়ামকে প্রতিস্থাপন করে।' : 'Apply 8-10kg Gypsum per Bigha to displace toxic sodium ions.'}</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'খড়কুটা বা মালচিং দিয়ে মাটির রস ধরে রাখুন যাতে কৈশিক নালীতে লবণ উপরে না ওঠে।' : 'Mulch heavily with straw to halt capillary salt rising.'}</span>
              </li>
            </ul>
          </div>

          {/* Protocol 3: Barind Drought */}
          <div className="space-y-2.5 p-5 rounded-2xl bg-amber-50/50 border border-amber-100">
            <div className="flex items-center space-x-2 text-amber-900 font-black text-sm">
              <Sun className="w-4 h-4 text-amber-600" />
              <span>{lang === 'bn' ? 'তীব্র খরা পরিস্থিতিতে' : 'Severe Drought & Heatwave'}</span>
            </div>
            <ul className="text-xs text-amber-950/90 space-y-2 font-medium leading-relaxed">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'এডব্লিউডি (AWD) পাইপ বসিয়ে কেবল গাছের সংকটময় অবস্থায় সেচ দিন।' : 'Use AWD perforated tubes to irrigate only at critical stages.'}</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{lang === 'bn' ? 'সন্ধ্যাবেলা হালকা সেচ দিন যাতে বাষ্পীভবন কম হয়।' : 'Irrigate strictly during evening hours to cut evaporation loss.'}</span>
              </li>
              <li className="flex items-start space-x-2">
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

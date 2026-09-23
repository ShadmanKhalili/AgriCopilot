import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calculator, DollarSign, TrendingUp, TrendingDown, Scale, 
  Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Copy, 
  RotateCcw, Download, Info, ShieldCheck, PieChart, Coins,
  Waves, Bot, Cloud, Satellite
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { AgriCurrency } from '../utils/currency';
import { TactileStepper } from './TactileStepper';

interface CropBenchmark {
  nameBn: string;
  nameEn: string;
  defaultYieldPerDecimalMon: number; // Mon (40kg) per decimal (e.g. 0.6 mon/decimal = ~20 mon/bigha for boro)
  defaultPricePerMon: number; // BDT per Mon (40kg)
  // Standard baseline costs in BDT per 33 Decimals (1 Bigha)
  perBighaCosts: {
    tillage: number;
    seeds: number;
    fertilizer: number;
    irrigation: number;
    pesticide: number;
    labor: number;
    transport: number;
  };
}

const CROP_BENCHMARKS: Record<string, CropBenchmark> = {
  'paddy_boro': {
    nameBn: 'বোরো ধান (উফশী/হাইব্রিড)',
    nameEn: 'Boro Rice (HYV/Hybrid)',
    defaultYieldPerDecimalMon: 0.65, // ~21.5 Mon per Bigha
    defaultPricePerMon: 1150, // ৳1,150 / Mon
    perBighaCosts: {
      tillage: 2200,
      seeds: 1200,
      fertilizer: 4800,
      irrigation: 5500,
      pesticide: 1800,
      labor: 9000,
      transport: 1200,
    }
  },
  'paddy_aman': {
    nameBn: 'রোপা আমন ধান',
    nameEn: 'T. Aman Rice',
    defaultYieldPerDecimalMon: 0.48, // ~16 Mon per Bigha
    defaultPricePerMon: 1250, // ৳1,250 / Mon
    perBighaCosts: {
      tillage: 2000,
      seeds: 1000,
      fertilizer: 3600,
      irrigation: 1800, // Rainfed mostly
      pesticide: 1500,
      labor: 7500,
      transport: 1000,
    }
  },
  'potato': {
    nameBn: 'আলু (ডায়মন্ড/কার্ডিনাল)',
    nameEn: 'Potato (Diamond/Cardinal)',
    defaultYieldPerDecimalMon: 2.2, // ~72 Mon per Bigha (~85-90 kg/decimal)
    defaultPricePerMon: 850, // ৳850 / Mon (৳21-22/kg)
    perBighaCosts: {
      tillage: 2800,
      seeds: 16000, // Seed potato is costly
      fertilizer: 8500,
      irrigation: 4000,
      pesticide: 4500, // Blight fungicides
      labor: 11000,
      transport: 3500,
    }
  },
  'tomato': {
    nameBn: 'টমেটো (শীতকালীন / গ্রীষ্মকালীন)',
    nameEn: 'Tomato (Hybrid)',
    defaultYieldPerDecimalMon: 2.5, // ~80 Mon per Bigha
    defaultPricePerMon: 1100, // ৳1,100 / Mon
    perBighaCosts: {
      tillage: 2500,
      seeds: 3500,
      fertilizer: 6500,
      irrigation: 3500,
      pesticide: 5000,
      labor: 12000,
      transport: 3000,
    }
  },
  'onion': {
    nameBn: 'পেঁয়াজ (তাহেরপুরী / বারি)',
    nameEn: 'Onion (Taherpuri/BARI)',
    defaultYieldPerDecimalMon: 1.3, // ~43 Mon per Bigha
    defaultPricePerMon: 1800, // ৳1,800 / Mon (৳45/kg)
    perBighaCosts: {
      tillage: 2600,
      seeds: 5500,
      fertilizer: 5800,
      irrigation: 3000,
      pesticide: 3200,
      labor: 10500,
      transport: 2200,
    }
  },
  'brinjal': {
    nameBn: 'বেগুন (বারি / হাইব্রিড)',
    nameEn: 'Brinjal / Eggplant',
    defaultYieldPerDecimalMon: 2.0, // ~66 Mon per Bigha
    defaultPricePerMon: 1200, // ৳1,200 / Mon
    perBighaCosts: {
      tillage: 2200,
      seeds: 2000,
      fertilizer: 5500,
      irrigation: 3500,
      pesticide: 6000, // Fruit and shoot borer
      labor: 11000,
      transport: 2500,
    }
  },
  'chili': {
    nameBn: 'কাঁচা মরিচ',
    nameEn: 'Green Chili',
    defaultYieldPerDecimalMon: 0.9, // ~30 Mon per Bigha
    defaultPricePerMon: 3000, // ৳3,000 / Mon (৳75/kg)
    perBighaCosts: {
      tillage: 2200,
      seeds: 2500,
      fertilizer: 5200,
      irrigation: 3200,
      pesticide: 4500,
      labor: 13000, // Multiple manual pickings
      transport: 2000,
    }
  },
  'maize': {
    nameBn: 'ভুট্টা (হাইব্রিড)',
    nameEn: 'Hybrid Maize',
    defaultYieldPerDecimalMon: 1.1, // ~36 Mon per Bigha
    defaultPricePerMon: 1050, // ৳1,050 / Mon
    perBighaCosts: {
      tillage: 2400,
      seeds: 3000,
      fertilizer: 6200,
      irrigation: 4000,
      pesticide: 1800,
      labor: 7500,
      transport: 1800,
    }
  }
};

interface Props {
  lang: Language;
  initialCrop?: string;
  onCropSelect?: (crop: string) => void;
  onNavigateTab?: (tab: any, payload?: any) => void;
}

export default function KrishiProfitCalculator({ lang, initialCrop, onCropSelect, onNavigateTab }: Props) {
  const [selectedCrop, setSelectedCrop] = useState<string>(initialCrop && CROP_BENCHMARKS[initialCrop] ? initialCrop : 'paddy_boro');
  const [landUnit, setLandUnit] = useState<'decimal' | 'bigha' | 'acre' | 'katha'>('bigha');
  const [landSize, setLandSize] = useState<number>(1); // 1 Bigha default

  // Synchronize when initialCrop changes externally
  useEffect(() => {
    if (initialCrop && CROP_BENCHMARKS[initialCrop]) {
      setSelectedCrop(initialCrop);
      setCustomCosts({});
      setCustomYieldMon(null);
      setCustomPricePerMon(null);
    }
  }, [initialCrop]);

  const currentBenchmark = CROP_BENCHMARKS[selectedCrop] || CROP_BENCHMARKS['paddy_boro'];

  // Normalized Decimals
  const normalizedDecimals = useMemo(() => {
    switch (landUnit) {
      case 'bigha':
        return landSize * 33;
      case 'acre':
        return landSize * 100;
      case 'katha':
        return landSize * 1.65;
      case 'decimal':
      default:
        return landSize;
    }
  }, [landSize, landUnit]);

  const landRatio = normalizedDecimals / 33; // multiplier relative to 1 bigha

  // Cost items state (calculated based on benchmark * land ratio, but editable)
  const [customCosts, setCustomCosts] = useState<Record<string, number>>({});
  const [customYieldMon, setCustomYieldMon] = useState<number | null>(null);
  const [customPricePerMon, setCustomPricePerMon] = useState<number | null>(null);

  // Reset custom overrides when crop changes
  const handleCropChange = (cropKey: string) => {
    setSelectedCrop(cropKey);
    setCustomCosts({});
    setCustomYieldMon(null);
    setCustomPricePerMon(null);
    onCropSelect?.(cropKey);
  };

  // Active Costs
  const costs = useMemo(() => {
    const base = currentBenchmark.perBighaCosts;
    return {
      tillage: customCosts.tillage ?? Math.round(base.tillage * landRatio),
      seeds: customCosts.seeds ?? Math.round(base.seeds * landRatio),
      fertilizer: customCosts.fertilizer ?? Math.round(base.fertilizer * landRatio),
      irrigation: customCosts.irrigation ?? Math.round(base.irrigation * landRatio),
      pesticide: customCosts.pesticide ?? Math.round(base.pesticide * landRatio),
      labor: customCosts.labor ?? Math.round(base.labor * landRatio),
      transport: customCosts.transport ?? Math.round(base.transport * landRatio),
      lease: customCosts.lease ?? 0,
    };
  }, [currentBenchmark, landRatio, customCosts]);

  const updateCostItem = (key: keyof typeof currentBenchmark.perBighaCosts, val: number) => {
    setCustomCosts(prev => ({
      ...prev,
      [key]: Math.max(0, val)
    }));
  };

  const totalCost = useMemo(() => {
    return Object.values(costs).reduce((acc, c) => acc + c, 0);
  }, [costs]);

  // Total Expected Yield in Mon (1 Mon = 40 kg)
  const totalYieldMon = useMemo(() => {
    if (customYieldMon !== null) return customYieldMon;
    return Math.round(normalizedDecimals * currentBenchmark.defaultYieldPerDecimalMon * 10) / 10;
  }, [normalizedDecimals, currentBenchmark, customYieldMon]);

  const pricePerMon = useMemo(() => {
    if (customPricePerMon !== null) return customPricePerMon;
    return currentBenchmark.defaultPricePerMon;
  }, [currentBenchmark, customPricePerMon]);

  // Financial Metrics
  const grossRevenue = Math.round(totalYieldMon * pricePerMon);
  const netProfit = grossRevenue - totalCost;
  const isProfitable = netProfit >= 0;
  const roiPercentage = totalCost > 0 ? Math.round((netProfit / totalCost) * 100) : 0;
  
  // Break-even production cost per Mon
  const breakEvenCostPerMon = totalYieldMon > 0 ? Math.round(totalCost / totalYieldMon) : 0;
  const breakEvenCostPerKg = totalYieldMon > 0 ? Math.round((totalCost / (totalYieldMon * 40)) * 10) / 10 : 0;

  const resetToDefaults = () => {
    setCustomCosts({});
    setCustomYieldMon(null);
    setCustomPricePerMon(null);
    toast.success(lang === 'bn' ? 'আদর্শ খরচে পুনর্বহাল করা হয়েছে' : 'Reset to regional benchmarks');
  };

  const copySummarySlip = () => {
    const tenureNote = costs.lease > 0 
      ? (lang === 'bn' ? `📑 জমির ধরন: বর্গা/ইজারা (লিজ ফি: ৳${costs.lease.toLocaleString()} টাকা)` : `📑 Land Tenure: Leased/Sharecrop (Rent: ৳${costs.lease.toLocaleString()} BDT)`)
      : (lang === 'bn' ? `📑 জমির ধরন: নিজস্ব জমি` : `📑 Land Tenure: Owner-Operated`);

    const text = lang === 'bn'
      ? `🌾 ফসল উৎপাদন খরচ ও নিট লাভ হিসাব (${currentBenchmark.nameBn})
📐 জমির পরিমাণ: ${landSize} ${landUnit === 'decimal' ? 'শতাংশ' : landUnit === 'bigha' ? 'বিঘা' : landUnit === 'acre' ? 'একর' : 'কাঠা'}
${tenureNote}
💰 মোট উৎপাদন খরচ: ৳${totalCost.toLocaleString()} টাকা
⚖️ প্রতি মণ উৎপাদন খরচ (ব্রেক-ইভেন): ৳${breakEvenCostPerMon.toLocaleString()} / মণ (৳${breakEvenCostPerKg}/কেজি)
📦 আনুমানিক মোট ফলন: ${totalYieldMon} মণ (${Math.round(totalYieldMon * 40)} কেজি, ১৪% আর্দ্রতা মান)
💵 প্রত্যাশিত বিক্রয়মূল্য: ৳${pricePerMon.toLocaleString()} / মণ
📈 নিট লাভ / ক্ষতি: ৳${netProfit.toLocaleString()} টাকা (ROI: ${roiPercentage}%)
💡 পরামর্শ: ফরিয়াদের কাছে ৳${breakEvenCostPerMon} টাকার নিচে বিক্রি করবেন না।`
      : `🌾 Crop Production Cost & Profit Statement (${currentBenchmark.nameEn})
📐 Land Area: ${landSize} ${landUnit} (${normalizedDecimals.toFixed(1)} Decimals)
${tenureNote}
💰 Total Production Cost: ৳${totalCost.toLocaleString()} BDT
⚖️ Break-Even Cost per Mon: ৳${breakEvenCostPerMon.toLocaleString()} / Mon (৳${breakEvenCostPerKg}/kg)
📦 Estimated Harvest: ${totalYieldMon} Mon (${Math.round(totalYieldMon * 40)} kg, 14% Moisture Standard)
💵 Selling Market Price: ৳${pricePerMon.toLocaleString()} / Mon
📈 Net Profit / Loss: ৳${netProfit.toLocaleString()} BDT (ROI: ${roiPercentage}%)
💡 Farmer Advisory: Do not sell to intermediaries below ৳${breakEvenCostPerMon}/Mon.`;

    navigator.clipboard.writeText(text);
    toast.success(lang === 'bn' ? 'হিসাব কপি করা হয়েছে!' : 'Profit statement copied!');
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-emerald-950 dark:bg-stone-900 rounded-2xl p-5 md:p-7 text-white relative overflow-hidden border border-emerald-900 dark:border-stone-800 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 text-xs font-mono text-emerald-300">
              <Coins className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'অর্থনৈতিক হিসাব ও মধ্যস্বত্বভোগী সুরক্ষা' : 'Farm Financial Intelligence & Fair Pricing'}</span>
            </div>
            <h1 className="text-xl md:text-3xl font-black tracking-tight">
              {lang === 'bn' ? 'ফসল উৎপাদন খরচ ও লাভ ক্যালকুলেটর' : 'Krishi Profit & Break-Even Calculator'}
            </h1>
            <p className="text-emerald-200/80 text-xs md:text-sm max-w-2xl leading-relaxed">
              {lang === 'bn' 
                ? 'চাষ শুরুর আগেই জানুন প্রতি মণ ফসলে আপনার প্রকৃত খরচ কত হবে। মধ্যস্বত্বভোগী বা ফড়িয়াদের কাছে লোকসানে বিক্রি থেকে বাঁচুন।'
                : 'Calculate exact per-maund production cost, projected revenue, and break-even price to negotiate profitably with traders.'}
            </p>
          </div>

          <div className="flex items-center space-x-2.5 self-start md:self-auto shrink-0">
            <button
              onClick={copySummarySlip}
              className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold px-3.5 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'হিসাব বিবরণী কপি করুন' : 'Copy Statement'}</span>
            </button>
            <button
              onClick={resetToDefaults}
              title={lang === 'bn' ? 'আদর্শ খরচে পুনর্বহাল' : 'Reset to defaults'}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer border border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel: Crop & Land Size */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 md:p-6 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Crop Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              {lang === 'bn' ? '১. ফসল নির্বাচন করুন' : '1. Select Crop'}
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              {Object.entries(CROP_BENCHMARKS).map(([key, crop]) => (
                <option key={key} value={key}>
                  {lang === 'bn' ? crop.nameBn : crop.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Land Size & Unit */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                {lang === 'bn' ? '২. জমির পরিমাণ ও একক' : '2. Land Area & Unit'}
              </label>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                ≈ {normalizedDecimals.toFixed(1)} {lang === 'bn' ? 'শতাংশ' : 'Dec'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TactileStepper
                value={landSize}
                onChange={(val) => setLandSize(Math.max(0.1, val))}
                min={0.1}
                max={500}
                step={landUnit === 'bigha' || landUnit === 'acre' ? 0.5 : 1}
                precision={landUnit === 'bigha' || landUnit === 'acre' ? 1 : 0}
                className="flex-1"
              />
              <select
                value={landUnit}
                onChange={(e: any) => setLandUnit(e.target.value)}
                className="bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-900 dark:text-stone-200 outline-none cursor-pointer shrink-0"
              >
                <option value="bigha">{lang === 'bn' ? 'বিঘা (৩৩ শ.)' : 'Bigha'}</option>
                <option value="decimal">{lang === 'bn' ? 'শতাংশ' : 'Decimal'}</option>
                <option value="acre">{lang === 'bn' ? 'একর (১০০ শ.)' : 'Acre'}</option>
                <option value="katha">{lang === 'bn' ? 'কাঠা' : 'Katha'}</option>
              </select>
            </div>
            {/* Inline Quick Presets (Rank 6) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-stone-400">{lang === 'bn' ? 'দ্রুত:' : 'Quick:'}</span>
              {[
                { label: lang === 'bn' ? '১ বিঘা' : '1 Bigha', val: 1, unit: 'bigha' },
                { label: lang === 'bn' ? '৫০ শতক' : '50 Dec', val: 50, unit: 'decimal' },
                { label: lang === 'bn' ? '১ একর' : '1 Acre', val: 1, unit: 'acre' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => { setLandSize(preset.val); setLandUnit(preset.unit as any); }}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Harvest Yield */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                {lang === 'bn' ? '৩. আনুমানিক মোট ফলন' : '3. Expected Harvest'}
              </label>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                {lang === 'bn' ? '১ মণ = ৪০ কেজি' : '1 Mon = 40kg'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TactileStepper
                value={totalYieldMon}
                onChange={(val) => setCustomYieldMon(Math.max(1, val))}
                min={1}
                max={5000}
                step={5}
                unit={lang === 'bn' ? 'মণ' : 'Mon'}
                className="w-full"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-400">
              <span>{lang === 'bn' ? 'আঞ্চলিক গড় অনুযায়ী প্রাক্কলিত' : 'Regional average projection'}</span>
              <span className="font-mono tabular-nums font-medium text-stone-600 dark:text-stone-300">
                ≈ {Math.round(totalYieldMon * 40).toLocaleString()} kg
              </span>
            </div>
          </div>
        </div>

        {/* Selling Price per Mon */}
        <div className="bg-stone-50/70 dark:bg-stone-800/40 p-4 rounded-xl border border-stone-200/80 dark:border-stone-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 rounded-lg text-white">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
                {lang === 'bn' ? 'প্রত্যাশিত বাজারদর (প্রতি মণ ৪০ কেজি)' : 'Expected Market Price (per Mon / 40kg)'}
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {lang === 'bn' ? 'আজকের বাজারদরে পরিবর্তন করতে পারেন' : 'Adjust according to current wholesale rate'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <TactileStepper
              value={pricePerMon}
              onChange={(val) => setCustomPricePerMon(Math.max(100, val))}
              min={100}
              max={20000}
              step={50}
              unit={lang === 'bn' ? '৳/মণ' : '৳/Mon'}
            />
          </div>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Cost */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'bn' ? 'মোট উৎপাদন ব্যয়' : 'Total Expense'}</span>
            <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            <AgriCurrency amount={totalCost} />
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums">
            {lang === 'bn' ? `${normalizedDecimals.toFixed(1)} শতাংশ জমির মোট খরচ` : `For ${normalizedDecimals.toFixed(1)} decimals`}
          </p>
        </motion.div>

        {/* Card 2: Break-Even Baseline */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-amber-200/90 dark:border-amber-900/50 shadow-xs"
        >
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'bn' ? 'প্রতি মণ উৎপাদন খরচ' : 'Break-Even / Mon'}</span>
            <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight text-amber-950 dark:text-amber-200">
            <AgriCurrency amount={breakEvenCostPerMon} unit={lang === 'bn' ? 'মণ' : 'Mon'} />
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/80 font-medium mt-1 tabular-nums flex items-baseline gap-1">
            <span>≈</span>
            <AgriCurrency amount={breakEvenCostPerKg} unit={lang === 'bn' ? 'কেজি' : 'kg'} />
            <span className="text-[11px] opacity-75">({lang === 'bn' ? 'এর কমে বিক্রি করলে ক্ষতি' : 'Minimum selling price'})</span>
          </p>
        </motion.div>

        {/* Card 3: Gross Revenue */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs"
        >
          <div className="flex items-center justify-between text-stone-500 dark:text-stone-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'bn' ? 'মোট বিক্রয়মূল্য' : 'Gross Revenue'}</span>
            <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            <AgriCurrency amount={grossRevenue} />
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 tabular-nums flex items-baseline gap-1">
            <span>{totalYieldMon} {lang === 'bn' ? 'মণ' : 'Mon'} ×</span>
            <AgriCurrency amount={pricePerMon} />
          </p>
        </motion.div>

        {/* Card 4: Net Profit */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className={`rounded-2xl p-5 text-white shadow-xs border ${
            isProfitable 
              ? 'bg-emerald-700 border-emerald-800 dark:bg-emerald-800 dark:border-emerald-700' 
              : 'bg-rose-700 border-rose-800 dark:bg-rose-800 dark:border-rose-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2 text-white/90">
            <span className="text-xs font-semibold">
              {lang === 'bn' ? (isProfitable ? 'নিট লাভ' : 'সম্ভাব্য ক্ষতি') : (isProfitable ? 'Net Profit' : 'Net Loss')}
            </span>
            {isProfitable ? <TrendingUp className="w-4 h-4 text-white" /> : <TrendingDown className="w-4 h-4 text-white" />}
          </div>
          <div className="text-2xl md:text-3xl font-bold tracking-tight">
            <AgriCurrency amount={Math.abs(netProfit)} />
          </div>
          <p className="text-xs text-white/90 font-medium mt-1 tabular-nums">
            ROI: {roiPercentage}% ({isProfitable ? (lang === 'bn' ? 'লাভজনক' : 'Profitable') : (lang === 'bn' ? 'ক্ষতিকর' : 'Loss')})
          </p>
        </motion.div>
      </div>

      {/* Itemized Cost Breakdown (Clean Tabular Financial Ledger - Rank 5 & Rank 2) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
              {lang === 'bn' ? 'উৎপাদন খরচের খতিয়ান (সম্পাদনাযোগ্য)' : 'Production Expense Ledger (Editable)'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {lang === 'bn' ? 'আঞ্চলিক গড় খরচের খসড়া; আপনার ভাউচার অনুযায়ী টাকার পরিমাণ পরিবর্তন করুন।' : 'Pre-filled with regional averages; click to update based on your vouchers.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 font-mono text-xs font-bold shrink-0">
            <span>{lang === 'bn' ? 'মোট খরচ:' : 'Total Cost:'}</span>
            <AgriCurrency amount={totalCost} unit="BDT" amountClassName="text-emerald-700 dark:text-emerald-400" />
          </div>
        </div>

        <div className="divide-y divide-stone-200/60 dark:divide-stone-800">
          {[
            { key: 'tillage', title: lang === 'bn' ? '১. জমি চাষ ও মই (পাওয়ার টিলার)' : '1. Land Prep & Tillage', desc: lang === 'bn' ? 'টিলারের ভাড়া ও ডিজেল' : 'Tractor/tiller rent & fuel' },
            { key: 'seeds', title: lang === 'bn' ? '২. বীজ / চারার দাম' : '2. Seeds / Seedlings', desc: lang === 'bn' ? 'প্রত্যয়িত উন্নত বীজ বা চারা' : 'Certified high-yield seeds' },
            { key: 'fertilizer', title: lang === 'bn' ? '৩. রাসায়নিক ও জৈব সার' : '3. Fertilizers & Manure', desc: lang === 'bn' ? 'ইউরিয়া, টিএসপি, ডিএপি, পটাশ' : 'Urea, TSP, DAP, MoP & compost' },
            { key: 'irrigation', title: lang === 'bn' ? '৪. সেচ ও বিদ্যুৎ/ডিজেল খরচ' : '4. Irrigation & Fuel', desc: lang === 'bn' ? 'পাম্পের ঘণ্টা বা স্কিম বিল' : 'Tube well hours or scheme payment' },
            { key: 'pesticide', title: lang === 'bn' ? '৫. বালাইনাশক ও ভিটামিন স্প্রে' : '5. Plant Protection', desc: lang === 'bn' ? 'কীটনাশক, ছত্রাকনাশক ও অনুখাদ্য' : 'Pesticides, fungicides & micronutrients' },
            { key: 'labor', title: lang === 'bn' ? '৬. কৃষি শ্রমিক মজুরি' : '6. Labor Wages', desc: lang === 'bn' ? 'রোপণ, নিড়ানি, সার দেওয়া, কাটা ও মাড়াই' : 'Transplanting, weeding, spraying, harvest' },
            { key: 'transport', title: lang === 'bn' ? '৭. পরিবহন ও বস্তাজাতকরণ' : '7. Packing & Transport', desc: lang === 'bn' ? 'চটের বস্তা, ভ্যান/নসিমন ভাড়া' : 'Sacks, loading & mandi cartage' },
          ].map((item) => (
            <div key={item.key} className="p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {item.title}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400">
                  {item.desc}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span className="text-xs text-stone-400 font-mono">৳</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={costs[item.key as keyof typeof costs]}
                  onChange={(e) => updateCostItem(item.key as any, parseFloat(e.target.value) || 0)}
                  className="w-32 sm:w-36 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-mono font-bold text-right text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-emerald-500 outline-none tabular-nums"
                />
              </div>
            </div>
          ))}

          {/* Lease row */}
          <div className="p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-50/30 dark:bg-stone-800/20">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {lang === 'bn' ? '৮. জমি বর্গা / লিজ ফি (প্রযোজ্য ক্ষেত্রে)' : '8. Land Lease / Rent (Optional)'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateCostItem('lease' as any, 0)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      costs.lease === 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {lang === 'bn' ? 'নিজ জমি (৳০)' : 'Own Land (৳0)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCostItem('lease' as any, Math.round(5000 * landRatio))}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      costs.lease > 0 ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {lang === 'bn' ? 'লিজ (~৳৫হাজার/বিঘা)' : 'Leased (~৳5k/bigha)'}
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                {lang === 'bn' ? 'নিজস্ব জমিতে চাষ করলে শূন্য রাখুন' : 'Set to 0 if farming on owned land'}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <span className="text-xs text-stone-400 font-mono">৳</span>
              <input
                type="number"
                min="0"
                step="500"
                value={costs.lease}
                onChange={(e) => updateCostItem('lease' as any, parseFloat(e.target.value) || 0)}
                className="w-32 sm:w-36 bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-mono font-bold text-right text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-emerald-500 outline-none tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Ledger Bottom Summary */}
        <div className="p-3.5 sm:px-5 bg-stone-100/70 dark:bg-stone-800/80 border-t border-stone-200/80 dark:border-stone-800 flex items-center justify-between text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">
          <span>{lang === 'bn' ? 'সর্বমোট উৎপাদন খরচ' : 'Net Production Cost'}</span>
          <AgriCurrency
            amount={totalCost}
            unit="BDT"
            className="text-base"
            amountClassName="text-emerald-800 dark:text-emerald-300"
          />
        </div>
      </div>

      {/* Middleman Bargaining & Fair Trade Action Guide */}
      <div className="bg-amber-50/50 dark:bg-amber-950/30 rounded-2xl p-4 sm:p-5 border border-amber-200/80 dark:border-amber-900/50 shadow-xs space-y-2.5">
        <div className="flex items-center space-x-2.5 text-amber-900 dark:text-amber-300">
          <ShieldCheck className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
          <h4 className="text-sm sm:text-base font-bold">
            {lang === 'bn' ? 'ফরিয়া ও বেপারীদের সাথে দরদামের কৌশল (Fair Price Guide)' : 'Intermediary Bargaining Strategy'}
          </h4>
        </div>
        <p className="text-sm text-amber-950 leading-relaxed font-medium">
          {lang === 'bn'
            ? `আপনার প্রতি মণ ${currentBenchmark.nameBn} উৎপাদনে প্রকৃত খরচ হচ্ছে ৳${breakEvenCostPerMon} টাকা (৳${breakEvenCostPerKg}/কেজি)। স্থানীয় ফড়িয়া বা পাইকাররা এর চেয়ে কম দাম অফার করলে আপনি নিশ্চিতভাবে লোকসানে পড়বেন। নিকটস্থ আড়তে নিয়ে সরাসরি বিক্রি করলে গড়ে ১০-১৫% বেশি দাম পাওয়া যায়।`
            : `Your net cost to produce 1 Mon of ${currentBenchmark.nameEn} is ৳${breakEvenCostPerMon} BDT (৳${breakEvenCostPerKg}/kg). Reject any local middleman offer lower than this threshold to protect your baseline investment.`}
        </p>
      </div>

      {/* Cross-Module Linked Agri-Tools Navigation */}
      {onNavigateTab && (
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 rounded-[2.2rem] p-6 text-white shadow-xl border border-emerald-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-display font-black text-xs uppercase tracking-widest text-white">
                  {lang === 'bn' ? 'সম্পর্কিত ডিজিটাল কৃষি সেবা' : 'Linked Agricultural Modules'}
                </h4>
                <p className="text-[11px] text-emerald-300 font-medium">
                  {lang === 'bn' ? 'এই ফসলের বাজার ও রোগ প্রতিরোধে সরাসরি যুক্ত হোন' : 'Seamlessly connect with market and diagnostic tools'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Market Connect */}
            <button
              type="button"
              onClick={() => onNavigateTab('market-connect', { produce: selectedCrop.replace('paddy_boro', 'paddy').replace('paddy_aman', 'paddy') })}
              className="flex items-center space-x-3 p-3.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
            >
              <div className="p-2.5 bg-amber-400 text-amber-950 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-xs text-white leading-tight flex items-center justify-between">
                  <span>{lang === 'bn' ? 'পাইকারি বাজারদর দেখুন' : 'Live Mandi Prices'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-amber-200 mt-0.5 truncate font-medium">
                  {lang === 'bn' ? 'শ্যামবাজার ও আড়তের লাইভ রেট' : 'Check wholesale trends'}
                </div>
              </div>
            </button>

            {/* 2. Agri Copilot */}
            <button
              type="button"
              onClick={() => onNavigateTab('agri-copilot', { crop: selectedCrop.replace('paddy_boro', 'paddy').replace('paddy_aman', 'paddy') })}
              className="flex items-center space-x-3 p-3.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
            >
              <div className="p-2.5 bg-emerald-400 text-emerald-950 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <Bot className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-xs text-white leading-tight flex items-center justify-between">
                  <span>{lang === 'bn' ? 'এআই রোগ নির্ণয় ও স্প্রে' : 'AI Crop Doctor'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-emerald-200 mt-0.5 truncate font-medium">
                  {lang === 'bn' ? 'পাতার ছবি দিয়ে চিকিৎসা' : 'Instant diagnosis & doses'}
                </div>
              </div>
            </button>

            {/* 3. Climate Resilience Guide */}
            <button
              type="button"
              onClick={() => onNavigateTab('climate-resilience')}
              className="flex items-center space-x-3 p-3.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl text-left transition-all group min-h-[48px] cursor-pointer"
            >
              <div className="p-2.5 bg-sky-400 text-sky-950 rounded-xl group-hover:scale-105 transition-transform shrink-0">
                <Waves className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-xs text-white leading-tight flex items-center justify-between">
                  <span>{lang === 'bn' ? 'দুর্যোগসহনশীল জাত গাইড' : 'Resilience Guide'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-sky-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-[10px] text-sky-200 mt-0.5 truncate font-medium">
                  {lang === 'bn' ? 'বন্যা ও খরা সহনশীল বীজ' : 'Flood/saline tolerant seeds'}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

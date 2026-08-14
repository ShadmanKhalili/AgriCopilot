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
    const text = lang === 'bn'
      ? `🌾 ফসল উৎপাদন খরচ ও নিট লাভ হিসাব (${currentBenchmark.nameBn})
📐 জমির পরিমাণ: ${landSize} ${landUnit === 'decimal' ? 'শতাংশ' : landUnit === 'bigha' ? 'বিঘা' : landUnit === 'acre' ? 'একর' : 'কাঠা'}
💰 মোট উৎপাদন খরচ: ৳${totalCost.toLocaleString()} টাকা
⚖️ প্রতি মণ উৎপাদন খরচ (ব্রেক-ইভেন): ৳${breakEvenCostPerMon.toLocaleString()} / মণ (৳${breakEvenCostPerKg}/কেজি)
📦 আনুমানিক মোট ফলন: ${totalYieldMon} মণ (${Math.round(totalYieldMon * 40)} কেজি)
💵 প্রত্যাশিত বিক্রয়মূল্য: ৳${pricePerMon.toLocaleString()} / মণ
📈 নিট লাভ / ক্ষতি: ৳${netProfit.toLocaleString()} টাকা (ROI: ${roiPercentage}%)
💡 পরামর্শ: ফরিয়াদের কাছে ৳${breakEvenCostPerMon} টাকার নিচে বিক্রি করবেন না।`
      : `🌾 Crop Production Cost & Profit Statement (${currentBenchmark.nameEn})
📐 Land Area: ${landSize} ${landUnit} (${normalizedDecimals.toFixed(1)} Decimals)
💰 Total Production Cost: ৳${totalCost.toLocaleString()} BDT
⚖️ Break-Even Cost per Mon: ৳${breakEvenCostPerMon.toLocaleString()} / Mon (৳${breakEvenCostPerKg}/kg)
📦 Estimated Harvest: ${totalYieldMon} Mon (${Math.round(totalYieldMon * 40)} kg)
💵 Selling Market Price: ৳${pricePerMon.toLocaleString()} / Mon
📈 Net Profit / Loss: ৳${netProfit.toLocaleString()} BDT (ROI: ${roiPercentage}%)
💡 Farmer Advisory: Do not sell to intermediaries below ৳${breakEvenCostPerMon}/Mon.`;

    navigator.clipboard.writeText(text);
    toast.success(lang === 'bn' ? 'হিসাব কপি করা হয়েছে!' : 'Profit statement copied!');
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-green-950 rounded-[2.5rem] p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-mono text-emerald-300">
              <Coins className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'অর্থনৈতিক হিসাব ও মধ্যস্বত্বভোগী সুরক্ষা' : 'Farm Financial Intelligence & Fair Pricing'}</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">
              {lang === 'bn' ? 'ফসল উৎপাদন খরচ ও লাভ ক্যালকুলেটর' : 'Krishi Profit & Break-Even Calculator'}
            </h1>
            <p className="text-emerald-100/80 text-sm max-w-2xl leading-relaxed">
              {lang === 'bn' 
                ? 'চাষ শুরুর আগেই জানুন প্রতি মণ ফসলে আপনার প্রকৃত খরচ কত হবে। মধ্যস্বত্বভোগী বা ফড়িয়াদের কাছে লোকসানে বিক্রি থেকে বাঁচুন।'
                : 'Calculate exact per-maund production cost, projected revenue, and break-even price to negotiate profitably with traders.'}
            </p>
          </div>

          <div className="flex items-center space-x-3 self-start md:self-auto">
            <button
              onClick={copySummarySlip}
              className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black px-4 py-2.5 rounded-2xl text-xs transition-all active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হিসাব বিবরণী কপি করুন' : 'Copy Statement'}</span>
            </button>
            <button
              onClick={resetToDefaults}
              title={lang === 'bn' ? 'আদর্শ খরচে পুনর্বহাল' : 'Reset to defaults'}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all cursor-pointer border border-white/10"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Control Panel: Crop & Land Size */}
      <div className="bg-white rounded-[2rem] p-5 md:p-7 border border-emerald-100 shadow-xl shadow-emerald-900/5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Crop Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
              {lang === 'bn' ? '১. ফসল নির্বাচন করুন' : '1. Select Crop'}
            </label>
            <select
              value={selectedCrop}
              onChange={(e) => handleCropChange(e.target.value)}
              className="w-full bg-emerald-50/50 border-2 border-emerald-200/80 rounded-2xl px-4 py-3 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
            >
              {Object.entries(CROP_BENCHMARKS).map(([key, crop]) => (
                <option key={key} value={key}>
                  {lang === 'bn' ? crop.nameBn : crop.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Land Size & Unit */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider">
              {lang === 'bn' ? '২. জমির পরিমাণ ও একক' : '2. Land Area & Unit'}
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={landSize || ''}
                onChange={(e) => setLandSize(Math.max(0.1, parseFloat(e.target.value) || 0))}
                className="w-full bg-emerald-50/50 border-2 border-emerald-200/80 rounded-2xl px-4 py-3 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <select
                value={landUnit}
                onChange={(e: any) => setLandUnit(e.target.value)}
                className="bg-emerald-100/70 border-2 border-emerald-300/80 rounded-2xl px-3 py-3 text-xs font-black text-emerald-950 outline-none cursor-pointer"
              >
                <option value="bigha">{lang === 'bn' ? 'বিঘা (৩৩ শ.)' : 'Bigha'}</option>
                <option value="decimal">{lang === 'bn' ? 'শতাংশ' : 'Decimal'}</option>
                <option value="acre">{lang === 'bn' ? 'একর (১০০ শ.)' : 'Acre'}</option>
                <option value="katha">{lang === 'bn' ? 'কাঠা' : 'Katha'}</option>
              </select>
            </div>
            <div className="text-[11px] text-gray-500 font-bold">
              ≈ {normalizedDecimals.toFixed(1)} {lang === 'bn' ? 'শতাংশ জমি' : 'Decimals'} ({landRatio.toFixed(2)} {lang === 'bn' ? 'বিঘা' : 'Bigha'})
            </div>
          </div>

          {/* Estimated Harvest Yield */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>{lang === 'bn' ? '৩. আনুমানিক মোট ফলন' : '3. Expected Harvest'}</span>
              <span className="text-[10px] text-emerald-700 font-bold">১ মণ = ৪০ কেজি</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={totalYieldMon}
                onChange={(e) => setCustomYieldMon(parseFloat(e.target.value) || 0)}
                className="w-full bg-emerald-50/50 border-2 border-emerald-200/80 rounded-2xl px-4 py-3 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <span className="absolute right-4 top-3.5 text-xs font-black text-gray-500">
                {lang === 'bn' ? 'মণ' : 'Mon'} ({Math.round(totalYieldMon * 40)} kg)
              </span>
            </div>
            <div className="text-[11px] text-gray-500 font-medium">
              {lang === 'bn' ? 'আঞ্চলিক গড় অনুযায়ী প্রাক্কলিত' : 'Estimated by regional harvest baseline'}
            </div>
          </div>
        </div>

        {/* Selling Price per Mon */}
        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl text-white">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900">
                {lang === 'bn' ? 'প্রত্যাশিত বাজারদর (প্রতি মণ ৪০ কেজি)' : 'Expected Market Price (per Mon / 40kg)'}
              </h4>
              <p className="text-xs text-gray-500">
                {lang === 'bn' ? 'আজকের বাজারদরে পরিবর্তন করতে পারেন' : 'Adjust according to current wholesale rate'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-base font-black text-emerald-800">৳</span>
            <input
              type="number"
              min="100"
              step="50"
              value={pricePerMon}
              onChange={(e) => setCustomPricePerMon(parseFloat(e.target.value) || 0)}
              className="w-36 bg-white border-2 border-emerald-300 rounded-xl px-3 py-2 text-base font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <span className="text-xs font-bold text-gray-600">/ {lang === 'bn' ? 'মণ' : 'Mon'}</span>
          </div>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Cost */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-md">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">{lang === 'bn' ? 'মোট উৎপাদন ব্যয়' : 'Total Expense'}</span>
            <PieChart className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-gray-900">
            ৳ {totalCost.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {lang === 'bn' ? `${normalizedDecimals.toFixed(1)} শতাংশ জমির মোট খরচ` : `For ${normalizedDecimals.toFixed(1)} decimals`}
          </p>
        </div>

        {/* Card 2: Break-Even Baseline */}
        <div className="bg-white rounded-3xl p-5 border-2 border-amber-200 bg-amber-50/20 shadow-md">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">{lang === 'bn' ? 'প্রতি মণ উৎপাদন খরচ' : 'Break-Even / Mon'}</span>
            <Scale className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-950">
            ৳ {breakEvenCostPerMon.toLocaleString()}
          </div>
          <p className="text-xs text-amber-800 font-bold mt-1">
            ≈ ৳{breakEvenCostPerKg} / {lang === 'bn' ? 'কেজি' : 'kg'} ({lang === 'bn' ? 'এর কমে বিক্রি করলে ক্ষতি' : 'Minimum selling price'})
          </p>
        </div>

        {/* Card 3: Gross Revenue */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-md">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-black uppercase tracking-wider">{lang === 'bn' ? 'মোট বিক্রয়মূল্য' : 'Gross Revenue'}</span>
            <Coins className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl md:text-3xl font-black text-blue-900">
            ৳ {grossRevenue.toLocaleString()}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {totalYieldMon} {lang === 'bn' ? 'মণ × ৳' : 'Mon × ৳'}{pricePerMon}
          </p>
        </div>

        {/* Card 4: Net Profit */}
        <div className={`rounded-3xl p-5 shadow-lg text-white ${isProfitable ? 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-600/20' : 'bg-gradient-to-br from-red-600 to-rose-700 shadow-red-600/20'}`}>
          <div className="flex items-center justify-between mb-2 text-emerald-100">
            <span className="text-xs font-black uppercase tracking-wider">
              {lang === 'bn' ? (isProfitable ? 'নিট লাভ' : 'সম্ভাব্য ক্ষতি') : (isProfitable ? 'Net Profit' : 'Net Loss')}
            </span>
            {isProfitable ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
          </div>
          <div className="text-2xl md:text-3xl font-black">
            ৳ {Math.abs(netProfit).toLocaleString()}
          </div>
          <p className="text-xs text-white/90 font-bold mt-1">
            ROI: {roiPercentage}% ({isProfitable ? (lang === 'bn' ? 'লাভজনক' : 'Profitable') : (lang === 'bn' ? 'ক্ষতিকর' : 'Loss')})
          </p>
        </div>
      </div>

      {/* Itemized Cost Breakdown (Granular & Editable) */}
      <div className="bg-white rounded-[2rem] p-5 md:p-8 border border-gray-100 shadow-xl shadow-gray-900/5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-black text-gray-900">
              {lang === 'bn' ? 'উৎপাদন খরচের বিস্তারিত হিসাব (সম্পাদনাযোগ্য)' : 'Itemized Production Expense Breakdown (Editable)'}
            </h3>
            <p className="text-xs text-gray-500">
              {lang === 'bn' ? 'আপনার প্রকৃত খরচ অনুযায়ী প্রতিটি খাতের টাকা পরিবর্তন করতে পারেন।' : 'Values are pre-filled with regional averages; click and edit to match your receipts.'}
            </p>
          </div>
          <span className="text-xs font-mono font-bold bg-gray-100 text-gray-700 px-3 py-1 rounded-xl">
            {lang === 'bn' ? `মোট: ৳${totalCost.toLocaleString()} টাকা` : `Total: ৳${totalCost.toLocaleString()} BDT`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Tillage */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '১. জমি চাষ ও মই (পাওয়ার টিলার)' : '1. Land Prep & Tillage'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="100"
                value={costs.tillage}
                onChange={(e) => updateCostItem('tillage', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 2. Seeds */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '২. বীজ / চারার দাম' : '2. Seeds / Seedlings'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="100"
                value={costs.seeds}
                onChange={(e) => updateCostItem('seeds', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 3. Fertilizers */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '৩. রাসায়নিক ও জৈব সার (ইউরিয়া, টিএসপি, পটাশ)' : '3. Fertilizers & Manure'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="100"
                value={costs.fertilizer}
                onChange={(e) => updateCostItem('fertilizer', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 4. Irrigation */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '৪. সেচ ও ডিজেল/বিদ্যুৎ খরচ' : '4. Irrigation & Fuel/Electricity'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="100"
                value={costs.irrigation}
                onChange={(e) => updateCostItem('irrigation', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 5. Pesticides */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '৫. কীটনাশক ও ছত্রাকনাশক স্প্রে' : '5. Pesticides & Plant Protection'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="100"
                value={costs.pesticide}
                onChange={(e) => updateCostItem('pesticide', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 6. Labor */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '৬. কৃষি শ্রমিক মজুরি (রোপণ, নিড়ানি, কাটা ও মাড়াই)' : '6. Labor Wages (Planting, Weeding, Harvest)'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="200"
                value={costs.labor}
                onChange={(e) => updateCostItem('labor', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* 7. Transport & Packing */}
          <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/60 space-y-1.5 md:col-span-2 lg:col-span-3">
            <label className="text-xs font-black text-gray-700 flex items-center justify-between">
              <span>{lang === 'bn' ? '৭. হাট/বাজারে পরিবহন ও বস্তাজাতকরণ খরচ' : '7. Packaging & Transport to Local Market'}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">৳</span>
              <input
                type="number"
                min="0"
                step="100"
                value={costs.transport}
                onChange={(e) => updateCostItem('transport', parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Middleman Bargaining & Fair Trade Action Guide */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50/70 rounded-[2rem] p-6 border-2 border-amber-200 shadow-md space-y-3">
        <div className="flex items-center space-x-3 text-amber-900">
          <ShieldCheck className="w-6 h-6 text-amber-700 shrink-0" />
          <h4 className="text-base md:text-lg font-black">
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

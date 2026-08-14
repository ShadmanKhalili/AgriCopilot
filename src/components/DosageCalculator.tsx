import React, { useState } from 'react';
import { Calculator, Droplets, SprayCan as Spray, CheckCircle2, DollarSign, AlertCircle, Sparkles, Download, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';

interface DosageCalculatorProps {
  lang: Language;
  cropName?: string;
  treatmentText?: string;
  defaultLandSize?: number;
}

export default function DosageCalculator({
  lang,
  cropName = 'Crop',
  treatmentText = '',
  defaultLandSize = 33, // 33 decimals = ~1 bigha in standard BD
}: DosageCalculatorProps) {
  const [landUnit, setLandUnit] = useState<'decimal' | 'bigha' | 'acre' | 'katha'>('decimal');
  const [landSize, setLandSize] = useState<number>(defaultLandSize);
  const [sprayerCapacity, setSprayerCapacity] = useState<number>(16); // 16L standard knapsack
  const [chemicalType, setChemicalType] = useState<'fungicide' | 'insecticide' | 'fertilizer_foliar' | 'custom'>('fungicide');
  const [dosagePerLiter, setDosagePerLiter] = useState<number>(2); // 2g or 2ml per liter default
  const [dosageUnit, setDosageUnit] = useState<'g' | 'ml'>('g');
  const [approxChemicalPricePer100g, setApproxChemicalPricePer100g] = useState<number>(180); // BDT

  // Land normalization to decimals
  // 1 Bigha = 33 Decimals (Standard BD)
  // 1 Acre = 100 Decimals
  // 1 Katha = 1.65 Decimals (20 katha = 1 bigha)
  const normalizedDecimals = React.useMemo(() => {
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

  // Standard water requirement: ~10 Liters of spray solution per decimal for foliage coverage
  const totalWaterNeeded = React.useMemo(() => {
    return Math.max(1, Math.round(normalizedDecimals * 10));
  }, [normalizedDecimals]);

  // Knapsack tanks needed
  const totalTanks = React.useMemo(() => {
    return Math.max(1, Math.ceil(totalWaterNeeded / sprayerCapacity));
  }, [totalWaterNeeded, sprayerCapacity]);

  // Total chemical needed in grams/ml
  const totalChemicalNeeded = React.useMemo(() => {
    return Math.round(totalWaterNeeded * dosagePerLiter);
  }, [totalWaterNeeded, dosagePerLiter]);

  // Chemical per knapsack tank
  const chemicalPerTank = React.useMemo(() => {
    return Math.round(sprayerCapacity * dosagePerLiter * 10) / 10;
  }, [sprayerCapacity, dosagePerLiter]);

  // Estimated Cost calculation (BDT)
  const estimatedCost = React.useMemo(() => {
    return Math.round((totalChemicalNeeded / 100) * approxChemicalPricePer100g);
  }, [totalChemicalNeeded, approxChemicalPricePer100g]);

  const copyPrescription = () => {
    const text = lang === 'bn' 
      ? `📋 ফসল সুরক্ষা ও ডোজ হিসাব (${cropName})
زمین / জমির আকার: ${landSize} ${landUnit === 'decimal' ? 'শতাংশ' : landUnit === 'bigha' ? 'বিঘা' : landUnit === 'acre' ? 'একর' : 'কাঠা'}
💧 মোট পানির পরিমাণ: ${totalWaterNeeded} লিটার
🎒 স্প্রেয়ার ট্যাংক (১৬ লিটার): ${totalTanks} বার
💊 প্রতি ট্যাংকে ওষুধ/কীটনাশক: ${chemicalPerTank} ${dosageUnit}
📦 মোট প্রয়োজনীয় ওষুধ: ${totalChemicalNeeded >= 1000 ? (totalChemicalNeeded / 1000).toFixed(2) + ' কেজি/লিটার' : totalChemicalNeeded + ' ' + dosageUnit}
💰 আনুমানিক খরচ: ৳${estimatedCost} টাকা`
      : `📋 Crop Protection & Spray Dosage (${cropName})
Land Size: ${landSize} ${landUnit} (${normalizedDecimals.toFixed(1)} decimals)
💧 Total Water: ${totalWaterNeeded} Liters
🎒 Knapsack Tanks (${sprayerCapacity}L): ${totalTanks} tanks
💊 Chemical per Tank: ${chemicalPerTank} ${dosageUnit}
📦 Total Chemical: ${totalChemicalNeeded >= 1000 ? (totalChemicalNeeded / 1000).toFixed(2) + ' kg/L' : totalChemicalNeeded + ' ' + dosageUnit}
💰 Estimated Cost: ৳${estimatedCost} BDT`;

    navigator.clipboard.writeText(text);
    toast.success(lang === 'bn' ? 'ডোজ হিসাব কপি করা হয়েছে!' : 'Dosage calculation copied!');
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white rounded-[2rem] p-5 md:p-7 border-2 border-emerald-200/60 shadow-xl shadow-emerald-900/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-600 p-2.5 rounded-2xl text-white shadow-md shadow-emerald-600/30">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                Precision Spray Engine
              </span>
            </div>
            <h3 className="text-base md:text-lg font-black text-gray-900 tracking-tight">
              {lang === 'bn' ? 'স্প্রে ও ওষুধের সঠিক ডোজ ক্যালকুলেটর' : 'Interactive Knapsack & Dosage Calculator'}
            </h3>
          </div>
        </div>

        <button
          onClick={copyPrescription}
          className="flex items-center space-x-1.5 self-start sm:self-auto bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'হিসাব কপি করুন' : 'Copy Slip'}</span>
        </button>
      </div>

      {/* Interactive Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6 relative z-10">
        {/* Land Size Input */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            {lang === 'bn' ? 'জমির পরিমাণ' : 'Land Size'}
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={landSize || ''}
              onChange={(e) => setLandSize(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-1.5 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <select
              value={landUnit}
              onChange={(e: any) => setLandUnit(e.target.value)}
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1.5 text-xs font-bold text-emerald-900 outline-none cursor-pointer"
            >
              <option value="decimal">{lang === 'bn' ? 'শতাংশ' : 'Decimal'}</option>
              <option value="bigha">{lang === 'bn' ? 'বিঘা (৩৩ শ.)' : 'Bigha'}</option>
              <option value="acre">{lang === 'bn' ? 'একর (১০০ শ.)' : 'Acre'}</option>
              <option value="katha">{lang === 'bn' ? 'কাঠা' : 'Katha'}</option>
            </select>
          </div>
          <div className="text-[10px] text-gray-400 font-medium">
            ≈ {normalizedDecimals.toFixed(1)} {lang === 'bn' ? 'শতাংশ' : 'decimals'}
          </div>
        </div>

        {/* Recommended Dosage per Liter */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            {lang === 'bn' ? 'প্রতি লিটারে ডোজ' : 'Dosage / Liter'}
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={dosagePerLiter || ''}
              onChange={(e) => setDosagePerLiter(Math.max(0.1, parseFloat(e.target.value) || 0))}
              className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-1.5 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <select
              value={dosageUnit}
              onChange={(e: any) => setDosageUnit(e.target.value)}
              className="bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1.5 text-xs font-bold text-emerald-900 outline-none cursor-pointer"
            >
              <option value="g">{lang === 'bn' ? 'গ্রাম (gm)' : 'Grams (g)'}</option>
              <option value="ml">{lang === 'bn' ? 'মিলি (ml)' : 'Milliliters (ml)'}</option>
            </select>
          </div>
          <div className="text-[10px] text-gray-400 font-medium">
            {lang === 'bn' ? 'প্যাকেটের নির্দেশ অনুযায়ী' : 'As per label/AI advice'}
          </div>
        </div>

        {/* Sprayer Tank Capacity */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            {lang === 'bn' ? 'স্প্রেয়ারের ধারণক্ষমতা' : 'Sprayer Tank Size'}
          </label>
          <select
            value={sprayerCapacity}
            onChange={(e) => setSprayerCapacity(parseInt(e.target.value))}
            className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value={16}>{lang === 'bn' ? '১৬ লিটার (স্ট্যান্ডার্ড ন্যাপস্যাক)' : '16 Liters (Standard Knapsack)'}</option>
            <option value={10}>{lang === 'bn' ? '১০ লিটার (ছোট স্প্রেয়ার)' : '10 Liters (Small)'}</option>
            <option value={20}>{lang === 'bn' ? '২০ লিটার (ব্যাটারি স্প্রেয়ার)' : '20 Liters (Battery Sprayer)'}</option>
            <option value={5}>{lang === 'bn' ? '৫ লিটার (হাতে চালিত)' : '5 Liters (Hand Pump)'}</option>
          </select>
          <div className="text-[10px] text-gray-400 font-medium">
            {lang === 'bn' ? '১ ড্রাম = ১৬ লিটার' : 'Default is 16L'}
          </div>
        </div>

        {/* Est Price per 100g */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            {lang === 'bn' ? 'ওষুধের দাম (১০০ গ্রাম/মিলি)' : 'Price / 100g or 100ml'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">৳</span>
            <input
              type="number"
              min="10"
              step="10"
              value={approxChemicalPricePer100g || ''}
              onChange={(e) => setApproxChemicalPricePer100g(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl pl-7 pr-3 py-1.5 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="text-[10px] text-gray-400 font-medium">
            {lang === 'bn' ? 'বাজারদর অনুযায়ী' : 'Approximate retail rate in BDT'}
          </div>
        </div>
      </div>

      {/* Results Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
        {/* Card 1: Per Tank Mix */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 border-2 border-emerald-100 shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">
              {lang === 'bn' ? 'প্রতি ট্যাংকে মিশ্রণ' : 'Per Knapsack Tank'}
            </span>
            <Droplets className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-emerald-900 tracking-tight">
              {chemicalPerTank} <span className="text-xs font-bold text-emerald-600">{dosageUnit}</span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              {lang === 'bn' ? `প্রতি ${sprayerCapacity} লিটার পানিতে মেশাবেন` : `Mix in each ${sprayerCapacity}L water`}
            </p>
          </div>
        </motion.div>

        {/* Card 2: Total Tanks */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 border-2 border-teal-100 shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-teal-700 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">
              {lang === 'bn' ? 'মোট স্প্রে সংখ্যা' : 'Total Tanks'}
            </span>
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-teal-900 tracking-tight">
              {totalTanks} <span className="text-xs font-bold text-teal-600">{lang === 'bn' ? 'ট্যাংক' : 'Tanks'}</span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              {lang === 'bn' ? `মোট ${totalWaterNeeded} লিটার পানি` : `Total ${totalWaterNeeded}L water needed`}
            </p>
          </div>
        </motion.div>

        {/* Card 3: Total Chemical Required */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 border-2 border-blue-100 shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">
              {lang === 'bn' ? 'মোট ওষুধ কিনবেন' : 'Total Required'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight">
              {totalChemicalNeeded >= 1000 ? (totalChemicalNeeded / 1000).toFixed(2) : totalChemicalNeeded}{' '}
              <span className="text-xs font-bold text-blue-600">
                {totalChemicalNeeded >= 1000 ? (dosageUnit === 'g' ? 'kg' : 'L') : dosageUnit}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-medium mt-1">
              {lang === 'bn' ? 'সম্পূর্ণ জমিতে ১ বার স্প্রে' : 'For 1 full field spray cycle'}
            </p>
          </div>
        </motion.div>

        {/* Card 4: Estimated Cost */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 shadow-lg shadow-orange-500/20 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-amber-100 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">
              {lang === 'bn' ? 'আনুমানিক মোট খরচ' : 'Estimated Cost'}
            </span>
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
              ৳ {estimatedCost.toLocaleString()}
            </div>
            <p className="text-[10px] text-amber-100 font-medium mt-1">
              {lang === 'bn' ? 'দোকানের আনুমানিক খুচরা মূল্য' : 'Based on local retail rates'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Safety & Spray Best Practices Banner */}
      <div className="mt-4 pt-4 border-t border-emerald-200/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 font-medium relative z-10">
        <div className="flex items-center space-x-2 text-[11px] text-emerald-800">
          <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {lang === 'bn'
              ? 'টিপস: সকাল ১০টার আগে বা বিকাল ৪টার পর রোদের তীব্রতা কমলে স্প্রে করুন। বাতাসের বিপরীতে স্প্রে করবেন না।'
              : 'Best Practice: Spray before 10 AM or after 4 PM when sun intensity is low. Never spray against the wind direction.'}
          </span>
        </div>
      </div>
    </div>
  );
}

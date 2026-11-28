import React, { useState } from 'react';
import { Calculator, Droplets, SprayCan as Spray, CheckCircle2, DollarSign, AlertCircle, Sparkles, Download, Copy, ShieldAlert, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { toBn } from '../utils/banglaNum';
import { copyText } from '../utils/clipboard';
import {
  computeDose,
  DOSE_BASES,
  DEFAULT_DOSE_BASIS,
  WATER_LITRES_PER_DECIMAL,
  type DoseBasis,
} from '../utils/doseMath';

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
  // Both start empty and stay as typed. The right rate depends on the product, so
  // the app must never suggest one: a pre-filled 2 g/L read as advice, and a
  // farmer could overdose by trusting it.
  const [doseText, setDoseText] = useState('');
  const labelRate = Number(doseText) > 0 ? Number(doseText) : null;
  // Which volume of water the label's rate refers to. Most Bangladeshi labels
  // say "per 10 litres", so that is the starting point, but it is always shown
  // back to the farmer ("Label says: 20 ml per 10 L — is that right?").
  const [doseBasis, setDoseBasis] = useState<DoseBasis>(DEFAULT_DOSE_BASIS);
  const [dosageUnit, setDosageUnit] = useState<'g' | 'ml'>('g');
  const [priceText, setPriceText] = useState('');
  const pricePer100 = Number(priceText) > 0 ? Number(priceText) : null;

  const bn = lang === 'bn';
  // Capitals and wide spacing are for English labels only.
  const caps = (cls: string) => (bn ? '' : cls);
  // Every number shown to a Bangla reader goes through toBn.
  const fmt = (n: number | string) => (bn ? toBn(n) : String(n));
  const unitLabel = dosageUnit === 'g' ? (bn ? 'গ্রাম' : 'g') : (bn ? 'মিলি' : 'ml');
  const basisLabel = (b: DoseBasis) =>
    b === 16
      ? (bn ? `প্রতি ${fmt(16)} লিটার ট্যাংকে` : 'per 16 L tank')
      : (bn ? `প্রতি ${fmt(b)} লিটারে` : `per ${b} L`);
  const basisButtonLabel = (b: DoseBasis) =>
    b === 16
      ? (bn ? `${fmt(16)} লিটার ট্যাংকে` : '16 L tank')
      : (bn ? `${fmt(b)} লিটারে` : `${b} L`);

  // All arithmetic lives in utils/doseMath.ts (unit-tested). Land is normalised
  // to decimals (1 bigha = 33, 1 acre = 100, 1 katha = 1.65) and the spray
  // volume is an approximate ~10 L per decimal.
  const dose = React.useMemo(
    () =>
      computeDose({
        landSize,
        landUnit,
        rate: labelRate,
        basisLitres: doseBasis,
        tankLitres: sprayerCapacity,
        pricePer100,
      }),
    [landSize, landUnit, labelRate, doseBasis, sprayerCapacity, pricePer100]
  );
  const normalizedDecimals = dose.decimals;
  const totalWaterNeeded = dose.totalWaterLitres;
  const totalTanks = dose.totalTanks;
  const totalChemicalNeeded = dose.total;
  const chemicalPerTank = dose.perTank;
  const estimatedCost = dose.cost;

  const fmtTotal = (total: number) =>
    total >= 1000
      ? `${fmt((total / 1000).toFixed(2))} ${dosageUnit === 'g' ? (bn ? 'কেজি' : 'kg') : (bn ? 'লিটার' : 'L')}`
      : `${fmt(total)} ${unitLabel}`;

  const readBack = labelRate === null
    ? null
    : bn
      ? `লেবেলে লেখা: ${basisLabel(doseBasis)} ${fmt(labelRate)} ${unitLabel} — ঠিক আছে তো?`
      : `Label says: ${labelRate} ${unitLabel} ${basisLabel(doseBasis)} — is that right?`;

  const copyPrescription = async () => {
    if (chemicalPerTank === null || totalChemicalNeeded === null) return;
    const costLineBn = estimatedCost === null ? '' : `\n💰 আনুমানিক খরচ: ৳${fmt(estimatedCost)} টাকা`;
    const costLineEn = estimatedCost === null ? '' : `\n💰 Estimated Cost: ৳${estimatedCost} BDT`;
    const per16Bn = sprayerCapacity !== 16 && dose.per16LTank !== null
      ? `\n💊 প্রতি ১৬ লিটার ট্যাংকে: ${fmt(dose.per16LTank)} ${unitLabel}` : '';
    const per16En = sprayerCapacity !== 16 && dose.per16LTank !== null
      ? `\n💊 Per 16 L tank: ${dose.per16LTank} ${unitLabel}` : '';
    const text = bn
      ? `📋 ফসল সুরক্ষা ও ডোজ হিসাব (${cropName})
${readBack}
জমির আকার: ${fmt(landSize)} ${landUnit === 'decimal' ? 'শতাংশ' : landUnit === 'bigha' ? 'বিঘা' : landUnit === 'acre' ? 'একর' : 'কাঠা'}
💧 মোট পানির পরিমাণ (আনুমানিক): ${fmt(totalWaterNeeded)} লিটার
🎒 স্প্রেয়ার ট্যাংক (${fmt(sprayerCapacity)} লিটার): ${fmt(totalTanks)} বার
💊 প্রতি ${fmt(sprayerCapacity)} লিটার ট্যাংকে ওষুধ: ${fmt(chemicalPerTank)} ${unitLabel}${per16Bn}
📦 মোট প্রয়োজনীয় ওষুধ (আনুমানিক): ${fmtTotal(totalChemicalNeeded)}${costLineBn}
⚠️ গ্লাভস ও মাস্ক পরুন। বাতাস বা বৃষ্টিতে স্প্রে করবেন না। লেবেলের ফসল তোলার আগের অপেক্ষার দিন মানুন। সন্দেহ হলে ১৬১২৩ নম্বরে কল করুন।`
      : `📋 Crop Protection & Spray Dosage (${cropName})
${readBack}
Land Size: ${landSize} ${landUnit} (${normalizedDecimals.toFixed(1)} decimals)
💧 Total Water (approx.): ${totalWaterNeeded} Liters
🎒 Knapsack Tanks (${sprayerCapacity}L): ${totalTanks} tanks
💊 Chemical per ${sprayerCapacity} L tank: ${chemicalPerTank} ${unitLabel}${per16En}
📦 Total Chemical (approx.): ${fmtTotal(totalChemicalNeeded)}${costLineEn}
⚠️ Wear gloves and a mask. Do not spray in wind or rain. Keep the label's days-before-harvest wait. If unsure, call 16123.`;

    if (await copyText(text)) {
      toast.success(bn ? 'ডোজ হিসাব কপি করা হয়েছে!' : 'Dosage calculation copied!');
    } else {
      toast.error(bn ? 'কপি করা যায়নি' : 'Could not copy');
    }
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
            <h3 className="text-base md:text-lg font-black text-gray-900 tracking-tight">
              {lang === 'bn' ? 'স্প্রে ও ওষুধের হিসাব' : 'Spray Calculator'}
            </h3>
            <p className="text-xs text-gray-500 font-medium">
              {lang === 'bn' ? 'প্যাকেটে লেখা মাত্রা দিলে জমির জন্য পানি ও ওষুধের আনুমানিক হিসাব পাবেন' : 'Enter the rate on the product label to estimate water and chemical for your land'}
            </p>
          </div>
        </div>

        <button
          onClick={copyPrescription}
          disabled={labelRate === null}
          className="disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1.5 self-start sm:self-auto bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 min-h-[48px] rounded-xl text-sm font-black shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'হিসাব কপি করুন' : 'Copy Slip'}</span>
        </button>
      </div>

      {/* What water volume does the label's rate refer to? */}
      <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm mb-3.5 relative z-10">
        <div id="dose-basis-label" className="block text-sm font-bold text-gray-800 mb-2">
          {bn ? 'লেবেলে মাত্রা কত পানির জন্য লেখা?' : 'The label gives the rate for how much water?'}
        </div>
        <div role="radiogroup" aria-labelledby="dose-basis-label" className="grid grid-cols-3 gap-2">
          {DOSE_BASES.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={doseBasis === b}
              onClick={() => setDoseBasis(b)}
              className={`min-h-[48px] px-2 py-2 rounded-xl border-2 text-sm font-black transition-all cursor-pointer active:scale-95 ${
                doseBasis === b
                  ? 'bg-emerald-700 border-emerald-800 text-white shadow-md'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              {basisButtonLabel(b)}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 font-medium mt-2">
          {bn
            ? 'প্যাকেট দেখে মিলিয়ে নিন: ১০ লিটারে লেখা থাকলে ১০ লিটার বেছে নিন। ভুল বাছলে ১০ গুণ বেশি ওষুধ পড়তে পারে।'
            : 'Check the pack: if it says per 10 L, pick 10 L. Picking the wrong one can mean 10x too much chemical.'}
        </p>
      </div>

      {/* Interactive Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6 relative z-10">
        {/* Land Size Input */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className={`block text-[11px] font-bold text-gray-600 ${caps('uppercase tracking-wider')}`}>
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
          <div className="text-[11px] text-gray-400 font-medium">
            ≈ {fmt(normalizedDecimals.toFixed(1))} {lang === 'bn' ? 'শতাংশ' : 'decimals'}
          </div>
        </div>

        {/* Dose as written on the label (basis chosen above) */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className={`block text-[11px] font-bold text-gray-600 ${caps('uppercase tracking-wider')}`}>
            {bn ? `লেবেলের মাত্রা (${basisLabel(doseBasis)})` : `Label rate (${basisLabel(doseBasis)})`}
          </label>
          <div className="flex space-x-2">
            <input
              type="number"
              min="0"
              step="0.1"
              inputMode="decimal"
              placeholder={lang === 'bn' ? 'প্যাকেট দেখে' : 'From label'}
              aria-label={bn ? `লেবেলের মাত্রা, ${basisLabel(doseBasis)}` : `Label rate, ${basisLabel(doseBasis)}`}
              value={doseText}
              onChange={(e) => setDoseText(e.target.value)}
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
          <div className="text-[11px] text-gray-400 font-medium">
            {lang === 'bn' ? 'ওষুধের প্যাকেট দেখে লিখুন' : 'Enter it from the product label'}
          </div>
        </div>

        {/* Sprayer Tank Capacity */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className={`block text-[11px] font-bold text-gray-600 ${caps('uppercase tracking-wider')}`}>
            {lang === 'bn' ? 'স্প্রেয়ারের ধারণক্ষমতা' : 'Sprayer Tank Size'}
          </label>
          <select
            value={sprayerCapacity}
            onChange={(e) => setSprayerCapacity(parseInt(e.target.value))}
            className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
          >
            <option value={16}>{lang === 'bn' ? '১৬ লিটার (স্ট্যান্ডার্ড ন্যাপস্যাক)' : '16 Liters (Standard Knapsack)'}</option>
            <option value={10}>{lang === 'bn' ? '১০ লিটার (ছোট স্প্রেয়ার)' : '10 Liters (Small)'}</option>
            <option value={20}>{lang === 'bn' ? '২০ লিটার (ব্যাটারি স্প্রেয়ার)' : '20 Liters (Battery Sprayer)'}</option>
            <option value={5}>{lang === 'bn' ? '৫ লিটার (হাতে চালিত)' : '5 Liters (Hand Pump)'}</option>
          </select>
          <div className="text-[11px] text-gray-400 font-medium">
            {lang === 'bn' ? 'আপনার স্প্রেয়ারের মাপ বেছে নিন' : 'Choose your sprayer size'}
          </div>
        </div>

        {/* Est Price per 100g */}
        <div className="bg-white/90 p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-1.5">
          <label className={`block text-[11px] font-bold text-gray-600 ${caps('uppercase tracking-wider')}`}>
            {lang === 'bn' ? 'ওষুধের দাম (১০০ গ্রাম/মিলি)' : 'Price / 100g or 100ml'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">৳</span>
            <input
              type="number"
              min="0"
              step="10"
              inputMode="decimal"
              aria-label={lang === 'bn' ? 'ওষুধের দাম' : 'Chemical price'}
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl pl-7 pr-3 py-1.5 text-sm font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="text-[11px] text-gray-400 font-medium">
            {lang === 'bn' ? 'ঐচ্ছিক — দিলে খরচের হিসাব পাবেন' : 'Optional — enter it to see the cost'}
          </div>
        </div>
      </div>

      {labelRate === null && (
        <div role="status" className="flex items-start gap-2 mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-sm font-bold text-amber-900 relative z-10">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            {lang === 'bn'
              ? 'ওষুধের মাত্রা আপনাকে লিখতে হবে। একেক ওষুধের মাত্রা একেক রকম, তাই প্যাকেটে লেখা মাত্রা দেখে নিন অথবা স্থানীয় কৃষি কর্মকর্তাকে জিজ্ঞেস করুন।'
              : 'You need to enter the dose. It differs for every product, so check the rate on the label or ask your local agriculture officer.'}
          </span>
        </div>
      )}

      {/* Read the entered rate back, with its basis, so a wrong basis is caught */}
      {readBack && (
        <div role="status" className="mb-4 p-3 rounded-2xl bg-emerald-100 border-2 border-emerald-400 text-sm font-black text-emerald-950 relative z-10">
          <div>{readBack}</div>
          {dose.perLitre !== null && (
            <div className="font-bold text-emerald-900 mt-1">
              {bn
                ? `= প্রতি ১ লিটার পানিতে ${fmt(Math.round(dose.perLitre * 100) / 100)} ${unitLabel}`
                : `= ${Math.round(dose.perLitre * 100) / 100} ${unitLabel} in every 1 L of water`}
            </div>
          )}
        </div>
      )}

      {/* Results Dashboard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
        {/* Card 1: Per Tank Mix */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 border-2 border-emerald-100 shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className={`text-[11px] font-black ${caps('uppercase tracking-wider')}`}>
              {lang === 'bn' ? 'প্রতি ট্যাংকে মিশ্রণ' : 'Per Knapsack Tank'}
            </span>
            <Droplets className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-emerald-900 tracking-tight">
              {chemicalPerTank === null ? '—' : <>{fmt(chemicalPerTank)} <span className="text-sm font-bold text-emerald-600">{unitLabel}</span></>}
            </div>
            <p className="text-sm text-gray-600 font-medium mt-1">
              {bn ? `প্রতি ${fmt(sprayerCapacity)} লিটার পানিতে মেশাবেন` : `Mix in each ${sprayerCapacity}L water`}
            </p>
            {/* Farmers mix by the 16 L tank, so show that too when the sprayer differs */}
            {sprayerCapacity !== 16 && dose.per16LTank !== null && (
              <p className="text-sm text-emerald-900 font-black mt-1">
                {bn
                  ? `প্রতি ${fmt(16)} লিটার ট্যাংকে: ${fmt(dose.per16LTank)} ${unitLabel}`
                  : `Per 16 L tank: ${dose.per16LTank} ${unitLabel}`}
              </p>
            )}
          </div>
        </motion.div>

        {/* Card 2: Total Tanks */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 border-2 border-teal-100 shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-teal-700 mb-2">
            <span className={`text-[11px] font-black ${caps('uppercase tracking-wider')}`}>
              {lang === 'bn' ? 'মোট স্প্রে সংখ্যা' : 'Total Tanks'}
            </span>
            <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-teal-900 tracking-tight">
              {fmt(totalTanks)} <span className="text-sm font-bold text-teal-600">{lang === 'bn' ? 'ট্যাংক' : 'Tanks'}</span>
            </div>
            <p className="text-sm text-gray-600 font-medium mt-1">
              {bn ? `আনুমানিক মোট ${fmt(totalWaterNeeded)} লিটার পানি` : `About ${totalWaterNeeded}L of water in total`}
            </p>
          </div>
        </motion.div>

        {/* Card 3: Total Chemical Required */}
        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl p-4 border-2 border-blue-100 shadow-md flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className={`text-[11px] font-black ${caps('uppercase tracking-wider')}`}>
              {lang === 'bn' ? 'মোট ওষুধ (আনুমানিক)' : 'Total chemical (estimate)'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-blue-900 tracking-tight">
              {totalChemicalNeeded === null ? '—' : (
                <>
                  {fmt(totalChemicalNeeded >= 1000 ? (totalChemicalNeeded / 1000).toFixed(2) : totalChemicalNeeded)}{' '}
                  <span className="text-sm font-bold text-blue-600">
                    {totalChemicalNeeded >= 1000 ? (dosageUnit === 'g' ? (bn ? 'কেজি' : 'kg') : (bn ? 'লিটার' : 'L')) : unitLabel}
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-gray-600 font-medium mt-1">
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
            <span className={`text-[11px] font-black ${caps('uppercase tracking-wider')}`}>
              {lang === 'bn' ? 'আনুমানিক মোট খরচ' : 'Estimated Cost'}
            </span>
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-2xl md:text-3xl font-black text-white tracking-tight">
              {estimatedCost === null ? '—' : `৳ ${bn ? toBn(estimatedCost.toLocaleString()) : estimatedCost.toLocaleString()}`}
            </div>
            <p className="text-sm text-amber-50 font-medium mt-1">
              {lang === 'bn' ? 'আপনার দেওয়া দাম অনুযায়ী' : 'Based on the price you entered'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* The water volume is a rule of thumb, not a measurement */}
      <p className="mt-3 text-sm text-gray-700 font-medium relative z-10">
        {bn
          ? `আনুমানিক হিসাব: প্রতি শতাংশে প্রায় ${fmt(WATER_LITRES_PER_DECIMAL)} লিটার পানি ধরা হয়েছে। ফসল, গাছের আকার ও স্প্রেয়ারভেদে কম-বেশি লাগতে পারে। ওষুধ সবসময় লেবেলের মাত্রায় মেশান।`
          : `Approximate: about ${WATER_LITRES_PER_DECIMAL} L of water per decimal is assumed. It varies with the crop, plant size and sprayer. Always mix the chemical at the label's rate.`}
      </p>

      {/* Safety block */}
      <div className="mt-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-sm text-rose-950 font-medium relative z-10">
        <div className="flex items-center gap-2 font-black text-base mb-2">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0" />
          <span>{bn ? 'নিরাপত্তা — স্প্রের আগে পড়ুন' : 'Safety — read before spraying'}</span>
        </div>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>{bn ? 'হাতে গ্লাভস ও মুখে মাস্ক পরুন।' : 'Wear gloves and a mask.'}</li>
          <li>{bn ? 'বাতাসের দিনে বা বৃষ্টির সময় স্প্রে করবেন না। সকাল ১০টার আগে বা বিকাল ৪টার পর স্প্রে করুন, বাতাসের বিপরীতে নয়।' : 'Do not spray in wind or rain. Spray before 10 AM or after 4 PM, never against the wind.'}</li>
          <li>{bn ? 'লেবেলে লেখা ফসল তোলার আগের অপেক্ষার দিন (PHI) মেনে চলুন।' : "Keep the days-before-harvest (PHI) wait written on the label."}</li>
          <li className="font-black">{bn ? 'সন্দেহ হলে উপজেলা কৃষি অফিস বা ১৬১২৩ নম্বরে কল করুন।' : 'If unsure, ask your upazila agriculture office or call 16123.'}</li>
        </ul>
        <a
          href="tel:16123"
          className="mt-3 inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-black active:scale-95 transition-all"
        >
          <Phone className="w-4 h-4" />
          <span>{bn ? `${fmt(16123)} নম্বরে কল করুন` : 'Call 16123'}</span>
        </a>
      </div>
    </div>
  );
}

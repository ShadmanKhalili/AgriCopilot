import React, { useState } from 'react';
import { 
  HeartPulse, 
  Leaf, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Clock, 
  Calendar, 
  Activity, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  Droplets,
  Sun,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';
import { audioFeedback } from '../utils/audioFeedback';

interface PlantHealthRecoveryTrackerProps {
  lang: Language;
  cropName?: string;
  diseaseName?: string;
  severity?: string;
  harvestIntervalDays?: number;
  initialPathway?: 'organic' | 'chemical';
  compact?: boolean;
}

interface DayMilestone {
  day: number;
  labelBn: string;
  labelEn: string;
  chlorophyllSpad: number;
  lesionHaltingPct: number;
  tissueHealingPct: number;
  descriptionBn: string;
  descriptionEn: string;
  actionItemBn: string;
  actionItemEn: string;
  leafStatus: 'infected' | 'arrested' | 'healing' | 'recovering' | 'restored';
}

const RECOVERY_TIMELINES: {
  organic: DayMilestone[];
  chemical: DayMilestone[];
} = {
  organic: [
    {
      day: 1,
      labelBn: '১ম দিন: প্রারম্ভিক স্প্রে',
      labelEn: 'Day 1: Bio-Inoculation',
      chlorophyllSpad: 22,
      lesionHaltingPct: 35,
      tissueHealingPct: 15,
      descriptionBn: 'নিমতেল ও ট্রাইকোডার্মা বায়ো-এজেন্ট দ্বারা পাতার পৃষ্ঠের সক্রিয় ছত্রাক রেনু বা ব্যাকটেরিয়া কলোনি দমন শুরু।',
      descriptionEn: 'Botanical azadirachtin & Trichoderma bio-agent halts pathogen sporulation on foliar surface.',
      actionItemBn: 'সকালে বা বিকেলে মৃদু রোদে পাতার উপরে ও নিচে ৫ মিলি/লি হারে স্প্রে সম্পন্ন করুন।',
      actionItemEn: 'Spray botanical solution @ 5ml/L targeting both upper and lower foliar surfaces.',
      leafStatus: 'infected'
    },
    {
      day: 3,
      labelBn: '৩য় দিন: কোষ প্রাচীর প্রতিরক্ষা',
      labelEn: 'Day 3: Tissue Desiccation',
      chlorophyllSpad: 28,
      lesionHaltingPct: 60,
      tissueHealingPct: 35,
      descriptionBn: 'আক্রান্ত ক্ষতস্থানের কিনারা শুকাতে শুরু করেছে, নতুন পাতার দিকে সংক্রমণ বিস্তার বন্ধ হয়েছে।',
      descriptionEn: 'Lesion margins desiccate and turn light brown. Pathogen spread to adjacent leaves stopped.',
      actionItemBn: 'গাছের গোড়ায় অতিরিক্ত জমা পানি নিষ্কাশন করুন এবং মাটির আর্দ্রতা পরীক্ষা করুন।',
      actionItemEn: 'Drain standing furrow water and inspect roots for secondary anaerobic stress.',
      leafStatus: 'arrested'
    },
    {
      day: 5,
      labelBn: '৫ম দিন: ক্লোরোফিল পুনরুজ্জীবন',
      labelEn: 'Day 5: Chlorophyll Rebound',
      chlorophyllSpad: 36,
      lesionHaltingPct: 82,
      tissueHealingPct: 65,
      descriptionBn: 'অসুস্থ পাতার হলদেটে ভাব কেটে গাঢ় সবুজ রঞ্জক পদার্থ (ক্লোরোফিল) সংশ্লেষ বাড়ছে। নতুন কুঁড়ি প্রস্ফুটিত।',
      descriptionEn: 'Chlorosis fades as chlorophyll synthesis surges. Fresh green meristematic shoots emerge.',
      actionItemBn: 'ভার্মিকম্পোস্ট বা বায়ো-পটাশ প্রয়োগ করে গাছের প্রাকৃতিক রোগ প্রতিরোধ ক্ষমতা বৃদ্ধি করুন।',
      actionItemEn: 'Top-dress with enriched vermicompost to stimulate systemic acquired resistance (SAR).',
      leafStatus: 'healing'
    },
    {
      day: 7,
      labelBn: '৭ম দিন: সুস্থ পাতার পুনর্জন্ম',
      labelEn: 'Day 7: Leaf Regeneration',
      chlorophyllSpad: 44,
      lesionHaltingPct: 94,
      tissueHealingPct: 88,
      descriptionBn: 'গাছ সম্পূর্ণ সতেজ ও রোগমুক্ত অবস্থায় ফিরে এসেছে। নতুন পাতায় পূর্ণাঙ্গ সালোকসংশ্লেষণ শুরু।',
      descriptionEn: 'Canopy vigor fully restored with robust photosynthetic output across regenerated leaves.',
      actionItemBn: 'নিরাপদ ফসল উত্তোলনের প্রস্তুতি গ্রহণ করুন। কোনো রাসায়নিক অবশিষ্টাংশ নেই (০ দিন PHI)।',
      actionItemEn: 'Zero chemical residue: Crop is 100% organic-safe for immediate market harvest.',
      leafStatus: 'recovering'
    },
    {
      day: 14,
      labelBn: '১৪শ দিন: শতভাগ ফলন সুরক্ষা',
      labelEn: 'Day 14: Yield Peak Protected',
      chlorophyllSpad: 50,
      lesionHaltingPct: 99,
      tissueHealingPct: 98,
      descriptionBn: 'স্থায়ী জৈব সুরক্ষা প্রাচীর তৈরি হয়েছে। স্বাভাবিকের চেয়ে বেশি দানাদার বা পরিপুষ্ট ফলন প্রত্যাশিত।',
      descriptionEn: 'Sustained organic immunity shield. Crop yield density matches or exceeds baseline projection.',
      actionItemBn: 'পরবর্তী রোপণ মৌসুমে প্রতিরোধক জাত নির্বাচন ও বীজ শোধন বজায় রাখুন।',
      actionItemEn: 'Sustain soil health with seasonal green manuring and crop rotation.',
      leafStatus: 'restored'
    }
  ],
  chemical: [
    {
      day: 1,
      labelBn: '১ম দিন: তাৎক্ষণিক নকডাউন',
      labelEn: 'Day 1: Rapid Knockdown',
      chlorophyllSpad: 24,
      lesionHaltingPct: 55,
      tissueHealingPct: 20,
      descriptionBn: 'অনুমোদিত ছত্রাকনাশক/ব্যাকটেরিয়ানাশক স্প্রে করার কয়েক ঘণ্টার মধ্যে সক্রিয় প্যাথোজেন ধ্বংস।',
      descriptionEn: 'Fast-acting systematic active ingredient arrests metabolic enzyme synthesis of fungal mycelia.',
      actionItemBn: 'সঠিক মাত্রায় সুরক্ষামূলক মাস্ক ও গ্লাভস পরে স্প্রে করুন। বৃষ্টির সম্ভাবনা থাকলে অপেক্ষা করুন।',
      actionItemEn: 'Apply certified dosage with protective PPE. Avoid spraying during midday direct sunlight.',
      leafStatus: 'infected'
    },
    {
      day: 3,
      labelBn: '৩য় দিন: ক্ষতের বিস্তার সম্পূর্ণ বন্ধ',
      labelEn: 'Day 3: Rapid Necrosis Arrest',
      chlorophyllSpad: 32,
      lesionHaltingPct: 85,
      tissueHealingPct: 50,
      descriptionBn: 'জলাবদ্ধ ক্ষতের চারপাশ সম্পূর্ণ শুকিয়ে বাদামী হয়ে গেছে। প্যাথোজেনিক বিস্তার শূন্যের কোঠায়।',
      descriptionEn: 'Water-soaked margins completely dry out into crispy barrier tissue. Spore release zeroed.',
      actionItemBn: 'ইউরিয়া সারের টপ-ড্রেসিং সাময়িক স্থগিত রাখুন যাতে কচি অংশে নতুন করে সংক্রমণ না ঘটে।',
      actionItemEn: 'Temporarily suspend top-dress nitrogen to prevent succulent susceptible new tissue.',
      leafStatus: 'arrested'
    },
    {
      day: 5,
      labelBn: '৫ম দিন: নতুন ডগা ও কুঁড়ি প্রবৃদ্ধি',
      labelEn: 'Day 5: Meristem Recovery',
      chlorophyllSpad: 40,
      lesionHaltingPct: 93,
      tissueHealingPct: 75,
      descriptionBn: 'ক্লিনিক্যাল রিকভারি দ্রুত এগিয়ে চলেছে। নতুন কুঁড়িতে গাঢ় সবুজ আভা দৃশ্যমান।',
      descriptionEn: 'Accelerated clinical restoration: Healthy green vascular shoots emerge from lateral nodes.',
      actionItemBn: 'স্প্রে পরবর্তী ৭ দিন কঠোরভাবে প্রাক-ফসল উত্তোলন সময়সীমা (PHI) বজায় রাখুন।',
      actionItemEn: 'Monitor Pre-Harvest Interval (PHI) safety countdown for pesticide dissipation.',
      leafStatus: 'healing'
    },
    {
      day: 7,
      labelBn: '৭ম দিন: ক্যানোপি সুরক্ষা ও সালোকসংশ্লেষণ',
      labelEn: 'Day 7: Canopy Fortification',
      chlorophyllSpad: 46,
      lesionHaltingPct: 98,
      tissueHealingPct: 92,
      descriptionBn: 'ফসলহানির ঝুঁকি ৯৫% হ্রাস পেয়েছে। পাতার সবুজ রঞ্জক পূর্ণ শক্তিতে সক্রিয়।',
      descriptionEn: 'Yield destruction risk mitigated by 95%. Photosynthetic assimilation back at optimum.',
      actionItemBn: 'ফসল কাটার পূর্ববর্তী অপেক্ষমাণ সময়কাল (PHI) ১৪ দিন পার না হওয়া পর্যন্ত তোলা নিষেধ।',
      actionItemEn: 'Enforce certified PHI countdown before harvesting for consumer food safety.',
      leafStatus: 'recovering'
    },
    {
      day: 14,
      labelBn: '১৪শ দিন: নিরাপদ ফসল কর্তন ও বাজারজাত',
      labelEn: 'Day 14: Safe Harvest Window',
      chlorophyllSpad: 52,
      lesionHaltingPct: 100,
      tissueHealingPct: 100,
      descriptionBn: 'রাসায়নিক অবশিষ্টাংশ নিরাপদ মাত্রায় পৌঁছিয়েছে। ফসল এখন কর্তন ও বাজারে বিক্রির জন্য প্রস্তুত।',
      descriptionEn: 'Pesticide residues fully degraded below MRL levels. Crop is 100% safe for market dispatch.',
      actionItemBn: 'অনুমোদিত আড়তে সর্বোচ্চ গ্রেড মূল্যে পণ্য বিক্রির জন্য প্রস্তুত করুন।',
      actionItemEn: 'Grade and package produce for premium wholesale mandi pricing.',
      leafStatus: 'restored'
    }
  ]
};

export default function PlantHealthRecoveryTracker({
  lang,
  cropName = 'Paddy',
  diseaseName = 'Bacterial Leaf Blight',
  severity = 'Critical',
  harvestIntervalDays = 14,
  initialPathway = 'organic',
  compact = false
}: PlantHealthRecoveryTrackerProps) {
  const [pathway, setPathway] = useState<'organic' | 'chemical'>(initialPathway);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1); // Default Day 3

  const timeline = RECOVERY_TIMELINES[pathway];
  const currentMilestone = timeline[selectedDayIndex];

  // Chart dataset
  const chartData = timeline.map(m => ({
    name: lang === 'bn' ? `${m.day}ম দিন` : `Day ${m.day}`,
    day: m.day,
    chlorophyll: m.chlorophyllSpad,
    healing: m.tissueHealingPct,
    halting: m.lesionHaltingPct
  }));

  const handlePathwayChange = (newPathway: 'organic' | 'chemical') => {
    audioFeedback.playTactileClick();
    setPathway(newPathway);
  };

  const handleDaySelect = (idx: number) => {
    audioFeedback.playTactileClick();
    setSelectedDayIndex(idx);
  };

  return (
    <div className="bg-gradient-to-br from-stone-950 via-[#0a150e] to-stone-900 border border-emerald-500/30 text-white rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden space-y-6">
      
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Header: Apple Health Style Branding */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-lg shadow-emerald-900/40 text-white shrink-0">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                {lang === 'bn' ? 'ফসল নিরাময় ট্র্যাকার' : 'PLANT HEALTH BIOMETRICS'}
              </span>
              <span className="text-[10px] font-mono text-stone-400">
                {cropName} • {diseaseName}
              </span>
            </div>
            <h3 className="font-display font-black text-lg sm:text-xl text-white tracking-tight uppercase">
              {lang === 'bn' ? '৭-১৪ দিনের উদ্ভিদ স্বাস্থ্য পুনরুদ্ধার সূচক' : '7-Day Plant Health Recovery Tracker'}
            </h3>
            <p className="text-xs text-stone-300 mt-0.5">
              {lang === 'bn' 
                ? 'পরামর্শ অনুযায়ী চিকিৎসা গ্রহণে পাতার ক্লোরোফিল পুনরুজ্জীবন, ক্ষত নিরাময় ও ফসল কর্তনের সময়রেখা' 
                : 'Interactive projection of chlorophyll rebound, lesion desiccation, and PHI harvest window'}
            </p>
          </div>
        </div>

        {/* Treatment Pathway Switcher */}
        <div className="flex items-center p-1 bg-black/60 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handlePathwayChange('organic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              pathway === 'organic'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Leaf className="w-3.5 h-3.5 text-emerald-300" />
            <span>{lang === 'bn' ? 'জৈব / ভেষজ পথ' : 'Organic Pathway'}</span>
          </button>

          <button
            type="button"
            onClick={() => handlePathwayChange('chemical')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              pathway === 'chemical'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950/50'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-blue-300" />
            <span>{lang === 'bn' ? 'রাসায়নিক / দ্রুত উপশম' : 'Chemical Rx'}</span>
          </button>
        </div>
      </div>

      {/* Core Health Vitals Rings (Apple Health Style Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        
        {/* Metric 1: Chlorophyll SPAD Index */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-mono uppercase tracking-widest">Chlorophyll (SPAD)</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-black text-emerald-400 font-mono">
            {currentMilestone.chlorophyllSpad}
            <span className="text-xs text-stone-400 font-sans font-medium"> / 55 SPAD</span>
          </div>
          <div className="text-[10px] text-stone-300 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">+{currentMilestone.chlorophyllSpad - 22}</span>
            <span>{lang === 'bn' ? 'বেসলাইন থেকে বৃদ্ধি' : 'points above baseline'}</span>
          </div>
        </div>

        {/* Metric 2: Active Pathogen Halting */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-mono uppercase tracking-widest">Lesion Arrest</span>
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-black text-teal-300 font-mono">
            {currentMilestone.lesionHaltingPct}%
          </div>
          <div className="text-[10px] text-stone-300">
            {lang === 'bn' ? 'ছত্রাক ও ব্যাকটেরিয়া দমন' : 'Pathogen spread neutralized'}
          </div>
        </div>

        {/* Metric 3: Foliar Tissue Regeneration */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-mono uppercase tracking-widest">Tissue Healing</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-black text-blue-300 font-mono">
            {currentMilestone.tissueHealingPct}%
          </div>
          <div className="text-[10px] text-stone-300">
            {lang === 'bn' ? 'নতুন পাতার পুনরুজ্জীবন' : 'Healthy meristem foliage'}
          </div>
        </div>

        {/* Metric 4: Pre-Harvest Interval (PHI) Countdown */}
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-[10px] font-mono uppercase tracking-widest">Harvest Safety (PHI)</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-display font-black text-amber-300 font-mono">
            {pathway === 'organic' ? (
              <span className="text-emerald-400">0 Days</span>
            ) : (
              <span>{Math.max(harvestIntervalDays - currentMilestone.day, 0)} Days</span>
            )}
          </div>
          <div className="text-[10px] text-stone-300">
            {pathway === 'organic' 
              ? (lang === 'bn' ? 'শতভাগ বিষমুক্ত (তাৎক্ষণিক কর্তনযোগ্য)' : 'Zero residue • Organic safe')
              : (lang === 'bn' ? 'ফসল কাটার নিরাপদ অপেক্ষাকাল' : 'Safe residue dissipation interval')}
          </div>
        </div>

      </div>

      {/* Interactive Day Scrubber / Stepper Buttons */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span className="font-bold uppercase tracking-wider">
            {lang === 'bn' ? 'চিকিৎসা পরবর্তী অগ্রগতি স্ক্রাবার:' : 'Interactive Day Scrubber:'}
          </span>
          <span className="font-mono text-emerald-400 font-bold">
            {lang === 'bn' ? currentMilestone.labelBn : currentMilestone.labelEn}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {timeline.map((milestone, idx) => {
            const isSelected = selectedDayIndex === idx;
            return (
              <button
                key={milestone.day}
                type="button"
                onClick={() => handleDaySelect(idx)}
                className={`py-2.5 px-2 rounded-2xl border text-center transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? pathway === 'organic'
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950 font-black'
                      : 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-950 font-black'
                    : 'bg-white/5 text-stone-300 border-white/5 hover:bg-white/10'
                }`}
              >
                <div className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                  {lang === 'bn' ? `${milestone.day}ম দিন` : `Day ${milestone.day}`}
                </div>
                <div className="text-xs sm:text-sm font-bold mt-0.5 truncate">
                  {milestone.chlorophyllSpad} SPAD
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart: Chlorophyll & Tissue Healing Dynamics */}
      <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/5 space-y-3 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>{lang === 'bn' ? 'ক্লোরোফিল সূচক ও ক্ষত নিরাময় বক্ররেখা' : 'Chlorophyll Rebound & Tissue Restoration Curve'}</span>
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Chlorophyll (SPAD)
            </span>
            <span className="flex items-center gap-1 text-teal-300">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
              Tissue Healing (%)
            </span>
          </div>
        </div>

        <div className="h-[200px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="chloroGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="healingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.4} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#090d16', 
                  border: '1px solid rgba(16, 185, 129, 0.4)', 
                  borderRadius: '16px',
                  color: '#fff',
                  fontSize: '12px'
                }} 
              />
              <Area type="monotone" dataKey="chlorophyll" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#chloroGradient)" />
              <Area type="monotone" dataKey="healing" stroke="#2dd4bf" strokeWidth={2} fillOpacity={1} fill="url(#healingGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Selected Day Clinical Detail Box */}
      <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-2 relative z-10 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <strong className="text-emerald-300 font-bold text-sm">
            {lang === 'bn' ? currentMilestone.labelBn : currentMilestone.labelEn}
          </strong>
        </div>

        <p className="text-stone-300 leading-relaxed pl-6">
          {lang === 'bn' ? currentMilestone.descriptionBn : currentMilestone.descriptionEn}
        </p>

        <div className="pl-6 pt-1 text-[11px] text-emerald-200 font-mono flex items-center gap-1.5">
          <span className="font-bold uppercase tracking-wider text-emerald-400">Action Plan:</span>
          <span>{lang === 'bn' ? currentMilestone.actionItemBn : currentMilestone.actionItemEn}</span>
        </div>
      </div>

    </div>
  );
}

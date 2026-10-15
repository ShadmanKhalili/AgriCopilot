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
  ChevronRight,
  Camera,
  Plus,
  Trash2,
  Check,
  UserCheck,
  Image as ImageIcon,
  X,
  FileCheck
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
      actionItemBn: 'পাতার সতেজতা ও স্বাভাবিক বৃদ্ধি পর্যবেক্ষণ করুন। ফসল উত্তোলনের পূর্বে গাছ সুস্থ আছে কিনা নিশ্চিত করুন।',
      actionItemEn: 'Inspect foliage for sustained vigor recovery. Confirm healthy leaf canopy before routine harvesting.',
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
      labelBn: '১৪শ দিন: নির্দেশিত পিএইচআই সময়সীমা',
      labelEn: 'Day 14: Standard PHI Interval',
      chlorophyllSpad: 52,
      lesionHaltingPct: 100,
      tissueHealingPct: 100,
      descriptionBn: 'স্ট্যান্ডার্ড প্রাক-ফসল অপেক্ষমাণ সময়সীমা (PHI) অতিক্রান্ত। ফসল কর্তন ও বাজারজাতকরণের পূর্বে স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।',
      descriptionEn: 'Standard Pre-Harvest Interval (PHI) elapsed. Consult local extension officer to verify safe harvest clearance.',
      actionItemBn: 'স্থানীয় উপ-সহকারী কৃষি কর্মকর্তার সাথে পরামর্শ করে ফসল তোলার উপযুক্ততা নিশ্চিত করুন।',
      actionItemEn: 'Verify produce maturity and safe handling protocols before dispatch.',
      leafStatus: 'restored'
    }
  ]
};

export interface FarmerObservation {
  id: string;
  actionTaken: string;
  actionDate: string;
  whatChanged: string;
  photoUrl?: string;
  expertReviewed: boolean;
  expertNotes?: string;
}

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

  // Interactive Farmer Field Observation Log
  const [observations, setObservations] = useState<FarmerObservation[]>([
    {
      id: 'obs-init-1',
      actionTaken: lang === 'bn' ? 'আক্রান্ত পাতা ছাঁটাই ও ট্রাইকোডার্মা জৈব স্প্রে' : 'Sanitation pruning of infected leaves & botanical bio-inoculation',
      actionDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
      whatChanged: lang === 'bn' ? 'ক্ষতের কিনারা শুকিয়ে গেছে; নতুন কুঁড়িতে সংক্রমণ নেই' : 'Lesion margins dried out; emerging shoots appear healthy green',
      expertReviewed: false
    }
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newChange, setNewChange] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);

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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setNewPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.trim() || !newChange.trim()) return;

    audioFeedback.playTactileClick();
    const entry: FarmerObservation = {
      id: `obs-${Date.now()}`,
      actionTaken: newAction.trim(),
      actionDate: newDate,
      whatChanged: newChange.trim(),
      photoUrl: newPhotoUrl || undefined,
      expertReviewed: false
    };

    setObservations(prev => [entry, ...prev]);
    setNewAction('');
    setNewChange('');
    setNewPhotoUrl(null);
    setShowAddForm(false);
  };

  const handleDeleteObservation = (id: string) => {
    audioFeedback.playTactileClick();
    setObservations(prev => prev.filter(o => o.id !== id));
  };

  const handleToggleExpertReview = (id: string) => {
    audioFeedback.playTactileClick();
    setObservations(prev => prev.map(o => {
      if (o.id === id) {
        return {
          ...o,
          expertReviewed: !o.expertReviewed,
          expertNotes: !o.expertReviewed ? (lang === 'bn' ? 'উপ-সহকারী কৃষি কর্মকর্তা কর্তৃক সরেজমিনে পর্যবেক্ষিত' : 'Verified by Sub-Assistant Agriculture Officer') : undefined
        };
      }
      return o;
    }));
  };

  return (
    <div className="bg-gradient-to-br from-stone-950 via-[#0a150e] to-stone-900 border border-emerald-500/30 text-white rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden space-y-6">
      
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-teal-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Header: Transparent Illustrative Guide Branding */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl shadow-lg shadow-emerald-900/40 text-white shrink-0">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                {lang === 'bn' ? 'সম্ভাব্য সুস্থতার নির্দেশিকা' : 'ILLUSTRATIVE RECOVERY GUIDE'}
              </span>
              <span className="text-[10px] font-mono text-stone-400">
                {cropName} • {diseaseName}
              </span>
            </div>
            <h3 className="font-display font-black text-lg sm:text-xl text-white tracking-tight uppercase">
              {lang === 'bn' ? 'উদ্ভিদ নিরাময়ের সম্ভাব্য নির্দেশিকা ও পর্যবেক্ষণ খতিয়ান' : 'Illustrative Plant Recovery Guide & Field Log'}
            </h3>
            <p className="text-xs text-stone-300 mt-0.5">
              {lang === 'bn' 
                ? 'তাত্ত্বিক ক্লোরোফিল পুনরুজ্জীবন ও ক্ষত শুকানোর পর্যায়ক্রমিক রূপরেখা' 
                : 'Theoretical projection of foliar chlorophyll rebound and standard recovery timeline'}
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
            <span>{lang === 'bn' ? 'রাসায়নিক মডেল' : 'Chemical Rx Model'}</span>
          </button>
        </div>
      </div>

      {/* Transparency Disclaimer Banner */}
      <div className="relative z-10 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-amber-300">
            {lang === 'bn' ? 'তাত্ত্বিক নির্দেশনামূলক মডেল (Illustrative Guide) • প্রকৃত পরিমাপ নয়' : 'Illustrative Scenario Model • Not a Measured Outcome'}
          </p>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            {lang === 'bn' 
              ? 'উপরের গ্রাফ ও সূচকগুলো উদ্ভিদের স্বাভাবিক শারীরবৃত্তীয় রূপরেখা প্রদর্শন করে, এটি সরাসরি সেন্সরে পরিমাপকৃত ফলাফল নয়। বাস্তব অগ্রগতি ও ফলো-আপ নিশ্চিত করতে নিচের পর্যবেক্ষণ খতিয়ানে মাঠের প্রকৃত তথ্য ও ছবি সংরক্ষণ করুন।' 
              : 'These projections and charts illustrate standard plant pathology recovery dynamics rather than measured field outcomes. To track actual crop recovery, record your genuine field observations in the log below.'}
          </p>
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
              ? (lang === 'bn' ? 'জৈব পদ্ধতি • রাসায়নিক অবশিষ্টাংশ নেই' : 'Organic pathway • No synthetic residue')
              : (lang === 'bn' ? 'স্ট্যান্ডার্ড পিএইচআই নির্দেশিকা' : 'Standard Pre-Harvest Interval (PHI)')}
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

      {/* Interactive Farmer Field Observation Log (Actual Farmer Outcomes & Evidence) */}
      <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white flex items-center gap-2">
                <span>{lang === 'bn' ? 'মাঠের পর্যবেক্ষণ খতিয়ান (বাস্তব ফলাফল)' : 'Farmer Field Observation Log (Empirical Outcomes)'}</span>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {observations.length} {lang === 'bn' ? 'রেকর্ড' : 'Entries'}
                </span>
              </h4>
              <p className="text-[11px] text-stone-400">
                {lang === 'bn' 
                  ? 'কী পদক্ষেপ নিয়েছেন, কবে, কী দৃশ্যমান পরিবর্তন দেখেছেন ও ফলো-আপ ছবি যোগ করুন' 
                  : 'Track actual actions taken, dates, visual symptom changes, and follow-up photos'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              audioFeedback.playTactileClick();
              setShowAddForm(!showAddForm);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-sm active:scale-95"
          >
            {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{showAddForm ? (lang === 'bn' ? 'বাতিল' : 'Cancel') : (lang === 'bn' ? 'পর্যবেক্ষণ যোগ করুন' : 'Add Entry')}</span>
          </button>
        </div>

        {/* Add Observation Form */}
        {showAddForm && (
          <form onSubmit={handleAddObservation} className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 space-y-3.5 text-xs">
            <div className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'নতুন মাঠ পর্যবেক্ষণ লিপিবদ্ধ করুন' : 'Log New Field Observation'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-stone-300 uppercase mb-1">
                  {lang === 'bn' ? 'কী পদক্ষেপ নিয়েছেন? (Action Taken)' : 'Action Taken'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'bn' ? 'যেমন: ক্ষতিগ্রস্ত পাতা ছাঁটাই, ট্রাইকোডার্মা স্প্রে...' : 'e.g., Cultural pruning, botanical spray...'}
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-stone-300 uppercase mb-1">
                  {lang === 'bn' ? 'তারিখ (Date)' : 'Date'}
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-stone-300 uppercase mb-1">
                {lang === 'bn' ? 'কী দৃশ্যমান পরিবর্তন দেখেছেন? (Visual Symptoms Observed)' : 'Visual Symptom Change Observed'}
              </label>
              <textarea
                required
                rows={2}
                placeholder={lang === 'bn' ? 'যেমন: পাতার দাগ শুকিয়ে বাদামী হয়েছে, নতুন কচি কুঁড়িতে সংক্রমণ নেই...' : 'e.g., Lesion margins dry and halted; new shoots emerging green...'}
                value={newChange}
                onChange={(e) => setNewChange(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-400 text-xs resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors">
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{newPhotoUrl ? (lang === 'bn' ? 'ছবি পরিবর্তিত হয়েছে' : 'Photo Attached') : (lang === 'bn' ? 'ফলো-আপ ছবি তুলুন' : 'Attach Photo')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                {newPhotoUrl && (
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-emerald-400 shrink-0">
                    <img src={newPhotoUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewPhotoUrl(null)}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all self-end sm:self-auto cursor-pointer"
              >
                {lang === 'bn' ? 'রেকর্ড সংরক্ষণ করুন' : 'Save Observation'}
              </button>
            </div>
          </form>
        )}

        {/* Observation Log Entries List */}
        <div className="space-y-2.5">
          {observations.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-xs border border-dashed border-white/10 rounded-2xl">
              {lang === 'bn' ? 'এখনও কোনো পর্যবেক্ষণ রেকর্ড করা হয়নি।' : 'No empirical field observations recorded yet.'}
            </div>
          ) : (
            observations.map(obs => (
              <div 
                key={obs.id}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all text-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-stone-400 bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800">
                        {obs.actionDate}
                      </span>
                      <strong className="text-white text-xs">{obs.actionTaken}</strong>
                    </div>
                    <p className="text-stone-300 pl-1 text-[11px] leading-relaxed">
                      {obs.whatChanged}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleExpertReview(obs.id)}
                      title={lang === 'bn' ? 'বিশেষজ্ঞ যাচাই স্ট্যাটাস টগল করুন' : 'Toggle expert review'}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        obs.expertReviewed
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs'
                          : 'bg-stone-800/80 text-stone-400 border-white/10 hover:text-stone-200'
                      }`}
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>{obs.expertReviewed ? (lang === 'bn' ? 'বিশেষজ্ঞ পর্যালোচিত' : 'Expert Reviewed') : (lang === 'bn' ? 'পর্যালোচনা পেন্ডিং' : 'Review Pending')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteObservation(obs.id)}
                      className="p-1 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Optional Attached Follow-up Photo */}
                {obs.photoUrl && (
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-[10px] text-stone-400 font-mono flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-emerald-400" />
                      {lang === 'bn' ? 'সংযুক্ত ছবি:' : 'Follow-up Photo:'}
                    </span>
                    <a 
                      href={obs.photoUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-block w-12 h-12 rounded-lg overflow-hidden border border-emerald-500/40 hover:opacity-90 transition-opacity"
                    >
                      <img src={obs.photoUrl} alt="Follow-up observation" className="w-full h-full object-cover" />
                    </a>
                  </div>
                )}

                {obs.expertNotes && (
                  <div className="text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{obs.expertNotes}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

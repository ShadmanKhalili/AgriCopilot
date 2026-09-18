import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Award, TrendingUp, Calendar, MapPin, Sprout, FileText, 
  Printer, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Layers, 
  PhoneCall, Video, CloudRain, QrCode, ArrowRight, ExternalLink, HelpCircle, 
  ChevronDown, ChevronUp, UserCheck, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { 
  FarmerProfileData, 
  FarmerTimelineEventData, 
  fetchFarmerProfile, 
  fetchFarmerTimeline, 
  seedDemoFarmerProfile 
} from '../utils/farmerProfiler';
import { Language } from '../utils/translations';
import toast from 'react-hot-toast';

interface Props {
  lang: Language;
  onNavigateToTab?: (tab: string) => void;
}

export default function FarmerDossier({ lang, onNavigateToTab }: Props) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<FarmerProfileData | null>(null);
  const [timeline, setTimeline] = useState<FarmerTimelineEventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  const effectiveUid = user?.uid || 'guest_farmer_demo';
  const effectiveName = user?.displayName || 'আব্দুল করিম (Abdul Karim)';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const p = await fetchFarmerProfile(effectiveUid);
      const t = await fetchFarmerTimeline(effectiveUid);
      setProfile(p);
      setTimeline(t);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveUid]);

  const handleSimulateDemo = async () => {
    setIsSeeding(true);
    try {
      const updated = await seedDemoFarmerProfile(effectiveUid, effectiveName);
      const t = await fetchFarmerTimeline(effectiveUid);
      setProfile(updated);
      setTimeline(t);
      toast.success(lang === 'bn' ? 'সফলভাবে ৪টি সেশনের অগ্রগতি প্রোফাইলে যুক্ত হয়েছে!' : 'Simulated 4 farm sessions successfully!');
    } catch (error) {
      console.error(error);
      toast.error(lang === 'bn' ? 'সিমুলেশন ব্যর্থ হয়েছে।' : 'Simulation failed.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
    if (score >= 55) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
  };

  const getEventIcon = (type: FarmerTimelineEventData['eventType']) => {
    switch (type) {
      case 'voice_consultation':
        return <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'crop_diagnosis':
        return <Sprout className="w-4 h-4 text-lime-600 dark:text-lime-400" />;
      case 'weather_alert':
        return <CloudRain className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />;
      case 'smart_grading':
        return <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'planting_intent':
        return <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  const getEventBadge = (type: FarmerTimelineEventData['eventType']) => {
    switch (type) {
      case 'voice_consultation':
        return lang === 'bn' ? 'লাইভ সেশন ও পরামর্শ' : 'Live Consultation';
      case 'crop_diagnosis':
        return lang === 'bn' ? 'ছবি ও রোগ বিশ্লেষণ' : 'Crop Diagnosis';
      case 'weather_alert':
        return lang === 'bn' ? 'আবহাওয়া ঝুঁকি প্রতিরোধ' : 'Weather Advisory';
      case 'smart_grading':
        return lang === 'bn' ? 'ফসলের মান সনদ' : 'Quality Grading';
      case 'planting_intent':
        return lang === 'bn' ? 'পরবর্তী ফসল পরিকল্পনা' : 'Planting Intent';
      default:
        return lang === 'bn' ? 'কার্যক্রম' : 'Activity';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Banner / Explanation */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-700/40">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider border border-emerald-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'ডিজিটাল কৃষক প্রোফাইল' : 'Digital Farmer Profile'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {lang === 'bn' ? 'স্মার্ট কৃষি কার্ড ও ডিজিটাল ক্রেডিট প্রোফাইল' : 'Smart Krishi Card & Farmer Credit Dossier'}
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed">
              {lang === 'bn' 
                ? 'প্রতিটি লাইভ ভিডিও পরামর্শ, ফসলের ছবি আপলোড ও আবহাওয়া সতর্কতা অনুসরণের মাধ্যমে কৃষকের প্রোফাইল ধাপে ধাপে স্বয়ংক্রিয়ভাবে সমৃদ্ধ হয় — যা কৃষিঋণ ও শস্য বীমা পেতে সহায়তা করে।'
                : 'After every live consultation, image upload, and weather alert, the system automatically builds the farmer profile—unlocking collateral-free bank loans and index crop insurance.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSimulateDemo}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
              {lang === 'bn' ? 'ডেমো ইতিহাস সিমুলেট করুন' : 'Simulate 4 Sessions'}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm backdrop-blur-md border border-white/20 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {lang === 'bn' ? 'প্রিন্ট / ডসিয়ার ডাউনলোড' : 'Print Bank Dossier'}
            </button>
          </div>
        </div>
      </div>

      {/* Digital Farmer Card ("স্মার্ট কৃষক কার্ড") */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: The Digital Krishi ID Card */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-800 via-teal-900 to-emerald-950 text-white p-6 sm:p-7 shadow-2xl border-2 border-emerald-500/40">
            {/* Card Watermark */}
            <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
              <Sprout className="w-48 h-48 text-white" />
            </div>

            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-emerald-600/40 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold">
                  🌾
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-widest text-emerald-300 font-semibold">
                    {lang === 'bn' ? 'গণপ্রজাতন্ত্রী বাংলাদেশ' : 'Govt. of Bangladesh Verified'}
                  </h3>
                  <p className="text-base font-bold text-white tracking-wide">
                    {lang === 'bn' ? 'স্মার্ট কৃষক পরিচয়পত্র' : 'Smart Krishi Digital ID'}
                  </p>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-[11px] font-bold text-emerald-200">
                {profile?.insuranceRiskTier === 'Low' ? 'GRADE A' : 'GRADE B+'}
              </div>
            </div>

            {/* Farmer Core Data */}
            <div className="space-y-4 text-sm relative z-10">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'কৃষকের নাম' : 'Farmer Name'}
                  </p>
                  <p className="text-lg font-bold text-white tracking-wide">
                    {profile?.fullName || effectiveName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'কৃষি আইডি' : 'Krishi ID'}
                  </p>
                  <p className="font-mono text-xs font-semibold text-emerald-200">
                    BD-KRISHI-{effectiveUid.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-700/40">
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'প্রধান ফসল' : 'Primary Crop'}
                  </p>
                  <p className="font-semibold text-white">
                    {profile?.primaryCrop || 'আমন ধান (Aman Rice)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'মোট জমি' : 'Cultivated Land'}
                  </p>
                  <p className="font-semibold text-white">
                    {profile?.totalLandDecimals || 66} {lang === 'bn' ? 'শতক (২ বিঘা)' : 'decimals (~2 Bighas)'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'অবস্থান' : 'Location'}
                  </p>
                  <p className="font-semibold text-white text-xs">
                    {profile?.locationUpazila || 'চকরিয়া'}, {profile?.locationDistrict || 'কক্সবাজার'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'মাটি ও সেচ' : 'Soil & Irrigation'}
                  </p>
                  <p className="font-semibold text-white text-xs">
                    {profile?.soilType?.split('(')[0] || 'পলি দোআঁশ'}
                  </p>
                </div>
              </div>

              {/* Card Footer: Micro-QR and Security Code */}
              <div className="pt-4 mt-2 border-t border-emerald-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white rounded-lg">
                    <QrCode className="w-9 h-9 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-200 font-mono">
                      ENCRYPTED AGRICULTURAL DOSSIER
                    </p>
                    <p className="text-[10px] text-emerald-300/70">
                      {lang === 'bn' ? 'ব্যাংক ও বীমা অনুমোদিত' : 'Bank & Insurance Validated'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'যাচাইকৃত প্রোফাইল' : 'Verified Profile'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Pill Grid */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <Video className="w-3.5 h-3.5 text-emerald-600" />
                {lang === 'bn' ? 'লাইভ সেশন সম্পন্ন' : 'Live Consultations'}
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {profile?.totalSessionsCompleted || 1} {lang === 'bn' ? 'টি' : ''}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                {lang === 'bn' ? '+৮ ক্রেডিট পয়েন্ট প্রতি সেশনে' : '+8 points per session'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <Sprout className="w-3.5 h-3.5 text-lime-600" />
                {lang === 'bn' ? 'রোগ নির্ণয় লগ' : 'Disease Scans'}
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {profile?.totalDiagnoses || 2} {lang === 'bn' ? 'টি' : ''}
              </p>
              <p className="text-[11px] text-lime-600 dark:text-lime-400 mt-0.5">
                {lang === 'bn' ? 'নিরাময় পরামর্শ সংরক্ষিত' : 'Mitigation verified'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Credit Score & Underwriting Eligibility */}
        <div className="lg:col-span-7 space-y-6">
          {/* Credit Readiness Dial & Loan Eligibility */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  <DollarSign className="w-3.5 h-3.5" />
                  {lang === 'bn' ? 'কৃষিঋণ ও বীমা যোগ্যতা স্কোর' : 'Credit & Insurance Scoring'}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {lang === 'bn' ? 'ডিজিটাল ক্রেডিট রেডিনেস স্কোর' : 'Digital Credit Readiness Score'}
                </h2>
              </div>

              {/* Numerical Score Box */}
              <div className={`px-5 py-3 rounded-2xl border flex items-baseline gap-2 ${getScoreColor(profile?.creditReadinessScore || 78)}`}>
                <span className="text-3xl sm:text-4xl font-black tracking-tight">
                  {profile?.creditReadinessScore || 78}
                </span>
                <span className="text-sm font-semibold opacity-70">/ ১০০</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(10, profile?.creditReadinessScore || 78))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>{lang === 'bn' ? 'প্রাথমিক (০-৫০)' : 'Baseline (0-50)'}</span>
                <span>{lang === 'bn' ? 'ঋণযোগ্য (৫৫-৭৪)' : 'Loan Eligible (55-74)'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{lang === 'bn' ? 'প্রিমিয়াম প্রাক-অনুমোদিত (৭৫+)' : 'Pre-Approved (75+)'}</span>
              </div>
            </div>

            {/* Financial Institution Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {lang === 'bn' ? 'বাংলাদেশ কৃষি ব্যাংক ঋণ যোগ্যতা' : 'BKB Micro-Loan Eligibility'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn' 
                    ? 'জামানতবিহীন ৳১,৫০,০০০ টাকা পর্যন্ত ফসল ঋণ প্রাক-অনুমোদিত।' 
                    : 'Pre-approved for collateral-free crop loans up to ৳150,000.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/50">
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  {lang === 'bn' ? 'প্যারামেট্রিক ফসল বীমা' : 'Parametric Crop Insurance'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn' 
                    ? 'ঝড়-জলাবদ্ধতা ও বালাই আক্রমণে স্বয়ংক্রিয় ক্ষতিপূরণ পলিসি সক্রিয়।' 
                    : 'Active parametric protection against flood, cyclone, and pest outbreaks.'}
                </p>
              </div>
            </div>

            {/* Synthesized Agricultural Facts */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {lang === 'bn' ? 'এআই দ্বারা সংকলিত পর্যবেক্ষণ ও খামারের বৈশিষ্ট্য' : 'AI-Compiled Farm Insights'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(profile?.keyInsights || [
                  'নিয়মিত ট্রাইকোডার্মা ও জৈব বালাইনাশক ব্যবহারে আগ্রহী',
                  'আবহাওয়ার পূর্বাভাস দেখে আগাম নিষ্কাশন ড্রেন প্রস্তুত করেছেন',
                  'আমন ধান ছাড়াও রবি মৌসুমে উচ্চ মূল্যের তরমুজ উৎপাদনে সক্ষম'
                ]).map((insight, idx) => (
                  <span 
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {insight}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chronological Progressive Interaction Timeline */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Layers className="w-4 h-4" />
              {lang === 'bn' ? 'কার্যক্রম ও ইন্টারঅ্যাকশন ইতিহাস' : 'Progressive Interaction History'}
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {lang === 'bn' ? 'ধাপে ধাপে তৈরি হওয়া খামার টাইমলাইন' : 'Compounding Agricultural Timeline'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {timeline.length} {lang === 'bn' ? 'টি যাচাইকৃত সেশন ও রেকর্ড' : 'verified session events'}
          </p>
        </div>

        {timeline.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                {lang === 'bn' ? 'এখনও কোনো ইন্টারঅ্যাকশন রেকর্ড নেই' : 'No recorded interactions yet'}
              </p>
              <p className="text-xs text-slate-500">
                {lang === 'bn' 
                  ? 'লাইভ সেশন শেষ হলে বা ফসলের ছবি দিলে তা এখানে স্বয়ংক্রিয়ভাবে ক্রেডিট প্রোফাইলে যুক্ত হবে।' 
                  : 'Start a live consultation or upload a crop photo to automatically log events.'}
              </p>
            </div>
            <button
              onClick={handleSimulateDemo}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'ডেমো ইতিহাস লোড করুন' : 'Load Demo History'}
            </button>
          </div>
        ) : (
          <div className="relative border-l-2 border-emerald-100 dark:border-emerald-900/60 ml-4 sm:ml-6 space-y-8">
            {timeline.map((event, idx) => (
              <div key={event.id || idx} className="relative pl-6 sm:pl-8 group">
                {/* Node marker on the line */}
                <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-emerald-500 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {getEventIcon(event.eventType)}
                </div>

                {/* Event Card */}
                <div className="p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                        {getEventBadge(event.eventType)}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                        {event.title}
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(event.createdAt).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {event.summary}
                  </p>

                  {/* Extracted Key Facts Tags */}
                  {event.keyFacts && event.keyFacts.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      {event.keyFacts.map((fact, fIdx) => (
                        <span 
                          key={fIdx}
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        >
                          ✓ {fact}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Printable Bank Dossier Template (Rendered only on print or clean preview) */}
      <div className="hidden print:block print:p-8 bg-white text-slate-900 font-sans">
        <div className="border-b-2 border-emerald-800 pb-4 mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">
              ডিজিটাল কৃষক ক্রেডিট ও ফসল বীমা যাচাইকরণ ডসিয়ার
            </h1>
            <p className="text-xs text-slate-600">
              Government of Bangladesh Verified Digital Farm Record & Underwriting Dossier
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs">ID: BD-KRISHI-{effectiveUid.substring(0, 8).toUpperCase()}</p>
            <p className="text-xs text-slate-500">তারিখ: {new Date().toLocaleDateString('bn-BD')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6 border p-4 rounded-lg">
          <div>
            <p><strong>কৃষকের নাম:</strong> {profile?.fullName || effectiveName}</p>
            <p><strong>ঠিকানা:</strong> {profile?.locationUpazila || 'চকরিয়া'}, {profile?.locationDistrict || 'কক্সবাজার'}</p>
            <p><strong>প্রধান ফসল:</strong> {profile?.primaryCrop || 'আমন ধান'}</p>
          </div>
          <div>
            <p><strong>চাষযোগ্য জমি:</strong> {profile?.totalLandDecimals || 66} শতক</p>
            <p><strong>ক্রেডিট স্কোর:</strong> {profile?.creditReadinessScore || 78} / ১০০ (প্রাক-অনুমোদিত)</p>
            <p><strong>বীমা ঝুঁকি রেটিং:</strong> {profile?.insuranceRiskTier || 'Low Risk'}</p>
          </div>
        </div>

        <h3 className="font-bold text-base mb-2 border-b pb-1">কার্যক্রম ও ইন্টারঅ্যাকশন ইতিহাস</h3>
        <div className="space-y-3 mb-8">
          {timeline.slice(0, 4).map((e, i) => (
            <div key={i} className="text-xs border-b pb-2">
              <p className="font-bold">{e.title} ({new Date(e.createdAt).toLocaleDateString('bn-BD')})</p>
              <p className="text-slate-600">{e.summary}</p>
              <p className="text-emerald-700">{e.keyFacts.join(' • ')}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-end pt-12 border-t text-xs">
          <div className="text-center">
            <div className="w-32 border-b border-black mb-1 mx-auto" />
            <p>উপজেলা কৃষি কর্মকর্তা স্বাক্ষর</p>
          </div>
          <div className="text-center">
            <div className="w-32 border-b border-black mb-1 mx-auto" />
            <p>ব্যাংক ঋণ কর্মকর্তা স্বাক্ষর</p>
          </div>
          <div className="text-center">
            <div className="w-32 border-b border-black mb-1 mx-auto" />
            <p>বীমা প্রতিনিধি স্বাক্ষর</p>
          </div>
        </div>
      </div>
    </div>
  );
}

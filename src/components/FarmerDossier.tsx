import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Award, TrendingUp, Calendar, MapPin, Sprout, FileText, 
  Printer, CheckCircle2, AlertTriangle, Sparkles, RefreshCw, Layers, 
  PhoneCall, Video, CloudRain, QrCode, ArrowRight, ExternalLink, HelpCircle, 
  ChevronDown, ChevronUp, UserCheck, DollarSign, Edit3, Trash2, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './AuthProvider';
import { 
  FarmerProfileData, 
  FarmerTimelineEventData, 
  fetchFarmerProfile, 
  fetchFarmerTimeline, 
  seedDemoFarmerProfile,
  updateFarmerProfileManual,
  resetFarmerProfile,
  calculateCreditScore
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [assistedRouteMode, setAssistedRouteMode] = useState<'self' | 'saao'>('self');
  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealForm, setAppealForm] = useState({
    subject: 'land_decimals',
    explanation: '',
    proposedCorrection: ''
  });
  const [editForm, setEditForm] = useState({
    fullName: '',
    primaryCrop: '',
    totalLandDecimals: 0,
    locationDistrict: '',
    locationUpazila: '',
    soilType: ''
  });

  const effectiveUid = user?.uid || 'guest_farmer_demo';
  const effectiveName = user?.displayName || profile?.fullName || '';

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
      const updated = await seedDemoFarmerProfile(effectiveUid, effectiveName || (lang === 'bn' ? 'আব্দুল করিম' : 'Abdul Karim'));
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

  const openEditModal = () => {
    setEditForm({
      fullName: profile?.fullName || '',
      primaryCrop: profile?.primaryCrop || '',
      totalLandDecimals: profile?.totalLandDecimals || 0,
      locationDistrict: profile?.locationDistrict || '',
      locationUpazila: profile?.locationUpazila || '',
      soilType: profile?.soilType || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateFarmerProfileManual(effectiveUid, {
        fullName: editForm.fullName.trim(),
        primaryCrop: editForm.primaryCrop.trim(),
        totalLandDecimals: Number(editForm.totalLandDecimals) || 0,
        locationDistrict: editForm.locationDistrict.trim(),
        locationUpazila: editForm.locationUpazila.trim(),
        soilType: editForm.soilType.trim()
      });
      setProfile(updated);
      setIsEditModalOpen(false);
      toast.success(lang === 'bn' ? 'খামারের তথ্য সফলভাবে সংরক্ষিত হয়েছে!' : 'Farm profile saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'তথ্য সংরক্ষণে সমস্যা হয়েছে।' : 'Failed to save farm profile.');
    }
  };

  const handleResetProfile = async () => {
    if (!window.confirm(lang === 'bn' 
      ? 'আপনি কি নিশ্চিত যে সকল রেকর্ড মুছে ফেলে প্রোফাইল খালি করতে চান?' 
      : 'Are you sure you want to clear all profile records and start fresh?')) {
      return;
    }
    try {
      const empty = await resetFarmerProfile(effectiveUid);
      setProfile(empty);
      setTimeline([]);
      toast.success(lang === 'bn' ? 'প্রোফাইল সফলভাবে রিসেট করা হয়েছে।' : 'Profile cleared successfully.');
    } catch (err) {
      console.error(err);
      toast.error(lang === 'bn' ? 'রিসেট ব্যর্থ হয়েছে।' : 'Failed to reset profile.');
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

  const [showAuditFramework, setShowAuditFramework] = useState(false);

  const creditAnalysis = calculateCreditScore({
    totalSessionsCompleted: profile?.totalSessionsCompleted || 0,
    totalDiagnoses: profile?.totalDiagnoses || 0,
    cropsCount: profile?.cropsGrown?.length || (profile?.primaryCrop ? 1 : 0),
    hasLandData: Boolean(profile?.totalLandDecimals && profile.totalLandDecimals > 0),
    hasLocationData: Boolean(profile?.locationDistrict || profile?.locationUpazila),
    hasSoilOrIrrigation: Boolean(profile?.soilType || profile?.irrigationType),
    hasCertificates: timeline.some(t => t.eventType === 'smart_grading') || (profile?.creditReadinessScore || 0) > 65,
    hasWeatherAction: timeline.some(t => t.eventType === 'weather_alert'),
    totalEventsCount: timeline.length
  });

  const currentScore = profile?.creditReadinessScore ?? creditAnalysis.score;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Banner / Explanation */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-700/40">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider border border-emerald-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'প্রকৃত ব্যবহারের ভিত্তিতে সংকলিত প্রোফাইল' : 'Usage-Based Digital Dossier'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {lang === 'bn' ? 'স্মার্ট কৃষি কার্ড ও ডিজিটাল ক্রেডিট প্রোফাইল' : 'Smart Krishi Card & Farmer Credit Dossier'}
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/80 leading-relaxed">
              {lang === 'bn' 
                ? 'আপনার প্রতিটি লাইভ ভিডিও পরামর্শ, প্রশ্ন ও ফসলের ছবি স্ক্যান থেকে সংগৃহীত প্রকৃত তথ্যের ভিত্তিতে এই প্রোফাইল তৈরি হয় — কোনো কাল্পনিক বা ভিত্তিহীন তথ্য ছাড়া।'
                : 'Built strictly from your real live consultations, dialogue, and diagnostic scans without any fabricated or hallucinated data.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={openEditModal}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 font-bold text-xs sm:text-sm backdrop-blur-md transition-all cursor-pointer active:scale-95 shadow-sm"
              title={lang === 'bn' ? 'খামারের তথ্য সম্পাদনা করুন' : 'Edit Farm Profile'}
            >
              <Edit3 className="w-4 h-4 text-emerald-300" />
              {lang === 'bn' ? 'তথ্য সম্পাদনা' : 'Edit Details'}
            </button>
            <button
              onClick={handleResetProfile}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95"
              title={lang === 'bn' ? 'সকল রেকর্ড মুছে খালি করুন' : 'Reset All Records'}
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              {lang === 'bn' ? 'রিসেট' : 'Reset'}
            </button>
            <button
              onClick={handleSimulateDemo}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              {lang === 'bn' ? 'নমুনা লোড' : 'Demo Load'}
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm backdrop-blur-md border border-white/20 shadow-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {lang === 'bn' ? 'প্রিন্ট' : 'Print'}
            </button>
          </div>
        </div>
      </div>

      {/* Methodology Transparency Notice & Non-Automated Aid Policy */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs sm:text-sm">
            {lang === 'bn' 
              ? 'পদ্ধতিগত স্বচ্ছতা ও অ-স্বয়ংক্রিয় বরাদ্দ নির্দেশিকা (Transparency & Human Verification):' 
              : 'Methodology Transparency & Non-Automated Aid Policy:'}
          </p>
          <p className="leading-relaxed opacity-95 text-[11px] sm:text-xs">
            {lang === 'bn'
              ? 'এখানে প্রদর্শিত স্কোর ও উপাত্তগুলো সিদ্ধান্ত-সহায়ক প্রাক-বিশ্লেষণ। এটি সংবিধিবদ্ধ প্রমাণিত বরাদ্দ পদ্ধতি নয় এবং কোনো সাহায্য, বীজ বা ঋণ স্বয়ংক্রিয়ভাবে প্রদান করে না। যেকোনো সহায়তার ক্ষেত্রে উপজেলা কৃষি কর্মকর্তা ও মাঠ পর্যায়ের কৃষিবিদের শারীরিক যাচাই (Human Field Assessment) বাধ্যতামূলক। তথ্যের ঘাটতি বা কম অ্যাপ ব্যবহারের কারণে কোনো খামারির অগ্রাধিকার কমে না — বরং অগ্রাধিকারমূলক মাঠ যাচাই সক্রিয় হয়।'
              : 'The scores, indicators, and vulnerability models displayed are illustrative decision-support tools, NOT validated methodology for statutory or automated grant decisions. Software must never automatically allocate financial assistance or aid without human assessment by qualified field teams and agronomists. Missing data or low smartphone activity triggers field verification, not automated exclusion.'}
          </p>
        </div>
      </div>

      {/* Observation Channel Route: Direct Smartphone vs SAAO Assisted Route for Non-Smartphone Farmers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'তথ্য সংগ্রহ ও পর্যবেক্ষণ চ্যানেল' : 'Observation Collection Route'}
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            {assistedRouteMode === 'saao'
              ? (lang === 'bn' ? 'উপজেলা উপ-সহকারী কৃষি কর্মকর্তা (SAAO) সহায়তায় সংগৃহীত • স্মার্টফোনবিহীন খামারি অন্তর্ভুক্তকরণ' : 'Assisted Route: SAAO Field Agent (For Farmers Without Smartphones)')
              : (lang === 'bn' ? 'খামারি সম্মতিভিত্তিক সরাসরি স্মার্টফোন ব্যবহার' : 'Direct Consented Farmer Smartphone Mode')}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAssistedRouteMode('self')}
            className={`px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
              assistedRouteMode === 'self'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {lang === 'bn' ? 'সরাসরি খামারি' : 'Direct Farmer'}
          </button>
          <button
            type="button"
            onClick={() => setAssistedRouteMode('saao')}
            className={`px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all cursor-pointer ${
              assistedRouteMode === 'saao'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {lang === 'bn' ? 'মাঠ কর্মকর্তা সহায়তা (SAAO)' : 'Assisted SAAO Route'}
          </button>
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
                  <h2 className="text-sm uppercase tracking-wider text-emerald-300 font-semibold">
                    {lang === 'bn' ? 'সম্মতিভিত্তিক ডিজিটাল কৃষি ডসিয়ার' : 'Farmer-Consented Activity Dossier'}
                  </h2>
                  <p className="text-base font-bold text-white tracking-wide">
                    {lang === 'bn' ? 'স্মার্ট খামারি পরিচয় ও প্রামাণ্য রেকর্ড' : 'Smart Krishi Digital Record'}
                  </p>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/30 border border-emerald-400/50 text-[11px] font-bold text-emerald-200">
                {profile?.insuranceRiskTier === 'Low' ? 'GRADE A' : profile?.insuranceRiskTier === 'Moderate' ? 'GRADE B' : (lang === 'bn' ? 'মূল্যায়ন প্রক্রিয়াধীন' : 'Pending')}
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
                    {profile?.fullName || effectiveName || (lang === 'bn' ? 'তথ্য দেওয়া হয়নি' : 'Not Provided')}
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
                    {profile?.primaryCrop || (lang === 'bn' ? 'তথ্য নেই' : 'Not recorded')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'মোট জমি' : 'Cultivated Land'}
                  </p>
                  <p className="font-semibold text-white">
                    {profile?.totalLandDecimals ? `${profile.totalLandDecimals} ${lang === 'bn' ? 'শতক' : 'decimals'}` : (lang === 'bn' ? 'তথ্য নেই' : 'Not recorded')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'অবস্থান' : 'Location'}
                  </p>
                  <p className="font-semibold text-white text-xs">
                    {profile?.locationDistrict || profile?.locationUpazila 
                      ? [profile.locationUpazila, profile.locationDistrict].filter(Boolean).join(', ') 
                      : (lang === 'bn' ? 'তথ্য নেই' : 'Not recorded')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300/80 font-medium">
                    {lang === 'bn' ? 'মাটি ও সেচ' : 'Soil & Irrigation'}
                  </p>
                  <p className="font-semibold text-white text-xs">
                    {profile?.soilType ? profile.soilType.split('(')[0].trim() : (lang === 'bn' ? 'তথ্য নেই' : 'Not recorded')}
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
                    <p className="text-[11px] text-emerald-200 font-mono">
                      ENCRYPTED AGRICULTURAL DOSSIER
                    </p>
                    <p className="text-[11px] text-emerald-300/70">
                      {lang === 'bn' ? 'ব্যবহার-ভিত্তিক যাচাইকৃত' : 'Usage Verified Profile'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'প্রামাণ্য প্রোফাইল' : 'Verified Profile'}
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
                {lang === 'bn' ? 'লাইভ পরামর্শ সেশন' : 'Live Consultations'}
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {profile?.totalSessionsCompleted ?? 0} {lang === 'bn' ? 'টি' : ''}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                {lang === 'bn' ? '+৩ পয়েন্ট প্রতি সেশনে (সর্বোচ্চ ১২)' : '+3 pts/session (Max 12)'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                <Sprout className="w-3.5 h-3.5 text-lime-600" />
                {lang === 'bn' ? 'বালাই ও রোগ মনিটরিং' : 'Disease Surveillance'}
              </div>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                {profile?.totalDiagnoses ?? 0} {lang === 'bn' ? 'টি' : ''}
              </p>
              <p className="text-[11px] text-lime-600 dark:text-lime-400 mt-0.5">
                {lang === 'bn' ? '+৩ পয়েন্ট প্রতি স্ক্যানে (সর্বোচ্চ ১৩)' : '+3 pts/scan (Max 13)'}
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
                  {lang === 'bn' ? 'ব্যাংক-গ্রেড কৃষিঋণ ও বীমা স্কোরিং' : 'Bank-Grade Ag Credit Scoring'}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {lang === 'bn' ? 'ডিজিটাল ক্রেডিট রেডিনেস স্কোর' : 'Digital Credit Readiness Score'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {creditAnalysis.grade}
                </p>
              </div>

              {/* Numerical Score Box */}
              <div className={`px-5 py-3 rounded-2xl border flex items-baseline gap-2 ${getScoreColor(currentScore)}`}>
                <span className="text-3xl sm:text-4xl font-black tracking-tight">
                  {currentScore}
                </span>
                <span className="text-sm font-semibold opacity-70">/ ১০০</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(currentScore > 0 ? 5 : 0, currentScore))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                <span>{lang === 'bn' ? 'প্রাথমিক (০-৩৪)' : 'Tier 3 (0-34)'}</span>
                <span>{lang === 'bn' ? 'ইনপুট ঋণ (৩৫-৫৪)' : 'Tier 2 (35-54)'}</span>
                <span>{lang === 'bn' ? 'ঋণযোগ্য (৫৫-৭৪)' : 'Tier 1 (55-74)'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{lang === 'bn' ? 'প্রাক-অনুমোদিত (৭৫+)' : 'Tier 0 Prime (75+)'}</span>
              </div>
            </div>

            {/* 5-Pillar Breakdown Meter */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {lang === 'bn' ? '৫-স্তম্ভভিত্তিক স্কোর বিশ্লেষণ (৫ Cs of Credit)' : '5-Pillar Credit Evaluation Matrix'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAuditFramework(!showAuditFramework)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 min-h-[44px] cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  {showAuditFramework 
                    ? (lang === 'bn' ? 'সংক্ষেপ করুন' : 'Hide Audit Details') 
                    : (lang === 'bn' ? 'যাচাই পদ্ধতি দেখুন' : 'View Audit Framework')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
                    <span>🏛️ {lang === 'bn' ? 'জমির মালিকানা ও অবস্থান' : 'Land & Farm Provenance'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{creditAnalysis.pillars.farmProvenance}/২০</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(creditAnalysis.pillars.farmProvenance / 20) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
                    <span>🛡️ {lang === 'bn' ? 'পরামর্শ ও বালাই নজরদারি' : 'Advisory & Pest Diligence'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{creditAnalysis.pillars.surveillanceDiligence}/২৫</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(creditAnalysis.pillars.surveillanceDiligence / 25) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
                    <span>🌾 {lang === 'bn' ? 'ফসল বৈচিত্র্য ও সম্ভাব্যতা' : 'Crop Viability & Rotation'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{creditAnalysis.pillars.cropViability}/২০</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-lime-500 rounded-full" style={{ width: `${(creditAnalysis.pillars.cropViability / 20) * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
                    <span>🏅 {lang === 'bn' ? 'মান সনদ ও বাজার সংযোগ' : 'Quality Grading & Mandi'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{creditAnalysis.pillars.qualityAndMarket}/১৫</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(creditAnalysis.pillars.qualityAndMarket / 15) * 100}%` }} />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="flex justify-between text-slate-600 dark:text-slate-300 font-medium mb-1">
                    <span>🌦️ {lang === 'bn' ? 'জলবায়ু সতর্কতা ও দীর্ঘমেয়াদি রেকর্ড' : 'Climate Action & Longitudinal History'}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{creditAnalysis.pillars.longitudinalTrackRecord}/২০</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${(creditAnalysis.pillars.longitudinalTrackRecord / 20) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Expandable Stakeholder Audit Details */}
              <AnimatePresence>
                {showAuditFramework && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 space-y-2 text-xs leading-relaxed overflow-hidden"
                  >
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'bn' ? 'কেন এই স্কোরিং পদ্ধতি আর্থিক প্রতিষ্ঠান ও স্টেকহোল্ডারদের নিকট গ্রহণযোগ্য?' : 'Why this score is institutionally defensible & non-gameable:'}
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong>{lang === 'bn' ? 'অ্যান্টি-গেমিং ক্যাপিং:' : 'Anti-Gaming Caps:'}</strong> {lang === 'bn' ? 'একই দিনে বারবার ক্লিক বা কল করলে পয়েন্ট বাড়ে না। প্রতিটি স্তরের জন্য কঠোর সীমা নির্ধারিত রয়েছে।' : 'Repeated clicks within the same day are throttled. Every pillar has a strict mathematical ceiling.'}
                      </li>
                      <li>
                        <strong>{lang === 'bn' ? '৫টি নিরপেক্ষ স্তম্ভ:' : '5 Objective Pillars:'}</strong> {lang === 'bn' ? 'বাংলাদেশ ব্যাংকের কৃষিঋণ নীতিমালা ও এমআরএ (MRA) কাঠামোর সাথে সংগতিপূর্ণ।' : 'Aligned with Bangladesh Bank Agricultural Credit Policy & Microfinance Regulatory Authority (MRA) standards.'}
                      </li>
                      <li>
                        <strong>{lang === 'bn' ? 'প্রমাণিত ডাটাবেস:' : 'Verified Audit Trail:'}</strong> {lang === 'bn' ? 'প্রতিটি পয়েন্টের পেছনে টাইমলাইনে সংরক্ষিত রিয়েল-টাইম কনসালটেশন ও ডায়াগনসিস লগ রয়েছে।' : 'Every point earned is backed by timestamped consultations, diagnosis logs, and sensor/vision events in Firestore.'}
                      </li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Financial Institution & Program Evaluation (Indicative, Non-Statutory) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {lang === 'bn' ? 'বাংলাদেশ কৃষি ব্যাংক ঋণ উপাত্ত ভিত্তি' : 'BKB Micro-Loan Data Baseline'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {currentScore >= 75 ? (
                    lang === 'bn' 
                      ? 'ডকুমেন্টেশন প্রাক-যাচাইকৃত: শাখা ঋণ কর্মকর্তা ও মাঠ যাচাই সাপেক্ষে ৳১,৫০,০০০ টাকা পর্যন্ত ফসল ঋণ পর্যালোচনার উপযুক্ত।' 
                      : 'Documentation baseline met for up to ৳150,000 crop loan consideration (Subject to human branch verification; non-automated).'
                  ) : currentScore >= 55 ? (
                    lang === 'bn'
                      ? 'ক্ষুদ্র কৃষিঋণ পর্যালোচনার প্রাথমিক উপাত্ত সন্তোষজনক (৫০,০০০ টাকা সিলিং)।'
                      : 'Initial micro-agricultural credit review baseline met (৳50,000 ceiling).'
                  ) : currentScore >= 35 ? (
                    lang === 'bn'
                      ? 'বীজ ও সারের ইনপুট অর্থায়নের জন্য প্রাথমিক প্রোফাইল সক্রিয়।'
                      : 'Initial profile active for seasonal micro-input financing.'
                  ) : (
                    lang === 'bn'
                      ? 'ঋণ পর্যালোচনার জন্য জমি নিবন্ধন ও নিয়মিত লাইভ পরামর্শ রেকর্ড করুন।'
                      : 'Record land profiling & consultations to complete documentation baseline.'
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/50">
                <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  {lang === 'bn' ? 'প্যারামেট্রিক ফসল ঝুঁকি মূল্যায়ন' : 'Parametric Crop Risk Assessment'}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {currentScore >= 55 ? (
                    lang === 'bn' 
                      ? 'প্রাকৃতিক দুর্যোগ ঝুঁকি মানচিত্রায়ণ সক্রিয়; ক্ষতিপূরণ নির্ধারণের জন্য মাঠ টিম বা স্যাটেলাইট ট্রিগার প্রযোজ্য।' 
                      : 'Climate risk baseline mapped; payouts require certified satellite/field team verification.'
                  ) : (
                    lang === 'bn'
                      ? 'ঝুঁকি নিরসনে নিয়মিত খামার পর্যবেক্ষণ ও পরামর্শ গ্রহণ করুন।'
                      : 'Conduct regular farm observations to establish parametric baseline.'
                  )}
                </p>
              </div>
            </div>

            {/* Separated 4 Pillars of Proprietary Intelligence (Need, Eligibility, Intervention, Data Confidence) */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700/80 space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                  {lang === 'bn' ? '৪টি পৃথক বুদ্ধিমত্তা স্তর (Trustworthy Evidence System)' : '4 Separated Evidence Pillars'}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {lang === 'bn' ? 'স্বচ্ছ ও যাচাইযোগ্য' : 'Transparent & Verifiable'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Pillar 1: Need Assessment */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700">
                  <p className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>1️⃣</span> {lang === 'bn' ? 'প্রয়োজন মূল্যায়ন (Need)' : 'Need Assessment'}
                  </p>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                    {profile?.totalLandDecimals && profile.totalLandDecimals < 50
                      ? (lang === 'bn' ? 'উচ্চ অগ্রাধিকার: প্রান্তিক/ক্ষুদ্র খামারি (<৫০ শতক জমি)' : 'High Need: Marginal smallholder (<50 decimals)')
                      : (lang === 'bn' ? 'মাঝারি প্রয়োজন: স্বাভাবিক কৃষি জমিদারি' : 'Medium Need: Standard smallholder')}
                  </p>
                </div>

                {/* Pillar 2: Programme Eligibility */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700">
                  <p className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>2️⃣</span> {lang === 'bn' ? 'কর্মসূচি যোগ্যতা (Eligibility)' : 'Programme Eligibility'}
                  </p>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                    {lang === 'bn' 
                      ? 'স্বচ্ছ নির্দেশিকা ভিত্তিক • মানুষের সিদ্ধান্ত সাপেক্ষ (অ-স্বয়ংক্রিয় বরাদ্দ)' 
                      : 'Transparent rule-based • Human assessed (No automated aid grant)'}
                  </p>
                </div>

                {/* Pillar 3: Recommended Intervention */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700">
                  <p className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>3️⃣</span> {lang === 'bn' ? 'প্রস্তাবিত পদক্ষেপ (Intervention)' : 'Recommended Intervention'}
                  </p>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                    {lang === 'bn' 
                      ? 'উপজেলা কৃষি কর্মকর্তার সরেজমিন পরিদর্শন ও বালাই ব্যবস্থাপনা পরামর্শ' 
                      : 'SAAO Field inspection & stepped IPM pest advisory package'}
                  </p>
                </div>

                {/* Pillar 4: Data Confidence */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-700">
                  <p className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <span>4️⃣</span> {lang === 'bn' ? 'উপাত্তের নির্ভরযোগ্যতা (Confidence)' : 'Data Confidence Level'}
                  </p>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                    {timeline.length >= 3
                      ? (lang === 'bn' ? 'উচ্চ আস্থা: ৩+ যাচাইকৃত টাইমলাইন ইভেন্ট সংগৃহীত' : 'High Confidence: 3+ verified timeline records')
                      : (lang === 'bn' ? 'যাচাই প্রক্রিয়াধীন: তথ্যের ঘাটতি মাঠ পরিদর্শনকে সক্রিয় করে' : 'Verification Triggered: Missing data prompts field review')}
                  </p>
                </div>
              </div>

              {/* Exclusion Error Safeguard Notice */}
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-stone-200 dark:border-stone-700 text-[11px] text-stone-500 dark:text-stone-400">
                <span>
                  {lang === 'bn' 
                    ? '🛡️ বর্জন ত্রুটি প্রতিরোধ: তথ্যের ঘাটতি থাকলে কোনো খামারির অগ্রাধিকার কমে না; বরং মাঠ যাচাই সক্রিয় হয়।' 
                    : '🛡️ Exclusion Error Safeguard: Missing info triggers verification, never reduces priority.'}
                </span>

                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(true)}
                  className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline shrink-0 inline-flex items-center min-h-[44px] cursor-pointer"
                >
                  {lang === 'bn' ? 'তথ্য সংশোধন বা আপিল আবেদন ↗' : 'Request Correction or Appeal ↗'}
                </button>
              </div>
            </div>

            {/* Synthesized Agricultural Facts */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                {lang === 'bn' ? 'এআই দ্বারা সংকলিত পর্যবেক্ষণ ও খামারের বৈশিষ্ট্য' : 'AI-Compiled Farm Insights'}
              </p>
              <div className="flex flex-wrap gap-2">
                {profile?.keyInsights && profile.keyInsights.length > 0 ? (
                  profile.keyInsights.map((insight, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {insight}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    {lang === 'bn' 
                      ? 'এখনো কোনো পর্যবেক্ষণ যুক্ত হয়নি। পরামর্শ সেশন বা ছবি স্ক্যান শুরু করলে তথ্য স্বয়ংক্রিয়ভাবে লিপিবদ্ধ হবে।' 
                      : 'No farm insights logged yet. Complete a consultation or photo diagnosis to populate.'}
                  </p>
                )}
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
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === 'bn' ? 'নমুনা তথ্য লোড করুন' : 'Load Demo History'}
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
            <p><strong>কৃষকের নাম:</strong> {profile?.fullName || effectiveName || 'তথ্য দেওয়া হয়নি'}</p>
            <p><strong>ঠিকানা:</strong> {[profile?.locationUpazila, profile?.locationDistrict].filter(Boolean).join(', ') || 'তথ্য নেই'}</p>
            <p><strong>প্রধান ফসল:</strong> {profile?.primaryCrop || 'তথ্য নেই'}</p>
          </div>
          <div>
            <p><strong>চাষযোগ্য জমি:</strong> {profile?.totalLandDecimals ? `${profile.totalLandDecimals} শতক` : 'তথ্য নেই'}</p>
            <p><strong>ক্রেডিট স্কোর:</strong> {profile?.creditReadinessScore ?? 0} / ১০০ ({profile?.creditReadinessScore && profile.creditReadinessScore >= 75 ? 'প্রাক-অনুমোদিত' : profile?.creditReadinessScore && profile.creditReadinessScore >= 55 ? 'ঋণযোগ্য' : 'মূল্যায়ন প্রক্রিয়াধীন'})</p>
            <p><strong>বীমা ঝুঁকি রেটিং:</strong> {profile?.insuranceRiskTier || 'তথ্য নেই'}</p>
          </div>
        </div>

        <h3 className="font-bold text-base mb-2 border-b pb-1">কার্যক্রম ও ইন্টারঅ্যাকশন ইতিহাস</h3>
        <div className="space-y-3 mb-8">
          {timeline.length > 0 ? (
            timeline.slice(0, 4).map((e, i) => (
              <div key={i} className="text-xs border-b pb-2">
                <p className="font-bold">{e.title} ({new Date(e.createdAt).toLocaleDateString('bn-BD')})</p>
                <p className="text-slate-600">{e.summary}</p>
                {e.keyFacts && e.keyFacts.length > 0 && (
                  <p className="text-emerald-700">{e.keyFacts.join(' • ')}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic">কোনো কার্যক্রমের রেকর্ড নেই।</p>
          )}
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

      {/* Manual Farm Profile Editor Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'খামারের তথ্য হালনাগাদ করুন' : 'Edit Farm Profile Details'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'bn' ? 'প্রকৃত তথ্য প্রদান করুন, কোনো কাল্পনিক তথ্য থাকবে না' : 'Enter accurate farm facts with zero hallucination'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-5 sm:p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'কৃষকের পূর্ণ নাম' : 'Farmer Full Name'}
                  </label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder={lang === 'bn' ? 'যেমন: মোঃ রফিকুল ইসলাম' : 'e.g. Md. Rafiqul Islam'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'প্রধান ফসল' : 'Primary Crop'}
                    </label>
                    <input
                      type="text"
                      value={editForm.primaryCrop}
                      onChange={(e) => setEditForm(prev => ({ ...prev, primaryCrop: e.target.value }))}
                      placeholder={lang === 'bn' ? 'যেমন: আমন ধান, টমেটো, ভুট্টা' : 'e.g. Aman Rice, Tomato, Maize'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'চাষযোগ্য মোট জমি (শতক)' : 'Cultivated Land (Decimals)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={editForm.totalLandDecimals || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, totalLandDecimals: Number(e.target.value) }))}
                      placeholder="e.g. 50"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'জেলা' : 'District'}
                    </label>
                    <input
                      type="text"
                      value={editForm.locationDistrict}
                      onChange={(e) => setEditForm(prev => ({ ...prev, locationDistrict: e.target.value }))}
                      placeholder={lang === 'bn' ? 'যেমন: বগুড়া, রংপুর, যশোর' : 'e.g. Bogura, Rangpur'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'bn' ? 'উপজেলা' : 'Upazila'}
                    </label>
                    <input
                      type="text"
                      value={editForm.locationUpazila}
                      onChange={(e) => setEditForm(prev => ({ ...prev, locationUpazila: e.target.value }))}
                      placeholder={lang === 'bn' ? 'যেমন: শিবগঞ্জ, মিঠাপুকুর' : 'e.g. Shibganj'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'মাটি ও সেচ ব্যবস্থা' : 'Soil & Irrigation Type'}
                  </label>
                  <input
                    type="text"
                    value={editForm.soilType}
                    onChange={(e) => setEditForm(prev => ({ ...prev, soilType: e.target.value }))}
                    placeholder={lang === 'bn' ? 'যেমন: দোআঁশ মাটি (নলকূপ সেচ)' : 'e.g. Loamy (Deep Tubewell)'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Details'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Correction & Explanation Appeal Modal */}
      <AnimatePresence>
        {isAppealModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'তথ্য সংশোধন বা আপিল আবেদন' : 'Data Correction & Explanation Appeal'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {lang === 'bn' ? 'মাঠ কর্মকর্তা ও কৃষিবিদ পর্যালোচনার জন্য জমা দিন' : 'Submit for Agronomist & Field Team Verification'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'সংশোধনের বিষয়' : 'Correction Field'}
                  </label>
                  <select
                    value={appealForm.subject}
                    onChange={(e) => setAppealForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="land_decimals">{lang === 'bn' ? 'জমির পরিমাপ ও অবস্থান' : 'Land acreage & location'}</option>
                    <option value="crop_disease">{lang === 'bn' ? 'রোগ নিদান বা বালাই লক্ষণ' : 'Disease diagnosis or pest symptom'}</option>
                    <option value="weather_damage">{lang === 'bn' ? 'আবহাওয়া ক্ষতি বা প্রাকৃতিক দুর্যোগ' : 'Weather/Climate disaster shock'}</option>
                    <option value="mandi_price">{lang === 'bn' ? 'বাজার দর বা গ্রেডিং মান' : 'Market price or produce grade'}</option>
                    <option value="other">{lang === 'bn' ? 'অন্যান্য তথ্য' : 'Other information'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'প্রস্তাবিত সংশোধিত তথ্য' : 'Proposed Correction'}
                  </label>
                  <input
                    type="text"
                    value={appealForm.proposedCorrection}
                    onChange={(e) => setAppealForm(prev => ({ ...prev, proposedCorrection: e.target.value }))}
                    placeholder={lang === 'bn' ? 'যেমন: প্রকৃত চাষযোগ্য জমি ৭৫ শতক' : 'e.g. Actual land is 75 decimals'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'আপিলের কারণ বা ব্যাখ্যা' : 'Explanation & Evidence Context'}
                  </label>
                  <textarea
                    rows={3}
                    value={appealForm.explanation}
                    onChange={(e) => setAppealForm(prev => ({ ...prev, explanation: e.target.value }))}
                    placeholder={lang === 'bn' ? 'কেন এই তথ্য সংশোধন প্রয়োজন তা সংক্ষেপে লিখুন...' : 'Briefly explain the discrepancy for field team review...'}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAppealModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAppealModalOpen(false);
                    toast.success(lang === 'bn' 
                      ? 'আপিল আবেদন গৃহীত হয়েছে! উপজেলা কৃষি কর্মকর্তা ও মাঠ দল সরেজমিনে যাচাই করবে।' 
                      : 'Appeal submitted! SAAO field team will conduct physical verification.');
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer"
                >
                  {lang === 'bn' ? 'আবেদন জমা দিন' : 'Submit Appeal'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

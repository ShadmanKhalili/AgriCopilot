import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Apple,
  Beef,
  Bug,
  Carrot,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Layers,
  Loader2,
  Mic,
  Package,
  PhoneCall,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Wheat,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import {
  buildConsentSnapshot,
  createConsultation,
  describeError,
} from '../services/expertService';
import { fetchFarmerProfile } from '../utils/farmerProfiler';
import {
  CONSENT_ITEMS,
  EXPERT_CATEGORIES,
  affiliationLabel,
  rankExperts,
  SLA_MINUTES,
  type ConsentKey,
  type ConsultationUrgency,
  type ExpertPublic,
  type ExpertRequestSeed,
} from '../utils/expertTypes';
import { geoData } from '../utils/geoData';
import toBn from '../utils/banglaNum';
import { audioFeedback } from '../utils/audioFeedback';

const CATEGORY_ICONS: Record<string, any> = {
  crop_disease: Bug,
  soil_fertilizer: Layers,
  weather_damage: CloudRain,
  rice: Wheat,
  vegetables: Carrot,
  horticulture: Apple,
  livestock: Beef,
  post_harvest: Package,
  market_credit: TrendingUp,
};

interface ExpertRequestWizardProps {
  lang: 'bn' | 'en';
  isOpen: boolean;
  onClose: () => void;
  seed?: ExpertRequestSeed | null;
  experts: ExpertPublic[];
  preselectedExpertUid?: string | null;
  previousConsultations?: string[];
  onCreated: (consultationId: string) => void;
}

export default function ExpertRequestWizard({
  lang,
  isOpen,
  onClose,
  seed,
  experts,
  preselectedExpertUid,
  previousConsultations = [],
  onCreated,
}: ExpertRequestWizardProps) {
  const bn = lang === 'bn';
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(seed?.category || 'crop_disease');
  const [crop, setCrop] = useState(seed?.crop || '');
  const [symptoms, setSymptoms] = useState(seed?.diagnosisSummary || '');
  const [urgency, setUrgency] = useState<ConsultationUrgency>('urgent');
  const [consent, setConsent] = useState<Record<ConsentKey, boolean>>(() => {
    const base = {} as Record<ConsentKey, boolean>;
    CONSENT_ITEMS.forEach((item) => (base[item.id] = item.defaultOn));
    return base;
  });
  const [profile, setProfile] = useState<any | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [upazilaName, setUpazilaName] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [selectedExpertUid, setSelectedExpertUid] = useState<string | null>(preselectedExpertUid || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setCategory(seed?.category || 'crop_disease');
    setCrop(seed?.crop || '');
    setSymptoms(seed?.diagnosisSummary || '');
    setSelectedExpertUid(preselectedExpertUid || null);
    setGpsCoords(null);
    const base = {} as Record<ConsentKey, boolean>;
    CONSENT_ITEMS.forEach((item) => (base[item.id] = item.defaultOn));
    setConsent(base);
  }, [isOpen, seed, preselectedExpertUid]);

  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    fetchFarmerProfile(user.uid)
      .then((p) => {
        setProfile(p);
        if (p?.locationDistrict) setDistrictName(p.locationDistrict);
        if (p?.locationUpazila) setUpazilaName(p.locationUpazila);
        if (!crop && p?.primaryCrop) setCrop(p.primaryCrop);
      })
      .catch((e) => console.warn('Farmer profile not available for consent snapshot:', e?.code || e));
    if (user.phoneNumber) setPhoneNumber((prev) => prev || user.phoneNumber || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.uid]);

  const consentScope = useMemo(
    () => (Object.keys(consent) as ConsentKey[]).filter((k) => consent[k]),
    [consent]
  );

  const ranked = useMemo(() => {
    const top = rankExperts(experts, { district: districtName, upazila: upazilaName, category, crop }, 3);
    // Keep a hand-picked expert visible even when they are outside the top 3.
    const picked = preselectedExpertUid
      ? experts.find((e) => e.uid === preselectedExpertUid)
      : null;
    if (picked && !top.some((e) => e.uid === picked.uid)) return [picked, ...top].slice(0, 3);
    return top;
  }, [experts, districtName, upazilaName, category, crop, preselectedExpertUid]);

  const selectedExpert = useMemo(() => {
    const picked = selectedExpertUid ? experts.find((e) => e.uid === selectedExpertUid) : null;
    if (picked) return picked;
    // A stale hand-picked id must not silently fall back to a different person.
    if (selectedExpertUid) return null;
    return ranked[0] || null;
  }, [experts, selectedExpertUid, ranked]);

  const selectedDistrict = geoData.find((d) => d.name === districtName);

  const startVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error(bn ? 'এই ব্রাউজারে ভয়েস লেখা সমর্থিত নয় — লিখুন।' : 'Voice input not supported here.');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = 'bn-BD';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) setSymptoms((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      recognitionRef.current = rec;
      setIsListening(true);
      rec.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {
      // ignore
    }
    setIsListening(false);
  };

  const requestGpsConsent = () => {
    if (!navigator.geolocation) {
      toast.error(bn ? 'এই ব্রাউজারে অবস্থান পাওয়া যাচ্ছে না।' : 'Location is not available in this browser.');
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setConsent((prev) => ({ ...prev, gps: true }));
        setIsLocatingGps(false);
        toast.success(bn ? 'মাঠের অবস্থান যোগ হয়েছে।' : 'Field location added.');
      },
      () => {
        setIsLocatingGps(false);
        toast.error(
          bn
            ? 'অবস্থানের অনুমতি পাওয়া যায়নি — এটি ছাড়াই অনুরোধ পাঠাতে পারবেন।'
            : 'Location permission was not granted — you can still send the request.'
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const toggleConsentItem = (id: ConsentKey) => {
    audioFeedback.playTactileClick();
    if (id === 'gps' && !consent.gps) {
      requestGpsConsent();
      return;
    }
    setConsent((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = async () => {
    if (!user?.uid || !selectedExpert) return;
    if (!symptoms.trim()) {
      toast.error(bn ? 'সমস্যাটি একটু লিখুন বা বলুন।' : 'Please describe the problem.');
      setStep(0);
      return;
    }
    if (consent.phone && phoneNumber.replace(/\D/g, '').length < 10) {
      toast.error(
        bn
          ? 'কলব্যাকের জন্য সঠিক মোবাইল নম্বর দিন, অথবা নম্বর শেয়ার করা বন্ধ করুন।'
          : 'Enter a valid mobile number, or turn off phone sharing.'
      );
      setStep(2);
      return;
    }
    setIsSubmitting(true);
    try {
      const snapshot = buildConsentSnapshot(consentScope, profile, seed || undefined, {
        crop,
        district: districtName,
        upazila: upazilaName,
        phone: consent.phone ? phoneNumber : '',
        previousConsultations,
      });
      const id = await createConsultation({
        farmerId: user.uid,
        farmerName: profile?.fullName || user.displayName || (bn ? 'কৃষক' : 'Farmer'),
        expert: selectedExpert,
        urgency,
        category,
        crop,
        symptoms,
        lang,
        district: districtName,
        upazila: upazilaName,
        gps: consent.gps ? gpsCoords || undefined : undefined,
        consentScope,
        consentSnapshot: snapshot,
        seed: seed || undefined,
      });
      audioFeedback.playTactileClick();
      toast.success(
        bn ? 'অনুরোধ পাঠানো হয়েছে — বিশেষজ্ঞ শীঘ্রই দেখবেন।' : 'Request sent — the expert will review it soon.'
      );
      onCreated(id);
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const steps = [
    bn ? 'সমস্যা' : 'Problem',
    bn ? 'জরুরি মাত্রা' : 'Urgency',
    bn ? 'সম্মতি' : 'Consent',
    bn ? 'বিশেষজ্ঞ' : 'Expert',
  ];

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#0c1c13] rounded-t-3xl sm:rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={bn ? 'বিশেষজ্ঞের কাছে সাহায্য চাই' : 'Request human expert help'}
      >
        <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-700 to-green-600 dark:from-emerald-800 dark:to-emerald-700 text-white p-4 sm:p-5 rounded-t-3xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <h3 className="font-black text-base leading-tight truncate">
                {bn ? 'মানুষ বিশেষজ্ঞের কাছে সাহায্য চান' : 'Ask a human expert'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 active:scale-90 transition-all shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {steps.map((label, idx) => (
              <div key={label} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    idx <= step ? 'bg-white' : 'bg-white/25'
                  }`}
                />
                <span
                  className={`mt-1 block text-[10px] font-bold uppercase tracking-wider ${
                    idx <= step ? 'text-white' : 'text-white/50'
                  }`}
                >
                  {toBn(idx + 1)}. {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-5">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                <p className="text-sm font-black text-slate-800 dark:text-emerald-100">
                  {bn ? '১. কোন বিষয়ে পরামর্শ দরকার?' : '1. What do you need help with?'}
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {EXPERT_CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.id] || Sprout;
                    const active = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          audioFeedback.playTactileClick();
                          setCategory(cat.id);
                        }}
                        className={`min-h-[52px] px-3 rounded-2xl border-2 text-left transition-all active:scale-[0.98] flex items-center gap-2.5 ${
                          active
                            ? 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:border-emerald-300'
                            : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold leading-tight">{bn ? cat.bn : cat.en}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {bn ? 'ফসল / প্রাণী' : 'Crop / animal'}
                    </span>
                    <input
                      value={crop}
                      onChange={(e) => setCrop(e.target.value)}
                      className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      placeholder={bn ? 'যেমন: ধান, টমেটো' : 'e.g. rice, tomato'}
                    />
                  </label>
                  {!profile?.locationDistrict && (
                    <label className="block">
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                        {bn ? 'জেলা' : 'District'}
                      </span>
                      <select
                        value={districtName}
                        onChange={(e) => {
                          setDistrictName(e.target.value);
                          setUpazilaName('');
                        }}
                        className="mt-1.5 w-full min-h-[48px] px-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">{bn ? 'জেলা নির্বাচন' : 'Select district'}</option>
                        {geoData.map((d) => (
                          <option key={d.id} value={d.name}>
                            {bn ? d.bn_name : d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {!profile?.locationDistrict && selectedDistrict && (
                  <label className="block">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {bn ? 'উপজেলা' : 'Upazila'}
                    </span>
                    <select
                      value={upazilaName}
                      onChange={(e) => setUpazilaName(e.target.value)}
                      className="mt-1.5 w-full min-h-[48px] px-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">{bn ? 'উপজেলা নির্বাচন' : 'Select upazila'}</option>
                      {selectedDistrict.upazilas?.map((u) => (
                        <option key={u.id} value={u.name}>
                          {bn ? u.bn_name : u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {bn ? 'সমস্যাটি বলুন বা লিখুন *' : 'Describe the problem *'}
                    </span>
                    <button
                      type="button"
                      onClick={isListening ? stopVoiceInput : startVoiceInput}
                      className={`min-h-[44px] px-3 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 ${
                        isListening
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-200'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                      {isListening ? (bn ? 'থামান' : 'Stop') : bn ? 'বলে বলুন' : 'Speak'}
                    </button>
                  </div>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    rows={3}
                    className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder={bn ? 'যেমন: ধানের পাতায় বাদামি দাগ, ১০ দিন ধরে...' : 'e.g. brown spots on rice leaves for 10 days...'}
                  />
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-3">
                <p className="text-sm font-black text-slate-800 dark:text-emerald-100">
                  {bn ? '২. কত দ্রুত উত্তর দরকার?' : '2. How urgent is it?'}
                </p>
                {(
                  [
                    { id: 'emergency', icon: AlertTriangle, bn: 'এখনই জরুরি', en: 'Emergency now' },
                    { id: 'urgent', icon: PhoneCall, bn: 'আজকের মধ্যে', en: 'Today' },
                    { id: 'general', icon: Sprout, bn: 'সাধারণ প্রশ্ন', en: 'General question' },
                  ] as { id: ConsultationUrgency; icon: any; bn: string; en: string }[]
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = urgency === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        audioFeedback.playTactileClick();
                        setUrgency(opt.id);
                      }}
                      className={`w-full min-h-[64px] px-4 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:border-emerald-300'
                          : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-black">{bn ? opt.bn : opt.en}</span>
                      </span>
                      <span className={`text-[11px] font-bold ${active ? 'text-white/90 dark:text-emerald-900' : 'text-slate-500 dark:text-slate-400'}`}>
                        {bn
                          ? `উত্তর লক্ষ্য ${toBn(SLA_MINUTES[opt.id] < 60 ? SLA_MINUTES[opt.id] + ' মিনিট' : SLA_MINUTES[opt.id] / 60 + ' ঘণ্টা')}`
                          : `Target ${SLA_MINUTES[opt.id] < 60 ? SLA_MINUTES[opt.id] + ' min' : SLA_MINUTES[opt.id] / 60 + ' h'}`}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-3">
                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                    {bn ? '৩. বিশেষজ্ঞ কী কী দেখতে পাবেন?' : '3. What may the expert see?'}
                  </p>
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300 mt-1">
                    {bn
                      ? `শুধু আপনি যা অনুমতি দেবেন তা-ই দেখবেন, ${toBn(7)} দিনের জন্য। যেকোনো সময় বাতিল করতে পারবেন।`
                      : 'Only what you allow, for 7 days. You can revoke any time.'}
                  </p>
                </div>
                {CONSENT_ITEMS.map((item) => {
                  const active = consent[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleConsentItem(item.id)}
                      disabled={isLocatingGps && item.id === 'gps'}
                      className={`w-full min-h-[60px] px-4 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-all active:scale-[0.98] disabled:opacity-70 ${
                        active
                          ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/60 dark:border-emerald-500'
                          : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                      }`}
                      aria-pressed={active}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-900 dark:text-white">
                          {bn ? item.bn : item.en}
                        </span>
                        <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {isLocatingGps && item.id === 'gps'
                            ? bn
                              ? 'অবস্থান খোঁজা হচ্ছে...'
                              : 'Finding your location...'
                            : bn
                            ? item.detailBn
                            : item.detailEn}
                        </span>
                      </span>
                      <span
                        className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                          active ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-600'
                        }`}
                      >
                        <span
                          className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                            active ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}

                {consent.phone && (
                  <label className="block">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {bn ? 'কলব্যাকের জন্য আপনার মোবাইল নম্বর' : 'Your mobile number for callback'}
                    </span>
                    <input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+\- ]/g, ''))}
                      inputMode="tel"
                      className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      placeholder="01XXXXXXXXX"
                    />
                    <span className="mt-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {bn
                        ? 'শুধু এই বিশেষজ্ঞ এই নম্বরটি দেখতে পাবেন, সম্মতি বাতিল করলে আর দেখতে পারবেন না।'
                        : 'Only this expert can see it, and only while your consent is valid.'}
                    </span>
                  </label>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-3">
                <p className="text-sm font-black text-slate-800 dark:text-emerald-100">
                  {bn ? '৪. কোন বিশেষজ্ঞকে চান?' : '4. Choose your expert'}
                </p>
                {ranked.length === 0 ? (
                  <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-center space-y-2">
                    <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                      {bn ? 'এখন কোনো বিশেষজ্ঞ অনলাইনে নেই' : 'No expert is online right now'}
                    </p>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      {bn
                        ? 'বিনামূল্যে সরকারি কৃষি কল সেন্টারে ফোন করুন: ১৬১২৩ (সকাল ৮টা – রাত ৮টা)'
                        : 'Call the free government Krishi Call Centre: 16123 (8 AM – 8 PM)'}
                    </p>
                    <a
                      href="tel:16123"
                      className="inline-flex min-h-[48px] items-center gap-2 px-5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm"
                    >
                      <PhoneCall className="w-4 h-4" />
                      {bn ? '১৬১২৩ কল করুন' : 'Call 16123'}
                    </a>
                  </div>
                ) : (
                  ranked.map((expert, idx) => {
                    const active = selectedExpert?.uid === expert.uid;
                    return (
                      <button
                        key={expert.uid}
                        type="button"
                        onClick={() => {
                          audioFeedback.playTactileClick();
                          setSelectedExpertUid(expert.uid);
                        }}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.99] ${
                          active
                            ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/60 dark:border-emerald-500'
                            : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white font-black flex items-center justify-center text-base shrink-0">
                            {expert.displayName?.charAt(0) || 'ক'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                                {expert.displayName}
                              </span>
                              {idx === 0 && !active && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                  {bn ? 'সেরা মিল' : 'Best match'}
                                </span>
                              )}
                              {expert.isDemo && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200">
                                  ডেমো
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                              {expert.roleTitle} • {affiliationLabel(expert.affiliationType, lang)}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {expert.ratingCount > 0
                                ? `★ ${toBn((expert.ratingAverage || 0).toFixed(1))} (${toBn(expert.ratingCount)})`
                                : bn
                                ? 'নতুন বিশেষজ্ঞ'
                                : 'New expert'}{' '}
                              • {bn
                                ? `${toBn(expert.responseTimeMins || 30)} মিনিটে উত্তর`
                                : `~${expert.responseTimeMins || 30} min response`}
                            </p>
                          </div>
                          {active && <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })
                )}

                {ranked.length > 0 && (
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    <p className="font-black text-slate-800 dark:text-slate-100 mb-1">
                      {bn ? 'আপনার সম্মতির সারসংক্ষেপ' : 'Your consent summary'}
                    </p>
                    {consentScope.length === 0
                      ? bn
                        ? 'কিছুই শেয়ার করা হবে না — বিশেষজ্ঞের পক্ষে সাহায্য করা কঠিন হবে।'
                        : 'Nothing shared — it will be hard for the expert to help.'
                      : CONSENT_ITEMS.filter((i) => consent[i.id])
                          .map((i) => (bn ? i.bn : i.en))
                          .join(' • ')}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-1">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="min-h-[52px] px-5 rounded-2xl border-2 border-stone-200 dark:border-stone-700 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                {bn ? 'পিছনে' : 'Back'}
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 0 && !symptoms.trim()) {
                    toast.error(bn ? 'সমস্যাটি একটু লিখুন বা বলুন।' : 'Please describe the problem.');
                    return;
                  }
                  audioFeedback.playTactileClick();
                  setStep((s) => Math.min(3, s + 1));
                }}
                className="flex-1 min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {bn ? 'পরবর্তী' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || ranked.length === 0 || !selectedExpert}
                onClick={handleSubmit}
                className="flex-1 min-h-[52px] rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-800 hover:to-green-700 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {bn ? 'সম্মতি দিয়ে অনুরোধ পাঠান' : 'Consent & send request'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

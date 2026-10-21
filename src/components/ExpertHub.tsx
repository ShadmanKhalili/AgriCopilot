import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Clock,
  FileText,
  HeartHandshake,
  Loader2,
  Lock,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import ConsultationRoom from './ConsultationRoom';
import ExpertOnboarding from './ExpertOnboarding';
import ExpertRequestWizard from './ExpertRequestWizard';
import ExpertWorkspace from './ExpertWorkspace';
import {
  approveApplication,
  describeError,
  fetchActiveExperts,
  getMyApplication,
  listApplications,
  rejectApplication,
  seedDemoExperts,
  watchFarmerConsultations,
} from '../services/expertService';
import {
  affiliationLabel,
  categoryLabel,
  statusColor,
  statusLabel,
  type Consultation,
  type ExpertApplication,
  type ExpertPublic,
  type ExpertRequestSeed,
} from '../utils/expertTypes';
import toBn from '../utils/banglaNum';
import { audioFeedback } from '../utils/audioFeedback';

interface ExpertHubProps {
  lang: 'bn' | 'en';
  requestSeed?: ExpertRequestSeed | null;
  onClearRequestSeed?: () => void;
}

export default function ExpertHub({ lang, requestSeed, onClearRequestSeed }: ExpertHubProps) {
  const bn = lang === 'bn';
  const { user, userRole, isAdmin, isExpert, signIn } = useAuth();

  const [experts, setExperts] = useState<ExpertPublic[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [application, setApplication] = useState<ExpertApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSeed, setWizardSeed] = useState<ExpertRequestSeed | null>(null);
  const [preselectedExpertUid, setPreselectedExpertUid] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const [adminApps, setAdminApps] = useState<ExpertApplication[]>([]);
  const [adminBusy, setAdminBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid || isExpert) {
      setIsLoading(!user ? false : !isExpert);
      return;
    }
    let unsub: (() => void) | null = null;
    setIsLoading(true);
    setLoadError(null);
    Promise.allSettled([
      fetchActiveExperts().then(setExperts),
      userRole && userRole !== 'expert_pending'
        ? getMyApplication(user.uid).then(setApplication)
        : Promise.resolve(null),
    ])
      .then((results) => {
        const expertResult = results[0];
        if (expertResult.status === 'rejected') {
          setLoadError(describeError(expertResult.reason, lang));
        }
      })
      .finally(() => setIsLoading(false));
    unsub = watchFarmerConsultations(user.uid, setConsultations);
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, isExpert, userRole, reloadKey, lang]);

  // Signing out on a shared phone must not leave a case or request form open.
  useEffect(() => {
    if (user?.uid) return;
    setRoomId(null);
    setWizardOpen(false);
    setWizardSeed(null);
    setOnboardingOpen(false);
    setExperts([]);
    setConsultations([]);
    setApplication(null);
    setAdminApps([]);
  }, [user?.uid]);

  // Diagnosis screen asked for an expert: keep the seed locally (the layout
  // clears its copy immediately) and open the wizard prefilled.
  useEffect(() => {
    if (requestSeed && user?.uid) {
      setWizardSeed(requestSeed);
      setPreselectedExpertUid(null);
      setWizardOpen(true);
      onClearRequestSeed?.();
    }
  }, [requestSeed, user?.uid, onClearRequestSeed]);

  const activeConsultations = useMemo(
    () =>
      consultations.filter((c) =>
        ['requested', 'accepted', 'in_progress', 'awaiting_farmer', 'escalated'].includes(c.status)
      ),
    [consultations]
  );

  const pastConsultations = useMemo(
    () => consultations.filter((c) => ['resolved', 'closed', 'cancelled', 'expired'].includes(c.status)),
    [consultations]
  );

  const consentHistory = useMemo(
    () =>
      pastConsultations
        .filter((c) => ['resolved', 'closed'].includes(c.status))
        .slice(0, 3)
        .map((c) =>
          [
            categoryLabel(c.category, lang),
            c.crop || (bn ? 'ফসল' : 'Crop'),
            c.outcome || statusLabel(c.status, lang),
          ]
            .filter(Boolean)
            .join(' — ')
        ),
    [pastConsultations, lang, bn]
  );

  const loadAdminApps = async () => {
    setAdminBusy(true);
    try {
      const apps = await listApplications();
      setAdminApps(apps);
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setAdminBusy(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void loadAdminApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleApprove = async (app: ExpertApplication, level: 'provisional' | 'verified') => {
    setAdminBusy(true);
    try {
      await approveApplication(app, level, bn ? 'যাচাই করে অনুমোদন দেওয়া হয়েছে' : 'Verified and approved');
      toast.success(bn ? 'বিশেষজ্ঞ অনুমোদিত হয়েছে।' : 'Expert approved.');
      await loadAdminApps();
      fetchActiveExperts().then(setExperts).catch(() => {});
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setAdminBusy(false);
    }
  };

  const handleReject = async (app: ExpertApplication) => {
    const note = window.prompt(
      bn ? 'প্রত্যাখ্যানের কারণ লিখুন' : 'Reason for rejection',
      bn ? 'প্রয়োজনীয় প্রমাণপত্র পাওয়া যায়নি' : 'Required credentials not provided'
    );
    if (note === null) return;
    setAdminBusy(true);
    try {
      await rejectApplication(app.id, note);
      toast.success(bn ? 'আবেদন প্রত্যাখ্যান করা হয়েছে।' : 'Application rejected.');
      await loadAdminApps();
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setAdminBusy(false);
    }
  };

  const handleSeedDemo = async () => {
    setAdminBusy(true);
    try {
      const count = await seedDemoExperts();
      toast.success(
        bn ? `${toBn(count)} জন ডেমো বিশেষজ্ঞ যোগ হয়েছে।` : `${count} demo experts added.`
      );
      fetchActiveExperts().then(setExperts).catch(() => {});
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setAdminBusy(false);
    }
  };

  const consultationCard = (c: Consultation, isPast: boolean) => {
    const unread =
      c.lastMessageSenderRole === 'expert' &&
      c.lastExpertMessageAt &&
      (!c.lastFarmerMessageAt || c.lastExpertMessageAt > c.lastFarmerMessageAt);
    return (
      <motion.button
        key={c.id}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.99 }}
        type="button"
        onClick={() => setRoomId(c.id)}
        className={`w-full text-left rounded-3xl border p-4 shadow-xs transition-all ${
          isPast
            ? 'bg-white/70 dark:bg-stone-900/60 border-stone-200 dark:border-stone-800 hover:border-stone-300'
            : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-emerald-400'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                {c.expertName || (bn ? 'বিশেষজ্ঞ' : 'Expert')}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(
                  c.status
                )}`}
              >
                {statusLabel(c.status, lang)}
              </span>
              {unread && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {bn ? 'নতুন উত্তর' : 'New reply'}
                </span>
              )}
            </div>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">
              {categoryLabel(c.category, lang)} • {c.crop || (bn ? 'ফসল' : 'Crop')}
            </p>
            {!isPast && (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                {bn ? 'লক্ষ্য সময়' : 'Target'}: {new Date(c.slaDueAtMs).toLocaleTimeString(bn ? 'bn-BD' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {!!c.farmerRating && (
              <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300 mt-1 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {toBn(c.farmerRating)}/৫
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-stone-400 shrink-0 mt-1" />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 dark:from-emerald-950 dark:via-emerald-900 dark:to-emerald-800 text-white p-5 sm:p-6 shadow-xl">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-xl sm:text-2xl leading-tight">
              {bn ? 'মানুষ বিশেষজ্ঞ সহায়তা' : 'Human Expert Help'}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-emerald-50/90 leading-relaxed">
              {bn
                ? 'এআই-এর পরের ধাপ — উপজেলা কৃষি অফিসার, কৃষি এনজিওর মাঠকর্মী ও যাচাইকৃত বিশেষজ্ঞ। আপনি অনুমতি দিলে তবেই তিনি আপনার খামারের তথ্য দেখতে পাবেন।'
                : 'The layer after AI — Upazila agriculture officers, NGO field staff and vetted experts. They only see your farm data if you allow it.'}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15">
                <Lock className="w-3.5 h-3.5" />
                {bn ? 'সম্মতিভিত্তিক তথ্য শেয়ার' : 'Consent-first sharing'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15">
                <BadgeCheck className="w-3.5 h-3.5" />
                {bn ? 'যাচাইকৃত বিশেষজ্ঞ' : 'Verified experts'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Guest */}
      {!user && (
        <div className="rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 text-center space-y-3">
          <Users className="w-9 h-9 mx-auto text-emerald-600" />
          <p className="font-black text-slate-900 dark:text-white">
            {bn ? 'বিশেষজ্ঞের সাথে যুক্ত হতে সাইন ইন করুন' : 'Sign in to connect with an expert'}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {bn
              ? 'আপনার পরিচয় ও খামারের তথ্য সুরক্ষিত রাখতে সাইন ইন দরকার। চাইলে আগে বিনামূল্যে ১৬১২৩ নম্বরে সরকারি কৃষি কল সেন্টারে ফোন করতে পারেন।'
              : 'Sign-in protects your identity and farm data. You can also call the free government Krishi Call Centre at 16123.'}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => signIn().catch(() => {})}
              className="min-h-[52px] px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm active:scale-95 transition-all"
            >
              {bn ? 'সাইন ইন করুন' : 'Sign in'}
            </button>
            <a
              href="tel:16123"
              className="min-h-[52px] px-6 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 font-black text-sm flex items-center gap-2 active:scale-95 transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              {bn ? '১৬১২৩ কল করুন' : 'Call 16123'}
            </a>
          </div>
        </div>
      )}

      {/* Expert workspace */}
      {user && isExpert && <ExpertWorkspace lang={lang} />}

      {/* Farmer / applicant view */}
      {user && !isExpert && (
        <>
          {isLoading ? (
            <div className="py-10 flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Loader2 className="w-7 h-7 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {bn ? 'বিশেষজ্ঞ খোঁজা হচ্ছে...' : 'Finding experts...'}
              </span>
            </div>
          ) : (
            <>
              {loadError && (
                <div className="rounded-3xl border-2 border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                      {bn ? 'বিশেষজ্ঞ তালিকা এখন পাওয়া যাচ্ছে না' : 'Expert directory is unavailable'}
                    </p>
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 mt-0.5">
                      {loadError}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="min-h-[44px] px-3 rounded-2xl bg-amber-500 text-white text-[11px] font-black shrink-0"
                  >
                    {bn ? 'আবার চেষ্টা' : 'Retry'}
                  </button>
                </div>
              )}

              {/* Request CTA */}
              <div className="rounded-3xl bg-white dark:bg-stone-900 border-2 border-emerald-200 dark:border-emerald-900 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-black text-base text-slate-900 dark:text-white">
                      {bn ? 'বিশেষজ্ঞের কাছে সাহায্য চান' : 'Ask a human expert'}
                    </h2>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                      {bn
                        ? '৪টি সহজ ধাপে অনুরোধ পাঠান। প্রথমেই আপনি ঠিক করবেন বিশেষজ্ঞ কী কী তথ্য দেখতে পাবেন।'
                        : 'Four simple steps. You decide exactly what the expert can see.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    audioFeedback.playTactileClick();
                    setWizardSeed(null);
                    setPreselectedExpertUid(null);
                    setWizardOpen(true);
                  }}
                  className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-800 hover:to-green-700 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <HeartHandshake className="w-5 h-5" />
                  {bn ? 'বিশেষজ্ঞের সাথে কথা বলুন' : 'Talk to an expert'}
                </button>
                {experts.length === 0 && (
                  <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {bn
                      ? 'এখন কোনো বিশেষজ্ঞ তালিকাভুক্ত নন — সাধারণত ২৪ ঘণ্টার মধ্যে উত্তর পাওয়া যায়। Emergency হলে ১৬১২৩ কল করুন।'
                      : 'No experts are listed yet. Typically answered within 24h. For emergencies call 16123.'}
                  </p>
                )}
              </div>

              {/* Active consultations */}
              {activeConsultations.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-black text-sm text-slate-900 dark:text-white px-1">
                    {bn ? 'চলমান অনুরোধ' : 'Active requests'}
                  </h2>
                  {activeConsultations.map((c) => consultationCard(c, false))}
                </div>
              )}

              {/* Past consultations */}
              {pastConsultations.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-black text-sm text-slate-900 dark:text-white px-1">
                    {bn ? 'পুরনো পরামর্শ' : 'Past consultations'}
                  </h2>
                  {pastConsultations.slice(0, 6).map((c) => consultationCard(c, true))}
                </div>
              )}

              {/* Become an expert / application status */}
              {userRole !== 'expert_pending' ? (
                application ? (
                  <div className="rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 flex items-start gap-3">
                    <FileText className="w-6 h-6 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-white">
                        {bn ? 'বিশেষজ্ঞ আবেদন' : 'Expert application'}: {application.status === 'pending' ? (bn ? 'যাচাইয়ে' : 'Pending') : application.status === 'approved' ? (bn ? 'অনুমোদিত' : 'Approved') : (bn ? 'প্রত্যাখ্যাত' : 'Rejected')}
                      </p>
                      {application.reviewerNote && (
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                          {application.reviewerNote}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setOnboardingOpen(true)}
                        className="mt-2 text-[11px] font-black text-emerald-700 dark:text-emerald-300 underline"
                      >
                        {bn ? 'বিস্তারিত দেখুন' : 'View details'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOnboardingOpen(true)}
                    className="w-full rounded-3xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 p-5 flex items-center gap-3 text-left hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 transition-all"
                  >
                    <UserPlus className="w-7 h-7 text-emerald-600 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-black text-sm text-slate-900 dark:text-white">
                        {bn ? 'আপনি কি কৃষি বিশেষজ্ঞ?' : 'Are you an agri expert?'}
                      </span>
                      <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        {bn
                          ? 'কৃষি অফিসার, এনজিও মাঠকর্মী বা অভিজ্ঞ কৃষক হিসেবে আবেদন করুন — যাচাইয়ের পর অনুমোদন।'
                          : 'Agri officers, NGO field staff and experienced farmers can apply — verified before approval.'}
                      </span>
                    </span>
                    <ChevronRight className="w-5 h-5 text-emerald-500 shrink-0 ml-auto" />
                  </button>
                )
              ) : (
                <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 p-5">
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200">
                    {bn ? 'আপনার বিশেষজ্ঞ আবেদন যাচাইয়ে আছে' : 'Your expert application is under review'}
                  </p>
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 mt-1">
                    {bn
                      ? 'অনুমোদনের পর আপনি Expert Desk দেখতে পাবেন। ততক্ষণ কৃষক হিসেবে সব সেবা ব্যবহার করতে পারবেন।'
                      : 'Once approved you will see the Expert Desk. Until then all farmer features stay available.'}
                  </p>
                </div>
              )}

              {/* Expert directory */}
              {experts.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-black text-sm text-slate-900 dark:text-white px-1">
                    {bn ? 'বিশেষজ্ঞ ডিরেক্টরি' : 'Expert directory'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {experts.slice(0, 8).map((e) => (
                      <button
                        key={e.uid}
                        type="button"
                        onClick={() => {
                          audioFeedback.playTactileClick();
                          setWizardSeed(null);
                          setPreselectedExpertUid(e.uid);
                          setWizardOpen(true);
                        }}
                        className="text-left rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 hover:border-emerald-400 transition-all active:scale-[0.99]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white font-black flex items-center justify-center text-base shrink-0">
                            {e.displayName?.charAt(0) || 'ক'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                                {e.displayName}
                              </span>
                              {e.isDemo && (
                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200">
                                  ডেমো
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                              {e.roleTitle}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                              {affiliationLabel(e.affiliationType, lang)} •{' '}
                              {[...(e.upazilas || []), ...(e.districts || [])].slice(0, 2).join(', ') ||
                                (bn ? 'বাংলাদেশ' : 'Bangladesh')}
                            </p>
                            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-300 mt-1">
                              {e.ratingCount > 0
                                ? `★ ${toBn((e.ratingAverage || 0).toFixed(1))} (${toBn(e.ratingCount)})`
                                : bn
                                ? 'নতুন বিশেষজ্ঞ'
                                : 'New expert'}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Admin review */}
      {isAdmin && (
        <div className="rounded-3xl border-2 border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-black text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              {bn ? 'বিশেষজ্ঞ আবেদন পর্যালোচনা (এডমিন)' : 'Expert applications (admin)'}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAdminApps}
                disabled={adminBusy}
                className="min-h-[44px] px-3 rounded-2xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-900 text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5 disabled:opacity-60"
              >
                {adminBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {bn ? 'রিফ্রেশ' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={handleSeedDemo}
                disabled={adminBusy}
                className="min-h-[44px] px-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black flex items-center gap-1.5 disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                {bn ? 'ডেমো বিশেষজ্ঞ' : 'Seed demo'}
              </button>
            </div>
          </div>

          {adminApps.length === 0 ? (
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {bn ? 'কোনো আবেদন নেই।' : 'No applications.'}
            </p>
          ) : (
            adminApps.map((app) => (
              <div
                key={app.id}
                className="rounded-2xl bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-900 p-4 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-slate-900 dark:text-white">{app.fullName}</span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      app.status === 'pending'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : app.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {app.roleTitle} • {affiliationLabel(app.affiliationType, lang)} • {toBn(app.yearsExperience || 0)}{' '}
                  {bn ? 'বছর' : 'yrs'}
                </p>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {app.phone} • {[...(app.districts || []), ...(app.upazilas || [])].join(', ') || '—'}
                </p>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{app.motivation}</p>
                {app.status === 'pending' && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={() => handleApprove(app, 'verified')}
                      disabled={adminBusy}
                      className="min-h-[44px] px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-black disabled:opacity-60"
                    >
                      {bn ? 'অনুমোদন (যাচাইকৃত)' : 'Approve (verified)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(app, 'provisional')}
                      disabled={adminBusy}
                      className="min-h-[44px] px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black disabled:opacity-60"
                    >
                      {bn ? 'প্রোবেশন' : 'Provisional'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(app)}
                      disabled={adminBusy}
                      className="min-h-[44px] px-4 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-[11px] font-black disabled:opacity-60"
                    >
                      {bn ? 'প্রত্যাখ্যান' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {wizardOpen && user && (
          <ExpertRequestWizard
            lang={lang}
            isOpen={wizardOpen}
            onClose={() => {
              setWizardOpen(false);
              setWizardSeed(null);
            }}
            seed={wizardSeed || undefined}
            experts={experts}
            preselectedExpertUid={preselectedExpertUid}
            previousConsultations={consentHistory}
            onCreated={(id) => {
              setWizardOpen(false);
              setWizardSeed(null);
              setPreselectedExpertUid(null);
              setRoomId(id);
            }}
          />
        )}
      </AnimatePresence>

      {onboardingOpen && (
        <ExpertOnboarding
          lang={lang}
          onClose={() => setOnboardingOpen(false)}
          onSubmitted={() => {
            if (user?.uid) getMyApplication(user.uid).then(setApplication).catch(() => {});
          }}
        />
      )}

      {roomId && (
        <ConsultationRoom
          lang={lang}
          consultationId={roomId}
          viewerRole="farmer"
          onClose={() => setRoomId(null)}
        />
      )}
    </div>
  );
}

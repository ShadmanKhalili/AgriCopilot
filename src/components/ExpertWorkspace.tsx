import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  Inbox,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import ConsultationRoom from './ConsultationRoom';
import {
  describeError,
  fetchExpertProfile,
  setExpertStatus,
  watchExpertConsultations,
} from '../services/expertService';
import {
  affiliationLabel,
  categoryLabel,
  formatCountdown,
  statusColor,
  statusLabel,
  type Consultation,
  type ExpertPublic,
} from '../utils/expertTypes';
import toBn from '../utils/banglaNum';

interface ExpertWorkspaceProps {
  lang: 'bn' | 'en';
}

export default function ExpertWorkspace({ lang }: ExpertWorkspaceProps) {
  const bn = lang === 'bn';
  const { user } = useAuth();

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [profile, setProfile] = useState<ExpertPublic | null>(null);
  const [activeCase, setActiveCase] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'closed'>('active');
  const [isToggling, setIsToggling] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    setLoadError(false);
    fetchExpertProfile(user.uid)
      .then(setProfile)
      .catch((e) => console.warn('Expert profile load failed:', e?.code || e));
    const unsub = watchExpertConsultations(user.uid, setConsultations, () => setLoadError(true));
    return () => unsub();
  }, [user?.uid]);

  const activeCases = useMemo(
    () =>
      consultations.filter((c) =>
        ['requested', 'accepted', 'in_progress', 'awaiting_farmer', 'escalated'].includes(c.status)
      ),
    [consultations]
  );

  const closedCases = useMemo(
    () => consultations.filter((c) => ['resolved', 'closed', 'cancelled', 'expired'].includes(c.status)),
    [consultations]
  );

  const isOnline = profile?.status === 'active';

  const toggleAvailability = async () => {
    if (!user?.uid || !profile) return;
    setIsToggling(true);
    try {
      await setExpertStatus(user.uid, isOnline ? 'paused' : 'active');
      setProfile({ ...profile, status: isOnline ? 'paused' : 'active' });
      toast.success(
        isOnline
          ? bn
            ? 'আপনি এখন অফলাইন — নতুন অনুরোধ আসবে না।'
            : 'You are now offline — no new requests.'
          : bn
          ? 'আপনি এখন অনলাইন — নতুন অনুরোধ পাবেন।'
          : 'You are now online.'
      );
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setIsToggling(false);
    }
  };

  const list = tab === 'active' ? activeCases : closedCases;

  return (
    <div className="space-y-4">
      {/* Expert identity card */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-800 to-green-700 dark:from-emerald-900 dark:to-emerald-800 text-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-2xl font-black shrink-0">
              {profile?.displayName?.charAt(0) || user?.displayName?.charAt(0) || 'ক'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-black text-lg truncate">{profile?.displayName || user?.displayName}</h2>
                {profile && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" />
                    {profile.verificationLevel === 'senior'
                      ? bn
                        ? 'সিনিয়র বিশেষজ্ঞ'
                        : 'Senior'
                      : profile.verificationLevel === 'provisional'
                      ? bn
                        ? 'প্রোবেশন'
                        : 'Provisional'
                      : bn
                      ? 'যাচাইকৃত'
                      : 'Verified'}
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-emerald-100 mt-0.5 truncate">
                {profile?.roleTitle} • {profile ? affiliationLabel(profile.affiliationType, lang) : ''}
              </p>
              <p className="text-[11px] font-medium text-emerald-200/90 mt-0.5 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" />
                {[...(profile?.upazilas || []), ...(profile?.districts || [])].slice(0, 3).join(', ') ||
                  (bn ? 'বাংলাদেশ' : 'Bangladesh')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleAvailability}
            disabled={isToggling}
            className={`min-h-[48px] px-4 rounded-2xl font-black text-xs flex items-center gap-2 transition-all active:scale-95 ${
              isOnline ? 'bg-emerald-400 text-emerald-950' : 'bg-white/15 text-white'
            }`}
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isOnline ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
            {isOnline ? (bn ? 'অনলাইন' : 'Online') : bn ? 'অফলাইন' : 'Offline'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <p className="text-xl font-black">{toBn(activeCases.length)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {bn ? 'সক্রিয়' : 'Active'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <p className="text-xl font-black">{toBn(closedCases.length)}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {bn ? 'সম্পন্ন' : 'Closed'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <p className="text-xl font-black flex items-center justify-center gap-1">
              {profile?.ratingCount ? (
                <>
                  {toBn((profile.ratingAverage || 0).toFixed(1))}
                  <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                </>
              ) : (
                <span className="text-xs">{bn ? 'নতুন' : 'New'}</span>
              )}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
              {bn ? 'রেটিং' : 'Rating'}
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3 flex items-start gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold">
            {bn
              ? 'মামলার তালিকা লোড করা যাচ্ছে না। ইন্টারনেট বা ডাটাবেসের নিরাপত্তা নিয়ম (Firestore rules) ঠিক আছে কিনা দেখুন।'
              : 'Could not load the case queue. Check the connection or Firestore rules deployment.'}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900">
        {(
          [
            { id: 'active', bn: 'সক্রিয় মামলা', en: 'Active cases' },
            { id: 'closed', bn: 'সম্পন্ন', en: 'Closed' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-h-[44px] rounded-xl text-xs font-black transition-all ${
              tab === t.id
                ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-300 dark:text-emerald-950'
                : 'text-emerald-800 dark:text-emerald-200'
            }`}
          >
            {bn ? t.bn : t.en}
          </button>
        ))}
      </div>

      {/* Case list */}
      {list.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-emerald-200 dark:border-emerald-900 p-10 text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-emerald-500" />
          <p className="text-sm font-black text-emerald-900 dark:text-emerald-200">
            {tab === 'active'
              ? bn
                ? 'এখন কোনো সক্রিয় মামলা নেই'
                : 'No active cases right now'
              : bn
              ? 'সম্পন্ন মামলার তালিকা খালি'
              : 'No closed cases yet'}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {bn
              ? 'কৃষক অনুরোধ পাঠালে এখানে দেখতে পাবেন। অনলাইন থাকলে দ্রুত পাবেন।'
              : 'Farmer requests will appear here. Stay online to receive them faster.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const unread =
              c.lastMessageSenderRole === 'farmer' &&
              c.lastFarmerMessageAt &&
              (!c.lastExpertMessageAt || c.lastFarmerMessageAt > c.lastExpertMessageAt);
            return (
              <motion.button
                key={c.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={() => setActiveCase(c.id)}
                className="w-full text-left rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-4 shadow-xs hover:border-emerald-400 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900 dark:text-white truncate">
                        {c.farmerName || (bn ? 'কৃষক' : 'Farmer')}
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
                          {bn ? 'নতুন বার্তা' : 'New reply'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">
                      {categoryLabel(c.category, lang)} • {c.crop || (bn ? 'ফসল' : 'Crop')} •{' '}
                      {c.upazila || c.district}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {['requested', 'accepted', 'in_progress', 'awaiting_farmer', 'escalated'].includes(c.status) && (
                      <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {formatCountdown(c.slaDueAtMs, lang)}
                      </span>
                    )}
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                      <ShieldCheck className="w-3 h-3" />
                      {c.consentRevoked
                        ? bn
                          ? 'সম্মতি বাতিল'
                          : 'Consent revoked'
                        : c.consentExpiresAtMs > Date.now()
                        ? bn
                          ? 'সম্মতি সক্রিয়'
                          : 'Consent active'
                        : bn
                        ? 'সম্মতি শেষ'
                        : 'Consent expired'}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {activeCase && (
        <ConsultationRoom
          lang={lang}
          consultationId={activeCase}
          viewerRole="expert"
          onClose={() => setActiveCase(null)}
        />
      )}
    </div>
  );
}

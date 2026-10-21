import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BadgeCheck,
  ChevronRight,
  GraduationCap,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import {
  applyAsExpert,
  describeError,
  getMyApplication,
  type ExpertApplicationInput,
} from '../services/expertService';
import {
  affiliationLabel,
  EXPERT_CATEGORIES,
  type ExpertAffiliationType,
  type ExpertApplication,
} from '../utils/expertTypes';
import { geoData } from '../utils/geoData';
import { audioFeedback } from '../utils/audioFeedback';

interface ExpertOnboardingProps {
  lang: 'bn' | 'en';
  onClose: () => void;
  onSubmitted?: () => void;
}

const AFFILIATION_OPTIONS: ExpertAffiliationType[] = ['government', 'ngo', 'private', 'peer'];

export default function ExpertOnboarding({ lang, onClose, onSubmitted }: ExpertOnboardingProps) {
  const bn = lang === 'bn';
  const { user, userRole } = useAuth();

  const [application, setApplication] = useState<ExpertApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fullName, setFullName] = useState(user?.displayName || '');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [affiliationType, setAffiliationType] = useState<ExpertAffiliationType>('government');
  const [affiliationName, setAffiliationName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [upazilaName, setUpazilaName] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [referencePhone, setReferencePhone] = useState('');
  const [motivation, setMotivation] = useState('');
  const [publicBio, setPublicBio] = useState('');
  const [conflictOfInterest, setConflictOfInterest] = useState('');

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    getMyApplication(user.uid)
      .then((app) => setApplication(app))
      .catch((e) => console.warn('Application load failed:', e?.code || e))
      .finally(() => setIsLoading(false));
  }, [user?.uid]);

  const selectedDistrict = useMemo(
    () => geoData.find((d) => d.name === districtName),
    [districtName]
  );

  const toggleSpecialization = (id: string) => {
    audioFeedback.playTactileClick();
    setSpecializations((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length >= 6 ? prev : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      toast.error(bn ? 'আগে সাইন ইন করুন।' : 'Please sign in first.');
      return;
    }
    if (!fullName.trim() || phone.trim().length < 6) {
      toast.error(bn ? 'নাম ও মোবাইল নম্বর দিন।' : 'Name and mobile number are required.');
      return;
    }
    if (!roleTitle.trim() || specializations.length === 0 || motivation.trim().length < 10) {
      toast.error(
        bn
          ? 'পদবি, কমপক্ষে একটি বিশেষত্ব এবং অভিজ্ঞতার বিবরণ দিন।'
          : 'Role, at least one specialisation and a short motivation are required.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const input: ExpertApplicationInput = {
        fullName,
        phone,
        email,
        affiliationType,
        affiliationName,
        roleTitle,
        districts: districtName ? [districtName] : [],
        upazilas: upazilaName ? [upazilaName] : [],
        specializations,
        languages: ['bn'],
        yearsExperience: Number(yearsExperience) || 0,
        registrationNo,
        referenceName,
        referencePhone,
        motivation,
        publicBio,
        conflictOfInterest,
      };
      await applyAsExpert(user.uid, input);
      audioFeedback.playTactileClick();
      toast.success(
        bn ? 'আবেদন জমা হয়েছে। যাচাই করে অনুমোদন দেওয়া হবে।' : 'Application submitted — pending review.'
      );
      onSubmitted?.();
      onClose();
    } catch (error: any) {
      toast.error(describeError(error, lang));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (!application) return null;
    const isPending = application.status === 'pending';
    const isApproved = application.status === 'approved';
    return (
      <div className="space-y-4">
        <div
          className={`p-5 rounded-3xl border-2 ${
            isApproved
              ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-800'
              : isPending
              ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/50 dark:border-amber-800'
              : 'bg-rose-50 border-rose-300 dark:bg-rose-950/50 dark:border-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {isApproved ? (
              <BadgeCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : isPending ? (
              <Loader2 className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <X className="w-8 h-8 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <div>
              <p className="font-black text-base text-slate-900 dark:text-white">
                {isApproved
                  ? bn
                    ? 'অভিনন্দন — আপনি অনুমোদিত বিশেষজ্ঞ'
                    : 'Approved expert'
                  : isPending
                  ? bn
                    ? 'আবেদন যাচাইয়ে আছে'
                    : 'Application under review'
                  : bn
                  ? 'আবেদন গ্রহণ করা হয়নি'
                  : 'Application not accepted'}
              </p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                {bn ? 'পদবি' : 'Role'}: {application.roleTitle} •{' '}
                {affiliationLabel(application.affiliationType, lang)}
              </p>
            </div>
          </div>
          {application.reviewerNote && (
            <p className="mt-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-black/30 rounded-2xl p-3 border border-black/5 dark:border-white/10">
              {bn ? 'পর্যালোচকের নোট' : 'Reviewer note'}: {application.reviewerNote}
            </p>
          )}
        </div>
        {!isApproved && !isPending && (
          <button
            type="button"
            onClick={() => setApplication(null)}
            className="w-full min-h-[52px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm active:scale-[0.98] transition-all"
          >
            {bn ? 'আবার আবেদন করুন' : 'Apply again'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#0c1c13] rounded-t-3xl sm:rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5 bg-gradient-to-r from-emerald-700 to-green-600 dark:from-emerald-800 dark:to-emerald-700 text-white rounded-t-3xl">
          <div className="flex items-center gap-3 min-w-0">
            <GraduationCap className="w-7 h-7 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-black text-base sm:text-lg leading-tight truncate">
                {bn ? 'কৃষি বিশেষজ্ঞ হিসেবে যোগ দিন' : 'Join as an Agri Expert'}
              </h3>
              <p className="text-[11px] font-medium text-emerald-50/90 truncate">
                {bn
                  ? 'কৃষি অফিসার, এনজিও মাঠকর্মী, কৃষিবিদ বা অভিজ্ঞ কৃষক'
                  : 'Agri officers, NGO field staff, agronomists and experienced farmers'}
              </p>
            </div>
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

        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {bn ? 'তথ্য লোড হচ্ছে...' : 'Loading...'}
              </span>
            </div>
          ) : userRole === 'expert' || userRole === 'org_admin' ? (
            <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-800 flex items-center gap-3">
              <BadgeCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              <p className="font-black text-sm text-slate-900 dark:text-white">
                {bn ? 'আপনি ইতিমধ্যে অনুমোদিত বিশেষজ্ঞ।' : 'You are already an approved expert.'}
              </p>
            </div>
          ) : application ? (
            renderStatus()
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  {bn
                    ? 'যাচাইয়ের পর আবেদন অনুমোদিত হয়। প্রথম ১০টি পরামর্শ সিনিয়র বিশেষজ্ঞ পর্যবেক্ষণ করেন। কৃষককে কখনো নিজের পণ্য বিক্রি করতে উৎসাহ দেবেন না — স্বার্থের দ্বন্দ্ব অবশ্যই জানাতে হবে।'
                    : 'Applications are verified before approval. The first 10 consultations are shadow-reviewed by a senior expert. Never push your own products — you must disclose conflicts of interest.'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'পূর্ণ নাম *' : 'Full name *'}
                  </span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder={bn ? 'যেমন: ড. শাহিনুর আলম' : 'e.g. Dr. Shahinur Alam'}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'মোবাইল নম্বর *' : 'Mobile number *'}
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder="01XXXXXXXXX"
                    required
                  />
                </label>
              </div>

              <div>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {bn ? 'প্রতিষ্ঠানের ধরন *' : 'Affiliation type *'}
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {AFFILIATION_OPTIONS.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        audioFeedback.playTactileClick();
                        setAffiliationType(type);
                      }}
                      className={`min-h-[52px] px-3 rounded-2xl border-2 text-xs font-black transition-all active:scale-[0.98] ${
                        affiliationType === type
                          ? 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:border-emerald-300'
                          : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      {affiliationLabel(type, lang)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'প্রতিষ্ঠানের নাম' : 'Organisation name'}
                  </span>
                  <input
                    value={affiliationName}
                    onChange={(e) => setAffiliationName(e.target.value)}
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder={affiliationType === 'government' ? 'DAE, উপজেলা কৃষি অফিস' : bn ? 'প্রতিষ্ঠানের নাম' : 'Organisation'}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'পদবি *' : 'Role / designation *'}
                  </span>
                  <input
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder={bn ? 'উপজেলা কৃষি অফিসার' : 'Upazila Agriculture Officer'}
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'প্রধান জেলা' : 'Primary district'}
                  </span>
                  <select
                    value={districtName}
                    onChange={(e) => {
                      setDistrictName(e.target.value);
                      setUpazilaName('');
                    }}
                    className="mt-1.5 w-full min-h-[48px] px-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">{bn ? 'জেলা নয়' : 'No district'}</option>
                    {geoData.map((d) => (
                      <option key={d.id} value={d.name}>
                        {bn ? d.bn_name : d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'প্রধান উপজেলা' : 'Primary upazila'}
                  </span>
                  <select
                    value={upazilaName}
                    onChange={(e) => setUpazilaName(e.target.value)}
                    disabled={!selectedDistrict}
                    className="mt-1.5 w-full min-h-[48px] px-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="">{bn ? 'উপজেলা নয়' : 'No upazila'}</option>
                    {selectedDistrict?.upazilas?.map((u) => (
                      <option key={u.id} value={u.name}>
                        {bn ? u.bn_name : u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {bn ? 'বিশেষত্ব (সর্বোচ্চ ৬টি) *' : 'Specialisations (up to 6) *'}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXPERT_CATEGORIES.map((c) => {
                    const active = specializations.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleSpecialization(c.id)}
                        className={`min-h-[44px] px-3.5 rounded-2xl border-2 text-xs font-bold transition-all active:scale-95 ${
                          active
                            ? 'bg-emerald-700 text-white border-emerald-700 dark:bg-emerald-300 dark:text-emerald-950 dark:border-emerald-300'
                            : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-slate-200 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {bn ? c.bn : c.en}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'অভিজ্ঞতা (বছর)' : 'Years of experience'}
                  </span>
                  <input
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value.replace(/[^0-9]/g, ''))}
                    inputMode="numeric"
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder="10"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'নিবন্ধন নম্বর (থাকলে)' : 'Registration no. (if any)'}
                  </span>
                  <input
                    value={registrationNo}
                    onChange={(e) => setRegistrationNo(e.target.value)}
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'রেফারেন্সের নাম' : 'Reference name'}
                  </span>
                  <input
                    value={referenceName}
                    onChange={(e) => setReferenceName(e.target.value)}
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                    {bn ? 'রেফারেন্সের ফোন' : 'Reference phone'}
                  </span>
                  <input
                    value={referencePhone}
                    onChange={(e) => setReferencePhone(e.target.value)}
                    inputMode="tel"
                    className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {bn ? 'সর্বজনীন পরিচিতি (ঐচ্ছিক)' : 'Public introduction (optional)'}
                </span>
                <textarea
                  value={publicBio}
                  onChange={(e) => setPublicBio(e.target.value.slice(0, 500))}
                  rows={2}
                  maxLength={500}
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  placeholder={
                    bn
                      ? 'কৃষক আপনার কার্ডে এই পরিচিতি দেখবেন...'
                      : 'This is what farmers will see on your expert card...'
                  }
                />
              </label>

              <label className="block">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {bn ? 'কেন বিশেষজ্ঞ হতে চান ও অভিজ্ঞতা *' : 'Motivation & experience *'}
                </span>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full px-4 py-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  placeholder={bn ? 'সংক্ষেপে লিখুন...' : 'Briefly describe...'}
                  required
                />
              </label>

              <label className="block">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {bn ? 'স্বার্থের দ্বন্দ্ব (সার/বিষ বিক্রির সাথে সম্পর্ক থাকলে লিখুন)' : 'Conflict of interest (input/agro-dealer links)'}
                </span>
                <input
                  value={conflictOfInterest}
                  onChange={(e) => setConflictOfInterest(e.target.value)}
                  className="mt-1.5 w-full min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  placeholder={bn ? 'না থাকলে খালি রাখুন' : 'Leave blank if none'}
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-emerald-700 to-green-600 hover:from-emerald-800 hover:to-green-700 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
                {bn ? 'আবেদন জমা দিন' : 'Submit application'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

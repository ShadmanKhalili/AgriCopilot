import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Mic,
  PhoneCall,
  Send,
  ShieldCheck,
  Square,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthProvider';
import {
  acceptConsultation,
  cancelConsultation,
  describeError,
  getConsultationCase,
  markMessagesRead,
  resolveConsultation,
  revokeConsent,
  sendMessage,
  submitRating,
  updateConsultationStatus,
  watchConsultation,
  watchMessages,
} from '../services/expertService';
import {
  CONSENT_ITEMS,
  MAX_VOICE_NOTE_CHARS,
  formatCountdown,
  statusColor,
  statusLabel,
  urgencyLabel,
  type Consultation,
  type ConsultationAdvisory,
  type ConsultationCase,
  type ConsultationMessage,
} from '../utils/expertTypes';
import toBn from '../utils/banglaNum';
import { markConsultationRead } from '../utils/expertReadState';
import { audioFeedback } from '../utils/audioFeedback';

interface ConsultationRoomProps {
  lang: 'bn' | 'en';
  consultationId: string;
  onClose: () => void;
  viewerRole?: 'farmer' | 'expert';
}

const MAX_RECORDING_SECONDS = 30;

const OUTCOMES = [
  { id: 'resolved_advice', bn: 'পরামর্শ দিয়ে সমাধান', en: 'Resolved with advice' },
  { id: 'field_visit', bn: 'মাঠ পরিদর্শনের পর সমাধান', en: 'Resolved after field visit' },
  { id: 'referred', bn: 'উর্ধ্বতনে / ডিএই-তে পাঠানো', en: 'Referred to DAE / senior' },
  { id: 'no_response', bn: 'কৃষক সাড়া দেননি', en: 'Farmer did not respond' },
];

export default function ConsultationRoom({ lang, consultationId, onClose, viewerRole }: ConsultationRoomProps) {
  const bn = lang === 'bn';
  const { user } = useAuth();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [caseData, setCaseData] = useState<ConsultationCase | null>(null);
  const [caseUnavailable, setCaseUnavailable] = useState(false);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showAdvisory, setShowAdvisory] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [advisory, setAdvisory] = useState({ confirmation: '', actions: '', dosage: '', followUpDays: '', escalateIf: '' });
  const [outcome, setOutcome] = useState('resolved_advice');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());
  const [accessLost, setAccessLost] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const readSetRef = useRef<Set<string>>(new Set());
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubC = watchConsultation(consultationId, setConsultation, () => setAccessLost(true));
    const unsubM = watchMessages(consultationId, setMessages, () => setAccessLost(true));
    return () => {
      unsubC();
      unsubM();
    };
  }, [consultationId]);

  useEffect(() => {
    let alive = true;
    getConsultationCase(consultationId)
      .then((data) => {
        if (alive) setCaseData(data);
      })
      .catch((error) => {
        console.warn('Case details unavailable:', error?.code || error);
        if (alive) setCaseUnavailable(true);
      });
    return () => {
      alive = false;
    };
  }, [consultationId]);

  // If the case cannot be opened (network or consent rules), don't spin forever.
  useEffect(() => {
    const timer = window.setTimeout(() => setLoadTimedOut(true), 7000);
    return () => window.clearTimeout(timer);
  }, [consultationId]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || !consultation) return;
    messages.forEach((m) => {
      if (m.senderId !== user.uid && !m.readAt && !readSetRef.current.has(m.id)) {
        readSetRef.current.add(m.id);
        void markMessagesRead(consultation.id, m, user.uid);
      }
    });
  }, [messages, user, consultation]);

  // Clear the global "new expert reply" badge for this case. Re-runs whenever
  // the expert sends something while the room is open. Only the farmer side
  // updates the marker; experts never see the farmer badge.
  useEffect(() => {
    if (!user || !consultation || consultation.farmerId !== user.uid) return;
    const parsed = consultation.lastMessageAt ? Date.parse(consultation.lastMessageAt) : NaN;
    markConsultationRead(consultation.id, Number.isFinite(parsed) ? parsed : Date.now());
  }, [user, consultation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        const recorder = mediaRecorderRef.current;
        if (recorder) {
          // Do not send a voice note when the room closes mid-recording.
          recorder.onstop = null;
          recorder.stop();
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const isExpertView =
    viewerRole === 'expert' || (!!user && !!consultation && consultation.expertId === user.uid);
  const isFarmerView =
    viewerRole === 'farmer' || (!!user && !!consultation && consultation.farmerId === user.uid);
  const consentActive =
    !!consultation && !consultation.consentRevoked && consultation.consentExpiresAtMs > nowTick;
  const isActiveStatus =
    !!consultation &&
    ['requested', 'accepted', 'in_progress', 'awaiting_farmer'].includes(consultation.status);

  const consentLabels = useMemo(
    () =>
      consultation
        ? CONSENT_ITEMS.filter((i) => consultation.consentScope?.includes(i.id)).map((i) =>
            bn ? i.bn : i.en
          )
        : [],
    [consultation, bn]
  );

  const speak = (value: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(value);
      utter.lang = 'bn-BD';
      utter.rate = 0.95;
      synth.speak(utter);
    } catch (e) {
      console.warn('Speech synthesis unavailable');
    }
  };

  const handleSend = async (partial: {
    type: ConsultationMessage['type'];
    text?: string;
    audioUrl?: string;
    advisory?: ConsultationAdvisory;
  }): Promise<boolean> => {
    if (!user || !consultation || sendingRef.current) return false;
    sendingRef.current = true;
    setIsSending(true);
    try {
      await sendMessage(consultation.id, {
        senderId: user.uid,
        senderRole: isExpertView ? 'expert' : 'farmer',
        type: partial.type,
        text: partial.text,
        audioUrl: partial.audioUrl,
        advisory: partial.advisory,
      });
      setText('');
      return true;
    } catch (error: any) {
      toast.error(describeError(error, lang));
      return false;
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(bn ? 'এই ব্রাউজারে রেকর্ডিং সমর্থিত নয়।' : 'Recording not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = 'audio/webm;codecs=opus';
      const recorder =
        typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(preferred)
          ? new MediaRecorder(stream, { mimeType: preferred })
          : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          if (dataUrl.length > MAX_VOICE_NOTE_CHARS) {
            toast.error(bn ? 'রেকর্ডিং বড় হয়ে গেছে — ছোট করে বলুন।' : 'Recording too large — keep it short.');
            return;
          }
          await handleSend({ type: 'voice', audioUrl: dataUrl });
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECONDS) {
            try {
              mediaRecorderRef.current?.stop();
            } catch (e) {
              // ignore
            }
            setIsRecording(false);
            if (timerRef.current) window.clearInterval(timerRef.current);
            return MAX_RECORDING_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
      audioFeedback.playTactileClick();
    } catch (e) {
      toast.error(bn ? 'মাইক্রোফোনের অনুমতি দরকার।' : 'Microphone permission is required.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    try {
      mediaRecorderRef.current?.stop();
    } catch (e) {
      // ignore
    }
    setIsRecording(false);
  };

  const handleAccept = async () => {
    if (!consultation || !user) return;
    try {
      await acceptConsultation(consultation.id, user.uid);
      toast.success(bn ? 'অনুরোধ গ্রহণ করা হয়েছে।' : 'Request accepted.');
    } catch (error: any) {
      toast.error(describeError(error, lang));
    }
  };

  const handleSendAdvisory = async () => {
    if (!advisory.confirmation.trim() || !advisory.actions.trim()) {
      toast.error(bn ? 'নিশ্চিত রোগ ও করণীয় লিখুন।' : 'Confirmation and actions are required.');
      return;
    }
    const sent = await handleSend({
      type: 'advisory',
      text: advisory.confirmation,
      advisory: {
        confirmation: advisory.confirmation.trim(),
        actions: advisory.actions.trim(),
        dosage: advisory.dosage.trim() || undefined,
        followUpDays: advisory.followUpDays ? Number(advisory.followUpDays) : undefined,
        escalateIf: advisory.escalateIf.trim() || undefined,
      },
    });
    if (!sent || !consultation) return;
    await updateConsultationStatus(consultation.id, 'awaiting_farmer', user!.uid, 'expert').catch(() => {});
    setShowAdvisory(false);
    setAdvisory({ confirmation: '', actions: '', dosage: '', followUpDays: '', escalateIf: '' });
    toast.success(bn ? 'পরামর্শ পাঠানো হয়েছে।' : 'Advisory sent.');
  };

  const handleResolve = async () => {
    if (!consultation || !user) return;
    try {
      await resolveConsultation(consultation.id, user.uid, outcome, outcomeNotes);
      setShowResolve(false);
      toast.success(bn ? 'মামলা সমাধান হিসেবে চিহ্নিত।' : 'Marked as resolved.');
    } catch (error: any) {
      toast.error(describeError(error, lang));
    }
  };

  const handleRevoke = async () => {
    if (!consultation || !user) return;
    if (!window.confirm(bn ? 'সম্মতি প্রত্যাহার করলে বিশেষজ্ঞ আর আপনার তথ্য দেখতে পারবেন না। নিশ্চিত?' : 'Revoking consent blocks the expert from seeing your data. Continue?')) {
      return;
    }
    try {
      await revokeConsent(consultation.id, user.uid);
      toast.success(bn ? 'সম্মতি প্রত্যাহার করা হয়েছে।' : 'Consent revoked.');
    } catch (error: any) {
      toast.error(describeError(error, lang));
    }
  };

  const handleCancel = async () => {
    if (!consultation || !user) return;
    try {
      await cancelConsultation(consultation.id, user.uid);
      toast.success(bn ? 'অনুরোধ বাতিল করা হয়েছে।' : 'Request cancelled.');
    } catch (error: any) {
      toast.error(describeError(error, lang));
    }
  };

  const handleRating = async () => {
    if (!consultation || !user || rating < 1) {
      toast.error(bn ? 'রেটিং দিন।' : 'Please pick a rating.');
      return;
    }
    try {
      await submitRating(consultation, user.uid, rating, feedback);
      toast.success(bn ? 'ধন্যবাদ! মতামত সংরক্ষণ হয়েছে।' : 'Thanks! Feedback saved.');
    } catch (error: any) {
      toast.error(describeError(error, lang));
    }
  };

  // Privacy first: the expert gets a closed door, never a spinner or stale data.
  if (
    isExpertView &&
    (accessLost || caseUnavailable || (consultation && !consentActive) || (!consultation && loadTimedOut))
  ) {
    return (
      <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <div className="w-full sm:max-w-md bg-white dark:bg-[#0c1c13] rounded-t-3xl sm:rounded-3xl p-6 text-center space-y-4">
          <Lock className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="font-black text-slate-900 dark:text-white">
            {bn ? 'এই মামলাটি এখন খোলা যাচ্ছে না' : 'This case is not open'}
          </p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {bn
              ? 'কৃষকের সম্মতি প্রত্যাহার বা মেয়াদ শেষ হয়েছে, অথবা সংযোগ পাওয়া যাচ্ছে না। এই কৃষকের কোনো তথ্য দেখানো হচ্ছে না।'
              : 'Consent was revoked or expired, or the network is unavailable. No farmer data is being shown.'}
          </p>
          <button
            onClick={onClose}
            className="w-full min-h-[52px] rounded-2xl bg-emerald-700 text-white font-black text-sm"
          >
            {bn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  if (!consultation && !loadTimedOut) {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-[#0c1c13] rounded-3xl p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
            {bn ? 'সংযোগ করা হচ্ছে...' : 'Connecting...'}
          </span>
          <button onClick={onClose} className="text-xs underline font-bold text-slate-500">
            {bn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <div className="w-full sm:max-w-md bg-white dark:bg-[#0c1c13] rounded-t-3xl sm:rounded-3xl p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <p className="font-black text-slate-900 dark:text-white">
            {bn ? 'মামলাটি এখন খোলা যাচ্ছে না' : 'This case cannot be opened'}
          </p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {bn
              ? 'সম্মতির মেয়াদ শেষ হয়েছে অথবা ইন্টারনেট সংযোগ নেই। কোনো তথ্য দেখানো হচ্ছে না।'
              : 'Consent may have ended, or the network is offline. No data is being shown.'}
          </p>
          <button
            onClick={onClose}
            className="w-full min-h-[52px] rounded-2xl bg-emerald-700 text-white font-black text-sm"
          >
            {bn ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  const counterpart = isExpertView ? consultation.farmerName : consultation.expertName;
  const canCallFarmer =
    isExpertView &&
    consentActive &&
    consultation.consentScope?.includes('phone') &&
    !!caseData?.consentSnapshot?.phone;

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-2xl h-[92dvh] sm:h-auto sm:max-h-[88dvh] flex flex-col bg-white dark:bg-[#0c1c13] rounded-t-3xl sm:rounded-3xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-green-600 dark:from-emerald-800 dark:to-emerald-700 text-white p-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base truncate">{counterpart || (bn ? 'কৃষক' : 'Farmer')}</h3>
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor(
                    consultation.status
                  )}`}
                >
                  {statusLabel(consultation.status, lang)}
                </span>
                {isActiveStatus && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/15 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatCountdown(consultation.slaDueAtMs, lang)}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-emerald-50/90 mt-1 truncate">
                {urgencyLabel(consultation.urgency, lang)} • {consultation.crop || (bn ? 'ফসল' : 'Crop')} •{' '}
                {consultation.upazila || consultation.district || (bn ? 'বাংলাদেশ' : 'Bangladesh')}
              </p>
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

          <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/15">
              <ShieldCheck className="w-3.5 h-3.5" />
              {consentActive
                ? bn
                  ? `সম্মতি সক্রিয় — ${toBn(Math.max(1, Math.ceil((consultation.consentExpiresAtMs - nowTick) / 86400000)))} দিন`
                  : `Consent active — ${Math.max(1, Math.ceil((consultation.consentExpiresAtMs - nowTick) / 86400000))} d`
                : bn
                ? 'সম্মতি নেই'
                : 'No consent'}
            </span>
            {isFarmerView && isActiveStatus && (
              <button
                type="button"
                onClick={handleRevoke}
                className="min-h-[32px] px-2.5 rounded-xl bg-white/15 hover:bg-white/25 font-black"
              >
                {bn ? 'সম্মতি প্রত্যাহার' : 'Revoke consent'}
              </button>
            )}
            {isFarmerView && isActiveStatus && (
              <button
                type="button"
                onClick={handleCancel}
                className="min-h-[32px] px-2.5 rounded-xl bg-white/15 hover:bg-white/25 font-black"
              >
                {bn ? 'বাতিল' : 'Cancel'}
              </button>
            )}
          </div>
        </div>

        {/* Case summary + actions */}
        <div className="px-4 pt-3 pb-2 border-b border-stone-200 dark:border-stone-800 shrink-0 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {bn ? 'শেয়ার করা তথ্য' : 'Shared data'}: {consentLabels.join(' • ') || (bn ? 'কিছুই না' : 'Nothing')}
            </span>
          </div>
          {caseData?.consentSnapshot?.diagnosisSummary && (
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 text-[11px] font-medium text-slate-700 dark:text-slate-200">
              <span className="font-black">{bn ? 'এআই রোগ নির্ণয়' : 'AI diagnosis'}: </span>
              {caseData.consentSnapshot.diagnosisSummary}
              {caseData.consentSnapshot.severity ? ` (${caseData.consentSnapshot.severity})` : ''}
            </div>
          )}
          {caseData?.symptoms && (
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 text-[11px] font-medium text-slate-700 dark:text-slate-200">
              <span className="font-black">{bn ? 'কৃষকের সমস্যা' : 'Farmer’s description'}: </span>
              {caseData.symptoms}
            </div>
          )}
          {caseData?.consentSnapshot.previousConsultations?.length ? (
            <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800 text-[11px] font-medium text-slate-700 dark:text-slate-200">
              <span className="font-black">{bn ? 'আগের পরামর্শ' : 'Previous consultations'}: </span>
              {caseData.consentSnapshot.previousConsultations.join(' • ')}
            </div>
          ) : null}
          {caseData?.gps && (
            <a
              href={`https://maps.google.com/?q=${caseData.gps.lat},${caseData.gps.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-black text-sky-700 dark:text-sky-300 underline"
            >
              <MapPin className="w-3.5 h-3.5" />
              {bn ? 'মাঠের অবস্থান দেখুন' : 'Open field location'}
            </a>
          )}
          {caseUnavailable && (
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {bn ? 'মামলার বিস্তারিত তথ্য এখন পাওয়া যাচ্ছে না।' : 'Case details are unavailable right now.'}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {isExpertView && consultation.status === 'requested' && (
              <button
                type="button"
                onClick={handleAccept}
                className="min-h-[44px] px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                {bn ? 'অনুরোধ গ্রহণ করুন' : 'Accept request'}
              </button>
            )}
            {isExpertView && canCallFarmer && (
              <a
                href={`tel:${caseData?.consentSnapshot.phone}`}
                className="min-h-[44px] px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <PhoneCall className="w-4 h-4" />
                {bn ? 'কৃষককে কল করুন' : 'Call farmer'}
              </a>
            )}
            {isExpertView && isActiveStatus && (
              <button
                type="button"
                onClick={() => setShowAdvisory((v) => !v)}
                className="min-h-[44px] px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <FileText className="w-4 h-4" />
                {bn ? 'পরামর্শ লিখুন' : 'Write advisory'}
              </button>
            )}
            {isExpertView && isActiveStatus && (
              <button
                type="button"
                onClick={() => setShowResolve((v) => !v)}
                className="min-h-[44px] px-4 rounded-2xl bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-800 dark:text-stone-100 font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                {bn ? 'সমাধান চিহ্নিত করুন' : 'Mark resolved'}
              </button>
            )}
            {isFarmerView && isActiveStatus && (
              <button
                type="button"
                onClick={() =>
                  handleSend({ type: 'system', text: bn ? 'কৃষক কলব্যাক চাইছেন।' : 'Farmer requests a callback.' })
                }
                className="min-h-[44px] px-4 rounded-2xl bg-sky-100 hover:bg-sky-200 dark:bg-sky-950/60 dark:hover:bg-sky-900 text-sky-800 dark:text-sky-200 font-black text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <PhoneCall className="w-4 h-4" />
                {bn ? 'কল চাই' : 'Request call'}
              </button>
            )}
          </div>

          <AnimatePresence>
            {showAdvisory && isExpertView && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
                  <input
                    value={advisory.confirmation}
                    onChange={(e) => setAdvisory({ ...advisory, confirmation: e.target.value })}
                    placeholder={bn ? 'নিশ্চিত রোগ / সমস্যা' : 'Confirmed diagnosis'}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <textarea
                    value={advisory.actions}
                    onChange={(e) => setAdvisory({ ...advisory, actions: e.target.value })}
                    rows={3}
                    placeholder={bn ? 'করণীয় ও প্রয়োগের নিয়ম' : 'What to do (steps)'}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={advisory.dosage}
                      onChange={(e) => setAdvisory({ ...advisory, dosage: e.target.value })}
                      placeholder={bn ? 'মাত্রা ও PHI' : 'Dosage & PHI'}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    />
                    <input
                      value={advisory.followUpDays}
                      onChange={(e) => setAdvisory({ ...advisory, followUpDays: e.target.value.replace(/[^0-9]/g, '') })}
                      placeholder={bn ? 'ফলোআপ (দিন)' : 'Follow-up (days)'}
                      inputMode="numeric"
                      className="w-full min-h-[44px] px-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    />
                    <input
                      value={advisory.escalateIf}
                      onChange={(e) => setAdvisory({ ...advisory, escalateIf: e.target.value })}
                      placeholder={bn ? 'কখন আবার জানাবেন' : 'When to escalate'}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendAdvisory}
                    disabled={isSending}
                    className="w-full min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {bn ? 'পরামর্শ পাঠান' : 'Send advisory'}
                  </button>
                </div>
              </motion.div>
            )}

            {showResolve && isExpertView && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 rounded-2xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/70 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {OUTCOMES.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setOutcome(o.id)}
                        className={`min-h-[40px] px-3 rounded-xl text-[11px] font-black border transition-all ${
                          outcome === o.id
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white dark:bg-stone-900 text-slate-700 dark:text-slate-200 border-stone-300 dark:border-stone-700'
                        }`}
                      >
                        {bn ? o.bn : o.en}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    rows={2}
                    placeholder={bn ? 'সংক্ষিপ্ত ফলাফল নোট' : 'Short outcome note'}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleResolve}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs"
                  >
                    {bn ? 'নিশ্চিত করুন' : 'Confirm resolution'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F8F6] dark:bg-[#090d16]">
          {messages.length === 0 && (
            <p className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-6">
              {isExpertView
                ? bn
                  ? 'কৃষকের অনুরোধ দেখে গ্রহণ করুন, তারপর উত্তর দিন।'
                  : 'Review the request, accept it, then respond.'
                : bn
                ? 'বিশেষজ্ঞ শীঘ্রই উত্তর দেবেন। আপনি এখন লিখতে বা ভয়েস পাঠাতে পারেন।'
                : 'The expert will reply soon. You can write or send a voice note now.'}
            </p>
          )}

          {messages.map((m) => {
            if (m.type === 'system') {
              return (
                <div key={m.id} className="text-center">
                  <span className="inline-block text-[11px] font-bold text-sky-800 dark:text-sky-200 bg-sky-100 dark:bg-sky-950/60 px-3 py-1.5 rounded-full">
                    {m.text}
                  </span>
                </div>
              );
            }
            const mine = m.senderId === user?.uid;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 border ${
                    mine
                      ? 'bg-emerald-700 text-white border-emerald-800 dark:bg-emerald-300 dark:text-emerald-950 dark:border-emerald-400'
                      : 'bg-white dark:bg-stone-900 text-slate-800 dark:text-slate-100 border-stone-200 dark:border-stone-700'
                  }`}
                >
                  {m.type === 'voice' && m.audioUrl && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider opacity-80 flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        {bn ? 'ভয়েস নোট' : 'Voice note'}
                      </span>
                      <audio controls src={m.audioUrl} className="max-w-[220px] h-10" />
                    </div>
                  )}

                  {m.type === 'advisory' && m.advisory && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1 opacity-90">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {bn ? 'যাচাইকৃত পরামর্শ' : 'Expert advisory'}
                      </span>
                      <p className="text-xs font-black">{m.advisory.confirmation}</p>
                      <p className="text-xs font-medium whitespace-pre-wrap">{m.advisory.actions}</p>
                      {m.advisory.dosage && (
                        <p className="text-[11px] font-bold opacity-90">
                          {bn ? 'মাত্রা / PHI' : 'Dosage / PHI'}: {m.advisory.dosage}
                        </p>
                      )}
                      {typeof m.advisory.followUpDays === 'number' && m.advisory.followUpDays > 0 && (
                        <p className="text-[11px] font-bold opacity-90">
                          {bn ? 'ফলোআপ' : 'Follow-up'}: {toBn(m.advisory.followUpDays)} {bn ? 'দিন পরে' : 'days'}
                        </p>
                      )}
                      {m.advisory.escalateIf && (
                        <p className="text-[11px] font-bold opacity-90">
                          {bn ? 'কখন জানাবেন' : 'Escalate if'}: {m.advisory.escalateIf}
                        </p>
                      )}
                      {!mine && (
                        <button
                          type="button"
                          onClick={() =>
                            speak(
                              [m.advisory!.confirmation, m.advisory!.actions, m.advisory!.dosage || '']
                                .filter(Boolean)
                                .join('. ')
                            )
                          }
                          className="min-h-[36px] px-3 rounded-xl bg-black/10 dark:bg-black/20 text-[11px] font-black flex items-center gap-1.5"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          {bn ? 'শুনুন' : 'Listen'}
                        </button>
                      )}
                    </div>
                  )}

                  {m.type !== 'advisory' && m.text && (
                    <p className="text-xs font-medium whitespace-pre-wrap">{m.text}</p>
                  )}

                  <span className={`mt-1 block text-[10px] font-bold ${mine ? 'opacity-70' : 'text-slate-400'}`}>
                    {m.senderRole === 'farmer' ? (bn ? 'কৃষক' : 'Farmer') : bn ? 'বিশেষজ্ঞ' : 'Expert'} •{' '}
                    {new Date(m.createdAt).toLocaleTimeString(bn ? 'bn-BD' : 'en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Closed / resolved banner and rating */}
        {['resolved', 'closed', 'cancelled', 'expired'].includes(consultation.status) && (
          <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#0c1c13] shrink-0 space-y-2">
            <p className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              {statusLabel(consultation.status, lang)}
              {consultation.outcome ? ` — ${consultation.outcome}` : ''}
            </p>
            {isFarmerView && !consultation.farmerRating && ['resolved', 'closed'].includes(consultation.status) && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-label={`${n} star`}
                      className="min-h-[44px] min-w-[36px] flex items-center justify-center"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          rating >= n ? 'text-amber-400 fill-amber-400' : 'text-stone-300 dark:text-stone-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <input
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={bn ? 'মতামত (ঐচ্ছিক)' : 'Feedback (optional)'}
                  className="flex-1 min-w-[160px] min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleRating}
                  className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs"
                >
                  {bn ? 'পাঠান' : 'Submit'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Composer */}
        {isActiveStatus && consentActive && (
          <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#0c1c13] shrink-0">
            <div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && text.trim()) {
                    e.preventDefault();
                    if (!sendingRef.current) handleSend({ type: 'text', text });
                  }
                }}
                placeholder={bn ? 'লিখুন...' : 'Type...'}
                className="flex-1 min-h-[48px] px-4 rounded-2xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="min-h-[48px] min-w-[48px] rounded-2xl bg-rose-600 text-white flex items-center justify-center gap-1.5 font-black text-xs px-3 animate-pulse"
                >
                  <Square className="w-4 h-4" />
                  {toBn(recordingSeconds)}s
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  aria-label={bn ? 'ভয়েস নোট রেকর্ড করুন' : 'Record voice note'}
                  className="min-h-[48px] min-w-[48px] rounded-2xl bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 flex items-center justify-center active:scale-95 transition-all"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                disabled={isSending || !text.trim()}
                onClick={() => handleSend({ type: 'text', text })}
                aria-label={bn ? 'পাঠান' : 'Send'}
                className="min-h-[48px] min-w-[48px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-50"
              >
                {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}

        {isActiveStatus && !consentActive && isFarmerView && (
          <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-amber-50 dark:bg-amber-950/40 shrink-0">
            <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {bn
                ? 'আপনি সম্মতি প্রত্যাহার করেছেন — বিশেষজ্ঞ এখন আর উত্তর দিতে পারবেন না। নতুন অনুরোধ করলে আবার দেখা যাবে।'
                : 'You revoked consent — the expert can no longer reply. Start a new request to share again.'}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

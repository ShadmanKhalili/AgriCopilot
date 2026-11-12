import React, { useEffect, useRef, useState } from 'react';
import {
  HeartPulse,
  Leaf,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Camera,
  Plus,
  Trash2,
  UserCheck,
  Image as ImageIcon,
  X,
  FileCheck,
  Cloud,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { audioFeedback } from '../utils/audioFeedback';
import toBn from '../utils/banglaNum';
import {
  addRecoveryLog,
  deleteRecoveryLog,
  listRecoveryLogs,
  loadLocalRecoveryLogs,
  makeLocalRecoveryLog,
  saveLocalRecoveryLogs,
  sortRecoveryLogs,
  RECOVERY_TEXT_MAX,
  type RecoveryLogEntry,
} from '../services/recoveryLog';

interface PlantHealthRecoveryTrackerProps {
  lang: Language;
  cropName?: string;
  diseaseName?: string;
  severity?: string;
  /** Pre-harvest interval in days, parsed from the treatment advice. */
  harvestIntervalDays?: number;
  initialPathway?: 'organic' | 'chemical';
  compact?: boolean;
  /**
   * Human expert layer: when provided, the (previously fake) "expert review"
   * toggle becomes an honest request that opens the consent wizard with this
   * observation's context.
   */
  onRequestExpert?: (seed: {
    category?: string;
    crop?: string;
    diagnosisSummary?: string;
    severity?: string;
  }) => void;
  /** Saved diagnosis this log belongs to. With `userId`, the log is kept in Firestore. */
  diagnosisId?: string | null;
  /** Signed-in user's uid. Without it (or without a diagnosis) the log stays on this device. */
  userId?: string | null;
}

/**
 * One step of the general guide. Deliberately has no numbers: nobody has
 * measured this farmer's crop, so the guide only says what to look for and
 * what to do.
 */
interface DayMilestone {
  day: number;
  labelBn: string;
  labelEn: string;
  /** The sign a farmer can check with their own eyes on this day. */
  lookForBn: string;
  lookForEn: string;
  descriptionBn: string;
  descriptionEn: string;
  actionItemBn: string;
  actionItemEn: string;
}

const RECOVERY_TIMELINES: {
  organic: DayMilestone[];
  chemical: DayMilestone[];
} = {
  organic: [
    {
      day: 1,
      labelBn: 'প্রথম স্প্রে',
      labelEn: 'First spray',
      lookForBn: 'দাগ এখনও থাকবে। আজ শুধু কোন কোন পাতায় দাগ আছে তা দেখে রাখুন।',
      lookForEn: 'Spots will still be there. Today just note which leaves have spots.',
      descriptionBn: 'নিমতেল বা ট্রাইকোডার্মা জাতীয় জৈব উপাদান রোগের বিস্তার কমাতে সাহায্য করতে পারে। ফল দেখা যেতে কয়েক দিন লাগে।',
      descriptionEn: 'Neem oil or Trichoderma-type bio products can help slow the spread. Results take a few days to show.',
      actionItemBn: 'সকালে বা বিকেলে পাতার উপরে ও নিচে স্প্রে করুন। বোতলের গায়ে লেখা মাত্রা মেনে চলুন।',
      actionItemEn: 'Spray the top and underside of leaves in the morning or late afternoon. Follow the dose on the label.',
    },
    {
      day: 3,
      labelBn: 'দাগ থামছে কি না',
      labelEn: 'Are spots stopping?',
      lookForBn: 'দাগের কিনারা শুকিয়ে হালকা বাদামি হচ্ছে কি না, আর নতুন পাতায় দাগ আসছে কি না দেখুন।',
      lookForEn: 'Check if spot edges are drying to light brown, and whether new leaves are getting spots.',
      descriptionBn: 'কাজ করলে সাধারণত পুরনো দাগ আর বড় হয় না। নতুন পাতায় দাগ ছড়ালে চিকিৎসা কাজ করছে না।',
      descriptionEn: 'When it works, old spots usually stop growing. If spots spread to new leaves, the treatment is not working.',
      actionItemBn: 'গাছের গোড়ায় জমে থাকা পানি সরিয়ে দিন এবং মাটির ভেজা ভাব দেখুন।',
      actionItemEn: 'Drain standing water at the base of the plants and check how wet the soil is.',
    },
    {
      day: 5,
      labelBn: 'নতুন পাতা',
      labelEn: 'New leaves',
      lookForBn: 'নতুন বের হওয়া পাতা সবুজ ও দাগহীন কি না দেখুন।',
      lookForEn: 'Check whether newly opened leaves are green and free of spots.',
      descriptionBn: 'পুরনো দাগওয়ালা পাতা আগের মতো হবে না। নতুন পাতা সুস্থ থাকাটাই ভালো লক্ষণ।',
      descriptionEn: 'Old spotted leaves will not turn back. Healthy new leaves are the good sign.',
      actionItemBn: 'প্রয়োজনে ভার্মিকম্পোস্ট বা জৈব সার দিন।',
      actionItemEn: 'Add vermicompost or organic manure if needed.',
    },
    {
      day: 7,
      labelBn: 'এক সপ্তাহ পর',
      labelEn: 'After one week',
      lookForBn: 'আক্রান্ত গাছ কি বাড়ছে, নাকি আরও গাছে রোগ ছড়িয়েছে? দুটোই খাতায় লিখুন।',
      lookForEn: 'Are the affected plants growing, or has the disease reached more plants? Note both.',
      descriptionBn: 'রোগ যদি আরও গাছে ছড়ায় বা আগের চেয়ে খারাপ দেখায়, অপেক্ষা না করে কৃষি কর্মকর্তার পরামর্শ নিন।',
      descriptionEn: 'If the disease reaches more plants or looks worse, do not wait: ask your local agriculture officer.',
      actionItemBn: 'দরকার হলে আবার স্প্রে করুন, আর খেত ঘুরে দেখুন।',
      actionItemEn: 'Spray again if needed and walk the whole field.',
    },
    {
      day: 14,
      labelBn: 'দুই সপ্তাহ পর',
      labelEn: 'After two weeks',
      lookForBn: 'নতুন দাগ বন্ধ হয়েছে কি না দেখুন। দাগ চলতে থাকলে বিশেষজ্ঞের মত নিন।',
      lookForEn: 'Check whether new spots have stopped. If spots continue, ask an expert.',
      descriptionBn: 'ফসল কতটা ভালো হলো তা শুধু আপনার খেত দেখেই বোঝা যাবে।',
      descriptionEn: 'Only your own field can show how well the crop has recovered.',
      actionItemBn: 'পরের মৌসুমে রোগ-সহনশীল জাত ও বীজ শোধন ব্যবহার করুন।',
      actionItemEn: 'Next season, use a tolerant variety and treat the seed.',
    },
  ],
  chemical: [
    {
      day: 1,
      labelBn: 'স্প্রের দিন',
      labelEn: 'Spray day',
      lookForBn: 'দাগ এখনও থাকবে। আজ শুধু কোন কোন পাতায় দাগ আছে তা দেখে রাখুন।',
      lookForEn: 'Spots will still be there. Today just note which leaves have spots.',
      descriptionBn: 'অনুমোদিত ছত্রাকনাশক বা ব্যাকটেরিয়ানাশক রোগের বিস্তার থামাতে সাহায্য করে।',
      descriptionEn: 'An approved fungicide or bactericide helps stop the spread.',
      actionItemBn: 'মাস্ক ও গ্লাভস পরে বোতলের গায়ে লেখা মাত্রায় স্প্রে করুন। বৃষ্টির সম্ভাবনা থাকলে অপেক্ষা করুন।',
      actionItemEn: 'Wear a mask and gloves and spray at the dose on the label. Wait if rain is likely.',
    },
    {
      day: 3,
      labelBn: 'দাগ থামছে কি না',
      labelEn: 'Are spots stopping?',
      lookForBn: 'ভেজা দাগের কিনারা শুকিয়ে বাদামি হচ্ছে কি না, আর নতুন পাতায় দাগ আসছে কি না দেখুন।',
      lookForEn: 'Check if wet-looking spot edges are drying to brown, and whether new leaves are getting spots.',
      descriptionBn: 'কাজ করলে সাধারণত পুরনো দাগ আর বড় হয় না। নতুন পাতায় দাগ ছড়ালে বিশেষজ্ঞের মত নিন।',
      descriptionEn: 'When it works, old spots usually stop growing. If spots spread to new leaves, ask an expert.',
      actionItemBn: 'কিছু দিন ইউরিয়া উপরি-প্রয়োগ বন্ধ রাখুন, যাতে নরম নতুন পাতায় রোগ না ধরে।',
      actionItemEn: 'Hold off on urea top-dressing for a few days so soft new leaves are not infected.',
    },
    {
      day: 5,
      labelBn: 'নতুন পাতা',
      labelEn: 'New leaves',
      lookForBn: 'নতুন বের হওয়া পাতা সবুজ ও দাগহীন কি না দেখুন।',
      lookForEn: 'Check whether newly opened leaves are green and free of spots.',
      descriptionBn: 'পুরনো দাগওয়ালা পাতা আগের মতো হবে না। নতুন পাতা সুস্থ থাকাটাই ভালো লক্ষণ।',
      descriptionEn: 'Old spotted leaves will not turn back. Healthy new leaves are the good sign.',
      actionItemBn: 'ফসল তোলার আগে অপেক্ষার সময় (PHI) গুনতে থাকুন।',
      actionItemEn: 'Keep counting the waiting time before harvest (PHI).',
    },
    {
      day: 7,
      labelBn: 'এক সপ্তাহ পর',
      labelEn: 'After one week',
      lookForBn: 'আক্রান্ত গাছ কি বাড়ছে, নাকি আরও গাছে রোগ ছড়িয়েছে? দুটোই খাতায় লিখুন।',
      lookForEn: 'Are the affected plants growing, or has the disease reached more plants? Note both.',
      descriptionBn: 'রোগ যদি আরও গাছে ছড়ায়, একই ওষুধ বারবার না দিয়ে কৃষি কর্মকর্তার পরামর্শ নিন।',
      descriptionEn: 'If the disease reaches more plants, do not keep repeating the same spray: ask your agriculture officer.',
      actionItemBn: 'অপেক্ষার সময় (PHI) শেষ না হওয়া পর্যন্ত ফসল তুলবেন না।',
      actionItemEn: 'Do not harvest until the waiting time (PHI) is over.',
    },
    {
      day: 14,
      labelBn: 'তোলার আগে যাচাই',
      labelEn: 'Check before harvest',
      lookForBn: 'নতুন দাগ বন্ধ হয়েছে কি না দেখুন। দাগ চলতে থাকলে বিশেষজ্ঞের মত নিন।',
      lookForEn: 'Check whether new spots have stopped. If spots continue, ask an expert.',
      descriptionBn: 'বোতলের গায়ে লেখা অপেক্ষার সময় পার হয়েছে কি না নিশ্চিত হয়ে তবেই ফসল তুলুন।',
      descriptionEn: 'Harvest only after the waiting time on the label has passed.',
      actionItemBn: 'ফসল তোলার আগে উপ-সহকারী কৃষি কর্মকর্তার সাথে কথা বলুন।',
      actionItemEn: 'Talk to your local agriculture officer before harvesting.',
    },
  ],
};

/** @deprecated Kept for compatibility; the log now uses `RecoveryLogEntry`. */
export interface FarmerObservation {
  id: string;
  actionTaken: string;
  actionDate: string;
  whatChanged: string;
  photoUrl?: string;
  expertReviewed: boolean;
  expertNotes?: string;
}

const todayIso = () => new Date().toISOString().split('T')[0];

export default function PlantHealthRecoveryTracker({
  lang,
  cropName = 'Paddy',
  diseaseName = 'Bacterial Leaf Blight',
  severity = 'Critical',
  // No default: a pre-harvest interval is a safety number. When it has not
  // been established the tracker must say so rather than print a guess.
  harvestIntervalDays,
  initialPathway = 'organic',
  compact = false,
  onRequestExpert,
  diagnosisId = null,
  userId = null,
}: PlantHealthRecoveryTrackerProps) {
  const bn = lang === 'bn';
  const num = (n: number) => (bn ? toBn(n) : String(n));

  const [pathway, setPathway] = useState<'organic' | 'chemical'>(initialPathway);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(1);

  // Farmer's own log
  const useCloud = Boolean(userId && diagnosisId);
  const [entries, setEntries] = useState<RecoveryLogEntry[]>([]);
  /** Ids of entries that are only on this device (not in Firestore). */
  const [deviceOnlyIds, setDeviceOnlyIds] = useState<Set<string>>(new Set());
  /** Photos stay in memory for this session only; never stored. */
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [newDate, setNewDate] = useState(todayIso());
  const [newChange, setNewChange] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);

  // Latest values for async callbacks.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const timeline = RECOVERY_TIMELINES[pathway];
  const currentMilestone = timeline[selectedDayIndex];

  /** Persist the device-only part of the log (text only). */
  const persistLocal = (all: RecoveryLogEntry[], onlyIds: Set<string> | null) => {
    const toStore = onlyIds ? all.filter((e) => onlyIds.has(e.id)) : all;
    saveLocalRecoveryLogs(diagnosisId, toStore);
  };

  // Load the log when the owner or diagnosis changes.
  useEffect(() => {
    let cancelled = false;
    const local = loadLocalRecoveryLogs(diagnosisId);
    if (!useCloud) {
      setEntries(local);
      setDeviceOnlyIds(new Set(local.map((e) => e.id)));
      return;
    }
    // Show anything already on the device right away, then merge in the record.
    setEntries(local);
    setDeviceOnlyIds(new Set(local.map((e) => e.id)));
    listRecoveryLogs(userId as string, diagnosisId as string)
      .then((remote) => {
        if (cancelled) return;
        const remoteIds = new Set(remote.map((e) => e.id));
        const stillLocal = local.filter((e) => !remoteIds.has(e.id));
        setEntries(sortRecoveryLogs([...remote, ...stillLocal]));
        setDeviceOnlyIds(new Set(stillLocal.map((e) => e.id)));
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('Recovery log load failed', error);
        toast.error(bn
          ? 'আপনার খাতা আনা যায়নি। এই ফোনে যা আছে তা দেখানো হচ্ছে।'
          : 'Could not load your record. Showing what is on this phone.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, diagnosisId]);

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

  const canSubmit = Boolean(newAction.trim() || newChange.trim());

  const handleAddObservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    audioFeedback.playTactileClick();

    const input = {
      diagnosisId: diagnosisId || 'local',
      date: newDate,
      action: newAction,
      change: newChange,
    };

    let entry: RecoveryLogEntry | null = null;
    let saved: Promise<void> | null = null;
    if (useCloud) {
      try {
        const res = addRecoveryLog(userId as string, input);
        entry = res.entry;
        saved = res.saved;
      } catch (error) {
        console.warn('Recovery log add failed', error);
        entry = null;
      }
    }
    const fallback = !entry;
    if (!entry) entry = makeLocalRecoveryLog(input);
    if (!entry) return;
    const added = entry;

    const nextEntries = sortRecoveryLogs([added, ...entriesRef.current]);
    setEntries(nextEntries);
    if (newPhotoUrl) setPhotos((prev) => ({ ...prev, [added.id]: newPhotoUrl }));

    if (!useCloud || fallback) {
      const nextIds = new Set(deviceOnlyIds);
      nextIds.add(added.id);
      setDeviceOnlyIds(nextIds);
      persistLocal(nextEntries, useCloud ? nextIds : null);
      if (useCloud) {
        toast.error(bn
          ? 'খাতায় সংরক্ষণ করা যায়নি। লেখাটি এই ফোনে রাখা হলো।'
          : 'Could not save to your record. The note is kept on this phone.');
      }
    }

    saved?.catch((error) => {
      console.warn('Recovery log save failed', error);
      toast.error(bn
        ? 'খাতায় সংরক্ষণ করা যায়নি। লেখাটি এই ফোনে রাখা হলো।'
        : 'Could not save to your record. The note is kept on this phone.');
      setDeviceOnlyIds((prev) => {
        const next = new Set(prev);
        next.add(added.id);
        persistLocal(entriesRef.current, next);
        return next;
      });
    });

    setNewAction('');
    setNewChange('');
    setNewPhotoUrl(null);
    setNewDate(todayIso());
    setShowAddForm(false);
  };

  const handleDeleteObservation = (id: string) => {
    audioFeedback.playTactileClick();
    const removed = entriesRef.current.find((o) => o.id === id);
    if (!removed) return;
    const nextEntries = entriesRef.current.filter((o) => o.id !== id);
    setEntries(nextEntries);
    setPhotos((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });

    const wasDeviceOnly = deviceOnlyIds.has(id);
    if (!useCloud || wasDeviceOnly) {
      const nextIds = new Set(deviceOnlyIds);
      nextIds.delete(id);
      setDeviceOnlyIds(nextIds);
      persistLocal(nextEntries, useCloud ? nextIds : null);
      return;
    }

    deleteRecoveryLog(userId as string, id).catch((error) => {
      console.warn('Recovery log delete failed', error);
      toast.error(bn ? 'খাতা থেকে মোছা যায়নি।' : 'Could not delete from your record.');
      setEntries((prev) => sortRecoveryLogs([removed, ...prev]));
    });
  };

  const handleRequestExpertReview = (id: string) => {
    audioFeedback.playTactileClick();
    const obs = entries.find((o) => o.id === id);
    onRequestExpert?.({
      category: 'crop_disease',
      crop: cropName,
      diagnosisSummary: obs
        ? [obs.action, obs.change].filter(Boolean).join(' — ')
        : diseaseName,
      severity,
    });
  };

  const formatDate = (iso: string) => (bn ? toBn(iso) : iso);
  const allSaved = useCloud && entries.every((e) => !deviceOnlyIds.has(e.id));

  // Pre-harvest interval: only from the real prop. Day 1 of the guide is the
  // spray day, so (day - 1) days have passed.
  const phiRemaining =
    pathway === 'chemical' && harvestIntervalDays
      ? Math.max(harvestIntervalDays - (currentMilestone.day - 1), 0)
      : null;

  return (
    <div className={`bg-gradient-to-br from-stone-950 via-[#0a150e] to-stone-900 border border-emerald-500/30 text-white rounded-3xl ${compact ? 'p-4' : 'p-5 sm:p-7'} shadow-2xl relative overflow-hidden space-y-6`}>

      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl text-white shrink-0">
            <HeartPulse className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-bold text-lg sm:text-xl text-white">
              {bn ? 'সেরে ওঠার নির্দেশনা ও আপনার খাতা' : 'Recovery guide and your log'}
            </h3>
            <p className="text-sm text-stone-300 mt-0.5">
              {cropName} • {diseaseName}
            </p>
          </div>
        </div>

        {/* Treatment pathway */}
        <div className="flex items-center p-1 bg-black/60 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handlePathwayChange('organic')}
            aria-pressed={pathway === 'organic'}
            className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer ${
              pathway === 'organic' ? 'bg-emerald-600 text-white' : 'text-stone-300 hover:text-white'
            }`}
          >
            <Leaf className="w-4 h-4 text-emerald-300" aria-hidden="true" />
            <span>{bn ? 'জৈব পদ্ধতি' : 'Organic'}</span>
          </button>
          <button
            type="button"
            onClick={() => handlePathwayChange('chemical')}
            aria-pressed={pathway === 'chemical'}
            className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-sm font-bold transition-all cursor-pointer ${
              pathway === 'chemical' ? 'bg-blue-600 text-white' : 'text-stone-300 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-blue-300" aria-hidden="true" />
            <span>{bn ? 'রাসায়নিক পদ্ধতি' : 'Chemical'}</span>
          </button>
        </div>
      </div>

      {/* General-guide notice */}
      <div className="relative z-10 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-sm text-amber-100">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="font-bold leading-relaxed">
          {bn
            ? 'সাধারণ নির্দেশনা — আপনার ফসলের আসল অবস্থা নিজে দেখে লিখে রাখুন।'
            : 'General guide. Check your own crop and note what you see.'}
        </p>
      </div>

      {/* Day picker */}
      <div className="space-y-2 relative z-10">
        <p className="text-sm font-bold text-stone-200">
          {bn ? 'স্প্রের পর কোন দিন?' : 'Which day after spraying?'}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {timeline.map((milestone, idx) => {
            const isSelected = selectedDayIndex === idx;
            return (
              <button
                key={milestone.day}
                type="button"
                onClick={() => handleDaySelect(idx)}
                aria-pressed={isSelected}
                className={`min-h-[56px] px-1 rounded-2xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? pathway === 'organic'
                      ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                      : 'bg-blue-600 text-white border-blue-400 font-bold'
                    : 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="block text-sm">{bn ? 'দিন' : 'Day'}</span>
                <span className="block text-lg font-bold leading-tight">{num(milestone.day)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day: what to look for, what it means, what to do */}
      <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-3 relative z-10 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
          <strong className="text-emerald-200 font-bold text-base">
            {bn ? `দিন ${num(currentMilestone.day)}: ${currentMilestone.labelBn}` : `Day ${currentMilestone.day}: ${currentMilestone.labelEn}`}
          </strong>
        </div>

        <div className="rounded-xl bg-black/30 border border-white/10 p-3 flex items-start gap-2.5">
          <Eye className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold text-white">{bn ? 'আজ যা দেখবেন' : 'What to look for'}</p>
            <p className="text-base text-stone-100 leading-relaxed">
              {bn ? currentMilestone.lookForBn : currentMilestone.lookForEn}
            </p>
          </div>
        </div>

        <p className="text-stone-300 leading-relaxed">
          {bn ? currentMilestone.descriptionBn : currentMilestone.descriptionEn}
        </p>

        <p className="text-emerald-100 leading-relaxed">
          <span className="font-bold text-emerald-300">{bn ? 'করণীয়: ' : 'What to do: '}</span>
          {bn ? currentMilestone.actionItemBn : currentMilestone.actionItemEn}
        </p>
      </div>

      {/* Harvest waiting time (PHI) */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1 relative z-10 text-sm">
        <div className="flex items-center gap-2 text-stone-200 font-bold">
          <Clock className="w-5 h-5 text-amber-400" aria-hidden="true" />
          <span>{bn ? 'ফসল তোলার আগে অপেক্ষা (PHI)' : 'Wait before harvest (PHI)'}</span>
        </div>
        {pathway === 'organic' ? (
          <p className="text-stone-300 leading-relaxed">
            {bn
              ? 'জৈব উপাদানেরও অপেক্ষার সময় থাকতে পারে। বোতলের গায়ে লেখা নিয়ম মানুন এবং খাওয়ার আগে ফসল ধুয়ে নিন।'
              : 'Organic products can also have a waiting time. Follow the label and wash produce before eating.'}
          </p>
        ) : harvestIntervalDays ? (
          <>
            <p className="text-base text-amber-200 font-bold">
              {bn
                ? `শেষ স্প্রের পর ${num(harvestIntervalDays)} দিন`
                : `${harvestIntervalDays} days after the last spray`}
            </p>
            <p className="text-stone-300 leading-relaxed">
              {phiRemaining && phiRemaining > 0
                ? (bn
                    ? `দিন ${num(currentMilestone.day)}-এ: আরও ${num(phiRemaining)} দিন অপেক্ষা করুন (স্প্রের দিনকে দিন ১ ধরে)।`
                    : `On day ${currentMilestone.day}: wait ${phiRemaining} more days (counting the spray day as day 1).`)
                : (bn
                    ? `দিন ${num(currentMilestone.day)}-এ অপেক্ষার সময় শেষ হওয়ার কথা। তবুও বোতলের গায়ে লেখা সময় মিলিয়ে নিন।`
                    : `By day ${currentMilestone.day} the waiting time should be over. Still check the label.`)}
            </p>
          </>
        ) : (
          <p className="text-stone-300 leading-relaxed">
            {bn
              ? 'অপেক্ষার সময় জানা যায়নি। বোতলের গায়ে লেখা সময় দেখুন বা স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।'
              : 'Waiting time not known. Check the label or ask your local agriculture officer.'}
          </p>
        )}
      </div>

      {/* Farmer's own log */}
      <div className="p-5 rounded-2xl bg-black/50 border border-white/10 space-y-4 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <FileCheck className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h4 className="font-bold text-base text-white">
                {bn ? 'আপনার খাতা' : 'Your log'}
                <span className="ml-2 text-sm font-normal text-stone-300">
                  ({bn ? `${num(entries.length)}টি লেখা` : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`})
                </span>
              </h4>
              <p className="text-sm text-stone-300">
                {bn
                  ? 'কী করলেন, কবে করলেন, আর কী দেখলেন — লিখে রাখুন'
                  : 'Note what you did, when, and what you saw'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              audioFeedback.playTactileClick();
              setShowAddForm(!showAddForm);
            }}
            className="min-h-[56px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {showAddForm ? <X className="w-5 h-5" aria-hidden="true" /> : <Plus className="w-5 h-5" aria-hidden="true" />}
            <span>{showAddForm ? (bn ? 'বাতিল' : 'Cancel') : (bn ? 'নতুন লেখা যোগ করুন' : 'Add entry')}</span>
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddObservation} className="p-4 rounded-xl bg-white/5 border border-emerald-500/30 space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="recovery-action" className="block text-sm font-bold text-stone-200 mb-1">
                  {bn ? 'কী করেছেন?' : 'What did you do?'}
                </label>
                <input
                  id="recovery-action"
                  type="text"
                  maxLength={RECOVERY_TEXT_MAX}
                  placeholder={bn ? 'যেমন: আক্রান্ত পাতা কেটে ফেলেছি, স্প্রে করেছি' : 'e.g. removed sick leaves, sprayed'}
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full min-h-[48px] bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-400 text-base"
                />
              </div>

              <div>
                <label htmlFor="recovery-date" className="block text-sm font-bold text-stone-200 mb-1">
                  {bn ? 'তারিখ' : 'Date'}
                </label>
                <input
                  id="recovery-date"
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full min-h-[48px] bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-400 text-base"
                />
              </div>
            </div>

            <div>
              <label htmlFor="recovery-change" className="block text-sm font-bold text-stone-200 mb-1">
                {bn ? 'কী দেখলেন?' : 'What did you see?'}
              </label>
              <textarea
                id="recovery-change"
                rows={2}
                maxLength={RECOVERY_TEXT_MAX}
                placeholder={bn ? 'যেমন: দাগ শুকিয়ে গেছে, নতুন পাতায় দাগ নেই' : 'e.g. spots dried up, no spots on new leaves'}
                value={newChange}
                onChange={(e) => setNewChange(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-stone-500 focus:outline-none focus:border-emerald-400 text-base resize-none"
              />
              <p className="text-sm text-stone-400 mt-1">
                {bn ? 'অন্তত একটি ঘর পূরণ করুন।' : 'Fill in at least one of the two boxes.'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer min-h-[48px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-stone-100 border border-white/10 text-sm font-bold flex items-center gap-2 transition-colors">
                  <Camera className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                  <span>{newPhotoUrl ? (bn ? 'ছবি যোগ হয়েছে' : 'Photo added') : (bn ? 'ছবি যোগ করুন' : 'Add photo')}</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
                {newPhotoUrl && (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-emerald-400 shrink-0">
                    <img src={newPhotoUrl} alt={bn ? 'যোগ করা ছবি' : 'Added photo'} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setNewPhotoUrl(null)}
                      aria-label={bn ? 'ছবি সরান' : 'Remove photo'}
                      className="absolute inset-0 bg-black/60 text-white flex items-center justify-center"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-stone-400">
                {bn
                  ? 'ছবি শুধু এখন এই ফোনে দেখা যাবে, সংরক্ষণ হবে না।'
                  : 'The photo stays on this phone for now only. It is not saved.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-400 text-white font-bold text-lg transition-all cursor-pointer disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {bn ? 'খাতায় লিখুন' : 'Save entry'}
            </button>
          </form>
        )}

        <div className="space-y-2.5">
          {entries.length === 0 ? (
            <div className="p-6 text-center text-stone-400 text-sm border border-dashed border-white/10 rounded-2xl">
              {bn ? 'এখনও কিছু লেখা হয়নি।' : 'Nothing noted yet.'}
            </div>
          ) : (
            entries.map((obs) => {
              const photo = photos[obs.id];
              return (
                <div
                  key={obs.id}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <span className="inline-block text-sm text-stone-300 bg-stone-900 px-2 py-0.5 rounded-md border border-stone-800">
                        {formatDate(obs.date)}
                      </span>
                      {obs.action && (
                        <p className="text-white text-base">
                          <span className="font-bold">{bn ? 'করেছি: ' : 'Did: '}</span>
                          {obs.action}
                        </p>
                      )}
                      {obs.change && (
                        <p className="text-stone-200 leading-relaxed">
                          <span className="font-bold">{bn ? 'দেখেছি: ' : 'Saw: '}</span>
                          {obs.change}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onRequestExpert && (
                        <button
                          type="button"
                          onClick={() => handleRequestExpertReview(obs.id)}
                          className="min-h-[44px] px-3 rounded-lg border border-white/10 bg-stone-800/80 text-stone-200 text-sm font-bold flex items-center gap-1 hover:text-white transition-all cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" aria-hidden="true" />
                          {bn ? 'বিশেষজ্ঞের মত' : 'Ask expert'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteObservation(obs.id)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-300 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        aria-label={bn ? 'মুছে ফেলুন' : 'Delete'}
                        title={bn ? 'মুছে ফেলুন' : 'Delete'}
                      >
                        <Trash2 className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {photo && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-sm text-stone-300 flex items-center gap-1">
                        <ImageIcon className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                        {bn ? 'ছবি (শুধু এখন):' : 'Photo (this session only):'}
                      </span>
                      <a
                        href={photo}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block w-14 h-14 rounded-lg overflow-hidden border border-emerald-500/40"
                      >
                        <img src={photo} alt={bn ? 'মাঠের ছবি' : 'Field photo'} className="w-full h-full object-cover" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="flex items-center gap-2 text-sm text-stone-300">
          {allSaved ? (
            <>
              <Cloud className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              {bn ? 'আপনার খাতায় সংরক্ষিত' : 'Saved to your record'}
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4 text-amber-400" aria-hidden="true" />
              {bn ? 'শুধু এই ফোনে রাখা আছে' : 'Kept on this phone only'}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

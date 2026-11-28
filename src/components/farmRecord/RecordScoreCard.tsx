import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import { Language } from '../../utils/translations';
import { toBn } from '../../utils/banglaNum';
import { fetchRecordScore, refreshRecordScore, type StoredRecordScore } from '../../services/farmRecord';
import {
  RECORD_LEVEL_LABELS,
  RECORD_PILLAR_LABELS,
} from '../../../netlify/functions/_shared/farm-record-model';

interface Props {
  lang: Language;
}

type Notice = 'too_soon' | 'not_configured' | 'failed' | null;

const NOTICE_TEXT: Record<Exclude<Notice, null>, { bn: string; en: string }> = {
  too_soon: {
    bn: 'কয়েক মিনিট পরে আবার হিসাব করতে পারবেন।',
    en: 'You can recalculate again in a few minutes.',
  },
  not_configured: {
    bn: 'এই সুবিধা এখনো চালু হয়নি।',
    en: 'Not set up yet.',
  },
  failed: {
    bn: 'হিসাব করা গেল না। ইন্টারনেট দেখে আবার চেষ্টা করুন।',
    en: 'Could not calculate. Check your internet and try again.',
  },
};

const DISCLAIMER = {
  bn: 'এই স্কোর দেখায় আপনার নিজের খামারের রেকর্ড কতটা পূর্ণ ও নিয়মিত। আপনার দেওয়া তথ্য থেকে অ্যাগ্রিকোপাইলটের সার্ভার এটি হিসাব করে। কেউ এটি যাচাই করেনি। এটি ঋণ অনুমোদন নয়।',
  en: "This score shows how complete and regular your own farm record is. It is calculated by AgriCopilot's server from what you entered, and nobody has checked it. It is not a loan approval.",
};

const levelTone = (level: StoredRecordScore['level']): string => {
  if (level === 'strong' || level === 'good') {
    return 'text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800';
  }
  if (level === 'building') {
    return 'text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800';
  }
  return 'text-stone-800 dark:text-stone-200 bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700';
};

export default function RecordScoreCard({ lang }: Props) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const bn = lang === 'bn';
  const num = (n: number) => (bn ? toBn(n) : String(n));

  const [score, setScore] = useState<StoredRecordScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!uid) {
      setScore(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRecordScore()
      .then((s) => {
        if (!cancelled) setScore(s);
      })
      .catch(() => {
        if (!cancelled) setScore(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const recalculate = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await refreshRecordScore();
      if (result.ok === false) {
        setNotice(result.reason === 'signed_out' ? 'failed' : result.reason);
      } else {
        setScore(result.score);
      }
    } catch {
      setNotice('failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const heading = bn ? 'খামার রেকর্ড স্কোর' : 'Farm record score';

  const computedDate = score
    ? new Date(score.computedAt).toLocaleDateString(bn ? 'bn-BD' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <section
      aria-label={heading}
      className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-md space-y-5 print:hidden"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white">{heading}</h2>
      </div>

      {!uid && (
        <p className="text-base font-semibold text-stone-800 dark:text-stone-200">
          {bn ? 'আপনার খামার রেকর্ড স্কোর পেতে সাইন ইন করুন।' : 'Sign in to get your farm record score.'}
        </p>
      )}

      {uid && loading && (
        <p className="text-base text-stone-600 dark:text-stone-400" role="status">
          {bn ? 'স্কোর দেখা হচ্ছে...' : 'Loading your score...'}
        </p>
      )}

      {uid && !loading && !score && (
        <p className="text-base text-stone-700 dark:text-stone-300">
          {bn
            ? 'এখনো কোনো স্কোর হিসাব করা হয়নি। নিচের বোতাম চাপুন।'
            : 'No score has been calculated yet. Press the button below.'}
        </p>
      )}

      {uid && score && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`px-5 py-3 rounded-2xl border flex items-baseline gap-2 ${levelTone(score.level)}`}>
              <span className="text-4xl font-black tracking-tight">{num(score.score)}</span>
              <span className="text-base font-semibold opacity-80">/ {num(100)}</span>
            </div>
            <span
              className={`px-4 py-2 rounded-full border text-base font-bold ${levelTone(score.level)}`}
            >
              {bn ? RECORD_LEVEL_LABELS[score.level].bn : RECORD_LEVEL_LABELS[score.level].en}
            </span>
          </div>

          <ul className="space-y-4">
            {score.pillars.map((p) => {
              const label = RECORD_PILLAR_LABELS[p.key];
              const full = p.points >= p.max;
              const pct = p.max > 0 ? Math.min(100, Math.round((p.points / p.max) * 100)) : 0;
              return (
                <li key={p.key} className="space-y-1.5">
                  <div className="flex justify-between gap-3 text-base font-semibold text-stone-800 dark:text-stone-200">
                    <span>{bn ? label.bn : label.en}</span>
                    <span className="font-bold text-stone-900 dark:text-white shrink-0">
                      {num(p.points)}/{num(p.max)}
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={p.max}
                    aria-valuenow={p.points}
                    aria-label={bn ? label.bn : label.en}
                  >
                    <div
                      className={`h-full rounded-full ${full ? 'bg-emerald-600' : 'bg-amber-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!full && (
                    <p className="text-sm text-amber-900 dark:text-amber-300">
                      {bn ? label.howBn : label.howEn}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <p className="text-sm text-stone-600 dark:text-stone-400">
            {bn ? `হিসাব করা হয়েছে: ${computedDate}` : `Calculated on ${computedDate}`}
          </p>
        </div>
      )}

      {uid && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={recalculate}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 min-h-[56px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-base font-bold shadow-sm disabled:opacity-60 cursor-pointer active:scale-95 transition-all"
          >
            <RefreshCw className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
            {bn ? 'আবার হিসাব করুন' : 'Recalculate'}
            {bn ? ' / Recalculate' : ' / আবার হিসাব করুন'}
          </button>
          {notice && (
            <p
              role="status"
              className="text-base font-semibold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl px-4 py-3"
            >
              {bn ? NOTICE_TEXT[notice].bn : NOTICE_TEXT[notice].en}
            </p>
          )}
        </div>
      )}

      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-3">
        {bn ? DISCLAIMER.bn : DISCLAIMER.en}
      </p>
    </section>
  );
}

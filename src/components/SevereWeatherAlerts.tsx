import React, { useMemo, useState } from 'react';
import { AlertTriangle, AlertOctagon, Info, ShieldAlert, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';
import { toBn } from '../utils/banglaNum';

export type WeatherAlertKind = 'heavy_rain' | 'storm' | 'blight' | 'heat' | 'wind' | 'official';

export interface WeatherAlertFacts {
  rainChance?: number;
  humidity?: number;
  dewPointDepression?: number;
  heatIndex?: number;
  wind?: number;
  gust?: number;
}

export interface WeatherAlertItem {
  id: string;
  event: string;
  severity: 'minor' | 'moderate' | 'severe' | 'extreme';
  headline: string;
  description: string;
  effective: string;
  expires: string;
  agroImpact: string;
  kind?: WeatherAlertKind;
  facts?: WeatherAlertFacts;
  dataSource?: {
    name: string;
    authorityUri: string;
  };
}

interface Props {
  alerts: WeatherAlertItem[];
  lang: Language;
}

interface LocalText {
  title: string;
  explain: string;
  advice: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Farmer-level text per generated alert kind, in both languages. Returns null for official/unknown kinds. */
function localText(alert: WeatherAlertItem, lang: Language): LocalText | null {
  const f = alert.facts || {};
  const bn = lang === 'bn';
  const n = (v: number) => (bn ? toBn(Math.round(v)) : String(Math.round(v)));
  const n1 = (v: number) => (bn ? toBn(v.toFixed(1)) : v.toFixed(1));

  switch (alert.kind) {
    case 'heavy_rain':
      return bn
        ? {
            title: 'ভারী বৃষ্টির সম্ভাবনা',
            explain: `${isNum(f.rainChance) ? `বৃষ্টির সম্ভাবনা ${n(f.rainChance)}%। ` : ''}নিচু জমিতে পানি জমতে পারে।`,
            advice: 'জমির নালা পরিষ্কার রাখুন। আজ স্প্রে বা সার দেবেন না।',
          }
        : {
            title: 'Heavy rain likely',
            explain: `${isNum(f.rainChance) ? `Chance of rain is ${n(f.rainChance)}%. ` : ''}Water may collect in low fields.`,
            advice: 'Keep field drains clear. Do not spray or apply fertilizer today.',
          };
    case 'storm':
      return bn
        ? {
            title: 'ঝড়ো বৃষ্টির সতর্কতা',
            explain: `আগামী দুই দিনে ঝড়ের সঙ্গে ভারী বৃষ্টি হতে পারে।${isNum(f.rainChance) ? ` বৃষ্টির সম্ভাবনা ${n(f.rainChance)}%।` : ''}`,
            advice: 'জমির নালা পরিষ্কার রাখুন। কাটা ফসল ঢেকে রাখুন। বৃষ্টির আগে সার দেবেন না।',
          }
        : {
            title: 'Storm and heavy rain warning',
            explain: `Heavy rain with storms may come in the next 2 days.${isNum(f.rainChance) ? ` Chance of rain is ${n(f.rainChance)}%.` : ''}`,
            advice: 'Keep field drains clear. Cover harvested crops. Do not apply fertilizer before the rain.',
          };
    case 'blight':
      return bn
        ? {
            title: 'রোগের ঝুঁকি বেশি (ব্লাইট)',
            explain: `${isNum(f.humidity) ? `বাতাসে আর্দ্রতা ${n(f.humidity)}%। ` : ''}এমন আবহাওয়ায় আলু ও ধানে ছত্রাকের রোগ দ্রুত ছড়ায়।`,
            advice: 'আজই আলু ও বোরো বীজতলা দেখুন। রোগ দেখা দেওয়ার আগে ছত্রাকনাশক স্প্রে করুন।',
          }
        : {
            title: 'High risk of blight disease',
            explain: `${isNum(f.humidity) ? `Air humidity is ${n(f.humidity)}%. ` : ''}In this weather, fungal diseases spread fast in potato and rice.`,
            advice: 'Check potato and boro seedbeds today. Spray a fungicide before the disease shows.',
          };
    case 'heat':
      return bn
        ? {
            title: 'তীব্র গরম',
            explain: `${isNum(f.heatIndex) ? `অনুভূত তাপমাত্রা ${n1(f.heatIndex)}°সে। ` : ''}গরমে মাটি তাড়াতাড়ি শুকায়। ফুল আসা ফসল ও গবাদি পশুর ক্ষতি হতে পারে।`,
            advice: 'ধানের জমিতে ৫-৭ সেমি পানি রাখুন। দুপুরে স্প্রে করবেন না। পশুকে ছায়া ও পানি দিন।',
          }
        : {
            title: 'Very hot weather',
            explain: `${isNum(f.heatIndex) ? `It feels like ${n1(f.heatIndex)}°C. ` : ''}Soil dries fast. Flowering crops and farm animals can be hurt.`,
            advice: 'Keep 5-7 cm of water in paddy fields. Do not spray at midday. Give animals shade and water.',
          };
    case 'wind':
      return bn
        ? {
            title: 'জোর বাতাস, স্প্রে করবেন না',
            explain: `${isNum(f.wind) ? `বাতাসের গতি ঘণ্টায় ${n(f.wind)} কিমি` : 'বাতাস জোরে বইছে'}${isNum(f.gust) ? `, দমকা বাতাস ${n(f.gust)} কিমি পর্যন্ত` : ''}। স্প্রে উড়ে যাবে।`,
            advice: 'এখন কীটনাশক বা সার স্প্রে করবেন না। বাতাস কমলে করুন।',
          }
        : {
            title: 'Strong wind, do not spray',
            explain: `${isNum(f.wind) ? `Wind speed is ${n(f.wind)} km/h` : 'The wind is strong'}${isNum(f.gust) ? `, gusts up to ${n(f.gust)} km/h` : ''}. Spray will blow away.`,
            advice: 'Do not spray pesticide or fertilizer now. Wait until the wind is calmer.',
          };
    default:
      return null;
  }
}

const severityRank: Record<string, number> = { extreme: 3, severe: 2, moderate: 1, minor: 0 };

const severityLabel = (sev: string, lang: Language) => {
  const s = sev.toLowerCase();
  if (s === 'extreme' || s === 'severe') return lang === 'bn' ? 'জরুরি সতর্কতা' : 'Severe warning';
  if (s === 'moderate') return lang === 'bn' ? 'সতর্কতা' : 'Warning';
  return lang === 'bn' ? 'খেয়াল রাখুন' : 'Notice';
};

const getSeverityStyle = (sev: string) => {
  switch (sev.toLowerCase()) {
    case 'extreme':
      return {
        bg: 'bg-red-50 border-red-400 text-red-950 dark:bg-rose-950/40 dark:border-rose-600/40 dark:text-rose-200',
        badge: 'bg-red-700 text-white border-red-800 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
        iconWrap: 'bg-red-100 dark:bg-black/20',
        icon: <AlertOctagon className="w-6 h-6 text-red-700 dark:text-rose-400 shrink-0" aria-hidden="true" />,
        inner: 'bg-white/80 border-red-200 dark:bg-black/25 dark:border-white/10',
        divider: 'border-red-200 dark:border-white/10',
      };
    case 'severe':
      return {
        bg: 'bg-red-50 border-red-300 text-red-950 dark:bg-amber-950/40 dark:border-amber-500/40 dark:text-amber-200',
        badge: 'bg-red-700 text-white border-red-800 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
        iconWrap: 'bg-red-100 dark:bg-black/20',
        icon: <AlertTriangle className="w-6 h-6 text-red-700 dark:text-amber-400 shrink-0" aria-hidden="true" />,
        inner: 'bg-white/80 border-red-200 dark:bg-black/25 dark:border-white/10',
        divider: 'border-red-200 dark:border-white/10',
      };
    case 'moderate':
      return {
        bg: 'bg-amber-50 border-amber-400 text-amber-950 dark:bg-yellow-950/30 dark:border-yellow-500/30 dark:text-yellow-200',
        badge: 'bg-amber-200 text-amber-950 border-amber-500 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40',
        iconWrap: 'bg-amber-100 dark:bg-black/20',
        icon: <ShieldAlert className="w-6 h-6 text-amber-700 dark:text-yellow-400 shrink-0" aria-hidden="true" />,
        inner: 'bg-white/80 border-amber-200 dark:bg-black/25 dark:border-white/10',
        divider: 'border-amber-200 dark:border-white/10',
      };
    default:
      return {
        bg: 'bg-sky-50 border-sky-300 text-sky-950 dark:bg-blue-950/30 dark:border-blue-500/30 dark:text-blue-200',
        badge: 'bg-sky-100 text-sky-950 border-sky-400 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
        iconWrap: 'bg-sky-100 dark:bg-black/20',
        icon: <Info className="w-6 h-6 text-sky-700 dark:text-blue-400 shrink-0" aria-hidden="true" />,
        inner: 'bg-white/80 border-sky-200 dark:bg-black/25 dark:border-white/10',
        divider: 'border-sky-200 dark:border-white/10',
      };
  }
};

export default function SevereWeatherAlerts({ alerts, lang }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedAlertIndex, setSelectedAlertIndex] = useState(0);

  // Most severe first (stable), so the first card shown is the one that matters most.
  const sorted = useMemo(
    () =>
      (alerts || [])
        .map((a, i) => ({ a, i }))
        .sort((x, y) => (severityRank[y.a.severity] ?? 0) - (severityRank[x.a.severity] ?? 0) || x.i - y.i)
        .map((x) => x.a),
    [alerts]
  );

  if (sorted.length === 0) {
    return null;
  }

  const bn = lang === 'bn';
  const activeAlert = sorted[selectedAlertIndex] || sorted[0];
  const currentStyle = getSeverityStyle(activeAlert.severity);
  const local = localText(activeAlert, lang);

  const formatAlertTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return isoString;
      return d.toLocaleTimeString(bn ? 'bn-BD' : [], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const title = local ? local.title : activeAlert.event;
  const countLabel = (i: number) => (bn ? `${toBn(i)}/${toBn(sorted.length)}` : `${i}/${sorted.length}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className={`rounded-2xl border-2 p-4 sm:p-5 transition-all shadow-sm ${currentStyle.bg}`}
    >
      {/* Alert Header Ribbon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${currentStyle.iconWrap}`}>{currentStyle.icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-black px-2 py-0.5 rounded-md border ${currentStyle.badge}`}>
                {severityLabel(activeAlert.severity, lang)}
              </span>
              {sorted.length > 1 && (
                <span className="text-sm font-semibold tabular-nums text-stone-700 dark:text-stone-400">
                  ({countLabel(selectedAlertIndex + 1)})
                </span>
              )}
            </div>
            <h4 className="text-lg font-bold mt-1 leading-snug">{title}</h4>
            <p className="text-sm text-stone-700 dark:text-stone-400 mt-0.5 tabular-nums">
              {bn ? 'মেয়াদ শেষ:' : 'Expires:'} {formatAlertTime(activeAlert.expires)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-black/20 dark:hover:bg-black/30 text-stone-800 dark:text-stone-300 transition-colors cursor-pointer"
          aria-label={bn ? 'বিস্তারিত দেখান বা লুকান' : 'Show or hide details'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Pager */}
      {sorted.length > 1 && (
        <div className="flex items-center flex-wrap mt-1" role="group" aria-label={bn ? 'সতর্কতার তালিকা' : 'Alert list'}>
          {sorted.map((_, idx) => {
            const selected = selectedAlertIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedAlertIndex(idx)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
                aria-label={
                  bn
                    ? `সতর্কতা ${toBn(idx + 1)}, মোট ${toBn(sorted.length)}টি`
                    : `Alert ${idx + 1} of ${sorted.length}`
                }
                aria-current={selected ? 'true' : undefined}
              >
                <span
                  className={`block h-3 rounded-full transition-all ${
                    selected
                      ? 'w-6 bg-stone-900 dark:bg-white'
                      : 'w-3 bg-stone-400 dark:bg-stone-600'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Expanded Alert Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-3 pt-3 border-t space-y-3 text-sm overflow-hidden ${currentStyle.divider}`}
          >
            {local ? (
              <p className="text-base leading-relaxed">{local.explain}</p>
            ) : (
              <>
                {activeAlert.headline && activeAlert.headline !== activeAlert.event && (
                  <p className="font-semibold text-base leading-snug">{activeAlert.headline}</p>
                )}
                <p className="leading-relaxed text-sm">{activeAlert.description}</p>
              </>
            )}

            {/* Farm Action Guidance */}
            <div className={`rounded-xl p-3 border ${currentStyle.inner}`}>
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-1">
                <span aria-hidden="true">🌾</span>
                <span>{bn ? 'জমিতে কী করবেন' : 'What to do on the farm'}</span>
              </div>
              <p className="text-base leading-relaxed">{local ? local.advice : activeAlert.agroImpact}</p>
            </div>

            {/* Attribution */}
            <div className={`pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-stone-700 dark:text-stone-400 gap-1 border-t ${currentStyle.divider}`}>
              <div className="flex items-center gap-1 flex-wrap">
                <span>{bn ? 'তথ্য উৎস:' : 'Data Source:'}</span>
                {activeAlert.dataSource ? (
                  <a
                    href={activeAlert.dataSource.authorityUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-800 hover:text-sky-900 dark:text-cyan-400 dark:hover:text-cyan-300 underline inline-flex items-center gap-0.5"
                  >
                    <span>{activeAlert.dataSource.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span>{bn ? 'গুগল ম্যাপ প্ল্যাটফর্ম আবহাওয়া সতর্কতা' : 'Google Maps Platform Weather Alerts'}</span>
                )}
              </div>
              <div className="font-mono text-sm">Google Maps</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

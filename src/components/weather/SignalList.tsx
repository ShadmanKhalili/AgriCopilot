import React from 'react';
import { CheckCircle2, Clock, Droplets, FlaskConical, SprayCan, XCircle } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { SignalKind, SignalStatus, TodaySignal } from '../../utils/todaySignals';

type IconType = React.ComponentType<{ className?: string }>;

export const KIND_ICON: Record<SignalKind, IconType> = {
  spray: SprayCan,
  irrigate: Droplets,
  fertilise: FlaskConical,
};

export const KIND_LABEL: Record<SignalKind, { bn: string; en: string }> = {
  spray: { bn: 'স্প্রে', en: 'Spray' },
  irrigate: { bn: 'সেচ', en: 'Irrigation' },
  fertilise: { bn: 'সার', en: 'Fertiliser' },
};

// Colour is never the only cue: each status also has its own icon.
export const STATUS_STYLE: Record<SignalStatus, { ring: string; icon: IconType; iconColor: string }> = {
  go: { ring: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800', icon: CheckCircle2, iconColor: 'text-emerald-700 dark:text-emerald-400' },
  wait: { ring: 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800', icon: Clock, iconColor: 'text-amber-700 dark:text-amber-400' },
  stop: { ring: 'border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-900', icon: XCircle, iconColor: 'text-red-700 dark:text-red-400' },
};

interface Props {
  signals: TodaySignal[];
  lang: Language;
}

/**
 * The spray / irrigate / fertilise rows. Shared by Home and the Weather
 * screen so the two can never say different things in different ways.
 */
export default function SignalList({ signals, lang }: Props) {
  return (
    <ul className="space-y-2">
      {signals.map((signal) => {
        const style = STATUS_STYLE[signal.status];
        const KindIcon = KIND_ICON[signal.kind];
        const StatusIcon = style.icon;
        return (
          <li key={signal.kind} className={`flex items-center gap-3 rounded-2xl border p-3 ${style.ring}`}>
            <span className="flex flex-col items-center w-14 shrink-0 text-stone-800 dark:text-stone-100">
              <KindIcon className="w-7 h-7" aria-hidden="true" />
              <span className="text-sm font-bold mt-0.5">{KIND_LABEL[signal.kind][lang]}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold leading-snug text-stone-900 dark:text-white">{signal.title[lang]}</span>
              <span className="block text-sm text-stone-700 dark:text-stone-300 leading-snug">{signal.reason[lang]}</span>
            </span>
            <StatusIcon className={`w-8 h-8 shrink-0 ${style.iconColor}`} aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
}

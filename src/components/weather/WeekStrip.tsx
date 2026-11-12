import React, { useState } from 'react';
import { ChevronDown, CloudDrizzle, CloudRain, CloudSun, Sun } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { DaySignals } from '../../utils/todaySignals';
import { addDaysToDateString, dhakaDateString } from '../../utils/farmTaskDates';
import toBn from '../../utils/banglaNum';
import Card from '../ui/Card';
import SignalList, { KIND_ICON, STATUS_STYLE } from './SignalList';

interface Props {
  lang: Language;
  /** Up to seven days from today, from `weekSignalsFromFeed`. */
  days: DaySignals[];
}

const WEEKDAY_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_WORD = {
  go: { bn: 'স্প্রে করা যাবে', en: 'Spray: yes' },
  wait: { bn: 'স্প্রে: সাবধানে', en: 'Spray: with care' },
  stop: { bn: 'স্প্রে নয়', en: 'Spray: no' },
} as const;

function dayName(date: string, lang: Language): string {
  const today = dhakaDateString();
  if (date === today) return lang === 'bn' ? 'আজ' : 'Today';
  if (date === addDaysToDateString(today, 1)) return lang === 'bn' ? 'আগামীকাল' : 'Tomorrow';
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (lang === 'bn' ? WEEKDAY_BN : WEEKDAY_EN)[weekday];
}

function rainIcon(chance: number | null) {
  if (chance === null) return { Icon: CloudSun, color: 'text-stone-500' };
  if (chance >= 60) return { Icon: CloudRain, color: 'text-sky-700 dark:text-sky-400' };
  if (chance >= 30) return { Icon: CloudDrizzle, color: 'text-sky-600 dark:text-sky-400' };
  if (chance >= 10) return { Icon: CloudSun, color: 'text-amber-600 dark:text-amber-400' };
  return { Icon: Sun, color: 'text-amber-500' };
}

/**
 * The next seven days, one row each. Tapping a day opens its spray,
 * irrigation and fertiliser advice.
 */
export default function WeekStrip({ lang, days }: Props) {
  const bn = lang === 'bn';
  const num = (value: number) => (bn ? toBn(Math.round(value)) : String(Math.round(value)));
  const [openDate, setOpenDate] = useState<string | null>(null);

  return (
    <Card>
      <h2 className="text-lg font-bold text-stone-900 dark:text-white">{bn ? 'এই সপ্তাহ' : 'This week'}</h2>

      {days.length === 0 ? (
        <p className="mt-2 text-base text-stone-700 dark:text-stone-300">
          {bn ? 'সাত দিনের পূর্বাভাস এখন পাওয়া যাচ্ছে না।' : 'The 7-day forecast is not available right now.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {days.map((day) => {
            const open = openDate === day.date;
            const { Icon, color } = rainIcon(day.rainChance);
            const spray = day.signals.find((s) => s.kind === 'spray');
            const sprayStyle = spray ? STATUS_STYLE[spray.status] : null;
            const SprayIcon = KIND_ICON.spray;
            const StatusIcon = sprayStyle?.icon;
            const panelId = `week-day-${day.date}`;
            return (
              <li key={day.date} className="rounded-2xl border border-stone-200 dark:border-emerald-900/60">
                <button
                  type="button"
                  onClick={() => setOpenDate(open ? null : day.date)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="w-full min-h-[56px] flex items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform"
                >
                  <Icon className={`w-9 h-9 shrink-0 ${color}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-lg font-bold text-stone-900 dark:text-white">{dayName(day.date, lang)}</span>
                      <span className="text-base font-bold text-stone-800 dark:text-stone-100 tabular-nums whitespace-nowrap">
                        {day.tempMax !== null ? `${num(day.tempMax)}°` : '—'}
                        <span className="font-normal text-stone-600 dark:text-stone-400">
                          {' / '}{day.tempMin !== null ? `${num(day.tempMin)}°` : '—'}
                        </span>
                      </span>
                    </span>
                    {day.rainChance !== null && (
                      <span className="block text-base text-stone-700 dark:text-stone-300">
                        {bn ? `বৃষ্টির সম্ভাবনা ${num(day.rainChance)}%` : `Chance of rain ${num(day.rainChance)}%`}
                      </span>
                    )}
                    <span className="block text-sm text-stone-700 dark:text-stone-300 leading-snug">{day.headline[lang]}</span>
                    {spray && sprayStyle && StatusIcon && (
                      <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-stone-800 dark:text-stone-100">
                        <SprayIcon className="w-4 h-4" aria-hidden="true" />
                        <StatusIcon className={`w-5 h-5 ${sprayStyle.iconColor}`} aria-hidden="true" />
                        <span>{STATUS_WORD[spray.status][lang]}</span>
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`w-6 h-6 shrink-0 text-stone-600 dark:text-stone-300 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {open && (
                  <div id={panelId} className="px-3 pb-3">
                    <SignalList signals={day.signals} lang={lang} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

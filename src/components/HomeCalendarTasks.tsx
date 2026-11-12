import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { Language } from '../utils/translations';
import type { Tab } from '../nav/tabs';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCropPlan } from '../hooks/useCropPlan';
import { hasCalendar, upcomingCalendarTasks } from '../utils/cropCalendar';
import { toggleStageDone } from '../utils/cropPlan';
import { dhakaDateString } from '../utils/farmTaskDates';
import { mainCropLabel } from '../data/mainCrops';
import toBn from '../utils/banglaNum';
import Card from './ui/Card';

interface Props {
  lang: Language;
  onNavigate: (tab: Tab) => void;
}

/**
 * The crop calendar on Home. With a saved sowing date it lists this week's
 * calendar work; without one it asks for the date, once, for the farmer's
 * main crop. It shows nothing when there is no main crop with a calendar.
 */
export default function HomeCalendarTasks({ lang, onNavigate }: Props) {
  const { mainCrop } = useAppSettings();
  const [plan, setPlan] = useCropPlan();
  const today = dhakaDateString();
  const [dateDraft, setDateDraft] = useState(today);
  const bn = lang === 'bn';
  const num = (value: number) => (bn ? toBn(value) : String(value));

  if (!plan) {
    if (!mainCrop || !hasCalendar(mainCrop)) return null;
    const cropName = mainCropLabel(mainCrop, lang) ?? mainCrop;
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
          <CalendarDays className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <span>{bn ? `${cropName} কবে লাগিয়েছেন?` : `When did you plant your ${cropName.toLowerCase()}?`}</span>
        </h2>
        <p className="mt-1 text-base text-stone-700 dark:text-stone-300">
          {bn ? 'তারিখ দিলে কখন সার, সেচ ও পরিচর্যা করবেন তা মনে করিয়ে দেব।' : 'Give the date and we will remind you when to fertilise, irrigate and tend the crop.'}
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            type="date"
            value={dateDraft}
            max={today}
            onChange={(e) => setDateDraft(e.target.value)}
            aria-label={bn ? 'লাগানোর তারিখ' : 'Planting date'}
            className="min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] px-3 text-base font-bold text-stone-900 dark:text-white"
          />
          <button
            type="button"
            disabled={!dateDraft}
            onClick={() => setPlan({ cropKey: mainCrop, sowingDate: dateDraft, completedStages: [] })}
            className="min-h-[56px] px-5 rounded-2xl bg-emerald-700 text-white text-lg font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {bn ? 'ঠিক আছে' : 'Save'}
          </button>
        </div>
      </Card>
    );
  }

  const tasks = upcomingCalendarTasks(plan, today).slice(0, 3);
  if (tasks.length === 0) return null;

  const dayLabel = (days: number): string => {
    if (days === 0) return bn ? 'আজ' : 'Today';
    if (days < 0) return bn ? `${num(-days)} দিন আগে করার কথা ছিল` : `Was due ${-days} day${days === -1 ? '' : 's'} ago`;
    return bn ? `${num(days)} দিন পর` : `In ${days} day${days === 1 ? '' : 's'}`;
  };

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
        <CalendarDays className="w-6 h-6 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <span>
          {bn ? 'ফসলের ক্যালেন্ডার' : 'Crop calendar'}
          {mainCropLabel(plan.cropKey, lang) ? `: ${mainCropLabel(plan.cropKey, lang)}` : ''}
        </span>
      </h2>
      <ul className="mt-3 space-y-2">
        {tasks.map((task) => (
          <li
            key={task.stageIndex}
            className={`rounded-2xl border p-3 ${task.daysFromToday <= 0 ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800' : 'border-stone-200 dark:border-emerald-900/60'}`}
          >
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{dayLabel(task.daysFromToday)}</p>
            <p className="text-base font-bold text-stone-900 dark:text-white leading-snug">{task.title[lang]}</p>
            <p className="text-sm text-stone-700 dark:text-stone-300 leading-snug">{task.detail[lang]}</p>
            <button
              type="button"
              onClick={() => setPlan(toggleStageDone(plan, task.stageIndex))}
              className="mt-2 w-full min-h-[48px] rounded-xl border-2 border-stone-300 dark:border-emerald-900/60 text-stone-800 dark:text-stone-100 text-base font-bold active:scale-[0.98] transition-transform"
            >
              {bn ? 'হয়ে গেছে' : 'Done'}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onNavigate('smart-planting')}
        className="mt-2 w-full min-h-[48px] text-base font-bold text-emerald-800 dark:text-emerald-300"
      >
        {bn ? 'পুরো ক্যালেন্ডার দেখুন' : 'See the full calendar'}
      </button>
    </Card>
  );
}

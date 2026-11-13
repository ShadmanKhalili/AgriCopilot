import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing, Camera, CloudSun, Grid, HeartHandshake,
  Loader2, MapPin, TrendingUp, ChevronRight,
} from 'lucide-react';
import type { Language } from '../utils/translations';
import type { Tab } from '../nav/tabs';
import { useAppSettings } from '../context/AppSettingsContext';
import { useTodayWeather } from '../hooks/useTodayWeather';
import { signalsSpeech, todaySignals } from '../utils/todaySignals';
import toBn from '../utils/banglaNum';
import BigActionButton from './ui/BigActionButton';
import Card from './ui/Card';
import ListenButton from './ui/ListenButton';
import HomeCalendarTasks from './HomeCalendarTasks';
import SignalList from './weather/SignalList';
import { useAuth } from './AuthProvider';
import { dhakaDateString, isTaskDue } from '../utils/farmTaskDates';
import type { FarmTask } from '../services/farmTasks';

interface Props {
  lang: Language;
  onNavigate: (tab: Tab) => void;
  onOpenAllServices: () => void;
  onSetArea: () => void;
  /** The area's name as shown in the header, when known. */
  locationName: string | null;
  /** Expert replies the farmer has not read yet. */
  unreadExpertCount: number;
}

/**
 * The simple Home screen: what to do on the farm today, then four big doors
 * into the tools a farmer uses most.
 */
export default function HomeToday({ lang, onNavigate, onOpenAllServices, onSetArea, locationName, unreadExpertCount }: Props) {
  const { location } = useAppSettings();
  const { state, retry } = useTodayWeather(location);
  const bn = lang === 'bn';
  const num = (value: number) => (bn ? toBn(Math.round(value)) : String(Math.round(value)));

  const signals = state.status === 'ready' ? todaySignals(state.weather) : [];

  // The farmer's own reminders, such as "check the crop again" after a diagnosis.
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  useEffect(() => {
    if (!uid) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    // The task service brings the database library, so it is loaded on demand.
    import('../services/farmTasks')
      .then(({ listOpenTasks }) => listOpenTasks(uid))
      .then((list) => { if (!cancelled) setTasks(list); })
      .catch((error) => console.warn('Could not load reminders:', error));
    return () => { cancelled = true; };
  }, [uid]);

  const finishTask = useCallback((taskId: string) => {
    if (!uid) return;
    setTasks((list) => list.filter((task) => task.id !== taskId));
    import('../services/farmTasks')
      .then(({ markTaskDone }) => markTaskDone(uid, taskId))
      .catch((error) => console.warn('Could not mark the reminder done:', error));
  }, [uid]);

  const today = dhakaDateString();
  const dayLabel = (task: FarmTask): string => {
    if (isTaskDue(task, today)) return bn ? 'আজ করুন' : 'Do today';
    const days = Math.round((Date.parse(task.dueDate) - Date.parse(today)) / 86400000);
    return bn ? `${num(days)} দিন পর` : `In ${days} day${days === 1 ? '' : 's'}`;
  };

  return (
    <div className="max-w-xl mx-auto w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">{bn ? 'আজ আপনার খামারে' : 'Your farm today'}</h1>
      </div>

      <Card>
        {!location ? (
          <div className="text-center space-y-3 py-2">
            <MapPin className="w-10 h-10 mx-auto text-amber-600" aria-hidden="true" />
            <p className="text-lg font-bold text-stone-900 dark:text-white">
              {bn ? 'আপনার এলাকা ঠিক করুন' : 'Set your area'}
            </p>
            <p className="text-base text-stone-700 dark:text-stone-300">
              {bn ? 'তাহলে আজকের আবহাওয়া ও করণীয় দেখাতে পারব।' : 'Then we can show today\'s weather and what to do.'}
            </p>
            <button
              type="button"
              onClick={onSetArea}
              className="w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-lg font-bold active:scale-[0.98] transition-transform"
            >
              {bn ? 'এলাকা বেছে নিন' : 'Choose area'}
            </button>
          </div>
        ) : state.status === 'ready' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={onSetArea} className="flex items-center gap-1.5 min-h-[44px] text-left text-base font-bold text-stone-700 dark:text-stone-200">
                <MapPin className="w-5 h-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span className="truncate max-w-[180px]">{locationName || (bn ? 'আপনার এলাকা' : 'Your area')}</span>
              </button>
              <ListenButton text={signalsSpeech(signals, lang)} lang={lang} />
            </div>

            <div className="flex items-center gap-4 text-stone-900 dark:text-white">
              <CloudSun className="w-10 h-10 text-sky-600 shrink-0" aria-hidden="true" />
              <span className="text-4xl font-bold leading-none">{num(state.weather.temp)}°</span>
              <span className="text-base font-bold text-stone-700 dark:text-stone-300">
                {bn ? `বৃষ্টির সম্ভাবনা ${num(state.weather.rainChanceToday)}%` : `Chance of rain ${num(state.weather.rainChanceToday)}%`}
              </span>
            </div>

            <SignalList signals={signals} lang={lang} />

            <button
              type="button"
              onClick={() => onNavigate('weather-advisory')}
              className="flex items-center justify-center gap-1 w-full min-h-[48px] text-base font-bold text-emerald-800 dark:text-emerald-300"
            >
              <span>{bn ? 'পুরো আবহাওয়া দেখুন' : 'See the full weather'}</span>
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        ) : state.status === 'error' ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-lg font-bold text-stone-900 dark:text-white">
              {bn ? 'আজকের আবহাওয়া আনা যায়নি' : 'Could not load today\'s weather'}
            </p>
            <p className="text-base text-stone-700 dark:text-stone-300">
              {bn ? 'ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।' : 'Check your connection and try again.'}
            </p>
            <button
              type="button"
              onClick={retry}
              className="w-full min-h-[56px] rounded-2xl border-2 border-emerald-700 text-emerald-800 dark:text-emerald-300 text-lg font-bold active:scale-[0.98] transition-transform"
            >
              {bn ? 'আবার চেষ্টা করুন' : 'Try again'}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 py-8 text-stone-700 dark:text-stone-300" role="status">
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            <span className="text-base font-bold">{bn ? 'আজকের আবহাওয়া আনা হচ্ছে...' : 'Loading today\'s weather...'}</span>
          </div>
        )}
      </Card>

      {tasks.length > 0 && (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white">
            <BellRing className="w-6 h-6 text-amber-600" aria-hidden="true" />
            <span>{bn ? 'আমার কাজ' : 'My tasks'}</span>
          </h2>
          <ul className="mt-3 space-y-2">
            {tasks.slice(0, 3).map((task) => {
              const due = isTaskDue(task, today);
              return (
                <li
                  key={task.id}
                  className={`rounded-2xl border p-3 ${due ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800' : 'border-stone-200 dark:border-emerald-900/60'}`}
                >
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{dayLabel(task)}</p>
                  <p className="text-base font-bold text-stone-900 dark:text-white leading-snug">{task.title}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('agri-copilot')}
                      className="min-h-[48px] rounded-xl bg-emerald-700 text-white text-base font-bold active:scale-[0.98] transition-transform"
                    >
                      {bn ? 'ফসল দেখান' : 'Check crop'}
                    </button>
                    <button
                      type="button"
                      onClick={() => finishTask(task.id)}
                      className="min-h-[48px] rounded-xl border-2 border-stone-300 dark:border-emerald-900/60 text-stone-800 dark:text-stone-100 text-base font-bold active:scale-[0.98] transition-transform"
                    >
                      {bn ? 'হয়ে গেছে' : 'Done'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <HomeCalendarTasks lang={lang} onNavigate={onNavigate} />

      <div className="grid grid-cols-2 gap-3">
        <BigActionButton
          icon={Camera}
          label={bn ? 'ফসল দেখান' : 'Check my crop'}
          hint={bn ? 'রোগ ও পোকা চিনুন' : 'Find disease and pests'}
          tone="green"
          onClick={() => onNavigate('agri-copilot')}
        />
        <BigActionButton
          icon={CloudSun}
          label={bn ? 'আবহাওয়া' : 'Weather'}
          hint={bn ? 'বৃষ্টি ও পরামর্শ' : 'Rain and advice'}
          tone="sky"
          onClick={() => onNavigate('weather-advisory')}
        />
        <BigActionButton
          icon={TrendingUp}
          label={bn ? 'বাজার দর' : 'Market price'}
          hint={bn ? 'আজকের দাম' : 'Today\'s prices'}
          tone="amber"
          onClick={() => onNavigate('market-connect')}
        />
        <BigActionButton
          icon={HeartHandshake}
          label={bn ? 'বিশেষজ্ঞের সাথে কথা' : 'Talk to an expert'}
          hint={bn ? 'মানুষের পরামর্শ' : 'Advice from a person'}
          tone="rose"
          badge={unreadExpertCount > 0 ? num(unreadExpertCount) : undefined}
          onClick={() => onNavigate('expert-hub')}
        />
      </div>

      <button
        type="button"
        onClick={onOpenAllServices}
        className="flex items-center justify-center gap-2 w-full min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] text-lg font-bold text-stone-800 dark:text-stone-100 active:scale-[0.98] transition-transform"
      >
        <Grid className="w-6 h-6" aria-hidden="true" />
        <span>{bn ? 'সব সেবা দেখুন' : 'See all services'}</span>
      </button>

      <p className="text-center text-sm text-stone-600 dark:text-stone-400">
        {bn ? 'জরুরি হলে কৃষি কল সেন্টারে ফোন করুন: ১৬১২৩' : 'If urgent, call the Krishi Call Centre: 16123'}
      </p>
    </div>
  );
}

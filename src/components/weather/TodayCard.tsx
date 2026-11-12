import React from 'react';
import { CloudRain, CloudSun, MapPin, Sun } from 'lucide-react';
import type { Language } from '../../utils/translations';
import { signalsSpeech, type TodaySignal } from '../../utils/todaySignals';
import toBn from '../../utils/banglaNum';
import Card from '../ui/Card';
import ListenButton from '../ui/ListenButton';
import SignalList from './SignalList';

interface Props {
  lang: Language;
  /** The area's name, when known. */
  placeName: string | null;
  /** Current temperature, °C. */
  temp: number | null;
  /** Highest chance of rain today, %. */
  rainChance: number | null;
  /** Spray, irrigate, fertilise, in that order. */
  signals: TodaySignal[];
  /** When given, tapping the place name calls it (to change the area). */
  onPlaceTap?: () => void;
}

/**
 * Today at a glance for the simple Weather screen: where, how warm, will it
 * rain, and what to do on the farm. Same rows as on Home.
 */
export default function TodayCard({ lang, placeName, temp, rainChance, signals, onPlaceTap }: Props) {
  const bn = lang === 'bn';
  const num = (value: number) => (bn ? toBn(Math.round(value)) : String(Math.round(value)));
  const name = placeName || (bn ? 'আপনার এলাকা' : 'Your area');

  const WeatherIcon = rainChance === null ? CloudSun : rainChance >= 50 ? CloudRain : rainChance >= 20 ? CloudSun : Sun;
  const iconColor = rainChance !== null && rainChance < 20 ? 'text-amber-500' : 'text-sky-600';

  const placeContent = (
    <>
      <MapPin className="w-5 h-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      <span className="truncate max-w-[180px]">{name}</span>
    </>
  );

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          {onPlaceTap ? (
            <button type="button" onClick={onPlaceTap} className="flex items-center gap-1.5 min-h-[44px] text-left text-base font-bold text-stone-700 dark:text-stone-200">
              {placeContent}
            </button>
          ) : (
            <span className="flex items-center gap-1.5 min-h-[44px] text-base font-bold text-stone-700 dark:text-stone-200">
              {placeContent}
            </span>
          )}
          {signals.length > 0 && <ListenButton text={signalsSpeech(signals, lang)} lang={lang} />}
        </div>

        <div className="flex items-center gap-4 text-stone-900 dark:text-white">
          <WeatherIcon className={`w-10 h-10 shrink-0 ${iconColor}`} aria-hidden="true" />
          {temp !== null && <span className="text-4xl font-bold leading-none">{num(temp)}°</span>}
          {rainChance !== null && (
            <span className="text-base font-bold text-stone-700 dark:text-stone-300">
              {bn ? `বৃষ্টির সম্ভাবনা ${num(rainChance)}%` : `Chance of rain ${num(rainChance)}%`}
            </span>
          )}
        </div>

        <SignalList signals={signals} lang={lang} />
      </div>
    </Card>
  );
}

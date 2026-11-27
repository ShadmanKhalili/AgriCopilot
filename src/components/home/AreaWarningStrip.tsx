import React from 'react';
import { AlertTriangle, Camera, ChevronRight, Megaphone } from 'lucide-react';
import type { Language } from '../../utils/translations';
import type { Tab } from '../../nav/tabs';
import { useAreaWarnings } from '../../hooks/useAreaWarnings';
import { broadcastMessage, notConfirmedNote, warningSentence, warningSpeech } from '../../utils/areaWarningText';
import ListenButton from '../ui/ListenButton';

interface Props {
  lang: Language;
  onNavigate: (tab: Tab) => void;
}

/** The most items shown on Home. The rest are one tap away on the radar. */
const MAX_ITEMS = 2;

/**
 * A short strip on Home with what the farmer's own area is reporting: messages
 * from the AgriCopilot team, and crop problems that 3 or more different
 * farmers nearby reported in the last 14 days. It shows nothing when there is
 * nothing to say, when the farmer is signed out, or when anything fails.
 */
export default function AreaWarningStrip({ lang, onNavigate }: Props) {
  const { state, wordsFor } = useAreaWarnings(lang);
  if (state.status !== 'ready') return null;

  const bn = lang === 'bn';
  const total = state.broadcasts.length + state.warnings.length;
  if (total === 0) return null;

  const broadcasts = state.broadcasts.slice(0, MAX_ITEMS);
  const warnings = state.warnings.slice(0, MAX_ITEMS - broadcasts.length);

  return (
    <section
      aria-label={bn ? 'আপনার এলাকার সতর্কতা' : 'Warnings for your area'}
      className="rounded-3xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3"
    >
      <ul className="space-y-3">
        {broadcasts.map((item) => {
          const message = broadcastMessage(item, lang);
          if (!message) return null;
          const urgent = item.severity === 'warning';
          return (
            <li
              key={item.id}
              className={`rounded-2xl border p-3 space-y-2 ${urgent ? 'border-red-300 bg-white dark:bg-[#0c1c13] dark:border-red-800' : 'border-stone-200 bg-white dark:bg-[#0c1c13] dark:border-emerald-900/60'}`}
            >
              <p className={`flex items-center gap-2 text-sm font-bold ${urgent ? 'text-red-800 dark:text-red-300' : 'text-stone-700 dark:text-stone-300'}`}>
                <Megaphone className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{bn ? 'AgriCopilot দলের কাছ থেকে' : 'From AgriCopilot team'}</span>
              </p>
              <p className="text-base font-bold text-stone-900 dark:text-white leading-snug">{message}</p>
              <ListenButton text={message} lang={lang} />
            </li>
          );
        })}

        {warnings.map((warning) => {
          const words = wordsFor(warning);
          return (
            <li
              key={`${warning.crop}__${warning.diseaseKey}`}
              className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#0c1c13] p-3 space-y-2"
            >
              <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{bn ? 'আপনার এলাকার সতর্কতা' : 'Warning for your area'}</span>
              </p>
              <p className="text-base font-bold text-stone-900 dark:text-white leading-snug">{warningSentence(words, lang)}</p>
              <p className="text-sm text-stone-700 dark:text-stone-300">{notConfirmedNote(lang)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('agri-copilot')}
                  className="flex items-center justify-center gap-2 min-h-[56px] flex-1 rounded-2xl bg-emerald-700 text-white text-lg font-bold active:scale-[0.98] transition-transform"
                >
                  <Camera className="w-6 h-6" aria-hidden="true" />
                  <span>{bn ? 'ফসল দেখান' : 'Check my crop'}</span>
                </button>
                <ListenButton text={warningSpeech(words, lang)} lang={lang} />
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => onNavigate('community-radar')}
        className="flex items-center justify-center gap-1 w-full min-h-[48px] text-base font-bold text-amber-900 dark:text-amber-200"
      >
        <span>{bn ? 'সব দেখুন' : 'See all'}</span>
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>
    </section>
  );
}

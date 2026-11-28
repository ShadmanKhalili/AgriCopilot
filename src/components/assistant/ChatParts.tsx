import React from 'react';
import { MessageCircle, Mic, PhoneCall, RotateCcw } from 'lucide-react';
import type { AssistantSource } from '../../constants/assistant';
import { ASSISTANT_NAME } from '../../constants/assistant';
import Card from '../ui/Card';
import ListenButton from '../ui/ListenButton';
import {
  exampleQuestions,
  helplineText,
  sourceLabel,
  sourcesForItem,
  type ChatItem,
  type ErrorView,
  type ViewLang,
} from './assistantView';

/** The farmer's message: right side, green. */
function UserBubble({ item, lang }: { item: ChatItem; lang: ViewLang }) {
  const bn = lang === 'bn';
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-emerald-700 text-white px-4 py-3 text-base leading-relaxed whitespace-pre-line break-words">
        <span className="sr-only">{bn ? 'আপনি: ' : 'You: '}</span>
        {item.channel === 'voice' && <Mic className="inline w-4 h-4 mr-1.5 -mt-0.5 opacity-80" aria-hidden="true" />}
        {item.text}
      </div>
    </div>
  );
}

const chipClass = (source: AssistantSource): string =>
  source === 'ai_estimate'
    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
    : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';

/** The assistant's answer: left side, white, with Listen and the sources it used. */
function AssistantBubble({ item, lang }: { item: ChatItem; lang: ViewLang }) {
  const bn = lang === 'bn';
  const sources = sourcesForItem(item);
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white dark:bg-[#0c1c13] border border-stone-200 dark:border-emerald-900/50 shadow-sm px-4 py-3 text-base leading-relaxed text-stone-900 dark:text-stone-100 whitespace-pre-line break-words">
        <span className="sr-only">{ASSISTANT_NAME[lang]}: </span>
        {item.text}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ListenButton text={item.text} lang={lang} />
        {sources.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={bn ? 'তথ্যের উৎস' : 'Where this comes from'}>
            {sources.map((source) => (
              <li key={source} className={`rounded-full border px-2.5 py-1 text-sm font-bold leading-snug ${chipClass(source)}`}>
                {sourceLabel(source, lang)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!item.saved && (
        <p className="text-sm text-amber-800 dark:text-amber-300 leading-snug">
          {bn
            ? 'এই কথাটি সংরক্ষণ করা যায়নি, তাই পরে খুললে নাও থাকতে পারে।'
            : 'This conversation could not be saved, so it may not be here next time.'}
        </p>
      )}
    </div>
  );
}

export function MessageBubble({ item, lang }: { item: ChatItem; lang: ViewLang }) {
  return item.role === 'user' ? <UserBubble item={item} lang={lang} /> : <AssistantBubble item={item} lang={lang} />;
}

/** Shown while the answer is on its way. */
export function ThinkingBubble({ lang }: { lang: ViewLang }) {
  return (
    <div className="flex" role="status">
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-white dark:bg-[#0c1c13] border border-stone-200 dark:border-emerald-900/50 shadow-sm px-4 py-3 text-base text-stone-700 dark:text-stone-300">
        <span className="flex gap-1.5" aria-hidden="true">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-emerald-600 motion-safe:animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <span>{lang === 'bn' ? 'ভাবছি…' : 'Thinking…'}</span>
      </div>
    </div>
  );
}

/** A question that got no answer: what went wrong, and how to go on. */
export function FailureCard({ view, lang, onRetry }: { view: ErrorView; lang: ViewLang; onRetry: () => void }) {
  const bn = lang === 'bn';
  return (
    <div role="alert" className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3">
      <p className="text-base font-bold leading-snug text-stone-900 dark:text-white">{view.text}</p>
      {(view.canRetry || view.showHelpline) && (
        <div className="flex flex-wrap gap-2">
          {view.canRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-2xl bg-emerald-700 text-white text-base font-bold active:scale-[0.98] transition-transform"
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
              <span>{bn ? 'আবার চেষ্টা করুন' : 'Try again'}</span>
            </button>
          )}
          {view.showHelpline && (
            <a
              href="tel:16123"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-base font-bold active:scale-[0.98] transition-transform"
            >
              <PhoneCall className="w-5 h-5" aria-hidden="true" />
              <span>{helplineText(lang)}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** The first screen of a new conversation: who is here, and three questions to tap. */
export function EmptyState({
  lang,
  onPick,
  isGuest,
  onOpenProfile,
}: {
  lang: ViewLang;
  onPick: (question: string) => void;
  isGuest: boolean;
  onOpenProfile?: () => void;
}) {
  const bn = lang === 'bn';
  const name = ASSISTANT_NAME[lang];
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center" aria-hidden="true">
            <MessageCircle className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-snug text-stone-900 dark:text-white">{bn ? `আমি ${name}` : `I am ${name}`}</h2>
            <p className="mt-1 text-base leading-relaxed text-stone-700 dark:text-stone-300">
              {bn
                ? 'আজকের করণীয়, আবহাওয়া, বাজারদর বা আপনার খরচ নিয়ে জিজ্ঞাসা করুন। মুখে বলতে পারেন, লিখতেও পারেন।'
                : 'Ask me about what to do today, the weather, market prices or your costs. You can speak or type.'}
            </p>
          </div>
        </div>

        <p className="mt-4 text-base font-bold text-stone-900 dark:text-white">{bn ? 'যেমন জিজ্ঞাসা করতে পারেন:' : 'For example:'}</p>
        <ul className="mt-2 space-y-2">
          {exampleQuestions(lang).map((question) => (
            <li key={question}>
              <button
                type="button"
                onClick={() => onPick(question)}
                className="w-full min-h-[56px] text-left rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 bg-white dark:bg-[#07140d] px-4 py-3 text-lg font-bold leading-snug text-stone-900 dark:text-white active:scale-[0.98] transition-transform"
              >
                {question}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {isGuest && (
        <div className="rounded-2xl border border-stone-200 dark:border-emerald-900/50 bg-white dark:bg-[#0c1c13] p-4 space-y-2">
          <p className="text-base leading-relaxed text-stone-700 dark:text-stone-300">
            {bn
              ? 'আপনি গেস্ট হিসেবে আছেন। ফোন বদলালে বা সাইন আউট করলে এই কথাগুলো আর পাবেন না। Google যুক্ত করলে সব থেকে যাবে।'
              : 'You are using a guest account. If you change phones or sign out, these conversations are lost. Link Google to keep them.'}
          </p>
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[48px] px-5 rounded-2xl border-2 border-emerald-700 text-emerald-800 dark:text-emerald-300 text-base font-bold active:scale-[0.98] transition-transform"
            >
              {bn ? 'প্রোফাইলে যান' : 'Open profile'}
            </button>
          )}
        </div>
      )}

      <p className="text-center text-sm text-stone-600 dark:text-stone-400">{helplineText(lang)}</p>
    </div>
  );
}

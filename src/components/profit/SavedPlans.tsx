import React from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import type { Language } from '../../utils/translations';
import { CROP_BENCHMARKS } from '../../data/cropBenchmarks';
import { planResult, type SeasonPlan } from '../../utils/seasonMath';
import { formatNumber, formatTaka, landLabel } from '../../utils/profitPlan';
import Card from '../ui/Card';
import ExpenseNotes from './ExpenseNotes';

interface Props {
  lang: Language;
  /** Signed-in user id, or null when plans stay on this phone. */
  uid: string | null;
  plans: SeasonPlan[];
  loaded: boolean;
  /** The plan whose details are open, if any. */
  openPlan: SeasonPlan | null;
  onToggle: (plan: SeasonPlan) => void;
  /** Put this plan's numbers back into the calculator. */
  onEdit: (plan: SeasonPlan) => void;
  onDelete: (plan: SeasonPlan) => void;
}

/** The farmer's saved plans, each with its own cost notes. */
export default function SavedPlans({ lang, uid, plans, loaded, openPlan, onToggle, onEdit, onDelete }: Props) {
  const bn = lang === 'bn';
  const taka = (v: number) => formatTaka(v, lang);

  const confirmDelete = (plan: SeasonPlan, name: string) => {
    const ok = window.confirm(
      bn
        ? `${name}-এর এই হিসাব এবং এর খরচের খাতা মুছে ফেলবেন? এটি আর ফেরত আনা যাবে না।`
        : `Delete this ${name} plan and its cost notes? This cannot be undone.`
    );
    if (ok) onDelete(plan);
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-xl font-black text-stone-900 dark:text-stone-50">
          {bn ? 'আমার রাখা হিসাব' : 'My saved plans'}
        </h2>
        {!uid && (
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            {bn
              ? 'এগুলো শুধু এই ফোনে রাখা আছে। অ্যাকাউন্টে রাখতে প্রবেশ করুন।'
              : 'These are kept on this phone only. Sign in to keep them in your account.'}
          </p>
        )}
      </div>

      {!loaded ? (
        <p className="text-base text-stone-500 dark:text-stone-400">{bn ? 'হিসাব আনা হচ্ছে…' : 'Loading plans…'}</p>
      ) : plans.length === 0 ? (
        <p className="text-base text-stone-600 dark:text-stone-400 leading-relaxed">
          {bn
            ? "এখনো কোনো হিসাব রাখা হয়নি। উপরে হিসাব করে 'হিসাব রাখুন' চাপুন। তারপর মৌসুমজুড়ে খরচ লিখে রাখতে পারবেন।"
            : "No plans saved yet. Work one out above and press 'Save this plan'. You can then note your costs through the season."}
        </p>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => {
            const crop = CROP_BENCHMARKS[plan.crop];
            const name = crop ? (bn ? crop.shortBn : crop.shortEn) : plan.crop;
            const open = openPlan?.id === plan.id;
            const { income, profit } = planResult(plan.plannedCost, plan.expectedYieldMon, plan.expectedPricePerMon);
            const panelId = `saved-plan-${plan.id}`;
            return (
              <li key={plan.id} className="rounded-2xl border-2 border-stone-200 dark:border-stone-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onToggle(plan)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="w-full min-h-[64px] flex items-center gap-3 px-4 py-3 text-left bg-white dark:bg-stone-900 active:bg-stone-50 dark:active:bg-stone-800"
                >
                  <span className="text-3xl leading-none" aria-hidden="true">{crop?.emoji ?? '🌱'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-stone-900 dark:text-stone-50">{name}</span>
                    <span className="block text-base text-stone-600 dark:text-stone-400">
                      {landLabel(plan.landSize, plan.landUnit, lang)}
                      {' · '}
                      {bn ? `খরচ ${taka(plan.plannedCost)}` : `Cost ${taka(plan.plannedCost)}`}
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-6 h-6 shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {open && (
                  <div id={panelId} className="border-t-2 border-stone-200 dark:border-stone-700 p-4 space-y-4 bg-stone-50/60 dark:bg-stone-950/40">
                    <dl className="space-y-1 text-base text-stone-800 dark:text-stone-200">
                      <div className="flex justify-between gap-3">
                        <dt>{bn ? 'আশা করা ফলন' : 'Expected harvest'}</dt>
                        <dd className="font-bold tabular-nums">
                          {formatNumber(plan.expectedYieldMon, lang)} {bn ? 'মণ' : 'mon'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{bn ? 'আশা করা দাম (প্রতি মণ)' : 'Expected price (per mon)'}</dt>
                        <dd className="font-bold tabular-nums">{taka(plan.expectedPricePerMon)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{bn ? 'আশা করা আয়' : 'Expected income'}</dt>
                        <dd className="font-bold tabular-nums">{taka(income)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>{profit >= 0 ? (bn ? 'আশা করা লাভ' : 'Expected profit') : (bn ? 'সম্ভাব্য ক্ষতি' : 'Expected loss')}</dt>
                        <dd className={`font-black tabular-nums ${profit >= 0 ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}`}>
                          {taka(profit)}
                        </dd>
                      </div>
                    </dl>

                    <ExpenseNotes lang={lang} uid={uid} season={plan} />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(plan)}
                        className="min-h-[56px] flex items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-base font-bold text-stone-800 dark:text-stone-100 active:scale-[0.98] transition-transform"
                      >
                        <Pencil className="w-5 h-5" aria-hidden="true" />
                        {bn ? 'হিসাব বদলান' : 'Change plan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(plan, name)}
                        className="min-h-[56px] flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-300 dark:border-rose-800 bg-white dark:bg-stone-900 text-base font-bold text-rose-800 dark:text-rose-300 active:scale-[0.98] transition-transform"
                      >
                        <Trash2 className="w-5 h-5" aria-hidden="true" />
                        {bn ? 'হিসাব মুছুন' : 'Delete plan'}
                      </button>
                    </div>
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

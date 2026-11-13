import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import { addExpense, deleteExpense, listExpenses } from '../../services/seasons';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  MAX_AMOUNT_BDT,
  NOTE_MAX,
  expenseTotalsByCategory,
  sortExpenses,
  totalExpenses,
  type Expense,
  type ExpenseCategory,
  type SeasonPlan,
} from '../../utils/seasonMath';
import { dhakaDateString } from '../../utils/farmTaskDates';
import { formatTaka, shortDateLabel } from '../../utils/profitPlan';
import NumberField from './NumberField';
import VoiceAmountButton from './VoiceAmountButton';
import { accountSaveFailed } from './useSeasonPlans';

interface Props {
  lang: Language;
  uid: string | null;
  season: SeasonPlan;
}

/** The costs a farmer notes down during the season against one saved plan. */
export default function ExpenseNotes({ lang, uid, season }: Props) {
  const bn = lang === 'bn';
  const taka = (v: number) => formatTaka(v, lang);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => dhakaDateString());

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listExpenses(uid, season.id)
      .then((list) => { if (alive) setExpenses(list); })
      .catch(() => {
        if (!alive) return;
        setExpenses([]);
        toast.error(bn ? 'খরচের তালিকা আনা যায়নি।' : 'Could not load the noted costs.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uid, season.id]);

  const spent = totalExpenses(expenses);
  const byCategory = expenseTotalsByCategory(expenses);
  const canAdd = category !== null && amount !== null && Math.round(amount) > 0 && amount <= MAX_AMOUNT_BDT;

  const add = () => {
    if (!canAdd) {
      toast.error(bn ? 'খরচের ধরন বাছুন এবং টাকার পরিমাণ দিন।' : 'Pick what the cost was for and enter the amount.');
      return;
    }
    let pending;
    try {
      pending = addExpense(uid, season.id, { category, amount, note, date });
    } catch {
      toast.error(bn ? 'খরচটি লেখা গেল না।' : 'This cost could not be noted.');
      return;
    }
    const { item, saved } = pending;
    setExpenses((prev) => sortExpenses([item, ...prev]));
    setAmount(null);
    setNote('');
    setCategory(null);
    setFormOpen(false);
    toast.success(bn ? 'খরচ লেখা হয়েছে' : 'Cost noted');
    saved.catch(() => accountSaveFailed(lang));
  };

  const remove = async (expense: Expense) => {
    const label = EXPENSE_CATEGORY_LABELS[expense.category][bn ? 'bn' : 'en'];
    const ok = window.confirm(
      bn ? `${label} ${taka(expense.amount)} খরচটি মুছে ফেলবেন?` : `Delete the ${label} cost of ${taka(expense.amount)}?`
    );
    if (!ok) return;
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    try {
      await deleteExpense(uid, season.id, expense.id);
    } catch {
      setExpenses((prev) => sortExpenses([expense, ...prev.filter((e) => e.id !== expense.id)]));
      toast.error(bn ? 'খরচটি মোছা যায়নি।' : 'Could not delete the cost.');
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-black text-stone-900 dark:text-stone-50">
        {bn ? 'খরচের খাতা' : 'Cost notes'}
      </h4>

      {/* Summary */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/70 p-4 space-y-2">
        <p className="text-lg font-bold text-stone-900 dark:text-stone-50">
          {bn
            ? `এ পর্যন্ত খরচ ${taka(spent)} / পরিকল্পিত ${taka(season.plannedCost)}`
            : `Spent so far ${taka(spent)} of planned ${taka(season.plannedCost)}`}
        </p>
        {spent > season.plannedCost && (
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {bn
              ? `পরিকল্পনার চেয়ে ${taka(spent - season.plannedCost)} বেশি খরচ হয়েছে।`
              : `${taka(spent - season.plannedCost)} more than planned.`}
          </p>
        )}
        {byCategory.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-base text-stone-700 dark:text-stone-300">
            {byCategory.map((row) => (
              <li key={row.category} className="flex justify-between gap-2">
                <span>{EXPENSE_CATEGORY_LABELS[row.category][bn ? 'bn' : 'en']}</span>
                <span className="font-bold tabular-nums">{taka(row.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add a cost */}
      {!formOpen ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="w-full min-h-[56px] flex items-center justify-center gap-2 rounded-2xl border-2 border-emerald-700 text-emerald-800 dark:border-emerald-500 dark:text-emerald-300 text-lg font-bold active:scale-[0.98] transition-transform"
        >
          <Plus className="w-6 h-6" aria-hidden="true" />
          {bn ? 'খরচ যোগ করুন' : 'Add a cost'}
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-emerald-700/60 dark:border-emerald-600/60 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-lg font-bold text-stone-900 dark:text-stone-50">{bn ? 'খরচ যোগ করুন' : 'Add a cost'}</h5>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <fieldset>
            <legend className="text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
              {bn ? 'কিসের খরচ?' : 'What was it for?'}
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((c) => {
                const active = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c)}
                    className={`min-h-[56px] px-3 rounded-2xl border-2 text-base font-bold leading-tight transition-colors ${
                      active
                        ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-700'
                        : 'border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100'
                    }`}
                  >
                    {EXPENSE_CATEGORY_LABELS[c][bn ? 'bn' : 'en']}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <NumberField
            id={`expense-amount-${season.id}`}
            lang={lang}
            label={bn ? 'কত টাকা?' : 'How much?'}
            value={amount}
            suffix="৳"
            onValue={setAmount}
          >
            <VoiceAmountButton lang={lang} size="lg" label={bn ? 'খরচের টাকা' : 'Cost amount'} onAmount={setAmount} />
          </NumberField>

          <div>
            <label htmlFor={`expense-note-${season.id}`} className="block text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
              {bn ? 'নোট (না দিলেও চলবে)' : 'Note (optional)'}
            </label>
            <input
              id={`expense-note-${season.id}`}
              type="text"
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-4 text-lg text-stone-900 dark:text-stone-50 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div>
            <label htmlFor={`expense-date-${season.id}`} className="block text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
              {bn ? 'তারিখ' : 'Date'}
            </label>
            <input
              id={`expense-date-${season.id}`}
              type="date"
              value={date}
              max={dhakaDateString()}
              onChange={(e) => setDate(e.target.value || dhakaDateString())}
              className="w-full min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-4 text-lg text-stone-900 dark:text-stone-50 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            className="w-full min-h-[56px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            {bn ? 'খরচ লিখে রাখুন' : 'Save this cost'}
          </button>
        </div>
      )}

      {/* The list */}
      {loading ? (
        <p className="text-base text-stone-500 dark:text-stone-400">{bn ? 'খরচ আনা হচ্ছে…' : 'Loading costs…'}</p>
      ) : expenses.length === 0 ? (
        <p className="text-base text-stone-600 dark:text-stone-400">
          {bn ? 'এখনো কোনো খরচ লেখা হয়নি।' : 'No costs noted yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 overflow-hidden">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3 bg-white dark:bg-stone-900">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold text-stone-900 dark:text-stone-50">
                    {EXPENSE_CATEGORY_LABELS[e.category][bn ? 'bn' : 'en']}
                  </span>
                  <span className="text-lg font-black tabular-nums text-stone-900 dark:text-stone-50">{taka(e.amount)}</span>
                </div>
                <div className="text-sm text-stone-600 dark:text-stone-400">
                  {shortDateLabel(e.date, lang)}
                  {e.note ? ` · ${e.note}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(e)}
                aria-label={bn ? 'খরচটি মুছুন' : 'Delete this cost'}
                className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl border border-stone-200 dark:border-stone-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import { useAuth } from '../AuthProvider';
import Card from '../ui/Card';
import Disclosure from '../ui/Disclosure';
import ListenButton from '../ui/ListenButton';
import {
  addSale,
  deletePlot,
  deleteSale,
  loadFarmRecord,
  savePlot,
  updateSeasonProgress,
  type FarmRecord,
  type Plot,
  type PlotInput,
  type Sale,
  type SaleInput,
  type SeasonProgressChange,
} from '../../services/farmRecord';
import { seasonTotals } from '../../../netlify/functions/_shared/farm-record-model';
import { accountSaveFailed } from '../profit/useSeasonPlans';
import { toBn } from '../../utils/banglaNum';
import PlotsPanel from './PlotsPanel';
import SeasonCard from './SeasonCard';

interface Props {
  lang: Language;
  /** Open the print view of the farm record. The button is hidden when this is missing. */
  onPrint?: () => void;
  /** Go to another tool by its tab id. Used to send a farmer with no season to the profit calculator. */
  onNavigate?: (tab: string) => void;
  /** True while the tab that shows this section is open. The record is read again each time it opens. */
  active?: boolean;
}

const sortSales = (list: Sale[]): Sale[] =>
  [...list].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

/** "My farm record": land, each season's progress and money, and sales. */
export default function FarmRecordSection({ lang, onPrint, onNavigate, active = true }: Props) {
  const bn = lang === 'bn';
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [record, setRecord] = useState<FarmRecord>({ plots: [], seasons: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(() => {
    let alive = true;
    loadFarmRecord(uid)
      .then((r) => { if (alive) { setRecord(r); setLoadFailed(false); } })
      .catch(() => { if (alive) setLoadFailed(true); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [uid]);

  // A different account starts from scratch.
  useEffect(() => {
    setLoaded(false);
  }, [uid]);

  // Read again each time the tab opens, so a season saved in the calculator shows up.
  useEffect(() => {
    if (!active) return;
    return reload();
  }, [reload, active]);

  const retry = () => {
    setLoaded(false);
    reload();
  };

  // A write that did not reach the account: tell the farmer and show what is really stored.
  const saveFailed = useCallback(() => {
    accountSaveFailed(lang);
    reload();
  }, [lang, reload]);

  const onSavePlot = (input: PlotInput, id?: string): boolean => {
    const pending = savePlot(uid, input, id, id ? record.plots.find((p) => p.id === id) ?? null : null);
    if (!pending) {
      toast.error(bn ? 'জমির তথ্য ঠিক নেই। নাম আর মাপ দেখুন।' : 'The land details are not right. Check the name and size.');
      return false;
    }
    const { item, saved } = pending;
    setRecord((prev) => ({
      ...prev,
      plots: id ? prev.plots.map((p) => (p.id === id ? item : p)) : [...prev.plots, item],
    }));
    toast.success(bn ? 'জমি রাখা হয়েছে' : 'Land saved');
    saved.catch(saveFailed);
    return true;
  };

  const onDeletePlot = (plot: Plot) => {
    setRecord((prev) => ({ ...prev, plots: prev.plots.filter((p) => p.id !== plot.id) }));
    deletePlot(uid, plot.id).catch(saveFailed);
  };

  const onProgress = (seasonId: string, change: SeasonProgressChange) => {
    const current = record.seasons.find((s) => s.season.id === seasonId)?.season;
    if (!current) return;
    const full: SeasonProgressChange = {
      plotId: current.plotId,
      stage: current.stage,
      sowingDate: current.sowingDate,
      harvestDate: current.harvestDate,
      harvestMon: current.harvestMon,
      ...change,
    };
    const pending = updateSeasonProgress(uid, seasonId, full, current);
    if (!pending) {
      toast.error(bn ? 'এটি রাখা গেল না। তারিখ আর সংখ্যা দেখুন।' : 'This could not be saved. Check the dates and numbers.');
      return;
    }
    const { item, saved } = pending;
    setRecord((prev) => ({
      ...prev,
      seasons: prev.seasons.map((s) => (s.season.id === seasonId ? { ...s, season: { ...s.season, ...item } } : s)),
    }));
    toast.success(bn ? 'রাখা হয়েছে' : 'Saved');
    saved.catch(saveFailed);
  };

  const withSales = (seasonId: string, update: (sales: Sale[]) => Sale[]) =>
    setRecord((prev) => ({
      ...prev,
      seasons: prev.seasons.map((s) => {
        if (s.season.id !== seasonId) return s;
        const sales = update(s.sales);
        return { ...s, sales, totals: seasonTotals(s.expenses, sales) };
      }),
    }));

  const onAddSale = (seasonId: string, input: SaleInput): boolean => {
    const pending = addSale(uid, seasonId, input);
    if (!pending) {
      toast.error(bn ? 'বিক্রির তথ্য ঠিক নেই। সংখ্যা আর তারিখ দেখুন।' : 'The sale details are not right. Check the numbers and date.');
      return false;
    }
    const { item, saved } = pending;
    withSales(seasonId, (sales) => sortSales([item, ...sales]));
    toast.success(bn ? 'বিক্রি লেখা হয়েছে' : 'Sale recorded');
    saved.catch(saveFailed);
    return true;
  };

  const onDeleteSale = (seasonId: string, sale: Sale) => {
    withSales(seasonId, (sales) => sales.filter((s) => s.id !== sale.id));
    deleteSale(uid, seasonId, sale.id).catch(saveFailed);
  };

  const { plots, seasons } = record;
  const n = (v: number) => (bn ? toBn(v) : String(v));

  const spoken = useMemo(() => {
    if (!loaded) return '';
    if (bn) {
      return `আমার খামারের হিসাব। আপনি ${toBn(plots.length)}টি জমি আর ${toBn(seasons.length)}টি মৌসুমের হিসাব রেখেছেন। জমি যোগ করুন, ফসলের অবস্থা লিখুন, আর যা বিক্রি করলেন তা লিখে রাখুন।`;
    }
    return `My farm record. You have ${plots.length} plots and ${seasons.length} seasons. Add your land, note how each crop is doing, and record what you sell.`;
  }, [loaded, bn, plots.length, seasons.length]);

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-stone-900 dark:text-stone-50">
            {bn ? 'আমার খামারের হিসাব' : 'My farm record'}
          </h2>
          <p className="mt-1 text-base text-stone-600 dark:text-stone-400 leading-relaxed">
            {bn
              ? 'আপনার জমি, ফসল আর বিক্রির হিসাব এক জায়গায়।'
              : 'Your land, crops and sales in one place.'}
          </p>
        </div>
        {spoken && <ListenButton text={spoken} lang={lang} variant="icon" className="shrink-0" />}
      </div>

      {!uid && (
        <p className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-3 text-base text-amber-900 dark:text-amber-200 leading-relaxed">
          {bn
            ? 'এই ফোনেই রাখা হচ্ছে। নিরাপদে রাখতে প্রবেশ করুন।'
            : 'Saved on this phone only. Sign in to keep it safe.'}
        </p>
      )}

      {!loaded ? (
        <p className="text-base text-stone-500 dark:text-stone-400">{bn ? 'হিসাব আনা হচ্ছে…' : 'Loading your record…'}</p>
      ) : loadFailed && record.plots.length === 0 && record.seasons.length === 0 ? (
        <div className="space-y-3" role="alert">
          <p className="text-base text-rose-800 dark:text-rose-300 leading-relaxed">
            {bn ? 'খামারের হিসাব আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : 'Could not load your farm record. Check the internet and try again.'}
          </p>
          <button
            type="button"
            onClick={retry}
            className="w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-lg font-bold active:scale-[0.98] transition-transform"
          >
            {bn ? 'আবার চেষ্টা করুন' : 'Try again'}
          </button>
        </div>
      ) : (
        <>
          <Disclosure
            label={bn ? `আমার জমি (${n(plots.length)}টি)` : `My land (${plots.length})`}
            defaultOpen={plots.length === 0}
            keepMounted
          >
            <PlotsPanel lang={lang} plots={plots} onSave={onSavePlot} onDelete={onDeletePlot} />
          </Disclosure>

          <div className="space-y-3">
            <h3 className="text-lg font-black text-stone-900 dark:text-stone-50">{bn ? 'আমার মৌসুম' : 'My seasons'}</h3>
            {seasons.length === 0 ? (
              <div className="space-y-3">
                <p className="text-base text-stone-600 dark:text-stone-400 leading-relaxed">
                  {bn
                    ? 'এখনো কোনো মৌসুমের হিসাব নেই। লাভ-ক্ষতির হিসাব করে রাখলে এখানে মৌসুম দেখা যাবে।'
                    : 'No season yet. Work out and save a plan in the profit calculator and it will show up here.'}
                </p>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('krishi-profit')}
                    className="w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <Calculator className="w-6 h-6" aria-hidden="true" />
                    {bn ? 'লাভ-ক্ষতির হিসাবে যান' : 'Go to the profit calculator'}
                  </button>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {seasons.map((s) => (
                  <SeasonCard
                    key={s.season.id}
                    lang={lang}
                    record={s}
                    plots={plots}
                    onProgress={onProgress}
                    onAddSale={onAddSale}
                    onDeleteSale={onDeleteSale}
                  />
                ))}
              </ul>
            )}
          </div>

          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="w-full min-h-[64px] rounded-3xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-lg font-bold flex items-center justify-center gap-3 shadow-sm active:scale-[0.98] transition-transform"
            >
              <Printer className="w-6 h-6" aria-hidden="true" />
              {bn ? 'আমার খামারের হিসাব ছাপুন' : 'Print my farm record'}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

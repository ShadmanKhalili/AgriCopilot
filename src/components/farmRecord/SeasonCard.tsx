import React, { useState } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import {
  BUYER_LABELS,
  MAX_QUANTITY_MON,
  SALE_LIMIT,
  SEASON_STAGES,
  type Plot,
  type SaleInput,
  type Sale,
  type SeasonProgressChange,
} from '../../../netlify/functions/_shared/farm-record-model';
import type { SeasonRecord } from '../../services/farmRecord';
import {
  STAGE_LABELS,
  cropDisplay,
  dayText,
  monText,
  plotNameFor,
  plotSizeText,
  profitView,
  takaText,
} from '../../utils/farmRecordView';
import { dhakaDateString } from '../../utils/farmTaskDates';
import NumberField from '../profit/NumberField';
import Chip, { FIELD_CLASS, LABEL_CLASS } from './Chip';
import SaleForm from './SaleForm';

interface Props {
  lang: Language;
  record: SeasonRecord;
  plots: Plot[];
  /** Change progress fields. The card sends only what changed. */
  onProgress: (seasonId: string, change: SeasonProgressChange) => void;
  /** Save a sale. Returns false when it is not valid. */
  onAddSale: (seasonId: string, input: SaleInput) => boolean;
  onDeleteSale: (seasonId: string, sale: Sale) => void;
}

const Row = ({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) => (
  <div className="flex justify-between gap-3">
    <dt>{label}</dt>
    <dd className={`tabular-nums text-right ${strong ? 'font-black text-lg' : 'font-bold'} ${tone ?? ''}`}>{value}</dd>
  </div>
);

/** One crop season: where it grew, how far it is, the money so far, and the sales. */
export default function SeasonCard({ lang, record, plots, onProgress, onAddSale, onDeleteSale }: Props) {
  const bn = lang === 'bn';
  const { season, expenses, sales, totals } = record;
  const [open, setOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [harvest, setHarvest] = useState<number | null>(season.harvestMon ?? null);

  const crop = cropDisplay(season.crop, lang);
  const plotName = plotNameFor(plots, season.plotId);
  const profit = profitView(totals, lang);
  const panelId = `farm-season-${season.id}`;
  const harvestCleared = harvest === null && season.harvestMon != null;
  const harvestChanged =
    harvestCleared ||
    (harvest !== null && harvest >= 0 && harvest <= MAX_QUANTITY_MON && harvest !== season.harvestMon);
  const today = dhakaDateString();

  const setDate = (field: 'sowingDate' | 'harvestDate', value: string) => {
    // An emptied date field clears that date.
    if (!value) {
      onProgress(season.id, { [field]: null });
      return;
    }
    const sowing = field === 'sowingDate' ? value : season.sowingDate;
    const harvestDay = field === 'harvestDate' ? value : season.harvestDate;
    if (sowing && harvestDay && harvestDay < sowing) {
      toast.error(bn ? 'কাটার তারিখ বোনার তারিখের আগে হতে পারে না।' : 'The harvest date cannot be before the sowing date.');
      return;
    }
    onProgress(season.id, { [field]: value });
  };

  const confirmDeleteSale = (sale: Sale) => {
    const sure = window.confirm(
      bn ? 'এই বিক্রির হিসাব মুছে ফেলবেন? এটি আর ফেরত আনা যাবে না।' : 'Delete this sale? This cannot be undone.'
    );
    if (sure) onDeleteSale(season.id, sale);
  };

  const startSale = () => {
    if (sales.length >= SALE_LIMIT) {
      toast.error(bn ? `এক মৌসুমে সর্বোচ্চ ${SALE_LIMIT}টি বিক্রি রাখা যায়।` : `You can keep up to ${SALE_LIMIT} sales per season.`);
      return;
    }
    setSaleOpen(true);
  };

  return (
    <li className="rounded-2xl border-2 border-stone-200 dark:border-stone-700 overflow-hidden list-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full min-h-[72px] flex items-center gap-3 px-4 py-3 text-left bg-white dark:bg-stone-900 active:bg-stone-50 dark:active:bg-stone-800"
      >
        <span className="text-3xl leading-none" aria-hidden="true">{crop.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold text-stone-900 dark:text-stone-50">{crop.name}</span>
          <span className="block text-base text-stone-600 dark:text-stone-400">
            {plotName ? `${plotName} · ` : ''}
            {plotSizeText(season, lang)}
            {season.stage ? ` · ${STAGE_LABELS[season.stage][lang]}` : ''}
          </span>
          {profit.tone && (
            <span
              className={`block text-base font-black ${
                profit.tone === 'profit'
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : profit.tone === 'no_costs'
                    ? 'text-stone-700 dark:text-stone-300'
                    : 'text-rose-800 dark:text-rose-300'
              }`}
            >
              {profit.text}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-6 h-6 shrink-0 text-stone-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={panelId} className="border-t-2 border-stone-200 dark:border-stone-700 p-4 space-y-5 bg-stone-50/60 dark:bg-stone-950/40">
          {/* Where it grew */}
          <div>
            <label htmlFor={`${panelId}-plot`} className={LABEL_CLASS}>
              {bn ? 'কোন জমিতে?' : 'Which land?'}
            </label>
            {plots.length === 0 ? (
              <p className="text-base text-stone-600 dark:text-stone-400">
                {bn ? 'আগে ওপরে জমি যোগ করুন।' : 'Add your land above first.'}
              </p>
            ) : (
              <select
                id={`${panelId}-plot`}
                value={plotName ? season.plotId : ''}
                onChange={(e) => e.target.value && onProgress(season.id, { plotId: e.target.value })}
                className={FIELD_CLASS}
              >
                <option value="" disabled>{bn ? 'জমি বাছুন' : 'Choose land'}</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* How far */}
          <div>
            <p className={LABEL_CLASS}>{bn ? 'ফসলের এখন কী অবস্থা?' : 'Where is the crop now?'}</p>
            <div className="grid grid-cols-3 gap-2" role="group">
              {SEASON_STAGES.map((s) => (
                <Chip
                  key={s}
                  selected={season.stage === s}
                  onClick={() => season.stage !== s && onProgress(season.id, { stage: s })}
                  className="px-2"
                >
                  {STAGE_LABELS[s][lang]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${panelId}-sow`} className={LABEL_CLASS}>{bn ? 'কবে বুনলেন?' : 'Sowing date'}</label>
              <input
                id={`${panelId}-sow`}
                type="date"
                value={season.sowingDate ?? ''}
                max={today}
                onChange={(e) => setDate('sowingDate', e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor={`${panelId}-har`} className={LABEL_CLASS}>{bn ? 'কবে কাটলেন?' : 'Harvest date'}</label>
              <input
                id={`${panelId}-har`}
                type="date"
                value={season.harvestDate ?? ''}
                min={season.sowingDate}
                onChange={(e) => setDate('harvestDate', e.target.value)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div>
            <NumberField
              id={`${panelId}-harvest`}
              label={bn ? 'মোট কত মণ ফসল পেলেন?' : 'How many mon did you harvest in all?'}
              lang={lang}
              value={harvest}
              onValue={setHarvest}
              suffix={bn ? 'মণ' : 'mon'}
            />
            {harvestChanged && (
              <button
                type="button"
                onClick={() => onProgress(season.id, { harvestMon: harvest })}
                className="mt-2 w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-base font-bold active:scale-[0.98]"
              >
                {harvest === null
                  ? bn ? 'ফলনের হিসাব মুছুন' : 'Clear harvest'
                  : bn ? 'ফলন রাখুন' : 'Save harvest'}
              </button>
            )}
          </div>

          {/* The money so far */}
          <div>
            <p className="text-lg font-black text-stone-900 dark:text-stone-50 mb-2">{bn ? 'টাকার হিসাব' : 'The money so far'}</p>
            <dl className="space-y-1 text-base text-stone-800 dark:text-stone-200">
              <Row
                label={bn ? `লেখা খরচ (${expenses.length}টি)` : `Costs noted (${expenses.length})`}
                value={takaText(totals.costTotal, lang)}
              />
              <Row label={bn ? 'বিক্রি হয়েছে' : 'Sold'} value={monText(totals.soldMon, lang)} />
              <Row label={bn ? 'বিক্রি থেকে আয়' : 'Money from sales'} value={takaText(totals.revenue, lang)} />
              {totals.avgPricePerMon !== null && (
                <Row label={bn ? 'গড় দাম (প্রতি মণ)' : 'Average price (per mon)'} value={takaText(totals.avgPricePerMon, lang)} />
              )}
              {(profit.tone === 'profit' || profit.tone === 'loss') && (
                <Row
                  label={profit.word}
                  value={profit.amount}
                  strong
                  tone={profit.tone === 'profit' ? 'text-emerald-800 dark:text-emerald-300' : 'text-rose-800 dark:text-rose-300'}
                />
              )}
            </dl>
            {(!profit.tone || profit.tone === 'no_costs') && (
              <p className="mt-2 text-base text-stone-600 dark:text-stone-400">
                {profit.tone === 'no_costs'
                  ? bn ? 'খরচ এখনো লেখা হয়নি। খরচ লিখলে লাভ বা ক্ষতি দেখা যাবে।' : 'No costs noted yet. Note your costs to see profit or loss.'
                  : bn ? 'কিছু বিক্রি লিখলে লাভ বা ক্ষতি দেখা যাবে।' : 'Record a sale to see profit or loss.'}
              </p>
            )}
          </div>

          {/* Sales */}
          <div className="space-y-3">
            <p className="text-lg font-black text-stone-900 dark:text-stone-50">{bn ? 'বিক্রি' : 'Sales'}</p>
            {sales.length === 0 && !saleOpen && (
              <p className="text-base text-stone-600 dark:text-stone-400">{bn ? 'এখনো কোনো বিক্রি লেখা হয়নি।' : 'No sale recorded yet.'}</p>
            )}
            {sales.length > 0 && (
              <ul className="space-y-2">
                {sales.map((sale) => (
                  <li
                    key={sale.id}
                    className="rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-stone-900 dark:text-stone-50 tabular-nums">
                        {monText(sale.quantityMon, lang)} × {takaText(sale.pricePerMon, lang)}
                        {' = '}
                        {takaText(Math.round(sale.quantityMon * sale.pricePerMon), lang)}
                      </p>
                      <p className="text-base text-stone-600 dark:text-stone-400">
                        {BUYER_LABELS[sale.buyerType]?.[lang] ?? sale.buyerType} · {dayText(sale.date, lang)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => confirmDeleteSale(sale)}
                      aria-label={bn ? 'এই বিক্রি মুছুন' : 'Delete this sale'}
                      className="w-12 h-12 shrink-0 rounded-xl border-2 border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-800 dark:text-rose-300 active:scale-95"
                    >
                      <Trash2 className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {saleOpen ? (
              <SaleForm
                lang={lang}
                onCancel={() => setSaleOpen(false)}
                onSave={(input) => {
                  const ok = onAddSale(season.id, input);
                  if (ok) setSaleOpen(false);
                  return ok;
                }}
              />
            ) : (
              <button
                type="button"
                onClick={startSale}
                className="w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Plus className="w-6 h-6" aria-hidden="true" />
                {bn ? 'বিক্রি লিখুন' : 'Record a sale'}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

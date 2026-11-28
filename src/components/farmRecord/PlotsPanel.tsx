import React, { useState } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import {
  LAND_UNITS,
  MAX_LAND_SIZE,
  PLOT_LIMIT,
  PLOT_NAME_MAX,
  TENURES,
  TENURE_LABELS,
  type LandUnit,
  type Plot,
  type Tenure,
} from '../../../netlify/functions/_shared/farm-record-model';
import { LAND_UNIT_LABELS } from '../../utils/profitPlan';
import { plotSizeText } from '../../utils/farmRecordView';
import NumberField from '../profit/NumberField';
import Chip, { FIELD_CLASS, LABEL_CLASS } from './Chip';

interface Props {
  lang: Language;
  plots: Plot[];
  /** Save a new plot (no id) or change one (id). Resolves false when the input is not valid. */
  onSave: (input: { name: string; landSize: number; landUnit: LandUnit; tenure: Tenure }, id?: string) => boolean;
  onDelete: (plot: Plot) => void;
}

/** The farmer's pieces of land: list, add, change, delete. */
export default function PlotsPanel({ lang, plots, onSave, onDelete }: Props) {
  const bn = lang === 'bn';
  const [editing, setEditing] = useState<Plot | 'new' | null>(null);
  const [name, setName] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [unit, setUnit] = useState<LandUnit>('bigha');
  const [tenure, setTenure] = useState<Tenure | null>(null);

  const open = (plot: Plot | 'new') => {
    if (plot === 'new') {
      if (plots.length >= PLOT_LIMIT) {
        toast.error(bn ? `সর্বোচ্চ ${PLOT_LIMIT}টি জমি রাখা যায়।` : `You can keep up to ${PLOT_LIMIT} plots.`);
        return;
      }
      setName('');
      setSize(null);
      setUnit('bigha');
      setTenure(null);
    } else {
      setName(plot.name);
      setSize(plot.landSize);
      setUnit(plot.landUnit);
      setTenure(plot.tenure);
    }
    setEditing(plot);
  };

  const canSave = name.trim().length > 0 && size !== null && size > 0 && size <= MAX_LAND_SIZE && tenure !== null;

  const submit = () => {
    if (!canSave || !editing || size === null || tenure === null) {
      toast.error(bn ? 'জমির নাম, মাপ আর কার জমি তা দিন।' : 'Give the land a name, its size, and whose land it is.');
      return;
    }
    const ok = onSave({ name, landSize: size, landUnit: unit, tenure }, editing === 'new' ? undefined : editing.id);
    if (ok) setEditing(null);
  };

  const confirmDelete = (plot: Plot) => {
    const sure = window.confirm(
      bn
        ? `"${plot.name}" জমিটি মুছে ফেলবেন? এই জমির মৌসুমের হিসাব মুছবে না।`
        : `Delete the plot "${plot.name}"? Its seasons are not deleted.`
    );
    if (sure) onDelete(plot);
  };

  return (
    <div className="space-y-3">
      {plots.length === 0 && editing === null && (
        <p className="text-base text-stone-600 dark:text-stone-400 leading-relaxed">
          {bn ? 'এখনো কোনো জমি লেখা হয়নি।' : 'No land added yet.'}
        </p>
      )}

      {plots.length > 0 && (
        <ul className="space-y-2">
          {plots.map((plot) => (
            <li
              key={plot.id}
              className="rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 flex items-center gap-3"
            >
              <MapPin className="w-6 h-6 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-stone-900 dark:text-stone-50 break-words">{plot.name}</p>
                <p className="text-base text-stone-600 dark:text-stone-400">
                  {plotSizeText(plot, lang)} · {TENURE_LABELS[plot.tenure]?.[lang] ?? plot.tenure}
                </p>
              </div>
              <button
                type="button"
                onClick={() => open(plot)}
                aria-label={bn ? `${plot.name} বদলান` : `Change ${plot.name}`}
                className="w-12 h-12 shrink-0 rounded-xl border-2 border-stone-300 dark:border-stone-600 flex items-center justify-center text-stone-700 dark:text-stone-200 active:scale-95"
              >
                <Pencil className="w-5 h-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(plot)}
                aria-label={bn ? `${plot.name} মুছুন` : `Delete ${plot.name}`}
                className="w-12 h-12 shrink-0 rounded-xl border-2 border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-800 dark:text-rose-300 active:scale-95"
              >
                <Trash2 className="w-5 h-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button
          type="button"
          onClick={() => open('new')}
          className="w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Plus className="w-6 h-6" aria-hidden="true" />
          {bn ? 'জমি যোগ করুন' : 'Add land'}
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-4">
          <p className="text-lg font-black text-stone-900 dark:text-stone-50">
            {editing === 'new' ? (bn ? 'নতুন জমি' : 'New land') : bn ? 'জমি বদলান' : 'Change land'}
          </p>

          <div>
            <label htmlFor="plot-name" className={LABEL_CLASS}>
              {bn ? 'জমির নাম (যেমন: বাড়ির পাশের জমি)' : 'Name of the land (for example: field by the house)'}
            </label>
            <input
              id="plot-name"
              type="text"
              value={name}
              maxLength={PLOT_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <NumberField
            id="plot-size"
            label={bn ? 'জমির মাপ' : 'Size of the land'}
            lang={lang}
            value={size}
            onValue={setSize}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label={bn ? 'মাপের একক' : 'Unit'}>
            {LAND_UNITS.map((u) => (
              <Chip key={u} selected={unit === u} onClick={() => setUnit(u)}>
                {LAND_UNIT_LABELS[u][lang]}
              </Chip>
            ))}
          </div>

          <div>
            <p className={LABEL_CLASS}>{bn ? 'এটি কার জমি?' : 'Whose land is it?'}</p>
            <div className="flex flex-wrap gap-2" role="group">
              {TENURES.map((t) => (
                <Chip key={t} selected={tenure === t} onClick={() => setTenure(t)}>
                  {TENURE_LABELS[t][lang]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-[56px] rounded-2xl border-2 border-stone-300 dark:border-stone-600 text-base font-bold text-stone-800 dark:text-stone-100 active:scale-[0.98]"
            >
              {bn ? 'থাক' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={submit}
              className="min-h-[56px] rounded-2xl bg-emerald-700 text-white text-base font-bold active:scale-[0.98]"
            >
              {bn ? 'রাখুন' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

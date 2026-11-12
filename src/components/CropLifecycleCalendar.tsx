import React, { useMemo } from 'react';
import { Calendar, Sprout, ShieldAlert, Droplets, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { toBn } from '../utils/banglaNum';
import { CROP_SCHEDULES } from '../data/cropCalendars';
import { hasCalendar, planTimeline, type CropPlan } from '../utils/cropCalendar';
import { toggleStageDone } from '../utils/cropPlan';
import { useCropPlan } from '../hooks/useCropPlan';

interface Props {
  lang: Language;
  selectedCropKey?: string;
  weatherForecastSummary?: string;
}

const CROP_KEYS = Object.keys(CROP_SCHEDULES);

/** Today as 'YYYY-MM-DD' in the farmer's local calendar. */
function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDue(dueDate: string, lang: Language): string {
  const d = new Date(`${dueDate}T00:00:00Z`);
  return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function CropLifecycleCalendar({
  lang,
  selectedCropKey = 'paddy',
  weatherForecastSummary
}: Props) {
  const bn = lang === 'bn';
  const num = (n: number | string) => (bn ? toBn(n) : String(n));
  const [savedPlan, setSavedPlan] = useCropPlan();

  const today = localToday();

  // The farmer's saved plan wins. Without one, start from the prop (as before) and today's date.
  const plan: CropPlan = useMemo(
    () =>
      savedPlan && hasCalendar(savedPlan.cropKey)
        ? savedPlan
        : {
            cropKey: hasCalendar(selectedCropKey) ? selectedCropKey : 'paddy',
            sowingDate: today,
            completedStages: [],
          },
    [savedPlan, selectedCropKey, today]
  );

  const config = CROP_SCHEDULES[plan.cropKey];
  const timeline = useMemo(() => planTimeline(plan, today), [plan, today]);

  const confirmClear = (): boolean => {
    if (plan.completedStages.length === 0) return true;
    return window.confirm(
      bn
        ? 'পরিবর্তন করলে সম্পন্ন করা কাজের চিহ্নগুলো মুছে যাবে। এগিয়ে যাবেন?'
        : 'Changing this will clear the stages you have ticked off. Continue?'
    );
  };

  const changeCrop = (cropKey: string) => {
    if (cropKey === plan.cropKey || !hasCalendar(cropKey)) return;
    if (!confirmClear()) return;
    setSavedPlan({ cropKey, sowingDate: plan.sowingDate, completedStages: [] });
  };

  const changeDate = (sowingDate: string) => {
    if (!sowingDate || sowingDate === plan.sowingDate) return;
    if (!confirmClear()) return;
    setSavedPlan({ cropKey: plan.cropKey, sowingDate, completedStages: [] });
  };

  const toggleComplete = (idx: number) => {
    setSavedPlan(toggleStageDone(plan, idx));
    toast.success(bn ? 'কার্যক্রম আপডেট হয়েছে' : 'Task status updated');
  };

  const doneCount = timeline.filter((t) => t.done).length;
  const harvestDate = timeline.length > 0 ? formatDue(timeline[timeline.length - 1].dueDate, lang) : '';

  const typeLabel = (type: string) =>
    bn
      ? (type === 'fertilizer' ? 'সার' : type === 'irrigation' ? 'সেচ' : type === 'pesticide' ? 'দমন' : 'কর্তন')
      : (type === 'fertilizer' ? 'Fertiliser' : type === 'irrigation' ? 'Irrigation' : type === 'pesticide' ? 'Protection' : 'Harvest');

  const cropName = (key: string) => (bn ? CROP_SCHEDULES[key].nameBn : CROP_SCHEDULES[key].nameEn);

  const dueLabel = (daysFromToday: number) => {
    if (daysFromToday === 0) return bn ? 'আজ' : 'Today';
    if (daysFromToday > 0) return bn ? `${num(daysFromToday)} দিন পরে` : `in ${daysFromToday} day${daysFromToday === 1 ? '' : 's'}`;
    const n = -daysFromToday;
    return bn ? `${num(n)} দিন আগে` : `${n} day${n === 1 ? '' : 's'} ago`;
  };

  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 border border-green-100 shadow-xl shadow-green-900/5 relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 pb-4 sm:pb-5 border-b border-gray-100 relative z-10">
        <div className="flex items-center space-x-3 sm:space-x-3.5">
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-2.5 sm:p-3 rounded-2xl text-white shadow-lg shadow-green-600/30 shrink-0">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                {bn ? 'মৌসুমী পরিচর্যা তালিকা' : 'Seasonal care list'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">
              {bn ? 'ফসলের সময়সূচি ও পরিচর্যা ক্যালেন্ডার' : 'Crop Lifecycle & Spray Schedule'}
            </h3>
          </div>
        </div>

        {/* Date Selector & Crop Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <label className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-xl sm:rounded-2xl border border-gray-200 flex-1 sm:flex-none">
            <span className="text-sm font-bold text-gray-600 pl-2">{bn ? 'ফসল:' : 'Crop:'}</span>
            <select
              aria-label={bn ? 'ফসল' : 'Crop'}
              value={plan.cropKey}
              onChange={(e) => changeCrop(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 min-h-12 text-sm font-black text-gray-800 outline-none cursor-pointer flex-1 sm:flex-none"
            >
              {CROP_KEYS.map((key) => (
                <option key={key} value={key}>
                  {cropName(key)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center space-x-2 bg-gray-50 p-1.5 rounded-xl sm:rounded-2xl border border-gray-200 flex-1 sm:flex-none">
            <span className="text-sm font-bold text-gray-600 pl-2">{bn ? 'রোপণ:' : 'Sown:'}</span>
            <input
              type="date"
              aria-label={bn ? 'রোপণ তারিখ' : 'Sowing date'}
              value={plan.sowingDate}
              onChange={(e) => changeDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg sm:rounded-xl px-3 min-h-12 text-sm font-black text-gray-800 outline-none cursor-pointer flex-1 sm:flex-none"
            />
          </label>
        </div>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-5 sm:mb-8 relative z-10">
        <div className="bg-emerald-50/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-emerald-100 flex items-center space-x-2.5 sm:space-x-3.5">
          <div className="p-2 sm:p-2.5 bg-emerald-600 rounded-xl text-white shrink-0">
            <Sprout className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-emerald-800 block">{bn ? 'জীবনকাল' : 'Growth Cycle'}</span>
            <div className="text-base sm:text-lg font-black text-emerald-950">
              {num(config.durationDays)} {bn ? 'দিন' : 'Days'}
            </div>
          </div>
        </div>

        <div className="bg-blue-50/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-100 flex items-center space-x-2.5 sm:space-x-3.5">
          <div className="p-2 sm:p-2.5 bg-blue-600 rounded-xl text-white shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-blue-800 block">{bn ? 'আনুমানিক কর্তন' : 'Est. Harvest Date'}</span>
            <div className="text-sm sm:text-base font-black text-blue-950">{harvestDate}</div>
          </div>
        </div>

        <div className="bg-amber-50/60 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-amber-100 flex items-center space-x-2.5 sm:space-x-3.5">
          <div className="p-2 sm:p-2.5 bg-amber-600 rounded-xl text-white shrink-0">
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-amber-800 block">{bn ? 'পরিচর্যা পর্যায়' : 'Key Milestones'}</span>
            <div className="text-base sm:text-lg font-black text-amber-950">
              {num(doneCount)} / {num(timeline.length)} {bn ? 'সম্পন্ন' : 'Done'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Timeline */}
      <div className="relative pl-6 sm:pl-8 md:pl-10 space-y-4 sm:space-y-5 md:space-y-6 before:absolute before:left-3 sm:before:left-4 md:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-green-500 before:via-emerald-400 before:to-gray-200">
        {timeline.map((task, idx) => {
          const stage = config.stages[task.stageIndex];
          const isDone = task.done;
          const isToday = task.daysFromToday === 0;
          const isOverdue = task.daysFromToday < 0 && !isDone;
          const typeBadgeColor =
            stage.type === 'fertilizer' ? 'bg-amber-100 text-amber-800 border-amber-200' :
            stage.type === 'irrigation' ? 'bg-blue-100 text-blue-800 border-blue-200' :
            stage.type === 'pesticide' ? 'bg-red-100 text-red-800 border-red-200' :
            'bg-emerald-100 text-emerald-800 border-emerald-200';

          return (
            <motion.div
              key={task.stageIndex}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative rounded-2xl md:rounded-3xl p-3.5 sm:p-5 md:p-6 border transition-all ${
                isDone
                  ? 'bg-gray-50/80 border-gray-200 opacity-70'
                  : isToday
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-2 border-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-white border-gray-100 hover:border-green-200 shadow-sm'
              }`}
            >
              {/* Timeline Pin */}
              <div
                aria-hidden="true"
                className={`absolute -left-[27px] sm:-left-[35px] md:-left-[46px] top-4 sm:top-5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  isDone
                    ? 'bg-green-600 border-green-600 text-white'
                    : isToday
                    ? 'bg-white border-emerald-500 text-emerald-600 ring-4 ring-emerald-100 animate-pulse'
                    : isOverdue
                    ? 'bg-white border-red-400 text-red-500'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
              </div>

              {/* Stage Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-2.5">
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full border shrink-0 ${typeBadgeColor}`}>
                    {typeLabel(stage.type)}
                  </span>
                  <h4 className="text-base md:text-lg font-black text-gray-900">
                    {bn ? task.title.bn : task.title.en}
                  </h4>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-600 shrink-0">
                  <span className="bg-gray-100 px-2 py-0.5 rounded-md">
                    {formatDue(task.dueDate, lang)} ({bn ? 'দিন' : 'Day'} {num(stage.day)})
                  </span>
                  {!isDone && (
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        isOverdue ? 'bg-red-100 text-red-800' : isToday ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-600'
                      }`}
                    >
                      {dueLabel(task.daysFromToday)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action and Care Details */}
              <div className="space-y-2 sm:space-y-2.5">
                <div className="bg-white/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-100 text-sm font-medium text-gray-800 leading-relaxed">
                  <span className="font-bold text-emerald-700 mr-1.5">{bn ? 'করণীয়:' : 'Action:'}</span>
                  {bn ? task.detail.bn : task.detail.en}
                </div>

                {/* Risk / Weather Warning */}
                <div className="flex items-start space-x-2 text-sm text-amber-900 bg-amber-50/70 p-2.5 sm:p-3 rounded-xl border border-amber-100/80">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold mr-1">{bn ? 'সতর্কতা:' : 'Key Alert:'}</span>
                    {bn ? stage.riskBn : stage.riskEn}
                  </div>
                </div>
              </div>

              {/* Water & Done Actions */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-1.5 text-sm text-blue-700 font-bold">
                  <Droplets className="w-4 h-4" />
                  <span>
                    {bn
                      ? `পানির চাহিদা: ${stage.waterNeed === 'High' ? 'উচ্চ' : stage.waterNeed === 'Medium' ? 'মাঝারি' : 'কম'}`
                      : `Moisture Need: ${stage.waterNeed}`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleComplete(task.stageIndex)}
                  aria-pressed={isDone}
                  className={`text-sm font-black px-4 min-h-12 rounded-xl transition-all cursor-pointer ${
                    isDone
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {isDone
                    ? (bn ? '✓ সম্পন্ন' : '✓ Completed')
                    : (bn ? 'সম্পন্ন হিসেবে চিহ্নিত' : 'Mark as Done')}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

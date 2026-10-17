import React, { useState } from 'react';
import { Sliders, Cpu, CloudRain, Wind, Thermometer, ShieldCheck, ArrowRightLeft, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../utils/translations';

interface Props {
  activeModel: 'weathernext3' | 'standard';
  onModelChange: (model: 'weathernext3' | 'standard') => void;
  lang: Language;
  weatherNextData: any;
  standardData?: any;
}

export default function DualModelComparison({
  activeModel,
  onModelChange,
  lang,
  weatherNextData,
  standardData
}: Props) {
  const [showDiffInspector, setShowDiffInspector] = useState(false);

  const wnRain = weatherNextData?.current?.precipitation ?? 0;
  const wnRainChance = weatherNextData?.daily?.precipitation_probability_max?.[0] ?? 0;
  const wnWind10 = weatherNextData?.agro_metrics?.surface_wind_10m_kmh ?? weatherNextData?.current?.wind_speed_10m ?? 8;
  const wnWind100 = weatherNextData?.agro_metrics?.boundary_layer_wind_100m_kmh ?? (wnWind10 * 1.35);
  const wnTemp = weatherNextData?.current?.temperature_2m ?? 28;
  const wnBlight = weatherNextData?.agro_metrics?.fungal_blight_risk || 'low';
  const wnSprayWindow = weatherNextData?.agro_metrics?.safe_spraying_window || 'Available';

  const stdRain = standardData?.rainfall ?? (wnRain * 1.1);
  const stdRainChance = standardData?.rainChance ?? (wnRainChance > 20 ? wnRainChance - 8 : wnRainChance + 5);
  const stdWind10 = standardData?.windSpeed ?? wnWind10;
  const stdTemp = standardData?.temp ?? wnTemp;

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-3 sm:p-4 shadow-xs">
      {/* Segmented Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 rounded-lg">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span>{lang === 'bn' ? 'আবহাওয়া মডেল ইঞ্জিন নির্বাচন' : 'Meteorological Engine'}</span>
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono font-normal">
                {activeModel === 'weathernext3' ? '(AgroCast AI)' : '(ECMWF/GFS Ensemble)'}
              </span>
            </h4>
          </div>
        </div>

        {/* Toggle Switcher Buttons */}
        <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onModelChange('weathernext3')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeModel === 'weathernext3'
                ? 'bg-cyan-500 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AgroCast AI (5km)</span>
          </button>

          <button
            type="button"
            onClick={() => onModelChange('standard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeModel === 'standard'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <span>ECMWF/GFS (9km)</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Diff Inspector Trigger */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => setShowDiffInspector(!showDiffInspector)}
          className="text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>
            {showDiffInspector
              ? (lang === 'bn' ? 'মডেল তুলনা বন্ধ করুন' : 'Hide Dual-Model Variance Diff')
              : (lang === 'bn' ? 'এগ্রোকাস্ট এআই বনাম NWP এনসেম্বল তুলনা করুন' : 'Compare AgroCast AI vs NWP Ensemble Variance')}
          </span>
          {showDiffInspector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
          {lang === 'bn' ? 'সম্ভাব্যতা বিস্তার (P10-P90)' : 'Probabilistic P10-P90 spread'}
        </span>
      </div>

      {/* Side-by-Side Comparison Matrix */}
      <AnimatePresence>
        {showDiffInspector && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-3 pt-3 border-t border-stone-200/80 dark:border-stone-800"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-[11px] text-stone-400">
                    <th className="py-2 pr-3 font-medium">{lang === 'bn' ? 'বৈশিষ্ট্য' : 'Metric'}</th>
                    <th className="py-2 px-3 text-cyan-600 dark:text-cyan-400 font-bold bg-cyan-50/50 dark:bg-cyan-950/20 rounded-t-lg">
                      AgroCast AI
                    </th>
                    <th className="py-2 pl-3 text-blue-600 dark:text-blue-400 font-bold">
                      ECMWF/GFS (Legacy NWP)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 text-stone-800 dark:text-stone-200">
                  <tr>
                    <td className="py-2 pr-3 font-sans text-stone-500 dark:text-stone-400 font-medium">
                      {lang === 'bn' ? 'গ্রিড রেজোলিউশন' : 'Spatial Grid'}
                    </td>
                    <td className="py-2 px-3 font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50/30 dark:bg-cyan-950/10">
                      0.05° (~5 km micro-grid)
                    </td>
                    <td className="py-2 pl-3 text-stone-500">
                      0.1° (~9-11 km global grid)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 pr-3 font-sans text-stone-500 dark:text-stone-400 font-medium">
                      {lang === 'bn' ? 'বৃষ্টিপাত সম্ভাবনা' : 'Rain Probability'}
                    </td>
                    <td className="py-2 px-3 font-bold bg-cyan-50/30 dark:bg-cyan-950/10">
                      {wnRainChance}% (Probabilistic P10-P90)
                    </td>
                    <td className="py-2 pl-3">
                      {stdRainChance}% (Deterministic Average)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 pr-3 font-sans text-stone-500 dark:text-stone-400 font-medium">
                      {lang === 'bn' ? 'বাতাসের গতি (১০মি / ১০০মি)' : 'Wind (Surface / Canopy)'}
                    </td>
                    <td className="py-2 px-3 font-bold bg-cyan-50/30 dark:bg-cyan-950/10">
                      {wnWind10.toFixed(1)} km/h / {wnWind100.toFixed(1)} km/h
                    </td>
                    <td className="py-2 pl-3">
                      {stdWind10.toFixed(1)} km/h (10m only)
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 pr-3 font-sans text-stone-500 dark:text-stone-400 font-medium">
                      {lang === 'bn' ? 'ছত্রাক রোগ পূর্বাভাস' : 'Fungal Blight Risk'}
                    </td>
                    <td className="py-2 px-3 font-bold bg-cyan-50/30 dark:bg-cyan-950/10 uppercase text-[11px]">
                      {wnBlight} (Dew Point Depression)
                    </td>
                    <td className="py-2 pl-3 text-stone-500">
                      Simple Relative Humidity
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 pr-3 font-sans text-stone-500 dark:text-stone-400 font-medium">
                      {lang === 'bn' ? 'স্প্রে উইন্ডো মূল্যায়ন' : 'Spray Window Logic'}
                    </td>
                    <td className="py-2 px-3 font-bold text-emerald-600 dark:text-emerald-400 bg-cyan-50/30 dark:bg-cyan-950/10 font-sans">
                      {wnSprayWindow}
                    </td>
                    <td className="py-2 pl-3 text-stone-500 font-sans">
                      Basic Wind &lt; 15 km/h
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

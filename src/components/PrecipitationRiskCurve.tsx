import React, { useState } from 'react';
import { Droplets, Wind, ShieldCheck, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import { Language } from '../utils/translations';

export interface HourlySpreadItem {
  time: string;
  displayTime: string;
  temp: number;
  p10: number;
  p50: number;
  p90: number;
  rainProb: number;
  rainQpf: number;
  windSpeed: number;
  wind100m: number;
  condition: string;
  isSafeSpray: boolean;
}

interface Props {
  data: HourlySpreadItem[];
  lang: Language;
  safeSprayingWindow?: string;
  safeWindowDetail?: {
    start: string;
    end: string;
    avgWind: number;
    avgTemp: number;
    rainRisk: number;
  } | null;
}

export default function PrecipitationRiskCurve({ data, lang, safeSprayingWindow, safeWindowDetail }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return null;
  }

  const items = data.slice(0, 36); // Display up to 36 hours for optimal curve density
  const maxRain = Math.max(5, ...items.map(d => Math.max(d.p90, d.p50, d.rainQpf)));
  const chartHeight = 160;
  const chartWidth = 720;
  const paddingX = 36;
  const paddingY = 24;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const getX = (idx: number) => paddingX + (idx / (items.length - 1)) * innerWidth;
  const getY = (val: number) => paddingY + innerHeight - (Math.min(val, maxRain) / maxRain) * innerHeight;

  // Build SVG path for P90 (upper bound) and P10 (lower bound) envelope area
  const p90Points = items.map((d, i) => `${getX(i).toFixed(1)},${getY(d.p90).toFixed(1)}`);
  const p10PointsReverse = items.map((d, i) => `${getX(i).toFixed(1)},${getY(d.p10).toFixed(1)}`).reverse();
  const envelopeAreaPath = `M ${p90Points.join(' L ')} L ${p10PointsReverse.join(' L ')} Z`;

  // Build median P50 line path
  const p50LinePath = items.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)},${getY(d.p50).toFixed(1)}`).join(' ');

  // Active hover element
  const activeItem = hoveredIdx !== null && items[hoveredIdx] ? items[hoveredIdx] : items[0];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 text-stone-100 shadow-sm relative overflow-hidden">
      {/* Header & Metrics Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg">
              <Droplets className="w-4 h-4" />
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {lang === 'bn' ? '৪৮ ঘণ্টার সম্ভাব্য বৃষ্টিপাত বিস্তার (P10 / P50 / P90)' : '48-Hour Probabilistic Precipitation Risk Envelope'}
            </h4>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            {lang === 'bn' 
              ? 'মডেল-ভিত্তিক বৃষ্টিপাত বিস্তার (P10-P90) ও অতি-বৃষ্টির ঝুঁকি'
              : 'Model-derived precipitation spread (P10-P90) & cloudburst tail risk'}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-stone-300 font-mono flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-blue-500/30 border border-blue-400/60 inline-block" />
            <span className="text-stone-400">P10-P90 {lang === 'bn' ? 'বিস্তার' : 'Spread'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
            <span className="text-stone-200">P50 {lang === 'bn' ? 'প্রত্যাশিত' : 'Median'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30 border border-emerald-400 inline-block" />
            <span className="text-emerald-300">{lang === 'bn' ? 'নিরাপদ স্প্রে' : 'Safe Spray'}</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart Area */}
      <div className="relative mt-3 select-none">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-44 sm:h-52 overflow-visible"
        >
          <defs>
            <linearGradient id="envelopeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="safeSprayGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingY + innerHeight * (1 - ratio);
            const valMm = (maxRain * ratio).toFixed(1);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="2,3"
                  strokeWidth="0.8"
                />
                <text
                  x={paddingX - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {valMm}mm
                </text>
              </g>
            );
          })}

          {/* Safe Spray Zone Vertical Highlights */}
          {items.map((item, idx) => {
            if (!item.isSafeSpray) return null;
            const x = getX(idx);
            const colWidth = innerWidth / items.length;
            return (
              <rect
                key={`safe-${idx}`}
                x={x - colWidth / 2}
                y={paddingY}
                width={colWidth}
                height={innerHeight}
                fill="url(#safeSprayGrad)"
              />
            );
          })}

          {/* P10 - P90 Uncertainty Envelope Path */}
          <path
            d={envelopeAreaPath}
            fill="url(#envelopeGrad)"
            stroke="#38bdf8"
            strokeWidth="0.75"
            strokeOpacity="0.5"
          />

          {/* P50 Median Line Path */}
          <path
            d={p50LinePath}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Safe Spraying indicator dots */}
          {items.map((item, idx) => {
            const x = getX(idx);
            const y = getY(item.p50);
            return (
              <g key={`point-${idx}`}>
                {item.isSafeSpray && (
                  <circle
                    cx={x}
                    cy={paddingY + innerHeight}
                    r="2.5"
                    fill="#10b981"
                  />
                )}
                {/* Data point circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={hoveredIdx === idx ? 4.5 : 2}
                  fill={hoveredIdx === idx ? '#ffffff' : '#06b6d4'}
                  stroke="#0284c7"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}

          {/* Hover Crosshair Line */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={paddingY}
              x2={getX(hoveredIdx)}
              y2={paddingY + innerHeight}
              stroke="#e2e8f0"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />
          )}

          {/* Interactive touch/hover overlay hitboxes */}
          {items.map((_, idx) => {
            const x = getX(idx);
            const colWidth = innerWidth / items.length;
            return (
              <rect
                key={`hit-${idx}`}
                x={x - colWidth / 2}
                y={paddingY}
                width={colWidth}
                height={innerHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onTouchStart={() => setHoveredIdx(idx)}
              />
            );
          })}

          {/* Time axis labels */}
          {items.map((item, idx) => {
            if (idx % 4 !== 0 && idx !== items.length - 1) return null;
            const x = getX(idx);
            return (
              <text
                key={`label-${idx}`}
                x={x}
                y={chartHeight - 4}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
              >
                {item.displayTime}
              </text>
            );
          })}
        </svg>

        {/* Hover Inspector Card */}
        {activeItem && (
          <div className="mt-2 p-3 bg-stone-950/90 rounded-xl border border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div>
              <span className="text-[10px] text-stone-400 block font-sans">
                {lang === 'bn' ? 'সময় ও তাপমাত্রা' : 'Hour & Temp'}
              </span>
              <span className="font-bold text-white tabular-nums">
                {activeItem.displayTime} · {activeItem.temp.toFixed(1)}°C
              </span>
            </div>

            <div>
              <span className="text-[10px] text-stone-400 block font-sans">
                {lang === 'bn' ? 'বৃষ্টিপাত সম্ভাবনা' : 'Rain Prob'}
              </span>
              <span className="font-bold text-cyan-400 tabular-nums">
                {activeItem.rainProb}% ({activeItem.rainQpf.toFixed(1)} mm)
              </span>
            </div>

            <div>
              <span className="text-[10px] text-stone-400 block font-sans">
                {lang === 'bn' ? 'সম্ভাব্য বৃষ্টি বিস্তার' : 'P10 - P90 Spread'}
              </span>
              <span className="font-bold text-sky-300 tabular-nums">
                {activeItem.p10.toFixed(1)} - {activeItem.p90.toFixed(1)} mm
              </span>
            </div>

            <div>
              <span className="text-[10px] text-stone-400 block font-sans">
                {lang === 'bn' ? 'স্প্রে নিরাপত্তা অবস্থা' : 'Spray Safety'}
              </span>
              <span className={`font-bold inline-flex items-center gap-1 ${
                activeItem.isSafeSpray ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {activeItem.isSafeSpray ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'নিরাপদ' : 'Safe Window'}</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ঝুঁকিপূর্ণ' : 'Unfavorable'}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Certified Safe Spraying Window Callout */}
      {safeSprayingWindow && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-950/30 border border-emerald-700/40 flex items-start gap-2.5 text-xs">
          <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-emerald-300 uppercase tracking-wider block text-[11px]">
              {lang === 'bn' ? 'প্রত্যয়িত নিরাপদ রাসায়নিক স্প্রে উইন্ডো' : 'Certified Agrochemical Spray Window'}
            </span>
            <p className="text-stone-200 mt-0.5 font-medium">
              {safeSprayingWindow}
            </p>
            {safeWindowDetail && (
              <p className="text-[11px] text-stone-400 mt-0.5 font-mono">
                {lang === 'bn' ? 'বাতাস:' : 'Wind:'} {safeWindowDetail.avgWind} km/h · {lang === 'bn' ? 'তাপমাত্রা:' : 'Temp:'} {safeWindowDetail.avgTemp}°C · {lang === 'bn' ? 'বৃষ্টির ঝুঁকি:' : 'Rain Risk:'} {safeWindowDetail.rainRisk}%
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

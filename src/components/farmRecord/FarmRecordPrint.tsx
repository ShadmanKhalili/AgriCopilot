import React from 'react';
import type { Language } from '../../utils/translations';
import type { FarmRecord, StoredRecordScore } from '../../services/farmRecord';
import {
  RECORD_LEVEL_LABELS,
  RECORD_PILLAR_LABELS,
  TENURE_LABELS,
} from '../../../netlify/functions/_shared/farm-record-model';
import { toBn } from '../../utils/banglaNum';
import { dhakaDateString } from '../../utils/farmTaskDates';
import {
  STAGE_LABELS,
  cropDisplay,
  dayText,
  monText,
  plotNameFor,
  plotSizeText,
  profitView,
  recordTotals,
  takaText,
} from '../../utils/farmRecordView';

interface Props {
  lang: Language;
  record: FarmRecord;
  /** The server's record score, or null when there is none to show. */
  score: StoredRecordScore | null;
  farmerName: string;
  district: string;
  upazila: string;
}

const CELL = 'border border-stone-700 px-1.5 py-1 align-top';
const HEAD = `${CELL} bg-stone-200 text-left font-bold`;
const NUM = `${CELL} text-right tabular-nums`;

/**
 * A one-page A4 print of the farm record. Hidden on screen; shown only when
 * printing, black on white. Everything in it is what the farmer typed.
 */
export default function FarmRecordPrint({ lang, record, score, farmerName, district, upazila }: Props) {
  const bn = lang === 'bn';
  const t = (b: string, e: string) => (bn ? b : e);
  const num = (v: number) => (bn ? toBn(v) : String(v));
  const { plots, seasons } = record;
  const totals = recordTotals(seasons.map((s) => ({ totals: s.totals, harvestMon: s.season.harvestMon })));
  const total = profitView(
    { profit: totals.profit, revenue: totals.incomeWithoutCosts, costCount: 0 },
    lang
  );
  const place = [upazila, district].filter(Boolean).join(', ');

  return (
    <div className="hidden print:block bg-white text-black text-[10.5pt] leading-snug font-sans">
      <header className="border-b-2 border-black pb-2 mb-3">
        <h1 className="text-[16pt] font-black">{t('আমার খামারের হিসাব', 'My farm record')}</h1>
        {(farmerName || place) && (
          <p>
            {farmerName && (
              <>
                <span className="font-bold">{t('কৃষক: ', 'Farmer: ')}</span>
                {farmerName}
              </>
            )}
            {farmerName && place && '   '}
            {place && (
              <>
                <span className="font-bold">{t('এলাকা: ', 'Area: ')}</span>
                {place}
              </>
            )}
          </p>
        )}
        <p>
          <span className="font-bold">{t('ছাপার তারিখ: ', 'Date printed: ')}</span>
          {dayText(dhakaDateString(), lang)}
        </p>
      </header>

      <section className="mb-3">
        <h2 className="text-[12pt] font-bold mb-1">{t('জমি', 'Land')}</h2>
        {plots.length === 0 ? (
          <p>{t('কোনো জমি লেখা হয়নি।', 'No land recorded.')}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={HEAD}>{t('নাম', 'Name')}</th>
                <th className={HEAD}>{t('মাপ', 'Size')}</th>
                <th className={HEAD}>{t('কার জমি', 'Tenure')}</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((p) => (
                <tr key={p.id}>
                  <td className={CELL}>{p.name}</td>
                  <td className={CELL}>{plotSizeText(p, lang)}</td>
                  <td className={CELL}>{TENURE_LABELS[p.tenure]?.[lang] ?? p.tenure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-3">
        <h2 className="text-[12pt] font-bold mb-1">{t('মৌসুম', 'Seasons')}</h2>
        {seasons.length === 0 ? (
          <p>{t('কোনো মৌসুমের হিসাব নেই।', 'No seasons recorded.')}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={HEAD}>{t('ফসল', 'Crop')}</th>
                <th className={HEAD}>{t('জমি', 'Land')}</th>
                <th className={HEAD}>{t('বোনা', 'Sown')}</th>
                <th className={HEAD}>{t('ফলন', 'Harvest')}</th>
                <th className={`${HEAD} text-right`}>{t('খরচ', 'Costs')}</th>
                <th className={`${HEAD} text-right`}>{t('বিক্রির আয়', 'Sales')}</th>
                <th className={`${HEAD} text-right`}>{t('লাভ / ক্ষতি', 'Profit / loss')}</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(({ season, totals: st }) => {
                const pv = profitView(st, lang);
                const plot = plotNameFor(plots, season.plotId);
                return (
                  <tr key={season.id} className="break-inside-avoid">
                    <td className={CELL}>
                      {cropDisplay(season.crop, lang).name}
                      {season.stage && (
                        <span className="block text-[9pt]">{STAGE_LABELS[season.stage][lang]}</span>
                      )}
                    </td>
                    <td className={CELL}>
                      {plot || '-'}
                      <span className="block text-[9pt]">{plotSizeText(season, lang)}</span>
                    </td>
                    <td className={CELL}>{dayText(season.sowingDate, lang)}</td>
                    <td className={CELL}>
                      {season.harvestMon !== undefined ? monText(season.harvestMon, lang) : '-'}
                      {season.harvestDate && <span className="block text-[9pt]">{dayText(season.harvestDate, lang)}</span>}
                    </td>
                    <td className={NUM}>{takaText(st.costTotal, lang)}</td>
                    <td className={NUM}>
                      {st.soldMon > 0 ? (
                        <>
                          {takaText(st.revenue, lang)}
                          <span className="block text-[9pt]">{monText(st.soldMon, lang)}</span>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={NUM}>{pv.tone ? pv.text : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className={CELL} colSpan={3}>{t('মোট', 'Total')}</td>
                <td className={CELL}>{totals.harvestMon > 0 ? monText(totals.harvestMon, lang) : '-'}</td>
                <td className={NUM}>{takaText(totals.costTotal, lang)}</td>
                <td className={NUM}>{totals.revenue > 0 ? takaText(totals.revenue, lang) : '-'}</td>
                <td className={NUM}>{total.tone ? total.text : '-'}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <p className="mt-1 text-[9pt]">
          {t(
            'লাভ বা ক্ষতি = বিক্রির আয় - লেখা খরচ। শুধু যে মৌসুমে বিক্রি ও খরচ দুটোই লেখা আছে, তার হিসাব ধরা হয়েছে।',
            'Profit or loss = money from sales minus the costs noted. Only seasons with both a sale and costs noted are counted.'
          )}
          {totals.profit !== null && totals.incomeWithoutCosts > 0 && (
            <>
              {' '}
              {t(
                `খরচ লেখা হয়নি এমন মৌসুমের আয় ${takaText(totals.incomeWithoutCosts, lang)} লাভের হিসাবে ধরা হয়নি।`,
                `Income of ${takaText(totals.incomeWithoutCosts, lang)} from seasons with no costs noted is not in the profit.`
              )}
            </>
          )}
        </p>
      </section>

      {score && (
        <section className="mb-3 break-inside-avoid">
          <h2 className="text-[12pt] font-bold mb-1">{t('রেকর্ড স্কোর', 'Record score')}</h2>
          <p>
            <span className="text-[14pt] font-black">{num(score.score)} / {num(100)}</span>
            {' - '}
            {RECORD_LEVEL_LABELS[score.level]?.[lang] ?? score.level}
          </p>
          <p className="text-[9.5pt]">
            {score.pillars
              .map((p) => {
                const pts = `${num(p.points)}/${num(p.max)}`;
                return `${RECORD_PILLAR_LABELS[p.key]?.[lang] ?? p.key} ${pts}`;
              })
              .join(' · ')}
          </p>
        </section>
      )}

      <footer className="border-t-2 border-black pt-2 text-[10pt] font-bold">
        <p>আপনার নিজের লেখা হিসাব থেকে তৈরি, অ্যাগ্রিকোপাইলটে। কেউ যাচাই করেনি।</p>
        <p>Built from the farmer's own records in AgriCopilot. Not checked by anyone.</p>
      </footer>
    </div>
  );
}

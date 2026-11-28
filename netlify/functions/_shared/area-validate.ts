/**
 * Server-side check that an area report names a real place, a real crop and a
 * real disease, and the notification text built from the checked values.
 *
 * The lists are in area-catalog.ts (generated; see scripts/gen-area-catalog.ts).
 * Whatever the app sent, everything stored or sent to phones comes from the
 * catalog, never from the request text.
 */

import { AREA_DISEASES, AREA_CROPS, AREA_PLACES, AREA_PRICE_CROPS } from './area-catalog.ts';
import { AREA_WINDOW_DAYS, slug, type CleanAreaReport } from './area-model.ts';
import type { PushMessage } from './push-send.ts';

const has = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

export interface ValidatedReport {
  /** The report with `district` and `upazila` replaced by their catalog slugs. */
  report: CleanAreaReport;
  /** Display names from the catalog. */
  cropName: { bn: string; en: string };
  /** For a problem report: the knowledge-base key (`paddy:rice-blast`) and names. */
  disease?: { key: string; bn: string; en: string };
}

/** The checked report, or null when the place, crop or disease is not in the app's lists. */
export const validateAreaReport = (report: CleanAreaReport): ValidatedReport | null => {
  const district = slug(report.district);
  const upazila = slug(report.upazila);
  if (!has(AREA_PLACES, district) || !AREA_PLACES[district].includes(upazila)) return null;
  const checked: CleanAreaReport = { ...report, district, upazila };

  if (report.kind === 'problem') {
    const entry = has(AREA_DISEASES, report.diseaseKey ?? '') ? AREA_DISEASES[report.diseaseKey as string] : null;
    // The crop must be the disease's own crop: "tomato" cannot report a paddy disease.
    if (!entry || entry.crop !== report.crop || !has(AREA_CROPS, report.crop)) return null;
    return {
      report: { ...checked, diseaseKey: report.diseaseKey },
      cropName: AREA_CROPS[report.crop],
      disease: { key: entry.key, bn: entry.bn, en: entry.en },
    };
  }

  if (report.kind === 'price') {
    if (!AREA_PRICE_CROPS.includes(report.crop) || !has(AREA_CROPS, report.crop)) return null;
    return { report: checked, cropName: AREA_CROPS[report.crop] };
  }
  return null;
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const bn = (value: number): string => String(Math.trunc(value)).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/**
 * The notification for an area that has just reached 3 farmers. Built only from
 * catalog names and counts, so nothing a farmer typed can reach another phone.
 */
export const areaWarningMessage = (validated: ValidatedReport, farmers: number): PushMessage => {
  const { report, cropName, disease } = validated;
  const count = Math.max(0, Math.min(Math.trunc(farmers) || 0, 9999));
  const diseaseBn = disease?.bn ?? 'একই সমস্যা';
  const diseaseEn = disease?.en ?? 'the same problem';
  return {
    titleBn: 'আপনার এলাকায় ফসলের সতর্কতা',
    titleEn: 'Crop warning in your area',
    bodyBn: `আপনার এলাকায় গত ${bn(AREA_WINDOW_DAYS)} দিনে ${bn(count)} জন কৃষক ${cropName.bn} ফসলে ${diseaseBn} জানিয়েছেন।`,
    bodyEn: `Your area: ${count} farmers reported ${diseaseEn} on ${cropName.en} in the last ${AREA_WINDOW_DAYS} days.`,
    url: '/#community-radar',
    tag: `area-${report.groupKey}`.slice(0, 120),
  };
};

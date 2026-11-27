/**
 * Words for an area warning. Pure: no React, no network, so it is easy to test.
 *
 * An area warning comes from the server as slugs (`paddy`, `paddy_rice_blast`)
 * because the server stores only lower-case letters and underscores. These
 * helpers turn the slugs back into names a farmer can read, and build the one
 * sentence the Home strip, the radar list and the Listen button all share.
 */

import { AREA_WINDOW_DAYS } from '../../netlify/functions/_shared/area-model';
import toBn from './banglaNum';

type Lang = 'bn' | 'en';

const CROP_NAMES: Record<string, { bn: string; en: string }> = {
  tomato: { bn: 'টমেটো', en: 'tomato' },
  brinjal: { bn: 'বেগুন', en: 'brinjal' },
  paddy: { bn: 'ধান', en: 'paddy' },
  chili: { bn: 'মরিচ', en: 'chili' },
  watermelon: { bn: 'তরমুজ', en: 'watermelon' },
  potato: { bn: 'আলু', en: 'potato' },
  onion: { bn: 'পেঁয়াজ', en: 'onion' },
  cucumber: { bn: 'শসা', en: 'cucumber' },
  betel_leaf: { bn: 'পান পাতা', en: 'betel leaf' },
  wheat: { bn: 'গম', en: 'wheat' },
  maize: { bn: 'ভুট্টা', en: 'maize' },
  jute: { bn: 'পাট', en: 'jute' },
  sugarcane: { bn: 'আখ', en: 'sugarcane' },
  tea: { bn: 'চা', en: 'tea' },
  pulse: { bn: 'ডাল', en: 'pulse' },
  mustard: { bn: 'সরিষা', en: 'mustard' },
};

/** A crop slug as a readable name. Unknown crops keep their own words. */
export const cropNameFromSlug = (crop: string, lang: Lang): string => {
  const known = CROP_NAMES[crop];
  if (known) return known[lang];
  return crop.replace(/_/g, ' ').trim() || (lang === 'bn' ? 'ফসল' : 'crop');
};

/**
 * Every disease key (`paddy:rice-blast`) a server slug (`paddy_rice_blast`) could stand for.
 * The crop id may itself hold a hyphen (`betel-leaf`), so each split point is tried.
 */
export const diseaseKeyCandidates = (slug: string): string[] => {
  const parts = slug.split('_').filter(Boolean);
  const keys: string[] = [];
  for (let i = 1; i < parts.length; i += 1) {
    keys.push(`${parts.slice(0, i).join('-')}:${parts.slice(i).join('-')}`);
  }
  return keys;
};

/**
 * The disease name for a server slug, or null when it is not in the knowledge base.
 * `labelForKey` is `diseaseLabelForKey`; it is passed in so this file stays free of
 * the large disease data (the screens load that on demand).
 */
export const diseaseNameFromSlug = (
  slug: string,
  lang: Lang,
  labelForKey: (key: string, lang: Lang) => string | null
): string | null => {
  for (const key of diseaseKeyCandidates(slug)) {
    const label = labelForKey(key, lang);
    if (label) return label;
  }
  return null;
};

export interface WarningWords {
  farmers: number;
  /** Crop slug from the warning. */
  crop: string;
  /** Readable disease name, or null when it could not be named. */
  disease: string | null;
}

/** "3 farmers near you reported Rice blast on paddy in the last 14 days." */
export const warningSentence = ({ farmers, crop, disease }: WarningWords, lang: Lang): string => {
  const cropName = cropNameFromSlug(crop, lang);
  if (lang === 'bn') {
    const what = disease ? `${cropName} ফসলে ${disease}` : `${cropName} ফসলে একই সমস্যা`;
    return `আপনার কাছের ${toBn(farmers)} জন কৃষক গত ${toBn(AREA_WINDOW_DAYS)} দিনে ${what} হয়েছে বলে জানিয়েছেন।`;
  }
  const what = disease ? `${disease} on ${cropName}` : `the same problem on ${cropName}`;
  return `${farmers} farmers near you reported ${what} in the last ${AREA_WINDOW_DAYS} days.`;
};

/** The short line that says this is farmers' own word, not a confirmed fact. */
export const notConfirmedNote = (lang: Lang): string =>
  lang === 'bn' ? 'এটি কৃষকদের নিজের জানানো তথ্য, নিশ্চিত নয়।' : 'These are farmer reports, not confirmed.';

/** The sentence plus the not-confirmed note, for the Listen button. */
export const warningSpeech = (words: WarningWords, lang: Lang): string =>
  `${warningSentence(words, lang)} ${notConfirmedNote(lang)}`;

/** 'YYYY-MM-DD' as a short day for the radar list ("28 Nov" / "২৮ নভেম্বর"). */
export const shortDay = (day: string, lang: Lang): string => {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return '';
  const month = Number(match[1]);
  const date = Number(match[2]);
  const bnMonths = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (month < 1 || month > 12) return '';
  return lang === 'bn' ? `${toBn(date)} ${bnMonths[month - 1]}` : `${date} ${enMonths[month - 1]}`;
};

/** The admin message in the farmer's language, falling back to the other one. */
export const broadcastMessage = (item: { messageBn?: string; messageEn?: string }, lang: Lang): string => {
  const first = lang === 'bn' ? item.messageBn : item.messageEn;
  const second = lang === 'bn' ? item.messageEn : item.messageBn;
  return (first || '').trim() || (second || '').trim();
};

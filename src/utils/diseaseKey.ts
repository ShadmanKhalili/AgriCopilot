/**
 * Stable disease keys for saved diagnoses.
 *
 * A key looks like `paddy:rice-blast` (`<cropId>:<disease-slug>`), built from
 * the curated knowledge base so the same disease always gets the same key,
 * whichever language the AI answered in. Pure: no Firebase, no React.
 */

import { CROP_KNOWLEDGE, type KbDisease } from '../data/diseaseKb';

const MAX_KEY_LENGTH = 80;

/** Bangla names for the KB crops (mirrors `translations.bn.crops`). */
const CROP_NAMES_BN: Record<string, string> = {
  tomato: 'টমেটো',
  brinjal: 'বেগুন',
  paddy: 'ধান',
  chili: 'মরিচ',
  watermelon: 'তরমুজ',
  potato: 'আলু',
  onion: 'পেঁয়াজ',
  cucumber: 'শসা',
  'betel-leaf': 'পান পাতা',
  wheat: 'গম',
  maize: 'ভুট্টা',
  jute: 'পাট',
  sugarcane: 'আখ',
  tea: 'চা',
  pulse: 'ডাল',
  mustard: 'সরিষা',
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface Entry {
  key: string;
  cropId: string;
  disease: KbDisease;
}

const ENTRIES: Entry[] = [];
for (const [cropName, knowledge] of Object.entries(CROP_KNOWLEDGE)) {
  const cropId = slugify(cropName);
  for (const disease of knowledge.diseases) {
    const slug = slugify(disease.disease);
    if (!cropId || !slug) continue;
    ENTRIES.push({ key: `${cropId}:${slug}`.slice(0, MAX_KEY_LENGTH), cropId, disease });
  }
}

const ENTRY_BY_KEY = new Map(ENTRIES.map((e) => [e.key, e]));

const isBangla = (ch: string): boolean => /[ঀ-৿]/.test(ch);
const isAsciiWord = (ch: string): boolean => /[a-z0-9]/i.test(ch);

/** Normalise whitespace so a name still matches across line breaks / double spaces. */
const normalise = (s: string): string => s.normalize('NFC').replace(/\s+/g, ' ');

interface Hit {
  entry: Entry;
  start: number;
  end: number;
}

/** First whole-name occurrence of `name` in the text (English: case-insensitive). */
function findName(text: string, lowerText: string, name: string, bangla: boolean): [number, number] | null {
  const needle = normalise(name);
  if (needle.length < 3) return null;
  const hay = bangla ? text : lowerText;
  const target = bangla ? needle : needle.toLowerCase();
  let from = 0;
  while (from <= hay.length - target.length) {
    const idx = hay.indexOf(target, from);
    if (idx < 0) return null;
    const end = idx + target.length;
    const before = idx > 0 ? hay[idx - 1] : '';
    const after = end < hay.length ? hay[end] : '';
    const ok = bangla
      ? !(before && isBangla(before)) && !(after && isBangla(after))
      : !(before && isAsciiWord(before)) && !(after && isAsciiWord(after));
    if (ok) return [idx, end];
    from = idx + 1;
  }
  return null;
}

function resolveCropId(crop?: string | null): string | null {
  const raw = (crop ?? '').normalize('NFC').trim().toLowerCase();
  if (!raw || raw === 'auto') return null;
  const slug = slugify(raw);
  for (const e of ENTRIES) if (e.cropId === slug) return e.cropId;
  // camelCase ids such as "betelLeaf"
  const camel = slugify((crop ?? '').trim().replace(/([a-z])([A-Z])/g, '$1 $2'));
  for (const e of ENTRIES) if (e.cropId === camel) return e.cropId;
  for (const [id, bn] of Object.entries(CROP_NAMES_BN)) if (bn === raw) return id;
  return null;
}

function collectHits(text: string, entries: Entry[]): Hit[] {
  const clean = normalise(text);
  const lower = clean.toLowerCase();
  const hits: Hit[] = [];
  for (const entry of entries) {
    const spans = [
      findName(clean, lower, entry.disease.disease, false),
      findName(clean, lower, entry.disease.diseaseBn, true),
    ].filter((s): s is [number, number] => s !== null);
    if (spans.length === 0) continue;
    const [start, end] = spans.reduce((a, b) => (b[0] < a[0] ? b : a));
    hits.push({ entry, start, end });
  }
  // Drop names that sit inside a longer matched name ("Rust" inside "White rust").
  return hits.filter(
    (h) =>
      !hits.some(
        (o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start,
      ),
  );
}

function pickEarliest(hits: Hit[]): string | null {
  if (hits.length === 0) return null;
  const first = Math.min(...hits.map((h) => h.start));
  const top = hits.filter((h) => h.start === first);
  const keys = new Set(top.map((h) => h.entry.key));
  if (keys.size === 1) return top[0].entry.key;
  // Same name at the same spot in several crops (e.g. "Early blight"): do not guess.
  return null;
}

/** Standard disease key for a diagnosis text, or null when no KB disease is named. */
export function diseaseKeyFor(input: { crop?: string | null; text: string }): string | null {
  const text = input.text ?? '';
  if (!text.trim()) return null;
  const cropId = resolveCropId(input.crop);
  if (cropId) {
    const key = pickEarliest(collectHits(text, ENTRIES.filter((e) => e.cropId === cropId)));
    if (key) return key;
  }
  return pickEarliest(collectHits(text, ENTRIES));
}

/** Display name for a key produced by `diseaseKeyFor`, or null when unknown. */
export function diseaseLabelForKey(key: string, lang: 'bn' | 'en'): string | null {
  const entry = ENTRY_BY_KEY.get(key);
  if (!entry) return null;
  return lang === 'bn' ? entry.disease.diseaseBn : entry.disease.disease;
}

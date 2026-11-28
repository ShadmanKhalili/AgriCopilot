/**
 * Turn a spoken (or typed) amount into taka.
 *
 * Handles plain and Bangla digits ("৫০০", "2.5 হাজার"), Bangla number words
 * with their hundred/thousand/lakh/crore multipliers ("পাঁচ শ", "দুই হাজার
 * পাঁচশ", "পাঁচ লাখ"), the half forms ("দেড় হাজার", "আড়াই হাজার", "সাড়ে তিন
 * হাজার") and the same in English ("two thousand five hundred").
 *
 * A wrong amount in a farmer's money record is worse than no amount, so when
 * a word that is clearly a quantity is not understood (সোয়া, পৌনে, million,
 * a half with nothing after it, two bare numbers in a row), the answer is
 * `null` and the farmer is asked to say it again. Ordinary words that are not
 * quantities ("টাকা", "taka") are ignored.
 */

/** Same letter, one spelling: speech engines and keyboards differ on য়, ড় and ঊ. */
const norm = (s: string): string => s.normalize('NFC').replace(/ঊ/g, 'উ');

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

const NUMBER_WORDS: Record<string, number> = {};
const addWords = (value: number, names: string) => {
  for (const name of names.split(' ')) NUMBER_WORDS[norm(name)] = value;
};

// Bangla 0-99. Every number below a hundred has its own word.
const BN_NUMBERS: Array<[number, string]> = [
  [0, 'শূন্য'], [1, 'এক'], [2, 'দুই দু'], [3, 'তিন'], [4, 'চার'], [5, 'পাঁচ পাচ'], [6, 'ছয়'], [7, 'সাত'],
  [8, 'আট'], [9, 'নয়'], [10, 'দশ'], [11, 'এগারো এগার'], [12, 'বারো বার'], [13, 'তেরো তের'],
  [14, 'চৌদ্দ'], [15, 'পনেরো পনের'], [16, 'ষোলো ষোল'], [17, 'সতেরো সতের'], [18, 'আঠারো আঠার'],
  [19, 'উনিশ ঊনিশ'], [20, 'বিশ'], [21, 'একুশ'], [22, 'বাইশ'], [23, 'তেইশ'], [24, 'চব্বিশ'],
  [25, 'পঁচিশ পচিশ'], [26, 'ছাব্বিশ'], [27, 'সাতাশ'], [28, 'আঠাশ'], [29, 'ঊনত্রিশ'], [30, 'ত্রিশ'],
  [31, 'একত্রিশ'], [32, 'বত্রিশ'], [33, 'তেত্রিশ'], [34, 'চৌত্রিশ'], [35, 'পঁয়ত্রিশ'], [36, 'ছত্রিশ'],
  [37, 'সাঁইত্রিশ'], [38, 'আটত্রিশ'], [39, 'ঊনচল্লিশ'], [40, 'চল্লিশ'], [41, 'একচল্লিশ'],
  [42, 'বিয়াল্লিশ'], [43, 'তেতাল্লিশ'], [44, 'চুয়াল্লিশ'], [45, 'পঁয়তাল্লিশ'], [46, 'ছেচল্লিশ'],
  [47, 'সাতচল্লিশ'], [48, 'আটচল্লিশ'], [49, 'ঊনপঞ্চাশ'], [50, 'পঞ্চাশ'], [51, 'একান্ন'],
  [52, 'বায়ান্ন'], [53, 'তিপ্পান্ন'], [54, 'চুয়ান্ন'], [55, 'পঞ্চান্ন'], [56, 'ছাপ্পান্ন'],
  [57, 'সাতান্ন'], [58, 'আটান্ন'], [59, 'ঊনষাট'], [60, 'ষাট'], [61, 'একষট্টি'], [62, 'বাষট্টি'],
  [63, 'তেষট্টি'], [64, 'চৌষট্টি'], [65, 'পঁয়ষট্টি'], [66, 'ছেষট্টি'], [67, 'সাতষট্টি'],
  [68, 'আটষট্টি'], [69, 'ঊনসত্তর'], [70, 'সত্তর'], [71, 'একাত্তর'], [72, 'বাহাত্তর'],
  [73, 'তিয়াত্তর'], [74, 'চুয়াত্তর'], [75, 'পঁচাত্তর'], [76, 'ছিয়াত্তর'], [77, 'সাতাত্তর'],
  [78, 'আটাত্তর'], [79, 'ঊনআশি'], [80, 'আশি'], [81, 'একাশি'], [82, 'বিরাশি'], [83, 'তিরাশি'],
  [84, 'চুরাশি'], [85, 'পঁচাশি'], [86, 'ছিয়াশি'], [87, 'সাতাশি'], [88, 'অষ্টাশি'],
  [89, 'ঊননব্বই'], [90, 'নব্বই'], [91, 'একানব্বই'], [92, 'বিরানব্বই'], [93, 'তিরানব্বই'],
  [94, 'চুরানব্বই'], [95, 'পঁচানব্বই'], [96, 'ছিয়ানব্বই'], [97, 'সাতানব্বই'], [98, 'আটানব্বই'],
  [99, 'নিরানব্বই'],
  // Whole fractions that stand in for a number.
  [1.5, 'দেড়'], [2.5, 'আড়াই'],
];
for (const [value, names] of BN_NUMBERS) addWords(value, names);

const EN_NUMBERS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
EN_NUMBERS.forEach((name, value) => addWords(value, name));
[[20, 'twenty'], [30, 'thirty'], [40, 'forty'], [50, 'fifty'], [60, 'sixty'], [70, 'seventy'], [80, 'eighty'], [90, 'ninety']].forEach(
  ([value, name]) => addWords(value as number, name as string)
);

/** The multiplier words: শ/শত/শো, হাজার, লাখ/লক্ষ, কোটি, and English. */
const UNITS: Record<string, number> = {};
const addUnits = (value: number, names: string) => {
  for (const name of names.split(' ')) UNITS[norm(name)] = value;
};
addUnits(100, 'শ শত শো hundred');
addUnits(1000, 'হাজার thousand k');
addUnits(100000, 'লাখ লক্ষ lakh lakhs lac lacs');
addUnits(10000000, 'কোটি crore crores');

/** Spelled-out units glued to a number word, longest first ("পাঁচহাজার", "দুইশ"). */
const UNIT_SUFFIXES = Object.keys(UNITS)
  .filter((u) => /[^\x00-\x7f]/.test(u))
  .sort((a, b) => b.length - a.length);

/** Quantity words that are not handled: better to ask again than to guess. */
const UNSUPPORTED = new Set(
  ['সোয়া', 'পৌনে', 'পোনে', 'অযুত', 'নিযুত', 'মিলিয়ন', 'বিলিয়ন', 'half', 'quarter', 'million', 'billion'].map(norm)
);
const LOOKS_LIKE_UNIT = /(হাজার|লাখ|লক্ষ|কোটি|শো|শত|hundred|thousand|lakh|lac|crore)/;

const NUMERIC = /^\d+(?:\.\d+)?$/;

export const parseSpokenAmount = (raw: string): number | null => {
  const text = norm(String(raw || ''))
    .toLowerCase()
    .replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
    .replace(/(\d),(?=\d)/g, '$1') // 5,000 and 1,00,000
    .replace(/৳|[,।;:!?]/g, ' ')
    .replace(/-/g, ' ');

  let total = 0;
  let current = 0;
  let found = false;
  let half = false; // "সাড়ে" seen: the next number gets +0.5
  let lastWasDigits = false;

  const addNumber = (value: number, digits: boolean): boolean => {
    // Two bare digit groups in a row ("500 200", "5-6") are not one amount.
    if (digits && lastWasDigits) return false;
    current += value + (half ? 0.5 : 0);
    half = false;
    found = true;
    lastWasDigits = digits;
    return true;
  };

  const applyUnit = (unit: number): boolean => {
    if (half) return false; // "সাড়ে হাজার" means nothing
    lastWasDigits = false;
    found = true;
    if (unit === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else {
      total += (current === 0 ? 1 : current) * unit;
      current = 0;
    }
    return true;
  };

  for (const rawToken of text.split(/\s+/)) {
    const tok = rawToken.replace(/^\.+|\.+$/g, '');
    if (!tok) continue;

    if (tok === 'সাড়ে') {
      if (half) return null;
      half = true;
      continue;
    }
    if (NUMERIC.test(tok)) {
      if (!addNumber(parseFloat(tok), true)) return null;
      continue;
    }
    if (tok in NUMBER_WORDS) {
      if (!addNumber(NUMBER_WORDS[tok], false)) return null;
      continue;
    }
    if (tok in UNITS) {
      if (!applyUnit(UNITS[tok])) return null;
      continue;
    }

    // "৫শ", "5k", "২.৫হাজার": digits with a unit attached.
    const digitsUnit = tok.match(/^(\d+(?:\.\d+)?)([^\d.]+)$/);
    if (digitsUnit && digitsUnit[2] in UNITS) {
      if (!addNumber(parseFloat(digitsUnit[1]), true) || !applyUnit(UNITS[digitsUnit[2]])) return null;
      continue;
    }

    // "পাঁচশ", "দেড়শ", "পাঁচহাজার": a number word with a unit attached.
    const suffix = UNIT_SUFFIXES.find((u) => tok.endsWith(u) && tok.length > u.length && tok.slice(0, -u.length) in NUMBER_WORDS);
    if (suffix) {
      if (!addNumber(NUMBER_WORDS[tok.slice(0, -suffix.length)], false) || !applyUnit(UNITS[suffix])) return null;
      continue;
    }

    if (UNSUPPORTED.has(tok) || LOOKS_LIKE_UNIT.test(tok)) return null;
    // Anything else ("টাকা", "taka", "only") carries no amount.
  }

  if (!found || half) return null;
  return Math.round(total + current);
};

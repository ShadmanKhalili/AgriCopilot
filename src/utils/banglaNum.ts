/**
 * Bangla numeral formatter — converts Arabic digits (0-9) to Bangla digits (০-৯).
 * The app is Bangla-first: prices, times, rates and counts should read in
 * Bangla numerals for low-literacy users who never learned Arabic digits in school.
 */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const toBn = (value: string | number): string =>
  String(value).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);

export default toBn;

import { describe, expect, it } from 'vitest';
import { parseSpokenAmount } from './parseSpokenAmount';

const cases: Array<[string, number | null]> = [
  // Plain and Bangla digits
  ['500', 500],
  ['৫০০', 500],
  ['৫০০ টাকা', 500],
  ['৳৫০০', 500],
  ['5,000', 5000],
  ['৫,০০০', 5000],
  ['1,00,000', 100000],
  ['২.৫ হাজার', 2500],
  ['2.5 হাজার', 2500],
  ['0.5 লাখ', 50000],
  ['500।', 500],
  // The reported bugs: hundred as a multiplier
  ['পাঁচ শ', 500],
  ['৫ শ', 500],
  ['5 শ', 500],
  ['পাঁচ শত', 500],
  ['পাঁচ শো', 500],
  ['পাঁচশ', 500],
  ['পাঁচশো', 500],
  ['পাঁচশত', 500],
  ['৫শ', 500],
  ['একশ', 100],
  ['একশো', 100],
  ['শ', 100],
  ['একশ পাঁচ', 105],
  ['দুইশ পঞ্চাশ', 250],
  ['তিন শ পঞ্চাশ টাকা', 350],
  // Thousands, lakhs, crores
  ['এক হাজার', 1000],
  ['হাজার', 1000],
  ['পাঁচ হাজার', 5000],
  ['পাঁচহাজার', 5000],
  ['৫ হাজার', 5000],
  ['5k', 5000],
  ['দশ হাজার', 10000],
  ['পঁচিশ হাজার', 25000],
  ['পাঁচ লাখ', 500000],
  ['৫ লাখ', 500000],
  ['পাঁচ লক্ষ', 500000],
  ['এক লাখ পঁচিশ হাজার', 125000],
  ['দুই লাখ পঞ্চাশ হাজার', 250000],
  ['দুই কোটি', 20000000],
  // Compounds
  ['দুই হাজার পাঁচশ', 2500],
  ['দুই হাজার পাঁচ শ', 2500],
  ['এক হাজার দুই শ পঞ্চাশ', 1250],
  ['তিন হাজার ৫০০', 3500],
  ['পাঁচ হাজার দশ', 5010],
  ['দুই হাজার পাঁচশ টাকা', 2500],
  // Half forms
  ['দেড় হাজার', 1500],
  ['দেড়শ', 150],
  ['দেড় শ', 150],
  ['আড়াই হাজার', 2500],
  ['আড়াইশ', 250],
  ['সাড়ে তিন হাজার', 3500],
  ['সাড়ে তিনশ', 350],
  ['সাড়ে ৩ হাজার', 3500],
  ['সাড়ে পাঁচ শ', 550],
  ['সাড়ে এক লাখ', 150000],
  // Spelling variants (য়, ড়, ঊ)
  ['ছয় শ', 600],
  ['নয় হাজার', 9000],
  ['ঊনিশ', 19],
  ['উনিশ', 19],
  // English
  ['five hundred', 500],
  ['two thousand five hundred', 2500],
  ['twenty five', 25],
  ['twenty-five hundred', 2500],
  ['one lakh', 100000],
  ['3 lakh', 300000],
  ['2.5 thousand', 2500],
  ['a hundred', 100],
  ['500 taka', 500],
  ['Five Hundred', 500],
  // Not understood: no wrong number
  ['', null],
  ['টাকা', null],
  ['hello', null],
  ['সোয়া হাজার', null],
  ['পৌনে দুই হাজার', null],
  ['দুই মিলিয়ন', null],
  ['two million', null],
  ['পাঁচ শতাংশ', null],
  ['সাড়ে', null],
  ['সাড়ে হাজার', null],
  ['500 200', null],
  ['৫-৬ হাজার', null],
];

describe('parseSpokenAmount', () => {
  it.each(cases)('%j -> %j', (spoken, expected) => {
    expect(parseSpokenAmount(spoken)).toBe(expected);
  });

  it('does not throw on odd input', () => {
    expect(parseSpokenAmount(undefined as unknown as string)).toBeNull();
    expect(parseSpokenAmount(null as unknown as string)).toBeNull();
  });
});

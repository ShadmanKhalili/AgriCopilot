import { Language } from './translations';

/**
 * A message a farmer can act on when an AI request fails.
 *
 * The AI proxy's error text is written for logs, in English, and used to be
 * shown as is on Bangla screens.
 */
export const aiErrorMessage = (error: unknown, lang: Language): string => {
  const raw = String((error as { message?: unknown })?.message ?? error ?? '');
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isOffline) {
    return lang === 'bn'
      ? 'ইন্টারনেট সংযোগ নেই। সংযোগ পেলে আবার চেষ্টা করুন।'
      : 'No internet connection. Please try again once you are online.';
  }
  if (/sign in|session has expired/i.test(raw)) {
    return lang === 'bn'
      ? 'আপনার সেশন শেষ হয়েছে। আবার সাইন ইন করে চেষ্টা করুন।'
      : 'Your session has expired. Please sign in and try again.';
  }
  if (/too large/i.test(raw)) {
    return lang === 'bn'
      ? 'ছবিগুলোর আকার অনেক বড়। কম ছবি দিয়ে আবার চেষ্টা করুন।'
      : 'Those photos are too large. Please try again with fewer photos.';
  }
  return lang === 'bn'
    ? 'এআই থেকে উত্তর পাওয়া যায়নি। একটু পরে আবার চেষ্টা করুন। জরুরি হলে কৃষি কল সেন্টারে ১৬১২৩ নম্বরে ফোন করুন।'
    : 'The AI could not answer just now. Please try again shortly. If urgent, call the Krishi Call Centre on 16123.';
};

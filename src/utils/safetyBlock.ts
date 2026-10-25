/**
 * The safety-block code the AI proxy answers with.
 *
 * When the upstream refuses a request, the proxy sends a coded refusal
 * instead of a generic failure, so the app can say something honest and
 * useful instead of "Error connecting to AI service". The code travels with
 * the error through the NDJSON stream reader and the JSON error path, and the
 * UI turns it into a localised message.
 */
export const SAFETY_BLOCK_CODE = 'SAFETY_BLOCK';

/** True when the error is a safety refusal rather than a broken service. */
export const isSafetyBlockError = (error: any): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  return code.toUpperCase() === SAFETY_BLOCK_CODE;
};

/**
 * The message a farmer sees when their request was refused.
 *
 * It is deliberately vague about *which* filter tripped — naming the
 * category would turn the message into a probe for finding a bypass. What it
 * does say is what to do next.
 */
export const safetyBlockMessage = (lang: 'bn' | 'en'): string =>
  lang === 'bn'
    ? 'নিরাপত্তা নীতির কারণে আমরা এই অনুরোধে সাহায্য করতে পারছি না। ফসলের সমস্যা জানতে চাইলে আক্রান্ত পাতা, ফল বা কাণ্ডের স্পষ্ট ছবি দিন।'
    : 'We cannot help with that request because of our safety policy. If you are asking about a crop problem, please share a clear photo of the affected leaf, fruit or stem.';

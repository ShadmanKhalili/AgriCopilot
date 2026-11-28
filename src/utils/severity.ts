/**
 * Severity text, shared by the prescription card and the saved diagnosis record.
 *
 * Kept in its own file so `diagnosisTypes.ts` and `prescriptionData.ts` (which
 * imports from it) can both use it without importing each other.
 */

/**
 * What severity holds when the model did not state one. It used to default
 * to 'Medium', which printed an invented severity on an official-looking card.
 */
export const SEVERITY_NOT_ASSESSED = 'Not Assessed';

/** Severity text that means "no real severity was given". */
const SEVERITY_MISSING = /^(|unknown|n\/?a|none|null|undefined|-|—|not\s*assessed|জানা\s*নেই|যাচাই\s*করা\s*হয়নি)$/i;

/** A real severity string, or SEVERITY_NOT_ASSESSED. Never invents one. */
export const normalizeSeverity = (...values: unknown[]): string => {
  for (const value of values) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (text && !SEVERITY_MISSING.test(text) && !/not\s*assessed/i.test(text)) return text;
  }
  return SEVERITY_NOT_ASSESSED;
};

/** True when no real severity is known (missing, 'Not Assessed' or the Bangla equivalent). */
export const isSeverityUnknown = (severity: unknown): boolean =>
  normalizeSeverity(severity) === SEVERITY_NOT_ASSESSED;

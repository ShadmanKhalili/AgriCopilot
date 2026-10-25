/**
 * Shared types and helpers for the diagnosis result.
 *
 * TWO CHANGES ARE ENCODED HERE
 * ----------------------------
 * 1. `possibleDiseases` used to be a flat array of strings with no scores and
 *    no minimum length. The model could return one guess with no way to show
 *    that it was guessing. It is now an array of scored candidates, which is
 *    what the ChatLeafDisease evidence says matters most: removing the
 *    scoring rules from their pipeline dropped accuracy from 90.3% to 51.8%.
 *
 * 2. Diagnoses written to Firestore before that change still hold the old
 *    string shape, so every read has to go through the normaliser below
 *    rather than assuming one shape.
 */

export interface DiseaseCandidate {
  disease: string;
  /** Rubric match score 0-100 for this candidate, or null if the model did not give one. */
  score: number | null;
  /** What in the image supports this candidate. */
  evidence: string;
  /** What distinguishes this candidate from its rivals. */
  differentiators: string;
}

/** A diagnosis image: the full frame plus an optional auto-cropped detail view. */
export interface DiagnosisImage {
  base64: string;
  mimeType: string;
  /** Base64 of an automatically cropped high-detail region of the same photo. */
  focusCropBase64?: string;
}

const clampScore = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
};

/**
 * Read `possibleDiseases` in either shape: the new scored-candidate array, or
 * the old flat string array that is still sitting in Firestore.
 */
export const normalizeDiseaseCandidates = (raw: unknown): DiseaseCandidate[] => {
  if (!Array.isArray(raw)) return [];
  const out: DiseaseCandidate[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const disease = entry.trim();
      if (disease) out.push({ disease, score: null, evidence: '', differentiators: '' });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const disease = String(obj.disease ?? obj.name ?? obj.condition ?? '').trim();
    if (!disease) continue;
    out.push({
      disease,
      score: clampScore(obj.score ?? obj.match ?? obj.confidence),
      evidence: String(obj.evidence ?? '').trim(),
      differentiators: String(obj.differentiators ?? obj.differentiator ?? '').trim(),
    });
  }
  return out;
};

export interface ConfidenceSignal {
  /** 0-100. Higher means the top candidate is more likely to be right. */
  score: number;
  /** Where the number came from — useful for explaining it to the farmer. */
  basis: 'candidate-gap' | 'reported' | 'unknown';
}

/**
 * Work out how confident we should be that the top candidate is the right
 * one.
 *
 * The model's own `confidence` number is not trustworthy: measured
 * calibration error for LLMs on this kind of task runs 0.12-0.40, and the
 * model is still wrong 20-30% of the time on the cases where it claims
 * >90%. It also had a code path that turned a *missing* confidence into 95.
 *
 * So the primary signal is the gap between the best and second-best scored
 * candidate: a 30-point margin means the picture genuinely discriminated
 * between them, while a 2-point margin means the model was guessing. The
 * self-reported number is only used when there are no scored candidates at
 * all, and "unknown" is a real, distinct outcome that must escalate.
 */
export const confidenceSignal = (
  candidates: DiseaseCandidate[],
  reported: unknown
): ConfidenceSignal => {
  const scored = candidates
    .filter((c) => c.score !== null)
    .sort((a, b) => (b.score as number) - (a.score as number));

  if (scored.length >= 2) {
    const top = scored[0].score as number;
    const gap = top - (scored[1].score as number);
    // A 30-point margin is treated as full certainty that the ranking is
    // right; below that the ranking itself is uncertain.
    const certainty = Math.min(1, gap / 30);
    const signal = Math.round(top * (0.5 + 0.5 * certainty));
    return { score: Math.max(0, Math.min(100, signal)), basis: 'candidate-gap' };
  }

  if (scored.length === 1) {
    // One candidate only — there is no ranking to be confident about.
    const top = scored[0].score as number;
    return { score: Math.max(0, Math.min(100, Math.round(top * 0.75))), basis: 'candidate-gap' };
  }

  const reportedScore = clampScore(reported);
  if (reportedScore !== null) {
    return { score: reportedScore, basis: 'reported' };
  }
  return { score: 0, basis: 'unknown' };
};

/** Below this the answer must be escalated to a human agronomist. */
export const ESCALATION_THRESHOLD = 70;

/**
 * Convenience wrapper: read the confidence signal straight off a diagnosis
 * object, whatever shape its `possibleDiseases` happens to be in.
 */
export const diagnosisConfidence = (diagnosis: any): ConfidenceSignal =>
  confidenceSignal(
    normalizeDiseaseCandidates(diagnosis?.possibleDiseases),
    diagnosis?.confidence
  );

/**
 * A display string for a confidence value. An unknown confidence shows as a
 * dash rather than as a high number — a missing value must never look like
 * certainty.
 */
export const confidenceLabel = (diagnosis: any): string => {
  const signal = diagnosisConfidence(diagnosis);
  return signal.basis === 'unknown' ? '—' : `${signal.score}%`;
};

/**
 * The numeric form, for places that store a number. null means "not
 * established" — never a high stand-in.
 */
export const confidenceValue = (diagnosis: any): number | null => {
  const signal = diagnosisConfidence(diagnosis);
  return signal.basis === 'unknown' ? null : signal.score;
};

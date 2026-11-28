/**
 * Plain-text summary of a crop-doctor result, sent to the assistant as the
 * `attachment` of a follow-up question (see docs/PHASE9_ASSISTANT_SPEC.md).
 *
 * Pure: no React, no network. The assistant server is stateless, so every
 * follow-up carries this summary again. It lists only what the screen already
 * shows (crop, ranked causes with their scores, symptoms, treatment, notes), so
 * the assistant can explain the result but never has a different one.
 */
import { diagnosisConfidence, normalizeDiseaseCandidates } from '../utils/diagnosisTypes';

/** The server accepts at most this many characters of summary. */
export const DIAGNOSIS_SUMMARY_MAX = 3000;

/** Past follow-up turns sent along with a new question. */
export const FOLLOW_UP_HISTORY_TURNS = 12;
const HISTORY_TEXT_MAX = 4000;

export interface DiagnosisSummaryInput {
  diagnosis: any;
  deepDiagnosis?: any;
  crop?: string;
  cropStage?: string;
  lang: 'bn' | 'en';
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

/** Markdown marks add nothing for a model and cost characters. */
const stripMarks = (text: string): string => text.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();

export function buildDiagnosisSummary(input: DiagnosisSummaryInput): string {
  const { diagnosis, deepDiagnosis, crop, cropStage } = input;
  if (!diagnosis || typeof diagnosis !== 'object') return '';
  const deep = deepDiagnosis && typeof deepDiagnosis === 'object' ? deepDiagnosis : {};
  const lines: string[] = [];

  const cropLine = [clean(crop), clean(cropStage) ? `stage: ${clean(cropStage)}` : ''].filter(Boolean).join(', ');
  if (cropLine) lines.push(`Crop: ${cropLine}`);

  // Ranked causes, best first. Old records and sample cases have no scored
  // candidates, so fall back to the single disease name.
  const candidates = normalizeDiseaseCandidates(diagnosis.possibleDiseases)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 3);
  if (candidates.length > 0) {
    lines.push('Possible causes (best first):');
    candidates.forEach((c, i) => {
      const score = c.score === null ? '' : ` (${Math.round(c.score)}% match)`;
      const why = clean(c.evidence) ? ` - ${clip(clean(c.evidence), 160)}` : '';
      lines.push(`${i + 1}. ${clip(c.disease, 120)}${score}${why}`);
    });
  } else {
    const name = clean(diagnosis.disease) || clean(diagnosis.diseaseBn);
    if (name) lines.push(`Diagnosis: ${clip(name, 160)}`);
  }

  const signal = diagnosisConfidence(diagnosis);
  if (signal.basis !== 'unknown') lines.push(`Overall confidence: ${signal.score}%`);
  const severity = clean(diagnosis.qualitativeSeverity) || clean(diagnosis.severity);
  if (severity) lines.push(`Severity: ${clip(severity, 40)}`);

  const symptoms = Array.isArray(diagnosis.symptomsBreakdown)
    ? diagnosis.symptomsBreakdown.map(clean).filter(Boolean).slice(0, 6)
    : clean(diagnosis.visibleSymptoms)
      ? [clean(diagnosis.visibleSymptoms)]
      : [];
  if (symptoms.length > 0) lines.push(`Symptoms: ${clip(symptoms.join('; '), 500)}`);

  const detail = stripMarks(clean(diagnosis.diagnosis));
  if (detail) lines.push(`Diagnosis text: ${clip(detail, 600)}`);
  if (clean(diagnosis.cause)) lines.push(`Cause: ${clip(clean(diagnosis.cause), 200)}`);

  // Steps / treatment as shown. Each field is only present if the screen has it.
  const steps: [string, unknown][] = [
    ['Check first', diagnosis.verificationAdvice],
    ['Organic', diagnosis.organicRemedy],
    ['Chemical', diagnosis.chemicalRemedy],
    ['Detailed treatment', deep.advancedTreatment],
    ['Recovery', deep.recoveryTimeline],
  ];
  for (const [label, value] of steps) {
    const text = stripMarks(clean(value));
    if (text) lines.push(`${label}: ${clip(text, 450)}`);
  }

  const notes: [string, unknown][] = [
    ['Other possibilities', diagnosis.differentialDiagnosis ?? deep.differentialReasoning],
    ['Field conditions', deep.environmentalContext],
    ['Biological cause', deep.biologicalCause],
  ];
  for (const [label, value] of notes) {
    const text = stripMarks(clean(value));
    if (text) lines.push(`${label}: ${clip(text, 300)}`);
  }

  return clip(lines.join('\n'), DIAGNOSIS_SUMMARY_MAX);
}

export interface FollowUpTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * The prior turns of the follow-up chat in the assistant's shape: oldest
 * first, at most `FOLLOW_UP_HISTORY_TURNS`, empty turns dropped, each text cut
 * to the server's per-turn limit.
 */
export function toAssistantHistory(
  messages: readonly FollowUpTurn[],
): { role: 'user' | 'assistant'; text: string }[] {
  return messages
    .filter((m) => m.text && m.text.trim())
    .slice(-FOLLOW_UP_HISTORY_TURNS)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      text: clip(m.text, HISTORY_TEXT_MAX),
    }));
}

/**
 * One short line saved to the Ask conversation before the first crop doctor
 * follow-up, so the Ask tab's history knows what the questions are about:
 * "রোগ নির্ণয়: <top cause> (<crop>)" / "Diagnosis: <top cause> (<crop>)".
 * Empty when there is no cause to name. Never over 300 characters.
 */
export function buildDiagnosisHeadline(input: {
  diagnosis: any;
  crop?: string;
  lang: 'bn' | 'en';
}): string {
  const { diagnosis, crop, lang } = input;
  if (!diagnosis || typeof diagnosis !== 'object') return '';
  const top = normalizeDiseaseCandidates(diagnosis.possibleDiseases).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];
  const english = clean(top?.disease) || clean(diagnosis.disease);
  const bangla = clean(diagnosis.diseaseBn);
  const cause = lang === 'bn' ? bangla || english : english || bangla;
  if (!cause) return '';
  const cropName = clean(crop);
  const label = lang === 'bn' ? 'রোগ নির্ণয়' : 'Diagnosis';
  return clip(`${label}: ${clip(cause, 200)}${cropName ? ` (${clip(cropName, 60)})` : ''}`, 300);
}

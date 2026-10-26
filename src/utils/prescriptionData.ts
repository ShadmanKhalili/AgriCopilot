/**
 * The data behind the Digital Krishi Prescription (Rx).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The Rx card used to be assembled inline in `AgriCopilot.tsx` and in
 * `AdminDashboard.tsx`, and it read field names that the accuracy work
 * (A1-A4) had already replaced:
 *
 *   - `diagnosis.disease` / `diagnosis.diseaseBn` — no longer produced. The
 *     model now returns `possibleDiseases` as SCORED candidates, so the
 *     fallback was the whole `diagnosis` paragraph.
 *   - `diagnosis.chemicalRemedy` / `diagnosis.organicRemedy` — never existed
 *     in the current response schema at all, so the card fell back to a
 *     hardcoded "Copper Oxychloride 50 WP @ 2g/L" for EVERY disease.
 *   - `diagnosis.pathogen` — no longer produced.
 *
 * On top of that the card printed a hardcoded weather snapshot (28.5 °C,
 * 84 % humidity) and a hardcoded 14-day pre-harvest interval on a document
 * that looks like a certified prescription.
 *
 * The Firestore rule `isValidPrescription` then refused the save twice over:
 * `confidence` must be a NUMBER (the card passed `null` for "not assessed")
 * and `diseaseName` must be at most 256 characters (the fallback paragraph
 * is far longer). So the prescription was never persisted — it silently
 * fell back to the local dossier.
 *
 * The rule set here is deliberately boring: every field is either taken
 * from what the model actually returned, or it is left empty. Nothing is
 * invented. When a defensible chemical protocol is missing, the chemical
 * section is GATED (withheld pending agronomic review) rather than filled
 * with a guess — a wrong pesticide on an official-looking card is worse
 * than no pesticide at all.
 */
import { normalizeDiseaseCandidates, confidenceSignal } from './diagnosisTypes';
import type { Language } from './translations';

export interface PrescriptionData {
  rxId?: string;
  farmerName?: string;
  phone?: string;
  location: string;
  crop: string;
  cropStage?: string;
  diseaseName: string;
  pathogen?: string;
  severity: 'Low' | 'Medium' | 'Critical' | string;
  /** null means "not assessed" — never a stand-in number. */
  confidence?: number | null;
  /** False when the confidence was not established (so a stored 0 is honest). */
  confidenceAssessed?: boolean;
  symptoms: string[];
  investigationSteps?: string[];
  culturalSteps: string[];
  organicSteps: string[];
  chemicalSteps: string[];
  /** True when the chemical section is withheld pending human review. */
  chemicalGated?: boolean;
  expertVerified?: boolean;
  harvestIntervalDays?: number;
  weatherSnapshot?: {
    temp?: string;
    humidity?: string;
    rainRisk?: string;
    advisory?: string;
  };
  sampleImage?: string;
  /** Why the model chose this condition over the alternatives. */
  differentialDiagnosis?: string;
}

// ── small helpers ──────────────────────────────────────────────────────────

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';

/** '১৪ দিন' -> '14 দিন' */
export const toAsciiDigits = (value: string): string =>
  value.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));

/** A small, stable, non-cryptographic hash — used for the Rx id only. */
const fnv1a = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

/**
 * A prescription id that is the SAME every time the same diagnosis is
 * opened. It used to be `Math.random()` inside the click handler, so
 * re-opening one diagnosis produced a different id — and the "SHA256"
 * seal printed under the signature was just a slice of that random number.
 */
export const stableRxId = (seed: string, year: number = new Date().getFullYear()): string =>
  `RX-BD-${year}-${(fnv1a(seed) % 1000000).toString().padStart(6, '0')}`;

/** Trim markdown noise and split a block into readable list items. */
export const splitSteps = (text: string | undefined | null): string[] => {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•·–—]\s*/, '').replace(/\*\*/g, '').trim())
    .filter((line) => line.length > 0);
};

/**
 * Pull the pre-harvest interval out of the model's own treatment protocol.
 * The prompt asks for it explicitly ("you MUST explicitly state the
 * Pre-Harvest Interval (PHI)"), so when it is there we use it; when it is
 * not, the card simply does not print one.
 */
export const extractPhiDays = (text: string | undefined | null): number | undefined => {
  if (!text) return undefined;
  const normalized = toAsciiDigits(String(text));
  const match = normalized.match(
    /(?:phi|pre-?harvest|harvest\s+interval|অপেক্ষমাণ|ফসল\s+তোলার\s+বিরতি)[^0-9]{0,30}(\d{1,3})/i
  );
  if (!match) return undefined;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 && days <= 365 ? days : undefined;
};

const CHEMICAL_HEADING = /(রাসায়নিক|কেমিক্যাল|chemical|কেমিকাল)/i;
const ORGANIC_HEADING = /(জৈবিক|জৈব|organic|biological|bio-?agent|বায়ো)/i;

/**
 * `advancedTreatment` is one markdown block holding BOTH the chemical and
 * the organic protocol. Split it on the two headings when they are there;
 * if they are not, keep the whole block as the chemical protocol so the
 * dosage and the safety rules are never lost.
 *
 * The heading lines themselves are dropped — a prescription step must be an
 * action, not the label of the section it sits in.
 */
export const splitTreatmentProtocol = (
  treatment: string | undefined | null
): { chemical: string[]; organic: string[] } => {
  if (!treatment) return { chemical: [], organic: [] };
  const lines = String(treatment).split(/\r?\n/);
  let chemicalStart = -1;
  let organicStart = -1;
  lines.forEach((line, index) => {
    if (chemicalStart === -1 && CHEMICAL_HEADING.test(line)) chemicalStart = index;
    else if (organicStart === -1 && ORGANIC_HEADING.test(line) && index > chemicalStart) organicStart = index;
  });

  if (chemicalStart === -1 && organicStart === -1) {
    return { chemical: splitSteps(treatment), organic: [] };
  }
  if (chemicalStart === -1) {
    return {
      chemical: [],
      organic: splitSteps(lines.slice(organicStart + 1).join('\n')),
    };
  }
  const chemicalEnd = organicStart === -1 ? lines.length : organicStart;
  return {
    chemical: splitSteps(lines.slice(chemicalStart + 1, chemicalEnd).join('\n')),
    organic: organicStart === -1 ? [] : splitSteps(lines.slice(organicStart + 1).join('\n')),
  };
};

/** The best-supported condition the model returned, if it returned one. */
export const topCandidate = (diagnosis: any) => {
  const candidates = normalizeDiseaseCandidates(diagnosis?.possibleDiseases);
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))[0];
};

const CROP_NOT_DETECTED = { bn: 'ছবি থেকে শনাক্ত ফসল', en: 'Crop detected from photo' };
const STAGE_NOT_DETECTED = { bn: 'শনাক্ত করা যায়নি', en: 'Not determined' };
const NO_CONDITION = { bn: 'শনাক্তযোগ্য রোগ পাওয়া যায়নি', en: 'No identifiable condition' };
const NO_PLANT_IN_IMAGE = { bn: 'ছবিতে কোনো উদ্ভিদ শনাক্ত হয়নি', en: 'No plant visible in the image' };

// ── the two entry points ───────────────────────────────────────────────────

export interface PrescriptionSource {
  /** The live AI result (the object the diagnosis call returned). */
  diagnosis?: any;
  /** The optional deep/second-opinion analysis. */
  deepDiagnosis?: any;
  crop?: string;
  cropStage?: string;
  district?: string;
  upazila?: string;
  farmerName?: string;
  lang: Language;
}

/**
 * Build the Rx from a live diagnosis.
 */
export const buildPrescriptionData = (source: PrescriptionSource): PrescriptionData => {
  const L = source.lang === 'bn';
  const langKey = L ? 'bn' : 'en';
  const diagnosis = source.diagnosis || {};
  const deep = source.deepDiagnosis || {};

  const candidate = topCandidate(diagnosis);
  const invalidImage = String(diagnosis.status || '').toLowerCase() === 'invalid';

  const diseaseName = candidate?.disease
    || diagnosis.disease
    || diagnosis.diseaseBn
    || (invalidImage ? NO_PLANT_IN_IMAGE[langKey] : NO_CONDITION[langKey]);

  const symptoms = Array.isArray(diagnosis.symptomsBreakdown) && diagnosis.symptomsBreakdown.length > 0
    ? diagnosis.symptomsBreakdown.map((s: unknown) => String(s)).slice(0, 25)
    : diagnosis.visibleSymptoms
      ? [String(diagnosis.visibleSymptoms)]
      : [];

  const confidence = confidenceSignal(
    normalizeDiseaseCandidates(diagnosis.possibleDiseases),
    diagnosis.confidence
  );
  const assessed = confidence.basis !== 'unknown';

  // Cultural / non-chemical action: the model's own verification advice.
  const culturalSteps = diagnosis.verificationAdvice
    ? [String(diagnosis.verificationAdvice)]
    : [];

  // The chemical and organic protocols only exist once the deep analysis
  // has run. Without them the chemical section is withheld, not guessed.
  const treatment = splitTreatmentProtocol(deep.advancedTreatment);
  const hasChemicalProtocol = treatment.chemical.length > 0;
  const organicSteps = treatment.organic.length > 0
    ? treatment.organic
    : deep.recoveryTimeline
      ? splitSteps(deep.recoveryTimeline)
      : [];

  const cropLabel = source.crop && source.crop.trim() ? source.crop.trim() : CROP_NOT_DETECTED[langKey];
  const stageLabel = source.cropStage && source.cropStage.trim()
    ? source.cropStage.trim()
    : STAGE_NOT_DETECTED[langKey];

  const district = source.district || (L ? 'বাংলাদেশ' : 'Bangladesh');
  const location = source.upazila ? `${district}, ${source.upazila}` : district;

  return {
    rxId: stableRxId(
      `${cropLabel}|${diseaseName}|${diagnosis.diagnosis || ''}|${diagnosis.createdAt || ''}`
    ),
    farmerName: source.farmerName,
    location,
    crop: cropLabel,
    cropStage: stageLabel,
    diseaseName,
    pathogen: deep.biologicalCause ? String(deep.biologicalCause) : undefined,
    severity: String(diagnosis.qualitativeSeverity || diagnosis.severity || 'Medium'),
    confidence: assessed ? confidence.score : null,
    confidenceAssessed: assessed,
    symptoms,
    culturalSteps,
    organicSteps,
    chemicalSteps: treatment.chemical,
    chemicalGated: !hasChemicalProtocol,
    expertVerified: false,
    harvestIntervalDays: extractPhiDays(deep.advancedTreatment),
    differentialDiagnosis: diagnosis.differentialDiagnosis
      ? String(diagnosis.differentialDiagnosis)
      : deep.differentialReasoning
        ? String(deep.differentialReasoning)
        : undefined,
  };
};

/**
 * Build the Rx from a STORED diagnosis record (the admin audit registry
 * and the "View Rx" button on a saved diagnosis).
 *
 * A stored record has no treatment protocol — the chemical section is
 * therefore always withheld for a stored record.
 */
export const buildPrescriptionFromRecord = (
  record: any,
  lang: Language,
  extras: { farmerName?: string; district?: string; upazila?: string } = {}
): PrescriptionData => {
  const L = lang === 'bn';
  const langKey = L ? 'bn' : 'en';
  const symptoms = Array.isArray(record?.symptomsBreakdown)
    ? record.symptomsBreakdown.map((s: unknown) => String(s)).slice(0, 25)
    : [];

  const diseaseName = String(record?.diagnosisText || '').trim()
    || NO_CONDITION[langKey];

  const confidence = confidenceSignal(
    normalizeDiseaseCandidates(record?.possibleDiseases),
    record?.confidence
  );
  const assessed = confidence.basis !== 'unknown';

  const district = extras.district || record?.district || (L ? 'বাংলাদেশ' : 'Bangladesh');
  const location = extras.upazila ? `${district}, ${extras.upazila}` : district;

  return {
    rxId: stableRxId(`${record?.crop || ''}|${diseaseName}|${record?.createdAt || ''}`),
    farmerName: extras.farmerName || record?.farmerName,
    location,
    crop: record?.crop && record.crop !== 'auto-detected'
      ? record.crop
      : CROP_NOT_DETECTED[langKey],
    cropStage: record?.cropStage && record.cropStage !== 'auto-detected'
      ? record.cropStage
      : STAGE_NOT_DETECTED[langKey],
    diseaseName,
    severity: String(record?.qualitativeSeverity || 'Medium'),
    confidence: assessed ? confidence.score : null,
    confidenceAssessed: assessed,
    symptoms,
    culturalSteps: record?.verificationAdvice ? [String(record.verificationAdvice)] : [],
    organicSteps: [],
    chemicalSteps: [],
    chemicalGated: true,
    expertVerified: record?.verified === true,
    harvestIntervalDays: undefined,
  };
};

/**
 * The shape written to the `prescriptions` collection.
 *
 * `confidence` MUST be a number — the Firestore rule refuses `null`. When
 * the confidence was never established we store 0 together with
 * `confidenceAssessed: false`, so "0 %" and "not assessed" stay
 * distinguishable instead of one silently pretending to be the other.
 */
export const toStorablePrescription = (
  data: PrescriptionData,
  userId: string,
  farmerName: string
): Record<string, unknown> => ({
  rxId: data.rxId || stableRxId(`${data.crop}|${data.diseaseName}`),
  userId,
  farmerName: farmerName || 'Registered Grower',
  crop: data.crop,
  diseaseName: data.diseaseName,
  severity: data.severity,
  confidence: typeof data.confidence === 'number' ? data.confidence : 0,
  confidenceAssessed: data.confidenceAssessed !== false && typeof data.confidence === 'number',
  location: data.location,
  createdAt: new Date().toISOString(),
  // A prescription is NOT verified just because it was issued by the model.
  // Only an agronomist can certify it (AdminDashboard -> Certify).
  verified: false,
  ...(data.pathogen ? { pathogen: data.pathogen } : {}),
  ...(data.cropStage ? { cropStage: data.cropStage } : {}),
  symptoms: data.symptoms,
  culturalSteps: data.culturalSteps,
  organicSteps: data.organicSteps,
  chemicalSteps: data.chemicalSteps,
  chemicalGated: data.chemicalGated === true,
  ...(typeof data.harvestIntervalDays === 'number'
    ? { harvestIntervalDays: data.harvestIntervalDays }
    : {}),
  ...(data.differentialDiagnosis ? { differentialDiagnosis: data.differentialDiagnosis } : {}),
});

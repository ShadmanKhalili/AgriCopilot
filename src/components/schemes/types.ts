import type { EligibilityTags } from '../../utils/schemeMatch';

export interface LocalText {
  en: string;
  bn: string;
}

export interface GovScheme {
  id: string;
  title: LocalText;
  description: LocalText;
  /** Who can apply, in words. The matchable limits are in `eligibilityTags`. */
  eligibility: LocalText;
  howToApply: LocalText;
  benefits?: LocalText;
  deadline?: LocalText;
  contactInfo?: LocalText;
  tags?: string[];
  crops: string[];
  districts: string[];
  sourceLinks: string[];
  provider?: string;
  status?: string;
  lastUpdated: string;
  /** Limits used by the "For you" list. Missing on older Firestore records. */
  eligibilityTags?: EligibilityTags;
}

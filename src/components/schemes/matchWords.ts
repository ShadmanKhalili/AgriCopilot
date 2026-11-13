import type { Language } from '../../utils/translations';
import type { MatchReason, SchemeMatch, SchemeProvider, ProviderFilter } from '../../utils/schemeMatch';

export interface FarmerLabels {
  /** The farmer's crop in the screen's language, if set. */
  crop: string | null;
  /** The farmer's district in the screen's language, if set. */
  district: string | null;
}

const reasonWords = (
  reason: MatchReason,
  match: SchemeMatch<unknown>,
  lang: Language,
  labels: FarmerLabels,
): string => {
  const bn = lang === 'bn';
  const ownersOnly = match.tags.tenure?.length === 1 && match.tags.tenure[0] === 'owner';
  switch (reason) {
    case 'crop':
      if (bn) return labels.crop ? `আপনার ${labels.crop} চাষের জন্য` : 'আপনার ফসলের জন্য';
      return `For your crop${labels.crop ? ` (${labels.crop})` : ''}`;
    case 'district':
      if (bn) return labels.district ? `আপনার জেলায় (${labels.district}) চালু আছে` : 'আপনার জেলায় চালু আছে';
      return `Open in your district${labels.district ? ` (${labels.district})` : ''}`;
    case 'land':
      return bn ? 'আপনার জমির মাপের সাথে মেলে' : 'Fits your land size';
    case 'tenure':
      return bn ? 'আপনার জমির ধরনের সাথে মেলে' : 'Fits how you hold your land';
    case 'crop-unknown':
      return bn ? 'শুধু কিছু ফসলের জন্য। আপনার ফসল বলা নেই' : 'Only for some crops. Your crop is not set';
    case 'district-unknown':
      return bn ? 'শুধু কিছু জেলায়। আপনার জেলা বলা নেই' : 'Only in some districts. Your district is not set';
    case 'land-unknown':
      return bn ? 'জমির মাপের শর্ত আছে। কৃষি অফিসে জেনে নিন' : 'Has a land size rule. Ask your agriculture office';
    case 'tenure-unknown':
      return ownersOnly
        ? bn ? 'যাদের নিজের জমি আছে, তাদের জন্য' : 'For farmers who own land'
        : bn ? 'বর্গাচাষিদের জন্য' : 'For farmers who rent or share-crop land';
    case 'open-to-all':
    default:
      return bn ? 'সব কৃষকের জন্য' : 'Open to all farmers';
  }
};

/** One plain line on why a scheme is in "For you". */
export function matchLine(match: SchemeMatch<unknown>, lang: Language, labels: FarmerLabels): string {
  const parts = match.reasons.slice(0, 2).map((r) => reasonWords(r, match, lang, labels));
  return parts.join(lang === 'bn' ? '। ' : '. ') + (lang === 'bn' ? '।' : '.');
}

export const providerLabel = (provider: ProviderFilter, lang: Language): string => {
  const bn = lang === 'bn';
  switch (provider) {
    case 'government':
      return bn ? 'সরকারি' : 'Government';
    case 'ngo':
      return bn ? 'এনজিও' : 'NGO';
    case 'private':
      return bn ? 'বেসরকারি কোম্পানি' : 'Private';
    case 'all':
    default:
      return bn ? 'সব' : 'All';
  }
};

/** What to say when a provider has nothing listed. */
export const providerEmpty = (provider: SchemeProvider | 'all', lang: Language): string => {
  const bn = lang === 'bn';
  switch (provider) {
    case 'ngo':
      return bn ? 'এখনো কোনো এনজিওর সুবিধা তালিকায় নেই।' : 'No NGO offers listed yet.';
    case 'private':
      return bn ? 'এখনো কোনো কোম্পানির সুবিধা তালিকায় নেই।' : 'No private company offers listed yet.';
    case 'government':
      return bn ? 'এখনো কোনো সরকারি প্রকল্প তালিকায় নেই।' : 'No government schemes listed yet.';
    case 'all':
    default:
      return bn ? 'এখনো কোনো প্রকল্প তালিকায় নেই।' : 'No schemes listed yet.';
  }
};

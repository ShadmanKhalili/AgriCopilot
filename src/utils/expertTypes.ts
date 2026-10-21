/**
 * Human Expert Layer — shared types, constants and pure helpers.
 *
 * This layer sits *after* the AI in the support ladder: the AI triages and
 * advises, and a verified human expert (Upazila Krishi Officer, NGO field
 * staff, private agronomist or vetted peer farmer) can be requested when the
 * farmer wants a person.
 *
 * Privacy is consent-first: an expert only ever sees the fields the farmer
 * explicitly shares, for a limited time, and can lose access the moment the
 * farmer revokes consent.
 */

export type ExpertAffiliationType = 'government' | 'ngo' | 'private' | 'peer';
export type ExpertVerificationLevel = 'provisional' | 'verified' | 'senior';
export type ExpertStatus = 'active' | 'paused' | 'suspended';

export type ConsultationStatus =
  | 'requested'
  | 'accepted'
  | 'in_progress'
  | 'awaiting_farmer'
  | 'resolved'
  | 'closed'
  | 'cancelled'
  | 'expired'
  | 'escalated';

export type ConsultationUrgency = 'emergency' | 'urgent' | 'general';
export type ConsultationMessageType = 'text' | 'voice' | 'photo' | 'advisory' | 'system';
export type ConsentKey =
  | 'diagnosis'
  | 'photos'
  | 'farm_profile'
  | 'phone'
  | 'previous_consultations'
  | 'gps';

export interface ExpertPublic {
  uid: string;
  displayName: string;
  photoURL?: string;
  affiliationType: ExpertAffiliationType;
  affiliationName: string;
  roleTitle: string;
  districts: string[];
  upazilas: string[];
  specializations: string[];
  languages: string[];
  bio?: string;
  verificationLevel: ExpertVerificationLevel;
  status: ExpertStatus;
  ratingAverage: number;
  ratingCount: number;
  responseTimeMins?: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpertApplication {
  id: string;
  applicantId: string;
  fullName: string;
  phone: string;
  email?: string;
  affiliationType: ExpertAffiliationType;
  affiliationName: string;
  roleTitle: string;
  districts: string[];
  upazilas: string[];
  specializations: string[];
  languages: string[];
  yearsExperience: number;
  registrationNo?: string;
  referenceName?: string;
  referencePhone?: string;
  motivation: string;
  /** Optional text the applicant agrees to show on the public expert card. */
  publicBio?: string;
  conflictOfInterest?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerNote?: string;
  level?: ExpertVerificationLevel;
  createdAt: string;
  updatedAt: string;
}

/**
 * The only farmer data an expert may see. Every field here is written at
 * request time into the consultation document (a consent snapshot), so the
 * expert never touches `farmer_profiles` directly.
 */
export interface ConsentSnapshot {
  crop?: string;
  cropStage?: string;
  diagnosisSummary?: string;
  severity?: string;
  confidence?: number;
  photosCount?: number;
  district?: string;
  upazila?: string;
  landDecimals?: number;
  soilType?: string;
  irrigationType?: string;
  phone?: string;
  /** Last few closed cases, only if the farmer opted in. */
  previousConsultations?: string[];
}

export interface ConsultationAdvisory {
  confirmation: string;
  actions: string;
  dosage?: string;
  followUpDays?: number;
  escalateIf?: string;
}

export interface Consultation {
  id: string;
  farmerId: string;
  farmerName: string;
  expertId: string;
  expertName: string;
  status: ConsultationStatus;
  urgency: ConsultationUrgency;
  category: string;
  crop: string;
  lang: string;
  district: string;
  upazila: string;
  gps?: { lat: number; lng: number };
  consentScope: ConsentKey[];
  consentGrantedAt: string;
  consentExpiresAt: string;
  consentExpiresAtMs: number;
  consentRevoked: boolean;
  consentRevokedAt?: string;
  requestedAt: string;
  slaDueAt: string;
  slaDueAtMs: number;
  acceptedAt?: string;
  firstResponseAt?: string;
  closedAt?: string;
  outcome?: string;
  expertNotes?: string;
  farmerRating?: number;
  farmerFeedback?: string;
  lastMessageAt?: string;
  lastMessageSenderRole?: 'farmer' | 'expert';
  lastFarmerMessageAt?: string;
  lastExpertMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sensitive case details live in a subdocument, not on the consultation
 * itself. Expert access to this subdocument is gated by `isConsultationParticipant`,
 * which enforces consent revocation and expiry, so a broad list query can
 * never leak phone numbers, diagnosis snapshots or the farmer's description.
 */
export interface ConsultationCase {
  id: string;
  symptoms: string;
  consentSnapshot: ConsentSnapshot;
  gps?: { lat: number; lng: number };
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationMessage {
  id: string;
  senderId: string;
  senderRole: 'farmer' | 'expert';
  type: ConsultationMessageType;
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  advisory?: ConsultationAdvisory;
  createdAt: string;
  readAt?: string;
}

/** Seed passed from a diagnosis screen into the request wizard. */
export interface ExpertRequestSeed {
  category?: string;
  crop?: string;
  cropStage?: string;
  diagnosisSummary?: string;
  severity?: string;
  confidence?: number;
  photosCount?: number;
  district?: string;
  upazila?: string;
}

// ---------------------------------------------------------------
// Constants
// ---------------------------------------------------------------

export const SLA_MINUTES: Record<ConsultationUrgency, number> = {
  emergency: 15,
  urgent: 2 * 60,
  general: 24 * 60,
};

/** Consent stays valid for 7 days unless the farmer revokes it earlier. */
export const CONSENT_VALIDITY_DAYS = 7;

export const MAX_VOICE_NOTE_CHARS = 420000; // ~< 315 KB binary; Firestore doc limit is 1 MB

export const EXPERT_CATEGORIES: { id: string; bn: string; en: string }[] = [
  { id: 'crop_disease', bn: 'ফসলের রোগ ও পোকা', en: 'Crop Disease & Pest' },
  { id: 'soil_fertilizer', bn: 'মাটি ও সার', en: 'Soil & Fertilizer' },
  { id: 'weather_damage', bn: 'আবহাওয়ার ক্ষতি', en: 'Weather Damage' },
  { id: 'rice', bn: 'ধান চাষ', en: 'Rice' },
  { id: 'vegetables', bn: 'সবজি চাষ', en: 'Vegetables' },
  { id: 'horticulture', bn: 'ফল ও বাগান', en: 'Fruit & Orchard' },
  { id: 'livestock', bn: 'গবাদি পশু', en: 'Livestock' },
  { id: 'post_harvest', bn: 'ফসল কাটার পরে', en: 'Post-Harvest' },
  { id: 'market_credit', bn: 'বাজার ও ঋণ', en: 'Market & Credit' },
];

export const CONSENT_ITEMS: {
  id: ConsentKey;
  bn: string;
  en: string;
  detailBn: string;
  detailEn: string;
  defaultOn: boolean;
}[] = [
  {
    id: 'diagnosis',
    bn: 'এআই রোগ নির্ণয়',
    en: 'AI diagnosis',
    detailBn: 'লক্ষণ, সম্ভাব্য রোগ ও পরামর্শ',
    detailEn: 'Symptoms, possible diseases and advice',
    defaultOn: true,
  },
  {
    id: 'photos',
    bn: 'ফসলের ছবি',
    en: 'Crop photos',
    detailBn: 'আপনি যে ছবি পাঠিয়েছেন',
    detailEn: 'The photos you already uploaded',
    defaultOn: true,
  },
  {
    id: 'farm_profile',
    bn: 'খামারের সাধারণ তথ্য',
    en: 'Farm profile',
    detailBn: 'ফসল, জমির পরিমাণ, জেলা ও উপজেলা',
    detailEn: 'Crops, land size, district and upazila',
    defaultOn: true,
  },
  {
    id: 'phone',
    bn: 'মোবাইল নম্বর',
    en: 'Phone number',
    detailBn: 'যাতে বিশেষজ্ঞ আপনাকে কল করতে পারেন',
    detailEn: 'So the expert can call you back',
    defaultOn: true,
  },
  {
    id: 'previous_consultations',
    bn: 'আগের পরামর্শ',
    en: 'Previous consultations',
    detailBn: 'পুরনো বিশেষজ্ঞ পরামর্শের ইতিহাস',
    detailEn: 'History of earlier expert consultations',
    defaultOn: false,
  },
  {
    id: 'gps',
    bn: 'সঠিক মাঠের অবস্থান',
    en: 'Exact field location',
    detailBn: 'শুধু মাঠ পরিদর্শনের সময় দরকার হলে',
    detailEn: 'Only needed if a field visit is agreed',
    defaultOn: false,
  },
];

// ---------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------

export const computeSlaDueMs = (
  urgency: ConsultationUrgency,
  fromMs: number = Date.now()
): number => fromMs + SLA_MINUTES[urgency] * 60_000;

export const consentExpiryMs = (fromMs: number = Date.now()): number =>
  fromMs + CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export const urgencyLabel = (urgency: ConsultationUrgency, lang: string): string => {
  const bn = lang === 'bn';
  if (urgency === 'emergency') return bn ? '১৫ মিনিটের মধ্যে' : 'Within 15 minutes';
  if (urgency === 'urgent') return bn ? '২ ঘণ্টার মধ্যে' : 'Within 2 hours';
  return bn ? '২৪ ঘণ্টার মধ্যে' : 'Within 24 hours';
};

export const statusLabel = (status: ConsultationStatus, lang: string): string => {
  const bn = lang === 'bn';
  const map: Record<ConsultationStatus, [string, string]> = {
    requested: ['অনুরোধ পাঠানো হয়েছে', 'Requested'],
    accepted: ['বিশেষজ্ঞ গ্রহণ করেছেন', 'Accepted'],
    in_progress: ['পরামর্শ চলছে', 'In progress'],
    awaiting_farmer: ['আপনার উত্তরের অপেক্ষায়', 'Awaiting your reply'],
    resolved: ['সমাধান হয়েছে', 'Resolved'],
    closed: ['সম্পন্ন', 'Closed'],
    cancelled: ['বাতিল', 'Cancelled'],
    expired: ['সময় শেষ', 'Expired'],
    escalated: ['উর্ধ্বতনে পাঠানো হয়েছে', 'Escalated'],
  };
  const entry = map[status] || ['—', '—'];
  return bn ? entry[0] : entry[1];
};

export const statusColor = (status: ConsultationStatus): string => {
  switch (status) {
    case 'resolved':
    case 'closed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'cancelled':
    case 'expired':
      return 'bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700';
    case 'escalated':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800';
  }
};

export const affiliationLabel = (type: ExpertAffiliationType, lang: string): string => {
  const bn = lang === 'bn';
  switch (type) {
    case 'government':
      return bn ? 'সরকারি কৃষি অফিস' : 'Government Agri Office';
    case 'ngo':
      return bn ? 'কৃষি এনজিও' : 'Agri NGO';
    case 'private':
      return bn ? 'বেসরকারি কৃষি বিশেষজ্ঞ' : 'Private Agronomist';
    default:
      return bn ? 'অভিজ্ঞ কৃষক' : 'Experienced Farmer';
  }
};

export const categoryLabel = (id: string, lang: string): string => {
  const found = EXPERT_CATEGORIES.find((c) => c.id === id);
  if (!found) return lang === 'bn' ? 'কৃষি পরামর্শ' : 'Agri advice';
  return lang === 'bn' ? found.bn : found.en;
};

export const formatCountdown = (dueMs: number, lang: string): string => {
  const remaining = dueMs - Date.now();
  if (remaining <= 0) return lang === 'bn' ? 'সময় শেষ' : 'Overdue';
  const mins = Math.floor(remaining / 60000);
  if (mins < 60) return lang === 'bn' ? `${mins} মিনিট বাকি` : `${mins} min left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'bn' ? `${hours} ঘণ্টা বাকি` : `${hours} h left`;
  const days = Math.floor(hours / 24);
  return lang === 'bn' ? `${days} দিন বাকি` : `${days} d left`;
};

/**
 * Simple, explainable matchmaking score.
 * Jurisdiction first, then specialisation, then availability/quality.
 */
export const scoreExpert = (
  expert: ExpertPublic,
  ctx: { district?: string; upazila?: string; category?: string; crop?: string }
): number => {
  let score = 0;
  const upazila = (ctx.upazila || '').trim();
  const district = (ctx.district || '').trim();
  const category = (ctx.category || '').trim();
  const crop = (ctx.crop || '').trim().toLowerCase();

  if (upazila && expert.upazilas?.includes(upazila)) score += 40;
  else if (district && (expert.districts?.includes(district) || expert.upazilas?.includes(district))) score += 25;

  if (category && expert.specializations?.includes(category)) score += 25;
  else if (crop && (expert.specializations?.some((s) => s.toLowerCase().includes(crop)) || expert.bio?.toLowerCase().includes(crop))) score += 12;

  if (expert.status === 'active') score += 15;
  if (expert.verificationLevel === 'senior') score += 6;
  else if (expert.verificationLevel === 'verified') score += 4;
  score += Math.min(10, Math.round((expert.ratingAverage || 0) * 2));
  if (expert.languages?.includes('bn')) score += 3;

  // Demo experts are only for demos; never let them outrank real experts.
  if (expert.isDemo) score -= 100;

  return score;
};

export const rankExperts = (
  experts: ExpertPublic[],
  ctx: { district?: string; upazila?: string; category?: string; crop?: string },
  count: number = 3
): ExpertPublic[] =>
  [...experts]
    .map((e) => ({ e, s: scoreExpert(e, ctx) }))
    .sort((a, b) => b.s - a.s || (b.e.ratingAverage || 0) - (a.e.ratingAverage || 0))
    .slice(0, count)
    .map((x) => x.e);

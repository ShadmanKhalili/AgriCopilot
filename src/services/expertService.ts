/**
 * Human Expert Layer — Firestore data service.
 *
 * Everything here runs client-side under the strict Firestore rules in
 * `firestore.rules`. Privileged role changes (farmer → expert) only happen
 * through the admin approval flow; the rules block self-promotion.
 *
 * All expert features require a signed-in user. Guests get a clear Bangla
 * error instead of a silent failure.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firestore';
import { sanitizeString } from '../utils/security';
import type { FarmerProfileData } from '../utils/farmerProfiler';
import {
  computeSlaDueMs,
  consentExpiryMs,
  type ConsentKey,
  type ConsentSnapshot,
  type Consultation,
  type ConsultationAdvisory,
  type ConsultationCase,
  type ConsultationMessage,
  type ConsultationMessageType,
  type ConsultationStatus,
  type ConsultationUrgency,
  type ExpertApplication,
  type ExpertPublic,
  type ExpertRequestSeed,
  type ExpertVerificationLevel,
} from '../utils/expertTypes';

const nowIso = () => new Date().toISOString();

export const describeError = (error: any, lang: string): string => {
  const code = String(error?.code || '');
  const bn = lang === 'bn';
  if (code.includes('permission-denied')) {
    return bn
      ? 'সার্ভারে অনুমতি পাওয়া যায়নি। ফায়ারস্টোর নিয়ম (rules) আপডেট করা হয়েছে কি না দেখুন।'
      : 'Permission denied — make sure the Firestore rules include the expert collections.';
  }
  if (code.includes('unavailable') || code.includes('offline')) {
    return bn ? 'ইন্টারনেট সংযোগ পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।' : 'Network unavailable — please retry.';
  }
  if (code.includes('not-found')) {
    return bn ? 'তথ্য খুঁজে পাওয়া যায়নি।' : 'Record not found.';
  }
  if (code.includes('resource-exhausted') || code.includes('invalid-argument')) {
    return bn ? 'তথ্যটি খুব বড় হয়ে গেছে। ছোট করে আবার চেষ্টা করুন।' : 'Payload too large — please shorten it.';
  }
  return error?.message ? String(error.message) : bn ? 'কিছু ভুল হয়েছে।' : 'Something went wrong.';
};

// ---------------------------------------------------------------
// Experts directory
// ---------------------------------------------------------------

export const fetchActiveExperts = async (): Promise<ExpertPublic[]> => {
  // Single-field filter only (no composite index needed). Sorted client-side.
  const snap = await getDocs(
    query(collection(db, 'experts_public'), where('status', '==', 'active'), limit(60))
  );
  const experts = snap.docs.map((d) => ({ ...(d.data() as ExpertPublic), uid: d.id }));
  return experts.sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
};

/**
 * Cheap live count of experts currently accepting requests (`status == 'active'`).
 * Uses an aggregate count query so we never download the expert list just to
 * light up the global availability badge. Requires signed-in list permission.
 */
export const fetchActiveExpertCount = async (): Promise<number> => {
  const snap = await getCountFromServer(
    query(collection(db, 'experts_public'), where('status', '==', 'active'))
  );
  return snap.data().count || 0;
};

export const fetchExpertProfile = async (uid: string): Promise<ExpertPublic | null> => {
  const snap = await getDoc(doc(db, 'experts_public', uid));
  if (!snap.exists()) return null;
  return { ...(snap.data() as ExpertPublic), uid: snap.id };
};

export const setExpertStatus = async (uid: string, status: 'active' | 'paused'): Promise<void> => {
  await updateDoc(doc(db, 'experts_public', uid), { status, updatedAt: nowIso() });
};

// ---------------------------------------------------------------
// Applications & onboarding
// ---------------------------------------------------------------

export interface ExpertApplicationInput {
  fullName: string;
  phone: string;
  email?: string;
  affiliationType: ExpertPublic['affiliationType'];
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
  publicBio?: string;
  conflictOfInterest?: string;
}

export const applyAsExpert = async (
  applicantId: string,
  input: ExpertApplicationInput
): Promise<string> => {
  const createdAt = nowIso();
  const payload = {
    applicantId,
    fullName: sanitizeString(input.fullName, 128),
    phone: sanitizeString(input.phone, 24),
    email: sanitizeString(input.email || '', 128),
    affiliationType: input.affiliationType,
    affiliationName: sanitizeString(input.affiliationName, 128),
    roleTitle: sanitizeString(input.roleTitle, 128),
    districts: input.districts.slice(0, 8).map((d) => sanitizeString(d, 64)),
    upazilas: input.upazilas.slice(0, 16).map((u) => sanitizeString(u, 64)),
    specializations: input.specializations.slice(0, 8).map((s) => sanitizeString(s, 64)),
    languages: input.languages.slice(0, 4).map((l) => sanitizeString(l, 16)),
    yearsExperience: Math.max(0, Math.min(70, Number(input.yearsExperience) || 0)),
    registrationNo: sanitizeString(input.registrationNo || '', 64),
    referenceName: sanitizeString(input.referenceName || '', 128),
    referencePhone: sanitizeString(input.referencePhone || '', 24),
    motivation: sanitizeString(input.motivation, 2000),
    publicBio: sanitizeString(input.publicBio || '', 600),
    conflictOfInterest: sanitizeString(input.conflictOfInterest || '', 500),
    status: 'pending' as const,
    createdAt,
    updatedAt: createdAt,
  };
  const ref = await addDoc(collection(db, 'expert_applications'), payload);
  return ref.id;
};

export const getMyApplication = async (uid: string): Promise<ExpertApplication | null> => {
  const snap = await getDocs(
    query(collection(db, 'expert_applications'), where('applicantId', '==', uid))
  );
  if (snap.empty) return null;
  const applications = snap.docs
    .map((d) => ({ ...(d.data() as ExpertApplication), id: d.id }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return applications[0];
};

export const listApplications = async (): Promise<ExpertApplication[]> => {
  const snap = await getDocs(collection(db, 'expert_applications'));
  return snap.docs
    .map((d) => ({ ...(d.data() as ExpertApplication), id: d.id }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};

/** Admin-only: promote the applicant to expert and publish their public card. */
export const approveApplication = async (
  application: ExpertApplication,
  level: ExpertVerificationLevel,
  reviewerNote: string
): Promise<void> => {
  const ts = nowIso();
  const uid = application.applicantId;

  // One atomic admin action: never leave an "expert" user without a public card
  // or a half-approved application if a later write fails.
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { role: 'expert' });

  batch.set(doc(db, 'experts_public', uid), {
    uid,
    displayName: application.fullName,
    affiliationType: application.affiliationType,
    affiliationName: application.affiliationName,
    roleTitle: application.roleTitle,
    districts: application.districts || [],
    upazilas: application.upazilas || [],
    specializations:
      application.specializations && application.specializations.length > 0
        ? application.specializations
        : ['crop_disease'],
    languages: application.languages && application.languages.length > 0 ? application.languages : ['bn'],
    // Public card copy only. The application's motivation/experience text is
    // private to the reviewer and must never be published automatically.
    bio: sanitizeString(
      application.publicBio ||
        [application.roleTitle, application.affiliationName].filter(Boolean).join(' • '),
      500
    ),
    verificationLevel: level,
    status: 'active',
    ratingAverage: 0,
    ratingCount: 0,
    responseTimeMins: 0,
    createdAt: ts,
    updatedAt: ts,
  });

  batch.set(doc(db, 'experts_private', uid), {
    uid,
    phone: application.phone || '',
    email: application.email || '',
    availability: 'online',
    maxConcurrent: 10,
    currentLoad: 0,
    verifiedBy: 'admin',
    verifiedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });

  batch.update(doc(db, 'expert_applications', application.id), {
    status: 'approved',
    level,
    reviewerNote: sanitizeString(reviewerNote || '', 500),
    updatedAt: ts,
  });
  await batch.commit();
};

export const rejectApplication = async (
  applicationId: string,
  reviewerNote: string
): Promise<void> => {
  await updateDoc(doc(db, 'expert_applications', applicationId), {
    status: 'rejected',
    reviewerNote: sanitizeString(reviewerNote || '', 500),
    updatedAt: nowIso(),
  });
};

/**
 * Admin-only demo helpers. Marked `isDemo` so matchmaking never ranks them
 * above real experts (see `scoreExpert`). For investor demos of the loop.
 */
export const seedDemoExperts = async (): Promise<number> => {
  const ts = nowIso();
  const demos: Array<Partial<ExpertPublic> & { uid: string; displayName: string }> = [
    {
      uid: 'demo_expert_1',
      displayName: 'ড. শাহিনুর আলম (ডেমো)',
      affiliationType: 'government',
      affiliationName: 'DAE — উপজেলা কৃষি অফিস',
      roleTitle: 'উপজেলা কৃষি অফিসার',
      districts: ['Bogura', 'Naogaon'],
      upazilas: ['Bogura Sadar', 'Sherpur'],
      specializations: ['crop_disease', 'rice', 'soil_fertilizer'],
      languages: ['bn', 'en'],
      bio: 'ধান ও গমের রোগ ব্যবস্থাপনায় ১২ বছরের অভিজ্ঞতা।',
      verificationLevel: 'senior',
      ratingAverage: 4.8,
      ratingCount: 126,
      responseTimeMins: 18,
    },
    {
      uid: 'demo_expert_2',
      displayName: 'নাজমুল হোসেন (ডেমো)',
      affiliationType: 'ngo',
      affiliationName: 'কৃষি উন্নয়ন এনজিও',
      roleTitle: 'ফিল্ড কৃষি বিশেষজ্ঞ',
      districts: ['Jashore', 'Khulna'],
      upazilas: ['Jashore Sadar', 'Abhaynagar'],
      specializations: ['vegetables', 'horticulture', 'post_harvest'],
      languages: ['bn'],
      bio: 'সবজি ও ফলের সমন্বিত বালাই ব্যবস্থাপনা (IPM) বিশেষজ্ঞ।',
      verificationLevel: 'verified',
      ratingAverage: 4.6,
      ratingCount: 98,
      responseTimeMins: 35,
    },
    {
      uid: 'demo_expert_3',
      displayName: 'মোছা. রহিমা বেগম (ডেমো)',
      affiliationType: 'peer',
      affiliationName: 'অভিজ্ঞ কৃষক পরামর্শক',
      roleTitle: 'মাঠ পর্যায়ের অভিজ্ঞ কৃষক',
      districts: ['Dhaka', 'Manikganj'],
      upazilas: ['Savar', 'Dhamrai'],
      specializations: ['soil_fertilizer', 'market_credit'],
      languages: ['bn'],
      bio: 'জৈব সার ও কম খরচে চাষাবাদে ২০ বছরের মাঠ অভিজ্ঞতা।',
      verificationLevel: 'verified',
      ratingAverage: 4.5,
      ratingCount: 74,
      responseTimeMins: 45,
    },
  ];

  for (const d of demos) {
    await setDoc(doc(db, 'experts_public', d.uid), {
      uid: d.uid,
      displayName: d.displayName,
      affiliationType: d.affiliationType || 'private',
      affiliationName: d.affiliationName || '',
      roleTitle: d.roleTitle || '',
      districts: d.districts || [],
      upazilas: d.upazilas || [],
      specializations: d.specializations || ['crop_disease'],
      languages: d.languages || ['bn'],
      bio: d.bio || '',
      verificationLevel: d.verificationLevel || 'verified',
      status: 'active',
      ratingAverage: d.ratingAverage || 4.5,
      ratingCount: d.ratingCount || 0,
      responseTimeMins: d.responseTimeMins || 30,
      isDemo: true,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  return demos.length;
};

// ---------------------------------------------------------------
// Consent snapshot
// ---------------------------------------------------------------

export const buildConsentSnapshot = (
  consentScope: ConsentKey[],
  profile: FarmerProfileData | null,
  seed: ExpertRequestSeed | undefined,
  fallback: {
    crop?: string;
    district?: string;
    upazila?: string;
    phone?: string;
    previousConsultations?: string[];
  }
): ConsentSnapshot => {
  const snapshot: ConsentSnapshot = {};
  const has = (k: ConsentKey) => consentScope.includes(k);

  if (has('diagnosis')) {
    if (seed?.diagnosisSummary) snapshot.diagnosisSummary = sanitizeString(seed.diagnosisSummary, 1200);
    if (seed?.severity) snapshot.severity = sanitizeString(seed.severity, 32);
    if (typeof seed?.confidence === 'number') snapshot.confidence = seed.confidence;
  }
  if (has('photos') && typeof seed?.photosCount === 'number') {
    snapshot.photosCount = Math.max(0, Math.min(20, seed.photosCount));
  }
  if (has('farm_profile')) {
    snapshot.crop = sanitizeString(seed?.crop || profile?.primaryCrop || fallback.crop || '', 64);
    snapshot.cropStage = sanitizeString(seed?.cropStage || '', 64);
    if (profile?.totalLandDecimals) snapshot.landDecimals = profile.totalLandDecimals;
    if (profile?.soilType) snapshot.soilType = sanitizeString(profile.soilType, 64);
    if (profile?.irrigationType) snapshot.irrigationType = sanitizeString(profile.irrigationType, 64);
    snapshot.district = sanitizeString(profile?.locationDistrict || fallback.district || '', 64);
    snapshot.upazila = sanitizeString(profile?.locationUpazila || fallback.upazila || '', 64);
  }
  if (has('phone')) {
    snapshot.phone = sanitizeString(fallback.phone || '', 24);
  }
  if (has('previous_consultations') && fallback.previousConsultations?.length) {
    snapshot.previousConsultations = fallback.previousConsultations
      .slice(0, 3)
      .map((item) => sanitizeString(item, 180));
  }
  return snapshot;
};

// ---------------------------------------------------------------
// Consultations
// ---------------------------------------------------------------

export interface CreateConsultationInput {
  farmerId: string;
  farmerName: string;
  expert: ExpertPublic;
  urgency: ConsultationUrgency;
  category: string;
  crop: string;
  symptoms: string;
  lang: string;
  district: string;
  upazila: string;
  gps?: { lat: number; lng: number };
  consentScope: ConsentKey[];
  consentSnapshot: ConsentSnapshot;
  seed?: ExpertRequestSeed;
}

export const createConsultation = async (input: CreateConsultationInput): Promise<string> => {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const expiresMs = consentExpiryMs(nowMs);
  const slaMs = computeSlaDueMs(input.urgency, nowMs);

  const shareFarmProfile = input.consentScope.includes('farm_profile');
  const payload = {
    farmerId: input.farmerId,
    farmerName: sanitizeString(input.farmerName, 128),
    expertId: input.expert.uid,
    expertName: sanitizeString(input.expert.displayName, 128),
    status: 'requested' as const,
    urgency: input.urgency,
    category: sanitizeString(input.category, 64),
    // The parent document is listable metadata. Keep crop/location off it
    // unless the farmer explicitly shared the farm profile.
    crop: shareFarmProfile ? sanitizeString(input.crop || '', 64) : '',
    lang: input.lang === 'en' ? 'en' : 'bn',
    district: shareFarmProfile ? sanitizeString(input.district || '', 64) : '',
    upazila: shareFarmProfile ? sanitizeString(input.upazila || '', 64) : '',
    consentScope: input.consentScope.slice(0, 12),
    consentGrantedAt: now,
    consentExpiresAt: new Date(expiresMs).toISOString(),
    consentExpiresAtMs: expiresMs,
    consentRevoked: false,
    requestedAt: now,
    slaDueAt: new Date(slaMs).toISOString(),
    slaDueAtMs: slaMs,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await addDoc(collection(db, 'consultations'), payload);
  // Case details are a protected subdocument: the phone number, diagnosis
  // snapshot and farmer's description never sit on the listable parent doc.
  await setDoc(doc(db, 'consultations', ref.id, 'case', 'current'), {
    symptoms: sanitizeString(input.symptoms, 2000),
    consentSnapshot: input.consentSnapshot,
    ...(input.consentScope.includes('gps') && input.gps ? { gps: input.gps } : {}),
    createdAt: now,
    updatedAt: now,
  });
  await recordEvent(ref.id, 'consultation_requested', input.farmerId, 'farmer', `অনুরোধ: ${input.category}`);
  return ref.id;
};

export const getConsultation = async (id: string): Promise<Consultation | null> => {
  const snap = await getDoc(doc(db, 'consultations', id));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Consultation), id: snap.id };
};

export const getConsultationCase = async (id: string): Promise<ConsultationCase | null> => {
  const snap = await getDoc(doc(db, 'consultations', id, 'case', 'current'));
  if (!snap.exists()) return null;
  return { ...(snap.data() as ConsultationCase), id: snap.id };
};

const sortConsultations = (list: Consultation[]): Consultation[] =>
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

export const watchFarmerConsultations = (
  farmerId: string,
  cb: (items: Consultation[]) => void
): (() => void) =>
  onSnapshot(
    query(collection(db, 'consultations'), where('farmerId', '==', farmerId)),
    (snap) => cb(sortConsultations(snap.docs.map((d) => ({ ...(d.data() as Consultation), id: d.id })))),
    (err) => console.warn('Consultation watch (farmer) failed:', err?.code || err)
  );

export const watchExpertConsultations = (
  expertId: string,
  cb: (items: Consultation[]) => void,
  onError?: (error: any) => void
): (() => void) =>
  onSnapshot(
    query(
      collection(db, 'consultations'),
      where('expertId', '==', expertId),
      where('consentRevoked', '==', false)
    ),
    // Firestore cannot apply request.time as a list-query filter. The parent
    // document is non-sensitive metadata; case details and phone numbers are
    // gated per-read by the protected case subdocument. Hide expired items in
    // the UI so the expert queue only shows live consent.
    (snap) =>
      cb(
        sortConsultations(
          snap.docs
            .map((d) => ({ ...(d.data() as Consultation), id: d.id }))
            .filter((c) => (c.consentExpiresAtMs || 0) > Date.now())
        )
      ),
    (err) => {
      console.warn('Consultation watch (expert) failed:', err?.code || err);
      onError?.(err);
    }
  );

export const watchConsultation = (
  id: string,
  cb: (item: Consultation | null) => void,
  onError?: (error: any) => void
): (() => void) =>
  onSnapshot(
    doc(db, 'consultations', id),
    (snap) => cb(snap.exists() ? { ...(snap.data() as Consultation), id: snap.id } : null),
    (err) => {
      console.warn('Consultation watch failed:', err?.code || err);
      onError?.(err);
    }
  );

export const acceptConsultation = async (id: string, expertId: string): Promise<void> => {
  const now = nowIso();
  await updateDoc(doc(db, 'consultations', id), {
    status: 'accepted',
    acceptedAt: now,
    firstResponseAt: now,
    updatedAt: now,
  });
  await recordEvent(id, 'accepted', expertId, 'expert', 'বিশেষজ্ঞ অনুরোধ গ্রহণ করেছেন');
};

export const updateConsultationStatus = async (
  id: string,
  status: ConsultationStatus,
  actorId: string,
  actorRole: 'farmer' | 'expert'
): Promise<void> => {
  await updateDoc(doc(db, 'consultations', id), { status, updatedAt: nowIso() });
  await recordEvent(id, `status_${status}`, actorId, actorRole, '');
};

export const resolveConsultation = async (
  id: string,
  expertId: string,
  outcome: string,
  expertNotes: string
): Promise<void> => {
  const now = nowIso();
  await updateDoc(doc(db, 'consultations', id), {
    status: 'resolved',
    outcome: sanitizeString(outcome, 64),
    expertNotes: sanitizeString(expertNotes, 2000),
    closedAt: now,
    updatedAt: now,
  });
  await recordEvent(id, 'resolved', expertId, 'expert', sanitizeString(outcome, 120));
};

export const cancelConsultation = async (id: string, farmerId: string): Promise<void> => {
  await updateDoc(doc(db, 'consultations', id), {
    status: 'cancelled',
    closedAt: nowIso(),
    updatedAt: nowIso(),
  });
  await recordEvent(id, 'cancelled', farmerId, 'farmer', 'কৃষক অনুরোধ বাতিল করেছেন');
};

export const revokeConsent = async (id: string, farmerId: string): Promise<void> => {
  const now = nowIso();
  await updateDoc(doc(db, 'consultations', id), {
    consentRevoked: true,
    consentRevokedAt: now,
    updatedAt: now,
  });
  await recordEvent(id, 'consent_revoked', farmerId, 'farmer', 'কৃষক সম্মতি প্রত্যাহার করেছেন');
};

export const recordEvent = async (
  consultationId: string,
  type: string,
  actorId: string,
  actorRole: 'farmer' | 'expert' | 'system',
  note: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'consultations', consultationId, 'events'), {
      type: sanitizeString(type, 64),
      actorId,
      actorRole,
      note: sanitizeString(note, 500),
      createdAt: nowIso(),
    });
  } catch (e) {
    // Event logging must never break the primary action.
    console.warn('Event log failed:', e);
  }
};

// ---------------------------------------------------------------
// Messages
// ---------------------------------------------------------------

export interface OutgoingMessage {
  senderId: string;
  senderRole: 'farmer' | 'expert';
  type: ConsultationMessageType;
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  advisory?: ConsultationAdvisory;
}

export const watchMessages = (
  consultationId: string,
  cb: (items: ConsultationMessage[]) => void,
  onError?: (error: any) => void
): (() => void) =>
  onSnapshot(
    collection(db, 'consultations', consultationId, 'messages'),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ ...(d.data() as ConsultationMessage), id: d.id }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      cb(items);
    },
    (err) => {
      console.warn('Message watch failed:', err?.code || err);
      onError?.(err);
    }
  );

export const sendMessage = async (
  consultationId: string,
  message: OutgoingMessage
): Promise<string> => {
  const createdAt = nowIso();
  const payload: Record<string, unknown> = {
    senderId: message.senderId,
    senderRole: message.senderRole,
    type: message.type,
    createdAt,
  };
  if (message.text) payload.text = sanitizeString(message.text, 4000);
  if (message.audioUrl) payload.audioUrl = message.audioUrl;
  if (message.imageUrl) payload.imageUrl = message.imageUrl;
  if (message.advisory) {
    // Firestore rejects undefined map values unless ignoreUndefinedProperties
    // is enabled; strip optional advisory fields that the expert left blank.
    payload.advisory = Object.fromEntries(
      Object.entries(message.advisory).filter(([, value]) => value !== undefined)
    );
  }

  const ref = await addDoc(collection(db, 'consultations', consultationId, 'messages'), payload);

  // Keep parent counters fresh for unread badges.
  const updates: Record<string, unknown> = {
    lastMessageAt: createdAt,
    lastMessageSenderRole: message.senderRole,
    updatedAt: createdAt,
  };
  if (message.senderRole === 'farmer') updates.lastFarmerMessageAt = createdAt;
  else updates.lastExpertMessageAt = createdAt;
  if (message.senderRole === 'expert' && message.type !== 'system') updates.firstResponseAt = createdAt;

  // The message itself is already stored — the parent counters are only a
  // convenience for the unread badge. If this write fails the farmer must not
  // be told the message failed: they would retype and resend it, creating a
  // duplicate. Log it and move on.
  try {
    await updateDoc(doc(db, 'consultations', consultationId), updates);
  } catch (error) {
    console.warn('Consultation counters were not refreshed:', error);
  }

  return ref.id;
};

export const markMessagesRead = async (
  consultationId: string,
  message: ConsultationMessage,
  readerId: string
): Promise<void> => {
  if (message.senderId === readerId || message.readAt) return;
  try {
    await updateDoc(doc(db, 'consultations', consultationId, 'messages', message.id), {
      readAt: nowIso(),
    });
  } catch (e) {
    console.warn('Mark read failed:', e);
  }
};

// ---------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------

export const submitRating = async (
  consultation: Consultation,
  farmerId: string,
  rating: number,
  feedback: string
): Promise<void> => {
  const ts = nowIso();
  const safeRating = Math.max(1, Math.min(5, Math.round(rating)));
  const safeFeedback = sanitizeString(feedback || '', 1000);
  const batch = writeBatch(db);
  // Deterministic review id = one review per consultation.
  batch.set(doc(db, 'expert_reviews', consultation.id), {
    consultationId: consultation.id,
    expertId: consultation.expertId,
    farmerId,
    rating: safeRating,
    comment: safeFeedback,
    createdAt: ts,
  });
  batch.update(doc(db, 'consultations', consultation.id), {
    farmerRating: safeRating,
    farmerFeedback: safeFeedback,
    updatedAt: ts,
  });
  await batch.commit();
};

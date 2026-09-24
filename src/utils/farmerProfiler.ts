import { doc, getDoc, setDoc, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeString, safeStorage } from './security';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';

export interface FarmerProfileData {
  userId: string;
  fullName: string;
  creditReadinessScore: number; // 0 - 100
  insuranceRiskTier: 'Low' | 'Moderate' | 'High';
  primaryCrop: string;
  cropsGrown: string[];
  totalLandDecimals: number;
  locationDistrict: string;
  locationUpazila: string;
  soilType: string;
  irrigationType: string;
  totalSessionsCompleted: number;
  totalDiagnoses: number;
  lastInteractionSummary: string;
  lastInteractionDate: string;
  keyInsights: string[];
  updatedAt: string;
  createdAt: string;
}

export interface FarmerTimelineEventData {
  id?: string;
  userId: string;
  eventType: 'voice_consultation' | 'crop_diagnosis' | 'weather_alert' | 'smart_grading' | 'market_mandi' | 'planting_intent';
  title: string;
  summary: string;
  keyFacts: string[];
  confidenceScore?: number;
  createdAt: string;
}

export interface RecordEventParams {
  userId: string;
  fullName?: string;
  eventType: FarmerTimelineEventData['eventType'];
  title: string;
  summary: string;
  keyFacts: string[];
  crop?: string;
  landDecimals?: number;
  district?: string;
  upazila?: string;
  soilType?: string;
  irrigationType?: string;
  insight?: string;
}

export interface CreditScorePillars {
  farmProvenance: number; // Max 20: Land ownership, geo-location, soil profile
  surveillanceDiligence: number; // Max 25: Advisory consultations & pest surveillance
  cropViability: number; // Max 20: Primary crop & diversification/rotation
  qualityAndMarket: number; // Max 15: Post-harvest grading & market linkage
  longitudinalTrackRecord: number; // Max 20: Weather risk response & interaction history
}

export interface CreditScoreResult {
  score: number;
  riskTier: 'Low' | 'Moderate' | 'High';
  grade: string;
  recommendedLoanLimit: number;
  pillars: CreditScorePillars;
}

// Compute credit readiness score dynamically based on progressive behavior
// Strictly aligned with Bangladesh Bank Ag-Credit & MFI Micro-Lending Standards
export function calculateCreditScore(profile: {
  totalSessionsCompleted: number;
  totalDiagnoses: number;
  cropsCount: number;
  hasLandData: boolean;
  hasLocationData?: boolean;
  hasSoilOrIrrigation?: boolean;
  hasCertificates: boolean;
  hasWeatherAction?: boolean;
  totalEventsCount?: number;
}): CreditScoreResult {
  const totalActivity = (profile.totalSessionsCompleted || 0) + 
                        (profile.totalDiagnoses || 0) + 
                        (profile.totalEventsCount || 0);
  
  // Strict zero-data policy: If no data provided and zero activity, score is strictly 0
  if (totalActivity === 0 && !profile.hasLandData && (!profile.cropsCount || profile.cropsCount === 0) && !profile.hasCertificates) {
    return {
      score: 0,
      riskTier: 'High',
      grade: 'Tier 3 (Unprofiled)',
      recommendedLoanLimit: 0,
      pillars: {
        farmProvenance: 0,
        surveillanceDiligence: 0,
        cropViability: 0,
        qualityAndMarket: 0,
        longitudinalTrackRecord: 0
      }
    };
  }

  // Pillar 1: Farm Ownership & Provenance (Max 20 pts)
  let farmProvenance = 0;
  if (profile.hasLandData) farmProvenance += 10; // Land cultivated & recorded
  if (profile.hasLocationData !== false && (profile.hasLandData || profile.cropsCount > 0)) farmProvenance += 5; // Geo-district / Upazila
  if (profile.hasSoilOrIrrigation) farmProvenance += 5; // Documented soil & irrigation infrastructure
  farmProvenance = Math.min(20, farmProvenance);

  // Pillar 2: Advisory Diligence & Surveillance Discipline (Max 25 pts)
  // Non-gaming capped: +3 pts per distinct consultation (max 12 pts)
  const sessionsPoints = Math.min(12, (profile.totalSessionsCompleted || 0) * 3);
  // Pest & Disease Diagnostic surveillance: +3 pts per verified scan (max 13 pts)
  const diagnosisPoints = Math.min(13, (profile.totalDiagnoses || 0) * 3);
  const surveillanceDiligence = Math.min(25, sessionsPoints + diagnosisPoints);

  // Pillar 3: Crop Diversification & Economic Viability (Max 20 pts)
  let cropViability = 0;
  if (profile.cropsCount > 0) cropViability += 10; // Registered primary crop
  if (profile.cropsCount > 1) cropViability += 10; // Crop diversification / multi-cropping
  cropViability = Math.min(20, cropViability);

  // Pillar 4: Post-Harvest Quality & Market Readiness (Max 15 pts)
  let qualityAndMarket = 0;
  if (profile.hasCertificates) qualityAndMarket += 8; // Verified quality grading / inspection
  if (profile.totalEventsCount && profile.totalEventsCount >= 3) qualityAndMarket += 7; // Market connection / active trading
  qualityAndMarket = Math.min(15, qualityAndMarket);

  // Pillar 5: Climate Resilience & Longitudinal Track Record (Max 20 pts)
  let longitudinalTrackRecord = 0;
  if (profile.hasWeatherAction) longitudinalTrackRecord += 8; // Climate risk alert action verified
  // Multi-event compounding timeline (+3 pts per recorded timeline event, max 12 pts)
  const timelinePoints = Math.min(12, ((profile.totalEventsCount || 0) > 0 ? (profile.totalEventsCount || 0) : totalActivity) * 3);
  longitudinalTrackRecord = Math.min(20, longitudinalTrackRecord + timelinePoints);

  const totalScore = Math.min(100, Math.max(0, 
    farmProvenance + 
    surveillanceDiligence + 
    cropViability + 
    qualityAndMarket + 
    longitudinalTrackRecord
  ));

  let riskTier: 'Low' | 'Moderate' | 'High' = 'High';
  let grade = 'Tier 3 (Baseline)';
  let recommendedLoanLimit = 0;

  if (totalScore >= 75) {
    riskTier = 'Low';
    grade = 'Tier 0 (Prime Pre-Approved)';
    recommendedLoanLimit = 150000;
  } else if (totalScore >= 55) {
    riskTier = 'Moderate';
    grade = 'Tier 1 (Crop Loan Eligible)';
    recommendedLoanLimit = 50000;
  } else if (totalScore >= 35) {
    riskTier = 'Moderate';
    grade = 'Tier 2 (Micro-Input Eligible)';
    recommendedLoanLimit = 20000;
  } else {
    riskTier = 'High';
    grade = 'Tier 3 (Baseline / Onboarding)';
    recommendedLoanLimit = 0;
  }

  return {
    score: totalScore,
    riskTier,
    grade,
    recommendedLoanLimit,
    pillars: {
      farmProvenance,
      surveillanceDiligence,
      cropViability,
      qualityAndMarket,
      longitudinalTrackRecord
    }
  };
}

// Local Storage helpers for guest / fast offline demo mode
const LOCAL_PROFILE_KEY = (uid: string) => `krishi_farmer_profile_${uid}`;
const LOCAL_EVENTS_KEY = (uid: string) => `krishi_farmer_events_${uid}`;

export async function fetchFarmerProfile(userId: string): Promise<FarmerProfileData | null> {
  if (!userId) return null;

  try {
    const docRef = doc(db, 'farmer_profiles', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as FarmerProfileData;
      // Sync local cache
      try {
        localStorage.setItem(LOCAL_PROFILE_KEY(userId), JSON.stringify(data));
      } catch (e) {}
      return data;
    }
  } catch (error) {
    console.warn("Firestore profile fetch error, checking local storage:", error);
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(LOCAL_PROFILE_KEY(userId));
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return null;
}

export async function fetchFarmerTimeline(userId: string): Promise<FarmerTimelineEventData[]> {
  if (!userId) return [];

  try {
    const q = query(
      collection(db, 'farmer_timeline_events'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const snap = await getDocs(q);
    const events: FarmerTimelineEventData[] = [];
    snap.forEach(docSnap => {
      events.push({ id: docSnap.id, ...docSnap.data() } as FarmerTimelineEventData);
    });

    if (events.length > 0) {
      try {
        localStorage.setItem(LOCAL_EVENTS_KEY(userId), JSON.stringify(events));
      } catch (e) {}
      return events;
    }
  } catch (error) {
    console.warn("Firestore timeline fetch error, checking local storage:", error);
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(LOCAL_EVENTS_KEY(userId));
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return [];
}

/**
 * Progressively compiles the farmer profile and logs a new event
 */
export async function recordFarmerInteractionEvent(params: RecordEventParams): Promise<{
  profile: FarmerProfileData;
  event: FarmerTimelineEventData;
}> {
  const cleanUserId = sanitizeString(params.userId, 128);
  const cleanFullName = params.fullName && params.fullName !== 'কৃষক ভাই (Farmer)' 
    ? sanitizeString(params.fullName, 128) 
    : '';
  const cleanTitle = sanitizeString(params.title, 256);
  const cleanSummary = sanitizeString(params.summary, 5000);
  const cleanKeyFacts = (Array.isArray(params.keyFacts) ? params.keyFacts : [])
    .map(f => sanitizeString(f, 250))
    .slice(0, 20);
  const cleanCrop = params.crop ? sanitizeString(params.crop, 100) : undefined;
  const cleanDistrict = params.district ? sanitizeString(params.district, 100) : undefined;
  const cleanUpazila = params.upazila ? sanitizeString(params.upazila, 100) : undefined;
  const cleanSoilType = params.soilType ? sanitizeString(params.soilType, 100) : undefined;
  const cleanIrrigationType = params.irrigationType ? sanitizeString(params.irrigationType, 100) : undefined;
  const cleanInsight = params.insight ? sanitizeString(params.insight, 300) : undefined;
  const cleanLandDecimals = typeof params.landDecimals === 'number' && params.landDecimals > 0 && params.landDecimals < 100000 
    ? params.landDecimals 
    : undefined;

  const now = new Date().toISOString();

  // 1. Prepare the timeline event with validated bounds
  const newEvent: FarmerTimelineEventData = {
    userId: cleanUserId,
    eventType: params.eventType,
    title: cleanTitle,
    summary: cleanSummary,
    keyFacts: cleanKeyFacts,
    confidenceScore: 0.95,
    createdAt: now
  };

  // 2. Fetch existing profile or create initial completely blank/accurate baseline
  let existingProfile = await fetchFarmerProfile(cleanUserId);

  const initialProfile: FarmerProfileData = {
    userId: cleanUserId,
    fullName: cleanFullName,
    creditReadinessScore: 0,
    insuranceRiskTier: 'High',
    primaryCrop: cleanCrop || '',
    cropsGrown: cleanCrop ? [cleanCrop] : [],
    totalLandDecimals: cleanLandDecimals || 0,
    locationDistrict: cleanDistrict || '',
    locationUpazila: cleanUpazila || '',
    soilType: cleanSoilType || '',
    irrigationType: cleanIrrigationType || '',
    totalSessionsCompleted: 0,
    totalDiagnoses: 0,
    lastInteractionSummary: cleanSummary,
    lastInteractionDate: now,
    keyInsights: cleanInsight ? [cleanInsight] : [],
    updatedAt: now,
    createdAt: now
  };

  const profile = existingProfile ? { ...existingProfile } : initialProfile;

  // Progressive profile compounding without hallucinated overrides
  if (cleanFullName && !profile.fullName) {
    profile.fullName = cleanFullName;
  }
  if (cleanCrop && !profile.cropsGrown.includes(cleanCrop)) {
    profile.cropsGrown.push(cleanCrop);
  }
  if (cleanCrop && !profile.primaryCrop) {
    profile.primaryCrop = cleanCrop;
  }
  if (cleanLandDecimals && (!profile.totalLandDecimals || profile.totalLandDecimals === 0)) {
    profile.totalLandDecimals = cleanLandDecimals;
  }
  if (cleanDistrict && !profile.locationDistrict) profile.locationDistrict = cleanDistrict;
  if (cleanUpazila && !profile.locationUpazila) profile.locationUpazila = cleanUpazila;
  if (cleanSoilType && !profile.soilType) profile.soilType = cleanSoilType;
  if (cleanIrrigationType && !profile.irrigationType) profile.irrigationType = cleanIrrigationType;

  if (params.eventType === 'voice_consultation') {
    profile.totalSessionsCompleted = (profile.totalSessionsCompleted || 0) + 1;
  }
  if (params.eventType === 'crop_diagnosis') {
    profile.totalDiagnoses = (profile.totalDiagnoses || 0) + 1;
  }

  if (cleanInsight && !profile.keyInsights.includes(cleanInsight)) {
    profile.keyInsights = [cleanInsight, ...profile.keyInsights.slice(0, 5)];
  }

  const existingEvents = await fetchFarmerTimeline(cleanUserId);
  const totalEventsCount = existingEvents.length + 1;
  const hasWeatherAction = params.eventType === 'weather_alert' || existingEvents.some(e => e.eventType === 'weather_alert');
  const hasSmartGrading = params.eventType === 'smart_grading' || existingEvents.some(e => e.eventType === 'smart_grading');

  // Recalculate credit and insurance metrics based strictly on actual usage
  const creditResult = calculateCreditScore({
    totalSessionsCompleted: profile.totalSessionsCompleted,
    totalDiagnoses: profile.totalDiagnoses,
    cropsCount: profile.cropsGrown.length,
    hasLandData: profile.totalLandDecimals > 0,
    hasLocationData: Boolean(profile.locationDistrict || profile.locationUpazila),
    hasSoilOrIrrigation: Boolean(profile.soilType || profile.irrigationType),
    hasCertificates: hasSmartGrading || profile.creditReadinessScore > 65,
    hasWeatherAction,
    totalEventsCount
  });

  profile.creditReadinessScore = creditResult.score;
  profile.insuranceRiskTier = creditResult.riskTier;
  profile.lastInteractionSummary = cleanSummary;
  profile.lastInteractionDate = now;
  profile.updatedAt = now;

  // 3. Save to Firestore
  try {
    await addDoc(collection(db, 'farmer_timeline_events'), newEvent);
  } catch (error) {
    console.warn("Firestore error saving timeline event, continuing locally:", error);
  }

  try {
    const profileRef = doc(db, 'farmer_profiles', cleanUserId);
    await setDoc(profileRef, profile, { merge: true });
  } catch (error) {
    console.warn("Firestore error saving farmer profile, continuing locally:", error);
  }

  // 4. Update local cache safely
  try {
    safeStorage.setItem(LOCAL_PROFILE_KEY(cleanUserId), profile);
    const cachedEvents = await fetchFarmerTimeline(cleanUserId);
    const updatedEvents = [newEvent, ...cachedEvents.filter(e => e.title !== newEvent.title)];
    safeStorage.setItem(LOCAL_EVENTS_KEY(cleanUserId), updatedEvents);
  } catch (e) {}

  return { profile, event: newEvent };
}

/**
 * Manually update farmer profile with real user-provided farm data
 */
export async function updateFarmerProfileManual(
  userId: string,
  updates: Partial<FarmerProfileData>
): Promise<FarmerProfileData> {
  const cleanUserId = sanitizeString(userId, 128);
  const existing = await fetchFarmerProfile(cleanUserId);
  const now = new Date().toISOString();

  const profile: FarmerProfileData = existing ? { ...existing } : {
    userId: cleanUserId,
    fullName: '',
    creditReadinessScore: 0,
    insuranceRiskTier: 'High',
    primaryCrop: '',
    cropsGrown: [],
    totalLandDecimals: 0,
    locationDistrict: '',
    locationUpazila: '',
    soilType: '',
    irrigationType: '',
    totalSessionsCompleted: 0,
    totalDiagnoses: 0,
    lastInteractionSummary: '',
    lastInteractionDate: now,
    keyInsights: [],
    updatedAt: now,
    createdAt: now
  };

  if (updates.fullName !== undefined) profile.fullName = sanitizeString(updates.fullName, 128);
  if (updates.locationDistrict !== undefined) profile.locationDistrict = sanitizeString(updates.locationDistrict, 100);
  if (updates.locationUpazila !== undefined) profile.locationUpazila = sanitizeString(updates.locationUpazila, 100);
  if (updates.primaryCrop !== undefined) {
    const c = sanitizeString(updates.primaryCrop, 100);
    profile.primaryCrop = c;
    if (c && !profile.cropsGrown.includes(c)) {
      profile.cropsGrown.push(c);
    }
  }
  if (updates.totalLandDecimals !== undefined) {
    profile.totalLandDecimals = typeof updates.totalLandDecimals === 'number' ? Math.max(0, updates.totalLandDecimals) : 0;
  }
  if (updates.soilType !== undefined) profile.soilType = sanitizeString(updates.soilType, 100);
  if (updates.irrigationType !== undefined) profile.irrigationType = sanitizeString(updates.irrigationType, 100);

  const existingEvents = await fetchFarmerTimeline(cleanUserId);
  const totalEventsCount = existingEvents.length;
  const hasWeatherAction = existingEvents.some(e => e.eventType === 'weather_alert');
  const hasSmartGrading = existingEvents.some(e => e.eventType === 'smart_grading');

  // Recalculate credit score with updated farm data
  const creditResult = calculateCreditScore({
    totalSessionsCompleted: profile.totalSessionsCompleted || 0,
    totalDiagnoses: profile.totalDiagnoses || 0,
    cropsCount: profile.cropsGrown.length,
    hasLandData: profile.totalLandDecimals > 0,
    hasLocationData: Boolean(profile.locationDistrict || profile.locationUpazila),
    hasSoilOrIrrigation: Boolean(profile.soilType || profile.irrigationType),
    hasCertificates: hasSmartGrading || profile.creditReadinessScore > 65,
    hasWeatherAction,
    totalEventsCount
  });

  profile.creditReadinessScore = creditResult.score;
  profile.insuranceRiskTier = creditResult.riskTier;
  profile.updatedAt = now;

  try {
    const profileRef = doc(db, 'farmer_profiles', cleanUserId);
    await setDoc(profileRef, profile, { merge: true });
  } catch (error) {
    console.warn("Firestore save profile manual error:", error);
  }

  try {
    safeStorage.setItem(LOCAL_PROFILE_KEY(cleanUserId), profile);
  } catch (e) {}

  return profile;
}

/**
 * Reset farmer profile to a completely blank slate (removes all demo or test data)
 */
export async function resetFarmerProfile(userId: string): Promise<FarmerProfileData> {
  const cleanUserId = sanitizeString(userId, 128);
  const now = new Date().toISOString();

  const emptyProfile: FarmerProfileData = {
    userId: cleanUserId,
    fullName: '',
    creditReadinessScore: 0,
    insuranceRiskTier: 'High',
    primaryCrop: '',
    cropsGrown: [],
    totalLandDecimals: 0,
    locationDistrict: '',
    locationUpazila: '',
    soilType: '',
    irrigationType: '',
    totalSessionsCompleted: 0,
    totalDiagnoses: 0,
    lastInteractionSummary: '',
    lastInteractionDate: now,
    keyInsights: [],
    updatedAt: now,
    createdAt: now
  };

  try {
    const profileRef = doc(db, 'farmer_profiles', cleanUserId);
    await setDoc(profileRef, emptyProfile);
  } catch (error) {
    console.warn("Firestore reset profile error:", error);
  }

  try {
    localStorage.removeItem(LOCAL_PROFILE_KEY(cleanUserId));
    localStorage.removeItem(LOCAL_EVENTS_KEY(cleanUserId));
  } catch (e) {}

  return emptyProfile;
}

/**
 * Pre-populate 4 progressive interactions for demo/investor presentation
 */
export async function seedDemoFarmerProfile(userId: string, userName: string = 'আব্দুল করিম (Abdul Karim)'): Promise<FarmerProfileData> {
  const eventsToSeed: RecordEventParams[] = [
    {
      userId,
      fullName: userName,
      eventType: 'crop_diagnosis',
      title: 'BRRI-49 আমন ধান পাতা পোড়া রোগ শনাক্তকরণ',
      summary: 'ধান গাছের পাতায় বাদামি দাগ ও ব্যাকটেরিয়াল ব্লাইটের লক্ষণ পাওয়া গেছে। নিম তেল ও জৈব ছত্রাকনাশক স্প্রে করার পরামর্শ দেওয়া হয়েছে।',
      keyFacts: [
        'ফসল: আমন ধান (BRRI-49)',
        'রোগের মাত্রা: মাঝারি (Moderate)',
        'পরামর্শ: ট্রাইকোডার্মা ও পটাশ সার সমন্বয়'
      ],
      crop: 'আমন ধান (Aman Rice)',
      landDecimals: 80,
      district: 'কক্সবাজার (Cox\'s Bazar)',
      upazila: 'চকরিয়া (Chakaria)',
      insight: 'জৈব ছত্রাকনাশক ব্যবহারে আগ্রহী ও সময়মতো রোগ শনাক্ত করেছেন।'
    },
    {
      userId,
      fullName: userName,
      eventType: 'voice_consultation',
      title: 'লাইভ ভিডিও ও ভয়েস সেশন: রবি মৌসুমের তরমুজ চাষ',
      summary: 'চকরিয়ার মাতামুহুরী চরে ২ বিঘা জমিতে ব্ল্যাক বেরি জাতের তরমুজ চাষের জন্য সেচ ও মালচিং পেপার ব্যবহার নিয়ে ১০ মিনিটের লাইভ পরামর্শ সম্পন্ন।',
      keyFacts: [
        'পরবর্তী ফসল: তরমুজ (Watermelon)',
        'জমির পরিমাণ: ২ বিঘা (৬৬ শতক)',
        'সেচ ব্যবস্থা: লো-লিফট পাম্প ও নদী খাল'
      ],
      crop: 'তরমুজ (Watermelon)',
      landDecimals: 66,
      district: 'কক্সবাজার',
      upazila: 'চকরিয়া',
      insight: 'উচ্চ মূল্যের রবি ফসল (High-value Cash Crop) উৎপাদনে সক্ষম।'
    },
    {
      userId,
      fullName: userName,
      eventType: 'weather_alert',
      title: 'বঙ্গোপসাগরে নিম্নচাপ ও আগাম জলাবদ্ধতা সতর্কবার্তা যাচাই',
      summary: '৪৮ ঘণ্টার মধ্যে ভারী বর্ষণের পূর্বাভাস দেখে নিচু জমির আমন ধানের পানি নিষ্কাশনের ড্রেন প্রস্তুত করেছেন এবং স্প্রে স্থগিত রেখেছেন।',
      keyFacts: [
        'আবহাওয়া ঝুঁকি: ভারী বৃষ্টি ও জলাবদ্ধতা',
        'গৃহীত পদক্ষেপ: ড্রেন পরিষ্কার ও আগাম পানি নিষ্কাশন',
        'জলবায়ু সচেতনতা স্কোর: উচ্চ (High)'
      ],
      insight: 'আবহাওয়া সতর্কবার্তা দেখে দ্রুত পদক্ষেপ নেন — জলবায়ু ঝুঁকি হ্রাস রেটিং ৯০%।'
    },
    {
      userId,
      fullName: userName,
      eventType: 'smart_grading',
      title: 'স্মার্ট গ্রেড সনদ: প্রিমিয়াম কোয়ালিটি আমন ধান',
      summary: 'কাটা ধানের আর্দ্রতা ও দানার ঘনত্ব পরীক্ষা করে "Grade A+" সনদ প্রদান করা হয়েছে। আনুমানিক বাজারমূল্য ১,৩৫০ টাকা/মণ।',
      keyFacts: [
        'মান সনদ: Grade A+ (Export / Mill Quality)',
        'আনুমানিক মূল্য: ১,৩৫০ ৳/মণ',
        'বাজার সংযোগ: স্থানীয় পাইকারি আড়ত প্রস্তুত'
      ],
      insight: 'উচ্চমানের উৎপাদিত ফসল বিক্রয়ে সক্ষম, ঋণ পরিশোধের সক্ষমতা সন্তোষজনক।'
    }
  ];

  let lastProfile: FarmerProfileData | null = null;
  for (const evt of eventsToSeed) {
    const res = await recordFarmerInteractionEvent(evt);
    lastProfile = res.profile;
  }

  return lastProfile!;
}

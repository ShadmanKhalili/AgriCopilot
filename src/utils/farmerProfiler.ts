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

// Compute credit readiness score dynamically based on progressive behavior
export function calculateCreditScore(profile: {
  totalSessionsCompleted: number;
  totalDiagnoses: number;
  cropsCount: number;
  hasLandData: boolean;
  hasCertificates: boolean;
}): { score: number; riskTier: 'Low' | 'Moderate' | 'High' } {
  let score = 40; // Base onboarding baseline

  // Consistency & Activity (up to +25)
  score += Math.min(25, profile.totalSessionsCompleted * 6);

  // Proactive Crop Health Surveillance (up to +20)
  score += Math.min(20, profile.totalDiagnoses * 5);

  // Farm Diversification & Land Transparency (up to +15)
  if (profile.cropsCount > 1) score += 8;
  if (profile.hasLandData) score += 7;

  // Commercial Verification (Smart Grade / Mandi)
  if (profile.hasCertificates) score += 10;

  score = Math.min(96, Math.max(35, score));

  let riskTier: 'Low' | 'Moderate' | 'High' = 'High';
  if (score >= 75) {
    riskTier = 'Low';
  } else if (score >= 55) {
    riskTier = 'Moderate';
  }

  return { score, riskTier };
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
  const cleanFullName = sanitizeString(params.fullName || 'কৃষক ভাই (Farmer)', 128);
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
    confidenceScore: 0.92,
    createdAt: now
  };

  // 2. Fetch existing profile or create initial baseline
  let existingProfile = await fetchFarmerProfile(cleanUserId);

  const initialProfile: FarmerProfileData = {
    userId: cleanUserId,
    fullName: cleanFullName,
    creditReadinessScore: 45,
    insuranceRiskTier: 'Moderate',
    primaryCrop: cleanCrop || 'ধান (Rice / Paddy)',
    cropsGrown: cleanCrop ? [cleanCrop] : ['ধান (Paddy)'],
    totalLandDecimals: cleanLandDecimals || 66, // default ~2 bighas in BD
    locationDistrict: cleanDistrict || 'কক্সবাজার (Cox\'s Bazar)',
    locationUpazila: cleanUpazila || 'চকরিয়া (Chakaria)',
    soilType: cleanSoilType || 'পলি দোআঁশ (Alluvial Loam)',
    irrigationType: cleanIrrigationType || 'ভূগর্ভস্থ সেচ (Shallow Tubewell)',
    totalSessionsCompleted: 0,
    totalDiagnoses: 0,
    lastInteractionSummary: cleanSummary,
    lastInteractionDate: now,
    keyInsights: cleanInsight ? [cleanInsight] : ['নিয়মিত পরামর্শ নিচ্ছেন (Active consultation user)'],
    updatedAt: now,
    createdAt: now
  };

  const profile = existingProfile ? { ...existingProfile } : initialProfile;

  // Progressive profile compounding
  if (cleanFullName && cleanFullName !== 'কৃষক ভাই (Farmer)') {
    profile.fullName = cleanFullName;
  }
  if (cleanCrop && !profile.cropsGrown.includes(cleanCrop)) {
    profile.cropsGrown.push(cleanCrop);
  }
  if (cleanCrop && (!profile.primaryCrop || profile.primaryCrop === 'ধান (Rice / Paddy)')) {
    profile.primaryCrop = cleanCrop;
  }
  if (cleanLandDecimals) {
    profile.totalLandDecimals = cleanLandDecimals;
  }
  if (cleanDistrict) profile.locationDistrict = cleanDistrict;
  if (cleanUpazila) profile.locationUpazila = cleanUpazila;
  if (cleanSoilType) profile.soilType = cleanSoilType;
  if (cleanIrrigationType) profile.irrigationType = cleanIrrigationType;

  if (params.eventType === 'voice_consultation') {
    profile.totalSessionsCompleted = (profile.totalSessionsCompleted || 0) + 1;
  }
  if (params.eventType === 'crop_diagnosis') {
    profile.totalDiagnoses = (profile.totalDiagnoses || 0) + 1;
  }

  if (cleanInsight && !profile.keyInsights.includes(cleanInsight)) {
    profile.keyInsights = [cleanInsight, ...profile.keyInsights.slice(0, 5)];
  }

  // Recalculate credit and insurance metrics
  const { score, riskTier } = calculateCreditScore({
    totalSessionsCompleted: profile.totalSessionsCompleted,
    totalDiagnoses: profile.totalDiagnoses,
    cropsCount: profile.cropsGrown.length,
    hasLandData: profile.totalLandDecimals > 0,
    hasCertificates: params.eventType === 'smart_grading' || profile.creditReadinessScore > 65
  });

  profile.creditReadinessScore = score;
  profile.insuranceRiskTier = riskTier;
  profile.lastInteractionSummary = cleanSummary;
  profile.lastInteractionDate = now;
  profile.updatedAt = now;

  // 3. Save to Firestore
  try {
    // Add timeline event
    await addDoc(collection(db, 'farmer_timeline_events'), newEvent);
  } catch (error) {
    console.warn("Firestore error saving timeline event, continuing locally:", error);
  }

  try {
    // Upsert farmer profile
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

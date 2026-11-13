import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, Calculator, CheckCircle2, Database, HelpCircle, Loader2, MapPin, Navigation,
  Package, ScanSearch, Sparkles, TrendingUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firestore';
import { auth } from '../firebase';
import { getMarketInsights } from '../services/ai';
import { fetchOfficialBulletin, type OfficialBulletin } from '../services/marketPrices';
import { aiErrorMessage } from '../utils/aiErrorMessage';
import { detectUserLocation } from '../utils/geolocation';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import toast from 'react-hot-toast';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';
import { saveCachedMarket, getCachedMarket, formatCacheAge } from '../utils/offlineCache';
import { useUiMode } from '../context/useUiMode';
import { useAppSettings } from '../context/AppSettingsContext';
import toBn from '../utils/banglaNum';
import Disclosure from './ui/Disclosure';
import BigActionButton from './ui/BigActionButton';
import OfficialPriceCard from './market/OfficialPriceCard';

const PRODUCE_TYPES = ['tomato', 'brinjal', 'paddy', 'betelLeaf', 'chili', 'watermelon', 'potato', 'onion'];

const PRODUCE_EMOJI: Record<string, string> = {
  tomato: '🍅',
  brinjal: '🍆',
  paddy: '🌾',
  betelLeaf: '🍃',
  chili: '🌶️',
  watermelon: '🍉',
  potato: '🥔',
  onion: '🧅',
};

/**
 * Areas the AI note can be asked about. Picking one only tells the AI where
 * the farmer is; it does not fetch any market's own prices.
 */
const AREA_PRESETS = [
  { nameBn: 'ঢাকা', nameEn: 'Dhaka', lat: 23.7516, lng: 90.3944 },
  { nameBn: 'চট্টগ্রাম', nameEn: 'Chattogram', lat: 22.3384, lng: 91.8391 },
  { nameBn: 'কক্সবাজার', nameEn: "Cox's Bazar", lat: 21.4272, lng: 92.0058 },
];

interface Props {
  lang: Language;
  persistedInsights?: any | null;
  setPersistedInsights?: (insights: any | null) => void;
  persistedProduce?: string;
  setPersistedProduce?: (produce: string) => void;
  onNavigateTab?: (tab: any, payload?: any) => void;
  globalLocation?: { latitude: number; longitude: number } | null;
  setGlobalLocation?: (loc: { latitude: number; longitude: number }) => void;
}

const finite = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export default function MarketConnect({
  lang,
  persistedInsights,
  setPersistedInsights,
  persistedProduce,
  setPersistedProduce,
  onNavigateTab,
  globalLocation,
  setGlobalLocation,
}: Props) {
  const { mainCrop } = useAppSettings();
  const uiMode = useUiMode();
  const simple = uiMode === 'simple';
  const bn = lang === 'bn';
  const t = translations[lang];

  const initialProduce =
    (persistedProduce && PRODUCE_TYPES.includes(persistedProduce) && persistedProduce) ||
    (mainCrop && PRODUCE_TYPES.includes(mainCrop) ? mainCrop : PRODUCE_TYPES[0]);

  const [produce, setProduce] = useState(initialProduce);
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<any | null>(persistedInsights || null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [marketCacheInfo, setMarketCacheInfo] = useState<{ isCached: boolean; timestamp: number } | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(globalLocation || null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [accuracy, setAccuracy] = useState<number | undefined>(undefined);
  const { user } = useAuth();
  const { canUse, canUsePremium, incrementUsage, incrementPremiumUsage, tier, currentUsage, limit } = useUsageTracking('market-connect');
  const [usePremium, setUsePremium] = useState(false);

  // The government bulletin: the one real price source on this screen.
  const [bulletin, setBulletin] = useState<OfficialBulletin | null>(null);
  const [bulletinStatus, setBulletinStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const loadBulletin = useCallback(() => {
    setBulletinStatus('loading');
    fetchOfficialBulletin()
      .then((result) => {
        setBulletin((previous) => result ?? previous);
        setBulletinStatus(result ? 'ready' : 'failed');
      })
      .catch(() => setBulletinStatus('failed'));
  }, []);
  useEffect(() => {
    loadBulletin();
  }, [loadBulletin]);

  const cropName = (key: string) => t.crops[key as keyof typeof t.crops] || key;

  // Sync with globalLocation if changed from outside
  useEffect(() => {
    if (globalLocation) setCoords(globalLocation);
  }, [globalLocation]);

  // Sync with persisted state
  useEffect(() => {
    if (setPersistedInsights) setPersistedInsights(insights);
  }, [insights, setPersistedInsights]);

  // Crop synchronisation.
  //
  // `produce` is the crop the farmer has selected; `persistedProduce` is the
  // parent's copy, which the AI doctor can change ("check the market for
  // brinjal"). `lastPushedProduce` records what this component last
  // published, which is what lets an external change be told apart from the
  // farmer's own choice.
  const lastPushedProduce = useRef<string | null>(null);
  // Monotonic id of the latest market request, so a slow response for the
  // previous crop cannot land after a newer one.
  const marketRequestRef = useRef(0);

  useEffect(() => {
    const parentCrop = persistedProduce || produce;

    if (lastPushedProduce.current === null) {
      lastPushedProduce.current = produce;
      setPersistedProduce?.(produce);
      return;
    }

    if (parentCrop !== lastPushedProduce.current && PRODUCE_TYPES.includes(parentCrop)) {
      lastPushedProduce.current = parentCrop;
      setProduce(parentCrop);
      return;
    }

    if (produce !== lastPushedProduce.current) {
      lastPushedProduce.current = produce;
      setPersistedProduce?.(produce);
    }
  }, [produce, persistedProduce, setPersistedProduce]);

  const locKeyFor = (c: { latitude: number; longitude: number } | null | undefined) =>
    `${c?.latitude?.toFixed(2) || 'default'}_${c?.longitude?.toFixed(2) || 'default'}`;

  useEffect(() => {
    // The AI note belongs to one crop in one place. Reload whenever either
    // changes, so one crop's note never sits under another crop's name.
    const cached = getCachedMarket(produce, locKeyFor(coords));
    if (cached && !cached.isFallback) {
      setInsights(cached.data);
      setMarketCacheInfo({ isCached: true, timestamp: cached.timestamp });
      setLastUpdated(new Date(cached.timestamp).toLocaleString());
    } else {
      setInsights(null);
      setMarketCacheInfo(null);
      setLastUpdated(null);
    }

    const handleForceRefresh = () => {
      handleGetInsights(produce, coords || undefined);
    };
    window.addEventListener('agri:force-refresh-cache', handleForceRefresh);
    return () => {
      window.removeEventListener('agri:force-refresh-cache', handleForceRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produce, coords]);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    try {
      const loc = await detectUserLocation();
      const newCoords = { latitude: loc.latitude, longitude: loc.longitude };
      setCoords(newCoords);
      setAccuracy(loc.accuracy);
      setGlobalLocation?.(newCoords);
      setIsDetectingLocation(false);
      if (loc.isFallback) {
        toast(bn ? 'আঞ্চলিক অবস্থান কেন্দ্র ব্যবহার করা হচ্ছে' : 'Using a regional centre', { icon: '📍' });
      } else {
        toast.success(bn ? 'অবস্থান পাওয়া গেছে' : 'Location found');
      }
    } catch (error: any) {
      console.warn('Location detection notice in MarketConnect:', error?.message || error?.code);
      setIsDetectingLocation(false);
      let msg = t.tooltips?.locationError || 'Failed to detect location.';
      if (error?.code === 1) {
        msg = bn ? 'জিপিএস অনুমতি দেওয়া হয়নি। ব্রাউজার লোকেশন অন করুন।' : 'Permission denied. Please allow location access in your browser.';
      }
      toast.error(msg);
    }
  };

  const handleSelectAreaPreset = (lat: number, lng: number) => {
    const newCoords = { latitude: lat, longitude: lng };
    setCoords(newCoords);
    setAccuracy(undefined);
    setGlobalLocation?.(newCoords);
  };

  const handleGetInsights = async (overrideProduce?: string, overrideCoords?: { latitude: number; longitude: number }) => {
    if (!canUse()) {
      toast.error(t.limitReached);
      return;
    }

    const targetProduce = overrideProduce || produce;
    const targetCoords = overrideCoords || coords;
    const requestId = ++marketRequestRef.current;

    setIsLoading(true);
    setInsights(null);

    let result = null;
    try {
      const produceName = translations.en.crops[targetProduce as keyof typeof translations.en.crops] || targetProduce;
      const isPremiumAnalysis = usePremium || tier === 'premium';
      result = await getMarketInsights(produceName, lang, isPremiumAnalysis, targetCoords || undefined);

      if (requestId === marketRequestRef.current) {
        setInsights(result);
        setPersistedInsights?.(result);
        setLastUpdated(new Date().toLocaleString());
        setMarketCacheInfo(null);
      }
      saveCachedMarket(targetProduce, locKeyFor(targetCoords), result);

      // The AI request may have just created this visitor's guest account, and `user`
      // still holds the value from before it. Saving under that would lose the record.
      const sessionUser = user ?? auth.currentUser;
      if (sessionUser) {
        try {
          await addDoc(collection(db, 'market_queries'), {
            userId: sessionUser.uid,
            produce: targetProduce,
            insights: result.insights,
            isAdvanced: isPremiumAnalysis,
            createdAt: new Date().toISOString(),
          });
        } catch (saveError) {
          handleFirestoreError(saveError, OperationType.CREATE, 'market_queries');
        }
      }
    } catch (error: any) {
      if (requestId !== marketRequestRef.current) return;
      console.warn('Market insights API failed, retrieving local storage cache:', error);
      const cached = getCachedMarket(targetProduce, locKeyFor(targetCoords));
      if (cached && !cached.isFallback) {
        setInsights(cached.data);
        setMarketCacheInfo({ isCached: true, timestamp: cached.timestamp });
        setPersistedInsights?.(cached.data);
        setLastUpdated(new Date(cached.timestamp).toLocaleString());
        toast.success(bn ? 'নতুন মন্তব্য পাওয়া যায়নি, আগের সংরক্ষিত মন্তব্য দেখানো হচ্ছে' : 'Could not get a new note; showing the saved one');
        setIsLoading(false);
        return;
      }

      const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
      const errorMsg = isOffline
        ? (bn ? 'ইন্টারনেট সংযোগ নেই। সংযোগ পেলে আবার চেষ্টা করুন।' : 'No internet connection. Try again when you are online.')
        : isQuotaError
          ? (bn ? 'সিস্টেমের চাপ বেশি, দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'AI limit reached. Please try again in 5 minutes.')
          : aiErrorMessage(error, lang);

      setInsights({ insights: errorMsg, isError: true });
      setIsLoading(false);
      return;
    }

    try {
      if (usePremium && tier !== 'premium') incrementPremiumUsage();
      await incrementUsage();
    } catch (error) {
      console.error('Usage increment failed:', error);
    } finally {
      if (requestId === marketRequestRef.current) setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------
  // Pieces
  // ---------------------------------------------------------------------

  const cropPicker = (
    <div>
      <p className="text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
        {bn ? 'কোন ফসলের দাম দেখবেন?' : 'Which crop?'}
      </p>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={bn ? 'ফসল' : 'Crop'}>
        {PRODUCE_TYPES.map((p) => {
          const active = p === produce;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setProduce(p)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[72px] rounded-2xl border-2 px-1 text-sm font-bold leading-tight transition-colors ${
                active
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-500'
                  : 'border-stone-200 bg-white text-stone-800 dark:bg-[#0c1c13] dark:text-stone-100 dark:border-emerald-900/60'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{PRODUCE_EMOJI[p] ?? '🌱'}</span>
              <span>{cropName(p)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const priceCard = (
    <OfficialPriceCard
      lang={lang}
      crop={produce}
      cropName={cropName(produce)}
      bulletin={bulletin}
      status={bulletinStatus}
      onRetry={loadBulletin}
    />
  );

  const actionButtons = onNavigateTab && (
    <div className="grid grid-cols-2 gap-3">
      <BigActionButton
        icon={ScanSearch}
        label={bn ? 'ফসলের মান যাচাই' : 'Check my produce quality'}
        hint={bn ? 'ছবি তুলে গ্রেড জানুন' : 'Take a photo to grade it'}
        tone="sky"
        onClick={() => onNavigateTab('smart-grade')}
      />
      <BigActionButton
        icon={Calculator}
        label={bn ? 'লাভ-ক্ষতির হিসাব' : 'Profit or loss'}
        hint={bn ? 'খরচ ও আয় হিসাব করুন' : 'Work out cost and income'}
        tone="amber"
        onClick={() => onNavigateTab('krishi-profit', { crop: produce })}
      />
    </div>
  );

  const getButton = (
    <button
      type="button"
      onClick={() => handleGetInsights()}
      disabled={isLoading}
      className="w-full min-h-[56px] rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-base font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99] transition-transform"
    >
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Activity className="w-5 h-5" aria-hidden="true" />}
      <span>
        {isLoading
          ? (bn ? 'মন্তব্য আনা হচ্ছে…' : 'Getting the note…')
          : (bn ? `${cropName(produce)}: এআই বাজার মন্তব্য নিন` : `Get an AI market note for ${cropName(produce).toLowerCase()}`)}
      </span>
    </button>
  );

  const estimateNotice = (
    <p className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 leading-snug">
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        {bn
          ? 'এআই-এর মন্তব্য একটি অনুমান। এটি সরকারি বা সরাসরি বাজারের দাম নয়। বিক্রির আগে স্থানীয় বাজারে দাম যাচাই করুন।'
          : 'The AI note is an estimate. It is not an official or live market price. Check the price at your local market before selling.'}
      </span>
    </p>
  );

  const renderInsights = () => {
    if (!insights) return null;
    if (insights.isError) {
      return (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-base text-rose-900 dark:text-rose-200">
          {insights.insights}
        </div>
      );
    }

    const w = insights.wholesaleRates || {};
    const min = finite(w.minPriceBdt);
    const max = finite(w.maxPriceBdt);
    const avg = finite(w.avgPriceBdt);
    const num = (n: number) => (bn ? toBn(Math.round(n)) : Math.round(n).toLocaleString('en-US'));
    const tips: string[] = Array.isArray(insights.farmerActionTips) ? insights.farmerActionTips : [];
    const drivers: string[] = Array.isArray(insights.priceDrivers) ? insights.priceDrivers : [];

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {bn ? 'এআই অনুমান' : 'AI estimate'}
          </span>
          {marketCacheInfo?.isCached && (
            <span className="inline-flex items-center gap-1">
              <Database className="w-4 h-4" aria-hidden="true" />
              {bn ? `সংরক্ষিত কপি · ${formatCacheAge(marketCacheInfo.timestamp, 'bn')}` : `Saved copy · ${formatCacheAge(marketCacheInfo.timestamp, 'en')}`}
            </span>
          )}
          {!marketCacheInfo?.isCached && lastUpdated && (
            <span>{bn ? `তৈরি: ${lastUpdated}` : `Made: ${lastUpdated}`}</span>
          )}
        </div>

        {min !== null && max !== null && (
          <div className="rounded-2xl border border-stone-200 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] p-4">
            <p className="text-base font-bold text-stone-800 dark:text-stone-100">
              {bn ? 'স্থানীয় পাইকারি দামের আনুমানিক সীমা' : 'Estimated local wholesale range'}
            </p>
            <p className="mt-1 text-2xl font-black text-stone-900 dark:text-white">
              {bn ? `৳${num(min)} – ৳${num(max)} প্রতি কেজি` : `৳${num(min)} – ৳${num(max)} per kg`}
            </p>
            {avg !== null && (
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {bn ? `গড় প্রায় ৳${num(avg)}` : `Around ৳${num(avg)} on average`}
              </p>
            )}
            {w.trend && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{String(w.trend)}</p>}
          </div>
        )}

        {tips.length > 0 && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <p className="text-base font-bold text-emerald-950 dark:text-emerald-200 mb-2">
              {bn ? 'বিক্রির পরামর্শ' : 'Selling tips'}
            </p>
            <ul className="space-y-2">
              {tips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2 text-base text-stone-800 dark:text-stone-200 leading-snug">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {drivers.length > 0 && (
          <div className="rounded-2xl border border-stone-200 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] p-4">
            <p className="text-base font-bold text-stone-800 dark:text-stone-100 mb-2">
              {bn ? 'দাম কেন ওঠানামা করছে' : 'What is moving the price'}
            </p>
            <ul className="space-y-2">
              {drivers.map((driver, idx) => (
                <li key={idx} className="flex items-start gap-2 text-base text-stone-700 dark:text-stone-300 leading-snug">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{driver}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {insights.insights && (
          <div className="markdown-body rounded-2xl border border-stone-200 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] p-4 text-base leading-relaxed prose prose-stone dark:prose-invert max-w-none">
            <ReactMarkdown>{insights.insights}</ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // Simple view
  // ---------------------------------------------------------------------

  if (simple) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900 dark:text-white">
          <TrendingUp className="w-7 h-7 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          {bn ? 'বাজারদর' : 'Market prices'}
        </h1>
        {cropPicker}
        {priceCard}
        {actionButtons}
        <Disclosure label={bn ? 'এআই-এর বাজার মন্তব্য (অনুমান)' : 'AI market note (estimate)'} keepMounted>
          <div className="space-y-3">
            {estimateNotice}
            {getButton}
            {renderInsights()}
          </div>
        </Disclosure>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Full view
  // ---------------------------------------------------------------------

  return (
    <div className="w-full space-y-4 md:space-y-5">
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-orange-50 dark:bg-orange-950/60 p-2 rounded-xl text-orange-600 dark:text-orange-400 shrink-0">
            <TrendingUp className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-xl font-bold text-stone-900 dark:text-stone-100 leading-tight">{t.marketConnect}</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm mt-0.5">
              {bn
                ? 'সরকারি দৈনিক দামের তালিকা এবং এআই-এর আনুমানিক বাজার মন্তব্য'
                : "The government's daily price list, and an AI market note (an estimate)"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="produce-select" className="flex items-center text-sm font-bold text-stone-700 dark:text-stone-300">
                <Package className="w-4 h-4 mr-1.5 text-orange-500" aria-hidden="true" />
                {t.produceName}
              </label>
              <select
                id="produce-select"
                value={produce}
                onChange={(e) => setProduce(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 p-3 min-h-[44px] text-sm font-semibold text-stone-900 dark:text-stone-100"
              >
                {PRODUCE_TYPES.map((p) => (
                  <option key={p} value={p}>{cropName(p)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center text-sm font-bold text-stone-700 dark:text-stone-300">
                  <MapPin className="w-4 h-4 mr-1.5 text-emerald-500" aria-hidden="true" />
                  {bn ? 'এলাকা (এআই মন্তব্যের জন্য)' : 'Area (for the AI note)'}
                </span>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="flex items-center gap-1 text-xs font-semibold px-2 min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
                >
                  {isDetectingLocation ? <Loader2 className="w-3 h-3 animate-spin" /> : coords ? <Navigation className="w-3 h-3 text-emerald-600" /> : <MapPin className="w-3 h-3 text-stone-400" />}
                  <span>{isDetectingLocation ? t.tooltips.detecting : coords ? t.tooltips.locationDetected : t.tooltips.detectLocation}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {AREA_PRESETS.map((m) => (
                  <button
                    key={m.nameEn}
                    type="button"
                    onClick={() => handleSelectAreaPreset(m.lat, m.lng)}
                    className="px-3 min-h-[44px] rounded-lg text-sm font-medium border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
                  >
                    {bn ? m.nameBn : m.nameEn}
                  </button>
                ))}
              </div>
              {coords && <LocationDisplay coords={coords} lang={lang} color="emerald" accuracy={accuracy} />}
            </div>

            {tier === 'premium' ? (
              <label className="flex items-center justify-between gap-2 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-200">
                  <input type="checkbox" checked={isAdvanced} onChange={(e) => setIsAdvanced(e.target.checked)} className="w-5 h-5" />
                  <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  {t.advancedAnalysis}
                </span>
                <Tooltip content={t.tooltips.advanced}>
                  <HelpCircle className="w-4 h-4 text-stone-400 cursor-help" />
                </Tooltip>
              </label>
            ) : canUsePremium() && (
              <label className="flex items-center justify-between gap-2 p-3 bg-stone-50 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700">
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                  {bn ? 'প্রিমিয়াম বিশ্লেষণ (দিনে ১টি ফ্রি)' : 'Premium analysis (1 free a day)'}
                </span>
                <input type="checkbox" checked={usePremium} onChange={(e) => setUsePremium(e.target.checked)} className="w-5 h-5" />
              </label>
            )}

            <div>
              <div className="flex justify-between items-center mb-1 text-xs font-semibold text-stone-500 dark:text-stone-400">
                <span>{t.usage}</span>
                <span className="font-mono">{currentUsage} / {limit}</span>
              </div>
              <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-1 overflow-hidden">
                <div style={{ width: `${Math.min(100, (currentUsage / limit) * 100)}%` }} className="bg-orange-500 h-full rounded-full" />
              </div>
            </div>

            {getButton}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {priceCard}
          {actionButtons}
          {estimateNotice}
          {insights ? renderInsights() : (
            <p className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-4 text-sm text-stone-500 dark:text-stone-400">
              {bn ? 'বাম দিকের বোতাম চাপলে এআই-এর বাজার মন্তব্য এখানে দেখাবে।' : 'Tap the button to get an AI market note; it will show here.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

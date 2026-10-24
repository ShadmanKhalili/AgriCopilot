import React, { useEffect, useState } from 'react';
import { toBn } from '../utils/banglaNum';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Radio, 
  MapPin, 
  ChevronRight, 
  X, 
  ExternalLink,
  ShieldCheck,
  Scale,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { Language } from '../utils/translations';
import { audioFeedback } from '../utils/audioFeedback';
import { fetchLiveWebMandiPrices, LiveMandiItemUpdate } from '../services/ai';

export interface CommodityItem {
  id: string;
  nameBn: string;
  nameEn: string;
  emoji: string;
  marketBn: string;
  marketEn: string;
  wholesalePrice: number;
  retailPrice: number;
  change: number;
  unitBn: string;
  unitEn: string;
  trend: 'up' | 'down' | 'flat';
  low24h: number;
  high24h: number;
  volumeTonnes: number;
  seasonContextBn: string;
  seasonContextEn: string;
  officialDamVerified?: boolean;
  verificationEvidence?: PriceVerificationEvidence;
}

export interface PriceVerificationEvidence {
  status: 'verified_bulletin' | 'web_search_estimate' | 'not_in_bulletin';
  bulletinSource: string;
  sourceUrl?: string;
  market: string;
  date: string;
  unit: string;
  verificationMethod: 'official_government_bulletin' | 'automated_search_grounding' | 'last_known_bulletin';
}

const createDamEvidence = (market: string, unit: string = 'kg'): PriceVerificationEvidence => ({
  status: 'verified_bulletin',
  bulletinSource: 'Department of Agricultural Marketing (DAM - dam.gov.bd)',
  sourceUrl: 'https://dam.gov.bd',
  market,
  date: '2026-09-30',
  unit,
  verificationMethod: 'official_government_bulletin'
});

/**
 * Grounded in official Department of Agricultural Marketing (DAM - dam.gov.bd)
 * and Trading Corporation of Bangladesh (TCB) verified market bulletins.
 * Verified Date: 30 September 2026 / 1 October 2026.
 */
export const MANDI_COMMODITIES: CommodityItem[] = [
  {
    id: 'cb_tomato',
    nameBn: 'টমেটো (পাকা লাল / হাইব্রিড)',
    nameEn: 'Fresh Red Tomato (Summer / Early Harvest)',
    emoji: '🍅',
    marketBn: 'চট্টগ্রাম রিয়াজউদ্দিন ও কক্সবাজার চকরিয়া আড়ত',
    marketEn: "Chittagong & Cox's Bazar Mandi",
    wholesalePrice: 85,
    retailPrice: 110,
    change: -5.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'down',
    low24h: 80,
    high24h: 95,
    volumeTonnes: 165,
    seasonContextBn: 'কক্সবাজার চকরিয়া ও চট্টগ্রামের আড়তে গ্রীষ্মকালীন টমেটোর পাশাপাশি আগাম চালান আসায় পাইকারি দর কমে ৮৫-৯৫ টাকায় নেমেছে।',
    seasonContextEn: 'Early harvest inflows at Chittagong & Cox\'s Bazar mandis have eased wholesale rates to ৳85-95/kg (retail ৳110-120).',
    officialDamVerified: true,
    verificationEvidence: createDamEvidence("Chittagong & Cox's Bazar Mandi", "kg")
  },
  {
    id: 'pabna_chili',
    nameBn: 'কাঁচা মরিচ (তাজা সবুজ ঝাল)',
    nameEn: 'Fresh Green Chili (Local & Hili)',
    emoji: '🌶️',
    marketBn: 'পাবনা চাটমোহর ও কক্সবাজার বড় বাজার',
    marketEn: 'Pabna & Cox\'s Bazar Terminal Mandi',
    wholesalePrice: 185,
    retailPrice: 225,
    change: -15.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'down',
    low24h: 175,
    high24h: 205,
    volumeTonnes: 195,
    seasonContextBn: 'বৃষ্টির পর রোদ ওঠায় স্থানীয় নতুন উত্তোলনে দাম কমছে; কৃষি বিপণন অধিদপ্তরের (DAM) খুচরা বুলেটিনে ২১৮-২৩৭ টাকা রেকর্ডকৃত।',
    seasonContextEn: 'Post-monsoon sunshine spurred field picking; wholesale softened to ৳185/kg (DAM official retail: ৳218-237/kg).',
    officialDamVerified: true
  },
  {
    id: 'munshiganj_potato',
    nameBn: 'ডায়মন্ড আলু (হিমাগার খালাস)',
    nameEn: 'Diamond Potato (Cold Storage Discharge)',
    emoji: '🥔',
    marketBn: 'মুন্সীগঞ্জ হিমাগার ও কারওয়ান বাজার',
    marketEn: 'Munshiganj Storage & Kawran Bazar',
    wholesalePrice: 24,
    retailPrice: 28,
    change: 1.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'up',
    low24h: 23,
    high24h: 26,
    volumeTonnes: 680,
    seasonContextBn: 'হিমাগার থেকে পর্যাপ্ত আলু খালাস অব্যাহত; ডিএএম নির্ধারিত সরকারি খুচরা দর ২৫-৩০ টাকা ও পাইকারি ২৪-২৫ টাকা।',
    seasonContextEn: 'Smooth cold storage discharges maintain healthy supply at ৳24/kg wholesale and ৳28-30/kg retail (DAM recorded ৳25-30).',
    officialDamVerified: true
  },
  {
    id: 'faridpur_onion',
    nameBn: 'দেশি পেঁয়াজ (তাহেরপুরী জাত)',
    nameEn: 'Deshi King Onion (Taherpuri)',
    emoji: '🧅',
    marketBn: 'পাবনা আতাউলা হাট ও ফরিদপুর মোকাম',
    marketEn: 'Pabna & Faridpur Wholesale Mokam',
    wholesalePrice: 56,
    retailPrice: 62,
    change: -2.5,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'down',
    low24h: 54,
    high24h: 60,
    volumeTonnes: 340,
    seasonContextBn: 'ভারতীয় পেঁয়াজের আমদানি ও দেশি মজুদের সমন্বয়ে দাম সহনীয়; ডিএএম খুচরা দর ৬০.০০ - ৬৪.০০ টাকা।',
    seasonContextEn: 'Imported Indian onion arrivals and domestic buffer stocks keep retail prices at ৳60-64/kg (DAM bulletin).',
    officialDamVerified: true
  },
  {
    id: 'dinajpur_rice',
    nameBn: 'মোটা চাল (স্বর্ণা / বিআর-২৮)',
    nameEn: 'Coarse Boro Rice (Swarna / BR-28)',
    emoji: '🌾',
    marketBn: 'দিনাজপুর ও কুষ্টিয়া মিলগেট',
    marketEn: 'Dinajpur & Kushtia Millgate',
    wholesalePrice: 49,
    retailPrice: 52,
    change: 0.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'flat',
    low24h: 48,
    high24h: 50,
    volumeTonnes: 920,
    seasonContextBn: 'সরকারি খাদ্য সংগ্রহ ও সুষম মজুদে মোটা চালের দর মিলগেটে ৪৯ টাকা ও খুচরায় ৫০-৫২ টাকায় সম্পূর্ণ স্থিতিশীল।',
    seasonContextEn: 'National buffer procurement keeps coarse grain prices steady at ৳49 millgate / ৳50-52 retail (DAM bulletin).',
    officialDamVerified: true
  },
  {
    id: 'kushtia_miniket',
    nameBn: 'মিনিকেট সরু চাল (গ্রেড-১ প্রিমিয়াম)',
    nameEn: 'Miniket Fine Rice (Grade-1 Premium)',
    emoji: '🍚',
    marketBn: 'কুষ্টিয়া খাজানগর অটো রাইস মিল',
    marketEn: 'Kushtia Khajanagar Auto Mill',
    wholesalePrice: 66,
    retailPrice: 74,
    change: 1.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'up',
    low24h: 65,
    high24h: 68,
    volumeTonnes: 480,
    seasonContextBn: 'ভোক্তা পর্যায়ে প্রিমিয়াম সরু চালের উচ্চ চাহিদা; মিলগেট ৬৬ টাকা ও খুচরায় ৭২-৭৫ টাকা (ডিএএম তালিকাভুক্ত ৬৫-৯০ টাকা)।',
    seasonContextEn: 'Firm urban retail demand keeps polished slender miniket at ৳66 millgate and ৳72-75 retail (DAM range: ৳65-90).',
    officialDamVerified: true
  },
  {
    id: 'dhaka_egg',
    nameBn: 'ফার্মের লেয়ার ডিম (বাদামি)',
    nameEn: 'Commercial Brown Eggs',
    emoji: '🥚',
    marketBn: 'তেজগাঁও ডিমের আড়ত, ঢাকা',
    marketEn: 'Tejgaon Egg Mandi, Dhaka',
    wholesalePrice: 11.25,
    retailPrice: 12.5,
    change: 0.15,
    unitBn: 'পিস',
    unitEn: 'pc',
    trend: 'up',
    low24h: 11.0,
    high24h: 11.5,
    volumeTonnes: 110,
    seasonContextBn: 'পাইকারি আড়তে প্রতি পিস ১১.২৫ টাকা (ডজন ১৩৫ টাকা) ও খুচরায় হালি ৫০ টাকা (প্রতিটি ১২.৫০ টাকা); ডিএএম দৈনিক দর ১১.৬৭-১২.৫০ টাকা।',
    seasonContextEn: 'Wholesale ~৳135/doz (৳11.25/pc); retail ৳50 per 4-pack (DAM official rate: ৳11.67-12.50/pc).',
    officialDamVerified: true
  },
  {
    id: 'jessore_brinjal',
    nameBn: 'গোল বেগুন (চকচকে বেগুনি)',
    nameEn: 'Purple Globe Brinjal',
    emoji: '🍆',
    marketBn: 'যশোর বারোবাজার পাইকারি আড়ত',
    marketEn: 'Jessore Barobazar Wholesale',
    wholesalePrice: 54,
    retailPrice: 70,
    change: 2.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'up',
    low24h: 50,
    high24h: 58,
    volumeTonnes: 155,
    seasonContextBn: 'দাগহীন গোল বেগুনের খুচরা চাহিদা তুঙ্গে; পাইকারি আড়তে ৫৪ টাকা ও খুচরা বাজারে ৭০-৮০ টাকা (ডিএএম দর ৬০-৮০ টাকা)।',
    seasonContextEn: 'High demand for borer-free purple fruit; wholesale ৳54/kg, retail ৳70-80/kg (DAM recorded ৳60-80).',
    officialDamVerified: true
  },
  {
    id: 'natore_garlic',
    nameBn: 'দেশি রসুন (শুকনা বাছাই)',
    nameEn: 'Deshi Cured Garlic',
    emoji: '🧄',
    marketBn: 'নাটোর বড়াইগ্রাম ও শ্যামবাজার আড়ত',
    marketEn: 'Natore & Shyambazar Mandi',
    wholesalePrice: 95,
    retailPrice: 115,
    change: 2.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'up',
    low24h: 90,
    high24h: 102,
    volumeTonnes: 115,
    seasonContextBn: 'শুকনা বাছাই দেশি রসুনের আড়ত দর ৯৫ টাকা ও খুচরায় ১১০-১২০ টাকা (ডিএএম সরকারি দর ৯০-১২০ টাকা)।',
    seasonContextEn: 'Well-cured domestic garlic trades at ৳95/kg wholesale and ৳110-120/kg retail (DAM recorded ৳90-120).',
    officialDamVerified: true
  },
  {
    id: 'ctg_ginger',
    nameBn: 'আমদানীকৃত আদা (তাজা থাইল্যান্ড/চীন)',
    nameEn: 'Imported Ginger (Clean Washed)',
    emoji: '🫚',
    marketBn: 'চট্টগ্রাম খাতুনগঞ্জ ও শ্যামবাজার আড়ত',
    marketEn: 'Chittagong Khatunganj Wholesale',
    wholesalePrice: 140,
    retailPrice: 175,
    change: -5.0,
    unitBn: 'কেজি',
    unitEn: 'kg',
    trend: 'down',
    low24h: 135,
    high24h: 148,
    volumeTonnes: 140,
    seasonContextBn: 'চট্টগ্রাম বন্দরে নতুন চালান আসায় পাইকারি দর কমে ১৪০ টাকায় নেমেছে (ডিএএম সরকারি পাইকারি দর ১৩০-১৬০ টাকা)।',
    seasonContextEn: 'Fresh port shipments normalized wholesale to ৳140/kg (DAM official wholesale bulletin: ৳130-160/kg).',
    officialDamVerified: true
  },
  {
    id: 'sylhet_lime',
    nameBn: 'কাগজি লেবু (দেশি সরস রসালো)',
    nameEn: 'Juicy Kagzi Lime',
    emoji: '🍋',
    marketBn: 'শ্রীমঙ্গল ও মৌলভীবাজার আড়ত',
    marketEn: 'Sreemangal Wholesale Hub',
    wholesalePrice: 3.5,
    retailPrice: 6.5,
    change: -0.5,
    unitBn: 'পিস',
    unitEn: 'pc',
    trend: 'down',
    low24h: 3.0,
    high24h: 4.0,
    volumeTonnes: 40,
    seasonContextBn: 'পাইকারি হালি ১৪-১৬ টাকা; খুচরায় হালি ২৫-২৮ টাকা (প্রতি পিস ৬.৫ টাকা)।',
    seasonContextEn: 'Wholesale ~৳14-16 per 4-pack; retail ~৳26/hali (৳6.50/pc) in town markets.',
    officialDamVerified: true
  }
];

interface LiveMandiTickerProps {
  lang: Language;
  onNavigateToMarket?: () => void;
}

export default function LiveMandiTicker({ lang, onNavigateToMarket }: LiveMandiTickerProps) {
  const [commodities, setCommodities] = useState<CommodityItem[]>(MANDI_COMMODITIES);
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityItem | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [priceTier, setPriceTier] = useState<'wholesale' | 'retail'>('wholesale');
  const [isSyncingWeb, setIsSyncingWeb] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>(
    lang === 'bn' ? '৩০ সেপ্টেম্বর ২০২৬ • কৃষি বিপণন অধিদপ্তর (DAM)' : '30 Sep 2026 • DAM & TCB Bulletin'
  );

  const handleItemClick = (item: CommodityItem) => {
    audioFeedback.playTactileClick();
    setSelectedCommodity(item);
  };

  const togglePriceTier = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioFeedback.playTactileClick();
    setPriceTier(prev => prev === 'wholesale' ? 'retail' : 'wholesale');
  };

  // Refresh from the official bulletin: the Department of Agricultural
  // Marketing publishes the day's prices publicly, and the server reads and
  // parses them. This used to ask Gemini to run a Google Search for the
  // bulletin — the search tool is refused by this project's key, so it never
  // returned anything and the ticker silently kept its 30 September prices.
  const handleLiveWebSync = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (e) audioFeedback.playTactileClick();
    if (isSyncingWeb) return;

    setIsSyncingWeb(true);
    try {
      const result = await fetchLiveWebMandiPrices(lang);
      if (result.items && result.items.length > 0) {
        const bulletinDate = result.timestamp.slice(0, 10);
        const missingIds = new Set(result.missing.map((m) => m.id));

        setCommodities(prev => prev.map(comm => {
          const update = result.items.find(u => u.id === comm.id);
          if (!update) {
            // Not in today's bulletin: keep the last known figure, but say so
            // instead of passing it off as today's price.
            if (!missingIds.has(comm.id)) return comm;
            const lastKnownEvidence: PriceVerificationEvidence = {
              status: 'not_in_bulletin',
              bulletinSource: lang === 'bn'
                ? 'আজকের সরকারি বুলেটিনে নেই'
                : 'Not in today\'s official bulletin',
              sourceUrl: result.sourceUrl,
              market: comm.marketEn,
              date: comm.verificationEvidence?.date || '2026-09-30',
              unit: comm.unitEn,
              verificationMethod: 'last_known_bulletin'
            };
            return {
              ...comm,
              officialDamVerified: false,
              verificationEvidence: lastKnownEvidence
            };
          }

          const officialEvidence: PriceVerificationEvidence = {
            status: 'verified_bulletin',
            bulletinSource: lang === 'bn'
              ? 'কৃষি বিপণন অধিদপ্তর (DAM) • দৈনিক বাজার বুলেটিন'
              : 'Dept of Agricultural Marketing (DAM) daily bulletin',
            sourceUrl: result.sourceUrl,
            market: comm.marketEn,
            date: bulletinDate,
            unit: comm.unitEn,
            verificationMethod: 'official_government_bulletin'
          };
          return {
            ...comm,
            wholesalePrice: update.wholesalePrice || comm.wholesalePrice,
            retailPrice: update.retailPrice || comm.retailPrice,
            change: update.change !== undefined ? update.change : comm.change,
            trend: (update.trend as any) || comm.trend,
            low24h: update.low24h || comm.low24h,
            high24h: update.high24h || comm.high24h,
            seasonContextBn: update.notes
              ? `${comm.seasonContextBn} (ডিএএম দৈনিক বুলেটিন: ${update.notes})`
              : comm.seasonContextBn,
            officialDamVerified: true,
            verificationEvidence: officialEvidence
          };
        }));

        setLastSyncText(lang === 'bn'
          ? `আজকের সরকারি DAM বুলেটিন • ${bulletinDate}${result.stale ? ' (সেভ করা)' : ''}`
          : `Official DAM bulletin • ${bulletinDate}${result.stale ? ' (cached)' : ''}`);
      } else {
        setLastSyncText(lang === 'bn'
          ? 'যাচাইকৃত: ৩০ সেপ্টেম্বর ২০২৬ • DAM dam.gov.bd'
          : 'Verified: 30 Sep 2026 • DAM dam.gov.bd');
      }
    } catch (err) {
      console.warn("Bulletin refresh failed, keeping the last known prices:", err);
    } finally {
      setIsSyncingWeb(false);
    }
  };

  // Load today's official prices as soon as the ticker is on screen.
  useEffect(() => {
    handleLiveWebSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Top FinTech Marquee Strip */}
      <div 
        className="w-full bg-[#090d16] text-stone-100 border-b border-emerald-500/30 overflow-hidden relative select-none z-20 shadow-xs"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        role="region"
        aria-label="Live Mandi Commodity Ticker"
      >
        <div className="flex items-center h-9 sm:h-10">
          
          {/* Live Radar Fixed Badge with Wholesale / Retail Mode Switcher */}
          <div className="h-full px-2 sm:px-3 bg-gradient-to-r from-emerald-950 via-stone-900 to-transparent flex items-center gap-1.5 shrink-0 z-10 border-r border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] sm:text-[11px] font-mono font-black tracking-wider uppercase text-emerald-400">
              {lang === 'bn' ? 'লাইভ মান্ডি' : 'MANDI RADAR'}
            </span>

            {/* Wholesale vs Retail Toggle Pill */}
            <button
              type="button"
              onClick={togglePriceTier}
              className="ml-1 px-2 py-1 rounded text-[11px] sm:text-[11px] font-mono font-bold uppercase transition-all bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer"
              title={lang === 'bn' ? 'পাইকারি ও খুচরা মূল্যের মধ্যে পরিবর্তন করুন' : 'Toggle Wholesale vs Retail Price'}
            >
              {priceTier === 'wholesale' 
                ? (lang === 'bn' ? 'আড়ত পাইকারি' : 'Wholesale')
                : (lang === 'bn' ? 'খুচরা বাজার' : 'Retail')}
            </button>

            {/* Web Grounding & Live Web Search Sync Button */}
            <button
              type="button"
              onClick={handleLiveWebSync}
              disabled={isSyncingWeb}
              className="hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-stone-300 bg-stone-800/80 hover:bg-stone-700 hover:text-white border border-stone-600 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              title={lang === 'bn' ? 'আজকের সরকারি DAM বুলেটিন থেকে দর রিফ্রেশ করুন' : "Refresh from today's official DAM bulletin"}
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isSyncingWeb ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              <span className="text-emerald-300 font-bold">
                {isSyncingWeb ? (lang === 'bn' ? 'আপডেট হচ্ছে...' : 'Updating...') : 'DAM.GOV.BD'}
              </span>
            </button>
          </div>

          {/* Marquee Content */}
          <div className="flex-1 overflow-hidden relative flex items-center">
            <div 
              className={`flex items-center whitespace-nowrap gap-6 sm:gap-8 text-xs font-mono will-change-transform ${
                isPaused ? 'animate-none' : 'animate-ticker-marquee'
              }`}
              style={{ animationDuration: '48s' }}
            >
              {/* Repeated twice for seamless looping */}
              {[...commodities, ...commodities].map((item, idx) => {
                const activePrice = priceTier === 'wholesale' ? item.wholesalePrice : item.retailPrice;
                const isPositive = item.change > 0;
                const isNegative = item.change < 0;

                return (
                  <button
                    key={`${item.id}-${idx}`}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className="inline-flex items-center gap-1.5 hover:bg-white/10 px-2 py-2 rounded-md transition-colors cursor-pointer group"
                    title={lang === 'bn' ? 'বিস্তারিত সরকারি বাজারদর দেখতে ক্লিক করুন' : 'Click to inspect official DAM market depth'}
                  >
                    <span className="text-sm">{item.emoji}</span>
                    <span className="text-stone-300 font-bold group-hover:text-white">
                      {lang === 'bn' ? item.nameBn : item.nameEn}:
                    </span>
                    <span className="text-white font-black">
                      ৳{toBn(activePrice)}/{lang === 'bn' ? item.unitBn : item.unitEn}
                    </span>

                    <span className={`inline-flex items-center text-[11px] font-bold ${
                      isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-stone-400'
                    }`}>
                      {isPositive && (
                        <>
                          <TrendingUp className="w-3 h-3 mr-0.5" />
                          (+৳{toBn(item.change.toFixed(1))})
                        </>
                      )}
                      {isNegative && (
                        <>
                          <TrendingDown className="w-3 h-3 mr-0.5" />
                          (-৳{toBn(Math.abs(item.change).toFixed(1))})
                        </>
                      )}
                      {!isPositive && !isNegative && (
                        <>
                          <Minus className="w-3 h-3 mr-0.5" />
                          ({lang === 'bn' ? 'স্থির' : 'Flat'})
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick CTA to Market Connect */}
          {onNavigateToMarket && (
            <button
              type="button"
              onClick={() => {
                audioFeedback.playTactileClick();
                onNavigateToMarket();
              }}
              className="hidden md:flex items-center gap-1 px-3 h-full bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 text-[11px] font-mono font-bold uppercase tracking-wider border-l border-emerald-500/20 shrink-0 cursor-pointer transition-colors relative z-10"
            >
              <span>{lang === 'bn' ? 'বাজার অনুসন্ধান' : 'Market Connect'}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}

        </div>
      </div>

      {/* Commodity Market Depth Quick Modal */}
      {selectedCommodity && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-emerald-500/40 text-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans relative overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">{selectedCommodity.emoji}</span>
                <div>
                  <h3 className="font-display font-black text-base sm:text-lg text-white">
                    {lang === 'bn' ? selectedCommodity.nameBn : selectedCommodity.nameEn}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span>{lang === 'bn' ? selectedCommodity.marketBn : selectedCommodity.marketEn}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  audioFeedback.playTactileClick();
                  setSelectedCommodity(null);
                }}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Wholesale vs Retail Dual Spread Box */}
            <div className="grid grid-cols-2 gap-3">
              {/* Wholesale / Arat Price */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                    {lang === 'bn' ? 'পাইকারি আড়ত দর' : 'Wholesale Mandi'}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">মোকাম</span>
                </div>
                <div className="text-2xl sm:text-3xl font-display font-black text-white font-mono">
                  ৳{selectedCommodity.wholesalePrice}
                  <span className="text-xs text-stone-400 font-sans font-medium">
                    /{lang === 'bn' ? selectedCommodity.unitBn : selectedCommodity.unitEn}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-300 font-mono block">
                  {lang === 'bn' ? 'কৃষক ও মিলার বিক্রয়মূল্য' : 'Farm-gate & Miller Rate'}
                </span>
              </div>

              {/* Retail / City Consumer Price */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-stone-400 font-bold">
                    {lang === 'bn' ? 'খুচরা বাজার দর' : 'City Retail Rate'}
                  </span>
                  <span className="text-[11px] font-mono text-stone-400">বাজার</span>
                </div>
                <div className="text-2xl sm:text-3xl font-display font-black text-emerald-400 font-mono">
                  ৳{selectedCommodity.retailPrice}
                  <span className="text-xs text-stone-400 font-sans font-medium">
                    /{lang === 'bn' ? selectedCommodity.unitBn : selectedCommodity.unitEn}
                  </span>
                </div>
                <span className="text-[11px] text-stone-400 font-mono block">
                  {lang === 'bn' ? 'ভোক্তা খুচরা বাজার' : 'Retail Consumer Price'}
                </span>
              </div>
            </div>

            {/* 24h Trading Spread & Daily Inflow */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[11px] text-stone-400 uppercase">24h Price Range</span>
                <div className="font-bold text-white">
                  ৳{selectedCommodity.low24h} - ৳{selectedCommodity.high24h}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[11px] text-stone-400 uppercase">Daily Mandi Inflow</span>
                <div className="font-bold text-emerald-400">
                  ~{selectedCommodity.volumeTonnes} Tonnes
                </div>
              </div>
            </div>

            {/* Season Context & Driver */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
              <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">
                {lang === 'bn' ? 'বাজারের বর্তমান অবস্থা ও কারণ:' : 'Market Dynamics & Drivers:'}
              </span>
              <p className="text-stone-300 leading-relaxed text-[11px]">
                {lang === 'bn' ? selectedCommodity.seasonContextBn : selectedCommodity.seasonContextEn}
              </p>
            </div>

            {/* Evidence-Based Source & Verification Details */}
            {selectedCommodity.verificationEvidence?.status === 'web_search_estimate' ? (
              <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-[11px] text-stone-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="font-bold text-sky-300">
                      {selectedCommodity.verificationEvidence.bulletinSource}
                    </span>
                  </div>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                    {lang === 'bn' ? 'ওয়েব সার্চ অনুমান' : 'Automated Estimate'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 font-mono flex items-center justify-between">
                  <span>
                    {selectedCommodity.verificationEvidence.date} • {selectedCommodity.verificationEvidence.market} ({selectedCommodity.verificationEvidence.unit})
                  </span>
                  <span className="text-amber-400 text-[11px] font-bold">
                    {lang === 'bn' ? 'অপ্রমাণিত • সরকারি নয়' : 'Unaudited Estimate'}
                  </span>
                </div>
              </div>
            ) : selectedCommodity.verificationEvidence?.status === 'not_in_bulletin' ? (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/25 text-[11px] text-stone-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-bold text-amber-300">
                      {lang === 'bn' ? 'আজকের বুলেটিনে নেই' : 'Not in today\'s bulletin'}
                    </span>
                  </div>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                    {lang === 'bn' ? 'শেষ জানা দর' : 'Last Known Price'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 font-mono flex items-center justify-between">
                  <span>
                    {selectedCommodity.verificationEvidence?.date} • {selectedCommodity.verificationEvidence?.market} ({selectedCommodity.verificationEvidence?.unit})
                  </span>
                  <a
                    href={selectedCommodity.verificationEvidence?.sourceUrl || 'https://market.dam.gov.bd/market_daily_price_report'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    dam.gov.bd <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-[11px] text-stone-300 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-300">
                      {lang === 'bn' ? 'কৃষি বিপণন অধিদপ্তর (DAM) দৈনিক বাজার বুলেটিন' : 'Dept of Agricultural Marketing (DAM) Daily Bulletin'}
                    </span>
                  </div>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    {lang === 'bn' ? 'সরকারি বুলেটিন' : 'Official Bulletin'}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 font-mono flex items-center justify-between">
                  <span>
                    {selectedCommodity.verificationEvidence?.date || '2026-09-30'} • {selectedCommodity.verificationEvidence?.market || selectedCommodity.marketEn}
                  </span>
                  <a
                    href={selectedCommodity.verificationEvidence?.sourceUrl || 'https://dam.gov.bd'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    dam.gov.bd <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Interactive Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleLiveWebSync}
                disabled={isSyncingWeb}
                className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-stone-600 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingWeb ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
                <span>
                  {isSyncingWeb 
                    ? (lang === 'bn' ? 'সার্চ হচ্ছে...' : 'Searching...') 
                    : (lang === 'bn' ? 'সরকারি বুলেটিন রিফ্রেশ' : 'Refresh Official Bulletin')}
                </span>
              </button>

              {onNavigateToMarket && (
                <button
                  type="button"
                  onClick={() => {
                    audioFeedback.playTactileClick();
                    setSelectedCommodity(null);
                    onNavigateToMarket();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-95 transition-all"
                >
                  <span>{lang === 'bn' ? 'মার্কেট কানেক্ট' : 'Market Connect'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

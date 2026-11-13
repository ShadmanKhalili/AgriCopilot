import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronRight, X, ExternalLink, RefreshCw } from 'lucide-react';
import { toBn } from '../utils/banglaNum';
import { Language } from '../utils/translations';
import { audioFeedback } from '../utils/audioFeedback';
import { fetchOfficialBulletin, OfficialBulletin, BulletinPrice } from '../services/marketPrices';

/** Icons only, no prices. Ids are the ones the bulletin endpoint returns. */
const COMMODITY_EMOJI: Record<string, string> = {
  pabna_chili: '🌶️',
  faridpur_onion: '🧅',
  dinajpur_rice: '🌾',
  kushtia_miniket: '🍚',
  dhaka_egg: '🥚',
  natore_garlic: '🧄',
  ctg_ginger: '🫚',
  dhaka_chicken: '🍗',
  dhaka_beef: '🥩',
  sugar: '🍬',
  soybean_oil: '🛢️',
  mug_dal: '🫘',
};

const REFRESH_MS = 30 * 60 * 1000;

const num = (value: number | string, lang: Language) => (lang === 'bn' ? toBn(value) : String(value));

/** Bulletin date in Dhaka time, e.g. "১৩ নভেম্বর" / "13 Nov". */
const formatDate = (iso: string, lang: Language): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: lang === 'bn' ? 'long' : 'short',
      timeZone: 'Asia/Dhaka',
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
};

// The bulletin publishes the size of the change and an arrow for its direction,
// so the sign comes from the direction, not from the number.
const formatChange = (price: BulletinPrice, lang: Language) => {
  const pct = Math.abs(price.changePct ?? 0);
  const sign = pct === 0 ? '' : price.direction === 'up' ? '+' : price.direction === 'down' ? '-' : '';
  return `${sign}${num(pct, lang)}%`;
};

const rangeText = (p: BulletinPrice, lang: Language) =>
  `৳${num(p.low, lang)}–${num(p.high, lang)}/${lang === 'bn' ? 'কেজি' : 'kg'}`;

const itemName = (p: BulletinPrice, lang: Language) => (lang === 'bn' ? p.name || p.label : p.label || p.name);

function ChangeBadge({ price, lang }: { price: BulletinPrice; lang: Language }) {
  if (price.changePct === null) return null;
  const up = price.direction === 'up';
  const down = price.direction === 'down';
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold ${
        up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-stone-400'
      }`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {formatChange(price, lang)}
    </span>
  );
}

interface LiveMandiTickerProps {
  lang: Language;
  onNavigateToMarket?: () => void;
}

export default function LiveMandiTicker({ lang, onNavigateToMarket }: LiveMandiTickerProps) {
  const [bulletin, setBulletin] = useState<OfficialBulletin | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<BulletinPrice | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  // A ref so the 30-minute timer never starts a second request while one is in flight.
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      const result = await fetchOfficialBulletin();
      if (!mounted.current) return;
      if (result && result.prices.length > 0) {
        setBulletin(result);
        setStatus('ready');
      } else {
        // Keep whatever we already had; only show failure when there is nothing.
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'failed'));
      }
    } catch {
      if (mounted.current) setStatus((prev) => (prev === 'ready' ? 'ready' : 'failed'));
    } finally {
      inFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const bn = lang === 'bn';
  const dateText = bulletin ? formatDate(bulletin.fetchedAt, lang) : '';
  const prices = bulletin?.prices ?? [];

  const renderItem = (p: BulletinPrice, key: string, hidden = false) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        audioFeedback.playTactileClick();
        setSelected(p);
      }}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      tabIndex={hidden ? -1 : 0}
      className="inline-flex items-center gap-1.5 hover:bg-white/10 focus-visible:bg-white/10 px-2 py-2 rounded-md transition-colors cursor-pointer group"
    >
      <span className="text-sm" aria-hidden="true">{COMMODITY_EMOJI[p.id] ?? '•'}</span>
      <span className="text-stone-300 font-bold group-hover:text-white">{itemName(p, lang)}:</span>
      <span className="text-white font-black">{rangeText(p, lang)}</span>
      <ChangeBadge price={p} lang={lang} />
    </button>
  );

  return (
    <>
      <div
        className="w-full bg-[#090d16] text-stone-100 border-b border-emerald-500/30 overflow-hidden relative select-none z-20 shadow-xs"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        role="region"
        aria-label={bn ? 'সরকারি বাজারদর' : 'Government market prices'}
      >
        <div className="flex items-center min-h-11">
          {/* Fixed label + bulletin date */}
          <div className="h-full px-2 sm:px-3 py-1 bg-gradient-to-r from-emerald-950 via-stone-900 to-transparent flex flex-col justify-center shrink-0 z-10 border-r border-emerald-500/20">
            <span className="text-xs font-bold text-emerald-400 leading-tight">
              {bn ? 'সরকারি বাজারদর (ঢাকা)' : 'Government prices (Dhaka)'}
            </span>
            {bulletin && (
              <span className="text-xs text-stone-300 leading-tight">
                {dateText}
                {bulletin.stale ? ` ${bn ? '(পুরোনো)' : '(older copy)'}` : ''}
              </span>
            )}
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0 overflow-hidden motion-reduce:overflow-x-auto relative flex items-center">
            {status === 'loading' && (
              <span className="px-3 text-xs text-stone-300" role="status">
                {bn ? 'দাম আনা হচ্ছে…' : 'Loading prices…'}
              </span>
            )}
            {status === 'failed' && (
              <span className="px-3 text-xs text-amber-300" role="status">
                {bn ? 'আজকের সরকারি দাম পাওয়া যায়নি' : "Today's government prices could not be loaded"}
              </span>
            )}
            {status === 'ready' && (
              <div
                className={`flex items-center whitespace-nowrap gap-6 sm:gap-8 text-xs will-change-transform ${
                  isPaused ? 'animate-none' : 'animate-ticker-marquee'
                }`}
                style={{ animationDuration: `${Math.max(30, prices.length * 5)}s` }}
              >
                {prices.map((p) => renderItem(p, p.id))}
                {/* Second copy for a seamless loop; hidden when motion is reduced. */}
                <span className="contents motion-reduce:hidden" aria-hidden="true">
                  {prices.map((p) => renderItem(p, `${p.id}-dup`, true))}
                </span>
              </div>
            )}
          </div>

          {/* Refresh / retry */}
          <button
            type="button"
            onClick={() => {
              audioFeedback.playTactileClick();
              load();
            }}
            disabled={refreshing}
            className="flex items-center justify-center gap-1 min-w-11 min-h-11 px-2 text-xs text-emerald-300 hover:bg-white/10 border-l border-emerald-500/20 shrink-0 cursor-pointer disabled:opacity-60"
            aria-label={bn ? 'আবার আনুন' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{bn ? 'আবার আনুন' : 'Refresh'}</span>
          </button>

          {onNavigateToMarket && (
            <button
              type="button"
              onClick={() => {
                audioFeedback.playTactileClick();
                onNavigateToMarket();
              }}
              className="hidden md:flex items-center gap-1 px-3 min-h-11 bg-emerald-900/40 hover:bg-emerald-900/70 text-emerald-300 text-xs font-bold border-l border-emerald-500/20 shrink-0 cursor-pointer transition-colors"
            >
              <span>{bn ? 'বাজার অনুসন্ধান' : 'Market Connect'}</span>
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {selected && bulletin && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={itemName(selected, lang)}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#090d16] border border-emerald-500/40 text-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl" aria-hidden="true">{COMMODITY_EMOJI[selected.id] ?? '•'}</span>
                <h3 className="font-black text-lg text-white">{itemName(selected, lang)}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  audioFeedback.playTactileClick();
                  setSelected(null);
                }}
                className="min-w-11 min-h-11 flex items-center justify-center rounded-xl text-stone-300 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
                aria-label={bn ? 'বন্ধ করুন' : 'Close'}
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="text-3xl font-black text-emerald-400">{rangeText(selected, lang)}</div>
              <ChangeBadge price={selected} lang={lang} />
            </div>

            <dl className="text-xs space-y-1.5 text-stone-300">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">{bn ? 'তারিখ' : 'Date fetched'}</dt>
                <dd>
                  {dateText}
                  {bulletin.stale ? ` ${bn ? '(পুরোনো)' : '(older copy)'}` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-400">{bn ? 'সূত্র' : 'Source'}</dt>
                <dd className="text-right">
                  <a
                    href={bulletin.sourceUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    {bulletin.source} <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            </dl>

            <p className="text-xs text-stone-300 leading-relaxed">
              {bn
                ? 'এটি ঢাকার বাজারের দামের সীমা। আপনার এলাকায় দাম আলাদা হতে পারে।'
                : 'This is the price range in Dhaka markets. Prices in your area may differ.'}
            </p>

            {onNavigateToMarket && (
              <button
                type="button"
                onClick={() => {
                  audioFeedback.playTactileClick();
                  setSelected(null);
                  onNavigateToMarket();
                }}
                className="w-full min-h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{bn ? 'মার্কেট কানেক্ট' : 'Market Connect'}</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

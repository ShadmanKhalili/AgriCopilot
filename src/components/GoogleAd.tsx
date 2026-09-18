import React, { useEffect, useRef, useState } from 'react';
import { translations, Language } from '../utils/translations';
import { HelpCircle, AlertCircle, Info } from 'lucide-react';
import Tooltip from './Tooltip';

interface GoogleAdProps {
  className?: string;
  lang?: Language;
}

export default function GoogleAd({ className = '', lang = 'en' }: GoogleAdProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [adStatus, setAdStatus] = useState<'loading' | 'loaded' | 'unfilled' | 'blocked' | 'placeholder'>('loading');
  const t = translations[lang] || translations.en;

  const clientId = (import.meta as any).env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-8691248886116699';
  const slotId = (import.meta as any).env.VITE_ADSENSE_SLOT_ID || '';
  const isPlaceholderSlot = !slotId || slotId === '1234567890';

  useEffect(() => {
    let timeoutId: number;
    let observer: MutationObserver | null = null;

    // 1. Detect if AdSense script was blocked by browser extension (AdBlock / Brave Shields)
    const scriptLoaded = !!(window as any).adsbygoogle || document.querySelector('script[src*="pagead2.googlesyndication.com"]');
    if (!scriptLoaded) {
      setAdStatus('blocked');
      return;
    }

    if (isPlaceholderSlot) {
      setAdStatus('placeholder');
      // Still attempt push so auto-ads (if enabled in AdSense dashboard) can operate
    }

    const pushAd = () => {
      try {
        if (adRef.current) {
          // Monitor Google's status attribute mutation (e.g. data-ad-status="unfilled" or "filled")
          observer = new MutationObserver(() => {
            const statusAttr = adRef.current?.getAttribute('data-ad-status');
            if (statusAttr === 'unfilled') {
              setAdStatus('unfilled');
            } else if (statusAttr === 'filled') {
              setAdStatus('loaded');
            }
          });

          observer.observe(adRef.current, {
            attributes: true,
            attributeFilter: ['data-ad-status', 'data-adsbygoogle-status']
          });

          // Check if ad is already initialized to avoid duplicate push
          if (!adRef.current.getAttribute('data-adsbygoogle-status')) {
            if (adRef.current.offsetWidth > 0) {
              const adsbygoogle = (window as any).adsbygoogle || [];
              adsbygoogle.push({});
            } else {
              timeoutId = window.setTimeout(pushAd, 300);
            }
          }
        }
      } catch (e) {
        console.warn("[AdSense Notification] Ad initialization note:", e);
      }
    };

    // Small initial delay to let CSS layout calculate dimensions
    timeoutId = window.setTimeout(pushAd, 200);

    return () => {
      window.clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [isPlaceholderSlot, slotId]);

  if ((import.meta as any).env.VITE_ENABLE_ADS === 'false') {
    return null;
  }

  return (
    <div className={`mt-8 w-full flex flex-col items-center justify-center ${className}`}>
      <div className="flex items-center space-x-1.5 mb-2">
        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          {lang === 'bn' ? 'বিজ্ঞাপন (স্পন্সরড)' : 'Sponsored'}
        </span>
        <Tooltip content={lang === 'bn' ? 'কৃষকদের জন্য প্ল্যাটফর্মটি বিনামূল্যে রাখতে সহায়তা করে' : 'Supporting Agri-Copilot keeps it free for farmers'} position="top">
          <HelpCircle className="w-3 h-3 text-slate-400" />
        </Tooltip>
      </div>

      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden p-3 min-h-[90px] w-full max-w-[728px] shadow-sm flex flex-col items-center justify-center relative transition-all">
        {/* Ad Container for Google AdSense */}
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', minHeight: '60px' }}
          data-ad-client={clientId}
          {...(slotId && !isPlaceholderSlot ? { 'data-ad-slot': slotId } : {})}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />

        {/* Informative Diagnostic State: Shown only if Ad is Unfilled, Blocked by AdBlocker, or Slot ID is Pending */}
        {(adStatus === 'unfilled' || adStatus === 'placeholder' || adStatus === 'blocked') && (
          <div className="py-2.5 px-4 text-center max-w-lg space-y-1.5 animate-fade-in">
            <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-semibold">
              {adStatus === 'blocked' ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>{lang === 'bn' ? 'ব্রাউজার অ্যাড-ব্লকার সনাক্ত হয়েছে (AdBlock active)' : 'AdBlocker detected in your browser'}</span>
                </>
              ) : (
                <>
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>
                    {lang === 'bn' 
                      ? 'গুগল অ্যাডসেন্স যাচাইকরণ মোড (AdSense Verification Mode)' 
                      : 'Google AdSense Verification Active'}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {adStatus === 'blocked'
                ? (lang === 'bn' ? 'অ্যাডসেন্স বিজ্ঞাপন দেখতে অ্যাড-ব্লকার নিষ্ক্রিয় করুন।' : 'Disable your ad-blocker or whitelist this URL to preview live ads.')
                : (lang === 'bn'
                    ? `অ্যাকাউন্ট ID: ${clientId} প্রস্তুত আছে। গুগল অ্যাডসেন্স কনসোলে এই ডোমেইনটি ("Sites") যুক্ত ও অনুমোদিত হলে স্বয়ংক্রিয়ভাবে লাইভ বিজ্ঞাপন প্রদর্শিত হবে।`
                    : `AdSense publisher ID (${clientId}) is loaded. Live ads will appear once this domain is added & approved in your AdSense "Sites" dashboard.`
                  )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import { translations, Language } from '../utils/translations';
import { HelpCircle } from 'lucide-react';
import Tooltip from './Tooltip';

interface GoogleAdProps {
  className?: string;
  lang?: Language;
}

export default function GoogleAd({ className = '', lang = 'en' }: GoogleAdProps) {
  const adRef = useRef<HTMLModElement>(null);
  const t = translations[lang] || translations.en;

  useEffect(() => {
    let timeoutId: number;

    const pushAd = () => {
      try {
        if (adRef.current) {
          // Check if ad is already initialized to avoid "All 'ins' elements... already have ads" error
          if (!adRef.current.getAttribute('data-adsbygoogle-status')) {
            // Check if element has width to avoid "No slot size for availableWidth=0" error
            if (adRef.current.offsetWidth > 0) {
              const adsbygoogle = (window as any).adsbygoogle || [];
              adsbygoogle.push({});
            } else {
              // Element not visible yet, retry later
              timeoutId = window.setTimeout(pushAd, 300);
            }
          }
        }
      } catch (e) {
        console.error("AdSense error", e);
      }
    };

    // Small initial delay to let CSS layout apply
    timeoutId = window.setTimeout(pushAd, 100);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const clientId = (import.meta as any).env.VITE_ADSENSE_CLIENT_ID || 'ca-pub-8294149074042302';
  const slotId = (import.meta as any).env.VITE_ADSENSE_SLOT_ID || '1234567890'; // Mock/Replace with actual slot

  if ((import.meta as any).env.VITE_ENABLE_ADS === 'false') {
    return null;
  }

  return (
    <div className={`mt-8 w-full flex flex-col items-center justify-center opacity-80 hover:opacity-100 transition-opacity ${className}`}>
      <div className="flex items-center space-x-1 mb-2">
        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sponsored</span>
        <Tooltip content="Supporting Agri-Copilot keeps it free for farmers" position="top">
          <HelpCircle className="w-3 h-3 text-gray-300" />
        </Tooltip>
      </div>
      <div className="bg-gray-50/50 backdrop-blur-md border border-gray-100 rounded-[24px] overflow-hidden p-2 min-h-[100px] w-full max-w-[728px] max-h-[90px] shadow-sm flex items-center justify-center relative">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '90px' }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}

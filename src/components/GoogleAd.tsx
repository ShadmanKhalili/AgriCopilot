import React, { useEffect, useRef } from 'react';
import { translations, Language } from '../utils/translations';
import { HelpCircle } from 'lucide-react';
import Tooltip from './Tooltip';

interface GoogleAdProps {
  className?: string;
  lang?: Language;
}

export default function GoogleAd({ className = '', lang = 'en' }: GoogleAdProps) {
  const adInitialized = useRef(false);
  const t = translations[lang] || translations.en;

  useEffect(() => {
    // Only push if we haven't already in this render cycle
    if (!adInitialized.current) {
      try {
        const adsbygoogle = (window as any).adsbygoogle || [];
        adsbygoogle.push({});
        adInitialized.current = true;
      } catch (e) {
        console.error("AdSense error", e);
      }
    }
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

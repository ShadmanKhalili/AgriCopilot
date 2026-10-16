import React, { useState } from 'react';
import { MonitorSmartphone, X, ExternalLink } from 'lucide-react';
import { detectInAppBrowser } from '../utils/environment';
import { Language } from '../utils/translations';

const COPY = {
  bn: {
    title: 'এখানে ক্যামেরা ও ভয়েস বন্ধ থাকবে',
    body: 'Messenger/Facebook-এর ভেতরের ব্রাউজার ক্যামেরা ও মাইক ব্লক করে। Chrome-এ খুললে সব ঠিকভাবে কাজ করবে।',
    action: 'Chrome-এ খুলুন',
    iosHint: 'সমাধান: নিচের শেয়ার আইকনে চাপ দিয়ে "Safari-তে খুলুন" বেছে নিন।',
    close: 'বন্ধ করুন'
  },
  en: {
    title: 'Camera & voice are blocked here',
    body: "Messenger or Facebook's built-in browser blocks the camera and microphone. Open in Chrome for everything to work.",
    action: 'Open in Chrome',
    iosHint: 'Fix: tap the Share icon below and choose "Open in Safari".',
    close: 'Close'
  }
} as const;

export default function InAppBrowserBanner({ lang }: { lang: Language }) {
  // Detected once at mount — the user agent cannot change mid-session.
  const [info] = useState(() => detectInAppBrowser());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('agri-inapp-banner-dismissed') === '1';
    } catch (e) {
      return false;
    }
  });

  if (!info.isInApp || dismissed) return null;

  const text = COPY[lang] ?? COPY.bn;
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('agri-inapp-banner-dismissed', '1');
    } catch (e) {}
  };

  return (
    <div
      className="md:hidden fixed z-[45] left-2 right-2 bottom-[calc(66px+env(safe-area-inset-bottom))] bg-amber-50 dark:bg-[#3a2a09] border border-amber-300/80 dark:border-amber-700/60 rounded-2xl shadow-lg p-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5">
        <MonitorSmartphone className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-amber-900 dark:text-amber-200 leading-snug">{text.title}</p>
          <p className="text-[12px] text-amber-800/90 dark:text-amber-300/90 leading-snug mt-0.5">{text.body}</p>
          {info.chromeIntentUrl ? (
            <a
              href={info.chromeIntentUrl}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-bold transition-colors active:scale-95"
            >
              {text.action}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-[12px] text-amber-900 dark:text-amber-200 font-medium mt-1.5">{text.iosHint}</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={text.close}
          className="p-1.5 -m-1 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 rounded-xl transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

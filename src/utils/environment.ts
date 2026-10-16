// Runtime mobile environment quirks the UI needs to warn about.
//
// Bangladesh farmers most often receive links inside social apps' in-app
// browsers (Messenger / Facebook / Instagram WebViews). Those embedded
// browsers block camera + microphone capture (the core of the Live Video
// Copilot) and cannot install the PWA, so we detect them and offer a
// one-tap hand-off to a real browser.

export interface InAppBrowserInfo {
  isInApp: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  /** Chrome intent:// URL that re-opens the current page in real Chrome (Android only). */
  chromeIntentUrl: string | null;
}

// User-agent fragments of the most common in-app browsers.
// Facebook app: "FBAN/" (iOS) / "[FB_IAB;FB4A;" (Android) — Messenger: "Orca".
const IN_APP_SIGNATURES = [
  'FBAN/', 'FBAV/', 'FB_IAB', 'FB4A', 'Orca-Android', 'Orca-IOS',
  'Instagram',
  'Line/',
  'MicroMessenger', 'WeChat',
  'musical_ly', 'TikTok', 'Bytedance',
  'Snapchat',
  'Telegram',
  'WhatsApp'
];

export function detectInAppBrowser(): InAppBrowserInfo {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const isAndroid = /Android/.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);

  // Desktop browsers never get the banner regardless of UA quirks.
  if (!isAndroid && !isIOS) {
    return { isInApp: false, isAndroid: false, isIOS: false, chromeIntentUrl: null };
  }

  // "…) ; wv)" is the generic Android WebView token used by embedded browsers.
  const isInApp = IN_APP_SIGNATURES.some(s => ua.includes(s)) ||
    (isAndroid && /;\s*wv\)/.test(ua));

  let chromeIntentUrl: string | null = null;
  if (isInApp && isAndroid) {
    const here = window.location.origin + window.location.pathname +
      window.location.search + window.location.hash;
    // Opens this exact URL in Chrome; if Chrome is missing the OS falls back
    // to browser_fallback_url (same URL in the system browser).
    chromeIntentUrl = `intent:${here.replace(/^https?:\/\//, '//')}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(here)};end`;
  }

  return { isInApp, isAndroid, isIOS, chromeIntentUrl };
}

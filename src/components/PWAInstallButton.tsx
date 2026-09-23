import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../utils/translations';

interface Props {
  lang: Language;
}

export const PWAInstallButton: React.FC<Props> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide button if already installed in standalone mode
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-800 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
        title={lang === 'bn' ? 'ফোনে ইনস্টল করুন (অফলাইন ব্যবহারের জন্য)' : 'Install App for Offline Use'}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title={lang === 'bn' ? 'আইফোনে হোম স্ক্রিনে যোগ করুন' : 'Add to iOS Home Screen'}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'আইওএস ইনস্টল' : 'Install iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                  {lang === 'bn' ? 'আইফোনে অ্যাপ ইনস্টল নির্দেশিকা' : 'Install on iPhone / iPad'}
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                {lang === 'bn' ? (
                  <>
                    ১. সাফারি ব্রাউজারের নিচের <strong>শেয়ার (Share)</strong> বাটনে ট্যাপ করুন।<br />
                    ২. তালিকায় নিচে স্ক্রোল করে <strong>'Add to Home Screen'</strong> নির্বাচন করুন।
                  </>
                ) : (
                  <>
                    1. Tap the <strong>Share</strong> button in Safari.<br />
                    2. Scroll down and select <strong>'Add to Home Screen'</strong>.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-stone-100 dark:bg-stone-800 py-2.5 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-200"
              >
                {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

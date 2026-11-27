import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import Card from './ui/Card';
import { useAuth } from './AuthProvider';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  currentPermission,
  disableNotifications,
  enableNotifications,
  isEnabled,
  isPushConfigured,
  isPushSupported,
} from '../services/pushNotifications';
import { toBn } from '../utils/banglaNum';

interface Props {
  lang: 'bn' | 'en';
  /** Defaults to the district the farmer chose in the app. */
  district?: string | null;
  /** Defaults to the upazila the farmer chose in the app. */
  upazila?: string | null;
}

type Status = 'checking' | 'on' | 'off' | 'working';

/**
 * One switch for phone notifications: area warnings and today's farm tasks.
 * Shows a plain explanation for every state the farmer can end up in.
 */
export default function NotificationSettings({ lang, district, upazila }: Props) {
  const bn = lang === 'bn';
  const { user, signIn } = useAuth();
  const { place } = useAppSettings();
  const chosenDistrict = district ?? place?.district ?? null;
  const chosenUpazila = upazila ?? place?.upazila ?? null;

  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(() => currentPermission() === 'denied');

  // What was last saved for this phone, so the same values are not saved twice.
  const savedFor = useRef('');
  const settingsKey = `${user?.uid ?? ''}|${lang}|${chosenDistrict ?? ''}|${chosenUpazila ?? ''}`;

  const supported = isPushSupported();
  const configured = isPushConfigured();

  useEffect(() => {
    let cancelled = false;
    if (!supported || !configured) return;
    isEnabled().then((on) => {
      if (!cancelled) setStatus(on ? 'on' : 'off');
    });
    return () => {
      cancelled = true;
    };
  }, [supported, configured, user?.uid]);

  // Keep the saved language and area current while notifications are on.
  useEffect(() => {
    if (status !== 'on' || !user || savedFor.current === settingsKey) return;
    savedFor.current = settingsKey;
    void enableNotifications({ lang, district: chosenDistrict, upazila: chosenUpazila });
  }, [status, user, settingsKey, lang, chosenDistrict, chosenUpazila]);

  const turnOn = useCallback(async () => {
    setStatus('working');
    setMessage(null);
    const result = await enableNotifications({ lang, district: chosenDistrict, upazila: chosenUpazila });
    if (result.ok) {
      savedFor.current = settingsKey;
      setBlocked(false);
      setStatus('on');
      return;
    }
    setStatus('off');
    if ('reason' in result && result.reason === 'denied') {
      setBlocked(currentPermission() === 'denied');
      setMessage(null);
    } else {
      setMessage(
        bn
          ? 'নোটিফিকেশন চালু করা গেল না। একটু পরে আবার চেষ্টা করুন।'
          : 'Could not turn notifications on. Please try again in a moment.'
      );
    }
  }, [lang, chosenDistrict, chosenUpazila, bn, settingsKey]);

  const turnOff = useCallback(async () => {
    setStatus('working');
    setMessage(null);
    const result = await disableNotifications();
    if (result.ok) {
      setStatus('off');
    } else {
      setStatus('on');
      setMessage(bn ? 'বন্ধ করা গেল না। আবার চেষ্টা করুন।' : 'Could not turn off. Please try again.');
    }
  }, [bn]);

  const title = bn ? 'ফোনে নোটিফিকেশন' : 'Phone notifications';
  const intro = bn
    ? 'আপনার এলাকার ফসলের সতর্কতা আর আজকের খামারের কাজ ফোনে জানানো হবে।'
    : 'Get a message on your phone for crop warnings in your area and for today’s farm tasks.';

  let note: React.ReactNode = null;
  let button: React.ReactNode;

  const buttonBase =
    'w-full min-h-[56px] rounded-2xl px-4 py-3 flex items-center justify-center gap-3 text-base font-bold transition-colors active:scale-[0.98] disabled:opacity-70';

  if (!supported) {
    note = (
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {bn
          ? 'এই ফোন বা ব্রাউজারে নোটিফিকেশন চলে না। Chrome ব্রাউজারে অ্যাপটি খুলে দেখুন।'
          : 'This phone or browser cannot show notifications. Try opening the app in Chrome.'}
      </p>
    );
  } else if (!configured) {
    note = (
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {bn ? 'এখনো চালু করা হয়নি।' : 'Not set up yet.'}
      </p>
    );
  } else if (!user) {
    button = (
      <button
        type="button"
        onClick={() => void signIn()}
        className={`${buttonBase} bg-emerald-700 hover:bg-emerald-800 text-white`}
      >
        <Bell className="w-6 h-6" aria-hidden="true" />
        {bn ? 'চালু করতে সাইন ইন করুন' : 'Sign in to turn on'}
      </button>
    );
  } else if (blocked) {
    note = (
      <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-3 text-sm text-amber-900 dark:text-amber-100 leading-relaxed space-y-1">
        <p className="font-bold">
          {bn ? 'ফোনের সেটিংসে নোটিফিকেশন বন্ধ করা আছে।' : 'Notifications are blocked in your phone settings.'}
        </p>
        <p>{bn ? `${toBn(1)}. ব্রাউজারের ঠিকানার পাশের তালার চিহ্নে চাপ দিন।` : '1. Tap the lock icon next to the address bar.'}</p>
        <p>{bn ? `${toBn(2)}. “নোটিফিকেশন” বা “অনুমতি” খুলে “অনুমতি দিন” বেছে নিন।` : '2. Open “Notifications” or “Permissions” and choose “Allow”.'}</p>
        <p>{bn ? `${toBn(3)}. তারপর এই পাতা আবার খুলুন।` : '3. Then reload this page.'}</p>
      </div>
    );
  } else if (status === 'on') {
    button = (
      <button
        type="button"
        onClick={() => void turnOff()}
        className={`${buttonBase} bg-emerald-700 hover:bg-emerald-800 text-white`}
        aria-pressed="true"
      >
        <Bell className="w-6 h-6" aria-hidden="true" />
        {bn ? 'চালু আছে — বন্ধ করতে চাপ দিন' : 'On — tap to turn off'}
      </button>
    );
  } else if (status === 'working' || status === 'checking') {
    button = (
      <button type="button" disabled className={`${buttonBase} bg-stone-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        {bn ? 'একটু অপেক্ষা করুন…' : 'Please wait…'}
      </button>
    );
  } else {
    button = (
      <button
        type="button"
        onClick={() => void turnOn()}
        className={`${buttonBase} bg-amber-500 hover:bg-amber-600 text-emerald-950`}
        aria-pressed="false"
      >
        <BellOff className="w-6 h-6" aria-hidden="true" />
        {bn ? 'বন্ধ আছে — চালু করতে চাপ দিন' : 'Off — tap to turn on'}
      </button>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-2xl text-emerald-700 dark:text-emerald-400 flex-shrink-0">
          <Bell className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {title}
        </h3>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{intro}</p>
      {note}
      {button}
      {message && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
          {message}
        </p>
      )}
    </Card>
  );
}

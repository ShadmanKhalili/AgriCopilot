import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Language } from '../utils/translations';
import type { UiMode } from '../nav/tabs';
import { safeStorage } from '../utils/security';
import { isInsideBangladesh } from '../utils/geolocation';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type Theme = 'light' | 'dark';

interface AppSettings {
  lang: Language;
  setLang: React.Dispatch<React.SetStateAction<Language>>;
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  /** How much of the app is shown: the few core tools, or everything. */
  mode: UiMode;
  setMode: (mode: UiMode) => void;
  /** Whether this device has been through the first-run welcome. */
  hasOnboarded: boolean;
  setHasOnboarded: (done: boolean) => void;
  /** The farmer's saved position; null until GPS or a manual choice sets it. */
  location: Coordinates | null;
  setLocation: (location: Coordinates | null) => void;
}

const LANG_KEY = 'krishi_lang';
const THEME_KEY = 'krishi_theme';
const MODE_KEY = 'krishi_ui_mode';
const ONBOARDED_KEY = 'krishi_onboarded';
const LOCATION_KEY = 'smart_krishi_global_location';

const AppSettingsContext = createContext<AppSettings | null>(null);

const readLang = (): Language => {
  // A `?lang=` link (the sitemap's alternate-language URLs) wins; otherwise
  // the farmer's last choice is kept across visits.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl === 'en' || fromUrl === 'bn') return fromUrl;
  } catch {
    // No usable URL: fall through to the saved choice.
  }
  return safeStorage.getItem<string>(LANG_KEY, 'bn') === 'en' ? 'en' : 'bn';
};

/** A saved position, kept only when it is inside Bangladesh. */
export const parseSavedLocation = (raw: string | null): Coordinates | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.latitude === 'number' &&
      typeof parsed?.longitude === 'number' &&
      isInsideBangladesh(parsed.latitude, parsed.longitude)
    ) {
      return { latitude: parsed.latitude, longitude: parsed.longitude };
    }
  } catch {
    // A corrupt value is treated as no saved position.
  }
  return null;
};

const readLocation = (): Coordinates | null => {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    const location = parseSavedLocation(raw);
    // Drop a stale position saved outside Bangladesh.
    if (raw && !location) localStorage.removeItem(LOCATION_KEY);
    return location;
  } catch {
    return null;
  }
};

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>(readLang);
  // safeStorage swallows SecurityError / QuotaExceededError. A locked-down
  // in-app browser (Messenger/Facebook webview) must not brick the app on the
  // very first render.
  const [theme, setTheme] = useState<Theme>(() =>
    safeStorage.getItem<string>(THEME_KEY, 'light') === 'dark' ? 'dark' : 'light'
  );
  const [mode, setModeState] = useState<UiMode>(() =>
    safeStorage.getItem<string>(MODE_KEY, 'full') === 'simple' ? 'simple' : 'full'
  );
  const [hasOnboarded, setHasOnboardedState] = useState<boolean>(
    () => safeStorage.getItem<string>(ONBOARDED_KEY, '') === 'true'
  );
  const [location, setLocationState] = useState<Coordinates | null>(readLocation);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
    safeStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    safeStorage.setItem(LANG_KEY, lang);
    // Keep a `?lang=` link in step with a manual switch, so a reload does not
    // flip the language back.
    const url = new URL(window.location.href);
    if (url.searchParams.has('lang') && url.searchParams.get('lang') !== lang) {
      url.searchParams.set('lang', lang);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, [lang]);

  const setMode = useCallback((next: UiMode) => {
    setModeState(next);
    safeStorage.setItem(MODE_KEY, next);
  }, []);

  const setHasOnboarded = useCallback((done: boolean) => {
    setHasOnboardedState(done);
    safeStorage.setItem(ONBOARDED_KEY, done ? 'true' : '');
  }, []);

  const setLocation = useCallback((next: Coordinates | null) => {
    setLocationState(next);
    if (!next) return;
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Could not save location:', e);
    }
  }, []);

  const value = useMemo<AppSettings>(
    () => ({ lang, setLang, theme, setTheme, mode, setMode, hasOnboarded, setHasOnboarded, location, setLocation }),
    [lang, theme, mode, setMode, hasOnboarded, setHasOnboarded, location, setLocation]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettings {
  const settings = useContext(AppSettingsContext);
  if (!settings) throw new Error('useAppSettings must be used inside AppSettingsProvider');
  return settings;
}

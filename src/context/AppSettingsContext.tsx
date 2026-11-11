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
  /**
   * The view the farmer picked: the few core tools, or everything. Null until
   * they pick one; `useUiMode` then chooses a default from their role.
   */
  modePreference: UiMode | null;
  setModePreference: (mode: UiMode) => void;
  /** Whether this device has been through the first-run welcome. */
  hasOnboarded: boolean;
  setHasOnboarded: (done: boolean) => void;
  /** The farmer's saved position; null until GPS or a manual choice sets it. */
  location: Coordinates | null;
  setLocation: (location: Coordinates | null) => void;
  /**
   * The district and upazila the farmer chose by name. GPS alone can only
   * tell the district reliably, so the upazila is kept only when picked.
   */
  place: Place | null;
  setPlace: (place: Place | null) => void;
  /** The crop the farmer mainly grows, as picked in the welcome screens. */
  mainCrop: string | null;
  setMainCrop: (crop: string | null) => void;
}

export interface Place {
  district: string;
  districtBn: string;
  upazila?: string;
  upazilaBn?: string;
}

const LANG_KEY = 'krishi_lang';
const THEME_KEY = 'krishi_theme';
const MODE_KEY = 'krishi_ui_mode';
const ONBOARDED_KEY = 'krishi_onboarded';
const LOCATION_KEY = 'smart_krishi_global_location';
const PLACE_KEY = 'krishi_place';
const MAIN_CROP_KEY = 'krishi_main_crop';

const readMode = (): UiMode | null => {
  const saved = safeStorage.getItem<string>(MODE_KEY, '');
  return saved === 'simple' || saved === 'full' ? saved : null;
};

const readPlace = (): Place | null => {
  const saved = safeStorage.getItem<any>(PLACE_KEY, null);
  if (!saved || typeof saved.district !== 'string' || !saved.district) return null;
  return {
    district: saved.district,
    districtBn: typeof saved.districtBn === 'string' ? saved.districtBn : saved.district,
    upazila: typeof saved.upazila === 'string' ? saved.upazila : undefined,
    upazilaBn: typeof saved.upazilaBn === 'string' ? saved.upazilaBn : undefined,
  };
};

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
  const [modePreference, setModeState] = useState<UiMode | null>(readMode);
  const [place, setPlaceState] = useState<Place | null>(readPlace);
  const [mainCrop, setMainCropState] = useState<string | null>(
    () => safeStorage.getItem<string>(MAIN_CROP_KEY, '') || null
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

  const setModePreference = useCallback((next: UiMode) => {
    setModeState(next);
    safeStorage.setItem(MODE_KEY, next);
  }, []);

  const setPlace = useCallback((next: Place | null) => {
    setPlaceState(next);
    if (next) safeStorage.setItem(PLACE_KEY, next);
    else safeStorage.removeItem(PLACE_KEY);
  }, []);

  const setMainCrop = useCallback((next: string | null) => {
    setMainCropState(next);
    safeStorage.setItem(MAIN_CROP_KEY, next || '');
  }, []);

  const setHasOnboarded = useCallback((done: boolean) => {
    setHasOnboardedState(done);
    safeStorage.setItem(ONBOARDED_KEY, done ? 'true' : '');
  }, []);

  const setLocation = useCallback((next: Coordinates | null) => {
    setLocationState(next);
    // A new position makes the previously chosen district and upazila stale.
    // Callers that know the names call `setPlace` right after.
    setPlaceState(null);
    safeStorage.removeItem(PLACE_KEY);
    if (!next) return;
    try {
      localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Could not save location:', e);
    }
  }, []);

  const value = useMemo<AppSettings>(
    () => ({
      lang, setLang, theme, setTheme, modePreference, setModePreference,
      hasOnboarded, setHasOnboarded, location, setLocation, place, setPlace, mainCrop, setMainCrop,
    }),
    [
      lang, theme, modePreference, setModePreference, hasOnboarded, setHasOnboarded,
      location, setLocation, place, setPlace, mainCrop, setMainCrop,
    ]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettings {
  const settings = useContext(AppSettingsContext);
  if (!settings) throw new Error('useAppSettings must be used inside AppSettingsProvider');
  return settings;
}

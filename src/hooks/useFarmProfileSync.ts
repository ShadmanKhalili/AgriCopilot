import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useAppSettings } from '../context/AppSettingsContext';
import { useCropPlan } from './useCropPlan';
import {
  farmProfileKey,
  hasOnboardingAnswers,
  mergeFarmProfile,
  readFarmProfile,
  readSyncedUid,
  shouldServerWin,
  toFarmProfileDoc,
  writeFarmProfile,
  writeSyncedUid,
  type FarmProfileDoc,
} from '../services/farmProfile';

/** Wait this long after the last change before writing, so a burst is one write. */
export const FARM_PROFILE_DEBOUNCE_MS = 2000;

const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

const urlHasLang = (): boolean => {
  try {
    const value = new URLSearchParams(window.location.search).get('lang');
    return value === 'en' || value === 'bn';
  } catch {
    return false;
  }
};

/**
 * Mirrors the farmer's onboarding answers into `users/{uid}/farm_profile/main`
 * for any signed-in user (guests included), and restores them on a new device.
 *
 * - First run per account: read the server document and merge it with the
 *   device field by field (device wins where it has a value; the server fills
 *   the gaps and is copied into the app). If a different account last synced
 *   on this device, the server wins instead. The merged profile is written back.
 * - After that, any change to language, place, position, main crop or crop
 *   plan is written (full document, 2 s debounce) when it differs from what
 *   was last read or written.
 * - Never writes before the server read has succeeded, so a failed read can
 *   not wipe a profile that exists. Offline: waits and retries on 'online'.
 *
 * Needs both AppSettingsProvider and AuthProvider above it. Never throws.
 */
export function useFarmProfileSync(): void {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { lang, setLang, place, setPlace, location, setLocation, mainCrop, setMainCrop } = useAppSettings();
  const [cropPlan, setCropPlan] = useCropPlan();

  // Bumped on the browser's 'online' event to re-run a read or write that was skipped.
  const [onlineTick, setOnlineTick] = useState(0);
  // The uid whose server profile has been read; writes wait for it.
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  // Key of the profile the server is known to hold (read or last written).
  const serverKey = useRef<{ uid: string; key: string | null } | null>(null);

  const doc = useMemo(
    () => toFarmProfileDoc({ lang, mainCrop, place, location, cropPlan }),
    [lang, mainCrop, place, location, cropPlan]
  );
  const docKey = useMemo(() => farmProfileKey(doc), [doc]);

  // Always-current view for the async restore, which must not act on stale values.
  const latest = useRef({ doc, lang, setLang, setPlace, setLocation, setMainCrop, setCropPlan, location });
  latest.current = { doc, lang, setLang, setPlace, setLocation, setMainCrop, setCropPlan, location };
  const firstLang = useRef(lang);

  // The write waiting for the debounce, with the uid it is meant for.
  const pending = useRef<{ uid: string; doc: FarmProfileDoc; key: string } | null>(null);
  const flush = useCallback(() => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    if (!isOnline()) return; // 'online' re-runs the write effect, which sets it again
    writeFarmProfile(job.uid, job.doc)
      .then(() => {
        if (serverKey.current?.uid === job.uid) serverKey.current = { uid: job.uid, key: job.key };
      })
      .catch((error) => {
        // Left unmarked, so the next change or reconnect tries again.
        console.warn('[farm profile] could not save the profile', error?.code || error);
      });
  }, []);

  useEffect(() => {
    const retry = () => setOnlineTick((n) => n + 1);
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  // 1. First run per account: read the server profile, restore if this device is empty.
  useEffect(() => {
    if (!uid || !isOnline()) return;
    if (serverKey.current?.uid === uid) return;
    let cancelled = false;

    (async () => {
      try {
        const server = await readFarmProfile(uid);
        if (cancelled) return;
        const now = latest.current;

        if (server) {
          // Per-field merge: the device wins where it has a value, the server fills
          // the gaps. A different account signing in on this device: the server wins.
          const serverWins = shouldServerWin(readSyncedUid(), uid, true);
          // Keep a language the farmer picked since the page opened, or a ?lang= link.
          const picked = now.lang !== firstLang.current || urlHasLang();
          const deviceLangChosen = picked || (hasOnboardingAnswers(now.doc) && !serverWins);
          const merged = mergeFarmProfile(now.doc, server, { serverWins, deviceLangChosen });

          // The location goes first because setLocation clears the place.
          const locationChanged = !!merged.location && JSON.stringify(merged.location) !== JSON.stringify(now.doc.location);
          if (locationChanged && merged.location) now.setLocation(merged.location);
          if (merged.place && (locationChanged || JSON.stringify(merged.place) !== JSON.stringify(now.doc.place))) {
            now.setPlace(merged.place);
          }
          if (merged.mainCrop && merged.mainCrop !== now.doc.mainCrop) now.setMainCrop(merged.mainCrop);
          if (merged.cropPlan && JSON.stringify(merged.cropPlan) !== JSON.stringify(now.doc.cropPlan)) {
            now.setCropPlan(merged.cropPlan);
          }
          if (merged.lang !== now.lang) now.setLang(merged.lang);
        }
        writeSyncedUid(uid);

        // What the server holds, so a restore (or an unchanged device) triggers no write.
        serverKey.current = { uid, key: server ? farmProfileKey(server) : null };
        setLoadedUid(uid);
      } catch (error) {
        if (!cancelled) console.warn('[farm profile] could not read the saved profile', (error as any)?.code || error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, onlineTick]);

  // 2. Write changes (debounced) once the server profile is known.
  useEffect(() => {
    if (!uid || loadedUid !== uid || serverKey.current?.uid !== uid) return;
    if (serverKey.current.key === docKey) {
      if (pending.current?.uid === uid) pending.current = null; // changed back: nothing to send
      return;
    }
    if (!isOnline()) return; // the 'online' event bumps onlineTick and re-runs this

    pending.current = { uid, doc, key: docKey };
    const timer = setTimeout(flush, FARM_PROFILE_DEBOUNCE_MS);

    // Only the timer goes; the pending write stays so a flush can still send it.
    return () => clearTimeout(timer);
  }, [uid, loadedUid, docKey, doc, onlineTick, flush]);

  // Send a pending write when the page is hidden or closed, and when this
  // account's sync ends (uid change or unmount), instead of dropping it.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  useEffect(() => flush, [uid, flush]);
}

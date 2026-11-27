import { useCallback, useEffect, useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';
import { useAuth } from '../components/AuthProvider';
import type { AreaWarning, StoredBroadcast } from '../services/areaReports';
import { diseaseNameFromSlug, type WarningWords } from '../utils/areaWarningText';

type Lang = 'bn' | 'en';
type LabelForKey = (key: string, lang: Lang) => string | null;

export type AreaWarningsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; warnings: AreaWarning[]; broadcasts: StoredBroadcast[] };

/**
 * What the farmer's own area has to say today: warnings (3 or more different
 * farmers) and messages from the team. Nothing is read unless the farmer is
 * signed in; a failed read looks the same as "nothing to show".
 */
export function useAreaWarnings(lang: Lang, options: { broadcasts?: boolean } = {}) {
  const { user } = useAuth();
  const { place } = useAppSettings();
  const uid = user?.uid ?? null;
  const district = place?.district ?? null;
  const upazila = place?.upazila ?? null;
  const wantBroadcasts = options.broadcasts ?? true;

  const [state, setState] = useState<AreaWarningsState>({ status: 'idle' });
  const [labelForKey, setLabelForKey] = useState<LabelForKey | null>(null);

  useEffect(() => {
    if (!uid || !district) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    // The area service and the disease names are loaded on demand to keep the first load small.
    Promise.all([import('../services/areaReports'), import('../utils/diseaseKey')])
      .then(async ([areas, keys]) => {
        const [warnings, broadcasts] = await Promise.all([
          upazila ? areas.fetchAreaWarnings(district, upazila) : Promise.resolve([] as AreaWarning[]),
          wantBroadcasts ? areas.fetchBroadcasts(district) : Promise.resolve([] as StoredBroadcast[]),
        ]);
        if (cancelled) return;
        setLabelForKey(() => keys.diseaseLabelForKey);
        setState({ status: 'ready', warnings, broadcasts });
      })
      .catch((error) => {
        console.warn('[AreaWarnings] could not load:', error);
        if (!cancelled) setState({ status: 'ready', warnings: [], broadcasts: [] });
      });
    return () => { cancelled = true; };
  }, [uid, district, upazila, wantBroadcasts]);

  /** The words for one warning, in the farmer's language. */
  const wordsFor = useCallback(
    (warning: AreaWarning): WarningWords => ({
      farmers: warning.farmers,
      crop: warning.crop,
      disease: labelForKey ? diseaseNameFromSlug(warning.diseaseKey, lang, labelForKey) : null,
    }),
    [labelForKey, lang]
  );

  return { state, wordsFor, signedIn: !!uid, district, upazila };
}

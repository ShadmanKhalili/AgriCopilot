/**
 * Global expert-availability indicator.
 *
 * Keeps a cheap aggregate count of experts currently accepting new requests
 * (`status == 'active'` in experts_public) so any surface — header, bottom
 * nav, post-diagnosis CTA — can show an honest live badge.
 *
 * - Guests (not signed in): count stays `null` → surfaces render a neutral
 *   expert CTA without claiming anyone is online.
 * - Firestore failures (e.g. rules not yet deployed): silent, `null` again.
 *   Never breaks the host page.
 * - Refreshed on focus and every 2 minutes so the badge stays live without a
 *   permanent Firestore listener.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { fetchActiveExpertCount } from '../services/expertService';

export function useExpertAvailability() {
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setOnlineCount(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const load = () => {
      fetchActiveExpertCount()
        .then((count) => {
          if (!cancelled) setOnlineCount(count);
        })
        .catch(() => {
          // Rules not deployed / offline — show the neutral CTA, never error.
          if (!cancelled) setOnlineCount(null);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    };

    load();
    const timer = window.setInterval(load, 120_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user?.uid]);

  return { onlineCount, isLoading };
}

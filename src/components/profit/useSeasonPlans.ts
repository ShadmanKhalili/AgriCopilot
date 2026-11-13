import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Language } from '../../utils/translations';
import { deleteSeason, listSeasons, saveSeason } from '../../services/seasons';
import { sortSeasons, type SeasonInput, type SeasonPlan } from '../../utils/seasonMath';

/** Toast for a write that reached the screen but not the account. */
export const accountSaveFailed = (lang: Language) =>
  toast.error(
    lang === 'bn'
      ? 'অ্যাকাউন্টে রাখা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।'
      : 'Could not save to your account. Check the internet and try again.'
  );

/**
 * The farmer's saved plans: loads them, saves and deletes them, and keeps
 * track of the one that is open. Signed out (`uid` null) they stay on the phone.
 */
export function useSeasonPlans(uid: string | null, lang: Language) {
  const [plans, setPlans] = useState<SeasonPlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setOpenId(null);
    listSeasons(uid)
      .then((list) => { if (alive) setPlans(list); })
      .catch(() => {
        if (!alive) return;
        setPlans([]);
        toast.error(lang === 'bn' ? 'আপনার রাখা হিসাব আনা যায়নি।' : 'Could not load your saved plans.');
      })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // lang only changes toast wording; reloading on it is not needed.
  }, [uid]);

  /** Save a new plan, or update `existing`. Returns the stored plan, or null when it is not valid. */
  const save = useCallback(
    (input: SeasonInput, existing?: SeasonPlan | null): SeasonPlan | null => {
      let pending;
      try {
        pending = saveSeason(uid, input, existing ?? null);
      } catch {
        toast.error(
          lang === 'bn'
            ? 'হিসাবটি রাখা গেল না। জমি, দাম ও খরচ ঠিক আছে কিনা দেখুন।'
            : 'This plan could not be saved. Check the land, price and cost.'
        );
        return null;
      }
      const { item, saved } = pending;
      setPlans((prev) => sortSeasons([item, ...prev.filter((p) => p.id !== item.id)]));
      setOpenId(item.id);
      saved.catch(() => accountSaveFailed(lang));
      return item;
    },
    [uid, lang]
  );

  const remove = useCallback(
    async (plan: SeasonPlan) => {
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      setOpenId((id) => (id === plan.id ? null : id));
      try {
        await deleteSeason(uid, plan.id);
      } catch {
        setPlans((prev) => sortSeasons([plan, ...prev.filter((p) => p.id !== plan.id)]));
        toast.error(lang === 'bn' ? 'হিসাবটি মোছা যায়নি।' : 'Could not delete the plan.');
      }
    },
    [uid, lang]
  );

  const openPlan = plans.find((p) => p.id === openId) ?? null;

  return { plans, loaded, openPlan, setOpenId, save, remove };
}

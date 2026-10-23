/**
 * Count of farmer consultations whose latest message came from the expert and
 * has not been opened on this device yet. Mounted once in Layout so the nav
 * badge is visible on every tab, even before Expert Hub is opened.
 *
 * The subscription itself is owned by `useFarmerConsultations`, so mounting
 * Expert Hub does not open a second listener on the same query.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useFarmerConsultations } from './useFarmerConsultations';
import { EXPERT_READ_EVENT, isConsultationUnread } from '../utils/expertReadState';
import type { Consultation } from '../utils/expertTypes';

export function useExpertUnread(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const itemsRef = useRef<Consultation[]>([]);

  const consultations = useFarmerConsultations(!!user?.uid);

  // A new snapshot arrives as a new list — recompute the badge from it.
  useEffect(() => {
    itemsRef.current = consultations;
    setCount(consultations.filter((c) => isConsultationUnread(c)).length);
  }, [consultations]);

  useEffect(() => {
    if (!user?.uid) {
      itemsRef.current = [];
      setCount(0);
      return;
    }

    const compute = () =>
      setCount(itemsRef.current.filter((c) => isConsultationUnread(c)).length);

    // Opening a room or returning to the tab must clear the badge immediately.
    const onChange = () => compute();
    window.addEventListener(EXPERT_READ_EVENT, onChange);
    window.addEventListener('focus', onChange);

    return () => {
      window.removeEventListener(EXPERT_READ_EVENT, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [user?.uid]);

  return count;
}

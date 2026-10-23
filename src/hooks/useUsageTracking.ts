import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firestore';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function useUsageTracking(tabId: string = 'global') {
  const { user, userProfile } = useAuth();
  const [anonUsage, setAnonUsage] = useState(0);
  const [premiumUsage, setPremiumUsage] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    
    if (!user) {
      const storedDate = localStorage.getItem(`anonDate_${tabId}`);
      if (storedDate === today) {
        const stored = localStorage.getItem(`anonUsage_${tabId}`);
        setAnonUsage(stored ? parseInt(stored, 10) : 0);
      } else {
        setAnonUsage(0);
      }
    } else {
      const storedDate = localStorage.getItem(`premiumDate_${user.uid}_${tabId}`);
      if (storedDate === today) {
        const stored = localStorage.getItem(`premiumUsage_${user.uid}_${tabId}`);
        setPremiumUsage(stored ? parseInt(stored, 10) : 0);
      } else {
        setPremiumUsage(0);
      }
    }
  }, [user, tabId]);

  const getLimit = () => {
    if (!user) return 10; // 10 per tab for guest
    if (userProfile?.tier === 'premium') return 9999; // Unlimited effectively for paid
    return 100; // Fair use cap of 100 per day globally for free
  };

  /**
   * Local safety counter used while the Firestore profile has not loaded yet.
   * It is date-stamped like the guest and premium counters: without a date the
   * counter never reset, so a single offline window could lock the farmer out
   * of every AI feature for good.
   */
  const readFallbackUsage = (): number => {
    if (!user) return 0;
    const today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem(`fallbackDate_${user.uid}_${tabId}`) !== today) return 0;
    const stored = localStorage.getItem(`fallbackUsage_${user.uid}_${tabId}`);
    return stored ? parseInt(stored, 10) : 0;
  };

  const getPremiumLimit = () => {
     if (!user) return 0; // Guest cannot use premium
     if (userProfile?.tier === 'premium') return 9999;
     return 1; // Free account gets 1 premium analysis per tab
  }

  const getCurrentUsage = () => {
    if (!user) return anonUsage;
    const today = new Date().toISOString().split('T')[0];
    if (!userProfile) {
      // Profile hasn't loaded yet: fall back to the local safety counter so the
      // quota gate is never a silent no-op during that window.
      return readFallbackUsage();
    }
    if (userProfile?.lastUsedDate !== today) {
      return 0;
    }
    return userProfile?.usageCount || 0;
  };

  const canUse = () => {
    return getCurrentUsage() < getLimit();
  };

  const canUsePremium = () => {
     return premiumUsage < getPremiumLimit();
  }

  const incrementUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (!user) {
      const newUsage = anonUsage + 1;
      setAnonUsage(newUsage);
      localStorage.setItem(`anonUsage_${tabId}`, newUsage.toString());
      localStorage.setItem(`anonDate_${tabId}`, today);
    } else if (userProfile) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const { increment } = await import('firebase/firestore');
        
        if (userProfile.lastUsedDate !== today) {
          await updateDoc(userDocRef, {
            usageCount: 1,
            lastUsedDate: today
          });
        } else {
          await updateDoc(userDocRef, {
            usageCount: increment(1)
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    } else if (user) {
      // Profile hasn't loaded yet: track locally so the quota gate still degrades
      // safely during this window (otherwise calls are invisible to the limiter).
      const newUsage = readFallbackUsage() + 1;
      localStorage.setItem(`fallbackUsage_${user.uid}_${tabId}`, newUsage.toString());
      localStorage.setItem(`fallbackDate_${user.uid}_${tabId}`, today);
      console.warn("Usage tracked locally - user profile not yet loaded.");
    }
  };

  const incrementPremiumUsage = () => {
      if (!user) return;
      const today = new Date().toISOString().split('T')[0];
      const newUsage = premiumUsage + 1;
      setPremiumUsage(newUsage);
      localStorage.setItem(`premiumUsage_${user.uid}_${tabId}`, newUsage.toString());
      localStorage.setItem(`premiumDate_${user.uid}_${tabId}`, today);
  };

  return {
    canUse,
    canUsePremium,
    incrementUsage,
    incrementPremiumUsage,
    currentUsage: getCurrentUsage(),
    limit: getLimit(),
    premiumLimit: getPremiumLimit(),
    currentPremiumUsage: premiumUsage,
    tier: user ? (userProfile?.tier || 'free') : 'anon'
  };
}

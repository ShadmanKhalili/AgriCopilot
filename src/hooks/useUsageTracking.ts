import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function useUsageTracking() {
  const { user, userProfile } = useAuth();
  const [anonUsage, setAnonUsage] = useState(0);

  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem('anonUsageCount');
      if (stored) {
        setAnonUsage(parseInt(stored, 10));
      }
    }
  }, [user]);

  const getLimit = () => {
    if (!user) return 5;
    if (userProfile?.tier === 'premium') return 50;
    return 10; // Free tier
  };

  const getCurrentUsage = () => {
    const today = new Date().toISOString().split('T')[0];
    if (!user) {
      const lastDate = localStorage.getItem('anonLastUsedDate');
      if (lastDate !== today) {
        return 0;
      }
      return anonUsage;
    }
    if (userProfile?.lastUsedDate !== today) {
      return 0;
    }
    return userProfile?.usageCount || 0;
  };

  const canUse = () => {
    return getCurrentUsage() < getLimit();
  };

  const incrementUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (!user) {
      const lastDate = localStorage.getItem('anonLastUsedDate');
      let newUsage = 1;
      if (lastDate === today) {
        newUsage = anonUsage + 1;
      }
      setAnonUsage(newUsage);
      localStorage.setItem('anonUsageCount', newUsage.toString());
      localStorage.setItem('anonLastUsedDate', today);
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
    }
  };

  return {
    canUse,
    incrementUsage,
    currentUsage: getCurrentUsage(),
    limit: getLimit(),
    tier: user ? (userProfile?.tier || 'free') : 'anon'
  };
}

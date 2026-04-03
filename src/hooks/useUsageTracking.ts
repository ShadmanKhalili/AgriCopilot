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
    if (!user) return anonUsage;
    return userProfile?.usageCount || 0;
  };

  const canUse = () => {
    return getCurrentUsage() < getLimit();
  };

  const incrementUsage = async () => {
    if (!user) {
      const newUsage = anonUsage + 1;
      setAnonUsage(newUsage);
      localStorage.setItem('anonUsageCount', newUsage.toString());
    } else if (userProfile) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const { increment } = await import('firebase/firestore');
        await updateDoc(userDocRef, {
          usageCount: increment(1)
        });
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

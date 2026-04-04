import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: string;
  tier: 'free' | 'premium';
  usageCount: number;
  lastUsedDate?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  userProfile: UserProfile | null;
  isAuthReady: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  userProfile: null,
  isAuthReady: false,
  signIn: async () => {},
  signOut: async () => {},
  upgradeToPremium: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Cleanup previous snapshot if it exists
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          
          // Initial check for profile
          let userDoc;
          try {
            userDoc = await getDoc(userDocRef);
          } catch (error: any) {
            // If it's a permission error, it might be transient during sign-in
            if (error.message?.includes('insufficient permissions')) {
              console.warn("Initial getDoc failed with permission error, retrying in 1s...");
              await new Promise(res => setTimeout(res, 1000));
              userDoc = await getDoc(userDocRef);
            } else {
              throw error;
            }
          }
          
          if (!userDoc.exists()) {
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || '',
              role: 'agri-preneur',
              tier: 'free',
              usageCount: 0,
              lastUsedDate: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
          }
          
          // Listen for profile updates
          unsubSnapshot = onSnapshot(userDocRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              setUserProfile(data);
              setUserRole(data.role);
            }
          }, (error) => {
            // Only report error if user is still logged in and it's not a transient permission error
            if (auth.currentUser && !error.message?.includes('insufficient permissions')) {
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            }
          });

        } catch (error) {
          if (auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          }
        }
      } else {
        setUserRole(null);
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => {
      unsubscribe();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const upgradeToPremium = async () => {
    if (user) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { tier: 'premium' });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, userProfile, isAuthReady, signIn: signInWithGoogle, signOut: logout, upgradeToPremium }}>
      {children}
    </AuthContext.Provider>
  );
};

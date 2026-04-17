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
            console.warn("Initial getDoc failed:", error.message);
            // If it's a permission or offline error, it might be transient. Retry.
            if (error.message?.includes('insufficient permissions') || error.message?.includes('client is offline')) {
              console.warn("Retrying in 2s...");
              await new Promise(res => setTimeout(res, 2000));
              try {
                userDoc = await getDoc(userDocRef);
              } catch (retryError: any) {
                console.error("Retry failed:", retryError.message);
                if (!retryError.message?.includes('client is offline')) {
                  handleFirestoreError(retryError, OperationType.GET, userDocRef.path);
                }
              }
            } else {
              handleFirestoreError(error, OperationType.GET, userDocRef.path);
            }
          }
          
          if (userDoc && !userDoc.exists()) {
            const isAdminEmail = currentUser.email === 'sadmankhalili@gmail.com';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || '',
              role: isAdminEmail ? 'admin' : 'agri-preneur',
              tier: isAdminEmail ? 'premium' : 'free',
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
            // Only report error if user is still logged in and it's not a transient connection/permission error
            if (auth.currentUser && !error.message?.includes('insufficient permissions') && !error.message?.includes('client is offline')) {
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            }
          });

        } catch (error: any) {
          if (auth.currentUser) {
            if (error.message?.includes('client is offline')) {
              console.warn("Could not create/fetch profile: Client is offline");
            } else {
              handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            }
          }
        } finally {
          setIsAuthReady(true);
        }
      } else {
        setUserRole(null);
        setUserProfile(null);
        setIsAuthReady(true);
      }
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

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logout, signUpWithEmail, loginWithEmail, signInAsGuest as startGuestSession, linkGuestWithGoogle, isGuestUser } from '../firebase';
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
  /** Human expert layer (Phase 1): set by the admin approval flow. */
  expertLevel?: 'provisional' | 'verified' | 'senior';
  orgId?: string;
}

interface AuthContextType {
  user: User | null;
  userRole: string | null;
  userProfile: UserProfile | null;
  isAuthReady: boolean;
  /** True for the platform superadmin role. */
  isAdmin: boolean;
  /** True for verified human experts (expert / org_admin roles). */
  isExpert: boolean;
  /** True while the signed-in user is an anonymous guest (no email/Google yet). */
  isGuest: boolean;
  signIn: () => Promise<void>;
  /** One-tap anonymous session — no email, password or Google account. */
  signInAsGuest: () => Promise<void>;
  /** Convert the current guest into a Google account without losing data. */
  saveGuestAccount: () => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  userProfile: null,
  isAuthReady: false,
  isAdmin: false,
  isExpert: false,
  isGuest: false,
  signIn: async () => {},
  signInAsGuest: async () => {},
  saveGuestAccount: async () => {},
  signUpWithEmail: async () => {},
  loginWithEmail: async () => {},
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
    // uid the currently loaded profile belongs to, so a profile from a previous
    // account is never shown for a different one.
    let profileUid: string | null = null;
    // Monotonic id of the latest auth-state change. An auth change can arrive
    // while an earlier one is still awaiting Firestore (the profile fetch does
    // one or more network round trips). Only the newest change may install a
    // profile listener — see the guard before `onSnapshot` below.
    let authChangeId = 0;

    const handleAuthStateChanged = async (currentUser: User | null) => {
      const changeId = ++authChangeId;

      // Cleanup previous snapshot if it exists
      if (unsubSnapshot) {
        unsubSnapshot();
        unsubSnapshot = null;
      }

      // The signed-in account changed: drop the previous account's profile so
      // its role (e.g. admin) and usage counter are never carried over.
      if (profileUid !== (currentUser?.uid ?? null)) {
        setUserProfile(null);
        setUserRole(null);
        profileUid = null;
      }

      setUser(currentUser);
      if (currentUser) {
        try {
          // Firestore is loaded on demand: guests never download the Firestore SDK.
          const [{ doc, getDoc, setDoc, onSnapshot, updateDoc }, { db }] = await Promise.all([
            import('firebase/firestore'),
            import('../firestore'),
          ]);

          // A newer auth change already started while we were loading Firestore.
          // Abandon this one so it cannot write a stale profile or install a
          // listener that the newer change will orphan.
          if (changeId !== authChangeId) return;

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
                throw retryError; // Outer catch performs the single formal error report
              }
            } else {
              throw error; // Outer catch performs the single formal error report
            }
          }
          
          if (userDoc && !userDoc.exists()) {
            // Must match firestore.rules isAdmin(): owner email AND verified email
            const isAdminEmail = currentUser.email === 'sadmankhalili@gmail.com' && currentUser.emailVerified === true;
            const isGuest = isGuestUser(currentUser);
            const guestId = currentUser.uid.slice(0, 6).toLowerCase();
            // firestore.rules requires a 3+ character email string. Anonymous
            // users have no email, so use a clearly-labelled local placeholder
            // that is never used for mail. Real email is added if they link Google.
            const emailForRules =
              currentUser.email || (isGuest ? `guest-${guestId}@agri.local` : '');
            const guestName = `অতিথি কৃষক #${guestId.slice(0, 4).toUpperCase()}`;
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: emailForRules,
              name: currentUser.displayName || (isGuest ? guestName : ''),
              role: isAdminEmail ? 'admin' : 'agri-preneur',
              tier: isAdminEmail ? 'premium' : 'free',
              usageCount: 0,
              lastUsedDate: new Date().toISOString().split('T')[0],
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
          } else if (userDoc && userDoc.exists()) {
            // Force administrative privileges for the owner email if not already set
            // (mirrors firestore.rules isAdmin(): email must also be verified)
            const data = userDoc.data() as UserProfile;
            if (currentUser.email === 'sadmankhalili@gmail.com' && currentUser.emailVerified === true && data.role !== 'admin') {
              console.log("Promoting established user to admin...");
              await updateDoc(userDocRef, { role: 'admin', tier: 'premium' });
            }
            // A guest who linked Google should stop appearing as "অতিথি কৃষক"
            // in expert queues. Email is immutable under the rules, but name is
            // an allowed self-service field.
            if (
              !isGuestUser(currentUser) &&
              data.name?.startsWith('অতিথি কৃষক') &&
              currentUser.displayName &&
              currentUser.displayName !== data.name
            ) {
              await updateDoc(userDocRef, {
                name: currentUser.displayName,
                updatedAt: new Date().toISOString(),
              });
            }
          }
          
          // Listen for profile updates
          const listener = onSnapshot(userDocRef, (snapshot) => {
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

          // If a newer auth change started while we were awaiting Firestore,
          // installing this listener would orphan it: it would overwrite
          // `unsubSnapshot` and would never be unsubscribed, so it could keep
          // restoring the previous account's profile after sign-out.
          // Tear it down immediately instead.
          if (changeId !== authChangeId) {
            listener();
            return;
          }

          unsubSnapshot = listener;
          profileUid = currentUser.uid;

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
        profileUid = null;
        setIsAuthReady(true);
      }
    };

    // onAuthStateChanged ignores the promise returned by an async listener, so any
    // rejection would surface as an unhandled promise rejection. Route it through
    // a guarded invocation instead.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      void handleAuthStateChanged(currentUser).catch((error) => {
        console.warn("Auth state listener error (handled):", error);
      });
    });

    return () => {
      unsubscribe();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, []);

  const handleSignUp = async (email: string, password: string, name: string) => {
    try {
      await signUpWithEmail(email, password, name);
    } catch (error) {
      throw error;
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      await loginWithEmail(email, password);
    } catch (error) {
      throw error;
    }
  };

  const handleSignInAsGuest = async () => {
    await startGuestSession();
  };

  const handleSaveGuest = async () => {
    await linkGuestWithGoogle();
  };

  const handleSignOut = async () => {
    // Anonymous accounts are unrecoverable once signed out. Make that explicit
    // so a farmer cannot accidentally destroy open expert requests.
    if (isGuestUser(auth.currentUser)) {
      const confirmed = window.confirm(
        'আপনি গেস্ট হিসেবে আছেন। সাইন আউট করলে এই ডিভাইসের অনুরোধ, চ্যাট ও পরামর্শ আর ফিরে পাওয়া যাবে না।\n\nYou are using a guest account. Signing out permanently loses this device\'s requests and chats.'
      );
      if (!confirmed) return;
    }
    await logout();
  };

  const upgradeToPremium = async () => {
    if (user) {
      try {
        const [{ doc, updateDoc }, { db }] = await Promise.all([
          import('firebase/firestore'),
          import('../firestore'),
        ]);
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { tier: 'premium' });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userRole, 
      userProfile, 
      isAuthReady, 
      isAdmin: userRole === 'admin',
      isExpert: userRole === 'expert' || userRole === 'org_admin',
      isGuest: isGuestUser(user),
      signIn: signInWithGoogle, 
      signInAsGuest: handleSignInAsGuest,
      saveGuestAccount: handleSaveGuest,
      signUpWithEmail: handleSignUp,
      loginWithEmail: handleLogin,
      signOut: handleSignOut, 
      upgradeToPremium 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

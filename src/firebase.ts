import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, linkWithPopup, signInAnonymously } from 'firebase/auth';
import type { User } from 'firebase/auth';
import toast from 'react-hot-toast';
import firebaseConfig from '../firebase-applet-config.json';

// NOTE: Firestore is deliberately NOT imported in this module. Keeping it auth-only
// lets Vite code-split the Firestore SDK (~94 KB gzip) so it is only downloaded when
// a feature actually needs it, instead of blocking first paint for every visitor.
// The Firestore instance lives in `src/firestore.ts`.
const app = initializeApp(firebaseConfig);

export { app };
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

let isSigningIn = false;

export const signInWithGoogle = async () => {
  if (isSigningIn) {
    console.warn("Sign-in already in progress.");
    return;
  }
  
  isSigningIn = true;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      console.warn("Sign-in popup closed by user.");
      return;
    }
    if (error.code === 'auth/popup-blocked') {
      toast.error("Sign-in popup blocked. Please allow popups or open in a new tab.", { duration: 5000 });
    }
    console.error("Error signing in with Google", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    return userCredential.user;
  } catch (error) {
    console.error("Error signing up with email", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in with email", error);
    throw error;
  }
};

/**
 * Guest-first entry: one tap, no email, password or Google account.
 *
 * Preferred path is a Firebase anonymous account. When the Anonymous provider
 * is not enabled in the Firebase project, we fall back to a throwaway
 * email/password account with 128 bits of random entropy. The credentials are
 * never shown or stored; Firebase's own session persistence keeps the guest
 * signed in on this device. Both paths produce a real uid, so Firestore rules
 * and the expert consultation flow work unchanged.
 */
export const signInAsGuest = async () => {
  if (isSigningIn) {
    console.warn("Sign-in already in progress.");
    return;
  }
  isSigningIn = true;
  try {
    try {
      const credential = await signInAnonymously(auth);
      return credential.user;
    } catch (error: any) {
      const code = String(error?.code || '');
      const providerDisabled =
        code.includes('operation-not-allowed') || code.includes('admin-restricted-operation');
      if (!providerDisabled) throw error;
      console.warn('Anonymous auth is disabled — using a throwaway password guest account.');
      return await createPasswordGuest();
    }
  } catch (error) {
    console.error("Error starting guest session", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * A guest account is either a true Firebase anonymous user or a throwaway
 * password account created by the fallback above. Once Google is linked, the
 * account is considered saved even if the local guest email remains.
 */
export const isGuestUser = (user: User | null): boolean => {
  if (!user) return false;
  // Google linked means the account is saved — check this first, because the
  // `isAnonymous` flag is not cleared consistently across SDK versions when a
  // provider is linked onto an anonymous account.
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  if (hasGoogle) return false;
  if (user.isAnonymous) return true;
  return isGuestEmail(user.email);
};

const isGuestEmail = (email?: string | null): boolean =>
  !!email && email.endsWith('@agri.local');

const guestDisplayName = (uid: string): string =>
  `অতিথি কৃষক #${uid.slice(0, 4).toUpperCase()}`;

const createPasswordGuest = async () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const entropy = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const email = `guest-${entropy}@agri.local`;
  const password = `G!${entropy}${entropy.split('').reverse().join('')}`;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await updateProfile(credential.user, { displayName: guestDisplayName(credential.user.uid) });
  } catch (error) {
    // Display name is cosmetic; the AuthProvider also derives one from the uid.
    console.warn('Could not set guest display name', error);
  }
  return credential.user;
};

/**
 * Preserve a guest's requests by converting the guest account in place.
 * `linkWithPopup` keeps the same uid, so consultation docs stay attached.
 */
export const linkGuestWithGoogle = async () => {
  const current = auth.currentUser;
  if (!isGuestUser(current)) {
    throw new Error('No guest session to save.');
  }
  return linkWithPopup(current as User, googleProvider);
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

// Connectivity self-test. Firestore is dynamically imported so this check never
// pulls the Firestore SDK into the initial bundle for guests.
async function testConnection() {
  if (!import.meta.env.DEV) return;
  try {
    const { getFirestore, doc, getDocFromServer } = await import('firebase/firestore');
    const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

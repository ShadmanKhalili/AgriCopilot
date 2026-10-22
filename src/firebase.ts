import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, linkWithPopup, signInAnonymously } from 'firebase/auth';
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
 * Guest-first entry: one tap, no email or password. Firebase creates an
 * anonymous account with a real uid, so Firestore rules work unchanged.
 * Anonymous sign-in must be enabled in the Firebase console
 * (Authentication → Sign-in method → Anonymous); until then Firebase throws
 * `auth/operation-not-allowed` and callers show the Google fallback.
 */
export const signInAsGuest = async () => {
  if (isSigningIn) {
    console.warn("Sign-in already in progress.");
    return;
  }
  isSigningIn = true;
  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (error) {
    console.error("Error starting guest session", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Preserve a guest's requests by converting the anonymous account in place.
 * `linkWithPopup` keeps the same uid, so consultation docs stay attached.
 */
export const linkGuestWithGoogle = async () => {
  const current = auth.currentUser;
  if (!current || !current.isAnonymous) {
    throw new Error('No guest session to save.');
  }
  return linkWithPopup(current, googleProvider);
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

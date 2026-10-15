import { getFirestore } from 'firebase/firestore';
import { app } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Firestore instance, isolated in its own module.
 *
 * `src/firebase.ts` stays auth-only so the Firestore SDK is code-split and not
 * part of the initial bundle. Only modules that actually read/write Firestore
 * import this file, which keeps the SDK out of the critical rendering path.
 */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
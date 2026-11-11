import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { app } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Firestore instance, isolated in its own module.
 *
 * `src/firebase.ts` stays auth-only so the Firestore SDK is code-split and not
 * part of the initial bundle. Only modules that actually read/write Firestore
 * import this file, which keeps the SDK out of the critical rendering path.
 *
 * Data is kept on the device as well, so a farmer with a weak or no signal
 * still sees their saved records, and anything they save is sent once the
 * connection returns. Where the browser has no usable storage (some in-app
 * browsers, private windows) Firestore falls back to keeping data in memory.
 */
const createDb = (): Firestore => {
  try {
    return initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      firebaseConfig.firestoreDatabaseId
    );
  } catch (error) {
    console.warn('Firestore offline storage unavailable; using memory only.', error);
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
};

export const db = createDb();

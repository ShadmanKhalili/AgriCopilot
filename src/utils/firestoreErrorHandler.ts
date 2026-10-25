import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errMsg.includes('unavailable') || 
                    errMsg.includes('offline') || 
                    errMsg.includes('Could not reach Cloud Firestore') ||
                    (error as any)?.code === 'unavailable';

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  if (isOffline) {
    console.warn('Firestore operating in offline / queued mode:', errMsg);
    // Do not throw fatal error for temporary connection hiccups
    return;
  }

  // The full detail — including who the caller was — belongs in the developer
  // console, not on the farmer's screen.
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  // What travels upward is a plain sentence the UI can display. A farmer must
  // never be handed a JSON blob, and a machine-readable code lets a caller
  // react to a permission refusal specifically.
  const permissionDenied = /permission|insufficient/i.test(errMsg);
  const friendly = new Error(
    permissionDenied
      ? 'This action is not allowed for your account. Please sign in again and try.'
      : 'Could not save to the cloud storage. Please try again.'
  ) as Error & { code?: string };
  friendly.code = permissionDenied ? 'PERMISSION_DENIED' : 'FIRESTORE_ERROR';
  throw friendly;
}

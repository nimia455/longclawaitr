import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string })
  .firestoreDatabaseId;

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firestoreDatabaseId
    );
  } catch {
    // Already initialized (e.g., module hot reload) — reuse existing instance
    return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);

// Authentication Providers
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Standard Error Handling Protocol from Firebase Integration Skill
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isTransientOfflineError(error: unknown): boolean {
  const code = String((error as any)?.code || '').toLowerCase();
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    code === 'unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('network-request-failed') ||
    msg.includes('could not reach cloud firestore backend')
  );
}

// Connection health check on boot (tolerates brief initial transport negotiation / offline browsers)
export async function testConnection() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (isTransientOfflineError(error)) {
      // Retry once after long-polling negotiation settles
      await new Promise((r) => setTimeout(r, 1800));
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch {
        console.warn('Firestore connection check skipped while offline or negotiating transport.');
      }
    }
  }
}
void testConnection();

// Types for Chat & Messages
export interface GeneratedImageData {
  url?: string;
  dataUrl?: string;
  svg?: string;
  title: string;
  prompt: string;
  enhancedPrompt?: string;
  aspectRatio: '1:1' | '16:9' | '4:3' | '9:16';
}

export interface AttachedImage {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thoughts?: string;
  searches?: string[];
  sources?: { url: string; title: string }[];
  dur?: number;
  stopped?: boolean;
  modelId?: string;
  images?: AttachedImage[];
  generatedImage?: GeneratedImageData;
  createdAt?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  mode: 'chat' | 'sum' | 'write';
  depth: 'fast' | 'mid' | 'deep';
  pin?: boolean;
  messages: ChatMessage[];
  createdAt?: any;
  updatedAt?: any;
}

export interface CustomSlashCommand {
  id: string;
  userId: string;
  name: string;
  description: string;
  prompt: string;
  createdAt?: any;
  updatedAt?: any;
}

// Firestore Real-time Chat Operations
export function subscribeToUserChats(
  userId: string,
  onUpdate: (chats: ChatSession[]) => void,
  onError?: (err: Error) => void
) {
  const path = `users/${userId}/chats`;
  try {
    const q = query(collection(db, 'users', userId, 'chats'), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: ChatSession[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        onUpdate(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          if (onError && wrapped instanceof Error) onError(wrapped);
        }
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function prepareMessagesForFirestore(rawMessages: ChatMessage[]): ChatMessage[] {
  const sliced = (rawMessages || []).slice(-1000).map((m) => stripUndefinedDeep(m));
  const MAX_BYTES = 700_000;

  let jsonSize = 0;
  try {
    jsonSize = JSON.stringify(sliced).length;
  } catch {
    return sliced;
  }
  if (jsonSize <= MAX_BYTES) return sliced;

  // Progressively trim oldest bulky inline image blobs so Firestore never fails the 1MB doc limit
  const cloned = sliced.map((m) => ({
    ...m,
    ...(m.images ? { images: m.images.map((img) => ({ ...img })) } : {}),
    ...(m.generatedImage ? { generatedImage: { ...m.generatedImage } } : {}),
  }));

  for (let i = 0; i < cloned.length && jsonSize > MAX_BYTES; i++) {
    const msg = cloned[i];
    if (msg.generatedImage?.dataUrl && msg.generatedImage?.url) {
      delete msg.generatedImage.dataUrl;
      jsonSize = JSON.stringify(cloned).length;
    }
    if (jsonSize > MAX_BYTES && msg.images && msg.images.length > 0 && i < cloned.length - 1) {
      delete msg.images;
      jsonSize = JSON.stringify(cloned).length;
    }
  }

  return cloned;
}

export async function saveChatSession(userId: string, chat: ChatSession, isNew = false) {
  const path = `users/${userId}/chats/${chat.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'chats', chat.id);
    const safeMessages = prepareMessagesForFirestore(chat.messages || []);
    const baseFields = {
      title: (chat.title || 'Yeni sohbet').slice(0, 200),
      mode: chat.mode || 'chat',
      depth: chat.depth || 'mid',
      pin: !!chat.pin,
      messages: safeMessages,
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(docRef, {
        id: chat.id,
        userId,
        ...baseFields,
        createdAt: serverTimestamp(),
      });
      return;
    }

    try {
      await updateDoc(docRef, baseFields);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found') {
        await setDoc(docRef, {
          id: chat.id,
          userId,
          ...baseFields,
          createdAt: serverTimestamp(),
        });
      } else {
        throw updateErr;
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteChatSession(userId: string, chatId: string) {
  const path = `users/${userId}/chats/${chatId}`;
  try {
    const docRef = doc(db, 'users', userId, 'chats', chatId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Firestore Real-time Custom Slash Command Operations
export function subscribeToUserCommands(
  userId: string,
  onUpdate: (commands: CustomSlashCommand[]) => void,
  onError?: (err: Error) => void
) {
  const path = `users/${userId}/commands`;
  try {
    const q = query(
      collection(db, 'users', userId, 'commands'),
      where('userId', '==', userId)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const list: CustomSlashCommand[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        onUpdate(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          if (onError && wrapped instanceof Error) onError(wrapped);
        }
      }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
}

export async function saveUserCommand(
  userId: string,
  cmd: { id: string; name: string; description: string; prompt: string },
  isNew = false
) {
  const safeId = cmd.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || `cmd-${Date.now()}`;
  const safeName = cmd.name
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 32);
  const safeDescription = (cmd.description || '').trim().slice(0, 140);
  const safePrompt = (cmd.prompt || '').trim().slice(0, 2000);

  if (!safeName || !safePrompt) {
    throw new Error('Command name and instruction are required.');
  }

  const path = `users/${userId}/commands/${safeId}`;
  try {
    const docRef = doc(db, 'users', userId, 'commands', safeId);
    const mutableFields = {
      name: safeName,
      description: safeDescription,
      prompt: safePrompt,
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(docRef, {
        id: safeId,
        userId,
        ...mutableFields,
        createdAt: serverTimestamp(),
      });
      return;
    }

    try {
      await updateDoc(docRef, mutableFields);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found') {
        await setDoc(docRef, {
          id: safeId,
          userId,
          ...mutableFields,
          createdAt: serverTimestamp(),
        });
      } else {
        throw updateErr;
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteUserCommand(userId: string, commandId: string) {
  const path = `users/${userId}/commands/${commandId}`;
  try {
    const docRef = doc(db, 'users', userId, 'commands', commandId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncUserProfile(user: User) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    const displayName = (
      user.displayName ||
      user.email?.split('@')[0] ||
      'Kullanıcı'
    ).slice(0, 100);

    const mutableFields = {
      email: (user.email || '').slice(0, 256),
      displayName,
      photoURL: (user.photoURL || '').slice(0, 1000),
      emailVerified: !!user.emailVerified,
      updatedAt: serverTimestamp(),
    };

    try {
      await updateDoc(userRef, mutableFields);
    } catch (updateErr: any) {
      if (updateErr?.code === 'not-found') {
        await setDoc(userRef, {
          id: user.uid,
          ...mutableFields,
          createdAt: serverTimestamp(),
        });
      } else {
        throw updateErr;
      }
    }
  } catch (error) {
    if (isTransientOfflineError(error)) {
      console.warn('Skipped user profile sync while Firestore is offline.');
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserProfileAndCommands(userId: string) {
  try {
    const cmdQuery = query(
      collection(db, 'users', userId, 'commands'),
      where('userId', '==', userId)
    );
    const cmdSnap = await getDocs(cmdQuery);
    await Promise.all(
      cmdSnap.docs.map((d) => deleteDoc(doc(db, 'users', userId, 'commands', d.id)).catch(() => {}))
    );
  } catch {
    // Best-effort cleanup
  }
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch {
    // Best-effort cleanup
  }
}

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  onAuthStateChanged,
};

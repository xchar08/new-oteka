// import { decryptJson, encryptJson, type EncryptedBlob } from './crypto'; // Commented out until crypto module exists

/**
 * OFFLINE STORE & FORWARD QUEUE
 * Uses Native IndexedDB
 */

export type QueueItem = {
  id: string;
  type: 'VISION_LOG' | 'PANTRY_VERIFY' | 'GENERIC_MUTATION';
  user_id: string;
  created_at: string;
  updated_at: string;

  // Conflict resolution: larger wins
  client_updated_at_ms: number;

  // Payload stored at rest in IDB
  payload: any; // Changed from 'encrypted' to 'payload' for MVP simplicity

  // Status tracking
  status: 'PENDING' | 'SENT' | 'FAILED';
  last_error?: string;
};

const DB_NAME = 'oteka_offline';
const STORE = 'queue';
const DB_VERSION = 1;

// --- IDB Helpers ---

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') return Promise.reject('No IDB in server context'); // Safety check

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('status', 'status', { unique: false });
        os.createIndex('created_at', 'created_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function put<T>(value: T): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll(): Promise<QueueItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueueItem[]);
    req.onerror = () => reject(req.error);
  });
}

async function del(id: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Public API ---

export async function enqueueMutation(input: {
  id: string;
  type: QueueItem['type'];
  user_id: string;
  payload: unknown;
  client_updated_at_ms?: number;
}): Promise<QueueItem> {
  const now = new Date().toISOString();

  // If you add crypto later: const encrypted = await encryptJson(input.payload);

  const item: QueueItem = {
    id: input.id,
    type: input.type,
    user_id: input.user_id,
    created_at: now,
    updated_at: now,
    client_updated_at_ms: input.client_updated_at_ms ?? Date.now(),
    payload: input.payload, // Storing plain JSON for now
    status: 'PENDING',
  };

  await put(item);
  return item;
}

export async function listQueue(): Promise<QueueItem[]> {
  return await getAll();
}

export async function deleteQueueItem(id: string): Promise<void> {
  await del(id);
}

export async function readQueuePayload<T = unknown>(item: QueueItem): Promise<T> {
  // If you add crypto later: return await decryptJson<T>(item.encrypted);
  return item.payload as T;
}

export async function markQueueItem(item: QueueItem, patch: Partial<QueueItem>) {
  const next: QueueItem = { ...item, ...patch, updated_at: new Date().toISOString() };
  await put(next);
  return next;
}

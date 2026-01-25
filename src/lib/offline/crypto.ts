import { get, set } from 'idb-keyval';

// Minimal AES-GCM helpers using WebCrypto.
// Key Strategy: Auto-generate a random 32-byte key per device/browser on first run.
// This ensures data is encrypted uniquely per user device, not via a shared global secret.

const enc = new TextEncoder();
const dec = new TextDecoder();

export type EncryptedBlob = {
  iv_b64: string;
  data_b64: string;
};

// --- Utilities ---

function toB64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function fromB64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- Key Management ---

const KEY_STORAGE_KEY = 'oteka_device_key_v1';

export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  // 1. Try to load existing key from IndexedDB (Persistent local storage)
  try {
    const storedJwk = await get(KEY_STORAGE_KEY);
    if (storedJwk) {
      return crypto.subtle.importKey(
        'jwk',
        storedJwk,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    }
  } catch (e) {
    console.warn("Could not read device key, generating new one.");
  }

  // 2. Generate new random 256-bit key
  const newKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // Extractable (so we can store it)
    ['encrypt', 'decrypt']
  );

  // 3. Persist Key to IDB
  const exportJwk = await crypto.subtle.exportKey('jwk', newKey);
  await set(KEY_STORAGE_KEY, exportJwk);

  return newKey;
}

// --- Encryption Logic ---

export async function encryptJson(payload: unknown): Promise<EncryptedBlob> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV standard for GCM
  const plaintext = enc.encode(JSON.stringify(payload));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, 
    key, 
    plaintext
  );

  return {
    iv_b64: toB64(iv),
    data_b64: toB64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJson<T = unknown>(blob: EncryptedBlob): Promise<T> {
  const key = await getOrCreateDeviceKey();
  const iv = fromB64(blob.iv_b64);
  const data = fromB64(blob.data_b64);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, 
    key, 
    data
  );
  
  return JSON.parse(dec.decode(new Uint8Array(plaintext))) as T;
}

const DB_NAME = 'RadixKeyStore';
const STORE_NAME = 'keys';
const KEY_ID = 'master_api_key';

async function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(KEY_ID);
    
    getReq.onsuccess = async () => {
      if (getReq.result) {
        resolve(getReq.result);
      } else {
        const key = await window.crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // not exportable
          ['encrypt', 'decrypt']
        );
        store.put(key, KEY_ID);
        resolve(key);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  try {
    const key = await getOrCreateMasterKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.error('Failed to encrypt API key', e);
    return plaintext;
  }
}

export async function decryptApiKey(encryptedBase64: string): Promise<string> {
  if (!encryptedBase64) return '';
  try {
    const binaryStr = atob(encryptedBase64);
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      combined[i] = binaryStr.charCodeAt(i);
    }
    
    if (combined.length < 12) return encryptedBase64; // Too short to be our encrypted format
    
    const key = await getOrCreateMasterKey();
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    // If it fails, it might be an old plaintext key
    return encryptedBase64;
  }
}

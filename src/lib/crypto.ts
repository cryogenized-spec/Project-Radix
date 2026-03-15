// Crypto Worker Interface
const worker = new Worker(new URL('../workers/crypto.worker.ts', import.meta.url), { type: 'module' });

const pending: Record<string, { resolve: (value: any) => void, reject: (reason?: any) => void }> = {};

worker.onmessage = (e) => {
  const { id, result, error } = e.data;
  if (pending[id]) {
    if (error) {
      pending[id].reject(new Error(error));
    } else {
      pending[id].resolve(result);
    }
    delete pending[id];
  }
};

function postMessage(type: string, payload: any): Promise<any> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending[id] = { resolve, reject };
    worker.postMessage({ id, type, payload });
  });
}

// Key Management
let sessionKey: Uint8Array | null = null;
const SALT_KEY = 'radix_crypto_salt';

export async function initCrypto(password: string) {
  let saltString = localStorage.getItem(SALT_KEY);
  let salt: Uint8Array;

  if (!saltString) {
    salt = crypto.getRandomValues(new Uint8Array(16));
    // Store salt as hex string
    localStorage.setItem(SALT_KEY, Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''));
  } else {
    // Parse hex string to Uint8Array
    const matches = saltString.match(/.{1,2}/g);
    if (matches) {
        salt = new Uint8Array(matches.map(byte => parseInt(byte, 16)));
    } else {
        // Fallback if corrupted
        salt = crypto.getRandomValues(new Uint8Array(16));
        localStorage.setItem(SALT_KEY, Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''));
    }
  }

  // Derive key using PBKDF2 in worker
  const key = await postMessage('deriveKey', { password, salt: Array.from(salt) });
  sessionKey = key;
  return true;
}

export async function encryptData(data: any): Promise<{ ciphertext: Uint8Array, nonce: Uint8Array }> {
  if (!sessionKey) throw new Error('Crypto not initialized');
  return postMessage('encrypt', { data, key: sessionKey });
}

export async function decryptData(ciphertext: Uint8Array, nonce: Uint8Array): Promise<any> {
  if (!sessionKey) throw new Error('Crypto not initialized');
  return postMessage('decrypt', { ciphertext, nonce, key: sessionKey });
}

export function isCryptoInitialized() {
  return !!sessionKey;
}

export async function generateIdentity() {
  const keypair = await postMessage('generateKeyPair', {});
  return {
    id: toHex(keypair.publicKey),
    publicKey: toHex(keypair.publicKey),
    privateKey: toHex(keypair.privateKey),
    type: 'ed25519'
  };
}

function toHex(buffer: Uint8Array) {
  return Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

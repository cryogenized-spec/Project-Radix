import _sodium from 'libsodium-wrappers';

let sodium: any = null;

async function initSodium() {
  if (!sodium) {
    await _sodium.ready;
    sodium = _sodium;
  }
}

self.onmessage = async (e) => {
  const { id, type, payload } = e.data;

  try {
    if (type === 'deriveKey') {
        const { password, salt } = payload;
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );
        
        const key = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode(salt),
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 }, // We just need 32 bytes for XChaCha20
            true,
            ["encrypt", "decrypt"]
        );
        
        // Export as raw bytes for libsodium
        const rawKey = await crypto.subtle.exportKey("raw", key);
        
        self.postMessage({
            id,
            result: new Uint8Array(rawKey)
        });
        return;
    }

    await initSodium();

    if (type === 'encrypt') {
      const { data, key } = payload;
      // XChaCha20-Poly1305 uses 24-byte (192-bit) nonce
      const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
      const keyBytes = new Uint8Array(key);
      
      let messageBytes;
      if (typeof data === 'string') {
        messageBytes = sodium.from_string(data);
      } else {
        messageBytes = sodium.from_string(JSON.stringify(data));
      }

      const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        messageBytes,
        null,
        null,
        nonce,
        keyBytes
      );

      self.postMessage({
        id,
        result: {
          ciphertext,
          nonce
        }
      });

    } else if (type === 'decrypt') {
      const { ciphertext, nonce, key } = payload;
      const keyBytes = new Uint8Array(key);
      const nonceBytes = new Uint8Array(nonce);
      const ciphertextBytes = new Uint8Array(ciphertext);

      const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ciphertextBytes,
        null,
        nonceBytes,
        keyBytes
      );

      const decryptedString = sodium.to_string(decrypted);
      let resultData;
      try {
        resultData = JSON.parse(decryptedString);
      } catch {
        resultData = decryptedString;
      }

      self.postMessage({
        id,
        result: resultData
      });
    } else if (type === 'generateKeyPair') {
        const keypair = sodium.crypto_sign_keypair();
        self.postMessage({
            id,
            result: {
                publicKey: keypair.publicKey,
                privateKey: keypair.privateKey
            }
        });
    }
  } catch (error: any) {
    self.postMessage({
      id,
      error: error.message
    });
  }
};

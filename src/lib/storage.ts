import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface P2PDB extends DBSchema {
  messages: {
    key: string;
    value: {
      id: string;
      text: string;
      sender: string;
      timestamp: number;
      type: string;
      mediaUrl?: string;
      mediaType?: string;
      isPrivate?: boolean;
      isGhost?: boolean;
      encrypted?: boolean;
      signature?: string;
      threadId?: string;
    };
    indexes: { 'by-timestamp': number; 'by-thread': string };
  };
  peers: {
    key: string;
    value: {
      peerId: string;
      publicKey: JsonWebKey;
      lastSeen: number;
      alias?: string;
    };
  };
  keys: {
    key: string;
    value: {
      id: string; // 'identity'
      privateKey: JsonWebKey;
      publicKey: JsonWebKey;
    };
  };
}

class StorageManager {
  private dbPromise: Promise<IDBPDatabase<P2PDB>>;

  constructor() {
    this.dbPromise = openDB<P2PDB>('radix-p2p-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-timestamp', 'timestamp');
          msgStore.createIndex('by-thread', 'threadId');
        }
        if (!db.objectStoreNames.contains('peers')) {
          db.createObjectStore('peers', { keyPath: 'peerId' });
        }
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      },
    });
  }

  async saveMessage(message: any) {
    const db = await this.dbPromise;
    await db.put('messages', message);
  }

  async getMessages(threadId?: string) {
    const db = await this.dbPromise;
    if (threadId) {
      return db.getAllFromIndex('messages', 'by-thread', threadId);
    }
    return db.getAllFromIndex('messages', 'by-timestamp');
  }

  async savePeer(peer: any) {
    const db = await this.dbPromise;
    await db.put('peers', peer);
  }

  async getPeer(peerId: string) {
    const db = await this.dbPromise;
    return db.get('peers', peerId);
  }

  async saveIdentityKeys(keys: { privateKey: JsonWebKey; publicKey: JsonWebKey }) {
    const db = await this.dbPromise;
    await db.put('keys', { id: 'identity', ...keys });
  }

  async getIdentityKeys() {
    const db = await this.dbPromise;
    return db.get('keys', 'identity');
  }
}

export const storageManager = new StorageManager();

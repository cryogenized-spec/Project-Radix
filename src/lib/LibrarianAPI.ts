import { openDB, IDBPDatabase } from 'idb';

export interface VectorNode {
  id: string;
  type: 'text' | 'image';
  content: string; // Raw text or image reference
  metadata: Record<string, any>;
  embedding: number[]; // 256-dimensional vector
  timestamp: number;
}

export interface LibrarianResult {
  node: VectorNode;
  score: number;
}

const DB_NAME = 'AIVaultDB';
const STORE_NAME = 'ai_vault';

export class LibrarianAPI {
  private static dbPromise: Promise<IDBPDatabase> | null = null;
  private static worker: Worker | null = null;
  private static messageIdCounter = 0;
  private static pendingRequests = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>();

  static async grantPartitionAccess(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('type', 'type');
            store.createIndex('timestamp', 'timestamp');
          }
        },
      });
    }
    return this.dbPromise;
  }

  static getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/librarian.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, result, error, status, progress, file } = e.data;
        
        if (status === 'progress' || status === 'downloading') {
          // Dispatch global event for UI updates
          window.dispatchEvent(new CustomEvent('librarian-status', { detail: e.data }));
          return;
        }

        if (status === 'ready') {
          window.dispatchEvent(new CustomEvent('librarian-status', { detail: e.data }));
        }

        const pending = this.pendingRequests.get(id);
        if (pending) {
          if (error) pending.reject(new Error(error));
          else pending.resolve(result);
          this.pendingRequests.delete(id);
        }
      };
    }
    return this.worker;
  }

  private static async sendMessage(type: string, payload: any = {}): Promise<any> {
    const worker = this.getWorker();
    const id = this.messageIdCounter++;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      worker.postMessage({ id, type, ...payload });
    });
  }

  static async initializeModels(): Promise<void> {
    await this.sendMessage('initialize');
  }

  static async embedText(text: string, prefix: 'search_document' | 'search_query' = 'search_document'): Promise<number[]> {
    return this.sendMessage('embed_text', { text, prefix });
  }

  static async embedImage(imageBlob: Blob): Promise<number[]> {
    return this.sendMessage('embed_image', { imageBlob });
  }

  static async disposeModels(): Promise<void> {
    await this.sendMessage('dispose');
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  static async storeNode(node: VectorNode): Promise<void> {
    const db = await this.grantPartitionAccess();
    await db.put(STORE_NAME, node);
  }

  static async getAllNodes(): Promise<VectorNode[]> {
    const db = await this.grantPartitionAccess();
    return db.getAll(STORE_NAME);
  }

  static async search(queryEmbedding: number[], topK: number = 5): Promise<LibrarianResult[]> {
    const nodes = await this.getAllNodes();
    
    // Calculate cosine similarity
    const results: LibrarianResult[] = nodes.map(node => {
      const score = this.cosineSimilarity(queryEmbedding, node.embedding);
      return { node, score };
    });

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

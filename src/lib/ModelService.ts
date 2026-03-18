export interface LocalModel {
  id: string;
  name: string;
  description: string;
  url: string;
  sizeBytes: number;
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma-3n-e2b-it',
    name: 'Gemma 3n E2B (2B Core)',
    description: 'google/gemma-3n-e2b-it',
    url: 'https://huggingface.co/google/gemma-3n-e2b-it-gguf/resolve/main/gemma-3n-e2b-it-Q4_K_M.gguf',
    sizeBytes: 1500000000 // Approximate size, update if needed
  },
  {
    id: 'gemma-3n-e4b-it',
    name: 'Gemma 3n E4B (4B Core)',
    description: 'google/gemma-3n-e4b-it',
    url: 'https://huggingface.co/google/gemma-3n-e4b-it-gguf/resolve/main/gemma-3n-e4b-it-Q4_K_M.gguf',
    sizeBytes: 2500000000
  },
  {
    id: 'qwen2.5-1.5b-instruct',
    name: 'Qwen 2.5 1.5B',
    description: 'Qwen/Qwen2.5-1.5B-Instruct',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1100000000
  },
  {
    id: 'deepseek-r1-distill-qwen-1.5b',
    name: 'DeepSeek R1 Distill 1.5B',
    description: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B',
    url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    sizeBytes: 1100000000
  }
];

export type ModelStatus = 'Available' | 'Downloading' | 'Offline Ready';

export class ModelService {
  private static worker: Worker | null = null;

  static getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/LocalInference.worker.ts', import.meta.url), { type: 'module' });
    }
    return this.worker;
  }

  private static async getOPFSDirectory() {
    return await navigator.storage.getDirectory();
  }

  static async checkModelStatus(modelId: string): Promise<ModelStatus> {
    try {
      const dir = await this.getOPFSDirectory();
      const fileHandle = await dir.getFileHandle(`${modelId}.gguf`, { create: false });
      const file = await fileHandle.getFile();
      if (file.size > 0) {
        return 'Offline Ready';
      }
    } catch (e) {
      // File doesn't exist
    }
    return 'Available';
  }

  static async downloadModel(
    model: LocalModel, 
    onProgress: (progress: number) => void
  ): Promise<void> {
    try {
      const response = await fetch(model.url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : model.sizeBytes;
      let loaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader from response');

      const dir = await this.getOPFSDirectory();
      const fileHandle = await dir.getFileHandle(`${model.id}.gguf`, { create: true });
      // Use createWritable if available, otherwise fallback to a memory buffer (not ideal for large files, but OPFS sync access handle is worker-only)
      // In main thread, createWritable is available in some browsers.
      
      let writable;
      try {
        writable = await (fileHandle as any).createWritable();
      } catch (e) {
        console.warn("createWritable not supported, buffering in memory (may crash on large models)");
        // Fallback for browsers without createWritable on main thread OPFS
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            onProgress(Math.round((loaded / total) * 100));
          }
        }
        const blob = new Blob(chunks);
        // We can't easily write a Blob to OPFS without createWritable or SyncAccessHandle.
        // If createWritable fails, OPFS might not be fully supported.
        throw new Error("OPFS createWritable not supported in this browser.");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await writable.write(value);
          loaded += value.length;
          onProgress(Math.round((loaded / total) * 100));
        }
      }
      
      await writable.close();
      onProgress(100);
      
      // Dispatch event to notify the app
      window.dispatchEvent(new CustomEvent('local-model-downloaded', { detail: { modelId: model.id } }));
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  static async deleteModel(modelId: string): Promise<void> {
    try {
      const dir = await this.getOPFSDirectory();
      await dir.removeEntry(`${modelId}.gguf`);
      window.dispatchEvent(new CustomEvent('local-model-deleted', { detail: { modelId } }));
    } catch (e) {
      console.error('Failed to delete model:', e);
    }
  }
}

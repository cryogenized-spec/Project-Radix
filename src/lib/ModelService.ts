import { getSetting } from './db';
import { decryptApiKey } from './apiKeyCrypto';

export interface LocalModel {
  id: string;
  name: string;
  description: string;
  url: string;
  sizeBytes: number;
  isGated?: boolean;
  tags?: string[];
}

export const LOCAL_MODELS: LocalModel[] = [
  {
    id: 'gemma-3n-e2b-it',
    name: 'Gemma 3n E2B (2B Core)',
    description: 'google/gemma-3n-e2b-it',
    url: 'https://huggingface.co/google/gemma-3n-e2b-it-gguf/resolve/main/gemma-3n-e2b-it-Q4_K_M.gguf',
    sizeBytes: 1500000000,
    isGated: true
  },
  {
    id: 'gemma-3n-e4b-it',
    name: 'Gemma 3n E4B (4B Core)',
    description: 'google/gemma-3n-e4b-it',
    url: 'https://huggingface.co/google/gemma-3n-e4b-it-gguf/resolve/main/gemma-3n-e4b-it-Q4_K_M.gguf',
    sizeBytes: 2500000000,
    isGated: true
  },
  {
    id: 'llama-3.2-1b-instruct',
    name: 'Llama 3.2 1B Instruct',
    description: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeBytes: 800000000
  },
  {
    id: 'qwen2.5-0.5b-instruct',
    name: 'Qwen 2.5 0.5B',
    description: 'Qwen/Qwen2.5-0.5B-Instruct',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    sizeBytes: 400000000
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
  },
  {
    id: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 3B (Engineering/CAD)',
    description: 'High-precision CAD scripting, automation, and deterministic computation.',
    url: 'https://huggingface.co/mlc-ai/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC/resolve/main/Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC.gguf',
    sizeBytes: 2000000000,
    tags: ['Engineering/CAD']
  },
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    name: 'Phi-4 Mini 3.8B (Engineering/CAD)',
    description: 'Electronics physics, circuit math, and hardware reasoning.',
    url: 'https://huggingface.co/mlc-ai/Phi-4-mini-instruct-q4f16_1-MLC/resolve/main/Phi-4-mini-instruct-q4f16_1-MLC.gguf',
    sizeBytes: 2500000000,
    tags: ['Engineering/CAD']
  },
  {
    id: 'qwen-3.5-1.7b',
    name: 'Qwen 3.5 (1.7B)',
    description: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeBytes: 1200000000
  },
  {
    id: 'phi-4-mini-abliterated',
    name: 'Phi-4-mini-Abliterated (3.8B)',
    description: 'huihui-ai/Phi-4-mini-instruct-abliterated',
    url: 'https://huggingface.co/huihui-ai/Phi-4-mini-instruct-abliterated/resolve/main/phi-4-mini-instruct-abliterated-q4_k_m.gguf',
    sizeBytes: 2500000000
  },
  {
    id: 'llama-3.1-8b-instruct',
    name: 'Llama 3.1 (8B)',
    description: 'meta-llama/Llama-3.1-8B-Instruct',
    url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    sizeBytes: 5200000000,
    isGated: true
  },
  {
    id: 'mistral-nemo-12b',
    name: 'Mistral Nemo (12B)',
    description: 'mistralai/Mistral-Nemo-Instruct-2407',
    url: 'https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    sizeBytes: 7500000000
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
    onProgress: (progress: number, speedBytesPerSec: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      const encryptedKey = await getSetting('hfApiKey');
      const apiKey = await decryptApiKey(encryptedKey || '');
      
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (model.isGated) {
        throw new Error('Hugging Face API key is required to download this model. Please set it in the API Lockbox.');
      }

      const response = await fetch(model.url, { headers, signal });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. If this is a gated model, ensure you have accepted the EULA on Hugging Face and provided a valid API key in the API Lockbox.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : model.sizeBytes;
      let loaded = 0;
      let lastTime = performance.now();
      let lastLoaded = 0;

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader from response');

      const dir = await this.getOPFSDirectory();
      const fileHandle = await dir.getFileHandle(`${model.id}.gguf`, { create: true });
      
      let writable;
      try {
        writable = await (fileHandle as any).createWritable();
      } catch (e) {
        console.warn("createWritable not supported, buffering in memory (may crash on large models)");
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loaded += value.length;
            const now = performance.now();
            if (now - lastTime > 500) {
              const speed = ((loaded - lastLoaded) / (now - lastTime)) * 1000;
              onProgress(Math.round((loaded / total) * 100), speed);
              lastTime = now;
              lastLoaded = loaded;
            }
          }
        }
        const blob = new Blob(chunks);
        throw new Error("OPFS createWritable not supported in this browser.");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await writable.write(value);
          loaded += value.length;
          const now = performance.now();
          if (now - lastTime > 500) {
            const speed = ((loaded - lastLoaded) / (now - lastTime)) * 1000;
            onProgress(Math.round((loaded / total) * 100), speed);
            lastTime = now;
            lastLoaded = loaded;
          }
        }
      }
      
      await writable.close();
      onProgress(100, 0);
      
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

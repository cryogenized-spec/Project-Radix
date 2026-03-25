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

export const MODEL_ID_MAP: Record<string, string> = {
  'gemma-3n-e2b-it': 'gemma-2-2b-it-q4f16_1-MLC',
  'gemma-3n-e4b-it': 'gemma-2-2b-it-q4f16_1-MLC',
  'llama-3.2-1b-instruct': 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
  'qwen2.5-0.5b-instruct': 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  'qwen2.5-1.5b-instruct': 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'deepseek-r1-distill-qwen-1.5b': 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
  'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC': 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
  'Phi-4-mini-instruct-q4f16_1-MLC': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'qwen-3.5-1.7b': 'Qwen3-1.7B-q4f16_1-MLC',
  'phi-4-mini-abliterated': 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'llama-3.1-8b-instruct': 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
  'mistral-nemo-12b': 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC'
};

export type ModelStatus = 'Available' | 'Downloading' | 'Offline Ready';

export class ModelService {
  private static worker: Worker | null = null;

  static getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/LocalInference.worker.ts', import.meta.url), { type: 'module' });
    }
    return this.worker;
  }

  static async checkModelStatus(modelId: string): Promise<ModelStatus> {
    const mappedId = MODEL_ID_MAP[modelId] || modelId;
    try {
      const { hasModelInCache } = await import('@mlc-ai/web-llm');
      const isCached = await hasModelInCache(mappedId);
      if (isCached) {
        return 'Offline Ready';
      }
    } catch (e) {
      console.error('Error checking model status:', e);
    }
    return 'Available';
  }

  static async downloadModel(
    model: LocalModel, 
    onProgress: (progress: number, speedBytesPerSec: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const mappedId = MODEL_ID_MAP[model.id] || model.id;
    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      
      let lastTime = performance.now();
      let lastLoaded = 0;
      
      const engine = await CreateMLCEngine(mappedId, {
        initProgressCallback: (progress) => {
          if (signal?.aborted) {
            throw new Error('Download aborted');
          }
          const now = performance.now();
          if (now - lastTime > 500) {
            // progress.progress is 0 to 1
            const loaded = progress.progress * model.sizeBytes;
            const speed = ((loaded - lastLoaded) / (now - lastTime)) * 1000;
            onProgress(Math.round(progress.progress * 100), speed);
            lastTime = now;
            lastLoaded = loaded;
          }
        }
      });
      
      await engine.unload();
      onProgress(100, 0);
      
      window.dispatchEvent(new CustomEvent('local-model-downloaded', { detail: { modelId: model.id } }));
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }

  static async deleteModel(modelId: string): Promise<void> {
    const mappedId = MODEL_ID_MAP[modelId] || modelId;
    try {
      const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
      await deleteModelAllInfoInCache(mappedId);
      window.dispatchEvent(new CustomEvent('local-model-deleted', { detail: { modelId } }));
    } catch (e) {
      console.error('Failed to delete model:', e);
    }
  }
}

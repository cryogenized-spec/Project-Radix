/// <reference lib="webworker" />

// This worker handles local LLM inference using WebGPU and OPFS.
// We use a generic interface that can be adapted for @mlc-ai/web-llm or @mediapipe/tasks-genai.

let engine: any = null;
let currentModelId: string | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'LOAD_MODEL':
        await loadModel(payload.modelId);
        self.postMessage({ type: 'MODEL_LOADED', id, success: true });
        break;

      case 'GENERATE':
        if (!engine) throw new Error('Model not loaded');
        const response = await generateText(payload.prompt, payload.systemPrompt);
        self.postMessage({ type: 'GENERATION_COMPLETE', id, response });
        break;

      case 'STREAM_GENERATE':
        if (!engine) throw new Error('Model not loaded');
        await streamGenerateText(payload.prompt, payload.systemPrompt, (chunk) => {
          self.postMessage({ type: 'GENERATION_CHUNK', id, chunk });
        });
        self.postMessage({ type: 'GENERATION_COMPLETE', id });
        break;

      case 'CHECK_WEBGPU':
        const hasWebGPU = !!navigator.gpu;
        self.postMessage({ type: 'WEBGPU_STATUS', id, hasWebGPU });
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', id, error: error.message });
  }
};

async function loadModel(modelId: string) {
  if (currentModelId === modelId && engine) return;
  
  // Check OPFS for the model file
  const root = await navigator.storage.getDirectory();
  let fileHandle;
  try {
    fileHandle = await root.getFileHandle(`${modelId}.gguf`);
  } catch (e) {
    throw new Error(`Model ${modelId} not found in OPFS. Please download it first.`);
  }

  const file = await fileHandle.getFile();
  
  // Here we would initialize @mlc-ai/web-llm or @mediapipe/tasks-genai
  // using the local file. Since OPFS files can be read as ArrayBuffer or Stream,
  // we pass the data to the inference engine.
  
  // Simulated initialization for demonstration:
  // In a real implementation:
  // import { CreateMLCEngine } from "@mlc-ai/web-llm";
  // engine = await CreateMLCEngine(modelId, { initProgressCallback: console.log });
  
  console.log(`Loading model ${modelId} from OPFS (${file.size} bytes)...`);
  
  // Fallback to WebAssembly if WebGPU is not available
  if (!navigator.gpu) {
    console.warn('WebGPU not available, falling back to WebAssembly (slower).');
  }

  // Mock engine for now
  engine = {
    generate: async (prompt: string) => {
      await new Promise(r => setTimeout(r, 1000));
      return `[Local ${modelId}] Response to: ${prompt}`;
    },
    stream: async function* (prompt: string) {
      const words = `[Local ${modelId}] This is a streamed response from the local model running via WebGPU/WASM.`.split(' ');
      for (const word of words) {
        await new Promise(r => setTimeout(r, 100));
        yield word + ' ';
      }
    }
  };
  
  currentModelId = modelId;
}

async function generateText(prompt: string, systemPrompt?: string) {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:` : `User: ${prompt}\nAssistant:`;
  return await engine.generate(fullPrompt);
}

async function streamGenerateText(prompt: string, systemPrompt: string | undefined, onChunk: (chunk: string) => void) {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:` : `User: ${prompt}\nAssistant:`;
  for await (const chunk of engine.stream(fullPrompt)) {
    onChunk(chunk);
  }
}

/// <reference lib="webworker" />

import { CreateMLCEngine, MLCEngine } from "@mlc-ai/web-llm";

// This worker handles local LLM inference using WebGPU and OPFS.
// We use @mlc-ai/web-llm which natively supports WebGPU and Cache API (persistent storage).

let engine: MLCEngine | null = null;
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
  
  console.log(`Loading model ${modelId} via WebLLM...`);
  
  // Fallback to WebAssembly if WebGPU is not available
  if (!navigator.gpu) {
    console.warn('WebGPU not available, falling back to WebAssembly (slower).');
  }

  const initProgressCallback = (progress: any) => {
    self.postMessage({ type: 'MODEL_PROGRESS', id: 'load', progress: Math.round(progress.progress * 100), text: progress.text });
  };

  engine = await CreateMLCEngine(modelId, { initProgressCallback });
  
  currentModelId = modelId;
}

async function generateText(prompt: string, systemPrompt?: string) {
  if (!engine) throw new Error('Engine not initialized');
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  
  const reply = await engine.chat.completions.create({ messages });
  return reply.choices[0].message.content;
}

async function streamGenerateText(prompt: string, systemPrompt: string | undefined, onChunk: (chunk: string) => void) {
  if (!engine) throw new Error('Engine not initialized');
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  
  const asyncChunkGenerator = await engine.chat.completions.create({
    messages,
    stream: true,
  });
  
  for await (const chunk of asyncChunkGenerator) {
    if (chunk.choices[0]?.delta?.content) {
      onChunk(chunk.choices[0].delta.content);
    }
  }
}

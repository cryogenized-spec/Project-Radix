import { pipeline, env } from '@huggingface/transformers';

// Disable local models, use HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

let textPipeline: any = null;
let visionPipeline: any = null;

const TEXT_MODEL = 'nomic-ai/nomic-embed-text-v1.5';
const VISION_MODEL = 'nomic-ai/nomic-embed-vision-v1.5';

// Matryoshka Slicing utility
function sliceVector(vector: number[] | Float32Array, targetDim: number = 256): number[] {
  const sliced = Array.from(vector).slice(0, targetDim);
  // Re-normalize the sliced vector
  let norm = 0;
  for (let i = 0; i < targetDim; i++) {
    norm += sliced[i] * sliced[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return sliced;
  for (let i = 0; i < targetDim; i++) {
    sliced[i] /= norm;
  }
  return sliced;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, text, imageBlob, prefix } = e.data;

  try {
    if (type === 'initialize') {
      if (!textPipeline) {
        self.postMessage({ status: 'downloading', file: TEXT_MODEL });
        textPipeline = await pipeline('feature-extraction', TEXT_MODEL, {
          device: 'webgpu',
          dtype: 'fp32',
          progress_callback: (x: any) => {
            self.postMessage({ status: 'progress', ...x });
          }
        });
      }
      
      if (!visionPipeline) {
        self.postMessage({ status: 'downloading', file: VISION_MODEL });
        visionPipeline = await pipeline('image-feature-extraction', VISION_MODEL, {
          device: 'webgpu',
          dtype: 'fp32',
          progress_callback: (x: any) => {
            self.postMessage({ status: 'progress', ...x });
          }
        });
      }
      
      self.postMessage({ id, result: 'initialized', status: 'ready' });
    } 
    else if (type === 'embed_text') {
      if (!textPipeline) throw new Error("Text pipeline not initialized");
      
      // Apply prefix as requested
      const prefixedText = prefix ? `${prefix}: ${text}` : `search_document: ${text}`;
      
      const output = await textPipeline(prefixedText, {
        pooling: 'mean',
        normalize: true,
      });
      
      const vector = output.data;
      const slicedVector = sliceVector(vector, 256);
      
      self.postMessage({ id, result: slicedVector });
    }
    else if (type === 'embed_image') {
      if (!visionPipeline) throw new Error("Vision pipeline not initialized");
      
      const url = URL.createObjectURL(imageBlob);
      
      const output = await visionPipeline(url, {
        pooling: 'mean',
        normalize: true,
      });
      
      URL.revokeObjectURL(url);
      
      const vector = output.data;
      const slicedVector = sliceVector(vector, 256);
      
      self.postMessage({ id, result: slicedVector });
    }
    else if (type === 'dispose') {
      if (textPipeline) {
        await textPipeline.dispose();
        textPipeline = null;
      }
      if (visionPipeline) {
        await visionPipeline.dispose();
        visionPipeline = null;
      }
      self.postMessage({ id, result: 'disposed' });
    }
  } catch (error: any) {
    self.postMessage({ id, error: error.message || String(error) });
  }
};

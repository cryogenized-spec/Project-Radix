import avifEncoder from '@jsquash/avif/codec/enc/avif_enc.js';
import { initEmscriptenModule } from '@jsquash/avif/utils.js';
// @ts-ignore
import avifWasmUrl from '@jsquash/avif/codec/enc/avif_enc.wasm?url';

let emscriptenModule: Promise<any>;

function init() {
  if (!emscriptenModule) {
    emscriptenModule = initEmscriptenModule(avifEncoder, undefined, {
      locateFile: (path: string) => {
        if (path.endsWith('avif_enc.wasm')) {
          return avifWasmUrl;
        }
        return path;
      }
    });
  }
  return emscriptenModule;
}

self.onmessage = async (e: MessageEvent) => {
  try {
    const { imageData, quality, speed } = e.data;
    
    const module = await init();
    
    const options = {
      quality: quality ?? 65,
      qualityAlpha: -1,
      denoiseLevel: 0,
      tileColsLog2: 0,
      tileRowsLog2: 0,
      speed: speed ?? 8, // 8 is fast
      subsample: 1, // 4:2:0
      chromaDeltaQ: false,
      sharpness: 0,
      tune: 0,
      enableSharpYUV: false,
      bitDepth: 8,
      lossless: false,
    };
    
    const output = module.encode(new Uint8Array(imageData.data.buffer), imageData.width, imageData.height, options);
    
    if (!output) {
      throw new Error('Encoding error.');
    }
    
    const blob = new Blob([output.buffer], { type: 'image/avif' });
    self.postMessage({ success: true, blob });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};

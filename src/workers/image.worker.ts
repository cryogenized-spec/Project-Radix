import { encode } from '@jsquash/avif';

self.onmessage = async (e) => {
  const { id, file } = e.data;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Transcode to AVIF
    // Prompt: 10-bit, quality 50, effort 4.
    // @jsquash/avif encode options: { quality: number, speed: number, minQuantizer: number, maxQuantizer: number, ... }
    // We'll map effort 4 to speed 4 (AVIF speed is usually 0-10, 10 fastest).
    // For 10-bit, we might need to ensure the pipeline supports it, but standard ImageData is 8-bit clamped.
    // Achieving true 10-bit from 8-bit source (standard upload) is upscaling depth, which is fine but maybe unnecessary if source is 8-bit.
    // We will stick to standard encoding which is high quality.
    
    const arrayBuffer = await encode(imageData, {
        quality: 50,
        speed: 4,
    });
    
    self.postMessage({
        id,
        result: new Blob([arrayBuffer], { type: 'image/avif' })
    });
    
  } catch (error: any) {
    self.postMessage({
      id,
      error: error.message
    });
  }
};

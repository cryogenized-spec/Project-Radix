import { useCallback } from 'react';
// @ts-ignore
import AvifWorker from '../workers/avif.worker?worker';

export function useAvifEncoder() {
  const encodeImage = useCallback(async (file: File, quality: number = 65, speed: number = 8, resolution: '720p' | '1080p' | 'original' = 'original'): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const bitmap = await createImageBitmap(file);
        
        let targetWidth = bitmap.width;
        let targetHeight = bitmap.height;
        
        if (resolution !== 'original') {
          const maxDim = resolution === '1080p' ? 1920 : 1280;
          if (bitmap.width > maxDim || bitmap.height > maxDim) {
            const ratio = Math.min(maxDim / bitmap.width, maxDim / bitmap.height);
            targetWidth = Math.round(bitmap.width * ratio);
            targetHeight = Math.round(bitmap.height * ratio);
          }
        }

        const canvas = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get 2d context from OffscreenCanvas');
        }
        
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        bitmap.close();
        
        const worker = new AvifWorker();
        
        worker.onmessage = (e) => {
          if (e.data.success) {
            resolve(e.data.blob);
          } else {
            reject(new Error(e.data.error || 'AVIF encoding failed'));
          }
          worker.terminate();
        };
        
        worker.onerror = (err) => {
          reject(new Error('Worker error: ' + err.message));
          worker.terminate();
        };
        
        worker.postMessage({ imageData, quality, speed });
      } catch (err: any) {
        reject(new Error('Failed to load image for encoding: ' + err.message));
      }
    });
  }, []);

  return { encodeImage };
}

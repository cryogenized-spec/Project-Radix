import { removeBackground } from '@imgly/background-removal';
import { GoogleGenAI } from '@google/genai';
import { getSetting } from '../lib/db';

export class StickerService {
  static async generateStickerImages(prompt: string, style: string, apiKey: string, count: number = 4): Promise<string[]> {
    if (!apiKey) throw new Error('Gemini API Key is not configured.');

    const ai = new GoogleGenAI({ apiKey });
    
    const enhancedPrompt = `${prompt}, ${style} style, Die-cut sticker, thick white border, vector style, flat illustration, solid background, high resolution, centered.`;

    // We use gemini-3.1-flash-image-preview for high quality images
    // Note: The API might only return 1 image per request depending on the model, 
    // so we might need to make multiple requests if count > 1, or just use the default.
    // For simplicity and speed, we'll request 1 image per call in parallel.
    
    const promises = Array.from({ length: count }).map(async () => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts: [{ text: enhancedPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "512px"
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
        return null;
      } catch (e) {
        console.error("Image generation failed:", e);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter(Boolean) as string[];
  }

  static async removeBackground(imageBlob: Blob): Promise<Blob> {
    return await removeBackground(imageBlob);
  }

  static async addOutlineAndExport(transparentBlob: Blob): Promise<{ masterBlob: Blob, exportBlob: Blob }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context not available'));

        const size = 512;
        canvas.width = size;
        canvas.height = size;

        const padding = 20;
        const scale = Math.min((size - padding * 2) / img.width, (size - padding * 2) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2;

        ctx.drawImage(img, x, y, w, h);

        const outlineCanvas = document.createElement('canvas');
        outlineCanvas.width = size;
        outlineCanvas.height = size;
        const outlineCtx = outlineCanvas.getContext('2d');
        if (!outlineCtx) return reject(new Error('Outline canvas context not available'));

        const outlineSize = 8;
        
        // Draw the image shifted in a circle to create a thick white border
        const steps = 36;
        for (let i = 0; i < steps; i++) {
          const angle = (i * Math.PI * 2) / steps;
          const dx = Math.cos(angle) * outlineSize;
          const dy = Math.sin(angle) * outlineSize;
          outlineCtx.drawImage(canvas, dx, dy);
        }

        // Fill the outline with white
        outlineCtx.globalCompositeOperation = 'source-in';
        outlineCtx.fillStyle = 'white';
        outlineCtx.fillRect(0, 0, size, size);

        // Draw the original image over the white outline
        outlineCtx.globalCompositeOperation = 'source-over';
        outlineCtx.drawImage(canvas, 0, 0);

        let masterMime = 'image/avif';
        let exportMime = 'image/webp';

        outlineCanvas.toBlob((masterBlob) => {
          if (!masterBlob) {
            // Fallback to WebP if AVIF fails
            outlineCanvas.toBlob((fallbackBlob) => {
              if (!fallbackBlob) return reject(new Error('Failed to create fallback blob'));
              resolve({ masterBlob: fallbackBlob, exportBlob: fallbackBlob });
            }, exportMime, 1.0);
            return;
          }
          
          outlineCanvas.toBlob((exportBlob) => {
            if (!exportBlob) return reject(new Error('Failed to create export blob'));
            resolve({ masterBlob, exportBlob });
          }, exportMime, 0.9);
        }, masterMime, 1.0);
      };
      
      img.onerror = () => reject(new Error('Failed to load image for canvas'));
      img.src = URL.createObjectURL(transparentBlob);
    });
  }
}

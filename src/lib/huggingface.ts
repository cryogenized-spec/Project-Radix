import { decryptApiKey } from './apiKeyCrypto';
import { getSetting } from './db';

export interface HFImageGenParams {
  model: string;
  inputs: string;
  parameters?: {
    negative_prompt?: string;
    num_inference_steps?: number;
    guidance_scale?: number;
    width?: number;
    height?: number;
  };
}

export async function generateHuggingFaceImage(params: HFImageGenParams): Promise<Blob> {
  const encryptedKey = await getSetting('hfApiKey');
  const apiKey = await decryptApiKey(encryptedKey || '');

  if (!apiKey) {
    throw new Error('Hugging Face API key is missing. Please set it in the API Lockbox.');
  }

  const url = `/api/hf/generate`;
  const headers = {
    'Content-Type': 'application/json',
  };

  let retries = 0;
  const maxRetries = 3;

  const { model, ...bodyParams } = params;

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          apiKey,
          ...bodyParams
        }),
      });

      if (response.status === 503) {
        // Cold start interceptor
        const errorData = await response.json();
        const estimatedTime = errorData.estimated_time || 30;
        console.warn(`[HF API] Model ${params.model} is loading. Waiting ${estimatedTime} seconds...`);
        
        // Wait for the estimated time + a small buffer
        await new Promise(resolve => setTimeout(resolve, (estimatedTime + 2) * 1000));
        retries++;
        continue;
      }

      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errJson = await response.json();
          errorMsg = errJson.error || errorMsg;
        } catch (e) {
          // Ignore json parse error
        }
        throw new Error(`Hugging Face API Error: ${errorMsg}`);
      }

      const blob = await response.blob();
      return blob;

    } catch (error: any) {
      if (error.message.includes('Hugging Face API Error')) {
        throw error;
      }
      console.error(`Attempt ${retries + 1} failed:`, error);
      retries++;
      if (retries >= maxRetries) {
        throw new Error(`Failed to generate image after ${maxRetries} attempts. ${error.message}`);
      }
      // Wait a bit before retrying on network errors
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Failed to generate image.');
}

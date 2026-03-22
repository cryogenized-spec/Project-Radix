import { useState, useEffect, useRef, useCallback } from 'react';

// Shim for TextDetector
declare global {
  interface Window {
    TextDetector?: any;
  }
}

export interface DetectedText {
  rawValue: string;
  boundingBox: DOMRectReadOnly;
}

export function useDocumentScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [detectedTexts, setDetectedTexts] = useState<DetectedText[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const detectorRef = useRef<any>(null);

  useEffect(() => {
    if (window.TextDetector) {
      detectorRef.current = new window.TextDetector();
    } else {
      setError("TextDetector API is not supported on this browser.");
    }
  }, []);

  const startScanner = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((e: any) => {
          if (e.name !== 'AbortError' && !e.message?.includes('interrupted')) {
            console.error("Video play error:", e);
          }
        });
      }
      setIsScanning(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to access camera.");
    }
  }, []);

  const stopScanner = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDetectedTexts([]);
  }, []);

  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || !isScanning) return;

    try {
      const texts = await detectorRef.current.detect(videoRef.current);
      setDetectedTexts(texts);
    } catch (e) {
      // Ignore errors during continuous detection
    }

    timeoutRef.current = window.setTimeout(() => {
      requestAnimationFrame(detectLoop);
    }, 200);
  }, [isScanning]);

  useEffect(() => {
    if (isScanning && videoRef.current) {
      // If video is already playing, start immediately
      if (videoRef.current.readyState >= 2) {
        timeoutRef.current = window.setTimeout(() => {
          requestAnimationFrame(detectLoop);
        }, 200);
      } else {
        videoRef.current.onloadedmetadata = () => {
          timeoutRef.current = window.setTimeout(() => {
            requestAnimationFrame(detectLoop);
          }, 200);
        };
      }
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isScanning, detectLoop]);

  const captureDocument = useCallback(async (): Promise<{ blob: Blob, text: string } | null> => {
    if (!videoRef.current || !streamRef.current) return null;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return null;

    let fullText = "";
    if (detectorRef.current) {
      try {
        const texts = await detectorRef.current.detect(canvas);
        fullText = texts.map((t: any) => t.rawValue).join('\n');
      } catch (e) {
        console.error("Text detection failed on capture", e);
      }
    }

    return { blob, text: fullText };
  }, []);

  return {
    videoRef,
    isScanning,
    detectedTexts,
    error,
    startScanner,
    stopScanner,
    captureDocument
  };
}

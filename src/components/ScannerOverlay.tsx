import React, { useEffect } from 'react';
import { useDocumentScanner } from '../hooks/useDocumentScanner';
import { X, Camera, Loader2 } from 'lucide-react';

interface ScannerOverlayProps {
  onClose: () => void;
  onCaptureComplete: (blob: Blob, text: string) => void;
}

export default function ScannerOverlay({ onClose, onCaptureComplete }: ScannerOverlayProps) {
  const {
    videoRef,
    isScanning,
    detectedTexts,
    error,
    startScanner,
    stopScanner,
    captureDocument
  } = useDocumentScanner();

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, [startScanner, stopScanner]);

  const handleCapture = async () => {
    const result = await captureDocument();
    if (result) {
      onCaptureComplete(result.blob, result.text);
      onClose();
    }
  };

  const isTextLocked = detectedTexts.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onClose} className="p-2 text-white rounded-full bg-black/30 hover:bg-black/50 transition-colors">
          <X size={24} />
        </button>
        <span className="text-white font-medium tracking-wide">Document Scanner</span>
        <div className="w-10"></div> {/* Spacer for alignment */}
      </div>

      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center bg-black">
        {error ? (
          <div className="text-red-400 p-4 text-center bg-black/80 rounded-lg">
            {error}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Visual Anchoring for Detected Text */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {detectedTexts.map((text, index) => {
                const { boundingBox } = text;
                // Calculate relative position based on video dimensions vs screen dimensions
                // For simplicity, assuming object-cover scales uniformly
                const video = videoRef.current;
                if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

                const videoRatio = video.videoWidth / video.videoHeight;
                const containerRatio = window.innerWidth / window.innerHeight;
                
                let scale = 1;
                let offsetX = 0;
                let offsetY = 0;

                if (containerRatio > videoRatio) {
                  scale = window.innerWidth / video.videoWidth;
                  offsetY = (window.innerHeight - video.videoHeight * scale) / 2;
                } else {
                  scale = window.innerHeight / video.videoHeight;
                  offsetX = (window.innerWidth - video.videoWidth * scale) / 2;
                }

                const x = boundingBox.x * scale + offsetX;
                const y = boundingBox.y * scale + offsetY;
                const width = boundingBox.width * scale;
                const height = boundingBox.height * scale;

                return (
                  <rect
                    key={index}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill="rgba(59, 130, 246, 0.2)"
                    stroke="rgba(59, 130, 246, 0.8)"
                    strokeWidth="2"
                    rx="4"
                    className="transition-all duration-200 ease-out"
                  />
                );
              })}
            </svg>

            {/* Prompt */}
            {isTextLocked && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-full font-medium shadow-lg z-20 animate-bounce">
                Text locked. Tap to snap.
              </div>
            )}

            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="animate-spin text-white" size={48} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center items-center bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={handleCapture}
          disabled={!isScanning || !!error}
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all disabled:opacity-50 ${
            isTextLocked ? 'border-blue-500 bg-blue-500/20 hover:bg-blue-500/40' : 'border-white bg-white/20 hover:bg-white/40'
          }`}
        >
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
            <Camera className={isTextLocked ? 'text-blue-500' : 'text-black'} size={32} />
          </div>
        </button>
      </div>
    </div>
  );
}

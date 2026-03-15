import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, ScanLine, FileText, QrCode, Barcode } from 'lucide-react';
import jsQR from 'jsqr';

interface CodeScannerProps {
  onScan: (result: string, type: string, imageData?: string) => void;
  onClose: () => void;
}

export const CodeScanner: React.FC<CodeScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanMode, setScanMode] = useState<'OCR' | 'QR' | 'BARCODE'>('OCR');
  const [barcodeType, setBarcodeType] = useState<string>('');
  const [isStable, setIsStable] = useState(false);

  // Stability tracking
  const stabilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastBoxRef = useRef<{ x: number, y: number, w: number, h: number } | null>(null);
  const stableFramesRef = useRef(0);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Play error:", e));
            setHasPermission(true);
            requestAnimationFrame(tick);
          };
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError('Camera permission denied or not available.');
        setHasPermission(false);
      }
    };

    const captureAndReturn = (result: string, type: string, box?: any) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onScan(result, type, dataUrl);
      }
    };

    const checkStability = (currentBox: { x: number, y: number, w: number, h: number }, result: string, type: string) => {
      const lastBox = lastBoxRef.current;
      if (lastBox) {
        const dx = Math.abs(currentBox.x - lastBox.x);
        const dy = Math.abs(currentBox.y - lastBox.y);
        const dw = Math.abs(currentBox.w - lastBox.w);
        const dh = Math.abs(currentBox.h - lastBox.h);
        
        // If box hasn't moved much (within 5% tolerance)
        if (dx < 20 && dy < 20 && dw < 20 && dh < 20) {
          stableFramesRef.current += 1;
          if (stableFramesRef.current > 15) { // ~0.5 to 1 second of stability
            setIsStable(true);
            if (stableFramesRef.current > 30) { // ~1.5 seconds
              captureAndReturn(result, type, currentBox);
              return true; // Captured
            }
          }
        } else {
          stableFramesRef.current = 0;
          setIsStable(false);
        }
      } else {
        stableFramesRef.current = 0;
      }
      lastBoxRef.current = currentBox;
      return false;
    };

    const drawOverlay = (box: { x: number, y: number, w: number, h: number }, color: string) => {
      const overlay = overlayRef.current;
      const video = videoRef.current;
      if (!overlay || !video) return;
      
      // Match overlay size to video display size
      const rect = video.getBoundingClientRect();
      overlay.width = rect.width;
      overlay.height = rect.height;
      
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      
      // Scale box coordinates from video intrinsic size to display size
      const scaleX = rect.width / video.videoWidth;
      const scaleY = rect.height / video.videoHeight;
      
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.w * scaleX;
      const h = box.h * scaleY;
      
      // Draw darkened background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, overlay.width, overlay.height);
      ctx.clearRect(x, y, w, h);
      
      // Draw frame lines
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      
      const cornerLength = 20;
      
      ctx.beginPath();
      // Top Left
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      // Top Right
      ctx.moveTo(x + w - cornerLength, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLength);
      // Bottom Right
      ctx.moveTo(x + w, y + h - cornerLength);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - cornerLength, y + h);
      // Bottom Left
      ctx.moveTo(x + cornerLength, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h - cornerLength);
      ctx.stroke();
    };

    const tick = async () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (canvas) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            let foundCode = false;
            let currentBox = { x: 0, y: 0, w: 0, h: 0 };
            let result = '';
            let type = '';

            // 1. Try BarcodeDetector (if available, handles multiple formats)
            if ('BarcodeDetector' in window) {
              try {
                const barcodeDetector = new (window as any).BarcodeDetector();
                const barcodes = await barcodeDetector.detect(canvas);
                if (barcodes.length > 0) {
                  const bc = barcodes[0];
                  foundCode = true;
                  currentBox = { x: bc.boundingBox.x, y: bc.boundingBox.y, w: bc.boundingBox.width, h: bc.boundingBox.height };
                  result = bc.rawValue;
                  type = bc.format.toUpperCase();
                  
                  if (type.includes('QR')) {
                    setScanMode('QR');
                  } else {
                    setScanMode('BARCODE');
                    setBarcodeType(type);
                  }
                }
              } catch (e) {
                // Ignore
              }
            }

            // 2. Fallback to jsQR if BarcodeDetector didn't find anything
            if (!foundCode) {
              const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              if (code) {
                foundCode = true;
                const minX = Math.min(code.location.topLeftCorner.x, code.location.bottomLeftCorner.x);
                const minY = Math.min(code.location.topLeftCorner.y, code.location.topRightCorner.y);
                const maxX = Math.max(code.location.topRightCorner.x, code.location.bottomRightCorner.x);
                const maxY = Math.max(code.location.bottomLeftCorner.y, code.location.bottomRightCorner.y);
                currentBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
                result = code.data;
                type = 'QR_CODE';
                setScanMode('QR');
              }
            }

            // 3. OCR / Document Mode (Simulated if no barcode found)
            if (!foundCode) {
              setScanMode('OCR');
              // Simulate a document bounding box in the center
              const w = canvas.width * 0.7;
              const h = canvas.height * 0.6;
              const x = (canvas.width - w) / 2;
              const y = (canvas.height - h) / 2;
              currentBox = { x, y, w, h };
              result = 'OCR_DOCUMENT_CAPTURE';
              type = 'OCR';
            }

            // Draw overlay
            const color = isStable ? '#00FF00' : '#F27D26'; // Green if stable, Orange otherwise
            drawOverlay(currentBox, color);

            // Check stability and auto-capture
            const captured = checkStability(currentBox, result, type);
            if (captured) return; // Stop loop
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [onScan]);

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center overflow-hidden">
      {error ? (
        <div className="text-white text-center p-4">
          <p className="mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg">
            Close
          </button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            playsInline 
            muted 
          />
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-20">
            <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              {scanMode === 'OCR' && <FileText size={16} className="text-white" />}
              {scanMode === 'QR' && <QrCode size={16} className="text-white" />}
              {scanMode === 'BARCODE' && <Barcode size={16} className="text-white" />}
              <span className="text-white text-xs font-bold uppercase tracking-wider">
                {scanMode === 'OCR' ? 'OCR Document' : scanMode === 'QR' ? 'QR Reader' : `Barcode (${barcodeType})`}
              </span>
            </div>
            <button onClick={onClose} className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors border border-white/10">
              <X size={20} />
            </button>
          </div>

          {/* Bottom Status */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20">
            <div className={`px-6 py-2 rounded-full backdrop-blur-md border transition-all duration-300 ${
              isStable 
                ? 'bg-green-500/20 border-green-500/50 text-green-400' 
                : 'bg-black/50 border-white/10 text-white'
            }`}>
              <span className="text-sm font-bold uppercase tracking-widest">
                {isStable ? 'Capturing...' : 'Hold Still'}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

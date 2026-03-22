import React, { useState } from 'react';
import ScannerOverlay from './ScannerOverlay';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { getSetting } from '../lib/db';
import { db as organizerDb } from '../lib/organizerDb';
import { motion, AnimatePresence } from 'motion/react';

export default function ScannerTool() {
  const [scannedData, setScannedData] = useState<{ result: string, type: string, image?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string, message: string }[]>([]);

  const addNotification = (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleCaptureComplete = async (blob: Blob, text: string) => {
    setIsProcessing(true);
    
    try {
      const settings = await getSetting('ai_settings') || {};
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      
      const prompt = `
Analyze the following image of a document and provide a full transcription in Markdown format.
      `;

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      if (!base64Data) throw new Error("Could not read image data");

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      };

      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, { text: prompt }] },
      });

      const markdownContent = res.text || 'No content generated.';

      // Create a note with the OCR text and image attachment
      const newNote = {
        title: `Scanned Document - ${new Date().toLocaleString()}`,
        content: markdownContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['scanned', 'document'],
        attachments: [{
          name: 'scanned-document.jpg',
          type: 'image/jpeg',
          data: blob
        }]
      };
      
      await organizerDb.notes.add(newNote);

      setScannedData({
        result: markdownContent,
        type: 'DOCUMENT',
        image: URL.createObjectURL(blob)
      });
      
      addNotification(`Document scanned and saved to Notes`);

    } catch (error) {
      console.error("Processing error:", error);
      addNotification("Error processing document.");
      setScannedData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-[var(--bg-color)] overflow-hidden">
      {/* Scanner Area (Full Screen) */}
      <div className="absolute inset-0">
        {!scannedData && !isProcessing ? (
          <ScannerOverlay onCaptureComplete={handleCaptureComplete} onClose={() => {}} />
        ) : isProcessing ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/90">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <div className="text-white font-medium tracking-wide animate-pulse">Processing Document...</div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/90">
            {scannedData?.image && (
              <img src={scannedData.image} alt="Scanned Preview" className="max-w-full max-h-[60vh] object-contain rounded-xl border border-white/20 mb-6 shadow-2xl" />
            )}
            <div className="bg-black/50 backdrop-blur-md border border-white/20 rounded-xl p-4 w-full max-w-md text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">{scannedData?.type}</div>
              <div className="text-lg font-mono text-[var(--accent)] break-all max-h-32 overflow-y-auto">{scannedData?.result}</div>
            </div>
            <button 
              onClick={() => setScannedData(null)}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-bold tracking-wider uppercase text-sm transition-colors border border-white/20"
            >
              Scan Another
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map(notif => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="bg-green-500/20 backdrop-blur-md border border-green-500/50 text-green-100 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 pointer-events-auto"
            >
              <CheckCircle2 className="text-green-400" size={18} />
              <span className="text-sm font-medium">{notif.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

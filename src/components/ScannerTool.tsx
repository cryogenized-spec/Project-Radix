import React, { useState } from 'react';
import { CodeScanner } from './CodeScanner';
import { Mic, Send, Bot, FileText, Calendar, CheckSquare, Pin, CheckCircle2 } from 'lucide-react';
import { generateAIResponse } from '../lib/gemini';
import { getSetting } from '../lib/db';
import { useRadixSync } from '../lib/useRadixSync';
import { motion, AnimatePresence } from 'motion/react';

export default function ScannerTool() {
  const [scannedData, setScannedData] = useState<{ result: string, type: string, image?: string } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState('');
  const { addFrame } = useRadixSync();
  const [notifications, setNotifications] = useState<{ id: string, message: string }[]>([]);

  const addNotification = (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const handleScan = (result: string, type: string, imageData?: string) => {
    setScannedData({ result, type, image: imageData });
  };

  const handleProcess = async () => {
    if (!scannedData || !instruction.trim()) return;
    
    setIsProcessing(true);
    setResponse('');
    
    try {
      const settings = await getSetting('ai_settings') || {};
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      
      const prompt = `
Analyze the following image of a document and provide a full transcription in Markdown format.
User Instruction: ${instruction}
      `;

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: scannedData.image!.split(',')[1],
        },
      };

      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, { text: prompt }] },
      });

      const markdownContent = res.text || 'No content generated.';

      const docId = addFrame({
        type: 'doc',
        x: 100, y: 100, z: 1, w: 400, h: 500,
        content: markdownContent,
        date: new Date().toISOString().split('T')[0]
      });
      addNotification(`Created Note: Document Scanned`);
      setResponse(`Scan complete. Note added.`);

    } catch (error) {
      console.error("Processing error:", error);
      setResponse("Error processing request.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-[var(--bg-color)] overflow-hidden">
      {/* Scanner Area (Full Screen) */}
      <div className="absolute inset-0">
        {!scannedData ? (
          <CodeScanner onScan={handleScan} onClose={() => {}} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/90">
            {scannedData.image && (
              <img src={scannedData.image} alt="Scanned Preview" className="max-w-full max-h-[60vh] object-contain rounded-xl border border-white/20 mb-6 shadow-2xl" />
            )}
            <div className="bg-black/50 backdrop-blur-md border border-white/20 rounded-xl p-4 w-full max-w-md text-center">
              <div className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">{scannedData.type}</div>
              <div className="text-lg font-mono text-[var(--accent)] break-all">{scannedData.result}</div>
            </div>
            <button 
              onClick={() => setScannedData(null)}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-white font-bold tracking-wider uppercase text-sm transition-colors border border-white/20"
            >
              Scan Again
            </button>
          </div>
        )}
      </div>

      {/* AI Processing Overlay (Blue Pin Theme) */}
      <AnimatePresence>
        {scannedData && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute bottom-6 right-6 w-full max-w-sm flex flex-col bg-[var(--panel-bg)]/95 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-30"
          >
            <div className="p-3 border-b border-[var(--border)] flex items-center bg-blue-500/10">
              <Pin className="text-blue-400 mr-2" size={18} fill="currentColor" />
              <h3 className="font-bold text-sm text-blue-100">AI Agent</h3>
            </div>
            
            <div className="flex-1 p-4 max-h-64 overflow-y-auto">
              {response ? (
                <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-50">
                  {response}
                </div>
              ) : (
                <>
                  <div className="text-[10px] text-[var(--text-muted)] mb-2 uppercase tracking-wider font-bold">Instructions</div>
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    Example: "Customer bought 5x blank cartridges and 10x pepper cartridges. Just now."
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Example: "Research this product's shipping, country of origin, and create a task to review it tomorrow."
                  </p>
                </>
              )}
            </div>

            <div className="p-3 border-t border-[var(--border)] bg-black/20">
              <div className="flex items-end gap-2">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500/50 transition-colors">
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Give instruction..."
                    className="w-full bg-transparent border-none outline-none p-3 text-sm resize-none min-h-[60px] text-white"
                    disabled={isProcessing}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    className="p-2.5 bg-black/40 hover:bg-white/10 border border-white/10 rounded-xl text-white/50 transition-colors disabled:opacity-50"
                    disabled={isProcessing}
                  >
                    <Mic size={16} />
                  </button>
                  <button 
                    onClick={handleProcess}
                    className="p-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/20"
                    disabled={!instruction.trim() || isProcessing}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

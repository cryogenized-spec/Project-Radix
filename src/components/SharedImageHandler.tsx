import React, { useState, useEffect, useRef } from 'react';
import { X, Type, Image as ImageIcon, Save, Pin, Loader2, Mic } from 'lucide-react';
import { getAgents, getSetting, setSetting, saveMedia } from '../lib/db';
import { db as organizerDb } from '../lib/organizerDb';
import { GoogleGenAI } from '@google/genai';
import encode from '@jsquash/avif/encode';

interface SharedImageHandlerProps {
  sharedId?: string | null;
  onClose: () => void;
}

export default function SharedImageHandler({ sharedId, onClose }: SharedImageHandlerProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [avifUrl, setAvifUrl] = useState('');
  const [avifBlob, setAvifBlob] = useState<Blob | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [callAgent, setCallAgent] = useState<any>(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeSharedId, setActiveSharedId] = useState<string | null>(sharedId || null);

  useEffect(() => {
    const init = async () => {
      await loadCallAgent();
      const session = await loadSession();
      const idToLoad = sharedId || (session && session.sharedId);
      if (idToLoad) {
        setActiveSharedId(idToLoad);
        await loadSharedImage(idToLoad);
      }
    };
    init();
  }, [sharedId]);

  useEffect(() => {
    if (isPinned) {
      setSetting('pinned_shared_session', { isPinned, messages, sharedId: activeSharedId });
    } else {
      setSetting('pinned_shared_session', null);
    }
  }, [isPinned, messages, activeSharedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async () => {
    const session = await getSetting('pinned_shared_session');
    if (session && session.isPinned) {
      setIsPinned(true);
      setMessages(session.messages || []);
      return session;
    }
    return null;
  };

  const loadCallAgent = async () => {
    const agents = await getAgents();
    const agent = agents.find(a => a.isCall);
    if (agent) {
      setCallAgent(agent);
    }
  };

  const loadSharedImage = async (id: string) => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('SharedImagesDB', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const data = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction('shared', 'readonly');
        const store = tx.objectStore('shared');
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (data && data.image) {
        setImageFile(data.image);
        setImageUrl(URL.createObjectURL(data.image));
      } else {
        setError('Shared image not found.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load shared image.');
    }
  };

  const handleOCR = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setError('');
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key not found.');

      const ai = new GoogleGenAI({ apiKey });
      
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);
      await new Promise(resolve => reader.onload = resolve);
      const base64Data = (reader.result as string).split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: imageFile.type } },
            { text: 'Perform OCR on this image. Return ONLY the extracted text formatted as GitHub-Flavored Markdown (GFM). Do not include any conversational filler.' }
          ]
        }
      });

      setOcrText(response.text || '');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'OCR failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvert = async () => {
    if (!imageFile) return;
    setIsProcessing(true);
    setError('');
    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise(resolve => img.onload = resolve);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available.');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const avifBuffer = await encode(imageData, { quality: 65 });
      const blob = new Blob([avifBuffer], { type: 'image/avif' });
      setAvifBlob(blob);
      setAvifUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Image conversion failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveNote = async () => {
    if (!ocrText && !avifBlob) return;
    
    setIsProcessing(true);
    try {
      let content = ocrText;
      if (avifBlob) {
        const mediaId = await saveMedia(avifBlob, 'image');
        content += `\n\n![Converted Image](media://${mediaId})`;
      }

      const note = {
        id: Date.now().toString(),
        title: 'Shared Image Note',
        content,
        parentId: 'root',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFolder: false,
        orderIndex: Date.now()
      };

      await organizerDb.notes.put(note);
      alert('Note saved successfully!');
    } catch (err: any) {
      console.error(err);
      setError('Failed to save note.');
    } finally {
      setIsProcessing(false);
    }
  };

  const [imageAttached, setImageAttached] = useState(false);

  useEffect(() => {
    setImageAttached(false);
  }, [imageFile]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !callAgent) return;
    
    const newMessages = [...messages, { role: 'user', text: inputText }];
    setMessages(newMessages);
    setInputText('');
    setIsProcessing(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('Gemini API key not found.');

      const ai = new GoogleGenAI({ apiKey });
      
      let currentImageAttached = imageAttached;
      
      const contents = await Promise.all(newMessages.map(async (msg, index) => {
        const parts: any[] = [{ text: msg.text }];
        // Attach image to the latest message if not already attached
        if (index === newMessages.length - 1 && imageFile && !currentImageAttached && msg.role === 'user') {
          const reader = new FileReader();
          reader.readAsDataURL(imageFile);
          await new Promise(resolve => reader.onload = resolve);
          const base64Data = (reader.result as string).split(',')[1];
          parts.unshift({ inlineData: { data: base64Data, mimeType: imageFile.type } });
          currentImageAttached = true;
        }
        return { role: msg.role, parts };
      }));

      setImageAttached(currentImageAttached);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents,
        config: {
          systemInstruction: callAgent.privatePersona || 'You are a helpful assistant analyzing shared images.'
        }
      });

      setMessages([...newMessages, { role: 'model', text: response.text || '' }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to get AI response.');
    } finally {
      setIsProcessing(false);
    }
  };

  const [isListening, setIsListening] = useState(false);

  const handleVTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-color)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--panel-bg)]">
        <h2 className="font-bold text-[var(--text-main)]">Shared Image Handler</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPinned(!isPinned)}
            className={`p-2 rounded-full transition-colors ${isPinned ? 'bg-yellow-500/20 text-yellow-500' : 'text-[var(--text-muted)] hover:bg-[var(--border)]'}`}
            title="Pin Session"
          >
            <Pin size={20} />
          </button>
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 rounded-lg text-sm">
            {error}
          </div>
        )}

        {imageUrl && (
          <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-black/20 flex justify-center">
            <img src={imageUrl} alt="Shared" className="max-h-64 object-contain" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleOCR}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl text-[var(--text-main)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Type size={18} />}
            <span>OCR to Note</span>
          </button>
          
          <button 
            onClick={handleConvert}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl text-[var(--text-main)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
            <span>Convert to AVIF</span>
          </button>

          {(ocrText || avifBlob) && (
            <button 
              onClick={handleSaveNote}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-[var(--accent)] text-black font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Save size={18} />
              <span>Save Note</span>
            </button>
          )}
        </div>

        {ocrText && (
          <div className="p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
            <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-2">OCR Result</h3>
            <pre className="whitespace-pre-wrap text-sm font-mono text-[var(--text-main)]">{ocrText}</pre>
          </div>
        )}

        {avifUrl && (
          <div className="p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
            <h3 className="text-xs font-bold uppercase text-[var(--text-muted)] mb-2">AVIF Preview</h3>
            <img src={avifUrl} alt="Converted AVIF" className="max-h-48 object-contain mx-auto" />
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3 mt-6">
            <h3 className="text-xs font-bold uppercase text-[var(--text-muted)]">AI Conversation</h3>
            {messages.map((msg, i) => (
              <div key={i} className={`p-3 rounded-xl ${msg.role === 'user' ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 ml-8' : 'bg-[var(--panel-bg)] border border-[var(--border)] mr-8'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)] bg-[var(--panel-bg)]">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleVTT}
            className={`p-3 border border-[var(--border)] rounded-xl transition-colors ${isListening ? 'bg-red-500/20 text-red-500 border-red-500/50 animate-pulse' : 'bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            title="Voice to Text"
          >
            <Mic size={20} />
          </button>
          <input 
            type="text" 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder={callAgent ? `Ask ${callAgent.name}...` : "Select a Call Agent in Settings first..."}
            disabled={!callAgent || isProcessing}
            className="flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useRadixSync, RadixFrame } from '../../lib/useRadixSync';
import { Plus, Maximize, Minimize, Trash2, Edit2, FileText, Grid, Image as ImageIcon, CheckSquare, ScanBarcode, LayoutTemplate, Undo, Redo, Mic, Brain, Check, X, Smartphone, RotateCcw, BarChart2, ListTodo, Code, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from '@google/genai';

// --- Frame Components ---

const DocFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 overflow-auto prose prose-invert prose-sm">
    <textarea 
      className="w-full h-full bg-transparent border-none outline-none resize-none"
      value={frame.content || ''}
      onChange={(e) => updateFrame(frame.id, { content: e.target.value })}
      placeholder="Type markdown here..."
    />
  </div>
);

const SheetFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => {
  const data = typeof frame.content === 'object' ? frame.content : { items: [] };
  const items = data.items || [];
  
  return (
    <div className="w-full h-full bg-[var(--panel-bg)] p-2 overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border border-[var(--border)] p-1 text-xs text-[var(--text-muted)]">Key</th>
            <th className="border border-[var(--border)] p-1 text-xs text-[var(--text-muted)]">Value</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? items.map((item: any, i: number) => (
            <tr key={i}>
              <td className="border border-[var(--border)] p-1 text-xs">{item.k || item.name || ''}</td>
              <td className="border border-[var(--border)] p-1 text-xs">{item.v || item.amount || ''}</td>
            </tr>
          )) : (
            [1, 2, 3].map(row => (
              <tr key={row}>
                <td className="border border-[var(--border)] p-1"><input className="w-full bg-transparent outline-none text-xs" /></td>
                <td className="border border-[var(--border)] p-1"><input className="w-full bg-transparent outline-none text-xs" /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

const TaskFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 flex items-center">
    <input 
      type="checkbox" 
      className="mr-3 w-4 h-4 accent-[var(--accent)]"
      checked={frame.content?.completed || false}
      onChange={(e) => updateFrame(frame.id, { content: { ...frame.content, completed: e.target.checked } })}
    />
    <input 
      className="w-full bg-transparent border-none outline-none text-sm"
      value={typeof frame.content === 'string' ? frame.content : frame.content?.text || ''}
      onChange={(e) => updateFrame(frame.id, { content: { ...frame.content, text: e.target.value } })}
      placeholder="Task description..."
    />
  </div>
);

const ChecklistFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => {
  const items = Array.isArray(frame.content) ? frame.content : [];
  return (
    <div className="w-full h-full bg-[var(--panel-bg)] p-4 overflow-auto">
      {items.map((item: any, i: number) => (
        <div key={i} className="flex items-center mb-2">
          <input type="checkbox" checked={item.checked} onChange={(e) => {
            const newItems = [...items];
            newItems[i].checked = e.target.checked;
            updateFrame(frame.id, { content: newItems });
          }} className="mr-2 accent-[var(--accent)]" />
          <input className="bg-transparent border-none outline-none text-sm flex-1" value={item.text} onChange={(e) => {
            const newItems = [...items];
            newItems[i].text = e.target.value;
            updateFrame(frame.id, { content: newItems });
          }} />
        </div>
      ))}
      <button onClick={() => updateFrame(frame.id, { content: [...items, { text: '', checked: false }] })} className="text-xs text-[var(--accent)] mt-2">+ Add Item</button>
    </div>
  );
};

const GraphFrame = ({ frame }: { frame: RadixFrame }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 flex flex-col items-center justify-center text-[var(--text-muted)]">
    <BarChart2 size={48} className="mb-2 opacity-50 text-[var(--accent)]" />
    <span className="text-xs uppercase tracking-wider font-bold">Chart View</span>
    <div className="w-full h-24 mt-4 flex items-end justify-around gap-2">
      <div className="w-1/5 bg-[var(--accent)]/40 h-1/2 rounded-t"></div>
      <div className="w-1/5 bg-[var(--accent)]/60 h-3/4 rounded-t"></div>
      <div className="w-1/5 bg-[var(--accent)]/80 h-full rounded-t"></div>
      <div className="w-1/5 bg-[var(--accent)] h-2/3 rounded-t"></div>
    </div>
  </div>
);

const CodeFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => (
  <div className="w-full h-full bg-[#1e1e1e] p-4 overflow-auto font-mono text-xs text-green-400">
    <textarea 
      className="w-full h-full bg-transparent border-none outline-none resize-none"
      value={frame.content || ''}
      onChange={(e) => updateFrame(frame.id, { content: e.target.value })}
      placeholder="// Write code here..."
      spellCheck={false}
    />
  </div>
);

const AiAssistantFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 flex flex-col">
    <div className="flex-1 overflow-auto prose prose-invert prose-sm mb-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{frame.content?.response || 'I am your AI assistant. How can I help you with this canvas?'}</ReactMarkdown>
    </div>
    <div className="flex items-center border border-[var(--border)] rounded-lg p-1">
      <input className="flex-1 bg-transparent border-none outline-none text-xs px-2" placeholder="Ask AI..." />
      <button className="p-1 text-[var(--accent)]"><Brain size={14} /></button>
    </div>
  </div>
);

const GenericFrame = ({ frame }: { frame: RadixFrame }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 flex items-center justify-center">
    <span className="text-xs text-[var(--text-muted)]">{frame.type} Frame</span>
  </div>
);

// --- Main Component ---

export default function HybridNoteView() {
  const { frames, addFrame, updateFrame, deleteFrame, undo, redo, clearGhosts, commitGhosts } = useRadixSync();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isThinking, setIsThinking] = useState(false);
  const [isPortraitLocked, setIsPortraitLocked] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const hasGhosts = frames.some(f => f.isGhost);

  // Portrait Lock Effect
  useEffect(() => {
    const orientation = (window.screen && window.screen.orientation) as any;
    if (isPortraitLocked && orientation && orientation.lock) {
      orientation.lock('portrait').catch((e: any) => console.warn('Orientation lock failed', e));
    } else if (!isPortraitLocked && orientation && orientation.unlock) {
      orientation.unlock();
    }
    return () => {
      if (orientation && orientation.unlock) {
        orientation.unlock();
      }
    };
  }, [isPortraitLocked]);

  const handleAddFrame = (type: string) => {
    const scrollX = containerRef.current?.scrollLeft || 0;
    const scrollY = containerRef.current?.scrollTop || 0;
    
    addFrame({
      type,
      x: scrollX + Math.random() * 100 + 50,
      y: scrollY + Math.random() * 100 + 50,
      z: frames.length,
      w: 300,
      h: 200,
      content: type === 'checklist' ? [{text: 'New Item', checked: false}] : ''
    });
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input' || 
        (e.target as HTMLElement).tagName.toLowerCase() === 'textarea' ||
        (e.target as HTMLElement).tagName.toLowerCase() === 'button') {
      return;
    }
    
    const frame = frames.find(f => f.id === id);
    if (!frame || !containerRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    setDraggingId(id);
    setDragOffset({
      x: clientX - rect.left + containerRef.current.scrollLeft - frame.x,
      y: clientY - rect.top + containerRef.current.scrollTop - frame.y
    });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggingId || !containerRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = containerRef.current.getBoundingClientRect();
    const newX = clientX - rect.left + containerRef.current.scrollLeft - dragOffset.x;
    const newY = clientY - rect.top + containerRef.current.scrollTop - dragOffset.y;
    
    updateFrame(draggingId, { x: newX, y: newY });
  };

  const handlePointerUp = () => {
    setDraggingId(null);
  };

  const handleAIAssist = async (prompt: string) => {
    setIsThinking(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      
      const ai = new GoogleGenAI({ apiKey });
      
      const contextStr = frames.map(f => `${f.type} at (${Math.round(f.x)},${Math.round(f.y)}): ${JSON.stringify(f.content).substring(0, 50)}`).join('\n');
      
      const scrollX = containerRef.current?.scrollLeft || 0;
      const scrollY = containerRef.current?.scrollTop || 0;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an AI Canvas Assistant. The user wants to add blocks to their canvas.
Current canvas state:
${contextStr}

Current Viewport (top-left): (${scrollX}, ${scrollY})
Place new blocks near the viewport if no specific location is requested.

User request: "${prompt}"

Return ONLY a JSON array of blocks to create. Each block must have:
- type (string: 'doc', 'sheet', 'checklist', 'graph', 'code', 'ai_assistant')
- x (number)
- y (number)
- w (number, default 300)
- h (number, default 200)
- content (string or object depending on type)

Example: [{"type": "checklist", "x": 100, "y": 100, "w": 300, "h": 200, "content": [{"text": "Test 1", "checked": false}]}]`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const blocks = JSON.parse(response.text || '[]');
      
      blocks.forEach((b: any) => {
        addFrame({
          type: b.type || 'doc',
          x: b.x || scrollX + Math.random() * 100 + 50,
          y: b.y || scrollY + Math.random() * 100 + 50,
          z: frames.length + 1,
          w: b.w || 300,
          h: b.h || 200,
          content: b.content || '',
          isGhost: true // Mark as ghost block
        });
      });
      
    } catch (err) {
      console.error(err);
      alert("AI Assistant failed to generate blocks.");
    } finally {
      setIsThinking(false);
    }
  };

  const startVoiceCommand = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleAIAssist(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-[var(--border)] bg-[var(--panel-bg)] flex-wrap gap-2">
        <div className="flex space-x-1 overflow-x-auto no-scrollbar">
          <button onClick={() => handleAddFrame('doc')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Text">
            <FileText size={16} />
          </button>
          <button onClick={() => handleAddFrame('sheet')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Sheet">
            <Grid size={16} />
          </button>
          <button onClick={() => handleAddFrame('checklist')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Checklist">
            <ListTodo size={16} />
          </button>
          <button onClick={() => handleAddFrame('graph')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Graph">
            <BarChart2 size={16} />
          </button>
          <button onClick={() => handleAddFrame('code')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Code">
            <Code size={16} />
          </button>
          <button onClick={() => handleAddFrame('ai_assistant')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" title="AI Assistant">
            <Brain size={16} />
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <button onClick={undo} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Undo">
            <Undo size={16} />
          </button>
          <button onClick={redo} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Redo">
            <Redo size={16} />
          </button>
          <div className="w-px h-4 bg-[var(--border)] mx-1"></div>
          <button 
            onClick={() => setIsPortraitLocked(!isPortraitLocked)} 
            className={`p-2 rounded-lg transition-colors ${isPortraitLocked ? 'bg-[var(--accent)] text-black' : 'hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-main)]'}`} 
            title={isPortraitLocked ? "Unlock Orientation" : "Lock Portrait"}
          >
            <Smartphone size={16} />
          </button>
        </div>
      </div>

      {/* Ghost Blocks Action Bar */}
      {hasGhosts && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-[var(--panel-bg)] border border-[var(--accent)] rounded-full px-4 py-2 flex items-center space-x-4 shadow-lg shadow-[var(--accent)]/20 animate-in slide-in-from-top-4">
          <span className="text-xs font-bold text-[var(--accent)]">AI Suggestions Ready</span>
          <button onClick={commitGhosts} className="flex items-center text-xs bg-[var(--accent)] text-black px-3 py-1 rounded-full font-bold hover:opacity-90">
            <Check size={14} className="mr-1" /> Accept
          </button>
          <button onClick={clearGhosts} className="flex items-center text-xs bg-red-500/20 text-red-500 px-3 py-1 rounded-full font-bold hover:bg-red-500/30">
            <X size={14} className="mr-1" /> Discard
          </button>
        </div>
      )}

      {/* AI Thinking Indicator */}
      {isThinking && (
        <div className="absolute top-14 right-4 z-50 bg-[var(--panel-bg)] border border-[var(--border)] rounded-full px-3 py-1.5 flex items-center space-x-2 shadow-lg">
          <Brain size={14} className="text-[var(--accent)] animate-pulse" />
          <span className="text-xs text-[var(--text-muted)]">AI is building...</span>
        </div>
      )}

      {/* Spatial Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-auto bg-[#0a0a0a]"
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      >
        <div 
          className="relative min-w-[3000px] min-h-[3000px]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #333 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }}
        >
          {frames.map(frame => (
            <div
              key={frame.id}
              className={`absolute border rounded-xl overflow-hidden shadow-2xl transition-all duration-200 ${
                frame.isGhost 
                  ? 'border-[var(--accent)] border-dashed opacity-80 shadow-[var(--accent)]/20' 
                  : draggingId === frame.id 
                    ? 'shadow-[var(--accent)]/20 border-[var(--accent)]/50 z-50' 
                    : 'border-[var(--border)] hover:border-[var(--accent)]/30'
              }`}
              style={{
                left: frame.x,
                top: frame.y,
                width: frame.w,
                height: frame.h,
                zIndex: draggingId === frame.id ? 999 : frame.z
              }}
            >
              {/* Frame Header */}
              <div 
                className={`flex items-center justify-between px-3 py-1.5 border-b cursor-move touch-none ${frame.isGhost ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30' : 'bg-[var(--panel-bg)] border-[var(--border)]'}`}
                onMouseDown={(e) => handlePointerDown(e, frame.id)}
                onTouchStart={(e) => handlePointerDown(e, frame.id)}
              >
              <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center ${frame.isGhost ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                {frame.type === 'doc' && <FileText size={12} className="mr-1.5" />}
                {frame.type === 'sheet' && <Grid size={12} className="mr-1.5" />}
                {frame.type === 'checklist' && <ListTodo size={12} className="mr-1.5" />}
                {frame.type === 'graph' && <BarChart2 size={12} className="mr-1.5" />}
                {frame.type === 'code' && <Code size={12} className="mr-1.5" />}
                {frame.type === 'ai_assistant' && <Brain size={12} className="mr-1.5" />}
                {frame.isGhost ? `Ghost: ${frame.type}` : frame.type}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteFrame(frame.id); }}
                className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
            
            {/* Frame Content */}
            <div className="h-[calc(100%-29px)] w-full bg-[var(--bg-color)] relative">
              {frame.isGhost && <div className="absolute inset-0 bg-[var(--accent)]/5 pointer-events-none z-10"></div>}
              {frame.type === 'doc' ? <DocFrame frame={frame} updateFrame={updateFrame} /> :
               frame.type === 'sheet' ? <SheetFrame frame={frame} updateFrame={updateFrame} /> :
               frame.type === 'checklist' ? <ChecklistFrame frame={frame} updateFrame={updateFrame} /> :
               frame.type === 'graph' ? <GraphFrame frame={frame} /> :
               frame.type === 'code' ? <CodeFrame frame={frame} updateFrame={updateFrame} /> :
               frame.type === 'ai_assistant' ? <AiAssistantFrame frame={frame} updateFrame={updateFrame} /> :
               frame.type === 'task' ? <TaskFrame frame={frame} updateFrame={updateFrame} /> :
               <GenericFrame frame={frame} />}
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* Floating Action Button for AI Voice Command */}
      <button 
        onClick={startVoiceCommand}
        className={`absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-black/50 transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-[var(--accent)] hover:scale-105'}`}
        title="Listen / Capture"
      >
        <Mic size={24} className={isListening ? 'text-white' : 'text-black'} />
      </button>
    </div>
  );
}

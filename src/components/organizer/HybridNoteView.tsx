import React, { useState, useEffect, useRef } from 'react';
import { useRadixSync, RadixFrame } from '../../lib/useRadixSync';
import { Plus, Maximize, Minimize, Trash2, Edit2, FileText, Grid, Image as ImageIcon, CheckSquare, ScanBarcode, LayoutTemplate } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Dummy components for now
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
  const data = typeof frame.content === 'object' ? frame.content : {};
  const items = data.items || [];
  
  return (
    <div className="w-full h-full bg-[var(--panel-bg)] p-2 overflow-auto">
      {data.type === 'inventory' ? (
        <div className="mb-2">
          <div className="text-xs font-bold text-[var(--accent)]">{data.name}</div>
          <div className="text-[10px] text-[var(--text-muted)]">{data.date} {data.time}</div>
        </div>
      ) : null}
      <table className="w-full text-left border-collapse">
        <thead>
          <tr>
            <th className="border border-[var(--border)] p-1 text-xs text-[var(--text-muted)]">Item</th>
            <th className="border border-[var(--border)] p-1 text-xs text-[var(--text-muted)]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? items.map((item: any, i: number) => (
            <tr key={i}>
              <td className="border border-[var(--border)] p-1 text-xs">{item.name}</td>
              <td className="border border-[var(--border)] p-1 text-xs">{item.amount}</td>
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

const ScannerFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 flex flex-col items-center justify-center text-[var(--text-muted)]">
    <ScanBarcode size={48} className="mb-2 opacity-50" />
    <span className="text-xs uppercase tracking-wider font-bold">Scanner Ready</span>
    <button className="mt-4 px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-xs font-bold uppercase tracking-wider">
      Start Scan
    </button>
  </div>
);

const CanvasFrame = ({ frame, updateFrame }: { frame: RadixFrame, updateFrame: any }) => (
  <div className="w-full h-full bg-[var(--panel-bg)] p-4 flex items-center justify-center">
    <span className="text-xs text-[var(--text-muted)]">Canvas Frame (Coming Soon)</span>
  </div>
);

export default function HybridNoteView() {
  const { frames, addFrame, updateFrame, deleteFrame } = useRadixSync();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAddFrame = (type: 'doc' | 'sheet' | 'canvas' | 'scanner' | 'task') => {
    addFrame({
      type,
      x: Math.random() * 200 + 50,
      y: Math.random() * 200 + 50,
      z: frames.length,
      w: 300,
      h: 200,
      content: ''
    });
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input' || 
        (e.target as HTMLElement).tagName.toLowerCase() === 'textarea' ||
        (e.target as HTMLElement).tagName.toLowerCase() === 'button') {
      return; // Don't drag if interacting with inputs
    }
    
    const frame = frames.find(f => f.id === id);
    if (!frame || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setDraggingId(id);
    setDragOffset({
      x: e.clientX - rect.left - frame.x,
      y: e.clientY - rect.top - frame.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    
    updateFrame(draggingId, { x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-[var(--border)] bg-[var(--panel-bg)]">
        <div className="flex space-x-2">
          <button onClick={() => handleAddFrame('doc')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Add Text Frame">
            <FileText size={18} />
          </button>
          <button onClick={() => handleAddFrame('sheet')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Add Sheet Frame">
            <Grid size={18} />
          </button>
          <button onClick={() => handleAddFrame('scanner')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Add Scanner Frame">
            <ScanBarcode size={18} />
          </button>
          <button onClick={() => handleAddFrame('canvas')} className="p-2 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors" title="Add Canvas Frame">
            <LayoutTemplate size={18} />
          </button>
        </div>
      </div>

      {/* Spatial Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-[#0a0a0a]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #333 1px, transparent 0)',
          backgroundSize: '20px 20px'
        }}
      >
        {frames.map(frame => (
          <div
            key={frame.id}
            className={`absolute border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl transition-shadow ${draggingId === frame.id ? 'shadow-[var(--accent)]/20 border-[var(--accent)]/50 z-50' : 'hover:border-[var(--accent)]/30'}`}
            style={{
              left: frame.x,
              top: frame.y,
              width: frame.w,
              height: frame.h,
              zIndex: draggingId === frame.id ? 999 : frame.z
            }}
            onMouseDown={(e) => handleMouseDown(e, frame.id)}
          >
            {/* Frame Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--panel-bg)] border-b border-[var(--border)] cursor-move">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                {frame.type === 'doc' && <FileText size={12} className="mr-1.5" />}
                {frame.type === 'sheet' && <Grid size={12} className="mr-1.5" />}
                {frame.type === 'scanner' && <ScanBarcode size={12} className="mr-1.5" />}
                {frame.type === 'task' && <CheckSquare size={12} className="mr-1.5" />}
                {frame.type}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteFrame(frame.id); }}
                className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
            
            {/* Frame Content */}
            <div className="h-[calc(100%-29px)] w-full bg-[var(--bg-color)]">
              {frame.type === 'doc' && <DocFrame frame={frame} updateFrame={updateFrame} />}
              {frame.type === 'sheet' && <SheetFrame frame={frame} updateFrame={updateFrame} />}
              {frame.type === 'scanner' && <ScannerFrame frame={frame} updateFrame={updateFrame} />}
              {frame.type === 'canvas' && <CanvasFrame frame={frame} updateFrame={updateFrame} />}
              {frame.type === 'task' && <TaskFrame frame={frame} updateFrame={updateFrame} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

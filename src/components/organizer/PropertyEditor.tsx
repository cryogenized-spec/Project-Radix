import React, { useState } from 'react';
import { Plus, X, Calendar, Type, List, Hash } from 'lucide-react';

interface PropertyEditorProps {
  properties: Record<string, any>;
  onChange: (newProperties: Record<string, any>) => void;
}

export default function PropertyEditor({ properties, onChange }: PropertyEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleUpdate = (key: string, value: any) => {
    onChange({ ...properties, [key]: value });
  };

  const handleDelete = (key: string) => {
    const newProps = { ...properties };
    delete newProps[key];
    onChange(newProps);
  };

  const handleAdd = () => {
    if (newKey && !properties[newKey]) {
      onChange({ ...properties, [newKey]: '' });
      setNewKey('');
      setIsAdding(false);
    }
  };

  if (Object.keys(properties).length === 0 && !isAdding) {
    return (
      <button 
        onClick={() => setIsAdding(true)}
        className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1 py-2 transition-colors uppercase tracking-wider"
      >
        <Plus size={12} /> Add Properties
      </button>
    );
  }

  return (
    <div className="mb-6 p-3 bg-[var(--bg-color)]/50 rounded-xl border border-[var(--border)] shadow-inner">
      <div className="flex flex-col gap-2">
        {Object.entries(properties).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 group">
            <div className="w-1/3 flex items-center gap-2 text-xs font-mono text-[var(--text-muted)] bg-[var(--panel-bg)] px-2 py-1 rounded border border-[var(--border)]">
              {typeof value === 'number' ? <Hash size={12} className="text-[var(--accent)]" /> : 
               typeof value === 'object' ? <List size={12} className="text-[var(--accent)]" /> : 
               <Type size={12} className="text-[var(--accent)]" />}
              <span className="truncate">{key}</span>
            </div>
            <input
              type="text"
              value={typeof value === 'object' ? JSON.stringify(value) : value}
              onChange={(e) => handleUpdate(key, e.target.value)}
              className="flex-1 bg-transparent border-b border-transparent focus:border-[var(--accent)] text-sm text-[var(--text-main)] outline-none transition-colors px-1 py-1"
              placeholder="Empty"
            />
            <button 
              onClick={() => handleDelete(key)}
              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-red-500 transition-all rounded hover:bg-red-500/10"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        
        {isAdding ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="w-1/3 bg-[var(--panel-bg)] border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-main)]"
              placeholder="Property name"
            />
            <button onClick={handleAdd} className="text-xs text-[var(--accent)] font-bold px-2 py-1 hover:bg-[var(--accent)]/10 rounded transition-colors">Add</button>
            <button onClick={() => setIsAdding(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] px-2 py-1 transition-colors">Cancel</button>
          </div>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1 mt-2 transition-colors uppercase tracking-wider"
          >
            <Plus size={12} /> Add Property
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Download, Check, AlertCircle, Loader2, Database, Trash2 } from 'lucide-react';
import { LibrarianAPI } from '../lib/LibrarianAPI';

export default function LibrarianConfig() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const handleStatus = (e: any) => {
      const data = e.detail;
      if (data.status === 'ready') {
        setIsReady(true);
        setIsInitializing(false);
        setStatus(null);
      } else if (data.status === 'progress' || data.status === 'downloading') {
        setStatus(data);
      }
    };

    window.addEventListener('librarian-status', handleStatus);
    return () => window.removeEventListener('librarian-status', handleStatus);
  }, []);

  const handleInitialize = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      await LibrarianAPI.initializeModels();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize models');
      setIsInitializing(false);
    }
  };

  const handleDispose = async () => {
    try {
      await LibrarianAPI.disposeModels();
      setIsReady(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-main)] flex items-center gap-2 leading-tight">
          <Database size={16} className="text-[var(--accent)] shrink-0" /> Librarian Phase (RAG)
        </h3>
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap border-green-500/30 text-green-500 bg-green-500/10">
          WebGPU Active
        </span>
      </div>
      
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Download Nomic text and vision models to enable local, multi-modal Retrieval-Augmented Generation.
      </p>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-500 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      <div className="p-4 rounded-xl border transition-all bg-[var(--panel-bg)] border-[var(--border)]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
              Nomic Embed Models
              {isReady && <Check size={14} className="text-green-500" />}
            </h4>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-1">nomic-ai/nomic-embed-text-v1.5 & vision-v1.5</p>
          </div>
        </div>
        
        {status && status.status === 'downloading' && (
          <div className="text-xs text-yellow-500 mb-2 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Downloading {status.file}...
          </div>
        )}
        
        {status && status.status === 'progress' && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
              <span className="truncate max-w-[200px]">{status.file}</span>
              <span>{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--border)]">
              <div 
                className="h-full bg-yellow-500 transition-all duration-300 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="text-xs font-medium flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : isInitializing ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`}></span>
            <span className={isReady ? 'text-green-500' : isInitializing ? 'text-yellow-500' : 'text-[var(--text-muted)]'}>
              {isReady ? 'Ready' : isInitializing ? 'Initializing...' : 'Available'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isReady ? (
              <button 
                onClick={handleDispose}
                className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition-colors bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-red-500 hover:text-red-500"
              >
                <Trash2 size={14} /> Dispose Models
              </button>
            ) : (
              <button
                onClick={handleInitialize}
                disabled={isInitializing}
                className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition-colors bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {isInitializing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                {isInitializing ? 'Loading...' : 'Download & Initialize'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

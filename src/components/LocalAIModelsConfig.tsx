import React, { useState, useEffect } from 'react';
import { Download, Check, AlertCircle, Loader2, Image as ImageIcon, Box, CheckCircle2, Trash2 } from 'lucide-react';
import { useLocalAI, LOCAL_AI_MODELS, SupportedModel } from '../hooks/useLocalAI';

export default function LocalAIModelsConfig() {
  const { loadModel, isDownloading, downloadProgress, error } = useLocalAI();
  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});

  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);

  useEffect(() => {
    checkCache();
    setHasWebGPU(!!navigator.gpu);
  }, []);

  const checkCache = async () => {
    try {
      const cacheName = 'local-ai-models-v1';
      const cache = await caches.open(cacheName);
      const newCachedModels: Record<string, boolean> = {};
      
      for (const model of LOCAL_AI_MODELS) {
        const response = await cache.match(model.url);
        newCachedModels[model.id] = !!response;
      }
      setCachedModels(newCachedModels);
    } catch (e) {
      console.error("Failed to check cache", e);
    }
  };

  const handleDownload = async (modelId: SupportedModel) => {
    try {
      await loadModel(modelId);
      await checkCache();
    } catch (e) {
      console.error("Failed to download model", e);
    }
  };

  const handleDelete = async (modelId: string) => {
    try {
      const cacheName = 'local-ai-models-v1';
      const cache = await caches.open(cacheName);
      const model = LOCAL_AI_MODELS.find(m => m.id === modelId);
      if (model) {
        await cache.delete(model.url);
        await checkCache();
      }
    } catch (e) {
      console.error("Failed to delete model", e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-main)] flex items-center gap-2 leading-tight">
          <ImageIcon size={16} className="text-[var(--accent)] shrink-0" /> Image Generation Models (LiteRT)
        </h3>
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${hasWebGPU ? 'border-green-500/30 text-green-500 bg-green-500/10' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'}`}>
          {hasWebGPU ? 'WebGPU Active' : 'WASM Fallback'}
        </span>
      </div>
      
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Download models to run image generation entirely offline in your browser using OPFS (Origin Private File System).
      </p>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-500 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      
      <div className="grid gap-3">
        {LOCAL_AI_MODELS.map(model => {
          const isCached = cachedModels[model.id];
          const status = isCached ? 'Offline Ready' : isDownloading ? 'Downloading' : 'Available';
          
          return (
            <div key={model.id} className="p-3 rounded-xl border transition-all bg-[var(--panel-bg)] border-[var(--border)] hover:border-[var(--text-muted)]">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                    {model.name}
                    {isCached && <CheckCircle2 size={14} className="text-green-500" />}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-1">{model.subtitle}</p>
                </div>
                <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-color)] px-2 py-1 rounded border border-[var(--border)]">
                  {model.size}
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isCached ? 'bg-green-500' : isDownloading ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`}></span>
                  <span className={isCached ? 'text-green-500' : isDownloading ? 'text-yellow-500' : 'text-[var(--text-muted)]'}>
                    {status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isDownloading ? (
                    <div className="flex items-center gap-3 w-32">
                      <div className="h-1.5 flex-1 bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--border)]">
                        <div 
                          className="h-full bg-yellow-500 transition-all duration-300 ease-out"
                          style={{ width: `${downloadProgress}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-yellow-500 w-8 text-right">{downloadProgress}%</span>
                    </div>
                  ) : isCached ? (
                    <>
                      <button 
                        onClick={() => handleDelete(model.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete Model"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        disabled
                        className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)]"
                      >
                        <Check size={14} /> Ready
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDownload(model.id)}
                      disabled={isDownloading}
                      className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition-colors bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <Download size={14} /> Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { LOCAL_MODELS, LocalModel, ModelService, ModelStatus } from '../lib/ModelService';
import { Download, HardDrive, Play, Trash2, CheckCircle2, Loader2, Cpu, X } from 'lucide-react';

interface ModelSelectorProps {
  onSelectModel: (modelId: string) => void;
  selectedModelId?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onSelectModel, selectedModelId }) => {
  const [statuses, setStatuses] = useState<Record<string, ModelStatus>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [progressText, setProgressText] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [hasWebGPU, setHasWebGPU] = useState<boolean | null>(null);
  const [abortControllers, setAbortControllers] = useState<Record<string, AbortController>>({});

  useEffect(() => {
    checkAllStatuses();
    setHasWebGPU(!!navigator.gpu);

    const handleDownloaded = (e: Event) => {
      const { modelId } = (e as CustomEvent).detail;
      setStatuses(prev => ({ ...prev, [modelId]: 'Offline Ready' }));
      setProgress(prev => ({ ...prev, [modelId]: 0 }));
      setAbortControllers(prev => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
    };

    const handleDeleted = (e: Event) => {
      const { modelId } = (e as CustomEvent).detail;
      setStatuses(prev => ({ ...prev, [modelId]: 'Available' }));
    };

    window.addEventListener('local-model-downloaded', handleDownloaded);
    window.addEventListener('local-model-deleted', handleDeleted);

    return () => {
      window.removeEventListener('local-model-downloaded', handleDownloaded);
      window.removeEventListener('local-model-deleted', handleDeleted);
    };
  }, []);

  const checkAllStatuses = async () => {
    setLoading(true);
    const newStatuses: Record<string, ModelStatus> = {};
    for (const model of LOCAL_MODELS) {
      newStatuses[model.id] = await ModelService.checkModelStatus(model.id);
    }
    setStatuses(newStatuses);
    setLoading(false);
  };

  const handleDownload = async (model: LocalModel) => {
    // Memory Guard
    if (model.id.includes('Llama-3.1-8B') || model.id.includes('Mistral-Nemo')) {
      const deviceMemory = (navigator as any).deviceMemory || 8;
      if (deviceMemory < 12) {
        if (!confirm(`Hardware Warning: Your device reports ${deviceMemory}GB RAM. The ${model.name} model requires at least 12GB RAM to run smoothly. Do you want to continue downloading?`)) {
          return;
        }
      }
    }

    setStatuses(prev => ({ ...prev, [model.id]: 'Downloading' }));
    setProgress(prev => ({ ...prev, [model.id]: 0 }));
    setProgressText(prev => ({ ...prev, [model.id]: 'Starting download...' }));
    
    const controller = new AbortController();
    setAbortControllers(prev => ({ ...prev, [model.id]: controller }));

    try {
      await ModelService.downloadModel(model, (p, speed) => {
        setProgress(prev => ({ ...prev, [model.id]: p }));
        if (speed > 0) {
          const speedMB = (speed / 1024 / 1024).toFixed(1);
          setProgressText(prev => ({ ...prev, [model.id]: `${speedMB} MB/s` }));
        } else {
          setProgressText(prev => ({ ...prev, [model.id]: 'Downloading...' }));
        }
      }, controller.signal);
    } catch (e: any) {
      console.error(e);
      setStatuses(prev => ({ ...prev, [model.id]: 'Available' }));
      setAbortControllers(prev => {
        const next = { ...prev };
        delete next[model.id];
        return next;
      });
      if (e.name !== 'AbortError') {
        alert(e.message || 'Download failed. Ensure your browser supports OPFS and you have enough storage.');
      }
    }
  };

  const handleCancelDownload = (modelId: string) => {
    const controller = abortControllers[modelId];
    if (controller) {
      controller.abort();
      setStatuses(prev => ({ ...prev, [modelId]: 'Available' }));
      setProgress(prev => ({ ...prev, [modelId]: 0 }));
      setAbortControllers(prev => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
    }
  };

  const handleDelete = async (modelId: string) => {
    if (confirm('Are you sure you want to delete this model from local storage?')) {
      await ModelService.deleteModel(modelId);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-[var(--text-muted)] flex items-center justify-center gap-2"><Loader2 className="animate-spin" size={16} /> Checking local models...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-main)] flex items-center gap-2 leading-tight">
          <HardDrive size={16} className="text-[var(--accent)] shrink-0" /> Local Intelligence
        </h3>
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap ${hasWebGPU ? 'border-green-500/30 text-green-500 bg-green-500/10' : 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'}`}>
          {hasWebGPU ? 'WebGPU Active' : 'WASM Fallback'}
        </span>
      </div>
      
      <p className="text-xs text-[var(--text-muted)] mb-4">
        Download small LLMs to run entirely offline in your browser using OPFS (Origin Private File System).
      </p>

      <div className="grid gap-3">
        {LOCAL_MODELS.map(model => {
          const status = statuses[model.id] || 'Available';
          const isSelected = selectedModelId === model.id;
          const isDownloading = status === 'Downloading';
          const isReady = status === 'Offline Ready';
          const currentProgress = progress[model.id] || 0;

          return (
            <div 
              key={model.id} 
              className={`p-3 rounded-xl border transition-all ${isSelected ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--panel-bg)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                    {model.name}
                    {isReady && <CheckCircle2 size={14} className="text-green-500" />}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-1">{model.description}</p>
                </div>
                <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-color)] px-2 py-1 rounded border border-[var(--border)]">
                  {(model.sizeBytes / 1024 / 1024 / 1024).toFixed(1)} GB
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-500' : isDownloading ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`}></span>
                  <span className={isReady ? 'text-green-500' : isDownloading ? 'text-yellow-500' : 'text-[var(--text-muted)]'}>
                    {status}
                  </span>
                  {!isReady && !isDownloading && model.isGated && (
                    <a 
                      href={`https://huggingface.co/${model.description}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-[var(--accent)] hover:underline opacity-80"
                    >
                      (Requires EULA)
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isDownloading ? (
                    <div className="flex flex-col items-end gap-1 w-64">
                      <div className="text-[10px] text-[var(--text-muted)] truncate w-full text-right">
                        {model.name} | {progressText[model.id] || 'Downloading...'} | {currentProgress}%
                      </div>
                      <div className="flex items-center gap-2 w-full">
                        <div className="h-1.5 flex-1 bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--border)]">
                          <div 
                            className="h-full bg-yellow-500 transition-all duration-300 ease-out"
                            style={{ width: `${currentProgress}%` }}
                          />
                        </div>
                        <button 
                          onClick={() => handleCancelDownload(model.id)}
                          className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                          title="Cancel Download"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : isReady ? (
                    <>
                      <button 
                        onClick={() => handleDelete(model.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Delete Model"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button 
                        onClick={() => onSelectModel(model.id)}
                        className={`text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition-colors ${isSelected ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                      >
                        <Cpu size={14} /> {isSelected ? 'Selected' : 'Select Model'}
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleDownload(model)}
                      className="text-xs px-3 py-1.5 bg-[var(--bg-color)] border border-[var(--border)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center gap-1.5"
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
};

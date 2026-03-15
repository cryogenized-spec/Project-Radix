import React, { useState, useEffect } from 'react';
import { HardDrive, Settings, Image as ImageIcon, Video, Folder, ShieldAlert, RefreshCw, Download, CheckCircle2 } from 'lucide-react';
import { getSetting, setSetting, getStorageStats, evictOldMedia } from '../lib/db';

export default function StorageRouting() {
  const [capacity, setCapacity] = useState<number>(500); // MB
  const [imageQuality, setImageQuality] = useState<'avif' | 'original'>('avif');
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p' | 'original'>('720p');
  const [autoEvict, setAutoEvict] = useState<boolean>(true);
  const [vaultPath, setVaultPath] = useState<string>('');
  
  const [stats, setStats] = useState({ used: 0, total: 500 });
  const [isPersisted, setIsPersisted] = useState(false);

  const RESERVED_MB = 25;

  useEffect(() => {
    loadSettings();
    checkStorage();
    checkPersisted();
  }, []);

  const loadSettings = async () => {
    const cap = await getSetting('vaultCapacity');
    if (cap) setCapacity(parseInt(cap, 10));
    
    const imgQ = await getSetting('imageQuality');
    if (imgQ) setImageQuality(imgQ as any);
    
    const vidQ = await getSetting('videoQuality');
    if (vidQ) setVideoQuality(vidQ as any);
    
    const ae = await getSetting('autoEvict');
    if (ae !== undefined) setAutoEvict(ae === 'true');
    
    const vp = await getSetting('vaultPath');
    if (vp) setVaultPath(vp);
  };

  const checkStorage = async () => {
    const s = await getStorageStats();
    // getStorageStats returns bytes. Convert to MB.
    setStats({
      used: s.usage / (1024 * 1024),
      total: capacity
    });
  };

  const checkPersisted = async () => {
    if (navigator.storage && navigator.storage.persisted) {
      const persisted = await navigator.storage.persisted();
      setIsPersisted(persisted);
    }
  };

  const handleCapacityChange = async (val: number) => {
    setCapacity(val);
    await setSetting('vaultCapacity', val.toString());
    setStats(prev => ({ ...prev, total: val }));
    
    if (navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persist();
      setIsPersisted(persisted);
    }
  };

  const handleImageQualityChange = async (val: 'avif' | 'original') => {
    setImageQuality(val);
    await setSetting('imageQuality', val);
  };

  const handleVideoQualityChange = async (val: '720p' | '1080p' | 'original') => {
    setVideoQuality(val);
    await setSetting('videoQuality', val);
  };

  const handleAutoEvictChange = async (val: boolean) => {
    setAutoEvict(val);
    await setSetting('autoEvict', val.toString());
  };

  const handleMountDirectory = async () => {
    const isIframe = window.self !== window.top;
    
    const triggerFallback = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = async (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
          const path = e.target.files[0].webkitRelativePath.split('/')[0] || 'Mounted_Folder';
          setVaultPath(`/local/${path}`);
          await setSetting('vaultPath', `/local/${path}`);
        }
      };
      input.click();
    };

    try {
      if (!isIframe && 'showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const path = dirHandle.name;
        setVaultPath(`/local/${path}`);
        await setSetting('vaultPath', `/local/${path}`);
      } else {
        triggerFallback();
      }
    } catch (err) {
      console.error('Failed to mount directory:', err);
      triggerFallback();
    }
  };

  const handleManualEvict = async () => {
    try {
      await evictOldMedia(capacity * 1024 * 1024, true);
      await checkStorage();
      alert('LRU Eviction completed successfully.');
    } catch (err) {
      console.error('Eviction failed:', err);
      alert('Eviction failed. Check console for details.');
    }
  };

  // Calculations for progress bar
  const totalMB = capacity;
  const usedMB = stats.used;
  const bufferMB = totalMB * 0.15;
  const mediaPoolMB = totalMB - RESERVED_MB - bufferMB;
  
  const usedPercent = Math.min(100, (usedMB / totalMB) * 100);
  const reservedPercent = (RESERVED_MB / totalMB) * 100;
  const bufferPercent = 15;

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-color)] overflow-y-auto">
      <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full space-y-8">
        
        <div className="flex items-center space-x-3 mb-2">
          <HardDrive className="text-[var(--accent)]" size={28} />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Storage & Routing</h1>
        </div>

        {/* 1. SITREP Header */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center">
            <ShieldAlert size={16} className="mr-2" />
            SITREP: System Health
          </h2>
          
          <div className="mb-2 flex justify-between text-sm font-medium">
            <span>Used: {usedMB.toFixed(1)} MB / {totalMB} MB</span>
            <span className="text-[var(--text-muted)]">{isPersisted ? 'Persistent' : 'Volatile'}</span>
          </div>
          
          <div className="h-6 w-full bg-[var(--bg-color)] rounded-full overflow-hidden flex relative border border-[var(--border)]">
            {/* Reserved Segment */}
            <div 
              className="h-full bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden whitespace-nowrap"
              style={{ width: `${reservedPercent}%` }}
              title="Reserved (System/Text) - 25MB"
            >
              SYS
            </div>
            
            {/* Used Segment (excluding reserved) */}
            <div 
              className="h-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${Math.max(0, usedPercent - reservedPercent)}%` }}
            />
            
            {/* Buffer / Eviction Zone */}
            <div 
              className="h-full absolute right-0 top-0 bottom-0 border-l-2 border-dashed border-red-500/50 bg-red-500/10 flex items-center justify-center text-[10px] font-bold text-red-500/80"
              style={{ width: `${bufferPercent}%` }}
              title="Eviction Zone (15%)"
            >
              BUFFER
            </div>
          </div>
          <div className="mt-3 flex justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center"><div className="w-3 h-3 bg-gray-600 rounded-sm mr-2"></div> Reserved (25MB)</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-[var(--accent)] rounded-sm mr-2"></div> Media Pool</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-red-500/20 border border-dashed border-red-500/50 rounded-sm mr-2"></div> Eviction Zone (15%)</div>
          </div>
        </section>

        {/* 2. Vault Capacity */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center">
            <Folder size={16} className="mr-2" />
            Vault Capacity
          </h2>
          
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {[500, 1024, 2048, 5120].map(val => (
              <button
                key={val}
                onClick={() => handleCapacityChange(val)}
                className={`py-3 rounded-xl font-bold text-sm sm:text-base border transition-all ${
                  capacity === val 
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-md' 
                    : 'bg-[var(--bg-color)] text-[var(--text-main)] border-[var(--border)] hover:border-[var(--text-muted)]'
                }`}
              >
                {val >= 1024 ? `${val / 1024}GB` : `${val}MB`}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)] leading-relaxed">
            Increasing this limit utilizes the Persistent Storage API to protect data from OS-level cache sweeps. 
            The app will autonomously manage the Media Pool to prevent hitting the ceiling.
          </p>
        </section>

        {/* 3. Transcoding Pipeline */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center">
            <Settings size={16} className="mr-2" />
            Transcoding Pipeline
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Image Pipeline */}
            <div className="space-y-3">
              <label className="text-xs font-bold flex items-center">
                <ImageIcon size={14} className="mr-2 text-[var(--accent)]" /> Image Pipeline
              </label>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => handleImageQualityChange('avif')}
                  className={`p-3 rounded-xl border text-left transition-all ${imageQuality === 'avif' ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                >
                  <div className="font-bold text-sm">AVIF (High Compression)</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Recommended. ~80% size reduction, strips EXIF.</div>
                </button>
                <button
                  onClick={() => handleImageQualityChange('original')}
                  className={`p-3 rounded-xl border text-left transition-all ${imageQuality === 'original' ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                >
                  <div className="font-bold text-sm">Original (Lossless)</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Retains exact pixel data and metadata.</div>
                </button>
              </div>
            </div>

            {/* Video Pipeline */}
            <div className="space-y-3">
              <label className="text-xs font-bold flex items-center">
                <Video size={14} className="mr-2 text-[var(--accent)]" /> Video Pipeline
              </label>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => handleVideoQualityChange('720p')}
                  className={`p-3 rounded-xl border text-left transition-all ${videoQuality === '720p' ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                >
                  <div className="font-bold text-sm">720p (AV1 Standard)</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Recommended for efficient P2P transit.</div>
                </button>
                <button
                  onClick={() => handleVideoQualityChange('1080p')}
                  className={`p-3 rounded-xl border text-left transition-all ${videoQuality === '1080p' ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                >
                  <div className="font-bold text-sm">1080p (AV1 High)</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">For high-fidelity needs.</div>
                </button>
                <button
                  onClick={() => handleVideoQualityChange('original')}
                  className={`p-3 rounded-xl border text-left transition-all ${videoQuality === 'original' ? 'bg-[var(--accent)]/10 border-[var(--accent)]' : 'bg-[var(--bg-color)] border-[var(--border)] hover:border-[var(--text-muted)]'}`}
                >
                  <div className="font-bold text-sm">Original (Pass-through)</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Maximum payload. Uncompressed archival.</div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Sovereign Archival */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4 flex items-center">
            <Download size={16} className="mr-2" />
            Sovereign Archival
          </h2>
          
          <button 
            onClick={handleMountDirectory}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center justify-center shadow-md"
          >
            <Folder size={18} className="mr-2" />
            Mount External Directory
          </button>
          
          {vaultPath && (
            <div className="mt-4 p-3 bg-black/50 border border-[var(--border)] rounded-xl font-mono text-xs text-green-400 flex items-center">
              <CheckCircle2 size={14} className="mr-2 flex-shrink-0" />
              <span className="truncate">{vaultPath}</span>
            </div>
          )}
          
          <p className="mt-3 text-xs text-[var(--text-muted)] leading-relaxed">
            Bypass the browser's hidden sandbox. Return absolute ownership of files to your root file system. 
            Mounting a directory here also grants the AI Agent (with the File Systems Access pin) permission to read and analyze your local files.
          </p>
        </section>

        {/* 5. Eviction Protocol */}
        <section className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-main)] flex items-center">
                <RefreshCw size={16} className="mr-2 text-[var(--accent)]" />
                Eviction Protocol
              </h2>
              <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed max-w-xl">
                Automatically purges media from the app's internal rolling buffer once it has been successfully downloaded to your device's permanent storage.
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={autoEvict}
                onChange={(e) => handleAutoEvictChange(e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>
          
          <div className="mt-6 pt-4 border-t border-[var(--border)] flex justify-end">
            <button 
              onClick={handleManualEvict}
              className="px-4 py-2 rounded-lg border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors text-xs font-bold uppercase tracking-wider"
            >
              Force LRU Eviction Now
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}

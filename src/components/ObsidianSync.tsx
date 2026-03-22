import React, { useState } from 'react';
import { FolderSync, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { LibrarianAPI, VectorNode } from '../lib/LibrarianAPI';
import { v4 as uuidv4 } from 'uuid';

export default function ObsidianSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, synced: 0 });

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      setError(null);
      setSyncStatus('Selecting folder...');

      // Request directory access
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read',
      });

      setSyncStatus('Scanning for .md files...');
      const mdFiles: any[] = [];

      // Recursively scan directory
      async function scanDirectory(dir: any, path: string = '') {
        for await (const entry of dir.values()) {
          if (entry.kind === 'file' && entry.name.endsWith('.md')) {
            mdFiles.push({ handle: entry, path: `${path}/${entry.name}` });
          } else if (entry.kind === 'directory') {
            // Skip hidden folders like .obsidian
            if (!entry.name.startsWith('.')) {
              await scanDirectory(entry, `${path}/${entry.name}`);
            }
          }
        }
      }

      await scanDirectory(dirHandle);
      
      setStats({ total: mdFiles.length, synced: 0 });
      setSyncStatus(`Found ${mdFiles.length} files. Initializing Librarian...`);

      // Ensure models are loaded
      await LibrarianAPI.initializeModels();

      setSyncStatus('Embedding files...');
      
      for (let i = 0; i < mdFiles.length; i++) {
        const file = mdFiles[i];
        const fileData = await file.handle.getFile();
        const text = await fileData.text();
        
        // Skip empty files
        if (!text.trim()) {
          setStats(prev => ({ ...prev, synced: prev.synced + 1 }));
          continue;
        }

        // Generate embedding
        const embedding = await LibrarianAPI.embedText(text);

        // Create VectorNode
        const node: VectorNode = {
          id: file.path, // Use path as ID to overwrite on re-sync
          type: 'text',
          content: text,
          metadata: {
            filename: file.handle.name,
            path: file.path,
            lastModified: fileData.lastModified,
            source: 'obsidian'
          },
          embedding,
          timestamp: Date.now()
        };

        // Store in AI Vault
        await LibrarianAPI.storeNode(node);
        
        setStats(prev => ({ ...prev, synced: prev.synced + 1 }));
      }

      setSyncStatus('Sync complete!');
      setTimeout(() => setSyncStatus(null), 3000);

    } catch (err: any) {
      console.error(err);
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to sync folder');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="p-4 rounded-xl border transition-all bg-[var(--panel-bg)] border-[var(--border)]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
            Obsidian Two-Way Sync
          </h4>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Sync your local .md files into the AI Vault for Agentic Retrieval.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-500 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isSyncing && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
            <span>{syncStatus}</span>
            {stats.total > 0 && <span>{stats.synced} / {stats.total}</span>}
          </div>
          {stats.total > 0 && (
            <div className="h-1.5 w-full bg-[var(--bg-color)] rounded-full overflow-hidden border border-[var(--border)]">
              <div 
                className="h-full bg-[var(--accent)] transition-all duration-300 ease-out"
                style={{ width: `${(stats.synced / stats.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="text-xs font-medium flex items-center gap-1.5">
          {syncStatus === 'Sync complete!' && <CheckCircle2 size={14} className="text-green-500" />}
          <span className="text-[var(--text-muted)]">
            {syncStatus === 'Sync complete!' ? 'Up to date' : ''}
          </span>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="text-xs px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition-colors bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
        >
          {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <FolderSync size={14} />} 
          {isSyncing ? 'Syncing...' : 'Select Folder & Sync'}
        </button>
      </div>
    </div>
  );
}

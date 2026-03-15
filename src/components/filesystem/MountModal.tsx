import React, { useState } from 'react';
import { X, AlertTriangle, HardDrive, Lock } from 'lucide-react';
import { fsManager } from '../../lib/filesystem';

interface MountModalProps {
  onClose: () => void;
  onMount: () => void;
}

export default function MountModal({ onClose, onMount }: MountModalProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isMounting, setIsMounting] = useState(false);

  const handleMount = async () => {
    if (input !== 'I am the Root of this Machine') {
      setError('Incorrect passphrase. Access denied.');
      return;
    }

    setIsMounting(true);
    try {
      const success = await fsManager.mount();
      if (success) {
        onMount();
        onClose();
      } else {
        setError('Mount failed or cancelled.');
      }
    } catch (e) {
      setError('An error occurred during mounting.');
    } finally {
      setIsMounting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-red-950/20 border border-red-500/50 rounded-2xl p-6 space-y-6 animate-in zoom-in-95 relative overflow-hidden">
        {/* Danger Stripes */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-transparent to-red-500 opacity-50"></div>
        
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3 text-red-500">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold uppercase tracking-widest">Danger Zone</h2>
          </div>
          <button onClick={onClose} className="text-red-500/50 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4 text-red-200/80 text-sm">
          <p>
            You are about to mount a local file system partition. This grants the AI agents read access to your files.
          </p>
          <div className="p-4 bg-black/50 rounded-xl border border-red-500/20 flex items-center space-x-3">
            <HardDrive size={20} className="text-red-500" />
            <span className="font-mono text-xs">/dev/disk/mount_point</span>
          </div>
          <p className="font-bold text-red-500">
            To proceed, type the root passphrase:
          </p>
        </div>

        <div className="space-y-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="I am the Root of this Machine"
            className="w-full bg-black/50 border border-red-500/30 rounded-xl p-3 text-red-500 placeholder-red-500/20 font-mono text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
          />
          {error && <div className="text-xs text-red-500 font-bold animate-pulse">{error}</div>}
        </div>

        <button 
          onClick={handleMount}
          disabled={isMounting || !input}
          className="w-full p-4 rounded-xl bg-red-600 hover:bg-red-500 text-black font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isMounting ? (
            <span>Mounting...</span>
          ) : (
            <>
              <Lock size={16} />
              <span>Authenticate & Mount</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

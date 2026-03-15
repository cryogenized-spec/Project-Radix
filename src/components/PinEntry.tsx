import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Key } from 'lucide-react';
import { initCrypto, isCryptoInitialized } from '../lib/crypto';

export default function PinEntry({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    setLoading(true);
    try {
      await initCrypto(pin);
      onUnlock();
    } catch (e) {
      setError('Failed to derive key');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)] animate-pulse">
            <Lock size={32} />
          </div>
        </div>
        
        <h2 className="text-xl font-bold tracking-widest uppercase text-[var(--text-main)]">
          Security Vault
        </h2>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
          Enter your PIN to decrypt local storage.
        </p>

        <div className="space-y-4">
          <input 
            type="password" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center text-2xl tracking-[0.5em] font-mono bg-transparent border-b-2 border-[var(--border)] focus:border-[var(--accent)] outline-none py-2 text-[var(--accent)]"
            placeholder="••••"
            maxLength={8}
            autoFocus
          />
          
          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button 
            onClick={handleUnlock}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? 'Decrypting...' : <><Unlock size={16} className="mr-2" /> Unlock Vault</>}
          </button>
        </div>
        
        <p className="text-[10px] text-[var(--text-muted)] mt-8">
          XChaCha20-Poly1305 Encryption
        </p>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Copy, Check, QrCode, Upload, Info, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { getSetting, setSetting } from '../lib/db';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { CodeScanner } from './CodeScanner';

export default function AddContact() {
  const [identity, setIdentity] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [customQrUrl, setCustomQrUrl] = useState('');
  const [showQrInfo, setShowQrInfo] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [qrError, setQrError] = useState('');
  const [qrSuccess, setQrSuccess] = useState('');
  
  useEffect(() => {
    loadIdentity();
  }, []);

  useEffect(() => {
    if (identity) {
      loadCustomQr();
      generateQRCode(JSON.stringify(identity.publicKey));
    }
  }, [identity]);

  const loadIdentity = async () => {
    const id = await getSetting('identity');
    setIdentity(id);
  };

  const loadCustomQr = async () => {
    const custom = await getSetting('customQr');
    if (custom) setCustomQrUrl(custom);
  };

  const generateQRCode = async (text: string) => {
    try {
      const url = await QRCode.toDataURL(text, {
        color: {
          dark: '#00FF00', // Accent color (greenish)
          light: '#00000000' // Transparent background
        },
        margin: 1
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = () => {
    if (identity) {
      navigator.clipboard.writeText(JSON.stringify(identity.publicKey));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCustomQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrError('');
    setQrSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          // Validate
          const currentKey = JSON.stringify(identity.publicKey);
          if (code.data === currentKey) {
            const resultUrl = event.target?.result as string;
            setCustomQrUrl(resultUrl);
            setSetting('customQr', resultUrl);
            setQrSuccess('Custom QR Code verified and activated.');
            setTimeout(() => setQrSuccess(''), 5000);
          } else {
            setQrError('Validation Failed: The uploaded QR code does not match your identity. It must contain your exact Public Key.');
          }
        } else {
            setQrError('Decoding Failed: Could not detect a valid QR code. Please ensure the image is clear and has high contrast.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleResetQr = async () => {
    await setSetting('customQr', null);
    setCustomQrUrl('');
    setQrSuccess('Reverted to default system QR code.');
    setTimeout(() => setQrSuccess(''), 3000);
  };

  const handleAdd = async () => {
    if (!inviteCode.trim()) return;
    try {
      // Check if it's a P2P ID (alphanumeric) or a JSON key
      let contactId = inviteCode.trim();
      let publicKey = null;
      
      try {
          const parsed = JSON.parse(inviteCode.trim());
          if (parsed.publicKey) {
              // It's a legacy identity object
              publicKey = parsed.publicKey;
              contactId = parsed.id || crypto.randomUUID(); // Fallback
          } else {
              // Maybe it's just the key?
              publicKey = parsed;
              contactId = crypto.randomUUID();
          }
      } catch (e) {
          // Not JSON, assume it's a P2P ID
      }

      const contacts = await getSetting('contacts') || [];
      
      // Check if already exists
      if (contacts.find((c: any) => c.id === contactId)) {
          alert("Contact already exists!");
          return;
      }

      contacts.push({ 
          id: contactId, 
          publicKey: publicKey, 
          name: `Contact ${contactId.substring(0, 6)}...`,
          createdAt: Date.now()
      });
      
      await setSetting('contacts', contacts);
      setAdded(true);
      setInviteCode('');
      setTimeout(() => setAdded(false), 2000);
    } catch (e) {
      alert("Invalid invite code format.");
    }
  };

  const handleScan = (result: string) => {
    setInviteCode(result);
    setIsScanning(false);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 relative">
      {isScanning && (
        <CodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 sm:pb-4 pl-12 sm:pl-0">
        <h1 className="text-lg sm:text-xl font-bold tracking-widest uppercase text-[var(--accent)] flex items-center">
          <UserPlus className="mr-2" size={20} />
          Add Contact
        </h1>
      </div>

      {/* User ID Display */}
      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">
            Your Permanent ID
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <input 
            readOnly
            value={identity ? JSON.stringify(identity.publicKey) : 'Generating...'}
            className="w-full radix-input p-3 text-[10px] sm:text-xs font-mono rounded-xl bg-[var(--bg-color)] text-[var(--text-main)] overflow-hidden text-ellipsis whitespace-nowrap"
          />
          <button 
            onClick={handleCopy}
            className="p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shrink-0"
            title="Copy ID"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <p className="text-[9px] text-[var(--text-muted)]">Share this ID with others so they can add you to their contacts.</p>
      </section>

      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">
            Share & Scan
          </h2>
        </div>
        
        {showQrInfo && (
          <div className="p-3 sm:p-4 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl text-[10px] sm:text-xs text-[var(--text-muted)] animate-in fade-in slide-in-from-top-2 space-y-2">
            <p className="font-bold text-[var(--accent)] uppercase tracking-wider">QR Code Specifications</p>
            <p>You can replace the default generated QR code with a custom design from a third-party service.</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Data Payload:</strong> Must contain your exact Public Key JSON string.</li>
              <li><strong>Format:</strong> PNG, JPG, or WebP image.</li>
              <li><strong>Readability:</strong> Ensure high contrast.</li>
              <li><strong>Validation:</strong> The system will scan your upload.</li>
            </ul>
          </div>
        )}

        {qrError && (
          <div className="p-2 sm:p-3 bg-red-500/10 border border-red-500 rounded-xl text-[10px] sm:text-xs text-red-500 font-bold flex items-center animate-in slide-in-from-top-2">
            <X size={12} className="mr-2 sm:w-3.5 sm:h-3.5" /> {qrError}
          </div>
        )}

        {qrSuccess && (
          <div className="p-2 sm:p-3 bg-green-500/10 border border-green-500 rounded-xl text-[10px] sm:text-xs text-green-500 font-bold flex items-center animate-in slide-in-from-top-2">
            <Check size={12} className="mr-2 sm:w-3.5 sm:h-3.5" /> {qrSuccess}
          </div>
        )}

        <div className="flex flex-col space-y-4">
          {/* QR Code Display */}
          <div className="relative group bg-white p-4 rounded-xl flex items-center justify-center border border-[var(--border)] overflow-hidden h-48 sm:h-64 mx-auto w-full max-w-sm">
              {customQrUrl ? (
                 <img src={customQrUrl || null} alt="Custom QR Code" className="w-full h-full object-contain" />
              ) : qrCodeUrl ? (
                <img src={qrCodeUrl || null} alt="Your QR Code" className="w-full h-full object-contain" />
              ) : (
                <div className="animate-pulse w-full h-full bg-gray-200 rounded-lg"></div>
              )}
              
              {/* Overlay Actions */}
              <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-2 sm:space-y-3 p-2 sm:p-4">
                <button onClick={handleCopy} className="flex items-center space-x-1.5 sm:space-x-2 text-white text-[9px] sm:text-xs font-bold uppercase hover:text-[var(--accent)]">
                  {copied ? <Check size={12} className="sm:w-3.5 sm:h-3.5" /> : <Copy size={12} className="sm:w-3.5 sm:h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy ID'}</span>
                </button>
                
                {customQrUrl && (
                  <button onClick={handleResetQr} className="flex items-center space-x-1.5 sm:space-x-2 text-red-400 text-[9px] sm:text-xs font-bold uppercase hover:text-red-300">
                    <RefreshCw size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>
          </div>

          {/* Action Buttons Tray */}
          <div className="flex items-stretch space-x-3">
              <label className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] cursor-pointer hover:bg-[var(--accent)]/20 transition-all text-center">
                <Upload size={16} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Upload Custom QR</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleCustomQrUpload} />
              </label>

              <button 
                onClick={() => setIsScanning(true)}
                className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all text-center"
              >
                <QrCode size={16} />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Scan QR Code</span>
              </button>
          </div>

          {/* Info Link */}
          <button 
            onClick={() => setShowQrInfo(!showQrInfo)} 
            className="flex items-center space-x-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors w-fit"
          >
            <Info size={14} />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Upload Specifications</span>
          </button>
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">
          Manual Entry
        </h2>
        <textarea 
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Paste invite code here..."
          className="w-full radix-input p-3 sm:p-4 text-[10px] sm:text-xs font-mono rounded-xl h-24 sm:h-32 resize-none"
        />
        <button 
          onClick={handleAdd}
          className="w-full radix-button py-2.5 sm:py-3 rounded-xl flex items-center justify-center space-x-2 uppercase tracking-wider text-xs sm:text-sm font-bold"
        >
          {added ? <Check size={16} className="sm:w-[18px] sm:h-[18px]" /> : <UserPlus size={16} className="sm:w-[18px] sm:h-[18px]" />}
          <span>{added ? 'Contact Added' : 'Add Contact'}</span>
        </button>
      </section>
    </div>
  );
}

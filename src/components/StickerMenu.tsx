import React, { useState, useEffect } from 'react';
import { X, Plus, Image as ImageIcon, Loader2, Check, RefreshCw, FolderPlus, Wand2 } from 'lucide-react';
import { stickerDb, Sticker, StickerPack } from '../lib/stickerDb';
import { StickerService } from '../services/StickerService';

interface StickerMenuProps {
  onClose: () => void;
  onSelectSticker: (sticker: Sticker) => void;
  aiSettings: any;
}

export const StickerMenu: React.FC<StickerMenuProps> = ({ onClose, onSelectSticker, aiSettings }) => {
  const [view, setView] = useState<'packs' | 'pack_detail' | 'create' | 'result'>('packs');
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  
  // Create state
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Cartoon');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  
  // Result state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalSticker, setFinalSticker] = useState<{ master: Blob, export: Blob } | null>(null);
  const [finalStickerUrl, setFinalStickerUrl] = useState<string | null>(null);
  
  // Save state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [saveTargetPackId, setSaveTargetPackId] = useState<string | null>(null);

  const STYLES = ['Cartoon', 'Anime', 'Manga', 'Chibi', 'Pixel Art', 'Watercolor', '3D Render', 'Pop Art', 'Line Art', 'Minimalist'];

  useEffect(() => {
    loadPacks();
  }, []);

  const loadPacks = async () => {
    const allPacks = await stickerDb.stickerPacks.orderBy('createdAt').reverse().toArray();
    setPacks(allPacks);
  };

  const loadStickersForPack = async (packId: string) => {
    const packStickers = await stickerDb.stickers.where('packId').equals(packId).reverse().toArray();
    setStickers(packStickers);
  };

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const apiKey = aiSettings.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        alert('Gemini API key is not configured. Please set it in Settings.');
        return;
      }
      const images = await StickerService.generateStickerImages(prompt, style, apiKey, 4);
      setGeneratedImages(images);
      setView('result');
    } catch (e) {
      console.error(e);
      alert('Failed to generate images. Ensure Gemini API key is set.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProcessImage = async (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setIsProcessing(true);
    try {
      // Convert base64 to blob
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      
      const transparentBlob = await StickerService.removeBackground(blob);
      const { masterBlob, exportBlob } = await StickerService.addOutlineAndExport(transparentBlob);
      
      setFinalSticker({ master: masterBlob, export: exportBlob });
      setFinalStickerUrl(URL.createObjectURL(exportBlob));
      setShowSaveDialog(true);
    } catch (e) {
      console.error(e);
      alert('Failed to process sticker.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveSticker = async () => {
    if (!finalSticker) return;
    
    let packId = saveTargetPackId;
    
    if (!packId) {
      if (!newPackName) {
        alert('Please enter a pack name or select an existing pack.');
        return;
      }
      packId = crypto.randomUUID();
      await stickerDb.stickerPacks.add({
        id: packId,
        name: newPackName,
        createdAt: Date.now()
      });
    }

    const stickerId = crypto.randomUUID();
    const newSticker: Sticker = {
      id: stickerId,
      name: prompt.substring(0, 20),
      prompt: prompt,
      masterBlob: finalSticker.master,
      exportBlob: finalSticker.export,
      packId: packId,
      createdAt: Date.now()
    };

    await stickerDb.stickers.add(newSticker);
    
    // Update pack cover if it's the first sticker
    const pack = await stickerDb.stickerPacks.get(packId);
    if (pack && !pack.coverStickerId) {
      await stickerDb.stickerPacks.update(packId, { coverStickerId: stickerId });
    }

    // Reset and go back to packs
    setFinalSticker(null);
    setFinalStickerUrl(null);
    setShowSaveDialog(false);
    setPrompt('');
    setGeneratedImages([]);
    await loadPacks();
    setView('packs');
  };

  const renderPacks = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
        <h2 className="font-bold text-lg uppercase tracking-wider">Stickers</h2>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <button 
          onClick={() => setView('create')}
          className="w-full mb-6 p-4 border border-dashed border-[var(--accent)] rounded-xl flex items-center justify-center space-x-2 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg-color)] transition-colors"
        >
          <Plus size={20} />
          <span className="font-bold uppercase tracking-wider">Create New Sticker</span>
        </button>

        <div className="grid grid-cols-3 gap-4">
          {packs.map(pack => (
            <button 
              key={pack.id} 
              onClick={() => {
                setSelectedPack(pack);
                loadStickersForPack(pack.id);
                setView('pack_detail');
              }}
              className="flex flex-col items-center space-y-2 group"
            >
              <div className="w-full aspect-square bg-[var(--bg-color)] border border-[var(--border)] rounded-xl flex items-center justify-center group-hover:border-[var(--accent)] transition-colors overflow-hidden">
                {pack.coverStickerId ? (
                  <StickerThumbnail stickerId={pack.coverStickerId} />
                ) : (
                  <ImageIcon size={24} className="text-[var(--text-muted)]" />
                )}
              </div>
              <span className="text-xs font-bold text-center truncate w-full">{pack.name}</span>
            </button>
          ))}
        </div>
        {packs.length === 0 && (
          <div className="text-center text-[var(--text-muted)] text-sm mt-8">
            No sticker packs yet. Create one!
          </div>
        )}
      </div>
    </div>
  );

  const renderPackDetail = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] flex items-center space-x-4">
        <button onClick={() => setView('packs')} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          <X size={20} />
        </button>
        <h2 className="font-bold text-lg uppercase tracking-wider truncate">{selectedPack?.name}</h2>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto grid grid-cols-4 gap-4">
        {stickers.map(sticker => (
          <button 
            key={sticker.id}
            onClick={() => {
              onSelectSticker(sticker);
              onClose();
            }}
            className="aspect-square bg-[var(--bg-color)] border border-[var(--border)] rounded-xl flex items-center justify-center hover:border-[var(--accent)] transition-colors overflow-hidden p-2"
          >
            <img src={URL.createObjectURL(sticker.exportBlob)} alt={sticker.name} className="w-full h-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
        <h2 className="font-bold text-lg uppercase tracking-wider">Create Sticker</h2>
        <button onClick={() => setView('packs')} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Sticker Idea</label>
          <textarea 
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="A cute cybernetic cat drinking boba..."
            className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--accent)] resize-none h-24"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Style</label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map(s => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${style === s ? 'bg-[var(--accent)] text-[var(--bg-color)] border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={!prompt || isGenerating}
          className="w-full p-4 bg-[var(--accent)] text-[var(--bg-color)] rounded-xl font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Wand2 size={20} />
              <span>Generate Ideas</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
        <h2 className="font-bold text-lg uppercase tracking-wider">Select Image</h2>
        <button onClick={() => setView('create')} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        {isProcessing ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <Loader2 size={40} className="animate-spin text-[var(--accent)]" />
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">
              Processing Sticker...<br/>Removing background & adding outline
            </p>
          </div>
        ) : showSaveDialog ? (
          <div className="space-y-6">
            <div className="aspect-square bg-[var(--bg-color)] rounded-xl border border-[var(--border)] p-4 flex items-center justify-center checkerboard-bg">
              {finalStickerUrl && <img src={finalStickerUrl} alt="Final Sticker" className="w-full h-full object-contain drop-shadow-2xl" />}
            </div>
            
            <div className="space-y-4">
              <h3 className="font-bold uppercase tracking-wider text-sm">Save Sticker</h3>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Add to Existing Pack</label>
                <select 
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--accent)]"
                  value={saveTargetPackId || ''}
                  onChange={e => setSaveTargetPackId(e.target.value || null)}
                >
                  <option value="">-- Select Pack --</option>
                  {packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {!saveTargetPackId && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Or Create New Pack</label>
                  <input 
                    type="text"
                    value={newPackName}
                    onChange={e => setNewPackName(e.target.value)}
                    placeholder="My Awesome Pack"
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}

              <div className="flex space-x-2 pt-4">
                <button 
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 p-3 border border-[var(--border)] rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-[var(--bg-color)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSticker}
                  className="flex-1 p-3 bg-[var(--accent)] text-[var(--bg-color)] rounded-xl font-bold uppercase tracking-wider text-xs"
                >
                  Save Sticker
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((img, i) => (
              <button 
                key={i}
                onClick={() => {
                  if (window.confirm('Convert this image to a sticker?')) {
                    handleProcessImage(img);
                  }
                }}
                className="aspect-square bg-[var(--bg-color)] border border-[var(--border)] rounded-xl overflow-hidden hover:border-[var(--accent)] transition-colors relative group"
              >
                <img src={img} alt={`Generated ${i}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white font-bold uppercase tracking-wider text-xs border border-white px-3 py-1 rounded-full">Select</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-[var(--panel-bg)] z-50 flex flex-col">
      {view === 'packs' && renderPacks()}
      {view === 'pack_detail' && renderPackDetail()}
      {view === 'create' && renderCreate()}
      {view === 'result' && renderResult()}
      
      <style>{`
        .checkerboard-bg {
          background-image: 
            linear-gradient(45deg, #ccc 25%, transparent 25%), 
            linear-gradient(-45deg, #ccc 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #ccc 75%), 
            linear-gradient(-45deg, transparent 75%, #ccc 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        :root.dark .checkerboard-bg {
          background-image: 
            linear-gradient(45deg, #333 25%, transparent 25%), 
            linear-gradient(-45deg, #333 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #333 75%), 
            linear-gradient(-45deg, transparent 75%, #333 75%);
        }
      `}</style>
    </div>
  );
};

// Helper component to load and display a sticker blob
const StickerThumbnail: React.FC<{ stickerId: string }> = ({ stickerId }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    stickerDb.stickers.get(stickerId).then(sticker => {
      if (sticker) {
        setUrl(URL.createObjectURL(sticker.exportBlob));
      }
    });
  }, [stickerId]);

  if (!url) return <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />;
  
  return <img src={url} alt="Sticker Cover" className="w-full h-full object-contain p-2" />;
};

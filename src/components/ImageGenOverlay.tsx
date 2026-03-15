import React, { useState } from 'react';
import { X, ImageIcon, Wand2, Loader2, AlertTriangle } from 'lucide-react';
import { generateHuggingFaceImage, HFImageGenParams } from '../lib/huggingface';
import { generateAIResponse } from '../lib/gemini';
import { getSetting } from '../lib/db';

const HF_MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell', desc: 'Fast / High Quality', isNsfw: false },
];

const ASPECT_RATIOS = [
  { label: '1:1 (Square)', width: 1024, height: 1024 },
  { label: '16:9 (Landscape)', width: 1024, height: 576 },
  { label: '9:16 (Portrait)', width: 576, height: 1024 },
  { label: '4:3 (Landscape)', width: 1024, height: 768 },
  { label: '3:4 (Portrait)', width: 768, height: 1024 },
];

interface ImageGenOverlayProps {
  initialPrompt?: string;
  onClose: () => void;
  onGenerate: (blob: Blob, prompt: string) => void;
}

export default function ImageGenOverlay({ initialPrompt = '', onClose, onGenerate }: ImageGenOverlayProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(HF_MODELS[0].id);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [numSteps, setNumSteps] = useState(25);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [improvingType, setImprovingType] = useState<'positive' | 'negative' | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Prompt cannot be empty.');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const params: HFImageGenParams = {
        model: selectedModel,
        inputs: prompt,
        parameters: {
          negative_prompt: negativePrompt || undefined,
          num_inference_steps: numSteps,
          guidance_scale: guidanceScale,
          width: aspectRatio.width,
          height: aspectRatio.height,
        }
      };

      const blob = await generateHuggingFaceImage(params);
      onGenerate(blob, prompt);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate image.');
    } finally {
      setIsGenerating(false);
    }
  };

  const improvePrompt = async (type: 'positive' | 'negative') => {
    setImprovingType(type);
    setError('');
    try {
      const aiSettings = await getSetting('ai_settings') || {};
      const keys = await getSetting('api_keys') || {};
      const currentPrompt = type === 'positive' ? prompt : negativePrompt;
      
      const instruction = type === 'positive' 
        ? `You are an expert AI image generation prompt engineer. Enhance the following prompt to be highly detailed, descriptive, and optimized for Stable Diffusion/Flux models. Return ONLY the enhanced prompt text, nothing else. Original prompt: "${currentPrompt || 'A beautiful landscape'}"`
        : `You are an expert AI image generation prompt engineer. Create a comprehensive negative prompt to avoid bad anatomy, low quality, artifacts, and unwanted elements based on this concept: "${prompt || 'general image'}". Return ONLY the negative prompt text, nothing else.`;

      const response = await generateAIResponse(
        instruction,
        'participant',
        [],
        { ...aiSettings, apiKey: keys['Google'], systemInstruction: '' }
      );

      if (type === 'positive') {
        setPrompt(response.trim());
      } else {
        setNegativePrompt(response.trim());
      }
    } catch (err: any) {
      setError('Failed to improve prompt: ' + err.message);
    } finally {
      setImprovingType(null);
    }
  };

  const wrapSelectionWithWeight = (type: 'positive' | 'negative') => {
    const textarea = document.getElementById(`textarea-${type}`) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = type === 'positive' ? prompt : negativePrompt;
    
    if (start === end) return; // Nothing selected
    
    const selectedText = currentText.substring(start, end);
    const newText = currentText.substring(0, start) + `(${selectedText}:1.2)` + currentText.substring(end);
    
    if (type === 'positive') {
      setPrompt(newText);
    } else {
      setNegativePrompt(newText);
    }
    
    // Restore focus and selection after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, end + 1); // Select the text inside the parentheses
    }, 0);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)] flex items-center">
            <ImageIcon className="mr-2" size={20} />
            Image Generation
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded-xl text-red-500 text-xs flex items-start space-x-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 flex-1">
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">Model</label>
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full radix-input p-3 text-sm rounded-xl appearance-none"
            >
              {HF_MODELS.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} - {m.desc} {m.isNsfw ? '(NSFW)' : '(SFW)'}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">Prompt</label>
              <div className="flex space-x-3">
                <button 
                  onClick={() => wrapSelectionWithWeight('positive')}
                  className="text-[10px] text-[var(--text-muted)] hover:text-white flex items-center space-x-1"
                  title="Select text and click to add weight (e.g., (word:1.2))"
                >
                  <span>( ) Weight</span>
                </button>
                <button 
                  onClick={() => improvePrompt('positive')}
                  disabled={improvingType !== null}
                  className="text-[10px] text-[var(--accent)] hover:underline flex items-center space-x-1 disabled:opacity-50"
                >
                  {improvingType === 'positive' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  <span>{improvingType === 'positive' ? 'Improving...' : 'Improve Prompt'}</span>
                </button>
              </div>
            </div>
            <textarea 
              id="textarea-positive"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full radix-input p-3 text-sm rounded-xl h-24 resize-none"
              placeholder="Describe the image you want to generate..."
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">Negative Prompt</label>
              <div className="flex space-x-3">
                <button 
                  onClick={() => wrapSelectionWithWeight('negative')}
                  className="text-[10px] text-[var(--text-muted)] hover:text-white flex items-center space-x-1"
                  title="Select text and click to add weight (e.g., (word:1.2))"
                >
                  <span>( ) Weight</span>
                </button>
                <button 
                  onClick={() => improvePrompt('negative')}
                  disabled={improvingType !== null}
                  className="text-[10px] text-[var(--accent)] hover:underline flex items-center space-x-1 disabled:opacity-50"
                >
                  {improvingType === 'negative' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  <span>{improvingType === 'negative' ? 'Filling...' : 'Fill Negative Prompt'}</span>
                </button>
              </div>
            </div>
            <textarea 
              id="textarea-negative"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="w-full radix-input p-3 text-sm rounded-xl h-16 resize-none"
              placeholder="Elements to avoid (e.g., ugly, blurry, bad anatomy)..."
            />
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">Aspect Ratio</label>
              <select 
                value={`${aspectRatio.width}x${aspectRatio.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  const ratio = ASPECT_RATIOS.find(r => r.width === w && r.height === h);
                  if (ratio) setAspectRatio(ratio);
                }}
                className="w-full radix-input p-3 text-sm rounded-xl appearance-none"
              >
                {ASPECT_RATIOS.map(r => (
                  <option key={`${r.width}x${r.height}`} value={`${r.width}x${r.height}`}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">
                <label>Steps</label>
                <span className="text-[var(--accent)]">{numSteps}</span>
              </div>
              <input 
                type="range" min="1" max="50" step="1" 
                value={numSteps} onChange={(e) => setNumSteps(parseInt(e.target.value))}
                className="w-full accent-[var(--accent)] h-2"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex justify-between text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold">
                <label>Guidance Scale (CFG)</label>
                <span className="text-[var(--accent)]">{guidanceScale.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="1" max="20" step="0.5" 
                value={guidanceScale} onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)] h-2"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full p-4 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center justify-center space-x-2 transition-all"
        >
          {isGenerating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <ImageIcon size={20} />
              <span>Generate Image</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

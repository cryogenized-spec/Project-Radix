import React, { useState, useEffect } from 'react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import Wheel from '@uiw/react-color-wheel';
import { extractFontFamily, extractFontUrl, injectGoogleFont } from '../lib/fonts';
import { Type, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface TypographySettingsProps {
  initialFont: string;
  initialFontUrl: string;
  initialFontColor: string;
  initialTextEffect?: string;
  onSave: (font: string, fontUrl: string, fontColor: string, textEffect: string) => void;
}

const NATIVE_FONTS = [
  { id: 'system-ui', name: 'System UI', value: 'system-ui, sans-serif' },
  { id: 'serif', name: 'Serif', value: 'Georgia, serif' },
  { id: 'monospace', name: 'Monospace', value: 'monospace' },
  { id: 'geist', name: 'Geist', value: '"Geist", sans-serif' },
  { id: 'geist-mono', name: 'Geist Mono', value: '"Geist Mono", monospace' },
];

export function TypographySettings({ initialFont, initialFontUrl, initialFontColor, initialTextEffect, onSave }: TypographySettingsProps) {
  const isNative = NATIVE_FONTS.some(f => f.value === initialFont);
  
  const [fontType, setFontType] = useState<'native' | 'custom'>(initialFontUrl ? 'custom' : (isNative ? 'native' : 'custom'));
  const [nativeFont, setNativeFont] = useState(isNative ? (NATIVE_FONTS.find(f => f.value === initialFont)?.id || 'system-ui') : 'system-ui');
  const [customFontInput, setCustomFontInput] = useState(initialFontUrl || '');
  const [customFontError, setCustomFontError] = useState('');
  const [fontColor, setFontColor] = useState(initialFontColor || '#e4e4e7');
  const [textEffect, setTextEffect] = useState(initialTextEffect || '');
  const [isEffectsExpanded, setIsEffectsExpanded] = useState(false);
  
  // Live preview state
  const [previewFontFamily, setPreviewFontFamily] = useState(initialFont);

  // Sync color wheel with hex input
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFontColor(val);
  };

  const handleColorWheelChange = (color: any) => {
    setFontColor(color.hex);
  };

  // Update preview when font settings change
  useEffect(() => {
    if (fontType === 'native') {
      const selected = NATIVE_FONTS.find(f => f.id === nativeFont);
      if (selected) {
        setPreviewFontFamily(selected.value);
        setCustomFontError('');
      }
    } else {
      if (!customFontInput.trim()) {
        setPreviewFontFamily('system-ui, sans-serif');
        setCustomFontError('');
        return;
      }
      
      const family = extractFontFamily(customFontInput);
      const url = extractFontUrl(customFontInput);
      
      if (family && url) {
        setCustomFontError('');
        setPreviewFontFamily(`"${family}", sans-serif`);
        injectGoogleFont(url, 'user-typography-preview');
      } else {
        setCustomFontError('Invalid Google Font URL or embed code');
        setPreviewFontFamily('system-ui, sans-serif');
      }
    }
  }, [fontType, nativeFont, customFontInput]);

  // Notify parent of changes
  useEffect(() => {
    let finalFont = previewFontFamily;
    let finalUrl = '';
    
    if (fontType === 'custom') {
      const family = extractFontFamily(customFontInput);
      const url = extractFontUrl(customFontInput);
      if (family && url && !customFontError) {
        finalFont = family;
        finalUrl = url;
      } else {
        // Fallback if invalid
        finalFont = 'system-ui, sans-serif';
        finalUrl = '';
      }
    } else {
      const selected = NATIVE_FONTS.find(f => f.id === nativeFont);
      if (selected) {
        finalFont = selected.value;
      }
    }
    
    onSave(finalFont, finalUrl, fontColor, textEffect);
  }, [previewFontFamily, fontColor, fontType, nativeFont, customFontInput, customFontError, textEffect]);

  const TEXT_EFFECTS = [
    { id: '', name: 'None', category: 'Basic' },
    { id: 'effect-soft-glow', name: 'Soft Glow', category: 'Atmospheric' },
    { id: 'effect-bold-emphasis', name: 'Bold Emphasis', category: 'Atmospheric' },
    { id: 'effect-backlit', name: 'Backlit', category: 'Atmospheric' },
    { id: 'effect-static-glitch', name: 'Static Glitch', category: 'Modern' },
    { id: 'effect-frosted-glass', name: 'Frosted Glass', category: 'Modern' },
    { id: 'effect-chromatic-aberration', name: 'Chromatic Aberration', category: 'Modern' },
    { id: 'effect-iridescent', name: 'Iridescent', category: 'Modern' },
    { id: 'effect-terminal', name: 'Terminal', category: 'Modern' },
    { id: 'effect-engraved', name: 'Engraved', category: 'Modern' },
    { id: 'effect-wavy-underline', name: 'Wavy Underline', category: 'Modern' },
    { id: 'effect-gold-foil', name: 'Gold Foil', category: 'Modern' },
    { id: 'effect-hollow-stroke', name: 'Hollow Stroke', category: 'Modern' },
    { id: 'effect-wide-tracking', name: 'Wide Tracking', category: 'Modern' },
    { id: 'effect-soft-bloom', name: 'Soft Bloom', category: 'Elegant' },
    { id: 'effect-pearlescent', name: 'Pearlescent', category: 'Elegant' },
    { id: 'effect-elevated', name: 'Elevated', category: 'Elegant' },
    { id: 'effect-silk-ribbon', name: 'Silk Ribbon', category: 'Elegant' },
    { id: 'effect-watercolor-bleed', name: 'Watercolor Bleed', category: 'Elegant' },
    { id: 'effect-frosted-lace', name: 'Frosted Lace', category: 'Elegant' },
    { id: 'effect-stardust', name: 'Stardust', category: 'Elegant' }
  ];

  return (
    <section className="space-y-4 radix-panel p-4 rounded-xl">
      <h2 className="text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
        <Type size={14} className="mr-2" />
        Typography & Color
      </h2>

      <div className="space-y-6">
        {/* Font Type Selection */}
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Font Source</label>
          <RadioGroup.Root 
            className="flex flex-col sm:flex-row gap-2 sm:gap-4" 
            value={fontType} 
            onValueChange={(val: 'native' | 'custom') => setFontType(val)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroup.Item 
                value="native" 
                id="r-native"
                className="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg-color)] hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)]"
              >
                <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2 after:h-2 after:rounded-full after:bg-white" />
              </RadioGroup.Item>
              <label className="text-sm cursor-pointer" htmlFor="r-native">Native Fonts</label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroup.Item 
                value="custom" 
                id="r-custom"
                className="w-4 h-4 rounded-full border border-[var(--border)] bg-[var(--bg-color)] hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)]"
              >
                <RadioGroup.Indicator className="flex items-center justify-center w-full h-full relative after:content-[''] after:block after:w-2 after:h-2 after:rounded-full after:bg-white" />
              </RadioGroup.Item>
              <label className="text-sm cursor-pointer" htmlFor="r-custom">Google Fonts</label>
            </div>
          </RadioGroup.Root>
        </div>

        {/* Native Fonts Selection */}
        {fontType === 'native' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Select Native Font</label>
            <RadioGroup.Root 
              className="grid grid-cols-1 sm:grid-cols-3 gap-2" 
              value={nativeFont} 
              onValueChange={setNativeFont}
            >
              {NATIVE_FONTS.map((font) => (
                <div key={font.id} className="relative">
                  <RadioGroup.Item 
                    value={font.id} 
                    id={`f-${font.id}`}
                    className="peer sr-only"
                  />
                  <label 
                    htmlFor={`f-${font.id}`}
                    className="flex flex-col p-3 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] cursor-pointer hover:border-[var(--text-muted)] peer-data-[state=checked]:border-[var(--accent)] peer-data-[state=checked]:text-[var(--accent)] transition-colors"
                    style={{ fontFamily: font.value }}
                  >
                    <span className="font-bold text-sm mb-1">{font.name}</span>
                    <span className="text-[10px] opacity-70 truncate">Aa Bb Cc</span>
                  </label>
                </div>
              ))}
            </RadioGroup.Root>
          </div>
        )}

        {/* Custom Google Font Input */}
        {fontType === 'custom' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Google Font URL or Embed Code</label>
            <input 
              type="text" 
              value={customFontInput}
              onChange={(e) => setCustomFontInput(e.target.value)}
              placeholder="https://fonts.googleapis.com/css2?family=..."
              className={`w-full bg-[var(--bg-color)] border border-[var(--border)] p-3 text-sm rounded-xl outline-none focus:border-[var(--accent)] ${customFontError ? 'border-red-500' : ''}`}
            />
            {customFontError && <p className="text-red-500 text-[10px]">{customFontError}</p>}
            <p className="text-[10px] text-[var(--text-muted)]">
              Paste the URL, &lt;link&gt; tag, or @import statement from Google Fonts.
            </p>
          </div>
        )}

        {/* Live Preview */}
        <div className="pt-4 pb-2 border-t border-[var(--border)]">
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-3">Live Preview</label>
          <div 
            className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-color)] flex items-center justify-center text-center overflow-hidden"
          >
            <p 
              style={{ 
                fontFamily: previewFontFamily,
                color: fontColor 
              }}
              className={`text-xs sm:text-[13px] transition-all whitespace-nowrap px-2 ${textEffect}`}
              data-text="The quick brown fox jumps over the lazy dog"
            >
              The quick brown fox jumps over the lazy dog
            </p>
          </div>
        </div>

        {/* Color Picker */}
        <div className="space-y-3 pt-4 border-t border-[var(--border)]">
          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Text Color</label>
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="shrink-0 bg-[var(--bg-color)] p-2 rounded-xl border border-[var(--border)] flex items-center space-x-4">
              <Wheel 
                color={fontColor}
                onChange={handleColorWheelChange}
                width={140}
                height={140}
              />
              {/* Color Magnifier / Lens */}
              <div className="flex flex-col items-center">
                <div 
                  className="w-16 h-16 rounded-full border-4 border-[var(--border)] shadow-lg relative overflow-hidden"
                  style={{ 
                    backgroundColor: fontColor,
                    backgroundImage: `
                      repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px),
                      repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.1) 3px, rgba(0,0,0,0.1) 4px)
                    `,
                    backgroundSize: '4px 4px'
                  }}
                >
                  {/* Crosshair Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <div className="w-full h-[1px] bg-black/50 absolute"></div>
                    <div className="w-[1px] h-full bg-black/50 absolute"></div>
                    <div className="w-full h-[1px] bg-white/50 absolute"></div>
                    <div className="w-[1px] h-full bg-white/50 absolute"></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 w-full space-y-2">
              <label className="text-[10px] text-[var(--text-muted)] block">Hex Code</label>
              <input 
                type="text" 
                value={fontColor}
                onChange={handleHexChange}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] p-3 rounded-xl text-sm font-mono uppercase outline-none focus:border-[var(--accent)]"
                placeholder="#RRGGBB"
              />
            </div>
          </div>
        </div>

        {/* Text Effects Selection */}
        <div className="pt-4 border-t border-[var(--border)]">
          <button 
            onClick={() => setIsEffectsExpanded(!isEffectsExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center space-x-2 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
              <Sparkles size={14} />
              <span className="text-[10px] uppercase tracking-wider font-bold">Text Effects</span>
            </div>
            <div className="text-[var(--text-muted)]">
              {isEffectsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>
          
          {isEffectsExpanded && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 animate-in fade-in slide-in-from-top-2">
              {TEXT_EFFECTS.map((effect) => (
                <button
                  key={effect.id}
                  onClick={() => setTextEffect(effect.id)}
                  className={`p-2 text-center border rounded-xl text-[10px] sm:text-xs transition-colors ${textEffect === effect.id ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'}`}
                >
                  {effect.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

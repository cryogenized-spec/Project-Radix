import React, { useState, useEffect } from 'react';
import Wheel from '@uiw/react-color-wheel';
import { extractFontFamily, extractFontUrl, injectGoogleFont } from '../lib/fonts';
import { Settings2, Type, Image as ImageIcon, Activity, Download, Check } from 'lucide-react';
import { loadIcon } from '@iconify/react';
import { cacheIcon, getCachedIcon } from '../lib/db';
import { RadixIcon } from './RadixIcon';

export interface LoadingStateConfig {
  enabled: boolean;
  text: string;
  fontUrl: string;
  fontFamily: string;
  textColor: string;
  iconIdentifier: string;
  iconColor: string;
  animationStyle: string;
  animationDirection: string;
}

interface AgentLoadingSettingsProps {
  config: LoadingStateConfig;
  onChange: (config: LoadingStateConfig) => void;
}

const ANIMATION_OPTIONS = [
  { id: 'turning', name: 'Turning (Z-Axis)', hasDirection: true },
  { id: 'rotating', name: 'Rotating (Y-Axis)', hasDirection: true },
  { id: 'pulsing', name: 'Pulsing (Scale)', hasDirection: false },
  { id: 'breathing', name: 'Breathing (Opacity)', hasDirection: false },
  { id: 'pendulum', name: 'Pendulum (Z-Axis Rocking)', hasDirection: true },
  { id: 'levitating', name: 'Levitating (Y-Axis Translate)', hasDirection: false },
  { id: 'flipping', name: 'Flipping (X-Axis)', hasDirection: true },
];

export function AgentLoadingSettings({ config, onChange }: AgentLoadingSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Local state for inputs
  const [text, setText] = useState(config.text || 'processing...');
  const [fontUrl, setFontUrl] = useState(config.fontUrl || '');
  const [textColor, setTextColor] = useState(config.textColor || '#ff5500');
  const [iconIdentifier, setIconIdentifier] = useState(config.iconIdentifier || 'autorenew');
  const [iconColor, setIconColor] = useState(config.iconColor || '#ff5500');
  const [animationStyle, setAnimationStyle] = useState(config.animationStyle || 'turning');
  const [animationDirection, setAnimationDirection] = useState(config.animationDirection || 'cw');
  const [fontError, setFontError] = useState('');
  const [isCaching, setIsCaching] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Handle font sync
  const handleFontSync = () => {
    if (!fontUrl.trim()) {
      setFontError('');
      updateConfig({ fontUrl: '', fontFamily: 'inherit' });
      return;
    }
    const family = extractFontFamily(fontUrl);
    const url = extractFontUrl(fontUrl);
    if (family && url) {
      setFontError('');
      injectGoogleFont(url, 'agent-loading-font');
      updateConfig({ fontUrl: url, fontFamily: `"${family}", sans-serif` });
    } else {
      setFontError('Invalid Google Font URL or embed code');
    }
  };

  // Update config helper
  const updateConfig = (updates: Partial<LoadingStateConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Sync color wheel with hex input
  const handleTextColorHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextColor(val);
    updateConfig({ textColor: val });
  };

  const handleTextColorWheelChange = (color: any) => {
    setTextColor(color.hex);
    updateConfig({ textColor: color.hex });
  };

  const handleIconColorHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setIconColor(val);
    updateConfig({ iconColor: val });
  };

  const handleIconColorWheelChange = (color: any) => {
    setIconColor(color.hex);
    updateConfig({ iconColor: color.hex });
  };

  const handleCacheIcon = async () => {
    if (!iconIdentifier) return;
    
    setIsCaching(true);
    setCacheStatus('idle');
    
    try {
      // Fetch icon data using Iconify's loadIcon utility
      const iconData = await loadIcon(iconIdentifier);
      
      if (iconData) {
        // Cache it in IndexedDB (this clears old cache automatically per our db.ts logic)
        await cacheIcon(iconIdentifier, iconData);
        setCacheStatus('success');
        setTimeout(() => setCacheStatus('idle'), 2000);
      } else {
        setCacheStatus('error');
      }
    } catch (error) {
      console.error('Failed to cache icon:', error);
      setCacheStatus('error');
    } finally {
      setIsCaching(false);
    }
  };

  const selectedAnimation = ANIMATION_OPTIONS.find(a => a.id === animationStyle);
  const animationClass = `anim-${animationStyle}${selectedAnimation?.hasDirection ? `-${animationDirection}` : ''}`;

  return (
    <div className="space-y-4 pt-4 border-t border-[var(--border)]">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] flex items-center">
          <Settings2 size={14} className="mr-2" /> Agent Loading State
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {config.enabled ? 'Customized' : 'Use Default'}
          </span>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] text-[var(--accent)] hover:underline uppercase tracking-wider"
          >
            (tap to customize)
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2 mb-4">
            <input 
              type="checkbox" 
              id="enable-custom-loading"
              checked={config.enabled}
              onChange={(e) => updateConfig({ enabled: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-color)] text-[var(--accent)] focus:ring-[var(--accent)]"
            />
            <label htmlFor="enable-custom-loading" className="text-sm cursor-pointer">Enable Custom Loading State</label>
          </div>

          {config.enabled && (
            <>
              {/* Typography & Color Module */}
              <div className="space-y-4 p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-color)]/50">
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center mb-2">
                  <Type size={12} className="mr-1" /> Typography & Color
                </h4>
                
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Loading Text</label>
                  <input 
                    type="text" 
                    value={text}
                    onChange={(e) => { setText(e.target.value); updateConfig({ text: e.target.value }); }}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] p-2.5 text-sm rounded-xl outline-none focus:border-[var(--accent)]"
                    placeholder="e.g., processing..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Google Font URL</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      value={fontUrl}
                      onChange={(e) => setFontUrl(e.target.value)}
                      placeholder="https://fonts.googleapis.com/css2?family=..."
                      className={`w-full sm:flex-1 bg-[var(--bg-color)] border border-[var(--border)] p-2.5 text-sm rounded-xl outline-none focus:border-[var(--accent)] ${fontError ? 'border-red-500' : ''}`}
                    />
                    <button 
                      onClick={handleFontSync}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--accent)] text-black text-xs font-bold uppercase tracking-wider hover:opacity-90 whitespace-nowrap"
                    >
                      Sync
                    </button>
                  </div>
                  {fontError && <p className="text-red-500 text-[10px]">{fontError}</p>}
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Text Color</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="shrink-0 bg-[var(--bg-color)] p-2 rounded-xl border border-[var(--border)]">
                      <Wheel 
                        color={textColor}
                        onChange={handleTextColorWheelChange}
                        width={100}
                        height={100}
                      />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[10px] text-[var(--text-muted)] block">Hex Code</label>
                      <input 
                        type="text" 
                        value={textColor}
                        onChange={handleTextColorHexChange}
                        className="w-full bg-[var(--bg-color)] border border-[var(--border)] p-2.5 rounded-xl text-sm font-mono uppercase outline-none focus:border-[var(--accent)]"
                        placeholder="#RRGGBB"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Iconography Module */}
              <div className="space-y-4 p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-color)]/50">
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center mb-2">
                  <ImageIcon size={12} className="mr-1" /> Iconography
                </h4>
                
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Icon Identifier (Iconify)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="text" 
                      value={iconIdentifier}
                      onChange={(e) => { setIconIdentifier(e.target.value); updateConfig({ iconIdentifier: e.target.value }); }}
                      className="w-full sm:flex-1 bg-[var(--bg-color)] border border-[var(--border)] p-2.5 text-sm rounded-xl outline-none focus:border-[var(--accent)]"
                      placeholder="e.g., mdi:robot, noto:grinning-cat"
                    />
                    <button 
                      onClick={handleCacheIcon}
                      disabled={isCaching || !iconIdentifier}
                      className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-black text-xs font-bold uppercase tracking-wider whitespace-nowrap flex items-center justify-center gap-2 transition-all ${
                        cacheStatus === 'success' ? 'bg-green-500 hover:bg-green-600' : 
                        cacheStatus === 'error' ? 'bg-red-500 hover:bg-red-600' :
                        'bg-[var(--accent)] hover:opacity-90'
                      }`}
                    >
                      {isCaching ? (
                        'Caching...'
                      ) : cacheStatus === 'success' ? (
                        <>
                          <Check size={14} />
                          <span>Cached</span>
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          <span>Cache Icon</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Enter any icon name from <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">Iconify</a>. 
                    Cache it to ensure it works offline.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block">Icon Color</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="shrink-0 bg-[var(--bg-color)] p-2 rounded-xl border border-[var(--border)]">
                      <Wheel 
                        color={iconColor}
                        onChange={handleIconColorWheelChange}
                        width={100}
                        height={100}
                      />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[10px] text-[var(--text-muted)] block">Hex Code</label>
                      <input 
                        type="text" 
                        value={iconColor}
                        onChange={handleIconColorHexChange}
                        className="w-full bg-[var(--bg-color)] border border-[var(--border)] p-2.5 rounded-xl text-sm font-mono uppercase outline-none focus:border-[var(--accent)]"
                        placeholder="#RRGGBB"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Animation Module */}
              <div className="space-y-4 p-4 border border-[var(--border)] rounded-xl bg-[var(--bg-color)]/50">
                <h4 className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center mb-2">
                  <Activity size={12} className="mr-1" /> Hardware-Accelerated Animation
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Animation Style</label>
                    <select 
                      value={animationStyle}
                      onChange={(e) => { setAnimationStyle(e.target.value); updateConfig({ animationStyle: e.target.value }); }}
                      className="w-full bg-[var(--bg-color)] border border-[var(--border)] p-2.5 text-sm rounded-xl outline-none focus:border-[var(--accent)] appearance-none"
                    >
                      {ANIMATION_OPTIONS.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedAnimation?.hasDirection && (
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Direction</label>
                      <select 
                        value={animationDirection}
                        onChange={(e) => { setAnimationDirection(e.target.value); updateConfig({ animationDirection: e.target.value }); }}
                        className="w-full bg-[var(--bg-color)] border border-[var(--border)] p-2.5 text-sm rounded-xl outline-none focus:border-[var(--accent)] appearance-none"
                      >
                        <option value="cw">Forward / Clockwise / Right</option>
                        <option value="ccw">Backward / Counter-Clockwise / Left</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Preview */}
              <div className="pt-4">
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-2">Live Preview</label>
                <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] flex items-center justify-center">
                  <div className="flex items-center space-x-3">
                    <span className={animationClass} style={{ display: 'inline-block' }}>
                      <RadixIcon 
                        icon={iconIdentifier} 
                        style={{ color: iconColor }}
                        width={24}
                        height={24}
                      />
                    </span>
                    <span 
                      style={{ 
                        fontFamily: config.fontFamily || 'inherit',
                        color: textColor 
                      }}
                      className="text-sm tracking-wider"
                    >
                      {text}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

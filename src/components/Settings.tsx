import React, { useState, useEffect } from 'react';
import { Save, User, Palette, Type, Shield, Moon, Sun, Monitor, Smile, Image as ImageIcon, Globe, Download } from 'lucide-react';
import { getSetting, setSetting } from '../lib/db';
import { generateIdentity } from '../lib/crypto';
import { LANGUAGES, EXTRA_LANGUAGES } from '../lib/translation';
import { extractFontFamily, injectGoogleFont } from '../lib/fonts';
import { TypographySettings } from './TypographySettings';

const EMOTICON_PACKS = [
  'Native OS', 'Apple Style', 'JoyPixels', 'Twemoji', 'Noto Color Emoji'
];

export const THEMES: Record<string, { dark: any, light: any }> = {
  'INDUSTRIA': {
    dark: { bg: '#09090b', panel: '#18181b', accent: '#f97316', accentGradient: 'linear-gradient(135deg, #f97316, #ea580c)', border: '#27272a', text: '#e4e4e7', muted: '#a1a1aa' },
    light: { bg: '#f4f4f5', panel: '#ffffff', accent: '#ea580c', accentGradient: 'linear-gradient(135deg, #ea580c, #c2410c)', border: '#e4e4e7', text: '#18181b', muted: '#71717a' }
  },
  'NATURE': {
    dark: { bg: '#052e16', panel: '#064e3b', accent: '#4ade80', accentGradient: 'linear-gradient(135deg, #4ade80, #22c55e)', border: '#14532d', text: '#ecfccb', muted: '#84cc16' },
    light: { bg: '#f0fdf4', panel: '#ffffff', accent: '#16a34a', accentGradient: 'linear-gradient(135deg, #16a34a, #15803d)', border: '#bbf7d0', text: '#064e3b', muted: '#65a30d' }
  },
  'CANDY PINK': {
    dark: { bg: '#2e1065', panel: '#4c1d95', accent: '#f472b6', accentGradient: 'linear-gradient(135deg, #f472b6, #d946ef)', border: '#5b21b6', text: '#fae8ff', muted: '#d8b4fe' },
    light: { bg: '#fdf2f8', panel: '#ffffff', accent: '#db2777', accentGradient: 'linear-gradient(135deg, #db2777, #c026d3)', border: '#fbcfe8', text: '#831843', muted: '#be185d' }
  },
  'SUMMER': {
    dark: { bg: '#451a03', panel: '#78350f', accent: '#fbbf24', accentGradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', border: '#92400e', text: '#fef3c7', muted: '#d97706' },
    light: { bg: '#fffbeb', panel: '#ffffff', accent: '#d97706', accentGradient: 'linear-gradient(135deg, #d97706, #b45309)', border: '#fde68a', text: '#451a03', muted: '#b45309' }
  },
  'MOONLIT': {
    dark: { bg: '#020617', panel: '#0f172a', accent: '#38bdf8', accentGradient: 'linear-gradient(135deg, #38bdf8, #818cf8, #c084fc)', border: '#1e293b', text: '#f0f9ff', muted: '#94a3b8' },
    light: { bg: '#f0f9ff', panel: '#ffffff', accent: '#0284c7', accentGradient: 'linear-gradient(135deg, #0284c7, #4f46e5, #9333ea)', border: '#bae6fd', text: '#0c4a6e', muted: '#0369a1' }
  },
  'GRAPHENE': {
    dark: { bg: '#000000', panel: '#111111', accent: '#ffffff', accentGradient: 'linear-gradient(135deg, #ffffff, #a3a3a3)', border: '#333333', text: '#ffffff', muted: '#888888' },
    light: { bg: '#ffffff', panel: '#f4f4f5', accent: '#000000', accentGradient: 'linear-gradient(135deg, #000000, #525252)', border: '#e4e4e7', text: '#000000', muted: '#666666' }
  },
};

export default function Settings() {
  const [themePreset, setThemePreset] = useState('INDUSTRIA');
  const [colorMode, setColorMode] = useState<'dark' | 'light' | 'system'>('system');
  const [emoticonPack, setEmoticonPack] = useState('Native OS');
  const [longPressDuration, setLongPressDuration] = useState(250);
  const [textSize, setTextSize] = useState(14);
  const [wallpaper, setWallpaper] = useState('');
  const [identity, setIdentity] = useState<any>(null);
  const [sidebarMode, setSidebarMode] = useState<'fixed' | 'collapsible'>('fixed');
  const [font, setFont] = useState('JetBrains Mono');
  const [fontUrl, setFontUrl] = useState('');
  const [fontColor, setFontColor] = useState('#ff5500');
  const [textEffect, setTextEffect] = useState('');
  const [uiFont, setUiFont] = useState('"JetBrains Mono", monospace');
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [chatScale, setChatScale] = useState(1.0);
  const [taskListTileSize, setTaskListTileSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');
  
  const [downloadedLangs, setDownloadedLangs] = useState<Set<string>>(new Set(LANGUAGES.map(l => l.code)));
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownloadLang = async (code: string) => {
    setIsDownloading(code);
    // Simulate download
    await new Promise(resolve => setTimeout(resolve, 1500));
    setDownloadedLangs(prev => {
      const next = new Set(prev);
      next.add(code);
      return next;
    });
    setIsDownloading(null);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const cs = await getSetting('chatScale');
      if (cs !== undefined) setChatScale(cs);
      else setChatScale(1.0);
      
      const tt = await getSetting('taskListTileSize');
      if (tt) setTaskListTileSize(tt);
      
      const tp = await getSetting('themePreset');
      if (tp) setThemePreset(tp);
  
      const cm = await getSetting('colorMode');
      if (cm) setColorMode(cm);
  
      const ep = await getSetting('emoticonPack');
      if (ep) setEmoticonPack(ep);
  
      const lpd = await getSetting('longPressDuration');
      if (lpd) setLongPressDuration(lpd);
  
      const ts = await getSetting('textSize');
      if (ts) setTextSize(ts);
  
      const wp = await getSetting('wallpaper');
      if (wp) setWallpaper(wp);
  
      const sm = await getSetting('sidebarMode');
      if (sm) setSidebarMode(sm);
  
      const f = await getSetting('font');
      if (f) {
        setFont(f);
        document.documentElement.style.setProperty('--font-chat', f);
      }
  
      const fu = await getSetting('fontUrl');
      if (fu) {
        setFontUrl(fu);
        injectGoogleFont(fu, 'user-chat-font');
      } else {
        const existingLink = document.getElementById('user-chat-font');
        if (existingLink) existingLink.remove();
      }
  
      const fc = await getSetting('fontColor');
      if (fc) setFontColor(fc);
  
      const te = await getSetting('textEffect');
      if (te) setTextEffect(te);
  
      const uf = await getSetting('uiFont');
      if (uf) {
        setUiFont(uf);
        document.documentElement.style.setProperty('--font-main', uf);
      }
  
      const id = await getSetting('identity');
      if (id) {
        setIdentity(id);
      } else {
        const newId = await generateIdentity();
        await setSetting('identity', newId);
        setIdentity(newId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (preset: string, mode: 'dark' | 'light' | 'system') => {
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const t = THEMES[preset][isDark ? 'dark' : 'light'];
    
    const root = document.documentElement;
    root.style.setProperty('--bg-color', t.bg);
    root.style.setProperty('--panel-bg', t.panel);
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--border', t.border);
    root.style.setProperty('--text-main', t.text);
    root.style.setProperty('--text-muted', t.muted);
  };

  const handleThemeChange = (preset: string) => {
    setThemePreset(preset);
    applyTheme(preset, colorMode);
  };

  const handleColorModeChange = (mode: 'dark' | 'light' | 'system') => {
    setColorMode(mode);
    applyTheme(themePreset, mode);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'wallpaper') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (type === 'wallpaper') {
        setWallpaper(event.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    await setSetting('themePreset', themePreset);
    await setSetting('colorMode', colorMode);
    await setSetting('emoticonPack', emoticonPack);
    await setSetting('longPressDuration', longPressDuration);
    await setSetting('textSize', textSize);
    await setSetting('taskListTileSize', taskListTileSize);
    await setSetting('wallpaper', wallpaper);
    await setSetting('sidebarMode', sidebarMode);
    await setSetting('font', font);
    await setSetting('fontUrl', fontUrl);
    await setSetting('fontColor', fontColor);
    await setSetting('textEffect', textEffect);
    await setSetting('uiFont', uiFont);
    
    setSaved(true);
    window.dispatchEvent(new CustomEvent('settings:updated'));
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--border)] pb-3 sm:pb-4 pl-12 sm:pl-0 gap-2">
        <h1 className="text-lg sm:text-xl font-bold tracking-widest uppercase text-[var(--accent)] flex items-center flex-1 min-w-0">
          <Shield className="mr-2 shrink-0" size={20} />
          <span className="truncate">Settings</span>
        </h1>
        <button 
          onClick={handleSave}
          className="radix-button px-3 sm:px-4 py-1.5 sm:py-2 flex items-center space-x-2 text-[10px] sm:text-sm uppercase tracking-wider rounded-xl shrink-0"
        >
          <Save size={14} className="sm:w-4 sm:h-4" />
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Typography Engine */}
      <TypographySettings 
        initialFont={font}
        initialFontUrl={fontUrl}
        initialFontColor={fontColor}
        initialTextEffect={textEffect}
        onSave={(f, fu, fc, te) => {
          setFont(f);
          setFontUrl(fu);
          setFontColor(fc);
          setTextEffect(te);
          
          setSetting('font', f);
          setSetting('fontUrl', fu);
          setSetting('fontColor', fc);
          setSetting('textEffect', te);

          document.documentElement.style.setProperty('--font-chat', f);
          if (fu) {
            injectGoogleFont(fu, 'user-chat-font');
          } else {
            const existingLink = document.getElementById('user-chat-font');
            if (existingLink) existingLink.remove();
          }
        }}
      />

      {/* Theme Engine */}
      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
          <Palette size={14} className="mr-2 sm:w-4 sm:h-4" />
          Appearance
        </h2>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2 mt-4">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">App Wallpaper (9:16 Recommended)</label>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <label className="cursor-pointer w-28 h-44 sm:w-32 sm:h-52 border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center overflow-hidden hover:border-[var(--accent)] transition-colors relative group bg-[var(--bg-color)]">
                {wallpaper ? (
                  <img src={wallpaper} alt="Wallpaper" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={24} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] sm:w-8 sm:h-8" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'wallpaper')} />
              </label>
              <div className="flex flex-col space-y-1.5 sm:space-y-2">
                <button 
                  onClick={() => setWallpaper('')}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  Remove Wallpaper
                </button>
                <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] max-w-[160px] sm:max-w-[200px]">
                  Set a custom background image for the entire app.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Universal UI Font</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
              {[
                { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap' },
                { name: 'Inter', value: '"Inter", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
                { name: 'Roboto', value: '"Roboto", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap' },
                { name: 'System UI', value: 'system-ui, sans-serif', url: '' },
                { name: 'Serif', value: 'Georgia, serif', url: '' },
                { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap' },
                { name: 'Outfit', value: '"Outfit", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&display=swap' },
                { name: 'Playfair Display', value: '"Playfair Display", serif', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&display=swap' },
                { name: 'Fira Code', value: '"Fira Code", monospace', url: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&display=swap' },
                { name: 'Courier New', value: '"Courier New", monospace', url: '' },
                { name: 'Geist', value: '"Geist", sans-serif', url: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&display=swap' },
                { name: 'Geist Mono', value: '"Geist Mono", monospace', url: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;700&display=swap' }
              ].map((fontOption) => (
                <button
                  key={fontOption.name}
                  onClick={() => {
                    if (fontOption.url) {
                      injectGoogleFont(fontOption.url, 'user-ui-font');
                      setSetting('uiFontUrl', fontOption.url);
                    } else {
                      setSetting('uiFontUrl', '');
                      const existingLink = document.getElementById('user-ui-font');
                      if (existingLink) existingLink.remove();
                    }
                    document.documentElement.style.setProperty('--font-main', fontOption.value);
                    setUiFont(fontOption.value);
                    setSetting('uiFont', fontOption.value);
                  }}
                  className={`p-2 sm:p-3 text-center border rounded-xl text-[10px] sm:text-sm ${uiFont === fontOption.value ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'} transition-colors`}
                  style={{ fontFamily: fontOption.value }}
                >
                  {fontOption.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Color Mode</label>
            <div className="flex space-x-1.5 sm:space-x-2">
              <button onClick={() => handleColorModeChange('light')} className={`flex-1 p-2 sm:p-3 flex justify-center items-center space-x-1.5 sm:space-x-2 rounded-xl border text-[10px] sm:text-sm ${colorMode === 'light' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                <Sun size={14} className="sm:w-4 sm:h-4" /> <span>Light</span>
              </button>
              <button onClick={() => handleColorModeChange('dark')} className={`flex-1 p-2 sm:p-3 flex justify-center items-center space-x-1.5 sm:space-x-2 rounded-xl border text-[10px] sm:text-sm ${colorMode === 'dark' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                <Moon size={14} className="sm:w-4 sm:h-4" /> <span>Dark</span>
              </button>
              <button onClick={() => handleColorModeChange('system')} className={`flex-1 p-2 sm:p-3 flex justify-center items-center space-x-1.5 sm:space-x-2 rounded-xl border text-[10px] sm:text-sm ${colorMode === 'system' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>
                <Monitor size={14} className="sm:w-4 sm:h-4" /> <span>System</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Theme Preset</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2">
              {Object.keys(THEMES).map(preset => (
                <button
                  key={preset}
                  onClick={() => handleThemeChange(preset)}
                  className={`p-2 sm:p-3 text-center border rounded-xl text-[10px] sm:text-sm font-bold ${themePreset === preset ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'} transition-colors`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Sidebar Mode</label>
            <div className="flex space-x-1.5 sm:space-x-2">
              <button 
                onClick={() => setSidebarMode('fixed')}
                className={`flex-1 p-2 sm:p-3 rounded-xl border text-[10px] sm:text-sm ${sidebarMode === 'fixed' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
              >
                Fixed
              </button>
              <button 
                onClick={() => setSidebarMode('collapsible')}
                className={`flex-1 p-2 sm:p-3 rounded-xl border text-[10px] sm:text-sm ${sidebarMode === 'collapsible' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
              >
                Collapsible
              </button>
            </div>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Choose if the sidebar stays visible or can be collapsed.</p>
          </div>
        </div>
      </section>

      {/* Translation Settings */}
      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
          <Globe size={14} className="mr-2 sm:w-4 sm:h-4" />
          Translation
        </h2>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Installed Languages</label>
            <div className="flex flex-wrap gap-2">
              {Array.from(downloadedLangs).map(code => {
                const lang = [...LANGUAGES, ...EXTRA_LANGUAGES].find(l => l.code === code);
                return (
                  <div key={code} className="px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] sm:text-xs font-bold border border-[var(--accent)]/20">
                    {lang?.name}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Available for Download</label>
            <div className="grid grid-cols-2 gap-2">
              {EXTRA_LANGUAGES.filter(l => !downloadedLangs.has(l.code)).map(lang => (
                <div key={lang.code} className="flex items-center justify-between p-2 rounded-lg border border-[var(--border)]">
                  <span className="text-[10px] sm:text-xs font-medium">{lang.name}</span>
                  <button 
                    onClick={() => handleDownloadLang(lang.code)}
                    disabled={isDownloading === lang.code}
                    className="p-1.5 rounded-md bg-[var(--panel-bg)] hover:bg-[var(--bg-color)] text-[var(--text-main)] disabled:opacity-50"
                  >
                    {isDownloading === lang.code ? (
                      <div className="w-3 h-3 border-2 border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download size={12} />
                    )}
                  </button>
                </div>
              ))}
              {EXTRA_LANGUAGES.filter(l => !downloadedLangs.has(l.code)).length === 0 && (
                <div className="col-span-2 text-[10px] text-[var(--text-muted)] italic text-center py-2">
                  All available languages installed
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Typography Engine */}
      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
          <Type size={14} className="mr-2 sm:w-4 sm:h-4" />
          Emoticons & Display
        </h2>
        
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center">
              <Smile size={12} className="mr-1 sm:w-3.5 sm:h-3.5" /> Emoticon Pack
            </label>
            <select 
              value={emoticonPack}
              onChange={(e) => setEmoticonPack(e.target.value)}
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl appearance-none"
            >
              {EMOTICON_PACKS.map(pack => <option key={pack} value={pack}>{pack}</option>)}
            </select>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">This will reflect for you and the recipient.</p>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
              <span>Message Text Size</span>
              <span className="text-[var(--accent)] font-mono text-xs sm:text-sm">{textSize}px</span>
            </label>
            <input 
              type="range" 
              min="10" 
              max="20" 
              step="1" 
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
            />
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Adjust the font size of chat messages.</p>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
              <span>Chat View Scale</span>
              <span className="text-[var(--accent)] font-mono text-xs sm:text-sm">{chatScale.toFixed(1)}x</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              value={chatScale}
              onChange={(e) => {
                const val = Number(e.target.value);
                setChatScale(val);
                document.documentElement.style.setProperty('--chat-scale', val.toString());
                setSetting('chatScale', val);
              }}
              className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
            />
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Adjust the overall scale of the chat interface.</p>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
              <span>Message Long Press Duration</span>
              <span className="text-[var(--accent)] font-mono text-xs sm:text-sm">{longPressDuration}ms</span>
            </label>
            <input 
              type="range" 
              min="100" 
              max="1000" 
              step="50" 
              value={longPressDuration}
              onChange={(e) => setLongPressDuration(Number(e.target.value))}
              className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
            />
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Adjust how long you need to hold a message to select it.</p>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">List View Tile Size</label>
            <div className="flex space-x-1 sm:space-x-2">
              {['xs', 'sm', 'md', 'lg', 'xl'].map(size => (
                <button
                  key={size}
                  onClick={() => setTaskListTileSize(size as any)}
                  className={`flex-1 p-2 sm:p-3 rounded-xl border text-[10px] sm:text-sm uppercase font-bold ${taskListTileSize === size ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2 pt-3 sm:pt-4 border-t border-[var(--border)]">
            <button 
                onClick={async () => {
                    await setSetting('sidebar_toggle_pos', null);
                    await setSetting('new_chat_fab_pos', null);
                    window.location.reload();
                }}
                className="w-full p-3 rounded-xl border border-red-500/50 text-red-500 text-xs font-bold uppercase hover:bg-red-500/10 transition-colors"
            >
                Reset Button Positions
            </button>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Reset the position of floating buttons to default.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

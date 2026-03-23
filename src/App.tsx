import React, { useState, useEffect, useRef } from 'react';
import { Terminal, ChevronLeft, ChevronRight, Radio, Menu, MessageSquare, Bot, Calendar, Mail, UserPlus, Key, Server, Settings as SettingsIcon, Compass, FileText, Share2, Users, Pin } from 'lucide-react';
import { Icon } from '@iconify/react';
import Chat from './components/Chat';
import Settings, { THEMES } from './components/Settings';
import ApiLockbox from './components/ApiLockbox';
import AddContact from './components/AddContact';
import Profile from './components/Profile';
import AgentManager from './components/AgentManager';
import DraggableFab from './components/DraggableFab';
import Organizer from './components/Organizer';
import StorageWarning from './components/StorageWarning';
import EmailDispatch from './components/EmailDispatch';
import StorageRouting from './components/StorageRouting';
import Tools from './components/Tools';
import SharedImageHandler from './components/SharedImageHandler';
import { getSetting } from './lib/db';
import { injectGoogleFont } from './lib/fonts';
import { handleBack, registerBackHandler } from './lib/backButton';

export default function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'ai_chat' | 'add_contact' | 'api_lockbox' | 'settings' | 'profile' | 'agent_manager' | 'organizer' | 'email_dispatch' | 'storage_routing' | 'tools'>('chat');
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [hasPinnedSession, setHasPinnedSession] = useState(false);
  const [showSharedHandler, setShowSharedHandler] = useState(false);
  const [profile, setProfile] = useState<any>({ name: 'User', about: 'Available', avatar: '', aiAvatar: '' });
  const [isLoaded, setIsLoaded] = useState(false);
  const [wallpaper, setWallpaper] = useState('');
  const [sidebarMode, setSidebarMode] = useState<'fixed' | 'collapsible'>('fixed');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [editAgentId, setEditAgentId] = useState<string | undefined>(undefined);
  const [themePreset, setThemePreset] = useState('INDUSTRIA');
  const [colorMode, setColorMode] = useState<'dark' | 'light' | 'system'>('system');
  const [avatarShape, setAvatarShape] = useState<'circle' | 'square'>('circle');
  const [showExitToast, setShowExitToast] = useState(false);
  const [fabReset, setFabReset] = useState(0);
  const backPressCount = useRef(0);
  const backPressTimer = useRef<any>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Prevent system context menu globally
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    // Check for shared_id in URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get('shared_id');
    if (id) {
      setSharedId(id);
      setShowSharedHandler(true);
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }

    // Check for widget voice mode
    const mode = params.get('mode');
    if (mode === 'voice') {
      // Small delay to ensure components are mounted
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('organizer:open-ai-vtt'));
      }, 500);
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }

    // Listen for Service Worker messages (if app was already open)
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_VTT') {
        window.dispatchEvent(new CustomEvent('organizer:open-ai-vtt'));
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    const checkPinned = async () => {
      const session = await getSetting('pinned_shared_session');
      if (session && session.isPinned) {
        setHasPinnedSession(true);
      } else {
        setHasPinnedSession(false);
      }
    };
    checkPinned();

    // Initialize history state
    window.history.pushState({ root: true }, '');

    const onPopState = (e: PopStateEvent) => {
      const handled = handleBack();
      if (handled) {
        // A component handled the back action (e.g. closed a modal)
        window.history.pushState({ root: true }, '');
        backPressCount.current = 0;
      } else {
        // Nothing handled it, we are at the root level
        if (currentView !== 'chat') {
          // If not in chat view, go back to chat view
          setCurrentView('chat');
          window.history.pushState({ root: true }, '');
          backPressCount.current = 0;
        } else {
          // If in chat view (main screen), handle exit logic
          if (backPressCount.current === 0) {
            setShowExitToast(true);
            window.history.pushState({ root: true }, '');
            backPressCount.current++;
            backPressTimer.current = setTimeout(() => {
              backPressCount.current = 0;
              setShowExitToast(false);
            }, 2000);
          } else {
            // Allow exit
            clearTimeout(backPressTimer.current);
            window.history.back(); // Actually exit
          }
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [currentView]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setIsSidebarOpen(false);
        setSidebarMode('collapsible');
      } else {
        setIsSidebarOpen(true);
        setSidebarMode('fixed');
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Theme Application Effect
  useEffect(() => {
    const applyTheme = () => {
      const isDark = colorMode === 'dark' || (colorMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const t = THEMES[themePreset]?.[isDark ? 'dark' : 'light'] || THEMES['INDUSTRIA'].dark;
      
      const root = document.documentElement;
      root.style.setProperty('--bg-color', t.bg);
      root.style.setProperty('--panel-bg', t.panel);
      root.style.setProperty('--accent', t.accent);
      root.style.setProperty('--accent-gradient', t.accentGradient || t.accent);
      root.style.setProperty('--border', t.border);
      root.style.setProperty('--text-main', t.text);
      root.style.setProperty('--text-muted', t.muted);
    };

    applyTheme();

    if (colorMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [themePreset, colorMode]);

  useEffect(() => {
    const init = async () => {
      const p = await getSetting('workshop_profile');
      if (p) {
        setProfile(prev => ({ ...prev, ...p }));
        if (p.avatarShape) {
          setAvatarShape(p.avatarShape === 'portrait' ? 'square' : 'circle');
        }
      }
      
      const wp = await getSetting('wallpaper');
      if (wp) setWallpaper(wp);

      const sm = await getSetting('sidebarMode');
      if (sm) {
        setSidebarMode(sm);
      }
      
      const tp = await getSetting('themePreset');
      if (tp) setThemePreset(tp);

      const cm = await getSetting('colorMode');
      if (cm) setColorMode(cm);
      
      const f = await getSetting('font') || 'JetBrains Mono';
      const fu = await getSetting('fontUrl');
      
      const uf = await getSetting('uiFont') || '"JetBrains Mono", monospace';
      const ufu = await getSetting('uiFontUrl');

      if (fu) {
        injectGoogleFont(fu, 'user-chat-font');
      } else if (!['system-ui, sans-serif', 'Georgia, serif', 'monospace'].includes(f)) {
        injectGoogleFont(`https://fonts.googleapis.com/css2?family=${f.replace(/ /g, '+')}:wght@400;500;700&display=swap`, 'user-chat-font');
      } else {
        const existingLink = document.getElementById('user-chat-font');
        if (existingLink) existingLink.remove();
      }
      
      if (ufu) {
        injectGoogleFont(ufu, 'user-ui-font');
      } else {
        const existingLink = document.getElementById('user-ui-font');
        if (existingLink) existingLink.remove();
      }

      document.documentElement.style.setProperty('--font-chat', f.includes(',') ? f : `"${f}", monospace`);
      document.documentElement.style.setProperty('--font-main', uf);
      
      setIsLoaded(true);
    };
    
    init();
  }, [currentView]); // Re-run init when view changes to pick up settings changes

  if (!isLoaded) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#050505] text-[#ff5500] font-mono">
        <div className="flex flex-col items-center space-y-4 animate-pulse">
          <Terminal size={48} />
          <div className="tracking-widest uppercase text-sm">INITIALIZING...</div>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'chat': return <Chat profile={profile} isAiExclusive={false} onEditAgent={(id) => { setEditAgentId(id); setCurrentView('agent_manager'); }} />;
      case 'ai_chat': return <Chat profile={profile} isAiExclusive={true} initialAgent={selectedAgent} onBack={() => { setSelectedAgent(null); setCurrentView('agent_manager'); }} onEditAgent={(id) => { setEditAgentId(id); setCurrentView('agent_manager'); }} />;
      case 'agent_manager': return <AgentManager onSelectAgent={(agent) => { setSelectedAgent(agent); setCurrentView('ai_chat'); }} initialEditAgentId={editAgentId} />;
      case 'organizer': return <Organizer />;
      case 'email_dispatch': return <EmailDispatch />;
      case 'storage_routing': return <StorageRouting />;
      case 'tools': return <Tools />;
      case 'add_contact': return <AddContact />;
      case 'api_lockbox': return <ApiLockbox />;
      case 'settings': return <Settings />;
      case 'profile': return <Profile />;
      default: return <Chat profile={profile} isAiExclusive={false} />;
    }
  };

  const renderSidebarButton = (id: string, IconComponent: any, title: string) => {
    const isActive = currentView === id || (id === 'agent_manager' && currentView === 'ai_chat');
    return (
      <button 
        key={id}
        onClick={() => {
            if (isActive) {
                setIsSidebarOpen(!isSidebarOpen);
            } else {
                setCurrentView(id as any);
                if (window.innerWidth < 640) setIsSidebarOpen(false);
            }
        }}
        className={`relative p-2.5 sm:p-3 rounded-xl transition-all duration-75 ease-out flex justify-center w-full group ${isActive ? 'bg-white/5 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 hover:-translate-y-0.5'}`}
        title={title}
      >
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full shadow-[0_0_10px_var(--accent)]" style={{ background: 'var(--accent-gradient)' }} />}
        <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 transition-transform duration-75 group-hover:scale-110" style={isActive ? { color: 'var(--accent)', filter: 'drop-shadow(0 0 8px var(--accent))' } : {}} />
      </button>
    );
  };

  return (
    <div className={`flex h-[100dvh] w-full bg-[var(--bg-color)] text-[var(--text-main)] font-sans overflow-hidden relative`}>
      <StorageWarning />
      {/* Sidebar Navigation */}
      <div 
        className={`${isSidebarOpen ? 'w-14 sm:w-20 translate-x-0 pointer-events-auto' : 'w-0 -translate-x-full opacity-0 pointer-events-none'} flex flex-col items-center py-4 sm:py-6 z-20 absolute sm:relative h-[calc(100dvh-24px)] m-3 rounded-2xl bg-[var(--panel-bg)] shadow-xl shadow-black/20 border border-white/5 left-0`}
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 25px -5px rgba(0,0,0,0.2)' }}
      >
        <div 
          className={`mb-6 sm:mb-8 text-[var(--accent)] cursor-pointer hover:opacity-80 transition-opacity`} 
          onClick={() => setIsSidebarOpen(false)}
        >
          <Menu className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        
        <div className="flex flex-col space-y-3 sm:space-y-4 flex-1 w-full px-1.5 sm:px-2">
          {renderSidebarButton('chat', Radio, 'Channels')}
          {renderSidebarButton('agent_manager', Bot, 'AI Agents')}
          {renderSidebarButton('organizer', FileText, 'Organizer')}
          {renderSidebarButton('tools', Terminal, 'Hardware Tools')}
          {renderSidebarButton('email_dispatch', Mail, 'Dispatch')}
          {renderSidebarButton('add_contact', Users, 'Contacts')}
          {renderSidebarButton('api_lockbox', Key, 'API Lockbox')}
          {renderSidebarButton('storage_routing', Server, 'Storage & Routing')}
          {renderSidebarButton('settings', SettingsIcon, 'Settings')}
        </div>
        
        <div className="mt-auto pt-4 sm:pt-6 border-t border-[var(--border)] w-full flex flex-col items-center space-y-2">
          <div className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-tighter opacity-50">
            v1.0.5-fix
          </div>
          <button onClick={() => {
              if (currentView === 'profile') {
                  setIsSidebarOpen(!isSidebarOpen);
              } else {
                  setCurrentView('profile');
                  if (window.innerWidth < 640) setIsSidebarOpen(false);
              }
          }} className="relative group">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Avatar" className={`w-8 h-8 sm:w-10 sm:h-10 object-cover border ${currentView === 'profile' ? 'border-[var(--accent)]' : 'border-[var(--text-muted)]'} ${avatarShape === 'circle' ? 'rounded-full' : 'rounded-xl'}`} />
            ) : (
              <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-[var(--border)] flex items-center justify-center text-[10px] sm:text-xs font-bold uppercase overflow-hidden border ${currentView === 'profile' ? 'border-[var(--accent)]' : 'border-[var(--text-muted)]'} ${avatarShape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}>
                {(profile.alias || profile.name || 'U').substring(0, 2)}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className={`flex-1 min-w-0 h-full relative ${isSidebarOpen ? 'sm:ml-0' : 'ml-0'}`}
        onClick={() => {
          // Close sidebar if it's open, regardless of screen size, as requested
          if (isSidebarOpen) {
             setIsSidebarOpen(false);
          }
        }}
      >
        {/* Overlay to close sidebar on mobile/collapsed */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 z-10 bg-black/50 backdrop-blur-sm sm:hidden"
            onClick={(e) => {
                e.stopPropagation();
                setIsSidebarOpen(false);
            }}
          />
        )}

        {/* Floating Sidebar Toggle (Visible when sidebar is closed) */}
        {!isSidebarOpen && (
          <DraggableFab
            icon={<Menu className="w-5 h-5" />}
            onClick={() => setIsSidebarOpen(true)}
            onDoubleClick={async () => {
              const { setSetting } = await import('./lib/db');
              await setSetting('sidebar_toggle_pos', { x: 8, y: 8 });
              setFabReset(prev => prev + 1);
            }}
            storageKey="sidebar_toggle_pos"
            defaultPosition={{ x: 8, y: 8 }}
            resetTrigger={fabReset}
            className="p-2 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--accent)] shadow-lg hover:bg-[var(--bg-color)]"
          />
        )}

        <div className={`h-full w-full ${['organizer', 'tools'].includes(currentView) ? 'sm:max-w-[1024px]' : 'sm:max-w-[500px]'} sm:mx-auto sm:border-x sm:border-[var(--border)] sm:shadow-2xl sm:shadow-black/50 bg-[var(--bg-color)] relative overflow-hidden`}>
          {wallpaper && (
            <div 
              className="absolute inset-0 z-0 opacity-30 pointer-events-none"
              style={{ 
                backgroundImage: `url(${wallpaper})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center' 
              }}
            />
          )}
          <div className="relative z-10 h-full">
            {renderView()}
            {showSharedHandler && (
              <SharedImageHandler 
                sharedId={sharedId} 
                onClose={() => {
                  setShowSharedHandler(false);
                  setSharedId(null);
                  // Re-check pinned state when closing
                  getSetting('pinned_shared_session').then(session => {
                    setHasPinnedSession(!!(session && session.isPinned));
                  });
                }} 
              />
            )}
            {hasPinnedSession && !showSharedHandler && (
              <DraggableFab
                icon={<Pin className="w-5 h-5" />}
                onClick={() => setShowSharedHandler(true)}
                storageKey="pinned_session_fab_pos"
                defaultPosition={{ x: window.innerWidth - 60, y: window.innerHeight - 120 }}
                className="p-3 rounded-full bg-yellow-500 text-black shadow-lg hover:bg-yellow-400 z-40"
              />
            )}
            {showExitToast && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm z-50 animate-in fade-in slide-in-from-bottom-4">
                Press back again to exit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

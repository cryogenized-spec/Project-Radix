import React, { useState, useEffect, useRef } from 'react';
import { Bot, Plus, Trash2, Edit3, Save, X, QrCode, Sliders, Brain, Thermometer, MessageSquare, Pin, Clock, Check, Calendar, Ghost, Users, Image as ImageIcon, Undo, Redo, Type, Palette, Zap, HardDrive } from 'lucide-react';
import { getAgents, addAgent, deleteAgent, getSetting } from '../lib/db';
import { generateIdentity } from '../lib/crypto';
import { extractFontFamily, injectGoogleFont } from '../lib/fonts';
import { AgentLoadingSettings, LoadingStateConfig } from './AgentLoadingSettings';
import QRCode from 'qrcode';

// CRITICAL: Update Service Worker runtimeCaching to include fonts.googleapis.com and fonts.gstatic.com for offline support.

const CRON_INTERVALS = [5, 10, 20, 30, 40, 50, 60];
const JOB_ACTIONS = [
  { id: 'check_messages', label: 'Check for messages' },
  { id: 'check_calendar', label: 'Check calendar for tasks' }
];

export default function AgentManager({ onSelectAgent, initialEditAgentId }: { onSelectAgent: (agent: any) => void, initialEditAgentId?: string }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<any>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [profile, setProfile] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [privatePersona, setPrivatePersona] = useState('');
  const [publicPersona, setPublicPersona] = useState('');
  const [metaGamingRules, setMetaGamingRules] = useState('');
  const [userAppearance, setUserAppearance] = useState('');
  
  // Appearance & Behavior
  const [font, setFont] = useState('sans-serif');
  const [fontUrl, setFontUrl] = useState('');
  const [fontUrlError, setFontUrlError] = useState('');
  const [fontColor, setFontColor] = useState('#00FF00');
  const [streamResponse, setStreamResponse] = useState(true);
  const [portraitScale, setPortraitScale] = useState(1);
  const [portraitAspectRatio, setPortraitAspectRatio] = useState<'1:1' | '4:5' | 'circle'>('1:1');

  // Moods & Roleplay
  const [moodPortraits, setMoodPortraits] = useState<{id: string, mood: string, url: string}[]>([]);
  const [moodDetectionPrompt, setMoodDetectionPrompt] = useState('');
  const [roleplayEnabled, setRoleplayEnabled] = useState(false);
  const [roleplayInstruction, setRoleplayInstruction] = useState('');
  
  // Storage Access
  const [storageAccess, setStorageAccess] = useState(false);
  
  // Red Pin (Primary/Chat)
  const [isPrimary, setIsPrimary] = useState(false);
  const [primaryMode, setPrimaryMode] = useState<'ghost' | 'public'>('ghost');

  // Blue Pin (Organizer)
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [organizerMode, setOrganizerMode] = useState<'ghost' | 'public'>('ghost');

  // Green Pin (Feed/Channeler)
  const [isFeed, setIsFeed] = useState(false);
  const [feedMode, setFeedMode] = useState<'ghost' | 'public'>('ghost');

  // Purple Pin (Workbench)
  const [isWorkbench, setIsWorkbench] = useState(false);
  const [workbenchMode, setWorkbenchMode] = useState<'ghost' | 'public'>('ghost');

  const [cronJobs, setCronJobs] = useState<any[]>([]);

  const [loadingState, setLoadingState] = useState<LoadingStateConfig>({
    enabled: false,
    text: 'processing...',
    fontUrl: '',
    fontFamily: 'inherit',
    textColor: '#ff5500',
    iconIdentifier: 'autorenew',
    iconColor: '#ff5500',
    animationStyle: 'turning',
    animationDirection: 'cw'
  });

  // Undo/Redo History
  const historyRef = useRef<any[]>([]);
  const historyIndexRef = useRef(-1);

  const saveToHistory = () => {
    const currentState = {
      name, privatePersona, publicPersona, metaGamingRules, userAppearance, font, fontUrl, fontColor, streamResponse,
      portraitScale, portraitAspectRatio,
      moodPortraits, moodDetectionPrompt, roleplayEnabled, roleplayInstruction,
      storageAccess,
      isPrimary, primaryMode, isOrganizer, organizerMode, isFeed, feedMode, isWorkbench, workbenchMode, cronJobs, loadingState
    };

    // If we are not at the end of history, truncate future
    if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    historyRef.current.push(JSON.stringify(currentState));
    historyIndexRef.current++;
  };

  const handleUndo = () => {
      if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const state = JSON.parse(historyRef.current[historyIndexRef.current]);
          applyState(state);
      }
  };

  const handleRedo = () => {
      if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current++;
          const state = JSON.parse(historyRef.current[historyIndexRef.current]);
          applyState(state);
      }
  };

  const applyState = (state: any) => {
      setName(state.name);
      setPrivatePersona(state.privatePersona);
      setPublicPersona(state.publicPersona);
      setMetaGamingRules(state.metaGamingRules || '');
      setUserAppearance(state.userAppearance || '');
      setFont(state.font);
      setFontUrl(state.fontUrl || '');
      setFontColor(state.fontColor);
      setStreamResponse(state.streamResponse);
      setPortraitScale(state.portraitScale || 1);
      setPortraitAspectRatio(state.portraitAspectRatio || '1:1');
      setMoodPortraits(state.moodPortraits);
      setMoodDetectionPrompt(state.moodDetectionPrompt);
      setRoleplayEnabled(state.roleplayEnabled);
      setRoleplayInstruction(state.roleplayInstruction);
      setStorageAccess(state.storageAccess);
      setIsPrimary(state.isPrimary);
      setPrimaryMode(state.primaryMode);
      setIsOrganizer(state.isOrganizer);
      setOrganizerMode(state.organizerMode);
      setIsFeed(state.isFeed || false);
      setFeedMode(state.feedMode || 'ghost');
      setIsWorkbench(state.isWorkbench || false);
      setWorkbenchMode(state.workbenchMode || 'ghost');
      setCronJobs(state.cronJobs);
      if (state.loadingState) setLoadingState(state.loadingState);
  };

  // Save initial state when editing starts
  useEffect(() => {
      if (isEditing) {
          historyRef.current = [];
          historyIndexRef.current = -1;
          saveToHistory();
      }
  }, [isEditing]);

  // Debounced save to history on changes (simplified for now, manual save points might be better but let's try to capture key changes)
  // For simplicity in this iteration, I'll add a manual "Checkpoint" button or just rely on the user not needing granular undo for every keystroke unless requested.
  // The user asked for Undo/Redo buttons. Let's make them manually triggerable or hook into key state setters.
  // Actually, hooking into every setter is complex without a reducer.
  // Let's wrap the setters or just save history on specific actions? 
  // Better: Let's use a useEffect that watches all state variables and debounces the history save.
  
  useEffect(() => {
      const timer = setTimeout(() => {
          if (isEditing) {
              const currentState = JSON.stringify({
                  name, privatePersona, publicPersona, metaGamingRules, userAppearance, font, fontUrl, fontColor, streamResponse,
                  portraitScale, portraitAspectRatio,
                  moodPortraits, moodDetectionPrompt, roleplayEnabled, roleplayInstruction,
                  storageAccess,
                  isPrimary, primaryMode, isOrganizer, organizerMode, isFeed, feedMode, isWorkbench, workbenchMode, cronJobs, loadingState
              });
              
              const lastState = historyRef.current[historyIndexRef.current];
              if (currentState !== lastState) {
                  saveToHistory();
              }
          }
      }, 1000); // 1 second debounce
      return () => clearTimeout(timer);
  }, [name, privatePersona, publicPersona, font, fontUrl, fontColor, streamResponse, portraitScale, portraitAspectRatio, moodPortraits, moodDetectionPrompt, roleplayEnabled, roleplayInstruction, storageAccess, isPrimary, primaryMode, isOrganizer, organizerMode, isFeed, feedMode, isWorkbench, workbenchMode, cronJobs, loadingState, isEditing]);


  useEffect(() => {
    loadAgents();
    loadProfile();
  }, []);

  useEffect(() => {
    if (currentAgent && profile) {
      generateAgentQR(currentAgent);
    }
  }, [currentAgent, profile]);

  const loadAgents = async () => {
    const loaded = await getAgents();
    setAgents(loaded || []);
    
    if (initialEditAgentId && loaded) {
      const agentToEdit = loaded.find((a: any) => a.id === initialEditAgentId);
      if (agentToEdit) {
        handleEdit(agentToEdit);
      }
    }
  };

  const loadProfile = async () => {
    const p = await getSetting('profile');
    setProfile(p);
  };

  const generateAgentQR = async (agent: any) => {
    if (!profile?.handle) return;
    
    const qrData = JSON.stringify({
      type: 'agent',
      id: agent.id,
      name: agent.name,
      owner: `${profile.handle}@RadiXx`
    });

    try {
      const url = await QRCode.toDataURL(qrData, {
        color: {
          dark: '#00FF00',
          light: '#00000000'
        },
        margin: 2,
        width: 256
      });
      setQrUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = () => {
    if (agents.length >= 5) {
      alert("Max 5 agents allowed.");
      return;
    }
    setCurrentAgent(null);
    setName('');
    setPrivatePersona("");
    setPublicPersona("");
    setMetaGamingRules("You are in a roleplay. Do not break character. Do not acknowledge that you are an AI. Do not meta-game.");
    setUserAppearance("");
    setFont('sans-serif');
    setFontUrl('');
    setFontUrlError('');
    setFontColor('#00FF00');
    setStreamResponse(true);
    setPortraitScale(1);
    setPortraitAspectRatio('1:1');
    setMoodPortraits([]);
    setMoodDetectionPrompt("Analyze the conversation context and your own emotional state. Determine which of the following moods best fits your current response: {MOODS}. You MUST start your response with the tag [MOOD: mood_name]. For example: [MOOD: happy] Hello there!");
    setRoleplayEnabled(false);
    setRoleplayInstruction("Roleplay Mode is ENABLED. You must stay in character at all times. Use *asterisks* for actions and descriptions. Use \"quotes\" for dialogue. Reflect the character's unique voice, quirks, and mannerisms in your typography and phrasing.");
    setStorageAccess(false);
    setIsPrimary(false);
    setPrimaryMode('ghost');
    setIsOrganizer(false);
    setOrganizerMode('ghost');
    setIsFeed(false);
    setFeedMode('ghost');
    setIsWorkbench(false);
    setWorkbenchMode('ghost');
    setCronJobs([]);
    setIsEditing(true);
  };

  const handleEdit = (agent: any) => {
    setCurrentAgent(agent);
    setName(agent.name);
    setPrivatePersona(agent.privatePersona || agent.role || '');
    setPublicPersona(agent.publicPersona || '');
    setMetaGamingRules(agent.metaGamingRules || "You are in a roleplay. Do not break character. Do not acknowledge that you are an AI. Do not meta-game.");
    setUserAppearance(agent.userAppearance || '');
    setFont(agent.font || 'sans-serif');
    setFontUrl(agent.fontUrl || '');
    setFontUrlError('');
    setFontColor(agent.fontColor || '#00FF00');
    setStreamResponse(agent.streamResponse !== undefined ? agent.streamResponse : true);
    setPortraitScale(agent.portraitScale || 1);
    setPortraitAspectRatio(agent.portraitAspectRatio || '1:1');
    setMoodPortraits(agent.moodPortraits || []);
    setMoodDetectionPrompt(agent.moodDetectionPrompt || "Analyze the conversation context and your own emotional state. Determine which of the following moods best fits your current response: {MOODS}. You MUST start your response with the tag [MOOD: mood_name]. For example: [MOOD: happy] Hello there!");
    setRoleplayEnabled(agent.roleplayEnabled || false);
    setRoleplayInstruction(agent.roleplayInstruction || "Roleplay Mode is ENABLED. You must stay in character at all times. Use *asterisks* for actions and descriptions. Use \"quotes\" for dialogue. Reflect the character's unique voice, quirks, and mannerisms in your typography and phrasing.");
    
    setStorageAccess(agent.storageAccess || false);

    setIsPrimary(agent.isPrimary || agent.isPinned || false);
    setPrimaryMode(agent.primaryMode || 'ghost');
    
    setIsOrganizer(agent.isOrganizer || false);
    setOrganizerMode(agent.organizerMode || 'ghost');
    
    setIsFeed(agent.isFeed || false);
    setFeedMode(agent.feedMode || 'ghost');
    
    setIsWorkbench(agent.isWorkbench || false);
    setWorkbenchMode(agent.workbenchMode || 'ghost');
    
    setCronJobs(agent.cronJobs || []);
    setLoadingState(agent.loadingState || {
      enabled: false,
      text: 'processing...',
      fontUrl: '',
      fontFamily: 'inherit',
      textColor: '#ff5500',
      iconIdentifier: 'autorenew',
      iconColor: '#ff5500',
      animationStyle: 'turning',
      animationDirection: 'cw'
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    let agentId = currentAgent ? currentAgent.id : crypto.randomUUID();
    let agentIdentity = currentAgent ? currentAgent.identity : null;

    if (!agentIdentity) {
      agentIdentity = await generateIdentity();
    }

    // Handle Mutual Exclusivity for Pins
    if (isPrimary) {
        const otherPrimary = agents.find(a => a.id !== agentId && (a.isPrimary || a.isPinned));
        if (otherPrimary) {
            await addAgent({ ...otherPrimary, isPrimary: false, isPinned: false });
        }
    }

    if (isOrganizer) {
        const otherOrganizer = agents.find(a => a.id !== agentId && a.isOrganizer);
        if (otherOrganizer) {
            await addAgent({ ...otherOrganizer, isOrganizer: false });
        }
    }
    if (isFeed) {
        const otherFeed = agents.find(a => a.id !== agentId && a.isFeed);
        if (otherFeed) {
            await addAgent({ ...otherFeed, isFeed: false });
        }
    }
    if (isWorkbench) {
        const otherWorkbench = agents.find(a => a.id !== agentId && a.isWorkbench);
        if (otherWorkbench) {
            await addAgent({ ...otherWorkbench, isWorkbench: false });
        }
    }

    const newAgent = {
      ...(currentAgent || {}),
      id: agentId,
      identity: agentIdentity,
      name,
      privatePersona,
      publicPersona,
      metaGamingRules,
      userAppearance,
      role: privatePersona, // Backwards compatibility
      font,
      fontUrl,
      fontColor,
      streamResponse,
      portraitScale,
      portraitAspectRatio,
      moodPortraits,
      moodDetectionPrompt,
      roleplayEnabled,
      roleplayInstruction,
      storageAccess,
      isPrimary, // Red Pin
      isPinned: isPrimary, // Backwards compatibility
      primaryMode,
      isOrganizer, // Blue Pin
      organizerMode,
      isFeed, // Green Pin
      feedMode,
      isWorkbench, // Purple Pin
      workbenchMode,
      cronJobs,
      loadingState,
      createdAt: currentAgent ? currentAgent.createdAt : Date.now()
    };

    await addAgent(newAgent);
    await loadAgents();
    setIsEditing(false);
    setCurrentAgent(null);
  };

  const handleFontSync = () => {
      if (!fontUrl.trim()) {
          setFontUrlError('');
          setFont('sans-serif');
          return;
      }
      const family = extractFontFamily(fontUrl);
      if (family) {
          setFontUrlError('');
          setFont(family);
          injectGoogleFont(fontUrl, `agent-font-${currentAgent?.id || 'new'}`);
          document.documentElement.style.setProperty('--agent-font-family', `"${family}", sans-serif`);
      } else {
          setFontUrlError('Please provide a valid Google Fonts link.');
      }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this agent?')) {
      await deleteAgent(id);
      await loadAgents();
      if (currentAgent?.id === id) {
        setIsEditing(false);
        setCurrentAgent(null);
      }
    }
  };

  const addCronJob = (interval: number) => {
      if (cronJobs.length >= 10) return;
      setCronJobs([...cronJobs, { 
          id: crypto.randomUUID(), 
          interval, 
          name: `Job ${cronJobs.length + 1}`, 
          action: 'check_messages',
          settings: { tone: 'private' } 
      }]);
  };

  const updateCronJob = (id: string, updates: any) => {
      setCronJobs(cronJobs.map(job => job.id === id ? { ...job, ...updates } : job));
  };

  const removeCronJob = (id: string) => {
      setCronJobs(cronJobs.filter(job => job.id !== id));
  };

  if (isEditing) {
    return (
      <div className="flex flex-col h-full p-4 sm:p-6 space-y-6 overflow-y-auto animate-in fade-in">
        <div className="flex flex-wrap items-center justify-between border-b border-[var(--border)] pb-4 gap-2">
          <h2 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)] flex items-center flex-1 min-w-0">
            <Bot className="mr-2 shrink-0" /> 
            <span className="truncate">{currentAgent ? 'Edit Agent' : 'New Agent'}</span>
          </h2>
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
              <button 
                  onClick={handleUndo} 
                  disabled={historyIndexRef.current <= 0}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30"
                  title="Undo"
              >
                  <Undo size={18} />
              </button>
              <button 
                  onClick={handleRedo} 
                  disabled={historyIndexRef.current >= historyRef.current.length - 1}
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-30"
                  title="Redo"
              >
                  <Redo size={18} />
              </button>
              <button onClick={() => setIsEditing(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] ml-2">
                <X size={20} />
              </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Name</label>
            <input 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full radix-input p-3 rounded-xl"
              placeholder="Agent Name"
            />
          </div>

          {/* Appearance Settings */}
          <div className="space-y-4 p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
              <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                      <Palette size={14} className="mr-1" /> Appearance & Behavior
                  </label>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                          <Type size={12} className="mr-1" /> Typography
                      </label>
                      <div className="text-[10px] text-[var(--text-muted)] mb-2">
                          Customizing the voice and vision of your Agent.
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                          <textarea 
                              value={fontUrl}
                              onChange={(e) => setFontUrl(e.target.value)}
                              placeholder="https://fonts.googleapis.com/css2?family=..."
                              className={`w-full sm:flex-1 radix-input p-2 rounded-lg text-xs min-w-0 resize-none h-16 ${fontUrlError ? 'border-red-500' : ''}`}
                              title={fontUrlError ? "Please provide a valid Google Fonts link." : ""}
                          />
                          <button 
                              onClick={handleFontSync}
                              className="w-full sm:w-auto px-3 py-2 rounded-lg bg-[var(--accent)] text-black text-xs font-bold uppercase tracking-wider hover:opacity-90 whitespace-nowrap"
                          >
                              Sync
                          </button>
                      </div>
                      {fontUrlError && <p className="text-red-500 text-[10px]">{fontUrlError}</p>}
                      <div className="mt-2 p-3 bg-[var(--bg-color)] rounded border border-[var(--border)] overflow-hidden">
                          <p className="text-[10px] text-[var(--text-muted)] mb-2 uppercase tracking-wider">Preview:</p>
                          <p style={{ fontFamily: font, color: fontColor }} className="text-sm break-words">
                              The quick brown fox jumps over the lazy dog
                          </p>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                          <Palette size={12} className="mr-1" /> Font Color
                      </label>
                      <div className="flex items-center space-x-2">
                          <input 
                              type="color" 
                              value={fontColor}
                              onChange={(e) => setFontColor(e.target.value)}
                              className="w-10 h-10 p-0 border-0 rounded-lg cursor-pointer bg-transparent"
                          />
                          <input 
                              value={fontColor}
                              onChange={(e) => setFontColor(e.target.value)}
                              className="flex-1 radix-input p-2 rounded-lg text-xs font-mono uppercase min-w-0"
                              placeholder="#RRGGBB"
                          />
                      </div>
                  </div>
              </div>

              <div className="flex items-start justify-between pt-2 gap-4">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-start flex-1 min-w-0">
                      <Zap size={12} className="mr-2 mt-0.5 shrink-0" /> 
                      <span className="leading-tight break-words">Stream Responses (Typewriter Effect)</span>
                  </label>
                  <button 
                      onClick={() => setStreamResponse(!streamResponse)}
                      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${streamResponse ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                  >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${streamResponse ? 'left-6' : 'left-1'}`} />
                  </button>
              </div>
          </div>

          <div className="space-y-4 p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Portrait</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <label className={`cursor-pointer border-2 border-dashed border-[var(--border)] flex items-center justify-center overflow-hidden hover:border-[var(--accent)] transition-colors relative group bg-[var(--bg-color)] ${portraitAspectRatio === 'circle' ? 'rounded-full aspect-square' : portraitAspectRatio === '4:5' ? 'rounded-xl aspect-[4/5]' : 'rounded-xl aspect-square'}`} style={{ width: `${80 * portraitScale}px` }}>
                    {currentAgent?.avatar ? (
                        <img src={currentAgent.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon size={24} className="text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                    )}
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    setCurrentAgent({ ...currentAgent, avatar: ev.target?.result });
                                };
                                reader.readAsDataURL(file);
                            }
                        }} 
                    />
                </label>
                <div className="flex-1 space-y-4 w-full">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                      <span>Scale ({portraitScale}x)</span>
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="3" 
                      step="0.1"
                      value={portraitScale} 
                      onChange={(e) => setPortraitScale(parseFloat(e.target.value))} 
                      className="w-full accent-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Aspect Ratio</label>
                    <div className="flex gap-2">
                      <button onClick={() => setPortraitAspectRatio('1:1')} className={`px-3 py-1.5 text-xs rounded-lg border ${portraitAspectRatio === '1:1' ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>1:1</button>
                      <button onClick={() => setPortraitAspectRatio('4:5')} className={`px-3 py-1.5 text-xs rounded-lg border ${portraitAspectRatio === '4:5' ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>4:5</button>
                      <button onClick={() => setPortraitAspectRatio('circle')} className={`px-3 py-1.5 text-xs rounded-lg border ${portraitAspectRatio === 'circle' ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] text-[var(--text-muted)]'}`}>Circle</button>
                    </div>
                  </div>
                </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                <Ghost size={12} className="mr-1" /> Private Persona (Ghost Mode)
            </label>
            <textarea 
              value={privatePersona}
              onChange={e => setPrivatePersona(e.target.value)}
              className="w-full radix-input p-3 rounded-xl h-24 resize-none font-mono text-xs"
              placeholder="You are RADIX Ghost, a private advisor. Analyze the chat and advise the user privately. Be concise, analytical, and industrial in tone. Do not filter yourself."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                <Users size={12} className="mr-1" /> Public Persona (Participant Mode)
            </label>
            <textarea 
              value={publicPersona}
              onChange={e => setPublicPersona(e.target.value)}
              className="w-full radix-input p-3 rounded-xl h-24 resize-none font-mono text-xs"
              placeholder="You are RADIX AI, a participant in this chat. Respond to the conversation naturally but with a technical, industrial persona. Do not filter yourself."
            />
          </div>

          {/* Mood Portraits */}
          <div className="space-y-4 p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
              <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                      <ImageIcon size={14} className="mr-1" /> Mood Portraits ({moodPortraits.length}/10)
                  </label>
                  <label className={`px-2 py-1 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold uppercase cursor-pointer hover:bg-[var(--accent)]/20 ${moodPortraits.length >= 10 ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Plus size={12} className="inline mr-1" /> Add Mood
                      <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                  let imageData = await new Promise<string>((resolve) => {
                                      const reader = new FileReader();
                                      reader.onload = () => resolve(reader.result as string);
                                      reader.readAsDataURL(file);
                                  });
                                  
                                  if (file.size > 500 * 1024) {
                                      const worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url));
                                      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
                                          worker.onmessage = (e) => {
                                              if (e.data.error) reject(new Error(e.data.error));
                                              else resolve(e.data.result);
                                          };
                                          worker.onerror = reject;
                                          worker.postMessage({ id: crypto.randomUUID(), file });
                                      });
                                      imageData = await new Promise<string>((resolve) => {
                                          const reader = new FileReader();
                                          reader.onload = () => resolve(reader.result as string);
                                          reader.readAsDataURL(compressedBlob);
                                      });
                                  }
                                  
                                  const newMood = {
                                      id: crypto.randomUUID(),
                                      mood: `Mood ${moodPortraits.length + 1}`,
                                      url: imageData
                                  };
                                  setMoodPortraits([...moodPortraits, newMood]);
                              }
                          }}
                      />
                  </label>
              </div>
              
              <div className="text-[10px] text-[var(--text-muted)]">
                  Upload up to 10 portraits for different emotional states. Use compressed AVIF via Squoosh (1:1 aspect ratio recommended).
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {moodPortraits.map((mp, idx) => (
                      <div key={mp.id} className="relative group bg-[var(--bg-color)] rounded-lg border border-[var(--border)] p-2">
                          <div className="aspect-square rounded-md overflow-hidden mb-2 bg-[var(--panel-bg)]">
                              <img src={mp.url} alt={mp.mood} className="w-full h-full object-cover" />
                          </div>
                          <input 
                              value={mp.mood}
                              onChange={(e) => {
                                  const updated = [...moodPortraits];
                                  updated[idx].mood = e.target.value;
                                  setMoodPortraits(updated);
                              }}
                              className="w-full bg-transparent text-[10px] font-bold text-center border-b border-transparent focus:border-[var(--accent)] outline-none min-w-0"
                              placeholder="Mood Name"
                          />
                          <button 
                              onClick={() => setMoodPortraits(moodPortraits.filter(p => p.id !== mp.id))}
                              className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <X size={10} />
                          </button>
                      </div>
                  ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Mood Detection Logic</label>
                  <textarea 
                      value={moodDetectionPrompt}
                      onChange={e => setMoodDetectionPrompt(e.target.value)}
                      className="w-full radix-input p-2 rounded-lg h-20 resize-none font-mono text-[10px]"
                      placeholder="Prompt to determine mood..."
                  />
                  <div className="text-[9px] text-[var(--text-muted)]">
                      Use <code>{'{MOODS}'}</code> placeholder to insert available moods.
                  </div>
              </div>
          </div>

          {/* Roleplay Settings */}
          <div className="space-y-3 p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
              <div className="flex items-start justify-between gap-4">
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-start flex-1 min-w-0">
                      <Bot size={14} className="mr-2 mt-0.5 shrink-0" /> 
                      <span className="leading-tight break-words">Roleplay Configuration</span>
                  </label>
                  <button 
                      onClick={() => setRoleplayEnabled(!roleplayEnabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${roleplayEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                  >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${roleplayEnabled ? 'left-6' : 'left-1'}`} />
                  </button>
              </div>
              
              {roleplayEnabled && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Roleplay Logic & Typography</label>
                          <textarea 
                              value={roleplayInstruction}
                              onChange={e => setRoleplayInstruction(e.target.value)}
                              className="w-full radix-input p-3 rounded-xl h-24 resize-none font-mono text-xs"
                              placeholder="Instructions for roleplay style, formatting, and behavior..."
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Meta Gaming / God Mode Rules</label>
                          <textarea 
                              value={metaGamingRules}
                              onChange={e => setMetaGamingRules(e.target.value)}
                              className="w-full radix-input p-3 rounded-xl h-24 resize-none font-mono text-xs"
                              placeholder="You are in a roleplay. Do not break character. Do not acknowledge that you are an AI. Do not meta-game."
                          />
                      </div>
                      <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">User Appearance</label>
                          <textarea 
                              value={userAppearance}
                              onChange={e => setUserAppearance(e.target.value)}
                              className="w-full radix-input p-3 rounded-xl h-24 resize-none font-mono text-xs"
                              placeholder="Describe how the user appears to the character..."
                          />
                      </div>
                  </div>
              )}
          </div>

          {/* Storage Access */}
          <div className="flex items-start justify-between p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl gap-4">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full shrink-0 ${storageAccess ? 'bg-orange-500/20 text-orange-500' : 'bg-[var(--bg-color)] text-[var(--text-muted)]'}`}>
                      <HardDrive size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-bold text-sm truncate">File System Access</div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-tight break-words">Allows agent to read local files via @files and @sys.</div>
                  </div>
              </div>
              <button 
                  onClick={() => setStorageAccess(!storageAccess)}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 mt-1 ${storageAccess ? 'bg-orange-500' : 'bg-[var(--border)]'}`}
              >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${storageAccess ? 'left-7' : 'left-1'}`} />
              </button>
          </div>

          {/* Red Pin / Primary */}
          <div className="flex items-start justify-between p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl gap-4">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full shrink-0 ${isPrimary ? 'bg-red-500/20 text-red-500' : 'bg-[var(--bg-color)] text-[var(--text-muted)]'}`}>
                      <Pin size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-bold text-sm truncate">Primary Agent (Red Pin)</div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-tight break-words">Responds to long-press actions.</div>
                  </div>
              </div>
              <div className="flex flex-col items-end space-y-2 shrink-0">
                  {isPrimary && (
                      <button 
                        onClick={() => setPrimaryMode(primaryMode === 'ghost' ? 'public' : 'ghost')}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-[var(--bg-color)] border border-[var(--border)] text-[10px] uppercase font-bold"
                      >
                          {primaryMode === 'ghost' ? <Ghost size={12} /> : <Users size={12} />}
                          <span>{primaryMode}</span>
                      </button>
                  )}
                  <button 
                      onClick={() => setIsPrimary(!isPrimary)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${isPrimary ? 'bg-red-500' : 'bg-[var(--border)]'}`}
                  >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPrimary ? 'left-7' : 'left-1'}`} />
                  </button>
              </div>
          </div>

          {/* Blue Pin / Organizer */}
          <div className="flex items-start justify-between p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl gap-4">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full shrink-0 ${isOrganizer ? 'bg-blue-500/20 text-blue-500' : 'bg-[var(--bg-color)] text-[var(--text-muted)]'}`}>
                      <Pin size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-bold text-sm truncate">Organizer Agent (Blue Pin)</div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-tight break-words">Responds to Organizer tasks.</div>
                  </div>
              </div>
              <div className="flex flex-col items-end space-y-2 shrink-0">
                  {isOrganizer && (
                      <button 
                        onClick={() => setOrganizerMode(organizerMode === 'ghost' ? 'public' : 'ghost')}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-[var(--bg-color)] border border-[var(--border)] text-[10px] uppercase font-bold"
                      >
                          {organizerMode === 'ghost' ? <Ghost size={12} /> : <Users size={12} />}
                          <span>{organizerMode}</span>
                      </button>
                  )}
                  <button 
                      onClick={() => setIsOrganizer(!isOrganizer)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${isOrganizer ? 'bg-blue-500' : 'bg-[var(--border)]'}`}
                  >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isOrganizer ? 'left-7' : 'left-1'}`} />
                  </button>
              </div>
          </div>

          {/* Green Pin / Feed */}
          <div className="flex items-start justify-between p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl gap-4">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full shrink-0 ${isFeed ? 'bg-green-500/20 text-green-500' : 'bg-[var(--bg-color)] text-[var(--text-muted)]'}`}>
                      <Pin size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-bold text-sm truncate">Feed Agent (Green Pin)</div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-tight break-words">Analyzes feeds and channels.</div>
                  </div>
              </div>
              <div className="flex flex-col items-end space-y-2 shrink-0">
                  {isFeed && (
                      <button 
                        onClick={() => setFeedMode(feedMode === 'ghost' ? 'public' : 'ghost')}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-[var(--bg-color)] border border-[var(--border)] text-[10px] uppercase font-bold"
                      >
                          {feedMode === 'ghost' ? <Ghost size={12} /> : <Users size={12} />}
                          <span>{feedMode}</span>
                      </button>
                  )}
                  <button 
                      onClick={() => setIsFeed(!isFeed)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${isFeed ? 'bg-green-500' : 'bg-[var(--border)]'}`}
                  >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isFeed ? 'left-7' : 'left-1'}`} />
                  </button>
              </div>
          </div>

          {/* Purple Pin / Workbench */}
          <div className="flex items-start justify-between p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl gap-4">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-full shrink-0 ${isWorkbench ? 'bg-purple-500/20 text-purple-500' : 'bg-[var(--bg-color)] text-[var(--text-muted)]'}`}>
                      <Pin size={20} />
                  </div>
                  <div className="min-w-0">
                      <div className="font-bold text-sm truncate">Workbench Agent (Purple Pin)</div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-tight break-words">Assists with RADIX Workbench CAD.</div>
                  </div>
              </div>
              <div className="flex flex-col items-end space-y-2 shrink-0">
                  {isWorkbench && (
                      <button 
                        onClick={() => setWorkbenchMode(workbenchMode === 'ghost' ? 'public' : 'ghost')}
                        className="flex items-center space-x-1 px-2 py-1 rounded bg-[var(--bg-color)] border border-[var(--border)] text-[10px] uppercase font-bold"
                      >
                          {workbenchMode === 'ghost' ? <Ghost size={12} /> : <Users size={12} />}
                          <span>{workbenchMode}</span>
                      </button>
                  )}
                  <button 
                      onClick={() => setIsWorkbench(!isWorkbench)}
                      className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${isWorkbench ? 'bg-purple-500' : 'bg-[var(--border)]'}`}
                  >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isWorkbench ? 'left-7' : 'left-1'}`} />
                  </button>
              </div>
          </div>

          {/* Cron Jobs */}
          <div className="space-y-3 p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl">
              <div className="flex flex-col gap-3">
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] flex items-center shrink-0">
                      <Clock size={14} className="mr-1" /> Cron Jobs (Background Tasks)
                  </label>
                  
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-400 mb-2">
                      <strong>Beta Note:</strong> These scheduled tasks require a backend trigger. Once deployed to GitHub Pages, you will need to set up a GitHub Action to ping your Firebase instance to execute these jobs.
                  </div>

                  <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2 w-full">
                      {CRON_INTERVALS.map(min => (
                          <button 
                              key={min} 
                              onClick={() => addCronJob(min)}
                              className="px-2 py-2 sm:py-1 text-[10px] sm:text-[9px] bg-[var(--panel-bg)] border border-[var(--border)] rounded hover:border-[var(--accent)] text-center w-full"
                          >
                              +{min}m
                          </button>
                      ))}
                  </div>
              </div>
              
              <div className="space-y-2">
                  {cronJobs.length === 0 && (
                      <div className="text-center py-4 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border)] rounded-xl">
                          No scheduled jobs.
                      </div>
                  )}
                  {cronJobs.map((job, idx) => (
                      <div key={job.id} className="p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-[var(--accent)]">{job.interval}m</span>
                                  <input 
                                      value={job.name}
                                      onChange={(e) => updateCronJob(job.id, { name: e.target.value })}
                                      className="bg-transparent border-b border-transparent focus:border-[var(--accent)] outline-none text-xs flex-1 min-w-0"
                                      placeholder="Job Name"
                                  />
                              </div>
                              <button onClick={() => removeCronJob(job.id)} className="text-[var(--text-muted)] hover:text-red-500">
                                  <X size={14} />
                              </button>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-2">
                              <select 
                                  value={job.action}
                                  onChange={(e) => updateCronJob(job.id, { action: e.target.value })}
                                  className="w-full sm:flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs min-w-0"
                              >
                                  {JOB_ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                              </select>
                              
                              {/* Action Specific Settings */}
                              {job.action === 'check_messages' && (
                                  <select 
                                      value={job.settings?.tone || 'private'}
                                      onChange={(e) => updateCronJob(job.id, { settings: { ...job.settings, tone: e.target.value } })}
                                      className="w-full sm:w-24 bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs"
                                  >
                                      <option value="private">Private</option>
                                      <option value="public">Public</option>
                                  </select>
                              )}
                              {job.action === 'check_calendar' && (
                                  <select 
                                      value={job.settings?.timeframe || '1h'}
                                      onChange={(e) => updateCronJob(job.id, { settings: { ...job.settings, timeframe: e.target.value } })}
                                      className="w-full sm:w-24 bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs"
                                  >
                                      <option value="30m">30 min</option>
                                      <option value="1h">1 Hour</option>
                                      <option value="2h">2 Hours</option>
                                      <option value="day">Today</option>
                                  </select>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <AgentLoadingSettings 
            config={loadingState}
            onChange={setLoadingState}
          />

          <button 
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider flex items-center justify-center space-x-2 hover:opacity-90 transition-opacity"
          >
            <Save size={18} />
            <span>Save Agent</span>
          </button>
        </div>

        {currentAgent && qrUrl && (
          <div className="mt-8 p-6 bg-white rounded-xl flex flex-col items-center justify-center space-y-4 relative overflow-hidden group">
            <div className="absolute top-2 left-2 text-black text-[10px] font-bold uppercase tracking-widest opacity-50">
              AI Chatbot
            </div>
            
            <div className="relative">
              <img src={qrUrl} alt="Agent QR" className="w-48 h-48 object-contain" />
              {/* Center Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white p-1 rounded-full">
                  <Bot size={24} className="text-black" />
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-black font-bold text-sm uppercase tracking-wider">{currentAgent.name}</div>
              <div className="text-black/60 text-xs font-mono mt-1">
                {profile?.handle ? `@${profile.handle}@RadiXx` : 'No Handle Set'}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 space-y-6 overflow-y-auto animate-in fade-in">
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--border)] pb-4 pl-12 sm:pl-0 gap-2">
        <h2 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)] flex items-center flex-1 min-w-0">
          <Bot className="mr-2 shrink-0" /> 
          <span className="truncate">AI Agents</span>
        </h2>
        <button 
          onClick={handleCreate}
          disabled={agents.length >= 5}
          className="px-3 py-1.5 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 shrink-0"
        >
          <Plus size={14} />
          <span>Configure</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {agents.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-10 uppercase tracking-widest text-xs">
            No agents created.
          </div>
        ) : (
          agents.map(agent => (
            <div key={agent.id} className="p-4 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-all group relative">
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] relative overflow-hidden shrink-0">
                    {agent.avatar ? (
                        <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                    ) : (
                        <Bot size={20} />
                    )}
                    {(agent.isPrimary || agent.isPinned) && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full border border-[var(--bg-color)]">
                            <Pin size={8} fill="currentColor" />
                        </div>
                    )}
                    {agent.isOrganizer && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border border-[var(--bg-color)]">
                            <Pin size={8} fill="currentColor" />
                        </div>
                    )}
                    {agent.isFeed && (
                        <div className="absolute -bottom-1 -left-1 bg-green-500 text-white p-0.5 rounded-full border border-[var(--bg-color)]">
                            <Pin size={8} fill="currentColor" />
                        </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[var(--text-main)] truncate">{agent.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider flex items-center space-x-2 truncate">
                       <span>{agent.privatePersona ? agent.privatePersona.substring(0, 30) : (agent.role || '').substring(0, 30)}...</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-1 shrink-0">
                  <button onClick={() => onSelectAgent(agent)} className="p-2 hover:text-[var(--accent)]" title="Chat">
                    <MessageSquare size={16} />
                  </button>
                  <button onClick={() => handleEdit(agent)} className="p-2 hover:text-[var(--accent)]" title="Edit">
                    <Sliders size={16} />
                  </button>
                  <button onClick={() => handleDelete(agent.id)} className="p-2 hover:text-red-500" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-auto pt-4 text-center text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
        {agents.length} / 5 Agents Created
      </div>
    </div>
  );
}

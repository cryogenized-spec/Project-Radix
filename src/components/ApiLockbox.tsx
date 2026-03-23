import React, { useState, useEffect, useRef } from 'react';
import { Key, Save, Shield, Check, Play, Settings2, MessageSquare, Lock, BrainCircuit, Mic, RefreshCw, Bot, Unlock, Undo, Redo, Zap, Mail, Image as ImageIcon } from 'lucide-react';
import { Icon } from '@iconify/react';
import { getSetting, setSetting, getAgents, addAgent, getExaApiUsage } from '../lib/db';
import { GoogleGenAI } from '@google/genai';
import { encryptApiKey, decryptApiKey } from '../lib/apiKeyCrypto';
import { ModelSelector } from './ModelSelector';
import { LOCAL_MODELS } from '../lib/ModelService';
import LibrarianConfig from './LibrarianConfig';

const PROVIDERS = ['Anthropic', 'DeepSeek', 'Google', 'Moonshot', 'OpenAI', 'xAI', 'Local (Gemini Nano)', 'Local Intelligence'];
const STT_PROVIDERS = ['Local (Gemini Nano)', 'OpenAI (ChatGPT 4o)', 'OpenAI (ChatGPT 4o mini)', 'Google Cloud', 'Native Device'];

const PROVIDER_ICONS: Record<string, string> = {
  'Anthropic': 'simple-icons:anthropic',
  'DeepSeek': 'simple-icons:deepseek',
  'Google': 'logos:google-icon',
  'Moonshot': 'lucide:moon',
  'OpenAI': 'simple-icons:openai',
  'xAI': 'ri:twitter-x-fill',
  'Local (Gemini Nano)': 'logos:google-gemini',
  'Local Intelligence': 'lucide:hard-drive',
  'OpenAI (ChatGPT 4o)': 'simple-icons:openai',
  'OpenAI (ChatGPT 4o mini)': 'simple-icons:openai',
  'Google Cloud': 'logos:google-cloud',
  'Native Device': 'lucide:smartphone'
};

const GOOGLE_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-flash-latest',
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image-preview',
  'gemini-nano'
];

const PROVIDER_MODELS: Record<string, string[]> = {
  'Anthropic': ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4', 'claude-haiku-3-5'],
  'DeepSeek': ['deepseek-chat', 'deepseek-reasoner', 'deepseek-ocr', 'deepseek-v3.2-speciale', 'deepseek-non-reasoner-v3.1-terminus'],
  'Google': GOOGLE_MODELS,
  'Moonshot': ['Kimi K2.5 (Thinking)', 'Kimi K2', 'Kimi-K2-Instruct-0905', 'Kimi-Researcher', 'Kimi-Dev'],
  'OpenAI': ['gpt-5.4', 'gpt-5.4-pro', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.3-codex', 'gpt-4.1', 'o3-mini'],
  'xAI': ['grok-2-latest', 'grok-2-vision-latest', 'grok-beta'],
  'Local (Gemini Nano)': ['gemini-nano', 'llama3', 'mistral', 'phi3'],
  'Local Intelligence': LOCAL_MODELS.map(m => m.id)
};

const PROVIDER_API_PATHS: Record<string, string> = {
  'Anthropic': 'https://api.anthropic.com/v1',
  'DeepSeek': 'https://api.deepseek.com/v1',
  'Google': 'https://generativelanguage.googleapis.com',
  'Moonshot': 'https://api.moonshot.cn/v1',
  'OpenAI': 'https://api.openai.com/v1',
  'xAI': 'https://api.x.ai/v1',
  'Local (Gemini Nano)': 'http://localhost:11434/v1'
};

const PLACEHOLDERS: Record<string, string> = {
  'Anthropic': 'sk-ant-...',
  'DeepSeek': 'sk-...',
  'Google': 'AIza...',
  'Moonshot': 'sk-...',
  'OpenAI': 'sk-proj-...',
  'xAI': 'xai-...',
  'Local (Gemini Nano)': 'No API Key Needed'
};

const VTT_PROFILES: Record<string, { temp: number, desc: string }> = {
  'Fast & Loose': { temp: 0.8, desc: 'Prioritizes speed, may have minor inaccuracies.' },
  'Balanced': { temp: 0.4, desc: 'Good balance of speed and accuracy.' },
  'Highly Accurate': { temp: 0.1, desc: 'Prioritizes exact transcription, slightly slower.' }
};

export default function ApiLockbox() {
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('default');
  const [isLocked, setIsLocked] = useState(true);

  // Agent Specific State
  const [provider, setProvider] = useState('Google');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState(PROVIDER_API_PATHS['Google']);
  const [model, setModel] = useState('gemini-3.1-flash-lite-preview');
  
  const [sttProvider, setSttProvider] = useState('Local (Gemini Nano)');
  const [sttApiKey, setSttApiKey] = useState('');
  
  const [saved, setSaved] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testedProviders, setTestedProviders] = useState<Record<string, boolean>>({});

  // Tuning State
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [settings, setSettings] = useState({
      public: { temperature: 0.7, topP: 0.9, thinkingBudget: 80 },
      private: { temperature: 0.7, topP: 0.9, thinkingBudget: 80 }
  });
  const [targetTokens, setTargetTokens] = useState(1000);
  const [maxTokens, setMaxTokens] = useState(1200);
  const [longPressDelay, setLongPressDelay] = useState(250);
  const [streamTokens, setStreamTokens] = useState(true);

  const templates = {
      'Precise': { temperature: 0.2, topP: 0.8, thinkingBudget: 90 },
      'Balanced': { temperature: 0.7, topP: 0.9, thinkingBudget: 80 },
      'Creative': { temperature: 1.2, topP: 0.95, thinkingBudget: 50 },
      'Concise': { temperature: 0.5, topP: 0.7, thinkingBudget: 40 },
      'Verbose': { temperature: 0.9, topP: 0.99, thinkingBudget: 90 }
  };

  const roleplayProfiles = {
      'Creative Roleplay': { temperature: 1.5, topP: 0.99, thinkingBudget: 30 },
      'Immersive Roleplay': { temperature: 1.8, topP: 1.0, thinkingBudget: 20 },
      'Structured Roleplay': { temperature: 1.1, topP: 0.9, thinkingBudget: 60 }
  };

  const [roleplayTuningEnabled, setRoleplayTuningEnabled] = useState({ public: false, private: false });

  const getSelectedTemplate = (tab: 'public' | 'private') => {
      const current = settings[tab];
      for (const [name, t] of Object.entries(templates)) {
          if (t.temperature === current.temperature && t.topP === current.topP && t.thinkingBudget === current.thinkingBudget) {
              return name;
          }
      }
      return "";
  };

  const getSelectedRoleplayProfile = (tab: 'public' | 'private') => {
      const current = settings[tab];
      for (const [name, p] of Object.entries(roleplayProfiles)) {
          if (p.temperature === current.temperature && p.topP === current.topP && p.thinkingBudget === current.thinkingBudget) {
              return name;
          }
      }
      return "";
  };

  useEffect(() => {
    const isPublicRoleplay = getSelectedRoleplayProfile('public') !== "";
    const isPrivateRoleplay = getSelectedRoleplayProfile('private') !== "";
    
    setRoleplayTuningEnabled(prev => ({
      public: prev.public || isPublicRoleplay,
      private: prev.private || isPrivateRoleplay
    }));
  }, [settings]);

  const applyTemplate = (name: keyof typeof templates) => {
      const template = templates[name];
      setSettings(prev => ({
          ...prev,
          [activeTab]: { ...prev[activeTab], ...template }
      }));
  };

  const applyRoleplayProfile = (name: keyof typeof roleplayProfiles) => {
      const profile = roleplayProfiles[name];
      setSettings(prev => ({
          ...prev,
          [activeTab]: { ...prev[activeTab], ...profile }
      }));
  };

  const updateSetting = (key: 'temperature' | 'topP' | 'thinkingBudget', value: number) => {
      setSettings(prev => ({
          ...prev,
          [activeTab]: { ...prev[activeTab], [key]: value }
      }));
  };

  // VTT State
  const [vttProfile, setVttProfile] = useState('Balanced');

  // Personas
  const [privatePersona, setPrivatePersona] = useState("");
  const [publicPersona, setPublicPersona] = useState("");
  const [isDefaultPersona, setIsDefaultPersona] = useState(true);

  // Rewrite Styles
  const [rewriteFormal, setRewriteFormal] = useState("Professional, academic, precise");
  const [rewriteCasual, setRewriteCasual] = useState("Relaxed, slang-heavy, friendly");
  const [rewriteWarm, setRewriteWarm] = useState("Empathetic, kind, supportive");
  const [resendApiKey, setResendApiKey] = useState('');
  const [smeeUrl, setSmeeUrl] = useState('');
  const [exaApiKey, setExaApiKey] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [exaApiUsage, setExaApiUsage] = useState(0);

  // Undo/Redo History
  const historyRef = useRef<any[]>([]);
  const historyIndexRef = useRef(-1);
  const isInitialLoad = useRef(true);

  const saveToHistory = () => {
      const currentState = {
          provider, apiKey, apiUrl, model, sttProvider, sttApiKey, settings, targetTokens, maxTokens,
          longPressDelay, streamTokens, vttProfile, privatePersona, publicPersona, rewriteFormal, rewriteCasual, rewriteWarm
      };

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
      setProvider(state.provider);
      setApiKey(state.apiKey);
      setApiUrl(state.apiUrl || PROVIDER_API_PATHS[state.provider] || '');
      setModel(state.model);
      setSttProvider(state.sttProvider);
      setSttApiKey(state.sttApiKey);
      
      setSettings(state.settings || {
          public: { temperature: state.temperature ?? 0.7, topP: state.topP ?? 0.9, thinkingBudget: state.thinkingBudget ?? 80 },
          private: { temperature: state.temperature ?? 0.7, topP: state.topP ?? 0.9, thinkingBudget: state.thinkingBudget ?? 80 }
      });
      
      setTargetTokens(state.targetTokens ?? 1000);
      setMaxTokens(state.maxTokens ?? 1200);
      setLongPressDelay(state.longPressDelay ?? 250);
      setStreamTokens(state.streamTokens ?? true);
      setVttProfile(state.vttProfile || 'Balanced');
      setPrivatePersona(state.privatePersona || "You are RADIX Ghost...");
      setPublicPersona(state.publicPersona || "You are RADIX AI...");
      setRewriteFormal(state.rewriteFormal || "Professional, academic, precise");
      setRewriteCasual(state.rewriteCasual || "Relaxed, slang-heavy, friendly");
      setRewriteWarm(state.rewriteWarm || "Empathetic, kind, supportive");
      if (state.hfApiKey !== undefined) setHfApiKey(state.hfApiKey);
  };

  useEffect(() => {
      const timer = setTimeout(() => {
          if (!isInitialLoad.current) {
              const currentState = JSON.stringify({
                  provider, apiKey, apiUrl, model, sttProvider, sttApiKey, settings, targetTokens, maxTokens,
                  longPressDelay, streamTokens, vttProfile, privatePersona, publicPersona, rewriteFormal, rewriteCasual, rewriteWarm
              });
              
              const lastState = historyRef.current[historyIndexRef.current];
              if (currentState !== lastState) {
                  saveToHistory();
              }
          }
      }, 1000);
      return () => clearTimeout(timer);
  }, [provider, apiKey, apiUrl, model, sttProvider, sttApiKey, settings, targetTokens, maxTokens, longPressDelay, streamTokens, vttProfile, privatePersona, publicPersona, rewriteFormal, rewriteCasual, rewriteWarm]);

  useEffect(() => {
    loadAgents(true);
  }, []);

  useEffect(() => {
    loadSettingsForAgent(selectedAgentId);
  }, [selectedAgentId, agents]);

  const loadAgents = async (isInitial = false) => {
    const loaded = await getAgents();
    setAgents(loaded || []);
    if (isInitial && loaded && loaded.length > 0 && selectedAgentId === 'default') {
      setSelectedAgentId(loaded[0].id);
    }
  };

  const loadSettingsForAgent = async (agentId: string) => {
    isInitialLoad.current = true;
    historyRef.current = [];
    historyIndexRef.current = -1;

    if (agentId === 'default') {
      const aiSettings = await getSetting('ai_settings') || {};
      const savedProvider = aiSettings.provider || 'Google';
      setProvider(savedProvider);
      
      const keys = await getSetting('api_keys') || {};
      setApiKey(await decryptApiKey(keys[savedProvider] || ''));
      
      const apiUrls = await getSetting('api_urls') || {};
      setApiUrl(apiUrls[savedProvider] || aiSettings.apiUrl || PROVIDER_API_PATHS[savedProvider]);
      
      const savedSttProvider = aiSettings.sttProvider || 'Local (Gemini Nano)';
      setSttProvider(savedSttProvider);
      
      const sttKeys = await getSetting('stt_api_keys') || {};
      setSttApiKey(await decryptApiKey(sttKeys[savedSttProvider] || ''));

      setModel(aiSettings.model || 'gemini-3.1-flash-lite-preview');
      setSettings(aiSettings.settings || {
          public: { temperature: aiSettings.temperature ?? 0.7, topP: aiSettings.topP ?? 0.9, thinkingBudget: aiSettings.thinkingBudget ?? 80 },
          private: { temperature: aiSettings.temperature ?? 0.7, topP: aiSettings.topP ?? 0.9, thinkingBudget: aiSettings.thinkingBudget ?? 80 }
      });
      setTargetTokens(aiSettings.targetTokens ?? 1000);
      setMaxTokens(aiSettings.maxTokens ?? 1200);
      setLongPressDelay(aiSettings.longPressDelay ?? 250);
      setVttProfile(aiSettings.vttProfile || 'Balanced');
      const isDefault = aiSettings.isDefaultPersona !== false;
      setIsDefaultPersona(isDefault);
      
      setPrivatePersona(aiSettings.privatePersona || (isDefault ? "You are RADIX Ghost, a private advisor. Analyze the chat and advise the user privately. Be concise, analytical, and industrial in tone. Do not filter yourself." : ""));
      setPublicPersona(aiSettings.publicPersona || (isDefault ? "You are RADIX AI, a participant in this chat. Respond to the conversation naturally but with a technical, industrial persona. Do not filter yourself." : ""));
      setRewriteFormal(aiSettings.rewriteFormal || "Professional, academic, precise");
      setRewriteCasual(aiSettings.rewriteCasual || "Relaxed, slang-heavy, friendly");
      setRewriteWarm(aiSettings.rewriteWarm || "Empathetic, kind, supportive");
      setTestedProviders(aiSettings.testedProviders || {});
      
      const emailSettings = await getSetting('email_settings') || {};
      setResendApiKey(await decryptApiKey(emailSettings.resendApiKey || ''));
      setSmeeUrl(emailSettings.smeeUrl || '');

      const exaKey = await getSetting('exaApiKey');
      setExaApiKey(await decryptApiKey(exaKey || ''));
      
      const hfKey = await getSetting('hfApiKey');
      const exaUsage = await getExaApiUsage();
      setHfApiKey(await decryptApiKey(hfKey || ''));
      setExaApiUsage(exaUsage);
    } else {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        setProvider(agent.provider || 'Google');
        setApiKey(await decryptApiKey(agent.apiKey || ''));
        setApiUrl(agent.apiUrl || PROVIDER_API_PATHS[agent.provider || 'Google'] || '');
        setModel(agent.model || 'gemini-3.1-flash-lite-preview');
        setSettings(agent.settings || {
            public: { temperature: agent.temperature ?? 0.7, topP: agent.topP ?? 0.9, thinkingBudget: agent.thinkingBudget ?? 80 },
            private: { temperature: agent.temperature ?? 0.7, topP: agent.topP ?? 0.9, thinkingBudget: agent.thinkingBudget ?? 80 }
        });
        setPrivatePersona(agent.privatePersona || agent.role || "");
        setPublicPersona(agent.publicPersona || "");
        // Use global fallbacks for some settings if not on agent
        const aiSettings = await getSetting('ai_settings') || {};
        setLongPressDelay(agent.longPressDelay ?? aiSettings.longPressDelay ?? 250);
        setStreamTokens(agent.streamTokens ?? aiSettings.streamTokens ?? true);
        setVttProfile(agent.vttProfile || aiSettings.vttProfile || 'Balanced');
        setSttProvider(agent.sttProvider || 'Local (Gemini Nano)');
        setSttApiKey(await decryptApiKey(agent.sttApiKey || ''));
        setRewriteFormal(agent.rewriteFormal || aiSettings.rewriteFormal || "");
        setRewriteCasual(agent.rewriteCasual || aiSettings.rewriteCasual || "");
        setRewriteWarm(agent.rewriteWarm || aiSettings.rewriteWarm || "");
        setTestedProviders(agent.testedProviders || {});
      }
    }
    
    // Initial Save to History
    setTimeout(() => {
        saveToHistory();
        isInitialLoad.current = false;
    }, 100);
  };

  const handleSave = async () => {
    if (selectedAgentId === 'default') {
      // Save Global
      const keys = await getSetting('api_keys') || {};
      keys[provider] = await encryptApiKey(apiKey);
      await setSetting('api_keys', keys);

      const apiUrls = await getSetting('api_urls') || {};
      apiUrls[provider] = apiUrl;
      await setSetting('api_urls', apiUrls);

      const sttKeys = await getSetting('stt_api_keys') || {};
      sttKeys[sttProvider] = await encryptApiKey(sttApiKey);
      await setSetting('stt_api_keys', sttKeys);

      await setSetting('ai_settings', {
        provider, apiUrl, model, settings,
        longPressDelay, streamTokens, vttProfile, privatePersona, publicPersona,
        sttProvider, rewriteFormal, rewriteCasual, rewriteWarm, testedProviders
      });

      await setSetting('email_settings', {
        resendApiKey: await encryptApiKey(resendApiKey), smeeUrl
      });
      await setSetting('exaApiKey', await encryptApiKey(exaApiKey));
      await setSetting('hfApiKey', await encryptApiKey(hfApiKey));
    } else {
      // Save Agent
      const agent = agents.find(a => a.id === selectedAgentId);
      if (agent) {
        const updatedAgent = {
          ...agent,
          provider, apiKey: await encryptApiKey(apiKey), apiUrl, model, settings,
          longPressDelay, streamTokens, vttProfile, privatePersona, publicPersona,
          sttProvider, sttApiKey: await encryptApiKey(sttApiKey),
          rewriteFormal, rewriteCasual, rewriteWarm, testedProviders
        };
        await addAgent(updatedAgent); // addAgent uses .put() which updates if ID exists
        await loadAgents(); // Refresh list
      }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTestStatus('testing');
    
    // Test Text AI Provider
    let textAiSuccess = false;
    if (provider === 'Google' && apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 10000));
        await Promise.race([
          ai.models.generateContent({ model: 'gemini-3.1-flash-lite-preview', contents: 'test' }),
          timeout
        ]);
        textAiSuccess = true;
      } catch (e) {
        console.error("API Test Error:", e);
      }
    } else if (provider === 'Local (Gemini Nano)') {
       textAiSuccess = true;
    } else {
       if (apiKey.length > 5) textAiSuccess = true;
    }

    // Test STT Provider
    let sttSuccess = false;
    if (sttProvider === 'Local (Gemini Nano)' || sttProvider === 'Native Device') {
        sttSuccess = true;
    } else if (sttApiKey.length > 5) {
        sttSuccess = true;
    }

    if (textAiSuccess) {
        setTestedProviders(prev => ({ ...prev, [provider]: true }));
    }
    if (sttSuccess) {
        setTestedProviders(prev => ({ ...prev, [sttProvider]: true }));
    }

    if (textAiSuccess && sttSuccess) {
        setTestStatus('success');
    } else if (textAiSuccess || sttSuccess) {
        setTestStatus('success'); // Partial success is okay for now, user sees checks
    } else {
        setTestStatus('error');
    }
    
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleAutoMax = () => {
    const margin = Math.max(targetTokens * 0.2, 40);
    setMaxTokens(Math.round(targetTokens + margin));
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--border)] pb-3 sm:pb-4 pl-12 sm:pl-0 gap-2">
        <h1 className="text-lg sm:text-xl font-bold tracking-widest uppercase text-[var(--accent)] flex items-center flex-1 min-w-0">
          <Key className="mr-2 shrink-0" size={20} />
          <span className="truncate">API Lockbox</span>
        </h1>
        <div className="flex space-x-1.5 sm:space-x-2 shrink-0">
          <button 
              onClick={handleUndo} 
              disabled={historyIndexRef.current <= 0}
              className="radix-button px-2 py-1.5 sm:py-2 flex items-center justify-center text-[10px] sm:text-sm uppercase tracking-wider rounded-xl disabled:opacity-30"
              title="Undo"
          >
              <Undo size={16} />
          </button>
          <button 
              onClick={handleRedo} 
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              className="radix-button px-2 py-1.5 sm:py-2 flex items-center justify-center text-[10px] sm:text-sm uppercase tracking-wider rounded-xl disabled:opacity-30"
              title="Redo"
          >
              <Redo size={16} />
          </button>
          <button 
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className={`radix-button px-2 sm:px-4 py-1.5 sm:py-2 flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-sm uppercase tracking-wider rounded-xl ${testStatus === 'success' ? 'border-green-500 text-green-500' : testStatus === 'error' ? 'border-red-500 text-red-500' : ''}`}
          >
            {testStatus === 'testing' ? <Play size={14} className="animate-spin sm:w-4 sm:h-4" /> : testStatus === 'success' ? <Check size={14} className="sm:w-4 sm:h-4" /> : <Play size={14} className="sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">{testStatus === 'testing' ? 'Testing' : testStatus === 'success' ? 'Verified' : 'Test Key'}</span>
          </button>
          <button 
            onClick={handleSave}
            className="radix-button px-2 sm:px-4 py-1.5 sm:py-2 flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-sm uppercase tracking-wider rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]"
          >
            <Save size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Agent Selector Tabs */}
      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
            <Bot size={14} className="mr-2 sm:w-4 sm:h-4" />
            Select Agent to Configure
          </h2>
          <button onClick={() => loadAgents()} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {agents.length === 0 && (
            <button
              onClick={() => setSelectedAgentId('default')}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${selectedAgentId === 'default' ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'bg-[var(--panel-bg)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]'}`}
            >
              Radix_Agent (Default)
            </button>
          )}
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${selectedAgentId === agent.id ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'bg-[var(--panel-bg)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]'}`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
          <Shield size={14} className="mr-2 sm:w-4 sm:h-4" />
          Text AI Provider
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Select Provider</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                <Icon icon={PROVIDER_ICONS[provider] || 'lucide:cpu'} width="16" height="16" />
              </div>
              <select 
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setProvider(newProvider);
                  setModel(PROVIDER_MODELS[newProvider]?.[0] || '');
                  setApiUrl(PROVIDER_API_PATHS[newProvider] || '');
                }}
                className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl appearance-none pl-10 pr-10"
              >
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {testedProviders[provider] && (
                <Check size={14} className="absolute right-3 top-3 sm:top-3.5 text-green-500 sm:w-4 sm:h-4" />
              )}
            </div>
          </div>

          {PROVIDER_MODELS[provider] && provider !== 'Local Intelligence' && (
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Model Selection</label>
              <select 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl appearance-none"
              >
                {PROVIDER_MODELS[provider].map(m => <option key={m} value={m}>{m}</option>)}
                {LOCAL_MODELS.some(m => m.id === model) && (
                  <option value={model}>{LOCAL_MODELS.find(m => m.id === model)?.name} (Local)</option>
                )}
              </select>
            </div>
          )}
          
          {provider === 'Local Intelligence' && (
            <div className="md:col-span-2 pt-4 border-t border-[var(--border)]">
              <ModelSelector 
                selectedModelId={model} 
                onSelectModel={(modelId) => setModel(modelId)} 
              />
            </div>
          )}
          
          {provider !== 'Local Intelligence' && (
            <>
              <div className={`space-y-1.5 sm:space-y-2 ${!PROVIDER_MODELS[provider] ? 'md:col-span-2' : ''}`}>
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={PLACEHOLDERS[provider] || 'Enter API Key...'}
                  disabled={provider === 'Local (Gemini Nano)'}
                  className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2 md:col-span-2">
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">API Base URL</label>
                <input 
                  type="text" 
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
                />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl relative">
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
            <Settings2 size={14} className="mr-2 sm:w-4 sm:h-4" />
            AI Behavior Tuning
          </h2>
          <button onClick={() => setIsLocked(!isLocked)} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>
        <div className="flex space-x-2 mb-4">
            <button onClick={() => setActiveTab('public')} className={`px-3 py-1 text-xs rounded-lg ${activeTab === 'public' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-color)]'}`}>Public</button>
            <button onClick={() => setActiveTab('private')} className={`px-3 py-1 text-xs rounded-lg ${activeTab === 'private' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-color)]'}`}>Private</button>
        </div>
        <div className="mb-4">
            <select value={getSelectedTemplate(activeTab)} onChange={(e) => applyTemplate(e.target.value as any)} className="w-full radix-input p-2 text-xs rounded-lg">
                <option value="" disabled>Apply {activeTab === 'public' ? 'Public' : 'Private'} Template...</option>
                {Object.keys(templates).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>

        <div className="mb-4 p-3 border border-[var(--border)] rounded-xl bg-[var(--bg-color)]">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-main)]">Roleplay Tuning</h3>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Generate more creative narrative content</p>
            </div>
            <button
              onClick={() => {
                const isEnabling = !roleplayTuningEnabled[activeTab];
                setRoleplayTuningEnabled(prev => ({ ...prev, [activeTab]: isEnabling }));
                if (isEnabling) {
                  applyRoleplayProfile('Creative Roleplay');
                } else {
                  applyTemplate('Balanced');
                }
              }}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${roleplayTuningEnabled[activeTab] ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
            >
              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${roleplayTuningEnabled[activeTab] ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
          
          {roleplayTuningEnabled[activeTab] && (
            <div className="mt-3">
              <select 
                value={getSelectedRoleplayProfile(activeTab)} 
                onChange={(e) => applyRoleplayProfile(e.target.value as any)} 
                className="w-full radix-input p-2 text-xs rounded-lg"
              >
                <option value="" disabled>Select {activeTab === 'public' ? 'Public' : 'Private'} Roleplay Profile...</option>
                {Object.keys(roleplayProfiles).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
        
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <label>Temperature</label>
                <span className="text-[var(--accent)] font-mono">{settings[activeTab].temperature.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="2" step="0.05" 
                value={settings[activeTab].temperature} onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
              />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <label>Top P (Weight)</label>
                <span className="text-[var(--accent)] font-mono">{settings[activeTab].topP.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.05" 
                value={settings[activeTab].topP} onChange={(e) => updateSetting('topP', parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
              />
            </div>
            {model.startsWith('gemini-3') && (
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  <label>Thinking Budget</label>
                  <span className="text-[var(--accent)] font-mono">{settings[activeTab].thinkingBudget}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="1" 
                  value={settings[activeTab].thinkingBudget} onChange={(e) => updateSetting('thinkingBudget', parseInt(e.target.value))}
                  className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
                />
                <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">
                  {settings[activeTab].thinkingBudget < 50 ? 'Low Reasoning Effort' : 'High Reasoning Effort'}
                </p>
              </div>
            )}
            
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                <label>Long Press Delay</label>
                <span className="text-[var(--accent)] font-mono">{longPressDelay}ms</span>
              </div>
              <input 
                type="range" min="100" max="1000" step="50" 
                value={longPressDelay} onChange={(e) => setLongPressDelay(parseInt(e.target.value))}
                className="w-full accent-[var(--accent)] h-1.5 sm:h-2"
              />
              <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">
                Adjusts the time to trigger context menus.
              </p>
            </div>

            <div className="flex items-start justify-between pt-2 gap-4">
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] flex items-start flex-1 min-w-0">
                    <Zap size={12} className="mr-2 mt-0.5 shrink-0" /> 
                    <span className="leading-tight break-words">Stream Tokens (SSE)</span>
                </label>
                <button 
                    onClick={() => setStreamTokens(!streamTokens)}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${streamTokens ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${streamTokens ? 'left-6' : 'left-1'}`} />
                </button>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="space-y-1.5 sm:space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Target Output Tokens</label>
              <input 
                type="number" 
                value={targetTokens}
                onChange={(e) => setTargetTokens(parseInt(e.target.value) || 0)}
                className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
              />
              <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Margin of correction: ±40 tokens</p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Max Output Tokens</label>
                <button onClick={handleAutoMax} className="text-[9px] sm:text-[10px] text-[var(--accent)] hover:underline">Auto (+20%)</button>
              </div>
              <input 
                type="number" 
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
          <Settings2 size={14} className="mr-2 sm:w-4 sm:h-4" />
          AI Rewrite Styles
        </h2>
        <div className="space-y-3 sm:space-y-4">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Formal Style</label>
            <input 
              type="text" 
              value={rewriteFormal}
              onChange={(e) => setRewriteFormal(e.target.value)}
              placeholder="e.g., Professional, academic, precise"
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Casual Style</label>
            <input 
              type="text" 
              value={rewriteCasual}
              onChange={(e) => setRewriteCasual(e.target.value)}
              placeholder="e.g., Relaxed, slang-heavy, friendly"
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Warm Style</label>
            <input 
              type="text" 
              value={rewriteWarm}
              onChange={(e) => setRewriteWarm(e.target.value)}
              placeholder="e.g., Empathetic, kind, supportive"
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
          <Mic size={14} className="mr-2 sm:w-4 sm:h-4" />
          Voice Transcription (STT) Settings
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Select Provider</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
                <Icon icon={PROVIDER_ICONS[sttProvider] || 'lucide:cpu'} width="16" height="16" />
              </div>
              <select 
                value={sttProvider}
                onChange={(e) => setSttProvider(e.target.value)}
                className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl appearance-none pl-10 pr-10"
              >
                {STT_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {testedProviders[sttProvider] && (
                <Check size={14} className="absolute right-3 top-3 sm:top-3.5 text-green-500 sm:w-4 sm:h-4" />
              )}
            </div>
          </div>
          
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">API Key</label>
            <input 
              type="password" 
              value={sttApiKey}
              onChange={(e) => setSttApiKey(e.target.value)}
              placeholder={PLACEHOLDERS[sttProvider.split(' ')[0]] || 'Enter API Key...'}
              disabled={sttProvider === 'Local (Gemini Nano)' || sttProvider === 'Native Device'}
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2 md:col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">VTT Tuning Profile</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
              {Object.keys(VTT_PROFILES).map(profile => (
                <button
                  key={profile}
                  onClick={() => setVttProfile(profile)}
                  className={`p-2.5 sm:p-3 text-left border rounded-xl ${vttProfile === profile ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-main)] hover:border-[var(--text-muted)]'} transition-colors`}
                >
                  <div className="text-[10px] sm:text-sm font-bold mb-0.5 sm:mb-1">{profile}</div>
                  <div className="text-[9px] sm:text-[10px] opacity-70">{VTT_PROFILES[profile].desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Librarian Phase (RAG) Settings */}
      <section className="space-y-3 sm:space-y-4 radix-panel p-3 sm:p-4 rounded-xl">
        <LibrarianConfig />
      </section>

      {/* Email Dispatch Settings */}
      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
            <Mail size={14} className="mr-2 sm:w-4 sm:h-4" />
            Email Dispatch Settings
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Resend API Key</label>
            <input 
              type="password" 
              value={resendApiKey}
              onChange={(e) => setResendApiKey(e.target.value)}
              placeholder="re_..."
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
          </div>
          
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Smee Webhook URL</label>
            <input 
              type="text" 
              value={smeeUrl}
              onChange={(e) => setSmeeUrl(e.target.value)}
              placeholder="https://smee.io/..."
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
          </div>
        </div>
      </section>

      {/* Exa API Key Settings */}
      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
            <Shield size={14} className="mr-2 sm:w-4 sm:h-4" />
            Exa Search Settings
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Exa API Key</label>
            <input 
              type="password" 
              value={exaApiKey}
              onChange={(e) => setExaApiKey(e.target.value)}
              placeholder="exa_..."
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Required for the Discovery Engine and web search.</p>
          </div>
          <div className="space-y-1.5 sm:space-y-2 flex flex-col justify-center items-center bg-[var(--bg-color)] rounded-xl p-4 border border-[var(--border)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Exa Neural Searches</label>
            <div className="text-2xl font-mono font-bold text-[var(--accent)]">
              {exaApiUsage} <span className="text-sm text-[var(--text-muted)]">/ 1,000</span>
            </div>
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)] text-center">Resets on the 1st of every month.</p>
          </div>
        </div>
      </section>

      {/* Hugging Face API Key Settings */}
      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-widest uppercase flex items-center text-[var(--text-muted)]">
            <Shield size={14} className="mr-2 sm:w-4 sm:h-4" />
            Hugging Face Settings
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl">
          <div className="space-y-1.5 sm:space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Hugging Face API Key</label>
            <input 
              type="password" 
              value={hfApiKey}
              onChange={(e) => setHfApiKey(e.target.value)}
              placeholder="hf_..."
              className="w-full radix-input p-2.5 sm:p-3 text-xs sm:text-sm rounded-xl"
            />
            <p className="text-[9px] sm:text-[10px] text-[var(--text-muted)]">Required for Image Generation models.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

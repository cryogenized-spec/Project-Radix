import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RadixIcon } from './RadixIcon';
import { Send, Mic, Image as ImageIcon, Paperclip, Ghost, Bot, Square, Play, Maximize2, Minimize2, Activity, Video, FileText, Music, MapPin, Users, BarChart2, X, MoreVertical, Trash2, Reply, Share2, Languages, PenTool, CheckCircle, Plus, Hash, MessageSquare, Shield, Globe, Lock, ChevronLeft, ChevronRight, ScanLine, QrCode, Copy, ExternalLink, Headphones, UserPlus, Check, Loader2, Calendar, Wand2, Monitor, RotateCcw } from 'lucide-react';
import { addMessage, getMessages, getSetting, setSetting, deleteMessage, addThread, getThreads, addGroup, getGroups, getContacts, addContact, getAgents, getStorageStats, evictOldMedia } from '../lib/db';
import { generateAIResponse, generateAIResponseStream, transcribeAudio, generateRewrite, generateFactCheck, generateTranslation, generateVisualAnalysis } from '../lib/gemini';
import { EMAIL_TOOLS, emailToolsHandler } from '../lib/emailTools';
import { p2pService } from '../lib/p2p';
import { translationService, LANGUAGES } from '../lib/translation';
import { injectGoogleFont } from '../lib/fonts';
import { getFileIndex } from '../lib/db';
import { fsManager } from '../lib/filesystem';
import { registerBackHandler } from '../lib/backButton';
import MountModal from './filesystem/MountModal';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CodeScanner } from './CodeScanner';
import VoiceNotePlayer from './VoiceNotePlayer';
import InstallPWA from './InstallPWA';
import DraggableFab from './DraggableFab';
import { ChannelList, ChannelView, Channel } from './Channels';
import { useAvifEncoder } from '../hooks/useAvifEncoder';
import { transcodeVideoToAV1 } from '../lib/transcode';
import ImageGenOverlay from './ImageGenOverlay';

const MemoizedMessageList = React.memo(
  ({ renderMessages, deps }: { renderMessages: () => React.ReactNode, deps: any[] }) => {
    return <>{renderMessages()}</>;
  },
  (prevProps, nextProps) => {
    if (prevProps.deps.length !== nextProps.deps.length) return false;
    for (let i = 0; i < prevProps.deps.length; i++) {
      if (prevProps.deps[i] !== nextProps.deps[i]) return false;
    }
    return true;
  }
);

export default React.memo(function Chat({ profile, isAiExclusive, initialAgent, onBack, onEditAgent }: { profile: any, isAiExclusive?: boolean, initialAgent?: any, onBack?: () => void, onEditAgent?: (id: string) => void }) {
  // Navigation State
  const [viewMode, setViewMode] = useState<'list' | 'chat'>('list');
  const [activeTab, setActiveTab] = useState<'chats' | 'groups' | 'channels'>('chats');
  const [activeContext, setActiveContext] = useState<any>(null); // The active thread/group/chat object

  // Data State
  const [messages, setMessages] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  
  // Chat State
  const [input, setInput] = useState('');
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [aiMode, setAiMode] = useState<'none' | 'ghost' | 'participant'>(isAiExclusive ? 'participant' : 'none');
  const { encodeImage } = useAvifEncoder();

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  const [mediaQuality, setMediaQuality] = useState<'720p' | '1080p' | 'original'>('720p');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<boolean>(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'voice' | 'vtt'>('voice');
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [micError, setMicError] = useState('');
  const [noSpeechDetected, setNoSpeechDetected] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [aiSettings, setAiSettings] = useState<any>({});
  
  const [sttError, setSttError] = useState<{ error: string, blob: Blob } | null>(null);
  
  // UI State
  const [showInputMenu, setShowInputMenu] = useState(false);
  const [inputMenuLevel, setInputMenuLevel] = useState<'root' | 'markdown' | 'ai' | 'tone' | 'write'>('root');
  const [aiToneInput, setAiToneInput] = useState('');
  const [aiWriteInput, setAiWriteInput] = useState('');
  const [isAiInputThinking, setIsAiInputThinking] = useState(false);
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [globalContextMenu, setGlobalContextMenu] = useState(false);
  const [showAiSubmenu, setShowAiSubmenu] = useState(false);
  const [aiActionPrivacy, setAiActionPrivacy] = useState<'public' | 'private'>('public');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);

  const [showSelectionPreview, setShowSelectionPreview] = useState(false);
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    count: number;
    mode: 'batch' | 'single';
    targetId?: string;
  }>({ isOpen: false, count: 0, mode: 'batch' });
  
  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ text: string, type: string, image?: string } | null>(null);
  const [longPressDuration, setLongPressDuration] = useState(250);
  const [textSize, setTextSize] = useState(14);
  const [chatScale, setChatScale] = useState(2.0);

  // Group Creation State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAbout, setNewGroupAbout] = useState('');
  const recordingModeRef = useRef<'voice' | 'vtt'>('voice');
  const [newGroupPrivacy, setNewGroupPrivacy] = useState<'private' | 'public'>('private');
  
  // Reply & Poll State
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollData, setPollData] = useState({ question: '', options: ['', ''], allowMultiple: false });
  const [menuPosition, setMenuPosition] = useState<{x: number, y: number} | null>(null);

  // New Chat / Contact State
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [isAddingContact, setIsAddingContact] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isRequestingMicRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const longPressCoordsRef = useRef<{x: number, y: number} | null>(null);
  const micHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const enterPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const [p2pStatus, setP2pStatus] = useState<'connected' | 'disconnected' | 'error'>('connected');
  const [myPeerId, setMyPeerId] = useState<string>('');
  
  // Translation State
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [showTranslateMenu, setShowTranslateMenu] = useState<string | null>(null);

  // Smart Chip State
  const [showSmartChip, setShowSmartChip] = useState(false);
  const [smartChipFilter, setSmartChipFilter] = useState('');
  const [smartChipType, setSmartChipType] = useState<'root' | 'files' | 'contacts' | 'sys'>('root');
  const [smartChipIndex, setSmartChipIndex] = useState(0);
  const [fileIndex, setFileIndex] = useState<any[]>([]);
  const [showMountModal, setShowMountModal] = useState(false);

  // Image Generation State
  const [showImageGenOverlay, setShowImageGenOverlay] = useState<any | null>(null);

  // Draft Persistence
  useEffect(() => {
    if (activeContext?.id) {
        const draft = localStorage.getItem(`draft_${activeContext.id}`);
        if (draft) setInput(draft);
    } else {
        setInput('');
    }
  }, [activeContext]);

  useEffect(() => {
    const handler = registerBackHandler(() => {
      if (showMountModal) {
        setShowMountModal(false);
        return true;
      }
      if (showNewChatModal) {
        setShowNewChatModal(false);
        return true;
      }
      if (showGroupCreate) {
        setShowGroupCreate(false);
        return true;
      }
      if (showPollModal) {
        setShowPollModal(false);
        return true;
      }
      if (showSelectionPreview) {
        setShowSelectionPreview(false);
        return true;
      }
      if (showAttachMenu) {
        setShowAttachMenu(false);
        return true;
      }
      if (showInputMenu) {
        setShowInputMenu(false);
        setInputMenuLevel('root');
        return true;
      }
      if (showAiSubmenu) {
        setShowAiSubmenu(false);
        return true;
      }
      if (showTranslateMenu) {
        setShowTranslateMenu(null);
        return true;
      }
      if (showSmartChip) {
        setShowSmartChip(false);
        return true;
      }
      if (contextMenuMsgId) {
        setContextMenuMsgId(null);
        return true;
      }
      if (isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedMessageIds([]);
        return true;
      }
      if (replyingTo) {
        setReplyingTo(null);
        return true;
      }
      if (viewMode === 'chat') {
        setViewMode('list');
        setActiveContext(null);
        return true; // Handled
      }
      return false; // Not handled
    });
    return handler;
  }, [
    showMountModal, showNewChatModal, showGroupCreate, showPollModal,
    showSelectionPreview, showAttachMenu, showInputMenu, showAiSubmenu,
    showTranslateMenu, showSmartChip, contextMenuMsgId, isSelectionMode,
    replyingTo, viewMode
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (activeContext?.id) {
            localStorage.setItem(`draft_${activeContext.id}`, input);
        }
    }, 500);
    return () => clearTimeout(timer);
  }, [input, activeContext]);

  useEffect(() => {
    if (showSmartChip && (smartChipType === 'files' || smartChipType === 'sys')) {
      getFileIndex().then(setFileIndex);
    }
  }, [showSmartChip, smartChipType]);

  const handleTranslate = async (messageId: string, text: string, targetLang: string) => {
    setShowTranslateMenu(null);
    setContextMenuMsgId(null);
    
    const idsToTranslate = selectedMessageIds.includes(messageId) ? selectedMessageIds : [messageId];
    
    for (const id of idsToTranslate) {
        const msg = messages.find(m => m.id === id);
        if (!msg || !msg.text) continue;
        
        try {
            const translated = await translationService.translate(msg.text, targetLang);
            setTranslations(prev => ({
                ...prev,
                [id]: translated
            }));
        } catch (e) {
            console.error(`Translation failed for ${id}`, e);
        }
    }
    
    if (idsToTranslate.length > 1) {
        setIsSelectionMode(false);
        setSelectedMessageIds([]);
    }
  };

  useEffect(() => {
    loadSettings();
    loadData();
    
    // Initialize P2P
    const initP2P = async () => {
        try {
            const id = await p2pService.init();
            setMyPeerId(id);
        } catch (err: any) {
            if (err.type === 'unavailable-id') {
                console.warn('Failed to init P2P (ID taken), retrying...');
                // If ID is taken, try again without an ID (p2pService cleared it)
                setTimeout(async () => {
                    try {
                        const newId = await p2pService.init();
                        setMyPeerId(newId);
                    } catch (e) {
                        console.error('Failed to init P2P on retry:', e);
                        setP2pStatus('error');
                    }
                }, 1000);
            } else {
                console.error('Failed to init P2P:', err);
                setP2pStatus('error');
            }
        }
        
        p2pService.on('disconnected', () => {
            setP2pStatus('disconnected');
        });

        p2pService.on('connection', () => {
            setP2pStatus('connected');
        });

        p2pService.on('error', (err: any) => {
            // Only show error if it's not a common connection loss we handle
            const isCommon = err.type === 'network' || err.type === 'disconnected' || (err.message && err.message.includes('Lost connection'));
            if (!isCommon) {
                setP2pStatus('error');
            }
        });

        p2pService.on('message', async (payload: any) => {
            const { sender, data } = payload;
            console.log('Chat received P2P message:', payload);
            
            // Check if we have a contact for this sender
            const contacts = await getSetting('contacts') || [];
            const contact = contacts.find((c: any) => c.id === sender);
            
            // If we are in a chat with this person, add the message to the view
            // Or if it's a new message, maybe show a notification (not implemented yet)
            
            // We need to save the message to DB
            const newMessage = {
                id: crypto.randomUUID(),
                text: data.text || '',
                sender: sender,
                senderName: contact ? contact.name : 'Unknown Peer',
                timestamp: data.timestamp || Date.now(),
                type: data.type || 'text',
                mediaUrl: data.mediaUrl,
                mediaType: data.mediaType,
                font: data.font, // Use sender's font
                isP2P: true,
                threadId: sender // Use sender ID as thread ID for 1-on-1 P2P
            };
            
            // If we don't have a thread for this sender, create one
            const threads = await getThreads();
            let thread = threads.find((t: any) => t.members && t.members.includes(sender));
            
            if (!thread) {
                thread = {
                    id: sender,
                    name: contact ? contact.name : `Peer ${sender.substring(0, 6)}`,
                    type: 'private',
                    members: ['me', sender],
                    createdAt: Date.now(),
                    previewText: newMessage.text
                };
                await addThread(thread);
                setThreads(prev => [thread, ...prev]);
            }
            
            await addMessage(newMessage);
            
            // If this is the active context, update messages state
            if (activeContext && (activeContext.id === sender || (activeContext.members && activeContext.members.includes(sender)))) {
                setMessages(prev => [...prev, newMessage]);
            }
        });
    };
    initP2P();
    
    if (isAiExclusive) {
      setAiMode('participant');
      setActiveTab('chats'); // AI Exclusive is basically a list of AI threads
      
      if (initialAgent) {
        // If an agent is passed, we might want to start a new chat with them or filter by them
        // For now, let's just use their settings
        const instruction = initialAgent.privatePersona || initialAgent.role || initialAgent.systemInstruction;
        
        setAiSettings(prev => ({
          ...prev,
          apiKey: initialAgent.apiKey || prev.apiKey,
          model: initialAgent.model || prev.model,
          systemInstruction: instruction || prev.systemInstruction,
          temperature: initialAgent.temperature ?? prev.temperature,
          maxOutputTokens: initialAgent.maxTokens || initialAgent.thinkingBudget || prev.maxOutputTokens,
          thinkingBudget: initialAgent.thinkingBudget ?? prev.thinkingBudget
        }));
        
        // Create a temporary context or find existing?
        // Let's create a new thread for this session if one doesn't exist, or just use the agent as context
        const agentThread = {
          id: initialAgent.id, // Use agent ID as thread ID for persistent 1-on-1 with agent? Or random?
          name: initialAgent.name,
          isAgent: true,
          agentId: initialAgent.id,
          systemInstruction: instruction
        };
        setActiveContext(agentThread);
        setViewMode('chat');
      }
    }
  }, [isAiExclusive, initialAgent]);

  useEffect(() => {
    if (viewMode === 'chat' && activeContext) {
      loadMessages();
      setCurrentMood(null); // Reset mood when switching chats
    }
  }, [viewMode, activeContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    agents.forEach(agent => {
      if (agent.fontUrl) {
        injectGoogleFont(agent.fontUrl, `agent-font-${agent.id}`);
      }
    });
  }, [agents]);

  useEffect(() => {
    if (activeContext?.isAgent) {
      const agent = agents.find(a => a.id === activeContext.agentId);
      if (agent?.font) {
        document.documentElement.style.setProperty('--agent-font-family', `"${agent.font}", sans-serif`);
      } else {
        document.documentElement.style.removeProperty('--agent-font-family');
      }
    } else {
      document.documentElement.style.removeProperty('--agent-font-family');
    }
  }, [activeContext, agents]);

  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const loadData = async () => {
    const loadedThreads = await getThreads();
    const loadedGroups = await getGroups();
    const loadedAgents = await getAgents();
    setThreads(loadedThreads);
    setGroups(loadedGroups);
    setAgents(loadedAgents);
    setIsDataLoaded(true);
  };

  const loadSettings = async () => {
    const settings = await getSetting('ai_settings') || {};
    const keys = await getSetting('api_keys') || {};
    const sttKeys = await getSetting('stt_api_keys') || {};
    
    // Determine STT Provider and Key
    const sttProvider = settings.sttProvider || 'Local (Gemini Nano)';
    const sttKey = sttKeys[sttProvider] || '';

    setAiSettings({ 
      ...settings, 
      apiKey: keys['Google'], // Default to Google for now as main chat AI
      sttApiKey: sttKey 
    });
    
    const lpd = await getSetting('longPressDuration');
    if (lpd) setLongPressDuration(lpd);

    const ts = await getSetting('textSize');
    if (ts) setTextSize(ts);

    const cs = await getSetting('chatScale');
    if (cs !== undefined) setChatScale(cs);
    else setChatScale(2.0);

    const vq = await getSetting('videoQuality');
    if (vq) setMediaQuality(vq as '720p' | '1080p' | 'original');
  };

  const handleScan = (result: string, type: string, imageData?: string) => {
    setScanResult({ text: result, type, image: imageData });
    setIsScanning(false);
  };

  const handleScanResultAction = async (action: 'link' | 'ai' | 'copy') => {
    if (!scanResult) return;

    if (action === 'link') {
      window.open(scanResult.text, '_blank');
    } else if (action === 'ai') {
      // Create new thread with AI
      const newThread = {
        id: crypto.randomUUID(),
        name: `Scan: ${scanResult.type}`,
        createdAt: Date.now(),
        previewText: `Analyzed scanned content: ${scanResult.text.substring(0, 20)}...`
      };
      await addThread(newThread);
      setThreads(prev => [...prev, newThread]);

      // Add user message with content
      const userMsg = {
        id: crypto.randomUUID(),
        text: `I scanned this ${scanResult.type}:\n\n${scanResult.text}`,
        mediaUrl: scanResult.image,
        mediaType: 'image',
        sender: 'me',
        timestamp: Date.now(),
        threadId: newThread.id,
        type: 'media',
        isAiChat: true
      };
      await addMessage(userMsg);

      // Switch to AI view
      if (!isAiExclusive) {
         alert("Created AI Thread from scan!");
      } else {
         setActiveContext(newThread);
         setViewMode('chat');
      }
    } else if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(scanResult.text);
        
        if (scanResult.image) {
            // Try to copy image as well if possible
            try {
                const res = await fetch(scanResult.image);
                const blob = await res.blob();
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                alert("Text and Image copied to clipboard!");
                setScanResult(null);
                return;
            } catch (err) {
                console.warn("Image copy failed", err);
            }
        }
        alert("Text copied to clipboard!");
      } catch (e) {
        console.error("Copy failed", e);
      }
    }
    setScanResult(null);
  };

  const loadMessages = async () => {
    const msgs = await getMessages();
    let filtered = msgs;

    if (isAiExclusive) {
      // In AI Exclusive mode, we filter by the active thread ID
      if (activeContext) {
        filtered = msgs.filter(m => m.threadId === activeContext.id);
      } else {
        filtered = [];
      }
    } else {
      // In normal mode
      if (activeContext) {
        if (activeTab === 'groups') {
          filtered = msgs.filter(m => m.groupId === activeContext.id);
        } else {
          // 1-on-1 chats (placeholder logic for now, assuming 'main' chat if no specific context)
           filtered = msgs.filter(m => !m.groupId && !m.threadId && !m.isAiChat);
        }
      } else {
         // Default main chat
         filtered = msgs.filter(m => !m.groupId && !m.threadId && !m.isAiChat);
      }
    }
    setMessages(filtered.sort((a, b) => a.timestamp - b.timestamp));
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    
    const newGroup = {
      id: crypto.randomUUID(),
      name: newGroupName,
      about: newGroupAbout,
      privacy: newGroupPrivacy,
      members: ['me'], // Placeholder
      admins: ['me'],
      createdAt: Date.now(),
      slowMode: 0 // 0 = off
    };
    
    await addGroup(newGroup);
    setGroups(prev => [...prev, newGroup]);
    setShowGroupCreate(false);
    setNewGroupName('');
    setNewGroupAbout('');
  };

  const handleAiThreadFromSelection = async () => {
    if (selectedMessageIds.length === 0) return;
    
    const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
    const combinedText = selectedMsgs.map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender}: ${m.text}`).join('\n\n');
    
    const newThread = {
      id: crypto.randomUUID(),
      name: selectedMsgs[0].text.substring(0, 30) + (selectedMsgs[0].text.length > 30 ? '...' : ''),
      createdAt: Date.now(),
      previewText: combinedText.substring(0, 50) + '...'
    };
    
    await addThread(newThread);
    setThreads(prev => [...prev, newThread]);
    
    // Create initial message in thread
    const contextMsg = {
      id: crypto.randomUUID(),
      text: `Context from selected messages:\n\n${combinedText}`,
      sender: 'system',
      timestamp: Date.now(),
      threadId: newThread.id,
      type: 'text',
      isAiChat: true
    };
    await addMessage(contextMsg);
    
    // Switch to AI view and open this thread
    if (!isAiExclusive) {
       alert("Thread created in AI Chat!");
    } else {
       setActiveContext(newThread);
       setViewMode('chat');
    }
    
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
    setShowSelectionPreview(false);
  };

  const toggleMessageSelection = (id: string) => {
    setContextMenuMsgId(null);
    if (selectedMessageIds.includes(id)) {
      setSelectedMessageIds(prev => {
        const newSelection = prev.filter(i => i !== id);
        if (newSelection.length === 0) {
          setIsSelectionMode(false);
        }
        return newSelection;
      });
    } else {
      setSelectedMessageIds(prev => [...prev, id]);
    }
  };

  const handleGlobalLongPress = () => {
    isLongPressTriggeredRef.current = true;
    setGlobalContextMenu(true);
    setContextMenuMsgId(null);
    setShowAiSubmenu(false);
  };

  const handleLongPressMessage = (id: string) => {
    isLongPressTriggeredRef.current = true;
    
    // Show context menu on long press
    setContextMenuMsgId(id);
    setShowAiSubmenu(false);

    // Auto-select the message
    setIsSelectionMode(true);
    if (!selectedMessageIds.includes(id)) {
      setSelectedMessageIds(prev => [...prev, id]);
    }
  };

  const handleSelectMessage = (id: string) => {
    setContextMenuMsgId(null);
    setIsSelectionMode(true);
    setSelectedMessageIds([id]);
  };

  const handleBatchDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedMessageIds.length === 0) return;
    setDeleteConfirmation({
        isOpen: true,
        count: selectedMessageIds.length,
        mode: 'batch'
    });
  };

  const handleDeleteMessage = (id: string) => {
    setDeleteConfirmation({
        isOpen: true,
        count: 1,
        mode: 'single',
        targetId: id
    });
    setContextMenuMsgId(null);
  };

  const performDelete = async () => {
    const { mode, targetId } = deleteConfirmation;
    
    if (mode === 'batch') {
        for (const mId of selectedMessageIds) {
            await deleteMessage(mId);
        }
        setMessages(prev => prev.filter(m => !selectedMessageIds.includes(m.id)));
        setSelectedMessageIds([]);
        setIsSelectionMode(false);
    } else if (mode === 'single' && targetId) {
        await deleteMessage(targetId);
        setMessages(prev => prev.filter(m => m.id !== targetId));
    }
    
    setDeleteConfirmation({ isOpen: false, count: 0, mode: 'batch' });
  };

  const handleSend = async () => {
    if (!input.trim() && !isProcessing) return;
    const font = await getSetting('font') || 'JetBrains Mono';
    const fontColor = await getSetting('fontColor');
    const emoticonPack = await getSetting('emoticonPack') || 'Native OS';

    const newMsg = {
      id: crypto.randomUUID(),
      text: input,
      sender: 'me',
      timestamp: Date.now(),
      type: 'text',
      isAiChat: isAiExclusive,
      threadId: isAiExclusive && activeContext ? activeContext.id : undefined,
      groupId: !isAiExclusive && activeTab === 'groups' && activeContext ? activeContext.id : undefined,
      replyToId: replyingTo ? replyingTo.id : undefined,
      font,
      fontColor,
      emoticonPack
    };

    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setReplyingTo(null);
    setIsExpanded(false);
    await saveAndAddMessage(newMsg);

    if (aiMode !== 'none' || isAiExclusive) {
      setIsProcessing(true);
      const mode = isAiExclusive ? 'participant' : (aiMode as 'ghost' | 'participant');
      
      // Determine AI Identity
      let aiName = 'RADIX_AI';
      let currentAiSettings = { ...aiSettings };

      // Inject Email Tools if triggered
      if (newMsg.text.trim().startsWith('@email')) {
          const contacts = await getContacts();
          const contactList = contacts.map((c: any) => `${c.name} <${c.email || 'no email'}>`).join(', ');
          
          currentAiSettings.tools = EMAIL_TOOLS;
          currentAiSettings.toolExecutor = emailToolsHandler;
          currentAiSettings.systemInstruction = (currentAiSettings.systemInstruction || "") + 
            `\n\n[SYSTEM: Email Tools Enabled. You have access to email_draft, email_send, email_send_direct, email_checkup, and email_read tools. 
            \nAvailable Contacts: ${contactList}
            \nCRITICAL INSTRUCTION FOR ROLEPLAY AND TOOLS:
            \nYou are currently playing a persona, but you MUST actually invoke the provided tools to perform actions like sending emails. 
            \nDO NOT just roleplay or pretend to send an email in plain text. You MUST output a valid structured function call to 'email_draft', 'email_send', or 'email_send_direct'.
            \nYou can separate your roleplay from the tool call. For example, you can output your in-character dialogue, and simultaneously invoke the tool.
            \nIf the user asks you to send an email you previously discussed but didn't actually draft via the tool, you MUST call 'email_send_direct' to send it immediately.
            \nFailure to use the structured tool call will result in the email NOT being sent. Do not hallucinate the action.]`;
      }

      let activeAgent: any = null;
      
      // Check for custom agents
      
      if (activeContext?.isAgent) {
        // We are talking to a specific agent
        aiName = activeContext.name;
        
        // Try to find the agent in the agents list to get the latest instructions
        const agent = agents.find(a => a.id === activeContext.agentId);
        activeAgent = agent;
        
        if (agent) {
             const instruction = agent.privatePersona || agent.role || agent.systemInstruction;
             if (instruction) currentAiSettings.systemInstruction = instruction;
        } else if (activeContext.systemInstruction) {
             currentAiSettings.systemInstruction = activeContext.systemInstruction;
        }
      } else if (agents.length > 0) {
        // Use the pinned agent or first created agent as the default AI
        let defaultAgent = agents.find(a => a.isPrimary || a.isPinned);
        if (!defaultAgent) {
            defaultAgent = agents.sort((a, b) => a.createdAt - b.createdAt)[0];
        }
        aiName = defaultAgent.name;
        activeAgent = defaultAgent;
        
        const instruction = defaultAgent.privatePersona || defaultAgent.role || defaultAgent.systemInstruction;
        if (instruction) {
            currentAiSettings.systemInstruction = instruction;
        }
      }

      // Inject Roleplay and Mood Instructions
      if (activeAgent) {
          let extraInstructions = "";
          
          if (activeAgent.roleplayEnabled && activeAgent.roleplayInstruction) {
              extraInstructions += `\n\n[ROLEPLAY INSTRUCTIONS]\n${activeAgent.roleplayInstruction}`;
          }

          if (activeAgent.moodPortraits && activeAgent.moodPortraits.length > 0) {
              const moods = activeAgent.moodPortraits.map((m: any) => m.mood).join(', ');
              const moodPrompt = activeAgent.moodDetectionPrompt || "Analyze the conversation context and your own emotional state. Determine which of the following moods best fits your current response: {MOODS}. You MUST start your response with the tag [MOOD: mood_name]. For example: [MOOD: happy] Hello there!";
              extraInstructions += `\n\n[MOOD DETECTION]\n${moodPrompt.replace('{MOODS}', moods)}`;
          }
          
          if (extraInstructions) {
              currentAiSettings.systemInstruction = (currentAiSettings.systemInstruction || "") + extraInstructions;
          }
      }

      if (aiMode === 'ghost' && !isAiExclusive) {
        aiName = activeAgent ? `${activeAgent.name} (Ghost)` : 'RADIX_GHOST';
      }

      // Streaming Logic
      const shouldStream = activeAgent?.streamResponse !== false; // Default to true if undefined
      const aiMsgId = crypto.randomUUID();
      abortControllerRef.current = false;
      
      let aiMsg = {
        id: aiMsgId,
        text: '',
        sender: aiName,
        timestamp: Date.now(),
        type: 'text',
        isGhost: aiMode === 'ghost' && !isAiExclusive,
        isAiChat: isAiExclusive,
        threadId: isAiExclusive && activeContext ? activeContext.id : undefined,
        font: activeAgent?.font || 'JetBrains Mono',
        fontColor: activeAgent?.fontColor || '#00FF00', // Default green
        emoticonPack
      };

      if (shouldStream) {
          // Add empty message first to UI
          setMessages(prev => [...prev, aiMsg]);
          
          let streamedText = "";
          let moodDetected = false;

          try {
              for await (const chunk of generateAIResponseStream(newMsg.text, mode, [...messages, newMsg], currentAiSettings)) {
                  if (abortControllerRef.current) {
                      break;
                  }
                  streamedText += chunk;
                  
                  // Check for Mood Tag in stream (simple check, might need buffering if tag is split across chunks)
                  // For robustness, we parse the full text so far
                  const moodRegex = /\[MOOD:\s*([^\]]+)\]/i;
                  const moodMatch = streamedText.match(moodRegex);
                  
                  let displayText = streamedText;
                  if (moodMatch) {
                      if (!moodDetected) {
                          const detectedMood = moodMatch[1].trim();
                          setCurrentMood(detectedMood);
                          moodDetected = true;
                      }
                      displayText = streamedText.replace(moodMatch[0], '').trim();
                  }

                  // Update message in UI
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: displayText } : m));
              }
              
              // Final save
              aiMsg.text = streamedText.replace(/\[MOOD:\s*([^\]]+)\]/i, '').trim();
              await addMessage(aiMsg);
              
          } catch (err) {
              console.error("Streaming Error", err);
              aiMsg.text = "ERR: STREAM_FAILED";
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: aiMsg.text } : m));
          }
      } else {
          // Non-Streaming Fallback
          abortControllerRef.current = false;
          let aiResponseText = await generateAIResponse(newMsg.text, mode, [...messages, newMsg], currentAiSettings);
          
          if (abortControllerRef.current) {
              setIsProcessing(false);
              return;
          }
          
          // Parse Mood Tag
          const moodRegex = /\[MOOD:\s*([^\]]+)\]/i;
          const moodMatch = aiResponseText.match(moodRegex);
          
          if (moodMatch) {
              const detectedMood = moodMatch[1].trim();
              setCurrentMood(detectedMood);
              // Remove the tag from the text
              aiResponseText = aiResponseText.replace(moodMatch[0], '').trim();
          }
          
          aiMsg.text = aiResponseText;
          await saveAndAddMessage(aiMsg);
      }
      
      setIsProcessing(false);
    }
  };

  const saveAndAddMessage = async (msg: any) => {
    await addMessage(msg);
    setMessages(prev => [...prev, msg]);
  };

  const handleRegenerate = async (msg: any) => {
    setContextMenuMsgId(null);
    
    // Find the index of the message to regenerate
    const msgIndex = messages.findIndex(m => m.id === msg.id);
    if (msgIndex === -1) return;
    
    // Get all messages before this one
    const contextMessages = messages.slice(0, msgIndex);
    
    // Find the last user message to use as the prompt
    const lastUserMsgIndex = contextMessages.map(m => m.sender).lastIndexOf('me');
    if (lastUserMsgIndex === -1) return; // Can't regenerate without a user prompt
    
    const userMsg = contextMessages[lastUserMsgIndex];
    const contextToUse = contextMessages.slice(0, lastUserMsgIndex);
    
    setIsProcessing(true);
    const mode = isAiExclusive ? 'participant' : (aiMode as 'ghost' | 'participant');
    
    let aiName = 'RADIX_AI';
    let currentAiSettings = { ...aiSettings };
    let activeAgent: any = null;
    
    if (activeContext?.isAgent) {
        aiName = activeContext.name;
        const agent = agents.find(a => a.id === activeContext.agentId);
        activeAgent = agent;
        if (agent) {
             const instruction = agent.privatePersona || agent.role || agent.systemInstruction;
             if (instruction) currentAiSettings.systemInstruction = instruction;
        } else if (activeContext.systemInstruction) {
             currentAiSettings.systemInstruction = activeContext.systemInstruction;
        }
    } else if (agents.length > 0) {
        let defaultAgent = agents.find(a => a.isPrimary || a.isPinned);
        if (!defaultAgent) {
            defaultAgent = agents.sort((a, b) => a.createdAt - b.createdAt)[0];
        }
        aiName = defaultAgent.name;
        activeAgent = defaultAgent;
        const instruction = defaultAgent.privatePersona || defaultAgent.role || defaultAgent.systemInstruction;
        if (instruction) currentAiSettings.systemInstruction = instruction;
    }

    if (activeAgent) {
        let extraInstructions = "";
        if (activeAgent.roleplayEnabled && activeAgent.roleplayInstruction) {
            extraInstructions += `\n\n[ROLEPLAY INSTRUCTIONS]\n${activeAgent.roleplayInstruction}`;
        }
        if (activeAgent.moodPortraits && activeAgent.moodPortraits.length > 0) {
            const moods = activeAgent.moodPortraits.map((m: any) => m.mood).join(', ');
            const moodPrompt = activeAgent.moodDetectionPrompt || "Analyze the conversation context and your own emotional state. Determine which of the following moods best fits your current response: {MOODS}. You MUST start your response with the tag [MOOD: mood_name]. For example: [MOOD: happy] Hello there!";
            extraInstructions += `\n\n[MOOD DETECTION]\n${moodPrompt.replace('{MOODS}', moods)}`;
        }
        if (extraInstructions) {
            currentAiSettings.systemInstruction = (currentAiSettings.systemInstruction || "") + extraInstructions;
        }
    }

    if (aiMode === 'ghost' && !isAiExclusive) {
        aiName = activeAgent ? `${activeAgent.name} (Ghost)` : 'RADIX_GHOST';
    }

    const shouldStream = activeAgent?.streamResponse !== false;
    abortControllerRef.current = false;
    
    const existingVariants = msg.metadata?.variants || [msg.text];
    const newVariantIndex = existingVariants.length;
    
    let updatedMsg = { 
      ...msg, 
      text: '', 
      metadata: { 
        ...(msg.metadata || {}), 
        variants: [...existingVariants, ''], 
        currentVariantIndex: newVariantIndex 
      } 
    };

    if (shouldStream) {
        setMessages(prev => prev.map(m => m.id === msg.id ? updatedMsg : m));
        let streamedText = "";
        let moodDetected = false;

        try {
            for await (const chunk of generateAIResponseStream(userMsg.text, mode, [...contextToUse, userMsg], currentAiSettings)) {
                if (abortControllerRef.current) break;
                streamedText += chunk;
                
                const moodRegex = /\[MOOD:\s*([^\]]+)\]/i;
                const moodMatch = streamedText.match(moodRegex);
                
                let displayText = streamedText;
                if (moodMatch) {
                    if (!moodDetected) {
                        setCurrentMood(moodMatch[1].trim());
                        moodDetected = true;
                    }
                    displayText = streamedText.replace(moodMatch[0], '').trim();
                }

                updatedMsg.text = displayText;
                updatedMsg.metadata.variants[newVariantIndex] = displayText;
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...updatedMsg } : m));
            }
            
            updatedMsg.text = streamedText.replace(/\[MOOD:\s*([^\]]+)\]/i, '').trim();
            updatedMsg.metadata.variants[newVariantIndex] = updatedMsg.text;
            await addMessage(updatedMsg);
            
        } catch (err) {
            console.error("Streaming Error", err);
            updatedMsg.text = "ERR: STREAM_FAILED";
            updatedMsg.metadata.variants[newVariantIndex] = updatedMsg.text;
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...updatedMsg } : m));
            await addMessage(updatedMsg);
        }
    } else {
        abortControllerRef.current = false;
        let aiResponseText = await generateAIResponse(userMsg.text, mode, [...contextToUse, userMsg], currentAiSettings);
        if (abortControllerRef.current) {
            setIsProcessing(false);
            return;
        }
        
        const moodRegex = /\[MOOD:\s*([^\]]+)\]/i;
        const moodMatch = aiResponseText.match(moodRegex);
        
        if (moodMatch) {
            setCurrentMood(moodMatch[1].trim());
            aiResponseText = aiResponseText.replace(moodMatch[0], '').trim();
        }
        
        updatedMsg.text = aiResponseText;
        updatedMsg.metadata.variants[newVariantIndex] = aiResponseText;
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...updatedMsg } : m));
        await addMessage(updatedMsg);
    }
    
    setIsProcessing(false);
  };

  const handleAiAction = async (action: string, msg: any, extra?: string) => {
    setContextMenuMsgId(null);
    setIsProcessing(true);
    abortControllerRef.current = false;
    
    const msgsToProcess = selectedMessageIds.includes(msg.id) 
        ? messages.filter(m => selectedMessageIds.includes(m.id))
        : [msg];
    
    for (const m of msgsToProcess) {
        let responseText = '';
        const isPrivate = aiActionPrivacy === 'private';
        
        let aiName = 'RADIX_AI';
        let ghostName = 'RADIX_GHOST';
        let currentAiSettings = { ...aiSettings };
        let activeAgent: any = null;
        
        if (activeContext?.isAgent) {
            const agent = agents.find(a => a.id === activeContext.agentId);
            if (agent) activeAgent = agent;
        } else if (agents.length > 0) {
            activeAgent = agents.find(a => a.isPrimary || a.isPinned);
            if (!activeAgent) {
                activeAgent = agents.sort((a, b) => a.createdAt - b.createdAt)[0];
            }
        }
        
        if (activeAgent) {
            aiName = activeAgent.name;
            ghostName = `${activeAgent.name} (Ghost)`;
            const instruction = activeAgent.privatePersona || activeAgent.role || activeAgent.systemInstruction;
            if (instruction) currentAiSettings.systemInstruction = instruction;
        }

        if (action === 'rewrite') {
          responseText = await generateRewrite(m.text, extra || 'Professional', currentAiSettings);
        } else if (action === 'factcheck') {
          responseText = await generateFactCheck(m.text, currentAiSettings);
        } else if (action === 'translate') {
          const translation = await generateTranslation(m.text, extra || 'English', currentAiSettings);
          responseText = `${m.text}\n\n---\n\n${translation}`;
        } else if (action === 'transcribe') {
          if (m.mediaUrl) {
            const base64Audio = m.mediaUrl.split(',')[1];
            responseText = await transcribeAudio(base64Audio, 'audio/webm', currentAiSettings);
          } else {
            responseText = "No audio data found to transcribe.";
          }
        } else if (action === 'visual_analysis') {
          if (m.mediaUrl) {
            const base64Image = m.mediaUrl.split(',')[1];
            const mimeType = m.mediaUrl.split(';')[0].split(':')[1] || 'image/jpeg';
            responseText = await generateVisualAnalysis(base64Image, mimeType, currentAiSettings);
          } else {
            responseText = "No image data found to analyze.";
          }
        }

        if (abortControllerRef.current) {
            setIsProcessing(false);
            return;
        }

        if (action === 'translate') {
             const updatedMsg = { ...m, text: responseText };
             setMessages(prev => prev.map(msg => msg.id === m.id ? updatedMsg : msg));
             await addMessage(updatedMsg); 
        } else if (isPrivate) {
            const aiMsg = {
              id: crypto.randomUUID(),
              text: responseText,
              sender: ghostName, 
              timestamp: Date.now(),
              type: 'text',
              isGhost: true, 
              isAiChat: isAiExclusive,
              threadId: isAiExclusive && activeContext ? activeContext.id : undefined,
              font: activeAgent?.font || 'JetBrains Mono',
              fontColor: activeAgent?.fontColor || '#00FF00',
              isPrivate: true 
            };
            await saveAndAddMessage(aiMsg);
        } else {
            const aiMsg = {
              id: crypto.randomUUID(),
              text: responseText,
              sender: aiName,
              timestamp: Date.now(),
              type: 'text',
              isAiChat: isAiExclusive,
              threadId: isAiExclusive && activeContext ? activeContext.id : undefined,
              font: activeAgent?.font || 'JetBrains Mono',
              fontColor: activeAgent?.fontColor || '#00FF00'
            };
            await saveAndAddMessage(aiMsg);
        }
    }
    
    setIsProcessing(false);
    if (selectedMessageIds.length > 0) {
        setIsSelectionMode(false);
        setSelectedMessageIds([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document' | 'audio' | 'contact' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    if (type === 'file') {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            const font = await getSetting('font') || 'JetBrains Mono';
            const fontColor = await getSetting('fontColor');
            
            const newMsg = {
                id: crypto.randomUUID(),
                text: '',
                mediaUrl: base64,
                mediaType: 'file',
                fileName: file.name,
                fileSize: file.size,
                sender: 'me',
                timestamp: Date.now(),
                type: 'media',
                isAiChat: isAiExclusive,
                font,
                fontColor
            };
            await saveAndAddMessage(newMsg);
        };
        reader.readAsDataURL(file);
        return;
    }

    if (type === 'image') {
        setIsTranscoding(true);
        try {
            let finalBlob: Blob = file;
            let finalName = file.name;
            
            const imgQuality = await getSetting('imageQuality') || 'avif';
            const vidQuality = await getSetting('videoQuality') || '720p'; // Use video quality for resolution if avif is selected
            
            if (imgQuality !== 'original') {
                finalBlob = await encodeImage(file, 65, 8, vidQuality as any);
                finalName = file.name.replace(/\.[^/.]+$/, "") + ".avif";
            }
            
            const base64 = await blobToBase64(finalBlob);
            const font = await getSetting('font') || 'JetBrains Mono';
            const fontColor = await getSetting('fontColor');
            
            const newMsg = {
                id: crypto.randomUUID(),
                text: '',
                mediaUrl: base64,
                mediaType: 'image',
                fileName: finalName,
                mediaQuality: imgQuality === 'original' ? 'original' : vidQuality,
                sender: 'me',
                timestamp: Date.now(),
                type: 'media',
                isAiChat: isAiExclusive,
                font,
                fontColor
            };
            await saveAndAddMessage(newMsg);
        } catch (err) {
            console.error('Image transcoding failed:', err);
            // Fallback to original if transcoding fails
            const base64 = await blobToBase64(file);
            const newMsg = {
                id: crypto.randomUUID(),
                text: '',
                mediaUrl: base64,
                mediaType: 'image',
                fileName: file.name,
                mediaQuality: 'original',
                sender: 'me',
                timestamp: Date.now(),
                type: 'media',
                isAiChat: isAiExclusive,
                font: await getSetting('font') || 'JetBrains Mono',
                fontColor: await getSetting('fontColor')
            };
            await saveAndAddMessage(newMsg);
        } finally {
            setIsTranscoding(false);
        }
        return;
    }

    if (type === 'video') {
        setIsTranscoding(true);
        try {
            let finalBlob: Blob = file;
            let finalName = file.name;
            
            const vidQuality = await getSetting('videoQuality') || '720p';
            
            if (vidQuality !== 'original') {
                finalBlob = await transcodeVideoToAV1(file, vidQuality as '720p' | '1080p');
                finalName = file.name.replace(/\.[^/.]+$/, "") + ".mp4";
            }
            
            const base64 = await blobToBase64(finalBlob);
            const font = await getSetting('font') || 'JetBrains Mono';
            const fontColor = await getSetting('fontColor');
            
            const newMsg = {
                id: crypto.randomUUID(),
                text: '',
                mediaUrl: base64,
                mediaType: 'video',
                fileName: finalName,
                mediaQuality: vidQuality,
                sender: 'me',
                timestamp: Date.now(),
                type: 'media',
                isAiChat: isAiExclusive,
                font,
                fontColor
            };
            await saveAndAddMessage(newMsg);
        } catch (err) {
            console.error('Video transcoding failed:', err);
            // Fallback to original
            const base64 = await blobToBase64(file);
            const newMsg = {
                id: crypto.randomUUID(),
                text: '',
                mediaUrl: base64,
                mediaType: 'video',
                fileName: file.name,
                mediaQuality: 'original',
                sender: 'me',
                timestamp: Date.now(),
                type: 'media',
                isAiChat: isAiExclusive,
                font: await getSetting('font') || 'JetBrains Mono',
                fontColor: await getSetting('fontColor')
            };
            await saveAndAddMessage(newMsg);
        } finally {
            setIsTranscoding(false);
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const font = await getSetting('font') || 'JetBrains Mono';
      const fontColor = await getSetting('fontColor');
      
      const newMsg = {
        id: crypto.randomUUID(),
        text: '',
        mediaUrl: base64,
        mediaType: type,
        fileName: file.name,
        mediaQuality: 'original',
        sender: 'me',
        timestamp: Date.now(),
        type: 'media',
        isAiChat: isAiExclusive,
        font,
        fontColor
      };
      
      await saveAndAddMessage(newMsg);
    };
    reader.readAsDataURL(file);
  };

  const handleLocationShare = () => {
    setShowAttachMenu(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const font = await getSetting('font') || 'JetBrains Mono';
        const fontColor = await getSetting('fontColor');
        const newMsg = {
          id: crypto.randomUUID(),
          text: `Shared Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          mediaUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${longitude-0.01},${latitude-0.01},${longitude+0.01},${latitude+0.01}&layer=mapnik&marker=${latitude},${longitude}`,
          mediaType: 'location',
          sender: 'me',
          timestamp: Date.now(),
          type: 'media',
          isAiChat: isAiExclusive,
          font,
          fontColor
        };
        await saveAndAddMessage(newMsg);
      }, (error) => {
        alert("Unable to retrieve location.");
      });
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleDownloadToDevice = async (msg: any) => {
    try {
      const vaultPath = await getSetting('vaultPath');
      // If no vault path is set, fallback to normal download
      if (!vaultPath || !('showSaveFilePicker' in window)) {
        const a = document.createElement('a');
        a.href = msg.mediaUrl;
        a.download = msg.fileName || `download_${msg.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Use File System Access API
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: msg.fileName || `download_${msg.id}`,
        types: [{
          description: 'Media File',
          accept: { '*/*': ['.avif', '.mp4', '.jpg', '.png'] },
        }],
      });
      
      const writable = await handle.createWritable();
      const response = await fetch(msg.mediaUrl);
      const blob = await response.blob();
      await writable.write(blob);
      await writable.close();

      // Anti-Double-Dipping Logic
      const autoEvict = await getSetting('autoEvict');
      if (autoEvict === 'true') {
        // Evict from app
        await deleteMessage(msg.id);
        setMessages(prev => prev.filter(m => m.id !== msg.id));
        alert('File saved to device and evicted from app storage.');
      } else {
        if (confirm('File saved to device. Do you want to evict it from the app to save space?')) {
          await deleteMessage(msg.id);
          setMessages(prev => prev.filter(m => m.id !== msg.id));
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save file:', err);
        alert('Failed to save file to device.');
      }
    }
  };

  const handleReply = (msg: any) => {
    if (selectedMessageIds.length > 1) {
        // Create composite message for multi-reply
        const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
        const combinedText = selectedMsgs.map(m => `[${m.sender}]: ${m.text || `[${m.type}]`}`).join('\n');
        
        const compositeMsg = {
            id: 'composite',
            text: combinedText,
            sender: 'Multiple Messages',
            type: 'text'
        };
        setReplyingTo(compositeMsg);
    } else {
        setReplyingTo(msg);
    }
    setContextMenuMsgId(null);
    if (inputRef.current) inputRef.current.focus();
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  };

  const handleShare = async (msg: any) => {
    const msgsToShare = selectedMessageIds.includes(msg.id) 
        ? messages.filter(m => selectedMessageIds.includes(m.id))
        : [msg];
    
    const textToShare = msgsToShare.map(m => {
        if (m.text) return m.text;
        if (m.mediaUrl) return `[Media: ${m.mediaType}]`;
        return '';
    }).join('\n\n');

    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Shared Messages',
                text: textToShare
            });
        } catch (err) {
            console.error('Share failed:', err);
        }
    } else {
        try {
            await navigator.clipboard.writeText(textToShare);
            alert('Messages copied to clipboard');
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }
    setContextMenuMsgId(null);
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  };

  const handleVote = async (msgId: string, optionIndex: number) => {
    // In a real app, this would update the DB and sync via P2P
    // For now, we'll update local state and assume it persists
    // Since we don't have a direct updateMessage function exposed, we might need to implement it or use a workaround
    // But let's assume we can update the message in memory and it reflects
    
    // We need to update the message in the DB
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentVotes = msg.votes || {};
    const userId = 'me'; // Replace with actual user ID if available
    
    // Check if already voted
    if (currentVotes[userId] !== undefined && !msg.pollAllowMultiple) {
        // Change vote
        currentVotes[userId] = optionIndex;
    } else if (msg.pollAllowMultiple) {
        // Toggle vote
        const userVotes = currentVotes[userId] || [];
        if (userVotes.includes(optionIndex)) {
            currentVotes[userId] = userVotes.filter((v: number) => v !== optionIndex);
        } else {
            currentVotes[userId] = [...userVotes, optionIndex];
        }
    } else {
        // New vote
        currentVotes[userId] = optionIndex;
    }

    // Update message in DB (mock)
    // We need a way to update the message. Since `addMessage` adds new ones, we might need `updateMessage`
    // For now, let's just update local state to reflect UI changes
    // In a real implementation, you'd update the DB record
    
    // Since we can't easily update DB without `updateMessage`, we'll skip DB persistence for votes in this turn
    // and just update local state for the UI demo.
    // Wait, `addMessage` might overwrite if ID exists? IndexedDB usually does `put`.
    // Let's try re-adding the message with updated fields.
    
    const updatedMsg = { ...msg, votes: currentVotes };
    await addMessage(updatedMsg); // Should overwrite if ID matches
    
    setMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
  };

  const handleCreatePoll = async () => {
    if (!pollData.question.trim() || pollData.options.filter(o => o.trim()).length < 2) return;
    
    const font = await getSetting('font') || 'JetBrains Mono';
    const fontColor = await getSetting('fontColor');
    
    const newMsg = {
      id: crypto.randomUUID(),
      text: pollData.question,
      pollOptions: pollData.options.filter(o => o.trim()),
      pollAllowMultiple: pollData.allowMultiple,
      mediaType: 'poll',
      sender: 'me',
      timestamp: Date.now(),
      type: 'media',
      isAiChat: isAiExclusive,
      font,
      fontColor,
      votes: {} // Map of userId -> optionIndex (or array of indices)
    };
    await saveAndAddMessage(newMsg);
    setShowPollModal(false);
    setPollData({ question: '', options: ['', ''], allowMultiple: false });
  };

  const handlePollCreate = () => {
    setShowAttachMenu(false);
    setShowPollModal(true);
  };

  const [transcriptionError, setTranscriptionError] = useState<{ error: string, blob: Blob } | null>(null);

  const handleRetryTranscription = async () => {
    if (!transcriptionError) return;
    
    const blob = transcriptionError.blob;
    setTranscriptionError(null);
    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    
    reader.onloadend = async () => {
        try {
            const base64Audio = (reader.result as string).split(',')[1];
            
            // Re-use timeout logic
            const timeoutDuration = 15000 + (blob.size / (1024 * 1024)) * 30000;
            
            const transcribePromise = transcribeAudio(base64Audio, 'audio/webm', aiSettings);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Transcription timed out')), timeoutDuration)
            );

            const transcription = await Promise.race([transcribePromise, timeoutPromise]) as string;

            if (transcription === 'NO_SPEECH') {
                setNoSpeechDetected(true);
                setTimeout(() => setNoSpeechDetected(false), 2000);
            } else if (transcription) {
                setInput(prev => prev + (prev ? ' ' : '') + transcription);
                if (inputRef.current) {
                    setTimeout(() => {
                        if (inputRef.current) {
                            inputRef.current.style.height = 'auto';
                            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 320)}px`;
                        }
                    }, 10);
                }
            }
        } catch (err: any) {
            console.error("Retry error:", err);
            setTranscriptionError({
                error: err.message || "Unknown error during retry",
                blob: blob
            });
        } finally {
            setIsProcessing(false);
        }
    };
  };

  const handleCancelTranscription = () => {
    setTranscriptionError(null);
  };

  const copyErrorToClipboard = () => {
    if (transcriptionError) {
        navigator.clipboard.writeText(JSON.stringify(transcriptionError, null, 2));
        alert("Error report copied to clipboard");
    }
  };

  const startRecording = async () => {
    if (isRequestingMicRef.current) return;
    isRequestingMicRef.current = true;
    setMicError('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // If recording was too short or cancelled, don't send
        if (audioChunksRef.current.length === 0) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const result = reader.result as string;
          const base64Audio = result.split(',')[1];
          const font = await getSetting('font') || 'JetBrains Mono';
          const fontColor = await getSetting('fontColor');
          
          const currentMode = recordingModeRef.current;
          
          if (currentMode === 'vtt') {
            setIsProcessing(true);
            try {
              // Timeout logic: 30s base + 100ms per KB
              const timeoutMs = 30000 + (audioBlob.size / 1024) * 100;
              const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Transcription timed out')), timeoutMs));
              
              const transcription = await Promise.race([
                  transcribeAudio(base64Audio, 'audio/webm', aiSettings),
                  timeoutPromise
              ]) as string;

              if (transcription === 'NO_SPEECH') {
                  setNoSpeechDetected(true);
                  setTimeout(() => setNoSpeechDetected(false), 2000);
              } else if (transcription) {
                  setInput(prev => prev + (prev ? ' ' : '') + transcription);
                  if (inputRef.current) {
                      setTimeout(() => {
                          if (inputRef.current) {
                              inputRef.current.style.height = 'auto';
                              inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 320)}px`;
                          }
                      }, 10);
                  }
              }
            } catch (err: any) {
              console.error("Transcription error:", err);
              setSttError({ error: err.message || 'Transcription failed', blob: audioBlob });
            } finally {
              setIsProcessing(false);
            }
          } else {
            const newMsg = {
              id: crypto.randomUUID(),
              text: '',
              mediaUrl: result,
              mediaType: 'audio',
              sender: 'me',
              timestamp: Date.now(),
              type: 'audio',
              isAiChat: isAiExclusive,
              font
            };
            await saveAndAddMessage(newMsg);
          }
        };
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setMicError('Mic access denied');
      setTimeout(() => setMicError(''), 3000);
      setIsRecording(false);
    } finally {
      isRequestingMicRef.current = false;
    }
  };

  const stopRecording = (cancelled = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (cancelled) {
        audioChunksRef.current = []; // Clear chunks so onstop knows to ignore
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setSwipeOffset(0);
    }
  };

  const handleRetryStt = async () => {
    if (!sttError) return;
    const { blob } = sttError;
    setSttError(null);
    setIsProcessing(true);
    
    try {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            // Timeout logic again
            const timeoutMs = 30000 + (blob.size / 1024) * 100;
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Transcription timed out')), timeoutMs));
            
            const transcription = await Promise.race([
                transcribeAudio(base64Audio, 'audio/webm', aiSettings),
                timeoutPromise
            ]) as string;

            if (transcription === 'NO_SPEECH') {
                setNoSpeechDetected(true);
                setTimeout(() => setNoSpeechDetected(false), 2000);
            } else if (transcription) {
                setInput(prev => prev + (prev ? ' ' : '') + transcription);
                if (inputRef.current) {
                    setTimeout(() => {
                        if (inputRef.current) {
                            inputRef.current.style.height = 'auto';
                            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 320)}px`;
                        }
                    }, 10);
                }
            }
        };
    } catch (err: any) {
        console.error("Retry error:", err);
        setSttError({ error: err.message || 'Retry failed', blob });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCancelStt = () => {
    setSttError(null);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent focus stealing/keyboard invocation
    if (input.trim()) return;
    
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    
    if (micButtonRef.current) {
      micButtonRef.current.setPointerCapture(e.pointerId);
    }

    if (isRecording) {
      // If already recording, tap stops it
      stopRecording();
    } else {
      // Start recording immediately in Voice mode
      recordingModeRef.current = 'voice';
      setRecordingMode('voice');
      startRecording();

      // Start timer to switch to VTT mode if held
      micHoldTimerRef.current = setTimeout(() => {
        if (isRecording || recordingModeRef.current === 'voice') {
          recordingModeRef.current = 'vtt';
          setRecordingMode('vtt');
          // Optional: Haptic feedback here if supported
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }, longPressDuration); // Use dynamic long press duration
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Swipe logic removed in favor of hold-to-transcribe
    if (!isRecording) return;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (micButtonRef.current) {
      micButtonRef.current.releasePointerCapture(e.pointerId);
    }
    
    if (micHoldTimerRef.current) {
      clearTimeout(micHoldTimerRef.current);
      micHoldTimerRef.current = null;
    }

    const duration = Date.now() - startTimeRef.current;
    
    if (isRecording) {
      // Check if pointer up happened outside the button (cancel)
      const rect = micButtonRef.current?.getBoundingClientRect();
      let isOutside = false;
      if (rect) {
         isOutside = 
          e.clientX < rect.left || 
          e.clientX > rect.right || 
          e.clientY < rect.top || 
          e.clientY > rect.bottom;
      }

      if (isOutside) {
        stopRecording(true); // Cancel if released outside
        setSwipeOffset(0);
        return;
      }

      // If we were in VTT mode (held long enough), we DON'T stop here.
      // The user wants to "tap to send", so we leave it recording.
      // They will tap again (triggering PointerDown -> stopRecording) to finish.
      
      // If we were in Voice mode (short tap), we also leave it recording (Toggle behavior).
      // So in both cases, PointerUp does nothing but clear the timer.
    }
    setSwipeOffset(0);
  };

  const handleNewChat = async () => {
    const loadedContacts = await getContacts();
    setContacts(loadedContacts);
    setShowNewChatModal(true);
    setSelectedContacts([]);
    setIsAddingContact(false);
  };

  const handleCreateContact = async () => {
    if (!newContactName.trim()) return;
    const newContact = {
      id: crypto.randomUUID(),
      name: newContactName,
      number: newContactNumber,
      avatar: '',
      createdAt: Date.now()
    };
    await addContact(newContact);
    setContacts(prev => [...prev, newContact]);
    setNewContactName('');
    setNewContactNumber('');
    setIsAddingContact(false);
  };

  const handleStartNewChat = async () => {
    if (selectedContacts.length === 0) return;

    if (selectedContacts.length === 1) {
      // Single Chat
      const contact = contacts.find(c => c.id === selectedContacts[0]);
      if (!contact) return;
      
      const newThread = {
        id: crypto.randomUUID(),
        name: contact.name,
        avatar: contact.avatar,
        type: 'private',
        members: ['me', contact.id],
        createdAt: Date.now(),
        previewText: 'Start a conversation'
      };
      await addThread(newThread);
      setThreads(prev => [newThread, ...prev]);
      setActiveContext(newThread);
      setViewMode('chat');
    } else {
      // Group Chat
      const newGroup = {
        id: crypto.randomUUID(),
        name: `Group (${selectedContacts.length + 1})`,
        type: 'private',
        members: ['me', ...selectedContacts],
        createdAt: Date.now(),
        previewText: 'Group created'
      };
      await addGroup(newGroup);
      setGroups(prev => [newGroup, ...prev]);
      setActiveContext(newGroup);
      setViewMode('chat');
    }
    setShowNewChatModal(false);
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContacts(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const handleSendClick = () => {
    if (input.trim()) {
      handleSend();
    }
  };

  const handleInputLongPress = () => {
    setShowInputMenu(true);
    setInputMenuLevel('root');
  };

  const insertMarkdown = (syntax: string) => {
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart;
    const end = inputRef.current.selectionEnd;
    const text = input;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    // Logic: Place markdown around cursor, space from rear, space after last char
    const newText = `${before} ${syntax}${syntax} ${after}`;
    setInput(newText);
    setShowInputMenu(false);
    setInputMenuLevel('root');
    
    // Set cursor position between the markdown chars
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.selectionStart = start + syntax.length + 1;
        inputRef.current.selectionEnd = start + syntax.length + 1;
        inputRef.current.focus();
      }
    }, 0);
  };

  const toggleAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioRefs.current[msgId]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
      }
      if (!audioRefs.current[msgId]) {
        audioRefs.current[msgId] = new Audio(url);
        audioRefs.current[msgId].onended = () => setPlayingAudioId(null);
      }
      audioRefs.current[msgId].play();
      setPlayingAudioId(msgId);
    }
  };

  if (!isDataLoaded) {
    return (
      <div className="flex flex-col h-full bg-transparent relative items-center justify-center text-[var(--accent)] font-mono">
        <div className="flex flex-col items-center space-y-4 animate-pulse">
          <Loader2 size={32} className="animate-spin" />
          <div className="tracking-widest uppercase text-xs">LOADING DATA...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {viewMode === 'list' ? (
        <div className="flex flex-col h-full animate-in fade-in p-2 sm:p-3">
          <div className="flex flex-col h-full bg-[var(--panel-bg)] rounded-2xl shadow-xl shadow-black/20 border border-white/5 overflow-hidden" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            {/* List Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--border)] pl-12 sm:pl-4 bg-white/5">
              <div className="flex items-center space-x-2 sm:space-x-3">
                {isAiExclusive ? (
                  <Bot size={18} className="text-[var(--accent)] sm:w-5 sm:h-5" />
                ) : (
                  <MessageSquare size={18} className="text-[var(--accent)] sm:w-5 sm:h-5" />
                )}
                <h2 className="font-bold tracking-widest uppercase text-[10px] sm:text-sm text-white/90">
                  {isAiExclusive ? 'AI Threads' : 'Radix Chat'}
                </h2>
                {p2pStatus !== 'connected' && (
                    <div className={`text-[8px] sm:text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${p2pStatus === 'disconnected' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                        {p2pStatus === 'disconnected' ? 'Reconnecting...' : 'P2P Error'}
                    </div>
                )}
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <InstallPWA />
                {isAiExclusive && (
                  <button onClick={() => { setActiveContext(null); setViewMode('chat'); }} className="p-1.5 sm:p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors">
                    <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs (Only for non-AI exclusive) */}
            {!isAiExclusive && (
              <div className="flex border-b border-[var(--border)] bg-black/20">
                <button 
                  onClick={() => setActiveTab('chats')}
                  className={`relative flex-1 p-2.5 sm:p-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'chats' ? 'text-[var(--accent)] bg-white/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'}`}
                >
                  Chats
                  {activeTab === 'chats' && <div className="absolute bottom-0 left-0 right-0 h-0.5 shadow-[0_0_8px_var(--accent)]" style={{ background: 'var(--accent-gradient)' }} />}
                </button>
                <button 
                  onClick={() => setActiveTab('groups')}
                  className={`relative flex-1 p-2.5 sm:p-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'groups' ? 'text-[var(--accent)] bg-white/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'}`}
                >
                  Groups
                  {activeTab === 'groups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 shadow-[0_0_8px_var(--accent)]" style={{ background: 'var(--accent-gradient)' }} />}
                </button>
                <button 
                  onClick={() => setActiveTab('channels')}
                  className={`relative flex-1 p-2.5 sm:p-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'channels' ? 'text-[var(--accent)] bg-white/5' : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'}`}
                >
                  Channels
                  {activeTab === 'channels' && <div className="absolute bottom-0 left-0 right-0 h-0.5 shadow-[0_0_8px_var(--accent)]" style={{ background: 'var(--accent-gradient)' }} />}
                </button>
              </div>
            )}

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 sm:space-y-2">
            {isAiExclusive ? (
              // AI Threads List
              threads.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] mt-10 text-[10px] sm:text-xs uppercase tracking-widest">No threads yet</div>
              ) : (
                threads.sort((a,b) => b.createdAt - a.createdAt).map(thread => (
                  <button 
                    key={thread.id}
                    onClick={() => { setActiveContext(thread); setViewMode('chat'); }}
                    className="w-full p-3 sm:p-4 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left group select-none"
                  >
                    <div className="flex justify-between items-start mb-0.5 sm:mb-1">
                      <span className="font-bold text-[11px] sm:text-sm text-[var(--text-main)] group-hover:text-[var(--accent)] truncate pr-2">{thread.name}</span>
                      <span className="text-[9px] sm:text-[10px] text-[var(--text-muted)] whitespace-nowrap">{new Date(thread.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-[var(--text-muted)] line-clamp-2">{thread.previewText}</p>
                  </button>
                ))
              )
            ) : activeTab === 'groups' ? (
              // Groups List
              groups.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] mt-10 text-[10px] sm:text-xs uppercase tracking-widest">No groups yet</div>
              ) : (
                groups.map(group => (
                  <button 
                    key={group.id}
                    onClick={() => { setActiveContext(group); setViewMode('chat'); }}
                    className="w-full p-3 sm:p-4 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left flex items-center space-x-2 sm:space-x-3 select-none"
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                      <Users size={16} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[11px] sm:text-sm truncate">{group.name}</span>
                        {group.privacy === 'private' && <Lock size={10} className="text-[var(--text-muted)] sm:w-3 sm:h-3" />}
                      </div>
                      <p className="text-[10px] sm:text-xs text-[var(--text-muted)] truncate">{group.about || 'No description'}</p>
                    </div>
                  </button>
                ))
              )
            ) : activeTab === 'channels' ? (
              <ChannelList 
                onSelectChannel={(channel) => { setActiveContext(channel); setViewMode('chat'); }} 
                activeChannelId={activeContext?.id}
              />
            ) : (
              // Chats List (Placeholder)
              <button 
                onClick={() => { setActiveContext(null); setViewMode('chat'); }}
                className="w-full p-3 sm:p-4 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-all text-left flex items-center space-x-2 sm:space-x-3 select-none"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                  <MessageSquare size={16} className="sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-[11px] sm:text-sm">Main Chat</span>
                  <p className="text-[10px] sm:text-xs text-[var(--text-muted)]">Global P2P Chat</p>
                </div>
              </button>
            )}
          </div>

          {/* FAB for Groups */}
          {!isAiExclusive && activeTab === 'groups' && (
            <button 
              onClick={() => setShowGroupCreate(true)}
              className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              <Plus size={24} />
            </button>
          )}

          {/* Group Create Modal */}
          {showGroupCreate && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)]">Create Group</h3>
                  <button onClick={() => setShowGroupCreate(false)}><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block mb-2">Group Name</label>
                    <input 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full radix-input p-3 rounded-xl"
                      placeholder="Enter group name..."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block mb-2">About (Max 1000 chars)</label>
                    <textarea 
                      value={newGroupAbout}
                      onChange={(e) => setNewGroupAbout(e.target.value.slice(0, 1000))}
                      className="w-full radix-input p-3 rounded-xl h-24 resize-none"
                      placeholder="Describe your group..."
                    />
                    <div className="text-[10px] text-right text-[var(--text-muted)]">{newGroupAbout.length}/1000</div>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block mb-2">Privacy</label>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setNewGroupPrivacy('private')}
                        className={`flex-1 p-3 rounded-xl border flex items-center justify-center space-x-2 ${newGroupPrivacy === 'private' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        <Lock size={16} /> <span>Private</span>
                      </button>
                      <button 
                        onClick={() => setNewGroupPrivacy('public')}
                        className={`flex-1 p-3 rounded-xl border flex items-center justify-center space-x-2 ${newGroupPrivacy === 'public' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]'}`}
                      >
                        <Globe size={16} /> <span>Public</span>
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={handleCreateGroup}
                    className="w-full p-4 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      ) : (
        activeContext && activeContext.folderId ? (
          <ChannelView 
            channel={activeContext as Channel} 
            onBack={() => {
              if (onBack) onBack();
              else {
                setViewMode('list');
                setActiveContext(null);
              }
            }}
          />
        ) : (
        <div className="flex flex-col h-full relative animate-in slide-in-from-right-10">
          {/* Chat Header */}
          {activeContext?.isAgent ? (
            <div className="absolute top-4 left-4 z-50 flex items-start space-x-3 pointer-events-none">
              <button onClick={() => {
                if (onBack) onBack();
                else {
                  setViewMode('list');
                  setActiveContext(null);
                }
              }} className="text-[var(--text-muted)] hover:text-[var(--text-main)] pointer-events-auto mt-2 bg-[var(--panel-bg)]/80 backdrop-blur rounded-full p-2 shadow-lg border border-[var(--border)]">
                <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
              </button>
              <div 
                className="pointer-events-auto cursor-pointer"
                onDoubleClick={() => {
                  if (activeContext?.agentId && onEditAgent) {
                    onEditAgent(activeContext.agentId);
                  }
                }}
              >
                {(() => {
                    const agent = agents.find(a => a.id === activeContext.agentId);
                    const moodPortrait = agent?.moodPortraits?.find((m: any) => m.mood.toLowerCase() === (currentMood || '').toLowerCase())?.url;
                    const displayAvatar = moodPortrait || agent?.avatar || activeContext.avatar;
                    const scale = agent?.portraitScale || 1;
                    const aspectRatio = agent?.portraitAspectRatio || '1:1';
                    
                    const width = 40 * scale;
                    
                    return displayAvatar ? (
                        <img src={displayAvatar || null} alt="Avatar" className={`object-cover shadow-2xl border border-[var(--border)] ${aspectRatio === 'circle' ? 'rounded-full aspect-square' : aspectRatio === '4:5' ? 'rounded-xl aspect-[4/5]' : 'rounded-xl aspect-square'}`} style={{ width: `${width}px` }} />
                    ) : (
                        <div className={`flex items-center justify-center text-[var(--accent)] bg-[var(--panel-bg)]/80 backdrop-blur shadow-2xl border border-[var(--border)] ${aspectRatio === 'circle' ? 'rounded-full aspect-square' : aspectRatio === '4:5' ? 'rounded-xl aspect-[4/5]' : 'rounded-xl aspect-square'}`} style={{ width: `${width}px` }}>
                          <Bot size={20 * scale} />
                        </div>
                    );
                })()}
              </div>
              
              {/* Selection Mode Actions (Floating) */}
              {isSelectionMode && (
                <div className="flex items-center space-x-2 animate-in fade-in pointer-events-auto bg-[var(--panel-bg)]/80 backdrop-blur p-2 rounded-xl shadow-lg border border-[var(--border)] ml-4">
                  <span className="text-xs font-bold text-[var(--accent)] mr-2">{selectedMessageIds.length} selected</span>
                  
                  {selectedMessageIds.length === 1 && (
                      <button onClick={() => {
                          const msg = messages.find(m => m.id === selectedMessageIds[0]);
                          if (msg) handleReply(msg);
                          setIsSelectionMode(false);
                          setSelectedMessageIds([]);
                      }} className="p-2 rounded-lg hover:bg-[var(--bg-color)]" title="Reply">
                          <Reply size={18} />
                      </button>
                  )}

                  <button onClick={handleBatchDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500" title="Delete">
                      <Trash2 size={18} />
                  </button>

                  <button onClick={() => { setIsSelectionMode(false); setSelectedMessageIds([]); }} className="p-2 rounded-lg hover:bg-[var(--bg-color)]">
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 sm:p-4 radix-panel border-b border-[var(--border)] pl-12 sm:pl-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button onClick={() => {
                  if (onBack) onBack();
                  else {
                    setViewMode('list');
                    setActiveContext(null);
                  }
                }} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                  <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
                </button>
                
                <div className="flex items-center space-x-2 sm:space-x-3">
                  {activeContext?.avatar ? (
                    <img src={activeContext.avatar || null} alt="Avatar" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-cover" />
                  ) : (
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-[var(--accent)] bg-[var(--accent)]/10`}>
                      <MessageSquare size={20} />
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-sm sm:text-base text-[var(--text-main)]">{activeContext?.name || 'Chat'}</h2>
                    <div className="flex items-center space-x-2">
                      {p2pStatus !== 'connected' && (
                          <div className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${p2pStatus === 'disconnected' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                              {p2pStatus === 'disconnected' ? 'Reconnecting...' : 'P2P Error'}
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Selection Mode Actions */}
              {isSelectionMode ? (
                <div className="flex items-center space-x-2 animate-in fade-in">
                  <span className="text-xs font-bold text-[var(--accent)] mr-4">{selectedMessageIds.length} selected</span>
                  
                  {selectedMessageIds.length === 1 && (
                      <button onClick={() => {
                          const msg = messages.find(m => m.id === selectedMessageIds[0]);
                          if (msg) handleReply(msg);
                          setIsSelectionMode(false);
                          setSelectedMessageIds([]);
                      }} className="p-2 rounded-lg hover:bg-[var(--bg-color)]" title="Reply">
                          <Reply size={18} />
                      </button>
                  )}

                  <button onClick={handleBatchDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500" title="Delete">
                      <Trash2 size={18} />
                  </button>

                  <button onClick={() => { setIsSelectionMode(false); setSelectedMessageIds([]); }} className="p-2 rounded-lg hover:bg-[var(--bg-color)]">
                    <X size={18} />
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Messages */}
          <div 
            className={`flex-1 overflow-y-auto p-4 space-y-4 ${activeContext?.isAgent ? 'pt-24' : ''}`}
            style={{ zoom: chatScale }}
            onClick={() => {
              setContextMenuMsgId(null);
              setGlobalContextMenu(false);
            }}
            onContextMenu={(e) => {
              // Only trigger global context menu if we didn't click on a message
              if (e.target === e.currentTarget) {
                e.preventDefault();
                setGlobalContextMenu(true);
                setMenuPosition({ x: e.clientX, y: e.clientY });
              }
            }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                isLongPressTriggeredRef.current = false;
                longPressCoordsRef.current = { x: e.clientX, y: e.clientY };
                longPressTimerRef.current = setTimeout(() => {
                  setMenuPosition({ x: e.clientX, y: e.clientY });
                  handleGlobalLongPress();
                }, longPressDuration);
              }
            }}
            onPointerUp={(e) => {
              if (e.target === e.currentTarget) {
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                if (isLongPressTriggeredRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  isLongPressTriggeredRef.current = false;
                }
              }
            }}
            onPointerLeave={(e) => {
              if (e.target === e.currentTarget) {
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                isLongPressTriggeredRef.current = false;
              }
            }}
          >
            <MemoizedMessageList 
              deps={[messages, selectedMessageIds, isSelectionMode, contextMenuMsgId, textSize, showTranslateMenu, showAiSubmenu, aiActionPrivacy, aiSettings, activeContext, agents, contacts, isAiExclusive, menuPosition, playingAudioId, translations, p2pStatus, longPressDuration, chatScale, currentMood]}
              renderMessages={() => messages.map((msg) => {
              const isMe = msg.sender === 'me';
              const isGhost = msg.isGhost;
              // Use global chat font for user messages, otherwise use message-specific font or inherit
              const msgFont = (isMe && !isGhost) ? 'var(--font-chat)' : (msg.font ? (msg.font.includes(',') ? msg.font : `"${msg.font}", monospace`) : 'inherit');
              const isSelected = selectedMessageIds.includes(msg.id);
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative group w-full`}
                  onClick={(e) => {
                    if (isSelectionMode) {
                        e.stopPropagation();
                        toggleMessageSelection(msg.id);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuMsgId(msg.id);
                  }}
                  onPointerDown={(e) => {
                      isLongPressTriggeredRef.current = false;
                      longPressCoordsRef.current = { x: e.clientX, y: e.clientY };
                      longPressTimerRef.current = setTimeout(() => handleLongPressMessage(msg.id), longPressDuration);
                  }}
                  onPointerUp={(e) => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      if (isLongPressTriggeredRef.current) {
                        e.preventDefault();
                        e.stopPropagation();
                        isLongPressTriggeredRef.current = false;
                      }
                  }}
                  onPointerLeave={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                      isLongPressTriggeredRef.current = false;
                  }}
                >
                  {isSelectionMode && selectedMessageIds.length > 1 && (
                    <div className={`mr-2 flex items-center ${isMe ? 'order-last ml-2 mr-0' : ''}`}>
                      <div 
                        className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-muted)]'}`}
                      >
                        {isSelected && <CheckCircle size={14} className="text-black" />}
                      </div>
                    </div>
                  )}
                  
                  <div 
                    className={`max-w-[85%] sm:max-w-[70%] p-3 text-sm rounded-2xl transition-all select-none ${
                      isGhost ? 'radix-bubble-ghost' : 
                      isMe ? 'radix-bubble-me rounded-tr-sm' : 'radix-bubble-other rounded-tl-sm'
                    } ${isSelected ? 'ring-2 ring-[var(--accent)]' : ''}`}
                    style={{ 
                      fontFamily: msgFont,
                      fontSize: `${textSize}px`
                    }}
                  >
                    {!isMe && (
                      <div 
                        className="text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider flex items-center justify-between select-none"
                        style={{ fontFamily: 'var(--font-sans)' }}
                      >
                        <span className="flex items-center space-x-1">
                            <span>{msg.senderName || msg.sender}</span>
                            {msg.isP2P && <Globe size={10} className="text-[var(--accent)]" />}
                        </span>
                        {msg.sender !== 'me' && (
                            <button onClick={() => handleRegenerate(msg)} className="text-[var(--accent)] hover:text-[var(--text-main)]">
                                <RotateCcw size={14} />
                            </button>
                        )}
                      </div>
                    )}
                    
                    {msg.isPrivate && (
                        <div 
                          className="flex items-center space-x-1 text-[10px] text-[var(--accent)] font-bold uppercase mb-1 border-b border-[var(--accent)]/20 pb-1 select-none"
                          style={{ fontFamily: 'var(--font-sans)' }}
                        >
                            <span>Private Insight</span>
                        </div>
                    )}
                    
                    {msg.replyToId && (() => {
                        const replyParent = messages.find(m => m.id === msg.replyToId);
                        return replyParent ? (
                            <div 
                              className="mb-2 p-2 rounded-lg bg-[var(--bg-color)]/50 border-l-2 border-[var(--accent)] text-xs cursor-pointer opacity-70 hover:opacity-100 select-none" 
                              onClick={(e) => { e.stopPropagation(); /* Scroll to message logic could go here */ }}
                              style={{ fontFamily: 'var(--font-sans)' }}
                            >
                                <div className="font-bold text-[var(--accent)]">{replyParent.senderName || replyParent.sender}</div>
                                <div className="truncate">{replyParent.text || (replyParent.type === 'media' ? `[${replyParent.mediaType}]` : '')}</div>
                            </div>
                        ) : null;
                    })()}

                    {msg.type === 'text' && (
                      <div 
                        className="markdown-body break-words select-text"
                        style={{ 
                            fontFamily: msgFont,
                            color: msg.fontColor ? msg.fontColor : undefined
                        }}
                      >
                        {msg.metadata?.variants && msg.metadata.variants.length > 1 && (
                            <div className="text-[10px] text-[var(--text-muted)] mb-1 font-mono flex items-center gap-2">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIndex = msg.metadata.currentVariantIndex || 0;
                                        if (currentIndex > 0) {
                                            const updatedMsg = {
                                                ...msg,
                                                metadata: {
                                                    ...msg.metadata,
                                                    currentVariantIndex: currentIndex - 1
                                                }
                                            };
                                            setMessages(prev => prev.map(m => m.id === msg.id ? updatedMsg : m));
                                            addMessage(updatedMsg);
                                        }
                                    }}
                                    className="hover:text-[var(--accent)]"
                                >
                                    <ChevronLeft size={12} />
                                </button>
                                <span>{ (msg.metadata.currentVariantIndex || 0) + 1 } / { msg.metadata.variants.length }</span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const currentIndex = msg.metadata.currentVariantIndex || 0;
                                        if (currentIndex < msg.metadata.variants.length - 1) {
                                            const updatedMsg = {
                                                ...msg,
                                                metadata: {
                                                    ...msg.metadata,
                                                    currentVariantIndex: currentIndex + 1
                                                }
                                            };
                                            setMessages(prev => prev.map(m => m.id === msg.id ? updatedMsg : m));
                                            addMessage(updatedMsg);
                                        }
                                    }}
                                    className="hover:text-[var(--accent)]"
                                >
                                    <ChevronRight size={12} />
                                </button>
                            </div>
                        )}
                        <Markdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({node, inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              const language = match ? match[1] : ''
                              const codeString = String(children).replace(/\n$/, '')
                              
                              if (!inline && match) {
                                return (
                                  <div className="relative my-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[#1e1e1e]">
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#404040]">
                                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{language}</span>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={(e) => {
                                            const btn = e.currentTarget;
                                            navigator.clipboard.writeText(codeString);
                                            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-400"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                                            setTimeout(() => {
                                              btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                                            }, 2000);
                                          }}
                                          className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                          title="Copy code"
                                        >
                                          <Copy size={14} />
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const blob = new Blob([codeString], { type: 'text/plain' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `code.${language || 'txt'}`;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            URL.revokeObjectURL(url);
                                          }}
                                          className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                          title="Download code"
                                        >
                                          <ExternalLink size={14} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="relative max-h-[500px] overflow-auto">
                                      <SyntaxHighlighter
                                        {...props}
                                        style={vscDarkPlus as any}
                                        language={language}
                                        PreTag="div"
                                        showLineNumbers={true}
                                        customStyle={{
                                          margin: 0,
                                          padding: '1rem',
                                          background: 'transparent',
                                          fontSize: '0.875rem',
                                        }}
                                        lineNumberStyle={{
                                          minWidth: '2.5em',
                                          paddingRight: '1em',
                                          color: 'var(--text-muted)',
                                          opacity: 0.5,
                                          textAlign: 'right'
                                        }}
                                      >
                                        {codeString}
                                      </SyntaxHighlighter>
                                    </div>
                                  </div>
                                )
                              }
                              return (
                                <code {...props} className={`${className} bg-[var(--panel-bg)] px-1.5 py-0.5 rounded text-[var(--accent)] font-mono text-[0.9em]`}>
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {msg.metadata?.variants ? msg.metadata.variants[msg.metadata.currentVariantIndex || 0] : msg.text}
                        </Markdown>
                        {translations[msg.id] && (
                            <>
                                <div className="my-2 border-t border-[var(--border)] border-dashed opacity-50" />
                                <div className="text-[var(--text-muted)] italic select-text">
                                    <Markdown remarkPlugins={[remarkGfm]}>{translations[msg.id]}</Markdown>
                                </div>
                            </>
                        )}
                      </div>
                    )}
                    
                    {msg.type === 'media' && msg.mediaType === 'image' && (
                      <div className="space-y-2 select-none">
                        <img 
                          src={msg.mediaUrl || null} 
                          alt="Uploaded media" 
                          className="max-w-full h-auto rounded-xl border border-[var(--border)]"
                          style={{ maxHeight: '300px', objectFit: 'contain' }}
                        />
                        <div className="text-[10px] text-[var(--text-muted)] uppercase flex justify-between">
                          <span>{msg.mediaQuality === 'original' ? 'MAX (Original)' : msg.mediaQuality === '1080p' ? 'HQ (1080p)' : 'SD (720p)'}</span>
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadToDevice(msg); }} className="hover:text-[var(--accent)] flex items-center space-x-1 cursor-pointer">
                             <ExternalLink size={10} /> <span>Save</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'file' && (
                        <div className="p-3 bg-[var(--bg-color)]/50 border border-[var(--border)] rounded-xl flex items-center space-x-3 select-none">
                            <div className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg">
                                <FileText size={24} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <div className="text-xs font-bold truncate">{msg.fileName || 'Unknown File'}</div>
                                <div className="text-[10px] text-[var(--text-muted)] uppercase">
                                    {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'File'}
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDownloadToDevice(msg); }}
                                className="p-2 hover:bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg transition-colors cursor-pointer"
                                title="Download"
                            >
                                <ExternalLink size={16} />
                            </button>
                        </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'video' && (
                      <div className="space-y-2 select-none">
                        <video src={msg.mediaUrl} controls className="max-w-full rounded-xl border border-[var(--border)]" style={{ maxHeight: '300px' }} />
                        <div className="text-[10px] text-[var(--text-muted)] uppercase flex justify-end">
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadToDevice(msg); }} className="hover:text-[var(--accent)] flex items-center space-x-1 cursor-pointer">
                             <ExternalLink size={10} /> <span>Save</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'document' && (
                      <div className="flex items-center space-x-2 p-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl select-none">
                        <FileText size={16} className="text-[var(--accent)]" />
                        <span className="truncate text-xs">{msg.fileName}</span>
                      </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'audio' && (
                      <div className="flex items-center space-x-2 p-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl select-none">
                        <Music size={16} className="text-[var(--accent)]" />
                        <span className="truncate text-xs">{msg.fileName}</span>
                        <audio src={msg.mediaUrl} controls className="h-8 w-32 ml-2" />
                      </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'contact' && (
                      <div className="flex items-center space-x-2 p-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl select-none">
                        <Users size={16} className="text-[var(--accent)]" />
                        <span className="truncate text-xs">{msg.fileName}</span>
                      </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'location' && (
                      <div className="space-y-2 select-none">
                        <div className="flex items-center space-x-2 text-[var(--accent)] text-xs font-bold uppercase">
                          <MapPin size={14} /> <span>Location Pin</span>
                        </div>
                        <iframe src={msg.mediaUrl} className="w-full h-40 rounded-xl border border-[var(--border)]" title="Location" />
                        <div className="text-[10px] text-[var(--text-muted)]">{msg.text}</div>
                      </div>
                    )}

                    {msg.type === 'media' && msg.mediaType === 'poll' && (
                      <div className="space-y-3 min-w-[250px] select-none">
                        <div className="flex items-center space-x-2 text-[var(--accent)] text-xs font-bold uppercase mb-2">
                          <BarChart2 size={14} /> <span>Poll</span>
                          {msg.pollAllowMultiple && <span className="text-[10px] opacity-50 ml-auto">Multiple Choice</span>}
                        </div>
                        <div className="font-bold text-sm mb-2">{msg.text}</div>
                        <div className="space-y-2">
                          {(() => {
                              const userId = 'me';
                              const votes = msg.votes || {};
                              const myVote = votes[userId];
                              const hasVoted = myVote !== undefined && (Array.isArray(myVote) ? myVote.length > 0 : true);
                              
                              // Calculate totals
                              const totalVotes = Object.values(votes).flat().length;
                              const counts = new Array(msg.pollOptions.length).fill(0);
                              Object.values(votes).forEach((v: any) => {
                                  if (Array.isArray(v)) v.forEach(i => counts[i]++);
                                  else counts[v]++;
                              });

                              return msg.pollOptions.map((opt: string, i: number) => {
                                  const isSelected = Array.isArray(myVote) ? myVote.includes(i) : myVote === i;
                                  const count = counts[i];
                                  const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

                                  return (
                                    <div key={i} className="relative">
                                        {hasVoted && (
                                            <div 
                                                className="absolute inset-0 bg-[var(--accent)]/10 rounded-lg transition-all duration-500" 
                                                style={{ width: `${percent}%` }}
                                            />
                                        )}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleVote(msg.id, i); }}
                                            className={`relative w-full p-3 text-left text-xs border rounded-lg transition-colors flex justify-between items-center ${
                                                isSelected 
                                                    ? 'border-[var(--accent)] text-[var(--accent)]' 
                                                    : 'border-[var(--border)] hover:border-[var(--text-muted)]'
                                            }`}
                                        >
                                            <span className="font-medium z-10">{opt}</span>
                                            {hasVoted && (
                                                <span className="font-bold text-[10px] z-10">{percent}%</span>
                                            )}
                                            {isSelected && !hasVoted && <CheckCircle size={14} />}
                                        </button>
                                    </div>
                                  );
                              });
                          })()}
                        </div>
                        {msg.votes && Object.keys(msg.votes).length > 0 && (
                            <div className="text-[10px] text-[var(--text-muted)] text-right">
                                {Object.keys(msg.votes).length} votes
                            </div>
                        )}
                      </div>
                    )}

                    {msg.type === 'audio' && (
                      <VoiceNotePlayer url={msg.mediaUrl} />
                    )}
                    
                    <div 
                      className="text-[10px] text-right mt-2 opacity-50 select-none"
                      style={{ fontFamily: 'var(--font-sans)' }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>

                  {/* Context Menu */}
                  {contextMenuMsgId === msg.id && (
                    (() => {
                        const menuStyle: React.CSSProperties = {
                            position: 'fixed',
                            zIndex: 50,
                        };
                        
                        if (menuPosition) {
                            const { x, y } = menuPosition;
                            const { innerWidth, innerHeight } = window;
                            
                            // Quadrant logic:
                            // Top-Left tap -> Top: y, Left: x
                            // Top-Right tap -> Top: y, Right: screenW - x
                            // Bottom-Left tap -> Bottom: screenH - y, Left: x
                            // Bottom-Right tap -> Bottom: screenH - y, Right: screenW - x
                            
                            if (x > innerWidth / 2) {
                                menuStyle.right = innerWidth - x;
                            } else {
                                menuStyle.left = x;
                            }
                            
                            if (y > innerHeight / 2) {
                                menuStyle.bottom = innerHeight - y;
                            } else {
                                menuStyle.top = y;
                            }
                        } else {
                            menuStyle.top = '50%';
                            menuStyle.left = '50%';
                            menuStyle.transform = 'translate(-50%, -50%)';
                        }

                        return (
                            <div 
                                className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-2xl w-56 overflow-hidden animate-in fade-in zoom-in-95"
                                style={menuStyle}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex flex-col">
                                    {!showAiSubmenu && showTranslateMenu !== msg.id ? (
                          <>
                            <button 
                              onClick={() => {
                                if (selectedMessageIds.length > 1 && selectedMessageIds.includes(msg.id)) {
                                  const selectedMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
                                  const combinedText = selectedMsgs.map(m => `[${m.sender}]: ${m.text || `[${m.type}]`}`).join('\n');
                                  navigator.clipboard.writeText(combinedText);
                                } else if (msg.type === 'image') {
                                  navigator.clipboard.writeText(msg.text || msg.mediaUrl || '');
                                } else {
                                  navigator.clipboard.writeText(msg.text || '');
                                }
                                setContextMenuMsgId(null);
                                setIsSelectionMode(false);
                                setSelectedMessageIds([]);
                              }}
                              className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2"
                            >
                              <Copy size={14} /> 
                              <span>
                                {selectedMessageIds.length > 1 && selectedMessageIds.includes(msg.id) ? 'Copy media' : (msg.type === 'image' ? 'Copy image' : 'Copy text')}
                              </span>
                            </button>
                            <button onClick={() => handleReply(msg)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                              <Reply size={14} /> <span>Reply</span>
                            </button>
                            <button onClick={() => handleShare(msg)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                              <Share2 size={14} /> <span>Share</span>
                            </button>
                            <button 
                                onClick={() => setShowTranslateMenu(msg.id)}
                                className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2"
                            >
                              <Languages size={14} /> <span>Translate</span>
                            </button>
                            
                            <div className="border-t border-[var(--border)] my-1"></div>

                            <button onClick={() => setShowAiSubmenu(true)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Bot size={14} className="text-[var(--accent)]" />
                                <span className="font-bold">AI Options</span>
                              </div>
                              <Plus size={14} className="opacity-50" />
                            </button>

                            <div className="border-t border-[var(--border)] my-1"></div>

                            <button 
                                onClick={(e) => {
                                    if (selectedMessageIds.length > 1 && selectedMessageIds.includes(msg.id)) {
                                        handleBatchDelete(e);
                                    } else {
                                        handleDeleteMessage(msg.id);
                                    }
                                }} 
                                className="p-3 text-left text-xs hover:bg-red-500/10 text-red-500 flex items-center space-x-2"
                            >
                              <Trash2 size={14} /> <span>Delete {selectedMessageIds.length > 1 && selectedMessageIds.includes(msg.id) ? `(${selectedMessageIds.length})` : ''}</span>
                            </button>
                          </>
                        ) : showTranslateMenu === msg.id ? (
                            <div className="flex flex-col max-h-60 overflow-y-auto">
                                <div className="p-2 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--panel-bg)] z-10">
                                    <button onClick={() => setShowTranslateMenu(null)} className="text-xs font-bold flex items-center hover:text-[var(--accent)]">
                                        <ChevronLeft size={12} className="mr-1" /> Back
                                    </button>
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">Select Language</span>
                                </div>
                                {LANGUAGES.map(lang => (
                                    <button 
                                        key={lang.code}
                                        onClick={() => handleTranslate(msg.id, msg.text, lang.code)}
                                        className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center justify-between group/lang"
                                    >
                                        <span>{lang.name}</span>
                                        <span className="text-[10px] text-[var(--text-muted)] group-hover/lang:text-[var(--accent)]">{lang.nativeName}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                          <>
                            <button onClick={() => setShowAiSubmenu(false)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2 bg-[var(--accent)]/5">
                              <ChevronLeft size={14} /> <span className="font-bold">Back to Menu</span>
                            </button>
                            
                            <div className="px-3 py-2 flex items-center justify-between bg-[var(--bg-color)]/50">
                                <span className="text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">AI Actions</span>
                                <button 
                                    onClick={() => setAiActionPrivacy(prev => prev === 'public' ? 'private' : 'public')}
                                    className="flex items-center space-x-1 text-[10px] uppercase font-bold px-2 py-1 rounded bg-[var(--bg-color)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                                >
                                    {aiActionPrivacy === 'private' ? (
                                        <>
                                            <Lock size={10} className="text-[var(--accent)]" />
                                            <span className="text-[var(--accent)]">Private</span>
                                        </>
                                    ) : (
                                        <>
                                            <Globe size={10} />
                                            <span>Public</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            
                            <button onClick={() => handleAiAction('rewrite', msg, aiSettings.rewriteFormal)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                              <PenTool size={14} /> <span>Rewrite (Formal)</span>
                            </button>
                            <button onClick={() => handleAiAction('rewrite', msg, aiSettings.rewriteCasual)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                              <PenTool size={14} /> <span>Rewrite (Casual)</span>
                            </button>
                            <button onClick={() => handleAiAction('rewrite', msg, aiSettings.rewriteWarm)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                              <PenTool size={14} /> <span>Rewrite (Warm)</span>
                            </button>
                            <button onClick={() => handleAiAction('factcheck', msg)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                              <CheckCircle size={14} /> <span>Fact Check</span>
                            </button>
                            
                            {msg.type === 'media' && msg.mediaType === 'image' && (
                              <button onClick={() => handleAiAction('visual_analysis', msg)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                <ImageIcon size={14} /> <span>Visual Analysis</span>
                              </button>
                            )}

                            {msg.type === 'audio' && (
                              <button onClick={() => handleAiAction('transcribe', msg)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                <Headphones size={14} /> <span>Transcribe Audio</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
                </div>
              );
            })} />
            {isProcessing && (() => {
              let activeAgent: any = null;
              if (activeContext?.isAgent) {
                activeAgent = agents.find(a => a.id === activeContext.agentId);
              } else if (agents.length > 0) {
                activeAgent = agents.sort((a, b) => a.createdAt - b.createdAt)[0];
              }

              const loadingConfig = activeAgent?.loadingState;
              
              if (loadingConfig?.enabled) {
                const animationClass = `anim-${loadingConfig.animationStyle}${['turning', 'rotating', 'pendulum', 'flipping'].includes(loadingConfig.animationStyle) ? `-${loadingConfig.animationDirection}` : ''}`;
                return (
                  <div className="flex justify-start">
                    <div className="radix-bubble-other p-3 text-sm rounded-2xl rounded-tl-sm flex items-center space-x-3">
                      <span className={animationClass} style={{ display: 'inline-block' }}>
                        <RadixIcon 
                          icon={loadingConfig.iconIdentifier} 
                          style={{ color: loadingConfig.iconColor }}
                          width={24}
                          height={24}
                        />
                      </span>
                      <span 
                        style={{ 
                          fontFamily: loadingConfig.fontFamily || 'inherit',
                          color: loadingConfig.textColor 
                        }}
                        className="tracking-wider"
                      >
                        {loadingConfig.text}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex justify-start">
                  <div className="radix-bubble-other p-3 text-sm text-[var(--accent)] animate-pulse flex items-center space-x-2 rounded-2xl rounded-tl-sm">
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full"></div>
                    <span>Processing...</span>
                  </div>
                </div>
              );
            })()}
            <div ref={messagesEndRef} />

            {/* Global Context Menu */}
            {globalContextMenu && (
              (() => {
                const menuStyle: React.CSSProperties = {
                  position: 'fixed',
                  zIndex: 50,
                };
                
                if (menuPosition) {
                  const { x, y } = menuPosition;
                  const { innerWidth, innerHeight } = window;
                  
                  if (x > innerWidth / 2) {
                    menuStyle.right = innerWidth - x;
                  } else {
                    menuStyle.left = x;
                  }
                  
                  if (y > innerHeight / 2) {
                    menuStyle.bottom = innerHeight - y;
                  } else {
                    menuStyle.top = y;
                  }
                } else {
                  menuStyle.top = '50%';
                  menuStyle.left = '50%';
                  menuStyle.transform = 'translate(-50%, -50%)';
                }

                return (
                  <div 
                    className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-2xl w-56 overflow-hidden animate-in fade-in zoom-in-95"
                    style={menuStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col">
                      {isSelectionMode && selectedMessageIds.length > 0 ? (
                        (() => {
                          const msg = messages.find(m => m.id === selectedMessageIds[0]);
                          if (!msg) return null;
                          return (
                            <>
                              {!showAiSubmenu && showTranslateMenu !== msg.id ? (
                                <>
                                  <button onClick={() => { handleReply(msg); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                    <Reply size={14} /> <span>Reply</span>
                                  </button>
                                  <button onClick={() => { handleShare(msg); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                    <Share2 size={14} /> <span>Share</span>
                                  </button>
                                  <button 
                                      onClick={() => setShowTranslateMenu(msg.id)}
                                      className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2"
                                  >
                                    <Languages size={14} /> <span>Translate</span>
                                  </button>
                                  
                                  <div className="border-t border-[var(--border)] my-1"></div>

                                  <button onClick={() => setShowAiSubmenu(true)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Bot size={14} className="text-[var(--accent)]" />
                                      <span className="font-bold">AI Options</span>
                                    </div>
                                    <Plus size={14} className="opacity-50" />
                                  </button>

                                  <div className="border-t border-[var(--border)] my-1"></div>

                                  <button 
                                      onClick={(e) => {
                                          handleBatchDelete(e);
                                          setGlobalContextMenu(false);
                                      }} 
                                      className="p-3 text-left text-xs hover:bg-red-500/10 text-red-500 flex items-center space-x-2"
                                  >
                                    <Trash2 size={14} /> <span>Delete ({selectedMessageIds.length})</span>
                                  </button>
                                </>
                              ) : showTranslateMenu === msg.id ? (
                                  <div className="flex flex-col max-h-60 overflow-y-auto">
                                      <div className="p-2 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--panel-bg)] z-10">
                                          <button onClick={() => setShowTranslateMenu(null)} className="text-xs font-bold flex items-center hover:text-[var(--accent)]">
                                              <ChevronLeft size={12} className="mr-1" /> Back
                                          </button>
                                          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">Select Language</span>
                                      </div>
                                      {LANGUAGES.map(lang => (
                                          <button 
                                              key={lang.code}
                                              onClick={() => { handleTranslate(msg.id, msg.text, lang.code); setGlobalContextMenu(false); }}
                                              className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center justify-between group/lang"
                                          >
                                              <span>{lang.name}</span>
                                              <span className="text-[10px] text-[var(--text-muted)] group-hover/lang:text-[var(--accent)]">{lang.nativeName}</span>
                                          </button>
                                      ))}
                                  </div>
                              ) : (
                                <>
                                  <button onClick={() => setShowAiSubmenu(false)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2 bg-[var(--accent)]/5">
                                    <ChevronLeft size={14} /> <span className="font-bold">Back to Menu</span>
                                  </button>
                                  
                                  <div className="px-3 py-2 flex items-center justify-between bg-[var(--bg-color)]/50">
                                      <span className="text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">AI Actions</span>
                                      <button 
                                          onClick={() => setAiActionPrivacy(prev => prev === 'public' ? 'private' : 'public')}
                                          className="flex items-center space-x-1 text-[10px] uppercase font-bold px-2 py-1 rounded bg-[var(--bg-color)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                                      >
                                          {aiActionPrivacy === 'private' ? (
                                              <>
                                                  <Lock size={10} className="text-[var(--accent)]" />
                                                  <span className="text-[var(--accent)]">Private</span>
                                              </>
                                          ) : (
                                              <>
                                                  <Globe size={10} />
                                                  <span>Public</span>
                                              </>
                                          )}
                                      </button>
                                  </div>
                                  
                                  <button onClick={() => { handleAiAction('rewrite', msg, aiSettings.rewriteFormal); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                    <PenTool size={14} /> <span>Rewrite (Formal)</span>
                                  </button>
                                  <button onClick={() => { handleAiAction('rewrite', msg, aiSettings.rewriteCasual); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                    <PenTool size={14} /> <span>Rewrite (Casual)</span>
                                  </button>
                                  <button onClick={() => { handleAiAction('rewrite', msg, aiSettings.rewriteWarm); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                    <PenTool size={14} /> <span>Rewrite (Warm)</span>
                                  </button>
                                  <button onClick={() => { handleAiAction('factcheck', msg); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                    <CheckCircle size={14} /> <span>Fact Check</span>
                                  </button>
                                  
                                  {msg.type === 'media' && msg.mediaType === 'image' && (
                                    <button onClick={() => { handleAiAction('visual_analysis', msg); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                      <ImageIcon size={14} /> <span>Visual Analysis</span>
                                    </button>
                                  )}

                                  {msg.type === 'audio' && (
                                    <button onClick={() => { handleAiAction('transcribe', msg); setGlobalContextMenu(false); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2">
                                      <Headphones size={14} /> <span>Transcribe Audio</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          );
                        })()
                      ) : !showAiSubmenu ? (
                        <>
                          <button onClick={() => setShowAiSubmenu(true)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Bot size={14} className="text-[var(--accent)]" />
                              <span className="font-bold">AI Options</span>
                            </div>
                            <Plus size={14} className="opacity-50" />
                          </button>

                          <div className="border-t border-[var(--border)] my-1"></div>

                          <button onClick={() => { setGlobalContextMenu(false); setShowInputMenu(true); setInputMenuLevel('markdown'); }} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <FileText size={14} className="text-[var(--accent)]" />
                              <span className="font-bold">Markdown</span>
                            </div>
                            <Plus size={14} className="opacity-50" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setShowAiSubmenu(false)} className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2 bg-[var(--accent)]/5">
                            <ChevronLeft size={14} /> <span className="font-bold">Back to Menu</span>
                          </button>
                          
                          <div className="px-3 py-2 flex items-center justify-between bg-[var(--bg-color)]/50">
                            <span className="text-[10px] uppercase tracking-wider text-[var(--accent)] font-bold">AI Actions</span>
                          </div>
                          
                          <button 
                            onClick={async () => {
                              setGlobalContextMenu(false);
                              setShowAiSubmenu(false);
                              try {
                                const { toBlob } = await import('html-to-image');
                                const blob = await toBlob(document.body, { quality: 0.8, type: 'image/jpeg' });
                                
                                if (blob) {
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    const newMessage = {
                                      id: crypto.randomUUID(),
                                      text: 'Examine this screen.',
                                      sender: 'me',
                                      timestamp: Date.now(),
                                      type: 'media',
                                      mediaUrl: reader.result as string,
                                      mediaType: 'image',
                                      isAiChat: isAiExclusive,
                                      font: await getSetting('font') || 'JetBrains Mono',
                                      fontColor: await getSetting('fontColor')
                                    };
                                    await saveAndAddMessage(newMessage);
                                    
                                    // Trigger AI
                                    setAiMode('participant');
                                    setInput('Examine this screen.');
                                    setTimeout(() => handleSend(), 100);
                                  };
                                  reader.readAsDataURL(blob);
                                }
                              } catch (err) {
                                console.error('Failed to capture screen:', err);
                                alert('Failed to capture screen.');
                              }
                            }} 
                            className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2"
                          >
                            <Monitor size={14} /> <span>Examine Screen (Public)</span>
                          </button>
                          
                          <button 
                            onClick={async () => {
                              setGlobalContextMenu(false);
                              setShowAiSubmenu(false);
                              try {
                                const { toBlob } = await import('html-to-image');
                                const blob = await toBlob(document.body, { quality: 0.8, type: 'image/jpeg' });
                                
                                if (blob) {
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    const newMessage = {
                                      id: crypto.randomUUID(),
                                      text: 'Examine this screen.',
                                      sender: 'me',
                                      timestamp: Date.now(),
                                      type: 'media',
                                      mediaUrl: reader.result as string,
                                      mediaType: 'image',
                                      isAiChat: isAiExclusive,
                                      font: await getSetting('font') || 'JetBrains Mono',
                                      fontColor: await getSetting('fontColor')
                                    };
                                    await saveAndAddMessage(newMessage);
                                    
                                    // Trigger AI
                                    setAiMode('ghost');
                                    setInput('Examine this screen.');
                                    setTimeout(() => handleSend(), 100);
                                  };
                                  reader.readAsDataURL(blob);
                                }
                              } catch (err) {
                                console.error('Failed to capture screen:', err);
                                alert('Failed to capture screen.');
                              }
                            }} 
                            className="p-3 text-left text-xs hover:bg-[var(--bg-color)] flex items-center space-x-2"
                          >
                            <Ghost size={14} /> <span>Examine Screen (Ghost)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* Selection Preview Modal */}
          {showSelectionPreview && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-4 animate-in zoom-in-95 max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)]">Selected Messages</h3>
                  <button onClick={() => setShowSelectionPreview(false)}><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 p-2 border border-[var(--border)] rounded-xl bg-[var(--panel-bg)]">
                  {messages.filter(m => selectedMessageIds.includes(m.id)).map(m => (
                    <div key={m.id} className="p-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)] uppercase mb-1">
                        <span>{m.sender}</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs line-clamp-3">{m.text}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={handleAiThreadFromSelection}
                  className="w-full p-4 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 flex items-center justify-center space-x-2"
                >
                  <Bot size={18} />
                  <span>Create AI Thread</span>
                </button>
              </div>
            </div>
          )}

          {/* Attachment Menu Overlay */}
          {showAttachMenu && (
            <div className="absolute bottom-24 left-4 right-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl z-20 animate-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-4 border-b border-[var(--border)] pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Attach Media</span>
                <button onClick={() => setShowAttachMenu(false)} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <label className="flex flex-col items-center space-y-2 cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <ImageIcon size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Image</span>
                  <input type="file" accept="image/jpeg, image/png, image/webp, image/heic" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} />
                </label>
                <label className="flex flex-col items-center space-y-2 cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <Video size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Video</span>
                  <input type="file" accept="video/mp4, video/quicktime, video/x-msvideo" className="hidden" onChange={(e) => handleFileUpload(e, 'video')} />
                </label>
                <label className="flex flex-col items-center space-y-2 cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <FileText size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">File</span>
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
                </label>
                <label className="flex flex-col items-center space-y-2 cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <Music size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Audio</span>
                  <input type="file" accept="audio/mpeg, audio/ogg, audio/aac" className="hidden" onChange={(e) => handleFileUpload(e, 'audio')} />
                </label>
                <button onClick={handleLocationShare} className="flex flex-col items-center space-y-2 group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <MapPin size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Location</span>
                </button>
                <label className="flex flex-col items-center space-y-2 cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <Users size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Contact</span>
                  <input type="file" accept=".vcf" className="hidden" onChange={(e) => handleFileUpload(e, 'contact')} />
                </label>
                <button onClick={handlePollCreate} className="flex flex-col items-center space-y-2 group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <BarChart2 size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Poll</span>
                </button>
                <button onClick={() => { setShowAttachMenu(false); setIsScanning(true); }} className="flex flex-col items-center space-y-2 group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <QrCode size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Scan Code</span>
                </button>
                <button onClick={() => { setShowAttachMenu(false); setShowImageGenOverlay({ text: input }); }} className="flex flex-col items-center space-y-2 group">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors">
                    <Wand2 size={20} />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] text-center leading-tight">Generate<br/>Image</span>
                </button>
              </div>
            </div>
          )}

          {/* Input Menu (Long Press) */}
          {showInputMenu && (
            <div className="absolute bottom-24 left-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-xl z-20 animate-in fade-in zoom-in-95 w-64">
              <div className="flex flex-col p-2">
                {inputMenuLevel === 'root' && (
                  <>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('markdown')} className="p-3 text-sm hover:bg-[var(--bg-color)] rounded text-left flex justify-between items-center">
                      <span>Markdown</span>
                      <span className="text-[var(--text-muted)]">↓</span>
                    </button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('ai')} className="p-3 text-sm hover:bg-[var(--bg-color)] rounded text-left flex justify-between items-center">
                      <span className="flex items-center space-x-2"><Wand2 size={14} /> <span>AI Options</span></span>
                      <span className="text-[var(--text-muted)]">↓</span>
                    </button>
                  </>
                )}

                {inputMenuLevel === 'markdown' && (
                  <>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('root')} className="p-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center space-x-1 mb-1">
                      <ChevronLeft size={12} /> <span>Back</span>
                    </button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('**')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Bold (**)</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('*')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Italic (*)</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('~~')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Strike (~~)</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('`')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Code (`)</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('>')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Quote (&gt;)</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('1. ')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Ordered List (1. )</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('- ')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Unordered List (- )</button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => insertMarkdown('\n| Header | Header |\n|---|---|\n| Cell | Cell |\n')} className="p-2 text-xs hover:bg-[var(--bg-color)] rounded text-left">Table</button>
                  </>
                )}

                {inputMenuLevel === 'ai' && (
                  <>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('root')} className="p-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center space-x-1 mb-1">
                      <ChevronLeft size={12} /> <span>Back</span>
                    </button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('tone')} className="p-3 text-sm hover:bg-[var(--bg-color)] rounded text-left flex items-center space-x-2">
                      <MessageSquare size={14} /> <span>Tone</span>
                    </button>
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('write')} className="p-3 text-sm hover:bg-[var(--bg-color)] rounded text-left flex items-center space-x-2">
                      <PenTool size={14} /> <span>Write for me</span>
                    </button>
                  </>
                )}

                {inputMenuLevel === 'tone' && (
                  <div className="p-2 space-y-2">
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('ai')} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center space-x-1 mb-2">
                      <ChevronLeft size={12} /> <span>Back</span>
                    </button>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block">Describe Tone/Cadence</label>
                    <textarea 
                      value={aiToneInput}
                      onChange={(e) => setAiToneInput(e.target.value)}
                      className="w-full radix-input p-2 rounded text-sm resize-none"
                      rows={3}
                      placeholder="e.g. Make it sound professional and urgent..."
                    />
                    <button 
                      onClick={async () => {
                        if (!input.trim() || !aiToneInput.trim() || isAiInputThinking) return;
                        setIsAiInputThinking(true);
                        try {
                          const res = await generateRewrite(input, aiToneInput, aiSettings);
                          if (res) setInput(res);
                          setShowInputMenu(false);
                          setInputMenuLevel('root');
                          setAiToneInput('');
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setIsAiInputThinking(false);
                        }
                      }}
                      disabled={isAiInputThinking || !input.trim() || !aiToneInput.trim()}
                      className="w-full bg-[var(--accent)] text-[var(--bg-color)] p-2 rounded text-sm font-medium flex justify-center items-center disabled:opacity-50"
                    >
                      {isAiInputThinking ? <Loader2 size={16} className="animate-spin" /> : 'Apply Tone'}
                    </button>
                  </div>
                )}

                {inputMenuLevel === 'write' && (
                  <div className="p-2 space-y-2">
                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => setInputMenuLevel('ai')} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center space-x-1 mb-2">
                      <ChevronLeft size={12} /> <span>Back</span>
                    </button>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block">What should I write?</label>
                    <textarea 
                      value={aiWriteInput}
                      onChange={(e) => setAiWriteInput(e.target.value)}
                      className="w-full radix-input p-2 rounded text-sm resize-none"
                      rows={3}
                      placeholder="e.g. Write an apology for being late..."
                    />
                    <button 
                      onClick={async () => {
                        if (!aiWriteInput.trim() || isAiInputThinking) return;
                        setIsAiInputThinking(true);
                        try {
                          const res = await generateAIResponse(`Write the following for me: ${aiWriteInput}`, 'participant', [], aiSettings);
                          if (res) {
                            const newText = input ? `${input}\n\n${res}` : res;
                            setInput(newText);
                          }
                          setShowInputMenu(false);
                          setInputMenuLevel('root');
                          setAiWriteInput('');
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setIsAiInputThinking(false);
                        }
                      }}
                      disabled={isAiInputThinking || !aiWriteInput.trim()}
                      className="w-full bg-[var(--accent)] text-[var(--bg-color)] p-2 rounded text-sm font-medium flex justify-center items-center disabled:opacity-50"
                    >
                      {isAiInputThinking ? <Loader2 size={16} className="animate-spin" /> : 'Generate'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Poll Modal */}
          {showPollModal && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)]">Create Poll</h3>
                  <button onClick={() => setShowPollModal(false)}><X size={20} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block mb-2">Question</label>
                    <input 
                      value={pollData.question}
                      onChange={(e) => setPollData({...pollData, question: e.target.value})}
                      className="w-full radix-input p-3 rounded-xl"
                      placeholder="Ask a question..."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] block mb-2">Options</label>
                    <div className="space-y-2">
                        {pollData.options.map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2">
                                <input 
                                    value={opt}
                                    onChange={(e) => {
                                        const newOptions = [...pollData.options];
                                        newOptions[i] = e.target.value;
                                        setPollData({...pollData, options: newOptions});
                                    }}
                                    className="flex-1 radix-input p-3 rounded-xl"
                                    placeholder={`Option ${i + 1}`}
                                />
                                {pollData.options.length > 2 && (
                                    <button onClick={() => {
                                        const newOptions = pollData.options.filter((_, idx) => idx !== i);
                                        setPollData({...pollData, options: newOptions});
                                    }} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg">
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {pollData.options.length < 10 && (
                            <button 
                                onClick={() => setPollData({...pollData, options: [...pollData.options, '']})}
                                className="text-xs text-[var(--accent)] font-bold uppercase hover:underline flex items-center space-x-1"
                            >
                                <Plus size={12} /> <span>Add Option</span>
                            </button>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox" 
                        checked={pollData.allowMultiple}
                        onChange={(e) => setPollData({...pollData, allowMultiple: e.target.checked})}
                        className="accent-[var(--accent)]"
                    />
                    <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Allow Multiple Answers</span>
                  </div>
                  <button 
                    onClick={handleCreatePoll}
                    className="w-full p-4 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90"
                  >
                    Create Poll
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className={`p-2 sm:p-4 radix-panel border-t border-[var(--border)] transition-all duration-75 ${isExpanded ? 'fixed inset-0 z-50 bg-[var(--bg-color)] flex flex-col' : ''}`}>
            {isExpanded && (
              <div className="flex justify-between items-center w-full p-4 border-b border-[var(--border)] bg-[var(--panel-bg)]">
                <span className="font-bold text-[var(--accent)] uppercase tracking-widest text-sm">Expanded Input</span>
                <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-[var(--bg-color)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)]">
                  <Minimize2 size={20} />
                </button>
              </div>
            )}

            {/* Reply Preview */}
            {replyingTo && !isExpanded && (
                <div className="mb-2 p-2 rounded-xl bg-[var(--panel-bg)] border-l-4 border-[var(--accent)] flex items-center justify-between animate-in slide-in-from-bottom-2">
                    <div className="flex-1 min-w-0">
                        {/* Chain View Logic */}
                        {replyingTo.replyToId ? (
                            <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                                <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center space-x-1">
                                    <Reply size={10} /> <span>Replying to thread</span>
                                </div>
                                {/* Ancestors would be rendered here if we fetched them. For now, just show immediate parent and current reply target */}
                                {/* Since we don't have easy access to full chain without recursion, let's show the immediate parent of the reply target if available in current view */}
                                {(() => {
                                    const parent = messages.find(m => m.id === replyingTo.replyToId);
                                    return parent ? (
                                        <div className="pl-2 border-l border-[var(--border)] opacity-50 mb-1">
                                            <div className="text-[10px] font-bold text-[var(--accent)]">{parent.senderName || parent.sender}</div>
                                            <div className="text-xs truncate">{parent.text || (parent.type === 'media' ? `[${parent.mediaType}]` : '')}</div>
                                        </div>
                                    ) : null;
                                })()}
                                <div>
                                    <div className="text-xs font-bold text-[var(--accent)]">{replyingTo.senderName || replyingTo.sender}</div>
                                    <div className="text-xs truncate">{replyingTo.text || (replyingTo.type === 'media' ? `[${replyingTo.mediaType}]` : '')}</div>
                                </div>
                            </div>
                        ) : (
                            // Standard Single Reply
                            <div className="flex items-center space-x-3">
                                {replyingTo.type === 'media' && replyingTo.mediaType === 'image' && (
                                    <img src={replyingTo.mediaUrl || null} alt="Preview" className="w-10 h-10 rounded object-cover" />
                                )}
                                <div>
                                    <div className="text-xs font-bold text-[var(--accent)] flex items-center space-x-1">
                                        <Reply size={12} />
                                        <span>Replying to {replyingTo.senderName || replyingTo.sender}</span>
                                    </div>
                                    <div className="text-xs truncate text-[var(--text-muted)] max-w-[200px] sm:max-w-md">
                                        {replyingTo.text || (replyingTo.type === 'media' ? `[${replyingTo.mediaType}]` : '')}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-[var(--bg-color)] rounded-full">
                        <X size={16} />
                    </button>
                </div>
            )}

            {isRecording && (
              <div className="absolute bottom-24 left-4 right-4 bg-[var(--panel-bg)] border border-[var(--accent)] p-4 rounded-xl flex items-center justify-between shadow-lg shadow-[var(--accent)]/20 animate-in slide-in-from-bottom-2">
                <div className="flex items-center space-x-3 text-[var(--accent)]">
                  <Activity className="animate-pulse" />
                  <span className="font-bold text-sm uppercase tracking-wider">
                    {recordingMode === 'vtt' ? 'Voice to Text...' : 'Recording...'}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-muted)] animate-pulse">
                  Tap mic to stop
                </div>
              </div>
            )}

            {micError && (
              <div className="absolute bottom-24 left-4 right-4 bg-red-500/10 border border-red-500 p-3 rounded-xl flex items-center justify-center text-red-500 text-xs font-bold uppercase tracking-wider animate-in slide-in-from-bottom-2">
                {micError}
              </div>
            )}

            <div className={`flex items-end space-x-2 ${isExpanded ? 'flex-1 p-4' : ''}`}>
              {!isExpanded && (
                <button 
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className={`p-3 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors ${showAttachMenu ? 'text-[var(--accent)]' : ''}`} 
                  title="Attach Media"
                >
                  <Paperclip size={20} />
                </button>
              )}
              
              <div className={`flex-1 relative flex items-end ${isExpanded ? 'h-full flex-col' : ''}`}>
                <div className={`relative w-full ${isExpanded ? 'h-full' : ''}`}>
                  {/* Smart Chip Menu */}
                  {showSmartChip && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 max-w-[calc(100vw-4rem)] bg-[var(--panel-bg)] border border-[var(--accent)] rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2">
                          <div className="p-2 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold uppercase tracking-wider border-b border-[var(--accent)]/20">
                              {smartChipType === 'root' ? 'Smart Tools' : smartChipType.toUpperCase()}
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                              {smartChipType === 'root' && (
                                  <>
                                      {['files', 'contacts', 'organizer', 'email', 'sys'].filter(t => t.startsWith(smartChipFilter)).map((tool, idx) => (
                                          <button
                                              key={tool}
                                              onClick={() => {
                                                  const newVal = input.replace(/@\w*$/, `@${tool} `);
                                                  setInput(newVal);
                                                  setSmartChipType(tool as any);
                                                  if (tool === 'files' || tool === 'sys') {
                                                      // Check mount
                                                      fsManager.verifyPermission().then(granted => {
                                                          if (!granted) setShowMountModal(true);
                                                      });
                                                  }
                                              }}
                                              className="w-full text-left p-2 hover:bg-[var(--accent)]/10 text-xs flex items-center space-x-2"
                                          >
                                              <div className="w-6 h-6 rounded bg-[var(--bg-color)] flex items-center justify-center text-[var(--accent)]">
                                                  {tool === 'files' && <FileText size={14} />}
                                                  {tool === 'contacts' && <Users size={14} />}
                                                  {tool === 'organizer' && <Calendar size={14} />}
                                                  {tool === 'email' && <Send size={14} />}
                                                  {tool === 'sys' && <Bot size={14} />}
                                              </div>
                                              <span>@{tool}</span>
                                          </button>
                                      ))}
                                  </>
                              )}
                              {(smartChipType === 'files' || smartChipType === 'sys') && (
                                  fileIndex.filter(f => f.fileName.toLowerCase().includes(smartChipFilter.replace(/^(files|sys)\s*/, ''))).map((file, idx) => (
                                      <button
                                          key={file.filePath}
                                          onClick={() => {
                                              const newVal = input.replace(/@(files|sys).*$/, `[File: ${file.filePath}] `);
                                              setInput(newVal);
                                              setShowSmartChip(false);
                                          }}
                                          className="w-full text-left p-2 hover:bg-[var(--accent)]/10 text-xs flex items-center space-x-2 truncate"
                                      >
                                          <FileText size={14} className="text-[var(--text-muted)]" />
                                          <span className="truncate">{file.fileName}</span>
                                      </button>
                                  ))
                              )}
                              {smartChipType === 'contacts' && (
                                  contacts.filter(c => c.name.toLowerCase().includes(smartChipFilter.replace(/^contacts\s*/, ''))).map((contact, idx) => (
                                      <button
                                          key={contact.id}
                                          onClick={() => {
                                              const newVal = input.replace(/@contacts.*$/, `[Contact: ${contact.name}] `);
                                              setInput(newVal);
                                              setShowSmartChip(false);
                                          }}
                                          className="w-full text-left p-2 hover:bg-[var(--accent)]/10 text-xs flex items-center space-x-2"
                                      >
                                          <Users size={14} className="text-[var(--text-muted)]" />
                                          <span>{contact.name}</span>
                                      </button>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInput(val);
                      
                      // Smart Chip Logic
                      const lastSpaceIndex = val.lastIndexOf(' ');
                      const lastNewlineIndex = val.lastIndexOf('\n');
                      const lastSeparatorIndex = Math.max(lastSpaceIndex, lastNewlineIndex);
                      const lastWord = val.substring(lastSeparatorIndex + 1);
                      
                      if (lastWord && lastWord.startsWith('@')) {
                          const query = lastWord.substring(1).toLowerCase();
                          // Check if it matches a known trigger prefix or is just '@'
                          if (['files', 'contacts', 'organizer', 'email', 'sys'].some(t => t.startsWith(query)) || query === '') {
                              setShowSmartChip(true);
                              setSmartChipFilter(query);
                              // If exact match, switch type
                              if (query === 'files') setSmartChipType('files');
                              else if (query === 'contacts') setSmartChipType('contacts');
                              else if (query === 'sys') setSmartChipType('sys');
                              else if (query === 'organizer') setSmartChipType('root'); // Organizer is a tool, not a list yet
                              else if (query === 'email') setSmartChipType('root');
                              else setSmartChipType('root');
                          } else {
                              setShowSmartChip(false);
                          }
                      } else {
                          setShowSmartChip(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      // Enter is not send anymore, it just inserts a newline
                    }}
                    onKeyUp={(e) => {
                      // Enter is not send anymore
                    }}
                    onPointerDown={() => {
                      longPressTimerRef.current = setTimeout(handleInputLongPress, 500);
                    }}
                    onPointerUp={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    onPointerLeave={() => {
                      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                    }}
                    placeholder={isRecording ? (recordingMode === 'vtt' ? "Recording VTT..." : "Recording Voice Note...") : "Message"}
                    disabled={isRecording}
                    className={`w-full radix-input p-3 rounded-2xl resize-none text-sm ${isExpanded ? 'h-full' : 'min-h-[44px] max-h-[120px] sm:max-h-[320px] overflow-y-auto'} ${isRecording ? 'opacity-50' : ''} ${!isExpanded ? 'pr-10' : ''}`}
                    rows={isExpanded ? undefined : 1}
                    style={!isExpanded ? { height: 'auto', minHeight: '44px', fontFamily: 'var(--font-chat)' } : { fontFamily: 'var(--font-chat)' }}
                    onInput={(e) => {
                      if (!isExpanded) {
                        const target = e.target as HTMLTextAreaElement;
                        const isShrinking = target.value.length < (target.dataset.prevLength ? parseInt(target.dataset.prevLength) : 0);
                        target.dataset.prevLength = target.value.length.toString();
                        if (isShrinking) {
                          target.style.height = 'auto';
                        }
                        const maxHeight = window.innerWidth < 640 ? 120 : 320;
                        target.style.height = `${Math.min(target.scrollHeight, maxHeight)}px`;
                      }
                    }}
                  />
                  {!isExpanded && (
                    <button 
                      onClick={() => setIsExpanded(true)} 
                      className="absolute right-2 bottom-2 p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] rounded-lg"
                    >
                      <Maximize2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className={`flex flex-col space-y-2 ${isExpanded ? 'mt-4 items-end' : ''}`}>
                {isProcessing ? (
                  <button 
                    onClick={() => {
                        abortControllerRef.current = true;
                        setIsProcessing(false);
                    }}
                    className="p-3 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 w-12 h-12 bg-red-500 text-white"
                    title="Stop AI"
                  >
                    <Square size={24} fill="currentColor" />
                  </button>
                ) : input.trim() ? (
                  <button 
                    onClick={handleSendClick}
                    className="p-3 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 w-12 h-12"
                    style={{ background: 'var(--accent-gradient)', color: '#000' }}
                    title="Send"
                  >
                    <Send size={24} />
                  </button>
                ) : transcriptionError ? (
                    <div className="flex flex-col space-y-2 animate-in slide-in-from-bottom-2">
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500 flex flex-col space-y-2">
                            <div className="flex items-center justify-between text-red-500">
                                <span className="text-[10px] font-bold uppercase tracking-wider">Transcription Failed</span>
                                <button onClick={copyErrorToClipboard} className="p-1 hover:bg-red-500/20 rounded">
                                    <Copy size={12} />
                                </button>
                            </div>
                            <div className="flex space-x-2">
                                <button 
                                    onClick={handleRetryTranscription}
                                    className="flex-1 p-2 rounded-lg bg-red-500 text-white text-xs font-bold uppercase hover:opacity-90"
                                >
                                    Try Again
                                </button>
                                <button 
                                    onClick={handleCancelTranscription}
                                    className="flex-1 p-2 rounded-lg bg-transparent border border-red-500 text-red-500 text-xs font-bold uppercase hover:bg-red-500/10"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                  <button 
                    ref={micButtonRef}
                    onMouseDown={(e) => e.preventDefault()}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    disabled={isProcessing || isTranscoding}
                    className={`p-3 rounded-full flex items-center justify-center transition-colors shadow-lg relative z-20 select-none touch-none w-11 h-11 ${
                      isProcessing || isTranscoding
                        ? 'bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed opacity-50'
                        : noSpeechDetected 
                            ? 'bg-yellow-500 text-black scale-110'
                            : isRecording && recordingMode === 'vtt'
                              ? 'bg-blue-500 text-white animate-pulse scale-110'
                              : isRecording 
                                ? 'bg-red-500 text-white animate-pulse scale-110' 
                                : 'bg-white/5 text-[var(--accent)] hover:bg-white/10'
                    }`}
                    style={{ 
                        transform: `translateX(${Math.min(0, Math.max(-100, swipeOffset))}px)`,
                        ...(!isProcessing && !isTranscoding && !noSpeechDetected && !isRecording ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' } : {})
                    }}
                    title={isTranscoding ? "Transcoding Media..." : isProcessing ? "Processing..." : "Tap to Record (Hold to Transcribe)"}
                  >
                    {isTranscoding ? (
                        <div className="flex items-center space-x-2 text-xs font-bold uppercase">
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : isProcessing ? (
                        <div className="flex items-center space-x-2">
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : noSpeechDetected ? (
                        <div className="flex items-center space-x-2 animate-in zoom-in">
                            <span className="text-xl font-bold">!</span>
                        </div>
                    ) : isRecording && recordingMode === 'vtt' ? (
                      <div className="flex items-center space-x-2 animate-pulse">
                        <Headphones size={20} />
                      </div>
                    ) : (
                      isRecording ? <Square size={20} /> : <Mic size={20} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recording Overlay for Cancel on Outside Tap */}
          {isRecording && (
            <div 
              className="fixed inset-0 z-10 bg-transparent" 
              onClick={(e) => {
                e.stopPropagation();
                stopRecording(true); // Cancel recording on outside tap
              }}
            />
          )}
          
          {/* New Chat FAB */}
          {!activeContext && (
            <DraggableFab
                icon={<MessageSquare size={28} />}
                onClick={handleNewChat}
                storageKey="new_chat_fab_pos"
                defaultPosition={{ x: window.innerWidth - 80, y: window.innerHeight - 120 }}
                className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
                style={{ background: 'var(--accent-gradient)', color: '#000' }}
            />
          )}
        </div>
        )
      )}
      
      {/* Mount Modal */}
      {showMountModal && (
          <MountModal 
              onClose={() => setShowMountModal(false)}
              onMount={async () => {
                  // Trigger indexing
                  await fsManager.index();
                  const files = await getFileIndex();
                  setFileIndex(files);
              }}
          />
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-4 animate-in zoom-in-95 h-[80vh] flex flex-col">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)]">New Chat</h3>
              <button onClick={() => setShowNewChatModal(false)}><X size={20} /></button>
            </div>
            
            <div className="p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] space-y-2">
                <div className="text-xs font-bold uppercase text-[var(--text-muted)]">My Connection ID</div>
                <div className="flex items-center space-x-2">
                    <code className="flex-1 p-2 bg-[var(--bg-color)] rounded border border-[var(--border)] text-xs font-mono truncate select-all">
                        {myPeerId || 'Connecting...'}
                    </code>
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(myPeerId);
                            // Visual feedback could be added here
                        }}
                        className="p-2 hover:bg-[var(--bg-color)] rounded border border-[var(--border)]"
                        title="Copy ID"
                    >
                        <Copy size={16} />
                    </button>
                </div>
                <div className="text-[10px] text-[var(--text-muted)]">
                    Share this ID with others so they can add you.
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {contacts.length === 0 && !isAddingContact && (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No contacts found.</p>
                  <button onClick={() => setIsAddingContact(true)} className="mt-4 text-[var(--accent)] hover:underline">Add your first contact</button>
                </div>
              )}

              {contacts.map(contact => (
                <div 
                  key={contact.id}
                  onClick={() => toggleContactSelection(contact.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                    selectedContacts.includes(contact.id) 
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)]' 
                      : 'bg-[var(--panel-bg)] border-[var(--border)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--bg-color)] flex items-center justify-center border border-[var(--border)]">
                      {contact.avatar ? (
                        <img src={contact.avatar || null} alt={contact.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="font-bold text-[var(--accent)]">{contact.name[0]}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{contact.name}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">{contact.number}</div>
                    </div>
                  </div>
                  {selectedContacts.includes(contact.id) && <CheckCircle size={16} className="text-[var(--accent)]" />}
                </div>
              ))}

              {isAddingContact && (
                <div className="p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] space-y-3 animate-in fade-in">
                  <h4 className="text-xs font-bold uppercase text-[var(--text-muted)]">Add New Contact</h4>
                  <input 
                    type="text" 
                    placeholder="Name" 
                    value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    className="w-full radix-input p-2 text-sm rounded-lg"
                  />
                  <input 
                    type="text" 
                    placeholder="Number / ID" 
                    value={newContactNumber}
                    onChange={e => setNewContactNumber(e.target.value)}
                    className="w-full radix-input p-2 text-sm rounded-lg"
                  />
                  <div className="flex space-x-2">
                    <button onClick={handleCreateContact} className="flex-1 py-2 bg-[var(--accent)] text-black rounded-lg text-xs font-bold uppercase">Save</button>
                    <button onClick={() => setIsAddingContact(false)} className="flex-1 py-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-lg text-xs font-bold uppercase">Cancel</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex space-x-2 pt-4 border-t border-[var(--border)]">
              {!isAddingContact && (
                <button 
                  onClick={() => setIsAddingContact(true)}
                  className="p-3 rounded-xl bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <UserPlus size={20} />
                </button>
              )}
              <button 
                onClick={handleStartNewChat}
                disabled={selectedContacts.length === 0}
                className="flex-1 p-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {selectedContacts.length > 1 ? (
                  <>
                    <Users size={18} />
                    <span>Create Group ({selectedContacts.length})</span>
                  </>
                ) : (
                  <>
                    <MessageSquare size={18} />
                    <span>Start Chat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScanning && (
        <CodeScanner 
          onScan={handleScan} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      {/* Scan Result Modal */}
      {scanResult && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-color)] border border-[var(--border)] rounded-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase tracking-widest text-[var(--accent)]">Scan Result</h3>
              <button onClick={() => setScanResult(null)}><X size={20} /></button>
            </div>
            
            <div className="p-4 bg-[var(--panel-bg)] rounded-xl border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)]">{scanResult.type}</span>
                {scanResult.image && (
                   <img src={scanResult.image || null} alt="Scan" className="w-8 h-8 object-cover rounded border border-[var(--border)]" />
                )}
              </div>
              <p className="text-sm break-all font-mono">{scanResult.text}</p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {(scanResult.text.startsWith('http://') || scanResult.text.startsWith('https://')) && (
                <button 
                  onClick={() => handleScanResultAction('link')}
                  className="w-full p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] flex items-center justify-center space-x-2"
                >
                  <ExternalLink size={16} /> <span>Open Link</span>
                </button>
              )}
              
              <button 
                onClick={() => handleScanResultAction('ai')}
                className="w-full p-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 flex items-center justify-center space-x-2"
              >
                <Bot size={16} /> <span>Ask AI</span>
              </button>

              <button 
                onClick={() => handleScanResultAction('copy')}
                className="w-full p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--border)] hover:border-[var(--accent)] flex items-center justify-center space-x-2"
              >
                <Copy size={16} /> <span>Copy to Clipboard</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[var(--panel-bg)] border border-[var(--border)] p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4">
                <h3 className="text-lg font-bold mb-2 text-[var(--text-main)]">Delete Messages?</h3>
                <p className="text-[var(--text-muted)] mb-6">
                    Are you sure you want to delete {deleteConfirmation.count} message{deleteConfirmation.count > 1 ? 's' : ''}? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                    <button 
                        onClick={() => setDeleteConfirmation(prev => ({ ...prev, isOpen: false }))}
                        className="px-4 py-2 rounded-xl hover:bg-[var(--bg-color)] font-medium text-[var(--text-main)]"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={performDelete}
                        className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Image Gen Overlay */}
      {showImageGenOverlay && (
        <ImageGenOverlay 
          initialPrompt={showImageGenOverlay.text || ''}
          onClose={() => setShowImageGenOverlay(null)}
          onGenerate={async (blob, prompt) => {
            try {
              const base64 = await blobToBase64(blob);
              const newMsg = {
                id: crypto.randomUUID(),
                text: prompt,
                sender: 'me',
                timestamp: Date.now(),
                type: 'media',
                mediaType: 'image',
                mediaUrl: base64,
                isAiChat: isAiExclusive,
                threadId: isAiExclusive && activeContext ? activeContext.id : undefined,
                groupId: !isAiExclusive && activeTab === 'groups' && activeContext ? activeContext.id : undefined,
                isAiGenerated: true
              };
              await saveAndAddMessage(newMsg);
            } catch (err) {
              console.error("Failed to save generated image:", err);
            }
          }}
        />
      )}
    </div>
  );
});

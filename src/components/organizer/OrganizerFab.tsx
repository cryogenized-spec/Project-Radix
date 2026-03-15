import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, X, Loader2, Send, StopCircle, Type, FileText, CheckSquare, Calendar, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAIResponse, transcribeAudio } from '../../lib/gemini';
import { getAgents, getSetting } from '../../lib/db';
import { db as organizerDb } from '../../lib/organizerDb';

interface OrganizerFabProps {
    onNotification?: (message: string, undo?: () => void) => void;
    onNavigate?: (view: string) => void;
}

export default function OrganizerFab({ onNotification, onNavigate }: OrganizerFabProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [thread, setThread] = useState<any[]>([]);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('text');
  const [inputValue, setInputValue] = useState('');
  const [lastUndoOperations, setLastUndoOperations] = useState<any[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFabClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleAgentClick = () => {
      setInputMode('text');
      setShowOverlay(true);
      setIsMenuOpen(false);
  };

  const startRecording = async () => {
    setInputMode('voice');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            await processAudio(audioBlob);
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (mediaRecorderRef.current && isRecording) {
        if (cancel) {
            audioChunksRef.current = [];
        }
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        if (!cancel) {
            setIsProcessing(true);
        }
    }
  };

  const processAudio = async (audioBlob: Blob) => {
      if (audioBlob.size === 0) return; // Cancelled
      
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          const mimeType = audioBlob.type || 'audio/webm';
          
          // Get STT Key from Lockbox
          const sttKeys = await getSetting('stt_api_keys') || {};
          const sttKey = sttKeys['Google Cloud'] || sttKeys['OpenAI (ChatGPT 4o)'] || process.env.GEMINI_API_KEY;

          // Transcribe
          const text = await transcribeAudio(base64Audio, mimeType, { apiKey: sttKey });
          
          if (text === "NO_SPEECH" || text.startsWith("ERR:")) {
              setTranscript("Could not hear you clearly.");
              setThread(prev => [...prev, { role: 'model', content: "I couldn't hear you clearly. Please try again or type your request.", timestamp: Date.now() }]);
              setIsProcessing(false);
          } else {
              setTranscript(text);
              handleSubmission(text);
          }
      };
  };

  const handleUndo = async () => {
      if (lastUndoOperations.length === 0) return;
      setIsProcessing(true);
      try {
          for (const op of lastUndoOperations) {
              const dbTable = op.type === 'event' ? organizerDb.events : op.type === 'task' ? organizerDb.tasks : organizerDb.notes;
              if (op.action === 'delete') await dbTable.delete(op.id);
              if (op.action === 'update') await dbTable.update(op.id, op.data);
              if (op.action === 'create') {
                  // For create, we restore the exact old object including its ID
                  await dbTable.put(op.data);
              }
          }
          setLastUndoOperations([]);
          setThread(prev => [...prev, { role: 'model', content: "I've undone the previous actions.", timestamp: Date.now() }]);
          if (onNotification) onNotification("Actions undone");
      } catch (e) {
          console.error("Undo failed", e);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleSubmission = async (text: string) => {
    // 1. Add user message to thread
    const userMsg = { role: 'user', content: text, timestamp: Date.now() };
    setThread(prev => [...prev, userMsg]);

    // 2. Get Pinned Agent (Blue Pin for Organizer)
    const agents = await getAgents();
    const organizerAgent = agents?.find((a: any) => a.isOrganizer);
    
    // Use Pinned Agent or Default
    const agentName = organizerAgent ? organizerAgent.name : "Organizer Agent";
    const agentPersona = organizerAgent ? 
        (organizerAgent.organizerMode === 'public' ? organizerAgent.publicPersona : organizerAgent.privatePersona) 
        : "You are an efficient personal organizer.";

    // 3. Gather Context
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const upcomingEvents = await organizerDb.events.where('date').aboveOrEqual(startOfToday).toArray();
    const allTasks = await organizerDb.tasks.toArray();
    const activeTasks = allTasks.filter(t => !t.completed);
    const recentNotes = await organizerDb.notes.orderBy('updatedAt').reverse().limit(10).toArray();

    const contextData = {
        upcomingEvents: upcomingEvents.map(e => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, duration: e.duration })),
        activeTasks: activeTasks.map(t => ({ id: t.id, title: t.title })),
        recentNotes: recentNotes.map(n => ({ id: n.id, title: n.title || 'Untitled Note' }))
    };

    // 4. Send to AI
    const prompt = `
    SYSTEM INSTRUCTION:
    You are ${agentName}. ${agentPersona}
    
    Your CURRENT OBJECTIVE is to process the user's request into structured actions for the Organizer Module (Calendar, Tasks, Notes).
    
    USER INPUT: "${text}"
    
    CURRENT CONTEXT (Existing Data):
    ${JSON.stringify(contextData, null, 2)}
    
    INSTRUCTIONS:
    1. Analyze the input for intent. You can perform MULTIPLE actions at once.
       - Calendar Event (create, update, delete)
       - Task (create, update, delete)
       - Note (create, update, delete)
    
    2. You can LINK items together. For example, if creating a task for an event, add the event's ID to the task's \`linkedEventId\` field.
       - Use reciprocal links where appropriate.
       - Notes support full Markdown (including Obsidian-style formatting).
    
    3. EXTRACT or INFER the following JSON structure. ALWAYS return a JSON ARRAY of action objects.
    
    JSON FORMAT:
    \`\`\`json
    [
      {
        "type": "event" | "task" | "note",
        "action": "create" | "update" | "delete",
        "id": "ID of existing item (ONLY for update/delete)",
        "data": {
          // For Event: "title", "date" (YYYY-MM-DD), "startTime" (HH:mm), "duration" (mins), "linkedTaskId", "linkedNoteId"
          // For Task: "title", "linkedEventId", "linkedNoteId"
          // For Note: "title", "content" (Markdown string), "linkedEventId", "linkedTaskId", "isFolder" (boolean), "parentId" (string ID of parent folder)
        }
      }
    ]
    \`\`\`
    
    4. After the JSON block, provide a very brief, natural confirmation message in your persona.
    
    Current Date: ${new Date().toISOString()}
    `;

    try {
        // Use Agent's API Key if available, else global
        const globalKeys = await getSetting('api_keys') || {};
        const apiKey = organizerAgent?.apiKey || globalKeys[organizerAgent?.provider || 'Google'] || process.env.GEMINI_API_KEY;

        const historyContext = thread.map(msg => ({
            sender: msg.role === 'user' ? 'me' : 'bot',
            text: msg.content
        }));

        const response = await generateAIResponse(prompt, 'participant', historyContext, { 
            apiKey, 
            model: organizerAgent?.model || 'gemini-3-flash-preview',
            publicPersona: "You are an executive function engine. Output JSON actions." // Override persona for this specific functional call to ensure JSON
        });
        
        // Parse response for JSON
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
        let aiContent = response;
        
        if (jsonMatch) {
            try {
                const actions = JSON.parse(jsonMatch[1]);
                aiContent = response.replace(/```json[\s\S]*?```/, '').trim();
                
                const undoOps = [];
                let actionSummary = [];

                for (const action of (Array.isArray(actions) ? actions : [actions])) {
                    const dbTable = action.type === 'event' ? organizerDb.events : action.type === 'task' ? organizerDb.tasks : organizerDb.notes;
                    
                    if (action.action === 'create') {
                        const newObj = {
                            ...action.data,
                            ...(action.type === 'task' ? { completed: false, orderIndex: 0 } : {}),
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        };
                        // @ts-ignore
                        const id = await dbTable.add(newObj);
                        undoOps.push({ type: action.type, action: 'delete', id });
                        actionSummary.push(`Created ${action.type}`);
                    } else if (action.action === 'update' && action.id) {
                        // @ts-ignore
                        const old = await dbTable.get(action.id);
                        if (old) {
                            // @ts-ignore
                            await dbTable.update(action.id, { ...action.data, updatedAt: Date.now() });
                            undoOps.push({ type: action.type, action: 'update', id: action.id, data: old });
                            actionSummary.push(`Updated ${action.type}`);
                        }
                    } else if (action.action === 'delete' && action.id) {
                        // @ts-ignore
                        const old = await dbTable.get(action.id);
                        if (old) {
                            // @ts-ignore
                            await dbTable.delete(action.id);
                            undoOps.push({ type: action.type, action: 'create', data: old });
                            actionSummary.push(`Deleted ${action.type}`);
                        }
                    }
                }
                
                setLastUndoOperations(undoOps);
                if (onNotification && actionSummary.length > 0) {
                    onNotification(actionSummary.join(', '));
                }
            } catch (e) {
                console.error("Failed to execute AI action", e);
            }
        }

        const aiMsg = { 
            role: 'model', 
            content: aiContent || "Done.", 
            timestamp: Date.now() 
        };
        setThread(prev => [...prev, aiMsg]);
        
        // Persist thread
        await organizerDb.threads.add({
            type: 'organizer',
            messages: [userMsg, aiMsg],
            linkedEntityIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

    } catch (e) {
        setThread(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error processing your request.", timestamp: Date.now() }]);
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <>
      {/* FAB - Centered using fixed positioning relative to viewport width */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
        {/* Petals */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Petal 1: New Note */}
              <motion.button
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: -70, y: -50 }}
                exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                onClick={async () => {
                  // @ts-ignore
                  const id = await organizerDb.notes.add({ content: '# New Note\n\n', createdAt: Date.now(), updatedAt: Date.now(), isFolder: false, orderIndex: 0 });
                  setIsMenuOpen(false);
                  if (onNotification) onNotification("Created new note");
                  if (onNavigate) onNavigate('notes');
                  window.dispatchEvent(new CustomEvent('organizer:open-note', { detail: { id } }));
                }}
                className="absolute w-12 h-12 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] shadow-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors z-40"
                title="Create Note"
              >
                <FileText size={20} />
              </motion.button>

              {/* Petal 2: Invoke Agent */}
              <motion.button
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: 0, y: -80 }}
                exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut", delay: 0.03 }}
                onClick={handleAgentClick}
                className={`absolute w-14 h-14 rounded-full border shadow-lg flex items-center justify-center transition-colors z-40 ${
                  isRecording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-[var(--accent)] border-[var(--accent)] text-black hover:scale-105'
                }`}
                title="Invoke Agent"
              >
                {isRecording ? <Mic size={24} /> : <Sparkles size={24} />}
              </motion.button>

              {/* Petal 3: Create Task */}
              <motion.button
                initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, scale: 1, x: 70, y: -50 }}
                exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                transition={{ duration: 0.15, ease: "easeOut", delay: 0.06 }}
                onClick={async () => {
                  // @ts-ignore
                  const id = await organizerDb.tasks.add({ title: 'New Task', completed: false, createdAt: Date.now(), updatedAt: Date.now(), orderIndex: 0 });
                  setIsMenuOpen(false);
                  if (onNotification) onNotification("Created new task");
                  if (onNavigate) onNavigate('tasks');
                  window.dispatchEvent(new CustomEvent('organizer:open-task', { detail: { id } }));
                }}
                className="absolute w-12 h-12 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] shadow-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors z-40"
                title="Create Task"
              >
                <CheckSquare size={20} />
              </motion.button>
            </>
          )}
        </AnimatePresence>

        {/* Main Button */}
        <button
          onClick={handleFabClick}
          className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all z-50 ${
            isMenuOpen ? 'bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-muted)] rotate-45' : 'bg-[var(--accent)] text-black hover:scale-105'
          }`}
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center p-4"
          >
            <div className="w-full max-w-md bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-color)]">
                <h3 className="font-bold uppercase tracking-widest text-[var(--accent)] flex items-center gap-2">
                    <Loader2 size={16} className={isProcessing ? "animate-spin" : "opacity-0"} />
                    Organizer AI
                </h3>
                <button onClick={() => setShowOverlay(false)} className="p-1 hover:bg-[var(--panel-bg)] rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-color)]">
                {thread.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-xl text-[13px] ${
                      msg.role === 'user' 
                        ? 'bg-[var(--accent)] text-black rounded-tr-none' 
                        : 'bg-[var(--panel-bg)] border border-[var(--border)] rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {lastUndoOperations.length > 0 && !isProcessing && (
                    <div className="flex justify-start">
                        <button 
                            onClick={handleUndo}
                            className="text-xs bg-[var(--bg-color)] border border-[var(--border)] px-3 py-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--text-main)] transition-colors"
                        >
                            Undo last action
                        </button>
                    </div>
                )}
                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--panel-bg)] border border-[var(--border)] p-3 rounded-xl rounded-tl-none flex space-x-1">
                            <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
              </div>

              <div className="p-3 border-t border-[var(--border)] bg-[var(--panel-bg)] flex items-center gap-2">
                <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isRecording ? "Listening..." : "Type a message or tap mic..."}
                    className={`flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded-full px-4 py-2 text-[13px] focus:border-[var(--accent)] outline-none ${isRecording ? 'opacity-50 pointer-events-none' : ''}`}
                    autoFocus={inputMode === 'text'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && inputValue.trim() && !isRecording) {
                            handleSubmission(inputValue);
                            setInputValue('');
                        }
                    }}
                />
                <button 
                    className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                        inputValue.trim() 
                            ? 'bg-[var(--accent)] text-black' 
                            : isRecording 
                                ? 'bg-red-500 text-white animate-pulse' 
                                : 'bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
                    }`}
                    onClick={() => {
                        if (inputValue.trim()) {
                            handleSubmission(inputValue);
                            setInputValue('');
                        } else {
                            if (isRecording) {
                                stopRecording();
                            } else {
                                startRecording();
                            }
                        }
                    }}
                >
                    {inputValue.trim() ? <Send size={18} /> : isRecording ? <StopCircle size={18} /> : <Mic size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

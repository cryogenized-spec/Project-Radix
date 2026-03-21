import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Edit2, Trash2, MoreVertical, PanelLeftClose, PanelLeftOpen, Sparkles, Download, Eye, EyeOff, FolderPlus, Brain, Languages, Code, Image as ImageIcon, Check, X as XIcon, Copy, Network, Search, LayoutTemplate } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { db, Note } from '../../lib/organizerDb';
import { getSetting } from '../../lib/db';
import { transformToMarkdown, executePromptOnNote, generateAIResponse } from '../../lib/gemini';
import { parseMarkdown, stringifyMarkdown } from '../../lib/markdownUtils';
import NotesSidebar from './NotesSidebar';
import MobileNotesList from './MobileNotesList';
import NotesGraphView from './NotesGraphView';
import HybridNoteView from './HybridNoteView';
import PropertyEditor from './PropertyEditor';
import CommandPalette from '../CommandPalette';

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');
  
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippet.${language || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!inline && match) {
    return (
      <div className="relative my-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[#1e1e1e]">
        <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-[#404040]">
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{language}</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopy}
              className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
              title="Copy code"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
            <button 
              onClick={handleDownload}
              className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
              title="Download snippet"
            >
              <Download size={14} />
            </button>
          </div>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={language}
          PreTag="div"
          showLineNumbers={true}
          customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className={`${className} bg-[var(--panel-bg)] px-1.5 py-0.5 rounded text-[var(--accent)]`} {...props}>
      {children}
    </code>
  );
};

export default function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTransforming, setIsTransforming] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewMode, setViewMode] = useState<'list' | 'folders' | 'graph' | 'canvas'>('list');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Context Menu State
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState({ start: 0, end: 0, text: '' });
  const [showSubMenu, setShowSubMenu] = useState<'think' | 'translate' | 'codify' | null>(null);
  const [codifyPromptLang, setCodifyPromptLang] = useState<string | null>(null);
  const [codifyInput, setCodifyInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [notesFontSize, setNotesFontSize] = useState(14);
  const [notesListTileSize, setNotesListTileSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  // Ephemeral AI Text State
  const [ephemeralText, setEphemeralText] = useState<{ text: string, start: number, end: number } | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    const loadSettings = async () => {
      try {
        const settings = await db.getUserSettings();
        if (settings) {
          if (settings.notesFontSize) setNotesFontSize(settings.notesFontSize);
          if (settings.notesListTileSize) setNotesListTileSize(settings.notesListTileSize);
        }
      } catch (error) {
        console.error('Failed to load settings', error);
      }
    };
    loadSettings();
    window.addEventListener('settings:updated', loadSettings);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('settings:updated', loadSettings);
    };
  }, []);

  useEffect(() => {
    loadNotes();

    const handleOpenNote = async (e: any) => {
      const detail = e.detail;
      let note;
      if (typeof detail === 'string') {
        // Try to find by title first
        const allNotes = await db.notes.toArray();
        note = allNotes.find(n => n.title.toLowerCase() === detail.toLowerCase());
        if (!note) {
          // Fallback to ID
          note = await db.notes.get(detail);
        }
      } else if (detail && detail.id) {
        note = await db.notes.get(detail.id);
      }
      
      if (note) {
        setSelectedNote(note);
        setEditContent(note.content);
        setIsEditing(true);
        setPreviewMode(false);
      }
    };

    window.addEventListener('organizer:open-note', handleOpenNote);
    return () => window.removeEventListener('organizer:open-note', handleOpenNote);
  }, []);

  // View Mode Context Menu State
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [viewMenuPos, setViewMenuPos] = useState({ x: 0, y: 0 });
  const viewLongPressTimer = useRef<NodeJS.Timeout | null>(null);

  const preprocessMarkdown = (text: string) => {
    return text.replace(/\[\[(note|task|cal):([^\]]+)\]\]/g, '[$2](#radix-link:$1:$2)');
  };

  const LinkRenderer = ({ href, children, ...props }: any) => {
    if (href?.startsWith('#radix-link:')) {
      const [, type, value] = href.split(':');
      let icon = '';
      let color = '';
      if (type === 'note') { icon = '📝'; color = 'text-blue-400'; }
      else if (type === 'task') { icon = '✅'; color = 'text-emerald-400'; }
      else if (type === 'cal') { icon = '📅'; color = 'text-purple-400'; }

      return (
        <span 
          className={`inline-flex items-center px-1.5 py-0.5 mx-1 rounded bg-[var(--panel-bg)] border border-[var(--border)] text-xs font-bold cursor-pointer hover:bg-[var(--accent)] hover:text-black transition-colors ${color}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('radix:open-link', { detail: { type, value } }));
          }}
        >
          <span className="mr-1">{icon}</span>
          {children}
        </span>
      );
    }
    return <a href={href} {...props}>{children}</a>;
  };

  const handleViewTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const touch = 'touches' in e ? e.touches[0] : e;
    viewLongPressTimer.current = setTimeout(() => {
      setShowViewMenu(true);
      setViewMenuPos({ x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const handleViewTouchEnd = () => {
    if (viewLongPressTimer.current) {
      clearTimeout(viewLongPressTimer.current);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      if (showContextMenu) {
        setShowContextMenu(false);
        setShowSubMenu(null);
        setCodifyPromptLang(null);
        setCodifyInput('');
      }
      if (showViewMenu) {
        setShowViewMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showContextMenu, showViewMenu]);

  useEffect(() => {
    if (isEditing && !previewMode && textareaRef.current) {
      textareaRef.current.focus();
      // Optional: move cursor to the end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing, previewMode, selectedNote]);

  const loadNotes = async () => {
    const loadedNotes = await db.notes.orderBy('updatedAt').reverse().toArray();
    setNotes(loadedNotes);
  };

  const handleEdit = (note: Note) => {
    setSelectedNote(note);
    setEditContent(note.content);
    setIsEditing(true);
    setPreviewMode(false);
    setSuggestions([]);
  };

  // Auto-save effect
  useEffect(() => {
    if (!isEditing || !selectedNote) return;

    const timer = setTimeout(async () => {
      if (selectedNote.content !== editContent) {
        await db.notes.update(selectedNote.id!, { content: editContent, updatedAt: Date.now() });
        // Update the selected note locally to prevent re-triggering if not needed,
        // but since we don't update selectedNote.content here, it might trigger again if we rely on it.
        // Actually, just updating the DB is fine.
        // We should also update the notes list so the sidebar reflects changes.
        const loadedNotes = await db.notes.orderBy('updatedAt').reverse().toArray();
        setNotes(loadedNotes);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [editContent, isEditing, selectedNote]);

  const handleSave = async () => {
    if (!selectedNote) return;
    await db.notes.update(selectedNote.id!, { content: editContent, updatedAt: Date.now() });
    setIsEditing(false);
    setPreviewMode(false);
    setSuggestions([]);
    loadNotes();
  };

  const handleDelete = async (noteId: string) => {
    await db.notes.delete(noteId);
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
      setIsEditing(false);
      setPreviewMode(false);
      setSuggestions([]);
    }
    loadNotes();
  };

  const handleTransform = async () => {
    if (!editContent) return;
    setIsTransforming(true);
    try {
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      const { markdown, suggestions } = await transformToMarkdown(editContent, { apiKey });
      setEditContent(markdown);
      setSuggestions(suggestions);
    } catch (error) {
      console.error("Failed to transform:", error);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleExecutePrompt = async (prompt: string) => {
    if (!editContent) return;
    setIsTransforming(true);
    setSuggestions([]);
    try {
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      const { markdown, suggestions: newSuggestions } = await executePromptOnNote(editContent, prompt, { apiKey });
      setEditContent(markdown);
      setSuggestions(newSuggestions);
    } catch (error) {
      console.error("Failed to execute prompt:", error);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleExportObsidian = () => {
    if (!selectedNote) return;
    const contentToExport = isEditing ? editContent : selectedNote.content;
    const title = contentToExport.split('\n')[0].replace(/#/g, '').trim() || 'Untitled';
    const blob = new Blob([contentToExport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const textareaLongPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTextareaTouchStart = (e: React.TouchEvent<HTMLTextAreaElement>) => {
    const touch = e.touches[0];
    const target = e.currentTarget;
    textareaLongPressTimer.current = setTimeout(() => {
      setSelection({
        start: target.selectionStart,
        end: target.selectionEnd,
        text: target.value.substring(target.selectionStart, target.selectionEnd)
      });
      setContextMenuPos({ x: touch.clientX, y: touch.clientY });
      setShowContextMenu(true);
      setShowSubMenu(null);
    }, 500);
  };

  const handleTextareaTouchEnd = () => {
    if (textareaLongPressTimer.current) {
      clearTimeout(textareaLongPressTimer.current);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const textarea = e.currentTarget;
    setSelection({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
    });
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    setShowSubMenu(null);
  };

  const handleAIAction = async (prompt: string) => {
    setShowContextMenu(false);
    setIsTransforming(true);
    try {
      const keys = await getSetting('api_keys') || {};
      const { decryptApiKey } = await import('../../lib/apiKeyCrypto');
      const apiKey = keys['Google'] ? await decryptApiKey(keys['Google']) : process.env.GEMINI_API_KEY;
      const aiPrompt = selection.text 
        ? `You are an expert editor. Modify or generate text based on the following instruction and the selected text. Return ONLY the new text, no conversational filler.\n\nInstruction: ${prompt}\n\nSelected Text:\n${selection.text}`
        : `You are an expert editor. Generate text based on the following instruction. Return ONLY the new text, no conversational filler.\n\nInstruction: ${prompt}`;
        
      const response = await generateAIResponse(
        aiPrompt,
        'participant',
        [],
        { apiKey }
      );
      
      setEphemeralText({
        text: response.trim(),
        start: selection.start,
        end: selection.end
      });
    } catch (error) {
      console.error("AI Action Error:", error);
    } finally {
      setIsTransforming(false);
    }
  };

  const handleAcceptEphemeral = () => {
    if (!ephemeralText) return;
    const newContent = editContent.substring(0, ephemeralText.start) + ephemeralText.text + editContent.substring(ephemeralText.end);
    setEditContent(newContent);
    setEphemeralText(null);
  };

  const handleRejectEphemeral = () => {
    setEphemeralText(null);
  };

  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Compress to max 1080p
            const MAX_SIZE = 1080;
            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG with 0.8 quality
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            const imgMarkdown = `\n![${file.name}](${compressedBase64})\n`;
            setEditContent(prev => prev + imgMarkdown);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
    setShowContextMenu(false);
  };

  if (isMobile && !selectedNote) {
    if (viewMode === 'graph' || viewMode === 'canvas') {
      return (
        <div className="flex flex-col h-full bg-[var(--bg-color)] relative">
          <div className="px-4 pt-6 pb-2 flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)] capitalize">{viewMode}</h1>
            <button 
              onClick={() => setViewMode('list')}
              className="p-2 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl text-[var(--accent)]"
            >
              <FileText size={18} />
            </button>
          </div>
          <div className="flex-1 p-4">
            {viewMode === 'graph' ? (
              <NotesGraphView 
                notes={notes} 
                onSelectNote={(note) => {
                  setSelectedNote(note);
                  setEditContent(note.content);
                  setIsEditing(false);
                  setPreviewMode(false);
                }} 
              />
            ) : (
              <HybridNoteView />
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full relative bg-[var(--panel-bg)]">
        <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-color)]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)] mr-2">Notes</h2>
            <div className="flex bg-[var(--panel-bg)] rounded-lg p-0.5 border border-[var(--border)]">
              <button 
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 text-xs font-bold rounded-md ${viewMode === 'list' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)]'}`}
              >
                List
              </button>
              <button 
                onClick={() => setViewMode('folders')}
                className={`px-2 py-1 text-xs font-bold rounded-md ${viewMode === 'folders' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)]'}`}
              >
                Folders
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="p-2 rounded-full hover:bg-[var(--panel-bg)] text-[var(--text-muted)]"
            >
              <Search size={18} />
            </button>
            <button 
              onClick={() => setViewMode('canvas')}
              className="p-2 rounded-full hover:bg-[var(--panel-bg)] text-[var(--accent)]"
            >
              <Network size={18} />
            </button>
            <button onClick={() => {
                const newNote = { content: '', createdAt: Date.now(), updatedAt: Date.now(), isFolder: false, orderIndex: notes.filter(n => !n.parentId).length };
                db.notes.add(newNote as any).then(() => loadNotes());
            }} className="p-2 hover:bg-[var(--panel-bg)] rounded-full text-[var(--accent)]" title="New Note">
              <Plus size={18} />
            </button>
            <button onClick={() => {
                const newFolder = { content: 'New Folder', createdAt: Date.now(), updatedAt: Date.now(), isFolder: true, orderIndex: notes.filter(n => !n.parentId).length };
                db.notes.add(newFolder as any).then(() => loadNotes());
            }} className="p-2 hover:bg-[var(--panel-bg)] rounded-full text-[var(--accent)]" title="New Folder">
              <FolderPlus size={18} />
            </button>
          </div>
        </div>
        <CommandPalette 
          open={commandPaletteOpen} 
          setOpen={setCommandPaletteOpen} 
          onSelectNote={(note) => {
            setSelectedNote(note);
            setEditContent(note.content);
            setIsEditing(false);
            setPreviewMode(false);
          }} 
        />
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'list' ? (
            <MobileNotesList 
              key={notesListTileSize}
              notes={notes}
              tileSize={notesListTileSize}
              onSelect={(note) => {
                setSelectedNote(note);
                setEditContent(note.content);
                setIsEditing(false);
                setPreviewMode(false);
              }}
              onArchive={async (note) => {
                await db.notes.delete(note.id!);
                loadNotes();
              }}
              onCreateNote={async () => {
                const newNote = { content: '', createdAt: Date.now(), updatedAt: Date.now(), isFolder: false, orderIndex: notes.filter(n => !n.parentId).length };
                const id = await db.notes.add(newNote as any);
                const added = await db.notes.get(id);
                if (added) {
                  setSelectedNote(added);
                  setEditContent(added.content);
                  setIsEditing(true);
                  setPreviewMode(false);
                  loadNotes();
                }
              }}
            />
          ) : (
            <NotesSidebar 
              notes={notes}
              selectedNote={selectedNote}
              onSelectNote={(note) => {
                setSelectedNote(note);
                setEditContent(note.content);
                setIsEditing(false);
                setPreviewMode(false);
              }}
              onNotesChange={loadNotes}
              onDoubleClickNote={(note) => {
                handleEdit(note);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && !isMobile && (
        <div 
          className="md:hidden absolute inset-0 bg-black/50 z-10"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar List (Desktop only now) */}
      {!isMobile && (
        <div 
          className={`absolute md:relative z-20 h-full border-r border-[var(--border)] bg-[var(--panel-bg)] flex flex-col transition-all duration-75 ${
            isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:w-0 md:translate-x-0 md:border-none overflow-hidden'
          }`}
        >
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--accent)]">Notes</h2>
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => setCommandPaletteOpen(true)}
                className="p-1 rounded-full hover:bg-[var(--bg-color)] text-[var(--text-muted)]"
                title="Command Palette (Ctrl+K)"
              >
                <Search size={18} />
              </button>
              <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
                className={`p-1 rounded-full ${viewMode === 'graph' ? 'bg-[var(--accent)] text-black' : 'hover:bg-[var(--bg-color)] text-[var(--accent)]'}`}
                title="Toggle Graph View"
              >
                <Network size={18} />
              </button>
              <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'canvas' : 'list')}
                className={`p-1 rounded-full ${viewMode === 'canvas' ? 'bg-[var(--accent)] text-black' : 'hover:bg-[var(--bg-color)] text-[var(--accent)]'}`}
                title="Toggle Canvas View"
              >
                <LayoutTemplate size={18} />
              </button>
              <button onClick={() => {
                  const newNote = { content: '', createdAt: Date.now(), updatedAt: Date.now(), isFolder: false, orderIndex: notes.filter(n => !n.parentId).length };
                  db.notes.add(newNote as any).then(() => loadNotes());
              }} className="p-1 hover:bg-[var(--bg-color)] rounded-full text-[var(--accent)]" title="New Note">
                <Plus size={18} />
              </button>
              <button onClick={() => {
                  const newFolder = { content: 'New Folder', createdAt: Date.now(), updatedAt: Date.now(), isFolder: true, orderIndex: notes.filter(n => !n.parentId).length };
                  db.notes.add(newFolder as any).then(() => loadNotes());
              }} className="p-1 hover:bg-[var(--bg-color)] rounded-full text-[var(--accent)]" title="New Folder">
                <FolderPlus size={18} />
              </button>
            </div>
          </div>
          {viewMode === 'graph' ? (
            <div className="flex-1 p-2">
              <NotesGraphView 
                notes={notes} 
                onSelectNote={(note) => {
                  setSelectedNote(note);
                  setIsEditing(false);
                  if (window.innerWidth < 768) {
                    setIsSidebarOpen(false);
                  }
                }} 
              />
            </div>
          ) : (
            <NotesSidebar 
              notes={notes} 
              selectedNote={selectedNote} 
              onSelectNote={(note) => {
                setSelectedNote(note);
                setIsEditing(false);
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(false);
                }
              }} 
              onNotesChange={loadNotes} 
              onDoubleClickNote={(note) => {
                handleEdit(note);
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(false);
                }
              }}
            />
          )}
        </div>
      )}

      {/* Editor / Viewer / Canvas */}
      <div className="flex-1 flex flex-col bg-[var(--bg-color)] min-w-0 h-full">
        {viewMode === 'canvas' ? (
          <HybridNoteView />
        ) : selectedNote ? (
          <>
            <div className="p-2 border-b border-[var(--border)] flex justify-between items-center bg-[var(--panel-bg)]">
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => isMobile ? setSelectedNote(null) : setIsSidebarOpen(!isSidebarOpen)} 
                  className="p-2 hover:bg-[var(--bg-color)] rounded-full text-[var(--text-muted)] hover:text-[var(--accent)]"
                  title={isMobile ? "Back to Notes" : (isSidebarOpen ? "Close Sidebar" : "Open Sidebar")}
                >
                  {isMobile ? <PanelLeftClose size={18} className="rotate-180" /> : (isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />)}
                </button>
                {isEditing && (
                  <button 
                    onClick={handleTransform} 
                    disabled={isTransforming}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold uppercase bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 rounded-lg transition-colors disabled:opacity-50"
                    title="AI Markdown Transform"
                  >
                    <Sparkles size={14} className={isTransforming ? "animate-pulse" : ""} />
                    <span className="hidden sm:inline">{isTransforming ? 'Transforming...' : 'AI Format'}</span>
                  </button>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handleExportObsidian} 
                  className="p-2 hover:bg-[var(--bg-color)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                  title="Export to Obsidian"
                >
                  <Download size={16} />
                </button>

                {isEditing ? (
                  <>
                    <button 
                      onClick={() => setPreviewMode(!previewMode)} 
                      className={`p-2 rounded-full transition-colors ${previewMode ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'hover:bg-[var(--bg-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                      title={previewMode ? "Edit Mode" : "Preview Mode"}
                    >
                      {previewMode ? <Edit2 size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={handleSave} className="px-4 py-1.5 text-xs font-bold uppercase bg-[var(--accent)] text-black rounded-lg hover:opacity-90 transition-opacity">
                      Done
                    </button>
                  </>
                ) : (
                  <button onClick={() => handleEdit(selectedNote)} className="p-2 hover:bg-[var(--bg-color)] rounded-full text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                    <Edit2 size={16} />
                  </button>
                )}
                <button onClick={() => handleDelete(selectedNote.id!)} className="p-2 hover:bg-red-500/10 rounded-full text-[var(--text-muted)] hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col pb-24 relative">
              {isEditing && !previewMode ? (
                <>
                  <PropertyEditor 
                    properties={parseMarkdown(editContent).frontmatter} 
                    onChange={(newProps) => {
                      const parsed = parseMarkdown(editContent);
                      parsed.frontmatter = newProps;
                      setEditContent(stringifyMarkdown(parsed));
                    }} 
                  />
                  <textarea 
                    ref={textareaRef}
                    value={parseMarkdown(editContent).content}
                    onChange={(e) => {
                      const parsed = parseMarkdown(editContent);
                      parsed.content = e.target.value;
                      setEditContent(stringifyMarkdown(parsed));
                    }}
                    onContextMenu={handleContextMenu}
                    onTouchStart={handleTextareaTouchStart}
                    onTouchEnd={handleTextareaTouchEnd}
                    onTouchMove={handleTextareaTouchEnd}
                    className="w-full flex-1 bg-transparent resize-none outline-none font-mono text-[var(--text-main)] min-h-[50vh]"
                    style={{ fontSize: `${notesFontSize}px` }}
                    placeholder="# Header&#10;&#10;Start typing..."
                  />
                  
                  {/* Context Menu */}
                  {showContextMenu && (
                    <div 
                      className="fixed z-50 bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[180px]"
                      style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!showSubMenu ? (
                        <>
                          <button onClick={() => setShowSubMenu('think')} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center justify-between group">
                            <span className="flex items-center gap-2"><Brain size={14} className="group-hover:text-[var(--accent)]" /> Help me think</span>
                            <Sparkles size={12} className="text-[var(--accent)]" />
                          </button>
                          <button onClick={() => setShowSubMenu('translate')} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2">
                            <Languages size={14} /> Translate
                          </button>
                          <button onClick={() => setShowSubMenu('codify')} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2">
                            <Code size={14} /> Codify
                          </button>
                          <button onClick={handleImageUpload} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2">
                            <ImageIcon size={14} /> Upload Image
                          </button>
                        </>
                      ) : showSubMenu === 'think' ? (
                        <>
                          <div className="px-3 py-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] mb-1">Help me think</div>
                          {['Creative', 'Investigative (journalistic)', 'OSINT formal', 'Wiki (for facts)', 'Comedy', 'Scene / Script writing', 'Bullet / to do list'].map(style => (
                            <button key={style} onClick={() => handleAIAction(`Rewrite or expand the selected text in a ${style} style.`)} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)]">
                              {style}
                            </button>
                          ))}
                        </>
                      ) : showSubMenu === 'translate' ? (
                        <>
                          <div className="px-3 py-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] mb-1">Translate to</div>
                          {['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese'].map(lang => (
                            <button key={lang} onClick={() => handleAIAction(`Translate the selected text to ${lang}.`)} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)]">
                              {lang}
                            </button>
                          ))}
                        </>
                      ) : showSubMenu === 'codify' ? (
                        <>
                          {!codifyPromptLang ? (
                            <>
                              <div className="px-3 py-1 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] mb-1">Codify (Language)</div>
                              {['Rust', 'Kotlin', 'Dart', 'Python', 'TypeScript', 'Go', 'Swift', 'C++', 'Java', 'C#'].map(lang => (
                                <button key={lang} onClick={(e) => { e.stopPropagation(); setCodifyPromptLang(lang); }} className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)]">
                                  {lang}
                                </button>
                              ))}
                            </>
                          ) : (
                            <div className="p-3 w-[250px]" onClick={(e) => e.stopPropagation()}>
                              <div className="text-xs font-bold text-[var(--accent)] mb-2">What to write in {codifyPromptLang}?</div>
                              <input 
                                autoFocus
                                type="text"
                                value={codifyInput}
                                onChange={(e) => setCodifyInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && codifyInput.trim()) {
                                    handleAIAction(`Write or convert the selected text into ${codifyPromptLang} code. Request: ${codifyInput}. Return ONLY the markdown code block.`);
                                    setCodifyPromptLang(null);
                                    setCodifyInput('');
                                  }
                                }}
                                placeholder="e.g. A function to sort an array"
                                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                              />
                              <div className="flex justify-end mt-2 gap-2">
                                <button onClick={() => setCodifyPromptLang(null)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]">Cancel</button>
                                <button 
                                  onClick={() => {
                                    if (codifyInput.trim()) {
                                      handleAIAction(`Write or convert the selected text into ${codifyPromptLang} code. Request: ${codifyInput}. Return ONLY the markdown code block.`);
                                      setCodifyPromptLang(null);
                                      setCodifyInput('');
                                    }
                                  }} 
                                  className="text-xs bg-[var(--accent)] text-black px-2 py-1 rounded font-bold"
                                >
                                  Generate
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}

                  {/* Ephemeral Text Overlay */}
                  {ephemeralText && (
                    <div className="absolute top-4 left-4 right-4 bg-[var(--panel-bg)] border-2 border-[var(--accent)] rounded-xl shadow-2xl z-40 p-4 animate-in fade-in slide-in-from-top-4">
                      <div className="flex justify-between items-center mb-2 border-b border-[var(--border)] pb-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] flex items-center gap-2">
                          <Sparkles size={14} /> AI Generated Text
                        </h3>
                        <div className="flex gap-2">
                          <button onClick={handleRejectEphemeral} className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors" title="Discard">
                            <XIcon size={16} />
                          </button>
                          <button onClick={handleAcceptEphemeral} className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-full transition-colors" title="Keep">
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none max-h-[40vh] overflow-y-auto">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: CodeBlock
                          }}
                        >
                          {ephemeralText.text}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {/* Loading Overlay */}
                  {isTransforming && !ephemeralText && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center rounded-xl">
                      <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 flex flex-col items-center shadow-2xl">
                        <div className="w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-[var(--accent)] font-bold tracking-widest uppercase text-sm animate-pulse">Processing...</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div 
                  className="prose prose-invert max-w-none flex-1 min-h-[50vh] notes-content"
                  style={{ fontSize: `${notesFontSize}px` }}
                  onDoubleClick={() => handleEdit(selectedNote)}
                >
                  {Object.keys(parseMarkdown(selectedNote.content).frontmatter).length > 0 && (
                    <PropertyEditor 
                      properties={parseMarkdown(selectedNote.content).frontmatter} 
                      onChange={(newProps) => {
                        const parsed = parseMarkdown(selectedNote.content);
                        parsed.frontmatter = newProps;
                        const newContent = stringifyMarkdown(parsed);
                        db.notes.update(selectedNote.id!, { content: newContent, updatedAt: Date.now() });
                        setSelectedNote({ ...selectedNote, content: newContent });
                        loadNotes();
                      }} 
                    />
                  )}
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code: CodeBlock,
                      a: LinkRenderer
                    }}
                  >
                    {preprocessMarkdown(isEditing ? parseMarkdown(editContent).content : parseMarkdown(selectedNote.content).content)}
                  </ReactMarkdown>
                </div>
              )}
              {isEditing && suggestions.length > 0 && (
                <div className="mt-4 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--accent)] mb-2 flex items-center gap-2">
                    <Sparkles size={14} /> AI Suggestions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleExecutePrompt(suggestion)}
                        disabled={isTransforming}
                        className="text-xs px-3 py-1.5 bg-[var(--panel-bg)] border border-[var(--border)] rounded-full hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-left disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] opacity-50 relative">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="absolute top-4 left-4 p-2 hover:bg-[var(--panel-bg)] rounded-full text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              {!isSidebarOpen && <PanelLeftOpen size={18} />}
            </button>
            <FileText size={48} className="mb-4" />
            <p>Select a note to view</p>
          </div>
        )}
      </div>
    </div>
  );
}

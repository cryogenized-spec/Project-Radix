import React, { useState, useMemo, useRef, useDeferredValue, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Fuse from 'fuse.js';
import { motion, useAnimation, PanInfo, AnimatePresence } from 'motion/react';
import { Search, Plus, Clock, ArrowDownAZ, Archive, FileText, Undo2 } from 'lucide-react';
import { Note } from '../../lib/organizerDb';

interface MobileNotesListProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  onArchive?: (note: Note) => void;
  onCreateNote: () => void;
  tileSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function MobileNotesList({ notes, onSelect, onArchive, onCreateNote, tileSize = 'md' }: MobileNotesListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [sortBy, setSortBy] = useState<'recent' | 'alphabetical'>('recent');
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Undo Toast State
  const [archivedNote, setArchivedNote] = useState<Note | null>(null);
  const [hiddenNoteIds, setHiddenNoteIds] = useState<Set<string>>(new Set());
  const archiveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter out folders and temporarily hidden notes
  const displayNotes = useMemo(() => 
    notes.filter(n => !n.isFolder && !hiddenNoteIds.has(n.id!)), 
  [notes, hiddenNoteIds]);

  // Fuzzy Search Setup
  const fuse = useMemo(() => new Fuse(displayNotes, {
    keys: ['title', 'content'],
    threshold: 0.3,
    distance: 100,
  }), [displayNotes]);

  const searchedNotes = useMemo(() => {
    if (!deferredSearchQuery.trim()) return displayNotes;
    return fuse.search(deferredSearchQuery).map(result => result.item);
  }, [deferredSearchQuery, displayNotes, fuse]);

  // Sorting Logic
  const sortedNotes = useMemo(() => {
    return [...searchedNotes].sort((a, b) => {
      if (sortBy === 'recent') {
        return b.updatedAt - a.updatedAt;
      } else {
        const titleA = (a.title || a.content.split('\n')[0].replace(/#/g, '')).trim().toLowerCase();
        const titleB = (b.title || b.content.split('\n')[0].replace(/#/g, '')).trim().toLowerCase();
        return titleA.localeCompare(titleB);
      }
    });
  }, [searchedNotes, sortBy]);

  const sizeMap = {
    xs: 56, // 48 + 8
    sm: 72, // 64 + 8
    md: 88, // 80 + 8
    lg: 104, // 96 + 8
    xl: 120, // 112 + 8
  };

  // Virtualized List Setup
  const rowVirtualizer = useVirtualizer({
    count: sortedNotes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => sizeMap[tileSize], // Dynamic size based on tileSize
    overscan: 10,
  });

  const handleArchiveRequest = (note: Note) => {
    // Hide immediately
    setHiddenNoteIds(prev => new Set(prev).add(note.id!));
    setArchivedNote(note);
    
    if (archiveTimeoutRef.current) clearTimeout(archiveTimeoutRef.current);
    
    // Actually archive after 5 seconds if not undone
    archiveTimeoutRef.current = setTimeout(() => {
      if (onArchive) onArchive(note);
      setArchivedNote(null);
    }, 5000);
  };

  const handleUndoArchive = () => {
    if (archiveTimeoutRef.current) clearTimeout(archiveTimeoutRef.current);
    if (archivedNote) {
      setHiddenNoteIds(prev => {
        const next = new Set(prev);
        next.delete(archivedNote.id!);
        return next;
      });
      setArchivedNote(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] relative overflow-hidden font-sans">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Notes</h1>
        <p className="text-xs text-[var(--text-muted)]">{sortedNotes.length} notes</p>
      </div>

      {/* Virtualized List Area */}
      <div 
        ref={parentRef} 
        className="flex-1 overflow-y-auto pb-40 px-4 scroll-smooth"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const note = sortedNotes[virtualRow.index];
            return (
              <div
                key={note.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '8px',
                }}
              >
                <NoteCard 
                  note={note} 
                  onSelect={() => onSelect(note)} 
                  onArchive={() => handleArchiveRequest(note)} 
                  tileSize={tileSize}
                />
              </div>
            );
          })}
        </div>
        
        {sortedNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
            <FileText size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No notes found.</p>
          </div>
        )}
      </div>

      {/* Undo Toast */}
      <AnimatePresence>
        {archivedNote && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-36 left-4 right-4 z-20 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-2xl p-3 flex items-center justify-between"
          >
            <span className="text-sm text-[var(--text-main)]">Note archived</span>
            <button 
              onClick={handleUndoArchive}
              className="flex items-center gap-1.5 text-sm font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Undo2 size={16} /> Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thumb-First Bottom Zone */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--bg-color)] via-[var(--bg-color)] to-transparent pt-16 pb-6 px-4 pointer-events-none z-10">
        <div className="pointer-events-auto bg-[var(--panel-bg)]/80 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-2xl p-3 flex flex-col gap-3">
          
          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-[var(--text-muted)]" size={16} />
            <input 
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-color)]/50 border border-[var(--border)] rounded-xl py-2.5 pl-9 pr-4 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Actions Row */}
          <div className="flex justify-between items-center">
            {/* Sort Toggle */}
            <button 
              onClick={() => setSortBy(prev => prev === 'recent' ? 'alphabetical' : 'recent')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-color)]/50 border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              {sortBy === 'recent' ? <Clock size={14} /> : <ArrowDownAZ size={14} />}
              <span>{sortBy === 'recent' ? 'Recent' : 'A-Z'}</span>
            </button>

            {/* New Note FAB */}
            <button 
              onClick={onCreateNote}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-black font-bold text-sm shadow-[0_0_20px_rgba(255,85,0,0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={18} />
              <span>New Note</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, onSelect, onArchive, tileSize = 'md' }: { note: Note, onSelect: () => void, onArchive?: () => void, tileSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const controls = useAnimation();
  
  // Extract title and preview
  const lines = note.content.split('\n').filter(line => line.trim() !== '');
  const title = note.title || (lines[0] ? lines[0].replace(/#/g, '').trim() : 'Untitled');
  const preview = lines.slice(1).join(' ').replace(/#/g, '').trim().substring(0, 80) || 'No additional content...';
  
  // Extract a pseudo-category from tags if present (e.g., #work)
  const tagMatch = note.content.match(/#(\w+)/);
  const category = tagMatch ? tagMatch[1] : 'Note';

  const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = -80;
    if (info.offset.x < threshold && onArchive) {
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
      // Animate out
      await controls.start({ x: -window.innerWidth, opacity: 0, transition: { duration: 0.2 } });
      onArchive();
    } else {
      // Snap back
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } });
    }
  };

  const sizeClasses = {
    xs: { height: '48px', padding: 'p-2', title: 'text-xs', preview: 'text-[10px]', badge: 'text-[8px] px-1.5' },
    sm: { height: '64px', padding: 'p-2.5', title: 'text-sm', preview: 'text-xs', badge: 'text-[9px] px-2' },
    md: { height: '80px', padding: 'p-3', title: 'text-sm', preview: 'text-xs', badge: 'text-[9px] px-2' },
    lg: { height: '96px', padding: 'p-4', title: 'text-base', preview: 'text-sm', badge: 'text-[10px] px-2.5' },
    xl: { height: '112px', padding: 'p-5', title: 'text-lg', preview: 'text-base', badge: 'text-xs px-3' }
  };

  const styles = sizeClasses[tileSize];

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-red-500/10" style={{ height: styles.height }}>
      {/* Background Archive Action Indicator */}
      <div className="absolute inset-0 flex items-center justify-end pr-6">
        <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
          <Archive size={16} />
          <span>Archive</span>
        </div>
      </div>

      {/* Draggable Card Surface */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={handleDragEnd}
        animate={controls}
        onClick={onSelect}
        className={`absolute inset-0 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl ${styles.padding} flex flex-col justify-center cursor-pointer hover:border-[var(--accent)] transition-colors`}
      >
        <div className="flex justify-between items-start mb-1.5">
          <h3 className={`font-semibold text-[var(--text-main)] truncate pr-3 ${styles.title}`}>{title}</h3>
          <span className={`font-bold uppercase tracking-wider py-0.5 rounded-full bg-[var(--bg-color)] border border-[var(--border)] text-[var(--accent)] whitespace-nowrap flex-shrink-0 ${styles.badge}`}>
            {category}
          </span>
        </div>
        <p className={`text-[var(--text-muted)] truncate leading-relaxed ${styles.preview}`}>
          {preview}
        </p>
      </motion.div>
    </div>
  );
}

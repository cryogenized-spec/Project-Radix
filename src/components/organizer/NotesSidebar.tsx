import React, { useState, useRef, useEffect } from 'react';
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Plus, Trash2, Edit3 } from 'lucide-react';
import { Note, db } from '../../lib/organizerDb';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NotesSidebarProps {
  notes: Note[];
  selectedNote: Note | null;
  onSelectNote: (note: Note) => void;
  onNotesChange: () => void;
  onDoubleClickNote?: (note: Note) => void;
}

const SortableItem = ({ note, selectedNote, onSelectNote, onNotesChange, depth = 0, allNotes, onDoubleClickNote }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: note.id! });
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Load expansion state
  useEffect(() => {
    const loadState = async () => {
      const state = await db.getUserSettings();
      if (state?.folderExpanded?.[note.id!]) {
        setIsOpen(true);
      }
    };
    loadState();
  }, [note.id]);

  const toggleOpen = async () => {
    const newState = !isOpen;
    setIsOpen(newState);
    const state = await db.getUserSettings() || { schedule: [] };
    const folderExpanded = state.folderExpanded || {};
    folderExpanded[note.id!] = newState;
    await db.setUserSettings({ ...state, folderExpanded });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 16 + 12}px`,
  };

  const children = allNotes.filter((n: Note) => n.parentId === note.id).sort((a: Note, b: Note) => (a.orderIndex || 0) - (b.orderIndex || 0));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showContextMenu) {
        setShowContextMenu(false);
        setIsConfirmingDelete(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showContextMenu]);

  const handleDelete = async (e: React.MouseEvent, confirmed: boolean = false) => {
    e.stopPropagation();
    if (confirmed) {
      // Recursive delete
      const deleteRecursive = async (id: string) => {
        const children = allNotes.filter((n: Note) => n.parentId === id);
        for (const child of children) {
          await deleteRecursive(child.id!);
        }
        await db.notes.delete(id);
      };
      await deleteRecursive(note.id!);
      onNotesChange();
    }
  };

  const handleAddInside = async (e: React.MouseEvent, isFolder: boolean) => {
    e.stopPropagation();
    const newNote: Note = {
      content: isFolder ? 'New Folder' : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFolder,
      parentId: note.id,
      orderIndex: children.length
    };
    await db.notes.add(newNote);
    setIsOpen(true);
    onNotesChange();
  };

  const startRename = () => {
    setRenameValue(note.content);
    setIsRenaming(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault();
    if (renameValue.trim() && renameValue !== note.content) {
      await db.notes.update(note.id!, { content: renameValue.trim(), updatedAt: Date.now() });
      onNotesChange();
    }
    setIsRenaming(false);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isRenaming) return;
    const touch = 'touches' in e ? e.touches[0] : e;
    longPressTimer.current = setTimeout(() => {
      setShowContextMenu(true);
      setContextMenuPos({ x: touch.clientX, y: touch.clientY });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div 
        ref={itemRef}
        onClick={(e) => {
          if (isRenaming) return;
          if (e.detail === 2) {
            // Double click
            if (note.isFolder) {
              startRename();
            } else {
              onSelectNote(note);
              if (onDoubleClickNote) onDoubleClickNote(note);
            }
          } else if (e.detail === 1) {
            if (note.isFolder) {
              toggleOpen();
            } else {
              onSelectNote(note);
            }
          }
        }}
        onDoubleClick={() => {
           if (isRenaming) return;
           if (note.isFolder) {
               toggleOpen();
           } else if (onDoubleClickNote) {
               onDoubleClickNote(note);
           }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(true);
          setContextMenuPos({ x: e.clientX, y: e.clientY });
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onMouseLeave={handleTouchEnd}
        className={`flex items-center p-2 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-color)] transition-colors ${selectedNote?.id === note.id ? 'bg-[var(--accent)]/10 border-l-4 border-l-[var(--accent)]' : ''}`}
      >
        <div {...attributes} {...listeners} className="mr-1 cursor-grab text-[var(--text-muted)] hover:text-[var(--text-main)] touch-none px-2 py-1">
          ⋮⋮
        </div>
        {note.isFolder ? (
          isOpen ? <FolderOpen size={16} className="text-[var(--accent)] mr-2 flex-shrink-0" /> : <Folder size={16} className="text-[var(--accent)] mr-2 flex-shrink-0" />
        ) : (
          <FileText size={16} className="text-[var(--text-muted)] mr-2 flex-shrink-0" />
        )}
        
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} className="flex-1 mr-2">
            <input 
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[var(--bg-color)] text-[var(--text-main)] border border-[var(--accent)] rounded px-1 text-xs outline-none"
            />
          </form>
        ) : (
          <div className="flex-1 text-xs font-bold truncate text-[var(--text-main)] select-none">
            {note.isFolder ? note.content : (note.content.split('\n')[0].replace('#', '').trim() || 'Untitled')}
          </div>
        )}
        
        <div className="hidden md:flex opacity-0 group-hover:opacity-100 items-center space-x-1 transition-opacity">
          {note.parentId && (
            <button onClick={async (e) => {
              e.stopPropagation();
              const parent = allNotes.find((n: Note) => n.id === note.parentId);
              if (parent) {
                await db.notes.update(note.id!, { parentId: parent.parentId, orderIndex: (parent.orderIndex || 0) + 0.5 });
                onNotesChange();
              }
            }} className="p-1 hover:bg-[var(--panel-bg)] rounded text-[var(--text-muted)] hover:text-[var(--accent)]" title="Move Out">
              <ChevronRight size={12} className="rotate-180" />
            </button>
          )}
          {note.isFolder && (
            <>
              <button onClick={(e) => handleAddInside(e, false)} className="p-1 hover:bg-[var(--panel-bg)] rounded text-[var(--text-muted)] hover:text-[var(--accent)]" title="Add Note inside">
                <Plus size={12} />
              </button>
              <button onClick={(e) => handleAddInside(e, true)} className="p-1 hover:bg-[var(--panel-bg)] rounded text-[var(--text-muted)] hover:text-[var(--accent)]" title="Add Folder inside">
                <Folder size={12} />
              </button>
            </>
          )}
          <button onClick={(e) => handleDelete(e, true)} className="p-1 hover:bg-red-500/10 rounded text-[var(--text-muted)] hover:text-red-500" title="Delete">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div 
          className="fixed z-50 bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg shadow-xl py-1 min-w-[150px]"
          style={{ 
            top: `${Math.min(contextMenuPos.y, window.innerHeight - 200)}px`, 
            left: `${Math.min(contextMenuPos.x, window.innerWidth - 160)}px` 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {note.isFolder && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); startRename(); }}
              className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2"
            >
              <Edit3 size={14} /> Rename
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); toggleOpen(); }}
            className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2"
          >
            {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />} {isOpen ? 'Collapse' : 'Expand'}
          </button>
          {note.parentId && (
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                const parent = allNotes.find((n: Note) => n.id === note.parentId);
                if (parent) {
                  await db.notes.update(note.id!, { parentId: parent.parentId, orderIndex: (parent.orderIndex || 0) + 0.5 });
                  onNotesChange();
                }
              }}
              className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2"
            >
              <ChevronRight size={14} className="rotate-180" /> Move Out
            </button>
          )}
          {note.isFolder && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); handleAddInside(e, false); }}
                className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2"
              >
                <Plus size={14} /> Add Note
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); handleAddInside(e, true); }}
                className="w-full text-left px-4 py-2 text-sm text-[var(--text-main)] hover:bg-[var(--bg-color)] flex items-center gap-2"
              >
                <Folder size={14} /> Add Folder
              </button>
            </>
          )}
          {isConfirmingDelete ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowContextMenu(false); setIsConfirmingDelete(false); handleDelete(e, true); }}
              className="w-full text-left px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 flex items-center gap-2"
            >
              <Trash2 size={14} /> Confirm Delete
            </button>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
      
      {note.isFolder && isOpen && children.length > 0 && (
        <SortableContext items={children.map((c: Note) => c.id!)} strategy={verticalListSortingStrategy}>
          {children.map((child: Note) => (
            <SortableItem 
              key={child.id} 
              note={child} 
              selectedNote={selectedNote} 
              onSelectNote={onSelectNote} 
              onNotesChange={onNotesChange} 
              depth={depth + 1} 
              allNotes={allNotes} 
              onDoubleClickNote={onDoubleClickNote}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
};

export default function NotesSidebar({ notes, selectedNote, onSelectNote, onNotesChange, onDoubleClickNote }: NotesSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const activeNote = notes.find(n => n.id === active.id);
      const overNote = notes.find(n => n.id === over?.id);
      
      if (activeNote && overNote) {
        if (activeNote.parentId === overNote.parentId) {
          // Reorder within same level
          const siblings = notes.filter(n => n.parentId === activeNote.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
          const oldIndex = siblings.findIndex(n => n.id === active.id);
          const newIndex = siblings.findIndex(n => n.id === over?.id);
          
          const newSiblings = [...siblings];
          const [moved] = newSiblings.splice(oldIndex, 1);
          newSiblings.splice(newIndex, 0, moved);
          
          for (let i = 0; i < newSiblings.length; i++) {
            await db.notes.update(newSiblings[i].id!, { orderIndex: i });
          }
          onNotesChange();
        } else if (overNote.isFolder && activeNote.parentId !== overNote.id) {
          // Move into folder
          await db.notes.update(activeNote.id!, { parentId: overNote.id, orderIndex: 999 });
          onNotesChange();
        } else if (!overNote.isFolder && activeNote.parentId !== overNote.parentId) {
          // Move to the level of the target note
          await db.notes.update(activeNote.id!, { parentId: overNote.parentId, orderIndex: (overNote.orderIndex || 0) + 0.5 });
          // Then re-normalize order indices for that level
          const siblings = notes.filter(n => n.parentId === overNote.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
          for (let i = 0; i < siblings.length; i++) {
            await db.notes.update(siblings[i].id!, { orderIndex: i });
          }
          onNotesChange();
        }
      }
    }
  };

  const rootNotes = notes.filter(n => !n.parentId).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rootNotes.map(n => n.id!)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto min-w-[250px] pb-20">
          {rootNotes.map(note => (
            <SortableItem 
              key={note.id} 
              note={note} 
              selectedNote={selectedNote} 
              onSelectNote={onSelectNote} 
              onNotesChange={onNotesChange} 
              depth={0} 
              allNotes={notes} 
              onDoubleClickNote={onDoubleClickNote}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

import React, { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { FileText, Plus, Moon, Sun, Search, LayoutDashboard } from 'lucide-react';
import { db, Note } from '../lib/organizerDb';

interface CommandPaletteProps {
  open: boolean;
  setOpen: (o: boolean) => void;
  onSelectNote: (n: Note) => void;
}

export default function CommandPalette({ open, setOpen, onSelectNote }: CommandPaletteProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (open) {
      db.notes.toArray().then(setNotes);
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, setOpen]);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDark(!isDark);
    setOpen(false);
  };

  return (
    <Command.Dialog 
      open={open} 
      onOpenChange={setOpen}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-xl bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 border-b border-[var(--border)]">
          <Search className="text-[var(--text-muted)] mr-2" size={18} />
          <Command.Input 
            placeholder="Type a command or search notes..." 
            className="flex-1 bg-transparent py-4 text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="p-4 text-center text-sm text-[var(--text-muted)]">No results found.</Command.Empty>

          <Command.Group heading="Actions" className="text-xs font-bold text-[var(--text-muted)] px-2 py-1 uppercase tracking-wider">
            <Command.Item 
              onSelect={() => {
                const newNote = { content: '# New Note\n\nStart typing...', createdAt: Date.now(), updatedAt: Date.now(), isFolder: false, orderIndex: 0 };
                db.notes.add(newNote as any).then(id => {
                  db.notes.get(id).then(n => { if(n) onSelectNote(n); setOpen(false); });
                });
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-main)] rounded-lg hover:bg-[var(--accent)] hover:text-black cursor-pointer aria-selected:bg-[var(--accent)] aria-selected:text-black transition-colors"
            >
              <Plus size={16} /> Create New Note
            </Command.Item>
            <Command.Item 
              onSelect={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-main)] rounded-lg hover:bg-[var(--accent)] hover:text-black cursor-pointer aria-selected:bg-[var(--accent)] aria-selected:text-black transition-colors"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />} Toggle Theme
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Notes" className="text-xs font-bold text-[var(--text-muted)] px-2 py-1 mt-2 uppercase tracking-wider">
            {notes.filter(n => !n.isFolder).map(note => (
              <Command.Item 
                key={note.id}
                onSelect={() => {
                  onSelectNote(note);
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-color)] cursor-pointer aria-selected:bg-[var(--bg-color)] transition-colors"
              >
                <FileText size={16} className="text-[var(--accent)]" />
                <span className="truncate">{note.title || note.content.split('\n')[0].replace(/#/g, '').trim() || 'Untitled'}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, Timer, AlertCircle, Hash, Tag, Check, Plus, Trash2 } from 'lucide-react';
import { Task, Subtask } from '../../lib/organizerDb';
import { v4 as uuidv4 } from 'uuid';

interface TaskEditModalProps {
  task: Task;
  onClose: () => void;
  onSave: (task: Task) => void;
}

export default function TaskEditModal({ task, onClose, onSave }: TaskEditModalProps) {
  const [editText, setEditText] = useState(task.text || task.title || '');
  const [editDate, setEditDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [editTime, setEditTime] = useState(''); // Time handling could be improved
  const [editDuration, setEditDuration] = useState(task.duration || 0);
  const [editPriority, setEditPriority] = useState(task.priority || 'medium');
  const [editTags, setEditTags] = useState(task.tags?.join(', ') || '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasksList || []);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const handleSave = () => {
    onSave({
      ...task,
      text: editText.trim(),
      title: editText.trim(),
      dueDate: editDate ? new Date(editDate).getTime() : undefined,
      duration: editDuration,
      priority: editPriority as any,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
      subtasksList: subtasks
    });
    onClose();
  };

  const addSubtask = () => {
    if (!newSubtaskText.trim()) return;
    setSubtasks([...subtasks, { id: uuidv4(), text: newSubtaskText.trim(), completed: false }]);
    setNewSubtaskText('');
  };

  const toggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const deleteSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-color)]">
            <h3 className="font-bold text-xl text-[var(--text-main)] flex items-center gap-2">
              <span className="text-2xl">✍️</span> Edit Task
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-[var(--panel-bg)] rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-6 space-y-6 overflow-y-auto">
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full bg-transparent border-b-2 border-[var(--border)] outline-none font-bold text-2xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] transition-colors"
              placeholder="What needs to be done?"
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><Calendar size={14} className="text-[var(--accent)]"/> Due Date</label>
                <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><Clock size={14} className="text-[var(--accent)]"/> Time</label>
                <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><Timer size={14} className="text-[var(--accent)]"/> Duration (mins)</label>
                <input type="number" value={editDuration} onChange={e => setEditDuration(parseInt(e.target.value) || 0)} className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><AlertCircle size={14} className="text-[var(--accent)]"/> Priority</label>
                <select value={editPriority} onChange={e => setEditPriority(e.target.value as any)} className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none">
                  <option value="low">Low 🟢</option>
                  <option value="medium">Medium 🟡</option>
                  <option value="high">High 🔴</option>
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><Tag size={14} className="text-[var(--accent)]"/> Tags</label>
                <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)} className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--accent)] outline-none" placeholder="work, urgent, project-x" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5"><Check size={14} className="text-[var(--accent)]"/> Subtasks</label>
              <div className="flex gap-2">
                <input 
                  value={newSubtaskText} 
                  onChange={e => setNewSubtaskText(e.target.value)}
                  className="flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] outline-none"
                  placeholder="Add a subtask..."
                  onKeyDown={e => e.key === 'Enter' && addSubtask()}
                />
                <button onClick={addSubtask} className="bg-[var(--accent)] text-black rounded-xl p-3"><Plus size={20}/></button>
              </div>
              <div className="space-y-2">
                {subtasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2 bg-[var(--bg-color)] p-2 rounded-lg border border-[var(--border)]">
                    <button onClick={() => toggleSubtask(st.id)} className={`w-5 h-5 rounded-full border flex items-center justify-center ${st.completed ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-muted)]'}`}>
                      {st.completed && <Check size={12} className="text-black" />}
                    </button>
                    <span className={`flex-1 text-sm ${st.completed ? 'line-through opacity-50' : ''}`}>{st.text}</span>
                    <button onClick={() => deleteSubtask(st.id)} className="text-[var(--text-muted)] hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-[var(--border)] bg-[var(--bg-color)] flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-3 rounded-xl text-sm font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-6 py-3 rounded-xl bg-[var(--accent)] text-black font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
              <Check size={16} /> Save Changes
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

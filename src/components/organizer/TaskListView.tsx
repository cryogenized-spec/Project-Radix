import React, { useState, useEffect, useMemo } from 'react';
import { Reorder } from 'framer-motion';
import { CheckSquare, Plus, ChevronDown, ChevronRight, AlertCircle, LayoutGrid, List } from 'lucide-react';
import { db, Task } from '../../lib/organizerDb';
import { useRadixSync } from '../../lib/useRadixSync';
import { getSetting } from '../../lib/db';
import { generateSubtasks } from '../../lib/gemini';
import TaskItem from './TaskItem';
import KanbanView from './KanbanView';
import { v4 as uuidv4 } from 'uuid';

export default function TaskListView({ onEditTask }: { onEditTask: (task: Task) => void }) {
  const { frames, getTasks, updateFrame, deleteFrame } = useRadixSync();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('UNCATEGORIZED');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [isGenerating, setIsGenerating] = useState(false);
  const [notesListTileSize, setNotesListTileSize] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  useEffect(() => {
    loadData();
    const loadSettings = async () => {
      const settings = await db.getUserSettings();
      if (settings?.notesListTileSize) {
        setNotesListTileSize(settings.notesListTileSize);
      }
    };
    loadSettings();
    const handleOpenTask = (e: any) => {
      loadData();
      // If we have a specific task to open, we could scroll to it or highlight it
      // For now, just switch to the tasks view
    };
    window.addEventListener('organizer:open-task', handleOpenTask);
    window.addEventListener('settings:updated', loadSettings);
    return () => {
      window.removeEventListener('organizer:open-task', handleOpenTask);
      window.removeEventListener('settings:updated', loadSettings);
    };
  }, [frames]);

  const loadData = async () => {
    const loadedTasks = await db.tasks.orderBy('orderIndex').toArray();
    
    // Merge Hybrid Tasks
    const hybridTasks = getTasks().map(frame => ({
      id: frame.id,
      title: typeof frame.content === 'string' ? frame.content : frame.content?.text || 'Hybrid Task',
      text: typeof frame.content === 'string' ? frame.content : frame.content?.text || 'Hybrid Task',
      status: frame.content?.completed ? 'completed' : 'active',
      completed: frame.content?.completed || false,
      category: 'HYBRID NOTES',
      orderIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isHybrid: true
    })) as unknown as Task[];

    const allTasks = [...loadedTasks, ...hybridTasks];
    setTasks(allTasks);
    
    // Default expand all categories
    const categories = Array.from(new Set(allTasks.map(t => t.category || 'UNCATEGORIZED')));
    const expanded: Record<string, boolean> = {};
    categories.forEach(c => { expanded[c] = true; });
    setExpandedCategories(expanded);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleComplete = async (taskId: string, completed: boolean) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && (task as any).isHybrid) {
      updateFrame(taskId, { content: { text: task.text, completed } });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed, status: completed ? 'completed' : 'active' } : t));
      return;
    }
    await db.tasks.update(taskId, { completed, status: completed ? 'completed' : 'active' });
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed, status: completed ? 'completed' : 'active' } : t));
  };

  const handleDelete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && (task as any).isHybrid) {
      deleteFrame(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      return;
    }
    await db.tasks.delete(taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleReorder = async (category: string, reorderedTasks: Task[]) => {
    // Update local state for immediate feedback
    setTasks(prev => {
      const otherTasks = prev.filter(t => (t.category || 'UNCATEGORIZED') !== category);
      return [...otherTasks, ...reorderedTasks];
    });

    // Update DB orderIndex
    const updates = reorderedTasks.map((t, index) => ({
      ...t,
      orderIndex: index
    }));
    
    for (const task of updates) {
      if (task.id) await db.tasks.update(task.id, { orderIndex: task.orderIndex });
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    setIsGenerating(true);
    const title = newTaskText;
    setNewTaskText('');

    // Generate subtasks using AI
    const settings = await getSetting('gemini_settings') || {};
    const subtasks = await generateSubtasks(title, settings);

    const newTask: Partial<Task> = {
      title: title,
      text: title,
      status: 'active',
      priority: newTaskPriority,
      category: newTaskCategory,
      completed: false,
      orderIndex: tasks.filter(t => (t.category || 'UNCATEGORIZED') === newTaskCategory).length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      subtasksList: subtasks.length > 0 ? subtasks : [
        { id: uuidv4(), text: 'First step to get started', completed: false },
        { id: uuidv4(), text: 'Follow up action', completed: false }
      ]
    };

    const id = await db.tasks.add(newTask as Task);
    const added = await db.tasks.get(id);
    if (added) {
      setTasks(prev => [...prev, added]);
      setNewTaskPriority(undefined);
    }
    setIsGenerating(false);
  };

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    tasks.forEach(task => {
      const cat = task.category || 'UNCATEGORIZED';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(task);
    });
    // Sort tasks within groups by orderIndex
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => a.orderIndex - b.orderIndex);
    });
    return groups;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] relative">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--panel-bg)]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-[var(--text-main)]">Tasks</h2>
          <div className="flex bg-[var(--bg-color)] rounded-lg p-1 border border-[var(--border)]">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <List size={16} />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
        <form onSubmit={handleAddTask} className="flex flex-col gap-2">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder={isGenerating ? "Generating AI subtasks..." : "Add a new task..."}
            disabled={isGenerating}
            className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
          <div className="flex gap-2">
            <select 
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value)}
              disabled={isGenerating}
              className="bg-[var(--bg-color)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-main)] outline-none disabled:opacity-50"
            >
              <option value="UNCATEGORIZED">Uncategorized</option>
              <option value="WORK">Work</option>
              <option value="PERSONAL">Personal</option>
              <option value="PROJECTS">Projects</option>
            </select>
            <select 
              value={newTaskPriority || ''}
              onChange={(e) => setNewTaskPriority(e.target.value as any || undefined)}
              disabled={isGenerating}
              className="bg-[var(--bg-color)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs text-[var(--text-main)] outline-none disabled:opacity-50"
            >
              <option value="">No Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <button type="submit" disabled={isGenerating} className="ml-auto bg-[var(--accent)] text-black rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              {isGenerating ? <span className="animate-pulse">Thinking...</span> : <><Plus size={14} /> Add</>}
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {viewMode === 'kanban' ? (
          <KanbanView 
            tasks={tasks} 
            onUpdateTask={async (task) => {
              if ((task as any).isHybrid) {
                // Cannot change category of hybrid tasks easily without updating the frame content
                // For now, just ignore category changes for hybrid tasks
                return;
              }
              await db.tasks.update(task.id!, { category: task.category, orderIndex: task.orderIndex });
              loadData();
            }} 
            onComplete={handleComplete}
            onDelete={handleDelete}
            onEditTask={onEditTask}
            tileSize={notesListTileSize}
          />
        ) : (
          <>
            {Object.keys(groupedTasks).length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-[var(--text-muted)] opacity-50">
                <CheckSquare size={48} className="mb-4" />
                <p>No tasks yet. Use the input above to add one.</p>
              </div>
            )}

            {Object.entries(groupedTasks).map(([category, categoryTasks]) => (
              <div key={category} className="space-y-3">
                <div 
                  className="flex items-center justify-between py-1 cursor-pointer select-none group"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center space-x-2 font-bold uppercase tracking-widest text-xs text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                    {expandedCategories[category] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>{category}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] bg-[var(--panel-bg)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                    {categoryTasks.length}
                  </div>
                </div>

                {expandedCategories[category] && (
                  categoryTasks.length > 0 ? (
                    <Reorder.Group 
                      axis="y" 
                      values={categoryTasks} 
                      onReorder={(newOrder) => handleReorder(category, newOrder)}
                      className="space-y-0"
                    >
                      {categoryTasks.map(task => (
                        <TaskItem 
                          key={task.id} 
                          task={task} 
                          onComplete={handleComplete} 
                          onDelete={handleDelete} 
                          onEditTask={onEditTask}
                          tileSize={notesListTileSize}
                        />
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] opacity-60 p-4 border border-dashed border-[var(--border)] rounded-xl">
                      <AlertCircle size={14} /> No active tasks in this sector
                    </div>
                  )
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

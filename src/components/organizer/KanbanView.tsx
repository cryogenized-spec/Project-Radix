import React, { useState, useRef } from 'react';
import { Task } from '../../lib/organizerDb';
import TaskItem from './TaskItem';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Maximize, Minimize, ZoomIn, ZoomOut, RefreshCcw } from 'lucide-react';

interface KanbanViewProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEditTask: (task: Task) => void;
  tileSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function KanbanView({ tasks, onUpdateTask, onComplete, onDelete, onEditTask, tileSize = 'md' }: KanbanViewProps) {
  const defaultCategories = ['UNCATEGORIZED', 'WORK', 'PERSONAL', 'PROJECTS'];
  const dynamicCategories = Array.from(new Set(tasks.map(t => t.category || 'UNCATEGORIZED')));
  const categories = Array.from(new Set([...defaultCategories, ...dynamicCategories]));

  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleDragStart = (e: React.DragEvent, taskId: string | number) => {
    e.dataTransfer.setData('taskId', taskId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id?.toString() === taskId);
    if (task && task.category !== category) {
      onUpdateTask({ ...task, category });
    }
  };

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryText, setEditCategoryText] = useState('');

  const handleCategoryDoubleClick = (category: string) => {
    setEditingCategory(category);
    setEditCategoryText(category);
  };

  const handleCategoryEditSave = (oldCategory: string) => {
    if (editCategoryText.trim() && editCategoryText !== oldCategory) {
      tasks.forEach(task => {
        if ((task.category || 'UNCATEGORIZED') === oldCategory) {
          onUpdateTask({ ...task, category: editCategoryText.trim().toUpperCase() });
        }
      });
    }
    setEditingCategory(null);
  };

  return (
    <div ref={containerRef} className={`flex flex-col h-full ${isFullScreen ? 'fixed inset-0 z-50' : ''} bg-slate-950 relative`}>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '50px 50px' }}></div>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-slate-950/50 to-slate-900/50"></div>
      
      <div className="flex justify-end p-2 space-x-2 bg-[var(--panel-bg)] border-b border-[var(--border)] relative z-10">
        <button onClick={toggleFullScreen} className="p-2 hover:bg-[var(--accent)]/10 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
          {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>
      
      <div className="flex-1 overflow-x-auto p-4 pb-4 relative z-10">
        <div className="flex h-full gap-4 min-w-max">
          {categories.map(category => {
            const categoryTasks = tasks.filter(t => (t.category || 'UNCATEGORIZED') === category).sort((a, b) => a.orderIndex - b.orderIndex);
            
            return (
              <div 
                key={category}
                className="flex-shrink-0 w-80 flex flex-col bg-[var(--panel-bg)]/50 rounded-2xl border border-[var(--border)] overflow-hidden h-fit max-h-full"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, category)}
              >
                <div 
                  className="p-3 border-b border-[var(--border)] bg-[var(--panel-bg)] flex justify-between items-center cursor-pointer"
                  onDoubleClick={() => handleCategoryDoubleClick(category)}
                >
                  {editingCategory === category ? (
                    <input
                      autoFocus
                      value={editCategoryText}
                      onChange={(e) => setEditCategoryText(e.target.value)}
                      onBlur={() => handleCategoryEditSave(category)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCategoryEditSave(category)}
                      className="bg-transparent border-none outline-none font-bold text-xs uppercase tracking-widest text-[var(--text-main)] w-full"
                    />
                  ) : (
                    <h3 className="font-bold text-xs uppercase tracking-widest text-[var(--text-main)]">{category}</h3>
                  )}
                  <span className="text-xs bg-[var(--bg-color)] px-2 py-0.5 rounded-full text-[var(--text-muted)] border border-[var(--border)]">
                    {categoryTasks.length}
                  </span>
                </div>
                
                <div className="p-3 space-y-3">
                  {categoryTasks.map(task => (
                    <div 
                      key={task.id} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, task.id!)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <TaskItem 
                        task={task} 
                        onComplete={onComplete} 
                        onDelete={onDelete} 
                        onEditTask={onEditTask}
                        disableReorder={true}
                        tileSize={tileSize}
                      />
                    </div>
                  ))}
                  {categoryTasks.length === 0 && (
                    <div className="flex items-center justify-center text-xs text-[var(--text-muted)] opacity-50 border-2 border-dashed border-[var(--border)] rounded-xl p-4 text-center">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

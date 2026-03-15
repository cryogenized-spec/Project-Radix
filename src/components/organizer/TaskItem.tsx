import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, Reorder, useAnimation, AnimatePresence } from 'framer-motion';
import { Check, Trash2, GripVertical, ChevronDown, ChevronUp, Calendar, Clock, Hash, AlertCircle, Timer } from 'lucide-react';
import { Task, Subtask } from '../../lib/organizerDb';
import RichText from './RichText';

interface TaskItemProps {
  task: Task;
  onComplete: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEditTask?: (task: Task) => void; // New prop
  disableReorder?: boolean;
  tileSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export default function TaskItem({ task, onComplete, onDelete, onEditTask, disableReorder = false, tileSize = 'md' }: TaskItemProps) {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const [isCompleted, setIsCompleted] = useState(task.status === 'completed' || task.completed);
  const [isDeleted, setIsDeleted] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [editSubtaskText, setEditSubtaskText] = useState('');
  const [taskViewMode, setTaskViewMode] = useState<'title' | 'minimal' | 'maximum'>('minimal');

  // Background colors based on swipe direction
  const background = useTransform(
    x,
    [-100, 0, 100],
    ['#ff4444', 'var(--bg-color)', '#10b981'] // Red for delete, Emerald for complete
  );

  const priorityColors = {
    high: '#ff4444',
    medium: '#ffbb33',
    low: '#44bbff',
  };

  const priorityColor = task.priority ? priorityColors[task.priority] : 'transparent';
  const displaySubtasks = task.subtasksList?.slice(0, 2) || [];

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > 75 || velocity > 500) {
      // Swipe Right -> Complete
      const newCompletedState = !isCompleted;
      setIsCompleted(newCompletedState);
      onComplete(task.id!, newCompletedState);
      
      // Haptic feedback if supported
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      
      // Snap back
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    } else if (offset < -75 || velocity < -500) {
      // Swipe Left -> Delete
      setIsDeleted(true);
      
      // Haptic feedback
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([50, 50, 50]);
      }
      
      // Animate out
      await controls.start({ x: -window.innerWidth, transition: { duration: 0.2 } });
      onDelete(task.id!);
    } else {
      // Snap back if not swiped far enough
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
    }
  };

  if (isDeleted) return null;

  const sizeClasses = {
    xs: 'p-1 text-[10px]',
    sm: 'p-2 text-xs',
    md: 'p-3 text-sm',
    lg: 'p-4 text-base',
    xl: 'p-5 text-lg'
  };

  const textClasses = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  const cycleViewMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (taskViewMode === 'title') setTaskViewMode('minimal');
    else if (taskViewMode === 'minimal') setTaskViewMode('maximum');
    else setTaskViewMode('title');
  };

  const content = (
    <>
      {/* Background Actions */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-between px-6 rounded-xl"
        style={{ background }}
      >
        <div className="flex items-center text-white font-bold opacity-80">
          <Check size={20} className="mr-2" /> {isCompleted ? 'Uncomplete' : 'Complete'}
        </div>
        <div className="flex items-center text-white font-bold opacity-80">
          Delete <Trash2 size={20} className="ml-2" />
        </div>
      </motion.div>

      {/* Foreground Card */}
      <motion.div
        style={{ x }}
        animate={controls}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={handleDragEnd}
        onDoubleClick={() => onEditTask?.(task)}
        className={`relative flex items-start bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-sm transition-opacity duration-300 ${isCompleted ? 'opacity-40' : 'opacity-100'} ${sizeClasses[tileSize]}`}
      >
        {/* Priority Border */}
        {task.priority && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" 
            style={{ backgroundColor: priorityColor }} 
          />
        )}

        <div className="flex-1 ml-2">
          <div className="flex items-start justify-between group">
            <RichText 
              text={task.text || task.title || ''} 
              className={`font-medium text-[var(--text-main)] transition-all duration-300 ${isCompleted ? 'line-through text-[var(--text-muted)]' : ''} ${textClasses[tileSize]}`} 
            />
            <button 
              onClick={cycleViewMode}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {taskViewMode === 'title' ? <ChevronDown size={16} /> : taskViewMode === 'minimal' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
          
          {/* Metadata (Maximum View) */}
          {taskViewMode === 'maximum' && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
              {task.dueDate && <span className="flex items-center gap-1 bg-[var(--bg-color)] px-2 py-1 rounded border border-[var(--border)]"><Calendar size={10}/> {new Date(task.dueDate).toLocaleDateString()}</span>}
              {task.duration ? <span className="flex items-center gap-1 bg-[var(--bg-color)] px-2 py-1 rounded border border-[var(--border)]"><Timer size={10}/> {task.duration}m</span> : null}
              {task.tags && task.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-[var(--bg-color)] px-2 py-1 rounded border border-[var(--border)] text-[var(--accent)]"><Hash size={10}/> {tag}</span>
              ))}
            </div>
          )}

          {/* Momentum Protocol: Subtasks */}
          {!isCompleted && taskViewMode !== 'title' && (taskViewMode === 'maximum' ? task.subtasksList || [] : displaySubtasks).length > 0 && (
            <div className="mt-3 space-y-2">
              {(taskViewMode === 'maximum' ? task.subtasksList || [] : displaySubtasks).map((st: Subtask) => (
                <div 
                  key={st.id} 
                  className="flex items-center text-xs text-[var(--text-muted)]"
                >
                  <div className={`w-3 h-3 rounded-full border mr-2 flex items-center justify-center transition-colors ${st.completed ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--text-muted)]'}`}>
                    {st.completed && <Check size={8} className="text-black" strokeWidth={3} />}
                  </div>
                  <RichText 
                    text={st.text} 
                    className={st.completed ? 'line-through opacity-50' : ''} 
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drag Handle for Long Press / Reorder */}
        {!disableReorder && (
          <div className="ml-4 mt-1 text-[var(--text-muted)] opacity-30 hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
            <GripVertical size={20} />
          </div>
        )}
      </motion.div>
    </>
  );

  if (disableReorder) {
    return (
      <div className="relative w-full mb-3 rounded-xl overflow-hidden select-none touch-pan-y">
        {content}
      </div>
    );
  }

  return (
    <Reorder.Item 
      value={task} 
      id={task.id!}
      className="relative w-full mb-3 rounded-xl overflow-hidden select-none touch-pan-y"
    >
      {content}
    </Reorder.Item>
  );
}

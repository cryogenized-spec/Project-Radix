import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, CheckSquare, FileText, Plus, Mic, X, ArrowLeft, ArrowRight, Settings, Layers, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { getSetting, setSetting } from '../lib/db';
import { db as organizerDb, UserSettings, DaySchedule, Task } from '../lib/organizerDb';
import CalendarView from './organizer/CalendarView';
import TaskListView from './organizer/TaskListView';
import NotesView from './organizer/NotesView';
import HybridNoteView from './organizer/HybridNoteView';
import OrganizerFab from './organizer/OrganizerFab';
import NotificationPill from './NotificationPill';
import TaskEditModal from './organizer/TaskEditModal';

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: <Calendar size={20} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={20} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={20} /> },
];

export default React.memo(function Organizer() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [tabOrder, setTabOrder] = useState(['calendar', 'tasks', 'notes']);
  const [notification, setNotification] = useState<{ message: string, undo?: () => void } | null>(null);
  
  // Settings State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isScheduleExpanded, setIsScheduleExpanded] = useState(false);
  
  // Edit State
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      const savedOrder = await getSetting('organizer_tab_order');
      if (savedOrder) {
        setTabOrder(savedOrder);
        setActiveTab(savedOrder[0]);
      }
    };
    loadOrder();
    loadSettings();

    const handleOpenLink = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { type, value } = customEvent.detail;
      if (type === 'note') {
        setActiveTab('notes');
        setTimeout(() => window.dispatchEvent(new CustomEvent('organizer:open-note', { detail: value })), 100);
      } else if (type === 'task') {
        setActiveTab('tasks');
        setTimeout(() => window.dispatchEvent(new CustomEvent('organizer:open-task', { detail: value })), 100);
      } else if (type === 'cal') {
        setActiveTab('calendar');
        setTimeout(() => window.dispatchEvent(new CustomEvent('organizer:open-cal', { detail: value })), 100);
      }
    };
    window.addEventListener('radix:open-link', handleOpenLink);
    return () => window.removeEventListener('radix:open-link', handleOpenLink);
  }, []);

  const loadSettings = async () => {
      const settings = await organizerDb.settings.toArray();
      if (settings.length > 0) {
          setUserSettings(settings[0]);
      } else {
          // Initialize default settings
          const defaultSchedule: DaySchedule[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => ({
              day,
              wakeTime: '07:00',
              sleepTime: '23:00',
              workStart: '09:00',
              workEnd: '17:00',
              isWorkDay: day !== 'saturday' && day !== 'sunday'
          }));
          const newSettings: UserSettings = { schedule: defaultSchedule };
          const id = await organizerDb.settings.add(newSettings);
          setUserSettings({ ...newSettings, id: id as number });
      }
  };

  const handleSaveSettings = async () => {
      if (userSettings) {
          await organizerDb.settings.update(userSettings.id!, userSettings as any);
          window.dispatchEvent(new Event('settings:updated'));
          setShowSettingsModal(false);
      }
  };

  const showNotification = (message: string, undo?: () => void) => {
    setNotification({ message, undo });
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleReorder = async (newOrder: string[]) => {
    setTabOrder(newOrder);
    await setSetting('organizer_tab_order', newOrder);
  };

  const handleSaveTask = async (updatedTask: Task) => {
    await organizerDb.tasks.put(updatedTask);
    setEditingTask(null);
    showNotification('Task updated!');
  };

  const renderView = () => {
    switch (activeTab) {
      case 'calendar': return <CalendarView />;
      case 'tasks': return <TaskListView onEditTask={setEditingTask} />;
      case 'notes': return <NotesView />;
      default: return <CalendarView />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] relative overflow-hidden pwa-bg">
      {/* Header / Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-bg)] z-10">
        <Reorder.Group 
          axis="x" 
          values={tabOrder} 
          onReorder={handleReorder} 
          className="flex items-center justify-evenly w-full"
        >
          {tabOrder.map((tabId) => {
            const tab = TABS.find(t => t.id === tabId);
            if (!tab) return null;
            const isActive = activeTab === tabId;
            
            return (
              <Reorder.Item 
                key={tabId} 
                value={tabId} 
                className="flex items-center"
                whileDrag={{ scale: 1.1, zIndex: 10 }}
              >
                <button
                  onClick={() => handleTabChange(tabId)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-[var(--accent)] text-black font-bold' 
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-color)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        
        <button 
          onClick={() => setShowSettingsModal(true)}
          className={`ml-2 p-2 rounded-full transition-colors text-[var(--text-muted)] hover:bg-[var(--bg-color)] hover:text-[var(--text-main)]`}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Main Content Area with Swipe Animation */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 overflow-y-auto"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Persistent FAB */}
      <OrganizerFab onNotification={showNotification} onNavigate={handleTabChange} />

      {/* Notification Pill */}
      {notification && (
        <NotificationPill
          message={notification.message}
          onUndo={notification.undo}
          isVisible={!!notification}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal 
          task={editingTask} 
          onClose={() => setEditingTask(null)} 
          onSave={handleSaveTask} 
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && userSettings && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="min-h-screen flex items-center justify-center p-4">
                  <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 relative">
                      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-color)] sticky top-0 z-10">
                          <h3 className="font-bold text-lg text-[var(--text-main)] flex items-center gap-2">
                              <Settings size={20} /> Organizer Settings
                          </h3>
                          <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-[var(--panel-bg)] rounded-full">
                              <X size={20} />
                          </button>
                      </div>
                      
                      <div className="p-6 space-y-6">
                          {/* Schedule Section */}
                          <div className="space-y-4">
                              <button 
                                onClick={() => setIsScheduleExpanded(!isScheduleExpanded)}
                                className="w-full flex items-center justify-between text-sm font-bold uppercase text-[var(--accent)] hover:bg-[var(--bg-color)] p-2 rounded-lg transition-colors"
                              >
                                <span>Weekly Time Constraints</span>
                                <ChevronRight size={16} className={`transition-transform ${isScheduleExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              
                              <AnimatePresence>
                                {isScheduleExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="grid gap-4 pt-2">
                                        {userSettings.schedule.map((day, idx) => (
                                            <div key={day.day} className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-4 items-center p-3 bg-[var(--bg-color)] rounded-lg border border-[var(--border)]">
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={day.isWorkDay}
                                                        onChange={e => {
                                                            const newSchedule = [...userSettings.schedule];
                                                            newSchedule[idx].isWorkDay = e.target.checked;
                                                            setUserSettings({ ...userSettings, schedule: newSchedule });
                                                        }}
                                                        className="accent-[var(--accent)]"
                                                    />
                                                    <span className="capitalize font-medium text-sm">{day.day.slice(0, 3)}</span>
                                                </div>
                                                
                                                <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 ${!day.isWorkDay ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <div>
                                                        <label className="text-[10px] text-[var(--text-muted)] uppercase block">Wake</label>
                                                        <input 
                                                            type="time" 
                                                            value={day.wakeTime}
                                                            onChange={e => {
                                                                const newSchedule = [...userSettings.schedule];
                                                                newSchedule[idx].wakeTime = e.target.value;
                                                                setUserSettings({ ...userSettings, schedule: newSchedule });
                                                            }}
                                                            className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded p-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-[var(--text-muted)] uppercase block">Work Start</label>
                                                        <input 
                                                            type="time" 
                                                            value={day.workStart}
                                                            onChange={e => {
                                                                const newSchedule = [...userSettings.schedule];
                                                                newSchedule[idx].workStart = e.target.value;
                                                                setUserSettings({ ...userSettings, schedule: newSchedule });
                                                            }}
                                                            className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded p-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-[var(--text-muted)] uppercase block">Work End</label>
                                                        <input 
                                                            type="time" 
                                                            value={day.workEnd}
                                                            onChange={e => {
                                                                const newSchedule = [...userSettings.schedule];
                                                                newSchedule[idx].workEnd = e.target.value;
                                                                setUserSettings({ ...userSettings, schedule: newSchedule });
                                                            }}
                                                            className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded p-1 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-[var(--text-muted)] uppercase block">Sleep</label>
                                                        <input 
                                                            type="time" 
                                                            value={day.sleepTime}
                                                            onChange={e => {
                                                                const newSchedule = [...userSettings.schedule];
                                                                newSchedule[idx].sleepTime = e.target.value;
                                                                setUserSettings({ ...userSettings, schedule: newSchedule });
                                                            }}
                                                            className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded p-1 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                          </div>

                          {/* Notes Section */}
                          <div className="space-y-4 border-t border-[var(--border)] pt-6">
                              <h4 className="text-sm font-bold uppercase text-[var(--accent)] px-2">Notes Settings</h4>
                              
                              <div className="space-y-6 px-2">
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm text-[var(--text-main)] font-medium">Default Font Size</label>
                                    <span className="text-xs text-[var(--text-muted)]">{userSettings.notesFontSize || 14}px</span>
                                  </div>
                                  <input 
                                    type="range" 
                                    min="10" 
                                    max="20" 
                                    value={userSettings.notesFontSize || 14}
                                    onChange={async (e) => {
                                      const newSize = parseInt(e.target.value);
                                      const newSettings = { ...userSettings, notesFontSize: newSize };
                                      setUserSettings(newSettings);
                                      await organizerDb.settings.update(userSettings.id!, newSettings as any);
                                      window.dispatchEvent(new Event('settings:updated'));
                                    }}
                                    className="w-full accent-[var(--accent)]"
                                  />
                                </div>

                                <div>
                                  <label className="text-sm text-[var(--text-main)] font-medium block mb-2">List View Tile Size</label>
                                  <div className="flex gap-2">
                                    {['xs', 'sm', 'md', 'lg', 'xl'].map(size => (
                                      <button
                                        key={size}
                                        onClick={() => setUserSettings({ ...userSettings, notesListTileSize: size as any })}
                                        className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition-colors ${
                                          (userSettings.notesListTileSize || 'md') === size 
                                            ? 'bg-[var(--accent)] text-black border-[var(--accent)]' 
                                            : 'bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]/50'
                                        }`}
                                      >
                                        {size}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                          </div>
                      </div>

                      <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-color)] flex justify-end items-center sticky bottom-0 z-10">
                          <button 
                              onClick={handleSaveSettings}
                              className="px-6 py-2 rounded-xl bg-[var(--accent)] text-black font-bold hover:opacity-90"
                          >
                              Save Changes
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
});

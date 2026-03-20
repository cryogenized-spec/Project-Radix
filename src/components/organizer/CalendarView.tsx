import React, { useState, useEffect, useRef } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO, addWeeks, subWeeks, startOfDay, endOfDay, setHours, setMinutes, differenceInMinutes, isBefore, isAfter } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Bell, Repeat, Trash2, X, Clock, Edit2, Plus, AlertCircle, Check, Settings, Eye, Sparkles, CheckSquare } from 'lucide-react';
import { db, type Event as OrganizerEvent, UserSettings, DaySchedule } from '../../lib/organizerDb';
import { useRadixSync } from '../../lib/useRadixSync';

export default function CalendarView() {
  const { frames } = useRadixSync();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weekZoom, setWeekZoom] = useState(1); // 1 = 100% (4 days visible), 0.5 = 50% (7 days visible)



  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'event' | 'day', data: any } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadEvents();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const handleOpenCal = (e: any) => {
      const dateStr = e.detail;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          setCurrentDate(date);
          setSelectedDate(date);
          setView('day');
        }
      }
    };
    window.addEventListener('organizer:open-cal', handleOpenCal);
    
    const handleRefresh = () => {
      loadEvents();
      expandEventsForView();
    };
    window.addEventListener('organizer:refresh', handleRefresh);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('organizer:open-cal', handleOpenCal);
      window.removeEventListener('organizer:refresh', handleRefresh);
    };
  }, [currentDate, view]);

  // Expand recurring events whenever raw events change or view range changes
  useEffect(() => {
    expandEventsForView();
  }, [events, currentDate, view, frames]);

  const loadEvents = async () => {
    const allEvents = await db.events.toArray();
    setEvents(allEvents);
  };

  const expandEventsForView = async () => {
    // Determine view range
    let start = startOfMonth(currentDate);
    let end = endOfMonth(currentDate);
    
    if (view === 'week') {
        start = startOfWeek(currentDate);
        end = endOfWeek(currentDate);
    } else if (view === 'day') {
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
    }

    // Buffer for recurrence expansion
    start = subMonths(start, 1); 
    end = addMonths(end, 1);

    const expanded: any[] = [];

    events.forEach(ev => {
        if (!ev.recurrence || ev.recurrence.type === 'none') {
            // Single event
            const evDate = parseISO(ev.date);
            if (evDate >= start && evDate <= end) {
                expanded.push({ ...ev, originalId: ev.id, isRecurringInstance: false });
            }
        } else {
            // Recurring event expansion (Simple implementation)
            let current = parseISO(ev.date);
            const endDate = ev.recurrence.endDate ? parseISO(ev.recurrence.endDate) : addMonths(new Date(), 12); // Limit infinite
            
            // If event start is after view end, skip
            if (current > end) return;

            while (current <= end && current <= endDate) {
                if (current >= start) {
                    expanded.push({
                        ...ev,
                        date: format(current, 'yyyy-MM-dd'),
                        originalId: ev.id,
                        isRecurringInstance: true
                    });
                }

                // Advance date
                if (ev.recurrence.type === 'daily') {
                    current = addDays(current, ev.recurrence.interval || 1);
                } else if (ev.recurrence.type === 'weekly') {
                    current = addWeeks(current, ev.recurrence.interval || 1);
                    // Handle specific days of week if needed (simplified here to just interval)
                } else if (ev.recurrence.type === 'monthly') {
                    current = addMonths(current, ev.recurrence.interval || 1);
                } else {
                    break; // Custom not fully supported in this simple loop
                }
            }
        }
    });

    // Add tasks from DB
    const dbTasks = await db.tasks.toArray();
    dbTasks.forEach(task => {
        if (task.dueDate) {
            const taskDate = new Date(task.dueDate);
            if (taskDate >= start && taskDate <= end) {
                expanded.push({
                    id: task.id,
                    title: task.title,
                    date: format(taskDate, 'yyyy-MM-dd'),
                    startTime: format(taskDate, 'HH:mm'),
                    duration: task.duration || 60,
                    originalId: task.id,
                    isRecurringInstance: false,
                    isTask: true,
                    completed: task.completed
                });
            }
        }
    });

    setExpandedEvents(expanded);
  };

  const next = () => {
      if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
      else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
      else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
      if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
      else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
      else setCurrentDate(addDays(currentDate, -1));
  };
  
  const onDateClick = (day: Date) => {
    setSelectedDate(day);
    if (view === 'month') {
        // Optional: open modal directly on day click? 
        // Or just select. Let's select for now, double click to create?
        // Requirement: "Tap or click on a date/time slot to open a lightweight event creation modal"
        openCreateModal(day);
    }
  };

  const openCreateModal = (date?: Date, time?: string) => {
      let initialDate = date || new Date();
      if (time) {
          const [hours, minutes] = time.split(':');
          initialDate.setHours(parseInt(hours, 10), parseInt(minutes, 10));
      }
      window.dispatchEvent(new CustomEvent('organizer:create-task', { detail: { date: initialDate.getTime() } }));
      setContextMenu(null);
  };

  const openEditModal = async (event: any) => {
      if (event.isTask) {
          const task = await db.tasks.get(event.id);
          if (task) {
              window.dispatchEvent(new CustomEvent('organizer:edit-task', { detail: task }));
          }
      } else {
          // Convert legacy event to task format
          const dateObj = new Date(`${event.date}T${event.startTime}`);
          const newTask = {
              title: event.title,
              text: event.title,
              dueDate: dateObj.getTime(),
              duration: event.duration || 60,
              priority: 'medium',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              linkedEventId: event.originalId || event.id
          };
          window.dispatchEvent(new CustomEvent('organizer:edit-task', { detail: newTask }));
      }
      setContextMenu(null);
  };



  const handleDeleteEntry = async (entry: any) => {
      if (confirm("Delete this entry?")) {
          if (entry.isTask) {
              await db.tasks.delete(entry.id);
          } else {
              if (entry.isRecurringInstance) {
                  await db.events.delete(entry.originalId);
              } else {
                  await db.events.delete(entry.id);
              }
          }
          setContextMenu(null);
          loadEvents();
          window.dispatchEvent(new Event('organizer:refresh'));
      }
  };

  const handleLongPress = (e: React.MouseEvent | React.TouchEvent, data: any, type: 'event' | 'day' = 'event') => {
      e.preventDefault();
      // Calculate position
      let clientX, clientY;
      if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
      }
      
      setContextMenu({
          x: clientX,
          y: clientY,
          type,
          data
      });
  };

  const renderHeader = () => {
    let titleFormat = 'MMMM yyyy';
    if (view === 'day') titleFormat = 'MMMM d, yyyy';
    
    return (
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--panel-bg)] gap-2">
        <div className="flex items-center space-x-1 sm:space-x-2 flex-1 min-w-0">
          <button onClick={prev} className="p-1 hover:bg-[var(--bg-color)] rounded-full shrink-0">
            <ChevronLeft size={20} />
          </button>
          <span className="text-base sm:text-lg font-bold uppercase tracking-widest text-[var(--accent)] truncate">
            {format(currentDate, titleFormat)}
          </span>
          <button onClick={next} className="p-1 hover:bg-[var(--bg-color)] rounded-full shrink-0">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('organizer:create-task', { detail: { date: currentDate.getTime() } }))}
            className="hidden sm:flex bg-[var(--accent)] text-black rounded-lg px-2 py-1 text-[10px] font-bold items-center gap-1 shrink-0 whitespace-nowrap"
          >
            <CheckSquare size={12} /> Add Task
          </button>
          {view === 'week' && (
            <div className="hidden sm:flex items-center space-x-2 mr-2 bg-[var(--bg-color)] px-2 py-1 rounded-lg">
              <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Zoom</span>
              <input 
                type="range" 
                min="0.5" 
                max="1" 
                step="0.1" 
                value={weekZoom} 
                onChange={(e) => setWeekZoom(parseFloat(e.target.value))}
                className="w-16 sm:w-24 accent-[var(--accent)]"
              />
            </div>
          )}
          <div className="flex space-x-1 bg-[var(--bg-color)] p-1 rounded-lg shrink-0 overflow-x-auto max-w-full">
            {['month', 'week', 'day'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v as any)}
                className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold uppercase rounded-md transition-colors ${
                  view === v ? 'bg-[var(--accent)] text-black' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handleTouchStart = (e: React.TouchEvent, data: any, type: 'event' | 'day' = 'event') => {
      e.persist(); // React pooling
      const target = e.currentTarget as HTMLElement;
      target.style.transform = 'scale(0.95)';
      
      longPressTimerRef.current = setTimeout(() => {
          target.style.transform = 'scale(1)';
          handleLongPress(e, data, type);
      }, 500);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      const target = e.currentTarget as HTMLElement;
      target.style.transform = 'scale(1)';
      
      if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
      }
  };

  const renderEventItem = (ev: any, isCompact: boolean = false) => {
      const hasAlert = ev.alertOffset && ev.alertOffset > 0;
      const isOverdue = !ev.completed && isBefore(parseISO(`${ev.date}T${ev.startTime}`), new Date());
      const isRecurring = ev.recurrence && ev.recurrence.type !== 'none';

      return (
        <div 
            className={`
                ${isCompact ? 'text-[9px] px-1 py-0.5' : 'text-xs p-1'} 
                bg-[var(--panel-bg)] border border-[var(--border)] rounded 
                truncate text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-color)]
                flex items-center space-x-1 relative group transition-transform duration-200
                ${isOverdue ? 'border-red-500/50' : ''}
                ${ev.completed ? 'opacity-50 line-through' : ''}
            `}
            onClick={(e) => {
                e.stopPropagation();
                openEditModal(ev);
            }}
            onContextMenu={(e) => handleLongPress(e, ev)}
            onTouchStart={(e) => handleTouchStart(e, ev)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
        >
            {ev.isTask && (
                ev.completed ? <Check size={8} className="text-[var(--text-muted)]" /> : <CheckSquare size={8} className="text-[var(--accent)]" />
            )}
            {hasAlert && !ev.isTask && (
                <div className={`w-1.5 h-1.5 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'}`}></div>
            )}
            {isRecurring && <Repeat size={8} className="text-[var(--text-muted)]" />}
            {ev.startTime && <span className="opacity-70">{ev.startTime}</span>}
            <span className="font-medium truncate">{ev.title}</span>
        </div>
      );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    // Header Row
    const dayNames = [];
    for (let i = 0; i < 7; i++) {
        dayNames.push(
            <div className="flex-1 text-center text-xs font-bold text-[var(--text-muted)] uppercase py-2 border-b border-[var(--border)]" key={i}>
                {format(addDays(startDate, i), "EEE")}
            </div>
        );
    }

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayEvents = expandedEvents.filter(e => e.date === dayStr);

        days.push(
          <div
            className={`flex-1 h-24 border-r border-b border-[var(--border)] relative cursor-pointer hover:bg-[var(--bg-color)]/50 transition-colors ${
              !isSameMonth(day, monthStart)
                ? "text-[var(--text-muted)] opacity-50 bg-[var(--bg-color)]/30"
                : isSameDay(day, selectedDate) ? "bg-[var(--accent)]/5" : ""
            }`}
            key={day.toString()}
            onClick={() => {
                setView('day');
                setCurrentDate(cloneDay);
            }}
            onContextMenu={(e) => handleLongPress(e, cloneDay, 'day')}
            onTouchStart={(e) => handleTouchStart(e, cloneDay, 'day')}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
          >
            <div className={`absolute top-2 left-2 text-xs font-bold ${
                isSameDay(day, new Date()) ? "text-[var(--accent)]" : ""
            }`}>
              {formattedDate}
            </div>
            
            <div className="mt-6 px-1 space-y-1 overflow-hidden max-h-[calc(100%-24px)] flex flex-col">
                {dayEvents.slice(0, 3).map((ev, idx) => (
                    <div key={idx} className="min-w-0">{renderEventItem(ev, true)}</div>
                ))}
                {dayEvents.length > 3 && (
                    <div 
                        className="text-[9px] text-[var(--text-muted)] pl-1 hover:text-[var(--text-main)]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setView('day');
                            setCurrentDate(cloneDay);
                        }}
                    >
                        +{dayEvents.length - 3} more
                    </div>
                )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="flex group" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return (
        <div className="flex flex-col">
            <div className="flex">{dayNames}</div>
            {rows}
        </div>
    );
  };

  const renderTimeGrid = (daysToShow: Date[]) => {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      
      // Calculate min-width based on zoom level for week view
      // 1x zoom = ~4 days visible (175% width for 7 days)
      // 0.5x zoom = 7 days visible (100% width)
      const isWeek = daysToShow.length > 1;
      const minWidth = isWeek ? `${100 + (weekZoom - 0.5) * 150}%` : '100%';
      
      return (
          <div className="flex flex-col relative h-full w-max" style={{ minWidth }}>
              {/* Header */}
              <div className="flex border-b border-[var(--border)] sticky top-0 bg-[var(--panel-bg)] z-30">
                  <div className="w-16 flex-shrink-0 border-r border-[var(--border)] sticky left-0 bg-[var(--panel-bg)] z-40"></div>
                  {daysToShow.map((day, i) => (
                      <div key={i} className={`flex-1 min-w-[100px] text-center py-2 border-r border-[var(--border)] ${isSameDay(day, new Date()) ? 'bg-[var(--accent)]/5' : ''}`}>
                          <div className="text-xs text-[var(--text-muted)] uppercase">{format(day, 'EEE')}</div>
                          <div className={`text-sm font-bold ${isSameDay(day, new Date()) ? 'text-[var(--accent)]' : ''}`}>
                              {format(day, 'd')}
                          </div>
                      </div>
                  ))}
              </div>

              {/* Grid */}
              <div className="flex relative flex-1">
                  {/* Time Labels */}
                  <div className="w-16 flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-color)] z-20 sticky left-0">
                      {hours.map(h => (
                          <div key={h} className="absolute text-[10px] text-[var(--text-muted)] text-right w-16 pr-2" style={{ top: `${h * 64}px`, transform: 'translateY(-50%)' }}>
                              {h === 0 ? '' : format(setMinutes(setHours(new Date(), h), 0), 'HH:mm')}
                          </div>
                      ))}
                  </div>

                  {/* Columns */}
                  {daysToShow.map((day, colIndex) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const dayEvents = expandedEvents.filter(e => e.date === dayStr);
                      
                      return (
                          <div 
                            key={colIndex} 
                            className="flex-1 border-r border-[var(--border)] relative min-w-[100px] group"
                            onClick={(e) => {
                                // Calculate time from click Y position
                                const rect = e.currentTarget.getBoundingClientRect();
                                const y = e.clientY - rect.top + e.currentTarget.scrollTop;
                                const hour = Math.floor(y / 64); // 64px per hour
                                const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                                openCreateModal(day, timeStr);
                            }}
                          >
                              {/* Hour Lines */}
                              {hours.map(h => (
                                  <div key={h} className="h-16 border-b border-[var(--border)]/30 pointer-events-none"></div>
                              ))}

                              {/* Current Time Line */}
                              {isSameDay(day, new Date()) && (
                                  <div 
                                      className="absolute w-full z-10 pointer-events-none flex items-center"
                                      style={{ top: `${(currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60) * (64 / 60)}px`, transform: 'translateY(-50%)' }}
                                  >
                                      <div className="w-3 h-3 rounded-full -ml-1.5 shadow-[0_0_12px_var(--accent)] relative flex items-center justify-center" style={{ background: 'radial-gradient(circle at 30% 30%, #ffffff, var(--accent))' }}>
                                          <Sparkles size={8} className="text-white absolute animate-pulse" />
                                      </div>
                                      <div className="flex-1 h-[2px] opacity-70" style={{ background: 'linear-gradient(90deg, var(--accent), transparent)' }}></div>
                                  </div>
                              )}

                              {/* Events */}
                              {dayEvents.map((ev, idx) => {
                                  if (!ev.startTime) return null;
                                  const [h, m] = ev.startTime.split(':').map(Number);
                                  const top = (h * 60 + m) * (64 / 60);
                                  const height = (ev.duration || 60) * (64 / 60);
                                  
                                  const hasAlert = ev.alertOffset && ev.alertOffset > 0;
                                  const isOverdue = hasAlert && isBefore(parseISO(`${ev.date}T${ev.startTime}`), new Date());

                                  return (
                                      <div 
                                          key={idx}
                                          className={`absolute left-1 right-1 rounded p-1 text-[10px] overflow-hidden hover:z-30 transition-all cursor-pointer border-l-2 shadow-sm duration-200
                                            ${isOverdue ? 'bg-red-500/10 border-red-500' : 'bg-[var(--accent)]/20 border-[var(--accent)] hover:bg-[var(--accent)]/30'}
                                          `}
                                          style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              openEditModal(ev);
                                          }}
                                          onContextMenu={(e) => handleLongPress(e, ev)}
                                          onTouchStart={(e) => handleTouchStart(e, ev)}
                                          onTouchEnd={handleTouchEnd}
                                          onTouchMove={handleTouchEnd}
                                      >
                                          <div className="flex items-center space-x-1">
                                            {hasAlert && <Bell size={8} className={isOverdue ? 'text-red-500' : 'text-yellow-500'} />}
                                            {ev.recurrence?.type !== 'none' && <Repeat size={8} />}
                                            <span className="font-bold truncate">{ev.title}</span>
                                          </div>
                                          <div className="opacity-70 truncate">{ev.startTime} - {format(addDays(setMinutes(setHours(new Date(), h), m + (ev.duration || 60)), 0), 'HH:mm')}</div>
                                      </div>
                                  );
                              })}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const renderWeekView = () => {
      const start = startOfWeek(currentDate);
      const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
      return renderTimeGrid(days);
  };

  const renderDayView = () => {
      return renderTimeGrid([currentDate]);
  };

  return (
    <div className="flex flex-col h-full relative">
      {renderHeader()}
      <div className="flex-1 overflow-auto relative">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>



      {/* Context Menu */}
      {contextMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setContextMenu(null)}></div>
            <div 
                className="fixed z-40 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shadow-2xl w-48 overflow-hidden animate-in zoom-in-95"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                {contextMenu.type === 'event' ? (
                    <>
                        <div className="p-2 border-b border-[var(--border)] bg-[var(--bg-color)]">
                            <div className="text-xs font-bold truncate">{contextMenu.data.title}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{contextMenu.data.startTime}</div>
                        </div>
                        <div className="flex flex-col p-1">
                            <button 
                                onClick={() => openEditModal(contextMenu.data)}
                                className="flex items-center space-x-2 p-2 hover:bg-[var(--bg-color)] rounded-lg text-xs text-left"
                            >
                                <Edit2 size={14} /> <span>Edit</span>
                            </button>
                            <div className="border-t border-[var(--border)] my-1"></div>
                            <button 
                                onClick={() => handleDeleteEntry(contextMenu.data)}
                                className="flex items-center space-x-2 p-2 hover:bg-red-500/10 text-red-500 rounded-lg text-xs text-left"
                            >
                                <Trash2 size={14} /> <span>Delete</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-2 border-b border-[var(--border)] bg-[var(--bg-color)]">
                            <div className="text-xs font-bold truncate">{format(contextMenu.data, 'MMMM d, yyyy')}</div>
                        </div>
                        <div className="flex flex-col p-1">
                            <button 
                                onClick={() => {
                                    setView('day');
                                    setCurrentDate(contextMenu.data);
                                    setContextMenu(null);
                                }}
                                className="flex items-center space-x-2 p-2 hover:bg-[var(--bg-color)] rounded-lg text-xs text-left"
                            >
                                <Eye size={14} /> <span>View Day</span>
                            </button>

                            <button 
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('organizer:create-task', { detail: { date: contextMenu.data.getTime() } }));
                                    setContextMenu(null);
                                }}
                                className="flex items-center space-x-2 p-2 hover:bg-[var(--bg-color)] rounded-lg text-xs text-left"
                            >
                                <CheckSquare size={14} /> <span>Add Task</span>
                            </button>
                            <div className="border-t border-[var(--border)] my-1"></div>
                            <button 
                                onClick={() => {
                                    // AI Check Schedule Placeholder
                                    alert("AI Check Schedule coming soon!");
                                    setContextMenu(null);
                                }}
                                className="flex items-center space-x-2 p-2 hover:bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg text-xs text-left"
                            >
                                <Sparkles size={14} /> <span>Check Schedule</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
          </>
      )}
    </div>
  );
}

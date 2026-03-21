import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, Calendar, Save, X, Bell } from 'lucide-react';
import { subscribeToPushNotifications, getSavedPushSubscription } from '../lib/pushNotifications';

export interface AgentJob {
  id: string;
  scheduleType: 'interval' | 'specific_time';
  scheduleValue: string; // e.g., "2" for 2 hours, or "08:00,14:00" for specific times
  description: string;
  lastRun?: number;
  nextRun?: number;
}

interface AgentCronManagerProps {
  jobs: AgentJob[];
  onChange: (jobs: AgentJob[]) => void;
}

export const AgentCronManager: React.FC<AgentCronManagerProps> = ({ jobs, onChange }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // Form State
  const [scheduleType, setScheduleType] = useState<'interval' | 'specific_time'>('interval');
  const [scheduleValue, setScheduleValue] = useState('2');
  const [description, setDescription] = useState('');

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingJobId(null);
    setScheduleType('interval');
    setScheduleValue('2');
    setDescription('');
  };

  const handleEdit = (job: AgentJob) => {
    setIsCreating(true);
    setEditingJobId(job.id);
    setScheduleType(job.scheduleType);
    setScheduleValue(job.scheduleValue);
    setDescription(job.description);
  };

  const handleDelete = (id: string) => {
    onChange(jobs.filter(j => j.id !== id));
  };

  const handleSave = () => {
    if (!description.trim() || !scheduleValue.trim()) return;

    const newJob: AgentJob = {
      id: editingJobId || crypto.randomUUID(),
      scheduleType,
      scheduleValue,
      description,
      lastRun: jobs.find(j => j.id === editingJobId)?.lastRun,
      nextRun: calculateNextRun(scheduleType, scheduleValue)
    };

    if (editingJobId) {
      onChange(jobs.map(j => j.id === editingJobId ? newJob : j));
    } else {
      onChange([...jobs, newJob]);
    }

    setIsCreating(false);
    setEditingJobId(null);
  };

  const calculateNextRun = (type: 'interval' | 'specific_time', value: string): number => {
    const now = Date.now();
    if (type === 'interval') {
      const hours = parseFloat(value);
      if (isNaN(hours)) return now;
      return now + hours * 60 * 60 * 1000;
    } else {
      // specific_time, e.g., "08:00,14:00"
      const times = value.split(',').map(t => t.trim());
      let nextTime = Infinity;
      const today = new Date();
      
      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;
        
        const candidate = new Date(today);
        candidate.setHours(hours, minutes, 0, 0);
        
        if (candidate.getTime() <= now) {
          candidate.setDate(candidate.getDate() + 1);
        }
        
        if (candidate.getTime() < nextTime) {
          nextTime = candidate.getTime();
        }
      }
      return nextTime === Infinity ? now : nextTime;
    }
  };

  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    getSavedPushSubscription().then(sub => {
      setIsSubscribed(!!sub);
    });
  }, []);

  const handleSubscribe = async () => {
    const sub = await subscribeToPushNotifications();
    if (sub) {
      setIsSubscribed(true);
    }
  };

  const formatNextRun = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock size={16} className="text-[var(--accent)]" />
          Scheduled Tasks
        </h3>
        <div className="flex items-center gap-2">
          {!isSubscribed && (
            <button 
              onClick={handleSubscribe}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--panel-bg)] border border-[var(--border)] text-[var(--text-color)] rounded-lg text-xs font-medium hover:border-[var(--accent)] transition-colors"
              title="Enable Push Notifications"
            >
              <Bell size={14} />
              Enable Alerts
            </button>
          )}
          {!isCreating && (
            <button 
              onClick={handleCreateNew}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--accent)] text-[var(--bg-color)] rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={14} />
              {jobs.length === 0 ? 'Create first Cron job' : 'Create another cron job'}
            </button>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {editingJobId ? 'Edit Job' : 'New Job'}
            </h4>
            <button onClick={() => setIsCreating(false)} className="text-[var(--text-muted)] hover:text-[var(--text-color)]">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Schedule Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setScheduleType('interval')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs border transition-colors ${
                    scheduleType === 'interval' 
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' 
                      : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <Clock size={14} />
                  Time Interval
                </button>
                <button
                  onClick={() => setScheduleType('specific_time')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs border transition-colors ${
                    scheduleType === 'specific_time' 
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' 
                      : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
                  }`}
                >
                  <Calendar size={14} />
                  Specific Times
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">
                {scheduleType === 'interval' ? 'Interval (in hours)' : 'Times (comma separated, e.g. 08:00, 14:00)'}
              </label>
              <input
                type="text"
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                placeholder={scheduleType === 'interval' ? 'e.g. 2' : 'e.g. 08:00, 14:00'}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Job Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What should the AI agent do?"
                rows={3}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none resize-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={!description.trim() || !scheduleValue.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--bg-color)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                Save Job
              </button>
            </div>
          </div>
        </div>
      )}

      {!isCreating && jobs.length === 0 && (
        <div className="text-center py-8 text-[var(--text-muted)] text-sm border border-dashed border-[var(--border)] rounded-xl">
          No scheduled jobs yet.
        </div>
      )}

      {!isCreating && jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} className="p-3 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl flex items-start justify-between group">
              <div className="space-y-1 flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded">
                    {job.scheduleType === 'interval' ? `Every ${job.scheduleValue}h` : `At ${job.scheduleValue}`}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Next: {formatNextRun(job.nextRun)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-color)] line-clamp-2">{job.description}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleEdit(job)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-color)] rounded-lg transition-colors"
                >
                  <Clock size={14} />
                </button>
                <button 
                  onClick={() => handleDelete(job.id)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--bg-color)] rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

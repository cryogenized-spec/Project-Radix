import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Clock, Calendar, Save, X, Bell, Wand2, Code, LayoutTemplate, Edit2 } from 'lucide-react';
import { subscribeToPushNotifications, getSavedPushSubscription } from '../lib/pushNotifications';
import { GoogleGenAI } from '@google/genai';
import { getSetting } from '../lib/db';
import yaml from 'js-yaml';
import { Mermaid } from './Mermaid';

export interface AgentJob {
  id: string;
  scheduleType: 'interval' | 'specific_time';
  scheduleValue: string; // e.g., "2" for 2 hours, or "08:00,14:00" for specific times
  description: string;
  yamlLogic?: string;
  lastRun?: number;
  nextRun?: number;
}

interface AgentCronManagerProps {
  jobs: AgentJob[];
  onChange: (jobs: AgentJob[]) => void;
  agentApiKey?: string;
  agentId?: string;
}

const DEFAULT_YAML = `nodes:
  - id: start
    type: condition
    description: "Check my P2P chats every 2 hours"
    tool: "internal.get_chat_list"
    if_yes: "check_buddy"
    if_no: "search_exa"
  - id: check_buddy
    type: condition
    description: "If buddy X messages"
    tool: "internal.check_messages"
    if_yes: "alert_me"
    if_no: "end"
  - id: alert_me
    type: action
    description: "Alert me"
    tool: "system.trigger_push_notification"
    next: "end"
  - id: search_exa
    type: action
    description: "Search Exa for OSINT news"
    tool: "external.exa_search"
    next: "end"
  - id: end
    type: action
    description: "End Task"
    tool: "none"
`;

export const yamlToMermaid = (yamlStr: string): string => {
  try {
    const parsed = yaml.load(yamlStr) as any;
    if (!parsed || !parsed.nodes || !Array.isArray(parsed.nodes)) return 'graph TD\n  Start[Invalid YAML Structure]';

    let mermaid = 'graph TD\n';
    parsed.nodes.forEach((node: any) => {
      const safeDesc = node.description ? node.description.replace(/"/g, "'") : node.id;
      if (node.type === 'condition') {
        mermaid += `  ${node.id}{"${safeDesc}"}\n`;
        if (node.if_yes) mermaid += `  ${node.id} -- Yes --> ${node.if_yes}\n`;
        if (node.if_no) mermaid += `  ${node.id} -- No --> ${node.if_no}\n`;
      } else {
        mermaid += `  ${node.id}["${safeDesc}"]\n`;
        if (node.next) mermaid += `  ${node.id} --> ${node.next}\n`;
      }
    });
    return mermaid;
  } catch (e) {
    return 'graph TD\n  Error[Error Parsing YAML]';
  }
};

export const AgentCronManager: React.FC<AgentCronManagerProps> = ({ jobs, onChange, agentApiKey, agentId }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // Form State
  const [scheduleType, setScheduleType] = useState<'interval' | 'specific_time'>('interval');
  const [scheduleValue, setScheduleValue] = useState('2');
  const [description, setDescription] = useState('');
  const [yamlLogic, setYamlLogic] = useState(DEFAULT_YAML);
  
  // UI State
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeEditForm, setNodeEditForm] = useState<any>({});

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingJobId(null);
    setScheduleType('interval');
    setScheduleValue('2');
    setDescription('');
    setYamlLogic(DEFAULT_YAML);
    setViewMode('visual');
  };

  const handleEdit = (job: AgentJob) => {
    setIsCreating(true);
    setEditingJobId(job.id);
    setScheduleType(job.scheduleType);
    setScheduleValue(job.scheduleValue);
    setDescription(job.description);
    setYamlLogic(job.yamlLogic || DEFAULT_YAML);
    setViewMode('visual');
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
      yamlLogic,
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

  const handleMagicWand = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    try {
      let apiKey = agentApiKey;
      if (apiKey) {
        const { decryptApiKey } = await import('../lib/apiKeyCrypto');
        apiKey = await decryptApiKey(apiKey);
      }
      if (!apiKey) {
        const globalKeys = await getSetting('apiKeys');
        if (globalKeys?.Google) {
          const { decryptApiKey } = await import('../lib/apiKeyCrypto');
          apiKey = await decryptApiKey(globalKeys.Google);
        } else {
          apiKey = process.env.GEMINI_API_KEY;
        }
      }
      
      if (!apiKey) {
        alert("No API key found. Please configure a Google API key.");
        setIsGenerating(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
You are an expert at creating autonomous agent workflows.
Convert the following natural language goal into a strict nested YAML structure.
The YAML MUST have a root key "nodes" which is an array of node objects.
Each node MUST have:
- id: unique string (no spaces)
- type: "condition" or "action"
- description: string describing what it does
- tool: string (e.g., "internal.get_chat_list", "internal.get_calendar", "external.exa_search", "system.trigger_push_notification", "none")
If type is "condition", it MUST have:
- if_yes: id of next node
- if_no: id of next node
If type is "action", it MUST have:
- next: id of next node (or "end" if it's the last step)

Goal: "${description}"

Output ONLY valid YAML. Do not use markdown blocks like \`\`\`yaml. Just the raw YAML string.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt
      });

      let generatedYaml = response.text || '';
      generatedYaml = generatedYaml.replace(/^```yaml\n/i, '').replace(/\n```$/i, '').trim();
      
      setYamlLogic(generatedYaml);
      setViewMode('visual');
    } catch (error) {
      console.error("Magic Wand Error:", error);
      alert("Failed to generate workflow. Check console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNodeClick = (nodeId: string) => {
    try {
      const parsed = yaml.load(yamlLogic) as any;
      const node = parsed?.nodes?.find((n: any) => n.id === nodeId);
      if (node) {
        setSelectedNodeId(nodeId);
        setNodeEditForm({ ...node });
      }
    } catch (e) {
      console.error("Error parsing YAML for node click", e);
    }
  };

  const saveNodeEdit = () => {
    if (!selectedNodeId) return;
    try {
      const parsed = yaml.load(yamlLogic) as any;
      if (parsed && parsed.nodes) {
        const index = parsed.nodes.findIndex((n: any) => n.id === selectedNodeId);
        if (index !== -1) {
          parsed.nodes[index] = { ...nodeEditForm };
          setYamlLogic(yaml.dump(parsed));
        }
      }
      setSelectedNodeId(null);
    } catch (e) {
      console.error("Error saving node edit", e);
      alert("Invalid YAML state, cannot save node.");
    }
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
              <label className="block text-xs text-[var(--text-muted)] mb-1">Goal Description</label>
              <div className="flex gap-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Check my P2P chats every 2 hours; if buddy X messages, alert me. Otherwise, search Exa for OSINT news."
                  rows={2}
                  className="flex-1 bg-[var(--bg-color)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none resize-none"
                />
                <button
                  onClick={handleMagicWand}
                  disabled={isGenerating || !description.trim()}
                  className="flex flex-col items-center justify-center px-4 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded-lg hover:bg-[var(--accent)] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Generate Workflow with AI"
                >
                  <Wand2 size={20} className={isGenerating ? "animate-pulse" : ""} />
                  <span className="text-[10px] font-bold mt-1">MAGIC</span>
                </button>
              </div>
            </div>

            <div className="border border-[var(--border)] rounded-lg overflow-hidden flex flex-col">
              <div className="flex items-center justify-between bg-[var(--bg-color)] p-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Execution Logic</span>
                  <button
                    onClick={async () => {
                      try {
                        let apiKey = agentApiKey;
                        if (!apiKey) {
                          const globalKeys = await getSetting('apiKeys');
                          apiKey = globalKeys?.Google || process.env.GEMINI_API_KEY;
                        }
                        if (!apiKey) return alert("No API Key");
                        const { executeAgentWorkflow } = await import('../lib/agentExecutor');
                        alert("Starting test run... Check console for logs.");
                        const result = await executeAgentWorkflow(yamlLogic, apiKey, agentId);
                        console.log(result);
                        alert("Test run completed!");
                      } catch (e: any) {
                        alert("Test run failed: " + e.message);
                      }
                    }}
                    className="px-2 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 rounded text-[10px] font-bold hover:bg-[var(--accent)] hover:text-black transition-colors"
                  >
                    TEST RUN
                  </button>
                </div>
                <div className="flex bg-[var(--panel-bg)] rounded-md p-0.5 border border-[var(--border)]">
                  <button
                    onClick={() => setViewMode('visual')}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors ${viewMode === 'visual' ? 'bg-[var(--accent)] text-black font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                  >
                    <LayoutTemplate size={12} /> Visual
                  </button>
                  <button
                    onClick={() => setViewMode('code')}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors ${viewMode === 'code' ? 'bg-[var(--accent)] text-black font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'}`}
                  >
                    <Code size={12} /> Code
                  </button>
                </div>
              </div>
              
              <div className="relative min-h-[300px] bg-[var(--bg-color)]">
                {viewMode === 'visual' ? (
                  <div className="absolute inset-0 overflow-auto">
                    <Mermaid chart={yamlToMermaid(yamlLogic)} onNodeClick={handleNodeClick} />
                  </div>
                ) : (
                  <textarea
                    value={yamlLogic}
                    onChange={(e) => setYamlLogic(e.target.value)}
                    className="absolute inset-0 w-full h-full p-4 font-mono text-xs bg-[var(--bg-color)] text-[var(--text-color)] outline-none resize-none"
                    spellCheck={false}
                  />
                )}

                {/* Side Drawer for Node Editing */}
                {selectedNodeId && viewMode === 'visual' && (
                  <div className="absolute top-0 right-0 bottom-0 w-64 bg-[var(--panel-bg)] border-l border-[var(--border)] shadow-xl flex flex-col animate-in slide-in-from-right-8">
                    <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
                      <h5 className="text-xs font-bold flex items-center gap-1"><Edit2 size={12} /> Edit Node: {selectedNodeId}</h5>
                      <button onClick={() => setSelectedNodeId(null)} className="text-[var(--text-muted)] hover:text-[var(--text-color)]">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">Description</label>
                        <input 
                          type="text" 
                          value={nodeEditForm.description || ''} 
                          onChange={e => setNodeEditForm({...nodeEditForm, description: e.target.value})}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">Tool</label>
                        <input 
                          type="text" 
                          value={nodeEditForm.tool || ''} 
                          onChange={e => setNodeEditForm({...nodeEditForm, tool: e.target.value})}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      {nodeEditForm.type === 'condition' ? (
                        <>
                          <div>
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">If Yes (Next Node)</label>
                            <input 
                              type="text" 
                              value={nodeEditForm.if_yes || ''} 
                              onChange={e => setNodeEditForm({...nodeEditForm, if_yes: e.target.value})}
                              className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">If No (Next Node)</label>
                            <input 
                              type="text" 
                              value={nodeEditForm.if_no || ''} 
                              onChange={e => setNodeEditForm({...nodeEditForm, if_no: e.target.value})}
                              className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </>
                      ) : (
                        <div>
                          <label className="block text-[10px] text-[var(--text-muted)] uppercase mb-1">Next Node</label>
                          <input 
                            type="text" 
                            value={nodeEditForm.next || ''} 
                            onChange={e => setNodeEditForm({...nodeEditForm, next: e.target.value})}
                            className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded px-2 py-1 text-xs outline-none focus:border-[var(--accent)]"
                          />
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-[var(--border)]">
                      <button 
                        onClick={saveNodeEdit}
                        className="w-full py-1.5 bg-[var(--accent)] text-black rounded text-xs font-bold hover:opacity-90"
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
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

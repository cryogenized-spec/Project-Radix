import React, { useState, useEffect } from 'react';
import { X, Save, Bot, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { getSetting } from '../lib/db';

interface ProjectEditModalProps {
  type: 'bench' | 'build' | 'presence' | 'contribution' | 'archive' | 'proficiency' | 'inventory';
  initialData: any;
  onSave: (data: any) => void;
  onClose: () => void;
  allProficiencies?: any[]; // For connections
}

export function ProjectEditModal({ type, initialData, onSave, onClose, allProficiencies }: ProjectEditModalProps) {
  const [formData, setFormData] = useState<any>(initialData || {
    id: Date.now().toString(),
    title: '',
    description: '',
    ...(type === 'bench' ? {
      status: 'Designing',
      lastUpdated: Date.now(),
      attributes: [],
      attributeDescriptions: {},
      externalLink: ''
    } : type === 'presence' ? {
      platform: '',
      username: '',
      url: ''
    } : type === 'contribution' ? {
      date: Date.now()
    } : type === 'proficiency' ? {
      field: '',
      level: 'Novice',
      details: '',
      connections: []
    } : type === 'inventory' ? {
      name: '',
      category: '',
      specs: ''
    } : {
      tags: [],
      thumbnail: '',
      externalLink: ''
    })
  });
  
  const [hasAgents, setHasAgents] = useState(false);
  const [isConsulting, setIsConsulting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  useEffect(() => {
    const checkAgents = async () => {
      const agents = await getSetting('agents');
      if (agents && agents.length > 0) {
        setHasAgents(true);
      }
    };
    checkAgents();
  }, []);

  const handleConsultAssistant = async () => {
    setIsConsulting(true);
    setAiSuggestion('');
    
    // Simulate AI consultation
    setTimeout(() => {
      setAiSuggestion(`Consider expanding on the technical challenges you overcame in "${formData.title || 'this project'}". Mentioning specific tools or methodologies can make the description more engaging for other builders.`);
      setIsConsulting(false);
    }, 1500);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [type === 'bench' ? 'image' : 'thumbnail']: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleAttribute = (attr: string) => {
    if (type !== 'bench') return;
    
    const attrs = formData.attributes || [];
    if (attrs.includes(attr)) {
      setFormData({
        ...formData,
        attributes: attrs.filter((a: string) => a !== attr)
      });
    } else {
      setFormData({
        ...formData,
        attributes: [...attrs, attr]
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="radix-panel p-6 rounded-2xl max-w-lg w-full border border-[var(--border)] my-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-[var(--text-main)]">
            {initialData ? 'Edit' : 'Add'} {
              type === 'bench' ? 'Bench Item' : 
              type === 'build' ? 'Build' : 
              type === 'presence' ? 'Active In' : 
              type === 'contribution' ? 'Contribution' : 
              type === 'proficiency' ? 'Proficiency' :
              type === 'inventory' ? 'Hardware' :
              'Archived Project'
            }
          </h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--accent)]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {type === 'presence' ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Platform</label>
                <input 
                  type="text" 
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="GitHub, Hackaday..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Username</label>
                <input 
                  type="text" 
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="@username"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">URL</label>
                <input 
                  type="url" 
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="https://..."
                />
              </div>
            </>
          ) : type === 'proficiency' ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Field / Skill</label>
                <input 
                  type="text" 
                  value={formData.field}
                  onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="e.g. Software Engineering, 3D Printing..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Level</label>
                <select 
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                >
                  <option value="Novice">Novice</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Details (Tools, Tech)</label>
                <input 
                  type="text" 
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="e.g. React, Rust, Node.js"
                />
              </div>
              {allProficiencies && allProficiencies.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Connects To</label>
                  <div className="flex flex-wrap gap-2">
                    {allProficiencies.filter(p => p.id !== formData.id).map(prof => (
                      <button
                        key={prof.id}
                        onClick={() => {
                          const conns = formData.connections || [];
                          if (conns.includes(prof.id)) {
                            setFormData({ ...formData, connections: conns.filter((c: string) => c !== prof.id) });
                          } else {
                            setFormData({ ...formData, connections: [...conns, prof.id] });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                          (formData.connections || []).includes(prof.id)
                            ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' 
                            : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-main)]'
                        }`}
                      >
                        {prof.field}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : type === 'inventory' ? (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Hardware Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="e.g. Prusa i3 MK3S+"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Category</label>
                <input 
                  type="text" 
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="e.g. Fabrication, Testing, Compute..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Specs / Details</label>
                <input 
                  type="text" 
                  value={formData.specs}
                  onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="e.g. 0.4mm Nozzle, PETG/PLA"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Title</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="Title"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Description {type === 'bench' ? '(Max 300)' : '(Max 200 recommended)'}
                </label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.substring(0, type === 'bench' ? 300 : 500) })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] min-h-[100px] resize-y radix-input"
                  placeholder="Brief description..."
                  maxLength={type === 'bench' ? 300 : 500}
                />
              </div>
            </>
          )}

          {hasAgents && (
            <div className="bg-[var(--bg-color)] border border-[var(--border)] rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center">
                  <Bot size={14} className="mr-1" /> AI Assistant
                </span>
                <button 
                  onClick={handleConsultAssistant}
                  disabled={isConsulting}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 disabled:opacity-50"
                >
                  {isConsulting ? 'Consulting...' : 'Consult Assistant'}
                </button>
              </div>
              {aiSuggestion && (
                <p className="text-xs text-[var(--text-main)] italic border-l-2 border-[var(--accent)] pl-2 py-1">
                  {aiSuggestion}
                </p>
              )}
            </div>
          )}

          {type === 'bench' && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                >
                  <option value="Designing">Designing</option>
                  <option value="Prototyping">Prototyping</option>
                  <option value="Testing">Testing</option>
                  <option value="Released">Released</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">Attributes</label>
                <div className="flex flex-wrap gap-2">
                  {['Private Iteration Log', 'Open Collaboration', 'Versioned Build', 'Progress Commitment'].map(attr => (
                    <button
                      key={attr}
                      onClick={() => toggleAttribute(attr)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        formData.attributes?.includes(attr) 
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--accent)]' 
                          : 'bg-[var(--bg-color)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-main)]'
                      }`}
                    >
                      {attr}
                    </button>
                  ))}
                </div>
              </div>
              
              {formData.attributes?.map((attr: string) => (
                <div key={`desc-${attr}`} className="pl-4 border-l-2 border-[var(--border)]">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">{attr} Details</label>
                  <input 
                    type="text" 
                    value={formData.attributeDescriptions?.[attr] || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      attributeDescriptions: { ...formData.attributeDescriptions, [attr]: e.target.value } 
                    })}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                    placeholder={`Details for ${attr}...`}
                  />
                </div>
              ))}
            </>
          )}

          {type === 'contribution' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Date</label>
              <input 
                type="date" 
                value={new Date(formData.date).toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value).getTime() })}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
              />
            </div>
          )}

          {(type === 'build' || type === 'archive') && (
            <>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                  placeholder="React, Rust, Hardware..."
                />
              </div>
              {type === 'build' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">External Link</label>
                  <input 
                    type="url" 
                    value={formData.externalLink || ''}
                    onChange={(e) => setFormData({ ...formData, externalLink: e.target.value })}
                    className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                    placeholder="https://..."
                  />
                </div>
              )}
            </>
          )}

          {type === 'bench' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">External Link (Optional)</label>
              <input 
                type="url" 
                value={formData.externalLink || ''}
                onChange={(e) => setFormData({ ...formData, externalLink: e.target.value })}
                className="w-full bg-[var(--bg-color)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                placeholder="https://..."
              />
            </div>
          )}

          {(type === 'bench' || type === 'build') && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {type === 'bench' ? 'Image (Optional)' : 'Thumbnail'}
              </label>
              <div className="flex items-center space-x-4">
                {(type === 'bench' ? formData.image : formData.thumbnail) && (
                  <img 
                    src={(type === 'bench' ? formData.image : formData.thumbnail) || null} 
                    alt="Preview" 
                    className="w-16 h-16 object-cover rounded-lg border border-[var(--border)]"
                  />
                )}
                <label className="px-4 py-2 bg-[var(--bg-color)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-main)] hover:border-[var(--accent)] cursor-pointer flex items-center space-x-2">
                  <ImageIcon size={16} />
                  <span>Upload Image</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)]"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-black text-sm font-bold uppercase tracking-wider hover:opacity-90 flex items-center space-x-2"
          >
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}

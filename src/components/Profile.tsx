import React, { useState, useEffect, useRef } from 'react';
import { 
  Info, Edit3, X, Save, Plus, Trash2, Link as LinkIcon, 
  ChevronDown, ChevronUp, Image as ImageIcon, ExternalLink,
  Lock, Users, GitCommit, Flame, Bot, Upload, Star, ShieldCheck, Cpu, Box, Network
} from 'lucide-react';
import { getSetting, setSetting } from '../lib/db';
import { ProjectEditModal } from './ProjectEditModal';
import { useAvifEncoder } from '../hooks/useAvifEncoder';
import TechTree from './TechTree';

// --- Types ---

type BenchAttribute = 'Private Iteration Log' | 'Open Collaboration' | 'Versioned Build' | 'Progress Commitment';
type BuildStatus = 'Designing' | 'Prototyping' | 'Testing' | 'Released';

interface BenchBuild {
  id: string;
  title: string;
  description: string;
  status: BuildStatus;
  lastUpdated: number;
  image?: string;
  externalLink?: string;
  attributes: BenchAttribute[];
  attributeDescriptions: Record<string, string>;
}

interface ProjectBuild {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  tags: string[];
  externalLink?: string;
}

interface ExternalPresence {
  id: string;
  platform: string;
  username: string;
  previewText?: string;
  url: string;
}

interface Contribution {
  id: string;
  title: string;
  description: string;
  date: number;
}

interface Proficiency {
  id: string;
  field: string;
  level: 'Novice' | 'Intermediate' | 'Advanced' | 'Expert';
  details?: string;
  connections?: string[];
}

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | '3d_model';
  caption?: string;
  dateAdded: number;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  specs?: string;
}

interface WorkshopProfile {
  alias: string;
  tagline: string;
  avatar: string;
  avatarShape: 'circle' | 'portrait';
  banner: string;
  identity: {
    type: 'Human' | 'AI';
    verified: boolean;
    pgpPublicKey?: string;
  };
  metadata: {
    region: string;
    primaryDomain: string;
    yearsActive: string;
  };
  about: string;
  proficiencies: Proficiency[];
  inventory: InventoryItem[];
  onTheBench: BenchBuild[];
  builds: ProjectBuild[];
  mediaGallery: MediaItem[];
  activeIn: ExternalPresence[];
  domainsAndTools: {
    domains: string[];
    tools: string[];
  };
  contributions: Contribution[];
  archivedProjects: ProjectBuild[];
}

const DEFAULT_PROFILE: WorkshopProfile = {
  alias: 'Builder',
  tagline: 'Building the future of local-first software.',
  avatar: 'https://picsum.photos/seed/avatar/512/512',
  avatarShape: 'circle',
  banner: 'https://picsum.photos/seed/banner/1500/500',
  identity: {
    type: 'Human',
    verified: false,
  },
  metadata: {
    region: 'Global',
    primaryDomain: 'Software',
    yearsActive: '5+'
  },
  about: 'I am a builder focused on decentralized systems and high-performance interfaces. I enjoy working across the stack, from low-level systems to user-facing applications.',
  proficiencies: [
    { id: '1', field: 'Software Engineering', level: 'Expert', details: 'React, Rust, Node.js', connections: ['3'] },
    { id: '2', field: '3D Printing', level: 'Advanced', details: 'FDM, Resin, Fusion 360', connections: ['4'] },
    { id: '3', field: 'LLM / ML', level: 'Intermediate', details: 'Fine-tuning, RAG, PyTorch', connections: ['1'] },
    { id: '4', field: 'Micro Electronics', level: 'Novice', details: 'Arduino, Basic Soldering', connections: ['2'] }
  ],
  inventory: [
    { id: '1', name: 'Prusa i3 MK3S+', category: 'Fabrication', specs: '0.4mm Nozzle, PETG/PLA' },
    { id: '2', name: 'Rigol DS1054Z', category: 'Testing', specs: '50MHz, 4-Channel Oscilloscope' },
    { id: '3', name: 'Local Compute Node', category: 'Compute', specs: 'RTX 3090, 64GB RAM' }
  ],
  onTheBench: [
    {
      id: '1',
      title: 'Radix Core Engine',
      description: 'Rewriting the core synchronization engine in Rust for better performance and memory safety.',
      status: 'Prototyping',
      lastUpdated: Date.now(),
      attributes: ['Versioned Build', 'Open Collaboration'],
      attributeDescriptions: {
        'Versioned Build': 'Currently on v0.4.2-alpha',
        'Open Collaboration': 'Looking for reviewers on the networking layer.'
      }
    }
  ],
  builds: [
    {
      id: '1',
      title: 'HyperGrid',
      description: 'A distributed key-value store built for edge networks.',
      tags: ['Rust', 'Networking', 'Distributed Systems'],
      thumbnail: 'https://picsum.photos/seed/hypergrid/600/400'
    },
    {
      id: '2',
      title: 'Ergo-Mech Keyboard',
      description: 'Custom split keyboard with 3D printed case and hand-wired matrix.',
      tags: ['Hardware', '3D Printing', 'C++'],
      thumbnail: 'https://picsum.photos/seed/keyboard/600/400'
    }
  ],
  mediaGallery: [],
  activeIn: [
    {
      id: '1',
      platform: 'GitHub',
      username: 'builder-core',
      previewText: '1.2k contributions this year',
      url: 'https://github.com'
    },
    {
      id: '2',
      platform: 'Printables',
      username: 'maker_space',
      previewText: '15 models published',
      url: 'https://printables.com'
    }
  ],
  domainsAndTools: {
    domains: ['Software', 'Hardware', 'Fabrication'],
    tools: ['Rust', 'TypeScript', 'React', 'Fusion 360', 'KiCad', 'Linux']
  },
  contributions: [
    {
      id: '1',
      title: 'Participated in Sprint',
      description: 'Helped resolve 15 issues during the Winter Open Source Sprint.',
      date: Date.now() - 86400000 * 5
    },
    {
      id: '2',
      title: 'Reviewed Schematics',
      description: 'Provided feedback on the v2 board design for the community sensor project.',
      date: Date.now() - 86400000 * 14
    }
  ],
  archivedProjects: [
    {
      id: '1',
      title: 'Legacy Dashboard',
      description: 'Old version of the analytics dashboard, deprecated in 2023.',
      tags: ['React', 'Node.js'],
    }
  ]
};

// --- Components ---

export default function Profile() {
  const [profile, setProfile] = useState<WorkshopProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<WorkshopProfile | null>(null);
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<string | null>(null);

  const handleGenerateEmbedding = async () => {
    setIsGeneratingEmbedding(true);
    setEmbeddingStatus('Loading ML Engine (WebGPU)...');
    try {
      // Dynamically import to avoid bloating the main bundle
      const { pipeline, env } = await import('@xenova/transformers');
      
      // Optional: Configure env for WebGPU if available, otherwise it falls back to WASM
      // env.backends.onnx.wasm.numThreads = 1;
      
      setEmbeddingStatus('Downloading model (first time only)...');
      // Use a small, fast embedding model
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      
      setEmbeddingStatus('Generating profile vector...');
      // Create a text representation of the profile
      const profileText = `
        Alias: ${displayProfile.alias}
        Bio: ${displayProfile.about}
        Proficiencies: ${displayProfile.proficiencies.map(p => p.field).join(', ')}
        Hardware: ${displayProfile.inventory.map(i => i.name).join(', ')}
        Tools: ${displayProfile.domainsAndTools.tools.join(', ')}
      `;
      
      const output = await extractor(profileText, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data);
      
      // Store the embedding locally
      await setSetting('profile_embedding', vector);
      
      setEmbeddingStatus(`Success! Generated ${vector.length}-dimensional vector.`);
      setTimeout(() => setEmbeddingStatus(null), 3000);
    } catch (err: any) {
      console.error('Embedding error:', err);
      setEmbeddingStatus(`Error: ${err.message}`);
    } finally {
      setIsGeneratingEmbedding(false);
    }
  };
  const [showBannerInfo, setShowBannerInfo] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  const [editingProject, setEditingProject] = useState<{ type: 'bench' | 'build' | 'presence' | 'contribution' | 'archive' | 'proficiency' | 'inventory', data: any } | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  
  const { encodeImage } = useAvifEncoder();

  useEffect(() => {
    // Load model-viewer script dynamically
    if (!document.querySelector('script[src*="model-viewer"]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
      document.head.appendChild(script);
    }
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const p = await getSetting('workshop_profile');
    if (p) {
      setProfile(p);
      setEditForm(p);
    } else {
      setProfile(DEFAULT_PROFILE);
      setEditForm(DEFAULT_PROFILE);
    }
  };

  const handleSave = async () => {
    if (editForm) {
      await setSetting('workshop_profile', editForm);
      setProfile(editForm);
      setIsEditing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (file && editForm) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm({ ...editForm, [type]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editForm) {
      setIsUploadingMedia(true);
      
      const is3DModel = file.name.endsWith('.glb') || file.name.endsWith('.gltf') || file.name.endsWith('.obj') || file.name.endsWith('.stl');
      
      try {
        let url = '';
        if (is3DModel) {
          // For 3D models, we just use a local object URL or read as data URL directly
          // In a real app, this would upload to a server/IPFS
          const reader = new FileReader();
          reader.onloadend = () => {
            const newMedia: MediaItem = {
              id: Date.now().toString(),
              url: reader.result as string,
              type: '3d_model',
              dateAdded: Date.now()
            };
            setEditForm({
              ...editForm,
              mediaGallery: [...(editForm.mediaGallery || []), newMedia]
            });
            setIsUploadingMedia(false);
          };
          reader.readAsDataURL(file);
        } else {
          const avifBlob = await encodeImage(file, 65, 8, '1080p');
          const reader = new FileReader();
          reader.onloadend = () => {
            const newMedia: MediaItem = {
              id: Date.now().toString(),
              url: reader.result as string,
              type: 'image',
              dateAdded: Date.now()
            };
            setEditForm({
              ...editForm,
              mediaGallery: [...(editForm.mediaGallery || []), newMedia]
            });
            setIsUploadingMedia(false);
          };
          reader.readAsDataURL(avifBlob);
        }
      } catch (err) {
        console.error("Media upload failed", err);
        setIsUploadingMedia(false);
      }
    }
  };

  const handleVerifyIdentity = () => {
    setIsVerifying(true);
    // Simulate a cryptographic check or Cloudflare Turnstile verification
    setTimeout(() => {
      if (editForm) {
        const updated = { ...editForm, identity: { ...editForm.identity, verified: true } };
        setEditForm(updated);
        setSetting('workshop_profile', updated);
      }
      setIsVerifying(false);
    }, 2000);
  };

  const handleSaveProject = (data: any) => {
    if (!editForm) return;
    
    const type = editingProject?.type;
    const listKey = type === 'bench' ? 'onTheBench' : 
                    type === 'build' ? 'builds' : 
                    type === 'presence' ? 'activeIn' : 
                    type === 'contribution' ? 'contributions' : 
                    type === 'proficiency' ? 'proficiencies' :
                    'archivedProjects';
    const list = editForm[listKey] as any[];
    
    const existingIndex = list.findIndex(item => item.id === data.id);
    let newList = [...list];
    
    if (existingIndex >= 0) {
      newList[existingIndex] = data;
    } else {
      newList.push(data);
    }
    
    setEditForm({ ...editForm, [listKey]: newList });
    setEditingProject(null);
  };

  const handleDeleteProject = (id: string, type: 'bench' | 'build' | 'presence' | 'contribution' | 'archive' | 'proficiency' | 'inventory' | 'media') => {
    if (!editForm) return;
    
    if (type === 'media') {
      setEditForm({ ...editForm, mediaGallery: editForm.mediaGallery.filter(item => item.id !== id) });
      return;
    }

    const listKey = type === 'bench' ? 'onTheBench' : 
                    type === 'build' ? 'builds' : 
                    type === 'presence' ? 'activeIn' : 
                    type === 'contribution' ? 'contributions' : 
                    type === 'proficiency' ? 'proficiencies' :
                    type === 'inventory' ? 'inventory' :
                    'archivedProjects';
    const list = editForm[listKey] as any[];
    setEditForm({ ...editForm, [listKey]: list.filter(item => item.id !== id) });
  };

  if (!profile) return null;

  const displayProfile = isEditing && editForm ? editForm : profile;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] overflow-y-auto">
      {/* Header Actions */}
      <div className="sticky top-0 z-30 flex justify-between items-center p-4 bg-[var(--bg-color)]/80 backdrop-blur-md border-b border-[var(--border)]">
        <h1 className="text-lg font-bold tracking-widest uppercase text-[var(--accent)]">Workshop</h1>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="radix-button px-4 py-2 flex items-center space-x-2 text-sm uppercase tracking-wider rounded-xl"
        >
          {isEditing ? (
            <>
              <Save size={16} />
              <span>Save</span>
            </>
          ) : (
            <>
              <Edit3 size={16} />
              <span>Edit</span>
            </>
          )}
        </button>
      </div>

      <div className="flex flex-col pb-20">
        {/* 1. HERO SECTION (Wall) */}
        <div className="relative w-full">
          {/* Banner */}
          <div className="relative w-full aspect-[3/1] bg-[var(--panel-bg)]">
            <img 
              src={displayProfile.banner} 
              alt="Banner" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/60 pointer-events-none" />
            
            {/* Info Icon */}
            <button 
              onClick={() => setShowBannerInfo(true)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
            >
              <Info size={16} />
            </button>

            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => bannerInputRef.current?.click()}
                  className="px-4 py-2 bg-black/70 text-white rounded-xl flex items-center space-x-2 text-sm uppercase tracking-wider"
                >
                  <ImageIcon size={16} />
                  <span>Change Banner</span>
                </button>
                <input 
                  type="file" 
                  ref={bannerInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'banner')}
                />
              </div>
            )}
          </div>

          {/* Profile Info Overlay */}
          <div className="px-4 sm:px-8 -mt-16 sm:-mt-24 relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className={`
                overflow-hidden border-4 border-[var(--bg-color)] bg-[var(--panel-bg)]
                ${displayProfile.avatarShape === 'circle' ? 'w-32 h-32 sm:w-40 sm:h-40 rounded-full' : 'w-32 h-40 sm:w-40 sm:h-48 rounded-2xl'}
              `}>
                <img 
                  src={displayProfile.avatar} 
                  alt={displayProfile.alias} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {isEditing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-white hover:text-[var(--accent)]"
                  >
                    <ImageIcon size={20} />
                  </button>
                  <button
                    onClick={() => setEditForm({ ...editForm!, avatarShape: editForm!.avatarShape === 'circle' ? 'portrait' : 'circle' })}
                    className="p-2 text-white hover:text-[var(--accent)] text-[10px] uppercase tracking-wider mt-2"
                  >
                    Toggle Shape
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'avatar')}
                  />
                </div>
              )}
            </div>

            {/* Text Info */}
            <div className="flex-1 pb-2 sm:pb-4 w-full">
              {isEditing ? (
                <div className="space-y-2 w-full max-w-md">
                  <input 
                    type="text" 
                    value={editForm!.alias}
                    onChange={(e) => setEditForm({ ...editForm!, alias: e.target.value.substring(0, 50) })}
                    className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-xl font-bold text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                    placeholder="Alias (Max 50 chars)"
                    maxLength={50}
                  />
                  <input 
                    type="text" 
                    value={editForm!.tagline}
                    onChange={(e) => setEditForm({ ...editForm!, tagline: e.target.value.substring(0, 80) })}
                    className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] radix-input"
                    placeholder="Tagline (Max 80 chars)"
                    maxLength={80}
                  />
                  <div className="flex gap-2 mt-2">
                    <input 
                      type="text" 
                      value={editForm!.metadata.region}
                      onChange={(e) => setEditForm({ ...editForm!, metadata: { ...editForm!.metadata, region: e.target.value } })}
                      className="flex-1 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                      placeholder="Region"
                    />
                    <input 
                      type="text" 
                      value={editForm!.metadata.primaryDomain}
                      onChange={(e) => setEditForm({ ...editForm!, metadata: { ...editForm!.metadata, primaryDomain: e.target.value } })}
                      className="flex-1 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                      placeholder="Primary Domain"
                    />
                    <input 
                      type="text" 
                      value={editForm!.metadata.yearsActive}
                      onChange={(e) => setEditForm({ ...editForm!, metadata: { ...editForm!.metadata, yearsActive: e.target.value } })}
                      className="w-24 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] radix-input"
                      placeholder="Years Active"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] tracking-tight">{displayProfile.alias}</h2>
                  {displayProfile.tagline && (
                    <p className="text-sm sm:text-base text-[var(--text-muted)]">{displayProfile.tagline}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {displayProfile.metadata.region && (
                      <span className="px-3 py-1 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                        {displayProfile.metadata.region}
                      </span>
                    )}
                    {displayProfile.metadata.primaryDomain && (
                      <span className="px-3 py-1 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                        {displayProfile.metadata.primaryDomain}
                      </span>
                    )}
                    {displayProfile.metadata.yearsActive && (
                      <span className="px-3 py-1 rounded-full bg-[var(--panel-bg)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                        {displayProfile.metadata.yearsActive} Active
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-8 mt-8 space-y-12 max-w-5xl mx-auto w-full">
          
          {/* 2. PROFICIENCIES & TECH TREE */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Tech Tree & Proficiencies</h3>
              {isEditing && (
                <button 
                  onClick={() => setEditingProject({ type: 'proficiency', data: null })}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add Node</span>
                </button>
              )}
            </div>
            
            {/* Force Graph Visualization */}
            <div className="mb-6">
              <TechTree proficiencies={displayProfile.proficiencies || []} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayProfile.proficiencies?.map(prof => (
                <div key={prof.id} className="radix-panel p-4 rounded-xl border border-[var(--border)] relative group">
                  {isEditing && (
                    <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => setEditingProject({ type: 'proficiency', data: prof })} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:text-[var(--accent)]">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteProject(prof.id, 'proficiency')} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-[var(--text-main)]">{prof.field}</h4>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider border ${
                      prof.level === 'Expert' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' :
                      prof.level === 'Advanced' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                      prof.level === 'Intermediate' ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' :
                      'bg-slate-500/10 border-slate-500/30 text-slate-500'
                    }`}>
                      {prof.level}
                    </span>
                  </div>
                  {prof.details && (
                    <p className="text-xs text-[var(--text-muted)]">{prof.details}</p>
                  )}
                </div>
              ))}
              {(!displayProfile.proficiencies || displayProfile.proficiencies.length === 0) && !isEditing && (
                <p className="text-sm text-[var(--text-muted)] italic">No proficiencies listed.</p>
              )}
            </div>
          </section>

          {/* 3. LAB / HARDWARE INVENTORY */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Lab Inventory</h3>
              {isEditing && (
                <button 
                  onClick={() => setEditingProject({ type: 'inventory', data: null })}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add Hardware</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProfile.inventory?.map(item => (
                <div key={item.id} className="radix-panel p-4 rounded-xl border border-[var(--border)] relative group flex items-start space-x-3">
                  <div className="p-2 bg-[var(--bg-color)] rounded-lg border border-[var(--border)]">
                    {item.category.toLowerCase().includes('compute') ? <Cpu size={18} className="text-[var(--text-muted)]" /> : <Box size={18} className="text-[var(--text-muted)]" />}
                  </div>
                  <div className="flex-1">
                    {isEditing && (
                      <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={() => setEditingProject({ type: 'inventory', data: item })} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:text-[var(--accent)]">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDeleteProject(item.id, 'inventory')} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                    <h4 className="text-sm font-bold text-[var(--text-main)]">{item.name}</h4>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] block mb-1">{item.category}</span>
                    {item.specs && <p className="text-xs text-[var(--text-muted)]">{item.specs}</p>}
                  </div>
                </div>
              ))}
              {(!displayProfile.inventory || displayProfile.inventory.length === 0) && !isEditing && (
                <p className="text-sm text-[var(--text-muted)] italic">No hardware listed.</p>
              )}
            </div>
          </section>

          {/* 4. ON THE BENCH */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">On The Bench</h3>
              {isEditing && (
                <button 
                  onClick={() => setEditingProject({ type: 'bench', data: null })}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            <div className="space-y-4">
              {displayProfile.onTheBench.map((build, idx) => (
                <div key={build.id} className="radix-panel p-4 sm:p-6 rounded-2xl border border-[var(--border)] relative group">
                  {isEditing && (
                    <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingProject({ type: 'bench', data: build })} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)]">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteProject(build.id, 'bench')} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {build.image && (
                      <div className="w-full sm:w-48 h-32 sm:h-auto flex-shrink-0">
                        <img src={build.image} alt={build.title} className="w-full h-full object-cover rounded-xl border border-[var(--border)]" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2 pr-16">
                        <h4 className="text-lg font-bold text-[var(--text-main)]">{build.title}</h4>
                        <span className="px-2 py-1 rounded-md bg-[var(--bg-color)] border border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--accent)]">
                          {build.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] mb-4">{build.description}</p>
                      
                      {build.externalLink && (
                        <a href={build.externalLink} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1 mb-4 inline-flex">
                          <ExternalLink size={12} />
                          <span>View Project</span>
                        </a>
                      )}
                      
                      {build.attributes.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                          {build.attributes.map(attr => (
                            <div key={attr} className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-xs text-[var(--text-muted)] group/attr cursor-help relative">
                              {attr === 'Private Iteration Log' && <Lock size={12} />}
                              {attr === 'Open Collaboration' && <Users size={12} />}
                              {attr === 'Versioned Build' && <GitCommit size={12} />}
                              {attr === 'Progress Commitment' && <Flame size={12} />}
                              <span>{attr}</span>
                              
                              {/* Tooltip for attribute description */}
                              {build.attributeDescriptions?.[attr] && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] p-2 bg-[var(--panel-bg)] border border-[var(--border)] rounded-lg text-[10px] text-[var(--text-main)] opacity-0 group-hover/attr:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                  {build.attributeDescriptions[attr]}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {displayProfile.onTheBench.length === 0 && !isEditing && (
                <p className="text-sm text-[var(--text-muted)] italic">Nothing on the bench right now.</p>
              )}
            </div>
          </section>

          {/* 5. ABOUT */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)] border-b border-[var(--border)] pb-2">About</h3>
            {isEditing ? (
              <textarea 
                value={editForm!.about}
                onChange={(e) => setEditForm({ ...editForm!, about: e.target.value.substring(0, 1000) })}
                className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] min-h-[150px] resize-y radix-input"
                placeholder="About (Max 1000 chars)"
                maxLength={1000}
              />
            ) : (
              <div className="relative">
                <p className={`text-sm leading-relaxed text-[var(--text-main)] ${!aboutExpanded && displayProfile.about.length > 250 ? 'line-clamp-3' : ''}`}>
                  {displayProfile.about}
                </p>
                {!aboutExpanded && displayProfile.about.length > 250 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[var(--bg-color)] to-transparent pointer-events-none" />
                )}
                {displayProfile.about.length > 250 && (
                  <button 
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="mt-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                  >
                    <span>{aboutExpanded ? 'Collapse' : 'Expand'}</span>
                    {aboutExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 6. BUILDS */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Builds</h3>
              {isEditing && (
                <button 
                  onClick={() => setEditingProject({ type: 'build', data: null })}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {displayProfile.builds.map(build => (
                <div key={build.id} className="radix-panel rounded-[16px] border border-[var(--border)] overflow-hidden flex flex-col hover:border-[var(--text-muted)] transition-colors group shadow-sm relative">
                  {isEditing && (
                    <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => setEditingProject({ type: 'build', data: build })} className="p-1.5 rounded-lg bg-[var(--bg-color)]/80 backdrop-blur-sm border border-[var(--border)] text-[var(--text-main)] hover:text-[var(--accent)]">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteProject(build.id, 'build')} className="p-1.5 rounded-lg bg-[var(--bg-color)]/80 backdrop-blur-sm border border-[var(--border)] text-[var(--text-main)] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {build.thumbnail && (
                    <div className="w-full aspect-video bg-[var(--bg-color)] overflow-hidden border-b border-[var(--border)]">
                      <img src={build.thumbnail} alt={build.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="text-base font-bold text-[var(--text-main)] mb-1">{build.title}</h4>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1 mb-3 flex-1">{build.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {build.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-md bg-[var(--bg-color)] border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                          {tag}
                        </span>
                      ))}
                    </div>
                    {build.externalLink && (
                      <a href={build.externalLink} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1 mt-auto">
                        <span>View Details</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. MEDIA GALLERY & 3D MODELS */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Media & 3D Models</h3>
              {isEditing && (
                <div>
                  <button 
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={isUploadingMedia}
                    className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1 disabled:opacity-50"
                  >
                    {isUploadingMedia ? <span className="animate-pulse">Processing...</span> : <><Upload size={14} /><span>Upload (AVIF/GLB)</span></>}
                  </button>
                  <input 
                    type="file" 
                    ref={mediaInputRef} 
                    className="hidden" 
                    accept="image/*,.glb,.gltf,.obj,.stl"
                    onChange={handleMediaUpload}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayProfile.mediaGallery?.map(media => (
                <div key={media.id} className="relative group aspect-video sm:aspect-square rounded-xl overflow-hidden bg-[var(--panel-bg)] border border-[var(--border)]">
                  {media.type === '3d_model' ? (
                    React.createElement('model-viewer', {
                      src: media.url,
                      'auto-rotate': true,
                      'camera-controls': true,
                      style: { width: '100%', height: '100%', backgroundColor: 'var(--bg-color)' }
                    })
                  ) : (
                    <img src={media.url} alt="Gallery item" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )}
                  {isEditing && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => handleDeleteProject(media.id, 'media')} className="p-1.5 rounded-lg bg-black/60 text-white hover:text-red-500 backdrop-blur-sm">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  {media.type === '3d_model' && (
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] uppercase tracking-wider px-2 py-1 rounded-md pointer-events-none">
                      Interactive 3D
                    </div>
                  )}
                </div>
              ))}
              {(!displayProfile.mediaGallery || displayProfile.mediaGallery.length === 0) && !isEditing && (
                <p className="text-sm text-[var(--text-muted)] italic col-span-full">No media or 3D models uploaded yet.</p>
              )}
            </div>
          </section>

          {/* 8. ACTIVE IN */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Active In</h3>
              {isEditing && (
                <button 
                  onClick={() => setEditingProject({ type: 'presence', data: null })}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayProfile.activeIn.map(presence => (
                <div key={presence.id} className="relative group">
                  <a 
                    href={presence.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="radix-panel p-4 rounded-xl border border-[var(--border)] flex items-center justify-between hover:border-[var(--text-muted)] transition-colors block w-full"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] flex items-center justify-center text-[var(--text-main)]">
                        <LinkIcon size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[var(--text-main)]">{presence.platform}</div>
                        <div className="text-xs text-[var(--text-muted)]">@{presence.username}</div>
                      </div>
                    </div>
                    <ExternalLink size={16} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                  </a>
                  {isEditing && (
                    <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => setEditingProject({ type: 'presence', data: presence })} className="p-1.5 rounded-lg bg-[var(--bg-color)]/80 backdrop-blur-sm border border-[var(--border)] text-[var(--text-main)] hover:text-[var(--accent)]">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteProject(presence.id, 'presence')} className="p-1.5 rounded-lg bg-[var(--bg-color)]/80 backdrop-blur-sm border border-[var(--border)] text-[var(--text-main)] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 9. DOMAINS & TOOLS */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)] border-b border-[var(--border)] pb-2">Domains & Tools</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Domains</h4>
                  {isEditing && (
                    <button 
                      onClick={() => {
                        const newDomain = prompt('Enter new domain:');
                        if (newDomain && editForm) {
                          setEditForm({
                            ...editForm,
                            domainsAndTools: {
                              ...editForm.domainsAndTools,
                              domains: [...editForm.domainsAndTools.domains, newDomain]
                            }
                          });
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayProfile.domainsAndTools.domains.map(domain => (
                    <span key={domain} className="px-3 py-1.5 rounded-lg bg-[var(--panel-bg)] border border-[var(--border)] text-sm text-[var(--text-main)] flex items-center space-x-2">
                      <span>{domain}</span>
                      {isEditing && (
                        <button 
                          onClick={() => {
                            if (editForm) {
                              setEditForm({
                                ...editForm,
                                domainsAndTools: {
                                  ...editForm.domainsAndTools,
                                  domains: editForm.domainsAndTools.domains.filter(d => d !== domain)
                                }
                              });
                            }
                          }}
                          className="text-[var(--text-muted)] hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Tools</h4>
                  {isEditing && (
                    <button 
                      onClick={() => {
                        const newTool = prompt('Enter new tool:');
                        if (newTool && editForm) {
                          setEditForm({
                            ...editForm,
                            domainsAndTools: {
                              ...editForm.domainsAndTools,
                              tools: [...editForm.domainsAndTools.tools, newTool]
                            }
                          });
                        }
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayProfile.domainsAndTools.tools.map(tool => (
                    <span key={tool} className="px-3 py-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-sm text-[var(--text-muted)] flex items-center space-x-2">
                      <span>{tool}</span>
                      {isEditing && (
                        <button 
                          onClick={() => {
                            if (editForm) {
                              setEditForm({
                                ...editForm,
                                domainsAndTools: {
                                  ...editForm.domainsAndTools,
                                  tools: editForm.domainsAndTools.tools.filter(t => t !== tool)
                                }
                              });
                            }
                          }}
                          className="text-[var(--text-muted)] hover:text-red-500"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 10. CONTRIBUTIONS */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Contributions</h3>
              {isEditing && (
                <button 
                  onClick={() => setEditingProject({ type: 'contribution', data: null })}
                  className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>
            <div className="space-y-4">
              {displayProfile.contributions.map(contrib => (
                <div key={contrib.id} className="flex space-x-4 relative group">
                  <div className="w-2 h-2 mt-2 rounded-full bg-[var(--accent)] shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[var(--text-main)]">{contrib.title}</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{contrib.description}</p>
                    <div className="text-[10px] text-[var(--text-muted)] mt-2 uppercase tracking-wider">
                      {new Date(contrib.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  {isEditing && (
                    <div className="absolute top-0 right-0 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingProject({ type: 'contribution', data: contrib })} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent)]">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDeleteProject(contrib.id, 'contribution')} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-muted)] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 11. ARCHIVED PROJECTS */}
          {(displayProfile.archivedProjects.length > 0 || isEditing) && (
            <section className="space-y-4 border-t border-[var(--border)] pt-8">
              <div className="flex justify-between items-center">
                <button 
                  onClick={() => setArchivedExpanded(!archivedExpanded)}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)]">Archived Projects</h3>
                  <div className="text-[var(--text-muted)]">
                    {archivedExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>
                {isEditing && archivedExpanded && (
                  <button 
                    onClick={() => setEditingProject({ type: 'archive', data: null })}
                    className="ml-4 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] hover:opacity-80 flex items-center space-x-1"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                )}
              </div>
              
              {archivedExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  {displayProfile.archivedProjects.map(project => (
                    <div key={project.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] opacity-70 relative group">
                      <h4 className="text-sm font-bold text-[var(--text-main)] mb-1">{project.title}</h4>
                      <p className="text-xs text-[var(--text-muted)] mb-3">{project.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {project.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md bg-[var(--bg-color)] border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {isEditing && (
                        <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingProject({ type: 'archive', data: project })} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:text-[var(--accent)]">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDeleteProject(project.id, 'archive')} className="p-1.5 rounded-lg bg-[var(--bg-color)] border border-[var(--border)] text-[var(--text-main)] hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 12. NETWORK MATCHMAKING (ML EMBEDDINGS) */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
              <h3 className="text-sm font-bold tracking-widest uppercase text-[var(--text-muted)] flex items-center">
                <Network size={16} className="mr-2" />
                Network Matchmaking
              </h3>
            </div>
            <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
              <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed">
                Generate a mathematical vector representation of your Foundry using a local, in-browser ML model (WebGPU). 
                This allows you to find collaborators with overlapping skills or hardware on decentralized P2P networks without sending your profile data to a central server.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={handleGenerateEmbedding}
                  disabled={isGeneratingEmbedding}
                  className="px-6 py-3 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center shadow-md"
                >
                  <Network size={16} className="mr-2" />
                  {isGeneratingEmbedding ? 'Processing...' : 'Generate Profile Vector'}
                </button>
                
                {embeddingStatus && (
                  <div className={`text-xs font-mono ${embeddingStatus.includes('Error') ? 'text-red-500' : 'text-[var(--accent)]'}`}>
                    {embeddingStatus}
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      {/* Banner Info Modal */}
      {showBannerInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="radix-panel p-6 rounded-2xl max-w-sm w-full border border-[var(--border)] animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-[var(--text-main)] mb-4">Image Guidelines</h3>
            <div className="space-y-4 text-sm text-[var(--text-muted)]">
              <div>
                <strong className="text-[var(--text-main)] block mb-1">Banner Image</strong>
                <p>Recommended size: 1500x500 pixels (3:1 aspect ratio).</p>
              </div>
              <div>
                <strong className="text-[var(--text-main)] block mb-1">Profile Image</strong>
                <p>Minimum upload resolution: 512x512 pixels. Stored as square internally.</p>
              </div>
            </div>
            <button 
              onClick={() => setShowBannerInfo(false)}
              className="mt-6 w-full py-2 rounded-xl bg-[var(--accent)] text-black font-bold uppercase tracking-wider hover:opacity-90"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Project Edit Modal */}
      {editingProject && (
        <ProjectEditModal
          type={editingProject.type}
          initialData={editingProject.data}
          onSave={handleSaveProject}
          onClose={() => setEditingProject(null)}
          allProficiencies={displayProfile.proficiencies}
        />
      )}
    </div>
  );
}
